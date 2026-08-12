# Connections Specification

## Purpose

The Connections module allows individuals to establish professional relationships with other users within the ScaleUP community.

Its purpose is to support meaningful business networking, collaboration, and relationship building.

---

## Overview

A Connection represents a mutual professional relationship between two Individual Users.

Connections are separate from:

- Organization Membership
- Following
- Messaging permissions

A user may connect with another user without belonging to the same organization.

---

## Actors

- Individual User
- System

---

## Scope

### In Scope

- Send connection request
- Accept request
- Decline request
- Cancel request
- Remove connection
- View connections
- Connection status

### Future Scope

- Connection recommendations
- Connection notes
- Professional introductions
- Mutual connections
- Networking insights

---

## Main Flow

```text
View User Profile
    ↓
Send Connection Request
    ↓
Recipient Receives Request
    ↓
Accept / Decline
    ↓
Connection Established
```

---

## Connection States

```text
None
 ↓
Pending
 ↓
Accepted
```

Alternative states:

- Declined
- Cancelled
- Removed
- Blocked

---

## Rules

- A user cannot connect with themselves.
- Duplicate active connection requests are not allowed.
- A connection request may only be sent to a discoverable user.
- Users may remove an existing connection.
- Blocked relationships must prevent unauthorized connection requests.
- A connection does not grant access to private organization or business data.
- Connection status must be consistent for both participants.

---

## Permissions

| Action | User |
| :--- | :---: |
| Send Connection Request | ✅ |
| Accept Request | ✅ |
| Decline Request | ✅ |
| Cancel Own Request | ✅ |
| Remove Connection | ✅ |
| View Own Connections | ✅ |

---

## Notifications

Connection activity may generate notifications for:

- New connection request
- Request accepted
- Request declined
- Connection removed where applicable

---

## Privacy

Users should be able to control whether their connections are publicly visible.

The platform must respect:

- Profile visibility
- Blocking
- Account status
- Privacy settings

---

## Edge Cases

- Recipient blocks the sender.
- Recipient becomes inactive.
- Connection request expires.
- Duplicate requests are submitted.
- User deletes account.
- User changes profile visibility while a request is pending.

---

## Success Criteria

Users should be able to build professional relationships through a simple, secure, and privacy-aware connection system.
