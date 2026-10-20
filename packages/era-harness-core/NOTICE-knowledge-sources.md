# 第三方数据声明：内嵌知识库（src/knowledge/）

本文件声明 `src/knowledge/data/` 下内嵌知识条目的来源、许可边界与更新方式。

## 来源

| 条目 id | 正本（shared-trae 仓内路径） | 快照日期 |
|---|---|---|
| `interpreter-encoding-discipline` | `knowledge/lazyloading/encoding-discipline.md` | 2026-10-20 |
| `update-merge-gates` | `knowledge/eratw/import-merge-gates.md` | 2026-10-20 |
| `kojo-structure-contracts` | `knowledge/eratw/kojo-naming-rules.md`（＋ `kojo-script-index-system.md` / `kojo-multi-scenario-system.md`） | 2026-10-20 |
| `project-structure-discipline` | `knowledge/eratw/project-structure.md`（＋ `variable-slot-allocation.md` / `clothes-system.md`「死规矩 2 现语义」段 / `qol-system.md` NOW_VERSION 铁律） | 2026-10-21 |
| `main-flow-pipeline` | `knowledge/eratw/game-flow-command-pipeline.md`（引擎侧 TRAIN 循环：`knowledge/erabasic/event-functions.md` §4） | 2026-10-21 |
| `obj-qol-conventions` | `knowledge/eratw/obj-system.md`（＋ `clothes-system.md`「死规矩 2 现语义」段 / `identifier-tag-system/` 域） | 2026-10-21 |
| `version-up-and-save-migration` | `knowledge/eratw/kojo-script-index-system.md`（「版本更新时的主动切换与自愈链（UPDATE_MAIN）」＋「剧本增删对存档的影响（迁移判据）」两段；＋ `newgame-plus-system.md`） | 2026-10-21 |

shared-trae 是 Emuera 集群的私有枢纽仓（`$EMUERA_WS/emuera/shared-trae`）。
**内嵌副本是快照，正本在 shared-trae**；正本变更（commit/日期变化）时按下方流程同步。

## 许可与边界

- 代码（含本模块的 TypeScript）为 **Apache-2.0**。
- 条目内容为**机制与纪律的事实性提炼**：⛔ 不复制任何游戏脚本正文、错误消息外的长文本、
  或带路径/行号的工程状态——那些留在 shared-trae 正本，不随 vsix 分发。
- 与指令数据（`src/reference/data/`，CC BY-NC 4.0，见 `NOTICE-emuera-sk-doc.md`）分开管理：
  两者许可不同，不要混放。

## 候选池（T1.2 持续补充用）

> 候选清单的**正本＝本包 [`knowledge-candidates.json`](knowledge-candidates.json)**（机器可读，随产品走），
> 这里不再复制表格——两处抄必漂移（2026-10-21 的治理缺口①就是这么闭合的）。
>
> 校验：`node scripts/check-knowledge-pool.mjs`（已并入 `npm run gate`）。它查四件事：
> ① 候选的**三要素**（面多大／会不会很快过期／为什么这么裁）填没填，暂缓项还须写触发条件；
> ② `sources` 指向的 shared-trae 正本文件**在不在**（拿不到正本仓时如实标未核，⛔ 当通过）；
> ③ 记为 `landed` 的是否真有 `data/<条目>.ts`、登记进 `index.ts`、且有本表来源行；
> ④ `consumption.resident` ⇄ `era_domain.ts` 的 `injectedKnowledgeIds` **一字不差**（档位口径与代码分家＝静默失效）。
>
> **进产品判据**（每次新增前自问）：① 跨整合包版本稳定（⛔ 收工程魔改现状）；② 能指回 shared-trae 正本；
> ③ 与在册条目不重叠（重叠就补进已有条目，不新开）；④ 装得进一条（装不下说明该切分或暂缓）。
>
> **消费档位口径**：常驻＝几乎所有 era 改动都要遵守的那几条（清单在 JSON 里，现算为准）；
> 其余只进检索。新条目**默认只进检索**，要常驻必须单独论证（常驻会让 era 域提示多约 10 条 / 900 字）。

## 如何更新

1. 正本先行：在 shared-trae 对应 `knowledge/<domain>/` 条目上改（含证据与实证）。
2. 回到本包：改 `src/knowledge/data/<条目>.ts` 的 `rules` / `pitfalls` / `body`，
   并更新 `source.snapshotAt`（若跨日期，同步 `data/index.ts` 的 `KNOWLEDGE_SNAPSHOT_AT`）。
3. 跑 `npm test`（`test/knowledge.test.ts` 校验条目数、id 唯一性、溯源字段、**检索排序锁**与 tag 独占抓手）。
4. 新增条目五步：`knowledge-candidates.json` 立候选（三要素填全）→ 建 `data/` 文件 →
   `data/index.ts` 登记 → 更新本表来源行 → 测试计数与排序锁补一行；
   收尾 `npm run gate`（其中的「知识候选池核对」就是查这条链有没有断）。
5. 常驻/检索档位改了，要同步 `knowledge-candidates.json` 的 `consumption.resident`
   （体检脚本会拿它和 `era_domain.ts` 的 `injectedKnowledgeIds` 对表，不一致即报）。

## 检索与消费

- 扩展内原生工具：`era_knowledge`（mode=lookup / search / list，纯离线；条目目录从 `KNOWLEDGE_ENTRIES` 现算）。
- MCP：`lookup_knowledge`（按 id 取完整条目）、`search_knowledge`（关键词检索，可离线）——同一份条目表，给独立进程与其他宿主。
- 提示层：`knowledgeRulesFor(entries, id)` 取铁律短句，供 `era_domain` 注入（常驻子集由 `injectedKnowledgeIds` 指定，其余只按需检索）。
