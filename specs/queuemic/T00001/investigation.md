# Investigation Report: Pusher message usage spikes (133 messages from one song)

> **Ticket:** `T00001` (queuemic) — this file is `.agents/specs/queuemic/T00001/investigation.md`; fix it on branch `T00001`.
> **Run:** v1 — 2026-10-09 — initial.

## 1. Summary
- **Investigation Type**: Performance / third-party quota usage
- **Project**: QueueMic (Laravel `backend/` + Expo/React Native `mobapp/`). Neither SubHRMS nor ScaleUP — those project-specific rules (FK, portal, Vue/React conventions) were not applied. Backend pattern used here: thin controller + `app/Actions/<Domain>/` static `execute()`.
- **Target Domain & Module**: Playback / realtime broadcasting
- **Confidence Level**: **High** on the mechanism (code + Pusher's documented counting). **Medium** on the exact figure of 133, because it depends on song length and the number of connected devices, which cannot be observed from code.

## 2. Issue Description
- **Expected Behavior**: Hosting a room and playing one song costs a handful of Pusher messages (song started, queue updated, a few state changes).
- **Actual Behavior**: After the host selected one song and it finished, the Pusher dashboard showed ~133 messages consumed, which looked like every request was doubled.
- **Steps to Reproduce**: Broadcaster set to `pusher` (`BROADCAST_CONNECTION=pusher`), host creates a room, picks a song, lets it play to the end, then check the Pusher dashboard message count.

## 3. Root Cause Analysis
- **Symptom**: A single song generates on the order of 100+ Pusher messages.
- **How Pusher counts**: One message published to a channel with N subscribers counts as **1 + N** ([Pusher: how message count is calculated](https://docs.bird.com/pusher/channels/channels/limits/how-is-my-message-count-calculated-in-channels)). Presence channels also count `member_added` / `member_removed`. Ping/pong and subscribe commands are not counted.
- **Discovered Code/Behavior**:
  1. **Periodic playback heartbeat.** While a song plays, the host app POSTs its position every 4 s. Each POST makes the server broadcast `playback.state_changed` to the room's presence channel. That is 15 broadcasts/minute for the whole song.
  2. **The sender hears its own broadcast (the "double").** `PlaybackStateChangedEvent` is broadcast without `toOthers()`, so the host is a subscriber and receives every heartbeat it just sent. The host's listener ignores it apart from a state compare, so that delivery is pure waste.
  3. **Extra bursts.** The heartbeat effect resets its throttle and sends immediately each time it re-runs (state flips such as paused → playing, or song change). The host also re-broadcasts its position on **every member join**. Song start publishes two events (`song.started` + `queue.updated`), each costing 1 + N.
- **Arithmetic that reproduces the report**: heartbeat count ≈ song length / 4 s. A ~3-minute song ≈ 44–45 heartbeats. With the host plus one guest connected, each heartbeat costs 1 publish + 2 deliveries = 3 messages, so 44 × 3 ≈ **133**. Host alone: 2 messages per heartbeat gives 66 heartbeats ≈ a 4.4-minute song. Both are plausible; the real song length and device count would settle it. Cost scales linearly with the number of guests in the room.
- **Evidence**:
  - [HostPlayerScreen.tsx:34](mobapp/src/screens/HostPlayerScreen.tsx#L34) `HEARTBEAT_INTERVAL_MS = 4000`
  - [HostPlayerScreen.tsx:102-117](mobapp/src/screens/HostPlayerScreen.tsx#L102-L117) interval sends `updatePlaybackState` every 4 s; `lastSentAt = 0` is reset whenever the effect re-runs (deps `playbackState`, `currentPlaying?.id`, `roomCode`)
  - [UpdatePlaybackStateAction.php:34-40](backend/app/Actions/Playback/UpdatePlaybackStateAction.php#L34-L40) every request broadcasts unconditionally
  - [PlaybackStateChangedEvent.php:13-30](backend/app/Events/PlaybackStateChangedEvent.php#L13-L30) `ShouldBroadcastNow` on `PresenceChannel('room.<code>')`; no `toOthers()` (only `HostTransferredEvent` uses it, at [TransferHostAction.php:48](backend/app/Actions/Room/TransferHostAction.php#L48))
  - [useEchoRoom.ts:98-109](mobapp/src/hooks/useEchoRoom.ts#L98-L109) host receives its own echo and discards it except for state sync
  - [useEchoRoom.ts:41-46, 78](mobapp/src/hooks/useEchoRoom.ts#L41-L46) `pushHostPosition()` fires an extra broadcast on each `.joining`
  - [StartNextSongAction.php:85-86](backend/app/Actions/Playback/StartNextSongAction.php#L85-L86) two broadcasts per song start
- **Ruled out**: duplicate subscription on one device (only `HostPlayerScreen` or `GuestRoomScreen` calls `useEchoRoom`, never both); double dispatch of an event (every event is fired once through `broadcast(...)`; no listeners re-dispatch); the 60 s presence heartbeat ([useEchoRoom.ts:242](mobapp/src/hooks/useEchoRoom.ts#L242)) is a plain HTTP write and does not broadcast.
- **Root Cause**: Realtime position sync is implemented as a constant 4-second broadcast stream through a metered Pusher channel, and each broadcast is billed once per subscriber, including the host who sent it.

## 4. Scope & Dependencies
- **Affected Files**: `mobapp/src/screens/HostPlayerScreen.tsx`, `mobapp/src/hooks/useEchoRoom.ts`, `backend/app/Actions/Playback/UpdatePlaybackStateAction.php`, `backend/app/Events/PlaybackStateChangedEvent.php`
- **Affected Database Tables / Models**: `PlaybackSession` (position persisted on every heartbeat). No schema change needed.
- **Affected API Endpoints / UI Views**: `POST /api/v1/rooms/{code}/playback/state`; Host player and Guest player sync (`syncAnchor`, drift resync in `HostVideoPlayer.tsx`).

## 5. Potential Solutions
| Option | Description | Pros | Cons | Risk & Complexity |
|---|---|---|---|---|
| A (Recommended) | Make the stream sparse: broadcast on real events (play, pause, seek, song change, member join) and reduce the periodic position broadcast to a slow drift-correction beat (e.g. every 20–30 s). Keep persisting the position server-side on each report, or reduce those writes too. Guests already extrapolate from `syncAnchor`. | ~5–7x fewer messages per song; no infra change | Guests correct drift less often; needs tuning against the drift tolerance | Low–Medium |
| B | Add `toOthers()` so the host stops receiving its own echo (client sends `X-Socket-ID` from `echo.socketId()`) | Saves 1 of every 1+N messages; trivial gain for large rooms | Smaller win alone; host still needs guest-originated state events (those still reach it) | Low |
| C | Switch `BROADCAST_CONNECTION` back to `reverb` (self-hosted, no message quota). The app already follows the backend config at runtime ([BroadcastAuthController.php:52-60](backend/app/Http/Controllers/Api/V1/BroadcastAuthController.php#L52-L60)) | Zero code change, immediate relief | Needs a reachable Reverb host; the stated plan is Pusher for production | Low |
| D | Do nothing, upgrade Pusher plan | None | Cost grows with guests x song length | n/a |

### Recommended Solution Rationale
A + B together. A removes the dominant cost (the 4 s timer), B removes the wasted self-delivery, and neither alters the architecture. C is a sensible stop-gap for development and testing while A/B are built.

## 6. Risk Assessment
- **Breaking Changes**: No API shape change. Behavior change: guests receive position updates less often.
- **Regression Potential**: Guest/host sync accuracy (`syncAnchor`, `resyncToRoom`, `DRIFT_TOLERANCE_SECONDS` in `HostVideoPlayer.tsx`); late-joiner position (covered by `pushHostPosition` and the server snapshot with `position_age_ms`).
- **Deployment & Migration Notes**: App release (EAS) needed for the client side; backend deploys independently. Old app versions keep sending 4 s heartbeats, so a server-side guard is also worth adding (skip the broadcast if state and position are unchanged within a window).

## 7. High-Level Implementation Plan
1. `[ ]` Measure first: in the Pusher Debug Console, count `playback.state_changed` events during one song to confirm the share of the 133.
2. `[x]` Modify `HostPlayerScreen.tsx`: lengthen the heartbeat interval (4 s → 15 s); play/pause/seek already send immediately via their own handlers.
3. `[x]` Modify `UpdatePlaybackStateAction.php`: persist always, broadcast only when state changed, a seek jumped (> 3 s from expected), or the 10 s window (`karaoke.playback_broadcast_window_seconds`) expired; also covers old app versions.
4. `[x]` Add `->toOthers()` to the broadcast and send `X-Socket-ID` from `playbackApi`.
5. `[ ]` Review `pushHostPosition()` on `.joining` for burst behavior in busy rooms (not changed; joins are rare relative to heartbeats).

### Testing & Verification Checklist
- [ ] Backend: `cd backend && php artisan test` (add a feature test that repeated identical heartbeats inside the window broadcast once, using `Event::fake` for `PlaybackStateChangedEvent`)
- [ ] Mobile: `cd mobapp && npx tsc --noEmit` and `npx expo lint`
- [ ] Manual: with `pusher` as broadcaster, play one full song with host + 1 guest and compare the dashboard count before and after; target is well under 30 messages
- [ ] Manual: guest stays in sync after host pause, resume and seek; a late joiner lands on the correct position

## Resolution — 2026-10-09
Applied options A + B. Host beat is now every 15 s (was 4 s); the server broadcasts only on state change, seek, song's first report, or once per 10 s window per song; the sender's own socket is excluded via `toOthers()` + `X-Socket-ID`. Expected cost for a ~3 min song with host + 1 guest drops from ~133 to roughly 20 messages (~12 beats x 1 publish + 1 delivery, plus song start). Added `tests/Feature/PlaybackBroadcastThrottleTest.php`. `php artisan test` (31 passed) and `npx tsc --noEmit` clean. Not yet verified: manual Pusher dashboard count and guest sync feel on real devices (checklist items 1 and manual cases remain).

### Follow-up — 2026-10-09
Measured after the fix: an 11:38 song with host + 1 guest used 112 Pusher messages (~46 beats x 2 + ~20 start/join/state events), matching the model above (previously ~500 for the same song). Host beat then raised from 15 s to 30 s to roughly halve it again (~60 expected); the 10 s server window is unchanged.

<!-- Run history -->
