# Spec — Onboarding & Organizations

> **Kind:** Greenfield
> **Portal:** Onboarding
> **Route:** `/onboarding` (`user_onboarding`), `/onboarding/create-business` (`onboarding_create_business`), `/onboarding/join-business` (`onboarding_join_business`)
> **Conventions:** [project-gate.md](../../../rules/core/project-gate.md) (backend Query/Handler/Action pattern, thin controllers, `response()->json(...)`, no DB foreign keys), [system-awareness.md](../../../rules/conditional/system-awareness.md), [system-awareness.md](../../../rules/conditional/system-awareness.md), [security-baseline.md](../../../rules/core/security-baseline.md). Frontend is **React 19 + Tailwind CSS v4** — the Vue-specific parts of project-profile.md do not apply to this spec; the ScaleUP frontend module convention (`resources/views/web/src/module/<domain>/<feature>/` with `index.jsx`, `api/<feature>.api.js`, `pages/`, `components/`) is used instead.
> **System Awareness:** Models — none reused (only stock `User.php` exists), `Organization`/`OrganizationUser`/`OrganizationInvitation` **created**. Tables — none reused, `organizations`/`organization_users`/`organization_invitations` **created**, `users` **extended** (new `onboarding_step`/`current_organization_id` columns). Routes — none reused, `routes/api/onboarding.php` and `routes/api/organizations.php` **created**, loaded from `routes/api.php`. New migrations: **yes** — no onboarding/organization schema exists anywhere in the codebase yet.

---

## 1. Purpose

Onboarding is the guided sequence a user goes through **immediately after registering and verifying their email** (see [authentication.md](../auth/authentication.md) for that precondition) and before they ever see the real product. It has two jobs that are easy to conflate but must be kept distinct:

1. **Collect the minimum business context ScaleUP needs to be useful** — what business is this, what industry, how big, who else works here — via the 7-step wizard defined in the branding doc (`Welcome → Create/Join Business → Business Information → Choose Industry → Business Size → Invite Team → Finish Setup`).
2. **Stand up the multi-tenant data model** that everything else in ScaleUP (Dashboard, Global Layout's Organization Switcher, and every future domain module — Finance, Analytics, Planning, Goals, Community, Growth, Reports) is built on top of: a business ("Organization") that one or more Users belong to, each with a role, and where **one User can belong to multiple Organizations** (ScaleUP's Business-OS-for-multiple-businesses vision — a person may run more than one company on the platform).

Without this spec, there is nowhere in the codebase for "which business is this data scoped to" to live — every future domain feature depends on the `organizations` / `organization_users` tables and the active-organization resolution mechanism defined here.

---

## 2. Design Decisions (Pros & Cons)

### Decision: Identity & multi-tenancy architecture

**Option A — Decoupled global User + `organizations`/`organization_users` pivot (Recommended)**
- `User` stays a single global identity (one row per human, one email, one password — owned by the auth spec). A separate `organizations` table holds each business. A join table `organization_users` (`id_user`, `id_organization`, `role`, `status`) links them, many-to-many, with a `role` per membership.

| Pros | Cons |
|---|---|
| Matches the branding doc's "Join Existing Business" step — a person can accept an invite into a second company without creating a second account. | One more table + one more join to reason about on every organization-scoped query. |
| Matches the Business-OS-for-multiple-businesses vision (a founder running two ventures uses one login, switches via the Organization Switcher in Global Layout). | Every domain table going forward must carry an `id_organization` scoping column — a discipline the whole team must follow. |
| Role can differ per organization (owner in Business A, viewer in Business B) — realistic for consultants/accountants/agencies. | |

**Option B — Coupled single-tenant model**
- `organization_id` lives directly on `users`; one user = one business, permanently.

| Pros | Cons |
|---|---|
| Simpler queries — no pivot, no "which org am I acting as" resolution step. | Directly contradicts the branding doc's Step 2 "Join Existing Business" (would require a second account per business) and the Business-OS vision. |
| Fewer tables to build now. | Painful, breaking migration later the first time a real user needs to belong to two businesses (near-certain for this product category). |

**Recommendation:** **Option A.** The branding doc explicitly designs for both creating and joining a business, and ScaleUP's stated ambition is a platform businesses (plural) run on — locking a user to one organization now would have to be undone almost immediately.

---

### Decision: Onboarding state machine

**Option A — Resumable step-tracking via `users.onboarding_step` (Recommended)**
- A single integer/enum column tracks the furthest step the user has reached. Each step's `Store*Handler` advances it. If the user closes the tab mid-wizard and comes back, they resume exactly where they left off (and any route guard elsewhere in the app redirects incomplete users back to `/onboarding`).

| Pros | Cons |
|---|---|
| Survives page refresh, browser crash, or a multi-day gap between steps — no lost progress. | Requires a route guard (in Global Layout / App shell) checking `onboarding_step` on every authenticated route load. |
| Cheap to implement — one column, one "advance step" call per step submit. | Step order is implicitly coupled to the column's numeric values; renumbering steps later means a small migration/data fix. |
| Lets analytics answer "where do users drop off in onboarding" directly from the column. | |

**Option B — Single monolithic form**
- All 7 steps are client-side wizard state only; nothing is persisted until the very last "Finish Setup" submit, which creates the organization, membership, and invites in one request.

| Pros | Cons |
|---|---|
| One backend endpoint, simplest possible backend. | A closed tab/crash before the final submit loses everything — the user starts over from Step 1. |
| No `onboarding_step` column or resume logic needed. | Can't send team invites (Step 6) until the very end, so invited teammates wait longer; can't show partial progress in the org's admin view. |

**Recommendation:** **Option A.** Onboarding is a multi-minute, multi-decision flow (choosing industry, inviting teammates by email) — exactly the kind of form users abandon and return to. Persisting progress per step is standard SaaS onboarding practice (Slack, Notion, Linear all do this) and costs one column.

---

### Decision: Join-Business mechanism

**Option A — Invitation-token link (Recommended)**
- An owner/admin invites a specific email via Step 6 (or from inside the app later). The system creates an `organization_invitations` row with a signed, expiring token and emails a link like `/onboarding/join-business?token=...`. Visiting the link (while logged in, or after registering with the matching email) accepts the invite.

| Pros | Cons |
|---|---|
| Precise: only the intended person can join, at the role the inviter chose. | Requires the inviter to know the invitee's email up front; can't be used for "anyone with the code" self-serve joining. |
| No risk of a stranger guessing their way into a business. | Needs an email-sending path (queued notification) as a dependency. |
| Naturally supports "invitation collision with existing account" handling (see §6). | |

**Option B — Searchable join-code**
- Every organization gets a short human-shareable code (e.g. `SCALEUP-7X2K`). Step 2's "Join Existing Business" lets a new user type the code (or search by business name) and self-join, pending owner approval.

| Pros | Cons |
|---|---|
| No email dependency; works well for "I already know the code from a coworker in Slack." | A leaked/guessed code lets an unintended person request access to the business — needs an approval step to be safe, adding a second async round-trip. |
| Feels lightweight for small teams onboarding informally. | Searching by business name risks exposing a directory of every business on the platform (privacy/security concern) unless carefully scoped. |

**Recommendation:** **Option A** for the primary flow (matches "Invite Team" in Step 6 and is the safer default), but keep the `organizations` schema ready for an optional join-code as a **fast-follow**, not a blocker — see Out of Scope. Step 2's "Join Existing Business" path in this spec is invitation-token driven: a user without a pending invite sees an explanatory empty state ("Ask your admin to invite you") rather than a name/code search.

---

### Decision: Role-based access control shape for organization membership

**Option A — General Business-OS role set: `owner` / `administrator` / `manager` / `employee` / `accountant` / `viewer` (Recommended)**
- `organization_users.role` is a string enum, checked in Handlers via a small `OrganizationRole` policy helper (not Laravel Policies/Gates for v1, to match the project's thin-controller/Handler style — but nothing here blocks adding Gates later).

| Pros | Cons |
|---|---|
| `owner`/`administrator`/`manager`/`employee` maps to how a real company is structured (not HR-specific like "supervisor"/"rank-and-file"), fitting ScaleUP's general Business-OS positioning. | Six roles is more than a minimal MVP might need; some may go unused for months. |
| `accountant` and `viewer` anticipate the Finance and Reports modules (external bookkeeper access, read-only stakeholder access) without over-building now. | Role permissions-per-module still need to be defined feature-by-feature as those modules ship — this spec only defines the roster and coarse rules (who can invite, who can remove members, who can delete the org), not per-feature ACLs. |

**Option B — Minimal two-role set: `owner` / `member`**
- Every non-owner is just a "member" with full access to whatever the org can see.

| Pros | Cons |
|---|---|
| Trivial to implement and reason about. | Can't express "give my accountant view-only access" or "manager can invite but not delete the business" — real asks for a Business OS from day one. |
| No role-taxonomy bikeshedding. | Would need a breaking migration the first time any customer asks for finer-grained access, which is highly likely. |

**Recommendation:** **Option A.** The roster is cheap to define now (it's one enum) and expensive to retrofit later once permission checks are scattered across modules. Only `owner` and `administrator` carry hard-coded platform rules in this spec (see §6); the rest are placeholders future modules will attach permissions to.

---

### Decision: Active-organization context resolution

**Option A — Header-based `X-Organization-Id`, resolved server-side against membership (Recommended)**
- The frontend keeps the "current organization" in memory/localStorage (set by the Organization Switcher in Global Layout) and sends it as an `X-Organization-Id` header (or `organization_id` query param as fallback) on every API call after axios-instance interceptor injection. Every Query/Handler resolves and validates `auth()->user()` is actually a member of that `id_organization` before scoping data to it.

| Pros | Cons |
|---|---|
| Works identically in local dev, staging, and production — no DNS/subdomain provisioning needed. | Every backend Query/Handler must remember to validate membership for the header's org id — a discipline point, not a structural guarantee (mitigated by a shared `ResolveActiveOrganization` helper, see §4). |
| Matches ScaleUP's single-app-shell design (Global Layout's Organization Switcher swaps context without a page reload/redirect). | Slightly less "shareable URL" friendly than a subdomain (a bookmarked URL doesn't self-identify its organization). |
| No wildcard SSL / DNS wildcard subdomain infrastructure required — cheaper to run, especially pre-launch. | |

**Option B — Subdomain-based (`acme.scaleup.app`)**
- Each organization gets a subdomain; the backend resolves the active org from the request's `Host` header.

| Pros | Cons |
|---|---|
| Every URL is self-describing and shareable — no ambiguity about which business a link belongs to. | Requires wildcard DNS + wildcard TLS certs, local-dev `/etc/hosts` hacks, and CORS/cookie-domain complexity — heavy infra lift for a not-yet-launched product. |
| Strong tenant isolation "for free" at the routing layer. | Doesn't fit an "Organization Switcher dropdown that changes context instantly" UX as described in Global Layout — subdomain switching means a full navigation/redirect. |

**Recommendation:** **Option A.** It matches the Global Layout spec's in-app Organization Switcher (an instant context swap, not a redirect) and avoids provisioning wildcard infrastructure before the product has customers. Revisit subdomains only if/when white-label or enterprise-tenant-isolation requirements emerge.

---

## 3. Database

All new tables. Per [project-gate.md](../../../rules/core/project-gate.md): **no `->foreign()->references()` constraints** — relationship columns are `id`-prefixed, `unsignedBigInteger`, plain `->index()`; soft-delete via a `status` column, not `SoftDeletes`; always `timestamps()`.

### 3.1 `users` (extend — new columns only, existing columns untouched)

| Column | Type | Notes |
|---|---|---|
| `onboarding_step` | `unsignedTinyInteger`, default `0` | `0`=not started … `7`=finished. Advanced by each step's Handler. `0` also doubles as "needs onboarding" for route guards. |
| `id_current_organization` | `unsignedBigInteger`, nullable, `->index()` | The organization the Organization Switcher last set as active; seeds the session default on login. Not a foreign key (per convention) — validated against `organization_users` in the Handler layer. |

### 3.2 `organizations` (new)

| Column | Type | Notes |
|---|---|---|
| `id` | `id()` | |
| `name` | `string` | Business Information step (Step 3). Required. |
| `slug` | `string`, unique, `->index()` | URL/display-safe identifier, generated from `name`; used for invite-link display and (future) any org-scoped shareable URL. |
| `industry` | `string`, nullable | Step 4 — value from the fixed industry taxonomy (see §6). |
| `size` | `string`, nullable | Step 5 — value from the fixed size-bracket taxonomy (see §6), e.g. `solo`, `2-10`, `11-50`, `51-200`, `201+`. |
| `logo_path` | `string`, nullable | Optional, settable later from Settings — not required in the 7-step wizard. |
| `id_created_by` | `unsignedBigInteger`, `->index()` | The user who created the business (becomes `owner`). Not a foreign key — resolved against `users` in the Handler layer. |
| `onboarding_completed_at` | `timestamp`, nullable | Set when Step 7 "Finish Setup" is submitted for this org. |
| `status` | `tinyInteger`, default `1` | `1`=Active, `0`=Disabled — soft-disable convention, no hard delete/`SoftDeletes`. |
| `timestamps()` | | |

### 3.3 `organization_users` (new — the pivot)

| Column | Type | Notes |
|---|---|---|
| `id` | `id()` | |
| `id_organization` | `unsignedBigInteger`, `->index()` | Not a foreign key (convention) — validated in Handlers. |
| `id_user` | `unsignedBigInteger`, `->index()` | Not a foreign key. |
| `role` | `string` | One of `owner`, `administrator`, `manager`, `employee`, `accountant`, `viewer` (see Decision above). |
| `status` | `tinyInteger`, default `1` | `1`=Active member, `0`=Removed (soft-removal; keeps history instead of a hard delete). |
| `joined_at` | `timestamp`, nullable | Set when the invite is accepted / the org is created. |
| `timestamps()` | | |

Composite unique index on (`id_organization`, `id_user`) to prevent duplicate memberships.

### 3.4 `organization_invitations` (new)

| Column | Type | Notes |
|---|---|---|
| `id` | `id()` | |
| `id_organization` | `unsignedBigInteger`, `->index()` | Not a foreign key. |
| `id_invited_by` | `unsignedBigInteger`, `->index()` | The inviting user. Not a foreign key. |
| `email` | `string`, `->index()` | Invitee's email — may or may not already have a ScaleUP account. |
| `role` | `string` | Proposed role, same enum as `organization_users.role`. |
| `token` | `string`, unique, `->index()` | Signed random token, used in the `/onboarding/join-business?token=...` link. |
| `status` | `string`, default `pending` | `pending` / `accepted` / `revoked` / `expired`. |
| `expires_at` | `timestamp` | Default: 7 days from creation. |
| `accepted_at` | `timestamp`, nullable | |
| `timestamps()` | | |

---

## 4. Backend

Namespaces per [project-gate.md](../../../rules/core/project-gate.md): top-level `App\Queries\<Domain>`, `App\Handlers\<Domain>`, `App\Actions\<Domain>` — domain folders `Onboarding` and `Organization`. Thin controllers under `App\Http\Controllers\onboarding` and `App\Http\Controllers\organization`. No API Resources — raw `response()->json(...)`.

### 4.1 Models (new)

- `App\Models\Organization` — `$table = 'organizations'`, `$fillable = ['name','slug','industry','size','logo_path','id_created_by','onboarding_completed_at','status']`.
- `App\Models\OrganizationUser` — `$table = 'organization_users'`, `$fillable = ['id_organization','id_user','role','status','joined_at']`.
- `App\Models\OrganizationInvitation` — `$table = 'organization_invitations'`, `$fillable = ['id_organization','id_invited_by','email','role','token','status','expires_at','accepted_at']`.
- Extend `App\Models\User`: add `onboarding_step`, `id_current_organization` to `$fillable`; add non-FK helper relations (`organizations()` via a manual `belongsToMany('Organization', 'organization_users', 'id_user', 'id_organization')` if the team is comfortable defining Eloquent relations over non-FK columns — otherwise resolve membership purely through Query classes, matching the "no DB foreign keys, enforce in Query/Handler layer" convention).

### 4.2 Query classes (reads)

- `App\Queries\Onboarding\GetOnboardingStateQuery` — returns the current user's `onboarding_step` + any pending invitation matched to their email (for Step 2's "Join Existing Business" empty/populated state).
- `App\Queries\Organization\GetUserOrganizationsQuery` — all organizations a user is an active member of, with their `role` — powers the Organization Switcher dropdown.
- `App\Queries\Organization\GetOrganizationMembersQuery` — members + pending invitations for the Invite Team step and any later team-management screen.
- `App\Queries\Organization\ResolveActiveOrganizationQuery` — given `auth()->user()` and the `X-Organization-Id` header/param, validates membership and returns the resolved `Organization` (or throws); this is the shared helper every future domain Query/Handler calls first, per the Active-organization-context Design Decision.

### 4.3 Handlers (writes) + Actions

- `App\Handlers\Onboarding\AdvanceOnboardingStepHandler` — bumps `users.onboarding_step`; called at the end of each step's submit.
- `App\Handlers\Organization\CreateOrganizationHandler` (Step 2/3/4/5 "Create Business" path) — wraps in `DB::transaction`: creates the `organizations` row, an `organization_users` row for the creator with `role = owner`, sets `users.id_current_organization`, advances onboarding step. Delegates slug generation to `App\Actions\Organization\GenerateOrganizationSlugAction` (reusable — any future "rename business" flow needs the same uniqueness-checked slugging logic, per [system-awareness.md](../../../rules/conditional/system-awareness.md)).
- `App\Handlers\Organization\InviteMemberHandler` (Step 6, and later reused from an in-app "Invite Team" settings screen) — validates the inviter's role permits inviting (`owner`/`administrator` only), creates an `organization_invitations` row, delegates sending to `App\Actions\Organization\SendInvitationEmailAction` (queued notification).
- `App\Handlers\Organization\AcceptInvitationHandler` — validates token (not expired/not already accepted), creates/reactivates the `organization_users` row, marks the invitation `accepted`, sets `id_current_organization` if the user has none yet.
- `App\Handlers\Organization\RemoveMemberHandler` — soft-removes (`status = 0`) an `organization_users` row; enforced sole-owner protection (see §6).
- `App\Handlers\Organization\SwitchActiveOrganizationHandler` — validates membership, updates `users.id_current_organization` (used when the Organization Switcher's selection should persist across sessions, not just per-request headers).
- `App\Handlers\Onboarding\FinishOnboardingHandler` (Step 7) — marks `organizations.onboarding_completed_at`, sets `users.onboarding_step = 7`; this is the handler the frontend calls right before redirecting into the Dashboard.

### 4.4 Controllers

- `App\Http\Controllers\onboarding\OnboardingController` — `getState`, `advanceStep`, `finish`.
- `App\Http\Controllers\organization\OrganizationController` — `store` (create business), `index` (list mine — Switcher), `update` (Business Information/Industry/Size edits during the wizard), `switch` (set active org).
- `App\Http\Controllers\organization\OrganizationInvitationController` — `store` (invite), `index` (list pending for an org), `accept` (join via token), `destroy` (revoke).
- `App\Http\Controllers\organization\OrganizationMemberController` — `index` (list members), `destroy` (remove member).

Each method follows the standard shape:
```php
public function store(Request $request)
{
    try {
        $organization = CreateOrganizationHandler::execute($request->all());
        return response()->json(['data' => $organization]);
    } catch (Exception $e) {
        return response()->json(['message' => $e->getMessage()], 400);
    }
}
```

### 4.5 Routes

New files, loaded from the `routes/api.php` orchestrator inside the `auth:sanctum` group (onboarding and organization membership both require a logged-in, verified user — see precondition in §0/Out of Scope):

```php
// routes/api.php (add inside the existing auth:sanctum group)
Route::prefix('onboarding')->group(base_path('routes/api/onboarding.php'));
Route::prefix('organizations')->group(base_path('routes/api/organizations.php'));
```

```php
// routes/api/onboarding.php
use App\Http\Controllers\onboarding\OnboardingController;

Route::get('/state', [OnboardingController::class, 'getState']);
Route::post('/advance-step', [OnboardingController::class, 'advanceStep']);
Route::post('/finish', [OnboardingController::class, 'finish']);
```

```php
// routes/api/organizations.php
use App\Http\Controllers\organization\OrganizationController;
use App\Http\Controllers\organization\OrganizationInvitationController;
use App\Http\Controllers\organization\OrganizationMemberController;

Route::get('/', [OrganizationController::class, 'index']);
Route::post('/', [OrganizationController::class, 'store']);
Route::patch('/{organization}', [OrganizationController::class, 'update']);
Route::post('/{organization}/switch', [OrganizationController::class, 'switch']);

Route::get('/{organization}/members', [OrganizationMemberController::class, 'index']);
Route::delete('/{organization}/members/{member}', [OrganizationMemberController::class, 'destroy']);

Route::get('/{organization}/invitations', [OrganizationInvitationController::class, 'index']);
Route::post('/{organization}/invitations', [OrganizationInvitationController::class, 'store']);
Route::delete('/{organization}/invitations/{invitation}', [OrganizationInvitationController::class, 'destroy']);

// Accepting an invite is not necessarily scoped to a known organization ID client-side
// (the token itself carries that), so it is registered unscoped:
Route::post('/invitations/accept', [OrganizationInvitationController::class, 'accept']);
```

> Web-visible entry points (`/onboarding`, `/onboarding/create-business`, `/onboarding/join-business`) are React Router client routes rendered by the SPA shell (`resources/views/app.blade.php` catch-all), not Laravel `web.php` routes — matching the pattern already in `routes/web.php` (`/` and `/app` both render the same `app` view). No `web.php` change is required by this spec; note it for whoever wires the SPA router (Global Layout scope).

---

## 5. Frontend

New module: `resources/views/web/src/module/onboarding/` (wizard) — folder already scaffolded (empty `types/`, `composables/`, `components/`, `api/`, `pages/`). Extends existing scaffold: `resources/views/web/src/module/organization/` (switcher + invite, reusable outside onboarding too — e.g. from Settings).

> Note: the scaffolded folders include a `composables/` directory, a naming carried over from the Vue convention. Since ScaleUP's frontend is React 19, treat that folder as **`hooks/`** in spirit (e.g. `useOnboarding.js`) — either rename it or simply add React hook files inside it; this spec does not mandate renaming the pre-existing empty folder, only that new files follow React hook conventions, not Vue composables.

### 5.1 `module/onboarding/`

```
onboarding/
├── index.jsx                          # barrel export (OnboardingFlow + hook + api)
├── api/onboarding.api.js              # useOnboardingApi() — http from '@/app/axios/axiosInstance'
├── hooks/useOnboarding.js             # step state, current step data, advance/back
├── pages/
│   └── OnboardingFlow.jsx             # wizard container/shell — progress indicator + step router
└── components/
    ├── steps/
    │   ├── WelcomeStep.jsx            # Step 1
    │   ├── CreateOrJoinStep.jsx       # Step 2 — two large choice cards: Create Business / Join Existing Business
    │   ├── BusinessInformationStep.jsx # Step 3 — name, (optional logo)
    │   ├── ChooseIndustryStep.jsx     # Step 4 — grid of industry cards (see taxonomy §6)
    │   ├── BusinessSizeStep.jsx       # Step 5 — size-bracket radio/cards
    │   ├── InviteTeamStep.jsx         # Step 6 — repeatable email+role rows, "Skip for now"
    │   └── FinishSetupStep.jsx        # Step 7 — summary + "Go to Dashboard" CTA
    └── JoinBusinessPanel.jsx          # rendered when Step 2 picks "Join Existing Business" —
                                        # shows the invitation matched to the user's email (accept/decline),
                                        # or an empty state if none is pending
```

- `OnboardingFlow.jsx` reads `onboarding_step` from `GET /api/onboarding/state` on mount and resumes at that step (Design Decision §2). It renders a stepper (reusing the Design System's Stepper primitive — see Out of Scope) and swaps the current step component.
- Each step component calls its own narrow API action on submit (e.g. `BusinessInformationStep` calls `organizationApi.update(...)`), then calls the shared `advanceStep()` from the hook, which both calls `POST /api/onboarding/advance-step` and moves the wizard forward locally.
- Layout follows the branding doc's split-panel language established for Authentication (left = form, right = business illustration/floating KPI cards) — reuse rather than re-derive that layout shell if Authentication has already built it.
- All inputs, buttons, and cards are the shared Design System primitives (`Button`, `Input`, `Select`/`Card`, `Stepper`) — this spec does not define new base components, only how existing ones are composed for onboarding.

### 5.2 `module/organization/`

```
organization/
├── index.jsx
├── api/organization.api.js            # list/create/update/switch orgs, invitations, members
├── hooks/useOrganizations.js          # active org, org list, switch()
├── pages/
│   └── JoinBusinessPage.jsx           # handles /onboarding/join-business?token=... deep link
└── components/
    ├── OrganizationSwitcherDropdown.jsx  # consumed by Global Layout's top nav (see Out of Scope)
    └── InviteMemberModal.jsx             # email + role picker; used by InviteTeamStep AND
                                            # any later in-app "Invite teammate" action (Settings, Dashboard)
```

- `OrganizationSwitcherDropdown.jsx` calls `GET /api/organizations` on mount, shows the active org (bold) + others, and on selection calls `POST /api/organizations/{id}/switch` then updates the `X-Organization-Id` header default used by the shared axios instance for all subsequent requests (Design Decision §2 — header-based context resolution).
- `InviteMemberModal.jsx` is intentionally built once here and reused by both the onboarding wizard's Step 6 and any later "Team" settings page — per [system-awareness.md](../../../rules/conditional/system-awareness.md), do not re-implement invite UI a second time in Settings.

### 5.3 API contract summary

| Method | Endpoint | Used by |
|---|---|---|
| `GET` | `/api/onboarding/state` | `OnboardingFlow.jsx` on mount |
| `POST` | `/api/onboarding/advance-step` | every step's submit |
| `POST` | `/api/onboarding/finish` | `FinishSetupStep.jsx` |
| `GET` | `/api/organizations` | Switcher, `OnboardingFlow` resume |
| `POST` | `/api/organizations` | `CreateOrJoinStep.jsx` (create path) |
| `PATCH` | `/api/organizations/{id}` | `BusinessInformationStep`, `ChooseIndustryStep`, `BusinessSizeStep` |
| `POST` | `/api/organizations/{id}/switch` | `OrganizationSwitcherDropdown.jsx` |
| `GET` | `/api/organizations/{id}/members` | Invite step summary, future Settings |
| `POST` | `/api/organizations/{id}/invitations` | `InviteTeamStep.jsx`, `InviteMemberModal.jsx` |
| `POST` | `/api/organizations/invitations/accept` | `JoinBusinessPage.jsx` (token deep link), `JoinBusinessPanel.jsx` |
| `DELETE` | `/api/organizations/{id}/invitations/{id}` | revoke, from Invite step or Settings |
| `DELETE` | `/api/organizations/{id}/members/{id}` | Settings-only (not part of the 7-step wizard) |

---

## 6. Business Rules & Edge Cases

- **Sole-owner protection**: `RemoveMemberHandler` and any future "leave organization" action must reject the operation if the target is the organization's only `role = owner, status = 1` member — an org can never be left ownerless. Promote another member to `owner` first.
- **Invitation collision with an existing account**: if `organization_invitations.email` matches an already-registered `users.email`, `AcceptInvitationHandler` attaches the membership directly to that existing user (no duplicate account created); the invite link, when opened while logged out, should route to Login (pre-filled email) rather than Register. If the email has no account yet, opening the link routes to Register first, then resumes the accept flow post-verification.
- **Duplicate invitation**: inviting an email that already has a `pending` invitation to the same organization should update/resend the existing row (reset `expires_at`, keep the same token) rather than create a second row — avoids multiple valid tokens for the same intended member.
- **Incomplete-onboarding route guarding**: any authenticated route outside `/onboarding/*` must check `users.onboarding_step < 7` (or `organizations.onboarding_completed_at IS NULL` for the active org) and redirect to `/onboarding`, resuming at the stored step. This guard lives in the app shell / Global Layout's router, not duplicated per-module.
- **Skipping "Invite Team" (Step 6)**: must be allowed with a "Skip for now" action — inviting teammates is not mandatory to finish onboarding. `AdvanceOnboardingStepHandler` still advances the step even with zero invitations sent.
- **Multiple pending invitations at Step 2 "Join"**: if a user's email has more than one pending invitation (invited to several businesses), `JoinBusinessPanel` lists all of them, each independently acceptable/declinable — accepting one does not consume or affect the others.
- **Expired invitation token**: `AcceptInvitationHandler` checks `expires_at` and `status`; an expired/revoked token returns a clear error the frontend renders as "This invite has expired — ask your admin to resend it," never a generic 400.
- **Industry taxonomy**: a fixed, backend-owned list (e.g. Retail, Food & Beverage, Professional Services, Technology & Software, Manufacturing, Construction, Healthcare, Education, Real Estate, Finance & Insurance, Logistics & Transportation, Hospitality & Tourism, Agriculture, Other) seeded as static frontend options in Step 4 for v1 (no admin-managed taxonomy table yet — adding one is a fast-follow if industries need to be curated dynamically).
- **Business-size taxonomy**: fixed brackets — `Just me (solo)`, `2–10 employees`, `11–50 employees`, `51–200 employees`, `201+ employees` — stored as the literal string in `organizations.size`; not a normalized lookup table (too small/stable a set to warrant one, consistent with keeping onboarding lightweight).
- **Re-running "Create Business" after already owning one**: a user who already owns/belongs to at least one organization but revisits `/onboarding` (e.g. to create a *second* business deliberately) is a distinct, later flow — not the initial 7-step wizard, which only ever runs once per user (guarded by `onboarding_step`). Creating additional businesses post-onboarding is out of scope here (see §8) and belongs to a "Create another business" action inside the Organization Switcher.
- **Authorization on every organization-scoped write**: every Handler in §4.3 must call `ResolveActiveOrganizationQuery` (or receive an already-resolved, membership-checked organization) before writing — a user must never be able to modify an organization they aren't an active member of, per [security-baseline.md](../../../rules/core/security-baseline.md)'s "users can only modify their own resources."

| Edge Case | Handling |
|---|---|
| User abandons wizard at Step 3, returns next week | `GET /api/onboarding/state` resumes at stored step; organization row already exists in a partial state (no industry/size yet) and is simply updated by later steps. |
| Two browser tabs both submit "Create Business" | Second submit is naturally a no-op/second-org-creation, not a race on the same row — each `store` call always creates a new organization row keyed by request, so this is not a lost-update problem; the frontend should still disable the submit button after first click to avoid an accidental duplicate business. |
| Invite sent to the inviter's own email | Reject at validation — an owner/admin is already a member; return a clear "You're already a member" message. |
| Non-owner/non-admin tries to invite or remove a member | `InviteMemberHandler`/`RemoveMemberHandler` reject with 403-equivalent JSON error (`response()->json(['message' => ...], 403)`), enforced server-side regardless of what the frontend hides. |
| Active organization header points to an org the user isn't a member of | `ResolveActiveOrganizationQuery` throws; controller catches and returns 403 — never silently fall back to another org. |

---

## 7. Build Order

1. **Migrations** — `users` alter (`onboarding_step`, `id_current_organization`); create `organizations`, `organization_users`, `organization_invitations`.
2. **Models** — `Organization`, `OrganizationUser`, `OrganizationInvitation`; extend `User` `$fillable`.
3. **Query classes** — `GetOnboardingStateQuery`, `GetUserOrganizationsQuery`, `GetOrganizationMembersQuery`, `ResolveActiveOrganizationQuery` (build this one early — every later Handler depends on it).
4. **Handlers/Actions** — `CreateOrganizationHandler` (+ `GenerateOrganizationSlugAction`), `AdvanceOnboardingStepHandler`, `InviteMemberHandler` (+ `SendInvitationEmailAction`), `AcceptInvitationHandler`, `RemoveMemberHandler`, `SwitchActiveOrganizationHandler`, `FinishOnboardingHandler`.
5. **Controllers + routes** — `OnboardingController`, `OrganizationController`, `OrganizationInvitationController`, `OrganizationMemberController`; register `routes/api/onboarding.php` and `routes/api/organizations.php`, load both from `routes/api.php`.
6. **Frontend Gate 1 (static design, hard-coded data)** — build `OnboardingFlow.jsx` + all 7 step components + `JoinBusinessPanel.jsx` + `OrganizationSwitcherDropdown.jsx` + `InviteMemberModal.jsx` against mock/local state, matching the branding doc's visual language and reusing Design System primitives.
7. **Frontend Gate 2 (live wiring)** — wire `api/onboarding.api.js` and `api/organization.api.js` to the real endpoints from steps 3–5; replace mock state in the hooks with real fetched/submitted data; wire the `X-Organization-Id` header default into the shared axios instance.
8. **Route guard** — incomplete-onboarding redirect, added to the app shell/router (coordinate with Global Layout).
9. **End-to-end pass** — register → verify → full 7-step wizard → land on Dashboard; separately, accept-an-invitation deep link → join-business → land on Dashboard.

---

## 8. Out of Scope (Future Specs)

- **Login / Register / Forgot Password / Verify Email** — this spec's precondition, not its content. See [authentication.md](../auth/authentication.md) (branding doc §4). Onboarding assumes the user already has a verified, authenticated session.
- **Design System primitives** (Button, Input, Card, Stepper, Modal, Dropdown) — this spec composes them, it does not define them. See [design_system.md](../design/design_system.md) (branding doc §3).
- **Dashboard Concept** — the destination after Step 7's "Finish Setup" / after joining a business. See [dashboard_concept.md](../dashboard/dashboard_concept.md) (branding doc §6).
- **Global Layout** — the Organization Switcher dropdown built here (`OrganizationSwitcherDropdown.jsx`) is *consumed* by the top navigation defined in [global_layout.md](../global/global_layout.md) (branding doc §7); the shell, top nav placement, and incomplete-onboarding route guard's exact wiring point live there.
- **OAuth social logins, SSO, hardware MFA** — noted in the branding doc's broader auth ambitions but explicitly future extensions, not part of this spec or the authentication spec's v1.
- **Admin-managed industry taxonomy / dynamic size brackets** — v1 ships a fixed frontend list (see §6); a settings-managed taxonomy table is a fast-follow if the list needs to change without a deploy.
- **Join-by-code self-serve joining** — the invitation-token mechanism is the only join path in this spec (Design Decision §2); an org-level shareable join-code with approval is a possible fast-follow, not built here.
- **"Create a second/third business" post-onboarding flow** — the initial wizard only runs once (§6); an explicit "Add another business" action from the Organization Switcher is a separate, smaller future spec.
- **Per-module, per-role permission matrices** (what exactly a `manager` vs `accountant` can see in Finance/Reports/etc.) — this spec only defines the role roster and the two hard-coded platform rules (invite/remove requires owner/administrator; sole-owner protection). Fine-grained ACLs are defined module-by-module as those modules ship.
