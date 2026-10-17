# Spec — Loan Remittance Report (Statutory & Company Loans)

> **Kind:** Greenfield (New loan deduction consolidation report & electronic remittance export module).  
> **Portal:** **Payroll** (`/api/payroll/...` routes, `government_routines` frontend module).  
> **Route:** `/payroll/government-routines/loan-remittance` (`payroll_government_routines_loan_remittance`).  
> **Conventions:** [project-gate.md](../../../rules/core/project-gate.md), [payroll.md](../../../rules/conditional/payroll.md).  
> **System Awareness:** Models reused (`PayrollLoan`, `PayrollLoanSchedule`, `LoanTypes`, `PayrollRun`, `PayrollRunDetail`, `PayPeriod`, `Account`, `AccountDetailVW`, `Company`); Tables reused (`payroll_loan`, `payroll_loan_schedule`, `loantype`, `payroll_run`, `payroll_run_detail`, `pay_period`, `vw_accounts_details`, `company`); Routes created (`/payroll-reports/loan-remittance`, `/payroll-reports/loan-remittance/export`); New migration: no (uses existing `payroll_loan`, `payroll_loan_schedule`, and `payroll_run_detail`).

---

## 1. Purpose

The **Loan Remittance** module consolidates all employee loan repayments deducted during payroll processing and generates statutory remittance reports and electronic payment upload files for government agencies (SSS, Pag-IBIG) and accredited lending institutions (Company Loans, Credit Cooperatives, Partner Banks).

During payroll processing, the system calculates and deducts loan repayments based on active employee loan agreements (`payroll_loan`), schedule sequences (`payroll_loan_schedule`), and net-pay priority rules. The processed repayment amounts are stored permanently in payroll transaction records (`payroll_run_detail` and `payroll_loan_schedule`).

The Loan Remittance module **does not recalculate loan deductions**. Instead, it reads the stored loan repayment entries from processed payroll, groups them by loan category (Government, Company, Cooperative/Third-Party) and specific loan type (`loantype.code`), and produces structured remittance reports and agency-compliant electronic files.

Key capabilities provided:
1. **Multi-Category Loan Consolidation**: Handles statutory loans (SSS Salary, SSS Calamity, Pag-IBIG MPL, Pag-IBIG Calamity, Pag-IBIG Housing), company-managed loans (Emergency, Salary Advance/Vale, Uniform Deposit, Medical, Tuition, Appliance), and third-party/cooperative loans.
2. **Reconciliation & Auditing**: Displays summary metric cards and table subtotals per loan type, enabling payroll administrators to reconcile payroll ledger deductions against actual remittance payments.
3. **Dual Reporting Windows**: Supports auditing per single payroll cutoff period or calendar month consolidation (combining semi-monthly cutoffs into a monthly remittance).
4. **Electronic Remittance File Exports**: Generates official file formats for government agency portals:
   - **SSS**: SSS Loan Remittance Text File (ML2 / SBR format).
   - **Pag-IBIG**: Pag-IBIG Short-Term Loan (STLRF / MCRF) Remittance CSV/Text File.
   - **Internal / Third-Party**: Comprehensive Excel & CSV deduction registers.

---

## 2. Design Decisions (Pros & Cons)

### Decision 1: Report Scope & Category Grouping Strategy

**Option A — Unified Multi-Category Loan Remittance Module with Category Switcher Tabs (Recommended)**
- Single unified view (`/payroll/government-routines/loan-remittance`) supporting tab filters for `All Loans`, `Government Loans`, `Company Loans`, and `Cooperative / Third-Party Loans`, plus sub-filters by specific `loantype`.

| Pros | Cons |
|---|---|
| Single codebase handling all statutory and non-statutory loan remittance reports. | Requires dynamic table columns based on loan category selection. |
| Consistent UX for Payroll Officers regardless of loan type. | |
| Enables full company-wide loan deduction reconciliation in one dashboard. | |

**Option B — Separate Standalone Pages for Government Loans vs Company Loans**
- Build independent, isolated modules for SSS/Pag-IBIG loan remittances vs Company loan reports.

| Pros | Cons |
|---|---|
| Direct 1-to-1 match with legacy stub routes (`/payroll/sss/loan-remittance` and `/payroll/pag-ibig/loan-remittance`). | Code duplication across controllers, queries, composables, and components. |
| | Fails DRY rules and increases maintenance cost when adding new loan types. |

**Recommendation:** Option A, with sub-route aliases so existing menu links (`/payroll/sss/loan-remittance`, `/payroll/pag-ibig/loan-remittance`) route seamlessly to the unified component with the appropriate category pre-selected.

---

### Decision 2: Data Source for Loan Remittances

**Option A — Read Processed Payroll Schedules (`payroll_loan_schedule` joined to `payroll_loan`, `loantype`, and `payroll_run_detail`) (Recommended)**
- Query `payroll_loan_schedule` rows where `idpayperiod` matches the period filter and `paid=1` (or linked via `idpayrollentry`), joined to `payroll_loan` and `loantype`.

| Pros | Cons |
|---|---|
| **100% compliant with non-recomputation rule**: Guarantees remittance report matches actual employee payslip deductions and ledger postings exactly. | Relies on `payroll_loan_schedule.paid` status updated during payroll processing. |
| Captures actual historical repayment amount and remaining balance at the time payroll was run. | |
| Accurately reflects partial deductions or skipped deductions due to low net pay. | |

**Option B — Re-calculate Due Amounts from Active `payroll_loan` Master Records**
- Sum `payroll_loan.amort_amount` for active loans during the selected period.

| Pros | Cons |
|---|---|
| Independent of payroll run detail status. | **Violates domain rule**: if an employee was absent, on unpaid leave, or had deduction paused during payroll, live calculation overstates actual remittance. |
| | Causes reconciliation discrepancies between payslips and remittance reports. |

**Recommendation:** Option A. Reading processed payroll schedule entries guarantees 100% reconciliation with payroll results.

---

### Decision 3: Reporting Window Mode (Single Cutoff Period vs Calendar Month Aggregation)

**Option A — Dual-Mode: Single Pay Period OR Calendar Month Aggregation (Recommended)**
- Allow filtering by a specific `idpayperiod` (single cutoff) OR by `year` + `month` (automatically aggregating all cutoffs ending within that month).

| Pros | Cons |
|---|---|
| SSS and Pag-IBIG loan remittances are submitted on a monthly calendar cycle. | Requires aggregation logic (`SUM()`) across semi-monthly cutoffs for the monthly view. |
| Company and cooperative loans are audited semi-monthly per payroll run. | |
| Provides complete flexibility for both statutory monthly filings and internal cutoff audits. | |

**Option B — Single Pay Period Only**
- Restrict filtering to a single `idpayperiod`.

| Pros | Cons |
|---|---|
| Simpler 1-to-1 query. | Payroll officers must export two semi-monthly reports and manually sum them for SSS/Pag-IBIG monthly filing. |

**Recommendation:** Option A. Satisfies both statutory monthly filing and internal period auditing.

---

### Decision 4: Statutory Electronic Remittance File Exports

**Option A — Server-Side Handlers (`ExportLoanRemittanceHandler` + Dedicated Action Classes) (Recommended)**
- Endpoint `/api/payroll/payroll-reports/loan-remittance/export` generates CSV, Excel, and agency-formatted text files using dedicated streaming actions (`GenerateSssLoanRemittanceFileAction`, `GeneratePagibigLoanRemittanceFileAction`).

| Pros | Cons |
|---|---|
| Exact character alignment, fixed-width line formats, and header/trailer records generated reliably on server. | Requires backend Action classes per statutory file layout. |
| Fully testable via PHPUnit unit tests. | |
| Smoothly handles large payroll datasets without browser client memory issues. | |

**Option B — Generic CSV Export Only**
- Return a simple flat CSV for all loan types.

| Pros | Cons |
|---|---|
| Minimal backend code. | Payroll officers must manually reformat CSV files to match SSS ML2 or Pag-IBIG STLRF upload requirements. |

**Recommendation:** Option A. Automated agency file generation saves payroll officers hours of manual formatting.

---

## 3. Database Schema

No new database tables or column migrations are required. The module reads from existing ground-truth payroll tables:

### Reused Tables & Column Mapping

1. **`payroll_loan`**
   - `id` (unsignedBigInteger, primary key)
   - `idacct` (integer, indexed) — Employee account ID
   - `idloantype` (integer, indexed) — Foreign key to `loantype.id`
   - `reference_no` (varchar) — Agency or internal Loan Reference / SSS SBR / Pag-IBIG Application #
   - `principal` (float) — Original principal loan amount
   - `term_count` (integer) — Total terms (months/pay periods)
   - `amort_amount` (float) — Standard amortization amount per schedule
   - `balance` (float) — Current outstanding balance
   - `start_period` (integer) — Starting pay period ID
   - `status` (integer) — `0=inactive`, `1=active`, `2=fully_paid`

2. **`payroll_loan_schedule`**
   - `id` (unsignedBigInteger, primary key)
   - `idloan` (integer, indexed) — Foreign key to `payroll_loan.id`
   - `seq` (integer) — Amortization sequence number (e.g. 1 of 24)
   - `idpayperiod` (integer, indexed) — Pay period ID where amortization is due
   - `due_amount` (float) — Amortization amount due
   - `paid` (integer) — `0=unpaid`, `1=paid` (processed in payroll)
   - `idpayrollentry` (integer, nullable) — Reference to payroll entry transaction

3. **`loantype`**
   - `id` (unsignedBigInteger, primary key)
   - `code` (varchar) — e.g. `SSS-SAL`, `SSS-CAL`, `HDMF-MPL`, `HDMF-CAL`, `COMP-EMG`, `COMP-ADV`, `COOP-REG`
   - `desc` (varchar) — Human readable description
   - `type` (integer) — Category: `1=Government`, `2=Company`, `3=Third-Party/Cooperative`
   - `loan_mode` (varchar) — `Monthly`, `Semi-Monthly`, `Per Payroll`
   - `priority` (integer) — Deduction priority order
   - `status` (integer) — `1=active`

4. **`payroll_run_detail`**
   - `idpayrun`, `idpayperiod`, `idacct`
   - `loans`, `hdmf_loan`, `sss_loan`, `other_deductions`
   - `breakdown_json` — Structured JSON containing itemized loan deductions

5. **`pay_period`**
   - `id`, `period_start`, `period_end`, `pay_date`, `period_type`

6. **`vw_accounts_details`**
   - `id`, `empid`, `fullname`, `unit`, `position`, `sss_no`, `philhealth_no`, `pagibig_no`

7. **`company` / `company_details`**
   - Employer SSS / Pag-IBIG registration numbers for file headers.

---

## 4. Backend Implementation Plan

Following the **thin-controller + Query/Handler/Action pattern** ([project-gate.md](../../../rules/core/project-gate.md)):

### 4.1 Query Class: `GetLoanRemittanceQuery`

- **Location:** `app/Queries/Payroll/GetLoanRemittanceQuery.php`
- **Class:** `App\Queries\Payroll\GetLoanRemittanceQuery` extends `App\Queries\Query`
- **Signature:** `public static function execute($params = [])`

**Parameters:**
- `category` (string, optional): `all` | `government` | `company` | `third_party` (default: `all`)
- `loantype_id` (integer, optional): Specific `loantype.id` filter
- `period_id` (integer, optional): Specific `pay_period.id`
- `year` (integer, optional): e.g. `2026`
- `month` (integer, optional): `1` to `12`
- `pay_group_id` (integer, optional): Filter by Pay Group
- `department` (string, optional): Filter by department/unit
- `search` (string, optional): Search by employee ID, name, or loan reference number
- `page` (integer, default `1`)
- `per_page` (integer, default `15`)

**Response Structure:**
```json
{
  "summary": {
    "period_mode": "monthly",
    "year": 2026,
    "month": 7,
    "total_headcount": 28,
    "total_deductions": 84500.00,
    "by_category": {
      "government": 52000.00,
      "company": 22500.00,
      "third_party": 10000.00
    },
    "by_loan_type": [
      { "loantype_id": 1, "code": "SSS-SAL", "desc": "SSS Salary Loan", "type": 1, "count": 12, "amount": 31200.00 },
      { "loantype_id": 2, "code": "SSS-CAL", "desc": "SSS Calamity Loan", "type": 1, "count": 4, "amount": 6800.00 },
      { "loantype_id": 3, "code": "HDMF-MPL", "desc": "Pag-IBIG Multi-Purpose Loan (MPL)", "type": 1, "count": 8, "amount": 14000.00 },
      { "loantype_id": 6, "code": "COMP-EMG", "desc": "Company Emergency Loan", "type": 2, "count": 5, "amount": 15000.00 },
      { "loantype_id": 13, "code": "COOP-REG", "desc": "Cooperative Regular Loan", "type": 3, "count": 3, "amount": 10000.00 }
    ]
  },
  "loans": [
    {
      "idloan": 45,
      "idacct": 102,
      "empid": "EMP-2024-001",
      "fullname": "Dela Cruz, Juan",
      "unit": "Engineering",
      "position": "Software Engineer",
      "gov_ids": {
        "sss_no": "34-1234567-8",
        "pagibig_no": "1234-5678-9012"
      },
      "loan_type": {
        "id": 1,
        "code": "SSS-SAL",
        "desc": "SSS Salary Loan",
        "category": "Government"
      },
      "reference_no": "SSS-SL-2025-0891",
      "principal": 30000.00,
      "term_count": 24,
      "seq": 6,
      "deduction_amount": 1450.00,
      "outstanding_balance": 21300.00,
      "status": "Paid",
      "missing_ref_warning": false
    }
  ],
  "loan_types": [
    { "id": 1, "code": "SSS-SAL", "desc": "SSS Salary Loan", "type": 1 },
    { "id": 3, "code": "HDMF-MPL", "desc": "Pag-IBIG Multi-Purpose Loan (MPL)", "type": 1 }
  ],
  "departments": ["Engineering", "HR", "Finance"],
  "total": 28,
  "per_page": 15,
  "page": 1
}
```

---

### 4.2 Export Handler & Action Classes

1. **`App\Handlers\Payroll\ExportLoanRemittanceHandler`**
   - Validates export parameters (`category`, `loantype_id`, `format`: `csv`|`excel`|`txt`, `year`, `month`, `period_id`).
   - Fetches complete dataset using `GetLoanRemittanceQuery::execute($params + ['per_page' => 999999])`.
   - Delegates agency file formatting to Action classes:
     - `App\Actions\Payroll\GenerateSssLoanRemittanceFileAction` (SSS ML2 / SBR format)
     - `App\Actions\Payroll\GeneratePagibigLoanRemittanceFileAction` (Pag-IBIG STLRF / MCRF format)
   - Returns stream response with proper HTTP headers (`Content-Type`, `Content-Disposition: attachment; filename="..."`).

---

### 4.3 Controller: `PayrollReportsController`

Add methods to existing `App\Http\Controllers\payroll\PayrollReportsController`:

```php
/**
 * Get Loan Remittance Report dataset (Government, Company, Cooperative)
 */
public function loanRemittance(Request $request)
{
    try {
        $data = GetLoanRemittanceQuery::execute($request->all());
        return response()->json($data);
    } catch (Exception $e) {
        return response()->json(['message' => $e->getMessage()], 400);
    }
}

/**
 * Export Loan Remittance Report (CSV / Excel / Agency Electronic File)
 */
public function exportLoanRemittance(Request $request)
{
    try {
        return ExportLoanRemittanceHandler::execute($request->all());
    } catch (Exception $e) {
        return response()->json(['message' => $e->getMessage()], 400);
    }
}
```

---

### 4.4 Route Registration

Register in `routes/api/payroll.php` under the `payroll-reports` group:

```php
// Loan Remittance Reports & Agency Electronic File Exports
Route::get('/payroll-reports/loan-remittance',        [PayrollReportsController::class, 'loanRemittance']);
Route::get('/payroll-reports/loan-remittance/export', [PayrollReportsController::class, 'exportLoanRemittance']);
```

---

## 5. Frontend Implementation Plan

Module layout located under `resources/views/web/src/module/payroll/government_routines/`:

### 5.1 TS Module Structure

```text
resources/views/web/src/module/payroll/government_routines/
├── api/
│   └── loan_remittance.api.ts
├── composables/
│   └── useLoanRemittance.ts
├── types/
│   └── types.loan_remittance.ts
└── pages/
    ├── sss/
    │   └── loan_remittance/LoanRemittance.vue            (Wrapper pre-selecting SSS loans)
    ├── pagibig/
    │   └── loan_remittance/LoanRemittance.vue            (Wrapper pre-selecting Pag-IBIG loans)
    └── loan_remittance/
        ├── LoanRemittanceReport.vue                      (Main Consolidated Page)
        └── components/
            ├── LoanRemittanceSummaryCards.vue            (Metric Cards by Category & Loan Type)
            ├── LoanRemittanceFilters.vue                 (Category, Loan Type, Year, Month, Period, Dept filters)
            ├── LoanRemittanceTable.vue                   (Loan Remittance Data Table)
            └── LoanRemittanceExportModal.vue              (File format & Agency Export options)
```

---

### 5.2 Key UI Components & Interactions

1. **`LoanRemittanceFilters.vue`**
   - **Category Switcher Tabs**: `All Loans`, `Government Loans`, `Company Loans`, `Cooperative / Third-Party`.
   - **Loan Type Dropdown**: Filter dynamically by active loan types (e.g. SSS Salary Loan, Pag-IBIG MPL, Emergency Loan).
   - **Period Mode Toggle**: `Monthly Consolidation` vs `Single Pay Period`.
   - **Date Controls**: Year Select (e.g. 2026), Month Select (Jan - Dec), or Pay Period dropdown.
   - **Department Filter & Employee Search**: Real-time debounced filtering.

2. **`LoanRemittanceSummaryCards.vue`**
   - Card 1: Total Employees with Loan Deductions
   - Card 2: Total Government Loans Remittance (SSS + Pag-IBIG)
   - Card 3: Total Company Loans Remittance
   - Card 4: Total Third-Party / Cooperative Remittance
   - Card 5: Grand Total Loan Remittance (Highlighted Card)

3. **`LoanRemittanceTable.vue`**
   - **Columns**: Employee ID, Employee Name, Department, Loan Category, Loan Type (`loantype.desc`), Loan Reference Number, Amortization Sequence (`seq / term_count`), Deduction Amount, Outstanding Balance, Status.
   - **Warnings**: Yellow badge indicator if `reference_no` or government agency ID is missing.
   - **Footer Row**: Sticky bottom row displaying total deduction amounts and total remaining balances for the filtered set.
   - **Pagination**: Integrated with backend pagination meta.

4. **`LoanRemittanceExportModal.vue`**
   - Export Options:
     - `Excel Spreadsheet (.xlsx)` — Detailed loan reconciliation sheet.
     - `CSV File (.csv)` — Standard flat CSV.
     - `SSS Loan Remittance File (.txt)` — ML2 text file format for SSS portal.
     - `Pag-IBIG Loan Remittance File (.csv/.txt)` — STLRF format for Pag-IBIG portal.

---

### 5.3 Frontend Service Layer (`api/loan_remittance.api.ts`)

```ts
import http from '@/app/axios/axiosInstance';
import type { LoanRemittanceParams, LoanRemittanceResponse } from '../types/types.loan_remittance';

export function useLoanRemittanceApi() {
  return {
    getReport: async (params: LoanRemittanceParams): Promise<LoanRemittanceResponse> => {
      const response = await http.get('api/payroll/payroll-reports/loan-remittance', { params });
      return response.data;
    },
    exportReport: async (params: LoanRemittanceParams & { format: string }): Promise<Blob> => {
      const response = await http.get('api/payroll/payroll-reports/loan-remittance/export', {
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

Update/register routes pointing to the loan remittance components:

```ts
{
  path: 'payroll/loan-remittance',
  name: 'payroll_loan_remittance',
  component: () => import('../pages/loan_remittance/LoanRemittanceReport.vue'),
  meta: { title: 'Loan Remittance Report' }
},
{
  path: 'payroll/sss/loan-remittance',
  name: 'payroll_sss_loan_remittance',
  component: () => import('../pages/loan_remittance/LoanRemittanceReport.vue'),
  props: { defaultCategory: 'government', defaultLoanCode: 'SSS' },
  meta: { title: 'SSS - Loan Remittance' }
},
{
  path: 'payroll/pag-ibig/loan-remittance',
  name: 'payroll_pag_ibig_loan_remittance',
  component: () => import('../pages/loan_remittance/LoanRemittanceReport.vue'),
  props: { defaultCategory: 'government', defaultLoanCode: 'HDMF' },
  meta: { title: 'Pag-IBIG - Loan Remittance' }
}
```

---

## 6. Business Rules & Edge Cases

### 6.1 Business Rules

1. **Non-Recomputation Directive (Historic Invariance)**
   - The query MUST read actual loan deduction records stored in `payroll_loan_schedule` and `payroll_run_detail`.
   - It MUST NOT recalculate amortizations or re-evaluate loan balances based on current master records.

2. **Run Status Filtering**
   - By default, only finalized payroll runs (`payroll_run.status = 1`) are included in statutory remittance exports.
   - Draft runs can be previewed on screen only when explicit `include_draft=1` flag is passed.

3. **Multiple Loan Support per Employee**
   - An employee may have multiple active loans concurrently (e.g. SSS Salary Loan + Pag-IBIG MPL + Company Emergency Loan). Each loan deduction is rendered as a distinct row in the remittance report with its corresponding loan reference number.

4. **Zero / Insufficient Net Pay Partial Deductions**
   - If an employee had insufficient net pay during payroll calculation and only a partial loan amortization was deducted, the report reflects the **actual deducted amount** recorded in payroll, not the scheduled full amortization amount.

---

### 6.2 Edge Cases Matrix

| Edge Case | Impact | Handling & Resolution |
|---|---|---|
| **Loan reference number missing (`reference_no` is null/empty)** | Agency remittance portal rejects upload row. | Display warning badge on table row. Flag in export validation summary. |
| **Employee has multiple loans of the same category** | Risk of grouping collisions if not uniquely identified. | Query groups strictly by `payroll_loan.id` (unique loan agreement instance) rather than just employee ID. |
| **Loan fully paid off during the period (`balance = 0`)** | Final amortization payment processed. | Included in remittance report with `status = Fully Paid` and zero remaining balance. |
| **Manual loan deduction override via Payroll Entry Batch** | Deduction amount differs from standard schedule. | Query reads actual payroll transaction deduction amount, tagging row as "Manual Override". |
| **Resigned employee paid via Final Pay** | Loan balance payoff or final amortization processed in final pay. | Includes loan deductions from `cycle='final'` runs and marks employee as "Separated / Final Pay". |

---

## 7. Build Order

Follow the **Design-First Workflow** ([webkit.frontend-implement](../../skills/webkit.frontend-implement/SKILL.md) -> [webkit.backend-implement](../../skills/webkit.backend-implement/SKILL.md)):

### Phase 1 — Frontend Gate 1 (Design-First with Hard-Coded / Mock Data)
1. Create TypeScript types in `resources/views/web/src/module/payroll/government_routines/types/types.loan_remittance.ts`.
2. Scaffold `api/loan_remittance.api.ts` with mock response data.
3. Build composable `composables/useLoanRemittance.ts` managing active category tabs, loan type selection, period mode, filters, and pagination.
4. Implement UI components:
   - `LoanRemittanceFilters.vue`
   - `LoanRemittanceSummaryCards.vue`
   - `LoanRemittanceTable.vue`
   - `LoanRemittanceExportModal.vue`
5. Implement main page `pages/loan_remittance/LoanRemittanceReport.vue`.
6. Update Vue route definitions in `route/government_routines.routes.ts`.
7. **User Validation Gate:** Present UI to user for visual & layout approval.

### Phase 2 — Backend Gate 2 (Query, Handlers & Dynamic Data Wiring)
8. Implement Query class `App\Queries\Payroll\GetLoanRemittanceQuery`.
9. Implement Action classes for remittance file formatters (`GenerateSssLoanRemittanceFileAction`, `GeneratePagibigLoanRemittanceFileAction`).
10. Implement Handler class `App\Handlers\Payroll\ExportLoanRemittanceHandler`.
11. Add controller methods to `App\Http\Controllers\payroll\PayrollReportsController`.
12. Register API endpoints in `routes/api/payroll.php`.
13. Wire live API calls into `api/loan_remittance.api.ts` swapping out mock data.

### Phase 3 — Verification & Testing
14. Run PHPUnit tests verifying read-only retrieval accuracy against `payroll_loan_schedule` and `payroll_run_detail`.
15. Verify monthly consolidation (combining 1st & 2nd half cutoffs).
16. Test CSV/Excel/Text file download formats for SSS and Pag-IBIG.

---

## 8. Out of Scope (Future Specs)

- **Direct Banking Auto-Debit Clearing API Integration**: Direct electronic bank transfer APIs for loan repayments (future treasury spec).
- **Loan Application & Multi-Level Approval Workflow**: Employee loan request workflow (covered by separate HR/Payroll Loan Management spec).
