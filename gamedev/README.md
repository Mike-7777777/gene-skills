# 游戏开发 skill：一个 skill 一个 Gene

收录 [awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills) commit `c6ca6c4`（Apache-2.0）中的 34 个 skill：Phaser、PixiJS、three.js 三个网页引擎的 6 个，AI、手感、镜头、存档等 15 个方向，平台跳跃、肉鸽、RPG 等 8 种类型，原型、Game Jam、itch/Steam 发布、设计文档 5 个流程。skill 正文一字未改。

## 1. 结构

- 每个 skill 单独放在本仓库的分支 `gamedev/<skill 名>` 上，那个 commit 里只有这一个 skill 和上游的 LICENSE、NOTICE。Gene 钉住的就是这些 commit，分支不能删除或强推。evolver 取 skill 时会把整个 commit 拉下来，所以装一个 skill 只下载它自己，几 KB 到几十 KB。
- 每个 skill 一个 Gene，触发词针对它自己的场景，hub 召回时直接返回对口的那一个，模型不用再在几十个 skill 里挑。
- 速查卡 `gamedev-skill-index`（分支 `gamedev/gamedev-skill-index`，约 4 KB）列出全部 34 个 skill 和它们的 Gene 名字，写死默认选择（二维网页游戏用 `phaser-core`，三维用 `threejs-scene-setup`），规定最多装 3 个。召回没命中时，模型查这张卡，再用 `evolver skill fetch --asset <Gene> --out .agents --write` 装需要的那个。
- 每个 skill 的 Gene 在策略最后一步写明相邻 skill 的 Gene 名字（取自 skill 描述里的「Not for (`x`)」），需求超出本 skill 时只换装那一个。
- 常见组合做成组合方案（Recipe），一次召回整条流程。

## 2. 发布

```bash
node gamedev/split/publish.mjs           # 从 GitHub 取每个 skill、核对摘要、生成 Gene 与 Capsule、本地跑校验，不改 hub
node gamedev/split/publish.mjs --apply   # 用本机 evolver 登录的节点发布、建组合方案、读回，结果写进 manifest.json
```

| 文件 | 内容 |
|---|---|
| `split/meta.json` | 每个 skill 的中文摘要和触发词 |
| `split/branches.json` | 每个 skill 分支的 commit 与内容摘要 |
| `split/recipes.json` | 组合方案的标题、描述和步骤 |
| `split/index/SKILL.md` | 速查卡原文（与分支 `gamedev/gamedev-skill-index` 一致） |
| `split/assets/` | 生成的 Gene 与 Capsule |
| `split/manifest.json` | hub 上的编号、状态和组合方案 |

脚本在发布前按 hub 的规则自查：触发词不少于 3 个字、Capsule 正文不超过 32000 字符、校验命令里没有 `$`、反斜杠和反引号、渲染出的 skill 名不和钉住的 skill 重名、任意两份 Capsule 正文按 hub 的相似度算法低于 0.8。

## 3. 已发布（节点 `node_90f156586d65269d`）

| skill | Gene 名字 | Gene 编号 |
|---|---|---|
| `ai-behavior-trees-utility-ai` | `gene_gdsk_ai_behavior_trees_utility_ai_v1` | `sha256:95b1110cdb883ffd2d61a6c435f1063338b645255f615260e070d42dc3393373` |
| `audio-design` | `gene_gdsk_audio_design_v1` | `sha256:ef2d493e292b80afe0e7a5c380017e001ab5d38741771d42475d41e540c5a98a` |
| `camera-systems` | `gene_gdsk_camera_systems_v1` | `sha256:b06b13a70d96ec9bc628dfd3dc3b3cb3a7bd281270253581595bc95c6d9f03b2` |
| `card-game` | `gene_gdsk_card_game_v1` | `sha256:9cc7354ad2b6c8301abc7563383aabfd9701b29669bdf8e6301ec9f83921529d` |
| `create-game-assets` | `gene_gdsk_create_game_assets_v1` | `sha256:9e0a6c4c5b7c4c874eb22f2e0bf8142c98406106de7c1cdb543f38c43e88bad2` |
| `dialogue-systems` | `gene_gdsk_dialogue_systems_v1` | `sha256:5a79094c30a9d5ad24fa582b18080b7265a1ee70e188f8bb559fd50707e9d692` |
| `game-ai` | `gene_gdsk_game_ai_v1` | `sha256:5fcc378f251158464d235f591e65a8f713f778ca43c05d8f4500d267247f4322` |
| `game-docs` | `gene_gdsk_game_docs_v1` | `sha256:56ba7864b49679d08a32094ca1dff445366f3407ca4753870fc689cfcd2f069d` |
| `game-feel` | `gene_gdsk_game_feel_v1` | `sha256:f9f51c6a0a5069197f2abb28ed180227d7a1f65e2e69ce1adb4063f68ec9712a` |
| `game-jam` | `gene_gdsk_game_jam_v1` | `sha256:112f2ad13cc361e1137f83ae7eaa25b1fbf3058895ea2a4599699565e07485aa` |
| `game-ui-ux` | `gene_gdsk_game_ui_ux_v1` | `sha256:29a000135ce449f89c80882136f4dcda43b32576a3007e24e722b1c57a46b5af` |
| `input-systems` | `gene_gdsk_input_systems_v1` | `sha256:d1f8b00c918cebf1d1239cbef7cd77de4d8d17a18021afca3eb75fbac4fb25b7` |
| `itch-publish` | `gene_gdsk_itch_publish_v1` | `sha256:c46c4d4b715843a2070e0d5e4b2612278f49a76611f368bf024a0057fadf4bb7` |
| `level-design` | `gene_gdsk_level_design_v1` | `sha256:adfedb857daa5778ecf7b6c2261fd9e2d09f039ea0c93f8e955fb09f6026e27c` |
| `performance-optimization` | `gene_gdsk_performance_optimization_v1` | `sha256:e52baaafea88c7bd48f5ee9bf5ef30a4a922ca3903d5817203b51da9358e6a13` |
| `phaser-arcade-physics` | `gene_gdsk_phaser_arcade_physics_v1` | `sha256:45d00b0db22d6c0cb0b1dd2ed09b0e76fe8ae50e0918dbc22e883e9d735c5f7d` |
| `phaser-core` | `gene_gdsk_phaser_core_v1` | `sha256:7fde425795bc0e8628b73645efb60cac20d6b61c465069a6e7cfda754539a68f` |
| `physics-tuning` | `gene_gdsk_physics_tuning_v1` | `sha256:9f3e1b3ca6a48510a59d9355d1c369d42b606f9bcb439920d0607a31137af507` |
| `pixijs-rendering` | `gene_gdsk_pixijs_rendering_v1` | `sha256:c1caa4cbc1d485cff6f9b84a289a3ac8da0883b054d34bf8680a2dae3043ebd9` |
| `platformer` | `gene_gdsk_platformer_v1` | `sha256:8f93f5411b1aecf6776dba4b932ef1876403815b9a40532789aa5a62dabe2595` |
| `procedural-gen` | `gene_gdsk_procedural_gen_v1` | `sha256:3374eaf321cfd994f48d427b856d6d0f975631e6672140384483c387c2593524` |
| `prototype-fast` | `gene_gdsk_prototype_fast_v1` | `sha256:bf85edb9b3d55bc48018dc84b10761c5d58f6e17ed5a5bd20951ec46060b0313` |
| `puzzle` | `gene_gdsk_puzzle_v1` | `sha256:ffdc86614d60775629e3df3163be45422afe7ba04577ed2f9da4584bc04a7875` |
| `roguelike` | `gene_gdsk_roguelike_v1` | `sha256:9b21295de9e7eeaddd79d90b0eacac5cca6d5ca8563eb22662046051f9641583` |
| `rpg` | `gene_gdsk_rpg_v1` | `sha256:ea67cd7253b0697ce1c5e22c127529d5fad3833e336577d48f7df8d32fd91b2a` |
| `save-systems` | `gene_gdsk_save_systems_v1` | `sha256:9c92d9c234de77ea88efe3f1dde9767a0d6945518e7ee50a34904b0017ba8f1c` |
| `shader-programming` | `gene_gdsk_shader_programming_v1` | `sha256:e4ab4cdc1a36b7c3b6cc47b7759cb965ab804744cc69d9968881e01cdacfd751` |
| `steam-publish` | `gene_gdsk_steam_publish_v1` | `sha256:835e7b21dcb48ed0cffe27b4b91d97a618e91cc46a79317eccf467742571862e` |
| `survival-crafting` | `gene_gdsk_survival_crafting_v1` | `sha256:27fd65b19a6c2b8991b043363f3dfaa21d943865be308a478940d96bbcada5cf` |
| `threejs-gltf-loading` | `gene_gdsk_threejs_gltf_loading_v1` | `sha256:ef6be75daba191a299db0123648908add15fa9df4f0f1a9e6623095d4849da9f` |
| `threejs-materials-lighting` | `gene_gdsk_threejs_materials_lighting_v1` | `sha256:def783b6facf10f2446258bc5905c6831ccb9c11327308d42e353dd7d810b35e` |
| `threejs-scene-setup` | `gene_gdsk_threejs_scene_setup_v1` | `sha256:3e642fe42e75d69b119ae5dab0ebda59c988ae6067dc8466c659ba33d45274a3` |
| `tower-defense` | `gene_gdsk_tower_defense_v1` | `sha256:5ffb6d7f3d5c27554f9fadc8bd5d20c50f276558987dde64790fa913c6161ae8` |
| `visual-novel` | `gene_gdsk_visual_novel_v1` | `sha256:1274099d8480734ff4ee033f9065fec705208af182e38001ea38f0d81d773c79` |
| `gamedev-skill-index` | `gene_gdsk_index_v1` | `sha256:d9e4ce2a0f7d249ccdeff0796ea841eec31c459bd7fb8893da1be77267c6e3ea` |

| 组合方案 | 编号 | 步骤 |
|---|---|---|
| three.js 三维网页游戏原型：搭场景、打光、加手感 | `cmww4w0f22az2923e46ayl5d0` | threejs-scene-setup → threejs-materials-lighting → game-feel |
| Phaser 二维平台跳跃游戏：场景、物理、跳跃手感 | `cmww4w1h229zy8s3frz5tizuf` | phaser-core → phaser-arcade-physics → platformer → game-feel |
| 网页肉鸽游戏：随机地牢、单局结构与存档 | `cmww4w2nm22uebj3g48e7rs9q` | phaser-core → procedural-gen → roguelike → save-systems |
| Game Jam 网页游戏：定范围、做原型、发到 itch.io | `cmww4w3p022unbj3giq0m0338` | game-jam → prototype-fast → itch-publish |

上游的 `fps-shooter` 没有发布：hub 的伦理审查把它判为武器相关内容（`ethics_violation: human_welfare`），速查卡也不列它。

按名字安装时，`gene_gdsk_audio_design_v1` 和 `gene_gdsk_ai_behavior_trees_utility_ai_v1` 目前要改用上表的编号：这两个名字下有更早发布、已撤回的版本，hub 按名字解析时挑中了撤回的那个，返回为空。
