# Opportunities Specification

## Purpose

The Opportunities module connects individuals and organizations with business-related opportunities across the ScaleUP ecosystem.

Its purpose is to help users discover meaningful opportunities for collaboration, partnerships, investment, mentorship, hiring, projects, and other forms of business growth.

---

## Overview

An Opportunity is a structured business-related listing published by an authorized user or organization.

Opportunities are discoverable through the Community and may be promoted through the Community Feed and Search.

---

## Actors

- Individual User
- Organization Member
- Organization
- Opportunity Owner
- Interested User
- System

---

## Scope

### In Scope

- Create opportunity
- Publish opportunity
- Browse opportunities
- Search opportunities
- Filter opportunities
- View opportunity details
- Express interest
- Contact opportunity owner
- Manage opportunity status

### Future Scope

- Investor matching
- Application workflows
- Opportunity scoring
- Verification
- Business proposal documents
- Deal management
- Due diligence

---

## Opportunity Types

Initial types may include:

- Partnership
- Investment
- Collaboration
- Mentorship
- Hiring
- Project
- Business Service
- Event

---

## Main Flow

```text
Create Opportunity
    ↓
Enter Details
    ↓
Select Type
    ↓
Publish
    ↓
Discoverable in Community
    ↓
User Views Opportunity
    ↓
Express Interest
    ↓
Owner Reviews Interest
    ↓
Continue Discussion
```

---

## Opportunity Information

Potential information includes:

- Title
- Description
- Opportunity Type
- Industry
- Location
- Organization
- Requirements
- Deadline
- Contact Method
- Status
- Attachments

Sensitive information should only be collected when justified by the opportunity workflow.

---

## Rules

### General Rules

- An opportunity must have an authorized owner.
- Opportunity information must be truthful and compliant with platform policies.
- Owners may edit or close their opportunities.
- Users may only express interest in active opportunities.
- Closed opportunities must no longer accept new interest.
- Fraudulent or misleading opportunities may be removed.

### Investment Rules

Investment functionality must be treated as a future domain requiring additional legal, financial, compliance, and verification requirements.

Publishing an investment-related opportunity does not automatically mean ScaleUP is acting as an investment intermediary.

---

## Opportunity States

```text
Draft
  ↓
Published
  ↓
Active
  ↓
Closed
```

Possible additional states:

- Paused
- Under Review
- Removed
- Expired

---

## Opportunity Interest

Users or organizations may express interest in an opportunity.

Potential states:

```text
Interested
    ↓
Under Review
    ↓
In Discussion
    ↓
Accepted / Declined
```

---

## Permissions

| Action | Visitor | Individual | Authorized Org Member | Org Admin | Org Owner |
| :--- | :---: | :---: | :---: | :---: | :---: |
| View Public Opportunity | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create Personal Opportunity | ❌ | ✅ | ✅ | ✅ | ✅ |
| Create Organization Opportunity | ❌ | ❌ | Based on Permission | ✅ | ✅ |
| Edit Own Opportunity | ❌ | ✅ | ✅ | ✅ | ✅ |
| Close Own Opportunity | ❌ | ✅ | ✅ | ✅ | ✅ |
| Express Interest | ❌ | ✅ | ✅ | ✅ | ✅ |

---

## Privacy

Opportunity details must follow visibility settings.

Private or restricted opportunities must not be exposed through:

- Public search
- Public profiles
- Public feeds
- Unauthorized notifications

---

## Moderation

Opportunities may be reported for:

- Fraud
- Spam
- Misleading Information
- Unauthorized Promotion
- Inappropriate Content
- Other

---

## Notifications

Possible notifications include:

- New opportunity
- New interest
- Interest status change
- Opportunity closing
- Owner response

---

## Edge Cases

- Opportunity closes while interest is being submitted.
- Owner deletes the opportunity.
- Owner loses organization permissions.
- Organization subscription becomes inactive.
- Opportunity is reported.
- Opportunity deadline expires.
- User attempts to interact with an inaccessible opportunity.

---

## Success Criteria

Users and organizations should be able to publish, discover, and pursue legitimate business opportunities in a structured and secure environment.
