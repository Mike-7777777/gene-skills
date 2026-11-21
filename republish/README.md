# 给案例 Gene 加上 skill 引用

《Gene在游戏（策划）领域中的需求和场景》里的案例 Gene 已由节点 `node_1caa18cad28626cf` 发布在 EvoMap 上。这个文件夹把其中 6 个 Gene 各加上一行 skill 引用重新发布：插件或 MCP 召回 Gene 后，会按这行引用先把对应的 skill 装到本地，再按 Gene 的策略动手。

## 1. 改了什么

| Case | Gene `id` | 钉住的 skill |
|---|---|---|
| 1 生存 RPG 新手任务 | `gene_quest_three_round_hidden_gate_v1` | `quest-prototype-three-round-gate` |
| 2 Boss 攻击模组 | `gene_boss_compound_attack_readable_evasion_v2` | `boss-compound-attack-readable-evasion` |
| 3 剧情分支 | `gene_magiscapes__narrative_branching__consequence_propagation_and_counterfactual_diff` | `narrative-branching-counterfactual-gate` |
| 4 序章地图 | `gene_structured_level_map_concentric_topology_harness` | `structured-level-map-concentric-harness` |
| 4.1 战斗副本 | `gene_magiscapes_combat_spatial_numeric_coupling_harness` | `combat-level-spatial-numeric-coupling` |
| 6 技能特效 | `gene_nl_to_ue_archetype_threejs_vfx_v1` | `threejs-deterministic-vfx-composer` |

Case 5（Roguelike）文档里没有对应的 skill，不动。

新版本是纯 skill 版 Gene：做法和细节全部在 skill 里，Gene 只负责被找到并把 skill 带给模型。

- 保留 hub 上现有版本里用来找到它的字段，原样不动：`type`、`id`、`category`、`domain`、`summary`、`signals_match`、`metadata`、`schema_version`。
- 前置条件（`preconditions`）只有一行 skill 引用，指向本仓库某个 commit 下的 skill 目录和它的内容摘要。
- 策略（`strategy`）只有 2 条：第 1 条让模型先安装并通读 skill，第 2 条用一句话概括这份 skill 的做法。hub 要求策略至少 2 条、每条至少 15 字。
- 去掉其余字段：长策略、约束、不变量、校验命令、验收清单等和 skill 重复的内容，以及 `confidence`、`success_streak`。evolver 把后两个当作 hub 的排名数据，校验 Gene 编号前会先删掉它们，Gene 带着它们时编号对不上，`evolver skill fetch --asset` 和 MCP 都按编号取不到这个 Gene。

插件（evolver-agent-plugin）原来跳过策略少于 4 步的 Gene，对钉了 skill 的 Gene 放开这一限制的改动在 [EvoMap/evolver-agent-plugin#106](https://github.com/EvoMap/evolver-agent-plugin/pull/106)。

`genes/` 里是改好的 6 个 Gene，`capsules/` 里是和它们配套的 6 个新 Capsule，`manifest.json` 记着每个 Gene 和 Capsule 的旧编号、新编号，以及引用它的组合方案。脚本执行时会现场重新生成 Capsule，并核对和 `capsules/` 里的一致。

发布新版本时，脚本还会处理和它相连的两样东西：

- 配套 Capsule：沿用原来的 Capsule，`gene` 指向新版本，正文开头加上这个 skill 的引用和 SKILL.md 原文，原有内容全部保留在后面，Gene 原来的校验命令照样能读到它要的数据。hub 会拒收正文开头和本节点已有 Capsule 相同的新 Capsule，所以新内容必须放在开头。
- 组合方案（Recipe）：节点下有 3 个组合方案引用了这些 Gene（`cmwninv7v0ov96s3hekw257k8`、`cmwnr0qey05wna63eksm1ni7f`、`cmwnr0kg305via63enlh708xf`）。已发布的组合方案不能直接修改，脚本把每个复制成草稿，换成新版本 Gene，用原标题发布，再把原来的归档。

最后撤回 6 个旧版本 Gene 和它们的旧 Capsule。

## 2. 怎么运行

在发布这批 Gene 的那台电脑上运行（EvoMap 节点 `node_1caa18cad28626cf`）。需要 Node.js 18 或更新、git，以及已登录的 evolver 2.0.54 或更新版本。

```bash
git clone https://github.com/Mike-7777777/gene-skills.git
cd gene-skills
node republish/republish.mjs
```

这一步只检查、不改任何东西：确认本机登录的是上面那个节点，6 个新 Gene 能通过 evolver 的校验，skill 能从 GitHub 下载且摘要一致，hub 上的旧版本和准备新版本时用的一致，并列出每个 Gene 对应的 Capsule 和组合方案。全部通过后执行：

```bash
node republish/republish.mjs --apply
```

执行顺序是先发布全部新版本，再替换组合方案，最后撤回旧版本。任何一步失败就停在那里，前面没做完的不会动后面的东西；屏幕上会写明停在哪、已经改了什么、下一步怎么办。

## 3. 注意

- 脚本不读取任何密钥，请求由本机 evolver 用它的登录身份签名。
- hub 限制同一节点 24 小时内用同一组触发词最多发布 5 次，被拒的尝试也算。失败后先按提示查清原因再重跑，不要连续重试。
- 中途停下可以直接重跑，已完成的步骤会跳过。刚发布的 Gene 需要几十秒才能放进组合方案，脚本会自动等待，最多 3 分钟。
- 每次运行的完整输出存在 `republish/logs/`。
