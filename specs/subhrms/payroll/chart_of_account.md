# Spec — Chart of Account (payroll master data)

> **Kind:** Redesign / migrate the **existing** feature to the modern TS module + modern UI. **Backend already exists** — do not rebuild it.
> **Portal:** Payroll (`payroll` namespace + URL prefix + module folder).
> **Current state:** Fully working **legacy monolith** page (~1,300 lines) at [account_classification/pages/chart_of_account/ChartOfAccount.vue](../../../resources/views/web/src/module/payroll/account_classification/pages/chart_of_account/ChartOfAccount.vue) using the old `@public/assets/css/payroll/main_payroll.css` + `page-content`/`Spinner` structure.
> **Conventions:** [.agents/rules/project-profile.md](../../rules/project-profile.md), [ui-design](../../rules/ui-design.md), [vue-standards](../../rules/vue-standards.md).

---

## 1. Purpose

Chart of Accounts (COA) is the master list of accounting codes that payroll transaction types map to. This spec **modernizes** the existing legacy CRUD page into the current per-feature TS structure with a clean, readable UI (valid Tailwind-v4 tokens, dark mode, payroll cyan accent), **reusing the existing backend endpoint unchanged**. This is a behavior-preserving redesign, not a new feature.

Route already registered ([account_classification.routes.ts](../../../resources/views/web/src/module/payroll/account_classification/route/account_classification.routes.ts)): path `payroll/chart-of-account`, name `payroll_chart_of_account`.

---

## 2. Backend Contract (EXISTING — reuse as-is)

Controller [ChartofAccountController](../../../app/Http/Controllers/payroll/ChartofAccountController.php), model [ChartofAccount](../../../app/Models/ChartofAccount.php) (table `chartofaccounts`). Registered as `apiResource('chartOfAccount', ...)` + `POST uploadChartOfAccount` inside the `payroll` group.

| Endpoint | Purpose |
|---|---|
| `GET api/payroll/chartOfAccount` | list — params: `desc` (matches `id`), `type` (like), `status`, `entries` (per-page). **Server-side paginated.** |
| `POST api/payroll/chartOfAccount` | create — body: `code`, `coa_desc`, `type` |
| `PUT api/payroll/chartOfAccount/{id}` | update — same fields |
| `DELETE api/payroll/chartOfAccount/{id}` | delete |
| `POST api/payroll/uploadChartOfAccount` | Excel import (multipart `file`); returns `{ success:false, duplicates }` on conflicts |

**Model fields:** `code`, `desc`, `type`, `status` (1 Active / 0 Disabled).
**List response shape:** `{ list: <total>, coa: <LengthAwarePaginator>, filter, column }`.
**Store/Update response:** `{ success: bool, message, coa? }`. Validation errors return `{ success:false, message:<validator errors> }` (note: **not** a 4xx — check `success`). `code` and `desc` are unique.
All writes already write an audit log via `HandleGlobal::insertTransLog`.

> **Do not** convert this controller to the Domain Query/Handler pattern — it is an existing fat controller shared with the legacy page. Match its request/response shape exactly.

---

## 3. Target Files (modern TS module)

Rebuild the page folder in the current structure (replace the legacy monolith):

```
resources/views/web/src/module/payroll/account_classification/pages/chart_of_account/
├── index.ts
├── ChartOfAccount.vue                 # page: header + toolbar + table + pagination
├── api/chart_of_account.api.ts        # useChartOfAccountApi() → the endpoints above
├── composables/useChartOfAccount.ts   # list state, server-side pagination, filters, CRUD actions
├── types/types.chart_of_account.ts    # ChartOfAccountRow, filters
└── components/
    ├── ChartOfAccountTable.vue        # rows w/ code, desc, type, status badge, edit/delete
    ├── ChartOfAccountFormModal.vue    # create/edit (code, desc, type)
    └── ChartOfAccountUploadModal.vue  # Excel import + duplicate report
```

Drop the `main_payroll.css` import; use Tailwind utilities only (valid tokens — no `slate-250/450/650/750`-style undefined shades, per the payslip redesign lesson).

---

## 4. Frontend Design

- **Header** — title + description + "Add Account" + "Import" buttons (cyan accent).
- **Toolbar/filter** — search (`desc`), `type` filter, `status` filter (Active/Disabled/All), `entries` per-page select. Filters hit the **server** (this endpoint paginates + filters server-side) — debounce search 300ms and refetch.
- **Table** (`ChartOfAccountTable.vue`) — columns: Code (mono), Description, Type, Status (`StatusBadge` Active/Disabled), Actions (edit/delete). Use global `<Pagination>` bound to the paginator meta (`coa.current_page`, `coa.last_page`, `coa.total`), `<TableSkeleton>`, `<EmptyState>`.
- **Form modal** — fields `code`, `coa_desc`, `type`; inline validation mirroring server rules (required, unique). Import `Modal` from `@/src/components/Modal.vue`. On save, POST/PUT, toast, refetch; surface server `message` on `success:false`.
- **Upload modal** — file picker → `uploadChartOfAccount`; render the returned `duplicates` list when `success:false`.
- **State (`composables/useChartOfAccount.ts`)** — `rows`, `pagination` (page/perPage/total from server), `filters`, `isLoading`, `fetchList()`, `save()`, `remove()`, `upload()`.

---

## 5. Edge Cases & Rules

1. **Server-side pagination/filtering** — do not client-slice; the endpoint returns a page. Reset to page 1 on filter change.
2. **Validation via `success` flag** — the store/update endpoints return `200` with `success:false` on validation failure; surface `message`, don't rely on HTTP status.
3. **Uniqueness** — `code` and `desc` must be unique; show the server error.
4. **Delete confirmation** — confirm modal before DELETE.
5. **Audit trail** — already handled server-side; no client action needed.
6. **Authorization** — payroll-portal only ([hrms-rules](../../rules/hrms-rules.md) §4).

---

## 6. Build Order (design-first)

**Gate 1 — `webkit.frontend-implement` (hard-coded, for review):** types + api returning **hard-coded** COA rows/paginator shape; composable + page + table + form/upload modals; review the modern design vs the legacy page. **Gate 2 — `webkit.backend-implement`:** swap the hard-coded api methods for the live `apiResource` calls above (backend already exists — no migration/model work). Tests: Vitest for the composable (pagination, filter refetch, save/delete). This is the template the other three `account_classification` redesigns follow ([transaction_class.md](./transaction_class.md), [transaction_types.md](./transaction_types.md), [loan_types.md](./loan_types.md)).
