# Spec — Manager Dashboard

> **Kind:** Extension — the frontend module **already exists** at [`resources/views/web/src/module/manager/dashboard/`](../../../../resources/views/web/src/module/manager/dashboard/) but is still in **Gate 1 (design-only)** state: every widget renders from `MOCK_*` constants in [`dashboard.store.ts:15-56`](../../../../resources/views/web/src/module/manager/dashboard/store/dashboard.store.ts#L15), and **all 10 endpoints its api layer calls do not exist** in [`routes/api/manager.php`](../../../../routes/api/manager.php). This spec wires it to real data. Nothing here creates a parallel dashboard, a second approval engine, or a duplicate team-scoping helper.
> **Portal:** **Manager** (`/api/manager/...` routes, `manager/dashboard` frontend module). Accent: **Red (`red-600`)** per [ui-design](../../../rules/conditional/ui-design.md) — already used by the existing header/refresh control, so no accent change is in scope.
> **Version:** v1 — 2026-08-26 — initial.
> **Route:** Reuses `manager/dashboard` (`manager_dashboard`) — unchanged, already registered in [`dashboard.routes.ts`](../../../../resources/views/web/src/module/manager/dashboard/route/dashboard.routes.ts) and already the first sidebar entry ([`useSidebarLinks.ts:88`](../../../../resources/views/web/src/composables/useSidebarLinks.ts#L88)).
> **Conventions:** [project-profile](../../../rules/core/project-gate.md), [hrms-rules](../../../rules/conditional/payroll.md), [ui-design](../../../rules/conditional/ui-design.md), [vue-standards](../../../rules/conditional/frontend-vue.md), [duplicate-prevention](../../../rules/conditional/system-awareness.md), [laravel-standards](../../../rules/conditional/backend.md), [performance](../../../rules/conditional/performance.md).
> **System Awareness:**
> - **Models reused:** `AccountDetailVW`, `Timesheet`, `AppLeave`, `AppChangeShift`, `AppAdjustment`, `AppOvertime`, `AppOfficialBusinessTrip`, `Unit`, `PayPeriod`, `Holiday`, `Announcement`, `AnnouncementRead`. **Created:** none.
> - **Tables reused:** `vw_accounts_details`, `accountjob`, `accounts`, `units`, `timesheet`, `shift`, `app_leave`, `app_shift`, `app_adjustment`, `app_overtime`, `app_obt`, `payroll_period`, `holidays`, `announcements`, `announcement_reads`. **Created:** none.
> - **Queries reused:** `GetManagementReportsQuery::{getManagedUnitIds, getSubUnitIds, getSubordinateIds, getManagedDepartments, getYTD}`, `HandlePayPeriodQuery::current_payperiod`, `HandleLeavesQuery::pendingApproval`, `HandleOvertimeQuery::pendingApproval`, `HandleChangeShiftQuery::pendingApproval`, `HandleAttendanceAdjustmentQuery::pendingApproval`, `HandleOfficialBusinessTripQuery::pendingApproval`, `HandleHolidayQuery::getHolidays`, `GetAnnouncementsQuery`.
> - **Queries created:** `App\Queries\Manager\GetManagerDashboardQuery`, `App\Queries\Manager\GetTeamAttendanceSnapshotQuery` (extracted from an existing controller loop — see Decision 4).
> - **Routes created:** `GET /api/manager/dashboard/summary`, `GET /api/manager/dashboard/analytics`. **Routes reused:** `POST /api/manager/approveRequest`, `GET /api/manager/myteam/departments`, `GET|POST /api/employee/announcements*`. **Routes deleted:** none — the 9 phantom `dashboard/*` endpoints the api layer currently calls were never registered, so there is nothing to remove server-side (only the client methods go).
> - **New migration needed:** **No.** Every metric is derived from tables that already exist and are already populated.

---

## 1. Purpose

The Manager Dashboard is the landing page for every Department Head / Supervisor (`/manager/dashboard`, first sidebar item). Its job is to answer four questions in one screen, without the manager having to open four separate report pages:

1. **What needs my signature right now?** — pending Leave / Overtime / Change Shift / OBT / Attendance-Adjustment applications where *this* user is the current approver.
2. **Where is my team today?** — present / late / absent / on-leave counts for the units this user heads, including sub-units.
3. **Is my team drifting?** — tardiness, undertime, absence and resolution trends for the year, at a glance, with a link into the full report.
4. **What do I need to know?** — company announcements and upcoming holidays.

### 1.1 What already exists (and is reused, not rebuilt)

- **The whole UI.** [`Dashboard.vue`](../../../../resources/views/web/src/module/manager/dashboard/pages/Dashboard.vue) already lays out `WelcomeBanner` + `KpiCards` + `ApprovalSummaryChart` + `PendingApprovals` + `AnnouncementsFeed` + `QuickActions` + `TeamAttendanceSnapshot` + `UpcomingHolidays` in the standard 2/3 + 1/3 grid, with a working refresh control, an approval-details modal, and correct red-accent styling. The design is already Gate-1 validated; this spec does **not** redesign it.
- **Team scoping.** [`GetManagementReportsQuery::getManagedUnitIds()`](../../../../app/Queries/ManagementReports/GetManagementReportsQuery.php#L23) already walks `units.idhead` → recursive `units.idunder` descendants, and [`getSubordinateIds()`](../../../../app/Queries/ManagementReports/GetManagementReportsQuery.php#L172) already turns that into an `accountjob`-joined list of active employee ids, with a static per-request cache.
- **Approver-scoped pending applications.** All five `Handle*Query::pendingApproval($period)` methods already filter by the logged-in user against the `approvers` JSON column via `JSON_TABLE` — e.g. [`HandleLeavesQuery::pendingApproval():217-225`](../../../../app/Queries/Leave/HandleLeavesQuery.php#L217) — and already emit `alias`, `type`, `pending`, `count`, `message` for the shared approver inbox.
- **The approve/decline engine.** `POST /api/manager/approveRequest` → [`ApprovalRequestController::store()`](../../../../app/Http/Controllers/manager/ApprovalRequestController.php#L68) already handles all five aliases.
- **Year-to-date team analytics.** [`GetManagementReportsQuery::getYTD($userId)`](../../../../app/Queries/ManagementReports/GetManagementReportsQuery.php#L850) already returns `attendance_rate`, `total_late_instances`, `avg_late_minutes`, `total_undertime_hours`, `total_absences`, `resolution_rate`, `department_stats`, `monthly_trends`, `top_violators`, `alerts`.
- **Announcements & holidays.** [`GetAnnouncementsQuery`](../../../../app/Queries/Employee/GetAnnouncementsQuery.php) is portal-agnostic (takes any `user`), and `Holiday` + [`HandleHolidayQuery::getHolidays()`](../../../../app/Queries/Holiday/HandleHolidayQuery.php) already back the Employee dashboard's holiday spotlight.

### 1.2 The defect this spec closes

[`dashboard.api.ts`](../../../../resources/views/web/src/module/manager/dashboard/api/dashboard.api.ts) calls `api/manager/dashboard/summary`, `/pending-approvals`, `/approval-stats`, `/team-attendance`, `/holidays`, `/announcements`, `/approvals/{id}`, `/approvals/{id}/approve`, `/approvals/{id}/decline`, `/announcements/{id}/read` — **none of which are registered anywhere**. Laravel's SPA fallback answers them with `200 text/html`, so axios never throws; [`dashboard.store.ts:108-176`](../../../../resources/views/web/src/module/manager/dashboard/store/dashboard.store.ts#L108) then swallows the mismatch and keeps `MOCK_SUMMARY` / `MOCK_PENDING`. The screen therefore shows a manager a **fabricated** team of 24 with 7 pending approvals and five named employees who do not exist. It looks correct and is entirely fictional. This is the follow-up already flagged in [`duty_roster_approval_workflow.md` §1](./duty_roster_approval_workflow.md).

---

## 2. Design Decisions (Pros & Cons)

### Decision 1: Endpoint shape — one summary call, or the eleven the client already assumes

**Option A — One `GET /api/manager/dashboard/summary` + one deferred `GET /api/manager/dashboard/analytics` (Recommended)**
- A single `GetManagerDashboardQuery::execute()` returns period, team size, approval stats, attendance snapshot, pending approvals, holidays and announcements in one payload for first paint. The expensive year-long trend block (Decision 5) is a **second, deferred** call fired after the first paint. The client's nine other api methods are deleted.

| Pros | Cons |
|---|---|
| Matches all four sibling dashboards exactly — HR, Payroll and Timekeeping each expose precisely one `GET /dashboard/summary` ([`hr.php:33`](../../../../routes/api/hr.php#L33), [`payroll.php:33`](../../../../routes/api/payroll.php#L33), [`timekeeping.php:30`](../../../../routes/api/timekeeping.php#L30)) | Requires deleting/rewriting most of `dashboard.api.ts` and the store's four parallel fetches |
| One consistent snapshot — attendance counts cannot disagree with the team size they are divided by | Payload ~20–30 KB on a 200-person org |
| One `try/catch`, one loading flag, one error state instead of four independently-failing widgets | The two-call split must be justified per-call rather than "always one" |
| Removes a 4-request waterfall on the portal's landing page | — |

**Option B — Register all nine phantom endpoints and keep the client as-is**
- Add `dashboard/pending-approvals`, `dashboard/approval-stats`, `dashboard/team-attendance`, `dashboard/holidays`, `dashboard/announcements`, `dashboard/approvals/{id}[/approve|/decline]`, `dashboard/announcements/{id}/read` to `routes/api/manager.php`.

| Pros | Cons |
|---|---|
| Zero frontend churn — the api layer and store keep their current shape | Nine new endpoints, of which **three duplicate engines that already exist**: `approve`/`decline` duplicate `POST /api/manager/approveRequest`, and `announcements/{id}/read` duplicates `POST /api/employee/announcements/{id}/read` — a direct [duplicate-prevention](../../../rules/conditional/system-awareness.md) violation |
| Per-widget skeletons come free | Breaks the one-endpoint-per-dashboard convention the other four portals all follow |
| | Widgets can disagree with each other (team size from one request, attendance from another) |

**Recommendation: Option A.** The nine-endpoint shape was never a decision — it is an artifact of the module being scaffolded before a backend existed. Three of those nine would be straight duplicates of working engines.

---

### Decision 2: Where team scoping comes from

**Option A — Call the existing `GetManagementReportsQuery` statics, and refactor `MyTeamController`'s private copies to delegate to them (Recommended)**
- `GetManagerDashboardQuery` calls `GetManagementReportsQuery::getManagedUnitIds($userId)` / `::getSubordinateIds($userId)` / `::getSubUnitIds($unitId)`. In the same change, [`MyTeamController::getManagedUnitIds():35-67`](../../../../app/Http/Controllers/manager/MyTeamController.php#L35) and [`::getSubUnitIds():68-96`](../../../../app/Http/Controllers/manager/MyTeamController.php#L68) — which are line-for-line copies of the Query statics — become one-line delegations.

| Pros | Cons |
|---|---|
| One definition of "who reports to me" for the dashboard, My Team pages and all five Management Reports — they cannot drift apart | Touches `MyTeamController`, which is outside the dashboard module (4 call sites: `getAttendanceToday`, `getEmployeesList`, `getRecentFilings`, `getTimesheetDetails`) |
| Inherits the static `$subordinateCache` — repeat calls inside one request are free | The controller's own methods currently query `units` on every call; delegating changes their (better) performance characteristics |
| Removes an existing, already-shipped duplication rather than adding a third copy | — |

**Option B — Call the Query statics from the dashboard only; leave `MyTeamController`'s private copies alone**

| Pros | Cons |
|---|---|
| Smallest possible diff; no risk to the three shipped My Team pages | Leaves two definitions of the org-hierarchy walk in the repo, one of which re-queries `units` uncached on every call |
| | The next scoping rule change (e.g. dotted-line reports) has to be made in two places, and will be made in one |

**Recommendation: Option A**, with the `MyTeamController` delegation as a **separate commit** in the build order so it can be reverted independently if regression testing on My Team surfaces anything.

---

### Decision 3: Where "pending approvals" and the approve/decline actions come from

**Option A — Reuse the five `Handle*Query::pendingApproval($period)` reads and `POST /api/manager/approveRequest` for writes (Recommended)**
- The dashboard widget shows exactly what the approver inbox shows, and its Approve/Decline buttons post `{data: [{id, alias}], status, cancel_reason}` to the existing endpoint.

| Pros | Cons |
|---|---|
| **Authorization is already correct and battle-tested**: each query filters on `approver_data.approver = Auth::id()` **or** `JSON_CONTAINS(sub_approver, Auth::id())` with `approver_data.status = 0` — a manager structurally cannot see another chain's items | Inherits whatever sequencing/ownership behavior `store()` has today, including the defects [`duty_roster_approval_workflow.md` Decision 1](./duty_roster_approval_workflow.md) is fixing |
| The `pending` / `count` / `message` fields already distinguish "actionable by me now" from "waiting on approver 1" — the widget can disable the button correctly with no new logic | Requires the dashboard's `PendingApproval` DTO to be re-shaped to the inbox's field names (`name`, `alias`, `docnumber`, `content`) instead of the invented `employee_name`/`str_type`/`sub_text` |
| Zero new write paths — dashboard and inbox stay in lockstep forever | — |

**Option B — A new unit-scoped pending query for the dashboard (`whereIn('idacct', $subordinateIds)`)**

| Pros | Cons |
|---|---|
| Shows a Department Head everything filed anywhere in their org, even items where they are not on the chain | **Wrong and leaky by design**: approver membership, not org position, is what grants sight of an application in this system. A head who is deliberately excluded from a chain (e.g. an application about their own direct report escalated past them) would see it |
| Simpler SQL — no `JSON_TABLE` | Counts on the dashboard would then never match the inbox, and the Approve button would have no legitimate target |

**Recommendation: Option A**, unambiguously. Option B is a security regression dressed as a feature.

> **Cross-spec coordination:** the sequencing + ownership fix to `ApprovalRequestController::store()` is owned by [`duty_roster_approval_workflow.md`](./duty_roster_approval_workflow.md) Decision 1 and is **out of scope here**. This spec's client must therefore send only `{id, alias}` per item (no client-built `approvers` array, no `count`) so it is already compatible with that fix when it lands.

---

### Decision 4: Today's attendance snapshot — extract the existing loop, or write a second one

The bucket logic (`timein && late > 0` → late; `timein` → present; approved `app_leave` on that date → leave; otherwise absent) exists exactly once today, inline in [`MyTeamController::getAttendanceToday():208-248`](../../../../app/Http/Controllers/manager/MyTeamController.php#L208), computed twice within that one method — once for the paginated rows and again, unfiltered, for the `statistics` block.

**Option A — Extract it into `App\Queries\Manager\GetTeamAttendanceSnapshotQuery` and have both the dashboard and `getAttendanceToday()` call it (Recommended)**

| Pros | Cons |
|---|---|
| The dashboard's counts and the My Team Attendance page's `statistics` block are guaranteed identical — today they would be two independent implementations of the same four rules | Refactors a shipped 160-line controller method; needs a before/after comparison on the same date + unit to prove parity |
| Kills the existing in-method duplication at the same time | Slightly larger diff than Option B |
| Puts business logic in a Query where [laravel-standards](../../../rules/conditional/backend.md) says it belongs, not in a controller | — |

**Option B — Recompute the buckets inside `GetManagerDashboardQuery`**

| Pros | Cons |
|---|---|
| No change to shipped My Team code | A third copy of the same four rules. The rules are *subtle* — "no timesheet row at all" and "timesheet row with no `timein`" must both count absent, and an approved leave must lose to a real `timein`. A reimplementation will get one of these wrong |
| | Dashboard and My Team Attendance will report different absent counts for the same day, and nobody will know which is right |

**Recommendation: Option A.**

---

### Decision 5: The trend/analytics block — what it shows and when it loads

`getYTD($userId)` is the natural source, but it is expensive by construction: it pulls **every timesheet row for every subordinate for the whole year** into PHP and transforms them one by one ([lines 869-950](../../../../app/Queries/ManagementReports/GetManagementReportsQuery.php#L869)). For a 200-person department that is ~50 000 hydrated rows before a single number is produced.

**Option A — Reuse `getYTD()` verbatim behind a deferred `GET /api/manager/dashboard/analytics`, fired after first paint (Recommended)**
- `summary` returns fast and paints; the trend card and top-violators list render a skeleton and fill in when the second call lands.

| Pros | Cons |
|---|---|
| Zero duplicated analytics math — the dashboard and the YTD Statistics page show the same numbers by construction | Two requests instead of one (a deliberate, scoped exception to Decision 1) |
| First paint is not held hostage by the year-long scan | The heavy query still runs on every dashboard visit |
| `alerts`, `top_violators`, `monthly_trends` and `department_stats` all arrive already formatted for display | The trend card needs its own loading + error state |

**Option B — Inline `getYTD()` into the single `summary` payload**

| Pros | Cons |
|---|---|
| One request, matching Decision 1 with no exception | Puts a ~50 000-row PHP transform on the critical path of the portal's landing page — a direct [performance](../../../rules/conditional/performance.md) violation |
| | One slow department makes the whole dashboard feel broken |

**Option C — Write light period-scoped SQL aggregates for the dashboard and link out to the YTD page for depth**

| Pros | Cons |
|---|---|
| Fastest possible first paint | A second, SQL-level implementation of late/undertime/absence counting that will disagree with `getYTD()`'s PHP implementation at the edges (rest days, holidays, open shifts) — exactly the drift Decision 4 rejects |
| | Two "attendance rate" numbers in one product, differing by a percent or two, with no way to tell which is authoritative |

**Recommendation: Option A.** Caching `getYTD()` per manager is the right *next* optimization, but it is a separate concern — see §8.

---

### Decision 6: The mock-data fallback

**Option A — Delete every `MOCK_*` constant and render real empty / error states (Recommended)**
- State initializes empty (`teamSize: 0`, `pendingApprovals: []`), a failed fetch sets an `error` ref, and each widget shows either its empty state or a retry affordance.

| Pros | Cons |
|---|---|
| Ends the current failure mode where a manager is shown five fabricated employees and a fabricated headcount as if real | Every widget needs a designed empty state (three already have `loading` props; empty states must be added) |
| A broken endpoint becomes *visible* instead of silently plausible | A genuinely empty new department now shows an empty dashboard rather than a populated-looking one |
| The `isHtmlResponse()` / `extractArray()` / `extractObject()` SPA-fallback guards ([`dashboard.store.ts:58-80`](../../../../resources/views/web/src/module/manager/dashboard/store/dashboard.store.ts#L58)) can stay — they are genuinely useful — but must set `error`, not silently keep stale data | — |

**Option B — Keep mocks as a development-only fallback behind `import.meta.env.DEV`**

| Pros | Cons |
|---|---|
| Frontend work continues if the backend is down | Dev and prod diverge in exactly the code path that decides whether numbers are real — the class of bug hardest to catch in review |
| | The current bug shipped *because* this fallback existed; keeping a conditional version keeps the trap loaded |

**Recommendation: Option A.** This is the whole point of the spec.

---

### Decision 7: Widget file placement

The eight widget components currently sit in `dashboard/pages/` alongside the actual route component. Every sibling dashboard puts them in `dashboard/components/` and keeps exactly one file in `pages/` ([`hr/dashboard/components/`](../../../../resources/views/web/src/module/hr/dashboard/components/) has 9, `pages/` has 1).

**Option A — Move the seven widgets to `dashboard/components/` (Recommended)**

| Pros | Cons |
|---|---|
| Matches the layout mandated by [project-structure](../../../rules/conditional/code-quality.md) and used by all four sibling dashboards | Seven file moves + import updates in `Dashboard.vue`, all mechanical |
| `pages/` regains its meaning: "things a route points at" | Churns `git log --follow` on seven files |

**Option B — Leave them in `pages/`**

| Pros | Cons |
|---|---|
| No churn | The one module that diverges becomes the template the next person copies |

**Recommendation: Option A**, as its own commit, since it is a pure move with no behavior change.

---

### Decision 8: Announcements endpoints

**Option A — Call the existing `/api/employee/announcements` endpoints from the manager dashboard (Recommended)**
- `GET /api/employee/announcements` and `POST /api/employee/announcements/{id}/read` ([`employee.php:79-83`](../../../../routes/api/employee.php#L79)) already serve `GetAnnouncementsQuery`, which is keyed on the authenticated account and has no employee-only logic in it. Announcements are also embedded in the `summary` payload for first paint; only *mark-as-read* uses the employee route.

| Pros | Cons |
|---|---|
| No duplicate controller, query or route for content that is identical for every portal | A manager-portal screen posting to an `/api/employee/...` URL reads oddly against [hrms-rules](../../../rules/conditional/payroll.md) portal separation |
| Read state stays in one `announcement_reads` row per account — a manager marking an item read on the dashboard sees it read everywhere | — |

**Option B — Alias one manager route onto the same controller**
- `Route::post('/announcements/{id}/read', [AnnouncementController::class, 'markAsRead'])` in `manager.php`.

| Pros | Cons |
|---|---|
| Portal-prefix hygiene: manager screens only ever call `/api/manager/*` | One more route registration for zero behavior change |
| Precedent exists — `duty_roster_approval_workflow.md` mounts the same approver page under a second portal prefix | Two URLs for one action |

**Recommendation: Option B**, narrowly — a single-line route alias onto the *same* controller method costs nothing, keeps the manager module's api layer internally consistent, and duplicates no logic. (Option A is acceptable if the reviewer prefers fewer routes; the difference is one line.)

---
## 2.5 Acceptance Criteria

| # | Given | When | Then |
|---|-------|------|------|
| **AC-1** | An authenticated user with `Auth::id() = 42` who is `units.idhead` of at least one active unit | The browser loads `/manager/dashboard` | Exactly **one** request `GET /api/manager/dashboard/summary` fires (plus one deferred `GET /api/manager/dashboard/analytics`), returning `200` with top-level keys `period`, `metrics`, `attendance`, `pendingApprovals`, `holidays`, `announcements`, `departments`, `lastUpdated`. No request is made to `api/manager/dashboard/pending-approvals`, `/approval-stats`, `/team-attendance`, `/holidays`, `/announcements`, `/approvals/{id}`, `/approvals/{id}/approve`, `/approvals/{id}/decline`, or `/announcements/{id}/read`. |
| **AC-2** | Manager 42 is `idhead` of unit `10`; unit `11` has `idunder = 10`; unit `12` has `idunder = 11`; all three have `status = 1` | Summary is built | The team scope contains units `[10, 11, 12]` (recursive descendants, not just direct children), and `metrics.teamSize` equals the count of `accounts` rows with `status = 1` joined via `accountjob.unitid IN (10,11,12)`. |
| **AC-3** | Authenticated user 77 is `idhead` of **no** active unit | `GET /api/manager/dashboard/summary` | `200` with `metrics.teamSize = 0`, `attendance = {total: 0, present: 0, late: 0, absent: 0, leave: 0}`, `pendingApprovals: []`, `departments: []`. **Not** a `403`, **not** a `500`, and **no** other manager's data. The UI renders the "No team assigned" empty state, not a spinner and not mock numbers. |
| **AC-4** | An `app_leave` row with `status = 0`, dated inside the current period, whose `approvers` JSON contains `{approver: 99, status: 0}` and no entry naming user 42 or listing 42 in any `sub_approver` | Manager 42 loads the dashboard | That row does **not** appear in `pendingApprovals`, and does not count toward `metrics.approvalStats.pending`. |
| **AC-5** | An `app_overtime` row whose `approvers` is `[{order: 1, approver: 99, status: 0}, {order: 2, approver: 42, status: 0}]` | Manager 42 loads the dashboard | The row appears with `pending = 0` and `message = "Pending Approver 1"`; its **Approve and Decline buttons are rendered disabled**, and it is excluded from the actionable `metrics.approvalStats.pending` count. |
| **AC-6** | The same row, but `approvers` is `[{order: 1, approver: 42, status: 0}, {order: 2, approver: 99, status: 0}]` | Manager 42 clicks **Approve** on the widget | Exactly one `POST /api/manager/approveRequest` is sent with body `{"data": [{"id": <id>, "alias": "ot"}], "status": 1}` — no `approvers` array and no `count` are sent from the client. On `200`, a success toast shows and the dashboard refetches. |
| **AC-7** | The Decline confirmation dialog is open with an empty remarks field | Manager clicks the confirm button | The confirm button is **disabled**; no request is sent. After typing at least 1 non-whitespace character it enables and posts `{"data": [{"id": <id>, "alias": "<alias>"}], "status": 2, "cancel_reason": "<text>"}`. |
| **AC-8** | Subordinate `A` has a `timesheet` row for today with `timein = '08:15:00'` and `late = 15` | Attendance snapshot is built | `A` is counted in `attendance.late`, **not** in `attendance.present`. |
| **AC-9** | Subordinate `B` has **no** `timesheet` row for today but has an `app_leave` row for today with `status = 1` | Attendance snapshot is built | `B` is counted in `attendance.leave` only. |
| **AC-10** | Subordinate `C` has a `timesheet` row for today with `timein = NULL`, and subordinate `D` has no `timesheet` row and no approved leave | Attendance snapshot is built | Both `C` and `D` are counted in `attendance.absent`. |
| **AC-11** | Any team of size `N` on any date | Attendance snapshot is built | `attendance.present + attendance.late + attendance.absent + attendance.leave == attendance.total == N` — every subordinate lands in exactly one bucket. |
| **AC-12** | Manager 42 loads the dashboard on the same date and with the same `unit_id` used on `/manager/myteam/attendance` | Both screens are compared | `attendance` on the dashboard equals the `statistics` block returned by `GET /api/manager/myteam/attendance` field-for-field, because both are produced by `GetTeamAttendanceSnapshotQuery`. |
| **AC-13** | No `payroll_period` row satisfies `HandlePayPeriodQuery::current_payperiod([])` | `GET /api/manager/dashboard/summary` | `200` (not `404`) with `period = null`, `pendingApprovals: []`, and `period_notice = "No active cutoff period configured"`. The UI shows that notice in the approvals card header instead of an error page. |
| **AC-14** | The summary request has resolved and painted | The page finishes mounting | `GET /api/manager/dashboard/analytics` fires **after** first paint; until it resolves the trend card and Top Violators list render skeletons. A failure of `analytics` leaves the rest of the dashboard fully usable and shows a retry control inside that card only. |
| **AC-15** | Manager 42 clicks an unread announcement | The item is opened | A detail modal renders `title`, `author.name`, `published_at` and `content`, and exactly one `POST /api/manager/announcements/{id}/read` is sent; on `200` the item's unread dot is cleared and it stays cleared after a refresh (a row exists in `announcement_reads` for `idacct = 42`). |
| **AC-16** | No authenticated session (no valid Sanctum token) | `GET /api/manager/dashboard/summary` | `401` with `{"message": "Unauthenticated."}` — enforced by the existing `auth:sanctum` group that wraps `routes/api/manager.php`; the endpoint adds no bypass. |
| **AC-17** | Manager 42's request includes `unit_id = 500`, a unit that exists but is **not** in 42's managed set | Summary is built | The resolved unit filter is `array_intersect([500 + descendants], managedUnitIds)` = `[]`, so `attendance.total = 0` and `pendingApprovals` is unaffected. **No** row belonging to unit 500 appears anywhere in the response. |
| **AC-18** | Manager 42 double-clicks **Approve** on the same pending item within 300 ms | Both clicks register in the DOM | The button is disabled on the first click until the request settles, so exactly one `POST /api/manager/approveRequest` is sent. If a duplicate does reach the server (e.g. a retried request), the second call is a no-op on an already-`status = 1` record and the dashboard's refetched `pendingApprovals` count is identical to after the first call — no double-approval, no duplicated row. |
| **AC-19** | Request carries `date = "not-a-date"` (or `date = ""`, or `unit_id = "abc"`, or a `date` string longer than 10 characters) | `GET /api/manager/dashboard/summary` | `422` with `{"message": "<validation message>", "errors": {...}}`. A **missing** `date` is valid and defaults to `Carbon::today()`; a **missing** `unit_id` is valid and means `all`. |
| **AC-20** | The summary endpoint returns `500`, or Laravel's SPA fallback answers it with `200 text/html` | The dashboard loads | An error state is shown with a Retry button, and `metrics.teamSize` renders as `0`/`—`. **No** `MOCK_SUMMARY`, `MOCK_PENDING`, `MOCK_HOLIDAYS` or `MOCK_ANNOUNCEMENTS` values are displayed — those constants no longer exist in `dashboard.store.ts`. |
| **AC-21** | A `GetManagerDashboardQuery` internal exception (e.g. a DB error) | `GET /api/manager/dashboard/summary` | `400` with `{"message": "<exception message>"}`, matching the shape of `HrDashboardController::getSummary()` and `PayrollDashboardController::getSummary()`. |
| **AC-22** | The dashboard is loaded | Manager clicks each Quick Action tile | Navigation goes to the exact existing route names — `manager_myteam_attendance`, `manager_myteam_timesheet`, `manager_myteam_filing_in_behalf`, `manager_staff_scheduler_duty_roster`, `manager_management_reports_tardiness`, `manager_management_reports_absences`, `manager_management_reports_resolution`, `manager_management_reports_ytd_statistics`, and `/manager/approvers-menu/applications-request`. No tile points at a route name that does not exist in the manager module's `*.routes.ts` files. |
| **AC-23** | Manager clicks **Refresh** in the header | Click fires | The icon spins, both `summary` and `analytics` are refetched, the button is disabled until both settle, and `lastUpdated` re-renders with the new timestamp. |
| **AC-24** | A department with 200 active subordinates | `GET /api/manager/dashboard/summary` is timed | The response completes without loading per-employee timesheet rows for the whole year — the year-long scan lives only in `/analytics`. The summary issues a bounded number of queries (no query inside a per-employee loop). |

---

## 3. Database

**No new tables, no new columns, no migration.** Every value is derived from tables that already exist and are already written to by shipped features.

| Table | Columns read | Filter / condition | Used for |
|---|---|---|---|
| `units` | `id`, `idunder`, `idhead`, `status` | `status = 1`, `idhead = Auth::id()` then recursive `idunder` | Team scope (`getManagedUnitIds`) |
| `accountjob` | `idacct`, `unitid` | `unitid IN (managedUnitIds)` | Subordinate ids (`getSubordinateIds`) |
| `accounts` | `id`, `empid`, `fname`, `lname`, `pic`, `status` | `status = 1` | Team size, approver-item employee names |
| `vw_accounts_details` | `id`, `empid`, `fullname`, `position`, `profile`, `unit`, `unit_id`, `idlvl`, `wshift`, `status` | `status = 1`, `unit_id IN (scope)` | Attendance snapshot rows, department stats |
| `timesheet` | `idacct`, `date`, `timein`, `timeout`, `late`, `absent`, `idshift` | `date = <target>`, `idacct IN (subordinateIds)` | Present / late / absent buckets |
| `shift` | `id`, `type`, `stime`, `ftime` | joined on `timesheet.idshift` | Rest-day detection, late/undertime math (analytics) |
| `app_leave` | `id`, `idacct`, `date`, `days`, `hrs`, `remarks`, `approvers`, `status`, `docnumber` | `status = 1` for the leave bucket; `status = 0` + `approvers` match for pending | Leave bucket, pending approvals |
| `app_overtime` | `id`, `idacct`, `date`, `approvers`, `status`, `docnumber` | `status = 0` + `approvers` match | Pending approvals |
| `app_shift` | `id`, `idacct`, `date`, `approvers`, `status`, `docnumber` | `status = 0` + `approvers` match | Pending approvals |
| `app_adjustment` | `id`, `idacct`, `date`, `approvers`, `status`, `docnumber` | `status = 0` + `approvers` match | Pending approvals |
| `app_obt` | `id`, `idacct`, `date`, `approvers`, `status`, `docnumber` | `status = 0` + `approvers` match | Pending approvals |
| `payroll_period` | `id`, `period_start`, `period_end` | via `HandlePayPeriodQuery::current_payperiod()` | Approval window, `formattedPeriod` |
| `holidays` | `id`, `name`, `date`, `idtype` | current month, else next 3 upcoming | Upcoming Holidays card, banner |
| `announcements` | `id`, `title`, `summary`, `content`, `category`, `importance`, `pinned`, `published_at`, `author_name`, `author_role` | `active()` scope | Announcements feed |
| `announcement_reads` | `id`, `idacct`, `idannouncement` | `idacct = Auth::id()` | Unread dot |

> Approver membership is stored **inside** the `approvers` JSON column on each `app_*` table and is read with MySQL `JSON_TABLE` — there is no join table to add, and no denormalized "manager_id" column is introduced anywhere. [project-profile](../../../rules/core/project-gate.md): SubHRMS has **zero DB-level foreign keys** — nothing in this spec adds one.

---

## 4. Backend

### 4.1 `App\Queries\Manager\GetManagerDashboardQuery`

- **Location:** `app/Queries/Manager/GetManagerDashboardQuery.php`
- **Namespace:** `App\Queries\Manager`
- **Extends:** `App\Queries\Query`
- **Signature:** `public static function execute($params = []): array`

Composition (it orchestrates existing queries; it owns no scoping or bucket logic of its own):

1. `$userId = Auth::id();`
2. `$period = HandlePayPeriodQuery::current_payperiod($params);` — when `null`, set `period = null` + `period_notice` and skip step 4 entirely (**AC-13**).
3. `$managedUnitIds = GetManagementReportsQuery::getManagedUnitIds($userId);` — early-return the zero-team payload when empty (**AC-3**).
4. **Pending approvals** — merge the five existing reads exactly as [`ApprovalRequestController::index()`](../../../../app/Http/Controllers/manager/ApprovalRequestController.php#L27) already does:
   `collect([HandleChangeShiftQuery::pendingApproval($period, false), HandleAttendanceAdjustmentQuery::pendingApproval($period), HandleOvertimeQuery::pendingApproval($period), HandleOfficialBusinessTripQuery::pendingApproval($period), HandleLeavesQuery::pendingApproval($period)])->flatten(1)`, sorted by `date` desc, sliced to the first **8** for the widget, with the **full** count kept for `metrics.approvalStats.pending` (counting only items with `pending === 1` — **AC-5**).
5. **Attendance snapshot** — `GetTeamAttendanceSnapshotQuery::execute(['user_id' => $userId, 'date' => $date, 'unit_id' => $unitId])` (§4.2).
6. **Approval stats (approved / declined)** — counts over the five `app_*` tables for `idacct IN (subordinateIds)` and `date BETWEEN period_start AND period_end`, grouped as `status = 1` → approved, `status = 2` → declined.
7. **Departments** — `GetManagementReportsQuery::getManagedDepartments($userId)` for the unit filter dropdown.
8. **Holidays** — current month via `Holiday`, falling back to the next 3 upcoming, formatted `{id, name, date, formatted_date, type, days_away}` — the same shape [`GetEmployeeDashboardQuery::buildUpcomingHolidays()`](../../../../app/Queries/Employee/GetEmployeeDashboardQuery.php#L868) already produces.
9. **Announcements** — `GetAnnouncementsQuery::execute(['user' => Auth::user()])`.

Return shape:

```php
return [
    'period' => $period ? [
        'id'            => $period->id,
        'period_start'  => $period->period_start,
        'period_end'    => $period->period_end,
        'formatted'     => Carbon::parse($period->period_start)->format('M d')
                            . ' – ' . Carbon::parse($period->period_end)->format('M d, Y'),
    ] : null,
    'period_notice' => $period ? null : 'No active cutoff period configured',
    'metrics' => [
        'teamSize'      => $teamSize,
        'approvalStats' => ['pending' => $pending, 'approved' => $approved, 'declined' => $declined],
    ],
    'attendance'       => $snapshot,   // total, present, late, absent, leave
    'pendingApprovals' => $approvals,  // id, alias, type, name, empid, pic, date, docnumber, content, remarks, pending, count, message, status
    'departments'      => $departments,
    'holidays'         => $holidays,
    'announcements'    => $announcements,
    'lastUpdated'      => Carbon::now()->toDateTimeString(),
];
```

### 4.2 `App\Queries\Manager\GetTeamAttendanceSnapshotQuery` (extraction — Decision 4)

- **Location:** `app/Queries/Manager/GetTeamAttendanceSnapshotQuery.php`
- **Signature:** `public static function execute($params = []): array` → `['total' => int, 'present' => int, 'late' => int, 'absent' => int, 'leave' => int]`
- **Source of truth:** lifted verbatim from [`MyTeamController::getAttendanceToday()`](../../../../app/Http/Controllers/manager/MyTeamController.php#L208) — the unfiltered `statistics` loop, including its exact precedence: a `timesheet` row with a `timein` wins over an approved leave; `late > 0` wins over present; a missing `timesheet` row **and** a `timein`-less row both count absent.
- **Second call site:** `MyTeamController::getAttendanceToday()` replaces its own duplicated stats loop with a call to this query, keeping its per-row list building as-is (**AC-12**).

### 4.3 `App\Queries\Manager\GetManagerAnalyticsQuery` (thin wrapper — Decision 5)

- Delegates to `GetManagementReportsQuery::getYTD(Auth::id())` and returns its array unchanged. It exists only to give the deferred endpoint its own controller method + a place to add caching later (§8); it must contain **no** analytics math of its own.

### 4.4 Controller

- **Location:** `app/Http/Controllers/manager/ManagerDashboardController.php`
- **Namespace:** `App\Http\Controllers\manager`

```php
namespace App\Http\Controllers\manager;

use App\Http\Controllers\Controller;
use App\Queries\Manager\GetManagerDashboardQuery;
use App\Queries\Manager\GetManagerAnalyticsQuery;
use Illuminate\Http\Request;
use Exception;

class ManagerDashboardController extends Controller
{
    /** Aggregated first-paint payload: period, team size, approval stats, attendance, approvals, holidays, announcements. */
    public function getSummary(Request $request)
    {
        try {
            $request->validate([
                'date'    => ['nullable', 'date_format:Y-m-d'],
                'unit_id' => ['nullable'],
            ]);

            return response()->json(GetManagerDashboardQuery::execute($request->all()));
        } catch (Exception $e) {
            return response()->json(['message' => $e->getMessage()], 400);
        }
    }

    /** Deferred year-to-date team analytics (trend, department stats, top violators, alerts). */
    public function getAnalytics(Request $request)
    {
        try {
            return response()->json(GetManagerAnalyticsQuery::execute($request->all()));
        } catch (Exception $e) {
            return response()->json(['message' => $e->getMessage()], 400);
        }
    }
}
```

`validate()` throws `ValidationException`, which Laravel renders as `422` for JSON requests **before** the `catch (Exception)` can turn it into a `400` — `ValidationException` must therefore be allowed to propagate (do not catch `\Throwable` here). This is what satisfies **AC-19** while **AC-21** still returns `400`.

### 4.5 Route registration — `routes/api/manager.php`

Added to the existing file, which is already loaded inside the `auth:sanctum` group under the `manager` prefix (**AC-16**):

```php
use App\Http\Controllers\manager\ManagerDashboardController;
use App\Http\Controllers\employee\AnnouncementController;

// Manager Dashboard
Route::get('/dashboard/summary',   [ManagerDashboardController::class, 'getSummary']);
Route::get('/dashboard/analytics', [ManagerDashboardController::class, 'getAnalytics']);

// Announcement read-state — same controller the employee portal uses (Decision 8, Option B)
Route::post('/announcements/{id}/read', [AnnouncementController::class, 'markAsRead']);
```

No other route in `manager.php` changes.

---

## 5. Frontend

### 5.1 Module structure (after Decision 7's move)

```
resources/views/web/src/module/manager/dashboard/
├── index.ts                              # barrel — unchanged export surface
├── route/
│   └── dashboard.routes.ts               # UNCHANGED (manager/dashboard → manager_dashboard)
├── api/
│   └── dashboard.api.ts                  # REWRITTEN — 4 methods, down from 10
├── store/
│   └── dashboard.store.ts                # REWRITTEN — mocks removed, error state added
├── composables/
│   └── useManagerDashboard.ts            # unchanged shape; +error, +analytics refs exposed
├── pages/
│   └── Dashboard.vue                     # the only file left in pages/
├── components/                            # ← 7 files MOVED here from pages/
│   ├── KpiCards.vue                      # moved, +empty/zero states
│   ├── ApprovalSummaryChart.vue          # moved, +empty state
│   ├── PendingApprovals.vue              # moved, DTO re-shaped, disabled-when-not-my-turn
│   ├── TeamAttendanceSnapshot.vue        # moved, +empty state
│   ├── UpcomingHolidays.vue              # moved, +empty state
│   ├── AnnouncementsFeed.vue             # moved, +empty state
│   ├── QuickActions.vue                  # moved, route names verified against *.routes.ts
│   ├── TeamTrendCard.vue                 # NEW — deferred analytics (monthly_trends, dept stats)
│   ├── TopViolatorsList.vue              # NEW — deferred analytics (top_violators)
│   ├── ComplianceAlertsBanner.vue        # NEW — deferred analytics (alerts[])
│   └── DashboardSkeleton.vue             # NEW — first-paint skeleton, mirrors hr/dashboard's
└── types/
    └── types.dashboard.ts                # REWRITTEN to the real backend contract
```

### 5.2 API layer (`api/dashboard.api.ts`) — the whole surface

```typescript
export function useDashboardApi() {
    return {
        getSummary: async (params: Record<string, unknown> = {}): Promise<DashboardSummaryResponse> =>
            (await http.get('api/manager/dashboard/summary', { params })).data,

        getAnalytics: async (): Promise<DashboardAnalyticsResponse> =>
            (await http.get('api/manager/dashboard/analytics')).data,

        // Reuses the shared approver engine — NOT a dashboard-specific write path (Decision 3)
        submitApproval: async (
            items: Array<{ id: number; alias: ApprovalAlias }>,
            status: 1 | 2,
            cancelReason = '',
        ): Promise<ApprovalActionResult> =>
            (await http.post('api/manager/approveRequest', {
                data: items,
                status,
                ...(status === 2 ? { cancel_reason: cancelReason } : {}),
            })).data,

        markAnnouncementRead: async (id: number): Promise<void> =>
            (await http.post(`api/manager/announcements/${id}/read`)).data,
    };
}
```

The nine phantom methods (`getDashboardSummary`, `getPendingApprovals`, `getApprovalStats`, `getTeamAttendanceSnapshot`, `getHolidays`, `getAnnouncements`, `getApprovalDetails`, `approveRequest`, `declineRequest`) are **deleted**. Approval details need no fetch — `pendingApproval()` already returns every field the modal shows, so the modal binds the row it was opened with.

### 5.3 TypeScript contract (`types/types.dashboard.ts`)

```typescript
export type ApprovalAlias = 'leave' | 'ot' | 'cs' | 'obt' | 'aa';

export interface DashboardPeriod {
    id: number;
    period_start: string;
    period_end: string;
    formatted: string;              // "Jun 16 – Jun 30, 2026"
}

export interface ApprovalStat {
    pending: number;                // actionable by ME now (pending === 1 only)
    approved: number;
    declined: number;
}

export interface AttendanceStat {
    total: number;
    present: number;
    late: number;
    absent: number;
    leave: number;
}

/** Mirrors the shared approver-inbox row emitted by every Handle*Query::pendingApproval(). */
export interface PendingApproval {
    id: number;
    alias: ApprovalAlias;
    type: string;                   // 'Leave' | 'Overtime' | 'Change Shift' | 'OBT' | 'Attendance Adjustment'
    name: string;                   // "EMP-2018 Maria Santos" — as built by the query
    empid: string | null;
    pic: string | null;
    date: string;
    docnumber: string | null;
    content: string;                // pre-rendered HTML summary line from the query
    remarks: string | null;
    pending: 0 | 1;                 // 1 = my turn → buttons enabled (AC-5)
    count: number;                  // approvers still pending
    message: string | null;         // "Pending Approver 1" when not my turn
    status: number;
}

export interface Holiday {
    id: number;
    name: string;
    date: string;
    formatted_date: string;
    type: string;                   // 'Regular' | 'Special Non-Working'
    days_away: number;
}

export interface Department { id: number; name: string; }

export interface Announcement {
    id: number;
    title: string;
    summary: string;
    content: string;
    category: string;
    importance: string;
    pinned: boolean;
    read: boolean;
    published_at: string | null;
    author: { name: string; role: string; avatar: string };
    attachments: unknown[];
}

export interface DashboardSummaryResponse {
    period: DashboardPeriod | null;
    period_notice: string | null;
    metrics: { teamSize: number; approvalStats: ApprovalStat };
    attendance: AttendanceStat;
    pendingApprovals: PendingApproval[];
    departments: Department[];
    holidays: Holiday[];
    announcements: Announcement[];
    lastUpdated: string;
}

/** Deferred — shape is getYTD()'s return, consumed as-is. */
export interface DashboardAnalyticsResponse {
    attendance_rate: number;
    total_late_instances: number;
    avg_late_minutes: number;
    total_undertime_hours: number;
    total_absences: number;
    resolution_rate: number;
    department_stats: Array<Record<string, unknown>>;
    monthly_trends: Array<Record<string, unknown>>;
    top_violators: Array<{ name: string; emp_id: string; avatar_bg: string; profile: string | null; lates: number; mins: number; rank: string }>;
    alerts: Array<{ type: 'danger' | 'warning' | 'info'; icon: string; title: string; message: string }>;
}

export interface ApprovalActionResult { success?: boolean; message?: string; }
```

> `PendingApproval` deliberately drops the invented `str_type` / `employee_name` / `sub_text` fields. They exist only in the mock and have no backend counterpart; `PendingApprovals.vue` binds `type`, `name` and `content` instead.

### 5.4 Store contract (`store/dashboard.store.ts`)

- **State:** `isLoading`, `isLoadingAnalytics`, `isSubmitting`, `error: string | null`, `analyticsError: string | null`, `summary: DashboardSummaryResponse | null`, `analytics: DashboardAnalyticsResponse | null`, `filters: { date: string; unitId: string | number }`.
- **No `MOCK_*` constants exist in the file** (**AC-20**). Keep `isHtmlResponse()` — it is the guard that catches Laravel's `200 text/html` SPA fallback — but on detection it must set `error`, never retain stale state.
- **Actions:** `initialize()` → `await fetchSummary()` then **fire-and-forget** `fetchAnalytics()` (**AC-14**); `refresh()` → both, awaited (**AC-23**); `submitApproval(items, status, reason)` → sets `isSubmitting`, posts once, then `refresh()`; `markAnnouncementRead(id)`.
- **Getters:** `teamSize`, `approvalStats`, `attendanceStats`, `formattedPeriod`, `nextHoliday`, `actionableApprovals` (`pending === 1`), `hasTeam` (`teamSize > 0`).

### 5.5 Quick Actions directory

Every tile maps to a route that **already exists** (**AC-22**):

| Tile | Icon | Target | Group |
|---|---|---|---|
| Applications Request | `fas fa-check-circle` | `/manager/approvers-menu/applications-request` | Approvals |
| Cancellation Requests | `fas fa-ban` | `/manager/approvers-menu/appcancellation` | Approvals |
| Logsheet | `fas fa-clipboard-list` | `/manager/approvers-menu/logsheet` | Approvals |
| Team Attendance | `fas fa-user-clock` | `manager_myteam_attendance` | My Team |
| Team Timesheet | `fas fa-calendar-check` | `manager_myteam_timesheet` | My Team |
| File in Behalf | `fas fa-pen-to-square` | `manager_myteam_filing_in_behalf` | My Team |
| Duty Roster | `fas fa-users` | `manager_staff_scheduler_duty_roster` | Scheduling |
| Duty Roster Scheduler | `fas fa-calendar-days` | `manager_staff_scheduler_duty_roster_schedule` | Scheduling |
| Tardiness Report | `fas fa-clock` | `manager_management_reports_tardiness` | Reports |
| Absences Report | `fas fa-user-slash` | `manager_management_reports_absences` | Reports |
| Resolution Center | `fas fa-circle-check` | `manager_management_reports_resolution` | Reports |
| YTD Statistics | `fas fa-chart-line` | `manager_management_reports_ytd_statistics` | Reports |

### 5.6 Layout (unchanged structure, three new cards)

```
+-----------------------------------------------------------------------------------+
| Manager Dashboard                        Last updated: 09:42 AM      [ Refresh ]  |
+-----------------------------------------------------------------------------------+
| WelcomeBanner (portal="manager", red accent, next holiday)                        |
+-----------------------------------------------------------------------------------+
| ComplianceAlertsBanner  — from analytics.alerts (skeleton until deferred call)    |
+-----------------------------------------------------------------------------------+
| KpiCards: My Pending | Approved (period) | Declined (period) | Present / Team Size |
+-----------------------------------------------------------------------------------+
| LEFT (xl:col-span-2)                        | RIGHT (1/3)                         |
|  1. ApprovalSummaryChart                    |  1. QuickActions (12 tiles)         |
|  2. PendingApprovals (top 8, Approve/       |  2. TeamAttendanceSnapshot          |
|     Decline; disabled when pending === 0)   |  3. UpcomingHolidays                |
|  3. TeamTrendCard        [deferred]         |  4. TopViolatorsList   [deferred]   |
|  4. AnnouncementsFeed                       |                                     |
+-----------------------------------------------------------------------------------+
| Modals: Approval Details (binds the row) · Decline (remarks required) · Announcement |
+-----------------------------------------------------------------------------------+
```

Empty states required by Decision 6: `hasTeam === false` → "No team assigned to you yet" across KPI/attendance/approvals; `pendingApprovals.length === 0` → "Nothing waiting on you"; `holidays.length === 0` → "No upcoming holidays this month"; `error !== null` → error card + Retry.

---

## 6. Business Rules & Edge Cases

### 6.1 HRMS domain rules

1. **Approver membership, not org position, grants sight of an application.** An application is visible to a manager if and only if their `Auth::id()` appears in that record's `approvers` JSON with `status = 0`, or in an active `sub_approver` list. The org hierarchy determines the *attendance* scope, never the *approval* scope. These two scopes are intentionally different and must not be conflated (Decision 3).
2. **Sequential turn-taking is display-enforced here.** An item whose lowest pending `order` does not name this manager renders read-only with `message = "Pending Approver <n>"`. The dashboard never sends an approval for an item with `pending === 0`. Server-side enforcement of the same rule is owned by [`duty_roster_approval_workflow.md`](./duty_roster_approval_workflow.md) Decision 1.
3. **Attendance bucket precedence (exactly one bucket per subordinate).** `timesheet.timein` present + `late > 0` → **late**; `timein` present + `late = 0` → **present**; no `timesheet` row **or** row with `timein = NULL` → **absent**; no `timesheet` row **and** an `app_leave` row with `status = 1` on that date → **leave**. A real `timein` always beats an approved leave (someone who filed leave then came in anyway is present).
4. **Only active employees count.** Every metric filters `accounts.status = 1` / `vw_accounts_details.status = 1`. Separated employees never appear in team size, attendance or reports.
5. **The approval window is the current cutoff period.** `approvalStats.approved` / `.declined` count only applications dated inside `payroll_period.period_start … period_end`, so the numbers mean "this cutoff", not "ever".
6. **Sub-unit inheritance is unlimited in depth.** A Division Head sees every descendant unit, not just direct children — the existing recursive `idunder` walk, reused unchanged.

### 6.2 Edge cases

| Edge case | Issue if unhandled | Handling |
|---|---|---|
| User heads no unit | Divide-by-zero, `whereIn([])` returning everything on some drivers | Early return of an explicit zero payload before any scoped query runs (**AC-3**) |
| No active `payroll_period` | `pendingApproval()` receives `null` and its own guard returns `{message, data: []}` — an object where the caller expects a list | `period = null` + `period_notice`; the five reads are skipped entirely rather than called with `null` (**AC-13**) |
| `unit_id` outside the manager's scope | Cross-team data leak | `array_intersect` with `managedUnitIds` before use — the pattern already applied in `MyTeamController` (**AC-17**) |
| Laravel SPA fallback answers with `200 text/html` | axios does not throw; store silently keeps stale/mock data — the bug this spec exists to fix | `isHtmlResponse()` retained, but it now sets `error` (**AC-20**) |
| A subordinate has two `timesheet` rows for one date | Double counting; `keyBy('idacct')` silently keeps the last | Buckets are computed per **employee**, iterating the employee list and looking up at most one timesheet — never by iterating timesheet rows |
| `announcements` is empty or the query throws | Feed renders `undefined` | `GetAnnouncementsQuery` failure is caught inside the composing query and yields `[]`; the feed shows its empty state |
| Very large department (200+) | Slow landing page | Year-long scan confined to `/analytics`; no per-employee query loops in `summary` (**AC-24**) |
| Manager opens the dashboard and the approver inbox side by side | Counts disagree | Both read the same five `pendingApproval()` methods with the same period, so they cannot |

### 6.3 Non-Functional & Failure-Mode Checklist

| Category | Answer |
|---|---|
| **Authorization** | Both endpoints sit inside the existing `auth:sanctum` group wrapping `routes/api/manager.php`; unauthenticated → `401 {"message": "Unauthenticated."}` (**AC-16**). There is **no** additional role gate, and that is deliberate: authorization here is **data-scoped, not role-scoped**. Attendance/team data is scoped by `units.idhead = Auth::id()` and its descendants; approval data is scoped by `approvers` JSON membership. An authenticated non-manager therefore receives a structurally empty payload, never another manager's data (**AC-3**, **AC-17**) — which is also why a rank-and-file account reaching this route is a `200` with nothing in it rather than a `403`. HR/Payroll/Admin accounts hitting it get the same treatment: only what they personally head. Cross-portal reads are not possible because no parameter can widen the scope past `array_intersect(..., $managedUnitIds)`. Writes go only to `POST /api/manager/approveRequest`, whose ownership check is owned by the duty-roster spec. |
| **Concurrency / double-submit** | Approve/Decline disables its button for the in-flight request (`isSubmitting`) and the dashboard refetches on settle, so a double-click yields one POST (**AC-18**). Two managers who are both valid approvers on the same order acting simultaneously is resolved server-side by the shared engine — the second write finds the entry already `status = 1` and is a no-op; the losing client's refetch simply shows the item gone. The read endpoints are side-effect-free, so concurrent dashboard loads need no guard. `markAsRead` is protected by the unique `(idacct, idannouncement)` pair in `announcement_reads`. |
| **Idempotency on retries** | Both `GET` endpoints are pure reads — replay-safe by definition. `POST approveRequest` is idempotent on `(record id, alias, status)`: re-approving an already-`status = 1` record does not stack a second approval or duplicate a row, so a network retry or a queue re-delivery cannot double-approve (**AC-18**). `markAsRead` is idempotent on `(idacct, idannouncement)` — a replay leaves exactly one read row. Nothing in this spec inserts a monetary or accrual row, so there is no amount that a replay could double. |
| **Error response shape & status codes** | `401 {"message": "Unauthenticated."}` (unauthenticated). `422 {"message": "...", "errors": {...}}` (malformed `date`/`unit_id`, via `$request->validate()` propagating `ValidationException` — **AC-19**). `400 {"message": "<exception message>"}` for any other server-side failure, matching `HrDashboardController` and `PayrollDashboardController` verbatim (**AC-21**). **No `404` is ever returned** for a missing period or an empty team — both are legitimate `200` states (**AC-3**, **AC-13**). Client-side, a non-`2xx` or an HTML body sets `error` and renders the error card with Retry (**AC-20**). |
| **Input validation boundaries** | `date`: **null/absent** → valid, defaults to `Carbon::today()`; **empty string** → `422`; **malformed** (`"not-a-date"`, `"2026-13-45"`) → `422`; **oversized** (>10 chars) → `422` via `date_format:Y-m-d`; a far-past or far-future valid date → accepted, returns an empty snapshot rather than an error. `unit_id`: **null/absent/`"all"`** → whole managed scope; **non-numeric** (`"abc"`) → `422`; **numeric but unmanaged** → intersected to `[]`, empty result, no leak (**AC-17**); **negative or `0`** → intersected to `[]`. Approval POST: `data` must be a non-empty array of `{id: int, alias ∈ {leave,ot,cs,obt,aa}}` — an unknown alias is rejected by the existing `$aliases` map in `store()`; `cancel_reason` non-empty is enforced client-side for `status = 2` (**AC-7**), with server-side enforcement noted as out of scope in §8. |

---

## 7. Build Order

Dependency-first. Steps 1 and 2 are pure moves/extractions with no behavior change and should land as their own commits so they can be reverted independently.

1. **Extract the attendance snapshot** — create `App\Queries\Manager\GetTeamAttendanceSnapshotQuery` from `MyTeamController::getAttendanceToday()`'s stats loop; point that controller at it; verify byte-identical `statistics` output for the same date + unit before/after (**AC-8**–**AC-12**).
2. **De-duplicate team scoping** — replace `MyTeamController::getManagedUnitIds()` / `::getSubUnitIds()` bodies with delegations to `GetManagementReportsQuery`; smoke-test all four call sites (`getAttendanceToday`, `getEmployeesList`, `getRecentFilings`, `getTimesheetDetails`).
3. **Backend queries** — create `App\Queries\Manager\GetManagerDashboardQuery` (composition only) and `App\Queries\Manager\GetManagerAnalyticsQuery` (thin `getYTD` wrapper). Handle the no-team and no-period early returns first (**AC-3**, **AC-13**).
4. **Controller + routes** — create `ManagerDashboardController`; register the two `dashboard/*` GETs and the `announcements/{id}/read` alias in `routes/api/manager.php`. Verify `401`/`422`/`400` shapes by hand (**AC-16**, **AC-19**, **AC-21**).
5. **Frontend contract** — rewrite `types/types.dashboard.ts` to §5.3 and `api/dashboard.api.ts` to §5.2, deleting the nine phantom methods.
6. **Frontend move (Gate 1, pure structure)** — move the seven widgets `pages/` → `components/`, update imports in `Dashboard.vue`. No behavior change.
7. **Store rewrite** — delete all `MOCK_*` constants, add `error`/`analyticsError`/`isSubmitting`, split `initialize()` into summary-then-deferred-analytics (**AC-14**, **AC-20**).
8. **Widget rewiring** — re-shape `PendingApprovals.vue` to the real DTO with disabled-when-`pending === 0` buttons and the remarks-required decline flow (**AC-5**–**AC-7**); add empty states to `KpiCards`, `ApprovalSummaryChart`, `TeamAttendanceSnapshot`, `UpcomingHolidays`, `AnnouncementsFeed`; verify every Quick Action route name against the manager `*.routes.ts` files (**AC-22**).
9. **New deferred cards** — `TeamTrendCard.vue`, `TopViolatorsList.vue`, `ComplianceAlertsBanner.vue`, `DashboardSkeleton.vue`, each with its own skeleton + retry.
10. **Verification** — walk the full AC table against a real manager account with a real team; then a manager with **no** team; then an account heading a 3-level unit tree; compare dashboard attendance against `/manager/myteam/attendance` for the same date; compare pending counts against `/manager/approvers-menu/applications-request`.

---

## 8. Out of Scope (Future Specs)

- **Server-side sequencing + ownership enforcement in `ApprovalRequestController::store()`**, and server-side validation that `cancel_reason` is non-empty on decline — owned by [`duty_roster_approval_workflow.md`](./duty_roster_approval_workflow.md) Decision 1. This spec's client is built to be compatible with that fix but must not implement it.
- **Caching `getYTD()` per manager** (short-TTL cache or a materialized nightly aggregate). The right fix for the year-long scan, but it changes freshness semantics for the YTD Statistics page too and belongs in a spec that covers both consumers.
- **Bulk approve from the dashboard.** `POST approveRequest` already accepts an array, but multi-select UX, partial-failure reporting and an undo window are a feature of their own.
- **Realtime push.** `laravel-echo` + `pusher-js` are already dependencies; live-updating the pending count instead of manual refresh is a separate spec spanning every approver surface.
- **Per-manager widget layout preferences** (hide/reorder cards) — a global User Preferences concern, not a manager-portal one.
- **Drill-down pages for the trend card.** Tiles link to the existing report pages; new drill-down views are their own specs.
- **`MyTeamController` decomposition.** Steps 1–2 remove two duplications from a 642-line controller; extracting its remaining eight methods into Queries is a refactor spec, not this one.

---

## 9. Definition of Done

- [ ] Every row in the **Acceptance Criteria** table passes (`AC-1` through `AC-24`)
- [ ] Every category in the **Non-Functional & Failure-Mode Checklist** is addressed — answered, none marked `N/A`
- [ ] `grep -rn "MOCK_" resources/views/web/src/module/manager/dashboard/` returns **nothing**
- [ ] `grep -rn "dashboard/pending-approvals\|dashboard/approval-stats\|dashboard/team-attendance\|dashboard/approvals/" resources/views/web/src/module/manager/dashboard/` returns **nothing**
- [ ] Every URL in `api/dashboard.api.ts` resolves to a route registered in `routes/api/manager.php` (or, for reused endpoints, in the portal file named in §4.5)
- [ ] `manager/dashboard/pages/` contains exactly one file
- [ ] Dashboard attendance counts equal `/manager/myteam/attendance`'s `statistics` for the same date + unit
- [ ] Dashboard pending count equals the actionable count on `/manager/approvers-menu/applications-request` for the same period
- [ ] `npm run build` passes with no new TypeScript errors
- [ ] No open findings from adversarial verification — see the latest `.agents/reports/manager-dashboard-verify-<date>.md`
