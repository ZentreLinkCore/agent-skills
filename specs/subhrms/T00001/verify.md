# Webkit Verification Report

## Metadata

| Field | Value |
| --- | --- |
| Ticket | T00001 (subhrms) |
| Branch | `T00001` — backend repo: base `origin/master`, 37 commits, 76 files changed (HEAD `5b57c0e8`); mobile repo `resources/views/mobapp` (`hrms-react-native`): base `origin/main`, 50 commits, 121 files changed (HEAD `db364cc`). Both analyzed without checkout; local and `origin/T00001` are identical in both. |
| Specification File | [specs.md](./specs.md) — version v4 (legacy header format), status not recorded in the file; Open Questions Q-1 – Q-7 (§10.3) are open and were not graded |
| Verification Date | 2026-10-13 |
| Verification Run | v1 — initial |

**Implementation Scope**

- **Frontend:** `resources/views/mobapp/src/module/employee/messages/` (components, pages, hooks, contexts, utils, services) and its routes under `src/app/(app)/messages/`; also 6 files of the web messaging module (`resources/views/web/src/module/employee/messages/`).
- **Backend:** `MessagesController`, `app/Queries/Messages/*`, `app/Handlers/Messages/*`, `app/Actions/Messages/*`, `app/Events/Messages/*`, `app/Models/{Conversation,Message,MessageAttachment,ChannelSection,ChannelSectionItem,CustomMention}.php`, `routes/api/employee.php`, `routes/channels.php`, `BroadcastAuthController`.
- **Database:** 9 alter migrations in `database/migrations/alters/messages/` (`is_edited` / `is_deleted`, `linked_ticket_data`, `is_thread_broadcast`, `is_system`, `system_event`, `is_pinned` / `pinned_at` / `pinned_by`, `requires_approval` + `channel_join_requests`, attachment `width` / `height`, emoji collation), plus `channel_sections` tables, `custom_mentions`, `is_admin`, `is_private`, `avatar`, `status` / `is_archived` migrations in `database/migrations/`.
- **Other:** `tests/Unit/SearchMessagesSyntaxTest.php`; `composer.json` (`laravel/scout`, `meilisearch/meilisearch-php`) and `config/scout.php`; unrelated changes on the same branch (login v2, branding, attendance, `php.ini`, `.htaccess`, `start.sh`, `.env.example`) — see Suggestion #1.

---

## 1. Verification Summary

### Overall Status

❌ FAILED

### Summary

The messaging feature is largely built and matches the specification in most flows (81 of 110 acceptance criteria met), but the branch has 4 release blockers: an uploaded `.php` file is executable under the shipped nginx config, the link preview fetches internal addresses, any employee can approve HR applications from a chat card, and merely viewing a public channel makes the viewer a member, which defeats join approval. 27 further findings are specification deviations (missing guards, send validation, replay dedupe, unique index, manager-channel gate, and mobile behaviors). The branch also carries web-messaging and unrelated changes outside this ticket.

---

## 2. Specification Compliance

| Specification Area | Status | Notes |
| --- | --- | --- |
| Scope | FAIL | §8 excludes web messaging; 6 web files changed (Finding #12). Unrelated changes ride on the branch (Suggestion #1). |
| User Flow | FAIL | Flows built: landing, New Chat, Create Channel, conversation, threads, search, seen avatars. Failure paths broken: channel-create failure (Finding #13), retry (Finding #24), thread attachments (Finding #25), announcement composer (Finding #26). |
| Technical Design | FAIL | 43 routes match §4.1 (`route:list`). Deviations: General members endpoint (Finding #11), replay `client_id` (Finding #10), unique index (Finding #8), manager gate (Finding #7). |
| Acceptance Criteria | FAIL | 81/110 met; 14 partial; 14 not met; 1 unverified. Not met: AC-6 (Finding #13), AC-10 (Finding #31), AC-17 (Finding #23), AC-22 (Finding #22), AC-61 (Finding #6), AC-75 (Finding #5), AC-92 – AC-93 (Findings #9, #21), AC-94 (Finding #10), AC-104 (Finding #15), AC-107 (Finding #13), AC-108 (Finding #14), AC-109 (Finding #7), AC-110 (Finding #8). Partial: AC-1, 7, 15, 21, 25, 27, 28, 30, 36, 95, 98, 99, 101, 105 (each in §3). Manual: AC-26 (§6). AC-67 and AC-73 are met as written but cause Finding #4 (§7). |
| Edge Cases | FAIL | Concurrent first reads (§6.4) can create duplicate member rows (Finding #8); retry and replay cases (Findings #24, #10). Cache-flush behavior (Decision 7) not exercised. |
| Security Requirements | FAIL | General guard missing on 4 endpoints (Finding #5); search leak (Finding #6); manager gate (Finding #7); plus Findings #1 – #4. |

---

## 3. Findings

### BLOCKER

#### Finding #1

- **Category:** BLOCKER
- **Location:** `app/Handlers/Messages/UploadAttachmentHandler.php:42,94,96`; `app/Http/Controllers/employee/MessagesController.php:1720`; `docker/nginx/default.conf.template:34`
- **Specification Reference:** N/A — release blocker (unrestricted file upload → remote code execution). Related: §10.3 Q-1 (limits and types are an open question, which does not cover executable content).
- **Problem:** Input: an authenticated employee sends `POST /api/employee/messages/upload` with `file=shell.php` (any content). State → outcome: the file is stored as `storage/app/public/messages/<uuid>.php` and the response returns `url = <app>/storage/messages/<uuid>.php`; requesting that URL runs the file.
- **Expected Behavior:** Spec §6.2 / Q-1: upload validation by size and type. Whatever limits Q-1 settles, an executable or active-content file must never be stored under a web-served path with a client-chosen extension.
- **Actual Behavior:** `$ext = strtolower($file->getClientOriginalExtension())` (`UploadAttachmentHandler.php:42`) becomes the stored extension (`:94`, `storeAs('messages', …, 'public')` at `:96`). The controller validates only `'file' => 'required|file|max:102400'` (`MessagesController.php:1720`): no `mimes`, no extension check. The repo's nginx template sends every `*.php` under the web root to php-fpm (`docker/nginx/default.conf.template:34` `location ~ \.php$`, `root /var/www/public`), and `public/storage` is the symlink to `storage/app/public`. Not executed here (no upload was sent); the production web-server config is outside the repo and must be checked.
- **Impact:** Remote code execution as the PHP user by any logged-in employee: the whole database, the `.env` secrets, and every file the PHP user can read. Also stored XSS through uploaded `.html` / `.svg` served from the app origin.
- **Required Action:** In `UploadAttachmentHandler::execute` take the extension from an allow-list keyed on the detected MIME (`$file->getMimeType()` / `guessExtension()`), never from `getClientOriginalExtension()`, and reject any other type with `422`; the allow-list is the one Q-1 settles (until then: images, `video/mp4`, `video/quicktime`, `audio/*`, `application/pdf`, office documents). Add `mimes:` / `mimetypes:` to the validation at `MessagesController.php:1720`. In `docker/nginx/default.conf.template` add `location ~* ^/storage/.*\.(php|phtml|phar)$ { deny all; }` before the `\.php$` block and serve `/storage/` with `X-Content-Type-Options: nosniff`.

#### Finding #2

- **Category:** BLOCKER
- **Location:** `app/Queries/Messages/GetLinkPreviewQuery.php:13,72`; route `GET /api/employee/messages/link-preview`
- **Specification Reference:** N/A — release blocker (server-side request forgery). The endpoint is listed as Baseline in §4.1.
- **Problem:** Input: `GET /api/employee/messages/link-preview?url=http://169.254.169.254/latest/meta-data/` or `http://127.0.0.1:<port>/…` or an internal hostname. State → outcome: the server issues the request and returns the page's `og:title` / `<title>` / description / image from it.
- **Expected Behavior:** A link preview fetches public web pages only.
- **Actual Behavior:** The only check is `filter_var($url, FILTER_VALIDATE_URL)` (`GetLinkPreviewQuery.php:13`), which accepts loopback, link-local and private addresses. The generic branch runs `Http::timeout(4)->get($url)` (`:72`) with default redirect following, and caches the result for 86,400 s per URL (`:17-19`). Not executed here.
- **Impact:** Any employee can probe the internal network and read metadata from services that are not exposed (cloud metadata endpoints, admin panels), and can use the server as a request relay.
- **Required Action:** In `GetLinkPreviewQuery::execute` accept only `http` / `https`; resolve the host (`gethostbynamel`) and reject loopback, private, link-local and reserved ranges (`filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)`); disable redirects (`Http::withOptions(['allow_redirects' => false])`) or re-validate every hop; cap the response size.

#### Finding #3

- **Category:** BLOCKER
- **Location:** `app/Http/Controllers/employee/MessagesController.php:1764-1860`
- **Specification Reference:** N/A — release blocker (missing authorization on a write to HR records). Related: §10.2 G-3, §10.3 Q-5.
- **Problem:** Input: `POST …/conversations/{c}/messages/{m}/ticket-status` with `{ "status": "Approved" }` by an employee who can see conversation `c`, where message `m` carries `linked_ticket_id = "LV-2026-001"` (or any numeric id). State → outcome: the matching leave / overtime / OB / change-shift / adjustment record gets `status = 1` and `date_approve = now()`.
- **Expected Behavior:** Only a person entitled to approve that application changes its status (rule pending Q-5); spec §13-style authorization per role.
- **Actual Behavior:** The only check is `Conversation::isVisibleTo` (`:1772-1774`). The record is then matched by `docnumber` **or** `id = <digits of the ticket id>` (`:1801-1815`) and written at `:1816-1850`; there is no approver, role or owner check anywhere in the method. An employee can post a message that links any ticket id, then approve it.
- **Impact:** Any employee can approve their own leave and overtime, or decline a colleague's, bypassing the approval workflow; payroll and timesheets follow those statuses.
- **Required Action:** Until Q-5 is answered, make the status write unavailable: in `updateTicketStatus` return `403 { success: false, message: "Only the approver of this application can change its status." }` unless the caller is in the application's current-tier approver list (the structure `AppLeave` etc. already carry in `approvers`), and match the application by exact `docnumber` only (remove the `orWhere('id', $numericId)` branches). Specify the rule with `/webkit-specify` (Q-5).

#### Finding #4

- **Category:** BLOCKER
- **Location:** `app/Http/Controllers/employee/MessagesController.php:421-427` and `:2610-2616`; `app/Models/Conversation.php:66-81`; `app/Handlers/Messages/SendMessageHandler.php:60-69`; `resources/views/mobapp/src/module/employee/messages/hooks/useChatRoom.ts:638-651`
- **Specification Reference:** §2.5 AC-84 (approval), AC-87 (must join), AC-86; conflicts with AC-67 and AC-73 as written (see §7).
- **Problem:** Input: employee X, not a member of public channel C with `requires_approval = 1`, opens C in the app (the "You are previewing this channel" state) or taps `Mark All as Read`. State → outcome: a `conversation_members` row is inserted for X; X can now post in C without a join request and without admin approval.
- **Expected Behavior:** AC-84: X stays without a member row until an admin approves the pending request. AC-87: a non-member cannot post.
- **Actual Behavior:** `markConversationAsRead` inserts the row for any non-member of a public channel, announcement or system channel (`:421-427`, the `else` branch of `if ($isMember)`; the app calls it for every viewed channel — `useChatRoom.ts:638-651` has no membership check). `markAllAsRead` does the same for every conversation in `Conversation::visibleTo($user)` (`:2610-2616`), and `visibleTo` includes every public channel and announcement (`Conversation.php:66-81`). The posting rule reads membership from that same table (`SendMessageHandler.php:60-69`) and never looks at `requires_approval`. The same call also inserts a General row for an inactive account (`markAllAsRead` has no `GeneralAccessAction` check).
- **Impact:** An approval-required channel is open to every employee who looks at it; admins' member lists and seen-avatar lists fill with people who never joined; `isMember` is true for them, so the CTA that asks for access disappears.
- **Required Action:** In `markConversationAsRead` insert a membership row only when `$conversation->is_system`; for any other non-member return `{ success: true, last_read_id: 0, remaining_unread: 0 }` without writing (the private-channel branch at `:380-387` already does this). In `markAllAsRead` iterate only conversations where the caller already has a `conversation_members` row, plus `is_system` conversations when `(int) $user->status === 1`. Then resolve the contradiction in the spec (§7) so AC-67 and AC-73 say the same.

### REQUIRED FIX

#### Finding #5

- **Category:** REQUIRED FIX
- **Location:** `app/Http/Controllers/employee/MessagesController.php:167` (`getMessage`), `:675` (`markThreadAsRead`), `:737` (`getMessageSeenReceipts`), `:1764` (`updateTicketStatus`)
- **Specification Reference:** §4.3 rule, §2.5 AC-75; AC-34, AC-39 – AC-41 by extension
- **Problem:** Input: an account with `accounts.status = 0` calls `POST …/messages/{rootId}/read` or `GET …/messages/{id}/seen` on General (or `GET /message-detail/{id}` for a General message).
- **Expected:** `403 { success: false, message: "Your account is inactive. Please contact HR to restore access.", code: "ACCOUNT_INACTIVE" }`.
- **Actual:** These four methods check `Conversation::isVisibleTo` only; `grep -n "checkSystemChannelAccess(" app/Http/Controllers/employee/MessagesController.php` lists calls at lines 108, 219, 371, 518, 554, 635, 1560, 1595, 1618, 1641, 1667 and none in these methods. General is a public channel, so an inactive caller passes: the seen list reveals readers, `message-detail` returns the message text, and the thread-read call writes a position and broadcasts `MessagesRead`.
- **Required Action:** Add `if ($denied = $this->checkSystemChannelAccess($conversationId)) return $denied;` after the unauthenticated check in `markThreadAsRead`, `getMessageSeenReceipts` and `updateTicketStatus`, and in `getMessage` after `$message` is loaded with `$message->conversation_id`.

#### Finding #6

- **Category:** REQUIRED FIX
- **Location:** `app/Queries/Messages/SearchMessagesQuery.php:431-446`
- **Specification Reference:** §4.3 rule, §2.5 AC-61
- **Problem:** Input: caller with `accounts.status = 0`, `GET /search?q=holiday` (no scope), General holds a message containing "holiday".
- **Expected:** General's messages are not returned.
- **Actual:** `$systemConvIds` (the `is_system` / `General` / `announcement` query, `:431-444`) is merged into `$allowedConvIds` (`:446`) with no status check; only a *scoped* search checks `(int) $user->status === 1` (`:194`).
- **Required Action:** Build `$systemConvIds` only when `(int) $user->status === 1`; for an inactive caller drop every `is_system` or `General` conversation from `$allowedConvIds`.

#### Finding #7

- **Category:** REQUIRED FIX
- **Location:** `app/Models/Conversation.php:66-81`; gate present only at `app/Queries/Messages/GetConversationsQuery.php:131` and `app/Http/Controllers/employee/MessagesController.php:308`
- **Specification Reference:** §6.1 rule 1, §2.5 AC-109
- **Problem:** Input: caller with `role_access = 3`; channel M with `conversations.role = 'manager'`. `GET /conversations/{M}/messages`, `POST /conversations/{M}/messages`, `GET /search?q=#<M name> hello`, and a `private-conversation.{M}` subscription.
- **Expected:** The list excludes M; `getMessages` returns `data: []`; `sendMessage` returns `404 Conversation not found`; search returns the empty result; the subscription is refused.
- **Actual:** `scopeVisibleTo` (`Conversation.php:66-81`) has no role condition, and `grep -rn "'manager'" app/` finds the gate only at the two sites above. A non-manager who knows the id reads and posts in M; search and `routes/channels.php:28` (`isVisibleTo`) accept it too.
- **Required Action:** In `Conversation::scopeVisibleTo` add, for callers whose `role_access` is not in `[1, 2, 7]`, `->where(fn ($q) => $q->whereNull('role')->orWhere('role', '!=', 'manager'))`; in `SearchMessagesQuery` require `Conversation::isVisibleTo($targetChannel->id, $user)` for a scoped channel and intersect the unscoped `$allowedConvIds` with `Conversation::visibleTo($user)->pluck('id')`.

#### Finding #8

- **Category:** REQUIRED FIX
- **Location:** `app/Http/Controllers/employee/MessagesController.php:423`, `:2613` (`updateOrInsert`), `:1123`, `:1266`, `:2321` (`insert`); no migration
- **Specification Reference:** §2.5 AC-110, §6.4 edge case, §3.1
- **Problem:** Input: two `POST /conversations/{C}/read` calls for an account with no row, sent together (a second device or a reconnect).
- **Expected:** Exactly one row for (C, account); neither call returns 5xx.
- **Actual:** `grep -rn "unique" database/migrations/table/messages database/migrations/2026_07_07* database/migrations/2026_09_11*` finds no unique index on `conversation_members`. `updateOrInsert` is a select followed by an insert, so both calls insert; the rows then double-count in `readReceiptsFor` and the member list. `joinChannel`, `approveJoinRequest` and `addConversationMembers` check `exists()` and then `insert()` the same way.
- **Required Action:** Create `database/migrations/alters/messages/2026_10_13_000001_add_unique_member_index_to_conversation_members_table.php` adding `unique(['conversation_id', 'account_id'], 'uq_conversation_members_conv_account')` (abort with a message when duplicates exist, never delete rows). In the controller route the five write sites through two private helpers that catch only MySQL duplicate-key error 1062 (`QueryException::$errorInfo[1]`) and then update instead.

#### Finding #9

- **Category:** REQUIRED FIX
- **Location:** `app/Handlers/Messages/SendMessageHandler.php:36-72`
- **Specification Reference:** §2.5 AC-92, AC-93; §6.2 Input validation boundaries
- **Problem:** Input: `POST /conversations/{id}/messages` with `{ "text": "   " }` and no attachments; and with a 4,001-character `text`.
- **Expected:** `422 { success: false, message: "A message needs text or an attachment." }`; `422 { success: false, message: "A message cannot exceed 4000 characters." }`.
- **Actual:** `$text = $params['text'] ?? ''` (`:20`) goes straight to `Message::create` (`:72` onward); `grep -n "mb_strlen\|trim(\$text" app/Handlers/Messages/SendMessageHandler.php` finds nothing. Both requests create a row and broadcast it.
- **Required Action:** After the join check (`:68`) and before `DB::transaction` throw `new \Exception('A message needs text or an attachment.', 422)` when `trim((string) $text) === ''` and `$attachments` is empty, and `new \Exception('A message cannot exceed 4000 characters.', 422)` when `mb_strlen((string) $text) > 4000`.

#### Finding #10

- **Category:** REQUIRED FIX
- **Location:** `app/Handlers/Messages/SendMessageHandler.php` (no handling); `resources/views/mobapp/src/module/employee/messages/services/messages.api.ts:199-222` (no `client_id` in the body)
- **Specification Reference:** §2.5 AC-94; §6.2 Idempotency
- **Problem:** Input: the same send is submitted twice within 1 second (retry after a lost response, double tap), with `client_id: "c1"`.
- **Expected:** Both return `200` with the same `data.id`; one row; one `MessageSent` broadcast.
- **Actual:** `grep -rni "client_id\|clientId\|dedupe\|idempotency" app/` finds nothing; the app builds a `clientId` for its optimistic item (`useChatRoom.ts:1088`) but never sends it (`messages.api.ts:208-220`). Each request creates a new message.
- **Required Action:** In `MessagesController::sendMessage` pass `'client_id' => $request->input('client_id')`; in the handler take the lock `Cache::lock("lock_send_replay_{$conversationId}_{$user->id}_" . md5($clientId), 5)`, return the existing message when `Cache::get("send_replay_…")` holds an id, and `Cache::put(…, $message->id, 2)` after creating. In `messages.api.ts` add `clientId?: string` as the eighth parameter of `sendMessage`, send it as `client_id`, and pass it from `useChatRoom.ts:1234`.

#### Finding #11

- **Category:** REQUIRED FIX
- **Location:** `app/Http/Controllers/employee/MessagesController.php:1908-1990`; `resources/views/mobapp/src/module/employee/messages/components/ManageChannelModal.tsx:1470-1475`
- **Specification Reference:** §4.3 / §4.1 (`GET /conversations/{id}/members`), §6.3 table row, §9 Definition of Done (placeholder bullet); Decision 5; AC-36
- **Problem:** Input: any member calls `GET /conversations/{General}/members`.
- **Expected:** `{ success: true, is_system: true, member_count: N, members: [], message: "General is a company-wide channel. All active employees have access." }` — "not a real member list".
- **Actual:** For `is_system` the controller returns `data.members` filled with active accounts (name, avatar, job title, department), paged by `page` / `limit` (default 30, max 100) and searchable by `search` (`:1908-1990`); introduced by `e8b697f3` on 2026-10-03, after the v3 decision. Because `members` is not empty, `ManageChannelModal` never shows the sentence of AC-36 at `:1474` (it is rendered only when `members.length === 0`); the user sees the longer info card at `:1710` instead, and the header drawer shows the API description or "N members collaborating in this channel." (`GroupDetailsDrawer.tsx:956-961`).
- **Required Action:** Return `members: []` with `member_count` for `is_system` conversations and remove the paged-list branch, which makes both mobile surfaces show the AC-36 sentence. If the product owner wants a browsable General directory, that is a requirement change (§7 Case 2) and goes through `/webkit-specify`; verification does not decide it.

#### Finding #12

- **Category:** REQUIRED FIX
- **Location:** `resources/views/web/src/module/employee/messages/` — `components/MessagesChatArea.vue`, `composables/useMessages.ts`, `pages/Messages.vue`, `api/messages.api.ts`, `types/types.messages.ts`, `utils/messages.utils.ts` (6 files, +578 / −122; commits `222d1341`, `8b9dba89`, `7a9232c6`, `466bc4fb`, `341099af`)
- **Specification Reference:** §8 Out of Scope — "Web Browser Messaging Redesign: Excluded from this MVP"; §1 Scope
- **Problem:** The diff against `origin/master` adds infinite-scroll history loading, message edit and delete calls, system-event rendering and optimistic-state fields to the web chat.
- **Expected:** No web messaging change on this ticket.
- **Actual:** `git diff origin/master...origin/T00001 --stat -- resources/views/web/src/module/employee/messages` lists the six files above. The changes are web features, not API-compatibility edits.
- **Required Action:** Move the web commits to their own ticket and branch (or revert them from `T00001`), so this ticket merges only what its spec covers. If the web work was intended here, it needs a spec (`/webkit-specify`) before merge.

#### Finding #13

- **Category:** REQUIRED FIX
- **Location:** `resources/views/mobapp/src/module/employee/messages/components/CreateChannelModal.tsx:383-445` and `:315`
- **Specification Reference:** §2.5 AC-6, AC-107; §6.1 rule 9 (no fabricated data)
- **Problem:** Input: submit `CreateChannelModal` with the device offline, with a non-2xx answer, or with a `200` that has no `id`.
- **Expected:** An error is shown; no channel is added to the list; no section assignment is stored (AC-107).
- **Actual:** The `catch` block is "Fallback local creation": `fallbackId = Date.now()` (`:387`), `routeChannelToSection(fallbackId, …)` (`:388`), `addOrUpdateConversation(fallbackConv)` (`:426`), then `router.push` into it (`:430-440`). The file has no `Alert` and no error state. The success path also fakes an id: `result?.id || Date.now()` (`:315`).
- **Required Action:** Delete the fallback branch; show `Alert.alert('Could not create channel', error?.message || 'Please try again.')` (add `Alert` to the `react-native` import, as `ManageChannelModal.tsx` does) and return with the modal open; treat a response without an `id` as a failure instead of using `Date.now()`.

#### Finding #14

- **Category:** REQUIRED FIX
- **Location:** `resources/views/mobapp/src/module/employee/messages/pages/ConversationScreen.tsx:588`, `:2627`, `:2875`; `resources/views/mobapp/src/module/employee/messages/components/ChatToolsDrawer.tsx:72`, `:157`
- **Specification Reference:** §2.5 AC-108; §6.1 rule 9
- **Problem:** Input: a user whose dashboard `recent_applications` is empty or still loading opens the attachment drawer's tickets tab; or opens a thread (the thread composer passes no `tickets`).
- **Expected:** An empty list with an empty state; no demo ticket is listed or sendable.
- **Actual:** `return DEFAULT_HR_TICKETS;` (`ConversationScreen.tsx:588`) makes `pendingUserTickets` five demo tickets (`CS-2026-011`, `AA-2026-042`, `OT-2026-019`, `LV-2026-084`, one more, all `Pending`); `ChatToolsDrawer` defaults `tickets = DEFAULT_HR_TICKETS` (`:157`); the constant also enriches incoming linked tickets by id (`ConversationScreen.tsx:2627`, `:2875`). A selected demo ticket is sent.
- **Required Action:** Delete `DEFAULT_HR_TICKETS` (`ChatToolsDrawer.tsx:72`); return `[]` at `ConversationScreen.tsx:588`; default `tickets = []` at `ChatToolsDrawer.tsx:157`; look tickets up in `userTickets` only at `:2627` and `:2875`; show `No recent applications` when the list is empty.

#### Finding #15

- **Category:** REQUIRED FIX
- **Location:** `resources/views/mobapp/src/module/employee/messages/components/MessageThreadPreview.tsx:141-147`
- **Specification Reference:** §2.5 AC-104
- **Problem:** Input: a root message with 6 distinct repliers; with 13.
- **Expected:** 4 avatars plus a badge of the repliers not shown: `2+`; for 13: `9+`.
- **Actual:** `hasOverflow = participants.length > 5`, `slice(0, 4)` when overflowing, `overflowCount = participants.length - 5` (`:146`): 6 repliers show `1+` (2 are hidden); 13 repliers show `8+`; `9+` first appears at 14.
- **Required Action:** Change `overflowCount` to `hasOverflow ? participants.length - 4 : 0`.

#### Finding #16

- **Category:** REQUIRED FIX
- **Location:** `resources/views/mobapp/src/module/employee/messages/components/MessageRow.tsx:622` and `:498-510`; `resources/views/mobapp/src/module/employee/messages/components/ThreadModal.tsx:612-614`
- **Specification Reference:** §2.5 AC-105
- **Problem:** Input: tick "Also send to #channel" in a thread and send; look at the channel feed. Input 2: the same in a group conversation.
- **Expected:** In the channel the row shows `Also sent to the <channel>` with a `View thread` link; the checkbox label names the destination.
- **Actual:** The `Also sent to…` badge renders only when `isInThreadView && isThreadBroadcast` (`MessageRow.tsx:622`). In the feed the broadcast shows a `Reply in thread:` quote row (`:498-510`); the text `View thread` exists only in comments (`MessageRow.tsx:84`, `ConversationScreen.tsx:124`). A group conversation's checkbox reads `Also send as a direct message` because only `channel` / `announcement` count as a channel (`ThreadModal.tsx:612-614`).
- **Required Action:** Render `broadcastBadgeText` (`MessageRow.tsx:371-385`) plus a tappable `View thread` (calling `onReplyInThread`) on broadcast rows in the feed; in `ThreadModal.tsx` label group conversations `Also send to <name>`.

#### Finding #17

- **Category:** REQUIRED FIX
- **Location:** `resources/views/mobapp/src/module/employee/messages/components/MessageRow.tsx:810-813`; `app/Queries/Messages/GetMessagesQuery.php:533-535`; `resources/views/mobapp/src/module/employee/messages/utils/readReceipts.ts:75-90`
- **Specification Reference:** §2.5 AC-12 (sender identity on every message), AC-99
- **Problem:** Input: an employee posts `I left early` (no `#`). Input 2: a reader's newest read message is that one.
- **Expected:** A normal message row with avatar, name and mention colours; the reader's seen avatar sits on it.
- **Actual:** `MessageRow` sets `isSystemMsg` when the text matches an unanchored `/(created|…|left|…|joined|…)\s+/i` (`:810-813`), so the row is drawn as a `SystemEventRow` without avatar or name. `placeSeenReaders` skips only rows flagged by the server (`isSystemEvent` / `system_event`, which has its own text fallback requiring `\s+#` at `GetMessagesQuery.php:533-535`), so it still targets the row, `MessageRow` draws no receipt there, and the reader's avatar disappears instead of falling back to the previous message.
- **Required Action:** In `MessageRow.tsx` decide `isSystemMsg` from `message.isSystemEvent || message.system_event` only (delete the text regex); in `GetMessagesQuery::formatMessage` set `isSystemEvent` from `!empty($msg->system_event)` only.

#### Finding #18

- **Category:** REQUIRED FIX
- **Location:** `resources/views/mobapp/src/module/employee/messages/components/MessageSeenReceipt.tsx:62-76`; `resources/views/mobapp/src/module/employee/messages/hooks/useChatRoom.ts:812-817`
- **Specification Reference:** §2.5 AC-101
- **Problem:** Input: tap the seen avatars under a message read by two people, or by a person whose position came from their own sent message.
- **Expected:** `Seen by <first name> • <seen_time>`.
- **Actual:** `detailLabel` adds the time only when `count === 1`; with two or more it reads `Seen by A, B +N` with no time (`:62-76`); a position inferred from a sent message carries no `seen_time` (`useChatRoom.ts:812-817`), so even one reader shows `Seen by Name`.
- **Required Action:** Format `Seen by <first of the most recent reader> • <their seen_time>` for any count, and set `seen_time` on the bumped position from the message's `time`.

#### Finding #19

- **Category:** REQUIRED FIX
- **Location:** `resources/views/mobapp/src/module/employee/messages/components/MessagesSearchModal.tsx:1207`, `:2375-2395`, `:1759`, `:1813-1815`
- **Specification Reference:** §2.5 AC-95, AC-98
- **Problem:** Input: scroll to the end of a long result list; and search for text that matches no message with no filter set.
- **Expected:** Page 2 loads when the user scrolls to the end; `No messages containing "<q>" match your active filters.` is shown when no message matches.
- **Actual:** The results `ScrollView` has no `onEndReached` / `onScroll`; the user must tap `Load more messages` (`:2375-2395`). The sentence renders only when `mode !== 'direct' && hasAnyActiveFilter && messageResults.length === 0` (`:1759`); with no filter the user sees `No matching results` (`:1846-1885`), and with matching users or channels but no message there is no message empty text.
- **Required Action:** Call `handleLoadMore` from the `ScrollView` `onScroll` when within one screen of the end; show the AC-98 sentence whenever the query is non-empty and `messageResults` is empty.

#### Finding #20

- **Category:** REQUIRED FIX
- **Location:** `resources/views/mobapp/src/module/employee/messages/hooks/useChatRoom.ts:760-768`; `resources/views/mobapp/src/app/axios/axiosApiErrors.ts:13-19`
- **Specification Reference:** §2.5 AC-35 (banner for an inactive account)
- **Problem:** Input: an active employee's messages request is answered `403` for any reason (middleware, proxy, a future permission rule).
- **Expected:** The activation banner appears only for `code: "ACCOUNT_INACTIVE"`.
- **Actual:** `accessError = (status === 403 || code === 'ACCOUNT_INACTIVE') ? { code: code || 'ACCOUNT_INACTIVE', … }` (`:763-765`). `ApiError` has no `code` field, so `code` is always undefined and every 403 becomes `ACCOUNT_INACTIVE`.
- **Required Action:** Read the server code from `err.original?.response?.data?.code` and set `accessError` only when it equals `ACCOUNT_INACTIVE`.

#### Finding #21

- **Category:** REQUIRED FIX
- **Location:** `resources/views/mobapp/src/module/employee/messages/components/MessageInputBar.tsx:2231`, `:815-909`
- **Specification Reference:** §2.5 AC-93 (composer disables Send above 4,000), AC-30 (paste keeps text intact)
- **Problem:** Input: paste 3,000 characters of multi-line text containing `Ticket #4521`; type 4,001 characters across two blocks.
- **Expected:** The paste is preserved; Send is disabled above 4,000 serialized characters.
- **Actual:** `maxLength={isCode ? undefined : 2000}` silently truncates a longer paste per block; no total check exists, so 4,001 characters can be sent (and the server accepts them — Finding #9). A pasted fragment of 3 or more characters containing `#word` is converted to a channel chip even when no channel matches, moving the caret to the end (`:815-909`).
- **Required Action:** Compute `serializedLength = serializeBlocksToMarkdown(blocks).trim().length`; disable Send above 4,000 and show `Message is too long (max 4000 characters).`; do not truncate pastes; convert `#word` only when it matches a known channel.

#### Finding #22

- **Category:** REQUIRED FIX
- **Location:** `resources/views/mobapp/src/module/employee/messages/hooks/useAudioRecorder.ts:10`, `:153-163`
- **Specification Reference:** §2.5 AC-22
- **Problem:** Input: start a recording, tap the Trash button.
- **Expected:** Recording stops and the scratch audio file is purged.
- **Actual:** `FileSystem.deleteAsync` is imported from `expo-file-system`; in SDK 57 that export throws (`node_modules/expo-file-system/src/legacyWarnings.ts:62-64`, "This method will throw in runtime") and the empty `catch {}` at `:161` hides it. The `.m4a` stays. Recordings under 300 ms are dropped with the file also left (`ConversationScreen.tsx:1740`).
- **Required Action:** Import `deleteAsync` from `expo-file-system/legacy` (as `utils/mediaSave.ts:2` does) or use `new File(uri).delete()`, and call it in the short-recording path too.

#### Finding #23

- **Category:** REQUIRED FIX
- **Location:** `resources/views/mobapp/src/module/employee/messages/pages/ConversationScreen.tsx:439`, `:1779-1797`, `:3691`; `resources/views/mobapp/src/module/employee/messages/components/ChatInputBar.tsx:121`, `:352-359`
- **Specification Reference:** §2.5 AC-17
- **Problem:** Input: type `hello` with the cursor at the end, open the emoji panel, pick 😀.
- **Expected:** The symbol is inserted at the cursor: `hello😀`.
- **Actual:** `handleSelectEmoji` splices at `inputSelectionRef.current`, initialised to `{ start: 0, end: 0 }` (`:439`) and written only by `handleSelectionChange` (`:1779`). `ChatInputBar` declares `onSelectionChange` (`:121`) but never forwards it, so the ref stays `{0, 0}` and the result is `😀hello`; panel Backspace is inert at `{0, 0}` (`:1802`). Traced statically; not run on a device. The thread composer omits `onSelectEmoji` and uses `insertText`, which is correct.
- **Required Action:** Forward `onSelectionChange` from `ChatInputBar` to `MessageInputBar`'s `TextInput` so `inputSelectionRef` tracks the caret, or drop `onSelectEmoji` in `ConversationScreen` so the drawer uses `insertText` as `ThreadModal` does.

#### Finding #24

- **Category:** REQUIRED FIX
- **Location:** `resources/views/mobapp/src/module/employee/messages/hooks/useChatRoom.ts:1110`, `:373-392`, `:1505-1510`; `resources/views/mobapp/src/module/employee/messages/components/MessageHeader.tsx:222-223`; `resources/views/mobapp/src/module/employee/messages/components/MessageRow.tsx:606`
- **Specification Reference:** §2.5 AC-28
- **Problem:** Input: two sends fail while offline; long-press the second failed message and choose `Retry Sending`. Input 2: a failed message sent within 5 minutes of the previous one.
- **Expected:** An inline failure indicator on the failed message; the retry resends that message and keeps the draft.
- **Actual:** Every optimistic item has `id: 0` (`useChatRoom.ts:1110`). `retryMessage` dispatches `delete_message` with that id (`:1508`) and the reducer removes `state.pending` items whose `id === action.messageId` (`:373-392`), so all unsent items disappear; the action sheet finds its message by `id === 0`, so it opens the first failed one. `AlertCircle` renders only in `MessageHeader` (`:222-223`), which `MessageRow` hides for grouped rows (`:606`).
- **Required Action:** Match optimistic items by `clientId` in `delete_message`, `retryMessage` and the action sheet; render the failure icon on every row with `failed: true`, not only group starts.

#### Finding #25

- **Category:** REQUIRED FIX
- **Location:** `resources/views/mobapp/src/module/employee/messages/components/ThreadModal.tsx:423-446`, `:1048-1049`
- **Specification Reference:** §2.5 AC-25
- **Problem:** Input: in a thread, open the attachment drawer and pick a photo or document.
- **Expected:** A compact attachment preview chip with a remove (`X`) button above the input; the file is sent with the reply.
- **Actual:** `handleAddAttachment` only inserts text such as `[Photo: camera.jpg] ` or `[Document: x.pdf] ` (`:432-446`); `onSend` ignores its attachments argument (`(text, _atts, …)`, `:1049`), no `attachments` or `onRemoveAttachment` is passed to `ChatInputBar`, so no chip or `X` exists and nothing is uploaded. (The main composer meets AC-25.)
- **Required Action:** Reuse the main composer's attachment state: hold picked assets as attachments, pass `attachments` / `onRemoveAttachment` to `ChatInputBar`, and send them with the reply through `useChatRoom.sendMessage`.

#### Finding #26

- **Category:** REQUIRED FIX
- **Location:** `resources/views/mobapp/src/module/employee/messages/pages/ConversationScreen.tsx:3552-3572`, `:1840-1860`
- **Specification Reference:** §2.5 AC-27, AC-88
- **Problem:** Input: a `role_access` 3 employee opens Company Announcements and picks a GIF.
- **Expected:** The composer is replaced by the broadcast-only notice; nothing can be sent.
- **Actual:** The notice is a banner above a still-mounted composer (`:3569`); the +, Aa, GIF, emoji and `@` buttons have no disabled guard and `handleSelectGif` calls `sendMessage` directly (`:1840-1860`), so the server answers `403 Permission denied. Company Announcements is broadcast-only.` and a failed bubble appears.
- **Required Action:** Do not render the composer and drawer when the caller may not post (the `[1, 2, 4, 7]` check at `:1050-1055`), or guard `handleSelectGif` and each drawer action with it.

#### Finding #27

- **Category:** REQUIRED FIX
- **Location:** `resources/views/mobapp/src/app/(app)/messages/index.tsx:86-103`; `resources/views/mobapp/src/module/employee/messages/pages/MessagesScreen.tsx:996`; `resources/views/mobapp/src/app/(app)/(tabs)/messages.tsx:15`; `resources/views/mobapp/src/module/employee/messages/contexts/MessagesContext.tsx:380`
- **Specification Reference:** §2.5 AC-1; §6.1 rule 9
- **Problem:** Input: open Messages.
- **Expected:** Header shows `Chats`, the online count, the unread badge, a search button and a `⋮ More` button.
- **Actual:** The live route mounts `AppTopHeader` (title, `N new`, `N colleagues active`, back — no search, no ⋮) with `MessagesScreen isDedicatedFlow={false}`; `DedicatedMessagesHeader` (search and ⋮) renders only when `isDedicatedFlow` (`MessagesScreen.tsx:996`), which only the tab route sets and that route redirects at once (`(tabs)/messages.tsx:15`). Search and More exist only in the bottom bar. When nobody is online the count shows `5` (`MessagesContext.tsx:380`: `… .length || 5`).
- **Required Action:** Add search and `⋮ More` buttons to the header the live route uses; remove `|| 5` and show the real count (including 0).

#### Finding #28

- **Category:** REQUIRED FIX
- **Location:** `resources/views/mobapp/src/module/employee/messages/pages/MessagesScreen.tsx:856-858`, `:1456-1472`; `resources/views/mobapp/src/module/employee/messages/pages/MessageRequestsScreen.tsx:41-48`, `:86-136`
- **Specification Reference:** §2.5 AC-7 (persistence is open question Q-7)
- **Problem:** Input: tap the `Requests` chip; on More → Message Requests tap `Decline`.
- **Expected:** Requests show avatar, name, preview, time and Accept / Decline.
- **Actual:** The chip renders ordinary `ConversationListItem`s with no actions; Accept / Decline exist only on `MessageRequestsScreen`, act on local state, and Decline sets `is_archived` while the list reads `allConversations` without filtering archived, so the row stays. The backend never emits a request, so the list is empty in practice (§10.2 G-4).
- **Required Action:** Render Accept / Decline on the chip's rows and filter archived rows out; persistence follows the answer to Q-7.

#### Finding #29

- **Category:** REQUIRED FIX
- **Location:** `resources/views/mobapp/src/module/employee/messages/utils/mentionParser.ts:592-617`; `resources/views/mobapp/src/module/employee/messages/components/MessageContent.tsx:91-96`
- **Specification Reference:** §2.5 AC-14, AC-15
- **Problem:** Input: viewer "Maria Santos"; a message `@Maria` addressed to a different Maria.
- **Expected:** Blue (`#0284C7` / `#38BDF8`) for another colleague; gold only for the viewer.
- **Actual:** The self-name fallback runs even when the server says `is_targeted: false`: `'maria santos'.includes('maria')` is true, so the mention renders gold.
- **Required Action:** Use the server `is_targeted` / `user_ids` when present and apply the name fallback only to mentions that carry neither.

#### Finding #30

- **Category:** REQUIRED FIX
- **Location:** `resources/views/mobapp/src/module/employee/messages/components/MessageInputBar.tsx:2029-2035`
- **Specification Reference:** §2.5 AC-21
- **Problem:** Input: tap the microphone.
- **Expected:** A pulsing red record dot.
- **Actual:** The dot is a static 8 × 8 `Box` (`:2031`); no `Animated` loop exists in the file.
- **Required Action:** Wrap it in an `Animated.View` whose opacity loops 1 → 0.3 → 1 while `isRecording` is true.

#### Finding #31

- **Category:** REQUIRED FIX
- **Location:** `resources/views/mobapp/src/module/employee/messages/components/ConversationListItem.tsx:228-233`
- **Specification Reference:** §2.5 AC-10
- **Problem:** Input: a channel with no messages in the list.
- **Expected:** `No messages yet` in muted font.
- **Actual:** The string is correct (`messagePreview.ts:91`) but is drawn with `textSecondary` (`text` at weight 600 when unread), never `textMuted` (`#45583D` vs `#686B62` in the light theme, `src/theme/index.ts:19-20`).
- **Required Action:** Use `color="textMuted"` for the empty-state preview.

### IMPROVEMENTS

#### Improvement #1

- **Area:** Backend / mark-all-read
- **Current Situation:** `markAllAsRead` runs `max(id)`, `updateOrInsert` and a cache write per visible conversation (`app/Http/Controllers/employee/MessagesController.php:2600-2641`).
- **Suggestion:** Fetch the maxima in one grouped query and update members in one statement (after Finding #4 narrows the set).
- **Reason:** It is three queries per conversation, and General plus every public channel are visible.

#### Improvement #2

- **Area:** Backend / search
- **Current Situation:** Each own-message result in a direct conversation runs a join query for the other person's name (`app/Queries/Messages/SearchMessagesQuery.php:538-551`), up to 100 queries per page.
- **Suggestion:** Load the other member's name for all result conversations in one query before the loop.
- **Reason:** N+1 on a page capped at 100 rows.

#### Improvement #3

- **Area:** Tests
- **Current Situation:** `SearchMessagesSyntaxTest` re-implements the parser inside the test (`tests/Unit/SearchMessagesSyntaxTest.php:12-77`) and never calls `SearchMessagesQuery`, so its 10 passing tests do not detect a parser change; no other messaging test exists.
- **Suggestion:** Extract the parser into a pure static method and test that; add feature tests for the read-state, guard and send rules (spec §11.1).
- **Reason:** A green suite currently proves nothing about the code under review.

#### Improvement #4

- **Area:** Mobile / lint
- **Current Situation:** `npx eslint src/module/employee/messages` reports 150 errors and 83 warnings, almost all `Error: Cannot access refs during render` (`components/ChatStreamSkeleton.tsx:18`, 94 of them, and `:69`).
- **Suggestion:** Move the ref reads out of render in `ChatStreamSkeleton` and fix the remaining compiler-rule errors.
- **Reason:** The module cannot pass its own lint script.

#### Improvement #5

- **Area:** Dependencies
- **Current Situation:** `laravel/scout` and `meilisearch/meilisearch-php` are declared (`composer.json:16,20`) with `config/scout.php`, but search does not use them and `vendor/laravel/scout` is not installed (spec Decision 6).
- **Suggestion:** `composer remove laravel/scout meilisearch/meilisearch-php` and delete `config/scout.php`.
- **Reason:** Dead dependencies and a config for an engine that is not deployed.

#### Improvement #6

- **Area:** Mobile / default-channel detection
- **Current Situation:** `isDefaultChannel` is a heuristic: name `general` / `announcements` or `conversationId <= 6` (`resources/views/mobapp/src/module/employee/messages/components/GroupDetailsDrawer.tsx:130-136`; `ManageChannelModal.tsx:122-127` matches the name too).
- **Suggestion:** Use the `is_system` / `isDefault` flag the API already returns.
- **Reason:** A user-created channel named "General" loses Add / Remove / Leave (AC-37).

#### Improvement #7

- **Area:** Mobile / search paging
- **Current Situation:** The debounce effect resets `page` to 1 on every change even when the trimmed values are unchanged, `handleLoadMore` has no cancel guard, and `searchMessages` swallows errors into an empty result (`MessagesSearchModal.tsx:509-518`, `:594-632`; `services/messages.api.ts:585-598`).
- **Suggestion:** Compare the normalised query / filters before resetting; ignore responses for superseded requests; surface a failed search.
- **Reason:** A late page of an old query can append to a new query's results; a network failure reads as "no results".

#### Improvement #8

- **Area:** Mobile / thread composer
- **Current Situation:** `onSendVoiceReply` is never passed to `ThreadModal` (`pages/ConversationScreen.tsx:3736-3790`), so `handleVoiceReply` returns early (`ThreadModal.tsx:534`); the thread's mic does nothing.
- **Suggestion:** Wire `onSendVoiceReply` or hide the mic in the thread composer.
- **Reason:** A visible control with no effect.

#### Improvement #9

- **Area:** Mobile / grouping
- **Current Situation:** The `NEW MESSAGES` divider does not break consecutive-message grouping (`pages/ConversationScreen.tsx:2672-2680`), so the first unread message can lose its avatar and header.
- **Suggestion:** Treat the divider as a group break in `messageGrouping.ts`.
- **Reason:** The first unread message is the one the user looks for.

#### Improvement #10

- **Area:** Mobile / secrets in source
- **Current Situation:** A GIPHY public demo key is hard-coded as the fallback for `EXPO_PUBLIC_GIPHY_API_KEY` (`components/GifPickerPanel.tsx:47-51`).
- **Suggestion:** Require the env key and hide the GIF tab when it is absent.
- **Reason:** A shared demo key is rate-limited for every install and ships inside the app bundle.

### OUT OF SCOPE

#### Suggestion #1

- **Suggestion:** Review and split the unrelated changes carried by branch `T00001`: `AttendanceController.php` (commit `0b72ae79` removes the 60-second punch cooldown, lines 297-306 of the old file), login v2 and branding commits, `public/.htaccess`, `php.ini`, `public/.user.ini`, `start.sh`, `config/database.php`, `BiometricController.php`, `AuthController.php`, `GetEmployeeDashboardQuery.php`, `.env.example`.
- **Reason Not Included:** None of these are part of the messaging specification; reviewing them against it would be inventing a standard.
- **Future Consideration:** Open a ticket per change; give the attendance cooldown removal its own review, because it removes a double-punch guard.

---

## 4. Security Review

| Check | Status |
| --- | --- |
| Authentication | PASS |
| Authorization | FAIL |
| Input Validation | FAIL |
| Data Exposure | FAIL |
| API Security | FAIL |

**Issues:**

- Authentication: PASS — every `/api/employee/messages/*` route sits inside `auth:sanctum` (`routes/api.php:41`, portal file loaded at `:68`); `/broadcasting/auth/{connection}` is inside the same group (`:65`); `/broadcasting/config` is public and returns key / host only. Private-channel authorisation uses `Conversation::isVisibleTo` (`routes/channels.php:28`).
- Finding #3 — chat-card endpoint writes HR application status with no approver check.
- Finding #4 — viewing or mark-all-read makes the caller a channel member; join approval bypassed.
- Finding #5 — General guard missing on `getMessage`, `markThreadAsRead`, `getMessageSeenReceipts`, `updateTicketStatus`.
- Finding #6 — unscoped search returns General's messages to inactive accounts.
- Finding #7 — manager-role channels readable and writable by non-managers.
- Finding #1 — upload accepts any file type with a client-chosen extension (input validation; executable under the shipped nginx config).
- Finding #9 — no empty-message or length validation on send.
- Finding #2 — link preview server-side request forgery (API security; returns internal page metadata, so also data exposure).
- Finding #5 — an inactive account can read message text through `message-detail` and the seen list (data exposure).
- SQL: search text and modifier values are bound parameters; the only raw SQL built from data is the `CASE WHEN` over integer conversation ids (`GetConversationsQuery`, `getUnreadCount`). Secrets: `.env.example` additions carry no values.

---

## 5. Performance Review

| Check | Status |
| --- | --- |
| Database Queries | PASS |
| API Performance | PASS |
| Frontend Performance | N/A — no device or profiler run was possible in this verification |
| Resource Usage | PASS |

**Issues:** Improvement #1 — `markAllAsRead` runs three queries per visible conversation. Improvement #2 — search runs one join query per own direct-message result. The spec §6.2 targets that can be checked by reading hold: seen receipts are one batched query plus one `Cache::many` (`GetMessagesQuery.php:323-365`), the list uses one `CASE WHEN` unread query, thread stats run two queries per page (`:209-310`); the search `p95 < 800 ms` target is a proposed default in the spec and was not measured.

---

## 6. Testing Review

### Existing Tests

- **Status:** passing for the messaging test, failing elsewhere. `php artisan test --testsuite=Unit` → 26 passed, 7 failed; all 7 failures are `ComputeWithholdingTaxActionTest` (payroll, "Call to a member function connection() on null" — database-dependent, unrelated to this ticket). `php artisan test --filter=SearchMessagesSyntaxTest` → 10 passed. `php -l` on all 30+ messaging PHP files: no syntax errors. `php artisan route:list --path=api/employee/messages` → 43 routes, matching spec §4.1. Mobile, in `resources/views/mobapp`: `npx tsc --noEmit` → exit 0, no errors; `npx eslint src/module/employee/messages` → exit 1, 150 errors and 83 warnings (Improvement #4). Feature tests were not run: `phpunit.xml` has no database configured (spec A-8).
- **Implemented:** NO — the only messaging test re-implements the parser inside the test and never calls `SearchMessagesQuery` (Improvement #3); no test covers any other AC.
- **Coverage:** none of AC-1 – AC-110 is covered by an automated test of the real code. Executed directly (tinker, array cache, no database): `AdvanceThreadReadAction` (AC-65, AC-68), `GetMessagesQuery::formatAttachments` (AC-77), `SendMessageHandler::mediaDimension` (AC-78), `GeneralAccessAction::check` / `denyResponse` / `guard` (AC-34, AC-75 rule).

### Manual Verification

| Scenario | Expected | Result | Status |
| --- | --- | --- | --- |
| AC-65/68: advance a thread position 60, then 55, then 60 again, then root 0 | `advanced` true, false, false, false; `last_read_id` 60, 60, 60, 0 | `{"advanced":true,"last_read_id":60}`, `{"advanced":false,"last_read_id":60}` ×2, `{"advanced":false,"last_read_id":0}` | PASS |
| AC-78: `mediaDimension` for `0`, `-5`, `20001`, `'abc'`, `12.5`, `null` | `NULL` | all `NULL`; `1080` and `'1080'` → `1080`, `20000` → `20000` | PASS |
| AC-77: `formatAttachments` with width 1080 / height 1920 and an `https` path | `width`, `height`, `url` returned; `url` = `path` when it starts with `http` | exactly that; `width`/`height` `null` when absent | PASS |
| AC-34/75 (rule): `check()` for system channel with status 1 / 0 and a normal channel with status 0 | `true` / `false` / `true`; deny payload and a `403` `JsonResponse` | exactly that | PASS |
| AC-31 – AC-34, AC-38 – AC-60, AC-62 – AC-74, AC-76, AC-79 – AC-91 (database-backed backend rules) | per spec | traced to `file:line` in the controller, queries and handlers; not executed (no test database) | Not run — no test database (A-8); code-traced |
| AC-11 slide transition, AC-24 composer growth, AC-26 back navigation keeps scroll and badges, AC-29 web width visuals | per spec | static configuration found (`slide_from_right`, `maxHeight: 140`, `maxWidth: 640` / `680`); behavior needs a device | Not run — device required |
| AC-97 Backspace on an empty input removes the last pill | pill removed | handler present (`MessagesSearchModal.tsx:1013-1021`); `onKeyPress` on an empty `TextInput` differs by platform | Not run — iOS and Android device required |
| AC-30 paste of ~3,000 multi-line characters with `@name` and `#tag` | text preserved | truncation and `#tag` chip conversion found by reading (Finding #21) | Not run — device required; read-only evidence recorded |
| AC-17 emoji inserted at the cursor | `hello😀` | `😀hello` by static trace (Finding #23) | Not run — device required to confirm |
| AC-35 / AC-36 / AC-102 live behaviors | per spec | code paths confirmed; live Reverb behavior not exercised | Not run — realtime server and two devices required |

---

## 7. Specification Impact Decision

### SPEC UPDATE REQUIRED

**Reason:** Case 1 — specification error: the spec contradicts itself. AC-67 (and AC-73) require that a non-member who reads or marks-all-read a public channel gets a `conversation_members` row, while AC-84 requires that a channel with `requires_approval` leaves the caller without a member row until an admin approves, and AC-87 requires that a non-member cannot post. Because posting is checked against that same table, the three cannot all hold (Finding #4). The fix needs a requirement decision: either read positions for non-members of non-system channels are not stored in `conversation_members`, or membership by reading is allowed for channels without approval. Every other finding is an implementation deviation. Where the shipped behavior is the intended one (for example Findings #16, #18 and #27, whose AC text v4 took from an earlier mobile inventory), that is a stakeholder decision (Case 2), not a verification outcome, and it goes through `/webkit-specify`.

**Changed Sections:**

- §2.5 AC-67 — non-member read must not create a row for a non-system channel; define how the unread badge of a previewed channel is kept.
- §2.5 AC-73 — mark-all-read must touch only conversations the caller belongs to, plus System channels for active accounts.
- §4.5 `markConversationAsRead` step 3 and §3.2 last paragraph — the "first read inserts a row" rule applies to `is_system` channels only.

---

## 8. Final Recommendation

### FIX REQUIRED BEFORE MERGE

**Required fixes:**

1. Finding #1 (BLOCKER) — Any employee can upload an executable `.php` file that the shipped nginx config will run.
2. Finding #2 (BLOCKER) — Link preview fetches any URL the caller supplies, including internal addresses (SSRF).
3. Finding #3 (BLOCKER) — Chat-card status endpoint approves or declines HR applications for any caller who can see the conversation.
4. Finding #4 (BLOCKER) — Reading a public channel makes the reader a member, which defeats join approval and the "must join" rule.
5. Finding #5 (REQUIRED FIX) — Four conversation-scoped endpoints skip the General-channel inactive-account guard.
6. Finding #6 (REQUIRED FIX) — Unscoped search returns General's messages to an inactive account.
7. Finding #7 (REQUIRED FIX) — Manager-role channels are hidden in the list and the unread count only.
8. Finding #8 (REQUIRED FIX) — No unique index on `conversation_members (conversation_id, account_id)`; first-read writes race.
9. Finding #9 (REQUIRED FIX) — The send handler accepts empty messages and over-long text.
10. Finding #10 (REQUIRED FIX) — A replayed send is not de-duplicated.
11. Finding #11 (REQUIRED FIX) — General's member endpoint returns a paginated list of every active account, not the specified placeholder.
12. Finding #12 (REQUIRED FIX) — Web messaging module changed under a ticket whose spec excludes web.
13. Finding #13 (REQUIRED FIX) — A failed channel creation shows a channel that does not exist on the server.
14. Finding #14 (REQUIRED FIX) — Demo tickets are listed and attachable when the user has no applications.
15. Finding #15 (REQUIRED FIX) — Thread-preview overflow badge is off by one.
16. Finding #16 (REQUIRED FIX) — A thread reply sent to the channel does not show "Also sent to the #channel" and "View thread" in the channel feed.
17. Finding #17 (REQUIRED FIX) — Ordinary messages that contain "left", "joined", "created" … render as system events.
18. Finding #18 (REQUIRED FIX) — Seen-avatar tap label is not the specified `Seen by <first name> • <time>` for two or more readers.
19. Finding #19 (REQUIRED FIX) — Search modal: no load-on-scroll and the empty-state text appears only with an active filter.
20. Finding #20 (REQUIRED FIX) — Any HTTP 403 shows the "Activate your account" banner.
21. Finding #21 (REQUIRED FIX) — Composer caps each text block at 2,000 characters and has no 4,000-character total; pasted `#word` text becomes a channel chip.
22. Finding #22 (REQUIRED FIX) — Cancelling a voice recording leaves the audio file on the device.
23. Finding #23 (REQUIRED FIX) — Picking an emoji in the main composer inserts it at the start of the text.
24. Finding #24 (REQUIRED FIX) — Retrying one failed send deletes every other unsent message, and failed rows show no indicator inside a group.
25. Finding #25 (REQUIRED FIX) — Thread composer attachments are never attached.
26. Finding #26 (REQUIRED FIX) — Announcement channel: composer controls stay active and a GIF is sent straight to a 403.
27. Finding #27 (REQUIRED FIX) — Messages header has no search button and no `⋮ More` button, and shows a fabricated online count.
28. Finding #28 (REQUIRED FIX) — The Requests chip lists plain conversations with no Accept / Decline; the declined row stays.
29. Finding #29 (REQUIRED FIX) — Mention highlight falls back to fuzzy name matching and can colour another colleague's mention as the viewer's own.
30. Finding #30 (REQUIRED FIX) — Recording indicator dot does not pulse.
31. Finding #31 (REQUIRED FIX) — "No messages yet" preview is not drawn in the muted colour.

<!-- Run history -->
