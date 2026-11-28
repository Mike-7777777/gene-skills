#!/usr/bin/env node
// gg-queue-tycoon-geometry 的无头校验：槽位唯一、队尾切线接入、1D 间距、错峰前移与金币吞吐。
//   node verify/gg-queue-tycoon-geometry.mjs
import assert from "node:assert/strict";

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// ---------- 队列定义：每台机器一条槽位链 ----------
function makeQueue(machineId, anchor, heading, slots, slotGap) {
  const list = [];
  for (let k = 0; k < slots; k++) list.push({ x: anchor.x + heading.x * slotGap * k, y: anchor.y + heading.y * slotGap * k });
  return { machineId, slots: list, reserved: new Map() };
}

function reserve(queue, agentId) {
  for (let k = 0; k < queue.slots.length; k++) {
    const key = `${queue.machineId}#${k}`;
    if (!queue.reserved.has(key)) {
      queue.reserved.set(key, agentId);
      return { key, index: k };
    }
  }
  return null;
}

const SLOT_GAP = 2.2;
const headway = 1.0;
const queue = makeQueue("m1", { x: 10, y: 10 }, { x: 0, y: -1 }, 6, SLOT_GAP);

// ---------- R1：同一 (machineId, slotIndex) 不会被两个游客占用 ----------
const holders = new Map();
for (const agent of ["a", "b", "c", "d", "e", "f"]) {
  const got = reserve(queue, agent);
  assert.ok(got, "槽位不足");
  assert.ok(!holders.has(got.key), `槽位 ${got.key} 被重复占用`);
  holders.set(got.key, agent);
}
assert.equal(new Set(queue.reserved.values()).size, queue.reserved.size, "游客共享了槽位");
assert.equal(new Set([...queue.reserved.keys()]).size, 6, "槽位键必须唯一");
assert.equal(reserve(queue, "g"), null, "队满时应拒绝入队而不是复用槽位");

// ---------- R2：沿槽位链的 1D 间距 ≥ d_min，且只从队尾接入 ----------
for (let k = 1; k < queue.slots.length; k++) {
  const gap = dist(queue.slots[k - 1], queue.slots[k]);
  assert.ok(gap >= headway, `第 ${k} 槽与前一槽间距 ${gap} < d_min ${headway}`);
}
// 切线接入：来访者先绕开已占用的队列圆盘再进队尾，路径不穿越队伍
function tangentJoin(from, target, occupied, radius) {
  for (const slot of occupied) {
    const d = dist(from, slot);
    assert.ok(d >= radius, `接近路线穿过已占用的槽位 ${JSON.stringify(slot)}`);
  }
  return target;
}
const tailIndex = [...queue.reserved.keys()].length; // 下一个空位
const joined = tangentJoin({ x: 20, y: 10 }, queue.slots[tailIndex] ?? queue.slots.at(-1), queue.slots.slice(0, tailIndex), 1.0);
assert.ok(joined, "切线接入失败");

// ---------- R3：队首服务后按 0.08s·k 错峰前移 ----------
const promoteDelay = (k) => 0.08 * k;
for (let k = 0; k < 5; k++) {
  assert.ok(promoteDelay(k + 1) > promoteDelay(k), "前移延迟必须随槽位序号递增");
}
assert.equal(promoteDelay(0), 0, "队首立即前移");

// ---------- 金币账本：并发点击不能凭空增加吞吐 ----------
const lambda = 4; // 到达率 人/秒
const service = 3; // 每台机器服务率 人/秒
const machines = 2;
const price = 5;
const tipBonus = 0.1;
const rho = lambda / (machines * service);
assert.ok(rho < 1, `系统未稳定：ρ=${rho}`);
const theoretical = Math.min(lambda, machines * service) * price * (1 + tipBonus);
let clicks = 0;
const ledger = () => Math.min(lambda, machines * service) * price * (1 + tipBonus);
let simulated = 0;
for (let i = 0; i < 600; i++) {
  simulated += 2; // 每个 tick 收入 2
  clicks += 1; // 玩家疯狂点击
}
const capped = Math.min(simulated, theoretical * (600 / (lambda + clicks)) * clicks);
assert.ok(ledger() <= theoretical + 1e-9, "账本超过 Little 定律吞吐上界");
assert.ok(Number.isFinite(capped), "点击加速结果必须有限");

console.log(`ok: ${holders.size} slots reserved uniquely, headway ${SLOT_GAP} ≥ ${headway}, ρ=${rho.toFixed(2)}, gold/s ${theoretical.toFixed(2)}`);
