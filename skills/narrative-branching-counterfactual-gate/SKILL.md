---
name: narrative-branching-counterfactual-gate
description: Design and implement branching narrative choices, moral/resource dilemmas, or level-altering switches by isolating a headless world-state machine (BRANCH_CORE) and enforcing a three-round counterfactual gate (R1 mutually exclusive mutation & zero dead-flag validation, R2 3D downstream scene materialization, R3 parallel-universe strict inequality & anti-double-dipping tests). Use when building games or prototypes where player choices must meaningfully alter subsequent scenes, passability, NPCs, and endings.
---

# 叙事分支抉择后果传播与三轮反事实平行宇宙差分门禁

根除分支叙事或关卡抉择中“按不同按钮只换两句台词，下一关地形、交互物、可拿奖励完全一样”的伪选择（Cosmetic-Only Choice），通过隔离无头分支状态机（`BRANCH_CORE`）并执行三轮反事实平行宇宙差分门禁，确保玩家的每次关键取舍都在后续关卡产生严格互斥的机械后果。

## 适用场景 (When to Use)

- 设计包含剧情分支、道德/资源两难抉择或机关分流（如：把唯一电力供给防洪泵保住仓库 vs 供给升降桥放商队过河）的游戏或可试玩原型；
- 需要让玩家的选择实质性改变后续场景的空间连通性、在场 NPC/交互物、可获取资源池及终局状态；
- 需要验证分支系统不存在死标记（Dead Flags）、伪选择（Cosmetic Choice）或正反奖励双吃（Double-Dipping）漏洞。

## 核心架构与三轮反事实门禁 (Three-Round Counterfactual Gate)

### 1. 阶段一：隔离无头分支状态机核心 (`BRANCH_CORE`)
将决策节点（Decision Nodes）、世界状态标记（World Flags）、下游场景解析器（Scene Entity Resolver）与交互动作封装在零 DOM / Canvas 耦合的无头核心模块 `/* @region BRANCH_CORE */ ... /* @endregion BRANCH_CORE */` 中，强制暴露：
- `validateBranchGraph(graph)`：静态契约与后果引用图校验；
- `resolveSceneState(worldFlags)`：根据当前世界标记纯函数解析下游场景状态；
- `BranchRuntime`：管理决策提交、节点锁定、场景交互与状态快照克隆（`fork` / `serialize`）；
- `BranchCore.selfTest()`：自动执行 R1 / R2 / R3 三轮门禁并返回结构化校验报告。

### 2. 阶段二：建模互斥取舍契约 (Mutually Exclusive Trade-off Contract)
每个关键决策节点必须包含 $\ge 2$ 个可选项，且每个选项必须显式声明正向获得与负向牺牲的 `world_mutations`：
- 示例：
  - `option_power_pump` $\rightarrow$ `world_mutations: { warehouse_saved: true, bridge_lowered: false }`
  - `option_power_bridge` $\rightarrow$ `world_mutations: { warehouse_saved: false, bridge_lowered: true }`
- 严禁任何选项仅修改对话文本而不产出非空的 `world_mutations`。

### 3. 阶段三：第一轮门禁 R1 —— 契约与后果图静态校验
在 `validateBranchGraph` 中执行全量静态检查：
1. **选项完备与互斥性**：每个决策节点的各选项 `world_mutations` 必须非空且彼此严格不相等；任何不修改世界状态的选项直接抛出 `E_COSMETIC_CHOICE`。
2. **零死标记强制校验（Zero Dead Flags）**：每一个被写入的 `world_flag` 必须至少被下游一个场景拓扑开关、实体显隐条件、资源池规则或结局判定读取；任何只写不读的标记直接抛出 `E_DEAD_FLAG`。

### 4. 阶段四：第二轮门禁 R2 —— 下游场景三维机制具象化
通过 `resolveSceneState(worldFlags)` 解析下游场景时，强制每个分支抉择同时具象化到至少 **3 个正交游戏机制维度**：
1. **空间拓扑与通行性维度（Topology & Passability）**：改变后续区域的物理可通行状态（如：抽干积水后地下仓库大门开启可进入 vs 升降吊桥降下连通河对岸新区域，而未救的仓库被洪水淹没封死）。
2. **活跃可交互物与 NPC 集合维度（Active Entities & NPCs）**：改变场景中驻留的 NPC 与交互实体（如：仓库军需官在场并发放防具物资箱 vs 河岸商队行商摆摊提供异域契约）。
3. **可获取物品池与任务目标维度（Obtainable Loot & Objectives）**：不同分支解锁严格互斥的专属道具/能力与后续目标链。

### 5. 阶段五：第三轮门禁 R3 —— 反事实平行宇宙差分与防双吃验证
在 `BranchCore.selfTest()` 中，从决策前同一状态快照分叉（`fork`）出两个独立无头运行时 **Universe A** 与 **Universe B**，分别提交 Option A 与 Option B 并推进至下游场景，强制断言：
1. **平行宇宙严格不等式（Strict Inequality Assertion）**：
   - `UniverseA.worldFlags !== UniverseB.worldFlags`
   - `UniverseA.reachableZones !== UniverseB.reachableZones`
   - `UniverseA.activeInteractableIds !== UniverseB.activeInteractableIds`
   - `UniverseA.obtainableItemIds !== UniverseB.obtainableItemIds`
   - `UniverseA.endingSummary !== UniverseB.endingSummary`
2. **互斥防双吃与代价锁定（Anti-Double-Dipping & Atomic Rejection）**：
   - 一旦提交某一互斥选项，立即在状态机层锁定该决策节点（`locked = true`）；
   - 测试在已选 Option A 后再次尝试触发 Option B，以及强行交互/搜刮已被放弃或损毁的分支目标（如把电给了吊桥后，试图去捞被淹没仓库里的物资箱），断言两者 100% 返回结构化原子拒绝（`{ ok: false, code: 'E_BRANCH_LOCKED' | 'E_ENTITY_UNAVAILABLE' }`），且背包收益与状态零篡改。

### 6. 阶段六：表现层单向绑定与对比调试
将 Canvas / UI 渲染层（如水位高低、吊桥开合动画、道路封锁障、NPC 在场表现、结局卡片）100% 单向绑定至 `resolveSceneState(runtime.world)` 的输出；在可试玩原型中提供清晰的“当前世界标记 / 平行宇宙差分对比”状态栏，让玩家直观感知抉择带来的世界变化。

## 交付前试玩冒烟 (Playtest Smoke Gate)

`BranchCore.selfTest()` 已经穷举了分支的互斥、下游具象化和平行宇宙差分，浏览器试玩只确认交付页面真的能玩通，不再重复穷举。交付前在真实浏览器里把最终页面按下面的范围走一遍：

1. **验收对象是最终交付物**：直接打开最终的 `index.html`，不拿中间数据、生成脚本的输出或 Node 沙箱模拟代替。页面若由脚本生成或烘焙，生成后对交付文件本身重新跑一遍 `selfTest()`。
2. **用真实浏览器操作**：优先使用 ZCode 自带的 `browser-use:control-browser`；不可用时再用无头 Chrome，启动参数必须带 `--use-mock-keychain`。只走页面上真实可见的输入，不用脚本直接改状态来通关。
3. **只走这几条**：
   - 每个选项各从抉择一路玩到结局一次，并在两条路线的同一位置各截一张图对比；
   - 结局出现后重开一次，确认世界状态、界面和角色完全复位。
4. **控制台零报错**。
5. **最多修一轮**：发现问题修完后，只重走受影响的那条路线；仍有问题就写进交付说明，不再循环试玩。
6. **交付说明**：列出走过的路线、两张对比截图，以及发现并修复的问题。

同一次按键只处理一次、进入新场景时出生点不落在触发区内、页面上的操作说明与实际一致，这几条在实现时保证，不为它们单独安排试玩。

## 严禁事项 (Safety Boundaries)

- 严禁交付只换台词、不改下游场景拓扑与实体的伪分支（必须触发 `E_COSMETIC_CHOICE` 或 `E_DEAD_FLAG` 拦截）。
- 严禁允许玩家通过二次点击开关或越界交互同时拿走互斥两个分支的专属奖励（零双吃）。
