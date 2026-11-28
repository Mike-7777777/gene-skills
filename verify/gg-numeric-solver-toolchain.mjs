#!/usr/bin/env node
// gg-numeric-solver-toolchain 的无头校验：属性预算分配、逆推权重、双向击杀时间。
// 任一断言失败以退出码 1 结束。
//   node verify/gg-numeric-solver-toolchain.mjs
import assert from "node:assert/strict";

const round2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;
const roundHalfUp = (x) => Math.floor(x + 0.5);

// ---------- 1. 正向分配：RawStat = C·w_i/r_i，FinalStat = min(RawStat, M_i) ----------
function allocate({ C, weights, rates, caps }) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  // Σw_i ≤ 1（浮点累加 0.4+0.35+0.25 会得到 1.0000000000000002）\n  assert.ok(total <= 1 + 1e-9, `Σw_i 必须 ≤ 1，实际 ${total}`);
  const out = {};
  for (const [k, w] of Object.entries(weights)) out[k] = Math.min((C * w) / rates[k], caps[k]);
  return out;
}

const budget = { C: 100, weights: { hp: 0.4, atk: 0.35, def: 0.25 }, rates: { hp: 1, atk: 2, def: 2.5 }, caps: { hp: 60, atk: 40, def: 20 } };
const allocated = allocate(budget);
for (const [k, v] of Object.entries(allocated)) assert.ok(v <= budget.caps[k] + 1e-9, `${k} 超过上限`);
assert.equal(allocated.hp, 40);
assert.equal(allocated.atk, 17.5);
assert.equal(allocated.def, 10);
// 预算不足时不能把被截断的部分漏到别的属性上
const clamped = allocate({ C: 400, weights: { hp: 0.5, atk: 0.5 }, rates: { hp: 1, atk: 1 }, caps: { hp: 10, atk: 10 } });
assert.deepEqual(clamped, { hp: 10, atk: 10 }, "超预算必须夹在上限内");

// ---------- 2. 逆推：A_raw = V_i·r_i·100/C，归一后总和必须回到 100 − c_fx ----------
function reverseAllocation(targets, rates, C, fxBudget) {
  const raw = Object.fromEntries(Object.entries(targets).map(([k, v]) => [k, (v * rates[k] * 100) / C]));
  const sum = Object.values(raw).reduce((a, b) => a + b, 0);
  const normalized = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, round2((v * (100 - fxBudget)) / sum)]));
  return { raw, normalized };
}

const reversed = reverseAllocation({ hp: 40, atk: 17.5, def: 10 }, budget.rates, budget.C, 0);
assert.deepEqual(reversed.normalized, { hp: 40, atk: 35, def: 25 });
const withFx = reverseAllocation({ hp: 40, atk: 17.5, def: 10 }, budget.rates, budget.C, 10);
const fxSum = Object.values(withFx.normalized).reduce((a, b) => a + b, 0);
assert.ok(Math.abs(fxSum - 90) < 0.05, `归一后总和应约为 90，实际 ${fxSum}`);
// ROUND_HALF_UP 回导必须零差异
const reexport = Object.fromEntries(Object.entries(withFx.normalized).map(([k, v]) => [k, roundHalfUp(v * 100) / 100]));
assert.deepEqual(reexport, withFx.normalized, "回导出现尾差");

// ---------- 3. 双向 TTK 与整数击杀次数 ----------
function maxHealth({ playerDps, targetTtk, damageReduction, difficulty }) {
  return roundHalfUp(playerDps * targetTtk * (1 - damageReduction) * difficulty);
}
const hp = maxHealth({ playerDps: 23, targetTtk: 6, damageReduction: 0.15, difficulty: 1 });
const actualTtk = hp / (23 * (1 - 0.15));
assert.ok(Math.abs(actualTtk - 6) / 6 <= 0.15, `击杀时间偏离目标超过 ±15%：${actualTtk}`);
assert.equal(hp % 1, 0, "怪物血量必须是整数");

function rawAttack({ playerMaxHp, killHits, playerDamage }) {
  return Math.ceil(playerMaxHp / killHits) + playerDamage;
}
const atk = rawAttack({ playerMaxHp: 120, killHits: 5, playerDamage: 6 });
assert.equal(Math.ceil(120 / (atk - 6)), 5, "按反推攻击力复算击杀次数应回到 5 次");

// 资源血量必须是 Tier-1 工具伤害的整数倍（不出现"剩 1 滴血"）
const toolDamage = [7, 9, 11];
for (const d0 of toolDamage) {
  for (const base of [30, 45, 60]) {
    const snapped = Math.max(1, Math.ceil(base / d0)) * d0; // 向上对齐到整数倍，最少一击
    assert.equal(snapped % d0, 0, "资源血量未对齐 Tier-1 工具伤害");
    assert.ok(snapped >= base, "对齐后血量不应低于原值");
  }
}

console.log(`ok: budget ${JSON.stringify(allocated)}, reverse sum ${fxSum}, hp ${hp} (ttk ${actualTtk.toFixed(2)}s), atk ${atk}`);
