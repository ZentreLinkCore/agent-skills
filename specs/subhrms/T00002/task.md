# Task Tracker — Centralized HRMS Notification Center and Settings

## Metadata

| Field | Value |
| --- | --- |
| Ticket | T00002 (subhrms) |
| Feature | Centralized HRMS Notification Center and Settings |
| Branch | `T00002` |
| Spec | [specs.md](./specs.md) — version 2.1, status In Review |
| Plan | [plan.md](./plan.md) — revision 2, status Ready |
| Last Updated | 2026-10-14 by `/webkit-specify` |

---

## 1. Progress

| Stage | File | Last Run | Result |
| --- | --- | --- | --- |
| Specify | specs.md · plan.md | 2026-10-14 | Spec v2.1 In Review · plan rev 2, 24 tasks |
| Implement | plan.md | — | 0/24 tasks |
| Verify | verify.md | — | — |
| Code review | code-review.md | — | — |
| Design review | design-review.md | — | — |
| Fix | — | — | — |

**Done:** 0/24 tasks · 0/0 required findings fixed

**Next step:** `/webkit-implement T00002`

---

## 2. Plan Tasks

### Preparation

- [ ] TASK-01 — Create notifications table migration
- [ ] TASK-02 — Create notification_settings table migration
- [ ] TASK-03 — Create notification_preferences table migration

### Backend

- [ ] TASK-04 — Implement Notification Eloquent Model
- [ ] TASK-05 — Implement NotificationSetting and NotificationPreference Models
- [ ] TASK-06 — Implement Notification Broadcast Events
- [ ] TASK-07 — Implement BroadcastNotificationAction
- [ ] TASK-08 — Implement CreateNotificationAction and CreateBatchNotificationsAction
- [ ] TASK-09 — Implement ResolveNotificationRecipientsAction
- [ ] TASK-10 — Implement CheckMissingAttendanceAction
- [ ] TASK-11 — Implement Queries: GetNotificationsQuery, GetNotificationCountQuery, GetNotificationSettingsQuery
- [ ] TASK-12 — Implement Handlers: MarkRead, MarkAllRead, Dismiss, UpdateSettings, UpdatePreferences
- [ ] TASK-13 — Implement NotificationsController and Register API Routes
- [ ] TASK-14 — Implement Scheduled Console Commands
- [ ] TASK-15 — Wire Domain Handlers to Dispatch Notifications (Decoupled Payroll & Approvals)

### Frontend Integration

- [ ] TASK-16 — Implement Web TypeScript Types, API client, and Pinia Store
- [ ] TASK-17 — Update Web Navbar Header with Live Notification Dropdown
- [ ] TASK-18 — Implement Web Full Notification Center Page
- [ ] TASK-19 — Implement Web Notification Settings Page
- [ ] TASK-20 — Implement Mobile TypeScript Contracts and API Layer
- [ ] TASK-21 — Implement Mobile NotificationContext and useNotifications Hook
- [ ] TASK-22 — Integrate Mobile Header and Notification Item Card
- [ ] TASK-23 — Implement Mobile NotificationsScreen and NotificationSettingsScreen

### Validation

- [ ] TASK-24 — Full Acceptance Walk & End-to-End Regression Suite

---

## 3. Findings to Fix

None yet.

**Optional, not scheduled:** None

---

## 4. Waiting On

- Commands for the User: `php artisan migrate` after TASK-03.
- Q-01 — Should mobile app background push notifications (APNs / FCM) be dispatched directly by Laravel or queued for a dedicated push microservice? — Non-blocking (deferred to T00004).

---

## 5. Activity Log

- 2026-10-14 · `/webkit-specify T00002` · Updated spec v2.1 and plan rev 2: enforced Web & Mobile conceptual parity, decoupled payroll processing vs. payslip release, schedule eligibility engine exclusions, and mandatory compliance guard · spec In Review
- 2026-10-14 · `/webkit-specify T00002` · Regenerated spec v2.0 and plan rev 1 (24 tasks, 44 files) · spec In Review
