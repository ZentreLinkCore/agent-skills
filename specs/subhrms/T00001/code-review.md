# Webkit Code Review Report

## Metadata

| Field | Value |
| --- | --- |
| Ticket | T00001 (subhrms) |
| Branch | `T00001` — backend repo: base `origin/master`, 73 files changed, +9,105/-422 lines (HEAD `fc999da2`); mobile repo `resources/views/mobapp` (`hrms-react-native`): base `origin/main`, 122 files changed, +49,260/-1,327 lines (HEAD `c3130cc`); both identical to `origin/T00001` |
| Reviewer Role | Senior Developer Review |
| Review Date | 2026-10-13 |
| Review Run | v1 — initial |

---

## Summary

### Overall Code Quality

CHANGES REQUIRED

### Summary

This change is not mergeable: it carries four CRITICAL security defects, including an authenticated arbitrary-file-deletion path and two ways to read any message in the system, plus twenty HIGH findings. The most consequential is Finding #1: a client-supplied attachment path is stored as sent and later passed to `@unlink`, so any employee can delete files such as `.env` or `public/index.php`. Findings marked "Executed" were reproduced against the committed code in a disposable MySQL; the others were traced by reading, and each says which. The diff is far larger than one review can read in full (about 58,000 added lines), so the high-risk areas were reviewed first and the rest is listed under INFO "Not reviewed".

---

## Changed Areas

- **Frontend:** the messaging module of the mobile app (`src/module/employee/messages/`: 58 files, about 28,000 lines: screens, modals, drawers, the chat hook, the API layer, the context, parsers and utilities), the routes under `src/app/(app)/messages/`, shared components (`AppTopHeader`, `BottomSheetModal`, `ApplicationDetailModal`, wrappers), and changes outside messaging that ride on the branch: a new Notifications screen, `useTimeInOut`, AI chat and filing modals, `AuthContext`, `http.ts`, `package.json`, `app.json`.
- **Backend:** `MessagesController` (462 lines on master, 2,679 now), 9 handlers, 6 actions, 8 queries, 6 models, 5 new or changed broadcast events, `BroadcastAuthController`, `routes/channels.php`, `routes/api/employee.php`; unrelated edits to `AttendanceController`, `AuthController`, `BiometricController`, `GetEmployeeDashboardQuery`, `AppServiceProvider`.
- **Database:** 16 migrations (6 under `database/migrations/`, 10 under `alters/messages/`): `conversations` flags, `conversation_members` (admin flag, unique index), `channel_sections`, `channel_join_requests`, `custom_mentions`, message pins, system events, attachment dimensions; a conversation seeder.
- **Other:** `composer.json` / `composer.lock` (Scout and Meilisearch), `config/database.php`, `config/scout.php`, `public/.htaccess`, `php.ini`, `public/.user.ini`, `start.sh`, `.env.example`, the web `echo.ts`; one unit test file.

---

## Findings

### CRITICAL

#### Finding #1

- **Finding:** Security — arbitrary file deletion through a client-supplied attachment path
- **File:** [`app/Handlers/Messages/DeleteMessageHandler.php`](app/Handlers/Messages/DeleteMessageHandler.php#L234) (and [`app/Handlers/Messages/SendMessageHandler.php`](app/Handlers/Messages/SendMessageHandler.php#L196))
- **Line:** 234-256 (`unlink` branches), 196 (path stored as sent)
- **Issue:** `SendMessageHandler` stores `attachments[].path` exactly as the client sent it; nothing validates it (the controller passes `$request->input('attachments', [])` straight through and no rule matches `attachments.*`). When the sender deletes that message, `deleteAttachmentFile` runs `file_exists`, `is_file` and `@unlink` on `storage_path('app/public/' . $diskPath)` and on `public_path($rawPath)` with no containment. Input: `POST …/messages` with `attachments: [{ "name": "x", "path": "../../.env" }]`, then `DELETE` that message. **Executed:** calling the real `deleteAttachmentFile` with a `../…` path to a sentinel file outside `storage/app/public` deleted it.
- **Why It Matters:** any authenticated employee can delete any file the PHP user can write: `.env`, `public/index.php`, logs, other employees' uploads. The same unvalidated path also lets an `http://` URL render as an in-app file.
- **Recommended Fix:** in `SendMessageHandler` accept only paths that `UploadAttachmentHandler` issued (pattern `^storage/messages/[0-9a-f-]{36}\.[a-z0-9]+$`, file exists on the `public` disk) and answer 422 otherwise; in `deleteAttachmentFile` use only `Storage::disk('public')`, delete the `storage_path` and `public_path` branches, and reject any path containing `..`.

#### Finding #2

- **Finding:** Security — `reply_to_id` returns the text of any message to any sender
- **File:** [`app/Handlers/Messages/SendMessageHandler.php`](app/Handlers/Messages/SendMessageHandler.php#L165)
- **Line:** 165, 230-231 (response and broadcast), `app/Models/Message.php:58`
- **Issue:** `reply_to_id` is stored without checking that the parent message belongs to `$conversationId`; `Message::parent()` is an unscoped `belongsTo`, and the reply payload carries `replyTo.text`, `sender` and `senderAvatar` into the HTTP response and the `MessageSent` broadcast. **Executed:** a member of public channel #Ops posted `reply_to_id` = the id of a message in a private DM between two other people; the response returned `replyTo.text` = the DM text. Message ids are sequential, so every message in the system can be enumerated this way. (A second #Ops member reading the list through `GET …/messages` did not receive the text.)
- **Why It Matters:** private DMs, private channels and manager-only channels are readable by any employee who can post anywhere.
- **Recommended Fix:** before `Message::create`, require `Message::where('conversation_id', $conversationId)->whereKey($replyToId)->exists()` and answer 422 otherwise.

#### Finding #3

- **Finding:** Security — deep-link mentions copy any message, author and channel name
- **File:** [`app/Actions/Messages/ResolveMentionsAction.php`](app/Actions/Messages/ResolveMentionsAction.php#L249)
- **Line:** 249 (`execute`, `message_link`), 377 (`formatForViewer`), 213 and 350 (`channel_link`), 495 (text parsing)
- **Issue:** `message_link` resolution runs `DB::table('messages')->where('id', …)->first()` and copies the text, the author's name and avatar and the channel name into the mention, with no visibility check; `formatForViewer` repeats it for every reader. No structured payload is needed: `parseMentionsFromText` turns plain text such as `app://message/45` or `https://x?message_id=45` into such a mention. **Executed:** a user posted `see app://message/<id of a DM message>`; the response and another reader's `GET` both contained the DM text. `Conversation::find($targetId)` at 213 and 350 likewise returns the name of any private channel, and the custom-mention lookup at 198 bypasses the conversation scope.
- **Why It Matters:** a second route to read every private message, needing nothing but the ability to post.
- **Recommended Fix:** resolve a linked message or channel only when it is in `Conversation::visibleTo($sender)` at send time and again for each viewer in `formatForViewer`; otherwise omit the text, author and channel name; scope the custom-mention lookup the same way.

#### Finding #4

- **Finding:** Security — `getConversation` returns raw `Account` rows (government IDs) for a disabled conversation
- **File:** [`app/Http/Controllers/employee/MessagesController.php`](app/Http/Controllers/employee/MessagesController.php#L153)
- **Line:** 153
- **Issue:** when the requested conversation is absent from `GetConversationsQuery` (it lists only `status != 0`), the method falls back to `'members' => $convModel->members ?? []`, serialising full `Account` models; `Account::$hidden` covers only `password` and `remember_token`. **Executed:** a non-member calling `GET /conversations/{id}` on a disabled public channel received a member's row with 57 attributes, including `tin` (`123-456-789-000`) and `sss`; the row also carries PhilHealth, Pag-IBIG, birth date and addresses.
- **Why It Matters:** every employee can read every member's tax and social-security numbers for any conversation whose `status` is 0.
- **Recommended Fix:** map the members to `id`, name and avatar, as `getConversationMembers` already does, instead of returning the models.

### HIGH

#### Finding #5

- **Finding:** Database — the join-request unique key makes any second approve or decline fail
- **File:** [`database/migrations/alters/messages/2026_10_04_000001_add_requires_approval_and_create_channel_join_requests.php`](database/migrations/alters/messages/2026_10_04_000001_add_requires_approval_and_create_channel_join_requests.php#L27)
- **Line:** 27; `app/Http/Controllers/employee/MessagesController.php:1223` (approve), `:1296` (decline)
- **Issue:** the table is `unique(conversation_id, account_id, status)`, and approve/decline run `update(status = …)` on the pending row. **Executed:** approve → the user leaves → requests again → approve: `500 {"message":"SQLSTATE[23000]: Integrity constraint violation: 1062 Duplicate entry '5-6-approved' …"}` and the user is not added. The status is also written before the member row is inserted, with no transaction.
- **Why It Matters:** a user who was ever approved or declined can never be processed again, and the admin sees raw SQL.
- **Recommended Fix:** make the key `(conversation_id, account_id)` and update it in place, or delete the resolved row when a new request is created; wrap approve in `DB::transaction` and insert the member first.

#### Finding #6

- **Finding:** Security — the realtime channel rule ignores the inactive-account guard
- **File:** [`routes/channels.php`](routes/channels.php#L30)
- **Line:** 30-34
- **Issue:** `$conversationChannel` only calls `Conversation::isVisibleTo`; the REST endpoints also apply `GeneralAccessAction` (inactive account → 403). **Executed:** for an inactive account REST answered 403 while `isVisibleTo(General)` returned `true`. The REST call authenticated the account's token, so a deactivated employee with an existing token can subscribe to `private-conversation.{General}` and receive every message live; nothing is logged.
- **Why It Matters:** deactivated accounts keep a live feed of the company-wide channel.
- **Recommended Fix:** in the callback, load the conversation and return `false` when `GeneralAccessAction::check($conversation, $user)` fails.

#### Finding #7

- **Finding:** Security — channel listings bypass `Conversation::visibleTo`
- **File:** [`app/Http/Controllers/employee/MessagesController.php`](app/Http/Controllers/employee/MessagesController.php#L802)
- **Line:** 802; `app/Queries/Messages/SearchMessagesQuery.php:366-383`
- **Issue:** `getRecipients` lists every `channel` and `announcement` with no scope, and the unscoped `conversations` list of the search filters only `is_private = false`. **Executed:** a non-member's `GET /recipients` listed the private channel "Execs"; a `role_access` 3 user searching `Payroll` received the manager-only channel "Payroll Managers" with its description. Every other read path uses `visibleTo`, and the business rule is that regular employees cannot view or search manager channels.
- **Why It Matters:** the names and descriptions of private and manager-only channels (for example "salary review committee") are disclosed to every employee.
- **Recommended Fix:** build both lists from `Conversation::visibleTo($user)`.

#### Finding #8

- **Finding:** Security — member add and drop are not restricted to channels, so a DM creator can expose or wipe a DM
- **File:** [`app/Http/Controllers/employee/MessagesController.php`](app/Http/Controllers/employee/MessagesController.php#L2227)
- **Line:** 2227 (`addConversationMembers`), 2482 (`dropConversation`)
- **Issue:** both check only creator or co-admin; neither checks `type`. **Executed:** the creator of a DM between Ann and Bob added a third person, who then read the DM history; the creator then dropped the DM and the conversation and all its messages were deleted for both parties.
- **Why It Matters:** one participant can disclose the other's messages to a third person without consent, or destroy the other's history.
- **Recommended Fix:** require `$conversation->type === 'channel'` in add, remove, role-change and drop; for DMs offer only a per-user hide.

#### Finding #9

- **Finding:** Correctness — approval from a chat card skips the tier workflow, the locks and the transaction
- **File:** [`app/Http/Controllers/employee/MessagesController.php`](app/Http/Controllers/employee/MessagesController.php#L1846)
- **Line:** 1782-1913 (apply at 1846-1878); compare `app/Http/Controllers/manager/ApprovalRequestController.php:121-261`
- **Issue:** the manager portal runs inside `DB::transaction`, locks the row with `lockForUpdate`, requires `status = 0`, rejects locked pay periods, approves only the current tier and finalises only when no tier remains. The chat endpoint, once the caller is the current-tier approver, sets every tier to `status = 1` and the application to approved in one call, with no transaction, no lock and no pay-period check; any `status` string other than `Approved` (for example `Pending`) is written as declined (`status = 2`).
- **Why It Matters:** a tier-1 approver can finalise a request and skip HR, approve into a locked pay period, and two approvers can race; payroll data changes without the portal's safeguards.
- **Recommended Fix:** extract the body of `ApprovalRequestController::store` into one shared Handler called by both; validate `status` in `{Approved, Declined}` in the chat endpoint and let it only synchronise the card.

#### Finding #10

- **Finding:** Performance — each send fans out synchronously inside the database transaction
- **File:** [`app/Handlers/Messages/SendMessageHandler.php`](app/Handlers/Messages/SendMessageHandler.php#L136)
- **Line:** 136, 278, 338-362; all six events implement `ShouldBroadcastNow`
- **Issue:** inside `DB::transaction` the handler broadcasts `MessageSent` synchronously (before commit), runs `AdvanceThreadReadAction` (a lock that can throw), then for every other member runs one `COUNT` query and one synchronous `UnreadCountUpdated` broadcast. Traced: for 300 members that is 300 counts and 300 HTTP calls while the transaction is open, and a failure after the first broadcast rolls the row back while clients already display the message.
- **Why It Matters:** send latency grows with channel size and holds the connection and locks during network I/O; a ghost message appears when a later step fails.
- **Recommended Fix:** commit first, then broadcast (`DB::afterCommit` or a queued job); compute every member's unread count in one grouped query from `conversation_members.last_read_message_id`.

#### Finding #11

- **Finding:** Performance — mentions are re-resolved twice per message on every page load
- **File:** [`app/Queries/Messages/GetMessagesQuery.php`](app/Queries/Messages/GetMessagesQuery.php#L504)
- **Line:** 504-529 (calls `ResolveMentionsAction.php:31`, which runs `Conversation::with('members')->find`)
- **Issue:** for every message that has text and no stored mentions, the `mentions` and `isUserTargeted` closures each call `ResolveMentionsAction::execute`, which loads the conversation and all its members before finding nothing. **Measured:** loading one page of plain-text messages took 36 queries for 5 messages and 116 for 25, about 4 queries per message, 53 of them against `conversations` and 55 touching `conversation_members`.
- **Why It Matters:** the main list endpoint is O(messages × members) in queries; the same pattern applies to thread replies and pinned messages.
- **Recommended Fix:** resolve once per message, pass the already-loaded `Conversation` (the action accepts one), and skip resolution when the text contains none of `@`, `#`, `://`, `💬`.

#### Finding #12

- **Finding:** Performance — the client controls `limit` and it is not capped
- **File:** [`app/Http/Controllers/employee/MessagesController.php`](app/Http/Controllers/employee/MessagesController.php#L229)
- **Line:** 229; `app/Queries/Messages/GetMessagesQuery.php:74`
- **Issue:** `$limit = $request->input('limit', 25)` reaches the query with only a lower bound; thread replies and pinned messages have no limit at all. **Measured:** `?limit=100000` on a 150-message channel returned all 150 messages in one response and ran 616 queries.
- **Why It Matters:** combined with Finding #11, any authenticated employee can make one request cost hundreds of thousands of queries.
- **Recommended Fix:** clamp to 1–100 as the search and members endpoints already do; paginate thread replies and pinned messages.

#### Finding #13

- **Finding:** Performance — the conversation list is N+1 and over-fetches
- **File:** [`app/Queries/Messages/GetConversationsQuery.php`](app/Queries/Messages/GetConversationsQuery.php#L29)
- **Line:** 29, 63-71, 82-95, 176
- **Issue:** `with(['members'])` hydrates full `Account` rows for every member of every visible public channel; a view lookup and a `Cache::remember` run per conversation (the cache store is `database`); the unread `COUNT` runs for channels the user has not joined and is then discarded (153-155). **Measured:** 23 queries for a 9-row list, 33 for 14, 53 for 24, about 2 extra queries per conversation.
- **Why It Matters:** this is the landing screen and Finding #21 makes the app call it on every incoming message.
- **Recommended Fix:** select only `id, fname, lname, pic` for members; restrict the unread count to joined conversations; look the DM names up with one `whereIn`.

#### Finding #14

- **Finding:** Data — a migration seeds invented business data
- **File:** [`database/migrations/2026_09_29_000001_create_custom_mentions_and_add_mentions_to_messages.php`](database/migrations/2026_09_29_000001_create_custom_mentions_and_add_mentions_to_messages.php#L31)
- **Line:** 31-58
- **Issue:** the migration inserts the groups `PayrollTeam` and `OperationsSupport`, filled with the first four non-disabled accounts (`limit(4)`, no ordering).
- **Why It Matters:** in production four arbitrary employees become "the payroll team"; `@PayrollTeam` messages are then addressed to, and highlighted for, them. `project-profile.md` requires seeding by a stable key.
- **Recommended Fix:** remove the seed; create the groups from an admin screen or a keyed seeder.

#### Finding #15

- **Finding:** Configuration — the database session time zone is set globally in a messaging branch
- **File:** [`config/database.php`](config/database.php#L60)
- **Line:** 60; `app/Providers/AppServiceProvider.php:38`
- **Issue:** `'timezone' => env('DB_TIMEZONE', '+08:00')` sets the MySQL session zone for every connection of the application, and the provider calls `date_default_timezone_set` (which Laravel already does from `APP_TIMEZONE`). TIMESTAMP columns are converted on read, so if the server runs UTC (the repository's MySQL image sets no default zone) every existing timestamp reads 8 hours later after deployment. Traced; the effect depends on the production server's zone.
- **Why It Matters:** all message, attendance and payroll timestamps can shift silently.
- **Recommended Fix:** remove both lines (or default the connection zone to `null`); confirm the production zone and ship any change on its own ticket.

#### Finding #16

- **Finding:** Correctness — Approve and Decline report success when the server refused
- **File:** [`resources/views/mobapp/src/module/employee/messages/pages/ConversationScreen.tsx`](resources/views/mobapp/src/module/employee/messages/pages/ConversationScreen.tsx#L2927)
- **Line:** 2927-2989, 3026-3040; `hooks/useChatRoom.ts:1568-1580`
- **Issue:** `messages.api.updateTicketStatus` throws on a 403, but the hook's `updateTicketStatus` catches it with `console.warn`, so `handleApproveTicket`'s `try` never fails: the card flips to Approved and `@Name Your application … has been approved.` is sent as a real chat message. The gate ends `return isApproverRole || Boolean(user)` (3039), true for any signed-in user who did not send the card. Input: a non-approver recipient taps Approve; the server refuses (Finding #9's check) and nothing is thrown.
- **Why It Matters:** an HR-sensitive, false statement is posted persistently while the real application is unchanged.
- **Recommended Fix:** make the hook return a boolean or rethrow and roll back the optimistic update; send the confirmation only on success and show an error otherwise; drive `canApprove` from a server-provided approver flag.

#### Finding #17

- **Finding:** Error handling — failures are rendered as empty data, and optimistic actions are never rolled back
- **File:** [`resources/views/mobapp/src/module/employee/messages/services/messages.api.ts`](resources/views/mobapp/src/module/employee/messages/services/messages.api.ts#L281)
- **Line:** 277-281; `hooks/useChatRoom.ts:785` and `:1449-1518`; `pages/ConversationScreen.tsx:2187`
- **Issue:** `getThreadReplies` catches every error and returns `{ root: null, replies: [] }`, which the screen stores as `threadRepliesMap[id] = []`, wiping replies already known; `load_failed` carries no error (785), so a failed open shows "No messages yet" with no retry; `editMessage`, `deleteMessage` and `togglePinMessage` swallow server errors, so the UI keeps the edited, deleted or pinned state until reload. Traced.
- **Why It Matters:** the user is shown wrong information (an empty thread, a deleted message that still exists) with no error.
- **Recommended Fix:** have the API methods throw; keep an `error` field in the chat state with a retry action; snapshot and revert optimistic edit, delete and pin state on failure.

#### Finding #18

- **Finding:** Correctness — direct messages vanish from the inbox based on their text
- **File:** [`resources/views/mobapp/src/module/employee/messages/utils/messagePreview.ts`](resources/views/mobapp/src/module/employee/messages/utils/messagePreview.ts#L144)
- **Line:** 144-170; `contexts/MessagesContext.tsx:315`
- **Issue:** `hasDirectMessageHistory` treats a last message that starts with `no message`, `no messages` or `say hi` as "no history", and the inbox filters those conversations out. **Executed:** `"Say hi to Marco for me"` and `"No messages from payroll yet?"` return `false`; the conversation disappears even when it has unread messages. The backend placeholder is exactly `No messages yet`.
- **Why It Matters:** real conversations become unreachable from the list for ordinary sentences.
- **Recommended Fix:** decide from structure (no last-message id) or the exact backend placeholder, never from message text.

#### Finding #19

- **Finding:** Correctness — a conversation opened at the unread position has no way to load newer messages
- **File:** [`resources/views/mobapp/src/module/employee/messages/hooks/useChatRoom.ts`](resources/views/mobapp/src/module/employee/messages/hooks/useChatRoom.ts#L747)
- **Line:** 747-761
- **Issue:** with unread messages the first load is `getMessages({ aroundId: lastRead, limit })`, which returns a window on both sides of the cursor; the reducer tracks only `hasMore` for older pages and nothing loads newer ones (`since_id` exists in the API but is never called). Input: 40 unread messages in a channel; only the window after the cursor shows, later messages appear only if they arrive live, and the read flush zeroes the badge.
- **Why It Matters:** unread messages in the middle of a busy conversation are never shown.
- **Recommended Fix:** track `hasNewer`, add `loadNewer(sinceId)` called when scrolling to the end, and do not clear the unread badge until the newest message is loaded.

#### Finding #20

- **Finding:** Reliability — the realtime layer has no recovery path
- **File:** [`resources/views/mobapp/src/services/realtime/echo.ts`](resources/views/mobapp/src/services/realtime/echo.ts#L93)
- **Line:** 93-103, 157-169; `hooks/useChatRoom.ts`
- **Issue:** `init()` memoises `initPromise`; when `/api/broadcasting/config` fails it calls `setupFallback()`, which returns silently when no `EXPO_PUBLIC_*` key exists (typical for a release build), leaving no connection for the whole session. Nothing in the messaging module uses `AppState` or a reconnect hook to fetch what was missed, although the API supports `since_id`. Input: cold start on a poor network, or a locked phone for ten minutes: no live messages, typing or unread updates, and missed messages appear only after reopening the conversation.
- **Why It Matters:** the central promise of a chat module fails silently.
- **Recommended Fix:** clear `initPromise` on failure and retry with backoff and on foreground; on `AppState` `active` and on socket reconnect fetch since the newest known id and refresh the list.

#### Finding #21

- **Finding:** Performance — every unread event triggers three full refetches, including the whole directory
- **File:** [`resources/views/mobapp/src/module/employee/messages/contexts/MessagesContext.tsx`](resources/views/mobapp/src/module/employee/messages/contexts/MessagesContext.tsx#L298)
- **Line:** 298, 76-90; `services/messages.api.ts:98-122`
- **Issue:** the `.UnreadCountUpdated` handler ends with `refreshSilently()`, which fetches `getConversations`, `getUnreadCount` and `getStories`, and `getStories` is `GET /recipients` (every active employee plus all channels, unpaged). The event also reaches the sender's own channel. Traced: one message in a 200-member channel makes 200 devices send 600 requests.
- **Why It Matters:** load grows with members per message, and `setConversations(convs)` can overwrite newer optimistic state.
- **Recommended Fix:** apply the event payload locally; refetch only for an unknown conversation id, debounced; remove `/recipients` from this path.

#### Finding #22

- **Finding:** Security — an attachment name can write outside the cache directory on the device
- **File:** [`resources/views/mobapp/src/utils/mediaSave.ts`](resources/views/mobapp/src/utils/mediaSave.ts#L34)
- **Line:** 34-36, 177
- **Issue:** the download target is `` `${targetDir}${safeFilename}` `` where `safeFilename` is the attachment's `name` with only an extension ensured; the name is sender-controlled and stored unsanitised (`SendMessageHandler.php:195`). Input: an attachment named `../../Documents/x.ext`; when the recipient taps Save the file is written to that path inside the app sandbox with attacker-chosen content. Traced; not run on a device.
- **Why It Matters:** a message can overwrite files the app relies on in its sandbox.
- **Recommended Fix:** take the basename and allow only `[A-Za-z0-9._-]`; also sanitise `name` in `SendMessageHandler`.

#### Finding #23

- **Finding:** Data integrity — time in/out defaults to hard-coded Cebu coordinates
- **File:** [`resources/views/mobapp/src/module/employee/attendance/hooks/useTimeInOut.ts`](resources/views/mobapp/src/module/employee/attendance/hooks/useTimeInOut.ts#L54)
- **Line:** 54, 213-214
- **Issue:** the diff changes the initial `gpsLocation` from `null` to `{ latitude: 10.3157, longitude: 123.8854 }` and removes the fallback assignments; the punch sends `gpsLocation?.latitude ?? null`. Only the web branch reads a real position (130), so the simulated coordinates are submitted as the employee's location unless one was read.
- **Why It Matters:** attendance records carry a fabricated location, silently.
- **Recommended Fix:** start from `null`, read the device position (`expo-location`), and send `null` plus a flag when unavailable.

#### Finding #24

- **Finding:** Fabricated data — the Notifications tab shows invented notifications
- **File:** [`resources/views/mobapp/src/module/employee/notifications/pages/NotificationsScreen.tsx`](resources/views/mobapp/src/module/employee/notifications/pages/NotificationsScreen.tsx#L28)
- **Line:** 28-105
- **Issue:** the screen is new on this branch and initialises state with `INITIAL_NOTIFICATIONS`, six hard-coded items ("Leave Application Received", "Clock-In Verified …", "Overtime Request Approved"); no API is called anywhere in the module.
- **Why It Matters:** every employee sees made-up HR events on a primary tab.
- **Recommended Fix:** load notifications from an API, or hide the tab until one exists.

### MEDIUM

#### Finding #25

- **Finding:** Correctness — hooks called after an early return in `MessageContent`
- **File:** [`resources/views/mobapp/src/module/employee/messages/components/MessageContent.tsx`](resources/views/mobapp/src/module/employee/messages/components/MessageContent.tsx#L98)
- **Line:** 98 (`return null`) before 137 (`useMemo`)
- **Issue:** ESLint reports `react-hooks/rules-of-hooks` at 137:25 ("called conditionally"). React throws if one instance flips between empty and non-empty text. No concrete trigger was found (candidates: an unkeyed root row in `ThreadModal` when the thread changes).
- **Recommendation:** move every hook above the early return.

#### Finding #26

- **Finding:** Architecture — `MessagesController` is not thin
- **File:** [`app/Http/Controllers/employee/MessagesController.php`](app/Http/Controllers/employee/MessagesController.php)
- **Line:** whole file (2,679 lines; 462 on master)
- **Issue:** 42 methods and at least ten responsibilities (conversation lifecycle, join approval, membership, unread state, ticket status, profile, sections); 46 `DB::table(`, 21 `Schema::has*`, one `DB::transaction`, four empty `catch` blocks; `createConversation` alone is over 200 lines. Against `laravel-standards.md` and `project-profile.md` ("controllers call a Query/Handler; writes in `DB::transaction`").
- **Recommendation:** one Handler per use case, starting with join/approve, membership and ticket status.

#### Finding #27

- **Finding:** Maintainability — `Schema::hasColumn` guards for columns this branch creates
- **File:** [`app/Models/Conversation.php`](app/Models/Conversation.php) and the messaging classes
- **Line:** `Conversation.php` (`scopeVisibleTo`), `MessagesController.php` (21 calls), `GetMessagesQuery.php`, `GetConversationsQuery.php`
- **Issue:** about 43 `Schema::has*` calls in the messaging code, 26 of them guarding columns that this branch's own migrations add; each is an uncached metadata query on the request path.
- **Recommendation:** remove the guards; add a `Message::scopeVisible()` for the "not deleted" filter that is pasted into several queries.

#### Finding #28

- **Finding:** Error handling — raw exception messages and non-HTTP codes become responses
- **File:** [`app/Http/Controllers/employee/MessagesController.php`](app/Http/Controllers/employee/MessagesController.php#L576)
- **Line:** 576, 1585, 1618, 1640 (`getCode()` as status); every `catch` returns `$e->getMessage()`
- **Issue:** a PDO exception's code is a string such as `42S22`, which makes `response()->json(…, $status)` throw a `TypeError` that hides the real error (observed during verification); the bodies include SQL text, for example the executed responses of Findings #5 and #29 contained `SQLSTATE[23000] … Duplicate entry …`.
- **Recommendation:** map exceptions to fixed messages and integer statuses; log the detail.

#### Finding #29

- **Finding:** Correctness — `createConversation` has no validation or transaction
- **File:** [`app/Http/Controllers/employee/MessagesController.php`](app/Http/Controllers/employee/MessagesController.php#L853)
- **Line:** 853-1060
- **Issue:** `recipient_ids`, `admin_ids`, `name`, `description` and `avatar` are not validated. **Executed:** `POST /conversations` with `type: dm` and the caller's own id answered `500` with `Duplicate entry '6-3' for key …` (the member attach hits the unique index) after the conversation row was created.
- **Recommendation:** validate the input, reject a self-DM, and wrap the creation in `DB::transaction`.

#### Finding #30

- **Finding:** Data — `dropConversation` leaves files and dependent rows
- **File:** [`app/Http/Controllers/employee/MessagesController.php`](app/Http/Controllers/employee/MessagesController.php#L2482)
- **Line:** 2482-2560
- **Issue:** it deletes attachment rows but not the stored files, and leaves `channel_section_items`, `channel_join_requests` and `custom_mentions` rows (the new tables have no foreign keys); it also plucks every message id into memory for `whereIn`.
- **Recommendation:** delete the files and dependants inside the transaction, in chunks.

#### Finding #31

- **Finding:** Correctness — the system channel is identified by literals
- **File:** [`app/Http/Controllers/employee/MessagesController.php`](app/Http/Controllers/employee/MessagesController.php#L1351)
- **Line:** 1351, 1980, 2439, 2497; `app/Actions/Messages/RecordSystemEventAction.php:48`
- **Issue:** `id === 1`, `id <= 6` or `name === 'general'` decide system behaviour instead of `is_system`; anyone who names a channel "General" gets the system channel's rules.
- **Recommendation:** use `$conversation->is_system` everywhere.

#### Finding #32

- **Finding:** Testing — the only test exercises a copy of the parser
- **File:** [`tests/Unit/SearchMessagesSyntaxTest.php`](tests/Unit/SearchMessagesSyntaxTest.php#L12)
- **Line:** 12-77
- **Issue:** a private helper re-implements the parsing and never calls `SearchMessagesQuery`, so it cannot fail when production changes; nothing tests `visibleTo`, the inactive-account guard or any of the access rules above (`testing.md` requires coverage of access rules).
- **Recommendation:** extract the parser into an Action both use, and add Feature tests for access and read state.

#### Finding #33

- **Finding:** Dependencies — Scout and Meilisearch are declared and unused
- **File:** [`composer.json`](composer.json)
- **Line:** the added `laravel/scout` and `meilisearch/meilisearch-php` entries; `config/scout.php`
- **Issue:** search is raw SQL; neither package is installed or used.
- **Recommendation:** remove both packages and `config/scout.php`.

#### Finding #34

- **Finding:** Configuration — four PHP-limit mechanisms, one harmful, one publicly downloadable
- **File:** [`public/.user.ini`](public/.user.ini)
- **Line:** whole file; `php.ini`, `public/.htaccess`, `start.sh`
- **Issue:** the container already sets `memory_limit = 512M` (`docker/php/php.ini:12`); `public/.user.ini` is honoured by FPM and lowers it to 256M for every request, and nginx denies only `.ht*` (`default.conf.template:59`) so the file is served; the root `php.ini` and the `.htaccess` blocks do not apply on nginx.
- **Recommendation:** delete the four files and keep `docker/php/php.ini`.

#### Finding #35

- **Finding:** Unrelated change — the punch cooldown was removed from a messaging branch
- **File:** [`app/Http/Controllers/AttendanceController.php`](app/Http/Controllers/AttendanceController.php#L299)
- **Line:** around 299 (commit `0b72ae79`)
- **Issue:** the 60-second per-device guard is gone with no replacement. `time_in` is still blocked by the "already timed in" check, but a repeated `time_out` now falls through to the same-day record (313-320) with no cooldown.
- **Recommendation:** ship attendance changes on their own ticket; key any cooldown on the last attendance punch, not the device's `last_used_at`.

#### Finding #36

- **Finding:** Correctness — URLs containing `id=` are rewritten into channel chips
- **File:** [`resources/views/mobapp/src/module/employee/messages/utils/mentionParser.ts`](resources/views/mobapp/src/module/employee/messages/utils/mentionParser.ts#L186)
- **Line:** 186, 455 (duplicated at 935)
- **Issue:** the deep-link pattern accepts `https?://…[?&](id|conversation_id)=…` for any host. **Executed:** `see https://forms.example.com/view?id=123 for the form` renders as `#Channel 123`, which opens conversation 123.
- **Recommendation:** match only the app scheme or the API host, and require `message_id` for message links.

#### Finding #37

- **Finding:** Correctness — messages you send from another device are dropped
- **File:** [`resources/views/mobapp/src/module/employee/messages/hooks/useChatRoom.ts`](resources/views/mobapp/src/module/employee/messages/hooks/useChatRoom.ts#L802)
- **Line:** 802-808
- **Issue:** the `.MessageSent` handler returns early when `senderId` is the current user, assuming the send response already reconciled it; a message sent from the web or a second phone never appears on a phone that has the room open.
- **Recommendation:** skip only when a pending `clientId` or the id is already known (`mergeConfirmed` already dedupes by id).

#### Finding #38

- **Finding:** Security — the pinned-message cache survives logout and is not user-scoped
- **File:** [`resources/views/mobapp/src/module/employee/messages/hooks/useChatRoom.ts`](resources/views/mobapp/src/module/employee/messages/hooks/useChatRoom.ts#L596)
- **Line:** 596, 1612-1635; `services/storage/secure-storage.ts:126-129`
- **Issue:** full message JSON is cached under `subhrms_pinned_messages_<conversationId>`; `clearSession()` removes only the auth token and user, so the text stays on the device after logout and is merged into the next user's pinned list.
- **Recommendation:** store ids only, key by user, clear on logout, and treat the server as authoritative.

#### Finding #39

- **Finding:** Reliability — retry defeats the server's replay protection
- **File:** [`resources/views/mobapp/src/module/employee/messages/hooks/useChatRoom.ts`](resources/views/mobapp/src/module/employee/messages/hooks/useChatRoom.ts#L1520)
- **Line:** 1102, 1520-1539
- **Issue:** `retryMessage` calls `sendMessage`, which generates a new `local-…` `clientId` (1102); if the first POST committed and only the response was lost, the retry creates a duplicate and re-uploads attachments.
- **Recommendation:** reuse the failed message's `clientId` and uploaded paths.

#### Finding #40

- **Finding:** Correctness — a stale thread response overwrites the current thread
- **File:** [`resources/views/mobapp/src/module/employee/messages/pages/ConversationScreen.tsx`](resources/views/mobapp/src/module/employee/messages/pages/ConversationScreen.tsx#L2269)
- **Line:** 2269-2287
- **Issue:** `handleViewOriginalThread`'s `.then` calls `setActiveThreadMessage(finalRoot)` unconditionally (the sibling `handleReplyInThread` guards it); closing the thread or opening another before the response arrives reopens or swaps in the old one.
- **Recommendation:** guard on the current thread id or a request token.

#### Finding #41

- **Finding:** Reliability — the scroll-failure handler retries forever
- **File:** [`resources/views/mobapp/src/module/employee/messages/pages/ConversationScreen.tsx`](resources/views/mobapp/src/module/employee/messages/pages/ConversationScreen.tsx#L2763)
- **Line:** 2763-2774
- **Issue:** the list has no `getItemLayout`; `onScrollToIndexFailed` re-calls the same `scrollToIndex` every 100 ms with no limit and no index check, so a target outside the render window loops until unmount and can throw if the list shrinks.
- **Recommendation:** scroll by estimated offset first, retry once, bound the attempts and guard `index < length`.

#### Finding #42

- **Finding:** Correctness — forwarding drops attachments
- **File:** [`resources/views/mobapp/src/module/employee/messages/components/ForwardMessageModal.tsx`](resources/views/mobapp/src/module/employee/messages/components/ForwardMessageModal.tsx#L119)
- **Line:** 119-130
- **Issue:** only text is sent; an attachment-only message becomes `[Forwarded File from X]: name`, so the file is not forwarded.
- **Recommendation:** forward the attachments, or disable Forward for messages that carry them.

#### Finding #43

- **Finding:** Performance — every inline video autoplays, unmuted and looping
- **File:** [`resources/views/mobapp/src/module/employee/messages/components/InlineChatVideo.tsx`](resources/views/mobapp/src/module/employee/messages/components/InlineChatVideo.tsx#L142)
- **Line:** 142-148
- **Issue:** each bubble creates a player with `loop = true` and calls `play()` on mount; muting is never set. A chat with several videos starts several decoders and overlapping audio.
- **Recommendation:** show a poster and play only the tapped video, starting muted.

#### Finding #44

- **Finding:** Maintainability — oversized files mix many responsibilities
- **File:** [`resources/views/mobapp/src/module/employee/messages/pages/ConversationScreen.tsx`](resources/views/mobapp/src/module/employee/messages/pages/ConversationScreen.tsx)
- **Line:** whole files
- **Issue:** `ConversationScreen.tsx` 4,021 lines, `MessageInputBar.tsx` 2,732, `MessagesSearchModal.tsx` 2,545, `MessagesScreen.tsx` 1,790, `ManageChannelModal.tsx` 1,980, `GroupDetailsDrawer.tsx` 1,938; the attachment-picker and size-formatting logic is copied in `ConversationScreen` and `ThreadModal`.
- **Recommendation:** split by responsibility (list, composer, thread, search) and extract the picker into a hook.

### LOW

#### Finding #45

- **Finding:** Structure — alter migrations outside `alters/`
- **File:** [`database/migrations/2026_09_11_000001_add_is_admin_to_conversation_members_table.php`](database/migrations/2026_09_11_000001_add_is_admin_to_conversation_members_table.php)
- **Line:** 1
- **Suggestion:** `2026_09_11_000001`, `2026_09_12_000002`, `2026_09_12_000003` and `2026_09_13_000001` are `Schema::table` alters in `database/migrations/` while the other messaging alters live in `database/migrations/alters/messages/`; move them for consistency.

#### Finding #46

- **Finding:** Configuration — a hard-coded API key as a fallback
- **File:** [`resources/views/mobapp/src/module/employee/messages/components/GifPickerPanel.tsx`](resources/views/mobapp/src/module/employee/messages/components/GifPickerPanel.tsx#L47)
- **Line:** 47-51
- **Suggestion:** the code falls back to Giphy's public demo key when `EXPO_PUBLIC_GIPHY_API_KEY` is unset; require the environment variable and disable the picker without it.

#### Finding #47

- **Finding:** Performance — `markAllAsRead` runs several queries per conversation
- **File:** [`app/Http/Controllers/employee/MessagesController.php`](app/Http/Controllers/employee/MessagesController.php#L2592)
- **Line:** 2568-2600
- **Suggestion:** fetch the newest message ids in one grouped query and update the read positions in one statement.

### INFO

- **Observation:** Specification clarification required: `role_access` 1 and 2 may edit any non-system channel, including a private channel they are not in, and can set `is_private = false`, which makes its history visible to every employee (`MessagesController.php:1354-1405`; spec §4.7 and assumption A-3). Whether administrators should be able to change the privacy of channels they cannot see needs a product decision. The spec is not modified.
- **Observation:** Cross-reference: Finding #7 (manager-only channel names in search results) conflicts with the manager-channel rule of the spec (§6.1 rule 1) and was not caught by `verify.md` run v4, which covered the scoped search only. Re-run `/webkit-verify T00001` after it is fixed.
- **Observation:** Pre-existing (reported by the backend reviewer, not re-traced): `getEmployeeProfile` returns any account's email and phone to any employee.
- **Observation:** Reported by reviewers but not confirmed, so not listed as findings: the message-row `React.memo` comparator being defeated by changing callback identities (not profiled), side effects inside `setState` updaters in `MessageInputBar`, large modals always mounted, a duplicate `/read` POST per cursor advance, Echo being recreated after logout, `useAudioRecorder` pollers, and about 600 unused lines in `markdownFormatter.ts`.
- **Observation:** One reviewer claim did not reproduce and was dropped: that a reaction makes an unedited message show as edited.
- **Observation:** Decided design, not reported: thread read positions live only in the cache (spec Decision 7); any viewer may pin a message (assumption A-6).
- **Observation:** Visual and theme issues are covered by `design-review.md` (run v4) and are not repeated here.
- **Observation:** Not reviewed: in the backend, `BroadcastAuthController` and the 16 migrations were read only for index and constraint facts; query plans were not run (no `EXPLAIN` on realistic data). In the mobile app roughly half of the 58 messaging files were not read in full: `ManageChannelModal` (lint only), `GroupDetailsDrawer` from line 564, `MessageActionModal` from line 480, `MessagesSearchModal` outside lines 86-295 and 436-805, `ChatInputBar` from line 560, `CreateChannelModal` outside 225-420, `MessageAttachment` outside 380-570, `ForwardMessageModal` from 240, `MessagesMoreScreen`, `MessageRequestsScreen`, `ChatToolsDrawer`, `ColleagueProfileDrawer`, `MoveChannelSectionModal`, `CustomizeGroupModal`, the hold modals, `ArchivedChannelsModal`, `EmojiPickerPanel`, `MessageQuoteCard`, `ImageViewerModal`, `VideoPlayerModal`, `NewChatModal`, `MessageFab`, the headers and `ChatStreamSkeleton`; outside messaging only the diff of `AppTopHeader`, `BottomSheetModal`, `TimePickerModal` and the render of `ApplicationDetailModal`. No device or profiler run was possible.

---

## Positive Feedback

- `GetLinkPreviewQuery` pins the resolved IP (`CURLOPT_RESOLVE`), re-validates every redirect hop, caps the body at 1 MB and handles CGNAT and IPv4-mapped IPv6 addresses.
- `UploadAttachmentHandler` derives the stored extension from the sniffed MIME type and a whitelist, stores under a UUID name, and never accepts `svg`, `html` or `php`.
- `UpsertConversationMemberAction` absorbs only MySQL error 1062, and the read position advances with one conditional `UPDATE`, so overlapping reads cannot move it back; the unique-member migration stops on existing duplicates instead of deleting rows.
- `Conversation::scopeVisibleTo` groups its `OR` conditions correctly (no row leaks across them) and `SendMessageHandler` answers 404 for an invisible conversation so an id's existence is not confirmed; `client_id` replay protection runs under a lock.
- The mobile chat reducer separates confirmed and pending messages by `clientId`, and `mergeConfirmed` / `mergeReadReceipts` return the same reference when nothing changed, which removed a re-render loop.
- The inverted list arms pagination only after the first drag and keeps a fixed-height history footer, preventing chain-loading and scroll jumps; the thread-reply flow reconciles the optimistic row by server id and offers Retry on failure.
- Channel sections are strictly scoped by `account_id`; the Echo client takes its configuration from the server and holds no secrets; link opening allows only http(s) through `WebBrowser`.

---

## Final Recommendation

### FIX REQUIRED

**Fix before merge:**

1. Finding #1 — validate attachment paths on send and remove the `storage_path`/`public_path` unlink branches.
2. Finding #2 — require the `reply_to_id` parent to belong to the conversation.
3. Finding #3 — resolve linked messages and channels only when visible to the sender and to each viewer.
4. Finding #4 — return `id`, name and avatar for members, not `Account` models.
5. Finding #5 — fix the join-request unique key and wrap approve/decline in a transaction.
6. Finding #6 — apply `GeneralAccessAction` in the conversation channel callback.
7. Finding #7 — build `getRecipients` and the search channel list from `Conversation::visibleTo`.
8. Finding #8 — restrict member add, remove and drop to `type = channel`.
9. Finding #9 — route chat approvals through the shared, transactional approval Handler.
10. Finding #10 — broadcast after commit and compute unread counts in one query.
11. Finding #11 — resolve mentions once per message and skip texts without a trigger.
12. Finding #12 — clamp `limit` and paginate thread replies and pinned messages.
13. Finding #13 — remove the N+1 and over-fetch from the conversation list.
14. Finding #14 — remove the migration's seeded groups.
15. Finding #15 — remove the global session time zone (or confirm the production zone).
16. Finding #16 — roll back and stop confirming when approval fails.
17. Finding #17 — let API errors propagate, show retry, and revert optimistic state.
18. Finding #18 — decide DM visibility structurally, not from text.
19. Finding #19 — add loading of newer messages for the unread jump.
20. Finding #20 — retry realtime initialisation and resync after foreground or reconnect.
21. Finding #21 — stop refetching conversations, count and directory on every event.
22. Finding #22 — sanitise attachment names before building file paths.
23. Finding #23 — stop submitting simulated GPS coordinates.
24. Finding #24 — remove the fabricated notifications or load real ones.

<!-- Run history -->
