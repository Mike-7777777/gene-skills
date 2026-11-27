#!/bin/bash

# --- work from the project root ----------------------------------------------
# Every path below is repo-relative, so a hook invoked with a working directory
# that is not the repo root would silently read and write the WRONG TREE --
# returning a near-empty result instead of the session-recovery block, and
# creating stray trees such as docs/production/session-logs/ on write.
#
# PRECEDENCE IS LOAD-BEARING. A cwd that IS a project root carries real
# information and must win: a caller sitting inside another project means that
# project, not this one. Resolving to the script's own location first would
# override them. So, in order:
#   1. cwd holds project.yaml   -> cwd   (a project root)
#   2. cwd holds .zcode/hooks/  -> cwd   (a project root not yet configured),
#      unless cwd is itself named .zcode: a stray .zcode/.zcode/ would make
#      .zcode/ a root, and the hooks would write .zcode/production/
#   3. CLAUDE_PROJECT_DIR       -> that  (populated in the hook environment),
#      unless it names a .zcode folder, for the same reason as rule 2
#   4. this script's location   -> <root>/.zcode/hooks/../.. by construction
# Rule 4 always works and needs no environment at all; rules 1-2 stop it from
# overriding a caller that legitimately means somewhere else.
#
# NOT an upward search: that resolves a nested project to its parent's config.
if [ -f "project.yaml" ] || { [ -f ".zcode/hooks/yaml-helper.sh" ] && [ "${PWD##*/}" != ".zcode" ]; }; then
  CCGS_ROOT="$PWD"
elif [ -n "${CLAUDE_PROJECT_DIR:-}" ] && [ -d "${CLAUDE_PROJECT_DIR}" ] && case "${CLAUDE_PROJECT_DIR%/}" in */.zcode|*\\.zcode) false ;; *) true ;; esac; then
  CCGS_ROOT="$CLAUDE_PROJECT_DIR"
else
  CCGS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." 2>/dev/null && pwd)"
fi
[ -n "$CCGS_ROOT" ] && cd "$CCGS_ROOT" 2>/dev/null || true

# ZCode port of the SubagentStart hook: log agent invocations for the audit
# trail. Tracks which agents are being used and when.
#
# ZCode has no SubagentStart event, so .zcode/config.json registers this on
# PreToolUse for the Agent tool — the call that starts a subagent — and the
# spawn is read from the call's own input. agent-hook-lib.sh names the fields.
#
# Input (PreToolUse, tool_name "Agent"):
# { "session_id": "...", "tool_name": "Agent",
#   "tool_input": { "description": "...", "prompt": "...", "subagent_type": "qa-tester" } }
#
# The agent name is `tool_input.subagent_type`, NOT `agent_type`: this payload
# has no such field. A call that names no agent runs the general-purpose agent
# and is logged as that. It is a spawn, and session-stop.sh's tally counts it.

# features.session_state: off => no audit trail, no spawn tally. Default is
# `on`, so this changes nothing unless the user opted out. Checked before
# reading stdin: there is no point paying for the parse we are about to discard.
if [ -f .zcode/hooks/yaml-helper.sh ]; then
    . .zcode/hooks/yaml-helper.sh
    session_state_enabled || exit 0
fi

INPUT=$(cat)

_AH_LIB="$(dirname "${BASH_SOURCE[0]}")/agent-hook-lib.sh"
[ -f "$_AH_LIB" ] || exit 0
. "$_AH_LIB"
ah_parse

AGENT_NAME="$AH_TYPE"

# session-stop.sh tallies spawns per session, so the record is useless without
# a session id. "unknown" is written rather than left blank, as before.
SESSION_ID="$AH_SESSION"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
SESSION_LOG_DIR="production/session-logs"

mkdir -p "$SESSION_LOG_DIR" 2>/dev/null

# Field order is timestamp | session | event -- session-stop.sh greps the
# fixed string " | $SESSION_ID | Agent invoked: " to tally the current session.
# Changing this format silently breaks the spawn count (nothing else reads it).
echo "$TIMESTAMP | $SESSION_ID | Agent invoked: $AGENT_NAME" >> "$SESSION_LOG_DIR/agent-audit.log" 2>/dev/null

exit 0
