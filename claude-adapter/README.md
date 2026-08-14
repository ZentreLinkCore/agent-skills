# Claude Adapter

Everything in this folder is **derived**, not canonical. It exists so a project can be wired up in one command without paying for the full rule library on every turn.

Install it with [`../setup.sh`](../setup.sh) — do not copy these files by hand.

```bash
bash .agents/setup.sh            # this project only
bash .agents/setup.sh --global   # + one skills copy for EVERY project on this machine
```

## Why the split

Claude Code auto-loads **every `.md` in `.claude/rules/` into every single turn**, whether the task needs it or not. The full library in [`../rules/`](../rules/) is ~1,000 lines (~19,900 tokens), and in either project roughly a third of it describes the *other* one — Vue rules in a React repo, portal rules where there are no portals.

That is expensive twice over. It costs tokens on every request, and wrong-project content sitting in context is what makes an agent search for a component library that isn't there and then build a duplicate of one that is.

So:

| | Lives in | Loaded |
| :--- | :--- | :--- |
| **Slim set** — the project gate, the working discipline, and 18 pointer stubs | `claude-adapter/rules/` → installed to `.claude/rules/` | every turn (~2,700 tokens) |
| **Full canonical rules** | `../rules/` | on demand, when a task touches that rule |
| **`AGENTS.md`** — portable entry point | `claude-adapter/AGENTS.md` → installed to the project root | by non-Claude agents (Antigravity, Cursor, Copilot) |

## Editing

**Edit the canonical rule in [`../rules/`](../rules/).** Then, if the change belongs in the always-on set, mirror the *rule* — not the exposition — into `claude-adapter/rules/project-profile.md`, which carries the gate and the working-discipline summary.

Never blanket-copy `../rules/*.md` over `claude-adapter/rules/`. That restores all ~19,900 tokens per turn and silently undoes the point of this folder.

## The stubs

Each stub names its canonical file and the condition for reading it. They exist so that a skill linking `../../rules/<name>.md` still resolves from `.claude/skills/`, instead of hitting a missing file and guessing.

## Why there is no skills adapter

The rules needed one because Claude Code loads `.claude/rules/*.md` on **every turn**, so size is paid constantly. A `SKILL.md` is only read when its command is invoked — a stub there would just be read *and then* the real file, costing more than it saves.

Skills are unified a different way: `setup.sh` symlinks `.claude/skills` at the clone, so there is one copy per project, and `--global` symlinks `~/.claude/skills` so one clone serves every project on the machine. The per-turn cost skills do carry is their `description:` frontmatter, which is loaded for command discovery — keep those short (trigger conditions and guarantees, not how the skill works).
