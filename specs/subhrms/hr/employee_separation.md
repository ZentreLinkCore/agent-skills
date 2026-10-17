# Spec — Employee Separation & Clearance (HR) — the missing trigger of the Final Pay workflow

> **Kind:** Greenfield HR module. It **owns the start** of the separation → final-pay chain and fixes two responsibilities currently misplaced in Timekeeping.
> **Portal:** HR (`hr` namespace + URL prefix + module folder). **Accent: emerald** (per [project-profile](../../../rules/core/project-gate.md)).
> **Downstream:** Timekeeping [Final Pay Processing](../timekeeping/final_pay_processing.md) → Payroll [Final Pay](../payroll/final_pay.md).
> **Conventions:** [project-profile](../../../rules/core/project-gate.md), [hrms-rules](../../../rules/conditional/payroll.md), [ui-design](../../../rules/conditional/ui-design.md).

---

## 1. Why this exists (the gap)

The final-pay workflow spans three portals: **HR (who/why/when separated) → Timekeeping (validate attendance/leave, endorse) → Payroll (compute & disburse)**. The split is directionally correct, but today HR under-owns its part:

- **Separation is just a data edit.** [HandleAccountDetails](../../../app/Domain/Handlers/AccountDetail/HandleAccountDetails.php) sets `accounts.status = 3` (Resigned, `status_str='resign'`) and writes the separation date to `accountjob.sdate` (keyed by `idacct`, → `vw_accounts_details.separation_date`) **only when `status === 3`** — a bare date, with **no type, reason, last-working-day, or approval**. (Note: `sdate` lives on `accountjob`, not `accounts`.)
- **`separation_type` lives in Timekeeping** (`tk_final_pay_audits.separation_type`, [TkFinalPayAudit](../../../app/Models/TkFinalPayAudit.php)) — but Resignation/Termination/Retirement is an **HR fact**, not something a timekeeper should key in during a pay audit.
- **`employee_cleared` is a single Timekeeping checkbox** — but **clearance is an HR process** (asset return, IT/Finance/dept sign-offs, exit interview, quitclaim). TK should *consume* HR clearance, not self-certify it.

This module makes HR the **system of record** for separation + clearance, and feeds TK and Payroll from it.

---

## 2. Corrected end-to-end flow

```text
HR — Employee Separation & Clearance  (THIS MODULE)
  1. File separation   → type, reason, filed date, last working day, effective date
  2. Approve           → resignation acceptance / termination approval
        └─ starts the rendering / notice period. Employee stays ACTIVE (status=1) until effectivity.
           • effective_date today/past (AWOL, immediate termination) → separate now
           • effective_date in the future (e.g. 30-day notice)        → defer; cron flips it on the day
  2b. Effectivity day  → app:process-effective-separations (daily cron)
        └─ set accountjob.sdate = effective_date, accounts.status = 3 (Resigned)
  3. Clearance routing → per-area sign-offs (Dept Head, IT, Finance, Admin, HR) + accountabilities
        └─ all areas cleared → separation status = 'Cleared'
        ▼
Timekeeping — Final Pay Processing
  reads separation_type + clearance status FROM HR (no longer keyed by the timekeeper);
  validates final attendance/leave, encashment/LWOP; endorses to Payroll
        ▼
Payroll — Final Pay cycle
  computes last salary + pro-rated 13th + leave conversion − loans − HR accountabilities − tax = net
```

---

## 3. Persistence

### 3a. `employee_separation` (HR-owned, authoritative)

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `idacct` | int, indexed | → `accounts.id` |
| `separation_type` | string | `Resignation` \| `Termination` \| `Retirement` \| `End of Contract` \| `AWOL` — **the source of truth** (TK reads this) |
| `reason` | text nullable | narrative / cause |
| `filed_date` | date | when filed/received |
| `last_working_day` | date | last day physically worked |
| `effective_date` | date | separation effectivity (→ `accountjob.sdate` on approval) |
| `status` | string | `Filed` → `Approved` → `For Clearance` → `Cleared` → `Endorsed` → `Completed`. Written by: File/Approve/SignClearance (HR) → up to `Cleared`; **`Endorsed`** by TK `UpdateFinalPayWorkflowStatusHandler` on "Endorsed to Payroll"; **`Completed`** by Payroll `ProcessFinalPayHandler` when the final pay is committed. |
| `approved_by` | int nullable | HR approver account id |
| `approved_date` | date nullable | |
| `remarks` | text nullable | |
| `created_by` | int nullable | |
| `timestamps` | | |

Model `App\Models\EmployeeSeparation` (`belongsTo` Account). One active separation per employee.

### 3b. `employee_clearance` (exit clearance — one row per accountable area)

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `id_separation` | bigint, indexed | → `employee_separation.id` |
| `area` | string | `Dept Head` \| `IT` \| `Finance` \| `Admin` \| `HR` (configurable list) |
| `status` | string | `Pending` \| `Cleared` \| `With Accountability` |
| `accountability` | string nullable | description (e.g. "unreturned laptop") |
| `amount` | decimal(12,2) default 0 | deductible accountability → flows to Payroll Final Pay |
| `cleared_by` | string nullable | **departmental signatory** who actually cleared the area (e.g. "Juan Cruz, IT Head") |
| `signed_by` | int nullable | **HR user who encoded** the sign-off (account id) |
| `signed_date` | date nullable | |
| `remarks` | text nullable | |
| `timestamps` | | |

Model `App\Models\EmployeeClearance`. The separation is **`Cleared`** when every clearance row is `Cleared`/`With Accountability` (none `Pending`). Optional: exit-interview + quitclaim as fields on the separation or a small child.

> **Clearance model — HR-centralized encoding.** One HR user routes and **records** every area's sign-off in the clearance board; they capture `cleared_by` (the actual departmental signatory — IT head, Finance, etc.) while `signed_by` audits which HR user encoded it. This is deliberately *not* per-department login/sign-off (which would need routing + per-area roles + notifications); HR collects the physical/email approvals and encodes them, and `cleared_by` keeps the audit honest about who really cleared each area.

> **Do not duplicate the money math:** clearance `amount`s are surfaced to Payroll [Final Pay](../payroll/final_pay.md) as deductions; HR records them, Payroll subtracts them.

---

## 4. Backend (Domain Query/Handler + thin controller, `hr`)

Routes (in the HR portal file [routes/api/hr.php](../../../routes/api/hr.php), loaded under the `hr` prefix by `routes/api.php`):
```php
Route::get('/separations',                 [EmployeeSeparationController::class, 'index']);      // list + filters
Route::post('/separations',                [EmployeeSeparationController::class, 'store']);       // file
Route::put('/separations/{id}',            [EmployeeSeparationController::class, 'update']);
Route::post('/separations/{id}/approve',   [EmployeeSeparationController::class, 'approve']);     // → sets accountjob.sdate + accounts.status=3
Route::get('/separations/{id}/clearance',  [EmployeeSeparationController::class, 'clearance']);   // clearance board
Route::post('/separations/{id}/clearance', [EmployeeSeparationController::class, 'signClearance']); // per-area sign-off
```

- `GetSeparationsQuery` — paginated separations (+ resolved employee, type, status, clearance progress), filters (type, status, department, search).
- `FileSeparationHandler` — create the `employee_separation` (`status='Filed'`) + seed `employee_clearance` rows for the configured areas (`Pending`).
- `ApproveSeparationHandler` — set `status='Approved'`, stamp approver/date. Approval **starts the rendering/notice period, it does not end employment**: only flip the employee to separated when the effective date has arrived. If `effective_date <= today` (AWOL, immediate termination) → **write `accountjob.sdate = effective_date` + `accounts.status = 3` now** (reuse [HandleAccountDetails](../../../app/Domain/Handlers/AccountDetail/HandleAccountDetails.php) `handleStatusUpdate` — `accounts.status` on `accounts`, `sdate` on `accountjob`). If `effective_date` is in the future → **do not flip**; the employee stays `status=1` and serves the notice period. Wrap in `DB::transaction`.
- `ProcessEffectiveSeparations` (`app:process-effective-separations`, scheduled `->daily()` in [routes/console.php](../../../routes/console.php)) — the deferred half: each day, find Approved-and-onward separations whose `effective_date <= today` whose employee is still active, and flip `accounts.status = 3` + `accountjob.sdate` via the same `handleStatusUpdate` path (idempotent via the account-status check; `<= today` catches days the scheduler was down). Mirrors [UpdateSalaryEffectiveDate](../../../app/Console/Commands/UpdateSalaryEffectiveDate.php).
- `SignClearanceHandler` — update a clearance row (`Cleared` / `With Accountability` + amount); when all rows are non-`Pending`, advance the separation to `Cleared`.
- Thin controller, `try/catch`, JSON. No API Resources. Audit via `HandleGlobal::insertTransLog` (match sibling HR controllers).

### 4b. Ownership relocation — DONE (option 2)
- **`separation_type` originates in HR.** [GetSeparatedEmployeesQuery](../../../app/Domain/Queries/tk/GetSeparatedEmployeesQuery.php) now `leftJoin`s the latest active `employee_separation` (via a `MAX(id)` sub-join) and reads `separation_type`, `effective_date`, `last_working_day`, and workflow `status` from HR — `COALESCE(sep.separation_type, tk_final_pay_audits.separation_type)` keeps legacy rows working. The timekeeper never writes `separation_type` (the TK audit `updateOrCreate` only sets checklist booleans), so no write needed relocating — the fix was purely the read path.
- **TK receives during rendering.** The gate changed from `separation_date NOT NULL` to `separation_date NOT NULL OR sep.status IN (Approved, For Clearance, Cleared, Endorsed, Completed)`, so an **approved-but-still-rendering** employee appears in TK's Final Pay Processing before their effective date. The query returns `separationStatus` (HR workflow) + `isRendering` (approved, `separation_date` still null) so TK can distinguish notice-period from separated.
- **`employee_cleared` is HR-derived.** On read, `employeeCleared` is derived from `employee_separation.status ∈ {Cleared, Endorsed, Completed}` when an HR separation exists (falls back to the legacy TK audit flag only for old records with no HR row) — no longer a free timekeeper toggle.

---

## 5. Frontend (HR module `hr/separation`)

New TS module `resources/views/web/src/module/hr/separation/`:
```
separation/
├── index.ts
├── route/separation.routes.ts          # 'hr/separations' (auto-aggregated)
├── api/separation.api.ts               # useSeparationApi()
├── composables/useSeparation.ts        # list + filters + pagination + actions
├── types/types.separation.ts
├── pages/Separations.vue               # directory + detail
└── components/
    ├── SeparationsTable.vue            # list w/ type, status, clearance progress
    ├── SeparationFormModal.vue         # file / edit / approve
    └── ClearanceBoard.vue              # per-area clearance checklist + accountability amounts
```

- **Separations list** — Employee, Type, Filed / Last Working Day / Effectivity, Status (`StatusBadge`), Clearance progress (x/N cleared), Actions. Filters: type, status, department, search. Server-side pagination (match HR CRUD style).
- **Separation form** — employee picker, type, reason, filed/last-working/effective dates, remarks; **Approve** action (with confirmation) that triggers `sdate`/status=3.
- **Clearance board** — one form-style card per area: **Status** select (Pending / Cleared) · **Has Outstanding Accountability?** (No / Yes → Description + Amount) · **Remarks** · **Cleared By** signatory picker (c-select of employees) · **Save**. The two controls map onto the stored `status`: `Yes accountability → With Accountability`, `Cleared + No → Cleared`, else `Pending`. Overall "Cleared when all signed" indicator + running accountability total unlock endorsement. HR encodes each row; `cleared_by` records who in the area actually cleared, `signed_by` audits the HR encoder.
- Emerald accent, valid Tailwind tokens, dark mode; global `StatusBadge`/`Pagination`/`Modal`/`EmptyState`/`TableSkeleton`.
- Add a sidebar entry under HR (e.g. **Employee Records → Separations**) in [useSidebarLinks.ts](../../../resources/views/web/src/composables/useSidebarLinks.ts).

---

## 6. Edge Cases & Rules

1. **Rendering / notice period:** approval **starts** the notice period but does not end employment. The employee stays `status=1` until `effective_date`; `sdate` + `status=3` are written on the effective date (immediately at approval only if effectivity is today/past, otherwise by the daily `app:process-effective-separations` cron). A filed-but-unapproved — or approved-but-still-rendering — separation must not appear as separated to TK/Payroll.
2. **Single source of truth for type/reason:** TK and Payroll read them from HR; the timekeeper never keys separation type.
3. **Clearance gates endorsement:** TK endorsement (and Payroll final pay) should require `employee_separation.status = 'Cleared'` (or surface outstanding accountabilities).
4. **Accountabilities → Payroll:** clearance `amount`s are deductions in the Payroll Final Pay computation — HR records, Payroll subtracts (no double entry).
5. **Reinstatement/cancellation:** cancelling an approved separation must clear `accountjob.sdate` + restore `accounts.status` (mirror the approve path in reverse).
6. **Authorization:** HR-officer role; separation data is sensitive ([hrms-rules](../../../rules/conditional/payroll.md) §4).

---

## 7. Testing & Build Order

- **PHPUnit:** `ApproveSeparationHandler` flips `sdate` + status=3 immediately only when `effective_date <= today`, and leaves the employee `status=1` when it is in the future; `ProcessEffectiveSeparations` flips a future-dated separation once its `effective_date` arrives and is idempotent on re-run; `FileSeparationHandler` seeds clearance rows; `SignClearanceHandler` advances to `Cleared` only when all areas signed; `GetSeparationsQuery` filters + clearance progress; cancellation reverses `sdate`.
- **Vitest:** `useSeparation` list/filter/pagination; clearance board completeness gating; approve confirmation flow.
- **Build order (design-first):**
  - **Gate 1 — frontend (hard-coded):** separations list + form + clearance board with hard-coded data for design review (**teal** accent — matches the sibling HR `business_units` module; "closest sibling wins", new layout).
  - **Gate 2 — backend:** `employee_separation` + `employee_clearance` tables/models + queries/handlers + routes; wire approval to `accountjob.sdate` + `accounts.status=3` via `handleStatusUpdate`; **relocate `separation_type` ownership** (§4b) and make TK read it; swap api to live.
  - **Integration:** [GetSeparatedEmployeesQuery](../../../app/Domain/Queries/tk/GetSeparatedEmployeesQuery.php) now sources type/clearance from HR and receives approved-but-rendering employees (§4b — **done**). Clearance accountabilities feed via [GetClearanceAccountabilitiesQuery](../../../app/Domain/Queries/hr/GetClearanceAccountabilitiesQuery.php) — already surfaced in the TK endorsement view (`payroll.outstandingAdjustments`); pending consumer is the greenfield Payroll [Final Pay](../payroll/final_pay.md) `ProcessFinalPayHandler` (call the same query for the deduction line).

> This closes the Final Pay chain: HR initiates + clears, Timekeeping validates + endorses, Payroll computes + disburses — each portal owning exactly its responsibility.
