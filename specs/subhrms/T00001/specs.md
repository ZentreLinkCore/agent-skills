# Spec — Mobile App Messaging Full MVP Redesign (Slack-Inspired Workplace Communication)

> **Ticket:** `T00001` (subhrms) — this file is `.agents/specs/subhrms/T00001/specs.md`; branch `T00001`.
> **Kind:** Extension / Full MVP Redesign — complete redesign of the Mobile App Messaging module (Messages Landing, More Actions, Conversation, Threads, Composer, Message Requests, New Chat, Create Channel, Mentions, Emoji, Message Actions, Voice Recording) + General Default System Channel + (v4) Message Search, Read Positions and Seen Avatars.
> **Portal:** **employee** (`/api/employee/messages/...` routes, `resources/views/mobapp/src/module/employee/messages`).
> **Version:** v4 — 2026-10-13 — **Major.** Spec brought level with the system as built (commits 2026-09-29 → 2026-10-13): message search with modifiers and channel / DM scoping (§4.4, AC-48–AC-62), per-conversation and per-thread read positions with Messenger-style seen avatars (§4.5, AC-63–AC-75), thread participants, channel edit rules, attachment dimensions, and the pinned-message / system-event / join-approval baseline. Endpoint inventory, data model, realtime events and the frontend file map are corrected to the built system. v3 rules the code does not yet meet are listed in §10.2 (Known Gaps) and are **not** relaxed. v3 — 2026-09-29 — Added General Default System Channel spec: automatic membership via account status, backend authorization guard on all endpoints, inactive-user UI, mention audience resolution, and no manual member-management for General.
> **Route:** `/(app)/messages` (landing screen; the `/(app)/(tabs)/messages` tab redirects to it) & `/(app)/messages/conversation` (fullscreen conversation; the thread opens as a modal over it).
> **Conventions:** [project-profile.md](../../rules/project-profile.md), [hrms-rules](../../rules/hrms-rules.md) for the Laravel backend. The mobile app `resources/views/mobapp` is **a separate git repository** (`hrms-react-native`, branch `T00001`, gitignored from this repo) and a React Native / Expo codebase that project-profile.md does not describe; its conventions are this spec, [design-review.md](design-review.md) §0 and the module's own code.
> **System Awareness:** Models: `Conversation`, `Message`, `MessageAttachment`, `MessageReaction`, `ChannelSection`, `ChannelSectionItem`, `Account`, `AccountDetailVW`, `CustomMention` (reused); Tables: `conversations`, `messages`, `conversation_members`, `message_attachments`, `message_reactions`, `channel_sections`, `channel_section_items`, `channel_join_requests` (reused); Routes: `routes/api/employee.php` (`api/employee/messages/*`, reused — full inventory in §4.1); Migrations (all in `database/migrations/alters/messages/` and already present): `is_system`, `requires_approval` + `channel_join_requests`, `is_edited` / `is_deleted`, `linked_ticket_data`, `is_thread_broadcast`, `system_event`, `is_pinned` / `pinned_at` / `pinned_by`, attachment `width` / `height`; Action classes: `GeneralAccessAction`, `ResolveMentionsAction`, `RecordSystemEventAction`, `AdvanceThreadReadAction`; **no new tables or columns are introduced by v4** (Cache keys only — §3.3).

---

## 1. Purpose

The mobile application (`resources/views/mobapp`) possessed chat capabilities, but the experience was fragmented across inconsistent screens, mixed UI paradigms, and personal-chat styling that does not reflect a modern corporate HRMS.

This specification establishes a **full MVP redesign of the Mobile App Messaging module** and the Laravel API behind it, covering the complete user journey:
1. **Messages Landing Screen & Conversation Directory**: the central communication entry point with a search tap target, filter chips, unread status indicators, and an active colleagues presence reel.
2. **Messages Screen Actions (`⋮ More`)**: replacing the simple `+` button with a full-screen More view offering "Create Channel", "New Direct Message", "Message Requests", "Archived Channels", "AI HR Assistant" and "Mark All as Read".
3. **Conversation List Items & Latest Message Preview**: Consistent profile pictures, accurate delivery status ticks, unread counts, and unified preview logic (`Text`, `Sent a photo`, `Sent a video`, `Sent a voice message`, `Sent a file`, `No messages yet`).
4. **New Chat & Create Channel Flows**: modernized employee search, member selection with removable chips, and duplicate-conversation prevention.
5. **Message Request Experience**: a request queue for inquiries and cross-team communications matching the new corporate design language.
6. **Slack-Inspired Conversation View**: a structured workplace communication feed with clear sender identity, timestamp grouping, and contextual actions.
7. **Unified Message Component System**: Reusable modular blocks (`MessageRow`, `MessageHeader`, `MessageAvatar`, `MessageContent`, `MessageAttachment`, `MessageReaction`, `MessageThreadPreview`, `MessageActionModal`).
8. **Modern Message Composer**: auto-expanding multiline input, emoji and GIF pickers, dual-color `@mentions`, media attachment triggers, and voice recording with waveform visualization.
9. **Thread System**: Root message context, dedicated reply stream, reply composer, "also send to channel", and a real-time counter.
10. **Message Search (v4)**: Slack-style modifiers (`has:file`, `is:pinned`, `during:7d`, `from:`, `in:`, `with:`, leading `#channel` / `@colleague`), scoped to a channel or a direct conversation, with autocomplete and filter pills (§4.4, §5.3.10).
11. **Read Positions & Seen Avatars (v4)**: per-conversation and per-thread read positions that only move forward, and Messenger-style seen avatars under the latest message each reader has read (§4.5, §5.3.11).
12. **Channel Lifecycle (v4 baseline)**: the General system channel, channel edit rules, join with optional approval, pinned messages, channel system events, and per-user channel sections (§4.7, §4.9).
13. **Media (v4)**: attachment display dimensions stored and returned so videos and images render at their real size before they load (§4.6).

**Scope:** the **mobile app** (`resources/views/mobapp`, its own git repository) **and the Laravel API it consumes** (`routes/api/employee.php`, `app/…/Messages`). Web messaging redesign is deliberately excluded and will follow after mobile finalization.

---

## 2. Design Decisions (Pros & Cons)

### Decision 1: Visual Presentation — Slack-Inspired Workplace Feed vs. Personal Chat Bubbles

**Option A — Slack-Inspired Workplace Communication Layout (Recommended)**
- Left-aligned sender avatar with aligned text gutter.
- Header row containing Sender Name, Role/Department badge, and timestamp.
- Chronological message grouping: consecutive messages within 5 minutes from the same sender collapse the header and avatar, preserving vertical density.
- Mentions highlighted via theme tokens: `@current_user` in golden chestnut (`primaryBg` / `chestnutAccent`), `@other_user` in slate blue (`infoBg` / `moduleTimekeeping`).
- Thread previews attached to the root message with reply avatars, count, and timestamp.

| Pros | Cons |
|---|---|
| Superior corporate feel: matches modern professional workplace tools (Slack, Teams). | Requires careful layout gutter alignment and text segment rendering. |
| Eliminates cramped left/right speech bubbles on small mobile viewports. | Slightly different mental model for users expecting WhatsApp/Messenger bubble tails. |
| Seamlessly embeds linked HRMS tickets, code snippets, file tables, and thread summaries. | None for enterprise HRMS apps. |

**Option B — Traditional Consumer Chat Bubbles (Left/Right Tails)**
- Right-aligned colored bubbles for current user, left-aligned gray cards for others.

| Pros | Cons |
|---|---|
| Familiar to casual social media users. | Consumes significant horizontal padding, cramping long HR ticket details and code snippets. |
| Built-in visual distinction between sender and recipient. | Feels like a personal social app rather than an enterprise business platform. |

**Recommendation:** **Option A**. The user explicitly specified a Slack-inspired workplace communication layout over traditional personal-chat bubbles.

> **v4 amendment:** mentions render as bold coloured text, not pills (AC-14, AC-15; Decision 11).

---

### Decision 2: Message Screen Actions (`⋮ More`) Interaction Pattern

**Option A — Bottom Action Sheet with Backdrop Dismissal (Recommended)**
- Tapping `⋮ More` in the Messages header slides up a native-feeling bottom action sheet using Shopify Restyle cards.
- Options: "New Chat" (direct colleague conversation), "Create Group" (multi-member team channel), "Message Requests" (inquiries), and "Mark All as Read".
- Outside touch or pull-down gesture dismisses the sheet.

| Pros | Cons |
|---|---|
| Natural one-handed thumb reachability on modern tall mobile devices. | Takes up vertical screen real estate while active. |
| Accessible, touch-friendly hit targets (min 48px height per option). | Requires overlay modal or sheet container. |
| Clean separation from the conversation list scroll area. | None. |

**Option B — Top-Right Anchored Popover / Dropdown Menu**
- Floating dropdown anchored to the top-right `⋮` icon.

| Pros | Cons |
|---|---|
| Traditional desktop pattern. | Hard to reach with one hand on devices with 6.5"+ screens; prone to clipping on smaller screens. |

**Recommendation:** **Option A**. Bottom sheets provide the best mobile-first ergonomics and accessibility.

> **v4 amendment:** the bottom sheet was not built; `⋮ More` opens a full-screen More view (AC-2; Decision 11).

---

### Decision 3: Threads UI Architecture

**Option A — Dedicated In-View Sheet / Sub-View with Preserved Context (Recommended)**
- Thread view opens either as a slide-over sheet or focused pushed stack route (`/(app)/conversation?threadRootId=...`).
- Displays the pinned Root Message at the top, followed by a dedicated reply stream and thread-scoped composer at the bottom.
- Parent conversation maintains live reply counts (`thread_count`) and latest reply timestamp.

| Pros | Cons |
|---|---|
| Total focus on the specific discussion topic without cluttering the main channel. | Requires passing thread context down the state management chain. |
| Slack-grade thread mental model: replies do not disrupt the main conversation flow. | Secondary back-navigation step to return to main channel. |

**Option B — Inline Accordion Expansion inside Main Message Stream**
- Tapping "X replies" expands replies directly under the parent bubble in the main list.

| Pros | Cons |
|---|---|
| Keeps user in the same list. | Drastically complicates `FlatList` height calculations, scroll anchoring, and unread management. |

**Recommendation:** **Option A**. Clean segregation between channel chatter and focused thread deep-dives.

> **v4 amendment:** the thread opens as `ThreadModal` over the conversation screen, not as a pushed `/(app)/conversation?threadRootId=…` route (§5.2; Decision 11).

---

### Decision 4: Latest Message Preview Unification Strategy

**Option A — Centralized Deterministic Preview Utility (`formatLatestMessagePreview`) (Recommended)**
- Single pure function shared across `MessagesScreen`, `ConversationListItem`, `MessageRequestsScreen`, and active notifications.
- Enforces strict contract:
  - Text → raw text string
  - Photo / Image / GIF → `"Sent a photo"`
  - Video → `"Sent a video"`
  - Voice / Audio → `"Sent a voice message"`
  - Document / File → `"Sent a file"`
  - Empty → `"No messages yet"`

| Pros | Cons |
|---|---|
| Zero duplication: 100% consistent across inbox, requests, and search results. | None. |
| Highly performant: pure string parser with zero React hook re-renders. | Requires components to feed standard item shape. |

**Option B — Per-Component Ad-Hoc Formatting**
- Format previews inside each component file.

| Pros | Cons |
|---|---|
| Quick to write initially. | High bug risk: inbox displays one string while requests tab displays another. |

**Recommendation:** **Option A**. The utility already exists in `utils/messagePreview.ts` and will serve as the single source of truth.

---

### Decision 5: General Channel — Access Model

**Option A — Status-Only Check, No `conversation_members` Rows Required (Recommended)**
- `General` is a public channel (`is_private = false`, `created_by = null`, `is_system = true`).
- Access is determined solely by `accounts.status = 1` (active account). No `conversation_members` row is needed for read/write.
- The existing `Conversation::scopeVisibleTo()` already surfaces public channels to all authenticated users; the General guard adds the active-status check on top.
- A thin `App\Actions\Messages\GeneralAccessAction::check($conversationId, $user)` encapsulates the rule: if the conversation is General (is_system = true), verify `$user->status === 1`. Return `true|false`.
- All relevant controller methods call this action when `$conversation->is_system` is true, before any Q/H execution.
- `conversation_members` rows for General are **not created** for normal active users; the row is created **only** when `last_read_message_id` must be persisted (the `markConversationAsRead` flow uses `updateOrInsert`, which is already idempotent).

| Pros | Cons |
|---|---|
| Zero membership management overhead: no sync job, no migration per employee. | Unread-count calculation for General must either use `conversation_members` (sparse) or fall back to a global threshold when no row exists (returns 0 — acceptable first load). |
| Access automatically follows HRMS status: activation/deactivation is a single column update. | `getConversationMembers` endpoint for General cannot return a real member list — must return a count/placeholder or be disabled. |
| Aligns with spec requirement §14: no per-user General membership management. | None for the overall architecture. |

**Option B — Populate `conversation_members` for Every Active Employee**
- On account activation, insert a `conversation_members` row for General.
- On deactivation, remove or flag the row.

| Pros | Cons |
|---|---|
| Existing unread logic works unchanged. | Requires an observer, job, or hook on account status change — and a backfill migration for all existing active employees. |
| Member list API returns real rows. | Introduces a large `conversation_members` table that grows with every hire. |
| | Violates spec requirement §14 — spec explicitly prohibits a per-user General membership list. |

**Recommendation:** **Option A**. The spec is explicit that General must not require a per-user membership row. Option A is the architecturally correct and scalable approach.

### Decision 6: Message Search — Extend `SearchMessagesQuery` with a Modifier Parser (v4)

> **DECIDED — `LIKE` search on `messages.text` with Slack-style modifiers parsed out of the query string (§4.4).**
> Rejected: **Laravel Scout / a search engine** — `Laravel\Scout\Searchable` was added to `Message` on 2026-10-04 (`51ddc284`) while `laravel/scout` was declared in `composer.json` but absent from `vendor/`, so the trait failed to load and was removed on 2026-10-09 (`07103890`); a search engine (`meilisearch/meilisearch-php` is also declared) is infrastructure this ticket does not provision. The leftover dependencies and `config/scout.php` are listed in §10.2 G-13. **A MySQL `FULLTEXT` index** — needs a migration and a minimum token length that breaks short queries such as `hr`; no index is added in this ticket (revisit when `LIKE '%…%'` over a member's conversations measurably slows, see §6.2 Performance).
> One endpoint serves messages, colleagues and channels so the client needs a single call per keystroke burst.

### Decision 7: Per-Thread Read Positions Live in the Cache (v4)

> **DECIDED — one cache key per member per thread (`thread_last_read_{root}_{account}`, 30-day TTL), advanced atomically under a lock (§3.3, §4.5).**
> Rejected: **a new table or a JSON column on `conversation_members`** — a schema change and a migration for state that only drives seen avatars and a thread's unread marker; losing it degrades to "not seen yet" and never loses a message. **Reusing `conversation_members.last_read_message_id`** — a thread reply must not mark the main list read, and the main list's position must not mark thread replies read.
> **Accepted risk:** a cache flush (or the `database` cache driver being truncated) resets every thread position to 0 (§6.4).

### Decision 8: Seen Avatars Are Computed from One Receipt List per Page (v4)

> **DECIDED — `getMessages` and `getThreadReplies` return one `read_receipts` array (each other active member's position); the client places each reader on the newest loaded message whose id is `<=` the position (§4.5, §5.3.10).**
> Rejected: **a `seen_by` array on every `MessageItem`** — N× payload and one lookup per message. **A boolean `read` tick only** — cannot show who has seen a message; the existing `read` field stays for the sender's tick. A message's full reader list is fetched on demand by `GET …/seen`, which applies the same rules so the list and the avatars never disagree.

### Decision 9: Read Positions Move Forward Only, Atomically (v4)

> **DECIDED — the conversation position advances with one conditional `UPDATE … WHERE last_read_message_id IS NULL OR < target`; a thread position advances under a cache lock; `MessagesRead` is broadcast only when the position actually advanced (§4.5).**
> Rejected: **read-then-write** — an overlapping or out-of-order request (reconnect, second device) can move a position backward, which makes a seen avatar jump back to an older message and re-broadcasts identical positions.

### Decision 10: One Attachment Payload Builder (v4)

> **DECIDED — `GetMessagesQuery::formatAttachments()` is the only producer of the attachment array for lists, threads, pinned messages, the send response and the `MessageSent` broadcast (§4.6).**
> Rejected: **a copy in `SendMessageHandler`** (it existed until `7e5787fc`) — the copies drifted, and videos rendered at a default box then resized after the player loaded because one path had no `width` / `height`.

### Decision 11: Shipped UI Shapes Replace the v3 Sketches (v4)

> **DECIDED — where the shipped mobile app delivers the v3 capability in a different UI shape, v4 specifies the shipped shape (assumption A-2):** `⋮ More` opens a full-screen More view (Decision 2's bottom sheet was not built); Create Group is one `Create Channel` form; the thread opens as `ThreadModal` (a modal, not a pushed `ThreadScreen`); the composer is `ChatInputBar` over `MessageInputBar` with the recording state inline (no `VoiceRecordingBar`). Rules, security and data requirements are **not** relaxed by this decision: where the code does not meet them they are listed in §10.2.

## 2.5 Acceptance Criteria

| # | Given | When | Then |
|---|-------|------|------|
| AC-1 | User is on `MessagesScreen` (`/(app)/messages`) | Screen finishes initial load | Header displays `Chats`, online presence count, unread badge (if > 0), search button, and `⋮ More` action button. |
| AC-2 | User taps `⋮ More` in the header (or the More tab of the bottom bar) | More opens | The full-screen More view (`MessagesMoreScreen`, route `/(app)/messages/more`) lists `Create Channel`, `New Direct Message`, `Message Requests`, `Archived Channels`, `AI HR Assistant` and `Mark All as Read`; `Mark All as Read` asks for confirmation, then calls `POST /api/employee/messages/mark-all-read`. |
| AC-3 | User selects `New Direct Message` from the More view | Action is triggered | `NewChatModal` opens with employee search bar, colleague list, avatars, departments, and real-time query filtering. |
| AC-4 | User selects a colleague who already has an existing direct conversation | Colleague is tapped | Existing conversation is resolved without creating a duplicate; app navigates to `/(app)/messages/conversation` with existing `id`. |
| AC-5 | User selects a colleague with no prior conversation | Colleague is tapped | Calls `POST /api/employee/messages/conversations`, updates conversation directory, and pushes to `/(app)/messages/conversation` with new `id`. |
| AC-6 | User selects `Create Channel` from the More view | Action is triggered | `CreateChannelModal` opens as one form: channel name, optional description, public or private, a member picker with search and removable chips, and a Co-Admin toggle per member. Submit calls `POST /api/employee/messages/conversations` (`type: "channel"`, `name`, `recipient_ids`, `is_private`, `admin_ids`) and opens the new channel. A failed request shows an error and creates nothing (AC-107). |
| AC-7 | User switches category chip to `Requests` or opens from More menu | Requests view active | Displays incoming message requests using the unified design system, showing user avatar, name, latest preview, timestamp, and accept/decline actions (persistence: gap G-4, question Q-7). |
| AC-8 | Conversation list renders an item with an image attachment | Item renders preview | Displays `"Sent a photo"` instead of raw URLs or placeholder text; does not render full attachment thumbnail in list item. |
| AC-9 | Conversation list renders an item with video, voice, or file | Item renders preview | Displays `"Sent a video"`, `"Sent a voice message"`, or `"Sent a file"` respectively. |
| AC-10 | Conversation list renders an item with zero messages | Item renders preview | Displays `"No messages yet"` in muted font. |
| AC-11 | User taps any conversation card in `MessagesScreen` | Navigation triggered | Transitions via native `slide_from_right` to fullscreen `/(app)/messages/conversation`; `AppTopHeader` and `CustomTabBar` are hidden. |
| AC-12 | User is in `ConversationScreen` | Messages load | Stream displays Slack-inspired workplace layout: left-aligned avatars, name, timestamp, and clear content blocks. |
| AC-13 | Multiple consecutive messages sent by same user within 5 minutes | Message stream renders | Subsequent messages collapse the avatar and header, displaying text aligned with the message gutter. |
| AC-14 | Message contains a mention of the current authenticated user | Message text renders | Current user's `@name` is rendered in bold golden chestnut (`#CB793A` light / `#E2A35A` dark) with no background. |
| AC-15 | Message contains a mention of another colleague | Message text renders | Other colleague's `@name` is rendered in bold blue (`#0284C7` light / `#38BDF8` dark) with no background. |
| AC-16 | User types `@` in the composer input | `@` entered | Mention popup list appears above composer filtered by entered query; selecting a name inserts formatted `@Name ` and closes popup. |
| AC-17 | User taps the smiley icon in composer | Emoji action triggered | Keyboard smoothly transitions or docks an emoji picker panel; selecting emoji inserts symbol at current cursor index. |
| AC-18 | User long-presses or taps `⋮` action on a message row | Action menu opens | Contextual action sheet appears with a reaction row (`❤️ 😂 😮 😢 😡 👍`) and the tiles `Reply`, `Thread`, `Copy`, `Pin` / `Unpin`, `Forward`; plus `Edit Message` and `Delete Message` when the sender is self, `Copy Message Link`, and `Retry Sending` when the send failed. |
| AC-19 | User taps `Reply in thread` on a message | Action selected | Thread panel/screen opens showing the pinned Root Message, existing replies count, chronological replies, and dedicated reply composer. |
| AC-20 | User sends a reply inside a thread | Send button tapped | Reply is appended to thread, root message increments `thread_count`, and last reply snippet updates. |
| AC-21 | User taps the microphone icon in composer | Voice action triggered | Composer transitions to Recording State: displays pulsing red record dot (gap G-15), active timer (`00:15`), real-time audio waveform/metering bars, Cancel (`Trash`), and Send buttons. |
| AC-22 | User taps Cancel during voice recording | Cancel tapped | Audio recording stops, scratch audio file is purged, composer reverts to text input mode without sending. |
| AC-23 | User taps Send during voice recording | Send tapped | Audio recording finishes, audio file uploads via `POST /api/employee/messages/upload`, and voice message item is dispatched. |
| AC-24 | User types multiple lines of text in composer | Text length grows | Input container expands smoothly up to max height (140px) and enables internal scrolling without obscuring message list. |
| AC-25 | User attaches photo or file via attachment drawer | Attachment selected | Compact attachment preview chip with remove (`X`) button renders directly above the input bar. |
| AC-26 | User taps Back button in `ConversationScreen` | Header back tapped | Screen smoothly slides back out to `MessagesScreen`, keeping previous scroll position and updating unread badges. |
| AC-27 | Conversation is marked as Announcement channel | Conversation loaded | Composer input is replaced by the notice `Company Announcements is broadcast-only. Only administrators can post here.` for accounts that may not post (who may post: Q-2; server rule AC-88). |
| AC-28 | User sends a message while offline or network errors | API request fails | Optimistic message shows an inline failure indicator (`AlertCircle`) and the message action sheet offers `Retry Sending`; drafted content is not dropped. |
| AC-29 | Desktop Web viewport (>1024px) opens Messages or Conversation | Screen loaded | The conversation is centered with max-width 640px and subtle card borders and shadow; the landing and More views use max-width 680px. |
| AC-30 | User pastes long multi-line text with mentions into composer | Content pasted | Composer preserves linebreaks, cursor position, and renders all mention segments cleanly. |
| **General Default Channel — Membership & Access** | | | |
| AC-31 | Active employee (accounts.status = 1) authenticates | `GET /api/employee/messages/conversations` called | Response includes the General channel (`isDefault: true`, `is_system: true`) without any `conversation_members` row needed for the user. |
| AC-32 | Active employee opens General conversation | `GET /api/employee/messages/conversations/{id}/messages` called | Returns `200 { success: true, data: [...] }` — messages load normally. |
| AC-33 | Active employee sends a message to General | `POST /api/employee/messages/conversations/{id}/messages` called | Returns `200 { success: true, data: { ... } }` — message is persisted and broadcast. |
| AC-34 | Inactive employee (accounts.status = 0) calls any General endpoint | Any messaging API call with General `{id}` | Returns `403 { success: false, message: "Your account is inactive. Please contact HR to restore access." }`. |
| AC-35 | Inactive employee opens General in the mobile app | ConversationScreen mounts | Composer is hidden; message list is hidden; an informational banner renders: `"Activate your account to view this channel. Please contact HR to activate your account."` |
| AC-36 | General channel detail / info view is opened | User views channel info | No "Add members", "Remove member", "Invite", or "Leave channel" actions are shown. Description reads: `"Everyone with an active HRMS account has access to this channel."` (shown by `ManageChannelModal`; the conversation-header drawer does not: gap G-12). |
| AC-37 | User-created channel (isDefault: false) detail is opened | User views channel info | Normal member management actions are present (Add, Remove, Leave). Behaviour is unchanged from existing implementation. |
| AC-38 | HR activates a previously inactive employee account | Account status changes from 0 → 1 | Employee immediately gains General access on next authenticated API call — no additional setup required. |
| AC-39 | Inactive employee attempts `POST .../messages` to General directly via API | Raw API call without frontend | Returns `403 { success: false, message: "Your account is inactive. Please contact HR to restore access." }` — frontend UI state is irrelevant. |
| AC-40 | Inactive employee attempts to load General thread replies | `GET .../messages/{msgId}/replies` for General | Returns `403` with the inactive-account message. |
| AC-41 | Inactive employee attempts to toggle a reaction in General | `POST .../messages/{msgId}/reactions` for General | Returns `403` with the inactive-account message. |
| **General — Mention Audience** | | | |
| AC-42 | User types `@all` in General composer | Message is sent and returned to readers | `@all` is stored as one mention of type `all`. For every active reader the returned `mentions[].is_targeted` is `true`; an inactive account cannot read General at all (AC-34), so no inactive or resigned employee is ever targeted. The audience is not expanded into a list of accounts. |
| AC-43 | User types `@here` in General composer | Message is sent and returned to readers | Same as AC-42 for type `here`; presence rules apply to the picker only (`SearchMentionsQuery`), not to `is_targeted`. |
| AC-44 | User opens mention search (`@jo`) inside General | Mention picker loaded | Server-side debounced search returns only employees with `accounts.status = 1`; inactive employees do not appear in results. |
| AC-45 | User is a member of a private user-created channel and opens mention search | Mention picker loaded | Inactive employees still do not appear. Filter applies globally to all channels' mention search. |
| **General — Historical Data** | | | |
| AC-46 | Employee becomes inactive | System state change | Pre-existing General messages authored by that employee remain in the database; they are not deleted. |
| AC-47 | Inactive employee is reactivated by HR | Account status returns to 1 | Employee immediately sees full General history on next load — no message gap or re-join ceremony required. |
| **v4 — Message Search (`GET /api/employee/messages/search`, §4.4)** | | | |
| AC-48 | Authenticated employee; no modifiers, no scope | `GET /search?q=budget` | `200 { success: true, data, messages, users, conversations, channel: null, pagination: { current_page: 1, per_page: 20, total, has_more } }`. `data` equals `messages`. Every message belongs to a conversation the caller is a member of, or to a non-disabled system channel or announcement. Order is `id` descending. Messages with `is_deleted = true` are absent. |
| AC-49 | `q` is empty or only spaces and no modifier, scope or filter is given | `GET /search?q=` | `200` with `messages: []`, `users: []`, `conversations: []`, `channel: null`, `pagination.total: 0`. |
| AC-50 | Two messages contain "report"; only one has an attachment | `GET /search?q=has:file report` (also `has:attachment`) | Only the message with at least one attachment; its `attachments_count >= 1`. `has:file` is not part of the text term. |
| AC-51 | A pinned and an unpinned message both contain "policy" | `GET /search?q=is:pinned policy` (also `has:pin`) | Only the pinned message; `is_pinned: true`. |
| AC-52 | Messages created 3 days ago and 20 days ago both contain "report" | `GET /search?q=during:7d report` | Only the 3-day-old message. |
| AC-53 | Active account Maria Santos sent one of two messages containing "invoice" | `GET /search?q=from:maria invoice`, and `from:@maria-santos invoice` | Only Maria's message. `from:nobody invoice` returns `200` with `messages: []`, `pagination.total: 0`. |
| AC-54 | Channels "General" and "Finance Team" both contain "budget"; caller is a member of both | `GET /search?q=in:finance-team budget`, and `q=#finance-team budget` | Only Finance Team messages. `channel` is `{ id, name: "Finance Team", type: "channel", is_private, avatar, description }`. |
| AC-55 | Caller has a direct conversation with active colleague Maria Santos | `GET /search?q=with:maria hello`, and `q=@maria hello` | Only that conversation's messages; `channel` is `{ type: "direct", name: "Maria Santos", is_private: true, … }`. With no direct conversation: `messages: []`, `channel: null`. |
| AC-56 | Caller is not a member of private channel "Execs"; or the caller's `accounts.status = 0` and the scope is "General" | `GET /search?q=#execs budget`; `GET /search?q=#general budget` | `200` with `messages: []`, `channel: null`, `pagination.total: 0` — the same response as a channel that does not exist. Never `403` or `404`. |
| AC-57 | Modifiers combined | `GET /search?q=#general from:maria has:file during:30d invoice` | Only messages in General, from Maria, with an attachment, created in the last 30 days, containing "invoice". |
| AC-58 | `limit` and `page` out of range | `limit=500&page=0`; `limit=0`; no `limit` | `per_page: 100` and `current_page: 1`; `per_page: 1`; `per_page: 20`. |
| AC-59 | Unscoped, unfiltered, page 1, text `maria` matches colleagues and channels | `GET /search?q=maria` | `users` holds at most 30 active colleagues (`conversation_id` is the caller's existing direct conversation with that colleague, else `null`). `conversations` holds at most 15 channels / announcements / groups that are not private, each with `is_member`. On `page=2` both are `[]`. |
| AC-60 | Directory mode | `GET /search?q=maria&mode=direct` | `users` filled, `messages: []`, `conversations: []`, `pagination.total` equals `count(users)`, `has_more: false`. |
| AC-61 | Caller's `accounts.status = 0`; General holds a message containing "holiday" | `GET /search?q=holiday` (no scope) | General's messages are not returned (rule §4.3; gap G-2). |
| AC-62 | `SearchMessagesQuery` throws | Any search request | The error is logged with `file`, `line` and `trace`; the response is `{ success: false, message }` with the exception code when it is 4xx or 5xx, otherwise `500`. |
| **v4 — Read Positions and Seen Receipts (§4.5)** | | | |
| AC-63 | Members A (viewer), B (position 120), C (position 0), D (inactive, position 130) | A calls `GET /conversations/{id}/messages` | `read_receipts` is `[{ id: B, name, avatar, last_read_message_id: 120, seen_at, seen_time }]` — A, C and D are absent. |
| AC-64 | A member's position is 120 | `POST /conversations/{id}/read` with `{ message_id: 100 }` | `200`, `last_read_id: 120` (unchanged); no `MessagesRead` event is broadcast. |
| AC-65 | A member's position is 100; messages up to id 130 exist | `POST /conversations/{id}/read` with `{ message_id: 120 }`, sent twice | First: `200`, `last_read_id: 120`, exactly one `MessagesRead` broadcast with `{ reader_id, last_read_id: 120, thread_root_id: null }`. Second: `200`, `last_read_id: 120`, no broadcast. |
| AC-66 | `message_id` omitted | `POST /conversations/{id}/read` | The position becomes the newest message id of the conversation; response `{ success: true, message: "Conversation read position updated", last_read_id, remaining_unread: 0 }`. |
| AC-67 | Caller is not a member of a public channel, an announcement or General | `POST /conversations/{id}/read` | A `conversation_members` row is inserted with `last_read_message_id` set; `200`. For a private channel the caller is not in: `404 { success: false, message: "Conversation not found" }` and no row is inserted. |
| AC-68 | Thread root 50 has replies 60 and 70 | `POST /conversations/{id}/messages/50/read` with `{ reply_id: 60 }`, then with `{ reply_id: 55 }` | First: `200`, `last_read_id: 60`, one `MessagesRead` with `thread_root_id: 50`. Second: `200`, `last_read_id: 60` (id 55 is outside the thread; the target falls back to the root, which is behind 60), no broadcast. |
| AC-69 | Message 999 does not belong to the conversation; or the conversation is not visible | `POST /conversations/{id}/messages/999/read`; same call on a private channel the caller is not in | `404 { success: false, message: "Thread not found" }`; `404 { success: false, message: "Conversation not found" }`. |
| AC-70 | Caller posts reply 80 in thread 50 | `POST /conversations/{id}/messages` with `reply_to_id: 50`, then `GET …/messages/50/replies` | `data.user_last_read_id` is `80`. |
| AC-71 | Thread 50 exists | `GET /conversations/{id}/messages/50/replies` | `200 { success: true, data: { root, replies, user_last_read_id, read_receipts } }`; `read_receipts` hold thread positions, with `seen_at: null` and `seen_time: null`. An unknown root returns `404 { success: false, message: "Thread not found" }`. |
| AC-72 | A sent newest message 130; B's position is 130, C's is 90 | A calls `GET /conversations/{id}/messages/130/seen` | `200 { success: true, message_id: 130, seen_by: [B], seen_count: 1 }`; each entry has `id, name, avatar, last_read_message_id, seen_at, seen_time, job_title, department`. The sender is never listed; the list is most-recently-seen first. An unknown message id returns `404 { success: false, message: "Message not found" }`. |
| AC-73 | Caller has unread messages in several conversations | `POST /mark-all-read` | Every conversation in the caller's visible set has its position set to its newest message id; `UnreadCountUpdated` is broadcast on `user.{id}` with `conversation_id: 0`, `unread_count: 0`; response `{ success: true, message: "All conversations marked as read" }`. |
| AC-74 | Private channel "Execs"; a non-member and a member each subscribe to `private-conversation.{id}` | Broadcast channel authorisation | The non-member is rejected; the member is accepted with `{ id, name }`. The rule is `Conversation::isVisibleTo`, identical to REST. |
| AC-75 | Caller's `accounts.status = 0` | `POST …/messages/{rootId}/read` or `GET …/messages/{id}/seen` on General | `403 { success: false, message: "Your account is inactive. Please contact HR to restore access.", code: "ACCOUNT_INACTIVE" }` (rule §4.3; gap G-1). |
| **v4 — Thread Participants, Attachment Dimensions** | | | |
| AC-76 | Root 50 has replies from B, C, B, D in that order, each created at least one second after the previous | `GET /conversations/{id}/messages` | The root item has `threadCount: 4`, `threadParticipants: [B, C, D]` (each `{ id, name, avatar }`, first reply first, no duplicates), `threadLastReplyUser` equal to D's name. |
| AC-77 | Attachment `{ name, size, type: "video", path, width: 1080, height: 1920 }` | `POST /conversations/{id}/messages` | `data.attachments[0].width` is `1080` and `.height` is `1920`; the same values are returned by the message list, the thread replies, the pinned list and the `MessageSent` broadcast. |
| AC-78 | Attachments with `width` of `0`, `-5`, `20001`, `"abc"`, or absent | `POST /conversations/{id}/messages` | `message_attachments.width` and `.height` are `NULL`; the payload returns `width: null`, `height: null`. |
| **v4 — Channel Rules (§4.7)** | | | |
| AC-79 | General (`is_system = 1`), caller's `role_access` is `3` | `PUT /conversations/{id}` with `{ description: "x" }` | `403 { success: false, message: "Default system channels can only be modified by system administrators." }`. With `role_access` `1` or `2`: `200 { success: true, message: "Channel updated successfully", data }`. |
| AC-80 | Non-system channel with creator X; caller is not X, not a co-admin, `role_access` not `1` or `2` | `PUT /conversations/{id}` | `403 { success: false, message: "Permission denied. Only channel creator, co-admins, or members can manage channel details." }`. As the creator, a co-admin, or `role_access` `1` / `2`: `200`. |
| AC-81 | Channel whose `created_by` is empty | `PUT /conversations/{id}` as a member; as a non-member | `200`; `403` with the message of AC-80. |
| AC-82 | Channel named "Ops" | `PUT /conversations/{id}` with `{ name: "Operations" }`; then `{ name: "Operations" }` again | First: one `messages` row with `system_event` type `channel_renamed` (`old_name: "Ops"`, `new_name: "Operations"`). Second: no new event. A changed `description` records `channel_description_changed`. |
| AC-83 | Public channel, `requires_approval = 0`, caller not a member | `POST /conversations/{id}/join` | `200 { success: true, message: "You have joined #<name>", data }`; one `conversation_members` row with `is_admin = 0`; one `member_joined` event. |
| AC-84 | Channel with `requires_approval = 1`, caller not a member | `POST /conversations/{id}/join`, sent twice | Both: `200`, `requires_approval: true`, `message: "Join request sent. Awaiting channel admin approval."`. Exactly one `channel_join_requests` row with `status = pending`; no member row. |
| AC-85 | Private channel; a direct conversation | `POST /conversations/{id}/join` | `403 { message: "This is a private channel. You must be added by a channel administrator." }`; `400 { message: "Cannot join a direct message." }`. |
| AC-86 | A pending join request exists | Creator or co-admin calls `…/join-requests/{requestId}/approve`; another member calls it | Approve: member row inserted, `member_joined` recorded, `Join request approved.`. Decline: `Join request declined.`. Other member: `403 { message: "Permission denied." }`. Unknown request: `404 { message: "Join request not found." }`. |
| AC-87 | Caller is not a member of a regular channel (not General) | `POST /conversations/{id}/messages` | `403 { success: false, message: "You must join this channel before sending messages." }`; no message row. |
| AC-88 | Announcement channel; caller's `role_access` is `3` and caller is not the creator | `POST /conversations/{id}/messages` | `403 { success: false, message: "Permission denied. Company Announcements is a broadcast-only channel." }`. `role_access` `1`, `2`, `4` or `7` (or the creator): `200` (role set pending Q-2). |
| **v4 — Pinned Messages and System Events (§4.9)** | | | |
| AC-89 | A visible conversation with message 130 | `POST …/messages/130/pin`, twice; on a deleted message | First: `200`, `data.is_pinned: true`, `pinnedAt`, `pinnedBy` set; `MessagePinUpdated` broadcast; `message_pinned` event recorded. Second: `is_pinned: false`, `pinnedAt: null`, `message_unpinned` recorded. Deleted message: `400 { message: "Cannot pin a deleted message" }`. |
| AC-90 | Two pinned and three unpinned messages | `GET /conversations/{id}/pinned` | `200 { success: true, data }` with exactly the two pinned `MessageItem`s. |
| AC-91 | General is a system channel | A membership change would record `member_added`, `member_joined`, `member_left` or `member_removed` | No event row is written. `channel_renamed` and `channel_description_changed` are still recorded. |
| **v4 — Send Validation (v3 §6.2 rules, now testable)** | | | |
| AC-92 | Text is empty or only whitespace and `attachments` is empty | `POST /conversations/{id}/messages` | `422 { success: false, message: "A message needs text or an attachment." }`; no row. Empty text with at least one attachment: `200`. |
| AC-93 | Text of 4,001 characters; text of 4,000 characters | `POST /conversations/{id}/messages` | `422 { success: false, message: "A message cannot exceed 4000 characters." }`; the 4,000-character message: `200`. The composer disables Send while the serialized message (markdown) exceeds 4,000 characters (gap G-17). |
| AC-94 | Body carries `client_id: "c1"`; the same `client_id` is replayed 1 second later by the same sender in the same conversation | `POST /conversations/{id}/messages` twice | Both return `200` with the same `data.id`; one `messages` row; one `MessageSent` broadcast. After 2 seconds a replay creates a new message. |
| **v4 — Mobile: Search (`MessagesSearchModal`)** | | | |
| AC-95 | User taps Search in the bottom bar (or the DM search bar) | Modal opens, user types `report` | `GET /search` is called 300 ms after the last keystroke with `limit: 30`; results show highlighted matches (`HighlightText`) for users, channels and messages; page 2 loads on scroll to the end. No minimum query length: any non-empty text or any active filter fires the request. |
| AC-96 | Search modal is open | User types `#fin`, `in:fin`, `@mar`, `with:mar`, or `from:mar` | A list of at most 8 matching channels (`#`, `in:`) or colleagues (`@`, `with:`, `from:`) appears; private channels appear only when the user is a member. Selecting one converts it into a filter pill and the placeholder becomes `Search in #name...`, `Search in @name...` or `Search from @name...`. |
| AC-97 | A filter pill is set and the input is empty | User presses Backspace; or taps `clear all` | The last pill is removed; `clear all` removes every pill. Chips `during:7d`, `has:file`, `is:pinned` in the idle view add the matching modifier to the query. |
| AC-98 | A search returns no message | Results render | `No messages containing "<q>" match your active filters.`. The last 6 distinct submitted queries are kept in secure storage and shown in the idle view. |
| **v4 — Mobile: Seen Avatars, Thread Preview, Realtime** | | | |
| AC-99 | A conversation page with `read_receipts` for readers B and C | Message list renders | B's avatar sits under the newest loaded message whose id is `<=` B's position; C's likewise. Nothing is placed for a pending, failed or system-event message. A position older than every loaded message places nothing. |
| AC-100 | The newest message at or below B's position was sent by B | Message list renders | No avatar is shown for B on that message. |
| AC-101 | Up to 4 readers sit on one message; 5 or more | Message renders | Up to 4 avatars of 15 px are shown, then a `+N` badge for the rest. Tapping shows `Seen by <first name> • <seen_time>` and hides it after 3.2 s. Long-press opens the message action sheet whose "Seen by" list is loaded from `GET …/seen` (`thread_root_id` sent when inside a thread). |
| AC-102 | B reads the conversation while A is viewing it | `MessagesRead` arrives on `conversation.{id}` | B's avatar moves forward to the newest message at or below `last_read_id` without a reload; an event with an older id than B's current position is ignored; an event from the viewer is ignored. An event with `thread_root_id` moves B only in that thread's list. When B sends a message, B's position is also moved to that message. |
| AC-103 | A thread is open | `ThreadModal` renders root and replies | Seen avatars use that thread's own positions (`read_receipts` of `…/replies` and `MessagesRead` events carrying `thread_root_id`). |
| AC-104 | A root message with 2 distinct repliers; with 6 distinct repliers | Message row renders `MessageThreadPreview` | 2 repliers: 2 avatars. 6 repliers: 4 avatars plus an overflow badge showing the number of repliers not shown (`2+`), displayed as `9+` from 9 upward (gap G-6). Label: `N reply` / `N replies • Last reply <time>`. |
| AC-105 | User is in `ThreadModal` | Checkbox "Also send to #<channel>" (DM: "Also send as a direct message") is ticked and a reply is sent | The request carries `is_thread_broadcast: true`; the checkbox resets to unticked after every send. In the channel the row shows `Also sent to the <channel>` with a `View thread` link. |
| AC-106 | The conversation screen is open | Realtime connection is up | The app is subscribed to `private-conversation.{id}` for `.MessageSent`, `.ReactionUpdated`, `.MessagePinUpdated`, `.UserTyping`, `.MessagesRead`, and to `private-user.{id}` for `.UnreadCountUpdated`. The messaging module runs no polling timer. |
| **v4 — Mobile: No Fabricated Data** | | | |
| AC-107 | Creating a channel fails (network error or any non-2xx response) | User submits `CreateChannelModal` | An error is shown; no channel is added to the list and no section assignment is made. |
| AC-108 | The user has no recent applications in the dashboard data | User opens the attachment drawer's tickets tab | The list is empty with an empty state; no demo ticket (`DEFAULT_HR_TICKETS`) is listed or sendable (gap G-11). |
| **v4 — Access and Integrity Rules** | | | |
| AC-109 | Manager-role channel M (`conversations.role = 'manager'`); caller's `role_access` is `3` and caller is a member | `GET /conversations`; `GET /conversations/{M}/messages`; `POST /conversations/{M}/messages`; `GET /search?q=#<M name> hello` | The list excludes M; `getMessages` returns `200` with `data: []`; `sendMessage` returns `404 { success: false, message: "Conversation not found" }`; the search returns the empty result of AC-56. With `role_access` `1`, `2` or `7`, M is listed and usable (gap G-7). |
| AC-110 | `conversation_members` has no row for (C, A); two `POST /conversations/{C}/read` calls for A run at the same time | Both complete | Exactly one `conversation_members` row exists for (C, A), enforced by the unique index `uq_conversation_members_conv_account`; neither call returns a 5xx (gap G-9). |

---

## 3. Database

v4 adds **no tables and no columns**: every column below already exists in `database/migrations/` (verified 2026-10-13). Per-thread read positions are **not** stored in the database (§3.3). A **new** table follows the SubHRMS rule of no `->foreign()`; the messaging tables created on 2026-06-25 (`database/migrations/table/messages/`) predate that rule, carry real foreign keys, and are left as they are.

### 3.1 Reused Tables

- **`conversations`** (`table/messages/…000001`, extended by `2026_09_11_000001`, `2026_09_12_000002/3`, `2026_09_13_000001`, `alters/messages/2026_09_29_000001`, `…2026_10_04_000001`):
  - `id` (bigint, PK)
  - `name` (string) — channel title or recipient name
  - `type` (enum: `channel`, `dm`, `announcement`; default `channel`) — there is **no** `request` type, and `direct` is a read-side alias of `dm` only (queries use `whereIn('type', ['direct', 'dm'])`)
  - `description` (string, nullable)
  - `role` (string, default `'all'`) — `'manager'` marks a manager-only channel (§6.1 rule 1)
  - `created_by` (bigint, nullable) — **null = system/default channel**
  - `avatar` (string, nullable)
  - `is_private` (boolean, default false)
  - `is_archived` (boolean, default false)
  - `status` (tinyint, default 1) — 0 = disabled
  - `is_system` (boolean, default false, indexed) — §3.2
  - `requires_approval` (boolean, default false) — joining needs a channel admin's approval (§4.7)
  - `created_at`, `updated_at` (timestamps)
- **`conversation_members`** (`table/messages/…000002`, extended by `2026_07_07_000001`, `2026_09_11_000001`):
  - `id` (bigint, PK)
  - `conversation_id` (bigint, indexed, FK → `conversations.id` cascade)
  - `account_id` (bigint, indexed, FK → `accounts.id` cascade)
  - `last_read_message_id` (bigint, nullable, FK → `messages.id` set null) — the member's **conversation-level** read position (main list only)
  - `is_admin` (boolean, default false) — co-admin flag
  - `created_at`, `updated_at` (timestamps) — `updated_at` is the time of the last read-position change and feeds `seen_at` / `seen_time`
  - **No unique index on `(conversation_id, account_id)` exists** — see §10.2 G-9.
- **`messages`** (`table/messages/…000003`, extended by `alters/messages/*` and `2026_09_29_000001_create_custom_mentions_and_add_mentions_to_messages`):
  - `id` (bigint, PK)
  - `conversation_id` (bigint, indexed), `sender_id` (bigint, indexed)
  - `text` (text, nullable) — empty text is stored for attachment-only messages
  - `is_edited`, `is_deleted` (boolean, default false) — soft delete; a deleted message keeps its row
  - `reply_to_id` (bigint, nullable, indexed, FK → `messages.id` set null) — parent message for standard replies and thread replies
  - `is_thread_broadcast` (boolean, default false) — "Also send to channel" (composite index `messages_thread_listing_index` on `conversation_id, reply_to_id, is_thread_broadcast`)
  - `is_pinned` (boolean, default false, indexed), `pinned_at` (timestamp, nullable), `pinned_by` (bigint, nullable, indexed) — composite index `idx_messages_conversation_is_pinned` on `conversation_id, is_pinned`
  - `linked_ticket_id` (string, nullable, indexed), `linked_ticket_type`, `linked_ticket_title`, `linked_ticket_status`, `linked_ticket_status_color` (string, nullable), `linked_ticket_data` (json, nullable)
  - `mentions` (json, nullable) — resolved mention targets (§4.8)
  - `system_event` (json, nullable) — set on channel-event rows (§4.9)
  - `created_at`, `updated_at` (timestamps)
- **`message_attachments`** (`table/messages/…000005`, extended by `alters/messages/2026_10_09_000001`):
  - `id` (bigint, PK)
  - `message_id` (bigint, indexed, FK → `messages.id` cascade)
  - `name`, `size`, `type`, `path` (string) — `size` is the display string (`"2.5 MB"`), not bytes
  - `width`, `height` (unsigned int, nullable) — the media's display size in pixels; null for files and for uploads made before 2026-10-09
  - `created_at`, `updated_at` (timestamps)
- **`message_reactions`**: `id`, `message_id` (FK cascade), `account_id` (FK cascade), `emoji` (string, collation changed by `alters/messages/2026_09_24_000001`), timestamps.
- **`channel_join_requests`** (`alters/messages/2026_10_04_000001`; no foreign keys): `id`, `conversation_id` (indexed), `account_id` (indexed), `status` (enum `pending` / `approved` / `declined`, default `pending`, indexed), `reviewed_by` (bigint, nullable), `reviewed_at` (timestamp, nullable), timestamps; unique index `conv_account_status_unique` on `(conversation_id, account_id, status)`.
- **`channel_sections`** and **`channel_section_items`** (`database/migrations/2026_09_12_000001_create_channel_sections_tables.php`): per-user sidebar groupings of channels — `channel_sections` (`account_id`, `name`, `icon`, `sort_order`, `status` 1 active / 0 deleted) and `channel_section_items` (`channel_section_id`, `conversation_id`, `sort_order`, `status`). Baseline; not redesigned by this ticket.
- **`custom_mentions`** (`2026_09_29_000001_create_custom_mentions_and_add_mentions_to_messages.php`): named mention groups (`status` 1 active); resolved by `ResolveMentionsAction` and listed by `SearchMentionsQuery`. Baseline.

### 3.2 `conversations.is_system` (alter migration — already applied)

**Migration:** `database/migrations/alters/messages/2026_09_29_000001_add_is_system_to_conversations_table.php`.

```php
Schema::table('conversations', function (Blueprint $table) {
    if (! Schema::hasColumn('conversations', 'is_system')) {
        $table->boolean('is_system')->default(false)->after('created_by')->index();
    }
});
// Back-fill: General
DB::table('conversations')->where('type', 'channel')
    ->whereRaw('LOWER(TRIM(name)) = ?', ['general'])
    ->where(fn ($q) => $q->whereNull('created_by')->orWhere('created_by', 0))
    ->update(['is_system' => true]);
```

This is the canonical flag the backend uses to identify system/default channels. Using `created_by IS NULL` alone is fragile because a future admin tool could set `created_by` on General. `is_system = true` is explicit, indexed, and immutable via normal user operations. `Conversation::$casts` carries `'is_system' => 'boolean'`.

**No `conversation_members` rows are created for General membership.** Rows appear only when an employee first reads General (`markConversationAsRead` inserts on first read of a public or system channel).

### 3.3 Cache-held read state (no table)

| Key | Holds | Written by | TTL |
| --- | --- | --- | --- |
| `last_read_{conversationId}_{accountId}` | The member's conversation-level `last_read_message_id` (mirror of the column) | `markConversationAsRead`, `markAllAsRead`; read by `GetConversationsQuery`, `GetMessagesQuery`, `getUnreadCount` | 86,400 s (`Cache::remember`); `Cache::put` without TTL on write |
| `thread_last_read_{threadRootId}_{accountId}` (`GetMessagesQuery::threadReadCacheKey`) | The member's read position **inside one thread** (an id of the root or one of its replies) | `AdvanceThreadReadAction` only; read by `getThreadReplies` and `GetMessagesQuery::readReceiptsFor` | 30 days (2,592,000 s) |
| `lock_thread_last_read_{threadRootId}_{accountId}` | Atomic lock for the compare-and-set | `AdvanceThreadReadAction` | 5 s lock, 3 s wait |
| `typing_{conversationId}_{accountId}` and `typing_{conversationId}_{replyToId}_{accountId}` | Typing presence | `sendTypingEvent`, cleared by `SendMessageHandler` | 5 s |
| `conv_all_members_{conversationId}` | Member ids used by the typing check | `getMessages` | 300 s |

Thread read positions are deliberately **not** a database column or table (Decision 7). Consequence recorded in §6.4: after a cache flush every thread position reads as 0.

---

## 4. Backend

All endpoints live in `routes/api/employee.php` under `Route::prefix('messages')`. That file is loaded from `routes/api.php` inside the `auth:sanctum` group with the `employee` prefix, so every URL below is `/api/employee/messages/...` and every call needs a Sanctum bearer token. Controller: `App\Http\Controllers\employee\MessagesController` (lowercase `employee` namespace, per the SubHRMS portal convention). Success responses carry `success: true`; failures carry `{ "success": false, "message": "<text>" }` with the status codes in §6.2.

### 4.1 Endpoint Inventory (as built, 2026-10-13)

"v4" marks contracts this version specifies in full (acceptance criteria in §2.5). "Baseline" marks behavior that already shipped and is **not** redesigned by this ticket; it is listed so the inventory is complete, and its rules are the ones stated in the Notes column.

| Method | Path (after `/api/employee/messages`) | Controller method | Contract / notes | Scope |
| --- | --- | --- | --- | --- |
| GET | `/unread-count` | `getUnreadCount` | `{ success, unread_count, data: { unread_count } }` — sum over member conversations + `is_system` + announcements; manager-role channels (`role = 'manager'`) are excluded for `role_access` not in `[1, 2, 7]` | Baseline |
| GET | `/conversations` | `getConversations` | `{ success, data: MessageConversation[] }` — shape in §4.2.1 | Baseline |
| GET | `/conversations/{id}` | `getConversation` | One conversation; `404 "Channel not found or you do not have permission to access it."`; guarded (§4.3) | Baseline |
| GET | `/message-detail/{id}` | `getMessage` | `404 "Message not found"`; `403 "Unauthorized to view this message"` | Baseline |
| GET | `/conversations/{id}/messages` | `getMessages` | Query: `since_id`, `before_id`, `around_id` (alias `around`), `limit` (default 25). Returns `{ success, data: MessageItem[], pagination: { has_more, per_page }, has_more, last_read_id, user_last_read_id, reaction_updates, read_receipts, typing: { is_typing, user } }`. `last_read_id` = highest read position among other members; `read_receipts` per §4.5 | v4 |
| POST | `/conversations/{id}/messages` | `sendMessage` | Body: `text`, `reply_to_id` (alias `reply_to`), `is_thread_broadcast` (alias `isThreadBroadcast`), `attachments[]` (`name`, `size`, `type`, `path`, `width?`, `height?`), `linked_ticket` (alias `linkedTicket`), `mentions[]`. Returns `{ success, data: MessageItem }`. Rules in §4.6 | v4 |
| POST | `/conversations/{id}/typing` | `sendTypingEvent` | Broadcasts `UserTyping`; `404 "Conversation not found"` when not visible; guarded | Baseline |
| POST | `/conversations/{id}/read` | `markConversationAsRead` | Body `message_id?`. Forward-only (§4.5). Returns `{ success, message, last_read_id, remaining_unread }` | v4 |
| POST | `/mark-all-read` | `markAllAsRead` | Marks every visible conversation read to its latest message; returns `{ success, message: "All conversations marked as read" }` | v4 |
| GET | `/recipients` | `getRecipients` | Eligible colleagues for New Direct Message and Create Channel | Baseline |
| GET | `/mentions/search` | `searchMentions` | `{ success, data, meta }`; people limited to `accounts.status = 1` (§4.8) | Baseline (v3 rule) |
| GET | `/search` | `searchMessages` | Contract in §4.4 | v4 |
| POST | `/conversations` | `createConversation` | Creates a DM (`type: "dm"`, `recipient_id`) or a channel (`type: "channel"`, `name`, `recipient_ids[]`, `is_private`/`privacy`, `admin_ids[]`); an existing DM with the same colleague is returned, not duplicated | Baseline |
| PUT / POST | `/conversations/{id}` / `/conversations/{id}/manage` | `updateConversation` | Edit name, description, avatar, `is_private`/`privacy`, `requires_approval`; permission rule in §4.7 | v4 |
| POST | `/conversations/{id}/archive` | `archiveConversation` | Toggle archive; only the Lead Admin; default company channels cannot be archived | Baseline |
| DELETE | `/conversations/{id}` | `dropConversation` | Only the Lead Admin or `role_access = 1`; default company channels cannot be dropped | Baseline |
| POST | `/conversations/{id}/join` | `joinChannel` | Rules in §4.7 | v4 |
| GET | `/conversations/{id}/join-requests` | `getJoinRequests` | Pending requests; creator or co-admin only | v4 |
| POST | `/conversations/{id}/join-requests/{requestId}/approve` | `approveJoinRequest` | Creator or co-admin only | v4 |
| POST | `/conversations/{id}/join-requests/{requestId}/decline` | `declineJoinRequest` | Creator or co-admin only | v4 |
| GET | `/conversations/{id}/members` | `getConversationMembers` | System channel returns `{ success: true, is_system: true, member_count, members: [], message: "General is a company-wide channel. All active employees have access." }` | Baseline (v3 rule) |
| POST | `/conversations/{id}/members` | `addConversationMembers` | Creator or co-admin only; `403 "Permission denied. Only channel creator or co-admins can add members."`; `400 "No members selected"` | Baseline |
| DELETE | `/conversations/{id}/members/{memberId}` | `removeConversationMember` | Creator or co-admin removes others; any member removes self; Lead Admin cannot leave without a co-admin; `403 "Member management is disabled for system channels."` | Baseline |
| PUT / POST | `/conversations/{id}/members/{memberId}/role` | `updateMemberRole` | Promote / demote co-admin | Baseline |
| GET | `/employee-profile/{id}` | `getEmployeeProfile` | Colleague profile drawer data | Baseline |
| GET | `/conversations/{conversationId}/pinned` | `getPinnedMessages` | `{ success, data: MessageItem[] }`; guarded | v4 |
| POST | `/conversations/{conversationId}/messages/{messageId}/pin` | `togglePin` | Toggle; rules in §4.9 | v4 |
| GET | `/conversations/{conversationId}/messages/{messageId}/replies` | `getThreadReplies` | Query `original_root`. `{ success, data: { root, replies, user_last_read_id, read_receipts } }`; `404 "Thread not found"` | v4 |
| POST | `/conversations/{conversationId}/messages/{messageId}/read` | `markThreadAsRead` | Thread read position (§4.5) | v4 |
| GET | `/conversations/{conversationId}/messages/{messageId}/seen` | `getMessageSeenReceipts` | Who has seen a message (§4.5) | v4 |
| POST | `/conversations/{conversationId}/messages/{messageId}/reactions` | `toggleReaction` | Body `emoji`; broadcasts `ReactionUpdated`; guarded | Baseline |
| PUT | `/conversations/{conversationId}/messages/{messageId}` | `editMessage` | Own messages only (`403 "You can only edit your own messages"`); `422 "Message text cannot be empty"`; guarded | Baseline |
| DELETE | `/conversations/{conversationId}/messages/{messageId}` | `deleteMessage` | Own messages only (`403 "You can only delete your own messages"`); soft delete (`is_deleted`); guarded | Baseline |
| POST | `/upload` | `uploadAttachment` | multipart `file` (+ `type?`); returns `{ success, data: { name, size, type, path, url } }`; limits in §6.2 and Q-1 | Baseline |
| GET | `/link-preview` | `getLinkPreview` | Query `url`; `GetLinkPreviewQuery` | Baseline |
| POST | `/conversations/{conversationId}/messages/{messageId}/ticket-status` | `updateTicketStatus` | Body `status` (default `Approved`), `status_color`, `reason?`. Sets the linked card's status **and writes the matching HRMS application** (`AppOvertime`, `AppLeave`, `AppOfficialBusinessTrip`, `AppChangeShift`, `AppAdjustment`, matched by `docnumber` or numeric id): approved → `status = 1`, `date_approve`; any other value → `status = 2`, `cancelby`, `cancel_at`, `cancel_reason`. `404 "Conversation not found"` / `"Message not found"`. **No check that the caller is an approver of that application exists** (§10.2 G-3, Q-5) | Baseline |
| GET / POST / DELETE | `/channel-sections`, `/channel-sections/delete`, `/channel-sections/move` | `getChannelSections`, `saveChannelSection`, `deleteChannelSection`, `moveChannelToSection` | Per-user sidebar sections (§3.1) | Baseline |

Route-order note: the literal paths `/conversations/{id}/join-requests`, `/pinned`, `/members` and the `/messages/{messageId}/…` family are registered after `/conversations/{id}`; no two routes share a method + shape, so no route shadows another.

### 4.2 Query, Handler, Action and Event Classes (as built)

| Kind | Class (`App\…`) | Responsibility |
| --- | --- | --- |
| Query | `Queries\Messages\GetConversationsQuery` | Conversation list: last message, unread counts (one `CASE WHEN` query), other members' max read id, pending join requests |
| Query | `Queries\Messages\GetMessagesQuery` | Message page + `formatMessage()`, `formatAttachments()`, `threadStatsFor()`, `readReceiptsFor()`, `seenByFor()`, `threadReadCacheKey()`, `resolveAvatarUrl()` |
| Query | `Queries\Messages\GetThreadRepliesQuery` | Thread root + replies + thread-scoped `read_receipts` |
| Query | `Queries\Messages\GetPinnedMessagesQuery` | Pinned messages of one conversation |
| Query | `Queries\Messages\SearchMessagesQuery` | Message / colleague / channel search with modifiers (§4.4) |
| Query | `Queries\Messages\SearchMentionsQuery` | `@` picker: people (active only), positions, units, `@all` / `@here` / `@channel`, custom mentions |
| Query | `Queries\Messages\GetLinkPreviewQuery`, `GetChannelSectionsQuery` | Baseline |
| Handler | `Handlers\Messages\SendMessageHandler` | Visibility + posting rules, mention resolution, persistence, attachment rows (with dimensions), `MessageSent` / `UnreadCountUpdated` broadcasts, sender's own thread read position |
| Handler | `Handlers\Messages\EditMessageHandler`, `DeleteMessageHandler`, `ToggleReactionHandler`, `TogglePinMessageHandler`, `UploadAttachmentHandler` | One write each |
| Handler | `Handlers\Messages\SaveChannelSectionHandler`, `DeleteChannelSectionHandler`, `MoveChannelToSectionHandler` | Baseline |
| Action | `Actions\Messages\GeneralAccessAction` | System-channel guard (§4.3) |
| Action | `Actions\Messages\AdvanceThreadReadAction` | Locked, forward-only thread read position (§4.5) |
| Action | `Actions\Messages\ResolveMentionsAction` | Resolves mention targets from request + text; `formatForViewer()` adds `is_targeted` |
| Action | `Actions\Messages\RecordSystemEventAction` | Writes and broadcasts channel-event rows (§4.9) |
| Event | `Events\Messages\MessageSent`, `MessagesRead`, `ReactionUpdated`, `UserTyping`, `MessagePinUpdated` | Broadcast on private channel `conversation.{id}` under the same short name (`broadcastAs`) |
| Event | `Events\Messages\UnreadCountUpdated` | Broadcast on private channel `user.{id}` |

#### 4.2.1 `MessageConversation` (list item) — keys

`id`, `name`, `type`, `isDefault`, `is_system`, `isMember` / `is_member`, `requires_approval` / `requiresApproval`, `has_pending_join_request` / `hasPendingJoinRequest`, `pending_requests_count` / `pendingRequestsCount`, `created_by`, `isPrivate` / `is_private`, `isArchived` / `is_archived`, `status`, `adminIds`, `memberIds`, `avatar`, `lastMessage`, `lastAttachmentType`, `lastMessageSent`, `lastMessageRead`, `isThreadReply` / `lastMessageIsThread` / `last_message_is_thread`, `lastMessageThreadRootId`, `time`, `unread`, `unreadCount`, `last_read_message_id`, `online`, `description`, `jobTitle`, `department`, `role`, `isAdmin` / `isCurrentUserAdmin`, `other_user_id`, `other_user_name`, `other_user_avatar`, `lastMessageTimestamp`. camelCase and snake_case duplicates are intentional aliases that existing clients read.

#### 4.2.2 `MessageItem` — keys

`id`, `text`, `isSent`, `isDeleted`, `sender`, `senderId`, `senderAvatar`, `time`, `created_at`, `edited`, `read`, `reply_to_id`, `replyTo` (`id`, `text`, `sender`, `senderAvatar`), `replyToIsRoot`, `reactions`, `attachments` (§4.6), `linkedTicket` / `linked_ticket`, `mentions` (each with `is_targeted`), `isUserTargeted`, `system_event`, `isSystemEvent`, `threadCount`, `threadLastReplyAt`, `threadLastReplyUser`, `threadLastReplyAvatar`, `threadParticipants` (`[{ id, name, avatar }]`, distinct repliers, first reply first), `threadRootId`, `isThreadBroadcast`, `is_pinned` / `isPinned`, `pinnedAt`, `pinnedBy`.

### 4.3 `App\Actions\Messages\GeneralAccessAction` (System-Channel Guard)

**File:** `app/Actions/Messages/GeneralAccessAction.php` (exists). It encapsulates the single access rule for system / default channels:

```php
public static function check(Conversation $conversation, $user): bool   // true unless is_system && accounts.status != 1
public static function denyResponse(): array                          // { success:false, message:'Your account is inactive. Please contact HR to restore access.', code:'ACCOUNT_INACTIVE' }
public static function guard(Conversation $conversation, $user): ?JsonResponse   // null when allowed, else the 403 response
```

The controller wraps it in `private checkSystemChannelAccess($conversationId)`: it returns `401 { success:false, message:"Unauthenticated" }` with no user, `null` when the conversation does not exist (downstream code answers) or the user is allowed, and otherwise the `403` above. Every call site is `if ($denied = $this->checkSystemChannelAccess($id)) return $denied;` placed before any Query / Handler runs.

**Rule (binding, unchanged from v3):** every endpoint scoped to one conversation, and every search that can return a system channel's messages, rejects an inactive account (`accounts.status != 1`) on a system channel with `403 ACCOUNT_INACTIVE`.

Endpoints that carry the guard today: `getConversation`, `getMessages`, `markConversationAsRead`, `sendTypingEvent`, `sendMessage`, `getThreadReplies`, `toggleReaction`, `togglePin`, `getPinnedMessages`, `editMessage`, `deleteMessage`.

Endpoints that must carry it and do not (tracked in §10.2): `markThreadAsRead` (G-1), `getMessageSeenReceipts` (G-1), `getMessage` (G-1), `updateTicketStatus` (G-1), and the unscoped branch of `searchMessages` (G-2).

Endpoints deliberately outside the guard:
- `getConversations` — General appears in the list for every authenticated employee; opening it is what the guard blocks.
- `getConversationMembers` — short-circuits for system channels and returns the placeholder shown in §4.1.
- `uploadAttachment` — takes no conversation id. (v3 listed it as guarded "via conversation context"; there is no such context. The upload is harmless on its own, and the file only reaches a conversation through `sendMessage`, which is guarded. Spec correction, Minor.)

**`GetConversationsQuery`:** `is_system` is `(bool) ($conv->is_system ?? $isDefault)`; `isDefault` stays for existing clients.

**`SearchMentionsQuery`:** people are filtered to `accounts.status = 1` on every channel; special mentions `@all`, `@here`, `@channel` are offered only outside direct conversations, with the subtitle `Notify all active HRMS employees` (system channel) or `Notify all members of this conversation` / `Notify online & active colleagues` / `Notify all channel subscribers` (other conversations).

### 4.4 Message Search — `GET /api/employee/messages/search`

**Query class:** `App\Queries\Messages\SearchMessagesQuery::execute(array $params)`. Search is `LIKE`-based on `messages.text`; `Laravel\Scout` is **not** used (the `Searchable` trait was removed from `Message` on 2026-10-09, `07103890`).

**Parameters:**

| Param | Type | Rule |
| --- | --- | --- |
| `q` (alias `query`) | string | The raw text. Modifiers (below) are extracted from it; what remains is the search text |
| `channel` (aliases `channel_name`, `user`, `colleague`) | string | Explicit scope: a leading `@` or the `user` / `colleague` aliases mean a direct conversation; otherwise a channel name |
| `conversation_id` | int | Explicit scope by id (used when no channel name is given) |
| `has_file` (aliases `has_files`, `attachment`), `is_pinned` (alias `pinned`), `days`, `sender_id`, `from` | — | Explicit forms of the modifiers below |
| `mode` | `direct` | Colleague-directory mode (§AC-60) |
| `type` | `direct` | Restricts the searched conversations to direct ones |
| `limit` | int | Default 20, clamped to 1–100 |
| `page` | int | Default 1, minimum 1 |

**Modifiers inside `q`** (case-insensitive, removed from the search text; combine with AND):

| Modifier | Effect |
| --- | --- |
| `has:file` (also `has:attachment`, `has:files`, `has:attachments`) | Only messages with at least one attachment |
| `is:pinned` (also `has:pin`) | Only pinned messages |
| `during:<N>d` | Only messages created in the last N days |
| `from:<name>` or `from:@<name>` | Only messages from the active account whose first name, last name or full name (either order; `-` and `_` read as a space; spaces optional) equals the value |
| `in:<channel>` or `in:#<channel>` | Scope to the channel with that name (case-insensitive; `-`, `_` and spaces interchangeable) |
| `with:<name>` or `with:@<name>` | Scope to the caller's direct conversation with the active colleague of that name |
| Leading `#<channel> …` | Same as `in:` |
| Leading `@<name> …` | Same as `with:` |

**Scope resolution:**
- A `#name` that matches no channel falls back to a colleague of that name (direct conversation).
- A system channel is authorised only for `accounts.status = 1`; an announcement or public channel for everyone; a private channel or a direct conversation only for its members.
- A scope that does not exist, or that the caller may not read, returns the **empty result** below — never `403` / `404` — so the response does not confirm that a private channel exists.
- With no scope, the searched conversations are: those the caller is a member of, plus system channels and announcements that are not disabled (`status != 0`). With `type=direct` / `mode=direct`: the caller's direct conversations only.
- Messages with `is_deleted = true` or the text `This message was deleted.` / `You deleted this message` are never returned. Results are ordered newest first (`id` descending).

**Response (200):**

```json
{
  "success": true,
  "data": [ /* same array as messages */ ],
  "messages": [{
    "id": 0, "conversation_id": 0, "conversation_name": "", "conversation_type": "channel|dm|announcement|direct",
    "text": "", "sender": "Maria Santos | You", "sender_id": 0, "sender_avatar": null, "is_self": false,
    "time": "g:i A | Yesterday g:i A | M j, g:i A", "created_at": "ISO-8601",
    "reply_to_id": null, "is_thread_broadcast": false, "attachments_count": 0, "is_pinned": false
  }],
  "users": [{ "id": 0, "name": "", "fname": "", "lname": "", "nickname": "", "jobTitle": "", "position": "", "department": "", "unit": "", "avatar": null, "is_self": false, "conversation_id": null }],
  "conversations": [{ "id": 0, "name": "", "type": "", "is_private": false, "is_member": false, "description": "" }],
  "channel": null,
  "pagination": { "current_page": 1, "per_page": 20, "total": 0, "has_more": false }
}
```

- `channel` is `{ id, name, type, is_private, avatar, description }` when a scope resolved and the caller may read it (a direct conversation reports `type: "direct"`, the colleague's name and avatar, `is_private: true`); otherwise `null`.
- `users` (up to 30 active colleagues matching name, nickname, position or unit) and `conversations` (up to 15 non-private channels / announcements / groups matching name or description) are filled **only** on page 1 of an unscoped, unfiltered search with a non-empty text.
- An empty text with no modifier, scope or filter returns the empty result: `messages`, `users`, `conversations` = `[]`, `channel` = `null`, `pagination.total` = 0.
- Failures are logged (`file`, `line`, `trace`) and answered `{ success: false, message }` with the exception code when it is 4xx / 5xx, otherwise 500.

**Unit tests:** `tests/Unit/SearchMessagesSyntaxTest.php` has 10 tests, but they run against a copy of the parsing logic written inside the test (`parseSyntax()`), not against `SearchMessagesQuery`, so they do not fail if the query changes (gap G-16). Scope resolution, the read-state endpoints and the guard have no automated test today (§11).

### 4.5 Read Positions and Seen Receipts

**Two kinds of read position:**
1. **Conversation position** — `conversation_members.last_read_message_id` (mirrored in cache `last_read_{conv}_{account}`): the newest message of the main list the member has read.
2. **Thread position** — one per member per thread, in cache only (§3.3): the newest root-or-reply id the member has seen inside that thread. A thread's position is independent of the conversation position.

**Both only ever move forward.**

`POST /conversations/{id}/read` (`markConversationAsRead`) — body `{ message_id? }`:
1. `404 { success:false, message:"Conversation not found" }` when the conversation does not exist or `Conversation::isVisibleTo` is false (a private channel the caller is not in).
2. Guard §4.3.
3. A member advances with **one conditional UPDATE** (`last_read_message_id IS NULL OR < target`); an overlapping, repeated or out-of-order request cannot move it back. A non-member of a public channel, announcement or system channel gets a row inserted on first read (`updateOrInsert`).
4. The target is the newest message of the conversation with `id <= message_id`, or the newest message when `message_id` is absent or matches none.
5. `remaining_unread` counts messages from other senders after the position that are main-list messages (`reply_to_id IS NULL` or `is_thread_broadcast = 1`) and not deleted.
6. `UnreadCountUpdated` is broadcast to `user.{id}` always; `MessagesRead` (below) **only when the position advanced**.
7. Response `{ success:true, message:"Conversation read position updated", last_read_id, remaining_unread }`.

`POST /conversations/{conversationId}/messages/{messageId}/read` (`markThreadAsRead`) — `{messageId}` is the thread **root** id; body `{ reply_id? }` (alias `message_id`):
1. `404 "Conversation not found"` when not visible; `404 "Thread not found"` when the root is not a message of that conversation.
2. The target is the newest message in the thread (root or a reply with `reply_to_id = root`) with `id <= reply_id`, else the newest reply, else the root. An id outside the thread is never stored.
3. `AdvanceThreadReadAction` advances atomically (lock `lock_thread_last_read_{root}_{account}`, 5 s lock, 3 s wait) and returns `{ advanced, last_read_id }`.
4. `MessagesRead` with `thread_root_id` is broadcast only when `advanced`.
5. Response `{ success:true, message:"Thread read position updated", last_read_id }`.
6. The **sender** of a thread reply has that thread's position advanced to the reply by `SendMessageHandler` (a sender has read their own reply).

**Seen receipts in lists:** `getMessages` returns `read_receipts`, and `getThreadReplies` returns `data.read_receipts` (thread positions). Both come from `GetMessagesQuery::readReceiptsFor(conversationId, viewerId, threadRootId?)`, **one batched query per page** (conversation positions) plus one `Cache::many` (thread positions). Each element:

```json
{ "id": 0, "name": "", "avatar": null, "last_read_message_id": 0, "seen_at": "ISO-8601|null", "seen_time": "g:i A|null" }
```

Included: members of the conversation, **active accounts only** (`accounts.status = 1`), **never the viewer**, and only those whose position is greater than 0. `seen_at` / `seen_time` are filled for conversation positions (from `conversation_members.updated_at`) and are `null` for thread positions. The client places each reader's avatar on the newest loaded message whose id is `<= last_read_message_id`.

`GET /conversations/{conversationId}/messages/{messageId}/seen` (`getMessageSeenReceipts`) — optional query `thread_root_id` (ignored unless the message is that root or one of its replies):
1. `404 "Conversation not found"` when not visible; `404 "Message not found"` when the message is not in that conversation.
2. `seen_by` = the `readReceiptsFor` readers whose position is `>= messageId`, excluding the message's sender, most recently seen first, each with `job_title` and `department` from `vw_accounts_details` (null when the view is absent).
3. Response `{ success:true, message_id, seen_by, seen_count }`. On the newest message this list is exactly the readers whose avatars sit under it.

**Realtime event `MessagesRead`** (private channel `conversation.{conversationId}`, name `MessagesRead`): `{ conversation_id, reader_id, reader_name, reader_avatar, last_read_id, seen_at, seen_time, thread_root_id }`. A broadcast failure is logged (`Log::warning`) and never fails the read.

**Channel authorisation** (`routes/channels.php`): `conversation.{conversationId}` is accepted only when `Conversation::isVisibleTo($conversationId, $user)`; it returns `{ id, name }` for presence. This is the same rule as the REST API, so a private channel's live feed (messages and read positions) is members-only. `user.{userId}` is accepted only for the same account. Both are registered on the `pusher` and `reverb` connections.

**`markAllAsRead`:** for every conversation in `Conversation::visibleTo($user)`, sets the position to the conversation's newest message id (insert-or-update, cache mirrored), then broadcasts `UnreadCountUpdated` with `conversation_id = 0`, `unread_count = 0`. It does not broadcast `MessagesRead` and does not touch thread positions.

### 4.6 Sending Messages and Attachments

`SendMessageHandler::execute` order of checks: `401` unauthenticated → `400 "Conversation ID is required"` → `404 "Conversation not found"` (not visible; a 404, not a 403, so the id's existence is not confirmed) → announcement rule → join rule → persist.

- **Announcement** (`type = 'announcement'` or name `Company Announcements`): only `role_access` in `[1, 2, 4, 7]` or the conversation's creator may post; otherwise `403 "Permission denied. Company Announcements is a broadcast-only channel."` (see Q-2).
- **Channel join rule:** in a `channel` that is not a system channel and not named General, a non-member gets `403 "You must join this channel before sending messages."`.
- A reply sets `reply_to_id`; `is_thread_broadcast` is stored only when `reply_to_id` is set, otherwise forced to `false`.
- Mentions are resolved by `ResolveMentionsAction` from `mentions[]` and the text, and stored in `messages.mentions`.
- **Attachment rows:** one `message_attachments` row per `attachments[]` entry with `width` / `height` stored only when they are whole numbers from 1 to 20,000, else `null` (`SendMessageHandler::mediaDimension`).
- **One attachment payload:** `GetMessagesQuery::formatAttachments()` is the only producer of the attachment array — message lists, threads, pinned messages, the send response and the `MessageSent` broadcast all use it. Shape: `{ id, name, size, type, path, url, width, height }`, `url` being `path` when it already starts with `http`, else `asset(path)`.
- After the commit: `MessageSent` is broadcast on `conversation.{id}`, `UnreadCountUpdated` to the sender and to each recipient on `user.{id}`; the sender's typing state is cleared and a `UserTyping` (stopped) event sent.

### 4.7 Channel Management Rules

**Edit (`updateConversation`, `PUT /conversations/{id}` and `POST /conversations/{id}/manage`):**
- A **system channel** (`is_system`, id 1, or name General) may be edited only by `role_access` in `[1, 2]`; otherwise `403 "Default system channels can only be modified by system administrators."`
- Any other channel may be edited by: its creator, a co-admin (`conversation_members.is_admin`), `role_access` in `[1, 2]`, or **any member when the channel has no creator** (`created_by` empty); otherwise `403 "Permission denied. Only channel creator, co-admins, or members can manage channel details."`
- Editable fields: `name` (trimmed, only when filled), `description`, `avatar`, `is_private` (or `privacy: "private"`), `requires_approval` (or `requiresApproval`).
- A changed name records the system event `channel_renamed` (`old_name`, `new_name`); a changed description records `channel_description_changed` (`old_description`, `new_description`).
- `404 "Conversation not found"` for an unknown id.

**Join (`joinChannel`):** `404 "Channel not found"`; a private channel → `403 "This is a private channel. You must be added by a channel administrator."`; a direct message → `Cannot join a direct message.`; a channel with `requires_approval = true` creates one `pending` `channel_join_requests` row (an existing pending request is reused) and answers `{ requires_approval: true, message: "Join request sent. Awaiting channel admin approval." }`; otherwise the caller becomes a member (`is_admin = 0`), the `member_joined` system event is recorded, and the answer is `{ message: "You have joined #<name>" }`.

**Approve / decline:** only the creator or a member with `is_admin = 1`; otherwise `403 "Permission denied."`; an unknown request → `404 "Join request not found."`. Approval inserts the member row and records `member_joined`; answers `Join request approved.` / `Join request declined.`.

### 4.8 Mentions

- `ResolveMentionsAction::execute` resolves targets from the request's `mentions[]` and from `@name` tokens in the text: employees (`AccountDetailVW`, `status != 0`), positions, units, `custom_mentions` (`status = 1`), and the specials `@all`, `@here`, `@channel`.
- `formatForViewer()` adds `is_targeted` per mention for the viewing account: true for a `user` mention of that account, true when the account is in `user_ids`, and, for an `@all` / `@here` / `@channel` mention, **true for every viewer the message is returned to**. A message is returned only to accounts that may read the conversation (§4.3, §4.5), so the audience is never expanded into a list of accounts.
- `SearchMentionsQuery` (`GET /mentions/search`): `403 "Access denied to conversation"` when a `conversation_id` is given that the caller cannot read; people are `AccountDetailVW::where('status', 1)`.

### 4.9 Pinned Messages and System Events

- **Pin** (`togglePin` → `TogglePinMessageHandler`): `404 "Conversation not found"` (not visible); `404 "Message not found"`; `400 "Cannot pin a deleted message"`; otherwise toggles `is_pinned`, sets `pinned_at` / `pinned_by` (both cleared on unpin), broadcasts `MessagePinUpdated` (`conversation_id`, `message_id`, `is_pinned`, `pinned_at`, `pinned_by`, message payload), records the system event `message_pinned` / `message_unpinned`, and returns the `MessageItem`. Any account that can see the conversation may pin (Q-4).
- **System events** (`RecordSystemEventAction`): `event_type` is one of `member_added`, `member_joined`, `member_left`, `member_removed`, `channel_created`, `channel_renamed`, `channel_description_changed`, `channel_archived`, `channel_unarchived`, `message_pinned`, `message_unpinned`. The action stores a `messages` row with `system_event` JSON and broadcasts it as `MessageSent`. For system channels it records **no** membership events (`member_added`, `member_joined`, `member_left`, `member_removed`). `MessageItem.isSystemEvent` is true when `system_event` is set.

---

## 5. Frontend Design System & Architecture

The implementation resides in `resources/views/mobapp/` — **its own git repository** (`hrms-react-native`, branch `T00001`, gitignored from this repo), React Native 0.86 / Expo SDK 57 (`expo ~57.0.20`, `react 19.2.3`), TypeScript strict. The Expo versioned docs for SDK 57 are the reference for any Expo API (`mobapp/AGENTS.md`). The module lives in `src/module/employee/messages/`.

### 5.1 Shopify Restyle Theme Foundation (Unified Design System)

All messaging screens use the Restyle theme in `src/theme/index.ts` (`restyleTheme` light, `restyleDarkTheme` dark). **Token names are the contract; their hex values live only in that file** — v3 listed values that the brand-palette change of 2026-10-03 / 2026-10-09 replaced (for example `background` is now `#FCFBF8` light / `#0F172A` dark), so this spec no longer copies them. Required tokens:

- **Colors:** `background`, `surface`, `card`, `cardAlt`, `cardBorder`, `border`, `primary` / `chestnutAccent` (Employee Portal Golden Chestnut: `#CB793A` light, `#E2A35A` dark), `primaryBg`, `info`, `infoBg`, `cyanAccent`, `textHeading`, `text`, `textSecondary`, `textMuted`, `danger`, `dangerBg`.
- **Mention colors** are literal constants in `components/MessageContent.tsx` (`mentionColors`): the viewer's own mention `#CB793A` (light) / `#E2A35A` (dark); another colleague `#0284C7` (light) / `#38BDF8` (dark); both bold (`fontWeight: 700`), no background.
- **Typography:** header `26px / 700`; sender title `15px / 600`; body `14px / 400 (lineHeight 20)`; caption / timestamps `12px / 500`; badges `11px / 600`.
- **Spacing and radii:** spacing `xs 4`, `s 8`, `sm 10`, `m 16`, `ml 20`, `l 24`, `xl 32`; radii `xs 4`, `s 8`, `m 12`, `xl 16`, `full 9999`.
- **Avatars:** `28px` inline message, `36px` header / thread, `46px` conversation list, `56px` hero / profile, `15px` seen avatars. Minimum touch target `48px` for interactive buttons.
- Dark / light contrast and accessibility fixes are tracked in [design-review.md](design-review.md).

---

### 5.2 Module Architecture & File Map (as built, 2026-10-13)

```text
resources/views/mobapp/src/
├── app/(app)/
│   ├── (tabs)/messages.tsx            ← redirects to /(app)/messages
│   ├── messages/{_layout,index,conversation,more,requests}.tsx   ← routes (slide_from_right)
│   └── conversation.tsx, requests.tsx ← legacy routes, still present
└── module/employee/messages/
    ├── index.ts, types.ts             ← barrel, TypeScript interfaces (incl. MessageReadReceipt)
    ├── contexts/MessagesContext.tsx   ← inbox state, unread sync; subscribes private user.{id} .UnreadCountUpdated
    ├── hooks/
    │   ├── useChatRoom.ts             ← active conversation: reducer, pagination, optimistic sends, realtime events, read receipts, typing
    │   ├── useChatKeyboard.ts         ← composer lift and keyboard/drawer swap (shared by ConversationScreen and ThreadModal)
    │   ├── useAudioRecorder.ts        ← expo-audio recording, metering waveform
    │   └── useMessages.ts             ← 7-line re-export of MessagesContext
    ├── services/messages.api.ts       ← the API layer (every endpoint in §4.1); no mock store
    ├── utils/
    │   ├── messagePreview.ts          ← formatLatestMessagePreview
    │   ├── mentionParser.ts           ← segment parser for @mentions, URLs, message deep links
    │   ├── markdownFormatter.ts       ← composer markdown parse / serialize
    │   ├── messageGrouping.ts         ← consecutive-message grouping (5 min default)
    │   ├── readReceipts.ts            ← mergeReadReceipts (forward-only), placeSeenReaders
    │   └── keyboardHeightCache.ts     ← shared keyboard height (breaks a require cycle)
    ├── components/
    │   │   // Landing
    │   ├── DedicatedMessagesHeader.tsx, MessageFab.tsx (bottom bar), MessagesSearchBar.tsx (idle tap-target), ActiveStoriesRow.tsx, ConversationListItem.tsx
    │   │   // Flows and modals
    │   ├── NewChatModal.tsx, CreateChannelModal.tsx (alias CreateGroupModal), ManageChannelModal.tsx, CustomizeGroupModal.tsx, MoveChannelSectionModal.tsx (ChannelHoldModal), ArchivedChannelsModal.tsx
    │   ├── AnnouncementHoldModal.tsx, DirectMessageHoldModal.tsx, ForwardMessageModal.tsx, MessageActionModal.tsx
    │   ├── ColleagueProfileDrawer.tsx, GroupDetailsDrawer.tsx
    │   │   // Message component system
    │   ├── MessageRow.tsx, MessageHeader.tsx, MessageAvatar.tsx, UserAvatar.tsx, MessageContent.tsx, HighlightText.tsx
    │   ├── MessageAttachment.tsx, ImageViewerModal.tsx, VideoPlayerModal.tsx, InlineChatVideo.tsx, ChatAudioBubble.tsx
    │   ├── MessageReaction.tsx, MessageThreadPreview.tsx, MessageSeenReceipt.tsx, SystemEventRow.tsx
    │   ├── LinkPreviewCard.tsx, MessageQuoteCard.tsx, ChatDateDivider.tsx, NewMessagesDivider.tsx, ChatStreamSkeleton.tsx, ChatHeader.tsx
    │   │   // Composer
    │   ├── ChatInputBar.tsx           ← wrapper: tools drawer, mention picker, reply / edit / attachment previews
    │   ├── MessageInputBar.tsx        ← the editor, incl. the voice-recording state (timer, waveform, cancel, send)
    │   ├── ChatToolsDrawer.tsx, EmojiPickerPanel.tsx, GifPickerPanel.tsx, MentionPickerPanel.tsx, RichTextFormatToolbar.tsx
    │   │   // Search
    │   └── MessagesSearchModal.tsx    ← full-screen scoped search
    └── pages/
        ├── MessagesScreen.tsx         ← landing inbox (Home / Direct Message tabs, filter chips, bottom bar)
        ├── MessagesMoreScreen.tsx     ← full-screen More view
        ├── MessageRequestsScreen.tsx  ← requests list
        └── ConversationScreen.tsx     ← chat room; hosts the ThreadModal (components/ThreadModal.tsx)
```

`components/ThreadModal.tsx` (a React Native `Modal`) replaces the planned `pages/ThreadScreen.tsx` and `hooks/useThread.ts`; thread state lives in `ConversationScreen` (`activeThreadMessage`, `threadRepliesMap`) and `useChatRoom` (thread receipts, typing, reply callbacks). Decision 11.

HTTP client: `src/app/axios/http.ts` (`http.get(url, params)` accepts either `{ params }` or flat params). Realtime: `getEcho()` from `@/services/realtime/echo` (Reverb or Pusher, switched by `EXPO_PUBLIC_BROADCAST_CONNECTION`).

---

### 5.3 Detailed Screen Specifications

#### 1. Messages Landing Screen (`MessagesScreen.tsx`)
- **Header** (`DedicatedMessagesHeader`): Chats title, subtitle, online member count, unread counter, search and `⋮ More` buttons.
- **Bottom bar** (`MessageFab`): `Home`, `Direct Message`, `AI`, `Search`, `More`.
- **Home tab** filter chips: `All`, `Channels`, `Groups`, `Announcements`, `Unread` (with count). **Direct Message tab** chips: `All`, `Unread`, `Online`, `Pinned`, `Requests` (with count).
- **Search**: `MessagesSearchBar` is a tap target (`Search conversations, channels, or people...`) that opens `MessagesSearchModal` (§5.3.10).
- **Stories presence reel** (`ActiveStoriesRow`): horizontal list of active colleagues from `GET /recipients`.
- **List**: virtualized `ConversationListItem` with pull-to-refresh; long-press opens `ChannelHoldModal`, `DirectMessageHoldModal` or `AnnouncementHoldModal`.
- Direct conversations with no message history are not listed.

#### 2. More Screen (`MessagesMoreScreen.tsx`)
- Opened by `⋮ More` or the More tab; also routed at `/(app)/messages/more`.
- Items: `Create Channel`, `New Direct Message`, `Message Requests`, `Archived Channels`, `AI HR Assistant`, `Mark All as Read` (asks for confirmation, then `POST /mark-all-read`).

#### 3. Conversation List Items & Previews
- **Avatar**: 46px round image with an online status dot for colleagues.
- **Title row**: recipient or channel name (bold if unread), pin icon, timestamp.
- **Preview row**: delivery ticks (single = sent, double = read); the snippet from `formatLatestMessagePreview()` (`text`; image → `Sent a photo`; video → `Sent a video`; audio → `Sent a voice message`; file → `Sent a file`; none → `No messages yet`); unread count pill in the primary gradient.

#### 4. New Chat Flow (`NewChatModal.tsx`)
- Search input with instant filtering over `GET /recipients`; rows show name, department, role, presence. Tapping a colleague opens the existing conversation if one exists, else `POST /conversations` with `type: "dm"`.

#### 5. Create Channel Flow (`CreateChannelModal.tsx`)
- One form: channel name, optional description, public or private, member picker with search and removable chips, a Co-Admin toggle per member. Submit calls `POST /conversations` (`type: "channel"`, `name`, `recipient_ids`, `is_private`, `admin_ids`) and opens the new channel; private channels are filed under a `🔒 Private Channels` section. On failure an error is shown and nothing is created (AC-107).

#### 6. Message Requests Flow (`MessageRequestsScreen.tsx`)
- Reached from More; also the `Requests` chip on the Direct Message tab. Lists requests with `Accept` and `Decline`. **Both actions are local-only today** (no API call; decline sets `is_archived` in memory) — gap G-4, question Q-7.

#### 7. Slack-Inspired Conversation Screen (`ConversationScreen.tsx`)
- **Header** (`ChatHeader`): back arrow, avatar, title, member count / online status, tools.
- **Stream**: left-aligned open feed with a 28px avatar gutter; `MessageHeader` (name, department tag, time, edited marker, failure icon); consecutive messages from the same sender within 5 minutes (`messageGrouping.ts`, env `EXPO_PUBLIC_MESSAGE_GROUPING_WINDOW_MINUTES`) hide avatar and header, and grouping also breaks on a different sender, a system message, a reply quote or a new calendar day; day dividers; a `NEW MESSAGES` divider; `SystemEventRow` for channel events (created, renamed, description changed, archived, unarchived, member added / joined / left / removed / promoted / demoted, message pinned / unpinned — a pin event is tappable and scrolls to the pinned message).
- Linked HRMS tickets render as cards; reactions dock under the content; the first URL in a message renders a `LinkPreviewCard`; a pasted message deep link renders a `MessageQuoteCard`.
- **Non-member of a joinable channel**: the composer is replaced by a CTA — `Join Channel`, `Request to Join` (channel requires approval) or `Pending Approval` — with the hint `You are previewing this channel. Join to start chatting and sending messages.`
- **Inactive account on General**: the stream and composer are replaced by the `Account Inactive` banner (AC-35).
- **Announcements**: the composer is replaced by the notice of AC-27.

#### 8. Message Composer (`ChatInputBar.tsx` over `MessageInputBar.tsx`)
- **Resting state**: auto-expanding multiline input (scroll area max height 140px once expanded); `+` opens `ChatToolsDrawer` (media, document, HR tickets, templates, emoji, GIF); smiley opens the emoji tab (categories and a Recent tab, inserts at the cursor); mic when the text is empty, `Send` when it is not; a formatting toolbar (`RichTextFormatToolbar`: bold, italic, underline, strikethrough, link, numbered list, bullet list, quote, inline code, code block).
- **Mentions**: typing `@` opens `MentionPickerPanel` (250 ms debounce, `GET /mentions/search`); picking inserts `@Name `.
- **Reply / edit / attachment previews** sit above the input with a remove button.
- **Voice recording**: tapping the mic swaps the composer into the recording state (inside `MessageInputBar`): red record dot, `MM:SS` timer, 28-bar metering waveform, Trash (cancel: stops and deletes the file) and Send (uploads via `POST /upload`, then sends). Recordings under 300 ms are dropped.
- Media picked from the device is sent with its display `width` and `height` (§4.6).

#### 9. Threads (`ThreadModal.tsx`, `MessageThreadPreview.tsx`)
- **Trigger**: the message action sheet's `Thread`, or the `MessageThreadPreview` under a root message (`N reply` / `N replies • Last reply <time>`, replier avatars per AC-104).
- **Modal**: slide-in `Modal` (page sheet on iOS, full-screen overlay on Android). Header `Thread` plus `#channel` or the DM name, `N reply/replies`, the typing line `X is typing...`, the empty text `No replies in this thread yet. Send a message below to start the discussion.`; the pinned root, the chronological replies, a `ChatInputBar` composer (`Add a reply...`) and the `Also send to #<channel>` / `Also send as a direct message` checkbox (resets after every send).
- The thread has its own read positions and seen avatars (AC-103); opening it calls `POST …/messages/{rootId}/read`.

#### 10. Message Search (`MessagesSearchModal.tsx`)
- Opened from the bottom bar's Search button or the DM search bar. Modifiers parsed in the input: `has:file`, `is:pinned`, `during:Nd`, `from:name`, `with:name` / `@name`, `in:channel` / `#channel` (disabled in `mode: 'direct'`).
- **Autocomplete** (up to 8 each): `#` / `in:` channels (private only when the user is a member), `@` / `with:` and `from:` colleagues. A chosen channel or colleague becomes a pill; `from:` pills are visually distinct; Backspace on an empty input removes the last pill; a `clear all` chip clears all.
- **Idle view**: recent searches (max 6, secure storage), chips `during:7d`, `has:file`, `is:pinned`, recent conversations.
- **Results**: users, channels and messages with matches highlighted (`HighlightText`); 300 ms debounce; `limit: 30` with load-more; empty state `No messages containing "<q>" match your active filters.`; a search error returns an empty result, not a crash.
- Selecting a message result opens `/(app)/messages/conversation` with the route param `target_message_id` set to the result's id.

#### 11. Seen Avatars (`MessageSeenReceipt.tsx`, `utils/readReceipts.ts`)
- `placeSeenReaders` puts each reader on the newest loaded message with `id <= position` (by id, never by timestamp); pending, failed and system-event messages are skipped; a reader's avatar is hidden under their own message; a position older than every loaded message places nothing.
- Up to 4 avatars of 15 px then a `+N` badge; tap shows `Seen by <name> • <time>` for 3.2 s; long-press opens the action sheet whose `Seen by` list calls `GET …/seen`.
- `mergeReadReceipts` is forward-only. Initial load, older pages and thread replies merge `read_receipts`; `.MessagesRead` and `.MessageSent` (the sender has read their own message) update live; maps reset when the conversation changes. Rows re-render only when their own readers change.

#### 12. Channel Management, Holds and Drawers (baseline)
- `ManageChannelModal` (edit name / description / privacy, join policy `Auto-Approve` or `Require Admin Approval` for public custom channels, `Pending Join Requests (N)` with Approve / Decline, archive, drop — Lead Admin), `GroupDetailsDrawer` (overview, members, roles, add members, pinned messages, leave), `ColleagueProfileDrawer` (profile from `GET /employee-profile/{id}`, pinned messages), `ArchivedChannelsModal` (search, restore), `CustomizeGroupModal` and `MoveChannelSectionModal` (sections), `ForwardMessageModal`.
- For General (`isDefault` or `is_system`): no add, remove, invite or leave action; `ManageChannelModal` shows `Everyone with an active HRMS account has access to this channel.` (AC-36, gap G-12).

---

## 6. Business Rules & Edge Cases

### 6.1 HRMS Domain & Messaging Rules
1. **Manager Channel Separation**: Channels flagged with `role: 'manager'` are restricted to accounts with `role_access` in `[1, 2, 7]`. Regular employees cannot view or search these channels. *(Enforced today only in the conversation list and the unread count — gap G-7.)*
2. **Announcements Read-Only for Employees**: Broadcast channels allow employees to view and react with emoji, but the text composer is disabled with a notice (AC-27). Who may post: Q-2.
3. **Duplicate Conversation Guard**: Starting a chat with a colleague checks existing direct conversations before issuing `POST /api/employee/messages/conversations`; the server also returns the existing `dm` instead of creating a second one.
4. **Optimistic Updates & Resilience**: Messages are appended optimistically with `pending: true`. If the network fails, status shifts to `failed: true` with a retry action and the drafted text is kept.
5. **Mark as Read**: Opening a conversation debounces a call to `/read` and updates bottom tab badge counts silently. Read positions only move forward (§4.5).
6. **Seen avatars (v4)**: a reader's avatar shows on the newest message they have read, never on a message they sent, never for the viewer, never for an inactive account, and never moves backward.
7. **Threads keep their own read positions (v4)**: reading a thread does not mark the main list read, and reading the main list does not mark thread replies read.
8. **Search never leaks (v4)**: a scope the caller may not read answers exactly like a scope that does not exist (AC-56).
9. **No fabricated data (v4)**: the app never shows a channel the server did not create, nor a ticket that is not one of the user's own applications (AC-107, AC-108).

### 6.3 General Default Channel Rules

| Rule | Enforcement |
|---|---|
| General is a system/default channel | `is_system = true`, `created_by = null`; seeded once via migration. |
| Membership is automatic | No `conversation_members` rows needed for access. Active account = General member. |
| Access gate | `GeneralAccessAction::check()` runs on every conversation-scoped endpoint and on search (§4.3). `accounts.status = 1` is the sole criterion. |
| Inactive employees are denied | API returns `403 { code: 'ACCOUNT_INACTIVE' }`. Frontend shows activation message. |
| No self-activation | The inactive-state UI shows contact-HR instruction only. No activation button. HR controls account status via the existing HR portal workflow. |
| Message history preserved | Deactivating an account does NOT delete the employee's past General messages. |
| Reactivation restores access | `accounts.status` returning to `1` is sufficient. No re-join step needed. |
| No member-management UI | `Add members`, `Remove member`, `Invite`, and `Leave channel` are hidden for General (`isDefault: true` or `is_system: true`); the API refuses with `403 "Member management is disabled for system channels."`. |
| General cannot be archived or dropped | `archiveConversation` and `dropConversation` answer `Default company channels cannot be archived.` / `…cannot be dropped.` |
| General edits | Only `role_access` `1` or `2` (AC-79). |
| Mention audience active-only | `@all`, `@here`, `@channel` in General are stored as one mention each and mark the message `is_targeted` for every reader; only active accounts can read General (AC-42, AC-43). |
| Mention search active-only | People in mention picker filtered to `accounts.status = 1` regardless of channel. |
| `getConversationMembers` for General | Returns `{ is_system: true, member_count: N, members: [] }` — not a real member list. |
| Seen avatars in General | `read_receipts` list only members who have a `conversation_members` row (those who have read), active accounts only. |

### 6.4 Edge Cases

| Scenario | Expected Behaviour |
|---|---|
| Employee account deactivated mid-session (token still valid) | Next API call to a General endpoint returns `403 ACCOUNT_INACTIVE`. Frontend handles 403 and shows the activation banner. |
| Active employee has no `conversation_members` row for General | `markConversationAsRead` inserts the row on first read, no error. |
| Inactive employee's General messages | Remain in DB; not purged. Other active employees continue to see the messages. |
| `@all` sent to General with 500+ active employees | Backend resolves audience server-side. Mobile app does not load all 500 accounts. |
| Two simultaneous `markConversationAsRead` calls from the same user, no row yet | Both may insert: **no unique index exists** on `(conversation_id, account_id)` (gap G-9). With a row, the conditional UPDATE keeps it idempotent. |
| Admin sets `is_system = false` on General via direct DB edit | `GeneralAccessAction::check()` no longer fires; General behaves as a normal public channel. Not a supported workflow. |
| New employee created but not yet activated | Account created with `status = 0` by default; General access granted only after HR sets `status = 1`. |
| Cache flushed or evicted (v4) | Every thread read position reads as 0: thread seen avatars disappear and thread unread markers return until the thread is opened again. No message is lost. Conversation-level positions are rebuilt from `conversation_members.last_read_message_id`. |
| Two devices read the same thread out of order (v4) | The lock plus the `target <= current` check keeps the larger id; only the first advance broadcasts. |
| A reader's position is deleted-message id or points past the loaded page (v4) | The avatar is placed on the newest loaded message with `id <=` the position, or nowhere when none qualifies. |
| A reader becomes inactive (v4) | They disappear from `read_receipts` and `seen_by`; their stored position is untouched. |
| A `#channel` search term matches two channels with the same name (v4) | The first match by id order is used; names are expected to be unique. |
| A message is deleted after being pinned (v4) | It leaves search and list results (deleted rows are filtered); it can no longer be pinned. |
| Attachment has no known size (v4) | `width` / `height` are `null`; the client sizes the box after the media loads. |
| Search text contains `%` or `_` (v4) | Treated as `LIKE` wildcards — accepted (the query is bound, so there is no injection). |
| Broadcast server is down (v4) | `MessagesRead`, `UnreadCountUpdated`, `MessageSent` failures are logged and never fail the HTTP request. |

### 6.2 Non-Functional & Failure-Mode Checklist

| Category | Specification & Behavior |
|---|---|
| **Authorization** | All endpoints require an active Sanctum bearer token. Expired token (`401`) redirects to login. A conversation the caller cannot see answers `404 {"success": false, "message": "Conversation not found"}` (the code never confirms a private id exists); a message detail outside the caller's visibility answers `403 "Unauthorized to view this message"`. |
| **Concurrency / double-submit** | Send button is disabled while `isSending` is true. `ChatInputBar` debounce guards against rapid double-tapping. Voice recording button enforces a single active recording. Server side: a repeated `client_id` within 2 s returns the first message (AC-94). Read positions use a conditional UPDATE / cache lock (AC-64, AC-65). |
| **Idempotency on retries** | Outgoing messages carry a client UUID (`client_id`); the backend returns the existing message for a replay within 2 seconds (AC-94). |
| **Error response shape & status codes** | Unauthenticated: `401 {"message": "Unauthenticated"}` (Sanctum) or `{"success": false, "message": "Unauthenticated"}`. Forbidden: `403 {"success": false, "message": "<specific text>"}`. Not found: `404 {"success": false, "message": "<specific text>"}`. Validation: `422 {"success": false, "message": "<text>"}` (upload validation also returns `errors`). Server error: `500 {"success": false, "message": "<exception message>"}`. |
| **Input validation boundaries** | Empty or whitespace-only messages without an attachment cannot be dispatched (AC-92). Message body capped at 4,000 characters (AC-93). Attachment limits and allowed types: **open question Q-1** — v3 said 10 MB and `image/*`, `video/mp4`, `video/quicktime`, `audio/*`, `application/pdf`; the code allows 100 MB and any type. |
| **Performance (v4)** | `getMessages` computes seen receipts in **one** batched query plus one `Cache::many` (no per-message lookup); the conversation list uses one `CASE WHEN` unread query; `threadStatsFor` runs two queries for a whole page. Search is `LIKE '%…%'` over the caller's conversations: target `p95 < 800 ms` for a caller who is a member of 200 conversations holding 100,000 messages; pagination caps at 100 rows. If that target is missed, add a `FULLTEXT` index in a new ticket (Decision 6). |
| **Security (v4)** | Search and broadcast-channel authorisation apply the same visibility rule as REST (`Conversation::isVisibleTo`). The ticket-status endpoint's missing approver check is gap G-3. Search text and modifier values are bound parameters. |
| **Reliability (v4)** | A failed `MessagesRead` / `UnreadCountUpdated` / `MessageSent` broadcast is logged and never fails the request. Thread read state is cache-only (§6.4). |

---

## 7. Build Order & Implementation Phases

Implementation strictly follows the MVP priorities. **`plan.md` in this ticket folder supersedes this list for execution** (file-level tasks, reuse map, acceptance walk); the phases below stay as the product-level order.

### Phase P0 — Foundation & Landing
1. **Design System Tokens Alignment**: Verify Restyle theme tokens in `src/theme/index.ts` for messaging colors, typography, and avatar sizing.
2. **Latest Message Preview Formatter**: Verify `utils/messagePreview.ts` handles all six preview types (`Text`, `Photo`, `Video`, `Voice`, `File`, `No messages yet`).
3. **Messages Landing Screen Redesign (`MessagesScreen.tsx`)**: Rebuild the top header, search tap target, active colleagues reel, and filter chips.
4. **More Screen (`MessagesMoreScreen.tsx`)**: Replace `+` with the `⋮ More` entry opening the full-screen More view with `Create Channel` and `New Direct Message`.
5. **Conversation List Items (`ConversationListItem.tsx`)**: Redesign cards with avatars, delivery checkmarks, and unread badges.
6. **New Chat Flow (`NewChatModal.tsx`)**: Rebuild employee search, selection, and conversation resolution.
7. **Create Channel Flow (`CreateChannelModal.tsx`)**: Rebuild member picking, chip removal, and channel creation.

### Phase P0.5 — General Default Channel (Backend)

> **Must run before P1** — the ConversationScreen depends on the `is_system` flag and the 403 response shape.

8. **Alter migration** — `add_is_system_to_conversations_table.php` in `database/migrations/alters/messages/`: add `is_system` (default false); back-fill General.
9. **Conversation model** — add `is_system` to `$fillable` and `$casts`.
10. **`GeneralAccessAction`** — `app/Actions/Messages/GeneralAccessAction.php` with `check()`, `denyResponse()` and `guard()`.
11. **`MessagesController`** — add the guard to every conversation-scoped endpoint (§4.3).
12. **`getConversationMembers()`** — system-channel short-circuit returning `{ is_system: true, member_count: N, members: [] }`.
13. **`GetConversationsQuery`** — extend response payload with `is_system`.
14. **`SearchMentionsQuery`** — add `accounts.status = 1` filter to people search.

### Phase P1 — Core Communication
15. **Slack-Inspired Conversation Redesign (`ConversationScreen.tsx`)**: open feed stream; handle `403 ACCOUNT_INACTIVE`: hide composer and message list, show inactive-state banner.
16. **Message Component System**: `MessageRow`, `MessageHeader`, `MessageAvatar`, `MessageContent`, `MessageAttachment`, `MessageReaction`.
17. **Modern Message Composer (`ChatInputBar` / `MessageInputBar`)**: auto-expanding multiline input, keyboard handling, media and file triggers; suppress the composer when the system channel is locked.
18. **General Inactive State UI** — `ConversationScreen.tsx`: `Account Inactive` banner, no activation button.
19. **Mentions Integration**: `@` trigger popup; dual-color highlights.
20. **Channel Info / Manage Panel** — for General: hide member actions; show the description of AC-36.
21. **Contextual Message Actions (`MessageActionModal.tsx`)**.
22. **Message Requests**: requests list with accept / decline (persistence: Q-7).

### Phase P2 — Advanced Messaging
23. **Threads**: `MessageThreadPreview`, `ThreadModal`, thread fetching and sending through `useChatRoom` / `ConversationScreen`; General inactive guard applies to the thread composer.
24. **Emoji Integration (`EmojiPickerPanel.tsx`)**.
25. **Voice Messaging & Waveform**: recording state inside `MessageInputBar`; `ChatAudioBubble.tsx` playback.

### Phase P3 — Final Quality & Polish
26. **Full Navigation & Transition Polish**: Messages → New Chat → Conversation → Thread.
27. **Mobile UX Pass**: touch targets (min 48px), keyboard dismissals, safe-area insets.
28. **Performance Optimization**: profile `FlatList` rendering, memoize `MessageRow` items.
29. **Final MVP Review**: Complete verification of all AC criteria (AC-1 through AC-110).

### Phase P4 — v4: Search, Read Receipts, Hardening
30. **Search backend** (`SearchMessagesQuery`, `searchMessages`, unit tests) — shipped `51ddc284`, `0a1bbca1`, `ff4d1968`; **close G-2** (inactive callers never see General).
31. **Search UI** (`MessagesSearchModal`, `HighlightText`, `MessagesSearchBar`) — shipped mobapp `eb5d178`, `e2be0ad`, `db364cc`.
32. **Read positions and seen avatars** — backend shipped `5b57c0e8`, mobile `db364cc`; **close G-1** (guards on the new endpoints).
33. **Thread participants, attachment dimensions, channel edit rules** — shipped `e0366858`, `7e5787fc`, `c20c531`.
34. **Close the v3 rules the code does not meet**: send validation (AC-92, AC-93), replay dedupe (AC-94), manager-channel gate (G-7, AC-109), read-row uniqueness (G-9, AC-110), no fabricated data (AC-107, AC-108), overflow count (G-6), request persistence (Q-7), ticket-status authorisation (Q-5).
35. **Automated tests** for read state, guards, search scope and the send rules (§11).
36. **Remove the unused search-engine dependencies** (G-13).

---

## 8. Out of Scope (Deliberately Excluded)

- **Web Browser Messaging Redesign**: Excluded from this MVP. Web redesign will be specified and implemented separately following mobile app completion.
- **WebRTC Live Voice / Video Calling**: Informational/placeholder buttons only in this phase.
- **End-to-End Encryption (E2EE) Key Exchange**: Standard HTTPS transport security is utilized.
- **Rich Text Markdown WYSIWYG**: the composer has a formatting toolbar that writes markdown; there is no live-rendered WYSIWYG editor.
- **A search engine or `FULLTEXT` index** (v4): search is `LIKE`-based (Decision 6).
- **A database table for thread read positions** (v4): they are cache-held (Decision 7).
- **Push-notification fan-out for `@all` / `@here` / `@channel`** (v4): no fan-out exists in the messaging code; the mention only sets `is_targeted` for viewers.
- **Message-level read receipts for DMs shown as a per-message list on every row** (v4): only the newest message per reader carries an avatar (§5.3.11).
- **Search inside message attachments' content** (v4): only `messages.text` is searched.

---

## 9. Definition of Done

- [ ] Every row in the **Acceptance Criteria** table passes (`AC-1` through `AC-110`).
- [ ] Every category in the **Non-Functional & Failure-Mode Checklist** is addressed.
- [ ] Messages landing screen features the modern corporate header, `⋮ More` entry, search tap target, and conversation list.
- [ ] Latest message preview strictly outputs `Text`, `Sent a photo`, `Sent a video`, `Sent a voice message`, `Sent a file`, or `No messages yet`.
- [ ] `New Chat` and `Create Channel` flows are fully modernized with colleague multi-selection.
- [ ] Conversation screen utilizes a Slack-inspired workplace communication feed instead of personal chat bubbles.
- [ ] Message Component System is modular and reusable (`MessageRow`, `MessageHeader`, `MessageContent`, etc.).
- [ ] Modern composer supports dynamic height expansion, dual-color mentions (`@self` vs `@others`), emoji picker, and voice recording with waveform.
- [ ] Threads feature root message pinning, reply stream, and dedicated composer.
- [ ] **General Default Channel — System channel is seeded** (`is_system = true`, `created_by = null`, `is_private = false`).
- [ ] **`GeneralAccessAction` guards every conversation-scoped endpoint and every search** — inactive accounts receive `403 { code: 'ACCOUNT_INACTIVE' }` (or no General results in an unscoped search); gaps G-1 and G-2 are closed.
- [ ] **Inactive-state UI is implemented** — `ConversationScreen` shows the activation banner instead of messages/composer for inactive users in General.
- [ ] **Member management is suppressed for General** — no Add, Remove, Invite, or Leave actions visible when `is_system = true`.
- [ ] **`SearchMentionsQuery` filters active employees only** — inactive accounts do not appear in mention picker.
- [ ] **`getConversationMembers` returns the system-channel placeholder** for General — not a full member list.
- [ ] **Search (v4)**: modifiers, scoping, authorisation and pagination behave as AC-48 – AC-62; the search UI as AC-95 – AC-98.
- [ ] **Read positions and seen avatars (v4)**: forward-only, once-only broadcast, thread-scoped, guarded; avatars as AC-99 – AC-103.
- [ ] **Send rules (v4)**: AC-92, AC-93, AC-94 enforced by the server.
- [ ] **No fabricated data (v4)**: AC-107, AC-108.
- [ ] Every Open Question in §10.3 is answered, or the work it blocks is recorded as deferred.
- [ ] Automated tests listed in §11 exist and pass; manual steps MT-1 – MT-10 are walked.
- [ ] Verified on both iOS/Android mobile devices and desktop web viewports (`maxWidth: 640` conversation, `680` landing and More).
- [ ] No open findings from adversarial verification (`verify.md`).
- [ ] No open `CRITICAL` or `HIGH` findings from diff review (`code-review.md`).

---

## 10. Assumptions, Known Gaps and Open Questions (v4)

### 10.1 Assumptions

| ID | Assumption | Impact if wrong |
| --- | --- | --- |
| A-1 | The behavior shipped between 2026-09-29 and 2026-10-13 is the intended behavior of search, seen avatars, thread participants, channel edit rules and attachment dimensions, because the commit messages (`ff4d1968`, `5b57c0e8`, `e0366858`, `7e5787fc`) state those rules explicitly. Each is specified as built. | The affected AC row and §4 rule change (Minor); code follows. |
| A-2 | The shipped mobile UI shapes (full-screen More, single Create Channel form, `ThreadModal`, inline voice recording, text-colour mentions, 140 px composer, 680 px landing width) are accepted in place of the v3 sketches (Decision 11). The design-review report does not contradict them. | The affected UI rows are rebuilt to the v3 sketch; backend unaffected. |
| A-3 | `role_access` `1` and `2` are system administrators; `1`, `2` and `7` may see manager channels; `1`, `2`, `4` and `7` may post to announcements. Taken from the code; this spec has no role table to confirm them. | Q-2 answers change which roles the rules name. |
| A-4 | Thread read positions may be lost on a cache flush without a recovery path (Decision 7). | A table or column is added (Major). |
| A-5 | The attachment-only message is valid, so AC-92 rejects only a message with neither text nor attachment. | AC-92 changes (Minor). |
| A-6 | Any account that can see a conversation may pin a message (the handler checks visibility only). | Q-4 restricts pinning (Minor). |
| A-7 | `messages.text` search is acceptable without an index at current volume; the `p95 < 800 ms` target in §6.2 is a proposed default, not a measurement. | The target changes, or a `FULLTEXT` ticket is opened. |
| A-8 | A MySQL test database that can run the repository's migrations (`database/migrations/**`, including the `vw_accounts_details` view) can be provided for Feature tests. Today `phpunit.xml` has the database lines commented out and the only Feature test (`tests/Feature/Services/TimesheetServiceTest.php`) needs no database. | The database-backed Feature tests of §11.1 are deferred and only the Tier 1 tests run. |

### 10.2 Known Gaps (rules in this spec that the code does not meet today)

These are **not** relaxations. Each is delivered by a task in `plan.md`.

| ID | Gap | Evidence | Rule it breaks |
| --- | --- | --- | --- |
| G-1 | `markThreadAsRead`, `getMessageSeenReceipts`, `getMessage` and `updateTicketStatus` check visibility but not `GeneralAccessAction` | `MessagesController.php` (only `Conversation::isVisibleTo`) | §4.3, AC-75 |
| G-2 | An unscoped `search` includes system channels' messages for an inactive caller | `SearchMessagesQuery::execute` (`$systemConvIds` has no status check) | §4.3, AC-61 |
| G-3 | `updateTicketStatus` writes an approval or decline to the HRMS application (overtime, leave, OB trip, change shift, adjustment) for **any** caller who can see the conversation; the application is also matched by `orWhere('id', $numericId)` | `MessagesController::updateTicketStatus` | authorisation; blocked on Q-5 |
| G-4 | Message Requests have no backend: `conversations.type` has no `request` value and Accept / Decline change local state only | `MessageRequestsScreen.tsx`; `2026_06_25_000001_create_conversations_table.php` | AC-7; blocked on Q-7 |
| G-5 | No server-side empty-message check, no 4,000-character cap, no `client_id` dedupe | `SendMessageHandler::execute` | AC-92, AC-93, AC-94 |
| G-6 | `MessageThreadPreview` computes the overflow badge as `participants - 5` while 4 avatars are shown when there are more than 5 (6 repliers show `1+`, 2 are hidden); commit `c20c531` says "up to 3 avatars with a 4th overflow counter" | `MessageThreadPreview.tsx:141-147` | AC-104 |
| G-7 | The manager-channel gate (`role = 'manager'`) is applied in `GetConversationsQuery` and `getUnreadCount` only; `getMessages`, `sendMessage`, `getConversation` and `search` do not apply it | `Conversation::scopeVisibleTo` has no role condition | §6.1 rule 1 |
| ~~G-8~~ | ~~`@all` / `@here` / `@channel` are not resolved to a list of active accounts~~ — **retired before publication:** AC-42 and AC-43 are satisfied by the guard plus `is_targeted` (§4.8), and push fan-out is out of scope (§8). | — | — |
| G-9 | No unique index on `conversation_members (conversation_id, account_id)`; the v3 text claimed one | `database/migrations/table/messages/…000002`, `2026_07_07_000001`, `2026_09_11_000001` | §6.4 |
| G-10 | v3 §6.4 / DoD wording for `uploadAttachment` "guarded via conversation context" cannot be met (the endpoint has no conversation id) | `routes/api/employee.php` (`POST /upload`) | corrected in §4.3 (Minor) |
| G-11 | `ConversationScreen` returns `DEFAULT_HR_TICKETS` (demo data) when the dashboard has no recent applications | `ConversationScreen.tsx:588, 2627, 2875`, `ChatToolsDrawer.tsx:72, 157` | AC-108 |
| G-12 | The drawer opened from the conversation header shows the API description or `"{n} members collaborating in this channel."` for General, not the AC-36 text | `GroupDetailsDrawer.tsx` | AC-36 |
| G-13 | `laravel/scout` and `meilisearch/meilisearch-php` are declared in `composer.json` and `config/scout.php` exists, but search does not use them and `vendor/laravel/scout` is not installed | `composer.json:16,20`; `config/scout.php` | Decision 6 |
| G-14 | `CreateChannelModal` falls back to a locally created channel with `Date.now()` as its id when the request fails | `CreateChannelModal.tsx` ("Fallback local creation") | AC-107 |
| G-15 | The record dot in the recording state is static; AC-21 asks for a pulsing dot | `MessageInputBar.tsx` (recording state) | AC-21 |
| G-16 | `SearchMessagesSyntaxTest` re-implements the parser in the test (`parseSyntax`) and never calls `SearchMessagesQuery`; the parsing is inline in `execute()` and cannot be tested without a database | `tests/Unit/SearchMessagesSyntaxTest.php:12-77`; `SearchMessagesQuery::execute` | §11.1 |
| G-17 | The composer caps each text block at 2,000 characters (`maxLength={isCode ? undefined : 2000}`) and has no cap on the whole message, while AC-93 caps the message at 4,000 | `MessageInputBar.tsx:2231` | AC-93 |

### 10.3 Open Questions

| ID | Question | Why it blocks | Blocks |
| --- | --- | --- | --- |
| Q-1 | Attachment limit and types: v3 says 10 MB and `image/*`, `video/mp4`, `video/quicktime`, `audio/*`, `application/pdf`; the code (since 2026-09-10) allows **100 MB** and **any** type (`file|max:102400`, `UploadAttachmentHandler`). Which is the rule? | Business and security policy. | The upload-limit task |
| Q-2 | Who may post in an announcement channel? Code: creator or `role_access` in `[1, 2, 4, 7]`. AC-27 / v3 say "HR administrators". Which roles are those, and what is the exact notice text (shipped: `Company Announcements is broadcast-only. Only administrators can post here.`)? | Who may post is policy. | AC-27, AC-88 wording |
| Q-3 | Should the unread count include thread replies that were not sent to the channel? `getUnreadCount` and `GetConversationsQuery` count them; `markConversationAsRead.remaining_unread` does not, so the badge and the post-read number can disagree. | Product definition of "unread". | Unread consistency task |
| Q-4 | May any member pin a message, or only channel admins? | Permission policy. | AC-89 |
| Q-5 | Who may approve or decline an application from a chat card (the application's approver at the current tier only, an HR role, or no one — read-only cards)? | Approval policy; HRMS approval rules live in `hrms-rules.md` / approver tables, not here. | G-3 task |
| Q-6 | Is it intended that **any member** of a channel with no creator may edit it (rule of commit `e0366858`)? | Permission policy. | AC-81 |
| Q-7 | What is a message request in the backend (who creates one, where is it stored), and must Accept / Decline be persisted? | Needs a data-model decision (a new table or a `conversations.type` value). | G-4, AC-7 |

### 10.4 Amendment Log (v3 → v4 acceptance criteria)

| AC | v3 | v4 | Reason |
| --- | --- | --- | --- |
| AC-2 | Bottom sheet with `New Chat`, `Create Group`, `Message Requests`, `Mark All as Read` | Full-screen More with `Create Channel`, `New Direct Message`, `Message Requests`, `Archived Channels`, `AI HR Assistant`, `Mark All as Read` | Decision 11 / A-2 |
| AC-6 | Three-step Create Group | One-form Create Channel | Decision 11 / A-2 |
| AC-11 | Route `/(app)/conversation` | `/(app)/messages/conversation` | Route moved; legacy route file remains |
| AC-14, AC-15 | Pills (`primaryBg` + `chestnutAccent`, `infoBg` + `cyanAccent`) | Bold coloured text, no background | A-2 |
| AC-18 | Sheet items `Reply`, `Reply in thread`, `React`, `Copy`, `Edit`, `Delete` | As built | A-2 |
| AC-24 | Max height 120 px | 140 px | A-2 |
| AC-27 | Notice `Only HR administrators can broadcast to this channel` | As built text; roles pending Q-2 | Q-2 |
| AC-28 | Inline retry indicator | Failure icon plus `Retry Sending` in the action sheet | A-2 |
| AC-29 | Max width 640 px above 1024 px | 640 px conversation, 680 px landing and More | A-2 |
| AC-42, AC-43 | `@all` / `@here` target active employees (an audience list) | `is_targeted` for every reader; audience never expanded; inactive accounts cannot read General | Observable behavior; the v3 wording had no consumer (G-8 retired) |
| §6.2 | "10 MB, `image/*` …" | Q-1 | Code differs since 2026-09-10 |
| §6.2 | "unique constraint on `(conversation_id, account_id)`" | None exists (G-9) | Spec misstated the schema |
| §4.3 | `uploadAttachment` guarded "via conversation context" | Not guarded; reaches a conversation only via `sendMessage` | Spec misstated the design (G-10) |
| §3.1 | `conversations.type` includes `request` | `channel`, `dm`, `announcement` | Spec misstated the schema |
| §5.1 | Hex values for tokens | Token names only | Palette changed 2026-10-03 / 2026-10-09 |
| §5.2 | File map incl. `ThreadScreen`, `useThread`, `VoiceRecordingBar`, `MessagesActionMenu`, `MessagesHeroHeader`, mock store | As built (§5.2) | Decision 11 |

---

## 11. Testing Strategy (v4)

The backend has PHPUnit (`composer.json`: `phpunit/phpunit ^12.0`; `tests/Unit`, `tests/Feature`); the only messaging test today is `tests/Unit/SearchMessagesSyntaxTest.php`. The mobile app has **no JS test runner** (no `test` script, no Jest / Vitest); its checks are `npx tsc --noEmit` and `npm run lint` (`expo lint`) run in `resources/views/mobapp`.

### 11.1 Automated (backend)

**Tier 1 — no database** (run with `php artisan test --testsuite=Unit`; `phpunit.xml` already sets `CACHE_STORE=array`, which supports cache locks):

| Test | File | Covers |
| --- | --- | --- |
| Query parsing: the parser is extracted from `SearchMessagesQuery::execute` into a pure static method and the existing 10 cases are re-pointed at it | `tests/Unit/SearchMessagesSyntaxTest.php` (modify) | AC-50 – AC-55, AC-57, AC-58 |
| `AdvanceThreadReadAction`: advances, ignores an older id, ignores a repeat, returns `advanced` | `tests/Unit/AdvanceThreadReadActionTest.php` (new) | AC-65 (thread form), AC-68 |
| `GetMessagesQuery::formatAttachments` returns `width` / `height` / `url` | `tests/Unit/FormatAttachmentsTest.php` (new) | AC-77, AC-78 |
| `GeneralAccessAction::check` and `denyResponse` | `tests/Unit/GeneralAccessActionTest.php` (new) | AC-34, AC-75 (rule) |

**Tier 2 — needs a test database (A-8)** (`tests/Feature/Messages/`, `Illuminate\Foundation\Testing\RefreshDatabase`):

| Test | File | Covers |
| --- | --- | --- |
| Search scope and authorisation | `SearchMessagesTest.php` | AC-48, AC-49, AC-56, AC-59 – AC-61, AC-109 |
| Read position forward-only and broadcast-once; mark-all | `ReadPositionTest.php` | AC-63 – AC-67, AC-73, AC-110 |
| Thread read and replies payload | `ThreadReadTest.php` | AC-68 – AC-71 |
| Seen-by list | `SeenReceiptsTest.php` | AC-63, AC-72 |
| General guard on every conversation-scoped route and search | `GeneralGuardTest.php` | AC-31 – AC-34, AC-39 – AC-41, AC-61, AC-75 |
| Send rules, attachment dimensions, announcement and join rules | `SendMessageTest.php` | AC-77, AC-78, AC-87, AC-88, AC-92 – AC-94, AC-109 |
| Channel edit, join and approval rules | `ChannelRulesTest.php` | AC-79 – AC-86 |
| Pins and system events | `PinAndEventsTest.php` | AC-89 – AC-91 |
| Thread participants | `ThreadParticipantsTest.php` | AC-76 |
| Broadcast channel authorisation | `ChannelAuthTest.php` | AC-74 |

### 11.2 Static checks (mobile)

- `npx tsc --noEmit` in `resources/views/mobapp` passes with no new errors.
- `npm run lint` passes for the files changed.

### 11.3 Manual verification

| ID | Steps | Covers |
| --- | --- | --- |
| MT-1 | In a channel, type `#general from:maria has:file during:30d invoice` into search; confirm the pill, the results, then Backspace removes the pill | AC-95 – AC-98 |
| MT-2 | With two devices in one DM: send from A, open on B; confirm A sees B's avatar under the message, then send from B and confirm B's avatar is hidden under B's own message | AC-99 – AC-102 |
| MT-3 | Open a thread on B, read it; confirm A's thread view shows B's thread avatar and A's main list does not move | AC-103 |
| MT-4 | Root with 2 and with 6 distinct repliers; confirm avatar counts and the overflow badge | AC-104 |
| MT-5 | In a thread, tick `Also send to #channel`, send twice; confirm the box resets and the channel row shows `View thread` | AC-105 |
| MT-6 | Airplane mode, create a channel; confirm an error and no new list entry | AC-107 |
| MT-7 | Dashboard with no applications; open the tickets tab; confirm it is empty | AC-108 |
| MT-8 | Set an account's `status` to `0`; call search, `…/seen` and `…/messages/{id}/read` on General | AC-61, AC-75 |
| MT-9 | On an iOS device, an Android device and the web viewport, walk AC-1 – AC-30 and AC-35 – AC-37 against the shipped screens | AC-1 – AC-30, AC-35 – AC-37 |
| MT-10 | Locally and temporarily make `SearchMessagesQuery::execute` throw; call `GET /search?q=x`; read `storage/logs/laravel.log` | AC-62 |


<!-- Changelog -->
- v4 — 2026-10-13 — **Major.** Brought level with the built system: message search (§4.4), read positions and seen avatars (§4.5), thread participants, channel edit rules, attachment dimensions (§4.6–§4.7), pinned messages and system events (§4.9), full endpoint inventory (§4.1), corrected data model (§3) and frontend file map (§5.2), new AC-48 – AC-110, Decisions 6 – 11, Assumptions A-1 – A-8, Known Gaps G-1 – G-17 (G-8 retired), Open Questions Q-1 – Q-7, testing strategy (§11). Major because it adds API contracts (search, seen, thread read, send validation), user flows (search, seen avatars) and cache-held read state. Impact: `plan.md` created for this version. Amended v3 rows are listed in §10.4. Changed sections: header, §1, §2, §2.5, §3, §4, §5, §6, §7, §8, §9, new §10 and §11.
- v2 — 2026-09-12 — Full MVP redesign of entire mobile messaging module: Messages landing, Conversation list & preview, More menu actions, New Chat, Create Group, Message Requests, Slack-inspired Conversation, Message Component System, Composer, Mentions, Emoji, Message Actions, Threads, and Voice recording.
- v1 — 2026-09-08 — initial fullscreen stack transition spec.
