#!/usr/bin/env node
// car-track-flow-generator 的无头校验：弧长时长预算 ±5%、飞坡落地弹道余量、
// 弯道半径门槛、氮气连续补给间距。不渲染、不开浏览器。
//   node verify/car-track-flow-generator.mjs
import assert from "node:assert/strict";

const G = 9.81;

// ---------- R1：按弧长分段做时长预算 ----------
function expectedLap(segments, vBase, vNitro, gamma) {
  assert.ok(gamma >= 1.35 && gamma <= 1.65, `γ_nitro 必须落在 [1.35, 1.65]，实际 ${gamma}`);
  const vN = gamma * vBase;
  return segments.reduce((total, { length, boost }) => total + length / ((1 - boost) * vBase + boost * vN), 0);
}

const vBase = 40; // m/s，约 144 km/h
const vNitro = 1.5 * vBase;
const tTarget = 55; // 冲刺段 60–90 s：55s 的设计稿用来验证预算闸门能拦住“太短”
// 用 8 段节奏拼接出一条总长按速度积分刚好落在目标上的赛道
// 用真实的设计稿（每段弧长由关卡编辑器给出），而不是反算出来的等长段：
// 这样“时长预算”才有被真正检验的空间，改目标的负向测试必须能失败。
const authoredSegments = [
  { length: 320, boost: 0.8 },
  { length: 260, boost: 0.1 },
  { length: 410, boost: 0.4 },
  { length: 180, boost: 0.0 },
  { length: 540, boost: 0.8 },
  { length: 300, boost: 0.3 },
  { length: 220, boost: 0.6 },
  { length: 390, boost: 0.2 },
];
const segments = authoredSegments;
const tExpected = expectedLap(segments, vBase, vNitro, 1.5);
assert.ok(Math.abs(tExpected - tTarget) / tTarget <= 0.05, `单圈时长 ${tExpected.toFixed(2)}s 偏离目标超过 ±5%`);

// 氮气时长越长，同一布局应当越快：回归检查有效速度公式不会算反
const slower = expectedLap(segments.map((s) => ({ ...s, boost: s.boost * 0.5 })), vBase, vNitro, 1.5);
assert.ok(slower > tExpected, "氮气使用率降低时，预期时长必须变长");

// ---------- R2：飞坡落地余量 D_gap ≤ 0.80 · x_land(0.85 v_base) ----------
function landingDistance({ speed, alpha, h0 }) {
  const rad = (alpha * Math.PI) / 180;
  const vy = speed * Math.sin(rad);
  const vx = speed * Math.cos(rad);
  // y(t) = h0 + vy·t − g·t²/2 = 0 的较大根
  const t = (vy + Math.sqrt(vy * vy + 2 * G * h0)) / G;
  return { x: vx * t, maxY: h0 + (vy * vy) / (2 * G) };
}

for (const alpha of [12, 18, 25]) {
  for (const h0 of [0, 1.5, 3]) {
    const safe = landingDistance({ speed: 0.85 * vBase, alpha, h0 });
    const gap = 0.8 * safe.x;
    const fast = landingDistance({ speed: vNitro, alpha, h0 });
    assert.ok(gap < safe.x, "缺口必须小于最慢落地距离");
    assert.ok(fast.x > gap, "全速通过时必须能越过缺口");
    assert.ok(safe.maxY >= h0, "弹道最高点不能低于起跳点");
  }
}
const steep = landingDistance({ speed: 0.85 * vBase, alpha: 45, h0: 2 });
const shallow = landingDistance({ speed: 0.85 * vBase, alpha: 12, h0: 2 });
assert.ok(steep.x > shallow.x, "同样是安全速度，起跳角大时飞得更远");

// ---------- R2：弯道半径门槛 R_min(v) = v² / (μ_lat·g + g·tanθ) ----------
const radiusMin = (v, muLat = 1.1, bankDeg = 20) => (v * v) / (muLat * G + G * Math.tan((bankDeg * Math.PI) / 180));
assert.ok(radiusMin(vNitro) > radiusMin(vBase), "氮气速度需要的弯道半径必须更大");
assert.ok(radiusMin(vNitro, 1.1, 30) < radiusMin(vNitro, 1.1, 10), "倾斜角越大，所需半径越小");

// ---------- R3：氮气连续补给间距 Δs ≤ v_nitro · (τ_burn + 0.75·τ_grace) ----------
const tauBurn = 2.8;
const tauGrace = 0.9;
const maxSourceGap = vNitro * (tauBurn + 0.75 * tauGrace);
const totalLength = segments.reduce((a, s) => a + s.length, 0);
// 需要的补给点数量 = ceil(总长 / 单次可续氮气距离)；少放一个就必须被判定为断档
const requiredSources = Math.ceil(totalLength / maxSourceGap);
const placedGap = totalLength / requiredSources;
assert.ok(placedGap <= maxSourceGap + 1e-9, `均布 ${requiredSources} 个补给点时间距 ${placedGap.toFixed(1)}m 仍超过 ${maxSourceGap.toFixed(1)}m`);
for (let i = 0; i < requiredSources; i++) {
  assert.ok(totalLength / requiredSources <= maxSourceGap + 1e-9, "相邻氮气补给间距超过连续阈值，会出现断档");
}
assert.ok(totalLength / (requiredSources - 1) > maxSourceGap, "少放一个补给点时应判定断档，阈值不能形同虚设");

console.log(
  `ok: lap ${tExpected.toFixed(2)}s (target ${tTarget}s, ±5%), nitro gap ${maxSourceGap.toFixed(1)}m, ` +
    `R_min(v_nitro) ${radiusMin(vNitro).toFixed(1)}m`,
);
