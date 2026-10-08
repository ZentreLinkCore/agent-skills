#!/usr/bin/env bash
#
# setup.sh — wire this agent-skills clone into a project.
#
#   git clone https://github.com/ZentreLinkCore/agent-skills.git .agents
#   bash .agents/setup.sh
#
# What it does:
#   1. Points .claude/{skills,specs,blueprint,reports,definition} at .agents/ via symlink,
#      so there is ONE copy and the two can never drift.
#   2. Installs the slim rule set into .claude/rules/ — the files Claude Code auto-loads
#      on every turn. The full canonical rules stay in .agents/rules/ and are read on demand.
#   3. Drops the portable AGENTS.md at the project root for non-Claude agents
#      (Antigravity/Gemini, Cursor, Copilot).
#
# SAFETY: this script never deletes a directory that holds a file not already present
# under .agents/. If it finds one, it skips and tells you. Read that output — a real
# directory here may be the ONLY copy of something.

set -euo pipefail

GLOBAL=0
[ "${1:-}" = "--global" ] && GLOBAL=1

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

[ -d .agents ] || { echo "✗ No .agents/ here. Run this from the project root."; exit 1; }

echo "→ project: $ROOT"
echo

# ── 1. Symlink what Claude Code actually reads ────────────────────────────────
# Only skills/ and rules/ matter: Claude Code discovers commands in .claude/skills/
# and auto-loads .claude/rules/*.md. Specs, blueprint, and reports are referenced by
# their real `.agents/...` paths from inside the skills, so they need no .claude/ copy.
for d in skills; do
    src=".agents/$d"; dst=".claude/$d"
    [ -e "$src" ] || { echo "  · $d — not in .agents/, skipped"; continue; }
    mkdir -p .claude

    if [ -L "$dst" ]; then
        if [ "$(readlink "$dst")" = "../.agents/$d" ]; then
            echo "  ✓ $d — already linked"
        else
            echo "  ! $d — symlink points at $(readlink "$dst"); left alone"
        fi
        continue
    fi

    if [ -d "$dst" ]; then
        # Only replace when nothing would be lost.
        orphans="$(diff -rq "$dst" "$src" 2>/dev/null | grep "^Only in $dst" || true)"
        if [ -n "$orphans" ]; then
            echo "  ! $d — SKIPPED: these exist only in $dst and would be lost:"
            echo "$orphans" | sed 's/^/        /'
            echo "        Move them into $src, then re-run."
            continue
        fi
        rm -rf "$dst"
    fi

    ln -s "../.agents/$d" "$dst"
    echo "  ✓ $d → ../.agents/$d"
done

# ── 2. Slim rules for Claude Code's per-turn auto-load ─────────────────────────
# SYMLINKED per file, not copied — so editing .agents/claude-adapter/rules/<x>.md
# takes effect immediately with no sync step. Per-file (not a directory symlink)
# because the loader globs `.claude/rules/*.md`, and a real directory listing with
# symlinked files inside is the shape that reliably works.
mkdir -p .claude/rules
linked=0; kept=0
for src in .agents/claude-adapter/rules/*.md; do
    name="$(basename "$src")"; dst=".claude/rules/$name"

    # A real file here that is NOT ours: back it up rather than clobber it.
    if [ -f "$dst" ] && [ ! -L "$dst" ]; then
        if ! diff -q "$dst" "$src" >/dev/null 2>&1; then
            mkdir -p .claude-rules-backup
            cp "$dst" ".claude-rules-backup/$name"
            echo "  · $name differed — backed up to .claude-rules-backup/"
        fi
        rm "$dst"
    fi

    if [ -L "$dst" ] && [ "$(readlink "$dst")" = "../../.agents/claude-adapter/rules/$name" ]; then
        kept=$((kept+1)); continue
    fi
    rm -f "$dst"
    ln -s "../../.agents/claude-adapter/rules/$name" "$dst"
    linked=$((linked+1))
done
echo "  ✓ .claude/rules/ — ${linked} linked, ${kept} already correct (edits in .agents/ apply instantly)"

# ── 3. Portable entry point ────────────────────────────────────────────────────
if [ -f AGENTS.md ]; then
    echo "  · AGENTS.md already at root — left as is"
else
    cp .agents/claude-adapter/AGENTS.md AGENTS.md
    echo "  ✓ AGENTS.md — portable entry point for non-Claude agents"
fi

# ── 4. Optional: one skills copy for EVERY project on this machine ─────────────
# Claude Code also discovers skills in ~/.claude/skills/, which is personal scope —
# available in every project, no per-project setup. The skills are project-neutral
# (each one resolves which codebase it is in at runtime), so this is safe to share.
# Rules are NOT shared this way: they describe these specific codebases and would be
# wrong in an unrelated project.
# Caveat: the skills read `.agents/rules/` and `.agents/template/` from the project they
# run in. A project without its own `.agents/` clone has neither, so the skills cannot
# resolve the project or fill their templates there — run this script in each project.
if [ "$GLOBAL" = "1" ]; then
    gdst="$HOME/.claude/skills"
    mkdir -p "$HOME/.claude"
    if [ -L "$gdst" ]; then
        echo "  · global skills already a symlink → $(readlink "$gdst"); left alone"
    elif [ -d "$gdst" ]; then
        echo "  ! global skills: $gdst is a real directory — NOT touching it."
        echo "        Move anything you need out, remove it, then re-run with --global."
    else
        ln -s "$ROOT/.agents/skills" "$gdst"
        echo "  ✓ global skills → $ROOT/.agents/skills"
        echo "        /webkit-* commands now resolve in EVERY project on this machine."
        echo "        Note: this pins them to THIS clone — keep it pulled, don't delete it."
        echo "        They still need .agents/rules/ and .agents/template/ in the project they run in:"
        echo "        run this script in each project that uses them."
    fi
fi

# ── Report ─────────────────────────────────────────────────────────────────────
slim=$(( $(cat .claude/rules/*.md | wc -c) / 4 ))
full=$(( $(cat .agents/rules/*.md | wc -c) / 4 ))
echo
echo "Done."
echo "  /webkit-* commands: available"
echo "  always-on rules:    ~${slim} tokens/turn  (full library is ~${full}, read on demand)"
echo
echo "  Reminder: .agents/ is a git clone — pull it to get skill updates."
