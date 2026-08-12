# Following Specification

## Purpose

The Following module allows users to subscribe to public updates from users and organizations without requiring a mutual connection or organization membership.

Its purpose is to improve content discovery and help users stay informed about people and organizations relevant to their interests.

---

## Overview

Following is a one-way relationship.

Example:

```text
John Doe
   ↓
Follows
   ↓
ABC Coffee
```

Following does not provide access to private information.

---

## Actors

- Individual User
- Organization
- System

---

## Scope

### In Scope

- Follow user
- Unfollow user
- Follow organization
- Unfollow organization
- View followed entities
- Feed integration

### Future Scope

- Topic following
- Industry following
- Hashtag following
- Personalized recommendations

---

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

---

## Rules

- A user cannot follow themselves.
- A user may follow an organization.
- Following does not create an organization membership.
- Following does not grant private access.
- A user may unfollow at any time.
- Private or non-discoverable profiles cannot be followed unless explicitly supported by privacy rules.

---

## Permissions

| Action | Individual User |
| :--- | :---: |
| Follow User | ✅ |
| Unfollow User | ✅ |
| Follow Organization | ✅ |
| Unfollow Organization | ✅ |
| View Own Following List | ✅ |
| View Public Follower Count | Based on Visibility |

---

## Feed Integration

Following may influence the Community Feed.

Content from followed users and organizations may receive higher relevance.

Following must not override content visibility or access restrictions.

---

## Notifications

Following may optionally generate notifications for:

- Important organization updates
- New public posts
- Major announcements

Users should control these notification preferences.

---

## Privacy

Users may have control over whether their followers are publicly visible.

Organizations may publicly display follower counts where appropriate.

---

## Edge Cases

- Followed account becomes private.
- Followed organization becomes inactive.
- User blocks a followed account.
- Followed content is deleted.
- User unfollows while viewing the feed.

---

## Success Criteria

Users should be able to easily curate their business-related information sources and receive relevant public updates without requiring a mutual relationship.
