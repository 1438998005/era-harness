# 第三方数据声明：emuera.sk.doc 指令手册

本文件声明 `src/reference/data/` 下内置指令数据的来源、许可与更新方式。

**这份数据不是本仓库代码的一部分，许可与代码不同。**

## 来源

| 项 | 内容 |
|---|---|
| 上游仓库 | <https://github.com/qirchen421/emuera.sk.doc> |
| 抓取分支 | `feature/tutorial-restructure` |
| 抓取版本 | `41451be6091363e37ed066aaf04416decbf0127f` |
| 抓取目录 | `docs/Reference/*.zh.md`（312 页，一页一条）<br>`docs/Emuera/*.zh.md`（20 页 → **65 条**，按 `###`/`####` 小节切段）<br>`docs/tutorial/*.zh.md`（27 页 → **27 条**，一页一条） |
| 抓取时间 | 见 `src/reference/data/meta.json` 的 `fetchedAt` |
| **本地正本** | 集群文档仓 `emuera.em.doc-1`（同一分支）的检出；`--local` 直接读它的 `docs/`，版本标识取该检出的 `git rev-parse HEAD`。**本机没有该检出时才走 GitHub raw**（在线兜底） |

> **2026-10-28 范围扩展**：原范围只有 `docs/Reference`（312 条 / 653 名字），
> 导致 `#LOCALSIZE`、`#DIM`、变量作用域这类**语法/规格问题两个知识库都查不到**。
> 现扩到三目录，条目 312 → **404**，名字 653 → **725**，覆盖上游 359 页。
>
> 规格页（`docs/Emuera`）必须**按小节切段**：`function.zh.md` 一页 19KB，
> 整页入库会被 `MAX_BODY_CHARS=4000` 截断（模型看到的正文里根本没有 `#LOCALSIZE`），
> 而且搜索时单页会霸榜。切段条目带 `localOnly: true`，**不随线上刷新**
> —— 否则在线整页替换会把 26 段并回一页再被截断，等于把修复退回原样。
>
> 跳过 `README.zh.md` / `CHANGELOG.zh.md` / `index.zh.md`（总索引与变更日志，不是单条指令）。

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

`scripts/build-reference.ts` 只做四件事：

1. 按固定分支拉取三个目录的 `*.zh.md`（并发受限，5xx 退避重试，本地缓存到 `.cache/reference/`）；
   Node 的 TLS 校验失败（企业代理/杀软中间人）时自动降级用 `curl` 重试；
2. 按目录分流解析：`docs/Reference` 一页一条，`docs/Emuera` 按小节切段，`docs/tutorial` 一页一条；
3. 解析出**结构化字段**（页面 id、标题、签名表、覆盖的名字、首段摘要、引擎来源），正文做去噪后原样保留；
4. 生成 `src/reference/data/part-*.ts` + `index.ts` + `meta.json`。

跳过 `README.zh.md` / `CHANGELOG.zh.md` / `index.zh.md`（总索引与变更日志，不是某一条指令）。

## 如何更新

```bash
cd "era-harness-plugin/packages/era-harness-core"
npm run build:reference                          # 默认分支，联网
npm run build:reference -- --offline             # 只用本地缓存重新生成（真离线，不碰网络）
npm run build:reference -- --branch main
npm run build:reference -- --local <repo 路径>    # 本地正本（推荐）：读集群文档仓检出，⛔ 不联网
```

`--local` 接受两种给法：文档仓的检出根（自动拼 `docs/`）或直接指到某个 `docs/` 子目录本身。
它**完全不走网络**，版本标识取该检出的 HEAD commit；
检出不在约定分支时会打印警告但仍按该分支生成（要认这条分支就显式加 `--branch`）。
⛔ 该目录不在 git 工作树内时会直接报错——拿不到 commit 的内嵌数据无法溯源。

`--offline` 只读 `.cache/reference/` 下的缓存与 `tree-<sha12>.json`。**没有缓存时会直接报错**，
不会偷偷联网（旧实现有这个 bug：`--offline` 仍会去拉 tree）。

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

无论走哪条线，返回结果都会明确标注来源（`online` / `local` / `discovered`）。

**2026-10-28 起的三个变化**：

1. **可发现新页**：本地快照没有的名字，会拿它去上游
   `https://qirchen421.github.io/emuera.sk.doc/search/search_index.json`（MkDocs 生成的搜索索引，
   约 1.0MB / 9,468 条）检索一次，命中就按 `sourcePath` 拉正文，标 `origin: 'discovered'`。
   ⚠ 该索引是**日文站**的（`/zh/search/` 是 404），所以拉丁指令名发现可靠、中文关键词不可靠。
2. **取上游用 `sourcePath`，不用 `id`**：规格页切段后 id 会含 `#` 与 `/`（`Emuera/function#LOCALSIZE`），
   拼进 URL 会得到非法路径。`SAFE_PATH_RE` 只放行 `docs/**/*.zh.md` 且显式拒绝 `..`。
3. **切段条目 `localOnly`**：规格页切段条目**不随线上刷新**，见上方说明。

**已知环境问题**：本机 Node 访问 `api.github.com` / `raw.githubusercontent.com` 报
`UNABLE_TO_GET_ISSUER_CERT_LOCALLY`（企业代理/杀软 TLS 中间人；`curl` 与 `github.io` 正常）。
这种情况下在线层会静默回退本地快照 —— 现在会在工具结果里明说「本次使用内置离线快照」。
根治办法：设 `NODE_EXTRA_CA_CERTS=<根证书路径>`。⛔ 不要用 `NODE_TLS_REJECT_UNAUTHORIZED=0`。
