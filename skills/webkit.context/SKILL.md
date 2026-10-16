---
name: webkit-context
description: |
  Maps a feature's context BEFORE it is specified: reuses or allocates the ticket and writes `context.md` (scope, entry points, findings, constraints), `dependency-map.md` (how the affected pieces connect), and `touched-files.md` (files to modify, create, reuse, and NOT touch) into `.agents/specs/<project>/T#####/`, using Graphify first. Read-only on application code; designs nothing. The spec is /webkit-specify.
  Trigger: "/webkit-context", "map the context", "context map", "what does this touch", "impact map", "before we spec this"
  Use when: a feature or change is about to be specified and its affected code, reusable pieces, and no-go files should be pinned down first.
---

# Webkit Context

Builds the ticket's **context map** before specification, so `/webkit-specify`, `/webkit-implement`, and the reviews start from one verified list of what the work touches, what already exists to reuse, and what must not change, instead of each re-scanning the codebase.

> [!IMPORTANT]
> **Never modify application code, a spec, a plan, or a report.** Outputs: `context.md`, `dependency-map.md`, and `touched-files.md` in the ticket folder, plus one `task.md` §5 line when `task.md` exists. **Map, do not design**: no schemas, contracts, acceptance criteria, or task lists; those belong to the spec and the plan.

Shared steps follow [skill-protocol.md](../../rules/conditional/skill-protocol.md). **Authority:** mapping a ticket's context before it is specified. Requirements, spec, plan → `/webkit-specify`; code → `/webkit-implement`; a bug's root cause → `/webkit-investigate`.

## Inputs

| Form | Meaning |
| --- | --- |
| `/webkit-context <request>` | Map a new feature. Reuses the ticket that already covers it, or allocates one. |
| `/webkit-context <target_path> <request>` | Same, starting from that code location. |
| `/webkit-context T##### [<request>]` | Map, or re-map, an existing ticket: before a spec Major change, or after the code moved. |

## Context Loading Priority

1. **`task.md`**, if the ticket already has one (read `summary.md` first if it exists).
2. **The existing `context.md`**, on a re-run: update it in place.
3. **`spec.md` / `plan.md` only for an existing ticket**: the spec's Metadata and §1–§4 (what and scope); plan §3 File Change Map to compare. A new feature needs neither.
4. **Source, located through Graphify first** ([context-budget.md §2](../../rules/context-budget.md#2-find-code-graphify-first-then-targeted-search)), then opened only at the lines a node names: a model's `$table` / `$fillable` / relations, a migration's `Schema` block, a route line, a Query or Handler signature. Never whole modules.

Rules: [project-gate.md](../../rules/core/project-gate.md) and the router rows for the layers the request touches, used to classify files, not to design. In (React), only the one blueprint specification the feature needs. Templates at write time. **Avoid:** directory listings, whole-module reads, other tickets' reports, the whole blueprint, and any solution design.

## Phase 1 — Project and ticket

Per protocol §1. This is an **allocating** skill: a ticket the user named → use it; a ticket that already covers the feature (`grep -ril '<feature|route|table>' .agents/specs/<project> --include='*.md'`) → use it; a hit in a legacy portal spec → say so, and map into a new ticket only if the user agrees; nothing → allocate per [ticket-numbering.md §2–§3](../../rules/conditional/ticket-numbering.md#2-allocating-a-number-the-increment). **No branch**: this skill writes no application code. State the project and the ticket.

## Phase 2 — Terms to look for

From the request, list the terms you will query: entities, actions, roles or portals, screens, and endpoints it names. Do not decide behavior. Anything the request leaves open becomes an Open Question in `context.md`.

## Phase 3 — Locate (Graphify first)

When `graphify-out/graph.json` exists at the project root:

1. **Start from exact names**: classes, components, routes, and files the request names or a targeted search finds. `graphify query "<terms>" --seed <exact/path> --budget 1500` only to discover a label: it is fuzzy and truncates.
2. **Explain each node**: `graphify explain "<ExactName>" --all` for every caller and callee; check `Source:` (basenames collide).
3. **Trace the chains**: `graphify path "<page or route>" "<model>"` for route → controller → Query / Handler / Action → model, and page → composable / hook → api function → endpoint.
4. **Find what a change would break**: `graphify affected "<node>" --depth 2` for every node likely to change. These callers go in the dependency map and, when their behavior must hold, in the do-not-touch list.
5. **Grep the blind spots**: route → controller method, frontend `api/...` strings → backend routes, table columns, and globally-registered components are not in the graph ([context-budget.md §2](../../rules/context-budget.md#2-find-code-graphify-first-then-targeted-search)).
6. **Check freshness**: a node whose file no longer exists, or whose `loc` does not match the file, means the graph is stale there. Note it, and use the fallback for that area (`graphify update .` refreshes it: AST only, no API cost).

No graph, or no match (exit `4`): targeted search in the [context-budget.md](../../rules/context-budget.md#2-find-code-graphify-first-then-targeted-search) order, stopping at the first acceptable match.

## Phase 4 — Verify in source

For each candidate: confirm it exists (`git ls-files <path>`), open it at the line, and confirm what it is. Run the [System Awareness scan](../../rules/conditional/system-awareness.md#2-the-scan) for the entities found: models, migrations, routes (`php artisan route:list --path=api` where available), controllers and Query / Handler / Action classes. Record `file:line` evidence for every fact. Anything you cannot verify is an **Open Question**, never a listed fact.

## Phase 5 — Classify

Every file lands in exactly one category of `touched-files.md`:

- **Modify**: will very likely change, with the construct and its `file:line`.
- **Create (candidate)**: nothing covers the need; give the search that found nothing, and a path that follows the sibling layout.
- **Reuse (read-only)**: existing components, Queries, Actions, utils, or design-system pieces to build on, with why each fits.
- **Do NOT touch**, each with its reason:
  - shared infrastructure (the HTTP client and its interceptors, route aggregators such as `useApiWebRoute.ts`, base classes, the `routes/api.php` orchestrator beyond adding a loader line);
  - other portals or domains, and the other app (web vs. mobile);
  - generated or vendored code (`vendor/`, `node_modules/`, `dist/`, `android/`, `ios/`);
  - callers from `affected` whose behavior must hold;
  - files another open ticket is changing (`grep -l '<path>' .agents/specs/<project>/T*/plan.md .agents/specs/<project>/T*/touched-files.md`);
  - (React) code carrying [known drift](../../rules/conditional/backend.md#6-source-path-react-known-drift) that this ticket must not copy.
- **Tests**: existing tests that cover the area (to extend), and where new ones belong per [testing.md](../../rules/conditional/testing.md#every-code-change-ships-with-a-test-mandatory).

## Phase 6 — Write the map

Fill the three templates per protocol §3 and write them into the ticket folder:

| File | Template | Holds |
| --- | --- | --- |
| `context.md` | [ticket-context.md](../../template/ticket-context.md) | Purpose as requested (one paragraph, not a spec), the project facts that matter, entry points, key findings with evidence, the rules that apply, risks, Open Questions, and the Graphify status (used / stale / absent, with the commands run) |
| `dependency-map.md` | [dependency-map.md](../../template/dependency-map.md) | A mermaid flowchart of the chains, an edge table with evidence, and the `affected` callers |
| `touched-files.md` | [touched-files.md](../../template/touched-files.md) | The Phase 5 categories, one row per file: path, reason, evidence |

- **Re-run**: update in place; bump `context.md`'s **Context Run** row and append the previous run under `<!-- Run history -->` (protocol §4.2). The other two files are views of the latest run and are rewritten.
- **Keep it small**: every later session reads these first. No pasted code; one line per row; aim for what a spec writer needs.
- **`task.md`**: only if it exists, one §5 line (protocol §5).

## Follow-up commands

- Write the spec and plan from this map: `/webkit-specify <ticket> <request>`
- The request turned out to be a defect: `/webkit-investigate <ticket> <symptom>`
- Re-map after the code moves, or before a spec Major change: `/webkit-context <ticket>`
