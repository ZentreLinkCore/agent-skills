# Feature Specification — Centralized HRMS Notification Center and Settings

## Metadata

| Field | Value |
| --- | --- |
| Project Name | SubHRMS |
| Ticket Number | T00002 |
| Feature Name | Centralized HRMS Notification Center and Settings |
| Created Date | 2026-10-14 |
| Specification Version | 2.1 |
| Status | In Review |

---

## 1. Overview

- **What is being built:** A centralized, multi-channel notification engine, unified notification inbox, and comprehensive notification settings interface for SubHRMS across all user roles and portals (Employee, Manager, HR, Timekeeping, Payroll, and Admin), unifying in-app notifications, WebSocket real-time alerts, push notifications, and scheduled reminders with unified UX concepts across Web and Mobile.
- **Problem it solves:** SubHRMS notification handling is fragmented: UI headers display hardcoded static mocks (`notifications` mock array in `HeaderBarComponets.vue` and `notificationCount={3}` in `AppTopHeader.tsx`), domain modules (Leaves, Overtime, Timekeeping, Payroll, HR lifecycle) perform backend writes without dispatching unified user alerts, approvers miss time-sensitive filings, and users have zero control over notification channels or reminder preferences. Furthermore, payroll processing completion is conflated with payslip availability, missing attendance alerts lack schedule awareness, and chat muting risks accidentally silencing critical compliance notices.
- **Why this feature exists:** Employees, managers, timekeepers, HR staff, and payroll officers need immediate, role-aware visibility into actionable requests, filing deadlines, payroll releases, attendance discrepancies, disciplinary notices, and company updates, backed by an authoritative in-app inbox, schedule-aware reminder engines, and configurable user preferences that preserve statutory compliance delivery.

---

## 2. Objective

### Main Goals

1. **Centralized Notification Engine**: Implement an event-driven notification dispatch pipeline (`App\Actions\Notifications\CreateNotificationAction`, `CreateBatchNotificationsAction`) adhering to the SubHRMS "persist-before-broadcast" pattern, ensuring notifications are safely committed to MySQL before emitting real-time WebSocket events.
2. **Unified Notification Center (Web & Mobile Parity)**: Deliver a conceptually identical in-app notification center across Web (`resources/views/web`) and Mobile (`resources/views/mobapp`) sharing the same design language, category tabs, priority indicators, relative timestamps, dismissal gestures, and one-tap deep-linking navigation.
3. **Comprehensive Notification Settings & Mandatory Compliance Guard**: Implement user-configurable notification preferences allowing fine-grained toggling of delivery channels (In-App, Push, Email) across functional categories, while strictly enforcing mandatory delivery for statutory notices (Disciplinary Actions, NTEs, Incident Reports), ensuring workplace chat muting never suppresses critical HR or operational alerts.
4. **Intelligent Attendance & Filing Eligibility Engine**: Deploy scheduled reminder commands (`hrms:check-missing-attendance`, `hrms:notify-filing-deadlines`, `hrms:notify-birthdays-anniversaries`, `hrms:notify-pending-approvals`) that rigorously evaluate employee shift schedules, approved leaves, holidays, rest days, official business trips, and grace periods before emitting alerts.
5. **Decoupled Payroll Lifecycle & Role-Grounded Delivery**: Strictly decouple internal payroll processing completion notifications (sent exclusively to Payroll/HR staff) from employee payslip release notifications (sent to individual employees only when payslips are released), enforcing active employment status (`status = 1`) and permission-scoped recipient routing across all 6 portals.

### Expected Outcome

Users log into any portal on Web or Mobile and immediately see their live unread notification count. Tapping the bell icon opens a consolidated inbox where notifications are grouped by category (Applications & Approvals, Attendance & Timekeeping, Payroll & Compensation, Announcements, HR Notices, Messages, and System Alerts) with identical card anatomy, color accents, and priority visual hierarchy on both Web and Mobile. Users can mark individual items or all items as read, dismiss alerts, or tap an item to navigate directly to the relevant payslip, request approval screen, attendance dispute, or conversation. In Settings, users customize notification channels and reminder lead times according to their preferences without compromising mandatory alerts.

### Success Criteria

| ID | Criterion | Target | Measured By |
| --- | --- | --- | --- |
| SC-01 | Unread badge accuracy | 100% synchronization | Automated feature test comparing `Notification::where('idacct', $id)->unread()->count()` with WebSocket payload and API response |
| SC-02 | Persist-before-broadcast guarantee | 0 phantom broadcasts | Automated test verifying that DB transaction rollbacks emit zero WebSocket messages |
| SC-03 | Bulk dispatch performance | < 1,500 ms for 1,000 employees | Benchmark test executing `CreateBatchNotificationsAction::execute()` for company-wide payslip release |
| SC-04 | Attendance reminder eligibility precision | 0 false-positive reminders | Automated test verifying that employees on approved leave, holidays, rest days, or official business trips receive no missing attendance alerts |
| SC-05 | Mandatory notification enforcement | 0 suppressed compliance notices | Automated test asserting that disabling all preference toggles cannot suppress `hr.disciplinary_action` or `hr.incident_report` |
| SC-06 | Endpoint response latency | p95 < 250 ms | Benchmark of `GET /api/notifications` with 20,000 historical rows |
| SC-07 | Web and Mobile Concept Parity | 100% feature & visual parity | Verification that Web and Mobile share identical category filters, card tokens, status pills, and settings matrix |

---

## 3. Background and Motivation

### System Audit & Existing Implementation Discovery

Inspection of the SubHRMS codebase reveals the current baseline across frontend, backend, database, and domain events:

1. **Frontend Notification Discovery**:
   - Web: `resources/views/web/src/components/custom/Navbar/HeaderBarComponets.vue` lines 287–291 hardcodes `notifications = ref([{ id: 1, title: 'Leave Request', ... }])` and computes `unreadCount` purely from local memory. "View all notifications" links to `href="#"`.
   - Mobile: `resources/views/mobapp/src/components/AppTopHeader.tsx` renders a static `notificationCount={3}` bell button with no backend binding or notification screen.
2. **Broadcasting & Real-Time Discovery (T00001)**:
   - `routes/channels.php` registers `user.{userId}` on both `pusher` and `reverb` connections, authorized via Sanctum `(int) $user->id === (int) $userId`.
   - `BroadcastAuthController.php` provides dynamic connection configuration (`/api/broadcasting/config`).
   - Web (`resources/views/web/src/app/echo.ts`) and Mobile (`resources/views/mobapp/src/services/realtime/echo.ts`) have working Laravel Echo instances listening to messaging events, but no notification channel listeners exist.
3. **Database & Schema Discovery**:
   - Zero notification tables exist in `database/migrations/`.
   - `Account.php` includes `use Illuminate\Notifications\Notifiable;`, but Laravel's default polymorphic database notification table is absent.
4. **Domain Event Discovery**:
   - `ReleasePayslipsHandler.php` updates `payroll_run_details.released_at` but dispatches no notification.
   - `AttendanceController.php` records biometric and web time-in/out without notifying users.
   - `ApproverMatrix.php` and `IsCurrentApproverAction.php` define the multi-tier approval hierarchy, but approvals and submissions emit no alerts to applicants or approvers.
   - `Announcement.php` stores announcements, read tracking exists in `announcement_reads`, but authors cannot notify target employee audiences.

### Current Limitations & Gap Analysis

| HRMS Module | Existing Implementation | Discovered Gap / Missing Requirement | Required System Recommendation |
| --- | --- | --- | --- |
| **Employee Applications** (`AppLeave`, `AppOvertime`, `AppAdjustment`, `AppChangeShift`, `AppOfficialBusinessTrip`) | Handlers insert application rows with approver tier matrices in `approvers` JSON. | Applicants receive no confirmation or approval/rejection notice. Approvers are never alerted when their tier becomes active. | Implement approval chain event notifications routing to current active tier approver and applicant upon decision. |
| **Attendance & Timelogs** (`timelogs`, `timesheet`) | Timelogs captured via biometric sync or web portal. | No alerts for missing time-in or time-out. No reminders when incomplete logs prevent cutoff closing. | Implement schedule-aware missing time-in/out engine verifying shift, rest days, holidays, leaves, and OBT before alerting. |
| **Payroll Processing vs. Payslip Release** (`payroll_period`, `PayrollRun`, `PayrollRunDetail`, `ReleasePayslipsHandler`) | `PayPeriod` tracks `pay_process_status`. `ReleasePayslipsHandler` sets `released_at`. | Processing completion is conflated with payslip availability; employees are not alerted when payslips actually release. | Strictly decouple: notify Payroll Officers on processing completion; notify employees ONLY when `ReleasePayslipsHandler` releases payslips. |
| **Timekeeping Operations** (`payroll_period`, `TimesheetProcessingController`, `DutyRosterController`) | Periods locked and rosters published via controllers. | Employees not notified of published rosters or cutoff locks. Timekeepers not notified of cutoff disputes. | Notify unit employees upon roster publish and cutoff lock; notify timekeepers of pending cutoff disputes. |
| **Announcements** (`announcements`, `announcement_reads`) | Announcements created in HR portal with company/unit scoping. | No push or in-app notification when urgent company announcements are published. | Batch dispatch `announcement.created` to active targeted employees (`status = 1`). |
| **HR & Disciplinary** (`DisciplinaryActionModel`, `IncidentReport`, `EmpMovementController`) | HR issues NTEs and incident reports into tables. | Employees receive no immediate notification of critical disciplinary filings or status changes. | Dispatch high/critical priority notices; enforce mandatory delivery so users cannot mute them. |
| **Birthdays & Anniversaries** (`accounts.bdate`, `vw_accounts_details.hire_date`) | Data exists in employee masterlist. | No automated greetings or milestone celebrations. | Scheduled daily cron generating greetings, with user privacy opt-out controls. |
| **Messaging** (`messages`, `conversations`) | Real-time chat exists via Pusher/Reverb. | Lacks reaction coalescing, chat presence suppression, and dedicated notification inbox entries. | Add reaction coalescing (3-min window) and suppress toasts when user is active in conversation. |
| **User Settings** | No notification preference controls exist. | Users cannot configure delivery channels, set DND hours, or opt out of non-critical reminders. | Dedicated Notification Settings page with master controls, reminder frequencies, and category matrix. |

### Technical Reason for Architecture

SubHRMS follows strict architectural rules ([project-profile.md](../../rules/project-profile.md)):
- No foreign keys (`->foreign()`), relationship columns are `id`-prefixed (`idacct`), soft deletes use `status` columns (`1=active`, `0=deleted`).
- Thin controllers delegate to `app/Queries/<Domain>/` for reads and `app/Handlers/<Domain>/` or `app/Actions/<Domain>/` for writes.
- Returning raw JSON responses without API Resources.
- Standard Laravel polymorphic notification tables (`notifications` with UUIDs and JSON blobs) violate these repository conventions, prevent efficient column-level indexing, and degrade query performance on high-volume user notification queries. A dedicated, structured schema native to SubHRMS is required.

---

## 4. Scope

### Included

1. **Database Schema**: Migrations creating `notifications`, `notification_settings`, and `notification_preferences` following SubHRMS conventions (`idacct`, indexes, `status` soft deletes).
2. **Backend Domain Architecture**:
   - Core Actions: `CreateNotificationAction`, `CreateBatchNotificationsAction`, `BroadcastNotificationAction`, `ResolveNotificationRecipientsAction`, `CheckMissingAttendanceAction`.
   - Core Handlers: `MarkNotificationReadHandler`, `MarkAllNotificationsReadHandler`, `DismissNotificationHandler`, `UpdateNotificationSettingsHandler`, `UpdateNotificationPreferencesHandler`.
   - Core Queries: `GetNotificationsQuery`, `GetNotificationCountQuery`, `GetNotificationSettingsQuery`.
   - Domain Broadcast Events: `NotificationCreated` and `NotificationCountUpdated` on `PrivateChannel("user.{$idacct}")`.
3. **Decoupled Payroll Events**:
   - `payroll.processing_completed` & `payroll.processing_failed` for Payroll Officers / HR Admins.
   - `payroll.payslip_released` strictly for Employees when `ReleasePayslipsHandler` executes.
4. **Schedule-Aware Attendance Eligibility Engine**:
   - `hrms:check-missing-attendance` evaluating shift assignments, rest days, holidays, leaves, OBT, and punch records.
5. **Role-Specific Recipient Routing**:
   - Scoped routing for Employee, Manager, HR, Timekeeping, Payroll, and Admin portals.
6. **Mandatory Delivery Policy**:
   - Statutory compliance categories (`is_mandatory = 1`) locked against muting or disabling.
7. **Unified Web and Mobile Design System Parity**:
   - Web: Dynamic navbar bell dropdown in `HeaderBarComponets.vue`, full Notification Center at `/notifications`, Notification Settings at `/settings/notifications`.
   - Mobile: Dynamic header bell in `AppTopHeader.tsx`, `NotificationContext`, Notification Center at `/(app)/notifications`, Notification Settings at `/(app)/settings/notifications`.
   - Shared card anatomy, priority border accents, category icon color tokens, and one-tap deep linking.

### Not Included

- External Mobile OS Push Server (APNs/FCM background server gateway) — delivery flags and preferences are modeled and persisted, but dispatching raw Apple/Google APNs/FCM payloads is deferred to `T00004` (Mobile Push Infrastructure).
- Third-party SMS notifications — deferred due to SMS gateway billing requirements.
- Biometric hardware firmware notifications — physical device LCD display prompts remain managed by biometric SDKs.

---

## 5. User Flow

### Flow 1 — Viewing and Interacting with Notifications (Employee / Web & Mobile)

**Entry point:** Clicking/tapping the Bell icon in top navigation bar (`HeaderBarComponets.vue` on Web, `AppTopHeader.tsx` on Mobile).

| Step | User Action | System Behavior | Expected Result |
| --- | --- | --- | --- |
| 1 | User clicks/taps Bell icon. | Requests `GET /api/notifications?per_page=10` and displays dropdown (Web) or opens Notification Center (Mobile). | Inbox displays latest notifications, unread items highlighted with teal dot, relative time, priority accent, and category icon. |
| 2 | User views category tabs (Web or Mobile). | Taps category pill (e.g., `Payroll & Payslips`). | List immediately filters to payroll items without full page reload. |
| 3 | User clicks a specific notification (e.g., Payslip Released). | Calls `POST /api/notifications/{id}/read` in background and navigates to `resource_type` destination (`/payslip?id=980`). | Notification item marks as read, unread count decrements by 1 on navbar, and user lands on target screen. |
| 4 | User clicks "Mark all as read". | Calls `POST /api/notifications/read-all`. Updates all active notifications for user. | All badges clear to 0, all items reflect read status, and `NotificationCountUpdated` broadcasts `unread_count = 0`. |
| 5 | User dismisses an item (swipe left on Mobile, click trash on Web). | Calls `DELETE /api/notifications/{id}`. | Notification item is soft-deleted (`status = 0`) and animated out of view. |

**Failure paths:**
- Step 1, network offline: UI displays cached notifications with an offline indicator badge.
- Step 3, target entity cancelled/deleted: Notification marks read; user navigates to module list with toast: "The requested record is no longer available."

### Flow 2 — Manager Actionable Pending Approval Alert (Manager / Web & Mobile)

**Entry point:** Subordinate submits a Leave or Overtime application.

| Step | User Action | System Behavior | Expected Result |
| --- | --- | --- | --- |
| 1 | Subordinate submits Leave request `id=55`. | `TKApplicationController` invokes `CreateNotificationAction` for the lowest pending approver tier resolved from `ApproverMatrix`. | Notification created for Manager `idacct=202` with `type='approval.pending'`, `priority='high'`, `is_actionable=1`. |
| 2 | Manager is browsing HRMS. | WebSocket event `NotificationCreated` arrives on `private-user.202`. | Toast alert appears; navbar bell count increments from 0 to 1. |
| 3 | Manager clicks notification. | Calls `POST /api/notifications/{id}/read` and navigates to approval screen (`/manager/approvals?id=55`). | Approval view opens with application details and Approve/Decline actions. |
| 4 | Manager approves the application. | `ApprovalRequestController` updates tier status and notifies subordinate `leave.approved`. Actionable state of notification `id` updates to `action_state='resolved'`. | Subordinate receives instant alert that their leave was approved. Manager's notification shows resolved checkmark. |

**Failure paths:**
- Step 4, another sub-approver already approved: When manager opens screen, UI displays "This request has already been acted upon by another approver."

### Flow 3 — Configuring Notification Preferences & Mandatory Guard (All Roles / Web & Mobile)

**Entry point:** User profile menu → Account Settings → Notification Settings (`/settings/notifications` on Web, `/(app)/settings/notifications` on Mobile).

| Step | User Action | System Behavior | Expected Result |
| --- | --- | --- | --- |
| 1 | User navigates to Notification Settings. | Calls `GET /api/notifications/settings`. | Screen renders Master Controls, Reminder Preferences, Privacy Opt-Outs, and Category Channel Matrix. |
| 2 | User mutes workplace chat notifications. | Sets Messaging category channels to disabled (`channel_in_app: false`). | Chat notifications are silenced. Operational and compliance notifications remain completely unaffected. |
| 3 | User attempts to toggle OFF in-app alerts for "HR & Disciplinary Notices". | UI verifies `is_mandatory === true`. | Toggle is locked with a Shield icon and tooltip: "Mandatory compliance notification." If sent via API, returns HTTP 422. |
| 4 | User enables Do-Not-Disturb (DND) from 22:00 to 07:00. | Sends `PUT /api/notifications/settings` with `dnd_enabled: true`, `dnd_start_time: '22:00'`, `dnd_end_time: '07:00'`. | During DND window, non-critical push/sound alerts are suppressed while in-app notifications record silently. |

**Failure paths:**
- Step 3, API bypass attempt: Server returns HTTP 422 with `{"message": "This notification category is mandatory for compliance and cannot be disabled."}`.

### Flow 4 — Scheduled Missing Attendance Reminder Engine (System)

**Entry point:** Automated cron scheduler running `php artisan hrms:check-missing-attendance`.

| Step | User Action | System Behavior | Expected Result |
| --- | --- | --- | --- |
| 1 | Cron triggers command at 09:30 AM. | Executes `CheckMissingAttendanceAction`. Loads active employees (`status = 1`). | Iterates across active employees scheduled for morning shifts. |
| 2 | System evaluates Employee `105`. | Checks `ResolveShiftForDateAction`. Shift starts at 08:30 AM (grace period 30m expired at 09:00 AM). | Confirms employee has a scheduled workday today. |
| 3 | System verifies exclusions. | Checks `Holiday`, `AppLeave`, and `AppOfficialBusinessTrip`. | Verifies employee is NOT on holiday, NOT on approved leave, and NOT on official business. |
| 4 | System inspects attendance. | Checks `timelogs` and `timesheet` for `$date`. | Confirms NO time-in record exists. |
| 5 | System checks deduplication. | Checks `notifications` for `dedup_key = 'missing_time_in_105_2026-10-14'`. | Confirms no alert generated yet today. |
| 6 | System emits reminder. | Inserts row into `notifications` (`type='timekeeping.missing_time_in'`) and broadcasts to `private-user.105`. | Employee receives real-time reminder: "Missing Time-In: You have not logged in for your 8:30 AM shift. Please time in or file an adjustment." |

**Failure paths:**
- Step 3, employee is on approved leave or rest day: Excluded by engine; zero reminders generated.

---

## 6. Functional Requirements

### FR-01 — Centralized Notification Dispatch Engine
- **Requirement ID:** FR-01
- **Description:** Provide centralized backend actions (`CreateNotificationAction` and `CreateBatchNotificationsAction`) that validate user preferences, enforce deduplication keys, persist notification records to MySQL, and dispatch real-time WebSocket broadcasts via `DB::afterCommit`.
- **Expected Behavior:** Input accepts `idacct`, `type`, `category`, `title`, `body`, `priority`, `actor_idacct`, `resource_type`, `resource_id`, `data`, and `dedup_key`. If user preference has disabled the target channel (and category is not mandatory), dispatch is skipped. Broadcast errors are caught and logged without aborting caller database transactions.
- **Verified by:** AC-01, AC-02, AC-25, AC-26

### FR-02 — Real-Time WebSocket Broadcasting
- **Requirement ID:** FR-02
- **Description:** Broadcast real-time notification events over private user channels (`private-user.{idacct}`) using Pusher/Reverb.
- **Expected Behavior:** Two events emitted: `NotificationCreated` (carrying complete notification object) and `NotificationCountUpdated` (carrying updated `unread_count`). Only the authenticated account matching `{idacct}` may subscribe.
- **Verified by:** AC-02, AC-27, AC-28

### FR-03 — Notification Retrieval and Category Filtering
- **Requirement ID:** FR-03
- **Description:** Provide a paginated REST API endpoint allowing authenticated users to fetch their notifications with optional filtering by category, read status, and priority.
- **Expected Behavior:** `GET /api/notifications` returns paginated records scoped strictly to `auth()->user()->id`, sorted newest first. Supports query parameters: `page` (default 1), `per_page` (default 20, max 100), `category`, `unread_only` (0/1), and `priority`.
- **Verified by:** AC-03, AC-29

### FR-04 — Read and Dismissal State Management
- **Requirement ID:** FR-04
- **Description:** Allow users to mark individual notifications as read, mark all notifications as read, and soft-delete/dismiss notifications.
- **Expected Behavior:** `POST /api/notifications/{id}/read` sets `read_at = now()`. `POST /api/notifications/read-all` sets `read_at = now()` for all unread records of the user (optionally scoped to a `category`). `DELETE /api/notifications/{id}` sets `status = 0`. Both read actions broadcast updated `NotificationCountUpdated`. Attempting to read another user's notification returns HTTP 403 Forbidden.
- **Verified by:** AC-04, AC-05, AC-06, AC-30

### FR-05 — Global and Category Notification Settings
- **Requirement ID:** FR-05
- **Description:** Provide APIs and database backing for users to configure global delivery options and per-category channel preferences (In-App, Push, Email).
- **Expected Behavior:** `GET /api/notifications/settings` returns master settings (DND schedule, reminder lead times, privacy flags) and per-category channel states. `PUT /api/notifications/settings` updates master settings. `PUT /api/notifications/preferences/{category}` updates category channel toggles. Mandatory categories reject disable requests with HTTP 422.
- **Verified by:** AC-07, AC-08, AC-31

### FR-06 — Application and Approval Workflow Notifications
- **Requirement ID:** FR-06
- **Description:** Notify applicants and approvers across all request types: Leave (`AppLeave`), Overtime (`AppOvertime`), Official Business (`AppOfficialBusinessTrip`), Attendance Adjustment (`AppAdjustment`), and Change Shift (`AppChangeShift`).
- **Expected Behavior:**
  - On submission: Notify the current active approver tier resolved by `ApproverMatrix` with `type='approval.pending'`, `is_actionable=1`.
  - On tier approval: Notify the next approver tier; if final tier, notify applicant with `type='<module>.approved'`.
  - On rejection: Notify applicant with `type='<module>.rejected'`, including approver's reason.
  - On cancellation: If pending, notify current approvers that the request was cancelled.
- **Verified by:** AC-01, AC-09, AC-10, AC-11

### FR-07 — Decoupled Payroll Lifecycle: Processing Completion vs. Payslip Release
- **Requirement ID:** FR-07
- **Description:** Strictly decouple internal payroll processing completion notifications from employee payslip release notifications.
- **Expected Behavior:**
  - **Internal Payroll Processing Completed**: When a payroll run computation finishes (`pay_process_status = 1`), dispatch `payroll.processing_completed` strictly to Payroll Officers and HR Administrators. Employees receive ZERO notifications.
  - **Payroll Processing Failed/Warning**: When payroll computation encounters calculation errors or unlinked accounts, dispatch `payroll.processing_failed` strictly to Payroll Officers.
  - **Payslip Officially Released**: When `ReleasePayslipsHandler::execute` runs, dispatch `payroll.payslip_released` to individual employees whose payslips have `released_at` set. Notification body must NEVER expose gross/net compensation amounts or sensitive figures in previews. Deep links directly to `/payslip?id={id}`.
- **Verified by:** AC-12, AC-13, AC-14, AC-32, AC-43, AC-44

### FR-08 — Timekeeping and Shift Roster Notifications
- **Requirement ID:** FR-08
- **Description:** Notify employees and supervisors regarding duty roster publishing, cutoff period locking, attendance adjustments, and attendance disputes.
- **Expected Behavior:**
  - Publishing duty roster (`DutyRosterController`) dispatches `timekeeping.duty_roster_published` to all assigned employees.
  - Period locking (`TimesheetProcessingController`) dispatches `timekeeping.period_locked`.
  - Attendance dispute resolution (`AttendanceDispute`) dispatches `timekeeping.dispute_resolved`.
- **Verified by:** AC-15, AC-16, AC-17

### FR-09 — Missing Attendance Eligibility & Reminder Engine
- **Requirement ID:** FR-09
- **Description:** Automatically detect and notify active employees who have missed their scheduled time-in or time-out, applying comprehensive schedule eligibility rules.
- **Expected Behavior:** Scheduled command `hrms:check-missing-attendance` executes daily. An employee is alerted for missing time-in ONLY if: (1) `status = 1`, (2) resolved shift via `ResolveShiftForDateAction` is not Rest Day (`idshift !== 1`, `code !== 'REST'`), (3) date is not a holiday in `Holiday`, (4) no approved leave in `AppLeave`, (5) no approved official business trip in `AppOfficialBusinessTrip`, (6) shift start time + grace period (default 30m) has elapsed, (7) no time-in recorded in `timelogs` or `timesheet`, and (8) not already notified today (`dedup_key = 'missing_time_in_{idacct}_{date}'`). Missing time-out evaluates shift end time + grace period for employees who have timed in. Auto-resolves if employee subsequently logs in or files an adjustment.
- **Verified by:** AC-18, AC-19, AC-20, AC-33, AC-34

### FR-10 — Filing and Cutoff Deadline Reminders
- **Requirement ID:** FR-10
- **Description:** Alert employees and managers regarding approaching pay period cutoffs and pending filing deadlines.
- **Expected Behavior:** Scheduled command `hrms:notify-filing-deadlines` checks active `PayPeriod` records approaching `period_end`. Dispatches `timekeeping.cutoff_reminder` to employees with unfiled attendance exceptions or pending draft applications at 24 hours and 4 hours before lock.
- **Verified by:** AC-21, AC-34

### FR-11 — HR Lifecycle and Statutory Disciplinary Notices
- **Requirement ID:** FR-11
- **Description:** Deliver urgent, mandatory notifications for Notice to Explain (NTE), Disciplinary Actions, Incident Reports, Employee Movements, and Clearance Milestones.
- **Expected Behavior:**
  - `DisciplinaryActionController` dispatches `hr.disciplinary_action` with `priority='critical'`.
  - `IncidentReportController` dispatches `hr.incident_report` with `priority='high'`.
  - `EmpMovementController` dispatches `hr.emp_movement` upon regularization or promotion.
  - Disciplinary notifications cannot be disabled in user preferences.
- **Verified by:** AC-08, AC-22, AC-23

### FR-12 — Announcements and Company Townhalls
- **Requirement ID:** FR-12
- **Description:** Broadcast announcements created in `AnnouncementController` to targeted employee audiences (company-wide, specific units, or specific departments).
- **Expected Behavior:** Creating an active announcement dispatches `announcement.created` in batches of 100 to all eligible active employees. Resigned or inactive employees (`status != 1`) are excluded.
- **Verified by:** AC-24, AC-35

### FR-13 — Birthdays and Work Anniversaries
- **Requirement ID:** FR-13
- **Description:** Dispatch daily milestone greetings for employee birthdays and work anniversaries, respecting privacy preferences.
- **Expected Behavior:** Scheduled command `hrms:notify-birthdays-anniversaries` runs at 08:00 AM daily. Matches `bdate` (month-day) and `hire_date` (month-day). Dispatches `birthday.today` and `anniversary.milestone`. If employee has set `birthday_privacy_opt_out = 1`, the notification is suppressed.
- **Verified by:** AC-36, AC-37

### FR-14 — Workplace Messaging Notification Coalescing & Suppression
- **Requirement ID:** FR-14
- **Description:** Provide notification integration for chat direct messages, channel mentions, and thread replies with intelligent suppression and coalescing.
- **Expected Behavior:** Mentions (`@user`, `@channel`, `@all`) generate `message.mention` with `priority='high'`. Direct messages generate `message.received`. If recipient is currently active in the specific conversation channel, in-app notification toasts are suppressed. Rapid emoji reactions within a 3-minute window coalesce into a single notification record. Chat muting never silences operational or compliance categories.
- **Verified by:** AC-38, AC-39, AC-40

### FR-15 — Web & Mobile Notification Center UI/UX Parity
- **Requirement ID:** FR-15
- **Description:** Implement responsive, accessible notification center components on Web (Vue 3 / PrimeVue) and Mobile (React Native / Expo) sharing identical visual concepts, category tabs, priority borders, and layout hierarchy.
- **Expected Behavior:**
  - **Shared Visual Hierarchy**: Both platforms share identical category icons, priority accent borders (`critical`: red, `high`: amber, `normal`: default), unread indicator dots, and relative timestamp formatting.
  - **Web**: Dropdown menu in `HeaderBarComponets.vue` with live unread badge; dedicated full page at `/notifications` with category tabs (`All`, `Approvals`, `Attendance`, `Payroll`, `Announcements`, `HR`, `Messages`), priority badges, and deep-link routing.
  - **Mobile**: Bell button in `AppTopHeader.tsx` displaying live unread pill badge; screen at `/(app)/notifications` with identical category tabs, pull-to-refresh, swipe-to-dismiss, and one-tap deep linking.
- **Verified by:** AC-02, AC-03, AC-41, AC-42

---

## 7. Role-Specific Recipient Routing Matrix

The system enforces role and portal-scoped recipient routing so users receive only relevant notifications matching their actual permissions:

| Notification Category & Event | Employee | Manager / Approver | HR Personnel | Timekeeper | Payroll Staff | System Admin |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| `leave.submitted` / `overtime.submitted` | Applicant confirmation | **Active Tier Approver** | — | — | — | — |
| `leave.approved` / `overtime.approved` | **Applicant** | Next Tier / Final Approver | — | — | — | — |
| `leave.rejected` / `overtime.rejected` | **Applicant** | Approver record | — | — | — | — |
| `timekeeping.missing_time_in` / `out` | **Assigned Employee** | Escalated if unresolved > 24h | — | — | — | — |
| `timekeeping.duty_roster_published` | **Scheduled Unit Employees** | Unit Manager | — | Unit Timekeeper | — | — |
| `timekeeping.cutoff_reminder` | **Employees with unfiled exceptions** | Subordinate pending summary | — | Timekeeping team | — | — |
| `timekeeping.period_locked` | Unit Employees | Unit Managers | HR team | **Timekeeping team** | Handover to Payroll | — |
| `payroll.processing_completed` | ❌ **NOT SENT** | — | HR Admin | — | **Payroll Officers** | — |
| `payroll.processing_failed` | ❌ **NOT SENT** | — | HR Admin | — | **Payroll Officers** | IT Support |
| `payroll.payslip_released` | **Individual Recipient** | — | — | — | Release confirmation | — |
| `payroll.13th_month_released` | **Individual Recipient** | — | — | — | Release confirmation | — |
| `hr.disciplinary_action` (NTE) | **Accused Employee** | Subordinate Manager | **HR Issuer** | — | — | Legal/Admin |
| `hr.incident_report` | **Tagged Parties** | Unit Manager | **HR Safety/Security** | — | — | — |
| `hr.emp_movement` (Regularization) | **Promoted Employee** | Direct Manager | **HR Operations** | — | Payroll (for rate adjustment) | — |
| `announcement.created` | **Target Audience Employees** | Target Managers | Author confirmation | — | — | — |
| `birthday.today` / `anniversary.milestone` | **Colleagues / Team** | Department Head | — | — | — | — |
| `system.biometric_sync_failed` | — | — | — | Unit Timekeeper | — | **System Admin** |
| `system.queue_worker_down` | — | — | — | — | — | **System Admin** |

---

## 8. Non Functional Requirements

| ID | Category | Requirement | Target / Limit |
| --- | --- | --- | --- |
| NFR-01 | Security | Authorization and IDOR protection on every endpoint; all actions scoped to `auth()->user()->id`. | 0 unauthorized accesses; 403 Forbidden on foreign IDs |
| NFR-02 | Performance | List endpoint retrieval response time under high concurrency with indexed keys. | p95 < 250 ms with 20,000 historical rows |
| NFR-03 | Scalability | Bulk notification insertion during payroll releases or company-wide announcements. | 1,000 notifications inserted and queued within 1,500 ms |
| NFR-04 | Maintainability | Strict adherence to SubHRMS conventions: Query/Handler/Action pattern, `idacct`, no foreign keys, `status` soft delete. | 100% compliance; zero `app/Domain/` references |
| NFR-05 | Reliability | Persist-before-broadcast guarantee and transaction safety. Broadcast failures must never abort caller DB transactions. | 100% transaction safety; 0 phantom broadcasts |

---

## 9. Technical Design

### Architecture

- **Where it fits:** SubHRMS Backend (`app/Actions/Notifications/`, `app/Handlers/Notifications/`, `app/Queries/Notifications/`, `app/Models/`, `app/Events/Notifications/`), Web Frontend (`resources/views/web/src/module/employee/notifications/`), and Mobile Frontend (`resources/views/mobapp/src/module/employee/notifications/`).
- **Pattern followed:** SubHRMS Thin Controller + Query/Handler/Action pattern ([project-profile.md](../../rules/project-profile.md)).
- **Reference implementation:** `app/Handlers/Payroll/ReleasePayslipsHandler.php` (for batch DB transactions), `app/Actions/Messages/ResolveMentionsAction.php` (for mention parsing and WebSocket broadcasts), `resources/views/web/src/components/custom/Navbar/HeaderBarComponets.vue` (for web navbar header integration).

| Component | Status | Path |
| --- | --- | --- |
| `Notification` model | New | `app/Models/Notification.php` |
| `NotificationSetting` model | New | `app/Models/NotificationSetting.php` |
| `NotificationPreference` model | New | `app/Models/NotificationPreference.php` |
| `CreateNotificationAction` | New | `app/Actions/Notifications/CreateNotificationAction.php` |
| `CreateBatchNotificationsAction` | New | `app/Actions/Notifications/CreateBatchNotificationsAction.php` |
| `BroadcastNotificationAction` | New | `app/Actions/Notifications/BroadcastNotificationAction.php` |
| `ResolveNotificationRecipientsAction` | New | `app/Actions/Notifications/ResolveNotificationRecipientsAction.php` |
| `CheckMissingAttendanceAction` | New | `app/Actions/Notifications/CheckMissingAttendanceAction.php` |
| `GetNotificationsQuery` | New | `app/Queries/Notifications/GetNotificationsQuery.php` |
| `GetNotificationCountQuery` | New | `app/Queries/Notifications/GetNotificationCountQuery.php` |
| `GetNotificationSettingsQuery` | New | `app/Queries/Notifications/GetNotificationSettingsQuery.php` |
| `MarkNotificationReadHandler` | New | `app/Handlers/Notifications/MarkNotificationReadHandler.php` |
| `MarkAllNotificationsReadHandler` | New | `app/Handlers/Notifications/MarkAllNotificationsReadHandler.php` |
| `DismissNotificationHandler` | New | `app/Handlers/Notifications/DismissNotificationHandler.php` |
| `UpdateNotificationSettingsHandler` | New | `app/Handlers/Notifications/UpdateNotificationSettingsHandler.php` |
| `UpdateNotificationPreferencesHandler` | New | `app/Handlers/Notifications/UpdateNotificationPreferencesHandler.php` |
| `NotificationsController` | New | `app/Http/Controllers/global/NotificationsController.php` |
| `NotificationCreated` event | New | `app/Events/Notifications/NotificationCreated.php` |
| `NotificationCountUpdated` event | New | `app/Events/Notifications/NotificationCountUpdated.php` |
| `CheckMissingAttendanceCommand` | New | `app/Console/Commands/CheckMissingAttendanceCommand.php` |
| `NotifyFilingDeadlinesCommand` | New | `app/Console/Commands/NotifyFilingDeadlinesCommand.php` |
| `NotifyBirthdaysCommand` | New | `app/Console/Commands/NotifyBirthdaysCommand.php` |
| `NotifyPendingApprovalsCommand` | New | `app/Console/Commands/NotifyPendingApprovalsCommand.php` |
| Web Navbar Bell & Dropdown | Extended | `resources/views/web/src/components/custom/Navbar/HeaderBarComponets.vue` |
| Web Notification Center Page | New | `resources/views/web/src/module/employee/notifications/pages/NotificationsPage.vue` |
| Web Notification Settings Page | New | `resources/views/web/src/module/employee/notifications/pages/NotificationSettingsPage.vue` |
| Mobile Navbar Bell Button | Extended | `resources/views/mobapp/src/components/AppTopHeader.tsx` |
| Mobile Notification Screen | New | `resources/views/mobapp/src/module/employee/notifications/pages/NotificationsScreen.tsx` |
| Mobile Notification Settings | New | `resources/views/mobapp/src/module/employee/notifications/pages/NotificationSettingsScreen.tsx` |
| Mobile Notification Context | New | `resources/views/mobapp/src/contexts/NotificationContext.tsx` |

### Unified Web & Mobile Visual Concept Specification

To ensure a 100% consistent concept and mental model across both Web and Mobile platforms:

1. **Shared Category Hierarchy & Color Tokens**:
   - `applications_approvals`: Amber / Orange accent (`#F59E0B`), FileCheck / CheckSquare icon.
   - `timekeeping_attendance`: Cyan / Blue accent (`#06B6D4`), Clock / Calendar icon.
   - `payroll_compensation`: Emerald / Green accent (`#10B981`), Banknote / Wallet icon.
   - `announcements_company`: Orange / Red accent (`#F97316`), Megaphone icon.
   - `hr_lifecycle`: Indigo / Purple accent (`#6366F1`), Shield / UserCheck icon.
   - `birthdays_anniversaries`: Gold / Festive accent (`#EAB308`), PartyPopper / Cake icon.
   - `messaging_conversations`: Sky / Blue accent (`#0EA5E9`), MessageSquare / AtSign icon.
   - `system_alerts`: Crimson / Red accent (`#EF4444`), AlertTriangle / Server icon.

2. **Shared Card Anatomy (`NotificationItem`)**:
   - **Left Indicator**: Circular unread badge dot (`#0D9488` teal).
   - **Border Accent**:
     - `priority = critical`: 3px solid red left border (`#EF4444`) with subtle crimson background tint.
     - `priority = high`: 3px solid amber left border (`#F59E0B`).
     - `priority = normal`: Clean border matching standard container.
   - **Content Section**:
     - Line 1: Category badge + Priority pill (if High/Critical) + Relative time string (`5m ago`, `2h ago`).
     - Line 2: Notification Title (Semi-bold, text-slate-900 / dark:text-white).
     - Line 3: Notification Body preview (text-slate-600 / dark:text-slate-300, max 2 lines truncated).
     - Line 4 (Optional): Action state pill (`Pending Action` in amber, `Resolved` in green, `Expired` in gray).
   - **Interaction**:
     - Web: Hover reveals mark-read checkmark and dismiss trash icon. Click triggers deep link.
     - Mobile: Swipe right to toggle read state; swipe left to dismiss/delete. Tap triggers deep link.

3. **Shared Category Filter Tabs**:
   - Tabs on Web and Filter Pills on Mobile share exact order:
     `All` | `Approvals & Requests` | `Attendance & Timekeeping` | `Payroll & Payslips` | `Announcements` | `HR Notices` | `Messages`

4. **Shared Notification Settings Structure**:
   - Section 1: **Master Controls** (In-App toggle, Push toggle, Email toggle, DND Schedule).
   - Section 2: **Scheduled Reminders** (Missing attendance toggle, Filing deadline reminder lead hours: 24h/12h/4h).
   - Section 3: **Privacy Controls** (Birthday visibility opt-out, Anniversary visibility opt-out).
   - Section 4: **Category Channel Matrix** (In-App, Push, Email toggles per category, with mandatory categories locked with a Shield icon).

### Backend Endpoints

| Method | Route | Route Name | Handler | Access |
| --- | --- | --- | --- | --- |
| `GET` | `/api/notifications` | `notifications.index` | `NotificationsController@index` | `auth:sanctum` (All roles) |
| `GET` | `/api/notifications/count` | `notifications.count` | `NotificationsController@count` | `auth:sanctum` (All roles) |
| `POST` | `/api/notifications/{id}/read` | `notifications.read` | `NotificationsController@markAsRead` | `auth:sanctum` (All roles) |
| `POST` | `/api/notifications/read-all` | `notifications.read_all` | `NotificationsController@markAllAsRead` | `auth:sanctum` (All roles) |
| `DELETE` | `/api/notifications/{id}` | `notifications.destroy` | `NotificationsController@destroy` | `auth:sanctum` (All roles) |
| `GET` | `/api/notifications/settings` | `notifications.settings.show` | `NotificationsController@getSettings` | `auth:sanctum` (All roles) |
| `PUT` | `/api/notifications/settings` | `notifications.settings.update` | `NotificationsController@updateSettings` | `auth:sanctum` (All roles) |
| `PUT` | `/api/notifications/preferences/{category}` | `notifications.preferences.update` | `NotificationsController@updatePreference` | `auth:sanctum` (All roles) |

### Database Tables & Migrations

- **`notifications`**: `id` (bigint auto-increment), `idacct` (int unsigned, indexed), `type` (varchar 80, indexed), `category` (varchar 40, indexed), `title` (varchar 255), `body` (text), `priority` (varchar 20 default 'normal'), `actor_idacct` (int unsigned nullable, indexed), `resource_type` (varchar 60 nullable), `resource_id` (bigint unsigned nullable, indexed), `data` (json nullable), `dedup_key` (varchar 120 nullable, indexed), `is_actionable` (tinyint 1 default 0), `action_state` (varchar 20 nullable), `read_at` (timestamp nullable), `status` (tinyint default 1), `created_at`, `updated_at`.
- **`notification_settings`**: `id` (bigint auto-increment), `idacct` (int unsigned unique), `dnd_enabled` (tinyint 1 default 0), `dnd_start_time` (time default '22:00:00'), `dnd_end_time` (time default '07:00:00'), `email_notifications_enabled` (tinyint 1 default 1), `push_notifications_enabled` (tinyint 1 default 1), `in_app_notifications_enabled` (tinyint 1 default 1), `reminder_missing_attendance` (tinyint 1 default 1), `reminder_filing_deadlines` (tinyint 1 default 1), `reminder_lead_hours` (int unsigned default 4), `birthday_privacy_opt_out` (tinyint 1 default 0), `anniversary_privacy_opt_out` (tinyint 1 default 0), `status` (tinyint default 1), timestamps.
- **`notification_preferences`**: `id` (bigint auto-increment), `idacct` (int unsigned), `category` (varchar 40), `channel_in_app` (tinyint 1 default 1), `channel_push` (tinyint 1 default 1), `channel_email` (tinyint 1 default 0), `is_mandatory` (tinyint 1 default 0), `status` (tinyint default 1), timestamps, unique key `(idacct, category)`.

---

## 10. Implementation Plan

Defined in [`plan.md`](./plan.md) in this ticket folder: the file-by-file task list (Preparation → Backend → Frontend → Validation) that `/webkit-implement` executes. The plan cites this spec's IDs and adds no requirement; where the two disagree, this spec wins.

---

## 11. Acceptance Criteria

| ID | Covers | Given | When | Then |
| --- | --- | --- | --- | --- |
| AC-01 | FR-01, FR-06 | Subordinate `idacct=101` submits Leave application `AppLeave` `id=45` | Subordinate clicks Submit Application | Notification record is created for primary approver `idacct=202` with `type='approval.pending'`, `category='applications_approvals'`, `resource_type='leave'`, `resource_id=45`, `priority='high'`, `is_actionable=1`. |
| AC-02 | FR-02, FR-15 | Authenticated user `idacct=101` with 2 unread notifications | A new notification is inserted for `idacct=101` | `NotificationCreated` and `NotificationCountUpdated` events broadcast on `private-user.101`. Web and mobile header badge updates to `3` without manual page reload. |
| AC-03 | FR-03 | Authenticated user `idacct=101` with 30 notifications | `GET /api/notifications?page=1&per_page=20` is requested | Returns HTTP 200 with 20 items ordered latest first, `meta.unread_count`, `meta.total=30`, and `meta.last_page=2`. |
| AC-04 | FR-04 | User `idacct=101` has unread notification `id=500` | `POST /api/notifications/500/read` is requested | Returns HTTP 200 with `{"success": true}`, sets `read_at = now()`, and broadcasts updated unread count. |
| AC-05 | FR-04, NFR-01 | User `idacct=101` attempts to read notification `id=600` belonging to `idacct=102` | `POST /api/notifications/600/read` is requested | Returns HTTP 403 Forbidden with `{"message": "Unauthorized access to notification."}`, and record `read_at` remains unchanged. |
| AC-06 | FR-04 | User `idacct=101` has 5 unread notifications | `POST /api/notifications/read-all` is requested | Returns HTTP 200 with `{"success": true, "marked_count": 5}`, all 5 records set `read_at`, and unread count broadcasts `0`. |
| AC-07 | FR-05 | User `idacct=101` | `GET /api/notifications/settings` is requested | Returns HTTP 200 containing master settings object (DND times, reminder toggles) and array of category preference objects. |
| AC-08 | FR-05, FR-11 | User `idacct=101` | `PUT /api/notifications/preferences/hr_lifecycle` with `channel_in_app=false` | Returns HTTP 422 Unprocessable Entity with `{"message": "This notification category is mandatory for compliance and cannot be disabled."}`, and preference remains enabled. |
| AC-09 | FR-06 | Manager `idacct=202` approves Leave application `id=45` | Manager clicks Approve in Approval portal | Notification record created for applicant `idacct=101` with `type='leave.approved'`, `category='applications_approvals'`, `title='Leave Request Approved'`, linking to `/requests?id=45`. |
| AC-10 | FR-06 | Manager `idacct=202` declines Leave application `id=45` with remarks "Understaffed" | Manager clicks Decline | Notification record created for applicant `idacct=101` with `type='leave.rejected'`, `priority='high'`, body containing the reason, linking to `/requests?id=45`. |
| AC-11 | FR-06 | Applicant `idacct=101` cancels pending Overtime application `id=78` | Applicant clicks Cancel Application | Notification created for approver `idacct=202` with `type='overtime.cancelled'`, and previous pending approval notification updates `action_state='expired'`. |
| AC-12 | FR-07 | Payroll Officer releases payslips for period `id=12` | `ReleasePayslipsHandler::execute(['period_id' => 12])` runs | `CreateBatchNotificationsAction` creates notification for each employee in run with `type='payroll.payslip_released'`, `category='payroll_compensation'`, `resource_type='payslip'`. |
| AC-13 | FR-07, NFR-01 | Payslip notification is created for employee with salary ₱35,000 | Record is inspected in database and WebSocket payload | Notification `body` reads "Your payslip for period Oct 01 - Oct 15, 2026 is now available." Zero salary, deduction, or net pay figures are contained in notification title, body, or WebSocket preview. |
| AC-14 | FR-07 | Year-end 13th-month pay is released via `ProcessYearEndHandler` | Year-end batch releases | Notification created with `type='payroll.13th_month_released'`, `category='payroll_compensation'`, linking to payslip view with `type=13th_month`. |
| AC-15 | FR-08 | Unit Manager publishes duty roster in `DutyRosterController` | Schedule roster published | Generates `timekeeping.duty_roster_published` notification for all employees scheduled in that roster with `resource_type='duty_roster'`. |
| AC-16 | FR-08 | Timekeeping supervisor locks cutoff in `TimesheetProcessingController` | Cutoff period locked | Generates `timekeeping.period_locked` notification to employees in that unit. |
| AC-17 | FR-08 | Attendance dispute `id=14` is resolved by supervisor | Dispute marked resolved in `ResolutionCenterController` | Generates `timekeeping.dispute_resolved` notification to the filing employee. |
| AC-18 | FR-09 | Active employee `idacct=105` scheduled for 08:30 AM shift on a regular workday with no timelog | Cron `hrms:check-missing-attendance` runs at 09:30 AM | Generates `timekeeping.missing_time_in` notification for `idacct=105` with `dedup_key='missing_time_in_105_2026-10-14'`. |
| AC-19 | FR-09 | Employee `idacct=106` is on approved Sick Leave for today | Cron `hrms:check-missing-attendance` runs at 09:30 AM | Excluded by eligibility engine: zero missing attendance notifications generated for `idacct=106`. |
| AC-20 | FR-09 | Today is an active company Holiday (`Holiday::where('date', $today)`) | Cron `hrms:check-missing-attendance` runs at 09:30 AM | Excluded by eligibility engine: zero missing attendance notifications generated for all employees not explicitly assigned to a holiday shift. |
| AC-21 | FR-10 | Pay period cutoff closes in 4 hours, employee `idacct=107` has 1 unfiled attendance exception | Cron `hrms:notify-filing-deadlines` runs | Generates `timekeeping.cutoff_reminder` with `priority='high'`, alerting employee to file pending adjustment before lock. |
| AC-22 | FR-11 | HR issues Notice to Explain (NTE) `id=3` to employee `idacct=108` | HR submits record in `DisciplinaryActionController` | Generates `hr.disciplinary_action` notification with `priority='critical'`, `is_actionable=1`, linking to `/requests?disciplinary=3`. |
| AC-23 | FR-11 | HR tags employee `idacct=108` in Incident Report `id=12` | Record submitted in `IncidentReportController` | Generates `hr.incident_report` with `priority='high'`. |
| AC-24 | FR-12 | HR publishes company-wide announcement `id=8` to all active employees | HR clicks Publish Announcement | `CreateBatchNotificationsAction` creates `announcement.created` notification for all accounts where `status = 1`. Inactive/resigned accounts (`status != 1`) receive zero records. |
| AC-25 | FR-01, NFR-05 | Database transaction fails/aborts during leave approval | An unhandled exception occurs before DB commit | Transaction rolls back. Zero notification records exist in MySQL and zero WebSocket events are broadcast. |
| AC-26 | FR-01, NFR-05 | WebSocket server (Pusher/Reverb) is offline or unreachable | `CreateNotificationAction` is executed during Leave approval | Notification is safely saved in MySQL, broadcast error is caught and logged, and the caller API response succeeds with HTTP 200. |
| AC-27 | FR-02 | Client was offline when notification was generated | Client reconnects to network and mounts notification screen | Screen queries `GET /api/notifications` and `GET /api/notifications/count`, instantly synchronizing unread count and displaying the new notification. |
| AC-28 | FR-02 | Client connects to WebSocket | Client subscribes to `private-user.{idacct}` | Channel authorization succeeds if and only if `auth()->id() === (int)$idacct`; unauthorized subscription attempts are rejected by Sanctum. |
| AC-29 | FR-03 | Authenticated user requests notifications with category filter | `GET /api/notifications?category=payroll_compensation` | Response contains exclusively items where `category === 'payroll_compensation'`. |
| AC-30 | FR-04 | User dismisses notification `id=500` | `DELETE /api/notifications/500` is requested | Returns HTTP 200, updates `status = 0`, and subsequent `GET /api/notifications` omits the record. |
| AC-31 | FR-05 | User updates DND schedule | `PUT /api/notifications/settings` with `{"dnd_enabled": true, "dnd_start_time": "21:30:00"}` | Returns HTTP 200, updates `notification_settings`, and future queries reflect the new schedule. |
| AC-32 | FR-07 | Employee taps Payslip notification on Mobile UI | Tapping notification item | Calls read API, marks item as read, and navigates client route to `/(app)/payslip?id=980`. |
| AC-33 | FR-09 | Employee clocked in at 08:00 AM on 8-hour shift, current time is 06:00 PM (1 hour past 05:00 PM shift end + 30m grace), no timeout recorded | Cron `hrms:check-missing-attendance` runs | Generates `timekeeping.missing_time_out` reminder for employee. |
| AC-34 | FR-10 | Employee already resolved missing time-in by filing Attendance Adjustment | Cron `hrms:check-missing-attendance` runs later in the day | Eligibility engine detects pending adjustment for that date; generates no duplicate reminder. |
| AC-35 | FR-12 | HR publishes announcement targeted strictly to Unit `id=4` (Engineering) | Announcement published | Only active employees belonging to Unit `id=4` receive notification; employees in Unit `id=5` receive zero records. |
| AC-36 | FR-13 | Employee `idacct=110` has birthday on Oct 14 and `birthday_privacy_opt_out = 0` | Daily cron `hrms:notify-birthdays-anniversaries` runs on Oct 14 at 08:00 AM | Generates `birthday.today` greeting to team members. |
| AC-37 | FR-13 | Employee `idacct=111` has birthday on Oct 14 and `birthday_privacy_opt_out = 1` | Daily cron `hrms:notify-birthdays-anniversaries` runs on Oct 14 | Suppressed by privacy filter: zero birthday notifications generated for `idacct=111`. |
| AC-38 | FR-14 | User is mentioned `@JaneDoe` in a group channel | `SendMessageHandler` executes | Generates `message.mention` notification for Jane Doe with `priority='high'`, linking to `/messages?conversation_id={id}`. |
| AC-39 | FR-14 | Three colleagues react with 👍, ❤️, 🎉 to user's chat message within 2 minutes | Reactions posted via chat API | First reaction creates notification; subsequent reactions within 3-minute window update the existing unread record into a coalesced summary ("Jane Doe and 2 others reacted to your message"). |
| AC-40 | FR-14 | User is actively focused in conversation `id=15` on Web | New message arrives in conversation `id=15` | Message appears in chat stream, but in-app toast notification for conversation `id=15` is suppressed to prevent visual clutter. |
| AC-41 | FR-15 | Web user clicks notification bell in navbar | Bell button clicked | Dropdown appears smoothly with unread items, category icons, "Mark all read", and "View all notifications" link. |
| AC-42 | FR-15 | Mobile user swipes left on notification item in `NotificationsScreen.tsx` | Left swipe gesture executed | Item reveals red delete icon and deletes item upon confirmation. |
| AC-43 | FR-07 | Payroll batch computation finishes for period `id=12` | `pay_process_status` updates to `1` in `TimesheetProcessingController` | Notification `payroll.processing_completed` is sent strictly to Payroll Officers and HR Admins. Zero notifications are generated for general employees. |
| AC-44 | FR-07 | Payroll calculation throws formula exception for employee `idacct=109` | Exception occurs during batch run | Notification `payroll.processing_failed` dispatched strictly to Payroll Officers detailing error. No employee notifications created. |

---

## 12. Edge Cases

| ID | Category | Scenario | Expected Handling | AC |
| --- | --- | --- | --- | --- |
| EC-01 | Invalid input | Negative or non-integer `page` or `per_page` passed to list endpoint | Query clamps `page` to minimum 1, `per_page` clamped to range 1–100. Invalid category returns HTTP 422 with validation errors. | AC-03 |
| EC-02 | Empty data | User has zero notifications in database | `GET /api/notifications` returns `data: []`, `unread_count: 0`. UI renders `NotificationEmptyState` with friendly graphic on both Web and Mobile. | AC-03 |
| EC-03 | Permission | User attempts to mark as read or delete a notification belonging to another employee | Request rejected with HTTP 403 Forbidden `{"message": "Unauthorized access to notification."}`; database record is untouched. | AC-05 |
| EC-04 | Failure | Database connection failure during notification creation | Exception caught; if inside transaction, transaction rolls back cleanly; no orphaned records or phantom broadcasts. | AC-25 |
| EC-05 | Failure | Pusher/Reverb WebSocket daemon offline | `BroadcastNotificationAction` catches broadcast exception in `try/catch`, writes warning to Laravel log, and returns safely without aborting HTTP response. | AC-26 |
| EC-06 | Unexpected behavior | User clicks "Mark all as read" rapidly multiple times (double-submit) | Handler executes idempotent query `UPDATE notifications SET read_at = now() WHERE idacct = ? AND read_at IS NULL`; subsequent executions affect 0 rows and return HTTP 200. | AC-06 |
| EC-07 | Unexpected behavior | Queue worker replays bulk payslip release job | `CreateNotificationAction` checks `dedup_key` (e.g. `payslip_12_42`). If record with that key already exists, insert is skipped. | AC-12 |
| EC-08 | Stale navigation | User clicks notification for an application that was since deleted or cancelled | Notification marks as read; user navigates to module list with toast: "The requested record is no longer available." | AC-11 |

---

## 13. Testing Strategy

### Unit Testing

| Target | Cases | Covers |
| --- | --- | --- |
| `CreateNotificationAction::execute` | Preference check (allowed vs muted), dedup key check, DB insert, `afterCommit` broadcast dispatch | AC-01, AC-25, AC-26 |
| `ResolveNotificationRecipientsAction::execute` | Active employee filter (`status=1`), unit scoping, department scoping, approver tier resolution | AC-01, AC-24, AC-35 |
| `CheckMissingAttendanceAction::execute` | Shift resolution, holiday exclusion, leave exclusion, OBT exclusion, grace period verification, timelog absence | AC-18, AC-19, AC-20, AC-33 |
| `UpdateNotificationPreferencesHandler::execute` | Reject disable on `is_mandatory=1`, allow toggle on standard categories | AC-08, AC-31 |

### Integration Testing

| Flow / Endpoint | Setup | Assertion | Covers |
| --- | --- | --- | --- |
| `GET /api/notifications` | Seed 25 notifications for User A, 5 for User B | User A receives exactly 20 items (page 1) strictly belonging to User A; User B items excluded | AC-03, AC-05 |
| `POST /api/notifications/{id}/read` | Seed unread notification for User A | `read_at` is set to timestamp, unread count decrements to 0, HTTP 200 returned | AC-04 |
| `POST /api/notifications/{id}/read` (IDOR) | User A attempts to read User B's notification | HTTP 403 Forbidden returned; record `read_at` remains NULL | AC-05 |
| `POST /api/notifications/read-all` | Seed 5 unread notifications for User A | All 5 records updated with `read_at = now()`; unread count returns 0 | AC-06 |
| `GET /api/notifications/settings` | Seed user with customized DND and preferences | Returns full settings payload matching database state | AC-07 |
| `PUT /api/notifications/preferences/{category}` | Attempt to set `channel_in_app = 0` for `hr_lifecycle` | Returns HTTP 422 with validation message | AC-08 |

### Manual Testing Scenarios

| # | Precondition | Steps | Expected Result | Covers |
| --- | --- | --- | --- | --- |
| MT-01 | Two browser sessions open: Employee A and Manager B | 1. Employee A submits Leave request.<br>2. Observe Manager B's screen. | Manager B's navbar bell increments in real-time without refresh. Toast appears. Clicking opens approval drawer. | AC-01, AC-02 |
| MT-02 | Manager B approves Employee A's leave request | 1. Manager B clicks Approve.<br>2. Observe Employee A's screen. | Employee A's navbar bell updates. Notification says "Leave Request Approved". Clicking navigates to request. | AC-02, AC-09 |
| MT-03 | Employee A views Notification Center on Web (`/notifications`) | 1. Click category tab "Payroll".<br>2. Click "Mark all as read". | List filters exclusively to payroll items. Unread badges clear to 0. | AC-03, AC-06, AC-29 |
| MT-04 | Mobile app open on Expo simulator | 1. Trigger notification dispatch.<br>2. Tap notification item.<br>3. Swipe left on notification item. | Bell badge increments. Tapping marks read and deep-links. Swiping left deletes item. | AC-32, AC-42 |
| MT-05 | Employee scheduled for shift starting 1 hour ago with no timelog | 1. Run `php artisan hrms:check-missing-attendance`.<br>2. Check employee notifications. | Missing time-in notification created and delivered. | AC-18 |
| MT-06 | Employee on approved Sick Leave today with no timelog | 1. Run `php artisan hrms:check-missing-attendance`.<br>2. Check employee notifications. | Zero notifications created; leave exclusion honored. | AC-19 |

**Test command:** `php artisan test --filter=Notification`

---

## 14. Security Considerations

### Authentication

All notification endpoints are strictly protected by the `auth:sanctum` middleware. Requests without a valid Bearer token receive HTTP 401 Unauthorized `{"message": "Unauthenticated."}`.

### Authorization

| Role | Allowed | Denied Response |
| --- | --- | --- |
| Any Authenticated Account (`idacct`) | Read, mark read, dismiss, and configure preferences for own notifications (`notifications.idacct === auth()->id()`) | HTTP 403 Forbidden `{"message": "Unauthorized access to notification."}` |
| Approver (Manager / Supervisor) | Receive actionable approval notifications for subordinate requests in their approval matrix | N/A (routed by system) |
| HR / Admin | Publish company announcements, trigger scheduled reminders | HTTP 403 Forbidden if non-admin accesses admin dispatch routes |

### Validation

| Field | Rules | Error Response |
| --- | --- | --- |
| `page` | `nullable\|integer\|min:1` | HTTP 422 `{"message": "Page must be an integer greater than 0."}` |
| `per_page` | `nullable\|integer\|between:1,100` | HTTP 422 `{"message": "Per page must be between 1 and 100."}` |
| `category` | `nullable\|string\|in:applications_approvals,timekeeping_attendance,payroll_compensation,announcements_company,hr_lifecycle,reminders_deadlines,birthdays_anniversaries,messaging_conversations,system_alerts` | HTTP 422 `{"message": "Invalid notification category."}` |
| `dnd_enabled` | `required\|boolean` | HTTP 422 `{"message": "DND enabled must be a boolean."}` |
| `dnd_start_time` | `nullable\|date_format:H:i:s` | HTTP 422 `{"message": "Invalid time format."}` |
| `dnd_end_time` | `nullable\|date_format:H:i:s` | HTTP 422 `{"message": "Invalid time format."}` |
| `channel_in_app` | `required\|boolean` | HTTP 422 `{"message": "Invalid channel setting."}` |

### Data Protection

- **Sensitive fields:** Financial figures (gross pay, net pay, basic salary, statutory deduction breakdown, loan balances) are **strictly forbidden** in notification `title`, `body`, and WebSocket payload previews. The preview must state neutral text (e.g. "Your payslip for period Oct 01 - Oct 15, 2026 is now available."). Salary figures are accessed only after the authenticated user navigates to the encrypted payslip endpoint.
- **Exposure rules:** WebSocket events carry only non-sensitive summary metadata.
- **Write protection:** Notification inserts are executed strictly via backend Actions/Handlers. Clients have zero write access to create arbitrary notifications.

### API Security

- **Object access (IDOR):** Handlers enforce `where('id', $id)->where('idacct', auth()->id())`. If the notification ID does not belong to the authenticated account, access is immediately rejected with HTTP 403 Forbidden.
- **Mass assignment:** Eloquent models define strict `$fillable` arrays. No user request is passed directly to `Model::create()`.
- **Rate limits:** API routes inherit standard Sanctum throttle middleware; notification list endpoints throttled to 60 requests/minute per authenticated user.

---

## 15. Implementation Notes

- **Conventions to follow:** Follow SubHRMS conventions ([project-profile.md](../../rules/project-profile.md)): `idacct` column name, no `->foreign()` foreign keys (index only), `status` column soft deletes (`1=active`, `0=deleted`), Query/Handler/Action pattern with static `execute()`.
- **Do not change:** Do not modify `routes/channels.php` `user.{userId}` channel registration (already implemented in T00001). Do not modify existing payroll calculation logic in `ReleasePayslipsHandler.php`—only hook the notification dispatch action after the `PayrollRunDetail` update.
- **Known pitfalls:**
  - Avoid calling `NotificationCreated::dispatch()` inside database transactions before `DB::commit()`. Always use `DB::afterCommit(...)` or dispatch after the transaction block completes to prevent race conditions where clients fetch notifications before MySQL commits.
  - In `HeaderBarComponets.vue`, ensure the `getEcho().private('user.' + userId)` listener unsubscribes cleanly in `onUnmounted` to prevent memory leaks and duplicate audio chimes on portal switching.
  - When releasing payslips for 1,000+ employees, never call single-insert queries in a foreach loop; use `CreateBatchNotificationsAction` which chunks inserts in batches of 100.
- **Config / environment:** No new environment variables required. Reuses existing `BROADCAST_CONNECTION`, `PUSHER_*`, and `REVERB_*` keys.
- **Deployment / rollback:**
  - Deploy: Run migrations `php artisan migrate`. Seed default settings on initial user access. Start queue workers and scheduler.
  - Rollback: `php artisan migrate:rollback --step=3`.
- **Review findings:**
  - design-review v1 #1–#4 (mobile) — text and fills on the notification center, settings and card must reach WCAG AA 4.5:1 in light and dark: use the theme's `accentFill` / `onAccentFill` roles or `#9F5617` for fills, `primaryDark` and `dangerText` for text, an accessible shade per category tag, and `#DC2626` (not a token that turns `#F87171` in dark mode) for white-on-red → fixed 2026-10-15
  - design-review v1 #5–#9 (web) — the notification pages and the bell badge must not use `teal-500` / `teal-600` / `red-500` / `slate-400` for text or white-on-fill: `teal-700` fills, `teal-700` / `teal-800` text, `red-700` / `amber-700` pills, `slate-500` (light) and `slate-400` (dark) timestamps, `slate-600` / `slate-300` helper text, `red-600` badge → fixed 2026-10-15

---

## 16. Assumptions and Decisions

### Assumptions

| ID | Assumption | Impact if Wrong | Confirmed By |
| --- | --- | --- | --- |
| A-01 | An authenticated user (`Account`) represents the recipient identity across all portals (Employee, Manager, HR, TK, Payroll, Admin). | If separate account models existed per portal, notifications would need multi-table polymorphism. Verified: all portals use `accounts` table and `Account.php`. | Confirmed (`app/Models/Account.php`, `GlobalController.php`) |
| A-02 | Scheduled reminder jobs run in server timezone `Asia/Manila` matching Philippine payroll and labor standards. | Reminder timing could be offset by several hours if server timezone differs. | Confirmed (`config/app.php` timezone) |
| A-03 | Inactive or resigned employees (`status != 1`) should never receive broadcast notifications. | Excluded by recipient resolver to prevent unwanted alerts to departed staff. | Confirmed (`AccountDetailVW.php`, `EmployeeMasterlist.php`) |

### Technical Decisions

| ID | Decision | Alternatives Rejected | Reason |
| --- | --- | --- | --- |
| D-01 | Native SubHRMS structured schema (`notifications` with `idacct`, `category`, `priority`, `data`) | Laravel default `notifications` table (`UUID` primary key, polymorphic `notifiable_type`, generic JSON blob) | Laravel's default table violates SubHRMS database standards, cannot be efficiently indexed by category or priority, and causes slow query times on large datasets. |
| D-02 | Persist-before-broadcast pattern via `DB::afterCommit` | Immediate broadcast before commit | Prevents race condition where mobile clients receive socket event and query API before DB transaction commits, resulting in 404 or missing items. Prevents phantom alerts on transaction rollback. |
| D-03 | Batch chunked database inserts (100/chunk) for company-wide releases | Individual record insert loop | Inserting 1,000 notifications in a loop during payroll closing causes HTTP 504 gateway timeouts and database lock contention. |
| D-04 | Chat reaction coalescing within 3-minute window | Separate notification for every reaction | Prevents notification inbox flooding and alert fatigue during active discussions. |
| D-05 | Mandatory delivery enforcement for statutory HR notices (`is_mandatory = 1`) | Allow users to disable all categories | Philippine labor compliance requires documented Notice to Explain (NTE) and disciplinary delivery; users must not be permitted to opt out. |
| D-06 | Explicit separation of Payroll Processing vs. Payslip Release | Single generic payroll notification | Payroll calculation completion is an internal administrative milestone; employees should only be notified when their individual payslip is officially released. |
| D-07 | Shared Web and Mobile UI Design Language & Components | Ad-hoc divergent mobile and web designs | Ensures seamless multi-device continuity so users experience the exact same category tabs, priority borders, and layout concepts whether on mobile or desktop. |

### Open Questions

| ID | Question | Owner | Blocks |
| --- | --- | --- | --- |
| Q-01 | Should mobile app background push notifications (APNs / FCM) be dispatched directly by Laravel or queued for a dedicated push microservice? | Tech Lead | N/A (Handled in future ticket T00004; in-app backend architecture is decoupled) |

---

## 17. Change Log

| Version | Date | Type | Change | Reason / Impact | Changed Sections |
| --- | --- | --- | --- | --- | --- |
| 1.0 | 2026-10-02 | Initial | Initial draft of centralized notification spec | Baseline notification concepts | All |
| 2.0 | 2026-10-14 | Major | Complete specification regeneration covering entire HRMS | Standardized to feature-specification template; added Notification Settings, missing attendance eligibility engine, role-based recipient resolution, all 6 portals, and mobile/web UX flows | All (§1–§16) |
| 2.1 | 2026-10-14 | Minor | Enforce strict Web & Mobile visual concept parity, explicit separation of Payroll Processing vs. Payslip Release, detailed 6-portal Recipient Routing Matrix, and Mandatory Compliance Guard | Addresses user feedback: unified web/mobile card anatomy and category filters, decoupled payroll processing completion from employee payslip release, explicit attendance exclusions (shift, leave, holiday, rest day, OBT), and mandatory alert protection | §1, §2, §3, §6, §7 (new), §9, §11, §16 |
| 2.1 | 2026-10-15 | Minor | Review findings recorded — /webkit-fix T00002 --design-review (run v1): #1–#9 | Visual-layer contrast rules found by the design review are noted as constraints on the existing UI; no requirement changed | §15 |
