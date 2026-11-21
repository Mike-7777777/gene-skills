---
name: quest-prototype-three-round-gate
description: Design and build RPG/survival quest prototypes containing multi-stage loops (gather -> build/craft -> deliver) by isolating a headless state machine and enforcing a three-round hidden fault-tolerance gate (R1 backend contract & bounded repair, R2 payload normalization & transactional persistence, R3 out-of-order permutation convergence & retroactive completion). Use when creating quest prototypes, task chains, crafting/delivery loops, or out-of-order player tolerance systems.
---

# 委托/任务原型生成与隐式三轮容错门禁 (Quest Prototype & Three-Round Fault-Tolerance Gate)

在实现包含“采集 $\rightarrow$ 建造/合成 $\rightarrow$ 交付”多阶段推进的任务系统或可试玩原型时，必须先将纯数据状态机与 UI/渲染层彻底剥离，并在隐藏数据层强制跑通三轮测试门禁（R1 生成契约校验、R2 拆段事务导入、R3 乱序收敛与向后追补），确保玩家无论按何种顺序操作都不死锁、不吞资源、不串阶段。

## 适用场景 (When to Use)

- 制作包含多阶段推进（Sequence / Stage）及跨阶段因果依赖（采集 $\rightarrow$ 建造工作台 $\rightarrow$ 合成物品 $\rightarrow$ 交付 NPC）的任务原型；
- 玩家在沙盒/场景中可能发生乱序行为（未接任务先砍树备料、提前造好工作台或目标物、材料不足时强行点击、重复连击交付、中途存档读档）；
- 需要将 AI 生成或配置表定义的任务 JSON 安全导入运行时并保障 100% 可通关。

## 核心架构与六大不变量 (Core Architecture & Invariants)

| 不变量 ID | 所属防线 | 强制规则 | 典型反例（严禁出现） |
|---|---|---|---|
| `INV_R1_DELIVERABLE_SOURCE` | R1 生成校验 | 任何 `Submit(ItemID=X)` 目标所在阶段之前，必须存在产出（`Composite`）或收集（`Collect`）`ItemID=X` 的前置目标 | 直接让玩家“交付 3 块木板”，但前置阶段既没让砍树也没让做木板，任务死锁 |
| `INV_R2_IDEMPOTENT_PREFIX_AND_SPLIT` | R2 导入隔离 | 短 ID 补齐命名空间前缀必须对二次导入幂等；跨阶段共用的 `ObjectiveID` 必须按阶段拆分为独立副本并清除原未引用孤儿行 | 二次导入产生 `npc_1_npc_1_Q1`；两阶段共用同一 `ObjectiveID` 导致第 1 阶段完成时第 2 阶段也瞬间自动完成 |
| `INV_R2_FK_TRANSACTIONAL_SAVE` | R2 事务落表 | 写入运行时表严格遵循 `Objective -> Sequence -> Quest` 外键拓扑，中途任一校验失败必须整体回滚至导入前快照 | 先写 Quest 失败后残留半截 Sequence/Objective 孤儿行污染内存表 |
| `INV_R3_THREE_LEDGER_SEPARATION` | R3 三账分离 | `Composite`（制作）读 `Produced` 账、`Collect`（持有）读 `Held` 账、`Submit`（交付）读 `Submitted` 账，三账物理隔离互不冲抵 | 玩家做好木板后交给 NPC 扣减了 `Held` 库存，若制作目标误读 `Held` 账会导致已完成的“制作木板”退回未完成 |
| `INV_R3_RETROACTIVE_RECONCILE` | R3 向后追补 | `Pending` 监听池仅装载当前阶段目标；接单（`accept`）与每次推进阶段（`advance`）时立即扫描世界状态，已满足条件的目标当场补记 `retroactive` 完成并级联推进 | 玩家先砍树搭好工具台、削好木板再去接任务，系统不认账逼玩家拆了重做 |
| `INV_R3_ATOMIC_REJECTION` | R3 原子拒绝 | 前置条件未满足或材料不足时，必须在修改任何库存/计数前整单拒绝，失败前后状态快照完全一致 | 搭工具台需 4 木 2 石，玩家只有 4 木 0 石时点击，木头被扣光但台子没建成 |

## 实施流程 (Step-by-Step Strategy)

### 1. 剥离无头核心模块 (Isolate Headless Core)
将任务数据结构、三本库存账与推进状态机封装在零 DOM / Canvas / 引擎渲染依赖的纯逻辑模块（标记为 `QUEST_CORE`），暴露以下标准接口供运行时与隐藏自检直接调用：
- `validateQuest(quest)` / `validateAndRepair(quest, maxRounds = 2)`
- `unwrapQuestPayload(raw)` / `importQuestPayload(raw, context)`
- `persistQuest(tables, normalizedQuest)`
- `QuestRuntime`（含 `accept`、`gather`、`build`、`craft`、`deliver`、`reconcile`、`serialize`、`restore`）

### 2. 建立三账分离与单一推进入口 (Three-Ledger & Single-Advance)
1. **三本独立物品账**：
   - `produced[itemId]`：累计产出账（只增不减，供 `Composite / Build` 目标判定）；
   - `held[itemId]`：当前背包持有账（采集/制作增加，建造/合成消耗与交付扣减，供 `Collect` 目标与扣费判定）；
   - `submitted[itemId]`：累计交付账（只增不减，供 `Submit` 目标判定）。
2. **单一推进真相入口**：
   - 仅允许单一入口函数修改 `currentSequenceIndex`；
   - `pending` 集合严格锁死为当前 `currentSequenceIndex` 所属阶段的目标，绝不提前激活未来阶段目标。

### 3. 第一道防线 R1：后端契约全量校验与有界修复
1. **全量非短路收集错误**：遇到首个错误不提前返回，一次性收集所有 ID 重复、外键断链、类型与字段不自洽、不可达物品等问题。
2. **虚拟背包因果链核验**：内置模拟背包顺次推演各阶段，若后续阶段要求 `Submit` 某物品而前置阶段无对应 `Collect` / `Composite` 产出源，立即抛出 `E_DELIVERABLE_NO_SOURCE`。
3. **有界程序化确定性修补**：对可修缺陷（如缺失默认对话选项、短路径缺省值）执行 $\le 2$ 轮确定性修补并记录结构化审计轨迹 `repairs[{ code, path, before, after, action }]`；对不可修结构死锁诚实拒绝，严禁静默篡改或放行。

### 4. 第二道防线 R2：前端多外壳归一与事务落表
1. **五种载荷外壳自适应 (`unwrapQuestPayload`)**：同时兼容 `result.quest_data`、顶层 `quest_data`、`result`、裸对象 `{ quest, sequences, objectives }` 及 JSON 字符串。
2. **短 ID 幂等命名空间化与共享目标拆段**：
   - 将 `S1`、`O1` 等短 ID 幂等重写为 `${CharacterID}_${Stage}_${ID}`（已带前缀时绝不重复拼接）；
   - 若同一 `ObjectiveID` 被多个 Sequence 引用，自动按所属阶段拆分为独立副本 `${Prefix}_${ObjectiveID}_${SequenceID}`，记录 `I_SPLIT_SHARED` 并移除原未引用孤儿行。
3. **外键拓扑原子落表 (`persistQuest`)**：严格按 `Objectives -> Sequences -> Quests` 从底向上写表并逐行回读校验；任一环节失败立即触发 `rolledBack = true` 恢复写表前完整快照。

### 5. 第三道防线 R3：前后顺序容错与全排列收敛验证
1. **接单与进段自动追补 (`reconcile('retroactive')`)**：
   - 在 `accept()` 接取任务瞬间、以及每次完成当前段进入下一段瞬间，立即调用 `reconcile('retroactive')` 扫描世界状态（建筑是否已建成、`produced` / `held` 是否已达标）；
   - 若玩家在接任务前或上一阶段已提前完成，当场补记完成；若当前段全部达成则自动级联推进至下一段。
2. **全排列与幂等自检**：
   - 枚举动作多重集（`accept` / `gather` / `build` / `craft` / `deliver`）的全部唯一排列运行无头状态机：
     - 所有完成排列的最终净耗材、产出、交付量与单次奖励 100% 守恒，无负库存；
     - 非法顺序（未建工具台先削木板、缺料建造、未接单先交付）100% 先整单校验后扣减，失败时状态快照零改动；
     - 同一动作连击 3 次保持幂等（不重复扣费、不重复发奖）；
     - 每步执行 `serialize() -> restore()` 读档恢复后的终态与连续运行 100% 一致。

### 6. 可视化交互与调试面板交付
当交付浏览器可试玩原型（如单文件 `index.html`）时，UI 与 Canvas 渲染层单向订阅 `QuestRuntime` 状态，并在界面提供清晰的当前阶段指引、三账库存实时视图及“正常流程 / 先备料后接单乱序流程”一键自检反馈。

## 交付前真实试玩验收 (End-to-End Playtest Gate)

内部门禁全部通过，不代表玩家能玩通。交付前必须在真实浏览器里、用真实的键盘和鼠标输入，把最终交付的页面完整玩一遍；发现问题就修，修完重新走一遍：

1. **验收对象是最终交付物**：直接打开最终的 `index.html`，不拿中间数据、生成脚本的输出或 Node 沙箱模拟代替。页面若由脚本生成或烘焙，生成后要对交付文件本身重新跑一遍校验。
2. **用真实浏览器操作**：优先使用 ZCode 自带的 `browser-use:control-browser` 与 `browser-use:web-gui-tester`；不可用时再用无头 Chrome，启动参数必须带 `--use-mock-keychain`。只走页面上真实可见的输入，不用脚本直接改状态来通关。
3. **必须走通并截图留证的路线**：
   - 主流程从开始到结束；
   - 失败或阵亡后重开，重开后能继续正常游玩；
   - 每一条分支、每一个可进入的场景：进入后能自由移动、能与其中的人物和物品交互、能回到原处；
   - 至少两种不按提示顺序的操作。
4. **输入与切换**：同一次按键只被处理一次；进入新场景时角色的出生点不能落在任何触发区内；页面上写明的每个按键和控件都实际有效。
5. **说明与实际一致**：页面上的方位、时长、数量和操作说明，必须与实际地图、实际耗时和实际数值一致。
6. **控制台零报错**，结束或重开后不残留预警、伤害和特效。
7. **交付说明**：列出实际走过的路线、每条路线的截图，以及发现并修复的问题。

本领域额外检查：

- 在真实页面上逐个采集、建造、制作、交付，按任意合法顺序（包括先搭工作台、边采边做）都能完成委托；地图上的资源总量足以支撑任何合法顺序。
- 用户描述的场景、人物和委托背景要在画面和对话里呈现给玩家，不能只写在数据里。

## 严禁事项 (Safety Boundaries)

- 严禁依赖 DOM 文本、像素截图或 `setTimeout` 异步等待作为核心三轮门禁的通过依据；所有门禁必须同步断言纯数据快照。
- 严禁静默吞掉坏数据：所有自动修复与单行降级必须写入 `repairs[]` 或 `warnings[]`。
- 严禁出现单向容错：必须同时保证“合法乱序（先备料后接单）100% 自动追补通关”与“非法乱序（缺料/缺前置台）100% 原子拒绝零损耗”。
