# Spec — Batch Entries (payroll entries)

> **Kind:** Greenfield (page is a 4-line placeholder; **no payroll-entries backend exists yet**).
> **Portal:** Payroll. **Route:** `payroll/batch-entries` (`payroll_batch_entries`) — already registered → [batch_entries/BatchEntries.vue](../../../resources/views/web/src/module/payroll/payroll_entries/pages/batch_entries/BatchEntries.vue).
> **Defines the shared `payroll_entry` table** used by all Payroll Entries features ([recurring_entries.md](./recurring_entries.md), [service_charge.md](./service_charge.md), [loans.md](./loans.md), [bonus_special.md](./bonus_special.md)).
> **Conventions:** [.agents/rules/project-profile.md](../../rules/project-profile.md), [hrms-rules](../../rules/hrms-rules.md).

---

## 1. Purpose

**Batch Entries** lets payroll bulk-import many one-off payroll line items for a pay period from a structured Excel file — e.g. mass allowances, deductions, adjustments — validate/preview them, then commit. Each committed row becomes a **`payroll_entry`** that Payroll Processing folds into the employee's pay ([timesheet_summary.md](./timesheet_summary.md) §6.3).

The Payroll Entries hub ([Entries.vue](../../../resources/views/web/src/module/payroll/payroll_entries/pages/Entries.vue)) describes it as: *"Import and process multiple payroll entry records in bulk via structured files."*

---

## 2. Data Flow

```text
Excel file ──► Batch Entries (upload → validate → preview → commit)
                    │  creates one payroll_entry per valid row  (source = 'batch')
                    ▼
              payroll_entry (per emp / period / transaction type)
                    ▼
         Payroll Processing folds entries into pay:
           kind='earning'   → gross earnings / adjustments
           kind='deduction' → other_deductions
```

---

## 3. Persistence

### 3a. `payroll_entry` (CANONICAL — shared by all Payroll Entries features)

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `idpayperiod` | int, indexed | → `payroll_period.id` |
| `idacct` | int, indexed | → `accounts.id` |
| `idtranstype` | int, indexed | → `transactiontype.id` (defines earning/deduction accounting, taxability via its class) |
| `kind` | enum/string | `earning` \| `deduction` (derive from the transaction type's class `transtype`) |
| `amount` | decimal(12,2) | |
| `taxable` | tinyint | from the transaction class `istax` (snapshot) |
| `source` | string | `manual` \| `batch` \| `recurring` \| `loan` \| `service_charge` \| `bonus` |
| `source_ref` | bigint nullable | id of the batch/template/loan/etc. that produced it |
| `remarks` | string nullable | |
| `status` | tinyint default 1 | `0` Draft / `1` Posted (Processing reads Posted only) |
| `created_by` | int nullable | |
| `timestamps` | | |

Indexes: `(idpayperiod, idacct)`, `idtranstype`, `source`. Model `App\Models\PayrollEntry`.

> **Payroll Processing integration** ([timesheet_summary.md](./timesheet_summary.md) §6.3 Step 4): the compute handler bulk-loads posted `payroll_entry` rows for the period and adds `kind='earning'` to earnings/adjustments and `kind='deduction'` to `other_deductions` (loans keep their own `loans` column via `source='loan'`).

### 3b. `payroll_entry_batch` (batch header)

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `idpayperiod` | int, indexed | |
| `filename` | string | uploaded file name |
| `total_rows` / `posted_rows` | int | |
| `status` | string | `staged` \| `committed` |
| `created_by` | int nullable | |
| `timestamps` | | |

---

## 4. Backend (Domain pattern)

Routes (inside `Route::prefix('payroll')`):
```php
Route::get('/batch-entries',          [PayrollEntriesController::class, 'batchIndex']);   // past batches + entries
Route::post('/batch-entries/upload',  [PayrollEntriesController::class, 'batchUpload']);   // parse + validate → preview
Route::post('/batch-entries/commit',  [PayrollEntriesController::class, 'batchCommit']);   // create payroll_entry rows
Route::delete('/batch-entries/{id}',  [PayrollEntriesController::class, 'batchDestroy']);
```

- `GetBatchEntriesQuery` — list batches for a period (+ their entries), paginated.
- `ImportPayrollBatchHandler` — reuse the project's `GenericImport` (see [LoanTypeController::uploadLoanType](../../../app/Http/Controllers/payroll/LoanTypeController.php)) to parse the file, validate each row (employee exists, transaction type exists, amount numeric), collect duplicates/errors, return a **preview** (valid rows + rejected rows with reasons). No DB write on upload.
- `CommitPayrollBatchHandler` — in `DB::transaction`, create the `payroll_entry_batch` header + one `payroll_entry` per valid row (`source='batch'`, `source_ref=batch.id`, `status=1`).
- Thin controller, `try/catch`, `response()->json`. No API Resources. Block commit if the period's `pay_process_status = 1` (payroll already closed).

**Excel columns:** `empid`, `transaction_type` (code), `amount`, `remarks` (map to `payroll_entry`). Reject rows with unknown empid/transaction type.

---

## 5. Frontend Design

New TS module structure under the page folder: `BatchEntries.vue` + `api/batch_entries.api.ts` + `composables/useBatchEntries.ts` + `types/types.batch_entries.ts` + `components/{BatchUploadModal, BatchPreviewTable, BatchListTable}.vue`.

- **Period selector** (`c-select` / `VDatePicker`) — the target period; disable actions when `pay_process_status = 1`.
- **Upload modal** — download-template hint + file picker → `batchUpload`; render the **preview**: valid rows (green) and rejected rows with reasons (red), counts.
- **Commit** — after preview, `batchCommit`; toast, refresh; show posted count.
- **Batch list** — past batches for the period (filename, rows, posted, date, delete). Global `<Pagination>`, `<TableSkeleton>`, `<EmptyState>`.
- Filters: search empid/name, transaction type, kind. Cyan accent, valid Tailwind tokens, dark mode.

---

## 6. Edge Cases, Testing & Build Order

- **Closed period:** block upload/commit when `pay_process_status = 1`.
- **Duplicate rows / unknown employee or transaction type:** rejected in preview with reason; never partially commit — commit is all-or-nothing in a transaction.
- **Re-import:** committing again creates new entries (idempotency is the officer's call); show existing batch count.
- **Testing:** PHPUnit — import validation (reject unknown empid/ttype), commit creates correct `payroll_entry` rows, closed-period block, transaction rollback. Vitest — upload→preview→commit flow, period gating.
- **Build order (design-first):** Gate 1 hard-coded design (upload modal + preview + list) for review → Gate 2 tables/models (`payroll_entry`, `payroll_entry_batch`) + queries/handlers + routes, swap api to live. `payroll_entry` must exist before the other Payroll Entries specs and before Payroll Processing consumes it.
