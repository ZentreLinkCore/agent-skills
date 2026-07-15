# Spec — Bonus / Special (payroll entries)

> **Kind:** Greenfield (page is a 4-line placeholder; no backend yet).
> **Portal:** Payroll. **Route:** `payroll/bonus-special` (`payroll_bonus_special`) — already registered → [bonus_special/BonusSpecial.vue](../../../resources/views/web/src/module/payroll/payroll_entries/pages/bonus_special/BonusSpecial.vue).
> **Builds on the shared `payroll_entry` table** ([batch_entries.md](./batch_entries.md) §3a).
> **Conventions:** [.agents/rules/project-profile.md](../../rules/project-profile.md), [hrms-rules](../../rules/hrms-rules.md).

---

## 1. Purpose

**Bonus / Special** manages one-time incentives and special pay adjustments — performance bonuses, 13th-month pay, allowances, one-off deductions — applied to one or many employees for a pay period. Each becomes a `payroll_entry` (`source='bonus'`) that Payroll Processing folds into pay.

Hub description: *"Manage one-time incentives, 13th month pay, and other special pay adjustments."*

---

## 2. Data Flow

```text
Bonus run (name + transaction type + period)  ──► assign amounts to selected employees
  payroll_bonus_run (header)                          │  create one payroll_entry per employee
                                                      ▼
                                   payroll_entry (source='bonus', kind='earning'|'deduction')
                                                      ▼
                                   Payroll Processing → gross earnings (or other_deductions)
```

---

## 3. Persistence — `payroll_bonus_run` (header)

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `idpayperiod` | int, indexed | → `payroll_period.id` |
| `idtranstype` | int, indexed | → `transactiontype.id` (defines earning/deduction + taxability) |
| `name` | string | e.g. "2026 Mid-Year Bonus", "13th Month Pay" |
| `kind` | string | `earning` \| `deduction` (from the transaction type's class) |
| `mode` | string | `fixed` (same amount all) \| `per_employee` (individual amounts) |
| `total_amount` | decimal(14,2) | Σ posted entries |
| `headcount` | int | employees included |
| `status` | tinyint default 0 | `0` Draft / `1` Posted |
| `created_by` | int nullable | |
| `timestamps` | | |

The per-employee amounts are the produced **`payroll_entry`** rows (`source='bonus'`, `source_ref=run.id`).

---

## 4. Backend (Domain pattern)

Routes (inside `Route::prefix('payroll')`):
```php
Route::get('/bonus-special',              [PayrollEntriesController::class, 'bonusIndex']);    // runs + entries
Route::get('/bonus-special/candidates',   [PayrollEntriesController::class, 'bonusCandidates']); // selectable employees
Route::post('/bonus-special',             [PayrollEntriesController::class, 'bonusStore']);     // create run + entries
Route::put('/bonus-special/{id}',         [PayrollEntriesController::class, 'bonusUpdate']);
Route::delete('/bonus-special/{id}',      [PayrollEntriesController::class, 'bonusDestroy']);
```

- `GetBonusRunsQuery` — paginated bonus runs for the period (name, transaction type, headcount, total, status); a candidates query returns active employees (search/department) with optional bulk amount.
- `SaveBonusRunHandler` — in `DB::transaction`: create/update the `payroll_bonus_run` header + one `payroll_entry` per selected employee (`source='bonus'`, `kind` from the transaction type). `fixed` mode applies one amount to all; `per_employee` takes an amounts map. Recompute `total_amount`/`headcount`. Block if `pay_process_status = 1`.
- Delete cascades its `payroll_entry` rows. Thin controller, `try/catch`, JSON. No API Resources.

---

## 5. Frontend Design

TS module: `BonusSpecial.vue` + `api/bonus_special.api.ts` + `composables/useBonusSpecial.ts` + `types/types.bonus_special.ts` + `components/{BonusRunsTable, BonusRunFormModal, EmployeeAmountPicker}.vue`.

- **Runs list** — Name, Transaction Type, Kind badge, Headcount, Total (`formatCurrency`), Status (Draft/Posted), Actions (edit, delete). Filters: search name, transaction type, status. Global `<Pagination>`, `<TableSkeleton>`, `<EmptyState>`.
- **Run form modal** — period select, `name`, transaction-type select (from [transaction_types.md](./transaction_types.md)), `mode` (Fixed / Per-employee). Then an **employee picker** (searchable, multi-select, department filter) with either one shared amount (fixed) or an editable amount per row (per-employee). Live running total. Import `Modal`.
- **Post** — save creates/updates the run + entries; toast; disabled for closed periods.
- Emerald accent option (hub color) or payroll cyan; valid Tailwind tokens, dark mode.

---

## 6. Edge Cases, Testing & Build Order

- **13th-month relationship:** a 13th-month bonus can be entered here, but the statutory computation/review lives in [13th_month_pro_rate.md](./13th_month_pro_rate.md) and the dedicated 13th-month payroll run — keep the amount source consistent; don't double-pay.
- **Kind follows the transaction type:** earning vs deduction comes from the chosen transaction type's class — don't let the UI contradict it.
- **Fixed vs per-employee:** validate all amounts numeric/non-negative; `total_amount` = Σ entries.
- **Closed period:** block create/edit; delete cascades entries.
- **Testing:** PHPUnit — fixed vs per-employee entry creation, totals/headcount, kind from transaction type, closed-period block, delete cascade. Vitest — run form → employee picker → post flow.
- **Build order (design-first):** Gate 1 hard-coded design (runs list + form + employee-amount picker) → Gate 2 `payroll_bonus_run` table/model + queries/handler + routes, swap api to live. Depends on `payroll_entry` ([batch_entries.md](./batch_entries.md)) + transaction types.
