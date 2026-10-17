# Implementation Plan — ReactJS Web Application (QueueMic Web)

<!--
TEMPLATE: implementation-plan (written by /webkit-specify beside spec.md; executed by /webkit-implement)
-->

## Metadata

| Field | Value |
| --- | --- |
| Project Name | queuemic |
| Ticket Number | T00002 |
| Feature Name | ReactJS Web Application (QueueMic Web) |
| Specification | `.agents/specs/queuemic/T00002/spec.md` |
| Based on Spec Version | 1.2 |
| Plan Revision | 3 |
| Created Date | 2026-10-17 |
| Plan Status | Done |

---

## 1. Technical Context

| Aspect | Value |
| --- | --- |
| Project | `queuemic` (QueueMic Karaoke Room System) |
| Backend | Laravel 13, Clean Architecture (`backend/app/Http/Controllers/Api/V1/`, `backend/app/Actions/`, `backend/app/Queries/`, `backend/app/Events/`) |
| Frontend | React 19 SPA (Vite, TypeScript, Tailwind CSS, `react-router-dom`) in `webapp/` |
| HTTP client | Axios in `webapp/src/api/client.ts` with `Authorization: Bearer <token>` and `X-Session-Token` headers |
| State | Zustand in `webapp/src/store/` with browser `localStorage` persistence |
| Database conventions | Eloquent ORM, snake_case DB columns normalized to camelCase via `normalizer.ts` |
| Design system | Dark Cyber aesthetic with custom glassmorphism, glowing gradients, and unified color tokens in `webapp/src/theme/colors.ts` |
| Reference implementation | `mobapp/src/` (same backend contracts, normalizer, clock sync, and store architectures) |
| Checks | `npm run lint` and `npm run typecheck` in `webapp/` |
| Tests | Vitest runner in `webapp/` (`npm run test`) |

---

## 2. Reuse Map

| Artifact | Searched | Found | Decision |
| --- | --- | --- | --- |
| Room API endpoints | `backend/routes/api.php` | `POST /api/v1/rooms`, `POST /api/v1/rooms/join`, `GET /api/v1/rooms/{code}` | REUSE — exact existing endpoints |
| Queue API endpoints | `backend/routes/api.php` | `GET/POST /api/v1/rooms/{code}/queue`, `DELETE .../{queueId}`, `POST .../move` | REUSE — exact existing endpoints |
| Playback API endpoints | `backend/routes/api.php` | `GET .../playback`, `POST .../playback/state`, `POST .../playback/next` | REUSE — exact existing endpoints |
| Server clock endpoint | `backend/routes/api.php` | `GET /api/v1/time` | REUSE — returns `server_time_ms` for drift sync |
| Broadcasting config & auth | `backend/routes/api.php` | `GET /api/v1/broadcasting/config`, `POST /api/v1/broadcasting/auth` | REUSE — dynamic Reverb/Pusher setup |
| Realtime events & channels | `backend/app/Events/` | `QueueUpdatedEvent`, `PlaybackStateChangedEvent`, `SongStartedEvent`, etc. | REUSE — identical event payload shapes on `presence-room.{code}` |
| Domain TypeScript interfaces | `mobapp/src/types/index.ts` | `Room`, `RoomMember`, `Song`, `KaraokeQueueItem`, `PlaybackState` | REUSE — mirror definitions in `webapp/src/types/index.ts` |
| Design tokens & colors | `mobapp/src/theme/colors.ts` | Cyber Violet `#8B5CF6`, Neon Fuchsia `#EC4899`, Dark Surface `#0A0A0F` | REUSE — mirror tokens in `webapp/src/theme/colors.ts` |
| Normalizer utilities | `mobapp/src/utils/normalizer.ts` | `normalizeSong`, `normalizeQueueItem` | REUSE — port logic to `webapp/src/utils/normalizer.ts` |
| Clock sync algorithm | `mobapp/src/services/serverClock.ts` | `syncServerClock`, `toServerTime`, `toLocalTime` | REUSE — port logic to `webapp/src/services/serverClock.ts` |
| Video player component | `mobapp/src/components/player/HostVideoPlayer.tsx` | Mobile WebView player | CREATE — web uses official YouTube IFrame API (`window.YT.Player`) |
| Guest follower sync rules | `mobapp/src/components/player/HostVideoPlayer.tsx:10-15,436-507` (`followHost`), `mobapp/src/screens/GuestRoomScreen.tsx:228-239`; `graphify explain "WebVideoPlayer"` | Drift tolerance 0.4 s, resync cooldown 3 s, learned seek lead ≤ 3 s, latest-handler ref for YT callbacks; `WebVideoPlayer` already takes `followHost` / `syncAnchor` / `muted` | EXTEND — `WebVideoPlayer.tsx` (FR-08) |
| Host position reports | `mobapp/src/screens/HostPlayerScreen.tsx:169-184` | 500 ms tick, first report once position > 0, then every `HEARTBEAT_INTERVAL_MS` (30 s) | EXTEND — `HostPlayerPage.tsx` report effect (FR-03) |
| Vite React App Shell | `webapp/` | NONE | CREATE — pure React SPA created via `npx -y create-vite@latest webapp --template react-ts` |

---

## 3. File Change Map

| # | Path | Action | Task | Covers |
| --- | --- | --- | --- | --- |
| 1 | `webapp/package.json` | Create | TASK-01 | FR-01, NFR-02 |
| 2 | `webapp/vite.config.ts` | Create | TASK-01 | NFR-02 |
| 3 | `webapp/tsconfig.json` | Create | TASK-01 | NFR-04 |
| 4 | `webapp/index.html` | Create | TASK-01 | NFR-04 |
| 5 | `webapp/vitest.config.ts` | Create | TASK-02 | NFR-04 |
| 6 | `webapp/src/types/index.ts` | Create | TASK-04 | FR-01, NFR-04 |
| 7 | `webapp/src/theme/colors.ts` | Create | TASK-04 | NFR-04 |
| 8 | `webapp/src/index.css` | Create | TASK-04 | NFR-04 |
| 9 | `webapp/src/main.tsx` | Create | TASK-04 | NFR-02, NFR-04 |
| 10 | `webapp/src/utils/normalizer.ts` | Create | TASK-05 | FR-05, NFR-04 |
| 11 | `webapp/src/utils/formatting.ts` | Create | TASK-05 | FR-05, NFR-04 |
| 12 | `webapp/src/utils/storage.ts` | Create | TASK-05 | FR-01, NFR-01 |
| 13 | `webapp/__tests__/utils/normalizer.test.ts` | Create | TASK-05 | AC-09, AC-10 |
| 14 | `webapp/src/api/client.ts` | Create | TASK-06 | FR-01, NFR-01 |
| 15 | `webapp/src/api/roomApi.ts` | Create | TASK-06 | FR-01, AC-01, AC-02 |
| 16 | `webapp/src/api/queueApi.ts` | Create | TASK-06 | FR-05, FR-06, AC-10 |
| 17 | `webapp/src/api/playbackApi.ts` | Create | TASK-06 | FR-03, AC-06, AC-07 |
| 18 | `webapp/src/api/songApi.ts` | Create | TASK-06 | FR-05, AC-09 |
| 19 | `webapp/src/services/serverClock.ts` | Create | TASK-07 | FR-04, AC-08 |
| 20 | `webapp/src/services/echo.ts` | Create | TASK-07 | FR-02, AC-04, AC-05 |
| 21 | `webapp/__tests__/services/serverClock.test.ts` | Create | TASK-07 | AC-08 |
| 22 | `webapp/src/store/useAuthStore.ts` | Create | TASK-08 | FR-01, AC-01, AC-02 |
| 23 | `webapp/src/store/useRoomStore.ts` | Create | TASK-08 | FR-01, FR-07, AC-15 |
| 24 | `webapp/src/store/useQueueStore.ts` | Create | TASK-08 | FR-05, AC-10, AC-11 |
| 25 | `webapp/src/store/usePlaybackStore.ts` | Create | TASK-08 | FR-03, FR-04, AC-08 |
| 26 | `webapp/__tests__/store/useAuthStore.test.ts` | Create | TASK-08 | AC-01, AC-02 |
| 27 | `webapp/src/hooks/useEchoRoom.ts` | Create | TASK-09 | FR-02, FR-07, AC-14, AC-15 |
| 28 | `webapp/src/hooks/useDebounce.ts` | Create | TASK-09 | FR-05, AC-09 |
| 29 | `webapp/src/components/common/GlassCard.tsx` | Create | TASK-10 | NFR-04 |
| 30 | `webapp/src/components/common/NeonButton.tsx` | Create | TASK-10 | NFR-04 |
| 31 | `webapp/src/components/player/WebVideoPlayer.tsx` | Create | TASK-11 | FR-03, AC-06, AC-07 |
| 32 | `webapp/src/components/player/WebPlaybackControls.tsx` | Create | TASK-11 | FR-03, AC-06 |
| 33 | `webapp/src/components/player/WebGuestProgressBar.tsx` | Create | TASK-11 | FR-04, AC-08 |
| 34 | `webapp/__tests__/components/WebVideoPlayer.test.tsx` | Create | TASK-11 | AC-06, AC-08 |
| 35 | `webapp/src/components/queue/WebQueueList.tsx` | Create | TASK-12 | FR-05, FR-06, AC-12, AC-13 |
| 36 | `webapp/src/components/queue/WebQueueItemCard.tsx` | Create | TASK-12 | FR-05, FR-06 |
| 37 | `webapp/src/components/search/WebSongSearchModal.tsx` | Create | TASK-12 | FR-05, AC-09, AC-10 |
| 38 | `webapp/src/components/room/WebQRCodeDisplay.tsx` | Create | TASK-13 | FR-01, AC-01 |
| 39 | `webapp/src/components/room/WebMemberListModal.tsx` | Create | TASK-13 | FR-07, AC-15 |
| 40 | `webapp/src/App.tsx` | Create | TASK-14 | FR-01, AC-01, AC-02 |
| 41 | `webapp/src/pages/HomePage.tsx` | Create | TASK-14 | FR-01, AC-01, AC-02 |
| 42 | `webapp/src/pages/CreateRoomPage.tsx` | Create | TASK-14 | FR-01, AC-01 |
| 43 | `webapp/src/pages/JoinRoomPage.tsx` | Create | TASK-14 | FR-01, AC-02 |
| 44 | `webapp/src/pages/HostPlayerPage.tsx` | Create | TASK-15 | FR-03, AC-06, AC-07 |
| 45 | `webapp/src/pages/GuestRoomPage.tsx` | Create | TASK-15 | FR-04, FR-05, AC-08, AC-10 |
| 46 | `webapp/__tests__/e2e/roomFlow.test.ts` | Create | TASK-16 | AC-01 through AC-16 |
| 47 | `webapp/src/components/player/WebVideoPlayer.tsx` | Modify | TASK-17 | FR-08, AC-17, AC-18, AC-19 |
| 48 | `webapp/__tests__/components/WebVideoPlayer.test.tsx` | Modify | TASK-17 | AC-17, AC-18, AC-19 |
| 49 | `webapp/src/pages/HostPlayerPage.tsx` | Modify | TASK-18 | FR-03, AC-20 |
| 50 | `webapp/__tests__/pages/HostPlayerPage.test.tsx` | Create | TASK-18 | AC-20 |

---

## 4. Phase 1 — Preparation

- **Goal:** Initialize the React.js (Vite + TypeScript) web application scaffolding in `webapp/`, install dependencies, and setup the Vitest test runner.
- **Exit check:** `npm run typecheck` and `npm run test` pass in `webapp/`.

- [x] **TASK-01 — Initialize Vite React Web App and Dependencies**
  - **Files:** `webapp/package.json` (Create), `webapp/vite.config.ts` (Create), `webapp/tsconfig.json` (Create), `webapp/index.html` (Create)
  - **Change:** Initialize React 19 app in `webapp/` using `npx -y create-vite@latest webapp --template react-ts` and install `react-router-dom`, `axios`, `laravel-echo`, `pusher-js`, `zustand`, `lucide-react`, `qrcode.react`, `@tailwindcss/vite` and `tailwindcss`.
  - **Test:** `webapp/package.json` exists with required dependencies.
  - **Covers:** FR-01, NFR-02, NFR-04
  - **Depends on:** None
  - **Done when:** `cd webapp && npm run build` initializes without errors.

- [x] **TASK-02 — Configure Vitest Test Runner**
  - **Files:** `webapp/vitest.config.ts` (Create), `webapp/package.json` (Modify)
  - **Change:** Add Vitest, `@testing-library/react`, and `jsdom` to devDependencies; configure `vitest.config.ts` with React plugin and jsdom environment; add `"test": "vitest run"` script.
  - **Test:** Run `npm run test` in `webapp/` with a sample passing test.
  - **Covers:** NFR-04
  - **Depends on:** TASK-01
  - **Done when:** `npm run test` executes and reports passing test suite.

---

## 5. Phase 2 — Backend Verification

- **Goal:** Confirm backend API endpoints, WebSocket configuration, and route contracts are fully functional and accessible without changes.
- **Exit check:** Backend routes exist and test suite passes.

- [x] **TASK-03 — Verify Backend Routes and Broadcasting Readiness**
  - **Files:** `backend/routes/api.php` (Read-only verification)
  - **Change:** None. Verify that `POST /api/v1/rooms`, `POST /api/v1/rooms/join`, `GET /api/v1/broadcasting/config`, `POST /api/v1/broadcasting/auth`, and `presence-room.{code}` are active.
  - **Test:** `php artisan route:list --path=api/v1` lists all expected endpoints.
  - **Covers:** FR-01, FR-02, NFR-04
  - **Depends on:** None
  - **Done when:** Command outputs all 16 API endpoints cleanly.

---

## 6. Phase 3 — Frontend Integration

- **Goal:** Implement the complete web application: domain types, styling, utilities, API client, realtime Echo service, stores, components, and pages.
- **Exit check:** All unit and integration tests pass; `npm run typecheck` passes; the app loads on `http://localhost:3000`.

- [x] **TASK-04 — Theme Tokens, Global CSS, and Domain Types**
  - **Files:** `webapp/src/types/index.ts` (Create), `webapp/src/theme/colors.ts` (Create), `webapp/src/index.css` (Create), `webapp/src/main.tsx` (Create)
  - **Change:** Define domain interfaces (`Room`, `RoomMember`, `Song`, `KaraokeQueueItem`, `PlaybackState`, `PlaybackSession`, `RoomSettings`); export color tokens (`#0A0A0F`, `#12131C`, `#8B5CF6`, `#EC4899`, etc.); apply dark cyber background and fonts in `index.css` and `main.tsx`.
  - **Test:** `npm run typecheck` verifies types compile.
  - **Covers:** NFR-04
  - **Depends on:** TASK-01
  - **Done when:** Root DOM renders dark themed cyber shell.

- [x] **TASK-05 — Data Normalizers, Formatters, and Storage Adapters**
  - **Files:** `webapp/src/utils/normalizer.ts` (Create), `webapp/src/utils/formatting.ts` (Create), `webapp/src/utils/storage.ts` (Create), `webapp/__tests__/utils/normalizer.test.ts` (Create)
  - **Change:** Implement `normalizeSong()` and `normalizeQueueItem()` mapping snake_case Eloquent attributes to camelCase; implement `formatDuration()` (`mm:ss`) and room code uppercase sanitizer; implement browser-safe `localStorage` wrapper `appStorage`.
  - **Test:** `webapp/__tests__/utils/normalizer.test.ts` tests normalization of raw backend payloads.
  - **Covers:** FR-05, NFR-01, AC-09, AC-10
  - **Depends on:** TASK-04
  - **Done when:** Vitest test passes.

- [x] **TASK-06 — Axios API Client and Domain Endpoints**
  - **Files:** `webapp/src/api/client.ts` (Create), `webapp/src/api/roomApi.ts` (Create), `webapp/src/api/queueApi.ts` (Create), `webapp/src/api/playbackApi.ts` (Create), `webapp/src/api/songApi.ts` (Create)
  - **Change:** Configure Axios instance with `import.meta.env.VITE_API_URL` and request interceptor injecting `Authorization: Bearer <token>` and `X-Session-Token: <token>`; implement `roomApi` (create, join, details, members), `queueApi` (index, store with `Idempotency-Key`, move, destroy), `playbackApi` (status, updateState, next, skip), and `songApi` (search).
  - **Test:** Typecheck passes and mock request tests confirm header injection.
  - **Covers:** FR-01, FR-03, FR-05, FR-06, AC-01, AC-02, AC-10
  - **Depends on:** TASK-05
  - **Done when:** All API modules compile and typecheck.

- [x] **TASK-07 — Realtime Laravel Echo Service and NTP Server Clock Sync**
  - **Files:** `webapp/src/services/serverClock.ts` (Create), `webapp/src/services/echo.ts` (Create), `webapp/__tests__/services/serverClock.test.ts` (Create)
  - **Change:** Port `syncServerClock()` with NTP 5-sample round-trip latency evaluation and export `toServerTime()`, `toLocalTime()`; implement browser-safe `getEcho()` and `fetchBroadcastingConfig()` querying `GET /api/v1/broadcasting/config` and authenticating channels via `POST /api/v1/broadcasting/auth`.
  - **Test:** `webapp/__tests__/services/serverClock.test.ts` asserts clock offset calculations.
  - **Covers:** FR-02, FR-04, AC-04, AC-05, AC-08
  - **Depends on:** TASK-06
  - **Done when:** Test passes and Echo factory initializes.

- [x] **TASK-08 — Zustand State Management Stores**
  - **Files:** `webapp/src/store/useAuthStore.ts` (Create), `webapp/src/store/useRoomStore.ts` (Create), `webapp/src/store/useQueueStore.ts` (Create), `webapp/src/store/usePlaybackStore.ts` (Create), `webapp/__tests__/store/useAuthStore.test.ts` (Create)
  - **Change:** Implement persistent `useAuthStore` (token, memberId, nickname, role, deviceUuid); `useRoomStore` (room, members, isConnected); `useQueueStore` (queue, currentPlaying); `usePlaybackStore` (state, currentTimeSeconds, durationSeconds, syncAnchor, `getLivePlaybackPosition`).
  - **Test:** `webapp/__tests__/store/useAuthStore.test.ts` tests store auth state setting and clearing.
  - **Covers:** FR-01, FR-03, FR-04, FR-05, AC-01, AC-02
  - **Depends on:** TASK-05
  - **Done when:** Store tests pass.

- [x] **TASK-09 — Realtime Room WebSocket Hook and Presence Management**
  - **Files:** `webapp/src/hooks/useEchoRoom.ts` (Create), `webapp/src/hooks/useDebounce.ts` (Create)
  - **Change:** Implement `useEchoRoom(roomCode, isHost)` subscribing to `presence-room.{code}` via Echo; handle `.here()`, `.joining()`, `.leaving()`; listen for `.queue.updated`, `.playback.state_changed`, `.song.started`, `.room.settings_updated`, `.host.transferred`, `.room.closed`; run 60-second heartbeat calling `roomApi.heartbeat()`; implement `useDebounce(value, delay)`.
  - **Test:** Typecheck passes and mock hook subscription tests pass.
  - **Covers:** FR-02, FR-07, AC-04, AC-14, AC-15
  - **Depends on:** TASK-07, TASK-08
  - **Done when:** Hook compiles without React or SSR errors.

- [x] **TASK-10 — Shared Cyber-Glass UI Components**
  - **Files:** `webapp/src/components/common/GlassCard.tsx` (Create), `webapp/src/components/common/NeonButton.tsx` (Create)
  - **Change:** Implement `GlassCard` with frosted backdrop-blur, subtle borders, and glow styling; implement `NeonButton` with gradient styles, loading spinner, and disabled states.
  - **Test:** Render tests pass with jsdom.
  - **Covers:** NFR-04
  - **Depends on:** TASK-04
  - **Done when:** UI primitives render correctly.

- [x] **TASK-11 — YouTube Web Video Player, Playback Controls, and Progress Bar**
  - **Files:** `webapp/src/components/player/WebVideoPlayer.tsx` (Create), `webapp/src/components/player/WebPlaybackControls.tsx` (Create), `webapp/src/components/player/WebGuestProgressBar.tsx` (Create), `webapp/__tests__/components/WebVideoPlayer.test.tsx` (Create)
  - **Change:** Implement `WebVideoPlayer` embedding YouTube IFrame API via `<div id="yt-player">`, handling `onReady`, `onStateChange`, `onSongEnd` (triggering `/playback/next`), user gesture autoplay guard, drift resync tolerance (`0.4s`); implement `WebPlaybackControls` (Play, Pause, Skip, Next); implement `WebGuestProgressBar` animating progress based on server timestamp.
  - **Test:** `webapp/__tests__/components/WebVideoPlayer.test.tsx` verifies drift calculation and event callbacks.
  - **Covers:** FR-03, FR-04, AC-06, AC-07, AC-08
  - **Depends on:** TASK-07, TASK-08, TASK-10
  - **Done when:** Component tests pass.

- [x] **TASK-12 — Queue Management and Song Search Components**
  - **Files:** `webapp/src/components/queue/WebQueueList.tsx` (Create), `webapp/src/components/queue/WebQueueItemCard.tsx` (Create), `webapp/src/components/search/WebSongSearchModal.tsx` (Create)
  - **Change:** Implement `WebQueueList` displaying current playing hero and pending list; implement `WebQueueItemCard` with singer badge, position number, and delete/move buttons; implement `WebSongSearchModal` with live search querying `songApi.search()` and "Add to Queue" action with singer nickname.
  - **Test:** Component tests assert song search rendering and queue item actions.
  - **Covers:** FR-05, FR-06, AC-09, AC-10, AC-12, AC-13
  - **Depends on:** TASK-06, TASK-08, TASK-10
  - **Done when:** Components render and handle search/queue actions.

- [x] **TASK-13 — QR Code Display and Member Presence Modal**
  - **Files:** `webapp/src/components/room/WebQRCodeDisplay.tsx` (Create), `webapp/src/components/room/WebMemberListModal.tsx` (Create)
  - **Change:** Implement `WebQRCodeDisplay` generating SVG QR code for `https://<domain>/join?code={code}` with copy-link button; implement `WebMemberListModal` drawer listing connected members with role badges and avatar colors.
  - **Test:** Render test verifies QR code renders with correct URL string.
  - **Covers:** FR-01, FR-07, AC-01, AC-15
  - **Depends on:** TASK-08, TASK-10
  - **Done when:** QR code and member drawer render properly.

- [x] **TASK-14 — Landing, Create Room, and Join Room Pages**
  - **Files:** `webapp/src/App.tsx` (Create), `webapp/src/pages/HomePage.tsx` (Create), `webapp/src/pages/CreateRoomPage.tsx` (Create), `webapp/src/pages/JoinRoomPage.tsx` (Create)
  - **Change:** Implement `App.tsx` configuring `BrowserRouter`, `Routes`, and `Route`; implement landing screen with "Create Karaoke Room" and "Join Room" buttons; implement `/create` form submitting to `roomApi.createRoom()`, saving auth token, and navigating to `/host/:code`; implement `/join` form reading query parameter `?code=ABCDEF`, submitting to `roomApi.joinRoom()`, saving auth token, and navigating to `/room/:code`.
  - **Test:** Integration tests assert form submission and navigation triggers.
  - **Covers:** FR-01, AC-01, AC-02, AC-03
  - **Depends on:** TASK-06, TASK-08, TASK-10
  - **Done when:** All three onboarding pages compile and handle submissions.

- [x] **TASK-15 — Host Player Screen and Guest Room Screen**
  - **Files:** `webapp/src/pages/HostPlayerPage.tsx` (Create), `webapp/src/pages/GuestRoomPage.tsx` (Create)
  - **Change:** Implement `/host/:code` hosting `WebVideoPlayer`, playback controls, QR code popup, active queue sidebar, and host permissions; implement `/room/:code` for guests with `WebGuestProgressBar`, now-playing card, queue list, "Search Songs" floating button, and member drawer.
  - **Test:** Component integration tests assert mounting and store subscriptions.
  - **Covers:** FR-01, FR-03, FR-04, FR-05, FR-07, AC-06, AC-08, AC-10
  - **Depends on:** TASK-09, TASK-11, TASK-12, TASK-13
  - **Done when:** Both room screens load and synchronize in browser.

- [x] **TASK-17 — Guest Follower Video Sync and Mute Choice (spec v1.2)**
  - **Files:** `webapp/src/components/player/WebVideoPlayer.tsx` (Modify), `webapp/__tests__/components/WebVideoPlayer.test.tsx` (Modify)
  - **Change:** Route the YT.Player `onReady` / poll / `onStateChange` callbacks through a latest-handler ref so `resyncToRoom` reads the current `syncAnchor`, `isPlaying`, `durationSeconds`. With `followHost`: seek to `getExpectedPosition(anchor) + seekLead` when drift > `DRIFT_TOLERANCE_SECONDS` (0.4) and `RESYNC_COOLDOWN_MS` (3000) has passed, learning `seekLead` (0–`MAX_SEEK_LEAD_SECONDS` 3) from the residual drift; on `PLAYING` while the room is not playing → `pauseVideo()`; on `PAUSED` with a `paused` anchor → park on `anchor.positionSeconds` once per anchor (only from YT state `PAUSED`); on `visibilitychange` → visible while the room plays and the player is `PAUSED` → `playVideo()`. `onReady` mutes from the current `muted` prop only; the browser-muted fallback sets `webAutoMuted`, the mute button shows muted, and one tap unmutes.
  - **Test:** `WebVideoPlayer.test.tsx` with a fake `window.YT.Player` and fake timers: no seek through a 20 s pause and resume (AC-18); parks on the paused position; a song-start `buffering` anchor is not chased, the first live anchor is (AC-17); a seek that lands 0.8 s short is followed by one led seek, then none; a paused room pauses a self-started player; unmuted guest's next player starts with sound, the browser-muted fallback shows "Unmute" and one tap restores sound (AC-19).
  - **Covers:** FR-08, AC-17, AC-18, AC-19, EC-07
  - **Depends on:** TASK-11, TASK-15
  - **Done when:** The listed tests pass, and fail when the callbacks are bound once per video or `onReady` mutes every follower.

- [x] **TASK-18 — Host Position Report Timing (spec v1.2)**
  - **Files:** `webapp/src/pages/HostPlayerPage.tsx` (Modify), `webapp/__tests__/pages/HostPlayerPage.test.tsx` (Create)
  - **Change:** Replace the fixed 30 s interval with an effect keyed on `[roomCode, currentPlaying?.id, playbackState]` that, while `playing`, ticks every 500 ms and calls `playbackApi.updatePlaybackState(roomCode, 'playing', getLivePlaybackPosition(), currentPlaying.id)` once `currentTimeSeconds > 0` and at least `HEARTBEAT_INTERVAL_MS` (30000) since its last report (first report immediately).
  - **Test:** `HostPlayerPage.test.tsx` with `useEchoRoom` and `playbackApi` mocked and fake timers: one report within 600 ms of playing, none more until 30 s; one report within 600 ms after paused → playing; none while position is 0 (AC-20).
  - **Covers:** FR-03, AC-20
  - **Depends on:** TASK-15
  - **Done when:** The listed tests pass.

---

## 7. Phase 4 — Validation

- **Goal:** Verify end-to-end integration and run full test suites to ensure 100% acceptance criteria compliance and zero regressions in the mobile app.
- **Exit check:** All tests green; typecheck passes; manual acceptance walk complete.

- [x] **TASK-16 — End-to-End Acceptance Walk and Mobile Zero-Regression Check**
  - **Files:** `webapp/__tests__/e2e/roomFlow.test.ts` (Create)
  - **Change:** Run automated acceptance suite exercising room creation, join, queue search, queue add, playback sync, and heartbeat; verify `git status mobapp/` and `git status backend/` confirm zero changes to existing mobile and backend code.
  - **Test:** `npm run test` in `webapp/` passes; `npm run typecheck` in `webapp/` passes.
  - **Covers:** AC-01 through AC-16
  - **Depends on:** TASK-14, TASK-15
  - **Done when:** All 16 acceptance criteria pass verification.

---

## 8. Acceptance Walk

| AC | Exercised By | Command / Steps | Task |
| --- | --- | --- | --- |
| AC-01 | Automated & Manual | `vitest run --filter="CreateRoom"` / MT-01 | TASK-14 |
| AC-02 | Automated & Manual | `vitest run --filter="JoinRoom"` / MT-02 | TASK-14 |
| AC-03 | Automated | `vitest run --filter="NicknameTaken"` | TASK-14 |
| AC-04 | Automated | `vitest run --filter="EchoConfig"` | TASK-07 |
| AC-05 | Automated | `vitest run --filter="EchoAuth"` | TASK-07 |
| AC-06 | Automated & Manual | `vitest run --filter="VideoPlayer"` / MT-01 | TASK-11, TASK-15 |
| AC-07 | Automated | `vitest run --filter="SongEndNext"` | TASK-11 |
| AC-08 | Automated & Manual | `vitest run --filter="GuestProgressSync"` / MT-03 | TASK-11, TASK-15 |
| AC-09 | Automated & Manual | `vitest run --filter="SongSearch"` / MT-02 | TASK-12 |
| AC-10 | Automated & Manual | `vitest run --filter="AddToQueue"` / MT-02 | TASK-12 |
| AC-11 | Automated | `vitest run --filter="IdempotentQueue"` | TASK-06, TASK-12 |
| AC-12 | Automated | `vitest run --filter="MoveQueueItem"` | TASK-12 |
| AC-13 | Automated | `vitest run --filter="RemoveQueueItem"` | TASK-12 |
| AC-14 | Automated | `vitest run --filter="HeartbeatTimer"` | TASK-09 |
| AC-15 | Automated | `vitest run --filter="PresenceDrawer"` | TASK-13 |
| AC-16 | Manual / Git Check | `git status mobapp/ backend/` proves 0 modified files | TASK-16 |
| AC-17 | Automated & Manual | `npx vitest run __tests__/components/WebVideoPlayer.test.tsx` / MT-04 | TASK-17 |
| AC-18 | Automated & Manual | `npx vitest run __tests__/components/WebVideoPlayer.test.tsx` / MT-04 | TASK-17 |
| AC-19 | Automated & Manual | `npx vitest run __tests__/components/WebVideoPlayer.test.tsx` / MT-04 | TASK-17 |
| AC-20 | Automated | `npx vitest run __tests__/pages/HostPlayerPage.test.tsx` | TASK-18 |

---

## 9. Commands for the User

| Order | Command / Action | When | Rollback |
| --- | --- | --- | --- |
| 1 | `cd webapp && npm run dev` | To start the web development server on `http://localhost:5173` | Stop dev server with `Ctrl+C` |
| 2 | `cd webapp && npm run test` | To run Vitest unit and integration test suite | N/A — read only |
| 3 | `cd webapp && npm run typecheck` | To verify TypeScript types across the web application | N/A — read only |

---

## 10. Plan Change Log

| Plan Revision | Date | Spec Version | Change | Changed Tasks |
| --- | --- | --- | --- | --- |
| 1 | 2026-10-17 | 1.0 | Created plan | All (TASK-01 to TASK-16) |
| 2 | 2026-10-17 | 1.1 | Major: Switch from Next.js SSR to pure React.js SPA (Vite + React Router) | TASK-01, TASK-04, TASK-06, TASK-14, TASK-15 |
| 3 | 2026-10-17 | 1.2 | Major: guest follower video (FR-08) and Host position-report timing (FR-03) added as new tasks; finished tasks untouched | TASK-17, TASK-18 (new) |
