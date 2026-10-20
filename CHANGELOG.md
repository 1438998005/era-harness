# Changelog

本文件记录 era harness（Cline Chinese 减法改造版）的版本变更。
上游 Cline / Cline Chinese 的历史变更见其各自仓库。

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
