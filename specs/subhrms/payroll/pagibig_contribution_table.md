# Spec — Pag-IBIG Contribution Table & Statutory Routine Integration

> **Kind:** Greenfield (New master reference parameter table & integration into Payroll Processing & Government Routines Pag-IBIG).  
> **Portal:** **Payroll** (`/api/payroll/...` routes, `government_routines` frontend module under `payroll`).  
> **Route:** `/payroll/pag-ibig/table` (`payroll_government_routines_pagibig_table`).  
> **Conventions:** [project-profile.md](../../rules/project-profile.md), [hrms-rules.md](../../rules/hrms-rules.md).  
> **System Awareness:** Models created (`PagibigContributionTable`); Tables created (`pagibig_contribution_table`), extended (`payroll_run_detail`); Routes created (`/payroll/pagibig-contribution-table`); New migration: yes.

---

## 1. Purpose

The **Pag-IBIG Contribution Table** is a master reference maintained by the system that stores official Home Development Mutual Fund (HDMF / Pag-IBIG Fund) contribution parameters, including monthly compensation brackets, employee contribution rates (%), employer contribution rates (%), maximum monthly compensation caps, and effective dates prescribed by Pag-IBIG circulars (e.g. HDMF Circular No. 460). It serves as the single source of truth for computing monthly Pag-IBIG contributions during payroll processing.

During payroll processing, the system determines the employee's monthly compensation and evaluates it against the configured Pag-IBIG contribution rules. Based on the applicable bracket rates and maximum compensation limits, the system computes the Employee Share (EE) and Employer Share (ER).

These computed statutory amounts are **persisted into the processed payroll transaction (`payroll_run_detail`)**. This guarantees **historical invariance**: processed payroll records remain permanently anchored to the statutory contribution parameters of that specific period, even if Pag-IBIG updates its contribution rules or salary caps in future fiscal years. The **Government Routine – Pag-IBIG module** reads these stored contribution values to generate monthly contribution reports (MCRF roster) and remittance files without recomputing contributions.

---

## 2. Design Decisions (Pros & Cons)

### Decision 1: Table Structure (Step-Bracket Rule Schedule vs Single Bounded Record)

**Option A — Tiered Bracket Rule Schedule Table (`monthly_compensation_from`, `monthly_compensation_to`, `ee_rate`, `er_rate`, `max_monthly_compensation`) (Recommended)**
- Maintain a structured table `pagibig_contribution_table` with compensation ranges (e.g. ₱0.00 to ₱1,500.00 @ EE 1%/ER 2%, and ₱1,500.01 to ∞ @ EE 2%/ER 2% capped at ₱10,000 monthly compensation).

| Pros | Cons |
|---|---|
| Fully models official HDMF Circular No. 460 regulations and tiered statutory rules (1% EE for ≤ ₱1,500 vs 2% EE for > ₱1,500). | Requires evaluating salary against compensation range brackets during payroll processing. |
| Easily supports future government updates to bracket thresholds or rate adjustments. | Slightly more initial seed rows than a single flat configuration record. |
| Enables dynamic calculation across any salary tier without hardcoded PHP rates. | |

**Option B — Flat Single-Record Parameter Configuration**
- Maintain a single record with fixed min/max caps and standard 2% rate assumption.

| Pros | Cons |
|---|---|
| Simple single-row schema. | Cannot handle lower-income bracket rules (1% EE rate for compensation ≤ ₱1,500) prescribed by HDMF law. |
| | Code changes required if Pag-IBIG introduces new income brackets. |

**Recommendation:** Option A. Tiered bracket rule scheduling conforms to official HDMF Circular No. 460 laws and ensures future-proof compliance.

---

### Decision 2: Handling Voluntary Employee Overrides / Additional Pag-IBIG Savings

**Option A — Capped Mandatory ER Matching with Additive Voluntary EE Top-up (Recommended)**
- Compute mandatory EE and ER shares based on the Pag-IBIG contribution table capped at the statutory ceiling (e.g. ₱200 EE / ₱200 ER for ₱10,000 cap under HDMF Circular 460). Allow employees with voluntary top-ups (e.g. `ibig_amount` from employee profile) to deduct additional voluntary EE contributions without forcing an employer ER match above the statutory limit.

| Pros | Cons |
|---|---|
| Complies strictly with HDMF regulations: employers are only mandated to match up to statutory max cap (₱200/mo). | Requires payroll engine to distinguish mandatory EE vs voluntary EE top-up. |
| Prevents unauthorized excess employer contribution liabilities while allowing employee voluntary savings. | |

**Option B — Dynamic 1:1 Employer Matching for All EE Contributions**
- Match employer contribution ER 1:1 for whatever amount the employee contributes, even if > ₱200.

| Pros | Cons |
|---|---|
| Trivial calculation logic (`ER = EE`). | Violates HDMF statutory rules and creates unexpected cost overruns for employers. |

**Recommendation:** Option A. Employer share must strictly cap at statutory limit while respecting employee voluntary top-up deductions.

---

### Decision 3: Historical Contribution Storage Location (Extend `payroll_run_detail` vs Standalone Pag-IBIG Table)

**Option A — Extend `payroll_run_detail` with Snapshot Columns (Recommended)**
- Add `pagibig_contributable_salary`, `pagibig_salary_basis`, `pagibig_ee_rate`, `pagibig_er_rate`, `pagibig_ee`, `pagibig_er`, and `pagibig_total` directly to `payroll_run_detail`.

| Pros | Cons |
|---|---|
| Single-query retrieval for payslips, payroll summary, MCRF remittance files, and Pag-IBIG monthly contribution reports. | Adds 7 columns to `payroll_run_detail`. |
| Aligns perfectly with existing `payroll_run_detail` architecture used for SSS and PhilHealth. | |
| Guarantees atomic transaction writes during payroll processing. | |

**Option B — Create a Standalone `payroll_pagibig_contributions` Detail Table**
- Store Pag-IBIG calculation breakdowns in a separate child table linked to `idpayrollrundetail`.

| Pros | Cons |
|---|---|
| Keeps `payroll_run_detail` schema compact. | Requires 1-to-1 table JOINs for every payroll register and report query. |
| | Risk of orphaned records during payroll re-runs or deletes. |

**Recommendation:** Option A. Extending `payroll_run_detail` maintains architectural consistency with SSS and PhilHealth, ensuring fast and historically invariant reporting.

---

### Decision 4: UI Placement & Navigation

**Option A — Integrated Tab View inside `/payroll/pag-ibig/table` Page (Recommended)**
- Render the Pag-IBIG Contribution Table reference & management tools directly at `/payroll/pag-ibig/table` linked from the Pag-IBIG Compliance Portal hub inside Government Routines.

| Pros | Cons |
|---|---|
| Seamless user experience: fits directly into the existing `GovernmentRoutines.vue` navigation alongside SSS and PhilHealth. | Requires dedicated component layout under `government_routines/pages/pagibig/table`. |
| Centrally located alongside Employer Details and Monthly Remittance Rosters. | |

**Option B — Standalone System Settings modal**
- Disjointed modal outside of Government Routines.

| Pros | Cons |
|---|---|
| Isolated view. | Poor UX; breaks unified flow of government statutory parameters. |

**Recommendation:** Option A. Placing the table within the Government Routines Pag-IBIG section aligns with SSS and PhilHealth UI design.

---

## 3. Database

### A. New Table: `pagibig_contribution_table`

```sql
CREATE TABLE `pagibig_contribution_table` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `description` VARCHAR(255) NOT NULL COMMENT 'e.g. HDMF Circular 460 - Tier 1',
  `effective_year` INT NOT NULL DEFAULT 2026,
  `effective_date` DATE NOT NULL COMMENT 'Effective date of prescribed Pag-IBIG schedule',
  `monthly_compensation_from` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `monthly_compensation_to` DECIMAL(12,2) NULL DEFAULT NULL COMMENT 'NULL represents no upper bound (infinity)',
  `ee_rate` DECIMAL(5,4) NOT NULL DEFAULT 0.0200 COMMENT 'Employee contribution rate (e.g. 0.0100 for 1%, 0.0200 for 2%)',
  `er_rate` DECIMAL(5,4) NOT NULL DEFAULT 0.0200 COMMENT 'Employer contribution rate (e.g. 0.0200 for 2%)',
  `max_monthly_compensation` DECIMAL(12,2) NOT NULL DEFAULT 10000.00 COMMENT 'Cap on monthly compensation basis (₱10,000 under Circular 460)',
  `max_ee_contribution` DECIMAL(12,2) NOT NULL DEFAULT 200.00 COMMENT 'Maximum mandatory EE share cap',
  `max_er_contribution` DECIMAL(12,2) NOT NULL DEFAULT 200.00 COMMENT 'Maximum mandatory ER share cap',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `notes` TEXT NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `updated_by` BIGINT UNSIGNED NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_pagibig_effective` (`effective_year`, `is_active`),
  INDEX `idx_pagibig_comp_range` (`monthly_compensation_from`, `monthly_compensation_to`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### B. Default Seed Data (HDMF Circular No. 460 - Effective Feb 2024 / Present 2026)

| id | description | effective_year | effective_date | monthly_compensation_from | monthly_compensation_to | ee_rate | er_rate | max_monthly_compensation | max_ee_contribution | max_er_contribution | is_active |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | HDMF Below ₱1,500 Bracket | 2026 | 2024-02-01 | 0.00 | 1500.00 | 0.0100 (1.0%) | 0.0200 (2.0%) | 10000.00 | 200.00 | 200.00 | 1 |
| 2 | HDMF Standard Bracket | 2026 | 2024-02-01 | 1500.01 | NULL | 0.0200 (2.0%) | 0.0200 (2.0%) | 10000.00 | 200.00 | 200.00 | 1 |

---

### C. Alter Table: `payroll_run_detail`

Add Pag-IBIG snapshot breakdown columns to preserve historical contribution math:

```sql
ALTER TABLE `payroll_run_detail`
  ADD COLUMN `pagibig_contributable_salary` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `philhealth_total`,
  ADD COLUMN `pagibig_salary_basis` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `pagibig_contributable_salary`,
  ADD COLUMN `pagibig_ee_rate` DECIMAL(5,4) NOT NULL DEFAULT 0.0000 AFTER `pagibig_salary_basis`,
  ADD COLUMN `pagibig_er_rate` DECIMAL(5,4) NOT NULL DEFAULT 0.0000 AFTER `pagibig_ee_rate`,
  ADD COLUMN `pagibig_ee` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `pagibig_er_rate`,
  ADD COLUMN `pagibig_er` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `pagibig_ee`,
  ADD COLUMN `pagibig_total` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `pagibig_er`;
```

---

## 4. Backend

### A. Model: `app/Models/PagibigContributionTable.php`

```php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PagibigContributionTable extends Model
{
    use HasFactory;

    protected $table = 'pagibig_contribution_table';

    protected $fillable = [
        'description',
        'effective_year',
        'effective_date',
        'monthly_compensation_from',
        'monthly_compensation_to',
        'ee_rate',
        'er_rate',
        'max_monthly_compensation',
        'max_ee_contribution',
        'max_er_contribution',
        'is_active',
        'notes',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'effective_year' => 'integer',
        'effective_date' => 'date',
        'monthly_compensation_from' => 'decimal:2',
        'monthly_compensation_to' => 'decimal:2',
        'ee_rate' => 'decimal:4',
        'er_rate' => 'decimal:4',
        'max_monthly_compensation' => 'decimal:2',
        'max_ee_contribution' => 'decimal:2',
        'max_er_contribution' => 'decimal:2',
        'is_active' => 'boolean',
    ];

    /**
     * Scope query to find matching bracket for a given monthly compensation & effective year
     */
    public function scopeForCompensation($query, float $compensation, int $year = 2026)
    {
        return $query->where('effective_year', $year)
            ->where('is_active', true)
            ->where('monthly_compensation_from', '<=', $compensation)
            ->where(function ($q) use ($compensation) {
                $q->where('monthly_compensation_to', '>=', $compensation)
                  ->orWhereNull('monthly_compensation_to');
            });
    }
}
```

---

### B. Controller: `app/Http/Controllers/payroll/PagibigContributionController.php`

Follows thin-controller standards returning raw `response()->json(...)`:

```php
namespace App\Http\Controllers\payroll;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Queries\Payroll\GetPagibigContributionTableQuery;
use App\Handlers\Payroll\SavePagibigContributionRuleHandler;

class PagibigContributionController extends Controller
{
    public function index(Request $request, GetPagibigContributionTableQuery $query)
    {
        $year = (int) $request->query('year', date('Y'));
        $data = $query->execute($year);
        return response()->json([
            'status' => 'success',
            'data' => $data,
        ]);
    }

    public function lookup(Request $request, GetPagibigContributionTableQuery $query)
    {
        $salary = (float) $request->query('salary', 0);
        $year   = (int) $request->query('year', date('Y'));
        $result = $query->lookupForSalary($salary, $year);
        return response()->json([
            'status' => 'success',
            'data' => $result,
        ]);
    }

    public function store(Request $request, SavePagibigContributionRuleHandler $handler)
    {
        $validated = $request->validate([
            'description'               => 'required|string|max:255',
            'effective_year'            => 'required|integer|min:2000|max:2099',
            'effective_date'            => 'required|date',
            'monthly_compensation_from' => 'required|numeric|min:0',
            'monthly_compensation_to'   => 'nullable|numeric|gte:monthly_compensation_from',
            'ee_rate'                   => 'required|numeric|min:0|max:1',
            'er_rate'                   => 'required|numeric|min:0|max:1',
            'max_monthly_compensation'  => 'required|numeric|min:0',
            'max_ee_contribution'       => 'required|numeric|min:0',
            'max_er_contribution'       => 'required|numeric|min:0',
            'is_active'                 => 'boolean',
            'notes'                     => 'nullable|string',
        ]);

        $record = $handler->execute($validated);
        return response()->json([
            'status' => 'success',
            'message' => 'Pag-IBIG contribution parameter rule saved successfully.',
            'data' => $record,
        ], 201);
    }

    public function update(Request $request, int $id, SavePagibigContributionRuleHandler $handler)
    {
        $validated = $request->validate([
            'description'               => 'sometimes|required|string|max:255',
            'effective_year'            => 'sometimes|required|integer|min:2000|max:2099',
            'effective_date'            => 'sometimes|required|date',
            'monthly_compensation_from' => 'sometimes|required|numeric|min:0',
            'monthly_compensation_to'   => 'nullable|numeric',
            'ee_rate'                   => 'sometimes|required|numeric|min:0|max:1',
            'er_rate'                   => 'sometimes|required|numeric|min:0|max:1',
            'max_monthly_compensation'  => 'sometimes|required|numeric|min:0',
            'max_ee_contribution'       => 'sometimes|required|numeric|min:0',
            'max_er_contribution'       => 'sometimes|required|numeric|min:0',
            'is_active'                 => 'boolean',
            'notes'                     => 'nullable|string',
        ]);

        $record = $handler->execute($validated, $id);
        return response()->json([
            'status' => 'success',
            'message' => 'Pag-IBIG contribution parameter rule updated successfully.',
            'data' => $record,
        ]);
    }

    public function destroy(int $id)
    {
        $rule = \App\Models\PagibigContributionTable::findOrFail($id);
        $rule->delete();
        return response()->json([
            'status' => 'success',
            'message' => 'Pag-IBIG contribution rule deleted successfully.',
        ]);
    }
}
```

---

### C. Query & Handler Classes

1. **`App\Queries\Payroll\GetPagibigContributionTableQuery`**
   - Fetches active and historical Pag-IBIG contribution rule brackets for a target year.
   - Evaluates a target salary against the active bracket rules to return computed `ee_share`, `er_share`, `total`, and `salary_basis`.

2. **`App\Handlers\Payroll\SavePagibigContributionRuleHandler`**
   - Handles creation and update of contribution table records with audit logging (`created_by`, `updated_by`).

3. **Integration into `ProcessPayrollHandler.php`**
   - Evaluates employee monthly basic salary against `PagibigContributionTable::forCompensation(...)`.
   - Computes:
     $$\text{Salary Basis} = \min(\text{Monthly Compensation}, \text{Max Monthly Compensation Cap})$$
     $$\text{Mandatory EE} = \min(\text{Salary Basis} \times \text{EE Rate}, \text{Max EE Contribution})$$
     $$\text{Mandatory ER} = \min(\text{Salary Basis} \times \text{ER Rate}, \text{Max ER Contribution})$$
     $$\text{Total EE} = \text{Mandatory EE} + \text{Voluntary Top-up (if configured in employee profile)}$$
     $$\text{Total Pag-IBIG} = \text{Total EE} + \text{Mandatory ER}$$
   - Persists all values directly to `payroll_run_detail`.

---

### D. Route Registration (`routes/api/payroll.php`)

```php
// ─── Government Routines: Pag-IBIG Contribution Table ─────────────────────
Route::get('/pagibig-contribution-table/lookup', [PagibigContributionController::class, 'lookup']);
Route::apiResource('pagibig-contribution-table', PagibigContributionController::class);
```

---

## 5. Frontend

### A. Module Layout & TS Structure

Located under `resources/views/web/src/module/payroll/government_routines/`:

```
resources/views/web/src/module/payroll/government_routines/
├── index.ts
├── api/
│   ├── government_routines.api.ts
│   └── pagibig_contribution_table.api.ts
├── composables/
│   ├── useGovernmentRoutines.ts
│   └── usePagibigContributionTable.ts
├── pages/
│   ├── GovernmentRoutines.vue
│   └── pagibig/
│       └── PagibigContributionTablePage.vue
├── components/
│   ├── pagibig/
│   │   ├── PagibigTableSummaryCards.vue
│   │   ├── PagibigTableRulesGrid.vue
│   │   ├── PagibigRuleModal.vue
│   │   └── PagibigCalculatorWidget.vue
│   └── shared/
│       └── RoutineHeader.vue
├── route/
│   └── government_routines.route.ts
└── types/
    ├── types.government_routines.ts
    └── types.pagibig_contribution.ts
```

---

### B. TypeScript Interfaces (`types.pagibig_contribution.ts`)

```typescript
export interface PagibigContributionRule {
  id?: number;
  description: string;
  effective_year: number;
  effective_date: string;
  monthly_compensation_from: number;
  monthly_compensation_to: number | null;
  ee_rate: number; // e.g. 0.02
  er_rate: number; // e.g. 0.02
  max_monthly_compensation: number; // e.g. 10000
  max_ee_contribution: number; // e.g. 200
  max_er_contribution: number; // e.g. 200
  is_active: boolean;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PagibigLookupResult {
  salary: number;
  salary_basis: number;
  ee_rate: number;
  er_rate: number;
  mandatory_ee: number;
  mandatory_er: number;
  max_monthly_compensation: number;
  total_contribution: number;
  rule_applied: string;
}
```

---

### C. API Contract (`pagibig_contribution_table.api.ts`)

```typescript
import { http } from '@/core/services/http';
import type { PagibigContributionRule, PagibigLookupResult } from '../types/types.pagibig_contribution';

export const pagibigContributionTableApi = {
  getTable: async (year: number = 2026): Promise<PagibigContributionRule[]> => {
    const res = await http.get(`/api/payroll/pagibig-contribution-table?year=${year}`);
    return res.data.data;
  },

  lookupSalary: async (salary: number, year: number = 2026): Promise<PagibigLookupResult> => {
    const res = await http.get(`/api/payroll/pagibig-contribution-table/lookup?salary=${salary}&year=${year}`);
    return res.data.data;
  },

  saveRule: async (rule: Partial<PagibigContributionRule>): Promise<PagibigContributionRule> => {
    if (rule.id) {
      const res = await http.put(`/api/payroll/pagibig-contribution-table/${rule.id}`, rule);
      return res.data.data;
    }
    const res = await http.post('/api/payroll/pagibig-contribution-table', rule);
    return res.data.data;
  },

  deleteRule: async (id: number): Promise<void> => {
    await http.delete(`/api/payroll/pagibig-contribution-table/${id}`);
  },
};
```

---

### D. UI Component Layout & Aesthetics

Per [ui-design.md](../../rules/ui-design.md):
- **Summary Header Cards**: Display Active Schedule Year, Statutory Compensation Cap (₱10,000.00), Standard EE Cap (₱200.00), Standard ER Cap (₱200.00), and Effective Date.
- **Rules Table Grid**: Styled table with compensation brackets, EE %, ER %, Cap Limit, Status pill (`Active`/`Inactive`), and Action dropdown (Edit/Delete).
- **Interactive Calculator Widget**: Live input for monthly basic salary to simulate and verify EE and ER shares instantly against configured rules.
- **Rule Modal Form**: Clean modal for adding/editing compensation bracket parameters with auto-calculated preview of max shares.

---

## 6. Business Rules & Edge Cases

### A. HRMS Domain Rules

1. **HDMF Circular No. 460 Parameters**:
   - Monthly Compensation ≤ ₱1,500.00: Employee share is **1.0%**, Employer share is **2.0%**.
   - Monthly Compensation > ₱1,500.00: Employee share is **2.0%**, Employer share is **2.0%**.
   - Maximum Monthly Compensation Limit: **₱10,000.00** (yields mandatory max EE = ₱200.00, mandatory max ER = ₱200.00).
2. **Employer Matching Ceiling**: Employers are legally required to match EE contributions up to 2.0% of ₱10,000 (₱200.00 max). Voluntary employee top-ups above ₱200.00 do NOT require an employer match.
3. **Rounding Rules**: EE and ER amounts are rounded to 2 decimal places using standard round-half-up (`round(..., 2)`).
4. **Historical Invariance**: Processed payroll detail records store snapshot values (`pagibig_ee`, `pagibig_er`, `pagibig_salary_basis`) to ensure past payrolls remain immutable even if Pag-IBIG rules change later.
5. **Government Routine Reporting**: Pag-IBIG MCRF monthly contribution reports and remittance file generators extract stored values directly from `payroll_run_detail` without recomputing.

---

### B. Edge Cases & Handling

| Scenario / Edge Case | Expected System Behavior |
|---|---|
| Monthly compensation is below ₱1,500.00 (e.g. part-time ₱1,200.00) | System applies Tier 1 rate (EE 1% = ₱12.00, ER 2% = ₱24.00). |
| Monthly compensation exceeds ₱10,000.00 (e.g. ₱50,000.00 basic pay) | System caps compensation basis at ₱10,000.00 (EE 2% = ₱200.00, ER 2% = ₱200.00). |
| Employee configured with voluntary top-up (e.g. ₱500.00 total EE contribution) | Mandatory EE = ₱200.00, Voluntary EE = ₱300.00 -> Total EE = ₱500.00. Employer ER remains capped at ₱200.00. |
| Zero / Negative monthly compensation (unpaid leave full month) | Contribution is ₱0.00 EE and ₱0.00 ER. |
| Overlapping effective date ranges in table | Query scopes by `effective_year` and picks the latest active schedule ordered by `effective_date DESC`. |
| Re-running payroll for past closed period | Engine uses snapshot stored in past `payroll_run_detail`; does not override historical data unless explicitly unlocked and reprocessed. |

---

## 7. Build Order

1. **Database Migrations**
   - Create `2026_07_30_000004_create_pagibig_contribution_table.php`.
   - Create `2026_07_30_000005_add_pagibig_columns_to_payroll_run_detail_table.php`.
   - Seed default HDMF Circular 460 parameters into `pagibig_contribution_table`.
2. **Backend Models & Queries/Handlers**
   - Create `app/Models/PagibigContributionTable.php`.
   - Update `app/Models/PayrollRunDetail.php` fillables and casts.
   - Create `app/Queries/Payroll/GetPagibigContributionTableQuery.php`.
   - Create `app/Handlers/Payroll/SavePagibigContributionRuleHandler.php`.
   - Update `app/Handlers/Payroll/ProcessPayrollHandler.php` to integrate dynamic Pag-IBIG table math.
   - Create `app/Http/Controllers/payroll/PagibigContributionController.php`.
   - Register routes in `routes/api/payroll.php`.
3. **Frontend Gate 1 (Static Design-First)**
   - Create `types.pagibig_contribution.ts`.
   - Create `pagibig_contribution_table.api.ts` with hard-coded mockup data.
   - Create `usePagibigContributionTable.ts` composable.
   - Build UI components (`PagibigTableSummaryCards.vue`, `PagibigTableRulesGrid.vue`, `PagibigRuleModal.vue`, `PagibigCalculatorWidget.vue`).
   - Wire route into `GovernmentRoutines.vue` navigation.
4. **Frontend Gate 2 (Live API Wiring)**
   - Replace static mockup responses in `pagibig_contribution_table.api.ts` with live HTTP calls to `/api/payroll/pagibig-contribution-table`.
5. **Verification & Audit**
   - Verify calculation correctness via `PagibigCalculatorWidget.vue` and PHPUnit test cases for `ProcessPayrollHandler`.

---

## 8. Out of Scope (Future Specs)

- **Pag-IBIG MP2 (Modified Pag-IBIG II) Voluntary Savings Portal**: Separate tracking module for voluntary MP2 savings account numbers and payroll deductions.
- **Pag-IBIG Housing & Calamity Loan Amortization Schedule**: Covered under `loan_remittance.md` and `loans.md`.
- **Automatic HDMF Online API Direct Submission**: Direct REST integration with Pag-IBIG Virtual Portal (currently handled via generated MCRF CSV remittance files).
