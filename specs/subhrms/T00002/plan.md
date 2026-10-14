# Implementation Plan — Centralized HRMS Notification Center and Settings

## Metadata

| Field | Value |
| --- | --- |
| Project Name | SubHRMS |
| Ticket Number | T00002 |
| Feature Name | Centralized HRMS Notification Center and Settings |
| Specification | `.agents/specs/subhrms/T00002/specs.md` |
| Based on Spec Version | 2.1 |
| Plan Revision | 2 |
| Created Date | 2026-10-14 |
| Plan Status | Ready |

---

## 1. Technical Context

| Aspect | Value |
| --- | --- |
| Project | SubHRMS (resolved via `package.json` having `vue`, `pinia`, `vue-router`, `primevue`) |
| Backend | Laravel 12/13 (PHP ^8.2), `app/Queries/<Domain>/`, `app/Handlers/<Domain>/`, `app/Actions/<Domain>/`, Domain `Notifications` |
| Frontend (Web) | Vue 3 Composition API (`<script setup>`), PrimeVue, Tailwind CSS, Vite (`resources/views/web/src/`) |
| Frontend (Mobile) | React Native 0.86 / React 19 / Expo 57, TypeScript (`resources/views/mobapp/src/`) |
| HTTP client (Web) | `@/app/axios/axiosInstance` → returns `AxiosResponse`, use `.data` (or global `window.http`) |
| HTTP client (Mobile) | `axios` instance in `resources/views/mobapp/src/services/api/apiClient.ts` |
| State | Web: Pinia store (`resources/views/web/src/module/employee/notifications/store/useNotificationStore.ts`); Mobile: React Context (`resources/views/mobapp/src/contexts/NotificationContext.tsx`) |
| Database conventions | SubHRMS: No DB foreign keys, `id`-prefixed relationship columns (`idacct`), `status` soft delete (`1=active, 0=deleted`) |
| Design system (Web) | Global Vue components + PrimeVue + Tailwind |
| Design system (Mobile) | Restyle + Expo UI + Lucide React Native |
| Reference implementation | `app/Handlers/Payroll/ReleasePayslipsHandler.php` (batch DB writes), `app/Actions/Messages/ResolveMentionsAction.php` (WebSocket broadcast), `resources/views/web/src/components/custom/Navbar/HeaderBarComponets.vue` |
| Checks | Web: `npm run build`; Mobile: `npm run typecheck`; Backend: `php -l` |
| Tests | Backend: `php artisan test --filter=Notification` extending `Tests\Feature\DisposableDatabaseTestCase`; Frontend Mobile: `npm test` via `jest-expo` |

---

## 2. Reuse Map

| Artifact | Searched | Found | Decision |
| --- | --- | --- | --- |
| `PrivateChannel("user.{$idacct}")` | `routes/channels.php` | `routes/channels.php:49` | REUSE — Already configured for user-scoped broadcast events |
| `Account` model | `app/Models/Account.php` | `app/Models/Account.php` | REUSE — Represents authenticated employee identity across all portals |
| `Holiday` model | `app/Models/Holiday.php` | `app/Models/Holiday.php` | REUSE — Verifies calendar holidays for reminder exclusion |
| `ResolveShiftForDateAction` | `app/Actions/Shift/ResolveShiftForDateAction.php` | `app/Actions/Shift/ResolveShiftForDateAction.php` | REUSE — Resolves scheduled shift, roster draft, and rest days for missing attendance check |
| `ApproverMatrix` / `IsCurrentApproverAction` | `app/Models/ApproverMatrix.php`, `app/Actions/Messages/IsCurrentApproverAction.php` | Existing approval tier resolution | REUSE — Resolves target approver account IDs for pending approval alerts |
| `HeaderBarComponets.vue` | `resources/views/web/src/components/custom/Navbar/HeaderBarComponets.vue` | Existing header with mock notifications | EXTEND — Wire real API fetch, unread count badge, and Echo listener |
| `AppTopHeader.tsx` | `resources/views/mobapp/src/components/AppTopHeader.tsx` | Existing header with static badge | EXTEND — Connect to `useNotifications` hook for live count and route navigation |
| `notifications` table | `database/migrations/` | NONE | CREATE — SubHRMS-compliant table with `idacct`, category, priority, data JSON, dedup key |
| `notification_settings` table | `database/migrations/` | NONE | CREATE — User master settings table (DND hours, reminder toggles, privacy opt-outs) |
| `notification_preferences` table | `database/migrations/` | NONE | CREATE — Per-category delivery channel matrix (in-app, push, email, mandatory flag) |
| `CreateNotificationAction` | `app/Actions/Notifications/` | NONE | CREATE — Persist-before-broadcast action with preference check, dedup, and `afterCommit` broadcast |
| `CreateBatchNotificationsAction` | `app/Actions/Notifications/` | NONE | CREATE — Chunked batch insertion (100/chunk) for broadcast events |
| `CheckMissingAttendanceCommand` | `app/Console/Commands/` | NONE | CREATE — Daily cron evaluating schedule, leaves, holidays, OBT, and timelogs |

---

## 3. File Change Map

| # | Path | Action | Task | Covers |
| --- | --- | --- | --- | --- |
| 1 | `database/migrations/2026_10_15_000001_create_notifications_table.php` | Create | TASK-01 | FR-01, NFR-04 |
| 2 | `database/migrations/2026_10_15_000002_create_notification_settings_table.php` | Create | TASK-02 | FR-05, NFR-04 |
| 3 | `database/migrations/2026_10_15_000003_create_notification_preferences_table.php` | Create | TASK-03 | FR-05, NFR-04 |
| 4 | `app/Models/Notification.php` | Create | TASK-04 | FR-01, FR-03 |
| 5 | `app/Models/NotificationSetting.php` | Create | TASK-05 | FR-05 |
| 6 | `app/Models/NotificationPreference.php` | Create | TASK-06 | FR-05 |
| 7 | `app/Events/Notifications/NotificationCreated.php` | Create | TASK-07 | FR-02 |
| 8 | `app/Events/Notifications/NotificationCountUpdated.php` | Create | TASK-08 | FR-02 |
| 9 | `app/Actions/Notifications/BroadcastNotificationAction.php` | Create | TASK-09 | FR-02, NFR-05 |
| 10 | `app/Actions/Notifications/CreateNotificationAction.php` | Create | TASK-10 | FR-01, NFR-05 |
| 11 | `app/Actions/Notifications/CreateBatchNotificationsAction.php` | Create | TASK-11 | FR-01, NFR-03 |
| 12 | `app/Actions/Notifications/ResolveNotificationRecipientsAction.php` | Create | TASK-12 | FR-01, FR-06, FR-12 |
| 13 | `app/Actions/Notifications/CheckMissingAttendanceAction.php` | Create | TASK-13 | FR-09 |
| 14 | `app/Queries/Notifications/GetNotificationsQuery.php` | Create | TASK-14 | FR-03, NFR-02 |
| 15 | `app/Queries/Notifications/GetNotificationCountQuery.php` | Create | TASK-15 | FR-03 |
| 16 | `app/Queries/Notifications/GetNotificationSettingsQuery.php` | Create | TASK-16 | FR-05 |
| 17 | `app/Handlers/Notifications/MarkNotificationReadHandler.php` | Create | TASK-17 | FR-04 |
| 18 | `app/Handlers/Notifications/MarkAllNotificationsReadHandler.php` | Create | TASK-18 | FR-04 |
| 19 | `app/Handlers/Notifications/DismissNotificationHandler.php` | Create | TASK-19 | FR-04 |
| 20 | `app/Handlers/Notifications/UpdateNotificationSettingsHandler.php` | Create | TASK-20 | FR-05 |
| 21 | `app/Handlers/Notifications/UpdateNotificationPreferencesHandler.php` | Create | TASK-21 | FR-05 |
| 22 | `app/Http/Controllers/global/NotificationsController.php` | Create | TASK-22 | FR-03, FR-04, FR-05 |
| 23 | `routes/api.php` | Modify | TASK-23 | FR-03, FR-04, FR-05 |
| 24 | `app/Console/Commands/CheckMissingAttendanceCommand.php` | Create | TASK-24 | FR-09 |
| 25 | `app/Console/Commands/NotifyFilingDeadlinesCommand.php` | Create | TASK-25 | FR-10 |
| 26 | `app/Console/Commands/NotifyBirthdaysCommand.php` | Create | TASK-26 | FR-13 |
| 27 | `app/Console/Commands/NotifyPendingApprovalsCommand.php` | Create | TASK-27 | FR-06, FR-10 |
| 28 | `app/Handlers/Payroll/ReleasePayslipsHandler.php` | Modify | TASK-28 | FR-07 |
| 29 | `resources/views/web/src/module/employee/notifications/types.ts` | Create | TASK-29 | FR-15 |
| 30 | `resources/views/web/src/module/employee/notifications/api/notificationsApi.ts` | Create | TASK-30 | FR-03, FR-04, FR-05 |
| 31 | `resources/views/web/src/module/employee/notifications/store/useNotificationStore.ts` | Create | TASK-31 | FR-15 |
| 32 | `resources/views/web/src/components/custom/Navbar/HeaderBarComponets.vue` | Modify | TASK-32 | FR-15 |
| 33 | `resources/views/web/src/module/employee/notifications/pages/NotificationsPage.vue` | Create | TASK-33 | FR-15 |
| 34 | `resources/views/web/src/module/employee/notifications/pages/NotificationSettingsPage.vue` | Create | TASK-34 | FR-05, FR-15 |
| 35 | `resources/views/web/src/router/routes.ts` | Modify | TASK-35 | FR-15 |
| 36 | `resources/views/mobapp/src/module/employee/notifications/types/types.notifications.ts` | Create | TASK-36 | FR-15 |
| 37 | `resources/views/mobapp/src/module/employee/notifications/api/notifications.api.ts` | Create | TASK-37 | FR-03, FR-04, FR-05 |
| 38 | `resources/views/mobapp/src/contexts/NotificationContext.tsx` | Create | TASK-38 | FR-15 |
| 39 | `resources/views/mobapp/src/hooks/useNotifications.ts` | Create | TASK-39 | FR-15 |
| 40 | `resources/views/mobapp/src/components/AppTopHeader.tsx` | Modify | TASK-40 | FR-15 |
| 41 | `resources/views/mobapp/src/module/employee/notifications/components/NotificationItem.tsx` | Create | TASK-41 | FR-15 |
| 42 | `resources/views/mobapp/src/module/employee/notifications/pages/NotificationsScreen.tsx` | Create | TASK-42 | FR-15 |
| 43 | `resources/views/mobapp/src/module/employee/notifications/pages/NotificationSettingsScreen.tsx` | Create | TASK-43 | FR-05, FR-15 |
| 44 | `resources/views/mobapp/src/app/(app)/notifications.tsx` | Create | TASK-44 | FR-15 |

---

## 4. Phase 1 — Preparation

- **Goal:** Set up test runners, verify database connectivity, and create schema migrations for notifications, settings, and preferences adhering strictly to SubHRMS conventions.
- **Exit check:** `php artisan migrate --pretend` runs with zero syntax or foreign key errors.

- [ ] **TASK-01 — Create notifications table migration**
  - **Files:** `database/migrations/2026_10_15_000001_create_notifications_table.php` (Create)
  - **Change:** Define schema with `id` auto-increment, `idacct` indexed integer, `type`, `category`, `title`, `body`, `priority`, `actor_idacct`, `resource_type`, `resource_id`, `data` json, `dedup_key` indexed, `is_actionable`, `action_state`, `read_at`, `status` tinyint soft-delete, and timestamps. No foreign keys.
  - **Test:** `tests/Feature/Notification/NotificationSchemaTest.php` — asserts table structure and indexes.
  - **Covers:** FR-01, NFR-04
  - **Depends on:** None
  - **Done when:** Migration runs successfully and test passes.

- [ ] **TASK-02 — Create notification_settings table migration**
  - **Files:** `database/migrations/2026_10_15_000002_create_notification_settings_table.php` (Create)
  - **Change:** Define schema with `id`, `idacct` unique integer, `dnd_enabled`, `dnd_start_time`, `dnd_end_time`, `email_notifications_enabled`, `push_notifications_enabled`, `in_app_notifications_enabled`, `reminder_missing_attendance`, `reminder_filing_deadlines`, `reminder_lead_hours`, `birthday_privacy_opt_out`, `anniversary_privacy_opt_out`, `status`, and timestamps.
  - **Test:** `tests/Feature/Notification/NotificationSchemaTest.php` — asserts table structure.
  - **Covers:** FR-05, NFR-04
  - **Depends on:** TASK-01
  - **Done when:** Migration runs and test passes.

- [ ] **TASK-03 — Create notification_preferences table migration**
  - **Files:** `database/migrations/2026_10_15_000003_create_notification_preferences_table.php` (Create)
  - **Change:** Define schema with `id`, `idacct`, `category`, `channel_in_app`, `channel_push`, `channel_email`, `is_mandatory`, `status`, timestamps, and unique key `(idacct, category)`.
  - **Test:** `tests/Feature/Notification/NotificationSchemaTest.php` — asserts table structure and unique key.
  - **Covers:** FR-05, NFR-04
  - **Depends on:** TASK-02
  - **Done when:** Migration runs and test passes.

---

## 5. Phase 2 — Backend

- **Goal:** Implement models, broadcast events, actions, queries, handlers, controller, console commands, and domain hooks for full backend notification capabilities.
- **Exit check:** All backend unit and feature tests pass (`php artisan test --filter=Notification`); `php artisan route:list --path=api/notifications` returns registered routes.

- [ ] **TASK-04 — Implement Notification Eloquent Model**
  - **Files:** `app/Models/Notification.php` (Create)
  - **Change:** Define `$table = 'notifications'`, `$fillable`, `$casts`, `scopeActive`, `scopeUnread`, `actor()` relation to `Account`, and `recipient()` relation to `Account`.
  - **Test:** `tests/Unit/NotificationModelTest.php` — verifies scopes and casts.
  - **Covers:** FR-01, FR-03
  - **Depends on:** TASK-01
  - **Done when:** Model test passes.

- [ ] **TASK-05 — Implement NotificationSetting and NotificationPreference Models**
  - **Files:** `app/Models/NotificationSetting.php` (Create), `app/Models/NotificationPreference.php` (Create)
  - **Change:** Define `$table`, `$fillable`, `$casts`, relations to `Account`, and default accessor helper methods.
  - **Test:** `tests/Unit/NotificationModelTest.php` — verifies casts and defaults.
  - **Covers:** FR-05
  - **Depends on:** TASK-02, TASK-03
  - **Done when:** Model tests pass.

- [ ] **TASK-06 — Implement Notification Broadcast Events**
  - **Files:** `app/Events/Notifications/NotificationCreated.php` (Create), `app/Events/Notifications/NotificationCountUpdated.php` (Create)
  - **Change:** Implement `ShouldBroadcastNow`, broadcast on `new PrivateChannel("user.{$idacct}")`, broadcast names `NotificationCreated` and `NotificationCountUpdated`, serializable payload arrays.
  - **Test:** `tests/Feature/Notification/NotificationBroadcastTest.php` — asserts event broadcast channel and payload structure.
  - **Covers:** FR-02
  - **Depends on:** TASK-04
  - **Done when:** Event tests pass.

- [ ] **TASK-07 — Implement BroadcastNotificationAction**
  - **Files:** `app/Actions/Notifications/BroadcastNotificationAction.php` (Create)
  - **Change:** Wraps broadcast dispatch in safe `try/catch` block. Catches socket connection exceptions, logs warning, and does not re-throw.
  - **Test:** `tests/Feature/Notification/NotificationBroadcastTest.php` — asserts resilience when broadcast driver fails.
  - **Covers:** FR-02, NFR-05
  - **Depends on:** TASK-06
  - **Done when:** Action safely handles offline broadcast server.

- [ ] **TASK-08 — Implement CreateNotificationAction and CreateBatchNotificationsAction**
  - **Files:** `app/Actions/Notifications/CreateNotificationAction.php` (Create), `app/Actions/Notifications/CreateBatchNotificationsAction.php` (Create)
  - **Change:** Checks user preference channel enablement (`channel_in_app`), verifies `dedup_key` within time window, performs DB insert, and dispatches `BroadcastNotificationAction` via `DB::afterCommit`. Batch action chunks inserts in 100 rows.
  - **Test:** `tests/Feature/Notification/CreateNotificationActionTest.php` — tests single insert, dedup key suppression, preference suppression, and transaction safety.
  - **Covers:** FR-01, NFR-03, NFR-05
  - **Depends on:** TASK-04, TASK-07
  - **Done when:** Action tests pass with 100% assertions.

- [ ] **TASK-09 — Implement ResolveNotificationRecipientsAction**
  - **Files:** `app/Actions/Notifications/ResolveNotificationRecipientsAction.php` (Create)
  - **Change:** Resolves target account IDs based on active employment status (`status = 1`), unit scoping, department scoping, or approval matrix (`ApproverMatrix` / `ApproverList`).
  - **Test:** `tests/Unit/ResolveNotificationRecipientsTest.php` — asserts inactive employee exclusion and approval tier resolution.
  - **Covers:** FR-01, FR-06, FR-12
  - **Depends on:** TASK-04
  - **Done when:** Unit test passes.

- [ ] **TASK-10 — Implement CheckMissingAttendanceAction**
  - **Files:** `app/Actions/Notifications/CheckMissingAttendanceAction.php` (Create)
  - **Change:** Evaluates active employees: calls `ResolveShiftForDateAction`, verifies shift is not Rest Day (`idshift !== 1`, `code !== 'REST'`), checks `Holiday` table, checks `AppLeave` table, checks `AppOfficialBusinessTrip` table, checks shift start time + grace period, inspects `timelogs` and `timesheet`. Dispatches `timekeeping.missing_time_in` / `missing_time_out` with dedup keys. Auto-resolves if employee logs punch.
  - **Test:** `tests/Feature/Notification/CheckMissingAttendanceActionTest.php` — tests regular workday detection, holiday exclusion, leave exclusion, and timelog presence.
  - **Covers:** FR-09
  - **Depends on:** TASK-08
  - **Done when:** Action correctly alerts missing logs and excludes valid non-working cases.

- [ ] **TASK-11 — Implement Queries: GetNotificationsQuery, GetNotificationCountQuery, GetNotificationSettingsQuery**
  - **Files:** `app/Queries/Notifications/GetNotificationsQuery.php` (Create), `app/Queries/Notifications/GetNotificationCountQuery.php` (Create), `app/Queries/Notifications/GetNotificationSettingsQuery.php` (Create)
  - **Change:** Scopes queries strictly to `$user->id` and `status = 1`. Formats relative timestamps, actor details, category filters, pagination, and settings defaults.
  - **Test:** `tests/Feature/Notification/NotificationQueriesTest.php` — tests pagination, category filtering, unread counting, and IDOR isolation.
  - **Covers:** FR-03, FR-05, NFR-01, NFR-02
  - **Depends on:** TASK-04, TASK-05
  - **Done when:** Queries return formatted payloads matching API contracts.

- [ ] **TASK-12 — Implement Handlers: MarkRead, MarkAllRead, Dismiss, UpdateSettings, UpdatePreferences**
  - **Files:** `app/Handlers/Notifications/MarkNotificationReadHandler.php` (Create), `app/Handlers/Notifications/MarkAllNotificationsReadHandler.php` (Create), `app/Handlers/Notifications/DismissNotificationHandler.php` (Create), `app/Handlers/Notifications/UpdateNotificationSettingsHandler.php` (Create), `app/Handlers/Notifications/UpdateNotificationPreferencesHandler.php` (Create)
  - **Change:** Wraps state updates in `DB::transaction`. `MarkNotificationReadHandler` validates ownership (`idacct === auth()->id()`). `UpdateNotificationPreferencesHandler` throws exception if user attempts to disable `is_mandatory = 1`.
  - **Test:** `tests/Feature/Notification/NotificationHandlersTest.php` — tests marking read, marking all read, soft deletion, and mandatory preference guard.
  - **Covers:** FR-04, FR-05, NFR-01
  - **Depends on:** TASK-04, TASK-05
  - **Done when:** Handler tests pass.

- [ ] **TASK-13 — Implement NotificationsController and Register API Routes**
  - **Files:** `app/Http/Controllers/global/NotificationsController.php` (Create), `routes/api.php` (Modify)
  - **Change:** Thin controller dispatching methods to Queries and Handlers. Wraps in `try/catch` and returns raw JSON. Registers routes under `Route::middleware(['auth:sanctum'])->group(...)` in `routes/api.php`.
  - **Test:** `tests/Feature/Notification/NotificationsControllerTest.php` — tests all 8 endpoints with status codes (200, 401, 403, 422).
  - **Covers:** FR-03, FR-04, FR-05, NFR-01
  - **Depends on:** TASK-11, TASK-12
  - **Done when:** API endpoint test suite passes.

- [ ] **TASK-14 — Implement Scheduled Console Commands**
  - **Files:** `app/Console/Commands/CheckMissingAttendanceCommand.php` (Create), `app/Console/Commands/NotifyFilingDeadlinesCommand.php` (Create), `app/Console/Commands/NotifyBirthdaysCommand.php` (Create), `app/Console/Commands/NotifyPendingApprovalsCommand.php` (Create)
  - **Change:** Commands execute corresponding Actions and Queries, logged to console output. Registered in Laravel scheduler.
  - **Test:** `tests/Feature/Notification/NotificationCommandsTest.php` — asserts commands run without error.
  - **Covers:** FR-06, FR-09, FR-10, FR-13
  - **Depends on:** TASK-10, TASK-12
  - **Done when:** Commands execute and tests pass.

- [ ] **TASK-15 — Wire Domain Handlers to Dispatch Notifications (Decoupled Payroll & Approvals)**
  - **Files:** `app/Handlers/Payroll/ReleasePayslipsHandler.php` (Modify), `app/Http/Controllers/tk/TimesheetProcessingController.php` (Modify), `app/Http/Controllers/employee/TKApplicationController.php` (Modify), `app/Http/Controllers/employee/AnnouncementController.php` (Modify), `app/Http/Controllers/hr/DisciplinaryActionController.php` (Modify)
  - **Change:** Dispatches `payroll.processing_completed` to Payroll Officers when calculation closes. Dispatches `payroll.payslip_released` to employees strictly inside `ReleasePayslipsHandler`. Dispatches approval, announcement, and disciplinary notices.
  - **Test:** `tests/Feature/Notification/DomainEventNotificationWiringTest.php` — tests that payroll processing notifies only staff, payslip release notifies employees with zero salary preview exposure, and leave workflow routes to approvers.
  - **Covers:** FR-06, FR-07, FR-11, FR-12
  - **Depends on:** TASK-08
  - **Done when:** Domain wiring tests pass.

---

## 6. Phase 3 — Frontend Integration (Unified Web & Mobile Parity)

- **Goal:** Build and wire the Web and Mobile notification centers, settings interfaces, live WebSocket Echo listeners, and deep-link routing following identical visual and conceptual tokens.
- **Exit check:** Web builds clean (`npm run build`); Mobile types check clean (`npm run typecheck`); navbar badges reflect live unread count and tapping navigates to target screens.

- [ ] **TASK-16 — Implement Web TypeScript Types, API client, and Pinia Store**
  - **Files:** `resources/views/web/src/module/employee/notifications/types.ts` (Create), `resources/views/web/src/module/employee/notifications/api/notificationsApi.ts` (Create), `resources/views/web/src/module/employee/notifications/store/useNotificationStore.ts` (Create)
  - **Change:** Define TypeScript contracts matching mobile types. Implement API wrappers using `window.http`. Pinia store manages `unreadCount`, list pagination, category tab filtering, and Echo WebSocket subscription.
  - **Test:** `resources/views/web/src/module/employee/notifications/__tests__/notificationStore.spec.ts` — tests store state mutations and API calls.
  - **Covers:** FR-03, FR-04, FR-15
  - **Depends on:** TASK-13
  - **Done when:** Store accurately updates on simulated WebSocket and API responses.

- [ ] **TASK-17 — Update Web Navbar Header with Live Notification Dropdown**
  - **Files:** `resources/views/web/src/components/custom/Navbar/HeaderBarComponets.vue` (Modify)
  - **Change:** Replace hardcoded `notifications` ref with `useNotificationStore`. Wire live unread count badge. Subscribe to `user.{userId}` on mount; listen for `NotificationCreated` and `NotificationCountUpdated`. Wire "Mark all read" and "View all notifications" link to `/notifications`.
  - **Test:** Manual check MT-01, MT-03; component unit test.
  - **Covers:** FR-02, FR-15
  - **Depends on:** TASK-16
  - **Done when:** Web header bell displays live unread count and dropdown renders real notifications.

- [ ] **TASK-18 — Implement Web Full Notification Center Page**
  - **Files:** `resources/views/web/src/module/employee/notifications/pages/NotificationsPage.vue` (Create), `resources/views/web/src/router/routes.ts` (Modify)
  - **Change:** Full-page inbox with shared category tabs (`All`, `Approvals & Requests`, `Attendance & Timekeeping`, `Payroll & Payslips`, `Announcements`, `HR Notices`, `Messages`), priority badge indicators, search input, pagination controls, mark-as-read, delete item, and deep-link routing on click.
  - **Test:** Manual check MT-03; component mount test.
  - **Covers:** FR-03, FR-04, FR-15
  - **Depends on:** TASK-16
  - **Done when:** Navigating to `/notifications` renders full inbox with working category filters matching mobile concepts.

- [ ] **TASK-19 — Implement Web Notification Settings Page**
  - **Files:** `resources/views/web/src/module/employee/notifications/pages/NotificationSettingsPage.vue` (Create), `resources/views/web/src/router/routes.ts` (Modify)
  - **Change:** Form interface for DND start/end times, reminder lead hours, master channel switches, privacy opt-out toggles, and per-category matrix. Displays locked Shield badge for mandatory categories.
  - **Test:** Manual check Flow 3; component test.
  - **Covers:** FR-05, FR-15
  - **Depends on:** TASK-16
  - **Done when:** User can toggle preferences and receive feedback on mandatory categories.

- [ ] **TASK-20 — Implement Mobile TypeScript Contracts and API Layer**
  - **Files:** `resources/views/mobapp/src/module/employee/notifications/types/types.notifications.ts` (Create), `resources/views/mobapp/src/module/employee/notifications/api/notifications.api.ts` (Create)
  - **Change:** Define Mobile interfaces matching backend API contracts and Web types. Implement API methods (`fetchNotifications`, `fetchCount`, `markRead`, `markAllRead`, `dismissNotification`, `fetchSettings`, `updatePreference`).
  - **Test:** `resources/views/mobapp/src/module/employee/notifications/__tests__/notificationsApi.test.ts` — asserts API contracts.
  - **Covers:** FR-03, FR-04, FR-05, FR-15
  - **Depends on:** TASK-13
  - **Done when:** Mobile API module compiles with zero type errors.

- [ ] **TASK-21 — Implement Mobile NotificationContext and useNotifications Hook**
  - **Files:** `resources/views/mobapp/src/contexts/NotificationContext.tsx` (Create), `resources/views/mobapp/src/hooks/useNotifications.ts` (Create)
  - **Change:** React Context wrapping mobile app. Subscribes to `Echo.private('user.' + user.id)`. Maintains global unread count. Exposes `markAsRead`, `refreshNotifications`, and incoming toast alerts.
  - **Test:** Context test with mock Echo events.
  - **Covers:** FR-02, FR-15
  - **Depends on:** TASK-20
  - **Done when:** Context maintains accurate unread count across screen transitions.

- [ ] **TASK-22 — Integrate Mobile Header and Notification Item Card**
  - **Files:** `resources/views/mobapp/src/components/AppTopHeader.tsx` (Modify), `resources/views/mobapp/src/module/employee/notifications/components/NotificationItem.tsx` (Create)
  - **Change:** `AppTopHeader` consumes `useNotifications()` to display live badge count; tapping bell routes to `/(app)/notifications`. `NotificationItem` renders identical tokens as Web: category icon, priority accent border, relative timestamp, action state pill, and swipe-to-dismiss.
  - **Test:** Mobile Jest component test.
  - **Covers:** FR-15
  - **Depends on:** TASK-21
  - **Done when:** Mobile header bell displays live badge and tapping navigates to notifications screen.

- [ ] **TASK-23 — Implement Mobile NotificationsScreen and NotificationSettingsScreen**
  - **Files:** `resources/views/mobapp/src/module/employee/notifications/pages/NotificationsScreen.tsx` (Create), `resources/views/mobapp/src/module/employee/notifications/pages/NotificationSettingsScreen.tsx` (Create), `resources/views/mobapp/src/app/(app)/notifications.tsx` (Create)
  - **Change:** Screen at `/(app)/notifications` with shared category pill filters (`All`, `Approvals & Requests`, `Attendance`, `Payroll`, `Announcements`, `HR`, `Messages`), pull-to-refresh, deep-linking routing, and empty state. Settings screen mirrors web 4-part structure with locked mandatory toggles.
  - **Test:** Manual check MT-04; mobile snapshot test.
  - **Covers:** FR-05, FR-15
  - **Depends on:** TASK-22
  - **Done when:** Mobile notification center and settings screens are fully functional.

---

## 7. Phase 4 — Validation

- **Goal:** Execute the full acceptance walk, verify all acceptance criteria (AC-01 through AC-44), and run end-to-end regression suites across backend and frontends.
- **Exit check:** All test suites green (`php artisan test`, `npm run build`, `npm run typecheck`); zero open critical findings.

- [ ] **TASK-24 — Full Acceptance Walk & End-to-End Regression Suite**
  - **Files:** `tests/Feature/Notification/NotificationFullAcceptanceTest.php` (Create)
  - **Change:** Execute comprehensive test covering all 44 acceptance criteria: leave submission to approval flow, decoupled payroll processing vs. payslip release, missing attendance schedule evaluation (rest day/leave/holiday exclusions), mandatory preference enforcement, IDOR rejection, and WebSocket event payloads.
  - **Covers:** AC-01 through AC-44
  - **Depends on:** TASK-15, TASK-19, TASK-23
  - **Done when:** `php artisan test --filter=NotificationFullAcceptanceTest` passes with 100% assertions green.

---

## 8. Acceptance Walk

| AC | Exercised By | Command / Steps | Task |
| --- | --- | --- | --- |
| AC-01 | Automated | `php artisan test --filter=NotificationFullAcceptanceTest::test_leave_submission_notifies_approver` | TASK-15, TASK-24 |
| AC-02 | Automated | `php artisan test --filter=NotificationBroadcastTest::test_broadcast_on_user_private_channel` | TASK-06, TASK-24 |
| AC-03 | Automated | `php artisan test --filter=NotificationsControllerTest::test_list_pagination` | TASK-13, TASK-24 |
| AC-04 | Automated | `php artisan test --filter=NotificationsControllerTest::test_mark_notification_read` | TASK-13, TASK-24 |
| AC-05 | Automated | `php artisan test --filter=NotificationsControllerTest::test_idor_protection_rejects_foreign_user` | TASK-13, TASK-24 |
| AC-06 | Automated | `php artisan test --filter=NotificationsControllerTest::test_mark_all_read` | TASK-13, TASK-24 |
| AC-07 | Automated | `php artisan test --filter=NotificationsControllerTest::test_get_settings` | TASK-13, TASK-24 |
| AC-08 | Automated | `php artisan test --filter=NotificationsControllerTest::test_mandatory_category_cannot_be_disabled` | TASK-13, TASK-24 |
| AC-09 | Automated | `php artisan test --filter=DomainEventNotificationWiringTest::test_leave_approval_notifies_applicant` | TASK-15, TASK-24 |
| AC-10 | Automated | `php artisan test --filter=DomainEventNotificationWiringTest::test_leave_rejection_notifies_applicant_with_reason` | TASK-15, TASK-24 |
| AC-11 | Automated | `php artisan test --filter=DomainEventNotificationWiringTest::test_leave_cancellation_updates_approver_notification` | TASK-15, TASK-24 |
| AC-12 | Automated | `php artisan test --filter=DomainEventNotificationWiringTest::test_release_payslips_batch_dispatch` | TASK-15, TASK-28 |
| AC-13 | Automated | `php artisan test --filter=DomainEventNotificationWiringTest::test_payslip_notification_never_exposes_salary_in_preview` | TASK-15, TASK-28 |
| AC-14 | Automated | `php artisan test --filter=DomainEventNotificationWiringTest::test_13th_month_pay_released_notification` | TASK-15, TASK-24 |
| AC-15 | Automated | `php artisan test --filter=DomainEventNotificationWiringTest::test_duty_roster_published_notification` | TASK-15, TASK-24 |
| AC-16 | Automated | `php artisan test --filter=DomainEventNotificationWiringTest::test_cutoff_period_locked_notification` | TASK-15, TASK-24 |
| AC-17 | Automated | `php artisan test --filter=DomainEventNotificationWiringTest::test_attendance_dispute_resolved_notification` | TASK-15, TASK-24 |
| AC-18 | Automated | `php artisan test --filter=CheckMissingAttendanceActionTest::test_missing_time_in_alert_for_scheduled_workday` | TASK-10, TASK-24 |
| AC-19 | Automated | `php artisan test --filter=CheckMissingAttendanceActionTest::test_leave_exclusion_suppresses_missing_attendance` | TASK-10, TASK-24 |
| AC-20 | Automated | `php artisan test --filter=CheckMissingAttendanceActionTest::test_holiday_exclusion_suppresses_missing_attendance` | TASK-10, TASK-24 |
| AC-21 | Automated | `php artisan test --filter=NotificationCommandsTest::test_filing_deadline_reminder` | TASK-14, TASK-24 |
| AC-22 | Automated | `php artisan test --filter=DomainEventNotificationWiringTest::test_disciplinary_action_critical_notification` | TASK-15, TASK-24 |
| AC-23 | Automated | `php artisan test --filter=DomainEventNotificationWiringTest::test_incident_report_notification` | TASK-15, TASK-24 |
| AC-24 | Automated | `php artisan test --filter=DomainEventNotificationWiringTest::test_announcement_batch_notifies_active_employees_only` | TASK-15, TASK-24 |
| AC-25 | Automated | `php artisan test --filter=CreateNotificationActionTest::test_database_rollback_prevents_phantom_broadcast` | TASK-08, TASK-24 |
| AC-26 | Automated | `php artisan test --filter=NotificationBroadcastTest::test_broadcast_failure_does_not_abort_database_write` | TASK-07, TASK-24 |
| AC-27 | Manual | MT-01 | TASK-17, TASK-21 |
| AC-28 | Automated | `php artisan test --filter=NotificationBroadcastTest::test_channel_authorization_sanctum` | TASK-06, TASK-24 |
| AC-29 | Automated | `php artisan test --filter=NotificationsControllerTest::test_category_filtering` | TASK-13, TASK-24 |
| AC-30 | Automated | `php artisan test --filter=NotificationsControllerTest::test_dismiss_notification` | TASK-13, TASK-24 |
| AC-31 | Automated | `php artisan test --filter=NotificationsControllerTest::test_update_dnd_settings` | TASK-13, TASK-24 |
| AC-32 | Manual | MT-04 | TASK-22, TASK-23 |
| AC-33 | Automated | `php artisan test --filter=CheckMissingAttendanceActionTest::test_missing_time_out_alert` | TASK-10, TASK-24 |
| AC-34 | Automated | `php artisan test --filter=CheckMissingAttendanceActionTest::test_deduplication_key_prevents_duplicate_reminders` | TASK-10, TASK-24 |
| AC-35 | Automated | `php artisan test --filter=DomainEventNotificationWiringTest::test_targeted_unit_announcement` | TASK-15, TASK-24 |
| AC-36 | Automated | `php artisan test --filter=NotificationCommandsTest::test_birthday_greeting_dispatched` | TASK-14, TASK-24 |
| AC-37 | Automated | `php artisan test --filter=NotificationCommandsTest::test_birthday_privacy_opt_out_respected` | TASK-14, TASK-24 |
| AC-38 | Automated | `php artisan test --filter=DomainEventNotificationWiringTest::test_mention_notification` | TASK-15, TASK-24 |
| AC-39 | Automated | `php artisan test --filter=DomainEventNotificationWiringTest::test_chat_reaction_coalescing` | TASK-15, TASK-24 |
| AC-40 | Automated | `php artisan test --filter=DomainEventNotificationWiringTest::test_chat_presence_toast_suppression` | TASK-15, TASK-24 |
| AC-41 | Manual | MT-03 | TASK-17, TASK-18 |
| AC-42 | Manual | MT-04 | TASK-22, TASK-23 |
| AC-43 | Automated | `php artisan test --filter=DomainEventNotificationWiringTest::test_payroll_processing_completed_notifies_staff_only` | TASK-15, TASK-24 |
| AC-44 | Automated | `php artisan test --filter=DomainEventNotificationWiringTest::test_payroll_processing_failed_notifies_payroll_officers` | TASK-15, TASK-24 |

---

## 9. Commands for the User

| Order | Command / Action | When | Rollback |
| --- | --- | --- | --- |
| 1 | `php artisan migrate` | After TASK-03 | `php artisan migrate:rollback --step=3` |

---

## 10. Plan Change Log

| Plan Revision | Date | Spec Version | Change | Changed Tasks |
| --- | --- | --- | --- | --- |
| 1 | 2026-10-14 | 2.0 | Created implementation plan derived from regenerated specification | All (TASK-01 to TASK-24) |
| 2 | 2026-10-14 | 2.1 | Synchronized plan with Spec v2.1: unified Web & Mobile card anatomy, decoupled payroll processing vs. payslip release, explicit attendance exclusions, and mandatory alert protection | TASK-10, TASK-15, TASK-18, TASK-20, TASK-22, TASK-23, TASK-24 |
