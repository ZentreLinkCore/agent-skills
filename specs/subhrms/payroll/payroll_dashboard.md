# Spec — Redesign & Implement Payroll Dashboard

> **Kind:** Extension — Redesigning the Payroll Dashboard UI and adding live backend query aggregation.
> **Portal:** **Payroll** (`/api/payroll/...` routes, `payroll/dashboard` frontend module).
> **Route:** `payroll/dashboard` (`payroll_dashboard`).
> **Conventions:** [project-profile.md](../../rules/project-profile.md), [hrms-rules.md](../../rules/hrms-rules.md), [ui-design.md](../../rules/ui-design.md), [vue-standards.md](../../rules/vue-standards.md).
> **System Awareness:**
> - **Models Reused:** `PayPeriod`, `PayrollRun`, `PayrollRunDetail`, `ProcessingCheckpoint`, `Account`, `PayrollEntryBatch`, `PayrollLoan`, `PayrollRecurringEntry`, `TransLog`.
> - **Tables Reused:** `payroll_period`, `payroll_run`, `payroll_run_detail`, `processing_checkpoints`, `accounts`, `payroll_entry_batch`, `payroll_loan`, `payroll_recurring_entry`, `trans_log`.
> - **Routes Created:** `GET /api/payroll/dashboard/summary`, `GET /api/payroll/dashboard/analytics`, `GET /api/payroll/dashboard/activities`.
> - **New Migration Needed:** No (all analytics and metrics are computed dynamically from existing tables).

---

## 1. Purpose

The Payroll Dashboard serves as the central command center for payroll administrators. It provides real-time visibility into active payroll processing cycles, pending approvals, processing errors, upcoming pay dates, regulatory filing deadlines, and gross/net payroll cost metrics. 

This spec defines the complete redesign of the Payroll Dashboard UI and its backend aggregation layer, reducing navigation friction from multi-step workflows down to single-click actions and presenting clear visual indicators for operational state.

---

## 2. Design Decisions (Pros & Cons)

### Decision 1: Backend Data Aggregation Pattern

**Option A — Unified Dashboard Summary Query (`GetPayrollDashboardQuery`) (Recommended)**
- Create a single optimized Query class (`App\Queries\Payroll\GetPayrollDashboardQuery`) that collects summary KPIs, active period state, processing progress, pending tasks, and calendar events in one JSON response.

| Pros | Cons |
|---|---|
| Single HTTP request on page load, avoiding waterfall latency. | Requires carefully tuned SQL queries to prevent slow page load. |
| Consistent snapshot state across all dashboard widgets. | Payload is slightly larger (~15-20KB). |
| Simple error handling on the Vue frontend. | — |

**Option B — Multi-Endpoint Polling per Widget**
- Separate endpoints for `/kpi`, `/analytics`, `/activities`, `/calendar`, `/alerts`.

| Pros | Cons |
|---|---|
| Independent widget loading states (skeleton loaders per card). | Multiple HTTP requests (5+ roundtrips) increases server overhead. |
| Slightly smaller individual payloads. | Race conditions and asynchronous state mismatches across widgets. |

**Recommendation:** Option A. A single unified query class minimizes HTTP overhead and guarantees data consistency. Analytics details can be fetched on demand if date range parameters change.

---

### Decision 2: Quick Action & Module Navigation Layout

**Option A — Dual-Tier Action Hub: Categorized Quick Grid + Searchable Navigation Palette (Recommended)**
- Prominently feature top primary workflows ("Start / Continue Processing", "Generate Payroll", "Payslips") in action cards with active status badges (e.g. "Resume Available"), alongside a categorized directory of all 16 Payroll sub-modules with quick search filtering.

| Pros | Cons |
|---|---|
| Reduces clicks to critical tasks from 3+ steps down to 1 click. | Consumes more vertical layout space on desktop screens. |
| Provides instant access to deep sub-modules (Retro Pay, Service Charges, 13th Month). | Requires clear category grouping. |

**Option B — Flat Grid of Navigation Buttons**
- A simple grid of 16 identical buttons for every payroll page.

| Pros | Cons |
|---|---|
| Minimal layout footprint. | High visual noise; lacks visual hierarchy between primary vs secondary actions. |
| Simple implementation. | Does not highlight actionable states (e.g., active processing, pending approvals). |

**Recommendation:** Option A. Payroll administrators need high visual priority for active processing tasks alongside instant navigation to peripheral sub-modules.

---

### Decision 3: Processing Status & Checkpoint Integration

**Option A — Live Checkpoint Progress & Exception Card (Recommended)**
- Query `processing_checkpoints` and `payroll_period` status dynamically. If an active checkpoint exists (`status = 'in_progress'`), present a high-visibility progress bar with "Continue Processing" action and single-click access to failed record exceptions.

| Pros | Cons |
|---|---|
| Seamless recovery from interrupted processing sessions. | Requires real-time query of active checkpoint status. |
| Prevents duplicate processing attempts by highlighting lock state. | — |

**Option B — Standard Static Period Card**
- Display only the active period dates and general status text without real-time checkpoint recovery links.

| Pros | Cons |
|---|---|
| Simpler query logic. | Users must navigate to Payroll Processing to discover incomplete runs. |

**Recommendation:** Option A. Grounded in the existing `ProcessingCheckpoint` system, providing immediate state awareness.

---

### Decision 4: Payroll & Compliance Calendar

**Option A — Dynamic Compliance & Pay Period Timeline (Recommended)**
- Compute pay dates, cutoff deadlines, and statutory filing deadlines (SSS 15th, PhilHealth 10th, Pag-IBIG 15th, BIR 1601-C 10th) based on the active period's `paydate` and `period_end`. Highlight upcoming items within 5 days with warning badges.

| Pros | Cons |
|---|---|
| Proactive compliance alerts prevent late filing penalties. | Requires date math logic per government agency rule. |
| Automatically adjusts with active pay period configuration. | — |

**Option B — Static Calendar Widget**
- Display a plain monthly calendar grid with generic date markers.

| Pros | Cons |
|---|---|
| Easy UI rendering. | Cluttered display; doesn't highlight actionable HRMS deadlines clearly. |

**Recommendation:** Option A. Direct utility for payroll officers responsible for statutory deadlines.

---

## 3. Database

No new database tables or column modifications are required. The dashboard aggregates data from existing HRMS tables:

| Table Name | Usage / Aggregated Columns | Filter / Condition |
|---|---|---|
| `payroll_period` | `period`, `period_start`, `period_end`, `paydate`, `pay_process_status`, `status` | `status = 1` (Active periods) |
| `payroll_run` | `id`, `idpayperiod`, `cycle`, `status`, `headcount`, `total_gross`, `total_net`, `processed_at` | Recent runs ordered by `processed_at DESC` |
| `processing_checkpoints` | `task_type`, `scope_key`, `total_records`, `processed_count`, `progress_pct`, `status` | `status = 'in_progress'` |
| `accounts` | `id`, `emp_code`, `first_name`, `last_name`, `status`, `tin`, `sss_num`, `phic_num`, `hdmf_num`, `bank_account_no` | `status = 1` (Active employees count & missing data validation) |
| `payroll_entry_batch` | `id`, `batch_no`, `status`, `created_at` | `status = 0` (Pending/Unposted batches) |
| `payroll_loan` | `id`, `status` | `status = 0` (Pending loan approvals) |
| `trans_log` | `module`, `action`, `description`, `created_at`, `idacct` | `module = 'payroll'` (Recent system activities) |

---

## 4. Backend

### 4.1 Models & Query Classes

**Query Class:** `App\Queries\Payroll\GetPayrollDashboardQuery`
- **Location:** `app/Queries/Payroll/GetPayrollDashboardQuery.php`
- **Namespace:** `App\Queries\Payroll`
- **Base Class:** Extends `App\Queries\Query`
- **Signature:** `public static function execute($params = [])`

#### Expected Query Logic:
1. **Overview Cards Data:**
   - Active Pay Period: Latest `payroll_period` where `status = 1`.
   - Payroll Status: `pay_process_status` from active `payroll_period` (`0=Not Started, 1=In Progress, 2=Calculated, 3=Closed`).
   - Active Headcount: Count of `accounts` where `status = 1`.
   - Employees Processed: Count of distinct `idacct` in latest `payroll_run_detail` for active period.
   - Active Checkpoint: Latest `processing_checkpoints` record where `status = 'in_progress'`.
   - Monthly Net Payroll Total: `SUM(total_net)` from `payroll_run` for current month.
   - Monthly Run Count: `COUNT(id)` from `payroll_run` in current month.
2. **Pending Actions & Warnings:**
   - Count of unposted `payroll_entry_batch` (`status = 0`).
   - Count of active employees with missing statutory IDs (`tin`, `sss_num`, `phic_num`, `hdmf_num`) or bank account numbers.
   - Count of employees with negative net pay in latest `payroll_run_detail`.
3. **Analytics (Cost Trend):**
   - Monthly `total_gross` vs `total_net` totals over the last 6 to 12 payroll runs from `payroll_run`.
   - Department breakdown: `total_gross` grouped by employee department for latest closed run.
4. **Recent Activities:**
   - Latest 8 entries from `trans_log` where `module = 'payroll'` joined with `accounts` (user details).
5. **Payroll Calendar Events:**
   - Active period `period_end`, `paydate`.
   - Calculated statutory filing deadlines:
     - SSS Remittance: 15th of following month.
     - PhilHealth Remittance: 10th of following month.
     - Pag-IBIG Remittance: 15th of following month.
     - BIR Form 1601-C: 10th of following month.

---

### 4.2 Controller Setup

**Controller Class:** `App\Http\Controllers\payroll\PayrollDashboardController`
- **Location:** `app/Http/Controllers/payroll/PayrollDashboardController.php`
- **Namespace:** `App\Http\Controllers\payroll`
- **Base Class:** Extends `App\Http\Controllers\Controller`

```php
namespace App\Http\Controllers\payroll;

use App\Http\Controllers\Controller;
use App\Queries\Payroll\GetPayrollDashboardQuery;
use Illuminate\Http\Request;
use Exception;

class PayrollDashboardController extends Controller
{
    public function getSummary(Request $request)
    {
        try {
            $data = GetPayrollDashboardQuery::execute($request->all());
            return response()->json($data);
        } catch (Exception $e) {
            return response()->json(['message' => $e->getMessage()], 400);
        }
    }
}
```

---

### 4.3 Route Registration

Register in `routes/api/payroll.php` under the existing `/api/payroll/` prefix:

```php
use App\Http\Controllers\payroll\PayrollDashboardController;

// ─── Payroll Dashboard ──────────────────────────────────────────────────
Route::get('/dashboard/summary', [PayrollDashboardController::class, 'getSummary']);
```

---

## 5. Frontend

### 5.1 Module Structure

Location: `resources/views/web/src/module/payroll/dashboard/`

```
resources/views/web/src/module/payroll/dashboard/
├── index.ts                           # Module barrel export
├── route/
│   └── dashboard.routes.ts            # Route definition (/payroll/dashboard)
├── api/
│   └── dashboard.api.ts               # useDashboardApi() HTTP service layer
├── composables/
│   └── useDashboard.ts                # Reactive state & data fetch logic
├── pages/
│   └── Dashboard.vue                  # Main Dashboard page layout
├── components/
│   ├── OverviewCards.vue              # KPI metric cards with status pills
│   ├── ProcessingStatusCard.vue       # Checkpoint progress & exception banner
│   ├── QuickActionHub.vue             # Primary action cards + searchable sub-module grid
│   ├── RecentActivitiesList.vue       # System audit log & activity stream
│   ├── PayrollCalendarWidget.vue      # Pay period timeline & statutory deadlines
│   ├── PayrollAnalyticsCharts.vue     # MoM cost trend & department distribution
│   └── ComplianceAlertsBanner.vue     # Warning banner for missing IDs & unposted batches
└── types/
    └── types.dashboard.ts             # TypeScript DTO & response interfaces
```

---

### 5.2 TypeScript Interfaces (`types/types.dashboard.ts`)

```typescript
export interface PayrollPeriodSummary {
  id: number;
  period: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  status: 'not_started' | 'in_progress' | 'calculated' | 'closed';
  statusLabel: string;
}

export interface ProcessingCheckpointSummary {
  hasActiveCheckpoint: boolean;
  taskType: string;
  scopeKey: string;
  progressPct: number;
  processedCount: number;
  totalRecords: number;
  lastHeartbeatAt: string;
}

export interface DashboardMetrics {
  totalActiveEmployees: number;
  employeesProcessed: number;
  pendingBatchesCount: number;
  pendingLoansCount: number;
  missingRequirementsCount: number;
  negativePayExceptionsCount: number;
  currentPeriodGross: number;
  currentPeriodNet: number;
  monthlyTotalNet: number;
  payrollRunsThisMonth: number;
}

export interface CostTrendPoint {
  periodLabel: string;
  grossAmount: number;
  netAmount: number;
}

export interface DepartmentDistribution {
  departmentName: string;
  employeeCount: number;
  totalGross: number;
  percentage: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  category: 'pay_date' | 'cutoff' | 'government' | 'processing';
  isUrgent: boolean;
  daysRemaining: number;
}

export interface RecentActivityItem {
  id: number;
  action: string;
  description: string;
  userName: string;
  userRole: string;
  timeAgo: string;
  category: 'payroll' | 'entry' | 'report' | 'system';
  icon: string;
}

export interface DashboardSummaryResponse {
  activePeriod: PayrollPeriodSummary | null;
  checkpoint: ProcessingCheckpointSummary | null;
  metrics: DashboardMetrics;
  costTrends: CostTrendPoint[];
  departmentDistribution: DepartmentDistribution[];
  upcomingEvents: CalendarEvent[];
  recentActivities: RecentActivityItem[];
  lastUpdated: string;
}
```

---

### 5.3 Quick Action Directory Mapping

The `QuickActionHub.vue` component maps all existing Payroll sub-modules for 1-click navigation:

| Action Label | Icon | Route Target (`name`) | Category |
|---|---|---|---|
| Start Payroll Processing | `play-circle` | `payroll_processing` | Core Processing |
| Resume Checkpoint | `refresh-cw` | `payroll_processing` | Core Processing |
| Payroll Register | `file-text` | `payroll_reports` | Reports |
| Payroll Summary | `bar-chart-2` | `payroll_reports` | Reports |
| Payslips | `credit-card` | `payroll_reports` | Employee Self-Service |
| Payroll Entries | `edit-3` | `payroll_entries` | Adjustments |
| Batch Entries | `layers` | `payroll_entries` | Adjustments |
| Recurring Entries | `repeat` | `payroll_entries` | Adjustments |
| Retro Pay | `rewind` | `payroll_processing` | Core Processing |
| Service Charge | `pie-chart` | `payroll_entries` | Adjustments |
| Employee Loans | `dollar-sign` | `payroll_entries` | Adjustments |
| Government Contributions | `shield` | `government_routines` | Compliance |
| BIR Withholding Tax | `file-plus` | `government_routines` | Compliance |
| 13th Month Pay | `gift` | `payroll_processing` | Special Cycles |
| Year-End Tax Annualization | `calendar` | `payroll_processing` | Special Cycles |
| Payroll Closing & Lock | `lock` | `payroll_closing` | Period Management |
| Journal Voucher (JV) | `book-open` | `payroll_reports` | Accounting |

---

### 5.4 Page Layout Sketch (`Dashboard.vue`)

```
+---------------------------------------------------------------------------------------------------+
|  Header: Payroll Operations Dashboard                             [ Last Sync: 09:42 AM ]  [Refresh] |
+---------------------------------------------------------------------------------------------------+
|  [WARNING BANNER: 3 Unposted Batches, 5 Employees Missing Statutory IDs]         [View Action Items] |
+---------------------------------------------------------------------------------------------------+
|                                      OVERVIEW METRIC CARDS                                         |
| +-------------------+ +-------------------+ +-------------------+ +-------------------+ |
| | Active Pay Period | | Employees In Run | | Monthly Net Pay   | | Next Pay Date     | |
| | Jul 01 - Jul 15   | | 1,284 / 1,300     | | P 14,231,890.00   | | Jul 20, 2026      | |
| | Status: IN REVIEW | | (98.7% Processed) | | (2 Runs Completed)| | (in 4 Days)       | |
| +-------------------+ +-------------------+ +-------------------+ +-------------------+ |
+---------------------------------------------------------------------------------------------------+
|                                     PROCESSING CHECKPOINT BANNER                                   |
| [!] Active Checkpoints Found: Batch 2 Calculation (78% Complete - 1,001/1,284)   [Resume Processing] |
+---------------------------------------------------------------------------------------------------+
| MAIN CONTENT GRID (2 COLUMNS: LEFT 2/3, RIGHT 1/3)                                                |
|                                                                                                   |
| LEFT COLUMN (2/3 width)                                RIGHT COLUMN (1/3 width)                   |
| 1. Quick Action Hub                                    1. Compliance & Pay Calendar               |
|    - Primary Action Cards (Start / Register / Payslips)   - Pay Cutoff (Jul 15)                   |
|    - Searchable Sub-Module Navigation Grid                - Pay Date (Jul 20)                     |
|                                                           - BIR 1601-C Deadline (Jul 10)          |
| 2. Payroll Cost Analytics                              2. Recent Activities Stream                |
|    - Gross vs Net Trend Chart (Multi-period)              - "Maria S. calculated Regular Cycle"   |
|    - Department Cost Breakdown                             - "John D. uploaded Batch Entry #42"     |
|                                                        3. Pending System Alerts                   |
+---------------------------------------------------------------------------------------------------+
```

---

## 6. Business Rules & Edge Cases

### 6.1 HRMS Domain Rules
1. **Active Period Precedence:**
   - The primary period displayed in overview cards must be the currently open `payroll_period` where `status = 1` and `pay_process_status < 3` (not locked). If all regular periods are locked, fall back to the most recently closed period with an explicit "Closed" status badge.
2. **Statutory Filing Deadlines:**
   - Deadlines falling on a Saturday, Sunday, or official Holiday must display an indicator that filing should occur on the preceding business day.
3. **Negative Net Pay Guard:**
   - If any calculated employee in the active cycle has `net_pay < 0` (due to excessive deductions or loans), display an urgent alert counter on the dashboard linking directly to the Payroll Exceptions list.

### 6.2 Edge Cases & Handling

| Edge Case | Potential Issue | Handling Strategy |
|---|---|---|
| No open pay period configured | Dashboard throws undefined property error. | Return empty state card with button "Configure Pay Periods" leading to `payroll_period` setup. |
| Interrupted background processing | Stale progress bar shown. | Cross-check `processing_checkpoints.last_heartbeat_at`. If older than 15 minutes without completion, mark status as "Stalled / Interrupted" with option to retry or clear. |
| Zero processed runs in month | Charts fail to render. | Display helpful empty placeholder state ("No payroll runs completed this month"). |
| Non-admin user access | Unauthorized view of payroll totals. | Enforce `auth:sanctum` and permission middleware (`view-payroll-dashboard`) on API endpoint. |

---

## 7. Build Order

1. **Backend Query Layer (Gate 2 preparation):**
   - Create `App\Queries\Payroll\GetPayrollDashboardQuery` in `app/Queries/Payroll/GetPayrollDashboardQuery.php`.
   - Aggregate metrics from `payroll_period`, `payroll_run`, `processing_checkpoints`, `accounts`, `trans_log`.
2. **Backend Controller & Route (Gate 2 preparation):**
   - Create `App\Http\Controllers\payroll\PayrollDashboardController.php`.
   - Register route `GET /api/payroll/dashboard/summary` in `routes/api/payroll.php`.
3. **Frontend Design-First UI (Gate 1):**
   - Scaffold/update `resources/views/web/src/module/payroll/dashboard/` TypeScript structure.
   - Define TypeScript interfaces in `types/types.dashboard.ts`.
   - Update `dashboard.api.ts` with mock structured data mirroring `DashboardSummaryResponse`.
   - Create components: `OverviewCards.vue`, `ProcessingStatusCard.vue`, `QuickActionHub.vue`, `PayrollCalendarWidget.vue`, `PayrollAnalyticsCharts.vue`, `RecentActivitiesList.vue`.
   - Build responsive layout in `pages/Dashboard.vue`.
4. **Frontend Live Data Wiring (Gate 2):**
   - Replace mock data in `dashboard.api.ts` with live HTTP GET call to `api/payroll/dashboard/summary`.
   - Connect `usePayrollDashboard` composable to live API and test manual refresh.
5. **Verification & Polish:**
   - Validate desktop and tablet responsive view ports.
   - Verify dark mode color contrasts and accessibility tags (`aria-labelledby`, `role="region"`).

---

## 8. Out of Scope (Future Specs)

- **Custom Dashboard Widget Layout Customization:** Allowing individual users to drag-and-drop or hide specific dashboard cards (to be specified in a separate User Preferences spec).
- **Automated Email Deadline Reminders:** Background cron notification system for tax deadline warnings (covered in global notification engine specs).
- **Direct Banking / Automated Payout API Integration:** Real-time bank disbursement status polling.
