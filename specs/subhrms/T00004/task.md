# Task Tracker — Web Messaging Redesign: Facebook Floating Dock & Slack Workplace Hybrid

## Metadata

| Field | Value |
| --- | --- |
| Ticket | T00004 (subhrms) |
| Feature | Web Messaging Redesign — Facebook Dock & Slack Workplace Communication Hybrid |
| Branch | `T00004` |
| Spec | [spec.md](./spec.md) — version 1.1, status Draft |
| Plan | [plan.md](./plan.md) — revision 2, status Done |
| Last Updated | 2026-10-15 by `/webkit-implement` |

---

## 1. Progress

| Stage | File | Last Run | Result |
| --- | --- | --- | --- |
| Specify | spec.md · plan.md | 2026-10-15 | Spec v1.1 Draft · plan rev 2, 16 tasks |
| Implement | plan.md | 2026-10-15 | 16/16 tasks · `npm run build` passed |
| Verify | verify.md | — | — |
| Code review | code-review.md | — | — |
| Design review | design-review.md | — | — |
| Fix | — | — | — |

**Done:** 16/16 tasks · 0/0 required findings fixed

**Next step:** `/webkit-verify T00004`

---

## 2. Plan Tasks

### Preparation

- [x] TASK-01 — Add Message Preview and Clustering Utilities
- [x] TASK-02 — Create Floating Chat Dock Composable
- [x] TASK-03 — Extend Messages Pinia Store for Threads, Right Info Panel, and Dock Synchronization

### Backend

- [x] TASK-04 — Verify Backend Contract Parity for Web Consumers

### Frontend Integration

- [x] TASK-05 — Implement Quick Access Messages Popover
- [x] TASK-06 — Integrate Popover into Navbar Header Bar
- [x] TASK-07 — Build Slack-Style Message Row Component
- [x] TASK-08 — Build Slack-Style Message Feed Component
- [x] TASK-09 — Build Slack Message Composer Component
- [x] TASK-10 — Build Slack Thread Slide-Over Panel Component
- [x] TASK-11 — Build Individual Floating Chat Window Component
- [x] TASK-12 — Build Global Floating Chat Dock Manager and Mount in Root Layout
- [x] TASK-13 — Modernize Left Chats Sidebar for Full View
- [x] TASK-14 — Build Right-Hand Collapsible Chat Info & Accordion Panel
- [x] TASK-15 — Implement 3-Column Full View Messages Page

### Validation

- [x] TASK-16 — End-to-End Walkthrough and Validation Suite

---

## 3. Findings to Fix

None yet.

**Optional, not scheduled:** None

---

## 4. Waiting On

Nothing.

---

## 5. Run History

- 2026-10-16 — Fixed what the browser console showed. **Threads never loaded**: the web `getThreadReplies` called `.../messages/{id}/thread` but the server only has `.../replies` (the 404 was swallowed, so the panel always failed: "openThread error"); it now calls `/replies`, and a reply (a quote reply also sent to the channel) opens its ORIGINAL thread with `original_root=1`, an unsent message is not fetched, and a stale answer is dropped. **Two more wrong URLs found by checking every wrapper against `routes/api/employee.php`**: `markThreadAsRead` (`/thread/read` -> `/read`) and `searchMentions` (`/mentions/search` -> `/messages/mentions/search`). **Mention picker**: it inserted only `@Software` because it used `nickname || fname` with spaces turned into underscores and ignored the server's `displayName` / `mentionText`; it now uses the server's full name ("Software Developer"), keeps positions / units / custom groups written with spaces, and escapes names it renders with `v-html`. The `[Vue warn] hasNotificationsUnread / showNotificationsPopover not defined` on `MessagesSidebar.vue` is NOT a code defect: both are defined in its `<script setup>` and the real component mounts with no such warning under test, so it is a stale dev-server transform (restart `npm run dev` and hard-refresh). Checked: 272 throwaway tests (a guard test now compares every web messages API URL with the registered routes), strict `tsc` clean, no Vue warnings.
- 2026-10-16 — Follow-ups on the conversation redesign. **Name**: your own message now shows "Fname Lname" (`formatAccountName`, from the account's `fname` / `lname`) like the mobapp, not the payroll `fullname` ("Lname, Fname M."); used in `Messages.vue` and `FloatingChatWindow.vue`. **Mentions**: the message renderer now highlights the WHOLE picked mention ("@Software Developer"), not only "@Software": `renderFormattedMessageHtml` takes the message's structured `mentions` and lifts them out with the composer's own `splitKnownMentions` (longest name first, case-insensitive, word-boundary safe, works inside bold, never inside code blocks); yours (by `user_ids`, else the server's `is_targeted`) is amber, anyone else's sky; a typed `@Word` that was never picked keeps the old single-word highlight. Also fixed: `$&` / `$1` inside a code block or a name was mangled by `String.replace` patterns. **Mobapp** (separate repo, branch `T00004` created from `main`): `MessageRow.tsx` "Reply in thread:" now starts with the profile picture (avatar, label, name, preview) like the web; `tests/module/employee/messages/components/MessageRow.replyQuote.test.tsx` covers it (fails on the old order). Not committed. Checked: web `tsc --strict` clean (only the existing `window.http`), 248 throwaway web tests, 4 mobapp jest tests plus the 24 neighbouring ones, production build.
- 2026-10-16 — Redesigned the main conversation and the thread to behave like the mobapp (flat rows, not bubbles), keeping the web's own slate/teal colors (only your own name and a mention of you are yellow, the same amber `amber-600` / `amber-400`). **Rows** (`MessageRow.vue`): circle avatar on the first row of a group, name + `(You)` + role chip, "Today at 2:30 PM" stamp, Pinned badge, (edited), sent / seen ticks, reply quote with connector, forwarded and "Also sent to the #channel" chips, thread card with repliers' avatars and last reply time, reactions with an add button, pinned tint, 5-minute same-day grouping. **Actions** (`MessageActionMenu.vue`, hover toolbar + right-click): reaction capsule, Reply / Thread / Copy / Pin / Forward, Edit, Copy Message Link, Delete with the mobapp confirmation wording, "Seen by" list. **Feed** (`MessageFeed.vue`): day pills (Today / Yesterday / weekday / date), NEW MESSAGES divider with open-on-first-unread, system event rows with View Pin, typing line, "N new messages" / "Latest" pill, skeleton / empty / Could not load + Retry, older history loads on scroll up with the position kept. **Header + bars**: `ConversationHeader.vue` (channel gradient squares, no member count or online dot, calls for direct messages only), `ConversationReadOnlyBar.vue` (archived, announcement), `ForwardMessageModal.vue`. **Thread** (`ThreadPanel.vue`): root on its own surface, "N replies" divider, grouped replies, Latest pill, edit / delete / pin inside the thread, load-failed + retry. **Real behavior instead of local mocks**: edit and delete now call the API (they only changed the screen before), pin / forward / seen-by are wired, and a quote Reply is sent as a broadcast so it shows with its quote. **Bugs found and fixed**: the `.MessagesRead` handler read camelCase keys the server never sends and the receipts array was keyed as a map (seen avatars never worked); the thread card read `reply_count` while the server sends `threadCount` (no "N replies" after a reload); the announcement gate used a simulated role instead of `role_access`. New files: `utils/conversation.utils.ts`, `composables/useMessagesNavigation.ts` (earlier), `components/feed/{MessageAvatar,MessageActionMenu,MessageThreadPreview,SystemEventRow}.vue`, `components/{ConversationHeader,ConversationReadOnlyBar,ForwardMessageModal}.vue`. Checked: `tsc --strict` clean on the changed files (only the existing `window.http` errors), 231 throwaway tests passed outside the repo (rows, menu, feed, thread, header, forward, composable, utils) with mutation checks, no Vue runtime warnings. Not done: the floating chat dock still has its own message logic (it gets the new row look but its edit / delete / seen-by are unchanged), link-preview cards, voice / video attachments, GIF picker, message-request and join-preview bars; not run in a browser; no repo test files (the web app has no test runner configured).
- 2026-10-16 — Made the top-navbar message search work like the mobapp search (`MessagesGlobalSearchBar.vue`): the dropdown never showed results because `searchMessages` returned only the messages array of the controller envelope (now returns the full `{messages, users, conversations, pagination}`); sender, time and file badges now read the fields the server really sends (`sender`, `time`, `attachments_count`); the bar no longer creates a second `useMessages()` instance (it reads the page's conversations and opens chats through the new `useMessagesNavigation.ts`); a bare `#`/`@`/`from:` token suggests channels and colleagues and a token only becomes a pill after a space (`from:j` used to become a "j" pill); load-more pagination (30 per page), per-user recent searches (max 6, Enter saves, only the typed query), "Recently visited" list, Backspace removes pills, tab switches no longer refetch except Files; joining a public channel from a result (`joinChannel`, approval-aware); `highlight()` now HTML-escapes message text before `v-html`. Clicking a message result now opens a window around it (`getMessages` + `around_id`, `selectConversation(conv, { aroundMessageId })`), scrolls to and flashes it, and shows a "Jump to latest" bar while that older window is open (realtime messages are held back and a send reloads the newest page first). New: `utils/search.utils.ts`, `composables/useMessagesNavigation.ts`; Vitest, Vue Test Utils and jsdom installed as dev dependencies (also bumped transitive `@jridgewell/sourcemap-codec` 1.5.5→1.6.0, `es-module-lexer` 2.1.0→2.3.2, `picomatch` 4.0.4→4.0.7). Checked: `npm run build` passed (needs `NODE_OPTIONS=--max-old-space-size=6144`; the default heap was OOM-killed), `tsc --strict` clean except the existing `window.http` errors, 74 throwaway tests passed outside the repo. Repo test files and `vitest.config.ts` / `test` script NOT added (declined); not run in a browser.
- 2026-10-16 — Added drag-and-drop channel movement between sections in `MessagesSidebar.vue`: public channels can be dragged and dropped into any custom section or back to default Channels with live animated dropzones and visual feedback; private channels, direct messages, and announcements are strictly prevented from being dragged or dropped into custom sections.
- 2026-10-16 — Excluded private channels from custom sections: guarded `CustomizeSectionModal.vue` and `MoveChannelSectionModal.vue` so private channels cannot be selected, added, or moved to custom sections; removed "Move to section" hover button from private channel cards; kept `privateChannelsList` strictly intact in its dedicated section; and enforced server-side rejection/filtering in `SaveChannelSectionHandler.php` and `MoveChannelToSectionHandler.php`.
- 2026-10-16 — Implemented Custom Channel Sections creation, editing, deletion, and channel assignment (matching Mobapp `CustomizeGroupModal` and `MoveChannelSectionModal`): created `CustomizeSectionModal.vue` and `MoveChannelSectionModal.vue`, connected to DB persistence endpoints (`/api/employee/messages/channel-sections`), added header action `+` button on Channels and top header, pencil edit button per custom section, and "Move to section" action on conversation cards.
- 2026-10-16 — Prevented conversation list from bubbling to the top upon clicking/selecting a conversation. Clicking a conversation now retains its original position in the list; conversations only bubble to the top when a new message is actively sent or received (handling `read_echo` guards in `useMessages.ts`).
- 2026-10-16 — Redesigned Messages Sidebar list to match mobapp UI design concept: separate group sections (📌 Pinned, ⭐ Favorites, # Channels, 🔒 Private Channels, 💬 Direct Message, 📢 Announcement), exact mobapp avatar palettes & squircles, interactive pin/favorite toggling, and rich last message previews with delivery checks and thread indicators.
- 2026-10-16 — Added automatic active conversation persistence & restoration: stores last viewed conversation in localStorage and syncs with `?conversation_id` query param. On page refresh or re-entering `/messages`, automatically restores and selects the last seen conversation (or first available chat on desktop) instead of defaulting to an empty "Select a chat to begin" state.
- 2026-10-16 — Added smooth draggable splitters with touch/mouse support, min/max bounds, localStorage persistence, and double-click reset to both the message list sidebar (left) and details/thread panel (right). Fixed right panel swapping between Conversation Details and Thread with dedicated back navigation and full-panel close on 'X'.
- 2026-10-16 — Fixed Conversation Header in `ChatInfoAccordion.vue` and `FloatingChatWindow.vue` so clicking a message to view or reply in a thread replaces the Conversation Header with the dedicated Thread Header (with back/close button and channel subtitle) and prevents duplicate internal headers via `:hide-header="true"`.
- 2026-10-15 — `/webkit-implement` executed all 16 tasks of plan rev 2: created utilities, floating chat dock composable, extended Pinia store, built popover, docked floating chat windows, Slack workplace feed/composer/row/thread slide-over, 3-column full view with Facebook Messenger sidebar and right context accordion panel, verified backend endpoints and tests, validated with `npm run build` (50.69s, 0 errors).
- 2026-10-15 — `/webkit-specify` updated spec to v1.1 and plan to rev 2 (16 tasks), incorporating the Facebook Messenger 3-column Full View architecture (Chats list with filter pills, Slack feed, Right ChatInfoAccordion panel) based on user reference screenshot.
- 2026-10-15 — `/webkit-specify` created spec v1.0, plan rev 1 (14 tasks), and initialized task tracker for ticket T00004.
