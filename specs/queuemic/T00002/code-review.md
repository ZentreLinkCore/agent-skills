# Webkit Code Review Report

## Metadata

| Field | Value |
| --- | --- |
| Ticket | T00002 (queuemic) |
| Branch | None — uncommitted work on `main` in both repos; no `T00002` branch exists (base `main`: backend `276d3ae`, mobapp `5d19824`; 26 files changed, +1232/-27 lines excluding the generated `package-lock.json` +5645/-1829) |
| Reviewer Role | Senior Developer Review |
| Review Date | 2026-10-11 |
| Review Run | v1 — initial |

---

## Summary

### Overall Code Quality

CHANGES REQUIRED

### Summary

Not mergeable yet. The backend version gate is small and well tested (6/6 pass), but the mobile side has three bugs a host or guest will hit in normal use. The most consequential one: on Android, pressing back on the Settings screen shows "Exit Party Room?" instead of going back, and its "End Party" button closes the room for everyone (Finding #1).

---

## Changed Areas

- **Frontend:** New `VersionUpdateModal`, `useAppVersionStore`, `versionChecker`, `backgroundPlayback` service. `client.ts` sends `X-App-Version`/`X-Platform` and opens the required-update modal on HTTP 426. `SplashScreen` awaits a version check before navigating. `HostPlayerScreen` adds the PiP layout, the background-playback lifecycle and an Android back-button guard. `GuestRoomScreen` adds a resume resync. `HostVideoPlayer` adds visibility-API locking, background auto-resume and the PiP CSS. `useEchoRoom` keeps the host heartbeat in the background while playing. `SettingsScreen` uses `navigateToHome()`.
- **Backend:** New `GET /api/v1/app/version` (`AppVersionController` → `GetAppVersionQuery`). New `EnforceAppVersion` middleware appended to the whole `api` group, plus an `app.version` alias. `426 => 'UPGRADE_REQUIRED'` added to the HTTP exception code map.
- **Database:** None.
- **Other:** `config/app_version.php` (env-driven versions, store URLs, release notes). `tests/Feature/AppVersionTest.php` (6 tests). `app.json` Android permissions plus two config plugins: `withPictureInPicture` (manifest flags plus `MainActivity` PiP and Fabric-mounting code) and `withAndroidNdk`. `eslint.config.js`, a `lint` script and `eslint`/`eslint-config-expo` dev dependencies.

---

## Findings

### CRITICAL

None.

### HIGH

#### Finding #1

- **Finding:** Bug — the host's back-button guard hijacks Back on screens stacked above the player
- **File:** [`mobapp/src/screens/HostPlayerScreen.tsx`](../../../../mobapp/src/screens/HostPlayerScreen.tsx#L118)
- **Line:** 118–142
- **Issue:** `BackHandler.addEventListener('hardwareBackPress', onBackPress)` is registered in a plain `useEffect`, so it stays active for as long as `HostPlayerScreen` is mounted. It stays mounted while `Settings` is pushed above it (`navigation.navigate('Settings', …)`, line 329). React Navigation registers its own Back listener once, when the container mounts (`@react-navigation/native/src/useBackButton.native.tsx:13`). RN calls Back listeners last-registered-first (`BackHandler.android.js:30`, `:47`). So the host's listener runs first, returns `true`, and `navigation.goBack()` never runs. Example: the host opens Settings (gear icon) and presses Android Back. They get the "Exit Party Room?" alert instead of returning to the player. Tapping "End Party" calls `roomApi.closeRoom` and ends the party for every guest.
- **Why It Matters:** Back is the standard way to leave Settings on Android. Every host who tries it gets a destructive prompt, and one mis-tap closes a live room.
- **Recommended Fix:** Register the listener only while the screen is focused. Replace the effect with `useFocusEffect(useCallback(() => { const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress); return () => sub.remove(); }, [roomCode]))`, using `useFocusEffect` from `@react-navigation/native`. A smaller fix also works: start `onBackPress` with `if (!navigation.isFocused()) return false;`.

#### Finding #2

- **Finding:** Bug — every screen and every role enters picture-in-picture when the app is left
- **File:** [`mobapp/plugins/withPictureInPicture.js`](../../../../mobapp/plugins/withPictureInPicture.js#L12)
- **Line:** 12–30
- **Issue:** The generated `onUserLeaveHint()` calls `enterPictureInPictureMode` with no condition except the SDK level. It doesn't check whether a video is playing, whether the user is the host, or which screen is showing. Only `HostPlayerScreen` has a PiP layout (`isPipMode`). Some examples:
  - A guest on `GuestRoomScreen`, or anyone on `Home` or `JoinRoom`, presses Home. The whole screen shrinks into a floating window instead of going to the background.
  - Android also calls `onUserLeaveHint` when the app itself starts another activity. So tapping "Update Now" in `VersionUpdateModal` (`Linking.openURL` to the Play Store) puts the update modal into a PiP window over the store.
- **Why It Matters:** Every user meets this on every Home press, and it ships to guests, who were never meant to have PiP. The JS side can't stop it because the decision is made natively.
- **Recommended Fix:** Gate PiP on state that JS controls:
  1. Add a one-method native bridge to the plugin, e.g. a small `ReactPackage` exposing `setPipEnabled(enabled: Boolean)`, that writes a static `@Volatile var pipEnabled`.
  2. Have `onUserLeaveHint` return early when `!pipEnabled`.
  3. In `HostPlayerScreen`, call `setPipEnabled(true)` while `playbackState === 'playing'`, and `false` on pause and on unmount.

  On API 31+, `setPictureInPictureParams(Builder().setAutoEnterEnabled(enabled).build())` toggled from the same bridge is an equivalent alternative.

#### Finding #3

- **Finding:** Bug — app launch now waits on the version request, and its guard races
- **File:** [`mobapp/src/screens/SplashScreen.tsx`](../../../../mobapp/src/screens/SplashScreen.tsx#L23)
- **Line:** 23–35, 89
- **Issue:** `checkSession` became `async` and now runs `await checkAppVersion()` (line 29) before `resolved = true` (line 35) and before any navigation. That causes two problems:
  - **Launch blocked.** When the API host is reachable but slow, or the TCP connection hangs (captive Wi-Fi, cold or overloaded server), the splash stays up until axios times out, which is 20 s (`client.ts:25`). Before this change it navigated after 400 ms. When the request fails (`versionChecker.ts:81`), the app navigates anyway, so the wait buys nothing.
  - **Double execution.** On the not-yet-hydrated path, the forced `checkSession(true)` timer (line 89) fires at 3 s while the first call is still awaiting. It passes `if (resolved) return` because `resolved` is still `false`. The result is two version requests, two `getRoomDetails` calls and two `navigation.replace` attempts.
- **Why It Matters:** On venue Wi-Fi, the first thing the user sees is a frozen splash screen. The double run duplicates room-restore traffic and navigation on every slow launch.
- **Recommended Fix:**
  1. Set `resolved = true` synchronously, right after the hydration check and before any `await`.
  2. Don't block navigation on the check. Call `checkAppVersion()` without awaiting it: `VersionUpdateModal` is mounted globally in `App.tsx` and the required modal can't be dismissed, so it covers whatever screen loads.
  3. If halting navigation on `required` is still wanted, bound the wait instead, e.g. `Promise.race([checkAppVersion(), delay(2500).then(() => null)])`.

### MEDIUM

#### Finding #4

- **Finding:** Architecture — the version gate runs on every API route, including the version endpoint itself
- **File:** [`backend/bootstrap/app.php`](../../../../backend/bootstrap/app.php#L30)
- **Line:** 30, 38
- **Issue:** `EnforceAppVersion` is appended to the whole `api` group (line 30), so it also runs on `GET /api/v1/app/version` and `/broadcasting/*`. The `app.version` alias registered at line 38 is never used by any route. A probe with `min=1.1.0` and the header `X-App-Version: 1.0.0` returned **426** from `GET /app/version?current_version=1.0.0`. That makes the endpoint's `required` branch (`GetAppVersionQuery.php:47`) and the server's release notes unreachable for the clients they're meant for. `checkAppVersion` catches the 426 and returns `null`, so `SplashScreen.tsx:30` never halts and auto-navigation continues into further 426 calls. The modal still appears, but only through the interceptor fallback (`client.ts:72`) with placeholder release notes. The spec places the gate on "room mutating routes".
- **Recommendation:** Remove the global append at line 30. Wrap the room route group(s) in `routes/api.php` with `->middleware('app.version')` (the alias already exists), and leave `/app/version` and `/broadcasting/*` outside it.

#### Finding #5

- **Finding:** Pattern — validation is done by hand in the Query instead of a FormRequest
- **File:** [`backend/app/Http/Controllers/Api/V1/AppVersionController.php`](../../../../backend/app/Http/Controllers/Api/V1/AppVersionController.php#L20)
- **Line:** 20 (validation at `GetAppVersionQuery.php:12–20`)
- **Issue:** Every sibling V1 controller validates with a FormRequest in `app/Http/Requests/V1/` (`CreateRoomRequest`, `JoinRoomRequest`, `SearchSongsRequest`, …). This one passes `$request->all()` into the Query, which validates by hand and builds its own 422. [laravel-standards.md](../../../rules/laravel-standards.md) §5: "Match the detected validation style. If FormRequests are standard, create or extend them." The hand-written rules are also looser than the documented contract. A probe showed `platform=bogus` silently becoming `android`, and a missing `current_version` returning 200 with `update_type: "none"`.
- **Recommendation:** Add `app/Http/Requests/V1/AppVersionRequest.php` with `platform: required|in:android,ios,web`, `current_version: required|string|regex:/^\d+\.\d+\.\d+$/` and `current_build: nullable|integer|min:1`. Type-hint it in `show()` and pass `$request->validated()` to the Query. Then drop the Query's own checks and the `InvalidArgumentException` catch. The global `ValidationException` renderer (`bootstrap/app.php:43–53`) already produces the `VALIDATION_FAILED` envelope.

#### Finding #6

- **Finding:** Duplication — the guest resume resync re-implements part of `useEchoRoom`'s `fetchInitialSync`
- **File:** [`mobapp/src/screens/GuestRoomScreen.tsx`](../../../../mobapp/src/screens/GuestRoomScreen.tsx#L73)
- **Line:** 73–101
- **Issue:** `useEchoRoom.ts:194` already has `fetchInitialSync` (queue → `syncNowPlaying` → settings → members), and it re-runs on socket reconnect (`:234–239`), which is what happens after a resume. The new AppState handler is a second, divergent copy:
  - It updates the queue and playback `state` only, with no `currentPlaying` and no `syncAnchor`.
  - It falls back to `'playing'` when the field is missing (line 91).
  - Each resume now fires the reconnect resync plus two more requests.

  [duplicate-prevention.md](../../../rules/duplicate-prevention.md) §1–2: reuse the existing logic instead of adding a parallel copy.
- **Recommendation:** Delete the screen-level effect. Inside `useEchoRoom`'s room effect, subscribe to `AppState` and call the existing `fetchInitialSync()` on `background → active`, with jitter if wanted. Remove the subscription in the same cleanup.

#### Finding #7

- **Finding:** Bug risk — unbounded auto-resume overrides pauses the OS makes
- **File:** [`mobapp/src/components/player/HostVideoPlayer.tsx`](../../../../mobapp/src/components/player/HostVideoPlayer.tsx#L270)
- **Line:** 270–279 (and 512–519)
- **Issue:** Any `PAUSED` state that QueueMic didn't request (`window.isKaraokePlaying` still `true`) is answered with `player.playVideo()` after 50 ms. There is no retry cap and no condition. Pauses initiated by the system, such as audio-focus loss on an incoming call, are therefore fought: either karaoke resumes over the call, or play and pause alternate every 50 ms for as long as the OS keeps pausing. This follows from the code path; it wasn't reproduced on a device. Separately, the React-side branch at 512–519 can't be reached. The HTML returns early without posting `paused` whenever `isKaraokePlaying` is `true`, and an intended pause sets it to `false` first, which also makes `isPlaying` false.
- **Recommendation:** Keep one mechanism:
  - Auto-resume only while the page is genuinely backgrounded.
  - Cap it, e.g. at most 3 retries in 5 s, then post `paused` so the room state reflects reality.
  - Delete the unreachable branch at 512–519.

#### Finding #8

- **Finding:** Duplication — the visibility-lock script is embedded twice
- **File:** [`mobapp/src/components/player/HostVideoPlayer.tsx`](../../../../mobapp/src/components/player/HostVideoPlayer.tsx#L86)
- **Line:** 86–114 and 127–153
- **Issue:** `INJECTED_BG_PLAYBACK_JS` (passed as `injectedJavaScriptBeforeContentLoaded`, line 789) and the inline `<script>` at the top of `getYouTubeHtml` contain the same `Object.defineProperties` and `visibilitychange`/`blur` blocking code, and both run on every load. [duplicate-prevention.md](../../../rules/duplicate-prevention.md): extract instead of copying.
- **Recommendation:** Keep `INJECTED_BG_PLAYBACK_JS`, which runs before page scripts on every navigation, and delete the inline copy from `getYouTubeHtml`.

#### Finding #9

- **Finding:** Maintainability — `BackgroundPlaybackManager` claims a service, a notification and a wake lock it doesn't have
- **File:** [`mobapp/src/services/backgroundPlayback.ts`](../../../../mobapp/src/services/backgroundPlayback.ts#L35)
- **Line:** 35–110
- **Issue:** The class and its logs describe a foreground service, a media notification and a "wake lock to keep audio decoding and network socket alive" (line 39). The only native call is `expo-keep-awake`, which is `FLAG_KEEP_SCREEN_ON` (`ExpoKeepAwakeManager.kt:23`): a window flag with no effect once the app is backgrounded.
  - `updateNotification` (line 44) writes state that nothing reads.
  - `handleAudioBecomingNoisy`, `handleAudioFocusLoss` and `handleAudioFocusGain` (lines 60, 75, 90) have no callers anywhere in `src/`.
  - `app.json` declares `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK` and `POST_NOTIFICATIONS` with no service or notification to use them.

  The next maintainer will believe calls, headsets and notifications are handled.
- **Recommendation:** Reduce the class to what it does: a keep-awake toggle while playing. Delete the dead `handleAudio*` and `updateNotification` methods and any unused permissions. Rename the log text so it no longer claims a service. Whether those behaviours must exist is a spec question for `/webkit-verify` (FR-01–FR-03).

#### Finding #10

- **Finding:** Portability — the build plugin writes one developer's SDK path into `local.properties`
- **File:** [`mobapp/plugins/withAndroidNdk.js`](../../../../mobapp/plugins/withAndroidNdk.js#L25)
- **Line:** 22–30
- **Issue:** When `android/local.properties` is missing, which is true on every fresh prebuild (other developers, CI, EAS's Linux builders), the plugin writes `sdk.dir=C:\Users\johnl\AppData\Local\Android\Sdk`. The `catch` swallows any error. On every machine except one, the build then points at an SDK directory that doesn't exist. Whether Gradle falls back to `ANDROID_HOME` after an invalid `sdk.dir` was not verified.
- **Recommendation:** Remove the `local.properties` block; Android Studio and `ANDROID_HOME` supply `sdk.dir`. If a fallback is really needed, write it only from `process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT`, and only when that is set.

### LOW

#### Finding #11

- **Finding:** Consistency — two error codes for HTTP 426
- **File:** [`backend/bootstrap/app.php`](../../../../backend/bootstrap/app.php#L68)
- **Line:** 68
- **Suggestion:** The map adds `426 => 'UPGRADE_REQUIRED'`, while the middleware and the mobile client use `UPDATE_REQUIRED`, and nothing throws a 426 `HttpException`. Remove the line, or change it to `'UPDATE_REQUIRED'` so any future 426 still triggers the client's modal.

#### Finding #12

- **Finding:** Duplication — version defaults and URL selection are repeated
- **File:** [`backend/app/Http/Middleware/EnforceAppVersion.php`](../../../../backend/app/Http/Middleware/EnforceAppVersion.php#L20)
- **Line:** 20–26
- **Suggestion:** The default versions and store URLs live in `config/app_version.php` and are repeated as `config()` fallbacks in this middleware, in `GetAppVersionQuery.php:24–35` and in `useAppVersionStore.ts:59`. The config keys are always defined, so the fallbacks never apply. The platform → download-URL choice is also duplicated between the middleware and the Query. Drop the fallbacks and move the URL choice into one shared static helper, per [duplicate-prevention.md](../../../rules/duplicate-prevention.md).

#### Finding #13

- **Finding:** Correctness — `published_at` reports the request time
- **File:** [`backend/app/Queries/AppVersion/GetAppVersionQuery.php`](../../../../backend/app/Queries/AppVersion/GetAppVersionQuery.php#L63)
- **Line:** 63
- **Suggestion:** `'published_at' => now()->toIso8601String()` claims every release was published "just now". Read it from config (`APP_RELEASE_PUBLISHED_AT`), or drop the field; the app only types it and never reads it (`types/index.ts:120`).

#### Finding #14

- **Finding:** Lint — errors and warnings added by new code
- **File:** [`mobapp/src/components/common/VersionUpdateModal.tsx`](../../../../mobapp/src/components/common/VersionUpdateModal.tsx#L155)
- **Line:** 155
- **Suggestion:** The project's ESLint config, added in this diff, reports `react/no-unescaped-entities` on `What's New:`; write `What&apos;s New:` or `{"What's New:"}`. Also remove the unused `Platform` import at `backgroundPlayback.ts:1`.

#### Finding #15

- **Finding:** Duplication — the same Android permissions are declared twice
- **File:** [`mobapp/plugins/withPictureInPicture.js`](../../../../mobapp/plugins/withPictureInPicture.js#L70)
- **Line:** 70–75
- **Suggestion:** `permissionsToAdd` re-adds the four permissions already listed under `android.permissions` in `app.json`. Keep them in one place, `app.json`, and narrow them as Finding #9 decides.

### INFO

- **Observation:** Checks run for this review:
  - `php artisan test --filter=AppVersionTest`: **6/6 passed** (22 assertions).
  - `tsc --noEmit`: passes when run as `node --stack-size=16000 node_modules/typescript/bin/tsc --noEmit`. Plain `npx tsc --noEmit` crashes with `RangeError: Maximum call stack size exceeded` inside the TypeScript checker. Not attributed to this diff.
  - ESLint over the touched files: 16 errors and 32 warnings. The new errors are `VersionUpdateModal.tsx:155` (Finding #14) and `HostVideoPlayer.tsx:395`/`:399` (`react-hooks/refs`). Lines 395 and 399 copy the ref-during-render pattern already used at lines 387–392.
- **Observation:** Pre-existing: the ESLint errors at `SettingsScreen.tsx:55`, `:159` and `HostVideoPlayer.tsx:533`, `:542`, `:622` are on lines this diff did not touch.
- **Observation:** Not reviewed: `mobapp/package-lock.json` line by line (+5645/-1829, generated). Its intent was checked through `package.json`: `eslint ^9.0.0`, `eslint-config-expo ~57.0.2` and a `lint` script.
- **Observation:** Specification clarification required: requests without `X-App-Version` always pass `EnforceAppVersion` (`EnforceAppVersion.php:18`). A probe with `min=9.0.0` and no header created a room (201). Every build released before this change sends no header, so the gate can never block exactly the builds it exists for. Spec §12 says the middleware "skips when header missing if configured", but no such setting exists. Decide whether a missing header should count as outdated, and whether that is a config switch.
- **Observation:** The PiP plugin's Fabric workaround (`withPictureInPicture.js:42–47`) calls `FabricUIManager.onHostResume()`/`onHostPause()` directly to keep mounting alive while the activity is paused in PiP. These are public methods but RN-internal lifecycle hooks; re-test PiP after any React Native upgrade. `setSourceRectHint` is hard-coded to 60 dp (line 25), but the player starts lower; this affects only the entry animation.
- **Observation:** Authority boundary: whether FR-01–FR-03 (foreground service, media notification, audio-focus and headset handling) and the unspecced Android PiP work (spec §4 defers PiP to T00003) match the spec belongs to /webkit-verify. Not done here.
- **Observation:** All of this work is uncommitted on `main` in both repos. Per [git-workflow.md](../../../rules/git-workflow.md), commit it to a `T00002` branch in `backend` and `mobapp` before fixing, so `/webkit-fix` and later reviews have a stable diff.

---

## Positive Feedback

- Version comparison uses PHP `version_compare` on both the endpoint and the middleware, which avoids the string-comparison pitfall the spec warns about (`"1.10.0" < "1.2.0"`).
- The 426 handling sits in one place, the axios response interceptor (`client.ts:72–76`), so any outdated room call opens the required-update modal without per-screen code.
- The required modal is non-dismissible in two layers: the store refuses `closeUpdateModal` while `update_type === 'required'` (`useAppVersionStore.ts:36–40`), and the modal's `onRequestClose` is a no-op (`VersionUpdateModal.tsx:61`).
- The persisted version store `partialize`s to the snooze fields only, so a stale `versionInfo` can never be restored from disk.
- `expo-updates` is loaded through a guarded `require` and skipped in `__DEV__`, so dev builds and Expo Go don't crash on a missing module.
- The PiP class is toggled with `injectJavaScript` instead of rebuilding the HTML (`HostVideoPlayer.tsx:673–680`), so entering or leaving PiP never restarts the song.
- The host background heartbeat change in `useEchoRoom.ts:243–244` is a one-condition edit that leaves guest behaviour untouched.
- `AppVersionTest` covers all three `update_type` outcomes, the 422 path, the 426 block and the pass-through case.

---

## Final Recommendation

### FIX REQUIRED

**Fix before merge:**

1. Finding #1 — register the host Back guard only while `HostPlayerScreen` is focused (`useFocusEffect`).
2. Finding #2 — gate `onUserLeaveHint` PiP on a flag that `HostPlayerScreen` sets only while playing.
3. Finding #3 — set `resolved` before any `await` and stop blocking splash navigation on the version request.

<!-- Run history -->
