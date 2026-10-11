# Feature Specification — Background Playback & Automatic Version Checking

## Metadata

| Field | Value |
| --- | --- |
| Project Name | queuemic |
| Ticket Number | T00002 |
| Feature Name | Background Playback & Automatic Version Checking |
| Created Date | 2026-10-11 |
| Specification Version | 1.1 |
| Status | Draft |

---

## 1. Overview

- **What is being built:** A native-level background execution lifecycle engine for host and guest mobile clients alongside a configuration-driven version check and enforcement system.
- **Problem it solves:** Host playback halts immediately whenever the application loses foreground focus (answering chats, pressing home, or screen lock), and outdated clients cause synchronization failures without upgrade notices.
- **Why this feature exists:** Karaoke session hosts need uninterrupted music and Bluetooth streaming while multitasking on their mobile device, and room participants require guaranteed protocol compatibility through automatic version checking.

---

## 2. Objective

### Main Goals

1. Maintain uninterrupted host audio streaming, Bluetooth output, WebSocket connectivity, and periodic playback state synchronization when the mobile application is backgrounded or the screen is locked.
2. Enable seamless background/foreground transitions for guests, ensuring instant queue and playback position re-synchronization upon returning without duplicate presence events.
3. Provide an automated version verification workflow on app startup and foreground resume, supporting optional updates, non-dismissible required updates, and Expo Over-The-Air (OTA) runtime updates.
4. Enforce client version compatibility on the Laravel backend via API request header inspection to prevent protocol divergence and unauthorized room operations from legacy clients.

### Expected Outcome

When a room host presses the Home button, turns off the display, or switches to messaging apps, audio playback continues continuously, Bluetooth devices remain connected, the Android notification drawer displays active playback details, and guests continue hearing/seeing synchronized room playback. When any user opens QueueMic, the app checks the version against the backend API; users on outdated versions are guided to update (optionally or mandatorily), and backend endpoints reject outdated clients attempting room operations.

### Success Criteria

| ID | Criterion | Target | Measured By |
| --- | --- | --- | --- |
| SC-01 | Host background playback continuity | Zero audio dropouts for >= 15 minutes while app is in background with display locked | Automated background duration test and manual QA stopwatch check on Android 12+ device |
| SC-02 | Guest foreground resync latency | Live queue and playback position synchronized within <= 1,200 ms of app resume | Performance timestamp logging (`AppState` change to UI render complete) |
| SC-03 | Host presence preservation in background | Zero false-positive room closures while host is in background during an active song | Laravel room cleanup audit logs; room remains active for 30+ minutes |
| SC-04 | Enforced version gate accuracy | 100% of API requests from clients with version < minimum supported version rejected with HTTP 426 | PHPUnit integration test suite against `EnforceAppVersion` middleware |
| SC-05 | Version check endpoint response time | p95 response time < 50 ms under concurrent load | Load test against `GET /api/v1/app/version` with cached response |

---

## 3. Background and Motivation

- **Current limitation:** In `mobapp/src/screens/HostPlayerScreen.tsx` and `mobapp/src/components/player/HostVideoPlayer.tsx`, playback relies on `react-native-webview` rendering the YouTube IFrame API. When the app enters the background, Android halts WebView JavaScript execution and timers, pausing audio. Furthermore, in `mobapp/src/hooks/useEchoRoom.ts:243`, the presence heartbeat explicitly checks `if (AppState.currentState !== 'active') return;`, causing the host heartbeat to stop when backgrounded and leaving the room vulnerable to server cleanup. Currently, there is also no version endpoint in `backend/routes/api.php` or version checking in `mobapp/src/screens/SplashScreen.tsx`.
- **Business or technical reason:** Mobile users routinely switch apps to check messages, capture photos, or lock their screens to conserve battery while hosting a karaoke party. Halting playback breaks the party experience. Additionally, as API contracts evolve, running older mobile builds causes desynchronized state and silent errors.
- **Why this solution is needed:** An Android Foreground Service with audio focus management and persistent media notification keeps the OS from throttling CPU, network sockets, and WebView audio decoding. A centralized backend version check paired with client-side modal alerts and API-level version enforcement ensures a reliable party session and clean application upgrade lifecycle.

---

## 4. Scope

### Included

- **Android Background Service Plugin (New):** Expo config plugin / native module configuration enabling Android Foreground Service (`FOREGROUND_SERVICE_MEDIA_PLAYBACK`), partial wake lock (`WAKE_LOCK`), and WebView background audio configuration.
- **Audio Focus & Hardware Lifecycle Management:** Handlers for incoming calls (`AUDIOFOCUS_LOSS_TRANSIENT`), Bluetooth disconnects (`ACTION_AUDIO_BECOMING_NOISY`), and screen lock states.
- **Media Notification (Host):** Ongoing Android notification displaying current song title, requester nickname, room code, and Play/Pause/Skip action triggers.
- **Background Presence & Sync Retention:** Updating `mobapp/src/hooks/useEchoRoom.ts` and `mobapp/src/screens/HostPlayerScreen.tsx` to maintain presence heartbeats and playback state reporting while in the background if actively playing.
- **Guest Catch-Up Reconciliation:** Guest background suspension and immediate state re-sync upon returning to the foreground without duplicate presence events.
- **Android Picture-in-Picture (Host, v1.1):** When the host leaves the app while a song is playing, `MainActivity` enters Android PiP (16:9) and `HostPlayerScreen` renders only the video in the floating window. PiP is gated by a flag the app sets only while the host is playing.
- **Backend Version Configuration & API:** New configuration `backend/config/app_version.php`, query class `GetAppVersionQuery`, controller `AppVersionController`, and endpoint `GET /api/v1/app/version`.
- **Backend API Version Enforcement Middleware:** `EnforceAppVersion` middleware checking `X-App-Version` on room mutating routes, returning HTTP `426 Upgrade Required` when outdated.
- **Mobile Version Checker Service & Store:** `mobapp/src/services/versionChecker.ts` and `mobapp/src/store/useAppVersionStore.ts` integrating with `expo-constants` and `expo-updates`.
- **Version Modal Component:** `mobapp/src/components/common/VersionUpdateModal.tsx` providing Optional and Mandatory update dialogues, release notes rendering, and store redirect.

### Not Included

- **iOS Background Audio via WebView Hack:** iOS Safari WebViews strictly terminate background media playback for unapproved streaming iframes per WebKit sandbox policy. iOS background playback for YouTube iframes requires picture-in-picture (PiP) or native AVPlayer audio, which is deferred to T00003. Android PiP is not part of this item: it is included above (v1.1).
- **Local Audio Caching / Offline Song Storage:** Songs are streamed dynamically via YouTube Data API and iframe streaming; offline caching is out of scope.
- **In-App Store APK Self-Installer:** Applications will direct users to the official Google Play Store or APK distribution URL via `Linking.openURL`, not self-extracting APKs.

---

## 5. User Flow

### Flow 1 — Host Leaves App During Playback (Host)

**Entry point:** Host is actively playing a karaoke track on `HostPlayerScreen`.

| Step | User Action | System Behavior | Expected Result |
| --- | --- | --- | --- |
| 1 | Host minimizes app (presses Home, opens Messenger, or presses power button to lock screen). | `AppState` transitions from `active` to `background`. Host audio continues playing. Foreground service starts/continues with ongoing media notification. CPU wake lock held. | Song continues playing through phone speaker or Bluetooth. Lock screen/notification shade displays song title, singer, and room code. |
| 2 | Host pauses song via Lock Screen notification action. | Notification intent dispatches `PAUSE` command to background service bridge. Video/audio pauses. Playback state broadcast sent to server. | Audio stops. Notification updates action button to "Play". Guests receive pause broadcast. |
| 3 | Host taps QueueMic notification or reopens app from app switcher. | App enters `active` state. Foreground service notification remains active while playing. Video view restores synchronously. | Host returns to `HostPlayerScreen` showing current timestamp, exact playback controls, and queue. |

**Failure paths:**
- Step 1, when Bluetooth headphone/speaker disconnects while backgrounded: Android OS fires `ACTION_AUDIO_BECOMING_NOISY` → System immediately pauses playback, updates state to `paused`, and notifies room via Reverb broadcast → Audio does not blast through device speakers.
- Step 1, when an incoming phone call arrives: Audio manager receives `AUDIOFOCUS_LOSS_TRANSIENT` → Playback pauses → On call termination, audio focus is regained and playback resumes automatically.

---

### Flow 2 — Guest Backgrounding and Re-Entering Room (Guest)

**Entry point:** Guest is in `GuestRoomScreen` while a song is playing.

| Step | User Action | System Behavior | Expected Result |
| --- | --- | --- | --- |
| 1 | Guest minimizes app to browse web or reply to chats. | `AppState` transitions to `background`. WebSocket listeners remain passive or enter low-power sleep; local video iframe is paused/muted to save battery. | App is minimized; guest device consumes minimal resources. |
| 2 | In the background, host skips song or other guests add tracks. | Backend broadcasts events over Reverb; guest may miss intermediate socket frames while sleeping. | Backend database maintains latest room state. |
| 3 | Guest re-opens QueueMic. | `AppState` transitions to `active`. Hook triggers lightweight `fetchInitialSync()`. | Screen instantly renders the updated queue, current playing song, active singer, and synced playback position. |

**Failure paths:**
- Step 3, when network is unavailable upon resume: Offline banner appears at top of `GuestRoomScreen` → Automatic retry triggers via `NetInfo` listener upon network restoration.

---

### Flow 3 — Application Launch Version Verification (All Users)

**Entry point:** User launches the QueueMic mobile app (`SplashScreen`).

| Step | User Action | System Behavior | Expected Result |
| --- | --- | --- | --- |
| 1 | App opens and displays `SplashScreen`. | Mobile app retrieves local version from `Constants.expoConfig.version` and calls `GET /api/v1/app/version`. | Backend compares client version against `latest_version` and `minimum_supported_version`. |
| 2a | No update required (Client version == Latest version). | Backend returns `update_type: "none"`. | Splash screen proceeds to regular session check and navigates to `Home` or active room. |
| 2b | Optional update available (Client version >= Minimum, but < Latest). | Backend returns `update_type: "optional"`. Client checks if dismissed in last 24 hours. | If not suppressed, `VersionUpdateModal` appears offering "Update Now", "Remind Me Later", and "Continue". |
| 2c | Mandatory update required (Client version < Minimum). | Backend returns `update_type: "required"`. | Non-dismissible `VersionUpdateModal` displays with release notes and a single "Update App Now" button. User cannot bypass. |

**Failure paths:**
- Step 1, when version check endpoint times out or device is offline: Client checks local cache/AsyncStorage. If previously flagged as mandatory update, keeps lock; otherwise logs warning and permits offline navigation to prevent bricking the app during network outages.

---

## 6. Functional Requirements

### FR-01 — Host Background Audio & Service Persistence
- **Requirement ID:** FR-01
- **Description:** The mobile app must maintain active audio playback and process execution when the host moves the app to the background or locks the screen.
- **Expected Behavior:** Android Foreground Service with type `mediaPlayback` runs during active host playback. `react-native-webview` media engine is configured not to suspend playback on activity pause. CPU wake lock prevents device sleep.
- **Verified by:** AC-01, AC-02, AC-03

### FR-02 — Persistent Media Notification Controls
- **Requirement ID:** FR-02
- **Description:** Display an ongoing media notification in the Android system drawer during host playback.
- **Expected Behavior:** Notification displays current song title, requester name, room code, and interactive buttons: Play/Pause, and Skip (Host only). Tapping notification opens `HostPlayerScreen`. Notification dismisses automatically when host leaves room or closes playback session.
- **Verified by:** AC-04, AC-05

### FR-03 — Audio Focus & Headset Disconnect Handling
- **Requirement ID:** FR-03
- **Description:** Automatically manage playback state based on hardware and OS audio events.
- **Expected Behavior:** When audio becomes noisy (Bluetooth/headset disconnected), playback transitions to `paused` and broadcasts to room. When an incoming phone call occurs, playback pauses and resumes upon call completion.
- **Verified by:** AC-06, AC-07

### FR-04 — Background Presence Heartbeat and Playback Sync
- **Requirement ID:** FR-04
- **Description:** Host device must continue reporting presence heartbeat and playback position to Laravel backend while backgrounded.
- **Expected Behavior:** `useEchoRoom.ts` heartbeat interval continues transmitting `POST /rooms/{code}/heartbeat` every 60 seconds while backgrounded if user is Host. `HostPlayerScreen.tsx` continues transmitting `POST /rooms/{code}/playback/state` every 30 seconds while actively playing.
- **Verified by:** AC-08, AC-09

### FR-05 — Guest Foreground Catch-Up Reconciliation
- **Requirement ID:** FR-05
- **Description:** Guests returning to the app must instantly reconcile state without creating redundant presence connections.
- **Expected Behavior:** On transition from `background` to `active`, the guest executes `fetchInitialSync()` once to reconcile queue, playback position, and active singer. No duplicate WebSocket subscription is initiated.
- **Verified by:** AC-10, AC-11

### FR-06 — Backend Version Check API
- **Requirement ID:** FR-06
- **Description:** Provide an unauthenticated REST endpoint returning latest version, minimum supported version, release notes, update type, and store URLs.
- **Expected Behavior:** `GET /api/v1/app/version` accepts `platform` and `current_version`, evaluates semantic versions, and returns `update_type` (`none`, `optional`, `required`) with HTTP 200.
- **Verified by:** AC-12, AC-13, AC-14

### FR-07 — Backend API Version Enforcement Middleware
- **Requirement ID:** FR-07
- **Description:** Enforce minimum application version on room mutating endpoints via middleware.
- **Expected Behavior:** Middleware `EnforceAppVersion` inspects incoming `X-App-Version` header. If version is lower than configured `minimum_supported_version`, rejects request with HTTP 426 and error code `UPDATE_REQUIRED`.
- **Verified by:** AC-15, AC-16

### FR-08 — Client Version Check & Modal Dialog Flow
- **Requirement ID:** FR-08
- **Description:** Prompt users with appropriate modal interfaces based on version check results.
- **Expected Behavior:** Displays `VersionUpdateModal` with release notes. Optional updates allow "Remind Me Later" (suppressing for 24h) or "Continue". Required updates prevent dismissal, lock room interactions, and provide an external link to update.
- **Verified by:** AC-17, AC-18, AC-19

### FR-09 — Expo Over-The-Air (OTA) Compatibility Differentiation
- **Requirement ID:** FR-09
- **Description:** Differentiate between native binary store updates and JavaScript OTA updates.
- **Expected Behavior:** If backend indicates `is_ota_compatible: true` and an Expo update is available via `expo-updates`, download JS bundle and prompt user to reload app instead of redirecting to app store.
- **Verified by:** AC-20, AC-21

### FR-10 — Android Picture-in-Picture for the Host (v1.1)
- **Requirement ID:** FR-10
- **Description:** Keep the karaoke video visible in a floating window when the host leaves the app during playback.
- **Expected Behavior:** While `playbackState === 'playing'` on `HostPlayerScreen`, pressing Home enters Android PiP (16:9). In the PiP window the screen hides the header, controls and queue and shows only the video, pinned to the top of the window. PiP never starts for a guest, on any other screen, while paused, or when the app launches another app (for example the store from "Update Now"). Leaving PiP restores the normal layout without restarting the song.
- **Verified by:** AC-23, AC-24, AC-25

---

## 7. Non Functional Requirements

| ID | Category | Requirement | Target / Limit |
| --- | --- | --- | --- |
| NFR-01 | Security | API version validation and header spoofing defense | Rejects requests with malformed semver strings; enforces version check server-side on all room mutations |
| NFR-02 | Performance | Version check response time | p95 < 50 ms via in-memory cache (`Cache::remember('app_version_config', 60, ...)`)|
| NFR-03 | Scalability | Reconnection spike mitigation | Exponential jitter (0–500 ms) added to guest reconciliation on mass resume |
| NFR-04 | Maintainability | Follows Clean Architecture backend and modular mobile architecture | New backend code in `app/Queries/AppVersion/` and `app/Http/Controllers/Api/V1/AppVersionController.php` |
| NFR-05 | Reliability | Crash and freeze prevention during background transitions | No fatal uncaught exceptions on missing audio focus or background service death |

---

## 8. Technical Design

### Architecture

- **Where it fits:** Mobile Client (`mobapp/src/services/`, `mobapp/src/components/common/`, `mobapp/src/store/`) and Laravel Backend (`app/Queries/AppVersion/`, `app/Http/Controllers/Api/V1/`, `app/Http/Middleware/`).
- **Pattern followed:** Clean Architecture (Action / Query / Controller) on backend; Zustand stores and custom React hooks on frontend.
- **Reference:** `backend/app/Queries/Room/GetRoomDetailsQuery.php` and `mobapp/src/store/useRoomStore.ts`.

| Component | Status | Path |
| --- | --- | --- |
| `AppVersionConfig` | New | `backend/config/app_version.php` |
| `GetAppVersionQuery` | New | `backend/app/Queries/AppVersion/GetAppVersionQuery.php` |
| `AppVersionController` | New | `backend/app/Http/Controllers/Api/V1/AppVersionController.php` |
| `EnforceAppVersion` | New | `backend/app/Http/Middleware/EnforceAppVersion.php` |
| `BackgroundPlaybackManager` | New | `mobapp/src/services/backgroundPlayback.ts` |
| `useAppVersionStore` | New | `mobapp/src/store/useAppVersionStore.ts` |
| `VersionUpdateModal` | New | `mobapp/src/components/common/VersionUpdateModal.tsx` |
| `HostVideoPlayer` | Extended | `mobapp/src/components/player/HostVideoPlayer.tsx` |
| `useEchoRoom` | Extended | `mobapp/src/hooks/useEchoRoom.ts` |
| `HostPlayerScreen` | Extended | `mobapp/src/screens/HostPlayerScreen.tsx` |
| `SplashScreen` | Extended | `mobapp/src/screens/SplashScreen.tsx` |
| `apiClient` | Extended | `mobapp/src/api/client.ts` |
| `withBackgroundPlayback` (config plugin) | New | `mobapp/plugins/withBackgroundPlayback.js` — generates `QueueMicPlaybackService` (foreground service, notification, headset and call detection), `QueueMicPlaybackModule` and `QueueMicPlaybackPackage` into the app package, and declares the service in the manifest |
| `withPictureInPicture` (config plugin) | New | `mobapp/plugins/withPictureInPicture.js` — `MainActivity` PiP entry, the `QueueMicPip` bridge (`setPipEnabled`) and the PiP-mode event |

### Frontend

**Pages and components**

| Name | Path | Status | Responsibility |
| --- | --- | --- | --- |
| `VersionUpdateModal` | `mobapp/src/components/common/VersionUpdateModal.tsx` | New | Displays optional/mandatory version update dialogues and release notes |
| `HostVideoPlayer` | `mobapp/src/components/player/HostVideoPlayer.tsx` | Extended | Configures WebView props for background media and audio focus events |
| `HostPlayerScreen` | `mobapp/src/screens/HostPlayerScreen.tsx` | Extended | Binds background playback manager lifecycle and notification triggers |
| `SplashScreen` | `mobapp/src/screens/SplashScreen.tsx` | Extended | Initiates version check before navigating to Home/Room |
| `GuestRoomScreen` | `mobapp/src/screens/GuestRoomScreen.tsx` | Extended | Integrates AppState listener for catch-up resync |

**State**

| State | Location | Shape | Updated When |
| --- | --- | --- | --- |
| `versionInfo` | `mobapp/src/store/useAppVersionStore.ts` | `{ latest: string, minimum: string, updateType: 'none'\|'optional'\|'required', releaseNotes: string, downloadUrl: string, isOtaCompatible: boolean }` | On completion of version check API |
| `dismissedUpdateVersion` | `mobapp/src/store/useAppVersionStore.ts` | `{ version: string, dismissedAtMs: number }` | When user clicks "Remind Me Later" |
| `isBackgroundServiceActive` | `mobapp/src/store/usePlaybackStore.ts` | `boolean` | When host background playback starts/stops |

**API interaction**

| Trigger | Endpoint | Loading State | On Success | On Error |
| --- | --- | --- | --- | --- |
| App launch / resume | `GET /api/v1/app/version` | Transparent / non-blocking spinner | Sets `useAppVersionStore`, opens modal if update required | Logs warning, falls back to cached/safe state |
| Any room API call | All room routes | Standard | Request succeeds | If HTTP 426, opens mandatory update modal immediately |

### Backend

**Endpoints**

| Method | Route | Route Name | Handler | Access |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/app/version` | `api.v1.app.version` | `AppVersionController@show` | Public (Unauthenticated) |

**Classes**

| Class | Path | Status | Responsibility |
| --- | --- | --- | --- |
| `AppVersionController` | `backend/app/Http/Controllers/Api/V1/AppVersionController.php` | New | Handles version check endpoint |
| `GetAppVersionQuery` | `backend/app/Queries/AppVersion/GetAppVersionQuery.php` | New | Evaluates semver against config and returns version payload |
| `EnforceAppVersion` | `backend/app/Http/Middleware/EnforceAppVersion.php` | New | Rejects requests with HTTP 426 if `X-App-Version` is below minimum |

**Request / response contract** — `GET /api/v1/app/version`

```jsonc
// Query Parameters
// ?platform=android&current_version=1.0.0&current_build=1
```

```jsonc
// 200 Success — Optional / Required Update
{
  "success": true,
  "data": {
    "latest_version": "1.1.0",
    "minimum_supported_version": "1.0.0",
    "release_notes": "• Background audio playback for Host\n• Bluetooth disconnect auto-pause\n• Automatic update notification\n• Performance and synchronization improvements",
    "update_type": "optional", // "none" | "optional" | "required"
    "download_url": "https://play.google.com/store/apps/details?id=com.queuemic.app",
    "is_ota_compatible": false,
    "published_at": "2026-10-11T00:00:00Z"
  },
  "message": "Version check completed."
}
```

```jsonc
// 426 Upgrade Required (Returned by EnforceAppVersion Middleware)
{
  "success": false,
  "message": "Your version of QueueMic is no longer supported. Please update to continue.",
  "code": "UPDATE_REQUIRED",
  "errors": {
    "minimum_version": "1.1.0",
    "current_version": "0.9.0",
    "download_url": "https://play.google.com/store/apps/details?id=com.queuemic.app"
  }
}
```

**Processing logic**

1. Validate input query parameters (`platform` in `android,ios,web`, `current_version` formatted as valid semver string).
2. Retrieve version settings from `config/app_version.php` cached via `Cache::remember('app_version_config', 60, ...)`.
3. Compare `current_version` against `minimum_supported_version` using `version_compare`. If `current < minimum`, set `update_type = 'required'`.
4. Else, compare `current_version` against `latest_version`. If `current < latest`, set `update_type = 'optional'`. Otherwise set `update_type = 'none'`.
5. Return JSON envelope with HTTP 200.

### Database

**Tables**

| Table | Status | Purpose |
| --- | --- | --- |
| N/A | N/A — Configuration is file-based and env-driven (`config/app_version.php`) for high-throughput and zero migration overhead | N/A — No database changes required |

**Fields**

| Table.Column | Type | Nullable | Default | Index / Constraint | Notes |
| --- | --- | --- | --- | --- | --- |
| N/A | N/A | N/A | N/A | N/A | N/A — No database changes required |

**Relationships:** N/A — No database changes required

**Migrations**

| Migration | Up | Down (rollback) |
| --- | --- | --- |
| N/A | N/A — Configuration driven | N/A |

**Data backfill / seed:** N/A — Configuration driven via `backend/config/app_version.php`.

### External Services

| Service | Purpose | Interface | Auth | Timeout / Retry | On Failure |
| --- | --- | --- | --- | --- | --- |
| Google Play Store / App Store | Destination for app updates | System URL via `Linking.openURL` | None | OS browser/store handle | User notified with manual copyable URL |
| Expo Updates (EAS) | JavaScript bundle OTA updates | `expo-updates` SDK API | EAS Project Token | 10s timeout, 1 retry | Fall back to current installed bundle |
| Laravel Reverb / Pusher | Real-time presence and sync | WebSocket protocol | Sanctum/Session token | Auto-reconnect with exponential backoff | Trigger HTTP fallback snapshot on reconnect |

---

## 9. Implementation Plan

### Phase 1 — Preparation & Configuration
- **Goal:** Set up configuration files, define types, and install required native permissions/plugins.
- **Tasks:**
  - [ ] Create `backend/config/app_version.php` with default versions and release notes (FR-06).
  - [ ] Add Android permissions (`FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, `WAKE_LOCK`, `POST_NOTIFICATIONS`) to `mobapp/app.json` (FR-01, FR-02).
  - [ ] Define TypeScript types for Version Info and Background Playback in `mobapp/src/types/index.ts` (FR-06, FR-08).
- **Expected Output:** Configuration file exists in backend; `app.json` updated with Android permissions.

### Phase 2 — Backend Implementation
- **Goal:** Implement the version check endpoint and enforcement middleware.
- **Tasks:**
  - [ ] Implement `GetAppVersionQuery` in `backend/app/Queries/AppVersion/GetAppVersionQuery.php` (FR-06).
  - [ ] Create `AppVersionController` in `backend/app/Http/Controllers/Api/V1/AppVersionController.php` (FR-06).
  - [ ] Register route `GET /api/v1/app/version` in `backend/routes/api.php` (FR-06).
  - [ ] Create middleware `EnforceAppVersion` in `backend/app/Http/Middleware/EnforceAppVersion.php` (FR-07).
  - [ ] Register `app.version` middleware alias in `backend/bootstrap/app.php` and attach to room routes (FR-07).
  - [ ] Write PHPUnit tests in `backend/tests/Feature/AppVersionTest.php` covering query, controller, and middleware (FR-06, FR-07).
- **Expected Output:** Version endpoint returns accurate semver comparisons; middleware returns HTTP 426 for outdated clients; tests pass.

### Phase 3 — Mobile Frontend Implementation
- **Goal:** Implement background playback lifecycle management, notification service, and version modal.
- **Tasks:**
  - [ ] Update `mobapp/src/api/client.ts` to attach `X-App-Version` header on all outgoing API requests (FR-07).
  - [ ] Create `mobapp/src/store/useAppVersionStore.ts` with AsyncStorage persistence for dismissed version prompts (FR-08).
  - [ ] Implement `mobapp/src/services/versionChecker.ts` combining API check with `expo-updates` OTA detection (FR-06, FR-08, FR-09).
  - [ ] Create `mobapp/src/components/common/VersionUpdateModal.tsx` supporting optional and required update states (FR-08).
  - [ ] Integrate version check into `mobapp/src/screens/SplashScreen.tsx` (FR-08).
  - [ ] Create `mobapp/src/services/backgroundPlayback.ts` managing Foreground Service, notification updates, audio focus, and noisy audio events (FR-01, FR-02, FR-03).
  - [ ] Update `mobapp/src/components/player/HostVideoPlayer.tsx` to enable background playback props in WebView (FR-01).
  - [ ] Update `mobapp/src/screens/HostPlayerScreen.tsx` to activate background service on song play and stop on room leave/end (FR-01, FR-02).
  - [ ] Update `mobapp/src/hooks/useEchoRoom.ts` to continue presence heartbeat when backgrounded if role is host and actively playing (FR-04).
  - [ ] Update `mobapp/src/screens/GuestRoomScreen.tsx` to execute `fetchInitialSync()` on `AppState` transition from `background` to `active` (FR-05).
- **Expected Output:** Background playback service starts when host plays; notification controls respond; version modal displays on outdated app versions.

### Phase 4 — Testing & Verification
- **Goal:** Verify end-to-end background stability and version check enforcement.
- **Tasks:**
  - [ ] Test host background playback continuity for 15+ minutes with locked screen (AC-01, AC-02, AC-03).
  - [ ] Test incoming call and Bluetooth disconnect behavior (AC-06, AC-07).
  - [ ] Test notification Play/Pause and Skip actions (AC-04, AC-05).
  - [ ] Test guest backgrounding and foreground re-sync (AC-10, AC-11).
  - [ ] Test API version endpoint and middleware with mock client versions (AC-12, AC-15).
  - [ ] Run full test suite: `php artisan test` and `npx tsc --noEmit` (AC-22).
- **Expected Output:** All acceptance criteria satisfied; zero TypeScript compilation errors; test suite green.

---

## 10. Acceptance Criteria

| ID | Covers | Given | When | Then |
| --- | --- | --- | --- | --- |
| AC-01 | FR-01 | Host is playing a song on `HostPlayerScreen` | Host minimizes app by pressing Home | Audio continues playing continuously; `AppState` becomes `background` |
| AC-02 | FR-01 | Host is playing a song on `HostPlayerScreen` | Host turns off screen using device power button | Audio continues playing through speakers/Bluetooth without stuttering |
| AC-03 | FR-01 | Host is playing a song in the background | Host opens Messenger or Facebook for 5 minutes | Song continues playing; playback session does not terminate |
| AC-04 | FR-02 | Host is playing a song in the background | Host pulls down Android notification drawer | Persistent notification shows song title, requester name, room code, and Play/Pause/Skip buttons |
| AC-05 | FR-02 | Song is playing in background with active notification | Host taps "Pause" on notification | Audio pauses; notification button switches to "Play"; room playback state becomes `paused` |
| AC-06 | FR-03 | Song is playing through Bluetooth headphones | Bluetooth headphones are turned off / disconnected | Audio pauses immediately (`ACTION_AUDIO_BECOMING_NOISY`); room state updates to `paused` |
| AC-07 | FR-03 | Song is playing in background | An incoming phone call rings on host device | Audio pauses for duration of call; resumes when call terminates |
| AC-08 | FR-04 | Host is in background during an active song | 60 seconds elapse | Client dispatches `POST /api/v1/rooms/{code}/heartbeat` with HTTP 200 response |
| AC-09 | FR-04 | Host is in background during an active song | 30 seconds elapse | Client dispatches `POST /api/v1/rooms/{code}/playback/state` with current extrapolated position |
| AC-10 | FR-05 | Guest minimizes app for 2 minutes while queue advances | Guest re-opens QueueMic app | Queue list, currently playing song, and singer name match server state within 1,200 ms |
| AC-11 | FR-05 | Guest re-enters app from background | App transitions to `active` | Client does not send duplicate `join` or re-subscribe duplicate Pusher channels |
| AC-12 | FR-06 | Backend configured with `min=1.0.0`, `latest=1.1.0` | Client requests `GET /api/v1/app/version?platform=android&current_version=1.0.0` | Returns HTTP 200 with `update_type: "optional"` and release notes string |
| AC-13 | FR-06 | Backend configured with `min=1.1.0`, `latest=1.1.0` | Client requests `GET /api/v1/app/version?platform=android&current_version=1.0.0` | Returns HTTP 200 with `update_type: "required"` |
| AC-14 | FR-06 | Backend configured with `min=1.0.0`, `latest=1.0.0` | Client requests `GET /api/v1/app/version?platform=android&current_version=1.0.0` | Returns HTTP 200 with `update_type: "none"` |
| AC-15 | FR-07 | Backend configured with `min=1.1.0` | Client sends `POST /api/v1/rooms/join` with header `X-App-Version: 1.0.0` | Request rejected with HTTP 426, code `UPDATE_REQUIRED`, and store download URL |
| AC-16 | FR-07 | Backend configured with `min=1.1.0` | Client sends `POST /api/v1/rooms/join` with header `X-App-Version: 1.1.0` | Request passes middleware and executes join action successfully |
| AC-17 | FR-08 | App launches on device with outdated version (required) | `SplashScreen` completes version check | Modal appears with title "Update Required", non-dismissible, backdrop clicks ignored, back button disabled |
| AC-18 | FR-08 | App launches on device with optional update | `SplashScreen` completes version check | Modal appears with "Update Now", "Remind Me Later", and "Continue" buttons |
| AC-19 | FR-08 | User clicks "Remind Me Later" on optional update modal | Modal closes; user continues using app | Dismissed timestamp saved; modal does not reappear on subsequent opens for 24 hours |
| AC-20 | FR-09 | Version check indicates `is_ota_compatible: true` | Expo updates service finds matching JS bundle | App downloads bundle in background and displays "Restart to Apply Update" prompt |
| AC-21 | FR-09 | Version check indicates `is_ota_compatible: false` | User clicks "Update Now" | System browser or Google Play Store launches pointing directly to `download_url` |
| AC-22 | NFR-04 | All codebase files modified/created | Developer runs `npx tsc --noEmit` and `php artisan test` | Zero type errors and 100% feature test passes |
| AC-23 | FR-10 | Host is on `HostPlayerScreen` with a song playing | Host presses Home | The app enters Android PiP (16:9) and the video keeps playing |
| AC-24 | FR-10 | A guest is in a room, or the host's song is paused, or the user is on `Home` | The user presses Home, or taps "Update Now" | The app does not enter PiP |
| AC-25 | FR-10 | Host is in PiP | The floating window is visible | Only the video is shown, starting at the top edge of the window; no header, controls or queue. Leaving PiP restores them and the song position is unchanged |

---

## 11. Edge Cases

| ID | Category | Scenario | Expected Handling | AC |
| --- | --- | --- | --- | --- |
| EC-01 | Invalid input | Malformed or missing `current_version` query param on `GET /api/v1/app/version` | Rejects with HTTP 422: `{"success": false, "message": "Invalid semver string format.", "code": "VALIDATION_FAILED"}` | AC-12 |
| EC-02 | Empty data | Empty release notes or missing download URL in configuration | An empty or unset value falls back to the defaults in §14: release notes "Performance improvements and bug fixes." and the platform's default store URL | AC-12 |
| EC-03 | Permission | User denies `POST_NOTIFICATIONS` permission on Android 13+ | Background audio still operates via foreground service; notification is suppressed by OS without crashing app | AC-01 |
| EC-04 | Failure | Backend version API is unreachable or returns HTTP 500 on app boot | Client catches error, logs warning, suppresses mandatory lock unless previously marked required, and permits app navigation | AC-14 |
| EC-05 | Unexpected behavior | Host device killed by Android OOM while in background | Room remains intact until server-side host heartbeat expiration (30 mins); host reopening app restores session via `SplashScreen` | AC-08 |

---

## 12. Testing Strategy

### Unit Testing

| Target | Cases | Covers |
| --- | --- | --- |
| `GetAppVersionQuery::execute` | Returns correct `update_type` for equal, lower, and sub-minimum versions | AC-12, AC-13, AC-14 |
| `EnforceAppVersion::handle` | Allows valid versions; blocks sub-minimum versions with HTTP 426; skips when header missing if configured | AC-15, AC-16 |
| `versionCompare` (mobile util) | Correctly parses semver strings with pre-releases and patches | AC-17, AC-18 |

### Integration Testing

| Flow / Endpoint | Setup | Assertion | Covers |
| --- | --- | --- | --- |
| `GET /api/v1/app/version` | Seeded config with min=1.0.0, latest=1.2.0 | Assert status 200, response matches envelope, data has valid semver fields | AC-12, AC-13 |
| `POST /api/v1/rooms` with legacy version | Header `X-App-Version: 0.8.0` with min=1.0.0 | Assert status 426, JSON code `UPDATE_REQUIRED`, error contains minimum version | AC-15 |
| `POST /api/v1/rooms` with current version | Header `X-App-Version: 1.0.0` with min=1.0.0 | Assert status 201, room created | AC-16 |

### Manual Testing Scenarios

| # | Precondition | Steps | Expected Result | Covers |
| --- | --- | --- | --- | --- |
| MT-01 | Host running karaoke on physical Android device connected to Bluetooth speaker | 1. Start song.<br>2. Press Home button.<br>3. Open Chrome and browse for 5 minutes.<br>4. Turn off screen for 5 minutes. | Audio plays continuously without pause or stutter throughout all 10 minutes. | AC-01, AC-02, AC-03 |
| MT-02 | Host playing in background | Disconnect Bluetooth speaker by powering it off. | Audio pauses immediately; phone speaker does not blast music. | AC-06 |
| MT-03 | Host playing in background | Pull down notification shade and tap "Skip". | Current song skips; next song in queue starts playing. | AC-04, AC-05 |
| MT-04 | Guest connected to room | 1. Lock screen for 3 minutes while 2 songs finish.<br>2. Unlock phone and open QueueMic. | Screen shows active song and updated queue within 1.2s. | AC-10, AC-11 |
| MT-05 | Client installed with version 1.0.0 | Configure backend `min_version => '1.1.0'`. Launch app. | Mandatory update modal blocks screen; tapping backdrop or back button does not dismiss. | AC-13, AC-17 |

**Test command:** `php artisan test --filter=AppVersionTest && cd ../mobapp && npx tsc --noEmit`

---

## 13. Security Considerations

### Authentication
- `GET /api/v1/app/version` is intentionally public (unauthenticated) so the app can verify version before login or joining.
- Room mutating endpoints require standard Sanctum token / room session header (`X-Session-Token`).

### Authorization

| Role | Allowed | Denied Response |
| --- | --- | --- |
| Public / Unauthenticated | Check app version (`GET /api/v1/app/version`) | N/A |
| Outdated Client (Version < Min) | Public version check | HTTP 426: `{"success": false, "message": "...", "code": "UPDATE_REQUIRED"}` |
| Valid Version Member | Standard room, queue, and playback interactions | Standard room authorization checks |

### Validation

| Field | Rules | Error Response |
| --- | --- | --- |
| `platform` | Required, string, in: `android,ios,web` | 422: `VALIDATION_FAILED` |
| `current_version` | Required, string, regex `/^\d+\.\d+\.\d+$/` | 422: `VALIDATION_FAILED` |
| `current_build` | Optional, integer, min: 1 | 422: `VALIDATION_FAILED` |

### Data Protection
- **Sensitive fields:** N/A — Version information and release notes are non-sensitive public metadata.
- **Exposure rules:** No database credentials or internal infrastructure paths exposed in version responses.
- **Write protection:** Version configuration is maintained strictly in backend server environment/configuration files, protected from client-side tampering.

---

## 14. Implementation Notes

- **Conventions to follow:** Thin controllers delegating to `App\Queries` on backend; Restyle theme and Lucide icons on frontend; standard error envelope `{"success": false, "message": "...", "code": "...", "errors": ...}`.
- **Do not change:** Do not modify the YouTube Data API search driver or existing Reverb channel naming (`presence-room.{code}`).
- **Known pitfalls:**
  1. *Android 14 Foreground Service Restriction:* Android 14 (API 34) strictly enforces `FOREGROUND_SERVICE_MEDIA_PLAYBACK` in the manifest; failing to declare the specific service type causes a runtime `SecurityException`.
  2. *WebView onPause behavior:* Calling standard `onPause` on Android WebView stops all media decoding; `mediaPlaybackRequiresUserAction={false}` and native background audio flags must be set.
  3. *Semver string parsing:* Do not use naive string comparison (e.g. `"1.10.0" < "1.2.0"` in raw strings). Always use PHP `version_compare()` and `semver` logic.
- **Config / environment:**
  - New backend configuration keys in `backend/config/app_version.php`:
    - `APP_LATEST_VERSION` (default: `'1.0.0'`)
    - `APP_MIN_SUPPORTED_VERSION` (default: `'1.0.0'`)
    - `APP_UPDATE_URL_ANDROID` (default: `'https://play.google.com/store/apps/details?id=com.queuemic.app'`)
    - `APP_UPDATE_URL_IOS` (default: `'https://apps.apple.com/app/queuemic/id123456789'`)
    - `APP_RELEASE_NOTES` (default: `'Performance improvements and bug fixes.'`)
- **Deployment / rollback:**
  - Deploy backend code and config first; new endpoint is non-breaking.
  - To rollback a required update, set `APP_MIN_SUPPORTED_VERSION` back to the earlier version in `.env` and clear cache with `php artisan config:clear`.
- **Review findings:** N/A — not yet reviewed.

---

## 15. Assumptions and Decisions

### Assumptions

| ID | Assumption | Impact if Wrong | Confirmed By |
| --- | --- | --- | --- |
| A-01 | Android is the primary platform requiring background host playback for karaoke TV setups. | If iOS is equally required, WebKit background restrictions necessitate native AVPlayer or PiP implementation. | Unconfirmed (documented in Scope Not Included) |
| A-02 | Hosts and guests accept a 24-hour snooze interval on optional version update prompts. | If users desire different snooze durations, an additional configuration key is needed. | Unconfirmed |
| A-03 | Google Play Store is the primary distribution channel for Android binaries. | If direct APK downloads are used, `download_url` will point to direct APK asset URLs. | Confirmed by standard Expo build profile |
| A-04 | Phone-call detection (FR-03) is required on Android 12+ (API 31+) only. | On Android 11 and below a call does not pause playback; headset-unplug pause still works on every version. | Unconfirmed |

### Technical Decisions

| ID | Decision | Alternatives Rejected | Reason |
| --- | --- | --- | --- |
| D-01 | File and environment-driven version management (`config/app_version.php`) instead of a database table. | Database table with admin CRUD UI. | Zero migration dependencies, lightning-fast execution, zero DB load, and instant `.env` updates across deployments. |
| D-02 | Android Foreground Service with `mediaPlayback` type for host background execution. | Requesting `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`. | Google Play Store bans apps requesting ignore-battery-optimizations for media players; Foreground Service is the official Android architecture. |
| D-03 | Server-side API version enforcement via middleware returning HTTP 426. | Client-only version check dialog. | Prevents rogue or modified clients from bypassing update requirements and causing corrupt room state. |
| D-04 | PiP is enabled by a native flag (`QueueMicPip.setPipEnabled`) that `HostPlayerScreen` sets only while playing. | Entering PiP on every `onUserLeaveHint`. | The hint also fires when the app starts another app (the store), and PiP on guest or idle screens has no layout to show. |
| D-05 | Phone calls are detected from the audio mode (`AudioManager.OnModeChangedListener`, API 31+) inside the foreground service. | Requesting audio focus from the service. | A second focus request from the app makes the WebView's own focus listener lose focus and pause the video. The mode listener needs no permission and no focus request. |

### Open Questions

| ID | Question | Impact | Owner |
| --- | --- | --- | --- |
| Q-01 | Is the host back-button guard ("Exit Party Room?" with Keep Playing / End Party on Android Back from `HostPlayerScreen`) a requirement of this ticket? It was built but is not in this spec and has no recorded request. | If yes: add an FR and AC. If no: remove it from `HostPlayerScreen.tsx`. | Product owner |

---

## 16. Change Log

| Version | Date | Type | Change | Reason / Impact | Changed Sections |
| --- | --- | --- | --- | --- | --- |
| 1.0 | 2026-10-11 | Initial | Created specification | Initial draft for Background Playback & Version Checking | All |
| 1.1 | 2026-10-11 | Major | Added Android picture-in-picture for the host (FR-10, AC-23 to AC-25, D-04), the two config plugins in §8, A-04 and D-05 for call detection, and Open Question Q-01 for the host back-button guard | The product owner requested Android PiP during implementation (verify.md §7 Case 2); §4 deferred only iOS PiP to T00003 | §4 Scope, §6 FR-10, §8 Architecture, §10 AC-23 to AC-25, §15 Assumptions, Decisions, Open Questions |
| 1.1 | 2026-10-11 | Minor | EC-02 now names the §14 defaults instead of its own text | The spec contradicted itself on the default release note (§14 against EC-02), found by verify.md §7 Case 1 | §11 EC-02 |
