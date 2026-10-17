# Ticket Context — ReactJS Web Application (QueueMic Web)

<!--
TEMPLATE: ticket-context (context.md — written by /webkit-context before the spec; read first by /webkit-specify,
/webkit-implement and the reviews)
-->

## Metadata

| Field | Value |
| --- | --- |
| Ticket | T00002 (queuemic) |
| Feature | ReactJS Web Application (QueueMic Web) |
| Request | Introduce a new ReactJS web application for QueueMic while reusing the existing backend architecture; in implementation create file first npx create-next-app@latest |
| Context Run | v1 — 2026-10-17 — initial context mapping for Next.js/React web frontend |
| Graphify | used — graph built from graphify-out/graph.json (1115 nodes) · commands: query ×3, path ×1, affected ×1 |

---

## 1. Purpose (as requested)

Introduce a modern, responsive ReactJS/Next.js web frontend (`webapp/`) for QueueMic that reuses the existing Laravel backend API and real-time streaming architecture (Laravel Reverb / Pusher WebSocket abstraction). The web application provides both Host Player mode (large-screen YouTube playback with synchronized progress) and Guest Room mode (browsing/searching the song catalog, adding songs to queue, viewing turn order, and following playback progress), while keeping the React Native mobile app (`mobapp/`) and web client fully decoupled on the client side while sharing exact backend API contracts.

## 2. Project Facts That Matter

- **Backend Architecture:** Laravel API with clean architecture: thin controllers in `backend/app/Http/Controllers/Api/V1/`, domain queries in `backend/app/Queries/`, and domain actions in `backend/app/Actions/` — `backend/routes/api.php:1-81`
- **Authentication & Guest Access:** Tokenless guest onboarding. Calling `POST /api/v1/rooms` (Host) or `POST /api/v1/rooms/join` (Guest) generates a 40-character random token. Authenticated requests pass `Authorization: Bearer <token>` and `X-Session-Token: <token>`, hashed server-side with SHA-256 against `room_members.session_token_hash` — `backend/app/Http/Middleware/EnsureRoomMember.php:48-71`
- **Realtime Infrastructure:** Laravel Echo connecting over WebSockets to either Laravel Reverb or Pusher. Dynamic broadcaster config is fetched from `GET /api/v1/broadcasting/config`, and channel auth uses `POST /api/v1/broadcasting/auth` — `backend/app/Http/Controllers/Api/V1/BroadcastAuthController.php:13-80`
- **Presence Channel Contract:** Presence channel name is `presence-room.{code}`. Authorized members receive `{ id, nickname, avatar_color, role, is_connected }` — `backend/routes/channels.php:12-46`
- **Playback Synchronization:** Server clock endpoint `GET /api/v1/time` returns `server_time_ms`. Playback state broadcasts contain `current_time_seconds` and `position_at_ms` (server timestamp) to calculate drift-free playback — `backend/app/Http/Controllers/Api/V1/PlaybackController.php:37-47`, `mobapp/src/services/serverClock.ts:1-40`
- **State Management & Storage:** Zustand store modules with persistent storage via `localStorage` on web — `mobapp/src/store/useAuthStore.ts:26-58`, `mobapp/src/utils/storage.ts:13-45`
- **Web Project Scaffolding:** Pure React.js Single Page Application (SPA) using Vite + React 19 + TypeScript (`npx -y create-vite@latest webapp --template react-ts`) with `react-router-dom` — user clarified requirement.
- **Design Tokens:** Dark cyber-glass aesthetic: background `#0A0A0F`, surface `#12131C`, primary `#8B5CF6`, accent `#EC4899` / `#06B6D4` / `#F59E0B` — `mobapp/src/theme/colors.ts:1-40`

## 3. Key Findings

- **Entry point (Backend Public APIs):** `POST /api/v1/rooms` (create), `POST /api/v1/rooms/join` (join), `GET /api/v1/broadcasting/config` (WS config), `GET /api/v1/time` (clock) — `backend/routes/api.php:20-37`
- **Entry point (Backend Authenticated APIs):** `GET /api/v1/rooms/{code}`, `GET /api/v1/rooms/{code}/queue`, `POST /api/v1/rooms/{code}/queue`, `DELETE /api/v1/rooms/{code}/queue/{queueId}`, `GET /api/v1/rooms/{code}/playback`, `POST /api/v1/rooms/{code}/playback/state`, `POST /api/v1/rooms/{code}/heartbeat`, `GET /api/v1/songs/search` — `backend/routes/api.php:40-79`
- **Realtime Events on `room.{code}`:**
  - `queue.updated` with `{ queue: KaraokeQueueItem[] }` — `backend/app/Events/QueueUpdatedEvent.php:32`
  - `playback.state_changed` with `{ state, current_time_seconds, queue_item_id, position_at_ms }` — `backend/app/Events/PlaybackStateChangedEvent.php:34`
  - `song.started` with `{ current_playing: KaraokeQueueItem | null }` — `backend/app/Events/SongStartedEvent.php:32`
  - `member.joined` with `{ member: RoomMember }` — `backend/app/Events/MemberJoinedRoomEvent.php:32`
  - `member.left` with `{ member_id, nickname }` — `backend/app/Events/MemberLeftRoomEvent.php:31`
  - `room.settings_updated` with `{ settings: RoomSettings }` — `backend/app/Events/RoomSettingsUpdatedEvent.php:30`
  - `host.transferred` with `{ new_host_member_id }` — `backend/app/Events/HostTransferredEvent.php:32`
  - `room.closed` with `{ reason }` — `backend/app/Events/RoomClosedEvent.php:31`
- **Heartbeat Requirement:** The backend requires active presence; if the host is inactive past 30 minutes, the room expires. The client dispatches `POST /api/v1/rooms/{code}/heartbeat` every 60 seconds — `mobapp/src/hooks/useEchoRoom.ts:18`, `backend/routes/api.php:49`
- **Idempotent Queueing:** Adding songs to the queue supports an `Idempotency-Key` header (`regex:/^[A-Za-z0-9-]{8,64}$/`) to prevent duplicate song additions on retry — `backend/app/Http/Requests/V1/AddQueueRequest.php:17-28`, `mobapp/src/api/queueApi.ts:11-58`
- **YouTube Playback on Web:** Mobile relies on `react-native-webview` with custom bridge code, but web can directly leverage the official YouTube IFrame Player API (`window.YT.Player`) or React YouTube wrapper with zero bridge latency — `mobapp/src/components/player/HostVideoPlayer.tsx:32-50`
- **App Version Enforcement:** `EnforceAppVersion` middleware only checks `X-App-Version` if non-empty; web clients can pass standard web version header or omit it without triggering 426 — `backend/app/Http/Middleware/EnforceAppVersion.php:17-37`

## 4. Rules That Apply

- `.agents/rules/core/authority-boundary.md` — webkit-context maps without altering application code or creating specifications
- `backend/AGENTS.md` — Laravel backend conventions (clean architecture: Queries, Actions, FormRequests, no API Resources)
- `mobapp/AGENTS.md` — Mobile conventions (kept independent from web)
- `.agents/rules/conditional/skill-protocol.md` §3 — Template contract and citation requirements

## 5. Risks

- **YouTube Autoplay Restrictions on Web Browsers:** Browsers block unmuted video autoplay unless initiated by user interaction. The Host screen must prompt the user with an initial click ("Start Party" / "Begin Playback") before video autoplay begins — `mobapp/src/components/player/HostVideoPlayer.tsx:19-25`
- **Pusher-js Global Resolution in Vite:** In modern bundlers, `window.Pusher = Pusher` should be attached before initializing `laravel-echo` — `mobapp/src/services/echo.ts:19-25`
- **Realtime Port / SSL Mismatch:** When deploying behind reverse proxies or tunnels (Cloudflare, ngrok, Reverb SSL), the web app must respect dynamic parameters returned by `GET /api/v1/broadcasting/config` — `mobapp/src/services/echo.ts:116-157`

## 6. Open Questions

- *None* — Framework confirmed as pure React.js SPA (Vite + TypeScript + React Router in `webapp/`). Host full-screen playback and mobile-web guest queueing confirmed. URL-based QR code join confirmed.
