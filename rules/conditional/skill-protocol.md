# Skill Protocol (shared by every `/webkit-*` skill)

The steps every skill shares, written once. A `SKILL.md` holds only what is specific to its stage and links here for the rest; where a skill says "per protocol §n", this file is the instruction.

**Paths.** Links in a `SKILL.md` are relative to `.agents/skills/<skill>/`: `../../rules/` means `.agents/rules/`, `../../template/` means `.agents/template/`, even when the skill was loaded from `.claude/skills/` or `~/.claude/skills/`. Specs and reports always live under the project's `.agents/`.

## 1. Start of every run

1. **Project gate.** Resolve and state the project ([project-gate.md](../core/project-gate.md)). A ticket number means nothing without its project.
2. **Authority.** You own only your row in [authority-boundary.md](../core/authority-boundary.md). Anything else gets the one-line report and is not done.
3. **Resolve the ticket** ([ticket-numbering.md §4](./ticket-numbering.md#4-finding-a-ticket-from-a-feature-or-a-path)), in order: the argument (`T00004`, `F0135`, a path inside a ticket folder) → the current branch name (for an allocating skill, only when the request is that branch's own work: a new feature started on another ticket's branch is not that ticket) → `grep -ril '<feature|route|table>' .agents/specs/<project> --include='*.md'` → none. State the ticket and the evidence in your first message.
   - **Skill-defined resolution.** A skill whose SKILL.md defines its own resolution follows it: `/webkit-migrate` resolves the **target** project's ticket, never one from the source branch, and writes its contract to `.agents/migrations/`.
   - **No ticket.** Allocating skills (`/webkit-context`, `/webkit-specify`, `/webkit-investigate`, a standalone `/webkit-refactor`) reuse a matching ticket or allocate per [§2–§3](./ticket-numbering.md#2-allocating-a-number-the-increment). Every other skill never invents one: it stops, writes to `.agents/reports/`, or (`/webkit-document`) writes its guide to `.agents/docs/`, as its SKILL.md says.
4. **A ticket argument names a branch.** Fetch and analyze it per [ticket-numbering.md §8](./ticket-numbering.md#8-resolving-a-ticket-argument-to-its-branch) before reading the working tree. Read-only skills run Steps 1–4 only (no checkout); implementing skills continue to Step 5. Several matching branches: **stop and ask**.
5. **Branch gate.** Implementing skills only (`implement`, `fix`, `refactor`, `migrate`): run the [Mandatory Branch Gate](./branch-gate.md) before the first edit.

## 2. Context Loading Priority

Every SKILL.md has a **Context Loading Priority** section that narrows this default. Load in order, and stop as soon as you can act ([context-budget.md](../context-budget.md)):

1. The ticket's `task.md` (status, open items, next step). If `summary.md` exists, read it first: it replaces the old reports.
2. The ticket's `context.md` (and `touched-files.md`, `dependency-map.md`), if `/webkit-context` wrote them.
3. `spec.md` / `plan.md`: **only the sections the current step needs**. A report: its Metadata, status, and open findings, not every resolved one; a skill that acts on a report (`/webkit-fix`) reads that report in full.
4. Source: only the files steps 1–3 or Graphify name, opened at the cited lines.

Rules: the always-on set, plus the [rule router](../rule-router.md) rows for the files this run touches. Open a template when you write its file, not at the start.

**Avoid:** reading whole directories; loading reports or tickets unrelated to this run; loading all project documentation or a whole blueprint; re-reading a rule already applied this session; restating rules in your output.

## 3. Filling a template

Every document a skill writes is filled from its template in `.agents/template/`:

- Keep the structure exactly: no custom format, no added, removed, renamed, or reordered sections.
- Replace every `{{PLACEHOLDER}}`; a finished file contains no `{{`. Never leave a field blank: `N/A — <reason>`; an empty category keeps its heading and says "None."
- Follow the template's own fill rules, then delete every guide comment except the history marker (`<!-- Run history -->`; the feature guide's is `<!-- Update history -->`).

## 4. Writing a report

For `investigation.md`, `refactor.md`, `verify.md`, `code-review.md`, `design-review.md` ([ticket-numbering.md §5](./ticket-numbering.md#5-the-file-contract)):

1. **Where.** Ticket folder → `.agents/specs/<project>/T#####/<fixed-name>.md`. A legacy portal spec (`specs/<project>/<portal>/<feature>.md`) → `.agents/reports/<domain>-<feature>-<kind>-<YYYYMMDD>.md`. No ticket folder → `.agents/reports/<scope>-<kind>-<YYYYMMDD>.md`, with the branch named in Metadata. The Ticket row names the `F####` ticket when the work has one (both IDs when a `T#####` folder also exists, [ticket-numbering.md §8.4](./ticket-numbering.md#84-where-the-report-goes)); work with no ticket at all says `None — <reason>`. Never allocate a ticket just to have somewhere to write.
2. **Re-run.** Before overwriting, append the previous run's line under `<!-- Run history -->` (`- vN — <date> — <what that run found> — <status>`), then bump the Metadata run row and its date, and write one line on what changed. A previous `vN.k` row is a [fix pass](./ticket-numbering.md#fix-pass): append it like any run, number this run `v(N+1)`, and re-check every `✅ FIXED` line rather than trusting it. Never delete a history line.
3. **Findings.** Number them as the report's template says: by default one sequence across all severities, so `Finding #3` names one issue (verify numbers BLOCKER and REQUIRED FIX together and its improvements separately). Dependency-first within a severity, so `/webkit-fix` works straight down. Every finding names a real, current `file:line`, and every finding the template gives a Resolution line ends with `- **Resolution:** Open`.
4. **Read-only.** A report skill edits no application code and no spec (except `/webkit-verify`'s Case 1). Its only writes are the report and, where [task.md upkeep](./ticket-numbering.md#taskmd-upkeep) gives it rows (verify, code-review, design-review), its own `task.md` rows. `/webkit-investigate` and `/webkit-refactor` do not write `task.md`.

## 5. Updating `task.md`

Per [task.md upkeep](./ticket-numbering.md#taskmd-upkeep), at the end of the run, from the files you just read or wrote:

- Update only your own §1 row, your own items in §2–§4, **Done**, **Next step** (exactly one command), **Last Updated**, and add one line at the **top** of §5 (`<date> · <command> · <what changed> · <resulting status>`).
- Never untick an item; never edit or delete a §5 line.
- A ticket with a spec but no `task.md`: create it from [the task-tracker template](../../template/task-tracker.md) first. A ticket with no spec (a bug ticket) has no `task.md`.

## 6. Code-writing runs

For `implement`, `fix`, `refactor`, `migrate`:

- **Scan before creating** ([system-awareness.md](./system-awareness.md)) and record the search behind every new file.
- **Every code change ships with a test that has run** ([testing.md](./testing.md#every-code-change-ships-with-a-test-mandatory)); a test that could not run is reported `written, not run — <reason>` with its command, never as passing.
- **Smallest diff**, in the surrounding file's style ([code-quality.md](./code-quality.md)).
- **Frontend build check on the changed files only** (`node .agents/scripts/check-changed.mjs`), never the full `npm run build` unless asked or the bundle config changed ([testing.md](./testing.md#frontend-build-check-changed-files-only)).
- **Refresh the code graph** after the last edit when `graphify-out/graph.json` exists: `graphify update .` (AST only, no API cost; never commit `graphify-out/`), so the next skill sees this run's code ([code-search.md](./code-search.md)).
- **Version step** (`implement`, `fix`): last, per [versioning.md](./versioning.md). Read it then, not before.
- Never stage or commit. End with a suggested Conventional Commit message ([git-workflow.md](../core/git-workflow.md)).

## 7. End of every run

1. Name every file written, with its path and the resulting status.
2. Point to `task.md` for what is left (ticketed work, for the skills that keep it).
3. Print the skill's Follow-up Commands, filled with the real ticket and paths. Suggest a re-run of a review only when the skill's own rule says one is needed.

## 8. Authority boundary: worked examples

| Situation | Correct behavior |
| --- | --- |
| `/webkit-implement` finds the spec is missing a business rule | Stop: "Specification clarification required". Do not invent the rule. |
| `/webkit-verify` finds a violated acceptance criterion | Report a finding. Do not fix the code. |
| `/webkit-verify` proves the spec misstates a rule the code already follows (Case 1) | Correct the spec and plan in place as a Minor change, and log it. A stakeholder's new requirement (Case 2) goes to `/webkit-specify`. |
| `/webkit-fix` has applied and checked a verify finding | Mark it `✅ FIXED` in `verify.md`, recompute the status, tick `plan.md` and `task.md`. No re-run of `/webkit-verify` is needed. |
| `/webkit-fix` notices an unrelated bug | Report "Additional issue discovered". Do not fix it. |
| `/webkit-code-review` is asked to also correct what it found | Stop: the correction belongs to `/webkit-fix`. |
| `/webkit-refactor` would have to change a business result | Stop that step: a behavior change belongs to `/webkit-investigate` and `/webkit-fix`. |
| `/webkit-document` finds the page does not work as specced | Record it under Known Issues. Do not change the code or the spec. |
| `/webkit-context` finds the request is really a bug | Write the map, then hand off: `/webkit-investigate` owns the root cause. |
| `/webkit-summarize` notices an open finding | Record it in `summary.md` as open. Do not close it. |

## 9. Who owns what

| Skill | Owns | Hands off |
| --- | --- | --- |
| `/webkit-context` | The ticket's context map before specification: `context.md`, `dependency-map.md`, `touched-files.md` | Requirements, spec, plan → `/webkit-specify`; code → `/webkit-implement`; bugs → `/webkit-investigate` |
| `/webkit-specify` | Writing and maintaining `spec.md` and its `plan.md`; creating the ticket's `task.md` | Code → `/webkit-implement`; reviews → `/webkit-verify`, `/webkit-code-review`; bugs → `/webkit-investigate` |
| `/webkit-implement` | Executing an approved plan into code (its only `plan.md` edits are task ticks and Plan Status, mirrored in `task.md`), then the version bump and CHANGELOG per [versioning.md](./versioning.md) | Spec changes → `/webkit-specify`; reviews → `/webkit-verify`, `/webkit-code-review`, `/webkit-design-review`; findings → `/webkit-fix` |
| `/webkit-verify` | Checking the implementation against its spec and reporting; then a **Case 1** spec correction (Minor, in place) with its plan change, ticks for plan tasks it proved done, `task.md` | Fixes → `/webkit-fix`; requirement changes and new spec versions (Case 2) → `/webkit-specify`; code quality → `/webkit-code-review` |
| `/webkit-code-review` | Reviewing a diff's code quality and reporting (with its rows in `task.md`) | Fixes → `/webkit-fix`; spec conformance → `/webkit-verify`; visual depth → `/webkit-design-review` |
| `/webkit-design-review` | Reviewing the visual layer and reporting (with its rows in `task.md`) | Fixes → `/webkit-fix`; code correctness → `/webkit-code-review`; spec conformance → `/webkit-verify` |
| `/webkit-investigate` | Finding and proving a root cause, and recommending the fix | Applying it → `/webkit-fix`; new behavior → `/webkit-specify`; cleanup → `/webkit-refactor` |
| `/webkit-fix` | Applying one report's approved fixes, the version bump and CHANGELOG, then closing the loop: Resolution lines and recomputed status in that report (a fix pass), plan ticks, the spec's §14 Review findings note, `Done` when the ticket closes, `task.md` | New findings → the review skills or `/webkit-investigate`; new behavior or requirement changes → `/webkit-specify`; unapproved cleanup → `/webkit-refactor` |
| `/webkit-refactor` | Behavior-preserving restructuring toward a stated goal | Bugs → `/webkit-investigate`, then `/webkit-fix`; new behavior → `/webkit-specify`, then `/webkit-implement` |
| `/webkit-document` | Writing the feature guide from the code that shipped | Code changes → `/webkit-fix` or `/webkit-implement`; root causes → `/webkit-investigate`; specs → `/webkit-specify` |
| `/webkit-migrate` | Moving an existing feature into the named target project with identical flow | New behavior → `/webkit-specify`, then `/webkit-implement`, in the target; source bugs → `/webkit-investigate`, then `/webkit-fix`, in the source; cleanup → `/webkit-refactor`; reviews → `/webkit-verify`, `/webkit-code-review`, `/webkit-design-review` in the target |
| `/webkit-summarize` | Compressing a ticket's history into `summary.md` | Any change to the spec, plan, reports, or code → the skill that owns that file |

**Bookkeeping is not a boundary crossing.** Recording what a run did in the ticket's shared documents (a fix pass's Resolution lines and status, plan ticks, the §14 Review findings note, `task.md`) belongs to the skill that did the work, per [ticket-numbering.md §5](./ticket-numbering.md#5-the-file-contract). Changing a requirement, adding a finding, or re-reviewing still crosses it.
