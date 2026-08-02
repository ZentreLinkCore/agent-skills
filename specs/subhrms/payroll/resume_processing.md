# Spec — Resume Processing After Page Refresh or Connection Loss

> **Kind:** Extension — Interrupted batch task state persistence, progress checkpointing, and resume capabilities for long-running payroll & HRMS operations.
> **Portal:** **Payroll / Global** (`/api/payroll/...` routes, `payroll_processing` frontend module).
> **Route:** `payroll/payroll-processing` (`payroll_processing_regular_cycle`).
> **Conventions:** [project-profile.md](../../rules/project-profile.md), [hrms-rules](../../rules/hrms-rules.md).
> **System Awareness:** Models created: `ProcessingCheckpoint`; Tables created: `processing_checkpoints`; Routes created: `api/payroll/checkpoint/*`; New migration: yes.

---

## 1. Purpose

During long-running batch operations — such as regular payroll calculations, retro-active pay calculations, final pay assembly, 13th-month processing, or bulk timesheet generation — unexpected page refreshes, browser crashes, computer restarts, or temporary network disconnects can interrupt processing mid-way.

Currently, if a batch run of 200 employees fails or refreshes at 80% completion, the user is forced to restart the entire process from 0%, leading to redundant computation, increased server load, and risk of partial/duplicate calculation states.

This feature introduces a **State-Saving & Checkpointing Architecture** that:
1. Continuously tracks batch progress and saves completed record IDs to a database checkpoint table after every chunk execution (e.g., every 10 records).
2. Automatically detects unfinished / interrupted processes when the user returns to or reloads the page.
3. Surfaces a prominent **"Continue Process"** prompt/banner notifying the user of the exact interruption state (e.g. "Run interrupted at 20% completion — 20 of 100 employees completed").
4. Resumes processing seamlessly from the last saved checkpoint, skipping all previously completed records to prevent duplicate calculation and guarantee data consistency.

---

## 2. Design Decisions (Pros & Cons)

### Decision 1: Checkpoint State Storage Strategy

**Option A — Database Checkpoint Table (`processing_checkpoints`) + Client LocalStorage Mirror (Recommended)**
- Checkpoints are written to a dedicated MySQL table `processing_checkpoints` upon completion of each chunk. Simultaneously, lightweight metadata is synced to browser `localStorage` as a fallback for instant client-side detection during offline state or initial page render.

| Pros | Cons |
|---|---|
| Persistent across browser clears, device switches, and multi-tab sessions. | Requires database writes per chunk (minimal load when chunked by 10). |
| Server maintains single source of truth for completed record IDs. | Requires a new migration and model class. |
| Enables auditing of interrupted and resumed runs. | |

**Option B — Pure Client-Side Storage (`localStorage` / `sessionStorage`)**
- Processing state is stored only in the user's browser storage.

| Pros | Cons |
|---|---|
| Zero database schema changes. | Wiped if user clears browser cache or switches browser/device. |
| Extremely fast read/write. | Risk of frontend state drifting from database state if backend committed records. |

**Recommendation:** Option A. Payroll processing commits records to database tables (`payroll_run_detail`). Storing state in DB ensures perfect synchronization between the checkpoint record set and the database state.

---

### Decision 2: Record Skipping & Duplicate Prevention Mechanism

**Option A — Pre-calculated ID Exclusions with Per-Chunk DB Commits (Recommended)**
- Each batch execution updates `completed_ids` (JSON) in `processing_checkpoints` and commits DB transactions per chunk. When resuming, the system excludes `completed_ids` from the execution queue, processing only `pending_ids`. `ProcessPayrollHandler` also performs an internal idempotent check: if a record for `empid` + `idpayperiod` + `cycle` already exists in `payroll_run_detail`, it skips recalculation unless explicitly flagged for overwrite.

| Pros | Cons |
|---|---|
| Guarantees idempotency — no employee is calculated twice. | Requires serializing array of completed IDs into checkpoint payload. |
| Partial progress is permanently saved even if subsequent chunks fail. | |
| Reduces total computation time directly proportional to skipped count. | |

**Option B — Transaction Rollback (All-or-Nothing)**
- If a batch run is interrupted, the entire transaction is rolled back so 0 records remain, requiring a full restart.

| Pros | Cons |
|---|---|
| Simple transaction boundary. | Defeats the user requirement to resume from 20% completion. |

**Recommendation:** Option A. Matches the explicit requirement that completed records must be skipped to save time and preserve data integrity.

---

### Decision 3: Interruption Detection & Resume UX Trigger

**Option A — Persistent Top Banner & Modal Confirmation Prompt on Page Mount (Recommended)**
- When `RegularCycle.vue` mounts, a composable queries for active interrupted checkpoints matching the active cutoff period & pay group. If found, a top banner and interactive prompt display: **"Unfinished Run Detected (20% Completed)"** with action buttons **"Continue Process"** and **"Discard & Start Over"**.

| Pros | Cons |
|---|---|
| Gives explicit control to the user to choose whether to resume or start clean. | Requires minor addition to page layout header / banner area. |
| Clear visual feedback showing exact progress retained (e.g. 20 of 100 done). | |

**Option B — Automatic Silent Auto-Resume on Page Load**
- Immediately resumes processing in the background as soon as the user opens the page without asking.

| Pros | Cons |
|---|---|
| Zero clicks required. | May surprise users who intended to change parameters or cancel the run. |

**Recommendation:** Option A. Gives users clear visibility, control, and explicit confirmation before resuming background server tasks.

---

### Decision 4: Checkpoint Lifetime & Invalidation Policy

**Option A — Context-Bound Expiration & Manual Invalidation (Recommended)**
- A checkpoint automatically invalidates if:
  1. The user clicks "Discard & Start Over".
  2. The cutoff period or pay group selection changes.
  3. The timekeeping or payroll period is closed/locked.
  4. The checkpoint exceeds 24 hours without activity (stale checkpoint cleanup).

| Pros | Cons |
|---|---|
| Prevents stale checkpoints from blocking future fresh runs. | Requires validation checks on page load / selection change. |
| Clean separation per pay group and period. | |

**Option B — Permanent Retention**
- Checkpoints remain active until explicitly finished.

| Pros | Cons |
|---|---|
| Never loses state regardless of time passed. | Risks presenting outdated state if underlying timesheet data changed days later. |

**Recommendation:** Option A. Ensures calculations are always executed against current period configurations and active rosters.

---

## 3. Database

### New Table: `processing_checkpoints`

Create migration `database/migrations/table/payroll/2026_08_02_000001_create_processing_checkpoints_table.php`:

| Column Name | Type | Modifiers / Index | Description |
|---|---|---|---|
| `id` | `unsignedBigInteger` | `primary`, `auto_increment` | Primary key |
| `idacct` | `unsignedInteger` | `index('idx_chk_idacct')` | User/Account ID who initiated run |
| `task_type` | `string(64)` | `index('idx_chk_task_type')` | e.g. `'payroll_regular_cycle'`, `'payroll_retro'`, `'payroll_final_pay'`, `'timesheet_process'` |
| `scope_key` | `string(191)` | `index('idx_chk_scope_key')` | Composite key: `period:{id}_paygroup:{id}_cycle:{cycle}` |
| `total_records` | `integer` | | Total number of employees/records in full run |
| `processed_count` | `integer` | `default(0)` | Number of completed records so far |
| `progress_pct` | `decimal(5, 2)` | `default(0.00)` | Completion percentage (0.00 - 100.00) |
| `last_processed_id` | `string(64)` | `nullable()` | Employee ID or record key last completed |
| `completed_ids` | `json` / `longText` | `nullable()` | JSON array of record IDs completed `["EMP001", "EMP002"]` |
| `pending_ids` | `json` / `longText` | `nullable()` | JSON array of record IDs remaining `["EMP003", "EMP004"]` |
| `payload_params` | `json` / `longText` | `nullable()` | Context params `{ idperiod: 15, idpaygrp: 2, cycle: 'regular' }` |
| `status` | `string(32)` | `index('idx_chk_status')`, `default('in_progress')` | Status: `in_progress`, `interrupted`, `completed`, `cancelled`, `failed` |
| `last_heartbeat_at` | `timestamp` | `nullable()` | Last heartbeat / chunk update time |
| `started_at` | `timestamp` | `useCurrent()` | Start timestamp |
| `completed_at` | `timestamp` | `nullable()` | Completion timestamp |
| `timestamps` | | `nullable()` | `created_at` and `updated_at` |

**Indexes:**
- `idx_chk_user_scope`: composite index on `(idacct, scope_key, status)` for lightning-fast active checkpoint lookups.

---

## 4. Backend Architecture

Follows the verified Query/Handler/Action pattern ([project-profile.md](../../rules/project-profile.md)):

### 1. Model: `App\Models\ProcessingCheckpoint.php`
- Location: `app/Models/ProcessingCheckpoint.php`
- `$table = 'processing_checkpoints'`
- `$fillable`: `['idacct', 'task_type', 'scope_key', 'total_records', 'processed_count', 'progress_pct', 'last_processed_id', 'completed_ids', 'pending_ids', 'payload_params', 'status', 'last_heartbeat_at', 'started_at', 'completed_at']`
- `$casts`: `['completed_ids' => 'array', 'pending_ids' => 'array', 'payload_params' => 'array', 'last_heartbeat_at' => 'datetime', 'started_at' => 'datetime', 'completed_at' => 'datetime']`

---

### 2. Queries

#### `App\Queries\Payroll\GetActiveCheckpointQuery`
- Location: `app/Queries/Payroll/GetActiveCheckpointQuery.php`
- Class signature: `class GetActiveCheckpointQuery extends Query`
- Method signature: `public static function execute($params = [])`
- Parameters: `idacct`, `task_type`, `scope_key`
- Logic:
  - Fetches the latest row from `processing_checkpoints` matching `idacct`, `task_type`, `scope_key` where `status IN ('in_progress', 'interrupted')` and `updated_at >= NOW() - INTERVAL 24 HOUR`.
  - Returns `null` if no active/interrupted task exists.

---

### 3. Handlers & Actions

#### `App\Handlers\Payroll\SaveProcessingCheckpointHandler`
- Location: `app/Handlers/Payroll/SaveProcessingCheckpointHandler.php`
- Class signature: `class SaveProcessingCheckpointHandler extends Handler`
- Method signature: `public static function execute($params = [])`
- Purpose: Orchestrates checkpoint creation or update after each processed batch chunk.
- Logic:
  1. Computes `scope_key` = `"period:{$idperiod}_paygroup:{$idpaygrp}_cycle:{$cycle}"`.
  2. Finds existing active `ProcessingCheckpoint` or initializes a new one.
  3. Merges newly completed IDs into `completed_ids` array.
  4. Removes newly completed IDs from `pending_ids` array.
  5. Recalculates `processed_count` = `count(completed_ids)`.
  6. Recalculates `progress_pct` = `round((processed_count / total_records) * 100, 2)`.
  7. If `processed_count >= total_records`, sets `status = 'completed'` and `completed_at = now()`. Otherwise sets `status = 'interrupted'` (or `'in_progress'`) and updates `last_heartbeat_at = now()`.
  8. Saves inside `DB::transaction(...)`.

#### `App\Handlers\Payroll\CancelProcessingCheckpointHandler`
- Location: `app/Handlers/Payroll/CancelProcessingCheckpointHandler.php`
- Class signature: `class CancelProcessingCheckpointHandler extends Handler`
- Method signature: `public static function execute($params = [])`
- Purpose: Marks active checkpoint as `'cancelled'` when user chooses "Discard & Start Over".

#### `App\Actions\Payroll\SkipCompletedRecordsAction` (Optional Helper Action)
- Location: `app/Actions/Payroll/SkipCompletedRecordsAction.php`
- Purpose: Filters a given array of target `emp_ids` against existing `completed_ids` in `ProcessingCheckpoint` and existing rows in `payroll_run_detail`, returning only uncomputed IDs.

---

### 4. Controller & Routes

#### Controller: `App\Http\Controllers\payroll\PayrollCheckpointController`
- Location: `app/Http/Controllers/payroll/PayrollCheckpointController.php`
- Methods:
  - `getActiveCheckpoint(Request $request)`
  - `saveCheckpoint(Request $request)`
  - `cancelCheckpoint(Request $request)`

#### Route Registration in `routes/api/payroll.php`
```php
// Checkpoint & Resume Processing Management
Route::prefix('checkpoint')->group(function () {
    Route::get('/active', [PayrollCheckpointController::class, 'getActiveCheckpoint']);
    Route::post('/save', [PayrollCheckpointController::class, 'saveCheckpoint']);
    Route::post('/cancel', [PayrollCheckpointController::class, 'cancelCheckpoint']);
});
```

---

## 5. Frontend Architecture

### 1. Types & DTOs: `resources/views/web/src/module/payroll/payroll_processing/types/types.checkpoint.ts`

```ts
export interface ProcessingCheckpointData {
  id?: number;
  idacct?: number;
  task_type: string;
  scope_key: string;
  total_records: number;
  processed_count: number;
  progress_pct: number;
  last_processed_id: string | null;
  completed_ids: (string | number)[];
  pending_ids: (string | number)[];
  payload_params: Record<string, any>;
  status: 'in_progress' | 'interrupted' | 'completed' | 'cancelled' | 'failed';
  last_heartbeat_at?: string;
  started_at?: string;
}
```

---

### 2. API Hook: `resources/views/web/src/module/payroll/payroll_processing/api/checkpoint.api.ts`

```ts
import http from '@/app/axios/axiosInstance';
import type { ProcessingCheckpointData } from '../types/types.checkpoint';

export function useCheckpointApi() {
  return {
    getActiveCheckpoint: async (params: { task_type: string; scope_key: string }): Promise<{ checkpoint: ProcessingCheckpointData | null }> => {
      const response = await http.get('api/payroll/checkpoint/active', { params });
      return response.data;
    },
    saveCheckpoint: async (payload: Partial<ProcessingCheckpointData>): Promise<{ checkpoint: ProcessingCheckpointData }> => {
      const response = await http.post('api/payroll/checkpoint/save', payload);
      return response.data;
    },
    cancelCheckpoint: async (params: { task_type: string; scope_key: string }): Promise<{ success: boolean }> => {
      const response = await http.post('api/payroll/checkpoint/cancel', params);
      return response.data;
    }
  };
}
```

---

### 3. Composable: `useProcessingCheckpoint.ts`
- Location: `resources/views/web/src/module/payroll/payroll_processing/composables/useProcessingCheckpoint.ts`
- Responsibilities:
  - Tracks active checkpoint ref (`activeCheckpoint`).
  - `checkActiveCheckpoint(taskType, scopeKey)`: Queries backend & checks `localStorage` fallback.
  - `startCheckpoint(taskType, scopeKey, empIds, payloadParams)`: Initializes checkpoint record.
  - `recordChunkSuccess(chunkEmpIds, lastEmpId)`: Invokes API per batch chunk to update `completed_ids` and percentage.
  - `resumeProcess()`: Returns `pending_ids` and pre-fills progress percentage for modal.
  - `discardCheckpoint()`: Calls API to mark checkpoint as cancelled and clears `localStorage`.

---

### 4. Components

#### `ResumeProcessingBanner.vue`
- Location: `resources/views/web/src/module/payroll/payroll_processing/components/ResumeProcessingBanner.vue`
- Visual Design:
  - Gradient amber/cyan banner at the top of `RegularCycle.vue` / processing pages.
  - Displays:
    - Warning/Info Icon `<i class="mdi mdi-restore"></i>`
    - Title: **Unfinished Processing Task Detected**
    - Subtitle: `"Previous run was interrupted at 20% completion (20 of 100 employees calculated). Last record: EMP020."`
    - Action Buttons:
      - **"Continue Process"** (Primary Cyan/Teal Gradient Button with pulse animation)
      - **"Discard & Start Fresh"** (Ghost slate button)

#### `ResumeProcessingModal.vue` (Optional Modal variant for immediate attention on page mount)
- Displays prompt modal if user opens page with an active interrupted task.

---

### 5. Integration into `usePayrollProcessing.ts` & `RegularCycle.vue`

- In `processSelectedPayroll(empIds)`:
  1. Checks if starting fresh or resuming:
     - If fresh: initializes checkpoint with `total_records = empIds.length`, `completed_ids = []`, `pending_ids = empIds`.
     - If resuming: reads `activeCheckpoint.pending_ids` and sets starting progress percentage = `activeCheckpoint.progress_pct`.
  2. In chunk loop (chunks of 10):
     - After `apiRequest.processPayroll(chunk, ...)` completes, calls `checkpointStore.recordChunkSuccess(chunk, lastId)`.
     - Terminal progress modal displays:
       `"[CHECKPOINT] Saved progress: 20/100 (20.00%). Skipped 20 previously completed records."`
  3. When all chunks finish:
     - Checkpoint status automatically transitions to `'completed'`.

---

## 6. Business Rules & Edge Cases

### HRMS Business Rules
1. **Idempotency Guarantee**: Running calculation for an employee who was already computed in the same cutoff period & cycle must not double-create earnings, loans, or statutory deduction records.
2. **Scope Boundaries**: A checkpoint is strictly locked to the combination of `idacct` (logged-in user), `idpayperiod` (cutoff period), `idpaygrp` (pay group), and `cycle` (`regular`, `retro`, `final`, `13th_month`). Changing pay group or cutoff period hides the checkpoint prompt for the previous scope.
3. **Data Freshness**: If an administrator modifies timesheets or salary rates while a checkpoint is interrupted, clicking "Continue Process" calculates remaining records with current rates while preserving already-computed records. If complete re-calculation is desired, the user clicks "Discard & Start Fresh".

### Edge Case Matrix

| Edge Case | Risk | Handling |
|---|---|---|
| Browser crash at chunk 3 of 10 | Mid-chunk interruption | Chunks 1 & 2 (records 1-20) were already committed to DB and checkpointed. Upon page reopen, system offers "Continue Process" starting from record 21. |
| Network disconnect mid-API request | Client loses connection before server responds | Server-side transaction either completes or rolls back for that single chunk. Checkpoint updates on next successful heartbeat/chunk payload response. |
| User opens same page in a 2nd tab | Concurrent resume execution | Checkpoint lock status (`in_progress`) prevents tab 2 from launching a duplicate run while tab 1 is actively calculating. |
| User changes Cutoff Period or Pay Group dropdown | Mismatched checkpoint scope | Checkables query filtered by `scope_key`. Banner only renders if active period & pay group match the checkpoint's `scope_key`. |
| User clicks "Discard & Start Fresh" | Stale checkpoint lingering | API marks checkpoint `status = 'cancelled'`, clears `localStorage`, and starts fresh 0% calculation run. |
| Checkpoint older than 24 hours | Stale data calculation | `GetActiveCheckpointQuery` ignores checkpoints updated > 24 hours ago, auto-archiving them. |

---

## 7. Build Order

Following the spec-driven flow ([project-profile.md](../../rules/project-profile.md)):

1. **Database Migration**: Create `2026_08_02_000001_create_processing_checkpoints_table.php`.
2. **Model & Backend Core**:
   - Create `App\Models\ProcessingCheckpoint.php`.
   - Create `App\Queries\Payroll\GetActiveCheckpointQuery.php`.
   - Create `App\Handlers\Payroll\SaveProcessingCheckpointHandler.php`.
   - Create `App\Handlers\Payroll\CancelProcessingCheckpointHandler.php`.
   - Create `App\Http\Controllers\payroll\PayrollCheckpointController.php`.
   - Register routes in `routes/api/payroll.php`.
3. **Frontend Gate 1 (Static Design & Components)**:
   - Create types in `types/types.checkpoint.ts`.
   - Create `ResumeProcessingBanner.vue` component with mock state (e.g. 20% complete).
   - Integrate `ResumeProcessingBanner` into `RegularCycle.vue` with toggle test.
4. **Frontend Gate 2 (Live API & Checkpoint Integration)**:
   - Create `api/checkpoint.api.ts`.
   - Create `composables/useProcessingCheckpoint.ts`.
   - Wire `useProcessingCheckpoint` into `usePayrollProcessing.ts` (chunk saving + skip logic).
5. **Verification & Edge Case Validation**:
   - Test simulate refresh at 20% completion.
   - Verify "Continue Process" resumes from record 21 to 100%.
   - Verify "Discard & Start Fresh" clears state and restarts from 0%.

---

## 8. Out of Scope (Future Specs)

- Automatic background worker polling via WebSockets / Server-Sent Events (SSE) for zero-browser execution.
- Auto-resume for file upload/import streaming parsers.
- Multi-user administrative override of another user's locked checkpoint.
