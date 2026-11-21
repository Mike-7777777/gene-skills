#!/usr/bin/env python3
"""Render the upload sheet for the republished case Genes (Markdown, for the Feishu doc) from republish/manifest.json.

Usage: python3 tools/final_doc.py <commit> > out.md
"""
import json
import sys
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
RECIPES = {
    'cmwninv7v0ov96s3hekw257k8': '2D RPG/生存游戏新手委托可试玩原型（Case 1）',
    'cmwnr0qey05wna63eksm1ni7f': '2D 俯视角 Boss 战招式与技能特效（Case 2 与 Case 6）',
    'cmwnr0kg305via63enlh708xf': '2D 俯视角动作 RPG 可试玩战斗副本（Case 4.1）',
}
m = json.loads((ROOT / 'republish/manifest.json').read_text())
L = []
add = L.append
add('# 案例 Gene 终版：纯 skill 版')
add('')
add('《Gene在游戏（策划）领域中的需求和场景》里的 6 个案例 Gene 改为纯 skill 版：做法和细节全部在 skill 里，Gene 只负责被找到并把 skill 带给模型。插件或 MCP 召回 Gene 后，evolver 按前置条件里的引用从公开仓库 [Mike-7777777/gene-skills](https://github.com/Mike-7777777/gene-skills) 取出对应 skill，核对内容摘要后装到本地，模型读完 skill 再动手。skill 已在仓库里，上传只涉及 Gene、Capsule 和组合方案。')
add('')
add('Case 5（Roguelike）文档里没有对应的 skill，它的 Gene 不改。')
add('')
add('# 1. 改动')
add('')
add('以 hub 上节点 `node_1caa18cad28626cf` 现有的版本为底：')
add('')
add('- Gene 保留用来找到它的字段，原样不动：`type`、`id`、`category`、`domain`、`summary`、`signals_match`、`metadata`、`schema_version`。')
add('- Gene 的前置条件（`preconditions`）只有一行 skill 引用，格式为 `skill:git+<仓库>@<commit>#sha256=<内容摘要>&path=<skill 目录>`。')
add('- Gene 的策略（`strategy`）只有 2 条：第 1 条让模型先安装并通读 skill，第 2 条用一句话概括这份 skill 的做法。hub 要求策略至少 2 条、每条至少 15 字。')
add('- Gene 去掉其余字段：长策略、约束、不变量、校验命令、验收清单等和 skill 重复的内容，以及 `confidence`、`success_streak`。evolver 把后两个当作 hub 的排名数据，校验 Gene 编号前会先删掉它们，Gene 带着它们时编号对不上，命令行和 MCP 都按编号取不到它。')
add('- Capsule 沿用原来的，`gene` 改成新 Gene 的编号；正文 `content` 开头加一段 `required_skill`（skill 引用和 SKILL.md 原文），原有内容全部保留在后面；`summary` 末尾加一句说明。hub 会拒收正文开头和本节点已有 Capsule 相同的新 Capsule，所以新内容放在开头。')
add('')
add('插件（evolver-agent-plugin）原来会跳过策略少于 4 步的 Gene。对钉了 skill 的 Gene 放开这一限制的改动在 [EvoMap/evolver-agent-plugin#106](https://github.com/EvoMap/evolver-agent-plugin/pull/106)，合并发版之前，ZCode 等走插件的客户端召回到这些 Gene 也不会注入；MCP 和命令行不受影响。')
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
add('2. 替换组合方案：已发布的组合方案不能直接修改（hub 返回 `only_draft_can_be_updated`）。对 3 个组合方案各做一次：`POST /a2a/recipe/<id>/fork` 得到草稿，`PATCH` 草稿的 `genes`（旧 Gene 编号换成新的，其余步骤不变）并把 `title` 改回原标题，`POST /a2a/recipe/<草稿 id>/publish`，最后 `POST /a2a/recipe/<原 id>/archive`。刚发布的 Gene 偶尔要等几十秒才能放进组合方案，遇到 `recipe_asset_unavailable` 稍等再试。')
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
