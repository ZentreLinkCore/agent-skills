# Spec — Journal Voucher (JV) Report & SAP File Exporter

> **Kind:** Greenfield — New accounting integration module for payroll financial posting.
> **Portal:** **Payroll** (`/api/payroll/...` routes, `reports/pages/journal_voucher` frontend module).
> **Route:** `/payroll/journal-voucher` (`payroll_journal_voucher`).
> **Conventions:** [project-profile.md](../../rules/project-profile.md), [hrms-rules](../../rules/hrms-rules.md).
> **System Awareness:** Models reused: `PayrollRun`, `PayrollRunDetail`, `PayPeriod`, `ChartofAccount`, `SAPCodes`, `TransactionTypes`. Models created: `JournalVoucherHeader`, `JournalVoucherDetail`. Tables created: `journal_voucher_header`, `journal_voucher_detail`. New migration: `yes`.

---

## 1. Purpose

The **Journal Voucher (JV) Report & SAP File Exporter** is a critical financial integration layer in the HRMS Payroll system. While payslips and payroll registers track employee-level earnings, the Journal Voucher aggregates the entire financial impact of a processed payroll cutoff into double-entry accounting records (Debits & Credits) grouped by **Chart of Accounts (COA)** and **SAP General Ledger (GL) Codes**.

### Primary Business Objectives
1. **Financial Integrity & Double-Entry Compliance**: Automatically generate balanced accounting entries where `Total Debits == Total Credits` for every processed payroll run.
2. **ERP Bridge (SAP Integration)**: Convert payroll financial results into an SAP-compatible text/CSV upload file, eliminating manual accounting entry, human transcription errors, and month-end closing bottlenecks.
3. **Auditability & Traceability**: Store snapshot records of generated JV postings linked to specific `PayrollRun` IDs, ensuring clear audit trails between Payroll and General Ledger accounts.

---

## 2. Design Decisions (Pros & Cons)

### Decision 1: Aggregation & Account Mapping Engine

**Option A — Dynamic Mapping Engine from `payroll_run_detail` + COA/SAP Master Tables (Recommended)**
- Queries `payroll_run_detail` line items (`basic_pay`, `ot_pay`, `sss`, `philhealth`, `pagibig`, `withholding_tax`, `loans`, `net_pay`) and maps each item dynamically to its assigned `chartofaccounts` and `sapcodes` records.
- Unmapped or fallback line items automatically route to a designated "Unallocated Payroll Clearing Account".

| Pros | Cons |
|---|---|
| Dynamically adapts whenever COA or SAP Code configurations change. | Requires robust fallback handling for unmapped custom earnings/deductions. |
| Preserves 100% alignment with transaction-type level account setups. | Slightly higher aggregation computation query overhead. |
| Zero disruption to historic `payroll_run_detail` data structures. | |

**Option B — Hardcoded Field-to-Account Mapping**
- Hardcodes fixed field rules (e.g., `basic_pay` always maps to COA `5010-001`).

| Pros | Cons |
|---|---|
| Simple to query and implement. | Inflexible; breaks when companies customize Chart of Accounts or SAP GL codes. |
| Faster initial code generation. | Requires code changes whenever accounting codes are updated. |

**Recommendation:** **Option A**. It aligns perfectly with the newly built `ChartofAccount` and `SAPCodes` master data tables and enforces clean separation of configuration and execution logic.

---

### Decision 2: Double-Entry Balancing & Discrepancy Resolution

**Option A — Strict Balance Enforcement with Clearing Account Auto-Balancing (Recommended)**
- Sums all Debit entries (Expenses & Assets) and Credit entries (Liabilities & Net Pay). If rounding differences (e.g. ₱0.01 to ₱0.05) occur due to individual employee calculations, the micro-variance is automatically posted to a "Payroll Rounding & Clearing Account" (`2030-004`).

| Pros | Cons |
|---|---|
| Guarantees 100% balanced entries (`Total Debit == Total Credit`). | Requires designating a default clearing account in system preferences. |
| Prevents SAP ERP upload rejection due to imbalance errors. | Hides tiny rounding fractions inside a designated clearing account. |

**Option B — Hard Error & Block on Any Discrepancy**
- Aborts JV generation if Total Debit does not equal Total Credit down to the cent.

| Pros | Cons |
|---|---|
| Forces manual inspection of every cent difference. | Blocks payroll closing workflows over minor 1-cent floating-point rounding issues. |

**Recommendation:** **Option A**. Double-entry accounting systems require exact balance before posting. Auto-balancing cent variances to a clearing account guarantees seamless SAP import.

---

### Decision 3: SAP Export File Format

**Option A — Multi-Format Exporter (SAP CSV/Text + Standard Excel JV Report) (Recommended)**
- Generates two outputs:
  1. **Printable / Excel JV Summary Report**: Complete breakdown with Debit/Credit columns, account names, COA codes, and signature blocks for accounting review.
  2. **SAP FI Direct Import File (CSV/Pipe-Delimited)**: Standardized layout formatted for SAP ERP (Posting Date, Doc Date, Document Type `SA`, Header Text, GL Account/SAP Code, Currency `PHP`, Debit Amount, Credit Amount, Cost Center).

| Pros | Cons |
|---|---|
| Serves both human accounting audit and automated ERP ingestion. | Requires maintaining two template output builders. |
| Compatible with SAP Business One, S/4HANA, and ECC 6.0. | |

**Option B — Generic Excel File Only**
- Produces only a standard Excel spreadsheet.

| Pros | Cons |
|---|---|
| Faster to build. | Requires accounting staff to manually format data before uploading to SAP. |

**Recommendation:** **Option A**. Provides maximum value by eliminating manual Excel reformatting for finance teams.

---

## 3. Database

### Reused Tables & Models
- `payroll_run` (`PayrollRun`): Header table for processed payroll runs (`id`, `idpayperiod`, `total_gross`, `total_net`, `status`).
- `payroll_run_detail` (`PayrollRunDetail`): Line-item payroll amounts per employee.
- `pay_periods` (`PayPeriod`): Pay period master list.
- `chartofaccounts` (`ChartofAccount`): Master account codes (`code`, `desc`, `type`).
- `sapcodes` (`SAPCodes`): SAP GL mapping codes (`sapcodes`, `desc`, `coaid`).
- `transaction_types` (`TransactionTypes`): Transaction types with `coaids` references.

### Created Tables & Models

#### Migration: `2026_07_29_000001_create_journal_voucher_tables.php`

```sql
-- 1. Journal Voucher Header Table
CREATE TABLE `journal_voucher_header` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `jv_number` VARCHAR(50) NOT NULL UNIQUE COMMENT 'Format: JV-YYYYMM-XXXX',
  `idpayrun` BIGINT UNSIGNED NOT NULL,
  `idpayperiod` BIGINT UNSIGNED NOT NULL,
  `posting_date` DATE NOT NULL,
  `document_date` DATE NOT NULL,
  `reference` VARCHAR(100) NULL COMMENT 'Pay Period Code / Description',
  `total_debit` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `total_credit` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '1=Draft, 2=Posted, 3=Exported',
  `created_by` BIGINT UNSIGNED NULL,
  `created_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP NULL,
  CONSTRAINT `fk_jv_header_payrun` FOREIGN KEY (`idpayrun`) REFERENCES `payroll_run` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Journal Voucher Detail Table
CREATE TABLE `journal_voucher_detail` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `idjv` BIGINT UNSIGNED NOT NULL,
  `coaid` BIGINT UNSIGNED NULL,
  `sapid` BIGINT UNSIGNED NULL,
  `account_code` VARCHAR(50) NOT NULL,
  `sap_code` VARCHAR(50) NULL,
  `account_desc` VARCHAR(255) NOT NULL,
  `account_type` VARCHAR(50) NOT NULL COMMENT 'Expense, Liability, Asset, Equity',
  `debit_amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `credit_amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `cost_center` VARCHAR(50) NULL,
  `remarks` VARCHAR(255) NULL,
  `created_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP NULL,
  CONSTRAINT `fk_jv_detail_header` FOREIGN KEY (`idjv`) REFERENCES `journal_voucher_header` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 4. Backend Architecture

Following the HRMS top-level Query/Handler/Action pattern:

### 1. Query: `App\Queries\Payroll\JournalVoucherQuery`
- `getPayrollRunsForJv(array $filters)`: Fetches completed/approved `payroll_run` records eligible for JV generation.
- `getJvHeaders(array $filters)`: Fetches generated JV header records with pagination.
- `getJvDetail(int $jvId)`: Fetches complete JV header + detail rows with mapped COA/SAP descriptors.

### 2. Handler: `App\Handlers\Payroll\JournalVoucherHandler`
- `generateJv(int $payRunId, int $userId)`:
  1. Fetches `PayrollRun` and all associated `PayrollRunDetail` records.
  2. Aggregates earnings (`basic_pay`, `ot_pay`, `holiday_pay`, `leave_pay`, allowances) into **Debit** entries mapped to Expense COAs.
  3. Aggregates deductions (`sss`, `philhealth`, `pagibig`, `withholding_tax`, loans) into **Credit** entries mapped to Liability COAs.
  4. Aggregates `net_pay` into a **Credit** entry mapped to Payroll Clearing / Net Pay Payable (`2030-004`).
  5. Computes `total_debit` and `total_credit`. Auto-balances minor rounding differences to the clearing account.
  6. Inserts `journal_voucher_header` and `journal_voucher_detail` records wrapped in DB transaction.
- `exportSapFile(int $jvId, string $format)`: Formats JV entries into SAP-compliant CSV/Text pipe-delimited string or Excel workbook for download.

### 3. Controller: `App\Http\Controllers\payroll\JournalVoucherController`
- `GET /api/payroll/journalVoucher` -> `index(Request $request)` (List generated JVs or pay runs).
- `POST /api/payroll/journalVoucher/generate` -> `generate(Request $request)` (Triggers JV generation).
- `GET /api/payroll/journalVoucher/{id}` -> `show($id)` (Returns detailed JV breakdown).
- `GET /api/payroll/journalVoucher/{id}/export-excel` -> `exportExcel($id)` (Excel JV Report).
- `GET /api/payroll/journalVoucher/{id}/export-sap` -> `exportSap($id)` (SAP ERP import file).

### Route Registration (`routes/api/payroll.php`)
```php
use App\Http\Controllers\payroll\JournalVoucherController;

Route::get('/journalVoucher',                 [JournalVoucherController::class, 'index']);
Route::post('/journalVoucher/generate',       [JournalVoucherController::class, 'generate']);
Route::get('/journalVoucher/{id}',            [JournalVoucherController::class, 'show'])->whereNumber('id');
Route::get('/journalVoucher/{id}/export-excel', [JournalVoucherController::class, 'exportExcel'])->whereNumber('id');
Route::get('/journalVoucher/{id}/export-sap',   [JournalVoucherController::class, 'exportSap'])->whereNumber('id');
```

---

## 5. Frontend Architecture

### Module Structure
Location: `resources/views/web/src/module/payroll/reports/pages/journal_voucher/`

```text
journal_voucher/
├── index.ts
├── JournalVoucher.vue
├── api/
│   └── journal_voucher.api.ts
├── composables/
│   └── useJournalVoucher.ts
├── components/
│   ├── JvHeaderSummary.vue
│   ├── JvTable.vue
│   ├── JvDetailModal.vue
│   └── JvGenerateModal.vue
└── types/
    └── types.journal_voucher.ts
```

### API Contract (`types.journal_voucher.ts`)
```ts
export interface JournalVoucherHeaderRow {
  id: number;
  jv_number: string;
  idpayrun: number;
  idpayperiod: number;
  pay_period_code?: string;
  pay_period_label?: string;
  posting_date: string;
  document_date: string;
  reference: string;
  total_debit: number;
  total_credit: number;
  status: number; // 1=Draft, 2=Posted, 3=Exported
  created_at: string;
}

export interface JournalVoucherDetailRow {
  id: number;
  account_code: string;
  sap_code?: string;
  account_desc: string;
  account_type: 'Expense' | 'Liability' | 'Asset' | 'Equity';
  debit_amount: number;
  credit_amount: number;
  cost_center?: string;
  remarks?: string;
}

export interface JournalVoucherListResponse {
  list: number;
  jvs: {
    data: JournalVoucherHeaderRow[];
    total: number;
    current_page: number;
    per_page: number;
  };
  pay_runs_without_jv?: any[];
}
```

### Page Layout (`JournalVoucher.vue`)
- **Header Banner**: Standard `HeaderBanner` with Cyan theme icon (`mdi-notebook-text`), title *"Journal Voucher (JV) & SAP Exporter"*, subtitle *"Consolidate payroll entries into balanced double-entry accounting records for SAP ERP GL posting."*
- **Segmented Tabs / Actions**:
  - Filter toolbar (Pay Period dropdown, Status selector, Search input).
  - Primary Action Button: `Generate Journal Voucher` (opens `JvGenerateModal.vue`).
- **Data Table (`JvTable.vue`)**:
  - Columns: JV Number, Pay Period, Posting Date, Total Debit (₱), Total Credit (₱), Balance Status Badge (`Balanced` / `Imbalanced`), Actions (View Detail, Export Excel, Export SAP File).
- **Detail View Modal (`JvDetailModal.vue`)**:
  - Split view of Header metadata + full Debit/Credit accounting table with total row verification (`Sum Debit == Sum Credit`).

---

## 6. Business Rules & Edge Cases

### HRMS Domain Rules
1. **Double-Entry Balance Rule**: Every generated JV must satisfy `sum(debit_amount) == sum(credit_amount)`.
2. **Payroll Run Prerequisite**: A JV can only be generated for a `PayrollRun` with status `Completed` / `Approved`.
3. **Idempotency / Single JV per Run**: A `PayrollRun` can only have one active JV header. Regenerating a JV overwrites or revisions the previous draft for that payroll run.

### Edge Case Matrix

| Edge Case | Potential Impact | System Handling |
|---|---|---|
| Unmapped Transaction Type (no COA/SAP assigned) | Unbalanced JV or missing expense entry | Route amount to "Unallocated Payroll Expense/Liability" fallback account and display a warning toast. |
| Micro-Rounding Variance (1 to 5 cents) | SAP ERP upload rejection due to ₱0.01 imbalance | Automatically balance difference against "Payroll Clearing Account" (`2030-004`). |
| Unlocked/Reopened Payroll Run | Historic JV becomes stale | Mark existing JV header status as `Stale/Outdated` and require regeneration upon re-closing. |
| SAP Code Missing for a COA | Empty SAP Code field in export file | Fallback to using the COA Account Code in the SAP Code column and flag entry with `Unmapped SAP` tag. |

---

## 7. Build Order

1. **Database Migration**: Create `2026_07_29_000001_create_journal_voucher_tables.php` and run migration.
2. **Eloquent Models**: Create `JournalVoucherHeader.php` and `JournalVoucherDetail.php`.
3. **Backend Logic**:
   - Create `JournalVoucherQuery.php` for database retrieval.
   - Create `JournalVoucherHandler.php` for double-entry aggregation and SAP CSV formatting.
   - Create `JournalVoucherController.php` and register API routes in `routes/api/payroll.php`.
4. **Frontend Gate 1 (Design-First)**:
   - Scaffold module layout under `resources/views/web/src/module/payroll/reports/pages/journal_voucher/`.
   - Implement `JournalVoucher.vue`, `JvTable.vue`, `JvDetailModal.vue`, `JvGenerateModal.vue` with mock data.
5. **Frontend Gate 2 (Live Wiring)**:
   - Connect `journal_voucher.api.ts` to live backend endpoints.
   - Verify JV generation, double-entry balance totals, and SAP CSV file downloads.

---

## 8. Out of Scope (Future Specs)

- **Direct SAP RFC / REST API Push**: Direct real-time API sync into SAP via Web Services (currently file-based CSV/Excel export).
- **Multi-Currency Payroll JV**: Multi-currency conversion for foreign remote workers (currently PHP only).
