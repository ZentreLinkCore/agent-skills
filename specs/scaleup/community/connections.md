# Spec — Connections (Professional Relationships)

> **Kind:** Greenfield — no `connections` table, model, route, or page exists. The `/network` route is registered but renders `PlaceholderCommunityPage`.
> **Portal:** **Community** (`/api/community/connections/...` routes, `community` frontend module).
> **Version:** v1 — 2026-08-14 — initial.
> **Route:** `/network` (already registered in [`community.routes.tsx`](../../../../resources/views/web/src/module/community/route/community.routes.tsx) — this spec replaces its placeholder element).
> **Conventions:** [project-profile.md](../../../rules/project-profile.md) (ScaleUP Profile — React 19, real FKs, `<parent>_id`, `deleted_at`), [ui-design.md](../../../rules/ui-design.md), [design_system.md](../design/design_system.md), [CONNECTIONS.md](../../../blueprint/scaleup/docs/specifications/community/CONNECTIONS.md), [DATABASE_SCHEMA.md §5](../../../blueprint/scaleup/docs/DATABASE_SCHEMA.md), [community_shell.md](./community_shell.md), [community_home.md](./community_home.md).
> **System Awareness:** Models — **reused** `User`; **created** `Connection`, `UserBlock`. Tables — **created** `connections`, `user_blocks`; `users` unchanged. Routes — **extended** [`routes/api/community.php`](../../../../routes/api/community.php) (already mounted under `auth:sanctum` + `community` prefix in [`routes/api.php`](../../../../routes/api.php)); no existing endpoint covers connections. Controllers — **created** `Community/ConnectionController`; `CommunityController` untouched except via the discovery query below. New migration: **yes** — two.

---

## 1. Purpose

A **Connection** is a mutual, accepted professional relationship between two Individual Users. It is the substrate the Community platform is missing: today [`GetCommunityDiscoveryQuery`](../../../../app/Queries/Community/GetCommunityDiscoveryQuery.php) reports `'network_count' => 142` and `'mutual_connections' => rand(3, 18)` because there is nothing real to count. Every network figure the product shows a user is currently fabricated.

This spec builds the relationship itself — request, accept, decline, cancel, remove, view — and the state machine that keeps both participants' view of it consistent.

Three boundaries matter, and the blueprint states all three explicitly:

- A connection is **not** organization membership. Two users connect without sharing an organization ([CONNECTIONS.md](../../../blueprint/scaleup/docs/specifications/community/CONNECTIONS.md) Overview).
- A connection is **not** a follow. Following is one-way and lives in [FOLLOWING.md](../../../blueprint/scaleup/docs/specifications/community/FOLLOWING.md); connections are mutual and require consent.
- **A connection grants no data access.** It does not open private organization or business data, and it does not by itself grant messaging permission ([MESSAGING.md](../../../blueprint/scaleup/docs/specifications/community/MESSAGING.md) owns that). Nothing in this spec may be used as an authorization check by another module.

### Two gaps the scan found, and how this spec answers them

The source specification depends on platform surfaces that **do not exist in this codebase or in the blueprint schema**. These are called out here because the implement skills would otherwise invent them:

| The source doc requires | Reality in the repo | This spec's answer |
| :--- | :--- | :--- |
| "A connection request may only be sent to a **discoverable** user" | `user_profiles.visibility` is in [DATABASE_SCHEMA.md §1](../../../blueprint/scaleup/docs/DATABASE_SCHEMA.md) but the table and model **do not exist**. Only `users.status` (`'active'`) and `users.deleted_at` exist. | Discoverable is defined as `status = 'active' AND deleted_at IS NULL AND not blocked in either direction` — §6. Profile-visibility refinement is deferred (§8). |
| "**Blocked** relationships must prevent unauthorized connection requests" | There is **no `blocks` table anywhere** — not in the repo, not in DATABASE_SCHEMA.md — yet four community specs depend on blocking. | Decision 5 creates `user_blocks` and enforces it here; the block/unblock **endpoints** belong to a future spec. |
| "Connection activity **may** generate notifications" | `notifications` is specified in the blueprint but the table does not exist. | Out of scope (§8). The source doc says *may*, so deferring does not violate it. |

---

## 2. Design Decisions (Pros & Cons)

### Decision 1: Row shape — one directional row, or two mirrored rows

The source doc's hardest rule is *"Connection status must be consistent for both participants."* How the row is stored decides whether that is guaranteed or merely intended.

**Option A — One directional row: `requester_id` + `recipient_id` (Recommended)**

- A single `connections` row per relationship. Direction is preserved by which column holds which user, which is what makes *accept* vs *cancel* distinguishable.

| Pros | Cons |
| :--- | :--- |
| Exactly what [DATABASE_SCHEMA.md §5](../../../blueprint/scaleup/docs/DATABASE_SCHEMA.md) specifies — `requester_id`, `recipient_id`, `status`, `accepted_at` | Every read query needs `where(requester_id = me).orWhere(recipient_id = me)` — easy to write incorrectly, and easy to forget the `orWhere` grouping |
| Status consistency is **structural**: there is one row, so there is one status. The rule cannot be violated | "The other user" must be resolved per row rather than read from a column |
| Direction is stored, so *who may accept* and *who may cancel* are answerable from the row alone | |
| One row per relationship — no write amplification, no drift between halves | |

**Option B — Two mirrored rows (one per participant, each with `user_id` + `related_user_id`)**

| Pros | Cons |
| :--- | :--- |
| Reads are trivial: `where('user_id', $me)` — no `orWhere`, and "the other user" is a plain column | **Directly contradicts the consistency rule.** Two rows can disagree; every write must update both inside a transaction, and any missed path silently desynchronizes the two users' views |
| Per-user pagination and counting are simpler | Doubles storage and every write |
| | Diverges from the blueprint schema, so the schema doc would need rewriting |

**Recommendation: Option A.** The consistency rule is the point of the feature, and Option A satisfies it by construction rather than by discipline. The `orWhere` awkwardness is contained by putting it in a single query scope (`Connection::scopeInvolving($userId)`) that every read uses.

---

### Decision 2: Preventing duplicate and reciprocal requests

This is the subtle one. `unique(requester_id, recipient_id)` looks sufficient and **is not**: it stops A→B twice, but happily allows A→B *and* B→A to both exist as pending. That produces two pending requests for one relationship — a direct violation of *"Duplicate active connection requests are not allowed."*

The fix is to make the **unordered pair** unique, not the ordered one.

**Option A — Stored generated columns `user_min_id` / `user_max_id` + `unique(user_min_id, user_max_id)` (Recommended)**

- `$table->unsignedBigInteger('user_min_id')->storedAs('LEAST(requester_id, recipient_id)')` and the `GREATEST` counterpart, with a unique index across the pair. At most one `connections` row can ever exist for any two users, in either direction.

| Pros | Cons |
| :--- | :--- |
| **The database enforces it.** No application path, race, retry, or future developer can create a second row for a pair | Generated columns are DB-level; altering them later needs a migration, not a code change |
| Closes the A→B / B→A race with zero locking — two concurrent inserts, one wins with a constraint violation | Supported on MySQL 5.7+, SQLite 3.31+, PostgreSQL 12+. This repo uses MySQL (`.env`) and SQLite (`.env.example`), so both are covered — but it is a portability commitment |
| Makes Decision 3 (reciprocal) and Decision 4 (re-request) trivially correct — there is only ever one row to find | Terminal rows (`declined`, `removed`) occupy the pair's only slot, so re-requests **must** reuse the row (which is Decision 4's recommendation anyway) |

**Option B — Plain `user_min_id` / `user_max_id` columns written by the application**

| Pros | Cons |
| :--- | :--- |
| No generated-column dependency; portable to any driver | Correctness depends on every write path remembering to set them. One `Connection::create()` that forgets, and the unique index silently protects nothing |
| Same unique index, so concurrent inserts still collide | Adds two columns the developer must keep in sync with two others — exactly the kind of duplication [coding-standards](../../../rules/coding-standards.md) warns against |

**Option C — `unique(requester_id, recipient_id)` only, plus an application check inside a locked transaction**

| Pros | Cons |
| :--- | :--- |
| Schema stays exactly as the blueprint lists it — no extra columns | The reciprocal case is guarded only by application code holding a lock. `lockForUpdate()` on a row that **does not exist yet** does not block a concurrent insert on MySQL InnoDB without gap locking, so the race is real, not theoretical |
| Simplest migration | A duplicate pair, once created, is invisible until a user sees two conflicting requests |

**Recommendation: Option A.** It is the only option where the "no duplicates" rule survives contact with concurrency, and the two extra columns are maintained by the database rather than by developers. Note this **adds two columns beyond DATABASE_SCHEMA.md §5** — the schema doc should be updated to match once this ships.

---

### Decision 3: What happens when B requests A while A→B is already pending

Under Decision 2 there is exactly one row per pair, so this case must produce a defined outcome rather than a second row.

**Option A — Auto-accept: the reciprocal request completes the connection (Recommended)**

- B "sending" a request to A, when A→B is pending, transitions the existing row straight to `accepted`.

| Pros | Cons |
| :--- | :--- |
| It is what both users actually meant — each independently asked for the relationship. Requiring one of them to now go find an inbox item is friction with no purpose | The acting user pressed "Connect" and got "Connected" — a different result than they were shown. Needs a clear UI response, not a silent state change |
| The `requester_id` on the row stays A, so history remains truthful about who asked first | Slightly surprising if the pending request was old and forgotten |
| No error state to design, no dead end | |

**Option B — Reject with `409 Conflict`**

| Pros | Cons |
| :--- | :--- |
| Strictly predictable: one action, one outcome, no hidden transitions | Tells the user "conflict" when the honest answer is "you two agree" |
| Forces the pending request through the explicit accept path, so `accepted_at` always follows a deliberate accept | The client must then explain *why* it failed and redirect to the inbox — more UI for a worse outcome |

**Recommendation: Option A**, with the API returning the resulting `accepted` connection and a distinguishing `outcome: "auto_accepted"` field so the UI can say "You're now connected with X" instead of "Request sent". This is a **business-policy call** — if the product wants every acceptance to be an explicit act, Option B is the correct choice and nothing else in this spec changes.

---

### Decision 4: What happens to declined, cancelled, and removed relationships

**Option A — Keep the row, set a terminal status, reuse it on re-request (Recommended)**

- `declined` / `cancelled` / `removed` are statuses on the surviving row. A later request updates that same row back to `pending` with a fresh `requester_id`.

| Pros | Cons |
| :--- | :--- |
| Required by Decision 2 — the pair's unique slot is taken, so re-request must reuse | The row's `created_at` reflects the *first* request, not the current one, so "requested on" must read `updated_at` for re-requests |
| Preserves relationship history, matching [DATABASE_SCHEMA.md](../../../blueprint/scaleup/docs/DATABASE_SCHEMA.md) "Historical Integrity" | A user who declined can be re-requested immediately — no cooldown. If the product wants one, it is a rule on top of this, not a different option |
| A decline stays private: the requester sees only that the request is no longer pending | |

**Option B — Hard-delete the row on decline/cancel/remove**

| Pros | Cons |
| :--- | :--- |
| The pair slot frees up; re-request is a plain insert | Destroys history — no way to answer "have these two ever been connected?", and no basis for any future cooldown or abuse rule |
| Table stays small | A removed connection and a never-existing one become indistinguishable |

**Option C — `softDeletes()` on terminal transitions**

| Pros | Cons |
| :--- | :--- |
| Matches the ScaleUP convention that `deleted_at` means erasure | Conflicts with the unique index: a soft-deleted row still occupies the pair slot, so re-request breaks anyway — Option A with extra steps |

**Recommendation: Option A.** No `softDeletes()` on this table: `status` carries the lifecycle, exactly as the comment in [`create_organization_members_table`](../../../../database/migrations/2026_08_11_060004_create_organization_members_table.php) distinguishes operational state from erasure. `connections` is also absent from the blueprint's soft-delete list.

---

### Decision 5: Where blocking lives

Four community specs assume blocking exists. Nothing implements it, and the blueprint schema has no table for it. Connections cannot satisfy its own rule without an answer.

**Option A — New `user_blocks` table; this spec enforces it, a future spec owns block/unblock (Recommended)**

| Pros | Cons |
| :--- | :--- |
| Blocking is a **platform** concern — messaging, posts, reactions, and the feed all need it. It does not belong inside the connections state machine | Adds a table this spec does not fully own, and ships it without write endpoints (rows exist only via seeder/tinker until the blocking spec lands) |
| Directional and independent of connection state: A can block B whether or not they were ever connected | Requires updating DATABASE_SCHEMA.md, which currently omits it |
| Every other module can adopt the same table instead of inventing its own | |

**Option B — `blocked` as a `connections.status` value**

| Pros | Cons |
| :--- | :--- |
| No new table; the source doc does list `Blocked` among connection states | **Structurally wrong.** Blocking is directional and one-sided; a connection row is a shared, mutual object. Storing "A blocked B" in a row that also represents "A and B are connected" cannot express "A blocked B while B did not block A" |
| One place to look for the pair's state | Consumes the pair's unique slot, so a block would erase connection history |
| | Messaging and posts would have to read the *connections* table to answer a blocking question — coupling two unrelated modules |

**Option C — Defer blocking entirely; ship connections without enforcement**

| Pros | Cons |
| :--- | :--- |
| Smallest possible change | Leaves a stated rule uncoded, which is precisely the failure mode [webkit.verify](../../../../.claude/skills/webkit.verify/SKILL.md) exists to catch. It would ship as a known hole |

**Recommendation: Option A.** The `blocked` state in the source doc describes a *relationship condition*, not a connection status — it is correctly modeled as a separate directional fact. Enforcement is read-only here; §8 records that block/unblock endpoints are a future spec's job.

---

### Decision 6: How `status` is stored

**Option A — `string` column with an application-side allow-list (Recommended)**

| Pros | Cons |
| :--- | :--- |
| Matches [DATABASE_SCHEMA.md](../../../blueprint/scaleup/docs/DATABASE_SCHEMA.md) (`status`) and the existing `users.status` string precedent | Wider column than an integer; no DB-level restriction on values |
| Five states (`pending`, `accepted`, `declined`, `cancelled`, `removed`) are self-describing in a raw query — a tinyint would need a legend | Typos are caught only by validation and by developer care |
| Adding a state later needs no migration | |

**Option B — `tinyInteger` with a comment, as `organization_members.status` uses**

| Pros | Cons |
| :--- | :--- |
| Consistent with the sibling membership table; compact and fast to index | That column is binary (1=Active, 0=Removed) — a legend is cheap for two values and expensive for five |
| | Every read of the raw table requires the legend; a five-value integer state machine is a known source of off-by-one bugs |

**Recommendation: Option A.** The repo has both precedents, so neither is a violation; five named states are the deciding factor. The allow-list lives in one place — `Connection::STATUSES` — and the FormRequest validates against it.

---

### Decision 7: Request expiry

The source doc lists "Connection request expires" as an edge case but the blueprint schema defines no expiry field.

**Option A — Requests do not expire in v1 (Recommended)**

| Pros | Cons |
| :--- | :--- |
| Honest and testable: the edge case gets a definite documented answer rather than half an implementation | A pending request can sit forever; the recipient's inbox grows without bound |
| A pending request is always cancellable by the requester and declinable by the recipient — neither party is stuck | The source doc's edge case is answered by policy, not by mechanism |
| No scheduler, no new column, no background job on infrastructure that does not run today | |

**Option B — Derived expiry: `pending` rows older than N days read as expired**

| Pros | Cons |
| :--- | :--- |
| No job needed — the cutoff is applied in the query | Two sources of truth for one status: the stored value says `pending`, the API says `expired`. Every future reader must remember the rule |
| Bounded inbox | Picking N is an unbacked product guess |

**Option C — Scheduled job flips `pending` → `expired`**

| Pros | Cons |
| :--- | :--- |
| Stored status is always the true status | Needs a running scheduler and a sixth state; nothing in the repo schedules anything today |

**Recommendation: Option A** for v1, with Option B as the upgrade path once there is real data on how long requests actually sit. This is a **product policy call** — if a bounded inbox is a launch requirement, choose B and add AC rows for the cutoff.

---

### Decision 8: Frontend surface for `/network`

**Option A — One `/network` page with four tabs: Connections · Received · Sent · Discover (Recommended)**

| Pros | Cons |
| :--- | :--- |
| `/network` is already registered in [`community.routes.tsx`](../../../../resources/views/web/src/module/community/route/community.routes.tsx) — this swaps the placeholder element and adds no routing work | Tab state is not linkable unless backed by a query param (`?tab=received`), which the implementation must add |
| Reuses the `FeedTabs` pattern the Community Home page already established, so the two pages read as one product | All four datasets load behind one route; each tab must fetch lazily rather than upfront |
| The four views share one row component and one card — separate pages would duplicate them | |

**Option B — Separate routes: `/network`, `/network/requests`, `/network/discover`**

| Pros | Cons |
| :--- | :--- |
| Deep-linkable and independently loadable by construction | Three route entries, three pages, and a sub-navigation component that does not exist yet |
| Each page's data need is unambiguous | Splits one small feature across three files with near-identical shells |

**Recommendation: Option A**, with `?tab=` in the URL so deep links still work — Option B's real advantage at a fraction of its cost.

---

### Decision 9: Error response contract

Every method in [`CommunityController`](../../../../app/Http/Controllers/Community/CommunityController.php) catches `Exception` and returns `400` with `['message' => $e->getMessage()]`. A state machine needs finer distinctions than that: "you are not the recipient" and "already connected" are different problems with different UI responses.

**Option A — Typed exceptions mapped to proper status codes in a new `ConnectionController` (Recommended)**

- `422` validation (Laravel's FormRequest shape), `403` forbidden, `404` not found, `409` conflict, `200` success.

| Pros | Cons |
| :--- | :--- |
| The client can branch on status instead of string-matching an error message — the only way the §2.5 criteria become mechanically checkable | Introduces a second error convention in the same module |
| Lives in a **new** controller, so no existing file's style is rewritten — [incremental-generation](../../../rules/incremental-generation.md) is respected | Someone later must decide whether to back-port it to `CommunityController` |
| Correct codes matter here: `409` on a duplicate request is what tells the UI to show "Request already sent" rather than a generic failure | |

**Option B — Follow the existing convention: `400` + message for everything**

| Pros | Cons |
| :--- | :--- |
| Perfectly consistent with the sibling controller | Collapses five distinct failures into one code; the frontend must parse human-readable strings to tell them apart — which breaks the moment a message is reworded |
| Nothing new to learn | Makes most non-happy-path acceptance criteria unverifiable except by string comparison |

**Recommendation: Option A.** Consistency is worth a lot, but not the ability to distinguish "forbidden" from "conflict". Confining it to the new controller keeps the blast radius at zero.

---

## 2.5 Acceptance Criteria

Statuses and bodies below are the exact contract. `U1`, `U2`, `U3` are distinct active users; `me` is the authenticated user.

| # | Given | When | Then |
|---|-------|------|------|
| AC-1 | `me` = U1, U2 active, no `connections` row for the pair | `POST /api/community/connections` `{"recipient_id": U2}` | `200` with `{"data": {"id": <int>, "status": "pending", "requester_id": U1, "recipient_id": U2, "accepted_at": null, "outcome": "requested"}}`; exactly one `connections` row exists for the pair |
| AC-2 | `me` = U1 | `POST /api/community/connections` `{"recipient_id": U1}` | `422` with `{"message": "...", "errors": {"recipient_id": ["You cannot connect with yourself."]}}`; no row created |
| AC-3 | Row exists `(U1→U2, pending)`, `me` = U1 | `POST /api/community/connections` `{"recipient_id": U2}` | `409` with `{"message": "A connection request is already pending."}`; still exactly one row, unchanged |
| AC-4 | Row exists `(U1→U2, accepted)`, `me` = U1 | `POST /api/community/connections` `{"recipient_id": U2}` | `409` with `{"message": "You are already connected with this user."}`; row unchanged |
| AC-5 | Row exists `(U1→U2, pending)`, `me` = U2 (reciprocal request — Decision 3 Option A) | `POST /api/community/connections` `{"recipient_id": U1}` | `200` with `{"data": {"status": "accepted", "requester_id": U1, "recipient_id": U2, "accepted_at": "<timestamp>", "outcome": "auto_accepted"}}`; still exactly one row |
| AC-6 | Row exists `(U1→U2, pending)`, `me` = U2 | `POST /api/community/connections/{id}/accept` | `200` with `{"data": {"status": "accepted", "accepted_at": "<timestamp>"}}`; `accepted_at` is non-null |
| AC-7 | Row exists `(U1→U2, pending)`, `me` = U1 (the requester) | `POST /api/community/connections/{id}/accept` | `403` with `{"message": "Only the recipient can accept this request."}`; status stays `pending` |
| AC-8 | Row exists `(U1→U2, pending)`, `me` = U2 | `POST /api/community/connections/{id}/decline` | `200` with `{"data": {"status": "declined"}}`; `accepted_at` remains `null` |
| AC-9 | Row exists `(U1→U2, pending)`, `me` = U1 | `POST /api/community/connections/{id}/cancel` | `200` with `{"data": {"status": "cancelled"}}` |
| AC-10 | Row exists `(U1→U2, pending)`, `me` = U2 (the recipient) | `POST /api/community/connections/{id}/cancel` | `403` with `{"message": "Only the requester can cancel this request."}`; status stays `pending` |
| AC-11 | Row exists `(U1→U2, accepted)`, `me` = U2 | `DELETE /api/community/connections/{id}` | `200` with `{"data": {"status": "removed"}}`; the row survives with `status = "removed"` (not deleted) |
| AC-12 | Row exists `(U1→U2, accepted)`, `me` = U3 (not a participant) | `DELETE /api/community/connections/{id}` | `404` with `{"message": "Connection not found."}` — not `403`, so non-participants cannot probe which connection IDs exist |
| AC-13 | Row exists `(U1→U2, declined)`, `me` = U1 (re-request — Decision 4) | `POST /api/community/connections` `{"recipient_id": U2}` | `200` with `{"data": {"status": "pending", "requester_id": U1}}`; the **same row id** is reused — still exactly one row for the pair |
| AC-14 | Row exists `(U1→U2, removed)`, `me` = U2 (re-request in the opposite direction) | `POST /api/community/connections` `{"recipient_id": U1}` | `200` with `{"data": {"status": "pending", "requester_id": U2, "recipient_id": U1}}`; same row id, both id columns swapped, `accepted_at` reset to `null` |
| AC-15 | `user_blocks` row exists `(blocker: U2, blocked: U1)`, `me` = U1 | `POST /api/community/connections` `{"recipient_id": U2}` | `404` with `{"message": "User not found."}` — the block is not disclosed to the blocked user; no row created |
| AC-16 | `user_blocks` row exists `(blocker: U1, blocked: U2)`, `me` = U1 (requester blocked the recipient) | `POST /api/community/connections` `{"recipient_id": U2}` | `409` with `{"message": "You have blocked this user."}`; no row created |
| AC-17 | U2 has `users.status = 'inactive'`, `me` = U1 | `POST /api/community/connections` `{"recipient_id": U2}` | `404` with `{"message": "User not found."}`; no row created |
| AC-18 | U2 is soft-deleted (`deleted_at` non-null), `me` = U1 | `POST /api/community/connections` `{"recipient_id": U2}` | `404` with `{"message": "User not found."}` |
| AC-19 | Row exists `(U1→U2, pending)`; U2 is then soft-deleted; `me` = U1 | `GET /api/community/connections/requests?direction=outgoing` | `200`; the request for U2 is **absent** from `data` (deleted participants are filtered from every read) |
| AC-20 | `me` = U1 with accepted connections to U2 and U3, plus one `pending` and one `declined` row | `GET /api/community/connections` | `200` with `{"data": {"connections": [...2 items...], "total": 2}}`; only `accepted` rows appear, each with a `user` object describing **the other participant** (never `me`) |
| AC-21 | `me` = U2 with one incoming `pending` from U1 and one outgoing `pending` to U3 | `GET /api/community/connections/requests?direction=incoming` | `200`; `data.requests` contains exactly the U1 request, with `user` = U1 |
| AC-22 | Two identical `POST /api/community/connections` `{"recipient_id": U2}` requests from U1 arrive concurrently (double-clicked button / network retry) | Both are processed | Exactly one `connections` row exists for the pair; one response is AC-1's `200`, the other is AC-3's `409`. The unique index on `(user_min_id, user_max_id)` is what guarantees this — never two rows |
| AC-23 | Row exists `(U1→U2, pending)`, `me` = U2; two `POST .../accept` calls for the same id arrive concurrently | Both are processed | Status is `accepted` and `accepted_at` is set **once**; the replayed call returns `200` with the same `accepted_at` value (accept is idempotent), and no second row or duplicate state change occurs |
| AC-24 | No `connections` row with id `999999` exists; `me` = U1 | `POST /api/community/connections/999999/accept` | `404` with `{"message": "Connection not found."}` |
| AC-25 | Unauthenticated caller (no Sanctum token) | `GET /api/community/connections` | `401` — the route sits inside the existing `auth:sanctum` group in [`routes/api.php`](../../../../routes/api.php); no connections logic runs |
| AC-26 | `me` = U1 | `POST /api/community/connections` `{}` (missing field) | `422` with `errors.recipient_id` present |
| AC-27 | `me` = U1 | `POST /api/community/connections` `{"recipient_id": "abc"}` (wrong type) | `422` with `errors.recipient_id` present; no row created |
| AC-28 | `me` = U1 | `POST /api/community/connections` `{"recipient_id": null}` and `{"recipient_id": 0}` and `{"recipient_id": -5}` | `422` in every case (`required|integer|min:1|exists:users,id`); no row created |
| AC-29 | `me` = U1 | `GET /api/community/connections?per_page=100000` | `200`; at most **50** items returned — `per_page` is clamped to the range 1–50, defaulting to 15 |
| AC-30 | `me` = U1 with 3 accepted connections | `GET /api/community/connections?search=<recipient's first name>` | `200`; only matching connections returned, matched against `users.first_name` and `users.last_name` |
| AC-31 | `me` = U1 with 7 accepted connections | `GET /api/community/discovery` | `200`; `data.profile_summary.network_count` is `7` — the real count, not the hard-coded `142` currently returned by [`GetCommunityDiscoveryQuery`](../../../../app/Queries/Community/GetCommunityDiscoveryQuery.php) |
| AC-32 | `me` = U1, already `accepted` with U2 and `pending` with U3 | `GET /api/community/suggested-people` | `200`; neither U2 nor U3 appears in `data` — users with any non-terminal connection row are excluded from suggestions |

---

## 3. Database

Two new migrations. Both follow the ScaleUP conventions in [project-profile.md](../../../rules/project-profile.md): **real foreign keys** via `constrained()`, `<parent>_id` naming, and `deleted_at` reserved for erasure.

### 3.1 `connections` — new

Mirrors [DATABASE_SCHEMA.md §5](../../../blueprint/scaleup/docs/DATABASE_SCHEMA.md), plus the two generated columns from Decision 2.

| Column | Type | Notes |
| :--- | :--- | :--- |
| `id` | `id()` | |
| `requester_id` | `foreignId()->constrained('users')->cascadeOnDelete()` | The user who sent the request |
| `recipient_id` | `foreignId()->constrained('users')->cascadeOnDelete()` | The user who receives it |
| `user_min_id` | `unsignedBigInteger()->storedAs('LEAST(requester_id, recipient_id)')` | **New, beyond blueprint** — Decision 2 |
| `user_max_id` | `unsignedBigInteger()->storedAs('GREATEST(requester_id, recipient_id)')` | **New, beyond blueprint** — Decision 2 |
| `status` | `string()->default('pending')->index()` | `pending` \| `accepted` \| `declined` \| `cancelled` \| `removed` — Decision 6 |
| `accepted_at` | `timestamp()->nullable()` | Set on accept; reset to `null` when a row is reused for a new request (AC-14) |
| `created_at` / `updated_at` | `timestamps()` | On a reused row, `updated_at` is the current request's timestamp — read it, not `created_at` |

Indexes:

```php
$table->unique(['user_min_id', 'user_max_id']);   // one row per pair, either direction — Decision 2
$table->index(['recipient_id', 'status']);        // incoming request inbox
$table->index(['requester_id', 'status']);        // outgoing request list
```

No `softDeletes()` — Decision 4. `cascadeOnDelete()` fires only on a hard user delete; `User` uses `SoftDeletes`, so account deletion leaves rows intact and reads filter them (AC-19).

### 3.2 `user_blocks` — new

Decision 5. Directional: one row means "blocker blocked blocked". **This table is not in DATABASE_SCHEMA.md** — the schema doc should be updated when this ships.

| Column | Type | Notes |
| :--- | :--- | :--- |
| `id` | `id()` | |
| `blocker_id` | `foreignId()->constrained('users')->cascadeOnDelete()` | |
| `blocked_id` | `foreignId()->constrained('users')->cascadeOnDelete()` | |
| `created_at` / `updated_at` | `timestamps()` | |

```php
$table->unique(['blocker_id', 'blocked_id']);
$table->index('blocked_id');   // "who has blocked me" lookups
```

No seed rows for either table.

---

## 4. Backend

### 4.1 Models

**`app/Models/Connection.php`** — follows the `#[Fillable([...])]` PHP-attribute style used by [`Reaction`](../../../../app/Models/Reaction.php) and [`User`](../../../../app/Models/User.php).

- `#[Fillable(['requester_id', 'recipient_id', 'status', 'accepted_at'])]` — `user_min_id` / `user_max_id` are generated and must **never** be fillable.
- `casts()`: `'accepted_at' => 'datetime'`.
- Constants: `STATUS_PENDING`, `STATUS_ACCEPTED`, `STATUS_DECLINED`, `STATUS_CANCELLED`, `STATUS_REMOVED`, and `STATUSES` (the allow-list for validation — Decision 6).
- Relations: `requester()`, `recipient()` → `belongsTo(User::class, ...)`.
- `scopeInvolving($query, int $userId)` — the single place the `orWhere` grouping is written (Decision 1):
  ```php
  $query->where(fn ($q) => $q->where('requester_id', $userId)->orWhere('recipient_id', $userId));
  ```
- `otherUser(int $meId): User` — resolves the counterpart so no caller reimplements it.

**`app/Models/UserBlock.php`** — `#[Fillable(['blocker_id', 'blocked_id'])]`, relations `blocker()`, `blocked()`.

**`app/Models/User.php`** — **extend, do not rewrite.** Add `sentConnectionRequests()`, `receivedConnectionRequests()`, and `blockedUsers()`. Nothing existing changes.

### 4.2 Actions — `app/Actions/Connection/`

**`AssertConnectionAllowedAction`** (static `execute()`) — the single gate every send passes through. Given `['user' => User, 'recipient_id' => int]` it verifies, in this order:

1. `recipient_id !== user->id` → else `422` (AC-2).
2. Recipient exists, `status = 'active'`, not soft-deleted → else `404 "User not found."` (AC-17, AC-18).
3. No `user_blocks` row `(blocker: recipient, blocked: user)` → else `404 "User not found."` (AC-15 — never disclose the block).
4. No `user_blocks` row `(blocker: user, blocked: recipient)` → else `409 "You have blocked this user."` (AC-16).

Returns the resolved recipient `User`. Ordering is load-bearing: step 3 must precede step 4 so a mutual block still reads as "not found" to the blocked party.

### 4.3 Queries — `app/Queries/Community/`

| Class | Returns |
| :--- | :--- |
| `GetUserConnectionsQuery` | `['connections' => [...], 'total' => int]` — `accepted` rows via `scopeInvolving`, eager-loading both participants, each mapped to the **other** user (AC-20). Supports `search` (AC-30) and `per_page` clamped 1–50 (AC-29). Excludes rows whose counterpart is soft-deleted or inactive. |
| `GetConnectionRequestsQuery` | `['requests' => [...], 'total' => int]` — `pending` rows filtered by `direction` (`incoming` → `recipient_id = me`, `outgoing` → `requester_id = me`), same counterpart filtering (AC-19, AC-21). |
| `GetConnectionStatusQuery` | `['status' => string|null, 'connection_id' => int|null, 'direction' => 'incoming'|'outgoing'|null]` for one target user — what a profile's Connect button reads. |

### 4.4 Handlers — `app/Handlers/Community/`

All extend `Handler` with a static `execute($params = [])` and wrap writes in `DB::transaction`, matching [`ToggleReactionHandler`](../../../../app/Handlers/Community/ToggleReactionHandler.php).

| Class | Behavior |
| :--- | :--- |
| `SendConnectionRequestHandler` | Runs `AssertConnectionAllowedAction`, then finds the pair's row by `(user_min_id, user_max_id)`. **No row** → create `pending` (AC-1). **`pending` and I am the requester** → `409` (AC-3). **`pending` and I am the recipient** → auto-accept, `outcome: "auto_accepted"` (AC-5, Decision 3). **`accepted`** → `409` (AC-4). **Terminal** → reuse the row: reset `requester_id`/`recipient_id` to this direction, `status = pending`, `accepted_at = null` (AC-13, AC-14). Catches the unique-index violation and re-reads, so the concurrent loser returns `409` rather than a 500 (AC-22). |
| `AcceptConnectionRequestHandler` | Recipient only (AC-7). `pending` → `accepted` + `accepted_at = now()`. **Idempotent:** already `accepted` returns the existing row with its original `accepted_at` unchanged (AC-23). Uses `lockForUpdate()` on the existing row — safe here, unlike the insert case in Decision 2 Option C. |
| `DeclineConnectionRequestHandler` | Recipient only. `pending` → `declined`, `accepted_at` untouched (AC-8). |
| `CancelConnectionRequestHandler` | Requester only (AC-10). `pending` → `cancelled` (AC-9). |
| `RemoveConnectionHandler` | Either participant. `accepted` → `removed` (AC-11). Non-participants get `404`, not `403` (AC-12). |

### 4.5 Controller — `app/Http/Controllers/Community/ConnectionController.php` (new)

Thin, one Query/Handler call per method, `response()->json(...)` with no API Resources. Per Decision 9 this controller maps typed exceptions to real status codes instead of the blanket `400` used by `CommunityController`:

```php
} catch (ConnectionConflictException $e) {   // 409
} catch (ConnectionForbiddenException $e) {  // 403
} catch (ConnectionNotFoundException $e) {   // 404
} catch (Exception $e) {                     // 400 — unchanged fallback
```

Exception classes live in `app/Exceptions/Connection/`. Validation stays with FormRequests, so `422` needs no catch.

### 4.6 Request — `app/Http/Requests/Community/SendConnectionRequest.php`

Follows [`ToggleReactionRequest`](../../../../app/Http/Requests/Community/ToggleReactionRequest.php): `authorize()` returns `Auth::check()`.

```php
'recipient_id' => ['required', 'integer', 'min:1', 'exists:users,id', 'different:' /* self-check in the Action */],
```

with a `messages()` entry `'recipient_id.not_in' => 'You cannot connect with yourself.'`. The self-comparison is expressed as `Rule::notIn([Auth::id()])` so AC-2 returns `422` from validation rather than from the Action. Covers AC-26, AC-27, AC-28.

### 4.7 Routes — append to [`routes/api/community.php`](../../../../routes/api/community.php)

Already inside the `auth:sanctum` + `community` prefix group, so AC-25 holds with no extra middleware.

```php
Route::get('/connections', [ConnectionController::class, 'index']);
Route::get('/connections/requests', [ConnectionController::class, 'requests']);
Route::get('/connections/status/{userId}', [ConnectionController::class, 'status']);
Route::post('/connections', [ConnectionController::class, 'store']);
Route::post('/connections/{id}/accept', [ConnectionController::class, 'accept']);
Route::post('/connections/{id}/decline', [ConnectionController::class, 'decline']);
Route::post('/connections/{id}/cancel', [ConnectionController::class, 'cancel']);
Route::delete('/connections/{id}', [ConnectionController::class, 'destroy']);
```

Register `/connections/requests` and `/connections/status/{userId}` **before** any `/connections/{id}` GET to avoid segment capture.

### 4.8 Existing query to correct — `GetCommunityDiscoveryQuery`

A minimal edit, not a rewrite ([incremental-generation](../../../rules/incremental-generation.md)):

- `profile_summary.network_count` → real count of `accepted` connections involving the user (AC-31), replacing the literal `142`.
- `suggested_people` → exclude users with any `pending` or `accepted` row against the current user (AC-32).

`mutual_connections` keeps its current placeholder — mutual connections are Future Scope in the source doc (§8).

---

## 5. Frontend

Module: `resources/views/web/src/module/community/network/`, mirroring the `home/` layout the Community Home page established.

```
module/community/network/
├── api/network.api.ts             # http from '@/app/axios/http'
├── components/
│   ├── NetworkTabs.jsx            # Connections · Received · Sent · Discover (?tab= synced)
│   ├── ConnectionCard.jsx         # avatar, name, headline, connected-since, Remove
│   ├── RequestCard.jsx            # incoming: Accept/Decline · outgoing: Cancel
│   ├── ConnectButton.jsx          # state machine: Connect / Pending / Connected / Accept
│   ├── NetworkEmptyState.jsx      # per-tab empty copy
│   └── NetworkSkeleton.jsx
├── hooks/useConnections.js        # per-tab lazy fetch + optimistic mutations
├── mocks/networkMocks.ts          # Gate 1 fixtures
└── pages/NetworkPage.jsx
```

**Routing.** [`community.routes.tsx`](../../../../resources/views/web/src/module/community/route/community.routes.tsx) already has `/network` — swap `<PlaceholderCommunityPage type="network" />` for `<NetworkPage />`. No new route entry, no change to `useApiWebRoute.ts`.

**Design system.** Reuse `@/src/components/ui` primitives and the tokens in [`resources/css/app.css`](../../../../resources/css/app.css). No new primitives, no new colors — [ui-design.md](../../../rules/ui-design.md) and [design_system.md](../design/design_system.md).

**Existing file touched:** [`SuggestedPeopleCard.jsx`](../../../../resources/views/web/src/module/community/home/components/rail/SuggestedPeopleCard.jsx) — its Connect button gets wired to `ConnectButton`. This is the only edit outside the new folder.

**API contract** (`network.api.ts` — same `ApiResponse<T>` envelope and mock-fallback pattern as [`community.api.ts`](../../../../resources/views/web/src/module/community/home/api/community.api.ts)):

| Method | Endpoint | Payload / Params |
| :--- | :--- | :--- |
| `getConnections` | `GET /api/community/connections` | `{ search?, per_page? }` |
| `getRequests` | `GET /api/community/connections/requests` | `{ direction: 'incoming' \| 'outgoing' }` |
| `getConnectionStatus` | `GET /api/community/connections/status/{userId}` | — |
| `sendRequest` | `POST /api/community/connections` | `{ recipient_id }` |
| `acceptRequest` | `POST /api/community/connections/{id}/accept` | — |
| `declineRequest` | `POST /api/community/connections/{id}/decline` | — |
| `cancelRequest` | `POST /api/community/connections/{id}/cancel` | — |
| `removeConnection` | `DELETE /api/community/connections/{id}` | — |

**`ConnectButton` states** — the whole feature's UX condenses here:

| Backend status | Label | Action | Disabled while pending |
| :--- | :--- | :--- | :--- |
| `null` / terminal | **Connect** | `sendRequest` | ✅ — the UI half of AC-22 |
| `pending`, outgoing | **Pending** | `cancelRequest` (confirm first) | ✅ |
| `pending`, incoming | **Accept** (+ Decline) | `acceptRequest` / `declineRequest` | ✅ |
| `accepted` | **Connected** | `removeConnection` (confirm first) | ✅ |

On a `200` with `outcome: "auto_accepted"` (AC-5), the button jumps straight to **Connected** and the toast reads "You're now connected" — not "Request sent". On `409`, refetch status and re-render rather than showing a raw error.

**Layout sketch** — `/network`, inside the existing shell:

```
┌──────────────────────────────────────────────────────────┐
│  Network                                                 │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Connections (7) │ Received (2) │ Sent (1) │ Discover│  │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │ [Search connections…                            🔍]│  │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │ ◯  Elena Rostova                       [Connected ▾]│  │
│  │    Head of Supply Chain @ Peak Logistics            │  │
│  │    Connected 12 Mar 2026                            │  │
│  ├────────────────────────────────────────────────────┤  │
│  │ ◯  David Kim                           [Connected ▾]│  │
│  │    Managing Partner @ Apex Ventures                 │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

Below `lg`, tabs scroll horizontally and cards stack full-width; the action button moves under the headline rather than shrinking.

---

## 6. Business Rules & Edge Cases

### 6.1 Business rules — from [CONNECTIONS.md](../../../blueprint/scaleup/docs/specifications/community/CONNECTIONS.md)

| # | Rule | Where it is enforced | AC |
| :--- | :--- | :--- | :--- |
| BR-1 | A user cannot connect with themselves | `SendConnectionRequest` validation + `AssertConnectionAllowedAction` step 1 | AC-2 |
| BR-2 | Duplicate active connection requests are not allowed | `unique(user_min_id, user_max_id)` + `SendConnectionRequestHandler` | AC-3, AC-4, AC-22 |
| BR-3 | Requests may only be sent to a **discoverable** user — defined here as `status = 'active'`, not soft-deleted, and not blocked in either direction (`user_profiles.visibility` does not exist; see §1) | `AssertConnectionAllowedAction` steps 2–4 | AC-15, AC-16, AC-17, AC-18 |
| BR-4 | Users may remove an existing connection | `RemoveConnectionHandler`, either participant | AC-11, AC-12 |
| BR-5 | Blocked relationships prevent unauthorized requests | `AssertConnectionAllowedAction`, reading `user_blocks` | AC-15, AC-16 |
| BR-6 | A connection grants **no** access to private organization or business data | Structural: nothing in this spec is read by any authorization check. No middleware, policy, or query outside `app/*/Community` may consult `connections` | — (negative rule; enforced by review, see §9) |
| BR-7 | Connection status is consistent for both participants | Structural: one row per pair (Decisions 1 + 2) | AC-22 |

### 6.2 Edge cases — from the source doc

| Edge case | Handling |
| :--- | :--- |
| Recipient blocks the sender | `404 "User not found."` — the block is never disclosed (AC-15) |
| Recipient becomes inactive | `404` on new requests (AC-17); existing rows are filtered from reads (AC-19) |
| Connection request expires | **Requests do not expire in v1** — Decision 7 Option A. Pending requests remain cancellable and declinable indefinitely |
| Duplicate requests submitted | `409` on the second; the DB unique index makes it impossible for two rows to exist even under a race (AC-3, AC-22) |
| User deletes account | `User` soft-deletes, so rows survive but are filtered from every read (AC-18, AC-19). A hard delete cascades the rows away |
| User changes profile visibility while a request is pending | **N/A in v1** — `user_profiles` does not exist, so there is no visibility to change. `status`-based inactivity is the analogous case and is covered by AC-19 |
| Re-request after decline / removal | Same row reused, in either direction (AC-13, AC-14) |
| Both users request each other | Auto-accept — Decision 3 (AC-5) |

### 6.3 Non-Functional & Failure-Mode Checklist

| Category | Answer |
| :--- | :--- |
| **Authorization** | Every route sits inside the existing `auth:sanctum` group; unauthenticated → `401` (AC-25). This is **Community-side only** — no organization role or permission is consulted, and no portal boundary is crossed. Per action: **accept/decline** → recipient only, else `403` (AC-7); **cancel** → requester only, else `403` (AC-10); **remove** → either participant, non-participants get `404` not `403`, so IDs cannot be probed (AC-12); **reads** → scoped to rows involving the caller via `scopeInvolving`, so another user's connections are unreachable by construction. Rejections return `{"message": "<reason>"}` at the status codes above. |
| **Concurrency / double-submit** | Two simultaneous sends for one pair: the `unique(user_min_id, user_max_id)` index admits exactly one; the loser's constraint violation is caught and re-read as `409` (AC-22). Double-clicked Connect: the button disables while the request is in flight (§5). Concurrent accepts: `lockForUpdate()` on the existing row serializes them, and the second observes `accepted` (AC-23). Simultaneous accept + cancel: whichever transaction commits first wins; the loser sees a non-`pending` status and returns `409`. |
| **Idempotency on retries** | A replayed **send** cannot duplicate a row — the unique pair index is the key, and the replay returns `409` (AC-3, AC-22). A replayed **accept** returns the same row with its original `accepted_at`, unchanged (AC-23). Decline, cancel, and remove are terminal transitions guarded by a status check, so a replay is a no-op returning the current state. There are no amounts, counters, or ledger rows to double. |
| **Error response shape & status codes** | Decision 9 Option A, in `ConnectionController` only. `422` → Laravel FormRequest shape `{"message": ..., "errors": {...}}` (AC-2, AC-26, AC-27, AC-28). `403` → `{"message": "Only the recipient can accept this request."}` / `"Only the requester can cancel this request."` (AC-7, AC-10). `404` → `{"message": "Connection not found."}` or `{"message": "User not found."}` (AC-12, AC-15, AC-17, AC-18, AC-24). `409` → `{"message": "A connection request is already pending."}` / `"You are already connected with this user."` / `"You have blocked this user."` (AC-3, AC-4, AC-16). `401` from middleware (AC-25). Success → `200` with `{"data": ...}`. |
| **Input validation boundaries** | `recipient_id`: missing → `422` (AC-26); `null` → `422`; non-numeric string → `422` (AC-27); `0` and negatives → `422` via `min:1` (AC-28); nonexistent id → `422` via `exists:users,id`; own id → `422` (AC-2). `{id}` route params: nonexistent → `404` (AC-24); non-numeric → `404` from route-model resolution. `direction`: anything other than `incoming`/`outgoing` → `422`. `per_page`: clamped to 1–50 server-side, so oversized and zero values are absorbed rather than rejected (AC-29). `search`: trimmed, capped at 100 characters, matched with a bound `LIKE` — never interpolated. |

---

## 7. Build Order

Dependency-first. Steps 1–4 are Gate 1 (design against fixtures); 5–10 are Gate 2 (live data).

1. **Migration** `create_connections_table` — columns, generated pair columns, unique + composite indexes (§3.1).
2. **Migration** `create_user_blocks_table` (§3.2).
3. **Frontend Gate 1** — scaffold `module/community/network/` with `networkMocks.ts`; build `NetworkPage`, `NetworkTabs`, `ConnectionCard`, `RequestCard`, `ConnectButton`, empty and skeleton states against fixtures only. Swap the placeholder in `community.routes.tsx`.
4. **Validate the design** against §5 before any wiring. ← **Gate**
5. **Models** — `Connection` (constants, casts, `scopeInvolving`, `otherUser`), `UserBlock`; extend `User` with the three relations.
6. **Action** — `AssertConnectionAllowedAction`, with its four checks in the stated order.
7. **Exceptions + Request** — `app/Exceptions/Connection/`, `SendConnectionRequest`.
8. **Handlers** — `SendConnectionRequestHandler` first (it owns the state machine), then accept, decline, cancel, remove.
9. **Queries + Controller + Routes** — the three queries, `ConnectionController`, the eight route lines (§4.7).
10. **Wire the frontend** — replace `networkMocks` reads with `network.api.ts`; wire `ConnectButton` into `SuggestedPeopleCard`; apply the `GetCommunityDiscoveryQuery` corrections (§4.8). Run `npm run typecheck`.

---

## 8. Out of Scope (Future Specs)

- **Block / unblock endpoints and UI.** This spec creates and reads `user_blocks`; writing rows belongs to a blocking spec, most naturally alongside [MESSAGING.md](../../../blueprint/scaleup/docs/specifications/community/MESSAGING.md), whose permissions table already lists "Block User". Until then rows exist only via seeder or tinker.
- **Notifications** for request sent / accepted / declined / removed. The `notifications` table does not exist. The source doc says notifications *may* be generated, so deferring is compliant.
- **`user_profiles` and profile visibility.** Once the table exists, BR-3's "discoverable" definition should tighten from `users.status` to real visibility rules, and this spec revised to v2.
- **`user_settings.privacy_preferences`** — control over whether one's connections are publicly visible. Not needed in v1 **because no endpoint here exposes another user's connection list**: every read is scoped to the caller. The moment a public connections list is added, this becomes a prerequisite.
- **Mutual connections, connection recommendations, connection notes, professional introductions, networking insights** — all listed as Future Scope in the source doc. The placeholder `mutual_connections => rand(3, 18)` in `GetCommunityDiscoveryQuery` stays until the mutual-connections spec replaces it.
- **A real member profile page.** `/profile/:slug` is still `PlaceholderCommunityPage`, so the source doc's "View User Profile → Send Connection Request" entry point does not exist yet; v1's entry points are the Network page's Discover tab and the home right rail.
- **Following** — one-way, separate table, separate spec ([FOLLOWING.md](../../../blueprint/scaleup/docs/specifications/community/FOLLOWING.md)).
- **Messaging permissions derived from connection state** — deliberately excluded per BR-6.
- **Updating [DATABASE_SCHEMA.md](../../../blueprint/scaleup/docs/DATABASE_SCHEMA.md)** to add `user_blocks` and the two generated columns on `connections`. A documentation task, but it should not be forgotten.

---

## 9. Definition of Done

- [ ] Every row in the **Acceptance Criteria** table passes (AC-1 … AC-32)
- [ ] Every category in the **Non-Functional & Failure-Mode Checklist** is addressed — answered or explicitly `N/A because ...`
- [ ] BR-6 verified by inspection: no file outside `app/{Models,Queries,Handlers,Actions,Http}/**/Community*` or `module/community/network/` reads the `connections` table, and no policy, middleware, or gate consults it
- [ ] `npm run typecheck` passes (ScaleUP has no Vitest configured — see [project-profile.md](../../../rules/project-profile.md))
- [ ] Both migrations run and roll back cleanly on MySQL **and** SQLite (generated columns — Decision 2 Option A)
- [ ] No open findings from adversarial verification — see the latest `.agents/reports/community-connections-verify-<date>.md`

<!-- Changelog -->
<!-- v1 — 2026-08-14 — initial -->
