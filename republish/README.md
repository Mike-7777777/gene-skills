# 更新案例 Gene 的 skill 引用

《Gene在游戏（策划）领域中的需求和场景》里的案例 Gene 由节点 `node_1caa18cad28626cf` 发布在 EvoMap 上，每个 Gene 在前置条件（`preconditions`）里钉住本仓库的一份 skill。插件或 MCP 召回 Gene 后，会按这行引用先把 skill 装到本地，再按 Gene 的策略动手。这个文件夹把 6 个 Gene 的引用换到新版本的 skill 重新发布。

## 1. 改了什么

skill 换到本仓库 commit `4e2bc345a1bc245116d2a54ab92edb4b81e4ea6b`。这一版每份 skill 新增「交付前真实试玩验收」一节，要求模型交付前在真实浏览器里用键盘鼠标把最终页面完整玩一遍，并写明各自领域要重点检查的地方；特效那份补回了三段包络函数、刀光镜像规范、界面分层规则和验收标准。

| Case | Gene `id` | 钉住的 skill | 新内容摘要 |
|---|---|---|---|
| 1 生存 RPG 新手任务 | `gene_quest_three_round_hidden_gate_v1` | `quest-prototype-three-round-gate` | `9fc82ac4…` |
| 2 Boss 攻击模组 | `gene_boss_compound_attack_readable_evasion_v2` | `boss-compound-attack-readable-evasion` | `b59a5e48…` |
| 3 剧情分支 | `gene_magiscapes__narrative_branching__consequence_propagation_and_counterfactual_diff` | `narrative-branching-counterfactual-gate` | `fe26565a…` |
| 4 序章地图 | `gene_structured_level_map_concentric_topology_harness` | `structured-level-map-concentric-harness` | `68403957…` |
| 4.1 战斗副本 | `gene_magiscapes_combat_spatial_numeric_coupling_harness` | `combat-level-spatial-numeric-coupling` | `569208d0…` |
| 6 技能特效 | `gene_nl_to_ue_archetype_threejs_vfx_v1` | `threejs-deterministic-vfx-composer` | `11335889…` |

Gene 的其余字段（摘要、触发信号、标签、策略等）和 hub 上现在的版本完全一样，只有前置条件里那行 skill 引用的 commit 和摘要变了。新旧编号记在 `manifest.json`。

发布新版本时，脚本还会处理和它相连的两样东西：

- 配套 Capsule：沿用 hub 上现在的 Capsule，`gene` 指向新版本，正文开头的 skill 引用和 SKILL.md 原文换成新版本，其余内容原样保留。hub 会拒收正文开头和本节点已有 Capsule 相同的新 Capsule，变化的部分放在开头正好避开这一点。
- 组合方案（Recipe）：节点下有 5 个组合方案引用了这些 Gene（`cmwq00p8i0h0c7s3f9usqcd62`、`cmwq00vbo0h3n7s3fwosfhgmy`、`cmwq10c490e9q9o3f3rmfgnw0`、`cmwq10eke0epobi3fy9kgkdjd`、`cmwq00z5209whbi3fi7gema66`）。已发布的组合方案不能直接修改，脚本把每个复制成草稿，换成新版本 Gene，用原标题发布，再把原来的归档。

最后撤回 6 个旧版本 Gene 和它们的旧 Capsule。

`genes/`、`capsules/` 和 `manifest.json` 由 `build.mjs` 从 hub 上现有的 Gene 生成，任何已登录 evolver 的节点都能重新生成一遍核对：

```bash
node republish/build.mjs <skill commit> <Gene 编号>...
```

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
