# CHAPTER 7

# REALTIME COMMUNICATION AND EVENT SPECIFICATION

## 7.1 Realtime System Overview

The **[Project Name] — Social Music & Community Platform** requires realtime communication for features that depend on immediate state updates between connected users.

Realtime communication shall be used for:

* Message delivery
* Message updates
* Message deletion
* Reactions
* Typing indicators
* Read states
* User presence
* Group updates
* Community updates
* Channel activity
* Notifications
* Jam participation
* Jam playback synchronization

The system shall use a realtime event architecture separate from the primary REST API.

The REST API shall remain responsible for authoritative operations and persistent data, while the realtime layer shall distribute resulting events to connected clients.

```text
                         Laravel API
                             │
                 ┌───────────┴───────────┐
                 │                       │
                 ▼                       ▼
          Persistent State         Realtime Events
          PostgreSQL/Redis              │
                                        ▼
                                  Pusher / Reverb
                                        │
                     ┌──────────────────┼──────────────────┐
                     ▼                  ▼                  ▼
                 React Web        React Native          Tauri
```

---

# 7.2 Realtime Architecture Principles

The realtime architecture shall follow these principles:

1. Persistent data remains authoritative.
2. Realtime events communicate state changes.
3. Clients shall not be trusted to authorize themselves.
4. Private resources shall use authenticated channels.
5. Realtime events shall be provider-independent.
6. Events shall contain sufficient information for clients to update their state.
7. Duplicate events shall be handled safely.
8. Clients shall support reconnection.
9. Temporary states shall not unnecessarily be persisted.
10. High-frequency events shall be throttled or debounced.
11. Realtime providers shall not transport protected music audio.
12. Jam synchronization shall use compact playback state events.

---

# 7.3 Realtime Provider Architecture

The initial architecture shall use **Pusher** as the primary hosted realtime provider.

During development, **Laravel Reverb** may be used as a fallback or local development realtime server.

Conceptually:

```text
Production

Laravel
   │
   ▼
Pusher
   │
   ├── Web
   ├── Mobile
   └── Desktop
```

Development:

```text
                 Realtime Layer
                      │
             ┌────────┴────────┐
             ▼                 ▼
          Pusher            Reverb
          Primary          Fallback
```

The application shall avoid placing provider-specific business logic inside domain services.

---

# 7.4 Provider-Independent Event Architecture

Application events shall represent business events rather than provider-specific events.

For example:

```text
MessageSent
MessageReacted
MessageDeleted
JamPlayed
JamPaused
JamSeeked
```

The realtime infrastructure shall then translate or broadcast those events through the selected provider.

This allows the system to replace Pusher without redesigning the messaging or Jam domain.

```text
Domain Event
     │
     ▼
Broadcasting Layer
     │
     ├── Pusher
     └── Reverb
```

---

# 7.5 Realtime Channel Types

The system shall use different channel types depending on the required access model.

Primary channel types:

* Private channels
* Presence channels
* Public channels where appropriate

Private channels shall be used for protected user or conversation data.

Presence channels shall be used when the system needs to track connected members.

---

# 7.6 User Private Channel

Each authenticated user may have a private personal channel.

Conceptual channel:

```text
private-user.{userId}
```

Example:

```text
private-user.25
```

This channel may deliver:

* Personal notifications
* Security events
* Direct message notifications
* Invitation notifications
* Account-related updates
* Jam invitations
* System notifications

Only the authenticated user should be authorized to subscribe to their personal channel.

---

# 7.7 Conversation Private Channel

Each conversation may have its own private realtime channel.

```text
private-conversation.{conversationId}
```

Example:

```text
private-conversation.100
```

Events may include:

```text
message.sent
message.updated
message.deleted
message.reaction_added
message.reaction_removed
message.typing
message.read
```

Before channel subscription is authorized, the backend shall verify that the authenticated user is a member of the conversation.

---

# 7.8 Community Presence Channel

Communities may use presence channels when realtime member presence is required.

```text
presence-community.{communityId}
```

Presence information may include:

```text
user_id
display_name
avatar_url
status
```

The client shall not assume that presence information represents the user's exact physical activity.

It shall represent the application's current connection or presence state.

---

# 7.9 Jam Presence Channel

Each active Jam may use a presence channel:

```text
presence-jam.{jamId}
```

Example:

```text
presence-jam.500
```

The channel may provide:

* Participant list
* Participant join events
* Participant leave events
* Host status
* Connection status

The persistent database remains responsible for authoritative Jam membership.

---

# 7.10 Channel Authorization

Private and presence channels shall require backend authorization.

Conceptually:

```text
Client
  │
  │ Subscribe
  ▼
Pusher
  │
  │ Authorization Request
  ▼
Laravel
  │
  ├── Authenticate User
  ├── Find Resource
  └── Check Permission
  │
  ├──────────────┐
  ▼              ▼
Allowed        Denied
  │              │
  ▼              ▼
Subscribe      Reject
```

For a conversation channel, the backend shall verify conversation membership.

For a Jam channel, the backend shall verify Jam access.

---

# 7.11 Messaging Realtime Flow

When a user sends a message:

```text
User A
  │
  ▼
POST /api/v1/conversations/100/messages
  │
  ▼
Laravel
  │
  ├── Authenticate
  ├── Authorize
  ├── Validate
  └── Save Message
  │
  ▼
MessageSent
  │
  ▼
Pusher
  │
  ▼
private-conversation.100
  │
  ├───────────────┐
  ▼               ▼
User B          User C
```

The message shall first become persistent application data before being treated as successfully delivered through realtime.

---

# 7.12 Message Sent Event

Event name:

```text
message.sent
```

Example payload:

```json
{
  "event": "message.sent",
  "message": {
    "id": 5012,
    "conversation_id": 100,
    "sender_id": 25,
    "type": "text",
    "content": "Hello everyone!",
    "created_at": "2026-09-24T10:30:00Z"
  }
}
```

The payload should contain enough information for the receiving client to update its local message state.

---

# 7.13 Message Updated Event

Event:

```text
message.updated
```

Example:

```json
{
  "event": "message.updated",
  "message": {
    "id": 5012,
    "content": "Updated message",
    "edited_at": "2026-09-24T10:35:00Z"
  }
}
```

Clients shall update the existing message rather than creating a new message entry.

---

# 7.14 Message Deleted Event

Event:

```text
message.deleted
```

Example:

```json
{
  "event": "message.deleted",
  "message_id": 5012,
  "conversation_id": 100,
  "deleted_at": "2026-09-24T10:40:00Z"
}
```

The client may replace the content with a deleted-message state depending on the application's message deletion policy.

---

# 7.15 Reaction Added Event

Event:

```text
message.reaction_added
```

Example:

```json
{
  "event": "message.reaction_added",
  "message_id": 5012,
  "reaction": {
    "id": 700,
    "user_id": 30,
    "reaction": "👍"
  }
}
```

Clients shall merge the reaction into the existing message state.

The client shall not replace the entire reaction collection based on a single reaction event.

---

# 7.16 Reaction Removed Event

Event:

```text
message.reaction_removed
```

Example:

```json
{
  "event": "message.reaction_removed",
  "message_id": 5012,
  "reaction_id": 700,
  "user_id": 30,
  "reaction": "👍"
}
```

Clients shall remove only the specified reaction.

This prevents unrelated reactions from disappearing when another user removes their reaction.

---

# 7.17 Typing Events

Typing indicators shall be temporary realtime events.

Example:

```text
message.typing
```

Payload:

```json
{
  "conversation_id": 100,
  "user_id": 30,
  "is_typing": true
}
```

The client shall automatically expire typing indicators after a short timeout.

Typing indicators shall not normally be persisted in PostgreSQL.

The frontend should also stop displaying the indicator when:

* The user stops typing.
* A timeout expires.
* A message is received from the typing user.
* The user leaves the conversation.

---

# 7.18 Read State Events

Event:

```text
message.read
```

Example:

```json
{
  "conversation_id": 100,
  "user_id": 30,
  "message_id": 5012,
  "read_at": "2026-09-24T10:42:00Z"
}
```

The event allows other clients to update read indicators without repeatedly polling the backend.

---

# 7.19 Presence Events

Presence-related events may include:

```text
user.online
user.offline
user.presence_updated
```

Example:

```json
{
  "event": "user.presence_updated",
  "user_id": 25,
  "status": "online"
}
```

Presence shall be treated as ephemeral state.

The database may retain a last-seen timestamp, but realtime connection state should generally be maintained by the realtime infrastructure.

---

# 7.20 Group Realtime Events

Group operations may produce:

```text
group.created
group.updated
group.member_added
group.member_removed
```

Example:

```json
{
  "event": "group.member_added",
  "group_id": 50,
  "user": {
    "id": 42,
    "username": "user42"
  }
}
```

Only authorized group members shall receive protected group events.

---

# 7.21 Community Realtime Events

Community events may include:

```text
community.created
community.updated
community.member_joined
community.member_left
channel.created
channel.updated
```

For example:

```json
{
  "event": "channel.created",
  "community_id": 20,
  "channel": {
    "id": 100,
    "name": "music-chat",
    "type": "text"
  }
}
```

Private community and channel information shall only be broadcast to authorized members.

---

# 7.22 Notification Realtime Events

Notifications may be delivered through:

```text
private-user.{userId}
```

Example:

```json
{
  "event": "notification.created",
  "notification": {
    "id": 900,
    "type": "message",
    "title": "New message",
    "read_at": null
  }
}
```

The notification should also be persisted in the database when it is intended to survive disconnection.

This creates two complementary mechanisms:

```text
Database
   │
   └── Persistent notification

Pusher
   │
   └── Immediate notification delivery
```

---

# 7.23 Jam Realtime Architecture

Jam requires a specialized realtime model because playback state must be synchronized between multiple independent clients.

The architecture shall be:

```text
                    Music Provider
                         │
                         │ Audio
                         ▼
                   Client Player
                         ▲
                         │
                    Playback State
                         │
Host ───────► Laravel Jam Service
                         │
                         ▼
                       Pusher
                         │
             ┌───────────┼───────────┐
             ▼           ▼           ▼
          Client A    Client B    Client C
```

The realtime service shall distribute playback commands and state.

The actual music audio shall not be transmitted through Pusher or Laravel.

---

# 7.24 Jam Event Types

The initial Jam events shall be:

```text
jam.created
jam.joined
jam.left
jam.play
jam.pause
jam.seek
jam.track_changed
jam.ended
jam.state_updated
```

Each event shall include enough state information for a client to recover or reconcile playback.

---

# 7.25 Jam Play Event

Example:

```json
{
  "event": "jam.play",
  "jam_id": 100,
  "track_id": "track-123",
  "position": 42.35,
  "server_timestamp": 1790000000000,
  "state_version": 18
}
```

A receiving client may calculate its expected playback position using:

```text
expected_position =
    position +
    (current_server_time - server_timestamp)
```

when the playback state is intended to continue playing.

The exact synchronization algorithm shall be finalized during the Jam implementation and testing phase.

---

# 7.26 Jam Pause Event

Example:

```json
{
  "event": "jam.pause",
  "jam_id": 100,
  "track_id": "track-123",
  "position": 58.21,
  "server_timestamp": 1790000015000,
  "state_version": 19
}
```

The client shall stop playback at or near the supplied position.

---

# 7.27 Jam Seek Event

Example:

```json
{
  "event": "jam.seek",
  "jam_id": 100,
  "track_id": "track-123",
  "position": 120.45,
  "server_timestamp": 1790000030000,
  "state_version": 20
}
```

The client shall seek to the appropriate position and continue playback according to the current Jam state.

---

# 7.28 Jam Track Changed Event

Example:

```json
{
  "event": "jam.track_changed",
  "jam_id": 100,
  "track_id": "track-456",
  "position": 0,
  "server_timestamp": 1790000050000,
  "state_version": 21
}
```

The receiving client shall load the corresponding track through the authorized music provider.

The event does not contain the actual audio.

---

# 7.29 Jam State Versioning

Jam events shall include a state version where appropriate.

Example:

```text
State 20
State 21
State 22
```

If a client receives:

```text
State 22
State 21
```

it shall not allow State 21 to overwrite State 22.

Conceptually:

```text
if incoming.state_version <= current.state_version:
    ignore
else:
    apply
```

This helps protect against delayed or out-of-order realtime events.

---

# 7.30 Jam Reconnection

Realtime connections may be interrupted because of:

* Network changes
* Browser suspension
* Mobile backgrounding
* Temporary provider failure
* Wi-Fi/mobile-data switching
* Device sleep
* Server restart

After reconnecting, the client shall obtain the current authoritative Jam state.

```text
Realtime Connection Lost
          │
          ▼
       Reconnect
          │
          ▼
GET /api/v1/jams/{jam}/state
          │
          ▼
Compare State Version
          │
          ▼
Synchronize Player
```

The REST API therefore acts as the recovery mechanism when realtime delivery is incomplete.

---

# 7.31 Duplicate Event Handling

Clients shall safely handle duplicate realtime events.

For example:

```text
message.sent #5012
message.sent #5012
```

The client should not display the same message twice.

Possible mechanisms include:

* Unique message IDs
* Event IDs
* State versions
* Local deduplication maps
* Server-generated identifiers

Persistent database IDs should be treated as authoritative resource identifiers.

---

# 7.32 Optimistic UI

The frontend may use optimistic UI for interactions such as:

* Sending messages
* Adding reactions
* Removing reactions
* Starting playback
* Pausing playback
* Seeking

Example:

```text
User clicks reaction
       │
       ▼
UI immediately updates
       │
       ▼
API request
       │
   ┌───┴────┐
   ▼        ▼
Success   Failure
   │        │
   ▼        ▼
Keep      Rollback
```

Optimistic state shall be reconciled with the authoritative backend response and realtime events.

---

# 7.33 Realtime Event Ordering

Not all realtime events are guaranteed to arrive in the exact order generated.

The system shall therefore use:

* Timestamps
* Resource IDs
* State versions
* Event IDs
* Server-generated ordering information where required

For Jam playback, `state_version` shall be particularly important.

For messages, message IDs and server timestamps shall be used to maintain correct ordering.

---

# 7.34 Realtime Event Payload Standards

Realtime payloads should use a consistent structure.

Conceptually:

```json
{
  "event": "event.name",
  "event_id": "evt_123",
  "occurred_at": "2026-09-24T10:30:00Z",
  "resource": {
    "id": 100
  },
  "data": {}
}
```

Not every event must contain every field.

However, events should avoid unnecessary payload size because realtime traffic can become significant at scale.

---

# 7.35 Realtime Security

Realtime security shall include:

* Private channel authorization
* Presence channel authorization
* Authentication
* Resource membership checks
* Role checks
* Server-side authorization
* Secure provider credentials
* HTTPS/WSS
* Event payload filtering
* No sensitive secrets in payloads

For example, a user who is not a member of a private conversation shall not be allowed to subscribe to:

```text
private-conversation.100
```

even if the user knows the conversation ID.

---

# 7.36 Sensitive Data Protection

Realtime events shall contain only information required by the receiving client.

The system shall not broadcast:

* Passwords
* Authentication tokens
* API secrets
* Private provider credentials
* Internal security information
* Unnecessary personal data
* Internal database metadata

API Resources or dedicated event payload transformers should be used to control exposed fields.

---

# 7.37 Pusher Message Efficiency

Realtime traffic shall be designed carefully to avoid unnecessary message volume.

The system should avoid sending high-frequency events such as:

```text
playback position every 100ms
```

Instead, a Jam may send:

```text
PLAY
position = 42.35
server_timestamp = ...
```

The clients then calculate local playback position.

Periodic synchronization may be performed when necessary.

This reduces realtime traffic while maintaining synchronization.

---

# 7.38 Typing and Presence Optimization

Typing and presence events may occur frequently.

The system shall use:

* Debouncing
* Throttling
* Expiration timers
* Event batching where appropriate
* Client-side state management

For example:

```text
User types:
A → typing
B → typing
C → typing
D → typing
```

should not necessarily result in a realtime event for every keystroke.

Instead, the client may maintain a short typing state and notify the server/realtime layer at controlled intervals.

---

# 7.39 Connection State Management

Clients shall maintain a realtime connection state.

Possible states:

```text
connected
connecting
reconnecting
disconnected
failed
```

The UI may display appropriate feedback.

Example:

```text
Connected
   ↓
Network Lost
   ↓
Reconnecting...
   ↓
Connected
```

During temporary disconnection, the application shall continue to use REST APIs where possible.

---

# 7.40 Offline and Recovery Behavior

The system shall distinguish between:

* REST API availability
* Realtime availability
* Music provider availability
* Storage availability

For example:

```text
Realtime Offline
      │
      ├── Existing messages → still viewable
      ├── REST API → may still work
      ├── New realtime updates → delayed
      └── Jam synchronization → temporarily unavailable
```

The UI shall communicate meaningful connection status rather than silently failing.

---

# 7.41 Pusher Primary and Reverb Fallback

During development, the application may implement:

```text
Pusher
   │
   ├── Connected → use Pusher
   │
   └── Connection Failure
             │
             ▼
          Reverb
```

The fallback mechanism shall avoid subscribing to both providers simultaneously for the same event unless duplicate handling is explicitly designed.

Otherwise, a single message may be received twice.

The preferred implementation is provider selection rather than dual broadcasting.

---

# 7.42 Production Realtime Configuration

For the initial production deployment, Pusher may be used as the primary realtime infrastructure.

Conceptually:

```text
Production

Laravel
   │
   ▼
Pusher
   │
   ├── Web
   ├── Mobile
   └── Desktop
```

Laravel Reverb may remain a development or future self-hosted option depending on deployment infrastructure.

If Reverb is later used in production, it shall require a persistent WebSocket process and appropriate process supervision and reverse-proxy configuration.

---

# 7.43 Realtime and Background Jobs

Realtime events and background jobs shall remain separate concerns.

For example:

```text
Message Sent
     │
     ├── Save immediately
     │
     └── Broadcast realtime event

Email Notification
     │
     └── Queue background job
```

Slow tasks shall not unnecessarily delay realtime operations.

Potential background tasks include:

* Email notifications
* Media processing
* Search indexing
* Audit processing
* Cleanup
* Provider synchronization

---

# 7.44 Realtime Failure Handling

If realtime broadcasting fails after a database transaction succeeds, the persistent record shall remain valid.

For example:

```text
Message saved
    │
    ▼
Broadcast fails
```

The message shall still exist in PostgreSQL.

When the recipient reconnects or refreshes the conversation, the API shall return the persisted message.

This prevents the realtime provider from becoming the source of truth.

---

# 7.45 Realtime Monitoring

The system shall monitor:

* Connection counts
* Connection failures
* Reconnection rates
* Event failures
* Broadcast latency
* Provider errors
* Jam synchronization errors
* Realtime authentication failures

Application logs shall include enough context to trace important realtime failures.

Where appropriate, events may include a correlation or request ID.

---

# 7.46 Realtime Testing Requirements

Realtime functionality shall be tested for:

* Message delivery
* Reaction synchronization
* Typing indicators
* Presence
* Read state
* Group updates
* Community updates
* Jam synchronization
* Event ordering
* Duplicate events
* Reconnection
* Network interruption
* Provider failure
* Authorization failures
* Multiple devices
* Multiple simultaneous users

Jam testing shall additionally evaluate playback drift under different network conditions.

---

# 7.47 Realtime Functional Requirements

The realtime subsystem shall use the following requirement identifiers:

* **FR-RT-001** — Realtime connection management
* **FR-RT-002** — Private channel authorization
* **FR-RT-003** — Presence channel authorization
* **FR-RT-004** — User notification events
* **FR-RT-005** — Message delivery events
* **FR-RT-006** — Message update events
* **FR-RT-007** — Message deletion events
* **FR-RT-008** — Reaction events
* **FR-RT-009** — Typing indicators
* **FR-RT-010** — Read-state events
* **FR-RT-011** — User presence
* **FR-RT-012** — Group events
* **FR-RT-013** — Community events
* **FR-RT-014** — Channel events
* **FR-RT-015** — Jam participant events
* **FR-RT-016** — Jam playback events
* **FR-RT-017** — Jam state versioning
* **FR-RT-018** — Reconnection handling
* **FR-RT-019** — Duplicate event handling
* **FR-RT-020** — Provider abstraction
* **FR-RT-021** — Pusher integration
* **FR-RT-022** — Reverb development fallback
* **FR-RT-023** — Realtime security
* **FR-RT-024** — Realtime monitoring
* **FR-RT-025** — Realtime failure recovery

---

# 7.48 Realtime Architecture Summary

The realtime architecture shall separate persistent application state from temporary event delivery.

The overall flow is:

```text
                    REST API
                       │
                       ▼
                 Laravel Backend
                       │
              ┌────────┴────────┐
              ▼                 ▼
         PostgreSQL          Realtime
        Source of Truth         │
                                ▼
                        Pusher / Reverb
                                │
             ┌──────────────────┼──────────────────┐
             ▼                  ▼                  ▼
          Web Client       Mobile Client      Desktop Client
```

For messaging, the backend persists the message and broadcasts the resulting event.

For presence and typing, the realtime layer handles temporary state.

For Jam, the backend manages authoritative playback state while each client independently obtains and plays authorized music content.

The architecture therefore provides realtime interaction without making the realtime provider the permanent source of application data.

This separation also allows the system to change realtime providers in the future without requiring a redesign of the core messaging, community, or Jam domains.
