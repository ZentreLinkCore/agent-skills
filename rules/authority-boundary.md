# Authority Boundary

## Purpose

Each workflow skill owns exactly one stage of the work. This rule keeps every skill inside that stage, so no stage is done twice, done badly by the wrong skill, or done without the checks its own skill would apply.

## The Rule

This skill owns ONLY its assigned responsibility.

Do NOT perform responsibilities belonging to another skill.

If a task belongs to another workflow stage:

1. **Stop.**
2. **Report the issue.**
3. **Do not continue.**

Do not compensate for another skill.

Do not generate work outside your authority.

## How to Report It

Name the task and the skill that owns it, in one line, and stop that work:

```text
Authority boundary: <the task> belongs to /webkit-<skill>. Not done here.
```

The stop applies to the out-of-authority task only. Work that belongs to the current skill is finished as normal, unless it depends on the out-of-authority task; then it stops too, and the report says so.

## Who Owns What

| Skill | Owns | Hands off |
| --- | --- | --- |
| `/webkit-specify` | Writing and maintaining the feature specification (`spec.md`) and its implementation plan (`plan.md`) | Code → `/webkit-implement`; reviews → `/webkit-verify`, `/webkit-code-review`; bugs → `/webkit-investigate` |
| `/webkit-implement` | Turning an approved specification into code by executing its plan (ticking `plan.md` tasks is its only edit there), then the version bump and CHANGELOG entry per [versioning.md](./versioning.md) | Spec changes → `/webkit-specify`; reviews → `/webkit-verify`, `/webkit-code-review`, `/webkit-design-review`; review findings → `/webkit-fix` |
| `/webkit-verify` | Checking the implementation against its specification, and reporting | Fixes → `/webkit-fix`; spec changes → `/webkit-specify`; code quality → `/webkit-code-review` |
| `/webkit-code-review` | Reviewing the code quality of a diff, and reporting | Fixes → `/webkit-fix`; spec conformance → `/webkit-verify`; visual depth → `/webkit-design-review` |
| `/webkit-design-review` | Reviewing the visual layer, and reporting | Fixes → `/webkit-fix`; code correctness → `/webkit-code-review`; spec conformance → `/webkit-verify` |
| `/webkit-investigate` | Finding and proving a root cause, and recommending the fix | Applying the fix → `/webkit-fix`; new behavior → `/webkit-specify`; cleanup → `/webkit-refactor` |
| `/webkit-fix` | Applying the approved fixes of one report, then the version bump and CHANGELOG entry per [versioning.md](./versioning.md) | New findings → the review skills or `/webkit-investigate`; new behavior or spec changes → `/webkit-specify`; unapproved cleanup → `/webkit-refactor` |
| `/webkit-refactor` | Behavior-preserving restructuring toward a stated goal | Bugs → `/webkit-investigate`, then `/webkit-fix`; new behavior → `/webkit-specify`, then `/webkit-implement` |
| `/webkit-document` | Writing the feature guide from the code that shipped | Code changes → `/webkit-fix` or `/webkit-implement`; root causes → `/webkit-investigate`; specs → `/webkit-specify` |
| `/webkit-migrate` | Moving an existing feature into the named target project with identical flow | New behavior → `/webkit-specify` in the target; source bugs → `/webkit-investigate` in the source; reviews → `/webkit-verify`, `/webkit-code-review` in the target |

## Examples

| Situation | Correct behavior |
| --- | --- |
| `/webkit-implement` finds the spec is missing a business rule | Stop: "Specification clarification required". Do not invent the rule; `/webkit-specify` owns it. |
| `/webkit-verify` finds a violated acceptance criterion | Report it as a finding. Do not fix the code; `/webkit-fix` owns that. |
| `/webkit-fix` notices an unrelated bug while applying a finding | Report "Additional issue discovered". Do not fix it; it needs its own review or investigation. |
| `/webkit-code-review` is asked to also correct what it found | Stop: the correction belongs to `/webkit-fix`. |
| `/webkit-refactor` would have to change a business result to finish | Stop that step: a behavior change belongs to `/webkit-investigate` and `/webkit-fix`. |
| `/webkit-document` finds the page does not work as specced | Record it under Known Issues. Do not change the code or the spec. |
