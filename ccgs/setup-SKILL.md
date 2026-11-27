---
name: ccgs-studio-setup
description: >
  Installs Claude Code Game Studios (ZCode port of v1.3.0: 49 agents, 78 skills, hooks) into the
  current project at a pinned commit, then hands over to its /prototype, /start, /brainstorm or
  /adopt. Use when the user wants the game studio framework, or a CCGS Gene sent you here.
---

# CCGS studio setup

The studio is a whole project template, not one skill: its skills call its own scripts, docs and
hooks, so it is installed into the project root as a unit. Template: branch `ccgs/template` of
`github.com/Mike-7777777/gene-skills`, commit `0c27757`, unchanged from the ZCode port of
[Claude Code Game Studios](https://github.com/Donchitos/Claude-Code-Game-Studios) v1.3.0 (MIT, Donchitos).

## When to use

- The user asks for the game studio, CCGS, or one of its commands (`/prototype`, `/start`,
  `/brainstorm`, `/adopt`, `/launch-checklist`) and `project.yaml` plus `.zcode/skills/prototype/`
  are not in the project root yet.
- If both already exist, skip the install and go to step 4.

## Steps

1. Pick the folder. A new game: a new empty folder (ask for a name, default `my-game`). An
   existing browser game: its root; the script never overwrites a file.
2. Run `sh .agents/skills/ccgs-studio-setup/install.sh <folder>` (path relative to where this
   skill was installed). It fetches the pinned commit, checks the tree id, copies only missing files.
   Needs Git; Python 3, Bash and a Chrome-type browser are needed by the studio itself.
3. Read its last lines. For each file listed as kept, tell the user their version stayed and the
   template copy is `<file>.ccgs-new`. If `AGENTS.md` was kept, the studio's rules are not active:
   offer to merge the two by hand with the user's approval; do not replace their file.
4. Tell the user to restart ZCode with that folder opened (the root, not a subfolder). ZCode reads
   the studio's agents, skills and hooks at session start, so they do not exist in this session.
5. Hand over the command that matches the request, to run in the new session:
   - make or change a game: `/prototype <idea>`
   - new user, no idea or engine yet: `/start`
   - wants game ideas: `/brainstorm <genre or open>`
   - existing project to bring in: `/prototype --from <path>` for a browser game, `/adopt` for
     design docs and stories
   - launch readiness: `/launch-checklist` (it starts only when the user types it)

## Failure codes

`install.sh` exits 2 bad arguments, 3 no Git, 4 fetch failed (network or proxy), 5 tree id mismatch
(do not retry with another source), 6 copy incomplete. Report the printed reason and stop.
