# Messaging Specification

## Purpose

The Messaging module allows users to communicate privately within the ScaleUP ecosystem.

Its purpose is to support professional networking, business discussions, collaboration, and opportunity-related communication.

## Overview

Messaging provides private conversations between authorized participants.

Initial messaging should focus on direct user-to-user communication, with future support for group and organization conversations.

## Actors

- Individual User
- Organization Member
- System

## Scope

### In Scope

- Direct messaging
- Conversations
- Message history
- Read status
- Message notifications
- Message restrictions
- Blocking

### Future Scope

- Group conversations
- Organization conversations
- File sharing
- Voice and video
- Business opportunity threads
- Conversation search

## Main Flow

```text
Open User Profile
    ↓
Select Message
    ↓
Create / Open Conversation
    ↓
Send Message
    ↓
Recipient Receives Message
    ↓
Read / Reply
````

## Rules

* Only authorized participants may access a conversation.
* Users may send messages according to messaging and privacy settings.
* Blocked users must not be able to send unauthorized messages.
* Deleted accounts must not expose private conversation history to unauthorized users.
* Private messages must never appear in public search or community feeds.
* Message content must be protected from unauthorized access.

## Messaging Permissions

| Action             |                        User |
| ------------------ | --------------------------: |
| Start Conversation |                           ✅ |
| Send Message       | Based on Recipient Settings |
| Read Conversation  |                           ✅ |
| Delete Own Message |             Based on Policy |
| Block User         |                           ✅ |
| Report Message     |                           ✅ |

## Message States

```text
Sending
   ↓
Sent
   ↓
Delivered
   ↓
Read
```

Possible failure state:

* Failed

## Conversation States

* Active
* Archived
* Blocked
* Closed

## Privacy Controls

Users may configure:

* Who can message them
* Who can send connection requests
* Whether unknown users can start conversations

Potential options:

* Everyone
* Connections
* No one

## Notifications

Messages may generate:

* In-app notifications
* Email notifications
* Push notifications

Notification behavior must follow user preferences.

## Message Moderation

Users may report inappropriate or abusive messages.

Potential report categories:

* Spam
* Harassment
* Fraud
* Threatening Content
* Other

## Edge Cases

* Recipient blocks sender during a conversation.
* User deletes account.
* User loses access to organization-related conversation.
* Message fails to send.
* Conversation participant becomes suspended.
* Recipient changes messaging privacy settings.

## Success Criteria

Users should be able to communicate privately and securely for professional networking, collaboration, and business opportunities while maintaining strong privacy and abuse controls.
