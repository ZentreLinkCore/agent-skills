# Conformance Report: Karaoke Party (QueueMic) — Room & Queue System

> **Ticket:** `T00001` (queuemic) — this file is `.agents/specs/queuemic/T00001/verify.md`.
> **Branch:** `T00001` in both repos (one match each on `origin`). `backend` @ `85cefba`, `mobapp` @ `5aacd52`, each 1 commit ahead of `main`. Trees clean.
> **Spec:** [specs.md](./specs.md) (unchanged since v1)
> **Run:** v2 — 2026-10-07 — re-verified after `/webkit.fix`. 17 v1 findings resolved (3 of them only in part). 2 new findings: F25 HIGH (host role never re-synced after a missed transfer event) and F26 LOW. F5 HIGH remains, blocked on a decision.
> **Verified:** 2026-10-07
> **Verdict:** DOES NOT CONFORM
> **Coverage:** 134 claims — 108 conforms, 15 violated, 4 absent, 3 unverified, 0 out-of-scope, 4 spec-gap

---

## 1. Summary

The fix commit resolves every v1 finding it targeted. Each fix was re-proven against the committed branch: a 50-check HTTP harness passes, closed-room channel auth is now refused (with a positive control), and the mobile app typechecks clean.

The branch still does not conform, because two HIGH findings remain:

- **F25 (new).** The new Transfer Host flow tells the promoted member's phone about its new role *only* through the live `host.transferred` broadcast. If that phone misses the event — locked or backgrounded at that moment — nothing ever re-syncs its role. Re-joining by code then orphans the host seat permanently.
- **F5.** Retried queue adds are still not idempotent. This waits on a spec decision.

| Severity | Count | Must fix before |
| :--- | :---: | :--- |
| CRITICAL | 0 | anything ships |
| HIGH | 2 | the feature is done |
| MEDIUM | 3 | end of milestone |
| LOW | 7 | — |

### Resolved since v1

| v1 finding | Status | Proof (v2) |
| :--- | :--- | :--- |
| F1 Transfer Host UI never called the API | Resolved — residual edge case is now F25 | `HostPlayerScreen.tsx:120-130` calls `roomApi.transferHost`. `useEchoRoom.ts:230-245` handles `.host.transferred`. H: transfer → 200, Sam host / Alex guest, `host.transferred` broadcast |
| F2 Keep-awake stub | Resolved | `useKeepAwakeHost.ts:7-18` (`activateKeepAwakeAsync` / `deactivateKeepAwake`, per-instance tag). API matches installed `expo-keep-awake` 57.0.2; not run on a device (§7) |
| F3 Song owner could not remove their song | Resolved | H: own song → 200; another member's song → 403; host → 200. `RemoveQueueItemAction.php:29-31`, `GuestRoomScreen.tsx:303` |
| F4 No duplicate-add guard | Resolved (sequential) | H: repeat within 5 s returns the same id with no new row; a different singer or > 5 s creates a new row. `useSubmitGuard.ts:7-23`. Concurrent case → C122 UNVERIFIED |
| F6 Song end recorded as skipped | Resolved | `HostPlayerScreen.tsx:173-176, 291` → `/playback/next` |
| F7 Wrong 403 codes | Resolved | H: guest skip → `403 HOST_PERMISSION_REQUIRED` with "Only the room host can control playback"; guest move → same code |
| F9 Public, unvalidated search | Resolved | H: no room code → 400; no token → 401; 1-character `q` / 101-character `q` / `limit=500` → 422; 61st call in a minute → 429; another member is not throttled |
| F10 Validation boundaries | Resolved (boundaries) | H: seven invalid inputs → 422 with field errors; 2-character nickname → 201. The AC-11 remainder is still F10 below |
| F11 Error envelope | Resolved (REST) | H: 422/404/405/401/403/500 all `{success,message,code,errors}`; raw bytes show `"errors":{}`. 34/34 controller and middleware error responses carry `code` + `errors`. Broadcast auth → F26 |
| F12 `GET /queue` lacked the current item | Resolved | H: `current.status = playing`; `data` pending-only |
| F13 Self-transfer left no host | Resolved | H: self → 422 `INVALID_TRANSFER_TARGET`, role unchanged; member of another room → 404 `MEMBER_NOT_FOUND` |
| F14 `MockKaraokeProvider` missing | Resolved | Class resolves. H: mock-driver searches return fixtures |
| F15 Hard-coded 03:45 durations | Resolved | H (`Http::fake`): `PT4M13S`→253 s "04:13", `PT1H2M3S`→3723 s "1:02:03", missing → 0 / "00:00"; one `videos` call per page |
| F18 "Allow explicit" did nothing | Resolved (explicit) | H: new rooms and `PATCH /settings` no longer store `allow_explicit`; toggle removed. `max_queue_per_user` is still F18 below |
| F19 Closed rooms could reopen the channel | Resolved | Channel auth, with positive control: active → 200, **closed → 403**, other room → 403 |
| F20 AC-3 message text | Resolved | H: `404 {"message":"Room not found or closed","code":"ROOM_NOT_FOUND",…}` |
| F23 No haptics on Skip | Resolved (haptics) | `PlaybackControls.tsx:55, 202`, `HostVideoPlayer.tsx:483, 685`. Remaining items are still F23 below |

## 2. Findings

### F25 — A promoted member who misses `host.transferred` is never re-synced; re-joining orphans the host seat · `HIGH` · `VIOLATED`

- **Claim:** C121 — §7 Host Disconnect Handling: *"If host explicitly chooses 'Transfer Host', another member is promoted seamlessly."* (Also AC-9: *Member "Sam" becomes `role: 'host'`.*)
- **Spec source:** §7 Non-Functional; §2.5 AC-9
- **Expected:** The promoted member's device ends up in host mode even if it was not connected at the exact moment of the transfer.
- **Actual:**
  - A device learns a role change **only** in the live listener ([`useEchoRoom.ts:230-245`](../../../../mobapp/src/hooks/useEchoRoom.ts#L230-L245)).
  - Nothing re-syncs the device's role from the server:
    - `fetchInitialSync` loads members but never compares the device's own role ([`useEchoRoom.ts:190-198`](../../../../mobapp/src/hooks/useEchoRoom.ts#L190-L198)).
    - The sync re-runs only when the broadcaster *config* changes ([`echo.ts:75`](../../../../mobapp/src/services/echo.ts#L75)), not when the socket reconnects or the app resumes.
    - Splash routes by the persisted role ([`SplashScreen.tsx:31`](../../../../mobapp/src/screens/SplashScreen.tsx#L31)) and ignores the `host_member_id` it just fetched (`:36`).
  - The obvious recovery makes things worse. `JoinRoomAction` re-uses a device's seat only if that seat is a guest seat ([`JoinRoomAction.php:40-45`](../../../../backend/app/Actions/Room/JoinRoomAction.php#L40-L45)), so a promoted member who re-joins by code gets a fresh guest seat.
- **Failure scenario:**
  1. Sam's phone is locked in a pocket, so its socket is suspended.
  2. Host Alex transfers to Sam. Alex's TV switches to the Guest screen, which is correct.
  3. The broadcast reaches no Sam device. Sam unlocks: pusher-js reconnects, but no event is replayed and no re-sync runs. Sam's app stays on the guest UI, and restarting it does not help (persisted role `guest`).
  4. Now no device runs the Host Player, so nothing plays or advances. While guests keep adding songs, the room never idles out (F16).
  5. If Sam tries Leave → Join, Sam becomes a new guest, and the host seat is orphaned for good.
- **Proof:**
  - Code path traced as above. `grep -rn "host_member_id\|hostMemberId\|setRole(" mobapp/src` finds no other place that sets or reads the device's role.
  - Scratch-DB execution (`f25.php`):
    - After the transfer, the server reports `host_member_id=2`, members `Sam:host, Alex:guest`.
    - Sam's leave + rejoin with the same device returns **member id 3, role `guest`**. Host seats afterwards: `[{"id":2,"nickname":"Sam","is_connected":false}]`.
- **Fix target:** `code` — the server already holds the truth; the client never reads it.
- **Suggested fix:**
  1. **Re-sync from the server on every room sync.** In `useEchoRoom.fetchInitialSync`, after `membersRes`, find `m.id === useAuthStore.getState().memberId`. If its `role` differs from `auth.role`, call `setRole(role)` and `switchRoomScreen(normalizedCode, role)`. Both calls are no-ops when nothing changed.
  2. **Re-run that sync whenever the socket reconnects.** Bind pusher's connection `state_change` (`previous !== 'connected' && current === 'connected'`) in `useEchoRoom`, or an `AppState` → `active` listener, and call `fetchInitialSync()`. This also catches missed `queue.updated` / `song.started` events (same root cause).
  3. **Splash:** choose `HostPlayer` when `res.data.host_member_id === auth.memberId`, instead of trusting the persisted role (`SplashScreen.tsx:31-38`).
  4. *Optional, decide first:* let a promoted member's own device re-claim its host seat on re-join. `JoinRoomAction.php:43` deliberately excludes host seats today, so this changes intended behaviour.
- **Effort:** `small` (2 files for 1–3)
- **Regression risk:** The re-sync and the live listener must agree. Both go through `switchRoomScreen`, which is idempotent.

### F5 — No idempotency keys on queue inserts · `HIGH` · `ABSENT` (unchanged since v1)

- **Claim:** C108 — *"Unique queue insertions assign UUID transaction keys. If network drops during request, retrying with same payload does not generate duplicate queue records."*
- **Spec source:** §7 Idempotency on Retries
- **Actual:** No key exists in the request ([`AddQueueRequest.php:16-19`](../../../../backend/app/Http/Requests/V1/AddQueueRequest.php#L16-L19)) or in the schema. F4's 5-second window ([`AddSongToQueueAction.php:21, 44-54`](../../../../backend/app/Actions/Queue/AddSongToQueueAction.php#L44-L54)) catches double taps, but not a retry after the 20 s client timeout ([`client.ts:54`](../../../../mobapp/src/api/client.ts#L54)).
- **Failure scenario:** The add commits, but the response is lost. The guest retries 20 s later, outside the 5 s window, and a duplicate row is created.
- **Fix target:** `spec`, then `code` — §3 has no column for the key (§6 SG5).
- **Suggested fix:** Decide where the key lives:
  - (a) An `Idempotency-Key` UUID per confirm tap, plus `karaoke_queue.idempotency_key` with `unique(room_id, idempotency_key)`; a replay returns the stored row.
  - (b) A cache entry keyed by token + key, with a TTL.

  Then amend §3 and implement it in `AddSongToQueueAction` and `queueApi.addToQueue`. `useSubmitGuard` already gives a single place to generate the key.
- **Effort:** `large`
- **Regression risk:** Catch the race on the unique constraint and return the existing row.

### F8 — Guests can control playback when a room setting allows it · `MEDIUM` · `VIOLATED` (unchanged)

- **Claim:** C83–C85 — `/playback/state|next|skip` are **Host Only**. Decision 4: *the Host device is the sole playback clock authority.*
- **Actual:** `room.playback_control` lets guests through when `allow_guest_playback_control` is true ([`routes/api.php:54-58`](../../../../backend/routes/api.php#L54-L58), [`EnsurePlaybackControl.php:29-31`](../../../../backend/app/Http/Middleware/EnsurePlaybackControl.php#L29-L31)). The setting defaults to `false` ([`CreateRoomAction.php:28`](../../../../backend/app/Actions/Room/CreateRoomAction.php#L28)), and the host toggles it in Settings ([`SettingsScreen.tsx:210`](../../../../mobapp/src/screens/SettingsScreen.tsx#L210)). The rejection now uses the spec's code (F7).
- **Failure scenario:** The host enables the toggle. Any guest can then skip the current singer's song.
- **Fix target:** `spec` or `code` — product decision (**Do not fix yet**).
- **Suggested fix:** Either amend §4, §7, AC-6 and Decision 4 to describe the opt-in, or remove the setting and route `playback/*` through `room.host`.
- **Effort:** `small`
- **Regression risk:** Rooms that already have the setting enabled lose guest control if it is removed.

### F16 — Rooms expire after 30 minutes without songs, not 30 minutes after the host disconnects · `MEDIUM` · `VIOLATED` (unchanged)

- **Claim:** C114 — *"If Host disconnects, the room remains open for up to 30 minutes."*
- **Actual:** Host disconnects are not tracked. `ExpireRoomIfIdleAction` closes any room with no song added and no playback update in 30 minutes ([`ExpireRoomIfIdleAction.php:19-43`](../../../../backend/app/Actions/Room/ExpireRoomIfIdleAction.php#L19-L43)). The host heartbeat runs only while a song is playing ([`HostPlayerScreen.tsx:102`](../../../../mobapp/src/screens/HostPlayerScreen.tsx#L102)).
- **Failure scenario:**
  - The queue empties and the host stays on the TV. 31 minutes later, a guest's add gets 404 and everyone is sent Home.
  - Conversely, a host-less room never expires while songs keep arriving. Combined with F25, that becomes a permanent dead room.
- **Fix target:** `spec` or `code` — decision (**Do not fix yet**).
- **Suggested fix:** Either amend §7 to the idle rule, or track host presence (Reverb presence webhooks, or a host heartbeat that also runs while idle) and expire 30 min after the host leaves.
- **Effort:** `large`
- **Regression risk:** Changes when rooms close.

### F17 — Guest phones play the karaoke video with sound · `MEDIUM` · `UNSPECCED` (unchanged)

- **Claim:** C69 — Decision 4: *"Guaranteed single audio/video stream playing in the room."* The §6 guest screen has no video.
- **Actual:** `GuestRoomScreen` embeds `HostVideoPlayer` with `followHost` ([`GuestRoomScreen.tsx:223-234`](../../../../mobapp/src/screens/GuestRoomScreen.tsx#L223-L234)). The player always unmutes at volume 100 ([`HostVideoPlayer.tsx:157-158`](../../../../mobapp/src/components/player/HostVideoPlayer.tsx#L157-L158), `:193`, `:281`, `:404-405`). Since F2, the guest screen also holds a wake lock ([`GuestRoomScreen.tsx:65`](../../../../mobapp/src/screens/GuestRoomScreen.tsx#L65)), so guest phones never sleep while in a room.
- **Failure scenario:** Ten phones play the track slightly out of sync with the TV, producing echo while someone sings. Guest batteries drain because their screens stay on.
- **Fix target:** `spec` or `code` — decision (**Do not fix yet**).
- **Suggested fix:** If guest video stays, mute it by default (make the `unMute` calls conditional on `!followHost`) and amend §6 and Decision 4. Decide at the same time whether guests need the wake lock (`GuestRoomScreen.tsx:65`).
- **Effort:** `small`
- **Regression risk:** Guests lose the lyrics view if the player is removed.

### F10 — AC-11 / C113: blank singer name and blank search are accepted · `LOW` · `VIOLATED` (remainder of v1 F10)

- **Claim:** AC-11 — *empty/whitespace nickname or query → 422*. C113 — *search queries … minimum 2 chars*.
- **Actual:**
  - A blank `singer_name` falls back to the member's nickname → 201 ([`AddQueueRequest.php:18`](../../../../backend/app/Http/Requests/V1/AddQueueRequest.php#L18), [`AddSongToQueueAction.php:41`](../../../../backend/app/Actions/Queue/AddSongToQueueAction.php#L41)).
  - A blank `q` is allowed and returns trending hits ([`SearchSongsRequest.php:18`](../../../../backend/app/Http/Requests/V1/SearchSongsRequest.php#L18), [`YouTubeKaraokeProvider.php:20-24`](../../../../backend/app/Services/KaraokeProvider/YouTubeKaraokeProvider.php#L20-L24)).
  - Whitespace nicknames on create/join do return 422 (H).
- **Failure scenario:** A spec-literal client test sending `singer_name: "   "` expects 422 and gets 201. A blank search expects 422 and gets 200. The behaviour is deliberate and benign: `AddSingerModal` defaults to the nickname, and the app prefetches the trending list.
- **Fix target:** `spec` (§6 SG6) — the implemented UX is intentional.
- **Suggested fix:** Amend AC-11 and §7 to: *blank `singer_name` → member nickname; blank search → trending results*.
- **Effort:** `trivial`
- **Regression risk:** None.

### F18 — `max_queue_per_user` is stored but never enforced · `LOW` · `UNSPECCED` (remainder of v1 F18)

- **Actual:** `PATCH /settings` accepts and stores `max_queue_per_user` ([`UpdateRoomSettingsAction.php:20-27`](../../../../backend/app/Actions/Room/UpdateRoomSettingsAction.php#L20-L27)), and nothing reads it. No UI exposes it any more, so the setting is only reachable through the API.
- **Failure scenario:** An API client sets the maximum to 2. Guests can still queue any number of songs.
- **Fix target:** `spec` (define it; §6 SG9), then `code`.
- **Suggested fix:** Once it is defined, enforce it in `AddSongToQueueAction` by counting the member's `pending` rows. Otherwise drop it from `UpdateRoomSettingsRequest` and the action.
- **Effort:** `small`
- **Regression risk:** None.

### F21 — Schema details differ from §3 · `LOW` · `VIOLATED` (unchanged)

- **Claim:** C13, C27, C30, C31.
- **Actual:**
  - `songs` has no `FULLTEXT(title, artist)` ([`create_songs_table.php:14-15`](../../../../backend/database/migrations/2026_10_05_000003_create_songs_table.php#L14-L15)).
  - The `avatar_color` default is `#8B5CF6`, not `#6366F1` ([`create_room_members_table.php:17`](../../../../backend/database/migrations/2026_10_05_000002_create_room_members_table.php#L17)).
  - `karaoke_queue.song_id` and `requested_by_member_id` cascade on delete ([`create_karaoke_queue_table.php:14-15`](../../../../backend/database/migrations/2026_10_05_000004_create_karaoke_queue_table.php#L14-L15)).
- **Failure scenario:** Deleting a song or member that has queue history silently deletes that history. No current code path does this.
- **Fix target:** `spec`, mostly — drop FULLTEXT (search is provider-backed) and accept the default colour. Decide on the cascades.
- **Suggested fix:** Amend §3. If restrict-on-delete is wanted, add a migration switching both FKs to `restrictOnDelete()`.
- **Effort:** `small`
- **Regression risk:** Restrict FKs make the cleanup cascade order-sensitive.

### F22 — Some spec'd backend classes are absent · `LOW` · `ABSENT` (unchanged)

- **Claim:** C49 `ReorderQueueAction`; C60 `RoomPolicy`, `KaraokeQueuePolicy`.
- **Actual:** Authorization is done by the `room.*` middleware plus the owner check in `RemoveQueueItemAction`. Reordering lives in `MoveQueueItemAction` (`target_position`).
- **Failure scenario:** None at runtime.
- **Fix target:** `spec`
- **Suggested fix:** Amend §4 to name middleware authorization and the merged move/reorder action.
- **Effort:** `trivial`
- **Regression risk:** None.

### F23 — Spec'd frontend pieces are absent or substituted · `LOW` · `ABSENT` (remainder of v1 F23)

- **Claim:** C93, C97; the "queue sidebar" in AC-12.
- **Actual:**
  - Styling uses Restyle, not NativeWind.
  - `GradientText`, `AnimatedPressable`, `Toast` and `useHaptics` do not exist.
  - "Party Ended" is a blocking `Alert` ([`navigationRef.ts:47`](../../../../mobapp/src/navigation/navigationRef.ts#L47)).
  - The Host Player lists the queue below the video, not in a sidebar ([`HostPlayerScreen.tsx:326`](../../../../mobapp/src/screens/HostPlayerScreen.tsx#L326)).
- **Failure scenario:** None functional.
- **Fix target:** `spec` for the stack and component set; `code` for the sidebar/toast only if wanted.
- **Suggested fix:** Amend §5. Decide on toast vs alert and on a landscape sidebar layout.
- **Effort:** `small`
- **Regression risk:** None.

### F24 — The server auto-starts the first song on an empty stage · `LOW` · `UNSPECCED` (unchanged)

- **Actual:** `AddSongToQueueAction` calls `StartNextSongAction` when nothing is playing ([`AddSongToQueueAction.php:76-83`](../../../../backend/app/Actions/Queue/AddSongToQueueAction.php#L76-L83)).
- **Failure scenario:** None harmful. Playback starts without any host action, which is undocumented.
- **Fix target:** `spec`
- **Suggested fix:** Document auto-start under Decision 4 and AC-5.
- **Effort:** `trivial`
- **Regression risk:** None.

### F26 — Broadcast-auth errors do not use the standard envelope · `LOW` · `VIOLATED` (new)

- **Claim:** C109 — *All API errors return `{"success": false, "message", "code", "errors"}`.*
- **Actual:** `BroadcastAuthController::authenticate` returns `403 {"message","error"}` ([`BroadcastAuthController.php:37-41`](../../../../backend/app/Http/Controllers/Api/V1/BroadcastAuthController.php#L37-L41)). Every REST controller and middleware error now conforms (34/34).
- **Failure scenario:** A client that reads `code` from a failed `/api/v1/broadcasting/auth` gets `undefined`. pusher-js itself reads only the status, so the app is unaffected.
- **Fix target:** `code`
- **Suggested fix:** Return `{success:false, message, code:'BROADCAST_AUTH_FAILED', errors:(object)[]}` with the same 403.
- **Effort:** `trivial`
- **Regression risk:** None — pusher-js ignores the body.

## 3. Claim Checklist

B = `backend/`, M = `mobapp/`. "H:" = proven by the disposable scratch-SQLite harness against the committed branch (§7). Unchanged rows still cite their v1 evidence, re-checked at the current line numbers.

### Acceptance Criteria

| # | Claim | Verdict | Evidence |
| :--- | :--- | :--- | :--- |
| AC-1 | Create → unique 6-character code, `host`, token, 201 | CONFORMS | H: 201; B `CreateRoomAction.php:17-79`, `RoomCodeGeneratorService.php:14-28` ("Sanctum" → SG1) |
| AC-2 | Join → token, room state, 200, MemberJoined | CONFORMS | H: 200 with a lower-case code (normalised, `JoinRoomRequest.php:14-19`); log `member.joined` on `presence-room.<code>` |
| AC-3 | Bad code → 404 `{"message":"Room not found or closed","code":"ROOM_NOT_FOUND"}` | CONFORMS | H: exact body (+`success`, `errors`). B `JoinRoomAction.php:23` |
| AC-4 | Search → provider, cache, 200 normalized | CONFORMS | H: mock driver; YouTube API path with `Http::fake`. B `SearchKaraokeSongsQuery.php:17-85` |
| AC-5 | Add → N+1, QueueUpdated, 201 | CONFORMS | H: 201, `queue.updated` logged. B `AddSongToQueueAction.php:30-71` |
| AC-6 | Guest skip → 403 `HOST_PERMISSION_REQUIRED`, "Only the room host can control playback" | CONFORMS | H: exact code and message. B `EnsurePlaybackControl.php:31-38` (default settings; opt-in → F8) |
| AC-7 | Move up pos 3 → 2, atomic, QueueUpdated | CONFORMS | H: position decreases. B `MoveQueueItemAction.php:17-22, 67` |
| AC-8 | Skip/song end → `/next` → completed, next playing, SongStarted | CONFORMS | H: previous `completed`, one `playing`, `song.started`. Song end → `/next`: M `HostPlayerScreen.tsx:173-176, 291` (Skip button → `/skip`, SG4) |
| AC-9 | Transfer → target host, caller guest, broadcast | CONFORMS | H: 200, roles swapped, `host.transferred`. M `HostPlayerScreen.tsx:120-130`, `useEchoRoom.ts:230-245`. Missed-event path → C121 / F25 |
| AC-10 | Close → closed, RoomClosed, sessions invalidated, 200 | CONFORMS | H: 200; member GET → 404; `room.closed` logged; channel re-auth refused (C63) |
| AC-11 | Blank nickname/query → 422 | VIOLATED | Blank nickname → 422 (H). Blank `singer_name` / blank `q` accepted → F10 |
| AC-12 | Host Player keep-awake, full-screen video, controls, queue sidebar | VIOLATED | Keep-awake: M `useKeepAwakeHost.ts:7-18` (code; device run §7). Full-screen and controls: M `HostPlayerScreen.tsx:287-320`. No sidebar → F23 |

### Database (§3) — migrations unchanged since v1

| # | Claim | Verdict | Evidence |
| :--- | :--- | :--- | :--- |
| C1 | `rooms` table | CONFORMS | B `…000001_create_rooms_table.php:11` |
| C2 | `rooms.code` VARCHAR(8) UNIQUE | CONFORMS | `:13` |
| C3 | `rooms.name` VARCHAR(100) NOT NULL | CONFORMS | `:14` |
| C4 | `rooms.host_member_id` BIGINT UNSIGNED NULL | CONFORMS | `:15` |
| C5 | `rooms.status` ENUM default active, INDEX | CONFORMS | `:16` |
| C6 | `rooms.settings` JSON NULL | CONFORMS | `:17` |
| C7 | `rooms` timestamps + `closed_at` | CONFORMS | `:18-19` |
| C8 | `room_members` table | CONFORMS | B `…000002…:11` |
| C9 | `room_members.room_id` FK CASCADE | CONFORMS | `:13` |
| C10 | `session_token_hash` VARCHAR(64) UNIQUE | CONFORMS | `:14` |
| C11 | `device_uuid` VARCHAR(64) NOT NULL | CONFORMS | `:15`; validation now `max:64` (`CreateRoomRequest.php:20`, `JoinRoomRequest.php:28`) |
| C12 | `nickname` VARCHAR(50) NOT NULL | CONFORMS | `:16` |
| C13 | `avatar_color` default `#6366F1` | VIOLATED | `:17` `#8B5CF6` → F21 |
| C14 | `role` ENUM default guest | CONFORMS | `:18` |
| C15 | `is_connected` default true | CONFORMS | `:19` |
| C16 | `last_seen_at` NOT NULL | CONFORMS | `:20` |
| C17 | Indexes (room_id,is_connected), (room_id,role) | CONFORMS | `:23-24` |
| C18 | `songs` table | CONFORMS | B `…000003…:11` |
| C19 | `external_video_id` VARCHAR(100) UNIQUE | CONFORMS | `:13` |
| C20 | `title` VARCHAR(255) NOT NULL | CONFORMS | `:14` |
| C21 | `artist` default 'Unknown' | CONFORMS | `:15` |
| C22 | `duration_formatted` VARCHAR(10) default '00:00' | CONFORMS | `:16` |
| C23 | `duration_seconds` UNSIGNED default 0 | CONFORMS | `:17` |
| C24 | `thumbnail_url` TEXT NOT NULL | CONFORMS | `:18` |
| C25 | `source_provider` default 'youtube' | CONFORMS | `:19` |
| C26 | `metadata_payload` JSON NULL | CONFORMS | `:20` |
| C27 | FULLTEXT (title, artist) | VIOLATED | `:14-15` B-tree → F21 |
| C28 | `karaoke_queue` table | CONFORMS | B `…000004…:11` |
| C29 | `karaoke_queue.room_id` FK CASCADE | CONFORMS | `:13` |
| C30 | `song_id` FK (no cascade stated) | VIOLATED | `:14` → F21 |
| C31 | `requested_by_member_id` FK (no cascade stated) | VIOLATED | `:15` → F21 |
| C32 | `singer_name` VARCHAR(50) | CONFORMS | `:16` |
| C33 | `position` UNSIGNED NOT NULL | CONFORMS | `:17` |
| C34 | `status` ENUM(5) default pending, INDEX | CONFORMS | `:18` |
| C35 | `played_at`, `finished_at` NULL | CONFORMS | `:19-20` |
| C36 | Index (room_id,status,position) | CONFORMS | `:23` |
| C37 | `playback_sessions`, room_id UNIQUE FK CASCADE | CONFORMS | B `…000005…:13` |
| C38 | `queue_item_id` NULL FK | CONFORMS | `:14` |
| C39 | `song_id` NULL FK | CONFORMS | `:15` |
| C40 | `state` ENUM default stopped | CONFORMS | `:16` |
| C41 | `current_time_seconds` default 0 | CONFORMS | `:17` |
| C42 | `started_at` NULL | CONFORMS | `:18` |
| C43 | `activity_logs`, room_id FK CASCADE | CONFORMS | B `…000006…:13` |
| C44 | `room_member_id` NULL FK SET NULL | CONFORMS | `:14` |
| C45 | `action`, `payload`, `created_at` | CONFORMS | `:15-17` |
| C46 | MySQL 8.0+ | CONFORMS | B `.env.example:38` |

### Backend structure, decisions, channels

| # | Claim | Verdict | Evidence |
| :--- | :--- | :--- | :--- |
| C47 | Room actions (5) | CONFORMS | B `app/Actions/Room/*` |
| C48 | Queue actions: Add, Move, Remove | CONFORMS | B `app/Actions/Queue/*` |
| C49 | `ReorderQueueAction` | ABSENT | F22 |
| C50 | Playback actions (3) | CONFORMS | B `app/Actions/Playback/*` |
| C51 | Queries (5) | CONFORMS | B `app/Queries/*` |
| C52 | Provider interface + YouTube provider | CONFORMS | B `app/Services/KaraokeProvider/*` |
| C53 | `MockKaraokeProvider` | CONFORMS | B `MockKaraokeProvider.php:11-60`; H: driver `mock` returns fixtures |
| C54 | `RoomCodeGeneratorService` | CONFORMS | B `RoomCodeGeneratorService.php:14-28` |
| C55 | 7 events on presence `room.{code}` | CONFORMS | B `app/Events/*`; H broadcast log |
| C56 | 5 controllers | CONFORMS | B `app/Http/Controllers/Api/V1/*` |
| C57 | 6 FormRequests | CONFORMS | B `app/Http/Requests/V1/*` |
| C58 | `EnsureRoomMember` / `EnsureRoomHost` | CONFORMS | H: no token → 401, other room's token → 403 |
| C59 | 6 models | CONFORMS | B `app/Models/*` |
| C60 | `RoomPolicy`, `KaraokeQueuePolicy` | ABSENT | F22 |
| C61 | `config/reverb.php`, `config/karaoke.php` | CONFORMS | B `config/` |
| C62 | Channel authorizes members of that room | CONFORMS | B `channels.php:29-40`; active → 200, other room → 403 |
| C63 | Channel requires room `status = active` | CONFORMS | B `channels.php:31-33`; **closed → 403** (positive control 200) |
| C64 | Decision 1 — Sanctum | SPEC-GAP | SG1 |
| C65 | Decision 2 — provider proxy + caching | CONFORMS | B `SearchKaraokeSongsQuery.php:19-33` |
| C66 | Decision 2 — normalized duration | CONFORMS | B `YouTubeKaraokeProvider.php:63-73, 99-141`; H `Http::fake` |
| C67 | Decision 3 — Reverb presence broadcasts | CONFORMS | H log: member.joined, queue.updated, song.started, host.transferred, room.closed |
| C68 | Decision 4 — host posts state, server broadcasts | CONFORMS | M `HostPlayerScreen.tsx:101-116`; B `UpdatePlaybackStateAction.php:19-46` |
| C69 | Decision 4 — single audio/video stream | VIOLATED | F17 |

### REST endpoints

| # | Claim | Verdict | Evidence |
| :--- | :--- | :--- | :--- |
| C70 | `POST /rooms` — public | CONFORMS | B `routes/api.php:28` |
| C71 | `POST /rooms/join` — public | CONFORMS | `:29` |
| C72 | `GET /rooms/{code}` — member | CONFORMS | `:40`; H 401 without token |
| C73 | `DELETE /rooms/{code}` — host | CONFORMS | `:69`; H: new host closes → 200 |
| C74 | `POST /leave` — member | CONFORMS | `:41` |
| C75 | `POST /transfer-host` — host | CONFORMS | `:70` |
| C76 | `GET /members` — member | CONFORMS | `:42` |
| C77 | `GET /songs/search` — member | CONFORMS | `:37` (member group + `throttle:song-search`); H: 400/401 without membership |
| C78 | `GET /queue` — queue + current item | CONFORMS | `:45`; B `QueueController.php:30`; H |
| C79 | `POST /queue` — member | CONFORMS | `:46` |
| C80 | `DELETE /queue/{id}` — host or song owner | CONFORMS | `:48`; B `RemoveQueueItemAction.php:29-31`; H owner 200 / other 403 / host 200 |
| C81 | `POST /queue/{id}/move` — host only | SPEC-GAP | `:62`; SG2 (guest default-deny holds, H) |
| C82 | `GET /playback` — member | CONFORMS | `:51` |
| C83 | `POST /playback/state` — host only | VIOLATED | `:55` → F8 |
| C84 | `POST /playback/next` — host only | VIOLATED | `:56` → F8 |
| C85 | `POST /playback/skip` — host only | VIOLATED | `:57` → F8 |

### Frontend

| # | Claim | Verdict | Evidence |
| :--- | :--- | :--- | :--- |
| C86 | Expo SDK 52+ | CONFORMS | M `package.json` `expo ~57.0.26` |
| C87 | TypeScript strict; typecheck clean | CONFORMS | `npx tsc --noEmit` exit 0 on `5aacd52` |
| C88 | React Navigation v7 native stack | CONFORMS | M `src/navigation/RootNavigator.tsx` |
| C89 | Zustand stores | CONFORMS | M `src/store/*` |
| C90 | `expo-secure-store` session storage | SPEC-GAP | SG7 (M `storage.ts:19` AsyncStorage) |
| C91 | TanStack Query v5 | CONFORMS | M `App.tsx:85` |
| C92 | Echo + pusher-js → Reverb presence | CONFORMS | M `useEchoRoom.ts:44` |
| C93 | NativeWind styling | VIOLATED | F23 |
| C94 | YouTube embedded player | CONFORMS | M `HostVideoPlayer.tsx` |
| C95 | QR generator + scanner | CONFORMS | M `QRCodeModal.tsx:26`, `QRScannerModal.tsx:12-14` |
| C96 | Haptics on add, reorder, skip | CONFORMS | Skip: M `PlaybackControls.tsx:55, 202`, `HostVideoPlayer.tsx:483, 685` |
| C97 | `GradientText`, `AnimatedPressable`, `Toast`, `useHaptics` | ABSENT | F23 |
| C98 | Spec'd api/screens/stores/theme/utils | CONFORMS | M `src/*` |
| C99 | Palette tokens | CONFORMS | M `colors.ts:3, 28` |
| C100 | Debounced search | CONFORMS | M `SongSearchModal.tsx:70` (300 ms) |
| C101 | Host Player layout | CONFORMS | M `HostPlayerScreen.tsx:200-383` |

### Non-functional (§7)

| # | Claim | Verdict | Evidence |
| :--- | :--- | :--- | :--- |
| C102 | Only host closes the room | CONFORMS | B `routes/api.php:66-69` |
| C103 | Guests cannot remove others' songs | CONFORMS | H 403 |
| C104 | Guest host actions → `HOST_PERMISSION_REQUIRED` | CONFORMS | H (skip, move, remove-other, close) |
| C105 | Deterministic positions under concurrent adds | UNVERIFIED | Lock at B `AddSongToQueueAction.php:36`; SQLite ignores locks (§7) |
| C106 | Backend duplicate check, 5 s | CONFORMS | B `AddSongToQueueAction.php:44-54`; H sequential repeats deduped |
| C107 | Frontend 500 ms add debounce | CONFORMS | M `useSubmitGuard.ts:14`, `SongSearchModal.tsx:150`, `SongSearchScreen.tsx:84` |
| C108 | UUID idempotency keys | ABSENT | F5 |
| C109 | Standard error envelope | VIOLATED | REST 34/34 conform (H); broadcast auth → F26 |
| C110 | Room name 2–50 | CONFORMS | B `CreateRoomRequest.php:17`; H |
| C111 | Nickname 2–30, XSS-safe | CONFORMS | B `CreateRoomRequest.php:19`, `JoinRoomRequest.php:27`; H |
| C112 | Room code `^[A-Z0-9]{6}$` | CONFORMS | B `JoinRoomRequest.php:25`; H |
| C113 | Search trimmed, 2–100 | VIOLATED | 2–100 enforced (H); blank accepted → F10 |
| C114 | Room open ≤ 30 min after host disconnect | VIOLATED | F16 |
| C115 | Host reclaims with stored token | CONFORMS | B `EnsureRoomMember.php:58-62`; M `SplashScreen.tsx:29-52` |
| C116 | Guests go Home on close | CONFORMS | M `useEchoRoom.ts:248-252` → `navigationRef.ts:36-52` |

### Build order, Definition of Done, and claims added in v2

| # | Claim | Verdict | Evidence |
| :--- | :--- | :--- | :--- |
| C117 | Laravel 12 | SPEC-GAP | SG8 (repo is Laravel 13) |
| C118 | Thin controllers; Actions/Queries/Services | CONFORMS | B controllers delegate throughout |
| C119 | No hard-coded secrets | CONFORMS | Only `.env.example` is tracked, with empty secrets |
| C120 | Premium design audit | UNVERIFIED | Needs a device and `/webkit.design-review` |
| C121 | §7 — Transfer Host promotes another member *seamlessly* (split out of v1's AC-9 evidence) | VIOLATED | F25 |
| C122 | Duplicate check holds under *concurrent* identical requests on MySQL (split out of C106) | UNVERIFIED | §7 — cannot exercise InnoDB snapshots on SQLite |

## 4. Fix Plan

| Order | Finding | Severity | Change | File(s) | Effort |
| :---: | :--- | :--- | :--- | :--- | :--- |
| 1 | F25 | HIGH | Re-sync the device's role from `GET /members` in `fetchInitialSync`; re-run the sync on socket reconnect / app resume; Splash picks the screen from `host_member_id` | M `src/hooks/useEchoRoom.ts`, `src/screens/SplashScreen.tsx` | small |
| 2 | F26 | LOW | Envelope for the broadcast-auth 403 | B `app/Http/Controllers/Api/V1/BroadcastAuthController.php` | trivial |
| 3 | F10, F21, F22, F23, F24 | LOW | Spec amendments: AC-11 blank handling, FULLTEXT/colour/cascades, middleware auth, Restyle and component set, auto-start | `.agents/specs/queuemic/T00001/specs.md` | small |

**Fix together:** F25's reconnect re-sync is also the natural place to recover missed `queue.updated` / `song.started` events (same missing re-sync). Do it as one change in `useEchoRoom`.

**Do not fix yet:**

- **F5** — where the idempotency key lives (column vs cache); amend §3 first.
- **F8** — whether guest playback control is a supported feature.
- **F16** — the room-expiry rule (song-idle as built vs host-disconnect as specced).
- **F17** — whether guests see and hear the video, and whether guest screens stay awake.
- **F18** — what `max_queue_per_user` means (enforce vs drop).
- **C81 / SG2** — whether `allow_guest_reorder` stays.

---

## 5. Unspecced Behavior

Items that are already findings are marked.

- **Carried from v1:**
  - `PATCH /rooms/{code}/settings` with `RoomSettingsUpdatedEvent`.
  - `GET /api/v1/time` plus `position_at_ms` / `position_age_ms` sync.
  - Broadcast auth/config endpoints with a Pusher switch.
  - Room cleanup automation (deletes closed rooms *and their activity logs*).
  - YouTube HTML scraping as the default search path.
  - Device-based guest seat reuse and `NICKNAME_TAKEN`.
  - `top`/`bottom`/`target_position` moves.
  - The late-heartbeat guard.
  - Server auto-start (F24).
  - Guest video (F17).
  - `playback_sessions.created_at`.
  - The LAN fallback IP (M `client.ts:39`).
- **New in v2:**
  - A duplicate add returns the original item with **201** (idempotent-replay style). The spec does not say what a duplicate returns.
  - Search rate limit: 60/min per session token (Decision 2 mentions rate-limiting but gives no number). Over the limit → `429 TOO_MANY_REQUESTS`.
  - `GET /queue` field name `current`, plus new error codes (`MEMBER_NOT_FOUND`, `INVALID_TRANSFER_TARGET`, `QUEUE_ITEM_NOT_FOUND`, `VALIDATION_FAILED`, `SERVER_ERROR`, …).
  - Guest screens now hold a wake lock (M `GuestRoomScreen.tsx:65`); before F2 the hook was a no-op (see F17).
  - `YouTubeKaraokeProvider::getDetails` still returns placeholder metadata, including `'03:45'` (B `YouTubeKaraokeProvider.php:225-235`). It has **no callers**, so it is dead code rather than a defect.

## 6. Spec Gaps

Unchanged from v1:

- **SG1** — Sanctum wording vs the custom token in the spec's own schema.
- **SG2** — reorder: host-only vs `allow_guest_reorder`.
- **SG3** — event name: `HostChanged` vs `HostTransferred`.
- **SG4** — AC-8 routes Skip through `/next`, but `/skip` exists.
- **SG5** — idempotency key with no column in §3.
- **SG6** — blank singer name and blank search UX (F10).
- **SG7** — SecureStore vs AsyncStorage.
- **SG8** — Laravel 12 vs 13.
- **SG9** — `rooms.settings` keys are undefined (F18).

## 7. Verification Limits

- **Branch:** `origin/T00001` was analysed with three-dot diffs against `main` (backend 26 files, mobapp 16; one commit each). The diffs match the `/webkit.fix` change set line for line.
- **How behaviour was proven:** every "H:" result ran as HTTP requests through the app kernel against a **fresh scratch SQLite DB**.
  - A guard confirmed the connection resolved to the scratch file before migrating.
  - Broadcasts went to a scratch log.
  - The provider was a mock or `Http::fake`, so there were no YouTube calls.
  - Results: harness 50/50; channel controls; error renderer (debug and production); `f25.php` for F25.
  - The dev MySQL database was not touched.
- **Concurrency:** C105 and C122 are unverified because SQLite ignores `FOR UPDATE`. For C122, the duplicate check is a plain read. Under InnoDB REPEATABLE READ, its snapshot is taken at `Song::find`, *before* the row-lock wait, so two simultaneous identical requests could both miss each other and insert. This is reasoned, not run. The frontend guard blocks same-device double taps, which is the only realistic source. Hardening option: `->lockForUpdate()` on the duplicate query.
- **Device-only, not run:**
  - The wake lock actually holding (F2).
  - Haptics and QR scanning.
  - The design audit (C120).
  - What happens to the shared `room.{code}` channel when `switchRoomScreen` replaces one room screen with another. If native-stack unmounts the old screen *after* mounting the new one, the old screen's cleanup `echo.leave` would unsubscribe the channel the new screen just joined. **Device check:** after a transfer, confirm both phones still receive queue updates.
- **PHPUnit:** contains only the two scaffold example tests (passing). It is not evidence for any claim here.
- **Outside conformance scope** (for `/webkit.code-review`):
  - YouTube `ENDED` firing twice, or a song end racing a Skip tap, can call `/next` twice and skip a song. There is no server-side guard on double-advance.
  - `Move`, `Remove` and `TransferHost` still broadcast inside their transactions without `try/catch`.

## 8. Resolution

> **2026-10-07** — `/webkit.fix` applied the v2 Fix Plan's code items (orders 1–2) on `T00001` (`mobapp` from `5aacd52`, `backend` from `85cefba`). The changes are uncommitted. The verdict above stands until `/webkit.verify T00001` re-runs. Order 3 (spec amendments) and every **Do not fix yet** item are untouched.

| Finding | Status | What changed |
| :--- | :--- | :--- |
| F25 | Fixed | New `applyOwnRole(roomCode, role, knownAt)` in `navigationRef.ts` is the single place a device changes its own role. It ignores a server answer requested before the last change. `useEchoRoom` uses it in three places: when `fetchInitialSync` reads `GET /members` (the device's own row), in the `.host.transferred` listener, and on a re-sync that runs whenever pusher's connection returns to `connected` after a drop (`state_change`, unbound on cleanup). `HostPlayerScreen.handleTransferHost` uses it too. `SplashScreen` picks the room screen from the server's `host_member_id` and updates the persisted role |
| F26 | Fixed | `BroadcastAuthController` 403 → `{success:false, message, code:'BROADCAST_AUTH_FAILED', errors:{}}` |

**Proof (scratch SQLite, guarded):**

- **F25 server inputs:** after a transfer, Sam's own `GET /members` row is `host`, Alex's is `guest`, and `GET /rooms/{code}` returns snake_case `host_member_id = Sam` (4/4).
- **F26, on the reverb broadcaster as booted:** the positive control (active room) → 200 with a signature. Other room, closed room and unknown token → 403 with the envelope; raw bytes show `"errors":{}` (4/4).
- `npx tsc --noEmit` → exit 0. `vendor/bin/phpunit` passes (example tests only).
- **Not run on a device.** The client-side re-sync was checked by code trace only; this project has no JS test runner.

### Resolution — remaining findings (2026-10-07)

`/webkit.fix T00001` ("fix all findings, leave nothing behind") implemented the v2 spec's remaining build order (§8 of `specs.md`) on `T00001`, on top of `backend` `7423730` and `mobapp` `aa264be`. The changes are uncommitted.

§2.13 was decided by the product owner during this run (**Data API only**) and recorded in `specs.md` v3. The verdict above stands until `/webkit.verify T00001` re-runs against spec v3.

| Finding | Status | What changed |
| :--- | :--- | :--- |
| F5 (HIGH) | Fixed | New migration adds `karaoke_queue.idempotency_key` with `unique(room_id, idempotency_key)`. `AddQueueRequest` validates the `Idempotency-Key` header (8–64 characters, `[A-Za-z0-9-]`). `AddSongToQueueAction` replays the original row, returns `409 IDEMPOTENCY_KEY_MISMATCH` for a different song or singer, and inserts inside a savepoint that returns the winner's row on a race. `queueApi.addToQueue` sends a key per logical add and reuses it for 2 min only after a no-response failure |
| F16 (MEDIUM) | Fixed (D6) | `ExpireRoomIfIdleAction` now closes a room once the host seat's `last_seen_at` is older than `karaoke.host_away_minutes` (30), with the message "This party ended because the host has been away for 30 minutes.". New `POST /rooms/{code}/heartbeat` (`RecordMemberHeartbeatAction`, `MemberController::heartbeat`). `EnsureRoomMember` refreshes `last_seen_at` at most once a minute. The room screens send a heartbeat every 60 s while in the foreground. Cleanup uses the same rule; `.env.example` key renamed |
| F17 (MEDIUM) | Fixed (D7) | `HostVideoPlayer` gains `muted` / `onToggleMute`, applied in the native WebView (`window.setKaraokeMuted`) and the web player. The guest player is muted on every room entry, with a "🔇 Listen on this phone" pill. The guest wake lock is held only while a song is on stage. The host player is unchanged (always unmuted) |
| F18 (LOW) | Fixed (D9) | `AddSongToQueueAction` enforces `max_queue_per_user` on pending songs (host exempt) → `422 QUEUE_LIMIT_REACHED` "You already have N songs waiting. Wait for one to play before adding more.". Settings has a "Songs Each Guest Can Have Waiting" stepper (No limit ⇄ 1…50). `RoomSettings` types now allow `null` |
| F23 (LOW) | Fixed (D11) / closed by spec | Host Player uses a landscape sidebar: the video at 65% on the left, Next Up + queue + Add Song on the right; portrait is stacked; full-screen is unaffected. Restyle, the alert (D10) and the component list were closed by the spec amendment |
| F8, F10, F21, F22, F24 | Closed by the spec amendment | `specs.md` v2 adopted the as-built behaviour (D5, AC-11, D12, D4); no code change needed |
| §2.13 | Fixed (decided) | The YouTube results-page scraper is removed. Without `YOUTUBE_API_KEY` the `youtube` driver returns `[]`, logs a warning, and makes no request. `getDetails()` now returns real Data API metadata (or `null`) instead of placeholder values. Shared `parseDuration` / `toResult` helpers |

**Proof (scratch SQLite, guarded; no network):** harness **38/38**:

- **Schema:** the migration ran and the unique index exists.
- **Idempotency:** AC-17/18/19/20/21.
- **Limit and settings:** AC-23 a/b/c and AC-26 a/b/c.
- **Presence:** AC-30/31/32/33/34, plus the once-a-minute refresh and the cleanup path.
- **Search:** no API key → `[]` with **zero outbound requests**; `getDetails` → `null` without a key and real metadata with one.

`npx tsc --noEmit` → exit 0. `vendor/bin/phpunit` passes (example tests only).

**Still device-only:** AC-12 (landscape sidebar), AC-44/45 (guest mute toggle, guest wake lock), AC-28 (re-sync after a missed transfer), AC-48 (haptics).

**Migration:** the dev MySQL database needs `php artisan migrate` (`2026_10_07_000001_add_idempotency_key_to_karaoke_queue_table`). It was run only on scratch SQLite.

<!-- Run history -->

- v1 — 2026-10-07 — initial. Verdict DOES NOT CONFORM; 132 claims — 91 conforms, 27 violated, 8 absent, 2 unverified, 4 spec-gap; 24 findings (6 HIGH, 12 MEDIUM, 6 LOW).
