<p align="center">
  <h1 align="center">Claude Code Game Studios</h1>
  <p align="center">
    Describe a game. ZCode asks a few questions, writes a one-page brief,
    and builds a playable browser game from it.
    <br />
    Then you change it, grow it and finish it, one step at a time.
  </p>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"></a>
  <a href=".zcode/docs/zcode-port.md"><img src="https://img.shields.io/badge/ZCode%20port%20of%20v1.3.0-5C6BC0" alt="ZCode port"></a>
  <a href="https://www.buymeacoffee.com/donchitos3"><img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-Support%20this%20project-FFDD00?logo=buymeacoffee&logoColor=black" alt="Buy Me a Coffee"></a>
  <a href="https://github.com/sponsors/Donchitos"><img src="https://img.shields.io/badge/GitHub%20Sponsors-Support%20this%20project-ea4aaa?logo=githubsponsors&logoColor=white" alt="GitHub Sponsors"></a>
</p>

---

## ZCode port

This is **Claude Code Game Studios v1.3.0** moved from Claude Code to **ZCode**: the same 49 agents, 78 skills, scripts and documents. Only the way ZCode is told to run them changed.

- Skills live in `.zcode/skills/`, agents in `.zcode/agents/`, and a slash command is generated for every skill in `.zcode/commands/`.
- The hooks are registered in `.zcode/config.json`, and the session context they produce reaches the model in ZCode's format.
- Path-scoped rules and the per-folder guides are passed to the model by a hook, because ZCode loads `AGENTS.md` and nothing else on its own.
- No `model:` line picks a model here: everything runs on the session's model.

[.zcode/docs/zcode-port.md](.zcode/docs/zcode-port.md) lists every difference, what was not carried over, and how to check the wiring. This port is not maintained in the upstream repository: do not file port problems in its issue tracker.

## Make me a game

Open ZCode in a copy of this repository and say what you want:

```
/prototype a fishing game where the rare fish only bite at dusk
```

1. **A few questions.** One round, picked from the genre: the choices that
   shape the game, how it should feel, how it looks, how hard it is, the goal.
   Each has a usual answer, so "you pick" works. A vague idea ("a racing game")
   gets two or three one-line pitches to choose from first.
2. **A one-page brief.** `design/game-brief.md`: your words kept as you typed
   them, the look, the first minute, the challenge, the features and what is
   left for later. You read it and say Build it, or change something first.
3. **A first build.** A browser game in `prototypes/<name>/` that opens with a
   double-click: every figure drawn, no emoji art, no copy of another game, and
   not trivially easy. Your session builds it at its own effort ("build it at
   medium" is cheaper and thinner).
4. **Checked before you get it.** A few scripted key presses in a headless
   browser show it opens with no errors and responds; text that is too small,
   overlapping or off screen and screens that freeze are fixed in one round; and
   every line of the brief is marked built, missing or broken from the
   screenshots and the code, or not assessed when it could not be checked. Your
   play is the real test: the handover card says what passed, what is still broken
   and what was guessed, and ends "Not yet played by a person".

Then it is yours to play. After that:

- **Change it by asking.** Each change is checked against what you said to
  keep and to avoid, and each one you accept is a checkpoint you can go back
  to. Ask to tune it and it gains a tweak panel with a slider for every value.
- **Share it.** A clean copy without the panel and the working files, ready
  for itch.io or a link.
- **Grow it.** When you like it, it becomes a real web project (Vite and
  TypeScript, its values in data files, tests and a build), and you add to it
  one feature a sitting: say the next feature, and it is built, checked and
  committed. After every feature the same seeded run is played again and any
  change is shown to you. Stories (`/create-stories`, `/dev-story`,
  `/story-done`) only when you ask for them.
- **Finish it.** `/cut` proposes what to cut and a polish list, and a date
  when the game is to sell.

Already have a browser game? `/prototype --from <path>` brings a copy in as it
is, so it can be changed and grown the same way.

## What it has been shown to do

- **The first build.** In a blind comparison on three game ideas, the brief
  made from its questions was picked over a hand-written brief all three
  times. All six games built from the two kinds of brief were ones the tester
  said they would build on, so on the games themselves the two kinds of brief
  tied.
- **Growing.** One game was grown from its first build through six stories
  into a game the tester would keep building. That is one game, not yet a
  pattern.
- **Not yet shown:** the engine route (Godot, Unity, Unreal) and deepening one
  system with a design document. Both are built and pass the framework's own
  checks, but neither has had a test like the two above.

The games themselves are deliberately **not** shipped here: this is a template
you clone to start your own project, and somebody else's game in your repo is
clutter, not evidence.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Engines](#engines)
- [Configuration](#configuration)
- [Upgrading](#upgrading)
- [Project Structure](#project-structure)
- [Hooks, Permissions and Rules](#hooks-permissions-and-rules)
- [Studio Mode](#studio-mode)
- [Design Philosophy](#design-philosophy)
- [Customization](#customization)
- [Platform Support](#platform-support)
- [Community](#community)
- [Supporting This Project](#supporting-this-project)
- [License](#license)

---

## Getting Started

### Prerequisites

- **ZCode**, the AI coding agent this port runs in
- [Git](https://git-scm.com/)
- [Python 3](https://www.python.org/): reads `project.yaml` for every skill and hook, and matches the path-scoped rules. Without it every setting silently falls back to its default
- **Bash**: runs every hook. Built into macOS and Linux; on Windows it comes with [Git for Windows](https://git-scm.com/download/win)
- **Chrome, Edge or Chromium**: `/prototype` plays and screenshots each game in it. Without one, those checks say they were not assessed
- **Recommended**: [Node.js](https://nodejs.org/) (to grow a game into a web project, for a 3D game's three.js, and for the web engine's build and tests) and [jq](https://jqlang.github.io/jq/) (for the most robust hook input parsing)

Hooks fail gracefully if optional tools are missing: you just lose validation. One exception is deliberate. A commit that stages data JSON is blocked when there is no Python to validate it.

### Setup

1. **Unzip this template** as your game's folder, or copy its contents into
   the root of an existing project:
   ```bash
   unzip ccgs-zcode.zip -d my-game && cd my-game
   git init
   ```

2. **Open that folder in ZCode**, the one holding `AGENTS.md` and
   `project.yaml`. Open the root, not a subfolder: ZCode reads the 49 agents
   and the hooks from the folder you open, so a session started in `src/` has
   neither.

3. **Type `/prototype` and your idea**, or **run `/start`**, which asks where
   you are (make me a game, an idea or none yet, clear design, existing work)
   and guides you to the right workflow. No assumptions.

   Other ways in:
   - `/next-step`: names the one next step wherever you are
   - `/brainstorm`: explore game ideas from scratch
   - `/setup-engine godot 4.7`: configure an engine if you already know you want one
   - `/project-stage-detect`: analyze an existing project

## Engines

| Engine | `engine.name` | Code root | Notes |
|--------|---------------|-----------|-------|
| **Web** | `Web` | `src/` | The default for a new project. A one-shot needs no engine at all; a grown game is a web project. `/setup-engine web` offers a starter: nothing extra, three.js, Phaser or PixiJS |
| **Godot 4** | `Godot` | `src/` | GDScript, C# or GDExtension |
| **Unity** | `Unity` | `Assets/` | Unity compiles only `Assets/` and `Packages/` |
| **Unreal Engine 5** | `Unreal` | `Source/<Module>/` | C++ and Blueprints |

`/setup-engine` pins the engine version and writes its reference docs
(`docs/engine-reference/<engine>/`). With no engine set, `/prototype` builds
in the browser first; you pick an engine after you have played the game. Each
engine's folders and default commands come from one table,
`.zcode/engines/engines.tsv`. If your code or tests live somewhere else, set
`engine.code_root` or `engine.test_root` in `project.yaml`.

## Configuration

`project.yaml` at the repo root is the single source of truth for how the
studio behaves on your project — engine, naming conventions, and a `modes`
block that controls how much process every skill enforces. `/start` writes it
for you; you rarely need to hand-edit it.

The one question that matters most is **`modes.rigor`** — `minimal`, `standard`,
or `full`. It's a single front door over six separate knobs (`workflow` —
which GDD sections are required, `docs.density`, `qa.level`,
`story_granularity`, `review_mode` — how many director agents review your work,
and `team.size`), so `/start` asks it once instead of six times:

- **`minimal`** (default) — the light path. No GDDs required, terse docs, minimal QA evidence, solo review. `/prototype` (questions, a brief, a first build) → play and change it → grow it on PROCEED → one feature a sitting: name it, and it is built, checked and committed. Stories (`/create-stories` → `/dev-story` ↔ `/story-done`) only when you ask.
- **`standard`** — 5 required GDD sections, balanced doc depth, standard QA evidence, lean review.
- **`full`** — all 8 GDD sections, thorough docs, full QA evidence on every story type, full director review.

`minimal` is the default because the heavier tier costs more to reach working
code without producing a better result, and gives nothing back when someone new
picks the project up. Raise it in one `/project-settings` call when your project grows
— `/next-step` and `/gate-check` will suggest it when they see the signs.

Two escape hatches keep one setting from being a blunt instrument.
**`system_overrides`** holds a single system to a higher standard than the rest
of the project — your combat system gets the full treatment while everything
else stays light. **`testing.strict`** sets, per test type (logic, integration,
visual, UI, config), whether missing evidence blocks a story or merely warns.

Any of the six underlying knobs can still be set individually if you want a mix
(e.g. `workflow: full` with `docs.density: terse` — comprehensive but compact).
Two of them — `review_mode` (`full` / `lean` / `solo`) and `team.size` — are
also **personal**: rigor sets the team-wide default, but you can override them
per-developer in a gitignored `project.local.yaml` without touching the shared
config. `modes.automation` (how often the AI pauses to ask before it acts) sits
outside rigor and is likewise personally overridable. `project.goal` (a jam
game, a hobby, a game to sell, and so on) is what you want from the game;
`/start` guesses it, and `/cut` reads it.

View or change any setting with the `/project-settings` skill:

```
/project-settings                              # view effective config
/project-settings modes.review_mode            # view one setting
/project-settings modes.rigor=full             # write to project.yaml (team-wide)
/project-settings --local modes.review_mode=solo   # write to project.local.yaml (just you)
```

Full schema and per-setting behavior: `.zcode/docs/effects-map.md`.

## Upgrading

This is a port of upstream v1.3.0. [UPGRADING.md](UPGRADING.md) is the upstream
document, kept for reference: its steps move a Claude Code project between
upstream versions and do not apply here. [zcode-port.md](.zcode/docs/zcode-port.md)
says how this template was built and how to rebuild it from a newer upstream.

## Project Structure

```
AGENTS.md                           # Master configuration; ZCode loads it every session
project.yaml                        # Project settings: engine, modes, goal
.zcode/
  config.json                       # Hook registrations (hooks.events)
  agents/                           # 49 agent definitions (markdown + YAML frontmatter)
  skills/                           # 75 skills, plus three old names (a subdirectory each)
  hooks/                            # 14 hook scripts and 4 helpers (yaml-helper.sh, hook-context-wrap.sh,
                                    #   agent-hook-lib.sh, scoped-rules.py), wired by config.json
  scripts/                          # Helper scripts the skills and hooks run; each .sh has --help
  rules/                            # 18 path-scoped rules: 14 coding standards, 4 folder guides
  genres/                           # Genre sheets and look guidance /prototype asks and
                                    #   builds from
  engines/                          # The engine table (engines.tsv) and the web starter
  docs/
    workflow-catalog.yaml           # 7-phase pipeline definition (read by /next-step)
    templates/                      # 62 document templates (+ per-section guidance)
prototypes/                         # One-shots, one folder each (isolated from src/)
references/                         # Optional: images and sounds you like, for /prototype
src/                                # Game source code (Godot, Web). The code root is
                                    #   ENGINE-SPECIFIC: Unity compiles only
                                    #   Assets/, Unreal builds from Source/<Module>/
assets/                             # Art, audio, VFX, shaders, data files
design/                             # The game brief, GDDs, narrative docs, level designs
docs/                               # Technical documentation, ADRs, engine references
tests/                              # Test suites (unit, integration, performance, playtest)
tools/                              # Build and pipeline tools
production/                         # Sprint plans, milestones, release tracking
studio-tests/                       # QA for the skills and agents themselves — see below
```

### Testing your customizations

Claude Code Game Studios is a template you are meant to edit. `studio-tests/` is how
you check that an edited or newly written skill still holds up — a catalog of all
75 skills and 49 agents, per-category quality rubrics, behavioral specs, and
templates for writing specs of your own.

```
/skill-test static [name]     # structural linter — 7 compliance checks
/skill-test category [name]   # category-specific quality rubric
/skill-test spec [name]       # behavioral spec assertions
/skill-test audit             # coverage report across skills and agents
/skill-improve [name]         # test-fix-retest loop; keeps or reverts on score change
```

It tests the *framework*, never your game — game tests live in `tests/`.

## Hooks, Permissions and Rules

**Hooks** run automatically on every session, from `.zcode/config.json`:

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

> **Note**: `validate-commit.sh`, `validate-push.sh`, `validate-read.sh`, `validate-write.sh`, `validate-registry.sh`, `validate-assets.sh` and `validate-skill-change.sh` fire on every Bash, Read, Write or Edit tool call and leave at once when the command or file is not theirs to check.

**Permissions in ZCode.** The original shipped a permission file that auto-allowed its read-only helper scripts and denied dangerous operations (force push, `rm -rf`, reading `.env` files). ZCode has no project file for such lists, so this port ships none. Three things stand in for it: the permission mode you pick in ZCode (its guarded mode stops for the dangerous shell commands the old deny list named), the "May I write?" rule every skill and agent repeats, and `allowed-tools` on each slash command, which pre-approves the helpers when you type `/name`. See [setup-requirements.md](.zcode/docs/setup-requirements.md).

**Subagents.** The hooks that watched a subagent start and stop (`SubagentStart`, `SubagentStop` upstream) sit on the `Agent` tool here instead, because ZCode has no subagent events of its own.

### Path-Scoped Rules

Coding standards are automatically enforced based on file location. The paths
below are Godot's. Each rule also matches the Unity and Unreal layouts: the code
rules match C# under `Assets/**/Gameplay/` and C++ under `Source/**/Gameplay/` (and `Core`,
`AI`, `Networking`, `UI`), data matches JSON under `Assets/**/Data/` and
`Content/**/Data/`, shaders match by file type, and tests match
C# under `Assets/Tests/` and C++ under `Source/**/Tests/`.

| Path | Enforces |
|------|----------|
| `src/gameplay/**` | Data-driven values, delta time usage, no UI references |
| `src/core/**` | Zero allocations in hot paths, thread safety, API stability |
| `src/ai/**` | Performance budgets, debuggability, data-driven parameters |
| `src/networking/**` | Server-authoritative, versioned messages, security |
| `src/ui/**` | No game state ownership, localization-ready, accessibility |
| `design/gdd/**` | Required sections per `modes.workflow`, formula format, edge cases |
| `design/narrative/**` | Lore consistency, character voice, canon levels |
| `assets/data/**/*.json` | JSON validity, naming conventions, schema rules |
| `assets/shaders/**` | Naming conventions, performance targets, cross-platform rules |
| `**/*.tscn`, `**/*.tres` | Scene and resource files changed in the editor where possible; safe hand-edit rules |
| `tests/**` | Test naming, coverage requirements, fixture patterns |
| `prototypes/**` | A one-shot's tuning values in `config.js` and seeded randomness; relaxed standards for engine and paper prototypes |

## Studio Mode

Everything above is the light path: one brief, a game you play, one feature a
sitting as it grows. For a team, a long project, or a person who wants the paperwork, the
same project also has **studio mode**: 49 specialized agents in a studio
hierarchy, a design document per system, architecture decisions, epics and
sprints, phase gates, and `team-*` pipelines that coordinate several agents on
one feature. `/next-step` suggests it once when a grown game gets big (about
nine stories or features).

### What's Included

| Category | Count | Description |
|----------|-------|-------------|
| **Agents** | 49 | Specialized subagents across design, programming, art, audio, narrative, QA, and production |
| **Skills** | 75 | Slash commands for every workflow phase (`/prototype`, `/start`, `/design-system`, `/create-epics`, `/create-stories`, `/dev-story`, `/story-done`, etc.) |
| **Hooks** | 15 | Automated validation on commits, pushes, asset changes, design-doc reads, writes and registries, session lifecycle, agent audit trail, and gap detection |
| **Rules** | 14 | Path-scoped coding standards enforced when editing gameplay, engine, AI, UI, network code, scene and asset files, and more |
| **Templates** | 62 | Document templates for GDDs, UX specs, ADRs, sprint plans, HUD design, accessibility, and more |

### Studio Hierarchy

Agents are organized into three tiers, matching how real studios operate:

```
Tier 1 — Directors
  creative-director    technical-director    producer

Tier 2 — Department Leads
  game-designer        lead-programmer       art-director
  audio-director       narrative-director    qa-lead
  release-manager      localization-lead

Tier 3 — Specialists
  gameplay-programmer  engine-programmer     ai-programmer
  network-programmer   tools-programmer      ui-programmer
  systems-designer     level-designer        economy-designer
  technical-artist     sound-designer        writer
  world-builder        ux-designer           prototyper
  performance-analyst  devops-engineer       analytics-engineer
  security-engineer    qa-tester             accessibility-specialist
  live-ops-designer    community-manager
```

Each agent declares a model in its frontmatter: the three directors ask for
Opus, `lead-programmer` and fifteen specialists name Sonnet, and the remaining thirty
**inherit your session's model**. Treat the tiers as seniority of role, not as
a billing plan — most of the studio runs on whatever model you are already using.

### Engine Specialists

The template includes agent sets for the three major engines. Use the set that
matches your project (a web project uses the general programmers):

| Engine | Lead Agent | Sub-Specialists |
|--------|-----------|-----------------|
| **Godot 4** | `godot-specialist` | GDScript, Shaders, GDExtension |
| **Unity** | `unity-specialist` | DOTS/ECS, Shaders/VFX, Addressables, UI Toolkit |
| **Unreal Engine 5** | `unreal-specialist` | GAS, Blueprints, Replication, UMG/CommonUI |

### Slash Commands

Type `/` in ZCode to access all 75 skills (plus three old names that point to their new ones):

**Make a Game**
`/prototype` `/cut`

**Onboarding & Navigation**
`/start` `/next-step` `/project-stage-detect` `/setup-engine` `/adopt` `/project-settings`

**Game Design**
`/brainstorm` `/map-systems` `/design-system` `/quick-design` `/review-all-gdds` `/propagate-design-change`

**Art & Assets**
`/art-bible` `/asset-spec` `/asset-audit`

**UX & Interface Design**
`/ux-design` `/ux-review`

**Architecture**
`/create-architecture` `/architecture-decision` `/architecture-review` `/create-control-manifest`

**Stories & Sprints**
`/create-epics` `/create-stories` `/dev-story` `/sprint-plan` `/sprint-status` `/story-readiness` `/story-done` `/estimate`

**Reviews & Analysis**
`/design-review` `/code-review` `/balance-check` `/content-audit` `/scope-check` `/perf-profile` `/tech-debt` `/gate-check` `/consistency-check` `/security-audit`

**QA & Testing**
`/qa-plan` `/smoke-check` `/soak-test` `/regression-suite` `/test-setup` `/test-helpers` `/test-evidence-review` `/test-flakiness` `/skill-test` `/skill-improve`

**Production**
`/milestone-review` `/retrospective` `/bug-report` `/bug-triage` `/reverse-document` `/playtest-report`

**Release**
`/release-checklist` `/launch-checklist` `/write-changelog` `/patch-notes` `/hotfix` `/day-one-patch`

**Creative & Content**
`/vertical-slice` `/onboard` `/localize`

**Team Orchestration** (coordinate multiple agents on a single feature)
`/team-combat` `/team-narrative` `/team-ui` `/team-release` `/team-polish` `/team-audio` `/team-level` `/team-live-ops` `/team-qa`

### Does studio mode produce games, or documents?

A fair question, and the answer is a measurement. Games were built from one
brief at different `modes.rigor` levels, and the documents each wrote
**before its first line of game code** were counted. The lightest and the
heaviest:

| `modes.rigor` | Docs before first line of game code | Time |
|---|---:|---:|
| `minimal` | **1** (the one-page brief) | 0 min |
| `standard` | 30 | 58 min |

All of them produced a running, tested game. Two blind reviewers and a human
playtest then ranked the `standard` build **last** — the extra 29 documents
bought traceability, not a better game. That is why the light path is the
default.

### It runs the game and looks at it

A passing test says nothing about a menu drawn off-screen, so a story that
changes anything the player sees is not closed until the game has been
launched, observed, and a screenshot retained in `production/qa/evidence/`. A
parse check is not a run. This holds at every rigor level, including
`minimal`, where automated tests are waived but the look is not.

### Agent Coordination

Agents follow a structured delegation model:

1. **Vertical delegation** — directors delegate to leads, leads delegate to specialists
2. **Horizontal consultation** — same-tier agents can consult each other but can't make binding cross-domain decisions
3. **Conflict resolution** — disagreements escalate up to the shared parent (`creative-director` for design, `technical-director` for technical)
4. **Change propagation** — cross-department changes are coordinated by `producer`
5. **Domain boundaries** — agents don't modify files outside their domain without explicit delegation

### Collaborative, Not Autonomous

This is **not** an auto-pilot system. Every agent follows a strict collaboration protocol:

1. **Ask** — agents ask questions before proposing solutions
2. **Present options** — agents show 2-4 options with pros/cons
3. **You decide** — the user always makes the call
4. **Draft** — agents show work before finalizing
5. **Approve** — nothing gets written without your sign-off

You stay in control. The agents provide structure and expertise, not autonomy.

That is how a session opened at the project root behaves when ZCode asks
before it edits. The `guided` and `autonomous` automation settings, and a
ZCode permission mode that accepts edits without asking, trade some of these
prompts for speed; see [setup-requirements.md](.zcode/docs/setup-requirements.md).

## Design Philosophy

This template is grounded in professional game development practices:

- **Playable first** — a game you can play before documents about it
- **MDA Framework** — Mechanics, Dynamics, Aesthetics analysis for game design
- **Self-Determination Theory** — Autonomy, Competence, Relatedness for player motivation
- **Flow State Design** — Challenge-skill balance for player engagement
- **Bartle Player Types** — Audience targeting and validation
- **Verification-Driven Development** — Tests first, then implementation

## Customization

This is a **template**, not a locked framework. Everything is meant to be customized:

- **Add/remove agents** — delete agent files you don't need, add new ones for your domains
- **Edit agent prompts** — tune agent behavior, add project-specific knowledge
- **Modify skills** — adjust workflows to match your team's process
- **Add rules** — create new path-scoped rules for your project's directory structure
- **Tune hooks** — adjust validation strictness, add new checks
- **Pick your engine** — web, Godot, Unity or Unreal (see [Engines](#engines)); use the matching agent set, or none
- **Tune process weight** — `modes.rigor` and its underlying knobs in `project.yaml` (see [Configuration](#configuration)). Override per-run with `--review solo` on any skill that runs a review gate.

## Platform Support

Upstream is developed on **Windows 10** with Git Bash. This ZCode port was built and checked on **macOS** only. The hooks and scripts are also tested on **macOS** — its stock bash 3.2 and BSD tools, with and without `jq` — and on **Linux**. All hooks use POSIX-compatible patterns (`grep -E`, not `grep -P`) and include fallbacks for missing tools. The `notify.sh` hook uses PowerShell for Windows toast notifications and is a no-op elsewhere — desktop notifications on macOS/Linux are not yet wired. Please file issues for any platform-specific breakage.

## Community

- **Discussions** — [GitHub Discussions](https://github.com/Donchitos/ZCode-Code-Game-Studios/discussions) for questions, ideas, and showcasing what you've built
- **Issues** — [Bug reports and feature requests](https://github.com/Donchitos/ZCode-Code-Game-Studios/issues)

---

## Supporting This Project

Claude Code Game Studios is free and open source. If it saves you time or helps you ship your game, consider supporting continued development:

<p>
  <a href="https://www.buymeacoffee.com/donchitos3"><img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" alt="Buy Me a Coffee"></a>
  &nbsp;
  <a href="https://github.com/sponsors/Donchitos"><img src="https://img.shields.io/badge/GitHub%20Sponsors-ea4aaa?style=for-the-badge&logo=githubsponsors&logoColor=white" alt="GitHub Sponsors"></a>
</p>

- **[Buy Me a Coffee](https://www.buymeacoffee.com/donchitos3)** — one-time support
- **[GitHub Sponsors](https://github.com/sponsors/Donchitos)** — recurring support through GitHub

Sponsorships help fund time spent maintaining skills, adding new agents, keeping up with ZCode and engine API changes, and responding to community issues.

---

*An independent ZCode port of [Claude Code Game Studios](https://github.com/Donchitos/Claude-Code-Game-Studios) v1.3.0, by Donchitos and its contributors (MIT).*

## License

MIT License. See [LICENSE](LICENSE) for details.
