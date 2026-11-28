---
name: ball-cosmic-billiards-level
description: Cosmic billiards / space pinball level geometry, bumper cluster resonance, low-probability high-risk high-reward jackpot pockets, score amplification multipliers, and Monte Carlo trajectory expected-value solver.
---

# Ball 1: Cosmic Billiards / Space Pinball Level Geometry & High-Risk Score Multiplier Engine

Design and verify **Cosmic Billiards / Space Pinball (Peggle / Pachinko / Roguelike Pinball)** arenas where terrain geometry, gravity wells, and active bumpers create **sustained multi-bounce resonance**, while narrow **low-probability, high-risk, high-reward chambers** amplify scores exponentially.

## When to use

- Single-skill trigger: "帮我做一个类似太空台球/弹珠台的小游戏，台面上有反弹柱和引力场，球打进去能乒乒乓乓连弹好几十下；再设计几个口很窄、有掉球风险但打进去就能翻好几倍分数的刺激大奖洞。"
- Combined Ball 1 + Ball 2 trigger (chain with `$ball-hitstop-impact-feedback`): "帮我做一个太空台球/弹珠台网页小游戏，台面上有反弹柱和引力场，球打进去能乒乒乓乓连弹好几十下，再放几个口很窄但进去了能翻好几倍分的大奖洞；而且球撞上去或者中大奖的时候，要有瞬间的卡肉顿帧、球体 Q 弹变形、屏幕震动和越连击越高的音效。"

## Three-Round Hidden Verification Gate (Headless CCD & Monte Carlo First)

- **R1 (Three-Zone Geometry & Super-Elastic Clamp Gate)**: Verify active bumpers apply $e \ge 1.05 + J_{\text{bumper}}$ clamped at $v_{\max}$ under $4\text{–}8$ CCD sub-steps, and Jackpot choke aperture equals $2.2\text{–}2.6 R_{\text{ball}}$.
- **R2 (180-Ray Monte Carlo Trajectory Audit Gate)**: Sweep 180 launch angles/powers to confirm zero dead pegs (every element hit rate $\ge 1.5\%$), mean bounce count $\mathbb{E}[N_{\text{hits}}] \in [8, 22]$, and Jackpot entry probability in $[5\%, 10\%]$.
- **R3 (Anti-Infinite-Loop & High-Risk Tail Payout Gate)**: Detect $> 60$ parallel-surface bounces and auto-eject/perturb normal by $3^\circ\text{–}5^\circ$, and verify top-10% high-risk shots yield $\ge 4.5\times$ median safe score.

## Companion Skills

- Pinball hit-stop frame freeze, elastic squash-stretch, and impact juice: `$ball-hitstop-impact-feedback`
- Universal numeric solver: `$gg-numeric-solver-toolchain`

## 1. Elastic & Super-Elastic Ricochet Kinematics

Model ball motion with sub-stepped continuous collision detection (CCD, $4\text{–}8$ sub-steps per frame) so high-speed multi-bounces never tunnel through thin bumpers:

1. **Surface Restitution & Active Impulse Bumpers**:
   - Given incident velocity $\mathbf{v}^-$ and surface unit normal $\hat{\mathbf{n}}$:
     $$
     \mathbf{v}^+ = \mathbf{v}^- - (1 + e) (\mathbf{v}^- \cdot \hat{\mathbf{n}}) \hat{\mathbf{n}} + J_{\text{bumper}} \hat{\mathbf{n}}
     $$
   - **Passive Rail / Wall**: $e \in [0.78, 0.88]$, $J_{\text{bumper}} = 0$.
   - **Active Energy Bumper / Slingshot**: Super-elastic $e \ge 1.05$ plus fixed outward impulse $J_{\text{bumper}} > 0$ (clamped to $v_{\max}$) so a ball trapped inside a bumper triangle **accelerates and pinballs repeatedly** (`8–25` rapid bounces) before escaping.
2. **Cosmic Gravity Wells & Wormhole Portals**:
   - **Orbital Gravity Well / Black Hole**: Radial inverse-square attraction $\mathbf{a}_g = -\frac{G M}{\max(r^2, r_{\min}^2)} \hat{\mathbf{r}}$ with an inner hazard event horizon $r_{\text{hazard}}$ (risk) and an outer slingshot boost ring $r_{\text{slingshot}}$ (reward).

## 2. Three-Zone Risk-Reward Spatial Architecture

Partition every Cosmic Billiards table into three mathematically distinct zones:

| Zone | Entry Aperture / Probability | Drain / Hazard Risk | Score Amplification Mechanism |
|---|---|---|---|
| **Zone A: Safe Midfield Matrix** | Wide (`p_enter ~ 65%`) | Low (`< 10%` loss) | Pegs/pins that build base points $+B$ and increment hit counter |
| **Zone B: Bumper Resonance Nest (Multi-Bounce)** | Medium (`p_enter ~ 25%`, angled bank shot) | Medium (`20%` side-outhole deflection) | Triangular/hexagonal active bumper cage with mean bounce count $\mathbb{E}[N_{\text{bounce}}] \in [6, 18]$; every 3rd bounce increments **Multiplier $+1\times$** |
| **Zone C: Abyssal Jackpot / Supernova Chamber** | Narrow choke (`\Delta w = 2.4 \cdot R_{\text{ball}}`, `p_enter ~ 5%–10%`) | High (`45%–60%` adjacent Void Drain / Black Hole) | **Exponential / Compounding Amplifier**: locks ball inside a high-frequency ricochet ring for $N \ge 12$ hits, multiplies total turn score by $\times 3 \dots \times 10$, or spawns **Multiball ($\times 2 / \times 3$ balls)** |

## 3. Score Amplification & Compounding Formula

Structure scoring so players chase **Multi-Bounce Chains + Risk-Gate Multipliers** rather than grinding flat single hits:

$$
\text{TurnScore} = \left( \sum_{k=1}^{N_{\text{hits}}} B_k \cdot \left(1 + \alpha_{\text{chain}} \cdot \min(k, K_{\text{cap}})\right) \right) \times \prod_{m \in \text{TriggeredGates}} M_m \times M_{\text{jackpot}}
$$

- **Ricochet Fever Threshold**: When consecutive bounces within $\Delta t \le 0.45\text{ s}$ exceed $k \ge 8$, ignite **Supernova Fever Mode** (all bumper base values $\times 2$, bumper impulse $+20\%$).

## 4. Monte Carlo Trajectory & Placement Effectiveness Evaluator

Before finalizing any level layout, run an automated **Monte Carlo Fan Simulation** ($M = 180$ virtual shots sweeping launch angle $\theta \in [-\theta_{\max}, +\theta_{\max}]$ and power $P \in [0.6, 1.0]$):

1. **Placement Audit Metrics**:
   - **Dead-Element Check**: Every placed bumper/multiplier gate must be hit by at least $\ge 1.5\%$ of simulated trajectories (no unreachable decorations).
   - **Resonance Bounce Count**: Mean bounces per shot $\mathbb{E}[N_{\text{hits}}] \in [8, 22]$; 95th-percentile "god shot" $N_{p95} \ge 35$ bounces.
   - **Infinite-Loop Guard**: If any ball bounces $> 60$ times between two parallel surfaces without net displacement, slightly perturb one bumper normal by $3^\circ\text{–}5^\circ$ or trigger an overload magnetic eject after $25$ rapid hits.
   - **Risk-Reward Tail Ratio**: Verify that the top $10\%$ skill/high-risk shots yield $\ge 4.5\times$ the score of the median safe shot.
