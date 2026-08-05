# Spec — Resolution Center Redesign

> **Kind:** Extension — full redesign of an existing, live (non-mock) module that has a critical correctness gap plus multiple standards violations.
> **Portal:** **Timekeeping** (`/api/timekeeping/resolution-center/...` routes, `timekeeping/resolution_center` frontend module).
> **Route:** `timekeeping/resolution-center` (`resolution_center`) — unchanged.
> **Conventions:** [project-profile.md](../../rules/project-profile.md), [ui-design.md](../../rules/ui-design.md), [vue-standards.md](../../rules/vue-standards.md), [duplicate-prevention.md](../../rules/duplicate-prevention.md).
> **System Awareness:** Models reused (`AttendanceException`, `AttendanceDispute`, `AppAdjustment`, `Timesheet`, `AccountDetailVW`); Tables reused only; New migration: **no**.
> **Implementation status:** Backend (Decision 1) — **done**. Frontend standards redesign (Section 5) — **done**: `c-select`, drag-to-scroll, pagination, `StatusBadge`, `useInitialProfile` all applied to `ExceptionsTab.vue`/`DisputesTab.vue`/`ResolutionModal.vue`/`DisputeDetailsModal.vue`. Note: this module was already live (real endpoints, real data) going into this pass, so there was no hard-coded/mock design-first stage to build — the redesign was applied directly against the live composable.

---

## 1. Purpose

Resolution Center is where Timekeepers review system-flagged attendance exceptions and employee-filed disputes. Unlike `daily_monitoring`, this module is **not mock** — its frontend calls real endpoints, and its tables hold real rows (5 `attendance_exceptions`, 4 `attendance_disputes`, and it reads against the live 3,817-row `timesheet` table indirectly). It needs a redesign because two separate things are wrong:

### 1a. Critical: resolving/approving does not touch real payroll data

Traced `ResolveExceptionHandler` and `ProcessDisputeHandler` line by line:

- **"Resolve Exception" (Custom Punches strategy)** — the modal collects a real Manual Punch-In/Punch-Out time. `ResolveExceptionHandler` takes those values and writes them into a **text string** (`resolution_details = "Custom logs added: In 08:00, Out 17:00."`) on the `attendance_exceptions` row. It never touches the `timesheet` table (3,817 rows — the actual source `HandleTimesheetQuery` reads for every payroll calculation) and never creates an `AppAdjustment` record. The employee's actual computed hours for that day are **unaffected** — the Timekeeper believes they just corrected the punch; nothing was corrected.
- **"Approve" a dispute** — `ProcessDisputeHandler` sets `attendance_disputes.status = 'Approved'` and appends a **hardcoded** timeline message: *"Dispute approved. Recalculated hours successfully synced to timesheet records."* No recalculation happens. No sync happens. This message is false today.
- **Audit attribution is fabricated** — both handlers hardcode `resolved_by` / timeline `sender` as the literal string `'Timekeeper Admin'` instead of `Auth::id()`/the actual logged-in user, unlike every other lock/approval handler in this codebase (`LockPeriodHandler`, `LockPayrollPeriodHandler`, etc. all record the real acting user).

This is the "sayop sa pag-implement" — the module *looks* fully functional (real DB, real endpoints, convincing UI) but its two primary actions are cosmetic. Fixing this — not just the visual layer — is the main point of this spec.

### 1b. Standards violations (same category found in `daily_monitoring`)

- `ExceptionsTab.vue` and `DisputesTab.vue` both hand-roll native `<select>` for Unit/Severity/Type/Status filters instead of the global `<c-select>` (117 existing usages in this codebase).
- No pagination anywhere — `useResolutionCenter.ts` has no `currentPage`/`perPage`/`paginationData` state, and neither tab uses `<CenterPaginationComponent>`, despite every sibling roster/report table in this portal having one.
- Neither table supports drag-to-scroll (`ui-design.md` Best Practices — mandatory for wide tables); both just have plain `overflow-x-auto`.
- Avatar initials are hand-rolled (`item.fullname.charAt(0)`) in `ExceptionsTab.vue`, `DisputesTab.vue`, `ResolutionModal.vue`, and `DisputeDetailsModal.vue` instead of the shared `useInitialProfile()` composable.
- **Internal inconsistency**: `DisputesTab.vue` correctly uses the global `<StatusBadge>` component for its status column, but `ExceptionsTab.vue` — in the very same feature — hand-codes its own severity and status pill markup with raw `<span>` elements instead of reusing `StatusBadge`. Same module, two different conventions.

---

## 2. Design Decisions (Pros & Cons)

### Decision: How should "Resolve Exception" / "Approve Dispute" actually affect payroll data?

This is the load-bearing decision — everything else in this spec is secondary to it.

**Option A — Route through the existing `AppAdjustment` + `HandleTimesheet` auto-merge pipeline (Recommended — implemented)**
- When a Timekeeper resolves an exception with "Custom Punches", **create a real `AppAdjustment` row** (same model the employee-portal filing flow uses — 182 real rows already), but created with **`status = 1` (pre-approved)** since the Timekeeper's action *is* the approval — no further approval step needed. This reuses the exact mechanism `HandleTimesheet` already checks for (`HandleAttendanceAdjustmentQuery::checkApproved()`/`checkAdjustmentLogs()`) to auto-merge into `adj_aa_*` totals, and it's exactly what already renders correctly in `TimesheetProcessingTable.vue`'s breakdown view.
- Extract the `AppAdjustment::create(...)` block currently inline inside `TKApplicationController::submit_application()` into a small reusable method (`HandleAttendanceAdjustmentQuery::createAdjustment(...)`) so both the employee-filing path and this new Timekeeper-initiated path call the same creation logic instead of duplicating it — per [duplicate-prevention.md](../../rules/duplicate-prevention.md).
- Fix `resolved_by` / timeline `sender` to resolve the real logged-in user's display name (`AccountDetailVW::find(Auth::id())->fullname`) instead of the hardcoded string.
- **Dispute approval does *not* create an `AppAdjustment`** (clarified during implementation — see the resolved note below): `DisputeDetailsModal.vue`'s Approve/Reject/Info-Requested actions never collect a corrected punch-in/punch-out, only a free-text remark, so there is no time data to build a correction from. Approving a dispute only fixes its status/timeline + attribution; if a punch-time correction is actually needed, the Timekeeper resolves it separately via the Exceptions tab's "Custom Punches", which does collect real times.

| Pros | Cons |
|---|---|
| Corrections actually reach payroll — the core bug is fixed at the root | Requires a small refactor (extract the creation logic) rather than a pure UI change |
| Reuses the exact pipeline already proven correct (`adj_aa_*`, already displayed in Timesheet Processing) — no new merge logic to build/test | `idpayperiod`/`idshift` need to be resolved for a Timekeeper-initiated adjustment the same way they are for an employee-filed one — needs the same period/shift lookup |
| One audit trail (`app_adjustment.docnumber`), not two parallel bookkeeping systems | — |

**Option B — Write directly to `Timesheet.timein`/`timeout` and trigger `HandleTimesheet` recompute immediately**
- Skip `AppAdjustment` entirely; resolving an exception directly overwrites the day's `timesheet` row and recomputes on the spot.

| Pros | Cons |
|---|---|
| Immediate effect, no dependency on the `adj_aa_*` merge path | Introduces a **second**, parallel "how corrections apply" mechanism next to the already-working `AppAdjustment` one — exactly the kind of duplicate logic [duplicate-prevention.md](../../rules/duplicate-prevention.md) warns against |
| — | Loses the audit trail shape (`docnumber`, `remarks`, `approvers`) every other correction has; `Timesheet` has no equivalent audit columns |
| — | Bypasses whatever the future real auto-audit detection logic will expect to reconcile against |

**Recommendation:** **Option A.** The codebase already has one correct, working "how does a correction reach payroll" mechanism (`AppAdjustment` → `HandleTimesheet`). Building a second one to fix this bug would trade one implementation mistake for a second one.

---

### Decision: Scope of this pass — fix the sync bug + redesign UI, vs. also build the real auto-audit detection engine

`RunAutoAuditScanHandler` (confirmed earlier, in the `daily_monitoring` investigation) is a random simulator — it does not analyze `timesheet` for missing punches, schedule deviations, etc. It is the thing that's supposed to *populate* `attendance_exceptions` in the first place.

**Option A — Fix the resolve/approve data-sync bug (Decision 1) + redesign the UI/standards now; leave real detection for a follow-up spec (Recommended)**

| Pros | Cons |
|---|---|
| Matches the explicit ask ("redesign", "didn't follow the current setup") without silently absorbing a second, much larger initiative (designing real missing-punch/schedule-deviation detection rules is itself a policy decision, not a quick fix) | Exceptions will still only appear via the random simulator or manual DB entry until a follow-up spec builds real detection |
| Keeps this spec's diff reviewable | — |

**Option B — Also replace `RunAutoAuditScanHandler` with real detection logic scanning `timesheet` in this same pass**

| Pros | Cons |
|---|---|
| Resolution Center becomes fully real end-to-end in one pass | Detection rules (grace periods, what counts as a "deviation", per-shift-type thresholds) are HR policy decisions that need their own design discussion — same caution as designing new business rules elsewhere |

**Recommendation:** **Option A.** Flag building the real detection engine as an explicit, separate follow-up spec (Section 8) — don't let it block fixing the more urgent correctness bug (Decision 1) and the standards redesign.

---

### Decision: What does "Auto-Fill Shift" actually fill in? — **Resolved: dropped from scope**

The modal offered this as a one-click alternative to typing custom punch times, assuming it would prefill that employee's "standard shift" times. Investigated during implementation and found: there is **no per-employee-per-date shift assignment lookup** anywhere in the codebase. `Shift` is only a catalog of shift *types* (id, stime/ftime/break) — no column on `accounts` or `vw_accounts_details` links an employee to a shift for a given date, and `HandleChangeShiftQuery::checkApproved()` only detects a *temporary override* on top of a base assignment that itself isn't resolvable from just `idacct` + `date`. Guessing a shift here risks writing a wrong correction straight into payroll — the exact failure mode this spec exists to fix.

**Decision (confirmed with the user): drop "Auto-Fill Shift" entirely.** `ResolveExceptionHandler` now only supports `custom` (Timekeeper types the exact corrected punch times — already fully collected by the existing UI) and `ignore`. `ResolutionModal.vue`'s Auto-Fill Shift card has been removed (2-column strategy grid instead of 3), and `useResolutionCenter.ts`'s default strategy changed from `"autofill"` to `"custom"`. If a real shift-assignment lookup is confirmed later, Auto-Fill Shift can be reintroduced as a follow-up.

---

## 3. Database

No new tables/columns.

| Table | Model | Row count (verified) | Role in this spec |
|---|---|---|---|
| `attendance_exceptions` | `AttendanceException` | 5 | Read/write — status, `resolved_by`/`resolved_at` fix (Auth attribution) |
| `attendance_disputes` | `AttendanceDispute` | 4 | Read/write — status, timeline sender fix (Auth attribution) |
| `app_adjustment` | `AppAdjustment` | 182 (real, actively used) | **New write target** for resolve/approve actions (Decision 1, Option A) — created pre-approved (`status = 1`) |
| `timesheet` | `Timesheet` | 3,817 (the real, live source) | Not written directly (Decision 1 rejects Option B) — but this is what the `AppAdjustment` merge ultimately affects via `HandleTimesheet` |
| `vw_accounts_details` | `AccountDetailVW` | — | Employee directory join — already used correctly via `accountDetail()` relations on both models |

---

## 4. Backend — **implemented**

- **`HandleAttendanceAdjustmentQuery::createAdjustment(array $data): AppAdjustment`** (new method) — extracted from the creation block previously inline in `TKApplicationController::submit_application()`'s `'aa'` branch. Guards against a duplicate pending/approved adjustment for the same `idacct`+`date` (same check the controller already ran before creating); resolves `idpayperiod` from the date via `PayPeriod::where('period_start','<=',$date)->where('period_end','>=',$date)` when the caller doesn't already know it; accepts an optional `status` to create pre-approved. `docnumber` stays caller-supplied so each call site keeps its own uniqueness scheme. `TKApplicationController` now calls this method instead of constructing the `AppAdjustment` inline — verified behavior-preserving (same fields, same values, just routed through the shared method).
- **`ResolveExceptionHandler`** — `strategy === 'custom'` now computes `hrs` from the submitted punch times and calls `createAdjustment()` with `status = 1`, `idacct`/`date` from the exception, `stime`/`etime` from the payload, and a `docnumber` of the form `EXC{id}-{timestamp}`. `strategy === 'ignore'` is unchanged apart from the attribution fix below. The `'autofill'` branch was removed entirely (Decision, above).
- **`resolved_by`** (`ResolveExceptionHandler`) and the dispute timeline **`sender`** (`ProcessDisputeHandler`) now resolve `AccountDetailVW::find(Auth::id())->fullname` (falling back to `"Account #{id}"`) instead of the hardcoded `'Timekeeper Admin'` string.
- **`ProcessDisputeHandler`** — does **not** call `createAdjustment()` (Decision 1's dispute clarification, above). The false `"Recalculated hours successfully synced to timesheet records."` message on `Approved` was replaced with a plain `"Dispute approved."` — no claim of a sync that doesn't happen.
- **`GetExceptionsQuery`/`GetDisputesQuery`**: unchanged — already correctly scoped, filtered, and shaped.
- **`RunAutoAuditScanHandler`**: unchanged in this pass (Decision 2) — still a stub; not touched here.

Verified via a rolled-back transaction in tinker against real data: resolving a real `Unresolved` exception with `strategy: custom` created an `app_adjustment` row with the correct `idacct`, `date`, `stime`/`etime`, `idpayperiod` (resolved from the date), and `status = 1` — then rolled back cleanly, confirming the write path works without permanently consuming the test row. `php -l` clean on all four touched PHP files; `route:list` confirms the six `resolution-center` routes still resolve correctly, unaffected by this change.

---

## 5. Frontend

Module folder stays as-is. Changes:

- **`ExceptionsTab.vue` / `DisputesTab.vue`**: replace native `<select>` (Unit, Severity, Type, Status) with `<c-select>`; add drag-to-scroll handlers (exact pattern from `TimesheetProcessingTable.vue`) to each table's scroll container; add pagination (`<CenterPaginationComponent>` + rows-per-page selector) fed by new composable state.
- **`ExceptionsTab.vue`**: **done** — native `<select>`s (Unit/Severity/Type/Status) replaced with `<c-select>`; hand-rolled severity/status `<span>` pills replaced with `<StatusBadge>` via a `getSeverityBadgeStatus()`/`getExceptionBadgeStatus()` mapper (StatusBadge's fixed vocabulary has no native High/Medium/Low or Unresolved/Resolved keys, so severity/status are mapped onto its nearest semantic keys — `rejected`/`warning`/fallback and `approved`/`pending` respectively — with `customLabel` preserving the original text); drag-to-scroll added to the table container; avatar initials now use `useInitialProfile()`; pagination wired to `store.paginatedExceptions`/`store.paginationData`/`store.totalPages`.
- **`DisputesTab.vue`**: **done** — same treatment (its `<StatusBadge>` usage was already correct and untouched); Unit/Status selects → `c-select`; drag-to-scroll; `useInitialProfile()`; pagination wired to `store.paginatedDisputes`.
- **`ResolutionModal.vue`**: **done** — the "Auto-Fill Shift" card was removed (Decision, above); only "Custom Punches" and "Ignore Discrepancy" remain, in a 2-column grid. Avatar initials swapped to `useInitialProfile()`.
- **`DisputeDetailsModal.vue`**: **done** — avatar initials swapped to `useInitialProfile()`.
- **`useResolutionCenter.ts`**: **done** — added `currentPage`/`perPage` (shared across both tabs, reset to 1 on filter change and tab switch) plus computed `paginatedExceptions`/`paginatedDisputes`/`totalPages`/`paginationData` (client-side slicing, mirroring `useTimesheetSummary.ts`'s pattern, since neither `GetExceptionsQuery` nor `GetDisputesQuery` paginate server-side). Filter defaults changed from the sentinel string `"All"` to `""` to match the `c-select` + `placeholder` + `clearable` idiom — verified harmless against the backend, since `GetExceptionsQuery`/`GetDisputesQuery`'s `!empty($params[...]) && $params[...] !== 'All'` guards already treat an empty string identically to `'All'`.

---

## 6. Business Rules & Edge Cases

| Case | Handling |
|---|---|
| Employee already has a pending/approved `AppAdjustment` for the same date (e.g. they also self-filed) | `AppAdjustment::create` should check for an existing non-cancelled record for that `idacct`+`date` first (same guard `TKApplicationController` already applies before creating) and surface a clear error instead of creating a conflicting second record. |
| "Ignore Discrepancy" strategy | No `AppAdjustment` is created — this path only sets `attendance_exceptions.status = 'Resolved'` with the audit remark, same as today, just with real `Auth::id()` attribution instead of the hardcoded string. |
| Dispute rejected, "Info Requested", or **Approved** | No `AppAdjustment` created in any case — only the dispute's own status/timeline changes, with real attribution (confirmed decision, not just a fallback). |
| Resolution Center table grows beyond a handful of rows | Pagination (Section 5, done) handles it; default `perPage` is 10, matching sibling pages. |

---

## 7. Build Order

1. ~~`HandleAttendanceAdjustmentQuery::createAdjustment()` — extract from `TKApplicationController`; have the controller call the new method.~~ **Done.**
2. ~~`ResolveExceptionHandler` — wire `custom` strategy to `createAdjustment()` with `status = 1`; fix `resolved_by` to the real user.~~ **Done.**
3. ~~`ProcessDisputeHandler` — fix hardcoded sender to the real user; correct the false "synced to timesheet" message; confirmed no `createAdjustment()` call.~~ **Done.**
4. ~~`ExceptionsTab.vue` / `DisputesTab.vue`: swap native selects → `c-select`; add drag-to-scroll; add pagination; swap `.charAt(0)` → `useInitialProfile()`.~~ **Done.**
5. ~~`ExceptionsTab.vue`: replace hand-rolled severity/status pills with `<StatusBadge>`.~~ **Done.**
6. ~~`ResolutionModal.vue` / `DisputeDetailsModal.vue`: swap `.charAt(0)` → `useInitialProfile()`.~~ **Done.**
7. Manual pass in a real authenticated session (not just the tinker dry-run already done in Gate 2): resolve one real exception via "Custom Punches" from the actual UI, confirm the `app_adjustment` row and `resolved_by` show correctly, and that it's picked up the next time that employee's timesheet is processed. Approve one dispute and confirm the timeline shows the real logged-in user. Confirm pagination/filters/drag-to-scroll render correctly in both light and dark mode. **Open — needs a real browser session, not scriptable.**

---

## 8. Out of Scope (Future Specs)

- Building the real auto-audit detection engine to replace `RunAutoAuditScanHandler`'s random simulator (Decision 2) — needs its own HR-policy-driven design (grace periods, deviation thresholds, what counts as a "missing punch").
- Any change to the employee-portal Attendance Adjustment filing UI itself — only its underlying creation logic is being extracted for reuse, not its behavior changed.
- `daily_monitoring`'s own redesign — tracked separately in [daily_monitoring.md](./daily_monitoring.md); that spec already assumes Resolution Center is the destination for exception handling, which this spec keeps true.
