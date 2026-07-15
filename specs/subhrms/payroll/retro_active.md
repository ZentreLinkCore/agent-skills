# Spec — Retro Active (payroll processing cycle)

> **Kind:** Greenfield (page is a 4-line placeholder). Sibling cycle of Regular Cycle — reuses the processing infrastructure in [timesheet_summary.md](./timesheet_summary.md).
> **Portal:** Payroll. **Route:** `payroll/retro-active` (`payroll_retro_active`) — already registered → [retro_active/RetroActive.vue](../../../resources/views/web/src/module/payroll/payroll_processing/pages/retro_active/RetroActive.vue).
> **`payroll_run.cycle = 'retro'`.**
> **Conventions:** [.agents/rules/project-profile.md](../../rules/project-profile.md), [hrms-rules](../../rules/hrms-rules.md).

---

## 1. Purpose

**Retro Active** pays the **back-pay** owed when a salary adjustment takes effect **retroactively** — e.g. a raise approved in June but effective from January. It computes the difference between the new and old rate across the already-paid periods and posts it as a `payroll_run` (`cycle='retro'`) that flows to Closing and Payslip.

Source of the adjustment: the **`salary_history`** table ([SalaryHistory](../../../app/Models/SalaryHistory.php)) with its **`salary_adjustment_types`** ([SalaryAdjustmentType](../../../app/Models/SalaryAdjustmentType.php)) — each row is `idacct`, `amount` (new salary), `effective_date`, `adjustment_type_id`.

---

## 2. Data Flow (delta vs Regular Cycle)

```text
salary_history (new amount, effective_date)  +  prior payroll_run_detail (what was actually paid)
        │
        ▼
RETRO ACTIVE  ── per employee: for each affected cutoff between effective_date and now:
              ──    retro_diff = (new_daily_rate − old_daily_rate) × paid_days_that_cutoff
              ── Σ diffs → retro gross ; tax on retro ; net
              ──►  payroll_run (cycle='retro') / payroll_run_detail
              ──►  Payroll Closing → Payslip
```

Rate basis reuses `accountjob.daysmonth` for the daily rate ([timesheet_summary.md](./timesheet_summary.md) §6.3 Step 0). "Old rate" = the salary in force during each affected cutoff (from the prior `salary_history` row / the rate the period was actually paid at).

---

## 3. Backend (reuse + delta)

- **Roster query (`cycle='retro'`):** list employees with a `salary_history` adjustment whose `effective_date` is **before** the current period (i.e. retro is owed), showing old rate, new rate, affected cutoffs, and computed retro amount + processed status against the `retro` run.
- **Process handler (`cycle='retro'`) — dedicated `ProcessRetroPayHandler`:** for each selected employee, enumerate the pay periods from `effective_date` to the run period; for each, `diff = (new_rate − old_rate) × days_paid` (from that period's `payroll_run_detail` / worked days); `retro_gross = Σ diff`; apply tax; upsert `payroll_run_detail` under the `retro` run. Block when `pay_process_status = 1`.
- Routes: `api/payroll/retro-active/{roster,process}` (or shared endpoints with `cycle='retro'`).

---

## 4. Frontend (reuse the Regular Cycle page)

Mirror the Regular Cycle processing page ([timesheet_summary.md](./timesheet_summary.md) §7). Roster table columns: Employee, Adjustment Type, Effective Date, Old Rate, New Rate, Affected Periods, **Retro Amount**, Tax, **Net**, status; select + **Process Selected / Process All** + batched progress + a **retro breakdown** drill-down (per-affected-period diff). Filters: search, department, adjustment type. Cyan accent, valid tokens, dark mode.

---

## 5. Edge Cases, Testing & Build Order

- **Multiple adjustments:** if several `salary_history` rows fall in the window, apply each to its sub-range (rate steps).
- **Already-retro-paid:** don't double-pay a period already covered by a prior retro run — track/exclude.
- **Effective in the future:** no retro owed; excluded from the roster.
- **Rate basis:** daily rate from `accountjob.daysmonth`; old rate = the rate actually in force per affected cutoff.
- **Closed period:** block processing.
- **Testing:** PHPUnit — retro diff per affected cutoff, multi-step adjustments, exclusion of future/already-paid, tax, closed-period block. Vitest — roster + retro breakdown + process flow.
- **Build order (design-first):** Gate 1 hard-coded design (roster + retro breakdown) → Gate 2 `ProcessRetroPayHandler` + roster query (reads `salary_history`) + routes, wire live. Depends on `payroll_run_detail` history + `salary_history`/`salary_adjustment_types`.
