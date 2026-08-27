# Spec — Timekeeping Duty Roster (Unit Lock Console)

> **Kind:** Extension + **capability reduction** — the Timekeeping Duty Roster page already exists at [`timekeeping/applications/pages/duty_roster/`](../../../../resources/views/web/src/module/timekeeping/applications/pages/duty_roster/) and is today a **near-duplicate of the Manager Duty Roster**: both frontends call the *same* `api/timekeeping/duty-roster*` endpoints ([`duty_roster.api.ts`](../../../../resources/views/web/src/module/timekeeping/applications/pages/duty_roster/api/duty_roster.api.ts) vs [`staff_scheduler.api.ts:32-94`](../../../../resources/views/web/src/module/manager/staff_scheduler/api/staff_scheduler.api.ts#L32)) and both can create, edit, swap and delete shift assignments. This spec **removes all write capability from the Timekeeping copy** and replaces it with a single job — **lock / unlock the duty roster per unit** — plus a redesign onto the Timekeeping accent and the global component set. Scheduling itself stays exclusively with the Manager portal and the approval workflow already built by [`manager/duty_roster_approval_workflow.md`](../manager/duty_roster_approval_workflow.md).
> **Portal:** **Timekeeping** (`/api/timekeeping/...` routes, `timekeeping/applications` frontend module). Accent: **blue** (`blue-600`) per [ui-design](../../../rules/ui-design.md) — the current page is styled **teal**, which is the Manager/HR family, not Timekeeping. This is a live standards violation the redesign fixes.
> **Version:** v1 — 2026-08-27 — initial.
> **Route:** Reuses `/timekeeping/applications/duty-roster` (`tk_applications_duty_roster`, unchanged) and reuses `GET /api/timekeeping/timesheet-closing/periods` for the period picker. **Adds** 5 API routes under the existing `duty-roster` group: `GET /duty-roster/lock-status`, `GET /duty-roster/units`, `GET /duty-roster/lock-history`, `POST /duty-roster/lock`, `POST /duty-roster/unlock`. **Adds** one sidebar entry under Timekeeping → *Timekeeping Processing*.
> **Conventions:** [project-profile](../../../rules/project-profile.md), [hrms-rules](../../../rules/hrms-rules.md), [ui-design](../../../rules/ui-design.md), [vue-standards](../../../rules/vue-standards.md), [duplicate-prevention](../../../rules/duplicate-prevention.md), [laravel-standards](../../../rules/laravel-standards.md), [performance](../../../rules/performance.md).
> **System Awareness:** Models **reused** `AppChangeShift` (`app_shift`), `RosterDraft` (`roster_draft`), `PayPeriod` (`payroll_period`), `TkPeriodLockHistory` (`tk_period_lock_history`), `Unit` (`units`), `AccountDetailVW` (`vw_accounts_details`), `AccessType` (`accesstype`), `Shift`. Models **created** `RosterUnitLock`. Tables **created** `roster_unit_lock` (1). Tables **reused** all of the above. **1 additive column**: `tk_period_lock_history.idunit` (nullable). Queries **reused** `GetDutyRosterQuery`, `HandlePayPeriodQuery::handlePeriod()`, `GetTimesheetClosingPeriodsQuery`, `GetManagedEmployeesQuery::managedUnitIds()`, `GetPeriodLockHistoryQuery`. Handlers **reused/extended** `LockPeriodHandler`, `UnlockPeriodHandler`, `SubmitDutyRosterHandler`, `SaveShiftAssignmentHandler`, `SwapShiftHandler`, `SaveBulkRosterHandler`. Controllers **extended** `tk/DutyRosterController`, `manager/ApprovalRequestController`. New migration: **yes** — 2 (1 create table, 1 additive nullable column, zero backfill).

---

## 1. Purpose

Two problems, one screen.

**Problem 1 — the Timekeeping page is a duplicate of a screen that now has an approval workflow.** `SaveShiftAssignmentHandler`, `SwapShiftHandler` and `DutyRosterController::destroy()` are the Manager portal's *drafting* mechanism: a Supervisor edits cells into `roster_draft`, submits, and a Dept Head → HR chain approves before anything reaches `Timesheet` ([`SubmitDutyRosterHandler`](../../../../app/Handlers/Shift/SubmitDutyRosterHandler.php), [`ApprovalRequestController::store()`](../../../../app/Http/Controllers/manager/ApprovalRequestController.php#L120-L255)). The Timekeeping copy exposes the *same* mutating endpoints to a back-office role that sits **outside** that chain: a TK user editing a cell writes a `roster_draft` row stamped `filed_by = <TK user>` ([`SaveShiftAssignmentHandler.php:56`](../../../../app/Handlers/Shift/SaveShiftAssignmentHandler.php#L56)) that no Supervisor can see and no approver chain resolves for — `ResolveApproverListAction::execute($filedBy)` will throw "No approval matrix configured" for a TK back-office account. The edit is a dead-end row. Timekeeping must not be a second, unapproved authoring path into the same table.

**Problem 2 — there is no way to freeze a roster.** Roster changes are blocked only by the **whole-period** timesheet lock (`payroll_period.tk_process_status = 1`), checked in three places today ([`SubmitDutyRosterHandler.php:44-52`](../../../../app/Handlers/Shift/SubmitDutyRosterHandler.php#L44), [`ApprovalRequestController.php:138-151`](../../../../app/Http/Controllers/manager/ApprovalRequestController.php#L138), partially in [`SwapShiftHandler.php:39-40`](../../../../app/Handlers/Shift/SwapShiftHandler.php#L39)). It is all-or-nothing across the company. Timekeeping needs to close **one unit's** roster — because Unit A finished its schedule and TK is reconciling it — while Unit B is still drafting.

**What this spec builds:**

> **Timekeeping picks a pay period and a unit → locks it → every roster write path for employees in that unit (and its descendants) on dates inside that period is rejected, for Managers and approvers alike. Timekeeping can unlock it again. Closing the period on Timesheet Closing locks every unit's roster automatically.**

Timekeeping keeps a **read-only** view of the roster grid — it must see what it is freezing — but loses Add Schedule, drag-and-drop, edit, swap, delete and bulk upload entirely.

### Existing defects in the current Timekeeping page this redesign also clears

These are all in the file being rewritten, so fixing them is not scope creep — leaving them would mean rewriting around them:

| # | Defect | Evidence |
|---|---|---|
| 1 | Portal accent is **teal**, not Timekeeping blue — while the shared `HeaderBanner` already renders a blue gradient for `portal="timekeeping"`, so the header and its own buttons clash | [`DutyRosterHeader.vue:16-63`](../../../../resources/views/web/src/module/timekeeping/applications/pages/duty_roster/components/DutyRosterHeader.vue#L16) (`text-teal-800`, `hover:bg-teal-50`) vs [`HeaderBanner.vue:192-197`](../../../../resources/views/web/src/components/HeaderBanner.vue#L192) (`from-blue-700 via-blue-600`) |
| 2 | Dates are hard-coded to June 2026 — `activeDate = "2026-06-19"`, month view loops `2026-06-01..30`, `navigateToday()` resets to `2026-06-19`, and month navigation toasts *"Mock view restricted to June 2026"* | [`useDutyRoster.ts:29,148-155,192,199`](../../../../resources/views/web/src/module/timekeeping/applications/pages/duty_roster/composables/useDutyRoster.ts#L29) |
| 3 | Department filter offers hard-coded strings (`Engineering`, `Customer Support`, …) while `GetDutyRosterQuery` expects a **unit id** — the filter cannot ever match | [`DutyRosterHeader.vue:83-93`](../../../../resources/views/web/src/module/timekeeping/applications/pages/duty_roster/components/DutyRosterHeader.vue#L83) vs [`GetDutyRosterQuery.php:53`](../../../../app/Queries/Shift/GetDutyRosterQuery.php#L53) (`(int) $params['department']`) |
| 4 | Shift Type and Status filters are wired to `@change="triggerToast"` — decorative, no effect | [`DutyRosterHeader.vue:98,113`](../../../../resources/views/web/src/module/timekeeping/applications/pages/duty_roster/components/DutyRosterHeader.vue#L98) |
| 5 | Local hand-rolled toast markup + `<style scoped>` CSS reimplementing form inputs, while every other Timekeeping page uses PrimeVue `Toast` and Tailwind utilities | [`DutyRoster.vue:157-330`](../../../../resources/views/web/src/module/timekeeping/applications/pages/duty_roster/DutyRoster.vue#L157) vs [`TimesheetClosing.vue:5,141`](../../../../resources/views/web/src/module/timekeeping/timesheet_closing/pages/TimesheetClosing.vue#L5) |
| 6 | Grid rolls its own pagination instead of the global `Pagination.vue`; no `LoadingState`, `EmptyState`, or `StatusBadge` anywhere | [`DutyRosterGrid.vue:238-260`](../../../../resources/views/web/src/module/timekeeping/applications/pages/duty_roster/components/DutyRosterGrid.vue#L238) |
| 7 | Hard-coded `Main Office / Warehouse A / Remote` location list, hard-coded supervisor `"James Harrison"`, `exportRoster()` is a toast with no export | [`DutyRoster.vue:246-250`](../../../../resources/views/web/src/module/timekeeping/applications/pages/duty_roster/DutyRoster.vue#L246), [`useDutyRoster.ts:63,381`](../../../../resources/views/web/src/module/timekeeping/applications/pages/duty_roster/composables/useDutyRoster.ts#L63) |
| 8 | `types.duty_roster.ts` is four `[key: string]: any` stubs — no real typing | [`types.duty_roster.ts`](../../../../resources/views/web/src/module/timekeeping/applications/pages/duty_roster/types/types.duty_roster.ts) |
| 9 | `DutyRosterController::metrics()` hard-codes `$openShifts = 4; // Simulated open shift vacancies` and re-implements the 4-priority shift resolution that [`ResolveDailyShiftAssignments::forEmployees()`](../../../../app/Queries/Shift/ResolveDailyShiftAssignments.php#L46) already owns | [`DutyRosterController.php:100,111-160`](../../../../app/Http/Controllers/tk/DutyRosterController.php#L100) |

Items 1–8 are inside the rewritten frontend and are fixed here. Item 9 is backend and is fixed here **only for the stat cards this page needs** (Decision 10) — the Manager portal's use of `metrics()` is left untouched.

---

## 2. Design Decisions (Pros & Cons)

### Decision 1: What the Timekeeping Duty Roster screen becomes

**Option A — Read-only roster grid + a unit lock control panel on one page (Recommended)**
- The grid stays, sourced from the unmodified `GetDutyRosterQuery`, with every mutating affordance removed (no Add Schedule modal, no `draggable`, no drop targets, no delete button, no swap). A new **Unit Lock Panel** lists the units with their lock state for the selected pay period and a Lock / Unlock action per row. Clicking a cell opens a **read-only** detail drawer.

| Pros | Cons |
|---|---|
| Timekeeping can see exactly what it is freezing before it freezes it — a lock with no visibility is a blind action | The page keeps a large grid component it no longer mutates; the grid file shrinks but is not deleted |
| `GetDutyRosterQuery` is reused verbatim — no second read path, no divergence from what the Manager sees | Two concerns on one page (view + lock control) — mitigated by the panel being a distinct card, exactly as `PeriodStatusCard` sits beside the grid on Timesheet Closing |
| The route, sidebar target, and the Applications hub card at [`Applications.vue:305-309`](../../../../resources/views/web/src/module/timekeeping/applications/pages/Applications.vue#L305) keep working — no dead links | |

**Option B — Replace the page with a pure unit-lock table; drop the grid entirely**
- A simple table: unit, headcount, pending items, lock state, action.

| Pros | Cons |
|---|---|
| Smallest surface; unambiguous single purpose | Timekeeping locks a unit's roster without being able to look at it — they would have to leave for another screen to check, and no other Timekeeping screen shows the roster grid |
| No read-only-grid work at all | Throws away a working, already-built read path for no gain |

**Option C — Keep full CRUD and merely add a lock panel**
| Pros | Cons |
|---|---|
| Zero removal work | Directly contradicts the requirement; leaves Timekeeping as a second, unapproved authoring path (Problem 1) writing dead-end `roster_draft` rows |

**Recommendation: Option A.**

---

### Decision 2: Where the per-unit lock state lives

**Option A — New `roster_unit_lock` table keyed `(idunit, idpayperiod)`, plus one nullable `idunit` column on the existing `tk_period_lock_history` (Recommended)**
- State: one row per unit per pay period holding `is_locked`, `lock_source` (`manual` | `auto`), `locked_by`, `locked_at`, `comments`, with `unique(idunit, idpayperiod)`.
- Audit: **reuse** `tk_period_lock_history` by adding a nullable `idunit`. `NULL` keeps its current meaning — a whole-period timesheet lock written by [`LockPeriodHandler`](../../../../app/Handlers/Timesheet/LockPeriodHandler.php#L57) — and non-null means a duty-roster unit lock. This is the same additive-nullable-column shape the Manager spec already used for `app_shift.filed_by`.

| Pros | Cons |
|---|---|
| The lock is genuinely two-dimensional (unit × period); a table is the only shape that holds that without encoding | One new table and one migration |
| `lock_source` is what makes the auto-close/auto-reopen rule in Decision 7 answerable at all — without it, a manual TK lock and a lock caused by period closing are indistinguishable | `GetPeriodLockHistoryQuery` must learn to filter by `idunit` (it currently returns everything unfiltered — a small, contained change) |
| Audit reuses the table, query, and `ClosingHistoryTable` shape already built for Timesheet Closing — no parallel history mechanism | |
| `unique(idunit, idpayperiod)` *is* the concurrency guard (Decision 9) and the idempotency key for auto-close, at zero extra cost | |

**Option B — A `roster_locked` boolean column on `units`**

| Pros | Cons |
|---|---|
| No new table | No period dimension at all — locking a unit would freeze it for **all time**, past and future, which makes the auto-close-on-period-closing rule unimplementable |
| | No audit trail, no `locked_by`, no source |

**Option C — Derive it: treat the roster as locked whenever `payroll_period.tk_process_status = 1`; store nothing**

| Pros | Cons |
|---|---|
| Zero schema change; the auto-close requirement becomes free | Delivers only *half* the requirement — this is exactly today's all-or-nothing behavior. There is no way to lock **one unit**, which is the stated job of the screen |

**Recommendation: Option A.**

---

### Decision 3: Lock granularity — pay period, or arbitrary date range

**Option A — Pay period × unit (Recommended)**
- The lock's date dimension is a `payroll_period` row, selected from the same period picker Timesheet Closing already uses.

| Pros | Cons |
|---|---|
| Maps **1:1** onto the auto-close requirement: Timesheet Closing closes a *period*, so closing it locks that period's unit rows directly — no range arithmetic, no partial overlap to resolve | Timekeeping cannot freeze "just next Monday"; the smallest lockable span is a cutoff |
| `idpayperiod` is already stamped on `roster_draft` and `app_shift`, so the guard is an index lookup, not a date-range scan | |
| Matches every other lock in the system (`TimesheetSummary.is_locked`, `tk_process_status`, `pay_process_status`) — one vocabulary | |
| No overlapping-range ambiguity: two locks can never disagree about one date | |

**Option B — Arbitrary `start_date`–`end_date` × unit**

| Pros | Cons |
|---|---|
| Finer control | Overlapping ranges: two rows can both cover one date with different `is_locked` — the guard needs a precedence rule that does not exist anywhere else in the codebase |
| | Auto-close has no clean mapping: closing a period must now synthesise a range row and reconcile it against whatever manual ranges already overlap it |

**Recommendation: Option A.** If per-day freezing is ever wanted, it is a separate spec (§8) — not a reason to take on range reconciliation now.

---

### Decision 4: Does locking a parent unit cascade to its descendants?

**Option A — Yes, cascade on read via `GetManagedEmployeesQuery::managedUnitIds()`-style traversal; store only the unit the user picked (Recommended)**
- The lock row records the chosen unit. `AssertRosterUnlockedAction` resolves the employee's `unit_id`, walks **up** the `units.idunder` chain, and treats the roster as locked if *any* ancestor (or the unit itself) has a locked row for that period.

| Pros | Cons |
|---|---|
| Matches how every other unit-scoped feature in this domain behaves — [`GetDutyRosterQuery.php:56-75`](../../../../app/Queries/Shift/GetDutyRosterQuery.php#L56) and [`GetManagedEmployeesQuery::managedUnitIds()`](../../../../app/Queries/Team/GetManagedEmployeesQuery.php) both already treat a unit as "unit + all descendants" | The upward walk is one extra resolution step per guard call — mitigated by a per-request static cache, the same technique `managedUnitIds()` already uses |
| Locking a division actually locks the division; storing one row per descendant would go stale the moment HR re-parents a unit | The Unit Lock Panel must render an inherited state ("Locked via *Operations*") distinctly from a direct lock, so unlocking the right row is obvious |
| Unlocking is unambiguous — remove the one row that was created | |

**Option B — Exact unit only, no cascade**

| Pros | Cons |
|---|---|
| Trivially simple guard — one row lookup | A TK user who locks "Operations" would be surprised that Operations → Warehouse stayed open. Contradicts the established unit semantics everywhere else in the module |
| | Locking a division means clicking every leaf unit, and re-clicking whenever HR adds one |

**Option C — Cascade on write: expand to descendants and insert a row per unit**

| Pros | Cons |
|---|---|
| Guard is a single flat lookup, no traversal | Rows go stale on re-parenting; a new child unit silently stays unlocked; unlock has to identify and remove a set, so a partially-failed unlock leaves an inconsistent state |

**Recommendation: Option A.**

---

### Decision 5: Where the lock is enforced

There are five write paths into the roster today, and the existing pay-period lock check is **duplicated across three of them and missing from two** — `SubmitDutyRosterHandler` has it, `ApprovalRequestController` has its own copy, `SwapShiftHandler` loads `PayPeriod` but never checks `tk_process_status`, and `SaveShiftAssignmentHandler` / `SaveBulkRosterHandler` have no check at all.

**Option A — One shared `AssertRosterUnlockedAction`, called from all five paths; it checks *both* the pay-period lock and the new unit lock (Recommended)**
- `AssertRosterUnlockedAction::execute(int $idacct, string $date)` resolves the employee's unit and the date's pay period, then throws if either the period is closed (`tk_process_status = 1`) or a unit lock covers it. The three existing inline `tk_process_status` checks are **replaced** by calls to it, and the two missing checks are added by calling it.

| Pros | Cons |
|---|---|
| Collapses three divergent copies of the period-lock check into one — a [duplicate-prevention](../../../rules/duplicate-prevention.md) win the codebase's own rule asks for by name | Touches five files, including `ApprovalRequestController`, which is shared by 5 application aliases — the change must preserve its current `422` message and status for the period case verbatim |
| The lock cannot be bypassed by picking a different endpoint — one rule, one place | |
| Closes two genuine holes: `SaveShiftAssignmentHandler` and `SaveBulkRosterHandler` currently accept writes into a **fully closed** pay period | |
| The error message can name *which* lock fired, which the current shared message cannot | |

**Option B — Route middleware on the mutating `duty-roster` routes**

| Pros | Cons |
|---|---|
| Nothing inside the handlers changes | Middleware cannot resolve the target unit + date without parsing a different payload shape per route (`employeeId`+`date`, `empId1`+`date1`+`empId2`+`date2`, a `schedules[]` array, a `startDate`/`endDate` range) — the per-route parsing *is* the duplication, just relocated |
| | Misses `ApprovalRequestController`, which lives under `/api/manager/*` and is the path that actually writes to `Timesheet` |

**Option C — A model observer on `RosterDraft` / `AppChangeShift`**

| Pros | Cons |
|---|---|
| Impossible to bypass, including from tinker or a future caller | Throws from inside a save, surfacing as a `500` unless every call site catches it; makes legitimate system writes (a data fix, a migration) awkward to perform |

**Recommendation: Option A.**

---

### Decision 6: How Timesheet Closing triggers the roster auto-close

**Option A — `LockPeriodHandler` / `UnlockPeriodHandler` call a new `SyncRosterLockForPeriodHandler` (Recommended)**
- `LockPeriodHandler::execute()` already owns the whole close transaction — flipping `tk_process_status`, bulk-locking `TimesheetSummary`, writing history. One more call at the end of it: `SyncRosterLockForPeriodHandler::execute($payPeriod->id, $userId, true, $comments)`, which upserts an `is_locked = 1, lock_source = 'auto'` row for every active unit and writes the matching history rows. `UnlockPeriodHandler` calls the same handler with `false`.

| Pros | Cons |
|---|---|
| `LockPeriodHandler` is already the single funnel for closing a timesheet period — every caller, present or future, gets the roster close for free | Bolts a second concern onto a handler named for the timesheet — acceptable, since "close the period" genuinely now means both, and the handler is the only place that knows a close happened |
| Explicit, greppable, and debuggable — the causal chain is one call, not an event registration | The two handlers must be kept symmetric; a change to one without the other creates a one-way lock (covered by AC-24/AC-25) |
| Idempotent by construction thanks to `unique(idunit, idpayperiod)` — a re-run or retry writes the same state | |

**Option B — A `PayPeriod` model observer / `updated` event listener**

| Pros | Cons |
|---|---|
| Fires no matter who flips `tk_process_status`, including a raw `PayPeriod::update()` elsewhere | `PayPeriod` rows are updated for many unrelated reasons (`paydate`, `grace_hour`, `pay_process_status`); the listener must diff the attribute to avoid firing spuriously |
| | Invisible causality — nothing at the Timesheet Closing call site hints that the roster moved, which is exactly the kind of action-at-a-distance that makes this class of bug hard to find |
| | The project has no observer/event-listener precedent in this domain; introducing the pattern here is a bigger change than the feature |

**Option C — Do not write rows; make the guard treat `tk_process_status = 1` as "all units locked"**

| Pros | Cons |
|---|---|
| No auto-write at all; the guard already has to check the period anyway (Decision 5) | The Unit Lock Panel then cannot show *why* a unit reads Locked, and a TK user cannot unlock one unit inside a closed period even in principle — the state is not represented, so it is not addressable |
| | No audit rows for the auto-close, so the history card shows nothing happened |

**Recommendation: Option A.** Note the guard in Decision 5 checks the period **as well**, so Option C's behavior is a subset of Option A — the rows exist to make the state visible, attributable, and individually addressable, not to make the guard work.

---

### Decision 7: What happens to roster locks when Timesheet Closing **re-opens** a period

The requirement states the close direction only ("if e close gani sa timesheet closing automatic sa ma close ang duty roster"). The reverse is a genuine policy choice, so it is called out rather than assumed.

**Option A — Auto-unlock only the rows the auto-close created (`lock_source = 'auto'`); rows a TK user locked by hand (`lock_source = 'manual'`) stay locked (Recommended)**

| Pros | Cons |
|---|---|
| Re-opening undoes exactly what closing did and nothing more — a deliberate manual lock is not silently discarded by an unrelated action | A TK user re-opening a period may expect everything to open, and must notice the panel still shows some units locked — mitigated by the panel labelling the source and the toast reporting the count |
| `lock_source` makes this decidable; both other options throw that information away | |

**Option B — Re-opening unlocks every unit for that period**

| Pros | Cons |
|---|---|
| Simplest mental model: period open ⇒ roster open | Destroys manual locks placed for an unrelated reason, with no record that they were overridden |

**Option C — Never auto-unlock; TK unlocks each unit by hand after re-opening**

| Pros | Cons |
|---|---|
| Every unlock is a deliberate, attributable act | Re-opening a period leaves every unit frozen, so correcting the timesheet that the re-open was *for* is blocked until TK clicks through every unit — the re-open accomplishes nothing on its own |

> **This is the user's call, not a technical default.** Option A is recommended because it is the only one that preserves the distinction between "locked because the period closed" and "locked because Timekeeping decided to", but B is defensible if the business wants period state to be strictly authoritative.

**Recommendation: Option A.**

---

### Decision 8: How thoroughly write capability is removed from Timekeeping

Removing the buttons is not the same as removing the capability: `routes/api/timekeeping.php` sits in the bare `auth:sanctum` group ([`routes/api.php:60`](../../../../routes/api.php#L60)) with no role middleware anywhere, so `POST /api/timekeeping/duty-roster/save` is reachable by **any authenticated user** today, from either portal.

**Option A — Remove the UI affordances *and* add a server-side authorization guard: roster mutations require the caller to manage the target employee's unit (Recommended)**
- A new `AssertPortalAccessAction` (extracting the `accounts.role_access` → `accesstype.*_portal_access` lookup that [`GlobalController::portalAccess()`](../../../../app/Http/Controllers/global/GlobalController.php#L16-L56) already performs, rather than duplicating it) gates the new lock/unlock endpoints on `tk_portal_access`. Separately, `SaveShiftAssignmentHandler`, `SwapShiftHandler`, `SaveBulkRosterHandler` and `SubmitDutyRosterHandler` reject a caller whose `GetManagedEmployeesQuery::managedUnitIds(Auth::id())` does not contain the target employee's `unit_id` — with `403`.
- The mutating `duty-roster` endpoints are also **removed from the Timekeeping api layer** (`duty_roster.api.ts`), so the TK frontend has no code path to them at all.

| Pros | Cons |
|---|---|
| "Dili siya pwede ka change/update/delete" becomes true of the **system**, not just of the button layout — a curl, a stale tab, or a future screen cannot get around it | Adds an authorization check to four handlers shared with the Manager portal; a Supervisor who is not registered as `units.idhead` for their own team would start getting `403` where they previously succeeded — this must be verified against real data before shipping (see §7 step 8) |
| Fixes a real, currently-open hole: today any authenticated employee can POST a roster draft for any employee company-wide | |
| Reuses `managedUnitIds()` and the existing portal-access lookup instead of inventing a permission concept | |

**Option B — UI-only removal; rely on the unit lock for protection**

| Pros | Cons |
|---|---|
| Smallest diff; zero regression risk to the Manager portal | The unit lock protects only *locked* unit/period combinations — every unlocked unit stays wide open to a TK user or any authenticated account |
| | Leaves the pre-existing "any user can write any employee's roster" hole untouched while the spec is explicitly about who may change the roster |

**Option C — Split the endpoints: move the mutating routes out of `routes/api/timekeeping.php` into `routes/api/manager.php`**

| Pros | Cons |
|---|---|
| Clean route taxonomy — the write endpoints live in the portal that owns them | Breaks the Manager frontend, which calls `api/timekeeping/duty-roster/*` from [`staff_scheduler.api.ts:32-94`](../../../../resources/views/web/src/module/manager/staff_scheduler/api/staff_scheduler.api.ts#L32) — 8 URL changes in a file this spec otherwise does not touch, for no authorization benefit, since neither route group is role-gated |

**Recommendation: Option A**, with the §7 step-8 data check treated as a release gate rather than an afterthought. If that check shows unit headship is not reliably populated, fall back to Option B for the `403` guard **only** and keep everything else in Option A — and say so explicitly rather than shipping a guard that locks out legitimate Supervisors.

---

### Decision 9: Concurrency and idempotency on lock / unlock

**Option A — `unique(idunit, idpayperiod)` + `lockForUpdate()` inside a transaction + an explicit already-in-target-state check returning `409` (Recommended)**
- Manual lock/unlock from the UI: if the row is already in the requested state, respond `409` — the user's click was based on stale state and they should see why nothing happened. The auto-sync path (Decision 6) uses `updateOrCreate` and is silently idempotent, because a retry of a period close must not fail.

| Pros | Cons |
|---|---|
| Mirrors the guard `ApprovalRequestController.php:130-136` already uses (`where('status', 0)->lockForUpdate()` → `409 'This request has already been processed.'`) — one concurrency idiom in the codebase | Two behaviors on one table (strict for manual, idempotent for auto) — justified because a human double-click and a queue re-delivery genuinely warrant different answers, and enforced by the handler, not the caller |
| The DB constraint is the real guarantee, so two simultaneous locks cannot create two rows regardless of application-level races | |

**Option B — Idempotent everywhere: locking a locked unit returns `200` no-op**

| Pros | Cons |
|---|---|
| Simpler; one behavior | A TK user clicking Lock on a row another user just unlocked gets a success toast for an action that did nothing to *their* intended state |

**Recommendation: Option A.**

---

### Decision 10: The stat cards on the redesigned page

The current cards (`totalScheduled`, `workingToday`, `onLeave`, `restDay`, `missingSchedule`, `openShifts`) answer a scheduler's questions and are served by `DutyRosterController::metrics()` — which hard-codes `openShifts = 4` and re-implements shift resolution that `ResolveDailyShiftAssignments::forEmployees()` already owns (defect 9).

**Option A — Replace with lock-oriented cards served by the new `GetRosterLockStatusQuery`; leave `metrics()` untouched for the Manager portal (Recommended)**
- Cards: **Units Locked**, **Units Open**, **Employees Covered** (headcount under locked units), **Pending Approval** (`app_shift.status = 0` with non-null `filed_by` in the period), **Unsubmitted Drafts** (`roster_draft` rows in the period).

| Pros | Cons |
|---|---|
| The cards answer the question the screen now exists to answer; "who is working today" is the Manager's and the Dashboard's question | Two metric endpoints for one domain — acceptable because they serve genuinely different screens, and the shared *read* remains `GetDutyRosterQuery` |
| No fabricated numbers: every card is a real count, unlike the hard-coded `openShifts = 4` | `metrics()` keeps its simulated `openShifts` for the Manager portal — a known defect this spec documents (§8) rather than silently inheriting |
| Zero regression risk to the Manager portal, which calls `metrics()` from [`staff_scheduler.api.ts:37`](../../../../resources/views/web/src/module/manager/staff_scheduler/api/staff_scheduler.api.ts#L37) | |

**Option B — Keep the existing cards, add lock cards alongside**
| Pros | Cons |
|---|---|
| Nothing removed | Ten cards on a lock console; keeps consuming the endpoint with the fabricated `openShifts` value on a page whose whole point is being authoritative about roster state |

**Recommendation: Option A.**

---

### Decision 11: Where the page lives in the module tree and the navigation

**Option A — Keep the route and folder; retitle the page and add a sidebar entry under *Timekeeping Processing* (Recommended)**
- Route `/timekeeping/applications/duty-roster` and folder `timekeeping/applications/pages/duty_roster/` are unchanged. The page title becomes **"Duty Roster Lock"**, and a sidebar item is added next to *Timesheet Closing* — which is where its function belongs — while the existing Applications hub card keeps working.

| Pros | Cons |
|---|---|
| Smallest diff per [incremental-generation](../../../rules/incremental-generation.md); no dead route, no broken hub card, no bookmark breakage | The folder is nested under `applications/`, which no longer describes it — an *Application* elsewhere in this system means an employee-filed request (change shift, OT, leave), and this is a control screen |
| Reachable from both the hub card and the sidebar, matching how Timesheet Closing is reached | |

**Option B — Move to a new `timekeeping/duty_roster_lock` module with route `/timekeeping/duty-roster-lock`**

| Pros | Cons |
|---|---|
| Folder and URL both describe what it is; sits beside `timesheet_closing/` as a peer | New folder + route + `route/` file + aggregator update, delete the old folder, edit the Applications hub card and the breadcrumb chain — churn with no functional gain |
| | Any existing bookmark or link to the old URL 404s |

**Recommendation: Option A**, with Option B noted in §8 as a taxonomy cleanup worth doing if the `applications/` folder is ever reorganised anyway.

---

## 2.5 Acceptance Criteria

| # | Given | When | Then |
|---|-------|------|------|
| AC-1 | Migrations applied; `units` has an active unit `U10` and `payroll_period` has an open period `P1` (`tk_process_status = 0`) | `GET /api/timekeeping/duty-roster/lock-status?period_key=<P1.start>_<P1.end>` | `200`; `units[]` contains `U10` with `is_locked: false`, `lock_source: null`, `locked_by_name: null`, `inherited_from: null`; `stats.unitsLocked: 0` |
| AC-2 | Same state, TK user `T1` whose `accesstype.tk_portal_access = 1` | `POST /api/timekeeping/duty-roster/lock` `{unit_ids: [10], period_key: "<P1.start>_<P1.end>", comments: "Cut-off reconciled"}` | `200` `{success: true, locked: 1}`; exactly one `roster_unit_lock` row exists with `idunit: 10`, `idpayperiod: P1.id`, `is_locked: 1`, `lock_source: 'manual'`, `locked_by: T1`, `locked_at` set; one `tk_period_lock_history` row with `idunit: 10`, `action: 'Roster Locked'`, `created_by: T1` |
| AC-3 | `U10` locked for `P1` per AC-2; employee `E1` has `vw_accounts_details.unit_id = 10`; date `D1` falls inside `P1` | A Manager calls `POST /api/timekeeping/duty-roster/save` `{employeeId: E1, date: D1, shiftName: "Night Shift"}` | `422` `{success: false, message: "Duty roster for <U10 name> is locked for the period <P1.start> to <P1.end>."}`; **no** `roster_draft` row is created or modified |
| AC-4 | Same lock; a `roster_draft` row for `E1` on `D1` already existed before the lock | The Manager submits: `POST /api/timekeeping/duty-roster/publish` `{startDate, endDate}` spanning `D1` | `422` with the same locked-unit message; the `roster_draft` row remains, `status` untouched, **no** `app_shift` row is created |
| AC-5 | Same lock; a **Pending** `app_shift` row (`status = 0`, non-null `filed_by`) exists for `E1` on `D1`, awaiting approver `D1H` | `D1H` calls `POST /api/manager/approveRequest` `{id, alias: 'cs'}` | `422` with the locked-unit message; the row's `status` stays `0`, its `approvers` JSON is byte-identical, and `Timesheet.idshift` for `(E1, D1)` is unchanged |
| AC-6 | Same lock | The Manager calls `POST /api/timekeeping/duty-roster/swap` with `E1`/`D1` as one side | `422` with the locked-unit message; **neither** side of the swap is written (the guard runs before the transaction opens) |
| AC-7 | Same lock | The Manager calls `POST /api/timekeeping/duty-roster/save-bulk` with a `schedules[]` array where one entry targets `E1` on `D1` and another targets an employee in an **unlocked** unit | `422` with the locked-unit message and **zero** rows written from the whole batch — the batch is rejected atomically, not partially applied |
| AC-8 | Same lock | The Manager calls `POST /api/timekeeping/duty-roster/delete` `{employeeId: E1, date: D1}` | `422` with the locked-unit message; the `roster_draft` row and the `Timesheet` row for `(E1, D1)` both survive |
| AC-9 | Unit `U20` is a child of `U10` (`units.idunder = 10`); `U10` is locked for `P1`; employee `E2` has `unit_id = 20` | The Manager calls `POST /duty-roster/save` for `E2` on `D1` | `422` `{message: "Duty roster for <U20 name> is locked for the period ... (locked at <U10 name>)."}` — the lock cascades **down** the hierarchy |
| AC-10 | `U10` locked for `P1`; employee `E3` is in unrelated unit `U30` (not a descendant of `U10`), no lock row for `U30` | The Manager calls `POST /duty-roster/save` for `E3` on `D1` | `200`; the `roster_draft` row for `(E3, D1)` is created normally — the lock is scoped, not global |
| AC-11 | `U10` locked for `P1`; date `D2` falls in the **next** period `P2`, which has no lock row | The Manager calls `POST /duty-roster/save` for `E1` on `D2` | `200`; the draft is created — the lock is scoped to `P1` only |
| AC-12 | `U10` locked for `P1` by `T1` | `T1` calls `POST /api/timekeeping/duty-roster/unlock` `{unit_ids: [10], period_key: "<P1.start>_<P1.end>", comments: "Reopened for correction"}` | `200` `{success: true, unlocked: 1}`; the `roster_unit_lock` row has `is_locked: 0`; a `tk_period_lock_history` row with `idunit: 10`, `action: 'Roster Unlocked'` is written; a subsequent `POST /duty-roster/save` for `E1` on `D1` returns `200` |
| AC-13 | `U10` already locked for `P1` | `T1` calls `POST /duty-roster/lock` for `U10` + `P1` again | `409` `{message: "Duty roster for <U10 name> is already locked for this period."}`; the existing row's `locked_by`, `locked_at` and `comments` are **unchanged**, and no new history row is written |
| AC-14 | `U10` is **not** locked for `P1` | `T1` calls `POST /duty-roster/unlock` for `U10` + `P1` | `409` `{message: "Duty roster for <U10 name> is not locked for this period."}`; no history row is written |
| AC-15 | Two browser tabs open on the Unit Lock Panel, both showing `U10` as open for `P1` | Both click **Lock** within the same request window | Exactly one request returns `200`; the other returns `409` per AC-13. Exactly **one** `roster_unit_lock` row exists for `(10, P1.id)` — guaranteed by `unique(idunit, idpayperiod)`, verified by the `lockForUpdate()` re-read inside the transaction |
| AC-16 | `T1` submits a lock for 3 units where the middle one (`U20`) is already locked | `POST /duty-roster/lock` `{unit_ids: [10, 20, 30], period_key: ...}` | `409` and **zero** of the three are locked — the whole request is one transaction, not a partial apply. The message names the conflicting unit: `"Duty roster for <U20 name> is already locked for this period."` |
| AC-17 | `payroll_period` `P1` is open; `units` has 4 active units and 1 inactive (`status = 0`) | A TK user closes the period: `POST /api/timekeeping/timesheet-closing/lock` `{period_key: "<P1.start>_<P1.end>", comments: "June 1st half closed"}` | `200`; `P1.tk_process_status = 1`; `TimesheetSummary.is_locked = 1` for the period (existing behavior, unchanged); **and** `roster_unit_lock` holds a row for each of the **4 active** units with `is_locked: 1`, `lock_source: 'auto'`, `locked_by` = the closing user — the inactive unit gets **no** row |
| AC-18 | The auto-locks from AC-17 | `GET /duty-roster/lock-status` for `P1` | Every active unit reads `is_locked: true` with `lock_source: 'auto'`; `stats.unitsLocked: 4`, `stats.unitsOpen: 0` |
| AC-19 | The auto-locks from AC-17 | A Manager calls `POST /duty-roster/save` for any employee on any date inside `P1` | `422` — the roster is frozen company-wide for that period, satisfying "if e close gani sa timesheet closing automatic sa ma close ang duty roster" |
| AC-20 | AC-17 has run once | The same `POST /timesheet-closing/lock` request is replayed (network retry) | `200`; still exactly **4** `roster_unit_lock` rows — `updateOrCreate` on `(idunit, idpayperiod)` makes the auto-sync idempotent; no duplicate rows, no duplicated `TimesheetSummary` effect |
| AC-21 | Period `P1` is closed with 4 `auto` rows (AC-17); `T1` then manually locks nothing further, but unit `U30` was **already** manually locked before the close | `GET /duty-roster/lock-status` for `P1` | `U30`'s row still reports `lock_source: 'manual'` — the auto-sync must **not** overwrite `lock_source` on a row that is already `manual` and already `is_locked = 1` |
| AC-22 | State from AC-21 (3 `auto` rows + `U30` `manual`) | A TK user re-opens the period: `POST /api/timekeeping/timesheet-closing/unlock` `{period_key: ..., comments: "Correction needed"}` | `200`; `P1.tk_process_status = 0`; the 3 `auto` rows become `is_locked: 0`; **`U30` stays `is_locked: 1` with `lock_source: 'manual'`** (Decision 7 Option A); the response reports the count still locked |
| AC-23 | State from AC-22 | A Manager calls `POST /duty-roster/save` for an employee in `U30` on a date inside `P1` | `422` with the **locked-unit** message (not the locked-period message) — the manual lock survived the period re-open |
| AC-24 | State from AC-22 | A Manager calls `POST /duty-roster/save` for an employee in an auto-unlocked unit on a date inside `P1` | `200`; the draft is created — the re-open genuinely re-opened the roster it had closed |
| AC-25 | A closed period with `auto` rows | `LockPeriodHandler` throws partway through (e.g. `TimesheetSummary` update fails) | No `roster_unit_lock` rows are written and `tk_process_status` is unchanged — the roster sync runs inside the same transaction as the period close, so a failed close leaves no half-locked roster |
| AC-26 | A user whose `accesstype.tk_portal_access = 0` | `POST /duty-roster/lock` with a valid payload | `403` `{message: "You do not have Timekeeping portal access."}`; no row and no history is written |
| AC-27 | An **unauthenticated** request | `GET /duty-roster/lock-status`, `POST /duty-roster/lock`, or `POST /duty-roster/unlock` | `401` `{message: "Unauthenticated."}` — inherited from the `auth:sanctum` group at [`routes/api.php:60`](../../../../routes/api.php#L60), unchanged |
| AC-28 | An authenticated employee with `tk_portal_access = 0` who heads **no** unit | `POST /api/timekeeping/duty-roster/save` for an employee in a unit they do not manage, on an unlocked date | `403` `{success: false, message: "You are not authorized to modify the duty roster for this employee."}` (Decision 8) — the write is rejected on authorization, before the lock guard is reached |
| AC-29 | A Manager who **is** `units.idhead` of `U40` | `POST /duty-roster/save` for an employee in `U40` (or a descendant of it) on an unlocked date | `200` — the authorization guard does not regress the Manager portal's legitimate use |
| AC-30 | `POST /duty-roster/lock` payload | `unit_ids` absent, `[]`, not an array, or containing a non-integer / non-existent / inactive unit id | `422` with Laravel's validation body (`{message, errors: {...}}`) from `'unit_ids' => 'required|array|min:1'`, `'unit_ids.*' => 'required|integer|exists:units,id'`; nothing is written |
| AC-31 | `POST /duty-roster/lock` payload | `period_key` absent, malformed (`"2026-06"`, `"garbage"`), or naming a period that does not exist | `422` `{message: "Target pay period not found."}` — the same message and resolution path `LockPeriodHandler` already uses for an unresolvable `period_key` |
| AC-32 | `POST /duty-roster/lock` payload | `comments` is `null`, `""`, or omitted | `200`; `comments` stores the default `"Roster locked by Timekeeping."`, matching how `LockPeriodHandler` defaults its own comments |
| AC-33 | `POST /duty-roster/lock` payload | `comments` exceeds 500 characters | `422` validation error on `comments`; nothing is written |
| AC-34 | The redesigned Timekeeping page rendered in the browser | Inspected for mutating affordances | There is **no** Add Schedule button, no Export button, no `draggable` attribute, no drop handler, no Save/Delete/Swap control anywhere on the page or in the detail drawer; the drawer is read-only |
| AC-35 | The redesigned `api/duty_roster.api.ts` | Inspected | It exposes **only** `getRosterData`, `getShifts`, `getUnits`, `getPeriods`, `getLockStatus`, `getLockHistory`, `lockUnits`, `unlockUnits` — the `saveShiftAssignment`, `deleteShiftAssignment` and `swapShifts` methods are gone |
| AC-36 | The redesigned page's styling | Grepped for `teal` | Zero `teal-*` classes remain in `duty_roster/` — the accent is `blue-*` throughout, matching `HeaderBanner`'s `portal="timekeeping"` gradient and [ui-design](../../../rules/ui-design.md) |
| AC-37 | The redesigned page | Inspected for global component use | It imports and uses `HeaderBanner`, `LoadingState`, `EmptyState`, `Pagination`, `StatusBadge`, `ConfirmAlert`, `Drawer` and PrimeVue `Toast` from `@/src/components/`; no hand-rolled pagination, toast, empty state, or scoped form-input CSS remains |
| AC-38 | The redesigned composable | Grepped for hard-coded dates | No `2026-06-*` literal appears; `activeDate` initialises from the resolved active pay period, `navigateToday()` goes to the real current date, and month navigation moves month-to-month with no "mock view restricted" toast |
| AC-39 | The Unit filter on the redesigned page | Opened | Options come from `GET /duty-roster/units` and carry **unit ids** as values, so selecting one actually filters `GetDutyRosterQuery` (defect 3 fixed). Any filter the backend does not support is **removed**, not left wired to a toast (defect 4) |
| AC-40 | A period with no units returned (empty database) or a unit filter matching no employees | The page loads | `EmptyState` renders with a Timekeeping-appropriate message; no blank card, no console error, and the Lock panel renders its own empty state rather than an empty table body |
| AC-41 | Migration rollback: `php artisan migrate:rollback` covering both new migrations | Run on a database that already had `app_shift`, `tk_period_lock_history` and `units` | `roster_unit_lock` is dropped and `tk_period_lock_history.idunit` is dropped, with **no** other column touched; pre-existing `tk_period_lock_history` rows are otherwise intact |
| AC-42 | Pre-existing `tk_period_lock_history` rows created before this change | Inspected after `php artisan migrate` | `idunit IS NULL` for all of them, and `GetPeriodLockHistoryQuery` (as used by the Timesheet Closing screen) returns exactly the same rows it returned before — the additive column changes no existing behavior |
| AC-43 | `GetRosterLockStatusQuery` with 4 units and ~500 active employees | Called once | It issues a bounded number of queries independent of unit and employee count (no per-unit or per-employee query inside a loop) — verified with `DB::listen` or Telescope, per [performance](../../../rules/performance.md) |
| AC-44 | `AssertRosterUnlockedAction` called repeatedly inside `SaveBulkRosterHandler` for 200 rows | The batch is validated | The unit-ancestry walk and the lock lookup are resolved from a per-request cache, not re-queried 200 times — the same static-cache technique `GetManagedEmployeesQuery::managedUnitIds()` already uses |

---

## 3. Database

### 3a. `roster_unit_lock` — **new table**

Migration path: `database/migrations/table/app_shift/2026_08_27_000001_create_roster_unit_lock_table.php` (the roster/shift domain folder already in use for `app_shift` alters).

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `bigIncrements` | no | — | |
| `idunit` | `unsignedBigInteger` | no | — | `units.id`. Indexed. **No DB-level FK** — SubHRMS uses zero foreign keys ([project-profile](../../../rules/project-profile.md)) |
| `idpayperiod` | `unsignedBigInteger` | no | — | `payroll_period.id`. Indexed |
| `is_locked` | `tinyInteger` | no | `0` | `0` open, `1` locked. Indexed |
| `lock_source` | `string(10)` | no | `'manual'` | `'manual'` (Timekeeping clicked Lock) or `'auto'` (written by the period close). Drives Decision 7 |
| `locked_by` | `unsignedBigInteger` | yes | `null` | `accounts.id` of whoever last changed the state |
| `locked_at` | `dateTime` | yes | `null` | Timestamp of the last state change |
| `comments` | `string(500)` | yes | `null` | Audit reason |
| `created_at` / `updated_at` | timestamps | yes | — | |

Constraints: `unique(['idunit', 'idpayperiod'])` — this is simultaneously the concurrency guard (AC-15) and the idempotency key for the auto-sync (AC-20).

### 3b. `tk_period_lock_history` — **reused, one additive column**

Migration path: `database/migrations/table/payroll/2026_08_27_000002_add_idunit_to_tk_period_lock_history_table.php` (beside the existing `create_tk_period_lock_history_table`).

| Column | Type | Null | Notes |
|---|---|---|---|
| `idunit` | `unsignedBigInteger` | **yes** | `NULL` = a whole-period timesheet lock (today's only case, meaning unchanged). Non-null = a duty-roster unit lock. Indexed. Guarded with `Schema::hasColumn` like the `app_shift.filed_by` migration. Zero backfill (AC-42) |

`action` values used by this feature: `'Roster Locked'` / `'Roster Unlocked'`, distinct from the existing `'Locked'` / `'Unlocked'`.

### 3c. Reused read-only

`units` (`id`, `name`, `idunder`, `idhead`, `status`), `payroll_period` (`id`, `period_start`, `period_end`, `tk_process_status`), `vw_accounts_details` (`id`, `empid`, `fullname`, `unit_id`, `position`, `site`, `profile`, `status`), `app_shift` (`status`, `filed_by`, `idpayperiod`, `date`), `roster_draft`, `shift`, `accesstype` (`tk_portal_access`).

No seed rows. Absence of a `roster_unit_lock` row means **open** — a lock is created on demand.

---

## 4. Backend

### 4a. Models

- **New** `App\Models\RosterUnitLock` — `$table = 'roster_unit_lock'`, `$fillable = ['idunit','idpayperiod','is_locked','lock_source','locked_by','locked_at','comments']`, `$casts` for the integers and `locked_at => 'datetime'`. Relationships `unit()` → `Unit::class` on `idunit`, `account()` → `Account::class` on `locked_by`, mirroring `TkPeriodLockHistory`.
- **Edit** `App\Models\TkPeriodLockHistory` — add `'idunit'` to `$fillable`; add a `unit()` relationship.
- Unchanged: `AppChangeShift`, `RosterDraft`, `PayPeriod`, `Unit`, `AccountDetailVW`, `AccessType`, `Shift`.

### 4b. Actions

- **New** `App\Actions\Shift\AssertRosterUnlockedAction::execute(int $idacct, string $date): void` — the single enforcement point (Decision 5). Resolves the employee's `unit_id` from `vw_accounts_details`, resolves the date's `payroll_period`, then throws:
  - if `payroll_period.tk_process_status = 1` → `"Cannot submit roster changes for a locked pay period."` (**the existing message, verbatim**, so the three call sites it replaces keep their current behavior);
  - if any unit in `[employee unit, …ancestors via units.idunder]` has `roster_unit_lock.is_locked = 1` for that period → `"Duty roster for <unit name> is locked for the period <start> to <end>."`, with `" (locked at <ancestor name>)"` appended when the lock is inherited (AC-9).
  - Caches the unit-ancestry chain and the period's lock set per request in a static, as `GetManagedEmployeesQuery::managedUnitIds()` does (AC-44).
- **New** `App\Actions\Access\AssertPortalAccessAction::execute(string $flag): void` — extracts the `accounts.role_access` → `accesstype.<flag>` lookup **already performed** by `GlobalController::portalAccess()` rather than duplicating it; `GlobalController` is refactored to call it. Throws a `403` `HttpResponseException` when the flag is `0`/absent.
- **New** `App\Actions\Shift\AssertRosterWritableByAction::execute(int $idacct): void` — Decision 8's authorization guard. Reuses `GetManagedEmployeesQuery::managedUnitIds(Auth::id())` and throws `403` `"You are not authorized to modify the duty roster for this employee."` when the target's `unit_id` is not in it.
- Unchanged: `ResolveShiftForDateAction`, `SyncTimesheetShiftAction`, `ResolveApproverListAction`, `ParseRosterFileAction`.

### 4c. Queries

- **New** `App\Queries\Shift\GetRosterLockStatusQuery::execute($params)` — resolves the period via the shared `HandlePayPeriodQuery::handlePeriod($params)` (which already accepts `period_key`, `from`/`to`, `prev`/`next`, `idperiod` and falls back to the active period — the same resolution `GetPeriodLockStatusQuery` uses). Returns:
  ```php
  [
    'period' => ['id','period_start','period_end','tk_process_status'],
    'units'  => [[ 'id','name','idunder','headcount','is_locked','lock_source',
                   'locked_by_name','locked_at','comments','inherited_from' ]],
    'stats'  => ['unitsLocked','unitsOpen','employeesCovered','pendingApproval','unsubmittedDrafts'],
  ]
  ```
  Batched: one `units` query, one grouped headcount query over `vw_accounts_details`, one `roster_unit_lock` query, one `app_shift` count, one `roster_draft` count — no per-unit query (AC-43).
- **Edit** `App\Queries\Timesheet\GetPeriodLockHistoryQuery` — accept an optional `idunit` param: absent ⇒ `whereNull('idunit')` so the Timesheet Closing screen keeps returning exactly today's rows (AC-42); `'all'` or an id ⇒ roster history. Also expose the unit name. This is an **extension**, not a second history query.
- Unchanged and reused verbatim: `GetDutyRosterQuery` (the read path both portals share), `GetTimesheetClosingPeriodsQuery` (the period dropdown), `HandlePayPeriodQuery`, `GetManagedEmployeesQuery`.

### 4d. Handlers

- **New** `App\Handlers\Shift\LockRosterUnitHandler::execute($params)` — `['unit_ids','period_key','comments','user_id']`. Resolves the period, opens a transaction, and for each unit: `lockForUpdate()` re-reads the row, returns `409` if already `is_locked = 1` (AC-13, AC-16 — all-or-nothing), otherwise `updateOrCreate` with `is_locked = 1, lock_source = 'manual'` and writes a `tk_period_lock_history` row (`action: 'Roster Locked'`, `idunit`, `idpayperiod`, `comments`, `created_by`).
- **New** `App\Handlers\Shift\UnlockRosterUnitHandler::execute($params)` — the symmetric operation; `409` when not locked (AC-14); history `action: 'Roster Unlocked'`.
- **New** `App\Handlers\Shift\SyncRosterLockForPeriodHandler::execute(int $periodId, int $userId, bool $lock, string $comments = '')` — the auto path (Decision 6). Locking: `updateOrCreate` `is_locked = 1` for **every active unit**, setting `lock_source = 'auto'` **only when creating a row or when the existing row is not already a locked `manual` row** (AC-21). Unlocking: set `is_locked = 0` **only** `where('lock_source', 'auto')` (AC-22). Writes one history row per unit it actually changed. Idempotent (AC-20).
- **Edit** `App\Handlers\Timesheet\LockPeriodHandler` — wrap its existing body in `DB::transaction` and append `SyncRosterLockForPeriodHandler::execute($payPeriod->id, $userId, true, $comments)` (AC-17, AC-25).
- **Edit** `App\Handlers\Timesheet\UnlockPeriodHandler` — same shape, `false` (AC-22).
- **Edit** `App\Handlers\Shift\SaveShiftAssignmentHandler` — call `AssertRosterWritableByAction` then `AssertRosterUnlockedAction` immediately after the employee is resolved, before the shift is resolved (AC-3, AC-28).
- **Edit** `App\Handlers\Shift\SwapShiftHandler` — same two guards for **both** employees/dates, before the transaction opens (AC-6). This also closes the missing `tk_process_status` check noted in §1.
- **Edit** `App\Handlers\Shift\SaveBulkRosterHandler` — validate **every** row's guards up front, before any write, so the batch is atomic (AC-7).
- **Edit** `App\Handlers\Shift\SubmitDutyRosterHandler` — **replace** its inline `PayPeriod … tk_process_status` block (lines 44–52) with per-draft `AssertRosterUnlockedAction` calls (AC-4).

### 4e. Controllers

**Edit** `App\Http\Controllers\tk\DutyRosterController` — thin methods only, each `try/catch` → `response()->json(...)`, matching the file's existing style:

| Method | Body |
|---|---|
| `lockStatus(Request)` | `GetRosterLockStatusQuery::execute($request->all())` → `200` |
| `units(Request)` | Active `units` with headcount — **all** active units for a `tk_portal_access` caller (Decision 8 / defect 3), unlike the existing `getDepartments()` which scopes to `Auth::id()`'s managed units. `getDepartments()` stays unchanged for the Manager portal |
| `lockHistory(Request)` | `GetPeriodLockHistoryQuery::execute($request->all() + ['idunit' => 'all'])` → `200` |
| `lock(Request)` | `AssertPortalAccessAction::execute('tk_portal_access')`; `validate(['unit_ids'=>'required|array|min:1','unit_ids.*'=>'required|integer|exists:units,id','period_key'=>'required|string','comments'=>'nullable|string|max:500'])`; `LockRosterUnitHandler::execute($request->all() + ['user_id'=>Auth::id()])` |
| `unlock(Request)` | Same validation, `UnlockRosterUnitHandler` |

**Edit** `App\Http\Controllers\manager\ApprovalRequestController::store()` — replace its inline period-lock block (lines 138–151) with `AssertRosterUnlockedAction::execute($record->idacct, $recordDate)` inside the existing transaction, for the `cs` alias with a non-null `filed_by`. The other four aliases keep the period-only check by calling the same Action — which returns the identical `422` message for that case, so their behavior is unchanged (AC-5).

**Edit** `App\Http\Controllers\global\GlobalController::portalAccess()` — refactored to call `AssertPortalAccessAction`'s underlying resolver instead of holding the lookup inline (duplicate-prevention; no behavior change to its response body).

### 4f. Routes — `routes/api/timekeeping.php`

Added inside the existing `duty-roster` block (after line 76), no existing line changed:

```php
Route::get('/duty-roster/lock-status',   [DutyRosterController::class, 'lockStatus']);
Route::get('/duty-roster/units',         [DutyRosterController::class, 'units']);
Route::get('/duty-roster/lock-history',  [DutyRosterController::class, 'lockHistory']);
Route::post('/duty-roster/lock',         [DutyRosterController::class, 'lock']);
Route::post('/duty-roster/unlock',       [DutyRosterController::class, 'unlock']);
```

The 6 existing mutating routes (`/save`, `/swap`, `/delete`, `/publish`, `/upload`, `/save-bulk`) **stay registered** — the Manager portal calls them (Decision 8 Option C rejected). They are simply no longer reachable from the Timekeeping frontend, and are now guarded server-side.

---

## 5. Frontend

Module: `resources/views/web/src/module/timekeeping/applications/pages/duty_roster/` — **edited in place** (Decision 11). Accent: **blue-600**. Per-feature TS layout, `<script setup lang="ts">`, state in the composable (no store needed — single page).

### 5a. File plan

| File | Action |
|---|---|
| `DutyRoster.vue` | **Rewrite** — page shell. Drops the Assign-Duty-Shift `Modal`, the hand-rolled toast container, and the whole `<style scoped>` block. Adds PrimeVue `Toast`, teleported `LoadingState`, and `ConfirmAlert` for lock/unlock confirmation |
| `components/DutyRosterHeader.vue` | **Edit** — `HeaderBanner` title → "Duty Roster Lock", breadcrumbs → `Timekeeping / Applications / Duty Roster Lock`, `icon-class="mdi-calendar-lock"`. Action slot: **period picker** + week/month toggle + prev/next/today only. **Removes** Add Schedule and Export. Filter card: search + **unit select fed by real unit ids** (defect 3); the non-functional Shift Type and Roster Status selects are **deleted** (defect 4). All `teal-*` → `blue-*` |
| `components/UnitLockPanel.vue` | **New** — the core control. Table of units: name, headcount, lock state via global `StatusBadge` (`locked` / `active`), `lock_source` chip (`Manual` / `Auto — period closed`), who and when, and a per-row Lock/Unlock button. Multi-select checkboxes for a bulk lock. Rows locked via an ancestor show "Locked via *&lt;Unit&gt;*" and **no** action button. `EmptyState` when the unit list is empty. Drag-to-scroll on the `overflow-x-auto` container per [ui-design](../../../rules/ui-design.md) |
| `components/DutyRosterLockStats.vue` | **Rename** of `DutyRosterStats.vue` — 5 cards per Decision 10, blue accent |
| `components/DutyRosterGrid.vue` | **Edit — read-only.** Removes `draggable`, `@dragstart`, `@dragover`, `@drop`, the empty-slot "add" hover affordance and the `add-shift-at` emit. Keeps cell click → detail drawer. Replaces its hand-rolled pager with the global `Pagination.vue` (defect 6). Adds a lock overlay/watermark on columns whose date falls in a locked period for that employee's unit. `teal-*` → `blue-*` |
| `components/DutyRosterDetails.vue` | **Edit — read-only.** Swaps `Modal` for the global `Drawer.vue`, deletes the shift/location/notes form, the Save button, the Delete button and the swap picker; keeps shift name, time range, location, `StatusBadge` status, notes and history as display-only, plus a lock banner when locked |
| `components/RosterLockHistory.vue` | **New** — audit list from `GET /duty-roster/lock-history`, structurally mirroring `timesheet_closing/components/ClosingHistoryTable.vue` |
| `api/duty_roster.api.ts` | **Rewrite** — `getRosterData`, `getShifts`, `getUnits`, `getPeriods` (reusing `api/timekeeping/timesheet-closing/periods`), `getLockStatus`, `getLockHistory`, `lockUnits`, `unlockUnits`. `saveShiftAssignment` / `deleteShiftAssignment` / `swapShifts` **deleted** (AC-35). Adds the missing `http` import the current file omits |
| `composables/useDutyRoster.ts` | **Rewrite** — drops `handleDragStart`, `handleDrop`, `openAddModal`, `handleSaveShift`, `handleDeleteShift`, `exportRoster`, `editForm`, `draggedShift`, `notifications`, `triggerToast`. Adds `units`, `lockStatus`, `lockStats`, `lockHistory`, `selectedUnitIds`, `selectedPeriod`, `periodsList`, `handleLockUnits`, `handleUnlockUnits`, `isLockedForCell(empId, date)`. Real dates throughout (defect 2); PrimeVue `useToast` replaces the local toast |
| `types/types.duty_roster.ts` | **Rewrite** — real interfaces: `RosterEmployee`, `RosterCell`, `RosterUnitLockRow`, `RosterLockStats`, `RosterLockHistoryRow`, `PayPeriodOption`, `DutyRosterFilters`. Field names mirror the backend (`idunit`, `idpayperiod`, `is_locked`, `lock_source`, `locked_by`, `unit_id`) per [vue-standards](../../../rules/vue-standards.md) rule 5 |
| `index.ts` | **Edit** — export the new component/type surface |
| `composables/useSidebarLinks.ts` (global) | **Edit** — add `{ name: "Duty Roster Lock", icon: "fas fa-calendar-times", route: "/timekeeping/applications/duty-roster" }` to the Timekeeping → *Timekeeping Processing* group, beside Timesheet Closing |
| `pages/Applications.vue` | **Edit** — retitle the existing Duty Roster card to "Duty Roster Lock" and update its description; route unchanged |

Global components used: `HeaderBanner`, `LoadingState`, `EmptyState`, `Pagination`, `StatusBadge`, `ConfirmAlert`, `Drawer`, PrimeVue `Toast` (AC-37).

### 5b. API contract

| Method | Endpoint | Request | Response (200) |
|---|---|---|---|
| GET | `api/timekeeping/duty-roster` | `search`, `department` (unit id), `startDate`, `endDate`, `page`, `entries` | *unchanged* — `{employees, roster, pagination}` |
| GET | `api/timekeeping/duty-roster/units` | — | `{units: [{id, name, idunder, headcount}]}` |
| GET | `api/timekeeping/duty-roster/lock-status` | `period_key` \| `idperiod` \| `from`+`to` | `{period, units[], stats}` (§4c) |
| GET | `api/timekeeping/duty-roster/lock-history` | `idunit?`, `idperiod?` | `[{id, unit, period_start, period_end, action, user, comments, timestamp}]` |
| POST | `api/timekeeping/duty-roster/lock` | `{unit_ids: number[], period_key: string, comments?: string}` | `{success: true, locked: number}` |
| POST | `api/timekeeping/duty-roster/unlock` | same | `{success: true, unlocked: number}` |
| GET | `api/timekeeping/timesheet-closing/periods` | `year?` | *reused as-is* — the period dropdown |

Error shapes: `403 {message}` (no TK portal access), `409 {message}` (already in target state), `422 {message}` (period unresolvable / roster locked) or `422 {message, errors}` (Laravel validation), `401 {message: 'Unauthenticated.'}`.

### 5c. Layout sketch

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ HeaderBanner — blue gradient · portal="timekeeping"                         │
│  Timekeeping / Applications / Duty Roster Lock                              │
│  ⏱ Duty Roster Lock   Freeze or reopen unit duty rosters per pay period.    │
│                        [ Period: Jun 1–15, 2026 ▾ ] [Week|Month] [‹ › Today]│
└─────────────────────────────────────────────────────────────────────────────┘
┌─── Filters ─────────────────────────────────────────────────────────────────┐
│ [🔍 Search employee, ID, or position]        [ Unit: All Units ▾ ]  [Clear]  │
└─────────────────────────────────────────────────────────────────────────────┘
┌── Units Locked ──┬── Units Open ──┬── Employees ──┬── Pending ──┬─ Drafts ──┐
│        3         │       1        │      412      │     17      │     6     │
└──────────────────┴────────────────┴───────────────┴─────────────┴───────────┘
┌─── Unit Lock Control ───────────────────────── Jun 1–15, 2026 ── [🔒 Lock 2] ┐
│ ☐ Unit               Head  Staff  Status              Source        Action   │
│ ☑ Operations         J.R.   180   ●Locked             Manual · TK    Unlock  │
│ ☐  └ Warehouse A     M.S.    64   ●Locked via Oper.   —              —       │
│ ☑ Customer Support   A.L.   140   ●Locked             Auto · closed  Unlock  │
│ ☐ Engineering        R.T.    28   ●Open               —              Lock    │
└─────────────────────────────────────────────────────────────────────────────┘
┌─── Roster (read-only) ──────────────────────────────────────────────────────┐
│ Employee          Sun 1  Mon 2  Tue 3  Wed 4  Thu 5  Fri 6  Sat 7           │
│ Ana Cruz  🔒      REST   MORN   MORN   MORN   MORN   MORN   REST            │
│ Ben Diaz  🔒      REST   NGHT   NGHT   NGHT   REST   REST   REST            │
│ Cara Ong          REST   MORN   MORN  ⌛Pend  MORN   MORN   REST            │
│                                        « 1 2 3 »  (global Pagination.vue)   │
└─────────────────────────────────────────────────────────────────────────────┘
┌─── Lock History ────────────────────────────────────────────────────────────┐
│ 2026-08-27 14:02  Operations       Roster Locked    T. Cruz  Cut-off recon. │
│ 2026-08-27 09:15  All units        Roster Locked    System   Period closed  │
└─────────────────────────────────────────────────────────────────────────────┘
```

Cell click → read-only `Drawer`. Lock/Unlock click → `ConfirmAlert` (`type: 'warning'` for lock, `'info'` for unlock) with a comments field, then a PrimeVue toast on success.

---

## 6. Business Rules & Edge Cases

### 6a. Domain rules

1. **Timekeeping never authors a roster.** No create, update, delete, swap, upload or submit from the Timekeeping portal — in the UI (AC-34), in the api layer (AC-35), and server-side (AC-28).
2. **The lock unit is (unit × pay period).** Absence of a row means open.
3. **The lock cascades down the unit tree.** A lock on a unit freezes it and every descendant (AC-9); the guard resolves it by walking up from the employee's unit.
4. **A lock blocks every roster write path**, for every role: draft save, swap, bulk import, submit-for-approval, and the approver's approve — including the point where `SyncTimesheetShiftAction` would write `Timesheet` (AC-3 – AC-8).
5. **A lock does not block reads.** The grid, the Manager's grid, `metrics()`, and the dashboard are unaffected.
6. **A lock does not block a *decline*.** An approver may still decline a pending item in a locked unit — declining removes a change rather than applying one, and blocking it would trap the request with no resolution. Locking freezes the roster's *content*, not the approval queue's ability to drain.
7. **Closing a timesheet period locks every active unit's roster for that period**, with `lock_source = 'auto'` (AC-17).
8. **Re-opening a timesheet period releases only the `auto` locks.** `manual` locks survive (AC-22, AC-23) — Decision 7.
9. **The period lock still applies independently.** A closed period blocks roster writes even with no `roster_unit_lock` row, preserving today's behavior and its exact message.
10. **Inactive units are never auto-locked** and are not offered in the Unit Lock Panel.
11. **All lock and unlock actions are audited** in `tk_period_lock_history` with actor, unit, period, action and comments.

### 6b. Edge cases

| Edge case | Handling |
|---|---|
| Date falls in **no** pay period (a gap between cutoffs) | `AssertRosterUnlockedAction` cannot resolve a period ⇒ no unit lock can apply ⇒ the write proceeds, matching the current behavior of `SubmitDutyRosterHandler` and `ApprovalRequestController` for the same situation. Documented, not changed |
| A unit is re-parented after being locked | The lock follows the **live** hierarchy, because the ancestry is resolved at guard time, not stored (Decision 4 Option A). Re-parenting a unit out of a locked division releases it — the correct reading of "this division is frozen" |
| A unit is locked, then **deactivated** (`status = 0`) | The row persists and the guard still fires for any employee still carrying that `unit_id`; the panel stops listing the unit. Cleanup is out of scope (§8) |
| An employee has `unit_id` `NULL` or points at a deleted unit | No ancestry resolves ⇒ no unit lock applies; the period lock still does. The write is not silently swallowed |
| A locked unit already has **Pending** `app_shift` rows | They stay pending and un-actionable until unlocked (AC-5). Surfaced by the *Pending Approval* stat card so Timekeeping can see what a lock is holding |
| A locked unit has **unsubmitted** `roster_draft` rows | They remain as drafts; submission is rejected (AC-4). Surfaced by the *Unsubmitted Drafts* card |
| Bulk lock where one unit in the selection is already locked | Whole request rejected `409`, nothing locked, message names the conflicting unit (AC-16) |
| Period closed **while** a bulk lock is in flight | The lock still succeeds (its rows are `manual`) and is then simply redundant with the period lock; `SyncRosterLockForPeriodHandler` will not downgrade an existing locked `manual` row to `auto` (AC-21) |
| `LockPeriodHandler` partially fails | The whole close, roster sync included, rolls back — one transaction (AC-25) |
| Timesheet Closing re-opens a period the TK user never closed | Only `auto` rows release. If none exist, nothing changes and the response reports `0` |
| A Manager's browser tab is open and stale when a lock lands | Their next write returns `422`; the Manager frontend surfaces the message via its existing error toast. Live invalidation is out of scope (§8) |
| A Supervisor who heads no unit in `units.idhead` | Decision 8's guard would `403` them. §7 step 8 verifies this against production data **before** the guard ships; if headship is unreliable, the guard is dropped and that is stated explicitly rather than shipped broken |

### 6c. Non-Functional & Failure-Mode Checklist

| Category | Answer |
|---|---|
| **Authorization** | **Lock/unlock/units/lock-status/lock-history**: any authenticated user with `accesstype.tk_portal_access != 0`, resolved via `AssertPortalAccessAction`; everyone else `403 {message: "You do not have Timekeeping portal access."}` (AC-26); unauthenticated `401 {message: "Unauthenticated."}` from the `auth:sanctum` group (AC-27). **Roster mutations** (`/save`, `/swap`, `/delete`, `/publish`, `/save-bulk`, `/upload`): the caller must head the target employee's unit or an ancestor of it (`GetManagedEmployeesQuery::managedUnitIds(Auth::id())`), else `403 {success: false, message: "You are not authorized to modify the duty roster for this employee."}` (AC-28); a legitimate unit head is unaffected (AC-29). **Portal boundary**: the Timekeeping frontend has no code path to any mutating endpoint (AC-35); scheduling stays with the Manager portal and its Dept Head → HR chain per [hrms-rules](../../../rules/hrms-rules.md) portal separation. **Approval** authorization is unchanged — still owned by `ApprovalRequestController`'s existing approver/sub-approver ownership check. |
| **Concurrency / double-submit** | Guarded at three levels: `unique(idunit, idpayperiod)` at the DB, `lockForUpdate()` on the re-read inside the transaction, and an explicit already-in-target-state check → `409` (AC-13, AC-14, AC-15). Bulk lock/unlock is one transaction, all-or-nothing (AC-16). The lock/unlock buttons are disabled while a request is pending. `LockPeriodHandler`'s roster sync shares the close's transaction (AC-25). Roster writes racing a lock are serialised by the guard running inside each handler's transaction. |
| **Idempotency on retries** | **Manual** lock/unlock is deliberately *not* idempotent — a replay hits `409`, so a stale click is visible rather than silent (Decision 9). **Auto-sync** is fully idempotent: `updateOrCreate` keyed on `(idunit, idpayperiod)` means a replayed period close produces the same 4 rows, not 8 (AC-20), and writes no duplicate history for a row it did not change. No amounts or payroll rows are created by this feature, so there is no double-payment class of failure. |
| **Error response shape & status codes** | `401 {message: "Unauthenticated."}`. `403 {message: "You do not have Timekeeping portal access."}` / `403 {success: false, message: "You are not authorized to modify the duty roster for this employee."}`. `409 {message: "Duty roster for <unit> is already locked for this period."}` / `409 {... is not locked for this period."}`. `422 {message: "Target pay period not found."}` (unresolvable `period_key`, AC-31). `422 {message: "Duty roster for <unit> is locked for the period <start> to <end>."}` (+ `" (locked at <ancestor>)"` when inherited). `422 {message: "Cannot submit roster changes for a locked pay period."}` — **verbatim** today's message, so the five aliases sharing `ApprovalRequestController` see no change. `422 {message, errors: {...}}` for Laravel validation. `500 {message: "Error retrieving duty roster: <e>"}` from the controller's existing catch shape. Every response is a raw `response()->json(...)` inside `try/catch` — no API Resources. |
| **Input validation boundaries** | `unit_ids`: `required|array|min:1`; `unit_ids.*`: `required|integer|exists:units,id` — rejects `null`, `[]`, a bare string, a non-integer, a non-existent or inactive id (AC-30). `period_key`: `required|string`, then resolved by the shared period resolver; malformed or unknown ⇒ `422 "Target pay period not found."` (AC-31) — never a `500`, never a silent fallback to the active period on an explicitly-supplied bad key. `comments`: `nullable|string|max:500` — `null`/`""` ⇒ the default text (AC-32), over 500 chars ⇒ `422` (AC-33). `search`: string, passed to the existing `LIKE` binding in `GetDutyRosterQuery` (parameter-bound, no interpolation). `department`: cast `(int)` by the existing query; a non-numeric value resolves to no units and returns an empty result rather than erroring. `entries`: existing `(int)` cast with the existing `-1` = all branch. Dates (`startDate`/`endDate`) keep the existing `date_format:Y-m-d` rules on the mutating endpoints. |

---

## 7. Build Order

1. **Migrations** — `create_roster_unit_lock_table` and `add_idunit_to_tk_period_lock_history_table` (both `Schema::has*`-guarded, both with a clean `down()`). Verify `migrate` + `migrate:rollback` (AC-41, AC-42).
2. **Models** — new `RosterUnitLock`; add `idunit` to `TkPeriodLockHistory::$fillable` + its `unit()` relationship (AC-42).
3. **Actions** — `AssertPortalAccessAction` (extracted from `GlobalController::portalAccess()`, which is refactored to call it), `AssertRosterUnlockedAction`, `AssertRosterWritableByAction`. Unit-test the ancestry walk and the per-request cache first (AC-9, AC-10, AC-11, AC-44).
4. **Queries** — `GetRosterLockStatusQuery`; extend `GetPeriodLockHistoryQuery` with the `idunit` filter, confirming the Timesheet Closing screen's output is byte-identical when the param is absent (AC-42, AC-43).
5. **Handlers (lock)** — `LockRosterUnitHandler`, `UnlockRosterUnitHandler`, `SyncRosterLockForPeriodHandler` (AC-2, AC-12 – AC-16, AC-20, AC-21).
6. **Handlers (enforcement)** — wire `AssertRosterUnlockedAction` into `SaveShiftAssignmentHandler`, `SwapShiftHandler`, `SaveBulkRosterHandler`, and **replace** the inline block in `SubmitDutyRosterHandler`; replace the inline block in `ApprovalRequestController::store()`. Regression-check all five approval aliases (`cs`, `ot`, `obt`, `adj`, `leave`) still return the unchanged period message (AC-3 – AC-8).
7. **Auto-close wiring** — `LockPeriodHandler` / `UnlockPeriodHandler` call `SyncRosterLockForPeriodHandler` inside one transaction (AC-17 – AC-25).
8. **Authorization data gate** *(blocking, before step 9)* — verify against real data that Supervisors who legitimately edit rosters are populated as `units.idhead` (directly or via an ancestor). If they are not, drop `AssertRosterWritableByAction` from step 6, mark AC-28/AC-29 as not-applicable **in writing**, and report it — do not ship a guard that `403`s working users.
9. **Controller + routes** — the 5 new `DutyRosterController` methods and their route lines; verify each error shape by hand (AC-26, AC-27, AC-30 – AC-33).
10. **Frontend Gate 1 — static design** — rewrite `types`, then `DutyRoster.vue`, `DutyRosterHeader.vue`, `UnitLockPanel.vue`, `DutyRosterLockStats.vue`, `RosterLockHistory.vue`, and strip `DutyRosterGrid.vue` / `DutyRosterDetails.vue` to read-only, all against **hard-coded** data. Validate the design: blue accent, global components, zero `teal-*`, no mutating affordance (AC-34, AC-36, AC-37, AC-40).
11. **Frontend Gate 2 — live wiring** — rewrite `api/duty_roster.api.ts` and `composables/useDutyRoster.ts` against the real endpoints; remove every hard-coded date (AC-35, AC-38, AC-39).
12. **Navigation** — sidebar entry under Timekeeping → *Timekeeping Processing*; retitle the Applications hub card.
13. **End-to-end pass** — walk AC-1 → AC-44 in order against a seeded database, and confirm the Manager portal's own duty roster still drafts, submits, approves and syncs `Timesheet` exactly as before.

---

## 8. Out of Scope (Future Specs)

- **`DutyRosterController::metrics()`'s hard-coded `$openShifts = 4`** and its re-implementation of `ResolveDailyShiftAssignments::forEmployees()` (defect 9). Still consumed by the Manager portal; refactoring it is a Manager-side spec.
- **Manager Dashboard "Approvals" widget** still calling the nonexistent `api/manager/dashboard/approvals/{id}/approve` and silently falling back to `MOCK_PENDING` — carried over unfixed from `manager/duty_roster_approval_workflow.md` §8.
- **Per-day or per-employee roster locking** — Decision 3 Option B, if pay-period granularity proves too coarse.
- **Real roster export** — the current `exportRoster()` is a toast with no export; this spec removes the button rather than implementing it.
- **Live lock invalidation** (Echo/Pusher push so an open Manager tab learns about a lock before its next write fails). `laravel-echo` and `pusher-js` are already dependencies, so this is feasible later.
- **Cleaning up `roster_unit_lock` rows for deactivated or deleted units.**
- **Moving the module to `timekeeping/duty_roster_lock`** — Decision 11 Option B, worth doing if `applications/` is reorganised.
- **An HR override to change a roster inside a locked unit** (a "break the glass" path with its own audit trail).
- **Locking the roster from the Manager side** ("my unit's schedule is final") — a different actor and a different meaning from Timekeeping's reconciliation lock.

---

## 9. Definition of Done

- [ ] Every row in the **Acceptance Criteria** table passes (AC-1 … AC-44) — or, for AC-28/AC-29, is explicitly marked not-applicable per §7 step 8 with the reason recorded
- [ ] Every category in the **Non-Functional & Failure-Mode Checklist** is addressed — answered or explicitly `N/A because ...`
- [ ] The Manager portal's duty roster still drafts → submits → approves → syncs `Timesheet` unchanged, and all five approval aliases still return the pre-existing locked-period message verbatim
- [ ] `grep -r "teal" resources/views/web/src/module/timekeeping/applications/pages/duty_roster/` returns nothing
- [ ] `npm run build` passes
- [ ] No open findings from adversarial verification — see the latest `.agents/reports/timekeeping-duty_roster-verify-<date>.md`
