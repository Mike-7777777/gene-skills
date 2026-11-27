---
description: "Old name of /write-changelog. Prints one line, then runs /write-changelog. Start it only when the user types /changelog; never begin it on your own."
argument-hint: "[version|sprint-number]"
allowed-tools: Skill(write-changelog)
---

> Paths in this skill are relative to the project root (the folder that holds `project.yaml`), whatever a "relative to this base directory" line says. A `/name` to run is the skill or slash command `name`: invoke it with the Skill tool, or type it.

# /changelog — old name of /write-changelog

Several AI tools keep `/changelog` for a command of their own, so this skill is now
`/write-changelog`.

1. Print this line exactly, as the first line of your reply:

   /changelog is now /write-changelog. Running /write-changelog.

2. Run the `write-changelog` skill with the Skill tool, passing these arguments unchanged
   (none, if this is empty): $ARGUMENTS

Do nothing else here: `/write-changelog` does the work.
