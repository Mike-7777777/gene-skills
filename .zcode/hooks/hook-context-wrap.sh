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

# Byte semantics, so the control-character range below is exact in any locale.
LC_ALL=C
export LC_ALL

# hook-context-wrap.sh — ZCode port. Runs a hook script that prints its context
# as plain text, and prints that text the one way ZCode passes a hook's output
# to the model: hook JSON, as additionalContext.
#
# ZCode reads a hook's stdout as JSON and discards anything else, so a hook
# that only prints text says nothing. session-start.sh and detect-gaps.sh are
# registered through this wrapper for that reason; neither is changed for it.
#
# The wrapper alters no word of what the wrapped script prints and keeps its
# exit code. Empty output prints nothing.
#
# Usage (how .zcode/config.json registers it):
#   bash "${CLAUDE_PROJECT_DIR}/.zcode/hooks/hook-context-wrap.sh" SessionStart .zcode/hooks/session-start.sh
#   bash "${CLAUDE_PROJECT_DIR}/.zcode/hooks/hook-context-wrap.sh" SessionStart .zcode/hooks/detect-gaps.sh
#
#   the first argument is the hook event, and must be one ZCode knows how to
#   attach context to (SessionStart, UserPromptSubmit, PreToolUse, PostToolUse)
#   the second is the script, relative to the project root or absolute
#   anything after it is passed to the script
#
# Exit codes: the wrapped script's; 0 when there is nothing to wrap.
# Writes nothing; never prompts.
# bash 3.2 and BWK awk safe, no jq, no Python.

EVENT="${1:-}"
[ -n "$EVENT" ] || exit 0
shift
SCRIPT="${1:-}"
[ -n "$SCRIPT" ] || exit 0
shift

case "$SCRIPT" in
  /*) ;;
  *)
    if [ -n "$CCGS_ROOT" ] && [ -f "$CCGS_ROOT/$SCRIPT" ]; then
      SCRIPT="$CCGS_ROOT/$SCRIPT"
    else
      SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)/$(basename "$SCRIPT")"
    fi
    ;;
esac
[ -f "$SCRIPT" ] || exit 0

OUT=$(bash "$SCRIPT" "$@" 2>/dev/null)
RC=$?
# Command substitution drops trailing newlines only; anything left that is not
# whitespace is context worth passing on.
[ -n "${OUT//[[:space:]]/}" ] || exit "$RC"

# One JSON string, escaped the way hook_warn in yaml-helper.sh escapes its
# message: control characters other than tab are dropped, backslash and quote
# are doubled, tab becomes \t and each newline becomes \n.
_ESC=$(printf '%s' "$OUT" | tr -d '\000-\010\013-\037' \
  | sed 's/\\/\\\\/g; s/"/\\"/g' \
  | awk '{ gsub(/\t/, "\\t"); if (NR > 1) printf "\\n"; printf "%s", $0 }')

printf '{"hookSpecificOutput":{"hookEventName":"%s","additionalContext":"%s"}}\n' "$EVENT" "$_ESC"
exit "$RC"
