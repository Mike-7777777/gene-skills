---
name: car-track-flow-generator
description: Procedural parkour racing track generator and flow pacing solver. Calculates lap/segment time budgets, jump ballistic clearance, wall-ride & ramp parkour geometry, and continuous nitro boost combo chains so players maintain uninterrupted high-speed euphoria.
---

# Car 1: Parkour Track Generation & Continuous Nitro Flow Engine

Design and generate high-speed **parkour racing tracks** where lap times are mathematically budgeted, ramps and gaps match vehicle launch kinematics, and boost pads / drift corners / air tricks are spaced to sustain **unbroken Nitro Combo Flow**.

## When to use

- Single-skill trigger: "帮我做一个跑酷赛车小游戏，赛道要有大飞坡、断桥和斜墙可以飞跃，跑完一圈大概一分钟；一路上过弯漂移、飞坡和踩加速带能把氮气一直续上，跑起来爽快不断档。"
- Combined Car 1 + Car 2 trigger (chain with `$car-speedline-camera-vfx`): "帮我做一个能在网页里玩的跑酷飙车小游戏，赛道要有大飞坡、断桥和斜墙，跑完大概一分钟，过弯漂移和踩加速带能把氮气一直续上不断档；而且车开快和喷氮气的时候，屏幕四周要有动漫那种速度线，镜头要有拉远推背感和过弯倾斜震动。"

## Three-Round Hidden Verification Gate (Headless Track Solver First)

- **R1 (Arc-Length Time Budget Gate)**: Integrate segment lengths over effective speed profile so expected lap/sprint time lands within $\pm 5\%$ of target duration $T_{\text{target}}$.
- **R2 (Ballistic Jump & Corner Banking Gate)**: Verify every ramp gap $D_{\text{gap}} \le 0.80 \cdot x_{\text{land}}(0.85 v_{\text{base}})$ with slope-matched landing decks, and bank corners where $R < R_{\min}(v_{\text{nitro}})$.
- **R3 (Unbroken Nitro Chain Gate)**: Enforce consecutive nitro refill spacing $\Delta s_{\text{source}} \le v_{\text{nitro}} \cdot (\tau_{\text{burn}} + 0.75\tau_{\text{grace}})$ so a clean run maintains 100% nitro combo uptime.

## Companion Skills

- Speed lines, dynamic FOV, and high-speed camera shake/tilt: `$car-speedline-camera-vfx`

## 1. Track Spline & Segment Time-Budget Equation

Never generate random spline control points without a **Time Budget**. Given target stage duration $T_{\text{target}}$ (e.g., $60\text{–}90\text{ s}$ for sprint, $35\text{–}45\text{ s}$ per lap), base cruise speed $v_{\text{base}}$, and nitro boost speed $v_{\text{nitro}} = \gamma_{\text{nitro}} \cdot v_{\text{base}}$ ($\gamma_{\text{nitro}} \in [1.35, 1.65]$):

1. **Arc-Length Parameterization**:
   - Subdivide the 3D Catmull-Rom / Bezier centerline $\mathbf{C}(s)$ into $N$ rhythmic **Flow Beats** of arc length $\Delta s_i$:
     $$
     T_{\text{expected}} = \sum_{i=1}^{N} \frac{\Delta s_i}{v_{\text{eff}, i}}, \qquad v_{\text{eff}, i} = (1 - \eta_{\text{boost}, i}) v_{\text{base}} + \eta_{\text{boost}, i} v_{\text{nitro}}
     $$
   - Enforce $\left|T_{\text{expected}} - T_{\text{target}}\right| \le 5\%$. Calculate Gold / Silver / Bronze medal times from nitro uptime $\eta_{\text{boost}} \in \{0.85, 0.60, 0.35\}$.
2. **Curvature & Lateral G-Force Bound**:
   - At any curve of radius $R(s)$, limit maximum non-drift curvature so the car does not fly off unbanked corners:
     $$
     R_{\min}(v) = \frac{v^2}{\mu_{\text{lat}} \cdot g + g \tan\theta_{\text{bank}}}
     $$
   - When $R(s) < R_{\min}(v_{\text{nitro}})$, automatically **bank the track surface** by $\theta_{\text{bank}} \in [12^\circ, 35^\circ]$ or widen the outer drift apron by $\times 1.4$.

## 2. Parkour Track Modules & Ballistic Clearance Math

A parkour track must alternate horizontal speed with vertical/lateral stunts (**Ramp Jump $\to$ Wall-Ride $\to$ Split Upper/Lower Deck $\to$ Chicane Drift $\to$ Dive Tunnel**):

1. **Ballistic Ramp & Chasm Landing Guarantee**:
   - For a ramp of launch angle $\alpha$ at elevation $h_0$, compute the conservative landing envelope at minimum entry speed $v_{\min} = 0.85 v_{\text{base}}$ and maximum speed $v_{\max} = v_{\text{nitro}}$:
     $$
     x(t) = v \cos\alpha \cdot t, \qquad y(t) = h_0 + v \sin\alpha \cdot t - \frac{1}{2} g t^2
     $$
   - Place the landing deck at distance $D_{\text{gap}} \le 0.80 \cdot x_{\text{land}}(v_{\min})$, with a **downward landing slope** matching the tangent angle $\tan^{-1}(\dot{y}/\dot{x})$ so the car lands smoothly without losing forward momentum.
2. **Wall-Ride & Banked Half-Pipe Segments**:
   - Tilt wall-ride panels at $65^\circ\text{–}80^\circ$ with an entry transition ramp and magnetic/centripetal normal assist while $v \ge 0.9 v_{\text{base}}$.

## 3. Continuous Nitro & Combo Chain Pacing ("Unbroken Rush")

To create the sensation of **continuous, uninterrupted nitro chaining**:

1. **Nitro Depletion & Refill Rhythm ($\tau_{\text{burn}}$ vs $\tau_{\text{gap}}$)**:
   - Let a single Nitro activation or Boost Pad burst last $\tau_{\text{burn}}$ seconds (e.g., $2.8\text{ s}$) with a combo grace window $\tau_{\text{grace}} = 0.9\text{ s}$.
   - The arc-length distance between consecutive **Nitro Sources** (Boost Pads, Drift Zones, Jump Trick Ramps, Near-Miss Gates, or Energy Orbs) must satisfy:
     $$
     \Delta s_{\text{source}} \le v_{\text{nitro}} \cdot (\tau_{\text{burn}} + 0.75 \cdot \tau_{\text{grace}})
     $$
2. **Four-Source Synergy Loop**:
   - **Straight**: Staggered Boost Chevrons + Slipstream/Orb lines.
   - **Corner**: Drift charge meter ($\dot{N}_{\text{drift}} = k_{\text{slip}} \cdot |\beta| \cdot v$) that grants an instant **Mini-Turbo / Nitro Bar** upon corner exit.
   - **Airborne**: Airtime / Barrel-roll / Landing-perfect bonus that refills $+35\%$ Nitro on clean touchdown.
   - **Chain Multiplier**: Consecutive boosts without touching walls or dropping below $v_{\text{base}}$ increment `Chain Tier (x1 -> x2 -> x3 -> OVERDRIVE)`, raising top speed cap and score rate.
