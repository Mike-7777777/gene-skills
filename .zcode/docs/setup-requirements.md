# Setup Requirements (ZCode port)

This template requires a few tools to be installed for full functionality.
Hooks carry on without an optional tool and lose only the check it powers. The
required ones are required: without Python 3 every setting falls back to its
default and a commit that stages data JSON is blocked.

## Required

| Tool | Purpose | Install |
| ---- | ---- | ---- |
| **ZCode** | The AI coding agent this port runs in | The ZCode desktop app. Open the project's root folder with it |
| **Git** | Version control, branch management | [git-scm.com](https://git-scm.com/) |
| **Python 3** | Reads `project.yaml` for every skill and hook, and matches the path-scoped rules | [python.org](https://www.python.org/). Without it every setting silently falls back to its default, a commit that stages data JSON is blocked, and the path-scoped rules in `.zcode/rules/` are not passed to the model |
| **Bash** | Runs every hook | Built into macOS and Linux. On Windows, install [Git for Windows](https://git-scm.com/download/win) first |

## Recommended

| Tool | Used By | Purpose | Install |
| ---- | ---- | ---- | ---- |
| **jq** | Hooks | JSON parsing in the commit, push, asset and agent hooks | See below |
| **Chrome, Edge or Chromium** | `/prototype` and the checks that look at a running game | Plays and screenshots each game in it; without one, those checks say they were not assessed | A current Chrome, Edge or Chromium |
| **Node.js** | A web project: the grow step, three.js for a 3D game, the web engine's build and tests | `npm run build`, `npm run build:single`, the smoke tests | [nodejs.org](https://nodejs.org/) |

### Installing jq

**Windows** (any of these):
```
winget install jqlang.jq
choco install jq
scoop install jq
```

**macOS**:
```
brew install jq
```

**Linux**:
```
sudo apt install jq     # Debian/Ubuntu
sudo dnf install jq     # Fedora
sudo pacman -S jq       # Arch
```

## Platform Notes

### macOS / Linux
- Bash is available natively
- Install `jq` via your package manager for the most robust hook input parsing

### Windows
- Git for Windows includes **Git Bash**, which provides the `bash` command the
  hook commands in `.zcode/config.json` name
- **The port was built and checked on macOS, not on Windows.** Its hook commands
  are plain `bash "<project>/.zcode/hooks/<name>.sh"`, with none of the
  two-shell line the original needed. They assume ZCode runs a hook command
  through a shell that finds `bash` on `PATH`. If the ZCode log shows the hooks
  failing there, open `.zcode/config.json` and set `"enabled": false` under
  `hooks`: the skills and agents work without the hooks, you only lose their
  checks.

## Verifying Your Setup

Run these commands to check prerequisites:

```bash
git --version          # Should show git version
bash --version         # Should show bash version
python3 --version      # Required: Python 3
jq --version           # Should show jq version (optional)
```

Then check the port's own wiring, from the project root:

```bash
bash .zcode/hooks/scoped-rules.sh --list       # every path-scoped rule and its globs
bash .zcode/scripts/gen-commands.sh --check    # every slash command matches its skill
```

## What Happens Without Optional Tools

| Missing Tool | Effect |
| ---- | ---- |
| **jq** | Nothing is lost in the validate hooks: each falls back to `grep` to read its JSON input. jq is only more robust with unusual input. The three Agent-tool hooks use Python 3 first, jq second, `grep` last. |
| **Python 3** | Not optional (see Required). Every setting falls back to its default, because `project.yaml` is read through Python; the asset hook skips JSON validation and says so; a commit that stages data JSON is blocked. The path-scoped rules are not passed to the model, and the artifact check for a subagent says it did not run. |
| **Both** | As without Python. |

## Permissions in ZCode

The original shipped a permission file with two lists: one that auto-approved
its read-only helper scripts, one that denied `rm -rf`, force pushes and reads
of `.env` files. **This port ships neither**: ZCode has no project settings file
for such lists. What stands in for them:

- **ZCode's own permission mode.** Choose one that asks before edits and before
  shell commands while you work on production code. ZCode's guarded mode stops
  for the dangerous shell commands the old deny list named.
- **The "May I write?" rule** in `AGENTS.md`, which every skill and agent
  repeats. In a mode that accepts edits without asking, that rule is an
  instruction to the model, not a stop.
- **`allowed-tools` on a slash command.** When you type `/name`, ZCode reads
  that command's `allowed-tools` and pre-approves the helpers it names. A skill
  the model starts on its own carries no such list, so ZCode asks as its mode
  decides.

**Open the project root, not a subfolder.** The 49 agents are read from the
opened folder's `.zcode/agents/` and the hooks from its `.zcode/config.json`. A
session opened in `design/` or `src/` finds neither.

## Settings the original shipped that ZCode does not have

The upstream file covered Claude Code's prompt-cache lifetimes, its automatic
compaction window, its skill-listing budget and its sandbox. None of those keys
applies in ZCode; use ZCode's own settings for what it offers. The one setting
that mattered for this framework — starting every session in an ask-first
permission mode — is yours to pick in ZCode each session.
