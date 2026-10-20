# AGENTS.md — era-harness 工作区指令（L2 薄壳）

> 本文件是 **era-harness 工作区的 L2 薄壳，只写本仓特有规则**。
> 集群通用规范（仓库拓扑 / 默认技能 / ERB 死规矩 / 会话结束检查）在 **L1 正本**：
> `$EMUERA_WS/emuera/shared-trae/AGENTS.md`（本机相对路径 `../emuera/shared-trae/AGENTS.md`）与 `knowledge/meta/**` —— **开工前先读 L1**。
> 分层模型见 `../emuera/shared-trae/knowledge/meta/instruction-layering.md`。
> Trae 侧同构入口：`.trae/rules/project_rules.md`（junction → `shared-trae/workspaces/era-harness/rules/`，两份内容同构、互相指认）。
> 更具体的规则优先于更宽泛的规则；本文件不覆盖系统提示词或用户直接指令。

---

## 0. 本仓定位

- **角色**：eraTW / Emuera 脚本工程的本地 AI 开发助手，VS Code 扩展形态。fork 自 Cline Chinese v3.86.6 做**减法**改造，产品名 **era harness**。
- **分发边界**：只做本地 `.vsix` sideload 测试；⛔ `vsce publish`、⛔ 任何市场上线、⛔ 外联账号/遥测/远端配置（批次 2 已剥离）。
- **子包** `packages/era-harness-core`：纯 Node 核心库（日志解析／工程画像／编码读写判据／知识库／指令数据／MCP server），⛔ 不得 import vscode、**保持零运行时依赖**；构建期被 esbuild 内联进扩展产物，不进分发包。
- **完整改造史**（批次 1→5、每批执行记录与踩坑）＝仓根 [`SUBTRACTION-PLAN.md`](SUBTRACTION-PLAN.md)。判断「该不该有」永远优先于「怎么加」。
- 本仓工作区文档（计划／台账／日志）＝ `$EMUERA_WS/emuera/shared-trae/workspaces/era-harness/documents/`（经 `.trae/documents` 挂载）。

---

## 1. 减法改造纪律（判据在 `SUBTRACTION-PLAN.md`）

| # | 规则 | 实证来源 |
|---|------|---------|
| 1 | **批次闸门**：每批结束 `npm run compile` 必须绿才进下一批；删除按「目录级整删 + 孤立引用清理」两步走——先删文件，再按 tsc 报错逐个断链 | §0 总原则 |
| 2 | **命令/视图 ID 改名联动**：`src/registry.ts` 的 prefix 取自 package.json `name` ⇒ 改名必须联动 package.json 的 command / menu / keybinding / view id，外加 context key、config section、`~/.era-harness` 存储目录、redirect URI | §1 执行记录 |
| 3 | **Proxy 形态服务保留接口、替换实现**：`telemetryService` / `featureFlagsService` 是 `new Proxy({} as Service, …)` 形态、调用点 30+ ⇒ ⛔ 整目录删，改为 no-op provider | §2a |
| 4 | **工具增删必须过全部 12 个 prompt 变体配置**：变体不含某工具时只删枚举，会让工具**永远不被模型看到**；新增工具同样要补齐缺失变体 | §3.6 |
| 5 | **proto 变更要重生成**：动 `src/shared/proto` 必跑 `npm run protos`；改 `state-keys.ts` 必须先 `node scripts/generate-state-proto.mjs`（该脚本只在 lint-staged 里自动跑）。⚠️ 同名 RPC 可能**同时存在于两个 proto**（`getWebviewHtml` 曾同时挂在 `host/testing.proto` 与 `cline/ui.proto`），只删一个会让生成代码继续引用已删控制器 | §3.7 / §3.8 |
| 6 | **删 import 只删整行**，⛔ 替换成凭空构造的名字（已复发多次）；未用 import 需 `npx biome check --write --unsafe` 才真正删除，普通 `--write` 不生效 | §3.8 |
| 7 | **保留清单**（判「能不能删」的下界）：agent 循环、文件读写（编码安全封装）、终端、MCP 客户端、checkpoint / diff 审批、provider 配置（**仅 DeepSeek + 自定义 OpenAI 兼容**） | §0 |

---

## 2. 验收闸门（改完必跑，数字对不上就是回归）

| 命令 | 位置 | 期望 |
|---|---|---|
| `npm test` | `packages/era-harness-core` | 101 例＝100 过／**1 跳过**（`integration: real eratw project`，需 `ERA_PROJECT_PATH` 才跑＝正常，⛔ 当缺陷） |
| `npx tsc --noEmit` | `packages/era-harness-core` | 0 错 |
| `node test/update/run.mjs` | 仓根 | 209/209 |
| `npm run compile` | 仓根 | EXIT=0（重跑 protos＋biome＋esbuild） |

> 本机 shell 的 PATH 没有 node，且 `C:\Windows\System32\bash.exe` 是 WSL 存根会抢先解析 ⇒
> 每条命令前先 `export PATH="<node 所在目录>;D:\Program Files\Git\bin;$PATH"`。⛔ 把这个绝对路径写进仓内任何文件。
> protoc 走本地脚手架 `era-harness/tmp-protoc/bin/protoc.exe`（官方 v29.3 release，被 gitignore 排除）；
> `grpc-tools` 自带的是调试构建、缺调试运行时，⛔ 用。

---

## 3. 文件地图：改这里，还要同时改这里

| 动的地方 | 必须跟着动 |
|---|---|
| `src/knowledge/data/<新条目>.ts` | `data/index.ts`（import＋数组登记＋必要时 `KNOWLEDGE_SNAPSHOT_AT`）→ `test/knowledge.test.ts` 条目数期望 → `NOTICE-knowledge-sources.md` 来源行；要进提示层再加 `era_domain.ts` 的 `injectedKnowledgeIds`。**条目目录一律从 `KNOWLEDGE_ENTRIES` 现算**，⛔ 手写清单 |
| `src/core/update/` 任一闸门 | `plan.ts` 接线 → `describe.ts` 人话文案 → `test/update/*.spec`；新 `UpdateStage` 阶段要补 `src/hosts/vscode/updateGame.ts` 的 exhaustive switch（漏了编译直接报错，别绕过） |
| 新增扩展原生工具（`era_knowledge` 是样板） | 七处成套：`src/shared/tools.ts` 枚举＋`READ_ONLY_TOOLS`；`system-prompt/tools/<名>.ts` spec；`tools/index.ts` export；`tools/init.ts` spread；**12 个** `variants/*/config.ts` 放行；`task/tools/handlers/<驼峰>ToolHandler.ts`；`ToolExecutorCoordinator.ts` 注册。参数名若不在 `src/core/assistant-message/index.ts` 的 `toolParamNames` 里 ⇒ 加它（⛔ 复用泛化的 `id`） |
| 核心库任何导出 | `packages/era-harness-core/src/index.ts` barrel＋`npm test`＋根 `npm run compile` |
| 新增核心库**测试文件** | ⚠️ `package.json` 的 `test` 脚本是**显式文件清单不是 glob** ⇒ 不登记则用例根本不会被跑 |
| 写文件落盘形态（编码/BOM/行尾） | 判据在核心库 `src/encoding/write.ts`（纯函数，⛔ 不引 iconv-lite）；执行在 `src/integrations/editor/DiffViewProvider.ts#enforceWriteEncoding`；结论经 `saveChanges().encodingNote` → `WriteToFileToolHandler`，拼接在 `src/core/era/encoding-write.ts` |
| 改 `state-keys.ts` | 先 `node scripts/generate-state-proto.mjs`，再 `npm run protos`；提交前看 `proto/cline/state.proto` 是否被带进暂存区 |

---

## 4. 内嵌数据 NOTICE 纪律

- **两套内嵌数据许可不同，⛔ 混放**：`src/knowledge/`（代码 Apache-2.0；条目＝机制与纪律的**事实性提炼**）与 `src/reference/data/`（指令手册，上游 **CC BY-NC 4.0**，见 `NOTICE-emuera-sk-doc.md`）。
- 条目内容 ⛔ 复制游戏脚本正文、⛔ 带路径/行号的工程状态、⛔ 铁律短句里出现行号与绝对路径、⛔ 收某一工程的魔改现状现算值——那些留 shared-trae 正本，不随 vsix 分发。
- 正本先行：改知识先改 shared-trae `knowledge/<domain>/`，回来同步 `source.snapshotAt`；内嵌副本是**快照**。

---

## 5. 提交纪律与产品边界

- 两仓**分别提交**；commit 风格＝`type(scope): 中文一句话`＋要点式 body。
- husky＋lint-staged 会跑 `biome check --write --staged`，**它会改写你的文件** ⇒ 提交后复跑一次 `npm run compile` 确认仍绿。
- `git add` **用显式路径**，⛔ `git add -A`：shared-trae 里有别的窗口留下的脏文件。
- ⛔ 经 `.trae/knowledge`、`.trae/documents`、`.trae/rules` 链接「顺手改」共享文档——改正本走 shared-trae 本仓（git）。`.trae/` 本身被 gitignore。
- 落点三层分流：长期事实 → shared-trae `knowledge/<domain>/`；会过时的 → `workspaces/era-harness/documents/`；随 vsix 分发的产品内嵌 → 核心库 `src/knowledge/`。⛔ 在 era-harness 仓内另建知识库。
- ⛔ 硬编码集群路径（本机绝对路径不写进任何仓内文件，一律用 `$EMUERA_WS/<相对路径>` 或仓内相对路径）。

---

## 6. 本仓工程约定

- 源码 EOL＝**LF**（`.gitattributes` `* text=auto eol=lf`）；工作区文档（shared-trae 侧 `.md`）＝**无 BOM + CRLF**。
- `.trae/` 三个挂载（knowledge / documents / rules）都是 **Windows junction**（不是 symlink，`ln -s` 会静默变成空目录 ⇒ 用 `New-Item -ItemType Junction`）。
- 引擎 `Emuera.exe` 不可终端运行；本仓对游戏侧的验证靠日志解析与真实启动后的加载痕迹，不是靠跑测试。
