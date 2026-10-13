# Webkit Verification Report

## Metadata

| Field | Value |
| --- | --- |
| Ticket | T00001 (subhrms) |
| Branch | `T00001` — backend repo: base `origin/master`, 40 commits, 73 files changed (HEAD `fc999da2`); mobile repo `resources/views/mobapp` (`hrms-react-native`): base `origin/main`, 52 commits, 122 files changed (HEAD `c3130cc`); both identical to `origin/T00001`, working trees clean. The `DockerTemplate` repository (nginx) still holds one uncommitted change on its own `T00001` branch. |
| Specification File | [specs.md](./specs.md) — version v4 with the Minor corrections of 2026-10-13 (AC-67, AC-73, AC-101, §3.2, §4.5, §6.4, MT-2); unchanged since run v3; status not recorded in the file; Open Questions Q-1 – Q-7 (§10.3) are open and were not graded |
| Verification Date | 2026-10-13 |
| Verification Run | v4 — Finding #1 of run v3 (`@all` / `@here` not targeted at every reader) re-verified against the fix commit `fc999da2`: fixed; AC-42 and AC-43 are met by execution. No new finding. Every other result of run v3 carries over: the backend diff since run v3 is that one file, the mobile repository is untouched, and the backend suites were re-executed |

**Implementation Scope**

- **Frontend:** `resources/views/mobapp/src/module/employee/messages/` (components, pages, hooks, contexts, utils, services) and its routes under `src/app/(app)/messages/`; `src/components/dashboard/AppTopHeader.tsx`; `components/RecordingDot.tsx`. Unchanged since run v3. The six web messaging files are at the base.
- **Backend:** `MessagesController`, `app/Queries/Messages/*`, `app/Handlers/Messages/*`, `app/Actions/Messages/*` (incl. `IsCurrentApproverAction`, `UpsertConversationMemberAction`), `app/Models/Conversation.php`, `routes/api/employee.php`, `routes/channels.php`. Changed since run v3: `app/Actions/Messages/ResolveMentionsAction.php` (`formatForViewer` and the `all` / `channel` / `here` cases of `execute`), commit `fc999da2`, +16 / −9 lines.
- **Database:** the 9 messaging alter migrations of run v1, plus `database/migrations/alters/messages/2026_10_13_000001_add_unique_member_index_to_conversation_members_table.php`.
- **Other:** `tests/Unit/SearchMessagesSyntaxTest.php`; `composer.json` / `config/scout.php`; `docker/nginx/default.conf.template` in the `DockerTemplate` repository (uncommitted); unrelated changes on the same branch — see Suggestion #1.

---
## 1. Verification Summary

### Overall Status

✅ PASS (1 AC pending manual check)

### Summary

The one required fix of run v3 is in and holds. `ResolveMentionsAction` no longer expands `@all` and `@here` into the member list, so every reader of General, including those with no member row, gets `is_targeted: true`; messages stored before the fix are corrected when they are read. I re-executed it against MySQL (the AC-42 / AC-43 scenario 12/12, 28 further adversarial cases, the literal AC-67 cases 10/10, AC-62), re-ran the earlier backend suites (66/66 and 97/97) and both concurrency races, and ran the captured live payloads through the client parsers: `@all` and `@here` render gold for every viewer and `@Maria` only for Maria. 109 of 110 acceptance criteria are met; AC-26 (back navigation keeps scroll and badges) needs a device. No blocker, no required fix, no specification change. 21 optional improvements remain (§3). Not done here: the device walk of the Definition of Done (MT-9, iOS, Android, web viewport).

---

## 2. Specification Compliance

| Specification Area | Status | Notes |
| --- | --- | --- |
| Scope | PASS | The web messaging module is at base. Unrelated changes still ride on the branch (Suggestion #1). |
| User Flow | PASS | Landing, New Chat, Create Channel, conversation, threads (incl. a failed reply and a read-only announcement), search and seen avatars work. Thread edge cases that are not spec rules are Improvements #19 and #20. |
| Technical Design | PASS | 43 routes match §4.1; the General members payload carries `member_count` inside `data`; §4.8 is followed (`@all` / `@here` / `@channel` target every reader and are never expanded into a list); the contracts checked by execution match. |
| Acceptance Criteria | PASS | 109/110 met; 1 pending a device: AC-26 (§6). The UI criteria that need a device are met on static evidence and listed in §6. |
| Edge Cases | PASS | Replay, concurrent first reads, inactive accounts, manager channels, empty and over-long messages, failed thread replies, read-only announcement threads, messages stored before the mention fix were executed or traced. |
| Security Requirements | PASS | Every authorization, validation and API-security finding of run v1 re-executed clean again (§4). |

---

## 3. Findings

### BLOCKER

None.

### REQUIRED FIX

None. Finding #1 of run v3 is fixed (commit `fc999da2`): `ResolveMentionsAction.php:167` and `:174` now store `user_ids = []` for `@all` / `@channel` and `@here`, and `formatForViewer` (`:459-471`) evaluates the broadcast rule before the member-list test, returning `is_targeted: true` and `user_ids: []`.

### IMPROVEMENTS

#### Improvement #1

- **Area:** Backend / mark-all-read
- **Current Situation:** `markAllAsRead` still runs `max(id)`, a position write and a cache write per conversation (`app/Http/Controllers/employee/MessagesController.php:2568-2600`); the set is only the caller's own conversations plus General.
- **Suggestion:** Fetch the maxima in one grouped query and update positions in one statement.
- **Reason:** Up to three queries per conversation on a screen action.

#### Improvement #2

- **Area:** Backend / search
- **Current Situation:** Each own-message result in a direct conversation runs a join query for the other person's name (`app/Queries/Messages/SearchMessagesQuery.php:567`), up to 100 per page.
- **Suggestion:** Load the other member names for all result conversations in one query before the loop.
- **Reason:** N+1 on a page capped at 100 rows.

#### Improvement #3

- **Area:** Tests
- **Current Situation:** The fixes ship with no automated test: `tests/Unit/SearchMessagesSyntaxTest.php` still tests a copy of the parser, and the execution checks of this run (66 + 97 + 50, two races) live only in the verifier's scratch scripts, which a machine restart already deleted once (they were rebuilt from the session transcript).
- **Suggestion:** Add Feature tests for the read-state, guard, upload, link-preview, approval and mention rules (spec §11.1, including AC-42 / AC-43) and point the parser test at the real parser.
- **Reason:** Nothing in the repository protects the security fixes, or the `@all` / `@here` rule, from regressing.

#### Improvement #4

- **Area:** Mobile / lint
- **Current Situation:** `npx eslint src/module/employee/messages src/components/dashboard/AppTopHeader.tsx "src/app/(app)/messages"` still reports 150 errors and 82 warnings (the fixes added none), almost all `Cannot access refs during render` (`components/ChatStreamSkeleton.tsx:18`).
- **Suggestion:** Move the ref reads out of render in `ChatStreamSkeleton` and fix the remaining compiler-rule errors.
- **Reason:** The module cannot pass its own lint script.

#### Improvement #5

- **Area:** Dependencies
- **Current Situation:** `laravel/scout` and `meilisearch/meilisearch-php` are still declared (`composer.json:16,20`) with `config/scout.php`, though search does not use them (spec Decision 6).
- **Suggestion:** `composer remove laravel/scout meilisearch/meilisearch-php` and delete `config/scout.php`.
- **Reason:** Dead dependencies for an engine that is not deployed.

#### Improvement #6

- **Area:** Infrastructure / defence in depth
- **Current Situation:** The nginx rule that refuses scripts under `/storage/` (`docker/nginx/default.conf.template`) is an uncommitted change in the separate `DockerTemplate` repository; the application-level upload fix is committed. The template is shared by every project on that stack.
- **Suggestion:** Commit the nginx change on that repository's `T00001` branch and review it for the other projects.
- **Reason:** The fix for the upload hole holds without it, but the second layer is not delivered by this branch.

#### Improvement #7

- **Area:** Mobile / default-channel detection
- **Current Situation:** `isDefaultChannel` is still a heuristic (name `general` / `announcements` or `conversationId <= 6`, `resources/views/mobapp/src/module/employee/messages/components/GroupDetailsDrawer.tsx:130-136`; `ManageChannelModal.tsx:122-127`).
- **Suggestion:** Use the `is_system` / `isDefault` flag the API returns.
- **Reason:** A user-created channel named "General" loses Add / Remove / Leave (AC-37).

#### Improvement #8

- **Area:** Mobile / search modal
- **Current Situation:** `handleLoadMore` has no staleness guard and is also triggered by scrolling (`resources/views/mobapp/src/module/employee/messages/components/MessagesSearchModal.tsx:596-627`); the empty-state sentence can flash during the debounce (`:1867`, `:2220`); `searchMessages` swallows errors into an empty result (`services/messages.api.ts:585-598`). New with the v2 mode reset: the fetch effect depends on `mode` (`MessagesSearchModal.tsx:593`) and has no `visible` guard, `handleClose` clears `query` but `debouncedQuery` keeps the old text for 300 ms (`:159-168`), so closing from `direct` mode re-runs `searchMessages({ q: <old text>, mode: 'all' })` once while the modal fades out, and the placeholder and idle list swap during the fade.
- **Suggestion:** Ignore responses of superseded requests, skip the fetch while the modal is not visible, guard the empty state with the debounced query, and surface a failed search.
- **Reason:** A late page of an old query can be appended to a new query's results; a network failure reads as "no results"; one wasted request and a visual flicker on close.

#### Improvement #9

- **Area:** Mobile / thread voice
- **Current Situation:** `onSendVoiceReply` is never passed to `ThreadModal` (`pages/ConversationScreen.tsx:3748-3813`), so the thread microphone does nothing; its under-300 ms branch (`ThreadModal.tsx:625`) would also leave the recording file.
- **Suggestion:** Wire `onSendVoiceReply` or hide the microphone in the thread composer.
- **Reason:** A visible control with no effect.

#### Improvement #10

- **Area:** Mobile / grouping
- **Current Situation:** Grouping ignores `isSystemEvent` / `system_event` (`utils/messageGrouping.ts:166-169`) and the `NEW MESSAGES` divider does not break it (`pages/ConversationScreen.tsx:2681-2688`): a message posted within 5 minutes of its sender's own system-event row, or the first unread message, can lose its avatar and header.
- **Suggestion:** Treat server-flagged system rows and the divider as group breaks.
- **Reason:** The sender identity of AC-12 disappears in those cases.

#### Improvement #11

- **Area:** Mobile / unsent messages
- **Current Situation:** Delete on an unsent (id 0) message does nothing: `deleteMessage` returns at `!messageId` (`hooks/useChatRoom.ts:1476-1478`) while the sheet offers it (`components/MessageActionModal.tsx:940`). A failed thread reply has the client id `Date.now()`, so its Delete is not blocked: it removes the row locally and sends a `DELETE` for an id the server never saw (`pages/ConversationScreen.tsx:2064-2072`), which fails and is only logged.
- **Suggestion:** Remove unsent items by `clientId`, and skip the server call for an id that was never persisted.
- **Reason:** A failed message cannot be discarded cleanly; a wasted request.

#### Improvement #12

- **Area:** Mobile / composer limit
- **Current Situation:** The 4,000 limit counts UTF-16 units (`serializeBlocksToMarkdown(blocks).trim().length`, `components/MessageInputBar.tsx:292`, `:1705`) while the server counts characters (`mb_strlen`, `app/Handlers/Messages/SendMessageHandler.php:132`).
- **Suggestion:** Count code points (`Array.from(text).length`).
- **Reason:** 2,001 emoji are blocked by the app although the server would accept them.

#### Improvement #13

- **Area:** Presence
- **Current Situation:** `GET /recipients` returns `online => true` for every row (`app/Http/Controllers/employee/MessagesController.php:834`, "Simulating active status"), and the header's "N colleagues active" counts every recipient row, channels included (`src/app/(app)/messages/index.tsx:81-98`).
- **Suggestion:** Return real presence, or label the number as the directory size.
- **Reason:** The subtitle states a presence the system does not know.

#### Improvement #14

- **Area:** Mobile / requests
- **Current Situation:** The More row badge counts requests that the Requests screen and chip now hide (`pages/MessagesMoreScreen.tsx:54-60` against `pages/MessagesScreen.tsx:825`); a declined request still appears in Home → All (`pages/MessagesScreen.tsx:890-902`) and in `ArchivedChannelsModal` (`contexts/MessagesContext.tsx:373-376`).
- **Suggestion:** Share one request predicate between the three places.
- **Reason:** A badge of N over an empty list.

#### Improvement #15

- **Area:** Mobile / ticket drawer
- **Current Situation:** The drawer only receives pending tickets (`pages/ConversationScreen.tsx:3712`; none from `ThreadModal`), so a user whose applications are all approved sees `No recent applications` (`components/ChatToolsDrawer.tsx:377`) and the thread drawer is always empty.
- **Suggestion:** Pass all of the user's applications and filter inside the drawer.
- **Reason:** The empty-state text is wrong for that user.

#### Improvement #16

- **Area:** Mobile / dead code
- **Current Situation:** `onSelectionChange` and `selectionOverride` are still passed to `ChatInputBar`, which never forwards them (`pages/ConversationScreen.tsx:3700-3701`, `components/ChatInputBar.tsx:121-122`); `handleSelectionChange` and `inputSelectionRef` have no reader.
- **Suggestion:** Delete the unused props and state.
- **Reason:** Misleads the next reader about how emoji insertion works.

#### Improvement #17

- **Area:** Maintainability / duplicated logic
- **Current Situation:** The approver rule exists twice (`app/Http/Controllers/manager/ApprovalRequestController.php` `store` steps 4-6 and `app/Actions/Messages/IsCurrentApproverAction.php`), and `ThreadModal.tsx:470-528` copies the main composer's attachment-picker logic from `ConversationScreen.tsx`.
- **Suggestion:** Have the manager controller call the action; move the picker into a shared hook.
- **Reason:** A change to either rule or picker must be made twice.

#### Improvement #18

- **Area:** Authorization / approval tiers
- **Current Situation:** When the current-tier approver approves from a chat card, every approval tier is marked approved (`app/Http/Controllers/employee/MessagesController.php:1850-1865`), skipping later tiers; open question Q-5 (who may approve from a card) is still unanswered.
- **Suggestion:** Mark only the caller's tier and let the normal flow finish the rest, once Q-5 is decided.
- **Reason:** A tier-1 approver can complete a multi-tier request.

#### Improvement #19

- **Area:** Mobile / threads for users who cannot post
- **Current Situation:** `ThreadModal` is read-only only for an archived channel or a broadcast-only announcement (`pages/ConversationScreen.tsx:3807`, `isReadOnly={isConversationReadOnly}`). A non-member previewing a joinable channel gets the Join CTA instead of a composer on the main screen (`:3584`, spec §5.3.7), but can long-press a message, pick Thread, and see a composer; sending fails with `403 You must join this channel before sending messages.` (`app/Handlers/Messages/SendMessageHandler.php:124`), the Alert is titled `Upload Failed` (`hooks/useChatRoom.ts:1337`), and the reply is left failed with a Retry Sending that can never succeed. In a read-only thread the empty state still says `Send a message below to start the discussion.` (`components/ThreadModal.tsx:1001`) and a failed reply is still counted in the `N replies` header and the root preview.
- **Suggestion:** Pass `isUnjoinedChannel` into the thread's read-only state with the Join hint, and branch the empty-state copy on `isReadOnly`.
- **Reason:** The same class of user the v2 fix kept out of the announcement's thread can still compose where the server will refuse.

#### Improvement #20

- **Area:** Mobile / failed thread replies
- **Current Situation:** Opening a thread replaces its reply list with the server's (`pages/ConversationScreen.tsx:2187`), so a failed reply and its text are gone after closing and reopening the thread, and the root's room-feed count keeps the optimistic +1 (`incrementThreadCount`, never reconciled). A reply sent with "Also send to #channel" is not `staysInThread` (`hooks/useChatRoom.ts:1121`), so when it fails it leaves two failed rows, one in the room feed and one in the thread; Retry Sending on the thread row (`pages/ConversationScreen.tsx:2577-2591`) never removes the room row, so a retry that succeeds leaves a stale failed row, and retrying both sends the message twice.
- **Suggestion:** Merge still-failed local replies back into the list when a thread opens, reconcile the root count, and give a broadcast reply one failed state shared by both rows.
- **Reason:** AC-28's "drafted content is not dropped" holds only until the thread is closed; duplicate failed rows invite a double send.

#### Improvement #21

- **Area:** Mobile / mention self-detection
- **Current Situation:** `ConversationScreen` passes `currentUserId = 0` when the user is not loaded (`pages/ConversationScreen.tsx:364`); both mention checks treat `0` as a known id (`utils/mentionParser.ts:588-592`, `components/MessageContent.tsx:80-81`: `!== undefined`), so a non-empty `user_ids` overrides a correct server `is_targeted` until the user loads.
- **Suggestion:** Treat a falsy id as unknown in both places.
- **Reason:** A transient wrong colour before authentication settles.

### OUT OF SCOPE

#### Suggestion #1

- **Suggestion:** Review and split the unrelated changes carried by branch `T00001`: `AttendanceController.php` (commit `0b72ae79` removes the 60-second punch cooldown), login v2 and branding commits, `public/.htaccess`, `php.ini`, `public/.user.ini`, `start.sh`, `config/database.php`, `BiometricController.php`, `AuthController.php`, `GetEmployeeDashboardQuery.php`, `.env.example`.
- **Reason Not Included:** None of these are part of the messaging specification; reviewing them against it would be inventing a standard.
- **Future Consideration:** Open a ticket per change; give the attendance cooldown removal its own review, because it removes a double-punch guard.

---

## 4. Security Review

| Check | Status |
| --- | --- |
| Authentication | PASS |
| Authorization | PASS |
| Input Validation | PASS |
| Data Exposure | PASS |
| API Security | PASS |

**Issues:** No security issues found. Re-executed against the committed HEAD (`fc999da2`, 66 + 97 checks): an uploaded `.php`, `.phtml`, `.html` or `.svg` is refused with 422 and a GIF disguised as `evil.php` is stored as `.gif` or refused (`UploadAttachmentHandler.php:21-95`, `MessagesController.php:1735`); the link preview refuses the cloud-metadata host, loopback, private literals and a public name that resolves to `127.0.0.1` (`GetLinkPreviewQuery.php:162-262`); a non-approver, a requester, an already-processed request and a numeric row id all fail with 403 / 404 and write nothing (`MessagesController.php:1782-1830`, `IsCurrentApproverAction.php`); reading or Mark All as Read never creates a membership row outside a system channel (`MessagesController.php:383-394`, `:2568-2600`), also checked against the literal text of AC-67; the guard returns 403 `ACCOUNT_INACTIVE` on `message-detail`, thread read, seen and ticket-status; search hides General from an inactive account (`SearchMessagesQuery.php:436-478`); a manager-only channel is invisible to `role_access` 3 for list, read, send, search and the broadcast channel (`Conversation.php:66-91`). The mention fix widens nothing: `is_targeted` only drives highlighting, and a message is still returned only to accounts that may read the conversation. Related observations that are not findings: Improvement #6 (nginx layer uncommitted) and Improvement #18 (approval tiers).

---

## 5. Performance Review

| Check | Status |
| --- | --- |
| Database Queries | PASS |
| API Performance | PASS |
| Frontend Performance | N/A — no device or profiler run was possible in this verification |
| Resource Usage | PASS |

**Issues:** Improvement #1 — `markAllAsRead` still runs up to three queries per conversation. Improvement #2 — search runs one join query per own direct-message result. Improvement #8 — one wasted search request when the modal is closed from `direct` mode. The mention fix removes work: a broadcast mention no longer carries a member list in the payload. The link preview caps the body read at 1 MB and the redirect chain at 3 hops (`GetLinkPreviewQuery.php:151-154`). The search `p95 < 800 ms` target is a proposed default in the spec and was not measured.

---

## 6. Testing Review

### Existing Tests

- **Status:** passing for the messaging test, failing elsewhere. `php artisan test --testsuite=Unit` → 26 passed, 7 failed; the 7 are `ComputeWithholdingTaxActionTest` (payroll, database-dependent, unrelated). `php artisan test --filter=SearchMessagesSyntaxTest` → 10 passed. `php -l app/Actions/Messages/ResolveMentionsAction.php`: clean. `php artisan route:list --path=api/employee/messages` → 43 routes, unchanged. Mobile, in `resources/views/mobapp` (untouched since run v3): `npx tsc --noEmit` → exit 0, no output; `npx eslint src/module/employee/messages src/components/dashboard/AppTopHeader.tsx "src/app/(app)/messages"` → 150 errors, 82 warnings, identical to run v3 (Improvement #4). Executed with disposable `mysql:8.0` containers built from the repository's own migrations plus minimal stand-in tables for other modules, removed afterwards, against `fc999da2`: 66 checks for the v1 findings and 97 for the backend acceptance criteria (all pass), two concurrency runs (two processes sending the same `client_id`: both received message 2, one row; two processes making the same first read in General: both 200, one member row, with the unique-index migration applied), and 50 checks written for this run and the previous one: the AC-42 / AC-43 scenario with the app's real payload and a General where two active readers have no member row, plus the live `.MessageSent` payload (12 pass), 28 adversarial cases (below), the literal AC-67 cases (10 pass). Process note: a machine restart deleted the verifier's scratch scripts mid-run; the 66-check and 97-check suites were rebuilt from the session transcript and reproduced exactly those counts, which is the evidence that the rebuild is faithful.
- **Implemented:** NO — the repository has no automated test for any messaging acceptance criterion or for any of the fixes (Improvement #3).
- **Coverage:** none of AC-1 – AC-110 is covered by a test in the repository; AC coverage by execution is listed below.

### Manual Verification

| Scenario | Expected | Result | Status |
| --- | --- | --- | --- |
| AC-42, AC-43 (`@all` / `@here` in General: stored once, `is_targeted` true for every active reader, audience not expanded) | per spec | executed with the app's payload shape: stored once with `user_ids: []`; `is_targeted` true for Maria (has a member row) and for Ben and Cy (never opened General); also text-only `@all`, `@channel`, `@here` without `mentions[]`: one mention, `user_ids` empty, every reader targeted, `isUserTargeted` true | PASS |
| Adversarial around the fix: `@all` + `@Maria` in one message; `@all` in a public channel read by a non-member; an edited `@all` message; a message stored before the fix with `user_ids [1, 2]`; a position mention | `@Maria` still only for Maria; broadcast targets everyone; position still decided by its members | 28 checks pass: Ben gets `@all` true and `@Maria` false; Ben (non-member) gets `@all` true; the edit stores `user_ids: []`; the stored-before-fix row reads targeted with `user_ids: []` for Ben (not in the old list) and Maria; the Cashier mention is true for the two Cashiers and false for Ben, with its two `user_ids` kept | PASS |
| AC-14, AC-15 live (viewer's own mention gold, another's blue; broadcast gold for everyone) | per spec | the real live payloads run through the committed and the fixed parser: `@Maria` gold only for Maria with the fix (blue for her before); `@all` and `@here` gold for Ann, Maria, Ben and Cy | PASS |
| AC-31 – AC-34, AC-38 – AC-41, AC-44 – AC-47 (General: list without a row, read, post, inactive 403 with the exact message, reactivation, history, mention search active-only) | per spec | 17 checks passed | PASS |
| AC-48 – AC-60 (search: shape, `has:file`, `is:pinned`, `during:`, `from:`, `in:`, `with:`, leading `#` / `@`, no-leak scopes, limit/page clamps, users/channels page 1 vs 2, `mode=direct`) | per spec | 31 checks passed | PASS |
| AC-61, AC-75 (inactive account: General absent from search; guard on message-detail, thread read, seen, ticket-status) | per spec | passed | PASS |
| AC-62 (a failing `SearchMessagesQuery` is logged with `file`, `line`, `trace` and answered `{ success: false, message }`) | per spec | executed by renaming `message_attachments` and calling `GET /search?q=has:file hello`: 500, error logged with the three keys | PASS |
| AC-63 – AC-66, AC-68 – AC-72, AC-74, AC-76 – AC-78 (receipts, forward-only reads, one broadcast per advance, thread positions, seen list, channel authorisation, participants, attachment dimensions) | per spec | passed, including `MessagesRead` counted with `Event::fake` | PASS |
| AC-67 (literal text: public channel and announcement non-member → exact body `{ success, unread_count: 0, read_id: 0, last_read_id: 0, remaining_unread: 0 }`, no row, nothing broadcast; General active → row with `last_read_message_id` and the normal body; General inactive → 403 `ACCOUNT_INACTIVE`; private → 404) | per corrected spec | 10 checks passed | PASS |
| AC-73 (member conversations and General read to their newest message, `UnreadCountUpdated` with `conversation_id` 0, joinable public channels untouched) | per corrected spec | passed | PASS |
| AC-79 – AC-91 (channel edit rules and events, join, approval, posting rules, pins, General event suppression) | per spec | 31 checks passed | PASS |
| AC-92 – AC-94, AC-109, AC-110 (send validation, replay window, manager gate, unique index) | per spec | passed, incl. the concurrent runs above | PASS |
| AC-1 (header Search opens the global search), AC-28 (failed thread reply: failure marker and Retry Sending), AC-27 / AC-88 in a thread, AC-36 (General count and sentence), AC-101 (tap label) | per spec | read by me and, in run v3, by an independent reader who also ran `tsc` and `eslint`; the General members endpoint was executed: `data.member_count` equals the active accounts and the payload the app consumes gives `Members (3)` | PASS — not run on a device |
| AC-11, AC-24, AC-29 (slide transition, composer growth, web widths) | per spec | static configuration found | Not run — device required |
| AC-26 (back navigation keeps scroll and badges) | per spec | `handleBack` and `slide_from_right` exist | Not run — device required |
| AC-97 Backspace on an empty input; AC-30 paste; AC-17 emoji at the caret; AC-22 recording file removal; the offline thread reply of run v2's Finding #4 | per spec | traced by an independent reader and by me; not run on a device | Not run — iOS and Android device required |
| Voice notes recorded on real devices (`.m4a`, `.caf`, `.3gp`) pass the upload allow-list | accepted | sniffed types `audio/x-m4a`, `video/mp4`, `audio/mp4`, `audio/x-caf`, `video/3gpp`, `audio/3gpp` are listed; not tested with real recordings | Not run — device recordings required |

---

## 7. Specification Impact Decision

### NO SPEC CHANGE REQUIRED

**Reason:** The spec states the rule correctly (AC-42, AC-43, §4.8) and the code now follows it. Bookkeeping that is not a specification error: §3.1 and §6.4 still say no unique index exists on `conversation_members`, and §10.2 still lists as open the gaps that the fix commits closed in code (G-1, G-2, G-5 – G-7, G-9, G-11 – G-15, G-17); the spec describes those as delivered by plan tasks, so they are refreshed when `/webkit-implement` ticks the tasks.

---

## 8. Final Recommendation

### READY FOR MERGE

No BLOCKER and no REQUIRED FIX remain. Before it goes live: run the unique-index migration of plan §9 step 3 (`php artisan migrate`); without it the concurrent first read of General left two member rows in this verification. AC-26 and the device checks of §6 are the manual walk that is still open.

<!-- Run history -->
- v1 — 2026-10-13 — initial — ❌ FAILED
- v2 — 2026-10-13 — all 31 findings of v1 re-verified fixed; 4 new findings (#1 – #4) — ⚠ PASS WITH FIXES
- v3 — 2026-10-13 — the 4 findings of v2 fixed; AC-42 / AC-43 executed for the first time and failing (1 new finding, #1) — ⚠ PASS WITH FIXES
