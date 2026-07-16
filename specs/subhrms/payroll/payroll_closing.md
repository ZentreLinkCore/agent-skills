# Spec — Payroll Closing (finalize / lock a payroll period)

> **Status:** Design (page + module do not exist yet in the Payroll portal).
> **Portal:** Payroll (`payroll` controller namespace, `payroll` URL prefix, `payroll` frontend module folder).
> **Upstream:** Timesheet Closing → **Payroll Processing** ([timesheet_summary.md](./timesheet_summary.md)) → **Payroll Closing** (this spec).
> **Models on:** the timekeeping **Timesheet Closing** feature — same UX (period status card, exceptions tracker, lock/unlock, history), applied to the payroll gate.
> **Authoritative conventions:** [.agents/rules/project-profile.md](../../rules/project-profile.md). Follow it; do not re-derive the architecture.

---

## 1. Purpose & Context

**Payroll Processing** ([timesheet_summary.md](./timesheet_summary.md)) computes each employee's payslip (hours → gross → deductions → net) into `payroll_run` / `payroll_run_detail`, but deliberately leaves processing **repeatable** — it does **not** finalize the period.

**Payroll Closing** is the deliberate, audited step that **finalizes** a pay period for payroll:

1. Shows the payroll status of the selected period (open/closed, headcount, processed vs. pending, total gross/net).
2. Surfaces **pre-close exceptions** — anything that should block a clean close (employees not yet processed, no rate, negative net, timekeeping not closed).
3. Lets the payroll officer **Lock** (finalize) or **Unlock** (reopen) the period, with a required comment, writing an audit trail.

Locking sets `payroll_period.pay_process_status = 1`, stamps who/when, and freezes the run so downstream reports (Payroll Summary, government reports, bank files) read a stable, final data set. Unlock reverses it for corrections and re-processing.

This is the payroll mirror of the timekeeping [Timesheet Closing](../../../resources/views/web/src/module/timekeeping/timesheet_closing/) page — same shape, payroll gate.

---

## 2. Data Flow

```text
Payroll Processing        ──►  payroll_run / payroll_run_detail   (per-emp payslips, run.status = 0 Draft)
   (payroll portal)             payroll_period.pay_process_status = 0 (still open, repeatable)
        │
        ▼
PAYROLL CLOSING      ◄── payroll_period            → status, gate flags
   (payroll portal)  ◄── payroll_run(_detail)      → processed vs. pending headcount, totals
        │            ◄── roster of active employees → who is still un-processed (exception)
        │
        │   LOCK  ─►  payroll_period.pay_process_status = 1, pay_process_idacct, pay_process_date
        │        ─►  payroll_run.status = 1 (frozen)
        │        ─►  pay_period_lock_history (+ 'Locked' row)      [NEW TABLE]
        │
        │   UNLOCK ─► pay_process_status = 0 ; payroll_run.status = 0 ; history (+ 'Unlocked' row)
        ▼
Downstream (stable, final): Payroll Summary, government reports, bank/payslip files
```

### Gate columns on `payroll_period` (model `App\Models\PayPeriod`, table `payroll_period`)

Already present — this spec **reads/writes** them, no migration needed:

| Column | Meaning |
|---|---|
| `tk_process_status` | `0` Open / `1` Closed. Timekeeping must be closed before payroll can close. |
| `pay_process_status` | `0` Open / `1` Closed. **Written by this feature** (the payroll lock). |
| `pay_process_idacct` | Account that locked/unlocked payroll. |
| `pay_process_date` | Timestamp of the last lock/unlock. |

Source: [database/migrations/table/payroll/2024_11_19_140353_create_payroll_period_table.php](../../../database/migrations/table/payroll/2024_11_19_140353_create_payroll_period_table.php).

---

## 3. Reference Implementation to Mirror (timekeeping)

Match these patterns exactly — payroll closing is a structural clone:

| Concern | Timekeeping source to mirror |
|---|---|
| Status query | [GetPeriodLockStatusQuery](../../../app/Domain/Queries/Timesheet/GetPeriodLockStatusQuery.php) |
| Periods list (year filter) | [GetTimesheetClosingPeriodsQuery](../../../app/Domain/Queries/Timesheet/GetTimesheetClosingPeriodsQuery.php) |
| Exceptions | [GetTimesheetExceptionsQuery](../../../app/Domain/Queries/Timesheet/GetTimesheetExceptionsQuery.php) |
| Lock history | [GetPeriodLockHistoryQuery](../../../app/Domain/Queries/Timesheet/GetPeriodLockHistoryQuery.php) |
| Lock / Unlock handlers | [LockPeriodHandler](../../../app/Domain/Handlers/Timesheet/LockPeriodHandler.php), [UnlockPeriodHandler](../../../app/Domain/Handlers/Timesheet/UnlockPeriodHandler.php) |
| History model + table | [TkPeriodLockHistory](../../../app/Models/TkPeriodLockHistory.php) + [create_tk_period_lock_history_table](../../../database/migrations/table/payroll/2026_06_21_232830_create_tk_period_lock_history_table.php) |
| Frontend composable / api / page | [useTimesheetClosing.ts](../../../resources/views/web/src/module/timekeeping/timesheet_closing/composables/useTimesheetClosing.ts), [timesheet_closing.api.ts](../../../resources/views/web/src/module/timekeeping/timesheet_closing/api/timesheet_closing.api.ts), [TimesheetClosing.vue](../../../resources/views/web/src/module/timekeeping/timesheet_closing/pages/TimesheetClosing.vue) |
| Frontend components | `TimesheetClosingHeader`, `PeriodStatusCard`, `ExceptionTracker`, `ClosingHistoryTable` |

---

## 4. Target Location (files to create)

Frontend — new module `payroll/payroll_closing` (TS layout per project-profile):

```
resources/views/web/src/module/payroll/payroll_closing/
├── index.ts                                  # barrel
├── route/payroll_closing.routes.ts           # NEW — 'payroll/payroll-closing' (auto-aggregated)
├── api/payroll_closing.api.ts                # NEW — usePayrollClosingApi()
├── composables/usePayrollClosing.ts          # NEW — mirror useTimesheetClosing
├── types/types.payroll_closing.ts            # NEW
├── pages/PayrollClosing.vue                   # NEW — main page
└── components/
    ├── PayrollClosingHeader.vue              # NEW — title + period picker + prev/next
    ├── PeriodStatusCard.vue                  # NEW — open/closed, processed/pending, gross/net
    ├── ExceptionTracker.vue                  # NEW — pre-close blockers list
    ├── ClosingHistoryTable.vue               # NEW — lock/unlock audit log
    ├── LockConfirmModal.vue                  # NEW — comment + confirm lock
    └── UnlockConfirmModal.vue                # NEW — comment + confirm unlock
```

Routing is auto-aggregated by `payroll/useApiWebRoute.ts` — dropping the `route/*.routes.ts` registers it. Do **not** edit the aggregator.

Backend — Domain Query/Handler + thin controller:

```
app/Domain/Queries/Payroll/GetPayrollClosingStatusQuery.php      # NEW
app/Domain/Queries/Payroll/GetPayrollClosingPeriodsQuery.php     # NEW
app/Domain/Queries/Payroll/GetPayrollExceptionsQuery.php         # NEW
app/Domain/Queries/Payroll/GetPayrollLockHistoryQuery.php        # NEW
app/Domain/Handlers/Payroll/LockPayrollPeriodHandler.php         # NEW
app/Domain/Handlers/Payroll/UnlockPayrollPeriodHandler.php       # NEW
app/Http/Controllers/payroll/PayrollClosingController.php        # NEW (thin)
app/Models/PayPeriodLockHistory.php                             # NEW
database/migrations/table/payroll/xxxx_create_pay_period_lock_history_table.php  # NEW
routes/api/payroll.php  →  add beside the sibling payroll routes  # ADD routes
```

---

## 5. Backend Design

### 5.1 Routes — add in the payroll portal file [routes/api/payroll.php](../../../routes/api/payroll.php)

```php
// Payroll Closing (finalize / lock the payroll period)
Route::get('/payroll-closing/status',     [PayrollClosingController::class, 'status']);
Route::get('/payroll-closing/periods',    [PayrollClosingController::class, 'periods']);
Route::get('/payroll-closing/exceptions', [PayrollClosingController::class, 'exceptions']);
Route::get('/payroll-closing/history',    [PayrollClosingController::class, 'lockHistory']);
Route::post('/payroll-closing/lock',      [PayrollClosingController::class, 'lockPeriod']);
Route::post('/payroll-closing/unlock',    [PayrollClosingController::class, 'unlockPeriod']);
```

Endpoints resolve to `api/payroll/payroll-closing/...` (payroll prefix = namespace, no `tk`/`timekeeping` split here).

### 5.2 Controller — thin dispatcher

`app/Http/Controllers/payroll/PayrollClosingController.php`, extends `App\Http\Controllers\Controller`. Each method calls a Query/Handler statically in `try/catch (Exception $e)`, returns `response()->json(...)`. **No API Resources.** For lock/unlock, pass the authenticated user id (`$request->user()->id`) into the handler as `user_id` — mirror the timekeeping controller.

### 5.3 `GetPayrollClosingStatusQuery`

Mirror [GetPeriodLockStatusQuery]. Resolve the cutoff via `HandlePayPeriodQuery::handlePeriod($params)` (accepts `from`/`to`/`idperiod`/`prev`/`next`/`period`/`reload`, and the legacy `period_key = start_end`). Return:

```php
return [
    'period'         => $cutoff_period,                 // id, period_start, period_end, tk/pay status
    'status'         => $payProcessStatus == 1 ? 'Closed' : 'Open',
    'tk_status'      => $tkProcessStatus == 1 ? 'Closed' : 'Open',
    'totalEmployees' => $activeCount,
    'processedCount' => $processedCount,   // employees with a payroll_run_detail for the run
    'pendingCount'   => $activeCount - $processedCount,
    'exceptionsCount'=> $exceptionCount,   // = count(GetPayrollExceptionsQuery)
    'totalGross'     => $run?->total_gross ?? 0,
    'totalNet'       => $run?->total_net ?? 0,
];
```

### 5.4 `GetPayrollClosingPeriodsQuery`

Mirror [GetTimesheetClosingPeriodsQuery] verbatim — distinct `year_end` list + periods for the selected year, selecting `id, period, period_start, period_end, paydate, tk_process_status, pay_process_status, status`, ordered `id desc`. Returns `{ periods, years, selected_year }`. (Same query serves both closing pages; reuse if acceptable, else clone into `Payroll`.)

### 5.5 `GetPayrollExceptionsQuery` (pre-close blockers)

Structural mirror of [GetTimesheetExceptionsQuery], but the blockers are payroll-specific. Resolve the cutoff, then collect one entry per issue with `{ empid, fullname, position, unit, issue_type, description, resolve_link }`:

1. **Timekeeping not closed** — if `tk_process_status != 1`, emit a single period-level exception (`issue_type: 'Timekeeping'`, resolve_link `/timekeeping/timesheet-closing`). This alone should block Lock.
2. **Not processed** — active employees (with a `timesheet_summary` row) that have **no** `payroll_run_detail` for the run → `issue_type: 'Unprocessed'`, resolve_link `/payroll/regular-cycle`.
3. **No rate** — employees flagged `No Rate` (no `accountjob` / no `salary`) → `issue_type: 'No Rate'`, resolve_link to compensation setup.
4. **Negative / anomalous net** — processed rows where `net_pay < 0` → `issue_type: 'Negative Net'`, resolve_link `/payroll/regular-cycle`.

Return the flat exceptions array (same shape the timekeeping tracker consumes).

### 5.6 `GetPayrollLockHistoryQuery`

Mirror [GetPeriodLockHistoryQuery]: return recent `pay_period_lock_history` rows joined with the actor (`account`) and period, newest first — `{ action, comments, created_by_name, period, created_at }`.

### 5.7 `LockPayrollPeriodHandler` / `UnlockPayrollPeriodHandler`

Mirror [LockPeriodHandler] / [UnlockPeriodHandler]. Input `{ period_key: "start_end", comments, user_id }`.

**Lock:**
1. Require `user_id`; parse `period_key` into `start`/`end`; resolve the `PayPeriod` (throw if missing).
2. **Guard:** `tk_process_status` must be `1` → else `throw new Exception("Timekeeping is not yet closed. Payroll cannot be closed.")`.
3. **Guard (recommended):** block if there are hard exceptions (unprocessed employees) unless a `force` flag is passed → `throw new Exception("There are unprocessed employees. Resolve exceptions or force-close.")`.
4. In `DB::transaction`: set `pay_process_status = 1`, `pay_process_idacct = user_id`, `pay_process_date = now()`; set the period's `payroll_run.status = 1`; write a `pay_period_lock_history` row (`action: 'Locked'`, comments).

**Unlock:** reverse — `pay_process_status = 0`, stamp actor/date, `payroll_run.status = 0`, history row (`action: 'Unlocked'`, default comment "Reopened payroll for corrections."). Both return `true`.

---

## 6. New Persistence — `pay_period_lock_history`

Clone of `tk_period_lock_history` for the payroll lock audit trail.

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `idpayperiod` | unsignedBigInteger, indexed | → `payroll_period.id` |
| `action` | string(50) | `Locked` / `Unlocked` |
| `comments` | text nullable | required from the UI in practice |
| `created_by` | unsignedBigInteger, indexed | → `accounts.id` |
| `timestamps` | | |

Model `App\Models\PayPeriodLockHistory` (mirror `TkPeriodLockHistory`: `$fillable`, `account()` + `payPeriod()` relations).

> **Reuse check (System Awareness):** confirm whether `tk_period_lock_history` is intended to be timekeeping-only. This spec keeps payroll history separate (`pay_period_lock_history`) so the two audit trails don't collide. If the team prefers one shared table, add an `area` column instead — flag the decision, don't silently overload.

---

## 7. Frontend Design

Mirror [useTimesheetClosing.ts](../../../resources/views/web/src/module/timekeeping/timesheet_closing/composables/useTimesheetClosing.ts) and [TimesheetClosing.vue](../../../resources/views/web/src/module/timekeeping/timesheet_closing/pages/TimesheetClosing.vue).

### 7.1 API layer — `api/payroll_closing.api.ts`

```ts
import http from '@/app/axios/axiosInstance';

export function usePayrollClosingApi() {
  return {
    getStatus:      async (params: any = {}) => (await http.get('api/payroll/payroll-closing/status', { params })).data,
    getPeriodsList: async (year?: string)   => (await http.get('api/payroll/payroll-closing/periods', { params: year ? { year } : {} })).data,
    getExceptions:  async (params: any = {}) => (await http.get('api/payroll/payroll-closing/exceptions', { params })).data,
    getLockHistory: async ()                => (await http.get('api/payroll/payroll-closing/history')).data,
    lockPeriod:     async (periodKey: string, comments: string) => (await http.post('api/payroll/payroll-closing/lock',   { period_key: periodKey, comments })).data,
    unlockPeriod:   async (periodKey: string, comments: string) => (await http.post('api/payroll/payroll-closing/unlock', { period_key: periodKey, comments })).data,
  };
}
```

### 7.2 Composable — `composables/usePayrollClosing.ts`

Copy `useTimesheetClosing` shape:

- **State:** `period` (`id`, `period_start`, `period_end`, `check_period_flag`), `selectedCutoffPeriod`, `statusData` (`{ status, tk_status, exceptionsCount, totalEmployees, processedCount, pendingCount, totalGross, totalNet }`), `exceptions[]`, `history[]`, `periodsList[]`, `availableYears[]`, `activeYear`, `isLoading`, modal flags `isLockModalActive` / `isUnlockModalActive`, `commentsText`.
- **`periodKey`** computed = `${period_start}_${period_end}`.
- **`loadPeriodData(params)`** — GET status (adopt backend-resolved period, sync `?from&to` to the route), then exceptions (with resolved dates), history, and periods list. Same `onMounted` + `watch(route.query)` URL-driven period navigation as the timekeeping composable.
- **`handleLockPeriod()` / `handleUnlockPeriod()`** — call the api with `periodKey` + `commentsText`, close modal, reload. Comment is **required** — disable the confirm button when empty.
- **Guards in UI:** disable **Lock** when `statusData.tk_status !== 'Closed'` or `exceptionsCount > 0` (offer a "force close" only if the team wants it); disable **Unlock** when already open.

### 7.3 Page & components

- **`PayrollClosing.vue`** — root layout copies the timekeeping closing page; payroll accent (cyan — see [ui-design](../../rules/ui-design.md) / project-profile portal colors). Sections: header, `PeriodStatusCard`, `ExceptionTracker`, `ClosingHistoryTable`, lock/unlock modals.
- **`PayrollClosingHeader.vue`** — title, `VDatePicker` period range, prev/next, and the Lock / Unlock action buttons (state-aware, disabled per guards). Banner when `tk_status !== 'Closed'`.
- **`PeriodStatusCard.vue`** — Open/Closed badge (`StatusBadge`), headcount, processed vs. pending, total gross / total net (peso via `formatCurrency`).
- **`ExceptionTracker.vue`** — list of pre-close blockers grouped by `issue_type`, each with a "Resolve" link; empty (green "Ready to close") state when none.
- **`ClosingHistoryTable.vue`** — audit log (action badge, actor, comment, timestamp via `timeAgo`/`formatDate`); global `<Pagination>` + `<TableSkeleton>` + `<EmptyState>`.
- Use globally-registered components without import (`VDatePicker`, `StatusBadge`, `Pagination`, `Spinner`, `EmptyState`, `TableSkeleton`); import `Modal` from `@/src/components/Modal.vue`.

---

## 8. Filtering & Pagination

- **Periods list**: filter by **year** (dropdown from `availableYears`), like Timesheet Closing.
- **History table**: client-side pagination via global `<Pagination>` (default 10/page); optional search on actor/action.
- **Exceptions**: grouped list; optional filter by `issue_type`. Period is the primary axis — `VDatePicker` + prev/next, URL-synced (`?from&to`).

---

## 9. Edge Cases & Rules

1. **Timekeeping not closed** (`tk_process_status != 1`): Lock blocked (guard + banner); a period-level exception is shown.
2. **Unprocessed employees exist**: Lock blocked unless `force`; each is an `Unprocessed` exception linking back to Payroll Processing.
3. **No-rate / negative-net rows**: surfaced as exceptions; must be resolved (or acknowledged) before a clean close.
4. **Already closed** (`pay_process_status = 1`): Lock hidden/disabled; only **Unlock** is available; run is read-only downstream.
5. **Unlock → re-process**: unlocking sets `pay_process_status = 0` and `payroll_run.status = 0` so Payroll Processing can re-run and upsert details. Every lock/unlock is logged.
6. **Comment required**: both lock and unlock require a non-empty comment (audit trail).
7. **Concurrency**: wrap status/run writes + history in one `DB::transaction`.
8. **Authorization**: privileged payroll-officer action — gate routes/UI per the project's existing authorization approach ([security](../../rules/security.md)).

---

## 10. Testing (per [.agents/rules/testing.md](../../rules/testing.md))

- **PHPUnit:**
  - `GetPayrollClosingStatusQuery`: status/gate derivation, processed vs. pending counts, totals.
  - `GetPayrollExceptionsQuery`: emits each blocker type (tk-open, unprocessed, no-rate, negative-net); empty when clean.
  - `LockPayrollPeriodHandler`: blocks when `tk_process_status != 1`; blocks on hard exceptions unless `force`; sets `pay_process_status`/actor/date + `payroll_run.status = 1`; writes history; transaction rollback on failure.
  - `UnlockPayrollPeriodHandler`: reverses status + run + writes `Unlocked` history.
- **Vitest** — `usePayrollClosing`: Lock disabled when `tk_status != 'Closed'` or `exceptionsCount > 0`; confirm disabled when comment empty; URL-driven period navigation; reload after lock/unlock.

---

## 11. Build Order (design-first)

Per the design-first flow ([AGENTS.md](../../AGENTS.md)) — frontend hard-coded design first for review, then backend adds dynamic data.

**Gate 1 — `webkit.frontend-implement` (hard-coded, for review):**

1. `types/` + `api/payroll_closing.api.ts` returning **hard-coded** status / exceptions / history (real field names from §5–§6; seed an open period with a couple of exceptions and a closed period with none).
2. Composable + `PayrollClosing.vue` + components (header, status card, exception tracker, history table, lock/unlock modals).
3. **Review the design against this spec** — status card, exception blockers, lock/unlock flow, history. Adjust before backend work.

**Gate 2 — `webkit.backend-implement` (add dynamic data):**

1. Migration + model: `pay_period_lock_history`.
2. Status / periods / exceptions / history queries + controller + routes.
3. Lock / Unlock handlers (with guards, `payroll_run.status`, history) + controller + routes.
4. Swap the hard-coded api methods for live `http` calls (same shape).
5. Tests — PHPUnit guard/handler coverage first, then Vitest.

> Reuse the timekeeping closing classes as the template. Confirm during the System Awareness scan whether `payroll_run.status` is the right freeze flag (per [timesheet_summary.md](./timesheet_summary.md) §6.1) and whether to share vs. clone the lock-history table.
