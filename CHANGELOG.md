# Changelog

本文件记录 era harness（Cline Chinese 减法改造版）的版本变更。
上游 Cline / Cline Chinese 的历史变更见其各自仓库。

## 3.89.4 — 2026-10-21

### 样式

- 功能设置「eraTW 工具」里的按钮重新做视觉层级：主操作用**实心蓝底 + 图标**（「检查并更新」「让 sasami 接管」），次要操作降为文字按钮（「收回给我」）；按钮尺寸从 `sm` 调回默认，不再淹没在说明文字里。

## 3.89.3 — 2026-10-21

按用户反馈，把「让位 / 更新」这类操作从隐蔽入口搬进设置页，并补齐 DeepSeek 的两个缺口。

### 新增

- **功能设置 →「eraTW 工具」**：两个真实按钮——「检查并更新」（走 `era-harness.updateGame`，仍会弹窗列改动等确认）与「EraBasic 语法归属」（「让 sasami 接管」/「收回给我」）。
- **`eraHarness.erabasic.languageOwner` 设置**（`era` / `sasami`）：把「让位」从一次性命令变成可持久、可撤销的状态；切换时自动落实到 `files.associations`（只动本扩展管理的 `*.erb` / `*.erh`）。
- **DeepSeek API 设置**：新增「打开 DeepSeek 开放平台」按钮（https://platform.deepseek.com/），以及「思维强度（reasoning_effort）」选项：低（low）/ 高（high，默认）/ 最大（max）。

### 变更

- 设置页按钮统一通过新增的 `UiService.runCommand` 调用；宿主侧维护命令白名单（不做通用 `executeCommand`），gate「命令注册一致性」会检查白名单里的 id 都在 `package.json` 里声明过。
- 按用户要求，撤掉侧边栏标题栏的让位按钮与首启弹窗：操作入口统一收进「功能设置」，状态栏仅保留状态与快捷入口。

### 修复

- `deepseek.ts` 之前完全不读 `reasoningEffort`。现在会映射成 DeepSeek 官方档位（`medium → high`、`xhigh → max`，未设置则不传、用官方默认 high），且只对思考模型发送。

### 验证

- 根/webview `tsc` 0 错；biome 0；`npm run gate` 十二道全绿（含命令白名单核对）；`test/update` 240/240。

## 3.89.2 — 2026-10-21

「举一反三」审计：把 3.89.1 修的三类问题（读错 API 层级／中央映射漏登记／能力未自述）在整仓扫了一遍，又抓到三处同类。

### 修复

- **评论区按钮点了没反应**：`reviewComment.reply` / `reviewComment.addToChat` 在 package.json 和菜单里声明为 `era-harness.*`，代码却还注册着 fork 前的 `cline-chinese.*`（改名没改全）。VS Code 按声明的 id 派发，点按钮只会报 command not found；tsc / lint / 测试全绿，因为没有任何一处检查字符串 id。现已对齐。
- **扩展会悄悄改你的全局设置**：`explainChanges` 建评论前会调 `ensureCommentsViewDisabled()`，把用户级 `comments.openView` 改成 `"never"`——影响你的所有项目、禁用卸载后也不会还原。与 3.89.0 修的 `files.associations` 是同一类问题，已整段删除（含抽象方法），不再写任何编辑器设置。
- **自动批准设置在多窗口下静默丢失**：`updateAutoApprovalSettings` 只接受版本号更高的请求，旧版本直接丢弃且不回推状态——界面勾上了、后端其实没变。现在丢弃时打一行 warn，并把真实状态推回界面（勾选框会回弹，不再骗人）。

### 新增

- **第十一道闸门「命令注册一致性」**：`contributes.commands` 声明 ⇄ `registerCommand` 注册（直写 + `commands.X` 常量两种写法）必须一一对上；反向也查「注册了却没声明」（CodeAction／内部命令走白名单）。负向验证：把 reply 改回 `cline-chinese.*` → 立刻红灯并点名缺失的命令。
- **第十二道闸门「分发边界」**：`.vscodeignore` 是显式黑名单，漏一个名字就会把开发资料发给用户——实测 `AGENTS.md` 从 3.86 一路被打进 vsix 到 3.89.1 才被发现；本地审计日志 `*-out.txt` 也差点跟着进去。现在 `AGENTS.md` / `*-out.txt` / `gate-*.txt` 均不进包，根目录零散文本文件未覆盖就红灯。

### 验证

- `npm run gate`：十二道全绿（23 条命令声明全部有注册；AGENTS.md 与本地日志不随包分发）
- `tsc --noEmit` 0 错；biome 通过；`test/update` 240/240；核心库 126 例

## 3.89.1 — 2026-10-21

3.89.0 装上后的三处实测反馈修复。

### 修复

- **「让位给 sasami.erabasic」必定失败**：弹「没有找到 sasami.erabasic，或它没有声明语言 id」。
  根因是读错了层级——`Extension.packageJSON` 是**整份** package.json，语言声明在
  `contributes.languages` 下，而代码只读了顶层 `languages`，所以永远拿到 `undefined`。
  实测 `sasami.erabasic@0.4.0`：修复前 `undefined`，修复后 `erabasic`（它的 `.erb/.erh` 就绑在这个 id 上）。
- **自动批准对 era 原生只读工具不生效**：用户把「读取全部 / 编辑全部 / 所有命令 / MCP / 身份」全勾了，
  查内置知识库（`era_knowledge`）时**仍然弹批准**。根因：`AutoApprove.shouldAutoApproveTool`
  的 switch 没有这些工具的 case，直接落到 `return false`。受影响的还有 `era_reference` /
  `era_symbols` / `setting_help` / `log_diagnose`。现在按「读取项目文件 / 读取所有文件」同档处理；
  `run_game` **仍保持人工确认**（它会弹游戏窗口、让引擎重写自己的文件），这是有意为之。
- **模型不知道自己有「更新 eraTW」按钮**：用户问怎么更新，模型只能背手册（下 zip、算 hash、分类覆盖），
  完全不提扩展自带的一键更新。现在领域提示词常驻一节「本扩展自带的能力」，要求先给按钮入口
  （侧边栏标题栏下载图标 / 命令 `era harness: 更新 eraTW（跟社区最新版）`）及其覆盖的步骤，
  再讲手工兜底；并明确模型不能代替用户点、也不能声称已代劳。

### 新增

- **第十道验收闸门「自动批准映射」**：凡是调 `shouldAutoApproveToolWithPath` 的处理器，
  其工具名必须在 `autoApprove.ts` 里有映射，否则即红——不映射的后果是「勾满了也没用」，
  而这种 bug 不会让测试变红。`RUN_GAME` 在白名单里（有意保留人工确认）现为显式记录。

### 验证

- `npm run gate`：十道全绿（新增「自动批准映射 11 个工具都有映射」）
- 插件 `tsc --noEmit` 0 错；biome 通过；`test/update` 240/240

## 3.89.0 — 2026-10-21

插件开始「解释自己」：新增内置设置目录与 `setting_help` 工具，使用者问「这个开关有什么用」时
模型不必再猜或翻源码。设置说明由构建时脚本从代码抽取，手写层只补「关掉会怎样」。

### 新增

- **`setting_help` 工具（扩展原生）**：查**本插件自己的**设置项——有什么用、默认值、取值范围、
  关掉会怎样、与哪些设置联动。参数 `key`（支持只写后缀）/ `query`（关键词）/ 都不给则列分组目录，
  纯离线。与 `era_knowledge` 分工明确：那边讲 EraBasic 工程侧纪律，这边讲插件自身。
- **内置设置目录**（`packages/era-harness-core/src/settings/`）：构建时从五个源抽取后生成 TS 常量——
  `FeatureSettingsSection.tsx` 的 15 个 `FeatureToggle`、`locales/zh-CN/settings.json` 的中文文案、
  `state-keys.ts` 的默认值、`package.json` 的 `contributes.configuration`（1 项）、
  `AutoApprovalSettings.ts` 的 9 个 action 子开关 ＋ 通知开关（11 项）。共 27 项。
  生成物入库（`data/*.generated.ts`），clone 后不装依赖也能构建。
- **手写补充层**（`data/overrides.ts`）：27 项「关闭后会怎样」＋ 与它们联动的设置，
  以及 22 项**明确不收录**的设置及理由（⛔ 不装作不知道，也不凭印象编）。
  ⚠️ 自动批准只收**活着的**开关：`enabled` / `maxRequests` / `favorites` 在代码里已标 Legacy field
  （恒为 true / 功能已移除），把它们当用户开关讲就是给错知识，因此刻意不收录并在容器条目里写明。
- **MCP 侧同名工具** `setting_help`：独立进程／其他宿主不必装扩展也能查。
- **四道新验收闸门**（`npm run gate` 共九道）：
  - 设置目录完整性：`UpdateSettingsRequest` 的 37 个字段必须 ∈ 目录 ∪ 未收录清单（当前 37/37 = 100%）；
  - 生成物新鲜度：生成物与源码不一致即红，提示重跑 `npm run build:settings`；
  - 工具登记完整性：12 个 prompt 变体 + `READ_ONLY_TOOLS` 少一处即红——
    漏登记时工具对某些模型永远不可见，而测试照样全绿。
  - 语言归属声明：`.erb/.erh` 必须由 `contributes.languages.extensions` 声明，且 `syncAssociations` 不得回退。

### 修复

- **禁用/卸载扩展后 `.erb` 变纯文本（严重，影响所有装过旧版的用户）**：旧实现把 `.erb/.erh`
  的语言归属靠**运行时写用户的** `settings.json`（`"*.erb": "era-erb"`）来抢。扩展一旦被禁用/卸载，
  语言 id `era-erb` 就没了，但那条关联还在，而 `files.associations` 优先级高于静态声明。
  于是 `.erb` 落到不存在的语言上 = 纯文本，**不会回退到内置 Ruby**，比不装还糟；开设置同步的还会传播到其他机器。
  现在改为标准做法：`contributes.languages.extensions: [".erb", ".erh"]`，语言随扩展注册/注销，
  **禁用即自动归还 Ruby**，运行时零自动写入。另外：
  - 激活时**自愈**，静默清掉旧版留在 `files.associations` 里的 `era-erb` 值；
  - 新增命令「让位给 sasami.erabasic」（写对方语言 id，状态栏常驻入口）与「收回 .erb/.erh 的语法归属」（可逆）；
  - `eraHarness.erabasic.autoTakeover` 语义收敛为「补全/跳转/符号」开关——语法高亮不再受它控制（静态声明无法运行时撤销）。
  - 代价（已接受）：同时装了 `sasami.erabasic` 的人需点一次「让位」才切回它的语法。
- **`.vscodeignore` 里两条失效的 codicons 例外规则**：`node_modules/` 已排除父目录，`!` 无法
  把子项捞回来，那两行从未生效。实测出厂 vsix 的 `assets/index.css` 已把 codicon 内联为
  `@font-face`（`./codicon.ttf` 也在包里），运行时不再请求 `node_modules/@vscode/codicons`，故删除规则并注释说明。
  （另：反馈里的 codicon 404 在 3.87.1 的 release 产物里**无法复现**——全树搜 `@vscode/codicons` 只命中 `package.json` 的依赖声明。）

### 变更

- `AGENTS.md` 文件地图补两条联动：改设置页文案要重跑生成器；proto 新增字段要进目录或白名单。

### 验证

- 核心库 `npm test`：126 例 / 125 过 / 1 跳过（新增 22 例设置目录用例）
- 插件回归：`test/update` 240 / 240，`test/free` 24 / 24
- 双方 `tsc --noEmit`：0 错；`npm run gate`：九道全绿

## 3.88.0 — 2026-10-21

一次集中的功能补全：编码安全写回落地、内嵌知识库扩到 7 条、更新工具 G1–G8 闸门全部接通、新增 `era_knowledge` 工具。

### 新增

- **编码安全写回**（`packages/era-harness-core/src/encoding/write.ts`）：落盘后按原编码 / BOM / 行尾还原并复检。
  CP932 文件不会被静默转成 UTF-8；写不回原编码时降级为 UTF-8 带 BOM 并明确告知。
  判据为纯函数，未引入 iconv-lite，核心库仍是零运行时依赖。
- **`era_knowledge` 工具**：内嵌知识条目检索（编码纪律 / 导入合并闸门 G1–G8 / 口上结构契约 / 存档迁移判据），
  每条附「症状→根因→修法」反模式，可离线。
- **内嵌知识库扩到 7 条**：新增「工程结构纪律」「主流程管线」「OBJ 数据框架与 qol 层约定」「存档迁移判据」；
  配套 `knowledge-candidates.json` 候选池（面 / 稳定性 / 裁定 / 常驻档位）。
- **更新工具 G1–G8 闸门全部接通**：`src/core/update/{gates,version,keys,labels,decode}.ts`，
  含全树调用方检索与被删函数的外部调用方检查。
- **验收脚本**：`npm run gate` / `gate:full`（`scripts/gate-baseline.mjs`）——用例数由脚本现算，
  并核对「用例登记 vs 磁盘文件」与知识候选池四处一致性。
- **仓库级 `AGENTS.md`**：本仓专属约束（分层指令、验收命令、文件联动地图），不含任何本机路径。

### 修复

- `gate-baseline.mjs` 的汇总解析只认 TAP 的 `# tests N`，而 Node 24 默认 reporter 输出 `ℹ tests N`，
  导致在 Node 24 上 `npm run gate` 恒报「没跑成（拿不到 TAP 汇总）」。

### 验证

- 核心库 `npm test`：104 例 / 103 过 / 1 跳过（跳过的是 `integration: real eratw project`，需 `ERA_PROJECT_PATH`）
- 插件回归：`test/update` 240 / 240，`test/free` 24 / 24
- 双方 `tsc --noEmit`：0 错；`esbuild --production`：EXIT 0

## 3.87.1 — 2026-10-20

仓库自洽化，无行为变化。

### 变更

- **核心库搬进仓库**：`era harness/`（日志解析、工程画像、编码安全读取、指令数据）
  移入 `packages/era-harness-core/`。原先 `@eraharness` 别名指向仓库外的 `../era harness/src`，
  导致 clone 到其他机器后无法构建；现在 clone 下来即可独立编译。
- 三处别名同步更新：`esbuild.mjs`、`test/update/run.mjs`、`tsconfig.json`。
- `.vscodeignore` 增加 `packages/**`：核心库是**构建期**依赖，esbuild 会把它内联进 `dist/extension.js`，
  运行时不需要，因此不进 vsix。

## 3.87.0 — 2026-10-20

首个带完整 era 专用工具集的本地版本。

### 新增

- **指令手册工具 `era_reference`**：内置 312 页 / 2000+ 名字的离线快照，覆盖 Emuera 全部指令；
  命中单条时优先取在线上游最新版并**整页替换**，返回结果标注来源（在线 / 内置快照 + 回退原因）。
  `ERA_HARNESS_REFERENCE_ONLINE=off` 可完全禁网，`ERA_HARNESS_REFERENCE_BASE` 可指向自建镜像。
- **引擎启动工具 `run_game`**：探测 `Emuera*.exe`（按版本号倒序，排除 `.vshost.`/`.config` 等噪音），
  以 exe 目录为 cwd 启动，等待静止后报告进程状态、**加载痕迹**与本次新写入的日志。
  支持 `action=status` / `stop`、`keep_alive`、`exe` 精确指定。
- **脚本符号检索工具 `era_symbols`**：按标签或调用点检索，过滤注释/字符串里的假标签，跳过备份目录。
- **日志诊断工具 `log_diagnose`**：自动定位最新日志，按种类归类语法错误并给出修法。
- **ERB 结构体检**：写盘后相对比较 IF/FOR/WHILE/SELECTCASE/DO/REPEAT/CATCH 块与半角括号，
  变坏时在工具结果里追加警告（不要求绝对配平，避免误伤上游本来就不配平的文件）。
- **身份分区**：本体侧 / 口上·剧本侧 / 权限全开三档，按探测到的口上目录限制作业范围。
  越界修改即使开了自动批准也必须人工确认。
- **更新 eraTW**：拉取社区版差异 → 生成计划 → 弹窗确认 → 备份后落盘，可一键撤销。
- **免费模型池**：多通道自动 failover，无需 API Key 即可启动。

### 修复

- **提示词占位标签被模型照抄**：`tool_use/formatting.ts` 里的 `<tool_name>/<parameter1_name>`
  模板会让小模型把占位符当真标签写进工具调用（实测连错 3 次触发任务中止）。
  改为真实双参数示例并显式声明「不要输出占位标签」；`responses.ts` 的重试提醒同步修正。
- **工具说明书与实现不一致**：`execute_command` 的 O1 格式说明书缺 `requires_approval`；
  `search_files` 写成 `<filePattern>` 而非 `file_pattern`；`web_fetch.prompt` 与
  `ask_followup_question.options` 标成必填但无人消费/无校验。以上全部对齐。
- **免费模型上下文窗口显示成固定 128k**：UI 之前对所有免费模型都返回通用占位值，
  改为按免费池真实窗口显示。
- **流已输出后仍切换模型**：会把「模型 A 说到一半 + 模型 B 重新开头」拼在一起，改为报错。
- **用户中止后仍可能发起下一个请求**：候选之间没有 controller 的缝隙会让停止键失效，
  改为显式中止标志。
- **Kilo 免费清单不可达时每轮等一次超时**：增加失败冷却。
- **大日志卡死宿主**：日志诊断与引擎验证原先整份读取，几百 MB 的会话日志会卡住扩展宿主；
  现在按行边界限流读取并在结果里如实标注「只看了开头」。
- **同一引擎重复启动产生孤儿进程**：注册表按 exe 路径索引，第二个实例会覆盖旧条目使旧进程无法结束；
  现在检测到活实例直接拒绝并提示先 `stop`。
- **符号检索重复解析同一文件**：同一文件的多条命中会反复读盘 + 解析，改为按文件缓存。

### 变更

- 插件简介与 README 重写：能力表按「读懂工程 / 改动与验证 / 底座」分组，补全已知限制。
- 日志「没有新内容」不再被当作加载失败：Emuera 停在标题画面时不写游戏日志，
  真实判据是引擎产物（`lazyloading*.bin` 是否重建、`sav/global.sav` 是否更新）。
