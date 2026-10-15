# Webkit Migration Contract

## Metadata

| Field | Value |
| --- | --- |
| Source Repo | hrms / SubHRMS (Vue 3 + Pinia web client; Laravel Query / Handler / Action backend) |
| Source Path | `resources/views/web/src/module/employee/notifications/` (+ `app/Http/Controllers/global/NotificationsController.php`, `app/Queries/Notifications/`, `app/Handlers/Notifications/`, `app/Actions/Notifications/`, `app/Events/Notifications/`) |
| Source Spec | `.agents/specs/subhrms/T00002/specs.md` (version 2.1, In Review) |
| Target Repo | `resources/views/mobapp` — `hrms-react-native` (React Native 0.86 / Expo SDK 57 / expo-router, React Context + hooks, restyle theme; a client of the same Laravel API, no backend of its own) |
| Target Path | `resources/views/mobapp/src/module/employee/notifications/` (+ `src/contexts/NotificationContext.tsx`, `src/components/dashboard/AppTopHeader.tsx`, `src/app/(app)/notifications/`) |
| Target Branch | `T00002` (already the branch of this feature in the mobapp repo; clean tree at start) |
| Ticket | T00002 (subhrms) — the mobapp repo carries a branch of the same name for the same work; no target-project ticket exists |
| Contract Date | 2026-10-15 |
| Contract Run | v1 — initial (re-check of the mobile client that `/webkit-implement T00002` shipped in `8955fb0`, then migration of what is missing) |

---

## 1. Purpose & Ownership

A signed-in account sees its own in-app notifications (approvals, attendance, payroll, announcements, HR notices, system alerts, chat), with a live unread badge. It filters them by category, unread state and priority, marks one or all as read, dismisses them, opens the related screen from a notification, and tunes delivery in a settings screen (quiet hours, reminders, privacy opt-outs, per-category In-App / Push / Email channels). Statutory categories are mandatory: their in-app channel cannot be turned off. The server creates every notification; the client never creates one.

- **Owner:** employee portal / global (`NotificationsController` lives in `global`, routes sit in the `auth:sanctum` group, no portal prefix) → mobapp `module/employee/notifications`.
- **Access rules (carried verbatim):** every endpoint is scoped to the authenticated account (`$request->user()->id`); reading, marking or dismissing another account's notification is rejected with 403 `Unauthorized access to notification.`; the realtime channel is `private-user.{id}` and only that account may subscribe — `NotificationsController.php:26,42,57,75,93`, `MarkNotificationReadHandler.php:50`, `routes/channels.php:60`.

---

## 2. Flow & State Machine

### Flow

1. Opening the center loads page 1 (page size 15 on web, 20 on mobile) and the unread count (total + per category), newest first — `NotificationsPage.vue:248-251`, `useNotificationStore.ts:36-77`.
2. Selecting a category tab, the Unread-only toggle, or a priority replaces the list with page 1 of the filtered result (`category`, `unread_only=1`, `priority` query params) — `NotificationsPage.vue:253-260`, `useNotificationStore.ts:44-52`.
3. Tapping a notification marks it read (optimistic, then the server count wins) and opens the related screen — `NotificationsPage.vue:354-365`, `HeaderBarComponets.vue:311-323`.
4. "Mark all read" marks every unread notification of the active category (or all) read and the badge shows the server's count — `NotificationsPage.vue:20-30`, `useNotificationStore.ts:106-126`.
5. Dismissing removes the item from the list immediately and soft-deletes it on the server — `useNotificationStore.ts:131-149`.
6. A live `NotificationCreated` event adds the item to the top of the list (once per id) and raises the badge; a `NotificationCountUpdated` event sets the badge to the server's number — `useNotificationStore.ts:202-234`.
7. Settings: load settings + preferences; master settings are saved with one PUT; each category channel toggle is saved with its own PUT; a mandatory category's in-app toggle is locked — `NotificationSettingsPage.vue:266-314`.

### State Machine

A notification has two independent flags; there is no lifecycle beyond them.

| From | To | Trigger | Who / What | Evidence |
| --- | --- | --- | --- | --- |
| unread (`read_at` null) | read (`read_at` set) | open it, or "mark read" | the recipient; `POST /api/notifications/{id}/read` or `read-all` | `MarkNotificationReadHandler.php:52-55`, `MarkAllNotificationsReadHandler.php:46` |
| active (`status` 1) | dismissed (`status` 0) | dismiss | the recipient; `DELETE /api/notifications/{id}` | `DismissNotificationHandler.php:52-53` |
| read | unread | none — there is no endpoint | — | `routes/api.php:63-72` |
| `action_state` `pending` | other states | set by the server only (`CreateNotificationAction` sets `pending` when `is_actionable`); no client transition | system | `CreateNotificationAction.php:80` |

---

## 3. Data Contract

### Notification (`notifications`)

REST list item (what both clients render) — `GetNotificationsQuery.php:77-94`:

| Field | Type | Unit / Format | Nullable | Persisted / Computed | Source / Derivation |
| --- | --- | --- | --- | --- | --- |
| `id` | integer | — | No | Persisted | `Notification.php:16` |
| `type` | string | event type, e.g. `payroll.payslip_released`, `leave.approved` | No | Persisted | `Notification.php:18` |
| `category` | string | one of the 7 keys below | No | Persisted | `Notification.php:19` |
| `title`, `body` | string | plain text; never carries salary figures (spec §14) | No | Persisted | `Notification.php:20-21` |
| `priority` | string | `critical` \| `high` \| `normal` \| `low` | No | Persisted | `Notification.php:22` |
| `actor` | `{id, fullname, empid}` \| null | `fullname` = `fname lname` | Yes | Computed | `GetNotificationsQuery.php:68-75` |
| `resource_type` | string \| null | `payslip`, `leave`, `overtime`, `cs`…(approval alias), `timesheet`, `pay_period`, `announcement`, `account`, `disciplinary_action` | Yes | Persisted | grep `resource_type` in `app/` |
| `resource_id` | integer \| null | — | Yes | Persisted | `Notification.php:25` |
| `data` | object \| null | free JSON per event | Yes | Persisted | `Notification.php:26` |
| `is_actionable` | boolean | — | No | Persisted | `Notification.php:28` |
| `action_state` | string \| null | `pending` \| `resolved` \| `expired` | Yes | Persisted | `Notification.php:29` |
| `is_read` | boolean | `read_at` is not null | No | Computed | `GetNotificationsQuery.php:90` |
| `read_at`, `created_at` | ISO-8601 string \| null | with offset | Yes | Persisted / Computed | `GetNotificationsQuery.php:91-92` |
| `time_ago` | string | server `diffForHumans()` | No | Computed | `GetNotificationsQuery.php:93` |

Realtime `NotificationCreated` payload is a different shape — `NotificationCreated.php:49-71`: `id, idacct, type, category, title, body, priority, actor {id, name, avatar_url} (or actorData), resource {type, id}, data, is_actionable, action_state, read_at: null, is_read: false, created_at, time_ago: "Just now"`. It has **no** `resource_type` / `resource_id` and its actor has `name`, not `fullname`. `NotificationCountUpdated` carries `{unread_count}` — `NotificationCountUpdated.php:48-52`.

- **Enum / status values:**
  - `category` = `applications_approvals`, `attendance`, `payroll_compensation`, `announcements`, `hr_lifecycle`, `system_alerts`, `messages` — `GetNotificationSettingsQuery.php:15-65`, `GetNotificationCountQuery.php:21-29`.
  - Category display names (server): Approvals & Requests, Attendance & Timekeeping, Payroll & Payslips, Announcements, HR & Disciplinary Notices, System & Security Alerts, Workplace Chat & Mentions — `GetNotificationSettingsQuery.php:17-59`.
  - Mandatory categories: `hr_lifecycle`, `system_alerts` — `GetNotificationSettingsQuery.php:49,56`.
  - `status`: `1` active, `0` dismissed — `Notification.php:51`.

### Notification settings (`notification_settings`, one row per account)

| Field | Type | Unit / Format | Nullable | Persisted / Computed | Source / Derivation |
| --- | --- | --- | --- | --- | --- |
| `dnd_enabled` | boolean | default false | No | Persisted | `GetNotificationSettingsQuery.php:79` |
| `dnd_start_time`, `dnd_end_time` | string | `HH:mm:ss`, defaults `22:00:00` / `07:00:00` | No | Persisted | `GetNotificationSettingsQuery.php:80-81` |
| `email_notifications_enabled`, `push_notifications_enabled`, `in_app_notifications_enabled` | boolean | default true | No | Persisted | `GetNotificationSettingsQuery.php:82-84` |
| `reminder_missing_attendance`, `reminder_filing_deadlines` | boolean | default true | No | Persisted | `GetNotificationSettingsQuery.php:85-86` |
| `reminder_lead_hours` | integer | hours before the deadline, default 4; web offers 2 / 4 / 8 / 24 | No | Persisted | `GetNotificationSettingsQuery.php:87`, `NotificationSettingsPage.vue:126-129` |
| `birthday_privacy_opt_out`, `anniversary_privacy_opt_out` | boolean | default false | No | Persisted | `GetNotificationSettingsQuery.php:88-89` |

### Category preference (`notification_preferences`, unique `(idacct, category)`)

| Field | Type | Unit / Format | Nullable | Persisted / Computed | Source / Derivation |
| --- | --- | --- | --- | --- | --- |
| `category` | string | one of the 7 keys | No | Persisted | `GetNotificationSettingsQuery.php:133` |
| `name` | string | server display name | No | Computed | `GetNotificationSettingsQuery.php:134` |
| `channel_in_app`, `channel_push`, `channel_email` | boolean | per-category defaults in `STANDARD_CATEGORIES`; a mandatory category always reads `channel_in_app = true` | No | Persisted | `GetNotificationSettingsQuery.php:122-130` |
| `is_mandatory` | boolean | — | No | Computed | `GetNotificationSettingsQuery.php:125` |

---

## 4. API Contract

All under the `auth:sanctum` group, prefix `notifications` — `routes/api.php:63-72`. Errors come from `NotificationsController::errorResponse`: `{message}` with the exception's code when it is 400–599, otherwise 400 — `NotificationsController.php:161-171`.

| Method | Path | Request (params / body) | Success Response | Errors (status → body) | Auth / Guard | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| `GET` | `/api/notifications` | `page` (≥1), `per_page` (1–100, default 20), `category`, `unread_only` (0/1), `priority`; `category`/`priority` of `all` mean no filter | 200 `{data: Notification[], current_page, last_page, per_page, total}` | unknown category → 200 with empty `data` (no validation) | own rows only | `GetNotificationsQuery.php:24-104` |
| `GET` | `/api/notifications/count` | — | 200 `{total_unread, by_category: {<7 keys>: int}}` | — | own rows only | `GetNotificationCountQuery.php:17-69` |
| `POST` | `/api/notifications/{id}/read` | — | 200 `{success, id, read_at, unread_count}` | not found → 400 `{message: "Notification not found."}`; other account's → 403 `{message: "Unauthorized access to notification."}` | owner only | `MarkNotificationReadHandler.php:45-50` |
| `POST` | `/api/notifications/read-all` | optional body `{category}` (`all` = no scope) | 200 `{success, updated_count, unread_count}` | — | own rows only | `MarkAllNotificationsReadHandler.php:38-62` |
| `DELETE` | `/api/notifications/{id}` | — | 200 `{success, id, unread_count}` | same 400 / 403 as read | owner only | `DismissNotificationHandler.php:42-47` |
| `GET` | `/api/notifications/settings` | — | 200 `{settings: {11 fields}, preferences: [7 × {category,name,channel_in_app,channel_push,channel_email,is_mandatory}]}` | — | own | `GetNotificationSettingsQuery.php:73-146` |
| `PUT` | `/api/notifications/settings` | any subset of the 11 setting fields | 200 same shape as GET settings | — (no validation) | own | `UpdateNotificationSettingsHandler.php:38-60` |
| `PUT` | `/api/notifications/preferences/{category}` | any subset of `channel_in_app`, `channel_push`, `channel_email` | 200 `{success, category, channel_in_app, channel_push, channel_email, is_mandatory}` | unknown category → 400 `{message: "Invalid notification category: <key>"}`; mandatory + `channel_in_app` false → 422 `{message: "This notification category is mandatory for compliance and cannot be disabled."}` | own | `UpdateNotificationPreferencesHandler.php:40,50` |
| realtime | channel `private-user.{id}` | event `.NotificationCreated` (payload in §3), event `.NotificationCountUpdated` `{unread_count}` | — | — | only the owner may subscribe | `NotificationCreated.php:34-71`, `routes/channels.php:60` |

---

## 5. Business Rules & Calculations

| # | Rule / Formula | Rounding / Units | Compliance-Sensitive | Evidence |
| --- | --- | --- | --- | --- |
| R1 | Unread = `read_at` is null AND `status` = 1; the badge is the server's count after every change | integer | No | `GetNotificationCountQuery.php:38-44` |
| R2 | The list is ordered `created_at` desc, then `id` desc | — | No | `GetNotificationsQuery.php:62` |
| R3 | `page` is clamped to ≥ 1 and `per_page` to 1–100 | — | No | `GetNotificationsQuery.php:27-28` |
| R4 | A mandatory category always reports `channel_in_app = true` and rejects a disable request with 422 | — | Yes — statutory HR notices and NTEs must stay deliverable (spec D-05) | `GetNotificationSettingsQuery.php:128-130`, `UpdateNotificationPreferencesHandler.php:44-51` |
| R5 | A non-mandatory category the user muted (`channel_in_app` false) creates no notification at all for them | — | Yes — mandatory ones bypass the mute | `CreateNotificationAction.php:30-42,108-122` |
| R6 | Notification text never carries salary, deduction or net-pay figures (payslip body is neutral text) | — | Yes — pay data | spec §14 Data Protection |
| R7 | The unread-count badge shows `99+` above 99 | — | No | `HeaderBarComponets.vue` hunk (`unreadCount > 99 ? '99+'`) |

---

## 6. Validation & Authorization

### Validation

The source performs almost no validation; these are the only checks in code.

| Field | Rule | Message | Evidence |
| --- | --- | --- | --- |
| `{category}` (preferences) | must be one of the 7 keys | "Invalid notification category: `<key>`" (400) | `UpdateNotificationPreferencesHandler.php:40` |
| `channel_in_app` on a mandatory category | must not be false / 0 / "0" | "This notification category is mandatory for compliance and cannot be disabled." (422) | `UpdateNotificationPreferencesHandler.php:50` |
| `id` (read / dismiss) | must exist | "Notification not found." | `MarkNotificationReadHandler.php:45` |

### Authorization

| Action | Allowed | Rejected With | Evidence |
| --- | --- | --- | --- |
| read / dismiss a notification | its recipient | 403 `{message: "Unauthorized access to notification."}` | `MarkNotificationReadHandler.php:50`, `DismissNotificationHandler.php:47` |
| list, count, mark-all, settings, preferences | any authenticated account, scoped to itself | 401 when unauthenticated | `routes/api.php:63-72` |

- **Transactional writes:** read, read-all, dismiss and preference writes each run in `DB::transaction`; the count broadcast runs after commit — `MarkNotificationReadHandler.php:41-77`.

---

## 7. UI Behavior

| Page / View | Responsibility | Evidence |
| --- | --- | --- |
| Header bell | Live unread badge (`99+` cap); opens the center. (Web shows a 5-item dropdown with Mark all read, View all, Settings; mobile opens the center directly — spec FR-15.) | `HeaderBarComponets.vue:305`, spec §6 FR-15 |
| Notification Center | Title with unread count, Mark-all-read (only when unread > 0), Settings link, category tabs with per-category unread counts, filter bar (Unread only, Priority), list, pagination | `NotificationsPage.vue:4-225` |
| Notification card | Category icon + category tag, CRITICAL / HIGH pill, unread dot, title, body, actor ("By <name>"), relative time, "View Details" button when `is_actionable`, mark-read button when unread, dismiss | `NotificationsPage.vue:124-201` |
| Notification Settings | Quiet hours (toggle + start/end time), Missing-attendance and Filing-deadline reminders + lead-time select, Birthday / Anniversary opt-outs, category × channel matrix with a "Mandatory" badge and a locked in-app toggle | `NotificationSettingsPage.vue:48-238` |

- **Filters and search:** category tab (`All, Approvals & Requests, Attendance & Timekeeping, Payroll & Payslips, Announcements, HR Notices, Messages`), Unread-only, Priority (`All, Critical, High, Normal, Low`); no search, no debounce; any change reloads page 1 — `NotificationsPage.vue:238-260,72-104`.
- **Pagination:** server-side; web 15 per page with Previous / Next and "Page x of y" plus "Showing n of total" — `useNotificationStore.ts:40`, `NotificationsPage.vue:102,205-225`.
- **Sort:** newest first (R2); no user option.
- **Loading / empty / error states:** loading spinner; empty = "No notifications — You're all caught up! No notifications found matching your current filter."; fetch errors are logged, the previous list stays — `NotificationsPage.vue:107-121`, `useNotificationStore.ts:59-61`.
- **Status → badge map:** priority `critical` → red left border + CRITICAL pill; `high` → amber left border + HIGH pill; otherwise → standard — `NotificationsPage.vue:145-151,284-293`. Category → label: approvals "Approvals", attendance "Timekeeping", payroll "Payroll", announcements "Announcements", hr_lifecycle "HR Notice", system_alerts "Security", messages "Chat" — `NotificationsPage.vue:271-282`. Unread → teal dot and tinted card.
- **Modals and drill-downs:** none on web. Tapping navigates by `resource_type` / `category`: payslip → payslip page; attendance → attendance page; announcements → announcements page; messages → messages page; anything else stays — `NotificationsPage.vue:354-365`. Mobile equivalents are decided in §10.
- **Formatting:** relative time (`time_ago`); mobile renders `Just now`, `5m ago`, `2h ago`, `3d ago`, then `Mon D` (spec §9 card anatomy).

---

## 8. Edge Cases

| Case | Expected Behavior | Evidence |
| --- | --- | --- |
| No notifications | empty state; badge hidden; list `[]`, count 0 | spec EC-02, `NotificationsPage.vue:111-121` |
| Another account's id | 403, record untouched | spec EC-03, `MarkNotificationReadHandler.php:50` |
| Rapid double "mark all read" | second call updates 0 rows and still returns 200 | spec EC-06, `MarkAllNotificationsReadHandler.php:46` |
| Live event for an id already in the list | ignored (no duplicate) | `useNotificationStore.ts:213-218` |
| Live event while offline / socket down | missed for good; the next fetch (open, refresh, reconnect) restores it | spec AC-27, `echo.ts` `onReconnect` |
| Mandatory category | in-app toggle disabled; a forced request returns 422 | R4 |
| Mark-read / dismiss request fails | the optimistic change stays on screen; the next fetch corrects it | `useNotificationStore.ts:98-100,146-148` |

---

## 9. Dependencies & Preconditions

| Dependency | Kind | Why the Feature Needs It | Evidence |
| --- | --- | --- | --- |
| `notifications`, `notification_settings`, `notification_preferences` | table | backing store (created by T00002 migrations, run by the user in the source) | `database/migrations/2026_10_15_00000{1,2,3}_*.php` |
| `private-user.{id}` channel + `/api/broadcasting/auth/{connection}` | realtime | live badge and list | `routes/channels.php:60` |
| Laravel scheduler + `hrms:*` commands, domain handler hooks | scheduled jobs / touchpoints | they create the notifications the clients show | commit `9f27916d` |
| Mobile: `GET /api/broadcasting/config`, `@/services/realtime/echo` | shared util | Pusher/Reverb connection, refcounted channels, `onReconnect` | `mobapp/src/services/realtime/echo.ts` |

---

## 10. Translation Decisions (Source → Target)

- **Target profile from:** Architecture Discovery against the target (no project profile in the mobapp repo; `AGENTS.md` only says to read the Expo SDK 57 docs) — re-verified 2026-10-15 from `package.json`, `src/app/`, `src/module/employee/messages/`.
- **Closest sibling module in the target:** `src/module/employee/messages/` (realtime context, `onReconnect` + AppState recovery, refcounted channel).

| Layer | Source Pattern | Target Pattern | Must Survive |
| --- | --- | --- | --- |
| State | Pinia store `useNotificationStore` | `NotificationProvider` + `useNotifications` (React Context) in `src/contexts/NotificationContext.tsx`, provider mounted in `src/app/(app)/_layout.tsx` | §2 flow, §3 count semantics |
| API | `useNotificationsApi()` over `axiosInstance` (`response.data`) | `notificationsApi` over `@/app/axios` `http` (already returns the body) | §4 paths, params, bodies |
| Live updates | Laravel Echo `.private().listen()` + `leave()` | the app's own `EchoChannel` (`listen`, refcounted `private`/`leave`, `onReconnect`) | §2 step 6, §8 |
| Navigation | `router.push('/payslip' …)` | expo-router `router.push` to the nearest mobile screen (map below) | §7 tap behavior |
| Dismiss / mark read | hover buttons (check, trash) | swipe actions (left = dismiss, right = mark read) plus the tap, per spec FR-15 / AC-42 | §2 steps 3, 5 |
| Pagination | Previous / Next pages | infinite scroll appending the next server page (same `page` / `per_page`) | §7 pagination (server-side) |
| Time input | `<input type="time">` | the existing `TimePickerModal` (24-hour `HH:mm`, saved as `HH:mm:00`) | §3 `dnd_*_time` format |
| Styling | Tailwind, teal accent | restyle `Box`/`Text`, the app's amber accent | behavior only (§7) |

Deep-link map (web destination → mobile screen):

| Notification | Web | Mobile |
| --- | --- | --- |
| `resource_type` `payslip` | `/payslip` | `/(app)/(tabs)/timekeeping` (the dashboard's own "payslip" quick action goes to the same tab; mobile has no payslip screen) |
| `category` `attendance` | `/attendance` | `/(app)/time-in-out` |
| `category` `announcements` | `/announcements` | `/(app)/(tabs)` (announcements live on the home carousel; no screen) |
| `category` `messages` | `/messages` | `/(app)/messages` (the source has no messaging notification producer, so there is no conversation id to open) |
| `category` `applications_approvals` | nothing (source gap, §13) | `/(app)/requests` — per spec Flow 1 step 3 |
| `hr_lifecycle`, `system_alerts`, other | nothing | stay on the center (the tap only marks read) |

### Design-System Mapping

| Source Component | Behavior Used | Target Component | Evidence (target path) |
| --- | --- | --- | --- |
| tab buttons | single-select category chips with an unread count | existing chip row in `NotificationsScreen` | `src/module/employee/notifications/pages/NotificationsScreen.tsx` |
| `<select>` Priority | single-select of 5 values | chip row (same chip style) | same |
| checkbox toggles | boolean setting | `Switch` | `NotificationSettingsScreen.tsx` |
| `<input type=time>` | pick `HH:mm` | `TimePickerModal` | `src/components/modals/TimePickerModal.tsx` |
| `<select>` lead hours | single-select of 4 values | chip row | `NotificationSettingsScreen.tsx` |
| card + hover actions | swipeable row | `Swipeable` from `react-native-gesture-handler` (already a dependency; `GestureHandlerRootView` is at `src/app/_layout.tsx:159`) | `src/app/_layout.tsx` |

- **Renames between the projects:** `attendance` → timekeeping / time-in-out screens; web `/payslip` → mobile timekeeping tab; web path `/notifications/settings` → mobile `/(app)/notifications/settings`.

---

## 11. Target Reuse (System Awareness Scan)

| Artifact | Searched (target) | Found | Decision |
| --- | --- | --- | --- |
| Notification types | `ls src/module/employee/notifications/types` | `types/types.notifications.ts` (matches §3 REST shape) | REUSE; EXTEND with a `NotificationRealtimePayload` type |
| API layer | `ls .../notifications/api` | `notifications.api.ts` (8 calls, §4 paths) | REUSE unchanged |
| Context + hook | `grep -rl NotificationContext src` | `src/contexts/NotificationContext.tsx`, `src/hooks/useNotifications.ts` | EXTEND (realtime, reconnect, append pagination, totalCount, filter-aware live insert) |
| Header bell + badge | `grep -n Notifications src/components/dashboard/AppTopHeader.tsx` | bell + badge + route push present | REUSE unchanged |
| Routes | `ls "src/app/(app)/notifications"` | `_layout`, `index`, `settings`; registered in `(app)/_layout.tsx` | REUSE unchanged |
| Notification card | `ls .../notifications/components` | `NotificationItem.tsx` | EXTEND (category keys, labels, swipe, deep link) |
| Center screen | `.../pages/NotificationsScreen.tsx` | present | EXTEND (tab keys/labels, priority chips, append list, count line) |
| Settings screen | `.../pages/NotificationSettingsScreen.tsx` | present | EXTEND (category keys, quiet-hour times, lead hours, push/email masters, exact messages) |
| Deep-link resolver | `grep -rn "resolveNotificationRoute\|notificationRoute" src` | NONE | CREATE `.../notifications/utils/notificationRoute.ts` — pure function, nothing in the target maps notifications to screens |
| Realtime payload normalizer | `grep -rn "normalizeNotification" src` | NONE | CREATE `.../notifications/utils/normalizeNotification.ts` — the live payload is shaped differently from the REST item (§3) |
| Time picker | `grep -rli TimePicker src` | `src/components/modals/TimePickerModal.tsx` | REUSE |
| Swipe | `grep -rn Swipeable src` | none in use, library installed | REUSE the installed library |
| Time-ago formatter | `grep -rn "m ago" src/module/employee/notifications` | inline in `NotificationItem.tsx` | EXTEND — move to a util so it is unit-testable |
| Test harness | `ls tests/support` | `renderWithTheme.tsx`, `fakePusher.ts` | REUSE |
| Tests for this feature | `find tests -iname '*notif*'` | NONE | CREATE under `tests/` mirroring `src/` (user rule: tests live in `tests/`, not beside the source) |

- **Migrations for the user to run in the target:** None — the mobile app has no database; all data comes from the source API.

---

## 12. Parity Checklist

### Parity Result

PARITY WITH GAPS

Executed means a jest test ran green in the mobapp repo (`tests/`, 121 new tests); traced means the code path was read. The four gaps are items that need a device or the running backend; they are named in the last four rows.

| Contract Item | Source | Target | How Compared | Result |
| --- | --- | --- | --- | --- |
| §3 REST item fields | `GetNotificationsQuery.php:77-94` | `types/types.notifications.ts:19-38` | traced field by field | Equal |
| §3 realtime payload → list item (`resource`, `actor.name`) | `NotificationCreated.php:49-71` | `utils/normalizeNotification.ts` | executed `normalizeNotification.test.ts` | Equal (the web store does not do this — §13, not copied) |
| §3 the 7 category keys | `GetNotificationSettingsQuery.php:15-65` | `utils/notificationCategories.ts:4-12`, `NotificationItem.tsx` category switch, settings `CATEGORY_DESCRIPTIONS` | executed `notificationCategories.test.ts`, `NotificationItem.test.tsx`, settings test | Equal (was Differs: `approvals`, `payroll`) |
| §4 the 8 endpoints, params and bodies | `routes/api.php:63-72` | `api/notifications.api.ts` | executed `notifications.api.test.ts` | Equal |
| §2.1–2.2 load page 1, filters reload page 1 (`category`, `unread_only`, `priority`) | `useNotificationStore.ts:36-64` | `NotificationContext.tsx:103-137`, `NotificationsScreen.tsx` filter effect | executed `NotificationContext.test.tsx`, `NotificationsScreen.test.tsx` | Equal |
| §7 pagination: server-side, newest first, list grows as the next page loads | `NotificationsPage.vue:205-225` | `NotificationContext.tsx:123-126` (append, no repeated id), `NotificationsScreen.tsx:79` | executed context + screen tests | Equal (infinite scroll in place of Previous / Next; page size 20, the API default, instead of 15 — both stated in §2 and §10) |
| §2.3 tap marks read and opens the screen | `NotificationsPage.vue:354-365` | `NotificationItem.tsx:129-162`, `utils/notificationRoute.ts` | executed `NotificationItem.test.tsx`, `notificationRoute.test.ts` | Equal (approvals open Requests per spec; HR / system open nothing, as on web) |
| §2.4 mark all read, scoped to the active category | `useNotificationStore.ts:106-126` | `NotificationContext.tsx:167-191` | executed context + screen tests | Equal |
| §2.5 dismiss | `useNotificationStore.ts:131-149` | `NotificationContext.tsx:193-215`, swipe Delete in `NotificationItem.tsx:178-190` | executed context + item tests | Equal |
| §2.6 live add (once per id), badge from the count event | `useNotificationStore.ts:202-234` | `NotificationContext.tsx:276-305` | executed context tests | Equal (a live item joins the list only if it matches the active filters — §13) |
| §8 missed events are recovered (reconnect, foreground) | spec AC-27 | `NotificationContext.tsx:316-332` | executed context tests | Equal to the spec; the web client has no equivalent |
| §6 / R4 mandatory category: in-app locked, exact server message | `UpdateNotificationPreferencesHandler.php:50`, `NotificationSettingsPage.vue:293-297` | `NotificationSettingsScreen.tsx:53-54,118-122` | executed settings test | Equal |
| §7 settings sections: quiet hours + times, reminders + lead hours, privacy, channel matrix | `NotificationSettingsPage.vue:48-238` | `NotificationSettingsScreen.tsx` (`TimePickerModal`, lead-hour chips, `pref.name`) | executed settings test | Equal (mobile also shows the push / email master toggles the web page omits — §13) |
| §7 priority → CRITICAL / HIGH pill and border; category → tag | `NotificationsPage.vue:145-151,271-293` | `NotificationItem.tsx` | executed item test | Equal |
| §7 tabs: names, order, unread counts; priority filter; "Showing n of total"; empty and loading states | `NotificationsPage.vue:45-121,238-246` | `NotificationsScreen.tsx` | executed screen test | Equal (the empty-state wording is the target's) |
| §7 swipe left = Delete, swipe right = Mark read (spec FR-15 / AC-42) | spec §9 | `NotificationItem.tsx:178-205` | executed with a fake swipeable row (its action buttons pressed) | Not checked — the real gesture on a device (jest cannot run the gesture runtime) |
| §2.6 live updates end to end (backend event → socket → badge and list) | `BroadcastNotificationAction.php` | `NotificationContext.tsx:276-305` | executed with a fake Echo; no backend or socket was started | Not checked — a real round trip against the running backend |
| §7 header bell badge (`99+` cap, opens the center) | `HeaderBarComponets.vue:305` | `components/dashboard/AppTopHeader.tsx` bell block | traced; unchanged in this run. A jest test is not possible: dashboard mode needs the logo image the jest `@/` mapping cannot resolve | Not checked — executed on a device or with a changed jest mapping |
| §7 the screens a tap lands on (timekeeping tab, time-in/out, requests, messages, home) | `NotificationsPage.vue:354-365` | `utils/notificationRoute.ts` | the router was a stub in jest; the pathnames match existing routes in `src/app/(app)/` | Not checked — navigation on a device |

- **Static checks (target):** `npx tsc --noEmit` → exit 0. `npx expo lint` on the feature's `src/` and `tests/` files → nothing from this run; 6 findings were already in the files (settings screen: unused `ShieldAlert`, `CheckCircle2`, `savingKey`, and `setLoading(true)` inside an effect; list screen: unused `View` and an exhaustive-deps warning). `npx jest tests/contexts/NotificationContext.test.tsx tests/module/employee/notifications` → 9 suites, 121 tests passed. Full `npx jest` → 564 passed, 12 failed in 4 messages suites (`ColleagueProfileDrawer`, `ForwardMessageModal`, `MoveChannelSectionModal`, `MessagesScreen`) — the same 12 fail on an untouched export of `HEAD`, so they pre-date this run.
- **Round trip:** Given only this contract, the target behaves identically to the source for every row marked Equal; the four Not-checked rows need a device or the running backend.

---

## 13. Drift & Open Points

Spec vs code (the contract follows the code):

- Category keys — spec §9 names `timekeeping_attendance`, `announcements_company`, `messaging_conversations`, `birthdays_anniversaries`, `reminders_deadlines`; the code and both clients use `attendance`, `announcements`, `messages` and have no separate birthday / reminder categories (birthday and anniversary notices are filed under `announcements`) — `GetNotificationSettingsQuery.php:15-65`. Decision: use the code's 7 keys.
- Validation and messages — spec §14 lists 422 messages for `page`, `per_page`, `category`, `dnd_*`; none exist in code. Invalid category on `PUT preferences` is 400, not 422; on `GET` it returns an empty list. Decision: reproduce the code.
- Spec EC-08 (stale record toast), Flow 1 offline badge, AC-39 reaction coalescing, AC-40 toast suppression, FR-14 chat notifications — not implemented in the source (no messaging hook in commit `9f27916d`). Decision: not migrated; not added.
- Spec says swipe-right toggles read; the API has no "mark unread" endpoint. Decision: swipe-right marks read only.
- Spec reminder lead times are 24 / 12 / 4 h; web offers 2 / 4 / 8 / 24 h. Decision: follow the code.

Source defects recorded, not fixed (a source fix is `/webkit-investigate` then `/webkit-fix`):

- Realtime `NotificationCreated` payload is not the REST item shape, yet the web store inserts it as one (`useNotificationStore.ts:212`): `resource_type`, `resource_id` and `actor.fullname` are undefined on a live item, so its tap does not navigate until the next fetch. Mobile normalizes the payload instead of copying this.
- The web store inserts a live item whatever the active tab / unread / priority filter is (`useNotificationStore.ts:213-218`), so a payroll item can appear under "Attendance". Mobile inserts only items that match the active filters.
- `in_app_notifications_enabled`, `push_notifications_enabled`, `email_notifications_enabled` are stored but never read by `CreateNotificationAction` (`CreateNotificationAction.php:30-42` checks only the per-category row), so the master toggles change nothing server-side. The web page does not render the push / email masters at all (`NotificationSettingsPage.vue:48-168`).
- Web never navigates for `applications_approvals` or `hr_lifecycle` taps (`NotificationsPage.vue:354-365`); the header falls back to the center (`HeaderBarComponets.vue:311-323`).
- The web in-app mandatory guard shows its message only client-side; with the lock in place the 422 is unreachable from the UI.

Target drift found by this re-check (the migration gaps; all closed in run v1, each verified in §12):

- Mobile category keys `approvals` and `payroll` do not exist in the API (`applications_approvals`, `payroll_compensation`): those two tabs always returned nothing and their cards and settings rows fell back to a generic style.
- `fetchNotifications` replaces the list, so "load more" threw away page 1.
- The realtime effect depended on the filters and re-subscribed on every tab change; it never resynced after a socket reconnect or a return to the foreground (the messages module does both).
- Tapping a card only marked it read (no `action_url` is ever sent), and "View details" never showed.
- No swipe gestures, no priority filter, no total count, no quiet-hour time editing, no lead-hours select, no push / email master toggles, a different mandatory-lock message, no tests.

Open points for the user:

- Mobile has no payslip or announcements screen; those notifications open the timekeeping tab and the home tab (decision above). Adding screens is new behavior for `/webkit-specify`.
- This contract treats the mobapp repo's `T00002` branch as the branch of this migration because `/webkit-implement T00002` created it for the same feature.
- The dashboard header's bell cannot be tested under this repo's jest `@/` mapping (the logo image lives outside `src/`). Question: add a `moduleNameMapper` entry for `assets/` to the mobapp jest config, or keep testing the header in messages mode only?
- The 12 failing tests in 4 messages suites already fail on `HEAD`; they are not part of this feature (`/webkit-investigate` if they matter).
- Barrel `src/module/employee/notifications/index.ts` exported the `NotificationItem` component under the same name as the type it re-exports (`import/export` lint error); nothing imported it from the barrel, so the component export was removed.
- Empty-state wording on mobile ("No notifications found" plus a per-filter hint) differs from the web copy; the state itself is the same.

---

## 14. Source Reference

- **Frontend:** `resources/views/web/src/module/employee/notifications/{types.ts, api/notificationsApi.ts, store/useNotificationStore.ts, pages/NotificationsPage.vue, pages/NotificationSettingsPage.vue}`, `resources/views/web/src/components/custom/Navbar/HeaderBarComponets.vue`, `resources/views/web/app/routes.ts`.
- **Backend:** `app/Http/Controllers/global/NotificationsController.php`; `app/Queries/Notifications/{GetNotificationsQuery,GetNotificationCountQuery,GetNotificationSettingsQuery}.php`; `app/Handlers/Notifications/*.php`; `app/Actions/Notifications/{CreateNotificationAction,BroadcastNotificationAction}.php`; `app/Events/Notifications/{NotificationCreated,NotificationCountUpdated}.php`.
- **Models / tables:** `Notification` → `notifications`; `NotificationSetting` → `notification_settings`; `NotificationPreference` → `notification_preferences`.
- **Routes:** `GET /api/notifications`, `GET /api/notifications/count`, `POST /api/notifications/read-all`, `GET|PUT /api/notifications/settings`, `PUT /api/notifications/preferences/{category}`, `POST /api/notifications/{id}/read`, `DELETE /api/notifications/{id}` → `routes/api.php:63-72`.

<!-- Run history -->
