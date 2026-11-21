// Shared by build.mjs and republish.mjs: load the Evolver installed on this machine, talk to the Hub as the identity
// it is signed in with, and derive a Gene's new Capsule. Never reads a credential itself.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const HUB = process.env.EVOMAP_HUB_URL || 'https://evomap.ai';
const MIN_EVOLVER = [2, 0, 54];

function evolverPackageDir() {
  if (process.env.EVOLVER_PACKAGE_DIR) return resolve(process.env.EVOLVER_PACKAGE_DIR);
  let bin;
  try {
    bin = execFileSync(process.platform === 'win32' ? 'where' : 'which', ['evolver'], { encoding: 'utf8' }).split(/\r?\n/)[0].trim();
  } catch {
    return null;
  }
  for (let dir = dirname(realpathSync(bin)); dir !== dirname(dir); dir = dirname(dir)) {
    const pkg = join(dir, 'package.json');
    if (existsSync(pkg) && JSON.parse(readFileSync(pkg, 'utf8')).name === '@evomap/evolver') return dir;
  }
  return null;
}

// Returns { version, evolverDir, wire, skill, stripHubDeliveryMetadataForIntegrity, sender, http, envelope }, or
// calls fail(why, next) with what to do about it.
export async function connect(fail) {
  const evolverDir = evolverPackageDir();
  if (!evolverDir) fail('找不到本机的 evolver。', '先 npm install -g @evomap/evolver@latest，或设置 EVOLVER_PACKAGE_DIR 指向 @evomap/evolver 的安装目录。');
  const version = JSON.parse(readFileSync(join(evolverDir, 'package.json'), 'utf8')).version;
  const older = (v) => { const p = v.split('.').map(Number); for (let i = 0; i < 3; i++) if (p[i] !== MIN_EVOLVER[i]) return p[i] < MIN_EVOLVER[i]; return false; };
  if (older(version)) fail(`evolver 版本 ${version} 低于 ${MIN_EVOLVER.join('.')}，读不了 Gene 里的 skill 引用。`, 'npm install -g @evomap/evolver@latest');
  const mod = (pkg, file) => import(pathToFileURL(join(evolverDir, 'node_modules', '@evomap', pkg, 'dist', file)).href);
  const core = await mod('evolver-core', 'index.js');
  // The skill helpers moved from evolver-cli (2.0.54) into evolver-core; use whichever this install has.
  const skill = core.skill ?? { ...(await mod('evolver-cli', 'requiredSkills.js')), ...(await mod('evolver-cli', 'gitSkillSource.js')) };
  const { connectPublicHub, stripHubDeliveryMetadataForIntegrity } = await mod('evolver-adapter-public', 'index.js');
  const { HubFetch } = await mod('evolver-adapter-public', 'hubFetch.js');
  const { createRecipeHubFromEnv, ensureRecipeHubIdentity } = await mod('evolver-cli', 'recipe.js');
  let connected;
  try {
    const hub = createRecipeHubFromEnv(process.env, (opts) => (connected = { ...connectPublicHub(opts), senderId: opts.senderId, hubUrl: opts.hubUrl }));
    await ensureRecipeHubIdentity(hub);
  } catch (error) {
    fail(`连不上 EvoMap：${error.message}`, '先运行 evolver login，确认 evolver 能正常连 hub。');
  }
  const sender = connected.senderId();
  const http = new HubFetch({ baseUrl: connected.hubUrl, auth: connected.auth, senderId: connected.senderId, fetchFn: fetch });
  const envelope = (type, payload) => ({
    protocol: 'gep-a2a', protocol_version: '1.0.0', message_type: type,
    message_id: `msg_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`, sender_id: sender, timestamp: new Date().toISOString(), payload,
  });
  return { version, evolverDir, wire: core.wire, skill, stripHubDeliveryMetadataForIntegrity, sender, http, envelope };
}

export const publicAsset = async (id) => {
  const res = await fetch(`${HUB}/a2a/assets/${id}`);
  return res.status === 404 ? null : res.json();
};

// Finds the full record of `id` anywhere in a fetch answer, whatever envelope the Hub wraps it in.
export const recordIn = (data, id) => {
  if (Array.isArray(data)) for (const item of data) { const found = recordIn(item, id); if (found) return found; }
  else if (data && typeof data === 'object') {
    if (data.asset_id === id && data.type) return data;
    for (const value of Object.values(data)) { const found = recordIn(value, id); if (found) return found; }
  }
  return null;
};

// The Hub's fetch sometimes times out (seen 2026-11-21); a read is safe to repeat.
export async function fullRecord({ http, envelope }, id) {
  for (let attempt = 1; ; attempt++) {
    try {
      return recordIn(await http.call('POST', '/a2a/fetch', envelope('fetch', { asset_ids: [id] })), id);
    } catch (error) {
      if (error?.code !== 'HUB_UNREACHABLE' || attempt >= 4) throw error;
      await new Promise((done) => setTimeout(done, 10_000 * attempt));
    }
  }
}

const HUB_FIELDS = ['asset_id', 'gdi_score', 'source_node_id', 'status'];
export const published = (record) => Object.fromEntries(Object.entries(record).filter(([key]) => !HUB_FIELDS.includes(key)));

const SUMMARY_NOTE = /（此版本的 Gene 在前置条件中钉住 skill [^）]+，使用前先安装并阅读它。）$/;

// The new Capsule of a Gene: the old one pointed at the new Gene, its content opening with the pinned skill and its
// SKILL.md. The Hub refuses a Capsule whose content opens like one the node already holds (measured 2026-11-21: the
// old content with the skill appended was refused as already_published at similarity 1; with the skill first it was
// accepted), so what changed goes first and every other field follows, for the Gene's validation to read.
export function newCapsule({ wire }, oldCapsule, newGeneId, pin, skillMd) {
  const base = published(oldCapsule);
  const { name, repo, commit, path, sha256 } = pin;
  const pinned = { name, repo, commit, path, sha256, skill_md: skillMd };
  let content;
  try {
    // A Capsule from an earlier round already opens with required_skill; the new pin takes its place.
    const { required_skill: _previous, ...rest } = JSON.parse(base.content);
    content = JSON.stringify({ required_skill: pinned, ...rest });
  } catch {
    content = `required_skill: ${JSON.stringify(pinned)}\n\n${base.content.replace(/^required_skill: .*\n\n/, '')}`;
  }
  const summary = `${base.summary.replace(SUMMARY_NOTE, '')}（此版本的 Gene 在前置条件中钉住 skill ${name}，使用前先安装并阅读它。）`;
  const capsule = { ...base, gene: newGeneId, content, summary };
  capsule.asset_id = wire.computeAssetId(capsule);
  return capsule;
}
