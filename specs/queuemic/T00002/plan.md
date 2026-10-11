# Implementation Plan — Background Playback & Automatic Version Checking

## Metadata

| Field | Value |
| --- | --- |
| Project Name | queuemic |
| Ticket Number | T00002 |
| Feature Name | Background Playback & Automatic Version Checking |
| Specification | `.agents/specs/queuemic/T00002/spec.md` |
| Based on Spec Version | 1.1 |
| Plan Revision | 1 |
| Created Date | 2026-10-11 |
| Plan Status | Draft |

---

## 1. Technical Context

| Aspect | Value |
| --- | --- |
| Project | queuemic — two repos, `backend` and `mobapp`, resolved from the spec and each repo's `AGENTS.md`; not covered by `project-profile.md` |
| Backend | Laravel; `app/Queries/<Domain>/` for reads, thin controllers in `app/Http/Controllers/Api/V1/`, FormRequests in `app/Http/Requests/V1/`, middleware in `app/Http/Middleware/` |
| Frontend | Expo SDK 57, React Native 0.86 (bridgeless / new architecture), TypeScript, `.tsx` |
| HTTP client | `mobapp/src/api/client.ts` — axios instance with a response interceptor |
| State | Zustand stores in `mobapp/src/store/` (`useAppVersionStore`, `usePlaybackStore`, `useQueueStore`); hooks in `mobapp/src/hooks/` |
| Database conventions | N/A — this feature has no database changes |
| Design system | `mobapp/src/components/common/` (`GlassCard`, `NeonButton`) and `mobapp/src/theme` |
| Reference implementation | `backend/app/Queries/Room/GetRoomDetailsQuery.php`; `mobapp/src/store/useRoomStore.ts` |
| Checks | `php artisan test`; `node --stack-size=16000 node_modules/typescript/bin/tsc --noEmit` in `mobapp`; `npx eslint <files>` in `mobapp`; `gradlew :app:compileDebugKotlin` in `mobapp/android` after `expo prebuild` |

---

## 2. Reuse Map

| Artifact | Searched | Found | Decision |
| --- | --- | --- | --- |
| `GET /api/v1/app/version` | `grep -rn "app/version" backend/routes` | NONE | CREATE — no version endpoint existed |
| `AppVersionRequest` | `ls backend/app/Http/Requests/V1` | sibling FormRequests (`SearchSongsRequest`) | CREATE — follows the sibling pattern; no existing request covers these fields |
| `GetAppVersionQuery` | `ls backend/app/Queries` | NONE for versions | CREATE |
| `EnforceAppVersion` | `ls backend/app/Http/Middleware` | `EnsureRoomHost` and siblings (different job) | CREATE |
| `useAppVersionStore` | `ls mobapp/src/store` | `useRoomStore.ts` pattern | CREATE following the persist pattern |
| `VersionUpdateModal` | `grep -rn "Modal" mobapp/src/components/common` | `GlassCard`, `NeonButton` | CREATE the modal, REUSE both components |
| Guest resume resync | `grep -n fetchInitialSync mobapp/src/hooks/useEchoRoom.ts` | `fetchInitialSync` | EXTEND — subscribe to `AppState` in the same hook |
| Host background heartbeat | `grep -n presenceTimer mobapp/src/hooks/useEchoRoom.ts` | existing presence interval | EXTEND — one condition |
| Foreground service, notification, headset and call events | `grep -rn "ForegroundService\|AudioFocus" mobapp/src mobapp/plugins` | NONE | CREATE — `withBackgroundPlayback.js` |
| Android PiP | `grep -rn "PictureInPicture" mobapp` | NONE | CREATE — `withPictureInPicture.js` |
| PiP layout | `mobapp/src/screens/HostPlayerScreen.tsx` fullscreen branch | `isFullscreen` layout | EXTEND — same layout driven by `isPipMode` |

---

## 3. File Change Map

| # | Path | Action | Task | Covers |
| --- | --- | --- | --- | --- |
| 1 | `backend/config/app_version.php` | Create | TASK-01 | FR-06 |
| 2 | `mobapp/app.json` | Modify | TASK-01, TASK-12, TASK-14 | FR-01, FR-02, FR-10 |
| 3 | `mobapp/src/types/index.ts` | Modify | TASK-01 | FR-06, FR-08 |
| 4 | `backend/app/Http/Requests/V1/AppVersionRequest.php` | Create | TASK-02 | FR-06, EC-01 |
| 5 | `backend/app/Queries/AppVersion/GetAppVersionQuery.php` | Create | TASK-03 | FR-06, EC-02 |
| 6 | `backend/app/Http/Controllers/Api/V1/AppVersionController.php` | Create | TASK-04 | FR-06 |
| 7 | `backend/routes/api.php` | Modify | TASK-04, TASK-05 | FR-06, FR-07 |
| 8 | `backend/app/Http/Middleware/EnforceAppVersion.php` | Create | TASK-05 | FR-07 |
| 9 | `backend/bootstrap/app.php` | Modify | TASK-05 | FR-07 |
| 10 | `backend/tests/Feature/AppVersionTest.php` | Create | TASK-06 | FR-06, FR-07 |
| 11 | `mobapp/src/api/client.ts` | Modify | TASK-07 | FR-07, FR-08 |
| 12 | `mobapp/src/store/useAppVersionStore.ts` | Create | TASK-08 | FR-08 |
| 13 | `mobapp/src/services/versionChecker.ts` | Create | TASK-09 | FR-08, FR-09 |
| 14 | `mobapp/src/components/common/VersionUpdateModal.tsx` | Create | TASK-10 | FR-08, FR-09 |
| 15 | `mobapp/src/screens/SplashScreen.tsx` | Modify | TASK-11 | FR-08 |
| 16 | `mobapp/App.tsx` | Modify | TASK-11 | FR-08 |
| 17 | `mobapp/plugins/withBackgroundPlayback.js` | Create | TASK-12 | FR-01, FR-02, FR-03 |
| 18 | `mobapp/src/services/backgroundPlayback.ts` | Create | TASK-13 | FR-01, FR-02, FR-03 |
| 19 | `mobapp/plugins/withPictureInPicture.js` | Create | TASK-14 | FR-10 |
| 20 | `mobapp/src/components/player/HostVideoPlayer.tsx` | Modify | TASK-15 | FR-01, FR-10, Flow 2 |
| 21 | `mobapp/src/screens/HostPlayerScreen.tsx` | Modify | TASK-16 | FR-01, FR-02, FR-03, FR-04, FR-10 |
| 22 | `mobapp/src/hooks/useEchoRoom.ts` | Modify | TASK-17 | FR-04, FR-05, NFR-03 |

---

## 4. Phase 1 — Preparation

- **Goal:** Configuration, permissions and types exist before any class uses them.
- **Exit check:** `php -l backend/config/app_version.php` passes and `tsc --noEmit` passes.

- [x] **TASK-01 — Config, permissions and types**
  - **Files:** `backend/config/app_version.php` (Create), `mobapp/app.json` (Modify), `mobapp/src/types/index.ts` (Modify)
  - **Change:** Config keys `latest_version`, `minimum_supported_version`, `download_url_android`, `download_url_ios`, `release_notes`, `is_ota_compatible`, `published_at`, each env-driven with `?:` fallbacks for the empty case. `android.permissions`: `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, `WAKE_LOCK`, `POST_NOTIFICATIONS`. Types `UpdateType` and `AppVersionData`.
  - **Covers:** FR-01, FR-02, FR-06, FR-08, EC-02
  - **Depends on:** None
  - **Done when:** the config returns the §14 defaults with no env set, and an empty `APP_RELEASE_NOTES` returns the default note

---

## 5. Phase 2 — Backend

- **Goal:** The version endpoint and the 426 gate respond as the §8 contract states.
- **Exit check:** `php artisan route:list --path=api/v1/app` lists the route; `php artisan test` passes.

- [x] **TASK-02 — AppVersionRequest**
  - **Files:** `backend/app/Http/Requests/V1/AppVersionRequest.php` (Create)
  - **Change:** Rules `platform: required|string|in:android,ios,web`; `current_version: required|string|regex:/^\d+\.\d+\.\d+$/`; `current_build: nullable|integer|min:1`. `messages()` returns "Invalid semver string format." for the three `current_version` rules.
  - **Covers:** FR-06, EC-01, AC-12
  - **Depends on:** None
  - **Done when:** `?current_version=bad` returns 422 with that message and code `VALIDATION_FAILED`

- [x] **TASK-03 — GetAppVersionQuery**
  - **Files:** `backend/app/Queries/AppVersion/GetAppVersionQuery.php` (Create)
  - **Change:** `execute(array $params)` caches the config for 60 s and compares with `version_compare`; returns `latest_version`, `minimum_supported_version`, `release_notes`, `update_type`, `download_url`, `is_ota_compatible`, `published_at`. `downloadUrl(string $platform)` is shared with the middleware.
  - **Covers:** FR-06, NFR-02, AC-12, AC-13, AC-14
  - **Depends on:** TASK-01
  - **Done when:** the three `update_type` values come back for the AC-12, AC-13 and AC-14 inputs

- [x] **TASK-04 — Controller and route**
  - **Files:** `backend/app/Http/Controllers/Api/V1/AppVersionController.php` (Create), `backend/routes/api.php` (Modify)
  - **Change:** `show(AppVersionRequest)` returns the success envelope; `GET /api/v1/app/version` named `api.v1.app.version`, outside the `app.version` middleware.
  - **Covers:** FR-06, AC-12
  - **Depends on:** TASK-02, TASK-03
  - **Done when:** `route:list` shows the route and an outdated client can still call it

- [x] **TASK-05 — EnforceAppVersion**
  - **Files:** `backend/app/Http/Middleware/EnforceAppVersion.php` (Create), `backend/bootstrap/app.php` (Modify), `backend/routes/api.php` (Modify)
  - **Change:** Middleware returns 426 with code `UPDATE_REQUIRED` and `errors.minimum_version`, `current_version`, `download_url` when `X-App-Version` is below the minimum. Alias `app.version` wraps `POST /rooms`, `POST /rooms/join` and the `room.member` group. `426 => 'UPDATE_REQUIRED'` in the HTTP exception code map.
  - **Covers:** FR-07, NFR-01, AC-15, AC-16
  - **Depends on:** TASK-03
  - **Done when:** `POST /api/v1/rooms` with `X-App-Version: 1.0.0` and minimum `1.1.0` returns 426

- [x] **TASK-06 — Backend tests**
  - **Files:** `backend/tests/Feature/AppVersionTest.php` (Create)
  - **Change:** Tests for the three `update_type` values, the 422 message, required `platform`, the 426 block, the pass-through case, and "outdated clients can still call `/app/version`".
  - **Covers:** AC-12, AC-13, AC-14, AC-15, AC-16, EC-01
  - **Depends on:** TASK-04, TASK-05
  - **Done when:** `php artisan test --filter=AppVersionTest` passes

---

## 6. Phase 3 — Frontend Integration

- **Goal:** The app checks versions, locks on a required update, and keeps the host playing in the background and in PiP.
- **Exit check:** `tsc --noEmit` passes; `expo prebuild --platform android` then `gradlew :app:compileDebugKotlin` passes.

- [x] **TASK-07 — API client headers and 426 handling**
  - **Files:** `mobapp/src/api/client.ts` (Modify)
  - **Change:** Export `CURRENT_APP_VERSION`; add `X-App-Version` and `X-Platform` to every request; on HTTP 426 or code `UPDATE_REQUIRED` call `triggerRequiredUpdate(minimum, url, CURRENT_APP_VERSION)`.
  - **Covers:** FR-07, FR-08
  - **Depends on:** TASK-08
  - **Done when:** an outdated client's room call opens the required modal

- [x] **TASK-08 — useAppVersionStore**
  - **Files:** `mobapp/src/store/useAppVersionStore.ts` (Create)
  - **Change:** State `versionInfo`, `isUpdateModalVisible`, `dismissedAtMs`, `dismissedVersion`, `isOtaReady`, `requiredUpdate`; `requiredUpdate`, `dismissedAtMs` and `dismissedVersion` persist to AsyncStorage; `closeUpdateModal` refuses while `update_type === 'required'`.
  - **Covers:** FR-08, EC-04, AC-17, AC-19
  - **Depends on:** TASK-01
  - **Done when:** a required result survives an app restart with the API unreachable

- [x] **TASK-09 — versionChecker**
  - **Files:** `mobapp/src/services/versionChecker.ts` (Create)
  - **Change:** `checkAppVersion` calls `GET /app/version`; `required` locks and stores the flag; `none` and `optional` clear it; optional respects the 24 h snooze; `is_ota_compatible` plus `expo-updates` downloads the bundle and offers a restart; a failed check re-opens the lock only for the same build.
  - **Covers:** FR-08, FR-09, EC-04, AC-18, AC-19, AC-20
  - **Depends on:** TASK-08
  - **Done when:** the three outcomes open the right modal state

- [x] **TASK-10 — VersionUpdateModal**
  - **Files:** `mobapp/src/components/common/VersionUpdateModal.tsx` (Create)
  - **Change:** Required: title "Update Required", one button, no backdrop dismissal, `onRequestClose` ignored. Optional: "Update Now", "Remind Me Later", "Continue". Release notes in a scroll box; "Restart App Now" when an OTA bundle is ready; "Update Now" opens `download_url`.
  - **Covers:** FR-08, FR-09, AC-17, AC-18, AC-21
  - **Depends on:** TASK-08
  - **Done when:** the three variants render with the labels above

- [x] **TASK-11 — Splash and app root**
  - **Files:** `mobapp/src/screens/SplashScreen.tsx` (Modify), `mobapp/App.tsx` (Modify)
  - **Change:** `SplashScreen` sets `resolved` first and starts `checkAppVersion()` without awaiting it; `App.tsx` mounts `<VersionUpdateModal />` inside the navigation container.
  - **Covers:** FR-08, Flow 3
  - **Depends on:** TASK-09, TASK-10
  - **Done when:** the splash navigates after 400 ms with the version endpoint unreachable

- [x] **TASK-12 — withBackgroundPlayback plugin**
  - **Files:** `mobapp/plugins/withBackgroundPlayback.js` (Create), `mobapp/app.json` (Modify)
  - **Change:** Generates `QueueMicPlaybackService` (foreground service, `foregroundServiceType="mediaPlayback"`, partial wake lock, ongoing notification with title, singer, room code and Play/Pause and Skip actions, `ACTION_AUDIO_BECOMING_NOISY` receiver, audio-mode listener for calls on API 31+), `QueueMicPlaybackModule` (`start`, `stop`) and `QueueMicPlaybackPackage`; declares the service in the manifest; registers the package in `MainApplication`; emits `onQueueMicPlaybackEvent` (`toggle`, `skip`, `noisy`, `call_started`, `call_ended`).
  - **Covers:** FR-01, FR-02, FR-03, EC-03, D-02, D-05
  - **Depends on:** TASK-01
  - **Done when:** the generated manifest has the `<service>` element and `compileDebugKotlin` passes

- [x] **TASK-13 — backgroundPlayback service wrapper**
  - **Files:** `mobapp/src/services/backgroundPlayback.ts` (Create)
  - **Change:** `startBackgroundService(details)` requests `POST_NOTIFICATIONS` once on Android 13+, starts the native service and the screen-awake flag; `stopBackgroundService` waits 5 s before stopping (`immediate` skips the wait); `subscribe` forwards native events.
  - **Covers:** FR-01, FR-02, FR-03, EC-03
  - **Depends on:** TASK-12
  - **Done when:** the module calls reach `NativeModules.QueueMicPlayback` on a device build

- [x] **TASK-14 — withPictureInPicture plugin**
  - **Files:** `mobapp/plugins/withPictureInPicture.js` (Create), `mobapp/app.json` (Modify)
  - **Change:** Sets `supportsPictureInPicture` and `resizeableActivity` on `MainActivity`; adds `onUserLeaveHint` (enters 16:9 PiP only when `QueueMicPipModule.pipEnabled`) and `onPictureInPictureModeChanged` (resumes Fabric mounting, emits `onPictureInPictureModeChanged`); generates `QueueMicPipModule` (`setPipEnabled`) and `QueueMicPipPackage`.
  - **Covers:** FR-10, D-04
  - **Depends on:** None
  - **Done when:** the generated `MainActivity.kt` contains the `pipEnabled` gate and `compileDebugKotlin` passes

- [x] **TASK-15 — HostVideoPlayer**
  - **Files:** `mobapp/src/components/player/HostVideoPlayer.tsx` (Modify)
  - **Change:** Host-only visibility lock and background `play` reinforcement (`followHost` skips both); auto-resume of unrequested pauses capped at 3 per 5 s; `isPictureInPicture` prop pins the video to the top via a `pip` body class toggled with `injectJavaScript`.
  - **Covers:** FR-01, FR-10, AC-25, Flow 2
  - **Depends on:** TASK-14
  - **Done when:** a guest's video pauses in the background and the host's keeps playing

- [x] **TASK-16 — HostPlayerScreen**
  - **Files:** `mobapp/src/screens/HostPlayerScreen.tsx` (Modify)
  - **Change:** Starts the foreground service while a song is on stage; subscribes to native events (`toggle` and `skip` call the existing handlers; `noisy` and `call_started` pause, `call_ended` resumes a call pause); sets `QueueMicPip.setPipEnabled(playbackState === 'playing')`; hides header, controls and queue when `isPipMode`.
  - **Covers:** FR-01, FR-02, FR-03, FR-04, FR-10, AC-04, AC-05, AC-06, AC-07, AC-23, AC-24, AC-25
  - **Depends on:** TASK-13, TASK-14, TASK-15
  - **Done when:** `tsc --noEmit` passes and each event reaches its handler

- [x] **TASK-17 — useEchoRoom**
  - **Files:** `mobapp/src/hooks/useEchoRoom.ts` (Modify)
  - **Change:** The presence interval also runs while the host is playing in the background; guests call `fetchInitialSync` on `background → active` after a random 0–500 ms delay.
  - **Covers:** FR-04, FR-05, NFR-03, AC-08, AC-10, AC-11
  - **Depends on:** None
  - **Done when:** a guest resume issues one delayed sync and no `join`

---

## 7. Phase 4 — Validation

- **Goal:** Every AC in spec §10 is exercised (§8) and the project's checks pass.
- **Exit check:** `php artisan test`, `tsc --noEmit` and `compileDebugKotlin` pass; the device scenarios in TASK-19 are run.

- [x] **TASK-18 — Automated checks**
  - **Files:** None — commands
  - **Change:** Run the backend suite, the typecheck and the Kotlin compile.
  - **Covers:** AC-12, AC-13, AC-14, AC-15, AC-16, AC-22
  - **Depends on:** TASK-06, TASK-16, TASK-17
  - **Done when:** all three pass

- [ ] **TASK-19 — Device scenarios**
  - **Files:** None — manual
  - **Change:** On a physical Android device run MT-01 to MT-05 plus the PiP checks for AC-23 to AC-25.
  - **Covers:** AC-01, AC-02, AC-03, AC-04, AC-05, AC-06, AC-07, AC-08, AC-09, AC-10, AC-20, AC-23, AC-24, AC-25
  - **Depends on:** TASK-18
  - **Done when:** each scenario in §8 marked Manual has a recorded result

---

## 8. Acceptance Walk

| AC | Exercised By | Command / Steps | Task |
| --- | --- | --- | --- |
| AC-01 | Manual | MT-01 | TASK-19 |
| AC-02 | Manual | MT-01 | TASK-19 |
| AC-03 | Manual | MT-01 | TASK-19 |
| AC-04 | Manual | MT-03 | TASK-19 |
| AC-05 | Manual | MT-03 | TASK-19 |
| AC-06 | Manual | MT-02 | TASK-19 |
| AC-07 | Manual | Call the host phone while playing | TASK-19 |
| AC-08 | Manual | MT-01, watch `POST …/heartbeat` for 60 s | TASK-19 |
| AC-09 | Manual | MT-01, watch `POST …/playback/state` for 30 s | TASK-19 |
| AC-10 | Manual | MT-04 | TASK-19 |
| AC-11 | Manual | MT-04, confirm no `join` request | TASK-19 |
| AC-12 | Automated | `php artisan test --filter=AppVersionTest` | TASK-06 |
| AC-13 | Automated | `php artisan test --filter=AppVersionTest` | TASK-06 |
| AC-14 | Automated | `php artisan test --filter=AppVersionTest` | TASK-06 |
| AC-15 | Automated | `php artisan test --filter=AppVersionTest` | TASK-06 |
| AC-16 | Automated | `php artisan test --filter=AppVersionTest` | TASK-06 |
| AC-17 | Manual | MT-05 | TASK-10 |
| AC-18 | Manual | Backend `latest` above the app version; launch | TASK-10 |
| AC-19 | Manual | Tap "Remind Me Later", reopen within 24 h | TASK-08 |
| AC-20 | Manual | Publish an EAS update with `APP_IS_OTA_COMPATIBLE=true` | TASK-19 |
| AC-21 | Manual | Tap "Update Now" with `is_ota_compatible: false` | TASK-10 |
| AC-22 | Automated | `php artisan test` and `tsc --noEmit` | TASK-18 |
| AC-23 | Manual | Host plays, press Home | TASK-19 |
| AC-24 | Manual | Guest, paused host and `Home` screen press Home; tap "Update Now" | TASK-19 |
| AC-25 | Manual | Look at the PiP window, then expand it | TASK-19 |

---

## 9. Commands for the User

| Order | Command / Action | When | Rollback |
| --- | --- | --- | --- |
| 1 | Set `APP_LATEST_VERSION`, `APP_MIN_SUPPORTED_VERSION`, `APP_UPDATE_URL_ANDROID`, `APP_UPDATE_URL_IOS`, `APP_RELEASE_NOTES` in the backend `.env`, then `php artisan config:clear` | after TASK-01 | Restore the previous values and clear the config cache |
| 2 | `npx expo prebuild --platform android` in `mobapp` | after TASK-12 and TASK-14 | `Remove-Item -Recurse -Force android`, then run prebuild again |
| 3 | `npx expo run:android` (a native rebuild; `android/local.properties` needs `sdk.dir` or `ANDROID_HOME` set) | after the prebuild | N/A — reinstall the previous build |
| 4 | `eas build` for the release | before publishing 1.1.0 | N/A — publish the previous build |

---

## 10. Plan Change Log

> - **Spec Minor change** that affects the plan: edit the affected tasks in place, bump **Plan Revision**, add a row. **Based on Spec Version** is unchanged.
> - **Spec Major change**: bring the plan to the new version, set **Based on Spec Version** to it, bump **Plan Revision**, add a row.
> - **Plan-only correction** (wrong path, missing task, wrong order; the spec is right): edit in place, bump **Plan Revision**, add a row.
> - A task already ticked `[x]` is never edited or unticked. A change to finished work is a new task appended to its phase.

| Plan Revision | Date | Spec Version | Change | Changed Tasks |
| --- | --- | --- | --- | --- |
| 1 | 2026-10-11 | 1.1 | Created plan after implementation; tasks that already exist in the code are ticked, TASK-19 (device scenarios) is open | All |
