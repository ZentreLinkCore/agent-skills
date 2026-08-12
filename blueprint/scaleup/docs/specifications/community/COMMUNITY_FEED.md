# Community Feed Specification

## Purpose

The Community Feed is the primary discovery and engagement space of the ScaleUP platform.

Its purpose is to provide individuals and organizations with a business-focused environment where they can discover relevant content, share updates, exchange knowledge, participate in discussions, and discover opportunities.

Unlike a general social media feed, the ScaleUP Community Feed is centered on business, entrepreneurship, professional development, collaboration, and growth.

---

## Overview

The Community Feed aggregates relevant public content from users and organizations that the current user is allowed to discover.

Content may include:

- Personal posts
- Organization posts
- Business updates
- Discussions
- Questions
- Achievements
- Announcements
- Opportunities
- Industry insights

The feed should provide a personalized and relevant experience while maintaining privacy and content visibility rules.

---

## Actors

- Visitor
- Individual User
- Organization Member
- Organization
- System

---

## Scope

### In Scope

- Feed display
- Feed content discovery
- Post creation
- Post visibility
- Feed interactions
- Feed filtering
- Content reporting
- Content moderation
- Infinite scrolling or pagination
- Personalized feed ordering

### Future Scope

- Recommended content
- Trending topics
- Personalized recommendations
- AI-powered content discovery
- Industry-specific feeds
- Saved posts
- Advanced feed customization

---

## Main Flow

```text
User Opens ScaleUP
        ↓
Load Community Feed
        ↓
Evaluate Available Content
        ↓
Apply Visibility Rules
        ↓
Apply User Preferences
        ↓
Order Relevant Content
        ↓
Display Feed
        ↓
User Interacts With Content
```

---

## Feed Content Sources

The feed may include content from:

### People

Posts published by individual users.

### Organizations

Public posts and announcements published by organizations.

### Opportunities

Business opportunities published through the Opportunities domain.

### Platform

Official ScaleUP announcements, educational content, events, and important platform updates.

---

## Feed Sections

The primary feed may contain:

- Recommended
- Following
- Connections
- Organizations
- Opportunities
- Latest

The final navigation may evolve as the community grows.

---

## Feed Rules

### Visibility

- Only content visible to the current user may appear.
- Private content must never appear in unauthorized feeds.
- Deleted content must be removed from active feed results.
- Blocked or restricted users must follow platform privacy rules.
- Organization content must respect organization visibility settings.

### Relevance

The feed should prioritize content that is relevant to the user.

Relevance may consider:

- Connections
- Followed organizations
- Industry
- User interests
- Engagement
- Recent activity
- Opportunity relevance

### Chronological Ordering

The platform should support chronological ordering where applicable.

### Personalized Ordering

The platform may eventually use ranking signals to surface more relevant content.

---

## Post Visibility

Posts may support visibility levels such as:

- Public
- Community
- Connections
- Organization
- Restricted

Visibility rules must determine who can discover and interact with each post.

---

## Feed Interactions

Users may interact with feed content through:

- View
- React
- Comment
- Share where supported
- Save where supported
- Follow author or organization
- Open related opportunity
- Report content

---

## Feed Filtering

Users may filter content using available feed categories.

Potential filters:

- People
- Organizations
- Opportunities
- Industry
- Topic
- Latest
- Following

---

## Feed Refresh

The feed should support content refresh without requiring a complete application reload.

New content may be indicated through a lightweight notification such as:

```text
12 new posts
```

The user may choose to load the new content.

---

## Pagination

The feed should support scalable content loading through:

- Pagination
- Infinite scrolling
- Cursor-based loading

The final approach should support large content volumes without loading the entire feed at once.

---

## Permissions

| Action | Visitor | Individual User | Organization Member |
| :--- | :---: | :---: | :---: |
| View Public Feed | ✅ | ✅ | ✅ |
| View Community Content | ❌ | ✅ | ✅ |
| Create Personal Post | ❌ | ✅ | ✅ |
| Interact With Post | ❌ | ✅ | ✅ |
| Follow Organization | ❌ | ✅ | ✅ |
| Report Content | ❌ | ✅ | ✅ |
| Publish Organization Post | ❌ | ❌ | Based on Organization Permission |

Visitors may only access publicly available content.

---

## Organization Content

Organizations may publish public content to the Community Feed.

Examples:

- Company announcements
- Product launches
- Business milestones
- Hiring announcements
- Events
- Partnerships
- Business opportunities

Organization publishing permissions must be controlled by organization roles and permissions.

---

## Content Moderation

Users should be able to report content that violates ScaleUP policies.

Possible report categories:

- Spam
- Fraud
- Harassment
- Misleading Information
- Inappropriate Content
- Unauthorized Promotion
- Other

Reported content may be reviewed according to the platform moderation policy.

---

## Notifications

The Community Feed may generate notifications for:

- Post reactions
- Comments
- Mentions
- Shares
- New followers
- Content reports
- Organization announcements
- Recommended opportunities

Notifications must respect user preferences and permissions.

---

## Edge Cases

- Feed contains no available content.
- User follows no organizations or users.
- User has limited profile visibility.
- A post is deleted while being displayed.
- User loses access to organization content.
- A post becomes private after appearing in a feed.
- Content is reported or removed while the user is viewing it.
- Feed request fails or times out.
- Large feed volumes require additional pagination.

---

## Empty State

When no relevant content is available, the platform should guide the user toward discovery.

Example:

```text
Your business network is just getting started.

Connect with people, follow organizations,
and discover opportunities to personalize your feed.
```

---

## Success Criteria

The Community Feed should provide users with a relevant and engaging business-focused content experience where they can discover information, participate in discussions, connect with others, and identify opportunities while maintaining strong privacy and content controls.

---

## Design Principles

### Business Focused

Content should remain relevant to business, entrepreneurship, professional development, and growth.

### Relevant

Prioritize information that is useful to the current user.

### Discoverable

Make people, organizations, ideas, and opportunities easy to discover.

### Safe

Protect users from spam, abuse, fraudulent content, and unauthorized information.

### Scalable

The feed must support increasing users, organizations, posts, and interactions without compromising the user experience.
