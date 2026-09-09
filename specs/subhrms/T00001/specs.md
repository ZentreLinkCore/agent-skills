# Spec — Mobile App Messages Redesign (Fullscreen & Cross-Platform)

> **Ticket:** `T00001` (subhrms) — this file is `.agents/specs/subhrms/T00001/specs.md`; branch `T00001`.
> **Kind:** Extension / Redesign — mobile app chat & messaging redesign with fullscreen stack transitions.
> **Portal:** **employee** (`/api/employee/messages/...` routes, `resources/views/mobapp/src/module/employee/messages`).
> **Version:** v1 — 2026-09-08 — initial.
> **Route:** `/(app)/conversation` (fullscreen pushed chat) & `/(app)/(tabs)/messages` (inbox directory).
> **Conventions:** [project-profile.md](../../rules/project-profile.md), [hrms-rules](../../rules/hrms-rules.md).
> **System Awareness:** Models: `Conversation`, `Message`, `MessageAttachment`, `MessageReaction` (reused); Tables: `conversations`, `messages`, `conversation_members`, `message_attachments`, `message_reactions` (reused); Routes: `routes/api/employee.php` (`api/employee/messages/*`, reused); New migration: no.

---

## 1. Purpose

The mobile application (`resources/views/mobapp`) currently contains a basic prototype of the messages feature. However, opening a conversation currently swaps views inline inside the bottom tab container. This causes three critical UX defects:
1. **Trapped Viewport**: The active chat conversation is cramped between the fixed `AppTopHeader` at the top and the `CustomTabBar` at the bottom, sacrificing over 35% of usable chat screen real estate.
2. **Missing Native Transitions**: Tapping a conversation immediately toggles an inline state without any slide or push transition. Tapping back abruptly clears state without a pop animation.
3. **Design Disparity**: The existing Vue mobile implementation (`resources/views/mobapp-vue`) featured a rich hero header with ambient background shapes, active stories/status bubbles, grouped bubble styling with distinct incoming/outgoing tails, and interactive input controls (attachment, voice/send morphing). The current Expo React Native app (`mobapp`) lacks these visual flourishes and is not yet optimized for both web browser viewports and mobile device form factors.

This specification redesigns the Mobile App Messages module into a **fullscreen, cross-platform (Web & Mobile Native) chat experience**, with a dedicated pushed route `/(app)/conversation`, native 60/120fps slide transitions on iOS/Android, hardware-accelerated CSS keyframe transitions on Web, and a polished design system adhering to the warm amber & cyber slate theme of Zentre Link Core.

---

## 2. Design Decisions (Pros & Cons)

### Decision 1: Navigation Architecture for Fullscreen Conversation

**Option A — Separate Pushed Stack Route `/(app)/conversation` (Recommended)**
- Register `conversation` as a child route of the parent `(app)/_layout.tsx` Stack, sitting as a sibling of `(tabs)`.
- When tapping any conversation in the `messages` tab or clicking a message notification, the app navigates via `router.push({ pathname: '/(app)/conversation', params: { id, name, type, avatar } })`.
- Wrapped in `PushedScreenWrapper`, automatically rendering outside `AppTopHeader` and `CustomTabBar`.

| Pros | Cons |
|---|---|
| 100% True Fullscreen: Hides both `AppTopHeader` and `CustomTabBar` automatically. | Requires routing parameter passing and re-fetching or hydrating conversation data from cache. |
| Native 60/120fps `slide_from_right` transition on iOS/Android native stack, and hardware-accelerated web keyframe transition on web. | Header actions must be handled within the pushed screen rather than shared tab header. |
| Standard native back behavior: iOS swipe-to-pop gesture, Android hardware back, and web browser history back all work out-of-the-box. | Slight memory overhead of a pushed stack screen vs conditional in-place component swap. |

**Option B — Modal Sheet / Modal Stack Presentation**
- Open the conversation as a full-height presentation modal (`presentation: 'modal'` or `presentation: 'fullScreenModal'`).

| Pros | Cons |
|---|---|
| Distinguishes temporary chat sessions from standard pushed pages. | iOS default modal presentation leaves a card top gap and doesn't match standard chat messaging conventions (e.g. WhatsApp, Telegram, iMessage). |
| Easy pull-down-to-dismiss gesture on iOS. | Web presentation of fullScreenModal can cause awkward backdrop rendering and keyboard offset bugs. |

**Recommendation:** **Option A**. Standard messaging apps use horizontal push/pop screen transitions. Pushing `/(app)/conversation` into the existing `(app)` Stack matches the architecture of `apply.tsx`, `ai-chat.tsx`, and `requests.tsx`.

---

### Decision 2: Web & Native Cross-Platform Layout Strategy

**Option A — Responsive Centered Container on Web + Edge-to-Edge on Mobile (Recommended)**
- On Native Mobile (iOS / Android): 100% full width and height with safe area insets applied to top bar and bottom input footer.
- On Web (Browser / Desktop / Tablet): Constrain the chat viewport to a centered max-width (e.g., `maxWidth: 640`, `width: '100%'`, `marginHorizontal: 'auto'`), with `100dvh` viewport height handling, subtle border, and shadow. Keyboard handler sends on `Enter` and linebreaks on `Shift + Enter`.

| Pros | Cons |
|---|---|
| Looks intentional and premium on desktop/tablet browsers without stretching message bubbles 1800px wide. | Needs platform-conditional styling (`Platform.OS === 'web'`). |
| Natural edge-to-edge feel on mobile devices. | Web needs explicit viewport height management (`100dvh` / `100%`). |
| Perfect parity with modern desktop chat apps (WhatsApp Web, Slack, Telegram). | None of significance. |

**Option B — Pure 100% Full-Width Stretch on All Platforms**
- Render full screen width regardless of device screen width.

| Pros | Cons |
|---|---|
| Simpler CSS with fewer platform checks. | On desktop monitors (>1024px), text bubbles stretch across the entire screen, ruining chat readability and visual hierarchy. |

**Recommendation:** **Option A**. Ensuring the redesign fits seamlessly on Web and App requires a responsive container on desktop web viewports while remaining edge-to-edge on mobile phones.

---

### Decision 3: Stories / Active Contacts Row Design

**Option A — Active Colleague & Broadcasts Horizontal Reel (Adapted from `mobapp-vue`) (Recommended)**
- Display a horizontal scrolling carousel above the conversation list:
  1. "+ New Chat / Compose" shortcut button.
  2. Quick contact pills with glowing active presence rings (green dot for online, amber gradient border for HR/Announcements).
  3. Tapping a contact immediately opens or creates a direct conversation and slides to fullscreen chat.

| Pros | Cons |
|---|---|
| Direct parity with the popular `mobapp-vue` status/story aesthetic. | Requires horizontal scroll container space (~96px height) above the conversation list. |
| High engagement: allows one-tap direct messaging to frequent or online colleagues. | Contacts list must be populated from `api/employee/messages/recipients`. |

**Option B — Flat List Only (No Horizontal Carousel)**
- Only show the vertical conversation list without any top horizontal reel.

| Pros | Cons |
|---|---|
| Saves vertical screen space. | Loses the vibrant social/mobile feel of `mobapp-vue` and feels more like a plain email client. |

**Recommendation:** **Option A**. The user explicitly requested redesigning the feature incorporating the existing design in `mobapp-vue`. The stories/active contacts reel is one of the marquee UI elements in `mobapp-vue`.

---

## 2.5 Acceptance Criteria

| # | Given | When | Then |
|---|-------|------|------|
| AC-1 | User is on the mobile Messages tab (`/(app)/(tabs)/messages`) | User views the top section of the inbox | Displays the ambient hero header with Chats title, unread count badge, search bar, and active colleagues carousel reel. |
| AC-2 | User taps the search bar and types "HR" | Search query is updated | The conversation list filters in real-time to match conversations with "HR" in name or last message snippet. |
| AC-3 | User selects a category filter chip ("Channels" or "Direct") | Category filter is clicked | The conversation list updates instantly to show only conversations matching the selected type. |
| AC-4 | User is viewing the conversation list and taps on any conversation card | Conversation card is tapped | The app pushes to `/(app)/conversation` with `slide_from_right` animation; `AppTopHeader` and bottom `CustomTabBar` are hidden; view is 100% fullscreen. |
| AC-5 | User is inside the fullscreen conversation view | User taps the header back button (`<ArrowLeft>`) | The screen performs a reverse slide-out animation to the right and pops back to the Messages inbox list. |
| AC-6 | User is on iOS or Android and swipes from the left edge | Swipe-to-back gesture is performed | The screen interactively drags and pops back cleanly to the Messages inbox list. |
| AC-7 | User is inside the fullscreen conversation view | Messages are loaded from `api/employee/messages/conversations/{id}/messages` | Messages are displayed in chronological grouped bubbles; outgoing messages have warm amber styling with delivered/read checkmarks; incoming messages display sender name, avatar on group end, and surface card styling. |
| AC-8 | A message has an associated ticket (`linked_ticket_id`) | Message bubble renders | An embedded interactive Ticket Badge (e.g. `Sick Leave #LV-2026-001`, Pending status) renders inside the bubble with status badge coloring. |
| AC-9 | User types text in the message input field | Input text has length > 0 | The action button smoothly transforms from microphone (`Mic`) to a glowing send button (`Send` / `ArrowUp`). |
| AC-10 | User presses Send button or hits `Enter` on Web (without Shift) | Message is dispatched | The message appears optimistically in the chat list with "Just now" timestamp, scrolls to bottom, input clears, and payload is POSTed to backend. |
| AC-11 | User opens conversation in Web browser at screen width >= 1024px | Browser viewport is large | The conversation is centered with a max-width of 640px, full viewport height (`100dvh`), and input bar anchored cleanly at the bottom without horizontal stretch. |
| AC-12 | Network connection fails or backend errors while sending a message | Send API call rejects | Optimistic message shows an error/retry indicator or toast notification without crashing the screen. |
| AC-13 | User receives new messages while inside the active conversation | Polling or incoming event fires | New messages append to the bottom of the list and the view smoothly auto-scrolls down. |

---

## 3. Database

No new tables or migrations required. The system reuses the existing, production-verified database schema in `database/migrations/table/messages/`:

### 3.1 Reused Tables
- **`conversations`**:
  - `id` (bigint, PK)
  - `name` (string) — channel name or conversation title
  - `type` (enum: `channel`, `dm`, `announcement`)
  - `description` (string, nullable)
  - `role` (string, default `all`)
  - `created_at`, `updated_at` (timestamps)
- **`conversation_members`**:
  - `id` (bigint, PK)
  - `conversation_id` (bigint, indexed, FK to `conversations.id`)
  - `account_id` (bigint, indexed, FK to `accounts.id`)
  - `last_read_message_id` (bigint, nullable, default 0)
  - `created_at`, `updated_at` (timestamps)
- **`messages`**:
  - `id` (bigint, PK)
  - `conversation_id` (bigint, indexed, FK to `conversations.id`)
  - `sender_id` (bigint, indexed, FK to `accounts.id`)
  - `text` (text, nullable)
  - `reply_to_id` (bigint, nullable, FK to `messages.id`)
  - `linked_ticket_id` (string, nullable, indexed)
  - `linked_ticket_type` (string, nullable)
  - `linked_ticket_title` (string, nullable)
  - `linked_ticket_status` (string, nullable)
  - `linked_ticket_status_color` (string, nullable)
  - `created_at`, `updated_at` (timestamps)
- **`message_attachments`**:
  - `id` (bigint, PK)
  - `message_id` (bigint, FK to `messages.id`)
  - `name`, `size`, `type`, `path`
- **`message_reactions`**:
  - `id` (bigint, PK)
  - `message_id` (bigint, FK to `messages.id`)
  - `account_id` (bigint, FK to `accounts.id`)
  - `emoji` (string)

---

## 4. Backend

All required backend controllers, queries, handlers, and routes already exist and are fully implemented in Laravel. The mobile app connects to these established endpoints.

### 4.1 Reused API Endpoints (`routes/api/employee.php`)
- `GET /api/employee/messages/unread-count`: Returns `{ success: true, data: { unread_count: number } }`
- `GET /api/employee/messages/conversations`: Returns `{ success: true, data: MessageConversation[] }`
- `GET /api/employee/messages/conversations/{id}/messages`: Returns `{ success: true, data: MessageItem[], typing: { is_typing: bool, user: string } }`
- `POST /api/employee/messages/conversations/{id}/messages`: Payload `{ text: string, reply_to_id?: number }` -> Returns `{ success: true, data: MessageItem }`
- `POST /api/employee/messages/conversations/{id}/read`: Marks conversation as read in DB & Cache
- `POST /api/employee/messages/conversations/{id}/typing`: Broadcasts typing state
- `GET /api/employee/messages/recipients`: Returns eligible colleagues for starting a new chat
- `POST /api/employee/messages/conversations`: Creates new DM or channel

### 4.2 Query & Handler Classes
- `App\Queries\Messages\GetConversationsQuery::execute()`
- `App\Queries\Messages\GetMessagesQuery::execute(['conversation_id' => $id, 'since_id' => $sinceId])`
- `App\Handlers\Messages\SendMessageHandler::execute($params)`
- `App\Handlers\Messages\ToggleReactionHandler::execute($params)`

---

## 5. Frontend

The frontend implementation lives in `resources/views/mobapp/`:

### 5.1 Route Structure
```
resources/views/mobapp/src/app/
├── (app)/
│   ├── _layout.tsx              ← Register <Stack.Screen name="conversation" options={{ animation: 'slide_from_right' }} />
│   ├── conversation.tsx         ← [NEW] Pushed fullscreen conversation screen
│   └── (tabs)/
│       ├── _layout.tsx          ← Tabs navigator (Home, Timesheet, FAB, Messages, Profile)
│       └── messages.tsx         ← Messages inbox directory tab (re-architected)
```

### 5.2 Module Component Layout
```
resources/views/mobapp/src/module/employee/messages/
├── index.ts                     ← Barrel exports
├── types.ts                     ← TypeScript interfaces
├── hooks/
│   ├── useMessages.ts           ← Hook for conversation directory, filters, and unread counts
│   └── useChatRoom.ts           ← [NEW] Hook for active fullscreen conversation (polling, sending, typing)
├── services/
│   └── messages.api.ts          ← API service methods
├── components/
│   ├── MessagesHeroHeader.tsx   ← Ambient background shapes, title, search, new chat action
│   ├── ActiveStoriesRow.tsx     ← [NEW] Horizontal active colleagues & broadcast stories reel
│   ├── ConversationListItem.tsx ← [NEW] Polished conversation card (avatar, delivery ticks, unread pill)
│   ├── ChatHeader.tsx           ← [NEW] Fullscreen chat top bar (back button, avatar, status, call actions)
│   ├── MessageBubbleGroup.tsx   ← [NEW] Grouped chat bubble with connected corners & linked tickets
│   └── ChatInputBar.tsx         ← [NEW] Auto-resizing input, attach button, morphing send/mic button
└── pages/
    ├── MessagesScreen.tsx       ← Redesigned inbox directory screen
    └── ConversationScreen.tsx   ← [NEW] Dedicated fullscreen chat room screen
```

### 5.3 Fullscreen Transitions & Animations
- **Native Slide (`slide_from_right`)**: Handled natively by Expo Router Stack in `(app)/_layout.tsx` at 60/120fps with zero JavaScript thread contention.
- **Web Slide Animation**: Leverages `PushedScreenWrapper` with CSS keyframe animation `cubic-bezier(0.16, 1, 0.3, 1)` and `transform: translateX(0%)` for smooth 280ms transition on browser navigation.
- **Back Navigation**: `<ArrowLeft>` button triggers `router.back()`, which triggers the reverse slide-out animation natively and on Web.
- **Edge Swipe Gesture**: Native iOS interactive pop gesture enabled automatically by the Stack navigator.

### 5.4 Visual Design Tokens & Theming
- **Backgrounds**: Dark Mode `#0F1B2E` (Deep Cyber Navy) / Light Mode `#F8FAFC` (Slate Surface).
- **Cards**: Dark Mode `#1E293B` / Light Mode `#FFFFFF` with `border: 1px solid cardBorder`.
- **Outgoing Message Bubble**: Warm Brand Amber Gradient (`linear-gradient(135deg, #CB793A, #D97706)`) with `#FFFFFF` text.
- **Incoming Message Bubble**: Dark Mode `#1E293B` with `#F1F5F9` text / Light Mode `#FFFFFF` with `#0F172A` text, subtle shadow, and border.
- **Unread Badge**: Gradient pill badge (`#CB793A` to `#D97706`) with white bold text.
- **Online Presence Indicator**: `#22C55E` (Emerald Green) dot with border matching card surface.

---

## 6. Business Rules & Edge Cases

### 6.1 HRMS Domain & Message Rules
1. **Manager Channel Separation**: Conversations flagged with `role: 'manager'` are restricted to users with `role_access` in `[1, 2, 7]` (Admin, Manager, Super Admin). Employees must not see or access manager channels.
2. **Announcements are Read-Only for Employees**: Broadcast / announcement channels allow employees to read and react, but disable the message text input bar (displays "Only HR administrators can broadcast to this channel").
3. **Optimistic Updates with Recovery**: When sending a message, the bubble appears immediately with status "sending". If the API fails, it displays an alert/retry prompt without dropping the user's drafted text.
4. **Mark as Read Debounce**: When opening a conversation, `markAsRead` is called immediately and the local unread count is decremented.

### 6.2 Non-Functional & Failure-Mode Checklist

| Category | Specification & Behavior |
|---|---|
| **Authorization** | All message endpoints require valid Sanctum token. If session expires (`401`), redirect to `/(auth)/login`. Users cannot view conversations they are not members of (`403 Forbidden` response `{"success": false, "message": "Unauthorized"}`). |
| **Concurrency / double-submit** | Send button is disabled while `isSending` is true. `ChatInputBar` prevents double-firing on multiple rapid taps. |
| **Idempotency on retries** | Outgoing messages sent with temporary client ID; backend checks ensure identical message deduplication if replayed within 2 seconds. |
| **Error response shape & status codes** | Unauthenticated: `401 {"message": "Unauthenticated"}`<br>Not Found: `404 {"success": false, "message": "Conversation not found"}`<br>Validation Failure: `422 {"success": false, "errors": {...}}`<br>Server Error: `500 {"success": false, "message": "Server error"}` |
| **Input validation boundaries** | Whitespace-only or empty messages cannot be sent. Text capped at 4,000 characters. Files/attachments validated against allowed types (image/jpeg, image/png, application/pdf) and max 10MB size. |

---

## 7. Build Order

1. **Gate 1: Frontend Routing & Screen Setup**:
   - Register `conversation` in `resources/views/mobapp/src/app/(app)/_layout.tsx`.
   - Create `resources/views/mobapp/src/app/(app)/conversation.tsx` using `PushedScreenWrapper`.
2. **Gate 1: Modular Components & Design Polish**:
   - Create `ActiveStoriesRow.tsx` for active colleagues and broadcast reel.
   - Create `MessagesHeroHeader.tsx` with ambient glowing background and search.
   - Create `ConversationListItem.tsx` with delivery ticks, avatars, and unread badges.
   - Create `ChatHeader.tsx` with back navigation, contact presence, and call actions.
   - Create `MessageBubbleGroup.tsx` with grouped corner curves and ticket cards.
   - Create `ChatInputBar.tsx` with auto-expanding input, attachment trigger, and morphing voice/send button.
3. **Gate 1: Screen Assembly & Transition Verification**:
   - Build `ConversationScreen.tsx` with full safe-area handling and responsive Web centering (`maxWidth: 640`).
   - Refactor `MessagesScreen.tsx` to display the hero header, stories reel, and filtered list, navigating to `/(app)/conversation` on card press.
   - Verify smooth horizontal slide animation when entering and exiting conversation on both Web and App.
4. **Gate 2: Dynamic Live Data Wiring**:
   - Verify hook integration (`useMessages`, `useChatRoom`) with live backend `api/employee/messages/*` endpoints.
   - Test polling/refreshing of messages with `since_id` and cache headers.
   - Test mark-as-read integration updating bottom tab badge count.

---

## 8. Out of Scope (Future Specs)

- WebRTC live audio/video calling (UI buttons are informational/placeholder in this phase).
- End-to-end encryption (E2EE) key exchange.
- Voice message audio waveform recording and player playback (mic button triggers recording prototype/haptic feedback).
- Rich text formatting (Markdown WYSIWYG) in mobile input field.

---

## 9. Definition of Done

- [ ] Every row in the **Acceptance Criteria** table passes (`AC-1` through `AC-13`).
- [ ] Every category in the **Non-Functional & Failure-Mode Checklist** is addressed.
- [ ] Pushed screen transition `slide_from_right` opens cleanly without showing `AppTopHeader` or `CustomTabBar`.
- [ ] Back button and native swipe-to-back gesture reverse the transition smoothly.
- [ ] Responsive container ensures clean presentation on desktop web browsers (`maxWidth: 640`) and edge-to-edge on mobile devices.
- [ ] No open findings from adversarial verification (`verify.md`).
- [ ] No open `CRITICAL` or `HIGH` findings from code review (`code-review.md`).
