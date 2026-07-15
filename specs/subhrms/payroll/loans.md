# Spec — Loans (payroll entries)

> **Kind:** Greenfield (page is a 4-line placeholder; no backend yet).
> **Portal:** Payroll. **Route:** `payroll/loans` (`payroll_loans`) — already registered → [loans/Loans.vue](../../../resources/views/web/src/module/payroll/payroll_entries/pages/loans/Loans.vue).
> **Builds on the shared `payroll_entry` table** ([batch_entries.md](./batch_entries.md) §3a) and the **Loan Types** master ([loan_types.md](./loan_types.md)).
> **Conventions:** [.agents/rules/project-profile.md](../../rules/project-profile.md), [hrms-rules](../../rules/hrms-rules.md).

---

## 1. Purpose

**Loans** tracks employee loans (Government / Company / Third-Party — from the `loantype` master) and their **amortization** across pay periods. Each period, active loans generate a deduction `payroll_entry` that Payroll Processing subtracts as the `loans` component of net pay ([timesheet_summary.md](./timesheet_summary.md) §6.3 Step 4), decrementing the outstanding balance until the loan is paid.

Hub description: *"Track and deduct employee loan amortizations across the payroll cycle."*

---

## 2. Data Flow

```text
Loan issuance (CRUD)  ──► "Generate amortizations for period" ──► payroll_entry (kind='deduction', source='loan')
  payroll_loan            per active loan: due = amort_amount        │  decrement balance; mark 'paid' at 0
  (+ schedule)                                                       ▼
                                                    Payroll Processing → payroll_run_detail.loans
```

---

## 3. Persistence

### 3a. `payroll_loan`

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
| `status` | string | `active` \| `paid` \| `suspended` |
| `remarks` | string nullable | |
| `created_by` | int nullable | |
| `timestamps` | | |

### 3b. `payroll_loan_schedule` (optional but recommended — the amortization ledger)

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `idloan` | bigint, indexed | → `payroll_loan.id` |
| `seq` | int | amortization number (1..term) |
| `idpayperiod` | int nullable | period it was applied to |
| `due_amount` | decimal(12,2) | |
| `paid` | tinyint default 0 | |
| `idpayrollentry` | bigint nullable | → the generated `payroll_entry` |
| `timestamps` | | |

Deductions post as **`payroll_entry`** rows (`source='loan'`, `source_ref=payroll_loan.id`, `kind='deduction'`), which Processing routes into the `loans` column.

---

## 4. Backend (Domain pattern)

Routes (inside `Route::prefix('payroll')`):
```php
Route::get('/loans',                 [PayrollEntriesController::class, 'loanIndex']);       // loans list + balances
Route::post('/loans',                [PayrollEntriesController::class, 'loanStore']);       // issue a loan
Route::put('/loans/{id}',            [PayrollEntriesController::class, 'loanUpdate']);       // edit / suspend
Route::delete('/loans/{id}',         [PayrollEntriesController::class, 'loanDestroy']);
Route::get('/loans/{id}/ledger',     [PayrollEntriesController::class, 'loanLedger']);       // amortization schedule
Route::post('/loans/generate',       [PayrollEntriesController::class, 'loanGenerate']);     // amortizations for a period
```

- `GetLoansQuery` — paginated loans (+ resolved employee + loan-type name, `balance`, `status`), filters (employee, loan type, status).
- `SaveLoanHandler` — issue/edit a loan; on issue set `balance = principal`, optionally seed the `payroll_loan_schedule` (seq 1..term at `amort_amount`).
- `GenerateLoanAmortizationsHandler` — for a target period: for each `active` loan whose `start_period <= period`, create a deduction `payroll_entry` for `min(amort_amount, balance)`, decrement `balance`, mark the schedule row paid, set `status='paid'` when `balance <= 0`. **Idempotent** per (loan, period). Block if `pay_process_status = 1`.
- Thin controller, `try/catch`, JSON. No API Resources.

---

## 5. Frontend Design

TS module: `Loans.vue` + `api/loans.api.ts` + `composables/useLoans.ts` + `types/types.loans.ts` + `components/{LoansTable, LoanFormModal, LoanLedgerModal, GenerateAmortizationsModal}.vue`.

- **Loans list** — Employee, Loan Type (resolved), Reference, Principal, Amort/Period, **Balance** (emphasized), Terms (paid/total), Status badge (`active`/`paid`/`suspended`), Actions (edit, suspend, ledger). `formatCurrency`; global `<Pagination>`, `<TableSkeleton>`, `<EmptyState>`. Filters: employee, loan type, status.
- **Loan form modal** — employee, loan type (from [loan_types.md](./loan_types.md) — `GET api/payroll/loanTypes`), reference, principal, term_count, amort_amount (or derive `principal/term`), start period, remarks.
- **Ledger modal** — amortization schedule (seq, period, due, paid) with running balance.
- **Generate modal** — pick period → preview loans that will deduct + total → confirm → `loanGenerate`; disabled for closed periods.
- Rose accent option (hub color) or payroll cyan; valid Tailwind tokens, dark mode.

---

## 6. Edge Cases, Testing & Build Order

- **Final amortization:** last deduction = `min(amort_amount, balance)` so balance lands exactly at 0; then `status='paid'`.
- **Idempotent generate:** never double-deduct a loan for the same period.
- **Suspend:** suspended loans skip generation; resuming continues the schedule.
- **Closed period:** block generate; **deleting/suspending** a loan must not orphan already-posted period entries (handle via the schedule link).
- **Loan-type link:** carries `idtrans`/`priority` from the master ([loan_types.md](./loan_types.md)) for accounting + deduction ordering.
- **Testing:** PHPUnit — amortization decrements balance, final-payment rounding to 0, idempotent generate, suspend skip, closed-period block. Vitest — issue loan → ledger → generate flow.
- **Build order (design-first):** Gate 1 hard-coded design (loans list + form + ledger + generate) → Gate 2 `payroll_loan` (+ `payroll_loan_schedule`) tables/models + queries/handlers + routes, swap api to live. Depends on `payroll_entry` ([batch_entries.md](./batch_entries.md)) + Loan Types master.
