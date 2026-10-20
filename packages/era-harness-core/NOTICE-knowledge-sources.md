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

shared-trae 是 Emuera 集群的私有枢纽仓（`$EMUERA_WS/emuera/shared-trae`）。
**内嵌副本是快照，正本在 shared-trae**；正本变更（commit/日期变化）时按下方流程同步。

## 许可与边界

- 代码（含本模块的 TypeScript）为 **Apache-2.0**。
- 条目内容为**机制与纪律的事实性提炼**：⛔ 不复制任何游戏脚本正文、错误消息外的长文本、
  或带路径/行号的工程状态——那些留在 shared-trae 正本，不随 vsix 分发。
- 与指令数据（`src/reference/data/`，CC BY-NC 4.0，见 `NOTICE-emuera-sk-doc.md`）分开管理：
  两者许可不同，不要混放。

## 如何更新

1. 正本先行：在 shared-trae 对应 `knowledge/<domain>/` 条目上改（含证据与实证）。
2. 回到本包：改 `src/knowledge/data/<条目>.ts` 的 `rules` / `pitfalls` / `body`，
   并更新 `source.snapshotAt`（若跨日期，同步 `data/index.ts` 的 `KNOWLEDGE_SNAPSHOT_AT`）。
3. 跑 `npm test`（`test/knowledge.test.ts` 校验条目数、id 唯一性、溯源字段与检索冒烟）。
4. 新增条目：在 `data/` 建文件 → `data/index.ts` 数组登记 → 更新本表 → 更新测试计数期望。

## 检索与消费

- MCP：`lookup_knowledge`（按 id 取完整条目）、`search_knowledge`（关键词检索，可离线）。
- 提示层：`knowledgeRulesFor(entries, id)` 取铁律短句，供 `era_domain` 注入。
