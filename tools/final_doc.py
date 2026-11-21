#!/usr/bin/env python3
"""Render the upload sheet for the republished case Genes (Markdown, for the Feishu doc) from republish/manifest.json.

Usage: python3 tools/final_doc.py <commit> > out.md
"""
import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
COMMIT = sys.argv[1]
GH = f'https://github.com/Mike-7777777/gene-skills/blob/{COMMIT}'
RAW = f'https://raw.githubusercontent.com/Mike-7777777/gene-skills/{COMMIT}'
ASSET = 'https://evomap.ai/asset/'
RECIPE = 'https://evomap.ai/a2a/recipe/'
CASES = {
    'gene_quest_three_round_hidden_gate_v1': 'Case 1 生存 RPG 新手任务',
    'gene_boss_compound_attack_readable_evasion_v2': 'Case 2 Boss 攻击模组',
    'gene_magiscapes__narrative_branching__consequence_propagation_and_counterfactual_diff': 'Case 3 剧情分支',
    'gene_structured_level_map_concentric_topology_harness': 'Case 4 序章地图',
    'gene_magiscapes_combat_spatial_numeric_coupling_harness': 'Case 4.1 战斗副本',
    'gene_nl_to_ue_archetype_threejs_vfx_v1': 'Case 6 技能特效',
}
m = json.loads((ROOT / 'republish/manifest.json').read_text())


def recipe_title(recipe_id):
    with urllib.request.urlopen(f'{RECIPE}{recipe_id}', timeout=30) as res:
        data = json.load(res)
    return (data.get('recipe') or data).get('title', '')


RECIPES = {r: recipe_title(r) for e in m['genes'] for r in e['recipes']}
SKILLS = m['skills_commit']
L = []
add = L.append
add('# 案例 Gene 终版：skill 加入交付前试玩验收')
add('')
add('《Gene在游戏（策划）领域中的需求和场景》里的 6 个案例 Gene 各在前置条件里钉住公开仓库 [Mike-7777777/gene-skills](https://github.com/Mike-7777777/gene-skills) 的一份 skill。插件或 MCP 召回 Gene 后，evolver 按这行引用取出 skill、核对内容摘要后装到本地，模型读完 skill 再动手。这一版把 6 个 Gene 的引用换到新版本的 skill；skill 已在仓库里，上传只涉及 Gene、Capsule 和组合方案。')
add('')
add('Case 5（Roguelike）文档里没有对应的 skill，它的 Gene 不改。')
add('')
add('# 1. 改动')
add('')
add(f'skill 换到仓库 commit [`{SKILLS[:7]}`](https://github.com/Mike-7777777/gene-skills/tree/{SKILLS})：')
add('')
add('- 每份 skill 新增「交付前真实试玩验收」一节：交付前在真实浏览器里用键盘和鼠标把最终交付的页面完整玩一遍，主流程、失败后重开、每条分支都要走通并截图，控制台零报错，发现问题修完再走一遍；另附各领域要重点检查的两项，例如任务原型要试先建工作台的顺序，地图要逐格核对交付页面和生成器一致。')
add('- 技能特效的 skill 补回了三段包络函数、刀光镜像规范、界面分层规则和验收标准，和文档原文一致。')
add('')
add('以 hub 上节点 `node_1caa18cad28626cf` 现在的版本为底：')
add('')
add('- Gene 只改前置条件里那行 skill 引用的 commit 和内容摘要，其余字段（摘要、触发信号、标签、策略等）原样不动。引用格式为 `skill:git+<仓库>@<commit>#sha256=<内容摘要>&path=<skill 目录>`。')
add('- Capsule 沿用现在的，`gene` 改成新 Gene 的编号，正文 `content` 开头的 `required_skill`（skill 引用和 SKILL.md 原文）换成新版本，其余内容原样保留。')
add('- 组合方案的步骤里旧 Gene 编号换成新的，标题和其余步骤不变。')
add('')
add('走插件的客户端（ZCode 等）需要 evolver-agent-plugin 1.0.15 或更新版本才会注入钉了 skill 的 Gene。')
add('')
add('# 2. 上传')
add('')
add('两种方法结果相同，任选其一。都要在发布这批 Gene 的那台电脑上、用节点 `node_1caa18cad28626cf` 的身份操作。')
add('')
add('## 2.1 一条命令')
add('')
add('需要 Node.js 18 或更新、git，以及已登录的 evolver 2.0.54 或更新版本。脚本用本机 evolver 的登录身份签名，不读取任何密钥。')
add('')
add('```bash\ngit clone https://github.com/Mike-7777777/gene-skills.git\ncd gene-skills\nnode republish/republish.mjs\n```')
add('')
add('这一步只检查、不改任何东西。全部通过后执行：')
add('')
add('```bash\nnode republish/republish.mjs --apply\n```')
add('')
add(f'它按 2.2 节的顺序完成全部操作，任何一步失败就停在那里并说明下一步。说明见 [republish/README.md]({GH}/republish/README.md)。')
add('')
add('## 2.2 手动上传')
add('')
add('按下面顺序做，前一步全部成功再做下一步：')
add('')
add('1. 发布：每个 Case 把第 3 章列出的新 Gene 和新 Capsule 作为一组 `[Gene, Capsule]` 发布（`POST /a2a/publish`）。两个文件里没有 `asset_id`，发布前用 evolver 的 `computeAssetId` 算出；算出的编号应等于表中的「新 Gene」「新 Capsule」。')
add('2. 替换组合方案：已发布的组合方案不能直接修改（hub 返回 `only_draft_can_be_updated`）。对下表每个组合方案各做一次：`POST /a2a/recipe/<id>/fork` 得到草稿，`PATCH` 草稿的 `genes`（旧 Gene 编号换成新的，其余步骤不变）并把 `title` 改回原标题，`POST /a2a/recipe/<草稿 id>/publish`，最后 `POST /a2a/recipe/<原 id>/archive`。刚发布的 Gene 偶尔要等几十秒才能放进组合方案，遇到 `recipe_asset_unavailable` 稍等再试。')
add('3. 撤回：用 `POST /a2a/asset/self-revoke` 撤回表中的旧 Gene 和旧 Capsule。')
add('')
add('需要替换的组合方案（链接是 hub 接口返回的 JSON，能看到标题和每一步引用的 Gene 编号）：')
add('')
add('| 组合方案 | 内容 |')
add('|---|---|')
for k, v in RECIPES.items():
    add(f'| [`{k}`]({RECIPE}{k}) | {v} |')
add('')
add('hub 限制同一节点 24 小时内用同一组触发词最多发布 5 次，被拒的尝试也计数。发布失败先查清原因再重试，不要连续重试。')
add('')
add('hub 还限制每个节点 24 小时内最多撤回 5 个已晋升资产。这一轮要撤 6 个旧 Gene 和 6 个旧 Capsule，加上之前待撤的，需要分几天撤完：先撤旧 Gene，旧 Capsule 放后面。用 2.1 的脚本时，额度用完它会停在撤回这一步，第二天再运行同一条 `--apply` 命令接着撤。')
add('')
add('# 3. 各 Case 终版')
add('')
add(f'要撤回的旧 Gene 和旧 Capsule 链接到 EvoMap 上的资产页面，点开能看到它的内容。新 Gene 和新 Capsule 上传后才有页面，表里只写编号。')
add('')
for i, e in enumerate(m['genes'], 1):
    add(f'## 3.{i} {CASES[e["id"]]}')
    add('')
    add('| 项目 | 内容 |')
    add('|---|---|')
    add(f'| Gene `id` | `{e["id"]}` |')
    add(f'| 钉住的 skill | [{e["skill"]}]({GH}/skills/{e["skill"]}/SKILL.md) |')
    add(f'| 新 Gene | `{e["new_asset_id"]}` |')
    add(f'| 新 Capsule | `{e["new_capsule_asset_id"]}` |')
    add(f'| 撤回旧 Gene | [`{e["old_asset_id"]}`]({ASSET}{e["old_asset_id"]}) |')
    add(f'| 撤回旧 Capsule | [`{e["old_capsule_asset_id"]}`]({ASSET}{e["old_capsule_asset_id"]}) |')
    add(f'| 组合方案 | {"、".join(f"[`{r}`]({RECIPE}{r})" for r in e["recipes"]) or "无"} |')
    add(f'| 文件 | [Gene JSON]({RAW}/republish/genes/{e["id"]}.json)、[Capsule JSON]({RAW}/republish/capsules/{e["id"]}.json) |')
    add('')
    add('新 Gene 全文：')
    add('')
    gene = json.loads((ROOT / f'republish/genes/{e["id"]}.json').read_text())
    add('```json\n' + json.dumps(gene, ensure_ascii=False, indent=2) + '\n```')
    add('')
new_ids = {e['id']: e['new_asset_id'] for e in m['genes']}
add('# 4. 召回测试 prompt')
add('')
add(f'下面每条 prompt 应召回对应的 Gene，用来检查和调整召回。文件和清单在仓库的 [prompts/]({GH}/prompts)。除注明的两条外，都按《Gene在游戏（策划）领域中的需求和场景》原文逐字收录。')
add('')
for i, item in enumerate(json.loads((ROOT / 'prompts/index.json').read_text()), 1):
    add(f'## 4.{i} {item["case"]}')
    add('')
    target = new_ids.get(item['gene']) or item.get('asset')
    note = '新版本，上传后生效' if item['gene'] in new_ids else '这个 Gene 不改，是线上现有版本'
    add(f'应召回：`{item["gene"]}`（`{target}`，{note}）。')
    if item['source'] == 'written':
        add('')
        add('原文档里这个 Case 没有 prompt，下面这段是补写的。')
    add('')
    add('```text\n' + (ROOT / 'prompts' / item['file']).read_text().strip() + '\n```')
    add('')
first = m['genes'][0]
add('# 5. 核对')
add('')
add('任选一个新 Gene，在一个空目录里运行下面的命令（以 Case 1 为例）。命令会先取 Gene，再装上它钉住的 skill：')
add('')
add(f'```bash\nevolver skill fetch --asset {first["new_asset_id"]} --out . --write\n```')
add('')
add('目录里出现 `skills/quest-prototype-three-round-gate/SKILL.md`，且和仓库里同名文件内容一致，就说明这个 Gene 上传正确、能被取到。组合方案用 `GET https://evomap.ai/a2a/recipe/<新 id>` 查看，步骤里应是新 Gene 的编号。')
sys.stdout.write('\n'.join(L) + '\n')
