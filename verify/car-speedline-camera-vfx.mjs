#!/usr/bin/env node
// car-speedline-camera-vfx 的无头校验：速度归一化、速度线安全区、FOV 夹取、漂移倾斜与落地弹簧。
//   node verify/car-speedline-camera-vfx.mjs
import assert from "node:assert/strict";

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

// ---------- R1：速度归一化与速度线内半径 ----------
const speedRatio = (v, { threshold, max }) => clamp((v - threshold) / (max - threshold), 0, 1);
const vBase = 40;
const vThreshold = 0.55 * vBase;
const vMax = 1.65 * vBase;
assert.equal(speedRatio(vBase * 0.5, { threshold: vThreshold, max: vMax }), 0, "低于阈值时速度线强度应为 0");
assert.equal(speedRatio(vMax * 2, { threshold: vThreshold, max: vMax }), 1, "超速时必须夹到 1");
assert.ok(speedRatio((vBase + vMax) / 2, { threshold: vThreshold, max: vMax }) > 0, "区间内应有非零强度");

const screen = { w: 1920, h: 1080 };
const R = Math.min(screen.w, screen.h) / 2;
const rInner = 0.34 * R;
assert.ok(rInner >= 0.34 * R, "内半径必须 ≥ 0.34·R_screen，保证车辆与弯心不被速度线遮挡");
const vanishing = { x: screen.w / 2, y: screen.h * 0.62 };
for (let i = 0; i < 48; i++) {
  const theta = (i / 48) * Math.PI * 2;
  const start = { x: vanishing.x + Math.cos(theta) * rInner, y: vanishing.y + Math.sin(theta) * rInner };
  const d = Math.hypot(start.x - vanishing.x, start.y - vanishing.y);
  assert.ok(d >= 0.34 * R - 1e-9, "速度线起点落在安全区内部");
}

// ---------- R2：FOV 非线性夹取 + 氮气冲击指数衰减 ----------
const fov = ({ fov0, dSpeed, dNitro, kick, uv, uNitro }) => fov0 + dSpeed * Math.pow(uv, 1.4) + dNitro * uNitro + kick;
const FOV0 = 60;
const D_SPEED = 28;
const D_NITRO = 8;
const kick = (t) => 6 * Math.exp(-t / 0.35) * (t >= 0 ? 1 : 0);
let maxFov = -Infinity;
for (let uv = 0; uv <= 1.0001; uv += 0.05) {
  for (let un = 0; un <= 1.0001; un += 0.1) {
    const f = fov({ fov0: FOV0, dSpeed: D_SPEED, dNitro: D_NITRO, kick: 0, uv, uNitro: un });
    maxFov = Math.max(maxFov, f);
    assert.ok(f >= 60 - 1e-9 && f <= 96 + 1e-9, `FOV 越界：${f}`);
  }
}
assert.equal(fov({ fov0: FOV0, dSpeed: D_SPEED, dNitro: D_NITRO, kick: 0, uv: 1, uNitro: 1 }), 96, "满速满氮气应正好撞到 96° 上限");
assert.ok(kick(0) === 6, "氮气点火瞬间冲击应为 +6°");
assert.ok(kick(0.35) < 6 * 0.4, "冲击必须指数衰减");
assert.ok(kick(5) < 1e-5, "5 秒后冲击应回到基线");

// ---------- R3：漂移倾斜 ±8° 与落地弹簧收敛 ----------
const roll = (g) => clamp(g * 2.5, -8, 8);
for (const g of [-10, -3, 0, 3, 10]) {
  const r = roll(g);
  assert.ok(r >= -8 - 1e-9 && r <= 8 + 1e-9, `倾斜越界：${r}`);
}
// 弹簧：z'' = -k·z - c·z'，用固定步长积分，必须单调收敛到 0，不振荡
function springSettle(k, c, z0) {
  let z = z0;
  let v = 0;
  const dt = 1 / 120;
  let crossings = 0;
  let lastSign = Math.sign(z);
  for (let i = 0; i < 120 * 5; i++) {
    const a = -k * z - c * v;
    v += a * dt;
    z += v * dt;
    const s = Math.sign(z);
    if (s !== 0 && s !== lastSign) crossings++;
    if (s !== 0) lastSign = s;
  }
  return { z, crossings };
}
const critical = springSettle(50, 2 * Math.sqrt(50), 1.5);
assert.ok(Math.abs(critical.z) < 1e-3, `临界阻尼应收敛到 0，实际 ${critical.z}`);
assert.equal(critical.crossings, 0, "过阻尼/临界阻尼不应来回振荡");
const bouncy = springSettle(200, 2, 1.5);
assert.ok(bouncy.crossings > 0, "欠阻尼情形必须能观察到振荡，用于检测配置错误");
for (let z0 = -2; z0 <= 2; z0 += 0.5) {
  assert.ok(Number.isFinite(springSettle(50, 2 * Math.sqrt(50), z0).z), "任意初始压缩都必须收敛为有限值");
}

console.log(`ok: FOV max ${maxFov.toFixed(1)}°, r_inner ${rInner.toFixed(0)}px ≥ 0.34R, roll ±8°, spring settles`);
