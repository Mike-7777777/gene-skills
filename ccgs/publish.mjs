#!/usr/bin/env node
// Publish Claude Code Game Studios (ZCode port) as Genes from the node this machine's Evolver is signed in as. The
// studio is one project template whose skills call its own scripts, docs and hooks, so it is not split per skill: every
// Gene pins the same small skill, ccgs-studio-setup, which installs the template at a pinned commit; the entry Genes
// differ in what they are recalled for and which studio command they hand over to.
//
//   node ccgs/publish.mjs            build, check, run every validation locally; change nothing on the Hub
//   node ccgs/publish.mjs --apply    publish, then read everything back into ccgs/manifest.json
//   add --only <entry> to publish just that one
// A rerun skips what already landed.
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assetLookup, ciAttestation, connect } from '../republish/lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = 'https://github.com/Mike-7777777/gene-skills';
const UPSTREAM = { repo: 'github.com/Donchitos/Claude-Code-Game-Studios', version: '1.3.0', commit: 'abc0de79d6ceb0b5d7aa693945849b3937afbe6a', license: 'MIT' };
const INSTALL = 'evolver skill fetch --asset <Gene> --out .agents --write';
const SCRIPT = 'sh .agents/skills/ccgs-studio-setup/install.sh <folder>';

const apply = process.argv.includes('--apply');
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
mkdirSync(join(HERE, 'logs'), { recursive: true });
mkdirSync(join(HERE, 'assets'), { recursive: true });
const logFile = join(HERE, 'logs', `publish_${stamp}.log`);
const log = (line = '') => { console.log(line); appendFileSync(logFile, `${line}\n`); };
const fail = (why, next) => { log(`\n停止：${why}`); if (next) log(`下一步：${next}`); log(`日志：${logFile}`); process.exit(1); };
const read = (file) => JSON.parse(readFileSync(join(HERE, file), 'utf8'));
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

log(`${apply ? '执行' : '预览（不改 hub 上任何东西）'}  ${new Date().toISOString()}`);
const evolver = await connect(fail);
const { wire, skill, stripHubDeliveryMetadataForIntegrity, sender, http, envelope } = evolver;
const lookup = assetLookup(evolver);
const attest = ciAttestation();
log(`evolver ${evolver.version}，节点 ${sender}，CI 签名：${attest ? '有' : '没有'}`);
const meta = read('meta.json');
const { template, setup } = read('branches.json');

// Validation commands: one self-contained `node -e`, with no `$`, backslash or backtick (the Hub refuses them).
const READ = "const k=JSON.parse(JSON.parse(require('fs').readFileSync(process.argv.find(a=>String(a).endsWith('.json')),'utf8')).content);const s=k.required_skill;const hex=(v,n)=>v.length===n&&[...v].every(ch=>'0123456789abcdef'.includes(ch));const pin=hex(s.commit,40)&&hex(s.sha256,64)&&s.path==='skills/'+s.name&&s.name==='ccgs-studio-setup'&&hex(k.template.commit,40)&&hex(k.template.tree,40);";
// An entry Gene: the pin is well formed and the command it hands over to is one the setup skill's handover lists.
const ENTRY_VALIDATION = [`node -e "${READ}process.exit(pin&&k.command.startsWith('/')&&k.handover.includes(k.command)&&k.sections.length>0?0:1)"`];
// The setup Gene: the pin is well formed and every entry command is in the handover.
const SETUP_VALIDATION = [`node -e "${READ}process.exit(pin&&k.commands.length===5&&k.commands.every(c=>k.handover.includes(c))?0:1)"`];
for (const v of [...ENTRY_VALIDATION, ...SETUP_VALIDATION]) if (/[$\\`]/.test(v)) fail('校验命令里有 $、反斜杠或反引号，hub 会拒收。');

// ── 1. Fetch the setup skill exactly as Evolver installs it, and each entry skill's text from the template ──────────
const ref = `skill:git+${REPO}@${setup.commit}#sha256=${setup.sha256}&path=skills/${setup.skill}`;
const pins = skill.requiredSkillsOf({ preconditions: [ref] });
if (!pins.ok) fail(`引用不合规：${pins.message}`);
let files;
for (let attempt = 1; attempt <= 4; attempt++) { files = await skill.fetchSkillFiles(pins.value[0]); if (files.ok) break; await sleep(5_000 * attempt); }
if (!files.ok) fail(`取不到 ${setup.skill}：${files.message}`, '确认分支已推到 GitHub 后重跑。');
if (skill.digestOfSkillFiles(files.value) !== setup.sha256) fail('setup skill 的内容摘要和 branches.json 不一致。');
const text = (f) => Buffer.from(f.content).toString('utf8');
const setupMd = text(files.value.find((f) => f.path === 'SKILL.md'));
const installSh = text(files.value.find((f) => f.path === 'install.sh'));
if (!installSh.includes(`COMMIT=${template.commit}`) || !installSh.includes(`TREE=${template.tree}`)) fail('install.sh 钉的模板版本和 branches.json 不一致。');
const installDiff = `--- /dev/null\n+++ b/skills/ccgs-studio-setup/install.sh\n@@ -0,0 +1,${installSh.split('\n').length - 1} @@\n${installSh.replace(/\n$/, '').split('\n').map((l) => `+${l}`).join('\n')}\n`;
const PROBLEM = 'Claude Code Game Studios is one project template (867 files: 78 skills that call its own scripts, docs and hooks), so a per-skill Gene would break 75 of them and the whole template exceeds the 256-file skill limit. Every Gene here pins one 2-file installer skill that fetches the template at a pinned commit, checks its git tree id and only adds missing files; entry Genes differ in what they are recalled for and which studio command they hand over to.';
const lines = files.value.reduce((n, f) => n + text(f).split('\n').length - 1, 0);
const handover = setupMd.match(/5\. Hand over[\s\S]*?\n\n/)?.[0] ?? '';
const commandOf = (name) => (name === 'adopt' ? '/adopt' : `/${name}`);

async function entrySkill(name) {
  const url = `https://raw.githubusercontent.com/Mike-7777777/gene-skills/${template.commit}/.zcode/skills/${name}/SKILL.md`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(url);
    if (res.ok) {
      const md = await res.text();
      return {
        description: md.match(/^description: "([^"]+)"/m)?.[1] ?? fail(`${name} 的 SKILL.md 没有 description。`),
        argumentHint: md.match(/^argument-hint: "([^"]*)"/m)?.[1] ?? '',
        sections: [...md.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim()).slice(0, 12),
        userOnly: /^disable-model-invocation: true/m.test(md),
      };
    }
    await sleep(3_000 * attempt);
  }
  fail(`取不到模板里的 ${name}/SKILL.md。`);
}

const env_fingerprint = { platform: process.platform, arch: process.arch, node_version: process.version };
const pinField = () => { const { name, repo, commit, path, sha256 } = pins.value[0]; return { name, repo: repo.replace(/^https:\/\//, ''), commit, path, sha256 }; };
const templateField = { branch: template.branch, commit: template.commit, tree: template.tree, files: template.files };
function bundle(gene, content, capsuleSummary, validation, code) {
  const geneId = wire.computeAssetId(gene);
  if (wire.computeAssetId(stripHubDeliveryMetadataForIntegrity({ ...gene, asset_id: geneId })) !== geneId) fail(`${gene.id} 发布后 evolver 会校验不过。`);
  // What is unique to this Gene goes first and no URL scheme appears: the Hub's similarity check cuts the text at the
  // first "//" (it strips line comments after joining lines).
  const body = {
    gene: geneId, type: 'Capsule',
    content: JSON.stringify({ ...content, handover, required_skill: pinField(), template: templateField, upstream: UPSTREAM, gene_asset_id: geneId }),
    strategy: gene.strategy, outcome: { score: 0.7, status: 'success' }, summary: capsuleSummary, trigger: gene.signals_match, confidence: 0.7,
    blast_radius: { files: template.files, lines }, env_fingerprint, validation, schema_version: '1.13.0', ...code,
  };
  const capsule = { ...body, asset_id: wire.computeAssetId(body) };
  const g = { ...gene, asset_id: geneId };
  writeFileSync(join(HERE, 'assets', `${gene.id}.gene.json`), `${JSON.stringify(g, null, 2)}\n`);
  const capsuleFile = join(HERE, 'assets', `${gene.id}.capsule.json`);
  writeFileSync(capsuleFile, `${JSON.stringify(capsule, null, 2)}\n`);
  for (const command of validation) {
    try { execFileSync('sh', ['-c', `${command} ${JSON.stringify(capsuleFile)}`], { stdio: 'pipe' }); } catch { fail(`${gene.id} 的校验命令在本地 Capsule 上没过。`); }
  }
  return { gene: g, capsule };
}

const common = (name) => [
  `先按前置条件安装 skill ${setup.skill} 并通读；项目根目录已有 project.yaml 和 .zcode/skills/${name}/ 时说明已装过，跳过安装。`,
  `运行 ${SCRIPT}：新游戏用新的空目录，已有项目用它的根目录；脚本按固定 commit 取模板、核对 tree id、只补缺失文件，不覆盖任何已有文件，被保留的文件逐个告诉用户。`,
  '请用户以该目录为根重开 ZCode：工作室的 agent、skill 和 hooks 只在会话开始时加载，本会话里还不存在。',
];
const plans = [];
const entries = Object.keys(meta).filter((k) => k !== 'setup');
for (const name of entries) {
  const e = await entrySkill(name);
  const command = commandOf(name);
  const run = name === 'adopt'
    ? '在新会话里：已有网页游戏用 /prototype --from <路径> 原样接入，设计文档和故事用 /adopt 审计并给出迁移计划。'
    : name === 'launch-checklist'
      ? '在新会话里请用户亲自输入 /launch-checklist [上线日期或 dry-run]：这个命令只由用户启动，不要自行开始。'
      : `在新会话里运行 ${command} ${e.argumentHint.match(/^\[[^\]]*\]/)?.[0] ?? ''}`.trim() + `。它做什么：${e.description.split('. ')[0].replace(/;.*$/, '')}.`;
  const m = meta[name];
  const gene = {
    id: m.id, type: 'Gene', domain: 'game_dev', summary: m.summary, category: 'innovate',
    metadata: { tags: ['game-dev', 'ccgs', 'zcode', name] }, strategy: [...common(name), run], preconditions: [ref], signals_match: m.signals,
    schema_version: '1.13.0', validation: ENTRY_VALIDATION,
  };
  const snippet = [`test -f project.yaml && test -d .zcode/skills/${name} || sh .agents/skills/${setup.skill}/install.sh .`, `test -f .zcode/hooks/yaml-helper.sh && echo installed`, `# restart ZCode with this folder as the root, then in the new session:`, `${command} ${e.argumentHint}`].join('\n');
  plans.push({ name, ...bundle(gene, { entry: name, command, problem: PROBLEM, argument_hint: e.argumentHint, description: e.description, user_only: e.userOnly, sections: e.sections },
    `CCGS 入口 ${command}：先用 ccgs-studio-setup 把 Claude Code Game Studios（ZCode 版 v1.3.0，MIT）整套装进项目，重开 ZCode 后运行 ${command}；正文记下该命令的说明、参数和章节目录、钉住的安装 skill 与模板 commit。（此 Gene 在前置条件中钉住 skill ccgs-studio-setup，使用前先安装并阅读它。）`, ENTRY_VALIDATION, { code_snippet: snippet }) });
  log(`□ ${m.id}：${command}，${e.sections.length} 个章节${e.userOnly ? '，仅用户启动' : ''}`);
}
{
  const m = meta.setup;
  const commands = entries.map(commandOf);
  const gene = {
    id: m.id, type: 'Gene', domain: 'game_dev', summary: m.summary, category: 'innovate',
    metadata: { tags: ['game-dev', 'ccgs', 'zcode', 'setup'] },
    strategy: [...common('prototype'), `在新会话里按需求选命令：做游戏 /prototype，新手 /start，找点子 /brainstorm，已有项目 /adopt 或 /prototype --from，上线前 /launch-checklist（由用户输入）。`],
    preconditions: [ref], signals_match: m.signals, schema_version: '1.13.0', validation: SETUP_VALIDATION,
  };
  plans.push({ name: 'setup', ...bundle(gene, { commands, agents: 49, skills: 78, install: SCRIPT, fetch: INSTALL, problem: PROBLEM },
    '安装 Claude Code Game Studios（ZCode 版 v1.3.0，MIT）：钉住的 skill ccgs-studio-setup 按固定 commit 取 867 个模板文件、核对 tree id、只补缺失文件；正文列出装完可用的五个入口命令。（此 Gene 在前置条件中钉住 skill ccgs-studio-setup，使用前先安装并阅读它。）', SETUP_VALIDATION, { diff: installDiff }) });
  log(`□ ${m.id}：入口 ${commands.join(' ')}`);
}

const slug = (g) => g.signals_match.slice(0, 4).join('-').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
const slugs = plans.map((p) => slug(p.gene));
if (new Set(slugs).size !== slugs.length || slugs.includes(setup.skill)) fail(`有 Gene 渲染出的 skill 名重复或和钉住的 skill 重名：${slugs.join(', ')}`);
// The Hub's publish schema (evomap-hub src/schemas/a2a.js).
for (const p of plans) {
  const issues = [
    ...p.gene.signals_match.filter((x) => x.length < 3).map((x) => `触发词「${x}」少于 3 个字`),
    ...(p.gene.summary.length < 10 ? ['Gene 摘要少于 10 个字'] : []),
    ...(p.capsule.summary.length < 20 ? ['Capsule 摘要少于 20 个字'] : []),
    ...(p.capsule.content.length > 32000 ? [`Capsule 正文 ${p.capsule.content.length} 字符，超过 32000`] : []),
  ];
  if (issues.length) fail(`${p.gene.id} 过不了 hub 的发布 schema：${issues.join('；')}`);
}
// The Hub's similarity check (evomap-hub src/services/similarityService.js): >= 0.92 against the same author's
// Capsules holds the asset as a candidate, >= 0.95 refuses it.
const hubText = (content) => content
  .replace(/^(\d+[.)]\s*)/gm, '')
  .replace(/\b(file|files|line|lines|function|method|class|module|import|export|const|let|var|return|async|await|try|catch|if|else|for|while)\b/gi, '')
  .replace(/sha256:[a-f0-9]{64}/gi, '<HASH>')
  .replace(/\s+/g, ' ').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').trim().toLowerCase();
const shingles = (t) => { const set = new Set(); for (let i = 0; i <= t.length - 5; i++) set.add(t.slice(i, i + 5)); return set; };
const jaccard = (a, b) => { let n = 0; for (const x of a) if (b.has(x)) n++; return n / (a.size + b.size - n || 1); };
const compared = (c) => hubText([c.content, JSON.stringify(c.strategy), c.diff ?? '', c.code_snippet ?? ''].join(' '));
const sets = plans.map((p) => ({ name: p.gene.id, set: shingles(compared(p.capsule)), kept: compared(p.capsule).length }));
let worst = { j: 0 };
for (let i = 0; i < sets.length; i++) for (const other of sets.slice(i + 1)) { const j = jaccard(sets[i].set, other.set); if (j > worst.j) worst = { j, a: sets[i].name, b: other.name }; }
log(`相似度自查：最像的一对 ${worst.a} 与 ${worst.b}，${worst.j.toFixed(2)}；hub 实际比较的正文最短 ${Math.min(...sets.map((s) => s.kept))} 字符`);
if (worst.j >= 0.8) fail('有两份 Capsule 正文在 hub 看来过于相似，会被扣成候选或拒收。');
// The Hub's rule-based ethics review (evomap-hub src/services/ethicsService.js BLOCK_PATTERNS and FLAG_PATTERNS) reads
// the first 8000 characters of each asset; a match holds the publish. Same patterns, checked on every Gene and Capsule.
const ETHICS = [
  /(?:how\s+to\s+)?(?:harm|hurt|kill|injure|attack)\s+(?:human|people|person|user)/i, /(?:social\s+engineering|phishing)\s+(?:attack|template|script|guide)/i,
  /(?:exploit|hack)\s+(?:user|human|people|victim)/i, /(?:surveillance|spy(?:ing)?|track(?:ing)?)\s+(?:tool|system|software|user|people)/i,
  /(?:keylogger|screen\s*capture|webcam\s*hijack|mic(?:rophone)?\s*record)/i, /(?:weapon|bomb|explosive|bioweapon|chemical\s*weapon)/i,
  /(?:bypass|disable|circumvent|remove)\s+(?:safety|guardrail|security|ethic|constraint|protection|firewall)/i, /(?:ignore|override)\s+(?:ethics|constitutional|governance|safety\s+check)/i,
  /(?:jailbreak|prompt\s*inject(?:ion)?|escape\s+sandbox)/i, /(?:eliminate|destroy|kill)\s+(?:all\s+)?(?:competitor|rival|other\s+agent)/i,
  /(?:monopol(?:ize|y)|corner\s+the\s+market|block\s+all\s+other)/i, /(?:impersonat|pretend\s+to\s+be|masquerad)\w*/i,
  /(?:hide|conceal|obfuscat)\w*\s+(?:action|behavior|intent|operation|log)/i, /(?:scrape|crawl|harvest)\s+(?:personal|user|private)\s+(?:data|info)/i,
  /(?:manipulat)\w*\s+(?:user|human|people|behavior|emotion|opinion)/i, /(?:autonomous|unsupervis)\w*\s+(?:decision|action|control)\s+(?:over|affecting)\s+(?:human|people)/i,
  /(?:replac)\w*\s+(?:all\s+)?(?:human|people|worker|employee)/i, /(?:self[_-]?replicat|recursive\s+self[_-]?improve|unbounded\s+growth)/i,
];
for (const p of plans) for (const [kind, asset] of [['Gene', p.gene], ['Capsule', p.capsule]]) {
  const hit = ETHICS.find((re) => re.test(JSON.stringify(asset).slice(0, 8000)) || re.test(String(asset.content ?? '').slice(0, 8000)));
  if (hit) fail(`${p.gene.id} 的 ${kind} 命中 hub 的伦理规则 ${hit}，发布会被扣下。`);
}
log(`\n本地检查与校验全部通过：${plans.length} 个 Gene。`);
if (!apply) { log(`预览完成。加 --apply 发布。日志：${logFile}`); process.exit(0); }

// ── 2. Publish ───────────────────────────────────────────────────────────────────────────────────────────────────
// --only <entry> publishes one Gene first, to see how the Hub takes it before sending the rest.
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
log('\n第 1 步：发布 Gene');
for (const plan of plans.filter((p) => !only || p.name === only)) {
  const live = await lookup(plan.gene.asset_id);
  if (live?.status && live.status !== 'revoked') { log(`  ${plan.gene.id}：已在 hub 上（${live.status}）`); continue; }
  let answer;
  try {
    const message = envelope('publish', { assets: [plan.gene, plan.capsule] });
    answer = await http.call('POST', '/a2a/publish', message, undefined, attest?.(message));
  } catch (error) {
    fail(`发布 ${plan.gene.id} 失败：${error.message} ${JSON.stringify(error.body ?? '').slice(0, 800)}`, '前面已发的不受影响，修好后重跑会跳过它们。');
  }
  const payload = answer?.payload ?? answer;
  // Since 2026-11-27 every publish from this node lands as a candidate although its content quality scores 0.7 (an
  // account-level promote gate, not the asset); a candidate still installs by Gene id, so it counts as landed.
  const ok = (payload?.decision ?? answer?.decision) === 'accept' || ['newcomer_candidate', 'safety_candidate'].includes(payload?.reason)
    || (payload?.reason === 'already_published' && (payload?.target_asset_id ?? payload?.related_asset_id) === plan.capsule.asset_id);
  if (!ok) fail(`hub 没有接受 ${plan.gene.id}：${JSON.stringify(payload).slice(0, 1200)}`);
  log(`  ${plan.gene.id}：${payload?.reason ?? 'accept'}`);
  await sleep(2_000);
}

log('\n第 2 步：读回核对');
const manifest = { node_id: sender, checked_at: new Date().toISOString(), template: templateField, setup_skill: { ...setup, ref }, genes: [] };
for (const plan of plans) {
  const live = await lookup(plan.gene.asset_id);
  const capsuleId = live?.bundle_capsule?.asset_id ?? null;
  log(`  ${plan.gene.id}：${live?.status ?? '查不到'}，Capsule ${capsuleId ? `${capsuleId.slice(0, 15)}（${live.bundle_capsule.status}）` : '没有'}`);
  manifest.genes.push({ entry: plan.name, id: plan.gene.id, asset_id: plan.gene.asset_id, capsule_asset_id: capsuleId, status: live?.status ?? null });
}
writeFileSync(join(HERE, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
log(`\n完成。清单写入 ccgs/manifest.json。日志：${logFile}`);
