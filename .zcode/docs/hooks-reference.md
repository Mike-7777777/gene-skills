# Active Hooks (ZCode port)

Hooks are registered in `.zcode/config.json`, under `hooks.events`, and fire
automatically in every ZCode session opened at the project root. ZCode has
seven events; this project uses five of them.

| Hook | Event | Matcher | What It Does |
|------|-------|---------|--------------|
| `validate-commit.sh` | PreToolUse | `Bash` | Validates design doc sections, JSON data files, hardcoded values, TODO format |
| `validate-push.sh` | PreToolUse | `Bash` | Warns on pushes to protected branches (`main`, `master` and `release/*`), and on the steps that ask first: `git tag` (not a listing), `git merge` (not `--abort`), `gh release`, `butler push` and `steamcmd` with `+run_app_build`. Which commands count is `bash .zcode/scripts/write-guard.sh git` |
| `validate-registry.sh` | PreToolUse | `Write`, `Edit` | Warns, and never blocks, when the change would delete or renumber an entry or set a status outside the values the file's header lists. It runs before the write, while the old file can still be compared; the check itself is `bash .zcode/scripts/registry.sh compare`. The skills that write a registry also run `registry.sh validate` after writing, because hooks do not run in every tool |
| `validate-write.sh` | PreToolUse | `Write`, `Edit` | Warns, and never blocks, when a write would replace a file skills never overwrite (an existing `EPIC.md`, `project.godot`, `tests/helpers/*`, the tech-debt register, an engine reference doc, the files `/test-setup` creates), set a config value outside its list or a key `project.local.yaml` cannot hold, set the review mode, leave a prototype file without its `PROTOTYPE` or `VERTICAL SLICE` header or reach between `prototypes/` and the code root, change a string table during an active freeze, or, from a subagent, write anything but a new file under `production/`, `docs/` or `tests/`. The check is `bash .zcode/scripts/write-guard.sh check`, which the skills that write these files also run themselves |
| `validate-read.sh` | PreToolUse | `Read` | Blocks a whole-file read of a doc over 40 KB (`features.read_guard_kb`) and answers with the doc's headings by line, so the retry reads one section; a ranged read always passes. `features.read_guard: off` turns it off. The check is `bash .zcode/scripts/read-guard.sh check` |
| `scoped-rules.sh` | PreToolUse | `Read`, `Write`, `Edit` | Passes the model the body of each rule in `.zcode/rules/` whose `paths:` match the file, once per session. Stands in for Claude Code loading a path-scoped rule on a matching read |
| `log-agent.sh` | PreToolUse | `Agent` | Audit trail start: logs the subagent invocation with a timestamp and the session id. Registered on the `Agent` call, which is what starts a subagent in ZCode |
| `validate-assets.sh` | PostToolUse | `Write`, `Edit` | Checks data-file JSON under `assets/`, `Assets/` or `Content/`, and asset naming in Godot's `assets/` only |
| `validate-skill-change.sh` | PostToolUse | `Write`, `Edit` | Advises running `/skill-test` after any `.zcode/skills/` file is written or edited |
| `log-agent-stop.sh` | PostToolUse | `Agent` | Audit trail stop: completes the subagent's record when the `Agent` call returns a finished subagent |
| `validate-agent-artifact.sh` | PostToolUse | `Agent` | Warns you, and never blocks, when the file the subagent's return contract named ("Write your full output to `<path>`" in its prompt) is not on disk, a failed phase however the reply reads. Also passes the warning to the model, which can resume the agent |
| `session-start.sh` | SessionStart | every start, resume, fork, clear and compaction | Loads sprint context, milestone, git activity; detects and previews active session state file for recovery, with one line when its checkpoint names a different branch from the one you are on; one line when a newer release is out, from a cache `update-check.sh` refreshes in the background at most once a day (`updates.check` in `effects-map.md`) |
| `detect-gaps.sh` | SessionStart | every start, resume, fork, clear and compaction | Detects fresh projects (suggests /start) and missing documentation when code/prototypes exist, suggests /reverse-document or /project-stage-detect |
| `scoped-rules.sh --reset` | SessionStart | `compact`, `clear` | Forgets which rules the session was given, so a compacted or cleared context gets them again |
| `session-stop.sh` | Stop | every response end | Updates the session log and writes the subagent spawn tally to `production/session-logs/session-cost.md`; prints nothing. Archives `active.md` only when its content hash changed; without that guard a long session appended the whole file on every turn. Runs before the turn ends, so it stays short |

Warnings from the `validate-*` hooks are shown to you and passed to the model
as hook JSON (`hook_warn` in `yaml-helper.sh`); only a problem that must be
fixed now exits 2, and the read guard's refusal. See
`hooks-reference/hook-input-schemas.md` for why stderr is not enough.

`session-start.sh` and `detect-gaps.sh` print plain text, which ZCode
discards, so each is registered through `hook-context-wrap.sh`: the wrapper
runs the script and prints what it printed as `additionalContext`.

### Subagent cost visibility

The two `log-agent*` hooks above and `session-stop.sh` form one chain. `log-agent.sh` writes a record per spawn
to `production/session-logs/agent-audit.log` in a fixed three-field shape:

```
YYYYMMDD_HHMMSS | <session_id> | Agent invoked: <subagent type>
```

`session-stop.sh` greps the literal string `" | $SESSION_ID | Agent invoked: "`
to tally the current session, then writes a count plus a per-agent breakdown to
`production/session-logs/session-cost.md`.

The field order of that record is fixed. `session-stop.sh` matches it literally,
so a different order silently zeroes the spawn count instead of raising an error.

When the hook input has no session id, `session-stop.sh` writes no total. A
total spanning every session in the log would look plausible and be wrong, which
is worse than none.

`tool_input.subagent_type` is the field carrying the agent name. See
`hooks-reference/hook-input-schemas.md`.

## Events considered and deliberately not added

ZCode has two more events than the five used above. Neither is used:

| Event | Why not |
| ---- | ---- |
| `UserPromptSubmit` | Would re-inject session state on **every prompt**. `.zcode/docs/config-resolution.md` already rejects the weaker version of this (injecting config at session start) because of what it costs on every session |
| `PermissionRequest` | The original's `notify.sh` used the equivalent moment for a Windows toast. Nothing here needs to act on a permission prompt |
| `PostToolUseFailure` | Would add another log with no reader |

`PreCompact`, `Notification`, `SubagentStart`, `SubagentStop`,
`InstructionsLoaded`, `ConfigChange`, `FileChanged`, `PostCompact` and
`SessionEnd` do not exist in ZCode. What became of the hooks that used them:

| Upstream hook | Upstream event | In this port |
| ---- | ---- | ---- |
| `pre-compact.sh` | `PreCompact` | Not carried over. It appended a line to a compaction log; `session-start.sh` still restores context after a compaction on its own |
| `notify.sh` | `Notification` | Not carried over. It showed a Windows toast, and no ZCode event reports a permission prompt waiting or an idle session |
| `log-agent.sh` | `SubagentStart` | Registered on PreToolUse for `Agent` |
| `log-agent-stop.sh`, `validate-agent-artifact.sh` | `SubagentStop` | Registered on PostToolUse for `Agent` |
| `log-instructions.sh` | `InstructionsLoaded` | Not carried over. ZCode loads `AGENTS.md` and nothing else on its own, so there is nothing to record |

Hook reference documentation: `.zcode/docs/hooks-reference/`
Hook input schema documentation: `.zcode/docs/hooks-reference/hook-input-schemas.md`
