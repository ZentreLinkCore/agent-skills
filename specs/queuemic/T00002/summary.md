# Ticket Summary — ReactJS Web Application (QueueMic Web)

## Metadata

| Field | Value |
| --- | --- |
| Ticket | T00002 (queuemic) |
| Feature | ReactJS Web Application (QueueMic Web) |
| Branch | `T00002` in the `webapp/` repo (base `origin/main`; pushed at `f95e46e`) |
| Spec | spec.md v1.2 — Done |
| Plan | plan.md rev 3 — Done (18/18 tasks) |
| Summary Run | v1 — 2026-10-17 — initial |
| Sources | spec v1.2, plan rev 3, task.md, context.md v1, verify v4.1, code-review v2, refactor v1 |

---

## 1. Feature Purpose

A Vite + React 19 + TypeScript SPA in `webapp/` that lets a host run QueueMic from any browser (YouTube IFrame player, QR join, playback control) and lets guests join by URL or code to search, queue songs and follow playback, reusing the Laravel API and Reverb events unchanged (spec §1–§2). Since v1.2, guests follow the host with their own muted, synced video by default, as on mobile (spec §4, FR-08).

## 2. Status

- Specify: spec v1.2 Done, plan rev 3 Done (spec Metadata; plan Metadata). task.md §1 Specify row still reads "Approved"; the spec (Done) wins.
- Implement: 18/18 tasks (plan §4–§7).
- Verify: v4 — ✅ PASS (3 AC pending manual check) (after fix pass v4.1); 17/20 AC MET (verify.md §1–§2).
- Code review: v2 — APPROVED, no open findings (code-review.md).
- Refactor: v1 — ✅ BEHAVIOR PRESERVED (refactor.md).
- Design review: not run (task.md §1).
- **Done** — closed by `/webkit-fix --verify` fix pass v4.1 (spec §16; task.md §5).

## 3. Files Changed

| Path | Change | Layer | Why | Match |
| --- | --- | --- | --- | --- |
| 46 files of plan §3 rows 1–46 (scaffold, types, api, services, stores, hooks, components, pages, tests) | A | all | TASK-01–TASK-16 build (plan §3) | planned; in base `origin/main` (built before the branch), not in the branch diff |
| `webapp/vitest.config.ts` | — | config | TASK-02 test runner | planned, not changed (Vitest config is the `test` block of `vite.config.ts`) |
| `webapp/__tests__/pages/HostPlayerPage.test.tsx` | A | test | AC-20 report timing (TASK-18) | planned; in base `origin/main` |
| `webapp/src/components/player/WebVideoPlayer.tsx` | M | frontend | error banner (verify v2 #8), EC-06 copy (#11), mute choice, phone-width mute toggle (verify v3 #12); follower sync in base (TASK-17) | planned + changed |
| `webapp/src/components/search/WebSongSearchModal.tsx` | M | frontend | Singer Name (verify v1 #2), close + toast callback (v2 #9), Enter submits edited name (code-review v1 #1), closed-modal Enter ignored (verify v4 #13) | planned + changed |
| `webapp/src/components/queue/WebQueueList.tsx` | M | frontend | drag reorder + delete confirm (verify v1 #3), EC-02 copy (v2 #11) | planned + changed |
| `webapp/src/pages/HostPlayerPage.tsx` | M | frontend | `<Navigate>` wrapper (verify v1 #7), rollback (#4), offline banner (#5), toast (v2 #9), shared hooks (refactor v1) | planned + changed |
| `webapp/src/pages/GuestRoomPage.tsx` | M | frontend | same as host page, plus guest permission options (refactor v1) | planned + changed |
| `webapp/src/pages/JoinRoomPage.tsx` | M | frontend | EC-01 validation (verify v1 #1), scanner removed (#6) | planned + changed |
| `webapp/src/pages/CreateRoomPage.tsx` | M | frontend | offline message (verify v2 #10) | planned + changed |
| `webapp/src/hooks/useEchoRoom.ts` | M | frontend | connection-state binding (verify v1 #5), heartbeat in hidden tabs (Improvement #4) | planned + changed |
| `webapp/src/services/echo.ts` | M | frontend | no hard-coded key, visible init failure (Improvements #1–#2), config retry (code-review v1 #2) | planned + changed |
| `webapp/src/api/client.ts` | M | frontend | `VITE_API_URL` first, localhost default (Improvement #3) | planned + changed |
| `webapp/package.json`, `package-lock.json` | M | config | `jsqr` removed (verify v1 #6) | planned + changed (`package.json`); lock not planned |
| `webapp/src/hooks/useRoomQueueActions.ts`, `useRoomPlayPause.ts` | A | frontend | shared room actions (code-review v1 #3, refactor v1) | changed, not planned |
| `webapp/src/components/common/WebConnectionBanner.tsx`, `src/services/connectionState.ts` | A | frontend | offline indicator (verify v1 #5) | changed, not planned |
| `webapp/src/components/common/WebToast.tsx` | A | frontend | Add Song confirmation (verify v2 #9) | changed, not planned |
| `webapp/src/utils/optimistic.ts`, `src/utils/validation.ts` | A | frontend | rollback helper (verify v1 #4), join validation (#1) | changed, not planned |
| `webapp/src/components/room/WebQRScannerModal.tsx` | D | frontend | §4 Not Included (verify v1 #6) | changed, not planned |
| `webapp/.env.example` | M | config | documents `VITE_API_URL`, `VITE_REVERB_APP_KEY` (Improvement #3) | changed, not planned |
| `webapp/__tests__/components/WebVideoPlayer.test.tsx` | M | test | TASK-17 sync / mute / error / EC-07 / phone-width tests | planned + changed |
| `webapp/__tests__/components/fixes.test.tsx`, `__tests__/utils/fixes.test.ts`, `__tests__/pages/CreateRoomPage.test.tsx` | A | test | regression tests for verify #1–#5, #9–#11, #13, code-review #1 | changed, not planned |
| `webapp/__tests__/services/echo.test.ts`, `__tests__/hooks/useEchoRoom.test.ts` | A | test | code-review v1 #2, #4 | changed, not planned |
| `webapp/__tests__/pages/roomActions.test.tsx`, `__tests__/hooks/roomActions.test.ts` | A | test | refactor characterization + guard tests (refactor v1) | changed, not planned |

Branch diff: 29 files, +1391/−451 vs `origin/main` (git diff --stat). `backend/` and `mobapp/` unchanged (verify v4 AC-16).

## 4. Architecture Decisions

- Pure React SPA (Vite, React 19, TS, `react-router-dom`) in `webapp/`; no SSR (spec §15 D-01).
- Official YouTube IFrame API for playback (spec §15 D-02).
- Join by URL / code from the host's QR; no camera scanner on web (spec §15 D-03; scanner removed, verify v1 #6).
- Guests follow the host with their own player, mirroring mobile `HostVideoPlayer`: drift tolerance 0.4 s, resync cooldown 3 s, learned seek lead ≤ 3 s (spec §15 D-04; added by spec v1.2 after verify v2 Case 2).
- Session token in `localStorage` via `useAuthStore`, a sanctioned exception to the security baseline for ephemeral, zero-PII room tokens (spec §15 D-05; resolved Q-01).
- Optimistic updates with rollback through one `runOptimistic` helper, shared by both pages via `useRoomQueueActions` / `useRoomPlayPause` (verify v1 #4; code-review v1 #3; refactor v1).
- YT.Player and window-listener callbacks read the latest render's handler through refs (latest-handler pattern) (code-review v2 Positive Feedback).

## 5. Important Constraints

- Do not change `backend/` or `mobapp/` (spec §14; SC-04).
- Follower video and progress bar stay within ±0.5 s of the host, including after pause / resume (spec SC-02, FR-08).
- Host reports its position as soon as playback (re)starts, then every 30 s (spec FR-03, AC-20).
- Join needs a nickname and a 6-character code: "Nickname and room code are required" (spec §14 verify v1 #1).
- Adding a song takes an editable Singer Name, closes the modal and confirms with a toast; Enter submits the name as typed; closing cancels the selection (spec §14 verify v1 #2, v2 #9, code-review v1 #1, verify v4 #13).
- Queue reorder is drag-and-drop with `target_position`; delete asks to confirm (spec §14 verify v1 #3).
- Optimistic playback / queue changes roll back on failure (spec §14 verify v1 #4).
- An offline indicator shows while the socket is down (spec §14 verify v1 #5).
- Room pages call hooks unconditionally (spec §14 verify v1 #7).
- A video YouTube cannot play shows a banner with "Skip to next song" for whoever controls playback (spec §14 verify v2 #8).
- Offline Create Room shows "Unable to create room. Please check your connection." (spec §14 verify v2 #10).
- EC-02 / EC-06 copy matches the spec (spec §14 verify v2 #11).
- The guest mute toggle and "Audio Muted by Browser" stay reachable at phone width (spec §14 verify v3 #12).
- Build environments must set `VITE_API_URL` or `EXPO_PUBLIC_API_URL`; the default is localhost (code-review v2 INFO; spec §14 Config).

## 6. Open Items

- Manual checks not run: AC-04/AC-05 (broadcasting config and auth with a running backend), AC-06 / EC-06 (host playback in a browser), MT-04 / SC-02 (web ↔ mobile sync with pause / resume), NFR-02 (FCP), NFR-03 (reconnect within 3 s) (verify v4 §6).
- Version not bumped: recommend-only, `webapp` 1.0.0 → 2.0.0 if removing the camera scanner (in `main`) counts as breaking, else 1.1.0; no CHANGELOG yet (task.md §4; fix summaries).
- The ticket documents (`.agents/specs/queuemic/T00002/`) are in the root repo, which has no commits and no remote (task.md §5).

**Optional, not scheduled:** verify: 3 IMPROVEMENT (#5 lint warnings, #6 uncleared autoplay-check timer, #7 AC-11 test); code-review: none.

## 7. Future Improvements

- Clean up the 46 lint warnings (verify v4 Improvement #5).
- Clear the 1.2 s autoplay-check timer on cleanup (verify v4 Improvement #6).
- Unit-test idempotency-key reuse for AC-11 (verify v4 Improvement #7).
- Extract the still-duplicated `handleSeek` / `handleSkip` from both room pages (refactor v1 §7; code-review v2 INFO).
- Guest playback-control / reorder permission UI, settings modal, `X-Platform` header: add to a spec if intended (verify v4 Suggestion #1).
- Native camera barcode scanner on web: excluded by scope (spec §4 Not Included; D-03).

## 8. Source Index

| Document | Run / Version | Status | Open it for |
| --- | --- | --- | --- |
| [spec.md](./spec.md) | v1.2 | Done | flows, FR / AC / EC rows, API contracts, D-01–D-05, §14 review-finding rules |
| [plan.md](./plan.md) | rev 3 | Done | task list, file map, acceptance walk |
| [task.md](./task.md) | — | Done | stage table, findings checklist, activity log |
| [verify.md](./verify.md) | v4.1 | ✅ PASS (3 AC pending manual check) | AC evidence (`file:line`), manual-check list, open improvements |
| [code-review.md](./code-review.md) | v2 | APPROVED | diff review, INFO notes |
| [refactor.md](./refactor.md) | v1 | ✅ BEHAVIOR PRESERVED | what moved into the shared hooks, regression evidence |
| [context.md](./context.md) | v1 | — | backend contracts and events the web app reuses |

<!-- Run history -->
