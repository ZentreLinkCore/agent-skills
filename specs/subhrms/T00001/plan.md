# Implementation Plan — Mobile App Messaging Full MVP Redesign (Slack-Inspired Workplace Communication)

## Metadata

| Field | Value |
| --- | --- |
| Project Name | SubHRMS (backend `hrms` repo) + `mobapp` (React Native / Expo, nested repo `hrms-react-native`) |
| Ticket Number | T00001 |
| Feature Name | Mobile App Messaging Full MVP Redesign (Slack-Inspired Workplace Communication) |
| Specification | `.agents/specs/subhrms/T00001/specs.md` |
| Based on Spec Version | v4 |
| Plan Revision | 1 |
| Created Date | 2026-10-13 |
| Plan Status | Draft |

---

## 1. Technical Context

| Aspect | Value |
| --- | --- |
| Project | SubHRMS for the backend: root `package.json` has `vue`, `pinia`, `vue-router`; branch `T00001`. The mobile app `resources/views/mobapp` is a third codebase (React Native / Expo, its own `.git`, branch `T00001`, gitignored here) that project-profile.md does not describe; its rules are spec §5 and `design-review.md` §0. |
| Backend | Laravel `^13`, PHP `^8.2`, Sanctum; `app/Queries/Messages/`, `app/Handlers/Messages/`, `app/Actions/Messages/`, `app/Events/Messages/`; controller `app/Http/Controllers/employee/MessagesController.php` (lowercase portal namespace); routes `routes/api/employee.php` (`api/employee/messages/*`); migrations `database/migrations/alters/messages/`. |
| Frontend | React Native 0.86.3, Expo SDK 57 (`expo ~57.0.20`), React 19.2.3, TypeScript `~6.0.3` strict; module `resources/views/mobapp/src/module/employee/messages/`; `.tsx` / `.ts`. Read the SDK 57 docs before using an Expo API (`mobapp/AGENTS.md`). |
| HTTP client | `@/app/axios/http` (`src/app/axios/http.ts`) — returns the response body, already unwrapped from `AxiosResponse`; `messagesApi` reads `res.data` for the API's `data` field. All calls live in `services/messages.api.ts`. |
| State | `contexts/MessagesContext.tsx` (inbox, unread) and `hooks/useChatRoom.ts` (active conversation reducer, optimistic sends keyed by `clientId`, realtime, read receipts). |
| Database conventions | SubHRMS: no `->foreign()` on new tables; relationship columns in the messaging tables are `<entity>_id` (`conversation_id`, `account_id`), created before the rule and left as they are; soft delete via `is_deleted` on `messages`. v4 adds no table and no column; its only schema change is one unique index. |
| Design system | Shopify Restyle theme `src/theme/index.ts` (`Box`, `Text`, `useTheme` from `@/theme`); `lucide-react-native` icons. |
| Reference implementation | Backend: `app/Handlers/Messages/TogglePinMessageHandler.php` (handler shape) and `app/Actions/Messages/AdvanceThreadReadAction.php` (cache + lock). Mobile: `components/MessageSeenReceipt.tsx` and `utils/readReceipts.ts`. |
| Checks | Backend: `php artisan test --testsuite=Unit`; `php artisan test --testsuite=Feature` (needs the test database of §9 row 4); `./vendor/bin/pint --test <changed files>`; `php -l <file>`; `php artisan route:list --path=api/employee/messages`. Mobile (run in `resources/views/mobapp`): `npx tsc --noEmit`; `npm run lint`. There is no JS test runner. |
| Build state | The code for AC-1 – AC-108 already exists on branch `T00001` (backend HEAD `5b57c0e8`, mobapp HEAD `db364cc`) except the Known Gaps of spec §10.2. The tasks below are the delta: gap closure (TASK-03 – TASK-11, TASK-24 – TASK-30) and the tests and walks that prove the built code (TASK-16 – TASK-23, TASK-31 – TASK-34). `/webkit-implement` compares each task's Change with the current code, edits only what differs, and ticks the task when its Done when holds. |
| Blocked tasks | TASK-12 (Q-5), TASK-13 (Q-7), TASK-14 (Q-1), TASK-15 (Q-3) cannot be built until spec §10.3 answers the question. `/webkit-implement` skips them and reports `Specification clarification required`. This is why Plan Status is Draft. |

---

## 2. Reuse Map

| Artifact | Searched | Found | Decision |
| --- | --- | --- | --- |
| System-channel guard on four more endpoints | `grep -rn "checkSystemChannelAccess" app/` | `MessagesController::checkSystemChannelAccess` (private helper, 11 call sites) | REUSE the helper; add 4 call sites |
| Search parser extraction | `app/Queries/Messages/SearchMessagesQuery.php`, `tests/Unit/SearchMessagesSyntaxTest.php` | Parsing inline in `execute()`; the test re-implements it in `parseSyntax()` | EXTEND `SearchMessagesQuery` with `parseQuery()`; EXTEND the existing test |
| Inactive-caller rule in search | `SearchMessagesQuery::execute` (`$systemConvIds`), `GeneralAccessAction::check` | Authorisation checked for a scoped system channel only | EXTEND `SearchMessagesQuery` |
| Send validation | `app/Handlers/Messages/SendMessageHandler.php`, `grep -rn "4000\|cannot exceed" app/` | No empty-message check, no length cap | EXTEND `SendMessageHandler` |
| Replay dedupe | `grep -rni "client_id\|clientId\|idempotency\|dedupe" app/` | NONE in `app/` (the app uses `clientId` locally only) | EXTEND `SendMessageHandler` and `sendMessage`; CREATE a cache key (`send_replay_…`), no new file |
| Manager-channel gate | `Conversation::scopeVisibleTo`, `GetConversationsQuery.php:131`, `getUnreadCount` | The gate exists in the list and the unread count only | EXTEND `Conversation::scopeVisibleTo` |
| Unique member index | `database/migrations/**` for `conversation_members` | Table + `last_read_message_id` + `is_admin` migrations; no unique index | CREATE one alter migration — nothing existing adds the index |
| Member-row writes | `grep -n "conversation_members')->insert\|updateOrInsert" MessagesController.php` | 3 `insert` sites (join, approve, add members) and 2 `updateOrInsert` sites (read, mark-all) | EXTEND the controller with two private helpers |
| Search-engine leftovers | `composer.json`, `config/scout.php`, `app/` | `laravel/scout`, `meilisearch/meilisearch-php`, `config/scout.php`; unused by `app/` | MODIFY (remove) |
| Feature-test base | `tests/TestCase.php`, `tests/Feature/` | Empty base class; one Feature test needing no database | CREATE `tests/Feature/Messages/MessagesTestCase.php` |
| New unit tests | `tests/Unit/` | `Compute*ActionTest`, `SearchMessagesSyntaxTest` only | CREATE 3 files (`AdvanceThreadReadActionTest`, `FormatAttachmentsTest`, `GeneralAccessActionTest`) |
| `client_id` in the send call | `services/messages.api.ts`, `hooks/useChatRoom.ts:1088,1234` | `clientId` exists in `useChatRoom` and is not sent | EXTEND both files |
| Composer length cap | `components/MessageInputBar.tsx:2231` | `maxLength` 2000 per text block, no total cap | EXTEND `MessageInputBar` |
| Channel-create fallback | `components/CreateChannelModal.tsx` ("Fallback local creation") | Local fallback with `Date.now()` id | EXTEND (remove the fallback) |
| Demo tickets | `grep -rn "DEFAULT_HR_TICKETS" resources/views/mobapp/src` | `ChatToolsDrawer.tsx:72,157`; `ConversationScreen.tsx:59,588,2627,2875` | EXTEND both (remove) |
| Thread preview overflow | `components/MessageThreadPreview.tsx:141-147` | Overflow count `participants - 5` | EXTEND |
| Recording dot | `components/MessageInputBar.tsx:2002-2040` | Static `Box` dot | EXTEND |
| General description in the drawer | `components/GroupDetailsDrawer.tsx:130,955-960`, `ManageChannelModal.tsx:1474` | `isDefaultChannel` memo; the AC-36 text exists only in `ManageChannelModal` | EXTEND `GroupDetailsDrawer` |

---

## 3. File Change Map

| # | Path | Action | Task | Covers |
| --- | --- | --- | --- | --- |
| 1 | `tests/Feature/Messages/MessagesTestCase.php` | Create | TASK-02 | §11.1 Tier 2 |
| 2 | `app/Http/Controllers/employee/MessagesController.php` | Modify | TASK-03, TASK-10 | AC-75, AC-110, G-1, G-9 |
| 3 | `app/Queries/Messages/SearchMessagesQuery.php` | Modify | TASK-04, TASK-05, TASK-08 | AC-61, AC-109, G-2, G-16 |
| 4 | `app/Handlers/Messages/SendMessageHandler.php` | Modify | TASK-06, TASK-07 | AC-92, AC-93, AC-94, G-5 |
| 5 | `app/Models/Conversation.php` | Modify | TASK-08 | AC-109, G-7 |
| 6 | `database/migrations/alters/messages/2026_10_13_000001_add_unique_member_index_to_conversation_members_table.php` | Create | TASK-09 | AC-110, G-9 |
| 7 | `config/scout.php` | Modify (delete) | TASK-11 | G-13 |
| 8 | `tests/Unit/SearchMessagesSyntaxTest.php` | Modify | TASK-16 | AC-50 – AC-55, AC-57, AC-58, G-16 |
| 9 | `tests/Unit/AdvanceThreadReadActionTest.php` | Create | TASK-17 | AC-65, AC-68 |
| 10 | `tests/Unit/FormatAttachmentsTest.php` | Create | TASK-18 | AC-77, AC-78 |
| 11 | `tests/Unit/GeneralAccessActionTest.php` | Create | TASK-19 | AC-34, AC-75 |
| 12 | `tests/Feature/Messages/SearchMessagesTest.php`, `GeneralGuardTest.php` | Create | TASK-20 | AC-31 – AC-34, AC-39 – AC-41, AC-48, AC-49, AC-56, AC-59 – AC-61, AC-75, AC-109 |
| 13 | `tests/Feature/Messages/ReadPositionTest.php`, `ThreadReadTest.php`, `SeenReceiptsTest.php` | Create | TASK-21 | AC-63 – AC-73, AC-110 |
| 14 | `tests/Feature/Messages/SendMessageTest.php`, `ChannelRulesTest.php` | Create | TASK-22 | AC-77 – AC-88, AC-92 – AC-94, AC-109 |
| 15 | `tests/Feature/Messages/PinAndEventsTest.php`, `ThreadParticipantsTest.php`, `ChannelAuthTest.php` | Create | TASK-23 | AC-74, AC-76, AC-89 – AC-91 |
| 16 | `resources/views/mobapp/src/module/employee/messages/services/messages.api.ts` | Modify | TASK-24 | AC-94 |
| 17 | `resources/views/mobapp/src/module/employee/messages/hooks/useChatRoom.ts` | Modify | TASK-24 | AC-94 |
| 18 | `resources/views/mobapp/src/module/employee/messages/components/MessageInputBar.tsx` | Modify | TASK-25, TASK-29 | AC-92, AC-93, AC-21, G-15, G-17 |
| 19 | `resources/views/mobapp/src/module/employee/messages/components/CreateChannelModal.tsx` | Modify | TASK-26 | AC-6, AC-107, G-14 |
| 20 | `resources/views/mobapp/src/module/employee/messages/components/ChatToolsDrawer.tsx` | Modify | TASK-27 | AC-108, G-11 |
| 21 | `resources/views/mobapp/src/module/employee/messages/pages/ConversationScreen.tsx` | Modify | TASK-27 | AC-108, G-11 |
| 22 | `resources/views/mobapp/src/module/employee/messages/components/MessageThreadPreview.tsx` | Modify | TASK-28 | AC-104, G-6 |
| 23 | `resources/views/mobapp/src/module/employee/messages/components/GroupDetailsDrawer.tsx` | Modify | TASK-30 | AC-36, G-12 |

---

## 4. Phase 1 — Preparation

- **Goal:** Both repositories are on `T00001` and the backend can run Feature tests.
- **Exit check:** `git branch --show-current` prints `T00001` in the repo root and in `resources/views/mobapp`; `php artisan test --testsuite=Unit` runs.

- [ ] **TASK-01 — Confirm the baseline**
  - **Files:** None — verify only
  - **Change:** Confirm both repositories are on branch `T00001` with a clean tree; confirm backend HEAD contains `5b57c0e8` and mobapp HEAD contains `db364cc` (`git log --oneline -1`). Record in the implementation summary that tasks for built behavior are verified against the code, not rewritten.
  - **Covers:** Spec §7 Phase P4
  - **Depends on:** None
  - **Done when:** `git -C . branch --show-current` and `git -C resources/views/mobapp branch --show-current` both print `T00001`; `git status --short` prints nothing in both.

- [ ] **TASK-02 — Feature-test base class**
  - **Files:** `tests/Feature/Messages/MessagesTestCase.php` (Create)
  - **Change:** Abstract class `Tests\Feature\Messages\MessagesTestCase extends Tests\TestCase` using `Illuminate\Foundation\Testing\RefreshDatabase`. Helpers: `makeAccount(array $overrides = []): Account` (inserts the columns the messaging code reads: `fname`, `lname`, `pic`, `status` default `1`, `role_access` default `3`), `makeConversation(string $type = 'channel', array $overrides = []): Conversation`, `addMember(Conversation $c, Account $a, array $overrides = []): void` (inserts a `conversation_members` row), `makeMessage(Conversation $c, Account $a, array $overrides = []): Message`, and `actingAsAccount(Account $a)` calling `Laravel\Sanctum\Sanctum::actingAs($a)`. Do not create the `vw_accounts_details` view; `seenByFor` already tolerates its absence.
  - **Covers:** Spec §11.1 Tier 2, A-8
  - **Depends on:** None (the test database of §9 row 4 must exist to run it)
  - **Done when:** A smoke test in the same file's sibling `SmokeTest` creates two accounts and one `dm` conversation and asserts `GET /api/employee/messages/conversations` returns it for one of them; `php artisan test --filter=MessagesSmoke` passes.

---

## 5. Phase 2 — Backend

- **Goal:** The Known Gaps G-1, G-2, G-5, G-7, G-9, G-13 and G-16 of spec §10.2 are closed, and every backend AC of spec §2.5 has an automated test.
- **Exit check:** `php artisan route:list --path=api/employee/messages` lists the routes of spec §4.1 unchanged; `php -l` passes for every changed PHP file; `./vendor/bin/pint --test` passes for the changed files; `php artisan test --testsuite=Unit` is green.

- [ ] **TASK-03 — Guard the four unguarded conversation-scoped endpoints**
  - **Files:** `app/Http/Controllers/employee/MessagesController.php` (Modify)
  - **Change:** After the unauthenticated check in `markThreadAsRead` (`$conversationId`), `getMessageSeenReceipts` (`$conversationId`), `updateTicketStatus` (`$conversationId`) add `if ($denied = $this->checkSystemChannelAccess($conversationId)) return $denied;`. In `getMessage`, after loading `$message`, add the same call with `$message->conversation_id`. No other behavior changes; the helper already returns `403 { success:false, message:"Your account is inactive. Please contact HR to restore access.", code:"ACCOUNT_INACTIVE" }`.
  - **Covers:** AC-75, spec §4.3, G-1
  - **Depends on:** None
  - **Done when:** `grep -n "checkSystemChannelAccess(" app/Http/Controllers/employee/MessagesController.php` shows a call in each of the four methods; `php -l app/Http/Controllers/employee/MessagesController.php` passes.

- [ ] **TASK-04 — Inactive callers never see System-channel messages in search**
  - **Files:** `app/Queries/Messages/SearchMessagesQuery.php` (Modify)
  - **Change:** In the unscoped branch, compute `$systemConvIds` (the `is_system` / `General` / `announcement` query) only when `(int) $user->status === 1`; for an inactive caller only the conversations the caller is a member of remain, minus any conversation with `is_system = 1` or the name `General`. Scoped branches are unchanged (they already require `status === 1` for a system channel).
  - **Covers:** AC-61, spec §4.3, G-2
  - **Depends on:** None
  - **Done when:** `php -l app/Queries/Messages/SearchMessagesQuery.php` passes; with a caller whose `status = 0`, `SearchMessagesQuery::execute(['q' => 'x'])` builds `$allowedConvIds` without any `is_system` conversation (asserted by TASK-20).

- [ ] **TASK-05 — Extract the search parser into a pure method**
  - **Files:** `app/Queries/Messages/SearchMessagesQuery.php` (Modify)
  - **Change:** Add `public static function parseQuery(array $params): array` returning `['text' => string, 'channel' => string, 'is_direct' => bool, 'has_file' => bool, 'is_pinned' => bool, 'days' => ?int, 'from' => string, 'sender_id' => ?int]`. Move into it, unchanged and in the same order, the code of `execute()` from reading `q` / `query` through the leading `#` / `@` extraction (spec §4.4 table). `execute()` calls it and keeps the database lookups (`from` account, channel / colleague resolution, authorisation, queries). `parseQuery` touches no model, no `Auth` and no database.
  - **Covers:** AC-50 – AC-55, AC-57, AC-58, G-16
  - **Depends on:** TASK-04
  - **Done when:** `php -l app/Queries/Messages/SearchMessagesQuery.php` passes; `parseQuery(['q' => '#general from:maria has:file during:30d invoice'])` returns `text` `invoice`, `channel` `general`, `is_direct` false, `has_file` true, `days` 30, `from` `maria`.

- [ ] **TASK-06 — Reject empty and over-long messages**
  - **Files:** `app/Handlers/Messages/SendMessageHandler.php` (Modify)
  - **Change:** After the channel join check and before `DB::transaction`, add: when `trim((string) $text) === ''` and `$attachments` is empty throw `new \Exception('A message needs text or an attachment.', 422)`; when `mb_strlen((string) $text) > 4000` throw `new \Exception('A message cannot exceed 4000 characters.', 422)`. `MessagesController::sendMessage` already maps a 4xx exception code to the HTTP status.
  - **Covers:** AC-92, AC-93, G-5
  - **Depends on:** None
  - **Done when:** `php -l app/Handlers/Messages/SendMessageHandler.php` passes; `POST …/messages` with `text: "   "` and no attachments returns `422` with the first message above (asserted by TASK-22).

- [ ] **TASK-07 — Dedupe a replayed send within 2 seconds**
  - **Files:** `app/Handlers/Messages/SendMessageHandler.php`, `app/Http/Controllers/employee/MessagesController.php` (Modify)
  - **Change:** `sendMessage` passes `'client_id' => $request->input('client_id')` to the handler. In the handler: normalise `$clientId` to a trimmed string of at most 64 characters or `null`; when set, build `$key = "send_replay_{$conversationId}_{$user->id}_" . md5($clientId)`; wrap the existing persist step in `Cache::lock("lock_{$key}", 5)->block(3, …)`; inside the lock, when `Cache::get($key)` holds a message id, load that message with `['sender', 'reactions', 'attachments', 'parent.sender']` and return `GetMessagesQuery::formatMessage($message, $user, 0)` without creating a row or broadcasting; after a successful create, `Cache::put($key, $message->id, 2)`. With no `client_id` nothing changes.
  - **Covers:** AC-94, G-5
  - **Depends on:** TASK-06
  - **Done when:** `php -l` passes for both files; two `POST …/messages` with the same `client_id` one second apart return the same `data.id` and leave one `messages` row (asserted by TASK-22).

- [ ] **TASK-08 — Apply the manager-channel gate everywhere a conversation is read**
  - **Files:** `app/Models/Conversation.php`, `app/Queries/Messages/SearchMessagesQuery.php` (Modify)
  - **Change:** In `scopeVisibleTo` add: when `! in_array((int) ($user->role_access ?? 0), [1, 2, 7], true)`, `$query->where(fn ($q) => $q->whereNull('role')->orWhere('role', '!=', 'manager'))`, applied to the whole scope (members included). In `SearchMessagesQuery::execute`, (a) after computing `$isAuthorized` for a scoped channel, require `Conversation::isVisibleTo($targetChannel->id, $user)` as well, and (b) intersect the unscoped `$allowedConvIds` with `Conversation::visibleTo($user)->pluck('id')`. `GetConversationsQuery` and `getUnreadCount` keep their own gate.
  - **Covers:** AC-109, spec §6.1 rule 1, G-7
  - **Depends on:** TASK-05
  - **Done when:** `php -l` passes for both files; for a caller with `role_access = 3`, `Conversation::isVisibleTo($managerChannelId, $caller)` is `false` and for `role_access = 7` it is `true` (asserted by TASK-20 and TASK-22).

- [ ] **TASK-09 — Unique index on conversation_members**
  - **Files:** `database/migrations/alters/messages/2026_10_13_000001_add_unique_member_index_to_conversation_members_table.php` (Create)
  - **Change:** `up()`: return when `! Schema::hasTable('conversation_members')` or the index `uq_conversation_members_conv_account` already exists. Count duplicate pairs with `DB::table('conversation_members')->select('conversation_id', 'account_id')->groupBy('conversation_id', 'account_id')->havingRaw('COUNT(*) > 1')->count()`; when greater than 0 throw `new \RuntimeException("conversation_members has {$n} duplicate (conversation_id, account_id) pairs; resolve them, then run the migration again.")` and change nothing. Otherwise `$table->unique(['conversation_id', 'account_id'], 'uq_conversation_members_conv_account')`. `down()` drops that index. No `->foreign()`. Never deletes rows.
  - **Covers:** AC-110, G-9
  - **Depends on:** None
  - **Done when:** `php artisan migrate --pretend` lists the `ALTER TABLE conversation_members ADD UNIQUE uq_conversation_members_conv_account` statement; the file passes `php -l`.

- [ ] **TASK-10 — Race-safe member-row writes**
  - **Files:** `app/Http/Controllers/employee/MessagesController.php` (Modify)
  - **Change:** Add `private function upsertReadPosition(int $conversationId, int $accountId, int $messageId): void` — `DB::table('conversation_members')->updateOrInsert(['conversation_id' => …, 'account_id' => …], ['last_read_message_id' => $messageId, 'updated_at' => now()])` inside `try`; on `Illuminate\Database\QueryException` whose `$e->errorInfo[1] === 1062` run the matching `->update(…)` instead; rethrow anything else. Add `private function insertMemberRow(array $row): void` — `DB::table('conversation_members')->insert($row)` swallowing only error 1062. Use `upsertReadPosition` in `markConversationAsRead` (first-read insert) and in `markAllAsRead`; use `insertMemberRow` in `joinChannel`, `approveJoinRequest` and `addConversationMembers`. Response bodies and messages are unchanged.
  - **Covers:** AC-110, G-9
  - **Depends on:** TASK-09
  - **Done when:** `grep -n "updateOrInsert\|conversation_members')->insert" app/Http/Controllers/employee/MessagesController.php` shows only the two helpers; `php -l app/Http/Controllers/employee/MessagesController.php` passes.

- [ ] **TASK-11 — Remove the unused search-engine dependencies**
  - **Files:** `config/scout.php` (Modify — delete the file); `composer.json` (changed by the user command of §9 row 1)
  - **Change:** Delete `config/scout.php`. Search does not use Scout (spec Decision 6). The user removes `laravel/scout` and `meilisearch/meilisearch-php` with the command in §9 row 1; `/webkit-implement` does not run it.
  - **Covers:** G-13, Decision 6
  - **Depends on:** None
  - **Done when:** `grep -rni "scout\|meilisearch" app config routes` prints nothing; `config/scout.php` is absent.

- [ ] **TASK-12 — BLOCKED — authorise the ticket-status write (Q-5)**
  - **Files:** To be named when Q-5 is answered
  - **Change:** BLOCKED — Specification clarification required: spec §10.3 Q-5 (who may approve or decline an application from a chat card). Once answered and written into the spec, `/webkit-specify T00001` replaces this text with the exact change to `MessagesController::updateTicketStatus` (approver check, the exact-docnumber match instead of `orWhere('id', $numericId)`, the rejection response).
  - **Covers:** G-3, Q-5
  - **Depends on:** Q-5 answered
  - **Done when:** Q-5 is answered in spec §10.3 and this task is rewritten; until then it stays unticked.

- [ ] **TASK-13 — BLOCKED — persist message requests (Q-7)**
  - **Files:** To be named when Q-7 is answered
  - **Change:** BLOCKED — Specification clarification required: spec §10.3 Q-7 (what a message request is in the backend and whether Accept / Decline persist). The answer fixes the table or `conversations.type` value, the Query / Handler pair, the routes and the change to `MessageRequestsScreen.tsx`.
  - **Covers:** AC-7, G-4, Q-7
  - **Depends on:** Q-7 answered
  - **Done when:** Q-7 is answered in spec §10.3 and this task is rewritten; until then it stays unticked.

- [ ] **TASK-14 — BLOCKED — attachment limits (Q-1)**
  - **Files:** To be named when Q-1 is answered
  - **Change:** BLOCKED — Specification clarification required: spec §10.3 Q-1 (10 MB and an allow-list, as v3 said, or the 100 MB / any-type behavior shipped since 2026-09-10). The answer fixes the change to `MessagesController::uploadAttachment` (`file|max:…`) and `UploadAttachmentHandler`.
  - **Covers:** Spec §6.2 Input validation, Q-1
  - **Depends on:** Q-1 answered
  - **Done when:** Q-1 is answered in spec §10.3 and this task is rewritten; until then it stays unticked.

- [ ] **TASK-15 — BLOCKED — one definition of unread (Q-3)**
  - **Files:** To be named when Q-3 is answered
  - **Change:** BLOCKED — Specification clarification required: spec §10.3 Q-3 (whether unread counts include thread replies not sent to the channel). The answer fixes the change to `getUnreadCount`, `GetConversationsQuery` and `markConversationAsRead`.
  - **Covers:** Q-3
  - **Depends on:** Q-3 answered
  - **Done when:** Q-3 is answered in spec §10.3 and this task is rewritten; until then it stays unticked.

- [ ] **TASK-16 — Point the parser tests at the real parser**
  - **Files:** `tests/Unit/SearchMessagesSyntaxTest.php` (Modify)
  - **Change:** Replace the private `parseSyntax()` body (the copy of the parsing logic) with a call to `App\Queries\Messages\SearchMessagesQuery::parseQuery()`, mapping its result to the array the existing assertions read. Change the base class to `Tests\TestCase` only if `parseQuery` needs the container; it does not, so keep `PHPUnit\Framework\TestCase`. Keep the 10 existing test methods. Limit and page are applied in `execute()`, not in `parseQuery`, so AC-58 is asserted in TASK-20 and not here.
  - **Covers:** AC-50 – AC-55, AC-57, G-16
  - **Depends on:** TASK-05
  - **Done when:** `php artisan test --filter=SearchMessagesSyntaxTest` passes with 10 tests; deleting the `has:` regex from `parseQuery` makes `test_extracts_has_file_modifier` fail.

- [ ] **TASK-17 — Test the thread read action**
  - **Files:** `tests/Unit/AdvanceThreadReadActionTest.php` (Create)
  - **Change:** Extends `Tests\TestCase` (array cache). Cases: first call with `message_id` 60 returns `['advanced' => true, 'last_read_id' => 60]`; a call with 55 returns `['advanced' => false, 'last_read_id' => 60]`; a repeat of 60 returns `advanced` false; a call with `thread_root_id` 0, `account_id` 0 or `message_id` 0 returns `['advanced' => false, 'last_read_id' => 0]`; the cache key written is `GetMessagesQuery::threadReadCacheKey($root, $account)`.
  - **Covers:** AC-65, AC-68
  - **Depends on:** None
  - **Done when:** `php artisan test --filter=AdvanceThreadReadActionTest` passes with 5 tests.

- [ ] **TASK-18 — Test the attachment payload**
  - **Files:** `tests/Unit/FormatAttachmentsTest.php` (Create)
  - **Change:** Extends `Tests\TestCase`. Build `new App\Models\MessageAttachment([...])` objects (no database). Assert `GetMessagesQuery::formatAttachments([...])` returns `id`, `name`, `size`, `type`, `path`, `url`, `width`, `height`; `width` / `height` are `null` when the model has none; `url` equals `path` when `path` starts with `http`.
  - **Covers:** AC-77, AC-78
  - **Depends on:** None
  - **Done when:** `php artisan test --filter=FormatAttachmentsTest` passes with 3 tests.

- [ ] **TASK-19 — Test the General access action**
  - **Files:** `tests/Unit/GeneralAccessActionTest.php` (Create)
  - **Change:** Extends `Tests\TestCase`. `check()` returns `true` for a non-system `Conversation` whatever the user status; `true` for `is_system` with `status` `1`; `false` for `is_system` with `status` `0`. `denyResponse()` equals `['success' => false, 'message' => 'Your account is inactive. Please contact HR to restore access.', 'code' => 'ACCOUNT_INACTIVE']`. `guard()` returns `null` when allowed and a `403` `JsonResponse` when denied. Models are built with `new`, not saved.
  - **Covers:** AC-34, AC-75
  - **Depends on:** None
  - **Done when:** `php artisan test --filter=GeneralAccessActionTest` passes with 4 tests.

- [ ] **TASK-20 — Feature tests: search and the General guard**
  - **Files:** `tests/Feature/Messages/SearchMessagesTest.php`, `tests/Feature/Messages/GeneralGuardTest.php` (Create)
  - **Change:** `SearchMessagesTest` (extends `MessagesTestCase`): AC-48 (membership scope, `data` equals `messages`, `id` descending, deleted excluded), AC-49 (empty), AC-56 (private channel as non-member; inactive caller naming General — both return the empty result with `channel` null), AC-58 (`limit=500&page=0` → `per_page` 100, `current_page` 1), AC-59 (`users` ≤ 30, `conversations` ≤ 15 with `is_member`, page 2 empty), AC-60 (`mode=direct`), AC-61 (inactive caller, unscoped, text matching a General message → no General rows), AC-109 (manager channel hidden from `role_access` 3). `GeneralGuardTest`: for an inactive account assert `403` with `code: ACCOUNT_INACTIVE` on `GET /conversations/{G}`, `GET …/messages`, `POST …/messages`, `POST …/typing`, `POST …/read`, `GET …/replies`, `POST …/reactions`, `POST …/pin`, `GET …/pinned`, `PUT` and `DELETE …/messages/{id}`, `POST …/messages/{root}/read`, `GET …/messages/{id}/seen`, `GET /message-detail/{id}` and `POST …/ticket-status`; for an active account the same calls do not return `403`.
  - **Covers:** AC-31 – AC-34, AC-39 – AC-41, AC-48, AC-49, AC-56, AC-58 – AC-61, AC-75, AC-109
  - **Depends on:** TASK-02, TASK-03, TASK-04, TASK-08
  - **Done when:** `php artisan test --filter="SearchMessagesTest|GeneralGuardTest"` passes.

- [ ] **TASK-21 — Feature tests: read positions, threads, seen receipts**
  - **Files:** `tests/Feature/Messages/ReadPositionTest.php`, `ThreadReadTest.php`, `SeenReceiptsTest.php` (Create)
  - **Change:** Use `Event::fake([\App\Events\Messages\MessagesRead::class, \App\Events\Messages\UnreadCountUpdated::class])`. `ReadPositionTest`: AC-63 (`read_receipts` lists only B), AC-64 (lower id leaves 120), AC-65 (one `MessagesRead` for two identical calls), AC-66 (default target, `remaining_unread` 0), AC-67 (public non-member row inserted; private non-member `404` and no row), AC-73 (`mark-all-read`), AC-110 (two sequential first reads leave one row; with the unique index present the second does not return 5xx). `ThreadReadTest`: AC-68 (60 then 55), AC-69 (`Thread not found` / `Conversation not found`), AC-70 (sender's own reply sets `user_last_read_id` 80), AC-71 (`replies` payload shape, `seen_at` null). `SeenReceiptsTest`: AC-72 (`seen_by` only B, `seen_count` 1, sender excluded, `404 Message not found`).
  - **Covers:** AC-63 – AC-73, AC-110
  - **Depends on:** TASK-02, TASK-10
  - **Done when:** `php artisan test --filter="ReadPositionTest|ThreadReadTest|SeenReceiptsTest"` passes.

- [ ] **TASK-22 — Feature tests: sending and channel rules**
  - **Files:** `tests/Feature/Messages/SendMessageTest.php`, `ChannelRulesTest.php` (Create)
  - **Change:** `SendMessageTest`: AC-77, AC-78 (dimensions stored and returned; `0`, `-5`, `20001`, `"abc"` → `NULL`), AC-87 (non-member of a regular channel → `403 You must join this channel before sending messages.`), AC-88 (`role_access` 3 in an announcement → `403`; 1, 2, 4, 7 → `200`), AC-92 (blank text, no attachment → `422 A message needs text or an attachment.`; blank text with an attachment → `200`), AC-93 (4,001 → `422`; 4,000 → `200`), AC-94 (same `client_id` twice → same `data.id`, one row; after `Carbon::setTestNow` +3 s → new message), AC-109 (`POST` to a manager channel as `role_access` 3 → `404 Conversation not found`). `ChannelRulesTest`: AC-79 – AC-86 exactly as the spec rows state, including the system event rows of AC-82.
  - **Covers:** AC-77 – AC-88, AC-92 – AC-94, AC-109
  - **Depends on:** TASK-02, TASK-06, TASK-07, TASK-08
  - **Done when:** `php artisan test --filter="SendMessageTest|ChannelRulesTest"` passes.

- [ ] **TASK-23 — Feature tests: pins, events, participants, channel auth**
  - **Files:** `tests/Feature/Messages/PinAndEventsTest.php`, `ThreadParticipantsTest.php`, `ChannelAuthTest.php` (Create)
  - **Change:** `PinAndEventsTest`: AC-89 (toggle twice, `MessagePinUpdated` dispatched, `message_pinned` / `message_unpinned` rows, deleted → `400 Cannot pin a deleted message`), AC-90 (`GET …/pinned`), AC-91 (no membership event rows for a system channel; `channel_renamed` still recorded). `ThreadParticipantsTest`: AC-76 (`threadCount` 4, `threadParticipants` `[B, C, D]`, `threadLastReplyUser`). `ChannelAuthTest`: AC-74 — call `Broadcast::channel` authorisation through `POST /broadcasting/auth` (or by invoking the callback closure registered in `routes/channels.php`) for a private-channel non-member (rejected) and a member (accepted with `{ id, name }`).
  - **Covers:** AC-74, AC-76, AC-89 – AC-91
  - **Depends on:** TASK-02
  - **Done when:** `php artisan test --filter="PinAndEventsTest|ThreadParticipantsTest|ChannelAuthTest"` passes.

---

## 6. Phase 3 — Frontend Integration

- **Goal:** The mobile app sends `client_id`, enforces the composer limits of AC-92 / AC-93, and no longer fabricates channels or tickets; the thread preview, record dot and General description match the spec.
- **Exit check:** `npx tsc --noEmit` and `npm run lint`, run in `resources/views/mobapp`, report no new error in the changed files.

- [ ] **TASK-24 — Send `client_id` with every message**
  - **Files:** `resources/views/mobapp/src/module/employee/messages/services/messages.api.ts`, `resources/views/mobapp/src/module/employee/messages/hooks/useChatRoom.ts` (Modify)
  - **Change:** In `messagesApi.sendMessage` add an eighth parameter `clientId?: string` and put `client_id: clientId` in the POST body. In `useChatRoom.ts` pass the existing `clientId` (created at line 1088) as the eighth argument of the call at line 1234. A retry (`retryMessage`) creates a new `clientId`, as it does today. Thread replies sent through `useChatRoom.sendMessage` carry it too.
  - **Covers:** AC-94
  - **Depends on:** TASK-07
  - **Done when:** `npx tsc --noEmit` reports no error in the two files; in the network inspector a send request body contains `client_id` equal to the optimistic item `clientId`.

- [ ] **TASK-25 — Enforce the 4,000-character total and block blank sends in the composer**
  - **Files:** `resources/views/mobapp/src/module/employee/messages/components/MessageInputBar.tsx` (Modify)
  - **Change:** Compute `serializedLength = serializeBlocksToMarkdown(blocks).trim().length` next to `hasMessageContent` (line 281). `canSend` becomes false when `serializedLength > 4000`. When `serializedLength > 4000` show one `Text` line above the input reading `Message is too long (max 4000 characters).`. Keep the per-block `maxLength` of 2000 for text blocks. Blank or whitespace-only text without an attachment already leaves `canSend` false; keep that.
  - **Covers:** AC-92, AC-93, G-17
  - **Depends on:** TASK-06
  - **Done when:** `npx tsc --noEmit` reports no error; with 4,001 characters across two blocks the Send button is disabled and the line is shown; with 4,000 it is enabled.

- [ ] **TASK-26 — Remove the local fallback when channel creation fails**
  - **Files:** `resources/views/mobapp/src/module/employee/messages/components/CreateChannelModal.tsx` (Modify)
  - **Change:** In the `catch` block of the submit handler delete the "Fallback local creation" branch (the `Date.now()` id, `routeChannelToSection(fallbackId, …)`, `addOrUpdateConversation(fallbackConv)`, `onChannelCreated(fallbackConv, …)`, `handleClose()` and the `router.push` to the fallback id). Replace it with `Alert.alert('Could not create channel', error?.message || 'Please try again.')` (add `Alert` to the file's existing `react-native` import, the pattern `ManageChannelModal.tsx` uses) and `return`, leaving the modal open with the entered values and clearing the submitting flag.
  - **Covers:** AC-6, AC-107, G-14
  - **Depends on:** None
  - **Done when:** `npx tsc --noEmit` reports no error; with the device offline, submitting shows the alert, the conversation list is unchanged and no section assignment is stored.

- [ ] **TASK-27 — Remove the demo tickets**
  - **Files:** `resources/views/mobapp/src/module/employee/messages/components/ChatToolsDrawer.tsx`, `resources/views/mobapp/src/module/employee/messages/pages/ConversationScreen.tsx` (Modify)
  - **Change:** `ChatToolsDrawer.tsx`: change the default `tickets = DEFAULT_HR_TICKETS` (line 157) to `tickets = []`; delete the exported `DEFAULT_HR_TICKETS` constant (line 72) and render an empty state `No recent applications` on the tickets tab when `pendingTickets` is empty. `ConversationScreen.tsx`: remove the import of `DEFAULT_HR_TICKETS` (line 59); at line 588 return `[]` instead of `DEFAULT_HR_TICKETS`; at lines 2627 and 2875 look the ticket up only in `userTickets`. `HR_TEMPLATES` is not touched.
  - **Covers:** AC-108, G-11
  - **Depends on:** None
  - **Done when:** `grep -rn "DEFAULT_HR_TICKETS" resources/views/mobapp/src` prints nothing; `npx tsc --noEmit` reports no error; the tickets tab with no applications shows `No recent applications`.

- [ ] **TASK-28 — Correct the thread-preview overflow badge**
  - **Files:** `resources/views/mobapp/src/module/employee/messages/components/MessageThreadPreview.tsx` (Modify)
  - **Change:** At lines 141-147 keep `hasOverflow = participants.length > 5` and `visible = hasOverflow ? participants.slice(0, 4) : participants.slice(0, 5)`; change `overflowCount` to `hasOverflow ? participants.length - 4 : 0` and keep `overflowText = overflowCount >= 9 ? '9+' : `${overflowCount}+``. Nothing else changes.
  - **Covers:** AC-104, G-6
  - **Depends on:** None
  - **Done when:** `npx tsc --noEmit` reports no error; 6 distinct repliers render 4 avatars and `2+`; 5 repliers render 5 avatars and no badge; 13 repliers render `9+`.

- [ ] **TASK-29 — Pulse the recording dot**
  - **Files:** `resources/views/mobapp/src/module/employee/messages/components/MessageInputBar.tsx` (Modify)
  - **Change:** Replace the static 8 × 8 red `Box` in the recording state (lines ~2029-2035) with an `Animated.View` from `react-native` of the same size and colour whose `opacity` loops 1 → 0.3 → 1 (`Animated.loop` over an `Animated.sequence` of two `Animated.timing` calls, `useNativeDriver: true`, 600 ms per leg). Start the loop in an effect when `isRecording` becomes true and stop it (`animation.stop()`) when it becomes false or the component unmounts.
  - **Covers:** AC-21, G-15
  - **Depends on:** TASK-25
  - **Done when:** `npx tsc --noEmit` reports no error; on a device the dot visibly pulses while recording and stops after cancel or send.

- [ ] **TASK-30 — Show the General description in the channel drawer**
  - **Files:** `resources/views/mobapp/src/module/employee/messages/components/GroupDetailsDrawer.tsx` (Modify)
  - **Change:** In the description expression at lines 955-960 add a first branch: when `isDefaultChannel` return `Everyone with an active HRMS account has access to this channel.` before `fetchedDescription` / `conversationDescription` / the member-count fallback.
  - **Covers:** AC-36, G-12
  - **Depends on:** None
  - **Done when:** `npx tsc --noEmit` reports no error; the drawer of General shows the sentence; the drawer of a user-created channel is unchanged.

---

## 7. Phase 4 — Validation

- **Goal:** Every AC in spec §2.5 is exercised (§8) and the project's checks pass.
- **Exit check:** `php artisan test` is green (Tier 2 only when the test database exists); `npx tsc --noEmit` and `npm run lint` pass in `resources/views/mobapp`; spec §11.3 MT-1 – MT-10 are walked.

- [ ] **TASK-31 — Run the Tier 1 backend tests**
  - **Files:** None — command
  - **Change:** Run `php artisan test --testsuite=Unit`.
  - **Covers:** AC-34, AC-50 – AC-55, AC-57, AC-58, AC-65, AC-68, AC-75, AC-77, AC-78
  - **Depends on:** TASK-16, TASK-17, TASK-18, TASK-19
  - **Done when:** The command exits 0 and lists `SearchMessagesSyntaxTest` (10), `AdvanceThreadReadActionTest` (5), `FormatAttachmentsTest` (3), `GeneralAccessActionTest` (4) as passed.

- [ ] **TASK-32 — Run the Tier 2 backend tests**
  - **Files:** None — command
  - **Change:** With the test database of §9 row 4 in place run `php artisan test --testsuite=Feature`. When the database does not exist, record `Tier 2 deferred (A-8)` in the implementation summary and leave this task unticked.
  - **Covers:** AC-31 – AC-34, AC-39 – AC-41, AC-48, AC-49, AC-56, AC-59 – AC-61, AC-63 – AC-94, AC-109, AC-110
  - **Depends on:** TASK-20, TASK-21, TASK-22, TASK-23
  - **Done when:** The command exits 0 and every file of TASK-20 – TASK-23 is listed as passed.

- [ ] **TASK-33 — Run the static checks**
  - **Files:** None — command
  - **Change:** Backend: `./vendor/bin/pint --test` on every PHP file changed by TASK-03 – TASK-11 and TASK-16 – TASK-23, and `php -l` on each. Mobile, in `resources/views/mobapp`: `npx tsc --noEmit` and `npm run lint`.
  - **Covers:** Spec §11.2
  - **Depends on:** TASK-24, TASK-25, TASK-26, TASK-27, TASK-28, TASK-29, TASK-30
  - **Done when:** Pint and `php -l` report no issue; `npx tsc --noEmit` and `npm run lint` report no new error in the changed files.

- [ ] **TASK-34 — Walk the manual verification**
  - **Files:** None — manual
  - **Change:** Walk spec §11.3 MT-1 – MT-10 on two devices (iOS and Android) plus the web viewport, including MT-9 (AC-1 – AC-30, AC-35 – AC-37). Record the result of each MT row in the implementation summary.
  - **Covers:** AC-1 – AC-30, AC-35 – AC-47, AC-62, AC-95 – AC-108
  - **Depends on:** TASK-24, TASK-25, TASK-26, TASK-27, TASK-28, TASK-29, TASK-30
  - **Done when:** Every MT row of spec §11.3 has a recorded pass, or a recorded reason it was not run.

---

## 8. Acceptance Walk

| AC | Exercised By | Command / Steps | Task |
| --- | --- | --- | --- |
| AC-1 | Manual | MT-9 | TASK-34 |
| AC-2 | Manual | MT-9 | TASK-34 |
| AC-3 | Manual | MT-9 | TASK-34 |
| AC-4 | Manual | MT-9 | TASK-34 |
| AC-5 | Manual | MT-9 | TASK-34 |
| AC-6 | Manual | MT-9 | TASK-26, TASK-34 |
| AC-7 | Manual | MT-9 | TASK-13 (blocked, Q-7), TASK-34 |
| AC-8 | Manual | MT-9 | TASK-34 |
| AC-9 | Manual | MT-9 | TASK-34 |
| AC-10 | Manual | MT-9 | TASK-34 |
| AC-11 | Manual | MT-9 | TASK-34 |
| AC-12 | Manual | MT-9 | TASK-34 |
| AC-13 | Manual | MT-9 | TASK-34 |
| AC-14 | Manual | MT-9 | TASK-34 |
| AC-15 | Manual | MT-9 | TASK-34 |
| AC-16 | Manual | MT-9 | TASK-34 |
| AC-17 | Manual | MT-9 | TASK-34 |
| AC-18 | Manual | MT-9 | TASK-34 |
| AC-19 | Manual | MT-9 | TASK-34 |
| AC-20 | Manual | MT-9 | TASK-34 |
| AC-21 | Manual | MT-9 | TASK-29, TASK-34 |
| AC-22 | Manual | MT-9 | TASK-34 |
| AC-23 | Manual | MT-9 | TASK-34 |
| AC-24 | Manual | MT-9 | TASK-34 |
| AC-25 | Manual | MT-9 | TASK-34 |
| AC-26 | Manual | MT-9 | TASK-34 |
| AC-27 | Manual | MT-9 | TASK-34 (roles: Q-2) |
| AC-28 | Manual | MT-9 | TASK-34 |
| AC-29 | Manual | MT-9 | TASK-34 |
| AC-30 | Manual | MT-9 | TASK-34 |
| AC-31 | Automated | `php artisan test --filter=GeneralGuardTest` | TASK-03, TASK-20 |
| AC-32 | Automated | `php artisan test --filter=GeneralGuardTest` | TASK-03, TASK-20 |
| AC-33 | Automated | `php artisan test --filter=GeneralGuardTest` | TASK-03, TASK-20 |
| AC-34 | Automated | `php artisan test --filter=GeneralGuardTest` | TASK-03, TASK-20 |
| AC-35 | Manual | MT-9 | TASK-34 |
| AC-36 | Manual | MT-9 | TASK-30, TASK-34 |
| AC-37 | Manual | MT-9 | TASK-34 |
| AC-38 | Manual | MT-8 | TASK-34 |
| AC-39 | Automated | `php artisan test --filter=GeneralGuardTest` | TASK-03, TASK-20 |
| AC-40 | Automated | `php artisan test --filter=GeneralGuardTest` | TASK-03, TASK-20 |
| AC-41 | Automated | `php artisan test --filter=GeneralGuardTest` | TASK-03, TASK-20 |
| AC-42 | Manual | MT-9 (mention picker and message render in General) | TASK-34 |
| AC-43 | Manual | MT-9 (mention picker and message render in General) | TASK-34 |
| AC-44 | Manual | MT-9 (mention picker and message render in General) | TASK-34 |
| AC-45 | Manual | MT-9 (mention picker and message render in General) | TASK-34 |
| AC-46 | Manual | MT-8 (set `status` 0 then 1; reopen General) | TASK-34 |
| AC-47 | Manual | MT-8 (set `status` 0 then 1; reopen General) | TASK-34 |
| AC-48 | Automated | `php artisan test --filter=SearchMessagesTest` | TASK-20 |
| AC-49 | Automated | `php artisan test --filter=SearchMessagesTest` | TASK-20 |
| AC-50 | Automated | `php artisan test --filter=SearchMessagesSyntaxTest` (parsing) and `SearchMessagesTest` (scope) | TASK-05, TASK-16, TASK-20 |
| AC-51 | Automated | `php artisan test --filter=SearchMessagesSyntaxTest` (parsing) and `SearchMessagesTest` (scope) | TASK-05, TASK-16, TASK-20 |
| AC-52 | Automated | `php artisan test --filter=SearchMessagesSyntaxTest` (parsing) and `SearchMessagesTest` (scope) | TASK-05, TASK-16, TASK-20 |
| AC-53 | Automated | `php artisan test --filter=SearchMessagesSyntaxTest` (parsing) and `SearchMessagesTest` (scope) | TASK-05, TASK-16, TASK-20 |
| AC-54 | Automated | `php artisan test --filter=SearchMessagesSyntaxTest` (parsing) and `SearchMessagesTest` (scope) | TASK-05, TASK-16, TASK-20 |
| AC-55 | Automated | `php artisan test --filter=SearchMessagesSyntaxTest` (parsing) and `SearchMessagesTest` (scope) | TASK-05, TASK-16, TASK-20 |
| AC-56 | Automated | `php artisan test --filter=SearchMessagesTest` | TASK-20 |
| AC-57 | Automated | `php artisan test --filter=SearchMessagesSyntaxTest` (parsing) and `SearchMessagesTest` (scope) | TASK-05, TASK-16, TASK-20 |
| AC-58 | Automated | `php artisan test --filter=SearchMessagesTest` | TASK-20 |
| AC-59 | Automated | `php artisan test --filter=SearchMessagesTest` | TASK-20 |
| AC-60 | Automated | `php artisan test --filter=SearchMessagesTest` | TASK-20 |
| AC-61 | Automated | `php artisan test --filter=SearchMessagesTest` | TASK-04, TASK-20 |
| AC-62 | Manual | MT-10 | TASK-34 |
| AC-63 | Automated | `php artisan test --filter=ReadPositionTest` | TASK-21 |
| AC-64 | Automated | `php artisan test --filter=ReadPositionTest` | TASK-21 |
| AC-65 | Automated | `php artisan test --filter=ReadPositionTest` | TASK-21 |
| AC-66 | Automated | `php artisan test --filter=ReadPositionTest` | TASK-21 |
| AC-67 | Automated | `php artisan test --filter=ReadPositionTest` | TASK-21 |
| AC-68 | Automated | `php artisan test --filter="AdvanceThreadReadActionTest|ThreadReadTest"` | TASK-17, TASK-21 |
| AC-69 | Automated | `php artisan test --filter="AdvanceThreadReadActionTest|ThreadReadTest"` | TASK-17, TASK-21 |
| AC-70 | Automated | `php artisan test --filter="AdvanceThreadReadActionTest|ThreadReadTest"` | TASK-17, TASK-21 |
| AC-71 | Automated | `php artisan test --filter="AdvanceThreadReadActionTest|ThreadReadTest"` | TASK-17, TASK-21 |
| AC-72 | Automated | `php artisan test --filter=SeenReceiptsTest` | TASK-21 |
| AC-73 | Automated | `php artisan test --filter=ReadPositionTest` | TASK-21 |
| AC-74 | Automated | `php artisan test --filter=ChannelAuthTest` | TASK-23 |
| AC-75 | Automated | `php artisan test --filter="GeneralAccessActionTest|GeneralGuardTest"` | TASK-03, TASK-19, TASK-20 |
| AC-76 | Automated | `php artisan test --filter=ThreadParticipantsTest` | TASK-23 |
| AC-77 | Automated | `php artisan test --filter="FormatAttachmentsTest|SendMessageTest"` | TASK-18, TASK-22 |
| AC-78 | Automated | `php artisan test --filter="FormatAttachmentsTest|SendMessageTest"` | TASK-18, TASK-22 |
| AC-79 | Automated | `php artisan test --filter=ChannelRulesTest` | TASK-22 |
| AC-80 | Automated | `php artisan test --filter=ChannelRulesTest` | TASK-22 |
| AC-81 | Automated | `php artisan test --filter=ChannelRulesTest` | TASK-22 |
| AC-82 | Automated | `php artisan test --filter=ChannelRulesTest` | TASK-22 |
| AC-83 | Automated | `php artisan test --filter=ChannelRulesTest` | TASK-22 |
| AC-84 | Automated | `php artisan test --filter=ChannelRulesTest` | TASK-22 |
| AC-85 | Automated | `php artisan test --filter=ChannelRulesTest` | TASK-22 |
| AC-86 | Automated | `php artisan test --filter=ChannelRulesTest` | TASK-22 |
| AC-87 | Automated | `php artisan test --filter=SendMessageTest` | TASK-22 |
| AC-88 | Automated | `php artisan test --filter=SendMessageTest` | TASK-22 |
| AC-89 | Automated | `php artisan test --filter=PinAndEventsTest` | TASK-23 |
| AC-90 | Automated | `php artisan test --filter=PinAndEventsTest` | TASK-23 |
| AC-91 | Automated | `php artisan test --filter=PinAndEventsTest` | TASK-23 |
| AC-92 | Automated + Manual | `php artisan test --filter=SendMessageTest`; composer on device (blank send disabled) | TASK-06, TASK-22, TASK-25 |
| AC-93 | Automated + Manual | `php artisan test --filter=SendMessageTest`; MT-9 (4,001 characters disables Send) | TASK-06, TASK-22, TASK-25 |
| AC-94 | Automated | `php artisan test --filter=SendMessageTest` | TASK-07, TASK-22, TASK-24 |
| AC-95 | Manual | MT-1 | TASK-34 |
| AC-96 | Manual | MT-1 | TASK-34 |
| AC-97 | Manual | MT-1 | TASK-34 |
| AC-98 | Manual | MT-1 | TASK-34 |
| AC-99 | Manual | MT-2 | TASK-34 |
| AC-100 | Manual | MT-2 | TASK-34 |
| AC-101 | Manual | MT-2 | TASK-34 |
| AC-102 | Manual | MT-2 | TASK-34 |
| AC-103 | Manual | MT-3 | TASK-34 |
| AC-104 | Manual | MT-4 | TASK-28, TASK-34 |
| AC-105 | Manual | MT-5 | TASK-34 |
| AC-106 | Manual | MT-9 (inspect the subscribed channels and events; confirm no polling timer) | TASK-34 |
| AC-107 | Manual | MT-6 | TASK-26, TASK-34 |
| AC-108 | Manual | MT-7 | TASK-27, TASK-34 |
| AC-109 | Automated | `php artisan test --filter="SearchMessagesTest|SendMessageTest"` | TASK-08, TASK-20, TASK-22 |
| AC-110 | Automated | `php artisan test --filter=ReadPositionTest` | TASK-09, TASK-10, TASK-21 |

---

## 9. Commands for the User

| Order | Command / Action | When | Rollback |
| --- | --- | --- | --- |
| 1 | `composer remove laravel/scout meilisearch/meilisearch-php` | After TASK-11 | `composer require laravel/scout:^11.8 meilisearch/meilisearch-php:^1.17` |
| 2 | `SELECT conversation_id, account_id, COUNT(*) AS n FROM conversation_members GROUP BY conversation_id, account_id HAVING n > 1;` — must return 0 rows; resolve any rows by hand | Before running the migration of TASK-09 | N/A — read-only query |
| 3 | `php artisan migrate` (runs `2026_10_13_000001_add_unique_member_index_to_conversation_members_table.php`) | After TASK-09 and Order 2 | `php artisan migrate:rollback --path=database/migrations/alters/messages/2026_10_13_000001_add_unique_member_index_to_conversation_members_table.php` |
| 4 | Create a MySQL database `hrms_testing`; create `.env.testing` (not committed) with `APP_ENV=testing`, `DB_CONNECTION=mysql`, `DB_DATABASE=hrms_testing`, the usual host / user / password, `CACHE_STORE=array`; confirm `php artisan migrate --env=testing` completes on an empty database | Before TASK-20 – TASK-23 and TASK-32 | `DROP DATABASE hrms_testing;` and delete `.env.testing` |
| 5 | `php artisan test` | After TASK-31 – TASK-32 | N/A — read-only |
| 6 | No package installs, env keys or native rebuilds are needed for the mobile app (TASK-29 uses the built-in React Native `Animated`) | N/A | N/A — nothing to roll back |

---

## 10. Plan Change Log

> - **Spec Minor change** that affects the plan: edit the affected tasks in place, bump **Plan Revision**, add a row. **Based on Spec Version** is unchanged.
> - **Spec Major change**: bring the plan to the new version, set **Based on Spec Version** to it, bump **Plan Revision**, add a row.
> - **Plan-only correction** (wrong path, missing task, wrong order; the spec is right): edit in place, bump **Plan Revision**, add a row.
> - A task already ticked `[x]` is never edited or unticked. A change to finished work is a new task appended to its phase.

| Plan Revision | Date | Spec Version | Change | Changed Tasks |
| --- | --- | --- | --- | --- |
| 1 | 2026-10-13 | v4 | Created plan. Spec v3 held a product-level build order only (its §7); this plan refines it to file level for v4 and supersedes it for execution. | All |
