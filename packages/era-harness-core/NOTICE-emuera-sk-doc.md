# 第三方数据声明：emuera.sk.doc 指令手册

本文件声明 `src/reference/data/` 下内置指令数据的来源、许可与更新方式。

**这份数据不是本仓库代码的一部分，许可与代码不同。**

## 来源

| 项 | 内容 |
|---|---|
| 上游仓库 | <https://github.com/qirchen421/emuera.sk.doc> |
| 抓取分支 | `feature/tutorial-restructure` |
| 抓取版本 | `606670cd78b58f5d9a050013d1d3f41db5a87a1b` |
| 抓取目录 | `docs/Reference/*.zh.md`（中文版页面，共 312 篇） |
| 抓取时间 | 见 `src/reference/data/meta.json` 的 `fetchedAt` |
| **本地正本** | 集群文档仓 `emuera.em.doc-1`（同一分支）的检出；`--local` 直接读它的 `docs/Reference/`，版本标识取该检出的 `git rev-parse HEAD`。**本机没有该检出时才走 GitHub raw**（在线兜底） |

> 快照与本地正本的漂移：本机实测 `606670c`（内嵌）与本地检出 HEAD `84937d9` 的
> **312 页正文逐字节相同**（只有生成文件头部的 sha 注释不同），即后续上游提交未改动
> Reference 页面内容。⇒ 目前重跑 `--local` 只会刷新 sha 与 `fetchedAt`，不产生内容变动。

## 许可

- 上游内容采用 **CC BY-NC 4.0**（Creative Commons 署名—非商业性使用 4.0 国际）。
  协议全文：<http://creativecommons.org/licenses/by-nc/4.0/>
- 本仓库的**代码**采用 **Apache-2.0**。
- 两者分开管理：内置指令数据（`src/reference/data/`）保持 CC BY-NC 4.0，
  不得以 Apache-2.0 名义再分发，也不得用于商业用途。

## 署名

内容著作权归 emuera.sk.doc 的上游贡献者所有。
每个生成文件顶部都带有来源与许可声明，转载或再分发时请保留该声明。

## 抓取脚本做了什么

`scripts/build-reference.ts` 只做三件事：

1. 按固定分支拉取 `docs/Reference/*.zh.md`（并发受限，5xx 退避重试，本地缓存到 `.cache/reference/`）；
2. 解析出**结构化字段**（页面 id、标题、签名表、覆盖的名字、首段摘要、引擎来源），正文做去噪后原样保留；
3. 生成 `src/reference/data/part-01.ts` ~ `part-08.ts` + `index.ts` + `meta.json`。

跳过 `README.zh.md`（97 KB 的总索引页，不是某一条指令）。

## 如何更新

```bash
cd "era-harness-plugin/packages/era-harness-core"
npm run build:reference                          # 默认分支，联网
npm run build:reference -- --offline             # 只用本地缓存重新生成
npm run build:reference -- --branch main
npm run build:reference -- --local <repo 路径>    # 本地正本（推荐）：读集群文档仓检出，⛔ 不联网
```

`--local` 接受两种给法：文档仓的检出根（自动拼 `docs/Reference`）或直接指到
`docs/Reference` 目录本身。它**完全不走网络**，版本标识取该检出的 HEAD commit；
检出不在约定分支时会打印警告但仍按该分支生成（要认这条分支就显式加 `--branch`）。
⛔ 该目录不在 git 工作树内时会直接报错——拿不到 commit 的内嵌数据无法溯源。

更新后请：

1. 跑 `npm test`（`test/reference.test.ts` 会校验条目数、名字数、id 唯一性与 sha 格式）；
2. 把 `meta.json` 里的新 sha 同步到本文件的「抓取版本」；
3. 检查知识库 `17-指令手册与跑引擎.md` 里记录的统计数字是否仍然成立。

## 在线优先版本

运行时默认**先取上游最新页**（`src/reference/online.ts`），取不到才回退到本目录的内置快照。
在线取到的页面**整页替换**本地条目，不做字段级合并，因此不会出现新旧混编。

- `ERA_HARNESS_REFERENCE_ONLINE=off` 可完全禁止联网；
- `ERA_HARNESS_REFERENCE_BASE=<raw 根>` 可指向自建镜像；
- MCP `lookup_reference` 工具的 `online` 参数可单次覆盖。

无论走哪条线，返回结果都会明确标注来源（`online` / `local`）。
