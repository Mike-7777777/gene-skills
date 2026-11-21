---
name: threejs-deterministic-vfx-composer
description: Decompose natural language skill/VFX descriptions into a multi-emitter 3D layer stack (ground SDF indicator decal, curved slash ribbon arc, UV-panning energy mesh, laser/projectile beam, GPU InstancedMesh physics debris, ambient aura field, and 3-stage envelope post-processing) rendered in Three.js via a pure deterministic time function evaluateVFXAtTime(t) supporting timeline scrubbing. Use when generating 3D web VFX, Three.js skill effect previews, slash trails, shockwaves, or particle explosions.
---

# 基于特效分类学与自然语言拆解的 Three.js 确定性网页 3D 特效生成

将一句自然语言技能特效描述（如“极寒冰霜旋风斩”、“熔岩陨石天降砸地”、“赛博雷霆刀光爆发”）自动拆解为职责正交的 **7 大工业级发射器图层原型**，并通过纯时间函数 `evaluateVFXAtTime(t)` 与三段式包络 `evaluateEnvelope` 在 Three.js 中驱动渲染，彻底根除“只生成一个简陋随机粒子球”、“切后台或拖进度条时粒子炸屏”及“刀光镜像错位/全屏闪白挡死按钮”的问题。

## 适用场景 (When to Use)

- 使用 Three.js / WebGL 在浏览器中生成、渲染或预览 3D 游戏技能特效（近战刀光、法阵预警、元素风暴、陨石轰击、激光闪电、受击迸射与屏幕后处理）；
- 需要将自然语言提示词实时解析并组装成高层次感的多发射器组合特效；
- 需要支持像专业游戏引擎特效编辑器一样随时暂停、倒放、逐帧拖动时间轴（Timeline Scrubbing）验收每一帧状态。

## 七大正交发射器分类学映射 (7 Orthogonal VFX Emitter Archetypes)

严禁将复杂特效敷衍成单一 `THREE.Points` 粒子团。每次生成必须从以下 7 大正交图层中组合**至少 4 个独立子发射器**（必含：`3_GroundIndicatorDecal` 预警层 + `1_SlashRibbonArc` 或 `2_MeshUVPanning` 主体层 + `5_HitBurstAndInstancedDebris` 物理碎块层 + `7_PostProcessEnvelope` 后处理包络层）：

| 分类编号与名称 | Three.js 几何与材质实现方案 | 视觉职责 |
|---|---|---|
| `1_SlashRibbonArc`（弧面刀光/流光丝带） | `THREE.RingGeometry` 或弯曲 `PlaneGeometry` + 自定义 `ShaderMaterial`（沿 UV 主轴推进头尾 `smoothstep` 羽化溶解 + 围绕圆弧中心 `2*PivotV - V` 镜像翻转） | 近战挥砍弧面刀光、正反手连斩轨迹、冲刺残影丝带 |
| `2_MeshUVPanning`（3D 网格 UV 流动与扭曲） | 开口 `THREE.CylinderGeometry(..., openEnded=true)` / `SphereGeometry` + `DoubleSide Additive ShaderMaterial`（螺旋 UV 滚动 + 顶点高度扭曲 Twist + 菲涅尔边缘发光 Fresnel Rim） | 龙卷风柱、贯穿能量光柱、扩张冲击波半球、陨石火核 |
| `3_GroundIndicatorDecal`（地面 SDF 预警贴花） | 水平 `THREE.PlaneGeometry`（`rotation.x = -Math.PI / 2`）+ SDF 圆环/扇形/符文法阵 Shader（在 `WINDUP` 期间由 `uProgress: 0 -> 1` 动态缩圈或充能填充） | 技能前摇地面缩圈预警、旋转符文法阵、爆发帧地面焦痕裂纹 |
| `4_ProjectileAndLaserBeam`（飞弹与高频折线光束） | 核心发光网格 + 带高频确定性顶点噪声抖动的 `TubeGeometry` / `LineSegments` | 天降陨石弹体、怪物间折线闪电链、锁定贯穿激光束 |
| `5_HitBurstAndInstancedDebris`（受击迸射与实例化碎块） | 单次 DrawCall 的 `THREE.InstancedMesh`（确定性重力抛物线 + 地面弹性反弹）+ 沿速度方向拉伸的火花 `Points` | 爆发中心十字闪光、高速飞溅火花、带物理抛物线与落地弹跳的岩石/冰晶碎块 |
| `6_AmbientAuraAndBubble`（空间取模环绕氛围场） | `THREE.Points` + GPU 顶点取模包裹 `mod(basePos + vel * t, boxSize)` | 持续燃烧/冰冻环绕气场、局部风雪灰烬场、悬浮能量微粒 |
| `7_PostProcessEnvelope`（三段包络屏幕后处理） | `EffectComposer` + `UnrealBloomPass` + 由 `evaluateEnvelope` 驱动的相机衰减震屏与径向冲击波畸变 `ShaderPass` | 爆发瞬间全屏辉光跃升、径向热浪/空气扭曲、受控震屏冲击感 |

## 实施流程 (Step-by-Step Strategy)

### 1. 自然语言三步语义解析管线 (`parseNLToVFXSpec`)
从用户输入文本中自动提取结构化特效契约：
1. **三色阶元素主题色板（Core 主色 / Secondary 次色 / Glow 高光）**：
   - 火/熔岩/陨石/炎 $\rightarrow$ `{ core: '#ff4500', secondary: '#ffae00', glow: '#fff3b0' }`
   - 冰/寒霜/雪/凛冬 $\rightarrow$ `{ core: '#38bdf8', secondary: '#6366f1', glow: '#e0f2fe' }`
   - 雷/电/赛博/激光 $\rightarrow$ `{ core: '#ec4899', secondary: '#06b6d4', glow: '#f5d0fe' }`
   - 毒/暗影/腐蚀/孢子 $\rightarrow$ `{ core: '#22c55e', secondary: '#a855f7', glow: '#bbf7d0' }`
2. **三段式时间轴提取**：
   - 提取预警秒数 `windup = clamp(parsedSeconds, 0.3, 2.0)`（默认 `0.9s`）；
   - 设定唯一爆发点 `activeTime = windup`，余韵消散时长 `recovery = 1.5s`，总时长 `totalDuration = windup + 1.5s`。
3. **动作形态映射**：识别挥砍（`hasSlash`）、风柱/光柱/天降（`hasVortex`）、冲击规模（`debrisCount: 32 | 48`）。

### 2. 强制实现纯时间确定性求值函数 (`evaluateVFXAtTime(t)`)
所有子发射器的位置、旋转、缩放、`InstancedMesh` 实例矩阵与 Shader Uniform 必须写成全局播放时间 `t`（及相对爆发年龄 `age = t - activeTime`）的**纯函数**，严禁使用 `pos += vel * dt` 等不可逆帧间状态累加：
- **实例化碎块确定性弹道公式**：
  对第 $i$ 个碎块，由固定种子生成初始速度向量 $\vec{v}_{0,i}$ 与角速度 $\vec{\omega}_i$；当 `age > 0` 时：
  $$x_i(\text{age}) = v_{0x,i} \cdot \text{age}, \quad z_i(\text{age}) = v_{0z,i} \cdot \text{age}$$
  $$y_{\text{raw}}(\text{age}) = y_0 + v_{0y,i} \cdot \text{age} - \frac{1}{2} g \cdot \text{age}^2$$
  若 $y_{\text{raw}}  Hold -> Exit` 三段包络求值：
```javascript
export function evaluateEnvelope(age, enterTime, holdTime, exitTime) {
  if (age  0 && age  0 && age  evaluateVFXAtTime(0.3) -> evaluateVFXAtTime(1.2) -> evaluateVFXAtTime(0.0) 往返调用，所有矩阵与 Uniform 状态必须 100% 一致且归零无残留。
代码块

---

### Bonus：2D 动作/RPG 网页试玩原型特效与打击感增强（对应 Case 2.1 / Case 4 中的“特效增强”）
建议路径：`.agents/skills/canvas2d-combat-vfx-and-game-feel/SKILL.md`

```markdown
---
name: canvas2d-combat-vfx-and-game-feel
description: Enhance 2D top-down HTML5 Canvas RPG/action game prototypes with deterministic layered combat VFX, lighting/fog-of-war atmosphere, hit-stop (frame freeze), directional knockback, floating combat text, and reduce-motion safe screen shake without polluting core gameplay state machines. Use when polishing 2D browser game prototypes, boss fights, or adventure maps with visual effects and combat juice.
---

# 2D 俯视角游戏原型特效分层与打击感增强 (2D Combat VFX & Game Feel)

在不破坏底层无头状态机、碰撞拓扑与可达性公式的前提下，为 2D 俯视角单文件网页游戏原型（HTML5 Canvas）注入高可读性的**光影氛围、四层战斗特效、受击顿帧（Hit-Stop）与分层镜头反馈**，将简陋色块占位升级为具备明确空间层次与扎实打击感的可试玩版本。

## 适用场景 (When to Use)

- 为 2D 俯视角 Boss 战、地牢副本或序章探索地图原型增加光影氛围（战争迷雾、火把/路灯径向动态光源、环境微粒）；
- 增强近战挥砍刀光、地面渐进预警圈、落石冲击波、碎石物理迸射与受击反馈；
- 需要在保证战斗范围/地形边界绝对清晰的前提下提升画面表现力。

## 核心分层与实施准则 (Layered VFX & Polish Strategy)

### 1. 严格遵守“可读性优先、表现层单向订阅”铁律
- **先验算后加特效**：所有特效只能在技能可读性（预警时间表）与地图拓扑校验通过后挂载；特效层只读取游戏状态，严禁在粒子或动画回调里直接修改血量、库存或阶段状态。
- **五层渲染栈顺序（从底到顶）**：
  1. `Layer 0 - 地形与环境光底图`：地表网格、主干道纹理、水体波纹、沼泽气泡；
  2. `Layer 1 - 地面贴花与预警层（Ground Telegraphs）`：永远绘制在角色与怪物脚下，包含带外框锁定线 + 内部根据 `progress = elapsed / windup` 从 $0 \rightarrow 1$ 填充的半透明预警扇形/圆圈，确保预警边界 100% 清晰且不遮挡玩家本体；
  3. `Layer 2 - 实体与投影层（Entities & Drop Shadows）`：角色、NPC、怪物、建筑的椭圆落地软阴影（锚定脚底真实碰撞坐标）与受击闪白（Hit Flash）剪影；
  4. `Layer 3 - 挥砍弧光与物理碎块层（Slash Arcs & Debris）`：带头尾透明度渐变的贝塞尔/圆弧刀光残影、带重力抛物线与地面阻尼反弹的岩石/木屑粒子、受击方向性火花迸射；
  5. `Layer 4 - 光照遮罩与浮动 HUD 层（Lighting & Floating Text）`：战争迷雾/洞穴暗角径向光照混合（`globalCompositeOperation = 'multiply'` 或径向渐变遮罩，路灯/篝火/技能火光实时开孔照明）+ 暴击/普攻浮动伤害跳字。

### 2. 四要素打击感闭环 (Four-Pillar Impact Juice)
每次有效命中（玩家砍中 Boss/怪物，或 Boss 技能命中玩家）协同触发四项受控反馈：
1. **顿帧（Hit-Stop / Frame Freeze）**：重击或破招命中瞬间挂起逻辑更新 `30ms ~ 65ms`（渲染层保持绘制并叠加受击火花），强化肉感停顿；
2. **受击闪白与弹性形变（Hit Flash & Squash-Stretch）**：受击目标在 `80ms` 内切换高亮白色/红色混色并在受击法线方向产生轻微挤压回弹；
3. **方向性飞溅粒子（Directional Burst）**：沿攻击者指向受击者的夹角扇面（$\pm 35^\circ$）喷射 $8 \sim 16$ 颗带速度拉伸线条的火花与碎屑；
4. **带无障碍保护的衰减震屏（Damped Directional Shake）**：沿冲击方向施加指数衰减的相机偏移，并内置 `Reduce Motion（减弱震屏）` 开关，开启时将震屏幅度精确置 `0`。

### 3. 对象池与帧率护栏 (Object Pooling & Frame Guard)
- 粒子、碎块与浮动跳字使用固定上限环形数组或对象池（如同屏上限 `<= 250` 颗），杜绝高频 `GC` 卡顿；
- 所有地面预警圈在 `ACTIVE` 结算瞬间切换为短暂高光破裂环并在 `0.25s` 内消散，严禁在 `RECOVERY` 后摇期残留红圈误导玩家走位。
