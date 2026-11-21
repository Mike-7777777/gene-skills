---
name: boss-compound-attack-readable-evasion
description: Design and implement readable Boss single and compound attack patterns (such as simultaneous rockfall + sweep, multi-phase combos, and tutorial boss encounters) using authoritative timing tables, staggered active windows, mathematical evasion-route reachability checks, punish windows, and peak-end post-combat wait bounds. Use when designing Boss skills, telegraphs, combo attacks, or playable Boss arena demos.
---

# Boss 复合攻击模组可读预警、可达避让路线与战后体验设计

将简短或模糊的 Boss 战斗需求（如“落石+横扫组合技”、“矿洞石头守卫第一个 Boss”）转化为数据表驱动、每轮都有物理可达避让路线、收招有稳定反打回报、击杀后干净利落收尾的完整战斗系统与可交互调试演示。

## 适用场景 (When to Use)

- 设计或实现 Boss 单招与复合攻击模组（如场地多点落石 + 近战扇形横扫、多阶段连段、二阶段机制跃迁）；
- 解决“地上看起来有安全区，但玩家按基础移速在预警结束前根本跑不到”的假安全区问题；
- 解决“躲完一整套连招后 Boss 零后摇无缝连炸，玩家毫无反打机会”或“打死 Boss 后被残余落石炸死 / 原地傻等掉落”的体验劣化；
- 制作带实时技能参数调试台（Debug Panel）的可试玩 Boss 战原型。

## 玩家机动基准与体验预期指标 (Baseline Metrics)

在编写任何动作、状态机或渲染特效前，必须先锚定以下量化基准（若用户未特别指定，默认采用此标准换算）：

| 维度 | 参数符号 | 标准取值 / 约束区间 | 设计说明 |
|---|---|---|---|
| 玩家基础移速 | $V_{\text{walk}}$ | 基准常数（如 `400 cm/s` 或 `220 px/s`） | 不依赖加速 Buff 或极限卡无敌帧的常规移动速度 |
| 人类视觉反应时间 | $T_{\text{react}}$ | `0.30 s` (`0.25 s ~ 0.35 s`) | 从地面预警亮起至玩家做出移动输入的生理缓冲 |
| 复合技最小错峰间隔 | $\Delta t_{\text{stagger}}$ | `>= 0.60 s` (`0.60 s ~ 0.80 s`) | 复合技相邻两拍子攻击 `ACTIVE` 起始时刻的最小差值 |
| 收招反打回报窗口 | $T_{\text{punish}}$ | `0.80 s ~ 1.50 s` | 每轮攻击 `RECOVERY + 下次出招间隔` 留给玩家安全输出的时长 |
| 转阶段盲等上限 | $T_{\text{blind\_wait}}$ | `<= 3.00 s` | 飞天/钻地/转阶段无敌期间无目标盲等的最大允许时长 |
| 致死清场延迟 | $T_{\text{clear\_hazards}}$ | `0.00 s`（致死帧立即清零） | Boss 死亡瞬间立即销毁所有在途投射物与地面延迟预警 |
| 脱战广播上限 | $T_{\text{disengage}}$ | `<= 0.10 s` | 隐藏 Boss 血条、清除仇恨、收敛战斗音乐的延迟上限 |
| 战利品可交互窗口 | $T_{\text{loot\_ready}}$ | `0.50 s ~ 1.20 s`（出口解锁 `<= 1.50 s`） | 从致死帧到战利品落地可拾取的等待窗口，用拾取动线替代傻等 |

## 实施流程 (Step-by-Step Strategy)

### 1. 先建权威招式时间表，严禁硬编码判定 (Authoritative Skill Timing Table)
在写任何表现层代码前，先为每个招式（及复合技的每个子阶段）定义结构化权威数据表，所有选招器、地面预警与伤害判定框（Hurtbox）必须唯一由该表驱动：
- `id`：招式或子阶段唯一标识；
- `shape` & `geometry`：判定几何（如 `Sector { range, arcDeg }`、`MultiCircle { radius, offsets[] }`、`WideBand { width, length }`）；
- `windup` ($T_{\text{windup}}$)：预警/前摇时长（秒）；
- `activeWindow` ($[T_{\text{active\_start}}, T_{\text{active\_end}}]$)：唯一开启伤害判定的时间窗口（秒）；
- `recovery` ($T_{\text{recovery}}$)：收招硬直/反打窗口（秒）；
- `repeatBan`：连续重复释放禁令（禁止同一招式连续释放超过 2 次）；
- `telegraph`：预警视觉样式与音效标识。

### 2. 复合技能的“时空错峰与确定性安全走廊”硬约束
当两个子攻击（如“落石 + 横扫”）组合释放时，必须满足**时空解耦定律**：
1. **时间错峰定律（Staggered Timing）**：
   - 严禁两个高覆盖子攻击在同一帧同时进入 `ACTIVE`；
   - 若同时在 $t = 0.0\text{s}$ 开启地面预警，两拍攻击的伤害结算时刻必须错开 $\Delta t_{\text{stagger}} = T_{\text{active\_start}}(\text{phase}_2) - T_{\text{active\_start}}(\text{phase}_1) \ge 0.6\text{s}$；
   - **标准两步走位体验**：例如 $t=0.0\text{s}$ 内圈横扫与外圈落石同时亮起预警 $\rightarrow$ 玩家先在 $t=0.9\text{s}$ 前切向走出横扫扇面（此时踩在尚未爆炸的落石预警圈内仍绝对安全） $\rightarrow$ $t=0.9\text{s}$ 横扫结算并关闭 Hurtbox 后，原本危险的 Boss 贴身内圈变为绝对安全区 $\rightarrow$ 玩家在 $t=1.6\text{s}$ 落石爆炸前从容走回 Boss 身边安全反打。
2. **空间确定性走廊（Deterministic Safe Corridor）**：
   - 多发场地投射物（如围绕玩家的 3 颗落石）必须使用固定相对偏移阵列（`emissionOffsets`）或固定角度扇面（`rotationAngles`），明确保留朝向安全区的切向缺口；
   - 严禁使用大半径纯随机散布（`randomizeSpawn = true`），防止随机落点恰好堵死扇形边缘唯一逃生路线。

### 3. 避让路线物理可达性公式校验 (Reachability Inequality)
对每一拍攻击执行最坏情况逃生验算：在预警开始时刻，设玩家处于受迫最深位置，到最近安全区边缘的逃生距离为 $D_{\text{safe}}$，必须满足：
$$D_{\text{safe}} \le V_{\text{walk}} \times (T_{\text{windup}} - T_{\text{react}})$$
- 若不等式不成立（物理跑不到），必须在数据表中延长 $T_{\text{windup}}$、加大第二拍触发延迟、或缩小扇形角度 `arcDeg` / 落石半径，绝不允许带着假安全区进入视觉打磨阶段。

### 4. 预警承诺帧朝向冻结与确定性选招 (Heading Freeze & Selector)
- **朝向冻结**：进入 `WINDUP` 预警承诺帧瞬间立即锁死攻击朝向与落点坐标，严禁蓄力期间 100% 持续旋转追踪玩家导致走位失效。
- **选招过滤顺序**：剔除已达连续释放上限的招式 $\rightarrow$ 剔除当前射程/角度不满足的招式 $\rightarrow$ 按阶段权重选招并记录每次出招的安全余量日志。
- **阶段演化（针对完整 Boss 战）**：二阶段升级应引入新的空间组合机制或环境互动（如地形落石柱掩体、错峰连段），而非单纯将一阶段技能无脑加速导致违反可达性公式。

### 5. 回合内反打回报与峰值-终值战后收束 (Punish Window & Peak-End Closure)
1. **稳定反打窗口**：每轮攻击（尤其是高注意力复合技）结束后，必须兑现 $T_{\text{recovery}} + T_{\text{interval}} \in [0.8\text{s}, 1.5\text{s}]$ 的反打窗口，让玩家稳定输出 2~3 次。
2. **转阶段反盲等**：遵循 Maister 等待原则，Boss 不可选中的转阶段期间必须提供地面轨迹预警或副目标，纯盲等不得超过 `3.0s`。
3. **战后等待收束（Peak-End Rule）**：
   - $t = 0.0\text{s}$（致死帧）：立即清除所有未爆落石与地面预警（确保死后残留伤害 `RemainingHazardDamage == 0`）；
   - $t \le 0.1\text{s}$：完成脱战状态切换、隐藏 Boss 血条、切换胜利音效；
   - $t \in [0.5\text{s}, 1.2\text{s}]$：在安全位置刷出可拾取战利品（`<= 1.5s` 解锁出口），将战后空窗转化为走向战利品的主动行动。

### 6. 内置技能调试台与无头闪避验证 (Debug Console & Bot Verification)
- **纯预警 Bot 验算**：用仅在预警出现后才延迟 $T_{\text{react}}$ 启动基础移速 $V_{\text{walk}}$ 的测试逻辑验证每套招式 100% 可无伤躲开，且 `WINDUP` 与 `RECOVERY` 期间 Hurtbox 严格关闭。
- **实时技能调试台（针对 Web 原型交付）**：在画面侧边或底部内置可视化技能调试面板，实时展示并支持微调当前招式 ID、阶段（Windup/Active/Recovery）、前摇秒数、错峰差值 $\Delta t$、$D_{\text{safe}}$ 可达性验算结果及 Hurtbox 调试框开关。

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

- 伤害判定区的形状与用户描述一致，例如“Boss 前方一条宽横带”是横在 Boss 正前方、垂直于朝向的宽带。
- 阵亡和重开后，Boss、预警和伤害判定全部复位；测试 Bot 在真实页面上跑，起点包括贴墙和角落。

## 严禁事项 (Safety Boundaries)

- 严禁在 `WINDUP` 预警期或 `RECOVERY` 后摇期开启或残留伤害判定体积（Hurtbox 必须严格限定在 `ACTIVE` 窗口内）。
- 严禁交付视觉上有空隙但满足不了 $D_{\text{safe}} \le V_{\text{walk}} \times (T_{\text{windup}} - 0.3\text{s})$ 的假安全区组合技。
- 严禁在 Boss 致死后保留生效中的残余伤害炸死玩家，或让玩家在击败 Boss 后盲等超过 `1.2s` 才获得结算反馈。
