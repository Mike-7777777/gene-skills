# Hook Input/Output Schemas (ZCode port)

The JSON payload ZCode sends each hook on stdin, and how a hook's output
reaches the user and the model. Every payload carries the common fields
`session_id`, `transcript_path`, `cwd`, `hook_event_name` and `permission_mode`.
The examples below show the event-specific ones.

ZCode has seven events: `SessionStart`, `UserPromptSubmit`, `PreToolUse`,
`PermissionRequest`, `PostToolUse`, `PostToolUseFailure` and `Stop`. This
project registers hooks on five of them, in `.zcode/config.json` under
`hooks.events.<Event>`.

## PreToolUse

Fired before a tool is executed. Exit 2 **blocks** the call; the hook's stderr
is the reason the model is given. Exit 0 lets it continue through the normal
permission flow — it does not approve it, and the user can still be asked. To
warn without blocking, exit 0 and print hook JSON (see
[Output](#output-what-zcode-reads) below).

### PreToolUse: Bash

```json
{
  "tool_name": "Bash",
  "tool_input": {
    "command": "git commit -m 'feat: add player health system'",
    "description": "Commit changes with message",
    "timeout": 120000
  }
}
```

### PreToolUse: Write

```json
{
  "tool_name": "Write",
  "tool_input": {
    "file_path": "src/gameplay/health.gd",
    "content": "extends Node\n..."
  }
}
```

### PreToolUse: Edit

```json
{
  "tool_name": "Edit",
  "tool_input": {
    "file_path": "src/gameplay/health.gd",
    "old_string": "var health = 100",
    "new_string": "var health: int = 100"
  }
}
```

### PreToolUse: Read

```json
{
  "tool_name": "Read",
  "tool_input": {
    "file_path": "design/gdd/combat-system.md"
  }
}
```

### PreToolUse: Agent — this port's stand-in for SubagentStart

ZCode has no SubagentStart event. The `Agent` tool is what starts a subagent,
so `log-agent.sh` is registered on PreToolUse for `Agent` and reads the spawn
from the call's own input.

```json
{
  "tool_name": "Agent",
  "tool_input": {
    "description": "Write the combat test plan",
    "prompt": "… Write your full output to `production/qa/test-plan.md` …",
    "subagent_type": "qa-lead"
  }
}
```

The subagent's name is `tool_input.subagent_type`. There is no `agent_type` in
this payload.

In real payloads a file tool's `file_path` is absolute, with the platform's own
separators — backslashes on Windows. Strip the project root first, then match
from the start of what is left (`assets/data/`). A segment such as
`/assets/data/` matched anywhere also fires on a parent folder of the same name
and on files outside the project, such as the user's own skills folder.
`validate-assets.sh` shows the stripping.

## PostToolUse

Fired after a tool completes. **Cannot block** — the tool already ran. Exit 2
shows stderr to the model, so it can fix what it just wrote. stderr on exit 0
reaches no one, so an advisory warning must be hook JSON on stdout.

### PostToolUse: Write

```json
{
  "tool_name": "Write",
  "tool_input": {
    "file_path": "assets/data/enemy_stats.json",
    "content": "{\"goblin\": {\"health\": 50}}"
  },
  "tool_response": {
    "filePath": "assets/data/enemy_stats.json",
    "type": "create"
  }
}
```

### PostToolUse: Edit

```json
{
  "tool_name": "Edit",
  "tool_input": {
    "file_path": "assets/data/enemy_stats.json",
    "old_string": "\"health\": 50",
    "new_string": "\"health\": 75"
  },
  "tool_response": { "filePath": "assets/data/enemy_stats.json" }
}
```

### PostToolUse: Agent — this port's stand-in for SubagentStop

`log-agent-stop.sh` and `validate-agent-artifact.sh` are registered here. The
hook fires in the session that made the call, when the call returns.

```json
{
  "tool_name": "Agent",
  "tool_input": {
    "description": "Write the combat test plan",
    "prompt": "… Write your full output to `production/qa/test-plan.md` …",
    "subagent_type": "qa-lead"
  },
  "tool_response": "<the subagent's final report>"
}
```

Two differences from SubagentStop, and both hooks allow for them:

- **No transcript.** The return contract is read from `tool_input.prompt`.
- **Background.** A call that handed the subagent to the background returns
  before the subagent is done. `agent-hook-lib.sh` recognises one by the call's
  `run_in_background`, or by a short reply that only announces a background
  run, and the two hooks leave it alone.

## SessionStart

Fired when a session starts, resumes, is cleared with `/clear`, is compacted, or
is forked. Stdin carries `source`: `startup`, `resume`, `fork`, `clear` or
`compact`, and a hook's `matcher` is tested against that value.

**Plain stdout is not added to the context in ZCode.** Upstream it was; here
context must be hook JSON with `additionalContext`, which is why
`session-start.sh` and `detect-gaps.sh` are registered through
`hook-context-wrap.sh`. This is still the event that restores context after a
compaction, and the one that forgets which path-scoped rules a session was
given (`scoped-rules.sh --reset`, on `compact` and `clear`).

## Stop

Fired **every time the model finishes a response**, not once when the session
ends. Stdin carries the common fields plus `stop_hook_active` and
`last_assistant_message`. Exit 2 keeps the model working instead of stopping;
ZCode honours that up to three times. `session-stop.sh` only writes files.

## Events the original used and ZCode does not have

| Upstream event | Hook | In this port |
| ---- | ---- | ---- |
| `SubagentStart` | `log-agent.sh` | PreToolUse on `Agent` |
| `SubagentStop` | `log-agent-stop.sh`, `validate-agent-artifact.sh` | PostToolUse on `Agent` |
| `PreCompact` | `pre-compact.sh` | Not carried over. It appended a line to a compaction log; `session-start.sh` still restores context on its own |
| `Notification` | `notify.sh` | Not carried over. It showed a Windows toast, no longer produced by any event ZCode has |
| `InstructionsLoaded` | `log-instructions.sh` | Not carried over. It recorded which instruction files loaded; ZCode loads `AGENTS.md` and nothing else on its own |

## Output: what ZCode reads

A hook that warns but must not block exits 0 — and **on exit 0, stderr reaches
no one**. Print a JSON object on stdout instead:

```json
{
  "systemMessage": "Shown to the user",
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "Given to the model next to the tool result"
  }
}
```

- stdout must hold **only** that object. Output that is not JSON is discarded;
  JSON with a key ZCode does not know fails validation and marks the hook
  failed.
- `hookEventName` is required inside `hookSpecificOutput`, and must be the
  event that fired.
- `additionalContext` reaches the model on PreToolUse, PostToolUse,
  UserPromptSubmit, SessionStart and Stop.
- **Leave out `permissionDecision`** unless you mean it: on PreToolUse,
  `"allow"` skips the user's permission prompt.

Claude Code Game Studios hooks use `hook_warn` from `.zcode/hooks/yaml-helper.sh`, which builds this
object and escapes the message without needing `jq`:

```bash
. .zcode/hooks/yaml-helper.sh
hook_warn PostToolUse "Asset names must be lowercase: $FILE_PATH"
exit 0
```

## Exit Code Reference

| Exit Code | Meaning |
|-----------|---------|
| 0 | Passes. A JSON object on stdout is read as hook output; any other stdout is discarded |
| 2 | Blocks on PreToolUse: the tool call is denied, and the hook's stderr (its stdout when stderr is empty) is given as the reason |
| Other | Error: the hook is marked failed |

**Output is capped** at `hooks.maxOutputBytes` in the configuration, 32,768
bytes by default. Keep what the model must see inside it — `session-start.sh`
caps its checkpoint preview, and `hook-context-wrap.sh` passes the rest.

## Notes

- Hooks receive JSON on **stdin** (pipe). Use `INPUT=$(cat)` to capture.
- Parse with `jq` if available, fall back to `grep` for cross-platform
  compatibility. For a value that can hold quotes and newlines (a subagent's
  prompt), use Python's `json`, as `agent-hook-lib.sh` does.
- On Windows, `grep -P` (Perl regex) is often unavailable. Use `grep -E`
  (POSIX extended) instead.
- Path separators may be `\` on Windows. Normalize with `sed 's|\\|/|g'` when
  comparing paths.
- A hook command's `timeout` is in **seconds** in `.zcode/config.json`.
- `async` has no effect in ZCode: every hook runs before the session goes on,
  so keep each one short.
