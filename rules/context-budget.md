# Context Budget (always-on)

Every file read is paid for on every later turn. Load the least context that still lets you act correctly, and know why you loaded each piece.

## 1. Read in this order, and stop when you can act

1. **Ticket memory**: `task.md` (what is done, what is open, the next step). When the ticket has a `summary.md`, read it first: it replaces the old reports.
2. **Ticket context**: `context.md` and `touched-files.md`, if `/webkit-context` wrote them.
3. **Only the spec / plan / report sections the step needs**: a section, a task, an open finding, never the whole history.
4. **Source**: only the files that 1–3 or Graphify name, opened at the cited lines.

Prefer summaries over raw history. A closed ticket's old reports are archive: read `summary.md` instead, and open a report only for a detail the summary does not carry.

## 2. Find code: Graphify first, then targeted search

If `graphify-out/graph.json` exists at the project root, locate code through the graph **before** any grep or directory listing:

```bash
graphify query "<feature terms>" --budget 1500        # BFS from matching nodes; each NODE line has src=<file> loc=L<n>
graphify query "<question>" --seed app/Models/Leave.php --budget 1500   # start from an exact file / node
graphify explain "<NodeLabel>"                         # one node and its neighbours
graphify path "<A>" "<B>"                              # how two nodes connect (route → controller → handler → model)
graphify affected "<NodeLabel>" --depth 2              # reverse traversal: what a change here can break
```

1. **Query** to get node labels and their `src`/`loc`.
2. **Identify the affected nodes**: `explain` / `path` / `affected` on the exact labels the query printed.
3. **Open the exact files** at their `loc`, never whole folders.
4. **Verify against source.** The graph is a map, not evidence: it was built at some commit and may be stale. Every claim and every reference still needs the real file.

Labels match by name, case-insensitively, and basenames collide (`employee.php` is a route file, `Employee.php` a model), so check the `Source:` line, and use `--seed <path>` when you need one exact node. Exit codes: `0` answer · `3` ambiguous (candidates listed: pick one, re-run) · `4` no match (fall back below). Keep `--budget` at 1500 or less; narrow the terms rather than raising it. Do not rebuild the graph as a side effect of another task. If it is missing or stale for the area, say so and fall back; refreshing it (`graphify update .`) is the user's call.

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
