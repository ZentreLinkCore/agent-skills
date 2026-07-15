# Spec — Loan Types (payroll master data)

> **Kind:** Redesign / migrate to the modern TS module + UI over the **existing** backend. Follows the canonical CRUD pattern in [chart_of_account.md](./chart_of_account.md).
> **Portal:** Payroll. **Route:** `payroll/loan-types` (`payroll_loan_types`) — already registered.
> **Current state:** legacy monolith [account_classification/pages/loan_types/LoanTypes.vue](../../../resources/views/web/src/module/payroll/account_classification/pages/loan_types/LoanTypes.vue).

---

## 1. Purpose

Loan Types is the master list of loan/amortization kinds (Government / Company / Third Party) that payroll deducts from employees. Each loan type links to a **Transaction Type** for accounting. Modernize the legacy CRUD page into the current TS module + clean UI, reusing the existing backend. Shared behavior per [chart_of_account.md](./chart_of_account.md).

---

## 2. Backend Contract (EXISTING — reuse as-is)

Controller [LoanTypeController](../../../app/Http/Controllers/payroll/LoanTypeController.php), model [LoanTypes](../../../app/Models/LoanTypes.php) (table `loantype`). `apiResource('loanTypes', ...)` + `POST uploadLoanTypes`.

| Endpoint | Notes |
|---|---|
| `GET api/payroll/loanTypes` | params: `desc` (like), `loan_code` (id), `type`, `status`, `entries`; server-side paginated |
| `POST/PUT api/payroll/loanTypes[/{id}]` | body: `code`, `ltypes_desc`, `type`, `mode` (→ `loan_mode`), `trans_type` (→ `idtrans`), `priority`, `status` |
| `DELETE api/payroll/loanTypes/{id}` | |
| `POST api/payroll/uploadLoanTypes` | Excel import |

**Model fields:** `code`, `desc`, `type`, `loan_mode`, `priority`, `idtrans` (→ `transactiontype.id`), `status`.
**Enum (from controller):** `type` → `1` Government / `2` Company / `3` Third Party; `status` → `1` Active / `0` Disabled.
**List response:** `{ list, loantype: <paginator>, filter: { trans_type, loan_code }, column }` — the controller already decorates each row with `typename`, `trans_type` (resolved name), `statname`. **Store response:** `{ success, message, loantypes? }`; `code` + `desc` unique.

---

## 3. Target Files

Modern layout per [chart_of_account.md](./chart_of_account.md) §3: `LoanTypes.vue` + `api/loan_types.api.ts` (`useLoanTypesApi`) + `composables/useLoanTypes.ts` + `types/types.loan_types.ts` + `components/{LoanTypesTable, LoanTypesFormModal, LoanTypesUploadModal}.vue`.

---

## 4. Frontend Design (deltas)

- **Dropdown source:** the form needs **Transaction Type** options (from [transaction_types.md](./transaction_types.md) — `GET api/payroll/transactionTypes`) for `trans_type` (→ `idtrans`). The list endpoint's `filter.trans_type` / `filter.loan_code` can also seed filter dropdowns.
- **Table columns:** Code, Description, **Type** (`typename` — Government/Company/Third Party badge), Loan Mode, **Transaction Type** (`trans_type` resolved name), Priority, Status (`statname`), Actions. Prefer the controller-decorated fields (`typename`, `trans_type`, `statname`).
- **Form modal:** `code`, `ltypes_desc`, `type` (Government/Company/Third Party select), `mode`, `trans_type` (transaction-type select), `priority`, `status`. Inline required + unique validation; surface server `message`.
- **Filters:** search `desc`, `type` select, `loan_code`, `status`, `entries` — server-side, debounced.
- Server pagination, upload/duplicate handling, `StatusBadge`, `Modal`, valid Tailwind tokens, cyan accent per [chart_of_account.md](./chart_of_account.md).

---

## 5. Edge Cases & Build Order

- Render `type` via the `typename` label (badge), not raw 1/2/3.
- Validation via `success` flag; server-side pagination; delete confirmation; payroll-portal only.
- **Build order (design-first):** Gate 1 hard-coded design (incl. mock transaction-type dropdown) for review → Gate 2 wire the live `loanTypes` apiResource + the transaction-type option endpoint. Depends on Transaction Types existing (it does). Loan Types feed the Payroll Processing loan deduction ([timesheet_summary.md](./timesheet_summary.md) §6.3 Step 4).
