#!/usr/bin/env node
// Republish Genes whose skill pin moved (genes/ and capsules/ come from build.mjs), move the Recipes that use them to the new
// versions, then revoke the old versions. Runs with the Evolver installed on this machine and the Hub identity it is
// signed in with (`evolver login` or EVOMAP_NODE_ID/EVOMAP_NODE_SECRET); this script never reads a credential itself.
//
//   node republish/republish.mjs            preview: checks everything, changes nothing
//   node republish/republish.mjs --apply    publish, move Recipes, revoke
//   --manifest <file>                       another manifest (default: manifest.json beside this script)
//
// The Hub takes at most 5 publishes with the same triggers from one node in 24 hours, refused attempts included, so
// a failed --apply is fixed before it is run again, not retried in a loop. A rerun skips what already landed.
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect, fullRecord, newCapsule, publicAsset } from './lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const RECIPE_WAIT_TRIES = 12;
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const manifestPath = resolve(args.includes('--manifest') ? args[args.indexOf('--manifest') + 1] : join(HERE, 'manifest.json'));
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
mkdirSync(join(HERE, 'logs'), { recursive: true });
const logFile = join(HERE, 'logs', `republish_${stamp}.log`);
const log = (line = '') => { console.log(line); appendFileSync(logFile, `${line}\n`); };
const fail = (why, next) => { log(`\n停止：${why}`); if (next) log(`下一步：${next}`); log(`日志：${logFile}`); process.exit(1); };

// ── 1. The Evolver on this machine and who it is signed in as ─────────────────────────────────────────────────────
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
log(`${apply ? '执行' : '预览（不改任何东西）'}  ${new Date().toISOString()}`);
const evolver = await connect(fail);
const { wire, skill, stripHubDeliveryMetadataForIntegrity, sender, http, envelope } = evolver;
log(`evolver ${evolver.version}（${evolver.evolverDir}）`);
log(`当前登录节点：${sender}`);
if (sender !== manifest.node_id) fail(`这批 Gene 属于节点 ${manifest.node_id}，本机登录的是 ${sender}。`, '在发布这批 Gene 的那台电脑上运行。');

// ── 3. Check every Gene and build its bundle ─────────────────────────────────────────────────────────────────────
const plans = [];
for (const entry of manifest.genes) {
  log(`\n■ ${entry.id}`);
  const gene = JSON.parse(readFileSync(join(dirname(manifestPath), 'genes', `${entry.id}.json`), 'utf8'));
  if (wire.computeAssetId(gene) !== entry.new_asset_id) fail(`genes/${entry.id}.json 的内容和清单里的新编号对不上，文件被改过。`, '重新下载这个文件夹。');
  if (wire.computeAssetId(stripHubDeliveryMetadataForIntegrity({ ...gene, asset_id: entry.new_asset_id })) !== entry.new_asset_id) fail(`${entry.id} 发布后 evolver 会校验不过，按编号取不到。`, '把这个情况告诉准备文件的人。');
  const pins = skill.requiredSkillsOf(gene);
  if (!pins.ok || pins.value.length !== 1) fail(`${entry.id} 的 skill 引用读不出来：${pins.ok ? '数量不是 1' : pins.message}`);
  const files = await skill.fetchSkillFiles(pins.value[0]);
  if (!files.ok) fail(`取不到 skill ${pins.value[0].name}：${files.message}`, '确认能访问 github.com。');
  if (skill.digestOfSkillFiles(files.value) !== pins.value[0].sha256) fail(`skill ${pins.value[0].name} 的内容摘要和引用不一致。`);
  log(`  skill ${pins.value[0].name}：能下载，摘要一致`);

  const oldPublic = await publicAsset(entry.old_asset_id);
  const newPublic = await publicAsset(entry.new_asset_id);
  if (newPublic?.status && newPublic.status !== 'revoked') {
    log(`  新版本已在 hub 上（${newPublic.status}），跳过发布`);
  } else if (!oldPublic) {
    fail(`hub 上找不到旧版本 ${entry.old_asset_id}。`);
  } else if (oldPublic.source_node_id !== sender) {
    fail(`旧版本 ${entry.old_asset_id} 不是本节点发布的。`);
  }
  const oldGene = await fullRecord(evolver, entry.old_asset_id);
  if (!newPublic && oldGene) {
    // The new version keeps what the Hub finds the old one by (id, summary, signals, tags); only its skill pin,
    // strategy and validation may differ. A difference elsewhere means the Hub copy changed after the kit was built.
    const kept = Object.keys(gene).filter((key) => !['preconditions', 'strategy', 'validation'].includes(key));
    const changed = kept.filter((key) => JSON.stringify(oldGene[key]) !== JSON.stringify(gene[key]));
    if (changed.length > 0) fail(`hub 上的旧版本和准备新版本时用的不一样（${changed.join('、')} 被改过），新版本不能直接替换它。`, '把这个情况告诉准备文件的人重新生成。');
  }
  const capsuleId = oldPublic?.bundle_capsule?.asset_id ?? null;
  const alreadyPublished = Boolean(newPublic?.status && newPublic.status !== 'revoked');
  let capsule = null;
  // Once the new version is out, its Capsule is too; the old one may already be revoked and is only revoked here.
  if (capsuleId && !alreadyPublished) {
    const old = await fullRecord(evolver, capsuleId);
    if (!old) fail(`取不到旧版本的 Capsule ${capsuleId}。`);
    const skillMd = new TextDecoder().decode(files.value.find((file) => file.path === 'SKILL.md').content);
    capsule = newCapsule(evolver, old, entry.new_asset_id, pins.value[0], skillMd);
    if (entry.new_capsule_asset_id && capsule.asset_id !== entry.new_capsule_asset_id) fail(`现场生成的 Capsule 和 capsules/${entry.id}.json 不一致（hub 上的旧 Capsule 可能被改过）。`, '把这个情况告诉准备文件的人重新生成。');
  } else if (!newPublic) {
    fail(`旧版本没有配套 Capsule，hub 发布 Gene 需要成对的 Capsule。`);
  }
  const recipes = (oldPublic?.recipes ?? []).filter((recipe) => recipe.node_id === sender).map((recipe) => recipe.recipe_id);
  log(`  旧版本 ${entry.old_asset_id}（${oldPublic?.status ?? '不在 hub 上'}）`);
  log(`  新版本 ${entry.new_asset_id}`);
  log(`  配套 Capsule：${capsuleId ?? '无'}${capsule ? ` → 新 ${capsule.asset_id}` : ''}`);
  log(`  引用它的组合方案（Recipe）：${recipes.join(', ') || '无'}`);
  plans.push({ entry, gene: { ...gene, asset_id: entry.new_asset_id }, capsule, oldCapsuleId: capsuleId, recipes, skipPublish: alreadyPublished, oldStatus: oldPublic?.status });
}

if (!apply) {
  log('\n预览完成，以上检查全部通过。确认无误后加 --apply 执行：先发布全部新版本，再把组合方案换成新版本，最后撤回旧版本。');
  log(`日志：${logFile}`);
  process.exit(0);
}

// ── 4. Publish every new version first; nothing old changes unless all of them land ───────────────────────────────
log('\n第 1 步：发布新版本');
for (const plan of plans) {
  if (plan.skipPublish) { log(`  ${plan.entry.id}：已发布过，跳过`); continue; }
  let answer;
  try {
    answer = await http.call('POST', '/a2a/publish', envelope('publish', { assets: [plan.gene, plan.capsule] }));
  } catch (error) {
    fail(`发布 ${plan.entry.id} 失败：${error.message} ${JSON.stringify(error.body ?? '').slice(0, 400)}`, '旧版本和组合方案都还没动，修好后重新运行即可。');
  }
  const decision = answer?.payload?.decision ?? answer?.decision;
  // A rerun right after a publish may not see the new version through the public lookup yet; the Hub then names it.
  if (answer?.payload?.reason === 'already_published' && answer.payload.target_asset_id === plan.entry.new_asset_id) {
    log(`  ${plan.entry.id}：之前已发布`);
    continue;
  }
  if (decision !== 'accept') fail(`hub 没有接受 ${plan.entry.id}：${JSON.stringify(answer?.payload ?? answer).slice(0, 1500)}`, '旧版本和组合方案都还没动。');
  log(`  ${plan.entry.id}：已发布（${answer?.payload?.reason ?? decision}）`);
}

// ── 5. Point each Recipe at the new versions ─────────────────────────────────────────────────────────────────────
log('\n第 2 步：把组合方案（Recipe）换成新版本');
const replace = new Map(plans.map((plan) => [plan.entry.old_asset_id, plan.entry.new_asset_id]));
// A published Recipe cannot be edited (the Hub answers only_draft_can_be_updated), so each one is forked into a
// draft, the draft takes the new versions and the original title, the draft is published, and the original archived.
const stepIdsOf = (recipe) => (recipe.steps ?? recipe.genes ?? []).map((step) => step.asset_id ?? step.gene_asset_id);
const recipeOf = async (id) => { const answer = await http.call('GET', `/a2a/recipe/${encodeURIComponent(id)}`); return answer?.recipe ?? answer; };
const stopRecipe = (id, error) => fail(`替换组合方案 ${id} 失败：${error.message} ${JSON.stringify(error.body ?? '').slice(0, 400)}`, '新版本已发布，旧版本还没撤回；把这段输出发给准备文件的人。');
for (const recipeId of [...new Set(plans.flatMap((plan) => plan.recipes))]) {
  const original = await recipeOf(recipeId);
  if (original.status === 'archived' || !stepIdsOf(original).some((id) => replace.has(id))) { log(`  ${recipeId}：已处理过`); continue; }
  const genes = (original.steps ?? original.genes).map((step) => {
    const id = step.asset_id ?? step.gene_asset_id;
    return { gene_asset_id: replace.get(id) ?? id, position: step.position, optional: Boolean(step.optional), ...(step.condition ? { condition: step.condition } : {}) };
  });
  let draftId;
  try {
    const forked = await http.call('POST', `/a2a/recipe/${encodeURIComponent(recipeId)}/fork`, {});
    draftId = forked?.recipe?.id ?? forked?.id;
    // A Gene published moments ago is not yet usable in a Recipe (recipe_asset_unavailable); it is within a minute.
    for (let attempt = 1; ; attempt++) {
      try {
        await http.call('PATCH', `/a2a/recipe/${encodeURIComponent(draftId)}`, { genes, title: original.title });
        break;
      } catch (error) {
        if (error?.body?.error !== 'recipe_asset_unavailable' || attempt >= RECIPE_WAIT_TRIES) throw error;
        log(`  ${recipeId}：新版本刚发布，hub 还没准备好，15 秒后重试（${attempt}/${RECIPE_WAIT_TRIES}）`);
        await new Promise((done) => setTimeout(done, 15_000));
      }
    }
    const draft = await recipeOf(draftId);
    if (stepIdsOf(draft).join() !== genes.map((step) => step.gene_asset_id).join()) throw new Error(`draft ${draftId} has steps ${stepIdsOf(draft).join(', ')}`);
    await http.call('POST', `/a2a/recipe/${encodeURIComponent(draftId)}/publish`, {});
    await http.call('POST', `/a2a/recipe/${encodeURIComponent(recipeId)}/archive`, {});
  } catch (error) {
    stopRecipe(recipeId, error);
  }
  log(`  ${recipeId} → ${draftId}：新组合方案已发布，旧的已归档`);
}

// ── 6. Revoke the old versions ───────────────────────────────────────────────────────────────────────────────────
log('\n第 3 步：撤回旧版本');
// The Hub lets a node revoke at most 5 promoted assets in 24 hours (seen 2026-11-21). Old Genes go first, since
// recall can still pick an old Gene; old Capsules only matter once their Gene is gone. A rerun resumes here.
const toRevoke = [...plans.map((plan) => plan.entry.old_asset_id), ...plans.map((plan) => plan.oldCapsuleId)].filter(Boolean);
for (const assetId of toRevoke) {
  const current = await publicAsset(assetId);
  if (!current || current.status === 'revoked') { log(`  ${assetId}：已撤回`); continue; }
  try {
    const answer = await http.call('POST', '/a2a/asset/self-revoke', { asset_id: assetId });
    log(`  ${assetId}：${answer?.status ?? 'revoked'}`);
  } catch (error) {
    fail(`撤回 ${assetId} 失败：${error.message} ${JSON.stringify(error.body ?? '').slice(0, 400)}`, '新版本和组合方案都已就位。hub 每个节点 24 小时内最多撤回 5 个已晋升资产，额度用完时等第二天再运行同一条 --apply 命令，会从这里接着撤。');
  }
}

log('\n完成。新版本：');
for (const plan of plans) log(`  ${plan.entry.id}  ${plan.entry.new_asset_id}`);
log(`日志：${logFile}`);
