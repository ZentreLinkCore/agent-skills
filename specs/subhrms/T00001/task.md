# Task Tracker — Mobile App Messaging Full MVP Redesign (Slack-Inspired Workplace Communication)

## Metadata

| Field | Value |
| --- | --- |
| Ticket | T00001 (subhrms) |
| Feature | Mobile App Messaging Full MVP Redesign (Slack-Inspired Workplace Communication) |
| Branch | `T00001` |
| Spec | [specs.md](./specs.md) — version v4, status not recorded in the file |
| Plan | [plan.md](./plan.md) — revision 2, status Draft |
| Last Updated | 2026-10-14 by `/webkit-fix` |

---

## 1. Progress

| Stage | File | Last Run | Result |
| --- | --- | --- | --- |
| Specify | specs.md · plan.md | 2026-10-13 | Spec v4 · plan rev 2, 34 tasks |
| Implement | plan.md | 2026-10-14 | 1/34 tasks ticked (the build predates plan.md; TASK-11 ticked by /webkit-fix) |
| Verify | verify.md | 2026-10-14 | v6 — ✅ PASS (1 AC pending manual check) |
| Code review | code-review.md | 2026-10-14 | v2 — CHANGES REQUIRED (after fix pass v2.1): 101 findings (1 CRITICAL, 22 HIGH, 56 MEDIUM, 22 LOW), 95 closed; open #5, #9 (HIGH), #43, #47, #78, #79 (MEDIUM); v1 re-check: 36 hold, 7 reopened in part, 4 open |
| Design review | design-review.md | 2026-09-16 | v4 — all 4 HIGH, 3 MEDIUM and 1 LOW resolved; D8 and D9 deferred |
| Fix | code-review.md | 2026-10-14 | `--code-review` pass v1.1: 20 of 23 MEDIUM and LOW closed · pass v1.2: CRITICAL and HIGH, 23 of 24 closed (#23 partly done) · pass v2.1 (all severities of run v2): 95 of 101 closed, each with a test (5 traced, 5 equivalent changes); #5, #9, #43, #47, #78, #79 open |

**Done:** 1/34 tasks · 95/101 findings of code-review v2 fixed (CRITICAL 1/1, HIGH 20/22, MEDIUM 52/56, LOW 22/22); 6 open, 2 of them HIGH · code-review v1: 43 closed items kept below as history

**Next step:** decide #5 (a removed member's live feed) and #9 (web client), then `/webkit-fix T00001 --code-review` for what is left; `/webkit-code-review T00001` re-reviews the 10 traced and equivalent closures; the fix pass is not committed yet (backend and mobile are separate repos)

---

## 2. Plan Tasks

### Preparation

- [ ] TASK-01 — Confirm the baseline
- [ ] TASK-02 — Feature-test base class

### Backend

- [ ] TASK-03 — Guard the four unguarded conversation-scoped endpoints
- [ ] TASK-04 — Inactive callers never see System-channel messages in search
- [ ] TASK-05 — Extract the search parser into a pure method
- [ ] TASK-06 — Reject empty and over-long messages
- [ ] TASK-07 — Dedupe a replayed send within 2 seconds
- [ ] TASK-08 — Apply the manager-channel gate everywhere a conversation is read
- [ ] TASK-09 — Unique index on conversation_members
- [ ] TASK-10 — Race-safe member-row writes
- [x] TASK-11 — Remove the unused search-engine dependencies
- [ ] TASK-12 — authorise the ticket-status write — BLOCKED (Q-5)
- [ ] TASK-13 — persist message requests — BLOCKED (Q-7)
- [ ] TASK-14 — attachment limits — BLOCKED (Q-1)
- [ ] TASK-15 — one definition of unread — BLOCKED (Q-3)
- [ ] TASK-16 — Point the parser tests at the real parser
- [ ] TASK-17 — Test the thread read action
- [ ] TASK-18 — Test the attachment payload
- [ ] TASK-19 — Test the General access action
- [ ] TASK-20 — Feature tests: search and the General guard
- [ ] TASK-21 — Feature tests: read positions, threads, seen receipts
- [ ] TASK-22 — Feature tests: sending and channel rules
- [ ] TASK-23 — Feature tests: pins, events, participants, channel auth

### Frontend Integration

- [ ] TASK-24 — Send `client_id` with every message
- [ ] TASK-25 — Enforce the 4,000-character total and block blank sends in the composer
- [ ] TASK-26 — Remove the local fallback when channel creation fails
- [ ] TASK-27 — Remove the demo tickets
- [ ] TASK-28 — Correct the thread-preview overflow badge
- [ ] TASK-29 — Pulse the recording dot
- [ ] TASK-30 — Show the General description in the channel drawer

### Validation

- [ ] TASK-31 — Run the Tier 1 backend tests
- [ ] TASK-32 — Run the Tier 2 backend tests
- [ ] TASK-33 — Run the static checks
- [ ] TASK-34 — Walk the manual verification

---

## 3. Findings to Fix

- [x] code-review v1 #1 — CRITICAL — Security — arbitrary file deletion through a client-supplied attachment path (`app/Handlers/Messages/DeleteMessageHandler.php`) — fixed 2026-10-14
- [x] code-review v1 #2 — CRITICAL — Security — `reply_to_id` returns the text of any message to any sender (`app/Handlers/Messages/SendMessageHandler.php`) — already resolved 2026-10-14
- [x] code-review v1 #3 — CRITICAL — Security — deep-link mentions copy any message, author and channel name (`app/Actions/Messages/ResolveMentionsAction.php`) — fixed 2026-10-14
- [x] code-review v1 #4 — CRITICAL — Security — `getConversation` returns raw `Account` rows (government IDs) for a disabled conversation (`app/Http/Controllers/employee/MessagesController.php`) — already resolved 2026-10-14
- [x] code-review v1 #5 — HIGH — Database — the join-request unique key makes any second approve or decline fail (`database/migrations/alters/messages/2026_10_04_000001_add_requires_approval_and_create_channel_join_requests.php`) — already resolved 2026-10-14
- [x] code-review v1 #6 — HIGH — Security — the realtime channel rule ignores the inactive-account guard (`routes/channels.php`) — already resolved 2026-10-14
- [x] code-review v1 #7 — HIGH — Security — channel listings bypass `Conversation::visibleTo` (`app/Http/Controllers/employee/MessagesController.php`) — already resolved 2026-10-14
- [x] code-review v1 #8 — HIGH — Security — member add and drop are not restricted to channels, so a DM creator can expose or wipe a DM (`app/Http/Controllers/employee/MessagesController.php`) — already resolved 2026-10-14
- [x] code-review v1 #9 — HIGH — Correctness — approval from a chat card skips the tier workflow, the locks and the transaction (`app/Http/Controllers/employee/MessagesController.php`) — already resolved 2026-10-14
- [x] code-review v1 #10 — HIGH — Performance — each send fans out synchronously inside the database transaction (`app/Handlers/Messages/SendMessageHandler.php`) — already resolved 2026-10-14
- [x] code-review v1 #11 — HIGH — Performance — mentions are re-resolved twice per message on every page load (`app/Queries/Messages/GetMessagesQuery.php`) — fixed 2026-10-14
- [x] code-review v1 #12 — HIGH — Performance — the client controls `limit` and it is not capped (`app/Http/Controllers/employee/MessagesController.php`) — already resolved 2026-10-14
- [x] code-review v1 #13 — HIGH — Performance — the conversation list is N+1 and over-fetches (`app/Queries/Messages/GetConversationsQuery.php`) — fixed 2026-10-14
- [x] code-review v1 #14 — HIGH — Data — a migration seeds invented business data (`database/migrations/2026_09_29_000001_create_custom_mentions_and_add_mentions_to_messages.php`) — already resolved 2026-10-14
- [x] code-review v1 #15 — HIGH — Configuration — the database session time zone is set globally in a messaging branch (`config/database.php`) — already resolved 2026-10-14
- [x] code-review v1 #16 — HIGH — Correctness — Approve and Decline report success when the server refused (`resources/views/mobapp/src/module/employee/messages/pages/ConversationScreen.tsx`) — already resolved 2026-10-14
- [x] code-review v1 #17 — HIGH — Error handling — failures are rendered as empty data, and optimistic actions are never rolled back (`resources/views/mobapp/src/module/employee/messages/services/messages.api.ts`) — already resolved 2026-10-14
- [x] code-review v1 #18 — HIGH — Correctness — direct messages vanish from the inbox based on their text (`resources/views/mobapp/src/module/employee/messages/utils/messagePreview.ts`) — already resolved 2026-10-14
- [x] code-review v1 #19 — HIGH — Correctness — a conversation opened at the unread position has no way to load newer messages (`resources/views/mobapp/src/module/employee/messages/hooks/useChatRoom.ts`) — fixed 2026-10-14
- [x] code-review v1 #20 — HIGH — Reliability — the realtime layer has no recovery path (`resources/views/mobapp/src/services/realtime/echo.ts`) — fixed 2026-10-14
- [x] code-review v1 #21 — HIGH — Performance — every unread event triggers three full refetches, including the whole directory (`resources/views/mobapp/src/module/employee/messages/contexts/MessagesContext.tsx`) — already resolved 2026-10-14
- [x] code-review v1 #22 — HIGH — Security — an attachment name can write outside the cache directory on the device (`resources/views/mobapp/src/utils/mediaSave.ts`) — already resolved 2026-10-14
- [x] code-review v1 #24 — HIGH — Fabricated data — the Notifications tab shows invented notifications (`resources/views/mobapp/src/module/employee/notifications/pages/NotificationsScreen.tsx`) — already resolved 2026-10-14
- [x] code-review v1 #25 — MEDIUM — Correctness — hooks called after an early return in `MessageContent` (`resources/views/mobapp/src/module/employee/messages/components/MessageContent.tsx`) — fixed 2026-10-14
- [x] code-review v1 #27 — MEDIUM — Maintainability — `Schema::hasColumn` guards for columns this branch creates (`app/Models/Conversation.php`) — fixed 2026-10-14
- [x] code-review v1 #28 — MEDIUM — Error handling — raw exception messages and non-HTTP codes become responses (`app/Http/Controllers/employee/MessagesController.php`) — fixed 2026-10-14
- [x] code-review v1 #29 — MEDIUM — Correctness — `createConversation` has no validation or transaction (`app/Http/Controllers/employee/MessagesController.php`) — fixed 2026-10-14
- [x] code-review v1 #30 — MEDIUM — Data — `dropConversation` leaves files and dependent rows (`app/Http/Controllers/employee/MessagesController.php`) — fixed 2026-10-14
- [x] code-review v1 #32 — MEDIUM — Testing — the only test exercises a copy of the parser (`tests/Unit/SearchMessagesSyntaxTest.php`) — fixed 2026-10-14
- [x] code-review v1 #33 — MEDIUM — Dependencies — Scout and Meilisearch are declared and unused (`composer.json`) — fixed 2026-10-14
- [x] code-review v1 #34 — MEDIUM — Configuration — four PHP-limit mechanisms, one harmful, one publicly downloadable (`public/.user.ini`) — fixed 2026-10-14
- [x] code-review v1 #35 — MEDIUM — Unrelated change — the punch cooldown was removed from a messaging branch (`app/Http/Controllers/AttendanceController.php`) — fixed 2026-10-14
- [x] code-review v1 #36 — MEDIUM — Correctness — URLs containing `id=` are rewritten into channel chips (`resources/views/mobapp/src/module/employee/messages/utils/mentionParser.ts`) — fixed 2026-10-14
- [x] code-review v1 #37 — MEDIUM — Correctness — messages you send from another device are dropped (`resources/views/mobapp/src/module/employee/messages/hooks/useChatRoom.ts`) — fixed 2026-10-14
- [x] code-review v1 #38 — MEDIUM — Security — the pinned-message cache survives logout and is not user-scoped (`resources/views/mobapp/src/module/employee/messages/hooks/useChatRoom.ts`) — fixed 2026-10-14
- [x] code-review v1 #39 — MEDIUM — Reliability — retry defeats the server's replay protection (`resources/views/mobapp/src/module/employee/messages/hooks/useChatRoom.ts`) — fixed 2026-10-14
- [x] code-review v1 #40 — MEDIUM — Correctness — a stale thread response overwrites the current thread (`resources/views/mobapp/src/module/employee/messages/pages/ConversationScreen.tsx`) — fixed 2026-10-14
- [x] code-review v1 #41 — MEDIUM — Reliability — the scroll-failure handler retries forever (`resources/views/mobapp/src/module/employee/messages/pages/ConversationScreen.tsx`) — fixed 2026-10-14
- [x] code-review v1 #42 — MEDIUM — Correctness — forwarding drops attachments (`resources/views/mobapp/src/module/employee/messages/components/ForwardMessageModal.tsx`) — fixed 2026-10-14
- [x] code-review v1 #43 — MEDIUM — Performance — every inline video autoplays, unmuted and looping (`resources/views/mobapp/src/module/employee/messages/components/InlineChatVideo.tsx`) — fixed 2026-10-14
- [x] code-review v1 #45 — LOW — Structure — alter migrations outside `alters/` (`database/migrations/2026_09_11_000001_add_is_admin_to_conversation_members_table.php`) — fixed 2026-10-14
- [x] code-review v1 #46 — LOW — Configuration — a hard-coded API key as a fallback (`resources/views/mobapp/src/module/employee/messages/components/GifPickerPanel.tsx`) — fixed 2026-10-14
- [x] code-review v1 #47 — LOW — Performance — `markAllAsRead` runs several queries per conversation (`app/Http/Controllers/employee/MessagesController.php`) — fixed 2026-10-14
- [x] code-review v2 #1 — CRITICAL — Security — one message of repeated emoji freezes every recipient's app (ReDoS in the message parser) (`resources/views/mobapp/src/module/employee/messages/utils/mentionParser.ts`) — fixed 2026-10-14
- [x] code-review v2 #2 — HIGH — Security — any employee can join a manager-only channel and then receives live previews of its messages (`app/Handlers/Messages/JoinChannelHandler.php`) — fixed 2026-10-14
- [x] code-review v2 #3 — HIGH — Security — mention search ignores the manager-only rule and hand-rolls the visibility check (`app/Queries/Messages/SearchMentionsQuery.php`) — fixed 2026-10-14
- [x] code-review v2 #4 — HIGH — Security — the link-preview SSRF guard is silently disabled, so DNS rebinding still works (`app/Queries/Messages/GetLinkPreviewQuery.php`) — fixed, equivalent change 2026-10-14
- [ ] code-review v2 #5 — HIGH — Security — a removed or departed member keeps receiving the private channel live (`routes/channels.php`) — open: needs a decision (terminate the sockets, thin the shared-channel payloads, or accept in the spec)
- [x] code-review v2 #6 — HIGH — Correctness — `DeleteMessageHandler` broadcasts a wrong unread count, does N+1 work and unlinks files before the commit (`app/Handlers/Messages/DeleteMessageHandler.php`) — fixed 2026-10-14
- [x] code-review v2 #7 — HIGH — Correctness — `GetConversationsQuery` returns `last_read_message_id` = 0 for every conversation (`app/Queries/Messages/GetConversationsQuery.php`) — fixed 2026-10-14
- [x] code-review v2 #8 — HIGH — Performance — a message page still costs O(messages) queries for cards, links and unresolved `@` (v1 #11 reopened in part) (`app/Queries/Messages/GetMessagesQuery.php`) — fixed 2026-10-14
- [ ] code-review v2 #9 — HIGH — Data — pre-existing replies vanish from the room list, and so do replies sent by the unchanged web client (`database/migrations/alters/messages/2026_09_16_000001_add_is_thread_broadcast_to_messages_table.php`) — open (partial): the back-fill migration is done; the web client needs a decision (send the flag or retire the web messenger)
- [x] code-review v2 #10 — HIGH — Data integrity — the punch timestamp conversion in `AttendanceController::record` is untested (`app/Http/Controllers/AttendanceController.php`) — fixed 2026-10-14
- [x] code-review v2 #11 — HIGH — Testing — authorization and security controls ship without refusal tests (`tests/Feature/Messages`) — fixed 2026-10-14
- [x] code-review v2 #12 — HIGH — Correctness — a read flush can clear unread messages that were never loaded (v1 #19 reopened) (`resources/views/mobapp/src/module/employee/messages/hooks/useChatRoom.ts`) — fixed 2026-10-14
- [x] code-review v2 #13 — HIGH — Correctness — jumping to an old message leaves a block of messages that can never be loaded (`resources/views/mobapp/src/module/employee/messages/hooks/useChatRoom.ts`) — fixed 2026-10-14
- [x] code-review v2 #14 — HIGH — Error handling — a failing `/recipients` call blanks the whole inbox (regression from the v1 #17 fix) (`resources/views/mobapp/src/module/employee/messages/contexts/MessagesContext.tsx`) — fixed 2026-10-14
- [x] code-review v2 #15 — HIGH — Reliability — closing the second screen of the same conversation unsubscribes the first (`resources/views/mobapp/src/services/realtime/echo.ts`) — fixed 2026-10-14
- [x] code-review v2 #16 — HIGH — Correctness — the deep-link scroll effect has no run-once guard and scrolls back to the old target on every list change (`resources/views/mobapp/src/module/employee/messages/pages/ConversationScreen.tsx`) — fixed 2026-10-14
- [x] code-review v2 #17 — HIGH — Fabricated data — `ApplicationDetailModal` shows invented shifts and times as the request's details, with Approve and Decline enabled (`resources/views/mobapp/src/components/modals/ApplicationDetailModal.tsx`) — fixed 2026-10-14
- [x] code-review v2 #18 — HIGH — Configuration — the `expo-image-picker` config plugin is missing, so "Take photo" aborts iOS native builds (`resources/views/mobapp/app.json`) — fixed, equivalent change 2026-10-14
- [x] code-review v2 #19 — HIGH — Error handling — a failed channel update is reported as success (`resources/views/mobapp/src/module/employee/messages/components/ManageChannelModal.tsx`) — fixed 2026-10-14
- [x] code-review v2 #20 — HIGH — Data integrity — picking a channel photo sends a device file path that breaks the avatar for every member (`resources/views/mobapp/src/module/employee/messages/components/ManageChannelModal.tsx`) — fixed 2026-10-14
- [x] code-review v2 #21 — HIGH — Correctness — tapping a channel tile in the Active Team strip creates or opens a DM with an unrelated colleague (`resources/views/mobapp/src/module/employee/messages/pages/MessagesScreen.tsx`) — fixed 2026-10-14
- [x] code-review v2 #22 — HIGH — Error handling — section edits and pin / favorite have no rollback and are never persisted (`resources/views/mobapp/src/module/employee/messages/pages/MessagesScreen.tsx`) — fixed 2026-10-14
- [x] code-review v2 #23 — HIGH — Fabricated data — controls and copy state effects and guarantees the product does not have (`resources/views/mobapp/src/module/employee/messages/pages/MessagesMoreScreen.tsx`) — fixed 2026-10-14
- [x] code-review v2 #24 — MEDIUM — Authorization — `updateConversation` is not restricted to channels and validates nothing (`app/Http/Controllers/employee/MessagesController.php`) — fixed 2026-10-14
- [x] code-review v2 #25 — MEDIUM — Authorization — a co-admin can remove the Lead Admin, who keeps every admin power (`app/Handlers/Messages/RemoveConversationMemberHandler.php`) — fixed 2026-10-14
- [x] code-review v2 #26 — MEDIUM — Security — `EditMessageHandler` authorizes by `sender_id` only (`app/Handlers/Messages/EditMessageHandler.php`) — fixed 2026-10-14
- [x] code-review v2 #27 — MEDIUM — Data exposure — `getMessages` reveals who is typing in a conversation the caller cannot read, and issues one cache query per member (`app/Http/Controllers/employee/MessagesController.php`) — fixed 2026-10-14
- [x] code-review v2 #28 — MEDIUM — Validation — `attachments[]` is unbounded and `type` / `size` are unvalidated (`app/Handlers/Messages/SendMessageHandler.php`) — fixed 2026-10-14
- [x] code-review v2 #29 — MEDIUM — Validation — `addConversationMembers` does not validate `member_ids` (`app/Handlers/Messages/AddConversationMembersHandler.php`) — fixed 2026-10-14
- [x] code-review v2 #30 — MEDIUM — Error handling — `errorResponse` maps framework exceptions to 500 and leaks their messages (`app/Http/Controllers/employee/MessagesController.php`) — fixed 2026-10-14
- [x] code-review v2 #31 — MEDIUM — Security — legacy cross-conversation `reply_to_id` rows still leak on read, and thread statistics cross conversations (`app/Queries/Messages/GetMessagesQuery.php`) — fixed 2026-10-14
- [x] code-review v2 #32 — MEDIUM — Security — the 💬 chip text still tells an outsider that a private channel exists (v1 #3 reopened in part) (`app/Actions/Messages/ResolveMentionsAction.php`) — fixed 2026-10-14
- [x] code-review v2 #33 — MEDIUM — Data integrity — a `message_link` chip for a message that does not exist keeps the client-supplied author, text and channel (`app/Actions/Messages/ResolveMentionsAction.php`) — fixed 2026-10-14
- [x] code-review v2 #34 — MEDIUM — Correctness — system events broadcast a hard-coded `unread_count: 1` (`app/Actions/Messages/RecordSystemEventAction.php`) — fixed 2026-10-14
- [x] code-review v2 #35 — MEDIUM — Correctness — `MessagePinUpdated` broadcasts a message formatted for the pinner (`app/Handlers/Messages/TogglePinMessageHandler.php`) — fixed 2026-10-14
- [x] code-review v2 #36 — MEDIUM — Correctness — thread replies are silently truncated, and `has_more` is wrong and never sent (`app/Queries/Messages/GetThreadRepliesQuery.php`) — fixed 2026-10-14
- [x] code-review v2 #37 — MEDIUM — Performance — search runs one query per own-DM hit (`app/Queries/Messages/SearchMessagesQuery.php`) — fixed 2026-10-14
- [x] code-review v2 #38 — MEDIUM — Performance — the `read_receipts` payload is unbounded and sent with every page, including empty `since_id` polls (`app/Queries/Messages/GetMessagesQuery.php`) — fixed 2026-10-14
- [x] code-review v2 #39 — MEDIUM — Performance — every member of the conversation is hydrated for `$memberIds` that nothing uses effectively (`app/Actions/Messages/ResolveMentionsAction.php`) — fixed 2026-10-14
- [x] code-review v2 #40 — MEDIUM — Duplication — `getEmployeeProfile` re-implements approver resolution and diverges from it (`app/Http/Controllers/employee/MessagesController.php`) — fixed 2026-10-14
- [x] code-review v2 #41 — MEDIUM — Reliability — a retry reuses the `clientId`, but the server only de-duplicates within 2 seconds (v1 #39 reopened in part) (`app/Handlers/Messages/SendMessageHandler.php`) — fixed, equivalent change 2026-10-14
- [x] code-review v2 #42 — MEDIUM — Data — the seeder and the migration disagree on whether "Company Announcements" is a system channel, and the seeder resets edited rows (`database/seeders/ConversationSeeder.php`) — fixed 2026-10-14
- [ ] code-review v2 #43 — MEDIUM — Maintainability — non-messaging changes ride on the messaging branch (`app/Http/Controllers/AttendanceController.php`) — open: ticket split, needs a decision
- [x] code-review v2 #44 — MEDIUM — Testing — the fixes and the extracted approval handler have no committed regression tests (`tests/Feature/Messages`) — fixed 2026-10-14
- [x] code-review v2 #45 — MEDIUM — Testing — 14 of the 16 migrations have no schema test, and the unique-member migration's data-safety branch is untested (`database/migrations/alters/messages/2026_10_13_000001_add_unique_member_index_to_conversation_members_table.php`) — fixed 2026-10-14
- [x] code-review v2 #46 — MEDIUM — Testing — `ChannelAuthorizationTest` passes only because the developer's `.env` has Pusher credentials (`tests/Feature/Messages/ChannelAuthorizationTest.php`) — fixed 2026-10-14
- [ ] code-review v2 #47 — MEDIUM — Architecture — `MessagesController` is still not thin (v1 #26, still open) (`app/Http/Controllers/employee/MessagesController.php`) — open (partial): 3 Handlers and 3 Queries extracted, the controller is 2,261 → about 1,676 lines; 7 methods still inline
- [x] code-review v2 #48 — MEDIUM — Correctness — the system channel is still identified by literals, in more places than recorded (v1 #31, still open) (`app/Handlers/Messages/SendMessageHandler.php`) — fixed 2026-10-14
- [x] code-review v2 #49 — MEDIUM — Correctness — the composer's pasted-link detection is host-agnostic, so a third-party URL becomes a message chip and the URL is lost (v1 #36 reopened for this file) (`resources/views/mobapp/src/module/employee/messages/components/MessageInputBar.tsx`) — fixed 2026-10-14
- [x] code-review v2 #50 — MEDIUM — Privacy — recent searches persist across logout and are shown to the next account on the device (`resources/views/mobapp/src/module/employee/messages/components/MessagesSearchModal.tsx`) — fixed 2026-10-14
- [x] code-review v2 #51 — MEDIUM — Correctness — editing a message sends only the text, so the server re-guesses mentions by first name (`resources/views/mobapp/src/module/employee/messages/pages/ConversationScreen.tsx`) — fixed 2026-10-14
- [x] code-review v2 #52 — MEDIUM — Correctness — your own thread replies sent from another device are dropped by the screen (v1 #37 incomplete) (`resources/views/mobapp/src/module/employee/messages/pages/ConversationScreen.tsx`) — fixed (traced) 2026-10-14
- [x] code-review v2 #53 — MEDIUM — Correctness — the thread composer's microphone does nothing (`resources/views/mobapp/src/module/employee/messages/components/ThreadModal.tsx`) — fixed (traced) 2026-10-14
- [x] code-review v2 #54 — MEDIUM — Security — markdown link targets are not allow-listed and the error fallback passes the raw string to `Linking.openURL` (`resources/views/mobapp/src/module/employee/messages/components/MessageContent.tsx`) — fixed 2026-10-14
- [x] code-review v2 #55 — MEDIUM — Error handling — a failed delete is not rolled back in the thread views, the count or the replies cache (v1 #17 reopened in part) (`resources/views/mobapp/src/module/employee/messages/pages/ConversationScreen.tsx`) — fixed 2026-10-14
- [x] code-review v2 #56 — MEDIUM — Correctness — the "NEW MESSAGES" divider appears above the user's own just-sent message (`resources/views/mobapp/src/module/employee/messages/pages/ConversationScreen.tsx`) — fixed 2026-10-14
- [x] code-review v2 #57 — MEDIUM — Performance — the row `React.memo` comparator is defeated, so every mounted row re-renders on each event (`resources/views/mobapp/src/module/employee/messages/pages/ConversationScreen.tsx`) — fixed (traced) 2026-10-14
- [x] code-review v2 #58 — MEDIUM — Correctness — an archived conversation's composer toolbar ignores read-only and a GIF tap posts (`resources/views/mobapp/src/module/employee/messages/components/MessageInputBar.tsx`) — fixed 2026-10-14
- [x] code-review v2 #59 — MEDIUM — Correctness — the long-press action sheet offers server-bound actions on unsent messages (id 0) (`resources/views/mobapp/src/module/employee/messages/components/MessageActionModal.tsx`) — fixed, equivalent change 2026-10-14
- [x] code-review v2 #60 — MEDIUM — Bug prevention — the search modal re-applies the opening channel filter on every parent render, and its "load more" has no stale-response guard (`resources/views/mobapp/src/module/employee/messages/components/MessagesSearchModal.tsx`) — fixed 2026-10-14
- [x] code-review v2 #61 — MEDIUM — Error handling — API methods swallow errors and return empty data, so failures show as "no results" or as a false success (`resources/views/mobapp/src/module/employee/messages/services/messages.api.ts`) — fixed 2026-10-14
- [x] code-review v2 #62 — MEDIUM — Correctness — "Share" shares nothing on Android (`resources/views/mobapp/src/utils/mediaSave.ts`) — fixed 2026-10-14
- [x] code-review v2 #63 — MEDIUM — Performance — every read flush POSTs mark-as-read twice and broadcasts twice (`resources/views/mobapp/src/module/employee/messages/hooks/useChatRoom.ts`) — fixed 2026-10-14
- [x] code-review v2 #64 — MEDIUM — Correctness — the inbox preview rewrites ordinary text into "Sent a file / photo / video / voice message" (the v1 #18 class) (`resources/views/mobapp/src/module/employee/messages/utils/messagePreview.ts`) — fixed 2026-10-14
- [x] code-review v2 #65 — MEDIUM — Correctness — the markdown tokenizer eats mid-word underscores, asterisks and tildes (`resources/views/mobapp/src/module/employee/messages/utils/markdownFormatter.ts`) — fixed 2026-10-14
- [x] code-review v2 #66 — MEDIUM — Reliability — a failed channel authorization leaves a room or the user channel permanently silent (`resources/views/mobapp/src/services/realtime/echo.ts`) — fixed 2026-10-14
- [x] code-review v2 #67 — MEDIUM — Correctness — `CustomizeGroupModal` wipes the typed name and selection whenever the parent re-renders (`resources/views/mobapp/src/module/employee/messages/components/CustomizeGroupModal.tsx`) — fixed 2026-10-14
- [x] code-review v2 #68 — MEDIUM — Correctness — `getEmployeeProfile` on the client always returns `null` (`resources/views/mobapp/src/module/employee/messages/services/messages.api.ts`) — fixed 2026-10-14
- [x] code-review v2 #69 — MEDIUM — Correctness — Manage Channel loads only the first 30 members (`resources/views/mobapp/src/module/employee/messages/components/ManageChannelModal.tsx`) — fixed 2026-10-14
- [x] code-review v2 #70 — MEDIUM — Correctness — `GroupDetailsDrawer` member search and pagination state go wrong (`resources/views/mobapp/src/module/employee/messages/components/GroupDetailsDrawer.tsx`) — fixed 2026-10-14
- [x] code-review v2 #71 — MEDIUM — Correctness — the Message Requests screen classifies conversations by the word "external" (`resources/views/mobapp/src/module/employee/messages/pages/MessageRequestsScreen.tsx`) — fixed 2026-10-14
- [x] code-review v2 #72 — MEDIUM — Data integrity — saving a section whose name already exists replaces that section's channels on the server (`resources/views/mobapp/src/module/employee/messages/pages/MessagesScreen.tsx`) — fixed 2026-10-14
- [x] code-review v2 #73 — MEDIUM — Fabricated data — invented job titles and departments for colleagues without them (`resources/views/mobapp/src/module/employee/messages/components/DirectMessageHoldModal.tsx`) — fixed 2026-10-14
- [x] code-review v2 #74 — MEDIUM — Performance — the Active Team strip mounts the whole directory and every open fetches it unpaged (`resources/views/mobapp/src/module/employee/messages/components/ActiveStoriesRow.tsx`) — fixed 2026-10-14
- [x] code-review v2 #75 — MEDIUM — Performance — `AppTopHeader` fires an extra dashboard request on every mount and focus (`resources/views/mobapp/src/components/dashboard/AppTopHeader.tsx`) — fixed 2026-10-14
- [x] code-review v2 #76 — MEDIUM — Maintainability — large dead code left in the change (`resources/views/mobapp/src/module/employee/notifications/pages/NotificationsScreen.tsx`) — fixed (traced) 2026-10-14
- [x] code-review v2 #77 — MEDIUM — Security — `README.md` publishes the GIPHY key and says it is built in (`resources/views/mobapp/README.md`) — fixed 2026-10-14
- [ ] code-review v2 #78 — MEDIUM — Maintainability — the oversized files are unchanged and the same member-management handlers are duplicated (v1 #44, still open) (`resources/views/mobapp/src/module/employee/messages/components/ManageChannelModal.tsx`) — open (partial): `useChannelMembers` and `getChannelPermissions` extracted; the large files are not split
- [ ] code-review v2 #79 — MEDIUM — Testing — mobile fixes, rollbacks and flows ship without tests (`resources/views/mobapp/src/module/employee/messages`) — open (partial): 8 test files, 66 tests; the stale-thread guard and the scroll-retry bound are not covered
- [x] code-review v2 #80 — LOW — Configuration — `.env.example` documents keys nothing reads, and the timezone test fails if one is set (`.env.example`) — fixed 2026-10-14
- [x] code-review v2 #81 — LOW — Bug prevention — a double tap on "request to join" can return 500, and a join request can be resolved when it is no longer pending (`app/Handlers/Messages/JoinChannelHandler.php`) — fixed 2026-10-14
- [x] code-review v2 #82 — LOW — Bug prevention — pin broadcasts before the commit, and neither toggle is locked or backed by a unique key (`app/Handlers/Messages/TogglePinMessageHandler.php`) — fixed 2026-10-14
- [x] code-review v2 #83 — LOW — Security — the YouTube branch of the link preview claims `youtube.com` for any URL containing a YouTube pattern (`app/Queries/Messages/GetLinkPreviewQuery.php`) — fixed 2026-10-14
- [x] code-review v2 #84 — LOW — Performance — no rate limit on `/link-preview` and `/upload` (`routes/api/employee.php`) — fixed 2026-10-14
- [x] code-review v2 #85 — LOW — Correctness — LIKE wildcards in user input match everything, and an array `q` answers 500 with raw exception text (`app/Queries/Messages/SearchMessagesQuery.php`) — fixed 2026-10-14
- [x] code-review v2 #86 — LOW — Correctness — the free-text `@First` fallback adds a second, different person to a mention (`app/Actions/Messages/ResolveMentionsAction.php`) — fixed 2026-10-14
- [x] code-review v2 #87 — LOW — Correctness — the pinned list reports wrong `read` and `threadCount` (`app/Queries/Messages/GetPinnedMessagesQuery.php`) — fixed 2026-10-14
- [x] code-review v2 #88 — LOW — Performance — `select *` of the wide `vw_accounts_details` where a few columns are used (`app/Queries/Messages/SearchMentionsQuery.php`) — fixed 2026-10-14
- [x] code-review v2 #89 — LOW — Maintainability — dead and duplicated code in the backend messaging classes (`app/Http/Controllers/employee/MessagesController.php`) — fixed 2026-10-14
- [x] code-review v2 #90 — LOW — Security — the Android manifest requests media and location-from-photos permissions the code never uses (`resources/views/mobapp/app.json`) — fixed 2026-10-14
- [x] code-review v2 #91 — LOW — Correctness — substring heuristics silently blank avatars (`resources/views/mobapp/src/hooks/use-initial-profile.ts`) — fixed 2026-10-14
- [x] code-review v2 #92 — LOW — Correctness — copied deep links use a scheme the app does not register (`resources/views/mobapp/src/module/employee/messages/components/MessageActionModal.tsx`) — fixed 2026-10-14
- [x] code-review v2 #93 — LOW — Maintainability — the GIF entry stays visible without a key and the flag meant to hide it has no consumer (`resources/views/mobapp/src/module/employee/messages/components/MessageInputBar.tsx`) — fixed 2026-10-14
- [x] code-review v2 #94 — LOW — Bug prevention — composer state edge cases: an empty code block shows Send, picked code mentions are never reset, side effects run inside `setBlocks` updaters (`resources/views/mobapp/src/module/employee/messages/components/MessageInputBar.tsx`) — fixed 2026-10-14
- [x] code-review v2 #95 — LOW — Resource lifecycle — the voice recorder is not released on unmount, and a short recording leaks in the thread composer (`resources/views/mobapp/src/module/employee/messages/hooks/useAudioRecorder.ts`) — fixed, equivalent change 2026-10-14
- [x] code-review v2 #96 — LOW — Correctness — restoring an archived channel ignores the response and can re-archive it (`resources/views/mobapp/src/module/employee/messages/components/ArchivedChannelsModal.tsx`) — fixed 2026-10-14
- [x] code-review v2 #97 — LOW — Bug prevention — rollback snapshots overwrite newer state (`resources/views/mobapp/src/module/employee/messages/hooks/useChatRoom.ts`) — fixed 2026-10-14
- [x] code-review v2 #98 — LOW — Resource leak — the generation guard in `echo.ts` leaves an unguarded `setupPusher` (`resources/views/mobapp/src/services/realtime/echo.ts`) — fixed 2026-10-14
- [x] code-review v2 #99 — LOW — Bug prevention — the `AuthContext` profile-sync effect makes a duplicate request and has an unguarded continuation (`resources/views/mobapp/src/contexts/AuthContext.tsx`) — fixed 2026-10-14
- [x] code-review v2 #100 — LOW — Testing — `ConversationListQueryCostTest` asserts generated SQL text (`tests/Feature/Messages/ConversationListQueryCostTest.php`) — fixed 2026-10-14
- [x] code-review v2 #101 — LOW — Bug prevention — the reply target of a voice message is cleared only after the upload finishes (`resources/views/mobapp/src/module/employee/messages/pages/ConversationScreen.tsx`) — fixed (traced) 2026-10-14

**Optional, not scheduled:** code-review v2 INFO notes and its 'Specification clarification required' list (v1 #23 continues as the INFO note on `expo-location`) · verify v6: IMPROVEMENT suggestions listed in verify.md · design-review: D8 and D9 deferred, Modern Enhancement Ideas never scheduled

---

## 4. Waiting On

- Spec §10.3 Open Questions Q-1 – Q-7 are open; TASK-12 (Q-5), TASK-13 (Q-7), TASK-14 (Q-1) and TASK-15 (Q-3) are blocked by them, which is why the plan is Draft
- verify v6: 1 acceptance criterion pending a manual check on a device
- Fix pass v2.1 is **not committed**: the backend repo sits on `75ebebff` and the mobile repo on `2f59796` with the pass as working-tree changes; committing is your call
- Decisions for the 6 open findings: #5 (how a removed member's live feed ends), #9 (web client: send `is_thread_broadcast` or retire the web messenger), #43 (split the non-messaging changes into their own ticket)
- Manual steps after the pass: rotate the GIPHY key (it is still in git history, commit `f2f826c`); a database that already ran `2026_09_16_000001_add_is_thread_broadcast…` or `2026_09_29_000001_add_is_system…` needs those two migrations rolled back and re-run (or the equivalent `UPDATE`s) so the back-fills apply, and a seeded 'Company Announcements' row keeps `is_system = 1` until then; run the new `2026_10_14_000001_add_unique_reaction_index…` migration
- code-review v1 #23: a decision on reading the device position (`expo-location` is a new native dependency, needs a permission configuration and a payload field) or on accepting `null` locations
- Spec clarification needed (code-review v2 INFO): whether the server must make an archived conversation read-only, soft versus hard delete of messages, who may use `@all` / `@here`, whether a co-admin may remove the Lead Admin, what "online" and a message request mean, and the other points listed there

---

## 5. Activity Log

- 2026-10-14 · `/webkit-fix T00001 --code-review` (all severities of run v2) · 95 of 101 findings closed, each with a regression test (backend about 45 new test files; mobile 63 jest suites, tests moved to `resources/views/mobapp/tests/`); 5 traced and 5 equivalent closures flagged; #5, #9, #43, #47, #78, #79 open · code-review.md → CHANGES REQUIRED (after fix pass v2.1)
- 2026-10-14 · `/webkit-code-review T00001` (run v2) · 9 read-only reviewers over both repos; v1's 47 findings re-checked (36 hold, 7 reopened in part, 4 open); 101 findings: 1 CRITICAL, 22 HIGH, 56 MEDIUM, 22 LOW · code-review.md → CHANGES REQUIRED
- 2026-10-14 · `/webkit-fix T00001 --code-review` (CRITICAL and HIGH #1–#24) · #1–#22 and #24 closed (17 already resolved, 6 fixed: #1, #3, #11, #13, #19, #20), #23 partly done; regression tests added (backend 14 files, mobile 2 files and the jest-expo runner); spec changelog line added · code-review.md → CHANGES REQUIRED (after fix pass v1.2)
- 2026-10-14 · `/webkit-fix T00001 --code-review fixed all findings for medium and low` · Findings #25, #27–#30, #32–#43, #45–#47 fixed, #26, #31, #44 partly done; TASK-11 ticked; task.md created · code-review.md → CHANGES REQUIRED (after fix pass v1.1)
- 2026-10-14 · `/webkit-verify T00001` · run v6 · ✅ PASS (1 AC pending manual check)
- 2026-10-13 · `/webkit-code-review T00001` · run v1: 4 CRITICAL, 20 HIGH, 20 MEDIUM, 3 LOW · CHANGES REQUIRED
- 2026-10-13 · `/webkit-specify T00001` · spec v4 and plan rev 2 (34 tasks) · plan Draft
