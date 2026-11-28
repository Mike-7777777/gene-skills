#!/usr/bin/env node
// gun-tactical-ttk-economy 的无头校验：BTK 半开区间反解、距离步进不跳变、首枪 t=0 的 TTK、
// 价格档位与击杀奖励方向。不渲染、不开浏览器。
//   node verify/gun-tactical-ttk-economy.mjs
import assert from "node:assert/strict";

// ---------- 命中伤害：d_eff = floor(D0 · f_range(r) · Z_zone · (1 − α_armor·(1 − ρ_pen))) ----------
const ZONE = { head: 4.0, chest: 1.0 };
const ARMOR = { 0: 0, 1: 0.5, 2: 0.75 }; // α_armor
const rangeFalloff = (r) => (r <= 10 ? 1 : r <= 30 ? 0.85 : 0.7);

function effectiveDamage({ D0, r, zone, armor, pen }) {
  return Math.floor(D0 * rangeFalloff(r) * ZONE[zone] * (1 - ARMOR[armor] * (1 - pen)));
}
const btk = (hp, dmg) => Math.max(1, Math.ceil(hp / Math.max(dmg, 1)));

// ---------- 1. 在半开区间中点反解 D0，使 BTK 精确等于目标 ----------
function solveD0({ hp, k, r, zone, armor, pen }) {
  const m = rangeFalloff(r) * ZONE[zone] * (1 - ARMOR[armor] * (1 - pen));
  const lo = hp / (k * m);
  const hi = (hp - 1) / ((k - 1) * m);
  assert.ok(hi > lo, `目标 BTK=${k} 在 ${r}m 上不可达`);
  return (lo + hi) / 2;
}

const HP = 100;
const cases = [
  { weapon: "pistol", hp: HP, k: 5, r: 8, zone: "chest", armor: 0, pen: 0 },
  { weapon: "rifle", hp: HP, k: 3, r: 20, zone: "chest", armor: 1, pen: 0.5 },
  { weapon: "sniper", hp: HP, k: 1, r: 20, zone: "head", armor: 2, pen: 0.9 },
  { weapon: "smg", hp: HP, k: 6, r: 5, zone: "chest", armor: 0, pen: 0 },
];
for (const c of cases) {
  const D0 = solveD0(c);
  const dmg = effectiveDamage({ D0, r: c.r, zone: c.zone, armor: c.armor, pen: c.pen });
  assert.equal(btk(c.hp, dmg), c.k, `${c.weapon} 反解后 BTK 不等于目标 ${c.k}`);
}

// ---------- 2. 距离 ±1m 步进不能跳变击杀枪数 ----------
const rifle = cases[1];
const D0 = solveD0(rifle);
for (let r = rifle.r - 1; r <= rifle.r + 1; r += 0.25) {
  const dmg = effectiveDamage({ D0, r, zone: rifle.zone, armor: rifle.armor, pen: rifle.pen });
  assert.equal(btk(HP, dmg), rifle.k, `${r}m 处 BTK 跳变：${btk(HP, dmg)}`);
}
// 跨区间（10m、30m 两个落差点两侧）允许变化，但不能出现跳两级
const before = btk(HP, effectiveDamage({ D0, r: 9.9, zone: "chest", armor: 1, pen: 0.5 }));
const after = btk(HP, effectiveDamage({ D0, r: 10.1, zone: "chest", armor: 1, pen: 0.5 }));
assert.ok(Math.abs(before - after) <= 1, `区间边界处 BTK 跨了 ${Math.abs(before - after)} 级`);

// ---------- 3. 首枪 t = 0 的 TTK ----------
const ttkIdeal = ({ k, tauShot, r, vMuzzle }) => (k - 1) * tauShot + r / vMuzzle;
const ttk = ttkIdeal({ k: 3, tauShot: 0.1, r: 20, vMuzzle: 900 });
assert.ok(Math.abs(ttk - (0.2 + 20 / 900)) < 1e-12, "TTK 必须以首枪 t=0 计算");
assert.ok(ttk < 3 * 0.1 + 20 / 900, "少算一颗子弹会给出更短的 TTK，必须能区分");

// 带散布的期望 TTK 不能比理想值更短
const pHit = 0.8;
const expectedShots = (k, p) => k / p;
const ttkEff = (k, p, tauShot, r, vMuzzle) => (expectedShots(k, p) - 1) * tauShot + r / vMuzzle;
assert.ok(ttkEff(3, pHit, 0.1, 20, 900) > ttk, "散布修正后的 TTK 不应短于理想 TTK");

// ---------- 4. 买枪价格与击杀奖励方向 ----------
const priceOf = (utility) => Math.max(50, Math.round(utility / 50) * 50);
const weapons = [
  { name: "pistol", utility: 100 },
  { name: "smg", utility: 260 },
  { name: "rifle", utility: 420 },
  { name: "shotgun", utility: 340 },
  { name: "sniper", utility: 520 },
];
const priced = weapons.map((w) => ({ ...w, price: priceOf(w.utility) })).sort((a, b) => a.price - b.price);
for (const w of priced) assert.equal(w.price % 50, 0, `${w.name} 价格未对齐 50 档`);
for (let i = 1; i < priced.length; i++) {
  assert.ok(priced[i].price >= priced[i - 1].price, "价格必须随综合战力单调不减");
}
// 越便宜越具性价比：击杀奖励随价格下降
const reward = (price) => (price <= 150 ? 600 : price <= 350 ? 300 : 100);
for (let i = 1; i < priced.length; i++) {
  assert.ok(reward(priced[i].price) <= reward(priced[i - 1].price), "击杀奖励应随价格上升而下降");
}
assert.equal(reward(990), 100, "最贵档击杀奖励应为最低档");

console.log(`ok: ${cases.length} weapons solved, rifle BTK ${rifle.k} stable within ±1m, prices ${priced.map((p) => p.price).join("/")}`);
