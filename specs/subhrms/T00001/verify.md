# Webkit Verification Report

## Metadata

| Field | Value |
| --- | --- |
| Ticket | T00001 (subhrms) |
| Branch | `T00001` — backend repo: base `origin/master`, 40 commits, 73 files changed at HEAD `fc999da2` (= `origin/T00001`), **plus uncommitted edits in the working tree: 15 modified files and 1 new file (+632 / −568 lines)**; mobile repo `resources/views/mobapp` (`hrms-react-native`): base `origin/main`, 52 commits, 122 files changed at HEAD `c3130cc` (= `origin/T00001`), **plus 11 modified files uncommitted**. The `DockerTemplate` repository (nginx) still holds one uncommitted change on its own `T00001` branch. This run verifies the working tree. |
| Specification File | [specs.md](./specs.md) — version v4 with the Minor corrections of 2026-10-13 (AC-67, AC-73, AC-101, §3.2, §4.5, §6.4, MT-2); unchanged since run v3; status not recorded in the file; Open Questions Q-1 – Q-7 (§10.3) are open and were not graded |
| Verification Date | 2026-10-14 |
| Verification Run | v7 — scoped re-check after the improvements pass (Improvements #1, #2, #7, #9, #12, #16, #21, #22, #23, #25, #26, #32 fixed, #10 partly); no new finding, status unchanged. Earlier v6 note: closes the run. Findings #1 – #3 of run v5 (linked-ticket ownership, tickets conjured from text, unread-event sync) re-verified fixed by `/webkit-fix T00001 --verify` (uncommitted working tree); every earlier suite re-executed, 58 new checks aimed at getting around the fixes, and the sibling broadcasters of `UnreadCountUpdated` read for the same flaw as Finding #3. No new finding; two small consequences of the ownership rule are recorded as Improvements #32 and #33 |

**Implementation Scope**

- **Frontend:** `resources/views/mobapp/src/module/employee/messages/` (components, pages, hooks, contexts, utils, services) and routes under `src/app/(app)/messages/`, as at HEAD, plus 11 uncommitted edits: `module/employee/messages/{hooks/useChatRoom.ts, pages/ConversationScreen.tsx, contexts/MessagesContext.tsx, services/messages.api.ts, types.ts, utils/messagePreview.ts}`, `services/realtime/echo.ts`, `utils/mediaSave.ts`, `module/employee/attendance/hooks/useTimeInOut.ts`, `module/employee/notifications/pages/NotificationsScreen.tsx`, `app/(app)/(tabs)/_layout.tsx` (the last three are outside the messaging specification).
- **Backend:** `MessagesController`, `app/Queries/Messages/*`, `app/Handlers/Messages/*`, `app/Actions/Messages/*`, `app/Events/Messages/*`, `routes/channels.php`, as at HEAD, plus the uncommitted edits to `ResolveMentionsAction`, `SendMessageHandler`, `DeleteMessageHandler`, `MessagesController`, `GetConversationsQuery`, `GetMessagesQuery`, `GetPinnedMessagesQuery`, `GetThreadRepliesQuery`, `SearchMessagesQuery`, `ApprovalRequestController`, `UnreadCountUpdated`, `routes/channels.php`, and the new `app/Handlers/Approval/ProcessApprovalDecisionHandler.php` (the manager portal's approval transaction, shared by the portal and the chat card).
- **Database:** the 9 messaging alter migrations of run v1 and `2026_10_13_000001_add_unique_member_index_to_conversation_members_table.php`; uncommitted: the sample-group seed was removed from `2026_09_29_000001_create_custom_mentions_and_add_mentions_to_messages.php`.
- **Other:** `config/database.php` and `app/Providers/AppServiceProvider.php` are back to `origin/master` (the `+08:00` session time zone and `date_default_timezone_set` are gone, uncommitted); `tests/Unit/SearchMessagesSyntaxTest.php`; `composer.json` / `config/scout.php`; `docker/nginx/default.conf.template` in `DockerTemplate` (uncommitted).

---

## 1. Verification Summary

### Overall Status

✅ PASS (1 AC pending manual check)

### Summary

**Run v7 (scoped):** the improvements pass was re-checked by reading the code and running `php -l`, `php artisan route:list` (route set unchanged), `SearchMessagesSyntaxTest` (15 passed) and `npx tsc --noEmit` (exit 0). The earlier uncommitted fixes are now committed (HEAD `1639158b`); the working tree holds only this pass (2 backend files, 6 mobile files). The device-only checks and the disposable-database execution suites were **not** re-run. Not re-run does not mean failed: runs v1 – v6 stand for everything this pass did not touch.

The three findings of run v5 are fixed and hold. A linked ticket must now be the sender's own application (`422 "Invalid ticket."` otherwise) and is described from the application, so the original exploit no longer returns the victim's remarks; typing `#LV-2026-001` no longer conjures a card; and the unread event keeps the global badge and the inbox previews in sync without letting a read echo rewrite a preview. I tried to get around the ownership rule with cross-table document-number collisions, prefix confusion, case, wildcard and SQL-looking ids, edits, and every read path (pinned, thread, single message, around, search, list): nothing leaks. All 270 execution checks of runs v1 – v5 pass again. 109 of 110 acceptance criteria are met; AC-26 (back navigation keeps scroll and badges) needs a device. No blocker, no required fix, no specification change. 33 optional improvements remain (§3). The fixes of code-review #1 – #24 and of runs v5 are still uncommitted in both repositories.

---

## 2. Specification Compliance

| Specification Area | Status | Notes |
| --- | --- | --- |
| Scope | PASS | The web messaging module is at base. Unrelated edits still ride on the branch (Suggestions #1, #2). |
| User Flow | PASS | Landing, New Chat, Create Channel, conversation, threads, search, seen avatars and the approval card flow (tier by tier) work. |
| Functional Requirements | PASS | §6.1 rules 1 – 9 hold: no ticket card exists unless it is the sender's own application (rule 9, executed), manager channels, announcements, duplicate DM guard, optimistic sends, read positions, seen avatars and thread read positions. |
| Non-functional Requirements | PASS | §6.2: concurrency, idempotency (AC-94), validation limits, error shapes and the performance checklist hold; a page of 25 plain messages costs 16 queries (was 116). |
| Technical Design | PASS | 43 routes match §4.1 and the contracts checked by execution match; §5.2 `MessagesContext` unread sync now follows `.UnreadCountUpdated` (global count and rows). |
| Acceptance Criteria | PASS | 109/110 met. Manual: AC-26 (§6). AC-8 and AC-9, partial in run v5, are met again (the read echo no longer rewrites a preview). |
| Edge Cases | PASS | Replay, concurrent first reads, two approvers racing for one tier, inactive accounts, manager channels, rollback of a send, hostile attachment paths and ticket ids, a 510-reply thread, a non-numeric `limit` and a burst of unread events were executed. |
| Security Requirements | PASS | Every authorization, validation and data-exposure check of runs v1 – v5 re-executed clean, including the ownership of a linked ticket (§4). |

---

## 3. Findings

### BLOCKER

None. Finding #1 of run v5 is fixed: `app/Handlers/Messages/SendMessageHandler.php:454-491` (`ownedLinkedTicket`, called at `:165`) refuses any application that is not the sender's, and `app/Queries/Messages/GetMessagesQuery.php:611-625` resolves an application's details only for a card its owner sent.

### REQUIRED FIX

None. Finding #2 of run v5 is fixed (`parseTicketLinks` is gone, no match left in `app/`). Finding #3 is fixed: `app/Events/Messages/UnreadCountUpdated.php:31,56` carries `read_echo`, set at `app/Http/Controllers/employee/MessagesController.php:486`, and `resources/views/mobapp/src/module/employee/messages/contexts/MessagesContext.tsx:296-358` applies the count delta and keeps the preview on a read echo.

### IMPROVEMENT

> **Run v7 status of the improvements:** ✅ FIXED and re-checked — #1 (`markAllAsRead` now groups the maxima and advances positions in one statement, `MessagesController.php` `markAllAsRead`), #2 (own-DM names loaded once, `SearchMessagesQuery.php:469-474`), #7 (`channelPermissions.ts:35-37` reads `is_system` / `isDefault`), #9 (`onSendVoiceReply` passed to `ThreadModal`, `ConversationScreen.tsx:3698`), #12 (code points, `MessageInputBar.tsx:301`, `:1733`), #16 (selection props and state removed), #21 (`mentionParser.ts:656`, `MessageContent.tsx:80`), #22 (`SendMessageHandler.php:43`, no `i` flag), #23 (`MessagesController.php:326-327`), #25 (`has_more` returned, `MessagesController.php:696`), #26 (`UserTyping` inside `DB::afterCommit`), #32 (tickets without a document number hidden, `ConversationScreen.tsx:544`). ◐ PARTIAL — #10 (system rows break grouping, `messageGrouping.ts:159-172`; the `NEW MESSAGES` divider does not yet). Open and not touched: #3 – #6, #8, #11, #13 – #15, #17, #19, #20, #24, #27 – #31, #33. None of these were executed against a database or a device in this run.

#### Improvement #1

- **Area:** Backend / mark-all-read
- **Current Situation:** `markAllAsRead` still runs `max(id)`, a position write and a cache write per conversation (`app/Http/Controllers/employee/MessagesController.php:2623-2670`, `max('id')` at `:2648`); the set is only the caller's own conversations plus General.
- **Suggestion:** Fetch the maxima in one grouped query and update positions in one statement.
- **Reason:** Up to three queries per conversation on a screen action.

#### Improvement #2

- **Area:** Backend / search
- **Current Situation:** Each own-message result in a direct conversation runs a join query for the other person's name (`app/Queries/Messages/SearchMessagesQuery.php:565-571`), up to 100 per page.
- **Suggestion:** Load the other member names for all result conversations in one query before the loop.
- **Reason:** N+1 on a page capped at 100 rows.

#### Improvement #3

- **Area:** Tests
- **Current Situation:** The fixes ship with no automated test: `tests/Unit/SearchMessagesSyntaxTest.php` still tests a copy of the parser, and the execution checks of this and the earlier runs (270 + 72 + 38 + 20, the differential and the mobile scripts) live only in the verifier's scratch scripts, which a machine restart already deleted once.
- **Suggestion:** Add Feature tests for the read-state, guard, upload, link-preview, approval, linked-ticket ownership and mention rules (spec §11.1, including AC-42 / AC-43) and point the parser test at the real parser.
- **Reason:** Nothing in the repository protects the security fixes, the ticket-ownership rule, or the `@all` / `@here` rule from regressing.

#### Improvement #4

- **Area:** Mobile / lint
- **Current Situation:** `npx eslint src/module/employee/messages src/components/dashboard/AppTopHeader.tsx "src/app/(app)/messages"` reports 150 errors and 82 warnings, identical to runs v3 – v5 (the fixes added none), almost all `Cannot access refs during render` (`components/ChatStreamSkeleton.tsx:18`).
- **Suggestion:** Move the ref reads out of render in `ChatStreamSkeleton` and fix the remaining compiler-rule errors.
- **Reason:** The module cannot pass its own lint script.

#### Improvement #5

- **Area:** Dependencies
- **Current Situation:** `laravel/scout` and `meilisearch/meilisearch-php` are still declared (`composer.json:16,20`) with `config/scout.php`, though search does not use them (spec Decision 6).
- **Suggestion:** `composer remove laravel/scout meilisearch/meilisearch-php` and delete `config/scout.php`.
- **Reason:** Dead dependencies for an engine that is not deployed.

#### Improvement #6

- **Area:** Infrastructure / defence in depth
- **Current Situation:** The nginx rule that refuses scripts under `/storage/` (`docker/nginx/default.conf.template`) is still an uncommitted change in the separate `DockerTemplate` repository; the application-level upload fix is committed. The template is shared by every project on that stack.
- **Suggestion:** Commit the nginx change on that repository's `T00001` branch and review it for the other projects.
- **Reason:** The fix for the upload hole holds without it, but the second layer is not delivered by this branch.

#### Improvement #7

- **Area:** Mobile / default-channel detection
- **Current Situation:** `isDefaultChannel` is still a heuristic (name `general` / `announcements` or `conversationId <= 6`, `resources/views/mobapp/src/module/employee/messages/components/GroupDetailsDrawer.tsx:130-136`; `ManageChannelModal.tsx:122-127`).
- **Suggestion:** Use the `is_system` / `isDefault` flag the API returns.
- **Reason:** A user-created channel named "General" loses Add / Remove / Leave (AC-37).

#### Improvement #8

- **Area:** Mobile / search modal
- **Current Situation:** `handleLoadMore` has no staleness guard and is also triggered by scrolling (`components/MessagesSearchModal.tsx:596-627`); the empty-state sentence can flash during the debounce (`:1867`, `:2220`); `searchMessages` swallows errors into an empty result (`services/messages.api.ts:585-598`); the fetch effect depends on `mode` with no `visible` guard (`MessagesSearchModal.tsx:593`) and `handleClose` clears `query` while `debouncedQuery` keeps the old text for 300 ms (`:159-168`), so closing from `direct` mode re-runs `searchMessages({ q: <old text>, mode: 'all' })` once while the modal fades out.
- **Suggestion:** Ignore responses of superseded requests, skip the fetch while the modal is not visible, guard the empty state with the debounced query, and surface a failed search.
- **Reason:** A late page of an old query can be appended to a new query's results; a network failure reads as "no results"; one wasted request and a visual flicker on close.

#### Improvement #9

- **Area:** Mobile / thread voice
- **Current Situation:** `onSendVoiceReply` is never passed to `ThreadModal` (`pages/ConversationScreen.tsx:3837-3900`; the prop exists at `components/ThreadModal.tsx:110`, `:615`), so the thread microphone does nothing; its under-300 ms branch (`ThreadModal.tsx:625`) would also leave the recording file.
- **Suggestion:** Wire `onSendVoiceReply` or hide the microphone in the thread composer.
- **Reason:** A visible control with no effect.

#### Improvement #10

- **Area:** Mobile / grouping
- **Current Situation:** Grouping ignores `isSystemEvent` / `system_event` (`utils/messageGrouping.ts:166-169`) and the `NEW MESSAGES` divider does not break it (`pages/ConversationScreen.tsx:2725-2730`): a message posted within 5 minutes of its sender's own system-event row, or the first unread message, can lose its avatar and header.
- **Suggestion:** Treat server-flagged system rows and the divider as group breaks.
- **Reason:** The sender identity of AC-12 disappears in those cases.

#### Improvement #11

- **Area:** Mobile / unsent messages
- **Current Situation:** Delete on an unsent (id 0) message does nothing: `deleteMessage` returns at `!messageId` (`hooks/useChatRoom.ts:1707-1709`) while the sheet offers it (`components/MessageActionModal.tsx:940`). A failed thread reply has the client id `Date.now()`, so its Delete is not blocked: it removes the row locally and sends a `DELETE` for an id the server never saw (`pages/ConversationScreen.tsx:2086-2100`), which fails and is only logged.
- **Suggestion:** Remove unsent items by `clientId`, and skip the server call for an id that was never persisted.
- **Reason:** A failed message cannot be discarded cleanly; a wasted request.

#### Improvement #12

- **Area:** Mobile / composer limit
- **Current Situation:** The 4,000 limit counts UTF-16 units (`serializeBlocksToMarkdown(blocks).trim().length`, `components/MessageInputBar.tsx:292`, `:1705`) while the server counts characters (`mb_strlen`, `app/Handlers/Messages/SendMessageHandler.php:138`).
- **Suggestion:** Count code points (`Array.from(text).length`).
- **Reason:** 2,001 emoji are blocked by the app although the server would accept them.

#### Improvement #13

- **Area:** Presence
- **Current Situation:** `GET /recipients` returns `online => true` for every row (`app/Http/Controllers/employee/MessagesController.php:843`, "Simulating active status"), and the header's "N colleagues active" counts every recipient row, channels included (`src/app/(app)/messages/index.tsx:59`).
- **Suggestion:** Return real presence, or label the number as the directory size.
- **Reason:** The subtitle states a presence the system does not know.

#### Improvement #14

- **Area:** Mobile / requests
- **Current Situation:** The More row badge counts requests that the Requests screen and chip now hide (`pages/MessagesMoreScreen.tsx:54-60` against `pages/MessagesScreen.tsx:825`); a declined request still appears in Home → All (`pages/MessagesScreen.tsx:890-902`) and in `ArchivedChannelsModal` (`contexts/MessagesContext.tsx:431`).
- **Suggestion:** Share one request predicate between the three places.
- **Reason:** A badge of N over an empty list.

#### Improvement #15

- **Area:** Mobile / ticket drawer
- **Current Situation:** The drawer only receives pending tickets (`pages/ConversationScreen.tsx:3801`, `tickets={pendingUserTickets}`; none from `ThreadModal`), so a user whose applications are all approved sees `No recent applications` (`components/ChatToolsDrawer.tsx:377`) and the thread drawer is always empty.
- **Suggestion:** Pass all of the user's applications and filter inside the drawer.
- **Reason:** The empty-state text is wrong for that user.

#### Improvement #16

- **Area:** Mobile / dead code
- **Current Situation:** `onSelectionChange` and `selectionOverride` are still passed to `ChatInputBar`, which never forwards them (`pages/ConversationScreen.tsx:3789-3790`, `components/ChatInputBar.tsx:121-122`); `handleSelectionChange` and `inputSelectionRef` have no reader.
- **Suggestion:** Delete the unused props and state.
- **Reason:** Misleads the next reader about how emoji insertion works.

#### Improvement #17

- **Area:** Maintainability / duplicated logic
- **Current Situation:** The portal and the chat card share the decision (`ProcessApprovalDecisionHandler`), but the approver rule still exists twice more: `app/Actions/Messages/IsCurrentApproverAction.php:30-76` (the pre-check and `can_approve`) and the handler's steps 5 – 6 (`app/Handlers/Approval/ProcessApprovalDecisionHandler.php:98-139`), and they differ (an empty approver list, and string `"0"` statuses, which the handler's strict comparison does not treat as pending). `components/ThreadModal.tsx:470-528` copies the main composer's attachment-picker logic from `ConversationScreen.tsx`.
- **Suggestion:** Have `IsCurrentApproverAction` and the handler read the pending tier through one helper; move the picker into a shared hook.
- **Reason:** A change to either rule or picker must be made twice, and the two rules can disagree.

*(Improvement #18 of run v4, a tier-1 approver completing a multi-tier request from a chat card, is fixed: executed, tier 1 marks only tier 1 and the application stays pending. Its number is retired.)*

#### Improvement #19

- **Area:** Mobile / threads for users who cannot post
- **Current Situation:** `ThreadModal` is read-only only for an archived channel or a broadcast-only announcement (`pages/ConversationScreen.tsx:3896`, `isReadOnly={isConversationReadOnly}`). A non-member previewing a joinable channel gets the Join CTA instead of a composer on the main screen (`:3673`, spec §5.3.7), but can long-press a message, pick Thread, and see a composer; sending fails with `403 You must join this channel before sending messages.` (`app/Handlers/Messages/SendMessageHandler.php:130`), the Alert is titled `Upload Failed` (`hooks/useChatRoom.ts:1557`), and the reply is left failed with a Retry Sending that can never succeed. In a read-only thread the empty state still says `Send a message below to start the discussion.` (`components/ThreadModal.tsx:1001`) and a failed reply is still counted in the `N replies` header and the root preview.
- **Suggestion:** Pass `isUnjoinedChannel` into the thread's read-only state with the Join hint, and branch the empty-state copy on `isReadOnly`.
- **Reason:** The same class of user the v2 fix kept out of the announcement's thread can still compose where the server will refuse.

#### Improvement #20

- **Area:** Mobile / failed thread replies
- **Current Situation:** Opening a thread replaces its reply list with the server's (`pages/ConversationScreen.tsx:2222`, `:2310`), so a failed reply and its text are gone after closing and reopening the thread, and the root's room-feed count keeps the optimistic +1 (`incrementThreadCount`, never reconciled). A reply sent with "Also send to #channel" is not `staysInThread` (`hooks/useChatRoom.ts:1341`), so when it fails it leaves two failed rows, one in the room feed and one in the thread; Retry Sending on the thread row (`pages/ConversationScreen.tsx:3080`) never removes the room row, so a retry that succeeds leaves a stale failed row, and retrying both sends the message twice.
- **Suggestion:** Merge still-failed local replies back into the list when a thread opens, reconcile the root count, and give a broadcast reply one failed state shared by both rows.
- **Reason:** AC-28's "drafted content is not dropped" holds only until the thread is closed; duplicate failed rows invite a double send.

#### Improvement #21

- **Area:** Mobile / mention self-detection
- **Current Situation:** `ConversationScreen` passes `currentUserId = 0` when the user is not loaded (`pages/ConversationScreen.tsx:367`); both mention checks treat `0` as a known id (`utils/mentionParser.ts:588-592`, `components/MessageContent.tsx:80-81`: `!== undefined`), so a non-empty `user_ids` overrides a correct server `is_targeted` until the user loads.
- **Suggestion:** Treat a falsy id as unknown in both places.
- **Reason:** A transient wrong colour before authentication settles.

#### Improvement #22

- **Area:** Backend / attachment paths
- **Current Situation:** The upload-path rule is case-insensitive (`app/Handlers/Messages/SendMessageHandler.php:31`, flag `i`) and the existence check strips eight characters whatever their case (`:421`). Executed: `STORAGE/messages/<uuid>.png` for a file that exists is accepted (`200`) and stored with that prefix; `DeleteMessageHandler::deleteAttachmentFile` then compares the prefix case-sensitively and never removes the file.
- **Suggestion:** Drop the `i` flag (the pattern's uuid and extension are lower-case) or lower-case the path before the test.
- **Reason:** A stored path that the uploader never issues; the file is orphaned when the message is deleted. Not a traversal: the path still names an existing upload.

#### Improvement #23

- **Area:** Backend / message list `limit`
- **Current Situation:** `app/Http/Controllers/employee/MessagesController.php:238` casts `limit` to an integer before the query's `is_numeric` default applies. Executed against HEAD and the working tree on the same data: `limit=abc`, an empty `limit` and `limit=NaN` returned the default page at HEAD and return 1 message now; `0`, `-4`, `2.7` and `100000` are unchanged.
- **Suggestion:** Cast only a numeric `limit` (`is_numeric(...) ? clamp : 25`).
- **Reason:** A client that sends a blank or NaN limit now gets one message per page.

#### Improvement #24

- **Area:** Backend / linked-ticket lookup
- **Current Situation:** `GetMessagesQuery::formatMessage` looks the application up once per card with `findByDocnumber` (`app/Queries/Messages/GetMessagesQuery.php:481`; one to five queries, `app/Handlers/Approval/ProcessApprovalDecisionHandler.php:38-45`) for the ownership test and the approver flag. Measured after the run-v5 fixes: 60 cards cost 136 queries whether pending or approved (an approved card cost one query before the ownership test).
- **Suggestion:** Pick the table from `linked_ticket_type`, or batch the lookups by docnumber per page.
- **Reason:** One to five extra queries per card on a page capped at 100 rows.

#### Improvement #25

- **Area:** Backend / thread replies cap
- **Current Situation:** `GetThreadRepliesQuery` keeps the newest 500 replies and computes `has_more` (`app/Queries/Messages/GetThreadRepliesQuery.php:112-143`), but the controller drops it (`MessagesController.php:672-681`: only `root`, `replies`, `user_last_read_id`, `read_receipts`). Executed: a thread with 510 replies returns replies 11 – 510 and nothing says that ten older ones exist; the root's `threadCount` still reads 510.
- **Suggestion:** Return `has_more` in `data` and let the client offer older replies.
- **Reason:** The truncation is silent.

#### Improvement #26

- **Area:** Backend / send transaction
- **Current Situation:** The `UserTyping` (stopped) broadcast is still made inside the send transaction (`app/Handlers/Messages/SendMessageHandler.php:198`), while spec §4.6 lists it after the commit and the other broadcasts now run in `DB::afterCommit`.
- **Suggestion:** Move it into the `afterCommit` closure.
- **Reason:** One network call is still made while the transaction holds its locks.

#### Improvement #27

- **Area:** Mobile / opening a conversation with unread messages
- **Current Situation:** `hasNewer` is set to true after every around-load (`hooks/useChatRoom.ts:887`), even when the window already reaches the newest message, and `resync` returns while it is true (`:1264`). It clears only when `loadNewer` runs from `onStartReached`, which is armed only after a drag (`pages/ConversationScreen.tsx:3511`). While it is true the read flush waits for the `/read` round trip before the badge changes (`useChatRoom.ts:751-766`), and a failed POST never clears it locally (HEAD cleared it at once).
- **Suggestion:** After an around-load, probe once with `fetchNewerPage(newerCursor)` without gesture gating; let `resync` page forward from `newerCursor` instead of returning.
- **Reason:** Foreground and reconnect recovery (code-review #20) does nothing for the most common way of opening an unread conversation.

#### Improvement #28

- **Area:** Mobile / resync window
- **Current Situation:** `resync` asks for messages after the newest confirmed id (`hooks/useChatRoom.ts:1268`), so when the socket is down and the user sends a message in the meantime (confirmed id 103 while 101 and 102 were missed), `since_id=103` skips them; `since_id` also returns only main-list rows, so missed non-broadcast thread replies update neither `threadCount` nor an open thread.
- **Suggestion:** Resync from the last contiguous cursor recorded before the socket dropped.
- **Reason:** A gap survives the recovery meant to close it.

#### Improvement #29

- **Area:** Mobile / rollback of optimistic actions
- **Current Situation:** The three thread delete handlers call `deleteMessage` without waiting for its result (`pages/ConversationScreen.tsx:2086`, `:2162`, and the thread-root path), so after a failed delete the thread views and the root count stay changed; for a non-broadcast reply the room snapshot is empty and nothing is restored. `restore_messages` replaces whole message objects (`hooks/useChatRoom.ts:537-552`): executed on the extracted reducer, edit M then delete M succeeds then the edit request fails re-adds M, and two edits A→B→C where the first request fails after the second succeeds leave "A" on screen while the server holds "C".
- **Suggestion:** Handle the boolean in the three handlers and refetch the thread on failure; restore only the touched fields, and do not re-add a missing message for an edit, pin or ticket restore.
- **Reason:** Code-review #17 is closed for edit, pin and the room list but not for thread deletes.

#### Improvement #30

- **Area:** Mobile / realtime lifecycle
- **Current Situation:** `echo.ts:106-107` still runs `setupPusher` when a config fetch that started before `disconnect()` resolves, leaving one socket per logout during init (the new generation guard covers only the retry timer). After logout `destroyEcho()` (`contexts/AuthContext.tsx:47`) is followed by the cleanup `getEcho().leave()` (`contexts/MessagesContext.tsx:336`, `hooks/useChatRoom.ts:1160`), which creates a new instance; executed with stubs: if its config fetch fails it retries every 2 – 60 s until the next login (the endpoint is public, so no 401 side effects).
- **Suggestion:** Guard `setupPusher` with the generation counter; do not create an instance from `leave()`.
- **Reason:** A leaked socket and a background retry loop after logout.

#### Improvement #31

- **Area:** Mobile / approval card
- **Current Situation:** After a non-final approval the room card keeps `can_approve: true` because the server reply carries no flag (`app/Http/Controllers/employee/MessagesController.php:1921-1941`; merge at `hooks/useChatRoom.ts:1847-1855`; only the modal copy is patched, `pages/ConversationScreen.tsx:3003`), so reopening the card shows Approve and Decline again and a tap answers 403. The optimistic Approve flip flashes before it reverts, and a failed composer edit drops the typed text (`:1453` clears the composer at once).
- **Suggestion:** Return `can_approve` in the `ticket-status` reply and merge it; clear the composer only after the edit succeeds.
- **Reason:** Cosmetic, but the stale button invites a refused action.

#### Improvement #32

- **Area:** Mobile / tickets without a document number
- **Current Situation:** The ticket drawer gives an application with no stored document number the id `REQ-<row id>` (`pages/ConversationScreen.tsx:558`), which the server cannot match to an application, so since the ownership rule such a ticket is refused (`app/Handlers/Messages/SendMessageHandler.php:462`, `422 "Invalid ticket."`, executed for an unknown id); the failed send is announced with the Alert title `Upload Failed` (`hooks/useChatRoom.ts:1557`).
- **Suggestion:** Hide applications with no document number from the drawer (they could not be approved from a card either), and title the alert after the failure.
- **Reason:** A visible ticket that can never be sent, with a message about an upload.

#### Improvement #33

- **Area:** Mobile / card details for other readers
- **Current Situation:** The card stored at send time is now built from the application (`SendMessageHandler.php:454-491`), which carries `dateApplied` but not `approver`; the detail modal reads `approver` from the card (`components/modals/ApplicationDetailModal.tsx:170`). The sender still sees it (the screen merges the sender's own dashboard data, `pages/ConversationScreen.tsx:2698`); every other reader sees it blank.
- **Suggestion:** Add the current approver's name to the details the server resolves, or hide the row when it is absent.
- **Reason:** An approver opening the card no longer sees who the approver is.

### OUT OF SCOPE

#### Suggestion #1

- **Suggestion:** Review and split the unrelated changes carried by branch `T00001`: `AttendanceController.php` (commit `0b72ae79` removes the 60-second punch cooldown), login v2 and branding commits, `public/.htaccess`, `php.ini`, `public/.user.ini`, `start.sh`, `BiometricController.php`, `AuthController.php`, `GetEmployeeDashboardQuery.php`, `.env.example`; and, in the mobile repository, the Notifications tab and its screen (hidden by an uncommitted edit; an empty spacer keeps the centre button balanced). `config/database.php` and `app/Providers/AppServiceProvider.php` now equal `origin/master`.
- **Reason Not Included:** None of these are part of the messaging specification; reviewing them against it would be inventing a standard.
- **Future Consideration:** Open a ticket per change; give the attendance cooldown removal its own review, because it removes a double-punch guard. Removing the `+08:00` database session zone changes how every environment that already ran the branch reads `TIMESTAMP` columns: the same stored rows read 8 hours apart with and without it (executed). Confirm the production MySQL `time_zone` before deploying.

#### Suggestion #2

- **Suggestion:** Time in / out now writes a junk location from a native device. The uncommitted edit of `useTimeInOut.ts:213-214` sends explicit `latitude: null, longitude: null` (no native position is read because `expo-location` is not installed), and `app/Http/Controllers/AttendanceController.php:406-408` tests `$request->has('latitude')`. Executed: `Request::has` is true for null values, so the location becomes `","` and is stored in `locationin` / `locationout`. `HardwareTrustPill.tsx:98-100` still reads "GPS Active" for the initial `simulated` status and `TwinTelemetryCards.tsx:75-77` "Office Verified" when no position exists.
- **Reason Not Included:** Attendance is not part of the messaging specification.
- **Future Consideration:** Use `filled()` server-side or omit the keys client-side; read the real position once `expo-location` is installed. Own ticket.

---

## 4. Security Review

| Check | Status |
| --- | --- |
| Authentication | PASS |
| Authorization | PASS |
| Input Validation | PASS |
| Data Exposure | PASS |
| API Security | PASS |

**Issues:** No security issues found. Re-executed against the working tree: the original exploit of run v5 (a foreign `docnumber` in `linked_ticket`) now answers `422 "Invalid ticket."`, writes no row and returns none of the victim's remarks; `#LV-2026-001` in text creates no card. Attempts to get around the rule all fail: the same document number in two application tables (own overtime found first is attached with only its own remarks; the victim's overtime shadowing the attacker's own leave is refused), prefix confusion in both directions, the id in lower case (own accepted with the canonical id, the victim's refused), `%`, `_`, a trailing newline, a leading space, a path-like and an SQL-looking id, a `linked_ticket` sent as a JSON string or under the camelCase alias, and an edit that tries to swap a card; rows stored before the check (a forged foreign card) return only id, type, title and status through the message list, the pinned list, a thread's replies, `message-detail`, `around_id`, search and the conversation list, and the forged card does not let its sender decide the application (403). Every other check of runs v1 – v5 re-executed clean: attachment paths (14 hostile shapes refused, every extension `/upload` can issue accepted), a reply parent from another conversation, deep links and channel names for other readers and in the live broadcast, a disabled conversation's members, join requests decided twice, the channel rule for an inactive account, `/recipients` and search for private and manager channels, DM and announcement conversations refusing member and drop calls, and chat-card approvals (tier by tier, one winner when two approvers race).

---

## 5. Performance Review

| Check | Status |
| --- | --- |
| Database Queries | PASS |
| API Performance | PASS |
| Frontend Performance | N/A — no device or profiler run was possible in this verification |
| Resource Usage | PASS |

**Issues:** Improvement #1 (`markAllAsRead`), #2 (search N+1), #8 (search modal), #24 (one to five queries per card for the ownership test and approver flag), #25 (thread replies capped silently), #26 (one broadcast inside the send transaction), #30 (leaked socket and retry loop after logout). Measured: a page of 25 plain messages 116 → 16 queries, `?limit=100000` 616 → 16 queries and 100 messages, a send's fan-out is one grouped query after the commit, the conversation list slope dropped from 2.0 to 0.8 queries per extra conversation. The search `p95 < 800 ms` target is a proposed default and was not measured.

---

## 6. Testing Review

### Existing Tests

- **Status:** passing for the messaging test, failing elsewhere. `php artisan test --testsuite=Unit` → 26 passed, 7 failed; the 7 are `ComputeWithholdingTaxActionTest` (payroll, database-dependent, unrelated). `php artisan test --filter=SearchMessagesSyntaxTest` → 10 passed. `php -l` on all 15 changed and the 1 new PHP file: clean. `php artisan route:list --path=api/employee/messages` → 43 routes, unchanged. Mobile, in `resources/views/mobapp`: `npx tsc --noEmit` → exit 0, no output; `npx eslint src/module/employee/messages src/components/dashboard/AppTopHeader.tsx "src/app/(app)/messages"` → 150 errors, 82 warnings, identical to the baseline (Improvement #4). Executed with a disposable `mysql:8.0` container built from the repository's own migrations plus minimal stand-in tables for other modules (removed afterwards), against the working tree: the suites of runs v1 – v5 (57 for the code-review fixes, 66, 97, 12, 28, 10 = 270, all pass; the 66-check suite needed one fixture corrected, because it attached a ticket for an application that does not exist and expected 200, which is the defect itself), two concurrency runs (same `client_id` from two processes: both received message 2, one row; same first read of General: both 200, one member row), 38 checks for the three run-v5 findings, 20 attempts to get around the ownership rule, and the 72 checks written for run v5 (70 pass; the 2 failures are Improvements #22 and #25).
- **Implemented:** NO — the repository has no automated test for any messaging acceptance criterion or for any of the fixes (Improvement #3).
- **Coverage:** none of AC-1 – AC-110 is covered by a test in the repository; AC coverage by execution is listed below.

### Manual Verification

| Scenario | Expected | Result | Status |
| --- | --- | --- | --- |
| The exploit of run v5: another employee's `docnumber` in `linked_ticket`, then read; text `#LV-2026-001` | refused; no card from text | `422 "Invalid ticket."`, no row, no remarks returned; no card; 4 of 4 checks (1 of 4 before the fix) | PASS (Findings #1, #2 of run v5) |
| Linked-ticket fix: 38 checks — 11 hostile or malformed ids; the owner attaches each of the five application types with real remarks, type and title; a forged status, type, title or remarks in the request is ignored; an approved application reads Approved; the approver and another reader see the details of the owner's card, only the approver may decide; a stored foreign card read by its sender and by another member returns only id, type, title and status; the forged card cannot decide the application | per the fix | all pass | PASS |
| Attempts to get around the ownership rule: 20 checks (collisions across tables, prefix confusion, case, wildcards, SQL-looking ids, edit, pinned, thread, single message, `around_id`, search, list) | no leak | all pass | PASS |
| Unread event handler (the real handler and updater from `MessagesContext.tsx`, stubbed state): new message, burst of three before the ref catches up, read echo of an attachment-only message, partial read echo, echo of a read this device applied, read on another device, floor at zero, open conversation, own send, empty preview, unknown conversation, mark-all-read | global count follows, previews stay, no double count | 14 of 14 pass | PASS |
| `read_echo` on the wire (`Event::fake`): `POST /read` broadcasts one event to the reader with `read_echo` true and the remaining unread; a send broadcasts to every member with `read_echo` false | per the fix | pass | PASS |
| Sibling broadcasters of `UnreadCountUpdated` (edit, delete, system events) | none rewrites a preview with a non-newest message | read: an edit broadcasts only when the edited message is the newest (`EditMessageHandler.php:67-90`), a delete uses the actual latest message (`DeleteMessageHandler.php:150-205`) | PASS — static |
| AC-42, AC-43 and the adversarial cases around `@all` / `@here` (runs v3, v4) | per spec | 12 and 28 checks pass | PASS |
| AC-14, AC-15 live (viewer-0 payload through the client's `parseMessageSegments`) | viewer's own mention gold, another's blue, broadcast gold for everyone | `@all` gold for Bob, Mallory and Cy; `@Bob Test` gold only for Bob | PASS |
| AC-31 – AC-34, AC-38 – AC-41, AC-44 – AC-47, AC-48 – AC-62, AC-63 – AC-78, AC-79 – AC-94, AC-109, AC-110 | per spec | the 97-check acceptance suite passes; AC-67 literal cases 10 of 10 | PASS |
| Mobile reducer (`hasNewer`, `newerCursor`, `error`, `restore_messages`, `newer_done`), extracted from `useChatRoom.ts` | per the report's design | 20 scenarios pass | PASS |
| `echo.ts` with stubbed `pusher-js` and `http` and a manual clock | retry with backoff, no polling, listeners isolated, disconnect cancels | 14 checks pass | PASS (Improvement #30) |
| Differential of run v5 (clean HEAD against the tree before the run-v5 fixes, 416 responses) | only intended changes | 377 identical, 39 differ as intended; not repeated after the run-v5 fixes, whose changes (linked-ticket payload, `read_echo`) are covered by the 38 + 20 checks above | PASS |
| `setUnreadCount` called inside the updater of `setConversations` (the pattern `markConversationAsRead` already uses) under React's batching on a device | one application of each delta | executed only with a stub that applies updaters once, in order; the app has no `StrictMode`, which would apply them twice in development | Not run — device required |
| AC-1 (header Search), AC-27 / AC-88 in a thread, AC-36, AC-101, AC-28 | per spec | read by me and by independent readers in earlier runs; the General members endpoint was executed | PASS — not run on a device |
| AC-11, AC-24, AC-29 (slide transition, composer growth, web widths) | per spec | static configuration found | Not run — device required |
| AC-26 (back navigation keeps scroll and badges) | per spec | `handleBack` and `slide_from_right` exist; with no unread gap the read flush zeroes the badge as at HEAD | Not run — device required |
| AC-97 Backspace on an empty input; AC-30 paste; AC-17 emoji at the caret; AC-22 recording file removal; whether `onStartReached` re-fires for a short list (Improvement #27) | per spec | traced; not run | Not run — iOS and Android device required |
| Voice notes recorded on real devices (`.m4a`, `.caf`, `.3gp`) pass the upload allow-list | accepted | the sniffed types are listed and the extensions are accepted by the send path; not tested with real recordings | Not run — device recordings required |

---

## 7. Specification Impact Decision

### NO SPEC CHANGE REQUIRED

**Reason:** The run-v5 findings were implementation defects; the specification already states the rules (§6.1 rule 9, §5.2, AC-8, AC-9). Bookkeeping that is not a specification error and is refreshed when `/webkit-implement` ticks the plan tasks: §4.1 row `ticket-status` and G-3 still describe an approval that any caller can write and that marks every tier, which the code no longer does (it decides one tier at a time through the portal's handler; who may approve stays Q-5); §10.2 still lists as open the gaps the fix commits closed in code (G-1, G-2, G-5 – G-7, G-9, G-11 – G-15, G-17); §3.1 and §6.4 still say no unique index exists on `conversation_members`; §4.6 does not mention that an attachment `path` must be a path `/upload` issued or an http(s) URL, nor that a `linked_ticket` must be the sender's own application (`422 "Invalid ticket."`) and is described from that application.

---

## 8. Final Recommendation

### READY FOR MERGE

**Conditions:**

- No blockers
- No required fixes

Before it goes live: commit the working-tree fixes (code-review #1 – #24 and run v5's #1 – #3 are uncommitted in both repositories; Suggestion #2 is created by one of them), run the unique-index migration of plan §9 step 3 (`php artisan migrate`; without it the concurrent first read of General left two member rows in an earlier run), and confirm the production MySQL `time_zone` now that the `+08:00` session setting is gone. AC-26 and the device checks of §6 are the manual walk that is still open.

<!-- Run history -->
- v1 — 2026-10-13 — initial — ❌ FAILED
- v2 — 2026-10-13 — all 31 findings of v1 re-verified fixed; 4 new findings (#1 – #4) — ⚠ PASS WITH FIXES
- v3 — 2026-10-13 — the 4 findings of v2 fixed; AC-42 / AC-43 executed for the first time and failing (1 new finding, #1) — ⚠ PASS WITH FIXES
- v4 — 2026-10-13 — Finding #1 of v3 fixed (`@all` / `@here`, commit `fc999da2`); AC-42 / AC-43 met by execution; no new finding — ✅ PASS (1 AC pending manual check)
- v6 — 2026-10-14 — the three findings of v5 fixed; no new finding — ✅ PASS (1 AC pending manual check)
- v5 — 2026-10-14 — after the 24 code-review fixes (uncommitted): they hold; absence sweep found a linked-ticket data exposure (BLOCKER, #1) and cards conjured from text (#2), the mobile review a regression in the unread sync (#3) — ❌ FAILED
