#!/usr/bin/env node
// Give the kit's Genes their validation commands back (validation.json) and recompute every id that depends on them:
// the Gene, its Capsule (which names the Gene) and the manifest. Needed when the Hub copies a kit was built from are
// no longer fetchable, e.g. after the Hub demoted them for having no validation. Changes nothing on the Hub.
//
//   node republish/revalidate.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect } from './lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const fail = (why) => { console.error(`停止：${why}`); process.exit(1); };
const { wire, stripHubDeliveryMetadataForIntegrity } = await connect(fail);
const read = (...p) => JSON.parse(readFileSync(join(HERE, ...p), 'utf8'));
const write = (value, ...p) => writeFileSync(join(HERE, ...p), `${JSON.stringify(value, null, 2)}\n`);
const VALIDATION = read('validation.json');
const manifest = read('manifest.json');
for (const entry of manifest.genes) {
  const gene = read('genes', `${entry.id}.json`);
  if (!VALIDATION[entry.id]?.length) fail(`validation.json 里没有 ${entry.id}。`);
  gene.validation = VALIDATION[entry.id];
  const geneId = wire.computeAssetId(gene);
  if (wire.computeAssetId(stripHubDeliveryMetadataForIntegrity({ ...gene, asset_id: geneId })) !== geneId) fail(`${entry.id} 发布后 evolver 会校验不过。`);
  const { asset_id: _old, ...capsule } = read('capsules', `${entry.id}.json`);
  capsule.gene = geneId;
  capsule.asset_id = wire.computeAssetId(capsule);
  write(gene, 'genes', `${entry.id}.json`);
  write(capsule, 'capsules', `${entry.id}.json`);
  console.log(`${entry.id}\n  Gene ${entry.new_asset_id} → ${geneId}\n  Capsule ${entry.new_capsule_asset_id} → ${capsule.asset_id}`);
  Object.assign(entry, { new_asset_id: geneId, new_capsule_asset_id: capsule.asset_id });
}
write(manifest, 'manifest.json');
