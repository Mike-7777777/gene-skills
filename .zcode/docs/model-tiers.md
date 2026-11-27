# Model Tiers (ZCode port)

> This file replaces the upstream `model-tiers.md`. The tiers stay, as a label
> on every skill and agent that says how hard the job is meant to be. In ZCode
> none of them selects a model.

## What ZCode does with `model:`

| Where `model:` is written | What ZCode does with it |
|---|---|
| A skill's `SKILL.md` | Skips it. ZCode reads `name`, `description`, `when_to_use`, `license` and `metadata` from a skill and ignores every other key, so a skill runs on the session's model. |
| An agent in `.zcode/agents/` | Skips the aliases `inherit`, `main`, `sonnet`, `opus` and `haiku`: the agent runs on the session's model. Any other value is read as a model ID. |
| A slash command in `.zcode/commands/` | Reads it as a model ID. The generated command files carry no `model:` line, because an alias there would be looked up as a model. |

Every skill, command and agent in this project therefore runs on the model the
session uses. The cheapest tier saves nothing and the strongest tier costs
nothing extra. **Never tell a user a `haiku` skill is saving them money here.**

## Running one agent on another model

To take one agent off the session's model, replace the alias in its own file
with a model ID ZCode knows (the `provider/model` form the model list shows),
then open Settings → Subagents and confirm the agent shows it. Delete the
`model:` line to return to the session's model. A `thoughtLevel:` line beside
it is read as well, as that agent's reasoning level.

## The tiers as authored

A tier is written as the alias upstream Claude Code resolved it to, never as a
model ID. The lines are kept unchanged so each file still compares with its
upstream original.

| Tier | `model:` | Meant for |
|------|----------|-----------|
| **Haiku** | `haiku` | Read-only status checks, formatting, simple lookups — no creative judgment needed |
| **Sonnet** | `sonnet` | Implementation, design authoring, analysis of individual systems — default for most work |
| **Opus** | `opus` | Multi-document synthesis, high-stakes phase gate verdicts, cross-system holistic review |
| **Session** | `inherit` | Agents only — the session's model |

Skills with `model: haiku` (6): `/next-step`, `/onboard`, `/project-stage-detect`,
`/scope-check`, `/sprint-status`, and `/help`, the old name of `/next-step`

> `/help`, `/settings` and `/changelog` are the old names of `/next-step`,
> `/project-settings` and `/write-changelog`. Each carries the `model:` of the
> skill it points to, and starts that new skill in the same turn. In ZCode the
> old `/help` name is shadowed by ZCode's own built-in `/help`; type `/next-step`.

Skills with `model: opus` (3): `/architecture-review`, `/gate-check`, `/review-all-gdds`

All other skills are Sonnet. `/prototype` has no `model:` line, so it names the
session's model. In ZCode none of these lines changes which model runs: they
record how demanding each skill was judged to be.

**Agent model tiers.** 30 agents use `model: inherit`. 19 carry a pin:

- **opus (3):** `creative-director`, `producer`, `technical-director`.
- **sonnet (16):** `lead-programmer`, `prototyper`, `devops-engineer`,
  `community-manager` and the 12 engine sub-specialists:
  `godot-csharp-specialist`, `godot-gdextension-specialist`,
  `godot-gdscript-specialist`, `godot-shader-specialist`,
  `ue-blueprint-specialist`, `ue-gas-specialist`, `ue-replication-specialist`,
  `ue-umg-specialist`, `unity-addressables-specialist`,
  `unity-dots-specialist`, `unity-shader-specialist`, `unity-ui-specialist`.
  `/dev-story` and `/code-review` spawn the sub-specialists named in
  `project.yaml`'s `specialists` block (which `/setup-engine` writes); `/team-ui` spawns
  `unity-ui-specialist` and `ue-umg-specialist`; `/team-release` spawns
  `devops-engineer` and `community-manager`, and `/team-live-ops` spawns
  `community-manager`.
- **haiku (0):** no agent.

## What a tier is worth now

It ranks the work. If one model is not enough for a session, the `opus` rows
are the first to pin to a stronger one: three directors, and the three review
skills that synthesize many documents. The `haiku` rows are the last.

A subagent starts from the brief it is given, not from the parent's
conversation, so a pinned model's context window only matters for a very large
brief.
