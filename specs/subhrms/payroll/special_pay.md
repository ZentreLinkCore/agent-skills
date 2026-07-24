# Spec — Special Pay (payroll processing cycle)

> **Kind:** Greenfield (page is a 4-line placeholder). A **sibling cycle** of Regular Cycle — reuses the same processing infrastructure defined in [timesheet_summary.md](./timesheet_summary.md).
> **⚠️ Hard dependency — cannot start yet:** the earnings source (`payroll_entry` table) does **not exist** in the system (only a `// → payroll_entry.id (future)` reference in the loan-schedule migration). This spec is **blocked** until the `payroll_entry` table is built ([batch_entries.md](./batch_entries.md)) and the special-earnings producer is in place ([bonus_special.md](./bonus_special.md)). Build those first.
> **Portal:** Payroll. **Route:** `payroll/special-pay` (`payroll_special_pay`) — already registered → [special_pay/SpecialPay.vue](../../../resources/views/web/src/module/payroll/payroll_processing/pages/special_pay/SpecialPay.vue).
> **`payroll_run.cycle = 'special'`** (the `payroll_run` table already carries a `cycle` column, unique per `(idpayperiod, cycle)`).
> **Conventions:** [.agents/rules/project-profile.md](../../rules/project-profile.md), [hrms-rules](../../rules/hrms-rules.md).

---

## 1. Purpose

**Special Pay** is an **off-cycle** payroll run for ad-hoc disbursements outside the regular cutoff — mid-cycle bonuses, incentives, special allowances, correction pay — for a selected pay period. It reuses the Regular Cycle roster → process → `payroll_run`/`payroll_run_detail` → closing → payslip flow, but the earnings come from **Bonus/Special + special payroll entries** rather than timesheet hours.

---

## 2. Data Flow (delta vs Regular Cycle)

```text
Bonus/Special + special payroll_entry rows (source='bonus'/'manual', period)
        │
        ▼
SPECIAL PAY  ── roster of employees WITH special entries for the period
             ── process: sum special earnings − applicable deductions → net
             ──►  payroll_run (cycle='special') / payroll_run_detail
             ──►  Payroll Closing → Payslip (same downstream)
```

Unlike Regular Cycle, Special Pay does **not** compute from `timesheet_summary` hours — its earnings are the `payroll_entry` rows flagged special ([batch_entries.md](./batch_entries.md), [bonus_special.md](./bonus_special.md)). Statutory deductions apply only if the run is contribution-bearing (configurable; default off for pure incentives).

---

## 3. Backend (reuse + delta)

Reuse the existing [GetPayrollProcessingRosterQuery](../../../app/Queries/Payroll/GetPayrollProcessingRosterQuery.php) and [ProcessPayrollHandler](../../../app/Handlers/Payroll/ProcessPayrollHandler.php) with a **`cycle` parameter** (currently hardcoded to `'regular'` — generalize it so `cycle='special'` resolves/creates the matching `payroll_run`). Note: a `'retro'` cycle is already threaded through both classes — follow that precedent when adding `'special'`.

- **Roster query (`cycle='special'`):** list active employees that have special earnings for the period (`payroll_entry` with `source in ('bonus','manual')` and `kind='earning'`), showing their special gross and processed status against the `special` run.
- **Process handler (`cycle='special'`):** for each selected employee, `gross = Σ special earnings`, `deductions = applicable (statutory only if contribution flag set) + special deductions`, `net = gross − deductions`; upsert `payroll_run_detail` under the `special` run. Block when `pay_process_status = 1`.
- Routes: reuse `api/payroll/payroll-processing/roster` + `/process` **with a `cycle` param**, or add `api/payroll/special-pay/{roster,process}` thin wrappers that pass `cycle='special'`.

---

## 4. Frontend (reuse the Regular Cycle page)

Mirror [RegularCycle.vue](../../../resources/views/web/src/module/payroll/payroll_processing/pages/regular_cycle/RegularCycle.vue) and its composable/components ([timesheet_summary.md](./timesheet_summary.md) §7): header + period picker, filter bar (search/department/status), client-side pagination, employee roster table (with **special gross / deductions / net**), select + **Process Selected / Process All**, batched progress modal, payslip breakdown. Only the columns/labels change to "Special Earnings". Cyan accent, valid Tailwind tokens, dark mode.

---

## 5. Edge Cases, Testing & Build Order

- **No special entries:** employee not in the roster; empty state when the period has none.
- **Independent of Regular Cycle:** the `special` run is a separate `payroll_run` row — regular and special coexist for the same period (unique `(idpayperiod, cycle)`).
- **Contribution toggle:** default no statutory deductions for incentive-only runs; document the toggle.
- **Closed period:** block processing.
- **Testing:** PHPUnit — roster lists only employees with special entries, process sums special earnings into the `special` run, cycle isolation from regular. Vitest — reuse the Regular Cycle composable tests with `cycle='special'`.
- **Build order (design-first):** Gate 1 hard-coded design (reuse Regular Cycle UI) → Gate 2 generalize roster/handler for `cycle`, wire live. Depends on `payroll_run`/`payroll_run_detail` + `payroll_entry` ([timesheet_summary.md](./timesheet_summary.md), [bonus_special.md](./bonus_special.md)).
