---
name: settings
description: "Old name of /project-settings. Prints one line, then runs /project-settings. Start it only when the user types /settings; never begin it on your own."
argument-hint: "[key | key=value | --local key=value]"
user-invocable: true
disable-model-invocation: true
allowed-tools: Skill(project-settings)
model: sonnet
---

> Paths in this skill are relative to the project root (the folder that holds `project.yaml`), whatever a "relative to this base directory" line says. A `/name` to run is the skill or slash command `name`: invoke it with the Skill tool, or type it.

# /settings — old name of /project-settings

Several AI tools keep `/settings` for a command of their own, so this skill is now
`/project-settings`.

1. Print this line exactly, as the first line of your reply:

   /settings is now /project-settings. Running /project-settings.

2. Run the `project-settings` skill with the Skill tool, passing these arguments unchanged
   (none, if this is empty): $ARGUMENTS

Do nothing else here: `/project-settings` does the work.
