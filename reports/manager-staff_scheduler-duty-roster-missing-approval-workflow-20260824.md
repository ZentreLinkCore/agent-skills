# Investigation Report: Duty Roster (Manager Portal) Missing Approval Workflow

## 1. Summary
- **Investigation Type**: Feature Gap / Architecture (missing approval workflow)
- **Project**: SubHRMS
- **Target Portal/Domain & Module**: Manager Portal — `staff_scheduler` (Duty Roster, Assign Shifts, Roster Uploader)
- **Confidence Level**: High — every claim below is backed by a concrete file/line reference; the "no approval" behavior is verifiable by reading the handler in isolation (`status = 1` is hardcoded with no conditional).

## 2. Issue Description
- **Expected Behavior**: A duty roster feature that changes an employee's schedule should carry the same review/approval semantics as every other schedule-affecting request in the system (shift-change requests, leaves, OT, adjustments, OBT all flow through a pending → approved/disapproved lifecycle with a recorded approver). A manager assembling a roster should be able to see requests awaiting a decision and approve/reject them from the roster itself, and a genuine draft/publish cycle should exist for schedules not yet finalized.
- **Actual Behavior**: The Duty Roster page's own "Assign/Edit/Swap Shift" actions **write directly to `Approved` status with no review step**, self-approving whatever the manager enters. Meanwhile, real pending requests from employees (via the shift-change/leave systems) are displayed as read-only "Pending"/"Disapproved" labels on the roster grid with **no Approve/Reject control anywhere in the Duty Roster UI**. A "Publish Draft Roster" button exists in the header but is dead — nothing ever creates a Draft record for it to publish.
- **Steps to Reproduce**:
  1. As a manager, go to Manager Portal → Staff Scheduler → Duty Roster.
  2. Click any cell → "Assign Shift" → Save. Observe: the assignment immediately shows as approved/normal on the grid; no pending/review state, no separate approver.
  3. Note an employee-submitted shift-change or leave request rendered on the grid with a "Pending" or "Disapproved" look — there is no button in the inspector panel (`StaffSchedulerDetails.vue`) to approve or reject it.
  4. Click "Publish" in the header. It reports `0 draft schedules activated` because no code path ever creates a Draft (`status = 0`) record.

## 3. Root Cause Analysis

### Symptom
The Duty Roster page "feels incomplete" specifically around approvals: nothing the manager does there ever needs sign-off, and nothing an employee submits can be acted on from there either.

### Discovered Code / Evidence

**(A) Roster saves self-approve, bypassing the app's existing approval pipeline.**
The system already has a generic, working approval pipeline for schedule-affecting requests:
- [ApprovalRequestController.php:26-66](app/Http/Controllers/manager/ApprovalRequestController.php#L26) (`GET /api/manager/getApprovalRequest`) aggregates pending shift-change (`cs`), leave, overtime, OBT, and adjustment requests via `HandleChangeShiftQuery::pendingApproval()` and friends.
- [ApprovalRequestController.php:68-139](app/Http/Controllers/manager/ApprovalRequestController.php#L68) (`POST /api/manager/approveRequest`) is the real approve/decline action: sets `status = 1` + `date_approve` on approve, `status = 2` + `cancelby`/`cancel_reason` on decline, and persists `approvers`.
- This is currently only wired into the **Manager Dashboard's** approvals widget ([Dashboard.vue:328](resources/views/web/src/module/manager/dashboard/pages/Dashboard.vue#L328) calls `api.approveRequest(approval.id, approval.type)`), not into Duty Roster at all.

The Duty Roster's own write path ignores this pipeline completely:
- [SaveShiftAssignmentHandler.php:59](app/Handlers/Shift/SaveShiftAssignmentHandler.php#L59) — `$changeShift->status = 1; // Approved` is **hardcoded**, along with `date_approve = Carbon::now()` (line 60) and `approvers = json_encode([])` (line 58, always empty). This runs for every "Assign Shift" and every "Edit Schedule" save from `DutyRoster.vue` / `StaffSchedulerDetails.vue`.
- [SwapShiftHandler.php:42-57](app/Handlers/Shift/SwapShiftHandler.php#L42) explicitly passes `'status' => 'Approved'` into two `SaveShiftAssignmentHandler::execute()` calls for every drag-and-drop swap — again no review step.
- Result: every `app_shift` (`AppChangeShift`) row the manager creates via Duty Roster is born already "Approved," with an `approvers` field that is always `[]`, unlike every other approval-pathway record in the system.

**(B) Genuine pending requests are shown but not actionable on this screen.**
- [GetDutyRosterQuery.php:142-170](app/Queries/Shift/GetDutyRosterQuery.php#L142) already resolves and labels real pending/disapproved states for the grid: leave `status != 1/2` → `'Pending'` (line 145), shift-change `status == 0` → `'Pending'`, `status == 2` → `'Disapproved'` (line 166). So the backend is aware these need a decision.
- But [StaffSchedulerDetails.vue:117-141](resources/views/web/src/module/manager/staff_scheduler/components/StaffSchedulerDetails.vue#L117) — the only edit surface on this page — offers just a **Draft / Published radio toggle**, no Approve/Reject action, and no distinct "Pending" state at all. [StaffSchedulerGrid.vue:161-165](resources/views/web/src/module/manager/staff_scheduler/components/StaffSchedulerGrid.vue#L161) special-cases only `status === 'Draft'` for a badge; `'Pending'` and `'Disapproved'` render with no special affordance.
- The `ShiftAssignment.status` type ([types.staff_scheduler.ts:13-18](resources/views/web/src/module/manager/staff_scheduler/types/types.staff_scheduler.ts#L13)) is a bare `string`, so the frontend never modeled "Pending" as a first-class state to build a UI around.

**(C) The Draft → Publish flow is dead code.**
- [DutyRosterController.php:333-375](app/Http/Controllers/tk/DutyRosterController.php#L333) (`publish()`) bulk-updates `AppChangeShift::where('status', 0)` (Draft) to `1` (Published) for the manager's unit within a date range.
- But nothing ever writes `status = 0` — (A) above shows `SaveShiftAssignmentHandler` always writes `status = 1` regardless of the `Draft`/`Published` value the UI sends. The `formData.status` sent from `handleSaveShift` ([staff_scheduler.store.ts:204-218](resources/views/web/src/module/manager/staff_scheduler/store/staff_scheduler.store.ts#L204)) is accepted by the controller/handler but never actually changes what gets persisted.
- Consequence: clicking "Publish" in [StaffSchedulerHeader](resources/views/web/src/module/manager/staff_scheduler/pages/duty_roster/DutyRoster.vue#L19) → `publishRoster()` ([staff_scheduler.store.ts:255-266](resources/views/web/src/module/manager/staff_scheduler/store/staff_scheduler.store.ts#L255)) will reliably report `0 draft schedules activated`. This is the feature that most looks like "there should be an approval/publish step here" and is the most visibly broken.

**(D) Two more stubs reinforce the "kulang" impression (lower priority, same module):**
- `exportRoster()` ([staff_scheduler.store.ts:268](resources/views/web/src/module/manager/staff_scheduler/store/staff_scheduler.store.ts#L268)) only shows a success toast — no file is generated or downloaded.
- `DutyRosterController::upload()` ([DutyRosterController.php:380-415](app/Http/Controllers/tk/DutyRosterController.php#L380)) returns a fixed, hardcoded array of "parsed" rows regardless of the file the manager actually uploads in the Roster Uploader page — bulk import validation is fully mocked.

### Root Cause
The Duty Roster module (`manager/staff_scheduler`) was built as a **self-contained scheduling tool with its own status vocabulary (`Draft`/`Published`)** instead of being wired into the pre-existing, shared approval pipeline (`AppChangeShift` status 0/1/2 + `ApprovalRequestController`) that the rest of the timekeeping domain already uses for shift changes. Its own "Draft" concept was never actually implemented server-side, so it manifests as a non-functional Publish button, and it has no UI to act on the *real* pending records that already exist in the data it queries.

## 4. Scope & Dependencies

- **Affected Files**:
  - `app/Handlers/Shift/SaveShiftAssignmentHandler.php`
  - `app/Handlers/Shift/SwapShiftHandler.php`
  - `app/Http/Controllers/tk/DutyRosterController.php` (`publish`, `upload`)
  - `resources/views/web/src/module/manager/staff_scheduler/components/StaffSchedulerDetails.vue`
  - `resources/views/web/src/module/manager/staff_scheduler/components/StaffSchedulerGrid.vue`
  - `resources/views/web/src/module/manager/staff_scheduler/store/staff_scheduler.store.ts`
  - `resources/views/web/src/module/manager/staff_scheduler/types/types.staff_scheduler.ts`
- **Affected Database Tables / Models**: `app_shift` (`AppChangeShift` model — `status`, `approvers`, `date_approve`, `cancelby`, `cancel_reason`), `timesheet` (written unconditionally alongside every roster save).
- **Affected API Endpoints**: `POST /api/timekeeping/duty-roster/save`, `/swap`, `/publish`, `/upload`, `/save-bulk`. Related-but-not-integrated: `GET /api/manager/getApprovalRequest`, `POST /api/manager/approveRequest`.
- **Affected UI Views**: Manager Portal → Staff Scheduler → Duty Roster, Assign Shifts, Roster Uploader. Indirectly related: Manager Dashboard's Approvals widget (the only place approvals currently work, but it doesn't cover manager-initiated roster edits at all — only employee-submitted requests).

## 5. Existing Solutions Found (Do Not Duplicate)
Per `.agents/rules/conditional/system-awareness.md`, the fix must **reuse**, not reinvent, what's already there:
- The approve/decline **status semantics and side effects** (`status` 0/1/2, `approvers`, `date_approve`, `cancelby`/`cancel_reason`) are already fully defined and working in `ApprovalRequestController::store()` ([app/Http/Controllers/manager/ApprovalRequestController.php:68](app/Http/Controllers/manager/ApprovalRequestController.php#L68)) and `HandleChangeShiftQuery` ([app/Queries/ChangeShift/HandleChangeShiftQuery.php](app/Queries/ChangeShift/HandleChangeShiftQuery.php)). Any fix should call into or extract from this logic rather than adding a second, parallel status convention.
- `GetDutyRosterQuery::mapShiftToRoster()` ([app/Queries/Shift/GetDutyRosterQuery.php:216](app/Queries/Shift/GetDutyRosterQuery.php#L216)) already computes the correct `Pending`/`Approved`/`Disapproved` label per cell — the frontend gap is that nothing acts on it, not that the data is missing.

## 6. Potential Solutions

| Option | Description | Pros | Cons | Risk & Complexity |
|---|---|---|---|---|
| **Option A (Recommended): Wire Duty Roster into the existing approval pipeline** | Make manager-initiated Duty Roster changes create a real pending (`status = 0`) `AppChangeShift` record instead of hardcoding `status = 1`; add Approve/Reject actions in `StaffSchedulerDetails.vue` for cells whose status is `Pending`/`Disapproved`, calling the existing `POST /api/manager/approveRequest` (or a duty-roster-scoped wrapper around the same `HandleChangeShiftQuery`/status logic) rather than a new endpoint. Remove or properly implement the Draft/Publish toggle so it's consistent with real status values. | Reuses proven logic (satisfies the project's reuse-before-creating rule); one consistent status model across the whole timekeeping domain; closes the exact gap the user flagged. | Touches both backend handler and several frontend components; needs a decision on whether *manager self-assignments* should require approval too, or only employee-submitted requests (see Risk Assessment). | Medium |
| Option B: Keep roster self-approving, only add Approve/Reject buttons for existing pending items | Leave `SaveShiftAssignmentHandler` as-is (manager assignments stay instantly approved); only add UI in `StaffSchedulerDetails.vue`/`StaffSchedulerGrid.vue` to call `approveRequest` for cells already flagged `Pending`/`Disapproved` from employee-submitted requests. | Much smaller diff; no change to the manager's existing "instant assign" muscle memory. | Doesn't address that a manager's own bulk/roster edits carry zero oversight — likely to be reported as "still missing approval" if that was part of the ask; leaves the dead Draft/Publish button unresolved. | Low |
| Option C: No action / defer | Leave as-is; document the gap. | Zero engineering cost. | Directly ignores the user's stated concern; "Publish" stays visibly broken (reports 0 every time), which looks like a bug even if approval scope is deferred. | None |

### Recommended Solution Rationale
Option A is the only one that removes the actual defect (a hardcoded self-approval bypassing the system's real approval status) rather than papering over the symptom. It also directly satisfies this repo's standing rule to extend existing logic (`HandleChangeShiftQuery`, `ApprovalRequestController::store`) instead of inventing a parallel `Draft`/`Published` vocabulary that was never finished. The scope (which actions require approval vs. which stay instant) is a product decision — see the clarifying question below — but the mechanism to reuse is unambiguous.

## 7. Risk Assessment
- **Breaking Changes**: Yes, if manager-initiated assignments start requiring approval — any manager relying on "assign and it's live immediately" changes behavior. This needs a product decision (see below) before implementation.
- **Regression Potential**: `SaveShiftAssignmentHandler` is shared by `store()`, `swap()`, and `storeBulk()` — changing its default status affects all three call sites and the Timesheet write that happens alongside it ([SaveShiftAssignmentHandler.php:63-70](app/Handlers/Shift/SaveShiftAssignmentHandler.php#L63)). Need to decide whether Timesheet should also wait for approval or continue to reflect the tentative assignment immediately.
- **Deployment & Migration Notes**: No schema changes needed — `app_shift.status`, `approvers`, `date_approve`, `cancelby`, `cancel_reason` already exist and are used elsewhere. Pure application-logic change.
- **Testing Requirements**: PHPUnit coverage for `SaveShiftAssignmentHandler`/`SwapShiftHandler` status behavior (none currently found — verify with `grep -r SaveShiftAssignmentHandler tests/`); manual verification per checklist below. No JS test runner is configured for SubHRMS beyond manual QA of the Vue components.
- **Rollback Complexity**: Low — revert the handler/controller/UI diffs; no destructive data migration involved.

## 8. High-Level Implementation Plan
*(Not executed by this investigation — for `/webkit.fix` or `/webkit.backend-implement` to pick up.)*

1. `[ ]` **Clarify scope** (blocking): does a manager's own Duty Roster assignment need approval by someone else (e.g. HR/department head), or should approval only apply to *employee-submitted* shift-change/leave requests that surface on the roster? This changes whether `SaveShiftAssignmentHandler` needs a status change at all.
2. `[ ]` Modify `SaveShiftAssignmentHandler::execute()` to stop hardcoding `status = 1` — either accept the real status from context (pending vs. manager-authorized) or leave manager-direct assignments as immediately-approved but stop misusing the word "Draft" for something that isn't persisted.
3. `[ ]` Add Approve/Reject controls to `StaffSchedulerDetails.vue` for cells where `details.status` is `Pending` or `Disapproved`, calling the existing `/api/manager/approveRequest` endpoint with the correct `alias` (`cs` for shift changes, `leave` for leaves) and `id`.
4. `[ ]` Either implement a real Draft (`status = 0`) write path so `DutyRosterController::publish()` has something to act on, or remove the Draft/Published toggle and Publish button if that concept is being retired in favor of the approve/reject model.
5. `[ ]` Update `ShiftAssignment`/`EditForm` types ([types.staff_scheduler.ts](resources/views/web/src/module/manager/staff_scheduler/types/types.staff_scheduler.ts)) to model status as a real union (`'Pending' | 'Approved' | 'Disapproved' | 'Rest Day' | ...`) instead of a bare `string`.
6. `[ ]` (Separate, lower-priority ticket) Replace the hardcoded mock in `DutyRosterController::upload()` with real file parsing, and implement a real file download in `exportRoster()`.

### Testing & Verification Checklist
- [ ] Run existing PHPUnit suite touching shifts/timesheet: `vendor/bin/phpunit --filter Shift`
- [ ] Manual: create a shift-change request as an employee, confirm it appears as "Pending" on the manager's Duty Roster grid, then confirm the new Approve/Reject action updates its status and it disappears from the Dashboard's Approvals widget too (no double-approval state drift).
- [ ] Manual: as a manager, assign/edit/swap a shift on Duty Roster and confirm the resulting status matches whatever the clarified scope (step 1) decided.
- [ ] Manual: click "Publish" and confirm it now either does something real, or is removed if Draft is retired.
- [ ] Frontend checks: SubHRMS has no Vitest — rely on manual verification in the browser for the Vue components touched.

---

## Addendum (2026-08-24): Cross-Portal Duplication — Why It "Feels Disconnected"

### Follow-up question investigated
The approval gap above is confirmed, but a second, architectural concern was raised: the Manager Portal's Duty Roster doesn't feel connected to "duty roster in timekeeping," and there is no documentation explaining how the two relate or how the setup works.

### Finding: two independently-built frontends, one shared backend, nothing linking them

There are, in fact, **two separate, hand-built Vue implementations of "Duty Roster"** that both talk to the exact same backend:

| | Manager Portal | Timekeeping Portal |
|---|---|---|
| Route | `/manager/staff-scheduler/duty-roster` | `/timekeeping/applications/duty-roster` ([applications.routes.ts:47-51](resources/views/web/src/module/timekeeping/applications/route/applications.routes.ts#L47)) |
| Menu location | Staff Scheduler | Applications (alongside Leaves, Overtime, OBT, Change Shift, Logsheet, Cancelled Applications) |
| Vue page | [manager/staff_scheduler/pages/duty_roster/DutyRoster.vue](resources/views/web/src/module/manager/staff_scheduler/pages/duty_roster/DutyRoster.vue) | [timekeeping/applications/pages/duty_roster/DutyRoster.vue](resources/views/web/src/module/timekeeping/applications/pages/duty_roster/DutyRoster.vue) |
| State layer | Pinia store ([staff_scheduler.store.ts](resources/views/web/src/module/manager/staff_scheduler/store/staff_scheduler.store.ts)) | Plain composable ([useDutyRoster.ts](resources/views/web/src/module/timekeeping/applications/pages/duty_roster/composables/useDutyRoster.ts)), no store |
| API wrapper | `staff_scheduler.api.ts` | `duty_roster.api.ts` — a separate file with near-identical code |
| Types | `types.staff_scheduler.ts` | `types.duty_roster.ts` — separate, near-identical |
| Backend hit | `api/timekeeping/duty-roster*` | **the same** `api/timekeeping/duty-roster*` endpoints, same `DutyRosterController` |
| Team scoping | Sends `team_only: 1` — manager sees only their own unit ([staff_scheduler.store.ts:143](resources/views/web/src/module/manager/staff_scheduler/store/staff_scheduler.store.ts#L143)) | Sends no `team_only` param ([useDutyRoster.ts:87-94](resources/views/web/src/module/timekeeping/applications/pages/duty_roster/composables/useDutyRoster.ts#L87)) — pulls **every** employee in the company |
| Draft/Publish | Present (though non-functional per Section 3C above) | Doesn't exist on this page at all |
| Bulk uploader | Has a dedicated Roster Uploader page | Doesn't exist |

[staff_scheduler.api.ts:30](resources/views/web/src/module/manager/staff_scheduler/api/staff_scheduler.api.ts#L30) and [duty_roster.api.ts:5](resources/views/web/src/module/timekeeping/applications/pages/duty_roster/api/duty_roster.api.ts#L5) hit the identical `GET api/timekeeping/duty-roster` route. There is exactly **one backend implementation** ([DutyRosterController.php](app/Http/Controllers/tk/DutyRosterController.php)), wrapped by **two independently written frontends** that never import from or reference each other.

### Why this reads as "not connected" / "incompatible"
- The two were clearly built without awareness of each other: different state-management patterns (Pinia store vs. bare composable), different file layouts, different default assumptions. [useDutyRoster.ts:185-207](resources/views/web/src/module/timekeeping/applications/pages/duty_roster/composables/useDutyRoster.ts#L185) hardcodes month-navigation to always show June 2026 with a "Mock view restricted to June 2026 schedule data" toast — a restriction the Manager Portal version doesn't have at all.
- **They show different data for the same feature**: because the Timekeeping/Applications version sends no `team_only` scoping, any user who reaches this page sees the *entire company's* roster with no Draft/Publish concept — a materially different, less-governed experience than the Manager Portal's.
- **It doesn't fit its own menu's pattern.** Every sibling item under "Timekeeping → Applications" — Leaves, Logsheet, Overtime, OBT, Change Shift, Cancelled Applications — is a read-only report page driven by [ApplicationsController.php:23-33](app/Http/Controllers/tk/ApplicationsController.php#L23)'s `TYPE_MAP` (e.g. `'change-shift' => GetChangeShiftReportQuery::class`) plus `ApplicationsController::show()` for an approver-chain drill-down. **`duty-roster` has no entry in `TYPE_MAP`** and never touches `ApplicationsController` — it's a fully editable scheduling tool bolted onto a menu section otherwise reserved for read-only application-status reports. It also overlaps in subject matter with the sibling "Change Shift" report, which already reports on the same `app_shift` table this page edits.
- **No documentation exists anywhere in the repo** — no README, no code comment, no `.agents/` doc — explaining why two Duty Roster UIs exist, which one is authoritative, or how "Duty Roster" relates to the "Change Shift" application report next to it in the same menu. This investigation is the first place that traces the connection between them.

### Consequence for the approval fix above
A **backend** fix to the approval gap (e.g. in `SaveShiftAssignmentHandler`) will automatically apply to both pages, since they share `DutyRosterController`. But a **frontend** fix (Approve/Reject buttons in `StaffSchedulerDetails.vue`) will only appear on the Manager Portal page — the Timekeeping/Applications page won't gain the same controls unless it's duplicated there too, or unless one of the two pages is retired first. This should be decided before implementing Section 8's plan, not after.

### Additional Solution Option

| Option | Description | Pros | Cons | Risk & Complexity |
|---|---|---|---|---|
| **Option D (Recommended, do before/alongside Option A): Consolidate to one Duty Roster surface** | Pick the canonical page — the Manager Portal one, since it already has team-scoping, Publish, and bulk upload — and either delete the Timekeeping/Applications `duty-roster` route + page, or fold `duty-roster` into `ApplicationsController::TYPE_MAP` as a proper read-only report consistent with its siblings (mirroring how `Change Shift` already reports on the same table). | Removes the exact "feels disconnected/incompatible" symptom raised; any approval-workflow fix only needs to be built once; brings the page back in line with its own menu's established pattern; closes the documentation gap by removing the thing that needed explaining. | Needs a quick check that nobody depends on the Timekeeping/Applications version specifically (e.g. HR/timekeeping staff who aren't "managers" but need to see the whole-company roster) before removing it. | Low–Medium (the deletion itself is cheap; the only real cost is that confirmation step) |
| Option E: Keep both, but link and document them | Add a short code comment noting both pages share `DutyRosterController`, and add a "View full company roster" cross-link between the two pages. | No existing behavior removed; lowest immediate risk. | Doesn't fix the double-maintenance burden (every future change has to be made twice) or the mismatched Draft/Publish/team-scoping behavior between them. | Low |

### Updated Implementation Plan Note
Insert this as **step 0** before Section 8's plan: decide Option D vs. E for the duplication, *then* implement the approval-workflow fix once on whichever page(s) survive that decision — otherwise the approval work risks being built twice or built on a page about to be deleted.

---

## Addendum 2 (2026-08-24): Decided Approval Workflow

### Decision
The business has decided on a 3-tier approval chain for Duty Roster, superseding the "manager self-approves" question raised in Addendum 1:

> **Supervisor/Team Leader** files the Duty Roster → **Department Head/Manager** approves/rejects → **HR** validates (not necessarily the filer) → **Published**.

### Mapping the decision onto what already exists (no invented schema)
This maps almost exactly onto infrastructure already present and already used elsewhere in the app — the implementation should reuse it rather than create a parallel model, per this repo's standing duplicate-prevention rule.

- **The org hierarchy for tiers 1 & 2 already exists.** `units` ([create_units_table migration](../../database/migrations/table/account/2024_08_22_055138_create_units_table.php)) has `idhead` (the unit's head) and `idunder` (pointer to the *parent* unit) — and this parent/child chain is already live, walked recursively by [`OrgStructureController`](../../app/Http/Controllers/hr/OrgStructureController.php#L127) to render the HR portal's org chart. `unittype` already classifies a unit as Division / Department / Section ([OrgStructureController.php:205-211](../../app/Http/Controllers/hr/OrgStructureController.php#L205)).
  - **Tier 1 (Supervisor/Team Leader, files):** the *Section*-level unit's `idhead` — this is exactly who Duty Roster's `team_only` scoping already resolves to today (`units.idhead = Auth::id()`). No access change needed here; today's "manager" logging into this page already *is* this tier.
  - **Tier 2 (Department Head/Manager, approves/rejects):** the *parent* unit's `idhead`, found via `Section.idunder → Department.id → Department.idhead`. This is a different person than the filer whenever the org chart is at least two levels deep — which is what actually fixes the "manager self-approves their own roster" problem flagged in Addendum 1, without inventing a new role.
  - **Edge case to resolve during implementation:** a unit with `idunder` null/0 (top-level, per [OrgStructureController.php:148](../../app/Http/Controllers/hr/OrgStructureController.php#L148)) has no parent to approve — needs a fallback (e.g. route straight to HR, or to a configured top-level approver).
- **The multi-level, ordered approval chain mechanism already exists.** `AppChangeShift.approvers` (and the equivalent column on leaves/OT/OBT/adjustments) is already a JSON array of `{approver, status, order, sub_approver}` — [`HandleChangeShiftQuery::pendingApproval()`](../../app/Queries/ChangeShift/HandleChangeShiftQuery.php#L140-L179) already walks it by `order` (only the lowest-`order` still-pending approver(s) are actionable) and supports `sub_approver` as an alternate/escalation approver at the same step. This is precisely the "Dept Head first, then HR" sequencing the decided workflow needs — Duty Roster should reuse this exact `approvers` shape (`order: 1` → Dept Head, `order: 2` → HR) rather than adding a new status column or a bespoke roster-only workflow engine.
- **Tier 3 (HR, validates) has no existing per-unit field to reuse — this is the one genuinely new piece.** Unlike the Section/Department pair, HR is company-wide, not tied to a specific unit, and nothing in `units` or elsewhere designates "the HR validator" for a given roster. This needs a small product decision during implementation: does *any* HR-portal user validate (a shared queue, simplest to build), or is there a specific assigned HR reviewer per unit/department? Given no existing field models the latter, defaulting to "any HR user can validate" is the lower-effort, no-new-schema option unless there's a specific reason to scope it further.
- **Do not confuse this with `units.scheduler` / `deputy1` / `deputy2`.** These columns exist on `units` and look like they could be relevant (a dormant attempt at a distinct "who can file" or backup-approver concept), but a repo-wide search confirms **none of them are read anywhere in the codebase today** — they are unused dead columns, not a hidden implementation of this hierarchy. Don't build on them without first confirming with the team whether they were ever populated with real data; the design above uses only the actively-used `idhead`/`idunder`/`unittype` fields.
- **"Published" replaces the current broken Draft/Published toggle.** Once tier 2 and tier 3 have both signed off (final `order` in the `approvers` chain approved), the record's top-level `status` flips to `1` (Approved), matching the existing 0/1/2 convention used everywhere else — this becomes the real, working equivalent of what the current non-functional "Publish" button was trying to do (see Addendum 1, item 2).

### Net effect on the earlier Implementation Plan (Section 8)
Step 1 ("clarify scope") is now resolved — replace it with: build the 3-tier chain above, reusing the existing `approvers`/`order`/`sub_approver` shape and the `idhead`/`idunder` hierarchy, and resolve the two open sub-decisions before coding (top-level-unit fallback approver; whether HR validation is a shared queue or a per-unit assigned reviewer).

---

## Next Steps
- To scaffold the backend approval wiring, run: `/webkit.backend-implement app/Handlers/Shift <prompt> using .agents/reports/manager-staff_scheduler-duty-roster-missing-approval-workflow-20260824.md`
- To implement the Approve/Reject UI on the roster inspector, run: `/webkit.frontend-implement resources/views/web/src/module/manager/staff_scheduler <prompt> using .agents/reports/manager-staff_scheduler-duty-roster-missing-approval-workflow-20260824.md`
- To apply a narrower, targeted fix once scope is confirmed, run: `/webkit.fix <target_path> <prompt> using .agents/reports/manager-staff_scheduler-duty-roster-missing-approval-workflow-20260824.md`
