# Spec — Transaction Types (payroll master data)

> **Kind:** Redesign / migrate to the modern TS module + UI over the **existing** backend. Follows the canonical CRUD pattern in [chart_of_account.md](./chart_of_account.md).
> **Portal:** Payroll. **Route:** `payroll/transaction-types` (`payroll_transaction_types`) — already registered.
> **Current state:** legacy monolith [account_classification/pages/transaction_types/TransactionTypes.vue](../../../resources/views/web/src/module/payroll/account_classification/pages/transaction_types/TransactionTypes.vue).

---

## 1. Purpose

Transaction Types are the individual payroll earning/deduction items (e.g. Rice Allowance, SSS Loan). Each belongs to a **Transaction Class** and maps to one/more **Chart of Account** codes. Modernize the legacy CRUD page into the current TS module + clean UI, reusing the existing backend. Shared list/modal/upload/pagination behavior per [chart_of_account.md](./chart_of_account.md).

---

## 2. Backend Contract (EXISTING — reuse as-is)

Controller [TransactionTypesController](../../../app/Http/Controllers/payroll/TransactionTypesController.php), model [TransactionTypes](../../../app/Models/TransactionTypes.php) (table `transactiontype`). `apiResource('transactionTypes', ...)` + `POST uploadTransactionType`.

| Endpoint | Notes |
|---|---|
| `GET api/payroll/transactionTypes` | params: `desc` (like), `ttype_code` (id), `status`, `entries`; **joins** class + COA (alias `tt`); server-side paginated |
| `POST/PUT api/payroll/transactionTypes[/{id}]` | body: `code`, `ttype_desc`, `tclass` (→ `idclass`), `entrytype` (array → CSV), `coa` (→ `coaids`) |
| `DELETE api/payroll/transactionTypes/{id}` | |
| `POST api/payroll/uploadTransactionType` | Excel import |

**Model fields:** `code`, `desc`, `rate`, `isdef`, `idclass` (→ `transactionclass.id`), `entrytype` (comma-separated), `coaids` (→ `chartofaccounts.id`), `status`.
**List response:** `{ list, transtypes: <paginator>, filter, column }`. **Store response:** `{ success, message, tclass? }`; `code` + `desc` unique.

---

## 3. Target Files

Modern layout per [chart_of_account.md](./chart_of_account.md) §3: `TransactionTypes.vue` + `api/transaction_types.api.ts` (`useTransactionTypesApi`) + `composables/useTransactionTypes.ts` + `types/types.transaction_types.ts` + `components/{TransactionTypesTable, TransactionTypesFormModal, TransactionTypesUploadModal}.vue`.

---

## 4. Frontend Design (deltas)

- **Dropdown sources:** the form needs **Transaction Class** options (from [transaction_class.md](./transaction_class.md) — `GET api/payroll/transactionClass`) and **Chart of Account** options (from [chart_of_account.md](./chart_of_account.md) — `GET api/payroll/chartOfAccount`). Load these into the form modal.
- **Table columns:** Code, Description, Class (resolved `idclass` name), Entry Type(s) (render the CSV `entrytype` as chips), COA (resolved `coaids` code), Rate, Default (`isdef` badge), Status, Actions.
- **Form modal:** `code`, `ttype_desc`, `tclass` (class select), `entrytype` (multi-select → array; backend joins to CSV), `coa` (COA select); optionally `rate`, `isdef`. Inline required + unique validation; surface server `message`.
- **Filters:** search `desc`, `status`, `entries` — server-side, debounced.
- Server pagination, upload/duplicate handling, `StatusBadge`, `Modal`, valid Tailwind tokens, cyan accent per [chart_of_account.md](./chart_of_account.md).

---

## 5. Edge Cases & Build Order

- `entrytype` is **CSV in the DB** but a **multi-select array in the UI** — split on read, join on write (the controller already `implode`s an array).
- Resolve `idclass`/`coaids` to human labels in the table (use the joined fields the endpoint returns, or the dropdown maps).
- Validation via `success` flag; server-side pagination; delete confirmation; payroll-portal only.
- **Build order (design-first):** Gate 1 hard-coded design (incl. mock class/COA dropdowns) for review → Gate 2 wire the live `transactionTypes` apiResource + the class/COA option endpoints. Depends on Transaction Class + Chart of Account existing (they do). Transaction Types is itself a dropdown source for [loan_types.md](./loan_types.md).
