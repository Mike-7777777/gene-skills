# Agent Coordination Rules

1. **Vertical Delegation**: Leadership agents delegate to department leads, who
   delegate to specialists. Never skip a tier for complex decisions.
2. **Horizontal Consultation**: Agents at the same tier may consult each other
   but must not make binding decisions outside their domain.
3. **Conflict Resolution**: When two agents disagree, escalate to the shared
   parent. If no shared parent, escalate to `creative-director` for design
   conflicts or `technical-director` for technical conflicts.
4. **Change Propagation**: When a design change affects multiple domains, the
   `producer` agent coordinates the propagation.
5. **No Unilateral Cross-Domain Changes**: An agent must never modify files
   outside its designated directories without explicit delegation.
6. **Read Design Docs by Section**: A brief names the sections an agent needs
   by heading. Find a heading in a GDD, ADR or the art bible with the Grep
   tool (`^#`, content mode) and Read that range with offset and limit; read a doc
   whole only when the task needs all of it, and say why. `validate-read.sh`
   refuses a whole-file read of a doc over 40 KB.
7. **Nothing Goes Upstream**: Never file, open or comment on an issue or pull
   request in an engine, plugin or vendor repository, even when asked. Write a
   draft (`/bug-report` drafts only) and the user submits it.

## Model Tier Assignment

Read `.zcode/docs/model-tiers.md` on demand. It carries the tier table and the
per-skill assignments.

**Key point (ZCode port):** no `model:` line selects a model here. ZCode skips
the alias on a skill, the generated slash command carries none, and on an agent
the aliases `inherit`, `sonnet`, `opus` and `haiku` all mean the session's
model. Never tell a user a `haiku` skill saves money. The tiers only rank how
hard each job was judged to be.

## Subagents

This project's one multi-agent pattern: subagents spawned via the `Agent` tool
within a single ZCode session. Used by all `team-*` skills and orchestration
skills. Subagents run sequentially or in parallel within the session and return
results to the parent.

A subagent's name is its agent type: `subagent_type: game-designer` in the
`Agent` call. The 49 agents live in `.zcode/agents/`, and ZCode lists the ones
the session can start.

**When to spawn in parallel**: If two subagents' inputs are independent (neither
needs the other's output to begin), spawn both `Agent` calls simultaneously
rather than waiting. Example: `/review-all-gdds` **Phase 2** (consistency) and
**Phase 3** (design theory) are independent — spawn both at the same time.
Phase 1 loads the GDDs and both depend on it, so it is the one phase here that
must NOT be parallelised.

Agent teams (several independent sessions sharing a task list) were a Claude
Code experiment and do not exist in ZCode. `.zcode/docs/agent-teams.md` says
what to do instead.

## Parallel Task Protocol

When an orchestration skill spawns multiple independent agents:

1. Issue all independent `Agent` calls before waiting for any result
2. Collect all results before proceeding to dependent phases
3. If any agent is BLOCKED, surface it immediately — do not silently skip
4. Always produce a partial report if some agents complete and others block
