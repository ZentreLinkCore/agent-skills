# Connections Specification

## Purpose

The Connections module allows individuals to establish professional relationships with other users within the ScaleUP community.

Its purpose is to support meaningful business networking, collaboration, and relationship building.

## Overview

A Connection represents a mutual professional relationship between two Individual Users.

Connections are separate from:

- Organization Membership
- Following
- Messaging permissions

A user may connect with another user without belonging to the same organization.

## Actors

- Individual User
- System

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
````

## Connection States

```text
None
 ↓
Pending
 ↓
Accepted
```

Alternative states:

* Declined
* Cancelled
* Removed
* Blocked

## Rules

* A user cannot connect with themselves.
* Duplicate active connection requests are not allowed.
* A connection request may only be sent to a discoverable user.
* Users may remove an existing connection.
* Blocked relationships must prevent unauthorized connection requests.
* A connection does not grant access to private organization or business data.
* Connection status must be consistent for both participants.

## Permissions

| Action                  | User |
| ----------------------- | ---: |
| Send Connection Request |    ✅ |
| Accept Request          |    ✅ |
| Decline Request         |    ✅ |
| Cancel Own Request      |    ✅ |
| Remove Connection       |    ✅ |
| View Own Connections    |    ✅ |

## Notifications

Connection activity may generate notifications for:

* New connection request
* Request accepted
* Request declined
* Connection removed where applicable

## Privacy

Users should be able to control whether their connections are publicly visible.

The platform must respect:

* Profile visibility
* Blocking
* Account status
* Privacy settings

## Edge Cases

* Recipient blocks the sender.
* Recipient becomes inactive.
* Connection request expires.
* Duplicate requests are submitted.
* User deletes account.
* User changes profile visibility while a request is pending.

## Success Criteria

Users should be able to build professional relationships through a simple, secure, and privacy-aware connection system.

````

## `specifications/community/FOLLOWING.md`

```md
# Following Specification

## Purpose

The Following module allows users to subscribe to public updates from users and organizations without requiring a mutual connection or organization membership.

Its purpose is to improve content discovery and help users stay informed about people and organizations relevant to their interests.

## Overview

Following is a one-way relationship.

Example:

```text
John Doe
   ↓
Follows
   ↓
ABC Coffee
````

Following does not provide access to private information.

## Actors

* Individual User
* Organization
* System

## Scope

### In Scope

* Follow user
* Unfollow user
* Follow organization
* Unfollow organization
* View followed entities
* Feed integration

### Future Scope

* Topic following
* Industry following
* Hashtag following
* Personalized recommendations

## Main Flow

```text
Discover Profile
    ↓
Select Follow
    ↓
Following Relationship Created
    ↓
Relevant Public Updates Appear in Feed
```

## Rules

* A user cannot follow themselves.
* A user may follow an organization.
* Following does not create an organization membership.
* Following does not grant private access.
* A user may unfollow at any time.
* Private or non-discoverable profiles cannot be followed unless explicitly supported by privacy rules.

## Permissions

| Action                     |     Individual User |
| -------------------------- | ------------------: |
| Follow User                |                   ✅ |
| Unfollow User              |                   ✅ |
| Follow Organization        |                   ✅ |
| Unfollow Organization      |                   ✅ |
| View Own Following List    |                   ✅ |
| View Public Follower Count | Based on Visibility |

## Feed Integration

Following may influence the Community Feed.

Content from followed users and organizations may receive higher relevance.

Following must not override content visibility or access restrictions.

## Notifications

Following may optionally generate notifications for:

* Important organization updates
* New public posts
* Major announcements

Users should control these notification preferences.

## Privacy

Users may have control over whether their followers are publicly visible.

Organizations may publicly display follower counts where appropriate.

## Edge Cases

* Followed account becomes private.
* Followed organization becomes inactive.
* User blocks a followed account.
* Followed content is deleted.
* User unfollows while viewing the feed.

## Success Criteria

Users should be able to easily curate their business-related information sources and receive relevant public updates without requiring a mutual relationship.