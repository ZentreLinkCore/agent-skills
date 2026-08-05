# Spec — Timesheet Adjustment (Unified Adjustment Report)

> **Kind:** Extension of the existing `timekeeping/applications` module — **not** a build-out of the orphaned `TimesheetAdjustmentController` stack (see Decision 1: that backend duplicates two already-live features and should be retired, not wired up).
> **Portal:** **Timekeeping** (`/api/timekeeping/applications/...` routes, `timekeeping/applications` frontend module).
> **Route:** new `timekeeping/applications/adjustments` (`tk_applications_adjustments`) — added as an 8th tile in the existing Applications hub, alongside Change Shift / Logsheet / Overtime / OBT / Leaves / Cancelled Applications / Duty Roster.
> **Conventions:** [project-profile.md](../../rules/project-profile.md), [ui-design.md](../../rules/ui-design.md), [vue-standards.md](../../rules/vue-standards.md), [duplicate-prevention.md](../../rules/duplicate-prevention.md).
> **System Awareness:** Models reused (`AppAdjustment`, `AppChangeShift`, `AppOvertime`, `AppOfficialBusinessTrip`, `AppLeave`, `AccountDetailVW`, `PayPeriod`); Tables reused only (`app_adjustment`, `app_shift`, `app_overtime`, `app_obt`, `app_leave`); Routes: **1 new** (`GET /api/timekeeping/applications/adjustments` + its `/statistics`/`/{id}` siblings, added to the existing `TYPE_MAP`-style dispatcher — no new controller); **orphaned routes to delete**: `/api/timekeeping/nsd`-style `/timesheet-adjustments*` (see Decision 1); New migration: **no**.

---

## 1. Purpose

"Timesheet Adjustment" was requested as a page for Timekeepers to review adjustment-type applications (shift changes, logsheet/biometric corrections, overtime, official business trips, leaves) in one place. The system-awareness scan turned up something important: **a backend for exactly this already exists, but it's an orphan that duplicates two other already-live features** — building a frontend against it as-is would ship a duplicate, uncoordinated write path. Concrete findings:

1. **A `TimesheetAdjustmentController` already exists (`app/Http/Controllers/tk/TimesheetAdjustmentController.php`, routes at `/api/timekeeping/timesheet-adjustments*`) — but it has zero frontend.** The only frontend route that sounds related, `timekeeping/adjustment-processing` (`AdjustmentProcessing.vue`), is a literal placeholder: `<template>test</template>`. Nothing in the frontend calls `/timesheet-adjustments*` anywhere.
2. **Its "submit" and "approve/reject" actions duplicate the Manager portal's own, already-real, already-live Filing-in-Behalf + Approval Requests flow — and are worse.** Verified in code:
   - `SubmitTimesheetAdjustmentHandler::execute()` creates `AppAdjustment`/`AppChangeShift`/`AppOvertime`/`AppOfficialBusinessTrip`/`AppLeave` rows with **hardcoded zero placeholders** (`stime`/`etime` = `'00:00:00'`, `hrs` = `'0'`, no `approvers` list at all).
   - The Manager portal's `MyTeamController::submitFilingOnBehalf()` (`POST /api/manager/myteam/file-behalf`, live, wired to a real page: `manager/myteam/pages/filing_behalf/FilingInBehalf.vue`) creates the **same rows** with real values (real date-range iteration, real default hours like `08:00–17:00`/8 hrs, and — critically — a real **`approvers` JSON column** populated via `ApproverMatrix::getApprovers($employee)`).
   - `ProcessTimesheetAdjustmentHandler::execute()` sets `$record->status = 1|2` directly on these same 5 tables with no awareness of the approver chain at all.
   - `ApprovalRequestController::store()` (`POST /api/manager/approveRequest`, live) does the **same status flip** on the **same 5 tables**, and is the mechanism the org's Approver Matrix actually routes through.
   - **Net effect if `TimesheetAdjustmentController` were ever wired to a frontend:** two independent, uncoordinated code paths could both flip `status` on the same row (a real double-approval/race risk), and a Timekeeper-filed request would carry zero real hours and no approver chain — worse data than the existing flow produces. This is a duplicate-prevention violation, not a gap to fill.
3. **Read-only visibility into these same 5 tables already exists too — twice.** The `timekeeping/applications` module (this same portal) already ships dedicated, real, live report pages per type — Change Shift, Logsheet, Overtime, Official Business Trip, Leaves, and **Cancelled Applications** (a **cross-type union** of all 5 tables, filtered to `cancel_at IS NOT NULL`) — all built on a shared, reusable report harness (`ApplicationReportHeader/Metrics/Filters/Table/DetailsModal` + `useApplicationReport()` composable, `ApplicationsController::TYPE_MAP` dispatch). Payroll also has its own **all-approved-adjustments** report (`payroll/reports/pages/timesheet_adjustment/TimesheetAdjustment.vue`, backed by `GetLogsheetReportQuery` et al.).
4. **The one real gap**: none of the existing pages show **all 5 adjustment types, all statuses (pending + approved + rejected), in one unified table** for Timekeeping. Cancelled Applications does the "union all 5 types" trick, just scoped to cancellations only. That's the actual, non-duplicate feature to build — and this codebase already has the exact pattern to extend for it.

The job here isn't to resurrect the orphaned `TimesheetAdjustmentController` stack — it's to add a genuinely new **"All Adjustments"** tile to the existing `applications` module, built by extending `GetCancelledApplicationsQuery`'s proven union pattern (drop its `cancel_at IS NOT NULL` filter, keep everything else), and to retire the orphan so nobody wires it up later by mistake.

---

## 2. Design Decisions (Pros & Cons)

### Decision: What to do with the orphaned `TimesheetAdjustmentController` stack

**Option A — Delete it; build the unified view as a new tile in the existing `applications` module instead (Recommended)**
- Delete `TimesheetAdjustmentController.php`, `SubmitTimesheetAdjustmentHandler.php`, `ProcessTimesheetAdjustmentHandler.php`, `GetTimesheetAdjustmentsQuery.php`, `GetTimesheetAdjustmentStatisticsQuery.php`, the `/timesheet-adjustments*` routes, and the `timekeeping/adjustment-processing` placeholder route/page.
- Add a new `adjustments` entry to `ApplicationsController::TYPE_MAP`, backed by a new `GetAllApplicationsQuery` (Section 4) modeled directly on `GetCancelledApplicationsQuery`'s union structure.
- New page reuses the shared `ApplicationReportHeader/Metrics/Filters/Table/DetailsModal` + `useApplicationReport()` — the same components `CancelledApplications.vue`, `Logsheet.vue`, etc. already use.

| Pros | Cons |
|---|---|
| Zero duplicate write paths — no submit/approve/reject anywhere on this page, so no collision with Manager's Filing-in-Behalf/Approval Requests | Loses the (already-broken) submit/approve/reject actions the orphaned backend implied — but they never worked correctly and have no frontend today, so nothing real is lost |
| Reuses a proven, already-shipped component + Query pattern (`GetCancelledApplicationsQuery`) almost verbatim — smallest, safest diff per [duplicate-prevention.md](../../rules/duplicate-prevention.md) | Requires a small backend addition (one new Query + one `TYPE_MAP` entry), not purely additive-frontend |
| Removes genuinely dangerous dead code (zero-hour adjustment creation, uncoordinated status writes) before anyone wires it up | — |

**Option B — Keep and complete the orphaned backend as a real, independent Timekeeper-side filing/approval channel**
- Fix `SubmitTimesheetAdjustmentHandler` to collect real times/hours and populate `approvers`; fix `ProcessTimesheetAdjustmentHandler` to coordinate with the Approver Matrix (e.g. only act when `approvers` is empty, or as a distinct "HR final sign-off" stage); build a frontend against it.

| Pros | Cons |
|---|---|
| Gives Timekeepers/HR an independent filing+approval authority, if the org actually wants one outside line-manager approval | Substantial, business-rule-sensitive backend rework (approver-chain coordination), not a UI task; risks real double-processing if the coordination logic has any gap; no evidence in the codebase that this was the intended design (the "in behalf" wording and the identical table/status shape strongly suggest this was meant to be the Manager flow, built twice) |

**Recommendation:** **Option A.** This is not a close call on the technical merits — Option B requires inventing a new approval-authority business rule with no supporting evidence it was wanted, and building it correctly is real work with real risk. If Timekeepers/HR genuinely need to file or approve adjustments independent of the Approver Matrix, that's a deliberate policy decision the user should confirm explicitly — flagging it here rather than assuming either way.

---

### Decision: Where the unified view lives — new tile in `applications`, or a standalone module

**Option A — New tile inside the existing `timekeeping/applications` module (Recommended)**
- `pages/adjustments/AllApplications.vue` (or similar), `pages/adjustments/config/adjustments.config.ts`, registered as an 8th card in `Applications.vue`'s `tkapplication` array and an 8th route in `applications.routes.ts` — exactly like `cancelled_applications` was added.

| Pros | Cons |
|---|---|
| One consistent hub (`Applications.vue`) for all adjustment-type reports; matches the existing IA users already know | — |
| 100% component/composable reuse — no new report harness to build or maintain | — |

**Option B — Stand up a new top-level module (e.g. resurrect `adjustment_processing`)**
- Give it its own module folder, own route outside `/applications/*`.

| Pros | Cons |
|---|---|
| — | Duplicates the entire report harness (`ApplicationReportTable`, filters, pagination, drag-to-scroll, details modal) that already exists and works; fragments the IA (a "Timesheet Adjustment" page living outside the "Applications" hub where every sibling report lives) |

**Recommendation:** **Option A.** There is no technical or UX reason to duplicate the harness; this is the textbook "close match exists, extend it" case from [duplicate-prevention.md](../../rules/duplicate-prevention.md).

---

### Decision: Should this new tile expose any write actions at all (e.g. a quick approve/reject shortcut)?

**Option A — Fully read-only, like every other page in this module (Recommended)**
- Same as `Logsheet.vue`'s own comment: "Read-only Details Modal." No approve/reject buttons anywhere on this page — approval stays exclusively the Manager portal's job (`ApprovalRequestController`/Approval Requests page).

| Pros | Cons |
|---|---|
| Zero chance of the same double-write-path problem the orphaned backend risked | Timekeepers wanting to act on a pending request still have to go to Manager's Approval Requests (a portal-crossing, if Timekeepers even have that access) |

**Option B — Add a "Jump to Approval Requests" link per pending row**
- Same idea as the `daily_monitoring`/`night_differential` specs' "link out, don't duplicate" pattern.

| Pros | Cons |
|---|---|
| Slightly better workflow continuity | Only useful if Timekeepers actually have Manager-portal access to that page — a portal-access question, not this spec's call |

**Recommendation:** **Option A** for the base build; **Option B** is a cheap, safe addition worth doing if Timekeepers do have Approval Requests access — flagging as a small optional add-on, not a blocker.

---

## 3. Database

No new tables/columns — 100% reused, with live row counts verified:

| Table | Model | Row count (verified) | Role |
|---|---|---|---|
| `app_adjustment` | `AppAdjustment` | **316** (all `status=1`, none pending/rejected currently) | "Logsheet"-type filings (biometric/punch corrections) |
| `app_shift` | `AppChangeShift` | **1,653** | "Change Shift" filings |
| `app_overtime` | `AppOvertime` | **728** | "Overtime" filings |
| `app_obt` | `AppOfficialBusinessTrip` | **308** | "Official Business Trip" filings |
| `app_leave` | `AppLeave` | **631** | "Leaves" filings |
| `vw_accounts_details` | `AccountDetailVW` | — | Employee join (name, empid, unit, position) — already the standard join, used by every sibling query in this module |
| `payroll_period` | `PayPeriod` | — | Pay-period label join, already used by `GetCancelledApplicationsQuery` |

All 5 tables share the same real shape confirmed in code: `id`, `docnumber`, `idacct`, `date`, `remarks`, `status` (0=Pending, 1=Approved, 2=Disapproved), `date_approve`, `cancel_at`/`cancel_reason`/`cancelby`, `approvers` (JSON, confirmed present on all 5 via `Schema::hasColumn`), `idpayperiod`, timestamps. This is exactly the shape `GetCancelledApplicationsQuery` and `GetApplicationStatisticsQuery` already normalize across.

---

## 4. Backend

**One new Query, one new `TYPE_MAP` entry — no new controller, no new routes file.**

- **`App\Queries\Timesheet\GetAllApplicationsQuery`** (new, same domain folder as its siblings) — copy `GetCancelledApplicationsQuery`'s exact union structure (5 subqueries over `app_leave`/`app_adjustment`/`app_obt`/`app_overtime`/`app_shift`, each tagging `application_type`/`application_type_label`, joined to `vw_accounts_details` + `payroll_period`), but **without** the `whereNotNull('cancel_at')` filter on each subquery — this version shows every filing regardless of status. Support the same `search`/`department`/`pay_period`/`extra_filter` (per-type) params, plus a `status` filter (0/1/2) since — unlike Cancelled Applications, which is single-status by definition — this view spans all three statuses. Return the same `{data, total, page, per_page}` shape.
- **`ApplicationsController::TYPE_MAP`** — add `'adjustments' => GetAllApplicationsQuery::class` (and an alias `'all' => GetAllApplicationsQuery::class` if a shorter URL segment is preferred — match whichever convention feels more consistent with the existing `'obt'`/`'official_business_trip'` dual-alias pattern already in the map).
- **`GetApplicationStatisticsQuery::execute($type, $params)`** — add an `elseif ($type === 'adjustments')` branch mirroring the existing `'cancelled'` branch's union-count structure, but computing real `pending`/`approved`/`disapproved` counts across all 5 tables combined (via `status` instead of `cancel_at`) rather than reusing per-table counts as mismatched field labels (avoid copying the `'cancelled'` branch's slightly confusing `pending`→leaves-count/`approved`→logsheet-count mapping; give this branch real semantics since a unified pending/approved/disapproved breakdown is exactly what this page needs).
- **`GetApplicationDetailQuery::execute($type, $id)`** — add an `'adjustments'` case; since row `id`s are only unique per source table, the frontend's `docPrefix`-style unique ID (see Section 5) needs a matching resolution step here, mirroring however `show()` already disambiguates `'cancelled'` cross-type IDs (check its existing `$type === 'cancelled'` branch for the exact resolution pattern and mirror it, rather than inventing a new one).
- **Delete**: `TimesheetAdjustmentController.php`, `SubmitTimesheetAdjustmentHandler.php`, `ProcessTimesheetAdjustmentHandler.php`, `GetTimesheetAdjustmentsQuery.php`, `GetTimesheetAdjustmentStatisticsQuery.php`; remove the `/timesheet-adjustments*` route block and its controller `use` import from `routes/api/timekeeping.php`; remove the `timekeeping/adjustment-processing` route entry and delete `AdjustmentProcessing.vue` (the `<template>test</template>` stub).

---

## 5. Frontend

New tile inside the existing module — folder layout matches every sibling page exactly:

```
module/timekeeping/applications/
├─ pages/
│  ├─ adjustments/                              (NEW)
│  │  ├─ AllApplications.vue                    — thin page, identical shape to Logsheet.vue
│  │  ├─ index.ts                               — barrel: export { default as AllApplications } from './AllApplications.vue'; export * from './config/adjustments.config';
│  │  └─ config/
│  │     └─ adjustments.config.ts               — ReportConfig, modeled on cancelled.config.ts
│  └─ ...(existing: change_shift, logsheet, overtime, official_business_trip, leaves, cancelled_applications, duty_roster — untouched)
├─ shared/                                       (untouched — reused as-is)
│  ├─ composables/useApplicationReport.ts
│  ├─ components/{ApplicationReportHeader,ApplicationReportMetrics,ApplicationReportFilters,ApplicationReportTable,ApplicationDetailsModal}.vue
│  ├─ api/applications.api.ts
│  └─ types/types.applications.ts               — add 'adjustments' to the ReportType union
├─ route/applications.routes.ts                  — add the 8th route entry
└─ pages/Applications.vue                        — add the 8th tile to the `tkapplication` array
```

- **`adjustments.config.ts`**: `type: 'adjustments'`, `docPrefix: 'ADJ'` (or per-type prefixes handled the same way `GetAllApplicationsQuery` tags rows), `title: 'All Timesheet Adjustments'`, description along the lines of "Unified audit view of every shift, logsheet, overtime, OBT, and leave adjustment filed across the organization." `extraFilterKey: 'application_type'` with the same 5 category options `cancelled.config.ts` already defines (reuse that exact options array shape). Columns: `docnumber`, `application_type` (category badge), `employee` (fullname/empid via the shared `format` pattern), `date`, `remarks`, `status` (badge, using `StatusBadge` global component per the existing `ApplicationReportTable`'s convention), `submitted_at`/`created_at`, `actions` (Details only).
- **`AllApplications.vue`**: identical shape to `Logsheet.vue` — `useApplicationReport(adjustmentsConfig)`, renders `ApplicationReportHeader/Metrics/Filters/Table` + `ApplicationDetailsModal`. No new component code beyond the config file and this thin page — everything else is reuse.
- **`Applications.vue`**: add an 8th card to the `tkapplication` array (`name: 'All Adjustments'`, `path: '/timekeeping/applications/adjustments'`, category e.g. `'shifts_logs'` or a new `'all'` category — user's call on categorization) and bump the "Total Applications" stat card from "7 Modules" to "8 Modules".
- **`applications.routes.ts`**: add the route entry (`path: 'timekeeping/applications/adjustments'`, `name: 'tk_applications_adjustments'`).
- **`types.applications.ts`**: extend `ReportType` to include `'adjustments'`.
- **Delete**: `route/adjustment_processing.routes.ts`, `pages/AdjustmentProcessing.vue`, `index.ts` under `module/timekeeping/adjustment_processing/` (the whole orphaned module folder).

No native `<select>`/pagination/drag-to-scroll gaps to fix here — `ApplicationReportTable`/`ApplicationReportFilters` already implement all of it (CSelect-based filters, drag-to-scroll, `Pagination` global component) for every sibling page, and the new tile inherits that for free by construction.

---

## 6. Business Rules & Edge Cases

| Case | Handling |
|---|---|
| Same `id` value exists in two different source tables (e.g. `app_adjustment.id=12` and `app_overtime.id=12`) | Not a real collision for display — `application_type` disambiguates the row; but the Details modal's lookup-by-id (`GetApplicationDetailQuery`) must resolve using **both** `type` and `id` together, exactly as the existing `'cancelled'` type already has to (mirror its resolution, don't invent a new one). |
| A request is `status=0` (pending) and appears in this unified view | Purely informational here — no approve/reject action on this page (Decision 3). If the org wants a quick jump to Approval Requests, that's the optional Decision 3 Option B add-on. |
| `extra_filter` = a single category (e.g. `'overtime'`) | `GetAllApplicationsQuery` should short-circuit to a single-table query in that case (no union needed) — mirroring `GetCancelledApplicationsQuery`'s existing `if ($category && $category !== 'all')` branch exactly. |
| Employee record missing from `vw_accounts_details` (orphaned `idacct`) | Same fallback every sibling query already uses: `empid ?: 'EMP-{idacct}'`, `fullname ?: 'Unknown Employee'`. |
| Mobile / narrow viewport | Inherited for free from `ApplicationReportTable`/`Filters` — no new breakpoints needed. |

---

## 7. Build Order

1. Add `GetAllApplicationsQuery` (`App\Queries\Timesheet`), modeled on `GetCancelledApplicationsQuery` minus the `cancel_at` filter, plus a `status` param.
2. Add the `'adjustments'` branch to `GetApplicationStatisticsQuery` and the `'adjustments'` case to `GetApplicationDetailQuery`; add the `TYPE_MAP` entry in `ApplicationsController`.
3. Delete the orphaned backend: `TimesheetAdjustmentController.php`, `SubmitTimesheetAdjustmentHandler.php`, `ProcessTimesheetAdjustmentHandler.php`, `GetTimesheetAdjustmentsQuery.php`, `GetTimesheetAdjustmentStatisticsQuery.php`, the `/timesheet-adjustments*` route block + `use` import in `routes/api/timekeeping.php`.
4. Delete the orphaned frontend: `module/timekeeping/adjustment_processing/` (whole folder) and its route entry.
5. Add `pages/adjustments/config/adjustments.config.ts` + `AllApplications.vue` + `index.ts` barrel, following `cancelled_applications`'s file-for-file shape.
6. Extend `ReportType` in `types.applications.ts`; add the route in `applications.routes.ts`; add the 8th tile to `Applications.vue`.
7. Manual pass in-browser: verify the new tile's table/filters/pagination/details modal in both themes; verify `grep -r "timesheet-adjustments\|TimesheetAdjustmentController\|adjustment_processing"` across the repo returns nothing once cleanup is done.

---

## 8. Out of Scope (Future Specs)

- Any approve/reject action on the new unified view (Decision 3) — approval stays Manager portal's job; a "jump to Approval Requests" link is a cheap optional follow-up, not required here.
- Turning the orphaned backend into a real, coordinated second approval channel (Decision 1, Option B) — only pursue if the user explicitly confirms Timekeeping/HR needs independent filing+approval authority outside the Approver Matrix; would need its own spec covering the coordination logic.
- Any change to the Manager portal's Filing-in-Behalf or Approval Requests flows, or to the existing per-type Applications pages (Change Shift/Logsheet/Overtime/OBT/Leaves/Cancelled/Duty Roster) — all treated as stable, correct, untouched dependencies.
