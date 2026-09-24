# CHAPTER 9

# DATABASE DESIGN AND ENTITY-RELATIONSHIP SPECIFICATION

## 9.1 Database Overview

The **[Project Name] — Social Music & Community Platform** shall use a relational database as the primary persistent storage system.

The initial database technology shall be:

```text
PostgreSQL
```

The database shall serve as the authoritative source of persistent application data.

The database shall store information related to:

* Users
* Profiles
* User settings
* Sessions
* Conversations
* Conversation members
* Messages
* Message reactions
* Message mentions
* Message read states
* Groups
* Communities
* Community members
* Channels
* Notifications
* Music metadata
* Saved music
* Listening history
* Jams
* Jam members
* Jam playback state
* Files
* Message attachments
* Audit logs
* Reports
* System configuration where appropriate

Temporary realtime state such as typing indicators shall generally not be stored permanently in the database.

---

# 9.2 Database Design Principles

The database shall follow these principles:

1. Relational data modeling
2. Referential integrity
3. Normalization where practical
4. Controlled denormalization for performance
5. Foreign key constraints
6. Appropriate indexing
7. Unique constraints
8. Transactional consistency
9. Soft deletion where appropriate
10. Data lifecycle management
11. Secure handling of sensitive information
12. Scalable pagination
13. Auditability of important actions
14. Separation of persistent state from temporary realtime state

The database shall not be accessed directly by frontend applications.

```text
React / Mobile / Desktop
          │
          ▼
      Laravel API
          │
          ▼
    Domain Services
          │
          ▼
      PostgreSQL
```

---

# 9.3 High-Level Entity Model

The major entities may be represented as:

```text id="f3x5d8"
Users
  │
  ├── Profiles
  ├── Settings
  ├── Sessions
  ├── Conversations
  ├── Messages
  ├── Communities
  ├── Notifications
  ├── Jams
  └── Audit Logs
```

Communication:

```text id="z9g1fc"
Users
  │
  ▼
Conversations
  │
  ├── Conversation Members
  │
  └── Messages
        │
        ├── Reactions
        ├── Mentions
        ├── Attachments
        └── Replies / Threads
```

Communities:

```text id="x8z0as"
Community
   │
   ├── Members
   │
   └── Channels
          │
          └── Messages
```

Jam:

```text id="r9p7sk"
Jam
 │
 ├── Members
 │
 └── Playback State
```

---

# 9.4 Primary Key Strategy

Each major entity shall have a unique primary key.

The implementation may use:

```text
BIGINT
```

or another appropriate identifier strategy.

Example:

```text
users.id
messages.id
communities.id
jams.id
```

For externally exposed identifiers, the system may additionally use UUIDs or public identifiers where appropriate.

A separation between internal database IDs and public resource identifiers may improve security and API design.

---

# 9.5 Users Table

The `users` table shall represent the primary identity of an account.

Possible fields:

```text
users
--------------------------------
id
username
email
password
email_verified_at
status
last_seen_at
created_at
updated_at
deleted_at
```

### Important fields

| Field               | Purpose                  |
| ------------------- | ------------------------ |
| `id`                | Primary key              |
| `username`          | Unique public identifier |
| `email`             | Account email            |
| `password`          | Hashed password          |
| `email_verified_at` | Verification timestamp   |
| `status`            | Account state            |
| `last_seen_at`      | Last recorded activity   |
| `created_at`        | Creation timestamp       |
| `updated_at`        | Last update              |
| `deleted_at`        | Soft deletion            |

Passwords shall never be stored in plaintext.

---

# 9.6 User Account Status

The account status may include:

```text
active
inactive
pending_verification
suspended
deleted
```

The exact values shall be implemented using controlled application values.

The account status shall be enforced by backend authorization and authentication logic.

---

# 9.7 Profiles Table

Profile information may be separated from core authentication data.

Possible table:

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
users 1 ───── 1 profiles
```

This separation allows account credentials and public profile information to evolve independently.

---

# 9.8 User Settings Table

User preferences shall be stored separately.

Possible table:

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
accessibility_preferences
created_at
updated_at
```

Depending on implementation, structured preference groups may be represented using PostgreSQL JSON/JSONB fields or normalized child tables.

The design shall avoid placing excessively large or frequently changing settings inside the main `users` table.

---

# 9.9 User Sessions

Authenticated sessions or device sessions may be tracked separately.

Possible data:

```text
sessions
--------------------------------
id
user_id
device_name
platform
last_active_at
ip_address
user_agent
created_at
updated_at
```

Sensitive session tokens shall be handled according to the selected Laravel authentication implementation.

The database shall not unnecessarily store raw authentication secrets.

---

# 9.10 Conversations Table

The `conversations` table shall represent direct and group conversations.

Possible fields:

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

Possible conversation types:

```text
direct
group
```

The conversation type shall be controlled by backend validation.

---

# 9.11 Conversation Members

Membership shall use a many-to-many relationship between users and conversations.

Table:

```text
conversation_members
--------------------------------
id
conversation_id
user_id
role
joined_at
left_at
created_at
updated_at
```

Relationship:

```text
users
   │
   └──< conversation_members >── conversations
```

A unique constraint may prevent duplicate active memberships.

Example:

```text
UNIQUE(conversation_id, user_id)
```

The exact constraint may be adjusted if historical membership records are retained.

---

# 9.12 Conversation Member Roles

Group conversations may use roles such as:

```text
owner
admin
member
```

Direct conversations may not require a role beyond membership.

Authorization rules shall determine which members can:

* Add members
* Remove members
* Rename the group
* Change roles
* Delete or archive group resources

---

# 9.13 Messages Table

The `messages` table shall represent messages sent in conversations and community channels.

Possible fields:

```text
messages
--------------------------------
id
conversation_id
channel_id
sender_id
parent_message_id
type
content
metadata
created_at
updated_at
edited_at
deleted_at
```

Not every message must belong to both a conversation and a channel.

The model shall enforce valid ownership relationships.

---

# 9.14 Message Types

Possible message types include:

```text
text
image
video
audio
file
system
```

Additional types may be added later.

The type shall be validated by the backend.

---

# 9.15 Message Replies and Threads

Messages may reference another message through:

```text
parent_message_id
```

Conceptually:

```text
Message 100
   │
   ├── Message 101
   ├── Message 102
   └── Message 103
```

This allows the system to support:

* Replies
* Threads
* Nested conversation relationships

The application may choose whether replies are displayed as full threads or inline replies.

---

# 9.16 Threading Model

The initial design shall favor a simple parent-child relationship rather than unrestricted recursive nesting.

Example:

```text
Root Message
    │
    ├── Reply
    ├── Reply
    └── Reply
```

A future thread model may introduce a dedicated `threads` table if advanced thread functionality requires it.

This approach keeps the initial database simpler.

---

# 9.17 Message Reactions

Reactions shall be represented by a separate table.

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
Message 5012
   │
   ├── User 25 → 👍
   ├── User 30 → ❤️
   └── User 41 → 😂
```

A unique constraint may prevent the same user from adding the same reaction multiple times:

```text
UNIQUE(message_id, user_id, reaction)
```

---

# 9.18 Message Mentions

Mentions shall be stored separately when they need to be queried or used for notifications.

```text
message_mentions
--------------------------------
id
message_id
user_id
created_at
```

Example:

```text
"Hello @John"
```

may create:

```text
message_id = 5012
user_id = 25
```

This allows the notification system to efficiently identify mentioned users.

---

# 9.19 Message Read States

Read state may be represented using:

```text
message_reads
--------------------------------
id
message_id
user_id
read_at
```

For large conversations, a conversation-level read cursor may be more efficient.

Alternative:

```text
conversation_members
--------------------------------
last_read_message_id
last_read_at
```

The final implementation should select the approach based on performance testing.

---

# 9.20 Message Attachments

Files shall be separated from message records.

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

This allows a single message to contain multiple attachments.

Example:

```text
Message
 ├── image.jpg
 ├── video.mp4
 └── document.pdf
```

---

# 9.21 Files Table

The `files` table shall store file metadata rather than the binary content itself.

Possible fields:

```text
files
--------------------------------
id
owner_id
storage_disk
storage_key
original_name
mime_type
extension
size
checksum
status
created_at
updated_at
deleted_at
```

The actual file may be stored in:

* Object storage
* S3-compatible storage
* Approved cloud storage
* Server storage for limited deployments

The database shall store the metadata and secure reference.

---

# 9.22 File Storage Separation

The recommended architecture is:

```text
PostgreSQL
    │
    └── File Metadata

Object Storage
    │
    └── Actual Binary File
```

This prevents the relational database from becoming unnecessarily large.

---

# 9.23 Communities Table

Communities shall represent larger organized social spaces.

Possible fields:

```text
communities
--------------------------------
id
name
slug
description
owner_id
visibility
status
created_at
updated_at
deleted_at
```

Possible visibility values:

```text
public
private
```

Additional visibility modes may be introduced later.

---

# 9.24 Community Members

Membership shall be represented through:

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
administrator
moderator
member
```

The role shall be scoped to the specific community.

A user may therefore be:

```text
Administrator in Community A
Member in Community B
```

---

# 9.25 Community Channels

Channels belong to communities.

```text
channels
--------------------------------
id
community_id
name
slug
type
description
created_by
position
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

# 9.26 Channel Membership

Public community channels may derive access from community membership.

Private channels may require an additional membership model.

If needed:

```text
channel_members
--------------------------------
id
channel_id
user_id
created_at
updated_at
```

This table shall only be necessary when channel-level membership differs from community membership.

---

# 9.27 Channel Messages

Channel messages may reuse the existing `messages` table.

Example:

```text
messages
   │
   ├── conversation_id
   └── channel_id
```

This allows common functionality such as:

* Reactions
* Mentions
* Replies
* Attachments
* Editing
* Deletion
* Read states

without creating a second independent message system.

---

# 9.28 Notifications Table

Persistent notifications shall be stored in:

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
updated_at
```

The `data` field may contain structured JSON metadata.

Example:

```json
{
  "message_id": 5012,
  "conversation_id": 100
}
```

Sensitive information shall not be unnecessarily duplicated into notification payloads.

---

# 9.29 Music Provider Metadata

Music data shall be modeled around provider independence.

Possible table:

```text
music_tracks
--------------------------------
id
provider
provider_track_id
title
duration
album_id
artist_data
artwork_url
metadata
created_at
updated_at
```

The exact structure depends on the selected music provider.

The system shall avoid assuming that all providers expose identical metadata.

---

# 9.30 Music Providers

A provider field may identify the external source.

Example:

```text
provider
----------------
audius
jamendo
spotify
other
```

The actual supported providers shall depend on the legal, technical, and licensing requirements of the system.

Provider-specific identifiers shall be retained so the application can request the corresponding resource from the provider.

---

# 9.31 Music Albums and Artists

If music metadata needs to be queried locally, separate tables may be introduced:

```text
music_artists
music_albums
music_tracks
```

Relationships:

```text
Artist
  │
  └──< Albums
         │
         └──< Tracks
```

However, if the application only stores minimal provider metadata, normalized local artist/album tables may not be required initially.

---

# 9.32 Saved Music

Users may save tracks:

```text
saved_tracks
--------------------------------
id
user_id
track_id
created_at
```

A unique constraint may prevent duplicate saved tracks:

```text
UNIQUE(user_id, track_id)
```

---

# 9.33 Listening History

Listening history may use:

```text
listening_history
--------------------------------
id
user_id
track_id
started_at
completed_at
duration_played
source
created_at
```

The system should avoid generating excessive database writes for every small playback movement.

History should normally represent meaningful listening activity rather than every playback position update.

---

# 9.34 Jams Table

The `jams` table shall represent a shared listening session.

Possible fields:

```text
jams
--------------------------------
id
name
host_id
privacy
status
community_id
created_at
updated_at
started_at
ended_at
```

Possible statuses:

```text
scheduled
active
ended
```

The exact lifecycle may be simplified for the MVP.

---

# 9.35 Jam Members

Participants shall be stored separately.

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

Possible status values:

```text
active
left
```

The database shall support participant history when required.

---

# 9.36 Jam Playback State

The current authoritative playback state shall be stored separately.

```text
jam_playback_states
--------------------------------
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

Relationship:

```text
Jam
 │
 └── Playback State
```

A Jam may have only one current authoritative playback state.

A unique constraint may be used:

```text
UNIQUE(jam_id)
```

if historical playback states are not required in this table.

---

# 9.37 Jam Playback History

If historical playback events are needed, they should be stored separately rather than overwriting the current state.

Possible table:

```text
jam_playback_events
--------------------------------
id
jam_id
actor_id
event_type
track_id
position
state_version
created_at
```

This is optional for the MVP.

The system should not persist every tiny position correction.

---

# 9.38 Jam and Music Provider Relationship

A Jam track should retain enough provider information to identify the selected music resource.

Example:

```text
jam_playback_states
    │
    └── track_id
            │
            ▼
      music_tracks
            │
            └── provider
                provider_track_id
```

This allows the client to retrieve the correct provider-specific playback resource.

---

# 9.39 Reports Table

User and content reporting may use:

```text
reports
--------------------------------
id
reporter_id
target_type
target_id
reason
description
status
assigned_to
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

The target may refer to:

* User
* Message
* Community
* Channel
* Jam
* Other supported resources

---

# 9.40 Audit Logs Table

Important administrative and security activities shall be recorded.

Possible structure:

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
created_at
```

Example:

```json
{
  "actor_id": 25,
  "action": "COMMUNITY_MEMBER_REMOVED",
  "resource_type": "community",
  "resource_id": 100,
  "result": "success"
}
```

Passwords, authentication tokens, and provider secrets shall never be stored in audit metadata.

---

# 9.41 System Configuration

System-wide configuration should generally be managed through application configuration and environment variables rather than unrestricted database records.

Database-backed configuration may be used for dynamic settings such as:

```text
feature flags
system limits
maintenance settings
moderation configuration
```

Sensitive secrets shall remain in secure secret management or environment configuration.

---

# 9.42 Entity Relationship Overview

A simplified ERD may be represented as:

```text id="d2lq61"
                         ┌──────────────┐
                         │    users     │
                         └──────┬───────┘
                                │
          ┌─────────────────────┼──────────────────────┐
          │                     │                      │
          ▼                     ▼                      ▼
      profiles             user_settings           sessions
          │
          │
          ├───────────────────────────────────────────────┐
          │                                               │
          ▼                                               ▼
   conversation_members                            community_members
          │                                               │
          ▼                                               ▼
   conversations                                    communities
          │                                               │
          ▼                                               ▼
      messages                                           channels
          │                                               │
    ┌─────┼───────────┐                                   │
    ▼     ▼           ▼                                   ▼
reactions mentions attachments                         messages
                  │
                  ▼
                 files


users
  │
  ├── notifications
  ├── saved_tracks
  ├── listening_history
  └── jam_members
            │
            ▼
           jams
            │
            ▼
    jam_playback_states
```

---

# 9.43 Core Relationship Summary

The primary relationships shall include:

| Relationship            | Type                         |
| ----------------------- | ---------------------------- |
| User → Profile          | One-to-One                   |
| User → Settings         | One-to-One                   |
| User → Sessions         | One-to-Many                  |
| User → Conversations    | Many-to-Many                 |
| Conversation → Messages | One-to-Many                  |
| User → Messages         | One-to-Many                  |
| Message → Reactions     | One-to-Many                  |
| Message → Mentions      | One-to-Many                  |
| Message → Attachments   | One-to-Many                  |
| File → Attachment       | One-to-Many                  |
| User → Communities      | Many-to-Many                 |
| Community → Channels    | One-to-Many                  |
| Channel → Messages      | One-to-Many                  |
| User → Notifications    | One-to-Many                  |
| User → Jams             | Many-to-Many                 |
| Jam → Playback State    | One-to-One                   |
| User → Audit Logs       | One-to-Many                  |
| Message → Replies       | Self-referencing One-to-Many |

---

# 9.44 Foreign Key Strategy

Foreign keys shall be used to protect relational integrity.

Examples:

```text
profiles.user_id
        ↓
users.id
```

```text
messages.conversation_id
        ↓
conversations.id
```

```text
message_reactions.message_id
        ↓
messages.id
```

```text
community_members.community_id
        ↓
communities.id
```

```text
jam_members.jam_id
        ↓
jams.id
```

Foreign key behavior shall be selected carefully.

Possible behaviors include:

```text
CASCADE
RESTRICT
SET NULL
```

The selected behavior shall depend on the resource lifecycle.

---

# 9.45 Soft Delete Strategy

Soft deletion may be used for resources where historical references should remain available.

Potential soft-deletable entities include:

```text
users
messages
conversations
communities
channels
files
```

For example, deleting a message may set:

```text
deleted_at
```

rather than immediately removing the row.

This allows the application to display:

```text
This message was deleted.
```

while preserving relationships and auditability.

---

# 9.46 Hard Deletion

Permanent deletion may be required for:

* Legal/data retention requirements
* User account deletion
* Temporary data cleanup
* Expired files
* System maintenance

Hard deletion shall only occur according to documented retention and dependency rules.

For example, deleting a user may require:

```text
Account deletion
      │
      ├── Profile handling
      ├── Messages
      ├── Files
      ├── Notifications
      ├── Community memberships
      ├── Jam memberships
      └── Audit records
```

The exact handling shall be defined by the data retention policy.

---

# 9.47 Database Indexing

Indexes shall be created for frequently queried fields.

Potential indexes include:

```text
users.username
users.email

messages.conversation_id
messages.channel_id
messages.sender_id
messages.created_at
messages.parent_message_id

conversation_members.user_id
conversation_members.conversation_id

community_members.user_id
community_members.community_id

channels.community_id

notifications.user_id
notifications.read_at

jam_members.jam_id
jam_members.user_id

jam_playback_states.jam_id

audit_logs.actor_id
audit_logs.resource_type
audit_logs.resource_id
audit_logs.created_at
```

Indexes shall be validated through query analysis rather than added indiscriminately.

---

# 9.48 Composite Indexes

Composite indexes may be required for common query patterns.

Example:

```text
messages(conversation_id, created_at)
```

This supports queries such as:

```text
Get messages for conversation 100 ordered by creation time.
```

Another example:

```text
notifications(user_id, read_at, created_at)
```

The final indexes shall be determined using real query patterns and performance testing.

---

# 9.49 Unique Constraints

Unique constraints shall protect important business rules.

Examples:

```text
users.username
users.email
communities.slug
channels(community_id, slug)
saved_tracks(user_id, track_id)
message_reactions(message_id, user_id, reaction)
```

The exact uniqueness rules shall depend on the application's business requirements.

---

# 9.50 Database Transactions

Transactions shall be used when multiple database operations must succeed together.

Examples:

### Creating a Conversation

```text
BEGIN
  Create conversation
  Add creator
  Add members
COMMIT
```

### Joining a Jam

```text
BEGIN
  Validate access
  Create membership
COMMIT
```

### Changing Jam Playback

```text
BEGIN
  Validate permission
  Update playback state
  Increment state version
COMMIT
```

This prevents partially completed operations.

---

# 9.51 Event Consistency

Realtime events should be generated only after the relevant persistent state has successfully committed.

Conceptually:

```text id="0q9tbh"
Transaction
    │
    ├── Rollback → No authoritative event
    │
    └── Commit
          │
          ▼
      Broadcast
```

This follows the source-of-truth principle established in previous chapters.

---

# 9.52 Data Normalization

The initial database shall generally follow normalized relational design.

For example, user information should not be copied into every message row.

Instead:

```text
messages.sender_id
       │
       ▼
users.id
```

The application can retrieve the sender profile through the relationship.

Controlled denormalization may be introduced later where performance requirements justify it.

---

# 9.53 Controlled Denormalization

Examples where denormalization may be useful include:

* Conversation last-message preview
* Unread counts
* Community member counts
* Jam participant counts
* Cached music metadata
* Search indexes

Denormalized values shall not become conflicting sources of truth without a defined synchronization strategy.

---

# 9.54 JSON and JSONB Usage

PostgreSQL JSONB may be used for flexible metadata.

Appropriate examples include:

```text
message.metadata
notification.data
music_tracks.metadata
audit_logs.metadata
user_settings.preferences
```

JSONB should not replace relational modeling for frequently queried relational entities.

For example, community members should not be stored as a JSON array inside the community record.

---

# 9.55 Pagination-Oriented Database Design

Large datasets shall be designed for efficient pagination.

High-volume tables include:

```text
messages
notifications
audit_logs
listening_history
jam_playback_events
```

Cursor-based pagination should be preferred for large, frequently changing datasets.

Example:

```text
messages
ORDER BY created_at DESC, id DESC
```

with a cursor containing the last returned position.

---

# 9.56 Message Ordering

Message ordering should not rely solely on client timestamps.

The backend shall generate authoritative timestamps.

For consistent ordering, the application may use:

```text
created_at
+
id
```

For example:

```text
ORDER BY created_at DESC, id DESC
```

This helps resolve messages created at nearly identical timestamps.

---

# 9.57 Data Ownership by Module

Each domain shall have a clear ownership boundary.

```text
Auth
 └── users / sessions

Profile
 └── profiles

Messaging
 ├── conversations
 ├── messages
 ├── reactions
 ├── mentions
 └── reads

Community
 ├── communities
 ├── members
 └── channels

Music
 ├── music_tracks
 ├── saved_tracks
 └── listening_history

Jam
 ├── jams
 ├── jam_members
 └── jam_playback_states

Notification
 └── notifications

Administration
 ├── reports
 └── audit_logs
```

This ownership model supports modular backend architecture.

---

# 9.58 Database and Realtime Separation

Realtime infrastructure shall not replace the database.

For example:

```text id="f1qu8p"
Pusher
  │
  └── message.sent
```

does not mean Pusher becomes the permanent storage of the message.

The persistent record remains:

```text
PostgreSQL
  │
  └── messages
```

Similarly:

```text
Pusher
  │
  └── jam.play
```

communicates a state change, while:

```text
PostgreSQL
  │
  └── jam_playback_states
```

stores the authoritative state.

---

# 9.59 Redis and Database Responsibilities

Redis may be used for temporary or high-speed application data.

Examples:

```text
Redis
 ├── Cache
 ├── Queue
 ├── Rate limiting
 ├── Temporary locks
 └── Short-lived state
```

PostgreSQL remains responsible for persistent business data.

Redis should not be the only storage location for important application records unless a specific architecture requires it.

---

# 9.60 Database Security

Database security shall include:

* Strong database credentials
* Restricted network access
* Least-privilege database users
* Encrypted connections where appropriate
* Secure backups
* Migration control
* Sensitive data protection
* Production credential separation
* No database credentials in frontend code

The database shall never be directly accessible from public frontend applications.

---

# 9.61 Sensitive Data

Sensitive information shall be minimized.

The database should not store:

* Plaintext passwords
* Raw authentication tokens
* Provider private API secrets
* Encryption keys in ordinary application tables
* Unnecessary sensitive personal information

Where sensitive information must be stored, appropriate encryption or secure secret-management mechanisms shall be considered.

---

# 9.62 Database Migration Strategy

All schema changes shall be managed through version-controlled migrations.

Example:

```text
database/
└── migrations/
    ├── create_users_table
    ├── create_profiles_table
    ├── create_conversations_table
    ├── create_messages_table
    ├── create_communities_table
    └── create_jams_table
```

Developers shall not rely on manually modifying production tables without corresponding migration records.

---

# 9.63 Migration Safety

Production migrations shall consider:

* Existing data
* Foreign keys
* Index creation time
* Large table size
* Locking behavior
* Backward compatibility
* Rollback limitations

For high-volume tables, potentially expensive schema changes should be planned carefully.

---

# 9.64 Database Seeding

Development and test environments may use seed data.

Example:

```text
Users
Communities
Channels
Conversations
Messages
Music Metadata
Jams
```

Production seed operations shall be carefully controlled to prevent accidental creation or modification of real user data.

---

# 9.65 Database Backup Requirements

The database shall be backed up according to the system backup strategy.

Important data includes:

```text
Users
Messages
Communities
Notifications
Music user data
Jams
Files metadata
Audit logs
```

Database backups shall be tested through restoration procedures.

A backup that cannot be restored successfully shall not be considered a reliable recovery mechanism.

---

# 9.66 Database Performance Requirements

The database shall support:

* Efficient message retrieval
* Efficient conversation listing
* Community membership queries
* Notification queries
* Jam state retrieval
* Search support
* Administrative queries

Performance shall be monitored through:

* Query execution time
* Slow query logs
* Index usage
* Connection utilization
* Database CPU/memory
* Table growth

---

# 9.67 Data Retention

The system shall define retention policies for:

```text
Messages
Notifications
Audit Logs
Files
Listening History
Jam History
Sessions
Reports
Temporary Data
```

Different categories may have different retention periods.

Audit records may require longer retention than temporary notification records.

---

# 9.68 Account Deletion

Account deletion shall follow a documented lifecycle.

Possible process:

```text
User requests deletion
        │
        ▼
Account marked for deletion
        │
        ▼
Retention/grace period
        │
        ▼
Personal data deletion/anonymization
        │
        ▼
Account permanently removed
```

Messages belonging to deleted accounts may require anonymization rather than immediate deletion if conversation integrity must be preserved.

The exact policy shall be finalized according to the system's privacy requirements.

---

# 9.69 Database Scalability

The initial architecture shall use a single PostgreSQL primary database.

Future scaling options may include:

```text
PostgreSQL Primary
      │
      ├── Read Replica
      ├── Backup Replica
      └── Analytics/Reporting Database
```

Database sharding shall not be introduced unless actual scale requirements justify its complexity.

---

# 9.70 Search Architecture

Basic search may initially use PostgreSQL capabilities.

For larger deployments, the application may integrate:

```text
Meilisearch
Elasticsearch
OpenSearch
```

Search indexes shall not become the authoritative source of application data.

The source of truth remains PostgreSQL.

---

# 9.71 Database and External Music Providers

The system shall not assume that all music provider data should be permanently stored.

The database may store:

* Provider
* Provider track ID
* Basic metadata
* User saved references
* Listening history references

The system shall follow the selected provider's API and licensing requirements.

Protected audio shall not be copied into the database merely for convenience.

---

# 9.72 Database and File Storage

The database shall store file metadata and relationships.

The actual binary content should normally remain outside PostgreSQL.

```text
Message
   │
   ▼
Attachment
   │
   ▼
File Metadata
   │
   ▼
Object Storage
```

This design allows storage providers to be changed without redesigning the message system.

---

# 9.73 Database ERD — Core Communication

A simplified communication ERD:

```text
┌─────────────┐
│    users    │
└──────┬──────┘
       │
       │ 1:N
       ▼
┌─────────────────────┐
│ conversation_members│
└─────────┬───────────┘
          │
          │ N:1
          ▼
┌─────────────────────┐
│   conversations     │
└─────────┬───────────┘
          │
          │ 1:N
          ▼
┌─────────────────────┐
│      messages       │
└────┬──────┬─────┬───┘
     │      │     │
     ▼      ▼     ▼
 reactions mentions attachments
                  │
                  ▼
                 files
```

---

# 9.74 Database ERD — Communities

```text
┌─────────────┐
│    users    │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│ community_members   │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│    communities      │
└─────────┬───────────┘
          │
          │ 1:N
          ▼
┌─────────────────────┐
│      channels       │
└─────────┬───────────┘
          │
          │ 1:N
          ▼
      messages
```

---

# 9.75 Database ERD — Music and Jam

```text
┌─────────────┐
│    users    │
└──────┬──────┘
       │
       │
       ▼
┌─────────────────────┐
│   saved_tracks      │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│    music_tracks     │
└─────────────────────┘


┌─────────────┐
│    users    │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│     jam_members     │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│        jams         │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ jam_playback_states │
└─────────┬───────────┘
          │
          ▼
     music_tracks
```

---

# 9.76 Database Functional Requirements

The database subsystem shall use the following requirement identifiers:

* **FR-DB-001** — User data storage
* **FR-DB-002** — Profile data storage
* **FR-DB-003** — User settings storage
* **FR-DB-004** — Session management data
* **FR-DB-005** — Conversation storage
* **FR-DB-006** — Conversation membership
* **FR-DB-007** — Message storage
* **FR-DB-008** — Message threading
* **FR-DB-009** — Message reactions
* **FR-DB-010** — Message mentions
* **FR-DB-011** — Message read state
* **FR-DB-012** — Message attachments
* **FR-DB-013** — File metadata
* **FR-DB-014** — Community storage
* **FR-DB-015** — Community membership
* **FR-DB-016** — Channel storage
* **FR-DB-017** — Notification storage
* **FR-DB-018** — Music metadata
* **FR-DB-019** — Saved music
* **FR-DB-020** — Listening history
* **FR-DB-021** — Jam storage
* **FR-DB-022** — Jam membership
* **FR-DB-023** — Jam playback state
* **FR-DB-024** — Reports
* **FR-DB-025** — Audit logs
* **FR-DB-026** — Referential integrity
* **FR-DB-027** — Database indexing
* **FR-DB-028** — Data transactions
* **FR-DB-029** — Soft deletion
* **FR-DB-030** — Data retention
* **FR-DB-031** — Backup compatibility
* **FR-DB-032** — Database security
* **FR-DB-033** — Database migration management
* **FR-DB-034** — Database scalability
* **FR-DB-035** — Cross-module data consistency

---

# 9.77 Database Design Summary

The database shall provide the persistent foundation of the entire platform.

The major design principle is:

```text
PostgreSQL
    │
    ├── Identity
    ├── Communication
    ├── Communities
    ├── Music Metadata
    ├── Jams
    ├── Notifications
    ├── Files Metadata
    └── Administration
```

The architecture separates persistent data from:

```text
Redis
    └── Cache / Queue / Temporary State

Pusher
    └── Realtime Event Delivery

Music Provider
    └── Music Catalog / Playback

Object Storage
    └── Binary Files
```

This separation ensures that each infrastructure component has a clearly defined responsibility.

The database remains the authoritative source for persistent business data, while realtime services, caches, search indexes, and external providers act as supporting systems.

The resulting architecture provides a foundation that can support the initial React web application while remaining compatible with future React Native mobile and Tauri desktop applications.
