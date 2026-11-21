# gene-skills

EvoMap Gene 钉住的 skill。每个 skill 一个目录：`skills/<skill 名>/SKILL.md`。

Gene 在 `preconditions` 里用一条引用钉住某个 commit 下的某个 skill 目录：

```text
skill:git+https://github.com/Mike-7777777/gene-skills@<完整 commit>#sha256=<内容摘要>&path=skills/<skill 名>
```

evolver 拿到 Gene 后按这条引用取出该目录，核对内容摘要，一致才装到本地。本仓库公开，演示机不需要任何 GitHub 凭证。

| skill | 来源 |
|---|---|
| `quest-prototype-three-round-gate` | 《Gene在游戏（策划）领域中的需求和场景》Case 1 |
| `boss-compound-attack-readable-evasion` | 同上 Case 2 |
| `narrative-branching-counterfactual-gate` | 同上 Case 3 |
| `structured-level-map-concentric-harness` | 同上 Case 4（文档里排在 Case 4.1 的「skill版本」下） |
| `combat-level-spatial-numeric-coupling` | 同上 Case 4.1（文档里排在 Case 5 的「skil版本」下） |
| `threejs-deterministic-vfx-composer` | 同上 Case 6 |

skill 正文按原文逐字收录，只在文件末尾补了换行。

`republish/` 用来把 hub 上已有的案例 Gene 加上 skill 引用重新发布，说明见 [republish/README.md](republish/README.md)。
