# Spec — Timekeeping (Timesheet) Dashboard — Live Data Rebuild

> **Kind:** Extension — the `timekeeping/dashboard` module already exists but is a **dummy/mock design**. Every widget is fed by hard-coded fixtures inside `api/dashboard.api.ts` (Unsplash avatars, invented employees "Alexander Wright"/"Sarah Jenkins", a hand-written June 2026 shift calendar). This spec re-bases the same dashboard on the **real implementations of the existing Timekeeping pages** so each widget mirrors a page that is already live.
> **Portal:** **Timekeeping** (`/api/timekeeping/...` routes, controller namespace `tk`, frontend module `timekeeping`).
> **Route:** `timekeeping/dashboard` (`timekeeping_dashboard`) — **reused, unchanged**.
> **Conventions:** [project-profile.md](../../rules/project-profile.md), [hrms-rules.md](../../rules/hrms-rules.md), [ui-design.md](../../rules/ui-design.md), [vue-standards.md](../../rules/vue-standards.md), [duplicate-prevention.md](../../rules/duplicate-prevention.md).
> **System Awareness:**
> - **Models Reused:** `AccountDetailVW`, `Timesheet`, `TimesheetSummary`, `AttendanceException`, `AttendanceDispute`, `AppLeave`, `AppOvertime`, `AppChangeShift`, `AppAdjustment`, `AppOfficialBusinessTrip`, `Shift`, `AccountJob`, `PayPeriod`, `Holiday`, `TransLog`. **Models Created:** none.
> - **Tables Reused:** `vw_accounts_details`, `timesheet`, `timesheet_summary`, `attendance_exceptions`, `attendance_disputes`, `app_leave`, `app_overtime`, `app_shift`, `app_adjustment`, `app_obt`, `shift`, `accountjob`, `payroll_period`, `holidays`, `translog`. **Tables Created:** none.
> - **Queries Reused (composed, not rewritten):** `GetDailyMonitoringDashboardQuery`, `GetDailyAttendanceBoardQuery`, `GetPeriodLockStatusQuery`, `GetTimesheetAdjustmentStatisticsQuery`, `GetTimesheetAdjustmentsQuery`, `GetExceptionsQuery`, `GetResolutionStatisticsQuery`, `GetHolidaysQuery`, `GetTransactionLogsQuery`, `HandlePayPeriodQuery::handlePeriod`.
> - **Routes Created:** `GET /api/timekeeping/dashboard/summary` (single endpoint).
> - **New Migration Needed:** **No** — every metric is derived from existing tables.

---

## 1. Purpose

The Timekeeping Dashboard is the landing page for the Timekeeping portal (`useSidebarLinks.ts` → "Dashboard", `/timekeeping/dashboard`). Today it renders convincingly but is **entirely fictional**: `useDashboardApi().getDashboardData()` returns a literal object, `approveRequest()`/`rejectRequest()` return `{ success: true }` without touching the server, and `useDashboard.ts` seeds `MOCK_METRICS` / `MOCK_FORMATTED_PERIOD` as fallbacks. A timekeeping officer cannot act on anything they see.

This spec defines the **live rebuild**: keep the existing layout language and component set, but drive every widget from the queries that already power the real Timekeeping pages — Daily Monitoring, Timesheet Processing, Timesheet Closing, Timesheet Adjustment, Applications, Resolution Center, Shift Schedule / Duty Roster, Holidays, and Transaction Logs. The dashboard becomes a **read-mostly roll-up plus deep links**: it answers "what is the state of the cutoff, and what needs me right now?" and hands off to the page that owns each action.

### 1.1 Widget → Source Page Mapping (the core of this spec)

Every dashboard block must trace to an already-implemented page. Nothing on the dashboard may exist without an owning page.

| Dashboard block | Owning page (route name) | Existing query reused | Existing endpoint the page uses |
|---|---|---|---|
| Cutoff / Period header | Timesheet Closing (`timesheet_closing`) | `GetPeriodLockStatusQuery` | `GET /timesheet-closing/status` |
| Processing Status card | Timesheet Processing (`timesheet_processing`) | `GetPeriodLockStatusQuery` (`processedCount` / `totalEmployees` / `lockedCount`) | `GET /timesheet-processing/roster` |
| Attendance KPI cards | Daily Monitoring (`timekeeping_daily_monitoring`) | `GetDailyMonitoringDashboardQuery` → `stats` | `GET /daily-monitoring/dashboard` |
| Clocked-In panel | Daily Monitoring → Attendance Board | `GetDailyAttendanceBoardQuery` | `GET /daily-monitoring/board` |
| Approval Queue | Timesheet Adjustment (`tk_timesheet_adjustment`) + Applications (`tk_applications`) | `GetTimesheetAdjustmentsQuery` (per category) | `GET /timesheet-adjustments` |
| Operations Summary chart | Timesheet Adjustment metrics | `GetTimesheetAdjustmentStatisticsQuery` (per category) | `GET /timesheet-adjustments/statistics` |
| Urgent Alerts | Resolution Center (`resolution_center`) | `GetExceptionsQuery` + `GetResolutionStatisticsQuery` | `GET /resolution-center/exceptions`, `/statistics` |
| Shift Schedule strip | Duty Roster (`tk_applications_duty_roster`) / Calendar Schedule (`calendar_schedule`) | `GetDutyRosterQuery` / `GetCalendarScheduleQuery` | `GET /duty-roster`, `GET /calendar-schedule` |
| Upcoming Holidays | Holidays (`tk_holidays`) | `GetHolidaysQuery` | `GET /holidays` |
| Recent Activity feed | Transaction Logs (`transaction_logs`) | `GetTransactionLogsQuery` | `GET /transaction-logs` |
| Quick Actions hub | all of the above | — (static route map) | — |

---

## 2. Design Decisions (Pros & Cons)

### Decision 1: Backend aggregation shape

**Option A — One `GetTimekeepingDashboardQuery` that COMPOSES the existing queries (Recommended)**
- New `App\Queries\Timesheet\GetTimekeepingDashboardQuery` calls the already-shipped queries statically (`GetDailyMonitoringDashboardQuery::execute(...)`, `GetPeriodLockStatusQuery::execute(...)`, `GetTimesheetAdjustmentStatisticsQuery::execute(['category' => …])`, `GetResolutionStatisticsQuery::execute()`, …), trims each result to the fields the dashboard renders, and returns one JSON envelope. It writes **no new SQL** for anything an existing query already answers.

| Pros | Cons |
|---|---|
| Directly satisfies the repo rule "reuse before creating new functions" — zero duplicated SQL. | Composition means the dashboard inherits each query's cost; needs the caps in Decision 5. |
| Dashboard numbers can never drift from the page they link to — same query, same result. | One slow child query slows the whole payload. |
| Single request on page load, one consistent snapshot across widgets. | Payload ~20–30 KB. |
| Mirrors the shipped `GetPayrollDashboardQuery` precedent for the sibling portal. | — |

**Option B — New purpose-built SQL for the dashboard**
- Hand-write tuned aggregate SQL for each KPI instead of calling the page queries.

| Pros | Cons |
|---|---|
| Each number can be a single tight aggregate; potentially fastest. | Duplicates logic that already exists in ~8 query classes — exactly the drift the CLAUDE.md convention forbids. |
| No coupling to page-query return shapes. | Dashboard "Late: 12" and Daily Monitoring "Late: 14" will eventually disagree — the classic dashboard bug. |

**Option C — Multi-endpoint, one call per widget from the frontend**
- Frontend calls the existing page endpoints directly (`/daily-monitoring/dashboard`, `/timesheet-closing/status`, …) with no new backend at all.

| Pros | Cons |
|---|---|
| Zero backend work; each widget loads independently with its own skeleton. | 7+ round trips on every dashboard load. |
| Absolutely no duplication. | Widgets snapshot at different instants; a cutoff locked mid-load shows inconsistently. |
| — | Frontend must know and re-shape 7 different payload contracts. |

**Recommendation: Option A.** It is the only option that both honours the reuse rule and gives a consistent single-snapshot payload. Option C is a viable fallback if backend work must be deferred — the frontend contract in §5 is written so the composable can be pointed at either without changing the components.

---

### Decision 2: Can the dashboard approve/reject, or does it deep-link?

**Option A — Read-only queue + deep link to the owning page (Recommended)**
- Approval Queue rows are informational. Each row's primary action navigates to `tk_timesheet_adjustment` (or the matching Applications sub-page) pre-filtered to that record. The dashboard ships **no** approve/reject endpoints.

| Pros | Cons |
|---|---|
| Approval already has a full workflow on its owning page (details modal, remarks, per-category rules) — no duplicate write path. | Two clicks to approve instead of one. |
| No new write endpoints, no new permission surface, no double-approval race with the page. | — |
| Removes the current fake `approveRequest`/`rejectRequest` honestly rather than half-implementing them. | — |
| Keeps the dashboard cacheable (Decision 5) — a read-only page has no invalidation problem. | — |

**Option B — Inline approve/reject on the dashboard**
- Wire the existing `POST /timesheet-adjustments/{id}/approve` and `/reject` to the queue buttons.

| Pros | Cons |
|---|---|
| One-click approval from the landing page. | Approving without opening the record's details invites rubber-stamping — a real audit concern for timekeeping. |
| Endpoints already exist; small frontend change. | Adjustment approval is category-specific (`app_leave` vs `app_shift` vs `app_overtime`); the queue would need to carry the category and route correctly per row. |
| — | Breaks the read-only caching model; every action must bust the dashboard cache. |

**Recommendation: Option A**, and it is worth saying plainly: this is the decision that changes the most about the current screen. If the business *wants* one-click approval from the dashboard, that is a policy call, not a technical one — say so and we take Option B, restricted to the `logsheet` and `overtime` categories where the approval is unambiguous.

---

### Decision 3: What feeds the Approval Queue

**Option A — Union across all five `app_*` categories, pending only, newest first (Recommended)**
- Call `GetTimesheetAdjustmentsQuery::execute(['category' => c, 'status' => 0, 'per_page' => 5])` for each of `logsheet`, `change-shift`, `overtime`, `obt`, `leaves`; merge, sort by filed date desc, cap at 10 rows. Counts come from `GetTimesheetAdjustmentStatisticsQuery` (which already sums all five tables when no category is passed).

| Pros | Cons |
|---|---|
| Matches what the officer actually triages — one queue, all request types. | Five queries per load (mitigated by the `per_page` cap and Decision 5's cache). |
| Both the list and the totals reuse shipped queries; the badge count and the list can't disagree. | Cross-category sort happens in PHP, not SQL. |
| Category is carried per row, so the deep link goes to the right sub-page. | — |

**Option B — Single category (`logsheet`) only**
- Show only logsheet adjustments, as the highest-volume type.

| Pros | Cons |
|---|---|
| One query, fastest. | Leaves, OT, OBT and shift-change requests become invisible on the landing page — the officer misses work. |

**Option C — New unified `UNION ALL` query across the five tables**
- Write one SQL union so the sort and limit happen in the database.

| Pros | Cons |
|---|---|
| Correct DB-side ordering and a true global `LIMIT 10`. | New SQL duplicating the five per-category builders inside `GetTimesheetAdjustmentsQuery`. |
| One round trip. | If `GetTimesheetAdjustmentsQuery` changes its joins/filters, this diverges silently. |

**Recommendation: Option A.** With `per_page = 5` per category the cost is bounded and nothing is duplicated. Revisit Option C only if profiling shows the five calls dominate the payload time — and if so, extract the union into `GetTimesheetAdjustmentsQuery` as a shared method rather than a parallel class.

---

### Decision 4: The shift-schedule widget

**Option A — Duty Roster week strip for the current week (Recommended)**
- Reuse `GetDutyRosterQuery` for `today .. today+6`, grouped by day, showing per-shift headcount (e.g. "Mon 9 — Day 24, Evening 8, Night 5") rather than naming individuals.

| Pros | Cons |
|---|---|
| Aggregated headcount stays readable at any company size — the current per-employee mock breaks past ~10 staff. | Loses per-employee detail (recovered by the deep link to Duty Roster). |
| Directly reuses the roster the Duty Roster page already renders. | Requires grouping logic in the composing query. |
| Immediately answers the real question: "is any day this week under-staffed?" | — |

**Option B — Calendar Schedule month grid**
- Reuse `GetCalendarScheduleQuery` and render the month, matching the current mock's month-calendar shape.

| Pros | Cons |
|---|---|
| Closest to the existing `ShiftSchedule.vue` (296 lines) — least frontend rework. | A month grid of shift assignments is a page, not a dashboard widget; it dominates the layout. |
| Shows holidays inline. | Month-wide payload for a card most users scan for 2 seconds. |

**Option C — Drop the widget; keep only Upcoming Holidays**
- Replace the schedule block with a compact holidays + cutoff-dates list.

| Pros | Cons |
|---|---|
| Smallest payload; holidays are what most affect the cutoff. | Loses all staffing-coverage visibility from the landing page. |

**Recommendation: Option A**, with the Upcoming Holidays list from Option C folded in as a strip beneath it — holidays are cheap (`GetHolidaysQuery`, filtered to the next 30 days) and materially change how a week's roster reads.

---

### Decision 5: Freshness, cost control, and the "no data yet" case

**Option A — Manual refresh + short server-side cache + explicit caps (Recommended)**
- Keep the existing Refresh button (no auto-polling). Cache the composed payload for **60 seconds** keyed by `(period_id, target_date)`. Hard caps: approval queue 10 rows, clocked-in 8 rows, alerts 5 rows, activity 8 rows, holidays 5 rows. `GetDailyMonitoringDashboardQuery`'s existing behaviour of falling back to `MAX(timesheet.date)` when today has no logs is **preserved** — it is what keeps a demo/seed database from rendering an all-zero dashboard.

| Pros | Cons |
|---|---|
| Bounded cost regardless of headcount; a refresh burst can't stampede the DB. | Data can be up to 60s stale (acceptable — no widget is a live clock). |
| Caps keep the payload small and the page scannable. | Cache must be keyed carefully or a period switch shows the previous period. |
| The `MAX(date)` fallback avoids the "empty dashboard" first impression on non-production data. | Fallback date must be **labelled** in the UI or the officer misreads stale data as today. |

**Option B — No cache, live on every load**
| Pros | Cons |
|---|---|
| Always current. | Every landing-page hit runs ~10 aggregate queries; the dashboard is the most-hit route in the portal. |

**Option C — Auto-poll every 30s**
| Pros | Cons |
|---|---|
| Feels live, matches the "Live Operation" badge already in the header. | Multiplies Option B's cost by every idle open tab, all day. |

**Recommendation: Option A.** Additionally, when the fallback date is in play the header must render `Showing data for <date> (latest available)` — silently showing old numbers as "today" is worse than showing zeros.

---

### Decision 6: Employee identity and avatars

**Option A — `vw_accounts_details.profile`, initials fallback (Recommended)**
- Names from `fullname`, role from `position`, unit from `unit`, avatar from `profile`; when `profile` is null, render an initials chip. This is exactly what `GetDailyAttendanceBoardQuery` already returns.

| Pros | Cons |
|---|---|
| Real employees; identical rendering to the Attendance Board the officer already knows. | Initials chips are less visually rich than the mock's stock photos. |
| No external image host — the current Unsplash URLs are a hard dependency on a third party from an internal HRMS page. | — |

**Option B — Keep remote placeholder avatars when `profile` is null**
| Pros | Cons |
|---|---|
| Uniformly "designed" look. | Attaches a stranger's face to a named employee — unacceptable in an HR system. |

**Recommendation: Option A.** Option B is not a real option for a system that displays employee records; it is listed only to close it out.

---

## 3. Database

**No migration. No new tables. No new columns.** Every value is derived from tables that already back the Timekeeping pages.

| Table | Model | Columns read | Filter |
|---|---|---|---|
| `payroll_period` | `PayPeriod` | `id`, `period_start`, `period_end`, `tk_process_status` | active period via `HandlePayPeriodQuery::handlePeriod()` |
| `vw_accounts_details` | `AccountDetailVW` | `id`, `empid`, `fullname`, `unit`, `position`, `profile`, `status` | `status = 1` |
| `timesheet` | `Timesheet` | `idacct`, `date`, `timein`, `timeout`, `late`, `absent` | `date = <target date>` |
| `timesheet_summary` | `TimesheetSummary` | `idpayperiod`, `is_locked` | `idpayperiod = <active>` |
| `attendance_exceptions` | `AttendanceException` | `id`, `status`, `severity`, `issue_type`, `idacct`, `created_at` | `status = 'Unresolved'` |
| `attendance_disputes` | `AttendanceDispute` | `id`, `status` | `status = 'Pending'` (count only) |
| `app_adjustment` / `app_shift` / `app_overtime` / `app_obt` / `app_leave` | `AppAdjustment`, `AppChangeShift`, `AppOvertime`, `AppOfficialBusinessTrip`, `AppLeave` | `id`, `idacct`, `idpayperiod`, `status`, `docnumber`, `date`, `remarks`, `cancel_at` | `status = 0` (pending), `cancel_at IS NULL` |
| `shift` | `Shift` | `id`, `name`, `type`, `color`, `is_night_shift`, `status` | `status = 1` |
| `accountjob` | `AccountJob` | `idacct`, `wshift` | joined for roster resolution |
| `holidays` | `Holiday` | `date`, `name`, `type` | next 30 days |
| `translog` | `TransLog` | `module`, `action`, `created_at`, user ref | `module IN (TIMESHEET_PROCESSING, TIMESHEET_ADJUSTMENT, TIMESHEET_CLOSING, LEAVE_RECORDS, BIOMETRIC_SYNC)` |

> Status conventions in play (do not re-derive): application `status` is `0=Pending, 1=Approved, 2=Rejected`, cancellation is `cancel_at IS NOT NULL` (not a status value); `payroll_period.tk_process_status = 1` means the timekeeping side of the cutoff is **Locked**.

---

## 4. Backend

### 4.1 New query — the only new backend class

`app/Queries/Timesheet/GetTimekeepingDashboardQuery.php` → `App\Queries\Timesheet\GetTimekeepingDashboardQuery extends Query`, `public static function execute($params = [])`.

It is a **composer**. Its body must not contain SQL for anything below; it calls and reshapes:

| Section | Delegates to | Notes |
|---|---|---|
| `period` | `HandlePayPeriodQuery::handlePeriod($params)` | Also supports `prev`/`next`/`idperiod` navigation for free. |
| `closing` | `GetPeriodLockStatusQuery::execute($params)` | Yields `status`, `totalEmployees`, `processedCount`, `lockedCount`, `exceptionsCount`. |
| `attendance` | `GetDailyMonitoringDashboardQuery::execute(['date' => $date])` | Take `stats` only; discard `exceptions`/`deptBreakdown` unless the dept strip is kept. |
| `clockedIn` | `GetDailyAttendanceBoardQuery::execute(['date' => $date, 'status' => 'Present'])` | Slice to 8. |
| `queueCounts` | `GetTimesheetAdjustmentStatisticsQuery::execute([])` and once per category | No-arg call already sums all five tables. |
| `approvalQueue` | `GetTimesheetAdjustmentsQuery::execute(['category' => c, 'per_page' => 5])` × 5 | Filter `status = 0`, merge, sort desc, slice 10. |
| `alerts` | `GetExceptionsQuery::execute(['status' => 'Unresolved'])` + `GetResolutionStatisticsQuery::execute()` | Slice 5, severity-first. |
| `roster` | `GetDutyRosterQuery::execute(['from' => today, 'to' => today+6])` | Group by day → per-shift counts. |
| `holidays` | `GetHolidaysQuery::execute([...])` | Next 30 days, slice 5. |
| `activity` | `GetTransactionLogsQuery::execute(['per_page' => 8, ...])` | Timekeeping modules only. |

> [!IMPORTANT]
> Per [duplicate-prevention.md](../../rules/duplicate-prevention.md) and the project CLAUDE.md rule: if a needed shape is *close but not exact* (e.g. `GetDutyRosterQuery` returns per-employee rows and the widget wants per-day counts), **extract the shared core into a reusable method on the existing query class** and call it from both sites — do not copy the builder into the dashboard query.

**Caching:** wrap the composed result in `Cache::remember("tk_dashboard:{$periodId}:{$targetDate}", 60, fn() => …)` per Decision 5.

### 4.2 Controller

Extend the existing `App\Http\Controllers\tk\DailyMonitoringController`? **No** — add a dedicated thin controller `App\Http\Controllers\tk\TimekeepingDashboardController` with one method, mirroring the sibling `PayrollDashboardController`:

```php
public function summary(Request $request)
{
    try {
        $data = GetTimekeepingDashboardQuery::execute($request->all());
        return response()->json($data);
    } catch (Exception $e) {
        return response()->json(['message' => $e->getMessage()], 400);
    }
}
```

Raw `response()->json(...)`, no API Resource — per project-profile.

### 4.3 Route registration

In `routes/api/timekeeping.php`, add beside the existing daily-monitoring group (and add the `use` import at the top of that same file):

```php
// timekeeping dashboard
Route::get('/dashboard/summary', [TimekeepingDashboardController::class, 'summary']);
```

Final URL: `GET /api/timekeeping/dashboard/summary` (prefix + `auth:sanctum` inherited from `routes/api.php`). **No** `api/tk/...` route.

Accepted params: `date` (optional, defaults today with the `MAX(timesheet.date)` fallback), plus the `HandlePayPeriodQuery` navigation params (`idperiod`, `period`, `prev`, `next`).

---

## 5. Frontend

### 5.1 Module layout — `resources/views/web/src/module/timekeeping/dashboard/`

The current module puts widget components under `pages/`, which is wrong per project-profile (only views belong in `pages/`). Correct it as part of this work:

```
dashboard/
├── index.ts                          # unchanged barrel
├── route/dashboard.routes.ts         # unchanged
├── api/dashboard.api.ts              # REWRITE — real http.get, mock object deleted
├── composables/useDashboard.ts       # REWRITE — MOCK_* seeds deleted
├── types/types.dashboard.ts          # REWRITE — mirrors the envelope below
├── pages/Dashboard.vue               # keep as the only page
└── components/                       # MOVED from pages/
    ├── CutoffStatusCard.vue          # new — period + lock + processing progress
    ├── KpiCards.vue                  # moved; re-bound to attendance stats
    ├── OperationsSummaryChart.vue    # moved; re-bound to per-category counts
    ├── ApprovalQueue.vue             # moved; read-only + deep links
    ├── ClockedInPanel.vue            # moved; real employees
    ├── UrgentAlerts.vue              # moved; real exceptions
    ├── ShiftSchedule.vue             # moved; week strip (Decision 4A)
    ├── UpcomingHolidays.vue          # new
    ├── RecentActivity.vue            # new
    ├── QuickActions.vue              # moved; router-link to real route names
    └── DashboardSkeleton.vue         # new — replaces the mock's instant-data illusion
```

### 5.2 API contract — `GET /api/timekeeping/dashboard/summary`

```jsonc
{
  "period": {
    "id": 42, "periodStart": "2026-08-01", "periodEnd": "2026-08-15",
    "label": "Aug 01 – Aug 15, 2026", "tkProcessStatus": 0
  },
  "asOf": { "date": "2026-08-07", "isFallback": false, "generatedAt": "2026-08-07 09:12:00" },
  "closing": {
    "status": "Open", "totalEmployees": 248, "processedCount": 190,
    "lockedCount": 0, "exceptionsCount": 17, "processedPct": 77
  },
  "attendance": {
    "headcount": 248, "present": 201, "late": 12, "absent": 9,
    "leave": 6, "underReview": 4, "checkedInRate": 83
  },
  "queueCounts": {
    "total": 31, "pending": 17, "approved": 12, "rejected": 2,
    "byCategory": { "logsheet": 6, "change-shift": 3, "overtime": 5, "obt": 1, "leaves": 2 }
  },
  "approvalQueue": [
    { "id": 901, "category": "overtime", "categoryLabel": "Overtime",
      "docNumber": "OT-2026-0091", "empId": "EMP-0142", "employeeName": "…",
      "position": "…", "unit": "…", "profile": null,
      "date": "2026-08-06", "remarks": "…", "status": 0, "filedAt": "2026-08-06 18:22:00",
      "routeName": "tk_applications_overtime" }
  ],
  "clockedIn": [
    { "empId": "EMP-0007", "fullname": "…", "position": "…", "unit": "…",
      "profile": null, "shift": "Day (08:00 - 17:00)", "timein": "07:54",
      "timeout": "--:--", "status": "Present", "warning": null }
  ],
  "alerts": {
    "unresolvedExceptions": 14, "pendingDisputes": 3, "slaRate": 92.4,
    "items": [ { "id": 55, "empId": "EMP-0031", "employeeName": "…", "profile": null,
                 "issueType": "Missing Timeout", "severity": "High",
                 "createdAt": "2026-08-06 22:10:00" } ]
  },
  "roster": {
    "weekStart": "2026-08-03",
    "days": [ { "date": "2026-08-03", "dayLabel": "Mon", "total": 37,
                "shifts": [ { "name": "Day", "color": "emerald", "count": 24 } ],
                "isHoliday": false, "holidayName": null } ]
  },
  "holidays": [ { "date": "2026-08-21", "name": "Ninoy Aquino Day", "type": "Special", "daysAway": 14 } ],
  "activity": [ { "id": 7781, "module": "Timesheet Processing", "action": "Update",
                  "description": "…", "user": "…", "createdAt": "2026-08-07 08:40:00" } ]
}
```

### 5.3 `api/dashboard.api.ts` (replaces the mock wholesale)

```ts
import http from '@/app/axios/axiosInstance';
import type { DashboardSummary } from '../types/types.dashboard';

export function useDashboardApi() {
  return {
    getSummary: async (params: Record<string, any> = {}): Promise<DashboardSummary> => {
      const response = await http.get('api/timekeeping/dashboard/summary', { params });
      return response.data;
    }
  };
}
```

`approveRequest` / `rejectRequest` are **deleted** (Decision 2A), along with `GenericActionResponse`.

### 5.4 `composables/useDashboard.ts`

- Delete `MOCK_METRICS`, `MOCK_FORMATTED_PERIOD`, and the mock-shaped defaults. Empty state must render as empty, not as fiction.
- **Keep** the existing `isHtmlResponse` / `extractArray` / `extractObject` guards — they defend against an HTML login redirect being parsed as data, which is a real failure mode here.
- Expose: `isLoading`, `isRefreshing`, `lastUpdated`, `summary`, plus computed slices (`period`, `closing`, `attendance`, `approvalQueue`, `clockedIn`, `alerts`, `roster`, `holidays`, `activity`), `asOfLabel`, and `refresh()`.
- Delete `approveRequest` / `rejectRequest` / `resolveAlert` and their optimistic metric decrements — they mutated fake local state.

### 5.5 Layout sketch

```
┌──────────────────────────────────────────────────────────────────────┐
│ Timekeeping Dashboard        Aug 01 – Aug 15, 2026 · Open  [Refresh] │
│ (banner: cutoff badge · "as of <date>" if fallback · queue badge)     │
├──────────────────────────────────────────────────────────────────────┤
│ CUTOFF STATUS  ▸ 190/248 processed (77%) · 0 locked · 17 exceptions   │
│                 [Go to Timesheet Processing] [Go to Closing]          │
├──────────────────────────────────────────────────────────────────────┤
│ [Present 201] [Late 12] [Absent 9] [On Leave 6] [Under Review 4]      │
├───────────────────────────────────────┬──────────────────────────────┤
│ Pending Requests by Category (chart)  │ Quick Actions                │
│ Week Roster strip (Mon…Sun coverage)  │ Clocked In (8)               │
│ Upcoming Holidays                     │ Urgent Alerts (5)            │
│ Approval Queue (10, read-only + link) │ Recent Activity (8)          │
└───────────────────────────────────────┴──────────────────────────────┘
```

### 5.6 Frontend conventions

- Globally registered — do **not** import: `Spinner`, `Loading`, `StatusBadge`, `EmptyState`, `TableSkeleton`, `Pagination`, `CSelect`, `VDatePicker`. Import `Modal`, `WelcomeBanner` (`@/src/components/WelcomeBanner.vue`, already used).
- Every list block needs three states: skeleton → data → `EmptyState`. The mock never had an empty state because it never had no data.
- Quick Actions and every "view all" must use `router-link :to="{ name: '<route_name>' }"` with the names from §1.1 — no hard-coded URL strings.
- Keep the existing dark-mode Tailwind pairs (`text-slate-900 dark:text-white`, etc.); the current design language is fine and is **not** what this spec is changing.

---

## 6. Business Rules & Edge Cases

| # | Rule / Edge case | Handling |
|---|---|---|
| 1 | Timekeeping is a distinct portal — never surface payroll amounts (gross/net) here. | Dashboard shows counts and hours only; money lives on `payroll_dashboard`. |
| 2 | Application `status`: `0=Pending, 1=Approved, 2=Rejected`; cancelled is `cancel_at IS NOT NULL`. | Queue filters `status = 0 AND cancel_at IS NULL`; cancelled never appears as pending. |
| 3 | `payroll_period.tk_process_status = 1` ⇒ cutoff Locked. | Status card shows Locked; Quick Actions that mutate the cutoff are disabled with a tooltip. |
| 4 | No active pay period resolvable. | `GetPeriodLockStatusQuery` already returns the `status: 'Open', period: null` shape — render "No active period" and suppress period-scoped widgets. |
| 5 | Today has no `timesheet` rows (fresh/seed DB). | Existing `MAX(timesheet.date)` fallback stands, but `asOf.isFallback = true` and the header **must** label the date shown. |
| 6 | Employees on approved leave. | Excluded from the present/absent walk and from `checkedInRate`'s denominator — this is `GetDailyMonitoringDashboardQuery`'s existing behaviour; do not re-derive it. |
| 7 | `vw_accounts_details.profile` is null. | Initials chip. Never a stock/remote photo (Decision 6). |
| 8 | Large headcount (1000+). | All caps in Decision 5 apply server-side (slice in the query, not the component) so payload size is headcount-independent. |
| 9 | Dashboard count vs. owning page count disagree. | Cannot happen by construction — same query. If it does, the bug is in the dashboard's reshaping, not in new SQL. |
| 10 | Cache staleness after an approval on another page. | 60s TTL keyed by `(period_id, target_date)`; Refresh passes a cache-bypass flag. |
| 11 | Session expired mid-load → HTML login page returned. | `isHtmlResponse` guard already in the composable; keep it, surface a toast rather than rendering garbage. |
| 12 | Portal separation. | Route stays under `auth:sanctum` in `routes/api/timekeeping.php`; no employee/manager-portal data is exposed. |

---

## 7. Build Order

1. **No migration** — confirm and move on.
2. `app/Queries/Timesheet/GetTimekeepingDashboardQuery.php` — compose the existing queries; where a shape is close-but-not-exact, extract a shared method onto the *existing* query class first.
3. `app/Http/Controllers/tk/TimekeepingDashboardController.php` — thin, one `summary()` method, try/catch, raw JSON.
4. Register `GET /dashboard/summary` in `routes/api/timekeeping.php` + the `use` import; verify the URL resolves as `api/timekeeping/dashboard/summary`.
5. Add the 60s cache and the server-side row caps; sanity-check payload size and query count.
6. **Frontend Gate 1 (structure/design):** move widgets `pages/` → `components/`, add `CutoffStatusCard`, `UpcomingHolidays`, `RecentActivity`, `DashboardSkeleton`; rewrite `types/types.dashboard.ts` to the §5.2 envelope; build all three states (skeleton/data/empty) against a typed fixture.
7. **Frontend Gate 2 (live wiring):** rewrite `api/dashboard.api.ts` to the real endpoint; rewrite `useDashboard.ts` with the mock seeds removed and the HTML guards kept; delete `approveRequest`/`rejectRequest`.
8. Wire every deep link and Quick Action to the real route names from §1.1.
9. Verify against the owning pages: dashboard KPI vs Daily Monitoring, processed count vs Timesheet Closing, queue counts vs Timesheet Adjustment metrics — the numbers must match exactly.
10. Delete every remaining fixture: the Unsplash URLs, the invented employee names, the June 2026 shift array, `MOCK_METRICS`, `MOCK_FORMATTED_PERIOD`.

---

## 8. Out of Scope (Future Specs)

- **Inline approve/reject from the dashboard** — Decision 2 Option B; needs a business ruling first.
- **Auto-refresh / WebSocket live tiles** — Decision 5 Option C; revisit only if the "Live Operation" badge is meant literally.
- **Department drill-down** — `GetDailyMonitoringDashboardQuery` already returns `deptBreakdown`; a per-department dashboard view is its own spec.
- **Configurable/rearrangeable widgets per user** — needs a preferences table; not in this pass.
- **Manager-portal team dashboard** — different portal, different scope (`manager/dashboard` module already exists).
- **Trend charts over multiple cutoffs** (attendance rate over time) — needs a period-series query; not covered here.
- **Export / print of the dashboard.**

---

## Next Steps

- Frontend from this spec: `/webkit.frontend-implement resources/views/web/src/module/timekeeping/dashboard using .agents/specs/subhrms/timekeeping/timekeeping_dashboard.md`
- Backend + live wiring: `/webkit.backend-implement app/Queries/Timesheet using .agents/specs/subhrms/timekeeping/timekeeping_dashboard.md`
