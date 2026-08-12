# User Profile Specification

## Overview

The User Profile represents the professional identity of an individual within ScaleUP.

Every registered user has a personal profile regardless of whether they create or join an organization.

The profile is primarily used for professional networking, community participation, discovery, and collaboration.

---

## Goals

- Provide users with a professional identity.
- Allow users to present relevant experience and interests.
- Support networking and discovery.
- Separate personal identity from organization identity.

---

# 1. Profile Information

## Required Information

- First Name
- Last Name

## Optional Information

- Profile Photo
- Headline
- Biography
- Location
- Industry
- Job Title
- Professional Interests
- Skills
- Website
- Social Links

---

# 2. Profile Visibility

Users may have configurable profile visibility.

Potential visibility levels:

- Public
- Community
- Limited
- Private

The final visibility rules should be defined by the platform privacy policy.

---

# 3. Public Profile

A public profile may display:

- Profile Photo
- Name
- Headline
- Biography
- Industry
- Skills
- Professional Interests
- Public Posts
- Public Activities
- Connections or connection count where appropriate

Sensitive account information must never be exposed publicly.

---

# 4. Profile Editing

Users may update their own profile information.

## Editable Information

- Name
- Profile Photo
- Headline
- Biography
- Location
- Industry
- Job Title
- Skills
- Interests
- Website
- Social Links

---

# 5. Professional Identity

The profile should support a user's professional presence within ScaleUP.

Examples:

```text
John Doe
Founder & Entrepreneur

Technology • SaaS • Business Strategy
```

---

# 6. Personal vs Organization Identity

A User Profile represents a person.

An Organization Profile represents a business or organization.

They must remain separate.

```text
User
└── John Doe

Organization
└── ABC Coffee
```

A user may be associated with an organization through membership, but the organization does not replace the user's personal identity.

---

# 7. Profile Relationships

A profile may be connected to:

- Posts
- Comments
- Reactions
- Connections
- Followers
- Following
- Messages
- Opportunities
- Organization Memberships

---

# 8. Profile Discovery

Users may be discovered through:

- Community search
- Connections
- Posts
- Opportunities
- Organization relationships

Discovery must respect profile visibility and privacy settings.

---

# 9. Profile Activity

Users may have a public activity history such as:

- Published posts
- Public comments
- Achievements
- Business-related updates
- Public opportunities

Private account activity must not be exposed.

---

# 10. Profile Privacy

Users should have control over what information is visible to others.

Privacy controls may eventually include:

- Profile visibility
- Activity visibility
- Connection visibility
- Contact information visibility
- Messaging permissions

---

# 11. Profile Principles

### Individual First

Every ScaleUP user has a personal identity independent of an organization.

### Professional

Profile information should support professional and business-oriented interactions.

### Privacy

Users control how much personal information is exposed.

### Extensible

The profile model should support future professional features without requiring a structural redesign.