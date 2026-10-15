# Feature Specification — Web Messaging Redesign: Facebook Floating Dock & Slack Workplace Hybrid

## Metadata

| Field | Value |
| --- | --- |
| Project Name | SubHRMS |
| Ticket Number | T00004 |
| Feature Name | Web Messaging Redesign — Facebook Dock & Slack Workplace Communication Hybrid |
| Created Date | 2026-10-15 |
| Specification Version | 1.1 |
| Status | Draft |

---

## 1. Overview

- **What is being built:** A comprehensive web messaging redesign delivering dual-mode operation: (1) a non-intrusive Facebook-style floating dock experience (navbar popover + bottom-right docked floating chat windows for multitasking across HRMS pages), and (2) a Facebook Messenger-inspired 3-column desktop Full View (`/messages`) combining a left chats directory with filter pills, a center Slack-style workplace conversation feed, and a right collapsible details & info accordion panel (Profile, Quick Actions, Active Thread, Shared Media & Files, Linked HR Tickets, and Settings).
- **Problem it solves:** Currently, clicking the message icon forces a full-page navigation away from critical HR work (timesheets, leaves, payroll), while the chat page itself uses simple consumer bubbles without thread slide-overs, media galleries, or an informative right-hand context panel.
- **Why this feature exists:** Employees and HR managers need instant, lightweight messaging while performing tasks on any screen, plus a powerful, dedicated 3-column full-view hub when engaging in deep workplace discussions, reviewing linked HR tickets, or managing channels.

---

## 2. Objective

### Main Goals

1. **Non-Intrusive Quick Access & Floating Dock (Default Web Mode):**
   - Clicking the navbar message icon opens a lightweight popover without leaving the active page.
   - Clicking a conversation docks a floating mini-chat box at the bottom-right of the viewport with minimize, expand to full view, and close controls.
2. **Dedicated 3-Column Full View Layout (`/messages`) (Matching Facebook Desktop Architecture):**
   - **Left Column (Chats Sidebar):** "Chats" header, action buttons (`...` more, new compose), full-width search bar with quick filter pills (`All`, `Unread`, `Channels`, `Direct Messages`), and conversation cards with online status badges, preview snippets, relative timestamps, and unread dots.
   - **Center Column (Slack-Inspired Workplace Conversation Area):** Header with participant avatar, online status, call actions, and info toggle button `(i)`; body featuring left-aligned Slack message rows with department badges, 5-minute message collapsing, dual mentions, emoji reaction counters, thread preview pills, and seen avatar receipts (1:1 with mobile `T00001`); and modern bottom composer.
   - **Right Column (Collapsible Details & Info Accordion Panel):** Header with large avatar, online indicator, name, role/department, and quick action buttons (`Profile`, `Mute`, `Search`); collapsible accordion sections for **Chat info**, **Active Thread Stream**, **Media & files** (photos, videos, documents), **Linked HR Tickets** (leave/overtime status), and **Privacy & settings**.
3. **Seamless Sync Between Floating Dock and Full View:**
   - Unified state via Pinia (`messages.store.ts`): opening full view focuses the active conversation; minimizing full view or navigating to another page restores docked floating chat.
4. **Mobile App Design Language Parity (`T00001`):**
   - Message previews (`"Sent a photo"`, `"Sent a file"`), mentions (`@current_user` in golden chestnut, `@other_user` in slate blue), thread counters, and seen avatars match `T00001` exactly.

### Expected Outcome

Users have full flexibility: when performing tasks on payroll or attendance, they chat via compact bottom-right floating windows; when they click "Expand" or navigate to `/messages`, they enter a 3-column Facebook-style full-view interface styled with Slack corporate minimalism and mobile-synced threads and receipts.

### Success Criteria

| ID | Criterion | Target | Measured By |
| --- | --- | --- | --- |
| SC-01 | Navbar Message Click Behavior | 100% of clicks open the quick-access popover without triggering route change away from current page | Manual verification MT-01 & Cypress/Playwright |
| SC-02 | Docked Chat Interaction | Floating chat opens at bottom-right upon conversation selection, supports minimize/expand/close | Manual verification MT-02 |
| SC-03 | 3-Column Full View Layout | `/messages` renders left directory, center conversation, and right collapsible info panel | Layout snapshot test & MT-03 |
| SC-04 | Message Feed Visual Layout | All messages render in Slack-style gutter format (avatar + name + badge + timestamp + content), collapsing within 5 minutes | Component inspection and snapshot test |
| SC-05 | Right Accordion Info Panel | Toggling `(i)` button opens/closes right panel containing Profile, Quick Actions, Media/Files, and HR Tickets | Manual verification MT-04 |
| SC-06 | Thread View in Dock & Full View | Thread opens as slide-over overlay in floating dock, and in right column in full view | Manual verification MT-05 |
| SC-07 | Mobile Design Parity | Message preview formatting (`Sent a photo`, `Sent a file`, etc.), reaction pills, and seen avatars match `T00001` contracts | Contract validation against `T00001` specs |
| SC-08 | State Synchronization | Switching from floating chat to full-screen `/messages` preserves active conversation ID, draft input, and scroll position | Vue store integration test |

---

## 3. Background and Motivation

- **Current limitation:** In `resources/views/web/src/components/custom/Navbar/HeaderBarComponets.vue` line 192, clicking the message button forces `router.push('/messages')`. Users are pulled out of whatever HR administrative page they are working on. In `resources/views/web/src/module/employee/messages/pages/Messages.vue`, the layout lacks the Facebook Messenger 3-column structure (Chats with filter pills, center feed, and right info accordion panel), and messages use consumer speech bubbles with no thread slide-over.
- **Business or technical reason:** Corporate communication requires high context: employees reference payroll items, timesheets, and tickets while messaging. Full-page redirects create cognitive friction and drop half-filled form states. Furthermore, inconsistent design between web (bubbles) and mobile (Slack-inspired feeds) confuses users.
- **Why this solution is needed:** Combining Facebook Messenger's 3-column architecture (as shown in the user reference image) with Slack workplace styling and mobile `T00001` data sync creates a desktop messaging experience that feels professional, spacious, and seamlessly connected to both web HR workflows and the mobile app.

---

## 4. Scope

### Included

- **HeaderBar Quick Access Dropdown (`MessagesPopover.vue`):** Floating dropdown anchored to the navbar message button showing search, presence reel of online colleagues, conversation filter tabs, preview cards with delivery status ticks, and "See all in Full View" action.
- **Docked Floating Chat Widget (`FloatingChatDock.vue` & `FloatingChatWindow.vue`):** Persistent bottom-right floating window manager supporting up to 2 active docked windows plus a minimized overflow tray, with minimize, maximize/expand, and close buttons.
- **3-Column Full View Architecture (`Messages.vue`):**
  - **Left Chats Sidebar (`MessagesSidebar.vue`):** "Chats" header, `...` options, new chat compose button, search input with quick filter pills (`All`, `Unread`, `Channels`, `Direct Messages`), and conversation cards with online badges and unread dots.
  - **Center Workplace Feed (`SlackMessageFeed.vue`, `SlackMessageRow.vue`):** Left-aligned layout, sender department badges, 5-minute consecutive grouping, dual-color `@mentions`, rich attachment previews, emoji reaction counters, and seen avatar indicators.
  - **Right Collapsible Info Panel (`ChatInfoAccordion.vue`):** Profile header (large avatar, name, status, role), quick action buttons (`Profile`, `Mute`, `Search`), and accordions for Chat Info, Active Thread Stream, Shared Media & Files (`T00003`), Linked HR Tickets, and Channel Settings.
- **Thread Side Panel / Slide-Over (`SlackThreadPanel.vue`):** Slide-in panel in floating chat and 3rd column in full view with root message context, reply stream, and composer with "also send to channel".
- **Unified Preview Formatter (`formatLatestMessagePreview`):** Ported from `T00001` utility to enforce uniform preview strings across web and mobile.

### Not Included

- Voice audio recording in web composer — deferred to future phase (mobile only for now; web displays voice audio playback cards).
- Video/Audio WebRTC calling — buttons in header remain mock action handlers as per current codebase scope.
- Sibling project ScaleUP modifications — strictly isolated to SubHRMS (`resources/views/web/`).

---

## 5. User Flow

### Flow 1 — Quick Access Popover (Non-Fullview Mode)

**Entry point:** Global navbar message icon in `HeaderBarComponets.vue`.

| Step | User Action | System Behavior | Expected Result |
| --- | --- | --- | --- |
| 1 | Clicks Message Icon in header bar | Checks if popover is open. If closed, fetches latest unread count and top 10 conversations; opens `MessagesPopover` dropdown anchored to button. | Popover appears smoothly with search bar, active colleagues reel, filter tabs, and conversation list. |
| 2 | Enters keyword in search input | Filters conversation list in real-time by participant name, channel title, or recent message preview. | List updates instantly without full page reload. |
| 3 | Clicks a conversation card | Closes the popover dropdown and triggers `openFloatingChat(conversationId)`. | Floating chat window mounts and opens at the bottom-right corner of the viewport. |
| 4 | Alternatively clicks "See all in Full View" | Navigates to `/messages`. | Full-view 3-column messages page opens. |

---

### Flow 2 — Floating Docked Chat & Thread Interactions

**Entry point:** Conversation clicked from popover, or "Message" action clicked from employee grid/profile.

| Step | User Action | System Behavior | Expected Result |
| --- | --- | --- | --- |
| 1 | Conversation opens in floating dock | Loads recent 30 messages, subscribes to `private-conversation.{id}` via Echo, and marks conversation as read via API. | Compact 360px wide by 480px high window displays at bottom-right with chat header, Slack message rows, and composer. |
| 2 | Types a message and presses Enter | Sends `POST /api/employee/messages/conversations/{id}/messages` with optimistic local insertion. | Message displays immediately; updates with server timestamp upon receipt; recipients receive Echo broadcast. |
| 3 | Clicks "Reply in thread" on a message | Sets `activeThreadRoot` in store; opens `SlackThreadPanel` slide-over inside the floating window. | Thread panel slides in from the right, showing root message card and thread reply composer. |
| 4 | Sends a reply with "Also send to channel" checked | Sends reply with `is_thread_broadcast: true`. | Message appears in thread stream AND broadcasts into the main channel feed. |
| 5 | Clicks Minimize button (`—`) on window header | Collapses window height to a compact 42px header pill at bottom edge. | Chat collapses; unread badge increments on the pill if new messages arrive. |
| 6 | Clicks Expand button (`⛶`) on window header | Closes floating instance and routes to `/messages?conversation_id={id}`. | Smooth transition to 3-column Full View page with the same conversation active. |
| 7 | Clicks Close button (`✕`) | Teardowns Echo channel listeners for that conversation and removes window from dock store. | Window unmounts smoothly. |

---

### Flow 3 — Facebook Messenger 3-Column Full View (`/messages`)

**Entry point:** Direct navigation to `/messages`, clicking "See all in Full View" from popover, or clicking Expand (`⛶`) from floating chat.

| Step | User Action | System Behavior | Expected Result |
| --- | --- | --- | --- |
| 1 | Lands on `/messages` | Mounts `Messages.vue`; floating dock windows are temporarily suppressed to prevent dual rendering. | 3-column layout renders: Left Chats Directory, Center Workplace Conversation Feed, Right Details & Info Accordion Panel. |
| 2 | Clicks filter pill `Unread` or `Channels` in Left Column | Filters visible conversation items instantly in left sidebar. | Only matching conversations display; active item shows distinct selected background. |
| 3 | Interacts with Center Conversation Feed | Shows Slack-style feed with left-aligned avatars, role badges, 5-minute grouping, reaction counters, and seen avatars. | Workplace conversation experience matching mobile app `T00001`. |
| 4 | Clicks Info button `(i)` in chat header | Toggles visibility of the Right Column (Chat Info Panel). | Right column slides in or expands, displaying large profile avatar, quick action buttons, and accordion sections. |
| 5 | In Right Column, clicks "Media & files" accordion | Expands media gallery tab with Photos, Videos, and Files. | Displays grid of shared attachments sent within this conversation. |
| 6 | Clicks "Reply in thread" in center feed | In Full View, the Right Column transitions smoothly to display the dedicated **Slack Thread Panel** (or embeds the thread stream). | Thread displays side-by-side with main chat; user can reply without losing main chat context. |
| 7 | Navigates away from `/messages` (e.g. to `/attendance`) | Page unmounts; floating dock re-enables and continues active conversations in bottom-right dock. | Multi-tasking seamlessly maintained. |

---

## 6. Functional Requirements

### FR-01 — Global Quick Access Popover
- **Requirement ID:** FR-01
- **Description:** The header bar message icon must open a floating dropdown menu without navigating away from the current page.
- **Expected Behavior:** Clicking `#messages-quick-access-btn` toggles `showMessagesPopover`. Dropdown includes: title with unread count badge, search bar with debounce (250ms), active colleagues presence avatar rail, filter chips (`All`, `Channels`, `Direct Messages`, `Unread`), conversation items with last message preview and relative timestamp, and footer button "See all in Full View".
- **Verified by:** AC-01, AC-02, AC-03

### FR-02 — Bottom-Right Floating Chat Dock
- **Requirement ID:** FR-02
- **Description:** Web application must provide a persistent floating dock at the bottom-right corner (`fixed bottom-0 right-4 z-50 flex items-end gap-3`).
- **Expected Behavior:** Supports up to 2 simultaneously open floating windows (width 360px, height 480px, max-height `calc(100vh - 80px)`). If a 3rd conversation is opened, the oldest inactive window collapses into an icon pill or overflow stack. Each window contains a header (avatar, title, status dot, minimize, expand, close), message body, and composer.
- **Verified by:** AC-04, AC-05, AC-06, AC-07

### FR-03 — Slack-Inspired Message Feed Formatting
- **Requirement ID:** FR-03
- **Description:** Message items must display in Slack workplace format instead of consumer chat bubbles.
- **Expected Behavior:** Each message displays:
  1. Sender avatar (36x36px rounded-xl) aligned left.
  2. Header line: Sender Name (font-semibold text-xs text-slate-900 dark:text-slate-100), Role/Department badge (`text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500`), and timestamp (text-[10px] text-slate-400).
  3. Message text with markdown support (code blocks, bold, italics, links).
  4. Consecutive messages from the same sender within 5 minutes collapse the avatar and header, indenting the text in an aligned gutter.
  5. Dual-color mentions: `@current_user` rendered with golden chestnut accent token (`#B45309` / `bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300`); `@other_user` rendered with slate blue token (`#475569` / `bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300`).
- **Verified by:** AC-08, AC-09, AC-10

### FR-04 — Thread Reply Stream & Slide-Over Panel
- **Requirement ID:** FR-04
- **Description:** Messages must support replies inside dedicated threads without cluttering the main conversation.
- **Expected Behavior:** Root message displays a thread indicator pill (`💬 {count} replies · Last reply {time_ago}`) with participant avatar stack. Clicking the pill or hovering over a message and selecting "Reply in thread" opens `SlackThreadPanel`. In floating chat, this slides in as an overlay; in full view, it opens as a 3rd right-hand column. Thread panel contains root message summary, scrollable replies feed, and dedicated thread composer with "Also send to channel" checkbox (`is_thread_broadcast`).
- **Verified by:** AC-11, AC-12, AC-13

### FR-05 — Messenger-Style Seen Avatars & Read Positions
- **Requirement ID:** FR-05
- **Description:** Synchronize read positions and display seen avatar receipts below the latest read message.
- **Expected Behavior:** When the current user views a conversation, it calls `POST /api/employee/messages/conversations/{id}/read` to advance the user's `last_read_message_id`. Below messages in channels or DMs, display 16x16px circular avatars of participants who have read up to that message (matching mobile `T00001` §4.5).
- **Verified by:** AC-14, AC-15

### FR-06 — Emoji Reactions & Hover Actions
- **Requirement ID:** FR-06
- **Description:** Hovering over any message row reveals a floating micro-action bar.
- **Expected Behavior:** Action bar includes: quick emoji reactions (`👍`, `❤️`, `🔥`, plus full emoji picker trigger), "Reply in thread" icon, "Pin message" icon, "Edit" (own messages), and "Delete" (own messages). Selected reactions display as interactive reaction pills beneath the message with count and active state highlight.
- **Verified by:** AC-16, AC-17

### FR-07 — Unified Latest Message Previews
- **Requirement ID:** FR-07
- **Description:** Previews in popover, conversation list, and floating headers must use deterministic formatting identical to mobile `T00001`.
- **Expected Behavior:**
  - Text → truncated text string
  - Photo / Image / GIF → `"Sent a photo"`
  - Video → `"Sent a video"`
  - Voice / Audio → `"Sent a voice message"`
  - Document / File → `"Sent a file"`
  - Empty → `"No messages yet"`
- **Verified by:** AC-18

### FR-08 — Window State Transitions & Full-View Switcher
- **Requirement ID:** FR-08
- **Description:** Floating chat windows must support smooth transitions: minimize to bottom pill, maximize/expand to `/messages`, and close.
- **Expected Behavior:** Clicking minimize shrinks window to a 42px header tab pinned to bottom. Clicking expand routes to `/messages?conversation_id={id}` and focuses the conversation in the main panel. If user is currently on `/messages`, floating dock windows are hidden to avoid duplicate views.
- **Verified by:** AC-19, AC-20

### FR-09 — Real-Time WebSocket Synchronization (Echo / Reverb)
- **Requirement ID:** FR-09
- **Description:** Zero polling. Real-time updates delivered via Laravel Echo private channels.
- **Expected Behavior:**
  - `private-conversation.{id}`: receives `.MessageSent`, `.MessageEdited`, `.MessageDeleted`, `.ReactionToggled`, `.MessagePinned`, and client-whisper `.typing`.
  - `private-user.{userId}`: receives `.UnreadCountUpdated` and updates badge in navbar and popover.
- **Verified by:** AC-21, AC-22

### FR-10 — 3-Column Full-Bleed Desktop Architecture (`/messages`)
- **Requirement ID:** FR-10
- **Description:** The full-view page `/messages` must provide a high-productivity 3-column layout matching the Facebook Messenger desktop experience.
- **Expected Behavior:**
  - **Left Column (320px–360px):** Chats header with action buttons, search bar with filter pills (`All`, `Unread`, `Channels`, `DMs`), and scrollable conversation cards with active selection highlight and unread blue dots.
  - **Center Column (Flex-1):** Header with participant details and `(i)` info toggle, Slack-style message stream, and bottom composer.
  - **Right Column (320px–360px collapsible):** Details & Info accordion panel or active Thread view.
- **Verified by:** AC-23, AC-24

### FR-11 — Right-Hand Collapsible Chat Info & Accordion Panel
- **Requirement ID:** FR-11
- **Description:** The right-hand panel in Full View must provide comprehensive conversation context with collapsible accordions.
- **Expected Behavior:**
  - Header: Large 72x72px avatar with green online badge, name, role/dept, corporate verified status.
  - Quick action buttons: Horizontal row with `Profile` (opens profile), `Mute` (notification toggle), and `Search` (conversation search).
  - Collapsible accordions:
    - **Chat Info:** Description, created date, member list with roles.
    - **Active Thread:** When a thread is selected, displays thread replies stream.
    - **Media & Files:** Grid of shared photos, videos, and document download cards.
    - **Linked HR Tickets:** Associated Leave/Overtime/Tardiness tickets with status badges.
    - **Privacy & Settings:** Mute, leave channel, or archive.
- **Verified by:** AC-25, AC-26

---

## 7. Non Functional Requirements

| ID | Category | Requirement | Target / Limit |
| --- | --- | --- | --- |
| NFR-01 | Security | Authenticated employee session required for all message APIs; access verified via `Conversation::scopeVisibleTo` and `GeneralAccessAction` | 401 for unauthenticated; 403 for unauthorized channel access |
| NFR-02 | Performance | Popover initial render time and floating chat open latency | Popover opens < 100ms; conversation messages load < 300ms (p95) |
| NFR-03 | Scalability | Real-time events delivered through WebSocket without client polling | 0 polling intervals; event payload < 5KB |
| NFR-04 | Maintainability | Shared Pinia store for both floating dock and full view; modular Vue 3 components under `components/` | Single source of truth in `messages.store.ts` |
| NFR-05 | Reliability | Optimistic UI updates with rollback on network failure | Message appears instantly with pending state; displays retry option if API fails |

---

## 8. Technical Design

### Architecture

- **Where it fits:** SubHRMS Employee Portal (`resources/views/web/src/module/employee/messages/` and `resources/views/web/src/components/custom/Navbar/`).
- **Pattern followed:** Vue 3 Composition API with `<script setup>`, Pinia store state management, Tailwind CSS styling, and Laravel Echo private channel listeners.

| Component | Status | Path |
| --- | --- | --- |
| `HeaderBarComponets.vue` | Extended | `resources/views/web/src/components/custom/Navbar/HeaderBarComponets.vue` |
| `MessagesPopover.vue` | New | `resources/views/web/src/module/employee/messages/components/popover/MessagesPopover.vue` |
| `FloatingChatDock.vue` | New | `resources/views/web/src/module/employee/messages/components/dock/FloatingChatDock.vue` |
| `FloatingChatWindow.vue` | New | `resources/views/web/src/module/employee/messages/components/dock/FloatingChatWindow.vue` |
| `MessagesSidebar.vue` | Extended | `resources/views/web/src/module/employee/messages/components/MessagesSidebar.vue` |
| `SlackMessageFeed.vue` | New | `resources/views/web/src/module/employee/messages/components/feed/SlackMessageFeed.vue` |
| `SlackMessageRow.vue` | New | `resources/views/web/src/module/employee/messages/components/feed/SlackMessageRow.vue` |
| `ChatInfoAccordion.vue` | New | `resources/views/web/src/module/employee/messages/components/info/ChatInfoAccordion.vue` |
| `SlackThreadPanel.vue` | New | `resources/views/web/src/module/employee/messages/components/thread/SlackThreadPanel.vue` |
| `SlackMessageComposer.vue` | New | `resources/views/web/src/module/employee/messages/components/composer/SlackMessageComposer.vue` |
| `messages.store.ts` | Extended | `resources/views/web/src/module/employee/messages/store/messages.store.ts` |
| `useFloatingChat.ts` | New | `resources/views/web/src/module/employee/messages/composables/useFloatingChat.ts` |
| `messages.utils.ts` | Extended | `resources/views/web/src/module/employee/messages/utils/messages.utils.ts` |
| `Messages.vue` | Extended | `resources/views/web/src/module/employee/messages/pages/Messages.vue` |

### Frontend

**Pages and components**

| Name | Path | Status | Responsibility |
| --- | --- | --- | --- |
| `MessagesPopover` | `components/popover/MessagesPopover.vue` | New | Dropdown flyout from header bar: search, online presence reel, tabs, recent conversation list, "See all in Full View". |
| `FloatingChatDock` | `components/dock/FloatingChatDock.vue` | New | Dock manager fixed at bottom-right corner of viewport: renders up to 2 active `FloatingChatWindow`s plus minimized tabs. |
| `FloatingChatWindow` | `components/dock/FloatingChatWindow.vue` | New | Individual floating chat window: header with controls (minimize, expand, close), message feed, slide-over thread panel, composer. |
| `MessagesSidebar` | `components/MessagesSidebar.vue` | Extended | Left column in Full View: "Chats" header, `...` options, new compose, search with filter pills (`All`, `Unread`, `Channels`, `DMs`), and conversation cards with online badges and unread dots. |
| `SlackMessageFeed` | `components/feed/SlackMessageFeed.vue` | New | Workplace message stream: chronological ordering, 5-minute sender collapsing, date dividers, typing indicator, seen avatar receipts. |
| `SlackMessageRow` | `components/feed/SlackMessageRow.vue` | New | Individual message unit: avatar, name, role badge, timestamp, markdown text, mentions, attachments, emoji reactions, thread preview pill, hover action toolbar. |
| `ChatInfoAccordion`| `components/info/ChatInfoAccordion.vue` | New | Right column in Full View: Profile overview, quick action buttons (`Profile`, `Mute`, `Search`), and accordions for Chat Info, Media & Files, Linked Tickets, and Settings. |
| `SlackThreadPanel` | `components/thread/SlackThreadPanel.vue` | New | Dedicated thread replies view: root message card, reply list, reply composer with "also send to channel". Slides in floating chat or mounts in right column. |
| `SlackMessageComposer` | `components/composer/SlackMessageComposer.vue` | New | Auto-expanding textarea, emoji picker trigger, attachment upload button, mention suggestions dropdown. |
| `Messages.vue` | `pages/Messages.vue` | Extended | Full-view 3-column page (`/messages`): Left Sidebar + Center Slack Feed + Right ChatInfoAccordion / Thread Panel. |

**State**

| State | Location | Shape | Updated When |
| --- | --- | --- | --- |
| `dockedConversations` | `useFloatingChat.ts` / `messages.store.ts` | `Array<{ id: number, conversation: MessageConversation, isMinimized: boolean }>` | User opens, minimizes, or closes a floating chat window |
| `activeThreadRoot` | `messages.store.ts` | `MessageItem \| null` | User clicks thread preview or "Reply in thread" |
| `showChatInfoPanel` | `messages.store.ts` | `boolean` | User clicks `(i)` button in full-view chat header (defaults to `true` on wide screens) |
| `threadReplies` | `messages.store.ts` | `MessageItem[]` | Fetched when thread opens; updated via Echo `.MessageSent` with `parent_id` |
| `showMessagesPopover` | `HeaderBarComponets.vue` / store | `boolean` | User clicks message icon in navbar |
| `conversations` | `messages.store.ts` | `MessageConversation[]` | Fetched on mount; updated on Echo `.MessageSent` or read receipt |
| `seenReceipts` | `messages.store.ts` | `Record<number, Array<{ user_id: number, name: string, avatar: string }>>` | Fetched on conversation load and updated via read events |

---

### Backend

**Endpoints (All Reused from Existing Controller)**

| Method | Route | Route Name | Handler | Access |
| --- | --- | --- | --- | --- |
| `GET` | `/api/employee/messages/unread-count` | `messages.unread-count` | `MessagesController@getUnreadCount` | Authenticated Employee |
| `GET` | `/api/employee/messages/conversations` | `messages.conversations` | `MessagesController@getConversations` | Authenticated Employee |
| `GET` | `/api/employee/messages/conversations/{id}/messages` | `messages.messages` | `MessagesController@getMessages` | Conversation Member |
| `POST` | `/api/employee/messages/conversations/{id}/messages` | `messages.send` | `MessagesController@sendMessage` | Conversation Member |
| `POST` | `/api/employee/messages/conversations/{id}/read` | `messages.read` | `MessagesController@markConversationAsRead` | Conversation Member |
| `POST` | `/api/employee/messages/mark-all-read` | `messages.mark-all-read` | `MessagesController@markAllAsRead` | Authenticated Employee |
| `GET` | `/api/employee/messages/conversations/{cId}/messages/{mId}/replies` | `messages.replies` | `MessagesController@getThreadReplies` | Conversation Member |
| `POST` | `/api/employee/messages/conversations/{cId}/messages/{mId}/reactions` | `messages.reaction` | `MessagesController@toggleReaction` | Conversation Member |
| `GET` | `/api/employee/messages/conversations/{cId}/messages/{mId}/seen` | `messages.seen` | `MessagesController@getMessageSeenReceipts` | Conversation Member |

---

### Database

**Tables & Fields (All Reused from Existing Schema)**
- `conversations` (channels, DMs, announcements, `is_system` General channel)
- `messages` (messages, thread replies via `parent_id`, `is_thread_broadcast`)
- `conversation_members` (membership, `last_read_message_id`)
- `message_reactions` (reactions per user/message)
- `message_attachments` (uploaded files, photos, dimensions)

---

## 9. Implementation Plan

Defined in [`plan.md`](./plan.md) in this ticket folder: the file-by-file task list (Preparation → Backend → Frontend → Validation) that `/webkit-implement` executes. The plan cites this spec's IDs and adds no requirement; where the two disagree, this spec wins.

---

## 10. Acceptance Criteria

| ID | Covers | Given | When | Then |
| --- | --- | --- | --- | --- |
| AC-01 | FR-01 | User is on any page in web portal | Clicks the message icon in `HeaderBarComponets.vue` | `MessagesPopover` dropdown opens anchored below the icon without changing router URL. |
| AC-02 | FR-01 | `MessagesPopover` is open | Types "accounting" in search box | Conversation list filters to matching channel/colleague names within 250ms debounce. |
| AC-03 | FR-01 | `MessagesPopover` is open | Clicks "See all in Full View" | Navigates to `/messages`; popover closes. |
| AC-04 | FR-02 | `MessagesPopover` is open | Clicks a conversation card | Popover closes; `FloatingChatWindow` opens at the bottom-right of the viewport for that conversation. |
| AC-05 | FR-02 | 1 floating chat is open | User opens a 2nd conversation from popover or employee profile | 2 floating chat windows sit side-by-side at bottom-right (`gap-3`). |
| AC-06 | FR-02 | 2 floating chats are open | User opens a 3rd conversation | The oldest inactive floating chat window collapses into a compact dock tab; the new window opens active. |
| AC-07 | FR-02 | A floating chat window is open | Clicks close button (`✕`) | Window unmounts; Echo channel for that conversation is unsubscribed. |
| AC-08 | FR-03 | A chat window is open | Messages are loaded | Messages render in Slack-style left-aligned gutter with avatar, name, role badge, and timestamp. |
| AC-09 | FR-03 | User receives 2 consecutive messages from same sender within 3 minutes | Messages are rendered | 2nd message collapses avatar and header, displaying text in aligned gutter under the 1st. |
| AC-10 | FR-03 | Message contains `@JohnDoe` (other user) and `@JaneSmith` (current user) | Message is rendered | `@JaneSmith` displays with chestnut/amber token; `@JohnDoe` displays with slate blue token. |
| AC-11 | FR-04 | Message has 3 thread replies | Message is rendered | Message displays thread pill: `💬 3 replies · Last reply ...` with participant avatars. |
| AC-12 | FR-04 | User clicks thread pill or "Reply in thread" | Action triggered | `SlackThreadPanel` slides in over the floating chat showing root message card and reply feed. |
| AC-13 | FR-04 | In thread composer, user checks "Also send to channel" and sends reply | Form submitted | Reply appears in thread stream AND appears in main channel feed with `is_thread_broadcast: true`. |
| AC-14 | FR-05 | User opens a conversation with unread messages | Window mounts | `POST /api/employee/messages/conversations/{id}/read` is sent; local unread badge clears to 0. |
| AC-15 | FR-05 | Other participants have read up to message #105 | Conversation is active | 16x16px seen avatars of those participants render directly below message #105. |
| AC-16 | FR-06 | User hovers over any message row | Mouse enters message container | Floating micro-action bar appears with emoji reactions, reply, pin, edit, delete. |
| AC-17 | FR-06 | User clicks `👍` reaction on message #102 | Click event | `POST .../reactions` is triggered; reaction counter pill `👍 1` increments immediately. |
| AC-18 | FR-07 | Latest message is an image upload | Conversation list renders | Preview text strictly reads `"Sent a photo"` with photo icon. |
| AC-19 | FR-08 | Floating chat is open | User clicks minimize (`—`) | Window height collapses to a 42px header pill pinned to bottom-right. |
| AC-20 | FR-08 | Floating chat is open | User clicks expand (`⛶`) | Window closes in dock and browser navigates to `/messages?conversation_id={id}`. |
| AC-21 | FR-09 | Another user sends a message in the active conversation | Reverb broadcasts `.MessageSent` event | Message appears at bottom of chat feed; view auto-scrolls if user was already at bottom. |
| AC-22 | FR-09 | Another user types in active conversation | Reverb broadcasts `.typing` whisper event | "John Doe is typing..." indicator displays below chat feed; clears after 3 seconds of inactivity. |
| AC-23 | FR-10 | User is on `/messages` on a desktop viewport | Page mounts | 3 distinct columns render side-by-side: Left Chats directory, Center Workplace feed, Right Info accordion. |
| AC-24 | FR-10 | In Left Column on `/messages`, user clicks filter pill `Unread` | Click pill | Conversation list filters instantly to unread conversations only. |
| AC-25 | FR-11 | In Center Column header on `/messages`, user clicks `(i)` button | Click `(i)` | Right Info panel toggles collapsed/expanded state. |
| AC-26 | FR-11 | In Right Column on `/messages`, user clicks "Media & files" accordion | Click accordion | Accordion expands to reveal shared Photos, Videos, and Files tabs. |

---

## 11. Edge Cases

| ID | Category | Scenario | Expected Handling | AC |
| --- | --- | --- | --- | --- |
| EC-01 | Invalid input | User sends empty text with no attachment in floating or thread composer | Send button remains disabled; pressing Enter does not trigger request | AC-08 |
| EC-02 | Empty data | User opens a new conversation with 0 messages | Displays friendly Slack-style empty state: "This is the start of your direct message history with {Name}" | AC-08 |
| EC-03 | Permission | User attempts to open a private channel they were removed from | Backend returns 403; frontend displays "You do not have access to this channel" banner and closes floating window | AC-07 |
| EC-04 | Failure | WebSocket disconnection while chatting in floating window | Status dot switches from emerald to amber with tooltip "Reconnecting..."; messages queue with retry button | AC-21 |
| EC-05 | Unexpected behavior | User opens `/messages` full view while floating chat windows are already docked | Floating dock automatically hides on `/messages` route to prevent duplicate UI, and restores when navigating away | AC-20 |

---

## 12. Testing Strategy

### Unit Testing

| Target | Cases | Covers |
| --- | --- | --- |
| `formatLatestMessagePreview` | Formats text, photo, video, audio, file, and empty cases according to strict specification | AC-18 |
| `useFloatingChat` composable | Adds window, handles max 2 limit with minimize overflow, toggles minimize state, closes window | AC-04, AC-05, AC-06, AC-07 |
| `messages.utils.ts` message grouping | Correctly groups messages within 5 minutes from same sender; splits group when sender changes or > 5 min | AC-08, AC-09 |

### Integration Testing

| Flow / Endpoint | Setup | Assertion | Covers |
| --- | --- | --- | --- |
| `POST /api/employee/messages/conversations/{id}/messages` | Authenticated user, valid payload | Status 200, message record returned with sender details and thread attributes | AC-08, AC-13 |
| `POST /api/employee/messages/conversations/{id}/read` | Unread messages exist | Status 200, updates `last_read_message_id`, unread count returns 0 | AC-14 |
| `POST /api/employee/messages/conversations/{cId}/messages/{mId}/reactions` | Active message | Status 200, reaction toggled on/off | AC-17 |

### Manual Testing Scenarios

| # | Precondition | Steps | Expected Result | Covers |
| --- | --- | --- | --- | --- |
| MT-01 | Logged in as default dev user on any page (e.g. `/dashboard` or `/employees`) | Click Message icon in top navbar | `MessagesPopover` opens smoothly without URL change; search and recent conversations display | AC-01, AC-02 |
| MT-02 | Popover is open | Click any conversation | Popover closes; floating chat window docks at bottom-right; recent messages render in Slack style | AC-04, AC-08 |
| MT-03 | User is on `/messages` | Observe full view layout | 3-column layout renders: Left Chats directory with pills, Center Slack feed, Right Info accordion panel | AC-23, AC-24 |
| MT-04 | In `/messages` header | Click `(i)` button and expand "Media & files" accordion | Right panel collapses/expands; accordion shows shared attachments | AC-25, AC-26 |
| MT-05 | Hover over received message | Click "Reply in thread" | Thread slide-over opens (overlay in dock, 3rd column in full view); reply composer is active | AC-12, AC-13 |

**Test command:** `npm run build` & `php artisan test --filter=Messages`

---

## 13. Security Considerations

### Authentication
- All messaging endpoints require valid Laravel Sanctum / web session authentication (`auth:sanctum` or web session). Unauthenticated requests return `401 Unauthorized`.

### Authorization

| Role | Allowed | Denied Response |
| --- | --- | --- |
| Authenticated Employee / User | Access conversations they belong to, public channels, or active General channel | `403 Forbidden` (`{"message": "You are not a member of this conversation."}`) |
| Inactive Employee (`status = 0`) | Denied access to General channel and sending messages | `403 Forbidden` |

### Validation

| Field | Rules | Error Response |
| --- | --- | --- |
| `text` | `nullable|string|max:5000` (required if attachments empty) | `422 Unprocessable Entity` |
| `parent_id` | `nullable|integer|exists:messages,id` | `422 Unprocessable Entity` |
| `is_thread_broadcast` | `nullable|boolean` | `422 Unprocessable Entity` |
| `attachments` | `nullable|array|max:10` | `422 Unprocessable Entity` |

### Data Protection
- **Sensitive fields:** Passwords, tokens, and personal credentials are never exposed in conversation member lists.
- **Write protection:** Only message senders can edit or delete their own messages.

### API Security
- **Object access (IDOR):** Verified via `Conversation::scopeVisibleTo(auth()->id())` on every conversation request.
- **Rate limits:** Attachment upload and link preview routes throttled to 30 requests per minute per user (`throttle:30,1`).

---

## 14. Implementation Notes

- **Conventions to follow:** Follow SubHRMS rules: Composition API with `<script setup>`, Tailwind CSS classes matching existing theme tokens (`dark:bg-slate-800`, `text-slate-900`, `border-slate-200`), VueUse composables for outside-click dismiss, and Laravel Echo private channels.
- **Do not change:** Do not alter existing API route names in `routes/api/employee.php` or break mobile app compatibility (`T00001`). Both web and mobile share the exact same backend endpoints and database tables.
- **Review findings:** N/A — not yet reviewed.

---

## 15. Assumptions and Decisions

### Assumptions

| ID | Assumption | Impact if Wrong | Confirmed By |
| --- | --- | --- | --- |
| A-01 | The backend messaging API (`app/Http/Controllers/employee/MessagesController.php`) already supports all thread, reaction, seen, and read endpoints developed in `T00001`. | If any endpoint is missing, backend additions would be required. Checked and confirmed present. | Confirmed via `routes/api/employee.php` |
| A-02 | Floating dock limit of 2 open windows + minimized overflow is sufficient for desktop screen real-estate without cluttering. | If users demand 4+, floating layout would need accordion styling. 2 is industry standard (Facebook/LinkedIn). | Confirmed design decision |
| A-03 | Mobile screen widths (< 768px) should redirect directly to `/messages` rather than docking floating widgets. | Mobile floating widgets obscure whole screen. Redirect is standard on mobile web. | Confirmed responsive behavior |

### Technical Decisions

| ID | Decision | Alternatives Rejected | Reason |
| --- | --- | --- | --- |
| D-01 | Mount `FloatingChatDock.vue` globally in the root layout (`resources/views/web/src/layouts/`) | Mount inside each individual portal page | Global mounting allows floating chats to persist smoothly across route navigations without reloading or losing state. |
| D-02 | 3-Column Full View matching Facebook Messenger layout combined with Slack workplace message feed | Simple 2-column list or consumer bubbles | Provides exact desktop UX requested by user (screenshot reference) while preserving corporate Slack formatting and mobile sync. |
| D-03 | Right column in Full View dual-purposes as Chat Info Accordion and Thread Panel | Modal dialog for threads | Seamlessly anchors thread deep-dives side-by-side with main chat without context switching. |
| D-04 | Hide floating dock when current route is `/messages` | Allow floating chats over full-view `/messages` | Prevents redundant dual rendering of the same conversation on the same screen. |

### Open Questions

| ID | Question | Owner | Blocks |
| --- | --- | --- | --- |
| Q-01 | Should minimized chat tabs persist across full page reloads via `localStorage` or reset on browser reload? | Product Owner | N/A (Defaulting to memory state with optional localStorage sync in Task) |

---

## 16. Change Log

| Version | Date | Type | Change | Reason / Impact | Changed Sections |
| --- | --- | --- | --- | --- | --- |
| 1.1 | 2026-10-15 | Major | Incorporate Facebook Messenger 3-column Full View architecture (Chats list with pills, Slack feed, Collapsible Info Accordion with Profile/Actions/Media/Tickets) based on user-provided screenshot | Clarifies and locks the Full View (/messages) 3-column layout alongside the floating dock mode | §2, §4, §5, §6, §8, §10, §16 |
| 1.0 | 2026-10-15 | Initial | Created specification for Web Messaging Redesign | Addresses user request for Facebook floating dock + Slack workplace hybrid UI | All |
