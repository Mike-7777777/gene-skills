#!/bin/bash
# agent-hook-lib.sh — shared by the three Agent-tool hooks of the ZCode port:
# log-agent.sh, log-agent-stop.sh and validate-agent-artifact.sh. Source it
# after the project-root block and after INPUT holds the hook payload:
#
#   . "$(dirname "${BASH_SOURCE[0]}")/agent-hook-lib.sh"
#   ah_parse
#
# ah_parse reads $INPUT and sets:
#   AH_MODE      python | jq | grep | none — how the payload was read
#   AH_TYPE      the subagent's agent type; `general-purpose` when the call
#                names none, `unknown` when the payload could not be read
#   AH_SESSION   the session id, or `unknown` when the payload has none
#   AH_BG        `true` when the Agent call handed the subagent to the
#                background and it is still running, else `false`
#   AH_PROMPT    the prompt the subagent was given ("" unless python)
#   AH_RESPONSE  what the Agent tool returned ("" unless python)
#
# Why ZCode reads a spawn from a tool call: it has no SubagentStart or
# SubagentStop event. The Agent tool is what starts a subagent, so these hooks
# sit on PreToolUse and PostToolUse for `Agent`, and the subagent's name is
# `tool_input.subagent_type` — there is no `agent_type` field on this event.
#
# Standard-library Python is preferred: only it reads a prompt that holds
# quotes and newlines. jq and grep name the agent and the session, nothing more.
# bash 3.2 safe.

# Byte semantics, so cut splits on the one-byte separator whatever the locale.
LC_ALL=C
export LC_ALL

AH_US="$(printf '\037')"

ah_parse() {
  AH_MODE="none"; AH_TYPE="unknown"; AH_SESSION="unknown"; AH_BG="false"; AH_PROMPT=""; AH_RESPONSE=""
  _ah_py="$(command -v python3 2>/dev/null || command -v python 2>/dev/null)"
  if [ -n "$_ah_py" ]; then
    _ah_out=$(printf '%s' "$INPUT" | "$_ah_py" -c '
import json, re, sys
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(3)
if not isinstance(d, dict):
    sys.exit(3)
ti = d.get("tool_input")
if not isinstance(ti, dict):
    ti = {}
r = d.get("tool_response")
if r is not None and not isinstance(r, str):
    try:
        r = json.dumps(r, ensure_ascii=False)
    except Exception:
        r = str(r)
r = r if isinstance(r, str) else ""
t = ti.get("subagent_type")
t = t.strip() if isinstance(t, str) and t.strip() else "general-purpose"
s = d.get("session_id")
s = s.strip() if isinstance(s, str) and s.strip() else "unknown"
# Handed to the background: said by the call, or by a short reply that only
# announces it (ZCode runs every subagent in the background on some setups).
bg = ti.get("run_in_background") is True or (len(r) < 400 and bool(re.search("background", r, re.I)))
p = ti.get("prompt")
p = p if isinstance(p, str) else ""
sys.stdout.write("\x1f".join([t, s, "true" if bg else "false", p, r]))
' 2>/dev/null) || _ah_out=""
    if [ -n "$_ah_out" ]; then
      AH_MODE="python"
      AH_TYPE=$(printf '%s' "$_ah_out" | cut -d "$AH_US" -f 1)
      AH_SESSION=$(printf '%s' "$_ah_out" | cut -d "$AH_US" -f 2)
      AH_BG=$(printf '%s' "$_ah_out" | cut -d "$AH_US" -f 3)
      AH_PROMPT=$(printf '%s' "$_ah_out" | cut -d "$AH_US" -f 4)
      AH_RESPONSE=$(printf '%s' "$_ah_out" | cut -d "$AH_US" -f 5)
      return 0
    fi
  fi
  if command -v jq >/dev/null 2>&1; then
    AH_MODE="jq"
    AH_TYPE=$(printf '%s' "$INPUT" | jq -r '.tool_input.subagent_type // ""' 2>/dev/null | tr -d '\r' | head -1)
    AH_SESSION=$(printf '%s' "$INPUT" | jq -r '.session_id // ""' 2>/dev/null | tr -d '\r' | head -1)
  else
    AH_MODE="grep"
    AH_TYPE=$(printf '%s' "$INPUT" | LC_ALL=C grep -oE '"subagent_type"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 \
      | LC_ALL=C sed 's/^"subagent_type"[[:space:]]*:[[:space:]]*"//; s/"$//')
    AH_SESSION=$(printf '%s' "$INPUT" | LC_ALL=C grep -oE '"session_id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 \
      | LC_ALL=C sed 's/^"session_id"[[:space:]]*:[[:space:]]*"//; s/"$//')
  fi
  [ -n "$AH_TYPE" ] || AH_TYPE="general-purpose"
  [ -n "$AH_SESSION" ] || AH_SESSION="unknown"
  return 0
}
