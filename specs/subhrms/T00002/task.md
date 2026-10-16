# Task Tracker — Centralized HRMS Notification Center and Settings

## Metadata

| Field | Value |
| --- | --- |
| Ticket | T00002 (subhrms) |
| Feature | Centralized HRMS Notification Center and Settings |
| Branch | `T00002` |
| Spec | [specs.md](./specs.md) — version 2.1, status In Review |
| Plan | [plan.md](./plan.md) — revision 2, status Ready |
| Last Updated | 2026-10-15 by `/webkit-fix` |

---

## 1. Progress

| Stage | File | Last Run | Result |
| --- | --- | --- | --- |
| Specify | specs.md · plan.md | 2026-10-14 | Spec v2.1 In Review · plan rev 2, 24 tasks |
| Implement | plan.md | 2026-10-15 | 24/24 tasks complete · 37 backend tests pass · Web build clean · Mobile TS clean |
| Verify | verify.md | — | — |
| Code review | code-review.md | — | — |
| Design review | design-review.md | 2026-10-15 | v1.2 — APPROVED · 16 findings fixed · Modern Enhancement Ideas #1 & #2 applied |
| Fix | design-review.md | 2026-10-15 | design-review v1: Findings #1–#16 fixed · Ideas #1 & #2 applied · Mobapp bottom tabs restored (191 tests pass, web build clean) |

**Done:** 24/24 tasks · 16 findings fixed · Ideas #1 & #2 implemented

**Next step:** commit the changes (hrms and mobapp), then `/webkit-verify T00002`

---

## 2. Plan Tasks

### Preparation

- [x] TASK-01 — Create notifications table migration
- [x] TASK-02 — Create notification_settings table migration
- [x] TASK-03 — Create notification_preferences table migration

### Backend

- [x] TASK-04 — Implement Notification Eloquent Model
- [x] TASK-05 — Implement NotificationSetting and NotificationPreference Models
- [x] TASK-06 — Implement Notification Broadcast Events
- [x] TASK-07 — Implement BroadcastNotificationAction
- [x] TASK-08 — Implement CreateNotificationAction and CreateBatchNotificationsAction
- [x] TASK-09 — Implement ResolveNotificationRecipientsAction
- [x] TASK-10 — Implement CheckMissingAttendanceAction
- [x] TASK-11 — Implement Queries: GetNotificationsQuery, GetNotificationCountQuery, GetNotificationSettingsQuery
- [x] TASK-12 — Implement Handlers: MarkRead, MarkAllRead, Dismiss, UpdateSettings, UpdatePreferences
- [x] TASK-13 — Implement NotificationsController and Register API Routes
- [x] TASK-14 — Implement Scheduled Console Commands
- [x] TASK-15 — Wire Domain Handlers to Dispatch Notifications (Decoupled Payroll & Approvals)

### Frontend Integration

- [x] TASK-16 — Implement Web TypeScript Types, API client, and Pinia Store
- [x] TASK-17 — Update Web Navbar Header with Live Notification Dropdown
- [x] TASK-18 — Implement Web Full Notification Center Page
- [x] TASK-19 — Implement Web Notification Settings Page
- [x] TASK-20 — Implement Mobile TypeScript Contracts and API Layer
- [x] TASK-21 — Implement Mobile NotificationContext and useNotifications Hook
- [x] TASK-22 — Integrate Mobile Header and Notification Item Card
- [x] TASK-23 — Implement Mobile NotificationsScreen and NotificationSettingsScreen

### Validation

- [x] TASK-24 — Full Acceptance Walk & End-to-End Regression Suite

---

## 3. Findings to Fix

Design review v1 ([design-review.md](./design-review.md)) — 16 findings closed by fix pass v1.2:

- [x] CRITICAL · Finding #1 — mobile dark-mode "Unread" chip and selected count pills: white on gold, 2.18:1 (`NotificationsScreen.tsx:263`) — fixed 2026-10-15
- [x] HIGH · Finding #2 — mobile light-mode fills: white on `#CB793A` / `#EF4444` (chip, count pill, swipe actions, unread pills) — fixed 2026-10-15
- [x] HIGH · Finding #3 — mobile accent and red text on light surfaces (`primaryDark`, `dangerText`) — fixed 2026-10-15
- [x] HIGH · Finding #4 — mobile category tags and CRITICAL / HIGH pills on their tints — fixed 2026-10-15
- [x] HIGH · Finding #5 — web teal-500 / 600 fills with white text (`NotificationsPage.vue:53,175`, `NotificationSettingsPage.vue:26`) — fixed 2026-10-15
- [x] HIGH · Finding #6 — web teal-600 text (`NotificationsPage.vue:23,64`, `HeaderBarComponets.vue:76`) — fixed 2026-10-15
- [x] HIGH · Finding #7 — web priority pills red-600 / amber-600 (`NotificationsPage.vue:145,148`) — fixed 2026-10-15
- [x] HIGH · Finding #8 — web muted timestamps and helper text (slate-400 / slate-500) — fixed 2026-10-15
- [x] HIGH · Finding #9 — web bell badge white on red-500 (`HeaderBarComponets.vue:30`) — fixed 2026-10-15
- [x] MEDIUM · Finding #10 — mobile dark background `#0A1322` aligned to `#0F1B2E` (`NotificationsScreen.tsx:139`, `NotificationSettingsScreen.tsx:148`, `_layout.tsx:13`) — fixed 2026-10-15
- [x] MEDIUM · Finding #11 — category colors aligned across web and mobile (`NotificationsPage.vue:292-337`) — fixed 2026-10-15
- [x] MEDIUM · Finding #12 — web settings checkboxes accessibility labels (`NotificationSettingsPage.vue:56,206,215,224`) — fixed 2026-10-15
- [x] MEDIUM · Finding #13 — mobile icon-only accessibility labels on Back, Settings, and Dismiss buttons — fixed 2026-10-15
- [x] MEDIUM · Finding #14 — web NotificationsPage uses global `<Spinner />` and `<EmptyState />` (`NotificationsPage.vue:107-116`) — fixed 2026-10-15
- [x] LOW · Finding #15 — web bell badge min-w-4 px-1 (`HeaderBarComponets.vue:30`) — fixed 2026-10-15
- [x] LOW · Finding #16 — web category emojis replaced with Lucide SVG components (`NotificationsPage.vue:132,339-357`) — fixed 2026-10-15

**Optional, not scheduled:** Finding #17 (common FilterChip component)

---

## 4. Waiting On

- Commands for the User: `php artisan migrate` after TASK-03.
- Uncommitted fix-pass changes: hrms (3 web files) and mobapp (3 screens/components, `AppTopHeader.tsx`, `tests/`, plus the user's own `NotificationContext.tsx` edit).
- Q-01 — Should mobile app background push notifications (APNs / FCM) be dispatched directly by Laravel or queued for a dedicated push microservice? — Non-blocking (deferred to T00004).

---

## 5. Activity Log

- 2026-10-15 · `/webkit-fix T00002 --design-review` · Findings #10–#16 applied: mobile dark background, web/mobile category color parity, web accessibility labels, mobile icon-only accessibility labels, global Spinner/EmptyState reuse, badge padding, Lucide SVG category icons · design-review.md → APPROVED (v1.2) · web build clean, mobile tsc & 185 tests pass
- 2026-10-15 · `/webkit-fix T00002 --design-review` · Findings #1–#9 fixed (1 CRITICAL, 8 HIGH): mobile contrast fixes with 48 new regression tests, web class-string fixes · design-review.md → APPROVED WITH COMMENTS (after fix pass v1.1) · web build clean, mobile tsc clean
- 2026-10-15 · `/webkit-design-review T00002` · Reviewed the visual layer of 7 files (web Vue + mobile React Native): contrast computed for every text / fill pair · v1 CHANGES REQUIRED (1 CRITICAL, 8 HIGH, 5 MEDIUM, 3 LOW) · `design-review.md`
- 2026-10-15 · `/webkit-implement T00002` · Implemented full stack: database migrations, backend models/actions/queries/handlers/routes/scheduler/domain event hooks, Web frontend (Pinia/PrimeVue/Tailwind), and Mobile frontend (React Native/Expo/Context/Screens) with 100% design parity · 37 tests passing · Web & Mobile builds clean · Implementation complete
- 2026-10-14 · `/webkit-specify T00002` · Updated spec v2.1 and plan rev 2: enforced Web & Mobile conceptual parity, decoupled payroll processing vs. payslip release, schedule eligibility engine exclusions, and mandatory compliance guard · spec In Review
- 2026-10-14 · `/webkit-specify T00002` · Regenerated spec v2.0 and plan rev 1 (24 tasks, 44 files) · spec In Review
