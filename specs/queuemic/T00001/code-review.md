# Code Review: T00001 — QueueMic room & queue system (branch diff)

> **Ticket:** `T00001` (queuemic) — this file is `.agents/specs/queuemic/T00001/code-review.md`.
> **Scope:** `origin/main...origin/T00001` in both repos — **55 files**: `backend` 35 (+598/−177, 3 commits, `2b8e7fc`) and `mobapp` 20 (+563/−199, 3 commits, `3f52e10`). Local branches are level with `origin`, with no uncommitted work.
> **Branch:** `T00001`
> **Run:** v1 — 2026-10-07 — initial.
> **Reviewed:** 2026-10-07
> **Verdict:** REQUEST CHANGES

---

## 1. Summary

The diff is careful, well-commented work. Authorization, idempotency, the error envelope and the presence/expiry logic hold up under tracing and execution. It is not mergeable as-is, because of three problems in the newly API-only YouTube search path:

- **API key in logs (F1).** A network failure writes the YouTube API key into `laravel.log`. Proven by execution; it has not happened yet.
- **Silent API failures (F2).** Any Data API error (quota, bad key, API disabled) is swallowed without a log line.
- **Quota burn (F3).** Search-as-you-type spends about 101 quota units per request, which drains the default daily quota within a party.

Together, F2 and F3 mean search will go dead mid-party with no trace of why.

| Severity | Count | Must fix before |
| :--- | :---: | :--- |
| CRITICAL | 0 | anything ships |
| HIGH | 3 | merge |
| MEDIUM | 2 | end of milestone |
| LOW | 3 | — |

## 2. Findings

### F1 — Network errors write the YouTube API key into the log · `HIGH` · `security`

- **Location:**
  - [`YouTubeKaraokeProvider.php:102`](../../../../backend/app/Services/KaraokeProvider/YouTubeKaraokeProvider.php#L102) (new)
  - [`:169`](../../../../backend/app/Services/KaraokeProvider/YouTubeKaraokeProvider.php#L169) (new)
  - [`:65`](../../../../backend/app/Services/KaraokeProvider/YouTubeKaraokeProvider.php#L65) (pattern pre-existed on `main:81`; this diff edited the line)
- **Problem:** All three log `$e->getMessage()`. On a timeout or DNS failure, Laravel's `ConnectionException` message is Guzzle's, which ends with `for <full request URL>`. That URL carries `key=<YOUTUBE_API_KEY>` as a query parameter.
- **Failure scenario:** Venue Wi-Fi drops for 8 s during a search, so `searchViaApiKey` times out. `storage/logs/laravel.log` gets `YouTube Data API search failed: cURL error 28: … for https://www.googleapis.com/youtube/v3/search?…&key=AIza…`. Anyone with log access — or any log shipper or error tracker added later — now holds the key and can drain its quota.
- **Proof:** A request to a non-routable host with a fake key produced `Illuminate\Http\Client\ConnectionException: cURL error 28: Connection timed out after 1001 milliseconds … for http://10.255.255.1/youtube/v3/search?part=snippet&q=x&key=FAKE-KEY-123`, which contains the key. A count of the current `laravel.log`: **0** lines with a Google-style `key=`, so it has not leaked yet and no rotation is needed today.
- **Rule:** [security.md](../../../rules/security.md) §1 — "Do not save sensitive credentials, tokens … in clear text"; skill §2 — "Secrets, tokens, or PII in logs". Escalated from MEDIUM because the leak is silent.
- **Suggested fix:**
  1. Add one private helper to `YouTubeKaraokeProvider`, e.g. `protected function logFailure(string $what, \Throwable $e): void`, that logs `preg_replace('/([?&]key=)[^&\s]+/', '$1***', $e->getMessage())`.
  2. Call it from all three `catch` blocks.
  3. Optional extra safety: send the key in the `X-Goog-Api-Key` header (`Http::withHeaders(['X-Goog-Api-Key' => $this->apiKey])`) instead of the query string, so it never appears in any URL.
- **Effort:** `small`
- **Regression risk:** none.

### F2 — YouTube Data API errors are swallowed silently · `HIGH` · `correctness`

- **Location:**
  - [`YouTubeKaraokeProvider.php:52-68`](../../../../backend/app/Services/KaraokeProvider/YouTubeKaraokeProvider.php#L52-L68): a non-2xx falls through to `return collect()`.
  - `:91`: `fetchDurations` returns `[]`.
  - `:157`: `getDetails` returns `null`.
- **Problem:** A 403/400/429 from Google is treated exactly like "no results": nothing is logged, and `SearchKaraokeSongsQuery` returns an empty page. On `main` the scraper fallback masked this. Removing the fallback (§2.13, correct per spec v3) made the silent path the *only* path. Missing durations fail silently too: every song shows `00:00`.
- **Failure scenario:** The daily quota runs out (see F3), or the key is restricted or the API is disabled. From then on, every search returns `{"success":true,"data":[]}`. Guests see an empty list, which reads as "no such song". The log has no entry, and nobody can tell search is broken until the quota resets.
- **Rule:** correctness — skill §1 "catch blocks that swallow the error and return … empty data — making a broken dependency look healthy". Escalated because the failure is silent.
- **Suggested fix:**
  1. In `searchViaApiKey`, `fetchDurations` and `getDetails`, when `!$response->successful()`, log the status and Google's reason without the URL: `Log::warning('YouTube Data API rejected the request', ['status' => $response->status(), 'reason' => $response->json('error.errors.0.reason')])`. The reason is e.g. `quotaExceeded` or `keyInvalid`. Reuse F1's helper so nothing logs the URL.
  2. *Contract decision (spec):* also let the app say why. §7 currently specifies "Provider returns nothing → empty 200". An unavailable provider could instead throw → `503 {code:"SEARCH_UNAVAILABLE"}`, with the app showing "Song search is temporarily unavailable". That needs a spec amendment first.
- **Effort:** `small` (logging); `small`+spec (the 503)
- **Regression risk:** none for the logging.

### F3 — Search-as-you-type spends ~101 YouTube quota units per request · `HIGH` · `performance`

- **Location:**
  - [`SongSearchModal.tsx:70`](../../../../mobapp/src/components/search/SongSearchModal.tsx#L70): 300 ms debounce.
  - [`:134`](../../../../mobapp/src/components/search/SongSearchModal.tsx#L134): any query of 2 or more characters.
  - [`YouTubeKaraokeProvider.php:44-48`](../../../../backend/app/Services/KaraokeProvider/YouTubeKaraokeProvider.php#L44-L48): `search.list` costs 100 units per call regardless of `maxResults`.
  - `:91`: `videos.list` costs 1 unit.
- **Problem:** With the scraper gone, every uncached search costs about 101 units. The default quota is 10,000 units/day, so about 99 searches. Typing a title with natural pauses fires 2–4 requests ("boh" → "bohemian" → "bohemian rhap" …), so the real budget is about **25–50 titles per day**, shared by the whole room. The server's 30-minute cache only helps with identical queries (chips, popular repeats).
- **Failure scenario:** 15 guests each look up a few songs in the first hour. Quota is exhausted and search returns empty for everyone until midnight Pacific time. Through F2 this happens silently.
- **Rule:** [performance.md](../../../rules/performance.md) §1 — debounce "to minimize redundant … queries". The debounce exists, but against a metered API 300 ms is too aggressive.
- **Suggested fix** — two parts, the first needs a decision:
  - **(a) Ops, no code:** request a YouTube Data API quota increase in Google Cloud Console before a real party.
  - **(b) Code + spec §5.3:** raise the debounce to ~800 ms and the minimum query length to 3 (`SongSearchModal.tsx:70, :134`, `SearchSongsRequest` `min:3`), or search on submit (keyboard "Search" key) instead of while typing.

  Both change spec §5.3 / AC-36 ("debounced 300 ms; no request for a 1-character query"), so amend the spec first.
- **Effort:** `trivial` (ops) / `small` (code + spec)
- **Regression risk:** a slower-feeling search; mitigated by the existing `keepPreviousData`.

### F4 — Settings controls start from settings the device never loaded, then overwrite the server · `MEDIUM` · `correctness`

- **Location:**
  - [`SettingsScreen.tsx:47`](../../../../mobapp/src/screens/SettingsScreen.tsx#L47): new song-limit stepper.
  - `:37`, `:42`: pre-existing toggles.
  - `:59`, `:90`: each toggle re-sends the *other* toggle's local value.
  - Seed points: [`CreateRoomScreen.tsx:48`](../../../../mobapp/src/screens/CreateRoomScreen.tsx#L48), [`JoinRoomScreen.tsx:67`](../../../../mobapp/src/screens/JoinRoomScreen.tsx#L67).
- **Problem:** `currentRoom` is only ever set from the create/join responses, and their `room` object has **no `settings`** (`CreateRoomAction.php:59-65`). `GET /rooms/{code}` returns `settings`, but no caller stores them. A device therefore only knows settings it changed itself or heard via `room.settings_updated` while connected.
- **Failure scenario:**
  1. Host Alex sets the song limit to 3 and enables guest reorder.
  2. Sam joins afterwards, so Sam's `currentRoom.settings` is undefined.
  3. Alex transfers host to Sam. Sam opens Settings and sees "No limit" and both toggles off.
  4. Sam taps "+": the limit silently becomes 1, not 4.
  5. Sam turns on guest playback: `allow_guest_reorder:false` is sent too, silently revoking reorder.
- **Rule:** correctness (stale client state written back as truth).
- **Suggested fix:**
  1. Hydrate settings from the server on every room sync. In `useEchoRoom.fetchInitialSync`, call `roomApi.getRoomDetails(normalizedCode)` and `useRoomStore.getState().updateRoomSettings(res.data.settings ?? {})`. Alternatively, add `'settings' => $room->settings` to the `room` payload in `CreateRoomAction`/`JoinRoomAction`.
  2. In `SettingsScreen`, derive the three values from `currentRoom.settings` (the store) instead of one-time `useState` copies, so a later hydration shows up.

  This also fixes the pre-existing guest-gating gap (§5).
- **Effort:** `small`
- **Regression risk:** low — one extra GET per room sync.

### F5 — The new business logic has no automated tests · `MEDIUM` · `tests`

- **Location:** [`backend/tests/`](../../../../backend/tests/) contains only `Feature/ExampleTest.php` and `Unit/ExampleTest.php`.
- **Problem:** The diff adds authorization rules (owner-or-host removal, guest opt-ins, closed-room channel refusal), idempotent writes with a race path, a per-guest limit, host-presence expiry, validation boundaries and an error envelope. None of it is under test. The verification harnesses used during `/webkit.fix` ran from a session scratchpad and are not in the repo.
- **Failure scenario:** A later change reorders `AddSongToQueueAction` (e.g. the limit check before the replay check). A legitimate retry of an accepted add then starts returning `422 QUEUE_LIMIT_REACHED`, and nothing fails in CI.
- **Rule:** [testing.md](../../../rules/testing.md) — "When updating calculation engines or logic layers, the agent must check for and update the associated test files"; §2 Feature tests for "validation layers, database transactions, route endpoints, and authentication guards".
- **Suggested fix:** Add `tests/Feature/` tests with `RefreshDatabase`. `phpunit.xml` already uses SQLite `:memory:`; use `Http::fake()` for YouTube. Minimum set:
  - `QueueIdempotencyTest`: replay, mismatch 409, malformed key 422, duplicate-index rejection.
  - `QueueLimitTest`: guest blocked, host exempt, null clears.
  - `RoomExpiryTest`: host present stays active; host away 31 min closes with the message.
  - `QueueRemovalAuthTest`.
  - `ChannelAuthTest`: closed room 403.
  - `SongSearchTest`: validation 422, throttle 429, no outbound HTTP without a key.
- **Effort:** `large`
- **Regression risk:** none.

### F6 — Names and comments still describe the old song-idle expiry · `LOW` · `maintainability`

- **Location:**
  - [`useEchoRoom.ts:277`](../../../../mobapp/src/hooks/useEchoRoom.ts#L277): "expired after a stretch with no songs".
  - [`ExpireRoomIfIdleAction.php:9`](../../../../backend/app/Actions/Room/ExpireRoomIfIdleAction.php#L9): the class name says *idle*; the behaviour is now *host away*.
  - `CleanupInactiveRoomsAction.php:20`: `$idleCutoff`.
- **Problem:** The diff changed the expiry rule (D6) but left these describing the old one. A reader looking for "why did my room close while songs were queued" is pointed at the wrong rule.
- **Rule:** skill §6 — "comments or names that no longer describe the behavior".
- **Suggested fix:** Change the comment at `useEchoRoom.ts:277` to "closed by the host, or expired after the host was away too long". Optionally rename the class to `ExpireRoomIfHostAwayAction` (3 call sites: `EnsureRoomMember`, `JoinRoomAction`, `CleanupInactiveRoomsAction`) and the variable to `$awayCutoff`.
- **Effort:** `trivial` / `small` with the rename
- **Regression risk:** none.

### F7 — The edited `SongSearchScreen` can leave its loading skeleton stuck (and is unreachable) · `LOW` · `correctness`

- **Location:** [`SongSearchScreen.tsx:57`](../../../../mobapp/src/screens/SongSearchScreen.tsx#L57); route registered at [`RootNavigator.tsx:33`](../../../../mobapp/src/navigation/RootNavigator.tsx#L33).
- **Problem:** The new 1-character early return leaves `loading` untouched. If a 2-character request is in flight when the user deletes back to one character, that request's cleanup sets `isMounted = false`, so its `setLoading(false)` never runs and the skeleton stays. **Nothing in the app navigates to this screen** (no `navigate('SongSearch')`), so no user hits it today; the modal (`SongSearchModal`) is the live path.
- **Rule:** correctness.
- **Suggested fix:** Change line 57 to `if (debouncedQuery.trim().length === 1) { setLoading(false); return; }`. Separately, decide whether the unused screen should be removed; spec §5.2 still lists it, so that is a spec + `/webkit.refactor` call.
- **Effort:** `trivial`
- **Regression risk:** none.

### F8 — Haptics snippet copied twice more, without catching the promise · `LOW` · `duplication`

- **Location:**
  - [`PlaybackControls.tsx:55-62`](../../../../mobapp/src/components/player/PlaybackControls.tsx#L55-L62) (new)
  - [`HostVideoPlayer.tsx:531-538`](../../../../mobapp/src/components/player/HostVideoPlayer.tsx#L531-L538) (new)
  - Same shape already in `NeonButton.tsx:40`. `QueueItemCard.tsx:32-35` has the correct version.
- **Problem:** Four inline copies of "haptic if not web". The two new ones call `Haptics.impactAsync(...)` inside `try {}`, which cannot catch a rejected promise, so a device without haptics support raises an unhandled-rejection warning. `QueueItemCard`'s `triggerHaptic` already does it right with `.catch(() => {})`.
- **Rule:** [coding-standards.md](../../../rules/coding-standards.md) — "DRY: Never duplicate helper functions or logic. Prioritize refactoring reusable logic to shared folders."
- **Suggested fix:** Move `QueueItemCard`'s `triggerHaptic` into `src/utils/haptics.ts` (`export const triggerHaptic = (style = Haptics.ImpactFeedbackStyle.Light) => { if (Platform.OS !== 'web') Haptics.impactAsync(style).catch(() => {}); }`) and use it in all four places.
- **Effort:** `small`
- **Regression risk:** none.

## 3. Fix Plan

| Order | Finding | Severity | Change | File(s) | Effort |
| :---: | :--- | :--- | :--- | :--- | :--- |
| 1 | F1 | HIGH | Redact `key=` in all provider failure logs via one helper (optionally move the key to the `X-Goog-Api-Key` header) | `backend/app/Services/KaraokeProvider/YouTubeKaraokeProvider.php` | small |
| 2 | F2 | HIGH | Log status + Google `error.errors.0.reason` on every non-2xx (no URL) | same file | small |
| 3 | F3a | HIGH | Request a YouTube Data API quota increase before a real party (ops) | Google Cloud Console | trivial |
| 4 | F4 | MEDIUM | Hydrate `currentRoom.settings` from `GET /rooms/{code}` on room sync; Settings reads the store | `mobapp/src/hooks/useEchoRoom.ts`, `mobapp/src/screens/SettingsScreen.tsx` | small |
| 5 | F5 | MEDIUM | Feature tests for idempotency, limit, expiry, removal auth, channel auth, search | `backend/tests/Feature/*` | large |
| 6 | F6 | LOW | Fix the stale comment; optionally rename to `ExpireRoomIfHostAwayAction` | `mobapp/src/hooks/useEchoRoom.ts`, `backend/app/Actions/Room/*`, `backend/app/Http/Middleware/EnsureRoomMember.php` | trivial |
| 7 | F7 | LOW | `setLoading(false)` in the 1-character early return | `mobapp/src/screens/SongSearchScreen.tsx` | trivial |
| 8 | F8 | LOW | Shared `triggerHaptic` (with `.catch`) used by all four sites | `mobapp/src/utils/haptics.ts` (new), 4 components | small |

**Fix together:**
- F1 + F2 share the provider's three failure paths: write one `logFailure`/`logRejection` pair and use it everywhere.
- F4's sync change belongs in the same `fetchInitialSync` that already re-syncs roles.

**Needs a decision before code:**
- F2's optional `503 SEARCH_UNAVAILABLE`: spec §7 says "provider returns nothing → empty 200".
- F3b's longer debounce / minimum length / search-on-submit: spec §5.3 and AC-36.

Amend the spec first (`/webkit.spec T00001`).

## 4. What Was Verified

- **Scope:** `git fetch`, then `git diff --numstat origin/main...origin/T00001` in each repo. Every one of the 55 files was read in diff form; the `HostPlayerScreen` re-indent was read with `-w`.
- **Rules:** only the project-neutral rules apply. `laravel-standards.md`'s SubHRMS conventions (no DB FKs, `alters/` migration folders, inline validation, `auth:sanctum` groups) contradict QueueMic's documented choices (spec D12, FormRequests, flat migrations), so they were deliberately **not** applied — see §6.
- **Security and authorization:**
  - Traced `EnsureRoomMember` → `EnsureRoomHost` / `EnsurePlaybackControl` / `EnsureQueueReorder` and the owner check in `RemoveQueueItemAction`.
  - Route middleware order confirmed via `php artisan route:list` (member check runs before throttle).
  - Channel callback status check, rate-limiter key (session token, not IP), and validation rules for every new or changed input.
  - The API-key leak was **proven by execution** against a non-routable host with a fake key.
  - The existing log was scanned for leaked keys (count only).
- **Correctness:**
  - Traced the add path: lock → key replay → 5 s window → limit → savepoint insert → unique-violation recovery with a locking read. Also the expiry ordering in `EnsureRoomMember`, the `TransferHostAction` self-transfer guard, and the exception-to-code mapping in each controller.
  - The `/webkit.fix` harness (38/38 on scratch SQLite) covers these behaviours, but it is not in the repo (F5).
- **Error envelope:** counted `'success' => false` vs `'errors' =>` per controller: Queue 8/8, Room 12/12, Member 2/2, Playback 4/4, Song 1/1, BroadcastAuth 1/1. The framework renderers were checked in debug and production modes during `/webkit.fix`.
- **Client:**
  - Traced `applyOwnRole` (stale-answer guard, no navigation when the role is unchanged), the reconnect re-sync and heartbeat lifecycle (both cleaned up on unmount), the idempotency-key reuse (`err.status` set only when the server answered), the wake-lock per-instance tag, and the mute flag through the native WebView, the web player and new videos.
  - Settings hydration traced through every `setCurrentRoom` call site (F4).
  - `SongSearchScreen` reachability checked across the navigator (F7).
  - `npx tsc --noEmit` → exit 0.
- **Performance:** no new N+1s — the new queries are single-row lookups or counts. `GET /queue` adds one current-item query. F3 is an external-API cost issue, computed from YouTube's published quota costs (search.list 100 units, videos.list 1, default 10,000/day).

## 5. Pre-existing Issues

Not caused by this diff; listed so they don't get lost.

- **Late-joining guests never see guest-permission controls.** `GuestRoomScreen.tsx:61`, `:108` read `currentRoom.settings`, which join never loads. A guest who joins after the host enabled reorder or playback gets no controls the server would allow. Same root cause and fix as F4.
- **Settings toggles re-send the other toggle's local value** (`SettingsScreen.tsx:59`, `:90`), overwriting it from stale state. Same root cause as F4.
- **Session token stored unencrypted** in AsyncStorage / `localStorage` on web (`mobapp/src/utils/storage.ts`). This conflicts with security.md §1, but was a deliberate choice in spec D12; revisit there if the token's scope grows.
- **Double-advance race.** A song ending at the same moment as a Skip tap can call `/next` twice and skip a song. Listed as out of scope in spec §9.
- **Broadcasts without `try/catch`.** `MoveQueueItemAction`, `RemoveQueueItemAction` and `TransferHostAction` broadcast inside their transactions without one, so with Reverb down those requests fail while add/next/skip succeed.
- **`NeonButton.tsx:40` calls `Haptics.impactAsync` without `.catch`**: the pattern F8 copied.
- **Optimistic queue removal on host and guest screens has no rollback** when the API call fails.
- **`POST /rooms` and `/rooms/join` have no throttle.** Code guessing is impractical (32⁶ codes), but room creation can be spammed.

## 6. Review Limits

- **Not run on a device or emulator.** WebView mute/unmute on iOS/Android, wake-lock activation, haptics, the landscape layout and the reconnect re-sync were reviewed by code trace and typecheck only.
- **No MySQL concurrency test.** The idempotency race path relies on the unique index plus a savepoint. Behaviour was proven on SQLite and the index rejection was proven there, but two simultaneous requests on InnoDB were not executed.
- **YouTube quota figures** come from Google's published costs, not measured against this key. Check the real quota in Cloud Console → APIs & Services → YouTube Data API v3 → Quotas.
- **Rule library mismatch.** `.agents/rules/` profiles SubHRMS and ScaleUP only. Rules encoding those projects' conventions were not applied, to avoid false findings; a QueueMic section in `project-profile.md` would remove this ambiguity for future reviews.
- **Visual design** (spacing, contrast, Restyle token use) was not reviewed. That is `/webkit.design-review`'s job, which has not been run on this change.

## 7. Resolution

> **2026-10-07** — `/webkit.fix` applied the Fix Plan's code items on `T00001` (`backend` from `2b8e7fc`, `mobapp` from `3f52e10`). The changes are uncommitted. The verdict above stands until `/webkit.code-review T00001` re-runs.

| Finding | Status | What changed |
| :--- | :--- | :--- |
| F1 | Fixed | `YouTubeKaraokeProvider` sends every request through one `request()` helper that puts the key in the **`X-Goog-Api-Key` header**. No URL carries `key=` any more; Google acceptance was verified live with 1 quota unit. All failures log through `logException()`, which also masks any `key=` that appears (`redactKey()`) |
| F2 | Fixed (logging) | Every non-2xx — search, length lookup, details — logs `"YouTube Data API <call> rejected"` with `status`, Google's `reason` (e.g. `quotaExceeded`, `badRequest`) and a redacted `message`. "No such video" is still not treated as a failure. The optional `503 SEARCH_UNAVAILABLE` waits on a spec decision |
| F3a | **Open (ops)** | Request a YouTube Data API quota increase in Google Cloud Console before a real party. F3b (search pacing) waits on spec §5.3 |
| F4 | Fixed | `useEchoRoom.fetchInitialSync` loads `GET /rooms/{code}` settings into the store on every room sync, including on reconnect. `SettingsScreen` reads all three values from the store (no local copies), and each control now sends **only its own key**, so stale values cannot be written back. This also fixes the pre-existing late-joiner guest gating (§5) |
| F5 | Fixed | 7 Feature test classes, **29 tests / 236 assertions**, in `backend/tests/Feature/` using the `Concerns/InteractsWithRooms` trait: `RefreshDatabase`, `Http::preventStrayRequests()`, mock provider, cleanup middleware disabled. They cover idempotency, the queue limit and settings validation, room expiry, removal auth, channel auth (real Pusher-protocol signing, no network), search membership/validation/throttle/no-key, and the provider (header-only key, logged rejections, redacted network errors, `getDetails`) |
| F6 | Fixed | Stale "no songs" wording corrected in `useEchoRoom.ts`, `SplashScreen.tsx` and the `CleanupInactiveRoomsAction` docblock; `$idleCutoff` → `$awayCutoff`. The class name `ExpireRoomIfIdleAction` is kept because spec v3 §4 names it; rename alongside a spec update |
| F7 | Fixed | `SongSearchScreen` clears `loading` on the 1-character early return. The search promise now has `.catch` + `.finally`, so a failed request no longer sticks the skeleton either |
| F8 | Fixed | New `mobapp/src/utils/haptics.ts` (`triggerHaptic`, `HapticStyle`, catches the promise) replaces the inline copies in `PlaybackControls`, `HostVideoPlayer`, `NeonButton` and `QueueItemCard`. Other pre-existing inline sites (`NicknameModal`, `HeaderBar`, and the unused `DraggableQueueList` / `QueueReorderModal`) were left as they were |

**Proof:**

- `vendor/bin/phpunit`: 29/29 pass in about 0.7 s. `storage/logs/laravel.log` was unchanged by the run (8962 lines before and after), and no test reached the network.
- **Mutation check:** removing the owner check failed `QueueRemovalTest` (403 expected, 200 received), and removing `redactKey` failed `test_network_errors_are_logged_without_the_key`. Both files were restored byte-for-byte, and the suite is green again.
- `npx tsc --noEmit` → exit 0; `php -l` is clean on every changed PHP file.
- Device behaviour (Settings showing hydrated values after a transfer, haptics) is still checked by code trace only.

<!-- Run history -->
