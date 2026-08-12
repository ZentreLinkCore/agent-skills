## `specifications/community/POSTS.md`

````md
# Posts Specification

## Purpose

The Posts module allows individuals and organizations to publish business-focused content within the ScaleUP Community.

Its purpose is to enable users and organizations to share updates, ideas, questions, achievements, announcements, and opportunities while maintaining clear ownership, visibility, and moderation rules.

## Overview

A Post is a piece of community content authored by either:

- An Individual User
- An Organization

Posts are displayed through the Community Feed and may be associated with comments, reactions, mentions, and other community interactions.

## Actors

- Individual User
- Organization Member
- Organization
- System
- Moderator

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
````

## Post Authors

### Individual Post

The post is owned by the individual user.

### Organization Post

The post is owned by the organization and published by an authorized organization member.

The organization remains the content owner even when a specific member publishes the post.

## Post Types

Initial post types may include:

* Business Update
* Discussion
* Question
* Achievement
* Announcement
* Industry Insight
* Opportunity
* Event

The system should allow additional post types in the future.

## Post Visibility

Supported visibility levels may include:

* Public
* Community
* Connections
* Organization
* Restricted

The selected visibility must be enforced when displaying posts through feeds, search, profiles, notifications, and direct links.

## Rules

### General Rules

* A post must have an authorized author.
* A user may only edit their own post.
* Organization posts may only be edited by users with appropriate organization permissions.
* Deleted posts must no longer be available through normal community discovery.
* Post visibility must be enforced consistently across all platform surfaces.
* Users must not be able to publish content on behalf of an organization without the required permission.

### Content Rules

* Posts must comply with ScaleUP community standards.
* Spam, fraudulent content, harassment, and prohibited content must not be allowed.
* The system may apply content validation before publishing.
* Content moderation may be automated, manual, or both.

### Editing Rules

* Authors may edit posts they own.
* The system may record when a post was edited.
* Previous versions may be retained for moderation or audit purposes where required.

### Deletion Rules

* Authors may delete posts they own.
* Organization administrators may remove organization posts according to organization permissions.
* Moderators may remove content that violates platform policy.

## Permissions

| Action                   | Visitor | Individual User |          Org Member | Org Admin | Org Owner |
| ------------------------ | ------: | --------------: | ------------------: | --------: | --------: |
| View Public Post         |       ✅ |               ✅ |                   ✅ |         ✅ |         ✅ |
| Create Personal Post     |       ❌ |               ✅ |                   ✅ |         ✅ |         ✅ |
| Edit Own Post            |       ❌ |               ✅ |                   ✅ |         ✅ |         ✅ |
| Delete Own Post          |       ❌ |               ✅ |                   ✅ |         ✅ |         ✅ |
| Create Organization Post |       ❌ |               ❌ | Based on permission |         ✅ |         ✅ |
| Edit Organization Post   |       ❌ |               ❌ | Based on permission |         ✅ |         ✅ |
| Delete Organization Post |       ❌ |               ❌ | Based on permission |         ✅ |         ✅ |
| Report Post              |       ❌ |               ✅ |                   ✅ |         ✅ |         ✅ |

## Media Attachments

Future-supported attachments may include:

* Images
* Videos
* Documents
* Links

Attachments must follow platform storage, security, and content rules.

## Mentions

Users may mention other users or organizations where supported.

Mention behavior must respect:

* Privacy settings
* Blocking
* Visibility
* Account status

## Drafts

Future support may allow users to save unfinished posts as drafts.

Drafts must only be accessible to their owner or authorized organization members.

## Notifications

Posts may generate notifications for:

* Mentions
* Comments
* Reactions
* Shares or reposts
* Organization announcements

Notifications must follow notification preferences and authorization rules.

## Moderation

Users should be able to report posts.

Possible report reasons:

* Spam
* Fraud
* Harassment
* Misleading Information
* Inappropriate Content
* Unauthorized Promotion
* Other

Reported content may be reviewed according to ScaleUP moderation policies.

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

## Edge Cases

* User attempts to edit another user's post.
* User loses organization permissions after publishing an organization post.
* Organization becomes inactive or subscription expires.
* Post visibility is changed after publication.
* Post is deleted while comments or reactions exist.
* Attachment fails to upload.
* Content fails moderation.
* Mentioned user has blocked the author.
* Post author account is suspended.

## Success Criteria

Users should be able to create and manage meaningful business-focused posts while ScaleUP consistently protects content ownership, visibility, organization permissions, and community safety.

````

## `specifications/community/COMMENTS.md`

```md
# Comments Specification

## Purpose

The Comments module enables users to participate in discussions around community posts.

Its purpose is to encourage meaningful business conversations, questions, feedback, and professional interactions while maintaining content ownership and moderation controls.

## Overview

A Comment is a response to a Post.

Comments may support direct replies to posts and, where enabled, threaded replies to other comments.

## Actors

- Individual User
- Organization Member
- System
- Moderator

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
````

## Rules

### General Rules

* Only authenticated users may create comments.
* A comment must belong to an accessible post.
* Users may edit their own comments.
* Users may delete their own comments.
* Organization members may only act within organization content according to their permissions.
* Comments must follow ScaleUP community standards.

### Visibility Rules

A comment cannot be more visible than the post it belongs to.

For example:

```text
Post Visibility: Connections
Comment Visibility: Connections
```

A comment must not expose content to users who cannot access the parent post.

### Editing Rules

* Users may edit comments they own.
* The system may record the last edited state.
* Moderation history may be retained where necessary.

### Deletion Rules

* Users may delete their own comments.
* Moderators may remove comments that violate policy.
* Organization administrators may moderate organization-owned content according to permissions.

## Permissions

| Action                  | Visitor | Authenticated User |          Org Member | Moderator |
| ----------------------- | ------: | -----------------: | ------------------: | --------: |
| View Accessible Comment |       ❌ |                  ✅ |                   ✅ |         ✅ |
| Create Comment          |       ❌ |                  ✅ |                   ✅ |         ✅ |
| Edit Own Comment        |       ❌ |                  ✅ |                   ✅ |         ✅ |
| Delete Own Comment      |       ❌ |                  ✅ |                   ✅ |         ✅ |
| Moderate Comment        |       ❌ |                  ❌ | Based on permission |         ✅ |

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

## Mentions

Users may mention other users in comments.

Mention visibility must respect:

* Post visibility
* Profile visibility
* Blocking
* User status

## Notifications

Comment activity may generate notifications for:

* Post author
* Comment author
* Mentioned users
* Users participating in the same discussion

Notifications must not reveal inaccessible content.

## Moderation

Users should be able to report comments.

Possible reasons:

* Spam
* Harassment
* Fraud
* Inappropriate Content
* Misleading Information
* Other

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

## Edge Cases

* Parent post has been deleted.
* User loses access to the parent post.
* Comment author is suspended.
* Comment is deleted while replies remain.
* Mentioned user cannot access the parent post.
* Content fails moderation.

## Success Criteria

Users should be able to participate in meaningful business discussions while maintaining post visibility, user permissions, privacy, and community safety.

````

## `specifications/community/REACTIONS.md`

```md
# Reactions Specification

## Purpose

The Reactions module allows users to express lightweight feedback on community content without requiring a full comment.

Its purpose is to increase engagement and provide simple indicators of community interest and sentiment.

## Overview

A Reaction represents a user's response to supported content such as:

- Posts
- Comments
- Other future community content

The initial implementation should remain simple and extensible.

## Actors

- Individual User
- Organization Member
- System

## Scope

### In Scope

- Add reaction
- Change reaction
- Remove reaction
- Display reaction counts
- Display reaction participants where permitted

### Future Scope

- Additional reaction types
- Reaction analytics
- Personalized reaction recommendations

## Reaction Types

Initial reaction types may include:

- Like
- Celebrate
- Support
- Insightful

The reaction model should support additional types without requiring a redesign.

## Main Flow

```text
View Content
    ↓
Select Reaction
    ↓
Create / Update Reaction
    ↓
Update Reaction Count
    ↓
Notify Content Owner
````

## Rules

* A user may have at most one active reaction per supported content item.
* Users may change their reaction.
* Users may remove their reaction.
* Reactions must respect content visibility.
* Users cannot react to content they cannot access.
* Deleted content must no longer accept reactions.
* Reactions must not expose private information.

## Permissions

| Action              |                     Visitor | Authenticated User |
| ------------------- | --------------------------: | -----------------: |
| View Reaction Count | Based on Content Visibility |                  ✅ |
| Add Reaction        |                           ❌ |                  ✅ |
| Change Reaction     |                           ❌ |                  ✅ |
| Remove Own Reaction |                           ❌ |                  ✅ |

## Reaction Counts

The platform may display aggregate counts.

Example:

```text
❤️ 124
🎉 42
💡 18
```

Counts must be recalculated or updated consistently when reactions are added, changed, or removed.

## Notifications

A reaction may generate a notification to:

* Post author
* Comment author

The platform should prevent excessive notifications where repeated reactions occur.

## Privacy

Reaction visibility should follow the visibility of the content.

The platform may eventually provide controls for showing or hiding reaction participants.

## States

```text
No Reaction
    ↓
Reacted
    ↓
Changed Reaction
    ↓
Removed
```

## Edge Cases

* User attempts to react to inaccessible content.
* Content is deleted after a reaction.
* User changes reaction type.
* User is blocked by the content author.
* Duplicate reaction requests are submitted.
* Reaction request is submitted after content becomes unavailable.

## Success Criteria

Users should be able to quickly express engagement with community content while maintaining consistent reaction counts, privacy, authorization, and notification behavior.

```
```
