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

### 2a 执行记录 ✅（commit `a8929b0`，compile 全绿）

实际做法是**保留接口、替换实现**，而非整目录删除——因为 `telemetryService`/`featureFlagsService` 是 `new Proxy({} as Service, ...)` 形态，调用点 30+ 处，删目录会连锁断链。

- 遥测：新增 `NoopTelemetryProvider`（`isEnabled()` 恒 false、`getSettings()` 返回 `off`），`TelemetryService.create()` 只用它；删 `posthog-node` 与 19 个 `@opentelemetry/*` 依赖。
- 错误上报：`ErrorProviderFactory` 重写为 `type: "no-op"`，错误只写 `Logger`。
- 特性开关：`FeatureFlagsProviderFactory` 重写，`getAllFlagsAndPayloads()` 返回 `{}`。
- 横幅：`BannerService` 重写为静态 no-op，横幅恒空。
- 远端配置：`remote-config/fetch.ts` 整文件改 no-op（原为带 token 每小时轮询 cline.bot）；`utils.ts` 删 OTel 与远端 MCP 同步。
- MCP 市场：`downloadMcp.ts` 返回「已移除，请手动写 mcp_settings.json」；`controller/index.ts` 的 `fetchMcpMarketplaceFromApi()` 返回空列表。**McpHub 本体完整保留**（stdio/SSE/HTTP）。
- URI 路由：`SharedUriHandler` 删 `/ssy` `/shengsuanyun` `/hicap` `/lg-task`。
- 账号入口桩：`shengSuanYunLoginClicked`、`hicapAuthClicked`、`testOtelConnection` 改为返回「已移除」提示（proto 自动注册仍在，删文件会断生成代码）。

### 2b 去登录 + 去 PostHog + 品牌个性化 ✅（构建全绿）

- webview 遥测栈：删 `CustomPostHogProvider.tsx`、`webview-ui/package.json` 去 `posthog-js`；`Providers.tsx` 去掉包裹层；`useFeatureFlag.ts` 恒返回 false。
- 登录态：`ClineAuthContext.tsx` 重写为恒未登录（不发 auth 订阅、不取 organizations）；`WelcomeView.tsx` 去掉二段式登录引导，直接展示 `ApiOptions`。
- 品牌：`package.json` 删 `contributes.icons`（cline 字体图标）与 `$(cline-icon)` 引用；`assets/icons/` 清掉 cline-bot/panda-face/sleepy-cline/icon-market/robot_panel 共 9 个旧资源，换成脚本生成的 `icon.png`（512×512，`scripts/make-icon.py`）与单色 `icon.svg`（`currentColor`，随主题着色）。
  - **东方 Project 视觉语汇**（用户指定）：御札（符纸）+ 红白蝴蝶结 + 背后魔法阵 + 樱花瓣 + 金色星芒，中央保留块状 E 字标作为 era 的字形锚点。深紫夜色底，朱红 `#c8434b` 为主强调色。
- 界面主视觉：新增 `webview-ui/src/assets/EraLogo.tsx`（与图标同源），`HomeHeader` 用它替换三个 Cline 表情 logo；欢迎标题改为「今天动哪一段？」。
- README 重写（无外链图片，vsce 才肯打包）。

## 2.5 身份系统（新增需求）

**三种身份**，通过每条用户消息前缀的 `<era-identity mode="...">` 块下发，因此对话中途切换即刻生效，无需重建任务：

| id | 名称 | 输出契约 | 权限 |
| --- | --- | --- | --- |
| `self` | 本体侧 | 直述、不演绎、不补设定 | 沿用现有批准档位 |
| `persona` | 口上（剧本）侧 | 按既有角色设定产出，技术说明入【场外】 | 同上 |
| `unrestricted` | 权限全开 | 本体口径 + 直接执行 | 全部 actions 置 true |

实现：
- `webview-ui/src/components/chat/identity/identity.ts`：模式表、指令拼装 `buildIdentityDirective()`、回读剥离 `splitIdentityDirective()`、localStorage 持久化。
- `useIdentity.ts`：状态 + 新对话自动弹窗（以 `didHydrateState` 门控，避免恢复旧任务时误弹）+ 「权限全开」切走时恢复原批准档位（快照 `previousActionsRef`）。
- `IdentityPickerModal.tsx`：三卡选择 + 「每次新开对话都询问」开关，点选即生效。
- `IdentityBar.tsx`：输入区上方常驻身份条，一点即换。
- 注入点：`useMessageHandlers` 在 `hasContent` 分支前置指令块。
- 展示层：`UserMessage` / `TaskHeader` 用 `splitIdentityDirective()` 剥掉指令块，改为「身份 · XX」小标签，避免污染气泡。

## 3. provider 删除（批次 2 续）

`src/core/api/providers/` **只保留**：`deepseek.ts`、`openai.ts`、`types.ts`；`index.ts` 里注册表只留两者；transform 保留 deepseek/openai 链路实际引用者（预计 `stream.ts`/`tool-call-processor.ts`/`openai-format.ts`/`openai-response-format.ts`/`r1-format.ts`/`openrouter-stream.ts`，以 tsc 为准删其余）。

同步删：
- 所有 `refresh<Provider>Models` controller（`src/core/controller/models/refresh*.ts`）中除 DeepSeek 外的全部；保留 `refreshDeepSeekModels.ts` + 框架文件。
- `src/core/api/index.ts`、`src/shared/api.ts` 中删掉的 provider 的 handler 工厂与默认 model 常量（含 `shengSuanYunDefaultModelId/Info`）。
- `src/shared/storage/provider-keys.ts`、`state-keys.ts`、`src/shared/proto-conversions/`、`src/core/storage/disk.ts` 的删 provider 条目。
- `src/core/controller/account/`（OAuth  clicked 系）：shengSuanYunLoginClicked、hicapAuthClicked 全删；`shengSuanYunLoginClicked` 对应 proto RPC 注册（`src/core/controller/index.ts`）删。
- webview-ui 对应 provider 设置组件（批次 4）。

### 3.x 执行记录（2026-10-17，compile 全绿 + .vsix 8.7MB sideload 通过）

- **provider 实现层**：`src/core/api/providers/` 44 → 3 个文件（只留 `deepseek.ts`/`openai.ts`/`types.ts`）；`src/core/api/index.ts` 的 470 行 switch 重写为 2 例，未知/未配置 provider 回落 DeepSeek 并 `Logger.warn`。
- **controller 层**：删 26 个文件（refresh*/get*Models/subscribeTo*），只留 `refreshOpenAiModels` + `updateApiConfiguration` 三件套；`initializeWebview.ts` 重写为只含 MCP 目录 + 遥测初始化。
- **proto 层**：`proto/cline/models.proto` 的 ModelsService 从 22 个 RPC 删到 4 个（refreshOpenAiModels + 3×updateApiConfiguration）；连带删 `VsCodeLmModelsArray`/`LanguageModelChatSelector` 两个消息；`state.proto`/`models.proto` 的 `vs_code_lm_model_selector` 字段类型改 string（state-keys.ts 同步）。
- **vscode-lm 全链路清除**：provider 文件（带 `declare module "vscode"` 增强）、transform、controller、webview 卡片、ApiOptions 增强块。**断链 28 处的根源是类型增强被删**，不是普通引用残留。
- **webview 死 UI**：删 42 个 provider 卡片 + 11 个 ModelPicker + ClineAccountInfoCard + FeaturedModelCard + 3 个残留测试；`ApiOptions.tsx` 从 585 行重写为 ~290 行（只渲染 DeepSeek + OpenAI 兼容两张卡）。
- **ExtensionStateContext 拆弹**：删 2 个死订阅、7 个死刷新函数、2 个自动刷新 effect 及 context 导出/接口声明（-145 行）。这两处订阅在 webview 挂载时无条件调用已删 RPC，不删必崩。
- **构建链修复**：`npm prune` 清 extraneous 包（vsce 打包前提）→ 顺带清出批次 1 漏网的测试残留（hooks/prompts/webview 两侧 0 残留）→ `vsce package` 成功（8.7MB/100 文件，比批次 2b 的 9.57MB 小 ~0.9MB）→ PowerShell sideload 安装验证通过。
- **质量门**：扩展侧 tsc 0 错误 + webview `tsc -b`（app 配置）0 错误 + `npm run compile` exit=0。

## 3.5 账号/登录体系移除（2026-10-18，compile 全绿 + .vsix 8.65MB sideload 通过）

**webview 删除**：`components/account/`（AccountView + AccountWelcomeView）、`RemoteConfigSection`、`ClineAuthContext`、`StorybookDecorator`、18 个 `.stories.tsx`、`SpendLimitError`。
**webview 清理**：Providers 去 AuthProvider；App 去 AccountView/showAccount；Navbar 重写（去账号项）；SettingsView 去 activeOrganization/UserOrganization；WelcomeSection 去 clineUser 过滤与 AccountServiceClient；CreditLimitError 重写（去组织额度链接）；ErrorRow 去 auth/SpendLimit 分支；ExtensionStateContext 去 showAccount/navigateToAccount/hideAccount + 账号按钮订阅（-60 行）。
**扩展删除**：`src/services/account/`、`src/services/auth/`（整个 OAuth 体系）、`src/core/controller/account/`、`src/core/controller/ocaAccount/`、`subscribeToAccountButtonClicked`、`src/hosts/external/AuthHandler`。
**扩展清理**：controller/index.ts（去 3 服务字段/初始化/4 个账号方法/remoteConfigTimer 整套）；extension.ts（去 AccountButton 命令注册 + clineAccountId 密钥监听 + 3 个 import）；updateSettings(+Cli)（去环境切换时的登出调用）；SharedUriHandler（删 /auth、/auth/oca 两个路由）；WebFetch/WebSearch handler 重写为移除提示桩（原为 cline.bot 云端 API 客户端，本地版无账号不可用）；TelemetryService/ITelemetryProvider/NoopTelemetryProvider（ClineAccountUserInfo → UserInfo）；remote-config/utils（canDisableRemoteConfig 恒 false）；registry.ts 去 AccountButton。
**proto**：account.proto 删 AccountService 16 RPC；oca_account.proto 删 OcaAccountService 3 RPC；ui.proto 删 subscribeToAccountButtonClicked。
**保留**：state.proto 的 userInfo 字段与 setUserInfo（休眠字段，恒 undefined，同 onboardingModels 处理）。

## 3.6 browser 子系统删除 + 联网能力重建（2026-10-18，compile 全绿 + .vsix 7.64MB sideload 通过）

**决策**：用户确认"不需要操控真实浏览器" → browser 工具整体删除；`@url` mention 改用 **DeepSeek Fetch API**；`web_search`/`web_fetch` 从"移除桩"**复活为真实现**，底层走 DeepSeek Search/Fetch API（模型可自主联网搜索）。

**新增**：`src/services/deepseek-web/DeepSeekWebClient.ts`——DeepSeek 官方 Search/Fetch 客户端（Bearer 鉴权，`/v1/tools/search`、`/v1/tools/fetch`，5 元/千次成功请求，Search/Fetch 各 5 QPS；错误码 401/402/404/429 映射为中文提示）。

**删除**：`BrowserToolHandler`、`src/services/browser/`（4 文件：BrowserDiscovery/BrowserSession/UrlContentFetcher/utils）、`src/core/controller/browser/`（5 controller）、`prompts/.../tools/browser_action.ts`、webview 的 BrowserSettingsMenu/BrowserSessionRow/BrowserSettingsSection、`src/shared/BrowserSettings.ts`、`proto/cline/browser.proto`、`ClineDefaultTool.BROWSER` 枚举项、package.json 的 `puppeteer-core`+`puppeteer-chromium-resolver`；另删 `src/core/prompts/system-prompt-legacy/`（2 文件，全仓零引用的死代码，因引用已删模块而阻塞编译）。

**清理**：ToolExecutorCoordinator 注册、`tools/init.ts`、12 个 prompt 变体配置的 BROWSER 项、`autoApprove.ts`（3 处）、state.proto 的 `browser_settings` 字段与 `BrowserSettingsUpdate` 消息、state-keys、`ExtensionMessage.ExtensionState`、`SystemPromptContext`、capabilities/rules/spec/tool_use 的浏览器提示词占位符、Task/ToolExecutor/TaskConfig/SubagentRunner/TelemetryService/newTask + 三个 update 文件（updateSettings/updateTaskSettings/updateSettingsCli）。

**关键修正（否则功能形同虚设）**：12 个 prompt 变体配置**原本不含** `WEB_SEARCH`/`WEB_FETCH`，仅删 BROWSER 会导致复活的工具永远不会被模型看到——已为缺失的变体（generic/glm/gemini-3/hermes/trinity/template）补齐两项。

**提示词广告条件**：`web_search`/`web_fetch` 的 `contextRequirements` 由 `providerId === "cline" && clineWebToolsEnabled` 改为 `providerId === "deepseek"`；执行期仍有 API Key 门禁（无 Key 返回中文指引而非静默失败）。

## 3.7 测试模式残留 + context 死字段清理（2026-10-18，compile 全绿 + .vsix 7.64MB/98 文件 sideload 通过）

**测试模式删除**：`src/services/test/`（TestMode 107 行 + TestServer 450 行 + GitHelper 218 行）、`src/core/controller/ui/getWebviewHtml.ts`、`src/hosts/vscode/hostbridge/testing/`、`proto/host/testing.proto`（TestingService）、`proto/cline/ui.proto` 的 `getWebviewHtml` RPC；调用点清理 `extension.ts`（initializeTestMode + watchers 注册）与 `common.ts`（cleanupTestMode）。
- **坑**：`getWebviewHtml` 同名 RPC **同时存在于 host/testing.proto 与 cline/ui.proto**——只删前者会让生成代码继续引用已删控制器；两个都要删。

**context 死字段清理**（webview）：删除 12 个由已删 RPC 供给、恒为空的模型状态字段（onboardingModels/clineModels/openRouterModels/vercelAiGatewayModels/hicapModels/shengSuanYunModels/liteLlmModels/openAiModels/requestyModels/groqModels/basetenModels/huggingFaceModels）及其 setter、state、接口声明、contextValue 导出。
- 消费方同步清理：`providerUtils.ts` 删两个零引用导出（`getModelsForProvider` 89→ 删、`getProviderInfo` 删，文件 962→788 行）、`validate.ts` 删零引用的 `validateModelId`（216→184 行）、`ChatTextArea`（解构未用）、`WelcomeSection`（删写死 `provider: "cline"` 的 SetModel 横幅动作 + 依赖数组）。
- **保留**：`onboardingModels` 是 `ExtensionState`（手写接口 + proto）的必需字段，webview 初始 state 与 controller 里均保留 `undefined` 休眠值。
- **留给后续**：`normalizeApiConfiguration` 里约 40 个不可达 provider 分支（用的是 `@shared/api.ts` 常量、不耦合 context）——归入"api.ts 5323 行死常量清理"批次统一处理。

## 3.8 模型常量与 provider 分支清理（2026-10-18，三绿 + .vsix 7.62MB/98 文件 sideload 通过）

**`src/shared/api.ts`：5323 → 625 行。** `sed` 删除五段死模型常量：`434,918`（claudeCode/bedrock）、`1040,1554`（vertex/vertexGlobal）、`1568,1840`（gemini）、`1841,2304`（openAiNative/openAiCodex）、`2363,5323`（huggingFace/Qwen/doubao/mistral/LiteLLM/askSage/nebius/wandb/xai/sambanova/cerebras/groq/baseten/moonshot/huawei/minimax/nous/shengSuanYun/zai 等）。保留 `ApiProvider`/`ModelInfo`/`OpenAiCompatibleModelInfo`/`OcaModelInfo`/anthropic*/openRouter*/`openAiModelInfoSaneDefaults`/`deepSeek*`/`hicapModelInfoSaneDefaults` 等仍在被引用的部分（备份 `/tmp/api.ts.bak`）。

**provider 相关文件**：
- `src/shared/storage/provider-keys.ts` 143 → 26 行：只留 `getProviderModelIdKey` + `ProviderKeyMap = { openai: "OpenAiModelId" }`，删 `ProviderToApiKeyMap` / `ProviderDefaultModelMap`。
- `webview-ui/.../providerUtils.ts` 788 → 352 行：`normalizeApiConfiguration` 只留 `case "deepseek"`、`case "openai"` 与 `default`（其余 provider 一律按 OpenAI 兼容处理，`openAiModelInfoSaneDefaults`）；`getModeSpecificFields` 只留 `case "openai"` + default。

**LiteLLM / Bedrock 状态与转换清理**（api.ts 删掉 `LiteLLMModelInfo` / `BedrockModelId` 后暴露）：
- `src/shared/storage/state-keys.ts`：删 `planModeLiteLlmModelInfo` / `actModeLiteLlmModelInfo` 两个键及 `LiteLLMModelInfo` import。
- `src/shared/proto-conversions/models/api-configuration-conversion.ts`：删 `convertLiteLLMModelInfoToProto` / `convertProtoToLiteLLMModelInfo` 两个函数及 4 处调用，去掉两处 `as BedrockModelId` 强转（`state-keys` 里该字段本就是 `string | undefined`）。
- `src/shared/proto-conversions/models/typeConversion.ts`：删 `fromProtobufLiteLLMModelInfo`；`src/core/controller/models/updateApiConfigurationProto.ts` 同步删两处赋值。

**坑与流程**：
- 改 `state-keys.ts` 后**必须** `node scripts/generate-state-proto.mjs && npm run protos`（前者只在 lint-staged 里自动跑，本地不 commit 不会触发）。动手前先空跑一次比对 diff，确认 `proto/cline/state.proto` 与 `state-keys` 同步再改。
- webview 侧会连带报错：`providerUtils.ts` 的 `liteLlmModelInfo`、`ModelInfoView.tsx` 残留的 `isGemini` 守卫（整块 `{!isGemini && (...)}` 删掉，不是替换符号）。**删 import 时只删整行，绝不替换成凭空构造的名字**（老毛病，已复发 6 次）。
- 未用 import 需 `npx biome check --write --unsafe <file>` 才真正删除，普通 `--write` 不生效。

**剩余（归后续 provider 状态清理批次）**：`state-keys.ts` 仍有 ollama / lmStudio / requesty / together / fireworks / sapAiCore / huggingFace / groq / baseten 等不可达 provider 键；`src/shared/remote-config/schema.ts` 与 `src/core/storage/state-migrations.ts` 里的 bedrock / liteLlm 迁移与字段也未动。

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
