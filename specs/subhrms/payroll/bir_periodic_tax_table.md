# Spec — BIR Periodic Tax Table

> **Kind:** Greenfield — Master withholding tax reference table & calculation engine for payroll processing.  
> **Portal:** **Payroll** (`/api/payroll/...` routes, `bir/periodic_tax_table` frontend module).  
> **Route:** `/payroll/government-routines/bir/periodic-tax-table` (`payroll_bir_periodic_tax_table`).  
> **Conventions:** [project-profile.md](../../rules/project-profile.md), [hrms-rules.md](../../rules/hrms-rules.md).  
> **System Awareness:** Models created (`BirPeriodicTaxTable`); Tables created (`bir_periodic_tax_table`); Routes created (`/api/payroll/bir-periodic-tax-table`, `/api/payroll/bir-periodic-tax-table/lookup`); New migration: `yes` (`2026_07_30_000005_create_bir_periodic_tax_table.php`).

---

## 1. Purpose

The **BIR Periodic Tax Table** is a master statutory reference maintained in the HRMS that stores the official Bureau of Internal Revenue (BIR) withholding tax schedules prescribed for each payroll frequency (Daily, Weekly, Bi-Weekly, Semi-Monthly, Monthly) under Republic Act No. 10963 (TRAIN Law) and BIR Revenue Regulations (RR No. 11-2018 / RR No. 2-2023).

It serves as the authoritative engine during regular payroll processing (`ProcessPayrollHandler`) to calculate an employee's income withholding tax deduction based on their net taxable compensation for the period.

### Workflow Integration

```text
    ┌─────────────────────────────────────────────────────────┐
    │                 Payroll Run Processing                  │
    └────────────────────────────┬────────────────────────────┘
                                 │
                                 ▼
    ┌─────────────────────────────────────────────────────────┐
    │  1. Compute Gross Taxable Income                        │
    │     (Basic + Overtime + Taxable Allowances/Incentives)   │
    └────────────────────────────┬────────────────────────────┘
                                 │
                                 ▼
    ┌─────────────────────────────────────────────────────────┐
    │  2. Deduct Non-Taxable Mandatory Contributions          │
    │     - SSS Employee Share                                │
    │     - PhilHealth Employee Share                         │
    │     - Pag-IBIG Employee Share                           │
    │     - Non-Taxable De Minimis / Exempt Allowances        │
    │  = Net Taxable Compensation                             │
    └────────────────────────────┬────────────────────────────┘
                                 │
                                 ▼
    ┌─────────────────────────────────────────────────────────┐
    │  3. Read BIR Periodic Tax Table                         │
    │     Filter by Payroll Frequency & Active Effective Date  │
    └────────────────────────────┬────────────────────────────┘
                                 │
                                 ▼
    ┌─────────────────────────────────────────────────────────┐
    │  4. Match Tax Bracket                                   │
    │     Taxable Compensation in [Comp From, Comp To]        │
    └────────────────────────────┬────────────────────────────┘
                                 │
                                 ▼
    ┌─────────────────────────────────────────────────────────┐
    │  5. Calculate Withholding Tax                           │
    │     Tax = Fixed Tax + % * (Taxable Comp - Excess Over)  │
    └────────────────────────────┬────────────────────────────┘
                                 │
                                 ▼
    ┌─────────────────────────────────────────────────────────┐
    │  6. Store Result in Payroll Detail Record               │
    │     payroll_run_detail.withholding_tax                  │
    └────────────────────────────┬────────────────────────────┘
                                 │
                                 ▼
    ┌─────────────────────────────────────────────────────────┐
    │  7. BIR Remittance Reports (1601-C, 2316, Alphalist)    │
    │     Reads stored withholding_tax without recomputing    │
    └─────────────────────────────────────────────────────────┘
```

---

## 2. Design Decisions (Pros & Cons)

### Decision 1: Table Schema Architecture for Multi-Frequency Schedules

**Option A — Single Unified `bir_periodic_tax_table` with `payroll_frequency` Column (Recommended)**
- Store all schedules (Daily, Weekly, Bi-Weekly, Semi-Monthly, Monthly) in a single database table indexed by `payroll_frequency`, `effective_date`, and bracket ranges.

| Pros | Cons |
|---|---|
| Single Model (`BirPeriodicTaxTable`) and unified CRUD API controller simplifies maintenance. | Requires proper composite indexing (`payroll_frequency`, `is_active`, `effective_date`) for fast queries. |
| Fits seamlessly into existing statutory table patterns (`sss_contribution_table`, `pagibig_contribution_table`). | |
| Enables dynamic filtering by frequency tab on the frontend UI using one composable. | |

**Option B — Separate Database Tables per Frequency (`bir_daily_tax`, `bir_monthly_tax`, etc.)**
- Create 5 distinct database tables for each payroll frequency.

| Pros | Cons |
|---|---|
| Smaller individual tables per frequency. | Severe schema duplication across 5 separate tables and migrations. |
| | Requires 5 separate models or complex dynamic model binding. |

**Recommendation:** Option A. A single table with a `payroll_frequency` discriminator provides a clean, DRY architecture.

---

### Decision 2: Tax Computation Excess Base Calculation

**Option A — Explicit `excess_over_amount` Column per Bracket (Recommended)**
- Maintain an explicit `excess_over_amount` column in the database bracket row (e.g. Bracket 2 Semi-Monthly: Comp From 10,417.00, Excess Over 10,417.00, Fixed Tax 0.00, Rate 15%).

| Pros | Cons |
|---|---|
| Matches official BIR RR No. 2-2023 published table layout exactly. | One additional column to store in the table. |
| Supports potential BIR policy changes where excess threshold differs from lower bracket bound. | |
| Transparent to HR admins reviewing tax bracket schedules in the UI grid. | |

**Option B — Implicit Excess Over Lower Bound (`taxable_compensation_from`)**
- Calculate excess dynamically as `taxable_compensation - taxable_compensation_from`.

| Pros | Cons |
|---|---|
| One less database column. | Inflexible if BIR changes tax rules where excess threshold is offset from bracket start. |

**Recommendation:** Option A. Storing explicit `excess_over_amount` ensures exact compliance with official BIR guidance.

---

### Decision 3: Pre-loaded Statutory Seed Data (TRAIN Law RR 2-2023)

**Option A — Pre-seed Official TRAIN Law 2023+ Schedules via Migration (Recommended)**
- Include seed arrays for Daily, Weekly, Bi-Weekly, Semi-Monthly, and Monthly frequencies in the migration file so the system is functional out of the box.

| Pros | Cons |
|---|---|
| Zero manual setup required by payroll admins after installation. | Migration file is slightly larger. |
| Guarantees accurate BIR tax rules for immediate payroll execution. | |

**Option B — Empty Table with Manual UI Entry**
- Require users to manually input every tax bracket for all 5 frequencies.

| Pros | Cons |
|---|---|
| Smaller migration file. | High risk of user input error causing illegal tax deductions on first payroll run. |

**Recommendation:** Option A. Pre-seeding standard TRAIN Law tax brackets guarantees accuracy and immediate usability.

---

### Decision 4: Interactive Tax Verification Calculator Sandbox

**Option A — Include Live Tax Calculator Modal in the UI (Recommended)**
- Provide a "Test Tax Calculation" drawer/modal on the frontend allowing HR admins to select a frequency, input a sample taxable income, and inspect step-by-step tax bracket matching and formulas in real-time.

| Pros | Cons |
|---|---|
| Builds high confidence for HR/Payroll officers validating withholding tax computations. | Requires building a lightweight calculator sub-component and API lookup endpoint. |
| Drastically reduces support tickets regarding tax deduction queries. | |

**Option B — Plain Grid Table without Test Sandbox**
- Display tax brackets only without interactive calculation preview.

| Pros | Cons |
|---|---|
| Slightly less frontend code. | Admin cannot easily verify how a specific salary amount calculates tax without running a test payroll. |

**Recommendation:** Option A. The interactive tax calculator enhances user experience and simplifies audit validation.

---

## 3. Database Schema

### 3.1 Table Definition: `bir_periodic_tax_table`

```php
Schema::create('bir_periodic_tax_table', function (Blueprint $table) {
    $table->id();
    $table->date('effective_date')->default('2023-01-01');
    $table->string('payroll_frequency', 20)->comment('DAILY, WEEKLY, BI_WEEKLY, SEMI_MONTHLY, MONTHLY');
    $table->decimal('taxable_compensation_from', 12, 2)->default(0.00);
    $table->decimal('taxable_compensation_to', 12, 2)->nullable()->comment('NULL indicates top open-ended bracket');
    $table->decimal('fixed_tax_amount', 12, 2)->default(0.00);
    $table->decimal('tax_rate_percent', 5, 2)->default(0.00)->comment('Percentage rate on excess, e.g. 15.00 for 15%');
    $table->decimal('excess_over_amount', 12, 2)->default(0.00);
    $table->boolean('is_active')->default(true);
    $table->timestamps();

    // Indexes for fast runtime lookup
    $table->index(['payroll_frequency', 'is_active', 'effective_date'], 'idx_bir_tax_lookup');
    $table->index(['taxable_compensation_from', 'taxable_compensation_to'], 'idx_bir_tax_bracket');
});
```

### 3.2 Standard TRAIN Law Tax Brackets (RR 2-2023 Reference Data)

#### 1. Semi-Monthly Payroll Frequency Schedule (`SEMI_MONTHLY`)

| Bracket | Taxable Comp From | Taxable Comp To | Fixed Tax Amount | Tax Rate (%) | Excess Over Amount |
|---|---|---|---|---|---|
| **1** | ₱0.00 | ₱10,417.00 | ₱0.00 | 0.00% | ₱0.00 |
| **2** | ₱10,417.01 | ₱16,667.00 | ₱0.00 | 15.00% | ₱10,417.00 |
| **3** | ₱16,667.01 | ₱33,333.00 | ₱937.50 | 20.00% | ₱16,667.00 |
| **4** | ₱33,333.01 | ₱83,333.00 | ₱4,270.70 | 25.00% | ₱33,333.00 |
| **5** | ₱83,333.01 | ₱333,333.00 | ₱16,770.70 | 30.00% | ₱83,333.00 |
| **6** | ₱333,333.01 | *And above (NULL)* | ₱91,770.70 | 35.00% | ₱333,333.00 |

#### 2. Monthly Payroll Frequency Schedule (`MONTHLY`)

| Bracket | Taxable Comp From | Taxable Comp To | Fixed Tax Amount | Tax Rate (%) | Excess Over Amount |
|---|---|---|---|---|---|
| **1** | ₱0.00 | ₱20,833.00 | ₱0.00 | 0.00% | ₱0.00 |
| **2** | ₱20,833.01 | ₱33,333.00 | ₱0.00 | 15.00% | ₱20,833.00 |
| **3** | ₱33,333.01 | ₱66,667.00 | ₱1,875.00 | 20.00% | ₱33,333.00 |
| **4** | ₱66,667.01 | ₱166,667.00 | ₱8,541.80 | 25.00% | ₱66,667.00 |
| **5** | ₱166,667.01 | ₱666,667.00 | ₱33,541.80 | 30.00% | ₱166,667.00 |
| **6** | ₱666,667.01 | *And above (NULL)* | ₱183,541.80 | 35.00% | ₱666,667.00 |

---

## 4. Backend Architecture

### 4.1 Eloquent Model: `App\Models\BirPeriodicTaxTable`

```php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BirPeriodicTaxTable extends Model
{
    protected $table = 'bir_periodic_tax_table';

    protected $fillable = [
        'effective_date',
        'payroll_frequency',
        'taxable_compensation_from',
        'taxable_compensation_to',
        'fixed_tax_amount',
        'tax_rate_percent',
        'excess_over_amount',
        'is_active',
    ];

    protected $casts = [
        'effective_date' => 'date',
        'taxable_compensation_from' => 'decimal:2',
        'taxable_compensation_to' => 'decimal:2',
        'fixed_tax_amount' => 'decimal:2',
        'tax_rate_percent' => 'decimal:2',
        'excess_over_amount' => 'decimal:2',
        'is_active' => 'boolean',
    ];
}
```

### 4.2 Query & Handler Classes

- **`App\Queries\Payroll\GetBirPeriodicTaxTableQuery`**:
  Fetches tax schedules filtered by `payroll_frequency` and `effective_date`.

- **`App\Handlers\Payroll\SaveBirPeriodicTaxBracketHandler`**:
  Handles creation and update of tax bracket rules with validation ensuring `taxable_compensation_from` <= `taxable_compensation_to`.

- **`App\Actions\Payroll\ComputeWithholdingTaxAction`**:
  Callable calculation service invoked by `ProcessPayrollHandler`:
  ```php
  public function execute(string $frequency, float $taxableCompensation, ?string $asOfDate = null): float
  {
      if ($taxableCompensation <= 0) {
          return 0.00;
      }

      $bracket = BirPeriodicTaxTable::query()
          ->where('payroll_frequency', strtoupper($frequency))
          ->where('is_active', true)
          ->where('effective_date', '<=', $asOfDate ?? now()->toDateString())
          ->where('taxable_compensation_from', '<=', $taxableCompensation)
          ->where(function ($query) use ($taxableCompensation) {
              $query->whereNull('taxable_compensation_to')
                    ->orWhere('taxable_compensation_to', '>=', $taxableCompensation);
          })
          ->orderBy('effective_date', 'desc')
          ->orderBy('taxable_compensation_from', 'desc')
          ->first();

      if (!$bracket) {
          return 0.00;
      }

      $excess = max(0, $taxableCompensation - (float) $bracket->excess_over_amount);
      $tax = (float) $bracket->fixed_tax_amount + ($excess * ((float) $bracket->tax_rate_percent / 100));

      return round($tax, 2);
  }
  ```

### 4.3 Controller & Route Registration

#### Controller: `App\Http\Controllers\Payroll\BirPeriodicTaxController`

- `index(Request $request)`: Returns paginated or grouped brackets for specified frequency.
- `store(Request $request)`: Creates a new bracket record.
- `update(Request $request, $id)`: Updates an existing bracket record.
- `destroy($id)`: Soft-deletes / removes a bracket record.
- `lookup(Request $request)`: Accepts `payroll_frequency` and `taxable_compensation` parameters, returning the matched bracket and calculated withholding tax.

#### Routes in `routes/api/payroll.php`:

```php
use App\Http\Controllers\Payroll\BirPeriodicTaxController;

Route::get('/bir-periodic-tax-table/lookup', [BirPeriodicTaxController::class, 'lookup']);
Route::apiResource('bir-periodic-tax-table', BirPeriodicTaxController::class);
```

---

## 5. Frontend Architecture

### 5.1 File Layout

```text
resources/views/web/src/module/payroll/government_routines/pages/bir/periodic_tax_table/
├── index.ts                                             # Public exports
├── route/bir_periodic_tax_table.routes.ts              # Route definition
├── types/bir_periodic_tax_table.types.ts                # TypeScript interfaces
├── api/bir_periodic_tax_table.api.ts                    # Hardcoded Gate 1 / Live Gate 2 API
├── composables/useBirPeriodicTaxTable.ts                # Reactive state & actions
├── pages/
│   └── PeriodicTaxTable.vue                             # Main view container
└── components/
    ├── PeriodicTaxHeader.vue                            # Header banner, status pill & metrics
    ├── PeriodicTaxFrequencyTabs.vue                     # Frequency tabs (Daily, Weekly, Semi-Monthly, Monthly)
    ├── PeriodicTaxGrid.vue                              # Bracket list table view
    ├── PeriodicTaxFormModal.vue                         # Add/Edit bracket modal
    └── PeriodicTaxCalculatorModal.vue                   # Interactive tax calculator sandbox
```

### 5.2 TypeScript Contracts (`bir_periodic_tax_table.types.ts`)

```typescript
export type PayrollFrequency = 'DAILY' | 'WEEKLY' | 'BI_WEEKLY' | 'SEMI_MONTHLY' | 'MONTHLY';

export interface BirPeriodicTaxBracket {
  id: number;
  effective_date: string;
  payroll_frequency: PayrollFrequency;
  taxable_compensation_from: number;
  taxable_compensation_to: number | null;
  fixed_tax_amount: number;
  tax_rate_percent: number;
  excess_over_amount: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface TaxLookupPayload {
  payroll_frequency: PayrollFrequency;
  taxable_compensation: number;
  effective_date?: string;
}

export interface TaxLookupResult {
  taxable_compensation: number;
  matched_bracket: BirPeriodicTaxBracket | null;
  excess_amount: number;
  percentage_tax: number;
  fixed_tax: number;
  total_withholding_tax: number;
}
```

### 5.3 User Interface Layout Sketch

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 🏛️ BIR Periodic Tax Table & Statutory Bracket Reference                                          │
│ Bureau of Internal Revenue (BIR) withholding tax rules under TRAIN Law RR 2-2023.                │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘

 [ 📅 Effective: Jan 1, 2023 ]   [ 🔄 Refresh ]   [ 🧮 Test Tax Calculator ]   [ ➕ Add Bracket ]

 ┌────────────────────────────────────────────────────────────────────────────────────────────────┐
 │ [ SEMI-MONTHLY (Active) ]  [ MONTHLY ]  [ BI-WEEKLY ]  [ WEEKLY ]  [ DAILY ]                   │
 └────────────────────────────────────────────────────────────────────────────────────────────────┘

 ┌──────┬──────────────────────┬──────────────────────┬─────────────┬───────────┬─────────────┬──────────┐
 │ Step │ Compensation From    │ Compensation To      │ Fixed Tax   │ Rate (%)  │ Excess Over │ Actions  │
 ├──────┼──────────────────────┼──────────────────────┼─────────────┼───────────┼─────────────┼──────────┤
 │  1   │ ₱0.00                │ ₱10,417.00           │ ₱0.00       │ 0.00%     │ ₱0.00       │ ✏️  🗑️   │
 │  2   │ ₱10,417.01           │ ₱16,667.00           │ ₱0.00       │ 15.00%    │ ₱10,417.00  │ ✏️  🗑️   │
 │  3   │ ₱16,667.01           │ ₱33,333.00           │ ₱937.50     │ 20.00%    │ ₱16,667.00  │ ✏️  🗑️   │
 │  4   │ ₱33,333.01           │ ₱83,333.00           │ ₱4,270.70   │ 25.00%    │ ₱33,333.00  │ ✏️  🗑️   │
 │  5   │ ₱83,333.01           │ ₱333,333.00          │ ₱16,770.70  │ 30.00%    │ ₱83,333.00  │ ✏️  🗑️   │
 │  6   │ ₱333,333.01          │ And above (MAX)      │ ₱91,770.70  │ 35.00%    │ ₱333,333.00 │ ✏️  🗑️   │
 └──────┴──────────────────────┴──────────────────────┴─────────────┴───────────┴─────────────┴──────────┘
```

---

## 6. Business Rules & Edge Cases

### 6.1 HRMS Domain Rules ([hrms-rules.md](../../rules/hrms-rules.md))

1. **Taxable Compensation Basis:**
   $$\text{Taxable Compensation} = \text{Gross Taxable Income} - (\text{SSS EE} + \text{PhilHealth EE} + \text{Pag-IBIG EE} + \text{Exempt Allowances})$$
   - Statutory contributions (SSS, PhilHealth, Pag-IBIG) are deducted *prior* to applying the BIR withholding tax bracket.
   - Non-taxable 13th month pay & bonuses up to the ₱90,000.00 statutory ceiling are excluded from taxable compensation.

2. **Immutable Historical Payroll Records:**
   - The computed withholding tax is stored directly in `payroll_run_detail.withholding_tax`.
   - Modifying or updating the BIR tax table never retroactively changes previously locked payroll runs.

3. **Effective Date Matching:**
   - The system retrieves the active tax table record with `effective_date` <= `payroll_period_end_date`.

### 6.2 Edge Cases Matrix

| Edge Case | Handling Strategy |
|---|---|
| **Zero or Negative Taxable Compensation** | `ComputeWithholdingTaxAction` immediately returns `0.00` withholding tax without error. |
| **Top-Tier Open-Ended Bracket (`taxable_compensation_to` is NULL)** | The SQL lookup condition checks `whereNull('taxable_compensation_to')` to properly capture salaries exceeding ₱333,333.00 (Semi-Monthly) or ₱666,667.00 (Monthly). |
| **Exact Boundary Match (e.g. Compensation = ₱10,417.00)** | Matches Bracket 1 (0% tax rate). Compensation of ₱10,417.01 matches Bracket 2. |
| **Missing Active Schedule for Frequency** | `ComputeWithholdingTaxAction` falls back to `0.00` and logs a warning in system audit logs. |
| **Multiple Effective-Dated Schedules** | The query orders by `effective_date DESC` and selects the newest schedule valid on or before the payroll period end date. |

---

## 7. Build Order

1. **Database Migration & Seeding:**
   - Create `database/migrations/alters/2026_07_30_000005_create_bir_periodic_tax_table.php` and pre-seed TRAIN Law RR 2-2023 schedules for all 5 frequencies.
2. **Backend Model & Business Logic:**
   - Create `App\Models\BirPeriodicTaxTable.php`.
   - Implement `App\Queries\Payroll\GetBirPeriodicTaxTableQuery`.
   - Implement `App\Handlers\Payroll\SaveBirPeriodicTaxBracketHandler`.
   - Implement `App\Actions\Payroll\ComputeWithholdingTaxAction`.
   - Create `App\Http\Controllers\Payroll\BirPeriodicTaxController.php` and register API routes in `routes/api/payroll.php`.
3. **Frontend Gate 1 (Static UI & Design Validation):**
   - Scaffold module layout under `resources/views/web/src/module/payroll/government_routines/pages/bir/periodic_tax_table/`.
   - Create `bir_periodic_tax_table.types.ts`, `bir_periodic_tax_table.api.ts` (with hardcoded sample schedules), and `useBirPeriodicTaxTable.ts`.
   - Build `PeriodicTaxTable.vue`, `PeriodicTaxHeader.vue`, `PeriodicTaxFrequencyTabs.vue`, `PeriodicTaxGrid.vue`, `PeriodicTaxFormModal.vue`, and `PeriodicTaxCalculatorModal.vue`.
4. **Frontend Gate 2 (Live API Integration):**
   - Swap hardcoded API calls in `bir_periodic_tax_table.api.ts` to live Axios requests hitting `/api/payroll/bir-periodic-tax-table`.
   - Connect live tax calculator modal to `/api/payroll/bir-periodic-tax-table/lookup`.
5. **Integration with Payroll Engine:**
   - Wire `ComputeWithholdingTaxAction` into `ProcessPayrollHandler.php` tax step.
6. **Verification & Audit:**
   - Validate UI responsiveness in light & dark themes, test bracket creation/editing, and test tax calculations across all frequencies against official BIR test cases.

---

## 8. Out of Scope

- **Annualized BIR Tax Reconciliations (BIR Form 1604-C / Form 2316 Year-End Adjustments):** Covered by `bir_form_2316.md` and `year_end.md`.
- **Fringe Benefit Tax (FBT) & Special Non-Resident Alien Tax Processing:** Handled under separate executive payroll modules.
