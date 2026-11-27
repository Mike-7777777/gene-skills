# Path-Specific Rules (ZCode port)

Rules in `.zcode/rules/` carry `paths:` frontmatter: gitignore-style globs,
matched without regard to case. In the original, Claude Code loaded a
path-scoped rule by itself when the model **read** a file matching one of those
globs. ZCode has no such mechanism (it loads `AGENTS.md` and nothing else on
its own), so a hook stands in for it: `scoped-rules.sh`, registered on
PreToolUse for Read, Edit and Write, passes the body of each matching rule to
the model as context, once per session. After a compaction or `/clear` it passes
them again.

Three consequences, and none of them are optional reading:

1. **On demand, not on every turn.** A rule reaches the model when a tool call
   names a file it matches. This includes Edit and Write, where the original
   loaded on Read only: most work in this framework creates files rather than
   reads them, and a rule first seen after the file is written guides nothing.
2. **Context, not enforcement.** A loaded rule is guidance the model weighs, the
   same as `AGENTS.md`. Anything that must hold regardless of what the model
   decides belongs in a hook; `.zcode/hooks/` already enforces JSON validity
   and commit shape that way.
3. **Every rule here is path-scoped.** A rule with no `paths:` reaches no
   session, because the hook passes only rules it can match. A rule that must
   always apply belongs in `AGENTS.md`, or in a file it includes, where it costs
   context in every session: a deliberate trade, not a default.

Where a rule duplicates guidance an agent definition already carries, the two
must agree. Contradicting instructions are resolved arbitrarily, so a rule and
an agent stating different versions of the same standard is worse than either
alone.

To see which rules exist and what each matches, from the project root:

```bash
bash .zcode/hooks/scoped-rules.sh --list
bash .zcode/hooks/scoped-rules.sh --match src/gameplay/player.gd
```

A tool call names a file by its absolute path. The hook makes it
project-relative before matching; a path outside the project matches nothing.

**Globs match regardless of case.** `Assets/**/UI/**` also matches a Godot
project's `assets/ui/` art. That is why the Unity and Unreal code globs below
name their file types.

Paths are listed Godot · Unity · Unreal. Folder names are shown in one case;
each rule's own globs list the case variants (`{AI,Ai,ai}`).

| Rule File | Path Pattern | Enforces |
| ---- | ---- | ---- |
| `gameplay-code.md` | `src/gameplay/**` · `Assets/**/Gameplay/**/*.cs` · `Source/**/Gameplay/**/*.{h,cpp}` | Data-driven values, delta time, no UI references |
| `engine-code.md` | `src/core/**` · `Assets/**/Core/**/*.cs` · `Source/**/Core/**/*.{h,cpp}` | Zero allocs in hot paths, thread safety, API stability |
| `ai-code.md` | `src/ai/**` · `Assets/**/AI/**/*.cs` · `Source/**/AI/**/*.{h,cpp}` | Performance budgets, debuggability, data-driven params |
| `network-code.md` | `src/networking/**` · `Assets/**/Network(ing)/**/*.cs` · `Source/**/Network(ing)/**/*.{h,cpp}` | Server-authoritative, versioned messages, security |
| `ui-code.md` | `src/ui/**` · `Assets/**/UI/**/*.cs` · `Source/**/UI/**/*.{h,cpp}` | No game state ownership, localization-ready, accessibility |
| `design-docs.md` | `design/gdd/**` | Required sections per `modes.workflow` (8 at `full`, 5 at `standard`), formula format, edge cases |
| `narrative.md` | `design/narrative/**` | Lore consistency, character voice, canon levels |
| `data-files.md` | `assets/data/**/*.json` · `Assets/**/Data/**/*.json` · `Content/**/Data/**/*.json` | JSON validity, naming conventions, schema rules |
| `test-standards.md` | `tests/**` · `Assets/Tests/**/*.cs` · `Source/**/Tests/**/*.{h,cpp}` | Test naming, coverage requirements, fixture patterns |
| `prototype-code.md` | `prototypes/**` | One-shot browser games (values in `config.js`, seeded randomness, plays offline) and throwaway engine or paper prototypes (relaxed standards, README, hypothesis documented) |
| `shader-code.md` | `assets/shaders/**`, `**/*.gdshader` · `Assets/**/*.{shader,hlsl,cginc,compute,shadergraph}` · `Shaders/**`, `**/*.{usf,ush}` | Naming conventions, performance targets, cross-platform rules |
| `scene-files.md` | `**/*.tscn`, `**/*.tres` · `**/*.unity`, `**/*.prefab`, `Assets/**/*.asset` · — | Hand-edit limits for editor-written scene and asset files; Unreal `.uasset`/`.umap` are binary: leave them to the editor |
| `agent-memory.md` | `.zcode/agent-memory/**` | The one place an agent may write unasked — and why a temporary absence must never be recorded as a durable fact |
| `skill-authoring.md` | `.zcode/skills/**`, `.zcode/agents/**` | A check must be able to report that it did not run — the five obligations for verdicts, defaults, skips, sourcing and derived coverage |
| `src-directory.md` | `src/**` | Writing and editing game code: doc comments on public APIs, data-driven gameplay values, ADRs per `modes.workflow`, tests in `tests/`, verification before "done" |
| `design-directory.md` | `design/**` | The 8 GDD sections and how many `modes.workflow` requires, quick specs, UX specs, and why `design/accessibility-requirements.md` sits outside `design/ux/` |
| `docs-directory.md` | `docs/**` | ADRs and their required sections, the TR registry and its stable IDs, the control manifest, and the engine reference folder |
| `studio-tests-directory.md` | `studio-tests/**` | How the test catalog, specs and rubric fit together, the fixture defaults, and that the folder is deletable |

Each engine-facing rule loads on all three engines:

- **Code rules** (`gameplay`, `engine`, `ai`, `network`, `ui`) match
  `Assets/**/<System>/**/*.cs` and `Source/**/<System>/**/*.{h,cpp}` (`Core`,
  `AI`, `Networking`/`Network`, `UI` for the others).
- **`data-files.md`** matches `Assets/**/Data/**/*.json` and `Content/**/Data/**/*.json`
  — JSON only, so C# or C++ in a `Data/` folder does not pick up its file-naming rule.
- **`shader-code.md`** matches shader files by type: `.gdshader`, `.shader`,
  `.hlsl`, `.cginc`, `.compute`, `.shadergraph`, `.usf`, `.ush`, plus `Shaders/**`.
- **`test-standards.md`** matches `Assets/Tests/**/*.cs` and `Source/**/Tests/**/*.{h,cpp}`.
- **`scene-files.md`** is the exception: Godot and Unity scene and asset files are text and have
  rules; Unreal's are binary, so a deny rule blocks edits instead of a rule guiding them.

> **`skill-authoring.md` is the odd one out and deliberately so.** Every other
> rule here scopes a *game* directory; that one scopes the **framework's own**
> authoring paths. It exists because one failure shape kept recurring across
> unrelated subsystems — a step that could not run producing output
> indistinguishable from a step that ran and found nothing. The same mistake in
> nine places is a missing design rule, not nine mistakes.
