# Spec — Employee Attendance Dispute Filing (Employee Self-Service Portal)

> **Kind:** Greenfield (Employee Portal view) / Extension (reuses HR Resolution Center backend model)
> **Portal:** **Employee** (`/api/employee/disputes`, `module/employee/disputes` frontend module).
> **Route:** `employee/disputes` (`employee_disputes`).
> **Conventions:** [project-profile.md](../../rules/project-profile.md), [hrms-rules](../../rules/hrms-rules.md).
> **System Awareness:** Models reused (`AttendanceDispute`); Tables reused (`attendance_disputes`); Routes created (`routes/api/employee.php`); New migration: `no`.

---

## 1. Purpose
Empowers employees to file attendance and payroll dispute tickets directly from their Employee Self-Service (ESS) Portal when they detect uncredited overtime, missing punch adjustments, disputed attendance deductions, or incorrect shift records. Integrates directly into the HR Timekeeping Resolution Center (`AttendanceDispute` table), giving HR full visibility, attachment evidence review, and real-time chat timeline responses.

---

## 2. Design Decisions (Pros & Cons)

### Decision 1: Form Entry Point & Placement

**Option A — Dual Entry Point: Dedicated Dispute Center Page + DTR Row Action (Recommended)**
- Employees can access a full "My Disputes" ticket history page under ESS, as well as a quick "File Dispute" button directly beside any flagged date on their Timesheet/DTR page.

| Pros | Cons |
|---|---|
| Maximum convenience: employee can click "Dispute This Day" directly on DTR. | Requires mounting entry points on both DTR view and sub-page. |
| Clear ticket status tracking for all past filings. | |

**Option B — Standalone Single Page Only**
- Dispute filing is only accessible from a separate "Attendance Disputes" menu item under ESS.

| Pros | Cons |
|---|---|
| Isolated code footprint. | Extra navigation steps for employee trying to dispute a specific DTR date. |

**Recommendation:** Option A. Direct entry from DTR row auto-fills the shift date and simplifies employee workflow.

---

### Decision 2: Dispute Categories & Issue Types

**Option A — Standardized Category Select + Details Text (Recommended)**
- Predefined issue types (`Uncredited Overtime`, `Disputed Absent Deduction`, `Missing Punch Appeal`, `Incorrect Shift / Rest Day`) with a required explanation text area and optional attachment upload.

| Pros | Cons |
|---|---|
| Categorized data maps 1:1 with HR Resolution Center filters. | Employees must choose the closest category. |
| Prevents vague/unclassified tickets. | |

**Option B — Free-Form Text Only**
- Open description box without issue type dropdown.

| Pros | Cons |
|---|---|
| Zero form restriction. | Makes HR filtering and reporting difficult. |

**Recommendation:** Option A. Aligns with existing `AttendanceDispute` schema (`issue_type`).

---

## 3. Database Schema (Reused)

Reuses existing **`attendance_disputes`** table created for the HR Resolution Center:

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | `bigint` (PK) | No | Auto-increment ID (formatted as `DIS-xxx` in UI) |
| `idacct` | `foreignId` | No | Employee Account ID (`accounts.id`) |
| `issue_type` | `string` | No | e.g. `Disputed Absent Deduction`, `Uncredited Overtime` |
| `date` | `date` | No | Target shift date being disputed |
| `description` | `text` | No | Employee explanation of the dispute |
| `status` | `string` | No | `Pending` (default), `Approved`, `Rejected`, `Info Requested` |
| `attachments` | `json` | Yes | Array of uploaded file objects `[{ name, url, mime }]` |
| `timeline` | `json` | Yes | Array of chat/activity logs `[{ sender, role, message, time }]` |
| `created_at` | `timestamp` | No | Filing timestamp |
| `updated_at` | `timestamp` | No | Last update timestamp |

---

## 4. Backend Architecture

### 4.1 Route Registrations (`routes/api/employee.php`)
```php
Route::prefix('employee')->group(function () {
    Route::get('/disputes', [TKDisputeController::class, 'index']);
    Route::post('/disputes', [TKDisputeController::class, 'store']);
    Route::get('/disputes/{id}', [TKDisputeController::class, 'show']);
    Route::post('/disputes/{id}/comments', [TKDisputeController::class, 'addComment']);
});
```

### 4.2 Query & Handler Classes
- **`App\Queries\Employee\GetMyDisputesQuery`**: Fetches paginated disputes for `Auth::id()` with status filtering.
- **`App\Handlers\Employee\SubmitAttendanceDisputeHandler`**:
  - Validates `issue_type`, `date`, `description`, and optional attachment uploads.
  - Creates `AttendanceDispute` record with default `status = 'Pending'`.
  - Initializes `timeline` JSON with initial employee message.
- **`App\Handlers\Employee\AddDisputeCommentHandler`**: Appends employee reply to `timeline` JSON array.

---

## 5. Frontend Architecture (`resources/views/web/src/module/employee/disputes/`)

### 5.1 TS Module Structure
```
disputes/
├── api/
│   └── disputes.api.ts
├── components/
│   ├── DisputeFilingModal.vue
│   ├── DisputeTicketCard.vue
│   └── DisputeTimelineDrawer.vue
├── composables/
│   └── useMyDisputes.ts
├── pages/
│   └── MyDisputes.vue
├── types/
│   └── types.disputes.ts
└── index.ts
```

### 5.2 Key Components & UI Specifications
- **`MyDisputes.vue`**: ESS page displaying KPI cards (Total Filed, Pending Review, Resolved Claims) and ticket list.
- **`DisputeFilingModal.vue`**: Dialog form to submit new claim (Date picker, Issue Type dropdown, Description textarea, Drag-and-Drop file uploader).
- **`DisputeTimelineDrawer.vue`**: Side panel showing real-time chat history between Employee and HR/Approver regarding the ticket.

---

## 6. Business Rules & Edge Cases

| Edge Case | Handling / Business Rule |
|---|---|
| Duplicate Dispute Filing | Prevent filing multiple open (`Pending`) disputes for the exact same `date` and `issue_type`. |
| Closed / Locked Cutoff | Disputing a date in a locked cutoff triggers a notice: "This cutoff is finalized; approved claims will be credited as backpay in the next payroll." |
| File Upload Limits | Max 3 attachments per ticket (PDF, PNG, JPG, max 5MB per file). |
| HR Approval Action | When HR sets dispute `status = 'Approved'`, HR's resolution handler automatically triggers an `app_adjustment` record if time correction is needed. |

---

## 7. Build Order

1. **Backend Route & Query/Handler (`Gate 2 ready`):**
   - Register routes in `routes/api/employee.php`.
   - Create `GetMyDisputesQuery`, `SubmitAttendanceDisputeHandler`, `AddDisputeCommentHandler`.
2. **Frontend Mockup Layout (`Gate 1`):**
   - Create `resources/views/web/src/module/employee/disputes/`.
   - Implement `MyDisputes.vue` and `DisputeFilingModal.vue` with hard-coded placeholder state.
3. **Live Data Integration (`Gate 2`):**
   - Connect `disputes.api.ts` to live endpoints.
   - Mount "Dispute This Day" quick trigger button on DTR/Timesheet view.

---

## 8. Out of Scope (Future Specs)
- In-app push notifications for employee when HR replies to a dispute ticket.
- Automated email notification to department manager on high-amount dispute filings.
