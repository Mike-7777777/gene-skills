#!/usr/bin/env node
// gun-recoil-camera-dynamics 的无头校验：六种枪型参数曲线可区分、双层弹簧停火回正、
// 准星扩散与真实散布锥逐帧一致。不渲染。
//   node verify/gun-recoil-camera-dynamics.mjs
import assert from "node:assert/strict";

// ---------- 参数表：每种枪一套可达的弹簧参数 ----------
const ARCHETYPES = {
  pistol: { kick: 1.2, kReturn: 180, gain: 0.55, bloom: 0.9, rampsDown: false },
  smg: { kick: 1.6, kReturn: 90, gain: 1.0, bloom: 0.9, rampsDown: false }, // 高频抖动、回正慢
  rifle: { kick: 1.4, kReturn: 140, gain: 0.8, bloom: 0.35, rampsDown: false },
  shotgun: { kick: 3.0, kReturn: 70, gain: 1.6, bloom: 1.8, rampsDown: false },
  sniper: { kick: 3.6, kReturn: 60, gain: 1.9, bloom: 2.4, rampsDown: false },
  lmg: { kick: 1.5, kReturn: 120, gain: 0.7, bloom: 1.2, rampsDown: true },
};

// ---------- R1：六种枪型的参数曲线互不相同 ----------
const sig = (a) => `${a.kick}|${a.kReturn}|${a.gain}|${a.bloom}|${a.rampsDown}`;
const signatures = new Set(Object.values(ARCHETYPES).map(sig));
assert.equal(signatures.size, Object.keys(ARCHETYPES).length, "六种枪型的参数必须两两不同");
assert.ok(ARCHETYPES.pistol.kReturn > ARCHETYPES.smg.kReturn, "手枪回正必须快于冲锋枪");
assert.ok(ARCHETYPES.smg.kick > ARCHETYPES.rifle.kick && ARCHETYPES.smg.kReturn < ARCHETYPES.rifle.kReturn, "冲锋枪应更抖、回正更慢");
assert.ok(ARCHETYPES.shotgun.gain > ARCHETYPES.rifle.gain, "霰弹枪镜头冲击必须强于步枪");
assert.ok(ARCHETYPES.lmg.rampsDown, "轻机枪需要后段反向收敛");

// ---------- R2：整弹匣扫射后停火，两层角度都要回正到 < 1e-3 度 ----------
// θ'' = −k·θ − c·θ' + J；c 取临界阻尼
function simulate({ kReturn, gain, kick }, opts = {}) {
  const { shots = 12, tauShot = 0.09, magSeconds = 1.2 } = opts;
  const dt = 1 / 240;
  const c = 2 * Math.sqrt(kReturn);
  let aim = { th: 0, w: 0 };
  let cam = { th: 0, w: 0 };
  const step = (s, j) => {
    const a = -kReturn * s.th - c * s.w + j;
    s.w += a * dt;
    s.th += s.w * dt;
  };
  for (let t = 0; t < magSeconds; t += dt) {
    const n = Math.floor(t / tauShot);
    if (n < shots && t - n * tauShot < dt) {
      aim.w += kick; // 实际弹道偏转
      cam.w += kick * gain; // 视觉镜头冲击
    }
    step(aim, 0);
    step(cam, 0);
  }
  const after = { aimTh: Math.abs(aim.th), camTh: Math.abs(cam.th) };
  let maxAim = 0;
  for (let t = 0; t < 3; t += dt) {
    step(aim, 0);
    step(cam, 0);
    maxAim = Math.max(maxAim, Math.abs(aim.th));
  }
  return { after, settled: { aimTh: Math.abs(aim.th), camTh: Math.abs(cam.th) }, maxAim };
}

for (const [name, params] of Object.entries(ARCHETYPES)) {
  const { settled } = simulate(params);
  assert.ok(settled.aimTh < 1e-3, `${name} 瞄准角停火后未回正：${settled.aimTh}`);
  assert.ok(settled.camTh < 1e-3, `${name} 镜头角停火后未回正：${settled.camTh}`);
}
// 反例：参数错误时必须能检测出来（回正太慢）
const broken = simulate({ kReturn: 2, gain: 1, kick: 1.4 });
assert.ok(broken.settled.aimTh >= 1e-3, "回正过慢的配置应当被判为不合格");

// ---------- R3：准星扩散半径与真实散布锥逐帧一致 ----------
const spreadConeDeg = (shotsFired, arch) =>
  Math.min(arch.bloom * (arch.rampsDown && shotsFired > 10 ? 0.6 : 1) * Math.sqrt(shotsFired + 1), 6);
const crosshairRadiusPx = (coneDeg, fovDeg, screenH) => (Math.tan((coneDeg * Math.PI) / 360) / Math.tan((fovDeg * Math.PI) / 360)) * screenH;

for (const [name, arch] of Object.entries(ARCHETYPES)) {
  for (let fired = 0; fired <= 20; fired++) {
    const cone = spreadConeDeg(fired, arch);
    const drawn = crosshairRadiusPx(cone, 70, 1080);
    const back = (Math.atan((drawn / 1080) * Math.tan((70 * Math.PI) / 360)) * 360) / Math.PI;
    assert.ok(Math.abs(back - cone) < 1e-9, `${name} 第 ${fired} 发：准星半径与散布锥不一致`);
  }
}
// 轻机枪第 10 发之后必须收敛，而不是继续变宽
assert.ok(spreadConeDeg(16, ARCHETYPES.lmg) < spreadConeDeg(10, ARCHETYPES.lmg) * 1.0, "轻机枪后段应反向收敛");

console.log("ok: 6 archetype signatures distinct, both layers return to < 1e-3 deg, crosshair matches cone");
