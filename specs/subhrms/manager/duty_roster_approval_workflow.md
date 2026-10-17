# Spec — Duty Roster Approval Workflow

> **Kind:** Extension — Duty Roster (`app/Http/Controllers/tk/DutyRosterController.php`, `manager/staff_scheduler` frontend module) already exists and already writes into `app_shift`. Nothing here creates a parallel roster table or a second approval engine. It also **fixes a latent defect in the existing shared approval engine** that this workflow is the first consumer to actually require working (see Decision 1).
> **Portal:** **Manager** (filing + the Department Head's existing approver inbox), touching **HR** (one small routing addition so HR's existing approver inbox becomes reachable) and the shared `tk` duty-roster backend. Accent: **teal** (already used throughout `manager/staff_scheduler` — `bg-teal-600`, `text-teal-600` etc. in the existing `DutyRoster.vue`/`DutyRosterSchedule.vue`); the HR-facing sidebar addition uses **emerald** per [ui-design](../../../rules/conditional/ui-design.md) and the precedent in `hr/incident_report.md`.
> **Version:** v1 — 2026-08-24 — initial.
> **Route:** Reuses `/manager/staff-scheduler/duty-roster` and `/manager/staff-scheduler/assign` (unchanged); reuses `/manager/approvers-menu/applications-request` (unchanged, already exists); **adds** `/hr/approvers-menu/applications-request` (`hr_approvers_menu_applications_request`) — the same existing page, mounted under one more portal prefix, mirroring how `/employee/approvers-menu/*` and `/manager/approvers-menu/*` already both exist for the same module.
> **Conventions:** [project-profile](../../../rules/core/project-gate.md), [hrms-rules](../../../rules/conditional/payroll.md), [ui-design](../../../rules/conditional/ui-design.md), [vue-standards](../../../rules/conditional/frontend-vue.md), [duplicate-prevention](../../../rules/conditional/system-awareness.md), [laravel-standards](../../../rules/conditional/backend.md).
> **System Awareness:** Models **reused** `AppChangeShift`, `ApproverMatrix`, `ApproverList`, `ApproverSub`, `AccountDetailVW`, `Unit`. Models **created**: none. Tables **reused** `app_shift`, `approver_matrix`, `approver_list`, `approver_sub` — all already exist, already populated by HR's existing [Approver Matrix screen](../../../../resources/views/web/src/module/hr/business_units/pages/approver_matrix/ApproverMatrix.vue). Tables **created**: none. **1 additive column**: `app_shift.filed_by` (nullable). Routes **reused** `GET/POST /api/manager/getApprovalRequest`, `/api/manager/approveRequest` (fixed, not replaced — see Decision 1); `GET api/timekeeping/duty-roster*` (extended). Routes **created**: none at the API layer — only a **frontend route + sidebar entry** duplicating the existing `approvers_menu` module under `/hr/*`. Actions **reused** `App\Actions\Approver\ResolveApproverListAction` (unchanged). New migration: **yes** — 1, additive, nullable column, zero backfill.

---

## 1. Purpose

Duty Roster currently has no approval step at all: every assign/edit/swap a Supervisor makes writes directly as `status = 1` (Approved) with an empty `approvers` array ([`SaveShiftAssignmentHandler.php:58-60`](../../../../app/Handlers/Shift/SaveShiftAssignmentHandler.php#L58)). The business has decided the correct workflow is:

> **Supervisor/Team Leader files the roster → Department Head/Manager approves → HR validates → Published.**

This spec makes that real, and — because implementing it surfaced that the shared approval engine (`ApprovalRequestController`, already used by Leave/Overtime/OBT/Attendance-Adjustment/Change-Shift) does not actually enforce multi-step chains today, it also fixes that defect rather than building a second, roster-only copy of the same state machine next to a broken one.

**What already exists and is reused almost unmodified:**
- **The approver-chain configuration UI**: HR already configures, per unit + position, an ordered list of approvers with dated backup approvers — [`ApproverMatrix`](../../../../app/Models/ApproverMatrix.php) / [`ApproverList`](../../../../app/Models/ApproverList.php) / [`ApproverSub`](../../../../app/Models/ApproverSub.php), managed today at `hr/business_units/pages/approver_matrix/ApproverMatrix.vue`.
- **The resolution logic**: [`ResolveApproverListAction::execute($idacct)`](../../../../app/Actions/Approver/ResolveApproverListAction.php) already turns "this employee, in this unit, in this position" into the exact ordered `{approver, order, sub_approver}` array every application type stores in its `approvers` JSON column — already used verbatim by [`SubmitChangeShiftApplicationHandler`](../../../../app/Handlers/ChangeShift/SubmitChangeShiftApplicationHandler.php#L18), Leave, OT, OBT, and Attendance-Adjustment submission handlers.
- **The approver's inbox**: a real, working page already exists — [`approvers_menu/pages/ApplicationRequest.vue`](../../../../resources/views/web/src/module/approvers_menu/pages/ApplicationRequest.vue) via [`useApplicationRequest.ts`](../../../../resources/views/web/src/module/approvers_menu/composables/useApplicationRequest.ts), calling the real `GET/POST /api/manager/getApprovalRequest` / `approveRequest` endpoints. It is already mounted at both `/employee/approvers-menu/*` and `/manager/approvers-menu/*` ([`useSidebarLinks.ts:43-47,97-101`](../../../../resources/views/web/src/composables/useSidebarLinks.ts#L43)), gated purely by `user.approver === true` — **not** by portal role. A Department Head who is already set up as an approver sees Duty Roster's pending items here automatically, today, with zero new frontend code, the moment the backend actually creates pending records correctly.

**What is a pre-existing, separate defect and is explicitly NOT this spec's problem to fix:** the Manager Dashboard's "Approvals" widget ([`Dashboard.vue:323-350`](../../../../resources/views/web/src/module/manager/dashboard/pages/Dashboard.vue#L323), [`dashboard.api.ts:57-65`](../../../../resources/views/web/src/module/manager/dashboard/api/dashboard.api.ts#L57)) calls `api/manager/dashboard/approvals/{id}/approve` — a route that **does not exist anywhere in `routes/api/manager.php`**. Every request 404s and [`dashboard.store.ts:120-129`](../../../../resources/views/web/src/module/manager/dashboard/store/dashboard.store.ts#L120) silently falls back to `MOCK_PENDING`. This is a second, unrelated instance of exactly the kind of mock-fallback problem the Duty Roster investigation already found — but it is a different screen with a different (nonexistent) endpoint, not the real `approvers_menu` mechanism this spec builds on. Fixing it is listed in §8.

---

## 2. Design Decisions (Pros & Cons)

### Decision 1: Enforcing true sequential multi-level approval (the load-bearing fix)

Reading [`ApprovalRequestController::store()`](../../../../app/Http/Controllers/manager/ApprovalRequestController.php#L68) and its only real frontend caller, [`useApplicationRequest.ts::approveItems()`](../../../../resources/views/web/src/module/approvers_menu/composables/useApplicationRequest.ts#L85), together reveals two problems this workflow cannot avoid triggering:

1. **No sequencing is enforced.** `approveItems()` always sends `count: 1` ([line 94](../../../../resources/views/web/src/module/approvers_menu/composables/useApplicationRequest.ts#L94)) regardless of how many approvers remain; `store()` sets `$record->status = 1` whenever `count === 1` ([line 115-118](../../../../app/Http/Controllers/manager/ApprovalRequestController.php#L115)). The **first** person in the chain to click Approve fully finalizes the record — order/`sub_approver` is computed for *display* in [`HandleChangeShiftQuery::pendingApproval()`](../../../../app/Queries/ChangeShift/HandleChangeShiftQuery.php#L160-L169) but never enforced on write. A Dept Head approving a Duty Roster submission today would instantly mark it `Approved`, and HR's tier would never get a turn.
2. **No ownership check.** `store()` does `$modelClass::find($id)` and mutates it directly — nothing verifies `Auth::id()` is actually one of that record's current approvers/sub-approvers before processing. Any authenticated user who knows or guesses a record id can approve or decline someone else's pending request.

Both are pre-existing gaps in code shared by Leave/OT/OBT/Attendance-Adjustment/Change-Shift today; they are latent because, in practice, nothing has needed a genuinely enforced 2+ level chain before. Duty Roster is the first consumer that actually needs it to work.

**Option A — Fix `ApprovalRequestController::store()` (and the matching read in `HandleChangeShiftQuery::pendingApproval()`-style queries) to own the state transition server-side (Recommended)**
- On `approve`: server locates the record, finds the **lowest `order`** among entries with `status === 0` — the entries currently actionable — verifies `Auth::id()` matches one of that order's `approver` or an active-dated `sub_approver`, rejects with `403` if not, then sets **only those matching entries'** `status = 1` inside the JSON. If any entry anywhere in the array still has `status === 0` afterward, the record's own `status` stays `0` (still pending, next order's turn). Only when every entry is `status === 1` does the record's `status` flip to `1` (and `date_approve` is stamped). On `decline`: same ownership check, then the record's `status` is set to `2` immediately (a decline at any tier stops the whole chain — matches the decided "Dept Head rejects → back to Supervisor" rule) and `cancelby`/`cancel_at`/`cancel_reason` are recorded as today. The frontend `approveItems()` stops constructing/sending an `approvers` array or a `count` at all — it sends only `{id, alias}` per item; the array is server-owned. A conditional guard (`where('status', 0)`, re-checked inside the same transaction) prevents a double-click or a race between two sub-approvers from double-processing the same entry.

| Pros | Cons |
|---|---|
| Fixes a real, currently-exploitable authorization gap (any user can currently mutate any pending record) — not a hypothetical, todays' code has no ownership check at all | Touches a controller shared by 5 existing alias types — needs regression coverage across all of them, not just `cs` |
| Makes Duty Roster's 3-tier requirement actually work, and fixes it for any *other* application type HR has configured (or will configure) with 2+ approver levels | The frontend can no longer construct the `approvers` mutation itself — `approveItems()` and `ApprovalRequestCard.vue`'s payload shape need a small edit |
| Removes client-trusted state (`$record->approvers = json_encode($item['approvers'])`) — an integrity gap independent of Duty Roster | |

**Option B — Build a separate, Duty-Roster-only approval endpoint with correct sequencing, leave `ApprovalRequestController` exactly as-is**
- A new `SubmitDutyRosterApprovalController`/handler owns sequencing only for `app_shift` rows tagged as roster-origin (Decision 3); every other alias keeps today's first-click-finalizes, no-ownership-check behavior.

| Pros | Cons |
|---|---|
| Zero regression risk to Leave/OT/OBT/Attendance-Adjustment/existing Change-Shift behavior, whatever it is today | Two different completion engines reading/writing the identical `approvers` JSON shape on the identical table — a direct [duplicate-prevention](../../../rules/conditional/system-awareness.md) violation |
| Smaller, isolated diff | The authorization gap (Problem 2) stays open for every other application type — leaving a known, real hole in place because fixing it wasn't "this ticket" |
| | A record's approval semantics now differ depending on *which* endpoint touched it — fragile and confusing for whoever debugs it next |

**Recommendation: Option A.** The codebase's own reuse rule argues directly against a parallel state machine, and the authorization gap is real today, not introduced by this spec — fixing it here is strictly better than leaving it and adding a second copy beside it.

---

### Decision 2: A real pre-submission Draft phase

`app_shift.status` today is `0: pending, 1: approved, 2: disapproved` — no draft concept exists in the data, even though the Manager Portal's UI already promises one (the non-functional Draft/Published radio in [`StaffSchedulerDetails.vue:118-141`](../../../../resources/views/web/src/module/manager/staff_scheduler/components/StaffSchedulerDetails.vue#L118) and the dead "Publish" button).

**Option A — No draft; every save is immediately Pending**
- `SaveShiftAssignmentHandler` resolves the approver chain and sets `status = 0` on every single cell edit.

| Pros | Cons |
|---|---|
| Simplest; matches how every other application type works (file once, it's pending) | A Supervisor building a multi-employee, multi-day roster (the "Assign Shifts" wizard already loops per employee per date) would spam the Dept Head's inbox with dozens of individually-pending items while still experimenting, and any correction requires waiting for a decline first |

**Option B — A real `status = 3` (Draft) value; an explicit "Submit for Approval" action transitions Draft → Pending (Recommended)**
- `SaveShiftAssignmentHandler` defaults new/edited cells to `status = 3` and does **not** resolve an approver chain yet. A new `SubmitDutyRosterHandler` (§4c) resolves the chain **once** for the filing Supervisor and flips every one of their still-Draft cells in the submitted range to `status = 0`, attaching the resolved `approvers` array to each.

| Pros | Cons |
|---|---|
| Matches the decided workflow's own language ("Supervisor **files**") and the UI's existing (broken) promise — this makes that promise real instead of adding a different concept | `status` gains a 4th value; every place that already branches on `app_shift.status` (`GetDutyRosterQuery::mapShiftToRoster`, `DutyRosterController::metrics`) needs a Draft branch added — a small, bounded, already-enumerated set of call sites |
| A Supervisor can freely tinker with a whole week's roster before anyone downstream sees it | |
| The chain is resolved exactly once per submission, not once per cell — cheaper and matches "one filer, one chain" | |

**Recommendation: Option B.**

---

### Decision 3: Tagging which `app_shift` rows are Duty-Roster-originated, and who filed them

Every existing consumer of `app_shift` (Change Shift application) is **self-filed** — the employee named in `idacct` is also the person who submitted it, and `ResolveApproverListAction` is called against that same `idacct`. Duty Roster breaks that assumption: the **employee** (`idacct`, whose shift changed) and the **filer** (the Supervisor building the roster) are different people, and the approver chain must resolve against the **filer's** unit/position, not the scheduled employee's.

**Option A — Add a nullable `app_shift.filed_by` column (Recommended)**
- `NULL` = an ordinary self-filed application (today's only case, unaffected). Non-null = Duty-Roster-originated, holding the filer's `accounts.id`. `SubmitDutyRosterHandler` calls `ResolveApproverListAction::execute($filedBy)` instead of `execute($idacct)`.

| Pros | Cons |
|---|---|
| One additive, nullable column — zero backfill, zero risk to existing rows | One migration, one model edit (`AppChangeShift::$fillable`) |
| Answers "is this roster-origin" **and** "who filed it" in one indexed, queryable column — matches the existing `cancelby` column's exact shape/purpose on the same table | |
| `approvers_menu`'s pending list can show "Filed by \<Supervisor\>" instead of nothing, and HR's filtered view (Decision 5) can query it directly | |

**Option B — Encode origin in a `docnumber` prefix (e.g. `RST` instead of `CS`), no migration**
| Pros | Cons |
|---|---|
| Zero schema change | Stringly-typed, unindexed, unparseable for "who filed it" without splitting the string; loses the filer's identity entirely unless also embedded and parsed back out |

**Recommendation: Option A.**

---

### Decision 4: Where the Dept Head → HR chain comes from

**Option A — Reuse `ResolveApproverListAction` against the filing Supervisor's own unit + position; HR configures a 2-level entry in the existing Approver Matrix for that unit/position (Recommended)**
- No new resolution code. HR opens the existing `ApproverMatrix.vue` screen, picks the Supervisor's unit and position, and adds two `ApproverList` rows: `sort: 1` → the Department Head's account, `sort: 2` → the HR validator's account (optionally with dated `ApproverSub` backups for either). `ResolveApproverListAction::execute($filedBy)` already throws a clear, existing exception — *"No approval matrix configured for \<name\>. Please contact HR..."* — if HR hasn't set this up yet, which becomes this workflow's own validation message for free.

| Pros | Cons |
|---|---|
| Zero new backend resolution logic — literally the same call every other application type makes | HR must remember to configure a matrix entry per Supervisor unit/position, or filing fails with the existing "contact HR" error (arguably correct behavior, not a con of the design) |
| The 3-tier chain is pure HR configuration, changeable without a deploy | |
| Naturally supports a chain longer or shorter than exactly 2 levels if the business ever wants that, with no code change | |

**Option B — Derive Dept Head from the org unit hierarchy (`units.idunder` → parent unit's `idhead`), HR only configures the HR tier**
- This was the design sketched in the investigation report's Addendum 2, before `ApproverMatrix`/`ResolveApproverListAction` were found. **It is superseded by Option A** — the codebase already has a purpose-built, HR-managed mechanism for exactly this, and inventing a second, parallel "who approves" derivation (org-chart-based) alongside the one every other application type already uses would itself be a duplicate-prevention violation.

| Pros | Cons |
|---|---|
| — | Builds a second "who approves" mechanism next to the one that already exists and already works; org-chart nesting doesn't necessarily match who HR actually wants approving schedules |

**Recommendation: Option A.** This also corrects the investigation report's Addendum 2, which should be read as superseded by this spec on this specific point.

---

### Decision 5: Where the Department Head and HR actually see and act on pending items

**Option A — Reuse the existing `approvers_menu` module end-to-end; add HR as a third portal prefix (Recommended)**
- Tier 2 (Dept Head) needs **zero new frontend work**: `/manager/approvers-menu/applications-request` already exists, already calls the real endpoints, and already appears for any user with `user.approver === true` ([`useSidebarLinks.ts:93-101`](../../../../resources/views/web/src/composables/useSidebarLinks.ts#L93)). Tier 3 (HR) needs one small, precedented addition: register the identical route under `/hr/approvers-menu/applications-request` and add the matching sidebar block, mirroring the existing employee/manager blocks exactly (same component, same composable, same API calls — `api/manager/getApprovalRequest`/`approveRequest` is portal-agnostic today, the same way `DutyRosterController` already serves two different portal frontends). Optionally add a `source=roster` filter param to `ApprovalRequestController::index()` (backed by the new `filed_by` column) so HR's queue can be scoped to Duty-Roster items only, since the decided workflow is explicit that HR validates rosters, not every application type.

| Pros | Cons |
|---|---|
| No new Vue pages, components, or backend routes — only a router entry + sidebar block, both copy-pasted from the existing manager block | HR's inbox shows the *same* generic card UI as every other application type unless the optional `source=roster` filter/badge is added |
| The exact same fix from Decision 1 benefits every portal that reaches this module, automatically | |
| Matches the precedent the module already sets (2 portals today, a 3rd is the same pattern) | |

**Option B — Build a dedicated "Roster Approvals" page per tier**
| Pros | Cons |
|---|---|
| Purpose-built UI, could show roster-specific context (employee grid, date range) inline | New pages, new components, new composables, for a job the existing generic inbox already does — the [duplicate-prevention](../../../rules/conditional/system-awareness.md) rule argues against this by name |

**Recommendation: Option A**, with the optional `source=roster` filter/badge from Option A's description.

---

### Decision 6: What happens to the current Draft/Publish UI

**Option A — Repurpose in place: same routes, same button, corrected meaning (Recommended)**
- `POST /duty-roster/publish` stays the same URL and the same frontend call site ([`staff_scheduler.store.ts:255-266`](../../../../resources/views/web/src/module/manager/staff_scheduler/store/staff_scheduler.store.ts#L255)); its label changes from "Publish" to **"Submit for Approval"**, and `DutyRosterController::publish()`'s body is replaced to call the new `SubmitDutyRosterHandler` instead of the current dead `where('status', 0)` bulk-update (which never matched anything — see the investigation report, Known Issue #2). The manual Draft/Published **radio button** in `StaffSchedulerDetails.vue` is removed and replaced with a **read-only status badge** showing the cell's real state (`Draft` / `Pending` / `Approved` / `Disapproved`) — status now only changes through Save (→ Draft) and Submit/Approve/Decline (→ Pending/Approved/Disapproved), never by hand-picking a radio value that was previously silently ignored anyway.

| Pros | Cons |
|---|---|
| Minimal churn — same URL, same button location, same general shape of interaction the Supervisor already has | The response message/count semantics of `publish()` change (it now reports "submitted for approval" counts, not "published" counts) — a one-line frontend toast copy change |
| Removes a second latent bug (the radio previously let a user "pick" Published, which `SaveShiftAssignmentHandler` silently ignored) | |

**Option B — Remove the Publish button and Draft/Published toggle entirely, add a distinctly new "Submit for Approval" button**
| Pros | Cons |
|---|---|
| Cleaner naming, no legacy button to repurpose | Two UI elements to change instead of one; no functional benefit over Option A |

**Recommendation: Option A.**

---

## 2.5 Acceptance Criteria

| # | Given | When | Then |
|---|-------|------|------|
| AC-1 | A Supervisor with Manager Portal access, no existing override for `EMP-001` on `2026-06-22` | `POST /api/timekeeping/duty-roster/save` with a valid shift assignment | `200`; a new `app_shift` row exists with `status = 3` (Draft), `filed_by` = the Supervisor's `accounts.id`, `approvers = null`; `Timesheet` for `(EMP-001, 2026-06-22)` is **not** modified |
| AC-2 | The Draft row from AC-1 | The Supervisor edits the same cell again (different shift) before submitting | The old `app_shift` row is deleted and a new one is created with `status = 3` (existing delete-and-replace behavior in `SaveShiftAssignmentHandler`, preserved) — exactly one Draft row exists per employee/date, never two |
| AC-3 | 3 Draft rows exist for 3 different employees on `2026-06-22`, filed by Supervisor `S1`, whose unit+position has **no** `ApproverMatrix` entry | Supervisor `S1` submits (`POST /duty-roster/publish` with the date range) | `422` `{message: "No approval matrix configured for <S1 fullname>. Please contact HR to set up the approval matrix before filing an application."}` (the existing `ResolveApproverListAction` message, unmodified); all 3 rows remain `status = 3` |
| AC-4 | The same 3 Draft rows, `S1`'s unit+position now has a 2-level matrix (`sort:1` = Dept Head `D1`, `sort:2` = HR `H1`) | `S1` submits | `200`; all 3 `app_shift` rows now have `status = 0` (Pending) and an identical `approvers` array: `[{order:1, approver:D1, status:0}, {order:2, approver:H1, status:0}]`; `Timesheet` still unchanged for all 3 |
| AC-5 | The 3 Pending rows from AC-4 | `D1` opens `/manager/approvers-menu/applications-request` | All 3 items appear with `pending: 1` (per `HandleChangeShiftQuery::pendingApproval`'s existing `order`-matching logic, unmodified) |
| AC-6 | The same 3 Pending rows | `H1` (not yet `D1`'s turn to have finished) opens their own approvers menu | The 3 items appear in `H1`'s list but with `pending: 0` — not yet actionable, since `order:1` (`D1`) has not approved yet |
| AC-7 | One Pending row, `D1` approves it | `POST /api/manager/approveRequest` with `{id, alias:'cs'}` (no client-supplied `approvers`/`count`) | `200`; the row's `approvers[0].status` becomes `1`; `approvers[1].status` stays `0`; the row's own top-level `status` **stays `0`** (still pending — `H1`'s turn); `Timesheet` still unchanged |
| AC-8 | The row from AC-7 | `H1` opens their approvers menu | The item now shows `pending: 1` for `H1` |
| AC-9 | The row from AC-7 | `H1` approves it | `200`; `approvers[1].status` becomes `1`; the row's top-level `status` becomes `1` (fully Approved); `date_approve` is stamped; **`Timesheet.idshift` for that employee/date is updated to the new shift** — the first and only point in the flow where Timesheet changes |
| AC-10 | A Pending row awaiting `D1` | A user who is **not** `D1`, not a listed `sub_approver`, and not `H1` calls `POST /api/manager/approveRequest` with that row's `id` | `403` `{message: 'You are not authorized to act on this request.'}`; the row is completely unchanged |
| AC-11 | A Pending row awaiting `D1`, with `D1` having an active `ApproverSub` covering today's date | The sub-approver (not `D1` themself) approves it | `200`, treated identically to `D1` approving — the sub-approver check already exists in `HandleChangeShiftQuery::pendingApproval`'s read side and must also be honored on write |
| AC-12 | A Pending row awaiting `D1` | `D1` declines it with `{status: 2, cancel_reason: 'Understaffed on 6/22'}` | `200`; row `status = 2` (Disapproved) immediately, regardless of `H1`'s untouched entry; `cancelby = D1`, `cancel_reason` stored; `Timesheet` untouched; the item no longer appears as actionable for `H1` |
| AC-13 | The Disapproved row from AC-12 | The Supervisor edits that same cell again | A **new** Draft (`status = 3`) row is created for that employee/date (per AC-2's delete-and-replace behavior) — this is how resubmission works, with no special "reopen" action needed |
| AC-14 | Two Draft rows for the same Supervisor, different employees, same date range | The Supervisor performs a drag-and-drop swap between two employees | `POST /duty-roster/swap` still calls `SaveShiftAssignmentHandler` twice per [`SwapShiftHandler.php:42-57`](../../../../app/Handlers/Shift/SwapShiftHandler.php#L42) — both resulting rows are `status = 3` (Draft), not instantly Approved as today; they are included in the same "Submit for Approval" action like any other Draft cell |
| AC-15 | A Draft row exists for a date that falls inside a **locked** pay period (`GetPeriodLockStatusQuery` reports locked for that date) | The Supervisor attempts to submit | `422` `{message: 'Cannot submit roster changes for a locked pay period.'}`; the row stays Draft |
| AC-16 | A Pending row for a date inside a pay period that becomes locked **after** submission but before approval | `D1` or `H1` attempts to approve | `422` with the same locked-period message; the row stays Pending, unresolved, until the period is unlocked or an HR override process is used (out of scope — §8) |
| AC-17 | Two browser tabs open on the same Pending row awaiting `D1` | Both click Approve within the same request window | Exactly one request succeeds (`200`); the other receives `409` `{message: 'This request has already been processed.'}` — the conditional `where('status', 0)` guard inside the transaction prevents double-processing |
| AC-18 | Same setup as AC-4 | `GetDutyRosterQuery::execute()` is called for that date range | The grid cell for each of the 3 employees shows `status: 'Draft'` before submission, `'Pending'` after submission and before final approval, `'Approved'` after `H1` signs off — [`GetDutyRosterQuery::mapShiftToRoster()`](../../../../app/Queries/Shift/GetDutyRosterQuery.php#L216) gains a `status == 3 → 'Draft'` branch alongside its existing `1/2/else` mapping |
| AC-19 | Same setup | `DutyRosterController::metrics()` is called for a date in range while the row is Draft or Pending | The employee is **not** counted as `workingToday`/`totalScheduled` from this override — metrics only reflects `status == 1`, matching its existing behavior for pending change-shift overrides today (unchanged; documented, not modified, by this spec) |
| AC-20 | A fresh database with the `filed_by` migration applied | Any pre-existing `app_shift` row created before this change | `filed_by IS NULL` — no backfill needed, no existing row's meaning changes |
| AC-21 | `POST /duty-roster/save` payload | `employeeId` or `date` is null/absent | `422` — unchanged from today's existing `$request->validate([...])` in `DutyRosterController::store()` |
| AC-22 | `POST /duty-roster/publish` (Submit for Approval) payload | `startDate`/`endDate` malformed or missing | `422` — unchanged existing validation |
| AC-23 | `POST /api/manager/approveRequest` payload | `id` does not exist, or `alias` is not one of the five valid aliases | `422` `{message: '<Alias> request not found'}` (existing behavior in `store()`, preserved) |
| AC-24 | The HR portal, a user with `user.approver === true` via an `ApproverList`/`ApproverSub` entry | Logs into HR portal | Sidebar shows an "Approvers Menu" section under `/hr/approvers-menu/*`, mirroring the existing employee/manager blocks; visiting it renders the same `ApplicationRequest.vue` page |
| AC-25 | The optional `source=roster` filter | `GET /api/manager/getApprovalRequest?filter=cs&source=roster` | Only `cs`-alias records with non-null `filed_by` are returned; a plain self-filed Change Shift application (`filed_by IS NULL`) is excluded |
| AC-26 | An unauthenticated request | Any `/api/manager/getApprovalRequest` or `/approveRequest` call | `401` `{status: 401, message: 'Unauthenticated.'}`, unchanged from today |
| AC-27 | `SubmitDutyRosterHandler` | Called with zero Draft rows matching the Supervisor + date range (e.g. already submitted, or nothing was ever saved) | `200` with `count: 0` and a message indicating nothing was pending submission — not an error |
| AC-28 | `AppChangeShift::$fillable` | Code review / `php artisan tinker` inspection | Includes `filed_by` |
| AC-29 | The frontend `approveItems()` payload after the Decision 1 fix | Inspected via network tab or code | Contains only `{id, alias}` per item — no `approvers` array, no `count` field sent from the client |
| AC-30 | Migration file for `filed_by` | `php artisan migrate` on a database that already has `app_shift` | Succeeds without touching any other column; `php artisan migrate:rollback` cleanly drops only that column |

---

## 3. Database

### 3a. `app_shift` — **reused**, one additive column

| Column | Status | Type | Notes |
|---|---|---|---|
| `id`, `docnumber`, `idacct`, `oldshiftid`, `newshiftid`, `date`, `remarks`, `file`, `idpayperiod`, `cancelby`, `cancel_at`, `cancel_reason`, `date_approve`, `timestamps` | reuse | — | Unchanged |
| `approvers` | reuse | json nullable | Unchanged shape — `[{order, approver, status, sub_approver?}]`, resolved via `ResolveApproverListAction` |
| `status` | reuse, **new value added** | tinyint, default `0` | Comment updated to `0: pending, 1: approved, 2: disapproved, 3: draft` |
| `filed_by` | **new** | int nullable, indexed | `NULL` = ordinary self-filed application (unaffected). Non-null = Duty-Roster-originated; holds the filing Supervisor's `accounts.id`. Used both to resolve the approver chain against the *filer* (Decision 3/4) and to scope HR's queue (Decision 5) |

Migration: `database/migrations/table/app_shift/<timestamp>_add_filed_by_to_app_shift_table.php` — `Schema::table('app_shift', fn ($t) => $t->integer('filed_by')->nullable()->index('idx_app_shift_filed_by')->after('idacct'))`, guarded with `Schema::hasColumn`. No DB-level foreign key — SubHRMS convention.

### 3b. `approver_matrix` / `approver_list` / `approver_sub` — **reused, read-only from this feature**

No schema change. HR configures these exactly as they do today for every other application type, via the existing `ApproverMatrix.vue` screen — this spec adds no new configuration UI. The only requirement this spec places on HR is operational: **a matrix entry must exist for the filing Supervisor's unit + position** before that Supervisor can submit a roster (AC-3), exactly the same precondition Change Shift/Leave/OT already have.

---

## 4. Backend

### 4a. Models

- **`App\Models\AppChangeShift`** — *reuse, edit*: add `filed_by` to `$fillable`.
- **Reused as-is:** `ApproverMatrix`, `ApproverList`, `ApproverSub`, `AccountDetailVW`, `Unit`, `Shift`, `Timesheet`.

### 4b. Actions

- **`App\Actions\Approver\ResolveApproverListAction`** — *reused unmodified*. Called as `ResolveApproverListAction::execute($filedBy)` (the Supervisor's own id), not the scheduled employee's id.
- **`App\Actions\Shift\SyncTimesheetShiftAction`** — *new*, extracted from the Timesheet-upsert block currently inline in [`SaveShiftAssignmentHandler.php:63-70`](../../../../app/Handlers/Shift/SaveShiftAssignmentHandler.php#L63): `execute($idacct, $date, $shiftId)` → `Timesheet::updateOrCreate(...)`. Called from `ApprovalRequestController::store()` only when a `cs`-alias, non-null-`filed_by` record reaches final `status = 1` (AC-9). `SwapShiftHandler`'s and any other non-Duty-Roster caller of `SaveShiftAssignmentHandler` that still needs an instant Timesheet write (none remain after this spec — swap now goes through Draft too) would call it directly; extracting it is what lets both call sites share the logic instead of duplicating the upsert, per [duplicate-prevention](../../../rules/conditional/system-awareness.md).

### 4c. Handlers

| Handler | Change |
|---|---|
| `App\Handlers\Shift\SaveShiftAssignmentHandler` | *Edit*: `status` defaults to `3` (Draft) instead of the hardcoded `1`; `approvers` stays `null` until submission; **remove** the unconditional `Timesheet::updateOrCreate` call — Timesheet is now only touched by `SyncTimesheetShiftAction` on final approval (Decision 2, AC-1/AC-9). `filed_by = Auth::id()` is set on create. |
| `App\Handlers\Shift\SwapShiftHandler` | *Unchanged code* — its two `SaveShiftAssignmentHandler::execute()` calls automatically inherit the new Draft-by-default behavior (AC-14). |
| `App\Handlers\Shift\SubmitDutyRosterHandler` | *New*. `execute($filedBy, $startDate, $endDate)`: finds every `app_shift` row where `filed_by = $filedBy` and `status = 3` within the date range; if none, returns `{count: 0}` (AC-27); otherwise checks the period-lock status for the range via `GetPeriodLockStatusQuery` (AC-15), calls `ResolveApproverListAction::execute($filedBy)` **once**, and updates every matching row to `status = 0` with that same `approvers` array. Wrapped in `DB::transaction`. |
| `App\Http\Controllers\manager\ApprovalRequestController::store()` | *Edit* (Decision 1): re-derive the actionable order server-side instead of trusting `$item['approvers']`/`$item['count']`; verify `Auth::id()` is the current order's `approver` or an active `sub_approver` (`403` otherwise, AC-10); on approve, flip only the current order's entries to `status: 1`, and only flip the record's own `status` to `1` once every entry is `1`; on decline, set `status: 2` immediately regardless of remaining entries; guard both paths with a conditional `where('status', 0)` update inside the transaction (AC-17); when the record's `alias === 'cs'` and `filed_by` is non-null and the update reaches final `status = 1`, call `SyncTimesheetShiftAction::execute($record->idacct, $record->date, $record->newshiftid)` (AC-9). Also check the period-lock status for the record's `date` before allowing approve/decline (AC-16). |
| `App\Queries\ChangeShift\HandleChangeShiftQuery::pendingApproval()` | *Edit*: add `filed_by` to the `select()` list (so the frontend/HR queue can display "Filed by \<name\>" and filter on it); support an optional `$onlyRosterOrigin` flag that adds `->whereNotNull('app_shift.filed_by')` (Decision 5, AC-25). |
| `App\Http\Controllers\manager\ApprovalRequestController::index()` | *Edit*: accept an optional `source=roster` query param, passed through to `pendingApproval()`'s new flag. |
| `App\Queries\Shift\GetDutyRosterQuery::mapShiftToRoster()` / the Priority-2 branch in `execute()` | *Edit*: add a `status == 3 → 'Draft'` branch alongside the existing `1 → 'Approved'`, `2 → 'Disapproved'`, else `'Pending'` mapping (AC-18). |
| `App\Http\Controllers\tk\DutyRosterController::publish()` | *Edit* (Decision 6): body replaced to call `SubmitDutyRosterHandler::execute(Auth::id(), $startDate, $endDate)` instead of the current dead `AppChangeShift::where('status', 0)->update(...)`. Same route, same validation, corrected implementation. |

### 4d. Routes

`routes/api/timekeeping.php` — no new lines; `publish` is edited in place (§4c).
`routes/api/manager.php` — no new lines; `getApprovalRequest`/`approveRequest` are edited in place, not re-registered.
No new backend routes are added anywhere. The only routing change in this spec is a **frontend** router entry (§5).

---

## 5. Frontend

### 5a. `manager/staff_scheduler` — *edit, no new files*

- [`StaffSchedulerDetails.vue`](../../../../resources/views/web/src/module/manager/staff_scheduler/components/StaffSchedulerDetails.vue): remove the Draft/Published radio ([lines 118-141](../../../../resources/views/web/src/module/manager/staff_scheduler/components/StaffSchedulerDetails.vue#L118)); replace the "Publishing Status" block with a read-only badge covering all four real states (`Draft` amber, `Pending` slate, `Approved` teal, `Disapproved` rose).
- [`StaffSchedulerGrid.vue`](../../../../resources/views/web/src/module/manager/staff_scheduler/components/StaffSchedulerGrid.vue): the existing `status === 'Draft'` badge check ([line 161](../../../../resources/views/web/src/module/manager/staff_scheduler/components/StaffSchedulerGrid.vue#L161)) gains sibling badges for `Pending` and `Disapproved`, matching the color language already established for Draft.
- [`StaffSchedulerHeader.vue`](../../../../resources/views/web/src/module/manager/staff_scheduler/components/StaffSchedulerHeader.vue): the "Publish" button label changes to **"Submit for Approval"**.
- [`staff_scheduler.store.ts`](../../../../resources/views/web/src/module/manager/staff_scheduler/store/staff_scheduler.store.ts): `publishRoster()` toast copy changes from "Roster published! N draft schedules activated." to "N schedule(s) submitted for approval." — no call-site or endpoint change.
- [`types.staff_scheduler.ts`](../../../../resources/views/web/src/module/manager/staff_scheduler/types/types.staff_scheduler.ts): `EditForm.status` and `ShiftAssignment.status` narrow from `string` to `'Draft' | 'Pending' | 'Approved' | 'Disapproved'`.

### 5b. `approvers_menu` — *edit, no new pages*

- [`useApplicationRequest.ts::approveItems()`](../../../../resources/views/web/src/module/approvers_menu/composables/useApplicationRequest.ts#L85): payload simplifies to `{data: items.map(i => ({id: i.id, alias: i.alias || i.filter}))}` — no more client-constructed `approvers`/`count` (AC-29), matching the server-owned state transition from Decision 1.
- [`ApprovalRequestCard.vue`](../../../../resources/views/web/src/module/approvers_menu/components/ApprovalRequestCard.vue): when `item.filed_by` is present, show a small "Filed by \<name\>" line (surfaces the new field from §4c without changing the card's overall layout).

### 5c. New: mount `approvers_menu` under the HR portal — *routing + sidebar only*

```
resources/views/web/src/module/approvers_menu/route/    ← if a dedicated route file doesn't already exist,
                                                            add one entry pointing '/hr/approvers-menu/...'
                                                            at the SAME pages already used by /manager/approvers-menu/*
```

- `useSidebarLinks.ts`: add an HR-portal sidebar block mirroring [lines 93-101](../../../../resources/views/web/src/composables/useSidebarLinks.ts#L93) exactly (`condition: user?.approver === true`, `routePrefix: "/hr/approvers-menu"`), so HR-configured approvers see the identical "Applications Request" / "Logsheet" / "Cancellation" entries.
- No new `.vue` files, no new composables, no new API methods — this is the whole of the HR-side frontend work (Decision 5).

### 5d. Layout sketch — status badge on the roster grid (unchanged structure, corrected states)

```text
┌─────────────────────────────────────────────────────────┐
│  Maria Santos          Mon 22    Tue 23    Wed 24        │
│                       ┌────────┐┌────────┐┌────────┐     │
│                       │Morning ││Morning ││Morning │     │
│                       │08-17   ││08-17   ││08-17   │     │
│                       │[Draft] ││[Pending││[Approv]│     │
│                       └────────┘└────────┘└────────┘     │
└─────────────────────────────────────────────────────────┘
Draft = amber (existing) · Pending = slate · Approved = teal · Disapproved = rose
```

---

## 6. Business Rules & Edge Cases

### 6a. Domain rules

1. **Filing is per-cell; submission is per-batch.** Each employee/date keeps its own `app_shift` row (matching every other Duty-Roster mechanic already in place); "submit" is a bulk transition of the filer's own Draft rows in a date range, not a new grouping entity.
2. **The approver chain is resolved once per submission, against the filer**, not once per employee being scheduled. Two Supervisors submitting rosters that both touch the same employee get **independently** resolved chains, based on each Supervisor's own unit/position.
3. **A decline at any tier stops the whole chain immediately** — it does not matter whether earlier tiers already approved. This is a deliberate deviation from "only the current tier's decision matters" because a schedule that Dept Head already approved but HR later disapproves should not partially apply.
4. **Resubmission has no special "reopen" action.** A Disapproved (or Approved-then-changed) cell is edited exactly like any other cell; the existing delete-and-replace behavior in `SaveShiftAssignmentHandler` naturally creates a fresh Draft, which must be submitted again like any new filing (AC-13).
5. **Timesheet reflects the schedule only once it is fully approved**, never while Draft or Pending. This corrects a pre-existing bug where `SaveShiftAssignmentHandler` updates `Timesheet` unconditionally today, regardless of approval status.
6. **Portal separation**: filing stays exclusively a Manager Portal action (Supervisor role); the approval/validation UI is the existing portal-agnostic `approvers_menu`, reachable from Manager and (after this spec) HR, gated by `user.approver`, not by portal.
7. **Swap is treated identically to assign/edit** — both employees' resulting cells go through the same Draft → Submit → Approve chain; a swap is not a shortcut around approval.

### 6b. Edge cases

| Edge case | Handling |
|---|---|
| Supervisor submits a range where some cells are Draft and others are already Pending/Approved from an earlier submission | Only `status = 3` rows are picked up (AC-27); already-Pending/Approved rows are left untouched |
| HR has configured only 1 approver level (not 2) for a given unit/position | The chain resolves and completes after that single level approves — the 3-tier shape is a matrix **configuration**, not a hardcoded depth; a unit that only needs Dept Head sign-off is valid |
| The Dept Head and the HR validator are configured as the **same person** | Both `order` entries carry the same `approver` id; that person approves twice (once per order) since each order-level's `status` is tracked independently — no special-casing needed |
| A Supervisor is also configured as an approver for their own submission (self-approval loophole) | Not blocked by this spec — HR's matrix configuration is the control point; flagged in §8 as worth an HR-configuration validation, not a backend rule |
| An employee named in a roster cell separates/is deactivated before approval completes | Out of scope for this spec — matches how the rest of the system currently handles a separated employee's pending records (no special handling exists elsewhere either) |
| `entries=-1` / bulk-import (`storeBulk`) still calls `SaveShiftAssignmentHandler` in a loop | Every imported row also lands as Draft, `filed_by` = the importing user; it must also be explicitly submitted — bulk import is not a backdoor around approval |

### 6c. Non-Functional & Failure-Mode Checklist

| Category | Answer |
|---|---|
| **Authorization** | Filing (`/duty-roster/save`, `/swap`, `/publish`) stays behind the existing `auth:sanctum` + `manager`-prefix group — unchanged, no portal-role check exists today for this endpoint and this spec does not add one (consistent with the rest of the codebase, per the same reasoning `incident_report.md` §6c documents system-wide). Approve/decline (`approveRequest`) gains a **new, real** ownership check (Decision 1): `403 {message: 'You are not authorized to act on this request.'}` for anyone not currently the actionable approver or an active sub-approver — this is a net-new protection, not a relaxation. |
| **Concurrency / double-submit** | Submission: wrapped in `DB::transaction`; re-running submit on an already-submitted range is a no-op (AC-27, nothing left in Draft to pick up). Approval: a conditional `where('status', 0)` update inside the transaction means a double-click or two sub-approvers racing on the same entry results in exactly one `200` and one `409` (AC-17). |
| **Idempotency on retries** | A replayed `POST /duty-roster/save` for the same employee/date is safe by construction — it deletes-then-recreates the same Draft cell (AC-2), not a duplicate. A replayed `approveRequest` on an already-processed record hits the same `409` conditional guard as the concurrency case. A replayed `SubmitDutyRosterHandler` call is a no-op once nothing remains in Draft (AC-27). |
| **Error response shape & status codes** | No approval matrix configured: `422` with the existing `ResolveApproverListAction` message verbatim (AC-3). Not authorized to act: `403` (AC-10, new). Already processed / lost race: `409` (AC-17, new). Locked pay period: `422` with an explicit message (AC-15/AC-16, new). Validation failures on `save`/`publish`: `422`, unchanged Laravel default shape. Not-found alias/id on approve: `422 {message: '<Alias> request not found'}`, unchanged. Unauthenticated: `401`, unchanged. |
| **Input validation boundaries** | `SubmitDutyRosterHandler`'s date range: malformed dates rejected by the existing `$request->validate(['startDate' => 'required|date_format:Y-m-d', ...])` on `publish`, unchanged. `approveRequest`'s `id`: non-existent → `422` (existing); not one of the 5 known aliases → `422` (existing, `$aliases[$alias] ?? null` check). `filed_by`: always server-set from `Auth::id()`, never accepted from client input on `save` — a request cannot forge who filed a cell. |

---

## 7. Build Order

Dependency-first. Steps 1-6 are `/webkit.backend-implement`; step 7 is the Gate-1 frontend pass; step 8 is Gate-2 wiring (mostly relabeling, since no new API contract is introduced); step 9 verifies.

1. **Migration** — additive `app_shift.filed_by`, nullable, indexed.
2. **Models** — `AppChangeShift::$fillable` += `filed_by`.
3. **Actions** — extract `SyncTimesheetShiftAction` from `SaveShiftAssignmentHandler`'s current inline Timesheet upsert.
4. **Handlers** — edit `SaveShiftAssignmentHandler` (Draft-by-default, `filed_by`, drop the unconditional Timesheet write); add `SubmitDutyRosterHandler`; `SwapShiftHandler` needs no code change (inherits behavior).
5. **The Decision-1 fix** — rewrite `ApprovalRequestController::store()`'s approve/decline logic (ownership check, server-owned sequencing, conditional update, `SyncTimesheetShiftAction` hook on final `cs` approval, period-lock check); edit `HandleChangeShiftQuery::pendingApproval()` for `filed_by` + the `$onlyRosterOrigin` flag; edit `index()` for `source=roster`. **Regression-test the other 4 alias types** (leave/OT/OBT/adjustment) against this shared-controller change before proceeding.
6. **Controller wiring** — `DutyRosterController::publish()` calls `SubmitDutyRosterHandler`; `GetDutyRosterQuery::mapShiftToRoster()` gains the Draft branch. Verify AC-1 → AC-27.
7. **Frontend Gate 1 (static)** — the manager-side badge/label/type changes (§5a) and the `approvers_menu` payload simplification (§5b) against the corrected contract; user validates the design.
8. **Frontend Gate 2 (live)** — confirm the manager-side calls already point at the (unchanged-URL, corrected-behavior) endpoints; add the HR portal router entry + sidebar block (§5c). Verify AC-24, AC-25, AC-29.
9. **Verify** — `/webkit.verify` against this spec (pay particular attention to AC-5/AC-6/AC-7/AC-8/AC-9, the sequencing chain — this is the one behavior a superficial test could easily get wrong), then `/webkit.code-review` on the branch diff, with extra scrutiny on `ApprovalRequestController::store()` given it is shared by 4 other application types.

---

## 8. Out of Scope (Future Specs)

- **Fixing the Manager Dashboard's Approvals widget** (`Dashboard.vue`/`dashboard.api.ts` calling a nonexistent `api/manager/dashboard/approvals/*` route, falling back to `MOCK_PENDING`) — a real, separate, pre-existing defect discovered during this investigation (§1), unrelated to Duty Roster specifically. Its own spec.
- **Consolidating the two duplicate Duty Roster frontends** (Manager Portal vs. Timekeeping/Applications) — tracked in the investigation report's Addendum 1, orthogonal to the approval workflow.
- **Preventing self-approval loopholes in HR's Approver Matrix configuration** (a Supervisor configured as their own approver) — flagged in §6b, left as an HR-configuration-discipline concern for now.
- **Locked-pay-period override/exception process** for HR to force-approve a roster change inside an already-closed period (AC-16 currently just blocks it outright).
- **Notifications** — email/in-app alert to the next tier when a submission reaches their turn, or to the Supervisor on decline.
- **Roster-specific approver-matrix UI** — a Duty-Roster-flavored view of `ApproverMatrix.vue` (e.g. pre-filtered to Supervisor positions) rather than the generic HR screen used today.
- **Bulk-approve UI** for an approver to act on multiple roster cells from one submission in a single click (the backend already supports a `data: [...]` array per `approveRequest` call — this is a frontend selection-UI enhancement only).

---

## 9. Definition of Done

- [ ] Every row in the **Acceptance Criteria** table passes (AC-1 … AC-30)
- [ ] Every category in the **Non-Functional & Failure-Mode Checklist** is addressed — answered or explicitly `N/A because ...`
- [ ] Regression-checked: Leave, Overtime, Official Business Trip, and Attendance-Adjustment approval flows still work correctly after the `ApprovalRequestController::store()` rewrite (Decision 1) — a shared-controller change, not additive-only
- [ ] `grep -rn "MOCK_PENDING" resources/views/web/src/module/manager/dashboard` is **unaffected by this spec** (confirmed still present, tracked separately per §8 — not silently fixed as a side effect and not silently left broken without a tracked follow-up)
- [ ] No open findings from adversarial verification — see the latest `.agents/reports/manager-duty_roster_approval-verify-<date>.md`
