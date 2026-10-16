# Authority Boundary (always-on)

Each `/webkit-*` skill owns exactly one workflow stage. A task that belongs to another stage: **stop** it, **report** it in one line, and **do not continue** it. Never compensate for another skill or work outside your authority.

`Authority boundary: <the task> belongs to /webkit-<skill>. Not done here.`

The stop covers only that task: finish your own work, unless it depends on it; then stop that too, and say so.

**Bookkeeping is not a crossing.** Recording what your run did in the ticket's shared documents (a fix pass's Resolution lines and status, plan ticks, the spec's §14 Review findings note, `task.md`) belongs to the skill that did the work. Changing a requirement, adding a finding, or re-reviewing does cross it.

Each `SKILL.md` names what it owns and its handoffs. The full table and worked examples: `conditional/skill-protocol.md` §8–§9.
