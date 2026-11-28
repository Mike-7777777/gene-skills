---
name: car-speedline-camera-vfx
description: High-speed racing visual presentation skill for rendering procedural radial anime speed lines, velocity-driven FOV warp, spring-arm camera lag, drift roll banking, gear-shift punch, and nitro chromatic/motion-blur post-processing.
---

# Car 2: Procedural Speed Lines & Dynamic Racing Camera VFX

Distilled from `ATopDownPhysicsCameraActor` (spring-arm lag & snap), `CameraModifier_CombatPostProcess` (post-process blending), and procedural 2D/3D shader/canvas rendering. Use this skill to make vehicle speed, drift G-forces, and nitro bursts **visibly visceral** through procedural speed lines and dynamic camera kinematics.

## When to use

- Single-skill trigger: "给我的赛车游戏加上速度感特效，车开快了或者喷氮气的时候，屏幕四周要有动漫那种速度线，镜头要有拉远推背感、过弯倾斜和震动，看着就觉得车速飞快。"
- Combined Car 1 + Car 2 trigger (chain with `$car-track-flow-generator`): "帮我做一个能在网页里玩的跑酷飙车小游戏，赛道要有大飞坡、断桥和斜墙，跑完大概一分钟，过弯漂移和踩加速带能把氮气一直续上不断档；而且车开快和喷氮气的时候，屏幕四周要有动漫那种速度线，镜头要有拉远推背感和过弯倾斜震动。"

## Three-Round Hidden Verification Gate (Headless Camera/VFX State First)

- **R1 (Safe Center Visibility Cone Gate)**: Clamp speed-line inner radius $R_{\text{inner}} \ge 0.34 R_{\text{screen}}$ around the velocity vanishing point so streaks never obscure the car or upcoming track apex.
- **R2 (Non-Linear FOV & Nitro Kick Gate)**: Verify $\text{FOV}(u_v, u_{\text{nitro}})$ stays bounded in $[60^\circ, 96^\circ]$ with an exponentially decaying $+6^\circ$ impulse on nitro ignition.
- **R3 (Drift Roll & Landing Spring Gate)**: Clamp horizon roll within $\pm 8^\circ$ and verify vertical landing spring compression $\Delta z_{\text{cam}}$ settles cleanly to zero without oscillation drift.

## Companion Skills

- Parkour track generation, ramp ballistics, and nitro chain pacing: `$car-track-flow-generator`

## 1. Normalized Speed Ratio & Nitro Intensity Driver

Never drive camera or VFX parameters with raw unnormalized velocity. Define two master normalized scalars updated every frame:

$$
u_v = \text{clamp}\left(\frac{v - v_{\text{threshold}}}{v_{\max} - v_{\text{threshold}}}, 0, 1\right), \qquad u_{\text{nitro}} \in [0, 1] \text{ (smoothed boost state)}
$$

where $v_{\text{threshold}} \approx 0.55 v_{\text{base}}$ is the onset of high-speed sensation.

## 2. Procedural Radial Speed Lines (2D Overlay / Shader)

Render crisp, anime/arcade-style radial speed streaks converging toward the **projected velocity vanishing point** $\mathbf{P}_{\text{vanish}} = (x_c + \Delta x_{\text{drift}}, y_c + \Delta y_{\text{pitch}})$:

1. **Polar Ring Spawning & Safe Center Mask**:
   - Keep a clear central visibility cone of radius $R_{\text{inner}}(u_v) = R_{\text{screen}} \cdot \text{lerp}(0.58, 0.34, u_v + 0.35 u_{\text{nitro}})$ so the player's car and upcoming apex are never obscured.
   - For each active streak $i \in [1, N_{\text{lines}}]$ where $N_{\text{lines}} = \lfloor \text{lerp}(0, 72, u_v^2) + 40 u_{\text{nitro}} \rfloor$:
     - Polar angle $\theta_i \in [0, 2\pi)$, radial outer tip $r_{\text{out}, i}$, inner tip $r_{\text{in}, i} = r_{\text{out}, i} - L_i(u_v)$, angular half-width $\delta\theta_i \in [0.003, 0.014]\text{ rad}$.
     - Draw a tapered **triangle wedge** from $r_{\text{in}, i}$ (alpha $0$, sharp point) to $r_{\text{out}, i}$ (alpha $\alpha_i$, width $2 r_{\text{out}, i}\delta\theta_i$).
2. **Color & Tier Escalation**:
   - **High Cruise ($u_v > 0.2$, no nitro)**: Crisp white/silver peripheral wedges (`rgba(255,255,255,0.45)`).
   - **Nitro Level 1–2**: Cyan/electric-blue streaks + outer vignette pulse.
   - **Overdrive / Max Chain ($u_{\text{nitro}} > 0.8$)**: Dual-layer streaks (cyan + magenta/gold core) + world-space wind ribbons trailing off rear wingtips.

## 3. Dynamic Camera Rig &FOV Warp Kinematics

Model the chase camera as a 6-DOF spring-damper rig relative to the car chassis:

1. **Non-Linear FOV Warp & Dolly Pull-Back (Reverse Hitchcock Zoom)**:
   $$
   \text{FOV}(t) = \text{FOV}_0 + \Delta\text{FOV}_{\text{speed}} \cdot u_v^{1.4} + \Delta\text{FOV}_{\text{nitro}} \cdot u_{\text{nitro}} + \Delta\text{FOV}_{\text{kick}}(t)
   $$
   - Default $\text{FOV}_0 = 60^\circ$, $\Delta\text{FOV}_{\text{speed}} = +18^\circ$, $\Delta\text{FOV}_{\text{nitro}} = +12^\circ$.
   - On the exact frame Nitro ignites, inject an impulse $\Delta\text{FOV}_{\text{kick}} = +6^\circ$ that decays exponentially ($\tau = 0.18\text{ s}$) while pulling camera follow distance back slightly so the car surges forward in screen space.
2. **Drift Lateral Lead & Horizon Roll Banking**:
   - Given vehicle yaw rate $\omega_z$ and slip angle $\beta$:
     - **Look-Ahead Lateral Offset**: Shift camera look-at target toward the inside of the turn by $\Delta x_{\text{look}} = k_{\text{lead}} \cdot \sin\beta$, revealing the corner exit.
     - **Dynamic Camera Roll**: Tilt camera horizon by $\phi_{\text{cam}} = -\text{clamp}(k_{\text{roll}} \cdot a_{\text{lat}}, -8^\circ, +8^\circ)$ to convey lateral G-force.
3. **High-Frequency Road Micro-Shake & Landing Compression**:
   - Add Perlin noise camera translation scaled by $u_v^2 \cdot \text{surfaceRoughness}$ at frequency $18\text{–}28\text{ Hz}$ (amplitude $\le 0.04\text{ m}$ so it feels fast without causing motion sickness).
   - On ramp touchdown with vertical impact velocity $v_z$, apply a damped vertical spring compression $\Delta z_{\text{cam}}(t) = -A_{\text{land}} e^{-\zeta \omega_n t} \cos(\omega_d t)$ accompanied by a radial dust/spark burst.
