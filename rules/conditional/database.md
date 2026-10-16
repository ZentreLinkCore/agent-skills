# Database: schema conventions and migration safety

Read the section for **your** project only. The two web projects' conventions are **direct opposites**; never carry one into the other.

## 1. All projects

- **Reuse before create.** If a model and its table already cover the feature's data, use them; never a parallel table. Never `Schema::create('<table>')` for a table any migration already creates. Procedure: [system-awareness.md](./system-awareness.md).
- **Never run migrations or seeders yourself.** Write the migration and model; list the command (with rollback) for the user.
- **Always `timestamps()`.** Index columns that are filtered, joined, or sorted on.
- **Writes** that touch more than one row or table run inside `DB::transaction(...)`, in the Handler ([backend.md](./backend.md)).
- **Model `$fillable` and `$casts` are the field list** for validation rules, `select()` columns, and frontend shapes.
- **Every new table, column, index, or changed type gets a schema test** ([testing.md](./testing.md#backend-phpunit)).

## 2. `<source-path>` (Vue)

> [!IMPORTANT]
> **Zero DB-level foreign keys. Index the relationship column instead.** Referential integrity is enforced in the Query / Handler layer, not the database.

- **Relationship columns** are `id`-prefixed (`idacct`, `idpayperiod`, `idtranstype`, `idclass`, `idbonusrun`), `unsignedBigInteger` / `integer`, with a plain **`->index()`**, never `->foreign()`. A real FK has repeatedly broken migrations here: `payroll_entry.idacct` once pointed at a non-existent `account` table; the real table is **`accounts`** (and the view `vw_accounts_details.id` = `accounts.id`).
- **Soft delete is a `status` column** (`0` = disabled / inactive, `1` = active; some tables add states), not `SoftDeletes`. Deleting a lookup row that historical records reference (payroll, …) is a `status = 0` disable, never a hard delete. Use `SoftDeletes` only where sibling tables in that domain already do.
- **Lookup tables** (`transactionclass`, `transactiontype`, …) are referenced by `id` from many tables: seed them by resolving the parent `id` through a stable key (`code`), never by hard-coding auto-increment ids.
- **Migration locations**: a new table (`Schema::create`) goes in `database/migrations/table/<table>/` (or top level, where flat timestamped siblings live); an alteration (`Schema::table`) goes in `database/migrations/alters/<domain_or_feature>/`.

## 3. `<source-path>` (React)

> [!CAUTION]
> The **opposite** of (Vue). Follow [`DATABASE_SCHEMA.md`](../../blueprint/scaleup/docs/DATABASE_SCHEMA.md).

- **Foreign keys are real**: `foreignId()->constrained()` / `->foreign()->references()`.
- **Relationship columns are `<singular_parent>_id`** (`organization_id`, `user_id`, `role_id`), never the `id_`-prefixed form. Existing `id_organization`-style columns are drift ([backend.md §6](./backend.md#6-source-path-react-known-drift)): do not copy them.
- **Soft deletes use `deleted_at`** (`SoftDeletes`). `status` still exists for lifecycle state where the schema defines it.
- **Multi-tenancy**: one database, shared tables, organization scoping. Every organization-owned table carries `organization_id`, and **every query for organization-owned data filters by the active organization**. Cross-organization leakage is the one non-negotiable defect class.
