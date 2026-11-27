# Claude Code Game Studios：一套模板，六个 Gene

收录 [Claude Code Game Studios](https://github.com/Donchitos/Claude-Code-Game-Studios) v1.3.0（MIT，作者 Donchitos，上游 commit `abc0de7`）的 ZCode 移植版：49 个 agent、78 个 skill、hooks、脚本和文档，共 867 个文件，内容未改。

## 1. 结构

- 这套框架是一个完整的项目模板：78 个 skill 里有 75 个会调用模板里的脚本、文档和 hooks，hooks 要在项目根目录的 `.zcode/config.json` 里注册才生效。所以它不按 skill 拆分，而是整套装进项目根目录。
- 模板放在本仓库的分支 `ccgs/template`，commit `0c27757`，tree `d5f3398`。分支不能删除或强推。
- 分支 `ccgs/ccgs-studio-setup` 上是一个只有两个文件的安装 skill：`install.sh` 按固定 commit 取模板，核对 tree id，只补缺失的文件；已有文件一律保留，模板版本另存为 `<文件>.ccgs-new` 并列出来。正文与本目录的 `setup-SKILL.md`、`install.sh` 一致。
- 六个 Gene 都钉住这个安装 skill，区别在触发词和装完交给哪个命令：

| Gene | 召回场景 | 装完运行 | asset id |
|---|---|---|---|
| `gene_ccgs_setup_v1` | 要这套游戏工作室框架 | 按需求选下面任一命令 | `sha256:796e40c1fd2c8e2df5a971a83ddd9a6af6f417295a0bff5b479361190b12e848` |
| `gene_ccgs_prototype_v2` | 做个游戏、把点子做成可玩原型 | `/prototype <想法>` | `sha256:8994d4df50186158bc5c7ef896fa9b26415a1a2c8eb8091dccdcd5ef05691351` |
| `gene_ccgs_start_v1` | 游戏开发新手、不知从哪开始 | `/start` | `sha256:c93575d8fcc7ff18e37e7ebf5ec427441bcccaf0ab08eaa7d029b69a0e403e28` |
| `gene_ccgs_brainstorm_v1` | 想游戏点子、Game Jam 选题 | `/brainstorm` | `sha256:fc1ea5c5e45db17a62f566ebdedca0306ce6c0ab210f35e7f543b19ab12223aa` |
| `gene_ccgs_adopt_v1` | 已有游戏项目接入 | `/prototype --from <路径>` 或 `/adopt` | `sha256:fd41b1eddc2a7ee31f6b4dc4d7a9f2bae1f86c5fab7b282fedeeeeb5a13665c5` |
| `gene_ccgs_launch_checklist_v1` | 上线前检查 | 用户亲自输入 `/launch-checklist` | `sha256:151e81169a7646a18560c8224dcea531182f02d663264eab4a32d9febb6cd3f0` |

## 2. 用法

```bash
evolver skill fetch --asset gene_ccgs_prototype_v2 --out .agents --write
sh .agents/skills/ccgs-studio-setup/install.sh .
```

然后以这个目录为根重开 ZCode（agent、skill 和 hooks 只在会话开始时加载），输入 `/prototype <想法>` 或 `/start`。取模板约 15 秒。

## 3. 发布

```bash
node ccgs/publish.mjs                        # 取安装 skill 和模板里的入口 skill、生成 Gene 与 Capsule、本地跑校验，不改 hub
node ccgs/publish.mjs --apply [--only <入口>]  # 发布并读回，结果写进 manifest.json
```

| 文件 | 内容 |
|---|---|
| `meta.json` | 每个 Gene 的编号、摘要和触发词 |
| `branches.json` | 模板分支与安装 skill 分支的 commit、tree 和内容摘要 |
| `assets/` | 生成的 Gene 与 Capsule |
| `manifest.json` | hub 上的编号与状态 |

发布前按 hub 的规则自查：触发词长度、摘要长度、Capsule 正文不超过 32000 字符、校验命令里没有 `$`、反斜杠和反引号、渲染出的 skill 名互不重复也不和钉住的 skill 重名、任意两份 Capsule 按 hub 比较的文本（正文、策略和代码）相似度低于 0.8、Gene 和 Capsule 都不命中 hub 的伦理规则。Capsule 带上问题说明和代码（安装 Gene 带 `install.sh` 的 diff，入口 Gene 带各自的命令序列），`gene_ccgs_prototype_v2` 的 Capsule 在 hub 上的内容质量分为 70%。
