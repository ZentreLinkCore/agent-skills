# Comments Specification

## Purpose

The Comments module enables users to participate in discussions around community posts.

Its purpose is to encourage meaningful business conversations, questions, feedback, and professional interactions while maintaining content ownership and moderation controls.

---

## Overview

A Comment is a response to a Post.

Comments may support direct replies to posts and, where enabled, threaded replies to other comments.

---

## Actors

- Individual User
- Organization Member
- System
- Moderator

---

## Scope

### In Scope

- Create comments
- Edit comments
- Delete comments
- Reply to comments
- Mention users
- Comment visibility
- Comment moderation

### Future Scope

- Rich text
- Media comments
- Reactions on comments
- Comment sorting
- AI-assisted moderation

---

## Main Flow

```text
Open Post
    ↓
Enter Comment
    ↓
Submit Comment
    ↓
Validate Content
    ↓
Publish Comment
    ↓
Notify Relevant Users
```

---

## Rules

### General Rules

- Only authenticated users may create comments.
- A comment must belong to an accessible post.
- Users may edit their own comments.
- Users may delete their own comments.
- Organization members may only act within organization content according to their permissions.
- Comments must follow ScaleUP community standards.

### Visibility Rules

A comment cannot be more visible than the post it belongs to.

For example:

```text
Post Visibility: Connections
Comment Visibility: Connections
```

A comment must not expose content to users who cannot access the parent post.

### Editing Rules

- Users may edit comments they own.
- The system may record the last edited state.
- Moderation history may be retained where necessary.

### Deletion Rules

- Users may delete their own comments.
- Moderators may remove comments that violate policy.
- Organization administrators may moderate organization-owned content according to permissions.

---

## Permissions

| Action | Visitor | Authenticated User | Org Member | Moderator |
| :--- | :---: | :---: | :---: | :---: |
| View Accessible Comment | ❌ | ✅ | ✅ | ✅ |
| Create Comment | ❌ | ✅ | ✅ | ✅ |
| Edit Own Comment | ❌ | ✅ | ✅ | ✅ |
| Delete Own Comment | ❌ | ✅ | ✅ | ✅ |
| Moderate Comment | ❌ | ❌ | Based on permission | ✅ |

---

## Replies

The system may support threaded replies.

Example:

```text
Post
 └── Comment
      ├── Reply
      └── Reply
```

Thread depth should be controlled to prevent excessive nesting.

---

## Mentions

Users may mention other users in comments.

Mention visibility must respect:

- Post visibility
- Profile visibility
- Blocking
- User status

---

## Notifications

Comment activity may generate notifications for:

- Post author
- Comment author
- Mentioned users
- Users participating in the same discussion

Notifications must not reveal inaccessible content.

---

## Moderation

Users should be able to report comments.

Possible reasons:

- Spam
- Harassment
- Fraud
- Inappropriate Content
- Misleading Information
- Other

---

## States

```text
Created
  ↓
Published
  ↓
Edited
  ↓
Deleted / Removed
```

---

## Edge Cases

- Parent post has been deleted.
- User loses access to the parent post.
- Comment author is suspended.
- Comment is deleted while replies remain.
- Mentioned user cannot access the parent post.
- Content fails moderation.

---

## Success Criteria

Users should be able to participate in meaningful business discussions while maintaining post visibility, user permissions, privacy, and community safety.
