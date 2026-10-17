# Spec — BIR Form 2316 (Certificate of Compensation Payment / Tax Withheld)

> **Kind:** Greenfield (page is a 1-line placeholder). Reads the annualization record produced by [year_end.md](./year_end.md); reuses the roster+detail split from [payslip.md](./payslip.md).
> **Portal:** Payroll. **Route:** `payroll/bir/bir-form-2316` (`payroll_bir_bir_form_2316`) — already registered → [bir_form_2316/BIRForm2316.vue](../../../resources/views/web/src/module/payroll/government_routines/pages/bir/bir_form_2316/BIRForm2316.vue).
> **Conventions:** [.agents/rules/project-gate.md](../../../rules/core/project-gate.md) (Domain Query/Handler, no API Resources), [hrms-rules](../../../rules/conditional/payroll.md).

---

## 1. Purpose

**BIR Form 2316** is the annual "Certificate of Compensation Payment / Tax Withheld" every employer must issue to each employee (and file with the BIR) for a calendar year. It presents, per employee: employer identity (TIN/RDO/address), employee identity (TIN/address/civil status/dependents), total compensation earned, non-taxable exclusions, taxable compensation income, the annualized tax due, tax withheld, and the resulting refund/collectible — i.e. a formatted, printable/exportable rendering of the record [year_end.md](./year_end.md) already computes and persists.

It reads **only already-persisted data** — it does not recompute payroll or tax. It is a presentation/export layer over [ytd_details](../../../app/Models/YtdDetail.php).

---

## 2. Data Flow & Contract (read-only)

```text
ytd_details (one row per idacct, written by ProcessYearEndHandler — see year_end.md)
   │  gross_amount, gov_contri, taxbasicsalary, tax_due, wtaxjannov, wtaxdec, wtax,
   │  tax_refund, tax_payable, prev_* (previous-employer figures, if declared)
   ▼
company (id=1 — employer TIN/RDO/registered name/address)
   │
   ▼
vw_accounts_details (employee TIN, birth date, civil status, dependents, address)
   │
   ▼
payroll_run_detail (cycle='13th', filtered by payroll_period.year_end = :year)
   │  13th-month/other-benefits non-taxable vs taxable split (breakdown_json.non_taxable / .taxable)
   ▼
BIR FORM 2316  ──►  per-employee roster (processed year-end employees) ──►  single-employee certificate view/print/PDF
```

**Sources (verified this session, do not re-derive):**
- **Employer header** — `App\Models\Company` (table `company`, single row `id = 1`): `idbir` (employer TIN), `rdo`, `employername` (registered name for BIR filings — distinct from the trade name `companyname`), `addr_bldg/addr_street/addr_brgy/addr_city/addr_prov/addr_code`. Reuse `Company::getCompanyInfoPrint()` as the address-concatenation pattern, or select the same columns directly if the certificate needs them un-concatenated (form has separate address lines). Already exposed read-only via `GET /companyProfile` (`hr\CompanyProfileController@index`, `routes/api/hr.php`) — reuse that endpoint rather than adding a duplicate company-read route in the payroll portal.
- **Employee header** — `App\Models\AccountDetailVW` (view `vw_accounts_details`, sourced from `accounts`): `tin_no`, `tin_date`, `bdate`, `birth_place`, `civil_status`, `dependents`, `spouse`, `nationality`, `address` (pre-computed current/permanent selection), `fullname`, `hire_date`, `separation_date`. Same access pattern already used in [GetThirteenthMonthPayRosterQuery](../../../app/Domain/Queries/Payroll/GetThirteenthMonthPayRosterQuery.php) (`AccountDetailVW::leftJoin('employee_status', ...)`).
- **Annualization figures** — `App\Models\YtdDetail` (table `ytd_details`), one row per `idacct`: `gross_amount` (YTD gross), `gov_contri` (SSS+PhilHealth+Pag-IBIG), `taxbasicsalary`/`totaltaxcompincome` (taxable income), `bracket_min`/`fixed_tax`/`rate`/`excess`/`tox` (BIR bracket trace), `tax_due` (annual tax due), `wtaxjannov`/`wtaxdec`/`wtax` (withholding split + total), `tax_refund`/`tax_payable` (the final adjustment, mutually exclusive — see [year_end.md](./year_end.md) §3). `prev_*` columns hold a declared previous employer's figures (see §5 substituted-filing note below) when [HandleAccountDetails::handlePreviousEmployerUpdate](../../../app/Domain/Handlers/AccountDetail/HandleAccountDetails.php) has been used for that employee.
- **13th-month / other benefits line** — `payroll_run_detail` filtered `payroll_run.cycle = '13th'` joined `payroll_period.year_end = :year` (see [13th_month_pay.md](./13th_month_pay.md)): `breakdown_json.non_taxable` (exempt portion, capped at ₱90,000) and `breakdown_json.taxable` (excess over ₱90,000, already folded into `ytd_details.taxbasicsalary` by whichever process merges it — confirm at Gate 2 whether `ytd_details.max90k`/`nontaxsof` need populating from this source; they are currently left at their column defaults per [year_end.md](./year_end.md), a known gap this spec's Gate 2 should close, not re-guess).
- **Related but distinct:** `Attachment` (table `attachments`, `doc_type = 'BIR 2316'`) is an **upload** of an employee's *previous* employer's 2316 document (gate in `HandleAccountDetails::handlePreviousEmployerUpdate`) — not the same as this feature, which *generates* the *current* employer's 2316. Do not conflate the two; do not touch the `Attachment` upload gate.
- **Related stub, out of scope:** `payroll_bir_employer_details` (`government_routines/pages/bir/employer_details/EmployerDetails.vue`) is presumably meant to let HR view/edit the `Company` row for BIR purposes, but is a separate placeholder page/feature. This spec only *reads* `Company` via the existing `/companyProfile` endpoint; it does not build the employer-details editor.

---

## 3. Target Files

Frontend (fill the already-registered stub folder; TS structure per [Project Profile](../../../rules/core/project-gate.md) since nothing else in `government_routines` establishes a competing convention yet):
```
resources/views/web/src/module/payroll/government_routines/pages/bir/bir_form_2316/
├── BIRForm2316.vue                    # replaces the 1-line stub
├── index.ts
├── api/bir_form_2316.api.ts           # useBirForm2316Api()
├── composables/useBirForm2316.ts      # year + roster + selected-employee certificate state
├── types/types.bir_form_2316.ts
└── components/
    ├── BirForm2316RosterTable.vue     # Employee, TIN, YTD Taxable, Tax Due, Refund/Payable, Status
    └── BirForm2316Certificate.vue     # the actual per-employee 2316 layout (print/export target)
```
`government_routines/index.ts` and `government_routines/route/government_routines.routes.ts` already export/register this page — do not touch the route file (path/name already correct); only add the new barrel exports for this feature's composable/api/types alongside whatever `index.ts` already contains.

Backend (Domain pattern, extend the existing reports controller — do not create a new controller):
```
app/Domain/Queries/Payroll/GetBir2316RosterQuery.php   # NEW — list employees with a processed year_end run for :year
app/Domain/Queries/Payroll/GetBir2316CertificateQuery.php  # NEW — single-employee full certificate (employer+employee+ytd_details+13th month line)
app/Http/Controllers/payroll/PayrollReportsController.php  # add bir2316Roster() + bir2316Detail() methods
routes/api/payroll.php → add under the existing "payroll reports" section:
    Route::get('/payroll-reports/bir-2316/roster', [PayrollReportsController::class, 'bir2316Roster']);
    Route::get('/payroll-reports/bir-2316/detail', [PayrollReportsController::class, 'bir2316Detail']);
```

---

## 4. Backend

**`GetBir2316RosterQuery::execute(['year' => int])`**
1. Resolve `year` (default current calendar year).
2. Join `ytd_details` → `vw_accounts_details` (on `idacct`) for rows where `ytd_details.year = :year` — these are the employees Year End has actually processed (no row = not yet annualized for that year; do **not** silently compute a preview here, unlike the Year End roster — 2316 issuance requires a finalized figure).
3. Per employee: `empid`, `fullname`, `tin_no`, `unit`/`position`, `taxbasicsalary`, `tax_due`, `tax_refund`, `tax_payable`, `wtax`, plus an `is_finalized` flag (true once the `year_end` `payroll_run.status = 1`, mirroring the `pay_processed` gate in [GetYearEndRosterQuery](../../../app/Domain/Queries/Payroll/GetYearEndRosterQuery.php)).
4. Return `{ year, years: [distinct ytd_details.year], employees: [...], count }`.

**`GetBir2316CertificateQuery::execute(['empid' => string, 'year' => int])`**
1. Load the single `ytd_details` row (`idacct` resolved from `empid` via `vw_accounts_details`) for `:year`.
2. Load employer header from `Company::where('id', 1)->first()` (or call the existing `/companyProfile` contract directly if the frontend prefers two calls — Gate 2 should confirm whether to bundle employer data into this response or let the frontend fetch `/companyProfile` separately; bundling avoids a second round trip and is preferred unless the existing endpoint already caches well).
3. Load employee header from `AccountDetailVW::where('empid', $empid)->first()`.
4. Load the year's 13th-month `payroll_run_detail` row (`cycle='13th'`, `payroll_period.year_end = :year`) for the "13th month pay and other benefits" line — surface both `breakdown_json.non_taxable` and `.taxable`.
5. If `ytd_details.prev_employername` is non-null, surface the `prev_*` block as a distinct "previous employer" section on the certificate (substituted filing) — **do not** merge its figures into `taxbasicsalary`/`tax_due` here; that merge is [year_end.md](./year_end.md)'s Gate 2 responsibility (flagged there as deferred), not this read-only certificate query's.
6. Return one flat object combining employer + employee + annualization + 13th-month line, shaped to match the frontend's Gate-1 hard-coded certificate object 1:1.

**Response shape parity:** whatever hard-coded object `BirForm2316Certificate.vue`'s Gate-1 build renders from must be exactly what `GetBir2316CertificateQuery` returns — no renamed/missing fields.

---

## 5. Frontend Design

- **Roster page** (`BIRForm2316.vue`) — header (breadcrumb `Payroll / Government Routines / BIR / Form 2316`, Slate/Payroll accent per portal), **year** select (from `years`), stat cards (Headcount Certified / Total Refunds / Total Collectibles — mirror [year_end.md](./year_end.md) §4's stat pattern), roster table (`BirForm2316RosterTable.vue`: Employee, TIN, Taxable Income, Tax Due, Refund/Payable, Status), row action → **View Certificate** (opens `BirForm2316Certificate.vue` — a routed detail view or in-page panel, follow whichever pattern is cheaper given no dedicated Reports sibling exists yet for this feature, unlike 13th Month's Prooflist precedent).
- **Certificate view** (`BirForm2316Certificate.vue`) — laid out to mirror the actual BIR 2316 form sections: Part I (Employee Information: TIN, name, address, birth date, civil status, dependents), Part II (Employer Information: TIN, RDO, registered name, address), Part IV-A (Summary: gross compensation, non-taxable/exempt, taxable compensation, tax due, tax withheld, refund/payable — pulling `gross_amount`, `gov_contri`, `taxbasicsalary`, `tax_due`, `wtax`, `tax_refund`/`tax_payable`), and a 13th-month/other-benefits line item. Cyan accent (Payroll portal, matching [year_end.md](./year_end.md)/[13th_month_pay.md](./13th_month_pay.md)), dark mode, printable layout (`@media print` friendly — hide chrome/nav, keep the form body).
- **Export/Print:** no PDF library exists yet in this project (`composer.json` has neither `barryvdh/laravel-dompdf` nor `mpdf`/`tcpdf`) — flag this as a **new backend dependency** to add at Gate 2 if a pixel-accurate downloadable PDF is required; the browser's native print (`window.print()` over the `@media print`-styled certificate) is a zero-dependency fallback for Gate 1/early Gate 2 and may be sufficient if the user doesn't need an official downloadable PDF immediately.
- **Design-First (Gate 1):** hard-code `api/bir_form_2316.api.ts`'s `getRoster`/`getCertificate` with realistic values shaped after the fields above (seed a mix of refund/collectible/zero-adjustment rows, at least one row with a populated `prev_*` block to exercise the substituted-filing section) — no live calls, per [Project Profile](../../../rules/core/project-gate.md)'s design-first flow.

---

## 6. Edge Cases, Testing & Build Order

- **Employee not yet processed for the year:** no `ytd_details` row → excluded from the roster (not shown with zeroed placeholders, unlike Year End's own roster which previews unprocessed rows) — a 2316 cannot be issued for a figure that hasn't been finalized.
- **Previous employer declared (substituted filing):** show the `prev_*` block distinctly; do not silently sum it into the current-employer totals until [year_end.md](./year_end.md)'s merge logic is built.
- **Minimum Wage Earner (MWE):** fully tax-exempt regardless of amount (see [alphalist.md](./alphalist.md) §5) — certificate should still generate (all monetary tax fields render as zero/exempt), not be blocked.
- **Separated employee mid-year:** certificate should still be issuable using whatever YTD figures exist at separation (Final Pay's own annualization, not this Year End roster's scope — confirm with Final Pay's spec if separated employees need a distinct 2316 generation path).
- **Testing:** PHPUnit — `GetBir2316RosterQuery` only returns employees with a `ytd_details` row for the year; `GetBir2316CertificateQuery` shape parity against the frontend contract; previous-employer section only appears when `prev_employername` is set. Vitest — year switch, roster→certificate navigation, print layout renders without console errors.
- **Build order (design-first):** Gate 1 hard-coded roster + certificate view (this spec) → Gate 2 `GetBir2316RosterQuery` + `GetBir2316CertificateQuery` + routes, decide on PDF dependency, wire live. Hard dependency: [year_end.md](./year_end.md) must be fully processed (real `ytd_details` rows) before this feature has real data to show.
