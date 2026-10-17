# Spec — Community Home (Individual Feed Page)

> **Kind:** Greenfield — no community page, component, route, model, or table exists today.
> **Portal:** **Community** (`community` frontend module). Gate 1 is **design-only with hard-coded fixtures** — no API, no tables. See §2 Decision 4.
> **Route:** `/feed`, rendered inside the Community context of the shell defined by [`community_shell.md`](./community_shell.md).
> **Conventions:** [project-gate.md](../../../rules/core/project-gate.md) (ScaleUP Profile — React 19, `.jsx`/`.tsx`, `@/src/components/ui`), [ui-design.md](../../../rules/conditional/ui-design.md), [design_system.md](../design/design_system.md), [COMMUNITY_FEED.md](../../../blueprint/scaleup/docs/specifications/community/COMMUNITY_FEED.md), [POSTS.md](../../../blueprint/scaleup/docs/specifications/community/POSTS.md), [DESIGN_PRINCIPLES.md](../../../blueprint/scaleup/docs/DESIGN_PRINCIPLES.md) §5.
> **System Awareness:** Models — none reused, none created. Tables — none; the seven community table groups (`posts`, `comments`, `reactions`, `connections`, `follows`, `conversations`, `notifications`) do **not** exist. Routes — none; `/api/community/...` does not exist. Reused frontend — [`components/ui/`](../../../../resources/views/web/src/components/ui/) (17 primitives) and the tokens in [`resources/css/app.css`](../../../../resources/css/app.css). New migration: **no**.

---

## 1. Purpose

This is the page a registered Individual lands on, and for a free user it **is** ScaleUP. It has to stand on its own as a product, not read as a placeholder until the user creates an organization ([Design Principle 1](../../../blueprint/scaleup/docs/DESIGN_PRINCIPLES.md)).

Shape is familiar — a business feed with posts, reactions, and comments. Two things separate it from a general social network:

- **[Design Principle 5](../../../blueprint/scaleup/docs/DESIGN_PRINCIPLES.md):** every element serves business growth, professional development, or entrepreneurial collaboration. No engagement mechanics that do not.
- **Visual continuity with the Workspace.** Same tokens, same primitives, same shell chrome. A user moving between Community and Workspace must feel one product, not two apps that share a logo. This is the requirement that most constrains the layout below.

Gate 1 ships the **design against hard-coded fixtures** so the layout can be validated before any backend exists. That is not a shortcut — the feed's data layer is seven tables of Roadmap Phase 1 work, and the design should not wait on it.

---

## 2. Design Decisions (Pros & Cons)

### Decision: Page layout

**Option A — Three columns: nav rail (shell) · feed · right rail (Recommended)**

- The shell supplies the left nav. This page owns a centred feed column with a max width, and a right rail for discovery.

| Pros | Cons |
| :--- | :--- |
| Matches the Workspace dashboard's own grid, so the two contexts read as one product — the stated requirement | Three columns need real thought below `lg`; the right rail must collapse, not squeeze |
| The right rail is where [COMMENTS/CONNECTIONS discovery](../../../blueprint/scaleup/docs/specifications/community/COMMUNITY_FEED.md) belongs, and the feed spec's empty state explicitly points users toward it | More surface to design before anything is validated |
| A capped feed column keeps line length readable instead of stretching post text across a 27" monitor | |

**Option B — Two columns: nav rail · feed**

| Pros | Cons |
| :--- | :--- |
| Simplest; fastest to build and validate | Nowhere for "who to follow", suggested organizations, or opportunities — so the empty state cannot do what the feed spec asks of it |
| Feed gets more width | Diverges from the Workspace's multi-panel density, weakening the visual continuity |

**Option C — Single centred column**

| Pros | Cons |
| :--- | :--- |
| Mobile-identical at every breakpoint | Wastes desktop entirely; reads as a phone app in a browser, which is the opposite of "premium, enterprise-ready" |

**Recommendation: Option A**, with an explicit responsive ladder (§5). The right rail carries discovery, which the feed spec's own empty-state copy depends on.

---

### Decision: Post composer placement

**Option A — Inline trigger at the top of the feed, expanding to a modal (Recommended)**

- A single-line "Share a business update…" affordance. Clicking opens a focused modal composer.

| Pros | Cons |
| :--- | :--- |
| The trigger is one row, so the feed starts near the top of the viewport | Two states to build and keep visually consistent |
| The modal gives room for post type, visibility, and attachments without any of it cluttering the feed | Modal-on-mobile needs to be full-screen, not a floating card |
| Reuses the existing `Modal` primitive | |

**Option B — Always-expanded inline composer**

| Pros | Cons |
| :--- | :--- |
| One state; no modal | Permanently occupies the most valuable screen space for an action taken rarely relative to reading |
| Fewer clicks to post | Visibility and post-type controls either clutter the feed or get hidden, and hidden controls get ignored |

**Recommendation: Option A.** Reading dominates a feed; the composer should be reachable, not resident.

---

### Decision: Feed section navigation

[COMMUNITY_FEED.md](../../../blueprint/scaleup/docs/specifications/community/COMMUNITY_FEED.md) lists six possible sections: Recommended, Following, Connections, Organizations, Opportunities, Latest.

**Option A — Two tabs now (`Recommended`, `Latest`), the rest deferred (Recommended)**

| Pros | Cons |
| :--- | :--- |
| Six tabs over fixture data is six empty states pretending to be features | Adding tabs later shifts the layout slightly |
| `Recommended` vs `Latest` is the one distinction that is meaningful with no social graph — algorithmic vs chronological | Under-represents the eventual design |
| The feed spec itself says "the final navigation may evolve" | |

**Option B — All six tabs**

| Pros | Cons |
| :--- | :--- |
| Matches the spec's list exactly | Four of six cannot have content until connections, follows, and opportunities exist — validating them is impossible |
| No later layout change | Ships four dead tabs, which teaches users the product is empty |

**Recommendation: Option A.** Build the `Tabs` primitive usage so adding sections is additive, and note the remaining four in §8.

---

### Decision: Gate 1 data source

**Option A — A single fixtures module, shaped to the eventual API contract (Recommended)**

- `mocks/communityMocks.js` exports fixtures matching the response shape the future `/api/community/feed` will return.

| Pros | Cons |
| :--- | :--- |
| Exactly the pattern [`dashboard_concept.md`](../dashboard/dashboard_concept.md) already established, so the codebase has one answer for mock data | Fixtures drift from the real contract unless the swap happens deliberately |
| Gate 2 replaces the fixture import with an `api/` call and the components do not change | |
| Forces the API contract to be designed now, while it is cheap | |

**Option B — Components hold their own inline sample data**

| Pros | Cons |
| :--- | :--- |
| Nothing to import | Sample data spread across a dozen components; Gate 2 becomes a hunt |
| | No single place to see the contract |

**Recommendation: Option A**, and type the fixtures. `src/types/` already exists from the TypeScript migration, so a `community.ts` there gives the contract a compiler-checked home — the same thing that caught the dashboard fixtures drifting.

> **Do not** copy [`home.api.ts`](../../../../resources/views/web/src/module/dashboard/home/api/home.api.ts)'s `try/catch → fall back to mock` pattern. It makes a broken endpoint look healthy, which is a silent failure. Gate 1 imports fixtures directly; Gate 2 calls the API and lets errors surface.

---

### Decision: What a post card carries in Gate 1

**Option A — Author, timestamp, body, media, reaction summary, comment count, and the three actions (Recommended)**

- Actions: React, Comment, Share. Share renders **disabled with a tooltip**, because [POSTS.md](../../../blueprint/scaleup/docs/specifications/community/POSTS.md) puts reposts in Future Scope and the feed spec only says "share where supported".

| Pros | Cons |
| :--- | :--- |
| Reaction and comment are fully specified, so they can be designed truthfully | A disabled control needs care not to look broken |
| Showing Share disabled is honest about scope, and validates the three-action layout now | |

**Option B — React and Comment only; omit Share**

| Pros | Cons |
| :--- | :--- |
| Nothing disabled | The action row's spacing changes when Share lands, so the layout is validated against the wrong geometry |

**Recommendation: Option A.** Flag the wording of the disabled tooltip as a copy decision, not a technical one — "Coming soon" is weaker than saying nothing and simply not offering it. If Share is not wanted at all, drop it and note the decision.

---

## 3. Database

**None.** No table is created or read. The seven community table groups are separate specs (§8).

The fixtures do define the **shape** those tables must eventually support — author identity, ownership (user vs organization), visibility, and reaction aggregation. That is design pressure on the future schema, deliberately applied early and cheaply.

---

## 4. Backend

**None in Gate 1.** No route, controller, Query, or Handler.

The API contract the fixtures encode, for the Gate 2 spec to implement:

| Action | Method & path | Notes |
| :--- | :--- | :--- |
| Feed page | `GET /api/community/feed` | `?section=` (`recommended` or `latest`) plus `?cursor=` — cursor, not offset; a feed shifts under offset pagination |
| Create post | `POST /api/community/posts` | |
| React | `POST /api/community/posts/{id}/reactions` | |
| Remove reaction | `DELETE /api/community/posts/{id}/reactions` | |
| Comments | `GET /api/community/posts/{id}/comments` | Loaded on expand, not with the feed |

Cursor pagination is a real decision, not a detail: with offset pagination a post inserted while the user reads causes a duplicate or a skip on the next page.

---

## 5. Frontend

### Module layout

```text
src/module/community/home/
├── index.jsx
├── pages/CommunityHomePage.jsx
├── components/
│   ├── FeedTabs.jsx            # Recommended | Latest — wraps the ui/Tabs primitive
│   ├── PostComposerTrigger.jsx # the one-line affordance
│   ├── PostComposerModal.jsx   # body, post type, visibility, attachment slot
│   ├── PostCard.jsx            # author · time · body · media · actions
│   ├── PostActions.jsx         # React · Comment · Share (disabled)
│   ├── ReactionSummary.jsx     # aggregate counts
│   ├── CommentThread.jsx       # collapsed by default
│   ├── FeedSkeleton.jsx        # loading
│   ├── FeedEmptyState.jsx      # the feed spec's own discovery copy
│   └── rail/
│       ├── ProfileSummaryCard.jsx   # avatar, name, headline, completeness nudge
│       ├── SuggestedPeopleCard.jsx
│       ├── SuggestedOrgsCard.jsx
│       └── OpportunitiesTeaserCard.jsx
├── hooks/useCommunityFeed.js   # Gate 1: reads fixtures. Gate 2: calls the api module.
└── mocks/communityMocks.js
```

`src/types/community.ts` — `Post`, `PostAuthor`, `Reaction`, `Comment`, `FeedPage`, `FeedSection`. The fixtures are annotated with these, so a drift between fixture and contract fails `npm run typecheck`.

### Responsive ladder

| Breakpoint | Layout |
| :--- | :--- |
| `< sm` | Single column. Shell nav becomes a drawer. Right rail content moves **below** the feed, not hidden — it is the empty state's whole purpose. Composer modal is full-screen. |
| `sm – lg` | Single feed column, centred, capped. Right rail still below. |
| `lg – xl` | Two columns: feed + right rail. Shell nav is a rail. |
| `≥ xl` | Three columns. Feed column capped around `640px` for readable line length; rail fixed-width. |

### Visual continuity with the Workspace — non-negotiable

| Element | Rule |
| :--- | :--- |
| Colour | Only the semantic tokens in [`app.css`](../../../../resources/css/app.css) — `--color-bg`, `--color-bg-secondary`, `--color-text`, `--color-text-secondary`, `--color-border`, `--color-primary`. **No new hex values.** |
| Card surface | The existing `Card` primitive. A post is a Card, styled exactly as a dashboard widget is. |
| Radii, shadows, spacing | The existing `--shadow-sm/md` tokens and the dashboard's scale. A feed card must be indistinguishable in surface treatment from a dashboard widget. |
| Typography | Inter, the dashboard's existing size and weight ramp. |
| Dark mode | Every element must be checked in both. The tokens handle it if nothing is hardcoded — which is the reason for the no-new-hex rule. |
| Icons | `lucide-react`, matching the dashboard's stroke width and size. |

### Reused primitives

`Card`, `Button`, `IconButton`, `Badge`, `Tabs`, `Modal`, `Textarea`, `Dropdown`, `Select`.

**Missing and required:** `Avatar` (used in every post, the composer, the rail — the single most-repeated element on the page) and `EmptyState`. Both belong to [`design_system.md`](../design/design_system.md), not here. Building them ad-hoc in this module is the duplication [system-awareness.md](../../../rules/conditional/system-awareness.md) exists to stop — **add them to the Design System first.**

---

## 6. Business Rules & Edge Cases

| Case | Handling |
| :--- | :--- |
| A brand-new user with no connections | The feed spec's empty state, with the right rail's discovery cards adjacent. This is the **default** state at launch, not an edge case — design it first, not last. |
| Post by an Organization | Author block shows the org, its logo, and a subtle org marker. Ownership is a real distinction ([PLATFORM_ENTITIES.md](../../../blueprint/scaleup/docs/PLATFORM_ENTITIES.md)), not a styling variant. |
| Post by an Individual who has an organization | Still an Individual post. Never attribute a personal post to their organization. |
| Long post body | Clamp with "See more". Fixtures must include one long post so the clamp is validated. |
| Post with no media | Card must not reserve empty media space. |
| Reaction count of zero | Hide the summary row entirely; do not render "0". |
| Own post | Shows an overflow menu (edit/delete). Actions are stubbed in Gate 1. |
| Deleted or unavailable author | Fixtures include one, so the design handles it rather than crashing later. |
| Very long author name or headline | Truncate with a title attribute. |
| Feed loading | `FeedSkeleton` matching the post card's real geometry — not a spinner. A spinner tells the user nothing about what is arriving. |
| Feed request fails (Gate 2) | Show an error with a retry. **Do not** silently substitute fixtures. |

---

## 7. Build Order

1. **Design System first:** add `Avatar` and `EmptyState`. Every element below depends on `Avatar`.
2. `src/types/community.ts` — the contract.
3. `mocks/communityMocks.js`, annotated with those types. Include the awkward cases: long body, no media, zero reactions, org author, missing author.
4. `PostCard` + `PostActions` + `ReactionSummary` — the page's atom. Validate it against the dashboard widgets side by side in both themes before building anything else.
5. `FeedTabs`, `FeedSkeleton`, `FeedEmptyState`.
6. Right rail cards.
7. `PostComposerTrigger` + `PostComposerModal`.
8. `CommentThread`, collapsed.
9. `CommunityHomePage` — compose, apply the responsive ladder.
10. `useCommunityFeed` reading fixtures.
11. Verify: every breakpoint in the ladder, both themes, and a side-by-side with `/workspace/dashboard` to confirm the surfaces match.

**Definition of done:** a user cannot tell the feed card and a dashboard widget were designed separately, and the empty state is genuinely useful with zero content.

> **Gate 1 ends here.** Do not build any endpoint or table. The user validates the design first ([`webkit.frontend-implement`](../../../skills/webkit.frontend-implement/SKILL.md)), then Gate 2 wires real data.

---

## 8. Out of Scope (Future Specs)

- **All seven community table groups and their endpoints** — posts, comments, reactions, connections, follows, messaging, notifications. Roadmap Phase 1; nothing exists.
- **The shell, routing, guards, and onboarding** — [`community_shell.md`](./community_shell.md). This spec assumes `/feed` exists and renders inside the Community context.
- **`Avatar` and `EmptyState`** — [`design_system.md`](../design/design_system.md). Prerequisite, not a parallel task.
- **The remaining four feed sections** — Following, Connections, Organizations, Opportunities. Each needs its underlying relationship to exist first.
- **Share and repost** — [POSTS.md](../../../blueprint/scaleup/docs/specifications/community/POSTS.md) puts reposts in Future Scope, and the feed spec says only "share where supported". The control ships disabled; whether Share exists at all is an open product decision.
- **Post media upload** — the composer has an attachment slot; storage, validation, and processing are separate.
- **Moderation and reporting** — [COMMUNITY_FEED.md](../../../blueprint/scaleup/docs/specifications/community/COMMUNITY_FEED.md) has a Content Moderation section with no home yet.
- **Feed ranking** — `Recommended` is fixture-ordered in Gate 1. Real relevance ranking is its own problem and its own spec.
- **User profile page** — `/profile/:slug`, reached from every author block here.
