# Implementation Plan — Web Messaging Redesign: Facebook Floating Dock & Slack Workplace Hybrid

## Metadata

| Field | Value |
| --- | --- |
| Project Name | SubHRMS |
| Ticket Number | T00004 |
| Feature Name | Web Messaging Redesign — Facebook Dock & Slack Workplace Communication Hybrid |
| Specification | `.agents/specs/subhrms/T00004/spec.md` |
| Based on Spec Version | 1.1 |
| Plan Revision | 2 |
| Created Date | 2026-10-15 |
| Plan Status | Ready |

---

## 1. Technical Context

| Aspect | Value |
| --- | --- |
| Project | SubHRMS (resolved from `package.json` with Vue 3, Pinia, vue-router, Tailwind CSS v4, Laravel Echo) |
| Backend | Laravel 11 (`app/Http/Controllers/employee/MessagesController.php`, `app/Queries/Messages/`, `app/Handlers/Messages/`) |
| Frontend | Vue 3 Composition API (`<script setup>`), Pinia store, `resources/views/web/src/module/employee/messages/` |
| HTTP client | `@/app/axios/axiosInstance` (returns AxiosResponse, access payload with `.data`) |
| State | Pinia store `useMessagesStore` in `resources/views/web/src/module/employee/messages/store/messages.store.ts` and `useFloatingChat.ts` |
| Database conventions | SubHRMS conventions (index only, soft delete via status column, no real foreign keys) |
| Design system | Tailored Tailwind CSS tokens with dark-mode parity (`dark:bg-slate-800`, `text-slate-900 dark:text-slate-100`, `border-slate-200 dark:border-slate-700`) |
| Reference implementation | Mobile messaging MVP (`resources/views/mobapp/src/module/employee/messages/` & `.agents/specs/subhrms/T00001/specs.md`) |
| Checks | `npm run build`, `npm run dev` |
| Tests | Backend: `php artisan test --filter=Messages` · Frontend: component & unit verification via Vitest / Playwright |

---

## 2. Reuse Map

| Artifact | Searched | Found | Decision |
| --- | --- | --- | --- |
| `MessagesController.php` | `app/Http/Controllers/employee/MessagesController.php` | Present | REUSE — already implements all conversation, message, reaction, thread, seen, and read endpoints |
| `HeaderBarComponets.vue` | `resources/views/web/src/components/custom/Navbar/HeaderBarComponets.vue` | Present | EXTEND — update message icon click to toggle `MessagesPopover.vue` instead of routing to `/messages` |
| `messages.utils.ts` | `resources/views/web/src/module/employee/messages/utils/messages.utils.ts` | Present | EXTEND — add `formatLatestMessagePreview` (sync with `T00001`) and 5-minute message clustering helper |
| `messages.store.ts` | `resources/views/web/src/module/employee/messages/store/messages.store.ts` | Present | EXTEND — expose floating dock state, active thread root, chat info panel toggle, and seamless full-view handoff |
| `MessagesPopover.vue` | `resources/views/web/src/module/employee/messages/components/` | NONE | CREATE — Facebook-style quick access dropdown anchored to header message button |
| `FloatingChatDock.vue` | `resources/views/web/src/module/employee/messages/components/` | NONE | CREATE — persistent bottom-right floating dock manager for active and minimized chat windows |
| `FloatingChatWindow.vue`| `resources/views/web/src/module/employee/messages/components/` | NONE | CREATE — individual floating chat box with header controls, Slack feed, composer, and thread overlay |
| `MessagesSidebar.vue` | `resources/views/web/src/module/employee/messages/components/MessagesSidebar.vue` | Present | EXTEND — modernize to Facebook Messenger Chats sidebar (header with actions, search input, filter pills `All`, `Unread`, `Channels`, `DMs`, and unread blue dots) |
| `SlackMessageFeed.vue` | `resources/views/web/src/module/employee/messages/components/` | NONE | CREATE — Slack-inspired workplace message feed replacing consumer chat bubbles |
| `SlackMessageRow.vue` | `resources/views/web/src/module/employee/messages/components/` | NONE | CREATE — left-aligned message unit with badges, 5-minute collapsing, reactions, thread pill, seen avatars |
| `ChatInfoAccordion.vue`| `resources/views/web/src/module/employee/messages/components/` | NONE | CREATE — Facebook-style right column info panel (Profile, Quick Action buttons, accordions for Chat Info, Media/Files, Linked Tickets, Settings) |
| `SlackThreadPanel.vue` | `resources/views/web/src/module/employee/messages/components/` | NONE | CREATE — dedicated thread panel (slide-over for dock, 3rd column for full view) |
| `SlackMessageComposer.vue` | `resources/views/web/src/module/employee/messages/components/` | NONE | CREATE — auto-expanding composer with emoji picker, attachment button, and mentions trigger |
| `useFloatingChat.ts` | `resources/views/web/src/module/employee/messages/composables/` | NONE | CREATE — composable managing open, minimized, and active docked chat windows |
| `Messages.vue` | `resources/views/web/src/module/employee/messages/pages/Messages.vue` | Present | EXTEND — complete 3-column Facebook Messenger layout connecting left sidebar, center Slack feed, and right info accordion panel |

---

## 3. File Change Map

| # | Path | Action | Task | Covers |
| --- | --- | --- | --- | --- |
| 1 | `resources/views/web/src/module/employee/messages/utils/messages.utils.ts` | Modify | TASK-01 | FR-03, FR-07 |
| 2 | `resources/views/web/src/module/employee/messages/composables/useFloatingChat.ts` | Create | TASK-02 | FR-02, FR-08 |
| 3 | `resources/views/web/src/module/employee/messages/store/messages.store.ts` | Modify | TASK-03 | FR-02, FR-04, FR-08, FR-11 |
| 4 | `resources/views/web/src/module/employee/messages/components/popover/MessagesPopover.vue` | Create | TASK-04 | FR-01, FR-07 |
| 5 | `resources/views/web/src/components/custom/Navbar/HeaderBarComponets.vue` | Modify | TASK-05 | FR-01 |
| 6 | `resources/views/web/src/module/employee/messages/components/feed/SlackMessageRow.vue` | Create | TASK-06 | FR-03, FR-05, FR-06 |
| 7 | `resources/views/web/src/module/employee/messages/components/feed/SlackMessageFeed.vue` | Create | TASK-07 | FR-03, FR-05, FR-09 |
| 8 | `resources/views/web/src/module/employee/messages/components/composer/SlackMessageComposer.vue` | Create | TASK-08 | FR-03, FR-06 |
| 9 | `resources/views/web/src/module/employee/messages/components/thread/SlackThreadPanel.vue` | Create | TASK-09 | FR-04 |
| 10 | `resources/views/web/src/module/employee/messages/components/dock/FloatingChatWindow.vue` | Create | TASK-10 | FR-02, FR-04, FR-08 |
| 11 | `resources/views/web/src/module/employee/messages/components/dock/FloatingChatDock.vue` | Create | TASK-11 | FR-02, FR-08 |
| 12 | `resources/views/web/src/layouts/ModernAppLayout.vue` | Modify | TASK-12 | FR-02 |
| 13 | `resources/views/web/src/module/employee/messages/components/MessagesSidebar.vue` | Modify | TASK-13 | FR-10 |
| 14 | `resources/views/web/src/module/employee/messages/components/info/ChatInfoAccordion.vue` | Create | TASK-14 | FR-11 |
| 15 | `resources/views/web/src/module/employee/messages/pages/Messages.vue` | Modify | TASK-15 | FR-03, FR-04, FR-08, FR-10, FR-11 |
| 16 | `tests/Feature/Messages/WebMessagesTest.php` | Create | TASK-16 | FR-01 to FR-11, AC-01 to AC-26 |

---

## 4. Phase 1 — Preparation

- **Goal:** Establish utilities, state composables, and type definitions required for docked floating chat, 3-column full view, and Slack-style message formatting.
- **Exit check:** TypeScript compilation / build succeeds without errors; utilities return expected preview strings and clustering maps.

- [ ] **TASK-01 — Add Message Preview and Clustering Utilities**
  - **Files:** `resources/views/web/src/module/employee/messages/utils/messages.utils.ts` (Modify)
  - **Change:** Implement `formatLatestMessagePreview(message)` following `T00001` contract (Text, `Sent a photo`, `Sent a video`, `Sent a voice message`, `Sent a file`, `No messages yet`); implement `shouldGroupWithPrevious(currentMsg, prevMsg)` checking 5-minute threshold and same sender ID.
  - **Test:** Unit test asserting correct preview string output for each message type and correct grouping boolean.
  - **Covers:** FR-03, FR-07, AC-09, AC-18
  - **Depends on:** None
  - **Done when:** `formatLatestMessagePreview` and `shouldGroupWithPrevious` produce verified results.

- [ ] **TASK-02 — Create Floating Chat Dock Composable**
  - **Files:** `resources/views/web/src/module/employee/messages/composables/useFloatingChat.ts` (Create)
  - **Change:** Implement reactive state `dockedWindows` (max 2 open windows + minimized overflow tray), `openFloatingChat(conversationId)`, `minimizeChat(conversationId)`, `expandToFullView(conversationId)`, and `closeChat(conversationId)`.
  - **Test:** Composable state test asserting that opening a 3rd window auto-minimizes the oldest, and expand navigates to `/messages`.
  - **Covers:** FR-02, FR-08, AC-04, AC-05, AC-06, AC-07, AC-19, AC-20
  - **Depends on:** TASK-01
  - **Done when:** Docked windows state accurately tracks open, minimized, and closed chat windows.

- [ ] **TASK-03 — Extend Messages Pinia Store for Threads, Right Info Panel, and Dock Synchronization**
  - **Files:** `resources/views/web/src/module/employee/messages/store/messages.store.ts` (Modify)
  - **Change:** Add `activeThreadRoot`, `threadReplies`, `seenReceipts`, `showChatInfoPanel`, and helper methods `toggleChatInfoPanel()`, `openThread(rootMessage)`, `closeThread()`, and `sendThreadReply(text, isBroadcast)`. Ensure active conversation state can be hydrated by either floating chat or full-view page.
  - **Test:** Store test verifying thread replies loading and thread reply broadcast insertion.
  - **Covers:** FR-02, FR-04, FR-08, FR-11, AC-11, AC-12, AC-13, AC-15, AC-25
  - **Depends on:** TASK-02
  - **Done when:** `messages.store.ts` provides complete reactive interface for threads, floating chat, and info panel.

---

## 5. Phase 2 — Backend

- **Goal:** Verify that existing backend endpoints and Echo channels are fully prepared for web thread replies, reactions, and seen receipts.
- **Exit check:** `php artisan test --filter=Messages` passes on backend.

- [ ] **TASK-04 (Backend Verification) — Verify Backend Contract Parity for Web Consumers**
  - **Files:** `tests/Feature/Messages/MessagesControllerTest.php` (Modify/Verify)
  - **Change:** Validate that `POST /api/employee/messages/conversations/{id}/messages` correctly handles `parent_id` and `is_thread_broadcast` payloads and returns formatted response keys.
  - **Test:** `tests/Feature/Messages/MessagesControllerTest.php` — asserts 200 OK and JSON structure matching spec contract.
  - **Covers:** FR-04, FR-05, FR-06, AC-08, AC-13, AC-14
  - **Depends on:** None
  - **Done when:** Backend feature test passes with zero failures.

---

## 6. Phase 3 — Frontend Integration

- **Goal:** Build the complete UI layer: Navbar popover, floating chat dock with minimize/expand, Facebook Messenger-style 3-column full view with Slack message feed, and collapsible right-hand info accordion panel.
- **Exit check:** All Vue components mount without errors; `npm run build` succeeds; user can chat in floating dock and 3-column full view.

- [ ] **TASK-05 — Implement Quick Access Messages Popover**
  - **Files:** `resources/views/web/src/module/employee/messages/components/popover/MessagesPopover.vue` (Create)
  - **Change:** Build dropdown containing: header with unread badge, debounced search bar, horizontal active colleagues presence reel, filter chips (`All`, `Channels`, `DMs`, `Unread`), conversation items with avatars, delivery ticks, and `formatLatestMessagePreview` text, and "See all in Full View" footer button.
  - **Test:** Component mount test verifying filter chip clicks, search debounce filtering, and conversation card click emitting select event.
  - **Covers:** FR-01, FR-07, AC-01, AC-02, AC-03
  - **Depends on:** TASK-01, TASK-03
  - **Done when:** Popover displays smoothly and updates lists dynamically based on search and tabs.

- [ ] **TASK-06 — Integrate Popover into Navbar Header Bar**
  - **Files:** `resources/views/web/src/components/custom/Navbar/HeaderBarComponets.vue` (Modify)
  - **Change:** Replace `goToMessages` direct route navigation with toggling `showMessagesPopover`. Mount `<MessagesPopover>` inside an anchored relative container with outside-click dismiss.
  - **Test:** Clicking navbar message icon toggles popover visibility and does not trigger `router.push('/messages')`.
  - **Covers:** FR-01, AC-01
  - **Depends on:** TASK-05
  - **Done when:** Clicking message icon in navbar opens popover without full-page navigation.

- [ ] **TASK-07 — Build Slack-Style Message Row Component**
  - **Files:** `resources/views/web/src/module/employee/messages/components/feed/SlackMessageRow.vue` (Create)
  - **Change:** Render message in left-aligned gutter: avatar (36x36px), name, role badge, timestamp; collapse header if grouped within 5 minutes; dual-color mentions (`@current_user` in golden chestnut, `@other_user` in slate); attachments rendering; emoji reaction counter pills; thread preview pill (`💬 {count} replies`); seen avatars; floating micro-action bar on hover.
  - **Test:** Component test verifying 5-minute collapsing class, mention styling, and thread indicator display.
  - **Covers:** FR-03, FR-05, FR-06, AC-08, AC-09, AC-10, AC-11, AC-15, AC-16
  - **Depends on:** TASK-01
  - **Done when:** Message row displays with full Slack styling, reactions, and thread pills.

- [ ] **TASK-08 — Build Slack-Style Message Feed Component**
  - **Files:** `resources/views/web/src/module/employee/messages/components/feed/SlackMessageFeed.vue` (Create)
  - **Change:** Render chronological stream using `SlackMessageRow.vue`, date dividers, typing indicator ("{User} is typing..."), auto-scroll to bottom with scroll-to-bottom button when scrolled up, and empty state.
  - **Test:** Component test asserting auto-scroll behavior on new message and date divider rendering.
  - **Covers:** FR-03, FR-09, AC-08, AC-21, AC-22
  - **Depends on:** TASK-07
  - **Done when:** Feed scrolls smoothly, renders messages chronologically, and updates on real-time events.

- [ ] **TASK-09 — Build Slack Message Composer Component**
  - **Files:** `resources/views/web/src/module/employee/messages/components/composer/SlackMessageComposer.vue` (Create)
  - **Change:** Auto-expanding textarea (`min-h-[40px] max-h-[120px]`), Enter to send (Shift+Enter for newline), emoji picker toggle button, file attachment button, mention suggestions popup when `@` is typed.
  - **Test:** Test verifying Enter triggers submit, Shift+Enter adds newline, and empty message submit is blocked.
  - **Covers:** FR-03, FR-06, EC-01, AC-08
  - **Depends on:** TASK-01
  - **Done when:** Composer allows typing, attaching files, inserting emojis, and sending messages cleanly.

- [ ] **TASK-10 — Build Slack Thread Slide-Over Panel Component**
  - **Files:** `resources/views/web/src/module/employee/messages/components/thread/SlackThreadPanel.vue` (Create)
  - **Change:** Root message card at top, scrollable thread replies stream, and dedicated thread composer with "Also send to channel" checkbox.
  - **Test:** Component test asserting reply submission emits `is_thread_broadcast` and appends to thread list.
  - **Covers:** FR-04, AC-11, AC-12, AC-13
  - **Depends on:** TASK-08, TASK-09
  - **Done when:** Thread panel loads replies, sends thread responses, and toggles channel broadcasting.

- [ ] **TASK-11 — Build Individual Floating Chat Window Component**
  - **Files:** `resources/views/web/src/module/employee/messages/components/dock/FloatingChatWindow.vue` (Create)
  - **Change:** Compact floating window (360x480px) with header (avatar, name, online dot, minimize `—`, expand `⛶`, close `✕`), body housing `SlackMessageFeed`, slide-over overlay for `SlackThreadPanel`, and footer housing `SlackMessageComposer`.
  - **Test:** Clicking minimize collapses window; clicking expand navigates to `/messages`; clicking close triggers teardown.
  - **Covers:** FR-02, FR-04, FR-08, AC-04, AC-07, AC-19, AC-20
  - **Depends on:** TASK-02, TASK-08, TASK-09, TASK-10
  - **Done when:** Floating chat window operates autonomously with full messaging and thread capability.

- [ ] **TASK-12 — Build Global Floating Chat Dock Manager and Mount in Root Layout**
  - **Files:**
    - `resources/views/web/src/module/employee/messages/components/dock/FloatingChatDock.vue` (Create)
    - `resources/views/web/src/layouts/ModernAppLayout.vue` (Modify)
  - **Change:** Implement `FloatingChatDock.vue` rendering active `FloatingChatWindow`s and minimized tabs at bottom-right. Mount `<FloatingChatDock />` globally in `ModernAppLayout.vue`. Automatically hide dock when current route is `/messages`.
  - **Test:** Floating dock renders across various portal pages (e.g. `/dashboard`, `/employees`) and disappears on `/messages`.
  - **Covers:** FR-02, FR-08, EC-05, AC-04, AC-05, AC-06
  - **Depends on:** TASK-11
  - **Done when:** Floating dock persists seamlessly during navigation and handles multiple chat windows.

- [ ] **TASK-13 — Modernize Left Chats Sidebar for Full View**
  - **Files:** `resources/views/web/src/module/employee/messages/components/MessagesSidebar.vue` (Modify)
  - **Change:** Upgrade sidebar to match Facebook Messenger layout: large "Chats" title, `...` options, compose button, search input with rounded filter pills (`All`, `Unread`, `Channels`, `Direct Messages`), and conversation list items with avatar, online green dot, snippet, relative timestamp, and solid blue unread dot.
  - **Test:** Clicking filter pills updates displayed conversation items; selecting a conversation highlights active row.
  - **Covers:** FR-10, AC-23, AC-24
  - **Depends on:** TASK-01
  - **Done when:** Left sidebar delivers sleek Facebook Messenger aesthetic.

- [ ] **TASK-14 — Build Right-Hand Collapsible Chat Info & Accordion Panel**
  - **Files:** `resources/views/web/src/module/employee/messages/components/info/ChatInfoAccordion.vue` (Create)
  - **Change:** Build Facebook-style right panel:
    1. Profile header (72x72px avatar with green dot, full name, role/dept, corporate verified status).
    2. Quick action buttons (`Profile`, `Mute`, `Search`).
    3. Collapsible accordions with carets:
       - **Chat Info** (channel description, member count, created date).
       - **Active Thread** (when a thread is open, embeds `SlackThreadPanel.vue`).
       - **Media & Files** (photo thumbnails grid, video list, document download cards).
       - **Linked HR Tickets** (leave/overtime card, status badge, timeline).
       - **Privacy & Settings** (mute toggle, leave channel, archive).
  - **Test:** Accordions expand/collapse on click; quick actions emit corresponding events; media tab displays attachments.
  - **Covers:** FR-11, AC-25, AC-26
  - **Depends on:** TASK-01, TASK-03, TASK-10
  - **Done when:** Right panel provides comprehensive context accordion matching reference design.

- [ ] **TASK-15 — Implement 3-Column Full View Messages Page**
  - **Files:** `resources/views/web/src/module/employee/messages/pages/Messages.vue` (Modify)
  - **Change:** Connect `MessagesSidebar.vue` (Left Column), `SlackMessageFeed.vue` + `SlackMessageComposer.vue` (Center Column with header featuring `(i)` button), and `ChatInfoAccordion.vue` (Right Column). Add smooth collapse transition for the right column when `(i)` is toggled.
  - **Test:** Full view loads conversation specified by `route.query.conversation_id`; `(i)` button toggles right panel smoothly.
  - **Covers:** FR-03, FR-04, FR-08, FR-10, FR-11, SC-03, SC-05, AC-20, AC-23, AC-25
  - **Depends on:** TASK-08, TASK-09, TASK-13, TASK-14
  - **Done when:** Full view page renders identical 3-column architecture from user reference with modern Slack workplace aesthetics.

---

## 7. Phase 4 — Validation

- **Goal:** Execute end-to-end acceptance walk, verify all acceptance criteria (AC-01 to AC-26), and validate build integrity.
- **Exit check:** `npm run build` succeeds; zero console errors on popover, dock, and 3-column full view; all manual scenarios MT-01 to MT-05 verified.

- [ ] **TASK-16 — End-to-End Walkthrough and Validation Suite**
  - **Files:** `tests/Feature/Messages/WebMessagesTest.php` (Create)
  - **Change:** Run automated backend tests for messaging; execute manual test walk MT-01 through MT-05 covering popover, floating dock, 3-column full view, thread replies, seen avatars, and accordion panel.
  - **Covers:** AC-01 to AC-26, MT-01 to MT-05
  - **Depends on:** TASK-01 to TASK-15
  - **Done when:** Build compiles cleanly (`npm run build`), all tests pass, and user flow is confirmed.

---

## 8. Acceptance Walk

| AC | Exercised By | Command / Steps | Task |
| --- | --- | --- | --- |
| AC-01 | Manual | MT-01: Click message icon in navbar; verify `MessagesPopover` opens without route change | TASK-05, TASK-06 |
| AC-02 | Manual | MT-01: Type in popover search bar; verify debounced filter | TASK-05 |
| AC-03 | Manual | MT-01: Click "See all in Full View"; verify navigation to `/messages` | TASK-05, TASK-15 |
| AC-04 | Manual | MT-02: Click conversation in popover; verify floating chat opens at bottom-right | TASK-10, TASK-11 |
| AC-05 | Manual | Open 2nd conversation; verify side-by-side docking | TASK-11 |
| AC-06 | Manual | Open 3rd conversation; verify oldest collapses to dock pill | TASK-02, TASK-11 |
| AC-07 | Manual | Click close button (`✕`); verify window unmounts and Echo unsubscribes | TASK-10 |
| AC-08 | Manual | MT-02: Inspect message rows in floating chat; verify Slack layout and badges | TASK-07, TASK-08 |
| AC-09 | Manual | Send 2 messages within 5 min; verify 2nd message collapses header/avatar | TASK-01, TASK-07 |
| AC-10 | Manual | Inspect message with `@JaneSmith` and `@JohnDoe`; verify dual-color tokens | TASK-07 |
| AC-11 | Manual | Inspect message with replies; verify `💬 {count} replies` pill | TASK-07, TASK-10 |
| AC-12 | Manual | MT-05: Click "Reply in thread"; verify `SlackThreadPanel` slides over | TASK-10 |
| AC-13 | Manual | MT-05: Check "Also send to channel" and send reply; verify broadcast in main feed | TASK-10, TASK-16 |
| AC-14 | Manual | Open unread conversation; verify read receipt API call and badge clear | TASK-08 |
| AC-15 | Manual | Inspect message read by colleagues; verify small seen avatars below message | TASK-07 |
| AC-16 | Manual | Hover over message; verify micro-action bar appears | TASK-07 |
| AC-17 | Manual | Click `👍` emoji reaction; verify reaction counter pill increments | TASK-07 |
| AC-18 | Unit | Run unit test for `formatLatestMessagePreview`; verify `"Sent a photo"`, etc. | TASK-01 |
| AC-19 | Manual | Click minimize (`—`); verify window collapses to 42px bottom pill | TASK-10, TASK-11 |
| AC-20 | Manual | Click expand (`⛶`); verify navigation to `/messages?conversation_id={id}` | TASK-10, TASK-15 |
| AC-21 | Manual | Send message from another browser session; verify real-time arrival via Echo | TASK-08 |
| AC-22 | Manual | Type in another session; verify typing indicator displays and clears | TASK-08 |
| AC-23 | Manual | MT-03: View `/messages` on desktop; verify 3 distinct columns render side-by-side | TASK-13, TASK-14, TASK-15 |
| AC-24 | Manual | MT-03: In Left Column on `/messages`, click filter pill `Unread`; verify filtered list | TASK-13 |
| AC-25 | Manual | MT-04: In Center Column header on `/messages`, click `(i)` button; verify right panel toggles | TASK-15 |
| AC-26 | Manual | MT-04: In Right Column on `/messages`, expand "Media & files" accordion; verify media tabs | TASK-14 |

---

## 9. Commands for the User

| Order | Command / Action | When | Rollback |
| --- | --- | --- | --- |
| 1 | `npm run build` | After TASK-15 | Revert touched Vue files via git checkout |

---

## 10. Plan Change Log

| Plan Revision | Date | Spec Version | Change | Changed Tasks |
| --- | --- | --- | --- | --- |
| 2 | 2026-10-15 | 1.1 | Incorporate Facebook Messenger 3-column Full View architecture (Chats sidebar with filter pills, Slack feed, Right ChatInfoAccordion panel) based on user reference screenshot | Added TASK-13, TASK-14, TASK-15; updated TASK-16, §8, Metadata |
| 1 | 2026-10-15 | 1.0 | Created initial plan for Web Messaging Redesign | All (TASK-01 to TASK-14) |
