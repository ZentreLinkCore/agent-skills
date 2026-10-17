# Webkit Verification Report

## Metadata

| Field | Value |
| --- | --- |
| Ticket | T00002 (queuemic) |
| Branch | T00002 in the `webapp/` repo (base `origin/main` `3c593ba`; commits `5700d55`, `503d461` + uncommitted work: 5 modified, 6 new files; 23 tracked files changed). `mobapp/` and `backend/` repos: `main`, no changes |
| Specification File | [spec.md](./spec.md) — version 1.2, status Approved |
| Verification Date | 2026-10-17 |
| Verification Run | v4.1 — fix pass 2026-10-17 by /webkit-fix: Finding #13 fixed; not re-reviewed |

**Implementation Scope**

- **Frontend:** `webapp/src/` — `components/player/WebVideoPlayer.tsx`, `components/common/{WebToast,WebConnectionBanner}.tsx`, `components/queue/WebQueueList.tsx`, `components/search/WebSongSearchModal.tsx`, `pages/{HostPlayerPage,GuestRoomPage,CreateRoomPage,JoinRoomPage}.tsx`, new `hooks/{useRoomQueueActions,useRoomPlayPause}.ts`, `hooks/useEchoRoom.ts`, `services/{echo,connectionState}.ts`, `utils/{validation,optimistic}.ts`, `api/client.ts`; scanner deleted. Follower sync (FR-08) and Host report timing (FR-03) sit in `origin/main` and are graded as part of the code under review.
- **Backend:** None (`git -C backend status` → clean on `main`)
- **Database:** None
- **Other:** `.env.example`, `package.json` / lock (`jsqr` removed), Vitest suite (14 files, 76 tests)

---

## 1. Verification Summary

### Overall Status

✅ PASS (3 AC pending manual check) (after fix pass v4.1)

### Summary

Fix pass v4.1 (2026-10-17): Finding #13 fixed by /webkit-fix and confirmed by its own scenario. The implementation matches spec v1.2 across its FRs, flows and acceptance criteria; Finding #12 holds, and the refactor kept rollback and guest permissions intact (characterization tests pass). One deviation remains before the ticket can close: pressing Enter after closing the Add Song modal with a song selected queues that song without the user confirming it (Finding #13).

---

## 2. Specification Compliance

| Specification Area | Status | Notes |
| --- | --- | --- |
| Scope | PASS | Included items exist incl. the follower video view (`GuestRoomPage.tsx:71,412,514`); scanner gone (`grep jsqr\|QRScanner\|getUserMedia` → none). |
| User Flow | PASS (fixed: Finding #13) | Flow 2 step 4: a song is queued without the user's confirm after the modal was closed (Finding #13). Flow 1 failure paths (`WebVideoPlayer.tsx:501,735-754`; `CreateRoomPage.tsx:131-138`) and Flow 3 incl. the phone-width mute toggle (`WebVideoPlayer.tsx:676,893-903`) met. |
| Functional Requirements | PASS | FR-01..FR-08 met; FR-06 queue edits and guest permission now in `hooks/useRoomQueueActions.ts:15-56` (called at `HostPlayerPage.tsx:55`, `GuestRoomPage.tsx:120`); FR-03 report timing `HostPlayerPage.tsx:98-110`. |
| Non-functional Requirements | PASS | NFR-01 (`client.ts:28-32`), NFR-03 retry with backoff after a failed config fetch (`echo.ts:58-75,229`; `echo.test.ts`), NFR-04 (tsc strict clean), NFR-05 (`queueApi.ts:5-17,51-55`); NFR-02 manual (§6). |
| Technical Design | PASS | §8 components present; Host Play/Pause optimistic with rollback in `hooks/useRoomPlayPause.ts:15-49`; Add Song closes + toast; D-04 constants `WebVideoPlayer.tsx:8-11`. |
| Acceptance Criteria | PASS | 17/20 met. Not met: none. Manual: AC-04, AC-05, AC-06 (§6). |
| Edge Cases | PASS | EC-01..EC-07 met (EC-05 submit guard `WebSongSearchModal.tsx:127`, `NeonButton.tsx:45`; EC-07 `WebVideoPlayer.tsx:534-545`). |
| Security Requirements | PASS | Bearer + `X-Session-Token`; guest delete-own gated (`WebQueueList.tsx:117-118`); token storage per D-05. |

AC results: AC-01 MET · AC-02 MET · AC-03 MET · AC-04 UNVERIFIED (`echo.ts:77-106,121`) · AC-05 UNVERIFIED (`echo.ts` authorizer ↔ `BroadcastAuthController.php:18-21`) · AC-06 UNVERIFIED · AC-07 MET · AC-08 MET · AC-09 MET · AC-10 MET (edited Singer Name sent by click and by Enter: `WebSongSearchModal.tsx:60,66,153`; `fixes.test.tsx`) · AC-11 MET (no test, Improvement #7) · AC-12 MET · AC-13 MET (`useRoomQueueActions.ts`; `roomActions.test.tsx`) · AC-14 MET (`useEchoRoom.ts:245-251`; `useEchoRoom.test.ts`) · AC-15 MET · AC-16 MET (`git -C mobapp status`, `git -C backend status` → 0) · AC-17 MET · AC-18 MET · AC-19 MET (phone-width toggle, Finding #12) · AC-20 MET.

Re-tested fix-pass v3.1 claim: #12 ✔ `WebVideoPlayer.tsx:676,893-903`; test "guest mute toggle on a phone-width screen" passes.

---

## 3. Findings

### BLOCKER

None.

### REQUIRED FIX

#### Finding #13

- **Category:** REQUIRED FIX
- **Location:** `webapp/src/components/search/WebSongSearchModal.tsx:62-71` (keydown effect guarded only by `!selectedSong || submitting` at `:64`, registered above `if (!visible) return null;` at `:101`); `:180` (✕ calls `onClose` only); `:51-57` (selection cleared only when the modal opens)
- **Specification Reference:** §5 Flow 2 step 4 (the song is queued when the guest "confirms"); FR-05
- **Problem:** Select a song in the Add Song modal → close it with ✕ → press Enter anywhere on the room page → `queueApi.addToQueue('ABC123', { songId, singerName })` is sent and the song is queued.
- **Expected:** Closing the modal cancels the selection; nothing is queued without the confirm step.
- **Actual:** Reproduced this run with a throwaway Vitest probe (`addToQueue` called once after `visible={false}`). The `[visible]` effect is commented "Clear selection on modal open/close" but only clears it when `visible` turns true (`:51-57`). The modal stays mounted while hidden in both pages (`HostPlayerPage.tsx`, `GuestRoomPage.tsx` render it with `visible`), so the window listener stays live.
- **Required Action:** In `WebSongSearchModal.tsx`, guard the keydown effect with `visible` (`if (!visible || !selectedSong || submitting) return;`, add `visible` to its deps), and clear `selectedSong` when the modal closes (extend the `[visible]` effect at `:51-57` to reset the selection on close too). Regression test in `__tests__/components/fixes.test.tsx`: select a song, rerender with `visible={false}`, fire Enter on `window`, assert `addToQueue` was not called.
- **Resolution:** ✅ FIXED — 2026-10-17, /webkit-fix: closing the modal clears the selection (`WebSongSearchModal.tsx:51-57`) and the Enter / Escape listener runs only while `visible` (`:65,72`). Test: `__tests__/components/fixes.test.tsx` "after closing with a song selected" (failed before, passes now).

### IMPROVEMENT

#### Improvement #5

- **Area:** lint warnings
- **Current Situation:** `npx oxlint` → 0 errors, 46 warnings, mostly `exhaustive-deps` and unused catch params; the ref-in-render warnings are the intentional latest-handler pattern.
- **Suggestion:** Clean up in a later pass.
- **Reason:** Maintainability.
- **Resolution:** Open

#### Improvement #6

- **Area:** `webapp/src/components/player/WebVideoPlayer.tsx:479-493` (autoplay check), cleanup `:506-514`
- **Current Situation:** The 1.2 s autoplay-blocked check is a bare `setTimeout` the effect cleanup never clears.
- **Suggestion:** Keep the timeout id in the effect scope and `clearTimeout` it in the cleanup beside `pollTimer`.
- **Reason:** Spurious mute / tap prompt on quick skips.
- **Resolution:** Open

#### Improvement #7

- **Area:** `webapp/src/api/queueApi.ts:5-17,51-55`
- **Current Situation:** AC-11 (retry reuses the `Idempotency-Key`) has no automated test.
- **Suggestion:** Unit-test `addToQueue`: a rejection without `status` → the retry sends the same key; a 4xx → a new key.
- **Reason:** NFR-05 / AC-11 regressions would go unnoticed.
- **Resolution:** Open

### OUT OF SCOPE

#### Suggestion #1

- **Suggestion:** Guest playback-control / reorder permission UI, settings modal, `X-Platform` header.
- **Reason Not Included:** Beyond spec §4 (mobile parity); the backend enforces permissions.
- **Future Consideration:** Add to the spec if intended.

---

## 4. Security Review

| Check | Status |
| --- | --- |
| Authentication | PASS |
| Authorization | PASS |
| Input Validation | PASS |
| Data Exposure | PASS |
| API Security | PASS |

**Issues:** No security issues found. Session-token storage in `localStorage` is the sanctioned decision D-05 (spec §15).

---

## 5. Performance Review

| Check | Status |
| --- | --- |
| Database Queries | N/A — no backend change |
| API Performance | PASS |
| Frontend Performance | PASS |
| Resource Usage | PASS |

**Issues:** No performance concerns found. Config retry backs off to 30 s and stops once the config arrives (`echo.ts:63-75`); Host reports once after (re)start, then every 30 s; follower seeks at most once per 3 s.

---

## 6. Testing Review

### Existing Tests

- **Status:** passing — `npx vitest run` → 14 files, 76 tests passed; `npx tsc --noEmit -p tsconfig.app.json` clean; `npx oxlint` → 0 errors, 46 warnings. `node .agents/scripts/check-changed.mjs` not applicable (checks `resources/` paths only).
- **Implemented:** YES
- **Coverage:** AC-01/02, AC-08, AC-09/10 (incl. Enter), AC-12/13 (incl. rollback on both pages), AC-14, AC-17–AC-20, EC-01, EC-02, EC-04, EC-06, EC-07, Flow 1 failure paths, Flow 2 step 4 success path, NFR-03 retry, guest permission guards. None for AC-04/05/06 (runtime), AC-11 (Improvement #7), AC-15, or the closed-modal Enter case (Finding #13).

### Manual Verification

| Scenario | Expected | Result | Status |
| --- | --- | --- | --- |
| AC-16 / SC-04: `git -C mobapp status --short`, `git -C backend status --short` | No changes | 0 changed files in each, both on `main` | PASS |
| AC-04/AC-05: open `/room/{code}` with backend + Reverb running | Config fetched; `POST /broadcasting/auth` 200 with signature | Not run | Not run — needs running backend |
| AC-06 / MT-01 / EC-06: create room, add song, open `/host/{code}` | YouTube plays, status `playing`; blocked autoplay shows "Click to Start Playback" | Not run | Not run — needs browser |
| MT-04 / SC-02: web Host + mobile Guest, then mobile Host + web Guest; play, pause 20 s, resume, skip | Follower within ±0.5 s after every step | Not run | Not run — needs two devices |
| NFR-02 / NFR-03: first load; drop the network for a few seconds | FCP < 1.5 s; offline banner, reconnect within 3 s | Not run | Not run — needs browser |

---

## 7. Specification Impact Decision

### NO SPEC CHANGE REQUIRED

**Reason:** Finding #13 is an implementation gap against Flow 2 step 4; no requirement is wrong or contradictory.

---

## 8. Final Recommendation

### READY FOR MERGE (after fix pass v4.1)

**Conditions:**

- No blockers
- No required fixes

<!-- Run history -->
- v1 — 2026-10-17 — initial: ⚠ PASS WITH FIXES (0 BLOCKER, 7 REQUIRED FIX, 5 IMPROVEMENT)
- v1.1 — 2026-10-17 — fix pass: #1–#7 fixed — ✅ PASS (4 AC pending manual check) (after fix pass v1.2)
- v1.2 — 2026-10-17 — fix pass: Improvements #1–#4 applied (user-named); #5 (lint warnings) left open — ✅ PASS (4 AC pending manual check) (after fix pass v1.2)
- v2 — 2026-10-17 — re-verify: ⚠ PASS WITH FIXES (0 BLOCKER, 4 REQUIRED FIX #8–#11, 3 IMPROVEMENT; Case 2 spec update not applied)
- v2.1 — 2026-10-17 — fix pass: #8–#11 fixed — ✅ PASS (4 AC pending manual check) (after fix pass v2.1)
- v3 — 2026-10-17 — re-verify against spec v1.2: ⚠ PASS WITH FIXES (0 BLOCKER, 1 REQUIRED FIX #12, 3 IMPROVEMENT)
- v3.1 — 2026-10-17 — fix pass: #12 fixed — ✅ PASS (3 AC pending manual check) (after fix pass v3.1)
- v4 — 2026-10-17 — full re-verify against spec v1.2 Approved: ⚠ PASS WITH FIXES (0 BLOCKER, 1 REQUIRED FIX #13, 3 IMPROVEMENT)
