# Spec — Transaction Class (payroll master data)

> **Kind:** Redesign / migrate to the modern TS module + UI over the **existing** backend. Follows the canonical CRUD pattern in [chart_of_account.md](./chart_of_account.md).
> **Portal:** Payroll. **Route:** `payroll/transaction-class` (`payroll_transaction_class`) — already registered.
> **Current state:** legacy monolith [account_classification/pages/transaction_class/TransactionClass.vue](../../../resources/views/web/src/module/payroll/account_classification/pages/transaction_class/TransactionClass.vue).

---

## 1. Purpose

Transaction Class groups payroll transaction types into taxable/non-taxable earning/deduction classes. Modernize the legacy CRUD page into the current TS module + clean UI, **reusing the existing backend endpoint unchanged** (see [chart_of_account.md](./chart_of_account.md) §4–§6 for the shared list/modal/upload/pagination pattern — apply it here with the fields below).

---

## 2. Backend Contract (EXISTING — reuse as-is)

Controller [TransactionClassController](../../../app/Http/Controllers/payroll/TransactionClassController.php), model [TransactionClass](../../../app/Models/TransactionClass.php) (table `transactionclass`). `apiResource('transactionClass', ...)` + `POST uploadTransactionClass`.

| Endpoint | Notes |
|---|---|
| `GET api/payroll/transactionClass` | params: `desc` (like), `tclass_code` (id), `istax`, `transtype`, `status`, `entries`; server-side paginated |
| `POST/PUT api/payroll/transactionClass[/{id}]` | body: `code`, `tclass_desc`, `istax`, `transtype` |
| `DELETE api/payroll/transactionClass/{id}` | |
| `POST api/payroll/uploadTransactionClass` | Excel import |

**Model fields:** `code`, `desc`, `istax`, `transtype`, `status`.
**Enums (from controller):** `istax` → `0` Non-taxable / `1` Taxable; `transtype` → `0` Deductions / `1` Earnings; `status` → `1` Active / `0` Disabled.
**List response:** `{ list, transclass: <paginator>, filter, column }`. **Store response:** `{ success, message, tclass? }` — validate via `success` flag; `code` + `desc` unique.

---

## 3. Target Files

Same modern layout as [chart_of_account.md](./chart_of_account.md) §3, named for this feature:
`TransactionClass.vue` + `api/transaction_class.api.ts` (`useTransactionClassApi`) + `composables/useTransactionClass.ts` + `types/types.transaction_class.ts` + `components/{TransactionClassTable, TransactionClassFormModal, TransactionClassUploadModal}.vue`.

---

## 4. Frontend Design (deltas vs the canonical pattern)

- **Table columns:** Code, Description, **Tax** (Taxable/Non-taxable badge from `istax`), **Type** (Earnings/Deductions badge from `transtype`), Status, Actions.
- **Filters:** search `desc`, `istax` select, `transtype` select, `status` select, `entries`. Server-side, debounced.
- **Form modal:** `code`, `tclass_desc`, `istax` (radio/select 0/1), `transtype` (radio/select 0/1). Inline required + unique validation; surface server `message`.
- Everything else (server pagination, upload/duplicate handling, `StatusBadge`, `Modal`, valid Tailwind tokens, cyan accent) per [chart_of_account.md](./chart_of_account.md).

---

## 5. Edge Cases & Build Order

- Render the `istax`/`transtype` **enums as labeled badges**, not raw 0/1.
- Validation via `success` flag; server-side pagination; delete confirmation; payroll-portal only. See [chart_of_account.md](./chart_of_account.md) §5.
- **Build order (design-first):** Gate 1 hard-coded design (types/api/composable/page/modals) for review → Gate 2 wire the existing `transactionClass` apiResource. Transaction Class is a **dropdown source** for [transaction_types.md](./transaction_types.md).
