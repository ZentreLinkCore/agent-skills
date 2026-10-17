# Feature Specification — ReactJS Web Application (QueueMic Web)

<!--
TEMPLATE: feature-specification (used by /webkit-specify)
-->

## Metadata

| Field | Value |
| --- | --- |
| Project Name | queuemic |
| Ticket Number | T00002 |
| Feature Name | ReactJS Web Application (QueueMic Web) |
| Created Date | 2026-10-17 |
| Specification Version | 1.2 |
| Status | Done |

---

## 1. Overview

- **What is being built:** A modern React.js (Vite + React 19 + TypeScript + React Router) web Single Page Application (`webapp/`) delivering both a dedicated widescreen Host Player (YouTube video playback, live sync, QR code display) and a responsive Guest Room (song search, queueing, live progress, presence) that runs in standard web browsers.
- **Problem it solves:** Karaoke parties currently require everyone to install the mobile app, preventing easy large-screen playback on TVs/laptops and creating friction for guests who do not want to download a native application.
- **Why this feature exists:** Party hosts can open QueueMic in any desktop or smart TV browser as the media station, and guests can instantly join via QR code or URL in their mobile browser without downloading an app or creating an account.

---

## 2. Objective

### Main Goals

1. Provide an in-browser Host Player with full-screen YouTube playback, real-time playback control, and room join QR code display.
2. Provide an in-browser Guest Room interface for searching YouTube karaoke tracks, adding songs with singer nicknames, and following the host's playback as a synchronized video or progress bar.
3. Reuse 100% of the existing Laravel backend API and real-time WebSocket events (`presence-room.{code}`) without modifying backend code or breaking the mobile app.
4. Keep the React Native mobile app (`mobapp/`) and React.js web app (`webapp/`) decoupled while sharing exact domain contracts.

### Expected Outcome

Users can navigate to the web application URL, create a room as Host or join with a 6-character code as Guest, manage queues in real time, and experience synchronized audio/video playback directly in modern web browsers.

### Success Criteria

| ID | Criterion | Target | Measured By |
| --- | --- | --- | --- |
| SC-01 | Web Guest Room Onboarding | < 5 seconds from QR scan / URL visit to queueing a song | Manual test timer |
| SC-02 | Playback Synchronization Accuracy | Guest follower video and progress bar match Host playback within ±0.5 seconds, including after a pause / resume | NTP-style clock sync comparison; MT-04 |
| SC-03 | Real-Time State Latency | Queue additions and status changes reflect across all connected clients in < 500ms | WebSocket message timestamp log |
| SC-04 | Backend Zero-Regression | 0 modifications to backend API endpoints or database migrations | `git diff backend/` check |

---

## 3. Background and Motivation

- **Current limitation:** QueueMic currently exists only as an Expo/React Native mobile application in `mobapp/`. Hosts must screen-mirror a phone to a TV, and guests must install the native mobile app on iOS or Android.
- **Business or technical reason:** Web browsers provide universal accessibility across Windows, macOS, Linux, ChromeOS, and Smart TVs without App Store review hurdles.
- **Why this solution is needed:** Building a React.js web Single Page Application (Vite + React 19 + TypeScript + React Router) reusing the existing Laravel 13 backend allows seamless cross-platform parity while leveraging standard browser APIs (`window.YT.Player`, `localStorage`, HTML5 drag-and-drop) without any server-side rendering complexity.

---

## 4. Scope

### Included

- React.js (React 19 / TypeScript / Vite / `react-router-dom`) web application located in `webapp/`.
- Web API client using Axios with bearer token injection and error handling.
- Real-time WebSocket connection using `laravel-echo` and `pusher-js` supporting both Laravel Reverb and Pusher.
- Host Player interface: YouTube video playback using the official YouTube IFrame API, playback state sync, skip/next/pause controls, and QR code display for room joining.
- Guest Room interface: follower video view (default; follows the host's play / pause and position, per-viewer mute), synchronized progress bar view, active queue list, song search modal with YouTube catalog integration, and room member presence drawer.
- Landing, Create Room, and Join Room pages with dark cyber-glass UI styling.
- Local session persistence via browser `localStorage`.

### Not Included

- Native mobile code modifications (`mobapp/` remains untouched).
- Backend schema changes or new migrations (existing API endpoints are fully reused).
- Native camera barcode scanner on web (the web app supports direct URL joining with pre-filled code, text code input, and display of QR codes).

---

## 5. User Flow

### Flow 1 — Host Creates Room and Launches Player (Host)

**Entry point:** `/create` or `/` (Create Room button)

| Step | User Action | System Behavior | Expected Result |
| --- | --- | --- | --- |
| 1 | Enters Host Nickname (e.g., "DJ Alex") and optional Room Name, clicks "Create Room". | Calls `POST /api/v1/rooms` with `{ nickname, room_name, device_uuid }`. | Backend returns room data and session token. |
| 2 | System saves session token and role (`host`) to `useAuthStore` in `localStorage`. | Subscribes to `presence-room.{code}` via Laravel Echo and syncs server clock. | Redirects to `/host/{code}`. |
| 3 | Host clicks "Start Party" / "Begin Session" to satisfy browser user gesture. | Initializes YouTube IFrame Player with the current or next song in queue. | Video begins playing, displaying song title and singer badge. |
| 4 | Host clicks "Next", "Skip", or "Pause". | Dispatches `POST /api/v1/rooms/{code}/playback/*` and broadcasts state. | Player updates immediately and notifies all room members. |

**Failure paths:**
- Step 1, when network is offline: Error toast "Unable to create room. Please check your connection." displayed.
- Step 3, when YouTube video fails or is restricted: Error banner displayed with an option to skip to the next song in queue.

---

### Flow 2 — Guest Joins Room and Adds Song to Queue (Guest)

**Entry point:** `/join` or `/join?code=ABCDEF` (from QR code scan)

| Step | User Action | System Behavior | Expected Result |
| --- | --- | --- | --- |
| 1 | Enters 6-character room code and nickname (e.g., "Sam"), clicks "Join Room". | Calls `POST /api/v1/rooms/join` with `{ room_code, nickname, device_uuid }`. | Backend returns member session token. |
| 2 | System saves token and role (`guest`) to `useAuthStore`. | Subscribes to `presence-room.{code}` via Laravel Echo and fetches initial queue. | Redirects to `/room/{code}`. |
| 3 | Guest clicks "Search Songs" and types "Bohemian Rhapsody". | Debounces input and calls `GET /api/v1/songs/search?q=...`. | Displays list of matching YouTube karaoke tracks. |
| 4 | Guest clicks "Add to Queue", enters Singer Name (defaults to guest nickname), confirms. | Dispatches `POST /api/v1/rooms/{code}/queue` with `Idempotency-Key` header. | Song added to queue; modal closes; queue updates via `.queue.updated` event. |

**Failure paths:**
- Step 1, when room code does not exist or room is closed: Displays `404` error "Room not found or closed".
- Step 1, when nickname is already in use by an active member: Displays `422` error "The nickname 'Sam' is already taken in this room."
- Step 4, when room limit reached: Displays `422` error "You have reached the maximum allowed songs in queue."

---

### Flow 3 — Guest Follows Playback (Guest)

**Entry point:** `/room/{code}` while a song is on stage

| Step | User Action | System Behavior | Expected Result |
| --- | --- | --- | --- |
| 1 | Opens the room (video view is the default). | Mounts the YouTube player muted at the host's current position (sync anchor from `GET /api/v1/rooms/{code}/playback` or `playback.state_changed`). | Video plays in step with the Host. |
| 2 | — (Host pauses, then resumes.) | Pauses the guest video and parks it on the host's paused position; on resume, plays from there and resyncs when it drifts. | Guest video stays within ±0.5 s of the Host (SC-02). |
| 3 | Taps the mute toggle. | Unmutes the guest video; the choice carries over to the next songs. | Guest hears the song; the next song also starts with sound. |
| 4 | Switches to the Progress view. | Hides the video but keeps its player mounted. | Progress bar continues; switching back does not reload the video. |

**Failure paths:**
- Step 1 or a later song, when the browser blocks autoplay with sound: the video plays muted with an "Audio Muted by Browser" notice and the mute toggle shows muted; one tap restores the sound.
- Any step, when the tab was hidden and the browser paused the video: on return, the video resumes and resyncs if the room is still playing (EC-07).

---

## 6. Functional Requirements

### FR-01 — Guest and Host Onboarding
- **Requirement ID:** FR-01
- **Description:** Users can create a room as Host or join an active room as Guest without registration.
- **Expected Behavior:** Submitting valid nicknames returns an API session token. Session token is stored in `localStorage` and sent on all authenticated requests.
- **Verified by:** AC-01, AC-02, AC-03

### FR-02 — Dynamic Real-Time WebSocket Connection
- **Requirement ID:** FR-02
- **Description:** Web application dynamically configures Laravel Echo using parameters from `GET /api/v1/broadcasting/config` and connects to `presence-room.{code}`.
- **Expected Behavior:** Supports both Pusher and Laravel Reverb configurations. Authenticates presence channels via `POST /api/v1/broadcasting/auth`.
- **Verified by:** AC-04, AC-05

### FR-03 — Synchronized YouTube Playback (Host)
- **Requirement ID:** FR-03
- **Description:** The Host screen embeds YouTube videos using the official IFrame API, handles end-of-song transitions, and updates playback state.
- **Expected Behavior:** Video plays in sync; position reports include server timestamp `position_at_ms`. The Host reports its live position (`POST /api/v1/rooms/{code}/playback/state`) as soon as its player has one after playback (re)starts — a new song, or a resume by a permitted guest — then every 30 seconds while playing. When video ends, automatically calls `POST /api/v1/rooms/{code}/playback/next`.
- **Verified by:** AC-06, AC-07, AC-20

### FR-04 — Follower Playback Progress (Guest)
- **Requirement ID:** FR-04
- **Description:** Guest devices display real-time playback progress bar calculated from `currentTimeSeconds`, `position_at_ms`, and local server clock offset.
- **Expected Behavior:** Guest progress bar animates smoothly and corrects for network drift. It reads the follower video's position while that player is mounted (FR-08), and otherwise extrapolates from the sync anchor.
- **Verified by:** AC-08

### FR-05 — Song Search and Queue Management
- **Requirement ID:** FR-05
- **Description:** Users can search YouTube karaoke tracks and add them to the room queue with singer names.
- **Expected Behavior:** Searching queries `GET /api/v1/songs/search`. Adding song sends `POST /api/v1/rooms/{code}/queue` with unique `Idempotency-Key`.
- **Verified by:** AC-09, AC-10, AC-11

### FR-06 — Queue Reordering and Removal
- **Requirement ID:** FR-06
- **Description:** Hosts (and Guests if permitted by room settings) can remove or reorder songs in the queue.
- **Expected Behavior:** Moving songs calls `POST /api/v1/rooms/{code}/queue/{id}/move`; deleting calls `DELETE /api/v1/rooms/{code}/queue/{id}`. Real-time updates broadcast to all members.
- **Verified by:** AC-12, AC-13

### FR-07 — Presence and Heartbeat Management
- **Requirement ID:** FR-07
- **Description:** Active room members are tracked via presence channel; web client sends periodic heartbeats.
- **Expected Behavior:** Client emits `POST /api/v1/rooms/{code}/heartbeat` every 60 seconds. Member join/leave events update the presence list drawer.
- **Verified by:** AC-14, AC-15

### FR-08 — Follower Video (Guest)
- **Requirement ID:** FR-08
- **Description:** The Guest Room shows the current song's YouTube video by default, following the Host's playback, with a per-viewer mute toggle (parity with `mobapp` `HostVideoPlayer` `followHost`).
- **Expected Behavior:** The guest player never plays while the room is paused, and pauses parked on the Host's paused position. While playing, it seeks to the Host's extrapolated position once it drifts more than 0.4 s, at most once every 3 s, leading each seek by a learned buffering offset (0–3 s). It starts muted until the viewer unmutes; the viewer's choice applies to every later song. A browser-blocked unmuted autoplay falls back to muted playback, shown as muted, and one tap restores the sound. The player stays mounted while the Progress view is shown.
- **Verified by:** AC-17, AC-18, AC-19

---

## 7. Non Functional Requirements

| ID | Category | Requirement | Target / Limit |
| --- | --- | --- | --- |
| NFR-01 | Security | Authenticated endpoints protected by session token matching sha256 hash in DB | `EnsureRoomMember.php` contract |
| NFR-02 | Performance | Web initial bundle size & load time | First Contentful Paint < 1.5s on desktop broadband |
| NFR-03 | Scalability | WebSocket connection resilience & reconnection | Reconnects automatically within 3 seconds of connection drop |
| NFR-04 | Maintainability | Follows QueueMic Clean Architecture, TypeScript strict mode, and unified design tokens | Matches `mobapp/src/types/index.ts` and `colors.ts` |
| NFR-05 | Reliability | Idempotency on queue additions to prevent duplicate song submission | Replaying key within 2 minutes yields original response |

---

## 8. Technical Design

### Architecture

- **Where it fits:** New standalone web client in `webapp/` as a sibling to `backend/` and `mobapp/`.
- **Pattern followed:** React 19 Single Page Application (SPA) with Vite, `react-router-dom` client-side routing, Zustand store slices, Axios API layer, and Laravel Echo WebSocket service.

| Component | Status | Path |
| --- | --- | --- |
| Vite React Scaffolding | New | `webapp/package.json` |
| Vite Configuration | New | `webapp/vite.config.ts` |
| App Shell & Router | New | `webapp/src/App.tsx` |
| Web API Client | New | `webapp/src/api/client.ts` |
| Realtime Service | New | `webapp/src/services/echo.ts` |
| Clock Sync Service | New | `webapp/src/services/serverClock.ts` |
| State Stores | New | `webapp/src/store/*.ts` |
| Room Realtime Hook | New | `webapp/src/hooks/useEchoRoom.ts` |
| Web Video Player | New | `webapp/src/components/player/WebVideoPlayer.tsx` |
| Host Screen | New | `webapp/src/pages/HostPlayerPage.tsx` |
| Guest Screen | New | `webapp/src/pages/GuestRoomPage.tsx` |

### Frontend

**Pages and Components**

| Name | Path | Status | Responsibility |
| --- | --- | --- | --- |
| HomePage | `webapp/src/pages/HomePage.tsx` | New | Join Room / Create Room navigation hub |
| CreateRoomPage | `webapp/src/pages/CreateRoomPage.tsx` | New | Room creation form for Host |
| JoinRoomPage | `webapp/src/pages/JoinRoomPage.tsx` | New | Room joining form for Guests with URL param prefill |
| HostPlayerPage | `webapp/src/pages/HostPlayerPage.tsx` | New | Host dashboard with YouTube player, QR code, controls |
| GuestRoomPage | `webapp/src/pages/GuestRoomPage.tsx` | New | Guest dashboard with follower video / live progress views, queue, song search |
| WebVideoPlayer | `webapp/src/components/player/WebVideoPlayer.tsx` | New | Official YouTube IFrame Player API integration; Host player, and Guest follower when `followHost` (FR-08) |
| WebPlaybackControls | `webapp/src/components/player/WebPlaybackControls.tsx` | New | Play, pause, skip, next buttons for host |
| WebGuestProgressBar | `webapp/src/components/player/WebGuestProgressBar.tsx` | New | Smooth progress bar synced via server timestamp |
| WebQueueList | `webapp/src/components/queue/WebQueueList.tsx` | New | Interactive queue item list |
| WebSongSearchModal | `webapp/src/components/search/WebSongSearchModal.tsx` | New | YouTube search dialog and "Add to Queue" action |
| WebQRCodeDisplay | `webapp/src/components/room/WebQRCodeDisplay.tsx` | New | SVG QR code generator for room joining URL |
| WebMemberListModal | `webapp/src/components/room/WebMemberListModal.tsx` | New | Connected members presence list drawer |
| GlassCard | `webapp/src/components/common/GlassCard.tsx` | New | Reusable cyber-glass container |
| NeonButton | `webapp/src/components/common/NeonButton.tsx` | New | Glowing gradient action button |

**State**

| State | Location | Shape | Updated When |
| --- | --- | --- | --- |
| `useAuthStore` | `webapp/src/store/useAuthStore.ts` | `{ token, memberId, nickname, role, deviceUuid }` | Login / create / join / role change |
| `useRoomStore` | `webapp/src/store/useRoomStore.ts` | `{ room, members, isConnected, settings }` | Room details fetch, presence events |
| `useQueueStore` | `webapp/src/store/useQueueStore.ts` | `{ queue, currentPlaying }` | Initial load, `.queue.updated`, `.song.started` |
| `usePlaybackStore` | `webapp/src/store/usePlaybackStore.ts` | `{ state, currentTimeSeconds, durationSeconds, syncAnchor }` | Player tick, `.playback.state_changed` |

**API Interaction**

| Trigger | Endpoint | Loading State | On Success | On Error |
| --- | --- | --- | --- | --- |
| Create Room submit | `POST /api/v1/rooms` | Button spinner | Store token, route to `/host/[code]` | Show error alert |
| Join Room submit | `POST /api/v1/rooms/join` | Button spinner | Store token, route to `/room/[code]` | Show error alert (e.g. nickname taken) |
| Mount room view | `GET /api/v1/rooms/{code}/queue` | Skeleton card | Populate `useQueueStore` | Show retry notice |
| Song search input | `GET /api/v1/songs/search` | Search spinner | Populate search results | Display "No songs found" |
| Add Song submit | `POST /api/v1/rooms/{code}/queue` | Modal button spinner | Close modal, toast notification | Display error (e.g. limit reached) |
| Host Play/Pause | `POST /api/v1/rooms/{code}/playback/state` | Optimistic | Local store updated immediately | Rollback state on failure |

### Backend

All backend endpoints and events are **Reused** without modification:
- `POST /api/v1/rooms` (`RoomController@store`)
- `POST /api/v1/rooms/join` (`RoomController@join`)
- `GET /api/v1/rooms/{code}` (`RoomController@show`)
- `GET /api/v1/rooms/{code}/queue` (`QueueController@index`)
- `POST /api/v1/rooms/{code}/queue` (`QueueController@store`)
- `DELETE /api/v1/rooms/{code}/queue/{queueId}` (`QueueController@destroy`)
- `POST /api/v1/rooms/{code}/queue/{queueId}/move` (`QueueController@move`)
- `GET /api/v1/rooms/{code}/playback` (`PlaybackController@show`)
- `POST /api/v1/rooms/{code}/playback/state` (`PlaybackController@updateState`)
- `POST /api/v1/rooms/{code}/playback/next` (`PlaybackController@next`)
- `POST /api/v1/rooms/{code}/playback/skip` (`PlaybackController@skip`)
- `GET /api/v1/time` (`PlaybackController@clock`)
- `GET /api/v1/broadcasting/config` (`BroadcastAuthController@config`)
- `POST /api/v1/broadcasting/auth` (`BroadcastAuthController@authenticate`)
- `POST /api/v1/rooms/{code}/heartbeat` (`MemberController@heartbeat`)
- `GET /api/v1/songs/search` (`SongController@search`)

---

## 9. Implementation Plan

Defined in [`plan.md`](./plan.md) in this ticket folder: the file-by-file task list (Preparation → Backend → Frontend → Validation) that `/webkit-implement` executes. The plan cites this spec's IDs and adds no requirement; where the two disagree, this spec wins.

---

## 10. Acceptance Criteria

| ID | Covers | Given | When | Then |
| --- | --- | --- | --- | --- |
| AC-01 | FR-01 | User on `/create` enters nickname "HostUser" | Clicks "Create Room" | Calls `POST /api/v1/rooms`, saves session token, navigates to `/host/{code}`. |
| AC-02 | FR-01 | User on `/join` enters valid code "ABCDEF" and nickname "GuestUser" | Clicks "Join Room" | Calls `POST /api/v1/rooms/join`, saves session token, navigates to `/room/ABCDEF`. |
| AC-03 | FR-01 | Guest tries to join with a nickname already taken by an active member | Clicks "Join Room" | Receives `422` with message "The nickname '...' is already taken in this room." |
| AC-04 | FR-02 | Client initializes WebSocket connection | Mounts room screen | Fetches config from `GET /api/v1/broadcasting/config` and connects to Reverb/Pusher. |
| AC-05 | FR-02 | Client connects to `presence-room.{code}` | Socket authorizer executes | Sends `socket_id` and token to `POST /api/v1/broadcasting/auth` and receives auth signature. |
| AC-06 | FR-03 | Host Player mounts on `/host/{code}` with a song in queue | Video iframe initializes | YouTube video plays; player status changes to `playing`. |
| AC-07 | FR-03 | YouTube video completes playback | `onSongEnd` triggers | Calls `POST /api/v1/rooms/{code}/playback/next`; next song starts playing. |
| AC-08 | FR-04 | Guest on `/room/{code}` receives `playback.state_changed` event | Event received with `position_at_ms` and `current_time_seconds` | Progress bar updates position and animates in sync with Host. |
| AC-09 | FR-05 | Guest opens search modal and types "Queen" | Search input debounces 300ms | Displays search results from `GET /api/v1/songs/search?q=Queen`. |
| AC-10 | FR-05 | Guest clicks "Add to Queue" for song ID 5 | Submits with singer name "GuestUser" | Calls `POST /api/v1/rooms/{code}/queue` with `Idempotency-Key` header; song added. |
| AC-11 | FR-05 | Network drops and guest clicks "Add to Queue" again with same key | Retried request executes | Backend returns existing queue item (`201` or replay) without creating duplicate. |
| AC-12 | FR-06 | Host drags queue item #3 to position #1 | Drop action completes | Calls `POST /api/v1/rooms/{code}/queue/{id}/move` with `{ target_position: 1 }`. |
| AC-13 | FR-06 | Host clicks delete button on queue item #2 | Clicks confirm delete | Calls `DELETE /api/v1/rooms/{code}/queue/{id}`; item removed from list across all clients. |
| AC-14 | FR-07 | User remains connected in a room | 60 seconds elapse | Client dispatches `POST /api/v1/rooms/{code}/heartbeat` to keep session active. |
| AC-15 | FR-07 | Member joins or leaves the room | WebSocket event fires | Presence drawer updates member count and member list in real time. |
| AC-16 | NFR-04 | React Native mobile app in `mobapp/` | Tested after web client implementation | Continues running with zero code modifications or API discrepancies. |
| AC-17 | FR-08, EC-07 | Guest on `/room/{code}` in video view; Host playing; guest player 3 s behind the Host's extrapolated position | The next player tick runs (≤ 250 ms) | Guest player seeks to the Host position plus its seek lead; 3 s later its drift is ≤ 0.4 s and it does not seek again. |
| AC-18 | FR-08 | Guest video playing in step; Host pauses at 15.0 s and resumes 20 s later from 15.0 s | `playback.state_changed` `paused`, then `playing`, arrive | Guest video pauses parked at 15.0 s, makes no seek while paused, and 5 s after the resume is at 20.0 s ± 0.4 s. |
| AC-19 | FR-08 | Guest has unmuted | The next song's player loads | It starts with sound; if the browser blocks it, it plays muted, shows "Audio Muted by Browser", the mute button reads "Unmute", and one tap restores the sound. |
| AC-20 | FR-03 | Host on `/host/{code}`; a new song starts (or a guest resumes the room) | The Host player reports a position > 0 | Host sends `POST /api/v1/rooms/{code}/playback/state` with `state: playing` within 1 s, then not again until 30 s later. |

---

## 11. Edge Cases

| ID | Category | Scenario | Expected Handling | AC |
| --- | --- | --- | --- | --- |
| EC-01 | Invalid input | Joining with empty room code or nickname | Client-side validation blocks submit; displays "Nickname and room code are required". | AC-02 |
| EC-02 | Empty data | Room has no songs in queue | Displays `EmptyQueueState` with "Queue is empty. Search songs to get the party started!" | AC-06 |
| EC-03 | Permission | Guest attempts to call Host-only endpoint (`/settings` or `/transfer-host`) | Backend rejects with `403` `HOST_ONLY`; UI hides Host-only controls from Guests. | AC-12 |
| EC-04 | Failure | WebSocket disconnects due to network tunnel drop | Client automatically retries connection with exponential backoff and shows offline indicator. | AC-04 |
| EC-05 | Unexpected behavior | Double-clicking "Add to Queue" button | UI submit guard disables button; idempotency key ensures only one item queued. | AC-10, AC-11 |
| EC-06 | Autoplay policy | Browser blocks automatic unmuted video playback on Host mount | Displays large "Click to Start Playback" banner to initiate playback with user interaction. | AC-06 |
| EC-07 | Unexpected behavior | Guest tab is hidden and the browser pauses the follower video while the room keeps playing | When the tab is visible again the video resumes, then resyncs to the Host (FR-08). | AC-17 |

---

## 12. Testing Strategy

### Unit Testing

| Target | Cases | Covers |
| --- | --- | --- |
| `serverClock.ts` | NTP round-trip latency calculation and offset application | AC-08 |
| `normalizer.ts` | Normalizing snake_case Eloquent song and queue objects | AC-09, AC-10 |
| `useAuthStore.ts` | Storing and retrieving session tokens from `localStorage` | AC-01, AC-02 |
| `WebVideoPlayer.tsx` | Sync anchor position calculation and drift adjustment | AC-06, AC-08 |
| `WebVideoPlayer.tsx` (`followHost`, fake YouTube player) | Resync to the latest anchor with seek lead; pause parking and no seeks while paused; song-start `buffering` anchor; mute choice and browser-muted fallback | AC-17, AC-18, AC-19 |
| `HostPlayerPage.tsx` (fake timers) | First position report after (re)start, then every 30 s; none while position is 0 | AC-20 |

### Integration Testing

| Flow / Endpoint | Setup | Assertion | Covers |
| --- | --- | --- | --- |
| Room Creation | Submit nickname on `/create` | Token saved, URL changes to `/host/[code]` | AC-01 |
| Queue Addition | Search and queue song | Queue list increments; `.queue.updated` received | AC-10 |
| Playback Control | Click "Pause" / "Play" on Host | Emits `POST /playback/state`; broadcasts to members | AC-06, AC-08 |

### Manual Testing Scenarios

| # | Precondition | Steps | Expected Result | Covers |
| --- | --- | --- | --- | --- |
| MT-01 | Backend running on localhost | Open `localhost:3000`, click Create Room as "Host1" | Room created, redirected to `/host/{code}`, QR code displayed | AC-01, AC-06 |
| MT-02 | Host room active | Open incognito window, join code as "Guest1", add song | Song appears on Host and Guest screens simultaneously | AC-02, AC-10 |
| MT-03 | Song playing on Host | Observe Guest playback progress bar | Progress bar tracks host playback in real time | AC-08 |
| MT-04 | Web Host + mobile Guest, then mobile Host + web Guest | Play, pause 20 s, resume, skip; unmute the web Guest and wait for the next song | Follower video within ±0.5 s of the Host after every step; next song starts with sound | AC-17, AC-18, AC-19, AC-20, SC-02 |

**Test command:** `npm run test` (Vitest in `webapp/`)

---

## 13. Security Considerations

### Authentication

- Every authenticated API request sends `Authorization: Bearer <token>` and `X-Session-Token: <token>`.
- Token is verified by `EnsureRoomMember` middleware against `sha256(token)` in `room_members`. Unauthenticated requests receive `401 UNAUTHENTICATED`.

### Authorization

| Role | Allowed | Denied Response |
| --- | --- | --- |
| `host` | Playback control, queue reorder/delete, transfer host, update settings, close room | `403` with code `INVALID_SESSION` |
| `guest` | View queue/playback, search songs, add to queue, delete own queued song | `403` with code `HOST_ONLY` when accessing host endpoints |

### Validation

| Field | Rules | Error Response |
| --- | --- | --- |
| `nickname` | required, string, min: 1, max: 50 | `422` with validation message |
| `room_code` | required, string, size: 6, uppercase alphanumeric | `404` or `422` |
| `song_id` | required, integer, exists in `songs,id` | `422` "The selected song id is invalid." |
| `idempotency_key` | nullable, string, regex `/^[A-Za-z0-9-]{8,64}$/` | `422` "Invalid idempotency key." |

### API Security

- **Object access (IDOR):** Guests can only remove queue items they requested (`requested_by_member_id === member.id`), while Host can remove any item.
- **Mass assignment:** Web client uses strictly typed request payloads matching Laravel FormRequest definitions.
- **Rate limits:** Song search is throttled via `throttle:song-search` on backend (`SongController`).

---

## 14. Implementation Notes

- **Conventions to follow:** Dark cyber aesthetic (`#0A0A0F`, `#8B5CF6`, `#EC4899`, `#06B6D4`, `#F59E0B`). Clean component design with reusable UI primitives in `webapp/src/components/common/`.
- **Do not change:** All existing backend classes in `backend/app/`, route definitions in `backend/routes/`, and mobile app code in `mobapp/`.
- **Known pitfalls:** Browser autoplay restrictions require an initial user click on the Host screen before video playback can start.
- **Config / environment:** `VITE_API_URL` pointing to backend (default: `http://localhost:8000/api/v1` or tunnel URL).
- **Review findings:**
  - verify v1 #1 — join requires nickname + 6-char code with "Nickname and room code are required" (EC-01) → fixed 2026-10-17
  - verify v1 #2 — adding a song takes an editable Singer Name defaulting to the nickname (AC-10) → fixed 2026-10-17
  - verify v1 #3 — queue reorder is drag-and-drop sending `target_position`; delete is confirmed (AC-12, AC-13) → fixed 2026-10-17
  - verify v1 #4 — optimistic playback/queue changes roll back on request failure (§8) → fixed 2026-10-17
  - verify v1 #5 — an offline indicator shows while the WebSocket is not connected (EC-04) → fixed 2026-10-17
  - verify v1 #6 — no camera QR scanner is built (§4 Not Included) → fixed 2026-10-17
  - verify v1 #7 — room pages call hooks unconditionally (lint clean) → fixed 2026-10-17
  - verify v2 #8 — a YouTube video that cannot play shows an error banner with "Skip to next song" for whoever controls playback (Flow 1 step 3) → fixed 2026-10-17
  - verify v2 #9 — a successful Add Song closes the modal and confirms with a toast (Flow 2 step 4, §8) → fixed 2026-10-17
  - verify v2 #10 — Create Room with no network shows "Unable to create room. Please check your connection." (Flow 1 step 1) → fixed 2026-10-17
  - verify v2 #11 — empty-queue and blocked-autoplay copy match EC-02 / EC-06 → fixed 2026-10-17
  - verify v3 #12 — the follower mute toggle and the "Audio Muted by Browser" notice are reachable in the phone-width guest view, not only fullscreen (FR-08, AC-19) → fixed 2026-10-17
  - code review v1 #1 — confirming Add Song with Enter submits the Singer Name as currently typed (AC-10) → fixed 2026-10-17
  - verify v4 #13 — closing the Add Song modal cancels the selection; nothing is queued without the confirm step (Flow 2 step 4) → fixed 2026-10-17
  - design-review v1 #1 — subtitle and idle status text must use accessible text-[#94A3B8] contrast (≥ 4.5:1 WCAG AA) on dark controls bar → fixed 2026-10-17
  - design-review v1 #2 — surface-light tokens and input backgrounds are consolidated to #1C1F30 → fixed 2026-10-17
  - design-review v1 #3 — queue drag-and-drop renders illuminated cyan drop target insertion line (border-t-2 border-[#06B6D4]) → fixed 2026-10-17
  - design-review v1 #4 — home page scroll hint text upgraded to text-slate-400 opacity-90 for mobile readability → fixed 2026-10-17
  - code review v3 #5 — HostPlayerPage direct URL entry requires an official host session or redirects to / → fixed 2026-10-17
  - code review v3 #6 — WebSongSearchModal fallback singer nickname is role-aware (Singer for guest, Host for host) → fixed 2026-10-17

---

## 15. Assumptions and Decisions

### Assumptions

| ID | Assumption | Impact if Wrong | Confirmed By |
| --- | --- | --- | --- |
| A-01 | React 19 SPA with Vite in `webapp/` is the preferred React framework | Project scaffolding location changes | User clarification |
| A-02 | Web guests join via URL directly from QR code on Host screen | Must add HTML5 camera scanner if physical QR scanning required from laptop webcam | Product design |
| A-03 | YouTube IFrame API satisfies host player requirements on desktop browsers | Custom video player needed if non-YouTube provider is introduced | Verified in `mobapp/` |

### Technical Decisions

| ID | Decision | Alternatives Rejected | Reason |
| --- | --- | --- | --- |
| D-01 | Create pure React.js SPA using Vite + React 19 + TypeScript + `react-router-dom` in `webapp/` | Next.js SSR, Create-React-App | QueueMic is a 100% client-side real-time app (WebSockets/Reverb, YouTube IFrame player, local state, no SSR needed). Vite eliminates hydration mismatches, builds instantly, and provides a lightweight SPA. |
| D-02 | Use official YouTube IFrame API via standard `<iframe id="yt-player">` | `react-native-webview` bridge, video.js | Zero bridge latency, full desktop browser compatibility, lightweight. |
| D-03 | Direct URL join (`/join?code=XYZ`) encoded into Host QR code | Camera scanner on desktop | Mobile phones have native camera QR scanners that open web URLs directly. |
| D-04 | Guests follow the Host with their own muted YouTube player (`WebVideoPlayer` `followHost`), mirroring `mobapp` `HostVideoPlayer` (`DRIFT_TOLERANCE_SECONDS 0.4`, `RESYNC_COOLDOWN_MS 3000`, learned seek lead ≤ 3 s) | Progress-bar-only guests (spec v1.1 FR-04) | Stakeholder confirmed the guest video view (verify v2 §7, Case 2); same behavior on web and mobile guests. |
| D-05 | Persist ephemeral room member session token in browser `localStorage` via `useAuthStore` | HttpOnly cookie, memory-only storage | Room tokens are strictly ephemeral with zero PII, scoped to a single active room session. Memory-only wipes session on mobile browser backgrounding/reload, while HttpOnly cookies require major backend changes violating §4 (0 backend modifications). Aligns with `mobapp`'s `AsyncStorage` usage. |

### Open Questions

| ID | Question | Owner | Blocks |
| --- | --- | --- | --- |
| *None* | All questions resolved. | — | — |

---

## 16. Change Log

| Version | Date | Type | Change | Reason / Impact | Changed Sections |
| --- | --- | --- | --- | --- | --- |
| 1.0 | 2026-10-17 | Initial | Created specification | Greenfield web application specification for QueueMic | All |
| 1.1 | 2026-10-17 | Major | Switch from Next.js SSR to pure React.js SPA (Vite + React Router) | User clarified React.js SPA requirement; eliminates SSR hydration hurdles and aligns with client-side realtime WebSocket architecture | §1, §2, §4, §8, §14, §15 |
| 1.1 | 2026-10-17 | Minor | Review findings recorded — /webkit-fix T00002 --verify (run v1): #1–#7 | Fix pass; no requirement changed | §14 |
| 1.1 | 2026-10-17 | Minor | Review findings recorded — /webkit-fix T00002 --verify (run v2): #8–#11 | Fix pass; no requirement changed | §14 |
| 1.2 | 2026-10-17 | Major | Added the guest follower video (Flow 3, FR-08, AC-17–AC-19, EC-07, D-04) and the Host position-report timing (FR-03, AC-20); SC-02 covers the follower video; FR-04 no longer excludes a video player; token-storage conflict raised as Q-01 | Stakeholder confirmed the built guest video view (verify v2 §7, Case 2); FR-01 vs security baseline flagged by verify v2 §4 | §2, §4, §5, §6, §8, §10, §11, §12, §15 |
| 1.2 | 2026-10-17 | Minor | Review findings recorded — /webkit-fix T00002 --verify (run v3): #12 | Fix pass; no requirement changed | §14 |
| 1.2 | 2026-10-17 | Minor | Review findings recorded — /webkit-fix T00002 --code-review (run v1): #1 | Fix pass; no requirement changed | §14 |
| 1.2 | 2026-10-17 | Minor | Resolved Q-01: Approved D-05 (`localStorage` for ephemeral room-scoped tokens) | Unblocks ticket closing; documents sanctioned exception to security-baseline for ephemeral zero-PII guest tokens | §15 |
| 1.2 | 2026-10-17 | Minor | Specification approved by the stakeholder | Approval recorded; no requirement changed; Open Questions empty (Q-01 resolved by D-05) | Metadata (Status) |
| 1.2 | 2026-10-17 | Minor | Review findings recorded — /webkit-fix T00002 --verify (run v4): #13 | Fix pass; no requirement changed | §14 |
| 1.2 | 2026-10-17 | Minor | Ticket closed — verify ✅ PASS (after fix pass v4.1), code review APPROVED, 18/18 tasks, no open questions | Closing a ticket (ticket-numbering §5) | Metadata (Status) |
| 1.2 | 2026-10-17 | Minor | Review findings recorded — /webkit-fix T00002 --design-review (run v1): #1–#4 + Modern Enhancements #1–#3 | Fix pass; all design findings resolved; no requirement changed | §14 |
| 1.2 | 2026-10-17 | Minor | Review findings recorded — /webkit-fix T00002 --code-review (run v3): #5, #6 | Fix pass; no requirement changed | §14 |
