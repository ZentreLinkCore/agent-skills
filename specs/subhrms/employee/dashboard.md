# Spec — Modernized Employee Central Dashboard

> **Kind:** Greenfield / Extension — Complete redesign and modernization of the Employee Central Dashboard (`resources/views/web/src/module/employee/dashboard/`), replacing legacy fragmented widgets with an all-in-one executive & operational command center aggregating all active Employee Portal features (Live Attendance & Shift Tracker, KPI Cards, Earnings & Privacy-Enabled Net Pay, YTD Financial Tracker, 1-Click Action Hub, Timekeeping Application Tracking with Cancellation, 7-Day Schedule Preview, Company Announcements, Loans Ledger, and Benefits Summary).
> **Portal:** **Employee Portal** (`/api/employee/dashboard` routes, `resources/views/web/src/module/employee/dashboard` frontend module).
> **Version:** v1 — 2026-08-14 — initial
> **Route:** `/employee/dashboard` (`employee_dashboard`).
> **Conventions:** [project-profile.md](../../rules/project-profile.md), [hrms-rules](../../rules/hrms-rules.md).
> **System Awareness:**
> - Models Reused: `AccountDetailVW`, `AccountJob`, `AppLeave`, `AppOvertime`, `AppChangeShift`, `AppAdjustment`, `AppOfficialBusinessTrip`, `Timesheet`, `PayrollRunDetail`, `PayPeriod`, `YtdDetail`, `EmpLoan`, `Announcement`, `Holiday`.
> - Tables Reused: `account_details_vw`, `accountjob`, `tbl_app_leave`, `tbl_app_overtime`, `tbl_app_changeshift`, `tbl_app_adjustment`, `tbl_app_obtrip`, `tbl_timesheet`, `payroll_run_detail`, `payroll_period`, `ytd_details`, `tbl_emp_loan`, `announcements`, `holiday`.
> - Routes Reused / Created: Reuses `GET /api/employee/dashboard`, `GET /api/employee/dashboard/refresh`; Reuses `POST /api/employee/cancel_application`.
> - New Migration Needed: **No** (all underlying tables and views exist across timekeeping, payroll, loans, and announcement domains).

---

## 1. Purpose

The current Employee Dashboard is largely focused on basic timekeeping counts, static links, and legacy widgets. Since its initial implementation, the SubHRMS platform has introduced rich features across the Employee Portal:
1. **Real-time Attendance Tracking & Shift Logs** (Worked hours duration, shift start/end, Clock In/Out indicators, restday/holiday flags).
2. **Timekeeping Applications & Multi-level Approvals** (Leaves, Overtime, Change Shift, Attendance Adjustment / Log Sheet, Official Business Trip).
3. **Payroll & Earnings Visibility** (Current cutoff payslip breakdown, net pay, earnings & statutory deductions).
4. **Year-to-Date (YTD) Financial & 13th Month Pay Accrual** (Cumulative gross income, taxable/non-taxable breakdown, withholding tax, projected 13th month pay).
5. **Company Loans Ledger** (Active loans balance, monthly amortizations, loan application status).
6. **Compensation & Benefit Claims** (Enrolled benefits, HMO coverage, reimbursement claims).
7. **Interactive Work Schedule & Philippine Holidays** (7-day timeline preview, upcoming regular/special holiday highlights).
8. **Company Broadcasts & Announcements** (Broadcast alerts, category pills, unread status, attachment downloads).

This spec defines the architecture for **rebuilding and replacing the Employee Dashboard** with a responsive, high-performance command center that consolidates all these features into a single, intuitive interface.

---

## 2. Design Decisions (Pros & Cons)

### Decision 1: Dashboard Backend Data Architecture

**Option A — Unified Aggregation Query (`GetEmployeeDashboardQuery`) with Structured Domain Sub-Queries (Recommended)**
- A single controller endpoint (`GET /api/employee/dashboard`) invokes `GetEmployeeDashboardQuery::execute(['idacct' => Auth::id()])`, which aggregates user profile, cutoff period, real-time attendance, KPI counts, recent applications, latest payslip, YTD summary, loans summary, 7-day schedule preview, and announcements in a single performant payload.

| Pros | Cons |
|---|---|
| Single HTTP round-trip on dashboard load prevents network waterfall and layout shifting. | Query execution touches multiple database tables in one request. |
| Consistent atomic snapshot of employee status (timekeeping, payroll, loans, announcements). | Requires structured sub-methods inside the Query class for maintainability. |
| Instant pull-to-refresh / manual refresh without firing 8 separate asynchronous calls. | |

**Option B — Multi-Endpoint Client-Side Parallel Fetching**
- The frontend fires 8+ distinct API calls simultaneously (`/api/employee/shift_schedule`, `/api/employee/payslips`, `/api/employee/loans`, `/api/employee/year-to-date`, `/api/employee/announcements`, etc.).

| Pros | Cons |
|---|---|
| Reuses existing domain controllers directly without new backend query classes. | Causes severe network waterfalls, browser connection throttling, and visible UI skeleton flickering. |
| Independent loading state per card. | 8x connection overhead and duplicate user authentication handshakes. |

**Recommendation:** Option A. Aligns with high-performance SubHRMS standards and provides a seamless single-payload experience.

---

### Decision 2: Financial & Payslip Privacy Control (Net Pay Masking)

**Option A — Privacy Eye Toggle with Local Storage Persistence (Recommended)**
- Net Pay and sensitive earnings figures in the dashboard are displayed by default or masked as `₱ ••••••` with a clickable Eye toggle (`mdi-eye-outline` / `mdi-eye-off-outline`). Preference is remembered in browser `localStorage`.

| Pros | Cons |
|---|---|
| Protects employee financial privacy in open-office and shared work environments. | Minor additional reactive state logic in the frontend. |
| Matches industry standard modern banking and HRMS portal UX patterns. | |

**Option B — Plain Text Unmasked Currency Display**
- Always render raw currency amounts (`₱28,450.00`) without privacy masking.

| Pros | Cons |
|---|---|
| Minimal template code. | Potential privacy breach when employees open dashboard in public or open spaces. |

**Recommendation:** Option A. Essential for modern employee self-service ergonomics and confidentiality.

---

### Decision 3: Quick Action Hub & Filing Dispatcher

**Option A — High-Impact Quick Launch Grid with Context-Aware Query Links & 1-Click Fast Modals (Recommended)**
- A dedicated 8-tile Quick Action Launchpad providing direct 1-click access to:
  1. *File Leave* -> `/employee/timekeeping-applications?type=leave`
  2. *File Overtime* -> `/employee/timekeeping-applications?type=ot`
  3. *Request Change Shift* -> `/employee/timekeeping-applications?type=cs`
  4. *Log Sheet / Missed Log* -> `/employee/timekeeping-applications?type=aa`
  5. *Official Business Trip* -> `/employee/timekeeping-applications?type=obt`
  6. *Submit Benefit Claim* -> `/employee/compensation-benefits`
  7. *Apply for Loan* -> `/employee/loans`
  8. *View Payslip / YTD* -> `/employee/payslip`

| Pros | Cons |
|---|---|
| Instant access to all primary employee self-service actions from a single screen. | Relies on query param routing to pre-open corresponding tabs/modals. |
| Clean separation of concerns; keeps filing logic in dedicated feature modules. | |

**Option B — Embedding Full Multi-Step Filing Forms Directly Inside Dashboard Modals**
- Duplicate filing forms inside the dashboard component tree.

| Pros | Cons |
|---|---|
| User stays on dashboard URL during filing. | Massive code duplication, bloats bundle size, and diverges from core module validation rules. |

**Recommendation:** Option A. DRY, lightweight, and leverages established portal modules.

---

### Decision 4: Layout Architecture & Grid System

**Option A — Responsive 12-Column Asymmetric Executive Layout (Recommended)**
- **Top Row**: Dynamic Welcome Header Banner with Cutoff Date Pill, ID Badge, Clock-in Status Pill, and Live Refresh Button.
- **Row 2**: 4x Executive Metric Cards (Leave Balances, Pending Approvals, Latest Net Pay with Privacy Mask, Active Loan Balance & Monthly Deduction).
- **Row 3 (Left 8 Cols)**:
  1. *Today's Live Attendance & Shift Tracker* (Shift timings, clock-in progress bar, worked hours vs required hours, fast missed log link).
  2. *Recent Applications & Status Pipeline* (Tabbed filters: All, Pending, Approved, Declined; item list with inline Details & Cancel Application action).
  3. *Financial & YTD Snapshot* (Current Payslip breakdown + YTD Gross, Taxable, Tax Withheld, and 13th Month Accrual).
- **Row 3 (Right 4 Cols)**:
  1. *8-Tile Quick Action Launchpad*.
  2. *7-Day Schedule & Upcoming Philippine Holidays Preview*.
  3. *Company Announcements Feed* (with unread tags, modal full-view, attachment download, and mark-as-read).

| Pros | Cons |
|---|---|
| Maximizes scannability; puts actionable and time-sensitive data above the fold. | Requires responsive breakpoint testing (`sm`, `md`, `lg`, `xl`). |
| Consistent with SubHRMS visual standards ([ui-design.md](../../rules/ui-design.md)). | |

**Option B — Flat Single-Column Vertical Feed**
- Simple stacked cards one after another.

| Pros | Cons |
|---|---|
| Easy to lay out. | Excessive vertical scrolling, poor screen real estate utilization on desktop/tablets. |

**Recommendation:** Option A. Highly aesthetic, dynamic, and professional.

---

## 2.5 Acceptance Criteria

| # | Given | When | Then |
|---|-------|------|------|
| **AC-1** | Authenticated employee navigates to `/employee/dashboard` | Dashboard loads | `GET /api/employee/dashboard` is called; returns `200` with user profile, attendance, metrics, applications, payslip, YTD, schedule, loans, and announcements in a single JSON payload. |
| **AC-2** | Employee has clocked in today at 08:02 AM on an 08:00 AM - 05:00 PM shift | Today's Attendance card renders | Displays Clocked In status (`is_clocked_in: true`), time in `08:02 AM`, real-time worked hours duration, and progress bar calculated against regular shift hours. |
| **AC-3** | Today is designated as a Rest Day or Philippine Holiday in the shift schedule | Attendance card renders | Displays "Rest Day" or "Holiday: [Holiday Name]", sets required hours to `0h`, disables active clock requirement, and shows appropriate badge. |
| **AC-4** | Employee has 3 pending applications (1 Leave, 1 Overtime, 1 Change Shift) | KPI Cards and Applications card render | Pending KPI card shows `3`, Pending badge displays in header, and Application Status filter accurately reflects `Pending (3)`. |
| **AC-5** | Employee clicks "Cancel Request" on a pending application with status `0` | Modal confirmation accepted | `POST /api/employee/cancel_application` is called with `{ id: app.id, type: app.type }`; on success, toast shows "Application cancelled successfully" and dashboard refreshes. |
| **AC-6** | Employee attempts to cancel an application with status `1` (Approved) or `2` (Declined) | Application row inspected | "Cancel Request" button is hidden/disabled for non-pending applications. |
| **AC-7** | Employee views the Net Pay card on the dashboard | Default or masked view | Displays masked amount `₱ ••••••`; clicking the Eye icon toggles to actual amount `₱28,450.00` and saves privacy preference to `localStorage`. |
| **AC-8** | Employee clicks "File Leave" in the Quick Actions launchpad | Action tile clicked | Router navigates to `/employee/timekeeping-applications?type=leave`. |
| **AC-9** | Employee clicks an unread company announcement item | Announcement item clicked | Opens Announcement Detail modal, renders title, author, content, attachment download buttons, and calls `POST /api/employee/announcements/{id}/read` to mark as read. |
| **AC-10** | Employee clicks the "Refresh" button in the dashboard header | Click event fires | Spins refresh icon, executes `GET /api/employee/dashboard/refresh`, updates all metrics, and displays "Dashboard data refreshed" toast. |
| **AC-11** | Unauthenticated user attempts to hit `/api/employee/dashboard` | API request received | Rejection with `401 Unauthorized` and `{"message": "Unauthenticated."}`. |
| **AC-12** | Database error occurs during dashboard data retrieval | API request received | Controller catches exception, logs error, and returns `500` with `{"message": "Failed to fetch dashboard data", "error": "..."}`. |

---

## 3. Database & Models

Reuses existing database tables without requiring new migrations.

### Reused Tables & Models

| Table Name | Model | Purpose in Dashboard |
|---|---|---|
| `account_details_vw` | `AccountDetailVW` | User profile, employee ID, position, contact info, avatar |
| `accountjob` | `AccountJob` | Position, salary rates, department assignment |
| `tbl_timesheet` | `Timesheet` | Daily time logs, clock in, clock out, actual hours |
| `tbl_app_leave` | `AppLeave` | Leave applications & balance tracking |
| `tbl_app_overtime` | `AppOvertime` | Overtime claim filings & approval status |
| `tbl_app_changeshift` | `AppChangeShift` | Shift change applications |
| `tbl_app_adjustment` | `AppAdjustment` | Attendance adjustment / missed log applications |
| `tbl_app_obtrip` | `AppOfficialBusinessTrip` | Official business trip applications |
| `payroll_run_detail` | `PayrollRunDetail` | Latest processed payslip earnings, deductions, net pay |
| `payroll_period` | `PayPeriod` | Active cutoff dates, period start, period end |
| `ytd_details` | `YtdDetail` | Annual Year-to-Date gross, tax, and deductions |
| `tbl_emp_loan` | `EmpLoan` / `AccountLoan` | Active loans, remaining balance, monthly amortizations |
| `announcements` | `Announcement` | Company bulletins, broadcast updates, attachments |
| `holiday` | `Holiday` | Philippine regular and special non-working holidays |

---

## 4. Backend Architecture

### 4.1 Route Registration (`routes/api/employee.php`)

```php
// Dashboard routes
Route::get('/dashboard', [DashboardController::class, 'index']);
Route::get('/dashboard/refresh', [DashboardController::class, 'refresh']);
Route::post('/cancel_application', [TKApplicationController::class, 'cancel_application']);
```

### 4.2 Query Implementation (`app/Queries/Employee/GetEmployeeDashboardQuery.php`)

```php
namespace App\Queries\Employee;

use App\Queries\Query;
use App\Models\AccountDetailVW;
use App\Models\AccountJob;
use App\Models\AppLeave;
use App\Models\AppOvertime;
use App\Models\AppChangeShift;
use App\Models\AppAdjustment;
use App\Models\AppOfficialBusinessTrip;
use App\Models\PayrollRunDetail;
use App\Models\Holiday;
use App\Models\Announcement;
use App\Handlers\AccountLeave\HandleAccountLeave;
use App\Handlers\Timesheet\HandleTimesheetLogs;
use App\Handlers\Shift\HandleShiftSchedule;
use App\Queries\PayPeriod\HandlePayPeriodQuery;
use App\Queries\Employee\GetEmployeeYearToDateQuery;
use App\Queries\Employee\GetEmployeeLoansQuery;
use App\Queries\Employee\GetAnnouncementsQuery;
use Exception;
use Illuminate\Support\Facades\DB;

class GetEmployeeDashboardQuery extends Query
{
    public static function execute($params = []): array
    {
        $idacct = $params['idacct'] ?? auth()->id();
        if (!$idacct) {
            throw new Exception("Unauthenticated user.");
        }

        $user = AccountDetailVW::where('id', $idacct)->first();
        $cutoff = HandlePayPeriodQuery::current_payperiod();
        $today = date('Y-m-d');

        return [
            'user' => self::buildUserProfile($user),
            'cutoff_period' => self::buildCutoffPeriod($cutoff),
            'attendance' => self::buildAttendanceData($idacct, $today),
            'metrics' => self::buildKpiMetrics($idacct),
            'recent_applications' => self::buildRecentApplications($idacct),
            'latest_payslip' => self::buildLatestPayslip($idacct),
            'ytd_summary' => self::buildYtdSummary($idacct),
            'loans_summary' => self::buildLoansSummary($idacct),
            'schedule_preview' => self::buildSchedulePreview($idacct, $today),
            'upcoming_holidays' => self::buildUpcomingHolidays($today),
            'announcements' => self::buildAnnouncements($user),
        ];
    }
    
    // Sub-builders for clean modular domain aggregation...
}
```

### 4.3 Controller (`app/Http/Controllers/employee/DashboardController.php`)

```php
namespace App\Http\Controllers\employee;

use App\Http\Controllers\Controller;
use App\Queries\Employee\GetEmployeeDashboardQuery;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Exception;

class DashboardController extends Controller
{
    public function index(Request $request)
    {
        try {
            $data = GetEmployeeDashboardQuery::execute(['idacct' => Auth::id()]);
            return response()->json($data, 200);
        } catch (Exception $e) {
            return response()->json([
                'message' => 'Failed to fetch dashboard data',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function refresh(Request $request)
    {
        return $this->index($request);
    }
}
```

---

## 5. Frontend Architecture

### 5.1 File Structure (`resources/views/web/src/module/employee/dashboard/`)

```
resources/views/web/src/module/employee/dashboard/
├── index.ts                                   # Barrel export
├── api/
│   └── dashboard.api.ts                       # API client service layer
├── composables/
│   ├── useEmployeeDashboard.ts                # Main reactive state & actions
│   └── useDashboardPrivacy.ts                 # Net Pay mask / unmask state
├── pages/
│   ├── Dashboard.vue                          # Main Hub Layout
│   ├── components/
│   │   ├── DashboardHeader.vue                # Welcome banner, ID & cutoff badges, refresh
│   │   ├── AttendanceTrackerCard.vue          # Live clock-in, shift timing, progress bar
│   │   ├── ExecutiveKpiCards.vue              # 4x top metrics cards (Leaves, Pending, Net Pay, Loans)
│   │   ├── QuickActionsLaunchpad.vue          # 8-tile 1-click filing & navigation launcher
│   │   ├── RecentApplicationsTable.vue        # Filterable requests feed with details & cancel modal
│   │   ├── FinancialEarningsCard.vue          # Latest payslip & YTD financial progress summary
│   │   ├── SchedulePreviewWidget.vue          # 7-day schedule strip & upcoming holiday card
│   │   ├── AnnouncementsWidget.vue            # Company announcements feed & unread counter
│   │   └── ApplicationDetailModal.vue         # Read-only inspect modal with Cancel Request action
│   └── modals/
│       └── AnnouncementViewModal.vue          # Full announcement modal with attachments
├── route/
│   └── dashboard.routes.ts                    # Route definition (/employee/dashboard)
└── types/
    └── dashboard.types.ts                     # TypeScript interfaces
```

### 5.2 Layout Sketch (Desktop 12-Column Grid)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [DashboardHeader] Welcome back, John Doe!  | ID: EMP-1002 | Cutoff: Aug 1-15 | Refresh│
├────────────────────────────────────────────────────────────────────────────────────────┤
│ [ExecutiveKpiCards]                                                                    │
│ ┌───────────────┐ ┌───────────────┐ ┌──────────────────────┐ ┌──────────────────────┐  │
│ │ Leave Balance │ │ Pending Req.  │ │ Latest Net Pay (Eye) │ │ Active Loan Balance  │  │
│ │   14.5 Days   │ │    3 Items    │ │   ₱ 28,450.00        │ │   ₱ 15,000.00        │  │
│ └───────────────┘ └───────────────┘ └──────────────────────┘ └──────────────────────┘  │
├──────────────────────────────────────────────────────┬─────────────────────────────────┤
│ [LEFT COLUMN - 8 COLS]                               │ [RIGHT COLUMN - 4 COLS]         │
│                                                      │                                 │
│ ┌──────────────────────────────────────────────────┐ │ ┌─────────────────────────────┐ │
│ │ [AttendanceTrackerCard] Today's Work Shift       │ │ │ [QuickActionsLaunchpad]     │ │
│ │ Regular: 08:00 AM - 05:00 PM | IN: 08:02 AM      │ │ │ [Leave] [OT] [Shift] [Adj]  │ │
│ │ Worked: 4h 30m / 8h 00m [=========>    ] 56%     │ │ │ [OBT] [Claim] [Loan] [YTD]  │ │
│ └──────────────────────────────────────────────────┘ │ └─────────────────────────────┘ │
│                                                      │                                 │
│ ┌──────────────────────────────────────────────────┐ │ ┌─────────────────────────────┐ │
│ │ [RecentApplicationsTable] Recent Requests        │ │ │ [SchedulePreviewWidget]     │ │
│ │ Tabs: [All] [Pending (3)] [Approved] [Declined]  │ │ │ Mon Tue Wed Thu Fri Sat Sun │ │
│ │ • Leave (Sick)    | Aug 18 | Pending   | [View]  │ │ │ [8-5] [8-5] [8-5] [8-5] [OFF]│
│ │ • Overtime (2.5h) | Aug 14 | Approved  | [View]  │ │ │ Next: Ninoy Aquino Day Aug21│ │
│ └──────────────────────────────────────────────────┘ │ └─────────────────────────────┘ │
│                                                      │                                 │
│ ┌──────────────────────────────────────────────────┐ │ ┌─────────────────────────────┐ │
│ │ [FinancialEarningsCard] Payslip & YTD Summary    │ │ │ [AnnouncementsWidget]       │ │
│ │ Gross: ₱32,000 | Ded: ₱3,550 | Net: ₱28,450      │ │ │ • Mid-Year Policy Update (2)│ │
│ │ YTD Gross: ₱256,000 | Est. 13th Month: ₱21,333   │ │ │ • Independence Day Schedule │ │
│ └──────────────────────────────────────────────────┘ │ └─────────────────────────────┘ │
└──────────────────────────────────────────────────────┴─────────────────────────────────┘
```

---

## 6. Business Rules & Edge Cases

### HRMS Domain Rules
1. **Attendance Calculation**:
   - Regular working day required hours = `reghrs` from `HandleShiftSchedule` (default 8 hours).
   - If today is flagged `Restday` or Philippine `Holiday`, required hours = `0h`, `working_day = false`, and clock-in is marked optional/non-mandatory.
   - Worked hours timer calculates elapsed time between `timein` and `timeout` (or current system time if still clocked in).
2. **Leave Credit Aggregation**:
   - Total available leave days sums active balances across Vacation Leave (VL), Sick Leave (SL), Emergency Leave (EL), and custom entitled leaves.
3. **Application Cancellation**:
   - Employees may ONLY cancel applications with `status = 0` (Pending).
   - Once approved (`status = 1`) or declined (`status = 2`), cancellation is locked.
4. **Net Pay & YTD Math**:
   - Net Pay = Gross Earnings - Total Statutory & Company Deductions (SSS + PhilHealth + Pag-IBIG + Withholding Tax + Loan Amortizations).
   - Estimated 13th Month Accrual = Cumulative YTD Basic Salary / 12 (per DOLE guidelines).

### Edge Cases

| Scenario | System Behavior |
|---|---|
| **No Time Logs Today** | Attendance card displays "Not Clocked In Yet", 0% progress, and prompts employee to clock in or request an attendance adjustment if missed. |
| **Overnight Shift (e.g. 10:00 PM - 06:00 AM)** | Backend duration logic detects `timeout < timein` or `ftime < stime` and spans 2 calendar days without crashing calculation. |
| **No Active Loans** | Active Loans KPI card displays `₱0.00`, subtitle reads "No outstanding loans", and clicking opens the Loan Application module. |
| **Employee with 0 Filed Applications** | Recent Applications table renders empty illustration state: *"No applications filed recently. Use Quick Actions to submit a request."* |
| **No Announcements Published** | Announcements widget displays *"No active company announcements."* |
| **Slow or Failed Network Refresh** | Disables Refresh button, shows loading spinner, and preserves current UI state if the request fails, displaying a descriptive toast error. |

### Non-Functional & Failure-Mode Checklist

| Category | Requirement & Behavior |
|---|---|
| **Authorization** | Strictly restricted to authenticated employees via `auth:sanctum` with portal role verification. Unauthorized requests receive `401 Unauthorized`. |
| **Concurrency / double-submit** | Cancel Application action disables button immediately on click and displays loading spinner to prevent double-canceling. |
| **Idempotency on retries** | `GET /api/employee/dashboard` and `GET /api/employee/dashboard/refresh` are read-only and 100% idempotent. Announcement mark-as-read is idempotent (`UPDATE WHERE idacct = ? AND announcement_id = ?`). |
| **Error response shape & status codes** | `500` with `{"message": "Failed to fetch dashboard data", "error": "..."}` on server exceptions; `422` with `{"message": "Validation error"}` on invalid inputs. |
| **Input validation boundaries** | Refresh and dashboard read endpoints accept optional sanitized filter parameters (e.g., `year` as 4-digit integer). |

---

## 7. Build Order

1. **Gate 1 (Frontend UI & Layout - Design-First with Hard-Coded Data)**:
   - Create TypeScript interfaces in `types/dashboard.types.ts`.
   - Implement `api/dashboard.api.ts` with hard-coded mockup response matching the full contract.
   - Build `useDashboardPrivacy.ts` composable for Net Pay eye toggle masking.
   - Build modern sub-components in `resources/views/web/src/module/employee/dashboard/pages/components/`:
     - `DashboardHeader.vue`
     - `AttendanceTrackerCard.vue`
     - `ExecutiveKpiCards.vue`
     - `QuickActionsLaunchpad.vue`
     - `RecentApplicationsTable.vue`
     - `FinancialEarningsCard.vue`
     - `SchedulePreviewWidget.vue`
     - `AnnouncementsWidget.vue`
     - `ApplicationDetailModal.vue`
     - `AnnouncementViewModal.vue`
   - Assemble and polish main `Dashboard.vue` with responsive 12-column layout and animations.
   - Validate UI layout, dark mode colors, typography, and interactive modals.

2. **Gate 2 (Backend Implementation & Dynamic Data Wiring)**:
   - Create `app/Queries/Employee/GetEmployeeDashboardQuery.php` aggregating domain sub-queries (Profile, Attendance, Timekeeping Applications, Leaves, Payroll, YTD, Loans, Schedule, Announcements).
   - Update `app/Http/Controllers/employee/DashboardController.php` to use `GetEmployeeDashboardQuery`.
   - Verify `routes/api/employee.php` route registrations.
   - Switch `dashboard.api.ts` from hard-coded mockup data to live API calls (`/api/employee/dashboard`).
   - Connect live cancellation action to `POST /api/employee/cancel_application`.

---

## 8. Out of Scope (Future Specs)

- Real-time WebSockets / Pusher push updates for instant live clock-in syncing (currently handles pull-to-refresh and auto-poll).
- In-dashboard loan approval simulation calculator (belongs in the dedicated `/employee/loans` module).
- Custom dashboard widget drag-and-drop repositioning (planned for v2 customizable portal layout).

---

## 9. Definition of Done

- [ ] Every row in the **Acceptance Criteria** table passes (`AC-1` through `AC-12`).
- [ ] All 10 Employee Portal features are represented cleanly on the dashboard with 1-click launchers or live summaries.
- [ ] Net Pay privacy eye toggle works smoothly and persists state across page reloads.
- [ ] Application Details modal loads full metadata and allows instant cancellation for pending requests.
- [ ] Responsive layout looks stunning on Mobile, Tablet, and Desktop with zero UI layout breaks.
- [ ] No open findings from adversarial verification report (`.agents/reports/employee-dashboard-verify-*.md`).
