---
name: gamedev-skill-index
description: >
  Index of 34 game-dev skills (web engines Phaser, PixiJS, three.js; 15 disciplines; 8 genres;
  5 workflows) published as separate EvoMap Genes. Use when a game task needs a skill that recall
  did not already install: pick at most three rows and install each with one command.
---

# Game-dev skill index

Each skill is its own Gene; install only what the task needs. Upstream:
[awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills)
`c6ca6c4` (Apache-2.0), skill text unchanged.

## Rules

1. If recall already installed a skill under `.agents/skills/` that fits, use it; do not open this table.
2. Otherwise pick **at most three** rows: one engine (if web), one concern, one genre or workflow.
3. Install: `evolver skill fetch --asset <Gene> --out .agents --write`, then read only that `SKILL.md`.
4. Defaults, no deliberation: 2D web game → `phaser-core`; 3D web game → `threejs-scene-setup`;
   existing project → the engine in `package.json`. Godot, Unity, Unreal, Roblox and other
   engines are not in this set: work from the project's own code and docs.
5. A skill that names another one in "Not for (`x`)" means: switch to `x` from this table.

## Engines (web)

| Need | Skill | Gene |
|---|---|---|
| Phaser setup, scenes, loader, black screen | phaser-core | `gene_gdsk_phaser_core_v1` |
| Phaser movement, colliders, bullet pools | phaser-arcade-physics | `gene_gdsk_phaser_arcade_physics_v1` |
| PixiJS 2D rendering, drag, blank canvas | pixijs-rendering | `gene_gdsk_pixijs_rendering_v1` |
| three.js scene, renderer, loop, black canvas | threejs-scene-setup | `gene_gdsk_threejs_scene_setup_v1` |
| three.js glTF/GLB models and animation | threejs-gltf-loading | `gene_gdsk_threejs_gltf_loading_v1` |
| three.js materials, lights, shadows | threejs-materials-lighting | `gene_gdsk_threejs_materials_lighting_v1` |

## Concerns

| Need | Skill | Gene |
|---|---|---|
| Enemy AI, patrol/chase, A* pathfinding | game-ai | `gene_gdsk_game_ai_v1` |
| Behavior tree / utility AI code | ai-behavior-trees-utility-ai | `gene_gdsk_ai_behavior_trees_utility_ai_v1` |
| Juice: shake, hit-stop, squash | game-feel | `gene_gdsk_game_feel_v1` |
| Camera follow, orbit, split-screen | camera-systems | `gene_gdsk_camera_systems_v1` |
| HUD, menus, scaling, safe areas | game-ui-ux | `gene_gdsk_game_ui_ux_v1` |
| Input actions, gamepad, rebinding | input-systems | `gene_gdsk_input_systems_v1` |
| Physics jitter, tunnelling, timestep | physics-tuning | `gene_gdsk_physics_tuning_v1` |
| Level layout, gating, pacing | level-design | `gene_gdsk_level_design_v1` |
| Procedural dungeons, WFC, noise, loot | procedural-gen | `gene_gdsk_procedural_gen_v1` |
| Save/load, slots, migration | save-systems | `gene_gdsk_save_systems_v1` |
| Branching dialogue, Ink, Yarn | dialogue-systems | `gene_gdsk_dialogue_systems_v1` |
| Audio mix, adaptive music | audio-design | `gene_gdsk_audio_design_v1` |
| Shader math: dissolve, outline, post | shader-programming | `gene_gdsk_shader_programming_v1` |
| Low FPS, stutter, profiling | performance-optimization | `gene_gdsk_performance_optimization_v1` |
| Sprites, pixel art, tilesets, icons | create-game-assets | `gene_gdsk_create_game_assets_v1` |

## Genres

| Need | Skill | Gene |
|---|---|---|
| Platformer jump feel | platformer | `gene_gdsk_platformer_v1` |
| Roguelike / roguelite runs | roguelike | `gene_gdsk_roguelike_v1` |
| RPG stats, items, quests | rpg | `gene_gdsk_rpg_v1` |
| Tower defense waves, economy | tower-defense | `gene_gdsk_tower_defense_v1` |
| Card game / deckbuilder | card-game | `gene_gdsk_card_game_v1` |
| Visual novel, routes, endings | visual-novel | `gene_gdsk_visual_novel_v1` |
| Survival crafting loop | survival-crafting | `gene_gdsk_survival_crafting_v1` |
| Match-3, Sokoban, logic puzzles | puzzle | `gene_gdsk_puzzle_v1` |

## Workflows

| Need | Skill | Gene |
|---|---|---|
| One-hour throwaway prototype | prototype-fast | `gene_gdsk_prototype_fast_v1` |
| Game jam against a deadline | game-jam | `gene_gdsk_game_jam_v1` |
| Publish on itch.io (butler) | itch-publish | `gene_gdsk_itch_publish_v1` |
| Publish on Steam (SteamPipe) | steam-publish | `gene_gdsk_steam_publish_v1` |
| GDD and feature docs | game-docs | `gene_gdsk_game_docs_v1` |
