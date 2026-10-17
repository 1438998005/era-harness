# era harness 插件减法方案（fork: SSYCloud/cline-chinese v3.86.6）

> 2026-10-15 立。基线 commit `d142f89`（本地 raw 重建，3479/3479 字节校验一致）。
> 合规审查结论见工作区 `知识库/08-待验证清单.md` #16 销项记录；决策见 `06-决策记录.md` D15。
> **产品名：era harness**（VSC 扩展形态，.vsix 本地 sideload 测试，不上线任何市场）。

## 0. 总原则

- 保留 = §10.6 清单：agent 循环、文件读写（换编码安全封装）、终端、MCP 客户端、checkpoint/diff 审批、provider 配置（**仅 DeepSeek + 自定义 OpenAI 兼容**）。
- 每个批次结束时 `npm run compile`（check-types + webview tsc + esbuild）必须通过，再进下一批。
- 删除以"目录级整删 + 孤立引用清理"两步走：先删文件，再按 tsc 报错逐个断链。

## 1. 顶层删除（批次 1）✅ 已完成（commit `35216ba`，compile 全绿）

> **执行记录（2026-10-17）**：
> - 实际删除范围比本表更彻底：**整个测试体系**一并删除（`src/test/`、`src/__tests__/`、144 个 `*.test.ts`、`.mocharc.json`、`tsconfig.test/unit-test.json` 及测试专用 devDeps）。理由：上游单测测的是批次 2-4 要删的 provider/功能，保留会逐批爆红；回归闸门改为 compile + sideload 实测。
> - `src/standalone/` 与 `src/hosts/external/` 的 external-host 实现已删；`FolderLockUtils` 改为单实例空实现（锁恒 `skipped`）。`AuthHandler.ts` 暂留（oca 引用，批次 2 随 auth 删）。
> - **命令/视图 ID 全量改名**：`src/registry.ts` 的 `prefix` 取自 package.json `name`，改名 `era-harness` 必须联动 package.json 所有 command/menu/keybinding/view id；context key、config section、`~/.era-harness` 存储目录、redirect URI 同步改。
> - 生成器 `generate-host-bridge-client.mjs` / `generate-protobus-setup.mjs` 已停止产出 standalone 产物（否则 `npm run protos` 重新生成引用已删文件的死代码）。

| 路径 | 理由 |
|---|---|
| `evals/`（含 submodule cline-bench） | evals 体系，本地测试不需要 |
| `sdk/` | 第三方 SDK monorepo |
| `cli/` | CLI 形态 |
| `standalone/` | standalone server 形态 |
| `testing-platform/` | 测试编排平台 |
| `walkthrough/` + package.json 的 walkthrough contribution | VSC 欢迎页 |
| `docs/` `docs-zh/`（docs 站点） | 上游文档站，乘法不需要 |
| `tests/` `src/test/` `playwright.config.ts` `test-setup.js` | vscode-test/playwright e2e 体系 |
| `skills-lock.json` | 上游 skills 锁，无关 |

package.json 手术：name→`era-harness`、publisher→本地、description 重写；删除 scripts：`publish:*`、`eval:*`、`test:e2e*`、`test:sca-server`、`test:tp-orchestrator`、`compile-standalone`/`postcompile-standalone`、`storybook`、`docs*`、`report-issue`、`pretest`；保留 `compile`/`package`/`protos`/`watch`/`install:all`/`build:webview`。activationEvents 去掉 `workspaceContains:evals.env`。

## 2. 外联/账号/遥测剥离（批次 2，#16 条件落地）

**整目录删除**（src/services/）：`browser/`（浏览器工具，删除清单）、`account/`（ClineAccountService，app.cline.bot）、`auth/`（含 oca Oracle 登录）、`banner/`（远端横幅）、`feature-flags/`（PostHog 特性开关）、`lg-cns-integration/`（webhook 钩子写入）、`telemetry/`（PostHog + OTel 全家）。

**改造**：
- `src/services/error/`：删 `providers/PostHogErrorProvider.ts`，`ErrorProviderFactory` 改为本地无上报工厂；保留 `ClineError`/`ErrorService`。
- `src/services/uri/SharedUriHandler.ts`：删 `/ssy`、`/shengsuanyun` case 与 `handleShengSuanYunCallback` 调用（保留其余 OAuth 路由框架给未来用或整删）。
- `src/shared/cline/banner.ts` 及所有 banner 引用：删。
- remote-config：`src/core/storage/remote-config/` 的 `syncRemoteMcpServers.ts`（同步 cline.bot MCP 市场）删，`fetch.ts` 改为不默认拉取或删。
- `src/config.ts` 的 `ClineEndpoint`：保留类（cli 形态引用），但删除 account/marketplace 消费点后自然无调用；staging/local 分支可留可不留，批次 2 末 tsc 验证无引用后删。

**providers.json 精简**：`src/shared/providers/providers.json` 只留 `deepseek` + `openai` 两条（用户明确：仅 DeepSeek + 自定义添加两个按钮）。

## 3. provider 删除（批次 2 续）

`src/core/api/providers/` **只保留**：`deepseek.ts`、`openai.ts`、`types.ts`；`index.ts` 里注册表只留两者；transform 保留 deepseek/openai 链路实际引用者（预计 `stream.ts`/`tool-call-processor.ts`/`openai-format.ts`/`openai-response-format.ts`/`r1-format.ts`/`openrouter-stream.ts`，以 tsc 为准删其余）。

同步删：
- 所有 `refresh<Provider>Models` controller（`src/core/controller/models/refresh*.ts`）中除 DeepSeek 外的全部；保留 `refreshDeepSeekModels.ts` + 框架文件。
- `src/core/api/index.ts`、`src/shared/api.ts` 中删掉的 provider 的 handler 工厂与默认 model 常量（含 `shengSuanYunDefaultModelId/Info`）。
- `src/shared/storage/provider-keys.ts`、`state-keys.ts`、`src/shared/proto-conversions/`、`src/core/storage/disk.ts` 的删 provider 条目。
- `src/core/controller/account/`（OAuth  clicked 系）：shengSuanYunLoginClicked、hicapAuthClicked 全删；`shengSuanYunLoginClicked` 对应 proto RPC 注册（`src/core/controller/index.ts`）删。
- webview-ui 对应 provider 设置组件（批次 4）。

## 4. 功能删除（批次 3）

- `src/core/controller/worktree/`（多 worktree/多任务并行）、`src/core/task/tools/subagent/`（subagent 工具）。
- `src/core/task/tools/handlers/ReportBugHandler.ts` + slash `reportBug.ts`（建 GitHub issue，本地工具不需要外跳）。
- `src/integrations/claude-code/`、`src/integrations/openai-codex/`（OAuth 形态）。
- `src/hosts/external/AuthHandler.ts`（账号 OAuth 主机）。
- `src/core/api/providers/cline.ts`（Cline 账号 provider）。
- 各批 tsc 断链随删。

## 5. webview-ui 清理（批次 4）

- settings/providers 列表组件只留 DeepSeek + OpenAI Compatible 两张设置卡。
- 删 telemetry/banner/account/worktree 相关组件与 tab。
- 替换品牌：插件名 era harness、图标（assets/）、about 弹窗。

## 6. 领域层接入（批次 5，读写闭环）

- **编码安全 IO**：`src/core/task/tools/handlers/` 的 read/write file 工具换 `era harness` 核心库（`../era harness/src/encoding`）——包内以 workspace 依赖或复制适配层接入（方案：`file:///D:/era harness工作区/era harness` 本地依赖 or npm workspace；本地测试优先 file: 依赖）。
- **check_write_allowed**：新工具，规则源 = 知识库 02 §2.5/§2.6（双身份边界 + CSV 只追加 + 备份纪律）；身份模式（本体/口上）以 settings 开关 + rules 注入。
- **era system prompt**：`src/core/prompts/` 增加 ERABASIC 领域提示层（口上作者语气、ERD 命名、日志驱动修复流程）。
- **run_game（可选本轮）**：Phase 3 闭环，本地 .bat 启动 + 读新日志。

## 7. 打包与实测（批次 6）

- `npx @vscode/vsce package` → `era-harness-<ver>.vsix`（本地产物，gitignore）。
- 本机 VSCode（`D:\...\编辑器\Microsoft VS Code`）sideload：`code --install-extension era-harness-x.x.x.vsix`。
- 验收（销 08 #13）：口上场景读文件→AI 提议→diff 审批→落盘（CP932 文件读改写回不乱码）；本体场景跑 parse_emuera_log 闭环。
- **禁止**：`vsce publish`、任何市场上传（用户明确仅本地测试）。

## 8. 风险与顺序依赖

- proto 变更（删 provider model message）需 `npm run protos` 重生成——批次 2/3 里凡动 `src/shared/proto` 的都要跑。
- webview-ui 与 extension 通过 proto 生成的 service 通信，删 controller 要同步删 webview 调用点，否则 build:webview 失败。
- CP932 **写回**（重编码）Node 无现成 API——先出方案（窄表自编 vs iconv 依赖）再动写路径，见 08 待验证。
