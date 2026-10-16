# Agent Kit — Index

What lives where in `.agents/`, and when to load it. This file states no rules; each rule has one home, linked below. In a project, the entry point is the root `AGENTS.md` (installed from [claude-adapter/AGENTS.md](./claude-adapter/AGENTS.md)); humans start at [README.md](./README.md).

## 1. What to load, when

| When | Load | Notes |
| :--- | :--- | :--- |
| **Every session** | [rules/core/](./rules/core/) ([project-gate](./rules/core/project-gate.md), [authority-boundary](./rules/core/authority-boundary.md), [git-workflow](./rules/core/git-workflow.md), [security-baseline](./rules/core/security-baseline.md)), [context-budget.md](./rules/context-budget.md), [rule-router.md](./rules/rule-router.md) | The always-on set. Claude Code loads it from `.claude/rules/` (installed by [setup.sh](./setup.sh)); other agents read it first. |
| **A task touches a layer** | the rows [rule-router.md](./rules/rule-router.md) picks from [rules/conditional/](./rules/conditional/) | Never preload the folder. Inside a file, read only your project's sections. |
| **A `/webkit-*` command runs** | its `skills/<skill>/SKILL.md`, plus [skill-protocol.md](./rules/conditional/skill-protocol.md) | Other agents: read the `SKILL.md` and follow it; the content is tool-neutral. |
| **A skill writes a document** | that document's template in [template/](./template/) | Opened at write time, not at the start. |
| **Resuming a ticket** | `specs/<project>/T#####/summary.md` (if any) → `task.md` → `context.md` → only the spec / plan sections needed | [context-budget.md §1](./rules/context-budget.md#1-read-in-this-order-and-stop-when-you-can-act) |
| **Finding code** | Graphify (`graphify-out/` at the project root), then targeted search | [context-budget.md §2](./rules/context-budget.md#2-find-code-graphify-first-then-targeted-search) |

The other `rules/*.md` files at the root are **compatibility redirects** for links written before the split. Never load them for new work.

## 2. Skills

| Skill | Stage | Reads first | Writes |
| :--- | :--- | :--- | :--- |
| [webkit.context](./skills/webkit.context/SKILL.md) | Map the affected, reusable, and do-not-touch files before the spec | the request, the graph | `context.md`, `dependency-map.md`, `touched-files.md` |
| [webkit.specify](./skills/webkit.specify/SKILL.md) | Spec and plan before any code | `context.md` | `spec.md`, `plan.md`, `task.md` |
| [webkit.implement](./skills/webkit.implement/SKILL.md) | Execute the approved plan, backend first | `task.md`, `plan.md` | code + tests, version bump |
| [webkit.verify](./skills/webkit.verify/SKILL.md) | Adversarial spec conformance | `spec.md` (all of it) | `verify.md` |
| [webkit.code-review](./skills/webkit.code-review/SKILL.md) | Code quality of the diff | the diff | `code-review.md` |
| [webkit.design-review](./skills/webkit.design-review/SKILL.md) | Visual-layer fit | the diff, `ui-design.md` | `design-review.md` |
| [webkit.fix](./skills/webkit.fix/SKILL.md) | Apply one report's approved fixes and close the loop | that report | code + tests, the report's fix pass |
| [webkit.investigate](./skills/webkit.investigate/SKILL.md) | Prove a bug's root cause | the symptom, the graph | `investigation.md` |
| [webkit.refactor](./skills/webkit.refactor/SKILL.md) | Behavior-preserving restructuring | the target | code + tests, `refactor.md` |
| [webkit.document](./skills/webkit.document/SKILL.md) | Feature guide from the shipped code | the code | `docs/<feature>.md` |
| [webkit.migrate](./skills/webkit.migrate/SKILL.md) | Move a feature into another project | the source chain | target code, `migrations/` |
| [webkit.summarize](./skills/webkit.summarize/SKILL.md) | Compress a ticket's history | `task.md`, report summaries | `summary.md` |

Who owns what, and the handoffs: [authority-boundary.md](./rules/core/authority-boundary.md).

## 3. The flow

```text
feature:  context ─▶ specify ─▶ implement ─▶ verify · code-review · design-review ─▶ fix ─▶ (Done) ─▶ summarize ─▶ document
bug:      investigate ─▶ fix
cleanup:  refactor (standalone, or on a ticket's code-review findings)
```

`/webkit-context`, `/webkit-specify`, `/webkit-investigate`, and a standalone `/webkit-refactor` open tickets; every other skill continues one. Implementing skills (`implement`, `fix`, `refactor`, `migrate`) run the branch gate first. After a fix, the review is not re-run just to record it: `/webkit-fix` closes the findings in the report.

## 4. Where things live

| Path | Holds |
| :--- | :--- |
| [specs/](./specs/)`<project>/T#####/` | One ticket folder per piece of work; fixed filenames per [ticket-numbering.md §5](./rules/conditional/ticket-numbering.md#5-the-file-contract). Older specs sit in portal folders beside them and stay valid. |
| [template/](./template/) | The format of every document a skill writes |
| [config/](./config/)`<project>.yml` | Per-project settings (versioning) |
| [blueprint/](./blueprint/)`<project>/` | Product blueprints: the source of truth for behavior where one exists. Read one specification, never the folder. |
| [docs/](./docs/) | Feature guides (`/webkit-document`) and kit docs ([token-optimization.md](./docs/token-optimization.md)) |
| [reports/](./reports/) | The pre-ticket archive, and reports for work with no ticket |
| [claude-adapter/](./claude-adapter/) | The root `AGENTS.md` that `setup.sh` installs; no rules |
