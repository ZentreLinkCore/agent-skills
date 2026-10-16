# Code Search: Graphify first, then targeted search

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

**Blind spots: use grep and the [System Awareness scan](./system-awareness.md#2-the-scan) instead.** Route → controller method (`[X::class, 'index']`), a frontend `api/...` string → its backend route, table columns (migrations carry no columns in the graph), globally-registered components ((Vue): `StatusBadge`, `CSelect`, … have no import edge), and other string references.

**Freshness.** The graph describes the checked-out tree as of its last build, not a branch analyzed without checkout ([ticket-numbering.md §8.3](./ticket-numbering.md#83-read-only-skills-stop-at-step-4)). A node missing from a stale graph is not evidence of absence, so a decision to **create** still needs a grep. Skills that edit code (`implement`, `fix`, `refactor`) run `graphify update .` (AST only, no API cost) after their last edit, and anyone may run it after large changes. **Never commit `graphify-out/`.**

Exit codes: `0` answer · `3` ambiguous (candidates listed: pick one, re-run) · `4` no match (fall back below).

**Fallback, and when there is no graph:** targeted `rg` for a specific symbol, route, or table, in this order, stopping at the first acceptable match:

1. the current module → 2. shared / design-system folders → 3. sibling modules → 4. the current portal or domain → 5. the whole repository, **only when the user asks** or an investigation's evidence shows the issue is not local (`/webkit-investigate`).

Never scan `vendor/`, `node_modules/`, `storage/`, `dist/`, `graphify-out/`, or build caches. Never run repository-wide greps or file listings for a normal task.

Read limits and scope: [context-budget.md](../context-budget.md).
