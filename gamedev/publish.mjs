#!/usr/bin/env node
// Build and publish the Gene (with its Capsule) that pins skills/gamedev-agent-skills, from the node this machine's
// Evolver is signed in as. The Capsule records the router's routing tables and the list of shipped skills, read from
// the exact files Evolver installs; the Gene's validation checks that every route lands on a shipped skill.
//
//   node gamedev/publish.mjs            build, check, write gene.json / capsule.json, change nothing on the Hub
//   node gamedev/publish.mjs --apply    publish them, then read the Gene back
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assetLookup, ciAttestation, connect } from '../republish/lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const COMMIT = '26ba90f45ac2a7758aedaece11aa2317105e45b9';
const SHA256 = '1aaa8e96a8548de48bfe919c57c1faf138064e38068a0d3d59a3e06f81296559';
const PIN = `skill:git+https://github.com/Mike-7777777/gene-skills@${COMMIT}#sha256=${SHA256}&path=skills/gamedev-agent-skills`;
const UPSTREAM = { repo: 'https://github.com/gamedev-skills/awesome-gamedev-agent-skills', commit: 'c6ca6c41c839b68319ffc08430b99ab768debc32', license: 'Apache-2.0' };

const apply = process.argv.includes('--apply');
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
mkdirSync(join(HERE, 'logs'), { recursive: true });
const logFile = join(HERE, 'logs', `publish_${stamp}.log`);
const log = (line = '') => { console.log(line); appendFileSync(logFile, `${line}\n`); };
const fail = (why, next) => { log(`\n停止：${why}`); if (next) log(`下一步：${next}`); log(`日志：${logFile}`); process.exit(1); };

log(`${apply ? '执行' : '预览（不改 hub 上任何东西）'}  ${new Date().toISOString()}`);
const evolver = await connect(fail);
const { wire, skill, stripHubDeliveryMetadataForIntegrity, sender, http, envelope } = evolver;
log(`evolver ${evolver.version}，当前登录节点：${sender}`);
const attest = ciAttestation();
log(attest ? 'CI 认证 key：已找到，发布请求带签名' : 'CI 认证 key：没有，新人节点发布先为 candidate');

// ── 1. Fetch the skill exactly as Evolver installs it ────────────────────────────────────────────────────────────
const VALIDATION = [
  // Every engine root, discipline, genre and workflow the router names must be a shipped skill directory.
  "node -e \"const k=JSON.parse(JSON.parse(require('fs').readFileSync(process.argv.find(a=>String(a).endsWith('.json')),'utf8')).content);const c=k.catalog;const r=k.routing;const names=new Set(c.map(p=>p.split('/').pop()));const hit=root=>{const x=root.endsWith('/')?root.slice(0,-1):root;return x.endsWith('*')?c.some(p=>p.startsWith(x.slice(0,-1))):c.some(p=>p===x||p.startsWith(x+'/'))};const engines=r.engines.length===12&&new Set(r.engines.map(e=>e.engine)).size===12&&r.engines.every(e=>e.signal&&hit(e.root));const named=[...r.disciplines,...r.genres,...r.workflows].every(n=>names.has(n));const sizes=r.disciplines.length===15&&r.genres.length===9&&r.workflows.length===5;const s=k.required_skill;const hex=(v,n)=>v.length===n&&[...v].every(ch=>'0123456789abcdef'.includes(ch));const pin=hex(s.commit,40)&&hex(s.sha256,64)&&s.skill_md.startsWith('---'+String.fromCharCode(10)+'name: router');process.exit(c.length===79&&new Set(c).size===79&&engines&&named&&sizes&&pin?0:1)\"",
];
const gene = {
  id: 'gene_gamedev_agent_skills_engine_router_v1',
  type: 'Gene',
  domain: 'game_dev',
  summary: '用 AI 编程助手做游戏或改游戏时的总入口：先从项目文件识别引擎和版本（Godot、Unity、Unreal、Ebitengine、Bevy、Phaser、PixiJS、three.js、Defold、LÖVE、pygame、Roblox），再按需求选出最小的一组专项 skill（引擎 API、AI、存档、着色器、关卡、UI、音频等 15 个方向，平台跳跃、肉鸽、RPG 等 9 种类型，Game Jam、Steam/itch 发布等 5 个流程），读完再动手。收录 awesome-gamedev-agent-skills 的 router 和 79 个在真实引擎上核对过的 skill。Routes any game-dev request to the right engine and skills before writing code.',
  category: 'innovate',
  metadata: {
    tags: ['game-dev', 'engine-detection', 'skill-router', 'godot', 'unity', 'unreal', 'threejs', 'phaser', 'roblox', 'bevy', 'pygame'],
    skills_commit: COMMIT,
  },
  strategy: [
    '先按前置条件安装 skill gamedev-agent-skills，读入口 SKILL.md（router），具体规则以它为准；skills/ 下的专项 skill 按需再读。',
    '从项目文件识别唯一的引擎并读出锁定版本（如 project.godot、ProjectVersion.txt、package.json 里的 phaser 或 three），已有项目沿用它的版本，不按最新 API 写。',
    '按需求词归类：引擎 skill 加方向（AI、存档、着色器、镜头、UI 等）、至多一种类型、需要时加流程，只打开选中的 SKILL.md，references 用到再读。',
    '按引擎基础、方向概念、类型、流程的顺序组合动手；目录里没有的引擎或 API 以项目里的证据为准并写明缺口，任务换引擎或换方向时再路由一次。',
  ],
  preconditions: [PIN],
  signals_match: [
    '做游戏', '用AI做游戏', '游戏开发', '选哪个游戏开发skill', '识别游戏引擎', '游戏引擎版本',
    'Godot游戏', 'Unity游戏', 'Unreal游戏', 'three.js游戏', 'Phaser游戏', 'Roblox游戏', 'pygame游戏', 'Bevy游戏',
    'make a game', 'game dev skill router', 'which gamedev skill', 'game engine detection',
  ],
  schema_version: '1.13.0',
  validation: VALIDATION,
};

const pins = skill.requiredSkillsOf(gene);
if (!pins.ok || pins.value.length !== 1) fail(`skill 引用读不出来：${pins.message ?? ''}`);
let files;
for (let attempt = 1; attempt <= 4; attempt++) {
  files = await skill.fetchSkillFiles(pins.value[0]);
  if (files.ok) break;
  await new Promise((done) => setTimeout(done, 5_000 * attempt));
}
if (!files.ok) fail(`取不到 skill：${files.message}`, '确认 commit 已推到 GitHub 且能访问 github.com 后重跑。');
if (skill.digestOfSkillFiles(files.value) !== SHA256) fail('skill 内容摘要和引用不一致。');
const text = (path) => Buffer.from(files.value.find((f) => f.path === path).content).toString('utf8');
const skillMd = text('SKILL.md');
const catalog = files.value.map((f) => f.path).filter((p) => p.startsWith('skills/') && p.endsWith('/SKILL.md')).map((p) => p.slice(0, -'/SKILL.md'.length)).sort();
log(`skill gamedev-agent-skills：${files.value.length} 个文件，摘要一致，专项 skill ${catalog.length} 个`);

// ── 2. Read the routing tables out of the router ─────────────────────────────────────────────────────────────────
const strip = (cell) => cell.replace(/\*\*/g, '').replace(/`/g, '').trim();
const engines = [...skillMd.matchAll(/^\| *(\d+) *\| *([^|]+?) *\| *([^|]+?) *\| *`([^`]+)` *\|$/gm)]
  .map(([, , engine, signal, root]) => ({ engine: strip(engine), signal: strip(signal), root }));
const listAfter = (label) => {
  const at = skillMd.indexOf(`- **${label}**`);
  const block = skillMd.slice(at, skillMd.indexOf('Triggered by', at));
  return [...block.matchAll(/`([a-z0-9-]+)`/g)].map((m) => m[1]);
};
const routing = { engines, disciplines: listAfter('disciplines'), genres: listAfter('genres'), workflows: listAfter('workflows') };
log(`路由表：引擎 ${engines.length} 个，方向 ${routing.disciplines.length} 个，类型 ${routing.genres.length} 种，流程 ${routing.workflows.length} 个`);

const geneId = wire.computeAssetId(gene);
if (wire.computeAssetId(stripHubDeliveryMetadataForIntegrity({ ...gene, asset_id: geneId })) !== geneId) fail('发布后 evolver 会校验不过这个 Gene。');
const { name, repo, commit, path, sha256 } = pins.value[0];
const capsuleBody = {
  gene: geneId,
  type: 'Capsule',
  content: JSON.stringify({
    gene_asset_id: geneId,
    required_skill: { name, repo, commit, path, sha256, skill_md: skillMd },
    upstream: UPSTREAM,
    routing,
    catalog,
  }),
  outcome: { score: 0.7, status: 'success' },
  blast_radius: { files: files.value.length, lines: files.value.reduce((n, f) => n + Buffer.from(f.content).toString('utf8').split('\n').length - 1, 0) },
  env_fingerprint: { platform: process.platform, arch: process.arch, node_version: process.version },
  summary: `收录 awesome-gamedev-agent-skills（commit ${UPSTREAM.commit.slice(0, 7)}，Apache-2.0）的 router 与 ${catalog.length} 个游戏开发 skill；正文记下 router 的引擎识别表、方向、类型、流程清单和全部 skill 目录，校验确认每条路由都落在已收录的 skill 上。（此 Gene 在前置条件中钉住 skill gamedev-agent-skills，使用前先安装并阅读它。）`,
  trigger: gene.signals_match,
  confidence: 0.7,
  validation: VALIDATION,
  schema_version: '1.13.0',
};
const capsule = { ...capsuleBody, asset_id: wire.computeAssetId(capsuleBody) };
writeFileSync(join(HERE, 'gene.json'), `${JSON.stringify({ ...gene, asset_id: geneId }, null, 2)}\n`);
writeFileSync(join(HERE, 'capsule.json'), `${JSON.stringify(capsule, null, 2)}\n`);

// ── 3. Run the validation the Hub will run ───────────────────────────────────────────────────────────────────────
for (const command of VALIDATION) {
  try {
    execFileSync('sh', ['-c', `${command} ${JSON.stringify(join(HERE, 'capsule.json'))}`], { stdio: 'pipe' });
  } catch {
    fail('校验命令在本地 Capsule 上没过。');
  }
}
log(`本地校验：通过\nGene ${geneId}\nCapsule ${capsule.asset_id}`);
const lookup = assetLookup(evolver);
const live = await lookup(geneId);
log(`hub 上：${live?.status ?? '还没有'}`);
if (!apply) { log('\n预览完成。加 --apply 发布。'); log(`日志：${logFile}`); process.exit(0); }

// ── 4. Publish and read back ─────────────────────────────────────────────────────────────────────────────────────
if (live?.status && live.status !== 'revoked') {
  log('已在 hub 上，跳过发布');
} else {
  let answer;
  try {
    const message = envelope('publish', { assets: [{ ...gene, asset_id: geneId }, capsule] });
    answer = await http.call('POST', '/a2a/publish', message, undefined, attest?.(message));
  } catch (error) {
    fail(`发布失败：${error.message} ${JSON.stringify(error.body ?? '').slice(0, 800)}`, '按报错查清原因再重跑；同一组触发词 24 小时内最多发 5 次，被拒也算。');
  }
  const payload = answer?.payload ?? answer;
  log(`hub 回复：${JSON.stringify(payload).slice(0, 800)}`);
  const ok = (payload?.decision ?? answer?.decision) === 'accept' || ['newcomer_candidate', 'already_published'].includes(payload?.reason);
  if (!ok) fail('hub 没有接受这个 Gene。');
}
await new Promise((done) => setTimeout(done, 20_000));
const after = await lookup(geneId);
log(`读回：Gene ${after?.status ?? '查不到'}，Capsule ${after?.bundle_capsule?.asset_id === capsule.asset_id ? '对得上' : `对不上（${after?.bundle_capsule?.asset_id ?? '无'}）`}`);
log(`节点 ${sender}\n完成。日志：${logFile}`);
