import type { KnowledgeEntry } from '../types.js';

/**
 * 游戏主流程与指令生命周期管线。
 * 正本：shared-trae `knowledge/eratw/game-flow-command-pipeline.md`
 * （引擎侧 TRAIN 循环见 `knowledge/erabasic/event-functions.md` §4）。
 * 本副本只收链的形状与时序判据，⛔ 不收某一工程的行号、已实施修复与待裁定方案。
 */
export const mainFlowPipelineEntry: KnowledgeEntry = {
  id: 'main-flow-pipeline',
  domain: 'gameflow',
  title: '主流程与指令生命周期（DOTRAIN 999 / SOURCE_CHECK / TURN_RESET）',
  summary:
    '菜单指令不直接执行 @COMxx：全部输入进 @USERCOM 调度，一般指令经 DOTRAIN 999 借用引擎指令生命周期，真实触发与数值结算整体后移到 @SOURCE_CHECK（SELECTCOM 靠 TFLAG:3 退避还原），回合收尾在 @EVENTCOMEND→@TURN_RESET；USERCOM 内直接 RETURN 的分支跳过整条链。',
  tags: [
    '主流程',
    '回合',
    '指令',
    'TRAIN',
    'USERCOM',
    'DOTRAIN',
    'SELECTCOM',
    'SOURCE_CHECK',
    'CALL_COM',
    'COM999',
    'EVENTCOM',
    'EVENTCOMEND',
    'TURN_RESET',
    '301',
    '前一次的位置',
    'PREVCOM',
    'Counter',
    'SOURCE',
    '时序',
    '状态残留',
    'pipeline',
    'mainflow',
  ],
  rules: [
    {
      id: 'flow-01',
      text: '菜单指令不直接执行 @COMxx：输入先进 @USERCOM 调度，一般指令经 DOTRAIN 999 借用引擎的指令生命周期，真正的触发、数值结算与口上调用整体后移到 @SOURCE_CHECK。查「指令后状态不对/时序错乱」先站回这条链。',
    },
    {
      id: 'flow-02',
      text: 'DOTRAIN n 的引擎语义是「SELECTCOM := n 后走完整指令流程」⇒ 999 会覆写 SELECTCOM，真实指令号必须先暂存到 TFLAG 槽、再由 @SOURCE_CHECK 开头还原。',
    },
    {
      id: 'flow-03',
      text: '链的顺序：@USERCOM（暂存指令号）→ DOTRAIN 999 → @EVENTCOM → @COM999（空壳，RETURN 1）→ @SOURCE_CHECK（还原指令号 → 计时 → Counter → @CALL_COM → 数值结算）→ @EVENTCOMEND → @TURN_RESET；@CALL_COM 经剧本覆写拦截后 TRYCALLFORM COM{SELECTCOM} 执行本体。',
    },
    {
      id: 'flow-04',
      text: 'Counter 在 @SOURCE_CHECK 前段、玩家指令本体之前执行 ⇒ 指令里 RETURN 0 拦不住它；要拦只能改 Counter 自己的不発门控。',
    },
    {
      id: 'flow-05',
      text: '@CALL_COM 的 RESULT < 0 直接结束回合；RESULT == 0 跳到 $SOURCE_SKIP 只跳过数值区段，其后的好感度结算仍会跑 ⇒「0 耗时指令」能原地刷好感度，需显式加「本回合好感度不入」守卫。',
    },
    {
      id: 'flow-06',
      text: '回合收尾集中在 @TURN_RESET：指令履历（PREVCOM）移位、全员「前一次的位置 := 現在位置」快照、玩家旧位置先抢救、TFLAG 低位清零。跨回合判定全依赖这份快照。',
    },
    {
      id: 'flow-07',
      text: '「前一次的位置 ≠ 現在位置」的唯一含义是「该角色本回合移动过」：快照打在命令结束时，NPC 移动在下一回合 @SHOW_STATUS 里发生；顺序搞反会把「早已在此」判成「刚进来」。',
    },
    {
      id: 'flow-08',
      text: '@USERCOM 内直接 RETURN 的分支跳过整条链：不结算、不快照、不推进履历。带状态变更又不走 DOTRAIN 的分支要么并入正规指令管线，要么补核心快照，否则「位置显示对、事件判定错」。',
    },
    {
      id: 'flow-09',
      text: 'SOURCE 是单回合量：@SOURCE_CHECK 结束即由引擎清零，⛔ 当持久存储；要跨回合的状态就另存角色数组或自定义数组。',
    },
  ],
  pitfalls: [
    {
      symptom: '写好 @COM500 却在游戏里从不执行',
      cause: '菜单输入不直接调 COMxx，要经 USERCOM → DOTRAIN 999 → SOURCE_CHECK → TRYCALLFORM COM{SELECTCOM}',
      fix: '查指令号退避与还原、COM_ABLE500 门控、OVERRIDE_COMMAND 是否拦截，别只盯 COM500 本体',
    },
    {
      symptom: '指令里 RETURN 0，Counter 的产出照样进了结算',
      cause: 'Counter 在 SOURCE_CHECK 前段、指令本体之前执行',
      fix: '在 Counter 的不発门控上做排除，指令返回值管不到它',
    },
    {
      symptom: '原地反复点同一指令，时间不推进但好感度一直涨',
      cause: 'RESULT == 0 走 $SOURCE_SKIP 跳过耗时与数值结算，但后面的好感度计算没有同名守卫',
      fix: '0 返回值分支同时置「好感度不入/信頼度管理」守卫，或让该指令正常耗时',
    },
    {
      symptom: '用快捷移动后「还在这呢 / 有人在敲门」判定错乱，且「上回指令」显示陈旧值',
      cause: '该分支在 USERCOM 内直接 RETURN，跳过 TURN_RESET 的 301 快照与 PREVCOM 移位',
      fix: '跳转成一次正规指令（走 DOTRAIN 全链），或在该分支补全员位置快照 + 旧位置抢救 + 履历移位',
    },
    {
      symptom: '以为某角色 前一次的位置 == 現在位置 就说明她没移动',
      cause: '忽略了「快照在命令结束、移动在下一回合开头」的先后关系',
      fix: '按 flow-07 的时序判定；跨回合状态要先确认可达路径',
    },
    {
      symptom: '新增系统指令（8xx 一类）把回合白白消耗掉',
      cause: '误走 DOTRAIN 借道，触发了完整指令生命周期',
      fix: '纯显示/纯 UI 类在 USERCOM 内 CALL 完直接 RETURN，不进链',
    },
  ],
  body: `# 主流程与指令生命周期（快照 2026-10-21）

## 1. TRAIN 主循环（一个回合的形状）

\`\`\`
BEGIN TRAIN → @EVENTTRAIN（日启动处理）
└ 循环：
   ① @SHOW_STATUS      ← 态度 / 时间推进 / NPC 自动移动 / 同室与视线判定（下游读「前一次的位置」）
   ② @SHOW_USERCOM     ← 指令菜单
   ③ INPUT
   ④ @USERCOM          ← 全部菜单输入的调度中心
   ⑤ 一般指令 → DOTRAIN 999 → 引擎指令链；其余分支 → 直接 RETURN（跳过整链）
   ⑥ 回到 ①
\`\`\`

## 2. 借道 DOTRAIN 999

\`DOTRAIN n\` 会把 \`SELECTCOM\` 设成 n 并走完整指令流程，所以工程用一个空壳的 \`@COM999\`（只 \`RETURN 1\`）当载体，把真实指令号暂存在 TFLAG 槽里，再由 \`@SOURCE_CHECK\` 开头还原。链上的分工：

| 环节 | 干什么 |
|---|---|
| \`@EVENTCOM\` | 指令开始前钩子（多定义事件） |
| \`@COM999\` | 空壳哑指令，只为借用生命周期 |
| \`@SOURCE_CHECK\` | **真正的统合枢纽**：还原 SELECTCOM → 计时 → Counter → 调 \`@CALL_COM\` → 数值/文本结算 |
| \`@CALL_COM\` | 连携判定 → 剧本覆写拦截 → \`TRYCALLFORM COM{SELECTCOM}\` 执行本体 |
| \`@EVENTCOMEND\` → \`@TURN_RESET\` | 回合收尾：履历移位、全员位置快照、旧位置抢救、TFLAG 清零、破处/经验/体位等推进 |

两个易推论：**Counter 先于玩家指令**（指令返回值拦不住它）；**\`RESULT == 0\` 只跳过数值区段**，其后的好感度结算仍会跑。

## 3. 快照时序＝判定基准

「前一次的位置」在命令结束时全员同步为現在位置，而 NPC 移动发生在下一回合的状态显示里 ⇒ \`前一次的位置 ≠ 現在位置\` 的唯一含义是「本回合动过」。同室、情事発觉、移动检测一类判定全部读它，所以任何**跳过 TURN_RESET 的路径**都会把这套判定整体污染一回合——而且现场（位置列表）看起来是对的，最难从日志反推。

## 4. 什么时候必须走链

| 分支类型 | 该不该走 DOTRAIN |
|---|---|
| 纯显示 / 纯 UI（查状态、看列表） | ⛔ 不走：CALL 后直接 RETURN，不消耗回合，设计如此 |
| 改变世界状态（移动、放置、清理、给物品） | ✅ 必须走：否则无结算、无快照、无履历 |
| 想「不耗时但有效果」 | 谨慎：RESULT==0 只跳数值结算，好感度与 Counter 仍在跑，需要显式守卫 |

> 完整正本（引擎侧事件函数分组与修饰符见 shared-trae \`knowledge/erabasic/event-functions.md\` §4；工程侧实证链与逐行取证见 \`knowledge/eratw/game-flow-command-pipeline.md\`）。
`,
  source: {
    upstream: 'shared-trae/knowledge/eratw/game-flow-command-pipeline.md',
    snapshotAt: '2026-10-21',
  },
};
