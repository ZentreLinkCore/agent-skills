# Spec — Night Differential Redesign

> **Kind:** Extension — redesign of an existing, **already backend-wired** module (unusual: most redesign candidates in this codebase are still mock-only; this one has a real, live `nsd_logs`/`nsd_policies` schema and real Query/Handler classes already).
> **Portal:** **Timekeeping** (`/api/timekeeping/...` routes, `timekeeping/night_differential` frontend module).
> **Route:** `timekeeping/night-differential` (`tk_night_differential`) — unchanged.
> **Conventions:** [project-gate.md](../../../rules/core/project-gate.md), [ui-design.md](../../../rules/conditional/ui-design.md), [frontend-vue.md](../../../rules/conditional/frontend-vue.md), [system-awareness.md](../../../rules/conditional/system-awareness.md).
> **System Awareness:** Models reused (`Timesheet`, `NsdLog`, `NsdPolicy`, `AccountDetailVW`, `Shift`, `PayPeriod`); Tables reused only (`timesheet`, `nsd_logs`, `nsd_policies`); Routes reused (`/api/timekeeping/nsd/*`, extended with pagination params — no new endpoints); New migration: **no**.

---

## 1. Purpose

`night_differential` is the Timekeeper/HR page for reviewing Night Shift Differential (NSD) hours (10:00 PM – 6:00 AM premium) computed from employee attendance. The requester's read is correct and verified against the real code: **NSD hours are already auto-detected**, so this page should behave like a **report/record** view, not an editable worksheet. Specifically:

1. **Auto-detection already exists and is real.** `Timesheet.np` (night-premium hours) is computed automatically by `HandleTimesheet::calculateDayMetrics()` every time a timesheet is processed — the exact "auto detect" the requester means. Verified live: **858** `timesheet` rows currently have `np > 0`. This is not a stub; it is the same computation payroll's own Night Differential Report already reads.
2. **The manual "Override" write-path is real but almost unused.** `nsd_logs` (via `OverrideNsdLogHandler`) lets a Timekeeper hand-enter a replacement NSD value per timesheet row. Verified live: only **3** `nsd_logs` rows exist total (1 `overridden`, 1 `audited`) against 858 auto-detected NSD days — i.e. it exists for rare manual correction, not as the primary path, which matches the requester's instinct that the page shouldn't be built *around* overriding.
3. **The "Recalculate NSD Period" action is fake and should not survive a redesign.** `RecalculateNsdPeriodHandler::execute()` does not recompute anything from real punch data — it literally does `$ts->np = round($ts->np + 0.1, 2)` with the comment *"simulate recalculation"*. Since real recalculation already happens automatically inside `HandleTimesheet` on every timesheet save, there is no legitimate independent "recalculate" job for this button to trigger — it's a leftover fake action, the same class of issue flagged in [daily_monitoring.md](./daily_monitoring.md)'s "Adjust Log" finding.
4. **A mature, correct reference implementation of this exact report already exists in this codebase**: `payroll/reports/pages/timekeeping_reports/night_differential/NightDifferential.vue`, backed by the real `GetNightDifferentialReportQuery` (Payroll domain). It already does everything a "report/record" version of this page should: `CSelect` filters, `Pagination` + rows-per-page, drag-to-scroll table, a read-only "Details" modal (no edit action), and 3 tabs (Logs / Employee Summaries / Department Stats). This redesign's job is to bring Timekeeping's own page up to that same standard — reusing the same global components and the same `Timesheet.np`/`holidayid` fields — without duplicating Payroll's aggregation report itself.

The redesign's job: strip the fake/rarely-needed write actions, adopt the project's real global components (`CSelect`, `Pagination`, `useInitialProfile`), add the drag-to-scroll + pagination this table is currently missing, and turn the page into what it should be — a **read-only NSD monitoring report**, sourced entirely from the already-real auto-detected data.

---

## 2. Design Decisions (Pros & Cons)

### Decision: What happens to the "Override" action

**Option A — Remove the edit action; keep override history as a read-only indicator (Recommended)**
- Delete `NsdOverrideModal.vue` and the "Override" button/column in `NightDifferentialLogs.vue`.
- Where a row already has an `nsd_logs` entry (`override_hours` not null), keep showing it — but as a plain read-only "Adjusted" badge + tooltip (mirrors the exact pattern used for `AppAdjustment`-driven "Adjusted" indicators in [daily_monitoring.md](./daily_monitoring.md) Decision 2), not as an editable field. The 1 existing overridden row stays visible and truthful; no data is hidden or deleted.
- `POST /api/timekeeping/nsd/override` and `OverrideNsdLogHandler` are left in the codebase unused by this page (not deleted — see Out of Scope) in case a future, explicitly-scoped "manual correction" flow needs it elsewhere.

| Pros | Cons |
|---|---|
| Matches the requester's explicit read: hours are auto-detected, so the primary surface shouldn't be edit-first | The rare real correction need (1 historical case) has no in-page UI anymore |
| Removes a rarely-used (3/858 rows) write path from a page whose job is monitoring, not data entry | If a genuine future correction need comes up, it needs a new, deliberately-scoped flow rather than reusing this modal |
| Zero data loss — the one real historical override stays visible, just non-editable | — |

**Option B — Keep the Override modal, but gate it as a rare edge-case action**
- Keep `NsdOverrideModal.vue`, but move the trigger from a per-row primary action to a secondary "Flag for Correction" affordance, still calling the same real `OverrideNsdLogHandler`.

| Pros | Cons |
|---|---|
| Preserves a working, real (not fake) capability for the rare case a biometric misread needs a manual fix | Keeps an edit-first affordance on a page the requester explicitly wants read-only; conflicts with the stated direction |
| No backend change needed | Still requires deciding *when* it should show, which reintroduces the ambiguity the requester is trying to remove |

**Recommendation:** **Option A.** The requester's own framing ("no need for override, auto-detect, just a report/record") is a correct read of the real data (858 auto-detected vs. 3 manual overrides ever). This is ultimately a business-policy call on whether Timekeepers should ever hand-correct NSD hours in this page at all — flagging for explicit confirmation rather than assuming, since it does remove a real (if rarely used) capability.

---

### Decision: What happens to the "Recalculate NSD Period" action

**Option A — Remove the button and `RecalculateNsdPeriodHandler` entirely (Recommended)**
- Delete the header button in `NightDifferentialHeader.vue` and the `recalculatePeriod()` composable method/API call.
- Delete `RecalculateNsdPeriodHandler.php`, its route (`POST /nsd/recalculate`), and controller method — it performs no real work today (fake `+0.1` increment) and there is no real recalculation job for it to do, since `HandleTimesheet` already recomputes `np` automatically whenever a timesheet is (re)processed.

| Pros | Cons |
|---|---|
| Removes dead/fake code that actively lies about doing work | Loses a (fake) "just in case" manual trigger — but it never did anything real |
| Matches "auto-detect, no manual step needed" framing exactly | If timesheets need reprocessing, the real path is re-running timesheet processing for that period — a separate, existing capability elsewhere in Timekeeping, not something this page should re-expose |

**Option B — Keep the button, rewire it to a real operation**
- Replace the fake increment with an actual re-run of `HandleTimesheet`'s NSD computation across the selected period's timesheets (a genuine "re-audit" of already-saved records, useful if e.g. a shift's `is_night_shift` flag changed after the fact).

| Pros | Cons |
|---|---|
| Turns a fake action into a real, occasionally useful one | Real work, not a "redesign" — needs its own scoped review of what "re-run for a period" should safely touch (this page has no period/date-range selector today to scope it) |
| — | Larger backend change than a report redesign warrants; risks touching live payroll-adjacent computation without a dedicated pass |

**Recommendation:** **Option A.** A fake action that fabricates numbers is worse than no action. If a real re-audit capability is wanted later, it deserves its own spec with a proper period scope — not a quick rewire bolted onto this redesign.

---

### Decision: Scope — frontend-only polish vs. frontend + minimal backend touch-up

Unlike [daily_monitoring.md](./daily_monitoring.md) (100% mock), this module's backend is real and live today. The UI gaps (no `CSelect`, no pagination, no drag-to-scroll) can be fixed frontend-only, but `GetNsdLogsQuery::execute()` currently returns the **entire unpaginated collection** (`->get()`, no `paginate()`), and the fake recalculate handler needs deleting, not just hiding.

**Option A — Frontend-only; leave backend pagination and the fake handler as-is (not recommended)**
- Add `CSelect`/`Pagination`/drag-to-scroll but paginate client-side over the full `GetNsdLogsQuery` payload.

| Pros | Cons |
|---|---|
| Smallest diff | Ships a table that fetches every NSD row on every load (858+ and growing) just to slice it client-side — doesn't scale, and leaves a known-fake handler in the codebase |

**Option B — Frontend redesign + minimal backend extension (Recommended)**
- Add `page`/`per_page` params to `GetNsdLogsQuery` (mirroring `GetNightDifferentialReportQuery`'s existing `paginate($perPage, ['*'], 'page', $page)` pattern exactly — same domain, same shape, no new pattern invented) and return the standard `{data, current_page, last_page, from, to, total}` envelope.
- Delete `RecalculateNsdPeriodHandler` + its route/controller method (Decision 2, Option A) and, if Decision 1 Option A is confirmed, delete `NsdOverrideModal.vue`'s call path (the `overrideLog` API route can stay registered/unused per Decision 1's note).

| Pros | Cons |
|---|---|
| Real pagination scales with the table (858 rows today, growing) | Touches `App\Queries\Nsd\GetNsdLogsQuery` and `App\Handlers\Nsd\*` — backend, not purely visual |
| Removes fake code instead of just hiding it in the UI | Slightly larger diff than a pure frontend pass |

**Recommendation:** **Option B.** Because this module (unlike Daily Monitoring) already has a live backend, a "redesign" that leaves a known-fake handler in place and an unpaginated query growing unbounded isn't actually done. The pagination change is additive params on an existing method (no new Query class, no schema change) — it's an extension, not new backend surface, per [system-awareness.md](../../../rules/conditional/system-awareness.md).

---

### Decision: Employee Summary / Department Stats tabs — add them here too, or leave to Payroll's report?

Payroll's `GetNightDifferentialReportQuery` already produces employee-summary and department-breakdown tabs from the same `timesheet.np` data. Timekeeping's `GetNsdLogsQuery`/`GetNsdStatsQuery` only return the flat log list + 4 headline stats.

**Option A — Keep Timekeeping's page to 1 tab (NSD Logs) + Policy Settings; do not rebuild the summary/department tabs here (Recommended)**
- Timekeeping's page stays focused on the day-to-day log/record view (its own domain: monitoring + policy config); Payroll already owns the aggregated employee/department breakdown report, and duplicating that grouping logic in a second Query would violate [system-awareness.md](../../../rules/conditional/system-awareness.md) rule 3 ("No Duplicate Logic").

| Pros | Cons |
|---|---|
| No duplicate aggregation logic between two portals reading the same `timesheet.np` field | Timekeepers without Payroll access can't see the employee/department breakdown from this page |

**Option B — Add the same Employee Summary / Department Stats tabs to Timekeeping's page**
- Build `GetNsdEmployeeSummaryQuery`/department aggregation reusing the same `buildFilteredQuery`-style grouping as `GetNightDifferentialReportQuery`, exposed under `App\Queries\Nsd`.

| Pros | Cons |
|---|---|
| Timekeepers get the full picture without needing Payroll access | Two Queries (`Nsd` domain and `Payroll` domain) computing the same groupings from the same table — exactly the drift risk [system-awareness.md](../../../rules/conditional/system-awareness.md) warns about; real scope growth beyond "redesign" |

**Recommendation:** **Option A.** This is a portal-ownership call, not a technical default — flag for explicit confirmation if Timekeepers are expected to need the aggregated view without Payroll access; if so, the correct fix is extracting `GetNightDifferentialReportQuery`'s grouping into a shared method both portals call (per the `HandlePayPeriodQuery::rawTimesheetPeriods()` precedent in this project's own conventions), not a second parallel implementation.

---

## 3. Database

No new tables/columns. All reused, with **live row counts verified** against the current DB:

| Table | Model | Row count (verified) | Used for |
|---|---|---|---|
| `timesheet` | `Timesheet` | **858** rows with `np > 0` | Auto-detected NSD hours (`np`), punch times (`timein`/`timeout`/`date_in`/`date_out`), holiday type (`holidayid`) for ND-type classification — the real, live source, already read by both `GetNsdLogsQuery` and Payroll's `GetNightDifferentialReportQuery`. |
| `nsd_logs` | `NsdLog` | **3** total (1 `overridden`, 1 `audited`, 0 `pending`) | Read-only "Adjusted" indicator per Decision 1 (`override_hours`, `status`, `remarks`) — a genuinely rare table, not the primary data source. |
| `nsd_policies` | `NsdPolicy` | 1 (singleton row) | Policy Settings tab — night hour window + 3 premium-rate multipliers; real, working config, unaffected by this redesign. |
| `shift` | `Shift` | 39 rows with `is_night_shift = 1` | Schedule label / night-shift flag join, already used by `GetNsdLogsQuery`. |
| `vw_accounts_details` | `AccountDetailVW` | — | Employee directory join (name, department, empid) — already the standard join used across the portal. |

---

## 4. Backend

**Reused and lightly extended** (Decision 3, Option B) — no new tables, no new routes, all within the existing `App\Queries\Nsd` / `App\Handlers\Nsd` classes and `routes/api/timekeeping.php` (`/nsd/*` prefix already registered):

- **`GetNsdLogsQuery::execute()`** — add `page`/`per_page` params, wrap the final `->get()` in `->paginate($perPage, ['*'], 'page', $page)` exactly like `GetNightDifferentialReportQuery` does, and return the same `{data, current_page, last_page, from, to, total}` envelope so the frontend's `Pagination` global component binds identically to the Payroll sibling. `NsdController::index()` stays a thin pass-through — no controller change needed beyond forwarding `$request->all()` (already does).
- **`RecalculateNsdPeriodHandler`** — delete the class file, its `use` import in `NsdController`, the `recalculatePeriod()` controller method, and the `POST /nsd/recalculate` route in `routes/api/timekeeping.php`.
- **`OverrideNsdLogHandler`**, **`GetNsdStatsQuery`**, **`GetNsdPolicyQuery`**, **`SaveNsdPolicyHandler`** — unchanged (Decision 1 only removes the frontend call path, not the backend method or route; Policy Settings is untouched).
- **`GetNsdStatsQuery`** stat shape unchanged (`totalNsdHours`, `monitoredEmployees`, `overriddenCases`, `avgNightHours`); only the KPI card's **label** changes on the frontend (see Section 5).

---

## 5. Frontend

Module folder stays as-is (`api/ composables/ components/ pages/ route/ types/`).

### Remove
- `components/NsdOverrideModal.vue` (delete file) — per Decision 1, Option A.
- From `composables/useNightDifferential.ts`: `isOverrideModalOpen`, `selectedLog`, `overrideForm`, `openOverrideModal()`, `closeOverrideModal()`, `submitOverride()`, and `isRecalculating`/`recalculatePeriod()` — per Decisions 1–2.
- From `api/night_differential.api.ts`: `overrideLog()` call site removed from the composable (the endpoint itself can stay unused server-side per Decision 1's note, but the frontend method is dead code once nothing calls it — remove it too), and `recalculatePeriod()` entirely (its backend is deleted, Decision 2).
- `NsdOverrideModal` usage + the "Override" button/column in `NightDifferentialLogs.vue`.
- The "Recalculate NSD Period" button + `#bottom` recalculating banner in `NightDifferentialHeader.vue`.

### Add / Replace (adopting global components + UI Standard, mirroring the real Payroll sibling)
- **`NightDifferentialLogs.vue`**: replace the native Department/Status `<select>` with `<CSelect>` (global, no import — confirmed registered in `main.ts`, 117+ existing usages, and literally what the Payroll sibling page already uses for the same filters); add the mandatory drag-to-scroll handlers (`cursor-grab active:cursor-grabbing select-none` + `mousedown`/`mousemove`/`mouseup`) to the table's `overflow-x-auto` container, matching the Payroll sibling's `tableContainerRef`/`startDrag` exactly; add `<Pagination>` (global component) + a "Rows per page" `<select>`, mirroring the Payroll sibling's footer layout 1:1; replace the hand-rolled initials (`log.employeeName?.split(' ')...`) with the shared `useInitialProfile()` composable (`@/src/composables/useInitialProfile`), consistent with [daily_monitoring.md](./daily_monitoring.md)'s same fix.
- **Actions column**: replace the "Override" button with a read-only "Adjusted" badge + tooltip, shown only when `log.overrideHours != null` (i.e. an `nsd_logs` row exists) — same visual language as the `adj_*` "Carryover Adjustment" indicator convention used elsewhere in this portal. No modal, no click handler.
- **KPI cards** (`pages/NightDifferential.vue`): rename "Overridden Cases" → **"Manually Adjusted Records"** (same `stats.overriddenCases` field, just a label that reads correctly once the page is presented as a report rather than an edit tool).
- **`NightDifferentialHeader.vue`**: description copy updates from "...override calculated NSD hours..." to something like "Review auto-detected night shift hours (10 PM – 6 AM) and manage organization-wide night premium policy." — no more references to overriding/recalculating in the header copy once those actions are gone.
- **`useNightDifferential.ts`**: add `currentPage`, `perPage`, `paginationData` (`current_page`/`last_page`/`from`/`to`/`total`), `perPageOptions` (`[10, 15, 25, 50, 100]`, matching the Payroll sibling's options), and thread `page`/`per_page` into `api.getLogs()`'s params.
- **`night_differential.api.ts`**: `getLogs()` passes `page`/`per_page` through to the (now-paginated) `GET /api/timekeeping/nsd/logs`; drop `overrideLog()` and `recalculatePeriod()` methods.
- **`NightDifferentialSettings.vue`** — unchanged (Decision 4: Policy Settings stays; already uses proper `<input type="time">`/`<input type="number">`, no native `<select>` to swap, already dark-mode compliant).

### Layout sketch (2-tab IA unchanged; internals redesigned)

```
NightDifferential.vue
├─ NightDifferentialHeader.vue        (Recalculate button removed; copy updated)
├─ KPI cards: Total NSD Hrs | Monitored Employees | Manually Adjusted Records | Avg Night Hrs
├─ Tabs: NSD Logs | Policy Settings
├─ [NSD Logs]     NightDifferentialLogs.vue
│    ├─ Search + CSelect(department) + CSelect(status)
│    ├─ Table (drag-to-scroll), "Override" action → read-only "Adjusted" badge
│    └─ Pagination + rows-per-page (mirrors Payroll's Night Differential Report footer)
└─ [Policy Settings]  NightDifferentialSettings.vue   (unchanged)
(NsdOverrideModal.vue: deleted)
```

---

## 6. Business Rules & Edge Cases

| Case | Handling |
|---|---|
| A timesheet row already has an `nsd_logs.override_hours` value (the 1 real historical case) | Show the override value as the displayed hours (unchanged precedence: `overrideHours ?? calculatedHours`), with the read-only "Adjusted" badge — never editable from this page (Decision 1). |
| `nsd_logs.status = 'recalculating'` on any existing row | With `RecalculateNsdPeriodHandler` removed, no code path sets this status going forward; existing rows in that state (none currently, per the verified counts) should just render via the existing `badgeStatus()`/`statusLabel()` maps, which already handle it — no special migration needed. |
| Employee has no `nsd_logs` row at all (855 of 858 cases) | Default status is `pending` per `GetNsdLogsQuery`'s `$log->status ?? 'pending'` fallback — unchanged; this is "auto-detected, not yet audited," which is accurate and requires no UI change. |
| NSD Logs table has more rows than one page | New pagination handles it; default `perPage` matches the sibling default (10, per `useNightDifferential`'s existing composable convention) or the Payroll sibling's default — confirm against whichever default this portal's other paginated tables use. |
| Policy Settings save while NSD Logs tab is showing stale rate labels | Out of scope — Policy Settings already saves independently via `SaveNsdPolicyHandler`; no cross-tab reactivity change requested or needed. |
| Mobile / narrow viewport | Preserve existing responsive `grid-cols-2 lg:grid-cols-4` KPI grid and stacked filter row; no new breakpoints needed. |

---

## 7. Build Order

1. Extend `GetNsdLogsQuery::execute()` with `page`/`per_page` params and `paginate()`, mirroring `GetNightDifferentialReportQuery`'s pattern; update `NsdController::index()` only if the response envelope needs reshaping (likely not, since it already wraps `{success, data}`).
2. Delete `RecalculateNsdPeriodHandler.php`, its route (`POST /nsd/recalculate`), and `NsdController::recalculatePeriod()`.
3. Strip override/recalculate state and methods from `useNightDifferential.ts` and `night_differential.api.ts`.
4. Delete `NsdOverrideModal.vue`; remove its usage from `pages/NightDifferential.vue`.
5. `NightDifferentialLogs.vue`: swap native selects → `CSelect`; add drag-to-scroll; add `Pagination` + rows-per-page; swap hand-rolled initials → `useInitialProfile()`; replace "Override" button with read-only "Adjusted" badge.
6. `NightDifferentialHeader.vue`: remove the Recalculate button + recalculating banner; update description copy.
7. `pages/NightDifferential.vue`: rename "Overridden Cases" KPI label → "Manually Adjusted Records".
8. Manual pass in-browser: verify both themes (light/dark), pagination at >1 page of results, and that no dangling references to the removed modal/handler remain (`grep -r "NsdOverrideModal\|openOverrideModal\|submitOverride\|recalculatePeriod\|RecalculateNsdPeriodHandler"` across the module + backend should return nothing).

---

## 8. Out of Scope (Future Specs)

- Deleting `OverrideNsdLogHandler`/`POST /nsd/override` server-side — left registered but uncalled, in case a deliberately-scoped future "manual correction" flow (Decision 1, Option B territory) needs it; removing dead server code entirely is a separate cleanup call, not required for this redesign.
- Employee Summary / Department Stats tabs for Timekeeping's own page (Decision 4) — only if Timekeepers are confirmed to need the aggregated view without Payroll portal access; if so, extract `GetNightDifferentialReportQuery`'s grouping logic into a shared method both portals call, rather than a second parallel Query.
- A real "re-audit a period" capability to replace the deleted fake recalculate action (Decision 2, Option B) — would need its own period/date-range scope design; not something to fake a second version of here.
- Any change to `NightDifferentialSettings.vue` / the Policy Settings tab's fields, rates, or save flow — already real, working, and untouched by this pass.
