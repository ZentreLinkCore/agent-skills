# Authority Boundary (always-on)

Each `/webkit-*` skill owns exactly one workflow stage, so no stage is done twice, done by the wrong skill, or done without the checks its own skill applies.

**The rule.** A task that belongs to another stage is not done here:

1. **Stop** that task.
2. **Report** it in one line: `Authority boundary: <the task> belongs to /webkit-<skill>. Not done here.`
3. **Do not continue** it. Do not compensate for another skill, and do not generate work outside your authority.

The stop covers only the out-of-authority task. Finish your own work, unless it depends on that task; then stop it too, and say so.

## Who owns what

| Skill | Owns | Hands off |
| --- | --- | --- |
| `/webkit-context` | The ticket's context map before specification: `context.md`, `dependency-map.md`, `touched-files.md` | Requirements, spec, plan → `/webkit-specify`; code → `/webkit-implement`; bugs → `/webkit-investigate` |
| `/webkit-specify` | Writing and maintaining `spec.md` and its `plan.md`; creating the ticket's `task.md` | Code → `/webkit-implement`; reviews → `/webkit-verify`, `/webkit-code-review`; bugs → `/webkit-investigate` |
| `/webkit-implement` | Executing an approved plan into code (its only `plan.md` edits are task ticks and Plan Status, mirrored in `task.md`), then the version bump and CHANGELOG per [versioning.md](../conditional/versioning.md) | Spec changes → `/webkit-specify`; reviews → `/webkit-verify`, `/webkit-code-review`, `/webkit-design-review`; findings → `/webkit-fix` |
| `/webkit-verify` | Checking the implementation against its spec and reporting; then a **Case 1** spec correction (Minor, in place) with its plan change, ticks for plan tasks it proved done, `task.md` | Fixes → `/webkit-fix`; requirement changes and new spec versions (Case 2) → `/webkit-specify`; code quality → `/webkit-code-review` |
| `/webkit-code-review` | Reviewing a diff's code quality and reporting (with its rows in `task.md`) | Fixes → `/webkit-fix`; spec conformance → `/webkit-verify`; visual depth → `/webkit-design-review` |
| `/webkit-design-review` | Reviewing the visual layer and reporting (with its rows in `task.md`) | Fixes → `/webkit-fix`; code correctness → `/webkit-code-review`; spec conformance → `/webkit-verify` |
| `/webkit-investigate` | Finding and proving a root cause, and recommending the fix | Applying it → `/webkit-fix`; new behavior → `/webkit-specify`; cleanup → `/webkit-refactor` |
| `/webkit-fix` | Applying one report's approved fixes, the version bump and CHANGELOG, then closing the loop: Resolution lines and recomputed status in that report (a fix pass), plan ticks, the spec's §14 Review findings note, `Done` when the ticket closes, `task.md` | New findings → the review skills or `/webkit-investigate`; new behavior or requirement changes → `/webkit-specify`; unapproved cleanup → `/webkit-refactor` |
| `/webkit-refactor` | Behavior-preserving restructuring toward a stated goal | Bugs → `/webkit-investigate`, then `/webkit-fix`; new behavior → `/webkit-specify`, then `/webkit-implement` |
| `/webkit-document` | Writing the feature guide from the code that shipped | Code changes → `/webkit-fix` or `/webkit-implement`; root causes → `/webkit-investigate`; specs → `/webkit-specify` |
| `/webkit-migrate` | Moving an existing feature into the named target project with identical flow | New behavior → `/webkit-specify`, then `/webkit-implement`, in the target; source bugs → `/webkit-investigate`, then `/webkit-fix`, in the source; cleanup → `/webkit-refactor`; reviews → `/webkit-verify`, `/webkit-code-review`, `/webkit-design-review` in the target |
| `/webkit-summarize` | Compressing a ticket's history into `summary.md` | Any change to the spec, plan, reports, or code → the skill that owns that file |

**Bookkeeping is not a boundary crossing.** Recording what a run did in the ticket's shared documents (a fix pass's Resolution lines and status, plan ticks, the §14 Review findings note, `task.md`) belongs to the skill that did the work, per [ticket-numbering.md §5](../conditional/ticket-numbering.md#5-the-file-contract). Changing a requirement, adding a finding, or re-reviewing still crosses it.

Worked examples of the rule in practice: [skill-protocol.md §8](../conditional/skill-protocol.md#8-authority-boundary-worked-examples).
