---
name: combat-level-spatial-numeric-coupling
description: Design and generate playable 2D top-down action RPG combat dungeons, caves, and boss/elite arenas by mathematically coupling monster combat stats and skill AOE geometry to spatial dimensions (entrance safe buffer, wave anti-avalanche spacing, minimum dodge corridor width, kiting loop perimeter, minimum walkable combat area, hazard terrain shortcuts, and threat-to-loot EV matching) with an in-game numeric debug panel. Use when creating combat dungeons, monster encounters, or arena levels.
---

# 战斗关卡空间尺度与数值强度耦合设计

将动作 RPG 战斗副本（如“3 分钟通关的旧矿洞正式副本：清前哨小怪 $\rightarrow$ 穿过机制地形 $\rightarrow$ 击败深处失控守卫取回记录”）中怪物的**索敌半径、移速、技能几何范围、战斗威胁值（TP）**通过精确数学不等式映射为关卡的**空间尺度（入口安全距离、波次防连锁间距、走廊净宽、风筝环路周长、最小净战斗面积与战利品价值）**，并内置可视化数值与空间调试面板。

## 适用场景 (When to Use)

- 设计或生成包含多波次遭遇战、远程/近战兵种配合、减速/危险机制地形及关底精英/Boss 守卫的可试玩战斗副本；
- 解决“一进门黑屏就被怪贴脸集火”、“打前排小怪时把深处 Boss 一起拉过来连锁暴毙”、“走廊太窄躲不开怪物横扫 AOE”、“场地太挤怪堆叠卡死”或“玩家可以不打守卫直接绕后偷走任务物品/宝箱”的问题；
- 在生成的关卡原型中内置实时属性、技能模组、空间容量与掉落期望调试台。

## 核心数学耦合方程 (Numeric-to-Spatial Formulas)

设关卡网格基础单位为 $G$（如 `1 tile = 40 px` 或 `128 cm`），所有空间尺寸严禁拍脑袋决定，必须由驻守怪物的数值与技能参数反向推导：

### 1. 基础网格单位换算
- **索敌半径格数**：$R_{\text{aggro}} = \lceil \text{AggroRadius} / G \rceil$
- **攻击射程格数**：$R_{\text{atk}} = \lceil \text{AttackRange} / G \rceil$
- **移速（格/秒）**：$V_{\text{tile}} = \text{MoveSpeed} / G$
- **最大技能几何宽度（格）**：$W_{\text{skill}} = \lceil \max(\text{SkillRadius}, \text{SkillWidth}) / G \rceil$
- **碰撞占地格宽**：$W_{\text{col}} = \lceil \text{CollisionWidth} / G \rceil$

### 2. 单体威胁点数（Threat Points, TP）核算
- **有效生命值**：$\text{EHP}(m) = \text{HP} \times (1 + 0.05 \times \text{Def}) \times (1 + 0.2 \times \text{Poise})$
- **有效秒伤**：$\text{EDPS}(m) = \frac{\text{Dmg} \times \text{SkillRatio}}{\text{AttackInterval} + \text{Cooldown}} \times (1 + 0.15 \times \max(0, R_{\text{atk}} - 1)) \times (1 + 0.3 \times \text{SlowChance})$
- **归一化威胁点数**：$\text{TP}(m) = \sqrt{(\text{EHP}(m) / \text{EHP}_{\text{base}}) \times (\text{EDPS}(m) / \text{EDPS}_{\text{base}})}$（以 1 级基础近战小怪 $\text{TP} = 1.0$ 归一化）。

### 3. 仇恨包络线与波次防雪崩间距 (Aggro Envelope & Wave Spacing)
- **入口安全缓冲（Entrance Staging Clearance）**：
  $$D_{\text{BFS}}(\text{Entrance}, \text{FirstWave}) \ge R_{\text{aggro}}(\text{FirstWave}) + 2$$
  入口内侧必须预留无怪前厅，保证玩家进门后至少有 2 格安全观察与操作缓冲，严禁进门即落入索敌圈。
- **波次防连锁雪崩间距（Inter-Wave Anti-Avalanche Spacing）**：
  $$D_{\text{BFS}}(\text{Wave}_i, \text{Wave}_j) > R_{\text{aggro}}(\text{Wave}_j) + 3$$
  相邻波次（尤其是前哨小怪与深处精英守卫）之间的 BFS 测地线距离必须大于后一波怪物的索敌半径加 3 格交战拉扯缓冲（或通过 L 型折角实体墙阻断直线视线），从数学上杜绝拉打前排时误触发深处守卫。

### 4. 走廊闪避净宽、风筝环路与主战区容量 (Capacity & Geometry)
- **交战走廊最小净宽**：
  $$W_{\text{min}} = \max(2, W_{\text{skill}} + 1)$$
  任何交战通道的净宽必须在怪物最大技能 AOE 宽度外至少留出 1 整格无障碍闪避空间。
- **闭合风筝环路周长（Kiting Loop）**：
  针对精英/Boss 房或高移速追击怪，场地必须围绕中心岩柱或双通道构建至少 1 条闭合环路（一维同调群 $\text{Betti-1} \ge 1$），环路最小周长：
  $$L_{\text{loop}} \ge \lceil 4 \times V_{\text{tile}} \times (\text{AttackInterval} + \text{Cooldown}) \rceil + 8$$
- **主战区最小净可行走面积（Anti-Spatial-Overload）**：
  扣除墙体、岩柱、深渊与静态障碍 Footprint 后，单波次交战区的净可行走格数必须满足：
  $$A_{\text{combat}}(\text{Wave}) \ge 16 + \sum_{i \in \text{Wave}} K_{\text{rank}}(m_i) \times W_{\text{col}}(m_i)^2 \times \left(1 + \frac{\text{MoveSpeed}_i}{\text{BasePlayerSpeed}}\right)$$
  其中阶位空间系数 $K_{\text{rank}} = \{ \text{Normal}: 6, \text{Elite}: 18, \text{Boss}: 45 \}$ 格。小于该下界视为**空间过载（Spatial Overload）**，必须扩容房间。

### 5. 远程掩体节律與机制地形风险博弈 (Cover & Hazard Terrain)
- **远程推进掩体**：当波次中存在 $R_{\text{atk}} > 3$ 格的远程/投射怪时，沿推进主轴每间隔 $4 \sim 6$ 格交错布置 $1 \times 1$ 或 $2 \times 1$ 阻挡弹道的岩柱掩体，且掩体两侧保留 $\ge W_{\text{min}}$ 的侧翼包抄净宽。
- **机制地形（如减速泥沼/毒潭/滑行冰面）**：将带移速衰减或环境伤害的新地形铺设在**正面最短捷径**或局部封路点，同时在主风筝环路上保留至少 1 条宽度 $\ge W_{\text{min}}$ 的正常地面侧翼通道，形成“走泥沼贪近路 vs 走干燥外环安全拉扯”的战术决策。

### 6. 威胁-奖励经济配平与防偷箱拓扑锁定 (Reward EV & Anti-Ninja Lock)
- **奖励期望配平**：汇总波次总威胁 $\text{TP}_{\text{total}} = \sum \text{TP}(m_i)$，确保掉落/宝箱期望价值 $\text{EV} \in [0.8 \times K_{\text{gold}} \times \text{TP}_{\text{total}}, 1.25 \times K_{\text{gold}} \times \text{TP}_{\text{total}}]$。
- **防偷袭拓扑锁定（Anti-Ninja-Loot Lock）**：核心任务目标物（如勘探队调查记录）或关底宝箱必须满足：
  $$D_{\text{BFS}}(\text{Entrance}, \text{Objective}) > D_{\text{BFS}}(\text{CoreGuard}, \text{Objective}) \quad \text{且} \quad D_{\text{BFS}}(\text{CoreGuard}, \text{Objective}) \le R_{\text{aggro}}(\text{CoreGuard})$$
  或在击败核心守卫前保持交互锁定，确保玩家无法在守卫索敌圈外无伤偷走目标。

## 视觉可读性与内置数值调试面板 (Readability & Debug Panel)

1. **战场层次与可读性**：提供清晰的地面网格、视野/战争迷雾（Fog of War）或光照氛围、高对比度的怪物攻击前摇预警框（Telegraph）及地形效果标识（如踩入泥沼时的减速提示）。
2. **内置关卡数值调试面板（强制交付项）**：在界面提供可折叠/常驻的实时调试台，直接展示：
   - 各房间/波次的 $\text{TP}_{\text{total}}$、净可行走面积 $A_{\text{combat}}$ 实测值 vs 理论下界、走廊净宽 $W_{\text{min}}$ 校验状态；
   - 当前交战怪物的属性（HP/ATK/移速/索敌圈 $R_{\text{aggro}}$）、攻击模组状态（Windup/Active/Recovery）与掉落表详情；
   - 索敌包络线、技能判定框、风筝环路与泥沼减速区的一键高亮开关。

## 严禁事项 (Safety Boundaries)

- 严禁交付净可行走格数小于 $A_{\text{combat}}(\text{Wave})$ 或走廊净宽小于 $W_{\text{skill}} + 1$ 的空间过载房间。
- 严禁让入口落入首波怪物的 $R_{\text{aggro}} + 2$ 包络线内，或让前哨波次与关底守卫的索敌圈发生连锁重叠。
