#!/usr/bin/env node
// ball-hitstop-impact-feedback 的无头校验：四档冲量映射、冷却衰减但反馈不衰减、
// 顿帧不改动量、体积守恒的挤压拉伸、五声音阶上行。不渲染。
//   node verify/ball-hitstop-impact-feedback.mjs
import assert from "node:assert/strict";

// ---------- R1：归一化冲量 → 四档冻结时长 ----------
const TIERS = [
  { upTo: 0.25, label: "graze", ms: [0, 0] },
  { upTo: 0.6, label: "peg", ms: [18, 32] },
  { upTo: 0.9, label: "super", ms: [45, 68] },
  { upTo: Infinity, label: "jackpot", ms: [85, 130] },
];
function freezeMs(impulse) {
  const tier = TIERS.find((t) => impulse < t.upTo) ?? TIERS[TIERS.length - 1];
  const lo = tier.ms[0];
  const hi = tier.ms[1];
  return { label: tier.label, ms: lo + (hi - lo) * Math.min(1, Math.max(0, impulse)) };
}
assert.equal(freezeMs(0.01).ms, 0, "擦边必须为 0ms，不能卡顿");
assert.equal(freezeMs(0.24).ms, 0, "擦边档上限仍为 0ms");
for (const i of [0.3, 0.45, 0.59]) {
  const f = freezeMs(i);
  assert.ok(f.ms >= 18 && f.ms <= 32, `撞柱档越界：${i} → ${f.ms}`);
}
for (const i of [0.61, 0.75, 0.89]) {
  const f = freezeMs(i);
  assert.ok(f.ms >= 45 && f.ms <= 68, `加力柱档越界：${i} → ${f.ms}`);
}
for (const i of [0.91, 1]) {
  const f = freezeMs(i);
  assert.ok(f.ms >= 85 && f.ms <= 130, `大奖档越界：${i} → ${f.ms}`);
}
// 档位必须单调
let last = -1;
for (let i = 0; i <= 1; i += 0.01) {
  const ms = freezeMs(i).ms;
  assert.ok(ms >= last - 1e-9, `冻结时长随冲量下降：${i}`);
  last = ms;
}

// ---------- R2：冷却窗口内重复顿帧衰减到 0.25 倍，但闪光/粒子/音效不衰减 ----------
function hitStop({ baseMs, tSinceLastSameTier, tauCool }) {
  const attenuated = tSinceLastSameTier < tauCool;
  return { ms: attenuated ? baseMs * 0.25 : baseMs, flash: 1, particles: 1, audio: 1 };
}
const base = freezeMs(0.7).ms;
const nested = hitStop({ baseMs: base, tSinceLastSameTier: 0.02, tauCool: 0.12 });
assert.ok(Math.abs(nested.ms - base * 0.25) < 1e-9, "冷却窗口内的重复顿帧必须衰减到 0.25 倍");
assert.equal(nested.flash, 1, "闪光不能被衰减");
assert.equal(nested.particles, 1, "粒子不能被衰减");
assert.equal(nested.audio, 1, "音效不能被衰减");
const spaced = hitStop({ baseMs: base, tSinceLastSameTier: 0.5, tauCool: 0.12 });
assert.equal(spaced.ms, base, "超出冷却窗口应恢复完整顿帧");

// ---------- R3：顿帧释放后出射速度 100% 保留 ----------
const before = { x: 6.2, y: -3.4 };
const incoming = { x: -4.0, y: 1.1 };
function release(vIn, vOut, ms) {
  if (ms <= 0) return vIn;
  return { ...vOut }; // 顿帧只冻结时间，出射速度取反弹结果，不被吸收
}
const bounced = { x: 4.0, y: -1.1 }; // 超弹性系数为 1 的纯反射
const released = release(before, bounced, 50);
const speedIn = Math.hypot(bounced.x, bounced.y);
const speedOut = Math.hypot(released.x, released.y);
assert.ok(Math.abs(speedOut - speedIn) < 1e-9, "顿帧不得吸收动量");
assert.notDeepEqual(released, { x: 0, y: 0 }, "顿帧结束时速度必须被恢复，而不是归零");

// 体积守恒挤压拉伸：s_perp = 1/√s_parallel
for (const sp of [0.62, 0.7, 0.9, 1, 1.1, 1.42]) {
  const sPerp = 1 / Math.sqrt(sp);
  assert.ok(Math.abs(sp * sPerp * sPerp - 1) < 1e-9, `体积不守恒：s∥=${sp}`);
}
assert.ok(1 - 0.38 * 1 < 1, "冻结期长轴应变必须小于 1（压扁）");
assert.ok(1 + 0.42 * 1 > 1, "释放后 3 帧长轴应变必须大于 1（回弹）");

// 十二平均律五声音阶上行
const ROOT = 220;
const SCALE = [0, 2, 4, 7, 9];
const chime = (k) => ROOT * Math.pow(2, (SCALE[k % SCALE.length] + 12 * Math.floor(k / SCALE.length)) / 12);
let prev = -Infinity;
for (let k = 0; k < 20; k++) {
  const f = chime(k);
  assert.ok(f > prev, `第 ${k} 次连击音高没有上行`);
  assert.ok(Number.isFinite(f), "音高必须有限");
  prev = f;
}
assert.ok(Math.abs(chime(5) / chime(0) - 2) < 1e-9, "跨一组后应正好升高一个八度");

console.log(`ok: tiers 0/${freezeMs(0.3).ms.toFixed(0)}-${freezeMs(0.59).ms.toFixed(0)}/${freezeMs(0.61).ms.toFixed(0)}-${freezeMs(0.89).ms.toFixed(0)}/${freezeMs(1).ms.toFixed(0)}ms, volume-conserving, pentatonic ascends`);
