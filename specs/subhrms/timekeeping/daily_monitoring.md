# Spec — Daily Monitoring Redesign

> **Kind:** Extension — redesign of an existing, currently frontend-only (hard-coded/mock) module; no prior spec exists for it.
> **Portal:** **Timekeeping** (`/api/timekeeping/...` routes, `timekeeping/daily_monitoring` frontend module).
> **Route:** `timekeeping/daily-monitoring` (`timekeeping_daily_monitoring`) — unchanged.
> **Conventions:** [project-profile.md](../../rules/project-profile.md), [ui-design.md](../../rules/ui-design.md), [vue-standards.md](../../rules/vue-standards.md), [duplicate-prevention.md](../../rules/duplicate-prevention.md).
> **System Awareness:** Models reused (Timelog, AttendanceException, AttendanceDispute, AppAdjustment, AccountDetailVW); Tables reused only; Routes reused (`/timekeeping/resolution-center` linked to, not duplicated); New migration: **no**.

---

## 1. Purpose

`daily_monitoring` is the Timekeeper/HR "control room" view for **today**: live headcount/checked-in health, a real-time roster (Attendance Board), and a per-employee Daily Time Record explorer (DTR Explorer). It is being redesigned because:

1. **Misplaced/incomplete standards** — the page hand-rolls native `<select>` dropdowns, has no pagination on the Attendance Board roster, and its wide tables don't support the mandatory drag-to-scroll behavior ([ui-design.md](../../rules/ui-design.md) Best Practices) that every sibling report/roster table in this portal already has.
2. **A duplicate, non-integrated "Adjust Log" action** — every tab currently opens `DtrAdjustmentModal.vue`, which calls a **mock** `submitAdjustment()` that always fakes success and writes nothing real. This duplicates two features that **already exist and are fully wired**:
   - Employees file real attendance corrections themselves via the employee portal's existing **Attendance Adjustment** tab (`employee/timekeeping_applications/.../AttendanceAdjustment.vue` → `TKApplicationController` → `AppAdjustment` model). Once approved, `HandleTimesheet` **auto-merges** the correction into the day's computed totals via the `adj_aa_*` breakdown fields — this is the "auto detect" the requester is referring to.
   - Timekeepers already resolve attendance anomalies (missing clock-out, unexcused absence, etc.) in the existing, fully-wired **Resolution Center** (`timekeeping/resolution-center`, backed by `AttendanceException`/`AttendanceDispute` + `ResolutionCenterController`). Daily Monitoring's "Exceptions Alert Feed" + "Resolve Log" button is a parallel, disconnected re-implementation of that same job.

The redesign's job is to strip out the duplicate action, adopt the project's real global components, and turn Daily Monitoring into what it should be: a **read-only monitoring surface** that links out to the real filing/resolution flows instead of re-implementing them.

---

## 2. Design Decisions (Pros & Cons)

### Decision: Scope of this pass — frontend redesign only vs. redesign + backend wiring

The module is currently **100% mock data** (`daily_monitoring.api.ts` generates everything client-side) — it has never gone through Gate 2 (`webkit.backend-implement`).

**Option A — Redesign only, keep the API layer mocked (Recommended)**
- Fix layout/components/adjust-action removal now. Reshape the mock response field names to mirror the real backend fields they'll eventually come from (`empid`, `issue_type`, `severity`, `status` from `AttendanceException`; `ip_address`/`time_type` from `Timelog`) so the future Gate 2 pass is a pure api-file swap, per [vue-standards.md](../../rules/vue-standards.md) "Mirror Backend Fields".

| Pros | Cons |
|---|---|
| Matches what was actually requested (UI redesign) | Dashboard numbers/board stay fake until a follow-up backend spec/PR |
| Small, reviewable diff; no risk to live payroll/timekeeping data paths | Two-step delivery (design now, wire later) |

**Option B — Redesign and wire the real backend in the same pass**
- Also build `GetDailyAttendanceBoardQuery`, `GetDailyMonitoringDashboardQuery`, `GetEmployeeDtrQuery` reusing `Timelog`, `AttendanceException`/`GetExceptionsQuery`, `AccountDetailVW`.

| Pros | Cons |
|---|---|
| One pass, live data immediately | Much larger diff; couples a "fix the layout" request to new query/route work not asked for |
| — | Higher risk of touching shared timekeeping calc paths without a dedicated review pass |

**Recommendation:** **Option A.** The request is explicitly about layout correctness, component reuse, and removing the fake adjust action — not about live-wiring the dashboard. Keep this pass frontend-only; file a follow-up spec for Gate 2 backend wiring once this design is approved.

---

### Decision: What replaces the "Adjust Log" action

**Option A — Remove entirely; auto-detect and show status instead (Recommended)**
- Delete `DtrAdjustmentModal.vue` and every `openAdjustmentModal`/`submitAdjustment` call site (Attendance Board table row, Attendance Board grid card, DTR Explorer row action column).
- In the DTR Explorer's per-day row, replace the "Adjustment" action column with a **read-only "Adjusted" indicator** shown when that date already has an approved correction applied — mirroring the exact badge pattern `TimesheetProcessingTable.vue` already uses for `adj_ot_reg` etc. ("Carryover Adjustment" dot + tooltip). Backend-wise (Gate 2, out of this pass per the decision above) this reuses the **already-existing** `HandleAttendanceAdjustmentQuery::checkApproved()` / `checkAdjustmentLogs()` — the literal auto-detection the requester means — no new detection logic needed.

| Pros | Cons |
|---|---|
| Removes a fake, unintegrated write path; single source of truth stays the employee-filed `AppAdjustment` flow | Timekeepers lose a (fake) one-click "fix it here" shortcut — but it never actually worked |
| Zero duplicate logic vs. [duplicate-prevention.md](../../rules/duplicate-prevention.md) | — |

**Option B — Keep a modal, but wire it to create a real `AppAdjustment` record**
- Same UI, but `submitAdjustment` actually calls the same creation path `TKApplicationController` uses, gated by an HR/Timekeeper permission.

| Pros | Cons |
|---|---|
| Keeps a quick-action affordance for HR-initiated corrections | Duplicates the employee-portal filing flow's validation/approval routing in a second place; conflicts with the explicit ask to remove this action; the existing flow requires an approval chain this modal has no concept of |

**Recommendation:** **Option A.** The requester explicitly asked for the action to go away because the real flow (employee files → approval → auto-merge) already exists. Option B re-introduces the duplication the request is trying to eliminate.

---

### Decision: Where "Exceptions Alert Feed" (Dashboard tab) points

**Option A — Read-only preview card + "View All in Resolution Center" (Recommended)**
- Keep the feed visually (it's useful at-a-glance), sourced with the **real** `AttendanceException` field names (`issue_type`, `severity`, `status`, `date`) instead of the mock's ad-hoc `type`/`action_link`, so the eventual Gate 2 swap is direct.
- Remove the "Resolve Log" button (it opened the fake adjustment modal). Replace with a plain **"Open in Resolution Center"** link/button per row and a header-level "View All" button, both routing to `timekeeping/resolution-center`.
- Note: `useResolutionCenter.ts` does not currently read an initial filter from `route.query` — a per-row deep link (e.g. `?search=EMP-005`) would need a small addition there to pre-fill `searchQuery` on mount. Flag this as a small dependency if per-row deep-linking is wanted; otherwise the "View All" link alone needs no changes to Resolution Center.

| Pros | Cons |
|---|---|
| Daily Monitoring stays a glanceable dashboard without owning resolution logic | Slightly less "one-click" than the old (fake) inline resolve |
| Reuses the real Resolution Center feature instead of re-implementing it | Per-row deep-link needs a small `useResolutionCenter.ts` addition (out of this pass unless requested) |

**Option B — Drop the Exceptions Feed from Daily Monitoring entirely**
- Replace the 2-column feed with a single stat tile ("X Unresolved Exceptions") linking to Resolution Center.

| Pros | Cons |
|---|---|
| Simplest; zero risk of the two pages drifting out of sync | Loses at-a-glance visibility into *what* the exceptions are, which is useful on a monitoring dashboard |

**Recommendation:** **Option A.** A monitoring dashboard should surface *what's* wrong at a glance; it just shouldn't be where it gets *fixed*. This is the user's call if they'd rather simplify to Option B — flag for confirmation if the preview list feels like scope creep.

---

## 3. Database

No new tables/columns. Existing tables this feature will eventually read from (Gate 2, per Decision 1):

| Table | Model | Used for |
|---|---|---|
| `timelogs` | `Timelog` | Raw clock-in/out punches → Attendance Board clock-in/out, device/IP; DTR Explorer daily rows |
| `attendance_exceptions` | `AttendanceException` | Exceptions preview feed (already fully modeled + queried by `GetExceptionsQuery`) |
| `attendance_disputes` | `AttendanceDispute` | N/A directly on this page — owned by Resolution Center |
| `app_adjustment` | `AppAdjustment` | Source of truth for the "Adjusted" auto-detect indicator (via `HandleAttendanceAdjustmentQuery`) |
| `vw_accounts_details` | `AccountDetailVW` | Employee directory (name, unit, position) — already the standard join used across the portal |

---

## 4. Backend

**None in this pass** (see Decision 1 — Option A). `daily_monitoring.api.ts` stays mocked, but its mock field names are reshaped to match the tables above:

- Attendance Board rows: `empid`, `fullname`, `unit`, `position`, `shift`, `clock_in`, `clock_out`, `status`, `time_type`/`device`, `ip_address`.
- Exceptions feed rows: `id` (`EXC-{id}` format, matching `GetExceptionsQuery`), `empid`, `fullname`, `unit`, `issue_type`, `date`, `description`, `severity`, `status`.
- DTR day rows: add a `has_adjustment: boolean` mock field (stubbed `false`/`true` per row) so the frontend indicator has something to bind to now, and a one-line wiring note for Gate 2: populate it from `HandleAttendanceAdjustmentQuery::checkApproved($date, $idacct)` — do not write a new detection method.

When a follow-up backend spec is written, it should reuse `GetExceptionsQuery` (or a thin sibling in the same `App\Queries\Timesheet` namespace) rather than introducing a parallel exceptions query — per [duplicate-prevention.md](../../rules/duplicate-prevention.md).

---

## 5. Frontend

Module folder stays as-is (`api/ composables/ components/ pages/ route/ types/`). Changes:

### Remove
- `components/DtrAdjustmentModal.vue` (delete file).
- From `composables/useDailyMonitoring.ts`: `isAdjustmentModalOpen`, `adjustmentForm`, `isAdjustmentSubmitting`, `openAdjustmentModal()`, `submitAdjustment()`, and the import/usage in `pages/DailyMonitoring.vue`.
- From `api/daily_monitoring.api.ts`: `submitAdjustment()`.
- All "Adjust" buttons: `AttendanceBoard.vue` (table row + grid card), `DtrReport.vue` (row action column).
- `DailyMonitoringDashboard.vue`'s `handleResolve()` modal-opening branch and the "Resolve Log" button.

### Add / Replace
- **`AttendanceBoard.vue`**: replace the native Department/Status `<select>` with `<c-select>` (global component, 117 existing usages in this codebase — the established standard); add `<CenterPaginationComponent>` + a "Rows per page" selector beneath the table/grid, mirroring `timesheet_processing`'s pattern exactly (`paginatedList`/`currentPage`/`perPage`/`totalPages`/`paginationData` in the composable); add the drag-to-scroll handlers (`cursor-grab active:cursor-grabbing select-none` + mousedown/mousemove/mouseup/mouseleave, exact pattern in `TimesheetProcessingTable.vue`) to the table view's scroll container; replace the hand-rolled `getInitials()` with the shared `useInitialProfile()` composable (adds profile-photo support for free, consistent with `TimesheetProcessingTable.vue`).
- **`DtrReport.vue`**: replace the native Employee `<select>` with `<c-select>`; add the same drag-to-scroll handlers to its table container; replace the "Adjustment" action column with a read-only "Adjusted" badge (small dot + tooltip, same visual language as the `adj_*` "Carryover Adjustment" indicator in `TimesheetProcessingTable.vue`) bound to the new `has_adjustment` field, shown only when true.
- **`DailyMonitoringDashboard.vue`**: Exceptions Alert Feed keeps its layout, but each row's action becomes a plain "Open in Resolution Center" link (`router-link` to `{ path: '/timekeeping/resolution-center' }`), and the card header gets a "View All →" button to the same route. Field bindings switch from the mock's `type`/`action_link` to `issue_type`/`severity`/`status`/`date` to mirror `GetExceptionsQuery`'s real shape.
- **`useDailyMonitoring.ts`**: add `boardCurrentPage`, `boardPerPage`, `boardPaginationData`, `boardTotalPages` (or reuse existing naming conventions from `useTimesheetProcessing.ts` for consistency) for the new Attendance Board pagination.

### Layout sketch (unchanged tab structure — Dashboard / Attendance Board / DTR Explorer; no evidence the three-tab IA itself is misplaced, only the components inside it)

```
DailyMonitoring.vue
├─ DailyMonitoringHeader.vue                 (unchanged)
├─ Tabs: Dashboard | Attendance Board | DTR Explorer
├─ [Dashboard]  DailyMonitoringDashboard.vue
│    ├─ 5 stat cards                          (unchanged)
│    ├─ Exceptions preview (read-only) ──────▶ "View All in Resolution Center"
│    └─ Department breakdown                  (unchanged)
├─ [Board]      AttendanceBoard.vue
│    ├─ Search + c-select(dept) + c-select(status) + view toggle
│    ├─ Table (drag-to-scroll) / Grid, "Adjust" button removed
│    └─ CenterPaginationComponent + rows-per-page
└─ [DTR]        DtrReport.vue
     ├─ c-select(employee) + start/end date + export/print
     └─ Table (drag-to-scroll), "Adjustment" action → read-only "Adjusted" badge
(DtrAdjustmentModal.vue: deleted)
```

---

## 6. Business Rules & Edge Cases

| Case | Handling |
|---|---|
| Employee has a pending (not yet approved) `AppAdjustment` for a DTR date | `has_adjustment` stays `false` until approved — the badge means "already reflected in totals," not "has an open request." Do not surface pending-request state here; that belongs to Resolution Center / the employee's own application status page. |
| Exceptions preview list is empty | Keep the existing `EmptyState` ("All Clear!") — unchanged. |
| Attendance Board has more employees than one page | New pagination handles it; default `perPage` should match the sibling default (10). |
| User without Resolution Center access views Daily Monitoring | Out of scope for this spec — route-level permission gating for `/timekeeping/resolution-center` already exists or is a separate concern; do not add new permission logic here. |
| Mobile / narrow viewport | Preserve existing responsive `grid-cols-1 sm:grid-cols-2 ...` patterns already in the file; no new breakpoints needed. |

---

## 7. Build Order

1. Delete `DtrAdjustmentModal.vue`; strip its imports/usages from `DailyMonitoring.vue`.
2. Strip adjustment state/methods from `useDailyMonitoring.ts` and `daily_monitoring.api.ts`.
3. Reshape mock data field names in `daily_monitoring.api.ts` to mirror real backend fields (Section 4), including the new `has_adjustment` stub.
4. `AttendanceBoard.vue`: swap native selects → `c-select`; add drag-to-scroll; add pagination (composable state + `CenterPaginationComponent`); swap `getInitials()` → `useInitialProfile()`; remove "Adjust" buttons.
5. `DtrReport.vue`: swap native employee select → `c-select`; add drag-to-scroll; replace "Adjustment" action column with read-only "Adjusted" badge.
6. `DailyMonitoringDashboard.vue`: rewire Exceptions Feed to real field names; replace "Resolve Log" with "Open in Resolution Center" link + header "View All" button.
7. Manual pass in-browser: verify both themes (light/dark), both Attendance Board view modes (table/grid), and that no dangling references to the removed modal/state remain (`grep -r "AdjustmentModal\|openAdjustmentModal\|submitAdjustment"` across the module should return nothing).

---

## 8. Out of Scope (Future Specs)

- Gate 2 backend wiring for this module (`GetDailyAttendanceBoardQuery`, `GetDailyMonitoringDashboardQuery`, `GetEmployeeDtrQuery`, reusing `Timelog`/`AttendanceException`/`HandleAttendanceAdjustmentQuery` as scanned in Section 3–4).
- Adding `route.query` initial-filter support to `useResolutionCenter.ts` for per-row deep-linking from the Exceptions preview (only needed if Decision 3's per-row deep link is confirmed wanted).
- Any change to the Resolution Center or employee-portal Attendance Adjustment filing flow themselves — both are treated as stable, already-correct dependencies here.
