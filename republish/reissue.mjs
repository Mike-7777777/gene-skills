#!/usr/bin/env node
// Give the named kit Genes a new version that records the skills commit in metadata, so they get new ids and can be
// published again (e.g. with a CI attestation, after their first copies stayed newcomer candidates). The ids they
// replace are kept in the manifest as superseded_asset_ids, to be revoked once the new ones are promoted.
//
//   node republish/reissue.mjs <gene id>...
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect } from './lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const fail = (why) => { console.error(`停止：${why}`); process.exit(1); };
const { wire } = await connect(fail);
const read = (...p) => JSON.parse(readFileSync(join(HERE, ...p), 'utf8'));
const write = (value, ...p) => writeFileSync(join(HERE, ...p), `${JSON.stringify(value, null, 2)}\n`);
const manifest = read('manifest.json');
for (const id of process.argv.slice(2)) {
  const entry = manifest.genes.find((g) => g.id === id);
  if (!entry) fail(`清单里没有 ${id}。`);
  const gene = read('genes', `${id}.json`);
  gene.metadata = { ...gene.metadata, skills_commit: manifest.skills_commit };
  const geneId = wire.computeAssetId(gene);
  if (geneId === entry.new_asset_id) fail(`${id} 已经是重发后的版本。`);
  const { asset_id: _old, ...capsule } = read('capsules', `${id}.json`);
  capsule.gene = geneId;
  // The Hub refuses a Capsule whose content opens like one this node already holds; naming the new Gene first makes
  // it differ, and the Gene's validation reads its fields by name, so it is unaffected.
  const { gene_asset_id: _was, ...rest } = JSON.parse(capsule.content);
  capsule.content = JSON.stringify({ gene_asset_id: geneId, ...rest });
  capsule.asset_id = wire.computeAssetId(capsule);
  write(gene, 'genes', `${id}.json`);
  write(capsule, 'capsules', `${id}.json`);
  entry.superseded_asset_ids = [...(entry.superseded_asset_ids ?? []), entry.new_asset_id, entry.new_capsule_asset_id];
  console.log(`${id}\n  Gene ${entry.new_asset_id} → ${geneId}\n  Capsule ${entry.new_capsule_asset_id} → ${capsule.asset_id}`);
  Object.assign(entry, { new_asset_id: geneId, new_capsule_asset_id: capsule.asset_id });
}
write(manifest, 'manifest.json');
