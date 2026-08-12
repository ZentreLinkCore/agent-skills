# Posts Specification

## Purpose

The Posts module allows individuals and organizations to publish business-focused content within the ScaleUP Community.

Its purpose is to enable users and organizations to share updates, ideas, questions, achievements, announcements, and opportunities while maintaining clear ownership, visibility, and moderation rules.

---

## Overview

A Post is a piece of community content authored by either:

- An Individual User
- An Organization

Posts are displayed through the Community Feed and may be associated with comments, reactions, mentions, and other community interactions.

---

## Actors

- Individual User
- Organization Member
- Organization
- System
- Moderator

---

## Scope

### In Scope

- Create posts
- Edit posts
- Delete posts
- Post visibility
- Post types
- Text content
- Media attachments
- Mentions
- Drafts
- Publishing
- Content reporting

### Future Scope

- Scheduled posts
- Polls
- Articles
- Rich media
- Live posts
- Reposts
- Advanced post analytics

---

## Main Flow

```text
Create Post
    ↓
Enter Content
    ↓
Select Post Type
    ↓
Select Visibility
    ↓
Publish
    ↓
Post Available in Community
```

---

## Post Authors

### Individual Post

The post is owned by the individual user.

### Organization Post

The post is owned by the organization and published by an authorized organization member.

The organization remains the content owner even when a specific member publishes the post.

---

## Post Types

Initial post types may include:

- Business Update
- Discussion
- Question
- Achievement
- Announcement
- Industry Insight
- Opportunity
- Event

The system should allow additional post types in the future.

---

## Post Visibility

Supported visibility levels may include:

- Public
- Community
- Connections
- Organization
- Restricted

The selected visibility must be enforced when displaying posts through feeds, search, profiles, notifications, and direct links.

---

## Rules

### General Rules

- A post must have an authorized author.
- A user may only edit their own post.
- Organization posts may only be edited by users with appropriate organization permissions.
- Deleted posts must no longer be available through normal community discovery.
- Post visibility must be enforced consistently across all platform surfaces.
- Users must not be able to publish content on behalf of an organization without the required permission.

### Content Rules

- Posts must comply with ScaleUP community standards.
- Spam, fraudulent content, harassment, and prohibited content must not be allowed.
- The system may apply content validation before publishing.
- Content moderation may be automated, manual, or both.

### Editing Rules

- Authors may edit posts they own.
- The system may record when a post was edited.
- Previous versions may be retained for moderation or audit purposes where required.

### Deletion Rules

- Authors may delete posts they own.
- Organization administrators may remove organization posts according to organization permissions.
- Moderators may remove content that violates platform policy.

---

## Permissions

| Action | Visitor | Individual User | Org Member | Org Admin | Org Owner |
| :--- | :---: | :---: | :---: | :---: | :---: |
| View Public Post | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create Personal Post | ❌ | ✅ | ✅ | ✅ | ✅ |
| Edit Own Post | ❌ | ✅ | ✅ | ✅ | ✅ |
| Delete Own Post | ❌ | ✅ | ✅ | ✅ | ✅ |
| Create Organization Post | ❌ | ❌ | Based on permission | ✅ | ✅ |
| Edit Organization Post | ❌ | ❌ | Based on permission | ✅ | ✅ |
| Delete Organization Post | ❌ | ❌ | Based on permission | ✅ | ✅ |
| Report Post | ❌ | ✅ | ✅ | ✅ | ✅ |

---

## Media Attachments

Future-supported attachments may include:

- Images
- Videos
- Documents
- Links

Attachments must follow platform storage, security, and content rules.

---

## Mentions

Users may mention other users or organizations where supported.

Mention behavior must respect:

- Privacy settings
- Blocking
- Visibility
- Account status

---

## Drafts

Future support may allow users to save unfinished posts as drafts.

Drafts must only be accessible to their owner or authorized organization members.

---

## Notifications

Posts may generate notifications for:

- Mentions
- Comments
- Reactions
- Shares or reposts
- Organization announcements

Notifications must follow notification preferences and authorization rules.

---

## Moderation

Users should be able to report posts.

Possible report reasons:

- Spam
- Fraud
- Harassment
- Misleading Information
- Inappropriate Content
- Unauthorized Promotion
- Other

Reported content may be reviewed according to ScaleUP moderation policies.

---

## States

```text
Draft
  ↓
Published
  ↓
Edited
  ↓
Archived / Deleted / Removed
```

---

## Edge Cases

- User attempts to edit another user's post.
- User loses organization permissions after publishing an organization post.
- Organization becomes inactive or subscription expires.
- Post visibility is changed after publication.
- Post is deleted while comments or reactions exist.
- Attachment fails to upload.
- Content fails moderation.
- Mentioned user has blocked the author.
- Post author account is suspended.

---

## Success Criteria

Users should be able to create and manage meaningful business-focused posts while ScaleUP consistently protects content ownership, visibility, organization permissions, and community safety.
