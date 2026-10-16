# Backend: Laravel architecture, controllers, routes

Verified architecture for the Laravel backends. Follow it; do not re-derive it or introduce another pattern (no Repositories, no API Resources, no new layer) unless the codebase already uses it. Still run the [System Awareness scan](./system-awareness.md) for the specific models, columns, and routes you touch, and stop on an existing match. Database rules: [database.md](./database.md). Query performance (eager loading, chunking, pagination): [performance.md](./performance.md).

## 1. Query / Handler / Action (all projects)

Thin controllers dispatch to static classes at the **top level of `app/`**; `app/Domain/` is retired (a few legacy base files may still say `namespace App\Domain\Handlers;`: the target is `App\Handlers`, so do not copy the stale form). Direct Eloquent inside these classes.

- **Handler = the conductor**: orchestrates a whole write or business operation.
- **Action = one musician**: a focused, reusable step. **Optional**: only when a Handler's logic grows large or a step is reused elsewhere.

| Kind | Folder → namespace | Base class | Rules |
| :--- | :--- | :--- | :--- |
| **Query** (reads) | `app/Queries/<Domain>/` → `App\Queries\<Domain>` | `App\Queries\Query` | `public static function execute($params = [])` |
| **Handler** (writes) | `app/Handlers/<Domain>/` → `App\Handlers\<Domain>` | `App\Handlers\Handler` | static `execute(...)`: array (`$request->all()`) or positional args, matching siblings; create / update / delete inside `DB::transaction(...)`; validates preconditions, coordinates the write, delegates big or reusable sub-steps to Actions |
| **Action** (sub-step) | `app/Actions/<Domain>/` → `App\Actions\<Domain>` (mirror the Handler's domain folder) | `App\Actions\Action` (match existing Actions) | static `execute(...)`, called from a Handler or another Action |

- `<Domain>` is a **PascalCase, domain-only** folder. (Vue): `Timesheet`, `Leave`, `Overtime`, `Payroll`, `Holiday`, `Nsd`, `Shift`, `Separation`, `FinalPay`, `Biometric`, `Incident`, `TransactionLog`, `PayPeriod`, …; the old portal-lowercase `tk/` and `hr/` folders were folded in: never create `App\Queries\tk\…` or `App\Handlers\hr\…`. (React): `Auth`, `Onboarding`, `Organization`, `Dashboard`, `Inquiry`. Use the folder your feature's siblings already use.
- **Create an Action** when a cohesive block in `execute()` passes ~40 lines ([code-quality.md](./code-quality.md)) or the same step is needed by more than one Handler (one source of truth). **Do not** pre-split small handlers.
- `app/Services/` holds integration services (e.g. `AIService`, `SupabaseStorageService` in (Vue)); business reads and writes stay in Queries and Handlers.

```php
namespace App\Queries\Leave;

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
            // the conductor delegates the heavy, reusable step to an Action
            $deductions = ComputeStatutoryDeductionsAction::execute($params['employee_id']);
            // ...persist payroll using $deductions
        });
    }
}
```

## 2. Controllers and responses (all projects)

- Extend `App\Http\Controllers\Controller`. Each method calls a Query or Handler statically inside `try/catch (Exception $e)` and returns JSON.
- **No API Resources / `JsonResource`: zero exist; do not create them.** Success: `response()->json($data)` or `response()->json(['data' => $data])`, matching the sibling method. Error: `response()->json(['message' => $e->getMessage()], 400)`. Reuse existing error formatters.

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

## 3. `<source-path>` (Vue): controllers, validation, routes

- **Controllers**: `app/Http/Controllers/<portal>/` → `App\Http\Controllers\<portal>` (lowercase portal).
- **Validation is mostly inline**: `Request $request` → `$request->all()` into the Query or Handler. The few FormRequests (`Store*Request`) live **flat** in `app/Http/Requests/`, never in portal subfolders. Add one only where the surrounding controller already uses one.
- **Routes**: `routes/api.php` is a thin orchestrator: public routes (login, biometric) plus one `Route::middleware(['auth:sanctum'])->group(...)` that loads each portal file with `Route::prefix('<portal>')->group(base_path('routes/api/<portal>.php'))`. A portal file holds only its route bodies and its controllers' `use` imports, and inherits the prefix and `auth:sanctum`. Small inline groups with no portal file (attendance, ai) stay in the orchestrator.

| Portal | Controller namespace | URL prefix | Route file | Frontend module folder |
| --- | --- | --- | --- | --- |
| Employee | `employee` | `employee` | `routes/api/employee.php` | `employee` |
| Manager | `manager` | `manager` | `routes/api/manager.php` | `manager` |
| HR | `hr` | `hr` | `routes/api/hr.php` | `hr` |
| Timekeeping | **`tk`** | **`timekeeping`** | `routes/api/timekeeping.php` | **`timekeeping`** |
| Payroll | `payroll` | `payroll` | `routes/api/payroll.php` | `payroll` |
| Admin | `admin` | `admin/database` | `routes/api/admin.php` (holds the `database` sub-prefix) | `admin` |
| Global | `global` | none (top level) | orchestrator | — |

> [!CAUTION]
> **Timekeeping gotcha**: the controller namespace is `tk` (`App\Http\Controllers\tk\...`), but the URL prefix and frontend folder are **`timekeeping`** (`api/timekeeping/...`). Never register `api/tk/...` routes.

- Add routes **inside the matching portal file**, with the controller's `use` import at its top. Never a new top-level group or a second loader for an existing portal; append to the matching group rather than recreating a block.
- Route style: explicit per-method (`Route::get('/x', [XController::class, 'method'])`); `apiResource` for standard CRUD, with non-RESTful actions (`/{id}/approve`) as explicit routes beside it. Match the siblings.

## 4. `<source-path>` (React): controllers, validation, routes

- **Auth**: Sanctum **stateful SPA session** (cookie-based, not bearer tokens).
- **Controllers**: `app/Http/Controllers/<Domain>/` with a **PascalCase** namespace (`App\Http\Controllers\Organization\...`).
- **FormRequests are the norm**: `app/Http/Requests/` holds `LoginRequest`, `RegisterRequest`, `ResetPasswordRequest`, `StoreInquiryRequest`. Add one for every endpoint that takes user input.
- **Routes by domain, no portals**: `routes/api.php` orchestrates; `routes/api/auth.php` (`/api/auth/...`, public plus an `auth:sanctum` sub-group), `dashboard.php`, `onboarding.php`, `organizations.php` (`auth:sanctum`). A new domain gets its own `routes/api/<domain>.php` and a `Route::prefix(...)->group(...)` line in the orchestrator, **inside** the `auth:sanctum` group unless the blueprint makes the capability public.
- Rate-limit auth-adjacent routes (`->middleware('throttle:6,1')`), as `routes/api/auth.php` does.
- The product blueprint governs behavior: [`.agents/blueprint/scaleup/docs/`](../../blueprint/scaleup/docs/README.md). Read the one specification the feature needs.

## 5. Running things

Never run migrations or seeders yourself: scaffold them and list the command for the user. Check routes with `php artisan route:list --path=api` after a route change.

## 6. `<source-path>` (React): known drift

The implementation predates the blueprint being followed. These are **defects awaiting rework, not conventions**:

| Drift | What exists | What the docs require |
| :--- | :--- | :--- |
| FK column naming | `id_organization`, `id_user`, `id_created_by` | `organization_id`, `user_id`, `created_by_id` |
| Membership table | `organization_users` | `organization_members` |
| Roles | plain `role` string (`'owner'` / `'employee'`) | `organization_roles` + `permissions` + `role_permissions`; 5 roles per [PERMISSION_MATRIX.md](../../blueprint/scaleup/docs/PERMISSION_MATRIX.md) |
| Onboarding | forces every user through Create / Join Business | Organizations are **opt-in** ([Design Principle 2](../../blueprint/scaleup/docs/DESIGN_PRINCIPLES.md)) |
| Default landing | `/dashboard` and `/app` both = Organization Workspace | Community Platform is the default; the workspace is a subscription-gated branch |
| Subscription | absent | The workspace is unlocked by an Organization subscription ([ADR-002](../../blueprint/scaleup/docs/decisions/ADR-002-subscription-model.md)) |
| Community layer | absent | Roadmap **Phase 1**: profiles, feed, posts, connections, messaging, notifications |
| Dashboard data | static seed values in `GetDashboardSummaryQuery` | Derived from real business / planning tables |

When a file you touch carries one of these, follow the **right-hand column** and flag the mismatch instead of matching the surrounding (wrong) code. This is the one place where "match the sibling files" does not apply. Reviews read this table before calling anything inconsistent.
