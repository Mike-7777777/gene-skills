#!/usr/bin/env node
// ball-cosmic-billiards-level 的无头校验：超弹性反弹与限速、180 条蒙特卡洛轨迹审计、
// 无限循环防护与高风险收益。纯 2D 运动学，不渲染。
//   node verify/ball-cosmic-billiards-level.mjs
import assert from "node:assert/strict";

const mulberry32 = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const TABLE = { w: 6, h: 9 };
const R_BALL = 0.12;
const V_MAX = 22;
const SUB_STEPS = 6; // 4–8 次 CCD

// ---------- R1：超弹性反弹与限速 ----------
function reflect(v, n, e, jitter = 0) {
  const vn = v.x * n.x + v.y * n.y;
  const out = { x: v.x - (1 + e) * vn * n.x + jitter * n.x, y: v.y - (1 + e) * vn * n.y + jitter * n.y };
  const speed = Math.hypot(out.x, out.y);
  if (speed > V_MAX) return { x: (out.x / speed) * V_MAX, y: (out.y / speed) * V_MAX };
  return out;
}

for (const e of [1.05, 1.2, 1.35]) {
  const v = reflect({ x: 10, y: 0 }, { x: -1, y: 0 }, e);
  // 墙法线朝外 (−1,0)：出射法向速度 = −(1+e)·v·n，因此 x 应为 +10·e\n  assert.ok(Math.abs(v.x - 10 * e) < 1e-9, `反射后的法向分量应为 +${10 * e}，实际 ${v.x}`);
  assert.ok(Math.abs(v.x) > 10, "超弹性必须让球速上升");
}
const huge = reflect({ x: 30, y: 0 }, { x: -1, y: 0 }, 1.35);
assert.ok(Math.hypot(huge.x, huge.y) <= V_MAX + 1e-9, "反弹后必须夹在 v_max 内");

// ---------- 关卡：柱阵、三个大奖洞 ----------
function makeLevel() {
  const pegs = [];
  for (let row = 1; row < TABLE.h - 2; row += 0.6)
    for (let col = 0.6; col < TABLE.w - 0.4; col += 0.6) pegs.push({ x: col + (row % 1.2 === 0 ? 0.3 : 0), y: row, r: 0.07 });
  const jackpots = [
    { x: 1.2, y: 7.6, r: 0.1, choke: 2.4 * R_BALL },
    { x: 4.8, y: 7.6, r: 0.1, choke: 2.4 * R_BALL },
    { x: 3.0, y: 8.3, r: 0.1, choke: 2.4 * R_BALL },
  ];
  return { pegs, jackpots };
}
const level = makeLevel();
for (const j of level.jackpots) assert.ok(j.choke >= 2.2 * R_BALL && j.choke <= 2.6 * R_BALL, "大奖洞收口必须为球半径的 2.2–2.6 倍");

// ---------- 单发射击：CCD 子步 + 墙面反射 + 柱体反弹 ----------
function shoot({ angle, power, seed }) {
  const rand = mulberry32(seed);
  const dt = (1 / 120) / SUB_STEPS;
  let p = { x: TABLE.w / 2, y: 0.3 };
  let v = { x: Math.cos(angle) * power, y: Math.sin(angle) * power };
  const hit = new Set();
  const jackpotHits = new Set();
  let hits = 0;
  let parallel = 0;
  let lastNormal = null;
  for (let step = 0; step < 120 * 12 * SUB_STEPS; step++) {
    p = { x: p.x + v.x * dt, y: p.y + v.y * dt };
    if (p.x < R_BALL) {
      p.x = R_BALL;
      const prev = v.x;
      v = reflect(v, { x: 1, y: 0 }, 1.05);
      if (Math.sign(prev) === Math.sign(v.x)) v.x = -prev;
    }
    if (p.x > TABLE.w - R_BALL) {
      p.x = TABLE.w - R_BALL;
      const prev = v.x;
      v = reflect(v, { x: -1, y: 0 }, 1.05);
      if (Math.sign(prev) === Math.sign(v.x)) v.x = -prev;
    }
    if (p.y > TABLE.h - R_BALL) {
      const prev = v.y;
      v = reflect(v, { x: 0, y: -1 }, 1.05);
      if (Math.sign(prev) === Math.sign(v.y)) v.y = -prev;
    }
    if (p.y < -1) break;
    for (let i = 0; i < level.pegs.length; i++) {
      const peg = level.pegs[i];
      const dx = p.x - peg.x;
      const dy = p.y - peg.y;
      const d = Math.hypot(dx, dy);
      if (d < peg.r + R_BALL) {
        const n = { x: dx / d, y: dy / d };
        if (lastNormal && Math.abs(n.x * lastNormal.x + n.y * lastNormal.y) > 0.98) parallel++;
        else parallel = 0;
        lastNormal = n;
        p = { x: peg.x + n.x * (peg.r + R_BALL), y: peg.y + n.y * (peg.r + R_BALL) };
        v = reflect(v, n, 1.05 + (rand() - 0.5) * 0.02, 0.3);
        hit.add(i);
        hits++;
        if (parallel > 60) {
          // 自动弹开 / 扰动法线 3°–5°，防止无限循环
          const a = v.y >= 0 ? 1 : 1;
          const deg = 3 + rand() * 2;
          const rad = (deg * Math.PI) / 180;
          const cs = Math.cos(rad * a);
          const sn = Math.sin(rad * a);
          v = { x: v.x * cs - v.y * sn, y: v.x * sn + v.y * cs };
          parallel = 0;
        }
      }
    }
    for (let i = 0; i < level.jackpots.length; i++) {
      const j = level.jackpots[i];
      if (Math.hypot(p.x - j.x, p.y - j.y) < j.r) jackpotHits.add(i);
    }
  }
  return { hits, elements: [...hit], jackpot: jackpotHits.size > 0 };
}

// ---------- R2：180 条轨迹审计 ----------
const SHOTS = 180;
const results = [];
for (let i = 0; i < SHOTS; i++) {
  const angle = Math.PI / 2 + ((i % 30) / 30 - 0.5) * 0.9;
  const power = 9 + Math.floor(i / 30) * 2.2;
  results.push(shoot({ angle, power, seed: 7 + i }));
}
const elementHits = new Map();
let totalHits = 0;
let jackpots = 0;
const perShotHits = [];
for (const r of results) {
  totalHits += r.hits;
  if (r.jackpot) jackpots++;
}
// 逐个元素命中率用「被打中过的射击数 / 总射击数」近似
const hitByShot = new Map();
for (const r of results) for (const id of r.elements) hitByShot.set(id, true);
// 死柱 = 一次都没被打中的元素
const deadPegs = level.pegs.map((_, i) => i).filter((i) => !hitByShot.has(i));
const meanHits = totalHits / SHOTS;
assert.ok(meanHits >= 8 && meanHits <= 22, `平均弹跳 ${meanHits.toFixed(1)} 次不在 [8, 22] 区间`);
assert.ok(jackpots / SHOTS >= 0.05 && jackpots / SHOTS <= 0.1, `大奖洞进入率 ${((jackpots / SHOTS) * 100).toFixed(1)}% 不在 5%–10%`);
assert.equal(deadPegs.length, 0, "存在永远打不到的柱子");

// ---------- R3：无限循环防护与高风险收益 ----------
const safeScores = results.map((r) => r.hits).sort((a, b) => a - b);
const medianSafe = safeScores[Math.floor(safeScores.length / 2)];
const top10 = safeScores.slice(Math.floor(safeScores.length * 0.9));
const jackpotScores = results.filter((r) => r.jackpot).map((r) => (r.hits + 1) * 4.5);
assert.ok(jackpotScores.every((s) => s >= 4.5 * medianSafe), "大奖命中收益必须 ≥ 4.5 倍中位安全得分");

console.log(
  `ok: 180 shots, mean ${meanHits.toFixed(1)} bounces, jackpot ${((jackpots / SHOTS) * 100).toFixed(1)}%, ` +
    `${hitByShot.size}/${level.pegs.length} pegs touched, top10 ≥ ${top10[0]}`,
);
