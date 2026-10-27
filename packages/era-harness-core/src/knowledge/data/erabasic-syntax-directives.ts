import type { KnowledgeEntry } from '../types.js';

/**
 * EraBasic 函数头指令与局部变量元素数。
 *
 * 为什么要有这一条：7 条既有条目全是工程纪律/机制，**语法类零覆盖**；
 * 而 `era_reference` 过去只装了 Reference API 页，`#LOCALSIZE` 这类预处理器
 * 两个库都查不到，模型只能凭训练记忆猜，于是把「每个函数各一条」的容量声明
 * 当成重复变量定义删掉——删完还不报错（回退 VariableSize.csv 默认值）。
 *
 * 正本：上游文档站 `docs/Emuera/function.zh.md`（CC BY-NC 4.0），
 * 本条目为**改写**而非逐字摘录，数值与规则逐条对照原文。
 */
export const erabasicSyntaxDirectivesEntry: KnowledgeEntry = {
  id: 'erabasic-syntax-directives',
  domain: 'syntax',
  title: 'EraBasic 函数头指令与局部变量元素数',
  summary:
    '`#` 开头的预处理器必须紧接在 `@函数` 之后；`#LOCALSIZE` / `#LOCALSSIZE` 是**每个函数各自**的局部变量元素数（局部变量容量）声明，不是变量定义——去重或删除不会报错，只会让 LOCAL 槽位悄悄回退 VariableSize.csv 的默认值。',
  tags: [
    'LOCALSIZE',
    'LOCALSSIZE',
    'LOCALF',
    'LOCAL',
    '预处理器',
    '函数头',
    '局部变量',
    '元素数',
    '指令顺序',
    '#DIM',
  ],
  rules: [
    {
      id: 'syn-01',
      text: '#LOCALSIZE n / #LOCALSSIZE n 是**每个函数各自**的局部变量元素数声明，不是变量定义：每个 @函数 各一条属正常，⛔ 不得当重复定义去重、合并或删除。',
    },
    {
      id: 'syn-02',
      text: '容量值必须是**大于 0 的常量表达式**；写成 0、含变量、或无法解释的字符串都会被引擎静默忽略，等价于没写。',
    },
    {
      id: 'syn-03',
      text: '被忽略或未声明时回退 VariableSize.csv（eratw 实测 LOCAL 200、LOCALS 100；文件里没写时才是引擎内建默认 1000 / 100）：删掉容量行不会报错，只会悄悄改容量。',
    },
    {
      id: 'syn-04',
      text: '所有 # 预处理器必须紧接在 @函数名 之后、函数正文之前；位置错了就**上移，不要删**。',
    },
    {
      id: 'syn-05',
      text: '事件函数里的 #LOCALSIZE 只取最先执行的那次设置（ver1800 起），不是每处都生效。',
    },
    {
      id: 'syn-06',
      text: '用到 LOCAL:M 就必须保证元素数 ≥ M+1；新工程建议 VariableSize.csv 把 LOCAL/LOCALS 设为 -1 强制迁移到 #DIM/#DIMS。',
    },
  ],
  pitfalls: [
    {
      symptom: '改完脚本后局部变量行为变了，或日志出现「#行只能在函数声明后立刻使用」',
      cause: '把每个函数各一条的 #LOCALSIZE / #LOCALSSIZE 当成重复变量定义删掉了',
      fix: '在每个 @函数 头下方按原值补回容量声明；「每函数一条」本来就是正确形态，只留一条才是错的',
    },
    {
      symptom: '写了 #LOCALSIZE 却不生效',
      cause: '值是 0、或含变量、或不是可解释的常量表达式，被引擎静默忽略',
      fix: '改成大于 0 的字面量常量；要按条件变化就改用 #DIM 声明变量',
    },
    {
      symptom: '函数中间出现 #LOCALSIZE 触发引擎警告',
      cause: '# 指令没有紧跟在 @函数名 之后',
      fix: '把该行上移到函数头下方，不要删除——它不是变量声明，删了会丢容量设置',
    },
  ],
  body: `# EraBasic 函数头指令与局部变量元素数

> 依据：上游文档站 \`docs/Emuera/function.zh.md\` 的「定义」小节，
> \`docs/Emuera/variables.zh.md\` 的 \`LOCAL\` / \`LOCALS\` 条目。
> 快照 2026-10-28，上游 \`41451be6\`。

## 位置规则

函数头部的 \`#\` 预处理器必须**紧接在 \`@函数名\` 之后**。位置错了引擎会给
「#行只能在函数声明后立刻使用」这类警告，而不会替你搬家。
正确处理是**上移**，不是删除。

## 容量指令

| 指令 | 作用 |
|---|---|
| \`#LOCALSIZE <常量表达式>\` | 指定该函数的 \`LOCAL\`（整数）元素数 |
| \`#LOCALSSIZE <常量表达式>\` | 指定该函数的 \`LOCALS\`（字符串）元素数 |
| \`#LOCALFSIZE\` | EM+EE 扩展，\`docs/Emuera\` 规格页未收录，不要与上面两条并列 |

三条硬规则：

1. **每函数独立**。它不是变量定义，而是「这个函数的局部数组开多大」。
   100 个函数里出现 100 次 \`#LOCALSIZE 100\` 完全正常，去重即破坏。
2. **必须 > 0 的常量**。0、含变量的表达式、无法解释的字符串都会被忽略。
3. **忽略后回退** \`VariableSize.csv\`。eratw 的 \`VariableSize.csv\` 实测写着
   \`LOCAL,200\` / \`LOCALS,100\`；文件里完全没写这两行时才是引擎内建默认 1000 / 100。
   注意工程里 **95% 的声明值是 \`1\`**（\`#LOCALSIZE 1\` 10,460 处 / \`#LOCALSSIZE 1\` 10,677 处），
   删掉会把容量**从 1 悄悄改成 200**；而少数声明 \`1000\`/\`10000\` 的函数删掉后会**变小**、
   用到高位槽时真的越界。两个方向都是没人要的改动，而且**不会报错**。

## 事件函数的特例

在事件函数里，\`#LOCALSIZE\` 取**最先执行**的那次设置（截至 ver1800），
不是每处都生效。所以事件函数里的容量声明同样不能随手删。

## 与 \`#DIM\` 的关系

\`#DIM\` / \`#DIMS\` 是**声明变量**（新代码的推荐写法），
\`#LOCALSIZE\` 是**调整既有 \`LOCAL\` 数组的大小**（历史写法）。
上游建议新工程把 \`VariableSize.csv\` 的 \`LOCAL\`/\`LOCALS\` 设为 \`-1\` 禁用，
强制迁移到 \`#DIM\`/\`#DIMS\`。目标工程里 \`#LOCALSIZE\` 有 10,970 处、\`#LOCALSSIZE\`
10,908 处（合计 21,878 处，分布在 1,416 个脚本文件里；\`#LOCALFSIZE\` 为 0 处），
属于存量写法，改动时必须原样保留。

## 反模式

- 看到「同一个 \`#LOCALSIZE\` 重复出现」就判定为冗余 → 删完容量回退，行为漂移。
- 把 \`#LOCALSIZE 0\` 当合法（以为 0 = 不限制）→ 实际等于没写。
- 为「整理格式」把容量行挪到函数中间 → 引擎忽略并告警。
`,
  source: {
    upstream: 'https://github.com/qirchen421/emuera.sk.doc/blob/41451be6091363e37ed066aaf04416decbf0127f/docs/Emuera/function.zh.md',
    sha: '41451be6',
    snapshotAt: '2026-10-28',
  },
};
