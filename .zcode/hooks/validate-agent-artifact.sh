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

# ZCode port of the SubagentStop hook: warns when a subagent stops without
# writing the file its return contract named. An orchestrating skill ends each
# agent prompt with "Write your full output to `<path>`"; a named artifact that
# is not on disk is a failed phase however fluent the reply reads
# (error-recovery-protocol.md, Trigger 0). The orchestrator still checks the
# path itself; this hook is the extra guarantee.
#
# ZCode has no SubagentStop event, so .zcode/config.json registers this on
# PostToolUse for the Agent tool. It fires in the orchestrating session when
# the Agent call returns, and the contract is read from the call's own prompt
# (`tool_input.prompt`), not from a subagent transcript: ZCode gives this hook
# no transcript path.
#
# The first "Write your full output to `...`" in the prompt whose path is not a
# template placeholder ([path], <path>, {path}, or a path holding one) is the
# contract. A prompt that names no path is not checked. The existence check is
# `.zcode/scripts/write-guard.sh artifact`, its helper twin.
#
# A call that handed the subagent to the background returns before the
# subagent is done; it is left alone, or every such spawn would be reported.
#
# Exit behavior:
#   exit 0 always = advisory (it warns, never blocks). The warning is
#   `systemMessage`, shown to the user, and `additionalContext`, which here
#   reaches the orchestrator — on this event that is the parent session, so it
#   can resume the agent. (The original used systemMessage alone, because on
#   SubagentStop additionalContext would have kept the subagent running.)
#
# Input (PostToolUse, tool_name "Agent"):
# { "session_id": "...", "tool_name": "Agent",
#   "tool_input": { "description": "...", "prompt": "... Write your full output to
#                   `production/qa/test-plan.md` ...", "subagent_type": "qa-lead" },
#   "tool_response": "<the subagent's final report>" }

INPUT=$(cat)

_AH_LIB="$(dirname "${BASH_SOURCE[0]}")/agent-hook-lib.sh"
[ -f "$_AH_LIB" ] || exit 0
. "$_AH_LIB"
ah_parse

[ "$AH_TYPE" != "unknown" ] || exit 0
[ "$AH_BG" = "false" ] || exit 0

# Not hook_warn (yaml-helper.sh): that takes one message for both fields, and
# this file says where the rule came from. Escaped the same way.
va_say() {
  _va_m=$(printf '%s' "$1" | tr -d '\000-\010\013-\037' | sed 's/\\/\\\\/g; s/"/\\"/g' \
    | awk '{ gsub(/\t/, "\\t"); if (NR > 1) printf "\\n"; printf "%s", $0 }')
  printf '{"systemMessage":"%s","hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"%s"}}\n' "$_va_m" "$_va_m"
  exit 0
}

[ -n "$AH_PROMPT" ] || va_say "Artifact check did not run for subagent $AH_TYPE: the prompt it was given could not be read (no Python 3 on PATH)."
# The first named path in the prompt; a template placeholder is not a path.
_VA_P=$(printf '%s\n' "$AH_PROMPT" | awk '
  {
    s = $0
    while (match(s, /Write your full output to `[^`]+`/)) {
      # 27: the phrase and its opening backtick; 28 adds the closing one.
      p = substr(s, RSTART + 27, RLENGTH - 28); s = substr(s, RSTART + RLENGTH)
      if (p !~ /\[[^]]*\]|<[^>]*>|\{[^}]*\}/) { print p; exit }
    }
  }')
[ -n "$_VA_P" ] || exit 0
[ -f .zcode/scripts/write-guard.sh ] || va_say "Artifact check did not run for subagent $AH_TYPE: the helper .zcode/scripts/write-guard.sh is missing."
_VA_TAB="$(printf '\t')"
case "$(bash .zcode/scripts/write-guard.sh --root . artifact "$_VA_P" 2>/dev/null)" in
  *"${_VA_TAB}missing") ;;
  *) exit 0 ;;
esac
va_say "Subagent $AH_TYPE stopped, and the file its return contract named is not on disk: $_VA_P. Treat that phase as not done (error-recovery protocol, Trigger 0): resume the agent and tell it to write the file."
