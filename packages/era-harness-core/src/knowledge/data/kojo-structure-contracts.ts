import type { KnowledgeEntry } from '../types.js';

/**
 * 口上（剧本）结构契约。
 * 正本：shared-trae `knowledge/eratw/kojo-naming-rules.md` +
 * `knowledge/eratw/kojo-script-index-system.md` + `kojo-multi-scenario-system.md`。
 * 本副本只收跨版本稳定的命名/分发契约（chs 特有槽位映射不内嵌）。
 */
export const kojoStructureContractsEntry: KnowledgeEntry = {
  id: 'kojo-structure-contracts',
  domain: 'kojo',
  title: '口上结构契约（K 编号 / M_KOJO 命名 / 分发）',
  summary:
    '口上函数名 M_KOJO_{KOJO_NAME}_{类型}_K{NO}_{子类型}；拼名错误被 TRYCALLFORM 静默跳过——口上「从不触发」而不是报错；多剧本用 M_KOJO_K{NO}_{N} 与 CFLAG:口上セレクタ(998)。',
  tags: ['口上', '剧本', 'KOJO', 'M_KOJO', 'K编号', '命名', 'TRYCALLFORM', '分发', '选择器', '998', 'ROOM_DESCRIPTION', 'FIRSTTIME'],
  rules: [
    {
      id: 'kojo-01',
      text: '口上函数名格式 M_KOJO_{KOJO_NAME}_{类型}_K{NO}_{子类型}；KOJO_NAME 必须紧跟 M_KOJO_ 之后，取自注册函数 @M_KOJO_K{NO}_{セレクタ} 的 RESULTS 值（含前导下划线，函数名里出现双下划线是正确的）。',
    },
    {
      id: 'kojo-02',
      text: '类型关键词（SUCCESS/MESSAGE/EVENT/CHECK/COLOR/FLAGSETTING）在 KOJO_NAME 之后；CHECK 的 K{NO} 在子类型之前。旧模板把类型词放在 NAME 之前是错的（事件永不触发）。',
    },
    {
      id: 'kojo-03',
      text: '房间描写是唯一不用 M_KOJO_ 前缀的口上接口：K{KOJO_NAME}_ROOM_DESCRIPTION；初期口上（RESULTS 为空）为 K{NO}_ROOM_DESCRIPTION。',
    },
    {
      id: 'kojo-04',
      text: '多剧本编号：初期口上 M_KOJO_K{NO}，第 N 套 M_KOJO_K{NO}_{N}；玩家选择存 CFLAG:口上セレクタ（=998）。给已有角色新增剧本要先查存在判定与槽位占用。',
    },
    {
      id: 'kojo-05',
      text: 'TRYCALLFORM 找不到函数静默跳过（不报错）——拼名错误的口上表现为「事件从不触发」而非报错。改口上函数名后必须全仓 grep 分发串与调用点。',
    },
    {
      id: 'kojo-06',
      text: '一次性标记：FIRSTTIME(key,1,XX) 第二参非 0 是纯读不登记；FIRSTTIME 与 ONCE 存储槽不同（CSTR），两参数混用会静默失效。',
    },
    {
      id: 'kojo-07',
      text: 'token 逐字符核对：分发 token 简繁失配（如「吃飯」写成「吃饭」）会导致事件口上从未分发——死函数陷阱。',
    },
  ],
  pitfalls: [
    {
      symptom: '婚礼/事件口上从不触发',
      cause: '按旧模板写 M_KOJO_SUCCESS_{NAME}_...（类型词在 NAME 前），TRYCALLFORM 静默跳过',
      fix: '改为 M_KOJO_{NAME}_SUCCESS_...；CHECK 为 M_KOJO_{NAME}_CHECK_K{NO}_{子类型}',
    },
    {
      symptom: '房间描写静默失效',
      cause: '把 K34_顶空灿梦_ROOM_DESCRIPTION 改名 K34_ROOM_DESCRIPTION——拼名目标仍是带 NAME 形',
      fix: '按注册函数 RESULTS 拼名；初期口上才允许无 NAME 段',
    },
    {
      symptom: '字面 grep 查无调用点就判死码',
      cause: '拼名派发使字面调用点不存在≠死码',
      fix: '看写入可达性（分发串能否拼到它），不凭字面搜索下结论',
    },
    {
      symptom: '新增剧本后玩家侧看不到',
      cause: '存在判定/槽位/标识符未登记，或选择器未 bump',
      fix: '按新增剧本流程：标签重命名+存在判定+标识符+玩家可达性逐项检查',
    },
  ],
  body: `# 口上结构契约（快照 2026-10-20）

## 命名文法

\`\`\`
M_KOJO_{KOJO_NAME}_{类型}_K{NO}_{子类型}
K{KOJO_NAME}_ROOM_DESCRIPTION          # 房间描写特例（无 M_KOJO_ 前缀）
\`\`\`

- KOJO_NAME 来源：注册函数 \`@M_KOJO_K{NO}_{セレクタ}(ARG)\` 的 \`RESULTS\`（含前导下划线）。
- 多剧本：第 N 套注册函数为 \`@M_KOJO_K{NO}_{N}\`，选择器 \`CFLAG:口上セレクタ\`（=998）。
- 分发链：\`KOJO_MESSAGE_SEND\` → \`KOJO_ACTIVE_INFO(TARGET)\`（取 NAME）→
  \`TRYCALLFORM M_KOJO%NAME%_{类型}_K{NO:TARGET}_...\` → 命中或**静默跳过**。

## 品类（类型词）速查

SUCCESS（成功判定）/ MESSAGE（指令口上）/ EVENT（事件）/ CHECK（自定义检查）/
COLOR / FLAGSETTING。位置都在 KOJO_NAME **之后**。

## 一次性标记

- \`FIRSTTIME(key,1,XX)\`：第二参非 0 ＝ 纯读，不登记。
- \`FIRSTTIME\` 与 \`ONCE\` 存 \`CSTR\` 不同槽；参数混用静默失效。

## 排查纪律

1. 口上不触发 → 先按注册函数 RESULTS 拼出目标函数名，核对真实标签（差一字符即失效）。
2. 改函数名 → 全仓 grep 分发串与调用点（G4）。
3. token 简繁、大小写逐字符核对。
4. ⛔ 不凭「字面查无调用点」判死码——拼名派发的函数字面上就没有调用点。

> 完整正本：shared-trae \`knowledge/eratw/kojo-naming-rules.md\`（命名与模板事故）、
> \`kojo-script-index-system.md\`（品类分发唯一信源）、\`kojo-multi-scenario-system.md\`（多剧本管理面）。
`,
  source: {
    upstream: 'shared-trae/knowledge/eratw/kojo-naming-rules.md',
    snapshotAt: '2026-10-20',
  },
};
