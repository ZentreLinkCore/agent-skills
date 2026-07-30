# Spec — PhilHealth Contribution Table & Statutory Routine Integration

> **Kind:** Greenfield (New master reference parameter table & integration into Payroll Calculation & Government Routines PhilHealth).  
> **Portal:** **Payroll** (`/api/payroll/...` routes, `government_routines/pages/philhealth` frontend module).  
> **Route:** `/payroll/phil-health/table` (`payroll_government_routines_philhealth_table`).  
> **Conventions:** [project-profile.md](../../rules/project-profile.md), [hrms-rules.md](../../rules/hrms-rules.md).  
> **System Awareness:** Models created (`PhilhealthContributionTable`); Tables created (`philhealth_contribution_table`), extended (`payroll_run_detail`); Routes created (`/payroll/philhealth-contribution-table`); New migration: yes.

---

## 1. Purpose

The **PhilHealth Contribution Table** is a master reference maintained by the system that stores official Philippine Health Insurance Corporation (PhilHealth) contribution parameters under Republic Act No. 11223 (Universal Health Care Act), including the applicable contribution rate (%), monthly salary floor, monthly salary ceiling, employee/employer share ratios, and effective dates. It serves as the single source of truth for computing monthly PhilHealth contributions of employees during payroll processing.

During payroll processing, the system determines the employee's PhilHealth-contributable salary based on their monthly basic salary. The salary is evaluated against the configured salary floor and salary ceiling. If the salary falls below the minimum threshold, the salary floor is used as the basis. If it exceeds the maximum threshold, the salary ceiling is applied. The configured contribution rate is then applied to compute the total monthly contribution, which is split into the Employee Share (EE) and Employer Share (ER) based on the prescribed sharing arrangement.

These computed statutory amounts are **persisted into the processed payroll transaction (`payroll_run_detail`)**. This guarantees **historical invariance**: processed payroll records remain permanently anchored to the statutory contribution parameters of that specific period, even if official PhilHealth schedules are updated in future fiscal years. The **Government Routine – PhilHealth module** reads these stored contribution values to generate monthly contribution reports (RF-1 roster) and Electronic Remittance Management System (EPRiS) files without recomputing contributions.

---

## 2. Design Decisions (Pros & Cons)

### Decision 1: Parameter Master Table Structure (Configurable Parameter Record vs Multi-Bracket Matrix)

**Option A — Single Parameter Record Per Effective Schedule (Recommended)**
- Maintain an active `philhealth_contribution_table` record specifying `effective_date`, `salary_floor`, `salary_ceiling`, `contribution_rate` (%), `ee_share_ratio`, and `er_share_ratio`. Perform basis evaluation mathematically:
  $$\text{Salary Basis} = \max(\text{Salary Floor}, \min(\text{Salary Ceiling}, \text{Monthly Basic Salary}))$$

| Pros | Cons |
|---|---|
| Perfectly mirrors official PhilHealth Universal Health Care (RA 11223) law structure (5.0% rate with ₱10,000 floor and ₱100,000 ceiling). | Does not use bracketed rows (unlike SSS); requires dedicated parameter evaluation logic. |
| Extremely clean to maintain and update when PhilHealth issues new circulars or modifies rate caps. | |
| Enables dynamic calculation across any salary value without needing hundreds of pre-calculated bracket rows. | |

**Option B — Tiered Multi-Bracket Matrix Table (Mirroring SSS)**
- Create hundreds of static salary step rows (e.g. ₱10,000 to ₱10,499.99 = ₱525.00 contribution).

| Pros | Cons |
|---|---|
| Identical structure to `sss_contribution_table`. | PhilHealth statutory law does NOT use fixed step brackets; it uses a continuous percentage rate applied to actual salary within bounds. |
| | Unnecessary table bloating and complex multi-row seeding. |

**Recommendation:** Option A. PhilHealth calculation under RA 11223 is a bounded rate calculation, not a step-bracket schedule.

---

### Decision 2: EE/ER Share Ratio Storage & Computation Format

**Option A — Explicit Percentage Share Ratios (`ee_share_ratio` & `er_share_ratio`) in DB (Recommended)**
- Store `ee_share_ratio` (default `50.00` = 50%) and `er_share_ratio` (default `50.00` = 50%) as configurable decimal fields in `philhealth_contribution_table`.

| Pros | Cons |
|---|---|
| Fully configurable if statutory laws change the split ratio (e.g. 60/40 or 100% employer share for special employee classes). | Requires rounding check to ensure $\text{EE} + \text{ER} = \text{Total}$ (1 centavo rounding protection). |
| Zero hardcoded ratios in PHP source code. | |

**Option B — Hardcoded 50/50 Code Logic**
- Hardcode `/ 2` or `* 0.50` inside PHP handlers without storing share ratios in the database.

| Pros | Cons |
|---|---|
| Slightly simpler database schema (2 fewer columns). | Violates business rules requirement for a fully configurable master table. |
| | Code modification required if government changes sharing rules. |

**Recommendation:** Option A. Storing explicit ratios ensures future compliance flexibility without codebase changes.

---

### Decision 3: Historical Contribution Storage Location (Extend `payroll_run_detail` vs Standalone PhilHealth Table)

**Option A — Extend `payroll_run_detail` with Snapshot Columns (Recommended)**
- Add `philhealth_contributable_salary`, `philhealth_salary_basis`, `philhealth_rate`, `philhealth_ee`, `philhealth_er`, and `philhealth_total` directly to `payroll_run_detail`.

| Pros | Cons |
|---|---|
| Single-query retrieval for payslips, payroll registers, YTD summaries, and PhilHealth RF-1 / EPRiS reports. | Adds 6 columns to `payroll_run_detail`. |
| Aligns with existing `payroll_run_detail` architecture used for SSS and Pag-IBIG. | |
| Guarantees atomic transaction writes during payroll processing. | |

**Option B — Create a Standalone `payroll_philhealth_contributions` Detail Table**
- Store PhilHealth calculation breakdowns in a separate child table linked to `idpayrollrundetail`.

| Pros | Cons |
|---|---|
| Keeps `payroll_run_detail` schema compact. | Requires 1-to-1 table JOINs for every payroll register and report query. |
| | Risk of orphaned records during payroll re-runs or deletes. |

**Recommendation:** Option A. Extending `payroll_run_detail` keeps queries fast, atomic, and historically invariant.

---

### Decision 4: UI Placement & Navigation

**Option A — Integrated Tab View inside `/payroll/phil-health/table` Page (Recommended)**
- Render the PhilHealth Contribution Table reference & management tools directly at `/payroll/phil-health/table` linked from the PhilHealth Compliance Portal hub.

| Pros | Cons |
|---|---|
| Seamless user experience: fits directly into the existing `PhilHealth.vue` portal navigation. | Requires dedicated component layout inside `government_routines/pages/philhealth/table`. |
| Centrally located alongside Employer Details and Monthly Remittance Rosters. | |

**Option B — Standalone System Settings Page under Admin**
- Place statutory rate configuration in a generic Admin settings sub-menu.

| Pros | Cons |
|---|---|
| Decouples configuration from routine reporting. | Disconnects parameter maintenance from the payroll officers who administer statutory compliance. |

**Recommendation:** Option A. Keeps all PhilHealth statutory administration centralized under Government Routines.

---

## 3. Database Schema

### 3.1 New Table: `philhealth_contribution_table`

Master reference table storing official PhilHealth contribution parameters.

```sql
CREATE TABLE `philhealth_contribution_table` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `description` VARCHAR(255) NOT NULL DEFAULT 'PhilHealth Contribution Schedule (RA 11223 UHC)',
  `effective_year` SMALLINT UNSIGNED NOT NULL DEFAULT 2026,
  `effective_date` DATE NOT NULL,
  `salary_floor` DECIMAL(12,2) NOT NULL DEFAULT 10000.00,
  `salary_ceiling` DECIMAL(12,2) NOT NULL DEFAULT 100000.00,
  `contribution_rate` DECIMAL(5,2) NOT NULL DEFAULT 5.00, -- Contribution Rate in Percentage (e.g. 5.00%)
  `ee_share_ratio` DECIMAL(5,2) NOT NULL DEFAULT 50.00,  -- Employee Share Percentage (e.g. 50.00%)
  `er_share_ratio` DECIMAL(5,2) NOT NULL DEFAULT 50.00,  -- Employer Share Percentage (e.g. 50.00%)
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `notes` TEXT NULL DEFAULT NULL,
  `created_by` VARCHAR(150) NULL DEFAULT NULL,
  `updated_by` VARCHAR(150) NULL DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_phic_effective_active` (`effective_year`, `is_active`),
  INDEX `idx_phic_effective_date` (`effective_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 3.2 Default Seeder Data

```sql
INSERT INTO `philhealth_contribution_table` 
  (`description`, `effective_year`, `effective_date`, `salary_floor`, `salary_ceiling`, `contribution_rate`, `ee_share_ratio`, `er_share_ratio`, `is_active`, `created_by`)
VALUES 
  ('PhilHealth Universal Health Care (RA 11223) - 2026 Schedule', 2026, '2026-01-01', 10000.00, 100000.00, 5.00, 50.00, 50.00, 1, 'System Seeder'),
  ('PhilHealth Universal Health Care (RA 11223) - 2025 Schedule', 2025, '2025-01-01', 10000.00, 100000.00, 5.00, 50.00, 50.00, 0, 'System Seeder');
```

### 3.3 Alter Table: `payroll_run_detail` Extension

Adds immutable snapshot columns to preserve processed PhilHealth contributions per payroll transaction.

```sql
ALTER TABLE `payroll_run_detail`
  ADD COLUMN `philhealth_contributable_salary` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `sss_total`,
  ADD COLUMN `philhealth_salary_basis` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `philhealth_contributable_salary`,
  ADD COLUMN `philhealth_rate` DECIMAL(5,2) NOT NULL DEFAULT 0.00 AFTER `philhealth_salary_basis`,
  ADD COLUMN `philhealth_ee` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `philhealth_rate`,
  ADD COLUMN `philhealth_er` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `philhealth_ee`,
  ADD COLUMN `philhealth_total` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `philhealth_er`;
```

---

## 4. Backend Architecture

Following the mandatory Thin-Controller + Query/Handler/Action pattern (`app/Domain/` is retired):

### 4.1 Domain Classes

1. **Model:** `app/Models/PhilhealthContributionTable.php`
   - Maps table `philhealth_contribution_table`.
   - Fillable: `description`, `effective_year`, `effective_date`, `salary_floor`, `salary_ceiling`, `contribution_rate`, `ee_share_ratio`, `er_share_ratio`, `is_active`, `notes`, `created_by`, `updated_by`.
   - Casts: `salary_floor` => `decimal:2`, `salary_ceiling` => `decimal:2`, `contribution_rate` => `decimal:2`, `ee_share_ratio` => `decimal:2`, `er_share_ratio` => `decimal:2`, `is_active` => `boolean`, `effective_date` => `date`.
   - Helper Scope: `scopeActiveForDate($query, $date)` to fetch the active parameter row for a given payroll period date.

2. **Queries:**
   - `app/Queries/Philhealth/GetPhilhealthContributionTableQuery.php`: Returns listing of PhilHealth parameter records filtered by `effective_year`, `is_active`, and `search`.
   - `app/Queries/Philhealth/GetPhilhealthGovernmentReportQuery.php`: Reads processed `payroll_run_detail` records consolidated by payroll period/month for RF-1 roster and EPRiS reporting.

3. **Actions:**
   - `app/Actions/Philhealth/ComputePhilhealthContributionAction.php`: 
     - Receives `monthly_basic_salary` and `effective_date` (or `year`).
     - Retrieves the applicable `PhilhealthContributionTable` record.
     - Evaluates Basis: $\text{Basis} = \max(\text{Floor}, \min(\text{Ceiling}, \text{Salary}))$.
     - Computes Total: $\text{Total} = \text{Basis} \times (\text{Rate} / 100)$.
     - Computes Shares: $\text{EE} = \text{round}(\text{Total} \times (\text{EE\_Ratio} / 100), 2)$, $\text{ER} = \text{Total} - \text{EE}$ (ensures exact centavo match).
     - Returns structured result array:
       ```php
       [
           'contributable_salary' => 45000.00,
           'salary_basis'        => 45000.00,
           'contribution_rate'   => 5.00,
           'total_contribution'  => 2250.00,
           'ee_share'            => 1125.00,
           'er_share'            => 1125.00,
           'effective_year'      => 2026,
       ]
       ```

4. **Handlers:**
   - `app/Handlers/Philhealth/SavePhilhealthScheduleHandler.php`: Handles create/update of PhilHealth parameter records inside `DB::transaction()`. Validates that ratio sums equal 100% and date ranges do not conflict.
   - `app/Handlers/Philhealth/DeletePhilhealthScheduleHandler.php`: Soft/hard handles deletion of inactive parameter records.

5. **Controller:** `app/Http/Controllers/Payroll/PhilhealthContributionController.php`
   - Thin controller returning raw `response()->json([...])` (no API Resources).
   - Methods: `index`, `store`, `show`, `update`, `destroy`, `lookup`.

### 4.2 API Routes (`routes/api/payroll.php`)

```php
// ─── Government Routines: PhilHealth Contribution Table ──────────────────
Route::prefix('philhealth-contribution-table')->group(function () {
    Route::get('/lookup', [PhilhealthContributionController::class, 'lookup']);
    Route::get('/', [PhilhealthContributionController::class, 'index']);
    Route::post('/', [PhilhealthContributionController::class, 'store']);
    Route::get('/{id}', [PhilhealthContributionController::class, 'show']);
    Route::put('/{id}', [PhilhealthContributionController::class, 'update']);
    Route::delete('/{id}', [PhilhealthContributionController::class, 'destroy']);
});
```

---

## 5. Frontend Architecture

### 5.1 Module Structure & Folder Layout

Lives inside the Payroll module under `resources/views/web/src/module/payroll/government_routines/pages/philhealth/table/`:

```
resources/views/web/src/module/payroll/government_routines/pages/philhealth/table/
├── index.ts                                    # Public barrel export
├── route/philhealth_table.routes.ts            # Route definitions
├── api/philhealth_table.api.ts                 # Service layer using @/app/axios/axiosInstance
├── composables/usePhilhealthContributionTable.ts # Reactive state & CRUD logic
├── pages/PhilHealthTablePage.vue               # Main page layout container
├── components/
│   ├── PhilhealthTableTab.vue                  # Main Parameter Schedule Data Table & Cards
│   ├── PhilhealthFormModal.vue                 # Add/Edit Parameter Schedule Modal
│   └── PhilhealthCalculatorModal.vue           # Interactive Salary Basis & Split Testing Tool
└── types/types.philhealth_contribution.ts      # TypeScript interfaces
```

### 5.2 UI Design & Aesthetics

- **Header Banner:** Integrated `HeaderBanner` with `portal="payroll"`, `iconClass="mdi-table-account"`, title **"PhilHealth Contribution Table"**, cyan/emerald gradient theme, and `RA 11223 UHC Compliant` badge.
- **Stat Cards:**
  - Active Rate (e.g. "5.00% Premium Rate")
  - Monthly Salary Floor (e.g. "₱10,000.00 Minimum Basis")
  - Monthly Salary Ceiling (e.g. "₱100,000.00 Maximum Basis")
  - Max Monthly Premium (e.g. "₱5,000.00 Total / ₱2,500.00 EE Share")
- **Toolbar:**
  - Search input (Search by description, year, or notes)
  - Effective Year `CSelect` filter (`All Years`, `2026`, `2025`)
  - Status `CSelect` filter (`All Status`, `Active`, `Inactive`)
  - Buttons: "Test Calculator", "Add Parameter Schedule"
- **Data Table:**
  - Modern styled table with alternating dark/light rows, monospace numeric columns (`font-mono`), active status badges (`StatusBadge`), and action buttons (Edit, Toggle Status, Delete).

---

## 6. Business Rules & Edge Cases

### 6.1 HRMS Domain Rules ([hrms-rules.md](../../rules/hrms-rules.md))

1. **Salary Basis Evaluation Algorithm:**
   - Given an employee's Monthly Basic Salary $S$:
     $$\text{If } S < \text{Salary Floor} \implies \text{Basis} = \text{Salary Floor}$$
     $$\text{If } S > \text{Salary Ceiling} \implies \text{Basis} = \text{Salary Ceiling}$$
     $$\text{If } \text{Salary Floor} \le S \le \text{Salary Ceiling} \implies \text{Basis} = S$$

2. **Contribution & Share Computation:**
   - Total Monthly Contribution:
     $$\text{Total} = \text{round}\left(\text{Basis} \times \frac{\text{Rate}}{100}, 2\right)$$
   - Employee Share (EE):
     $$\text{EE} = \text{round}\left(\text{Total} \times \frac{\text{EE\_Share\_Ratio}}{100}, 2\right)$$
   - Employer Share (ER):
     $$\text{ER} = \text{round}(\text{Total} - \text{EE}, 2)$$
   - *(Note: Subtracting EE from Total for ER guarantees that $\text{EE} + \text{ER}$ always equals exact Total without 1-centavo rounding discrepancies).*

3. **Semi-Monthly Cutoff Allocation:**
   - Standard monthly statutory contributions in Philippine HRMS are deducted on specified cutoffs (e.g. 2nd cutoff or split 50/50 across cutoffs based on Payroll Period settings).
   - The total monthly contribution evaluated against the table parameters serves as the monthly cap.

4. **Payroll Snapshot Invariance:**
   - Processing payroll writes `philhealth_contributable_salary`, `philhealth_salary_basis`, `philhealth_rate`, `philhealth_ee`, `philhealth_er`, `philhealth_total` into `payroll_run_detail`.
   - Government Routine reports read directly from `payroll_run_detail`. Editing `philhealth_contribution_table` WILL NOT alter closed historical payroll records.

### 6.2 Edge Cases Handling Matrix

| Edge Case | Handling Strategy |
|---|---|
| **Zero / Absent Earnings in Period** | If basic salary is ₱0.00 and employee had no worked days, system checks employer policy (omit contribution or apply floor minimum). Default: ₱0.00 contribution. |
| **Salary Exactly Equals Floor / Ceiling Boundary** | Boundary values use inclusive evaluation ($\le$ and $\ge$), returning exact floor or ceiling. |
| **Overlapping Active Schedules for Same Year** | When setting a new schedule to `is_active = 1`, `SavePhilhealthScheduleHandler` automatically deactivates prior schedules for that effective year inside a DB transaction. |
| **Missing Active Table for Target Year** | System falls back to the latest active schedule (e.g. 2026 uses 2025 active schedule if 2026 schedule is not created) and emits a system warning log. |
| **EE/ER Share Ratio Sum != 100%** | Validation in `SavePhilhealthScheduleHandler` rejects any submission where `ee_share_ratio + er_share_ratio != 100.00`. |

---

## 7. Build Order

1. **Database Migrations:**
   - Create `database/migrations/alters/2026_07_30_000002_create_philhealth_contribution_table.php`.
   - Create `database/migrations/alters/2026_07_30_000003_add_philhealth_columns_to_payroll_run_detail_table.php`.
2. **Backend Seeders & Model:**
   - Create `app/Models/PhilhealthContributionTable.php`.
   - Create `database/seeders/Payroll/PhilhealthContributionTableSeeder.php`.
3. **Backend Queries, Actions & Handlers:**
   - Create `app/Queries/Philhealth/GetPhilhealthContributionTableQuery.php`.
   - Create `app/Actions/Philhealth/ComputePhilhealthContributionAction.php`.
   - Create `app/Handlers/Philhealth/SavePhilhealthScheduleHandler.php` and `DeletePhilhealthScheduleHandler.php`.
4. **Backend Controller & Routes:**
   - Create `app/Http/Controllers/Payroll/PhilhealthContributionController.php`.
   - Register routes in `routes/api/payroll.php`.
5. **Frontend Gate 1 (Static Design & Mock Data):**
   - Scaffold module layout under `resources/views/web/src/module/payroll/government_routines/pages/philhealth/table/`.
   - Create `types.philhealth_contribution.ts`, `api/philhealth_table.api.ts`, `usePhilhealthContributionTable.ts`.
   - Build `PhilHealthTablePage.vue`, `PhilhealthTableTab.vue`, `PhilhealthFormModal.vue`, `PhilhealthCalculatorModal.vue` with static placeholder data.
6. **Frontend Gate 2 (Live API Wiring):**
   - Wire composable to live HTTP endpoints (`/api/payroll/philhealth-contribution-table`).
7. **Verification & Testing:**
   - Verify PHP syntax, test salary basis calculation math against PhilHealth UHC samples, confirm DB transaction persistence in `payroll_run_detail`, and test UI dark/light responsive layout.

---

## 8. Out of Scope (Future Specs)

- **Pag-IBIG HDMF Contribution Table Spec:** Pag-IBIG statutory ceiling and rate schedule maintenance (`pagibig_contribution_table.md`).
- **Direct EPRiS XML/API Integration:** Automated direct web service upload to PhilHealth portal (standard RF-1 roster and CSV export remains the current scope).
