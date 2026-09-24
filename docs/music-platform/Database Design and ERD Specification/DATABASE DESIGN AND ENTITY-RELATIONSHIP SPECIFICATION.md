# CHAPTER 5

# DATABASE DESIGN AND ENTITY-RELATIONSHIP SPECIFICATION

## 5.1 Database Design Overview

The **[Project Name] — Social Music & Community Platform** shall use a relational database architecture to manage persistent application data.

PostgreSQL shall serve as the primary database management system because the platform contains highly related entities such as users, conversations, messages, communities, channels, notifications, Jams, and access-control relationships.

The database design shall prioritize:

* Data integrity
* Referential integrity
* Normalization
* Query performance
* Scalability
* Security
* Maintainability
* Consistent relationships
* Efficient pagination
* Auditability
* Controlled data retention

The database shall serve as the authoritative source of truth for persistent application data.

---

# 5.2 Database Architecture

The high-level database architecture shall follow:

```text
                         PostgreSQL
                              │
          ┌───────────────────┼────────────────────┐
          │                   │                    │
          ▼                   ▼                    ▼
       Identity           Messaging            Community
          │                   │                    │
          ▼                   ▼                    ▼
       Users             Messages              Channels
       Profiles          Reactions             Members
       Settings          Mentions              Roles
          │              Attachments
          │
          ├─────────────────────┐
          │                     │
          ▼                     ▼
       Music                  Jam
          │                     │
          ▼                     ▼
      Music Metadata       Jam Rooms
                           Members
                           Playback State
          │                     │
          └──────────┬──────────┘
                     ▼
               Notifications
                     │
                     ▼
                 Audit Logs
```

Redis, the realtime provider, and external services shall not replace PostgreSQL as the primary persistent data store.

---

# 5.3 Database Design Principles

The database shall follow the following principles.

### 5.3.1 Normalization

Core transactional data shall generally follow normalized relational design to minimize unnecessary duplication.

For example, a message shall reference the user who created it rather than duplicating the user's complete profile information.

```text
messages
   │
   └── sender_id ──────► users.id
```

### 5.3.2 Referential Integrity

Foreign-key relationships shall be used where appropriate to prevent orphaned records.

For example:

```text
conversation_members.conversation_id
              │
              ▼
       conversations.id
```

### 5.3.3 Explicit Relationships

Many-to-many relationships shall use dedicated pivot tables.

Examples:

```text
users
  │
  ├── conversation_members
  │
  ├── community_members
  │
  └── jam_members
```

### 5.3.4 Soft Deletion

Soft deletion shall be used for entities where historical references need to be retained.

Potential examples include:

* Users
* Messages
* Communities
* Files
* Channels

Soft deletion shall not automatically be applied to every table. The appropriate strategy shall depend on the data's lifecycle requirements.

---

# 5.4 Primary Entities

The initial database shall contain the following major entities:

| Entity               | Purpose                                         |
| -------------------- | ----------------------------------------------- |
| users                | User accounts                                   |
| profiles             | Public/user profile information                 |
| user_settings        | User preferences                                |
| user_sessions        | Active/authentication sessions where applicable |
| conversations        | Direct and group conversations                  |
| conversation_members | Conversation membership                         |
| messages             | Message records                                 |
| message_reactions    | Message reactions                               |
| message_mentions     | User mentions                                   |
| message_reads        | Read state                                      |
| message_attachments  | Message file relationships                      |
| groups               | Group conversation metadata                     |
| communities          | Community spaces                                |
| community_members    | Community membership                            |
| community_roles      | Community role definitions                      |
| channels             | Community channels                              |
| channel_members      | Channel access where required                   |
| notifications        | Persistent notifications                        |
| jams                 | Jam sessions                                    |
| jam_members          | Jam participants                                |
| jam_playback_states  | Jam playback state                              |
| music_tracks         | Provider-normalized music metadata              |
| music_history        | User listening history                          |
| user_saved_tracks    | Saved/favorite tracks                           |
| files                | Uploaded file metadata                          |
| reports              | User/content reports                            |
| audit_logs           | Security and administrative activity            |
| system_settings      | System-level configuration where appropriate    |

Some tables may be combined or introduced later depending on the final implementation.

---

# 5.5 Users Table

The `users` table shall contain authentication and core account information.

Conceptual structure:

```text
users
--------------------------------
id
username
email
password
status
email_verified_at
last_login_at
created_at
updated_at
deleted_at
```

### Important Fields

| Field             | Purpose                  |
| ----------------- | ------------------------ |
| id                | Primary key              |
| username          | Unique user identifier   |
| email             | Login/contact identifier |
| password          | Securely hashed password |
| status            | Account state            |
| email_verified_at | Verification timestamp   |
| last_login_at     | Last successful login    |
| created_at        | Creation timestamp       |
| updated_at        | Last update timestamp    |
| deleted_at        | Soft deletion timestamp  |

Passwords shall never be stored in plaintext.

---

# 5.6 Profiles Table

The `profiles` table shall contain information intended for user profile presentation.

```text
profiles
--------------------------------
id
user_id
display_name
bio
avatar_file_id
status_message
created_at
updated_at
```

Relationship:

```text
users
  │
  │ 1:1
  ▼
profiles
```

A user account and profile shall be treated as separate concerns.

Authentication information belongs to `users`, while presentation-oriented profile information belongs to `profiles`.

---

# 5.7 User Settings Table

The `user_settings` table shall contain user-specific preferences.

```text
user_settings
--------------------------------
id
user_id
theme
language
timezone
notification_preferences
privacy_preferences
playback_preferences
messaging_preferences
jam_preferences
accessibility_preferences
created_at
updated_at
```

Depending on implementation, structured preferences may be stored using PostgreSQL JSON/JSONB fields or normalized into separate tables.

Sensitive information shall not be placed into general-purpose preference fields.

---

# 5.8 Conversations Table

The `conversations` table shall represent messaging containers.

A conversation may represent:

* Direct message
* Group conversation
* Other supported conversation types

```text
conversations
--------------------------------
id
type
title
created_by
created_at
updated_at
deleted_at
```

Example values for `type`:

```text
direct
group
```

The conversation itself shall not contain all participants. Membership shall be managed through `conversation_members`.

---

# 5.9 Conversation Members Table

The `conversation_members` table shall implement the relationship between users and conversations.

```text
conversation_members
--------------------------------
id
conversation_id
user_id
role
joined_at
left_at
last_read_at
created_at
updated_at
```

Relationship:

```text
users
   │
   │
conversation_members
   │
   │
conversations
```

A composite uniqueness constraint may be applied to prevent duplicate active membership relationships where appropriate.

---

# 5.10 Messages Table

The `messages` table shall contain persistent message records.

```text
messages
--------------------------------
id
conversation_id
sender_id
parent_message_id
type
content
metadata
edited_at
deleted_at
created_at
updated_at
```

### Important Relationships

```text
messages
   │
   ├── sender_id ───────► users
   │
   ├── conversation_id ─► conversations
   │
   └── parent_message_id ► messages
```

`parent_message_id` may be used for replies and threaded relationships.

Message content shall be validated and safely rendered by the client.

---

# 5.11 Message Reactions Table

The `message_reactions` table shall store reactions independently from message content.

```text
message_reactions
--------------------------------
id
message_id
user_id
reaction
created_at
updated_at
```

Example:

```text
message_reactions
--------------------------------
message_id = 100
user_id    = 25
reaction   = "👍"
```

A uniqueness constraint may prevent a user from creating duplicate identical reactions on the same message.

---

# 5.12 Message Mentions Table

Mentions shall be represented as relationships rather than relying exclusively on parsed message text.

```text
message_mentions
--------------------------------
id
message_id
mentioned_user_id
position_start
position_end
created_at
```

This allows the system to efficiently identify users who were mentioned.

Example:

```text
"Hello @john, welcome!"
       │
       └── mentioned_user_id
```

Mention records may also be used to generate notifications.

---

# 5.13 Message Reads Table

The `message_reads` table shall represent read state.

```text
message_reads
--------------------------------
id
message_id
user_id
read_at
```

For large-scale conversations, an alternative conversation-level read cursor may be considered to reduce the number of rows required.

For example:

```text
conversation_members.last_read_message_id
```

The final implementation shall select the approach based on message volume and read-state requirements.

---

# 5.14 Message Attachments Table

The `message_attachments` table shall connect messages to uploaded files.

```text
message_attachments
--------------------------------
id
message_id
file_id
attachment_type
sort_order
created_at
```

Relationship:

```text
messages
   │
   ▼
message_attachments
   │
   ▼
files
```

This separation allows one file-management system to be reused across different modules.

---

# 5.15 Groups Table

Groups shall represent additional metadata for group conversations.

```text
groups
--------------------------------
id
conversation_id
name
description
avatar_file_id
created_by
created_at
updated_at
deleted_at
```

The group may reference a corresponding conversation:

```text
groups
   │
   └── conversation_id ───► conversations
```

This allows messaging functionality to remain centralized.

---

# 5.16 Communities Table

Communities shall represent larger organized social spaces.

```text
communities
--------------------------------
id
name
slug
description
avatar_file_id
banner_file_id
visibility
created_by
created_at
updated_at
deleted_at
```

Possible visibility values:

```text
public
private
invite_only
```

The final values shall be determined during implementation.

---

# 5.17 Community Members Table

The `community_members` table shall represent community membership and role assignments.

```text
community_members
--------------------------------
id
community_id
user_id
role
status
joined_at
created_at
updated_at
```

Possible roles:

```text
owner
admin
moderator
member
```

The role shall be scoped to the specific community.

Therefore:

```text
User A
Community X → admin
Community Y → member
```

is valid.

---

# 5.18 Channels Table

Channels shall organize communication inside communities.

```text
channels
--------------------------------
id
community_id
name
slug
type
description
position
created_by
created_at
updated_at
deleted_at
```

Possible channel types:

```text
text
announcement
private
```

The `position` field may be used to control channel ordering.

---

# 5.19 Channel Members Table

Private channels may require explicit membership.

```text
channel_members
--------------------------------
id
channel_id
user_id
joined_at
created_at
updated_at
```

Public channels may rely on community membership instead of requiring an explicit row for every member.

---

# 5.20 Notifications Table

Notifications shall contain persistent user notification records.

```text
notifications
--------------------------------
id
user_id
type
title
body
data
read_at
created_at
```

The `data` field may contain structured metadata required to navigate the user to the related resource.

Example:

```json
{
  "conversation_id": 120,
  "message_id": 5012
}
```

Sensitive information shall not be unnecessarily duplicated inside notifications.

---

# 5.21 Jams Table

The `jams` table shall represent synchronized listening sessions.

```text
jams
--------------------------------
id
host_id
name
privacy
status
current_track_id
current_position
playback_status
state_version
last_state_changed_at
created_at
updated_at
ended_at
```

Possible statuses:

```text
active
paused
ended
```

Possible privacy values:

```text
public
community
invite_only
private
```

The exact state model shall be finalized during Jam implementation.

---

# 5.22 Jam Members Table

The `jam_members` table shall represent participants.

```text
jam_members
--------------------------------
id
jam_id
user_id
role
status
joined_at
left_at
created_at
updated_at
```

Possible roles:

```text
host
participant
```

Possible participant states:

```text
active
left
disconnected
```

The host shall be represented through both `jams.host_id` and the corresponding membership record where appropriate.

---

# 5.23 Jam Playback States Table

The `jam_playback_states` table shall optionally store playback state history or authoritative state snapshots.

```text
jam_playback_states
--------------------------------
id
jam_id
state_version
track_id
playback_status
position
server_timestamp
changed_by
created_at
```

Example:

```text
Jam #10

State 15
Track: ABC
Status: playing
Position: 42.35
```

A monotonically increasing `state_version` can help prevent stale realtime events from overriding newer state.

For example:

```text
State 18
   │
   ├── newer than State 17
   │
   ▼
Accept

State 16
   │
   └── older than State 18
           │
           ▼
         Ignore
```

The final implementation may keep only the current state or maintain a limited history depending on requirements.

---

# 5.24 Music Tracks Table

The `music_tracks` table shall contain normalized metadata obtained from authorized music providers.

```text
music_tracks
--------------------------------
id
provider
provider_track_id
title
artist_name
album_name
artwork_url
duration
provider_url
playback_available
metadata
created_at
updated_at
```

The combination of:

```text
provider
provider_track_id
```

should normally be unique.

The application shall avoid storing protected audio content unless explicitly authorized and legally permitted.

---

# 5.25 Music History Table

The `music_history` table shall track user listening activity where the feature is enabled.

```text
music_history
--------------------------------
id
user_id
music_track_id
started_at
completed_at
position
created_at
```

History may be retained according to the user's settings and the system's data-retention policy.

---

# 5.26 User Saved Tracks Table

Users may save or favorite tracks.

```text
user_saved_tracks
--------------------------------
id
user_id
music_track_id
created_at
```

A unique constraint should prevent duplicate saves:

```text
UNIQUE(user_id, music_track_id)
```

---

# 5.27 Files Table

The `files` table shall contain metadata for uploaded files.

```text
files
--------------------------------
id
uploaded_by
storage_provider
storage_key
original_name
mime_type
size
checksum
visibility
status
created_at
updated_at
deleted_at
```

The database shall not necessarily store the binary content itself.

Instead:

```text
PostgreSQL
    │
    └── File Metadata

Object Storage
    │
    └── Actual File
```

---

# 5.28 Reports Table

The `reports` table shall support moderation workflows.

```text
reports
--------------------------------
id
reported_by
target_type
target_id
reason
description
status
assigned_to
resolved_by
resolved_at
created_at
updated_at
```

Possible statuses:

```text
pending
under_review
resolved
dismissed
escalated
duplicate
```

The `target_type` and `target_id` relationship shall be implemented carefully to preserve authorization and data integrity.

---

# 5.29 Audit Logs Table

The `audit_logs` table shall record important security, administrative, and moderation actions.

```text
audit_logs
--------------------------------
id
actor_id
action
resource_type
resource_id
result
metadata
request_id
created_at
```

Example:

```json
{
  "actor_id": 25,
  "action": "COMMUNITY_MEMBER_REMOVED",
  "resource_type": "community",
  "resource_id": 120,
  "result": "success"
}
```

Audit logs shall not contain passwords, authentication tokens, private keys, or other sensitive secrets.

---

# 5.30 System Settings Table

System-level configuration may be stored separately from user settings.

```text
system_settings
--------------------------------
id
key
value
type
description
is_sensitive
created_at
updated_at
```

Sensitive configuration should preferably remain in environment or dedicated secret-management infrastructure rather than being stored in a general database table.

This table should therefore be limited to application configuration that is appropriate for database storage.

---

# 5.31 Entity Relationship Overview

The major relationships may be represented as follows:

```text
users
 │
 ├─────────────── profiles
 │
 ├─────────────── user_settings
 │
 ├─────────────── conversations
 │                     │
 │                     └── conversation_members
 │
 ├─────────────── messages
 │                     │
 │                     ├── message_reactions
 │                     ├── message_mentions
 │                     ├── message_reads
 │                     └── message_attachments
 │
 ├─────────────── communities
 │                     │
 │                     ├── community_members
 │                     └── channels
 │
 ├─────────────── notifications
 │
 ├─────────────── jams
 │                     │
 │                     ├── jam_members
 │                     └── jam_playback_states
 │
 ├─────────────── music_history
 │
 ├─────────────── user_saved_tracks
 │
 ├─────────────── files
 │
 ├─────────────── reports
 │
 └─────────────── audit_logs
```

---

# 5.32 Core Relationship Cardinality

The principal relationships shall include:

| Relationship            | Cardinality |
| ----------------------- | ----------- |
| User → Profile          | 1:1         |
| User → Settings         | 1:1         |
| User → Conversations    | M:N         |
| Conversation → Members  | 1:M         |
| Conversation → Messages | 1:M         |
| User → Messages         | 1:M         |
| Message → Reactions     | 1:M         |
| Message → Mentions      | 1:M         |
| Message → Attachments   | 1:M         |
| Community → Members     | 1:M         |
| Community → Channels    | 1:M         |
| User → Communities      | M:N         |
| User → Jams             | M:N         |
| Jam → Members           | 1:M         |
| Jam → Playback States   | 1:M         |
| User → Notifications    | 1:M         |
| User → Music History    | 1:M         |
| User → Saved Tracks     | M:N         |
| User → Files            | 1:M         |

---

# 5.33 Primary Key Strategy

Each major entity shall have a unique primary key.

The implementation may use:

* UUID
* ULID
* Big integer identifiers

The final strategy shall be selected based on application requirements, indexing behavior, API exposure, and Laravel support.

If sequential integer IDs are used internally, public resource identifiers may use an alternative identifier where appropriate to reduce predictable resource enumeration.

The selected strategy shall remain consistent across related entities.

---

# 5.34 Foreign Key Strategy

Foreign keys shall be used to maintain relationships between entities.

Examples include:

```text
messages.sender_id
        ↓
users.id

messages.conversation_id
        ↓
conversations.id

community_members.community_id
        ↓
communities.id

jam_members.jam_id
        ↓
jams.id
```

Foreign-key deletion behavior shall be selected according to business rules.

For example, deleting a conversation may require:

* Soft deletion
* Cascading membership cleanup
* Preserving message history
* Archiving related records

The system shall avoid accidental destructive cascades for important user-generated data.

---

# 5.35 Indexing Strategy

Indexes shall be created for fields frequently used in:

* Authentication
* Lookups
* Foreign-key relationships
* Sorting
* Filtering
* Pagination
* Search
* Realtime state retrieval

Potential indexes include:

```text
users.email
users.username

messages.conversation_id
messages.sender_id
messages.created_at

conversation_members.conversation_id
conversation_members.user_id

community_members.community_id
community_members.user_id

channels.community_id

notifications.user_id
notifications.read_at

jams.host_id
jams.status

jam_members.jam_id
jam_members.user_id

music_tracks.provider + provider_track_id
```

Composite indexes shall be introduced where query patterns justify them.

---

# 5.36 Message Pagination Strategy

Messaging is expected to produce a large volume of records.

The system shall avoid retrieving an entire conversation history in a single query.

The preferred approach shall be cursor-based pagination for large conversations.

Conceptually:

```text
Latest Messages
      │
      ▼
Page 1
      │
      ▼
Older Cursor
      │
      ▼
Page 2
      │
      ▼
Older Cursor
      │
      ▼
Page 3
```

This approach is more appropriate for long-running conversations than loading thousands of messages at once.

---

# 5.37 Jam Concurrency and State Versioning

Jam playback state shall account for concurrent actions.

For example:

```text
Host A → PLAY → State 20
Host A → SEEK → State 21
Client receives State 20
Client receives State 21
```

The client should accept the latest valid state.

A state-versioning mechanism may be used:

```text
state_version = 20
state_version = 21
state_version = 22
```

An older state should not overwrite a newer state.

The backend shall validate who is authorized to modify Jam playback.

---

# 5.38 Soft Delete and Data Lifecycle

Soft deletion shall be used where historical relationships or audit requirements require records to remain available.

For example:

```text
Message
  │
  └── deleted_at = timestamp
```

The UI may display:

```text
This message was deleted.
```

rather than physically removing the database record immediately.

Permanent deletion may be performed later according to:

* Account deletion policy
* Retention requirements
* Moderation policy
* Storage lifecycle
* Privacy requirements

---

# 5.39 Data Retention

The system shall define retention policies for different data categories.

| Data              | Retention Consideration              |
| ----------------- | ------------------------------------ |
| User Accounts     | Until deletion/deactivation policy   |
| Messages          | According to product policy          |
| Attachments       | Related to message/account lifecycle |
| Notifications     | Limited retention may be applied     |
| Audit Logs        | Longer retention                     |
| Jam State History | Limited retention                    |
| Music History     | User-configurable where applicable   |
| Temporary Files   | Short retention                      |
| Cache             | Short-lived                          |
| Queue Data        | Until successful/failed processing   |

Retention policies shall consider privacy, storage cost, legal requirements, and system functionality.

---

# 5.40 Data Integrity and Transactions

Operations involving multiple related records shall use database transactions when atomic behavior is required.

For example, creating a message with a mention may involve:

```text
BEGIN TRANSACTION

Create Message
Create Mention Records
Create Attachment Relations
Create Notification Records

COMMIT
```

Only after successful commitment should dependent realtime events be dispatched where appropriate.

This prevents clients from receiving realtime events for database operations that ultimately fail.

---

# 5.41 Event-After-Commit Principle

Persistent state shall be committed before notifying other clients about the state change.

Example:

```text
User sends message
      │
      ▼
Validate
      │
      ▼
Database Transaction
      │
      ▼
COMMIT
      │
      ▼
MessageSent
      │
      ▼
Pusher
```

The system should avoid:

```text
Broadcast
   ↓
Database Failure
```

because this could cause other clients to display data that does not actually exist in the persistent database.

---

# 5.42 Database Security

Database security shall include:

* Strong database credentials
* Restricted database access
* Encrypted connections where supported
* Least-privilege database accounts
* No direct database access from public clients
* Regular backups
* Backup encryption where appropriate
* Migration control
* Production access restrictions
* Monitoring of critical database failures

The application frontend shall never connect directly to PostgreSQL.

---

# 5.43 Database Migration Strategy

Database schema changes shall be managed through version-controlled Laravel migrations.

A migration shall define changes such as:

```text
Create Table
Add Column
Add Index
Add Foreign Key
Modify Constraint
Create Pivot Table
```

Production migrations shall be executed through controlled deployment procedures.

High-risk migrations shall be preceded by appropriate backups and tested in staging before production execution.

---

# 5.44 Database ERD — High-Level Representation

The following represents the initial conceptual ERD:

```text
┌─────────────┐
│    users    │
└──────┬──────┘
       │
 ┌─────┼───────────────┬────────────────┐
 │     │               │                │
 ▼     ▼               ▼                ▼
profiles settings   messages      communities
                       │                │
              ┌────────┼──────┐         │
              ▼        ▼      ▼         ▼
          reactions mentions reads   channels
              │
              ▼
          attachments
              │
              ▼
            files


users
  │
  ├──────── conversation_members ───────► conversations
  │                                             │
  │                                             ▼
  │                                          messages
  │
  ├──────── community_members ───────────► communities
  │                                             │
  │                                             ▼
  │                                          channels
  │
  ├──────── jam_members ─────────────────► jams
  │                                             │
  │                                             ▼
  │                                      playback_states
  │
  ├──────── music_history ───────────────► music_tracks
  │
  └──────── saved_tracks ────────────────► music_tracks

users ───────────────► notifications
users ───────────────► audit_logs
users ───────────────► reports
```

---

# 5.45 Database Design Considerations for Future Growth

The initial schema shall be designed so that additional functionality can be introduced without major restructuring.

Potential future entities include:

```text
playlists
playlist_tracks
follows
user_blocks
user_reports
community_bans
channel_permissions
music_providers
music_artists
music_albums
jam_invites
jam_queue
voice_sessions
video_sessions
subscriptions
payments
creator_profiles
```

These entities shall only be introduced when the corresponding functionality becomes part of the system scope.

The database design shall avoid prematurely creating tables for features that are not yet required.

---

# 5.46 Database Design Summary

The database architecture establishes PostgreSQL as the persistent source of truth for the platform.

The design separates major functional domains while maintaining clear relationships between:

* Users
* Profiles
* Messaging
* Groups
* Communities
* Channels
* Notifications
* Music
* Jams
* Files
* Reports
* Audit Logs

The schema shall use appropriate primary keys, foreign keys, indexes, constraints, transactions, and retention strategies to maintain data integrity and performance.

Messaging and Jam functionality shall receive special consideration because they are expected to generate high-frequency data and realtime state changes.

The database shall remain independent from the realtime provider. Pusher or Reverb shall distribute events, while PostgreSQL shall maintain persistent application state.

This architecture also provides a foundation for future mobile, desktop, search, recommendation, voice/video, and creator-oriented features without requiring the fundamental data model to be replaced.
