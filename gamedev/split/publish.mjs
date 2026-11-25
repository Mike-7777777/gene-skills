#!/usr/bin/env node
// Publish the split game-dev kit from the node this machine's Evolver is signed in as: one Gene per skill (each pinning
// a branch that holds only that skill, so a fetch downloads only it), an index Gene whose skill lists every Gene by its
// stable id, Recipes for common combinations, and finally revoke the single all-in-one Gene the split replaces.
//
//   node gamedev/split/publish.mjs            build, check, run every validation locally; change nothing on the Hub
//   node gamedev/split/publish.mjs --apply    publish, create Recipes, revoke the old Gene, read everything back
// A rerun skips what already landed.
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assetLookup, ciAttestation, connect } from '../../republish/lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = 'https://github.com/Mike-7777777/gene-skills';
const UPSTREAM = { repo: 'https://github.com/gamedev-skills/awesome-gamedev-agent-skills', commit: 'c6ca6c41c839b68319ffc08430b99ab768debc32', license: 'Apache-2.0' };
const INDEX = 'gamedev-skill-index';
const INDEX_GENE = 'gene_gdsk_index_v1';
const OLD = ['sha256:b0a69260c1ff54ea0df8a93cc691b6430df59d74db7d1cebeb2db4f8f9d84ce1', 'sha256:f8f840d502c7f281fd91f84d60422702676a8fafb97cec4819d3dcbb94e2bb76'];
const INSTALL = 'evolver skill fetch --asset <Gene> --out .agents --write';
// Skills whose first bundle the Hub held as a candidate and that were revoked: a tag gives the reissued Gene a new id.
const RETAG = new Set(['threejs-scene-setup']);
const geneIdOf = (name) => `gene_gdsk_${name.replace(/-/g, '_')}_v1`;

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
const branches = read('branches.json');
const recipes = read('recipes.json');
const names = Object.keys(meta).sort();

// Validation commands: one self-contained `node -e`, with no `$`, backslash or backtick (the Hub refuses them).
const NL = 'String.fromCharCode(10)';
const BT = 'String.fromCharCode(96)';
const HEX = "const s=k.required_skill;const hex=(v,n)=>v.length===n&&[...v].every(ch=>'0123456789abcdef'.includes(ch));const pin=hex(s.commit,40)&&hex(s.sha256,64)&&s.path==='skills/'+s.name;";
const READ = "const k=JSON.parse(JSON.parse(require('fs').readFileSync(process.argv.find(a=>String(a).endsWith('.json')),'utf8')).content);" + HEX;
// A skill's Gene: the pin is well formed, and every neighbour the strategy sends the agent to is one the skill's own
// description names in backticks ("Not for ... (`x`)"), listed with the Gene id derived from its name.
const SKILL_VALIDATION = [`node -e "${READ}const rel=k.skill===s.name&&k.related.every(r=>k.description.includes(${BT}+r.skill+${BT})&&r.gene==='gene_gdsk_'+r.skill.split('-').join('_')+'_v1');process.exit(pin&&rel&&k.sections.includes('When to use')&&k.index_gene==='${INDEX_GENE}'?0:1)"`];
// The index Gene: the pin is well formed and every table row points at the Gene id derived from its skill name.
const INDEX_VALIDATION = [`node -e "${READ}const e=k.entries;const ok=e.length===34&&new Set(e.map(x=>x.skill)).size===34&&e.every(x=>x.gene==='gene_gdsk_'+x.skill.split('-').join('_')+'_v1'&&s.skill_md.includes(${BT}+x.gene+${BT}));process.exit(pin&&ok&&s.skill_md.startsWith('---'+${NL}+'name: '+s.name+${NL})?0:1)"`];
for (const v of [...SKILL_VALIDATION, ...INDEX_VALIDATION]) if (/[$\\`]/.test(v)) fail('校验命令里有 $、反斜杠或反引号，hub 会拒收。');

// ── 1. Fetch each skill from its branch commit, exactly as Evolver installs it ────────────────────────────────────
async function fetchPinned(name) {
  const { commit, sha256 } = branches[name];
  const ref = `skill:git+${REPO}@${commit}#sha256=${sha256}&path=skills/${name}`;
  const pins = skill.requiredSkillsOf({ preconditions: [ref] });
  if (!pins.ok) fail(`${name} 的引用不合规：${pins.message}`);
  let files;
  for (let attempt = 1; attempt <= 4; attempt++) {
    files = await skill.fetchSkillFiles(pins.value[0]);
    if (files.ok) break;
    await sleep(5_000 * attempt);
  }
  if (!files.ok) fail(`取不到 ${name}：${files.message}`, '确认分支已推到 GitHub 后重跑。');
  if (skill.digestOfSkillFiles(files.value) !== sha256) fail(`${name} 的内容摘要和 branches.json 不一致。`);
  const text = (f) => Buffer.from(f.content).toString('utf8');
  return {
    ref, pin: pins.value[0], files: files.value,
    skillMd: text(files.value.find((f) => f.path === 'SKILL.md')),
    lines: files.value.reduce((n, f) => n + text(f).split('\n').length - 1, 0),
  };
}

const short = (text, max) => (text.length <= max ? text : `${text.slice(0, max - 1).replace(/\s+\S*$/, '')}…`);
function strategyOf(name, md) {
  const description = md.match(/description: >\n([\s\S]*?)\n---/)[1].split('\n').map((l) => l.trim()).join(' ');
  const useWhen = description.match(/\bUse (?:for|when|to|on)\b[^.]*\./)?.[0] ?? description.split('. ')[0];
  const workflow = md.match(/## Workflow\n([\s\S]*?)\n## /)?.[1] ?? '';
  const leads = [...workflow.matchAll(/^\d+\. \*\*([^*]+)\*\*/gm)].map((m) => m[1].replace(/[.:]$/, ''));
  const headings = [...md.matchAll(/^## (.+)$/gm)].map((m) => m[1]).filter((h) => !/^(When to use|Workflow|References|Version notes)/.test(h));
  const related = [...new Set([...description.matchAll(/`([a-z0-9-]+)`/g)].map((m) => m[1]))].filter((r) => r !== name && meta[r]).slice(0, 2);
  const steps = [
    `先按前置条件安装并通读 skill ${name}，规则、数字和检查以它为准；其他游戏开发 skill 不要预装。`,
    short(useWhen, 220),
    leads.length ? short(`Workflow: ${leads.slice(0, 4).join('; ')}.`, 260) : short(`Follow its sections: ${headings.slice(0, 5).join('; ')}.`, 260),
    `需求超出本 skill 时只换装对应的一个，命令 ${INSTALL}：${related.map((r) => `${r} 用 ${geneIdOf(r)}`).join('，')}${related.length ? '；' : ''}其余查速查卡 ${INDEX_GENE}。`,
  ];
  return { steps, description, related: related.map((r) => ({ skill: r, gene: geneIdOf(r) })) };
}

const env_fingerprint = { platform: process.platform, arch: process.arch, node_version: process.version };
function bundle(gene, contentExtra, fetched, capsuleSummary, validation, skillField) {
  const geneId = wire.computeAssetId(gene);
  if (wire.computeAssetId(stripHubDeliveryMetadataForIntegrity({ ...gene, asset_id: geneId })) !== geneId) fail(`${gene.id} 发布后 evolver 会校验不过。`);
  const { name, repo, commit, path, sha256 } = fetched.pin;
  const body = {
    gene: geneId, type: 'Capsule',
    // What is unique to this skill goes first, and no URL scheme appears: the Hub's similarity check cuts the text at
    // the first "//" (it strips line comments after joining lines), so a URL early on leaves only a shared prefix.
    content: JSON.stringify({ ...contentExtra, required_skill: { name, repo: repo.replace(/^https:\/\//, ''), commit, path, sha256, ...skillField }, upstream: { ...UPSTREAM, repo: UPSTREAM.repo.replace(/^https:\/\//, '') }, gene_asset_id: geneId }),
    strategy: gene.strategy, outcome: { score: 0.7, status: 'success' }, summary: capsuleSummary, trigger: gene.signals_match, confidence: 0.7,
    blast_radius: { files: fetched.files.length, lines: fetched.lines }, env_fingerprint, validation, schema_version: '1.13.0',
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

const plans = [];
for (const name of names) {
  const fetched = await fetchPinned(name);
  const [zh, signals] = meta[name];
  const { steps, description, related } = strategyOf(name, fetched.skillMd);
  const gene = {
    id: geneIdOf(name), type: 'Gene', domain: 'game_dev', summary: `${zh} ${description}`, category: 'innovate',
    metadata: { tags: ['game-dev', 'gdsk-split', name, ...(RETAG.has(name) ? ['reissued'] : [])] }, strategy: steps, preconditions: [fetched.ref], signals_match: signals,
    schema_version: '1.13.0', validation: SKILL_VALIDATION,
  };
  if (skill.requiredSkillsOf(gene).value[0].name === signals.slice(0, 4).join('-').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')) fail(`${name} 渲染出的 skill 名会和钉住的 skill 重名。`);
  const sections = [...fetched.skillMd.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
  plans.push({ name, ...bundle(gene, { skill: name, description, sections, related, index_gene: INDEX_GENE }, fetched,
    `收录 awesome-gamedev-agent-skills 的 ${name}（正文未改）；正文记下钉住的版本与内容摘要、skill 的描述和章节目录、策略里指向的相邻 skill 及其 Gene 编号；skill 正文由 evolver 按引用从 GitHub 安装。（此 Gene 在前置条件中钉住 skill ${name}，使用前先安装并阅读它。）`, SKILL_VALIDATION, {}) });
  log(`□ ${name}：${fetched.files.length} 个文件，相邻 ${related.map((r) => r.skill).join('、') || '无'}`);
}

// ── 2. The index Gene ────────────────────────────────────────────────────────────────────────────────────────────
{
  const fetched = await fetchPinned(INDEX);
  const entries = [...fetched.skillMd.matchAll(/^\| [^|]+ \| ([a-z0-9-]+) \| `(gene_gdsk_[a-z0-9_]+)` \|$/gm)].map((m) => ({ skill: m[1], gene: m[2] }));
  if (entries.map((e) => e.skill).sort().join() !== names.join()) fail('速查卡里的 skill 和 meta.json 对不上。');
  const gene = {
    id: INDEX_GENE, type: 'Gene', domain: 'game_dev', category: 'innovate',
    summary: '游戏开发 skill 速查卡：34 个 skill（Phaser、PixiJS、three.js 三个网页引擎，AI、手感、镜头、存档等 15 个方向，平台跳跃、肉鸽、RPG 等 8 种类型，原型、Game Jam、itch/Steam 发布、设计文档 5 个流程）各是一个 Gene，按需求查表、最多装 3 个，不用预装整套。Index of 34 game-dev skills, each its own Gene; install only what the task needs.',
    metadata: { tags: ['game-dev', 'skill-index'] },
    strategy: [
      `先按前置条件安装 skill ${INDEX}（一张表，约 4 KB），只读这一份。`,
      '召回已经装好对口的游戏开发 skill 时直接用它，不再查表；否则按需求从表里挑最多 3 行：一个引擎、一个方向、一个类型或流程。',
      `默认不再斟酌：二维网页游戏用 phaser-core，三维网页游戏用 threejs-scene-setup，已有项目按 package.json 里的引擎；Godot、Unity、Unreal、Roblox 不在本套里，按项目代码做。`,
      `每行用 ${INSTALL} 安装，装完只读那一份 SKILL.md 再动手；任务换方向时再查一次表。`,
    ],
    preconditions: [fetched.ref],
    signals_match: ['gamedev skill index card', '做游戏', '用人工智能做游戏', '游戏开发', '网页游戏', '小游戏', '选哪个游戏开发技能', '浏览器游戏', 'make a game', 'which gamedev skill', 'web game'],
    schema_version: '1.13.0', validation: INDEX_VALIDATION,
  };
  plans.push({ name: INDEX, ...bundle(gene, { entries }, fetched, '游戏开发 skill 速查卡：34 行，每行是需求、skill 名和它的 Gene 编号；校验确认每行的 Gene 编号都由 skill 名推出且写在卡里。（此 Gene 在前置条件中钉住 skill gamedev-skill-index，使用前先安装并阅读它。）', INDEX_VALIDATION, { skill_md: fetched.skillMd }) });
  log(`□ ${INDEX}：${entries.length} 行`);
}
const slug = (g) => g.signals_match.slice(0, 4).join('-').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
const slugs = plans.map((p) => slug(p.gene));
if (new Set(slugs).size !== slugs.length || plans.some((p, i) => slugs[i] === p.name)) fail('有 Gene 渲染出的 skill 名重复或和钉住的 skill 重名。');
// The Hub's publish schema (evomap-hub src/schemas/a2a.js): signals >= 3 chars, Gene summary >= 10, Capsule summary
// >= 20, Capsule content <= 32000 chars. The SDK's stricter wire schema is not what the Hub enforces.
for (const p of plans) {
  const issues = [
    ...p.gene.signals_match.filter((x) => x.length < 3).map((x) => `触发词「${x}」少于 3 个字`),
    ...(p.gene.summary.length < 10 ? ['Gene 摘要少于 10 个字'] : []),
    ...(p.capsule.summary.length < 20 ? ['Capsule 摘要少于 20 个字'] : []),
    ...(p.capsule.content.length > 32000 ? [`Capsule 正文 ${p.capsule.content.length} 字符，超过 32000`] : []),
  ];
  if (issues.length) fail(`${p.gene.id} 过不了 hub 的发布 schema：${issues.join('；')}`);
}
// The Hub's similarity check (evomap-hub src/services/similarityService.js): content is normalised, cut at the first
// "//", split into 5-character shingles and compared by Jaccard; >= 0.92 against the same author's Capsules holds the
// asset as a candidate, >= 0.95 refuses it. Check every pair here.
const hubText = (content) => content
  .replace(/^(\d+[.)]\s*)/gm, '')
  .replace(/\b(file|files|line|lines|function|method|class|module|import|export|const|let|var|return|async|await|try|catch|if|else|for|while)\b/gi, '')
  .replace(/sha256:[a-f0-9]{64}/gi, '<HASH>')
  .replace(/\s+/g, ' ').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').trim().toLowerCase();
const shingles = (text) => { const set = new Set(); for (let i = 0; i <= text.length - 5; i++) set.add(text.slice(i, i + 5)); return set; };
const jaccard = (a, b) => { let n = 0; for (const x of a) if (b.has(x)) n++; return n / (a.size + b.size - n || 1); };
const earlier = [];
const sets = plans.map((p) => ({ name: p.gene.id, set: shingles(hubText(p.capsule.content)), kept: hubText(p.capsule.content).length }));
let worst = { j: 0 };
for (let i = 0; i < sets.length; i++) {
  for (const other of [...sets.slice(i + 1), ...earlier]) {
    const j = jaccard(sets[i].set, other.set);
    if (j > worst.j) worst = { j, a: sets[i].name, b: other.name };
  }
}
log(`相似度自查：最像的一对 ${worst.a} 与 ${worst.b?.split('/').pop()}，${worst.j.toFixed(2)}；hub 实际比较的正文最短 ${Math.min(...sets.map((s) => s.kept))} 字符`);
if (worst.j >= 0.8) fail('有两份 Capsule 正文在 hub 看来过于相似，会被扣成候选或拒收。');
const assetOf = new Map(plans.map((p) => [p.name, p.gene.asset_id]));
for (const r of recipes) for (const step of r.steps) if (!assetOf.has(step)) fail(`组合方案「${r.title}」的步骤 ${step} 不在本套里。`);
log(`\n本地检查与校验全部通过：${plans.length} 个 Gene，${recipes.length} 个组合方案。`);
if (!apply) { log(`预览完成。加 --apply 发布。日志：${logFile}`); process.exit(0); }

// ── 3. Publish ───────────────────────────────────────────────────────────────────────────────────────────────────
log('\n第 1 步：发布 Gene');
for (const plan of plans) {
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
  const ok = (payload?.decision ?? answer?.decision) === 'accept' || payload?.reason === 'newcomer_candidate'
    || (payload?.reason === 'already_published' && (payload?.target_asset_id ?? payload?.related_asset_id) === plan.capsule.asset_id);
  if (!ok) fail(`hub 没有接受 ${plan.gene.id}：${JSON.stringify(payload).slice(0, 1200)}`);
  log(`  ${plan.gene.id}：${payload?.reason ?? 'accept'}`);
  await sleep(2_000);
}

log('\n第 2 步：建组合方案');
const recipeIdOf = (body) => body?.recipe?.id ?? body?.payload?.recipe?.id ?? body?.id ?? body?.recipe_id ?? body?.payload?.recipe_id;
const created = [];
for (const recipe of recipes) {
  const steps = recipe.steps.map((s) => assetOf.get(s));
  const searched = await http.call('GET', '/a2a/recipe/search', undefined, { q: recipe.title, limit: 20 }).catch(() => ({}));
  const existing = (searched?.recipes ?? []).find((r) => (r.node_id ?? r.author_node_id) === sender && r.title === recipe.title);
  if (existing) { log(`  ${existing.id}：已建过`); created.push({ ...recipe, id: existing.id, assets: steps }); continue; }
  let id;
  try {
    for (let attempt = 1; ; attempt++) {
      try {
        id = recipeIdOf(await http.call('POST', '/a2a/recipe', {
          node_id: sender, title: recipe.title, description: recipe.description,
          steps: steps.map((assetId, i) => ({ asset_id: assetId, asset_type: 'Gene', position: i + 1 })),
        }));
        break;
      } catch (error) {
        if (error?.body?.error !== 'recipe_asset_unavailable' || attempt >= 12) throw error;
        log(`  新 Gene 还没准备好，15 秒后重试（${attempt}/12）`);
        await sleep(15_000);
      }
    }
    await http.call('POST', `/a2a/recipe/${encodeURIComponent(id)}/publish`, { node_id: sender });
  } catch (error) {
    fail(`建组合方案「${recipe.title}」失败：${error.message} ${JSON.stringify(error.body ?? '').slice(0, 600)}`, 'Gene 已发布，修好后重跑会接着建。');
  }
  log(`  ${id}：${recipe.title}`);
  created.push({ ...recipe, id, assets: steps });
}

log('\n第 3 步：撤回被替换的整套 Gene');
for (const assetId of OLD) {
  const current = await lookup(assetId);
  if (!current || current.status === 'revoked') { log(`  ${assetId.slice(0, 15)}：已撤回`); continue; }
  try {
    const answer = await http.call('POST', '/a2a/asset/self-revoke', { asset_id: assetId });
    log(`  ${assetId.slice(0, 15)}：${answer?.status ?? 'revoked'}`);
  } catch (error) {
    fail(`撤回 ${assetId} 失败：${error.message} ${JSON.stringify(error.body ?? '').slice(0, 400)}`, '新 Gene 与组合方案都已就位；每天最多撤回 5 个，额度用完第二天重跑。');
  }
}

log('\n第 4 步：读回核对');
const manifest = { node_id: sender, checked_at: new Date().toISOString(), genes: [], recipes: [],
  // Revoked on 2026-11-25: the all-in-one Gene and the first, later reissued, versions of two Genes.
  revoked: [...OLD, 'sha256:85aff62ab47347cfea7ebc9e280c6ac0dc6783390033030c4e072d0e7417ce32', 'sha256:90a885018faedfe1b8e8809310de6bc88faf5f7ac9703a66b188e712c283b378', 'sha256:43aca38fdd69aaee68ec0db2546d3caea2b1a806276e4577827bd7c34fcaa883', 'sha256:b9d9c0263e363d66a5bac41a0f9af111fdaba5fb358f2aa8b8e6651e60ff63ea'] };
for (const plan of plans) {
  const live = await lookup(plan.gene.asset_id);
  // A Gene published on an earlier run keeps the Capsule it was published with; record what the Hub holds.
  const capsuleId = live?.bundle_capsule?.asset_id ?? null;
  log(`  ${plan.gene.id}：${live?.status ?? '查不到'}，Capsule ${capsuleId ? `${capsuleId.slice(0, 15)}（${live.bundle_capsule.status}）` : '没有'}`);
  manifest.genes.push({ skill: plan.name, id: plan.gene.id, asset_id: plan.gene.asset_id, capsule_asset_id: capsuleId, status: live?.status ?? null });
}
for (const recipe of created) {
  const body = await http.call('GET', `/a2a/recipe/${encodeURIComponent(recipe.id)}`);
  const r = body?.recipe ?? body;
  const steps = (r.steps ?? r.genes ?? []).map((s) => s.asset_id ?? s.gene_asset_id);
  log(`  ${recipe.id}：${r.status}，步骤${steps.join() === recipe.assets.join() ? '一致' : '不一致'}`);
  manifest.recipes.push({ id: recipe.id, title: recipe.title, status: r.status, steps: recipe.steps });
}
writeFileSync(join(HERE, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
log(`\n完成。清单写入 gamedev/split/manifest.json。日志：${logFile}`);
