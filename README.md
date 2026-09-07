# .agents

AI agent rules and workflow skills for the HRMS codebase (Laravel + Vue).

- [AGENTS.md](./AGENTS.md) - entry point: full list of rules and the `webkit.*` skill workflow.
- [rules/project-profile.md](./rules/project-profile.md) - **start here**: the verified, concrete architecture of this codebase (backend patterns, route prefixes, frontend layout). The other rules are generic; this one is the facts.
- [rules/](./rules/) - coding, architecture, security, and HRMS domain rules the agent must follow.
- [skills/](./skills/) - `/webkit.investigate`, `/webkit.backend-implement`, `/webkit.frontend-implement`, `/webkit.fix`, `/webkit.refactor` — the concrete implementation workflow built on top of the rules.
- [specs/](./specs/) - one **ticket folder** per piece of work, inside its project (`specs/subhrms/T00001/` holding `specs.md`, `investigation.md`, `refactor.md`, `verify.md`, `code-review.md` — whichever its work produced), implemented on a branch named `T00001`. Convention: [rules/ticket-numbering.md](./rules/ticket-numbering.md).
- [docs/](./docs/) - human-readable reference docs on how existing features actually work (e.g. [docs/duty-roster.md](./docs/duty-roster.md)) — distinct from `specs/` (per-ticket working documents).
- [reports/](./reports/) - the pre-ticket archive of investigation and review reports, plus the fallback for work that has no ticket. New ticketed work writes into its ticket folder instead.
