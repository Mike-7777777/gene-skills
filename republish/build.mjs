#!/usr/bin/env node
// Build the republish kit from the Genes on the Hub now: each Gene keeps every field it has and only its skill pin
// moves to <commit> of this repository; its Capsule is rebuilt to match. Writes genes/, capsules/ and manifest.json
// beside this script for republish.mjs to run on the owning node. Any signed-in node can build; nothing is published.
//
//   node republish/build.mjs <skills commit> <gene asset id>...
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect, fullRecord, newCapsule, publicAsset, published } from './lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const VALIDATION = JSON.parse(readFileSync(join(HERE, 'validation.json'), 'utf8'));
const [commit, ...oldIds] = process.argv.slice(2);
const fail = (why, next) => { console.error(`停止：${why}${next ? `\n下一步：${next}` : ''}`); process.exit(1); };
if (!/^[0-9a-f]{40}$/.test(commit ?? '') || oldIds.length === 0) fail('用法：node republish/build.mjs <40 位 commit> <Gene 编号>...');
const evolver = await connect(fail);
const { wire, skill, stripHubDeliveryMetadataForIntegrity } = evolver;

const manifest = { node_id: null, skills_repo: 'https://github.com/Mike-7777777/gene-skills', skills_commit: commit, genes: [] };
const write = (dir, name, value) => { mkdirSync(join(HERE, dir), { recursive: true }); writeFileSync(join(HERE, dir, name), `${JSON.stringify(value, null, 2)}\n`); };
for (const oldId of oldIds) {
  const pub = await publicAsset(oldId);
  if (!pub) fail(`hub 上找不到 ${oldId}。`);
  if (manifest.node_id && pub.source_node_id !== manifest.node_id) fail(`${oldId} 和前面的 Gene 不属于同一个节点。`);
  manifest.node_id = pub.source_node_id;
  const old = await fullRecord(evolver, oldId);
  if (!old) fail(`取不到 ${oldId} 的完整内容。`);
  const oldGene = stripHubDeliveryMetadataForIntegrity(published(old));
  const pins = skill.requiredSkillsOf(oldGene);
  if (!pins.ok || pins.value.length !== 1) fail(`${oldGene.id} 的 skill 引用读不出来：${pins.ok ? '数量不是 1' : pins.message}`);
  const files = await skill.fetchSkillFiles({ ...pins.value[0], commit });
  if (!files.ok) fail(`取不到 skill ${pins.value[0].name}@${commit}：${files.message}`, '确认这个 commit 已推到 GitHub。');
  const pin = { ...pins.value[0], commit, sha256: skill.digestOfSkillFiles(files.value) };
  // The Hub demotes a promoted Gene with no validation commands back to candidate (validationQuality "empty"), and
  // search serves promoted assets only, so a Gene without validation stops being recalled. validation.json keeps
  // each case Gene's original command; it reads the Capsule, whose original fields the new Capsule keeps.
  const gene = {
    ...oldGene,
    ...(oldGene.validation?.length ? {} : VALIDATION[oldGene.id] ? { validation: VALIDATION[oldGene.id] } : {}),
    preconditions: oldGene.preconditions.map((line) => line.startsWith('skill:')
      ? line.replace(/@[0-9a-f]{40}#sha256=[0-9a-f]{64}/, `@${commit}#sha256=${pin.sha256}`) : line),
  };
  const check = skill.requiredSkillsOf(gene);
  if (!check.ok || check.value[0].commit !== commit || check.value[0].sha256 !== pin.sha256) fail(`${gene.id} 换引用后读出来不对。`);
  const newId = wire.computeAssetId(gene);
  if (wire.computeAssetId(stripHubDeliveryMetadataForIntegrity({ ...gene, asset_id: newId })) !== newId) fail(`${gene.id} 发布后 evolver 会校验不过。`);
  const capsuleId = pub.bundle_capsule?.asset_id;
  if (!capsuleId) fail(`${gene.id} 没有配套 Capsule。`);
  const oldCapsule = await fullRecord(evolver, capsuleId);
  if (!oldCapsule) fail(`取不到 Capsule ${capsuleId}。`);
  const skillMd = new TextDecoder().decode(files.value.find((file) => file.path === 'SKILL.md').content);
  const capsule = newCapsule(evolver, oldCapsule, newId, pin, skillMd);
  write('genes', `${gene.id}.json`, gene);
  write('capsules', `${gene.id}.json`, capsule);
  manifest.genes.push({
    id: gene.id, skill: pin.name, files: files.value.length,
    old_asset_id: oldId, new_asset_id: newId, old_capsule_asset_id: capsuleId, new_capsule_asset_id: capsule.asset_id,
    recipes: (pub.recipes ?? []).filter((recipe) => recipe.node_id === pub.source_node_id).map((recipe) => recipe.recipe_id),
  });
  console.log(`${gene.id}\n  ${oldId} → ${newId}\n  skill ${pin.name} ${pin.sha256}`);
}
write('.', 'manifest.json', manifest);
console.log(`\n已写入 genes/、capsules/、manifest.json（节点 ${manifest.node_id}，skill commit ${commit}）。`);
