# The ZCode port

This template is **Claude Code Game Studios v1.3.0** (upstream commit `abc0de79d6ceb0b5d7aa693945849b3937afbe6a`) moved from Claude Code to **ZCode**. The framework is the same: 49 agents, 78 skills, the scripts, the rules and the documents. What changed is every place that relied on something only Claude Code does.

Upstream: <https://github.com/Donchitos/Claude-Code-Game-Studios> (MIT). This port is not maintained there, and its issue tracker is not the place for port problems.

## Where everything went

| In the original | Here |
|---|---|
| `CLAUDE.md` | `AGENTS.md`, with its three `@` imports written out (ZCode does not expand imports) |
| `CLAUDE.md` inside `src/`, `design/`, `docs/` and `studio-tests/` | Four rules in `.zcode/rules/`: `src-directory.md`, `design-directory.md`, `docs-directory.md`, `studio-tests-directory.md` |
| `.claude/skills/<name>/` | `.zcode/skills/<name>/`, and a generated `.zcode/commands/<name>.md` for each skill |
| `.claude/agents/*.md` | `.zcode/agents/*.md` |
| The hooks in `.claude/settings.json` | `.zcode/config.json`, under `hooks.events` |
| The permission lists in `.claude/settings.json` | Not carried over |
| `.claude/rules/*.md` | `.zcode/rules/*.md`, passed to the model by a hook |
| `.claude/` `hooks`, `scripts`, `docs`, `genres`, `engines` | The same folders under `.zcode/` |
| `.claude/statusline.sh`, `.worktreeinclude`, `.github/` | Not carried over |

Every path and product name moved with them: `.claude/` became `.zcode/`, `CLAUDE.md` became `AGENTS.md`, and "Claude Code" became "ZCode" wherever the text meant the agent. `CHANGELOG.md`, `UPGRADING.md`, `CONTRIBUTING.md` and `SECURITY.md` are the upstream documents, kept as they were written under a banner.

## What behaves differently

### 1. A skill's first command is an instruction

Upstream, 68 skills opened with a line such as ``!`bash …/yaml-helper.sh resolve_config --keys …` ``. Claude Code ran it before the model saw the skill and put the output in its place. ZCode runs nothing in a skill on its own, so each of those 73 lines became a **Run this first** block: the model runs the command with Bash, then uses the output as the skill says. The path is relative to the project root, like every other path a skill names.

The cost is one Bash call per skill, and it depends on the model doing what the block says. When the command fails or prints nothing, the skill is told to say so and to use the defaults in `config-resolution.md`.

### 2. Every skill is also a slash command

Claude Code let one file be both: the user could type `/name`, and the model could pick the same file by its description. ZCode splits the two. A skill (`.zcode/skills/<name>/SKILL.md`) is what the model loads through the Skill tool. A command (`.zcode/commands/<name>.md`) is what runs when the user types `/<name>`, and only a command carries `argument-hint` and `allowed-tools`.

So each skill is authored once and its command is generated from it: same body, three frontmatter keys. `bash .zcode/scripts/gen-commands.sh <name>` regenerates one, `bash .zcode/scripts/gen-commands.sh` all of them, and `--check` says which are out of date. ZCode ignores `argument-hint`, `allowed-tools`, `user-invocable` and `model` in a skill file; they are kept there because the framework's own linters read them and because the generator copies them.

### 3. No `model:` line picks a model

ZCode skips an unknown key in a skill. On an agent it skips exactly the aliases `inherit`, `main`, `sonnet`, `opus` and `haiku`; any other value it reads as a model ID. So every skill, command and agent here runs on the session's model, and the haiku/sonnet/opus tiers only record how hard each job was judged to be. To run one agent on another model, see [model-tiers.md](model-tiers.md).

### 4. Session context is hook JSON

`session-start.sh` and `detect-gaps.sh` print plain text, which Claude Code added to the context. ZCode discards a hook's output unless it is JSON. Both are therefore registered through `hook-context-wrap.sh`, which runs the script and prints what it printed as `additionalContext`. Neither script changed for it.

### 5. Path-scoped rules come from a hook

Upstream, a rule in `rules/` with `paths:` frontmatter loaded by itself when the model read a matching file, and so did each folder's `CLAUDE.md`. ZCode loads `AGENTS.md` and nothing else on its own. `scoped-rules.sh` stands in: on Read, Edit and Write it passes the model the body of every rule whose globs match the file, once per session, and again after a compaction or `/clear`.

Two differences from the original: the rules also arrive on Edit and Write (the original waited for a read, which most work in this framework never does), and they arrive as context next to the tool call rather than at the top of the session. `bash .zcode/hooks/scoped-rules.sh --list` shows every rule and its globs, and `--match <path>` shows which ones a file would bring.

### 6. The subagent hooks sit on the Agent tool

ZCode has no `SubagentStart` or `SubagentStop`. `log-agent.sh` is registered on PreToolUse for `Agent`, and `log-agent-stop.sh` and `validate-agent-artifact.sh` on PostToolUse for `Agent`: the Agent call is what starts a subagent, and its return is what ends one. The audit log and the spawn tally in `session-cost.md` work as before.

The artifact check reads the return contract from the call's own prompt instead of a subagent transcript, and it also passes its warning to the model, which can resume the agent. A call that handed the subagent to the background returns before the subagent is done; the two hooks recognise that and leave it alone.

### 7. Permissions are ZCode's

The original shipped a permission file that auto-approved its read-only helper scripts and denied dangerous operations. ZCode has no project settings file for such lists, so this port ships none. What stands in: the permission mode chosen in ZCode, the "May I write?" rule every skill and agent repeats, and `allowed-tools` on each slash command. A skill the model starts on its own has no pre-approval.

### 8. Eight skills were for the user to start

`changelog`, `day-one-patch`, `dev-story`, `hotfix`, `help`, `launch-checklist`, `settings` and `story-done` carried `disable-model-invocation: true`, which kept the model from starting them. ZCode does not read that key. Each of the eight now says in its description that it starts only when the user types its name. That is an instruction to the model, not a lock.

### 9. The engine reference is a line, not an import

Upstream, `/setup-engine` wrote `@docs/engine-reference/<engine>/VERSION.md` into `CLAUDE.md`, and the file was loaded in every session. Here the line is `Engine version reference: docs/engine-reference/<engine>/VERSION.md`: `AGENTS.md` tells the model to read the file before it uses an engine API, and `session-start.sh` warns when the line and `project.yaml` disagree, as before.

### 10. Smaller things

- The `prototyper` agent no longer runs in a git worktree. It works in the user's checkout and its prompt says so.
- The check for a newer upstream release is gone. An upstream release cannot be applied to this port as it is.
- `/prototype`'s effort line always reads `this session's`: ZCode's Agent tool takes no effort input, and no environment variable outside the session sets one.
- `references-save.sh` reads a transcript store ZCode does not keep, so it always answers `not_assessed` and says why.
- A hook decides it is in a project root by `.zcode/hooks/yaml-helper.sh`, not by the `.zcode/` folder, which every ZCode project has.

## Not carried over

| Upstream | Why |
|---|---|
| `pre-compact.sh` | ZCode has no PreCompact event. `session-start.sh` still restores context after a compaction |
| `notify.sh` | A Windows toast on a Notification event, which ZCode does not have |
| `log-instructions.sh` | It recorded which instruction files loaded; ZCode loads `AGENTS.md` and nothing else on its own |
| `update-check.sh` | It looked for upstream releases, which do not apply to this port |
| `statusline.sh` | ZCode has no status line |
| `.worktreeinclude` | Claude Code worktree support; the prototyper is the only user of it |
| Agent teams | Several sessions sharing a task list was a Claude Code experiment. See [agent-teams.md](agent-teams.md) |
| The permission lists | See item 7 above |
| `.github/` | Templates and funding links of the upstream repository |

## Checking it in ZCode

The build and the checks below ran outside ZCode. Only a live session can show the rest, so the first session is a test:

1. **Open the project root in ZCode**, the folder holding `AGENTS.md` and `project.yaml`, not a subfolder.
2. **Skills.** Settings → Skills should list the 78, and `/` in the input box should offer them as commands and as skills.
3. **Subagents.** Settings → Subagents should list the 49.
4. **Hooks.** ZCode keeps a record of a workspace's hooks. If it shows them as not runnable, allow them there; each run is written to the ZCode log with its event and outcome.
5. **Session context.** The first reply should show that the model has the session block: branch, review mode, and the gaps `detect-gaps.sh` found.
6. **A rule.** Ask for a file under `src/gameplay/` to be read. The gameplay rule should arrive with it, once.
7. **A skill.** Type `/next-step`. The model should run the first command, then follow the skill.

If the hooks misbehave, open `.zcode/config.json` and set `"enabled": false` under `hooks`. The skills and the agents work without the hooks; only their checks are lost.

### What was checked without ZCode

`verify.py` in the build kit copies the template to a scratch folder and feeds each hook the payload ZCode would send. It passed 48 checks:

- session context and gap detection come back as `additionalContext` JSON, with the right event name
- the engine reference line: reported when missing, when it names another engine, and silent when it matches; the grow step writes it in the form `session-start.sh` reads
- path-scoped rules: every rule listed, globs matched without regard to case and with braces expanded, a rule passed once per session and again after `--reset`, a payload that cannot be read fails open
- the validate hooks: commit, push, assets, the read guard (refused whole, allowed in ranges), skill and command edits
- the Agent-tool hooks: the audit record, the completion record, a background hand-off left alone, the artifact warning, the spawn tally
- `yaml-helper.sh`, `gen-commands.sh` (in sync, stale after an edit, written on regeneration), and the framework's own `skill-lint.sh` and `agent-check.sh` on the whole tree

The build itself stops when a passage it rewrites cannot be found, and it checks the counts, every skill's and agent's frontmatter, that each hook registration names a file that exists, the syntax of every script, and that no old path or name is left.

### What only a live session can show

- that ZCode fires each registration, and trusts the workspace hooks
- that `additionalContext` reaches the model for SessionStart and PreToolUse
- that the Agent-tool hooks fire, and that a background hand-off is recognised
- that `allowed-tools` on a command pre-approves what it names
- which of a command and a skill answers a typed `/name`

## Editing the template

- **A skill:** edit `.zcode/skills/<name>/SKILL.md`, then run `bash .zcode/scripts/gen-commands.sh <name>`.
- **An agent:** edit `.zcode/agents/<name>.md`. Frontmatter keys ZCode reads: `name`, `description`, `tools`, `disallowedTools`, `maxTurns`, `memory`, `skills`, `model`, `thoughtLevel`.
- **A rule that applies to some files:** a file in `.zcode/rules/` whose frontmatter is `paths:` and a list of globs.
- **A rule that applies everywhere:** `AGENTS.md`. It costs context in every session.
- **A hook registration:** `.zcode/config.json`, under `hooks.events`. The command is `bash "${CLAUDE_PROJECT_DIR}/.zcode/hooks/<name>.sh"`, and `timeout` is in seconds.
- **Personal instructions:** `~/.zcode/AGENTS.md`, loaded before the project's. See [local-settings-template.md](local-settings-template.md).

## Rebuilding from a newer upstream

The build kit (`port.py`, `port_text.py`, `overlay/` and `verify.py`) turns an upstream checkout into this template and stops when a passage it rewrites has moved:

```bash
python3 -I port.py --src <upstream checkout> --out <new folder> --commit <upstream sha>
python3 -I verify.py --template <new folder> --scratch <scratch folder>
```

Then merge the new folder into your project by hand. Your game's own files (`design/`, `docs/`, `src/`, `production/` and `project.yaml`) are never touched by the build.
