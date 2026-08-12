# Organization Discovery Specification

## Purpose

The Organization Discovery module allows users to discover businesses and organizations participating in ScaleUP.

Its purpose is to make organizations visible within the business ecosystem while separating public organization information from private organization workspace data.

---

## Overview

Organizations can maintain a public-facing profile that can be discovered by users.

The public organization profile is separate from its private Organization Workspace.

```text
Public Organization Profile
        ↓
Community Discovery

Private Organization Workspace
        ↓
Authorized Organization Members
```

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

- Organization directory
- Organization search
- Organization profile
- Organization categories
- Organization discovery
- Follow organization
- View public organization activity

### Future Scope

- Organization verification
- Ratings
- Reviews
- Business recommendations
- Organization comparisons
- Industry rankings

---

## Main Flow

```text
User Opens Organization Discovery
    ↓
Search / Browse Organizations
    ↓
View Organization Profile
    ↓
View Public Information
    ↓
Follow Organization / Explore Content
```

---

## Public Organization Profile

The public profile may include:

- Organization Name
- Logo
- Cover Image
- Industry
- Organization Type
- Description
- Location
- Website
- Public Contact Information
- Followers
- Public Posts
- Public Opportunities
- Public Achievements

Only intentionally public information may be displayed.

---

## Discovery Filters

Potential filters:

- Industry
- Location
- Organization Type
- Business Size
- Keywords
- Opportunities

---

## Rules

### Visibility Rules

- Only discoverable organizations should appear in public discovery.
- Private organization data must never be exposed.
- Organization workspace data must never appear in public search without explicit authorization.
- Organizations may control what public information is displayed.

### Following Rules

- Users may follow public organizations.
- Following an organization does not make the user a member.
- Following does not grant access to private organization information.

### Membership Rules

- Organization membership is separate from public discovery.
- A user must use the organization membership process to access private workspace features.

---

## Permissions

| Action | Visitor | Individual User | Org Member |
| :--- | :---: | :---: | :---: |
| View Public Organization | ✅ | ✅ | ✅ |
| Search Organizations | ✅ | ✅ | ✅ |
| Follow Organization | ❌ | ✅ | ✅ |
| View Public Organization Posts | ✅ | ✅ | ✅ |
| View Private Workspace | ❌ | ❌ | Based on Membership |

---

## Organization States

Potential public organization states:

- Active
- Inactive
- Suspended
- Archived

The platform may restrict discovery for organizations that are no longer eligible for public visibility.

---

## Organization Verification

### Status

Future capability.

Potential verification levels:

- Unverified
- Verified
- Official / Trusted

Verification must be governed by a separate verification policy.

---

## Notifications

Users may receive notifications for:

- New posts from followed organizations
- Organization announcements
- New public opportunities
- Major organization updates

---

## Privacy

The discovery layer must clearly separate:

### Public

- Organization Profile
- Public Posts
- Public Opportunities
- Public Information

### Private

- Financial Data
- Internal Reports
- Team Information
- Internal Planning
- Operational Data
- Private Organization Settings

---

## Edge Cases

- Organization becomes inactive.
- Organization subscription expires.
- Organization changes its visibility.
- User follows an organization that becomes private.
- Public organization profile is removed.
- Organization is suspended for policy violations.

---

## Success Criteria

Users should be able to easily discover relevant businesses and organizations, understand their public presence, follow their activities, and explore opportunities without gaining unauthorized access to private organization data.
