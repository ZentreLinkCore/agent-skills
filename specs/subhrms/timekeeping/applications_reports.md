# Spec — Timekeeping Application Report Pages (Leaves, Logsheet, OBT, Overtime, Cancelled)

> **Kind:** Greenfield (5 stub pages) + Extension (new read endpoints on an existing portal) — **ONE spec covering all five pages** so they are built and fixed in a single pass.
> **Portal:** **Timekeeping** (`/api/timekeeping/...` routes, `timekeeping/applications` frontend module — controller namespace is `tk`, URL prefix is `timekeeping`).
> **Routes (frontend, ALREADY REGISTERED — do not edit the route file):**
> `timekeeping/applications/leaves` (`tk_applications_leaves`), `.../logsheet` (`tk_applications_logsheet`), `.../official-business-trip` (`tk_applications_official_business_trip`), `.../overtime` (`tk_applications_overtime`), `.../cancelled-applications` (`tk_applications_cancelled_applications`).
> **Conventions:** [project-profile.md](../../../rules/project-profile.md), [hrms-rules.md](../../../rules/hrms-rules.md), [ui-design.md](../../../rules/ui-design.md), [vue-standards.md](../../../rules/vue-standards.md), [duplicate-prevention.md](../../../rules/duplicate-prevention.md).
> **System Awareness:** Models **reused** (`AppLeave`, `AppAdjustment`, `AppOfficialBusinessTrip`, `AppOvertime`, `AppChangeShift`, `Shift`, `PayPeriod`, `Leave`); Tables **reused** (`app_leave`, `app_adjustment`, `app_obt`, `app_overtime`, `app_shift`, `shift`, `leaves`, `payroll_period`, view `vw_accounts_details`); Routes **created** (one new `applications` group in `routes/api/timekeeping.php`); **New migration: NO** — every table already exists.

> [!IMPORTANT]
> **Read-only reports.** All five pages are **view-only** — no filing, no approve/disapprove, no cancel. The only row action is the **eye icon**, which opens a read-only details modal showing the application's current status and approval chain. Filing/approval already belongs to other modules (`adjustment_processing`, `resolution_center`, employee portal `TKApplicationController`). This matches the shipped `change_shift` page, which is the reference implementation.

---

## 1. Purpose

Timekeepers need one auditable place per application type to answer "what was filed, by whom, for which date/pay period, and where does it stand?" before they process or close a timesheet period. Today all five pages are **4-line stubs** while the underlying data (`app_leave`, `app_adjustment`, `app_obt`, `app_overtime`, `app_shift`) is already being written by the employee portal — so timekeepers have no portal-side visibility into pending or disapproved filings that will affect the cutoff.

These five reports close that gap:

| Page | Table | What it reports |
|---|---|---|
| **Leaves** | `app_leave` | Leave filings: leave type, day type (whole/half), hours/days, status |
| **Logsheet** | `app_adjustment` | Manual time-log corrections (missed/incorrect biometric logs) |
| **Official Business Trip** | `app_obt` | OBT filings: OBT type, time window, hours |
| **Overtime** | `app_overtime` | OT filings: planned vs actual hours, date range, ETO flag |
| **Cancelled Applications** | union of all 5 `app_*` tables | Every filing that was cancelled, across all types, with who cancelled it and why |

---

## 2. Design Decisions (Pros & Cons)

### Decision 1: Where the read query lives (reuse vs. new)

The scan found that `app/Queries/Payroll/` **already contains a report query for every one of these types**, each using the exact join set these pages need (`vw_accounts_details` for employee, `shift`, `payroll_period`, `vw_accounts_details` again for the canceller) plus search/department/status/pay-period/date-range filters and pagination:
`GetLogsheetReportQuery`, `GetOvertimeReportQuery`, `GetOfficialBusinessTripReportQuery`, `GetLeaveUsageReportQuery` / `GetLeaveAdjustmentReportQuery`, `GetChangeShiftReportQuery`.

**Option A — Call the existing `App\Queries\Payroll\Get*ReportQuery` classes from the new `tk` controller (Recommended)**
- The tk controller passes its filter params straight into the existing query class; no SQL is rewritten.

| Pros | Cons |
|---|---|
| Zero duplicated SQL — one source of truth per report ([duplicate-prevention.md](../../../rules/duplicate-prevention.md) rule 3). | A `tk` controller importing from the `Payroll` query namespace reads slightly odd. |
| Filters, joins, and pagination are already battle-tested in the payroll reports. | Payload carries payroll-only extras (`payroll_status`, `timesheet` join) the tk pages ignore. |
| Fastest path to working pages; any join fix benefits both portals. | Changing the shared query later requires re-checking the payroll report screens. |

**Option B — Relocate the shared read into `app/Queries/<Domain>/` and have both portals call it**
- Move each `Get*ReportQuery` to its domain folder (`Timesheet`, `Leave`, `Overtime`, `OfficialBusinessTrip`, `ChangeShift`), update the payroll controllers' imports.

| Pros | Cons |
|---|---|
| Architecturally cleanest — domain-owned queries, portal-neutral. | Touches working payroll controllers — regression risk on shipped screens. |
| Namespace matches [project-profile.md](../../../rules/project-profile.md)'s domain-folder convention. | Bigger diff than the feature needs; violates minimal-diff for unrelated files. |

**Option C — New `tk`-only query classes per type**
- Write five fresh `Get<Type>ApplicationsQuery` classes under the domain folders.

| Pros | Cons |
|---|---|
| Fully isolated from payroll reports; payload shaped exactly for these pages. | Re-implements ~80% of the same joins/filters five times — a direct duplicate-prevention violation. |
| | Five places to fix when a join or label changes. |

**Recommendation:** **Option A.** Reuse the existing payroll report queries as-is; add a thin new query class **only** for the cancelled union (Decision 4). If the payload divergence becomes painful later, Option B is the clean follow-up refactor.

---

### Decision 2: Frontend sharing strategy (the "one fix, five pages" decision)

All five pages are the same shape: header → 4 metric cards → filters → wide table → read-only details modal. Only the **columns, metric labels, extra filters, and endpoint** differ.

**Option A — Shared config-driven layer under `applications/shared/`, each page a thin wrapper (Recommended)**
- One `useApplicationReport()` composable, one `ApplicationReportTable` / `Filters` / `Metrics` / `DetailsModal` set, plus a per-page `<feature>.config.ts` describing columns + filters + endpoint. Each `<Feature>.vue` is ~20 lines.

| Pros | Cons |
|---|---|
| **One fix applies to all five pages** — exactly the stated goal. | Column rendering must be config-driven (slot/`render` per column), which is more abstract than plain markup. |
| ~1 200 fewer lines than five copies; no duplicated status/format helpers. | A type-specific quirk (e.g. OT's planned-vs-actual) needs a named slot escape hatch. |
| New application types later cost one config file. | Slightly harder to eyeball a single page's markup. |

**Option B — Copy the `change_shift` folder five times**
- Each page gets its own full `api/ composables/ components/ types/ utils/` set.

| Pros | Cons |
|---|---|
| Each page is dead simple to read in isolation. | Five near-identical copies of table/filters/modal/status utils — duplicate-prevention violation. |
| Zero abstraction risk. | **Every fix must be applied five times** — the exact problem this spec exists to avoid. |

**Option C — One generic page bound to a `:type` route param**
- Single `ApplicationReport.vue` at `timekeeping/applications/:type`.

| Pros | Cons |
|---|---|
| Fewest files of all. | Breaks the five already-registered route names/paths and the Applications hub links. |
| | Per-type columns/metrics still need a config map, so it saves little over Option A. |

**Recommendation:** **Option A.** It is the only option that satisfies "one file, one fix" while keeping the five existing routes intact.

> **Note on `change_shift`:** the shipped page has its own private copies of these components/utils. Migrating it onto the shared layer is **build-order step 10 (optional)** — do it only after the five new pages are validated, so a finished page is never destabilized mid-build.

---

### Decision 3: Backend route & controller granularity

**Option A — One parameterized trio + one controller (Recommended)**
```
GET /api/timekeeping/applications/{type}
GET /api/timekeeping/applications/{type}/statistics
GET /api/timekeeping/applications/{type}/{id}
```
- `{type}` ∈ `leaves|logsheet|overtime|obt|change-shift|cancelled`, resolved through a whitelist map to the Query class. One `ApplicationsController` with `index()`, `statistics()`, `show()`.

| Pros | Cons |
|---|---|
| One controller, three methods — one fix covers all five pages, matching Decision 2. | Less explicit than the sibling routes in `timekeeping.php`. |
| Adding a type later = one map entry. | Needs a strict whitelist or it becomes an arbitrary-table read (see Edge Cases). |
| Frontend api layer becomes one function with a `type` argument. | Route-list output is less self-documenting. |

**Option B — Explicit per-type routes and controller methods**
- `GET /applications/leaves`, `/applications/leaves/statistics`, … 15 routes, 11+ methods.

| Pros | Cons |
|---|---|
| Matches the explicit per-method style used elsewhere in `timekeeping.php`. | 15 route lines + 11 methods that differ only in which Query they call. |
| `route:list` reads as documentation. | Five places to fix per change — fights the goal. |

**Recommendation:** **Option A**, with a hard-coded whitelist map. The DRY win matches the stated goal; the whitelist removes the only real risk.

---

### Decision 4: Cancelled Applications data source

`GetTimesheetAdjustmentsQuery` (already serving `GET /api/timekeeping/timesheet-adjustments`) **already unions all five `app_*` tables** with an `adjustment_type` label and joins `vw_accounts_details`. However it: returns **all** rows unpaginated, has **no cancelled filter**, exposes only generic columns, and hard-codes `'approved_by' => 'Timekeeper Admin'`.

**Option A — New `GetCancelledApplicationsQuery` (union, cancelled-only, paginated) (Recommended)**
- New query in `app/Queries/TransactionLog/` or `app/Queries/Timesheet/`: same 5-table `unionAll`, `WHERE cancel_at IS NOT NULL`, joins the canceller's real name via a second `vw_accounts_details` alias, paginated.

| Pros | Cons |
|---|---|
| Correct pagination and a real canceller name — both missing today. | One new query class (justified: no existing query answers "cancelled across types"). |
| Leaves the existing endpoint and its future consumers untouched. | Some union SQL resembles the existing query. |

**Option B — Extend `GetTimesheetAdjustmentsQuery` with `cancelled_only` + pagination params**
- Add params and paginate in place; the cancelled page calls the existing endpoint.

| Pros | Cons |
|---|---|
| No new class; single union in the codebase. | Changes an endpoint's return shape from a mapped collection to a paginator — breaking for any future consumer. |
| | Must also fix the hard-coded `approved_by`, widening the blast radius. |

**Option C — Fetch all types and filter client-side**

| Pros | Cons |
|---|---|
| No backend work. | Ships every application row to the browser; breaks pagination and search. **Rejected.** |

**Recommendation:** **Option A.**

---

### Decision 5: How "Cancelled" is represented

`status` on all five tables is `tinyInteger default 0` with the DB comment **`0: pending, 1: approved, 2: disapproved`** — there is **no cancelled code**. Cancellation is recorded by `cancelby` / `cancel_at` / `cancel_reason`.

**Option A — Derive a virtual `status_label` = `Cancelled` when `cancel_at IS NOT NULL` (Recommended)**

| Pros | Cons |
|---|---|
| No migration, no backfill; matches how the employee portal already renders it. | `status_label` and the numeric `status` disagree for cancelled rows — must be documented in the type. |
| Preserves the pre-cancellation status (a cancelled-after-approval row is still visibly `status = 1`). | Every consumer must derive the label the same way → put it in one shared util. |

**Option B — Add `status = 3` (Cancelled) to all five tables**

| Pros | Cons |
|---|---|
| One field answers "what state is this in". | Migration + backfill on five tables; contradicts the existing column comments and every query that maps 0/1/2. |
| | Destroys the pre-cancellation status. |

**Recommendation:** **Option A**, with the derivation living in one shared util (`getStatusLabel(row)`), never inline in a component.

---

### Decision 6: Resolving the `approvers` approval chain

`approvers` is a JSON array of `{id, order, approver, status, date_approve}` where `approver` is an account id. `LeaveStatusController` resolves each name with a **per-approver DB lookup inside a per-row loop** — an N+1 pattern.

**Option A — Resolve names only in the detail endpoint (Recommended)**
- The list endpoint returns raw `approvers` (or omits it); `GET .../{type}/{id}` resolves the chain with a single `whereIn` lookup for the details modal.

| Pros | Cons |
|---|---|
| List stays flat and fast regardless of page size ([performance.md](../../../rules/performance.md)). | The chain is only visible after opening the modal (acceptable — it's a detail). |
| One lookup per opened record, never per row. | Adds one endpoint (already in Decision 3's trio). |

**Option B — Enrich the chain in the list response**

| Pros | Cons |
|---|---|
| Modal opens with zero extra request. | Re-introduces the N+1 seen in the employee portal; 10 rows × 3 approvers = 30 queries. |

**Recommendation:** **Option A.**

---

### Decision 7: Do cancelled rows still appear on the four type pages? — **business policy, your call**

**Option A — Keep them visible, labelled `Cancelled`**

| Pros | Cons |
|---|---|
| A report never silently hides records; the Leaves page shows every leave ever filed for a date. | The same row appears on both its type page and the Cancelled page. |
| Auditors can reconcile a single page per type. | Metric cards need a 5th "Cancelled" count or the four counts won't sum to Total. |

**Option B — Exclude them; the Cancelled page is the only place they appear**

| Pros | Cons |
|---|---|
| Each row lives on exactly one page; the four metric cards sum cleanly to Total. | A timekeeper looking at Leaves cannot see that a leave was filed and later cancelled. |

**Recommendation:** **Option A**, on the general principle that a report shouldn't hide rows — but this is an audit-policy decision, so **pick explicitly before implementation**. Whichever is chosen, apply it to all four type pages identically (one shared `excludeCancelled` flag in the shared composable).

---

## 3. Database

**No migration. No new table. No new column.** Every field below already exists.

### Common columns — present on all five `app_*` tables
| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `docnumber` | string, nullable | may be null → fall back to `{PREFIX}-{id}` (`LV`, `AA`, `OT`, `OB`, `CS`) |
| `idacct` | integer, indexed | → `vw_accounts_details.id` |
| `idshift` | integer, indexed | → `shift.id` (nullable on `app_leave`) |
| `date` | date, indexed | the affected work date |
| `remarks` | text, nullable | filer's reason |
| `file` | string, nullable | attachment path |
| `idpayperiod` | integer, nullable, indexed | → `payroll_period.id` |
| `approvers` | json, nullable | `[{id, order, approver, status, date_approve}]`, status `0=Pending 1=Approved 2=Disapproved 3=Canceled` |
| `cancelby` | integer, nullable, indexed | → `vw_accounts_details.id` |
| `cancel_at` | datetime, nullable | **presence = cancelled** (Decision 5) |
| `cancel_reason` | text, nullable | |
| `date_approve` | datetime, nullable, indexed | |
| `status` | tinyInteger default 0 | `0: pending, 1: approved, 2: disapproved` (no cancelled code) |
| `created_at` / `updated_at` | timestamps | filing time |

### Type-specific columns
| Table | Extra columns |
|---|---|
| `app_leave` | `idleave` → `leaves.id`; `idtimeleavetype` (**1 = Whole Day, 2 = 1st Half, 3 = 2nd Half**); `stime`, `etime` (time); `hrs`, `days` (string(10)) |
| `app_adjustment` | `stime`, `etime` (**NOT NULL** — the corrected log window); `hrs` |
| `app_obt` | `obt_type` (string, free-text — e.g. "Client Meeting"); `stime`, `etime`; `hrs` |
| `app_overtime` | `date_from`, `date_to` (date, indexed); `stime`, `etime`; `planhrs` (planned), `hrs` (actual); `eto_stat` (`0: inactive, 1: active` — ETO flag) |
| `app_shift` | `oldshiftid`, `newshiftid` (already consumed by the shipped `change_shift` page) |

### Lookup / join sources (reused, read-only)
| Source | Columns used |
|---|---|
| `vw_accounts_details` (view) | `id`, `empid`, `fullname`, `unit` (**this is the department name**), `unit_id`, `position` |
| `shift` | `id`, `type` (shift name), `code`, `stime`, `ftime` |
| `leaves` | `id`, `type` (leave name), `alias` (SL/VL/LWOP), `color` |
| `payroll_period` | `id`, `period`, `period_start`, `period_end`, `status` |

> [!CAUTION]
> The department field is **`vw_accounts_details.unit`**, not `department_name`. The shipped `change_shift` mock used `department_name`; when it is wired to live data that alias must map from `unit`. Do not invent a `departments` table — filter departments with `wad.unit` / `wad.unit_id`.

---

## 4. Backend

### Canonical join set (copied from `GetLogsheetReportQuery` — the proven pattern)
```php
DB::table('app_leave AS a')                                        // swap table per type
    ->leftJoin('vw_accounts_details AS wad', 'a.idacct', '=', 'wad.id')
    ->leftJoin('shift AS s', 'a.idshift', '=', 's.id')
    ->leftJoin('payroll_period AS pp', 'a.idpayperiod', '=', 'pp.id')
    ->leftJoin('vw_accounts_details AS cwad', 'a.cancelby', '=', 'cwad.id')
    ->leftJoin('leaves AS l', 'a.idleave', '=', 'l.id');            // app_leave only
```
Search covers `wad.empid`, `wad.fullname`, `wad.unit`, `wad.position`, `a.docnumber`, `a.remarks`.

### Controller: `App\Http\Controllers\tk\ApplicationsController` (new, thin)
Per [project-profile.md](../../../rules/project-profile.md): static Query calls, `try/catch (Exception $e)`, raw `response()->json(...)`, **no API Resources**, no FormRequest (siblings use inline `$request->all()`).

| Method | Route | Query called |
|---|---|---|
| `index(Request, string $type)` | `GET /applications/{type}` | whitelisted `Get*ReportQuery::execute($request->all())` |
| `statistics(Request, string $type)` | `GET /applications/{type}/statistics` | `Get<Type>StatisticsQuery` (COUNT aggregates over the same filters) |
| `show(Request, string $type, int $id)` | `GET /applications/{type}/{id}` | `GetApplicationDetailQuery::execute($type, $id)` — resolves the `approvers` chain in one `whereIn` |

**Whitelist map (required — Decision 3):**
```php
private const TYPE_MAP = [
    'leaves'       => \App\Queries\Payroll\GetLeaveUsageReportQuery::class,
    'logsheet'     => \App\Queries\Payroll\GetLogsheetReportQuery::class,
    'overtime'     => \App\Queries\Payroll\GetOvertimeReportQuery::class,
    'obt'          => \App\Queries\Payroll\GetOfficialBusinessTripReportQuery::class,
    'change-shift' => \App\Queries\Payroll\GetChangeShiftReportQuery::class,
    'cancelled'    => \App\Queries\Timesheet\GetCancelledApplicationsQuery::class,
];
```
An unknown `{type}` returns `response()->json(['message' => 'Unknown application type'], 404)`. Never interpolate `{type}` into SQL or a table name.

### Query classes
| Class | Status | Purpose |
|---|---|---|
| `App\Queries\Payroll\GetLeaveUsageReportQuery` | **reuse** | leaves list |
| `App\Queries\Payroll\GetLogsheetReportQuery` | **reuse** | logsheet list |
| `App\Queries\Payroll\GetOvertimeReportQuery` | **reuse** | overtime list |
| `App\Queries\Payroll\GetOfficialBusinessTripReportQuery` | **reuse** | OBT list |
| `App\Queries\Payroll\GetChangeShiftReportQuery` | **reuse** | wires the shipped change_shift page |
| `App\Queries\Timesheet\GetCancelledApplicationsQuery` | **NEW** | 5-table union, `cancel_at IS NOT NULL`, paginated, real canceller name |
| `App\Queries\Timesheet\GetApplicationStatisticsQuery` | **NEW** | COUNT aggregates per status for the metric cards, honouring active filters |
| `App\Queries\Timesheet\GetApplicationDetailQuery` | **NEW** | single row + resolved approver chain |

**No Handlers, no Actions** — these pages perform zero writes. **Do not** add `store`/`approve`/`reject` here; those live in `TimesheetAdjustmentController` and the resolution center.

### Route registration — append ONE group to `routes/api/timekeeping.php`
```php
// Timekeeping Application Reports (read-only)
Route::prefix('applications')->group(function () {
    Route::get('/{type}',             [ApplicationsController::class, 'index']);
    Route::get('/{type}/statistics',  [ApplicationsController::class, 'statistics']);
    Route::get('/{type}/{id}',        [ApplicationsController::class, 'show'])->whereNumber('id');
});
```
Add `use App\Http\Controllers\tk\ApplicationsController;` at the top of that same file. Register `/{type}/statistics` **before** `/{type}/{id}` (or keep `whereNumber('id')`) so `statistics` is not swallowed as an id. Do not create a new portal group or touch `routes/api.php`.

> **Existing endpoint left alone:** `GET /api/timekeeping/timesheet-adjustments` (+ `/statistics`, `/employees`, `/save`, `/{id}/approve`, `/{id}/reject`) stays as-is for `adjustment_processing`. The logsheet **report** reads through the new group; it must not gain approve/reject buttons.

---

## 5. Frontend

### Directory & file structure
```
module/timekeeping/applications/
├── shared/                                   # NEW — the single source of truth (Decision 2)
│   ├── api/applications.api.ts               # useApplicationsApi(): getList/getStatistics/getDetail(type, params)
│   ├── composables/useApplicationReport.ts   # generic state: filters, pagination, metrics, details modal
│   ├── components/
│   │   ├── ApplicationReportHeader.vue       # HeaderBanner wrapper (imported, not global)
│   │   ├── ApplicationReportMetrics.vue      # 4 metric cards, config-driven
│   │   ├── ApplicationReportFilters.vue      # search + status tabs + CSelect filters
│   │   ├── ApplicationReportTable.vue        # config-driven columns + eye action + Pagination
│   │   └── ApplicationDetailsModal.vue       # read-only status + approval chain
│   ├── types/types.applications.ts           # ApplicationRecord, ApplicationMetrics, ReportConfig, filter params
│   └── utils/applications.utils.ts           # getStatusKey / getStatusPresentation / getStatusLabel / formatTimeRange / docNumber fallback
└── pages/
    ├── leaves/{Leaves.vue, config/leaves.config.ts, index.ts}
    ├── logsheet/{Logsheet.vue, config/logsheet.config.ts, index.ts}
    ├── official_business_trip/{OfficialBusinessTrip.vue, config/obt.config.ts, index.ts}
    ├── overtime/{Overtime.vue, config/overtime.config.ts, index.ts}
    └── cancelled_applications/{CancelledApplications.vue, config/cancelled.config.ts, index.ts}
```
TypeScript throughout, `<script setup>`, PascalCase components, `use*` composables, kebab-case emits — per [vue-standards.md](../../../rules/vue-standards.md). **No Pinia store**: state does not leave a single page tree.

### Global components — MANDATORY, use without importing
Registered in `resources/views/web/main.ts`: **`CSelect`, `Pagination`, `Spinner`, `Loading`, `VDatePicker`, `StatusBadge`, `EmptyState`, `TableSkeleton`**. Directives: `v-click-outside`, `v-offcanvas-back`.

| Need | Use | Contract notes |
|---|---|---|
| Dropdown filters (department, pay period, leave type, OBT type, application type) | **`CSelect`** | normalizes on `{ value, label }`; ids must be **stringified** so an `=== 'all'` reset stays type-safe. `:searchable="false"` for short lists |
| Table loading | **`TableSkeleton`** | renders its **own full card** (header + table) — sibling with `v-if`/`v-else` against the table, not rows inside `<tbody>`. `:columns` must match the header count |
| Empty result | **`EmptyState`** | inside `<td :colspan="N" class="p-0">`; `icon`/`subIcon` take **full class strings** (`"mdi mdi-..."`) |
| Status pill | **`StatusBadge`** | props are `status` + **`customLabel`** (there is no `text` prop). Keys: `approved`, `pending`, `rejected`, `cancelled` |
| Pagination | **`Pagination`** | `:data="{ from, to, total }"`, `:currentPage`, `:totalPages`, `@page-changed` |
| Date-range filter (if enabled) | **`VDatePicker`** | |

**Must be imported** (exist but not global): `Modal` (`@/src/components/Modal.vue`), `HeaderBanner` (`@/src/components/HeaderBanner.vue`), `LoadingState`.

> [!CAUTION]
> `Modal`'s API is **`:show` prop + `update:show` emit** — passing `isOpen`/`title`/`@close` produces "Missing required prop: show" plus extraneous-attr warnings, because it renders a Teleport root. The shared modal must wrap it as `<Modal :show="isOpen" @update:show="...">` and render its own header/footer in the default slot.

### Shared utils / composables to reuse (never re-implement)
`@/src/utils/`: **`debounce`** (300 ms on the search input, `.cancel()` in `onUnmounted`), `dateFormatter`, `constants`. `@/src/composables/`: `useResponsive`. HTTP: `import http from '@/app/axios/axiosInstance'` **inside `shared/api/` only** — never from a composable or component.

### `useApplicationReport(config)` — the one composable
Returns: `isLoading`, `records`, `metrics`, `departments`, `payPeriods`, `typeOptions`, `searchQuery`, `selectedStatus`, `selectedDepartment`, `selectedPayPeriod`, `currentPage`, `totalItems`, `itemsPerPage`, `isDetailsModalOpen`, `selectedRecord`, `fetchData`, `handlePageChange`, `viewRecordDetails`, `closeDetailsModal`.
Behaviour: debounced search; any filter change resets `currentPage = 1`; `Promise.all` for list + statistics; every request wrapped in `try/catch` with `console.error`; cleanup in `onUnmounted`. **No** filing/approval functions.

### Per-page column configuration
| Page | Columns (left → right) | Extra filter |
|---|---|---|
| **Leaves** | Doc # · Employee (`fullname` + `empid` • `unit`) · Leave Type (`leaves.type` + `alias` badge) · Date · Day Type (Whole/1st Half/2nd Half) · Time (`stime`–`etime`) · Hrs / Days · Status · Remarks · Actions | Leave Type (`CSelect`) |
| **Logsheet** | Doc # · Employee · Date · Shift (`shift.type`) · Corrected Log (`stime`–`etime`) · Hrs · Status · Remarks · Actions | — |
| **OBT** | Doc # · Employee · Date · OBT Type · Time (`stime`–`etime`) · Hrs · Shift · Status · Remarks · Actions | OBT Type (`CSelect`) |
| **Overtime** | Doc # · Employee · Date (or `date_from`–`date_to`) · Shift · Planned (`planhrs`) · Actual (`hrs`) · Time · ETO (`eto_stat` badge) · Status · Remarks · Actions | ETO only (`CSelect`) |
| **Cancelled** | Doc # · Type (badge: Leaves/Logsheet/Overtime/OBT/Change Shift) · Employee · Date · Cancelled By · Cancelled At · Reason · Status Before Cancellation · Actions | Application Type (`CSelect`) |

Shared filters on every page: search (debounced), status tabs (All / Pending / Approved / Disapproved), Department (`CSelect`, from `wad.unit`), Pay Period (`CSelect`, from `payroll_period`).
Metric cards on every page: **Total · Pending · Approved · Disapproved** (+ **Cancelled** if Decision 7 → Option A). The Cancelled page's four cards are **Total Cancelled · by type breakdown · cancelled this period · with reason given**.

### API contract (`shared/api/applications.api.ts`)
```ts
type ReportType = 'leaves' | 'logsheet' | 'overtime' | 'obt' | 'change-shift' | 'cancelled';

getList(type, params)       // GET api/timekeeping/applications/{type}
getStatistics(type, params) // GET api/timekeeping/applications/{type}/statistics
getDetail(type, id)         // GET api/timekeeping/applications/{type}/{id}
```
Request params: `search`, `status` (`''|0|1|2`), `department`, `pay_period`, `date_from`, `date_to`, `page`, `per_page` (+ `leave_type` / `obt_type` / `eto_stat` / `application_type` per page).
List response: `{ data: ApplicationRecord[], total: number, page: number, per_page: number }`.
Statistics response: `{ total, pending, approved, disapproved, cancelled }`.

**Gate 1 (design-first):** every method returns **hard-coded** data shaped exactly as above, with field names taken from the tables in §3 (`empid`, `fullname`, `unit`, `docnumber`, `idtimeleavetype`, `planhrs`, `eto_stat`, `cancel_reason` …) — never placeholder names like `name`/`title`/`value`. Mark each method `// TODO(backend)` with its real endpoint. **Gate 2** replaces the bodies with `http.get(...)` and nothing else changes.

### UI & styling (timekeeping accent = `blue-600`)
- Cards/panels: `rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm`.
- Metrics grid: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`; page shell `p-4 md:p-6 lg:p-8 space-y-6`.
- Table: `text-xs`, header `bg-slate-50/80 dark:bg-slate-900/80 text-[11px] font-bold uppercase tracking-wider`, rows `divide-y divide-slate-100 dark:divide-slate-700/60`, hover `hover:bg-slate-50/60 dark:hover:bg-slate-700/30`.
- Wide tables scroll inside `overflow-x-auto`; the page body must never scroll horizontally.
- Every colour class carries a `dark:` counterpart. Transitions on interactive elements (`transition-colors duration-200`), `cursor-pointer` on buttons.
- Semantic tones: pending `amber`, approved `emerald`, disapproved `rose`, cancelled `slate`, accent/links `blue-600`.
- No inline `<style>` beyond an empty `<style scoped></style>`; no second UI framework.

---

## 6. Business Rules & Edge Cases

### HRMS domain rules ([hrms-rules.md](../../../rules/hrms-rules.md))
- **Portal separation:** these endpoints sit under the `timekeeping` prefix inside the `auth:sanctum` group and return **all employees'** filings. The employee-portal controllers (`LeaveStatusController`, `OvertimeStatusController`, `OBTripStatusController`, `LogsheetStatusController`) stay self-scoped by `Auth::id()` — never widen them, and never expose payroll amounts on these pages.
- **Read-only:** no leave-credit locking/restoring, no timesheet sync, no OT rate computation (125% / 130% / 200%) and no NSD math happens here. Hours are **displayed as stored**.
- **Audit trail:** these pages are themselves the audit view; they must not mutate `approvers`, `cancel_*`, or `status`.

### Edge cases
| Case | Handling |
|---|---|
| `docnumber` is null | Display `{PREFIX}-{id}` (`LV`/`AA`/`OT`/`OB`/`CS`) — same map as `GetTimesheetAdjustmentsQuery` |
| `idshift` null / shift row deleted | `leftJoin` yields null → render `—`, never crash |
| `idpayperiod` null | Pay-period column shows `—`; the row must still appear under "All Pay Periods" |
| Cancelled row (`cancel_at` set) | `status_label = 'Cancelled'` via the shared util; numeric `status` keeps its pre-cancellation value (Decision 5). Visibility on type pages per Decision 7 |
| `status` outside 0/1/2 | Fall through to `pending` styling; do not throw |
| Employee record missing from `vw_accounts_details` | `fullname` → `'Unknown'`, `unit` → `—` (row still listed; don't drop audit rows) |
| Unknown `{type}` path segment | 404 `{'message': 'Unknown application type'}`; never build SQL from the raw segment |
| `per_page` absent/0/negative | Default to 10 (frontend `itemsPerPage`) and clamp server-side, mirroring `GetLogsheetReportQuery`'s `perPage <= 0` guard |
| Filters + pagination | Statistics must honour the **active filters**, and counts come from SQL aggregates — never from the current page's array length |
| Large `approvers` chains | Resolved only in `show()` with one `whereIn`; the list never loops DB calls (Decision 6) |
| Overtime spanning `date_from`→`date_to` | Date filters compare against the **range**, not just `date`; display both when they differ |
| Attachment `file` present | Details modal shows a link; no inline preview, `rel="noopener"` |
| Rapid typing in search | 300 ms `debounce`, `.cancel()` on unmount |
| Locked pay period | Purely informational here — a locked period never hides rows |

---

## 7. Build Order

1. **Shared types + utils** — `types.applications.ts` (`ApplicationRecord`, `ApplicationMetrics`, `ReportConfig`, filter params) and `applications.utils.ts` (`getStatusKey`, `getStatusPresentation`, `getStatusLabel`, `formatTimeRange`, doc-number fallback), field names taken from §3.
2. **Shared api layer (Gate 1)** — `applications.api.ts` with hard-coded data + `// TODO(backend)` markers.
3. **Shared composable** — `useApplicationReport(config)` with debounced search, filter-driven refetch, pagination, details-modal state, `onUnmounted` cleanup.
4. **Shared components** — Header / Metrics / Filters / Table / DetailsModal, using the global components per §5 (`CSelect`, `TableSkeleton`, `EmptyState`, `StatusBadge`, `Pagination`) and the correct `Modal` `:show`/`update:show` contract.
5. **Five configs** — `leaves.config.ts`, `logsheet.config.ts`, `obt.config.ts`, `overtime.config.ts`, `cancelled.config.ts` (columns, extra filter, metric labels, `type` key).
6. **Five thin pages** — replace each 4-line stub; the existing routes already resolve to these filenames, so **no route file edit**.
7. **🚦 GATE — user validates the design** on all five pages (light + dark, mobile → wide) against this spec before any backend work.
8. **Backend reads** — new `GetCancelledApplicationsQuery`, `GetApplicationStatisticsQuery`, `GetApplicationDetailQuery`; confirm the reused payroll queries accept the tk filter params.
9. **Controller + routes** — `tk\ApplicationsController` (`index`/`statistics`/`show`) + the `applications` prefix group appended to `routes/api/timekeeping.php`; then swap the api-layer bodies to `http.get(...)` (Gate 2). Verify with `php artisan route:list --path=api/timekeeping`.
10. **(Optional, after step 7 passes)** Migrate the shipped `change_shift` page onto the shared layer and delete its private duplicates, so `change-shift` becomes the sixth config and the "one fix" property holds for all six pages.

---

## 8. Out of Scope (Future Specs)

- **Filing, approving, disapproving, cancelling** from the timekeeping portal — owned by `adjustment_processing` / `resolution_center` and the employee portal's `TKApplicationController`.
- **`duty_roster`** page (also under `applications/`) — different data shape (schedules, not filings).
- Deprecating/merging `GET /api/timekeeping/timesheet-adjustments` and its unpaginated union, and fixing its hard-coded `'approved_by' => 'Timekeeper Admin'`.
- Relocating the payroll report queries into domain folders (Decision 1, Option B).
- **Excel/PDF export** — a global `$exportTable` helper and `printContent` provider already exist and would be the reuse targets.
- Employee-portal parity refactor (pointing the five `*StatusController`s at the shared queries).
- Notifications/badge counts for pending filings.

---

## 9. Note on the Existing `change_shift` Spec

[`change_shift.md`](./change_shift.md) still specifies a filing modal and approve/disapprove actions. The shipped page is now **read-only** (filing modal deleted, approve/disapprove removed, eye → details/status modal only, `status` limited to 0/1/2 with no Cancelled code). A future `/webkit.backend-implement` run against that spec would build filing/approval endpoints that the UI no longer has. **That spec should be amended to read-only before it is used again** — flagged here rather than edited, since it documents a completed feature.
