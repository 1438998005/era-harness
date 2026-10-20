import type { KnowledgeEntry } from '../types.js';

/**
 * 导入/合并总闸门（G1–G8）。
 * 正本：shared-trae `knowledge/eratw/import-merge-gates.md`（2026-10-13 建立，
 * anon-tw 审查实证归纳）。本副本只收**判据**（集群脚本工具名不内嵌）。
 */
export const updateMergeGatesEntry: KnowledgeEntry = {
  id: 'update-merge-gates',
  domain: 'update',
  title: '导入/合并总闸门（G1–G8）',
  summary:
    '上游内容（社区版更新、口上包、模板）合入本地工程前的八条必做闸门：回归扫描、双侧 RAND、派发串拼写、调用方 grep、FSYN 键、HPH 去化、编码结构、标识符键预检。',
  tags: ['更新', '合并', '导入', '移植', '整包更新', '闸门', 'G1', '回归', 'RAND', 'FSYN', 'HPH', 'update', 'merge', '社区版'],
  rules: [
    {
      id: 'gate-g1',
      text: '包更新回归扫描：整包覆盖后，必须对本工程既知 bug 模式做回归扫描（按 bug 串搜增删史）。「修过」≠「还在」，不能因修过就跳过。',
    },
    {
      id: 'gate-g2',
      text: '双侧 RAND 校验：RAND:N 的 CASE 分支数必须两侧都查——CASE≥RAND 不可达 与 RAND>分支数落空；且必须与更新前基线对表，存量不算本次回归。',
    },
    {
      id: 'gate-g3',
      text: '派发串↔标签名拼写一致：TRYCALLFORM 拼出的函数名与真实标签差一个字符就静默跳过。剧本导入/更新/任何剧本检查必查拼写。',
    },
    {
      id: 'gate-g4',
      text: '函数名/模板改动先 grep 调用方：函数存在≠函数被调；照搬无人调用的新模板函数＝功能整体失效。',
    },
    {
      id: 'gate-g5',
      text: 'FSYN 键回英文原文取键：照抄上游英文键会打印错误串；正解是回英文原文看原键，不新增 CASE。',
    },
    {
      id: 'gate-g6',
      text: 'HPH_PRINT 去化判据：字符串仍含 HPH/BPB ⇒ 去化必回归（粉色 /// 陷阱）。',
    },
    {
      id: 'gate-g7',
      text: '编码/结构：上游包常为 LF 须转 CRLF；UTF-8 BOM 保持；合并后做块结构配对检查（IF/FOR/SELECTCASE 等）。',
    },
    {
      id: 'gate-g8',
      text: '标识符键预检：新内容键不在既有键集 ⇒ 逐条列本地化待办；撞名审计（同名不同号/同号不同名）。',
    },
  ],
  pitfalls: [
    {
      symptom: '只跑单侧 RAND 检查就宣布安全',
      cause: '漏了「落空」侧（RAND>分支数）',
      fix: '双侧都查，并与更新前基线对表',
    },
    {
      symptom: '整包 copy 后只看骨架 diff 就说「无叠加」',
      cause: '对纯台词追加静默',
      fix: '配台词级 diff 与反向补扫（纯删除型差异也要扫）',
    },
    {
      symptom: '包更新后不回归扫描既知修复',
      cause: '「修过」≠「还在」，整包覆盖会冲掉本地修复',
      fix: 'G1：按已知 bug 串全仓复扫',
    },
    {
      symptom: '按物理行号对齐两版文件',
      cause: '翻译增删行后行号漂移',
      fix: '按内容/序号锚点对齐，不按行号',
    },
    {
      symptom: '拿上游日文/英文标识符改本地中文定名',
      cause: '本地 CSV 中文名才是运行正名',
      fix: '定名以本地 CSV 为准；上游形查不到就停下上报，不猜',
    },
  ],
  body: `# 导入/合并总闸门（快照 2026-10-20）

凡把上游内容（社区版更新 / 作者整包更新 / 模板更新 / 新剧本导入）合入本地工程，先过本表。
era-harness 的「更新 eraTW」在计划（plan）与合并（merge）阶段实现这些判据。

## G1–G8 闸门总表

| # | 闸门 | 判据 |
|---|---|---|
| G1 | 包更新回归扫描 | 对既知 bug 模式按串搜增删史；大修轮的覆盖清单本身也复扫 |
| G2 | 双侧 RAND 校验 | CASE≥RAND 不可达 ＋ RAND>分支数落空；pre↔post 对表 |
| G3 | 派发串↔标签名拼写 | TRYCALLFORM 拼名差一字符即静默跳过；模板也要查 |
| G4 | 函数名改动先 grep 调用方 | 定义点＋调用点两侧；无人调用＝失效 |
| G5 | FSYN 键回英文原文 | 照抄译名打印错误串；不新增 CASE |
| G6 | HPH_PRINT 去化判据 | 字符串仍含 HPH/BPB ⇒ 必回归 |
| G7 | 编码/结构 | LF→CRLF；BOM 保持；块结构配对 |
| G8 | 标识符键预检 | 新键列待办；撞名审计 |

## 场景分流（更新计划阶段）

- 作者整包更新（vX.XX 类）：五步——本地改造清单 → 标签级增减对比 → 归一化 diff → 语法扫描 → 应用修正。
- 上游 commit 端口：hunk 对位、路径映射、「修复≠替换」。
- 新剧本导入：标识符预检（R1–R4：宏名/字符串键/函数调用/需本地化键）。

## 与更新工具的对应

- plan 阶段：**已实现 G2/G3/G4/G6/G7**（src/core/update/gates.ts + labels.ts）——
  对改动脚本（上限 300 个）跑内容闸门；G4 另建全树标签索引查「被删函数的改动集外调用方」
  （labelScan: false 可关）。冲突分组：口上按角色整包问、本体逐文件问。
- merge 阶段：G5/G6 判据 + 配平容差（合并结果失衡量落在三方输入集合内）。
- apply 阶段：G7（编码/BOM/CRLF）+ 落盘后自检（sha 对账）。
- ⛔ 首次同步（无基线）：按 mtime 批量特征区分「上游旧版」与「人手改过」，不可靠时必须让用户二选一。
- **未实现**：G1（git log -S 回归扫描，需本地 git 仓）、G5（FSYN 键回英文原文）、
  G8（标识符键预检，需键账本）——留待后续批次。

> 完整正本（含场景分流表与集群工具链）：shared-trae \`knowledge/eratw/import-merge-gates.md\`。
`,
  source: {
    upstream: 'shared-trae/knowledge/eratw/import-merge-gates.md',
    snapshotAt: '2026-10-20',
  },
};
