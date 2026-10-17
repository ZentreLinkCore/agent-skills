# Spec — Recurring Entries (payroll entries)

> **Kind:** Greenfield (page is a 4-line placeholder; no backend yet).
> **Portal:** Payroll. **Route:** `payroll/recurring-entries` (`payroll_recurring_entries`) — already registered → [recurring_entries/RecurringEntries.vue](../../../resources/views/web/src/module/payroll/payroll_entries/pages/recurring_entries/RecurringEntries.vue).
> **Builds on the shared `payroll_entry` table** defined in [batch_entries.md](./batch_entries.md) §3a.
> **Conventions:** [.agents/rules/project-gate.md](../../../rules/core/project-gate.md).

---

## 1. Purpose

**Recurring Entries** are fixed, repeating payroll line items that apply every pay cycle — e.g. monthly rice allowance, uniform deduction, HMO — so payroll doesn't re-key them each period. Payroll maintains **templates** per employee; a per-period **generate** step materializes them into `payroll_entry` rows that Payroll Processing consumes.

Hub description: *"Manage fixed, repeating payroll line items that apply every pay cycle."*

---

## 2. Data Flow

```text
Recurring templates (CRUD)  ──► "Generate for period"  ──► payroll_entry (source='recurring', source_ref=template.id)
  payroll_recurring_entry                                         ▼
                                                     Payroll Processing folds into pay
```

---

## 3. Persistence — `payroll_recurring_entry` (template)

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `idacct` | int, indexed | → `accounts.id` |
| `idtranstype` | int, indexed | → `transactiontype.id` |
| `kind` | string | `earning` \| `deduction` (from the transaction type's class) |
| `amount` | decimal(12,2) | fixed per-period amount |
| `frequency` | string | `every` \| `monthly` \| `first_half` \| `second_half` (which cutoffs it applies to) |
| `start_period` | int nullable | first `payroll_period.id` it applies from |
| `end_period` | int nullable | last period (null = open-ended) |
| `active` | tinyint default 1 | |
| `remarks` | string nullable | |
| `created_by` | int nullable | |
| `timestamps` | | |

Model `App\Models\PayrollRecurringEntry`. Produces rows in the shared **`payroll_entry`** ([batch_entries.md](./batch_entries.md) §3a).

---

## 4. Backend (Domain pattern)

Routes (inside `Route::prefix('payroll')`):
```php
Route::get('/recurring-entries',            [PayrollEntriesController::class, 'recurringIndex']);
Route::post('/recurring-entries',           [PayrollEntriesController::class, 'recurringStore']);
Route::put('/recurring-entries/{id}',       [PayrollEntriesController::class, 'recurringUpdate']);
Route::delete('/recurring-entries/{id}',    [PayrollEntriesController::class, 'recurringDestroy']);
Route::post('/recurring-entries/generate',  [PayrollEntriesController::class, 'recurringGenerate']); // materialize for a period
```

- `GetRecurringEntriesQuery` — paginated template list (+ resolved employee + transaction-type names), filters (employee, transaction type, active).
- `SaveRecurringEntryHandler` — create/update a template (`DB::transaction`).
- `GenerateRecurringEntriesHandler` — for a target period: select active templates whose `start/end` window includes the period **and** whose `frequency` matches the period's cutoff-half; create one `payroll_entry` per template (`source='recurring'`, `source_ref=template.id`), **skipping templates already generated for that period** (idempotent). Block if `pay_process_status = 1`.
- Thin controller, `try/catch`, JSON. No API Resources.

---

## 5. Frontend Design

TS module: `RecurringEntries.vue` + `api/recurring_entries.api.ts` + `composables/useRecurringEntries.ts` + `types/types.recurring_entries.ts` + `components/{RecurringEntriesTable, RecurringEntryFormModal, GenerateForPeriodModal}.vue`.

- **Template list** — Employee, Transaction Type, Kind badge, Amount (`formatCurrency`), Frequency, Window (start–end), Active toggle, Actions. Search + filters (employee, transaction type, active). Global `<Pagination>`, `<TableSkeleton>`, `<EmptyState>`.
- **Form modal** — employee select, transaction-type select (from [transaction_types.md](./transaction_types.md) — `GET api/payroll/transactionTypes`), `amount`, `frequency`, start/end period, `remarks`. Import `Modal`.
- **Generate-for-period modal** — pick period → preview how many templates will materialize → confirm → `recurringGenerate`; show created count. Disabled for closed periods.
- Cyan accent, valid Tailwind tokens, dark mode.

---

## 6. Edge Cases, Testing & Build Order

- **Idempotent generate:** never double-create a template's entry for the same period.
- **Frequency vs cutoff-half:** a `first_half`/`second_half` template only generates on the matching cutoff (derive from `payroll_period.period_type`) — mirror the statutory half-gating in [timesheet_summary.md](./timesheet_summary.md) §6.3 Step 3.
- **Window bounds:** respect `start_period`/`end_period`; inactive templates never generate.
- **Closed period:** block generate.
- **Testing:** PHPUnit — generate creates correct entries, idempotency, window + frequency gating, closed-period block. Vitest — CRUD + generate preview flow.
- **Build order (design-first):** Gate 1 hard-coded design (template list + form + generate) → Gate 2 `payroll_recurring_entry` table/model + queries/handlers + routes, swap api to live. Depends on `payroll_entry` ([batch_entries.md](./batch_entries.md)) and transaction types.
