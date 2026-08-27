# Investigation: Overtime plan hours turns an early time-out into ~24 hours

> **Reported via:** HRMS Chatbot OT filing returning a misleading error (see
> [`global-hrms_chatbot-verify-20260827.md` §15](global-hrms_chatbot-verify-20260827.md))
> **Investigated:** 2026-08-27
> **Status:** **RESOLVED 2026-08-27** — Option A implemented and verified after the user reviewed this report. See §10.
> **Severity:** **CRITICAL** — a payroll figure, computed wrong, silently.
> **Component:** [`app/Actions/Overtime/CalculateOvertimePlanHoursAction.php`](../../app/Actions/Overtime/CalculateOvertimePlanHoursAction.php)

---

## 1. Summary

`CalculateOvertimePlanHoursAction` compares **bare clock times** with no date attached. When an
employee's time-out is earlier *on the clock* than their shift end — which is what leaving early
looks like — an overnight-correction branch fires and reports nearly a full day of overtime.

An employee who left **15 minutes early** is measured as having worked **23.75 hours of overtime**.

**917 timesheet rows across 118 employees** are in that state today. No bad value has been persisted
yet (`app_overtime` max `planhrs` is 3.00, nothing above 12h), so this is a live hazard rather than a
data-corruption cleanup — but the OT filing path was itself broken until today, which is the most
likely reason it has not fired.

---

## 2. Root cause

```php
// CalculateOvertimePlanHoursAction::execute()
$referenceStartTime = ($isRestDayOT || empty($ftime)) ? $timein : $ftime;

if ($referenceStartTime && $timeout) {
    $shiftEndTime     = new DateTime($referenceStartTime);   // '07:30:00' → TODAY 07:30
    $submittedEndTime = new DateTime($timeout);              // '06:56:00' → TODAY 06:56

    // Intended for a shift that runs past midnight.
    if ($submittedEndTime < $shiftEndTime) {
        $submittedEndTime->modify('+1 day');
    }

    $interval = $shiftEndTime->diff($submittedEndTime);
    $planhrs  = round($interval->h + ($interval->i / 60), 2);
}
```

`new DateTime('07:30:00')` yields **today** at 07:30. Both operands collapse onto the same arbitrary
day, so the only information left is the clock face.

The `+1 day` branch cannot distinguish the two situations it now conflates:

| Situation | Clock comparison | Correct answer | What the code returns |
| :--- | :--- | :--- | :--- |
| Worked past midnight, genuinely into the next day | `timeout < ftime` | the real overtime | roughly correct |
| **Left early, same day** | `timeout < ftime` | **0 — there is no overtime** | **~24 h minus the shortfall** |

The timesheet row carries exactly the information needed to tell them apart — `date_in` and
`date_out` — and `HandleTimesheetLogs::checkTimeLogs()` already selects both. The action never reads
them.

---

## 3. Evidence

Both reproduced against the live database, read-only.

**Night shift** — account 106, shift 49 (23:30 → 07:30 next day):

```
worked   date_in 2026-03-11 23:30:00  ->  date_out 2026-03-12 06:56:00
         left 34 minutes EARLY, so there is no overtime
action returns: 23.43 hours
```

**Day shift** — account 2, shift 00:00 → 08:00:

```
2026-06-28   clocked out 07:45:00   (15 minutes early)
action returns: 23.75 hours
```

The day-shift case matters: this is **not** a night-shift edge case.

---

## 4. Blast radius

```
timesheet rows with a time-out                    4,939
rows where time-out is earlier than shift end       917    ← every one over-reports
  · on day shifts                                   762
  · on overnight shifts                             155
  · where date_out is genuinely the next day        191
distinct employees affected                         118
shifts involved                                      26

app_overtime rows today                             728
  max planhrs                                      3.00
  rows above 12 h                                     0    ← nothing bad persisted yet
```

**Downstream reach of `planhrs`** — it is not a display-only field:

- [`GetOvertimeReportQuery.php:126`](../../app/Queries/Payroll/GetOvertimeReportQuery.php#L126) —
  `$otHrs = (float)($row->hrs ?? ($row->planhrs ?? 0));` — falls back to `planhrs` for the payroll
  overtime report
- [`SubmitOvertimeApplicationHandler.php:49`](../../app/Handlers/Overtime/SubmitOvertimeApplicationHandler.php#L49) —
  persists it onto `app_overtime`
- Also read by `GetOvertimeDetailsQuery`, `GetOvertimeAdjustmentReportQuery`, `HandleOvertimeQuery`,
  `GetTimesheetExceptionsQuery`, `GetEmployeeDashboardQuery`

So an approved 23.75-hour request becomes an overtime figure in the payroll report.

---

## 5. Complication: the two input paths differ

`$logs` reaches the calculation from one of two sources, and **they do not carry the same fields**:

| Source | Returns | Has `date_in` / `date_out`? |
| :--- | :--- | :--- |
| `HandleTimesheetLogs::checkTimeLogs()` | the `timesheet` row joined to `shift` | **Yes** — both selected |
| `HandleAttendanceAdjustmentQuery::checkAdjustmentLogs()` | the approved `app_adjustment` row joined to `shift` | **No** — only a single `date` |

Any fix must therefore define what the adjustment path does. The natural rule — *the end date is the
following day when the shift's `ftime <= stime`* — is an inference, and it is the one design decision
in this fix that needs a human to confirm rather than an agent to assume.

---

## 6. A third question this exposes

`$isRestDayOT` is `(int) ($items['idshift'] ?? 0) === 1`, i.e. **shift id 1 means "rest day"**. On a
rest day the whole worked duration counts as overtime, so `$referenceStartTime` becomes `$timein`.
That reads as a magic value rather than a property of the shift, and it is supplied by the *caller*
in `$items` rather than derived from the roster — so a caller that omits `idshift` silently loses
rest-day treatment. Worth confirming while this area is open; not part of the defect above.

---

## 7. Options

### Option A — Compare real datetimes, floor at zero (recommended)

Build both operands from the dates the row already carries:

```
shiftEnd  = (shift crosses midnight ? date_in + 1 day : date_in) + shift.ftime
actualOut = date_out + timeout
planhrs   = max(0, actualOut - shiftEnd)
```

For the adjustment path, derive the end date with the same crosses-midnight rule (§5).

| Pros | Cons |
| :--- | :--- |
| Fixes the cause; early finishes correctly yield 0 | Changes a payroll figure — needs sign-off and a regression pass |
| Uses fields already selected; no schema or query change on the timesheet path | The adjustment path relies on an inferred end date (§5) |
| Genuine overnight overtime keeps computing correctly | Any consumer relying on today's inflated values would change |

### Option B — Sanity clamp only

Leave the maths; reject anything above a ceiling (e.g. 16 h) with a clear error.

| Pros | Cons |
| :--- | :--- |
| Small, low risk, blocks the absurd figure from being filed | The maths stays wrong — a 3 h early finish still reports ~21 h, under the ceiling |
| No payroll semantics to agree | Refuses a legitimate long overnight shift |

### Option C — Recompute from the OT application's own `stime`/`etime`

`HandleTimesheet:433` already does `calculateHrs($otStime, $otEtime)` — measure the requested window
instead of inferring from attendance.

| Pros | Cons |
| :--- | :--- |
| Measures what the employee actually requested | Changes what "overtime" means — it would no longer be validated against attendance |
| One existing implementation to reuse | Removes the check that the employee was actually present |

**Recommendation: Option A**, with §5's adjustment-path rule confirmed first.

---

## 8. Suggested verification for whichever option is chosen

1. Snapshot `planhrs` for all 917 rows before and after; every one should move to `0`.
2. Confirm a genuine overnight OT case still computes (e.g. shift ending 07:30, out at 10:00 → 2.5 h).
3. Confirm the rest-day path (`idshift = 1`) still counts the full duration.
4. Confirm the adjustment path against an approved `app_adjustment` on a midnight-crossing shift.
5. Re-run the OT filing end to end from both the Applications page and the chatbot.

---

## 9. What was already fixed (context, not part of this defect)

Two dead guards in the same file were repaired while diagnosing the reported symptom, and are
**independent** of the calculation above:

- The "no attendance record" error was unreachable — the guard tested the wrapper array, which the
  fallback assignment always populates. Every logless request surfaced as *"Overtime must be at least
  1 hour."*
- The approved-attendance-adjustment fallback never ran, because its condition asked whether a
  timesheet *row* exists rather than whether it holds usable logs. A row exists for every rostered
  day.

Neither touches how `planhrs` is computed.


---

## 10. Resolution — 2026-08-27

Option A implemented in
[`CalculateOvertimePlanHoursAction`](../../app/Actions/Overtime/CalculateOvertimePlanHoursAction.php).

### Correction to §4 of this report

The "917 rows would over-report" figure was **too broad**. Re-checking each row individually shows:

| | Rows | Old behaviour | New behaviour |
| :--- | ---: | :--- | :--- |
| Early / on-time finishes | **883** | ~24 h of phantom overtime | **no overtime** (correct) |
| Genuine overnight overtime | **34** | correct (the `+1 day` branch happened to be right) | unchanged, still correct |

So the old code was wrong for 883 rows, not 917 — it was accidentally right whenever the employee
genuinely *did* work past midnight. Verified: account 4 / 2026-01-06, shift 13:00-23:36, clocked out
02:36 next day → **3 h**, before and after.

### The anchor: what §7 Option A got wrong

Option A proposed deriving the end date from whether the shift crosses midnight
(`ftime <= stime`). **That is not sufficient**, and the first implementation attempt still
over-reported 36 rows because of it.

A shift recorded as `00:00-08:00` does not satisfy `ftime <= stime`, yet it is worked by clocking in
at 23:45 the *previous* evening — so its nominal start says nothing about which calendar day it ends
on. Account 2 / 2026-06-28 is exactly that: in at `2026-06-28 23:45`, out at `2026-06-29 07:45`,
15 minutes early, still computed as 23.75 h.

The reliable anchor is **the punch, not the roster**:

> The shift ends at the first occurrence of `ftime` at or after the employee actually clocked in.

```php
$timeInAt   = new DateTime($dateIn . ' ' . $timein);
$referenceAt = new DateTime($dateIn . ' ' . $ftime);
if ($referenceAt <= $timeInAt) $referenceAt->modify('+1 day');

$finishedAt = new DateTime($dateOut . ' ' . $timeout);   // adjustment path: roll if the clock wraps
$planhrs    = $finishedAt > $referenceAt
    ? round(($finishedAt->getTimestamp() - $referenceAt->getTimestamp()) / 3600, 2)
    : 0.0;
```

Two further points folded in:

- **Floored at zero.** An early finish is a short day, not overtime.
- **Raw seconds, not `DateInterval->h`.** The hour component wraps at 24, so the original
  `$interval->h + $interval->i / 60` would silently drop whole days from a genuinely long span.
- The §5 adjustment-path question is answered without the crosses-midnight inference: with only a
  `date`, the finish rolls to the next day when `timeout <= timein` on the clock.

### Verification (the §8 plan, all run)

| # | Case | Result |
| :--- | :--- | :--- |
| 1 | All 917 flagged rows re-checked individually | 883 → no overtime, 34 → unchanged genuine values, 0 errors |
| 2 | Adjustment path, shift 23:30-07:30 worked to 10:00 | **2.5 h** ✓ |
| 3 | Rest day (`idshift = 1`), 08:00-12:00 | **4 h** ✓ (whole span counts) |
| 4 | Day shift 08:00-17:00, out 19:30 | **2.5 h** ✓ |
| 5 | Day shift, out 16:30 (early) and 17:00 (exact) | no overtime ✓ |

Cases 2-5 ran inside a transaction rolled back in a `finally`; row counts confirmed identical before
and after each run. No production data was modified.

### Still open

§6's `$isRestDayOT` observation is unchanged: rest-day treatment keys on the magic value
`idshift === 1` supplied by the **caller** in `$items`, not derived from the roster, so a caller that
omits `idshift` silently loses it. Not part of this defect; worth its own look.
