# Webkit Refactor Record

## Metadata

| Field | Value |
| --- | --- |
| Ticket | T00002 (queuemic) |
| Branch | T00002 (`webapp/` repo) |
| Refactor Goal | Move the queue edits and optimistic play/pause duplicated in the Host and Guest room pages into shared hooks |
| Source | code-review Finding #3 (`code-review.md` v1) |
| Refactor Date | 2026-10-17 |
| Refactor Run | v1 — initial |

---

## 1. Summary

### Refactor Status

✅ BEHAVIOR PRESERVED

### Summary

`restoreQueue`, move, reorder, remove and the optimistic play/pause with rollback now live once, in `useRoomQueueActions` and `useRoomPlayPause`; both room pages call them, and the guest's permission guards became hook options. The pages lose 136 lines, and a later change to rollback or reorder is made in one place ([system-awareness.md §4](../../../rules/conditional/system-awareness.md)).

---

## 2. Scope

- **In scope:** `webapp/src/pages/HostPlayerPage.tsx`, `webapp/src/pages/GuestRoomPage.tsx` (the five handlers named in Finding #3), new `webapp/src/hooks/useRoomQueueActions.ts` and `webapp/src/hooks/useRoomPlayPause.ts`
- **Out of scope:** `handleSeek` and `handleSkip`, also near-identical in both pages but not named by the finding (§7)

---

## 3. What Moved Where

| Before | After | Why |
| --- | --- | --- |
| `HostPlayerPage.tsx:181-216`, `GuestRoomPage.tsx:178-215` `restoreQueue`, `handleMoveItem`, `handleReorderItem`, `handleRemoveItem` | `webapp/src/hooks/useRoomQueueActions.ts` (`useRoomQueueActions(roomCode, { canReorder })`) | One source of truth for shared logic ([system-awareness.md §4](../../../rules/conditional/system-awareness.md)); hooks live in `src/hooks/` beside `useEchoRoom` / `useDebounce` |
| `HostPlayerPage.tsx:121-147`, `GuestRoomPage.tsx:127-150` `handlePlayPause` | `webapp/src/hooks/useRoomPlayPause.ts` (`useRoomPlayPause(roomCode, { canControl })`) | Same rule |
| Guest-only guards `if (!canReorder) return;` / `if (!canControlPlayback) return;` | Hook options, defaulting to allowed (the host's behavior) | Keeps the one behavioral difference between the copies |

---

## 4. Duplication Removed

| Removed Copy | Replaced By | Coverage Check |
| --- | --- | --- |
| `HostPlayerPage.tsx` queue handlers + `restoreQueue` | `useRoomQueueActions(roomCode)` (`HostPlayerPage.tsx:55`) | `__tests__/pages/roomActions.test.tsx` host cases (move, failed move, failed remove), written and passing before the move |
| `GuestRoomPage.tsx` queue handlers + `restoreQueue` | `useRoomQueueActions(roomCode, { canReorder })` (`GuestRoomPage.tsx:120`) | Same file, guest cases; `__tests__/hooks/roomActions.test.ts` for the `canReorder: false` guard |
| `HostPlayerPage.tsx` `handlePlayPause` | `useRoomPlayPause(roomCode)` (`HostPlayerPage.tsx:121`) | `roomActions.test.tsx` pause + rollback, host |
| `GuestRoomPage.tsx` `handlePlayPause` | `useRoomPlayPause(roomCode, { canControl: canControlPlayback })` (`GuestRoomPage.tsx:128`) | `roomActions.test.tsx` pause + rollback, guest; `roomActions.test.ts` for the `canControl: false` guard |

---

## 5. Regression Evidence

| Check | Command | Before | After |
| --- | --- | --- | --- |
| Frontend tests | `npx vitest run` (in `webapp/`) | PASS — 13 files, 73 tests (incl. 11 new characterization tests) | PASS — 14 files, 76 tests (+3 hook guard tests) |
| Characterization | `npx vitest run __tests__/pages/roomActions.test.tsx` | PASS — 11 | PASS — 11 |
| Frontend typecheck | `npx tsc --noEmit -p tsconfig.app.json` | PASS | PASS |
| Lint | `npx oxlint` | PASS — 0 errors, 46 warnings | PASS — 0 errors, 46 warnings |
| Changed-files build | `node .agents/scripts/check-changed.mjs` | Not run — checks `resources/` paths only, not `webapp/` | Not run — same reason |

- **API payloads:** Identical — `queueApi.moveQueueItem` / `removeFromQueue` / `getQueue` and `playbackApi.updatePlaybackState` are called with the same arguments, asserted by the characterization tests on both pages.
- **Behavior change:** None.
- **Unverified areas:** None.

---

## 6. Files Changed

- **Modified:** `webapp/src/pages/HostPlayerPage.tsx`, `webapp/src/pages/GuestRoomPage.tsx`
- **Added:** `webapp/src/hooks/useRoomQueueActions.ts`, `webapp/src/hooks/useRoomPlayPause.ts`, `webapp/__tests__/pages/roomActions.test.tsx`, `webapp/__tests__/hooks/roomActions.test.ts`
- **Deleted:** None

---

## 7. Deliberately Not Done

- `handleSeek` and `handleSkip` are near-identical in both pages (`HostPlayerPage.tsx`, `GuestRoomPage.tsx`) — out of scope: Finding #3 names only the queue and play/pause handlers.

<!-- Run history -->
