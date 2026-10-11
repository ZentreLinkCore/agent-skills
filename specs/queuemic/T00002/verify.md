# Webkit Verification Report

## Metadata

| Field | Value |
| --- | --- |
| Ticket | T00002 (queuemic) |
| Branch | `T00002` in `backend` and `mobapp` (base `main`; 0 commits, the work is uncommitted; backend 8 files, mobapp 21 files incl. the generated `package-lock.json`) |
| Specification File | [spec.md](./spec.md) — version 1.0, status Draft |
| Verification Date | 2026-10-11 |
| Verification Run | v1 — initial |

**Implementation Scope**

- **Frontend:** `VersionUpdateModal`, `useAppVersionStore`, `versionChecker`, `backgroundPlayback` (now a keep-awake toggle), `client.ts` (version headers, 426 handler), `SplashScreen`, `HostPlayerScreen`, `GuestRoomScreen`, `HostVideoPlayer`, `useEchoRoom`, `SettingsScreen`, `App.tsx`, `types/index.ts`.
- **Backend:** `AppVersionController`, `AppVersionRequest`, `GetAppVersionQuery`, `EnforceAppVersion`, `GET /api/v1/app/version`, the `app.version` alias on the room routes, and the 426 entry in the exception code map.
- **Database:** None (as the spec states, §8 Database).
- **Other:** `backend/config/app_version.php`; `backend/tests/Feature/AppVersionTest.php` (8 tests); `mobapp/app.json` (Android permissions, 2 plugins); `plugins/withPictureInPicture.js` and `plugins/withAndroidNdk.js`; `eslint.config.js`; `CHANGELOG.md`.

---

## 1. Verification Summary

### Overall Status

⚠ PASS WITH FIXES (7 AC pending manual check)

### Summary

The version-check half of the spec (FR-06 to FR-09, AC-12 to AC-22) is implemented and tested, but the background-playback half is mostly missing. There is no foreground service, no media notification, and no audio-focus or headset handling, so AC-04 to AC-07 are not met and AC-01 to AC-03 can't be trusted without a device test. Findings #1 to #3 must be fixed before merge. Nothing here is a release blocker, because the app still runs and no data or access is at risk.

---

## 2. Specification Compliance

| Specification Area | Status | Notes |
| --- | --- | --- |
| Scope | FAIL | The "Android Background Service Plugin" and the media notification in §4 Included don't exist (Findings #1, #2). Android PiP, the host back-button guard and an ESLint setup were built but are not in the spec (see §7). |
| User Flow | FAIL | Flow 1 steps 1–2 and both failure paths: no service or notification (Findings #1–#3). Flow 2 step 1: guests keep playing in the background instead of pausing (Finding #4). Flow 3 failure path: the mandatory lock isn't kept offline (Finding #5). |
| Technical Design | FAIL | Backend components, route and contract match §8. The mobile `BackgroundPlaybackManager` is a stub (Findings #1–#3). |
| Acceptance Criteria | FAIL | 10/22 met. Not met: AC-04, AC-05 (Finding #2); AC-06, AC-07 (Finding #3). Partial: AC-18 (Finding #7). Manual: AC-01, AC-02, AC-03, AC-08, AC-09, AC-10, AC-20 (§6). |
| Edge Cases | FAIL | EC-01 message differs (Finding #6); EC-02 fallback not enforced (Finding #9); EC-04 lock not kept (Finding #5). EC-03 and EC-05 hold. |
| Security Requirements | PASS | The version endpoint is public as specified, validation matches §13 (rules per Finding #6 for the message only), and the 426 gate is enforced server-side on room routes. |

---

## 3. Findings

### BLOCKER

None.

### REQUIRED FIX

#### Finding #1

- **Category:** REQUIRED FIX
- **Location:** `mobapp/src/services/backgroundPlayback.ts:1-19`; `mobapp/android/app/src/main/AndroidManifest.xml` (no `<service>` element); `mobapp/plugins/`
- **Specification Reference:** §6 FR-01; §4 Included — "Android Background Service Plugin"; §14 Known pitfall 1; AC-01, AC-02, AC-03
- **Problem:** The host process has no foreground service, so Android is free to throttle or kill it once the screen locks or the app is backgrounded for a while.
- **Expected:** "Android Foreground Service with type `mediaPlayback` runs during active host playback", with the specific service type declared in the manifest.
- **Actual:** The permissions are declared, but the manifest has no `<service>`. `BackgroundPlaybackManager` only calls `expo-keep-awake`, which sets `FLAG_KEEP_SCREEN_ON` (`ExpoKeepAwakeManager.kt:23`). That flag has no effect once the app is in the background. The pause-fighting and visibility-lock scripts in `HostVideoPlayer` keep the WebView alive while the process lives, but nothing keeps the process alive.
- **Required Action:** Add a native service to the config plugin: a `Service` declared with `android:foregroundServiceType="mediaPlayback"`, plus a bridge `start`/`stop` (extend the existing `QueueMicPip` bridge pattern). `HostPlayerScreen` calls start while a song is on stage and stop when playback ends or the host leaves. Verify on a device (§6).

#### Finding #2

- **Category:** REQUIRED FIX
- **Location:** `mobapp/src/services/backgroundPlayback.ts` (no notification code); `mobapp/src/screens/HostPlayerScreen.tsx`
- **Specification Reference:** §6 FR-02; §5 Flow 1 steps 1–2; AC-04, AC-05
- **Problem:** The host gets no ongoing notification and no Play/Pause/Skip controls while the app is backgrounded.
- **Expected:** An ongoing notification with song title, requester name and room code, buttons Play/Pause and Skip, tapping it opens `HostPlayerScreen`, and it is dismissed when the host leaves.
- **Actual:** None exists. The earlier `updateNotification` method only stored state nothing read, and was removed in the T00002 code-review fix.
- **Required Action:** In the Finding #1 service, post the ongoing notification (title, `singerName`, room code) with `PendingIntent` actions for Play/Pause and Skip. Emit the action as a device event; in `HostPlayerScreen`, handle it with the existing `handlePlayPause` and `handleSkip`, which already broadcast the state to the room (AC-05). Depends on Finding #1.

#### Finding #3

- **Category:** REQUIRED FIX
- **Location:** `mobapp/src/services/backgroundPlayback.ts`; `mobapp/src/components/player/HostVideoPlayer.tsx:270-283` (auto-resume)
- **Specification Reference:** §6 FR-03; §5 Flow 1 failure paths; AC-06, AC-07
- **Problem:** Disconnecting Bluetooth or a phone call during playback doesn't pause the room. Audio blasts from the speaker or plays over the call.
- **Expected:** `ACTION_AUDIO_BECOMING_NOISY` pauses playback and broadcasts `paused`; `AUDIOFOCUS_LOSS_TRANSIENT` pauses, and regaining focus resumes.
- **Actual:** No code reacts to either event. The handlers that once existed were never called and were deleted in the code-review fix. `grep` for `ACTION_AUDIO_BECOMING_NOISY|AudioFocus` over `mobapp/src` and `mobapp/plugins` finds nothing. The WebView's auto-resume of unrequested pauses actively fights an OS pause (up to 3 attempts per 5 s, then reports `paused`).
- **Required Action:** In the Finding #1 service, register a noisy-audio receiver and an `AudioFocus` listener, and emit events to JS. On noisy or focus loss, call the existing pause path (set `paused` and `playbackApi.updatePlaybackState`); on focus gain, resume. While focus is lost, suppress the WebView's auto-resume so a call isn't played over. Depends on Finding #1.

#### Finding #4

- **Category:** REQUIRED FIX
- **Location:** `mobapp/src/components/player/HostVideoPlayer.tsx:620-627` and `:764`; `mobapp/src/screens/GuestRoomScreen.tsx:228-240`
- **Specification Reference:** §5 Flow 2 step 1; §6 FR-05
- **Problem:** A guest who backgrounds the app keeps decoding video.
- **Expected:** "local video iframe is paused/muted to save battery" and "minimal resources".
- **Actual:** `GuestRoomScreen` renders the same `HostVideoPlayer` (`followHost`, muted by default). Its `AppState` effect calls `sendCommand('play')` on `background` when `isPlaying`, for every role, and `injectedJavaScriptBeforeContentLoaded` locks the Page Visibility API for guests too. FR-01 asks for background playback for the host only.
- **Required Action:** Gate the background `play` reinforcement and the visibility lock on the host: skip them when `followHost` is true. On `background`, a guest pauses (or stays muted) and resyncs on `active` through Finding #8's existing path.

#### Finding #5

- **Category:** REQUIRED FIX
- **Location:** `mobapp/src/store/useAppVersionStore.ts:72-75`; `mobapp/src/services/versionChecker.ts:81-85`
- **Specification Reference:** §5 Flow 3 failure path; §11 EC-04
- **Problem:** A mandatory update is forgotten when the app is offline on the next launch.
- **Expected:** "Client checks local cache/AsyncStorage. If previously flagged as mandatory update, keeps lock."
- **Actual:** `partialize` persists only `dismissedAtMs` and `dismissedVersion`. After a required result, a later launch that can't reach the API falls into the `catch` and returns `null`, and no modal opens.
- **Required Action:** Persist a `requiredUpdate` flag (and the minimum version and download URL) from `setVersionInfo` and `triggerRequiredUpdate`. In the `catch`, if the flag is set, call `openUpdateModal()`. Clear the flag when a later check returns `none` or `optional`.

#### Finding #6

- **Category:** REQUIRED FIX
- **Location:** `backend/app/Http/Requests/V1/AppVersionRequest.php:19`
- **Specification Reference:** §11 EC-01; §13 Validation
- **Problem:** The 422 message isn't the one the spec fixes.
- **Expected:** `{"success": false, "message": "Invalid semver string format.", "code": "VALIDATION_FAILED"}` for a malformed or missing `current_version`.
- **Actual:** `GET /api/v1/app/version?platform=android&current_version=bad` returns 422 with `"message":"The current version field format is invalid."` (probe output). The code is correct; only the message differs. It changed when validation moved into a FormRequest.
- **Required Action:** Add a `messages()` method to `AppVersionRequest` that sets `current_version.required`, `current_version.string` and `current_version.regex` to `'Invalid semver string format.'`.

#### Finding #7

- **Category:** REQUIRED FIX
- **Location:** `mobapp/src/components/common/VersionUpdateModal.tsx:184`
- **Specification Reference:** §10 AC-18; §5 Flow 3 step 2b; FR-08
- **Problem:** The optional-update button reads "Remind Later".
- **Expected:** Buttons "Update Now", "Remind Me Later" and "Continue".
- **Actual:** `title="Remind Later"`.
- **Required Action:** Change the title to `Remind Me Later`.

#### Finding #8

- **Category:** REQUIRED FIX
- **Location:** `mobapp/src/hooks/useEchoRoom.ts:254-257`
- **Specification Reference:** §7 NFR-03
- **Problem:** Every guest re-syncs at the same instant after a mass resume.
- **Expected:** "Exponential jitter (0–500 ms) added to guest reconciliation on mass resume".
- **Actual:** The `AppState` handler calls `fetchInitialSync()` immediately. `grep` for `jitter|Math.random` in the hook finds none.
- **Required Action:** Wrap the call in `setTimeout(fetchInitialSync, Math.random() * 500)` and clear the timer in the effect cleanup.

#### Finding #9

- **Category:** REQUIRED FIX
- **Location:** `backend/config/app_version.php:28-31`; `backend/app/Queries/AppVersion/GetAppVersionQuery.php:21`
- **Specification Reference:** §11 EC-02
- **Problem:** An empty release note or store URL is passed through as an empty string.
- **Expected:** "System provides default fallback message … and default store URL" when notes or the URL are empty or missing.
- **Actual:** `env('APP_RELEASE_NOTES', …)` returns `''` when the variable is present but empty. `downloadUrl()` has no fallback either, so an empty `APP_UPDATE_URL_*` gives `"download_url": ""` and the client's "Update Now" button does nothing. The config's default note is a list of feature bullets, which differs from both defaults the spec names (see §7).
- **Required Action:** In `config/app_version.php`, use `env('APP_RELEASE_NOTES') ?: '<default>'` and the same for both store URLs, so an empty value also falls back. The default text follows the spec correction in §7.

### IMPROVEMENTS

#### Improvement #1

- **Area:** Documentation
- **Current Situation:** The five `APP_*` keys that §14 lists are defined only in `config/app_version.php`. `backend/.env.example` has none of them.
- **Suggestion:** Add them to `.env.example` with their defaults.
- **Reason:** Deploy and rollback (§14) edit `.env`; a missing example makes the keys hard to find.

#### Improvement #2

- **Area:** State shape
- **Current Situation:** §8 State lists `isBackgroundServiceActive` in `usePlaybackStore`, and camelCase `versionInfo` fields. The store has no such flag and holds the API's snake_case payload.
- **Suggestion:** Add `isBackgroundServiceActive` when the Finding #1 service lands, and keep the snake_case shape (update §8 in a spec correction).
- **Reason:** The flag becomes meaningful only with a real service.

#### Improvement #3

- **Area:** Missing header
- **Current Situation:** A request without `X-App-Version` always passes `EnforceAppVersion` (probe: `min=9.0.0`, no header → 201). §12 says the middleware "skips when header missing if configured", but no such setting exists. Builds released before T00002 send no header, so the gate can never reject them.
- **Suggestion:** Decide whether a missing header counts as outdated, and add a config switch if it should be optional.
- **Reason:** It is the only way to stop pre-1.1.0 clients, which is the point of D-03.

### OUT OF SCOPE

#### Suggestion #1

- **Suggestion:** Make Android PiP, the host back-button guard and the ESLint setup separate, tracked work.
- **Reason Not Included:** None of them is in the spec. §4 Not Included puts PiP in T00003. The spec's PiP wording concerns iOS only.
- **Future Consideration:** If they stay in T00002, amend the spec (§7).

---

## 4. Security Review

| Check | Status |
| --- | --- |
| Authentication | PASS |
| Authorization | PASS |
| Input Validation | PASS |
| Data Exposure | PASS |
| API Security | PASS |

**Issues:** No security issues found.

- Malformed `X-App-Version` values are rejected: `abc` returned 426 on a room route, and `version_compare` treats `""`, `"1.0"` and `"1.0.0-beta"` as below `1.1.0`. A client can always claim a high version; that spoofing is inherent to a client-supplied header and the spec accepts it.
- The 426 body carries only the minimum version, the client's own version and a public store URL. No server internals are exposed.
- Improvement #3 is a policy question, not a vulnerability.

---

## 5. Performance Review

| Check | Status |
| --- | --- |
| Database Queries | N/A — no database access in this feature |
| API Performance | PASS |
| Frontend Performance | FAIL |
| Resource Usage | FAIL |

**Issues:**

- Finding #4 — guests decode video in the background (battery).
- API: the config is cached for 60 s (`GetAppVersionQuery.php:21`), as NFR-02 states. SC-05's p95 < 50 ms was not measured.
- Improvement: guest resync runs four requests in sequence (queue, playback, room, members) inside `fetchInitialSync`. AC-10's 1,200 ms target could not be measured (§6).

---

## 6. Testing Review

### Existing Tests

- **Status:** passing — `php artisan test` (backend): 39/39, 281 assertions, including `AppVersionTest` (8). `node --stack-size=16000 node_modules/typescript/bin/tsc --noEmit` (mobapp): exit 0. Plain `npx tsc --noEmit` crashes inside TypeScript; not attributed to this ticket.
- **Implemented:** YES (backend only)
- **Coverage:**
  - Covered by tests: FR-06, FR-07, AC-12 to AC-16, EC-01 (code only, not the message), and the new "outdated clients can still call `/app/version`" case.
  - No tests: FR-01 to FR-05, FR-08, FR-09. The mobile app has no JS test runner, so none can be added without one.

### Manual Verification

| Scenario | Expected | Result | Status |
| --- | --- | --- | --- |
| AC-01 / MT-01: host plays, presses Home, browses 5 min | Audio continues | Not run — needs a physical Android device. Likely at risk until Finding #1 | Not run — device |
| AC-02: screen off | Audio continues, no stutter | Not run — device | Not run — device |
| AC-03: Messenger 5 min | Playback doesn't terminate | Not run — device | Not run — device |
| AC-08: host in background 60 s | `POST …/heartbeat` returns 200 | Not run — the timer is at `useEchoRoom.ts:241-250`, but it depends on the process staying alive (Finding #1) | Not run — device |
| AC-09: host in background 30 s | `POST …/playback/state` | Not run — same dependency; the timer is at `HostPlayerScreen.tsx:162-176` | Not run — device |
| AC-10 / MT-04: guest locks screen 3 min, reopens | State matches within 1,200 ms | Not run — device | Not run — device |
| AC-20: `is_ota_compatible: true` with an EAS update | Bundle downloads, "Restart" prompt | Not run — needs an EAS update; code path at `versionChecker.ts:49-64` | Not run — EAS |
| AC-17 / MT-05: min `1.1.0`, app at 1.0.0 | Non-dismissible modal | Code traced: `onRequestClose` no-op, store refuses close | MET (by code) |

---

## 7. Specification Impact Decision

### SPEC UPDATE REQUIRED

**Reason:** Case 1 and Case 2.

- **Case 1 — the spec contradicts itself.** §14 gives the default release note as "Performance improvements and bug fixes.", while §11 EC-02 says the fallback is "General improvements and bug fixes". The implementation's defaults match neither (Finding #9).
- **Case 2 — approved requirement change.** The user asked for Android picture-in-picture in this session, and it was built (`plugins/withPictureInPicture.js`, the PiP layout in `HostPlayerScreen`/`HostVideoPlayer`). §4 Not Included defers PiP to T00003 for iOS only and is silent on Android. The host back-button guard ("Exit Party Room?") and the shared `navigateToHome()` change have no recorded request; confirm them before adding them to the spec.

**Changed Sections:**

- §11 Edge Cases / §14 Config — pick one default release-note text and state the default store-URL fallback (Case 1)
- §4 Scope (Included) — add Android PiP (and the host back guard if confirmed) (Case 2)
- §6 Functional Requirements and §10 Acceptance Criteria — add their requirement and acceptance rows (Case 2)

---

## 8. Final Recommendation

### FIX REQUIRED BEFORE MERGE

**Required fixes:**

1. Finding #1 — add an Android foreground service with `foregroundServiceType="mediaPlayback"` (FR-01).
2. Finding #2 — add the ongoing media notification with Play/Pause/Skip (FR-02). Depends on #1.
3. Finding #3 — handle headset-disconnect and audio-focus events, and stop the auto-resume from fighting them (FR-03). Depends on #1.
4. Finding #4 — pause the video for guests in the background; keep the play-in-background logic host-only (Flow 2).
5. Finding #5 — persist the mandatory-update flag and keep the lock when the version check fails (EC-04).
6. Finding #6 — return "Invalid semver string format." for EC-01.
7. Finding #7 — rename the button to "Remind Me Later" (AC-18).
8. Finding #8 — add 0–500 ms jitter to guest reconciliation (NFR-03).
9. Finding #9 — fall back to the default notes and store URL when the config value is empty (EC-02).

<!-- Run history -->
