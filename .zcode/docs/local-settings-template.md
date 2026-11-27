# Personal Settings (ZCode port)

This file replaces the upstream `settings-local-template.md` and
`CLAUDE-local-template.md`. Neither of the files they described exists here:
ZCode loads no per-project local settings file and no per-project local
instructions file of its own.

## Personal instructions: `~/.zcode/AGENTS.md`

ZCode loads this user file in every workspace, before the project's
`AGENTS.md`. Put defaults of your own there:

```markdown
# Personal Preferences

## Workflow Preferences
- Always run tests after code changes
- Use /clear between unrelated tasks

## Local Environment
- Python command: python3 (or py on Windows)
- Shell: zsh on macOS, Git Bash on Windows

## Communication Style
- Keep responses concise
- Show file paths in all code references
- Explain architectural decisions briefly

## Personal Shortcuts
- When I say "review", run /code-review on the last changed files
- When I say "status", show git status + sprint progress
```

Where the two files differ, the project's `AGENTS.md` wins: ZCode loads the
user file first and the workspace file after it.

## Per-project instructions of your own

Edit the project's `AGENTS.md`. It is committed with the project, so keep in it
only what everyone on the project should share, and say the rest in the session.

## Approving commands

- When you type `/name`, ZCode reads that command's `allowed-tools` and
  pre-approves the helpers it names.
- A skill the model starts on its own carries no such list. ZCode asks, or does
  not, by the permission mode the session is in.
- To pre-approve a command for good, add it to that skill's `allowed-tools` in
  `.zcode/skills/<name>/SKILL.md`, then run
  `bash .zcode/scripts/gen-commands.sh <name>` so the command file picks it up.
  Keep the grant narrow — `Bash(npm run test *)`, not `Bash(npm *)`.

## Personal hooks

ZCode's user-scope hooks live in `~/.zcode/cli/config.json`, under `hooks`, in
the same shape as this project's `.zcode/config.json`. They need
`"enabled": true`, and they run in **every** workspace, so a hook that writes
into this project's folders must first check it is in this project:

```json
{
  "hooks": {
    "enabled": true,
    "events": {
      "Stop": [
        {
          "hooks": [
            {
              "type": "command",
              "command": "bash -c '[ -f \"$CLAUDE_PROJECT_DIR/project.yaml\" ] && mkdir -p \"$CLAUDE_PROJECT_DIR/production/session-logs\" && echo \"Response finished at $(date)\" >> \"$CLAUDE_PROJECT_DIR/production/session-logs/my-stops.log\"'",
              "timeout": 5
            }
          ]
        }
      ]
    }
  }
}
```

`Stop` fires at the end of every response, not once per session. A hook's
plain stdout is discarded in ZCode, so a hook that only prints shows nothing:
write to a file, as above.

## Models

The skills' and agents' `model:` lines do not select a model in ZCode; every one
of them runs on the session's model. To run a single agent on another model,
see [model-tiers.md](model-tiers.md).
