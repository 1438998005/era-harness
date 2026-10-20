import type { KnowledgeEntry } from '../types.js';

/**
 * 工程结构纪律（三层架构 / 变量槽位 / 数据层版本）。
 * 正本：shared-trae `knowledge/eratw/project-structure.md` +
 * `knowledge/eratw/variable-slot-allocation.md` + `knowledge/eratw/clothes-system.md`
 * （「死规矩 2 现语义」段）+ `knowledge/eratw/qol-system.md`（NOW_VERSION 铁律）。
 * 本副本只收跨工程稳定的结构与槽位纪律，⛔ 不收某一工程的占用区段表与行号证据。
 */
export const projectStructureDisciplineEntry: KnowledgeEntry = {
  id: 'project-structure-discipline',
  domain: 'project',
  title: '工程结构纪律（三层架构 / 变量槽位 / 缓存版本）',
  summary:
    'CSV=命名与数据、ERH=宏与自动常量头、ERB=逻辑；数组容量看 CSV/VariableSize.csv 而非命名表行数，新增命名行只能末尾追加；各数组编号空间独立，移植按名映射⛔照抄数字；改被注册进持久缓存的字面量必须 bump NOW_VERSION。',
  tags: [
    '工程结构',
    '目录',
    '三层',
    'CSV',
    'ERH',
    'ERB',
    'VariableSize',
    '槽位',
    '容量',
    '命名表',
    'FLAG',
    'CFLAG',
    'TFLAG',
    'TCVAR',
    'AutoConst',
    'NOW_VERSION',
    '持久缓存',
    'qol_data.db',
    'OBJ',
    '衣物',
    '双层',
    'F层',
    'structure',
    'slot',
  ],
  rules: [
    {
      id: 'proj-01',
      text: '三层分工：CSV/ 放变量命名表与角色初始数据（含 *.als 别名），ERB/Headers/*.ERH 放宏与再生成的常量头，ERB/*.ERB 放逻辑。要「名字」改 CSV，要「行为」写 ERB，⛔ 把新编号当魔法数字写进逻辑。',
    },
    {
      id: 'proj-02',
      text: '数组容量由 CSV/VariableSize.csv 指定（不写则用引擎默认值），与命名表的行数无关：命名表只给槽位挂名。高位编号（如 FLAG:9051）在容量内完全合法，不存在「越界」。',
    },
    {
      id: 'proj-03',
      text: '新增命名行只能末尾追加（编号可跳号），⛔ 中间插入——插入会让其后的编号与已编译常量整体错位。容量不足才改 VariableSize.csv；把容量改小会丢弃存档里超出的数据。',
    },
    {
      id: 'proj-04',
      text: '各数组的编号空间相互独立：FLAG / TFLAG / CFLAG / TCVAR 里同一个数字毫无关系，魔改版区段还可能与上游不同。移植对照一律按名映射并回本工程 CSV 核对，⛔ 照抄数字。',
    },
    {
      id: 'proj-05',
      text: '角色数组变量（CFLAG、CSTR 等）第 1 维受「角色登记编号上限」约束：⛔ 拿 1000+ 的伪角色号当临时存储槽。要额外存储就另开 #DIMS 数组。',
    },
    {
      id: 'proj-06',
      text: '按名引用的整数常量来自命名表再生成的头文件（ERB/Headers/AutoConst_*.ERH）：改了 CSV 命名要再生对应头文件，⛔ 手改生成物（下次再生即被覆盖并与命名表分叉）。',
    },
    {
      id: 'proj-07',
      text: 'OBJ 类数据有旧层（GET_STR/GET_INT→GET_OBJ→CALLFORM）与 F 层 qol（GETMETH_STR/INT→GETMETHS）两套派发。写哪层由本工程纪律与闸门决定，⛔ 照旧文档默认双层同改、⛔ 顺手补旧层；只写单层要逐 id 具名登记缺口。',
    },
    {
      id: 'proj-08',
      text: '改动会被注册进持久缓存（如 plugins/qol_data.db 的料理名/分类/物品数据）的字面量时，必须同步 bump ERB/DIM.ERH 的 NOW_VERSION，否则不重注册、源码与缓存分叉，整批条目静默消失；正解＝bump 版本，⛔ 手工 UPDATE 数据库。',
    },
  ],
  pitfalls: [
    {
      symptom: '给 CFLAG/FLAG 用了 9000+ 的编号，以为「超出数组长度」',
      cause: '把命名表行数当成容量',
      fix: '查 CSV/VariableSize.csv；容量与命名表行数无关，末尾追加一行命名即可',
    },
    {
      symptom: '在命名表中间插入一行后，一大片按名引用的常量值集体错位',
      cause: '命名表的行序即编号语义，插入会整体位移',
      fix: '一律末尾追加（编号可跳号）；已误插要按 HEAD 逐行回滚，不要只删那一行',
    },
    {
      symptom: '从别处抄来的 FLAG:9120 在本工程指向完全不同的含义',
      cause: '各数组编号空间独立，且魔改版区段与上游不同',
      fix: '按名映射，逐个回本工程 CSV 核对编号→名字',
    },
    {
      symptom: '改了某分类的字面量（如简繁/日字形），静态检查全绿，但游戏里该分类整批消失',
      cause: '持久缓存（qol_data.db）存的是注册当时算出的字面量，读取端与现算串比相等；未 bump NOW_VERSION ⇒ 不重注册',
      fix: 'bump ERB/DIM.ERH 的 NOW_VERSION 让引擎重注册；核验要离线开库比码位，⛔ 靠眼睛',
    },
    {
      symptom: '新增衣物在换装列表正常，但走旧层接口取到空串（或反之）',
      cause: '双层派发只写一层，且缺口没有具名登记',
      fix: '先查本工程纪律该写哪层；单写层时把 (类, id) 登记进豁免表并跑闸门',
    },
    {
      symptom: '运行时报「角色数组变量 CSTR 的第 1 个变量超出角色登记编号上限」',
      cause: '拿伪角色号（1000+）当临时存储槽',
      fix: '另开 #DIMS 数组存放，不挤占角色数组高位',
    },
  ],
  body: `# 工程结构纪律（快照 2026-10-21）

给「在这个工程里加个东西该改哪个文件」提供判据。凡结构层面看不懂的，先站回三层架构。

## 1. 三层职责

| 层 | 位置 | 内容 | 什么时候改它 |
|---|---|---|---|
| 数据/命名层 | \`CSV/\` | 变量命名表（\`Flag.csv\`、\`Cflag.csv\`、\`Talent.csv\`…）、容量表 \`VariableSize.csv\`、角色初始数据 \`Chara/\`、别名 \`*.als\` | 需要一个新的**名字/编号**、改角色初始值 |
| 宏层 | \`ERB/Headers/*.ERH\`、各处 \`.ERH\` | \`#DIM\`/\`#DIMS\` 全局声明、常量、自动生成的 \`AutoConst_*.ERH\` | 要加全局宏；\`AutoConst_*\` 由命名表**再生**，⛔ 手改 |
| 逻辑层 | \`ERB/**.ERB\` | 函数、事件、指令本体 | 要加**行为** |

典型目录（命名会被创作者改动，以本工程实测为准）：\`ERB/OBJ/\`（OBJ 数据框架：\`GETOBJ.ERB\`、\`EXISTOBJ.ERB\`、\`TEMPVAR.ERB\`、\`CLASS/\`）、\`ERB/OBJ/CLASS/CLOTHES\` 与 \`CLOTHES_METH\`（衣物旧层 / F 层）、\`ERB/魔改内容/qol/\`（QoL 层，\`GETMETH_STR/INT\` 直接调 F 函数）、\`ERB/コマンド関連/\`、\`ERB/イベント関連/\`、\`ERB/DIM.ERH\`、\`ERB/SYSTEM.ERB\`、\`ERB/VERSION_UP.ERB\`。

## 2. 槽位三则

1. **容量 ≠ 命名**：容量在 \`CSV/VariableSize.csv\` 逐行指定（本工程实测如 FLAG/CFLAG 10000、TFLAG 1000、ITEM 1200 这类量级；其余以该文件现算为准，⛔ 记别处的数）。命名表行数只有「挂了几个名字」的含义，⛔ 拿它判断可用上限。
2. **追加不插入**：命名表只能末尾追加，编号可跳号；中间插入＝其后全部错位。缩小容量会丢存档数据。
3. **编号空间按数组独立**：\`FLAG:9120\` 与 \`CFLAG:9120\` 是两个不相干的东西；魔改版的区段划分还可能与上游不同 ⇒ 移植一律按名映射。

## 3. 双层 OBJ 派发

| 层 | 文件 | 命名 | 调用方式 |
|---|---|---|---|
| 旧层 | \`ERB/OBJ/CLASS/CLOTHES/CLOTHES_{类别}.ERB\` | \`@EXIST_{类别}{N}\` + \`@{类别}{N}\` | \`GET_STR/GET_INT\` → \`GET_OBJ\` → \`CALLFORM\`（经 TEMP_STOCK 临时变量回值） |
| F 层（qol） | \`ERB/OBJ/CLASS/CLOTHES_METH/CLOTHES_METH_{类别}.ERB\` | \`@F{类别}{N}\` | \`GETMETH_STR/GETMETH_INT\` → \`GETMETHS\`（直接 \`RETURNF\`） |

两套同时存在时，「写一层还是两层」是**工程纪律**问题而不是语法问题：F 层是当前主要服务玩家可见功能的层，旧层在多数工程里已无活调用者（入口链被注释/跳过）。判据＝本工程规则 + 闸门；缺口要逐 id 具名登记，⛔ 只在散文里记一句「这个类不管旧层」。

## 4. 第四层：持久缓存

\`ERB/DIM.ERH\` 的 \`NOW_VERSION\` 是 QoL 数据重注册的总开关：\`@QOL_*_INIT\` 只在缓存里记的版本号 ≠ \`NOW_VERSION\` 时才重建（物品/料理/药房/木材/虫乃至移动图都挂在这个键上）。⇒ **改了会被注册进缓存的字面量就必须 bump**，否则源码与 \`plugins/qol_data.db\` 分叉，读取端 \`TYPECHECK != ARGS\` 静默落空，表现为「只有一类整批消失」而日志干净。反向也成立：bump 会触发全部模块重建，成本是首次加载变慢。

> 完整正本（含本工程实测的容量表、已占用区段、双层取证链）：shared-trae \`knowledge/eratw/project-structure.md\`、\`variable-slot-allocation.md\`、\`clothes-system.md\`、\`qol-system.md\`。
`,
  source: {
    upstream:
      'shared-trae/knowledge/eratw/project-structure.md（＋ variable-slot-allocation.md / clothes-system.md / qol-system.md）',
    snapshotAt: '2026-10-21',
  },
};
