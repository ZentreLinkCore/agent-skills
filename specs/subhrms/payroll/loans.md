# Spec — Loans (payroll entries)

> **Kind:** **Implemented** — Gate 1 (hard-coded design) and Gate 2 (tables, models, queries/handlers, routes, live API) have both landed. The loan register, ledger, and amortization generation all work end-to-end against the database. What is **not** yet wired is the last leg of the chain — posting each amortization as a `payroll_entry` and having Payroll Processing route it into the `loans` column. That leg is specified separately in **§7 Pending**.
> **Portal:** Payroll. **Route:** `payroll/loans` (`payroll_loans`) — registered → [loans/Loans.vue](../../../resources/views/web/src/module/payroll/payroll_entries/pages/loans/Loans.vue).
> **Builds on** the **Loan Types** master ([loan_types.md](./loan_types.md)), and (once §7 lands) the shared `payroll_entry` table ([batch_entries.md](./batch_entries.md) §3a).
> **Conventions:** [.agents/rules/project-profile.md](../../rules/project-profile.md), [hrms-rules](../../rules/hrms-rules.md).

---

## 1. Purpose

**Loans** tracks employee loans (Government / Company / Third-Party — from the `loantype` master) and their **amortization** across pay periods. Each period, "Generate amortizations" advances every active loan by one instalment: it marks the next schedule row paid and decrements the outstanding balance until the loan is fully paid. Once §7 lands, that same step also posts a deduction `payroll_entry` that Payroll Processing subtracts as the `loans` component of net pay ([timesheet_summary.md](./timesheet_summary.md) §6.3 Step 4).

Hub description: *"Track and deduct employee loan amortizations across the payroll cycle."*

---

## 2. Data Flow

```text
Loan issuance (CRUD)  ──► "Generate amortizations for period"  ──►  ledger advances        [IMPLEMENTED]
  payroll_loan            per active loan, start_period <= period    schedule.paid = 1
  + payroll_loan_         due = min(next schedule due, balance)      schedule.idpayperiod = period
    schedule (seeded                                                 loan.balance -= due
    seq 1..term)                                                     loan.status = 'paid' at 0
                                    │
                                    └──► payroll_entry (kind='deduction', source='loan')   [§7 PENDING]
                                              │  schedule.idpayrollentry = entry.id
                                              ▼
                                  Payroll Processing → payroll_run_detail.loans            [§7 PENDING]
```

> [!NOTE]
> Today the ledger is the single source of truth for "how much has this loan been amortized". Nothing reaches the payroll run yet — `payroll_run_detail.loans` is still hard-coded to `0.00` in [ProcessPayrollHandler.php](../../../app/Handlers/Payroll/ProcessPayrollHandler.php) (§7.2).

---

## 3. Persistence

### 3a. `payroll_loan` — [migration](../../../database/migrations/2026_07_17_000001_create_payroll_loan_table.php) · [model](../../../app/Models/PayrollLoan.php)

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `idacct` | int, indexed | → `accounts.id` |
| `idloantype` | int, indexed | → `loantype.id` ([loan_types.md](./loan_types.md)) |
| `reference_no` | string nullable | lender/loan reference |
| `principal` | decimal(14,2) | total loan amount |
| `term_count` | int | number of amortizations |
| `amort_amount` | decimal(12,2) | per-period deduction |
| `balance` | decimal(14,2) | outstanding (starts = principal) |
| `start_period` | int, indexed | first `payroll_period.id` to deduct |
| `status` | string, default `active` | `active` \| `paid` \| `suspended` |
| `remarks` | string nullable | |
| `created_by` | int nullable | |
| `timestamps` | | |

Compound indexes for the two hot query patterns: `(idacct, status)` for the per-employee register, `(status, start_period)` for the generate sweep.

**Deletion is a hard delete**, not a `status` disable — guarded in the controller (see §6). The table has no `deleted_at` and the model does not use `SoftDeletes`.

### 3b. `payroll_loan_schedule` — the amortization ledger · [migration](../../../database/migrations/2026_07_17_000002_create_payroll_loan_schedule_table.php) · [model](../../../app/Models/PayrollLoanSchedule.php)

Not optional in practice: generation reads the **next unpaid schedule row** to decide the due amount, so the ledger is seeded up-front by `SaveLoanHandler` and drives the whole flow.

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `idloan` | unsignedBigInteger, indexed | → `payroll_loan.id` |
| `seq` | int | amortization number (1..term) |
| `idpayperiod` | int nullable | period it was applied to |
| `due_amount` | decimal(12,2) | rewritten to the actual amount on payment (final instalment may be smaller) |
| `paid` | tinyint default 0 | 0 = pending, 1 = paid |
| `idpayrollentry` | bigint nullable | → the generated `payroll_entry`; **reserved, always `null` until §7.1** |
| `timestamps` | | |

Compound indexes: `(idloan, idpayperiod)` for the idempotency check, `(idloan, seq)` for ordered ledger reads.

> [!NOTE]
> **Deviation from convention:** this migration declares a real `->foreign('idloan')->onDelete('cascade')` constraint. [project-profile](../../rules/project-profile.md) mandates zero DB-level FKs (index only, integrity enforced in the Query/Handler layer). Documented here as the current state; reconcile per §7.3.

---

## 4. Backend (Domain pattern)

Routes live in [routes/api/payroll.php](../../../routes/api/payroll.php), inside the portal's `Route::prefix('payroll')` group, on `PayrollEntriesController`:

```php
// NOTE: /loans/generate must be declared BEFORE the {id} routes, otherwise
//       Laravel matches 'generate' as a loan ID.
Route::post('/loans/generate',   [PayrollEntriesController::class, 'loanGenerate']);
Route::get('/loans',             [PayrollEntriesController::class, 'loanIndex']);
Route::post('/loans',            [PayrollEntriesController::class, 'loanStore']);
Route::put('/loans/{id}',        [PayrollEntriesController::class, 'loanUpdate']);
Route::delete('/loans/{id}',     [PayrollEntriesController::class, 'loanDestroy']);
Route::get('/loans/{id}/ledger', [PayrollEntriesController::class, 'loanLedger']);
```

Thin controller methods — static Query/Handler call inside `try/catch (Exception)`, raw `response()->json`, no API Resources. Validation is inline in the handlers (no FormRequest), matching the sibling payroll-entry features.

**Queries** (`app/Queries/Payroll/`)

- [`GetLoansQuery`](../../../app/Queries/Payroll/GetLoansQuery.php) — paginated register. Left-joins `accounts` + `loantype`, and counts paid schedule rows as **`paid_terms`** via `selectSub`. Filters: `search` (empid / `CONCAT(fname,' ',lname)` / `reference_no`), `idloantype`, `status`; page size from `per_page` (falls back to `entries`, default 10). The collection is reshaped to the frontend contract — nested `employee: {empid, fullname}` and `loan_type: {id, name, code, priority}`.
- [`GetLoanLedgerQuery`](../../../app/Queries/Payroll/GetLoanLedgerQuery.php) — one loan + its full schedule with running balance and period labels, returned as `{ loan, schedule }`.

**Handlers** (`app/Handlers/Payroll/`)

- [`SaveLoanHandler`](../../../app/Handlers/Payroll/SaveLoanHandler.php) — **issue only**. Requires `idacct`, `idloantype`, `principal`, `term_count`, `amort_amount`, `start_period`; rejects non-positive principal / term / amort. In one transaction: creates the loan with `balance = principal`, `status = 'active'`, then bulk-inserts the schedule `seq 1..term_count` at `amort_amount`, with the **last** row clamped to `min(amort_amount, principal - amort_amount * (term-1))` so the seeded dues sum to the principal.
- [`UpdateLoanHandler`](../../../app/Handlers/Payroll/UpdateLoanHandler.php) — **edit / suspend / resume**. Whitelists `reference_no`, `idloantype`, `amort_amount`, `start_period`, `remarks`, `status`; `status` may only be set to `active` or `suspended`; editing a `paid` loan is rejected. `principal` and `term_count` are **not** editable — reissue instead.
- [`GenerateLoanAmortizationsHandler`](../../../app/Handlers/Payroll/GenerateLoanAmortizationsHandler.php) — for a target period: loads `status='active'` loans with `start_period <= idperiod`, skips any loan that already has a paid schedule row for that period (**idempotent per loan+period**), takes the next unpaid row by `seq`, and deducts `min(row.due_amount, loan.balance)` rounded to 2dp. Per loan, in a transaction: sets `paid=1`, `idpayperiod`, and the actual `due_amount` on the row, decrements `loan.balance`, and flips `status='paid'` with `balance` clamped to exactly `0` when it reaches `<= 0`. Blocks with an exception when the period's `pay_process_status = 1`.
  - **`preview` param** — `execute(['idperiod' => N, 'preview' => true])` runs the same selection read-only and returns `{ items: [{idloan, empid, fullname, loan_type_name, amort_amount, balance}], total_amount }`. `preview = false` writes and returns `{ message, count }`. Both go through the one `POST /loans/generate` route.

---

## 5. Frontend Design

TS module at `module/payroll/payroll_entries/pages/loans/`, all wired to live HTTP:

```text
Loans.vue
api/loans.api.ts                     # useLoansApi()
composables/useLoans.ts              # reactive state + actions
types/types.loans.ts
components/LoansTable.vue
components/LoanFormModal.vue
components/LoanLedgerModal.vue
components/GenerateAmortizationsModal.vue
```

- **Loans list** — Employee, Loan Type (resolved), Reference, Principal, Amort/Period, **Balance** (emphasized), Terms (`paid_terms`/`term_count`), Status badge (`active`/`paid`/`suspended`), Actions (edit, suspend, ledger). `formatCurrency`; global `<Pagination>`, `<TableSkeleton>`, `<EmptyState>`. Filters: search, loan type, status.
- **Loan form modal** — employee, loan type, reference, principal, term_count, amort_amount (or derive `principal/term`), start period, remarks.
- **Ledger modal** — amortization schedule (seq, period, due, paid) with running balance.
- **Generate modal** — pick period → `previewGenerate` (loans that will deduct + total) → confirm → `generateAmortizations`; blocked server-side for closed periods.
- Rose accent (hub color); valid Tailwind tokens, dark mode.

**Dropdown sources** — the api hook reuses existing endpoints rather than adding new ones:

- `GET api/payroll/loanTypes` (`{ entries: 100, status: 1 }`) → normalized to `{id, name: desc, code}` for the loan-type select ([loan_types.md](./loan_types.md)).
- `GET api/payroll/payPeriod` (`{ entries: 200 }`) → period selects (start period, generate target).

**Convention gap:** unlike its sibling pages (`recurring_entries`, `batch_entries`, `service_charges`, `bonus_special`), this folder has **no `index.ts` barrel** — consumers import the composable/api by deep path. Add one when convenient (§7.4).

---

## 6. Edge Cases & Rules (as implemented)

- **Final amortization:** last deduction = `min(next due, balance)`; on reaching `<= 0` the balance is clamped to exactly `0` and `status='paid'`. Every amount is `round(…, 2)`.
- **Idempotent generate:** a loan with an already-paid schedule row for the target period is skipped, so re-running generate for a period never double-deducts. A loan whose rows are all paid is skipped too.
- **Suspend / resume:** generation only selects `status='active'`, so suspended loans skip the period entirely; resuming picks up at the next unpaid `seq` — the schedule is never back-filled for skipped periods (a suspension shifts the loan's remaining terms later, it does not shorten them).
- **Closed period:** generate throws when `payroll_period.pay_process_status = 1`.
- **Delete guard:** `loanDestroy` counts schedule rows with `paid=1` and refuses with *"Cannot delete: N amortization(s) have already been posted. Suspend the loan instead."*; only an untouched loan can be deleted, and its ledger goes with it via the migration's cascade. Editing a `paid` loan is likewise rejected.
- **Known limitation — editing `amort_amount` does not re-seed the schedule.** `UpdateLoanHandler` writes the new value on `payroll_loan`, but generation reads `payroll_loan_schedule.due_amount`, so unpaid rows keep the original dues and the change has no effect on the next deduction. Either re-seed unpaid rows on amort change, or make the field read-only after issuance — see §7.5.
- **Loan-type link:** `loan_type.priority` is carried through `GetLoansQuery` for display only. `loantype.idtrans` is not yet applied anywhere — it becomes the entry's `idtranstype`, and `priority` the deduction ordering, once §7.1 lands.

---

## 7. Pending Work

Everything below is specified but **not** in the codebase yet.

**7.1 Post each amortization as a `payroll_entry`.** In `GenerateLoanAmortizationsHandler`, inside the existing per-loan transaction, create `PayrollEntry` with `idacct`, `idpayperiod = idperiod`, `description` (loan type + reference), `kind = 'deduction'`, `source = 'loan'`, `source_ref = payroll_loan.id`, `idtranstype = loantype.idtrans`, `amount = deductionAmount`, `taxable = false`, `status = 1`; then store its id on `payroll_loan_schedule.idpayrollentry`. The `source_ref` / `idtranstype` columns already exist on `payroll_entry`. Mirror [`GenerateRecurringEntriesHandler`](../../../app/Handlers/Payroll/GenerateRecurringEntriesHandler.php), which does exactly this for `source='recurring'` — including extending the idempotency check to look for an existing `payroll_entry` on (period, `source='loan'`, `source_ref`).

**7.2 Route loan entries into `payroll_run_detail.loans`.** [`ProcessPayrollHandler`](../../../app/Handlers/Payroll/ProcessPayrollHandler.php) currently hard-codes `$hdmf_loan = 0.00; $sss_loan = 0.00; $loans = 0.00`, and its generic entry loop folds **every** `kind='deduction'` row into `$special_deductions` → `other_deductions`. Split `source='loan'` out of that loop into `$loans` (optionally sub-splitting HDMF / SSS by loan type) so the `loans` column of the run detail is populated and not double-counted in `other_deductions`. Deduction ordering follows `loantype.priority`.

**7.3 Drop the DB-level FK** on `payroll_loan_schedule.idloan` (§3b note) in favour of a plain `->index()`, per [project-profile](../../rules/project-profile.md). The migration is recent and unreleased, so edit it in place rather than adding an alter. Replace the lost `onDelete('cascade')` with an explicit schedule delete in the delete path.

**7.4 Add the `pages/loans/index.ts` barrel** re-exporting `useLoans`, `useLoansApi`, and the types, matching the sibling pages (§5).

**7.5 Resolve the `amort_amount` edit gap** (§6) — re-seed unpaid schedule rows on change, or lock the field after issuance.

**7.6 Tests** — PHPUnit: balance decrements per amortization, final-payment rounding lands on exactly 0, idempotent re-generate, suspended loans skipped, closed-period block, delete guard. Vitest: issue loan → ledger → preview → generate flow.

---

## 8. Build Order (historical)

Gate 1 hard-coded design (loans list + form + ledger + generate) → Gate 2 `payroll_loan` + `payroll_loan_schedule` tables/models, queries/handlers, routes, api swapped to live. **Both complete.** Gate 3 = §7.1 + §7.2, which is what actually connects loans to net pay; it depends on `payroll_entry` ([batch_entries.md](./batch_entries.md)) and the Loan Types master ([loan_types.md](./loan_types.md)).
