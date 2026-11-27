#!/bin/bash

# --- work from the project root ----------------------------------------------
# Same resolution as every other hook in this folder: a cwd that is a project
# root wins, then CLAUDE_PROJECT_DIR, then this script's own location.
if [ -f "project.yaml" ] || { [ -f ".zcode/hooks/yaml-helper.sh" ] && [ "${PWD##*/}" != ".zcode" ]; }; then
  CCGS_ROOT="$PWD"
elif [ -n "${CLAUDE_PROJECT_DIR:-}" ] && [ -d "${CLAUDE_PROJECT_DIR}" ] && case "${CLAUDE_PROJECT_DIR%/}" in */.zcode|*\\.zcode) false ;; *) true ;; esac; then
  CCGS_ROOT="$CLAUDE_PROJECT_DIR"
else
  CCGS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." 2>/dev/null && pwd)"
fi
[ -n "$CCGS_ROOT" ] && cd "$CCGS_ROOT" 2>/dev/null || true

# scoped-rules.sh — ZCode port. Gives this project its path-scoped instructions.
#
# In the original, a rule in .zcode/rules/*.md that carries `paths:` frontmatter
# loads by itself when the model READS a file matching one of those globs. ZCode
# has no such mechanism: it loads AGENTS.md and nothing else. This hook stands
# in for it.
#
# Registered on PreToolUse for Read, Edit and Write, it reads the file the tool
# call names, finds every rule whose `paths:` match it, and returns the bodies
# of the ones this session has not been given yet as additionalContext. Each
# rule is passed once per session. A second registration, on SessionStart with
# the matcher `compact|clear`, runs this file with --reset so that a context
# that was compacted or cleared gets its rules again.
#
# It also fires on Edit and Write, where the original loaded on Read only: most
# work in this framework creates files rather than reading them, and a rule
# first seen after the file is written guides nothing.
#
# The matching is scoped-rules.py, beside this file (stdlib Python only).
# Without a Python 3 interpreter this hook prints nothing: a missing interpreter
# must not fail every Read.
#
# Usage:
#   bash .zcode/hooks/scoped-rules.sh                 stdin: the PreToolUse payload
#   bash .zcode/hooks/scoped-rules.sh --reset         stdin: the SessionStart payload
#   bash .zcode/hooks/scoped-rules.sh --list          every rule and its globs
#   bash .zcode/hooks/scoped-rules.sh --match PATH    the rules that match a path
#
# Exit codes: 0 for the two hook forms, always (advisory: it never blocks a
# tool call); the Python file's own for --list and --match.
# Writes only a per-session list under the system temporary folder; never prompts.

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PY="$(command -v python3 2>/dev/null || command -v python 2>/dev/null)"
[ -n "$PY" ] || exit 0
[ -f "$HERE/scoped-rules.py" ] || exit 0

case "${1:-}" in
  --list|--match) exec "$PY" "$HERE/scoped-rules.py" --root "${CCGS_ROOT:-$PWD}" "$@" ;;
esac

"$PY" "$HERE/scoped-rules.py" --root "${CCGS_ROOT:-$PWD}" "$@"
exit 0
