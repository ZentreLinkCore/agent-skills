# .agents

AI agent rules and workflow skills for the HRMS codebase (Laravel + Vue).

- [AGENTS.md](./AGENTS.md) - entry point: full list of rules and the `webkit.*` skill workflow.
- [rules/project-profile.md](./rules/project-profile.md) - **start here**: the verified, concrete architecture of this codebase (backend patterns, route prefixes, frontend layout). The other rules are generic; this one is the facts.
- [rules/](./rules/) - coding, architecture, security, and HRMS domain rules the agent must follow.
- [skills/](./skills/) - `/webkit.investigate`, `/webkit.backend-implement`, `/webkit.frontend-implement`, `/webkit.fix`, `/webkit.refactor` — the concrete implementation workflow built on top of the rules.
- [docs/](./docs/) - human-readable reference docs on how existing features actually work (e.g. [docs/duty-roster.md](./docs/duty-roster.md)) — distinct from `specs/` (forward-looking build specs) and `reports/` (point-in-time investigation findings).
