# Spec — SSS Contribution Table & Statutory Routine Integration

> **Kind:** Greenfield (New master reference table & integration into Payroll Calculation & Government Routines SSS).  
> **Portal:** **Payroll** (`/api/payroll/...` routes, `government_routines/pages/sss` frontend module).  
> **Route:** `/payroll/government-routines/sss` (`payroll_government_routines_sss`).  
> **Conventions:** [project-gate.md](../../../rules/core/project-gate.md), [payroll.md](../../../rules/conditional/payroll.md).  
> **System Awareness:** Models created (`SssContributionTable`); Tables created (`sss_contribution_table`), extended (`payroll_run_detail`); Routes created (`/payroll/sss-contribution-table`); New migration: yes.

---

## 1. Purpose

The **SSS Contribution Table** is a master reference maintained by the system that stores official Social Security System (SSS) contribution schedules based on prescribed salary brackets, Monthly Salary Credit (MSC), Regular Social Security, Employee's Compensation (EC), and Mandatory WISP (Workers' Investment and Savings Program) Provident Fund shares under **Republic Act No. 11199 (Social Security Act of 2018)**.

During payroll calculation, the system avoids error-prone percentage calculations by executing a precise **table range lookup** against the employee's SSS-contributable salary. Upon finding the matching bracket, the retrieved values (`msc`, `ee_share`, `er_share`, `ec_share`, `wisp_ee`, `wisp_er`, `total_contribution`) are **persisted into the processed payroll transaction (`payroll_run_detail`)**. 

This guarantees **historical invariance**: processed payroll records remain permanently anchored to the contribution amounts of that period even if official SSS schedules change in future years. The **Government Routine – SSS module** reads these persisted contribution values, consolidates them by payroll period/month, and produces statutory submission reports (R-5, R-3, WISP Summary, and SSS Payment Upload Files) without recomputing contributions.

---

## 2. Design Decisions (Pros & Cons)

### Decision 1: Contribution Determination Method (Table Range Lookup vs Dynamic Formula)

**Option A — Table Range Lookup with Explicit Brackets & WISP Splitting (Recommended)**
- Maintain an active `sss_contribution_table` specifying minimum/maximum salary bounds, MSC, Regular EE/ER, EC, and WISP EE/ER. Perform a SQL range query (`salary_min <= contributable_salary AND (salary_max >= contributable_salary OR salary_max IS NULL)`).

| Pros | Cons |
|---|---|
| 100% compliant with SSS RA 11199 official published contribution tables. | Requires seeding and occasional maintenance when SSS revises tables. |
| Handles non-linear steps, exact centavo rounding, EC fixed tiers, and WISP thresholds perfectly. | Requires DB table range query per processed employee. |
| Easily audited by HR and Payroll specialists against official SSS circulars. | |

**Option B — Dynamic Percentage Computation with Hard-Coded Formula Caps**
- Compute 4.5% EE and 9.5% ER dynamically in code based on salary capped at MSC limits.

| Pros | Cons |
|---|---|
| No DB lookup required; purely mathematical calculation. | Prone to 1-centavo rounding discrepancies against official SSS published tables. |
| | Fails to account for non-proportional EC tiers (P10 vs P30) and strict MSC bracket step limits. |
| | Harder to audit and update when statutory thresholds change. |

**Recommendation:** Option A. SSS statutory compliance mandates exact alignment with published bracket tables.

---

### Decision 2: Historical Contribution Storage Location (Extend `payroll_run_detail` vs Separate SSS Audit Table)

**Option A — Extend `payroll_run_detail` with Dedicated SSS Columns (Recommended)**
- Add `sss_contributable_salary`, `sss_msc`, `sss_ee`, `sss_er`, `sss_ec`, `sss_wisp_ee`, `sss_wisp_er`, and `sss_total` directly to `payroll_run_detail`.

| Pros | Cons |
|---|---|
| Single-query retrieval for payslips, payroll registers, YTD summaries, and SSS R-3/R-5 reports. | Slightly increases row width of `payroll_run_detail`. |
| Aligns with existing `payroll_run_detail` architecture used for PhilHealth and Pag-IBIG. | |
| Zero JOINs needed when building monthly government routines and collection lists. | |

**Option B — Create a Standalone `payroll_sss_contributions` Detail Table**
- Store SSS calculation breakdowns in a separate child table linked to `idpayrollrundetail`.

| Pros | Cons |
|---|---|
| Keeps `payroll_run_detail` columns focused. | Requires 1-to-1 table JOINs for every payroll run summary and report generation. |
| | Risk of orphaned records during payroll re-runs or deletes. |

**Recommendation:** Option A. Extending `payroll_run_detail` keeps transaction queries fast, atomic, and simple.

---

### Decision 3: SSS Table Management UI Placement

**Option A — Integrated Tab inside Government Routines SSS (`/payroll/government-routines/sss`) (Recommended)**
- Embed the SSS Contribution Table editor & viewer as an active tab inside the existing SSS Government Routine portal page.

| Pros | Cons |
|---|---|
| Unified location: Payroll officers can inspect contribution tables and generate SSS reports in one place. | Requires tab state navigation on the SSS page. |
| Prevents cluttering the generic Maintenance menu. | |

**Option B — Standalone Maintenance Page (`/payroll/maintenance/sss-contribution-table`)**
- Create an independent sub-menu under Maintenance for statutory tables.

| Pros | Cons |
|---|---|
| Decouples configuration from routine reporting. | Disconnects the table reference from the statutory report workflows where it is used. |

**Recommendation:** Option A. Keeps all SSS statutory administration centralized under Government Routines.

---

## 3. Database Schema

### 3.1 New Table: `sss_contribution_table`

Master table storing official SSS contribution brackets.

```sql
CREATE TABLE `sss_contribution_table` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `effective_year` SMALLINT UNSIGNED NOT NULL DEFAULT 2026,
  `effective_date` DATE NOT NULL,
  `salary_min` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `salary_max` DECIMAL(12,2) NULL DEFAULT NULL, -- NULL indicates highest bracket ("and above")
  `msc` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `ee_regular` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `er_regular` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `ec_share` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `wisp_ee` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `wisp_er` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total_ee` DECIMAL(12,2) NOT NULL DEFAULT 0.00, -- (ee_regular + wisp_ee)
  `total_er` DECIMAL(12,2) NOT NULL DEFAULT 0.00, -- (er_regular + wisp_er + ec_share)
  `total_contribution` DECIMAL(12,2) NOT NULL DEFAULT 0.00, -- (total_ee + total_er)
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_by` VARCHAR(150) NULL DEFAULT NULL,
  `updated_by` VARCHAR(150) NULL DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_sss_effective_active` (`effective_year`, `is_active`),
  INDEX `idx_sss_salary_range` (`salary_min`, `salary_max`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 3.2 Alter Table: `payroll_run_detail` Extension

Adds immutable snapshot columns to preserve processed contributions.

```sql
ALTER TABLE `payroll_run_detail`
  ADD COLUMN `sss_contributable_salary` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `gross_pay`,
  ADD COLUMN `sss_msc` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `sss_contributable_salary`,
  ADD COLUMN `sss_ee` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `sss_msc`,
  ADD COLUMN `sss_er` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `sss_ee`,
  ADD COLUMN `sss_ec` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `sss_er`,
  ADD COLUMN `sss_wisp_ee` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `sss_ec`,
  ADD COLUMN `sss_wisp_er` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `sss_wisp_ee`,
  ADD COLUMN `sss_total` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `sss_wisp_er`;
```

---

## 4. Backend Architecture

Following the mandatory Thin-Controller + Query/Handler/Action pattern (`app/Domain/` is retired):

### 4.1 Domain Classes

1. **Model:** `app/Models/SssContributionTable.php`
   - Maps table `sss_contribution_table`.
   - Fillable: `effective_year`, `effective_date`, `salary_min`, `salary_max`, `msc`, `ee_regular`, `er_regular`, `ec_share`, `wisp_ee`, `wisp_er`, `total_ee`, `total_er`, `total_contribution`, `is_active`, `created_by`, `updated_by`.
   - Helper Scope: `scopeForSalary($query, $salary, $year)` to locate matching bracket.

2. **Queries:**
   - `app/Queries/SSS/GetSssContributionTableQuery.php`: Returns paginated or full bracket listing filtered by `effective_year` and `search`.
   - `app/Queries/SSS/GetSssGovernmentReportQuery.php`: Reads processed `payroll_run_detail` records consolidated by payroll period/month for R-5, R-3, and WISP reporting.

3. **Handlers / Actions:**
   - `app/Actions/SSS/LookupSssContributionAction.php`: Receives gross contributable salary and year; executes range lookup and returns MSC, EE, ER, EC, WISP, and Total.
   - `app/Handlers/SSS/SaveSssBracketHandler.php`: Handles create/update of bracket records with automated calculation of totals (`total_ee`, `total_er`, `total_contribution`).
   - `app/Handlers/SSS/DeleteSssBracketHandler.php`: Handles removal of individual brackets.
   - `app/Handlers/SSS/ImportSssTableHandler.php`: Bulk inserts official SSS schedule from CSV/Excel.

4. **Controller:** `app/Http/Controllers/Payroll/SssContributionController.php`
   - Thin controller returning raw `response()->json([...])` (no API Resources).

### 4.2 API Routes (`routes/api/payroll.php`)

```php
Route::prefix('payroll/sss-contribution-table')->group(function () {
    Route::get('/', [SssContributionController::class, 'index']);
    Route::post('/', [SssContributionController::class, 'store']);
    Route::put('/{id}', [SssContributionController::class, 'update']);
    Route::delete('/{id}', [SssContributionController::class, 'destroy']);
    Route::post('/lookup', [SssContributionController::class, 'lookup']);
    Route::post('/import', [SssContributionController::class, 'import']);
});

Route::prefix('payroll/government-routines/sss')->group(function () {
    Route::get('/summary', [SssContributionController::class, 'getRoutineSummary']);
    Route::get('/export-r3', [SssContributionController::class, 'exportR3Report']);
    Route::get('/export-r5', [SssContributionController::class, 'exportR5Report']);
});
```

---

## 5. Frontend Architecture

### 5.1 Location & Components Layout
Frontend structure lives inside the Payroll module under `resources/views/web/src/module/payroll/government_routines/`:

```
resources/views/web/src/module/payroll/government_routines/pages/sss/
├── SSS.vue (Main Page with Tabs: Reports & Consolidation | Contribution Table Reference)
├── components/
│   ├── SssTableTab.vue (Bracket Schedule Data Table)
│   ├── SssBracketFormModal.vue (Add/Edit Bracket Modal)
│   ├── SssImportModal.vue (Excel/CSV Bulk Schedule Import Modal)
│   ├── SssReportTab.vue (R-5 / R-3 Monthly Consolidation Roster)
│   └── SssBreakdownModal.vue (Employee Monthly Contribution Inspection)
├── composables/
│   ├── useSssContributionTable.ts (Table state, pagination, CRUD actions)
│   └── useSssGovernmentRoutine.ts (Consolidated payroll SSS report state)
└── types/
    └── types.sss_contribution.ts (TypeScript interfaces)
```

### 5.2 UI Design & Aesthetics

- **Header Banner:** Standard `HeaderBanner` with `portal="payroll"`, `iconClass="mdi-shield-account-outline"`, title **"SSS Compliance & Contribution Portal"**, cyan/teal brand gradient.
- **Tabs Navigation:** 
  - **Tab 1:** "Monthly Statutory Reports & Remittance" (Consolidated R-5 / R-3 / WISP reports from processed payrolls).
  - **Tab 2:** "Official SSS Contribution Table" (Bracket lookup schedule & maintenance).
- **Stat Cards:** 
  - Active Effective Schedule (e.g. "RA 11199 (Year 2026)")
  - Minimum & Maximum MSC Bounds (e.g. "P4,000.00 — P30,000.00")
  - Regular SSS Rate (e.g. "14.0% (9.5% ER / 4.5% EE)")
  - Mandatory WISP Cap (e.g. "Above P20,000.00 MSC")
- **Filter Toolbar:** 
  - Search input (Search by salary, MSC, or bracket)
  - Effective Year `CSelect` dropdown (`2026`, `2025`, `2024`)
  - Status `CSelect` filter (`Active`, `Inactive`)
  - Buttons: "Import CSV/Excel", "Add Bracket", "Export Schedule"
- **Data Table:**
  - Styled with alternating dark/light rows, monospace numeric values (`font-mono`), color-coded share badges (EE Cyan, ER Teal, EC Emerald, WISP Purple).

---

## 6. Business Rules & Edge Cases

### 6.1 HRMS Domain Rules ([payroll.md](../../../rules/conditional/payroll.md))

1. **Table Lookup Matching Algorithm:**
   - Given gross contributable salary $S$:
     $$\text{Find bracket } B \text{ where } B.\text{salary\_min} \le S \le B.\text{salary\_max} \quad (\text{or } B.\text{salary\_max IS NULL for top bracket})$$
   - If salary is below minimum bracket threshold ($S < B_{\min}.\text{salary\_min}$), default to the lowest MSC bracket ($B_{\min}$).
   - If salary exceeds top bracket threshold, cap at maximum MSC bracket ($B_{\max}$).

2. **WISP Split Rule (RA 11199):**
   - For MSC $\le 20,000.00$: WISP shares are $0.00$. All contributions fall under Regular SSS + EC.
   - For MSC $> 20,000.00$: The portion of MSC exceeding $20,000.00$ goes to Mandatory WISP Provident Fund split between EE (4.5%) and ER (9.5%).

3. **Payroll Snapshot Invariance:**
   - Processing payroll writes `sss_msc`, `sss_ee`, `sss_er`, `sss_ec`, `sss_wisp_ee`, `sss_wisp_er`, `sss_total` directly into `payroll_run_detail`.
   - Government Routine SSS reports query `payroll_run_detail` directly. Subsequent edits or updates to `sss_contribution_table` WILL NOT change previously closed/processed payroll reports.

### 6.2 Edge Cases Handling Matrix

| Edge Case | Handling Strategy |
|---|---|
| **Zero / Negative Contributable Salary** | Fallback to 0.00 contributions if employee has 0 gross earnings; do not assign minimum MSC unless required by employer policy. |
| **Overlapping Salary Brackets in Table** | Server-side validation in `SaveSssBracketHandler` checks `(salary_min <= new_max AND salary_max >= new_min)` to reject overlapping ranges. |
| **Missing Active Table for Payroll Year** | Fallback to latest active schedule year (e.g. 2026 falls back to 2025 table if 2026 table is not yet seeded) with a warning log. |
| **Mid-Month Salary Adjustments / Multiple Runs** | SSS monthly ceiling is enforced by consolidating prior runs in the same month so an employee never exceeds maximum monthly MSC cap. |
| **Special Employment Types (Kasambahay / OFWs)** | Support dedicated bracket flag or schedule type filter if statutory rates differ. |

---

## 7. Build Order

1. **Database Migration:**
   - Create migration `2026_07_29_000001_create_sss_contribution_table.php`.
   - Create alter migration `2026_07_29_000002_add_sss_columns_to_payroll_run_detail_table.php`.
2. **Backend Seeders & Models:**
   - Create `app/Models/SssContributionTable.php`.
   - Create `database/seeders/Payroll/SssContributionTableSeeder.php` with official 2025/2026 SSS RA 11199 schedule records.
3. **Backend Queries, Actions & Handlers:**
   - Create `LookupSssContributionAction.php`, `GetSssContributionTableQuery.php`, `SaveSssBracketHandler.php`, `DeleteSssBracketHandler.php`.
4. **Backend Controller & Routes:**
   - Create `app/Http/Controllers/Payroll/SssContributionController.php`.
   - Register endpoints in `routes/api/payroll.php`.
5. **Frontend Gate 1 (Static Design & Mock Data):**
   - Create `types.sss_contribution.ts` and composables.
   - Build `SssTableTab.vue`, `SssBracketFormModal.vue`, and update `SSS.vue` with tab switcher and hard-coded sample data.
6. **Frontend Gate 2 (Live API Wiring):**
   - Connect composable to live API endpoints (`/api/payroll/sss-contribution-table`).
7. **Verification & Testing:**
   - Run PHP syntax checks, test range lookup math, verify `payroll_run_detail` snapshot persistence, and check SSS R-3 report output.

---

## 8. Out of Scope (Future Specs)

- **PhilHealth & Pag-IBIG Master Tables:** PhilHealth tier matrix and Pag-IBIG HDMF ceiling adjustments will be specified in separate dedicated spec files (`philhealth_contribution_table.md`, `pagibig_contribution_table.md`).
- **Direct SSS Portal API Webhook Sync:** Automated direct EDI upload to SSS Portal via web API (manual CSV/Text file download remains the standard).
