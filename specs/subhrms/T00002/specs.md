# Spec — Centralized HRMS Notification System

> **Ticket:** `T00002` (subhrms) — this file is `.agents/specs/subhrms/T00002/specs.md`; branch `T00002`.
> **Kind:** Greenfield / Centralized Infrastructure — Centralized real-time notification engine for SubHRMS across attendance, filings, approvals, HR lifecycle events, Timekeeping processing, Payroll processing, Payslip release, announcements, birthdays, and workplace messaging.
> **Portal:** **employee** & **global** (`/api/employee/notifications/...` & `/api/notifications/...` routes, `resources/views/mobapp/src/module/employee/notifications` and `resources/views/web/src/module/employee/notifications`).
> **Version:** v2 — 2026-10-02 — Expanded to include HR lifecycle events (Incident Reports, Disciplinary Actions, Movements, Events), Timekeeping processing alerts (Cutoff locks, Duty Roster publishing, Resolution disputes, Leave Conversion), and Payroll events (Payslip releases, 13th month, Loans, Retroactive Pay, Service Charges, Tax 2316).
> **Route:** `/(app)/notifications` (mobile screen) & `/api/employee/notifications` (API endpoints).
> **Conventions:** [project-profile.md](../../rules/project-profile.md), [hrms-rules.md](../../rules/hrms-rules.md), [laravel-standards.md](../../rules/laravel-standards.md).
> **System Awareness:** Models: `Notification` (created), `NotificationPreference` (created), `Account` (reused), `Conversation` (reused), `Announcement` (reused), `PayrollRunDetail` (reused), `PayPeriod` (reused), `AppLeave` (reused), `AppOvertime` (reused), `AppAdjustment` (reused), `AppChangeShift` (reused), `AppOfficialBusinessTrip` (reused), `IncidentReport` (reused), `DisciplinaryActionModel` (reused), `DutyRoster` / `RosterDraft` (reused), `LeaveConversionRequest` (reused); Tables: `notifications` (created), `notification_preferences` (created), `accounts` (reused); Routes: `routes/api/employee.php` (`api/employee/notifications/*`, created) & `routes/channels.php` (reused `user.{userId}`); New migration: yes (`notifications`, `notification_preferences`).

---

## 1. Purpose

Currently, notifications in the HRMS are fragmented or hardcoded into UI stubs (such as `notificationCount={3}` in `AppTopHeader.tsx`). While `T00001` established foundational WebSocket broadcasting infrastructure (Pusher/Reverb switching via `BroadcastAuthController` and per-user private channel `user.{userId}` in `routes/channels.php`), there is no centralized, persistent notification backend or unified inbox interface.

This specification establishes the **Centralized HRMS Notification System** for SubHRMS:
1. **Central Inbox & Activity Center**: A unified notification center on both Mobile (`resources/views/mobapp`) and Web (`resources/views/web`) displaying real-time events categorized into Attendance, Applications/Approvals, HR Lifecycle & Disciplinary Updates, Timekeeping Operations & Schedules, Payroll Processing & Released Payslips, Announcements, Birthdays, Messaging, and System alerts.
2. **Event-Driven Decoupled Architecture**: HRMS domain modules (HR, Timekeeping, Payroll, Attendance, Leave, Approvals, Messaging, Announcements) dispatch clean business events without managing notification UI or WebSocket sockets directly.
3. **Persist-Before-Broadcast Guarantees**: Every notification is safely persisted in MySQL within database transaction boundaries before emitting real-time Pusher/Reverb events over `private-user.{idacct}`.
4. **Active-Audience & Permission-Aware Resolution**: Automatic resolution of recipients based on dynamic organizational hierarchies, approver matrices, active employment status (filtering out resigned/inactive users for `@all` and `General` channel notifications), and targeted department/unit visibility.
5. **Smart De-duplication & Coalescing**: Built-in deduplication keys preventing multi-device echoes or queue replay duplicates, and intelligent coalescing for rapid burst events (e.g. multiple emoji reactions).
6. **Deep Linking**: Structured metadata payload enabling one-tap navigation directly to specific payslips, timekeeping schedules, leave requests, attendance logs, approval queues, announcement sheets, or conversation threads.

---

## 2. Design Decisions (Pros & Cons)

### Decision 1: Storage Architecture — SubHRMS-Native Structured Schema vs. Laravel Default Polymorphic Table

**Option A — SubHRMS-Native Structured Table (`notifications` with `idacct`, explicit columns & JSON `data`) (Recommended)**
- Uses standard SubHRMS conventions: `id` (bigint auto-increment), `idacct` (indexed integer matching `Account->id`), `type` (varchar e.g. `payroll.payslip_released`), `category` (varchar enum), `title`, `body`, `priority` (`low`, `normal`, `high`, `critical`), `actor_idacct`, `resource_type`, `resource_id`, `data` (json), `read_at` (timestamp null), `status` (tinyint `1=active`, `0=deleted`).
- No foreign key constraints (`->foreign()`), index only per SubHRMS standards.

| Pros | Cons |
|---|---|
| 100% compliant with SubHRMS standards (`idacct`, no foreign constraints, `status` soft delete). | Does not use Laravel's default `Illuminate\Notifications\DatabaseNotification` UUID schema out of the box. |
| Extremely fast indexing and querying for user-scoped lists, category filtering, unread counts, and priority sorting. | Requires custom Eloquent model and Query/Handler classes (standard in this repo). |
| Clean JSON payload support for deep-linking arguments and actor snapshot data. | None. |

**Option B — Laravel Default `notifications` Migration (`UUID` primary key, `notifiable_type`, `notifiable_id`, polymorphic text `data`)**
- Standard Laravel `php artisan notifications:table`.

| Pros | Cons |
|---|---|
| Uses built-in `$user->notifications()` relation. | Violates SubHRMS database standards (uses UUIDs instead of bigint IDs, foreign-like constraints, lacks structured category/priority columns). |
| Standard Laravel boilerplate. | Slow to filter by category or priority because all metadata is trapped in a generic JSON blob without column-level indexes. |

**Recommendation:** **Option A**. Follows SubHRMS database standards and provides high-performance filtering.

---

### Decision 2: Realtime Dispatch Strategy — Transaction-Committed Broadcast vs. Unchecked Broadcast

**Option A — `DB::afterCommit` Triggered Broadcast via `NotificationCreated` Event (Recommended)**
- Notification is inserted into the database. Upon successful transaction commit (`DB::afterCommit(...)`), the `NotificationCreated` event is dispatched implementing `ShouldBroadcastNow`.
- Client receives the WebSocket message only when the notification is guaranteed to exist in MySQL.

| Pros | Cons |
|---|---|
| Complete consistency: avoids race conditions where a mobile client receives a WebSocket event and immediately calls `GET /api/employee/notifications` before MySQL commits. | Slight delay of a few milliseconds until the enclosing DB transaction finishes. |
| Robust error handling: WebSocket broadcast failures (Pusher rate limit / network glitch) are caught in a `try/catch` and logged without rolling back critical HR transactions (e.g. Leave Approval or Payslip Release). | Requires wrapping dispatch in `DB::afterCommit` or firing after handler commit. |

**Option B — Direct Broadcast Inside Business Handlers Before DB Commit**
- Fires broadcast immediately when the business method is called.

| Pros | Cons |
|---|---|
| Minimal lines of code. | Severe race condition: client fetches notifications upon socket event and receives 404 or missing item because the DB transaction has not committed. |
| | If the DB transaction rolls back, phantom notifications were already sent to the user's phone. |

**Recommendation:** **Option A**. Mandatory "Persist-Before-Broadcast" pattern ensures total data integrity.

---

### Decision 3: Batch Notification Dispatch for Bulk Releases (e.g. Payslips, Announcements, Cutoff Reminders)

**Option A — Chunked Bulk Database Insert with Asynchronous Broadcast Queue (Recommended)**
- When releasing payslips for 1,000 employees in `ReleasePayslipsHandler`, notifications are inserted in chunks of 100 with timestamps and dedicated `dedup_key`.
- Real-time broadcasts are dispatched via queue workers or immediate broadcast chunks without tying up the HTTP request thread.

| Pros | Cons |
|---|---|
| High scalability: releases for thousands of employees complete within sub-second DB transactions. | Requires bulk insertion method in `CreateNotificationAction::executeMany(...)`. |
| Prevents memory exhaustion and HTTP timeouts during company-wide payroll closing. | None. |

**Option B — Iterative Loop Dispatched Synchronously Inside Controller**
- Loops over 1,000 records calling individual insert and WebSocket socket calls.

| Pros | Cons |
|---|---|
| Straightforward single-record reuse. | Extremely slow on bulk releases; risks HTTP 504 gateway timeout during payroll closing. |

**Recommendation:** **Option A**. Efficient batching keeps bulk payroll releases fast and resilient.

---

### Decision 4: Messaging Notification Coalescing & Suppression Strategy

**Option A — Context-Aware Suppression with Redis/Cache-Throttled Reaction Coalescing (Recommended)**
- **Active Chat Suppression**: If the recipient has an active WebSocket session in the specific conversation (`presence` or active channel state), in-app notification toasts are suppressed to avoid visual spam.
- **Reaction Coalescing**: Rapid reactions on the same message within a 3-minute window update a single notification record ("Jane Smith, Mark and 2 others reacted 👍 to your message") rather than inserting 4 separate rows.
- **Mention Prioritization**: Direct mentions (`@John Doe`) and group mentions (`@PayrollTeam`) always bypass suppression and deliver with high priority.

| Pros | Cons |
|---|---|
| Prevents notification fatigue and inbox flooding during active discussions. | Requires checking cache/session state and updating existing unread reaction notification if within window. |
| Clean, professional UX matching modern workplace platforms like Slack and Teams. | Small extra logic in `CreateNotificationAction`. |

**Option B — Raw Unthrottled Notifications for Every Single Action**
- Inserts a separate notification for every emoji reaction, message, and comment.

| Pros | Cons |
|---|---|
| Simpler code. | Quickly floods the database and user inbox with dozens of trivial reaction alerts. |

**Recommendation:** **Option A**. Delivers a refined, professional user experience without spam.

---

### Decision 5: Mobile App Real-Time Connection Architecture (`resources/views/mobapp`)

**Option A — Global App-Level Notification Provider & Hook (`useNotifications`) (Recommended)**
- A React Context / Hook instantiated in `resources/views/mobapp/src/contexts/NotificationContext.tsx` and exposed via `useNotifications()`.
- Subscribes to `private-user.${idacct}` upon login using the existing `Echo` instance (`resources/views/mobapp/src/services/realtime/echo.ts` or dynamically configured via `/api/broadcasting/config`).
- Maintains global unread count state in memory, updates `AppTopHeader` badge in real-time, displays native in-app banners/haptics for incoming high-priority alerts, and invalidates list queries seamlessly.

| Pros | Cons |
|---|---|
| Global availability: Unread badge in top navbar updates regardless of which tab the employee is currently viewing. | Requires establishing the subscription once at root auth layout. |
| Single persistent WebSocket listener: no redundant duplicate subscriptions across screens. | Must be cleaned up on logout. |

**Option B — Screen-Only Listener (Subscribed only when NotificationsScreen is open)**
- Listens to WebSocket events only while the notifications screen is mounted.

| Pros | Cons |
|---|---|
| Simple local component state. | Top navbar badge cannot update while the user is on Dashboard, Timesheet, or Profile. Defeats real-time notification requirement. |

**Recommendation:** **Option A**. Global context is required for live navbar badge and background socket updates.

---

## 2.5 Acceptance Criteria

| # | Given | When | Then |
|---|-------|------|------|
| **AC-1** | Authenticated employee `idacct=101` | An HR manager approves their leave application (`AppLeave` `id=45`) | `notifications` table has a new record with `idacct=101`, `type='leave.approved'`, `category='approval'`, `resource_type='leave'`, `resource_id=45`, `read_at=NULL`, and a real-time `NotificationCreated` event is broadcast on `private-user.101`. |
| **AC-2** | Authenticated employee `idacct=101` with 2 unread notifications | A new notification is generated for `idacct=101` | A `NotificationCountUpdated` event is broadcast with `unread_count=3`; Mobile app header badge immediately reflects `3` without manual refresh. |
| **AC-3** | Authenticated employee `idacct=101` viewing the mobile notification list | `GET /api/employee/notifications?page=1&per_page=20` is requested | Returns HTTP 200 with paginated notifications, latest first, containing `actor`, `resource`, `data`, `priority`, `category`, and `is_read=false/true`. |
| **AC-4** | Authenticated employee `idacct=101` with unread notification `id=500` | `POST /api/employee/notifications/500/read` is requested | Returns HTTP 200 with `{"success": true}`, sets `read_at=now()`, and broadcasts updated `unread_count` on `private-user.101`. |
| **AC-5** | Authenticated employee `idacct=101` with unread notification `id=500` belonging to employee `idacct=102` | `POST /api/employee/notifications/500/read` is requested | Returns HTTP 403 Forbidden with `{"message": "Unauthorized access to notification."}`, and `read_at` remains unchanged. |
| **AC-6** | Authenticated employee `idacct=101` with 5 unread notifications | `POST /api/employee/notifications/read-all` is requested | Returns HTTP 200 with `{"success": true, "marked_count": 5}`, all active notifications for `idacct=101` have `read_at` set, and `unread_count=0` is broadcast. |
| **AC-7** | Authenticated manager `idacct=202` | An employee submits an Overtime filing (`AppOvertime` `id=78`) requiring their approval | `notifications` table creates an item for `idacct=202` with `type='overtime.submitted'`, `category='approval'`, `priority='high'`, linking to `resource_type='overtime'`, `resource_id=78`. |
| **AC-8** | Inactive/resigned employee `idacct=303` (`status=0`) | An HR announcement is published for `@all` active employees | `idacct=303` is excluded from the resolved recipient list and receives no notification in database or broadcast. |
| **AC-9** | Scheduled daily birthday command `hrms:notify-birthdays` runs on `2026-10-02` | Employee `idacct=105` has birthday matching `10-02` | Generates a `birthday.today` notification for configured team members with `priority='low'`, preventing duplicate creation if already run on the same date. |
| **AC-10** | Employee receives a direct message mention `@John Doe` in a channel | Message is sent via `SendMessageHandler` | Generates a `message.mention` notification for John Doe with `category='mention'`, `priority='high'`, and `data.conversation_id` set for deep-linking. |
| **AC-11** | Payroll Officer closes and releases payslips in `ReleasePayslipsHandler` for Pay Period `id=12` | `ReleasePayslipsHandler::execute(['period_id' => 12])` runs | Generates a `payroll.payslip_released` notification for each employee in that run with `category='payroll'`, `priority='normal'`, `resource_type='payslip'`, `resource_id=$detail->id`, and links to the payslip detail view. |
| **AC-12** | Timekeeping supervisor locks period in `TimesheetProcessingController` | Timekeeping cutoff lock is engaged | Generates `timekeeping.period_locked` notification to employees in that unit reminding them of cutoff lock. |
| **AC-13** | Unit manager publishes a new shift roster in `DutyRosterController` | Schedule is set to published status | Generates `timekeeping.duty_roster_published` notification for all employees scheduled in that roster with `resource_type='duty_roster'`. |
| **AC-14** | HR issues a Disciplinary Action or Notice to Explain (NTE) to employee `idacct=101` | Record created in `DisciplinaryActionController` | Generates `hr.disciplinary_action` notification with `category='hr'`, `priority='critical'`, linking to the disciplinary action inquiry screen. |
| **AC-15** | HR files an Incident Report involving employee `idacct=101` | Incident report is submitted in `IncidentReportController` | Generates `hr.incident_report` notification with `category='hr'`, `priority='high'`, linking to `resource_type='incident_report'`. |
| **AC-16** | HR publishes an official Company Event in `ActivityorEventController` | Event is scheduled | Generates `hr.company_event` notification with `category='announcement'`, linking to `resource_type='company_event'`. |
| **AC-17** | Employee submits an attendance dispute in `ResolutionCenterController` | Dispute is resolved / status changed | Generates `timekeeping.dispute_resolved` notification to the filing employee with the updated resolution status. |
| **AC-18** | Year-end leave monetization is processed in `LeaveConversionController` | Leave conversion request is approved/credited | Generates `timekeeping.leave_conversion_processed` notification with total monetized days and net credit amount. |
| **AC-19** | Annual 13th Month Pay is processed and released in `ProcessYearEndHandler` | 13th month batch is released | Generates `payroll.13th_month_released` notification with `resource_type='13th_month_pay'`. |
| **AC-20** | Retroactive salary adjustment is computed in `ProcessPayrollHandler` | Payroll run with retro pay is released | Generates `payroll.retroactive_pay` notification detailing the retro differential amount added to their current payslip. |
| **AC-21** | Monthly Service Charge share is credited in `PayrollServiceChargeController` | Service charge distribution is finalized | Generates `payroll.service_charge_credited` notification detailing the distributed amount. |
| **AC-22** | Annual BIR Form 2316 tax certificate is generated in `BirTaxController` | Tax 2316 is published for employee review | Generates `payroll.tax_2316_available` notification with `resource_type='bir_2316'`. |
| **AC-23** | Mobile client taps a notification with `resource_type='payslip'` and `resource_id=980` | Tapping notification item on mobile UI | Automatically marks notification as read and navigates to `/(app)/payslip?id=980` or `/(app)/profile`. |
| **AC-24** | Mobile client taps a notification with `resource_type='duty_roster'` | Tapping notification item on mobile UI | Automatically marks notification as read and navigates to `/(app)/(tabs)/timekeeping`. |
| **AC-25** | Database transaction fails during leave approval or payroll closing | An exception is thrown during execution | No phantom notification record is created, and no WebSocket broadcast is emitted. |
| **AC-26** | WebSocket service (Pusher/Reverb) is temporarily offline | A leave approval or payslip release succeeds in MySQL | Operation completes successfully (HTTP 200), notification is safely saved in MySQL, broadcast failure is logged to Laravel log without failing the API response. |
| **AC-27** | Mobile app is offline during notification creation | Mobile app reconnects to the network | Fetches `GET /api/employee/notifications/count` and `GET /api/employee/notifications`, restoring accurate unread count and full notification history. |

---

## 3. Database

### 3.1 New Tables

#### Table: `notifications`
Stores all in-app notifications across all modules. Adheres strictly to SubHRMS conventions (indexed integer account IDs, `idacct`, `status` soft delete, no foreign key constraints).

```sql
CREATE TABLE `notifications` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `idacct` INT UNSIGNED NOT NULL COMMENT 'Recipient account ID (Account.id)',
  `type` VARCHAR(80) NOT NULL COMMENT 'Stable event type, e.g. payroll.payslip_released, leave.approved, attendance.time_in, hr.disciplinary_action',
  `category` VARCHAR(40) NOT NULL COMMENT 'attendance, leave, overtime, official_business, change_shift, attendance_adjustment, approval, hr, timekeeping, payroll, announcement, birthday, message, mention, system',
  `title` VARCHAR(255) NOT NULL COMMENT 'Notification headline',
  `body` TEXT NOT NULL COMMENT 'Notification text/preview',
  `priority` VARCHAR(20) NOT NULL DEFAULT 'normal' COMMENT 'low, normal, high, critical',
  `actor_idacct` INT UNSIGNED NULL COMMENT 'Account ID of the person who triggered the event (null if system)',
  `resource_type` VARCHAR(60) NULL COMMENT 'leave, overtime, attendance, payslip, duty_roster, incident_report, disciplinary_action, conversation, announcement, etc.',
  `resource_id` BIGINT UNSIGNED NULL COMMENT 'ID of the related entity',
  `data` JSON NULL COMMENT 'Structured payload for deep linking and extra context',
  `dedup_key` VARCHAR(120) NULL COMMENT 'Unique key preventing duplicates within time windows',
  `read_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'When the notification was marked as read',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '1 = active, 0 = deleted',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_notifications_idacct_status_read` (`idacct`, `status`, `read_at`),
  INDEX `idx_notifications_category` (`category`),
  INDEX `idx_notifications_type` (`type`),
  INDEX `idx_notifications_created_at` (`created_at`),
  INDEX `idx_notifications_dedup` (`dedup_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### Table: `notification_preferences`
Stores user notification delivery preferences (in-app, push, email).

```sql
CREATE TABLE `notification_preferences` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `idacct` INT UNSIGNED NOT NULL COMMENT 'Account ID (Account.id)',
  `category` VARCHAR(40) NOT NULL COMMENT 'attendance, hr, timekeeping, payroll, leave, approvals, announcements, messages, birthdays, all',
  `channel_in_app` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 = enabled, 0 = disabled',
  `channel_push` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 = enabled, 0 = disabled',
  `channel_email` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = enabled, 0 = disabled',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_account_category` (`idacct`, `category`),
  INDEX `idx_notif_pref_account` (`idacct`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 4. Backend

### 4.1 Models (`app/Models/`)

1. **`App\Models\Notification`**:
   - `$table = 'notifications'`
   - `$fillable = ['idacct', 'type', 'category', 'title', 'body', 'priority', 'actor_idacct', 'resource_type', 'resource_id', 'data', 'dedup_key', 'read_at', 'status']`
   - `$casts = ['id' => 'integer', 'idacct' => 'integer', 'actor_idacct' => 'integer', 'resource_id' => 'integer', 'data' => 'array', 'read_at' => 'datetime', 'status' => 'integer']`
   - Scope: `scopeActive($query)` -> `where('status', 1)`
   - Scope: `scopeUnread($query)` -> `whereNull('read_at')`
   - Relation: `actor()` -> `belongsTo(Account::class, 'actor_idacct', 'id')`
   - Relation: `recipient()` -> `belongsTo(Account::class, 'idacct', 'id')`

2. **`App\Models\NotificationPreference`**:
   - `$table = 'notification_preferences'`
   - `$fillable = ['idacct', 'category', 'channel_in_app', 'channel_push', 'channel_email']`
   - `$casts = ['idacct' => 'integer', 'channel_in_app' => 'boolean', 'channel_push' => 'boolean', 'channel_email' => 'boolean']`

### 4.2 Actions & Services (`app/Actions/Notifications/`)

1. **`CreateNotificationAction`** (`app/Actions/Notifications/CreateNotificationAction.php`):
   - Signature: `public static function execute(int $idacct, string $type, string $category, string $title, string $body, array $options = []): ?Notification`
   - Validates user preferences (`notification_preferences` check for `channel_in_app`).
   - Validates `dedup_key` within time window (prevents duplicate triggers).
   - Inserts into `notifications`.
   - Uses `DB::afterCommit(...)` to dispatch `NotificationCreated` and `NotificationCountUpdated` events to ensure transaction consistency.
   - Catches socket errors gracefully in `try/catch` to avoid failing caller transactions.

2. **`CreateBatchNotificationsAction`** (`app/Actions/Notifications/CreateBatchNotificationsAction.php`):
   - Signature: `public static function execute(array $recipients, string $type, string $category, string $title, string $body, array $options = []): int`
   - Bulk inserts in chunks of 100 for high-volume broadcasts (e.g. `ReleasePayslipsHandler`, `AnnouncementController`, `DutyRosterController`).
   - Dispatches per-user unread badge update broadcasts after transaction commit.

3. **`BroadcastNotificationAction`** (`app/Actions/Notifications/BroadcastNotificationAction.php`):
   - Emits `App\Events\Notifications\NotificationCreated` and `App\Events\Notifications\NotificationCountUpdated` on `new PrivateChannel("user.{$idacct}")`.

4. **`ResolveNotificationRecipientsAction`** (`app/Actions/Notifications/ResolveNotificationRecipientsAction.php`):
   - Resolves target recipients based on active employment status (`status = 1`), department IDs, unit IDs, position IDs, and hierarchical approval matrices (`ApproverMatrix` / `ApproverList`).

### 4.3 Queries & Handlers (`app/Queries/Notifications/` & `app/Handlers/Notifications/`)

1. **`GetNotificationsQuery`** (`app/Queries/Notifications/GetNotificationsQuery.php`):
   - Fetches paginated notifications for `$user->id`.
   - Supports filters: `unread_only` (bool), `category` (string, e.g. `payroll`, `hr`, `timekeeping`, `approval`, `announcement`, `messages`).
   - Formats relative time, actor avatar/name, category badge tokens, and deep-link payload.

2. **`GetNotificationCountQuery`** (`app/Queries/Notifications/GetNotificationCountQuery.php`):
   - Computes total unread count: `Notification::active()->where('idacct', $user->id)->unread()->count()`.

3. **`MarkNotificationReadHandler`** (`app/Handlers/Notifications/MarkNotificationReadHandler.php`):
   - Marks a single notification as read: `where('id', $id)->where('idacct', $user->id)->update(['read_at' => now()])`.
   - Dispatches `NotificationCountUpdated` broadcast.

4. **`MarkAllNotificationsReadHandler`** (`app/Handlers/Notifications/MarkAllNotificationsReadHandler.php`):
   - Marks all active unread notifications for `$user->id` as read.
   - Dispatches `NotificationCountUpdated` with `unread_count = 0`.

5. **`DeleteNotificationHandler`** (`app/Handlers/Notifications/DeleteNotificationHandler.php`):
   - Soft-deletes a notification (`status = 0`).

### 4.4 Real-Time Events (`app/Events/Notifications/`)

1. **`NotificationCreated`** (`app/Events/Notifications/NotificationCreated.php`):
   - Implements `ShouldBroadcastNow`.
   - Channel: `PrivateChannel("user.{$idacct}")`.
   - Broadcast Name: `NotificationCreated`.
   - Payload:
     ```json
     {
       "id": 12345,
       "type": "payroll.payslip_released",
       "category": "payroll",
       "title": "Payslip Released",
       "body": "Your payslip for Oct 01 - Oct 15, 2026 is now available.",
       "priority": "normal",
       "actor": {
         "id": 1,
         "name": "Payroll Department",
         "avatar_url": null
       },
       "resource": {
         "type": "payslip",
         "id": 980
       },
       "data": {
         "pay_period_id": 12,
         "pay_period_name": "Oct 01 - Oct 15, 2026",
         "cycle": "regular",
         "net_pay": 24500.00
       },
       "read_at": null,
       "created_at": "2026-10-02T09:30:00+08:00"
     }
     ```

2. **`NotificationCountUpdated`** (`app/Events/Notifications/NotificationCountUpdated.php`):
   - Implements `ShouldBroadcastNow`.
   - Channel: `PrivateChannel("user.{$idacct}")`.
   - Broadcast Name: `NotificationCountUpdated`.
   - Payload:
     ```json
     {
       "unread_count": 5
     }
     ```

### 4.5 Controllers & Routes

#### Controller: `app/Http/Controllers/employee/NotificationsController.php`
- `index(Request $request)` -> returns `response()->json(GetNotificationsQuery::execute($request))`
- `count(Request $request)` -> returns `response()->json(GetNotificationCountQuery::execute($request))`
- `markAsRead(Request $request, int $id)` -> returns `response()->json(MarkNotificationReadHandler::execute($request, $id))`
- `markAllAsRead(Request $request)` -> returns `response()->json(MarkAllNotificationsReadHandler::execute($request))`
- `destroy(Request $request, int $id)` -> returns `response()->json(DeleteNotificationHandler::execute($request, $id))`

#### Route Registration in `routes/api/employee.php`:
```php
// Notifications Management
Route::prefix('notifications')->group(function () {
    Route::get('/', [NotificationsController::class, 'index']);
    Route::get('/count', [NotificationsController::class, 'count']);
    Route::post('/read-all', [NotificationsController::class, 'markAllAsRead']);
    Route::post('/{id}/read', [NotificationsController::class, 'markAsRead']);
    Route::delete('/{id}', [NotificationsController::class, 'destroy']);
});
```

---

## 5. Domain Event Inventory & Notification Catalog

The following is the exhaustive catalog of system events that trigger centralized notifications:

### 5.1 Payroll Events (`category: 'payroll'`)
| Event Type | Trigger Origin | Title | Body Example | Priority | Resource Type | Deep Link Route |
|---|---|---|---|---|---|---|
| `payroll.payslip_released` | `ReleasePayslipsHandler` | Payslip Released | "Your payslip for period Oct 01 - Oct 15, 2026 is now available." | `normal` | `payslip` | `/(app)/payslip?id={id}` |
| `payroll.13th_month_released` | `ProcessYearEndHandler` | 13th Month Pay Available | "Your 13th month pay computation has been released." | `normal` | `13th_month_pay` | `/(app)/payslip?type=13th_month` |
| `payroll.retroactive_pay` | `ProcessPayrollHandler` | Retroactive Pay Credited | "A retroactive salary differential has been added to your payroll." | `normal` | `payslip` | `/(app)/payslip?id={id}` |
| `payroll.service_charge_credited` | `PayrollServiceChargeController` | Service Charge Credited | "Your monthly service charge share (₱3,250.00) has been credited." | `normal` | `payslip` | `/(app)/payslip?id={id}` |
| `payroll.loan_deduction_notice` | `PayrollEntriesController` | Loan Deduction Applied | "SSS Salary Loan deduction of ₱1,200.00 applied to current payroll." | `low` | `loan` | `/(app)/profile` |
| `payroll.tax_2316_available` | `BirTaxController` | BIR Form 2316 Ready | "Your annual Certificate of Compensation Payment/Tax Withheld (Form 2316) is ready." | `normal` | `bir_2316` | `/(app)/profile` |

### 5.2 Timekeeping & Duty Roster Events (`category: 'timekeeping'`)
| Event Type | Trigger Origin | Title | Body Example | Priority | Resource Type | Deep Link Route |
|---|---|---|---|---|---|---|
| `timekeeping.cutoff_reminder` | Cron / TK Scheduler | Cutoff Approaching | "Timekeeping cutoff closes today at 5:00 PM. Please file all pending requests." | `high` | `timekeeping` | `/(app)/apply` |
| `timekeeping.period_locked` | `TimesheetProcessingController` | Cutoff Period Locked | "Timekeeping period Oct 01 - Oct 15 has been locked for payroll processing." | `normal` | `timekeeping` | `/(app)/(tabs)/timekeeping` |
| `timekeeping.duty_roster_published` | `DutyRosterController` | Schedule Published | "A new duty roster has been published for your unit (Oct 16 - Oct 31)." | `normal` | `duty_roster` | `/(app)/(tabs)/timekeeping` |
| `timekeeping.dispute_resolved` | `ResolutionCenterController` | Attendance Dispute Resolved | "Your attendance dispute for Sept 28 has been resolved by Manager Jane." | `normal` | `attendance_dispute` | `/(app)/requests` |
| `timekeeping.leave_conversion_processed` | `LeaveConversionController` | Leave Credits Monetized | "Your leave conversion request for 5.0 SL days has been approved." | `normal` | `leave_conversion` | `/(app)/requests` |

### 5.3 HR & Employee Lifecycle Events (`category: 'hr'`)
| Event Type | Trigger Origin | Title | Body Example | Priority | Resource Type | Deep Link Route |
|---|---|---|---|---|---|---|
| `hr.incident_report` | `IncidentReportController` | Incident Report Notice | "You have been tagged in Incident Report #IR-2026-012." | `high` | `incident_report` | `/(app)/requests` |
| `hr.disciplinary_action` | `DisciplinaryActionController` | Official HR Notice | "A Notice to Explain (NTE) has been issued for your acknowledgment." | `critical` | `disciplinary_action` | `/(app)/requests` |
| `hr.company_event` | `ActivityorEventController` | Company Activity | "Upcoming Event: Annual Company Townhall on October 25." | `low` | `company_event` | `/(app)/announcements` |
| `hr.emp_movement` | `EmpMovementController` | Employment Status Update | "Congratulations! Your employment status has been updated to Regular." | `high` | `profile` | `/(app)/(tabs)/profile` |
| `hr.separation_milestone` | `EmployeeSeparationController` | Clearance Milestone | "IT Department has signed off on your clearance checklist." | `normal` | `clearance` | `/(app)/requests` |

### 5.4 Attendance & Filings (`categories: 'attendance', 'leave', 'overtime', 'approval'`)
| Event Type | Trigger Origin | Title | Body Example | Priority | Resource Type | Deep Link Route |
|---|---|---|---|---|---|---|
| `attendance.time_in` | `AttendanceController::record` | Timed In | "You successfully timed in at 8:02 AM." | `low` | `attendance` | `/(app)/time-in-out` |
| `attendance.time_out` | `AttendanceController::record` | Timed Out | "You successfully timed out at 5:31 PM." | `low` | `attendance` | `/(app)/time-in-out` |
| `leave.submitted` | `AppLeave` filing | Leave Request Submitted | "Your leave request for Oct 10 has been submitted for approval." | `normal` | `leave` | `/(app)/requests` |
| `leave.approved` | `AppLeave` approval | Leave Approved | "Your leave request for Oct 10 has been approved by Jane Smith." | `normal` | `leave` | `/(app)/requests` |
| `leave.rejected` | `AppLeave` rejection | Leave Request Rejected | "Your leave request for Oct 10 was rejected by Jane Smith." | `high` | `leave` | `/(app)/requests` |
| `approval.pending` | Application submissions | Pending Approval | "John Doe submitted a leave request that requires your approval." | `high` | `approval` | `/(app)/requests?filter=pending` |

### 5.5 Announcements, Birthdays & Messaging (`categories: 'announcement', 'birthday', 'message', 'mention'`)
| Event Type | Trigger Origin | Title | Body Example | Priority | Resource Type | Deep Link Route |
|---|---|---|---|---|---|---|
| `announcement.created` | `AnnouncementController` | New Announcement | "HR published a new announcement: Holiday Operations Schedule." | `normal` | `announcement` | `/(app)/announcements` |
| `birthday.today` | Daily cron `hrms:notify-birthdays` | Birthday Greeting | "Today is John Doe's birthday! 🎉" | `low` | `birthday` | `/(app)/(tabs)/messages` |
| `message.received` | `SendMessageHandler` | Direct Message | "Jane Smith sent you a message." | `normal` | `conversation` | `/(app)/conversation?id={id}` |
| `message.mention` | `ResolveMentionsAction` | Mentioned in Chat | "Jane Smith mentioned you in #general." | `high` | `conversation` | `/(app)/conversation?id={id}` |

---

## 6. Frontend (`resources/views/mobapp`)

### 6.1 Module Structure

```text
resources/views/mobapp/src/module/employee/notifications/
├── api/
│   └── notifications.api.ts
├── components/
│   ├── NotificationItem.tsx
│   ├── NotificationCategoryTabs.tsx
│   ├── NotificationEmptyState.tsx
│   └── NotificationHeaderActions.tsx
├── hooks/
│   └── useNotifications.ts
├── pages/
│   └── NotificationsScreen.tsx
├── types/
│   └── types.notifications.ts
└── index.ts
```

### 6.2 TypeScript Contracts (`types.notifications.ts`)

```typescript
export type NotificationPriority = 'low' | 'normal' | 'high' | 'critical';

export type NotificationCategory =
  | 'attendance'
  | 'leave'
  | 'overtime'
  | 'official_business'
  | 'change_shift'
  | 'attendance_adjustment'
  | 'approval'
  | 'rejection'
  | 'status_update'
  | 'hr'
  | 'timekeeping'
  | 'payroll'
  | 'announcement'
  | 'birthday'
  | 'message'
  | 'mention'
  | 'system';

export interface NotificationActor {
  id: number;
  name: string;
  avatar_url?: string | null;
}

export interface NotificationResource {
  type: string;
  id: number;
}

export interface AppNotification {
  id: number;
  idacct: number;
  type: string;
  category: NotificationCategory;
  title: string;
  body: string;
  priority: NotificationPriority;
  actor?: NotificationActor | null;
  resource?: NotificationResource | null;
  data?: Record<string, any> | null;
  read_at: string | null;
  is_read: boolean;
  created_at: string;
  time_ago: string;
}

export interface NotificationListResponse {
  data: AppNotification[];
  current_page: number;
  last_page: number;
  total: number;
  unread_count: number;
}
```

### 6.3 Mobile Screen Layout & Interactions (`NotificationsScreen.tsx`)

1. **Header**:
   - Title: `Notifications`
   - Unread Count Pill: `🔔 4 unread`
   - Action: `Mark all as read` button
2. **Filter Tabs**:
   - `All` | `Unread` | `Payroll & Payslips` | `Approvals` | `Timekeeping` | `HR & Announcements` | `Messages`
3. **Item Visuals (`NotificationItem.tsx`)**:
   - Category-specific icons:
     - `payroll`: Banknote / Wallet icon with green theme accent.
     - `timekeeping` / `attendance`: Clock / Calendar icon with cyan/blue accent.
     - `hr`: Shield / Award / UserCheck icon with purple/indigo accent.
     - `approval`: CheckCircle / AlertCircle icon with amber accent.
     - `announcement`: Megaphone icon with orange accent.
     - `birthday`: PartyPopper icon with festive gold accent.
     - `message` / `mention`: MessageSquare / AtSign icon with blue accent.
   - Unread dot on left edge.
   - Priority accent border for `critical` (red/amber).
   - Relative time format (`5m ago`, `2h ago`, `Yesterday`).
   - Swipe actions: swipe right to toggle read state; swipe left to delete.
4. **Deep-Link Navigator**:
   - Tapping an item triggers `notifications.api.markAsRead(item.id)` and immediately resolves route:
     - `payslip` -> `router.push('/(app)/payslip?id=' + item.resource.id)`
     - `duty_roster` / `timekeeping` -> `router.push('/(app)/(tabs)/timekeeping')`
     - `leave` / `overtime` / `requests` -> `router.push('/(app)/requests?id=' + item.resource.id)`
     - `conversation` -> `router.push('/(app)/conversation?id=' + item.data.conversation_id)`
     - `announcement` -> Opens announcement modal.

---

## 7. Business Rules & Edge Cases

### 7.1 Non-Functional & Failure-Mode Checklist

| Category | Specification Response |
|---|---|
| **Authorization** | Every notification endpoint is protected by `auth:sanctum`. A user can only fetch, read, or delete notifications where `idacct === auth()->user()->id`. Accessing another user's notification ID returns HTTP 403 Forbidden `{"message": "Unauthorized access to notification."}`. |
| **Concurrency / double-submit** | Tapping "Mark as read" or "Mark all as read" multiple times concurrently is idempotent (`UPDATE notifications SET read_at = now() WHERE read_at IS NULL`). UI disables buttons while request is in-flight. |
| **Idempotency on retries** | `dedup_key` column on `notifications` table prevents duplicate insertion for identical business events re-dispatched via queue retries within short time windows (e.g. `payslip_{pay_period_id}_{idacct}`). |
| **Error response shape & status codes** | Unauthenticated: HTTP 401 `{"message": "Unauthenticated."}`. Validation error: HTTP 422 `{"message": "The given data was invalid.", "errors": {...}}`. Forbidden: HTTP 403 `{"message": "Unauthorized access to notification."}`. Not Found: HTTP 404 `{"message": "Notification not found."}`. Server error: HTTP 500 `{"message": "Failed to process notification."}`. Raw API responses via `response()->json(...)`. |
| **Input validation boundaries** | Query parameters for list pagination: `per_page` integer between 1 and 100 (default 20). `page` integer >= 1. `category` string validated against valid category list or rejected with 422. Path parameter `id` validated as positive unsigned integer. |

---

## 8. Build Order

1. **Database Migration**:
   - Create `database/migrations/2026_10_02_000001_create_notifications_and_preferences_tables.php`.
   - Run migration in container.
2. **Backend Models & Events**:
   - Create `app/Models/Notification.php` and `app/Models/NotificationPreference.php`.
   - Create `app/Events/Notifications/NotificationCreated.php` and `app/Events/Notifications/NotificationCountUpdated.php`.
3. **Backend Actions, Queries & Handlers**:
   - Create `app/Actions/Notifications/CreateNotificationAction.php`, `CreateBatchNotificationsAction.php`, and `BroadcastNotificationAction.php`.
   - Create `app/Queries/Notifications/GetNotificationsQuery.php` and `GetNotificationCountQuery.php`.
   - Create `app/Handlers/Notifications/MarkNotificationReadHandler.php`, `MarkAllNotificationsReadHandler.php`, and `DeleteNotificationHandler.php`.
4. **Backend Controller & Routes**:
   - Create `app/Http/Controllers/employee/NotificationsController.php`.
   - Register endpoints in `routes/api/employee.php`.
5. **Domain Event Wiring**:
   - **Payroll**: Hook into `ReleasePayslipsHandler.php` (payslip release), `ProcessYearEndHandler.php` (13th month), `PayrollServiceChargeController.php`, `BirTaxController.php`.
   - **Timekeeping**: Hook into `TimesheetProcessingController.php` (cutoff lock), `DutyRosterController.php` (roster publish), `ResolutionCenterController.php` (dispute resolutions), `LeaveConversionController.php`.
   - **HR**: Hook into `IncidentReportController.php`, `DisciplinaryActionController.php`, `ActivityorEventController.php`, `EmpMovementController.php`.
   - **Attendance & Filings**: Hook into `AttendanceController.php`, `AppLeave` / `AppOvertime` / `AppAdjustment` approval handlers.
   - **Messaging**: Hook into `SendMessageHandler.php` and `ResolveMentionsAction.php`.
   - **Birthdays**: Create scheduled command `app/Console/Commands/NotifyBirthdaysCommand.php`.
6. **Frontend Mobile Implementation (`resources/views/mobapp`) - Gate 1 (Design-First)**:
   - Create TypeScript types in `src/module/employee/notifications/types/types.notifications.ts`.
   - Build `NotificationItem.tsx`, `NotificationCategoryTabs.tsx`, `NotificationEmptyState.tsx`, and `NotificationsScreen.tsx` with mock data.
   - Create route file `src/app/(app)/notifications.tsx`.
   - Connect `AppTopHeader.tsx` bell press to `router.push('/(app)/notifications')`.
7. **Frontend Mobile Wiring - Gate 2 (Live API & Realtime Echo)**:
   - Create `src/module/employee/notifications/api/notifications.api.ts`.
   - Create `useNotifications.ts` hook integrating live REST endpoints and `Echo.private('user.' + user.id)`.
   - Verify unread count badge and live notification feed updates.

---

## 9. Out of Scope (Future Specs)

- External OS Push Notifications (FCM / APNs via Expo Push Server) — backend `notification_preferences` table is designed to support this cleanly in subsequent phase.
- Granular email notification digest delivery.
- Complex notification analytics dashboard for HR admins.

---

## 10. Definition of Done

- [ ] Every row in the **Acceptance Criteria** table passes (`AC-1` … `AC-27`).
- [ ] Every category in the **Non-Functional & Failure-Mode Checklist** is addressed and verified.
- [ ] `notifications` and `notification_preferences` tables created following SubHRMS database standards (`idacct`, no foreign key constraints, `status` soft delete).
- [ ] Real-time WebSocket broadcasting verified on `private-user.{idacct}` channel for both Pusher and Reverb connections.
- [ ] Mobile app notification center screen (`/(app)/notifications`) implemented with full deep-linking support for Payslips, Attendance, Requests, HR Memos, and Messaging.
- [ ] Dynamic unread badge in mobile header (`AppTopHeader.tsx`) reflects live unread count.
- [ ] No open findings from adversarial verification (`verify.md`).
- [ ] No open `CRITICAL`/`HIGH` findings from diff review (`code-review.md`).

<!-- Changelog -->
- v1 — 2026-10-02 — initial complete specification grounded in SubHRMS architecture and T00001 real-time inspection.
