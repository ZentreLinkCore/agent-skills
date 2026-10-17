# Touched Files — ReactJS Web Application (QueueMic Web)

<!--
TEMPLATE: touched-files (touched-files.md — written by /webkit-context; rewritten on every run)
-->

| Field | Value |
| --- | --- |
| Ticket | T00002 (queuemic) |
| Context Run | v1 — 2026-10-17 |

## 1. Modify

| Path | Construct | Why | Evidence |
| --- | --- | --- | --- |
| *None* | N/A | Existing backend API and mobile app remain completely preserved without modification. | `backend/routes/api.php:1-81` |

## 2. Create (candidate)

| Path | Why nothing existing fits | Search run |
| --- | --- | --- |
| `webapp/package.json` | React web application package manifest created via `npx -y create-vite@latest webapp --template react-ts` | `ls webapp/` → directory does not exist |
| `webapp/vite.config.ts` | Vite build and dev server configuration | `ls webapp/` → no match |
| `webapp/index.html` | Root HTML template with cyber dark theme and title | `ls webapp/` → no match |
| `webapp/src/main.tsx` | React 19 application entry point | `ls webapp/` → no match |
| `webapp/src/App.tsx` | React Router route configuration (`BrowserRouter`, `Routes`, `Route`) | `ls webapp/` → no match |
| `webapp/src/pages/HomePage.tsx` | Web landing screen: Join Room and Create Room navigation | `ls webapp/` → no match |
| `webapp/src/pages/CreateRoomPage.tsx` | Create room page with Host nickname and room name | `ls webapp/` → no match |
| `webapp/src/pages/JoinRoomPage.tsx` | Join room page with 6-character room code input and nickname | `ls webapp/` → no match |
| `webapp/src/pages/HostPlayerPage.tsx` | Host Player page (YouTube TV display, QR code, live queue, controls) | `ls webapp/` → no match |
| `webapp/src/pages/GuestRoomPage.tsx` | Guest Room page (synced playback progress, catalog search, queue list) | `ls webapp/` → no match |
| `webapp/src/api/client.ts` | Web Axios client with Bearer session token & `X-Session-Token` headers | `ls webapp/` → no match |
| `webapp/src/api/roomApi.ts` | Web API functions for room creation, joining, members, settings | `ls webapp/` → no match |
| `webapp/src/api/queueApi.ts` | Web API functions for queue fetching, adding with idempotency, moving, deleting | `ls webapp/` → no match |
| `webapp/src/api/playbackApi.ts` | Web API functions for playback status, server clock sync, skip, state updates | `ls webapp/` → no match |
| `webapp/src/api/songApi.ts` | Web API functions for YouTube karaoke song search | `ls webapp/` → no match |
| `webapp/src/services/echo.ts` | Web Laravel Echo / Pusher / Reverb service with dynamic backend config | `ls webapp/` → no match |
| `webapp/src/services/serverClock.ts` | NTP-style server clock offset estimator for playback synchronization | `ls webapp/` → no match |
| `webapp/src/store/useAuthStore.ts` | Zustand store for guest/host session tokens, member ID, role, and persistent `localStorage` | `ls webapp/` → no match |
| `webapp/src/store/useRoomStore.ts` | Zustand store for room metadata, connected members, settings, and connection status | `ls webapp/` → no match |
| `webapp/src/store/useQueueStore.ts` | Zustand store for queue items list and current playing item | `ls webapp/` → no match |
| `webapp/src/store/usePlaybackStore.ts` | Zustand store for synchronized playback position, state, and drift anchors | `ls webapp/` → no match |
| `webapp/src/hooks/useEchoRoom.ts` | React hook subscribing to `presence-room.{code}` and handling events | `ls webapp/` → no match |
| `webapp/src/hooks/useDebounce.ts` | Debounce hook for song search input | `ls webapp/` → no match |
| `webapp/src/types/index.ts` | TypeScript domain types for Room, RoomMember, Song, KaraokeQueueItem, PlaybackSession | `ls webapp/` → no match |
| `webapp/src/utils/normalizer.ts` | Attribute normalizer converting snake_case backend responses to frontend types | `ls webapp/` → no match |
| `webapp/src/utils/formatting.ts` | Duration formatter (`mm:ss`) and room code formatter | `ls webapp/` → no match |
| `webapp/src/components/player/WebVideoPlayer.tsx` | Web YouTube IFrame API integration with sync anchor extrapolation | `ls webapp/` → no match |
| `webapp/src/components/player/WebPlaybackControls.tsx` | Host player controls (Play, Pause, Skip, Next) | `ls webapp/` → no match |
| `webapp/src/components/player/WebGuestProgressBar.tsx` | Guest synchronized real-time progress bar | `ls webapp/` → no match |
| `webapp/src/components/queue/WebQueueList.tsx` | Interactive queue list displaying pending songs and singer names | `ls webapp/` → no match |
| `webapp/src/components/queue/WebQueueItemCard.tsx` | Individual queue card with singer badge and remove/reorder actions | `ls webapp/` → no match |
| `webapp/src/components/search/WebSongSearchModal.tsx` | Search modal with YouTube search results and "Add to Queue" action | `ls webapp/` → no match |
| `webapp/src/components/room/WebQRCodeDisplay.tsx` | QR code display component on host screen for instant mobile join | `ls webapp/` → no match |
| `webapp/src/components/room/WebMemberListModal.tsx` | Active room member presence drawer/modal | `ls webapp/` → no match |
| `webapp/src/components/common/GlassCard.tsx` | Reusable cyber-glass styled card | `ls webapp/` → no match |
| `webapp/src/components/common/NeonButton.tsx` | Reusable glowing neon gradient button | `ls webapp/` → no match |

## 3. Reuse (read-only)

| Path | What it provides | Why it fits |
| --- | --- | --- |
| `backend/routes/api.php` | All API routes for room, queue, playback, search, auth | The web application communicates with the existing backend without any route changes. |
| `backend/routes/channels.php` | Presence channel authorization for `room.{code}` | Real-time presence and state events are already defined and broadcast on this channel. |
| `backend/app/Http/Controllers/Api/V1/*` | Endpoints for room lifecycle, queue management, playback sync | Fully tested and battle-proven backend controllers. |
| `backend/app/Actions/*` | Domain business logic and transaction safety | Encapsulates idempotency, room cleanup, and host transfer logic. |
| `backend/app/Events/*` | Real-time event broadcasting classes (`queue.updated`, `playback.state_changed`, etc.) | Defines identical event contracts consumed by both web and mobile clients. |
| `mobapp/src/types/index.ts` | Complete TypeScript domain interface definitions | Shared data contract between mobile and web. |
| `mobapp/src/theme/colors.ts` | Design tokens (Cyber Violet `#8B5CF6`, Neon Fuchsia `#EC4899`, Dark Surface `#0A0A0F`) | Provides consistent visual branding across mobile and web platforms. |
| `mobapp/src/utils/normalizer.ts` | Eloquent snake_case to frontend camelCase normalizer | Reusable parsing logic for song and queue items. |
| `mobapp/src/services/serverClock.ts` | NTP-style server clock offset estimation | Proven synchronization algorithm for drift-free playback. |
| `mobapp/src/services/echo.ts` | Dynamic Pusher/Reverb configuration fetch and Echo setup | Battle-tested WebSocket initialization pattern. |

## 4. Do NOT Touch

| Path | Reason |
| --- | --- |
| `backend/app/*` | Backend logic and models must remain untouched to avoid regressions in mobile app or database. |
| `backend/routes/*` | Existing API endpoints and channels must preserve their exact contracts. |
| `backend/database/*` | Migrations and database schema must remain intact. |
| `mobapp/*` | Mobile application (React Native / Expo) must stay independent from the web codebase. |
| `mobapp/android/`, `mobapp/ios/` | Mobile native platform code must not be touched. |

## 5. Tests

| Path | Status | Covers |
| --- | --- | --- |
| `webapp/__tests__/services/serverClock.test.ts` | New | Clock offset calculation and NTP round-trip selection |
| `webapp/__tests__/utils/normalizer.test.ts` | New | Song and queue item attribute normalization |
| `webapp/__tests__/store/useAuthStore.test.ts` | New | Session token storage and retrieval |
| `webapp/__tests__/components/WebVideoPlayer.test.tsx` | New | YouTube player sync anchor calculations and state callbacks |
