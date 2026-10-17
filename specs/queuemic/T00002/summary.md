# Ticket Summary — ReactJS Web Application (QueueMic Web)

## Metadata

| Field | Value |
| --- | --- |
| Ticket | T00002 (queuemic) |
| Feature | ReactJS Web Application (QueueMic Web) |
| Branch | `T00002` in the `webapp/` repo (base `origin/main`; commit `bcb5ea3`) |
| Spec | spec.md v1.2 — Done |
| Plan | plan.md rev 3 — Done (18/18 tasks) |
| Summary Run | v3 — 2026-10-17 — code review fix pass v3.1, route guards & responsive redesign |
| Sources | spec v1.2, plan rev 3, task.md, context.md v1, verify v5, code-review v3.1, refactor v1, design-review v1.2 |

---

## 1. Feature Purpose

A modern React 19 + TypeScript SPA in `webapp/` (Vite, Tailwind v4, Zustand, Echo/Reverb, YouTube IFrame API) that lets a host launch and manage QueueMic from any desktop browser with synchronous video playback, playback controls, queue management, and a TV QR join display, while guests join via URL or 6-character code on desktop or scan QR code on mobile devices to search, queue songs, and synchronize follower video playback (spec §1–§2, FR-08, D-01–D-05).

## 2. Status

- Specify: spec v1.2 Done, plan rev 3 Done (spec Metadata; plan Metadata).
- Implement: 18/18 tasks complete (plan §4–§7).
- Verify: v5 — ✅ PASS (3 AC pending manual check); 17/20 AC MET, 0 BLOCKER, 0 REQUIRED FIX (verify.md §1–§2).
- Code review: v3.1 — APPROVED (after fix pass v3.1, 6/6 findings resolved; code-review.md).
- Refactor: v1 — ✅ BEHAVIOR PRESERVED (refactor.md).
- Design review: v1.2 — APPROVED (after fix pass v1.2, 4/4 design findings fixed + 3 Modern Enhancements implemented) (design-review.md).
- **Done** — all closing criteria met: 18/18 plan tasks done, verify ✅ PASS, code review APPROVED, design review APPROVED, no open questions (spec §16; task.md §1).

## 3. Files Changed

| Path | Change | Layer | Why | Match |
| --- | --- | --- | --- | --- |
| 46 files of plan §3 rows 1–46 (scaffold, types, api, services, stores, hooks, components, pages, tests) | A | all | TASK-01–TASK-16 build (plan §3) | planned; in base `origin/main` (built before the branch), not in branch diff |
| `webapp/vitest.config.ts` | — | config | TASK-02 test runner | planned, not changed (Vitest configured in `vite.config.ts`) |
| `webapp/src/pages/CreateRoomPage.tsx` | M | frontend | 2-column responsive web dashboard layout with visual showcase (desktop redesign); offline alert (verify v2 #10) | planned + changed |
| `webapp/src/pages/JoinRoomPage.tsx` | M | frontend | 2-column responsive web dashboard layout with visual showcase (desktop redesign); EC-01 validation (verify v1 #1); responsive mobile-only QR scanner toggle (`block lg:hidden`) | planned + changed |
| `webapp/src/pages/HostPlayerPage.tsx` | M | frontend | official host route guard on `/host/:roomCode` (code-review v3 #5); `<Navigate>` wrapper (verify v1 #7); optimistic rollback (#4); offline banner (#5); toast (v2 #9); shared hooks (refactor v1) | planned + changed |
| `webapp/src/pages/GuestRoomPage.tsx` | M | frontend | non-member direct URL route guard on `/room/:roomCode`; follower video view; shared action hooks (refactor v1) | planned + changed |
| `webapp/src/pages/HomePage.tsx` | M | frontend | scroll hint text contrast update (design-review v1 #4) | planned + changed |
| `webapp/src/components/player/WebVideoPlayer.tsx` | M | frontend | error banner (verify v2 #8); EC-06 copy (#11); follower video sync & learned seek lead (TASK-17, D-04); mute toggle & phone-width accessibility (verify v3 #12) | planned + changed |
| `webapp/src/components/player/WebPlaybackControls.tsx` | M | frontend | accessible contrast (`#94A3B8`, WCAG AA) and animated equalizer bars (design-review v1 #1) | planned + changed |
| `webapp/src/components/player/WebGuestProgressBar.tsx` | M | frontend | theme token consistency and progress track contrast | planned + changed |
| `webapp/src/components/player/WebNextUpCard.tsx` | M | frontend | modernized cyber-glass layout and danger zone design harmonization | planned + changed |
| `webapp/src/components/player/WebSongDetailsModal.tsx` | A | frontend | song details inspection modal (thumbnail, singer, duration, source) from queue item click | changed, not planned |
| `webapp/src/components/queue/WebQueueList.tsx` | M | frontend | drag reorder + delete confirm (verify v1 #3); EC-02 copy (v2 #11); cyan drop target insertion indicator line (design-review v1 #3) | planned + changed |
| `webapp/src/components/queue/WebQueueItemCard.tsx` | M | frontend | modernized card layout, removal of red dot indicator, song details modal integration | planned + changed |
| `webapp/src/components/search/WebSongSearchModal.tsx` | M | frontend | Singer Name input (verify v1 #2); role-aware fallback nickname (code-review v3 #6); close modal + toast (verify v2 #9); Enter submission harden (code-review v1 #1); closed-modal Enter ignore (verify v4 #13) | planned + changed |
| `webapp/src/components/room/WebQRScannerModal.tsx` | A | frontend | live camera QR code scanner with `BarcodeDetector` and `jsQR` fallback; mobile-only display | changed, not planned |
| `webapp/src/components/room/WebSettingsModal.tsx` | M | frontend | token consistency and accessibility polish | planned + changed |
| `webapp/src/components/common/GlassCard.tsx`, `NeonButton.tsx`, `WebNicknameModal.tsx` | M | frontend | `#1C1F30` surface token consistency (design-review v1 #2) | planned + changed |
| `webapp/src/components/common/WebConnectionBanner.tsx`, `src/services/connectionState.ts` | A | frontend | offline indicator banner and connection state bus (verify v1 #5) | changed, not planned |
| `webapp/src/components/common/WebToast.tsx` | A | frontend | Cyber-glass toast notifications for actions (verify v2 #9) | changed, not planned |
| `webapp/src/hooks/useEchoRoom.ts` | M | frontend | Reverb connection-state binding (verify v1 #5); hidden tab heartbeat sync (Improvement #4) | planned + changed |
| `webapp/src/hooks/useRoomPlayPause.ts`, `useRoomQueueActions.ts` | A | frontend | unified room playback and queue state management with optimistic rollbacks (code-review v1 #3, refactor v1) | changed, not planned |
| `webapp/src/services/echo.ts` | M | frontend | dynamic env configuration, connection retry (code-review v1 #2), custom authorizer | planned + changed |
| `webapp/src/api/client.ts` | M | frontend | prioritized `VITE_API_URL` environment configuration (Improvement #3) | planned + changed |
| `webapp/src/theme/colors.ts`, `src/index.css` | M | frontend | ambient aura glows, equalizer waveforms, and consistent dark cyber tokens | planned + changed |
| `webapp/src/utils/optimistic.ts`, `src/utils/validation.ts` | A | frontend | `runOptimistic` rollback handler (verify v1 #4) and room code validation (verify v1 #1) | changed, not planned |
| `webapp/.env.example` | M | config | documents `VITE_API_URL`, `VITE_REVERB_APP_KEY`, Reverb host/port configs | planned + changed |
| `webapp/__tests__/components/WebVideoPlayer.test.tsx` | M | test | follower sync, mute toggle, error skip, EC-07 tab visibility tests | planned + changed |
| `webapp/__tests__/components/fixes.test.tsx` | M | test | regression tests for verify #1–#13, design-review #1–#4, and code-review #5–#6 | changed, not planned |
| `webapp/__tests__/pages/HostPlayerPage.test.tsx`, `__tests__/pages/roomActions.test.tsx` | M | test | host route guard & session authentication assertions | planned + changed |
| `webapp/__tests__/pages/CreateRoomPage.test.tsx`, `__tests__/services/echo.test.ts`, `__tests__/hooks/useEchoRoom.test.ts`, `__tests__/hooks/roomActions.test.ts`, `__tests__/utils/fixes.test.ts` | A | test | suite of unit and integration tests across services, hooks, and pages | changed, not planned |

Branch diff: 40 files, +3203/−784 vs `origin/main` (git diff --stat). `backend/` and `mobapp/` unchanged (verify v5 AC-16).

## 4. Architecture Decisions

- Pure React SPA (Vite, React 19, TS, `react-router-dom`) in `webapp/`; no SSR (spec §15 D-01).
- Official YouTube IFrame API for host playback and guest follower video (spec §15 D-02).
- Responsive 2-column web view for Create and Join screens on desktop (`lg:`), with mobile-optimized streamlined view on phone viewports (user direction 2026-10-17).
- Join by direct 6-char code on desktop web view; camera QR code scanner (`WebQRScannerModal`) restricted to mobile view (`block lg:hidden`) for scanning TV screens (spec §15 D-03; user direction 2026-10-17).
- Direct URL entry route protection on `/room/:roomCode` and `/host/:roomCode` redirecting non-members to home (code-review v3 #5; verify v5 §4).
- Guests follow the host with their own muted player, mirroring mobile `HostVideoPlayer`: drift tolerance 0.4 s, resync cooldown 3 s, learned seek lead ≤ 3 s (spec §15 D-04).
- Session token in `localStorage` via `useAuthStore`, a sanctioned exception to the security baseline for ephemeral, zero-PII room tokens (spec §15 D-05; resolved Q-01).
- Optimistic updates with rollback through one `runOptimistic` helper, shared by both pages via `useRoomQueueActions` / `useRoomPlayPause` (verify v1 #4; code-review v1 #3; refactor v1).
- Role-aware fallback singer name defaulting to `'Singer'` for guests and `'Host'` for host (code-review v3 #6).

## 5. Important Constraints

- Do not change `backend/` or `mobapp/` (spec §14; verify v5 AC-16; SC-04).
- Follower video and progress bar stay within ±0.5 s of the host, including after pause / resume (spec SC-02, FR-08).
- Host reports its position as soon as playback (re)starts, then every 30 s (spec FR-03, AC-20).
- Join needs a nickname and a 6-character code: "Nickname and room code are required" (spec §14 verify v1 #1).
- Direct URL access to `/room/:roomCode` or `/host/:roomCode` requires an active member session or redirects to `/` (spec §14 code-review v3 #5; verify v5 §4).
- Adding a song takes an editable Singer Name, closes the modal and confirms with a toast; Enter submits the name as typed; closing cancels the selection (spec §14 verify v1 #2, v2 #9, code-review v1 #1, verify v4 #13).
- Queue reorder is drag-and-drop with `target_position` and cyan drop insertion line; delete asks to confirm (spec §14 verify v1 #3, design-review v1 #3).
- Optimistic playback / queue changes roll back on failure (spec §14 verify v1 #4).
- An offline indicator shows while the socket is down (spec §14 verify v1 #5).
- Room pages call hooks unconditionally (spec §14 verify v1 #7).
- A video YouTube cannot play shows a banner with "Skip to next song" for whoever controls playback (spec §14 verify v2 #8).
- Offline Create Room shows "Unable to create room. Please check your connection." (spec §14 verify v2 #10).
- EC-02 / EC-06 copy matches the spec (spec §14 verify v2 #11).
- The guest mute toggle and "Audio Muted by Browser" stay reachable at phone width (spec §14 verify v3 #12).
- Subtitle and idle text on dark playback controls must meet WCAG AA contrast (≥ 4.5:1 `#94A3B8`) (design-review v1 #1).
- Build environments must set `VITE_API_URL` or `EXPO_PUBLIC_API_URL`; the default is localhost (code-review v2 INFO; spec §14 Config).

## 6. Open Items

- Manual checks not run: AC-04/AC-05 (broadcasting config and auth with a running backend), AC-06 / EC-06 (host playback in a browser), MT-04 / SC-02 (web ↔ mobile sync with pause / resume), NFR-02 (FCP), NFR-03 (reconnect within 3 s) (verify v5 §6).
- Version not bumped: recommend-only, `webapp` 1.0.0 → 2.0.0 if removing the camera scanner on webview counts as breaking, else 1.1.0; no CHANGELOG yet (task.md §4; fix summaries).
- The ticket documents (`.agents/specs/queuemic/T00002/`) are in the root repo, which has no commits and no remote (task.md §5).

**Optional, not scheduled:** verify: 3 IMPROVEMENT (#5 lint warnings, #6 uncleared autoplay-check timer, #7 AC-11 test); code-review: none.

## 7. Future Improvements

- Clean up the 48 lint warnings (verify v5 Improvement #5).
- Clear the 1.2 s autoplay-check timer on cleanup (verify v5 Improvement #6).
- Unit-test idempotency-key reuse for AC-11 (verify v5 Improvement #7).
- Extract the still-duplicated `handleSeek` / `handleSkip` from both room pages (refactor v1 §7; code-review v2 INFO).
- Guest playback-control / reorder permission UI, settings modal, `X-Platform` header: add to a spec if intended (verify v4 Suggestion #1).
- Webcam scanning on desktop web view if requested by users (verify v5 Suggestion #1).

## 8. Source Index

| Document | Run / Version | Status | Open it for |
| --- | --- | --- | --- |
| [spec.md](./spec.md) | v1.2 | Done | flows, FR / AC / EC rows, API contracts, D-01–D-05, §14 review-finding rules |
| [plan.md](./plan.md) | rev 3 | Done | task list, file map, acceptance walk |
| [task.md](./task.md) | — | Done | stage table, findings checklist, activity log |
| [verify.md](./verify.md) | v5 | ✅ PASS (3 AC pending manual check) | AC evidence (`file:line`), manual-check list, open improvements |
| [code-review.md](./code-review.md) | v3.1 | APPROVED (after fix pass v3.1) | diff review, closed findings (#1–#6) |
| [refactor.md](./refactor.md) | v1 | ✅ BEHAVIOR PRESERVED | what moved into the shared hooks, regression evidence |
| [design-review.md](./design-review.md) | v1.2 | APPROVED (after fix pass v1.2) | WCAG contrast, token consistency, insertion indicator, equalizer waveform & ambient aura |
| [context.md](./context.md) | v1 | — | backend contracts and events the web app reuses |

<!-- Run history -->
- v2 — 2026-10-17 — design review fix pass v1.2 — 29 files, 5 decisions, 3 open items — Done
- v1 — 2026-10-17 — verify fix pass v4.1 — 29 files, 5 decisions, 3 open items — Done
