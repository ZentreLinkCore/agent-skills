# Implementation Plan — Shared Media, Files, and Links Viewer

## Metadata

| Field | Value |
| --- | --- |
| Project Name | SubHRMS |
| Ticket Number | T00003 |
| Feature Name | Shared Media, Files, and Links Viewer |
| Specification | `.agents/specs/subhrms/T00003/spec.md` |
| Based on Spec Version | 1.0 |
| Plan Revision | 1 |
| Created Date | 2026-10-14 |
| Plan Status | Ready |

---

## 1. Technical Context

| Aspect | Value |
| --- | --- |
| Project | SubHRMS (resolved via `package.json` dependencies `vue`, `pinia`, `vue-router`, Laravel backend, `app/Models/Employee.php`) |
| Backend | Laravel 11.x, PHP 8.2+, top-level `app/Queries/Messages/`, thin `app/Http/Controllers/employee/MessagesController.php` |
| Frontend | Mobile: React Native / Expo (`resources/views/mobapp`), TypeScript (`.tsx`/`.ts`), Lucide icons, Reanimated; Web: Vue 3 (`resources/views/web/src/module/employee/messages`), TypeScript + Vue, Tailwind CSS |
| HTTP client | Mobile: `@/app/axios` (`http.get(...)` returns response body); Web: `@/app/axios/axiosInstance` (`http.get(...)` returns `AxiosResponse`, use `.data`) |
| State | Mobile: Component state in `SharedMediaViewerModal.tsx` + `messagesApi`; Web: `useMessages.js` + component state |
| Database conventions | SubHRMS: No foreign key constraints, `->index()` on relationship columns (`conversation_id`, `reply_to_id`), `is_deleted` soft delete flag |
| Design system | Mobile: `@/theme` (`Box`, `Text`, `useTheme`, `useAppTheme`); Web: Tailwind CSS + PrimeVue |
| Reference implementation | `app/Queries/Messages/GetPinnedMessagesQuery.php` and `resources/views/mobapp/src/module/employee/messages/components/GroupDetailsDrawer.tsx` |
| Checks | Mobile: TypeScript compile check / ESLint; Web: `npm run build`; Backend: `php -l` |
| Tests | Backend: `php artisan test --filter=SharedContentTest`; Frontend: Jest on mobile / Vitest on web |

---

## 2. Reuse Map

| Artifact | Searched | Found | Decision |
| --- | --- | --- | --- |
| `GetSharedContentQuery` | `app/Queries/Messages/` | NONE | CREATE — Dedicated Query for aggregating counts and paginating categorized attachments & extracted links |
| `MessagesController@getSharedContent` | `app/Http/Controllers/employee/MessagesController.php` | Existing class with pinned/search endpoints | EXTEND — Add thin action dispatcher method wrapping `GetSharedContentQuery` |
| Route registration | `routes/api/employee.php` | `Route::prefix('messages')` | EXTEND — Register `GET /conversations/{id}/shared-content` |
| `SharedMediaViewerModal.tsx` | `resources/views/mobapp/src/module/employee/messages/components/` | NONE | CREATE — Reusable modal component for mobile shared media, files, and links viewing |
| `GroupDetailsDrawer.tsx` | `resources/views/mobapp/src/module/employee/messages/components/` | Existing file | EXTEND — Add single entry-point button `View all media, files and links` and wire to `SharedMediaViewerModal` |
| `ColleagueProfileDrawer.tsx` | `resources/views/mobapp/src/module/employee/messages/components/` | Existing file | EXTEND — Add single entry-point button `View all media, files and links` and wire to `SharedMediaViewerModal` |
| `ImageViewerModal.tsx` | `resources/views/mobapp/src/module/employee/messages/components/` | Existing file | REUSE — Fullscreen image viewer invoked when user taps image thumbnail |
| `VideoPlayerModal.tsx` | `resources/views/mobapp/src/module/employee/messages/components/` | Existing file | REUSE — Fullscreen video player invoked when user taps video item |
| `LinkPreviewCard.tsx` | `resources/views/mobapp/src/module/employee/messages/components/` | Existing file | REUSE — Card component for rendering rich link previews in Links tab |
| `messagesApi` service | `resources/views/mobapp/src/module/employee/messages/services/messages.api.ts` | Existing file | EXTEND — Add `getSharedContent(conversationId, tab, page, limit)` method |
| `SharedMediaViewerModal.vue` | `resources/views/web/src/module/employee/messages/components/` | NONE | CREATE — Web equivalent modal for viewing shared media, files, and links |

---

## 3. File Change Map

| # | Path | Action | Task | Covers |
| --- | --- | --- | --- | --- |
| 1 | `tests/Feature/Messages/SharedContentTest.php` | Create | TASK-01 | FR-08, AC-15, AC-16, AC-17 |
| 2 | `app/Queries/Messages/GetSharedContentQuery.php` | Create | TASK-02 | FR-02, FR-03, FR-04, FR-05, FR-06, FR-08, AC-03, AC-05, AC-07, AC-09, AC-11 |
| 3 | `app/Http/Controllers/employee/MessagesController.php` | Modify | TASK-03 | FR-08, AC-15 |
| 4 | `routes/api/employee.php` | Modify | TASK-04 | FR-08, AC-03 |
| 5 | `resources/views/mobapp/src/module/employee/messages/services/messages.api.ts` | Modify | TASK-05 | FR-02, AC-03 |
| 6 | `resources/views/mobapp/src/module/employee/messages/components/SharedMediaViewerModal.tsx` | Create | TASK-06 | FR-02, FR-03, FR-04, FR-05, FR-06, FR-07, AC-03, AC-04, AC-05, AC-06, AC-07, AC-08, AC-09, AC-10, AC-11, AC-12, AC-13, AC-14, AC-18 |
| 7 | `resources/views/mobapp/src/module/employee/messages/components/GroupDetailsDrawer.tsx` | Modify | TASK-07 | FR-01, AC-01 |
| 8 | `resources/views/mobapp/src/module/employee/messages/components/ColleagueProfileDrawer.tsx` | Modify | TASK-08 | FR-01, AC-02 |
| 9 | `resources/views/mobapp/src/module/employee/messages/pages/ConversationScreen.tsx` | Modify | TASK-09 | FR-07, AC-13, AC-14 |
| 10 | `resources/views/web/src/module/employee/messages/components/SharedMediaViewerModal.vue` | Create | TASK-10 | FR-01, FR-02, FR-03, FR-04, FR-05, FR-06, AC-01, AC-03 |
| 11 | `resources/views/web/src/module/employee/messages/pages/Messages.vue` | Modify | TASK-11 | FR-01, AC-01, AC-02 |

---

## 4. Phase 1 — Preparation

- **Goal:** Set up test scaffolding and verify ground truth contracts before writing application code.
- **Exit check:** `tests/Feature/Messages/SharedContentTest.php` exists and fails as expected with missing route/query.

- [ ] **TASK-01 — Feature test suite for Shared Content**
  - **Files:** `tests/Feature/Messages/SharedContentTest.php` (Create)
  - **Change:** Add automated feature tests extending `DisposableDatabaseTestCase`: test valid conversation counts + paginated items, test unauthenticated access returns 401, test non-member private channel returns 403, test deleted message attachments excluded, test URL deduplication.
  - **Test:** `tests/Feature/Messages/SharedContentTest.php` — asserts HTTP 200/401/403 and JSON payload structure.
  - **Covers:** FR-08, AC-15, AC-16, AC-17
  - **Depends on:** None
  - **Done when:** Test file is committed and accurately asserts the contract in `spec.md §8`.

---

## 5. Phase 2 — Backend

- **Goal:** Implement the query class, controller action, and route endpoint to deliver categorized shared content.
- **Exit check:** `php artisan test --filter=SharedContentTest` passes all test cases.

- [ ] **TASK-02 — Create GetSharedContentQuery**
  - **Files:** `app/Queries/Messages/GetSharedContentQuery.php` (Create)
  - **Change:** Implement `App\Queries\Messages\GetSharedContentQuery` extending `App\Queries\Query`. Implement static `execute($params)`:
    - Verify `$conversation = Conversation::visibleTo($user)->find($conversationId)`
    - Compute total counts for images, videos, files, and links in single pass or parallel count queries
    - Fetch paginated items for requested `tab` (images/videos/files from `MessageAttachment`, links extracted from `Message.text`)
    - Attach sender details (`id`, `name`, `avatar`) and message reference (`message_id`, `reply_to_id`)
    - Return `['counts' => [...], 'tab' => $tab, 'items' => [...], 'pagination' => [...]]`
  - **Test:** `tests/Feature/Messages/SharedContentTest.php` — verifies query execution and category isolation.
  - **Covers:** FR-02, FR-03, FR-04, FR-05, FR-06, FR-08, AC-03, AC-05, AC-07, AC-09, AC-11
  - **Depends on:** TASK-01
  - **Done when:** Query returns correct shape and passes unit assertions.

- [ ] **TASK-03 — Add getSharedContent to MessagesController**
  - **Files:** `app/Http/Controllers/employee/MessagesController.php` (Modify)
  - **Change:** Add `getSharedContent(Request $request, $id)` method. Call `GetSharedContentQuery::execute(array_merge($request->all(), ['conversation_id' => $id]))` inside `try/catch`, return `response()->json(['success' => true, 'data' => $data])`, map exceptions via `errorResponse`.
  - **Test:** `tests/Feature/Messages/SharedContentTest.php` — endpoint integration test.
  - **Covers:** FR-08, AC-15
  - **Depends on:** TASK-02
  - **Done when:** Controller correctly dispatches to query and returns formatted JSON.

- [ ] **TASK-04 — Register shared-content route in employee.php**
  - **Files:** `routes/api/employee.php` (Modify)
  - **Change:** Add `Route::get('/conversations/{id}/shared-content', [MessagesController::class, 'getSharedContent']);` under the existing `messages` prefix group.
  - **Test:** `php artisan route:list --path=shared-content` — confirms route registration.
  - **Covers:** FR-08, AC-03
  - **Depends on:** TASK-03
  - **Done when:** Route is registered and reachable under `/api/employee/messages/conversations/{id}/shared-content`.

---

## 6. Phase 3 — Frontend Integration

- **Goal:** Build the mobile and web shared media viewer modal, single entry-point buttons, and jump-to-message navigation.
- **Exit check:** User can open Channel Info or Contact Info, click `View all media, files and links`, view all 4 tabs, and jump to original messages.

- [ ] **TASK-05 — Extend messagesApi with getSharedContent**
  - **Files:** `resources/views/mobapp/src/module/employee/messages/services/messages.api.ts` (Modify)
  - **Change:** Add `getSharedContent(conversationId: number, tab?: string, page?: number, limit?: number)` method returning typed `SharedContentResponse`.
  - **Test:** TypeScript compilation test.
  - **Covers:** FR-02, AC-03
  - **Depends on:** TASK-04
  - **Done when:** API method cleanly invokes `api/employee/messages/conversations/${conversationId}/shared-content`.

- [ ] **TASK-06 — Implement SharedMediaViewerModal component (Mobile)**
  - **Files:** `resources/views/mobapp/src/module/employee/messages/components/SharedMediaViewerModal.tsx` (Create)
  - **Change:** Build fullscreen modal with:
    - Header with back chevron, title (e.g. `#general` or colleague name), and subtitle "Shared media, files & links"
    - Segmented tabs: `Images (N)`, `Videos (N)`, `Files (N)`, `Links (N)`
    - Images tab: 3-column responsive grid with aspect ratio thumbnails; tap opens existing `ImageViewerModal`
    - Videos tab: Video card list with play badge, duration/size, sender; tap opens existing `VideoPlayerModal`
    - Files tab: Document card list with file type icons, name, size, sender, date, and download action
    - Links tab: Reused `LinkPreviewCard` list with domain, title, description, favicon; tap opens via `WebBrowser.openBrowserAsync`
    - Jump to message action on all items invoking `onJumpToMessage(messageId, replyToId)`
    - Skeleton loaders, pull-to-refresh, infinite scroll pagination, and custom empty states per tab
  - **Test:** Component rendering and tab switching test.
  - **Covers:** FR-02, FR-03, FR-04, FR-05, FR-06, FR-07, AC-03, AC-04, AC-05, AC-06, AC-07, AC-08, AC-09, AC-10, AC-11, AC-12, AC-13, AC-14, AC-18
  - **Depends on:** TASK-05
  - **Done when:** Component smoothly renders all 4 categories and handles item selection.

- [ ] **TASK-07 — Add single entry-point button to GroupDetailsDrawer**
  - **Files:** `resources/views/mobapp/src/module/employee/messages/components/GroupDetailsDrawer.tsx` (Modify)
  - **Change:** In the `Channel Details` card (alongside "Members" and "Pinned messages"), add exactly one menu row:
    - Icon: `Image` or `FolderOpen` (color: theme heading)
    - Title: `View all media, files and links`
    - Subtitle: `Photos, videos, documents & shared links`
    - Chevron right
    - Tapping opens `SharedMediaViewerModal` (or transitions view)
    - Ensure NO other separate media/file/link buttons are added
  - **Test:** Mobile view inspection in GroupDetailsDrawer.
  - **Covers:** FR-01, AC-01
  - **Depends on:** TASK-06
  - **Done when:** Button is rendered as the single media entry point in Channel Info.

- [ ] **TASK-08 — Add single entry-point button to ColleagueProfileDrawer**
  - **Files:** `resources/views/mobapp/src/module/employee/messages/components/ColleagueProfileDrawer.tsx` (Modify)
  - **Change:** In the `Profile Details` card (alongside "Profile Information" and "Pinned messages"), add exactly one menu row:
    - Icon: `Image` or `FolderOpen`
    - Title: `View all media, files and links`
    - Subtitle: `Photos, videos, documents & shared links`
    - Chevron right
    - Tapping opens `SharedMediaViewerModal`
    - Ensure NO other separate media/file/link buttons are added
  - **Test:** Mobile view inspection in ColleagueProfileDrawer.
  - **Covers:** FR-01, AC-02
  - **Depends on:** TASK-06
  - **Done when:** Button is rendered as the single media entry point in Contact Info.

- [ ] **TASK-09 — Wire Jump-to-Message navigation in ConversationScreen**
  - **Files:** `resources/views/mobapp/src/module/employee/messages/pages/ConversationScreen.tsx` (Modify)
  - **Change:** Connect `onJumpToMessage(messageId, replyToId)` from drawers and `SharedMediaViewerModal`:
    - Dismiss modal and drawer
    - If `replyToId` is present (thread reply): call `handleViewOriginalThread(messageItem, messageId)` to launch `ThreadModal` and highlight reply
    - If root message: scroll `listRef` to target index and set `setTargetHighlightMessageId(messageId)` with 2.5s timeout
  - **Test:** Manual check MT-02 and regression tests.
  - **Covers:** FR-07, AC-13, AC-14
  - **Depends on:** TASK-07, TASK-08
  - **Done when:** Tapping "Go to message" smoothly navigates to stream location or thread modal.

- [ ] **TASK-10 — Create SharedMediaViewerModal component for Web**
  - **Files:** `resources/views/web/src/module/employee/messages/components/SharedMediaViewerModal.vue` (Create)
  - **Change:** Build desktop modal with 4 tabs (Images, Videos, Files, Links) using PrimeVue / Tailwind, supporting counts, grid preview, file download, external URL launch, and jump-to-message event `$emit('jump-to-message', item)`.
  - **Test:** Component mount and tab switch check.
  - **Covers:** FR-01, FR-02, FR-03, FR-04, FR-05, FR-06, AC-01, AC-03
  - **Depends on:** TASK-04
  - **Done when:** Web modal cleanly renders categorized media.

- [ ] **TASK-11 — Integrate single button in Web Chat Header & Profile Modal**
  - **Files:** `resources/views/web/src/module/employee/messages/pages/Messages.vue` (Modify)
  - **Change:** Add `View all media, files and links` button to the conversation header action bar and employee profile modal; wire modal visibility to open `SharedMediaViewerModal.vue`.
  - **Test:** `npm run build` in web directory.
  - **Covers:** FR-01, AC-01, AC-02
  - **Depends on:** TASK-10
  - **Done when:** Web users can access the viewer via the single entry-point button.

---

## 7. Phase 4 — Validation

- **Goal:** Verify all Acceptance Criteria (AC-01 through AC-18) and ensure end-to-end functionality.
- **Exit check:** All automated tests green and manual walkthrough complete.

- [ ] **TASK-12 — Execute test suites and walk Acceptance Criteria**
  - **Files:** `tests/Feature/Messages/SharedContentTest.php`
  - **Change:** Run full PHPUnit suite `php artisan test --filter=SharedContentTest`, verify zero errors, execute manual testing scenarios MT-01, MT-02, MT-03.
  - **Covers:** AC-01 through AC-18
  - **Depends on:** TASK-01 through TASK-11
  - **Done when:** `php artisan test --filter=SharedContentTest` outputs green (100% pass) and MT-01..MT-03 pass.

---

## 8. Acceptance Walk

| AC | Exercised By | Command / Steps | Task |
| --- | --- | --- | --- |
| AC-01 | Manual & Component | Open `GroupDetailsDrawer` in mobile app; verify exactly 1 entry button | TASK-07 |
| AC-02 | Manual & Component | Open `ColleagueProfileDrawer` in mobile app; verify exactly 1 entry button | TASK-08 |
| AC-03 | Automated & Manual | `php artisan test --filter=SharedContentTest` (test_returns_all_category_counts) | TASK-01, TASK-02, TASK-06 |
| AC-04 | Manual | Switch tabs in `SharedMediaViewerModal`; verify in-place tab transition | TASK-06 |
| AC-05 | Automated & Manual | `php artisan test --filter=SharedContentTest` (test_filters_images_tab) | TASK-02, TASK-06 |
| AC-06 | Manual | Tap image in grid; verify `ImageViewerModal` opens | TASK-06 |
| AC-07 | Automated & Manual | `php artisan test --filter=SharedContentTest` (test_filters_videos_tab) | TASK-02, TASK-06 |
| AC-08 | Manual | Tap video in list; verify `VideoPlayerModal` plays video | TASK-06 |
| AC-09 | Automated & Manual | `php artisan test --filter=SharedContentTest` (test_filters_files_tab) | TASK-02, TASK-06 |
| AC-10 | Manual | Tap download file action; verify file opens/downloads | TASK-06 |
| AC-11 | Automated & Manual | `php artisan test --filter=SharedContentTest` (test_extracts_and_deduplicates_links) | TASK-02, TASK-06 |
| AC-12 | Manual | Tap link card; verify in-app browser opens destination URL | TASK-06 |
| AC-13 | Manual | Tap "Go to message" on root message; verify scroll & highlight | TASK-09 |
| AC-14 | Manual | Tap "Go to message" on thread reply; verify `ThreadModal` opens | TASK-09 |
| AC-15 | Automated | `php artisan test --filter=SharedContentTest` (test_unauthorized_conversation_access_denied) | TASK-01, TASK-02 |
| AC-16 | Automated | `php artisan test --filter=SharedContentTest` (test_deleted_messages_attachments_excluded) | TASK-01, TASK-02 |
| AC-17 | Automated | `php artisan test --filter=SharedContentTest` (test_pagination_performance) | TASK-01, TASK-02 |
| AC-18 | Manual | Open shared viewer in empty conversation; verify empty state | TASK-06, TASK-10 |

---

## 9. Commands for the User

*N/A — No schema migrations, database seeders, or native rebuilds required. All required tables and columns already exist.*

---

## 10. Plan Change Log

| Plan Revision | Date | Spec Version | Change | Changed Tasks |
| --- | --- | --- | --- | --- |
| 1 | 2026-10-14 | 1.0 | Created plan | All |
