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
| `narrative-branching-counterfactual-gate` | 同上 Case 3 中的剧情分支部分 |
| `structured-level-map-concentric-harness` | 同上 Case 3 中的序章地图部分 |
| `combat-level-spatial-numeric-coupling` | 同上 Case 4.1 |
| `threejs-deterministic-vfx-composer` | 同上 Case 6 |

skill 正文按原文逐字收录，只在文件末尾补了换行。
