# Organization Invitations Specification

## Purpose

The Organization Invitations module allows authorized organization members to invite individual ScaleUP users to join their organization.

Its purpose is to provide a controlled and secure process for adding members to an organization.

---

## Main Flow

```text
Authorized Member
    ↓
Enter User Email
    ↓
Select Role
    ↓
Send Invitation
    ↓
Recipient Receives Invitation
    ↓
Accept / Decline
    ↓
Membership Created
```

---

## Invitation Information

- Organization
- Inviter
- Recipient
- Proposed Role
- Invitation Status
- Created Date
- Expiration Date

---

## Rules

- Only authorized users may send invitations.
- Invitation recipients must have or create a ScaleUP Individual Account.
- An invitation must belong to one organization.
- A recipient must not be added to the organization before accepting the invitation.
- Invitations must expire after a defined period.
- Duplicate active invitations should be prevented.
- Revoked invitations must no longer be accepted.
- The inviter must have permission to assign the proposed role.

---

## Invitation States

```text
Pending
   ↓
Accepted
```

Alternative states:

- Declined
- Expired
- Revoked

---

## Permissions

| Action | Owner | Admin | Manager | Accountant | Member | Viewer |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| Send Invitation | ✅ | ✅ | Based on Permission | ❌ | ❌ | ❌ |
| Revoke Invitation | ✅ | ✅ | Based on Permission | ❌ | ❌ | ❌ |
| Accept Invitation | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Decline Invitation | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Notifications

The recipient should receive:

- New invitation
- Invitation reminder
- Invitation revoked
- Invitation accepted confirmation

---

## Edge Cases

- Recipient already belongs to the organization.
- Invitation has expired.
- Invitation is revoked before acceptance.
- Proposed role is no longer available.
- Organization becomes inactive before acceptance.
- Organization subscription becomes unavailable.
- Recipient account is suspended.

---

## Success Criteria

Authorized organization members should be able to securely invite users while recipients retain control over whether they join an organization.
