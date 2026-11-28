#!/usr/bin/env node
// gg-audio-dsp-acoustics 的无头校验：静音过滤、F0/HNR 自相关、频谱重心与辅音起音、
// 句尾音高斜率、dBFS 边界。不依赖音频库，用合成信号验证公式实现。
//   node verify/gg-audio-dsp-acoustics.mjs
import assert from "node:assert/strict";

const FS = 16000;

// ---------- R1：静音帧过滤 + PCM 归一化 ----------
const rms16 = (frame) => {
  let acc = 0;
  for (const v of frame) acc += v * v;
  return Math.sqrt(acc / frame.length);
};
const voiced = Array.from({ length: 800 }, (_, i) => Math.round(6000 * Math.sin((2 * Math.PI * 150 * i) / FS)));
const silent = new Array(800).fill(0);
assert.ok(rms16(voiced) >= 200, "有声帧不应被当成静音");
assert.ok(rms16(silent) < 200, "静音帧必须被过滤");
const normalize = (frame) => {
  const peak = Math.max(...frame.map(Math.abs), 1e-9);
  return frame.map((v) => v / peak); // 只做幅度归一，保留波形正负
};
assert.ok(Math.max(...normalize(voiced).map(Math.abs)) <= 1 + 1e-9, "归一化后峰值不能超过 1");

// ---------- R2：自相关求 F0，clamp 后的 HNR 必须是有限值 ----------
function autocorrelationF0(signal, { minHz = 60, maxHz = 450 } = {}) {
  const lagMin = Math.floor(FS / maxHz);
  const lagMax = Math.ceil(FS / minHz);
  const peak = Math.max(...signal.map(Math.abs), 1e-9);
  const x = normalize(signal).map((v) => v / peak);
  const mean = x.reduce((a, b) => a + b, 0) / x.length;
  const c = x.map((v) => v - mean);
  // 预处理后算整段相关，再做「越界截断」的归一化，避免两段错位造成锥形衰减
  const r = [0];
  for (let lag = 1; lag <= Math.min(lagMax, c.length - 1); lag++) {
    let num = 0;
    let d1 = 0;
    let d2 = 0;
    for (let i = 0; i + lag < c.length; i++) {
      num += c[i] * c[i + lag];
      d1 += c[i] * c[i];
      d2 += c[i + lag] * c[i + lag];
    }
    r[lag] = num / Math.sqrt(d1 * d2 || 1e-12);
  }
  // 基频 = 第一个（周期最短的）足够高的局部极大；T 的整数倍处相关值同样高，不能直接取全局最大
  const threshold = 0.9;
  let best = null;
  for (let lag = Math.max(lagMin, 1); lag <= Math.min(lagMax, c.length - 1); lag++) {
    if (r[lag] > threshold && r[lag] >= r[lag - 1] && r[lag] >= (r[lag + 1] ?? -Infinity)) {
      best = { lag, r: r[lag] };
      break;
    }
  }
  if (!best) {
    let peakLag = Math.max(lagMin, 1);
    for (let lag = peakLag; lag <= Math.min(lagMax, c.length - 1); lag++) if (r[lag] > r[peakLag]) peakLag = lag;
    best = { lag: peakLag, r: r[peakLag] ?? 0 };
  }
  const clamp = (v) => Math.min(Math.max(v, 1e-6), 1 - 1e-6);
  const rc = clamp(best.r);
  return { f0: FS / best.lag, hnr: 10 * Math.log10(rc / (1 - rc)) };
}
for (const hz of [110, 150, 220, 330]) {
  const sig = Array.from({ length: 2048 }, (_, i) => Math.sin((2 * Math.PI * hz * i) / FS));
  const { f0, hnr } = autocorrelationF0(sig);
  assert.ok(Math.abs(f0 - hz) / hz < 0.05, `F0 估计偏差过大：${f0} vs ${hz}`);
  assert.ok(Number.isFinite(hnr), "HNR 必须是有限值");
}
// 边界：纯噪声也不能吐出 NaN / Infinity
const noise = Array.from({ length: 2048 }, (_, i) => Math.sin(i * 12.9898) * 0.5);
const edge = autocorrelationF0(noise);
assert.ok(Number.isFinite(edge.f0) && Number.isFinite(edge.hnr), "噪声输入必须给出有限值");
assert.ok(edge.f0 >= 60 && edge.f0 <= 450, `F0 必须夹在 60–450Hz，实际 ${edge.f0}`);

// ---------- R2：频谱重心与 2–8kHz 辅音能量占比（用解析正弦分量求和代替 FFT） ----------
function spectrumEnergy(harmonics) {
  // harmonics: [{hz, amp}] → 用 1Hz 粒度桶表示，只关心重心与比例
  const buckets = new Map();
  for (const { hz, amp } of harmonics) buckets.set(Math.round(hz), (buckets.get(Math.round(hz)) ?? 0) + amp * amp);
  return [...buckets.entries()].map(([hz, e]) => ({ hz, e }));
}
function centroid(spec) {
  const total = spec.reduce((a, s) => a + s.e, 0);
  return spec.reduce((a, s) => a + s.hz * s.e, 0) / total;
}
const consonant = spectrumEnergy([
  { hz: 200, amp: 1 },
  { hz: 1500, amp: 0.5 },
  { hz: 3000, amp: 0.8 },
  { hz: 6000, amp: 0.6 },
]);
const hiRatio = consonant.filter((s) => s.hz >= 2000 && s.hz <= 8000).reduce((a, s) => a + s.e, 0) /
  consonant.reduce((a, s) => a + s.e, 0);
assert.ok(hiRatio > 0.2, `辅音高频占比过低：${hiRatio}`);
const dark = spectrumEnergy([{ hz: 200, amp: 1 }, { hz: 400, amp: 0.3 }]);
assert.ok(centroid(consonant) > centroid(dark), "带辅音的信号重心应更高");

// ---------- R3：句尾音高斜率与半音跨度 ----------
const semis = (from, to) => 12 * Math.log2(to / from);
function tailSlope(samples, tailRatio = 0.3) {
  const tail = samples.slice(Math.floor(samples.length * (1 - tailRatio)));
  const n = tail.length;
  const xs = tail.map((_, i) => i);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = tail.reduce((a, b) => a + b, 0) / n;
  const num = xs.reduce((a, x, i) => a + (x - mx) * (tail[i] - my), 0);
  const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  return num / den;
}
const falling = Array.from({ length: 100 }, (_, i) => 300 - i);
const flat = new Array(100).fill(200);
assert.ok(tailSlope(falling) < 0, "下降句尾斜率应为负");
assert.ok(Math.abs(tailSlope(flat)) < 1e-9, "平音句尾斜率应为 0");
assert.ok(Math.abs(semis(200, 400) - 12) < 1e-9, "倍频应等于 12 个半音");
assert.ok(Number.isFinite(semis(0.0001, 1)), "极小基频也必须给出有限值");

// ---------- R3：dBFS 边界，禁止 NaN / -Infinity ----------
const dbfs = (v) => 20 * Math.log10(Math.max(Math.abs(v), 1e-5));
assert.equal(dbfs(0), -100, "全零振幅应夹到 −100 dB");
for (const v of [0, 1e-12, 1e-5, 0.5, 1]) {
  const d = dbfs(v);
  assert.ok(Number.isFinite(d), `dBFS 出现非有限值：${v}`);
  assert.ok(d >= -100 - 1e-9 && d <= 0 + 1e-9, `dBFS 越界：${d}`);
}

console.log("ok: F0/HNR bounded, centroid ordering holds, tail slope signed, dBFS in [-100, 0]");
