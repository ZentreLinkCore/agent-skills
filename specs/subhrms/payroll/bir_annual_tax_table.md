# Spec — BIR Annual Tax Table

> **Kind:** Greenfield — Master reference table & annual income tax calculation engine for year-end tax annualization and BIR 2316 / Alphalist compliance.  
> **Portal:** **Payroll** (`/api/payroll/...` routes, `bir/annual_tax_table` frontend module).  
> **Route:** `/payroll/government-routines/bir/annual-tax-table` (`payroll_bir_annual_tax_table`).  
> **Conventions:** [project-gate.md](../../../rules/core/project-gate.md), [payroll.md](../../../rules/conditional/payroll.md).  
> **System Awareness:** Models created (`BirAnnualTaxTable`); Tables created (`bir_annual_tax_table`); Routes created (`/api/payroll/bir-annual-tax-table`, `/api/payroll/bir-annual-tax-table/lookup`); New migration: `yes` (`2026_07_30_000006_create_bir_annual_tax_table.php`).

---

## 1. Purpose

The **BIR Annual Tax Table** is a master statutory reference maintained in the HRMS that stores the official annual income tax brackets and rates prescribed by the Bureau of Internal Revenue (BIR) under Republic Act No. 10963 (TRAIN Law / RR No. 2-2023).

It serves as the core calculation engine during **Year-End Payroll Processing** (`ProcessYearEndHandler`), **BIR Form 2316 Certificate Generation**, and **BIR Alphalist Filings (Schedules 1 & 2)** to compute an employee's total annual tax liability on their consolidated full-year taxable income.

### Year-End Tax Annualization Workflow

```text
    ┌─────────────────────────────────────────────────────────┐
    │           Year-End Tax Processing / Annualization       │
    └────────────────────────────┬────────────────────────────┘
                                 │
                                 ▼
    ┌─────────────────────────────────────────────────────────┐
    │  1. Consolidate Full-Year Gross Taxable Income           │
    │     (Basic + OT + Taxable Allowances + Taxable Bonus >90k)│
    └────────────────────────────┬────────────────────────────┘
                                 │
                                 ▼
    ┌─────────────────────────────────────────────────────────┐
    │  2. Deduct Total Annual Statutory EE Contributions       │
    │     - Total Annual SSS EE Share                         │
    │     - Total Annual PhilHealth EE Share                  │
    │     - Total Annual Pag-IBIG EE Share                    │
    │  = Total Annual Taxable Compensation                    │
    └────────────────────────────┬────────────────────────────┘
                                 │
                                 ▼
    ┌─────────────────────────────────────────────────────────┐
    │  3. Read BIR Annual Tax Table                           │
    │     Filter by Active Effective Date <= Tax Year           │
    └────────────────────────────┬────────────────────────────┘
                                 │
                                 ▼
    ┌─────────────────────────────────────────────────────────┐
    │  4. Match Annual Tax Bracket                            │
    │     Annual Taxable Compensation in [Income From, To]    │
    └────────────────────────────┬────────────────────────────┘
                                 │
                                 ▼
    ┌─────────────────────────────────────────────────────────┐
    │  5. Compute Annual Tax Due                              │
    │     Annual Tax = Fixed Tax + % * (Annual Comp - Excess) │
    └────────────────────────────┬────────────────────────────┘
                                 │
                                 ▼
    ┌─────────────────────────────────────────────────────────┐
    │  6. Reconcile Against Total YTD Tax Withheld            │
    │     Tax Adjustment = Annual Tax Due - Sum(WTAX Withheld)│
    │     - If Adjustment < 0  ==> TAX REFUND (Pay to EE)     │
    │     - If Adjustment > 0  ==> ADDITIONAL TAX (Deduct)    │
    └────────────────────────────┬────────────────────────────┘
                                 │
                                 ▼
    ┌─────────────────────────────────────────────────────────┐
    │  7. Generate Year-End Reports & Filings                 │
    │     - BIR Form 2316 (Certificate of Tax Withheld)       │
    │     - BIR Alphalist Schedule 1 & Schedule 2 Roster      │
    └─────────────────────────────────────────────────────────┘
```

---

## 2. Design Decisions (Pros & Cons)

### Decision 1: Table Storage Architecture (Dedicated Annual Table vs Derived from Periodic)

**Option A — Dedicated `bir_annual_tax_table` Database Table (Recommended)**
- Maintain an explicit database table storing official annual tax brackets, fixed taxes, and percentage rates for each effective date.

| Pros | Cons |
|---|---|
| Matches official BIR RR No. 2-2023 published annual table layout directly. | One additional table to maintain in database. |
| Allows precise management and audit of effective-dated annual tax rules. | |
| Enables quick lookups without runtime mathematical scaling. | |

**Option B — Dynamically Scale Periodic Monthly Tax Brackets (x12)**
- Calculate annual tax brackets at runtime by multiplying monthly table values by 12.

| Pros | Cons |
|---|---|
| Avoids a second table. | Floating point rounding issues can create 1-cent discrepancies against official BIR published annual tables. |
| | If BIR issues different annual tax thresholds than periodic, calculation breaks. |

**Recommendation:** Option A. Storing dedicated `bir_annual_tax_table` records guarantees 100% precision against official BIR published annual tax tables.

---

### Decision 2: Tax Reconciliation & Adjustment Engine Location

**Option A — Dedicated Action Service (`ComputeAnnualTaxAction`) (Recommended)**
- Encapsulate annual tax matching and adjustment logic (Refund vs. Collectible calculation) inside a standalone Action class.

| Pros | Cons |
|---|---|
| Reusable across `ProcessYearEndHandler`, `Bir2316ReportController`, `AlphalistReportController`, and `FinalPayHandler`. | Requires clean service action class design. |
| Single point of truth for annual tax calculations prevents discrepancies between year-end payroll and BIR reports. | |

**Option B — Inline Logic inside `ProcessYearEndHandler`**
- Write calculation directly inside the year-end processing handler.

| Pros | Cons |
|---|---|
| Fewer separate PHP files. | Duplicate tax computation logic required when rendering BIR Form 2316 certificates and Alphalist exports. |

**Recommendation:** Option A. Centralizing in `ComputeAnnualTaxAction` ensures complete consistency across payroll closing and BIR tax certificates.

---

### Decision 3: Pre-loaded Statutory Seed Data (TRAIN Law RR 2-2023)

**Option A — Pre-seed Official TRAIN Law 2023+ Annual Schedules via Migration (Recommended)**
- Include seed rows for annual tax brackets 1 through 6 in the database migration.

| Pros | Cons |
|---|---|
| System is immediately ready for year-end tax annualization and BIR 2316 generation. | Migration file includes seed array. |
| Eliminates manual configuration errors by payroll administrators. | |

**Option B — Empty Table with Manual Entry**
- Force users to manually enter annual tax brackets.

| Pros | Cons |
|---|---|
| Slightly smaller migration. | High risk of data entry error causing incorrect employee tax refunds or collectibles during year-end. |

**Recommendation:** Option A. Pre-seeding official BIR annual tax brackets ensures compliance and immediate usability.

---

### Decision 4: Interactive Tax Annualization Sandbox on UI

**Option A — Include Live Annual Tax Reconciliation Sandbox Modal (Recommended)**
- Provide a "Test Annual Tax Reconciliation" tool in the UI allowing payroll admins to input sample YTD Taxable Compensation and YTD Tax Withheld to test the computed Tax Due and Refund/Collectible result.

| Pros | Cons |
|---|---|
| Provides HR admins with immediate visual validation of year-end tax adjustment formulas. | Requires building a sandbox component on the frontend. |
| Helps answer employee tax queries during year-end closing. | |

**Option B — Static Table Display Only**
- Show annual tax brackets in a plain grid without testing capability.

| Pros | Cons |
|---|---|
| Slightly less frontend code. | Payroll officers cannot test tax annualization calculations without executing a year-end payroll batch. |

**Recommendation:** Option A. An interactive sandbox modal provides immediate clarity and audit confidence for HR officers.

---

## 3. Database Schema

### 3.1 Table Definition: `bir_annual_tax_table`

```php
Schema::create('bir_annual_tax_table', function (Blueprint $table) {
    $table->id();
    $table->date('effective_date')->default('2023-01-01');
    $table->decimal('taxable_income_from', 12, 2)->default(0.00);
    $table->decimal('taxable_income_to', 12, 2)->nullable()->comment('NULL indicates top open-ended bracket');
    $table->decimal('fixed_tax_amount', 12, 2)->default(0.00);
    $table->decimal('tax_rate_percent', 5, 2)->default(0.00)->comment('Percentage rate on excess, e.g. 20.00 for 20%');
    $table->decimal('excess_over_amount', 12, 2)->default(0.00);
    $table->boolean('is_active')->default(true);
    $table->timestamps();

    // Indexes
    $table->index(['is_active', 'effective_date'], 'idx_bir_annual_lookup');
    $table->index(['taxable_income_from', 'taxable_income_to'], 'idx_bir_annual_bracket');
});
```

### 3.2 Standard TRAIN Law Annual Tax Brackets (RR 2-2023 Reference Data)

Effective Date: **January 1, 2023 onwards**

| Bracket | Annual Taxable Income From | Annual Taxable Income To | Fixed Tax Amount | Tax Rate (%) | Excess Over Amount |
|---|---|---|---|---|---|
| **1** | ₱0.00 | ₱250,000.00 | ₱0.00 | 0.00% | ₱0.00 |
| **2** | ₱250,000.01 | ₱400,000.00 | ₱0.00 | 15.00% | ₱250,000.00 |
| **3** | ₱400,000.01 | ₱800,000.00 | ₱22,500.00 | 20.00% | ₱400,000.00 |
| **4** | ₱800,000.01 | ₱2,000,000.00 | ₱102,500.00 | 25.00% | ₱800,000.00 |
| **5** | ₱2,000,000.01 | ₱8,000,000.00 | ₱402,500.00 | 30.00% | ₱2,000,000.00 |
| **6** | ₱8,000,000.01 | *And above (NULL)* | ₱2,202,500.00 | 35.00% | ₱8,000,000.00 |

---

## 4. Backend Architecture

### 4.1 Eloquent Model: `App\Models\BirAnnualTaxTable`

```php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BirAnnualTaxTable extends Model
{
    protected $table = 'bir_annual_tax_table';

    protected $fillable = [
        'effective_date',
        'taxable_income_from',
        'taxable_income_to',
        'fixed_tax_amount',
        'tax_rate_percent',
        'excess_over_amount',
        'is_active',
    ];

    protected $casts = [
        'effective_date' => 'date',
        'taxable_income_from' => 'decimal:2',
        'taxable_income_to' => 'decimal:2',
        'fixed_tax_amount' => 'decimal:2',
        'tax_rate_percent' => 'decimal:2',
        'excess_over_amount' => 'decimal:2',
        'is_active' => 'boolean',
    ];
}
```

### 4.2 Query, Action & Handler Classes

- **`App\Queries\Payroll\GetBirAnnualTaxTableQuery`**:
  Retrieves annual tax brackets for a given tax year or effective date.

- **`App\Handlers\Payroll\SaveBirAnnualTaxBracketHandler`**:
  Handles CRUD operations for annual tax bracket setup.

- **`App\Actions\Payroll\ComputeAnnualTaxAction`**:
  Calculates annual tax due and tax adjustment (Refund vs. Collectible):
  ```php
  public function execute(float $annualTaxableIncome, float $ytdTaxWithheld = 0.00, ?string $asOfDate = null): array
  {
      if ($annualTaxableIncome <= 0) {
          return [
              'annual_taxable_income' => 0.00,
              'annual_tax_due' => 0.00,
              'ytd_tax_withheld' => $ytdTaxWithheld,
              'tax_adjustment' => round(0.00 - $ytdTaxWithheld, 2),
              'adjustment_type' => $ytdTaxWithheld > 0 ? 'REFUND' : 'NONE',
          ];
      }

      $bracket = BirAnnualTaxTable::query()
          ->where('is_active', true)
          ->where('effective_date', '<=', $asOfDate ?? now()->toDateString())
          ->where('taxable_income_from', '<=', $annualTaxableIncome)
          ->where(function ($query) use ($annualTaxableIncome) {
              $query->whereNull('taxable_income_to')
                    ->orWhere('taxable_income_to', '>=', $annualTaxableIncome);
          })
          ->orderBy('effective_date', 'desc')
          ->orderBy('taxable_income_from', 'desc')
          ->first();

      $fixedTax = $bracket ? (float) $bracket->fixed_tax_amount : 0.00;
      $rate = $bracket ? (float) $bracket->tax_rate_percent : 0.00;
      $excessBase = $bracket ? (float) $bracket->excess_over_amount : 0.00;

      $excess = max(0, $annualTaxableIncome - $excessBase);
      $annualTaxDue = round($fixedTax + ($excess * ($rate / 100)), 2);
      $adjustment = round($annualTaxDue - $ytdTaxWithheld, 2);

      return [
          'annual_taxable_income' => round($annualTaxableIncome, 2),
          'annual_tax_due' => $annualTaxDue,
          'ytd_tax_withheld' => round($ytdTaxWithheld, 2),
          'tax_adjustment' => abs($adjustment),
          'adjustment_type' => $adjustment < 0 ? 'REFUND' : ($adjustment > 0 ? 'COLLECTIBLE' : 'NEUTRAL'),
          'matched_bracket' => $bracket,
      ];
  }
  ```

### 4.3 Controller & Route Registration

#### Controller: `App\Http\Controllers\Payroll\BirAnnualTaxController`

- `index(Request $request)`: Lists active annual tax brackets.
- `store(Request $request)`: Creates a new annual bracket.
- `update(Request $request, $id)`: Updates a bracket.
- `destroy($id)`: Deletes a bracket.
- `lookup(Request $request)`: Test endpoint accepting `annual_taxable_income` and optional `ytd_tax_withheld`, returning computed tax due and adjustment breakdown.

#### Routes in `routes/api/payroll.php`:

```php
use App\Http\Controllers\Payroll\BirAnnualTaxController;

Route::get('/bir-annual-tax-table/lookup', [BirAnnualTaxController::class, 'lookup']);
Route::apiResource('bir-annual-tax-table', BirAnnualTaxController::class);
```

---

## 5. Frontend Architecture

### 5.1 File Layout

```text
resources/views/web/src/module/payroll/government_routines/pages/bir/annual_tax_table/
├── index.ts                                             # Public exports
├── route/bir_annual_tax_table.routes.ts               # Route registry
├── types/bir_annual_tax_table.types.ts                 # TypeScript interfaces
├── api/bir_annual_tax_table.api.ts                     # Hardcoded Gate 1 / Live Gate 2 API
├── composables/useBirAnnualTaxTable.ts                 # Reactive composable
├── pages/
│   └── AnnualTaxTable.vue                              # Main view container
└── components/
    ├── AnnualTaxHeader.vue                             # Header banner with TRAIN Law badge
    ├── AnnualTaxGrid.vue                               # Bracket table grid
    ├── AnnualTaxFormModal.vue                          # Add/Edit bracket modal
    └── AnnualTaxCalculatorModal.vue                    # Annual tax & refund sandbox modal
```

### 5.2 TypeScript Contracts (`bir_annual_tax_table.types.ts`)

```typescript
export interface BirAnnualTaxBracket {
  id: number;
  effective_date: string;
  taxable_income_from: number;
  taxable_income_to: number | null;
  fixed_tax_amount: number;
  tax_rate_percent: number;
  excess_over_amount: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AnnualTaxLookupPayload {
  annual_taxable_income: number;
  ytd_tax_withheld?: number;
  effective_date?: string;
}

export interface AnnualTaxLookupResult {
  annual_taxable_income: number;
  annual_tax_due: number;
  ytd_tax_withheld: number;
  tax_adjustment: number;
  adjustment_type: 'REFUND' | 'COLLECTIBLE' | 'NEUTRAL' | 'NONE';
  matched_bracket: BirAnnualTaxBracket | null;
}
```

### 5.3 User Interface Layout Sketch

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 🏛️ BIR Annual Tax Table & Tax Annualization Reference                                           │
│ Official BIR annual income tax brackets under TRAIN Law RR 2-2023 for Year-End & 2316 Compliance. │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘

 [ 📅 Effective Date: Jan 1, 2023 ]  [ 🔄 Refresh ]  [ 🧮 Test Annual Reconciliation ]  [ ➕ Add Bracket ]

 ┌──────┬──────────────────────┬──────────────────────┬─────────────┬───────────┬─────────────┬──────────┐
 │ Step │ Taxable Income From  │ Taxable Income To    │ Fixed Tax   │ Rate (%)  │ Excess Over │ Actions  │
 ├──────┼──────────────────────┼──────────────────────┼─────────────┼───────────┼─────────────┼──────────┤
 │  1   │ ₱0.00                │ ₱250,000.00          │ ₱0.00       │ 0.00%     │ ₱0.00       │ ✏️  🗑️   │
 │  2   │ ₱250,000.01          │ ₱400,000.00          │ ₱0.00       │ 15.00%    │ ₱250,000.00 │ ✏️  🗑️   │
 │  3   │ ₱400,000.01          │ ₱800,000.00          │ ₱22,500.00  │ 20.00%    │ ₱400,000.00 │ ✏️  🗑️   │
 │  4   │ ₱800,000.01          │ ₱2,000,000.00        │ ₱102,500.00 │ 25.00%    │ ₱800,000.00 │ ✏️  🗑️   │
 │  5   │ ₱2,000,000.01        │ ₱8,000,000.00        │ ₱402,500.00 │ 30.00%    │ ₱2,000,000.00│ ✏️  🗑️   │
 │  6   │ ₱8,000,000.01        │ And above (MAX)      │ ₱2,202,500  │ 35.00%    │ ₱8,000,000.00│ ✏️  🗑️   │
 └──────┴──────────────────────┴──────────────────────┴─────────────┴───────────┴─────────────┴──────────┘
```

---

## 6. Business Rules & Edge Cases

### 6.1 HRMS Domain Rules ([payroll.md](../../../rules/conditional/payroll.md))

1. **Tax Annualization Formula:**
   $$\text{Tax Adjustment} = \text{Annual Tax Due} - \text{Total YTD Tax Withheld}$$
   - If $\text{Adjustment} < 0$: The employee is entitled to a **Tax Refund** (added to net pay during year-end processing).
   - If $\text{Adjustment} > 0$: Additional tax is **Collectible** (deducted from net pay during year-end processing).
   - If $\text{Adjustment} == 0$: Neutral / zero adjustment.

2. **Exemptions & Non-Taxable Ceilings:**
   - 13th Month Pay & Other Benefits up to ₱90,000.00 are non-taxable and excluded from total annual taxable income.
   - De minimis benefits within threshold limits are non-taxable.

3. **Consistency Across BIR Year-End Reports:**
   - The computed annual tax due and adjustment figures generated by `ComputeAnnualTaxAction` must match identically between `YearEnd` payroll processing, BIR Form 2316 Part IVA/IVB, and BIR Alphalist Schedules 1 & 2.

### 6.2 Edge Cases Matrix

| Edge Case | Handling Strategy |
|---|---|
| **Annual Taxable Income <= ₱250,000.00** | Matches Bracket 1 (0% tax rate). Annual tax due = ₱0.00. If employee had prior tax withheld, full amount is marked as `REFUND`. |
| **Top Bracket Open-Ended (> ₱8,000,000.00)** | Checked via `whereNull('taxable_income_to')` to correctly compute 35% tax rate on excess over ₱8M. |
| **Mid-Year Separated Employee** | Annualized at Final Pay processing using current YTD totals. `ComputeAnnualTaxAction` executes on actual YTD earnings accrued to date. |
| **Negative Net Adjustment (Refund exceeding final period pay)** | Year-End processing flags the excess refund for payout via direct manual transaction or bank advice. |
| **Minimum Wage Earner (MWE)** | Exempt from income withholding tax under Republic Act 9504; marked as MWE tax-exempt (0 tax due). |

---

## 7. Build Order

1. **Database Migration & Seeding:**
   - Create `database/migrations/alters/2026_07_30_000006_create_bir_annual_tax_table.php` and pre-seed TRAIN Law RR 2-2023 annual tax brackets.
2. **Backend Model & Business Logic:**
   - Create `App\Models\BirAnnualTaxTable.php`.
   - Implement `App\Queries\Payroll\GetBirAnnualTaxTableQuery`.
   - Implement `App\Handlers\Payroll\SaveBirAnnualTaxBracketHandler`.
   - Implement `App\Actions\Payroll\ComputeAnnualTaxAction`.
   - Create `App\Http\Controllers\Payroll\BirAnnualTaxController.php` and register API routes in `routes/api/payroll.php`.
3. **Frontend Gate 1 (Static UI & Design Validation):**
   - Scaffold folder layout under `resources/views/web/src/module/payroll/government_routines/pages/bir/annual_tax_table/`.
   - Create `bir_annual_tax_table.types.ts`, `bir_annual_tax_table.api.ts` (with hardcoded sample brackets), and `useBirAnnualTaxTable.ts`.
   - Build `AnnualTaxTable.vue`, `AnnualTaxHeader.vue`, `AnnualTaxGrid.vue`, `AnnualTaxFormModal.vue`, and `AnnualTaxCalculatorModal.vue`.
4. **Frontend Gate 2 (Live API Integration):**
   - Swap hardcoded API calls in `bir_annual_tax_table.api.ts` to live Axios endpoints (`/api/payroll/bir-annual-tax-table`).
   - Connect live tax calculator modal to `/api/payroll/bir-annual-tax-table/lookup`.
5. **Integration with Year-End & BIR Reports:**
   - Wire `ComputeAnnualTaxAction` into `ProcessYearEndHandler.php`, `Bir2316ReportController.php`, and `AlphalistReportController.php`.
6. **Verification & Audit:**
   - Verify UI rendering in light and dark mode, test CRUD operations, and test tax annualization calculations against official BIR 2316 test cases.

---

## 8. Out of Scope

- **Periodic (Monthly/Semi-Monthly) Withholding Tax Calculations:** Handled by `bir_periodic_tax_table.md`.
- **Corporation Income Tax / Value Added Tax (VAT):** Handled in financial accounting systems outside HRMS scope.
