# Spec — Redesign Timesheet Report Pages Using Standardized Global Components

> **Kind:** Extension — pure frontend refactor of five already-shipped pages onto one shared, config-driven layer (mirrors the completed `applications/shared/` migration). **No backend changes.**
> **Portal:** **Timekeeping** (`/api/timekeeping/timesheet-reports/...` routes, `timekeeping/timesheet_reports` frontend module — controller namespace is `tk`, URL prefix is `timekeeping`).
> **Route(s) (frontend, ALREADY REGISTERED — do not edit the route file):** `timekeeping/timesheet-reports/absences` (`timesheet_reports_absences`), `.../tardiness` (`timesheet_reports_tardiness`), `.../undertime` (`timesheet_reports_undertime`), `.../overtime` (`timesheet_reports_overtime`), `.../night-premium` (`timesheet_reports_night_premium`).
> **Conventions:** [project-gate.md](../../../rules/core/project-gate.md), [payroll.md](../../../rules/conditional/payroll.md), [ui-design.md](../../../rules/conditional/ui-design.md), [frontend-vue.md](../../../rules/conditional/frontend-vue.md), [system-awareness.md](../../../rules/conditional/system-awareness.md).
> **System Awareness:** Models **reused** (`AccountDetailVW`/`vw_accounts_details`, `TimesheetSummary`, `employee_status`); Backend **fully reused, zero changes** — `App\Http\Controllers\tk\TimesheetReportsController`, `App\Queries\Timesheet\{GetAbsencesReportQuery, GetTardinessReportQuery, GetUndertimeReportQuery, GetOvertimeReportQuery, GetNightPremiumReportQuery}`, and their shared builder `App\Queries\Timesheet\BuildTimesheetReportRowsQuery`; Routes **reused** (`routes/api/timekeeping.php` `timesheet-reports` group, already registered); **New migration: NO.**

---

## 1. Purpose

The **Timesheet Reports** hub (`TimesheetReports.vue`) links to five report pages — **Absences, Tardiness, Undertime, Overtime, Night Premium** — that each answer "which active employees were affected by this metric in the current pay period, and by how much?" so timekeepers can audit attendance/premium totals before closing a cutoff.

All five pages are already live and already share one backend builder: `BuildTimesheetReportRowsQuery::build()` computes an identical per-employee row (same fields: `empid`, `fullname`, `position`, `unit`, `employee_type`, `reg_hrs`, `worked_hrs`, `ot_hrs`, `late_hrs`, `ut_hrs`, `leaves`, `absents`, `leave_breakdown`, `processing_status`, plus every OT/NP/adjustment breakdown column) **live** from `HandleTimesheet::timesheet_details` — the same routine Timesheet Details uses — for every active employee in the selected pay period. Each `Get<Type>ReportQuery` just applies its own `> 0` filter over that identical row set (e.g. `late_hrs > 0` for Tardiness).

The frontend, however, still has **five independent copies** of the same page (`Header.vue`, `Table.vue`, `use<Type>.ts` composable, `<type>.api.ts`, `types.<type>.ts` per report) — verified by reading all five: the composables are structurally identical (period state, router querystring sync, search/department/employee-type/`only<X>` toggle filters, client-side pagination, `resetFilters`) down to variable-naming conventions, differing only in which field(s) they sum for `stats` and which toggle name they use. The Table components differ only in which columns they render and whether a column group (leave types / OT breakdown / NP+NPOT breakdown) is shown. Every page also has its own hand-rolled Excel export function with hard-coded column headers.

This is exactly the duplication problem the **Application module redesign** ([applications_reports.md](./applications_reports.md)) already solved for the *Applications* pages via a `shared/` config-driven layer. This spec does the same thing for *Timesheet Reports*: **one shared component set, five thin per-report config files**, so a fix to filtering, pagination, export, or styling applies once instead of five times — matching the Global UI Standards (global `CSelect`, `StatusBadge`, `EmptyState`, `TableSkeleton`, `Pagination`) that the current pages currently bypass with native `<select>`/hand-rolled badges/no skeleton state.

---

## 2. Design Decisions (Pros & Cons)

### Decision 1: Shared component architecture (the "one fix, five pages" decision)

**Option A — Config-driven `shared/` layer under `timesheet_reports/pages/shared/`, each report page a thin wrapper (Recommended)**
- One `useTimesheetReport(config)` composable, one `TimesheetReportHeader` / `Filters` / `Metrics` / `Table` set, plus a per-report `<report>.config.ts` describing columns (incl. grouped/dynamic breakdown columns), metric cards, the toggle-filter label, and the Excel export column map. Each `<Report>.vue` becomes ~15–20 lines.

| Pros | Cons |
|---|---|
| **One fix applies to all five pages** — exactly the definition doc's stated goal. | Column rendering must be config-driven (a `render`/`format` per column plus a "column group" concept for OT/NP/leave breakdowns), more abstract than plain markup. |
| Removes ~5× duplicated composable logic, ~5× duplicated Excel export code, ~5× duplicated status-badge markup. | Absences' leave-type columns are **data-derived** (only known after the period loads), not a static field list like OT/NP — the config model needs an escape hatch for this (see Decision 3). |
| New report types later (e.g. a future NSD-only or per-shift report) cost one config file, matching the Applications precedent. | Slightly harder to eyeball one page's markup in isolation. |

**Option B — Keep the five independent copies, only reskin them to use global components**
- Leave `useAbsences`/`useTardiness`/etc. as separate files; just swap native `<select>` → `CSelect`, hand-rolled badge → `StatusBadge`, etc. in each.

| Pros | Cons |
|---|---|
| Smaller diff per page; no shared abstraction to design. | **Every future fix (a filter bug, a new column, a pagination tweak) must be applied five times** — the exact problem this spec exists to avoid; violates [system-awareness.md](../../../rules/conditional/system-awareness.md). |
| | Doesn't satisfy the definition doc's explicit ask: "Create a single shared component that can support multiple timesheet report types." |

**Option C — One generic page bound to a `:type` route param**
- Single `TimesheetReport.vue` at `timekeeping/timesheet-reports/:type`.

| Pros | Cons |
|---|---|
| Fewest files of all. | Breaks the five already-registered route names/paths (`timesheet_reports_absences`, etc.) and the hub's `router-link`s. |
| | Per-type columns/metrics/breakdown-groups still need a config map, so it saves little over Option A while destabilizing working routes. |

**Recommendation:** **Option A**, identical reasoning to [applications_reports.md](./applications_reports.md) Decision 2 — it is the only option that satisfies "one file, one fix" while keeping the five existing routes intact.

---

### Decision 2: Data-fetch & pagination model

Unlike the Applications pages (which query real DB tables with `WHERE`/`LIMIT`), `BuildTimesheetReportRowsQuery` computes **every active employee's totals live** via `HandleTimesheet::timesheet_details` — there is no SQL `WHERE` to push search/department filters into; the full active-employee set for the period must be computed regardless of what the user later filters by.

**Option A — Keep the current model: one fetch per period, client-side search/department/type/toggle filter + client-side pagination (Recommended)**
- `useTimesheetReport(config)` calls the report endpoint once (on mount and whenever the period changes), then does all filtering/pagination in the browser over the returned array — exactly what all five current composables already do.

| Pros | Cons |
|---|---|
| Matches how the backend actually computes data — no wasted re-computation per filter keystroke. | Whole-period payload size is bounded by active headcount, not by filtered result size (acceptable — same as today). |
| Zero backend change; router querystring (`?from=&to=`) sync already works today and is preserved as-is. | Diverges from the Applications module's server-side-pagination pattern — a reader familiar with `applications/` will see a different data-fetch shape here. |

**Option B — Migrate to backend-driven filter params + pagination, matching `useApplicationReport`**
- Add `search`/`department`/`employee_type`/`page`/`per_page` params to each `Get<Type>ReportQuery`.

| Pros | Cons |
|---|---|
| Consistent shape with the Applications module. | `BuildTimesheetReportRowsQuery` still has to run `HandleTimesheet::timesheet_details` for **every** active employee before any filter can be applied — pagination at the query layer buys nothing but complexity, since the expensive step (live computation) isn't filterable by SQL. |
| | Backend change to five Query classes + controller, when the spec's stated scope is a frontend redesign. |

**Recommendation:** **Option A.** The live-computation architecture makes server-side pagination a false optimization here; keep the proven client-side model and share it once instead of five times.

---

### Decision 3: Column model — static fields vs. grouped vs. data-derived columns

Three distinct column shapes exist today: (1) plain columns (Employee, Employment Type, Regular/Worked Hours), (2) a **fixed breakdown group** with a colspan header, shown only if at least one visible row is non-zero for any field in the group (OT's 8 `ot_*` columns, NP's 8+8 `np_*`/`npot_*` columns), and (3) Absences' **data-derived** leave-type columns — the set of columns isn't known until the period's `leave_breakdown` arrives, keyed by `idleave`/`leave_alias`.

**Option A — Extend `ColumnConfig` with an optional `group` (fixed fields, colspan header, per-report accent color) and an optional `deriveDynamicColumns(rows)` hook for the Absences case (Recommended)**

| Pros | Cons |
|---|---|
| Preserves today's "hide the whole group if every value is zero" UX (a real, already-shipped feature — losing it would be a regression) for OT/NP, generalized into config instead of duplicated per-table. | The shared `TimesheetReportTable.vue` is more complex than the Applications' flat `ColumnConfig[]` — it must support fixed **and** data-derived columns. |
| Absences' leave columns stay possible without a special-cased fork of the table component. | Column group visibility must be computed from the *current page's* filtered rows or the *whole period's* rows — pick one and keep it consistent (recommend: whole filtered set, matching today's `props.employees` scope, not just the current page slice). |

**Option B — Drop dynamic hide-if-empty; always render every column**
- Simpler config (flat array, like Applications), but OT/NP tables would always show all 8 breakdown columns even when every one is zero for the whole period.

| Pros | Cons |
|---|---|
| Simplest possible config shape; matches Applications 1:1. | Regresses an already-shipped, presumably valued UX (today's tables actively hide all-zero breakdown columns to reduce noise) — a visible downgrade, not a neutral simplification. |

**Recommendation:** **Option A.** The hide-if-empty behavior is existing, working UX — generalize it into config rather than delete it for the sake of matching Applications' simpler (but less capable) shape.

---

### Decision 4: Status badge rendering

All five tables currently hand-roll a pill (`bg-slate-100 ... <i class="mdi mdi-lock">Locked</i>` vs. an emerald "Processed/Pending" pill) instead of using the project's global `StatusBadge` component — a Global UI Standards violation ("Common status badges: Use existing status badge styling or global badge components").

**Option A — Switch to the global `StatusBadge` (Recommended)**
- `processing_status` maps to `status="processed"` (green, built-in), `status="pending"` (amber, built-in), or `status="locked"` with `customLabel="Locked"` (falls through to `StatusBadge`'s default slate style, which already visually matches the current "Locked" pill's slate coloring — just without the lock icon).

| Pros | Cons |
|---|---|
| Removes 5× duplicated badge markup; matches [ui-design.md](../../../rules/conditional/ui-design.md) and the Applications precedent (`getStatusKey`/`getStatusLabel` + `StatusBadge`). | `StatusBadge` has no icon slot — the current lock/lock-open `mdi` icon (a meaningful "this period is closed" cue) is lost unless a small wrapper adds an icon beside the badge. |
| One place to fix if status colors/labels ever change. | |

**Option B — Keep the current hand-rolled badge, centralize it as one shared render function**
- Move the existing markup into a shared `<ProcessingStatusBadge>` sub-component reused by all five tables, keeping the lock icon.

| Pros | Cons |
|---|---|
| Preserves the lock iconography exactly as shipped today. | Still a bespoke badge component living outside the global `StatusBadge` system — doesn't fully satisfy the Global UI Standards ask, just deduplicates the bespoke version. |

**Recommendation:** **Option A**, with a small enhancement: render `StatusBadge` and, only when `processing_status === 'Locked'`, prefix it with a small `mdi-lock` icon outside the badge — keeps the meaningful cue without forking the global component.

---

### Decision 5: Filter controls — native inputs vs. global `CSelect`

Department and Employment Type filters are currently native `<select>` elements; `CSelect` is a **mandatory, globally-registered** component per [project-gate.md](../../../rules/core/project-gate.md) ("Globally-registered components — use WITHOUT importing: `CSelect`...").

**Option A — Replace both selects with `CSelect` (Recommended)**

| Pros | Cons |
|---|---|
| Matches mandatory Global UI Standards and the Applications precedent. | `CSelect` normalizes on `{ value, label }` — the department/employee-type option lists (currently plain string arrays from `uniqueDepartments`/`uniqueEmployeeTypes`) must be mapped to that shape in the shared composable. |
| Consistent look/searchability with every other filtered report in the app. | |

**Option B — Keep native `<select>` elements**

| Pros | Cons |
|---|---|
| Zero markup change. | Visibly inconsistent with every other report page in the app (Applications, Payroll reports); fails the Global UI Standards check explicitly called out in the definition doc. |

**Recommendation:** **Option A.**

---

### Decision 6: Export — five duplicated Excel exporters vs. one config-driven exporter

Every one of the five pages has its own `exportToExcel()` using `xlsx` with hard-coded column headers (verified: `Tardiness.vue`, `Undertime.vue`, `Overtime.vue`, `NightPremium.vue`, and `Absences.vue` — the only one read in full — all import `XLSX` directly).

**Option A — One shared `exportReportToExcel(config, rows)` util driven by the same `ColumnConfig[]` that renders the table (Recommended)**

| Pros | Cons |
|---|---|
| Column headers/order can never drift between the on-screen table and the exported file (today each page defines its Excel headers independently of its table headers). | Column `format`/group logic needs an Excel-friendly variant (flatten grouped breakdown columns into one row of headers instead of colspan). |
| One `xlsx` import instead of five. | |

**Option B — Leave the five export functions as-is**

| Pros | Cons |
|---|---|
| No shared export util to design. | Five copies of near-identical `xlsx` boilerplate; a future column addition must be remembered in two places (table config + export function) per page. |

**Recommendation:** **Option A.**

---

### Decision 7: Period selector — business/domain call, **not purely technical**

Every current page uses the shared custom `PeriodComponent` (`@/src/components/custom/PeriodComponent.vue`) — a payroll-cutoff selector, not an arbitrary date range — because a timesheet report is only meaningful for a whole pay period (the backend resolves `idpayperiod` via `HandlePayPeriodQuery`, not a free `date_from`/`date_to`). The Applications module, by contrast, uses `VDatePicker` for an arbitrary date-range filter on top of already-filed records.

**Option A — Keep `PeriodComponent` as the report's time-range control (Recommended)**

| Pros | Cons |
|---|---| 
| Matches the domain reality: a timesheet report is period-scoped, not date-range-scoped; consistent with Timesheet Details/Summary, which also use `PeriodComponent`. | `PeriodComponent` is a custom shared component, not one of the eight globally-registered ones — must still be explicitly imported in the shared Table/Header (already true today). |

**Option B — Replace with `VDatePicker` (global) date-range filter, like Applications**

| Pros | Cons |
|---|---|
| Uses a globally-registered component with zero import. | A free date range doesn't map cleanly onto `HandlePayPeriodQuery`'s period resolution — could return partial or misaligned cutoff data; a real regression risk for a payroll-adjacent report. |

**Recommendation:** **Option A** — this is a business-domain call (should a timesheet report ever be sliced by an arbitrary date range instead of a full pay period?), not a pure UI preference, so confirm explicitly before implementation. Default assumption: **no**, keep period-based.

---

### Decision 8: Loading & empty states

Current pages use a translucent overlay + spinner during `isLoading` (no `TableSkeleton`) and a plain "No records matches active filters" `<tr>` (not the global `EmptyState`).

**Option A — Adopt `TableSkeleton` for the initial/period-change load and `EmptyState` for the zero-rows case (Recommended)**

| Pros | Cons |
|---|---|
| Matches Global UI Standards ("Loaders: match existing spinner models, skeleton panels") and the Applications precedent (`EmptyState` inside `<td colspan>`). | `TableSkeleton`'s `:columns` prop must match the *currently visible* column count, which is dynamic here (Decision 3) — needs to derive from the config, not a hard-coded number. |

**Option B — Keep the current overlay-spinner + plain empty row**

| Pros | Cons |
|---|---|
| No change needed. | Doesn't use the two global components ([ui-design.md](../../../rules/conditional/ui-design.md) mandates matching existing loader/empty-state components) that every other redesigned report page (Applications) already uses. |

**Recommendation:** **Option A.**

---

## 3. Database

**No migration. No new table. No new column. No backend change of any kind.** Every field consumed by the frontend already exists in the `BuildTimesheetReportRowsQuery` row shape:

| Field | Notes |
|---|---|
| `empid`, `fullname`, `position`, `unit`, `employee_type`, `status` | Employee identity/org columns, from `vw_accounts_details` + `employee_status` |
| `reg_hrs`, `worked_hrs`, `ot_hrs`, `late_hrs`, `ut_hrs`, `leaves`, `absents` | Per-employee totals for the period, computed live |
| `leave_breakdown` | Array of `{idleave, leave_alias, leave_type, days, is_carryover}` — powers Absences' dynamic columns |
| `ot_reg, ot_rd, ot_sh, ot_shrd, ot_lh, ot_lhrd, ot_lsh, ot_lshrd` | Overtime breakdown group |
| `np_npreg, np_rd, np_sh, np_shrd, np_lh, np_lhrd, np_lsh, np_lshrd` / `npot_*` (same suffixes) | Night Premium / Night Premium OT breakdown groups |
| `processing_status` (`"Locked" \| "Processed" \| "Pending"`), `last_processed` | Derived server-side from `TimesheetSummary` + period lock flag — never recompute client-side |
| Response envelope | `{ period: {id, period_start, period_end, tk_process_status, ...} | null, employees: Row[], count: number }` — identical shape for all five report types |

---

## 4. Backend

**Fully reused, zero changes.** Confirmed present and correct:

- `App\Http\Controllers\tk\TimesheetReportsController` — `absences()`, `tardiness()`, `undertime()`, `overtime()`, `nightPremium()`, each a thin `try/catch` around its Query class, raw `response()->json($data, 200)` (no API Resources) — matches [project-gate.md](../../../rules/core/project-gate.md) exactly.
- `App\Queries\Timesheet\BuildTimesheetReportRowsQuery::build($params)` — the single shared builder every report query calls, then filters with its own `> 0` predicate (`GetAbsencesReportQuery`, `GetTardinessReportQuery`, `GetUndertimeReportQuery`, `GetOvertimeReportQuery`, `GetNightPremiumReportQuery`).
- Routes already registered in `routes/api/timekeeping.php`:
  ```php
  Route::prefix('timesheet-reports')->group(function() {
      Route::get('/absences',      [TimesheetReportsController::class, 'absences']);
      Route::get('/tardiness',     [TimesheetReportsController::class, 'tardiness']);
      Route::get('/undertime',     [TimesheetReportsController::class, 'undertime']);
      Route::get('/overtime',      [TimesheetReportsController::class, 'overtime']);
      Route::get('/night-premium', [TimesheetReportsController::class, 'nightPremium']);
  });
  ```

**Do not** add search/department/pagination params to these Query classes (Decision 2, Option A). **Do not** touch `BuildTimesheetReportRowsQuery`'s computation — Timesheet Details relies on the same routine producing identical numbers.

---

## 5. Frontend

### Directory & file structure

```
module/timekeeping/timesheet_reports/
├── index.ts                                    # existing — unchanged
├── route/timesheet_reports.routes.ts           # existing — unchanged, do not edit
├── pages/
│   ├── TimesheetReports.vue                    # hub — unchanged scope (out of this spec's redesign)
│   ├── timesheet_details/...                   # OUT OF SCOPE — different data shape (daily logs)
│   ├── timesheet_summary/...                   # OUT OF SCOPE — different data shape (pay-period totals)
│   ├── shared/                                 # NEW — single source of truth (Decision 1)
│   │   ├── api/timesheet_reports.api.ts        # useTimesheetReportsApi(): getReport(type, params)
│   │   ├── composables/useTimesheetReport.ts   # period + router sync, filters, client pagination, stats, dynamic columns
│   │   ├── components/
│   │   │   ├── TimesheetReportHeader.vue       # HeaderBanner wrapper, config-driven title/description/icon
│   │   │   ├── TimesheetReportFilters.vue      # search + CSelect(dept) + CSelect(employee type) + toggle + Export + Reset
│   │   │   ├── TimesheetReportMetrics.vue      # up to 4 metric cards, config-driven labels/icons/values
│   │   │   ├── TimesheetReportPeriodBar.vue    # PeriodComponent wrapper + row-count chip (Decision 7)
│   │   │   └── TimesheetReportTable.vue        # config-driven columns incl. groups + dynamic (leave) columns, StatusBadge, TableSkeleton, EmptyState, Pagination
│   │   ├── types/types.timesheet_reports.ts    # EmployeeReportRow, ColumnConfig (+group, +deriveDynamicColumns), MetricConfig, ReportConfig
│   │   └── utils/timesheet_reports.utils.ts    # formatHours/formatDays, getProcessingStatusPresentation, exportReportToExcel(config, rows)
│   ├── absences/{Absences.vue, config/absences.config.ts, index.ts}
│   ├── tardiness/{Tardiness.vue, config/tardiness.config.ts, index.ts}
│   ├── undertime/{Undertime.vue, config/undertime.config.ts, index.ts}
│   ├── overtime/{Overtime.vue, config/overtime.config.ts, index.ts}
│   └── night_premium/{NightPremium.vue, config/night_premium.config.ts, index.ts}
```
TypeScript throughout the new `shared/` layer, `<script setup>`, PascalCase components — per [frontend-vue.md](../../../rules/conditional/frontend-vue.md). **No Pinia store**: state does not leave a single page tree (matches the Applications precedent).

### Global components — MANDATORY, use without importing
`CSelect`, `Pagination`, `Spinner`, `Loading`, `VDatePicker` *(not used here, see Decision 7)*, `StatusBadge`, `EmptyState`, `TableSkeleton`. Directives: `v-click-outside`, `v-offcanvas-back`.

| Need | Use | Contract notes |
|---|---|---|
| Department / Employee Type filters | **`CSelect`** | normalize on `{ value, label }`; map from `uniqueDepartments`/`uniqueEmployeeTypes` string arrays |
| Table loading | **`TableSkeleton`** | `:columns` must equal the currently-visible column count (dynamic per Decision 3) |
| Empty result | **`EmptyState`** | inside `<td :colspan="visibleColumnCount" class="p-0">` |
| Processing status pill | **`StatusBadge`** | `status` = `processed`/`pending`/`locked` (falls to slate default), `customLabel` overrides text (Decision 4) |
| Pagination | **`Pagination`** | `:data="{ from, to, total }"`, `:currentPage`, `:totalPages`, `@page-changed` |

**Must be imported** (exist but not global): `HeaderBanner` (`@/src/components/HeaderBanner.vue`), `PeriodComponent` (`@/src/components/custom/PeriodComponent.vue`, Decision 7), `LoadingState`.

### `useTimesheetReport(config)` — the one composable
Returns: `isLoading`, `period`, `employees` (raw), `filteredEmployees`, `paginatedEmployees`, `stats` (config-driven aggregation), `visibleColumns` (post hide-if-empty filtering per Decision 3), `searchQuery`, `selectedDepartment`, `selectedEmployeeType`, `toggleFilterValue` (generic name for `onlyAbsentsOrLeaves`/`onlyLate`/`onlyUndertime`/`onlyOvertime`/`onlyNightPremium`), `uniqueDepartments`, `uniqueEmployeeTypes`, `currentPage`, `perPage`, `totalPages`, `paginationData`, `fetchSummaries`, `resetFilters`, `exportToExcel`.
Behaviour (preserving all five current composables' verified behavior): debounced (300ms) search; period changes re-fetch and push `router.push({ query: { from, to } })`; `onMounted` reads `route.query.from`/`to` to restore a deep-linked period; filters are entirely client-side over the already-period-filtered `employees` array (Decision 2); changing any filter or `perPage` resets `currentPage` to 1.

### Per-report configuration (`<report>.config.ts`)
| Report | Toggle filter | Metric cards (label → source field) | Column groups |
|---|---|---|---|
| **Absences** | `onlyAbsentsOrLeaves` | Processed Headcount, Absent Employees, Total Absent Days (`absents`), Total Approved Leaves (`leaves`) | Dynamic leave-type columns via `deriveDynamicColumns` reading `leave_breakdown` |
| **Tardiness** | `onlyLate` | Total Headcount, Late Employees, Total Late Hours (`late_hrs`), Avg Late Hours/employee | none — plain `reg_hrs`/`worked_hrs`/`late_hrs` columns |
| **Undertime** | `onlyUndertime` | Total Headcount, Undertime Employees, Total UT Hours (`ut_hrs`), Avg UT Hours/employee | none — plain `reg_hrs`/`worked_hrs`/`ut_hrs` columns |
| **Overtime** | `onlyOvertime` | Total Headcount, OT Earners, Total OT Hours (`ot_hrs`), Regular OT Hours (`ot_reg`) | Fixed 8-field OT breakdown group (`ot_reg`…`ot_lshrd`) |
| **Night Premium** | `onlyNightPremium` | Total Headcount, NP Earners, Total NP Hours (sum of `np_*`), Total NPOT Hours (sum of `npot_*`) | Two fixed 8-field groups: NP breakdown, NPOT breakdown |

Values above are taken verbatim from each report's current shipped `stats` computed and column set — not invented.

### API contract (`shared/api/timesheet_reports.api.ts`)
```ts
type ReportType = 'absences' | 'tardiness' | 'undertime' | 'overtime' | 'night-premium';

getReport(type: ReportType, params): GET api/timekeeping/timesheet-reports/{type}
```
`night_premium`'s config maps its `type` to the URL segment `night-premium` (route already uses the hyphenated form). Params: `from`, `to`, and `idperiod` when `period.id` is known (mirrors today's exact `queryParams` shape in every composable). Response: `{ period, employees, count }` — identical shape for all five types; no per-type response mapping needed since the row schema is already unified by `BuildTimesheetReportRowsQuery`.

This is a **pure refactor of already-wired endpoints** — there is no Gate 1 (mock data) / Gate 2 (live data) split here, unlike a greenfield spec; the shared api layer calls the real endpoints from the start since they already exist and already work.

### UI & styling (timekeeping accent = `blue-600`)
- Cards/panels: `rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm` (already used — keep as-is).
- Metrics grid: `grid grid-cols-2 lg:grid-cols-4 gap-4` (matches current Absences page).
- Table: `text-xs`, header `bg-slate-100/80 dark:bg-slate-900`, sticky first (Employee) column, `divide-y divide-slate-100 dark:divide-slate-700/80`, `hover:bg-slate-50/50 dark:hover:bg-slate-800/25`.
- Wide tables scroll inside `overflow-x-auto`; the page body must never scroll horizontally (already correct today).
- Every color class carries a `dark:` counterpart (already correct today — verify it survives the refactor).
- Per-report accent colors carry over unchanged: Absences rose/blue, Tardiness amber, Undertime orange, Overtime purple, Night Premium sky/teal.

---

## 6. Business Rules & Edge Cases

### HRMS domain rules ([payroll.md](../../../rules/conditional/payroll.md))
- **Read-only reports:** none of the five pages write anything — no timesheet edits, no re-processing trigger. The shared layer must not add any write action beyond the existing Excel export.
- **No client-side re-derivation of payroll math:** grace-period lateness, OT multipliers (125%/130%/200%), and night differential (110%, 10PM–6AM) are computed once in `HandleTimesheet`/`ComputeNightPremiumAction`. The shared components only *format and group* already-computed numbers — never recompute them.
- **Portal separation:** `timesheet-reports/*` sits under the `timekeeping` prefix + `auth:sanctum` and returns **all** active employees for the period — this is timekeeper-only visibility; never reuse these endpoints/components from the employee or manager portal.

### Edge cases
| Case | Handling |
|---|---|
| No active pay period resolvable (`HandlePayPeriodQuery` returns nothing) | `period: null` → the shared composable must show an empty/period-not-found state, not crash on `period.period_start` |
| Employee has zero for the report's metric | Never appears — already filtered server-side; the frontend must not re-apply the same `> 0` filter (redundant, and would silently hide rows if a future backend change adds employees with exactly 0 for a valid reason) |
| All rows are zero for every field in a breakdown group (OT/NP/NPOT) | Hide the entire group (header + sub-columns), matching today's shipped behavior (Decision 3) |
| Absences: `leave_breakdown` empty for all rows | Zero dynamic leave columns rendered — table falls back to just the two fixed leave metric columns |
| `processing_status === 'Locked'` | Purely informational; a locked period never hides or disables rows — it is still a viewable, exportable report |
| `last_processed` is null (never processed) | Display `—`, not a crash on `.format()` — value is already a pre-formatted string or `null` from the backend |
| Deep link with `?from=&to=` for a period that no longer resolves | `fetchSummaries` receives stale params; matches current behavior — no special-case needed, `HandlePayPeriodQuery` is the single source of truth |
| Rapid typing in search | 300ms debounce (`useDebounce` today, `debounce` util as used in Applications shared composable — either is acceptable, pick one and use it consistently across the shared composable) |
| Excel export | Exports the **currently filtered** row set (not the full unfiltered period), matching today's Absences behavior; column headers come from the same `ColumnConfig[]` the table renders, so they can never drift apart (Decision 6) |
| Employee record missing `position`/`unit`/`employee_type` | Already defaulted server-side (`'N/A'`/`'General'`/`'Regular'`) — the frontend renders as-is, no client-side fallback needed |

---

## 7. Build Order

1. **Shared types** — `types.timesheet_reports.ts`: `EmployeeReportRow` (mirror `BuildTimesheetReportRowsQuery`'s full field list from §3), `ColumnConfig` (with optional `group` and `deriveDynamicColumns`), `MetricConfig`, `ReportConfig`.
2. **Shared utils** — `timesheet_reports.utils.ts`: `formatHours`/`formatDays` (the existing `val.toFixed(2)` / `"-"` fallback logic, unified), `getProcessingStatusPresentation` (maps `processing_status` → `StatusBadge` props per Decision 4), `exportReportToExcel(config, rows)` (per Decision 6).
3. **Shared api layer** — `timesheet_reports.api.ts` calling the five already-live endpoints directly (no mock-data gate needed — see §5).
4. **Shared composable** — `useTimesheetReport(config)`: period + router-query sync, debounced search, department/employee-type/toggle filters, client-side pagination, config-driven `stats`, dynamic column-visibility helpers, `resetFilters`, `exportToExcel`.
5. **Shared components** — `TimesheetReportHeader`, `TimesheetReportFilters` (using `CSelect`), `TimesheetReportMetrics`, `TimesheetReportPeriodBar` (using `PeriodComponent`), `TimesheetReportTable` (using `StatusBadge`, `TableSkeleton`, `EmptyState`, `Pagination`, plus the group/dynamic-column rendering from Decision 3).
6. **Five configs** — `absences.config.ts`, `tardiness.config.ts`, `undertime.config.ts`, `overtime.config.ts`, `night_premium.config.ts` per the table in §5.
7. **Five thin pages** — replace `Absences.vue`/`Tardiness.vue`/`Undertime.vue`/`Overtime.vue`/`NightPremium.vue` with wrappers around the shared components; the existing routes already resolve to these filenames, so **no route file edit**.
8. **🚦 GATE — user validates the design** on all five pages (light + dark, mobile → wide, with and without breakdown-group data present) against this spec, and confirms Decision 4 (StatusBadge + lock icon) and Decision 7 (keep `PeriodComponent`) before old files are deleted.
9. **Delete now-orphaned per-page files** — each report's private `components/*Header.vue`, `components/*Table.vue`, `composables/use*.ts`, `api/*.api.ts`, `types/types.*.ts` — once its thin page passes Gate 8.
10. **No backend step** — confirm via `php artisan route:list --path=api/timekeeping/timesheet-reports` that the reused endpoints still resolve exactly as before; nothing on the PHP side changes.

---

## 8. Out of Scope (Future Specs)

- **Timesheet Details** and **Timesheet Summary** pages (same `timesheet_reports` module, different data shape — daily logs / pay-period totals, not a per-metric filtered employee list) — not among the five reports named in the definition doc.
- Migrating `BuildTimesheetReportRowsQuery` to server-side filtering/pagination (Decision 2, Option B) — would require re-architecting `HandleTimesheet::timesheet_details` for SQL-level filtering.
- PDF or server-rendered export — Excel (`.xlsx`) only, matching current behavior.
- Replacing `PeriodComponent` with a global date-range picker (Decision 7, Option B) — flagged as a possible future call, not adopted here.
- Adding new report types beyond the five named (e.g. a standalone NSD-only or per-shift breakdown) — the shared layer makes this a one-config addition later, but isn't requested now.
- Reconciling the Timesheet Reports hub page (`TimesheetReports.vue`) itself with any shared "module hub" pattern — it is out of this spec's five-page scope.
