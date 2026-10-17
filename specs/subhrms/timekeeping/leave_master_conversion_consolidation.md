# Spec — Leave Master / Leave Conversion Consolidation

> **Kind:** Extension — fixes a confirmed data-integrity bug and a structural duplication between two existing, live modules. No new module.
> **Portal:** **Timekeeping** (`timekeeping/leave-master` and `timekeeping/leave-conversion` frontend modules, both under `/api/timekeeping/...`).
> **Route:** `timekeeping/leave-master` (`tk_leave_master`) and `timekeeping/leave-conversion` — both unchanged.
> **Conventions:** [project-gate.md](../../../rules/core/project-gate.md), [system-awareness.md](../../../rules/conditional/system-awareness.md).
> **System Awareness:** Models reused (`Leave` — table `leaves`, `LeaveTypeConfigLog`, `LeaveConversionPeriod`, `LeaveConversionRequest`); Tables reused only; New migration: **no** (the columns in question already exist — this is a code/ownership fix, not a schema addition).

---

## 1. Purpose

Investigated whether "Leave Master" and "Leave Conversion" are redundant. They are **not conceptually redundant** — Leave Master is master-data CRUD for leave *types* (code, credits, accrual, paid/unpaid, eligibility, active/inactive); Leave Conversion is meant to be the encashment *workflow* (conversion periods, employee requests, approval, payout) — but the investigation found three concrete problems caused by how the two were actually built:

### 1a. Confirmed data-integrity bug: `is_paid`/`is_unpaid` vs `paid`

The `leaves` table carries **two separate representations of the same fact** — "is this leave type paid time off":
- `paid` (boolean) — the original column. **This is the only one any live UI lets a user set** (Leave Master's "Paid Leave Policy" checkbox, `LeaveMasterModal.vue`).
- `is_paid` / `is_unpaid` (two booleans, added later for Leave Conversion) — `UpdateLeaveTypeConfigHandler.php` has code to write these (`if (isset($updated['isPaid']))` / `isUnpaid`), but **the only Leave Conversion component actually mounted in the live page, `LeaveTypeConfig.vue`, never renders a control for them** — so nothing has ever set them since whatever seeded the table.

Queried the live `leaves` table directly (21 rows): every single row has `is_paid = 1, is_unpaid = 0`, **regardless of the real `paid` value** — including "Leave Without Pay" (`alias: LWOP`, `paid = 0`) and "Maternity Leave Without Pay" (`alias: MLWOP`, `paid = 0`), both of which show `is_paid = 1` (paid) despite being explicitly unpaid leave types by name and by the field that actually gets edited. **This is live, wrong data in production right now** — a direct consequence of building a second "is this paid" representation next to the original instead of reusing it.

### 1b. Structural duplication (currently dormant, not yet triggered): `active` / `isconvertible`

`UpdateLeaveTypeConfigHandler` also contains code to flip `Leave.active` (`if (isset($updated['status']))`) and `Leave.isconvertible` (`if (isset($updated['isConvertible']))`) — the exact same two fields `ToggleLeavePolicyStatusHandler` (Leave Master's activate/deactivate action) and `SaveLeavePolicyHandler` already own. **Verified this isn't an active bug today**: `LeaveTypeConfig.vue`'s table has no status/active column, and `useLeaveMaster.ts`/`LeaveMasterList.vue` never reference `isconvertible` — so in practice, only one live path currently edits each field (`active` via Leave Master, `isconvertible` via Leave Conversion). But the *capability* for both handlers to step on the same field sits in the code today, unnoticed, and would silently reintroduce a double-edit hazard the moment either page's UI is extended without someone re-discovering this overlap.

### 1c. Seven orphaned components — an unfinished feature, not a redundant one

`RequestsQueue.vue`, `EncashmentRoster.vue`, `AdminConsole.vue`, `PeriodManagement.vue`, `RequestForm.vue`, `NewRequestModal.vue`, `AdjustCreditsModal.vue` (plus `LeaveConversionTable.vue`, `LeaveConversionModal.vue`) live in the `leave_conversion` folder but **none are imported by `LeaveConversion.vue`** — confirmed by reading its full import list (only `useLeaveConversion`, `LoadingState`, `LeaveTypeConfig`). Meanwhile their backend counterparts already exist and look complete: `SubmitLeaveConversionRequestHandler`, `ProcessLeaveConversionRequestHandler`, `UpdateLeaveConversionPeriodHandler`, `AdjustLeaveCreditsHandler`, backed by real tables (`LeaveConversionPeriod`, `LeaveConversionRequest`). This isn't redundancy — it's a **half-shipped feature**: the actual encashment request/approval workflow the module's name promises was built on the backend and then never wired to a route.

### 1d. Minor asymmetry: unaudited Leave Master changes

Leave Conversion's type-config changes write to `leave_type_config_logs` (`LeaveTypeConfigLog`) on every toggle. Leave Master's `SaveLeavePolicyHandler`/`ToggleLeavePolicyStatusHandler` write **no audit trail at all** — creating/editing/deactivating a leave policy (which affects every employee's accrual) is invisible after the fact, while a conversion-multiplier tweak is logged.

---

## 2. Design Decisions (Pros & Cons)

### Decision: How to resolve the `paid` vs `is_paid`/`is_unpaid` duplication

**Option A — Deprecate `is_paid`/`is_unpaid`; `paid` stays the single source of truth (Recommended)**
- Remove the `isPaid`/`isUnpaid` branches from `UpdateLeaveTypeConfigHandler` (dead code — no live UI sends these keys anyway). Leave the columns in place for now (non-destructive); a later cleanup migration can drop them once confirmed nothing else reads them.

| Pros | Cons |
|---|---|
| Removes dead code and a data field that's already wrong for every unpaid leave type | Doesn't retroactively fix historical confusion for anyone who queried `is_paid` directly outside the app (unlikely, but not zero) |
| Zero risk — `paid` already is what every real consumer (Leave Master's form, presumably payroll calc) reads | — |

**Option B — Keep both; backfill `is_paid`/`is_unpaid` from `paid` and keep them in sync going forward**

| Pros | Cons |
|---|---|
| Preserves the columns if something external depends on them | No evidence anything reads `is_paid`/`is_unpaid` today (grepped: only the dead handler branch writes them, nothing selects them for display or logic) — keeping two synced booleans for one fact is exactly the duplication this spec exists to remove |

**Recommendation:** **Option A.** Nothing currently reads `is_paid`/`is_unpaid` for any real decision (payroll, leave filing, or display) — confirmed by grep. Keeping them "in sync" only preserves the duplication instead of removing it.

---

### Decision: Where should conversion-eligibility fields (`isconvertible`, `is_final_pay_convertible`, `deduct_balance`, conversion multiplier) live?

Unlike 1b's `active` field, these particular fields **are** conversion-specific — they don't describe the leave type itself, they describe its encashment eligibility. Worth deciding deliberately rather than defaulting.

**Option A — Keep them in Leave Conversion's own settings tab, as today (Recommended)**
- The sidebar already separates these two pages into different groups (Leave Master under "Setup", Leave Conversion nearer Final Pay/Timesheet Closing) — the org already treats "define a leave type" and "configure its encashment rules" as different jobs. Fix only the confirmed problems: remove the dead `isPaid`/`isUnpaid` branches (Decision 1) and stop `UpdateLeaveTypeConfigHandler` from also being able to touch `active`/`isconvertible` unless the live UI actually needs to (see below).

| Pros | Cons |
|---|---|
| Matches the existing IA / doesn't force an unrelated merge onto Leave Master's already-multi-purpose modal | Two Query/Handler pairs still both target the `leaves` table (though now with non-overlapping field ownership once 1b is resolved) |
| Smaller, safer diff | — |

**Option B — Move these fields into Leave Master's policy form as additional fields, retiring the separate config endpoint**

| Pros | Cons |
|---|---|
| One CRUD surface, one Handler, for the entire `leaves` row — eliminates the dormant double-edit risk (1b) entirely, not just today's instance of it | Leave Master's modal already has 8 fields; adding 4 more (2 switches, 1 checkbox, 1 numeric multiplier) makes a "define a leave type" form also respons ible for "encashment policy," which is arguably a distinct job in most HR orgs |

**Recommendation:** **Option A**, but narrow `UpdateLeaveTypeConfigHandler` to only accept `isConvertible`/`isFinalPayConvertible`/`deductBalance` (drop the `isPaid`/`isUnpaid`/`status` branches entirely, not just leave them unreachable) — this closes the dormant overlap in 1b by removing the *capability*, without merging the two pages. This is the user's call to confirm; Option B is equally defensible if the intent is "one page owns one row, period."

---

### Decision: What to do with the seven orphaned Leave Conversion components?

This is a business decision, not a technical one — flagging explicitly rather than picking a default.

**Option A — Wire them up: finish the conversion request/approval workflow (Recommended if the encashment workflow is still wanted)**
- The backend already exists (`SubmitLeaveConversionRequestHandler`, `ProcessLeaveConversionRequestHandler`, `UpdateLeaveConversionPeriodHandler`, `AdjustLeaveCreditsHandler`, `LeaveConversionPeriod`/`LeaveConversionRequest` tables) — this would primarily be frontend wiring (routes/tabs on `LeaveConversion.vue`) plus verifying the existing handlers still match current conventions, not new backend design.

| Pros | Cons |
|---|---| 
| Delivers what the module's name and existing backend already promise, without re-designing from scratch | Scope beyond "fix the redundancy" — a real feature-completion effort, needs its own review of the 4 existing handlers before trusting them (they predate this investigation and haven't been exercised) |

**Option B — Delete the orphaned components (and, separately, decide whether to keep or remove their backend handlers/tables) if the encashment workflow is no longer planned**

| Pros | Cons |
|---|---|
| Removes dead code the moment it's confirmed unwanted | Throws away backend work that looks complete, if it turns out to still be wanted later |

**Recommendation:** Ask the user before doing either — this spec documents the finding (Section 8) rather than assuming an answer.

---

## 3. Database

No new tables/columns.

| Table | Column(s) | Current state | This spec's fix |
|---|---|---|---|
| `leaves` | `paid` | Real, live-edited via Leave Master | Stays the single source of truth (Decision 1) |
| `leaves` | `is_paid`, `is_unpaid` | Exist, but wrong on every unpaid leave type (LWOP, MLWOP both show `is_paid=1`) — never set by any live UI | Stop writing to them (Decision 1); no destructive migration in this pass |
| `leaves` | `active`, `isconvertible` | Each currently has exactly one live editor (`active` → Leave Master, `isconvertible` → Leave Conversion) despite both handlers being *capable* of writing either | Narrow `UpdateLeaveTypeConfigHandler` to stop accepting `status` (Decision 2) |
| `leaves` | `is_final_pay_convertible`, `deduct_balance` | Real, live-edited via Leave Conversion only | Unchanged (Decision 2, Option A) |
| `leave_type_config_logs` | — | Logs Leave Conversion's toggles only | Consider extending the same audit pattern to Leave Master's CRUD (1d) — flagged, not mandated |
| `leave_conversion_periods`, `leave_conversion_requests` | — | Real tables backing the orphaned workflow components | Untouched unless Decision 3 picks Option A |

---

## 4. Backend

- **`UpdateLeaveTypeConfigHandler`**: remove the `isPaid`/`isUnpaid` branches (dead, and the underlying columns hold bad data — Decision 1). Remove the `status` branch (Decision 2) so this handler can only ever touch `isconvertible`/`is_final_pay_convertible`/`deduct_balance` — fields Leave Master's handlers never touch.
- **`SaveLeavePolicyHandler` / `ToggleLeavePolicyStatusHandler`**: no functional change required by this spec; optionally add a `TransLog`/audit write matching the pattern `LeaveTypeConfigLog` already established for the sibling page (1d) — flagged as a nice-to-have, not required to close the redundancy question.
- **No new Query/Handler classes** — this is a subtraction/narrowing pass, not new feature surface, per [system-awareness.md](../../../rules/conditional/system-awareness.md)'s instruction to extend/fix existing classes rather than add parallel ones.

---

## 5. Frontend

- **`LeaveTypeConfig.vue`**: no change needed — it never sent `isPaid`/`isUnpaid`/`status` in the first place; the fix is entirely on the handler side (removing acceptance of fields the UI never sent, and fields that held bad data).
- **Leave Master**: no change required for Decisions 1–2 (it already exclusively owns `paid` and `active`).
- **Orphaned components**: no action in this pass — pending Decision 3.

---

## 6. Business Rules & Edge Cases

| Case | Handling |
|---|---|
| A future feature genuinely needs to distinguish "paid" from "unpaid" more granularly than a single boolean (e.g. partial-pay leave) | That's a new requirement, not a reason to keep `is_paid`/`is_unpaid` as-is — model it explicitly (e.g. a `pay_rate_factor` column) rather than reviving two booleans that already drifted wrong once. |
| Someone external (report, export) already reads `is_paid`/`is_unpaid` directly from the DB | Not found in this investigation (grepped app code only) — if raised, resolve before dropping the columns in a future migration; this pass only stops *writing* to them, doesn't drop them. |
| Leave Conversion's dormant `status`/`isPaid`/`isUnpaid` acceptance is relied upon by an untested integration | Grep confirms no current frontend caller sends those keys; removing acceptance is safe against everything that exists today. |

---

## 7. Build Order

1. Remove the `isPaid`/`isUnpaid`/`status` branches from `UpdateLeaveTypeConfigHandler` (Decisions 1 & 2) — behavior-preserving for every real caller, since nothing live sends those keys.
2. (Optional, flag for confirmation) Add an audit-log write to `SaveLeavePolicyHandler`/`ToggleLeavePolicyStatusHandler` matching `LeaveTypeConfigLog`'s pattern (1d).
3. (Pending Decision 3 — do not start without explicit confirmation) Either wire the seven orphaned components into `LeaveConversion.vue` with new tabs/routes, reviewing each of the four existing handlers against current conventions first; or delete the orphaned components and decide the fate of their backend/tables separately.
4. (Future, separate migration — not this pass) Once confirmed nothing external reads `is_paid`/`is_unpaid`, drop those two columns.

---

## 8. Out of Scope (This Pass — Needs Your Decision)

- **Decision 3 is unresolved by design** — wiring up or deleting the seven orphaned Leave Conversion components (request filing, approval queue, period management, credit adjustment) is a product decision about whether the encashment workflow is still wanted. Tell me which way to go and I'll scope the follow-up (Option A would be its own `webkit.frontend-implement`/backend-review pass; Option B is a quick deletion pass).
- Dropping `is_paid`/`is_unpaid` at the schema level — deferred until Step 1 has been live for a while with no fallout.
- Any change to how leave balances/credits (`AccountLeave`, `AppLeave`) are computed — untouched; this spec is scoped to the leave-*type* configuration layer only.
