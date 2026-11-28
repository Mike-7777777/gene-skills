---
name: gun-tactical-ttk-economy
description: Tactical shooter BTK/TTK inverse solver, distance damage dropoff, armor penetration, tactical buy-round weapon pricing, and realistic ballistic hit feedback model.
---

# Gun 1: Tactical Shooter BTK/TTK Inverse Solver & Weapon Economy

Built on `$gg-numeric-solver-toolchain` and `$game-economy-balance`. Use this skill to design **realistic/tactical gunfight games** where weapon stats are solved backward from exact **Bullets-To-Kill (`BTK`)**, **Time-To-Kill (`TTK`)**, engagement range brackets, armor penetration, and tactical round economy pricing.

## When to use

- Single-skill trigger: "帮我做一个偏真实的枪战游戏数值和买枪系统，算清楚不同枪在远近距离打头、打防弹衣分别几枪死，按枪的强弱定好商店价格，打中人要有扎实的飙血和破甲反馈。"
- Combined Gun 1 + Gun 2 trigger (chain with `$gun-recoil-camera-dynamics`): "帮我做一个偏真实硬核的网页枪战小游戏，能买手枪、冲锋枪、步枪、霰弹枪和狙击枪，算清楚不同枪打头、打防弹衣分别几枪死并定好买枪价格；而且每把枪开火要有完全不一样的后坐力上跳、连发压枪弹道和镜头震动反馈。"

## Three-Round Hidden Verification Gate (Headless Ballistic & Economy Solver First)

- **R1 (Half-Open Interval BTK Breakpoint Gate)**: Solve base damage $D_0$ at the midpoint of the half-open interval for target integer `BTK` across Head/Chest and Armor tiers so $\pm 1\text{ m}$ range steps never cause unintended BTK jitter.
- **R2 (First-Shot-Zero Discrete TTK Gate)**: Compute $\text{TTK}_{\text{ideal}} = (\text{BTK}-1)\tau_{\text{shot}} + r/v_0$ and dispersion-adjusted $\text{TTK}_{\text{eff}}(r)$ across short/medium/long range brackets.
- **R3 (Tactical Buy-Menu Price & Kill-Reward Gate)**: Map multi-range combat utility to `$50/$100`-snapped weapon prices and verify inverse kill-reward scaling (SMG/Shotgun `+$600`, Rifle `+$300`, Sniper `+$100`).

## Companion Skills

- Universal numeric inverse solver: `$gg-numeric-solver-toolchain`
- Archetype-specific recoil patterns and camera kick: `$gun-recoil-camera-dynamics`

## 1. Discrete BTK & Exact First-Shot TTK Math

In tactical shooters, continuous DPS (`Damage * FireRate`) is misleading because bullets are discrete and the **first bullet fires at $t = 0$**:

1. **Per-Hit Effective Damage ($d_{\text{eff}}$)**:
   Given base muzzle damage $D_0$, engagement distance $r$, piecewise range dropoff $f_{\text{range}}(r) \in (0, 1]$, hitbox zone multiplier $Z_{\text{zone}}$ (`Head`, `UpperChest`, `Stomach`, `Limbs`), and armor penetration ratio $\rho_{\text{pen}} \in [0, 1]$ against target armor rating $A \in \{0, 1, 2\}$:
   $$
   d_{\text{eff}}(r, \text{zone}, A) = \left\lfloor D_0 \cdot f_{\text{range}}(r) \cdot Z_{\text{zone}} \cdot \left(1 - \alpha_{\text{armor}}(A) \cdot (1 - \rho_{\text{pen}})\right) \right\rfloor
   $$
2. **Bullets-To-Kill (`BTK`) & Discrete `TTK`**:
   For target health $H_{\text{target}}$ (typically $100$) and cyclic rate of fire $\text{RPM}$ (inter-shot interval $\tau_{\text{shot}} = 60 / \text{RPM}$):
   $$
   \text{BTK} = \left\lceil \frac{H_{\text{target}}}{d_{\text{eff}}} \right\rceil, \qquad \text{TTK}_{\text{ideal}} = (\text{BTK} - 1) \cdot \tau_{\text{shot}} + \frac{r}{v_{\text{muzzle}}}
   $$
   - Note: A 1-tap headshot (`BTK = 1`) has $\text{TTK}_{\text{ideal}} = r / v_{\text{muzzle}} \approx 0\text{ ms}$ (instant kill before fire rate matters).
3. **Inverse Solving `D_0` from Target BTK Breakpoints**:
   To guarantee an integer `BTK = k` against armored chest at range $r$, solve:
   $$
   D_0 \in \left[ \frac{H_{\text{target}}}{k \cdot f_{\text{range}}(r) \cdot M_{\text{armor}}}, \; \frac{H_{\text{target}} - 1}{(k - 1) \cdot f_{\text{range}}(r) \cdot M_{\text{armor}}} \right)
   $$
   Always pick $D_0$ near the center of this half-open interval so minor floating-point or range variations at $r \pm 1\text{ m}$ do not accidentally flip `BTK` by $\pm 1$ bullet.

## 2. Effective Engagement TTK & Tactical Weapon Pricing Formula

Weapon purchase price (`Price`) in a tactical buy-menu must reflect **Effective Combat Utility** across short ($0\text{–}15\text{ m}$), medium ($15\text{–}35\text{ m}$), and long ($35\text{–}60\text{ m}$) ranges, plus economy kill-reward risk:

1. **Stochastic Hit-Probability Adjusted TTK ($\text{TTK}_{\text{eff}}$)**:
   Given angular dispersion $\sigma_{\theta}$ (MOA + movement + recoil bloom) and target angular radius $\theta_{\text{target}}(r) = \arctan(R_{\text{torso}} / r)$, single-shot hit probability is $p_{\text{hit}}(r) = 1 - \exp\left(-\frac{\theta_{\text{target}}^2}{2\sigma_{\theta}^2}\right)$.
   $$
   \mathbb{E}[\text{Shots}(r)] = \frac{\text{BTK}(r)}{p_{\text{hit}}(r)}, \qquad \text{TTK}_{\text{eff}}(r) = \left(\mathbb{E}[\text{Shots}(r)] - 1\right) \cdot \tau_{\text{shot}}
   $$
2. **Weapon Price Valuation Model**:
   Compute composite combat score $U_w$ weighted across the three range bands $(w_S, w_M, w_L) = (0.35, 0.45, 0.20)$:
   $$
   U_w = \sum_{b \in \{S,M,L\}} w_b \cdot \left(\frac{T_{\text{ref}}}{\max(\text{TTK}_{\text{eff}}(r_b), 0.08)}\right)^{\beta} \cdot M_{\text{mobility}} \cdot M_{\text{mag}} \cdot M_{\text{oneTap}}
   $$
   Snap final shop price to clean tactical increments (`$50` or `$100`):
   - **Sidearms (`$0–$800`)**, **SMGs / Shotguns (`$1050–$1800`, high kill reward `+$600`)**, **Assault Rifles (`$2700–$3100`, standard reward `+$300`)**, **Sniper Rifles (`$1700` Scout / `$4750` 1-Tap AWP, low reward `+$100`)**.

## 3. Realistic Ballistic & Target Feedback Loop

A grounded tactical gunfight requires unmistakable physical readbacks on every round:
- **Sub-Sonic / Super-Sonic Acoustic Split**: Muzzle report (delayed by distance $r / 343\text{ m/s}$) + supersonic bullet snap/whiz when a round passes within $1.5\text{ m}$ of the player's head.
- **Material-Specific Impact Signatures**: Concrete sparks + grey dust plume, metal ricochet whine + bright orange spark cone, wood splinter burst, or Kevlar dull thud vs unarmored flesh mist + **Aim-Punch** (target flinch proportional to $d_{\text{eff}} \cdot (1 - \text{ArmorCover})$).
- **Two-Stage Hitmarker & Audio Confirmation**: Crisp high-frequency tick on body hit, distinct metallic bell/crunch on armored headshot (`onset_hi_p90` peak), and low-end bass drop on confirmed kill.
