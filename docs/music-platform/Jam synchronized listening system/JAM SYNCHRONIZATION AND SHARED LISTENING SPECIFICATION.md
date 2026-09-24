# CHAPTER 8

# JAM SYNCHRONIZATION AND SHARED LISTENING SPECIFICATION

## 8.1 Jam System Overview

The **Jam** feature shall allow multiple users to listen to the same music track as a synchronized group.

A Jam session shall contain:

* One Jam Host
* One or more Jam Participants
* A selected music track
* A playback state
* A realtime communication channel
* Synchronization information
* Jam access and privacy rules

The Jam system shall synchronize **playback state**, not the actual music audio.

```text
                    Jam Session
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
       Host            User B         User C
          │              │              │
          ▼              ▼              ▼
    Music Provider   Music Provider   Music Provider
          │              │              │
          ▼              ▼              ▼
      Local Player    Local Player    Local Player

              ▲
              │
       Playback State
              │
           Pusher
```

Each client independently obtains and plays the authorized music content.

---

# 8.2 Jam Synchronization Objectives

The synchronization system shall provide:

1. Synchronized play
2. Synchronized pause
3. Synchronized seeking
4. Synchronized track changes
5. Late-user synchronization
6. Reconnection recovery
7. Playback drift correction
8. State ordering
9. Host control
10. Participant state visibility
11. Multi-device consistency
12. Graceful handling of network latency

The goal is not necessarily to make every device play at exactly the same millisecond.

Instead, the system shall minimize playback drift within a reasonable tolerance.

---

# 8.3 Music Provider and Jam Service Separation

The Jam system shall remain independent from the selected music provider.

```text id="d2v4i8"
                Jam Service
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
   Realtime Service      Music Provider
          │                   │
          ▼                   ▼
     Sync Events          Audio/Metadata
```

The Jam service controls:

* Who is in the Jam
* Who is the host
* What track is selected
* Whether playback is active
* Current playback position
* State version
* Jam privacy
* Participant permissions

The music provider controls:

* Track catalog
* Track metadata
* Artwork
* Playback availability
* Actual audio delivery
* Provider-specific playback rules

---

# 8.4 Jam Playback Source

The application shall not download, copy, or redistribute protected music merely to synchronize playback.

The normal flow shall be:

```text
Music Provider
      │
      ▼
Client Music Player
      ▲
      │
Jam Playback State
      ▲
      │
Laravel + Realtime
```

The Jam server does not become a music streaming server.

This architecture reduces bandwidth requirements and keeps music delivery separated from realtime synchronization.

---

# 8.5 Jam State Model

The current Jam state shall contain information similar to:

```json id="d0r4f5"
{
  "jam_id": 100,
  "track_id": "track-123",
  "status": "playing",
  "position": 42.35,
  "server_timestamp": 1790000000000,
  "state_version": 18,
  "host_id": 25
}
```

Important fields include:

| Field              | Purpose                                           |
| ------------------ | ------------------------------------------------- |
| `jam_id`           | Identifies the Jam                                |
| `track_id`         | Identifies the current track                      |
| `status`           | Playing, paused, or stopped                       |
| `position`         | Playback position                                 |
| `server_timestamp` | Time at which the state was generated             |
| `state_version`    | Prevents stale state from overwriting newer state |
| `host_id`          | Identifies the current controller                 |

---

# 8.6 Playback States

The initial Jam playback states shall include:

```text
loading
playing
paused
stopped
ended
```

Example:

```text id="nuk8ne"
loading
   │
   ▼
playing
   │
   ├── pause ──► paused
   │
   ├── seek ──► playing
   │
   └── track change ──► loading
```

The exact state machine shall be enforced by the backend.

---

# 8.7 Jam State as the Source of Truth

The server-side Jam state shall be authoritative.

Clients shall not independently decide the official Jam state.

For example, if a participant locally pauses their player, this shall not automatically pause everyone else.

Instead:

```text id="a9w3q0"
Participant
    │
    ▼
Pause Request
    │
    ▼
Laravel
    │
    ├── Check Permission
    ├── Validate State
    └── Persist State
    │
    ▼
jam.pause
    │
    ▼
Participants
```

Only authorized commands shall change the shared Jam state.

---

# 8.8 Host Control

The initial Jam model shall use a host-controlled playback system.

The Jam Host may be authorized to:

* Play
* Pause
* Seek
* Change track
* End Jam

Participants may initially have read-only playback control.

A future collaborative mode may allow participants to control playback if enabled by the host.

Example:

```text id="sajq7f"
Jam Mode: Host Controlled

Host
 ├── Play
 ├── Pause
 ├── Seek
 ├── Change Track
 └── End Jam

Participant
 ├── Listen
 ├── View State
 └── Adjust Local Volume
```

Local volume shall not affect other participants.

---

# 8.9 Jam Privacy

A Jam may have different visibility modes.

Initial options may include:

```text
public
community
invite_only
private
```

Example:

| Privacy     | Access                                 |
| ----------- | -------------------------------------- |
| Public      | Discoverable users may join            |
| Community   | Members of selected community may join |
| Invite Only | Only invited users may join            |
| Private     | Explicitly authorized users            |

The backend shall enforce Jam access.

The frontend shall not rely on hidden UI controls as a security mechanism.

---

# 8.10 Creating a Jam

The creation flow shall be:

```text id="pj8p8m"
User
 │
 │ POST /api/v1/jams
 ▼
Laravel
 │
 ├── Authenticate
 ├── Validate
 ├── Create Jam
 ├── Create Host Membership
 └── Initialize Playback State
 │
 ▼
jam.created
 │
 ▼
Realtime Participants
```

Example request:

```json id="bh05kr"
{
  "name": "Friday Night Jam",
  "privacy": "invite_only"
}
```

---

# 8.11 Joining a Jam

A participant may join through:

* Jam invitation
* Community
* Shared Jam link
* Search
* User profile
* Direct invitation

Example:

```http
POST /api/v1/jams/100/join
```

The backend shall verify:

1. User authentication
2. Jam existence
3. Jam status
4. Privacy rules
5. Membership eligibility
6. Participant limits, if applicable

After joining, the client shall obtain the current Jam state.

---

# 8.12 Late Join Synchronization

A user joining an already active Jam shall not start from position `0`.

The client shall first retrieve the authoritative state.

Example:

```text id="kzqfrh"
Current Jam

Track: track-123
Status: playing
Position: 120.5
Server Timestamp: T
```

The new client receives:

```text
track-123
position=120.5
status=playing
```

It then loads the track and starts playback at the appropriate position.

---

# 8.13 Server Timestamp Synchronization

A major challenge is that client clocks may not be identical.

For example:

```text id="d3k9lo"
Server clock:  10:00:00.000
Client A:      10:00:00.120
Client B:      09:59:59.850
```

Therefore, the client should not blindly rely on its local clock.

The system may estimate the difference between client time and server time.

Conceptually:

```text id="5xxnwy"
Client
   │
   │ Request
   ▼
Server timestamp
   │
   ▼
Client calculates clock offset
```

The synchronization algorithm may use repeated samples to estimate the offset more accurately.

---

# 8.14 Clock Offset Estimation

A simplified approach may be:

```text id="j4rjiy"
request sent
      │
      ▼
server receives
      │
      ▼
server timestamp
      │
      ▼
response received
```

The client measures the round-trip time.

Conceptually:

```text
RTT = response_time - request_time
```

An estimated one-way network delay may be approximated as:

```text
network_delay ≈ RTT / 2
```

The client can then estimate the server clock offset.

The production implementation shall account for the fact that network latency may not be symmetrical.

---

# 8.15 Calculating Current Playback Position

For a playing Jam state:

```text
position_at_event = 42.35 seconds
server_timestamp = T
```

The expected current position may be calculated conceptually as:

```text
current_position =
    position_at_event +
    (current_server_time - server_timestamp)
```

The resulting position shall be bounded by the track duration.

For a paused state, the position shall remain fixed.

---

# 8.16 Example Playback Synchronization

Suppose the host presses Play at:

```text
Position: 42.35 seconds
Server timestamp: 100000 ms
```

A participant receives the event at:

```text
100250 ms
```

Ignoring additional clock-offset correction:

```text
Elapsed time = 250 ms
```

Therefore:

```text
Expected position ≈ 42.60 seconds
```

The participant should begin playback close to that position rather than simply starting at `42.35`.

This reduces synchronization error caused by network delivery time.

---

# 8.17 Play Synchronization

When the host presses Play:

```text id="2t1nkp"
Host
 │
 ▼
POST /jams/100/play
 │
 ▼
Laravel
 │
 ├── Validate host
 ├── Validate track
 ├── Set status = playing
 ├── Set position
 ├── Increment state_version
 └── Set server_timestamp
 │
 ▼
Broadcast jam.play
 │
 ├──► Participant A
 ├──► Participant B
 └──► Participant C
```

Each participant calculates the expected playback position based on the received timestamp.

---

# 8.18 Pause Synchronization

When the host pauses:

```text id="35yqhz"
Host
 │
 ▼
POST /jams/100/pause
 │
 ▼
Laravel
 │
 ▼
Persist:
status = paused
position = current_position
 │
 ▼
Broadcast jam.pause
```

All clients then stop at the authoritative position.

---

# 8.19 Seek Synchronization

When the host seeks:

```text id="k6xk91"
Host seeks → 120 seconds
       │
       ▼
POST /jams/100/seek
       │
       ▼
Laravel
       │
       ▼
position = 120
state_version++
       │
       ▼
jam.seek
```

Participants shall seek their local players to the corresponding synchronized position.

---

# 8.20 Track Change Synchronization

When the host selects another track:

```text id="tdn5zz"
Track A
   │
   ▼
Host selects Track B
   │
   ▼
Laravel
   │
   ├── Validate provider track
   ├── Update track
   ├── Reset position
   └── Increment state_version
   │
   ▼
jam.track_changed
```

Clients shall:

1. Stop or transition from the previous track.
2. Load the new track.
3. Obtain authorized playback information.
4. Prepare the player.
5. Start according to the Jam state.

---

# 8.21 Playback Drift

Playback drift occurs when two clients gradually move away from the same playback position.

Example:

```text id="t3dfh7"
Host:         100.00 sec
Participant A:100.12 sec
Participant B: 99.78 sec
Participant C:100.42 sec
```

Small drift is expected because of:

* Device performance
* Audio buffering
* Network conditions
* Provider behavior
* Browser/mobile limitations
* Playback timer precision

The Jam system shall periodically detect and correct meaningful drift.

---

# 8.22 Drift Threshold

The system shall define a configurable synchronization tolerance.

Conceptually:

```text id="i9pxf7"
Drift < tolerance
    │
    └── No correction

Drift >= tolerance
    │
    └── Apply correction
```

The exact threshold shall be determined through testing.

Different correction strategies may be used depending on the size of the drift.

---

# 8.23 Small Drift Correction

For small differences, the player may gradually correct playback speed if the selected music provider and playback technology allow it.

For example:

```text
Participant is slightly behind
        │
        ▼
Temporarily increase playback rate
        │
        ▼
Approach target position
        │
        ▼
Return to normal rate
```

This produces a smoother correction than repeatedly seeking.

However, playback-rate adjustment shall only be used when compatible with the provider and player implementation.

---

# 8.24 Large Drift Correction

For significant drift, direct seeking may be preferable.

Example:

```text id="q7d20v"
Expected: 180.00 sec
Actual:   174.00 sec
Difference: 6 sec
```

The client may seek directly to the expected position.

The correction threshold shall be configurable.

---

# 8.25 Periodic Jam State Synchronization

The system may perform periodic synchronization checks.

For example:

```text id="5c8e7p"
Client
  │
  ├── Receives realtime event
  │
  ├── Plays locally
  │
  ├── Monitors drift
  │
  └── Periodically verifies state
              │
              ▼
      GET /jams/{id}/state
```

The implementation should avoid excessive polling.

Realtime events should remain the primary mechanism for normal playback changes.

---

# 8.26 Realtime as Event Transport, API as Recovery

The architecture shall distinguish between normal synchronization and recovery.

```text id="5g6mrm"
Normal Operation
API command
   ↓
Persist
   ↓
Realtime Event
   ↓
Clients
```

Recovery:

```text id="y0th1w"
Realtime Lost
   ↓
Reconnect
   ↓
GET Current Jam State
   ↓
Synchronize
```

This allows the system to recover even if one or more realtime events were missed.

---

# 8.27 State Version Handling

Each authoritative Jam state update shall increment a version number.

Example:

```text
State 10 → Play
State 11 → Seek
State 12 → Pause
State 13 → Track Change
```

If a client has:

```text
current_state_version = 13
```

and receives:

```text
state_version = 11
```

it shall reject the stale update.

Conceptually:

```text
if incoming_version > current_version:
    apply()
else:
    ignore()
```

---

# 8.28 Concurrent Jam Commands

Multiple authorized devices may attempt to modify the Jam state.

For example:

```text
Host Device A → PLAY
Host Device B → PAUSE
```

The backend shall determine the authoritative ordering.

Database transactions, state versioning, timestamps, and authorization rules may be used to prevent inconsistent state.

The client shall not independently decide which command wins.

---

# 8.29 Host Disconnection

The system shall define what happens when the Jam Host disconnects.

Possible policies include:

### Policy A — Jam Continues

The Jam remains active.

```text
Host disconnects
      ↓
Jam continues
      ↓
Participants continue listening
```

### Policy B — Host Transfer

The system assigns another eligible participant as the new host.

```text
Host disconnects
      ↓
Select eligible participant
      ↓
New Host
```

### Policy C — Jam Ends

The Jam ends when the host leaves.

The initial implementation shall select one policy explicitly and document it in the Jam business rules.

---

# 8.30 Participant Disconnection

When a participant disconnects:

```text id="4ibw76"
Participant disconnects
        │
        ▼
Presence update
        │
        ▼
Jam participant state updated
```

The Jam should normally continue for other participants.

When the participant reconnects, they shall retrieve the latest Jam state and resynchronize.

---

# 8.31 Multiple Devices Per User

A user may potentially join the same Jam from multiple devices.

Example:

```text
John
 ├── Web
 ├── Mobile
 └── Desktop
```

The system shall identify the user and/or device when managing presence and playback state.

A future implementation may provide device-specific controls.

For initial implementation, the application should avoid allowing multiple devices to unintentionally compete for host control.

---

# 8.32 Jam Participant State

The system may maintain participant information such as:

```json id="f2f8cy"
{
  "user_id": 25,
  "jam_id": 100,
  "role": "host",
  "joined_at": "2026-09-24T10:00:00Z",
  "status": "connected"
}
```

Participant state shall be separated from playback state.

```text
Jam
 ├── Playback State
 └── Participants
```

---

# 8.33 Jam Host Permissions

The backend shall enforce permissions for Jam commands.

Example:

| Action       | Host |  Participant |
| ------------ | ---: | -----------: |
| View Jam     |  Yes |          Yes |
| Join         |  Yes |          Yes |
| Leave        |  Yes |          Yes |
| Play         |  Yes | Configurable |
| Pause        |  Yes | Configurable |
| Seek         |  Yes | Configurable |
| Change Track |  Yes | Configurable |
| End Jam      |  Yes |           No |

The exact collaborative controls may be configurable per Jam.

---

# 8.34 Jam Event Payload

A standard playback event may use:

```json id="x8av45"
{
  "event": "jam.play",
  "event_id": "evt_abc123",
  "jam_id": 100,
  "track_id": "track-123",
  "status": "playing",
  "position": 42.35,
  "server_timestamp": 1790000000000,
  "state_version": 18,
  "actor_id": 25
}
```

The `actor_id` identifies the user who initiated the operation.

Sensitive internal information shall not be included.

---

# 8.35 Jam State Endpoint

The authoritative current state shall be accessible through:

```http
GET /api/v1/jams/{jam}/state
```

Example:

```json id="2jtp7m"
{
  "success": true,
  "data": {
    "jam_id": 100,
    "track_id": "track-123",
    "status": "playing",
    "position": 42.35,
    "server_timestamp": 1790000000000,
    "state_version": 18,
    "host_id": 25
  }
}
```

This endpoint is important for:

* Initial Jam loading
* Late joining
* Reconnection
* Drift recovery
* Multiple-device synchronization
* Debugging

---

# 8.36 Client Jam State Machine

The frontend may maintain a local state machine:

```text id="2w2m3c"
DISCONNECTED
     │
     ▼
CONNECTING
     │
     ▼
SYNCING
     │
     ▼
READY
     │
     ├── PLAYING
     │
     ├── PAUSED
     │
     └── BUFFERING
```

If the realtime connection is lost:

```text id="0z6jep"
PLAYING
   │
   ▼
RECONNECTING
   │
   ▼
SYNCING
   │
   ▼
PLAYING
```

---

# 8.37 Music Player Abstraction

The frontend should not tightly couple Jam synchronization logic to a specific music provider.

Conceptually:

```text id="o7a8fy"
JamController
      │
      ▼
PlaybackController
      │
      ▼
MusicPlayerInterface
      │
      ├── Provider Player A
      ├── Provider Player B
      └── Future Provider
```

Possible interface operations:

```text
loadTrack()
play()
pause()
seek()
getPosition()
getDuration()
getState()
setVolume()
```

The exact interface depends on provider capabilities.

---

# 8.38 Jam Synchronization Service

The frontend may implement a dedicated service responsible for synchronization.

Example conceptual structure:

```text id="x2j0c4"
JamSyncService
├── connect()
├── disconnect()
├── syncState()
├── applyEvent()
├── calculatePosition()
├── detectDrift()
├── correctDrift()
└── handleReconnect()
```

This keeps synchronization logic separate from UI components.

---

# 8.39 Backend Jam Service

Laravel should also maintain a dedicated Jam service.

Example:

```text id="u1mx2g"
CreateJamService
JoinJamService
LeaveJamService
PlayJamService
PauseJamService
SeekJamService
ChangeJamTrackService
EndJamService
GetJamStateService
```

Controllers should remain thin.

Example:

```text
JamController
      │
      ▼
PlayJamService
      │
      ├── Authorization
      ├── Validation
      ├── Transaction
      ├── State Update
      └── Broadcast
```

---

# 8.40 Jam Database Model

The initial database design may include:

```text
jams
jam_members
jam_playback_states
```

Possible `jams` fields:

```text
id
name
host_id
privacy
status
created_at
updated_at
ended_at
```

Possible `jam_members` fields:

```text
id
jam_id
user_id
role
joined_at
left_at
created_at
updated_at
```

Possible `jam_playback_states` fields:

```text
id
jam_id
track_id
status
position
server_timestamp
state_version
updated_by
created_at
updated_at
```

The final schema may be adjusted during database design.

---

# 8.41 Jam State Transactions

Playback state changes shall use database transactions where multiple records must remain consistent.

For example:

```text id="hgj4sw"
BEGIN TRANSACTION

Validate Host
      ↓
Validate Track
      ↓
Update Playback State
      ↓
Increment State Version

COMMIT

Broadcast Event
```

Realtime events should preferably be broadcast only after the persistent transaction has successfully committed.

---

# 8.42 Event After Commit

The system shall avoid broadcasting an event representing data that was ultimately rolled back.

Conceptually:

```text id="l5q3y7"
Database Transaction
       │
       ├── Failure → Rollback → No authoritative event
       │
       └── Success
              │
              ▼
           Broadcast
```

This prevents clients from receiving state that does not exist in the database.

---

# 8.43 Jam Network Conditions

The synchronization system shall account for:

* High latency
* Packet loss
* Temporary disconnection
* Variable network speed
* Mobile network changes
* Provider buffering
* Browser throttling
* Device resource limitations

The system should degrade gracefully rather than continuously forcing playback corrections.

---

# 8.44 Jam Buffering

A participant may experience provider-side buffering.

Example:

```text id="qq1c0q"
Jam State
Playing at 120 sec
       │
       ▼
Participant player buffers
       │
       ▼
Actual playback delayed
```

The client should distinguish between:

```text
Jam synchronization state
```

and:

```text
Local player buffering state
```

A buffering client should not automatically modify the shared Jam state.

---

# 8.45 Jam End Behavior

When the host ends the Jam:

```text id="x13jcw"
POST /api/v1/jams/{jam}/end
        │
        ▼
Laravel
        │
        ▼
status = ended
        │
        ▼
jam.ended
        │
        ├──► Participant A
        ├──► Participant B
        └──► Participant C
```

Clients shall stop synchronized playback and display the appropriate ended state.

The Jam history may remain available depending on retention rules.

---

# 8.46 Jam History

The system may retain:

* Jam name
* Host
* Participants
* Track history
* Start time
* End time
* Duration
* Playback events where required

The system should avoid storing unnecessary high-frequency playback position records.

For example, it should not store:

```text
position every 100ms
```

unless there is a specific analytical requirement.

---

# 8.47 Jam Performance Requirements

The Jam system shall minimize:

* Realtime event frequency
* API requests
* Database writes
* Payload sizes
* Repeated provider requests
* Unnecessary synchronization corrections

The system should favor:

```text
Event-based synchronization
+
Local playback calculation
+
Periodic correction
```

rather than:

```text
Continuous server-controlled playback
```

---

# 8.48 Jam Security Requirements

The Jam subsystem shall enforce:

* Authentication
* Jam membership authorization
* Host permissions
* Privacy rules
* Track/provider restrictions
* Rate limits
* Request validation
* Private realtime channel authorization
* Secure API communication
* Abuse prevention

Participants shall not be able to modify Jam state simply by manually calling a frontend function.

---

# 8.49 Jam Rate Limiting

Jam commands shall be rate-limited where appropriate.

Potentially protected operations include:

```text
Play
Pause
Seek
Change Track
Join
Leave
```

This prevents malicious or accidental clients from flooding the realtime system.

For example, continuous seeking should not generate unlimited backend state updates.

---

# 8.50 Jam Testing Strategy

The Jam system shall be tested under:

### Functional Conditions

* Create Jam
* Join Jam
* Leave Jam
* Play
* Pause
* Seek
* Change track
* End Jam

### Synchronization Conditions

* Same network
* High latency
* Different network speeds
* Mobile network
* Reconnection
* Late joining
* Long playback sessions
* Multiple participants

### Failure Conditions

* Pusher unavailable
* API unavailable
* Music provider unavailable
* Browser sleep
* Device switching networks
* Host disconnect
* Participant disconnect

### Concurrency Conditions

* Multiple join requests
* Multiple playback commands
* Multiple devices
* Simultaneous reactions/chat while Jam is active

---

# 8.51 Jam Acceptance Criteria

The initial Jam implementation shall satisfy the following:

1. A user can create a Jam.
2. A user can join an authorized Jam.
3. Participants can see the current Jam state.
4. The host can play a track.
5. Participants begin playback near the authoritative position.
6. The host can pause playback.
7. Participants pause near the same position.
8. The host can seek.
9. Participants synchronize to the new position.
10. The host can change tracks.
11. Participants load the new track.
12. Late participants synchronize to the current state.
13. Reconnected participants recover the current state.
14. Stale state does not overwrite newer state.
15. Unauthorized users cannot control the Jam.
16. Realtime events do not transmit the actual music audio.
17. The system continues to use persistent state as the source of truth.

---

# 8.52 Jam Functional Requirements

The Jam synchronization requirements shall use the following identifiers:

* **FR-JAM-SYNC-001** — Create synchronized Jam
* **FR-JAM-SYNC-002** — Join active Jam
* **FR-JAM-SYNC-003** — Retrieve current Jam state
* **FR-JAM-SYNC-004** — Synchronize play state
* **FR-JAM-SYNC-005** — Synchronize pause state
* **FR-JAM-SYNC-006** — Synchronize seek state
* **FR-JAM-SYNC-007** — Synchronize track changes
* **FR-JAM-SYNC-008** — Synchronize late participants
* **FR-JAM-SYNC-009** — Handle playback drift
* **FR-JAM-SYNC-010** — Perform state versioning
* **FR-JAM-SYNC-011** — Reject stale states
* **FR-JAM-SYNC-012** — Handle realtime reconnection
* **FR-JAM-SYNC-013** — Recover from missed events
* **FR-JAM-SYNC-014** — Enforce host permissions
* **FR-JAM-SYNC-015** — Support Jam privacy
* **FR-JAM-SYNC-016** — Handle host disconnection
* **FR-JAM-SYNC-017** — Handle participant disconnection
* **FR-JAM-SYNC-018** — Support multiple devices
* **FR-JAM-SYNC-019** — Separate music provider from Jam service
* **FR-JAM-SYNC-020** — Prevent unauthorized audio redistribution
* **FR-JAM-SYNC-021** — Apply Jam command rate limits
* **FR-JAM-SYNC-022** — Maintain authoritative server state

---

# 8.53 Overall Jam Architecture

The complete architecture can be represented as:

```text
                         ┌─────────────────────┐
                         │    Music Provider   │
                         │ Catalog / Playback  │
                         └──────────┬──────────┘
                                    │
                              Audio / Metadata
                                    │
                  ┌─────────────────┼─────────────────┐
                  │                 │                 │
                  ▼                 ▼                 ▼
               Host Player      User B Player      User C Player
                  ▲                 ▲                 ▲
                  │                 │                 │
                  └─────────────────┼─────────────────┘
                                    │
                            Playback State
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │    Laravel Jam      │
                         │      Service        │
                         └──────────┬──────────┘
                                    │
                             Persistent State
                                    │
                                    ▼
                              PostgreSQL
                                    │
                                    │
                             Realtime Events
                                    │
                                    ▼
                              ┌──────────┐
                              │  Pusher  │
                              └────┬─────┘
                                   │
                   ┌───────────────┼───────────────┐
                   ▼               ▼               ▼
                Host Client    User B Client    User C Client
```

The important architectural principle is:

> **The server synchronizes playback state; the clients play the music.**

This prevents the Laravel backend from becoming a high-bandwidth music streaming server and keeps the Jam feature modular and provider-independent.

---

# 8.54 Chapter Summary

The Jam subsystem shall provide synchronized group listening through a combination of:

* Laravel API
* Jam domain services
* PostgreSQL persistent state
* Pusher realtime events
* Client-side music players
* Server timestamps
* State versions
* Drift detection
* Reconnection recovery
* Host authorization

The system shall avoid sending the actual music audio through the realtime infrastructure.

The synchronization model shall instead communicate compact playback commands and state:

```text
PLAY
PAUSE
SEEK
TRACK_CHANGED
```

together with information such as:

```text
track_id
position
server_timestamp
state_version
```

This architecture allows multiple clients to independently play authorized music while maintaining a shared listening experience.

The design also provides a clear separation between:

```text
Music Provider
      │
      └── Provides music

Jam Service
      │
      └── Manages shared listening state

Realtime Provider
      │
      └── Distributes state changes

Client Player
      │
      └── Plays the music
```

This separation is fundamental to making the Jam feature scalable, maintainable, and adaptable to different music providers.
