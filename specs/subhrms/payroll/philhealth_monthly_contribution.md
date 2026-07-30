# Spec — PhilHealth Monthly Contribution Report & RF-1 / EPRiS Export Routine

> **Kind:** Greenfield / Extension (Statutory PhilHealth monthly remittance consolidation report & electronic RF-1 / EPRiS export module).  
> **Portal:** **Payroll** (`/api/payroll/...` routes, `government_routines/pages/philhealth/monthly_contribution` frontend module).  
> **Route:** `/payroll/phil-health/monthly-contribution` (`payroll_government_routines_philhealth_monthly_contribution`).  
> **Conventions:** [project-profile.md](../../rules/project-profile.md), [hrms-rules.md](../../rules/hrms-rules.md).  
> **System Awareness:** Models reused (`PayrollRun`, `PayrollRunDetail`, `PayPeriod`, `Account`, `AccountDetailVW`, `Company`); Tables reused (`payroll_run`, `payroll_run_detail`, `pay_period`, `vw_accounts_details`, `company`); Routes created (`/payroll/government-routines/philhealth/monthly-contribution`, `/payroll/government-routines/philhealth/export-rf1`); New migration: no.

---

## 1. Purpose

The **PhilHealth Monthly Contribution Report** is a statutory compliance module generated following payroll processing. It consolidates all employee (EE) and employer (ER) PhilHealth premium contributions for any selected payroll cutoff period or full calendar month under Republic Act No. 11223 (Universal Health Care Act). It serves as the official reference for PhilHealth monthly remittance, reconciliation between payroll deductions and statutory liabilities, and electronic submission via the PhilHealth Electronic Premium Reporting System (EPRiS) or RF-1 quarterly/monthly rosters.

Unlike payroll calculation engines, the PhilHealth Monthly Contribution Report **does not recalculate or re-evaluate contribution amounts**. Instead, it retrieves historical contribution values already persisted in `payroll_run_detail` (`philhealth_contributable_salary`, `philhealth_salary_basis`, `philhealth_ee`, `philhealth_er`, `philhealth_total`). This guarantees **strict historic invariance**: the report and its generated remittance files will always 100% reconcile with the deductions recorded in finalized payroll runs, even if PhilHealth rate schedules or employee salary rates change in the future.

The module provides HR and Payroll Officers with:
1. An interactive statutory audit table with filtering, search, department groupings, and aggregate summary metrics (Total EE Share, Total ER Share, Grand Total PhilHealth Remittance).
2. Dual reporting modes: single cutoff pay period auditing or full calendar month consolidation (combining semi-monthly 1st and 2nd half cutoffs into a single monthly PhilHealth line item per employee).
3. Standardized export formats required for official compliance filing:
   - **PhilHealth EPRiS**: Electronic Premium Reporting System upload file format (.csv).
   - **PhilHealth RF-1 Roster**: Official Monthly/Quarterly Remittance List (.xlsx / .pdf).
   - **Internal Reconciliation**: Detailed breakdown excel sheet with employee PEN numbers, salary basis, and share split.

---

## 2. Design Decisions (Pros & Cons)

### Decision 1: Reporting Period Window (Single Cutoff Period vs Monthly Aggregation)

**Option A — Flexible Dual-Mode: Single Cutoff Period OR Calendar Month Aggregation (Recommended)**
- Allow filtering by a specific `idpayperiod` (single cutoff) OR by `year` + `month` (automatically aggregating all semi-monthly cutoffs ending within that calendar month).

| Pros | Cons |
|---|---|
| PhilHealth collects statutory remittances on a calendar-month basis; aggregating cutoffs produces the exact single-line monthly total per employee required by EPRiS/RF-1. | Requires aggregation logic (`SUM()`) across multiple payroll cutoffs for the monthly view. |
| Supports mid-month single-cutoff payroll auditing before month-end closing. | |
| Eliminates manual spreadsheet merging by payroll officers for semi-monthly companies. | |

**Option B — Strict Single Pay-Period Selection Only**
- Require selecting a single `idpayperiod`.

| Pros | Cons |
|---|---|
| Direct 1-to-1 match with a single `payroll_run` header. | Inconvenient for semi-monthly payrolls where PhilHealth mandates a single monthly remittance per employee. |
| Zero aggregation required across periods. | Payroll officers must export 1st-half and 2nd-half reports and merge them manually in Excel. |

**Recommendation:** Option A. Dual-mode satisfies both internal cutoff auditing and monthly government agency filing requirements.

---

### Decision 2: Employer Share (ER) Data Source Strategy

**Option A — Primary Stored Snapshot Columns with 50/50 Fallback for Legacy Runs (Recommended)**
- Read `payroll_run_detail.philhealth_ee` and `philhealth_er`. If legacy payroll runs created before snapshot columns were introduced lack explicit ER fields, apply the statutory PhilHealth 50/50 equal share split fallback ($\text{ER} = \text{EE}$).

| Pros | Cons |
|---|---|
| 100% backward compatible with legacy processed payroll runs. | Query class contains a minor fallback condition for older payroll entries. |
| Fast execution without invoking external calculation engines. | |
| Preserves exact historical record for new payroll runs. | |

**Option B — Dynamic Recomputation of ER Share**
- Recompute the employer share dynamically from stored basic salary using active rate tables during report execution.

| Pros | Cons |
|---|---|
| Always computes ER dynamically in PHP. | Risks historical discrepancy if rate tables or salary limits were updated after the payroll was closed. |
| | Violates the core non-recomputation principle of statutory government routines. |

**Recommendation:** Option A. Reading stored snapshots with statutory fallback ensures historical integrity and audit compliance.

---

### Decision 3: Export File Generation Format

**Option A — Multi-Format Support: EPRiS (.csv), RF-1 Roster (.xlsx), and Audit Summary (.pdf) (Recommended)**
- Provide dedicated export handlers for PhilHealth EPRiS file format, Excel RF-1 roster, and printable PDF audit summaries.

| Pros | Cons |
|---|---|
| Directly uploadable to PhilHealth EPRiS web portal without manual formatting. | Requires export action classes for CSV, Excel, and PDF formats. |
| Provides printable PDF for company auditor sign-off and filing. | |

**Option B — Generic CSV Export Only**
- Offer a single generic raw CSV table dump.

| Pros | Cons |
|---|---|
| Simple to build. | Fails to format header lines, PEN numbers, and company signatory details required by PhilHealth EPRiS specs. |
| | Payroll officers have to manually reformat headers before uploading to PhilHealth. |

**Recommendation:** Option A. Delivers an end-to-end compliance workflow ready for immediate submission.

---

### Decision 4: Component Architecture

**Option A — Specialized PhilHealth Wrapper (`PhilHealthMonthlyContribution.vue`) reusing Modular Composables (Recommended)**
- Place the PhilHealth Monthly Contribution view inside `resources/views/web/src/module/payroll/government_routines/pages/philhealth/monthly_contribution/`, importing shared statutory report components and API composables.

| Pros | Cons |
|---|---|
| Clean integration under the PhilHealth Compliance Portal hub (`/payroll/phil-health/monthly-contribution`). | Small wrapper file needed to bridge generic reporting components. |
| Allows custom PhilHealth-specific metrics (UHC 5.0% rate badge, PEN number column, EPRiS export modal) without cluttering other agency views. | |

**Option B — Monolithic Shared View for All Agencies**
- Force SSS, PhilHealth, and Pag-IBIG into a single generic table view with dynamic column switches.

| Pros | Cons |
|---|---|
| Single file for all statutory reports. | Highly complex template with conditional `v-if` branches for agency-specific columns (e.g. SSS WISP vs PhilHealth PEN vs Pag-IBIG HDMF). |
| | Harder to maintain and test independently. |

**Recommendation:** Option A. Specialized wrapper keeps portal routes clean while sharing underlying API logic.

---

## 3. Database Schema & Data Sources

### 3.1 Reused Database Tables

No new database migration is required. The report queries existing database entities:

1. **`payroll_run_detail`**: Source of employee historical contributions (`philhealth`, `philhealth_contributable_salary`, `philhealth_salary_basis`, `philhealth_ee`, `philhealth_er`, `philhealth_total`).
2. **`payroll_run`**: Payroll execution header (`status`, `date_from`, `date_to`, `approved_at`).
3. **`pay_period`**: Cutoff period metadata (`period_code`, `year`, `month`, `cutoff_order`).
4. **`vw_accounts_details`**: Employee master data (`empid`, `fullname`, `fname`, `lname`, `mname`, `philhealth_no`, `unit_id`, `pos_id`).
5. **`company`**: Company statutory registration details (`companyname`, `trade_name`, `philhealth_no` / PEN, `signatory_name`, `signatory_position`).

### 3.2 SQL Data Aggregation Query Pattern

```sql
SELECT 
  a.empid AS employee_number,
  CONCAT(a.lname, ', ', a.fname, IFNULL(CONCAT(' ', SUBSTR(a.mname, 1, 1), '.'), '')) AS full_name,
  a.philhealth_no AS philhealth_number,
  SUM(prd.philhealth_contributable_salary) AS total_contributable_salary,
  MAX(prd.philhealth_salary_basis) AS monthly_salary_basis,
  SUM(prd.philhealth_ee) AS total_ee_share,
  SUM(prd.philhealth_er) AS total_er_share,
  SUM(prd.philhealth_total) AS total_contribution
FROM payroll_run_detail prd
JOIN payroll_run pr ON prd.idpayrun = pr.id
JOIN pay_period pp ON prd.idpayperiod = pp.id
JOIN vw_accounts_details a ON prd.idacct = a.id
WHERE pr.status IN ('COMPLETED', 'POSTED', 'APPROVED')
  AND pp.year = :year
  AND pp.month = :month
GROUP BY a.id, a.empid, a.lname, a.fname, a.mname, a.philhealth_no
ORDER BY a.lname ASC, a.fname ASC;
```

---

## 4. Backend Architecture

Following the mandatory Thin-Controller + Query/Handler/Action pattern (`app/Domain/` is retired):

### 4.1 Domain Classes

1. **Query:** `app/Queries/Philhealth/GetPhilhealthMonthlyContributionReportQuery.php`
   - Location: `app/Queries/Philhealth/`
   - Class: `GetPhilhealthMonthlyContributionReportQuery extends Query`
   - Signature: `public static function execute($params = [])`
   - Functionality:
     - Accepts `$params`: `period_mode` (`'monthly'` vs `'cutoff'`), `year`, `month`, `idpayperiod`, `department_id`, `search`, `page`, `per_page`.
     - Queries `payroll_run_detail` joined with `pay_period`, `vw_accounts_details`, and `company`.
     - Returns paginated employee summary rows + aggregate summary object (`grand_total_ee`, `grand_total_er`, `grand_total_contribution`, `total_employees`, `period_label`).

2. **Action (EPRiS / RF-1 Exporter):** `app/Actions/Philhealth/ExportPhilhealthRf1Action.php`
   - Location: `app/Actions/Philhealth/`
   - Class: `ExportPhilhealthRf1Action extends Action`
   - Signature: `public static function execute($params = [])`
   - Functionality:
     - Fetches report dataset via `GetPhilhealthMonthlyContributionReportQuery`.
     - Fetches company PEN (`company.philhealth_no`), trade name, and authorized signatory from `company` table.
     - Formats output according to official PhilHealth EPRiS CSV specifications:
       - Header line: Employer PEN, Company Name, Applicable Month/Year, Total Employees, Total Remittance.
       - Detail lines: Member PIN (PhilHealth No), Last Name, First Name, Middle Name, Salary Basis, EE Share, ER Share, Total Share, Status Tag.
     - Returns raw CSV string stream or downloadable file response.

3. **Controller:** `app/Http/Controllers/Payroll/PhilhealthGovernmentRoutineController.php`
   - Location: `app/Http/Controllers/Payroll/`
   - Extends `App\Http\Controllers\Controller`.
   - Methods:
     ```php
     public function monthlyContributionReport(Request $request)
     {
         try {
             $data = GetPhilhealthMonthlyContributionReportQuery::execute($request->all());
             return response()->json(['data' => $data]);
         } catch (Exception $e) {
             return response()->json(['message' => $e->getMessage()], 400);
         }
     }

     public function exportRf1(Request $request)
     {
         try {
             return ExportPhilhealthRf1Action::execute($request->all());
         } catch (Exception $e) {
             return response()->json(['message' => $e->getMessage()], 400);
         }
     }
     ```

### 4.2 API Routes (`routes/api/payroll.php`)

```php
// ─── Government Routines: PhilHealth Monthly Contribution Report ─────────
Route::prefix('payroll/government-routines/philhealth')->group(function () {
    Route::get('/monthly-contribution', [PhilhealthGovernmentRoutineController::class, 'monthlyContributionReport']);
    Route::get('/export-rf1', [PhilhealthGovernmentRoutineController::class, 'exportRf1']);
});
```

---

## 5. Frontend Architecture

### 5.1 Module Structure & Folder Layout

Lives inside the Payroll module under `resources/views/web/src/module/payroll/government_routines/pages/philhealth/monthly_contribution/`:

```
resources/views/web/src/module/payroll/government_routines/pages/philhealth/monthly_contribution/
├── index.ts                                             # Public barrel export
├── route/philhealth_monthly_contribution.routes.ts      # Route definitions
├── api/philhealth_monthly_contribution.api.ts           # Service layer using @/app/axios/axiosInstance
├── composables/usePhilhealthMonthlyContribution.ts      # Reactive state & report fetching logic
├── pages/PhilHealthMonthlyContributionPage.vue          # Main page view
├── components/
│   ├── PhilhealthMonthlySummaryCards.vue                # Top KPI Stat Cards (EE, ER, Total, Count)
│   ├── PhilhealthMonthlyFilters.vue                     # Year, Month, Period Mode, Dept Filters
│   ├── PhilhealthMonthlyTable.vue                       # Data Table with Grand Totals Footer
│   └── PhilhealthExportModal.vue                        # Export dialog for EPRiS CSV / RF-1 Excel
└── types/types.philhealth_monthly_contribution.ts       # TypeScript interfaces
```

### 5.2 UI Design & Aesthetics

- **Header Banner:** Standard `HeaderBanner` with `portal="payroll"`, `iconClass="mdi-file-document-check-outline"`, title **"PhilHealth Monthly Contribution Report"**, cyan/emerald gradient theme, and `RA 11223 Compliant` badge.
- **Top Metric Cards:**
  - **Total EE Premium:** Sum of employee deductions (`font-mono` emerald value).
  - **Total ER Premium:** Sum of employer shares (`font-mono` teal value).
  - **Grand Total Remittance:** EE + ER combined (`font-mono` cyan bold value).
  - **Reporting Scope:** Active period/month label and covered employee count.
- **Filters Toolbar:**
  - Mode Switcher: Toggle between "Monthly Consolidation" and "Single Cutoff Period".
  - Year `CSelect` (`2026`, `2025`, `2024`).
  - Month `CSelect` (`January` through `December`).
  - Department `CSelect` (`All Departments`, etc.).
  - Search Input: Search by employee name, empid, or PhilHealth PIN.
  - Buttons: "Export EPRiS CSV", "Export RF-1 Excel", "Print PDF".
- **Data Table:**
  - Column headers: `Emp ID`, `Employee Name`, `PhilHealth PIN`, `Monthly Salary Basis`, `EE Share`, `ER Share`, `Total Premium`, `Status`.
  - Monospace numeric cells (`font-mono`).
  - Sticky Grand Totals footer row highlighting aggregate EE, ER, and Total remittance.
  - Empty state component (`EmptyState`) when no finalized payroll run exists for the selected period.

---

## 6. Business Rules & Edge Cases

### 6.1 HRMS Domain Rules ([hrms-rules.md](../../rules/hrms-rules.md))

1. **Historic Non-Recomputation Rule:**
   - Report queries `payroll_run_detail` directly.
   - It DOES NOT recalculate contributions dynamically from basic salary during execution.
   - Preserves exact historical numbers even if PhilHealth rates or salary bounds change in later years.

2. **Monthly Aggregation Math (Semi-Monthly Payrolls):**
   - For a calendar month with 2 cutoffs (Cutoff 1 and Cutoff 2):
     $$\text{EE}_{\text{monthly}} = \text{EE}_{\text{cutoff1}} + \text{EE}_{\text{cutoff2}}$$
     $$\text{ER}_{\text{monthly}} = \text{ER}_{\text{cutoff1}} + \text{ER}_{\text{cutoff2}}$$
     $$\text{Total}_{\text{monthly}} = \text{EE}_{\text{monthly}} + \text{ER}_{\text{monthly}}$$
   - Salary basis represents the monthly basic salary basis evaluated during the payroll run.

3. **PhilHealth PIN Validation & Display:**
   - Display employee `philhealth_no` from `vw_accounts_details`.
   - If missing or unassigned, mark badge as `Pending PIN` in amber badge to alert HR before generating official EPRiS remittance files.

4. **Company Employer PEN Integration:**
   - Report header & export files pull official PhilHealth Employer Number (PEN) and registered trade name from `company` master settings.

### 6.2 Edge Cases Handling Matrix

| Edge Case | Handling Strategy |
|---|---|
| **Unapproved / Draft Payroll Runs** | By default, report queries only `COMPLETED`, `POSTED`, or `APPROVED` payroll runs. Include optional "Include Draft" toggle for preliminary audit preview. |
| **Employees Separated Mid-Month** | Include separated employees who had processed payroll earnings and PhilHealth deductions within the selected period. |
| **Zero Contribution Employees (Exempt / Below Basis)** | Filter or flag zero-deduction rows with clear tag (`No Contribution`) to prevent corrupting PhilHealth remittance file count totals. |
| **Missing PhilHealth PIN Number** | Display placeholder `00-000000000-0` or `UNASSIGNED` in UI and flag in export modal pre-validation check. |
| **Legacy Payroll Runs (Missing Stored ER Columns)** | Automatically apply statutory 50/50 fallback split ($\text{ER} = \text{EE}$) if legacy row has `philhealth_ee > 0` but `philhealth_er = 0`. |

---

## 7. Build Order

1. **Backend Query & Exporter Classes:**
   - Create `app/Queries/Philhealth/GetPhilhealthMonthlyContributionReportQuery.php`.
   - Create `app/Actions/Philhealth/ExportPhilhealthRf1Action.php`.
2. **Backend Controller & Routes:**
   - Create or extend `app/Http/Controllers/Payroll/PhilhealthGovernmentRoutineController.php`.
   - Register endpoints `/payroll/government-routines/philhealth/monthly-contribution` and `/export-rf1` in `routes/api/payroll.php`.
3. **Frontend Gate 1 (Static Design & Mock Data):**
   - Scaffold module layout under `resources/views/web/src/module/payroll/government_routines/pages/philhealth/monthly_contribution/`.
   - Create `types.philhealth_monthly_contribution.ts`, `api/philhealth_monthly_contribution.api.ts`, `usePhilhealthMonthlyContribution.ts`.
   - Build `PhilHealthMonthlyContributionPage.vue`, `PhilhealthMonthlySummaryCards.vue`, `PhilhealthMonthlyFilters.vue`, `PhilhealthMonthlyTable.vue`, `PhilhealthExportModal.vue` with static mockup data.
4. **Frontend Gate 2 (Live API Wiring):**
   - Connect composable to live HTTP endpoints (`/api/payroll/government-routines/philhealth/monthly-contribution`).
5. **Verification & Testing:**
   - Test monthly aggregation query against multi-cutoff payrolls, verify EPRiS CSV export formatting, validate grand totals footer math, and test responsive UI in light/dark modes.

---

## 8. Out of Scope (Future Specs)

- **Direct Web API Sync to PhilHealth EPRiS Portal:** Automated direct web service API upload to PhilHealth portal (standard file download/export remains the primary mechanism).
- **SSS & Pag-IBIG Monthly Reports:** Covered in their respective specification files (`monthly_contribution_report.md`, `pagibig_monthly_contribution.md`).
