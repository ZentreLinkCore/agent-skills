# Spec — Community Shell (Individual-First App Shell)

> **Kind:** Extension — reworks the existing authenticated shell, routing, and onboarding so an Individual is a first-class user rather than an incomplete organization.
> **Portal:** **Community / Global** (`global` + `community` frontend modules; extends `routes/api/onboarding.php`).
> **Route:** Adds the community route tree (`/feed`, `/network`, `/messages`, `/profile/:slug`) and namespaces the workspace under `/workspace/*`. See §2 Decision 1.
> **Conventions:** [project-gate.md](../../../rules/core/project-gate.md) (ScaleUP Profile — React 19, manual central routing in `app/routes.jsx`, `@/app/axios/http`), [ui-design.md](../../../rules/conditional/ui-design.md), [DESIGN_PRINCIPLES.md](../../../blueprint/scaleup/docs/DESIGN_PRINCIPLES.md), [ADR-002](../../../blueprint/scaleup/docs/decisions/ADR-002-subscription-model.md), [ADR-003](../../../blueprint/scaleup/docs/decisions/ADR-003-community-vs-workspace.md).
> **System Awareness:** Models — **reused** `User`, `Organization`, `OrganizationMember`; none created. Tables — none created; `users.onboarding_step` semantics change (see §3). Routes — **extended** `routes/api/onboarding.php`; `routes/web.php` needs a catch-all so client deep links survive a refresh. Frontend — **rewrites** [`app/routes.jsx`](../../../../resources/views/web/app/routes.jsx) and [`module/global/components/AppShell.jsx`](../../../../resources/views/web/src/module/global/components/AppShell.jsx); **rewrites** [`module/onboarding/pages/OnboardingPage.jsx`](../../../../resources/views/web/src/module/onboarding/pages/OnboardingPage.jsx). New migration: **no**.

---

## 1. Purpose

Every registered ScaleUP user is an **Individual**, and the Community Platform is their home. Creating an Organization is opt-in and subscription-gated. The current implementation inverts this at every layer:

| Blueprint requires | Implementation does |
| :--- | :--- |
| Community is the default landing | `/dashboard` and `/app` both render the Organization Workspace |
| Organizations are opt-in | Onboarding forces every user through `Welcome → Workspace Path → Business Details → Team Invite` |
| An Individual is complete without an org | [`AppShell.jsx:45`](../../../../resources/views/web/src/module/global/components/AppShell.jsx) falls back to a fabricated org name, `'Apex Innovations Inc.'`, so a user with no organization is shown a fake one |
| Two distinct experiences | One shell, one nav (`Dashboard · Manage · Measure · Plan · Connect · Scale`) — all workspace, no community entry at all |

The net effect: **a newly registered Individual has nowhere to go.** This spec gives them somewhere, and makes the Workspace the branch rather than the trunk.

This spec owns the **container**: routing, guards, shell chrome, context switching, and onboarding. The Community Home page that lives inside it is [`community_home.md`](./community_home.md). Neither ships posts, connections, or messaging data — those are separate specs (§8).

> This is a **behavior-changing** spec. Unlike [`schema_correction.md`](../organization/schema_correction.md), it deliberately alters what users see and where they land.

---

## 2. Design Decisions (Pros & Cons)

### Decision: Route topology — how Community and Workspace coexist

**Option A — Community at the root, Workspace namespaced under `/workspace/*` (Recommended)**

- `/feed`, `/network`, `/messages`, `/profile/:slug` are top-level. Workspace pages move to `/workspace/dashboard`, `/workspace/sales`, and so on.

| Pros | Cons |
| :--- | :--- |
| The URL mirrors the product hierarchy — the free default experience gets the short paths, the opt-in branch carries the prefix | `/dashboard` is already referenced by `FinishOnboardingHandler` (`redirect_url`) and hardcoded in `AppShell.jsx`; both must change |
| A guard can protect the whole workspace subtree in one place, rather than per route | Existing bookmarks to `/dashboard` break unless a redirect is kept |
| Deep links carry their context, so the back button and a refresh both behave | |
| Adding community pages later needs no new namespace decision | |

**Option B — Symmetric prefixes: `/community/*` and `/workspace/*`**

| Pros | Cons |
| :--- | :--- |
| Perfectly symmetric and self-documenting | Puts a prefix on the experience that is supposed to be the default — the URL implies the two are peers when the product says one is the trunk |
| No ambiguity about which tree a route belongs to | Longer URLs for the most-visited pages; `/community/feed` for a home feed reads badly |

**Option C — One `/app` route with an in-page context toggle**

| Pros | Cons |
| :--- | :--- |
| Smallest routing change | A deep link cannot express context, so a refresh drops the user in the wrong place |
| | Browser back/forward stops matching what the user sees — the defect class this avoids entirely under A or B |

**Recommendation: Option A.** The URL should encode the product's own hierarchy, and the blueprint is unambiguous that Community is the default and the Workspace is the opt-in branch. Keep a permanent `/dashboard → /workspace/dashboard` redirect so existing links survive.

---

### Decision: Where an authenticated user lands

**Option A — Community always (Recommended for users with no organization; see the refinement)**

- Post-login and post-register, every user lands on `/feed`.

**Option B — Remember the last context per user**

- Persist the last visited context and honour it on the next login.

| | Option A — always Community | Option B — last context |
| :--- | :--- | :--- |
| Pros | Simplest; directly enforces [Design Principle 1](../../../blueprint/scaleup/docs/DESIGN_PRINCIPLES.md); no state to store or migrate | An owner who lives in the Workspace is not bounced to the feed every session |
| Cons | Daily friction for the users who pay — they re-navigate to the Workspace every login | Needs a stored preference; a user with no org must never be sent to a workspace they cannot enter |

**Recommendation: a rule, not one of the two.**

- A user with **no active organization** always lands on `/feed`. There is nowhere else they may go, so this is not a preference.
- A user **with** an active organization lands on their **last context**, defaulting to `/feed` when there is none stored.

Store it client-side (`localStorage`) rather than as a `user_preferences` column: it is a device convenience, not business data, and adding a column for it invites a migration this spec does not otherwise need. Note this is a deliberate departure from a strict reading of Design Principle 1 — the principle protects the Community from being a *waiting room*, and honouring where a paying owner was last working does not make it one.

---

### Decision: One adaptive shell, or two shells

**Option A — One shell that adapts its nav and chrome to the active context (Recommended)**

| Pros | Cons |
| :--- | :--- |
| The theme, top bar, avatar, notifications, and theme toggle are defined once — the visual continuity the user explicitly asked for is structural, not a convention two files must both remember | One component carries two nav configurations, so it needs a clear internal split or it becomes the file everyone is afraid of |
| Switching context never remounts the shell, so no flash of re-layout | |
| A single place to decide what an Individual with no org sees | |

**Option B — `CommunityShell` and `WorkspaceShell` as separate components**

| Pros | Cons |
| :--- | :--- |
| Each is simple and independently readable | Two copies of the top bar, theme toggle, notifications, and user menu — guaranteed to drift, and drift in the chrome is exactly what breaks "same theme" |
| Free to diverge visually later | A context switch remounts the whole shell |

**Recommendation: Option A**, with the nav configuration extracted to a data module (`shell/navigation.js`) that exports `communityNav` and `workspaceNav`. The shell renders whichever the active context selects. That keeps the chrome single-sourced while keeping each nav list readable and separately editable.

---

### Decision: What an Individual with no organization sees where the org switcher is

Today that slot renders `'Apex Innovations Inc.'` — a fabricated organization.

**Option A — Replace the switcher with a "Create Organization" call to action (Recommended)**

| Pros | Cons |
| :--- | :--- |
| Truthful: the user has no organization, and the slot says so | The CTA must be worded so it does not imply the account is incomplete — Design Principle 2 |
| Puts the upgrade path exactly where the user would look for it, without a nag or an interstitial | |
| Removes the fabricated-data defect outright | |

**Option B — Hide the slot entirely for Individuals**

| Pros | Cons |
| :--- | :--- |
| Zero pressure, cleanest possible Individual chrome | The only route to the Workspace becomes undiscoverable — a user who wants to create an organization has to find it in Settings |

**Recommendation: Option A.** A single quiet entry point, worded as a capability rather than a gap: **"Create Organization"**, not "Complete your setup" or "Upgrade". Never a badge, a red dot, or a modal.

---

### Decision: What replaces the forced onboarding wizard

The current 5-step wizard (`Welcome → Workspace Path → Business Details → Team Invite → Ready`) makes org creation mandatory.

**Option A — Split it: a minimal Individual onboarding, and org creation as its own flow (Recommended)**

- Individual onboarding becomes **profile only** — name, headline, optional photo — and is **skippable**. Organization creation moves to `/organizations/new`, reached from the shell CTA, and keeps the existing Business Details → Plan → Activate steps.

| Pros | Cons |
| :--- | :--- |
| Each flow asks only for what its own purpose needs | Two flows to build instead of one, and the existing wizard component must be split |
| An Individual reaches the feed in one screen, or zero if they skip | |
| Org creation can then follow [ORGANIZATION_CREATION.md](../../../blueprint/scaleup/docs/specifications/organization/ORGANIZATION_CREATION.md)'s real flow, including the subscription step the current wizard omits entirely | |

**Option B — Keep one wizard, make the org steps skippable**

| Pros | Cons |
| :--- | :--- |
| One flow to maintain | A skippable step still *presents* org creation as part of becoming a user, which is the exact implication Design Principle 2 forbids |
| Smaller diff | The subscription step has nowhere natural to live |

**Recommendation: Option A.** Note the consequence: `users.onboarding_step` currently encodes a single 0–7 sequence spanning both concerns. After the split it tracks **Individual profile onboarding only**, and organization progress belongs to `organizations.onboarding_completed_at`, which already exists. See §3.

---

### Decision: Guarding the workspace subtree

**Option A — A `WorkspaceGuard` that requires an active organization membership (Recommended)**

- Wraps `/workspace/*`. No active membership → redirect to `/feed`. Membership but no active subscription → the subscription state screen.

| Pros | Cons |
| :--- | :--- |
| One guard for the whole subtree; a new workspace page is automatically protected | Needs the active-organization state resolved before first render, or the guard flickers |
| The place the subscription gate will slot in when that layer exists, with no re-architecture | The subscription half cannot be built yet — no subscription tables exist |

**Option B — Per-page checks**

| Pros | Cons |
| :--- | :--- |
| No new component | Every future page must remember the check; one omission silently exposes the workspace |

**Recommendation: Option A**, built now with the **membership** check only. The subscription check is a documented `TODO` with its own spec (§8) — deliberately **not** faked, because a guard that pretends to check a subscription is worse than one that visibly does not yet.

---

## 3. Database

**No migration.** Two semantic changes to existing columns, both documented rather than altered:

| Column | Before | After |
| :--- | :--- | :--- |
| `users.onboarding_step` | 0–7, spanning profile *and* organization setup | Individual profile onboarding only. `0` = not started, `1` = profile captured, `2` = complete/skipped |
| `users.onboarding_completed_at` | Set when the org wizard finished | Set when Individual onboarding is completed **or skipped** |
| `organizations.onboarding_completed_at` | Set by `FinishOnboardingHandler` | Unchanged — now the sole record of organization setup progress |

> `FinishOnboardingHandler` currently writes `onboarding_step = 7` and stamps the organization in the same call. After the split it must stop touching the organization: an Individual finishing profile onboarding has no organization to stamp.

---

## 4. Backend

| Endpoint | Change |
| :--- | :--- |
| `GET /api/onboarding/state` | Reuse. `has_organization` already distinguishes the two cases and needs no change. |
| `POST /api/onboarding/advance-step` | Reuse with the narrowed step range. |
| `POST /api/onboarding/finish` | **Modify** — stop stamping `organizations.onboarding_completed_at`; that belongs to the org creation flow. Returns `redirect_url: '/feed'`, not `/dashboard`. |
| `GET /api/auth/me` | Reuse. Already returns `current_organization` and `role`, which is everything the shell needs to choose a context. |

`routes/web.php` needs its `/app` route widened to a catch-all so a refresh on `/feed` or `/workspace/dashboard` still serves the SPA rather than 404ing.

No new Query, Handler, or Action. `FinishOnboardingHandler` is edited; nothing else in `app/` changes.

---

## 5. Frontend

### Route tree ([`app/routes.jsx`](../../../../resources/views/web/app/routes.jsx))

```text
/                         LandingPage                     public
/login /register /forgot-password /reset-password/:token  GuestGuard
/verify-email

<AuthGuard>
  /onboarding             OnboardingPage (profile only, skippable)
  <AppShell context="community">
    /feed                 CommunityHomePage       ← community_home.md
    /network              placeholder             ← connections spec
    /messages             placeholder             ← messaging spec
    /profile/:slug        placeholder             ← user profile spec
  </AppShell>
  /organizations/new      OrganizationCreatePage  ← org creation spec (no shell — focused flow)
  <WorkspaceGuard><AppShell context="workspace">
    /workspace/dashboard  DashboardPage           ← existing, moved
  </AppShell></WorkspaceGuard>
</AuthGuard>

/dashboard  →  redirect  /workspace/dashboard    (permanent, keeps old links alive)
/app        →  redirect  /feed                   (was the workspace; now the community default)
*           NotFoundPage
```

### Module layout

```text
src/module/global/
├── components/
│   ├── AppShell.jsx              # rewritten: takes `context`, renders the matching nav
│   ├── ContextSwitcher.jsx       # org switcher when the user has one; "Create Organization" CTA when not
│   └── ShellNav.jsx              # renders a nav config; no per-context branching inside
├── shell/navigation.js           # exports communityNav + workspaceNav (data, not JSX)
├── hooks/useShellContext.js      # active context, last-context persistence
└── guards/WorkspaceGuard.jsx     # requires active membership; subscription check is a documented TODO
```

### Shell chrome — identical in both contexts

The user's requirement is that the Individual experience share the Workspace's visual language. That is guaranteed structurally rather than by convention: these are rendered by the same component in both contexts, from the same tokens in [`resources/css/app.css`](../../../../resources/css/app.css).

| Element | Behavior |
| :--- | :--- |
| Top bar, logo, search trigger | Identical |
| Theme toggle | Identical — same `useTheme()` |
| Avatar + user menu | Identical; the role badge renders only when `user.role` is non-null |
| Notification bell | Identical |
| Sidebar geometry, spacing, breakpoints | Identical — only the nav *items* differ |
| Nav items | `communityNav`: Home · Network · Messages · Opportunities · Profile. `workspaceNav`: the existing Dashboard · Manage · Measure · Plan · Connect · Scale |
| Context slot | Org switcher, or the "Create Organization" CTA |

### Reused primitives

`Button`, `Badge`, `Card`, `Dropdown`, `IconButton`, `Sidebar`, `TopNavigation`, `Modal` from [`components/ui/`](../../../../resources/views/web/src/components/ui/). **Missing and needed:** `Avatar` and `EmptyState` — both belong to the Design System spec, not this one. Until they land, compose initials inline as `AppShell` already does.

---

## 6. Business Rules & Edge Cases

| Case | Handling |
| :--- | :--- |
| Individual with no organization | Lands on `/feed`. `/workspace/*` redirects to `/feed`. Context slot shows the Create CTA. |
| Individual visits `/workspace/dashboard` directly | `WorkspaceGuard` redirects to `/feed` — no error, no flash of workspace chrome. |
| Member of multiple organizations | Switcher lists all; switching sets `current_organization_id` via the existing endpoint and re-renders the workspace. |
| Organization becomes inactive while the user is inside it | Next guarded navigation redirects to `/feed` with an explanation. Do **not** silently swap to another org. |
| Removed from their last organization mid-session | Same as above; the context slot reverts to the Create CTA. |
| `current_organization` resolved but no membership row | `WorkspaceGuard` denies. Membership, not the column, is the authority. |
| Onboarding skipped | `onboarding_completed_at` is stamped. The user is never asked again; profile completion becomes an optional prompt on their own profile page. |
| Refresh on a deep link | Requires the `routes/web.php` catch-all. Without it this is a 404, and it will be the first bug reported. |
| Role badge for an Individual | `user.role` is null with no organization, so the badge does not render. Never substitute a default. |

---

## 7. Build Order

1. `routes/web.php` — widen `/app` to a catch-all. Everything else 404s on refresh without this.
2. `shell/navigation.js` — the two nav configs as data.
3. `AppShell.jsx` — accept `context`, render the matching nav, **delete the fabricated `'Apex Innovations Inc.'` / `'Carlos Montes'` fallbacks**.
4. `ContextSwitcher.jsx` — switcher or CTA.
5. `WorkspaceGuard.jsx` — membership check; `TODO` for subscription.
6. `useShellContext.js` — active context + last-context persistence.
7. `app/routes.jsx` — the tree above, including both redirects.
8. `CommunityHomePage` placeholder so `/feed` resolves — real content is [`community_home.md`](./community_home.md).
9. Split `OnboardingPage.jsx` — profile-only and skippable; move the Business Details / Team Invite steps out to the org creation flow.
10. `FinishOnboardingHandler` — stop stamping the organization; return `/feed`.
11. Verify: register → land on `/feed` with no organization anywhere in the chrome → create an organization → land in the workspace → switch back to Community → refresh on each deep link.

**Definition of done:** a freshly registered user never sees the word "organization" except as one quiet CTA, and `/workspace/*` is unreachable for them.

---

## 8. Out of Scope (Future Specs)

- **The Community Home page itself** — layout, post card, composer: [`community_home.md`](./community_home.md).
- **Posts, comments, reactions, connections, messaging** — all data and endpoints behind `/feed` and `/network`. Roadmap Phase 1; none of the seven table groups exist.
- **Subscription gating** — `WorkspaceGuard`'s membership check is real; the subscription check is a `TODO` because no subscription table exists. [ADR-002](../../../blueprint/scaleup/docs/decisions/ADR-002-subscription-model.md) requires it before the workspace can be called paid.
- **Organization creation flow** — the Business Details → Plan → Activate steps moved out of onboarding need their own spec against [ORGANIZATION_CREATION.md](../../../blueprint/scaleup/docs/specifications/organization/ORGANIZATION_CREATION.md), including the subscription step the current wizard omits.
- **`Avatar` and `EmptyState` primitives** — belong to [`design_system.md`](../design/design_system.md).
- **Amending [`global_layout.md`](../global/global_layout.md)** — it specs a workspace-only shell at `src/layouts/AppShell/` with `basename="/app"`. The implementation already diverged (it lives at `module/global/components/`), and this spec supersedes its routing and context model. That spec should be updated or marked superseded rather than left to contradict this one.
- **User profile page** — `/profile/:slug` is a placeholder here.
