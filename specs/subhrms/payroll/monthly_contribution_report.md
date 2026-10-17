# Spec — Monthly Contribution Report (SSS, PhilHealth, Pag-IBIG)

> **Kind:** Greenfield (New statutory compliance consolidation report & government electronic file export module).  
> **Portal:** **Payroll** (`/api/payroll/...` routes, `government_routines` frontend module).  
> **Route:** `/payroll/government-routines/monthly-contribution` (`payroll_government_routines_monthly_contribution`).  
> **Conventions:** [project-gate.md](../../../rules/core/project-gate.md), [payroll.md](../../../rules/conditional/payroll.md).  
> **System Awareness:** Models reused (`PayrollRun`, `PayrollRunDetail`, `PayPeriod`, `Account`, `AccountDetailVW`, `Company`); Tables reused (`payroll_run`, `payroll_run_detail`, `pay_period`, `vw_accounts_details`, `company`); Routes created (`/payroll-reports/monthly-contribution`, `/payroll-reports/monthly-contribution/export`); New migration: no (uses existing persisted `payroll_run_detail` and `breakdown_json` statutory shares with safe fallback).

---

## 1. Purpose

The **Monthly Contribution Report** is a critical statutory government compliance module generated following payroll processing. It consolidates all employee (EE) and employer (ER) contribution details — including Social Security System (SSS Regular, EC, WISP), PhilHealth (EE/ER premium shares), and Pag-IBIG / HDMF (EE/ER fund shares) — for any selected payroll period or calendar month.

Unlike payroll processing handlers, the Monthly Contribution Report **does not recalculate or re-evaluate contribution amounts**. Instead, it retrieves historical contribution values already persisted in `payroll_run_detail` (and its structured `breakdown_json`). This guarantees **strict historic invariance**: the report and its generated government remittance files will always 100% reconcile with the deductions and employer liabilities recorded in finalized payroll runs, even if official statutory bracket tables or employee salary rates change in the future.

The module provides HR and Payroll Officers with:
1. An interactive, multi-agency audit table with filtering, search, and aggregate summary totals (Total EE Share, Total ER Share, Total EC, Total WISP, Grand Total Remittance).
2. Dual reporting windows: single cutoff pay period auditing or full calendar month consolidation (combining semi-monthly 1st and 2nd half cutoffs into one monthly remittance).
3. Standardized electronic export formats required for government agency submission:
   - **SSS**: R-3 / WISP Electronic Media File format (.txt/.csv).
   - **PhilHealth**: EPRS (Electronic Premium Reporting System) upload format (.csv).
   - **Pag-IBIG**: MCRF (Monthly Contribution Remittance Form) layout (.csv).
   - **Internal Audit**: Comprehensive Excel / CSV reconciliation sheets.

---

## 2. Design Decisions (Pros & Cons)

### Decision 1: Reporting Period Window (Single Cutoff Period vs Full Monthly Aggregation)

**Option A — Flexible Dual-Mode: Cutoff Pay Period OR Calendar Month Aggregation (Recommended)**
- Allow filtering by a specific `idpayperiod` (single cutoff) OR by `year` + `month` (automatically aggregating all cutoffs ending within that calendar month).

| Pros | Cons |
|---|---|
| Aligns with government agency remittance requirements (SSS, PhilHealth, and Pag-IBIG collect contributions on a calendar-month basis). | Requires aggregation logic (`SUM()`) across multiple payroll cutoffs for the monthly view. |
| Supports mid-month single-cutoff payroll reconciliation before month-end closing. | |
| Enables single-line monthly summaries per employee required by statutory submission files. | |

**Option B — Strict Single Pay-Period Selection Only**
- Require selecting a specific `idpayperiod`.

| Pros | Cons |
|---|---|
| Direct 1-to-1 match with a single `payroll_run` header. | Inconvenient for semi-monthly payrolls where government submission requires a monthly consolidated total. |
| Zero aggregation required across periods. | Payroll officers must export two reports and combine them manually in Excel. |

**Recommendation:** Option A. Dual-mode satisfies both internal period auditing and monthly government agency filing requirements.

---

### Decision 2: Employer Contribution Data Retrieval Strategy

**Option A — Hybrid Retrieval: Stored `payroll_run_detail` Columns with `breakdown_json` & Statutory Fallback (Recommended)**
- Read `payroll_run_detail.sss`, `sss_wisp`, `philhealth`, `pagibig`. Retrieve granular ER, EC, and WISP ER shares from `payroll_run_detail.breakdown_json->deductions`. If legacy payroll runs lack explicit ER fields in `breakdown_json`, apply statutory ratio fallbacks (PhilHealth 50/50 split, Pag-IBIG 1:1 match up to ₱200 cap, SSS table ratio).

| Pros | Cons |
|---|---|
| Backward compatible with legacy processed payroll runs. | Query handler contains fallback logic for older runs created before detailed ER breakdown JSON was saved. |
| 100% compliant with the non-recomputation rule for all processed runs. | |
| Fast execution without requiring structural DB schema migrations or locks. | |

**Option B — Re-calculate Employer Share dynamically on-the-fly during report generation**
- Compute ER and EC shares dynamically using current statutory formulas based on stored gross salary.

| Pros | Cons |
|---|---|
| No need to check stored JSON keys or fallbacks. | **Violates domain rule**: risks discrepancy if statutory rules or bracket tables were updated after payroll processing. |
| | Causes audit failures between payroll ledger reports and statutory remittance reports. |

**Recommendation:** Option A. Preserves historical accuracy and strictly follows the non-recomputation directive.

---

### Decision 3: UI Navigation & Layout Architecture

**Option A — Centralized Monthly Contribution Page (`/payroll/government-routines/monthly-contribution`) with Agency Context Switcher (Recommended)**
- Single unified view under Government Routines with tab/toggle controls for `SSS`, `PhilHealth`, `Pag-IBIG`, and `Consolidated (All Agencies)`.

| Pros | Cons |
|---|---|
| Single codebase for filters, period selectors, summary metric cards, and pagination. | Requires dynamic table column rendering based on active agency tab. |
| Allows Payroll Managers to view overall statutory liability across all 3 agencies in one screen. | |
| Clean UX with consistent export controls. | |

**Option B — Separate Decentralized Pages under Agency Subfolders (`/payroll/sss/monthly-contribution`, `/payroll/phil-health/monthly-contribution`, `/payroll/pag-ibig/monthly-contribution`)**
- Create 3 separate standalone page components under each agency sub-directory.

| Pros | Cons |
|---|---|
| Direct 1-to-1 match with legacy stub routes in `government_routines.routes.ts`. | Code duplication across 3 page components, 3 composables, and 3 tables. |
| | No consolidated view for total statutory company obligation. |

**Recommendation:** Option A, with sub-route aliases pointing to the unified component so existing menu links under `/payroll/sss/...`, `/payroll/phil-health/...`, `/payroll/pag-ibig/...` seamless route to the consolidated page with the appropriate agency tab pre-selected.

---

### Decision 4: Statutory Remittance File Export Mechanism

**Option A — Server-Side Dedicated File Export Handler (`ExportMonthlyContributionReportHandler` & Action Classes) (Recommended)**
- Endpoint `/api/payroll/payroll-reports/monthly-contribution/export` handles CSV, Excel, and agency-formatted text files (`.txt`/`.csv`) using dedicated streaming actions (`GenerateSssRemittanceFileAction`, etc.).

| Pros | Cons |
|---|---|
| Fixed-width text alignments, header/trailer records, and strict agency character encoding generated reliably on server. | Requires dedicated backend Action classes per file format. |
| Fully testable via automated PHPUnit tests. | |
| Handles large datasets (thousands of employees) without browser UI lag or memory limits. | |

**Option B — Client-Side Formatting and File Saver in Vue**
- Format remittance text files in JavaScript blob objects on the client.

| Pros | Cons |
|---|---|
| Reduces server HTTP load for exports. | Prone to browser memory limitations on large payrolls. |
| | Difficult to write unit tests for agency line-formatting specs. |

**Recommendation:** Option A. Server-side file generation is robust, secure, and easily testable.

---

## 3. Database Schema

No new database tables or column migrations are required. The module reads from existing ground-truth payroll tables:

### Reused Tables & Column Mapping

1. **`payroll_run_detail`**
   - `idpayrun` (unsignedBigInteger, indexed)
   - `idpayperiod` (unsignedBigInteger, indexed)
   - `idacct` (unsignedInteger, indexed)
   - `gross_pay` (decimal 12,2) — Contributable salary basis reference
   - `sss` (decimal 12,2) — Employee SSS Regular Share
   - `sss_wisp` (decimal 12,2) — Employee SSS WISP Share
   - `philhealth` (decimal 12,2) — Employee PhilHealth Share
   - `pagibig` (decimal 12,2) — Employee Pag-IBIG Share
   - `breakdown_json` (json) — Detailed JSON containing statutory breakdown:
     - `deductions.sss_er` / `sss_ec` / `sss_wisp_er` / `sss_msc`
     - `deductions.philhealth_er`
     - `deductions.pagibig_er`

2. **`payroll_run`**
   - `id` (unsignedBigInteger, primary key)
   - `idpayperiod` (unsignedBigInteger, indexed)
   - `cycle` (varchar) — `regular`, `final`, `13th`, `retro`
   - `status` (integer) — `0=draft`, `1=finalized`

3. **`pay_period`**
   - `id` (unsignedBigInteger, primary key)
   - `period_start` (date)
   - `period_end` (date)
   - `pay_date` (date)
   - `period_type` (varchar) — `1st-half`, `2nd-half`, `monthly`

4. **`vw_accounts_details`**
   - `id` (unsignedInteger, primary key)
   - `empid` (varchar) — Employee ID
   - `fullname` (varchar) — Full Employee Name
   - `sss_no` (varchar) — SSS Number
   - `philhealth_no` (varchar) — PhilHealth PIN
   - `pagibig_no` (varchar) — Pag-IBIG MID
   - `unit` (varchar) — Department / Business Unit
   - `position` (varchar) — Job Position
   - `status` (varchar) — Employment status

5. **`company` / `company_details`**
   - Company Name, SSS Employer Number, PhilHealth Employer Number, Pag-IBIG Employer ID Number (used for statutory file header records).

---

## 4. Backend Implementation Plan

Following the **thin-controller + Query/Handler/Action pattern** ([project-gate.md](../../../rules/core/project-gate.md)):

### 4.1 Query Class: `GetMonthlyContributionReportQuery`

- **Location:** `app/Queries/Payroll/GetMonthlyContributionReportQuery.php`
- **Class:** `App\Queries\Payroll\GetMonthlyContributionReportQuery` extends `App\Queries\Query`
- **Signature:** `public static function execute($params = [])`

**Parameters:**
- `agency` (string, optional): `sss` | `philhealth` | `pagibig` | `all` (default: `all`)
- `period_id` (integer, optional): Specific `pay_period.id`
- `year` (integer, optional): e.g. `2026`
- `month` (integer, optional): `1` to `12`
- `pay_group_id` (integer, optional): Filter by Pay Group
- `department` (string, optional): Filter by department/unit
- `search` (string, optional): Filter by employee ID or name
- `page` (integer, default `1`)
- `per_page` (integer, default `15`)

**Response Structure:**
```json
{
  "summary": {
    "agency": "sss",
    "period_mode": "monthly",
    "year": 2026,
    "month": 7,
    "total_headcount": 45,
    "total_contributable_gross": 1350000.00,
    "total_ee_share": 60750.00,
    "total_er_share": 128250.00,
    "total_ec_share": 1350.00,
    "total_wisp_ee": 6750.00,
    "total_wisp_er": 6750.00,
    "grand_total_remittance": 203850.00
  },
  "agency_breakdowns": {
    "sss": { "ee": 67500.00, "er": 128250.00, "ec": 1350.00, "wisp": 13500.00, "total": 210600.00 },
    "philhealth": { "ee": 33750.00, "er": 33750.00, "total": 67500.00 },
    "pagibig": { "ee": 9000.00, "er": 9000.00, "total": 18000.00 }
  },
  "employees": [
    {
      "idacct": 102,
      "empid": "EMP-2024-001",
      "fullname": "Dela Cruz, Juan",
      "unit": "Engineering",
      "position": "Software Engineer",
      "gov_ids": {
        "sss_no": "34-1234567-8",
        "philhealth_no": "12-345678901-2",
        "pagibig_no": "1234-5678-9012"
      },
      "contributable_gross": 30000.00,
      "sss": {
        "msc": 30000.00,
        "ee": 1350.00,
        "er": 2850.00,
        "ec": 30.00,
        "wisp_ee": 225.00,
        "wisp_er": 225.00,
        "total": 4680.00
      },
      "philhealth": {
        "msc": 30000.00,
        "ee": 750.00,
        "er": 750.00,
        "total": 1500.00
      },
      "pagibig": {
        "msc": 30000.00,
        "ee": 200.00,
        "er": 200.00,
        "total": 400.00
      },
      "total_employee_deduction": 2525.00,
      "total_employer_liability": 4055.00,
      "total_remittance": 6580.00,
      "missing_id_warning": false
    }
  ],
  "departments": ["Engineering", "HR", "Finance"],
  "total": 45,
  "per_page": 15,
  "page": 1
}
```

---

### 4.2 Export Handler & Action Classes

1. **`App\Handlers\Payroll\ExportMonthlyContributionReportHandler`**
   - Validates export parameters (`agency`, `format`: `csv`|`excel`|`txt`, `year`, `month`, `period_id`).
   - Fetches unpaginated contribution report dataset using `GetMonthlyContributionReportQuery::execute($params + ['per_page' => 999999])`.
   - Delegates agency text file formatting to dedicated Action classes:
     - `App\Actions\Payroll\GenerateSssRemittanceFileAction`
     - `App\Actions\Payroll\GeneratePhilhealthRemittanceFileAction`
     - `App\Actions\Payroll\GeneratePagibigRemittanceFileAction`
   - Returns stream response with proper HTTP headers (`Content-Type`, `Content-Disposition: attachment; filename="..."`).

---

### 4.3 Controller: `PayrollReportsController`

Add methods to existing `App\Http\Controllers\payroll\PayrollReportsController`:

```php
/**
 * Get Monthly Contribution Report dataset (SSS, PhilHealth, Pag-IBIG)
 */
public function monthlyContributionReport(Request $request)
{
    try {
        $data = GetMonthlyContributionReportQuery::execute($request->all());
        return response()->json($data);
    } catch (Exception $e) {
        return response()->json(['message' => $e->getMessage()], 400);
    }
}

/**
 * Export Monthly Contribution Report (CSV / Excel / Agency Electronic File)
 */
public function exportMonthlyContributionReport(Request $request)
{
    try {
        return ExportMonthlyContributionReportHandler::execute($request->all());
    } catch (Exception $e) {
        return response()->json(['message' => $e->getMessage()], 400);
    }
}
```

---

### 4.4 Route Registration

Register in `routes/api/payroll.php` under the `payroll-reports` group:

```php
// Monthly Contribution Compliance Reports & Agency File Exports
Route::get('/payroll-reports/monthly-contribution',        [PayrollReportsController::class, 'monthlyContributionReport']);
Route::get('/payroll-reports/monthly-contribution/export', [PayrollReportsController::class, 'exportMonthlyContributionReport']);
```

---

## 5. Frontend Implementation Plan

Module layout located under `resources/views/web/src/module/payroll/government_routines/`:

### 5.1 TS Module Structure

```text
resources/views/web/src/module/payroll/government_routines/
├── index.ts
├── route/
│   └── government_routines.routes.ts
├── api/
│   └── monthly_contribution.api.ts
├── composables/
│   └── useMonthlyContribution.ts
├── types/
│   └── types.monthly_contribution.ts
└── pages/
    ├── sss/
    │   └── monthly_contribution/MonthlyContribution.vue  (Wrapper around shared component)
    ├── philhealth/
    │   └── monthly_contribution/MonthlyContribution.vue  (Wrapper around shared component)
    ├── pagibig/
    │   └── monthly_contribution/MonthlyContribution.vue  (Wrapper around shared component)
    └── monthly_contribution/
        ├── MonthlyContributionReport.vue                 (Main Consolidated Page)
        └── components/
            ├── MonthlyContributionSummaryCards.vue       (Metric Cards)
            ├── MonthlyContributionFilters.vue            (Agency, Year, Month, Period, Dept filters)
            ├── MonthlyContributionTable.vue              (Dynamic Agency Columns Data Table)
            └── MonthlyContributionExportModal.vue         (File format & Agency Export options)
```

---

### 5.2 Key UI Components & Interactions

1. **`MonthlyContributionFilters.vue`**
   - **Agency Selector Tabs / Buttons**: `All Agencies`, `SSS`, `PhilHealth`, `Pag-IBIG`.
   - **Period Mode Toggle**: `Monthly Consolidation` vs `Single Pay Period`.
   - **Date Controls**: Year Select (e.g. 2026), Month Select (Jan - Dec), or Pay Period dropdown (fetched from `api/payroll/payPeriod`).
   - **Department Filter**: Dynamic dropdown populated from query response.
   - **Search Input**: Real-time debounced employee name/ID search.

2. **`MonthlyContributionSummaryCards.vue`**
   - Card 1: Total Headcount
   - Card 2: Total Contributable Gross
   - Card 3: Total Employee Shares (EE)
   - Card 4: Total Employer Shares (ER + EC + WISP ER)
   - Card 5: Grand Total Statutory Remittance (Highlight card with primary theme)

3. **`MonthlyContributionTable.vue`**
   - **Dynamic Columns based on active agency tab:**
     - **SSS Tab**: Employee Name, SSS No., MSC, EE Regular, ER Regular, EC Share, WISP EE, WISP ER, Total SSS.
     - **PhilHealth Tab**: Employee Name, PhilHealth PIN, Contributable Gross, EE Premium, ER Premium, Total PhilHealth.
     - **Pag-IBIG Tab**: Employee Name, Pag-IBIG MID, Contributable Gross, EE Contribution, ER Contribution, Total Pag-IBIG.
     - **All Agencies Tab**: Employee Name, SSS Total, PhilHealth Total, Pag-IBIG Total, Combined Employee Deduction, Combined Employer Liability, Grand Total.
   - **Warnings**: Yellow badge indicator on rows where government ID number is missing or invalid.
   - **Footer Row**: Sticky bottom row displaying column sums for the current filtered result set.
   - **Pagination**: Standard `<Pagination>` component integrated with backend pagination meta.

4. **`MonthlyContributionExportModal.vue`**
   - Allows user to choose export type:
     - `Excel Spreadsheet (.xlsx)` — Full detailed reconciliation sheet.
     - `CSV File (.csv)` — Flat tabular export.
     - `Agency Official Remittance File`:
       - SSS R-3 / WISP Text File (.txt)
       - PhilHealth EPRS Upload File (.csv)
       - Pag-IBIG MCRF Text File (.csv)

---

### 5.3 Frontend Service Layer (`api/monthly_contribution.api.ts`)

```ts
import http from '@/app/axios/axiosInstance';
import type { MonthlyContributionParams, MonthlyContributionResponse } from '../types/types.monthly_contribution';

export function useMonthlyContributionApi() {
  return {
    getReport: async (params: MonthlyContributionParams): Promise<MonthlyContributionResponse> => {
      const response = await http.get('api/payroll/payroll-reports/monthly-contribution', { params });
      return response.data;
    },
    exportReport: async (params: MonthlyContributionParams & { format: string }): Promise<Blob> => {
      const response = await http.get('api/payroll/payroll-reports/monthly-contribution/export', {
        params,
        responseType: 'blob',
      });
      return response.data;
    },
  };
}
```

---

### 5.4 Vue Routes (`route/government_routines.routes.ts`)

Update/register routes pointing to the monthly contribution components:

```ts
{
  path: 'payroll/monthly-contribution',
  name: 'payroll_monthly_contribution',
  component: () => import('../pages/monthly_contribution/MonthlyContributionReport.vue'),
  meta: { title: 'Monthly Contribution Report' }
},
{
  path: 'payroll/sss/monthly-contribution',
  name: 'payroll_sss_monthly_contribution',
  component: () => import('../pages/monthly_contribution/MonthlyContributionReport.vue'),
  props: { defaultAgency: 'sss' },
  meta: { title: 'SSS - Monthly Contribution' }
},
{
  path: 'payroll/phil-health/monthly-contribution',
  name: 'payroll_phil_health_monthly_contribution',
  component: () => import('../pages/monthly_contribution/MonthlyContributionReport.vue'),
  props: { defaultAgency: 'philhealth' },
  meta: { title: 'PhilHealth - Monthly Contribution' }
},
{
  path: 'payroll/pag-ibig/monthly-contribution',
  name: 'payroll_pag_ibig_monthly_contribution',
  component: () => import('../pages/monthly_contribution/MonthlyContributionReport.vue'),
  props: { defaultAgency: 'pagibig' },
  meta: { title: 'Pag-IBIG - Monthly Contribution' }
}
```

---

## 6. Business Rules & Edge Cases

### 6.1 Business Rules

1. **Non-Recomputation Directive (Historic Invariance)**
   - The query MUST read stored amounts directly from `payroll_run_detail` and `breakdown_json`.
   - It MUST NOT apply current policy settings, salary adjustments made after payroll release, or recalculated bracket percentages.

2. **Run Status Filtering**
   - By default, only finalized payroll runs (`payroll_run.status = 1`) are included in statutory exports.
   - Draft runs can be included in screen previews only if explicit `include_draft=1` flag is passed (with a visible "DRAFT / UNPOSTED" watermark/alert banner).

3. **Semi-Monthly Consolidation Rule**
   - When month filtering is selected (e.g. Month = 7, Year = 2026), the query groups all payroll run details where `pay_period.period_end` falls between `2026-07-01` and `2026-07-31`.
   - Employee records present in both cutoffs are combined into a single aggregated row (`SUM(sss)`, `SUM(philhealth)`, `SUM(pagibig)`).

4. **Statutory Agency Component Definitions**
   - **SSS**: Regular EE + Regular ER + EC (Employer Compensation) + WISP EE + WISP ER.
   - **PhilHealth**: EE Premium (50%) + ER Premium (50%).
   - **Pag-IBIG**: EE Contribution + ER Contribution.

---

### 6.2 Edge Cases Matrix

| Edge Case | Impact | Handling & Resolution |
|---|---|---|
| **Employee missing SSS / PhilHealth / Pag-IBIG ID number** | Remittance text file will be rejected by agency portal. | Display a prominent yellow warning icon on the employee table row. Flag in export response if required agency IDs are missing. |
| **Employee resigned mid-month with Final Pay** | Contributions captured in `cycle='final'` payroll run. | Query includes all run cycles (`regular`, `final`, `retro`) ending in that month and tags employee remarks as "Final Pay / Separated". |
| **Zero earnings / LWOP during entire month** | Zero contribution values recorded. | Employee is included with `0.00` values or filtered out if option `exclude_zero_contributions=1` is checked. |
| **Split Pay Period across Month Boundaries (e.g. June 26 - July 10)** | Ambiguity on which month remittance gets credited. | The `period_end` date determines the remittance month assignment. |
| **Reprocessed / Overwritten Payroll Run** | Risk of duplicate detail rows. | Query joins strictly through active `payroll_run` headers linked to the period. |
| **Legacy payroll run missing ER breakdown in `breakdown_json`** | ER share missing in historic report. | Safe fallback handler applies statutory default ratios (PhilHealth 50/50, Pag-IBIG 1:1 up to cap) for pre-upgrade runs. |

---

## 7. Build Order

Follow the **Design-First Workflow** ([webkit.frontend-implement](../../skills/webkit.frontend-implement/SKILL.md) -> [webkit.backend-implement](../../skills/webkit.backend-implement/SKILL.md)):

### Phase 1 — Frontend Gate 1 (Design-First with Hard-Coded / Mock Data)
1. Create TypeScript types in `resources/views/web/src/module/payroll/government_routines/types/types.monthly_contribution.ts`.
2. Scaffold `api/monthly_contribution.api.ts` with mock response data.
3. Build composable `composables/useMonthlyContribution.ts` managing active agency tabs, period mode, filters, and pagination.
4. Implement UI components:
   - `MonthlyContributionFilters.vue`
   - `MonthlyContributionSummaryCards.vue`
   - `MonthlyContributionTable.vue`
   - `MonthlyContributionExportModal.vue`
5. Implement main page `pages/monthly_contribution/MonthlyContributionReport.vue`.
6. Update Vue route definitions in `route/government_routines.routes.ts`.
7. **User Validation Gate:** Present UI to user for visual & layout approval.

### Phase 2 — Backend Gate 2 (Query, Handlers & Dynamic Data Wiring)
8. Implement Query class `App\Queries\Payroll\GetMonthlyContributionReportQuery`.
9. Implement Action classes for remittance file formatters (`GenerateSssRemittanceFileAction`, `GeneratePhilhealthRemittanceFileAction`, `GeneratePagibigRemittanceFileAction`).
10. Implement Handler class `App\Handlers\Payroll\ExportMonthlyContributionReportHandler`.
11. Add controller methods to `App\Http\Controllers\payroll\PayrollReportsController`.
12. Register API endpoints in `routes/api/payroll.php`.
13. Wire live API calls into `api/monthly_contribution.api.ts` swapping out mock data.

### Phase 3 — Verification & Testing
14. Run PHPUnit tests verifying read-only retrieval accuracy against `payroll_run_detail`.
15. Verify monthly consolidation (combining 1st & 2nd half cutoffs).
16. Test CSV/Excel/Text file download formats.

---

## 8. Out of Scope (Future Specs)

- **Automated SSS/PhilHealth/Pag-IBIG API Direct Submission**: Direct API push to government portals (future integration spec).
- **Government Remittance Payment Gateway**: Online banking payment execution directly inside HRMS (future treasury spec).
- **BIR Form 1601-C Integration**: Covered by separate BIR Monthly ITW spec (`.agents/specs/subhrms/payroll/bir_1601c.md`).
