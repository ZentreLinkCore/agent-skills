# Project Profile (Verified Facts)

## Purpose
This is the **ground-truth architecture reference** for this specific HRMS codebase. Other rule and skill files tell the agent to "detect the architecture" — this file records what that detection actually resolves to, so the agent follows known facts instead of re-deriving (and re-guessing) them every run.

> [!IMPORTANT]
> These are observed facts, not aspirations. Still run the [System Awareness](./system-awareness.md) scan for the specific models/columns/routes you touch — but do NOT contradict the patterns below (e.g. don't introduce API Resources; this project doesn't use them). If reality has drifted from this file, update this file.

---

## Stack
- **Backend**: Laravel (PHP), Sanctum auth. Entry: `app/`, routes in `routes/api.php` (orchestrator) + per-portal files under `routes/api/`.
- **Frontend**: Vue 3 `<script setup>` + Composition API, Vue Router, Tailwind CSS, Vite. Root: `resources/views/web/src/`.
- **Testing**: PHPUnit (`vendor/bin/phpunit`), Vitest (`npm run test`). `tests/` at project root.

---

## Backend Architecture: Query/Handler/Action Pattern

> [!IMPORTANT]
> **The `app/Domain/` folder is retired.** These classes now live at the **top level of `app/`** — `app/Queries/`, `app/Handlers/`, `app/Services/`, `app/Actions/` — with matching top-level namespaces (`App\Queries`, `App\Handlers`, `App\Services`, `App\Actions`). Do NOT reference `App\Domain\...` or write anything under `app/Domain/` for new work. (A few base/legacy files may still carry a stale `namespace App\Domain\Handlers;` mid-migration — the target is `App\Handlers`; don't copy the stale form.)

This project uses a **thin-controller + Query/Handler pattern**, with **Actions** as an optional extension of Handlers. The mental model:
- **Handler = the conductor** of the orchestra — orchestrates a full write/business operation.
- **Action = an individual musician** — does one specific, focused job.
- **Not every Handler needs an Action.** Reach for an Action only when a Handler's business logic starts getting large, or when a discrete step is reusable across other Handlers/parts of the system. Simple handlers keep their logic inline. See the Actions subsection below.

**Reads → Query classes**
- Location/namespace: `app/Queries/<Domain>/` → `App\Queries\<Domain>`
- `<Domain>` is a **PascalCase domain-only** folder (`Timesheet`, `Leave`, `Overtime`, `Payroll`, `Holiday`, `Nsd`, `Shift`, `Separation`, `FinalPay`, `Biometric`, `Incident`, `TransactionLog`, …). The old portal-lowercase `tk/` and `hr/` Query folders have been folded into domain folders — do NOT create `App\Queries\tk\...` / `App\Queries\hr\...`. Match the folder the sibling classes for your feature already use.
- Extends the empty base `App\Queries\Query`.
- Signature: `public static function execute($params = [])` — called statically.

```php
namespace App\Queries\tk;

use App\Queries\Query;
use App\Models\Leave;

class GetLeavePolicyStatisticsQuery extends Query
{
    public static function execute($params = [])
    {
        return Leave::where('active', 'Y')->get();
    }
}
```

**Writes → Handler classes (the conductor)**
- Location/namespace: `app/Handlers/<Domain>/` → `App\Handlers\<Domain>`
- `<Domain>` is **PascalCase domain-only** — the old portal-lowercase `tk/` and `hr/` handler folders have been folded into domain folders (`Shift`, `Leave`, `Holiday`, `Nsd`, `Timesheet`, `FinalPay`, `Separation`, `Payroll`, …). Do NOT create `App\Handlers\tk\...` / `App\Handlers\hr\...`.
- Extends the empty base `App\Handlers\Handler`.
- Static `execute(...)` — args may be an array (`$request->all()`) or positional (`$employeeId, $date, $data`); match sibling handlers.
- Wrap create/update/delete in `DB::transaction(function () { ... })`.
- Orchestrates the operation: validates preconditions, coordinates the write, and delegates heavy or reusable sub-steps to **Actions** when the logic grows.

**Actions → focused, reusable units (the musicians) — OPTIONAL**
- Location/namespace: `app/Actions/<Domain>/` → `App\Actions\<Domain>` (mirror the Handler's PascalCase domain folder, e.g. `Actions/Payroll`, `Actions/Shift`, `Actions/Timesheet`).
- Extends the empty base `App\Actions\Action` (mirror the sibling base classes; match whatever the existing Action files use).
- Same static-`execute(...)` convention as Handlers/Queries — called statically from within a Handler (or another Action).
- **When to create one:** the Handler's `execute()` is getting big (rule of thumb: a cohesive block > ~40 lines per [Coding Standards](./coding-standards.md)#SRP), OR the same calculation/step is needed by more than one Handler. A single source of truth per [Duplicate Prevention](./duplicate-prevention.md).
- **When NOT to:** small, single-purpose handlers keep their logic inline. Do not pre-emptively split every handler into actions.

```php
namespace App\Handlers\Payroll;

use App\Handlers\Handler;
use App\Actions\Payroll\ComputeStatutoryDeductionsAction;
use Illuminate\Support\Facades\DB;

class ProcessPayrollHandler extends Handler
{
    public static function execute($params = [])
    {
        return DB::transaction(function () use ($params) {
            // ...orchestrate: the conductor delegates the reusable, heavy step to an Action
            $deductions = ComputeStatutoryDeductionsAction::execute($params['employee_id']);
            // ...persist payroll using $deductions
        });
    }
}
```

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

## Database Schema Conventions

> [!IMPORTANT]
> **No DB-level foreign keys — index the relationship column instead.** This codebase has **zero** `->foreign()->references()` constraints. Referential integrity is enforced in the **Query/Handler layer**, not the database.

- **Relationship columns**: use an `id`-prefixed name (`idacct`, `idpayperiod`, `idtranstype`, `idclass`, `idbonusrun`), typed `unsignedBigInteger`/`integer`, with a plain **`->index()`** — never `->foreign()`. Adding a real FK has repeatedly broken migrations (e.g. `payroll_entry.idacct` pointed a FK at a non-existent `account` table; the real table is **`accounts`** plural, and the view `vw_accounts_details.id` = `accounts.id`).
- **Soft delete**: most tables use a **`status` column** (`0=Disable/Inactive, 1=Active`, sometimes with extra states) rather than Laravel `SoftDeletes`. Deleting a lookup row that's referenced by historical records (payroll, etc.) should be a `status=0` disable, not a hard delete. Only use the `SoftDeletes` trait when sibling tables in that domain already do.
- **Always** add `timestamps()`. Index frequently filtered columns.
- Lookup/reference tables (e.g. `transactionclass`, `transactiontype`) are pointed to by `id` from many other tables — **seed them by resolving the parent `id` via a stable key (e.g. `code`), never by hard-coding auto-increment ids.**

---

## Portals & Route Prefixes

`routes/api.php` is a thin **orchestrator**: public routes (login, biometric) + one `Route::middleware(['auth:sanctum'])->group(...)`. Inside that group, each portal's routes live in **its own file** under `routes/api/`, loaded with `Route::prefix('<portal>')->group(base_path('routes/api/<portal>.php'))`. Each portal file holds just its route bodies + its own controller `use` imports and inherits the prefix + `auth:sanctum` from the orchestrator — so URLs are identical to a single flat file.

```text
routes/api.php               # orchestrator: public routes, auth group, per-portal group() loaders,
                             #   plus small inline groups (attendance, ai) that have no portal file
routes/api/employee.php      # /api/employee/...
routes/api/manager.php       # /api/manager/...
routes/api/hr.php            # /api/hr/...
routes/api/timekeeping.php   # /api/timekeeping/...  (controller namespace tk)
routes/api/payroll.php       # /api/payroll/...
routes/api/admin.php         # /api/admin/...        (contains the `database` sub-prefix)
```

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

- Add new routes **inside the matching portal file** (`routes/api/<portal>.php`), and add the controller's `use` import at the top of that same file. Never create a new top-level group or a new portal loader for an existing portal.
- Route definitions are explicit per-method (`Route::get('/x', [XController::class, 'method'])`); `apiResource` is used for standard CRUD (`index`/`store`/`update`/`destroy`), with non-RESTful domain actions (e.g. `/{id}/approve`) added as explicit routes beside it. Match the sibling routes' style.

---

## Frontend Architecture

**Module structure (current standard — TypeScript)** — `resources/views/web/src/module/<portal>/<feature>/`:
```
<feature>/
├── index.ts                        # Public API barrel — re-exports composables, api hook, routes
├── route/<feature>.routes.ts       # RouteRecordRaw[] (default export)
├── api/<feature>.api.ts            # use<Feature>Api() — service layer
├── composables/use<Feature>.ts     # reactive state + actions (composition functions)
├── pages/<Feature>.vue             # main view(s), PascalCase
├── components/                     # sub-components (.vue)
├── utils/<feature>.utils.ts        # feature-specific helpers (when needed)
├── types/types.<feature>.ts        # TS interfaces / DTOs / enums (add when the feature has real shapes)
└── store/<feature>.store.ts        # Pinia store (add ONLY when state is shared across pages/components)
```
- Files are **TypeScript** (`.ts`) + `.vue`. State lives in **composables** by default; reach for a Pinia `store/` only when the state must be shared beyond a single page tree. `types/` and `store/` are added on demand, not by default.
- **Migration note:** older modules still use the legacy layout (`script/useApiRequest.js` + `use<Module>.js`, `webRoute.js`, plain JS). When extending one of those, match the sibling files in that folder; when creating a **new** feature, use the TS structure above. Some modules are mid-migration and contain both — prefer the `.ts` files.

**Routing is auto-aggregated — no manual registration.** Each portal's `<portal>/useApiWebRoute.ts` globs every module's route file:
```ts
const modules = import.meta.glob<{ default: RouteRecordRaw[] }>('./*/route/*.routes.ts', { eager: true });
```
So dropping a `route/<feature>.routes.ts` (default-exporting `RouteRecordRaw[]`) auto-registers it. Do **not** edit the aggregator.
```ts
// route/<feature>.routes.ts
import type { RouteRecordRaw } from 'vue-router';
const routes: RouteRecordRaw[] = [
  { path: '<portal>/<feature-kebab>', name: '<portal>_<feature>',
    component: () => import('../pages/<Feature>.vue'), meta: { title: '<Feature Title>' } },
];
export default routes;
```

**HTTP client — IMPORT it, it is NOT global.** The API service layer lives in `api/<feature>.api.ts`:
```ts
import http from '@/app/axios/axiosInstance';

export function use<Feature>Api() {
  return {
    getData: async (params: Record<string, any> = {}): Promise<any> => {
      const response = await http.get('api/<prefix>/<endpoint>', { params });
      return response.data;
    },
  };
}
```
- Path alias `@` → `resources/views/web/src/`. The axios instance is at `@/app/axios/axiosInstance` — interceptors, auth-token attach, HTML guard, and 401/419 handling are already wired there (see the modular chain `axiosInstance` / `axiosInterceptors` / `axiosApiErrors`). Callers get the full `AxiosResponse`, so return `response.data`.
- Composables import the api hook (`import { use<Feature>Api } from '../api/<feature>.api'`) — never call `http` directly from a composable or component.
- Endpoint strings are lowercase `api/<prefix>/<...>` and MUST use the URL prefix from the table above (e.g. `api/timekeeping/...`, not `api/tk/...`).

**Public API barrel (`index.ts`)** — re-export the feature's surface so consumers import from the module root:
```ts
export { use<Feature> } from './composables/use<Feature>';
export { use<Feature>Api } from './api/<feature>.api';
export { default as <feature>Routes } from './route/<feature>.routes';
```

**Globally-registered components (use WITHOUT importing)** — registered in `resources/views/web/main.js`:
`CSelect`, `Pagination`, `Spinner`, `Loading`, `VDatePicker`, `StatusBadge`, `EmptyState`, `TableSkeleton`.

**Globally-registered directives (no import)**: `v-click-outside`, `v-offcanvas-back`.

**Components that must be IMPORTED** (exist but not globally registered): `Modal` (`@/src/components/Modal.vue`), `LoadingState`, `TableSkeleton` variants under `components/`, etc. If it's not in the global list above, import it.

**Shared utils** (`@/src/utils/`): `debounce`, `throttle`, `dateFormatter` (date helpers), `currency` (`formatCurrency`/`parseCurrency`), `constants`, `theme`, `useFileUpload`, `formatNumberInput`.

**Shared composables** (`@/src/composables/`): `useLocalStorage`, `useResponsive`, `useCalendar`, `useSidebarLinks`, `useInitialProfile`.
