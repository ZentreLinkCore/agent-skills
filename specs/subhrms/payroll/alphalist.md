# Spec — BIR Alphalist (Schedule 1: Alphalist of Employees / Schedule 2: Alphalist of Minimum Wage Earners)

> **Kind:** Greenfield (both pages are 1-line placeholders). Reads the same annualization record as [bir_form_2316.md](./bir_form_2316.md); shares its data source with [year_end.md](./year_end.md).
> **Portal:** Payroll. **Routes (both already registered):**
> - `payroll/bir/schedule-1-alphalist-of-employees` (`payroll_bir_schedule_1_alphalist_of_employees`) → [alphalist_schedule_1/Schedule1AlphalistOfEmployees.vue](../../../resources/views/web/src/module/payroll/government_routines/pages/bir/alphalist_schedule_1/Schedule1AlphalistOfEmployees.vue)
> - `payroll/bir/schedule-2-alphalist-of-minimum-wage-earners` (`payroll_bir_schedule_2_alphalist_of_minimum_wage_earners`) → [alphalist_schedule_2/Schedule2AlphalistOfMinimumWageEarners.vue](../../../resources/views/web/src/module/payroll/government_routines/pages/bir/alphalist_schedule_2/Schedule2AlphalistOfMinimumWageEarners.vue)
> **Conventions:** [.agents/rules/project-profile.md](../../rules/project-profile.md) (Domain Query/Handler, no API Resources), [hrms-rules](../../rules/hrms-rules.md).

---

## 1. Purpose

The **Alphalist** is the aggregate annual roster of all employees' compensation and withholding tax, submitted to the BIR alongside the individual [BIR Form 2316](./bir_form_2316.md) certificates (typically as an attachment to BIR Form 1604-C). BIR splits it into two schedules with different eligibility and column sets:

- **Schedule 1 — Alphalist of Employees:** all regular (non-minimum-wage) employees subject to withholding tax, with their full compensation/deduction/tax breakdown.
- **Schedule 2 — Alphalist of Minimum Wage Earners (MWE):** employees classified as minimum wage earners, who are **fully exempt** from income tax on their basic pay, holiday pay, overtime, night differential, and hazard pay (per RA 9504 / NIRC Sec. 24(A)(2)(4)) — listed for BIR record-keeping even though they owe zero tax.

Both schedules are **read-only aggregations** over already-persisted [year_end.md](./year_end.md) output — no new payroll computation happens here.

---

## 2. Data Flow & Contract (read-only)

```text
ytd_details (one row per idacct, per year — written by ProcessYearEndHandler, see year_end.md)
   │
   ├── employee_type / MWE flag (needs a classification source — see Gap below)
   ▼
vw_accounts_details (TIN, fullname, address, civil_status, dependents — for the alphalist's identity columns)
   │
   ▼
SPLIT BY CLASSIFICATION:
   ├──► Schedule 1 (non-MWE): full compensation/deduction/tax columns per employee
   └──► Schedule 2 (MWE):      compensation columns only, tax columns forced to zero/exempt
   │
   ▼
ALPHALIST  ──►  per-schedule roster table  ──►  export (Excel/CSV — BIR's DAT-file format is a stricter future requirement, see §5)
```

**Sources (verified this session):**
- **Per-employee annualization** — `App\Models\YtdDetail` (table `ytd_details`), same row [bir_form_2316.md](./bir_form_2316.md) reads: `gross_amount`, `gov_contri`, `taxbasicsalary`, `tax_due`, `wtax`, `tax_refund`, `tax_payable`, `year`.
- **Employee identity** — `App\Models\AccountDetailVW` (view `vw_accounts_details`): `tin_no`, `fullname`, `address`, `civil_status`, `dependents`, `bdate`. Same access pattern as [GetThirteenthMonthPayRosterQuery](../../../app/Domain/Queries/Payroll/GetThirteenthMonthPayRosterQuery.php).
- **Employer header** (for the alphalist's own header/export filename) — `App\Models\Company` (table `company`, `id=1`), same as [bir_form_2316.md](./bir_form_2316.md) §2.

> [!CAUTION] **Gap — Minimum Wage Earner classification does not exist yet.** No model/column found anywhere in this codebase (`AccountDetailVW`, `AccountJob`, `Account`, `employee_status`) that flags an employee as a Minimum Wage Earner. `employee_type` (from `employee_status.type`, joined via `emptype_id`) is the closest candidate but its actual values were **not** confirmed against a definitive list during research — do not assume it already encodes "MWE" without checking `employee_status` table contents first. **Gate 2 must resolve this before Schedule 2 can be built**: either (a) confirm `employee_status.type` already has an MWE-equivalent value, or (b) add a boolean/flag column (e.g. `accounts.is_mwe` or an `employee_status` row dedicated to MWE) via a new migration — per [Anti-Hallucination](../../rules/anti-hallucination.md), do not invent this classification source without confirming it first. Until resolved, Schedule 2's roster query cannot be written correctly; Gate 1 (hard-coded design) can proceed using a placeholder boolean field, clearly flagged.

---

## 3. Target Files

Frontend (fill the already-registered stub folders; TS structure per [Project Profile](../../rules/project-profile.md)):
```
resources/views/web/src/module/payroll/government_routines/pages/bir/
├── alphalist_schedule_1/
│   ├── Schedule1AlphalistOfEmployees.vue      # replaces the 1-line stub
│   ├── index.ts
│   ├── api/alphalist_schedule_1.api.ts        # useAlphalistSchedule1Api()
│   ├── composables/useAlphalistSchedule1.ts
│   ├── types/types.alphalist_schedule_1.ts
│   └── components/AlphalistSchedule1Table.vue
└── alphalist_schedule_2/
    ├── Schedule2AlphalistOfMinimumWageEarners.vue  # replaces the 1-line stub
    ├── index.ts
    ├── api/alphalist_schedule_2.api.ts         # useAlphalistSchedule2Api()
    ├── composables/useAlphalistSchedule2.ts
    ├── types/types.alphalist_schedule_2.ts
    └── components/AlphalistSchedule2Table.vue
```
Both schedules share near-identical chrome (year selector, stat cards, export) but distinct table columns (§5) — keep them as **separate** composables/api files (matching the two already-separate registered routes/pages) rather than forcing one shared composable with branching, unless a clear common helper emerges during Gate 2 (e.g. a shared `alphalist.utils.ts` for the year-list fetch, since it's identical to [year_end.md](./year_end.md)'s `/year-end/years` shape and should reuse that endpoint rather than adding a third `/years` route — see Duplicate Prevention).

Backend (Domain pattern, extend the existing reports controller):
```
app/Domain/Queries/Payroll/GetAlphalistSchedule1Query.php   # NEW — non-MWE employees, full columns
app/Domain/Queries/Payroll/GetAlphalistSchedule2Query.php   # NEW — MWE employees, exempt columns
app/Http/Controllers/payroll/PayrollReportsController.php   # add alphalistSchedule1() + alphalistSchedule2() methods
routes/api/payroll.php → add under the existing "payroll reports" section:
    Route::get('/payroll-reports/alphalist/schedule-1', [PayrollReportsController::class, 'alphalistSchedule1']);
    Route::get('/payroll-reports/alphalist/schedule-2', [PayrollReportsController::class, 'alphalistSchedule2']);
```
Reuse `/api/payroll/year-end/years` (already built, see [year_end.md](./year_end.md)) for the year dropdown on both schedules instead of adding new `/years` endpoints — confirm this is acceptable at Gate 2 rather than duplicating.

---

## 4. Backend

**`GetAlphalistSchedule1Query::execute(['year' => int])`**
1. Resolve `year`.
2. Join `ytd_details` (`year = :year`) → `vw_accounts_details` (`idacct`), **excluding** employees classified as MWE (pending the classification-source Gap above).
3. Per employee: `empid`, `fullname`, `tin_no`, `address`, `civil_status`, `dependents`, `gross_amount`, `gov_contri` (broken into SSS/PhilHealth/Pag-IBIG sub-columns if the alphalist form requires them itemized — confirm against the actual BIR Alphalist column layout at Gate 2, do not assume a single combined figure is sufficient), `taxbasicsalary`, `tax_due`, `wtax`, `tax_refund`, `tax_payable`.
4. Return `{ year, years: [...], employees: [...], totals: { gross, tax_due, wtax, ... }, count }` — mirror [ytd_report.md](./ytd_report.md) §5.3's totals-footer shape.

**`GetAlphalistSchedule2Query::execute(['year' => int])`**
1. Same join, **filtered to** MWE-classified employees only.
2. Per employee: identity columns only + `gross_amount` (basic pay + statutory OT/holiday/night-diff/hazard components, all exempt) — tax columns (`tax_due`, `wtax`, `tax_refund`, `tax_payable`) are **not applicable** and should render as `0`/`null` with an explicit "Exempt" indicator, not be omitted from the response shape (frontend needs a consistent column even if always zero, to match the official form layout).
3. Return the same envelope shape as Schedule 1 for consistency, with `totals` reflecting only the exempt-compensation aggregate (no tax totals).

**Response shape parity:** Gate 1's hard-coded `api/alphalist_schedule_{1,2}.api.ts` objects must match these query outputs field-for-field once wired live.

---

## 5. Frontend Design

- **Shared chrome (both schedules):** header (breadcrumb `Payroll / Government Routines / BIR / Schedule N`), **year** select (reusing the Year End years list), stat cards (Headcount / Total Gross / Total Tax Due for Schedule 1; Headcount / Total Exempt Compensation for Schedule 2), **Export** button. Cyan accent (Payroll portal), dark mode, wide table in its own `overflow-x-auto` (per [UI & Design Standards](../../rules/ui-design.md)).
- **Schedule 1 table** (`AlphalistSchedule1Table.vue`): Employee (name/TIN), Address, Civil Status, Dependents, Gross Compensation, Non-Taxable/Exempt, Taxable Compensation, Tax Due, Tax Withheld, Refund/Payable — the full per-employee breakdown, sortable/searchable like [ytd_report.md](./ytd_report.md)'s table.
- **Schedule 2 table** (`AlphalistSchedule2Table.vue`): Employee (name/TIN), Address, Basic Pay, Holiday/OT/Night-Diff/Hazard components (all exempt), Total Exempt Compensation — **no tax columns rendered as data-bearing**; show a static "Exempt (RA 9504)" badge instead of a `StatusBadge` status, since MWE status isn't a workflow state.
- **Export:** `maatwebsite/excel` **is already a project dependency** (used elsewhere for CSV/XLSX *imports* only — no export usage exists yet, confirmed this session) — introducing an `Excel::download()` export class for these two schedules follows an established package, not a new one. Note: BIR's actual Alphalist submission format is a specific fixed-format `.DAT`/text file (validated by BIR's own Alphalist Data Entry and Validation Module) — an Excel export satisfies internal review/audit needs; producing the BIR-compliant `.DAT` format is a distinct, more rigid follow-up not in this spec's initial scope (flag to the user before building it, since the exact field-by-field BIR layout needs to be sourced from the official BIR Alphalist format, not guessed).
- **Design-First (Gate 1):** hard-code both `api/alphalist_schedule_*.api.ts` files with realistic rows (Schedule 1: a mix of refund/collectible employees; Schedule 2: a few MWE rows with zeroed tax columns) — no live calls, per [Project Profile](../../rules/project-profile.md).

---

## 6. Edge Cases, Testing & Build Order

- **MWE classification source unresolved (see Gap in §2):** Gate 1 can proceed with a hard-coded boolean; Gate 2 is **blocked** on resolving the real classification column/value before `GetAlphalistSchedule2Query` can filter correctly — do not guess a column name.
- **MWE who receives additional taxable pay (e.g. commission) beyond exempt statutory items:** per BIR rules, becomes taxable on the excess and may need to appear on **both** schedules, or move to Schedule 1 entirely depending on how the business wants to handle it — confirm with the user/HRMS domain owner before implementing; do not silently pick one interpretation.
- **Employee not yet processed for the year:** excluded from both schedules (same rule as [bir_form_2316.md](./bir_form_2316.md) — no `ytd_details` row means no finalized figure to report).
- **Previous employer substituted filing:** Schedule 1's totals should reflect the same current-employer-only scope as `ytd_details` until the prev_* merge (deferred per [year_end.md](./year_end.md)) is built; do not double-count.
- **Testing:** PHPUnit — Schedule 1 excludes MWE rows, Schedule 2 includes only MWE rows with zeroed tax fields, totals footer arithmetic, year filter. Vitest — year switch on both pages, table rendering, export trigger (mock the download, don't assert file bytes).
- **Build order (design-first):** Gate 1 hard-coded design for both schedules (this spec) → **resolve the MWE classification gap** (a short scoping conversation, possibly a small migration) → Gate 2 `GetAlphalistSchedule1Query`/`GetAlphalistSchedule2Query` + routes + Excel export, wire live. Hard dependency: [year_end.md](./year_end.md) fully processed (real `ytd_details` rows) for any real data to aggregate.
