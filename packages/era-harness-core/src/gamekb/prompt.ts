/**
 * 「建库 / 更新库」两段对话的任务提示词。
 *
 * 放在核心库而不是宿主侧：纯字符串函数，能在 node:test 里直接断言约束有没有写全
 * （分片、只写库目录、不抄正文、必须带出处……漏一条就会生成一份没法用的库）。
 *
 * 身份块由调用方传入（`src/shared/identity.ts` 的 `UNRESTRICTED_IDENTITY_BLOCK`）：
 * 核心库不认识插件的 shared 层，也不该认识。
 */

import type { GameKbManifest } from './types.js';

export interface KnowledgeBasePromptContext {
  /** 库名（用户起的；更新时可省略，从 manifest 取） */
  name?: string;
  /** 库目录绝对路径 */
  dir: string;
  /** 工作区根绝对路径 */
  workspaceRoot: string;
  /** 目标工程根（可能等于工作区根，也可能在子目录） */
  gameRoot?: string;
  /** 建库时探测到的游戏版本串 */
  gameVersion?: string;
  /** 身份指令块，由宿主传入 */
  identityBlock: string;
}

const KB_JSON_SCHEMA = [
  '```json',
  '{',
  '  "schemaVersion": 1,',
  '  "slug": "<目录名，⛔ 不要改>",',
  '  "name": "<库名，⛔ 不要改>",',
  '  "gameRoot": "<工程根绝对路径>",',
  '  "gameVersion": "<游戏版本串，拿不到就省略>",',
  '  "createdAt": "<⛔ 不要改>",',
  '  "updatedAt": "<本次更新时间，ISO 8601>",',
  '  "enabled": true,',
  '  "index": "index.md",',
  '  "counts": { "function": 0, "constant": 0, "table": 0 },',
  '  "files": [{ "path": "functions/xxx.md", "title": "分片标题", "count": 12 }]',
  '}',
  '```',
].join('\n');

/** 两段提示词共用的硬性约束 */
const HARD_RULES = [
  '## 硬性约束（违反会让这份库没法用，甚至污染工程）',
  '- ⛔ 只写知识库目录下的文件；**不要修改、移动、删除游戏源码**（.ERB / .ERH / .CSV 一个字节都不要动）。',
  '- ⛔ 不复制函数正文、不抄台词与剧情文本。只写「这个函数/常量是做什么的」，不搬运实现。',
  '- 每条都要能追到出处（`相对路径:行号`）。追不到出处的不写；拿不准的标「未确认」，⛔ 不要编。',
  '- 单个分片 ≤ 300 行；`index.md` ≤ 200 行。超了就是分片没切细，回去拆。',
  '- 不要停下来反复向用户确认：信息不足时按现有代码推断并标注「推断」，先做完再汇报。',
].join('\n');

const SHARD_RULES = [
  '## 结构：总索引 + 分片（⛔ 不要把所有内容写进一个文件）',
  '- `index.md`：**总索引**。一行一条，格式 `- NAME — 一句话 — 出处 相对路径:行号`；按下面的小节分组。',
  '- `functions/<主题>.md`：函数详解。按 ERB 顶层目录或名字前缀分片（如 `functions/combat.md`）。',
  '- `constants/<主题>.md`：常量、变量槽位、枚举（`#DIM CONST`、TFLAG/CFLAG 之类）。',
  '- `tables/<主题>.md`：CSV 表结构（有哪些列、每列什么意思、取值范围）。',
  '- `kb.json`：元数据，见文末。',
  '',
  '`index.md` 的小节固定为：`## 函数`、`## 常量与变量槽位`、`## CSV 表结构`、`## 机制与坑`。',
].join('\n');

/** 建库 */
export function buildCreatePrompt(ctx: KnowledgeBasePromptContext): string {
  // 可选行用 null 占位：直接写 '' 再统一过滤会把**所有**空行吃掉，标题就贴着正文了
  const lines: (string | null)[] = [
    ctx.identityBlock,
    '',
    '# 任务：为这个游戏建立「专属知识库」',
    '',
    ctx.name ? `库名：${ctx.name}` : null,
    `知识库目录（下面所有写入都只允许落在这里）：\`${ctx.dir}\``,
    `工作区根：\`${ctx.workspaceRoot}\``,
    ctx.gameRoot ? `游戏工程根：\`${ctx.gameRoot}\`` : '游戏工程根：请按工作区探测结果自行确认',
    ctx.gameVersion ? `游戏版本：${ctx.gameVersion}` : null,
    '',
    '## 目标',
    '让之后的对话**不必重读整个工程**就能回答：这个 `@函数` 是干什么的、这个常量/槽位是什么意思、',
    '这张 CSV 表有哪些列。这是给「改脚本的 AI」用的速查手册，不是给玩家看的攻略。',
    '',
    SHARD_RULES,
    '',
    HARD_RULES,
    '',
    '## 工作顺序',
    '1. **先摸结构**：ERB 的顶层目录、CSV 目录、ERH 声明文件、引擎配置。别急着写。',
    '2. **建索引骨架**：把 `index.md` 的分类先立起来（可以先是空小节）。',
    '3. **按主题分片补细节**：一次处理一个主题（如「战斗」「移动」「口上」），写完就回填 `index.md` 对应行。',
    '4. **收尾**：把 `kb.json` 的 `updatedAt` / `counts` / `files` / `gameVersion` 更新成实际值。',
    '',
    '## 覆盖优先级（时间有限时按这个顺序做）',
    '1. 全局常量与变量槽位（CSV 枚举、`#DIM CONST`）——查错时最常撞到',
    '2. 公共函数（被大量 CALL 的）——改脚本时最常调用',
    '3. CSV 表结构——加新角色/道具时要改',
    '4. 机制与坑（时序、初始化、依赖）——踩过才知道',
    '',
    '## kb.json',
    '文件已经存在（扩展建的初版），你只需要**更新**下面这几个字段，其余保持原样：',
    KB_JSON_SCHEMA,
    '',
    '## 完成标准',
    '- `index.md` 里每个条目都能在分片里找到详解，且带出处；',
    '- 分片单文件 ≤ 300 行；',
    '- `kb.json` 的 `counts` / `files` 与实际文件一致。',
    '',
    '做完后一句话汇报：建了几个分片、各多少条、覆盖到哪一层。',
  ];
  return lines.filter((line): line is string => line !== null).join('\n');
}

/** 更新库 */
export function buildUpdatePrompt(ctx: KnowledgeBasePromptContext & { manifest: GameKbManifest }): string {
  const files = ctx.manifest.files ?? [];
  const fileList =
    files.length > 0
      ? files.map((f) => `  - \`${f.path}\`${f.title ? `（${f.title}）` : ''}`).join('\n')
      : '  - （`kb.json` 里没有登记分片，请先自己 `ls` 一遍目录）';

  const lines: (string | null)[] = [
    ctx.identityBlock,
    '',
    `# 任务：按当前工作区更新知识库「${ctx.manifest.name}」`,
    '',
    `知识库目录：\`${ctx.dir}\``,
    `工作区根：\`${ctx.workspaceRoot}\``,
    ctx.gameRoot ? `游戏工程根：\`${ctx.gameRoot}\`` : '游戏工程根：请按工作区探测结果自行确认',
    ctx.gameVersion ? `本次探测到的游戏版本：${ctx.gameVersion}` : null,
    `库上次更新：${ctx.manifest.updatedAt || '未知'}`,
    '',
    '## 先读再改',
    '1. 读 `index.md`，把现有条目列出来；',
    '2. 读已登记的分片：',
    fileList,
    '3. 再去工作区里核对：**函数/常量/表结构有没有新增、删除、改名、语义变化**。',
    '',
    '## 只改变化的部分',
    '- 结构保持不变：⛔ 不要重新组织目录、不要重命名分片、不要把分片合并成一个大文件。',
    '- 新增的补进对应分片与索引；消失的从索引里删掉并在分片里标注「已移除」；改语义的就地改。',
    '- 没变化的条目**一个字都不要动**——重写一遍只会引入新的错。',
    '- 只改了一部分也要更新 `kb.json` 的 `updatedAt`，并把 `counts` / `files` 校准到实际值。',
    '',
    SHARD_RULES,
    '',
    HARD_RULES,
    '',
    '## kb.json',
    '只更新 `updatedAt` / `counts` / `files` / `gameVersion`，`slug` / `name` / `createdAt` / `enabled` 保持原样：',
    KB_JSON_SCHEMA,
    '',
    '## 完成标准',
    '- 索引与分片一一对应，没有指向不存在文件的条目；',
    '- 本次变化点在汇报里逐条列出来（新增 N / 修改 M / 移除 K）。',
  ];
  return lines.filter((line): line is string => line !== null).join('\n');
}
