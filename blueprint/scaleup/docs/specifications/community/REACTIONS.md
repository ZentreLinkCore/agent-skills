# Reactions Specification

## Purpose

The Reactions module allows users to express lightweight feedback on community content without requiring a full comment.

Its purpose is to increase engagement and provide simple indicators of community interest and sentiment.

---

## Overview

A Reaction represents a user's response to supported content such as:

- Posts
- Comments
- Other future community content

The initial implementation should remain simple and extensible.

---

## Actors

- Individual User
- Organization Member
- System

---

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

---

## Reaction Types

Initial reaction types may include:

- Like
- Celebrate
- Support
- Insightful

The reaction model should support additional types without requiring a redesign.

---

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
```

---

## Rules

- A user may have at most one active reaction per supported content item.
- Users may change their reaction.
- Users may remove their reaction.
- Reactions must respect content visibility.
- Users cannot react to content they cannot access.
- Deleted content must no longer accept reactions.
- Reactions must not expose private information.

---

## Permissions

| Action | Visitor | Authenticated User |
| :--- | :---: | :---: |
| View Reaction Count | Based on Content Visibility | ✅ |
| Add Reaction | ❌ | ✅ |
| Change Reaction | ❌ | ✅ |
| Remove Own Reaction | ❌ | ✅ |

---

## Reaction Counts

The platform may display aggregate counts.

Example:

```text
❤️ 124
🎉 42
💡 18
```

Counts must be recalculated or updated consistently when reactions are added, changed, or removed.

---

## Notifications

A reaction may generate a notification to:

- Post author
- Comment author

The platform should prevent excessive notifications where repeated reactions occur.

---

## Privacy

Reaction visibility should follow the visibility of the content.

The platform may eventually provide controls for showing or hiding reaction participants.

---

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

---

## Edge Cases

- User attempts to react to inaccessible content.
- Content is deleted after a reaction.
- User changes reaction type.
- User is blocked by the content author.
- Duplicate reaction requests are submitted.
- Reaction request is submitted after content becomes unavailable.

---

## Success Criteria

Users should be able to quickly express engagement with community content while maintaining consistent reaction counts, privacy, authorization, and notification behavior.
