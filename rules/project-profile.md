# Project Profile (Verified Facts)

## Purpose
This is the **ground-truth architecture reference** for this specific HRMS codebase. Other rule and skill files tell the agent to "detect the architecture" — this file records what that detection actually resolves to, so the agent follows known facts instead of re-deriving (and re-guessing) them every run.

> [!IMPORTANT]
> These are observed facts, not aspirations. Still run the [System Awareness](./system-awareness.md) scan for the specific models/columns/routes you touch — but do NOT contradict the patterns below (e.g. don't introduce API Resources; this project doesn't use them). If reality has drifted from this file, update this file.

---

## Stack
- **Backend**: Laravel (PHP), Sanctum auth. Entry: `app/`, routes in `routes/api.php`.
- **Frontend**: Vue 3 `<script setup>` + Composition API, Vue Router, Tailwind CSS, Vite. Root: `resources/views/web/src/`.
- **Testing**: PHPUnit (`vendor/bin/phpunit`), Vitest (`npm run test`). `tests/` at project root.

---

## Backend Architecture: Domain Query/Handler Pattern

This project uses a **thin-controller + Domain Query/Handler** pattern. Do NOT introduce Services, Repositories, or Action classes for new work (an `app/Services/` and `app/Domain/Services/` exist but are the exception — match the Query/Handler pattern for standard CRUD/read/write).

**Reads → Query classes**
- Location/namespace: `app/Domain/Queries/<Domain>/` → `App\Domain\Queries\<Domain>`
- `<Domain>` is a PascalCase domain folder (`Timesheet`, `Leave`, `Overtime`) OR a portal-lowercase folder (`tk`, `hr`). Match the folder the sibling classes for your feature already use.
- Extends the empty base `App\Domain\Queries\Query`.
- Signature: `public static function execute($params = [])` — called statically.

```php
namespace App\Domain\Queries\tk;

use App\Domain\Queries\Query;
use App\Models\Leave;

class GetLeavePolicyStatisticsQuery extends Query
{
    public static function execute($params = [])
    {
        return Leave::where('active', 'Y')->get();
    }
}
```

**Writes → Handler classes**
- Location/namespace: `app/Domain/Handlers/<Domain>/` → `App\Domain\Handlers\<Domain>`
- Extends the empty base `App\Domain\Handlers\Handler`.
- Static `execute(...)` — args may be an array (`$request->all()`) or positional (`$employeeId, $date, $data`); match sibling handlers.
- Wrap create/update/delete in `DB::transaction(function () { ... })`.

**Controllers → thin dispatchers**
- Location/namespace: `app/Http/Controllers/<portal>/` → `App\Http\Controllers\<portal>` (portals below).
- Extend `App\Http\Controllers\Controller`.
- Each method: call a Query/Handler statically, wrap in `try/catch (Exception $e)`, return JSON.

```php
public function getRequests(Request $request)
{
    try {
        $data = GetLeaveConversionRequestsQuery::execute($request->all());
        return response()->json(['data' => $data]);
    } catch (Exception $e) {
        return response()->json(['message' => $e->getMessage()], 400);
    }
}
```

**Response format (NO API Resources)**
- There are **zero** `JsonResource` / API Resource classes in this project. Do NOT create them.
- Success: `return response()->json($data);` or `return response()->json(['data' => $data]);` — match the sibling method's shape.
- Error: `return response()->json(['message' => $e->getMessage()], 400);` inside `try/catch`.

**Validation (FormRequests are the exception, not the rule)**
- Only a handful of `Store*Request` classes exist, and they live **flat** in `app/Http/Requests/` (e.g. `app/Http/Requests/StorePositionRequest.php`) — NOT in portal subfolders.
- Most controllers take `Request $request` and pass `$request->all()` straight to the Query/Handler. Match whatever the module you're editing already does; only add a FormRequest if the surrounding controller already uses one.

---

## Portals & Route Prefixes

`routes/api.php` — everything (except a couple of biometric endpoints) is inside one `Route::middleware(['auth:sanctum'])->group(...)`. Inside it, routes are grouped by portal prefix.

| Portal | Controller namespace | Route prefix (URL) | Frontend module folder |
|---|---|---|---|
| Employee | `employee` | `employee` | `employee` |
| Manager | `manager` | `manager` | `manager` |
| HR | `hr` | `hr` | `hr` |
| Timekeeping | **`tk`** | **`timekeeping`** | **`timekeeping`** |
| Payroll | `payroll` | `payroll` | `payroll` |
| Admin | `admin` | `admin/database` | `admin` |
| Global | `global` | (no prefix, top-level) | — |

> [!CAUTION]
> **Timekeeping gotcha**: the controller namespace is `tk` (`App\Http\Controllers\tk\...`) but the URL prefix and frontend folder are **`timekeeping`** (`api/timekeeping/...`). Do not register `api/tk/...` routes — grep confirms the real prefix is `timekeeping`.

- Add new routes **inside the matching existing prefix group**. Never create a new top-level group for an existing portal.
- Route definitions are explicit per-method (`Route::get('/x', [XController::class, 'method'])`); `apiResource` is used occasionally. Match the sibling routes' style.

---

## Frontend Architecture

**Module structure** — `resources/views/web/src/module/<portal>/<module_name>/`:
```
<module_name>/
├── pages/          # Main view(s), PascalCase (e.g. EmployeeMasterlist.vue)
├── components/     # Sub-components
├── script/         # useApiRequest.js + use<ModuleName>.js (+ optional *Styles.js)
└── webRoute.js     # Route config (default-exported array)
```
Note: composables/API live under `script/` (not `hooks/` or `services/`).

**HTTP client — IMPORT it, it is NOT global**
```js
import http from '@/app/axios/axiosInstance';

export function useApiRequest() {
  return {
    getData: async (params = {}) => {
      const response = await http.get("api/manager/myteam/attendance", { params });
      return response.data;
    },
  };
}
```
- Path alias `@` → `resources/views/web/src/`. The axios instance is at `@/app/axios/axiosInstance` (interceptors + error handling already wired there).
- Endpoint strings are lowercase `api/<prefix>/<...>` and MUST use the URL prefix from the table above (e.g. `api/timekeeping/...`, not `api/tk/...`).

**Globally-registered components (use WITHOUT importing)** — registered in `resources/views/web/main.js`:
`CSelect`, `Pagination`, `Spinner`, `Loading`, `VDatePicker`, `StatusBadge`, `EmptyState`, `TableSkeleton`.

**Globally-registered directives (no import)**: `v-click-outside`, `v-offcanvas-back`.

**Components that must be IMPORTED** (exist but not globally registered): `Modal` (`@/src/components/Modal.vue`), `LoadingState`, `TableSkeleton` variants under `components/`, etc. If it's not in the global list above, import it.

**Shared utils** (`@/src/utils/`): `debounce`, `throttle`, `dateFormatter` (date helpers), `currency` (`formatCurrency`/`parseCurrency`), `constants`, `theme`, `useFileUpload`, `formatNumberInput`.

**Shared composables** (`@/src/composables/`): `useLocalStorage`, `useResponsive`, `useCalendar`, `useSidebarLinks`, `useInitialProfile`.

**webRoute.js**:
```js
export default [
  {
    path: '<portal>/<module_name>',
    name: '<portal>_<module_name>',
    component: () => import('@/src/module/<portal>/<module_name>/pages/<ModuleName>.vue'),
    meta: { title: '<Module Title>' }
  }
];
```
