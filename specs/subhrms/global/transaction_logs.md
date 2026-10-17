# Spec — Transaction Logs (`translog` audit trail)

> **Kind:** **Extension / Consolidation** — the `translog` audit trail already exists end-to-end, but in **two parallel backends and three parallel frontends** with divergent contracts, one broken writer, and dead statistics. This spec defines the single canonical implementation and the deltas required to reach it.
> **Portal:** **Global** (`App\Http\Controllers\global`, top-level `/api/transLogs` — no portal prefix), consumed by the **HR**, **Timekeeping**, and **Payroll** frontend modules.
> **Route:** `GET /api/transLogs` (global, existing) · pages `hr/transaction-logs` (`hr_transaction_logs`), `timekeeping/transaction-logs` (`transaction_logs`), plus a payroll page under `payroll/reports`.
> **Conventions:** [project-gate.md](../../../rules/core/project-gate.md), [payroll.md](../../../rules/conditional/payroll.md), [system-awareness.md](../../../rules/conditional/system-awareness.md).
> **System Awareness:** Model **[TransLog](../../../../app/Models/TransLog.php) (reused)**; Table **`translog` (reused — no new table)**; Routes **`GET /api/transLogs` (reused)**, `GET /api/timekeeping/transaction-logs` (existing — see Decision 1); **New migration: YES — one `alters/` migration only, to add missing indexes.** No new table, no new model.

---

## 1. Purpose

`translog` is the system-wide **audit trail**: every create / update / delete performed through the HRMS writes a row recording *who* did *what*, in *which module*, *when*, from *which IP*, with the *before* and *after* values as JSON. It backs the "Transaction Logs" audit pages in HR, Timekeeping, and Payroll, and satisfies the audit-trail requirement in [payroll.md](../../../rules/conditional/payroll.md) ("Log any edits to payroll records or attendance adjustments").

**The problem this spec solves:** the feature grew organically and has drifted into an inconsistent state. Verified by scan:

| # | Finding | Evidence |
|---|---|---|
| F1 | **Two writer APIs with different signatures.** `TransLog::logAction($description, $old, $new, $module, $request, $actionType)` (24 call sites) and `HandleGlobal::insertTransLog($module, $action, $old, $new, $createdBy, $ipAddress)` (36 call sites). | [TransLog.php:31](../../../../app/Models/TransLog.php#L31), [HandleGlobal.php:420](../../../../app/Handlers/HandleGlobal.php#L420) |
| F2 | **`insertTransLog` is broken against the current schema.** It inserts `date` and `time` columns that **do not exist** in the `translog` migration, and **omits `action_type`**, which is `tinyInteger` NOT NULL with no default. All 36 payroll call sites fail on a freshly-migrated database. | [create_translog_table.php](../../../../database/migrations/table/translog/2024_10_31_120134_create_translog_table.php) has no `date`/`time`; `action_type` at L19 |
| F3 | **Two read backends with different response shapes.** Global [TransactionLogsController](../../../../app/Http/Controllers/global/TransactionLogsController.php) puts the whole query inline in the controller (violating thin-controller) and returns `{translog, stats:{total_today,total_inserts,total_updates,total_deletes}, modules}`. The tk one delegates to [GetTransactionLogsQuery](../../../../app/Queries/TransactionLog/GetTransactionLogsQuery.php) and returns `{translog, stats:{totalAudits,timesheetClosing,adjustments,biometricSyncs}}`. | both files |
| F4 | **Timekeeping stats are permanently zero.** `GetTransactionLogsQuery` counts modules `'Timesheet Closing'`, `'Timesheet Adjustment'`, `'Biometric Sync'` — **no code anywhere writes those module values.** The only values ever written are `'Payroll Access'` (36×), `'HR Access'` (11×), `'Employee Access'` (3×), `'Payroll Processing'` (1×). Timekeeping writes **no** logs at all. | [GetTransactionLogsQuery.php:84-86](../../../../app/Queries/TransactionLog/GetTransactionLogsQuery.php#L84-L86) vs. grep of all call sites |
| F5 | **No portal separation.** `/api/transLogs` is inside the `auth:sanctum` group with **no portal scoping**. The HR page requests it with no `module` filter, so HR sees `Payroll Access` rows. The payroll module scopes itself by sending `module: 'Payroll Access'` **from the client** — trivially removable by the caller. Contradicts [payroll.md](../../../rules/conditional/payroll.md) §4 Portal Separation. | [transaction_logs.api.ts](../../../../resources/views/web/src/module/payroll/reports/api/transaction_logs.api.ts), [useTransactionLogs.ts](../../../../resources/views/web/src/module/hr/transaction_logs/composables/useTransactionLogs.ts) |
| F6 | **Missing indexes.** Only `createdby` is indexed. Every read filters/sorts on `created_at`, `module`, and `action_type`, and every request runs `COUNT(*)` over the whole table 4× for stats. This is an append-only table that grows forever. | migration L21 is the only `index()` |
| F7 | **Three duplicated frontend modules** with three different `useTransactionLogsApi()` hooks (`getTransactionLogs` / `getTransLogs` / `getLogs`) and three placeholder `types.transaction_logs.ts` files that are all `[key: string]: any` — i.e. no real typing anywhere. | `hr/transaction_logs/`, `timekeeping/transaction_logs/`, `payroll/reports/` |

---

## 2. Design Decisions (Pros & Cons)

### Decision 1: One read backend, or keep both?

**Option A — Consolidate on the global endpoint + Query class (Recommended)**
- Keep `GET /api/transLogs`. Move the inline controller query body into `GetTransactionLogsQuery` (which already exists), merge the two filter sets (`search`/`action`, `module`, `action_type`, `datefrom`/`dateto`, `sort`, `entries`) and the two stat sets into **one superset contract**. Point the tk controller at the same query, or retire `GET /api/timekeeping/transaction-logs` and repoint the tk frontend at `/api/transLogs`.

| Pros | Cons |
|---|---|
| Single source of truth for audit reads — [system-awareness.md](../../../rules/conditional/system-awareness.md) §3 | Touching the tk endpoint is a breaking change for its frontend (1 file, 1 line) |
| Fixes the thin-controller violation (F3) — the global controller becomes a 6-line dispatcher matching every sibling | Superset params mean slightly more branching in one query class |
| One place to add portal scoping (Decision 4), indexes, and stat fixes | Retiring a route needs the frontend updated in the same pass |
| `translog` is genuinely global data — a per-portal read endpoint has no domain justification | |

**Option B — Keep both endpoints, fix each in place**
- Leave `/api/timekeeping/transaction-logs` and `/api/transLogs` as separate endpoints; fix F2/F4/F6 in both.

| Pros | Cons |
|---|---|
| Zero frontend churn | Two contracts to keep in sync forever; the drift in F3/F4 is exactly what this produces |
| Each portal can evolve its stats independently | Duplicate logic — direct violation of duplicate-prevention |
| | Portal scoping must be implemented twice |

**Recommendation: Option A.** `translog` is one table with one access pattern; two read paths is the root cause of F3 and F4. The consolidation is cheap (one query class, one controller trimmed, one frontend endpoint string).

---

### Decision 2: One writer API, or keep two?

**Option A — Standardize on `TransLog::logAction()`, retire `HandleGlobal::insertTransLog()` (Recommended)**
- Rewrite the 36 `insertTransLog` call sites to `TransLog::logAction()`, which uses the model (so `$casts` JSON-encodes `oldvalue`/`newvalue`), sets `action_type`, and reads `Auth::id()` + `request()->ip()` itself. Delete `insertTransLog`.

| Pros | Cons |
|---|---|
| **Fixes F2** — the only correct writer. `insertTransLog` cannot succeed against the migrated schema | 36 call sites to edit across 12 payroll/HR controllers (mechanical, but a wide diff) |
| Restores `action_type` on payroll rows, which the Insert/Update/Delete filter and badges depend on | Payroll's current calls pass pre-formatted pipe-delimited strings (`'Name: x\| Code: y'`) — these should become arrays to feed the diff viewer, so it's not a pure signature swap |
| One signature to learn; `oldvalue`/`newvalue` consistently JSON via `$casts` | |
| Kills a `DB::table()` raw insert in favour of the model | |

**Option B — Fix `insertTransLog` in place (drop `date`/`time`, add an `$actionType` param)**
- Keep both writers; just make `insertTransLog` schema-correct.

| Pros | Cons |
|---|---|
| Much smaller diff — one function body + the 36 calls gain one argument | Leaves two writers with mirrored-but-different argument orders — a permanent footgun |
| No behaviour change at payroll call sites | Still bypasses `$casts`, so payroll rows keep storing flat strings instead of JSON, and the diff viewer stays broken for payroll |

**Option C — Add an `Action` class (`App\Actions\TransactionLog\WriteTransactionLogAction`)**
- Both current writers delegate to one Action.

| Pros | Cons |
|---|---|
| Matches the Action pattern in [project-gate.md](../../../rules/core/project-gate.md) | Over-engineering for a single `create()` — the profile explicitly says *"Do NOT add Action classes for trivial work"* |
| Central place for future hooks (async queue, redaction) | Adds a third indirection while the goal is to remove indirection |

**Recommendation: Option A.** F2 means payroll audit logging is *currently non-functional on a clean DB* — this is the highest-value fix in the spec, and Option B leaves the JSON diff broken for the 36 highest-volume call sites. If the 36-site diff is too wide for one pass, Option B is an acceptable **interim** step, but Option A should stay the target.

---

### Decision 3: How is `module` typed — free-text, constants, or lookup table?

**Option A — PHP constants on the model (Recommended)**
- Add `const MODULE_HR_ACCESS = 'HR Access';` etc. to `TransLog`, plus a `MODULES` array. Writers reference constants; the `modules` dropdown is served from the constant list (union'd with `DISTINCT module` for legacy rows).

| Pros | Cons |
|---|---|
| **Fixes F4** — impossible to filter on a label nothing writes; the mismatch becomes a compile-visible constant reference | Adding a module still needs a code change (correct for an audit taxonomy) |
| No migration, no join, no new table — matches `UPPER_SNAKE_CASE` constants in [code-quality.md](../../../rules/conditional/code-quality.md) | Legacy rows with off-taxonomy values still need the `DISTINCT` union |
| Dropdown stops depending on `SELECT DISTINCT module` over a growing table (a full scan today) | |

**Option B — Keep free-text `module` strings**
- Status quo; just correct the three dead labels in the stats query to real values.

| Pros | Cons |
|---|---|
| Zero structural change | F4 recurs the moment someone adds a module — nothing enforces the vocabulary |
| Writers stay maximally flexible | Typos silently create phantom modules that pollute the dropdown |

**Option C — New `translog_module` lookup table + `idmodule` FK column**
- Normalize the taxonomy into a reference table.

| Pros | Cons |
|---|---|
| Referential consistency; renaming a module is one UPDATE | **Needs a new table + a data migration for existing rows** — the scan found nothing requiring this |
| Cheap module dropdown from a tiny table | Adds a join to the hottest read path for a 4-value enum |
| | Audit rows should be **immutable snapshots**; a joined label can be renamed *after the fact*, silently rewriting history |

**Recommendation: Option A.** Four values, immutable-by-design, no join. Option C actively harms audit integrity by making historical labels mutable.

---

### Decision 4: Where does portal separation happen? *(business/security call — flagging, not deciding for you)*

**Option A — Server-side scoping by portal, derived from the authenticated user's access type (Recommended)**
- The query maps the caller's portal/access level → the set of `module` values they may read, and **intersects** it with any requested `module` filter. Client-supplied `module` narrows but can never widen.

| Pros | Cons |
|---|---|
| **Fixes F5** — satisfies [payroll.md](../../../rules/conditional/payroll.md) §4; payroll audit detail stops being reachable from the employee/HR portals | Needs an explicit portal→modules policy decision from you (below) |
| Client filter becomes a UX convenience, not a security boundary | An HR-wide auditor role may need an explicit "see all" bypass |
| One enforcement point (Decision 1 gives us exactly one) | |

**Option B — Keep client-side scoping**
- Each frontend keeps sending its own `module` value.

| Pros | Cons |
|---|---|
| No backend change | **Not a security control** — the param is user-controlled; anyone can drop it and read payroll audit rows |
| | Leaves a documented portal-separation violation in the codebase |

**Recommendation: Option A** — but the *policy* is yours to set. A reasonable default:

| Portal / page | May read modules |
|---|---|
| HR (`hr/transaction-logs`) | `HR Access`, `Employee Access` |
| Payroll (`payroll/reports` → logs) | `Payroll Access`, `Payroll Processing` |
| Timekeeping (`timekeeping/transaction-logs`) | timekeeping modules (**none exist yet** — see Decision 5) |
| Admin | all |

Confirm or amend this table before implementation — especially whether HR should be able to read payroll audit rows.

---

### Decision 5: What does the Timekeeping page show, given timekeeping writes no logs?

**Option A — Add timekeeping write call sites, then keep the page (Recommended)**
- Instrument the timekeeping write paths (timesheet closing, timesheet adjustment, biometric sync) with `TransLog::logAction(..., 'Timekeeping Access', ...)` and align the stats query to the labels actually written.

| Pros | Cons |
|---|---|
| Makes the page meaningful and the F4 stats real | Requires touching timekeeping handlers — a separate, larger workstream |
| Timesheet adjustments are exactly what [payroll.md](../../../rules/conditional/payroll.md) demands an audit trail for | Scope grows beyond the log feature itself |

**Option B — Retire the timekeeping page; keep HR + Payroll only**
- Delete `timekeeping/transaction_logs/` and its route + endpoint.

| Pros | Cons |
|---|---|
| Removes a page that structurally cannot show data and three always-zero stat tiles | Loses the UI when timekeeping logging does land |
| Smallest surface | The audit requirement for timesheet adjustments goes unmet |

**Option C — Keep the page, replace the three dead tiles with real ones**
- Swap `timesheetClosing`/`adjustments`/`biometricSyncs` for `total_inserts`/`total_updates`/`total_deletes` (which have real data), leaving the page honest until timekeeping logging exists.

| Pros | Cons |
|---|---|
| One-line-ish fix; page stops lying | Page still shows only HR/Payroll/Employee rows under a timekeeping heading |
| No new workstream | Doesn't satisfy the timesheet-adjustment audit requirement |

**Recommendation: Option C now, Option A next.** Option C is in scope for this spec (it's the F4 fix); the timekeeping instrumentation in Option A deserves its own spec — see §8.

---

### Decision 6: Shared frontend module or three?

**Option A — One shared `transaction_logs` module, portal pages as thin wrappers (Recommended)**
- Promote the richest implementation (HR — it has the detail panel, grid/table toggle, highlight, export) to a shared location, and have each portal's route render it with a portal prop/route-meta. Shared `types.transaction_logs.ts` with **real** interfaces replaces the three `[key: string]: any` placeholders.

| Pros | Cons |
|---|---|
| Fixes F7; one contract, one type file, one diff-viewer implementation | Needs a home for shared feature modules; nothing comparable exists yet under `src/module/` |
| A UI improvement lands in all three portals at once | Portal-specific stat tiles must become props/config |
| Real TS interfaces instead of `any` — [code-quality.md](../../../rules/conditional/code-quality.md) §4 | Larger refactor than fixing three files |

**Option B — Keep three modules, unify only the types + api hook**
- Move `types.transaction_logs.ts` and `useTransactionLogsApi()` into a shared location; leave the three pages/components as they are.

| Pros | Cons |
|---|---|
| Kills the worst duplication (contract + typing) with a small diff | Three page/component trees still drift visually |
| Each portal keeps its existing look with no visual regression risk | Diff-viewer logic stays duplicated |

**Recommendation: Option B for this pass, Option A as the follow-up.** The contract duplication (types + api hook + endpoint string) is what actually causes bugs; the three page layouts are cosmetic drift and can be unified later without another backend change.

---

## 3. Database

**Table `translog` — REUSED, no schema change to columns.** Ground truth: [create_translog_table.php](../../../../database/migrations/table/translog/2024_10_31_120134_create_translog_table.php).

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `module` | `string(150)` | Vocabulary per Decision 3. Real values today: `HR Access`, `Payroll Access`, `Employee Access`, `Payroll Processing` |
| `action` | `text` | Human-readable description of what happened |
| `action_type` | `tinyInteger` NOT NULL | `0=insert, 1=update, 2=delete` (comment in migration). **No default** — F2 |
| `oldvalue` | `json` nullable | `$casts` → array |
| `newvalue` | `json` nullable | `$casts` → array |
| `createdby` | `integer` | → `accounts.id`. Indexed as `idx_translog_createdby`. No DB-level FK (per [project-gate.md](../../../rules/core/project-gate.md)) — correct, keep it that way |
| `ip_address` | `string` | |
| `mac_address` | `string` nullable | Always `null` at every call site today |
| `created_at` / `updated_at` | timestamps | `created_at` is the audit timestamp; reads derive `date`/`time` via `DATE_FORMAT` |

**Columns that do NOT exist** (do not reintroduce): `date`, `time` — `HandleGlobal::insertTransLog` references them (F2). `created_at` is the single timestamp.

### New migration (the only one) — `database/migrations/alters/`

Add the indexes the read path needs (F6). Plain `->index()`, **no `->foreign()`**, per [project-gate.md](../../../rules/core/project-gate.md):

```php
Schema::table('translog', function (Blueprint $table) {
    $table->index('created_at', 'idx_translog_created_at');       // every query orders by this
    $table->index('module', 'idx_translog_module');               // module filter + DISTINCT dropdown
    $table->index('action_type', 'idx_translog_action_type');     // action-type filter + 3 stat counts
    $table->index(['module', 'created_at'], 'idx_translog_module_created');  // scoped list, the common case
});
```

Scaffold only — **do not run migrations**; hand off to the user.

---

## 4. Backend

**Model** — [App\Models\TransLog](../../../../app/Models/TransLog.php) (reused). Changes:
- Add module constants + `MODULES` array (Decision 3A).
- Keep `logAction()` as the single writer (Decision 2A). Consider defaulting `action_type` to `0` in the migration too, as belt-and-braces against F2 recurring.

**Query** — [App\Queries\TransactionLog\GetTransactionLogsQuery](../../../../app/Queries/TransactionLog/GetTransactionLogsQuery.php) (reused, becomes the *only* read path).

Absorbs the inline body of the global controller into the superset contract below, applies server-side portal scoping (Decision 4A), and fixes the dead stat labels (Decision 5C).

| Param | Type | Behaviour |
|---|---|---|
| `search` (alias `action`) | string | `LIKE` across `action`, `module`, `CONCAT(accounts.fname,' ',accounts.lname)`, and the Insert/Update/Delete label |
| `module` | string | exact match; `'All'` / empty = no filter. **Intersected with the caller's permitted set** |
| `action_type` | `0\|1\|2` | exact match; empty string = no filter |
| `datefrom` / `dateto` | `Y-m-d` | `whereDate(created_at, >=/<=)` |
| `sort` | `asc\|desc` | on `created_at`; default `desc` |
| `entries` | int | page size, default `10` |
| `page` | int | Laravel paginator |

Select list stays as-is: `id`, `action`, `action_type`, an `action_type_str` CASE label, `module`, `oldvalue`, `newvalue`, `ip_address`, `mac_address`, `created_at`, plus `CONCAT(accounts.fname, ' ', accounts.lname) as createdby` via `leftJoin('accounts', 'translog.createdby', '=', 'accounts.id')` — `accounts.fname`/`lname` verified in [create_accounts_table.php](../../../../database/migrations/0001_01_01_000000_create_accounts_table.php#L17-L18). Also expose the `date`/`time` `DATE_FORMAT` aliases the tk frontend reads.

`oldvalue`/`newvalue` are returned as **arrays** (from `$casts`) so the frontend builds the field-level diff. Do **not** flatten them to strings server-side — the global controller's current `implode` and the query's current `formatValue` both destroy the per-field diff the HR detail panel needs.

**Response** (raw `response()->json(...)`, no API Resource):
```php
[
  'translog' => <Laravel paginator>,          // data, current_page, last_page, from, to, total
  'stats'    => [
      'total_today'   => int,   // created_at = today
      'total_inserts' => int,   // action_type = 0
      'total_updates' => int,   // action_type = 1
      'total_deletes' => int,   // action_type = 2
      'total_audits'  => int,   // overall count (the tk page's "totalAudits")
  ],
  'modules'  => string[],                     // TransLog::MODULES ∪ DISTINCT module, scoped to the caller
]
```
All stat counts must respect the caller's portal scope, otherwise the tiles leak cross-portal volumes.

**Controllers** — both become thin dispatchers (they are the only two touchpoints):
- [global\TransactionLogsController::index](../../../../app/Http/Controllers/global/TransactionLogsController.php) — **strip the inline query**, delegate to `GetTransactionLogsQuery::execute($request->all())` inside `try/catch`, matching the tk controller's existing 6-line shape.
- [tk\TransactionLogsController::index](../../../../app/Http/Controllers/tk/TransactionLogsController.php) — already correct; keep, or retire with its route per Decision 1.

**Routes** — no new registration required.
- `GET /api/transLogs` → [routes/api.php:55](../../../../routes/api.php#L55) (inside the `auth:sanctum` group). **Keep.**
- `GET /api/timekeeping/transaction-logs` → [routes/api/timekeeping.php:123](../../../../routes/api/timekeeping.php#L123). Keep or retire per Decision 1; if retired, update the tk api file in the same commit.

**Writers** — retire `HandleGlobal::insertTransLog` ([HandleGlobal.php:420](../../../../app/Handlers/HandleGlobal.php#L420)); convert its 36 call sites to `TransLog::logAction()`, passing `oldvalue`/`newvalue` as **arrays** (`['Name' => ..., 'Code' => ...]`) rather than pipe-delimited strings, and an explicit `$actionType`. Affected controllers (all payroll except where noted): `TransactionClassController`, `TransactionTypesController`, `LoanTypeController`, `PayPeriodController`, `PayGroupController`, `BankSetupController`, `SAPCodeController`, `OvertimeRateController`, `ChartofAccountController`, plus `hr/CompanyProfileController`, `hr/PreferencesController`.

---

## 5. Frontend

Per Decision 6B this pass unifies the **contract**, not the three page trees.

**Shared contract** (new, in `@/src/` shared space — reused by all three portals):

```ts
// types.transaction_logs.ts — replaces three `[key: string]: any` placeholders
export const enum TransLogActionType { Insert = 0, Update = 1, Delete = 2 }

export interface TransactionLog {
  id: number;
  module: string;
  action: string;
  action_type: TransLogActionType;
  action_type_str: 'Insert' | 'Update' | 'Delete';
  oldvalue: Record<string, any>;
  newvalue: Record<string, any>;
  createdby: string;          // joined "fname lname", NOT the numeric account id
  ip_address: string;
  mac_address: string | null;
  created_at: string;
  date: string;               // Y-m-d  (DATE_FORMAT alias)
  time: string;               // H:i:s  (DATE_FORMAT alias)
}

export interface TransactionLogFilters {
  search: string; module: string; action_type: '' | TransLogActionType;
  datefrom: string; dateto: string; sort: 'asc' | 'desc'; entries: string; page: number;
}

export interface TransactionLogStats {
  total_today: number; total_inserts: number; total_updates: number;
  total_deletes: number; total_audits: number;
}

export interface TransactionLogResponse {
  translog: { data: TransactionLog[]; current_page: number; last_page: number;
              from: number; to: number; total: number };
  stats: TransactionLogStats;
  modules: string[];
}
```

**Shared api hook** — one `useTransactionLogsApi()` with a single method name, replacing the three divergent hooks (`getTransactionLogs` / `getTransLogs` / `getLogs`) and the two endpoint strings:

```ts
import http from '@/app/axios/axiosInstance';
export function useTransactionLogsApi() {
  return {
    getTransactionLogs: async (params: Partial<TransactionLogFilters> = {}): Promise<TransactionLogResponse> => {
      const response = await http.get('api/transLogs', { params });
      return response.data;
    },
  };
}
```
Drop the payroll hook's hard-coded `module: 'Payroll Access'` — that scoping moves server-side (Decision 4A).

**Per-portal pages** — keep the existing three; align state to the shared filter names.

| Module | Keeps | Changes |
|---|---|---|
| [hr/transaction_logs/](../../../../resources/views/web/src/module/hr/transaction_logs/) — richest, the reference implementation | `TransactionLogHeader`, `TransactionLogToolbar`, `TransactionLogTableView`, `TransactionLogGridView`, `TransactionLogDetailPanel`, `utils/` badge+avatar helpers, localStorage view toggle, `highlightMatch`, xlsx export | import shared types/api; drop the local placeholder types; **add debounce to the search input** (currently every keystroke fires a request — [performance.md](../../../rules/conditional/performance.md) requires ~300ms; the tk module already does this correctly via `@/src/utils/debounce`) |
| [timekeeping/transaction_logs/](../../../../resources/views/web/src/module/timekeeping/transaction_logs/) | `TransactionLogFilters` (date range), `TransactionLogStats`, `TransactionLogTable`, `TransactionLogGrid`, debounced search, `onUnmounted` debounce cleanup | **replace the three dead stat tiles** (`timesheetClosing`/`adjustments`/`biometricSyncs`) with `total_inserts`/`total_updates`/`total_deletes` (Decision 5C); import shared types/api; rename `filter.action` → `filter.search` |
| [payroll/reports/pages/transaction_logs/](../../../../resources/views/web/src/module/payroll/reports/pages/transaction_logs/) | page + route under `payroll/reports` | import shared types/api; remove client-side `module` pinning |

**Shared UI conventions** — reuse the globals (no import): `Pagination`, `Spinner`, `EmptyState`, `TableSkeleton`, `StatusBadge`, `VDatePicker`, `CSelect`; `Modal` is imported. Slate cards + dark-mode classes and the existing badge palettes in [transaction_logs.utils.ts](../../../../resources/views/web/src/module/hr/transaction_logs/utils/transaction_logs.utils.ts) per [ui-design.md](../../../rules/conditional/ui-design.md).

**Layout sketch** (the HR reference, which the others converge toward):
```
┌──────────────────────────────────────────────────────────────┐
│ Transaction Logs                       [table|grid] [export] │
├──────────────────────────────────────────────────────────────┤
│ [today] [inserts] [updates] [deletes]      ← stat tiles      │
├──────────────────────────────────────────────────────────────┤
│ search(debounced) │ module ▾ │ action ▾ │ date from–to │ 10 ▾ │
├──────────────────────────────────────────────────────────────┤
│ When │ User │ Module │ Action │ Type │ IP │            → row │  ← click = detail panel
│ ...                                                          │
├──────────────────────────────────────────────────────────────┤
│                                        <Pagination server>   │
└──────────────────────────────────────────────────────────────┘
   Detail panel: per-field old → new diff, only changed keys
```

---

## 6. Business Rules & Edge Cases

**Rules**
1. **Audit rows are immutable.** Insert-only — never update or delete a `translog` row from application code. No edit/delete UI, ever.
2. **Every write path logs.** Create/update/delete on master data, payroll records, and attendance adjustments must call `TransLog::logAction()` with the correct `action_type` ([payroll.md](../../../rules/conditional/payroll.md) audit-trail rule).
3. **Portal separation** (Decision 4) — enforced server-side; payroll audit detail must not be readable from the employee portal.
4. **Logging must never break the business operation.** If a `logAction` call is inside the operation's `DB::transaction`, a logging failure rolls back a legitimate payroll write. Decide explicitly: log inside the transaction (atomic, but a log bug aborts the operation) or after commit (operation safe, log may be lost). **Recommended: inside the transaction** — a silently-unlogged payroll edit is worse than a failed one — but this must be a conscious choice.
5. **No PII in log values.** `oldvalue`/`newvalue` capture whole model attribute sets at some call sites; salary and government-ID fields land in plaintext JSON. Per [security-baseline.md](../../../rules/core/security-baseline.md), redact or whitelist which attributes are snapshotted for sensitive tables.

**Edge cases**

| Case | Handling |
|---|---|
| `createdby` points to a deleted/missing account | `leftJoin` yields `null` `createdby` → render "System" / "Unknown user"; never blank |
| Log written by a job/command with no auth (e.g. `ProcessPayrollHandler` passes `$request = null`) | `Auth::id()` is `null` and `request()->ip()` may be a console IP. `createdby` is `integer` NOT NULL — **verify this doesn't fatal**; if it can, allow null or use a reserved system account id |
| `oldvalue`/`newvalue` empty or not valid JSON (legacy rows written by the raw `insertTransLog` as flat strings) | Frontend must tolerate string-or-object; render a single "value" row rather than crashing the diff view |
| Update where nothing actually changed | Detail panel already filters to changed keys only; an all-equal diff shows an explicit "No field changes" state, not an empty panel |
| `search` containing regex/`%`/`_` metacharacters | Bound parameters everywhere (already the case); `highlightMatch` already escapes its regex — keep it, and keep the `<mark>` `v-html` sink limited to escaped output ([security-baseline.md](../../../rules/core/security-baseline.md)) |
| Very large table | Server-side pagination only — never fetch all. Stats are 5 `COUNT(*)`s per request: with the Decision 3 indexes these are index-only; if the table reaches millions, cache the stat block briefly rather than dropping the indexes |
| `datefrom` later than `dateto` | Return an empty page (no error). Optionally disable the invalid range in the date pickers |
| `module` value requested outside the caller's permitted set | Intersect to empty → empty result. Do **not** 403 (leaks which modules exist) |
| Export | Exports the **current filtered page** via the existing `$exportTable`. If "export all" is wanted, that is a new endpoint — out of scope (§8) |
| Timezone | `created_at` is stored in app time; `date`/`time` aliases use MySQL `DATE_FORMAT` and `total_today` uses PHP `now()`. **These must agree** — if the DB and app timezones differ, "today" and the row dates disagree at midnight boundaries. Verify before shipping |

---

## 7. Build Order

Dependency-first. Backend-heavy — the frontend already exists, so Gate 1 is a light alignment pass.

1. **Migration (scaffold only, user runs it)** — `database/migrations/alters/` adding the four indexes from §3. Optionally default `action_type` to `0`.
2. **Model** — add module constants + `MODULES` to [TransLog](../../../../app/Models/TransLog.php); confirm `logAction()` is the sole writer.
3. **Writer migration (F2 — highest value)** — convert the 36 `HandleGlobal::insertTransLog` call sites to `TransLog::logAction()` with array `oldvalue`/`newvalue` and an explicit `action_type`; delete `insertTransLog`. Verify each converted controller still logs on create/update/delete.
4. **Query** — fold the global controller's inline query into `GetTransactionLogsQuery` with the §4 superset params; fix the dead stat labels (F4); add portal scoping (Decision 4A) once the §Decision-4 table is confirmed; stop flattening `oldvalue`/`newvalue`.
5. **Controllers** — reduce `global\TransactionLogsController@index` to a thin dispatcher; keep or retire the tk one per Decision 1.
6. **Frontend Gate 1 — shared contract** — real `types.transaction_logs.ts` + one `useTransactionLogsApi()` in shared space; delete the three placeholder type files and three api hooks.
7. **Frontend Gate 2 — wire the portals** — repoint HR / timekeeping / payroll to the shared contract; swap the timekeeping dead tiles; add debounce to the HR search; drop payroll's client-side module pinning.
8. **Verify** — as an authenticated non-payroll user, confirm payroll rows are unreachable; confirm each portal's stat tiles are non-zero and consistent with the list; confirm a create/update/delete in one converted payroll controller lands a row with correct `action_type` and JSON diff.

---

## 8. Out of Scope (Future Specs)

- **Timekeeping write instrumentation** (Decision 5A) — logging timesheet closing, timesheet adjustment, leave/OT approvals, and biometric sync. The largest remaining audit gap; deserves its own spec.
- **Unified shared frontend module** (Decision 6A) — collapsing the three page trees into one shared feature module.
- **Retention & archival policy** — `translog` is append-only and unbounded. Partitioning, cold-archive, or a purge window is a real operational need and a policy decision.
- **PII redaction layer** — a whitelist/redaction pass over `oldvalue`/`newvalue` for salary and government-ID fields (§6 rule 5).
- **`mac_address` capture** — the column exists but is `null` at every call site. Either populate it or drop it.
- **Export-all endpoint** — server-side CSV/XLSX export of a full filtered result set, beyond the current page.
- **Automatic model-observer logging** — an Eloquent observer replacing 60 manual call sites. Attractive, but a large behavioural change; needs its own design.
- **Read-audit ("who viewed what")** — `translog` records writes only.
