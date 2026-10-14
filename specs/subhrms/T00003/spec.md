# Feature Specification — Shared Media, Files, and Links Viewer

## Metadata

| Field | Value |
| --- | --- |
| Project Name | SubHRMS |
| Ticket Number | T00003 |
| Feature Name | Shared Media, Files, and Links Viewer |
| Created Date | 2026-10-14 |
| Specification Version | 1.0 |
| Status | Ready |

---

## 1. Overview

- **What is being built:** A unified, tabbed shared-content drawer/screen (`SharedMediaViewerModal` on mobile and `SharedMediaViewerModal.vue` on web) accessible via a single entry-point button (`View all media, files and links`) in Channel Info (`GroupDetailsDrawer`) and Contact Info (`ColleagueProfileDrawer`), categorizing conversation assets into Images, Videos, Files, and Links.
- **Problem it solves:** Today, users in the HRMS messaging system cannot browse past media, documents, or shared web links without manually scrolling through thousands of chat messages, causing productivity loss and difficulty locating vital workplace assets.
- **Why this feature exists:** Employees, managers, and HR personnel need quick, Slack/Messenger-style access to shared workplace artifacts with full context, including jump-to-original-message and thread-reply navigation.

---

## 2. Objective

### Main Goals

1. Provide exactly one consolidated entry point (`View all media, files and links`) in both Channel Info and Contact/DM Info surfaces.
2. Deliver a high-performance, segmented shared-content viewer with four isolated categories: **Images**, **Videos**, **Files**, and **Links**, complete with live badge counts.
3. Enable seamless two-way traversal from any shared artifact directly to its original message (or nested thread reply) in the conversation stream.

### Expected Outcome

Users can open Channel Info or Contact Info, tap `View all media, files and links`, view categorized assets shared across the entire channel/conversation history (including thread replies), preview images/videos/documents in existing viewers, copy or open external links, and immediately jump to the original message location with visual highlight feedback.

### Success Criteria

| ID | Criterion | Target | Measured By |
| --- | --- | --- | --- |
| SC-01 | Single entry button consistency | 100% adherence (exactly 1 button on Channel Info and Contact Info) | Automated component test & visual audit |
| SC-02 | Category query response time | p95 < 250 ms for initial tab and counts retrieval | Backend benchmark with 10,000 conversation messages |
| SC-03 | Content isolation | 0 data leakage across conversation boundaries | Automated authorization & tenancy tests |
| SC-04 | Jump-to-message reliability | 100% successful scroll & highlight for active stream items; opens thread modal for thread replies | Mobile & web integration test suite |
| SC-05 | Zero new database tables | 0 migrations creating new tables | Schema inspection |

---

## 3. Background and Motivation

- **Current limitation:** In `resources/views/mobapp/src/module/employee/messages/components/GroupDetailsDrawer.tsx` and `ColleagueProfileDrawer.tsx`, users can inspect members and pinned messages, but have no way to view media or attachments. In web (`resources/views/web/src/module/employee/messages`), chat attachments are only visible as inline message bubbles in `MessagesChatArea.vue`.
- **Business or technical reason:** Workplace communications frequently involve policies (PDFs), spreadsheets (attendance/payroll disputes), screenshots, and external reference links. Requiring employees to manually backtrack through endless message history degrades productivity.
- **Why this solution is needed:** Introducing dedicated separate buttons for each asset type creates cluttered drawer navigation. A single unified entry point leading to a tabbed viewer mirrors the industry-standard Slack and Messenger UX while reusing existing media viewers (`ImageViewerModal`, `VideoPlayerModal`, `LinkPreviewCard`).

---

## 4. Scope

### Included

- Single entry-point button (`View all media, files and links`) added to `GroupDetailsDrawer.tsx` (Channel Info) and `ColleagueProfileDrawer.tsx` (Contact Info) on mobile, as well as the web chat header / profile dialog.
- Dedicated `SharedContentDrawer` / `SharedMediaViewerModal` component in mobile (`resources/views/mobapp`) supporting 4 tabs: Images, Videos, Files, Links.
- Web equivalent `SharedMediaViewerModal.vue` / panel in `resources/views/web/src/module/employee/messages`.
- Backend query `App\Queries\Messages\GetSharedContentQuery` and controller endpoint `GET /api/employee/messages/conversations/{id}/shared-content`.
- Category count summary in API response for efficient badge rendering.
- Server-side cursor/page pagination for each category.
- Inline actions: open in `ImageViewerModal`, open in `VideoPlayerModal`, download file, open link in in-app browser (`WebBrowser.openBrowserAsync`), and "Go to message" / "Jump to message".
- Seamless navigation back to `ConversationScreen`: auto-scrolling to the target message with temporary highlight, or opening `ThreadModal` if the item belongs to a thread reply.

### Not Included

- Cross-channel global media search (deferred; covered under dedicated global search in `MessagesSearchModal`).
- Modifying or deleting shared media from the viewer (users manage messages via existing `MessageActionModal`).
- Audio/voice note gallery tab (deferred to future voice note transcriptions update).

---

## 5. User Flow

### Flow 1 — Access Shared Content from Channel Info (Mobile)

**Entry point:** Conversation header info tap → `GroupDetailsDrawer`

| Step | User Action | System Behavior | Expected Result |
| --- | --- | --- | --- |
| 1 | User taps channel header title/avatar in `ConversationScreen` | Opens `GroupDetailsDrawer` | Channel Details card displays "Members", "Pinned messages", and "View all media, files and links" |
| 2 | User taps `View all media, files and links` button | Drawer pushes to `shared_content` view mode (or opens `SharedMediaModal`), requests `GET /api/employee/messages/conversations/{id}/shared-content?tab=images` | Shared content screen opens with "Images" active; category badges show counts `(e.g., Images 18, Videos 2, Files 9, Links 14)` |
| 3 | User taps on a photo thumbnail | Invokes `ImageViewerModal` with image URL, sender name, timestamp | Fullscreen image viewer opens with zoom, download, share, and "Go to message" button |
| 4 | User switches to "Files" tab | Updates state without closing screen; fetches page 1 of files if not cached | Displays document list with file type icons, name, size, sender, and date |
| 5 | User taps "Jump to message" icon on an item | Closes shared viewer and drawer, notifies `ConversationScreen` with `messageId` and `replyToId` | Viewport scrolls smoothly to the message; message flashes highlight color for 2.5 seconds |

**Failure paths:**
- Step 2, when conversation access was revoked or channel archived: Server returns `403 Forbidden` or `404 Not Found`; UI displays an unauthorized empty state with button to return to chat.
- Step 4, when network is offline: UI displays retry error state with cached tab items if available.

### Flow 2 — Access Shared Content from Contact Info / DM (Mobile & Web)

**Entry point:** Direct Message header tap → `ColleagueProfileDrawer` (Mobile) or Profile Modal (Web)

| Step | User Action | System Behavior | Expected Result |
| --- | --- | --- | --- |
| 1 | User taps colleague avatar/name in 1-on-1 chat | Opens Contact Info (`ColleagueProfileDrawer`) | Card displays "Profile Information", "Pinned messages", and single button `View all media, files and links` |
| 2 | User clicks `View all media, files and links` | Invokes shared content viewer for direct `conversation_id` | Dedicated screen/modal displays 4 tabs with direct conversation assets only |
| 3 | User selects "Links" tab | Renders link preview cards (domain, title, description, thumbnail) extracted from message text | All shared URLs appear cleanly without duplicates within the same message |
| 4 | User clicks an external URL card | Launches system in-app browser (`WebBrowser.openBrowserAsync`) | Target webpage opens securely |

**Failure paths:**
- Step 3, when no links have been shared: Displays empty state `No links shared yet`.

---

## 6. Functional Requirements

### FR-01 — Single Entry-Point Button
- **Requirement ID:** FR-01
- **Description:** Both Channel Info (`GroupDetailsDrawer`) and Contact Info (`ColleagueProfileDrawer`) must provide exactly one button labeled `View all media, files and links`. No separate individual buttons (e.g. "Photos", "Docs", "Links") shall be placed on the overview screens.
- **Expected Behavior:** Exactly one menu row with icon `Image` or `FolderOpen`, title `View all media, files and links`, subtitle `Photos, videos, documents & shared links`, and chevron right.
- **Verified by:** AC-01, AC-02.

### FR-02 — Category Tabs and Live Badge Counts
- **Requirement ID:** FR-02
- **Description:** The shared-content viewer must display four tabs: `Images`, `Videos`, `Files`, and `Links`. Default tab must be `Images`.
- **Expected Behavior:** Each tab displays a count chip (e.g. `Images (12)`). Switching tabs updates the active list in-place without page reload or drawer re-mount.
- **Verified by:** AC-03, AC-04.

### FR-03 — Images Category Behavior
- **Requirement ID:** FR-03
- **Description:** Render photo and supported GIF attachments in a 3-column responsive grid with aspect ratio preservation.
- **Expected Behavior:** Grid items display image thumbnail. Tapping opens `ImageViewerModal` with full pan/zoom, download, and jump-to-message action.
- **Verified by:** AC-05, AC-06.

### FR-04 — Videos Category Behavior
- **Requirement ID:** FR-04
- **Description:** Render video attachments with thumbnail preview, duration/size tag, and semi-transparent play badge overlay.
- **Expected Behavior:** Tapping thumbnail launches `VideoPlayerModal`. Action button allows jump-to-message.
- **Verified by:** AC-07, AC-08.

### FR-05 — Files Category Behavior
- **Requirement ID:** FR-05
- **Description:** Render non-media file attachments (PDF, Word, Excel, PowerPoint, ZIP, TXT) with distinct file type badges/icons, filename, file size, sender name, and shared date.
- **Expected Behavior:** Tapping file triggers preview or platform download (`messagesApi.resolveAttachmentUrl`).
- **Verified by:** AC-09, AC-10.

### FR-06 — Links Category Behavior
- **Requirement ID:** FR-06
- **Description:** Extract URLs from message text and combine with existing link preview data (`GetLinkPreviewQuery` / `LinkPreviewCard`).
- **Expected Behavior:** Duplicate URLs inside the same message are deduplicated. Each entry shows domain, title, description snippet, favicon/image, sender, date, and link click handler.
- **Verified by:** AC-11, AC-12.

### FR-07 — Original Message & Thread Reply Navigation
- **Requirement ID:** FR-07
- **Description:** Every shared item retains its `message_id`, `conversation_id`, and `reply_to_id`. When "Go to message" is triggered:
  - If the item is in the main stream (`reply_to_id == null`): scroll list to message and apply 2.5s highlight animation.
  - If the item is a thread reply (`reply_to_id != null`): open `ThreadModal` for the root message and focus the target reply.
- **Expected Behavior:** View transitions cleanly to the message; conversation context and scroll position are properly synchronized.
- **Verified by:** AC-13, AC-14.

### FR-08 — Conversation Data Scoping & Permission Guard
- **Requirement ID:** FR-08
- **Description:** Content returned by the backend MUST strictly belong to the specified `conversation_id` and be verified against the authenticated user via `Conversation::visibleTo($user)`.
- **Expected Behavior:** Deleted messages (`is_deleted = true` or `visible()` scope false) and deleted attachment files are filtered out. Accessing an unjoined private channel returns `403`.
- **Verified by:** AC-15, AC-16.

---

## 7. Non Functional Requirements

| ID | Category | Requirement | Target / Limit |
| --- | --- | --- | --- |
| NFR-01 | Security | Enforce Sanctum auth and conversation visibility scope (`visibleTo`) | 0 unauthorized data exposures (403/404 for unauthorized access) |
| NFR-02 | Performance | Tab data fetch latency | p95 < 250 ms with server-side pagination (limit=30) |
| NFR-03 | Scalability | Database index usage | Query utilizes `idx_messages_conversation_visible` and `message_attachments.message_id` indexes; no full table scans |
| NFR-04 | Maintainability | Follow Query/Handler pattern | Read-only in `App\Queries\Messages\GetSharedContentQuery`; no API resources |
| NFR-05 | Reliability | Graceful empty and error states | Every tab handles 0 items, network failure, and missing file URLs without crashes |

---

## 8. Technical Design

### Architecture

- **Where it fits:** `app/Queries/Messages/GetSharedContentQuery.php`, `App\Http\Controllers\employee\MessagesController.php`, routes in `routes/api/employee.php`.
- **Pattern followed:** Static Query execution `GetSharedContentQuery::execute($params)` returning clean JSON array envelope.
- **Reference implementation:** `app/Queries/Messages/GetPinnedMessagesQuery.php` and `SearchMessagesQuery.php`.

| Component | Status | Path |
| --- | --- | --- |
| `GetSharedContentQuery` | **(new)** | `app/Queries/Messages/GetSharedContentQuery.php` |
| `MessagesController@getSharedContent` | Extended | `app/Http/Controllers/employee/MessagesController.php` |
| Route registration | Extended | `routes/api/employee.php` |
| `SharedMediaViewerModal` (Mobile) | **(new)** | `resources/views/mobapp/src/module/employee/messages/components/SharedMediaViewerModal.tsx` |
| `GroupDetailsDrawer` (Mobile) | Extended | `resources/views/mobapp/src/module/employee/messages/components/GroupDetailsDrawer.tsx` |
| `ColleagueProfileDrawer` (Mobile) | Extended | `resources/views/mobapp/src/module/employee/messages/components/ColleagueProfileDrawer.tsx` |
| `messagesApi.getSharedContent` (Mobile) | Extended | `resources/views/mobapp/src/module/employee/messages/services/messages.api.ts` |
| `SharedMediaViewerModal.vue` (Web) | **(new)** | `resources/views/web/src/module/employee/messages/components/SharedMediaViewerModal.vue` |

### Frontend

**Pages and components**

| Name | Path | Status | Responsibility |
| --- | --- | --- | --- |
| `SharedMediaViewerModal.tsx` | `resources/views/mobapp/src/module/employee/messages/components/SharedMediaViewerModal.tsx` | **(new)** | Segmented tabbed screen rendering Images grid, Videos, Files list, and Links list with pagination & message jump |
| `GroupDetailsDrawer.tsx` | `resources/views/mobapp/src/module/employee/messages/components/GroupDetailsDrawer.tsx` | Extended | Renders single button `View all media, files and links` in Channel Details card and triggers shared content viewer |
| `ColleagueProfileDrawer.tsx` | `resources/views/mobapp/src/module/employee/messages/components/ColleagueProfileDrawer.tsx` | Extended | Renders single button `View all media, files and links` in Profile Details card and triggers shared content viewer |
| `SharedMediaViewerModal.vue` | `resources/views/web/src/module/employee/messages/components/SharedMediaViewerModal.vue` | **(new)** | Web modal for desktop shared media, files, and links viewing |

**State**

| State | Location | Shape | Updated When |
| --- | --- | --- | --- |
| `activeTab` | `SharedMediaViewerModal` local state | `'images' \| 'videos' \| 'files' \| 'links'` | User taps category tab |
| `sharedCounts` | `SharedMediaViewerModal` state | `{ images: number, videos: number, files: number, links: number }` | Loaded on initial query mount |
| `tabItems` | `SharedMediaViewerModal` state | `Record<string, { items: any[], page: number, hasMore: boolean, loading: boolean }>` | Fetched on tab change or infinite scroll |

**API interaction**

| Trigger | Endpoint | Loading State | On Success | On Error |
| --- | --- | --- | --- | --- |
| Open shared viewer / tab switch | `GET /api/employee/messages/conversations/{id}/shared-content?tab={tab}&page={page}` | Skeleton placeholders | Populates items & updates counts | Error banner with retry button |

### Backend

**Endpoints**

| Method | Route | Route Name | Handler | Access |
| --- | --- | --- | --- | --- |
| GET | `/api/employee/messages/conversations/{id}/shared-content` | `api.employee.messages.shared-content` | `MessagesController@getSharedContent` | Authenticated member / channel viewer |

**Classes**

| Class | Path | Status | Responsibility |
| --- | --- | --- | --- |
| `GetSharedContentQuery` | `app/Queries/Messages/GetSharedContentQuery.php` | **(new)** | Executes database aggregation for counts and paginated retrieval of images, videos, files, or links for a conversation |
| `MessagesController` | `app/Http/Controllers/employee/MessagesController.php` | Extended | Dispatches request to `GetSharedContentQuery` inside `try/catch` and returns JSON envelope |

**Request / response contract** — `GET /api/employee/messages/conversations/{id}/shared-content?tab=images&page=1&limit=30`

```jsonc
// Request Query Parameters
{
  "tab": "images", // "images" | "videos" | "files" | "links"
  "page": 1,
  "limit": 30
}
```

```jsonc
// 200 Success
{
  "success": true,
  "data": {
    "counts": {
      "images": 42,
      "videos": 5,
      "files": 19,
      "links": 12
    },
    "tab": "images",
    "items": [
      {
        "id": 104,
        "type": "image",
        "name": "payslip_screenshot.png",
        "size": "245 KB",
        "url": "http://zentre.hrms.test/storage/messages/abc123.png",
        "width": 1080,
        "height": 1920,
        "messageId": 5012,
        "replyToId": null,
        "isThreadReply": false,
        "threadRootId": null,
        "senderId": 82,
        "senderName": "Jane Doe",
        "senderAvatar": "http://zentre.hrms.test/storage/profiles/avatar_82.jpg",
        "createdAt": "2026-10-14T08:30:00Z"
      }
    ],
    "pagination": {
      "current_page": 1,
      "per_page": 30,
      "total": 42,
      "has_more": true
    }
  }
}
```

```jsonc
// 403 Forbidden Error
{
  "success": false,
  "message": "You do not have access to this conversation."
}
```

**Processing logic**

1. Validate `$user = Auth::user()` and `$conversation = Conversation::visibleTo($user)->find($conversationId)`. If not found, throw 403/404 exception.
2. Calculate category counts in a single aggregation pass or cached count queries:
   - Images count: `MessageAttachment` joined with `messages` where `conversation_id = $id` and attachment is image/gif.
   - Videos count: `MessageAttachment` joined with `messages` where `conversation_id = $id` and attachment is video.
   - Files count: `MessageAttachment` joined with `messages` where `conversation_id = $id` and attachment is document/other.
   - Links count: `Message::where('conversation_id', $id)->visible()->where(text contains http:// or https://)`.
3. Filter items for the requested `tab`:
   - For `images`, `videos`, `files`: query `MessageAttachment` with eager loaded `message.sender` and `message.parent`, sorted by `created_at desc`.
   - For `links`: query `Message` with `text LIKE '%http%'`, extract distinct URLs per message using regex, attach existing cached link metadata from `GetLinkPreviewQuery` where available, and paginate.
4. Format output into standard JSON response with pagination metadata.

### Database

**Tables**

| Table | Status | Purpose |
| --- | --- | --- |
| `conversations` | Reused | Scopes content and validates permissions |
| `messages` | Reused | Holds message text, `reply_to_id`, `conversation_id`, `sender_id`, and `is_deleted` |
| `message_attachments` | Reused | Holds attached files (`path`, `name`, `type`, `size`, `width`, `height`, `message_id`) |
| `accounts` | Reused | Sender profile details (`fname`, `lname`, `avatar`) |

**Fields**

| Table.Column | Type | Nullable | Default | Index / Constraint | Notes |
| --- | --- | --- | --- | --- | --- |
| `messages.conversation_id` | unsignedBigInteger | No | None | Index | Reused |
| `messages.reply_to_id` | unsignedBigInteger | Yes | NULL | Index | Reused — identifies thread reply |
| `messages.is_deleted` | boolean | No | 0 | Index | Reused — excluded when true |
| `messages.text` | text | Yes | NULL | None | Reused — searched for URLs |
| `message_attachments.message_id` | unsignedBigInteger | No | None | Index | Reused |
| `message_attachments.type` | varchar(50) | Yes | 'file' | Index | Reused — 'image', 'video', 'pdf', etc. |

**Relationships:** `conversations` 1–N `messages` via `messages.conversation_id`; `messages` 1–N `message_attachments` via `message_attachments.message_id`.

**Migrations**

N/A — All required tables, foreign keys, columns (`is_deleted`, `reply_to_id`, `width`, `height`), and indexes already exist. No new migrations needed.

**Data backfill / seed:** N/A — existing attachment and message records will be served directly.

### External Services

| Service | Purpose | Interface | Auth | Timeout / Retry | On Failure |
| --- | --- | --- | --- | --- | --- |
| `GetLinkPreviewQuery` | Resolves OpenGraph metadata for links | Internal class | N/A | 3s timeout / cached 24h | Returns instant fallback card with domain name |

---

## 9. Implementation Plan

Defined in [`plan.md`](./plan.md) in this ticket folder: the file-by-file task list (Preparation → Backend → Frontend → Validation) that `/webkit-implement` executes. The plan cites this spec's IDs and adds no requirement; where the two disagree, this spec wins.

---

## 10. Acceptance Criteria

| ID | Covers | Given | When | Then |
| --- | --- | --- | --- | --- |
| AC-01 | FR-01 | User opens `GroupDetailsDrawer` for channel `#general` | Inspecting the Channel Details card | Exactly one button `View all media, files and links` is rendered; no separate media/files/links buttons exist |
| AC-02 | FR-01 | User opens `ColleagueProfileDrawer` for direct conversation with Jane | Inspecting the Profile Details card | Exactly one button `View all media, files and links` is rendered |
| AC-03 | FR-02 | User clicks `View all media, files and links` | Shared content viewer mounts | 4 category tabs (`Images`, `Videos`, `Files`, `Links`) are displayed with accurate numeric badges, default selected tab is `Images` |
| AC-04 | FR-02 | User is on `Images` tab | User taps `Files` tab | Content switches to files list without dismissing the viewer or reloading the channel |
| AC-05 | FR-03 | Conversation has 5 image attachments | User selects `Images` tab | 5 thumbnails render in 3-column responsive grid with correct aspect ratio |
| AC-06 | FR-03 | User taps an image thumbnail in the grid | User interacts with image | `ImageViewerModal` opens with high-res photo, sender name, time, and "Go to message" button |
| AC-07 | FR-04 | Conversation has 2 video attachments | User selects `Videos` tab | 2 video cards render with play icon overlay, filename, duration/size, and sender name |
| AC-08 | FR-04 | User taps a video card | User interacts with video | `VideoPlayerModal` opens and begins playback |
| AC-09 | FR-05 | Conversation has PDF, Word, and Excel attachments | User selects `Files` tab | Each file card displays appropriate document icon, file name, file size, sender name, and date |
| AC-10 | FR-05 | User taps download button on a PDF file | File download action dispatched | File is opened or saved via system download manager |
| AC-11 | FR-06 | Messages contain 3 unique URLs and 1 duplicate URL | User selects `Links` tab | Exactly 3 unique link preview cards are shown with domain, title, thumbnail, and "Go to message" |
| AC-12 | FR-06 | User taps a link card | User clicks link | External URL opens in system in-app browser (`WebBrowser.openBrowserAsync`) |
| AC-13 | FR-07 | Shared item belongs to root message #5010 | User taps "Go to message" | Viewer closes, `ConversationScreen` scrolls to #5010 and activates 2.5s visual highlight |
| AC-14 | FR-07 | Shared item belongs to thread reply #5025 (parent #5000) | User taps "Go to message" | Viewer closes, `ConversationScreen` opens `ThreadModal` for root #5000 and highlights reply #5025 |
| AC-15 | FR-08 | User A is not a member of private channel #secret | User A requests `GET /api/employee/messages/conversations/99/shared-content` | Server returns HTTP 403 Forbidden with `{ "success": false, "message": "You do not have access to this conversation." }` |
| AC-16 | FR-08 | Message #5030 containing an image was marked `is_deleted = true` | User opens `Images` tab | Deleted message's image does NOT appear in the shared media viewer |
| AC-17 | NFR-02 | Conversation contains 500 attachments | Calling `GET /api/employee/messages/conversations/{id}/shared-content?tab=images&page=1&limit=30` | Response returns in < 250 ms with `has_more: true` and 30 items |
| AC-18 | EC-02 | Conversation has zero files or media | User opens shared viewer | Friendly empty state `No media shared yet` with informative subtitle is displayed |

---

## 11. Edge Cases

| ID | Category | Scenario | Expected Handling | AC |
| --- | --- | --- | --- | --- |
| EC-01 | Invalid input | Requesting invalid tab `tab=audio_recordings` or non-numeric page | Defaults to `tab=images`, `page=1`, returns valid HTTP 200 payload | AC-03 |
| EC-02 | Empty data | Conversation has no images, files, or links | Renders custom empty state illustration with text "No [images/videos/files/links] shared in this conversation yet" | AC-18 |
| EC-03 | Permission | User's account is deactivated or user removed from private channel | Server returns 403 Forbidden; frontend displays access denied notice and closes modal | AC-15 |
| EC-04 | Failure | Attachment file missing from local disk/storage | Thumbnail displays broken image placeholder; tapping shows alert "File no longer available" without crashing | AC-06 |
| EC-05 | Unexpected behavior | Original message was deleted after shared content list was loaded | Tapping "Go to message" displays toast "The original message has been deleted" and remains in current view | AC-13 |
| EC-06 | Duplication | A single message text contains the same URL three times | Backend deduplicates URLs per message; only 1 link preview card is returned | AC-11 |

---

## 12. Testing Strategy

### Unit Testing

| Target | Cases | Covers |
| --- | --- | --- |
| `GetSharedContentQuery::extractUrls` | Regex extracts valid http/https URLs, trims punctuation, deduplicates within string | AC-11 |
| `GetSharedContentQuery::filterAttachments` | Correctly segregates images, videos, and documents by MIME and file extension | AC-05, AC-07, AC-09 |

### Integration Testing

| Flow / Endpoint | Setup | Assertion | Covers |
| --- | --- | --- | --- |
| `GET /api/employee/messages/conversations/{id}/shared-content` | Auth user, active conversation with attachments & links | Returns 200 with counts, items, and pagination | AC-03, AC-17 |
| `GET /api/employee/messages/conversations/{id}/shared-content` | Auth user, unjoined private channel | Returns 403 Forbidden | AC-15 |
| `GET /api/employee/messages/conversations/{id}/shared-content` | Deleted message with attachment | Deleted attachment excluded from items | AC-16 |

### Manual Testing Scenarios

| # | Precondition | Steps | Expected Result | Covers |
| --- | --- | --- | --- | --- |
| MT-01 | Conversation with images, videos, PDFs, and links | Open Channel Info -> Tap `View all media, files and links` -> Switch through each tab | All 4 tabs display corresponding content with matching badge counts | AC-01, AC-03, AC-04 |
| MT-02 | Shared image from thread reply | Tap "Go to message" on thread image | `ThreadModal` opens and target reply is highlighted | AC-14 |
| MT-03 | External URL shared | Tap link card in Links tab | In-app browser displays destination webpage | AC-12 |

**Test command:** `php artisan test --filter=SharedContentTest`

---

## 13. Security Considerations

### Authentication
- Route protected under `auth:sanctum` middleware within `routes/api/employee.php`. Unauthenticated requests receive HTTP 401 Unauthorized.

### Authorization

| Role | Allowed | Denied Response |
| --- | --- | --- |
| Active channel member / public channel viewer | View all shared content for the conversation | N/A |
| Non-member of private channel | None | `403 Forbidden` (`{"success": false, "message": "You do not have access to this conversation."}`) |
| Deactivated account (`status = 0`) | None | `403 Forbidden` |

### Validation

| Field | Rules | Error Response |
| --- | --- | --- |
| `conversationId` | `required, integer, exists:conversations,id` | `404 Not Found` |
| `tab` | `nullable, string, in:images,videos,files,links` | Defaults to `images` |
| `page` | `nullable, integer, min:1` | Defaults to 1 |
| `limit` | `nullable, integer, min:1, max:100` | Defaults to 30 |

### Data Protection
- **Sensitive fields:** File paths containing system directories are never exposed; only public asset URLs (`/storage/messages/...`) or signed URLs are provided.
- **Exposure rules:** Messages from conversations not accessible by the user are never queried or returned.
- **Write protection:** Read-only endpoint; cannot alter attachments or messages.

### API Security
- **Object access (IDOR):** Direct ID access prevented by `Conversation::visibleTo($user)->find($conversationId)`.
- **Mass assignment:** N/A (read-only query).
- **Rate limits:** Protected under default API throttle (60 requests per minute).

---

## 14. Implementation Notes

- **Conventions to follow:** Thin controller calling `GetSharedContentQuery::execute($params)`; PascalCase domain namespace `App\Queries\Messages\GetSharedContentQuery`.
- **Do not change:** Do not alter the schema of `messages` or `message_attachments`. Do not add separate buttons on the drawer overview cards.
- **Known pitfalls:** In MySQL, regex queries on unindexed columns can be slow if table is massive. Ensure query restricts rows by `conversation_id` FIRST (which is indexed) before filtering attachments or searching message text.
- **Config / environment:** No new `.env` keys required.
- **Deployment / rollback:** Standard deployment; zero schema migrations required. Rollback simply reverts PHP and frontend code commits.
- **Review findings:** N/A — not yet reviewed.

---

## 15. Assumptions and Decisions

### Assumptions

| ID | Assumption | Impact if Wrong | Confirmed By |
| --- | --- | --- | --- |
| A-01 | All thread replies share `conversation_id` with their root message | Thread replies would need a recursive join | Confirmed in `SendMessageHandler.php` line 188 |
| A-02 | Images, videos, and files can be classified using `message_attachments.type` and file extension | Unrecognized types would fall back to Files | Confirmed in `SendMessageHandler.php` ATTACHMENT_TYPES |

### Technical Decisions

| ID | Decision | Alternatives Rejected | Reason |
| --- | --- | --- | --- |
| D-01 | Single aggregated endpoint returning badge counts + initial items | 4 separate endpoints (1 per tab) | Eliminates multiple HTTP handshakes and provides counts immediately for tab chips |
| D-02 | Drawer sub-view / modal transition | Navigating to completely separate React Navigation screen | Preserves active chat scroll position and memory state without remounting `ConversationScreen` |
| D-03 | Extract URLs dynamically from `messages.text` via regex | Creating a new `message_links` database table | Avoids database migrations and backfilling existing message history; `messages.text` is already indexed per conversation |

### Open Questions

*Nothing.*

---

## 16. Change Log

| Version | Date | Type | Change | Reason / Impact | Changed Sections |
| --- | --- | --- | --- | --- | --- |
| 1.0 | 2026-10-14 | Initial | Created specification | Base specification for Shared Media, Files, and Links Viewer | All |
