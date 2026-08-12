# Spec — Organization Schema Correction

> **Kind:** Extension — corrective refactor of the existing organization data layer. No new product capability.
> **Portal:** **Organization** (`/api/organizations/...` routes, `organization` frontend module). Touches Auth, Onboarding, and Dashboard domains as collateral.
> **Route:** No new routes. Existing endpoints keep their URLs and response shapes.
> **Conventions:** [project-profile.md](../../../rules/project-profile.md) (ScaleUP Profile), [naming-convention.md](../../../rules/naming-convention.md), [DATABASE_SCHEMA.md](../../../blueprint/scaleup/docs/DATABASE_SCHEMA.md), [PERMISSION_MATRIX.md](../../../blueprint/scaleup/docs/PERMISSION_MATRIX.md), [ORGANIZATION_ROLES.md](../../../blueprint/scaleup/docs/specifications/organization/ORGANIZATION_ROLES.md).
> **System Awareness:** Models reused/renamed — `Organization`, `OrganizationUser` → `OrganizationMember`, `OrganizationInvitation`, `User`, `BusinessGoal`. Models created — `OrganizationRole`, `Permission`, `RolePermission`. Tables renamed — `organization_users` → `organization_members`. Tables created — `organization_roles`, `permissions`, `role_permissions`. Routes reused: all four `routes/api/*.php` files unchanged. New migration: **yes** — see §2 Decision 1 for whether they replace or supplement the originals. **69 references across 21 app files + 5 migrations.**

---

## 1. Purpose

The organization data layer was built before the blueprint was being followed. It diverges from three separate authorities that all agree with each other:

| Divergence | Current | Required by |
| :--- | :--- | :--- |
| FK column naming | `id_organization`, `id_user`, `id_created_by`, `id_invited_by`, `id_current_organization` | [naming-convention.md](../../../rules/naming-convention.md) L24 *and* [DATABASE_SCHEMA.md](../../../blueprint/scaleup/docs/DATABASE_SCHEMA.md) |
| Membership table name | `organization_users` | `organization_members` |
| Roles | plain `role` string column | `organization_roles` + `permissions` + `role_permissions` |
| Foreign keys | none declared | "Foreign keys should be used where appropriate" |

This spec corrects all four. It is a **blocker for every subsequent ScaleUP spec** — community, subscription, and business tables all carry `organization_id` and all reference the role/permission model, so every table added before this correction inherits the wrong convention and doubles the eventual rework.

**Explicitly not in this spec:** the Community-first routing rework, the subscription layer, and the missing Phase 1 tables. Those are separate specs (§8) that depend on this one landing first.

---

## 2. Design Decisions (Pros & Cons)

### Decision: Migration strategy — rewrite originals vs. corrective ALTERs

**Option A — Rewrite the 5 original migrations in place, then `migrate:fresh` (Recommended)**

- Edit `2026_08_11_060000`–`060004` directly so they create the correct schema from the start, add the three new role/permission migrations, and rebuild the database.

| Pros | Cons |
| :--- | :--- |
| Migration history stays readable — a new developer sees the intended schema, not a scar tissue of renames | **Destroys all existing data.** Only viable while this is a dev-only database |
| No `RENAME COLUMN` / `RENAME TABLE` statements, which are the most portability-sensitive DDL across MySQL versions | Anyone who already ran the originals must re-run `migrate:fresh` and re-seed; a teammate mid-branch loses their local state |
| Half the migration files (8 vs. 13) and no down-migration puzzle | Not reversible in a deployed environment — if this has ever shipped, Option A is off the table |
| Cheapest path to also fixing the missing `deleted_at` and `organizations` columns in the same pass | |

**Option B — Leave the originals untouched, add corrective ALTER migrations**

- New migrations issue `renameColumn()`, `Schema::rename()`, add FKs, and create the three new tables.

| Pros | Cons |
| :--- | :--- |
| Non-destructive — existing rows survive, safe if any environment already holds real data | `renameColumn()` on a column carrying an index requires `doctrine/dbal` on older Laravel, and drops/recreates indexes — several of these columns are indexed |
| Works in a deployed environment and is the only honest option there | Migration history permanently records the wrong names, so the next developer reads `id_organization` in the repo and may copy it |
| Each change is individually reversible | Roughly 13 migration files for a schema that should read as 8 |
| | Renaming `organization_users` → `organization_members` mid-history means the model/table mapping is only correct after two migrations, which breaks anyone running a partial migration |

**Recommendation: Option A.**

> **DECIDED — Option A.** The user confirmed there is no data in any environment (`APP_ENV=local`, dev-only database). The original migrations are rewritten in place and the database is rebuilt with `migrate:fresh --seed`. No `renameColumn()` / `Schema::rename()` anywhere; no data migration needed.
>
> This decision is only valid while that remains true. If this schema ever ships, a later correction must use Option B.

---

### Decision: Role model shape — per-organization rows vs. global system roles

[DATABASE_SCHEMA.md](../../../blueprint/scaleup/docs/DATABASE_SCHEMA.md) gives `organization_roles` an `organization_id` **and** an `is_system_role` flag, which admits two readings.

**Option A — Global system roles now, per-organization custom roles later (Recommended)**

- `organization_roles.organization_id` is **nullable**. The five system roles (Owner, Administrator, Manager, Member, Viewer) are seeded once with `organization_id = NULL, is_system_role = true`. Custom roles added later carry a real `organization_id`.

| Pros | Cons |
| :--- | :--- |
| Five seeded rows total, not five per organization — a 1,000-org platform stores 5 role rows, not 5,000 | A nullable FK is slightly more awkward to reason about than a required one |
| `role_permissions` for system roles is seeded once and edited in one place; a permission fix does not need a backfill across every organization | Uniqueness must be expressed as a composite `(organization_id, name)` that tolerates NULL — MySQL treats NULLs as distinct, so a partial guard is needed against duplicate global roles |
| Matches `is_system_role`'s evident purpose — distinguishing platform-defined from org-defined | |
| Custom roles ([ORGANIZATION_ROLES.md](../../../blueprint/scaleup/docs/specifications/organization/ORGANIZATION_ROLES.md) Future Scope) drop in without a schema change | |

**Option B — Five system-role rows per organization**

- Every organization gets its own copy of the five roles at creation time; `organization_id` is non-nullable.

| Pros | Cons |
| :--- | :--- |
| `organization_id` is never null — simpler constraint, simpler queries | Row count grows linearly with organizations for data that is identical in every one of them |
| An organization could edit a system role's permissions without affecting others | Changing a system permission requires updating every organization's copy — a migration-time backfill, and a silent drift risk if one fails |
| | `CreateOrganizationHandler` must seed 5 roles + N role_permissions inside the creation transaction, making org creation meaningfully heavier |

**Recommendation: Option A.** The blueprint's system roles are platform-defined and identical everywhere; duplicating them per organization buys editability that no current specification asks for, at the cost of a backfill on every future permission change.

---

### Decision: Membership → role linkage

**Option A — `organization_members.role_id` FK only (Recommended)**

- The `role` string column is dropped. Role is resolved by joining `organization_roles`.

| Pros | Cons |
| :--- | :--- |
| Exactly what [DATABASE_SCHEMA.md](../../../blueprint/scaleup/docs/DATABASE_SCHEMA.md) specifies — one authority for a member's role | Every membership read that needs a role name must join or eager-load `role` |
| Renaming a role is one UPDATE, not a data migration across memberships | The API shape changes: queries currently return `'role' => $m->role`, so they must return `$m->role->name` to keep the response identical |
| Impossible to store a role string that does not exist | |

**Option B — Keep a denormalized `role` string alongside `role_id`**

| Pros | Cons |
| :--- | :--- |
| Membership reads need no join | Two sources of truth that can disagree — the exact class of defect [duplicate-prevention.md](../../../rules/duplicate-prevention.md) exists to prevent |
| Smallest diff to the existing queries | Every role change must write both columns, forever |

**Recommendation: Option A.** The join is trivially cheap (five rows, permanently cacheable) and Option B's drift risk is real and permanent. Preserve the wire format by shaping `role->name` back into the `role` key — see §4.

---

### Decision: Where permission checks are enforced

**Option A — Laravel Gate/Policy, checked in controllers (Recommended)**

- Register an `organization` Gate that resolves the acting user's membership + role + permissions; controllers call `Gate::authorize('business.sales.create', $organization)`.

| Pros | Cons |
| :--- | :--- |
| Idiomatic Laravel; one place to audit every rule | Adds a layer the codebase does not currently use — a new pattern for this project |
| Keeps thin controllers thin — one authorize line, no branching | Gate resolution needs the active organization in context, so it depends on the org-context resolution already in `ResolveActiveOrganizationQuery` |
| Testable in isolation from HTTP | |

**Option B — Permission checks inside Handlers**

- Each Handler asserts permissions at the top of `execute()`.

| Pros | Cons |
| :--- | :--- |
| Matches how this codebase already enforces referential rules (Query/Handler layer) | Every new Handler must remember the check — an omission is silent and grants access |
| No new concept | Reads (Queries) also need protection, so the rule would live in two class families |

**Recommendation: Option A**, but **build the tables in this spec and the enforcement in the Authorization spec** (§8). This spec is a data-layer correction; wiring enforcement is a behavior change that deserves its own spec against [security/AUTHORIZATION.md](../../../blueprint/scaleup/docs/specifications/security/AUTHORIZATION.md). Seeding permissions without enforcing them changes nothing at runtime, which is the point — this spec must be behavior-preserving.

---

### Decision: Soft deletes on the corrected tables

The blueprint lists `deleted_at` on `users`, `organizations`, and `organization_members`. The current tables have none, using a `status` integer instead.

**Option A — Add `deleted_at` alongside the existing `status` (Recommended)**

| Pros | Cons |
| :--- | :--- |
| Matches the blueprint; `status` and `deleted_at` answer different questions (*is this member suspended?* vs. *was this membership erased?*) | Two lifecycle concepts on one table needs a documented rule or it becomes ambiguous |
| Free to add now while the tables are being rebuilt; expensive to retrofit once business tables reference them | |

**Option B — Defer to a later spec**

| Pros | Cons |
| :--- | :--- |
| Smaller change now | A second pass over the same five tables, and every business table built in between inherits the wrong shape |

**Recommendation: Option A**, with the rule written into the model docblocks: `status` is operational state (active/disabled), `deleted_at` is erasure. Do **not** convert existing `status` semantics — that is a behavior change and out of scope.

---

### Decision: Adopt the blueprint's missing `organizations` columns now?

The doc specifies `type`, `country`, `description`, `timezone`, `currency`, none of which exist. `size` and `logo_path` exist but are not in the doc (`logo` belongs on `organization_profiles`).

**Option A — Add the five missing columns; leave `size`/`logo_path` in place (Recommended)**

| Pros | Cons |
| :--- | :--- |
| `currency` and `timezone` are load-bearing for the entire business/analytics layer — sales, expenses, and reports are meaningless without them, and retrofitting means backfilling every existing row | Adds columns nothing reads yet |
| Free while the migration is being rewritten anyway | `size`/`logo_path` remain undocumented drift until the Organization Profile spec resolves them |

**Option B — Correct naming only; add columns when a feature needs them**

| Pros | Cons |
| :--- | :--- |
| Tightest possible scope — pure rename, easiest to review | A third migration pass over `organizations`, after business tables already reference it |

**Recommendation: Option A** for `currency` and `timezone` (nullable, sensible defaults) since the business layer is blocked without them; `type`, `country`, `description` are cheap to include in the same pass. Leave `size`/`logo_path` alone and flag them for the Organization Profile spec (§8) rather than silently moving them.

---

## 3. Database

### Renamed columns (all tables)

| Table | Current | Corrected |
| :--- | :--- | :--- |
| `organizations` | `id_created_by` | `created_by_id` |
| `organization_users` → `organization_members` | `id_organization` | `organization_id` |
| `organization_users` → `organization_members` | `id_user` | `user_id` |
| `organization_users` → `organization_members` | `role` (string) | `role_id` (FK) |
| `organization_invitations` | `id_organization` | `organization_id` |
| `organization_invitations` | `id_invited_by` | `invited_by_id` |
| `organization_invitations` | `role` (string) | `role_id` (FK) |
| `users` | `id_current_organization` | `current_organization_id` |
| `business_goals` | `id_organization` | `organization_id` |

> **DECIDED — `invited_by`,** matching the blueprint rather than [naming-convention.md](../../../rules/naming-convention.md) L24's `<parent>_id` rule. This is a deliberate, documented exception; the migration notes it and passes the parent table explicitly (`constrained('users')`), since Laravel would otherwise infer a table named `invited_bies`.

### `organizations` — corrected

Existing: `id`, `name`, `slug`, `industry`, `size`, `logo_path`, `created_by_id`, `onboarding_completed_at`, `status`, `timestamps`.
Added: `type` (string, nullable), `country` (string, nullable), `description` (text, nullable), `timezone` (string, default `'Asia/Manila'`), `currency` (string 3, default `'PHP'`), `deleted_at`.
FK: `created_by_id` → `users.id`.
Indexes: keep `slug` unique, `status`.

### `organization_members` — renamed from `organization_users`

`id`, `organization_id`, `user_id`, `role_id`, `status` (tinyint, 1=active), `joined_at`, `timestamps`, `deleted_at`.
FKs: `organization_id` → `organizations.id` (cascade on delete), `user_id` → `users.id`, `role_id` → `organization_roles.id` (restrict).
Unique: `(organization_id, user_id)` — carried over from the existing migration.
Indexes: `organization_id`, `user_id` (per the blueprint's Indexing Strategy).

### `organization_roles` — new

`id`, `organization_id` (nullable FK → `organizations.id`), `name`, `description` (nullable), `is_system_role` (bool, default false), `timestamps`.
Seeded system roles (`organization_id = NULL`, `is_system_role = true`): **Owner, Administrator, Manager, Member, Viewer** — exactly the five in [PERMISSION_MATRIX.md](../../../blueprint/scaleup/docs/PERMISSION_MATRIX.md) §2.
Index: `(organization_id, name)`.

> The current `organization_users.role` column comment lists `owner, administrator, manager, employee, accountant, viewer` — six values, and `employee`/`accountant` are **not** blueprint roles while `member` is missing. `CreateOrganizationHandler` seeds `'owner'` and `InviteMemberHandler` defaults to `'employee'`. Mapping: `employee` → **Member**, `accountant` → **Member** (no blueprint equivalent; flag if a Finance role is actually wanted).

### `permissions` — new

`id`, `name` (unique, e.g. `business.sales.create`), `description` (nullable), `module`, `action`, `timestamps`.
Seed from the `module.resource.action` examples in [DATABASE_SCHEMA.md](../../../blueprint/scaleup/docs/DATABASE_SCHEMA.md) and the capability rows in [PERMISSION_MATRIX.md](../../../blueprint/scaleup/docs/PERMISSION_MATRIX.md) §3. Seed by resolving parent ids via the stable `name` key — never hard-code auto-increment ids.

### `role_permissions` — new

`id`, `role_id` (FK → `organization_roles.id`, cascade), `permission_id` (FK → `permissions.id`, cascade), `created_at`.
Unique: `(role_id, permission_id)`.
Seeded from the [PERMISSION_MATRIX.md](../../../blueprint/scaleup/docs/PERMISSION_MATRIX.md) §3 matrix. Cells marked `✅/❌` ("configurable through granular permissions") seed as **granted for Manager, denied for Member and Viewer** — the conservative reading.

> **DECIDED.** Member receives the operational baseline (`business.records.create`, `business.records.update`) on the reading that [ORGANIZATION_ROLES.md](../../../blueprint/scaleup/docs/specifications/organization/ORGANIZATION_ROLES.md) defines a Member as one who "performs assigned organization activities" — a read-only Member is a Viewer. The remaining `✅/❌` cells (delete, manage goals/KPIs, reports) stay denied until the granular permission system can grant them per member. Viewer keeps the strict read-only set.
>
> **DECIDED — `subscription.manage` is Owner-only.** Withheld from Administrator: spending money is not delegable by default.
>
> **DECIDED — a sixth role, `Accountant`, was added.** It is **not** in PERMISSION_MATRIX.md §2; it exists because the role is real in this business — a bookkeeper who records and reports on money without managing people or settings. It has no `business.records.delete`: financial history is corrected by entry, not erased. **The blueprint must be amended to match** (PERMISSION_MATRIX.md §2 and §3, ORGANIZATION_ROLES.md) or this becomes new drift of exactly the kind this spec exists to remove.

Seeded counts: Owner 21, Administrator 18, Manager 14, Accountant 12, Member 8, Viewer 6.

### `organization_invitations` — corrected

`organization_id`, `invited_by_id`, `role_id` replace their old forms. Status enum gains `declined` to match the blueprint's five statuses (`pending, accepted, declined, expired, revoked`); the current comment lists four.

### `users` — corrected

`id_current_organization` → `current_organization_id`, FK → `organizations.id` (null on delete). Add `deleted_at`.

---

## 4. Backend

**Models**

- `OrganizationUser` → **`OrganizationMember`** (`protected $table = 'organization_members'`). Update both `Organization::members()` and `User::organizationMemberships()` to point at it. Add `role(): BelongsTo`.
- New: `OrganizationRole`, `Permission`, `RolePermission` — following the sibling models' style (explicit `$table`, `$fillable`, `casts()` method).
- Add `SoftDeletes` to `User`, `Organization`, `OrganizationMember`.
- `Organization::goals()`, `::invitations()`, `::members()` — drop the now-unnecessary explicit FK argument where the corrected name matches Laravel's convention.

**Queries / Handlers / Actions — 21 files, 69 references.** All keep their class names, signatures, and return shapes. The only change is column names and, where a role is read, `$m->role->name` instead of `$m->role`.

| Layer | Files | Refs |
| :--- | :--- | :---: |
| Models | 5 | 17 |
| Queries | 6 | 17 |
| Handlers | 6 | 30 |
| Actions | 1 | 1 |
| Controllers | 3 | 4 |

`CreateOrganizationHandler` and `InviteMemberHandler` additionally resolve a role **by name** to a `role_id` (`OrganizationRole::where('name', 'Owner')->whereNull('organization_id')->first()`), rather than writing a string.

**Response shapes must not change.** `GetUserOrganizationsQuery`, `GetOrganizationMembersQuery`, and `GetOnboardingStateQuery` currently emit a `role` key holding a string. They must continue to emit `'role' => $m->role->name` so the frontend and the TypeScript types are untouched by this spec.

---

## 5. Frontend

**No route changes.** Two contract changes were accepted deliberately after the initial draft:

- `AuthUser` gains `first_name`, `last_name` (with `name` retained as the server-composed full name) and `role` — the user's role in their *current* organization, since the same person holds different roles in different organizations.
- `RegisterPayload` sends `first_name`/`last_name` instead of `name`.

[AppShell.jsx](../../../../resources/views/web/src/module/global/components/AppShell.jsx) now renders the real role and hides the badge entirely when there is none, replacing a hard-coded `'Owner / Executive'` fallback that every user saw.

One type file needs a comment correction only — [`src/types/organization.ts`](../../../../resources/views/web/src/types/organization.ts) documents `OrganizationRole` as "lower-cased on write … `'employee'`". After this spec, roles are the five blueprint names resolved from `organization_roles.name`. Update the union and the docblock:

```ts
export type OrganizationRole = 'Owner' | 'Administrator' | 'Manager' | 'Member' | 'Viewer' | (string & {});
```

Casing is a real decision: the seeded `name` values are title-case per the blueprint. If the API should keep emitting lower-case for frontend compatibility, lower-case at the shaping Query, not in the seed.

**Recommended:** seed title-case, emit title-case, update the type. Every frontend use of a role today is **display-only** — no code branches on the value:

| Location | Use |
| :--- | :--- |
| [OnboardingPage.jsx:410](../../../../resources/views/web/src/module/onboarding/pages/OnboardingPage.jsx) | `<Badge>{member.role}</Badge>` |
| [AppShell.jsx:245](../../../../resources/views/web/src/module/global/components/AppShell.jsx) | `{user?.role \|\| 'Owner / Executive'}` — dead read; `AuthUser` has no `role` field, so it always renders the literal fallback. Flag separately. |
| `CommunitySection.jsx`, `TestimonialsSection.jsx` | Landing-page mock data, unrelated to the API. |

So title-casing is safe: the only real API-fed usage is a badge label, which reads better title-cased anyway.

---

## 6. Business Rules & Edge Cases

| Case | Handling |
| :--- | :--- |
| A membership references a role that no longer exists | `role_id` FK is `restrict` — a role in use cannot be deleted. System roles must never be deletable. |
| Organization deleted while memberships exist | `organization_id` cascades; memberships are removed with the organization. |
| User deleted while owning an organization | Blocked by the blueprint's rule "at least one active owner must exist per organization" — **not enforced today** and out of scope here; note it for the Membership spec. |
| `current_organization_id` points at a deleted organization | FK set to null on delete; `ResolveActiveOrganizationQuery` already falls back to the first active membership. |
| Seeding runs twice | Seed idempotently — `updateOrCreate` keyed on `name` for permissions and system roles. |
| `migrate:fresh` in an environment with real data | The reason Decision 1 must be answered before any migration is written. |
| Existing `'employee'`/`'accountant'` role strings | Map to **Member** at seed time (Option A) or in the corrective migration (Option B). Under Option A with `migrate:fresh` there is no data to map. |

---

## 7. Build Order

1. ~~Confirm Decision 1~~ — **resolved: no data, Option A.** Migrations are rewritten in place; rebuild with `migrate:fresh --seed`.
2. Migrations: `organization_roles`, `permissions`, `role_permissions` (new tables first — `organization_members.role_id` depends on them).
3. Migrations: corrected `organizations`, `organization_members`, `organization_invitations`, `users`, `business_goals`. Because the files are rewritten rather than supplemented, they must also be **renumbered** so FK targets exist first: `organizations` → roles → permissions → role_permissions → `organization_members` → `organization_invitations` → users-context → `business_goals`.
4. Seeder: 5 system roles → permissions → `role_permissions` from the PERMISSION_MATRIX grid. Idempotent, parent ids resolved by name.
5. Models: rename `OrganizationUser` → `OrganizationMember`; add `OrganizationRole`, `Permission`, `RolePermission`; add `SoftDeletes`; fix relationship FK arguments.
6. Queries (6 files) — column renames + `role->name` shaping. Verify each response shape is byte-identical to before.
7. Handlers (6) + Actions (1) + Controllers (3) — column renames; role resolution by name in `CreateOrganizationHandler` and `InviteMemberHandler`.
8. Frontend: update the `OrganizationRole` union and docblock in `src/types/organization.ts`. Run `npm run typecheck`.
9. Verify: register → create organization → invite member → accept → switch organization → dashboard loads. Every response shape unchanged.

**Definition of done:** `grep -rn "id_organization\|id_user\|id_created_by\|id_current_organization\|id_invited_by\|organization_users" app database` returns **zero** results, and the flow in step 9 behaves exactly as it did before.

---

## 8. Out of Scope (Future Specs)

- **Authorization enforcement** — Gates/Policies that actually consume `role_permissions`. Depends on this spec. → `specs/scaleup/security/authorization.md` against [AUTHORIZATION.md](../../../blueprint/scaleup/docs/specifications/security/AUTHORIZATION.md).
- **Community-first app shell** — routing + onboarding so Organizations are opt-in per [Design Principle 2](../../../blueprint/scaleup/docs/DESIGN_PRINCIPLES.md). The largest outstanding divergence.
- ~~**`users.name` → `first_name`/`last_name`**~~ — **pulled into scope and applied.** `User::$full_name` composes them; `RegisterRequest` now requires both. This is why the spec is no longer strictly behavior-preserving (see §5).
- **`user_profiles`, `user_settings`, `organization_profiles`** — Phase 1 identity tables. `organization_profiles` is where `logo_path` belongs.
- **Subscription tables** — `subscription_plans`, `subscriptions`, `entitlements`, `plan_entitlements`. The workspace is currently unlocked for free, contradicting [ADR-002](../../../blueprint/scaleup/docs/decisions/ADR-002-subscription-model.md).
- **Custom (non-system) organization roles** — the schema admits them via nullable `organization_id`; the UI and rules do not exist. [ORGANIZATION_ROLES.md](../../../blueprint/scaleup/docs/specifications/organization/ORGANIZATION_ROLES.md) Future Scope.
- **`organizations.size` / `logo_path`** — undocumented columns, kept. No logo upload exists yet; the feature and the column's home (`organization_profiles` per the blueprint) belong to the Organization Profile spec.
- ~~**Amend the blueprint for the `Accountant` role**~~ — **done.** Added to PERMISSION_MATRIX.md (§2 list, §3 matrix, a new §7 role section, and a Seeded Defaults subsection), ORGANIZATION_ROLES.md, DATABASE_SCHEMA.md, PLATFORM_ENTITIES.md, DATABASE_DOMAIN_MODEL.md, FEATURE_SPECIFICATIONS.md, and the Accountant column added to all 22 permission tables. [ADR-004](../../../blueprint/scaleup/docs/decisions/ADR-004-user-organization-separation.md) was deliberately left alone — amending an accepted ADR to add a role that post-dates it would falsify the record, and its list is illustrative ("roles such as").
- ~~**Accountant access to billing and invoices**~~ — **resolved: granted, read-only.** `subscription.manage` was split into `subscription.billing.view` + `subscription.manage`; the Accountant holds the first, the Owner both. Recording the ScaleUP subscription as a business expense and substantiating it for tax requires the invoice, and [BILLING.md](../../../blueprint/scaleup/docs/specifications/subscription/BILLING.md) confirms billing data holds no card details — those live with the payment provider. Deliberately non-hierarchical: an Administrator's authority is over people and settings, not the books.
- **"At least one active owner per organization"** — a blueprint rule with no enforcement today. Belongs with the Membership spec.
