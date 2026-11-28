---
name: gg-numeric-solver-toolchain
description: Universal numeric solver and balance toolchain distilled from GenerativeGame's bidirectional TTK solver, constrained attribute budget allocator, reverse curve-table solver, and multi-tier stone-axe normalization pipeline.
---

# GG Numeric Solver Toolchain (Universal Balance & Inverse Solver)

Distilled from `Tool/MonsterDataTool/monster_data_calculator.py`, `Tool/ItemValueCalculator/core/repair/allocation_reverse.py`, `Tool/ModSDK/tools/weapon_budget.py`, and `Tool/PlaceableHealthTool/update_placeable_health.py`. Use this skill whenever a game system requires **bidirectional TTK solving**, **constrained stat-budget allocation**, **reverse weight extraction from existing tables**, or **multi-tier tool damage normalization**.

## When to use

- "帮我配一套游戏里的怪物血量、武器属性和砍树挖矿的数值，按我想让玩家打几秒、敲几下碎来自动算好属性，别出现属性超模或者怪只剩 1 滴血还要多砍一刀的情况。"
- Any game balance task involving stat budget allocation, reverse-solving weights from existing DataTables/CurveTables, monster TTK derivation, or resource node hit-count normalization.

## Three-Round Hidden Verification Gate (Headless Math Solver First)

- **R1 (Budget Conservation & Hard-Cap Clamping Gate)**: Enforce $\sum w_i \le 1 - c_{\text{fx}}$ and clamp secondary stats at $M_i$ without spilling truncated budget into uncapped damage.
- **R2 (Inverse Allocation & Idempotent Rounding Gate)**: Verify `reverse_allocation` + `normalize_allocations` recovers normalized weights summing to $100 - c_{\text{fx}}$ and `ROUND_HALF_UP` produces zero diff on re-export.
- **R3 (Bidirectional TTK & Integer Hit-Count Snap Gate)**: Confirm derived monster $\widehat{T}_{\text{kill}}$ stays within $\pm 15\%$ of target TTK and resource health snaps to an integer multiple of Tier-1 tool damage $D_0$ (zero 1-HP slivers).

## Companion Skills

- Economy DAG pricing, drop EV, and gold/min normalization: `$game-economy-balance`
- Tactical firearm BTK/TTK and weapon pricing: `$gun-tactical-ttk-economy`

## 1. Constrained Stat Budget Allocator & Inverse Solver

### Forward Allocation (Budget -> Panel Stats)

Given an equipment/unit archetype $a$, tier $t \in [t_{\min}, t_{\max}]$, total tier coefficient $C(a, t)$, special-effect budget tax $c_{\text{fx}} \in [0, 1)$, and normalized attribute weights $w_i \ge 0$:

$$
\sum_{i} w_i \le 1 - c_{\text{fx}}, \qquad \text{RawStat}_i = \frac{C(a, t) \cdot w_i}{r_i}
$$

where $r_i > 0$ is the cost-per-point conversion ratio for attribute $i$ (e.g., `damage = 1`, `crit_rate = 200`, `attack_speed = 260`, `crit_damage = 500`, `knockback = 50`).

- **Hard Cap Clamping Rule**: Each secondary attribute has a hard ceiling $M_i$ (e.g., `attack_speed <= 0.35`, `crit_rate <= 0.25`, `crit_damage <= 0.50`, `knockback <= 1.0`).
  $$
  \text{FinalStat}_i = \min\left(\text{RawStat}_i, M_i\right)
  $$
- **No Budget Spillover**: Any budget truncated by $M_i$ is forfeited and **must not** be redistributed automatically to uncapped stats (prevents unintended damage inflation). Always emit a `clamped` diagnostic warning when $\text{RawStat}_i > M_i$.

### Inverse Allocation (Existing Curve/Table -> Normalized Weights)

When repairing legacy tables or auditing hand-tuned items (`allocation_reverse.py`), recover the implied percentage allocation $A_i \in [0, 100]$ from a panel value $V_i$:

$$
A_i^{\text{raw}} = \frac{V_i \cdot r_i \cdot 100}{C(a, t)}
$$

Normalize across all positive attributes to fit the remaining percentage budget $B = \max(0, 100 - c_{\text{fx}})$:

$$
A_i^{\text{norm}} = \text{round}\left(A_i^{\text{raw}} \cdot \frac{B}{\sum_{j} A_j^{\text{raw}}}, 2\right)
$$

## 2. Bidirectional Ecology TTK & Combat Stat Solver

Never hand-guess monster HP and attack power independently. Anchor every enemy tier to an **Ecology Baseline** (`EcologyConfig`: `player_max_hp`, `player_dps`, `player_physical_defense_entry/exit`, `player_magic_defense_entry/exit`) and solve from target combat pacing parameters:

1. **Inputs (Design Intent)**:
   - `ttk_time` ($T_{\text{kill}}$): Expected seconds for a baseline player in that ecology to kill the unit.
   - `kill_player_times` ($K_{\text{hits}}$) or `ecological_dps`: Expected hits/seconds for the monster to kill the baseline player.
   - `damage_reduction_ratio` ($R_{\text{dr}} \in [0, 0.85]$), `physical_defense_ratio` ($\alpha_p$), `magic_defense_ratio` ($\alpha_m$), and `monster_weight` ($W_m$).
2. **Forward Derivation (Intent -> Runtime Attributes)**:
   - Effective player damage after monster mitigation:
     $$
     \text{MaxHealth} = \text{round}\left(\text{player\_dps} \cdot T_{\text{kill}} \cdot (1 - R_{\text{dr}}) \cdot w_{\text{difficulty}}\right)
     $$
   - Monster per-hit raw damage compensating for baseline player defense $D_{\text{player}}$:
     $$
     \text{RawAttack} = \frac{\text{player\_max\_hp}}{K_{\text{hits}}} + D_{\text{player}}
     $$
   - Derive `Poise` / `Stability` and `KnockbackResistance` monotonically from `monster_weight` ($W_m$).
3. **Inverse Verification (Runtime Attributes -> Effective TTK)**:
   - Given any table row, compute and report:
     $$
     \widehat{T}_{\text{kill}} = \frac{\text{MaxHealth}}{\max\left(\epsilon, (\text{PlayerAttack} - \text{MonsterDef}) \cdot (1 - R_{\text{dr}}) \cdot \text{PlayerAPS}\right)}
     $$
   - Flag any row whose $\widehat{T}_{\text{kill}}$ drifts more than $\pm 15\%$ from its tier baseline.

## 3. Multi-Tier Tool Damage & Object Health Normalization

For destructible scene objects, resource nodes, and placeables (`PlaceableHealthTool`):

1. **Anchor to Tier-1 Baseline Tool**: Resolve the baseline tool's single-hit damage $D_0$ (e.g., Tier-1 Stone Axe from `ItemAttrCurveTable`).
2. **Rule Chain Resolution Priority**:
   - `Blacklist` (skip) $\to$ `Whitelist` (fixed HP, optional `locked`) $\to$ `Resource Rule` $\to$ `Category Rule` $\to$ `Standard Snap`.
3. **Standard Hit-Count Snapping**:
   - Snap normalized health to an integer multiple of $D_0$ ($H = N_{\text{hits}} \cdot D_0$) so Tier-1 harvesting never leaves a sliver of 1–2 HP requiring an extra swing.
4. **Multi-Tier TTK Matrix Preview**:
   - For every tool tier $k \in \{1, 2, 3, \dots\}$ with damage $D_k$ and swing interval $\tau_k$, compute:
     $$
     N_k = \left\lceil \frac{H}{D_k} \right\rceil, \qquad \text{TTK}_k = N_k \cdot \tau_k
     $$
   - Verify that each tier upgrade strictly reduces $N_k$ on its target resource tier ($N_{k+1} < N_k$).

## Non-Negotiable Discipline

- Always separate **Design Intent Parameters** (`TTK`, `BTK`, `Tier`, `Weights`), **Baseline Anchors** (`player_dps`, `D_0`), and **Derived Panel Values**.
- Use `Decimal` with `ROUND_HALF_UP` (or explicit integer rounding rules) when writing back to JSON/CSV tables so repeated runs are idempotent and produce zero diff noise.
