#!/usr/bin/env node
// Publish the kit's Genes (with their Capsules) from the node this machine's Evolver is signed in as, then create the
// Recipes in recipes.json on that node. Unlike republish.mjs it touches nothing another node owns: it neither forks
// nor archives Recipes and revokes nothing. A rerun skips what already landed.
//
//   node republish/publish.mjs            preview: checks everything, changes nothing
//   node republish/publish.mjs --apply    publish the Genes, then create and publish the Recipes
//   --genes-only                           stop after the Genes (a Recipe can only use promoted Genes)
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect, publicAsset } from './lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const apply = process.argv.includes('--apply');
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
mkdirSync(join(HERE, 'logs'), { recursive: true });
const logFile = join(HERE, 'logs', `publish_${stamp}.log`);
const log = (line = '') => { console.log(line); appendFileSync(logFile, `${line}\n`); };
const fail = (why, next) => { log(`\n停止：${why}`); if (next) log(`下一步：${next}`); log(`日志：${logFile}`); process.exit(1); };
const read = (...p) => JSON.parse(readFileSync(join(HERE, ...p), 'utf8'));
const RECIPE_WAIT_TRIES = 12;

log(`${apply ? '执行' : '预览（不改任何东西）'}  ${new Date().toISOString()}`);
const evolver = await connect(fail);
const { wire, skill, stripHubDeliveryMetadataForIntegrity, sender, http, envelope } = evolver;
log(`evolver ${evolver.version}，当前登录节点：${sender}`);
const manifest = read('manifest.json');
const recipes = read('recipes.json');
const geneIds = new Map(manifest.genes.map((entry) => [entry.id, entry.new_asset_id]));

// ── 1. Check every Gene ──────────────────────────────────────────────────────────────────────────────────────────
const plans = [];
for (const entry of manifest.genes) {
  const gene = read('genes', `${entry.id}.json`);
  const capsule = read('capsules', `${entry.id}.json`);
  if (wire.computeAssetId(gene) !== entry.new_asset_id) fail(`genes/${entry.id}.json 和清单里的编号对不上。`);
  if (wire.computeAssetId(stripHubDeliveryMetadataForIntegrity({ ...gene, asset_id: entry.new_asset_id })) !== entry.new_asset_id) fail(`${entry.id} 发布后 evolver 会校验不过。`);
  const { asset_id: capsuleId, ...capsuleBody } = capsule;
  if (capsuleId !== entry.new_capsule_asset_id || wire.computeAssetId(capsuleBody) !== capsuleId || capsule.gene !== entry.new_asset_id) fail(`capsules/${entry.id}.json 和清单或 Gene 对不上。`);
  if (!gene.validation?.length) fail(`${entry.id} 没有校验命令，hub 会把它降回 candidate，召回不到。`, 'node republish/revalidate.mjs');
  const pins = skill.requiredSkillsOf(gene);
  if (!pins.ok || pins.value.length !== 1) fail(`${entry.id} 的 skill 引用读不出来。`);
  // github.com sometimes drops the TLS handshake from here; a fetch is safe to repeat.
  let files;
  for (let attempt = 1; attempt <= 4; attempt++) {
    files = await skill.fetchSkillFiles(pins.value[0]);
    if (files.ok) break;
    await new Promise((done) => setTimeout(done, 5_000 * attempt));
  }
  if (!files.ok) fail(`取不到 skill ${pins.value[0].name}：${files.message}`, '确认能访问 github.com 后重跑。');
  if (skill.digestOfSkillFiles(files.value) !== pins.value[0].sha256) fail(`skill ${pins.value[0].name} 的内容摘要和引用不一致。`);
  const live = await publicAsset(entry.new_asset_id);
  log(`■ ${entry.id}\n  Gene ${entry.new_asset_id}（hub 上：${live?.status ?? '还没有'}）\n  skill ${pins.value[0].name}：能下载，摘要一致`);
  plans.push({ entry, gene: { ...gene, asset_id: entry.new_asset_id }, capsule, live });
}
const resolved = recipes.map((recipe) => ({
  title: recipe.title,
  steps: recipe.steps.map((step) => geneIds.get(step) ?? step),
}));
for (const recipe of resolved) {
  for (const id of recipe.steps) if (!/^sha256:[0-9a-f]{64}$/.test(id)) fail(`组合方案「${recipe.title}」的步骤 ${id} 不是 Gene 编号，也不在清单里。`);
  log(`□ 组合方案：${recipe.title.slice(0, 40)}…\n  步骤：${recipe.steps.map((id) => id.slice(0, 15)).join(' → ')}`);
}
if (!apply) { log('\n预览完成，检查全部通过。加 --apply 执行。'); log(`日志：${logFile}`); process.exit(0); }

// ── 2. Publish the Genes ─────────────────────────────────────────────────────────────────────────────────────────
log('\n第 1 步：发布 Gene');
for (const plan of plans) {
  if (plan.live?.status && plan.live.status !== 'revoked') { log(`  ${plan.entry.id}：已在 hub 上（${plan.live.status}），跳过`); continue; }
  let answer;
  try {
    answer = await http.call('POST', '/a2a/publish', envelope('publish', { assets: [plan.gene, plan.capsule] }));
  } catch (error) {
    fail(`发布 ${plan.entry.id} 失败：${error.message} ${JSON.stringify(error.body ?? '').slice(0, 600)}`);
  }
  const payload = answer?.payload ?? answer;
  if (payload?.reason === 'already_published' && payload.target_asset_id === plan.entry.new_asset_id) { log(`  ${plan.entry.id}：之前已发布`); continue; }
  // A node whose owner has fewer than 5 promoted assets publishes as a candidate (newcomer_candidate); the Hub's
  // 6-hourly GDI job promotes it once it passes the gates. It is stored, so it counts as published here.
  if (payload?.reason === 'newcomer_candidate' && payload.asset_ids?.includes(plan.entry.new_asset_id)) { log(`  ${plan.entry.id}：已发布，新人节点先为 candidate，等 hub 定时晋升`); continue; }
  if ((payload?.decision ?? answer?.decision) !== 'accept') fail(`hub 没有接受 ${plan.entry.id}：${JSON.stringify(payload).slice(0, 1500)}`);
  log(`  ${plan.entry.id}：已发布（${payload?.reason ?? 'accept'}）`);
}

if (process.argv.includes('--genes-only')) {
  for (const plan of plans) log(`  ${plan.entry.id}：${(await publicAsset(plan.entry.new_asset_id))?.status ?? '查不到'}`);
  log(`\n完成（只发了 Gene）。Gene 晋升后再不带 --genes-only 运行一次建组合方案。日志：${logFile}`);
  process.exit(0);
}

// ── 3. Create the Recipes ────────────────────────────────────────────────────────────────────────────────────────
log('\n第 2 步：建组合方案');
const recipeIdOf = (body) => body?.recipe?.id ?? body?.payload?.recipe?.id ?? body?.id ?? body?.recipe_id ?? body?.payload?.recipe_id;
const created = [];
for (const recipe of resolved) {
  // A rerun finds its earlier Recipe on the last step's Gene, which the Hub lists with the Recipes that use it.
  const last = await publicAsset(recipe.steps.at(-1));
  const existing = (last?.recipes ?? []).find((r) => r.node_id === sender && r.title === recipe.title && r.status === 'published');
  if (existing) { log(`  ${existing.recipe_id}：已建过`); created.push({ ...recipe, id: existing.recipe_id }); continue; }
  let id;
  try {
    for (let attempt = 1; ; attempt++) {
      try {
        id = recipeIdOf(await http.call('POST', '/a2a/recipe', {
          node_id: sender, title: recipe.title,
          steps: recipe.steps.map((assetId, i) => ({ asset_id: assetId, asset_type: 'Gene', position: i + 1 })),
        }));
        break;
      } catch (error) {
        // A Gene published moments ago is not yet usable in a Recipe (recipe_asset_unavailable); it is within minutes.
        if (error?.body?.error !== 'recipe_asset_unavailable' || attempt >= RECIPE_WAIT_TRIES) throw error;
        log(`  新 Gene 还没准备好，15 秒后重试（${attempt}/${RECIPE_WAIT_TRIES}）`);
        await new Promise((done) => setTimeout(done, 15_000));
      }
    }
    if (!id) throw new Error('hub did not return a recipe id');
    await http.call('POST', `/a2a/recipe/${encodeURIComponent(id)}/publish`, { node_id: sender });
  } catch (error) {
    fail(`建组合方案「${recipe.title.slice(0, 30)}…」失败：${error.message} ${JSON.stringify(error.body ?? '').slice(0, 600)}`, 'Gene 已发布，修好后重跑会接着建。');
  }
  log(`  ${id}：已发布 ${recipe.title.slice(0, 30)}…`);
  created.push({ ...recipe, id });
}

// ── 4. Read everything back ──────────────────────────────────────────────────────────────────────────────────────
log('\n第 3 步：读回核对');
for (const plan of plans) {
  const live = await publicAsset(plan.entry.new_asset_id);
  log(`  ${plan.entry.id}：${live?.status ?? '查不到'}，Capsule ${live?.bundle_capsule?.asset_id === plan.entry.new_capsule_asset_id ? '对得上' : '对不上'}`);
  plan.entry.recipes = created.filter((r) => r.steps.includes(plan.entry.new_asset_id)).map((r) => r.id);
}
for (const recipe of created) {
  const body = await http.call('GET', `/a2a/recipe/${encodeURIComponent(recipe.id)}`);
  const r = body?.recipe ?? body;
  const steps = (r.steps ?? r.genes ?? []).map((s) => s.asset_id ?? s.gene_asset_id);
  log(`  ${recipe.id}：${r.status}，步骤${steps.join() === recipe.steps.join() ? '与预期一致' : `不一致：${steps.join(', ')}`}`);
}
manifest.node_id = sender;
writeFileSync(join(HERE, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
log(`\n完成。清单已更新（节点与组合方案编号）。日志：${logFile}`);
