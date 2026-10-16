# Context Budget (always-on)

Every file read is paid for on every later turn. Load the least context that still lets you act correctly, and know why you loaded each piece.

## 1. Read in this order, and stop when you can act

1. **Ticket memory**: `task.md` (what is done, what is open, the next step). When the ticket has a `summary.md`, read it first: it replaces the old reports.
2. **Ticket context**: `context.md` and `touched-files.md`, if `/webkit-context` wrote them.
3. **Only the spec / plan / report sections the step needs**: a section, a task, an open finding, never the whole history.
4. **Source**: only the files that 1–3 or Graphify name, opened at the cited lines.

Prefer summaries over raw history. A closed ticket's old reports are archive: read `summary.md` instead, and open a report only for a detail the summary does not carry.

## 2. Find code: Graphify first, then targeted search

When `graphify-out/graph.json` exists at the project root, answer "where is X, who calls / imports / uses X, what breaks if X changes" through the graph **before** any grep or directory listing. It is a local, code-only index (tree-sitter AST; nothing leaves the machine).

| Command | Use for |
| :--- | :--- |
| `graphify explain "<ExactName>" --all` | Every caller and callee of a class, method, composable, or component |
| `graphify path "<A>" "<B>"` | How two symbols connect (route → controller → Handler → model; page → composable → api) |
| `graphify affected "<ExactName>" --depth 2` | Reverse traversal: what a change here can break |
| `graphify query "<terms>" --seed <exact/path> --budget 1500` | Only to discover an exact label when you have none |

1. **Name it exactly**: a class, method, composable, component, or file name. A vague label resolves to the wrong node (`explain "Employee"` lands on a test method; `Employee.php` on the route file), so check the `Source:` line. Prose `query` is fuzzy and truncates at `--budget`: use it to find a label, never as a complete answer.
2. **Identify the affected nodes** with `explain` / `path` / `affected`.
3. **Open the exact files** at their line, never whole folders.
4. **The graph locates; the file proves.** Read the file before relying on any result, as with a grep hit.

**Blind spots: use grep and the [System Awareness scan](./conditional/system-awareness.md#2-the-scan) instead.** Route → controller method (`[X::class, 'index']`), a frontend `api/...` string → its backend route, table columns (migrations carry no columns in the graph), globally-registered components ((Vue): `StatusBadge`, `CSelect`, … have no import edge), and other string references.

**Freshness.** The graph describes the checked-out tree as of its last build, not a branch analyzed without checkout ([ticket-numbering.md §8.3](./conditional/ticket-numbering.md#83-read-only-skills-stop-at-step-4)). A node missing from a stale graph is not evidence of absence, so a decision to **create** still needs a grep. Skills that edit code (`implement`, `fix`, `refactor`) run `graphify update .` (AST only, no API cost) after their last edit, and anyone may run it after large changes. **Never commit `graphify-out/`.**

Exit codes: `0` answer · `3` ambiguous (candidates listed: pick one, re-run) · `4` no match (fall back below).

**Fallback, and when there is no graph:** targeted `rg` for a specific symbol, route, or table, in this order, stopping at the first acceptable match:

1. the current module → 2. shared / design-system folders → 3. sibling modules → 4. the current portal or domain → 5. the whole repository, **only when the user asks** or an investigation's evidence shows the issue is not local (`/webkit-investigate`).

Never scan `vendor/`, `node_modules/`, `storage/`, `dist/`, `graphify-out/`, or build caches. Never run repository-wide greps or file listings for a normal task.

## 3. Read limits

- **At most 2 full files in context at once**, except for a merge or refactor that needs both sides.
- **Snippets first**: read the line range around a symbol or a cited `file:line`, not the file.
- **Early exit**: once an existing component or helper covers the need, stop searching and reuse it. Do not hold out for a cleaner match.
- **Do not re-read** a file already in context, and do not reload a rule you already applied this session.

## 4. Scope

- **Never read unrelated modules**, other portals, or other domains unless the task names them.
- **Web and mobile are separate**: do not inspect mobile code for a web task, or the reverse.
- **Write scope**: never edit backend files as a side effect of a frontend task, or the reverse. **Exception, read-only:** the [System Awareness scan](./conditional/system-awareness.md) (`app/Models/`, `database/migrations/`, `routes/api/`) is always allowed and is mandatory before designing data shapes or API calls. It never authorizes edits across the boundary.
- **Rules**: the always-on set plus what the [rule router](./rule-router.md) picks. Never preload `.agents/rules/`; never load a rule for the project you are not in.

## 5. Justify every extra load

Before opening a file outside the step's list (§1, `touched-files.md`, or the skill's own priority list), state in one line why it is needed: `Reading X: <reason>`. If you cannot name the reason, do not open it.

## 6. Do not duplicate information

- Cite, do not restate: link a rule or a spec ID instead of copying its text into a report or a plan.
- Reports point at `file:line`; they do not paste whole functions.
- One fact lives in one file. If you find it in two, the canonical one is the rule the router names; fix or report the copy.
