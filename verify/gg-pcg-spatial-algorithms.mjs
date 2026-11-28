#!/usr/bin/env node
// gg-pcg-spatial-algorithms 的无头校验：只验证生成器必须满足的几何与可达性不变量，
// 不渲染、不开浏览器。任一断言失败以退出码 1 结束。
//   node verify/gg-pcg-spatial-algorithms.mjs
import assert from "node:assert/strict";

// ---------- 确定性 PRNG：同一 GenerationSeed 必须给出同一序列 ----------
const mulberry32 = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const hashCombine = (seed, stage) => (Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ stage) >>> 0;

// ---------- 房间散布：Max-Min 曼哈顿距离，不越界、两两不重叠 ----------
const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

function scatterRooms(seed, { width, height, count, minGap }) {
  const rand = mulberry32(hashCombine(seed, 1));
  const rooms = [];
  for (let guard = 0; rooms.length < count && guard < count * 200; guard++) {
    const w = 4 + Math.floor(rand() * 5);
    const h = 4 + Math.floor(rand() * 5);
    const c = { x: Math.floor(rand() * width), y: Math.floor(rand() * height), w, h };
    if (c.x < 1 || c.y < 1 || c.x + w > width - 1 || c.y + h > height - 1) continue; // 越界丢弃
    const overlaps = rooms.some(
      (r) => c.x < r.x + r.w && r.x < c.x + c.w && c.y < r.y + r.h && r.y < c.y + c.h,
    );
    if (overlaps) continue;
    const tooClose = rooms.some((r) => manhattan(c, r) < minGap);
    if (tooClose && rooms.length > 0) continue;
    rooms.push(c);
  }
  return rooms;
}

// ---------- Kruskal 生成树 + 环路边，最小生成树边数必须为 n-1 ----------
function connectRooms(rooms, loopRatio) {
  const edges = [];
  for (let i = 0; i < rooms.length; i++)
    for (let j = i + 1; j < rooms.length; j++) edges.push({ i, j, d: manhattan(rooms[i], rooms[j]) });
  edges.sort((a, b) => a.d - b.d || a.j - b.j);
  const parent = rooms.map((_, i) => i);
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const tree = [];
  for (const e of edges) {
    const a = find(e.i);
    const b = find(e.j);
    if (a === b) continue;
    parent[a] = b;
    tree.push(e);
    if (tree.length === rooms.length - 1) break;
  }
  const loops = Math.round(tree.length * loopRatio);
  const extra = edges.filter((e) => !tree.includes(e)).slice(0, loops);
  return { tree, loops: extra };
}

// ---------- 网格：把房间与走廊刷成可走，做 3D 泛洪求连通分量 ----------
function buildGrid(rooms, links, width, height) {
  const grid = Array.from({ length: height }, () => new Array(width).fill(0));
  const carve = (x, y) => {
    if (x >= 0 && y >= 0 && x < width && y < height) grid[y][x] = 1;
  };
  for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) carve(x, y);
  const center = (r) => ({ x: r.x + (r.w >> 1), y: r.y + (r.h >> 1) });
  for (const e of links) {
    const a = center(rooms[e.i]);
    const b = center(rooms[e.j]);
    for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) carve(x, a.y);
    for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++) carve(b.x, y);
  }
  return grid;
}

function components(grid) {
  const h = grid.length;
  const w = grid[0].length;
  const seen = Array.from({ length: h }, () => new Array(w).fill(false));
  const sizes = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!grid[y][x] || seen[y][x]) continue;
      const queue = [[x, y]];
      seen[y][x] = true;
      let size = 0;
      while (queue.length) {
        const [cx, cy] = queue.pop();
        size++;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen[ny][nx] || !grid[ny][nx]) continue;
          seen[ny][nx] = true;
          queue.push([nx, ny]);
        }
      }
      sizes.push(size);
    }
  return sizes;
}

// ---------- 断言 ----------
const SEED = 20261128;
const SIZE = { width: 64, height: 64 };
const rooms = scatterRooms(SEED, { ...SIZE, count: 12, minGap: 6 });

assert.ok(rooms.length >= 6, `房间数量太少：${rooms.length}`);
for (const r of rooms) {
  assert.ok(r.x >= 1 && r.y >= 1 && r.x + r.w <= SIZE.width - 1 && r.y + r.h <= SIZE.height - 1, "房间越界");
}
for (let i = 0; i < rooms.length; i++)
  for (let j = i + 1; j < rooms.length; j++) {
    const a = rooms[i];
    const b = rooms[j];
    assert.ok(!(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h), "房间重叠");
  }

const links = connectRooms(rooms, 0.2);
assert.equal(links.tree.length, rooms.length - 1, "Kruskal 生成树边数应等于房间数 − 1");

const grid = buildGrid(rooms, [...links.tree, ...links.loops], SIZE.width, SIZE.height);
const parts = components(grid);
assert.equal(parts.length, 1, `可走区域连通分量应为 1，实际 ${parts.length}`);

// 同一 seed 两次生成完全一致（确定性契约）
assert.deepEqual(scatterRooms(SEED, { ...SIZE, count: 12, minGap: 6 }), rooms, "同一 GenerationSeed 生成结果不稳定");

console.log(
  `ok: ${rooms.length} rooms, MST ${links.tree.length} edges + ${links.loops.length} loops, ` +
    `1 walkable component (${parts[0]} tiles)`,
);
