# Spec — Mobile App Messaging Full MVP Redesign (Slack-Inspired Workplace Communication)

> **Ticket:** `T00001` (subhrms) — this file is `.agents/specs/subhrms/T00001/specs.md`; branch `T00001`.
> **Kind:** Extension / Full MVP Redesign — complete redesign of the Mobile App Messaging module (Messages Landing, More Actions, Conversation, Threads, Composer, Message Requests, New Chat, Create Group, Mentions, Emoji, Message Actions, Voice Recording) + General Default System Channel.
> **Portal:** **employee** (`/api/employee/messages/...` routes, `resources/views/mobapp/src/module/employee/messages`).
> **Version:** v3 — 2026-09-29 — Added General Default System Channel spec: automatic membership via account status, backend authorization guard on all endpoints, inactive-user UI, mention audience resolution, and no manual member-management for General.
> **Route:** `/(app)/(tabs)/messages` (landing screen) & `/(app)/conversation` (fullscreen conversation and thread views).
> **Conventions:** [project-profile.md](../../rules/project-profile.md), [hrms-rules](../../rules/hrms-rules.md).
> **System Awareness:** Models: `Conversation`, `Message`, `MessageAttachment`, `MessageReaction`, `Account`, `AccountDetailVW` (reused); Tables: `conversations`, `messages`, `conversation_members`, `message_attachments`, `message_reactions` (reused); Routes: `routes/api/employee.php` (`api/employee/messages/*`, reused); New migration: `alters/messages/` — add `is_system` flag to `conversations`; New action class: `App\Actions\Messages\GeneralAccessAction`.

---

## 1. Purpose

The mobile application (`resources/views/mobapp`) currently possesses chat capabilities, but the experience is fragmented across inconsistent screens, mixed UI paradigms, and personal-chat styling that does not reflect a modern corporate HRMS. 

This specification establishes a **full MVP redesign of the entire Mobile App Messaging module**, covering the complete user journey:
1. **Messages Landing Screen & Conversation Directory**: Redesigned as the central communication entry point of the corporate system with search, category filtering, unread status indicators, and an active colleagues presence reel.
2. **Messages Screen Actions (`⋮ More`)**: Replacing the simple `+` button with a mobile-optimized More action sheet offering "New Chat" and "Create Group".
3. **Conversation List Items & Latest Message Preview**: Consistent profile pictures, accurate delivery status ticks, unread counts, and unified preview logic (`Text`, `Sent a photo`, `Sent a video`, `Sent a voice message`, `Sent a file`, `No messages yet`).
4. **New Chat & Create Group Flows**: Fully modernized employee search, multi-selection pill management, and duplicate-conversation prevention.
5. **Message Request Experience**: Dedicated request queue for inquiries and cross-team communications matching the new corporate design language.
6. **Slack-Inspired Conversation View**: Transitioning from consumer bubble tails to a structured workplace communication feed with clear sender identity, timestamp grouping, and contextual actions.
7. **Unified Message Component System**: Reusable modular blocks (`MessageRow`, `MessageHeader`, `MessageAvatar`, `MessageContent`, `MessageAttachment`, `MessageReaction`, `MessageThreadPreview`, `MessageActionMenu`).
8. **Modern Message Composer**: Dynamic auto-expanding multiline input, integrated emoji picker, dual-color `@mentions` (golden chestnut `@self`, blue `@other`), media attachment triggers, and seamless voice recording with waveform visualization.
9. **Thread System**: Root message context, dedicated reply stream, reply composer, and real-time counter.

**Scope:** **MOBILE APP ONLY** (`resources/views/mobapp`). Web messaging redesign is deliberately excluded and will follow after mobile finalization.

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

## 2.5 Acceptance Criteria

| # | Given | When | Then |
|---|-------|------|------|
| AC-1 | User is on `MessagesScreen` (`/(app)/(tabs)/messages`) | Screen finishes initial load | Header displays `Chats`, online presence count, unread badge (if > 0), search button, and `⋮ More` action button. |
| AC-2 | User taps `⋮ More` button in header | Menu is opened | A touch-friendly Restyle bottom sheet appears with outside-tap dismissal, displaying `New Chat`, `Create Group`, `Message Requests`, and `Mark All as Read`. |
| AC-3 | User selects `New Chat` from More menu | Action is triggered | `NewChatModal` opens with employee search bar, colleague list, avatars, departments, and real-time query filtering. |
| AC-4 | User selects a colleague who already has an existing direct conversation | Colleague is tapped | Existing conversation is resolved without creating a duplicate; app navigates to `/(app)/conversation` with existing `id`. |
| AC-5 | User selects a colleague with no prior conversation | Colleague is tapped | Calls `POST /api/employee/messages/conversations`, updates conversation directory, and pushes to `/(app)/conversation` with new `id`. |
| AC-6 | User selects `Create Group` from More menu | Action is triggered | Group creation flow launches: Step 1 Member multi-select with search and removable avatar chips; Step 2 Group Name input & summary; Step 3 POST and navigate to new group conversation. |
| AC-7 | User switches category chip to `Requests` or opens from More menu | Requests view active | Displays incoming message requests using the unified design system, showing user avatar, name, latest preview, timestamp, and accept/decline actions. |
| AC-8 | Conversation list renders an item with an image attachment | Item renders preview | Displays `"Sent a photo"` instead of raw URLs or placeholder text; does not render full attachment thumbnail in list item. |
| AC-9 | Conversation list renders an item with video, voice, or file | Item renders preview | Displays `"Sent a video"`, `"Sent a voice message"`, or `"Sent a file"` respectively. |
| AC-10 | Conversation list renders an item with zero messages | Item renders preview | Displays `"No messages yet"` in muted font. |
| AC-11 | User taps any conversation card in `MessagesScreen` | Navigation triggered | Transitions via native `slide_from_right` to fullscreen `/(app)/conversation`; `AppTopHeader` and `CustomTabBar` are hidden. |
| AC-12 | User is in `ConversationScreen` | Messages load | Stream displays Slack-inspired workplace layout: left-aligned avatars, name, timestamp, and clear content blocks. |
| AC-13 | Multiple consecutive messages sent by same user within 5 minutes | Message stream renders | Subsequent messages collapse the avatar and header, displaying text aligned with the message gutter. |
| AC-14 | Message contains a mention of the current authenticated user | Message text renders | Current user's `@name` is wrapped in a golden chestnut pill (`primaryBg` + `chestnutAccent`). |
| AC-15 | Message contains a mention of another colleague | Message text renders | Other colleague's `@name` is wrapped in a soft blue pill (`infoBg` + `cyanAccent`). |
| AC-16 | User types `@` in the composer input | `@` entered | Mention popup list appears above composer filtered by entered query; selecting a name inserts formatted `@Name ` and closes popup. |
| AC-17 | User taps the smiley icon in composer | Emoji action triggered | Keyboard smoothly transitions or docks an emoji picker panel; selecting emoji inserts symbol at current cursor index. |
| AC-18 | User long-presses or taps `⋮` action on a message row | Action menu opens | Contextual bottom sheet/modal appears showing: `Reply`, `Reply in thread`, `React`, `Copy`, `Edit` (if sender is self), `Delete` (if sender is self). |
| AC-19 | User taps `Reply in thread` on a message | Action selected | Thread panel/screen opens showing the pinned Root Message, existing replies count, chronological replies, and dedicated reply composer. |
| AC-20 | User sends a reply inside a thread | Send button tapped | Reply is appended to thread, root message increments `thread_count`, and last reply snippet updates. |
| AC-21 | User taps the microphone icon in composer | Voice action triggered | Composer transitions to Recording State: displays pulsing red record dot, active timer (`00:15`), real-time audio waveform/metering bars, Cancel (`Trash`), and Send buttons. |
| AC-22 | User taps Cancel during voice recording | Cancel tapped | Audio recording stops, scratch audio file is purged, composer reverts to text input mode without sending. |
| AC-23 | User taps Send during voice recording | Send tapped | Audio recording finishes, audio file uploads via `POST /api/employee/messages/upload`, and voice message item is dispatched. |
| AC-24 | User types multiple lines of text in composer | Text length grows | Input container expands smoothly up to max height (120px) and enables internal scrolling without obscuring message list. |
| AC-25 | User attaches photo or file via attachment drawer | Attachment selected | Compact attachment preview chip with remove (`X`) button renders directly above the input bar. |
| AC-26 | User taps Back button in `ConversationScreen` | Header back tapped | Screen smoothly slides back out to `MessagesScreen`, keeping previous scroll position and updating unread badges. |
| AC-27 | Conversation is marked as Announcement channel | Conversation loaded | Composer input is disabled with clear corporate notice: `"Only HR administrators can broadcast to this channel"`. |
| AC-28 | User sends a message while offline or network errors | API request fails | Optimistic message shows inline retry indicator (`AlertCircle`) without dropping drafted content. |
| AC-29 | Desktop Web viewport (>1024px) opens Messages or Conversation | Screen loaded | Viewport is centered with max-width 640px, subtle card borders, and shadow, avoiding awkward wide-screen stretching. |
| AC-30 | User pastes long multi-line text with mentions into composer | Content pasted | Composer preserves linebreaks, cursor position, and renders all mention segments cleanly. |
| **General Default Channel — Membership & Access** | | | |
| AC-31 | Active employee (accounts.status = 1) authenticates | `GET /api/employee/messages/conversations` called | Response includes the General channel (`isDefault: true`, `is_system: true`) without any `conversation_members` row needed for the user. |
| AC-32 | Active employee opens General conversation | `GET /api/employee/messages/conversations/{id}/messages` called | Returns `200 { success: true, data: [...] }` — messages load normally. |
| AC-33 | Active employee sends a message to General | `POST /api/employee/messages/conversations/{id}/messages` called | Returns `200 { success: true, data: { ... } }` — message is persisted and broadcast. |
| AC-34 | Inactive employee (accounts.status = 0) calls any General endpoint | Any messaging API call with General `{id}` | Returns `403 { success: false, message: "Your account is inactive. Please contact HR to restore access." }`. |
| AC-35 | Inactive employee opens General in the mobile app | ConversationScreen mounts | Composer is hidden; message list is hidden; an informational banner renders: `"Activate your account to view this channel. Please contact HR to activate your account."` |
| AC-36 | General channel detail / info view is opened | User views channel info | No "Add members", "Remove member", "Invite", or "Leave channel" actions are shown. Description reads: `"Everyone with an active HRMS account has access to this channel."` |
| AC-37 | User-created channel (isDefault: false) detail is opened | User views channel info | Normal member management actions are present (Add, Remove, Leave). Behaviour is unchanged from existing implementation. |
| AC-38 | HR activates a previously inactive employee account | Account status changes from 0 → 1 | Employee immediately gains General access on next authenticated API call — no additional setup required. |
| AC-39 | Inactive employee attempts `POST .../messages` to General directly via API | Raw API call without frontend | Returns `403 { success: false, message: "Your account is inactive. Please contact HR to restore access." }` — frontend UI state is irrelevant. |
| AC-40 | Inactive employee attempts to load General thread replies | `GET .../messages/{msgId}/replies` for General | Returns `403` with the inactive-account message. |
| AC-41 | Inactive employee attempts to toggle a reaction in General | `POST .../messages/{msgId}/reactions` for General | Returns `403` with the inactive-account message. |
| **General — Mention Audience** | | | |
| AC-42 | User types `@all` in General composer | Mention resolved | `@all` targets **active** employees only (`accounts.status = 1`). No inactive/resigned employees are included. |
| AC-43 | User types `@here` in General composer | Mention resolved | `@here` resolves to currently active employees (same status filter) — presence rules apply. |
| AC-44 | User opens mention search (`@jo`) inside General | Mention picker loaded | Server-side debounced search returns only employees with `accounts.status = 1`; inactive employees do not appear in results. |
| AC-45 | User is a member of a private user-created channel and opens mention search | Mention picker loaded | Inactive employees still do not appear. Filter applies globally to all channels' mention search. |
| **General — Historical Data** | | | |
| AC-46 | Employee becomes inactive | System state change | Pre-existing General messages authored by that employee remain in the database; they are not deleted. |
| AC-47 | Inactive employee is reactivated by HR | Account status returns to 1 | Employee immediately sees full General history on next load — no message gap or re-join ceremony required. |

---

## 3. Database

Minimal schema change required for General Default Channel support. All other models reuse the existing, production-verified schema in `database/migrations/table/messages/`:

### 3.1 Reused Tables
- **`conversations`**:
  - `id` (bigint, PK)
  - `name` (string) — channel title or recipient name
  - `type` (enum: `channel`, `dm`, `announcement`, `request`)
  - `description` (string, nullable)
  - `role` (string, default `'all'`)
  - `created_by` (bigint, nullable, indexed) — **null = system/default channel**
  - `is_private` (boolean, default false)
  - `is_archived` (boolean, default false)
  - `status` (tinyint, default 1) — 0 = disabled
  - `created_at`, `updated_at` (timestamps)
- **`conversation_members`**:
  - `id` (bigint, PK)
  - `conversation_id` (bigint, indexed)
  - `account_id` (bigint, indexed)
  - `last_read_message_id` (bigint, nullable, default 0)
  - `is_admin` (tinyint, default 0)
  - `created_at`, `updated_at` (timestamps)
- **`messages`**:
  - `id` (bigint, PK)
  - `conversation_id` (bigint, indexed)
  - `sender_id` (bigint, indexed)
  - `text` (text, nullable)
  - `reply_to_id` (bigint, nullable, FK to parent message — used for both standard replies and thread roots)
  - `linked_ticket_id` (string, nullable, indexed)
  - `linked_ticket_type` (string, nullable)
  - `linked_ticket_title` (string, nullable)
  - `linked_ticket_status` (string, nullable)
  - `linked_ticket_status_color` (string, nullable)
  - `created_at`, `updated_at` (timestamps)
- **`message_attachments`**:
  - `id` (bigint, PK)
  - `message_id` (bigint, FK)
  - `name`, `size`, `type`, `path`
- **`message_reactions`**:
  - `id` (bigint, PK)
  - `message_id` (bigint, FK)
  - `account_id` (bigint, FK)
  - `emoji` (string)

### 3.2 New Column — `conversations.is_system` (alter migration)

**Migration location:** `database/migrations/alters/messages/`

```php
// Migration: add_is_system_to_conversations_table.php
Schema::table('conversations', function (Blueprint $table) {
    if (!Schema::hasColumn('conversations', 'is_system')) {
        $table->boolean('is_system')->default(false)->after('created_by')->index();
    }
});
```

**Seed update** — back-fill the General row:
```sql
UPDATE conversations
SET is_system = 1
WHERE type = 'channel'
  AND LOWER(TRIM(name)) = 'general'
  AND (created_by IS NULL OR created_by = 0);
```

This is the canonical flag that the backend uses to identify system/default channels. Using `created_by IS NULL` alone is fragile because a future admin tool could set `created_by` on General. `is_system = true` is explicit, indexed, and immutable via normal user operations.

**`Conversation` model** — add to `$fillable` and `$casts`:
```php
'is_system' => 'boolean',
```

**No `conversation_members` rows are created for General membership.** The unread-count logic uses `updateOrInsert` on `markConversationAsRead`, so sparse rows are created only when an employee first reads General (which is correct and idempotent).

---

## 4. Backend

All core endpoints are fully implemented and live in `routes/api/employee.php` under the `auth:sanctum` middleware prefix `api/employee/messages`.

### 4.1 Reused Endpoints (`routes/api/employee.php`)
- `GET /api/employee/messages/unread-count`: Returns `{ success: true, data: { unread_count: number } }`
- `GET /api/employee/messages/conversations`: Returns `{ success: true, data: MessageConversation[] }`
- `GET /api/employee/messages/conversations/{id}/messages`: Returns `{ success: true, data: MessageItem[], has_more: bool }`
- `POST /api/employee/messages/conversations/{id}/messages`: Payload `{ text: string, reply_to_id?: number, attachments?: [] }` -> Returns `{ success: true, data: MessageItem }`
- `POST /api/employee/messages/conversations/{id}/read`: Updates read marker for member
- `POST /api/employee/messages/conversations/{id}/typing`: Broadcasts typing presence
- `GET /api/employee/messages/recipients`: Returns eligible colleagues for direct chats & group creation
- `POST /api/employee/messages/conversations`: Creates DM or group channel
- `POST /api/employee/messages/upload`: Uploads voice/image/file attachment -> Returns `{ id, name, size, type, path, url }`
- `POST /api/employee/messages/conversations/{conversationId}/messages/{messageId}/reactions`: Toggles emoji reaction
- `PUT /api/employee/messages/conversations/{conversationId}/messages/{messageId}`: Edits message text
- `DELETE /api/employee/messages/conversations/{conversationId}/messages/{messageId}`: Soft-deletes message

### 4.2 Query & Handler Classes (Existing)
- `App\Queries\Messages\GetConversationsQuery::execute()`
- `App\Queries\Messages\GetMessagesQuery::execute($params)`
- `App\Queries\Messages\GetThreadRepliesQuery::execute($params)`
- `App\Queries\Messages\SearchMentionsQuery::execute($params)`
- `App\Handlers\Messages\SendMessageHandler::execute($params)`
- `App\Handlers\Messages\ToggleReactionHandler::execute($params)`
- `App\Handlers\Messages\EditMessageHandler::execute($params)`
- `App\Handlers\Messages\DeleteMessageHandler::execute($params)`
- `App\Handlers\Messages\UploadAttachmentHandler::execute($params)`

### 4.3 New: `App\Actions\Messages\GeneralAccessAction` (System-Channel Guard)

**File:** `app/Actions/Messages/GeneralAccessAction.php`

This action encapsulates the single access rule for all system/default channels. It is called from every relevant controller method **before** any Q/H execution whenever the conversation has `is_system = true`.

```php
<?php

namespace App\Actions\Messages;

use App\Models\Conversation;

class GeneralAccessAction
{
    /**
     * Returns true if the user may interact with this system channel.
     * Rule: system channels require accounts.status = 1 (active).
     *
     * @param  Conversation  $conversation
     * @param  \App\Models\Account  $user
     * @return bool
     */
    public static function check(Conversation $conversation, $user): bool
    {
        if (!$conversation->is_system) {
            return true; // non-system channels bypass this guard
        }

        return (int) $user->status === 1;
    }

    /**
     * Standard 403 rejection payload for inactive accounts.
     */
    public static function denyResponse(): array
    {
        return [
            'success' => false,
            'message' => 'Your account is inactive. Please contact HR to restore access.',
            'code'    => 'ACCOUNT_INACTIVE',
        ];
    }
}
```

**Integration points in `MessagesController`** — add the guard to every system-channel-relevant action:

```php
// Pseudocode — applied inside each method after fetching $conversation:
if ($conversation->is_system && !GeneralAccessAction::check($conversation, $user)) {
    return response()->json(GeneralAccessAction::denyResponse(), 403);
}
```

Methods that require the guard:
- `getMessages()` — reading General messages
- `sendMessage()` — posting to General
- `getThreadReplies()` — reading thread replies in General
- `sendMessage()` (thread reply branch) — replying in General thread
- `markConversationAsRead()` — mark-read for General
- `sendTypingEvent()` — typing indicator for General
- `toggleReaction()` — reactions in General
- `editMessage()` — editing own message in General
- `deleteMessage()` — deleting own message in General
- `uploadAttachment()` — attaching files in General (validated via conversation context)

Methods **not guarded** (General is always publicly readable at the metadata level):
- `getConversations()` — General appears in the list for all active authenticated employees
- `getConversationMembers()` — returns a placeholder/count for system channels (see §4.3 note below)

**`getConversationMembers()` behaviour for General:**
Since General has no real `conversation_members` rows, the endpoint must detect `is_system = true` and return:
```json
{
  "success": true,
  "is_system": true,
  "member_count": "<count of accounts with status=1>",
  "members": [],
  "message": "General is a company-wide channel. All active employees have access."
}
```
Do **not** return a real list of all active accounts — this could be thousands of rows.

**`GetConversationsQuery` changes:**
- The existing `$isDefault` flag derivation (`empty($conv->created_by) || in_array(...)`) must be extended to also set `is_system` from the new column:
  ```php
  'is_system' => (bool)($conv->is_system ?? $isDefault),
  ```
- The response shape already includes `isDefault`; add `is_system` as an alias for forward-compatibility.

**`SearchMentionsQuery` changes:**
- When `conversation_id` refers to a system channel (General), the people query must filter `accounts.status = 1` (active only). Inactive employees must not appear in mention search results.
- The `@all` and `@here` special mentions resolve to active employees only: use `Account::where('status', 1)->count()` for the audience size label.

---

## 5. Frontend Design System & Architecture

The implementation resides in `resources/views/mobapp/`:

### 5.1 Shopify Restyle Theme Foundation (Unified Design System)
All messaging screens must strictly utilize the existing Restyle tokens defined in `src/theme/index.ts`:

- **Colors**:
  - `background`: `#F8FAFC` (Light) / `#0A1128` (Dark)
  - `surface` & `card`: `#FFFFFF` (Light) / `#1E293B` (Dark)
  - `cardAlt`: `#F1F5F9` (Light) / `#0F172A` (Dark)
  - `cardBorder` & `border`: `#E2E8F0` (Light) / `#334155` (Dark)
  - `primary` & `chestnutAccent`: `#CB793A` (Light) / `#E2A35A` (Dark) — Employee Portal Golden Chestnut
  - `primaryBg`: `#FBF0E3` (Light) / `rgba(203, 121, 58, 0.15)` (Dark)
  - `info` & `cyanAccent`: `#0284C7` (Light) / `#00E5FF` (Dark)
  - `infoBg`: `#EFF6FF` (Light) / `rgba(0, 229, 255, 0.25)` (Dark)
  - `textHeading`: `#0F172A` (Light) / `#FFFFFF` (Dark)
  - `text`: `#0F172A` (Light) / `#F8FAFC` (Dark)
  - `textSecondary`: `#64748B` (Light) / `#CBD5E1` (Dark)
  - `textMuted`: `#94A3B8` (Light) / `#94A3B8` (Dark)
  - `danger`: `#EF4444` / `dangerBg`: `#FEF2F2` (Voice recording & destructive actions)
- **Typography**:
  - Header: `26px / 700`
  - Subhead / Sender Title: `15px / 600`
  - Body: `14px / 400 (lineHeight: 20)`
  - Caption / Timestamps: `12px / 500`
  - Small / Badges: `11px / 600`
- **Spacing & Radii**:
  - Spacing tokens: `xs (4)`, `s (8)`, `sm (10)`, `m (16)`, `ml (20)`, `l (24)`, `xl (32)`
  - Border Radii: `xs (4)`, `s (8)`, `m (12)`, `xl (16)`, `full (9999)`
  - Avatars: `28px` (inline message), `36px` (header/thread), `46px` (conversation list), `56px` (hero/profile)
  - Touch Target Minimum: `48px` x `48px` for all interactive buttons

---

### 5.2 Module Architecture & File Map

```text
resources/views/mobapp/src/module/employee/messages/
├── index.ts                         ← Barrel exports
├── types.ts                         ← TypeScript interfaces (Conversations, Messages, Threads)
├── contexts/
│   └── MessagesContext.tsx          ← Global messages state & unread synchronization
├── hooks/
│   ├── useMessages.ts               ← Inbox list, category filters, and search
│   ├── useChatRoom.ts               ← Active conversation hook (messages, pagination, polling, typing)
│   ├── useAudioRecorder.ts          ← Audio recording, metering waveform, and export
│   └── useThread.ts                 ← [NEW] Scoped hook for thread root and replies
├── services/
│   └── messages.api.ts              ← Unified API layer & fallback mock store
├── utils/
│   ├── messagePreview.ts            ← Universal latest-message formatter
│   └── mentionParser.ts             ← [NEW] Pure segment parser for @mentions and URLs
├── components/
│   │   // Design Foundation & Landing
│   ├── MessagesHeroHeader.tsx       ← Redesigned landing header with '⋮ More' action
│   ├── MessagesActionMenu.tsx       ← Mobile bottom sheet menu (New Chat, Create Group, etc.)
│   ├── MessagesSearchBar.tsx        ← Search input with instant clear
│   ├── ActiveStoriesRow.tsx         ← Online colleagues presence reel
│   ├── ConversationListItem.tsx     ← Redesigned card (avatar, delivery ticks, unread pill)
│   │   // Flows & Modals
│   ├── NewChatModal.tsx             ← Modernized employee search & direct chat initiation
│   ├── CreateGroupModal.tsx         ← Multi-step team channel creation (members, name, submit)
│   ├── MessageActionModal.tsx       ← Contextual message menu (Reply, Thread, Copy, Edit, Delete)
│   ├── ForwardMessageModal.tsx      ← Share message to another conversation
│   │   // Slack-Inspired Message Component System
│   ├── MessageRow.tsx               ← [NEW] Slack-inspired message layout wrapper
│   ├── MessageHeader.tsx            ← [NEW] Sender name, role badge, timestamp, and edit indicator
│   ├── MessageAvatar.tsx            ← [NEW] Unified avatar component with presence dot
│   ├── MessageContent.tsx           ← [NEW] Styled text with dual-color mention pills and links
│   ├── MessageAttachment.tsx        ← [NEW] Image grid, video player, and file download cards
│   ├── MessageReaction.tsx          ← [NEW] Emoji reaction pills with active user toggle
│   ├── MessageThreadPreview.tsx     ← [NEW] Inline thread replies trigger (count + avatars)
│   ├── ChatDateDivider.tsx          ← Centered calendar day divider
│   │   // Modern Composer System
│   ├── ChatInputBar.tsx             ← Dynamic expanding composer with voice, emoji, and attachments
│   ├── EmojiPickerPanel.tsx         ← Grid emoji selector with search and categories
│   ├── ChatToolsDrawer.tsx          ← Media, document, and HR ticket attachment drawer
│   └── VoiceRecordingBar.tsx        ← [NEW] Dedicated recording state with waveform and timer
└── pages/
    ├── MessagesScreen.tsx           ← Redesigned landing inbox page
    ├── ConversationScreen.tsx       ← Redesigned Slack-inspired chat room
    └── ThreadScreen.tsx             ← [NEW] Dedicated slide-in thread discussion view
```

---

### 5.3 Detailed Screen Specifications

#### 1. Messages Landing Screen (`MessagesScreen.tsx`)
- **Header**: Clean corporate header featuring Chats title, online member count, active unread counter, search trigger, and `⋮ More` icon button.
- **Search Bar**: Centered, rounded input with instant query debouncing across names, job titles, and message text.
- **Stories Presence Reel**: Horizontal list of frequent and active team members with status rings.
- **Filter Chips**: `All Chats`, `Direct`, `Channels`, `Announcements`, `Requests`.
- **List View**: Fluid virtualized list of `ConversationListItem` with pull-to-refresh.

#### 2. Messages Screen Actions (`MessagesActionMenu.tsx`)
- Triggered by `⋮ More`.
- Slides up from bottom of screen with dark backdrop overlay.
- Items:
  - `New Chat`: Starts employee search for direct 1-on-1 dialogue.
  - `Create Group`: Initiates multi-member channel workflow.
  - `Message Requests`: Opens incoming inquiry queue with pending badge.
  - `Mark All as Read`: Clears local and backend unread counters.

#### 3. Conversation List Items & Previews
- **Avatar**: 46px round image with emerald green status dot if colleague is online.
- **Title Row**: Recipient or Channel Name (bold if unread) + Pin icon + Timestamp.
- **Preview Row**:
  - Delivery ticks (single check = sent, double check = read).
  - Preview snippet derived from `formatLatestMessagePreview()`:
    - Normal text → verbatim snippet.
    - Image → `Sent a photo`
    - Video → `Sent a video`
    - Audio → `Sent a voice message`
    - File → `Sent a file`
    - Empty → `No messages yet`
  - Unread count pill in primary golden chestnut gradient (`#CB793A` to `#D97706`).

#### 4. New Chat Flow (`NewChatModal.tsx`)
- Modern modal sheet with search input, instant filtering, and clean list of colleagues.
- Displays full name, department, role, and online presence.
- Tapping colleague checks existing conversations first; if present, immediately opens it; otherwise, creates new DM.

#### 5. Create Group Flow (`CreateGroupModal.tsx`)
- **Step 1: Member Multi-Selection**: Search colleagues; tap to select. Selected members appear as removable avatar chips above list with an animated badge.
- **Step 2: Group Information**: Input group name, optional description, and select initial channel type (`channel` or `announcement`).
- **Step 3: Confirmation**: Summary card showing total members, creator role, and "Create Team Channel" submit button with loading spinner.

#### 6. Message Requests Flow
- Filtered tab or dedicated view in `MessagesScreen`.
- Lists inquiries and requests from non-frequent contacts or pending filings.
- Quick actions: "Accept & Chat", "Decline", or "View Application".

#### 7. Slack-Inspired Conversation Screen (`ConversationScreen.tsx`)
- **Header**: Back arrow (`<ArrowLeft>`), recipient/group avatar, title, member count / online status, and optional call/tools actions.
- **Message Stream**:
  - Left-aligned open feed (no bulky speech bubble containers).
  - Avatar on the left gutter (`28px`).
  - MessageHeader with sender's name in bold, department tag, and timestamp (`10:42 AM`).
  - Consecutive grouping: subsequent messages from same sender within 5 minutes hide the avatar and header, aligning directly under the text margin.
  - Linked HRMS Tickets embedded cleanly as interactive cards (`Sick Leave #LV-2026-001`, `Pending`).
  - Reaction pills docked below content with emoji icon and reactor counts.

#### 8. Modern Message Composer (`ChatInputBar.tsx` & `VoiceRecordingBar.tsx`)
- **Resting State**:
  - Dynamic multiline input supporting up to 5 lines of text before internal scrolling.
  - Attachment icon (`+`) opening media & filing drawer.
  - Smiley icon (`Smile`) opening emoji picker.
  - Microphone icon (`Mic`) when text is empty; transforms into glowing Send button (`Send`) when text length > 0.
- **Mention Trigger**:
  - Typing `@` triggers popup above input listing colleagues.
  - Mentions insert formatted `@Name ` token.
  - On render, `@self` is highlighted in golden chestnut (`#CB793A`), `@others` highlighted in blue (`#0284C7`).
- **Voice Recording State**:
  - Tapping `Mic` swaps composer into recording mode.
  - Displays red pulsing indicator, duration timer (`00:12`), dynamic audio waveform bars, Cancel/Delete button, and Send button.

#### 9. Threads (`ThreadScreen.tsx` & `MessageThreadPreview.tsx`)
- **Trigger**: In `ConversationScreen`, message action sheet includes `Reply in thread`. Messages with existing replies display `MessageThreadPreview` showing reply count (`3 replies`) and last reply time.
- **Thread Screen**:
  - Pinned Root Message at top with complete context.
  - Chronological replies stream.
  - Scoped composer at bottom (`Reply in thread...`).
  - Live back navigation returns seamlessly to the main channel.

---

## 6. Business Rules & Edge Cases

### 6.1 HRMS Domain & Messaging Rules
1. **Manager Channel Separation**: Channels flagged with `role: 'manager'` are restricted to accounts with `role_access` in `[1, 2, 7]`. Regular employees cannot view or search these channels.
2. **Announcements Read-Only for Employees**: Broadcast channels allow employees to view and react with emoji, but the text composer is disabled with the warning notice: `"Only HR administrators can broadcast to this channel"`.
3. **Duplicate Conversation Guard**: Starting a chat with a colleague checks existing direct conversations before issuing `POST /api/employee/messages/conversations`.
4. **Optimistic Updates & Resilience**: Messages are appended optimistically with `pending: true`. If the network fails, status shifts to `failed: true` with a retry prompt without dropping drafted text.
5. **Mark as Read**: Opening a conversation debounces a call to `/read` and updates bottom tab badge counts silently.

### 6.3 General Default Channel Rules

| Rule | Enforcement |
|---|---|
| General is a system/default channel | `is_system = true`, `created_by = null`; seeded once via migration. |
| Membership is automatic | No `conversation_members` rows needed for access. Active account = General member. |
| Access gate | `GeneralAccessAction::check()` runs on every write/read endpoint. `accounts.status = 1` is the sole criterion. |
| Inactive employees are denied | API returns `403 { code: 'ACCOUNT_INACTIVE' }`. Frontend shows activation message. |
| No self-activation | The inactive-state UI shows contact-HR instruction only. No activation button. HR controls account status via the existing HR portal workflow. |
| Message history preserved | Deactivating an account does NOT delete the employee's past General messages. |
| Reactivation restores access | `accounts.status` returning to `1` is sufficient. No re-join step needed. |
| No member-management UI | `Add members`, `Remove member`, `Invite`, and `Leave channel` are hidden for General (`isDefault: true` or `is_system: true`). |
| Mention audience active-only | `@all`, `@here`, `@channel` in General resolve to employees with `accounts.status = 1` only. |
| Mention search active-only | People in mention picker filtered to `accounts.status = 1` regardless of channel. |
| `getConversationMembers` for General | Returns `{ is_system: true, member_count: N, members: [] }` — not a real member list. |

### 6.4 Edge Cases

| Scenario | Expected Behaviour |
|---|---|
| Employee account deactivated mid-session (token still valid) | Next API call to a General endpoint returns `403 ACCOUNT_INACTIVE`. Frontend should handle 403 and show the activation banner. |
| Active employee has no `conversation_members` row for General | `markConversationAsRead` uses `updateOrInsert` — creates the row on first read, no error. |
| Inactive employee's General messages | Remain in DB; not purged. Other active employees continue to see the messages. |
| `@all` sent to General with 500+ active employees | Backend resolves audience server-side. Mobile app does not load all 500 accounts. |
| Two simultaneous `markConversationAsRead` calls from same user | `updateOrInsert` with unique constraint on `(conversation_id, account_id)` — idempotent. |
| Admin sets `is_system = false` on General via direct DB edit | `GeneralAccessAction::check()` no longer fires; General behaves as a normal public channel. Not a supported workflow. |
| New employee created but not yet activated | Account created with `status = 0` by default; General access granted only after HR sets `status = 1`. |

### 6.2 Non-Functional & Failure-Mode Checklist

| Category | Specification & Behavior |
|---|---|
| **Authorization** | All endpoints require active Sanctum bearer token. Expired token (`401`) redirects to login. Accessing a non-member conversation returns `403 {"success": false, "message": "Unauthorized"}`. |
| **Concurrency / double-submit** | Send button is disabled while `isSending` is true. `ChatInputBar` debounce guards against rapid double-tapping. Voice recording button enforces single active recording instance. |
| **Idempotency on retries** | Outgoing messages include client UUID (`clientId`); backend deduplication prevents duplicate messages within a 2-second replay window. |
| **Error response shape & status codes** | Unauthenticated: `401 {"message": "Unauthenticated"}`<br>Forbidden: `403 {"success": false, "message": "Unauthorized"}`<br>Not Found: `404 {"success": false, "message": "Not found"}`<br>Validation: `422 {"success": false, "errors": {...}}`<br>Server Error: `500 {"success": false, "message": "Server error"}` |
| **Input validation boundaries** | Empty or whitespace-only messages cannot be dispatched. Message body capped at 4,000 characters. Attachments limited to 10MB each, restricted to MIME types: `image/*`, `video/mp4`, `video/quicktime`, `audio/*`, `application/pdf`. |

---

## 7. Build Order & Implementation Phases

Implementation strictly follows the MVP priorities:

### Phase P0 — Foundation & Landing
1. **Design System Tokens Alignment**: Verify Restyle theme tokens in `src/theme/index.ts` for messaging colors, typography, and avatar sizing.
2. **Latest Message Preview Formatter**: Verify `utils/messagePreview.ts` handles all six preview types (`Text`, `Photo`, `Video`, `Voice`, `File`, `No messages yet`).
3. **Messages Landing Screen Redesign (`MessagesScreen.tsx`)**: Rebuild the top header, search bar, active colleagues reel, and filter chips.
4. **More Actions Menu (`MessagesActionMenu.tsx`)**: Replace `+` with `⋮ More` button triggering the bottom sheet with `New Chat` and `Create Group`.
5. **Conversation List Items (`ConversationListItem.tsx`)**: Redesign cards with avatars, delivery checkmarks, and unread badges.
6. **New Chat Flow (`NewChatModal.tsx`)**: Rebuild employee search, selection, and conversation resolution.
7. **Create Group Flow (`CreateGroupModal.tsx`)**: Rebuild multi-select member picking, chip removal, and group creation.

### Phase P0.5 — General Default Channel (Backend)

> **Must run before P1** — the ConversationScreen depends on the `is_system` flag and the 403 response shape.

8. **Alter migration** — `add_is_system_to_conversations_table.php` in `database/migrations/alters/messages/`:
   - Add `is_system` boolean column (default false).
   - Back-fill General row: set `is_system = 1` where `LOWER(TRIM(name)) = 'general'` and `created_by IS NULL`.
9. **Conversation model** — add `is_system` to `$fillable` and `$casts`.
10. **`GeneralAccessAction`** — create `app/Actions/Messages/GeneralAccessAction.php` with `check()` and `denyResponse()` methods.
11. **`MessagesController`** — add `GeneralAccessAction::check()` guard to all relevant methods (getMessages, sendMessage, getThreadReplies, markConversationAsRead, sendTypingEvent, toggleReaction, editMessage, deleteMessage, uploadAttachment context).
12. **`getConversationMembers()`** — add system-channel short-circuit returning `{ is_system: true, member_count: N, members: [] }` for General.
13. **`GetConversationsQuery`** — extend response payload with `is_system` field.
14. **`SearchMentionsQuery`** — add `accounts.status = 1` filter to people search.

### Phase P1 — Core Communication
15. **Slack-Inspired Conversation Redesign (`ConversationScreen.tsx`)**: Implement the open feed stream, replacing speech bubbles with gutter-aligned messages.
    - Handle `403 ACCOUNT_INACTIVE` response: hide composer and message list, show inactive-state banner.
16. **Message Component System**:
    - Create `MessageRow.tsx` (Slack layout container).
    - Create `MessageHeader.tsx` (name, department, timestamp).
    - Create `MessageAvatar.tsx` (consistent avatar with presence dot).
    - Create `MessageContent.tsx` (rich text, URLs, and dual-color mentions).
    - Create `MessageAttachment.tsx` (image grid, inline video, documents).
    - Create `MessageReaction.tsx` (emoji reaction pills).
17. **Modern Message Composer (`ChatInputBar.tsx`)**:
    - Rebuild auto-expanding multiline input and keyboard handling.
    - Integrate media and file attachment triggers.
    - Suppress composer entirely when `isSystemChannelLocked` prop is true (inactive user in General).
18. **General Inactive State UI** — in `ConversationScreen.tsx`:
    - Detect `isSystem && accountInactive` from API 403 or from conversation + account state.
    - Render `GeneralInactiveBanner`: card with warning icon, title `"Account Inactive"`, body `"Activate your account to view this channel. Please contact HR to activate your account."`, no activation button.
19. **Mentions Integration**:
    - Build `@` mention trigger popup.
    - Implement dual-color highlights (`#CB793A` golden chestnut for `@self`, `#0284C7` blue for `@others`).
20. **Channel Info / Manage Panel** — for General (`isDefault: true` or `is_system: true`):
    - Hide `Add members`, `Remove member`, `Invite`, `Leave channel` actions.
    - Show description: `"Everyone with an active HRMS account has access to this channel."`.
21. **Contextual Message Actions (`MessageActionModal.tsx`)**: Implement contextual sheet (`Reply`, `Reply in thread`, `React`, `Copy`, `Edit`, `Delete`).
22. **Message Requests Redesign**: Redesign the requests tab with accept/decline actions and unified preview.

### Phase P2 — Advanced Messaging
23. **Threads Implementation**:
    - Build `MessageThreadPreview.tsx` in message rows.
    - Implement `ThreadScreen.tsx` with pinned root message, reply stream, and reply composer.
    - Wire `useThread` hook with thread message fetching and sending.
    - Apply General inactive guard to thread composer as well.
24. **Emoji Integration (`EmojiPickerPanel.tsx`)**:
    - Redesign emoji panel with categories, search, and cursor-position insertion.
25. **Voice Messaging & Waveform (`VoiceRecordingBar.tsx`)**:
    - Rebuild recording state inside composer with pulsing record dot, timer, real-time waveform bars, cancel, and send.
    - Integrate audio file upload and playback bubble (`ChatAudioBubble.tsx`).

### Phase P3 — Final Quality & Polish
26. **Full Navigation & Transition Polish**: Verify smooth horizontal slide navigation across Messages → New Chat → Conversation → Thread.
27. **Mobile UX Pass**: Test touch target sizes (min 48px), keyboard dismissals, outside-tap sheet closing, and safe-area insets.
28. **Performance Optimization**: Profile `FlatList` rendering, memoize `MessageRow` items, and prevent redundant re-renders.
29. **Final MVP Review**: Complete verification of all AC criteria (AC-1 through AC-47).

---

## 8. Out of Scope (Deliberately Excluded)

- **Web Browser Messaging Redesign**: Excluded from this MVP. Web redesign will be specified and implemented separately following mobile app completion.
- **WebRTC Live Voice / Video Calling**: Informational/placeholder buttons only in this phase.
- **End-to-End Encryption (E2EE) Key Exchange**: Standard HTTPS transport security is utilized.
- **Rich Text Markdown WYSIWYG Formatting Toolbar**: Raw text and mentions are supported.

---

## 9. Definition of Done

- [ ] Every row in the **Acceptance Criteria** table passes (`AC-1` through `AC-47`).
- [ ] Every category in the **Non-Functional & Failure-Mode Checklist** is addressed.
- [ ] Messages landing screen features modern corporate header, `⋮ More` action, search, and conversation list.
- [ ] Latest message preview strictly outputs `Text`, `Sent a photo`, `Sent a video`, `Sent a voice message`, `Sent a file`, or `No messages yet`.
- [ ] `New Chat` and `Create Group` flows are fully modernized with colleague multi-selection.
- [ ] Conversation screen utilizes a Slack-inspired workplace communication feed instead of personal chat bubbles.
- [ ] Message Component System is modular and reusable (`MessageRow`, `MessageHeader`, `MessageContent`, etc.).
- [ ] Modern composer supports dynamic height expansion, dual-color mentions (`@self` vs `@others`), emoji picker, and voice recording with waveform.
- [ ] Threads feature root message pinning, reply stream, and dedicated composer.
- [ ] **General Default Channel — System channel is seeded** (`is_system = true`, `created_by = null`, `is_private = false`).
- [ ] **`GeneralAccessAction` guards every write/read endpoint** — inactive accounts receive `403 { code: 'ACCOUNT_INACTIVE' }` on all General operations.
- [ ] **Inactive-state UI is implemented** — `ConversationScreen` shows the activation banner instead of messages/composer for inactive users in General.
- [ ] **Member management is suppressed for General** — no Add, Remove, Invite, or Leave actions visible when `is_system = true`.
- [ ] **`SearchMentionsQuery` filters active employees only** — inactive accounts do not appear in mention picker.
- [ ] **`getConversationMembers` returns system-channel placeholder** for General — not a full member list.
- [ ] Verified on both iOS/Android mobile devices and desktop web viewports (`maxWidth: 640`).
- [ ] No open findings from adversarial verification (`verify.md`).
- [ ] No open `CRITICAL` or `HIGH` findings from diff review (`code-review.md`).

<!-- Changelog -->
- v2 — 2026-09-12 — Full MVP redesign of entire mobile messaging module: Messages landing, Conversation list & preview, More menu actions, New Chat, Create Group, Message Requests, Slack-inspired Conversation, Message Component System, Composer, Mentions, Emoji, Message Actions, Threads, and Voice recording.
- v1 — 2026-09-08 — initial fullscreen stack transition spec.
