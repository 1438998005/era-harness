import type { KnowledgeEntry } from '../types.js';

/**
 * OBJ 数据框架与 qol（F 层）约定。
 * 正本：shared-trae `knowledge/eratw/obj-system.md`（＋ `clothes-system.md`「死规矩 2 现语义」段、
 * `identifier-tag-system/problem-taxonomy.md` 的字符串键判据）。
 * 本副本只收跨工程稳定的机制与契约，⛔ 不收某一工程的类清单、注册余量现算值与行号证据。
 */
export const objQolConventionsEntry: KnowledgeEntry = {
  id: 'obj-qol-conventions',
  domain: 'project',
  title: 'OBJ 数据框架与 qol 层约定（O_DATA 键 / 双层派发 / 存在判定）',
  summary:
    'OBJ＝类名+类别内ID+属性名(O_DATA)三元组；旧层经 GET_OBJ→CALLFORMF→TEMP_STOCK 回值，F 层经 GETMETH_INT/STR→GETMETHS(@"F{类}{ID}", 默认值, ARG, O_DATA) 直接 RETURNF。两侧落空都是静默返回默认值（""/0），所以 O_DATA 键必须供应端与消费端同批落地。',
  tags: [
    'OBJ',
    'O_DATA',
    'GET_STR',
    'GET_INT',
    'GET_OBJ',
    'GETMETH_STR',
    'GETMETH_INT',
    'GETMETHS',
    'qol',
    'F层',
    '旧层',
    'CALLFORMF',
    'TEMP_STOCK',
    'MAKE_STR',
    'VAR_TEMP_MAX',
    'EXIST',
    'SETLIST_EXIST',
    'CLASS_NUM',
    'NAME2ID',
    '名称映射',
    '衣物',
    '道具',
    '对象',
    'obj',
  ],
  rules: [
    {
      id: 'obj-01',
      text: 'OBJ 是「类名 CLASS_NAME ＋ 类别内 ID ＋ 属性名 O_DATA」三元组，读取一律走按名取属性（GET_STR/GET_INT 或 GETMETH_STR/GETMETH_INT），⛔ 在调用方硬编码属性表或绕过 getter 自己拼返回逻辑。',
    },
    {
      id: 'obj-02',
      text: '两条并行派发链：旧层 GET_STR/GET_INT → GET_OBJ → CALLFORMF {类}{ID}(ARG, O_DATA, V_NAME) → 层内 CALLF MAKE_STR/MAKE_INT → TEMP_STOCK → TEMP_RE_STR 回值；F 层（qol）GETMETH_STR/INT → GETMETHS(@"F{类}{ID}", 默认值, ARG, O_DATA) → 层内 RETURNF 直接回值。',
    },
    {
      id: 'obj-03',
      text: '两条链的落空语义都是静默返回默认值：GETMETH_STR 缺省 ""、GETMETH_INT 缺省 "0"，旧层没建变量时 GET_OBJ 直接返回空。⇒ 属性取不到不报错，只表现为「显示空白 / 恒 0」，这类症状一律当缺键缺陷查，不当数值逻辑查。',
    },
    {
      id: 'obj-04',
      text: 'O_DATA 是字符串匹配键：供应端＝层内函数 SELECTCASE O_DATA 的 CASE 字面值，消费端＝getter 第 4 参的字面量。新增或改名必须两侧同批落并全仓核对（含旧层与 F 层两份、简繁与日字形逐字符比码位），⛔ 只改一侧，⛔ 多处散写同一字面串（新键优先宏化）。',
    },
    {
      id: 'obj-05',
      text: '类名可以是本地化后的中文（如 @F袜子1），但 O_DATA 属性键沿用日文原键（"名前"、"装備部位"…）；同一类别里还可能按类登记专用名键。⛔ 只翻译其中一侧语言，⛔ 拿别类的键名当通用。',
    },
    {
      id: 'obj-06',
      text: 'F 层函数签名固定为 (ARG, O_DATA)，O_DATA 用 #DIMS 声明，返回字符串用 #FUNCTIONS、返回整数用 #FUNCTION；SELECTCASE 未命中就走 ENDSELECT 的隐式空返回，⛔ 指望它抛错。',
    },
    {
      id: 'obj-07',
      text: '存在判定靠 @EXIST_{类}{N}（空函数体即可）：启动时 SETLIST_EXIST 逐个 TRYCCALLFORM 探测并登记。缺 EXIST 函数 ⇒ GET_EXIST 为假 ⇒ 旧层 GET_OBJ 对该 ID 恒空，即使对应的 F 函数写得完好。',
    },
    {
      id: 'obj-08',
      text: '旧层可注册的类数受 CLASS_NUM（ERB/OBJ/OBJ.ERH，值以本工程现算为准）约束，触顶时 @OBJ_EXIST 的 CASE "MAKE" 直接 THROW「保持変数が上限に達しています」。⇒ 加旧层类前先算余量，⛔ 随手抬上限（偏离上游容量）。F 层的名称映射另走 MAKE_ALL_OOP_MAP，不占该额度。',
    },
    {
      id: 'obj-09',
      text: 'TEMP_STOCK 是全工程共享的伪变量池，上限 VAR_TEMP_MAX＝100、调用结束不自动清除、同名即覆盖。旧层回值必须用 GET_OBJ 分配的栈式唯一名（VAR{栈}_{类}{ID}_{属性}），⛔ 在业务码里用裸名 MAKE_STR 当临时变量——要临时存储请用 #DIM DYNAMIC。',
    },
    {
      id: 'obj-10',
      text: '名称→ID 反查：类别需实现 @EXIST_{类}_ID ＋ @{类}_ID（RESET 时重建表）才在旧层可用；qol 侧由 MAKE_OOP_MAP 按该类登记的名键建 {类}_NAME2ID Map，GETMETH_OBJNAME_TO_ID 先查 Map、未命中才逐 ID 现算，都查不到返回 -1。名键在供应端没有对应 CASE ⇒ 该类的映射整批为空。',
    },
  ],
  pitfalls: [
    {
      symptom: '某个显示位（装备名、同行動名、说明行）恒为空白',
      cause: '消费端的 O_DATA 字面量在供应端 SELECTCASE 里没有对应 CASE，或两侧字形差一个字符（简↔繁、日新字体）；落空静默返回 ""',
      fix: '供应端补 CASE 或改正调用键，两侧同批落；引擎对精灵/方法名只做大小写归一、⛔ 不做字形归一 ⇒ 逐字符（比码位）核对，不靠眼睛',
    },
    {
      symptom: '某属性取到恒 0，怀疑数值算错',
      cause: 'GETMETH_INT 落空时回默认 "0"，与真实值 0 无法区分',
      fix: '先按缺键处理（核对该类的 CASE 键集），再加 DEBUG 打印确认走到了哪条链',
    },
    {
      symptom: 'F 层一切正常，旧层 GET_STR/GET_INT 却取不到',
      cause: '缺 @EXIST_{类}{ID} ⇒ GET_EXIST 为假，GET_OBJ 提前 RETURNF',
      fix: '补 EXIST 函数，或统一改走 F 层（本工程纪律下新内容默认只写 F 层）',
    },
    {
      symptom: '启动即 THROW「保持変数が上限に達しています」',
      cause: '旧层注册类数触到 CLASS_NUM',
      fix: '先算余量；确需扩容量要同步核 CLASS_NAME/EXIST 数组维度并另立工单，⛔ 只改一个数字',
    },
    {
      symptom: '旧层 MAKE_STR 写进去的值读到空串或旧值',
      cause: 'TEMP_STOCK 池只有 100 槽、不清除、同名覆盖，裸名极易与别处撞车',
      fix: '用 GET_OBJ 的栈式唯一名机制；业务侧临时变量一律 #DIM DYNAMIC',
    },
    {
      symptom: '按名字反查 ID 恒返回 -1',
      cause: '该类未登记名键或名键在供应端没有 CASE ⇒ {类}_NAME2ID 映射为空',
      fix: '补名键与 CASE，或改用数字 ID；先离线看 Map 是否建成',
    },
  ],
  body: `# OBJ 数据框架与 qol 层约定（快照 2026-10-21）

OBJ 是衣物、道具、角色数据、套装、依頼这类「一堆同类对象」的统一框架。写新对象或改属性前，先确认自己站在哪条链上。

## 1. 两条链

| | 旧层 | F 层（qol） |
|---|---|---|
| 入口 | \`GET_STR/GET_INT\` → \`GET_OBJ\` | \`GETMETH_STR/GETMETH_INT\` → 引擎 \`GETMETHS\` |
| 目标函数 | \`CALLFORMF {类名}{ID}(ARG, O_DATA, V_NAME)\` | \`GETMETHS(@"F{类名}{ID}", 默认值, ARG, O_DATA)\` |
| 回值方式 | 层内 \`CALLF MAKE_STR/MAKE_INT(V_NAME, 值)\` → \`TEMP_STOCK\` → \`TEMP_RE_STR\` | 层内直接 \`RETURNF 值\` |
| 落空语义 | \`GET_EXIST\` 为假或未建变量 ⇒ \`RETURNF\` 空 | 返回第 2 参默认值（\`""\` / \`"0"\`） |
| 存在判定 | 需要 \`@EXIST_{类}{N}\`，由 \`SETLIST_EXIST\` 启动时注册 | 由 qol 侧映射注册（\`MAKE_ALL_OOP_MAP\`/\`MAKE_OOP_MAP\`），不占旧层额度 |

F 层函数体形如：

\`\`\`
@F袜子1(ARG, O_DATA)
#FUNCTIONS
#DIMS O_DATA
SELECTCASE O_DATA
CASE "名前"
    RETURNF "长筒袜"
CASE "装備部位"
    RETURNF "「袜子」"
ENDSELECT
\`\`\`

⇒ 类名（\`袜子\`）可本地化，属性键（\`名前\`）沿用日文原键；**键集就是这类对象的接口面**，新增属性＝加 CASE ＋在调用处用同一字面串，两者必须同批。

## 2. 静默是这套框架的默认失败模式

三条链路上没有一处会因为你写错键名而报错：getter 拿到空串、\`GET_INT\` 对非数字串回 0、\`TRYCALLFORM\` 找不到函数直接跳过。所以「某个显示位空白／恒 0」的正确读法是**键集缺项**，而不是数值 Bug。判据要能机械核对：把某类供应端的 CASE 全集与消费端该类的第 4 参字面量集合对表，差集即缺陷面。

## 3. 存在判定与容量

\`@EXIST_{类}{N}\` 是给 \`SETLIST_EXIST\` 探测用的空函数；\`@OBJ_EXIST\` 用 \`#DIMS CLASS_NAME, CLASS_NUM + 1\` 承载类清单，\`CASE "MAKE"\` 在 \`OBJ_CNT == CLASS_NUM\` 时 THROW。⇒ 旧层是**有硬额度**的那一层，这也是「新内容只写 F 层」的工程动机之一。

## 4. 名称→ID

旧层：\`@{类}_ID\`（\`RESET\` 时重建），需 \`@EXIST_{类}_ID\` 标记支持。qol 层：\`MAKE_OOP_MAP\` 遍历 ID，用 \`OBJ_NAME_KEY(类)\` 取该类的名键，逐个 \`GETMETH_STR\` 建 \`{类}_NAME2ID\`；\`GETMETH_OBJNAME_TO_ID\` 先 \`MAP_GET\`，未命中才逐 ID 现算，最后回 \`-1\`。名键写错 ⇒ 整表建不起来（映射为空），症状是「全部反查失败」而不是部分。

> 完整正本（含类注册余量现算、闸门判据与工具链）：shared-trae \`knowledge/eratw/obj-system.md\`、\`clothes-system.md\`、\`identifier-tag-system/\` 域条目。
`,
  source: {
    upstream: 'shared-trae/knowledge/eratw/obj-system.md（＋ clothes-system.md / identifier-tag-system 域）',
    snapshotAt: '2026-10-21',
  },
};
