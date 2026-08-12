# Organization Profile Specification

## Purpose

The Organization Profile provides the public-facing identity of an organization within the ScaleUP Community.

Its purpose is to help users discover, understand, follow, and interact with organizations without exposing private business workspace information.

---

## Overview

Every active organization may have a public organization profile.

The Organization Profile is separate from the private Organization Workspace.

```text
Public Organization Profile
        ↓
Community / Discovery

Private Organization Workspace
        ↓
Authorized Members
```

---

## Actors

- Organization Owner
- Organization Administrator
- Authorized Organization Member
- Individual User
- Visitor
- System

---

## Scope

### In Scope

- Organization identity
- Public profile
- Logo and cover image
- Organization description
- Industry
- Location
- Website
- Public activity
- Public contact information
- Profile visibility

### Future Scope

- Verification
- Business registration details
- Reviews
- Ratings
- Certifications
- Public business metrics
- Organization achievements
- Careers section

---

## Main Flow

```text
Organization Activated
    ↓
Complete Organization Profile
    ↓
Set Public Information
    ↓
Publish Organization Profile
    ↓
Users Discover Organization
    ↓
Users Follow / Interact
```

---

## Public Information

Possible public information:

- Organization Name
- Logo
- Cover Image
- Industry
- Organization Type
- Description
- Location
- Website
- Public Contact Information
- Public Posts
- Public Opportunities
- Followers
- Public Achievements

---

## Private Information

The following must not automatically appear on the public profile:

- Financial records
- Internal reports
- Internal planning
- Employee information
- Private documents
- Internal business metrics
- Organization settings
- Subscription information

---

## Rules

- Only authorized organization members may manage the profile.
- Public information must be intentionally marked as visible.
- Private organization data must never be exposed through the profile.
- Organization profile visibility must respect organization settings.
- Suspended organizations may have restricted public visibility.
- Archived organizations should not appear as active businesses.

---

## Permissions

| Action | Owner | Admin | Manager | Member | Viewer |
| :--- | :---: | :---: | :---: | :---: | :---: |
| View Public Profile | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit Organization Profile | ✅ | ✅ | Based on Permission | ❌ | ❌ |
| Change Profile Visibility | ✅ | ✅ | ❌ | ❌ | ❌ |
| Upload Logo | ✅ | ✅ | Based on Permission | ❌ | ❌ |
| Publish Public Information | ✅ | ✅ | Based on Permission | ❌ | ❌ |

---

## Profile States

```text
Draft
   ↓
Published
   ↓
Hidden
   ↓
Archived
```

---

## Edge Cases

- Organization becomes inactive.
- Subscription expires.
- Organization is suspended.
- Organization changes its name.
- Organization removes its public profile.
- User loses organization permissions while editing profile.

---

## Success Criteria

An organization should be able to establish a professional public presence on ScaleUP while keeping its internal business information private and accessible only to authorized members.
