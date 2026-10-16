# Agent Rules

<!-- agent-kit root entry v2. Installed by .agents/setup.sh from .agents/claude-adapter/AGENTS.md: edit that source, not this copy. -->

Entry point for any coding agent (Claude Code, Antigravity/Gemini, Cursor, Copilot). It is an index and holds no rules of its own. Do not preload `.agents/`; load what is listed here, when it is listed.

## Always load (every session)

1. [`.agents/rules/core/project-gate.md`](./.agents/rules/core/project-gate.md): resolve and state the project first
2. [`.agents/rules/core/authority-boundary.md`](./.agents/rules/core/authority-boundary.md)
3. [`.agents/rules/core/git-workflow.md`](./.agents/rules/core/git-workflow.md)
4. [`.agents/rules/core/security-baseline.md`](./.agents/rules/core/security-baseline.md)
5. [`.agents/rules/context-budget.md`](./.agents/rules/context-budget.md): Graphify first, summaries before history
6. [`.agents/rules/rule-router.md`](./.agents/rules/rule-router.md): then load only the conditional rules it picks

Claude Code loads these six automatically from `.claude/rules/`.

## Then, only when needed

- **A task touches a layer** (API, database, frontend, mobile, realtime, payroll, tests): the router's rows from `.agents/rules/conditional/`.
- **A workflow command** (`/webkit-*`): the skill's `.agents/skills/<skill>/SKILL.md` and `.agents/rules/conditional/skill-protocol.md`. In agents without slash commands, read the `SKILL.md` and follow it.
- **Resuming a ticket**: `.agents/specs/<project>/T#####/summary.md` (if any), then `task.md`, then `context.md`, then only the spec or plan sections you need.

The kit index, with every skill and the ticket flow: [`.agents/AGENTS.md`](./.agents/AGENTS.md).
