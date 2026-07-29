# Spec — Chart of Account (payroll master data)

> **Kind:** Redesign / migrate the **existing** feature to the modern TS module + modern UI. **Backend already exists** — do not rebuild it.
> **Portal:** Payroll (`payroll` namespace + URL prefix + module folder).
> **Current state:** Fully working **legacy monolith** page (1,300 lines) at [account_classification/pages/chart_of_account/ChartOfAccount.vue](../../../resources/views/web/src/module/payroll/account_classification/pages/chart_of_account/ChartOfAccount.vue) using the old `@public/assets/css/payroll/main_payroll.css` + `page-content`/`Spinner` structure.
> **Conventions:** [.agents/rules/project-profile.md](../../rules/project-profile.md), [ui-design](../../rules/ui-design.md), [vue-standards](../../rules/vue-standards.md).

---

## 1. Purpose

Chart of Accounts (COA) is the master list of accounting codes that payroll transaction types, overtime rates, and SAP codes map to (all three carry a `coaid`). This spec **modernizes** the existing legacy CRUD page into the current per-feature TS structure with a clean, readable UI (valid Tailwind-v4 tokens, dark mode, payroll cyan accent), **reusing the existing backend endpoints unchanged**. This is a behavior-preserving redesign, not a new feature.

Route already registered ([account_classification.routes.ts](../../../resources/views/web/src/module/payroll/account_classification/route/account_classification.routes.ts)): path `payroll/chart-of-account`, name `payroll_chart_of_account`. The sidebar has a single entry pointing at it ([useSidebarLinks.ts:364](../../../resources/views/web/src/composables/useSidebarLinks.ts)) — no route or sidebar edits are needed.

> [!IMPORTANT]
> **This page hosts TWO entities, not one.** The legacy page is a two-tab monolith — `currentTab` ([ChartOfAccount.vue:992](../../../resources/views/web/src/module/payroll/account_classification/pages/chart_of_account/ChartOfAccount.vue)) switches between **Chart of Account** (`api/payroll/chartOfAccount`) and **SAP Code** (`api/payroll/sapCodes`), each with its own table, add modal, filter modal, and Excel uploader. Both tabs are in scope for this redesign — dropping the SAP Code tab would delete a live feature. See §2b for its contract and §3 for the scope decision.

---

## 2. Backend Contract (EXISTING — reuse as-is)

Controller [ChartofAccountController](../../../app/Http/Controllers/payroll/ChartofAccountController.php), model [ChartofAccount](../../../app/Models/ChartofAccount.php) (table `chartofaccounts`). Registered as `apiResource('chartOfAccount', ...)` + `POST uploadChartOfAccount` inside the `payroll` group.

| Endpoint | Purpose |
|---|---|
| `GET api/payroll/chartOfAccount` | list — params: `desc` (**exact match on `id`**, not a text search), `type` (like), `status`, `entries` (per-page). **Server-side paginated.** |
| `POST api/payroll/chartOfAccount` | create — body: `code`, `coa_desc`, `type` (status forced to `1` server-side) |
| `PUT api/payroll/chartOfAccount/{id}` | update — body: `code`, `coa_desc`, `type`, **`status` (required — see the gotcha below)** |
| `DELETE api/payroll/chartOfAccount/{id}` | delete — **hard delete**, not a `status=0` disable |
| `POST api/payroll/uploadChartOfAccount` | Excel import (multipart `file`); returns `{ success:false, duplicates }` on conflicts |

**Model fields:** `code`, `desc`, `type`, `status` (1 Active / 0 Disabled).
**List response shape:** `{ list: <total>, coa: <LengthAwarePaginator>, filter, column }`. Each row is decorated server-side with **`statname`** (`'Active'` / `'Disable'`) — reuse it instead of re-deriving from `status`.
**Store/Update response:** `{ success: bool, message, coa? }`. Validation errors return `{ success:false, message:<validator errors> }` (note: **not** a 4xx — check `success`). `code` and `desc` are unique.
All writes already write an audit log via `HandleGlobal::insertTransLog`.

> [!CAUTION]
> **`update()` writes `status` unconditionally** — [ChartofAccountController.php:161](../../../app/Http/Controllers/payroll/ChartofAccountController.php) does `'status' => $request->status` with **no `has()` guard**. A `PUT` that omits `status` writes `NULL`, and the row then vanishes from the default list because `index()` falls back to `where('status', 1)` ([:42](../../../app/Http/Controllers/payroll/ChartofAccountController.php)). **The edit form must always send `status`.** Same bug shape in [SAPCodeController.php:171](../../../app/Http/Controllers/payroll/SAPCodeController.php).

**Do not** convert either controller to the Query/Handler pattern — they are existing fat controllers shared with the legacy page. Match their request/response shapes exactly.

### 2b. SAP Code contract (EXISTING — reuse as-is)

Controller [SAPCodeController](../../../app/Http/Controllers/payroll/SAPCodeController.php), model [SAPCodes](../../../app/Models/SAPCodes.php) (table `sapcodes`). Registered as `apiResource('sapCodes', ...)` + `POST uploadSapCodes` in the same `payroll` group ([routes/api/payroll.php:28-29](../../../routes/api/payroll.php)).

| Endpoint | Purpose |
|---|---|
| `GET api/payroll/sapCodes` | list — params: `desc` (**exact match on `coaid`** — filters by parent COA), `sap_code` (exact match on `id`), `status`, `entries`. **Server-side paginated.** |
| `POST api/payroll/sapCodes` | create — body: `sapcodes`, `sap_desc`, `coa` (→ stored as `coaid`) |
| `PUT api/payroll/sapCodes/{id}` | update — same fields + **`status`** |
| `DELETE api/payroll/sapCodes/{id}` | delete |
| `POST api/payroll/uploadSapCodes` | Excel import (multipart `file`); same `{ success:false, duplicates }` shape |

**Model fields:** `sapcodes`, `desc`, `coaid`, `status`.
**List response shape:** `{ list: <total>, sapcode: <LengthAwarePaginator>, filtersapcode, column }` — note the keys differ from COA (`sapcode`, `filtersapcode`). Rows are decorated with **`coa_desc`** (resolved parent COA description) and **`statname`**.
**Uniqueness:** `sapcodes` and `desc`.
**Filter options:** `filtersapcode.coa_desc` (COA options) + `filtersapcode.sap_code` (SAP options), both `{ id, text }`.

---

## 3. Target Files (modern TS module)

**Scope decision — SAP Code stays as a second tab in this same page.** Rationale: it preserves the legacy UX and the existing single route + single sidebar entry (a separate page would need a new route, a new sidebar link, and a nav decision), and in-page pill tabs are already an established pattern in the redesigned payroll module ([PayrollClosing.vue:13-44](../../../resources/views/web/src/module/payroll/payroll_closing/pages/PayrollClosing.vue)). The two entities keep **separate** api/composable/types/components so they stay independently testable. *Alternative if the user prefers:* split SAP Code into its own `pages/sap_code/` feature + its own spec and route — same components, different shell.

Rebuild the page folder in the current structure (replace the legacy monolith):

```text
resources/views/web/src/module/payroll/account_classification/pages/chart_of_account/
├── index.ts
├── ChartOfAccount.vue                 # shell: header + tab switcher, hosts both tab panels
├── api/
│   ├── chart_of_account.api.ts        # useChartOfAccountApi() → §2 endpoints
│   └── sap_code.api.ts                # useSapCodeApi()        → §2b endpoints
├── composables/
│   ├── useChartOfAccount.ts           # COA list state, server-side pagination, filters, CRUD
│   └── useSapCode.ts                  # SAP list state, same shape
├── types/
│   ├── types.chart_of_account.ts      # ChartOfAccountRow, payload, filters, response
│   └── types.sap_code.ts              # SapCodeRow, payload, filters, response
└── components/
    ├── ChartOfAccountTable.vue        # code, desc, type, status badge, edit/delete
    ├── ChartOfAccountFormModal.vue    # create/edit (code, coa_desc, type, status)
    ├── ChartOfAccountUploadModal.vue  # Excel import + duplicate report
    ├── SapCodeTable.vue               # sapcodes, desc, coa_desc, status badge, edit/delete
    ├── SapCodeFormModal.vue           # create/edit (sapcodes, sap_desc, coa, status)
    └── SapCodeUploadModal.vue         # Excel import + duplicate report
```

Drop the `main_payroll.css` import; use Tailwind utilities only (valid tokens — no `slate-250/450/650/750`-style undefined shades, per the payslip redesign lesson; note the `border-slate-250/20` in `PayrollClosing.vue` is exactly the mistake **not** to copy).

---

## 4. Frontend Design

- **Header** — title + description + "Add" + "Import" buttons (cyan accent). The action buttons act on the **active tab**.
- **Tab switcher** — pill tabs `Chart of Account` / `SAP Code`, active state `bg-cyan-600 text-white`, mirroring [PayrollClosing.vue](../../../resources/views/web/src/module/payroll/payroll_closing/pages/PayrollClosing.vue). Each tab owns its own composable instance; fetch a tab's list lazily on first activation.
- **Toolbar/filter** — filters hit the **server** (both endpoints paginate + filter server-side); reset to page 1 and refetch on change.
  - COA tab: **`desc` = a `CSelect` of COA descriptions, NOT a text input.** The backend does `where('id', '=', $desc)` and the options come from `HandleGlobal::getFilterChartofAccount()` as `{ id, text }`, surfaced in the response as `filter.coa_desc`. Bind the option's `id`. **No 300ms debounce is needed** — it's a select, not a search box. (The only free-text filter is `type`, which *is* a `like` match — debounce that one 300ms.) Plus `status` (Active/Disabled/All) and `entries` per-page.
  - SAP tab: `desc` = `CSelect` of parent COA (`filtersapcode.coa_desc`, matches `coaid`), `sap_code` = `CSelect` of SAP descriptions (`filtersapcode.sap_code`, matches `id`), `status`, `entries`.
- **Tables** — reuse the sibling [TransactionClassTable.vue](../../../resources/views/web/src/module/payroll/account_classification/pages/transaction_class/components/TransactionClassTable.vue) layout.
  - `ChartOfAccountTable.vue`: Code (mono), Description, Type, Status (`StatusBadge`, from the server's `statname`), Actions (edit/delete).
  - `SapCodeTable.vue`: SAP GL Code (mono), Description, Chart of Account (`coa_desc`), Status, Actions.
  - Global `<Pagination>` bound to the paginator meta (`coa.current_page/last_page/total`; `sapcode.*` for the SAP tab), plus `<TableSkeleton>` and `<EmptyState>`.
- **Form modals** — import `Modal` from `@/src/components/Modal.vue`. Inline validation mirroring server rules (required, unique). On save POST/PUT, toast, refetch; surface the server `message` when `success:false`.
  - `ChartOfAccountFormModal.vue`: `code`, `coa_desc`, `type`, **`status` (Active/Disable toggle, default `1`)**.
  - `SapCodeFormModal.vue`: `sapcodes`, `sap_desc`, `coa` (`CSelect` of COA options), **`status`** (same toggle).
  - **`status` is mandatory in the PUT payload** — see the §2 caution. Copy the toggle pattern from the shipped [TransactionClassFormModal.vue](../../../resources/views/web/src/module/payroll/account_classification/pages/transaction_class/components/TransactionClassFormModal.vue) (`form.status`, defaults to `1`, coerced with `Number()`).
- **Upload modals** — file picker → `uploadChartOfAccount` / `uploadSapCodes`; render the returned `duplicates` list when `success:false`.
- **State (`composables/useChartOfAccount.ts`, `useSapCode.ts`)** — `rows`, `pagination` (page/perPage/total from server), `filters`, `filterOptions` (from the response's `filter` / `filtersapcode`), `isLoading`, `fetchList()`, `save()`, `remove()`, `upload()`.

---

## 5. Edge Cases & Rules

1. **Server-side pagination/filtering** — do not client-slice; the endpoints return a page. Reset to page 1 on filter change.
2. **Validation via `success` flag** — the store/update endpoints return `200` with `success:false` on validation failure; surface `message`, don't rely on HTTP status. `message` is a **validator error bag** (object keyed by field), not a string — render per-field or flatten it.
3. **Always send `status` on update** — omitting it nulls the column and makes the row disappear from the default (`status=1`) list. See the §2 caution. This is the single highest-risk regression in this redesign.
4. **Uniqueness** — COA: `code` + `desc`. SAP: `sapcodes` + `desc`. Show the server error.
5. **Delete confirmation** — confirm modal before DELETE. Note `destroy()` is a **hard delete** on both endpoints (not the project's usual `status=0` disable), and **three tables carry a `coaid` pointing at `chartofaccounts.id` with no DB-level FK** — `sapcodes`, `transactiontype`, and `overtime_rates` — so deleting a referenced COA row leaves orphaned `coaid` values. Keep the existing behavior (this is a backend-reuse redesign), but make the confirm copy explicit that the delete is permanent.
6. **Tab state** — filters, pagination, and modals are per-tab; switching tabs must not leak one tab's filter state into the other.
7. **Dropped legacy features** — the legacy page also had Export-to-Excel, print layouts, and "download import template" per tab. The three already-shipped sibling redesigns ([transaction_class](../../../resources/views/web/src/module/payroll/account_classification/pages/transaction_class/TransactionClass.vue), transaction_types, loan_types) **dropped all three**, so this redesign follows suit for consistency. Flag it to the user at Gate 1 — payroll users did use the export.
8. **Audit trail** — already handled server-side; no client action needed.
9. **Authorization** — payroll-portal only ([hrms-rules](../../rules/hrms-rules.md) §4).

---

## 6. Build Order (design-first)

**Gate 1 — `webkit.frontend-implement` (hard-coded, for review):** types + api returning **hard-coded** rows matching the real paginator shapes (`{ list, coa, filter, column }` and `{ list, sapcode, filtersapcode, column }`); composables + page shell + tab switcher + both tables + both form/upload modals; review the modern design vs the legacy page's two tabs. **Gate 2 — `webkit.backend-implement`:** swap the hard-coded api methods for the live `apiResource` calls in §2/§2b (backend already exists — **no migration, model, controller, or route work**). Tests: Vitest for both composables (pagination, filter refetch, save/delete, and specifically that `save()` includes `status` in the PUT payload).

**Ordering note:** COA is the **last** of the four `account_classification` redesigns, not the template — [transaction_class](../../../resources/views/web/src/module/payroll/account_classification/pages/transaction_class/), [transaction_types](../../../resources/views/web/src/module/payroll/account_classification/pages/transaction_types/), and [loan_types](../../../resources/views/web/src/module/payroll/account_classification/pages/loan_types/) are already shipped in the modern structure. **Follow their conventions** ([transaction_class.md](./transaction_class.md), [transaction_types.md](./transaction_types.md), [loan_types.md](./loan_types.md)) — their `index.ts` barrel also re-exports the page itself (`export { default } from './ChartOfAccount.vue';`), which this spec's barrel should match. COA is the only one of the four with a second entity (SAP Code) in the same page, so it is a superset of their pattern rather than a copy of it.
