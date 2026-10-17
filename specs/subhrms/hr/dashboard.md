# Spec — HR Dashboard Modernization

> **Kind:** Extension — the `hr/dashboard` module already exists but is a **dummy/mock design**: every widget lives flat in `pages/` (not `components/`), `dashboard.api.ts` returns hard-coded fixtures ("David Kim", "Lisa Park", a hand-written Jan–Dec headcount series), and there is **no backend endpoint at all** (`grep routes/api/hr.php` — no `dashboard` route; no controller, no Query class). This spec redesigns the HR Dashboard to match the modern layout language and live-data pattern already shipped on the **Employee**, **Timekeeping**, and **Payroll** dashboards (`.agents/specs/subhrms/employee/dashboard.md`, `timekeeping/timekeeping_dashboard.md`, `payroll/payroll_dashboard.md`) — component folder, unified skeleton, status/alert banners, single aggregation query — while grounding every metric in tables that already exist.
> **Portal:** **HR** (`/api/hr/...` routes, `hr/dashboard` frontend module).
> **Version:** v1 — 2026-08-21 — initial
> **Route:** `hr/dashboard` (`hr_dashboard`) — reused, unchanged.
> **Conventions:** [project-gate.md](../../../rules/core/project-gate.md), [payroll.md](../../../rules/conditional/payroll.md), [ui-design.md](../../../rules/conditional/ui-design.md), [frontend-vue.md](../../../rules/conditional/frontend-vue.md), [system-awareness.md](../../../rules/conditional/system-awareness.md).
> **System Awareness:**
> - **Models Reused:** `Unit`, `EmployeeMasterlist` (`vw_accounts_details`), `Account`, `AppLeave`, `Leave`, `ActivityorEvents`, `TransLog`, `Position`. **Models Created:** none.
> - **Tables Reused:** `units`, `vw_accounts_details`, `accounts`, `app_leave`, `leaves`, `activity_event`, `translog`, `positions`. **Tables Created:** none.
> - **Queries Reused (composed, not rewritten):** `GetDailyMonitoringDashboardQuery` (company-wide `checkedInRate`), `ActivityorEvents::getActorEvents()` (the Company Events feature already on this branch). **Queries Created:** one new `App\Queries\Hr\GetHrDashboardQuery` that composes the above and adds headcount/department/leave aggregation not covered by any existing query.
> - **Routes Created:** `GET /api/hr/dashboard/summary`. **Routes Reused (cross-portal, no new backend code):** `POST /api/manager/approval-requests` for leave approve/decline (see Decision 5).
> - **New Migration Needed:** No — every metric is derived from existing tables/views.

---

## 1. Purpose

The HR Dashboard is the landing page of the HR portal. Today it *looks* finished but is entirely fictional: `useDashboardApi().getDashboardSummary()` in [dashboard.api.ts](../../../resources/views/web/src/module/hr/dashboard/api/dashboard.api.ts) returns a literal object, `approveLeave()`/`declineLeave()` return `{ success: true }` without touching the server, and the widgets live in `pages/` as flat siblings of `Dashboard.vue` instead of a `components/` folder — the layout an HR officer sees ("naa naman siya dashboard design pero dili pa na siya mao na display" — *there's already a dashboard design, but that's not what should actually be shown*) does not reflect the componentized, skeleton-gated, alert-aware pattern already shipped on the three sibling portal dashboards.

This spec defines the **redesign + live rebuild**: adopt the same layout language (breadcrumb, unified `DashboardSkeleton`, `components/` folder, portal-colored WelcomeBanner, an urgent-alerts banner, a launchpad-style Quick Actions grid) and drive every widget from real tables that already exist — including the **Company Events** feature (`activity_event` table) being built on this very branch, which becomes the real data source for "Upcoming Events" instead of a mock list.

---

## 2. Design Decisions (Pros & Cons)

### Decision 1: Backend Aggregation Pattern

**Option A — Unified `GetHrDashboardQuery` that composes existing queries where they exist (Recommended)**
- One new `App\Queries\Hr\GetHrDashboardQuery::execute()` builds headcount, department, and pending-leave data directly (no existing query covers these), but for attendance it **calls `GetDailyMonitoringDashboardQuery::execute()`** rather than re-deriving `checkedInRate`, and for events it **calls `ActivityorEvents::getActorEvents()`** rather than writing new event-listing SQL.

| Pros | Cons |
|---|---|
| Single HTTP round-trip; matches the shipped `GetPayrollDashboardQuery` / `GetTimekeepingDashboardQuery` precedent. | Inherits the cost of the composed queries (acceptable — both are already tuned for their own dashboards). |
| Attendance number can never drift from what Timekeeping's Daily Monitoring shows — same query, same result. | — |
| Zero duplicated SQL for attendance-rate or event-listing logic (the reuse rule in [system-awareness.md](../../../rules/conditional/system-awareness.md)). | — |

**Option B — Multi-endpoint per-widget fetching**
- Frontend calls `/hr/dashboard/headcount`, `/hr/dashboard/leaves`, the existing `/timekeeping/daily-monitoring/dashboard`, and `activity_event`'s own endpoint directly.

| Pros | Cons |
|---|---|
| Independent per-widget skeletons. | 4+ round trips; widgets can snapshot at different instants. |

**Recommendation:** Option A — one request, one consistent snapshot, matches all three sibling dashboards.

---

### Decision 2: "Open Positions" KPI — no vacancy/requisition table exists

The current mock KPI card "Open Positions" has **no backing table**. `positions` (`Position` model) has only `unitid`, `name`, `status` — an active/inactive job-title catalog, not a vacancy count with a target headcount. There is no `Recruitment`/`JobPosting`/`Vacancy` model anywhere in `app/Models/`. This is a genuine business-policy call, not a technical default.

**Option A — Rename to "Active Position Slots", backed by `positions.status = 1` count (Recommended)**
- Reframes the card honestly: count of active job-title slots defined in the org structure, grouped by unit for the Department Snapshot's "openRoles" column.

| Pros | Cons |
|---|---|
| Real, queryable data; no schema change. | Not the same concept as "unfilled vacancy" — an HR officer could misread it as a hiring-need count. |
| Keeps the 4-card KPI row visually consistent with the other three dashboards. | — |

**Option B — Drop the KPI entirely (3 cards) until a Recruitment module exists**
| Pros | Cons |
|---|---|
| No risk of a misleading number. | Breaks the 4-card grid parity with Payroll/Timekeeping/Employee; loses a metric HR explicitly asked to see. |

**Option C — New `position_target_headcount` column + admin-entered vacancy target**
| Pros | Cons |
|---|---|
| Gives a true "vacant seats" number. | Requires a new migration and a settings UI — out of scope for a UI redesign spec; belongs in a future Recruitment spec. |

**Recommendation:** Option A for this spec; flag to the user that a real "vacancy" concept is future work (see §8).

---

### Decision 3: HR Alerts / Operational Status Banner

Every sibling dashboard has a portal-specific "what needs attention right now" surface (`ComplianceAlertsBanner` for Payroll, `CutoffStatusCard` + `UrgentAlerts` for Timekeeping). The HR dashboard has no equivalent today — only the WelcomeBanner's single amber badge.

**Option A — "HR Action Alerts" banner, 3 conditional cards (Recommended)**
- Leave requests pending review for more than 3 business days (`app_leave.status = 0` and `created_at` older than 3 business days).
- Employees whose `vw_accounts_details.regular_date` (regularization date) falls within the next 7 days, needing a probation-end evaluation.
- Company Events (`activity_event.start_date`) starting within 48 hours, needing prep/announcement follow-up.

| Pros | Cons |
|---|---|
| All three are backed by columns that already exist — no invented data. | Business-day math for the 3-day leave threshold needs care around weekends/holidays. |
| Matches the "urgent surfacing" pattern HR officers already see for Payroll/Timekeeping. | One more card grid to build and test. |

**Option B — No dedicated banner; keep only the existing amber WelcomeBanner badge**
| Pros | Cons |
|---|---|
| Zero new component. | Leaves HR dashboard visually behind its three siblings — the exact gap this spec exists to close. |

**Recommendation:** Option A.

---

### Decision 4: Quick Actions Interaction Pattern

HR's real destinations from this dashboard are few (~5–6): Employees, Recruitment/Company Profile, Company Events, Leave/Pending Approvals, Org Structure, Payroll hand-off.

**Option A — Static vertical card list (current, restyled only)**
| Pros | Cons |
|---|---|
| Lowest diff. | Visually the most dated of the four dashboards once the rest is modernized. |

**Option B — `QuickActionHub` searchable + category pills (Payroll style)**
| Pros | Cons |
|---|---|
| Scales well if HR gains many sub-modules later. | Search/category chrome is overkill for ~6 destinations — empty-feeling UI. |

**Option C — Tile-grid launchpad, no search (Employee style) (Recommended)**
- A compact 2×N icon-tile grid (`QuickActionsLaunchpad.vue`), each tile an icon + label + optional badge count (e.g. pending leaves).

| Pros | Cons |
|---|---|
| Visual parity with the modern reference dashboards without over-building for a small action count. | Needs a redesign of all 4 action tiles' icon/badge treatment. |

**Recommendation:** Option C.

---

### Decision 5: Component Folder Reorganization, Skeleton Loading & Leave Approve/Decline Wiring

**Option A — Full parity with the shipped module convention (Recommended)**
- Move every widget out of `pages/` into `components/`; `pages/Dashboard.vue` becomes a page shell only.
- Add a unified `DashboardSkeleton.vue`, gate the whole page behind `v-if="isLoading" / v-else` (matches Payroll/Timekeeping/Employee) instead of today's per-widget `:loading` prop, which pops each card in independently and flashes the mock defaults before the real fetch resolves.
- For leave approve/decline, **reuse the existing `POST /api/manager/approval-requests`** (`App\Http\Controllers\manager\ApprovalRequestController::store`) with `{ data: [{ alias: 'leave', id, count: 1 }] }` to approve or `{ data: [{ alias: 'leave', id }], status: 2, cancel_reason }` to decline — this is the same endpoint the Manager Approval Center already uses, so approver-stamping and status semantics never drift between the two portals. `routes/api.php` gates every portal with the identical `auth:sanctum` middleware only (no per-portal role middleware exists today), so calling this endpoint from the HR frontend module introduces no new authorization surface beyond what already exists.

| Pros | Cons |
|---|---|
| Zero new backend code for approve/decline; matches the reuse rule. | HR dashboard's frontend module now has a cross-portal dependency on `manager/dashboard`'s API namespace — document this clearly so it isn't "duplicated" by mistake later. |
| One coordinated skeleton reveal instead of 6 independent pulse-loaders. | Slightly larger `Dashboard.vue` reshuffle diff (moving files, not rewriting logic). |

**Option B — Keep `pages/` flat structure, per-widget skeletons, and write a new HR-specific approve/decline controller**
| Pros | Cons |
|---|---|
| No cross-portal API dependency. | Duplicates the exact status-flip logic already in `ApprovalRequestController::store`; violates [system-awareness.md](../../../rules/conditional/system-awareness.md); leaves the "not modern" gap the user asked to close. |

**Recommendation:** Option A.

---

## 2.5 Acceptance Criteria

| # | Given | When | Then |
|---|-------|------|------|
| AC-1 | The redesigned module | a developer inspects `resources/views/web/src/module/hr/dashboard/` | every widget file (`KpiCards.vue`, `HeadcountChart.vue`, `DepartmentSnapshot.vue`, `PendingLeaves.vue`, `RecentActivity.vue`, `UpcomingEvents.vue`, `QuickActionsLaunchpad.vue`, `HrAlertsBanner.vue`, `DashboardSkeleton.vue`) lives under `components/`, and `pages/Dashboard.vue` contains only the header, breadcrumb, skeleton gate, and section wiring. |
| AC-2 | `useHrDashboard()` composable | the page mounts and `fetchDashboard()` has not yet resolved | `isLoading === true` and `DashboardSkeleton` is the only element rendered inside `<main>` — no widget with mock defaults is visible. |
| AC-3 | `fetchDashboard()` resolves successfully | the response arrives | `isLoading === false`, `DashboardSkeleton` unmounts, and the full widget tree renders in one paint (no staggered per-widget pop-in). |
| AC-4 | The page header | rendered at any viewport | a breadcrumb `HR / Dashboard` is present, matching the pattern in Payroll's and Timekeeping's `Dashboard.vue`. |
| AC-5 | `GetHrDashboardQuery::execute()` | at least one `app_leave` row has `status = 0` and `created_at` more than 3 business days ago | the response's `alerts.overdueLeaveCount` is `> 0` and `HrAlertsBanner` renders the "Leave Requests Awaiting Review" card with that count. |
| AC-6 | `GetHrDashboardQuery::execute()` | zero `app_leave` rows qualify for any of the 3 alert conditions in Decision 3 | `alerts.hasAlerts === false` and `HrAlertsBanner` renders nothing (no empty card, no placeholder). |
| AC-7 | `QuickActionsLaunchpad` | the "Review Leave Requests" tile is rendered and `pendingLeaveCount > 0` | the tile shows a numeric badge equal to `pendingLeaveCount`; when `pendingLeaveCount === 0` the badge is absent. |
| AC-8 | The 2-column main grid | viewport width `>= 1280px` (`xl:` breakpoint) | left column occupies 2 of 3 grid tracks (chart, pending leaves, recent activity) and right column occupies 1 of 3 (quick actions, department snapshot, upcoming events) — matching the reference dashboards' `xl:grid-cols-3` layout. |
| AC-9 | The same grid | viewport width `< 768px` | both columns stack into a single column in document order. |
| AC-10 | The refresh button | user clicks "Refresh" | the button is disabled and its icon gets `animate-spin` for the duration of the request; on success a `toast.success('Dashboard data refreshed.')` fires; the button re-enables afterward. |
| AC-11 | `PendingLeaves` "Approve" action | user confirms the browser `confirm()` dialog for a given leave id | the frontend calls `POST /api/manager/approval-requests` with `{ data: [{ alias: 'leave', id, count: 1 }] }`; on `{success:true}`-shaped result the row is removed from `pendingLeaves` and `toast.success` fires with the employee's name. |
| AC-12 | `PendingLeaves` "Decline" action | user confirms the decline dialog | the frontend calls the same endpoint with `{ data: [{ alias: 'leave', id }], status: 2, cancel_reason }`; on success the row is removed and `toast.warning` fires. |
| AC-13 | The approve/decline buttons for a single row | a request for that row's id is already in flight | both buttons for that specific row are disabled until the in-flight request settles (no double-submit of the same leave id). |
| AC-14 | KPI card "Active Position Slots" (replacing "Open Positions") | `positions` has 0 rows with `status = 1` for the company | the card renders `0`, not a blank, `NaN`, or a crash. |
| AC-15 | `DepartmentSnapshot` | `units` table has zero rows (edge case, e.g. a freshly seeded environment) | the widget renders an `EmptyState` ("No departments configured") instead of an empty list or a `Math.max(...[])` `-Infinity` crash. |
| AC-16 | `HeadcountChart` | the computed monthly headcount series has fewer than 2 data points | the chart renders an empty/placeholder state instead of dividing by a zero-width range. |
| AC-17 | `UpcomingEvents` | `activity_event` (Company Events) has zero upcoming rows (`start_date >= today`) | the widget renders an `EmptyState`, and does **not** fall back to the old mock event list. |
| AC-18 | `RecentActivity` | `translog.module` is filtered to `TransLog::MODULE_HR_ACCESS` / `MODULE_LEAVE_RECORDS` | only rows with those module values appear — no payroll/timekeeping activity leaks into the HR feed. |
| AC-19 | **Authorization** | any authenticated account (not just HR-portal users) calls `GET /api/hr/dashboard/summary` | the request succeeds (`200`), because — as verified in `routes/api.php` — every portal is gated only by `auth:sanctum` with no per-portal role middleware; portal boundary is enforced by frontend menu/router visibility only. This is documented, not silently assumed. |
| AC-20 | **Concurrency** | two browser tabs both click "Approve" on the same leave id at nearly the same time | the second request's `AppLeave::find($id)` still succeeds (Eloquent `save()` is last-write-wins, no DB-level lock exists today), so both responses report `success`, but the row's final `status` reflects whichever write landed last — documented as a known race, not a claimed guarantee (see §6.2). |
| AC-21 | **Idempotency** | the approve request for a given leave id is retried (e.g. network retry) after it already succeeded | the second call sets `status = 1` and `date_approve = now()` again (a harmless no-op overwrite) — it does not create a duplicate leave record or double-deduct any leave ledger balance, because the endpoint only ever updates the single existing row by primary key. |
| AC-22 | **Error response shape** | `GetHrDashboardQuery::execute()` throws (e.g. malformed date param) | `HrDashboardController::getSummary` catches it and returns `response()->json(['message' => $e->getMessage()], 400)` — mirroring `PayrollDashboardController`'s existing contract. |
| AC-23 | **Input validation boundaries** | the dashboard summary endpoint is called with no query params | it does not require any — `GetHrDashboardQuery::execute($params = [])` defaults every optional filter and never throws for an empty `$params` array. |

---

## 3. Database

No new tables or columns. All data is aggregated from existing tables:

| Table | Usage / Aggregated Columns | Filter / Condition |
|---|---|---|
| `vw_accounts_details` (`EmployeeMasterlist`) | `id`, `status`, `unitid`, `hire_date`, `separation_date` | `status = 1` for active headcount; `hire_date` grouped by month for the headcount trend |
| `units` | `id`, `name`, `status` | `status = 1`; left-joined to `vw_accounts_details` for per-department headcount |
| `positions` | `id`, `unitid`, `status` | `status = 1` → "Active Position Slots" KPI (Decision 2) |
| `app_leave` | `id`, `idacct`, `idleave`, `date`, `hrs`, `days`, `status`, `created_at`, `date_approve` | `status = 0` (pending) for the Pending Leaves widget and the overdue-leave alert |
| `leaves` | `type`, `alias`, `color` | joined via `app_leave.idleave` for the leave-type label/badge |
| `activity_event` (`ActivityorEvents`) | `title`, `start_date`, `end_date`, `location`, `time_start` | `start_date >= today`, reused via `ActivityorEvents::getActorEvents()` |
| `translog` | `module`, `action`, `description`, `created_at`, `idacct` | `module IN (TransLog::MODULE_HR_ACCESS, TransLog::MODULE_LEAVE_RECORDS)` |

---

## 4. Backend

### 4.1 Query Class

**`App\Queries\Hr\GetHrDashboardQuery`** — `app/Queries/Hr/GetHrDashboardQuery.php`, extends `App\Queries\Query`, `public static function execute($params = []): array`.

1. **Headcount & KPIs:** count of `vw_accounts_details` where `status = 1`; count of `positions` where `status = 1` ("Active Position Slots"); pending leave count from `app_leave` where `status = 0`; attendance rate via `GetDailyMonitoringDashboardQuery::execute()['present']`/`checkedInRate` (composed, not re-derived).
2. **Headcount trend:** monthly net headcount for the last 12 months, walking `hire_date` (+1) and `separation_date` (−1) per month against the current active count.
3. **Department snapshot:** `units` left-joined to `vw_accounts_details` (headcount) and `positions` (active slots), grouped by `units.id`.
4. **Pending leaves:** `app_leave` where `status = 0`, joined to `vw_accounts_details` (employee name/department) and `leaves` (type label), ordered by `date` ascending, limited to the most urgent N.
5. **Alerts (Decision 3):** overdue-leave count (business-day math), upcoming regularization count (`regular_date` within 7 days), upcoming-event count (`activity_event.start_date` within 48h).
6. **Upcoming events:** `ActivityorEvents::getActorEvents(['entries' => 5])` (reused as-is).
7. **Recent activity:** latest 8 `translog` rows filtered to HR-relevant `module` constants, joined to `vw_accounts_details` for the actor's name.

### 4.2 Controller

```php
namespace App\Http\Controllers\hr;

use App\Http\Controllers\Controller;
use App\Queries\Hr\GetHrDashboardQuery;
use Illuminate\Http\Request;
use Exception;

class HrDashboardController extends Controller
{
    public function getSummary(Request $request)
    {
        try {
            $data = GetHrDashboardQuery::execute($request->all());
            return response()->json($data);
        } catch (Exception $e) {
            return response()->json(['message' => $e->getMessage()], 400);
        }
    }
}
```

### 4.3 Route Registration

In `routes/api/hr.php`:

```php
use App\Http\Controllers\hr\HrDashboardController;

Route::get('/dashboard/summary', [HrDashboardController::class, 'getSummary']);
```

### 4.4 Leave Approve / Decline

**No new backend code.** The frontend calls the existing `POST /api/manager/approval-requests` (`App\Http\Controllers\manager\ApprovalRequestController::store`) exactly as the Manager Approval Center does — see Decision 5.

---

## 5. Frontend

### 5.1 Module Structure

```
resources/views/web/src/module/hr/dashboard/
├── index.ts
├── route/
│   └── dashboard.routes.ts            # unchanged: hr/dashboard, hr_dashboard
├── api/
│   └── dashboard.api.ts               # getDashboardSummary() → GET /hr/dashboard/summary
│                                       # approveLeave()/declineLeave() → POST /manager/approval-requests
├── composables/
│   └── useDashboard.ts                # isLoading gate, alerts state
├── pages/
│   └── Dashboard.vue                  # page shell only: breadcrumb, header, skeleton gate, grid
├── components/
│   ├── DashboardSkeleton.vue          # NEW — unified loading gate
│   ├── HrAlertsBanner.vue             # NEW — Decision 3
│   ├── KpiCards.vue                   # moved from pages/, "Open Positions" → "Active Position Slots"
│   ├── HeadcountChart.vue             # moved from pages/
│   ├── DepartmentSnapshot.vue         # moved from pages/, adds EmptyState for 0 departments
│   ├── PendingLeaves.vue              # moved from pages/, per-row in-flight disable (AC-13)
│   ├── RecentActivity.vue             # moved from pages/
│   ├── UpcomingEvents.vue             # moved from pages/, sourced from activity_event
│   └── QuickActionsLaunchpad.vue      # renamed/restyled from QuickActions.vue, Decision 4
└── types/
    └── types.dashboard.ts             # add AlertsSummary, extend DashboardMetrics
```

### 5.2 Key Type Additions (`types/types.dashboard.ts`)

```typescript
export interface AlertsSummary {
  hasAlerts: boolean;
  overdueLeaveCount: number;
  upcomingRegularizationCount: number;
  upcomingEventCount: number;
}

export interface DashboardMetrics {
  totalEmployees: number;
  activePositionSlots: number;   // replaces openPositions
  pendingLeaves: number;
  attendanceRate: number;
}
```

### 5.3 Page Layout Sketch

```
+-------------------------------------------------------------------------------+
| Breadcrumb: HR / Dashboard                                                    |
| Header: HR Dashboard                    [ Last updated: 09:42 AM ] [Refresh]  |
+-------------------------------------------------------------------------------+
| WelcomeBanner (portal="hr")                                                   |
+-------------------------------------------------------------------------------+
| HrAlertsBanner (only if hasAlerts): Overdue Leaves | Regularizations | Events |
+-------------------------------------------------------------------------------+
|                        KPI CARDS (4: Employees / Slots / Leaves / Attendance) |
+-------------------------------------------------------------------------------+
| LEFT (2/3, xl:col-span-2)                  | RIGHT (1/3)                     |
| - Headcount Trend Chart                    | - Quick Actions Launchpad       |
| - Pending Leaves (approve/decline)         | - Department Snapshot           |
| - Recent Activity                          | - Upcoming Events (Company Events)|
+-------------------------------------------------------------------------------+
```

---

## 6. Business Rules & Edge Cases

### 6.1 HRMS Domain Rules
1. **Active headcount** counts only `vw_accounts_details.status = 1`; separated employees (`separation_date` set) are excluded from the current total but still counted in the month they separated for the headcount trend.
2. **"Active Position Slots" is not "vacancies"** — the KPI and its tooltip must say "active position slots defined in org structure," never "open roles," to avoid implying a real recruitment pipeline that does not exist yet (Decision 2).
3. **Overdue-leave threshold** (Decision 3) uses business days (Mon–Fri, excluding rows in `holidays`), not calendar days, so a Friday-submitted leave isn't flagged "overdue" by Monday morning.

### 6.2 Edge Cases & Handling

| Edge Case | Potential Issue | Handling Strategy |
|---|---|---|
| No `units` rows configured | `DepartmentSnapshot` crashes on `Math.max(...[])` | Render `EmptyState` ("No departments configured") — see AC-15. |
| `positions` has 0 active rows | KPI shows blank/NaN | Render `0` explicitly — see AC-14. |
| Concurrent approve on the same leave id from two sessions | Last write silently wins, no conflict surfaced | Documented known limitation (AC-20) inherited from the reused `ApprovalRequestController::store`; not solved by this spec since fixing it means changing shared Manager-portal code, which is out of scope here. |
| `GetDailyMonitoringDashboardQuery` throws (e.g. no shift data) | Attendance KPI card breaks the whole dashboard | `GetHrDashboardQuery` wraps the composed call in try/catch and falls back to `attendanceRate: null` → KPI card shows "—" instead of propagating the exception. |
| `activity_event` has zero upcoming rows | UpcomingEvents renders empty/broken | `EmptyState` — see AC-17. |

### 6.3 Non-Functional & Failure-Mode Checklist

| Category | Answer |
|---|---|
| **Authorization** | Every portal (`hr`, `manager`, `payroll`, `timekeeping`, `employee`, `admin`) shares one `auth:sanctum` gate in `routes/api.php` — there is no per-portal role middleware today. `GET /api/hr/dashboard/summary` and the reused `POST /api/manager/approval-requests` are both reachable by any authenticated account; the portal boundary is enforced only by frontend sidebar/router visibility. This spec does not add new authorization surface, but it also does not close this pre-existing gap — see AC-19. |
| **Concurrency / double-submit** | Per-row buttons in `PendingLeaves` disable while that row's request is in flight (AC-13), preventing a double-click from firing two requests for the same id. Cross-session concurrent approval of the same leave id is a pre-existing race in the reused endpoint (AC-20) — not solved here. |
| **Idempotency on retries** | The approve/decline endpoint only updates one existing row by primary key (`AppLeave::find($id)->save()`) — a retried request re-applies the same status/timestamp, no duplicate record is ever created (AC-21). |
| **Error response shape & status codes** | Success: `200` with the full `DashboardSummary` JSON envelope. Query failure: `400` with `{"message": "<exception message>"}` (AC-22), matching `PayrollDashboardController`'s existing contract. |
| **Input validation boundaries** | `GetHrDashboardQuery::execute($params = [])` requires no params and must not throw on an empty array (AC-23). `positions`/`units` with 0 rows render explicit `0`/`EmptyState`, never `NaN` or a crash (AC-14, AC-15). |

---

## 7. Build Order

1. **Backend Query & Controller:**
   - Create `App\Queries\Hr\GetHrDashboardQuery` in `app/Queries/Hr/GetHrDashboardQuery.php`, composing `GetDailyMonitoringDashboardQuery` and `ActivityorEvents::getActorEvents()`.
   - Create `App\Http\Controllers\hr\HrDashboardController::getSummary`.
   - Register `GET /dashboard/summary` in `routes/api/hr.php`.
2. **Frontend Design-First UI (Gate 1):**
   - Move widgets from `pages/` to `components/`; build `DashboardSkeleton.vue` and `HrAlertsBanner.vue`; restyle `KpiCards.vue` ("Open Positions" → "Active Position Slots") and `QuickActions.vue` → `QuickActionsLaunchpad.vue`.
   - Update `dashboard.api.ts` mock data to mirror the real `GetHrDashboardQuery` response shape (including `alerts`).
   - Rebuild `pages/Dashboard.vue` as a shell: breadcrumb, unified skeleton gate, 2-column grid.
3. **Frontend Live Data Wiring (Gate 2):**
   - Point `dashboard.api.ts` at `GET /api/hr/dashboard/summary`.
   - Point `approveLeave()`/`declineLeave()` at `POST /api/manager/approval-requests`.
4. **Verification & Polish:**
   - Validate desktop/tablet/mobile breakpoints and dark mode against AC-8/AC-9.
   - Confirm zero-row edge cases (AC-14 through AC-17) against a freshly seeded environment.

---

## 8. Out of Scope (Future Specs)

- **Real Recruitment / Vacancy tracking:** a proper "open positions" concept (job requisitions, applicant pipeline) needs its own Recruitment module spec — Decision 2's Option A is a stopgap, not a replacement.
- **Fixing the cross-session leave-approval race** (AC-20): would require adding an optimistic-lock or `status`-transition guard to the shared `ApprovalRequestController::store`, which is Manager-portal code outside this spec's boundary.
- **Per-portal route-level authorization middleware:** the gap noted in AC-19 is systemic across all six portals, not specific to the HR dashboard — belongs in a platform-wide security spec.
- **Dashboard widget layout customization** (drag-and-drop, hide/show cards) — a future User Preferences spec, consistent with the same exclusion already noted in `payroll_dashboard.md`.
