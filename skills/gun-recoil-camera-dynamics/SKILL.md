---
name: gun-recoil-camera-dynamics
description: Archetype-driven firearm recoil physics and camera presentation skill. Models spring-damper pitch/yaw recoil patterns, visual vs actual aim kick, weapon viewmodel 6-DOF impulse, muzzle flash lighting, and per-class gun feel (Pistol, SMG, AR, Shotgun, Sniper, LMG).
---

# Gun 2: Archetype-Specific Recoil Physics & Camera Dynamics

Design and implement **visceral, archetype-distinct firearm recoil and camera feedback** so every weapon class (Pistol, SMG, Assault Rifle, Shotgun, Sniper, LMG) is immediately recognizable by its physical kick, viewmodel motion, and screen response alone.

## When to use

- Single-skill trigger: "帮我做一套射击游戏的开枪手感，手枪、冲锋枪、步枪、霰弹枪、狙击枪要有完全不一样的后坐力和镜头震动，连发扫射能手动压枪，停火后准星会自动回正。"
- Combined Gun 1 + Gun 2 trigger (chain with `$gun-tactical-ttk-economy`): "帮我做一个偏真实硬核的网页枪战小游戏，能买手枪、冲锋枪、步枪、霰弹枪和狙击枪，算清楚不同枪打头、打防弹衣分别几枪死并定好买枪价格；而且每把枪开火要有完全不一样的后坐力上跳、连发压枪弹道和镜头震动反馈。"

## Three-Round Hidden Verification Gate (Headless Recoil Physics First)

- **R1 (Six-Archetype Signature Separation Gate)**: Verify distinct parameter profiles for Pistol (fast snap recovery), SMG (high-freq jitter), AR (`0.65x` 1st-shot tap bonus + S-curve), Shotgun/Sniper (heavy FOV/roll punch), and LMG (sustained-fire reverse bloom stabilization after shot 10).
- **R2 (Dual-Layer Spring Zero-Return Gate)**: Simulate full-magazine dump followed by cease-fire and assert both cumulative aim angle $\boldsymbol{\theta}_{\text{aim}}$ and camera punch $\boldsymbol{\theta}_{\text{cam}}$ decay to $< 10^{-3}\text{ deg}$ within recovery window.
- **R3 (Viewmodel 6-DOF & Reticle Sync Gate)**: Ensure dynamic crosshair bloom radius matches actual raycast dispersion cone $\sigma_{\theta}(t)$ frame-for-frame.

## Companion Skills

- Tactical BTK/TTK breakpoints, armor penetration, and weapon pricing: `$gun-tactical-ttk-economy`

## 1. Dual-Layer Recoil Architecture (Actual Aim vs Visual Camera Kick)

Never bind the bullet raycast directly to a noisy camera shake. Split recoil into two coupled **2nd-Order Underdamped Spring-Damper Systems**:

1. **Layer A: Cumulative Aim Recoil ($\boldsymbol{\theta}_{\text{aim}} = (\text{Pitch}, \text{Yaw})$)**:
   - Driven by a deterministic + seeded stochastic **Spray Pattern Table** $(\Delta p_k, \Delta y_k)$ indexed by continuous shot index $k \in [1, N_{\text{mag}}]$:
     $$
     \boldsymbol{\omega}_{\text{aim}} \gets \boldsymbol{\omega}_{\text{aim}} + \mathbf{J}_{\text{aim}}(k), \qquad \ddot{\boldsymbol{\theta}}_{\text{aim}} = -k_{\text{return}} \boldsymbol{\theta}_{\text{aim}} - c_{\text{return}} \dot{\boldsymbol{\theta}}_{\text{aim}}
     $$
   - When the player stops firing, $\boldsymbol{\theta}_{\text{aim}}$ smoothly recovers toward $(0, 0)$ at rate $\omega_n = \sqrt{k_{\text{return}}}$.
2. **Layer B: High-Frequency Visual Camera Punch ($\boldsymbol{\theta}_{\text{cam}} = (\text{Pitch}, \text{Yaw}, \text{Roll})$ & $\Delta\text{FOV}$)**:
   - Sharp impulse per shot with fast recovery ($\tau_{\text{cam}} \approx 55\text{–}90\text{ ms}$) plus a subtle **Roll torque** $\delta\phi = \pm \text{rand}(0.4^\circ, 1.2^\circ)$ and micro FOV punch $\Delta\text{FOV} = -0.8^\circ \dots -2.5^\circ$ (briefly zooms/compresses on heavy calibers).

## 2. Six Firearm Archetype Recoil Signatures

Parameterize every weapon using this explicit physical matrix:

| Archetype | Vertical Kick ($\Delta\text{Pitch}$) | Horizontal Pattern ($\Delta\text{Yaw}$) | First-Shot Multiplier | Recovery Speed ($\omega_n$) | Viewmodel 6-DOF & Camera Signature |
|---|---|---|---|---|---|
| **Pistol / Revolver** | Medium-High (`1.8°–4.5°`) | Very Low (`±0.25°`) | `1.0x` | Very Fast (`18 rad/s`) | Sharp upward wrist snap + slide blowback; crisp instantaneous center return |
| **SMG** | Low per shot (`0.55°`) | High high-freq jitter (`±0.65°`) | `0.75x` | Fast (`15 rad/s`) | Rapid z-axis vibration, tight radial screen micro-shake, minimal FOV kick |
| **Assault Rifle (AR)** | Medium (`1.15°`) | S-curve (`shots 1–7 vertical -> 8–18 Left -> 19–30 Right`) | `0.65x` (Tapping reward) | Medium (`10 rad/s`) | Distinct rhythmic shoulder thump (`Z-pushback`), controllable spray transfer |
| **Shotgun** | Extreme (`5.5°–8.0°`) | Moderate (`±1.2°`) | `1.0x` | Slow (`5.5 rad/s`) | Heavy backward stock slam, `-2.5°` FOV punch, `2.2°` camera roll, pump/bolt secondary motion |
| **Sniper Rifle** | Massive (`7.0°–10.0°`) | Low (`±0.4°`) | `1.0x` | Slow (`4.2 rad/s`) | Scope vignette black-ring expansion on fire, delayed bolt-cycle camera tilt |
| **LMG** | High (`1.4° -> 0.75°` reverse bloom) | Wide sustained sway (`±0.9°`) | `1.45x` (Clunky start) | Slow (`6.0 rad/s`) | Heavy chassis oscillation that **stabilizes after shot 10** when mounted/sustained |

## 3. Viewmodel 6-DOF & Peripheral Ballistic Polish

- **Viewmodel Spring Separation**: Translate the gun model backward along local $-Z$ (shoulder kick) and upward along $+Y$ with independent spring constants so the weapon visually kicks inside the hands before the camera finishes rising.
- **Dynamic Crosshair / Reticle Bloom**: Expand outer reticle pips by actual dispersion cone $\sigma_{\theta}(t)$ in screen pixels while keeping a faint center reference dot or moving recoil-compensation indicator.
- **Muzzle Flash & Shell Ejection Physics**:
  - 1-frame point light flash illuminating nearby walls + directional gas star sprite scaled by caliber.
  - Physical brass casing ejection along local $+X / +Y$ with angular spin and metallic floor bounce sound after $0.35\text{ s}$.
