# Context Budget (always-on)

Every file read is paid for on every later turn. Load the least context that lets you act correctly, and know why you loaded each piece.

## 1. Read in this order, and stop when you can act

1. The ticket's `task.md`, and its `summary.md` first when one exists (it replaces the old reports).
2. `context.md` / `touched-files.md`, when `/webkit-context` wrote them.
3. Only the spec, plan, or report **sections** the step needs.
4. Only the source files that 1–3 or Graphify name, at the cited lines.

## 2. Find code: Graphify first, then targeted search

With `graphify-out/graph.json` at the project root, use `graphify explain "<ExactName>" --all`, `path`, or `affected` on **exact** names before any grep, then open the file at the node's line: the file, never the graph, is the evidence. Routes, API strings, table columns, and global components are graph blind spots: grep those. Commands, freshness, and the fallback search order: `conditional/code-search.md`. Never scan `vendor/`, `node_modules/`, `storage/`, `dist/`, or `graphify-out/`, and never run a repo-wide grep for a normal task.

## 3. Read limits

At most 2 full files at once (a merge or refactor excepted). Line ranges before whole files. Stop at the first acceptable match. Never re-read what is already in context or reload a rule already applied.

## 4. Scope

No unrelated modules, portals, or domains; web and mobile are separate. Never edit across the backend / frontend boundary as a side effect; reading models, migrations, and routes (the System Awareness scan) is always allowed. Rules: this set plus what `rule-router.md` picks; never preload `rules/`.

## 5. Justify, and do not duplicate

Before opening a file outside the step's list, say why in one line (`Reading X: <reason>`); no reason, no read. Cite rules and spec IDs instead of restating them; reports point at `file:line`, never pasted code.
