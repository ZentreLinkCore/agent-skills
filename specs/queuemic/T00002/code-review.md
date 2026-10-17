# Webkit Code Review Report

## Metadata

| Field | Value |
| --- | --- |
| Ticket | T00002 (queuemic) |
| Branch | T00002 in the `webapp/` repo (base `origin/main` `3c593ba`; commits `5700d55`, `503d461` + uncommitted work; 23 tracked files changed, +908/-447 lines, plus 6 new untracked files) |
| Reviewer Role | Senior Developer Review |
| Review Date | 2026-10-17 |
| Review Run | v2 — re-review after fix pass v1.1 (#1, #2, #4) and `/webkit-refactor` v1 (#3); focus on the uncommitted hunks since v1 |

---

## Summary

### Overall Code Quality

APPROVED

### Summary

The change is mergeable: v1's four findings are resolved and their tests pass. The new shared hooks, the config retry and the Enter-shortcut ref are correct. One pre-existing defect next to this diff is worth its own fix: Enter still queues a song after the modal was closed with ✕ (INFO below).

---

## Changed Areas

- **Frontend:** since v1 — `components/search/WebSongSearchModal.tsx` (Enter shortcut calls the latest confirm handler via `confirmAddRef`), `pages/{HostPlayerPage,GuestRoomPage}.tsx` (queue and play/pause handlers replaced by hook calls), new `hooks/useRoomQueueActions.ts` and `hooks/useRoomPlayPause.ts`. Unchanged since v1: the rest of the branch as listed in v1 (room pages' rollback, offline banner, toast, player overlays, join validation, scanner removal).
- **Backend:** None
- **Database:** None
- **Other:** `services/echo.ts` (config retry with backoff after a failed init); new tests `__tests__/services/echo.test.ts`, `__tests__/hooks/{useEchoRoom,roomActions}.test.ts`, `__tests__/pages/roomActions.test.tsx`, plus the Enter-shortcut case in `__tests__/components/fixes.test.tsx`

---

## Findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

None.

### LOW

None.

### INFO

- **Observation:** Pre-existing: with a song selected, closing the Add Song modal with ✕ leaves `selectedSong` set, and the window `keydown` listener is registered regardless of `visible` (`webapp/src/components/search/WebSongSearchModal.tsx:62-71`, `:180` ✕ calls `onClose` only), so pressing Enter anywhere on the room page queues that song. Reproduced with a throwaway Vitest probe (`addToQueue` called once after `visible={false}`); the same effect and ✕ handler are in `origin/main`. Suggested route: `/webkit-investigate T00002 "Enter queues a song after the search modal is closed"`, then `/webkit-fix` (e.g. skip the listener while `!visible`, or clear the selection on close).
- **Observation:** v1 findings re-tested: #1 (`fixes.test.tsx` "Enter shortcut"), #2 (`echo.test.ts`), #4 (`useEchoRoom.test.ts`) pass; #3 resolved by `/webkit-refactor` v1 ([refactor.md](./refactor.md)), proven by `__tests__/pages/roomActions.test.tsx` passing before and after.
- **Observation:** Pre-existing: `handleSeek` and `handleSkip` are still near-identical in both room pages; both copies are in `origin/main` (recorded in refactor.md §7).
- **Observation:** Pre-existing: the 1.2 s autoplay-blocked check in `WebVideoPlayer.tsx` is never cleared on cleanup (verify Improvement #6).
- **Observation:** `api/client.ts:6` defaults to `http://localhost:8000/api/v1` (spec §14); build environments must set `VITE_API_URL` or `EXPO_PUBLIC_API_URL`.
- **Observation:** Not reviewed: the follower-sync and Host report-timing code already in `origin/main` (outside this diff; verify v3 covered its behavior). The fix-pass and refactor work is still uncommitted (5 modified, 6 new files).

---

## Positive Feedback

- The refactor kept the only real difference between the two copies, the guest permission guards, as explicit hook options (`canReorder`, `canControl`) defaulting to the host's behavior, and pinned it with hook tests.
- The characterization suite (`roomActions.test.tsx`) was written and passing before any code moved, and runs the same cases on both pages via `describe.each`.
- `scheduleConfigRetry` is idempotent (one timer at a time), capped at 30 s, and stops as soon as `serverConfig` exists, so a later `getEcho()` failure for another reason cannot loop.
- `confirmAddRef` follows the same latest-handler pattern already used by `WebVideoPlayer` and `WebToast`, rather than widening the effect's dependencies and re-binding the window listener on every keystroke.

---

## Final Recommendation

### READY TO MERGE

**Conditions:** No CRITICAL or HIGH findings.

<!-- Run history -->
- v1 — 2026-10-17 — initial: CHANGES REQUIRED (1 HIGH, 3 MEDIUM, 4 INFO)
- v1.1 — 2026-10-17 — fix pass: #1, #2, #4 fixed (#3 then resolved by /webkit-refactor v1) — APPROVED WITH COMMENTS (after fix pass v1.1)
