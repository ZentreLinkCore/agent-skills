# Claude Adapter

This folder holds only what has to differ for one tool: the portable [`AGENTS.md`](./AGENTS.md) that [`../setup.sh`](../setup.sh) copies to the project root for non-Claude agents. It holds **no rules**. Every rule has exactly one copy, in [`../rules/`](../rules/).

```bash
bash .agents/setup.sh            # this project only
bash .agents/setup.sh --global   # + one skills copy for EVERY project on this machine
```

## What setup.sh installs

| Installed at | Points to | Loaded |
| :--- | :--- | :--- |
| `.claude/rules/<name>.md` | a **symlink** to each always-on rule: `.agents/rules/core/*.md`, `.agents/rules/rule-router.md`, `.agents/rules/context-budget.md` | every turn (Claude Code auto-loads `.claude/rules/*.md`) |
| `.claude/skills` | a symlink to `.agents/skills` | a skill's `SKILL.md` when its command runs; only the `description:` frontmatter on every turn |
| `AGENTS.md` (project root) | a copy of [`AGENTS.md`](./AGENTS.md) here, only when the project has none (an existing one is never overwritten) | by non-Claude agents (Antigravity, Cursor, Copilot) |

Conditional rules (`.agents/rules/conditional/`) are never installed: the router in the always-on set tells the agent which one to read, when.

## Why it is shaped this way

Claude Code loads **every** `.md` in `.claude/rules/` on **every** turn. Whatever is installed there is paid for constantly, whether the task needs it or not, and content for the other project in context is what makes an agent build to the wrong stack.

- Earlier versions kept a second copy of the rules here. Once that copy was refreshed with the full library, every turn loaded ~33,600 tokens of rules. Symlinking the always-on files instead means there is nothing here to drift and nothing to re-copy.
- On Windows without symlink support, Git Bash's `ln -s` silently makes a **copy**. `setup.sh` detects that and warns: re-run it after every `git -C .agents pull` so the copies stay current.
- `setup.sh` also retires what older versions installed (the full copies and the pointer stubs): symlinks are removed, and real files are moved to `.claude-rules-backup/`, never deleted.

## Editing

- **A rule**: edit it in `../rules/` (core or conditional). Nothing to copy: the installed files are symlinks.
- **The always-on set**: a file belongs in `../rules/core/` only if every turn needs it. Each extra always-on file costs its full size on every request; prefer a router row.
- **Skills**: there is no skills adapter. A `SKILL.md` is read only when its command runs, so a stub would add a read instead of saving one. Keep each `description:` short (triggers and guarantees): it is loaded on every turn for command discovery.
