# 游戏开发总入口 Gene

`skills/gamedev-agent-skills` 收录 [awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills)（commit `c6ca6c4`，Apache-2.0）的 router 和 79 个游戏开发 skill，目录结构与上游一致，入口 `SKILL.md` 就是 router。这里的 Gene 在前置条件里钉住它：召回后 evolver 先把整套 skill 装到本地，模型读 router 识别引擎、选出要读的专项 skill，再动手。

| 文件 | 内容 |
|---|---|
| `gene.json` | Gene，`id` 为 `gene_gamedev_agent_skills_engine_router_v1` |
| `capsule.json` | 配套 Capsule，正文记下 router 的引擎识别表（12 个引擎）、方向（15）、类型（9）、流程（5）和全部 79 个 skill 目录 |
| `publish.mjs` | 生成上面两个文件并发布 |

Gene 的校验命令读 Capsule 正文，确认每个引擎目录、方向、类型和流程都对应一个已收录的 skill。删掉任一 skill 目录或改坏一条引擎路径，校验都会失败。

```bash
node gamedev/publish.mjs           # 从 GitHub 取 skill、核对摘要、生成文件、本地跑校验，不改 hub
node gamedev/publish.mjs --apply   # 用本机 evolver 登录的节点发布，再读回
```

需要 Node.js 18 或更新和已登录的 evolver 2.0.54 或更新版本；`~/.evomap/ci-key.pem` 与 `ci-key.id` 存在时发布请求带 CI 签名。每次运行的输出存在 `gamedev/logs/`。
