# Spec — Following (One-Way Subscriptions to Users & Organizations)

> **Kind:** Greenfield — no `follows` table, model, route, or page exists. Three stubs are already in the repo waiting for it (see §1.1).
> **Portal:** **Community** (`/api/community/follows/...` routes, `community` frontend module).
> **Version:** v1 — 2026-08-14 — initial.
> **Route:** `/network` with `?tab=following` (Decision 8), plus a new `following` section on the existing `/feed` (`GET /api/community/feed?section=following`).
> **Conventions:** [project-gate.md](../../../rules/core/project-gate.md) (ScaleUP Profile — React 19, `<parent>_id`, `deleted_at`), [ui-design.md](../../../rules/conditional/ui-design.md), [design_system.md](../design/design_system.md), [FOLLOWING.md](../../../blueprint/scaleup/docs/specifications/community/FOLLOWING.md), [ORGANIZATION_DISCOVERY.md](../../../blueprint/scaleup/docs/specifications/community/ORGANIZATION_DISCOVERY.md), [DATABASE_SCHEMA.md §5](../../../blueprint/scaleup/docs/DATABASE_SCHEMA.md), [connections.md](./connections.md), [community_home.md](./community_home.md).
> **System Awareness:** Models — **reused** `User`, `Organization`, `Post`; **created** `Follow`. Tables — **created** `follows`; `user_blocks` is **owned by [connections.md](./connections.md)** (Decision 5). Routes — **extended** [`routes/api/community.php`](../../../../routes/api/community.php), already mounted under `auth:sanctum` + `community`. Queries — **extended** `GetCommunityFeedQuery` and `GetCommunityDiscoveryQuery`; **created** `GetUserFollowsQuery`, `GetFollowStatusQuery`. Controller — **created** `Community/FollowController`. New migration: **yes** — one.

---

## 1. Purpose

**Following is a one-way subscription.** A user follows another user or an organization to see their public updates; the target neither consents nor is obliged to reciprocate. That is the whole difference from [connections.md](./connections.md), and it is why the two must never be conflated:

| | Connection | Follow |
| :--- | :--- | :--- |
| Direction | Mutual | One-way |
| Consent | Required — request, accept | None — follow is unilateral |
| Grants | Nothing (BR-6 there) | Nothing — public content only |
| Reversal | Remove, both sides affected | Unfollow, silent, target unaffected |

Its business purpose is content curation: a user assembles their own information sources — the suppliers, investors, and operators they care about — and the feed reflects it. Organizations get a public audience without giving away workspace access, which is the separation [ORGANIZATION_DISCOVERY.md](../../../blueprint/scaleup/docs/specifications/community/ORGANIZATION_DISCOVERY.md) is built around.

### 1.1 Three stubs already in the repo are waiting for this spec

This is not greenfield in the usual sense. **Committed code already references this exact file by section and acceptance-criteria number**, and this spec is written to satisfy those references rather than to contradict them:

| Stub | What it already pins down |
| :--- | :--- |
| [`FollowVolumeSeeder.php`](../../../../database/seeders/FollowVolumeSeeder.php) | Guards on `Schema::hasTable('follows')` and prints *"Run the migration from `.agents/specs/scaleup/community/following.md` §3.1 first"*. It writes columns **`follower_id`**, `followable_type`, `followable_id`, `created_at`, `updated_at`; relies on a unique index to backstop `insertOrIgnore`; names an **`ResolveFollowableAction`**; paginates **`GET /api/community/follows`**; and cites **AC-6** (no self-follow) and **AC-19** (type/id collision). |
| [`PostVolumeSeeder.php`](../../../../database/seeders/PostVolumeSeeder.php) | Deliberately seeds non-public, draft, archived, and soft-deleted posts so the feed's filters are observable, citing **AC-13** (`section=following` excludes non-public visibility) and **AC-14** (soft-deleted rows vanish). |
| [`SuggestedOrgsCard.jsx`](../../../../resources/views/web/src/module/community/home/components/rail/SuggestedOrgsCard.jsx) | Already renders a **Follow / Following** button — wired to local `useState` only. It does nothing and resets on refresh. `SuggestedOrg.is_following` is declared in [`types/community.ts`](../../../../resources/views/web/src/types/community.ts) but no endpoint populates it, and `FeedSection` already includes `'following'` with no tab or backend section behind it. |

Consequences that are **not** negotiable in this spec, because changing them would break committed code:

- The follower column is **`follower_id`**, not the `user_id` that [DATABASE_SCHEMA.md §5](../../../blueprint/scaleup/docs/DATABASE_SCHEMA.md) lists. The seeder is executable and the schema doc is not; `follower_id` also reads unambiguously next to `followable_id`. §8 records that the schema doc should be corrected to match.
- The action class is named **`ResolveFollowableAction`**.
- The list endpoint is **`GET /api/community/follows`**.
- **AC-6, AC-13, AC-14, and AC-19 are numbered to match the seeder comments.** The §2.5 table below is ordered so those four land exactly where the committed code says they do. Renumbering the table without updating both seeders would silently break the traceability those comments exist to provide.

### 1.2 Two platform gaps, same as the connections spec found

| The source doc requires | Reality in the repo | This spec's answer |
| :--- | :--- | :--- |
| "Private or non-discoverable profiles cannot be followed" | `user_profiles.visibility` and any org-level visibility flag **do not exist**. Only `users.status` (`'active'`), `organizations.status` (`1`), and `deleted_at` exist. | Followable is defined as active + not soft-deleted + not blocked — §6 BR-6. Identical to the definition [connections.md](./connections.md) adopted, deliberately. |
| "User blocks a followed account" (edge case) | No `blocks` table exists yet; `user_blocks` is **proposed by [connections.md](./connections.md) Decision 5** and unbuilt. | Decision 5 — ownership of that one migration, and what ships if following lands first. |
| "Following may optionally generate notifications" | `notifications` table does not exist. | Out of scope (§8). The source doc says *optionally*. |

---

## 2. Design Decisions (Pros & Cons)

### Decision 1: Polymorphic `follows`, or two typed tables

A follow targets either a `User` or an `Organization`. The [ScaleUP profile](../../../rules/core/project-gate.md) says **real foreign keys, `foreignId()->constrained()`** — and a polymorphic column cannot have one. This is a genuine conflict between the repo convention and the blueprint, so it must be decided rather than assumed.

**Option A — One polymorphic `follows` table: `follower_id` + `followable_type` + `followable_id` (Recommended)**

- `followable_type` is the plain string `'user'` or `'organization'`, exactly as [`reactions.reactable_type`](../../../../database/migrations/2026_08_12_000003_create_reactions_table.php) already does.

| Pros | Cons |
| :--- | :--- |
| **The committed [`FollowVolumeSeeder`](../../../../database/seeders/FollowVolumeSeeder.php) writes these three columns.** Any other shape means editing merged code | `followable_id` gets **no foreign key** — a hard-deleted target leaves an orphan row that no cascade removes |
| Matches [DATABASE_SCHEMA.md §5](../../../blueprint/scaleup/docs/DATABASE_SCHEMA.md) and its recommended unique constraint | Every query must filter on `followable_type` *and* `followable_id`; forgetting the type silently returns another type's rows — the failure the seeder engineers overlapping id ranges to expose (AC-19) |
| The repo already sanctions polymorphic-without-FK: `reactions.reactable_id` and `posts.author_id` are both bare `unsignedBigInteger` with an index. The FK convention governs single-target relationships, and this is not one | Eloquent's `morphTo` needs a morph map, or the type strings drift from class names |
| "View followed entities" is one query over one table, already sorted and paginated together | |

**Option B — Two typed tables: `user_follows` and `organization_follows`**

| Pros | Cons |
| :--- | :--- |
| Real FKs on both target columns, with `cascadeOnDelete` — orphans become structurally impossible | **Breaks the committed seeder**, which inserts into `follows` |
| No type column to forget, so AC-19's failure mode cannot occur | "View followed entities" becomes a `UNION` across two tables, or two paginated calls the client merges — pagination across a union is the kind of thing that is subtly wrong for a year |
| Each table is independently indexable for its own access pattern | Doubles the model, handler, and query code for one behavior; a third followable type later means a third table |
| | Diverges from the blueprint schema |

**Recommendation: Option A.** The FK loss is real but bounded: `User` and `Organization` both use `SoftDeletes`, so hard deletes are the rare administrative case, and every read joins the target and checks it is present and active anyway (BR-6) — an orphan row is invisible rather than harmful. Option B's union-pagination cost is paid on every request; Option A's orphan cost is paid by a periodic prune (§8).

---

### Decision 2: What unfollow does to the row

**Option A — Hard delete the row (Recommended)**

| Pros | Cons |
| :--- | :--- |
| [DATABASE_SCHEMA.md §5](../../../blueprint/scaleup/docs/DATABASE_SCHEMA.md) lists **only `created_at`** for `follows` — no status, no `updated_at`, no `deleted_at`. An immutable, deletable edge is exactly what that shape describes | No history: "who unfollowed me last month" is unanswerable, and follower-churn analytics have no source |
| A follow carries no counterpart state. Nobody consented, nobody is notified, nothing depends on it — so there is nothing for a terminal status to preserve | Re-follow after unfollow loses the original `created_at`, so "following since" resets |
| Re-follow is a plain insert against a clean unique index — no row reuse, no status reset, no direction to flip. Contrast [connections.md](./connections.md) Decision 4, where the row **must** survive because the pair's unique slot and the relationship history both matter | |
| Keeps the table proportional to live edges rather than to all edges ever created — this is the highest-volume table in the community group | |

**Option B — Soft delete (`deleted_at`) or a terminal `status` column**

| Pros | Cons |
| :--- | :--- |
| Preserves history and enables churn analytics | A soft-deleted row still occupies the unique index slot, so re-follow must find-and-restore instead of insert — the seeder's `insertOrIgnore` would silently skip re-follows |
| Consistent with `User`/`Organization`/`Post`, which all soft-delete | The table grows without bound on a follow/unfollow toggle, which is a one-click action users repeat freely |
| | Adds columns the blueprint does not list |

**Recommendation: Option A.** Follow is the one relationship in this domain with no counterpart to protect, which is precisely why it can be deleted outright while a connection cannot. Note the seeder does write `updated_at`, so the migration uses `timestamps()`; the column is harmless because a `follows` row is never updated in place.

---

### Decision 3: Is following idempotent, or is re-following a conflict?

**Option A — Idempotent: re-follow and re-unfollow both return `200` (Recommended)**

- `POST` when already following returns the existing row. `DELETE` when not following returns success.

| Pros | Cons |
| :--- | :--- |
| The user's intent — "I want to be following this" — is already satisfied. Reporting an error for a state the user wanted is noise | The response cannot tell the client whether anything actually changed, unless a `created` flag is added (it is — see §4.5) |
| Network retries, double-clicked buttons, and optimistic-UI resubmits are all free. The unique index handles the race and the handler absorbs the violation | A client with a stale "not following" view gets no signal that it was wrong, beyond the returned state |
| Follow buttons are toggles rendered from possibly-stale state; a `409` would surface as an error toast for a no-op | |
| Deliberately **unlike** [connections.md](./connections.md) AC-3, which returns `409` — because a duplicate connection *request* creates a second obligation for another person, while a duplicate follow creates nothing | |

**Option B — `409 Conflict` on re-follow, `404` on unfollowing what is not followed**

| Pros | Cons |
| :--- | :--- |
| Precise: the client always learns exactly what happened | Punishes the common case. The client's cure is to refetch state and retry — which is what Option A does server-side, in one round trip |
| Consistent with the connections endpoints | Makes every follow button need error handling for a condition that is not an error |

**Recommendation: Option A.** The inconsistency with connections is intentional and worth stating in review: consent-bearing actions conflict loudly, unilateral toggles converge quietly.

---

### Decision 4: The feed's visibility filter — how far does this spec reach?

Adding `section=following` means touching [`GetCommunityFeedQuery`](../../../../app/Queries/Community/GetCommunityFeedQuery.php). Reading it surfaced a **pre-existing defect**: it filters on `status = 'published'` and **never applies `posts.visibility` at all**. Posts marked `connections`, `organization`, or `private` are currently served to every authenticated user in both Recommended and Latest.

This spec's own rule — *"Following must not override content visibility or access restrictions"* — makes the question unavoidable, because a following section built on the current query would inherit the leak.

**Option A — Filter `visibility = 'public'` in the shared query, fixing every section (Recommended)**

| Pros | Cons |
| :--- | :--- |
| Closes a live data leak rather than routing around it | **Changes existing behavior.** Non-public posts disappear from Recommended and Latest — with [`PostVolumeSeeder`](../../../../database/seeders/PostVolumeSeeder.php) weighting 22% of the corpus non-public, that is a visible drop that could be mistaken for a regression |
| One visibility rule for the whole feed. A reader never has to ask which section is safe | Scope beyond this spec's headline; the fix belongs to whoever owns the feed |
| Restricting to `public` is **conservative** — it can only ever show less, never more, so it cannot introduce a new leak | The `connections` visibility tier stays unshown even to actual connections until [connections.md](./connections.md) ships; those posts are invisible to everyone in the interim |

**Option B — Filter visibility only inside `section=following`**

| Pros | Cons |
| :--- | :--- |
| Minimal blast radius; Recommended and Latest behave exactly as today | Leaves the leak open **knowingly**, which is worse than leaving it open unknowingly |
| Fully satisfies this spec's stated obligation — and it is all the committed seeder actually requires, since its AC-13 comment scopes the claim to `section=following` | Two visibility rules inside one query function, which is how the leak becomes permanent — the next section added will copy whichever branch it sits nearest |

**Option C — Change nothing; file the leak as its own spec**

| Pros | Cons |
| :--- | :--- |
| Zero scope creep | The following section would ship leaking, in direct violation of the source doc's rule. Not viable |

**Recommendation: Option A** — but this is a **scope call that is yours to make**, not a technical default. Option B is fully compliant with what this spec owes and is the smaller change; choosing it means accepting a known leak in two sections and writing it down. If you pick B, drop AC-15 from §2.5 and everything else stands. Under either option, `visibility = 'public'` is the filter — the `connections` tier is deferred to §8 because evaluating it needs the connections table.

---

### Decision 5: Who owns the `user_blocks` migration

The source doc's edge case *"User blocks a followed account"* needs a blocks table. [connections.md](./connections.md) Decision 5 already specifies one. Neither spec is built, so the ordering is undecided.

**Option A — `user_blocks` stays owned by [connections.md](./connections.md); this spec depends on it (Recommended)**

| Pros | Cons |
| :--- | :--- |
| One migration, one owner, one definition. Two specs writing `create_user_blocks_table` is a merge conflict and possibly two tables | Creates a build-order dependency between two otherwise independent features |
| Blocking is a platform concern that both specs merely consume — neither should own it exclusively, and the first-written spec is the least arbitrary owner | If following ships first, the migration has to physically move, which is an edit to a merged file |
| Block enforcement here is a read: `AssertNotBlockedAction` semantics identical to connections | |

**Option B — Whichever spec ships first creates it; the other guards with `Schema::hasTable`**

| Pros | Cons |
| :--- | :--- |
| Neither spec blocks the other | Two migration files that must stay byte-compatible, or the second silently no-ops with a divergent shape |
| Mirrors how `FollowVolumeSeeder` already guards on `Schema::hasTable('follows')` | A guard in a *migration* is a much worse idea than a guard in a seeder — it makes the schema depend on execution order |

**Option C — Ship following with no block enforcement**

| Pros | Cons |
| :--- | :--- |
| Fully independent; smallest change | Leaves a stated edge case uncoded. A blocked user could still follow and receive the blocker's public posts in their feed |

**Recommendation: Option A.** If following is built first, move the single `create_user_blocks_table` migration from connections.md §3.2 into this spec's build order and strike it there — a one-line change to an unbuilt spec, versus a permanent structural hazard. Both specs must not create it.

---

### Decision 6: How follower and following counts are computed

**Option A — Live `COUNT(*)` against the indexed `follows` table (Recommended)**

| Pros | Cons |
| :--- | :--- |
| Always correct. No drift, no backfill, no observer to forget | O(rows) per count. `FollowVolumeSeeder` deliberately skews popularity so a few accounts hold tens of thousands of edges — exactly where this degrades |
| No columns beyond the blueprint on `users` or `organizations` | A feed of 15 posts each showing an author follower count is 15 counts unless batched |
| The index `(followable_type, followable_id)` makes single-target counts a covering index scan | |
| Replaces the fabricated `'members_count' => rand(15, 120)` in [`GetCommunityDiscoveryQuery`](../../../../app/Queries/Community/GetCommunityDiscoveryQuery.php) with a real number today, with no migration | |

**Option B — Denormalized `followers_count` on `users` and `organizations`, maintained by a model observer**

| Pros | Cons |
| :--- | :--- |
| O(1) reads regardless of popularity — the right answer at scale | Two counters that can drift from the truth, and drift in a follower count is the kind of bug nobody notices for months |
| Sorting by popularity becomes an indexed column | Needs an observer on every write path plus a reconciliation command; the seeder's `bulkInsert` bypasses Eloquent events entirely, so seeded counts would be **zero** until reconciled |
| | Adds columns to two tables that the blueprint does not list |

**Recommendation: Option A** for v1, with a `withCount` on batched reads so a feed page costs one aggregate query rather than fifteen. Revisit against [performance.md](../../../rules/conditional/performance.md) when a real account crosses ~50k followers; Option B is then a migration plus a backfill, not a redesign.

---

### Decision 7: Whose follower counts and follower lists are public

The source doc is deliberately non-committal — *"View Public Follower Count | Based on Visibility"*, *"Users may have control over whether their followers are publicly visible"*, *"Organizations may publicly display follower counts where appropriate."* No visibility column exists to hang that control on.

**Option A — Organization follower counts are public; user follower data is visible only to that user (Recommended)**

| Pros | Cons |
| :--- | :--- |
| The asymmetry is in the source doc: organizations "may publicly display", users get "control" — and with no settings table, the only safe default for a user is private | A user cannot see their own follower count on someone else's profile view, so social proof for individuals is absent in v1 |
| **Privacy is satisfied by construction**: no endpoint returns another user's follower list or follower count, so there is nothing to leak and no setting to enforce. Same pattern [connections.md](./connections.md) used for connection lists | Adding public user follower counts later is a behavior change users may notice |
| [ORGANIZATION_DISCOVERY.md](../../../blueprint/scaleup/docs/specifications/community/ORGANIZATION_DISCOVERY.md) lists "Followers" as public organization profile content, so org counts are explicitly sanctioned | |

**Option B — Add `users.followers_visibility` now and honor it**

| Pros | Cons |
| :--- | :--- |
| Implements the stated control immediately | Invents a column in `users` that neither the blueprint nor `user_settings` places there — `privacy_preferences` on `user_settings` is where the blueprint puts this, and that table does not exist |
| | Ships a user-facing privacy setting with no settings UI to change it |

**Recommendation: Option A.** It is the only option that needs no invented column, and "no endpoint exposes it" is a stronger privacy guarantee than any flag. When `user_settings` lands, revisit as v2.

---

### Decision 8: Where "View followed entities" lives

**Option A — A `Following` tab on the `/network` page (Recommended)**

- `/network?tab=following`, alongside the Connections · Received · Sent · Discover tabs that [connections.md](./connections.md) Decision 8 specifies.

| Pros | Cons |
| :--- | :--- |
| "My network" is one idea to a user — connections and follows are two views of it, not two destinations | **Depends on `NetworkPage` existing**, which is connections.md's deliverable. If following ships first, this spec must create the page shell |
| Reuses the tab shell, card, and empty-state components rather than duplicating them | Five tabs is the practical ceiling for the segmented control at mobile widths |
| No new route entry — `/network` is already registered in [`community.routes.tsx`](../../../../resources/views/web/src/module/community/route/community.routes.tsx) | Follows and connections are different enough (one-way vs mutual) that a shared card needs a variant |

**Option B — A dedicated `/following` route and page**

| Pros | Cons |
| :--- | :--- |
| **Zero coupling to connections.md** — this spec ships completely independently | Splits "my network" across two nav destinations, and the shell nav has no room budgeted for it |
| Room to grow into followed topics and industries (Future Scope in the source doc) without crowding a tab bar | Duplicates the page shell, list, empty state, and skeleton that `/network` already needs |
| Each page loads exactly one dataset | A new route entry plus a nav item |

**Recommendation: Option A**, with an explicit fallback: **if this spec is built before connections.md, create `NetworkPage` here with the Following tab only**, and connections.md adds its four tabs to the existing shell. Whichever ships second extends rather than replaces. If you would rather the two features stay fully decoupled — a reasonable call given neither is built — take Option B; only §5 and §7 change.

---

## 2.5 Acceptance Criteria

> [!IMPORTANT]
> **AC-6, AC-13, AC-14, and AC-19 are cited by number in committed seeder comments** ([`FollowVolumeSeeder`](../../../../database/seeders/FollowVolumeSeeder.php), [`PostVolumeSeeder`](../../../../database/seeders/PostVolumeSeeder.php)). Do not renumber this table without updating both files.

`U1`, `U2` are active users; `O1` is an organization with `status = 1`; `me` is the authenticated user.

| # | Given | When | Then |
|---|-------|------|------|
| AC-1 | `me` = U1, U2 active, no `follows` row | `POST /api/community/follows` `{"followable_type": "user", "followable_id": U2}` | `200` with `{"data": {"following": true, "created": true, "followable_type": "user", "followable_id": U2}}`; exactly one `follows` row with `follower_id = U1` |
| AC-2 | `me` = U1, O1 has `status = 1` | `POST /api/community/follows` `{"followable_type": "organization", "followable_id": O1}` | `200` with `{"data": {"following": true, "created": true, "followable_type": "organization", "followable_id": O1}}`; one row |
| AC-3 | Row already exists `(U1 → user:U2)`, `me` = U1 (re-follow — Decision 3) | `POST /api/community/follows` `{"followable_type": "user", "followable_id": U2}` | `200` with `{"data": {"following": true, "created": false, ...}}`; still exactly one row, `created_at` unchanged |
| AC-4 | Row exists `(U1 → user:U2)`, `me` = U1 | `DELETE /api/community/follows` `{"followable_type": "user", "followable_id": U2}` | `200` with `{"data": {"following": false, "deleted": true}}`; the row is **hard-deleted** — `SELECT COUNT(*)` for the triple returns `0` (Decision 2) |
| AC-5 | No row exists for `(U1 → user:U2)`, `me` = U1 | `DELETE /api/community/follows` `{"followable_type": "user", "followable_id": U2}` | `200` with `{"data": {"following": false, "deleted": false}}` — idempotent, not `404` (Decision 3) |
| **AC-6** | `me` = U1 | `POST /api/community/follows` `{"followable_type": "user", "followable_id": U1}` | `422` with `{"message": "...", "errors": {"followable_id": ["You cannot follow yourself."]}}`; no row created. **Cited by `FollowVolumeSeeder`** |
| AC-7 | U2 has `users.status = 'inactive'`, `me` = U1 | `POST /api/community/follows` `{"followable_type": "user", "followable_id": U2}` | `404` with `{"message": "User not found."}`; no row created |
| AC-8 | U2 is soft-deleted (`deleted_at` non-null), `me` = U1 | `POST /api/community/follows` `{"followable_type": "user", "followable_id": U2}` | `404` with `{"message": "User not found."}` |
| AC-9 | O1 has `organizations.status = 0` (Disabled), `me` = U1 | `POST /api/community/follows` `{"followable_type": "organization", "followable_id": O1}` | `404` with `{"message": "Organization not found."}`; no row created |
| AC-10 | O1 is soft-deleted, `me` = U1 | `POST /api/community/follows` `{"followable_type": "organization", "followable_id": O1}` | `404` with `{"message": "Organization not found."}` |
| AC-11 | `user_blocks` row exists `(blocker: U2, blocked: U1)`, `me` = U1 (Decision 5) | `POST /api/community/follows` `{"followable_type": "user", "followable_id": U2}` | `404` with `{"message": "User not found."}` — the block is never disclosed; no row created. If a pre-existing `(U1 → user:U2)` row exists, it is deleted so blocked content leaves the feed |
| AC-12 | `me` = U1 follows U2 and O1; posts exist from U2, O1, and unfollowed U3, all `published` + `public` | `GET /api/community/feed?section=following` | `200`; `data.posts` contains U2's and O1's posts and **no** post authored by U3 |
| **AC-13** | `me` = U1 follows U2; U2 has one `public` and one `connections` and one `private` post, all `published` | `GET /api/community/feed?section=following` | `200`; only the `public` post appears. Posts with `visibility` of `connections`, `organization`, or `private` are excluded. **Cited by `PostVolumeSeeder`** |
| **AC-14** | `me` = U1 follows U2; one of U2's public published posts has `deleted_at` set | `GET /api/community/feed?section=following` (and `section=recommended`, `section=latest`) | `200`; the soft-deleted post appears in **no** section. **Cited by `PostVolumeSeeder`** |
| AC-15 | Posts exist with `visibility` of `connections`, `organization`, and `private`, all `published` — **Decision 4 Option A only** | `GET /api/community/feed?section=recommended` and `?section=latest` | `200`; none of the non-public posts appear in either section. *(Omit this row if Decision 4 Option B is chosen.)* |
| AC-16 | `me` = U1 follows U2; U2 has one `draft` and one `archived` public post | `GET /api/community/feed?section=following` | `200`; neither appears — only `status = 'published'` |
| AC-17 | `me` = U1 follows nobody | `GET /api/community/feed?section=following` | `200` with `{"data": {"posts": [], "total": 0, "has_more": false, "next_cursor": null}}` — an empty feed, not an error |
| AC-18 | `me` = U1 follows 3 users and 2 organizations | `GET /api/community/follows` | `200` with `{"data": {"follows": [...5 items...], "total": 5}}`; each item carries `followable_type`, `followable_id`, a `name`, and `followed_at` |
| **AC-19** | A user with `id = 42` **and** an organization with `id = 42` both exist; `me` = U1 follows **only** `organization:42` | `GET /api/community/follows` and `GET /api/community/follows/status?followable_type=user&followable_id=42` | The list contains exactly one item, with `followable_type = "organization"`; the status call returns `{"data": {"following": false}}`. A query filtering `followable_id` without `followable_type` would wrongly return the organization row here. **Cited by `FollowVolumeSeeder`** |
| AC-20 | `me` = U1 follows U2; U2 is then soft-deleted | `GET /api/community/follows` | `200`; the U2 entry is **absent** — every read joins the target and requires it present and active |
| AC-21 | O1 is followed by 7 active users | `GET /api/community/follows/status?followable_type=organization&followable_id=O1` | `200` with `{"data": {"following": <bool>, "followers_count": 7}}` — organization follower counts are public (Decision 7) |
| AC-22 | U2 is followed by 7 users; `me` = U1 (not U2) | `GET /api/community/follows/status?followable_type=user&followable_id=U2` | `200` with `{"data": {"following": <bool>}}` and **no `followers_count` key** — another user's follower count is never exposed (Decision 7) |
| AC-23 | `me` = U1 already follows O1, which is among the suggested organizations | `GET /api/community/suggested-orgs` | `200`; O1's entry has `is_following: true` — populating the field already declared in [`types/community.ts`](../../../../resources/views/web/src/types/community.ts) and currently never sent |
| AC-24 | `me` = U1; two identical `POST /api/community/follows` for `user:U2` arrive concurrently (double-clicked button / network retry) | Both are processed | Exactly **one** `follows` row exists. Both responses are `200`; at most one carries `"created": true`. The unique index on `(follower_id, followable_type, followable_id)` is the guarantee — never two rows |
| AC-25 | Unauthenticated caller (no Sanctum token) | `GET /api/community/follows` | `401` — the routes sit inside the existing `auth:sanctum` group in [`routes/api.php`](../../../../routes/api.php); no follow logic runs |
| AC-26 | `me` = U1 | `POST /api/community/follows` `{"followable_id": U2}` (missing `followable_type`) | `422` with `errors.followable_type` present; no row created |
| AC-27 | `me` = U1 | `POST /api/community/follows` `{"followable_type": "post", "followable_id": 1}` | `422` with `errors.followable_type` present — only `user` and `organization` are accepted; no row created |
| AC-28 | `me` = U1 | `POST /api/community/follows` with `followable_id` of `null`, `0`, `-5`, `"abc"`, and `999999999` (nonexistent) | `422` in the first four cases (`required\|integer\|min:1`); `404` for the nonexistent id. No row created in any case |
| AC-29 | `me` = U1 follows 120 entities | `GET /api/community/follows?per_page=100000` | `200`; at most **50** items returned — `per_page` is clamped to 1–50, defaulting to 15 |
| AC-30 | `me` = U1 follows 120 entities | `GET /api/community/follows?followable_type=organization` | `200`; only organization follows are returned, and `total` reflects the filtered count |

---

## 3. Database

One new migration. `user_blocks` is **not created here** — see Decision 5.

### 3.1 `follows` — new

> This is the section [`FollowVolumeSeeder`](../../../../database/seeders/FollowVolumeSeeder.php) points at by name. Its column list is the contract.

| Column | Type | Notes |
| :--- | :--- | :--- |
| `id` | `id()` | |
| `follower_id` | `foreignId()->constrained('users')->cascadeOnDelete()` | The follower is **always** a user — a real FK, per the ScaleUP convention. **Named `follower_id`, not the blueprint's `user_id`** (§1.1) |
| `followable_type` | `string()->index()` | `'user'` or `'organization'` — plain string, as [`reactions.reactable_type`](../../../../database/migrations/2026_08_12_000003_create_reactions_table.php) does |
| `followable_id` | `unsignedBigInteger()->index()` | **No FK** — polymorphic, Decision 1 |
| `created_at` / `updated_at` | `timestamps()` | The seeder writes both. Rows are never updated in place (Decision 2), so `updated_at` always equals `created_at`; `created_at` is the "following since" value |

Indexes:

```php
$table->unique(['follower_id', 'followable_type', 'followable_id']);  // DATABASE_SCHEMA.md's recommended constraint; backstops the seeder's insertOrIgnore and AC-24
$table->index(['followable_type', 'followable_id']);                  // follower counts and "who follows this org" — Decision 6
$table->index(['follower_id', 'followable_type']);                    // the filtered follows list, AC-30
```

No `softDeletes()` — Decision 2. `cascadeOnDelete` on `follower_id` cleans up when a user is hard-deleted; the **target** side has no cascade, so orphans are possible and are handled by read-time filtering plus the prune command in §8.

**Morph map.** Register `'user' => User::class` and `'organization' => Organization::class` in a service provider's `Relation::enforceMorphMap()` so the stored strings can never drift to fully-qualified class names — the seeder writes the short strings and nothing may rewrite them.

### 3.2 Seed data

None authored here. [`FollowVolumeSeeder`](../../../../database/seeders/FollowVolumeSeeder.php) already exists and becomes live the moment §3.1's migration runs — it needs **no edits**. It is not yet registered in [`DatabaseSeeder`](../../../../database/seeders/DatabaseSeeder.php); wiring it in is step 9 of §7.

---

## 4. Backend

### 4.1 Model — `app/Models/Follow.php` (new)

Follows the `#[Fillable([...])]` PHP-attribute style of [`Reaction`](../../../../app/Models/Reaction.php).

- `#[Fillable(['follower_id', 'followable_type', 'followable_id'])]`
- Constants `TYPE_USER = 'user'`, `TYPE_ORGANIZATION = 'organization'`, and `TYPES` — the allow-list the FormRequest validates against (AC-27).
- `follower()` → `belongsTo(User::class, 'follower_id')`; `followable()` → `morphTo()`.
- `scopeForFollower($q, int $userId)` and `scopeTarget($q, string $type, int $id)` — the latter **always** sets both `followable_type` and `followable_id`, so AC-19's failure mode has one place it could occur and that place is correct.

**`app/Models/User.php`** — **extend, do not rewrite.** Add `follows()` (`hasMany(Follow::class, 'follower_id')`) and `followers()` (`morphMany`-style count relation on `(followable_type = 'user', followable_id = id)`). **`app/Models/Organization.php`** — add `followers()` likewise. Nothing existing changes in either file.

### 4.2 Action — `app/Actions/Community/ResolveFollowableAction.php` (new)

> Named by [`FollowVolumeSeeder`](../../../../database/seeders/FollowVolumeSeeder.php) — this class name is fixed.

Static `execute(['type' => string, 'id' => int, 'user' => User])`. The single gate every follow passes through; returns the resolved `User` or `Organization`, or throws:

1. `type` is `user` and `id === user->id` → `422` "You cannot follow yourself." (AC-6).
2. `type = 'user'` → the user exists, `status = 'active'`, `deleted_at` null → else `404` "User not found." (AC-7, AC-8).
3. `type = 'organization'` → the org exists, `status = 1`, `deleted_at` null → else `404` "Organization not found." (AC-9, AC-10).
4. No `user_blocks` row in **either** direction between `user` and a `user`-type target → else `404` "User not found." (AC-11). Skipped entirely when `user_blocks` does not yet exist (Decision 5 ordering).

Step order matters: the block check yields `404`, never a distinguishable message, so a blocked user cannot detect the block.

### 4.3 Queries — `app/Queries/Community/`

| Class | Returns |
| :--- | :--- |
| `GetUserFollowsQuery` (new) | `['follows' => [...], 'total' => int]`. Joins each row to its target by **type and id together**, dropping targets that are missing, inactive, or soft-deleted (AC-19, AC-20). Optional `followable_type` filter (AC-30); `per_page` clamped 1–50 (AC-29). Resolves users via `full_name` and organizations via `name`, batched per type — never one query per row ([performance.md](../../../rules/conditional/performance.md)). |
| `GetFollowStatusQuery` (new) | `['following' => bool]`, plus `followers_count` **only** when the target is an organization (AC-21, AC-22). Powers every Follow button. |
| `GetCommunityFeedQuery` (**extend**) | Adds `section = 'following'`: restricts to authors the user follows, matched on `(author_type, author_id)` against `(followable_type, followable_id)` (AC-12, AC-17). Applies the `visibility = 'public'` filter per Decision 4 (AC-13, and AC-15 under Option A). `status = 'published'` and the `SoftDeletes` global scope already cover AC-14 and AC-16 — verify, do not re-add. |
| `GetCommunityDiscoveryQuery` (**extend**) | Populates `is_following` on each `suggested_orgs` entry (AC-23) and replaces `'members_count' => rand(15, 120)` with the real follower count (Decision 6). Minimal diff — [incremental-generation](../../../rules/conditional/code-quality.md). |

### 4.4 Handlers — `app/Handlers/Community/`

Both extend `Handler` with static `execute($params = [])`, matching [`ToggleReactionHandler`](../../../../app/Handlers/Community/ToggleReactionHandler.php).

| Class | Behavior |
| :--- | :--- |
| `FollowEntityHandler` | Runs `ResolveFollowableAction`, then `firstOrCreate` on the triple. Returns `['following' => true, 'created' => <bool>]` (AC-1, AC-2, AC-3). Catches the unique-index violation and re-reads, so the concurrent loser returns `200` with `created: false` rather than a 500 (AC-24). |
| `UnfollowEntityHandler` | Hard-deletes the matching row; returns `['following' => false, 'deleted' => <bool>]`. Deleting nothing is success (AC-4, AC-5). Does **not** run `ResolveFollowableAction` — a user must always be able to unfollow a target that has since gone inactive or blocked them. |

### 4.5 Controller — `app/Http/Controllers/Community/FollowController.php` (new)

Thin, one Query/Handler call per method, `response()->json(['data' => ...])`, no API Resources. Adopts the same typed-exception mapping [connections.md](./connections.md) Decision 9 introduces (`404`, `422` via FormRequest, `400` fallback) rather than the blanket `400` used by [`CommunityController`](../../../../app/Http/Controllers/Community/CommunityController.php). No `403` and no `409` arise here — following is unilateral (Decision 3) and every rejection is either validation or not-found.

The `created` / `deleted` booleans in the response body are what let the client distinguish a real change from a no-op under Decision 3's idempotency.

### 4.6 Request — `app/Http/Requests/Community/FollowEntityRequest.php` (new)

Follows [`ToggleReactionRequest`](../../../../app/Http/Requests/Community/ToggleReactionRequest.php): `authorize()` returns `Auth::check()`.

```php
'followable_type' => ['required', 'string', Rule::in(Follow::TYPES)],
'followable_id'   => ['required', 'integer', 'min:1'],
```

Existence is checked in the Action, not by `exists:`, because the table depends on `followable_type` and the failure must be `404` rather than `422` (AC-28). The self-follow message is supplied by `messages()`. Covers AC-26, AC-27, AC-28.

### 4.7 Routes — append to [`routes/api/community.php`](../../../../routes/api/community.php)

Already inside the `auth:sanctum` + `community` prefix group, so AC-25 holds with no extra middleware.

```php
Route::get('/follows', [FollowController::class, 'index']);
Route::get('/follows/status', [FollowController::class, 'status']);
Route::post('/follows', [FollowController::class, 'store']);
Route::delete('/follows', [FollowController::class, 'destroy']);
```

`GET /follows` is the endpoint [`FollowVolumeSeeder`](../../../../database/seeders/FollowVolumeSeeder.php) names. Register `/follows/status` before any future `/follows/{id}` to avoid segment capture. `DELETE` carries a body rather than a path id — the client identifies a follow by its target, which is what a toggle button actually has in hand.

---

## 5. Frontend

Assumes Decision 8 Option A. Module: `resources/views/web/src/module/community/network/`, the folder [connections.md](./connections.md) §5 defines — this spec **adds to it** rather than creating a parallel one.

```
module/community/network/
├── api/follow.api.ts               # NEW — http from '@/app/axios/http'
├── components/
│   ├── FollowButton.jsx            # NEW — Follow / Following toggle, optimistic
│   ├── FollowingList.jsx           # NEW — rows for followed users + organizations
│   └── NetworkTabs.jsx             # EXTEND — adds the 5th tab (connections.md owns the file)
├── hooks/useFollows.js             # NEW — list fetch + optimistic follow/unfollow
├── mocks/followMocks.ts            # NEW — Gate 1 fixtures
└── pages/NetworkPage.jsx           # EXTEND — renders the Following tab
```

> **If this spec is built before [connections.md](./connections.md)**, create `NetworkPage.jsx` and `NetworkTabs.jsx` here with the Following tab only; connections.md then adds its four tabs to the existing shell. Whichever ships second extends rather than replaces.

**Feed integration.** [`FeedTabs.jsx`](../../../../resources/views/web/src/module/community/home/components/FeedTabs.jsx) currently renders two tabs (Recommended, Latest) from a local `tabs` array. Add a third — `{ id: 'following', label: 'Following', icon: UserCheck }`. `FeedSection` in [`types/community.ts`](../../../../resources/views/web/src/types/community.ts) **already includes `'following'`**, so no type change is needed. `useCommunityFeed` passes `section` through untouched.

**Existing file to make real.** [`SuggestedOrgsCard.jsx`](../../../../resources/views/web/src/module/community/home/components/rail/SuggestedOrgsCard.jsx) holds follow state in `useState` and discards it on refresh. Replace `handleToggleFollow` with `FollowButton`, seeded from the `is_following` field AC-23 adds. Delete the local `followingMap` — it is the stub this spec exists to retire.

**Design system.** Reuse `@/src/components/ui` primitives and the tokens in [`resources/css/app.css`](../../../../resources/css/app.css). No new primitives, no new colors — [ui-design.md](../../../rules/conditional/ui-design.md).

**API contract** (`follow.api.ts` — same `ApiResponse<T>` envelope and mock-fallback pattern as [`community.api.ts`](../../../../resources/views/web/src/module/community/home/api/community.api.ts)):

| Method | Endpoint | Payload / Params |
| :--- | :--- | :--- |
| `getFollows` | `GET /api/community/follows` | `{ followable_type?, per_page? }` |
| `getFollowStatus` | `GET /api/community/follows/status` | `{ followable_type, followable_id }` |
| `follow` | `POST /api/community/follows` | `{ followable_type, followable_id }` |
| `unfollow` | `DELETE /api/community/follows` | `{ followable_type, followable_id }` (body) |

**`FollowButton` states** — deliberately simpler than connections' `ConnectButton`, because there is no pending state to represent:

| Backend `following` | Label | Action | Disabled while in flight |
| :--- | :--- | :--- | :--- |
| `false` | **Follow** (primary) | `follow` | ✅ — the UI half of AC-24 |
| `true` | **Following** (secondary, check icon) | `unfollow` | ✅ |

Optimistic: flip on click, revert on error. Because both calls are idempotent (Decision 3), a retry after a timeout is always safe — no confirmation dialog on unfollow, unlike removing a connection.

**Layout sketch** — `/network?tab=following`:

```
┌──────────────────────────────────────────────────────────┐
│  Network                                                 │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Connections │ Received │ Sent │ Following (23) │ …  │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │  All  │  People  │  Organizations                  │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │ ▣  Nexus Health Ecosystem              [Following ✓]│  │
│  │    Healthcare & MedTech · 1,204 followers           │  │
│  ├────────────────────────────────────────────────────┤  │
│  │ ◯  Elena Rostova                       [Following ✓]│  │
│  │    Head of Supply Chain @ Peak Logistics            │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

The inner All/People/Organizations filter maps to the `followable_type` param (AC-30). Follower counts render only on organization rows (Decision 7). Below `lg`, tabs scroll horizontally and the button moves under the subtitle.

---

## 6. Business Rules & Edge Cases

### 6.1 Business rules — from [FOLLOWING.md](../../../blueprint/scaleup/docs/specifications/community/FOLLOWING.md)

| # | Rule | Where it is enforced | AC |
| :--- | :--- | :--- | :--- |
| BR-1 | A user cannot follow themselves | `FollowEntityRequest` + `ResolveFollowableAction` step 1 | AC-6 |
| BR-2 | A user may follow an organization | `ResolveFollowableAction` step 3 | AC-2 |
| BR-3 | Following does **not** create organization membership | Structural: nothing writes `organization_members`, and no membership check reads `follows` | AC-2 (no member row appears) |
| BR-4 | Following does **not** grant private access | Structural: the only content the following section serves is `visibility = 'public'`, `status = 'published'` posts. No policy, gate, or middleware may consult `follows` | AC-13 |
| BR-5 | A user may unfollow at any time | `UnfollowEntityHandler`, which deliberately skips `ResolveFollowableAction` so an inactive or blocking target can still be unfollowed | AC-4, AC-5 |
| BR-6 | Private or non-discoverable profiles cannot be followed — defined here as user `status = 'active'` / org `status = 1`, not soft-deleted, and not blocked (no visibility column exists; §1.2) | `ResolveFollowableAction` steps 2–4 | AC-7, AC-8, AC-9, AC-10, AC-11 |
| BR-7 | Following must not override content visibility or access restrictions | `GetCommunityFeedQuery` — the `visibility = 'public'` filter (Decision 4) | AC-13, AC-15 |

### 6.2 Edge cases — from the source doc

| Edge case | Handling |
| :--- | :--- |
| Followed account becomes private | No visibility column exists, so the analogous case is inactivation: the row survives but is filtered from every read (AC-20) and the target's posts leave the following feed because the author join requires active |
| Followed organization becomes inactive | Same — `status = 0` removes it from the follows list and its posts from the feed (AC-9, AC-20) |
| User blocks a followed account | New follows are refused as `404` and any existing row is deleted, so blocked content leaves the feed immediately (AC-11). Requires `user_blocks` — Decision 5 |
| Followed content is deleted | The `SoftDeletes` global scope on `Post` removes it from every section (AC-14) |
| User unfollows while viewing the feed | The feed is not live-refetched on unfollow; already-rendered posts remain until the next fetch. `FollowButton` flips immediately, so the button and the feed disagree for one page view — accepted, and cheaper than invalidating the feed on every toggle |
| Follower or target hard-deleted | `follower_id` cascades; a hard-deleted **target** leaves an orphan row that read-time filtering hides (AC-20) and the prune command in §8 removes |
| A user id and an organization id collide | Every query filters type and id together via `scopeTarget` (AC-19) — the case `FollowVolumeSeeder` engineers overlapping id ranges to expose |

### 6.3 Non-Functional & Failure-Mode Checklist

| Category | Answer |
| :--- | :--- |
| **Authorization** | Every route sits inside the existing `auth:sanctum` group; unauthenticated → `401` (AC-25). **Community-side only** — no organization role, permission, or membership is consulted, and no portal boundary is crossed. Per action: any authenticated user may follow any *followable* target (BR-6) — there is no approval, so there is no per-target authorization beyond followability. **Writes are self-scoped by construction**: `follower_id` is always taken from `$request->user()` and is never accepted from the payload, so one user cannot create or delete another user's follow. Reads are likewise scoped to the caller — `GET /follows` returns only the caller's own rows, and `GET /follows/status` discloses `followers_count` only for organizations (AC-22). Rejections: `404` `{"message": "User not found."}` / `{"message": "Organization not found."}`; `422` for validation. |
| **Concurrency / double-submit** | Two simultaneous follows for the same triple: `unique(follower_id, followable_type, followable_id)` admits exactly one; the loser's constraint violation is caught and re-read, returning `200` with `created: false` (AC-24). Double-clicked Follow: the button disables while in flight (§5). Simultaneous follow + unfollow: whichever transaction commits last wins, and both return their own truthful state — no lost-update risk because neither operation reads-then-writes a mutable field, they insert or delete a whole row. Bulk seeding uses `insertOrIgnore` against the same index. |
| **Idempotency on retries** | Both operations are idempotent by design (Decision 3). A replayed **follow** cannot create a second row — the unique triple is the key — and returns `200` with `created: false` (AC-3). A replayed **unfollow** returns `200` with `deleted: false` (AC-5). There are no counters, amounts, or ledger rows to double; follower counts are computed live from the row set (Decision 6), so they cannot drift under replay. |
| **Error response shape & status codes** | `422` → Laravel FormRequest shape `{"message": ..., "errors": {...}}` for missing/invalid `followable_type`, out-of-range `followable_id`, and self-follow (AC-6, AC-26, AC-27, AC-28). `404` → `{"message": "User not found."}` or `{"message": "Organization not found."}` for absent, inactive, soft-deleted, or blocking targets (AC-7 … AC-11, AC-28). `401` from middleware (AC-25). `400` → `{"message": <exception message>}` as the unchanged fallback. **No `403`** — there is no forbidden-but-existing case, since blocks are disclosed as `404`. **No `409`** — Decision 3 makes duplicates a success. Success → `200` with `{"data": ...}`. |
| **Input validation boundaries** | `followable_type`: missing → `422` (AC-26); `null`, empty string, or any value outside `user`/`organization` (e.g. `"post"`, `"User"`, `"App\\Models\\User"`) → `422` (AC-27) — the check is a strict `Rule::in`, so casing and FQCNs are rejected. `followable_id`: missing/`null` → `422`; `0` and negatives → `422` via `min:1`; non-numeric string → `422`; a well-formed but nonexistent id → `404` from the Action, not `422` (AC-28); own id with `type = user` → `422` (AC-6). `per_page`: clamped to 1–50 server-side, so oversized and zero values are absorbed rather than rejected (AC-29). `followable_type` as a **filter** on `GET /follows`: absent means no filter; an invalid value → `422` (AC-30). |

---

## 7. Build Order

Dependency-first. Steps 1–3 are Gate 1 (design against fixtures); 4–10 are Gate 2 (live data).

1. **Migration** `create_follows_table` — §3.1, with the unique triple and both composite indexes. *(If `user_blocks` does not exist yet and Decision 5's fallback applies, move that migration here from [connections.md](./connections.md) §3.2 and strike it there.)*
2. **Frontend Gate 1** — `followMocks.ts`, `FollowButton`, `FollowingList`, `useFollows`; add the Following tab to `NetworkTabs`/`NetworkPage` (or create both, per Decision 8's fallback); add the Following tab to `FeedTabs`. Fixtures only.
3. **Validate the design** against §5 before any wiring. ← **Gate**
4. **Model** — `Follow` with constants and scopes; register the morph map; extend `User` and `Organization` with follower relations.
5. **Action** — `ResolveFollowableAction`, four checks in the stated order. *(The name is fixed by the committed seeder.)*
6. **Request** — `FollowEntityRequest`.
7. **Handlers** — `FollowEntityHandler`, `UnfollowEntityHandler`.
8. **Queries + Controller + Routes** — `GetUserFollowsQuery`, `GetFollowStatusQuery`, `FollowController`, the four route lines (§4.7).
9. **Extend the two existing queries** — `GetCommunityFeedQuery` gets `section=following` plus the Decision 4 visibility filter; `GetCommunityDiscoveryQuery` gets `is_following` and the real follower count. Register [`FollowVolumeSeeder`](../../../../database/seeders/FollowVolumeSeeder.php) in [`DatabaseSeeder`](../../../../database/seeders/DatabaseSeeder.php) and run it — it needs no edits.
10. **Wire the frontend** — swap `followMocks` for `follow.api.ts`; replace `SuggestedOrgsCard`'s local `followingMap` with `FollowButton`. Run `npm run typecheck`.

---

## 8. Out of Scope (Future Specs)

- **Notifications** for new posts from followed accounts and organization announcements. The `notifications` table does not exist; the source doc says following *may optionally* generate them, so deferring is compliant. `notification_preferences` — the "users should control these preferences" requirement — is the same spec.
- **Feed ranking.** The source doc says followed content "may receive higher relevance". This spec adds a `following` **section**, not a relevance boost to Recommended — ranking is [COMMUNITY_FEED.md](../../../blueprint/scaleup/docs/specifications/community/COMMUNITY_FEED.md)'s concern, and `GetCommunityFeedQuery`'s `recommended` branch is currently a plain `orderByDesc('created_at')` with no scoring to boost.
- **The `connections` visibility tier in the feed.** Decision 4 filters to `visibility = 'public'` only; serving `visibility = 'connections'` posts to actual connections needs the `connections` table from [connections.md](./connections.md). Revisit as v2 once both ship.
- **Non-public visibility in Recommended and Latest**, if Decision 4 Option B is chosen — the leak then needs its own spec, and that decision must be written down rather than left implicit.
- **User follower counts and follower lists** — Decision 7 keeps them private in v1. Making them public needs `user_settings.privacy_preferences`, which does not exist.
- **Denormalized follower counters** — Decision 6 Option B, when a target crosses ~50k followers.
- **An orphan-prune command** (`php artisan follows:prune`) removing rows whose polymorphic target was hard-deleted. Decision 1's accepted cost; harmless until hard deletes become routine.
- **Topic, industry, and hashtag following, and personalized recommendations** — all Future Scope in the source doc, and all would extend `followable_type` rather than add tables.
- **Organization discovery directory and public organization profiles** — [ORGANIZATION_DISCOVERY.md](../../../blueprint/scaleup/docs/specifications/community/ORGANIZATION_DISCOVERY.md). This spec makes the Follow button on `SuggestedOrgsCard` real; the directory it should link to does not exist, and `/profile/:slug` is still `PlaceholderCommunityPage`.
- **Correcting [DATABASE_SCHEMA.md §5](../../../blueprint/scaleup/docs/DATABASE_SCHEMA.md)** — rename `follows.user_id` to `follower_id` and add `updated_at`, to match the committed seeder and §3.1. A documentation task, but leaving the doc wrong is how the next spec gets it wrong.

---

## 9. Definition of Done

- [ ] Every row in the **Acceptance Criteria** table passes (AC-1 … AC-30; AC-15 only if Decision 4 Option A was chosen)
- [ ] **AC-6, AC-13, AC-14, and AC-19 still mean what [`FollowVolumeSeeder`](../../../../database/seeders/FollowVolumeSeeder.php) and [`PostVolumeSeeder`](../../../../database/seeders/PostVolumeSeeder.php) say they mean** — if any row was renumbered, both seeders' comments were updated in the same change
- [ ] `php artisan db:seed --class=FollowVolumeSeeder` runs against the new table **without edits to the seeder**, and the resulting graph has the skewed follower distribution its docblock describes
- [ ] Every category in the **Non-Functional & Failure-Mode Checklist** is addressed — answered or explicitly `N/A because ...`
- [ ] BR-3 and BR-4 verified by inspection: no policy, gate, middleware, or membership check anywhere reads the `follows` table, and no query outside `app/{Models,Queries,Handlers,Actions,Http}/**/Community*` touches it
- [ ] `SuggestedOrgsCard`'s local `followingMap` state is gone, and its Follow button survives a page refresh
- [ ] `npm run typecheck` passes (ScaleUP has no Vitest configured — see [project-gate.md](../../../rules/core/project-gate.md))
- [ ] The migration runs and rolls back cleanly on MySQL **and** SQLite
- [ ] No open findings from adversarial verification — see the latest `.agents/reports/community-following-verify-<date>.md`

<!-- Changelog -->
<!-- v1 — 2026-08-14 — initial -->
