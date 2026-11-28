---
name: ball-hitstop-impact-feedback
description: Pinball and cosmic billiards collision hit-stop (frame freeze), directional shake envelope, elastic squash-and-stretch deformation, shockwave rings, and ascending harmonic pitch audio-visual feedback skill.
---

# Ball 2: Pinball Hit-Stop Frame Freeze & Visceral Impact Feedback

Distilled from `UCombatHitStopComponent`, `FCombatHitStopShakeTypes`, `CombatFloatTextPresentation`, and `$gg-audio-dsp-acoustics`. Use this skill to make every ball-to-bumper, ball-to-ball, and jackpot collision in a pinball / cosmic billiards game feel **explosive, weighty, and rhythmic** through precision Hit-Stop frame freezes and layered sensory feedback.

## When to use

- Single-skill trigger: "给我的弹球游戏加上超爽的打击感，球重重撞上机关或者打中大奖的时候，要有瞬间的卡肉顿帧、球体 Q 弹变形、屏幕震动，还有连击越高音调越往上扬的清脆音效。"
- Combined Ball 1 + Ball 2 trigger (chain with `$ball-cosmic-billiards-level`): "帮我做一个太空台球/弹珠台网页小游戏，台面上有反弹柱和引力场，球打进去能乒乒乓乓连弹好几十下，再放几个口很窄但进去了能翻好几倍分的大奖洞；而且球撞上去或者中大奖的时候，要有瞬间的卡肉顿帧、球体 Q 弹变形、屏幕震动和越连击越高的音效。"

## Three-Round Hidden Verification Gate (Headless Hit-Stop Scheduler First)

- **R1 (4-Tier Impulse Freeze Gate)**: Map normalized impulse $\hat{I}$ to 4 freeze tiers (`0 ms` graze, `18–32 ms` peg, `45–68 ms` super-bumper, `85–130 ms` jackpot + slow-mo ramp) so weak wall grazes never stutter.
- **R2 (Refractory Anti-Slideshow Cooldown Gate)**: Enforce per-tier refractory window $\tau_{\text{cool}}$ inside multi-bounce bumper nests, attenuating repeated freeze durations by $\times 0.25$ while preserving 100% of flash, particles, and pitch audio.
- **R3 (Momentum Conservation & Squash-Stretch Gate)**: Assert outgoing velocity vector $\mathbf{v}^+$ is 100% preserved after Hit-Stop release, volume-preserving squash-and-stretch satisfies $s_{\perp} = 1/\sqrt{s_{\parallel}}$, and combo audio climbs the `12-TET` pentatonic ladder cleanly.

## Companion Skills

- Cosmic billiards level layout, bumper resonance, and multiplier chambers: `$ball-cosmic-billiards-level`
- Audio DSP & harmonic pitch scaling: `$gg-audio-dsp-acoustics`

## 1. Impact Energy Tiering & Hit-Stop Duration Formula

Never apply a flat frame freeze to every collision—freezing on weak wall grazes ruins physics flow, while under-freezing on Jackpot hits feels weightless. Compute the **Normalized Impact Impulse**:

$$
\hat{I} = \text{clamp}\left(\frac{\|(\mathbf{v}^+ - \mathbf{v}^-)\| \cdot w_{\text{target}}}{I_{\max}}, 0, 1\right)
$$

where $w_{\text{target}}$ is the target importance weight (`Wall = 0.2`, `Standard Peg = 0.6`, `Active Bumper = 1.0`, `Elite Target / Multiplier Gate = 1.5`, `Jackpot Core = 2.5`).

| Impact Tier | Condition | Hit-Stop Freeze ($\tau_{\text{stop}}$) | Freeze Scope | Refractory Cooldown ($\tau_{\text{cool}}$) |
|---|---|---|---|---|
| **Tier 0: Graze / Rail** | $\hat{I} < 0.25$ | `0 ms` (0 frames) | None | — |
| **Tier 1: Standard Peg / Bumper** | $0.25 \le \hat{I} < 0.60$ | `18–32 ms` (1–2 frames @60Hz) | Local (Ball + Hit Bumper only) | `65 ms` |
| **Tier 2: Super-Bumper / High Combo** | $0.60 \le \hat{I} < 0.90$ | `45–68 ms` (3–4 frames) | Global physics pause (VFX particles keep moving!) | `110 ms` |
| **Tier 3: Jackpot / Supernova Crit** | $\hat{I} \ge 0.90$ | `85–130 ms` (5–8 frames) + `150 ms` `0.25x` slow-mo ramp | Global freeze + background dim + zoom punch | `250 ms` |

- **Anti-Stutter Refractory Rule (Critical for Multi-Bounce Nests)**:
  Inside a tight bumper triangle where the ball bounces every $30\text{ ms}$, back-to-back full Hit-Stops will freeze the game into a slideshow. Enforce a **Refractory Window $\tau_{\text{cool}}$**: if another hit of the same tier occurs within $\tau_{\text{cool}}$, attenuate its freeze duration by $\times 0.25$ while keeping 100% of its visual flash, particles, and audio pitch escalation.

## 2. Elastic Squash-and-Stretch & Contact-Frame Jitter

During the Hit-Stop window $t \in [0, \tau_{\text{stop}}]$, freeze the ball's center-of-mass translation at the exact contact point $\mathbf{p}_{\text{contact}}$, but **animate its deformation and micro-vibration**:

1. **Volume-Preserving Squash & Stretch**:
   - Align local $X'$ axis with impact normal $\hat{\mathbf{n}}$ during contact, then snap to outgoing velocity $\hat{\mathbf{v}}^+$ on release:
     $$
     s_{\parallel} = 1 - 0.38 \hat{I} \quad (\text{during freeze}), \qquad s_{\parallel} = 1 + 0.42 \hat{I} \quad (\text{first 3 frames after release}), \qquad s_{\perp} = \frac{1}{\sqrt{s_{\parallel}}}
     $$
2. **High-Frequency Contact Jitter (`FCombatHitStopShakeTypes`)**:
   - While frozen in Tier 2/3 Hit-Stop, oscillate the impacted bumper and ball sprite along the normal/tangent by $\delta\mathbf{p}(t) = A_{\text{jitter}} \sin(2\pi f_{\text{jitter}} t)$ ($f_{\text{jitter}} \approx 45\text{ Hz}$, $A_{\text{jitter}} \in [2, 6]\text{ px}$) to store visual "kinetic tension" right before the ball rockets away.
3. **Bumper Ring Recoil**:
   - Scale the hit bumper to $1.35\times$ on frame 1 with a solid white/neon emissive flash, then recover via an underdamped spring ($\zeta = 0.28$, $\omega_n = 28\text{ rad/s}$) so the bumper visibly "rings" like a bell.

## 3. Directional Screen Shake, Shockwaves & Semitone Audio Escalation

1. **Directional Camera Impulse (Not Random Noise)**:
   - Kick the camera along the impact normal $-\hat{\mathbf{n}}$ by amplitude $A_{\text{cam}} = k_{\text{shake}} \cdot \hat{I}^2$, recovering via critically damped spring.
2. **Layered Hit VFX**:
   - **Contact Flash Star** (1–2 frames, additive white core) + **Expanding Normal Shockwave Ring** + **Anisotropic Spark Cone** reflected along $\mathbf{v}^+$ + **Comet Ribbon Trail** whose width and brightness scale with current combo multiplier.
3. **Ascending Semitone Combo Audio (`12-TET` Pitch Ladder)**:
   - On consecutive ricochet hits $k = 0, 1, 2, \dots$, pitch-shift or synthesize the bumper chime along a pentatonic / major scale in semitones:
     $$
     f_{\text{chime}}(k) = f_{\text{root}} \cdot 2^{\frac{S[k \bmod L] + 12 \lfloor k / L \rfloor}{12}}, \qquad S = [0, 2, 4, 7, 9]
     $$
   - Pair with a crisp high-frequency transient click (`2–6 kHz` burst) on contact and a sub-bass drop (`60–90 Hz`) on Tier 3 Jackpot hits.
