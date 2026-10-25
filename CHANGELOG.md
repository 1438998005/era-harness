# Changelog

本文件记录 era harness（Cline Chinese 减法改造版）的版本变更。
上游 Cline / Cline Chinese 的历史变更见其各自仓库。

## 3.91.12 — 2026-10-25

> 诊断/审计增强（Stage 2），对应 HANDOFF「诊断包不足清单」六项 + 新发现三项；与 3.91.11 的解析器修复配套，为下轮复测与第三方远程取证提供数据面。

### 改进

- **请求层审计事件（`api`）**：`retry`（挂在既有 onRetryAttempt 回调）、`error`（首 chunk 失败）/`stream_error`（中流失败）、`usage`（每请求 input/output/cacheRead/cacheWrite tokens + 费用）。此前重试与 HTTP 错误审计零痕迹——第三方用户失败循环在诊断包里只有 start/abort（08 #46 实测），截图里的费用与上下文用量也不存在。
- **解析修复遥测（`parse` 事件）**：`parseAssistantMessageV2` 增加可选统计出口，DSML/dots/孤儿归并/杂引号/task_progress 剥离的命中次数在每轮流结束时（仅非零）落一条 `repairs` 摘要。「模型干净」与「被修干净」从此可区分——MiMo 复测判据②的验收盲区（方言全靠容错消化、审计看不出）补上。
- **cacheHit 双写合并**：同一次 read_file 此前由 ToolExecutor 与 handler 各写一条审计（间隔 ~200ms，一条无 ms），统计双计。现在 handler 命中缓存时经 `taskState.readToolAuditMeta` 传递元数据，ToolExecutor 单点合并为一条带 `cacheHit`/`readCount` 的事件。
- **审计 provider/model 实况**：①ToolExecutor 改持 getter（Controller 切 provider 时直接替换 `task.api`，构造期捕获的旧引用会拼出 `provider=free + model=旧模型` 的嵌合记录，08 #46 实锤）；②请求时快照 `lastRequestProviderInfo`，abort 事件优先取「当时实际服务的 provider/model」，不再受事后切换设置影响；③新增 `task/resume` 事件（任务重建后 turn 归零从此有边界解释）。
- **设置摘要补生效 baseUrl**：deepSeek（内置固定）、MiMo（按密钥前缀推导，只出 URL）、free 池说明（忽略自定义模型 id 与 baseUrl）。方言表现强依赖请求路径，单一 openAiBaseUrl 分不清 DS 官方与第三方端点。
- **导出增强**：update 事件折叠（超 500 条窗口时保留最近 10 条、其余折成一行机器可读摘要，不再挤占 tool/api/parse 额度）；每条审计补 ISO 时间戳（epoch ms 无法与 UI 时间对账）。

### 验证

- `test:update` 422/422（新增 6 例：api/parse 白名单、snapshot 擦洗与 cap、update 折叠三态、ISO 同源、dialect-guard 判定正反例）；`test:free` 26/26；`test:toolcall` 56/56；双侧 typecheck 绿

## 3.91.11 — 2026-10-25

> 本轮修复出自 v3.91.10 三模型同题复测（08 #43 判据①残留）与第三方用户 river.ai 端点卡死反馈（08 #46）；根因与逐字取证见知识库 12 §12.26、08 #45/#46。

### 修复

- **DSML 分隔符单竖线变体（第三方卡死根治）**。第三方用户在 river.ai 端点（provider「openai」+ deepseek-ai/DeepSeek-V4.1-Flash-1017）上 DSML 控制 token 以**单竖线** `<｜DSML｜` 泄漏成正文，解析器只认双竖线 `[｜|]{2}` → 整块落正文、零工具执行、原样重试循环烧钱（同一调用块重复 6 次，任务卡死）。分隔符放宽为 1-3 根、全角/ASCII 混排同色处理；display-clean 补单竖线半截标签的尾部裁剪（`<｜DS` 不再渲染成正文）。注：所谓「切到免费 provider 后正常」实为审计假象——free 渠道是硬编码模型池（无 DeepSeek 候选），用户实际是换到池内 Qwen 才正常；审计 provider/model 嵌合（旧 handler 引用 + 实时设置拼接）的修正随后续版本跟进。
- **DS 链式闭标签归并（A 族）**。v3.91.10 复测残留主形态：参数闭标签内嵌下一参数 opener（`</｜｜DSML｜｜ parameter name="regex" string="true">下一参数值`，且 task_progress 伪参数连属性引号都不闭合），旧正则不认带属性的闭标签 → path/regex 被吞进前一参数值 → 缺参红字/Invalid path/污染值静默执行。现在链式闭标签按「关当前参数 + 开下一参数」归并，未知参数名只关不开（残值丢弃不污染）；补裸闭标签 `</｜｜DSML｜｜>`（无 keyword，常连发两个）按「先参数后工具」消歧；散落的裸分隔符在无上下文时清理。
- **孤儿 XML 混合体还原（B 族）**。`<path>ERB</parameter>` 用通用闭标签收口、后续参数用 `<parameter name="regex">` 开标签（无任何方言包裹），旧激活门要求包裹证据故不修。激活条件放宽为「消息含 parameter 标签语法」，防腐蚀由新加的 **content/diff/command 值保护区**承担——保护区参数值内的 `<parameter name="X">` 文档示例一律原样保留（这正是 2026-10-24 收紧激活门时担心的场景，现在两头都顾住了）。
- **污染值不得静默执行（修复目标升级）**。解析器防线之外新增执行前守卫（`dialect-guard.ts`）：定位类参数（path/regex/file_pattern/url/query 等）含 DSML 分隔符或方言标签语法时拒绝执行、报错指名污染参数并计一次 mistake。实弹依据：msg9 的 file_pattern 带 DSML 残片仍 outcome ok，rg 得 "Found 0 results" 被模型误信——静默污染比红字危险。审计新增 `snapshot` 字段（仅报错调用携带，≤1000 字符、排除 content/diff/command、过密钥擦洗），诊断包从此能看到残片完整形状。
- **未知方言循环熔断**。未知变体整块落正文 → 零工具执行 → 模型对 noToolsUsed 反馈原样重发无限烧钱。现在无工具正文的方言签名（`invoke name="已知工具"` / DSML 分隔符，结构判据）连续同文时计入既有 mistake 熔断，3 轮弹 mistake_limit 打断；不注入提示词，首见轮留自纠机会。
- **search_files 失败归因修复**。rg 失败（regex 非法等）被一律误报为 "the path may not exist"——模型被误导反复修 path 自纠失败（turn 6/19 实弹）。现在按目标目录的 fs 存在性归因：目录确实缺失保留原文案；路径存在时指认 ripgrep 失败并附首行错误与 regex 自查提示。

### 改进

- **孤儿工具闭标签不再落聊天区**。模型补发上一工具的迟到闭标签（`</era_symbols>`，本轮实弹 3 次）整段落成独立文本块反复出现在聊天区；整块恰为已知工具闭标签的文本不再渲染，DSML 标签形态残片同步清理（解析层与 api 历史保持原样，仅展示净化）。

### 验证

- `test:toolcall` 56/56（新增 15 例：A 族链式闭标签×3、混用形态、B 族孤儿混合体×2、单竖线/ASCII 混排、content 保护区防腐蚀、孤儿 parameter、裸分隔符、分块流式×2、display-clean×2）；`test:update` 416/416；`test:free` 26/26；双侧 typecheck 绿
- 真实任务回放：`tasks/1792900662485`（DS 33 轮）此前 6 个污染轮（turn 4/5/6/19/21/22）全部完整还原为可执行工具

## 3.91.10 — 2026-10-25

> 本轮全部修复出自 v3.91.9 三模型同题实弹复测（deepseek-flash / mimo-v2.6-flash / Qwen3.8-27B）暴露的四族问题；根因诊断与证据原文见知识库 12 §12.25、08 #42 回填。

### 修复

- **流式截断态解析三修（deepseek 起手缺参 + EINVAL 根治）**。真实任务取证推翻了两个旧假设：①EINVAL `mkdir '...py<'` 不是模型输出畸形——模型原文标签完整（content 在前 path 在后），是**流式预览路径绕过了路径守卫**：partial 参数值在流尾停在闭合标签中间时（`_tmp_search6.py</path` 而 `>` 未到），解析器终值化把半截闭标签吞进 path 值，`handlePartialBlock` 拿脏路径去 `diffViewProvider.open()` 直接 EINVAL，`execute()` 的 `[<>]` 守卫根本没机会跑。修复：解析器终值化只剥「当前参数闭标签的严格前缀」残片；`handlePartialBlock` 补同款守卫（partial 含尖括号静默跳过预览，暂态不报错）。②DSML 混血形态重复闭标签（`</execute_command>` 先到、DSML `</invoke>` 又还原一个）：DSML 归一器现在对普通工具闭标签清空 `openTool` 记账，避免二次还原；同时**不对普通闭标签做重复删除**——早闭合孤儿形态的第二个 `</write_to_file>` 是模型自我纠正的真实闭标签，删了会废掉孤儿归并。
- **早闭合孤儿参数归并**。DS 把参数闭标签写成 DSML token（`</｜｜DSML｜｜ parameter>`）后提前收口 write_to_file、把 `<path>/<content>` 裸写在工具块外再补第二个闭标签——参数留在孤儿区，报 missing required parameter 反复重试。现在「同一工具闭标签出现两次 + 中间是纯参数对序列 + 孤儿区带来首块缺失的参数」三个条件齐备时删第一个闭标签归并；两次独立的正常调用、三次自我重试混正文的真实 msg1 都不触发（防误并测试在案）。**纯度判定用状态机逐对扫描而非单正则**——实测回溯会让惰性 `[\s\S]*?` 跨过第一个 `</path>` 吞掉正文直到远处另一个 `</path>`，纯度判定被击穿导致误归并。
- **MiMo 方言流式泄漏根治（展示层）**。`<tool_call><function=search` 泄漏不是解析失败——解析全程正确、工具全执行了——是流式截断点把半截方言标记渲染成了 say:text，且文本块随后变成工具块时已落盘的 partial 消息无人回收。展示净化抽成纯函数 `display-clean.ts`：补齐完整方言包裹残片清理（`<tool_call>`/`<function=名>`）+ 尾部不完整标签裁剪兼容 `=` 形态（旧正则只认纯字母标签名）；partial 正文净化后为空则跳过 say（从源头杜绝，不做事后撤回）。thinking/function_calls 等既有清理行为不变。
- **Standalone 命令执行乱码两修**。实弹证据显示 python 仍按 GBK 输出——任务走的是 backgroundExec（Standalone）路径，v3.91.9 的 PYTHONUTF8=1 只注入了 VS Code 终端路径。①Standalone spawn env 补注入 `PYTHONUTF8=1`；②输出解码改逐 chunk **UTF-8 严格解码失败回退 GBK**：cmd.exe 自身的本地化报错（「不是内部或外部命令」）恒按控制台代码页写 stderr，这是 PYTHONUTF8 射程外的第二乱码源，实测回退解码后该报错完整可读；末尾可能截断的多字节序列留待下一 chunk 拼合，混合编码输出按 chunk 各取所长。

### 改进

- **search_files 双编码搜索（拆除 DS 自写 python 脚本的最后依据）**。eraTW 工程有无 BOM 的 CP932 文件，ripgrep 默认按 UTF-8 搜不到 CJK——DS 第 1 轮推理原话「CP932 文件读不出」正是它放弃内置搜索的直接依据（v3.91.9 修的行号不是本轮主因，归因改判见知识库 12）。默认遍之后追加 `--encoding shift-jis` 第二遍合并；默认遍已命中的文件不采纳第二遍结果（防 UTF-8 文件转码假阳性）。`mergeEncodingPasses` 纯函数 + 真实 rg 的 CP932/UTF-8 混合 fixture 集成测试锁定。read_file / search_files 工具描述同步声明已实现的编码能力（read_file 本就支持 BOM/UTF-16/CP932 自动解码），让「编码顾虑」失去事实基础。
- **read_file 读目录给可读提示**。模型把游戏根目录当文件读取时（本轮实弹出现 1 次），原样会抛 EISDIR 天书；现在批准流程之前拦截并提示改用 list_files / era_symbols / search_files。

### 验证

- `test:toolcall` 41/41（新增 13 例：DS 混血形态×2、MiMo 官方模板×3、孤儿归并正反例×3、msg1 全文形态、content-before-path 整段、分块流式回放×4、display-clean 单测×3）；`test:ripgrep` 11/11（新增 3 例）；`test:update` 416/416；`test:free` 26/26；双侧 typecheck 绿；esbuild --production 重打包
- 新增**分块流式回放测试基建**（`test/toolcall/stream.spec.ts`）：单发用例捕不到流式态 bug——EINVAL 脏 path 与 MiMo 泄漏残片都只存在于 chunk 截断态；现按危险边界切片、逐累积步断言解析结果与展示净化结果

## 3.91.9 — 2026-10-24

### 修复

- **search_files 匹配行带行号（根治「模型自写 python 脚本取行号」的螺旋）**。同题实弹取证（三模型对比）实锤：匹配行无行号是模型绕开工具自建 `python -c` 流水线的第一诱因（deepseek 单 4 次命令、Qwen 单 5 版临时脚本全为此）。输出从 `│原文` 改为 `│{行号} | {原文}`（对齐 read_file 的 `N | text` 风格），上下文行保持裸文本。顺带三处截断治理：ripgrep 行数上限按 8 行/结果估算（`--json` + `--context 2` 下每结果约 7 行，旧按 5 行估算会在 ~350 结果处提前掐断）；行数上限截断尾部可见（不再静默）；字节超限提示改为预算预扣——旧实现只在「恰好装得下」时追加，紧贴上限时提示本身被静默丢弃。纯函数抽到 `ripgrep/format.ts`，新增 `test:ripgrep` 8 例。上游 cline#8659 / #14747 未修（主动分叉）；cline#13771 报的「每文件只留 1 条匹配」经核对不存在于本实现。
- **Windows 终端 python 输出乱码根治**。python 在 Windows 管道下 stdout 默认按 cp936 编码，而宿主按 UTF-8 解读——含中日文的命令输出变成 `EXTRA??????ݮ` 式乱码（纯 ASCII 行不乱，故「同一份输出有乱有不乱」），实测反复诱导模型误判文件编码、加参数重跑命令。终端创建时 env 注入 `PYTHONUTF8=1`（等效模型侧摸索出的 `-X utf8` / `sys.stdout.reconfigure` 修法，对 POSIX 无副作用）。上游 cline#10378 未修。
- **task_progress 清单复读止血**。实测 deepseek-flash 32 轮复读同一份清单 60 次（独立任务 42 轮 74 次）、输出 31.6k token（¥0.21）；MiMo 0 次复读同样答对（2.2k / ¥0.04）。提示词明确：仅清单实际变化（新增/完成/改写/重排）时携带 task_progress 参数，无变化时完全省略、禁止复读同一清单。

### 已知问题（取证在案，裁定缓修）

- 命令输出双份计入 api 历史：工具结果（`Output:\n...`）与下一条请求的 environment_details（`### New Output`）各带一份；`getUnretrievedOutput` 的 `lastRetrievedIndex` 在完成事件后的迟到块不推进所致。每命令一次性重复、其后进 prompt cache，量级几百 token；执行链核心路径 + 双路径时序变体，风险大于收益（上游 cline#5176 未修）。详见知识库 12 §12.24.4 / 21。

### 验证

- `test:ripgrep` 8/8（新增）；`test:toolcall` 25/25；`test:update` 416/416；`test:free` 26/26；`test:deepseek` 4/4；双侧 typecheck 绿；核心库 130 测试绿；esbuild --production 重打包
- v3.91.8 实弹复测（同题三模型，`08` #38–41）：两个 deepseek 会话（32/42 轮）原始方言 token 泄漏 **0**（修复前基准 16/58 = 27.6%，#38 销项）；MiMo 全程无假工具调用（#39 部分正面）；#40 根因改判（无行号而非上下文不足）；#41 未触发待测

## 3.91.8 — 2026-10-24

### 修复

- **DeepSeek V4 官方直连的「工具调用泄漏 + 输出畸形」根因修复（移植上游 cline PR #11392，修 cline#11339）**。旧实现把「响应流思考行为」与「R1 历史思考回放」绑在同一个判定上，V4 系（deepseek-flash / deepseek-v4*）也被套上 R1 回放——上游已实锤这会把 V4 的输出带歪（原生 DSML 工具标记泄漏进正文、输出不可解析）。现拆成两个独立判定（`shared/deepseek-request.ts`，`test:deepseek` 锁定）：V4 保留思考流（温度/reasoning_effort/reasoning_content）但不再回放历史思考；同一 delta 内 reasoning 先于 text 产出。旧 `deepseek-reasoner` 行为不变；MiMo 路径不受影响（官方硬性要求回传）。
- **MiMo 官方训练模板方言完整支持**。小米官方模板的工具调用格式是 `<tool_call><function=名><parameter=参数>值</parameter></function></tool_call>`（等号、无引号）——此前解析器只认 `<parameter name="X">`，模型一旦输出「母语」参数会整体丢失。现归一器接受 `<parameter=X>` 等号形式与 `</function>` 收工具口，成对 `</tool_call>` 闭包裹一并清理。同时**收紧激活条件**为方言包裹证据（`<tool_call>`/`<function=`/dots 包裹），无包裹正文里的合法 `<parameter name="...">` 文件内容不再被误改（新增防腐蚀回归）。
- **路径守卫扩展到全部文件类工具**。方言残片混入路径（如 `_tmp_scan.py</path`）此前只在 write_to_file 有防线，EINVAL 天书会从其他工具冒出；read_file / search_files / list_files / apply_patch 现统一拦截含 `<`/`>` 的路径并返回可读错误（apply_patch 只查 patch 头部的文件路径，正文合法尖括号不受影响）。
- **熔断「仍然继续」真正有效**。循环检测升级触发的熔断，此前点「继续」只重置计数——模型原样重犯、再升级、再熔断（实测评测任务死循环）。现「继续」且未附文字时向下一轮注入换策略提示（明示必须换工具/换目标/换拆解）；附文字反馈的路径不变。

### 改进

- **search_files 上下文 1 → 2 行（对齐上游 cline#13384）**。此前实际只带 1 行上下文（注释一直写着 2），实测是模型抱怨「上下文不够」转而自写临时 py 脚本检索的诱因之一。
- **审计 taskId 口径统一**。ReadFileToolHandler / GlobalMemoryToolHandler 共 5 处审计此前用 ULID，与其余路径的数字 taskId 分裂，导致诊断包按任务聚合时记录错分；现全仓统一为数字 taskId。

### 验证

- `test:deepseek` 4/4（新增）；`test:toolcall` 25/25（新增 3 例：MiMo 官方模板等号形式、无包裹 `<parameter>` 正文原样保留、无包裹孤儿 `</invoke>` 原样保留）；`test:update` 416/416；`test:free` 26/26；双侧 typecheck 绿；esbuild --production 重打包
- 双真实故障任务 replay 无回退：MiMo 方言任务 8/8 回合还原为可执行工具；DeepSeek 任务 58 回合照旧解析

## 3.91.7 — 2026-10-24

### 新增

- **免费池隐私开关「仅使用不收集信息的模型」**。设置 → API 配置 → 免费模型卡片新增复选框：勾选后路由链先于 listing 门控剔除所有收集提示词的渠道（当前即 Kilo「明文收集」），仅剩 OVHcloud（欧盟托管、零数据保留、不用于训练）；开启时连 Kilo 清单拉取也一并跳过（省一次网络请求），表格中被排除渠道行降透明度并挂「已排除」徽标。贯通链与 OVH Key 同构：state-keys → proto（Settings 192 / ApiConfiguration 90）→ 转换 → handler → 链组装；候选全空时报错文案区分「隐私开关导致」与普通失败。注意：开启后仅剩 OVH 匿名约 2 次/分钟，可用模型减少、更易触发限流。

### 池维护

- **移除已死的免费候选（17 → 15 项）**。执行前实拉 Kilo listing（402 行）实证：`Inkling Small` 免费版 2026-10-23 终止（仅存付费行 $0.45/$1.00）；`Ling 3.0 Flash Sante` 彻底下线（kilo.ai 模型页 404 / listing 无行 / 镜像全无）。池内其余 5 个 Kilo 候选全部健在。基础版 `ling-3.0-flash` 在 listing 为付费行（kilo.ai 官网页虽标免费，但 `:free` 变体不在 API 清单）→ 补位不成立（收录即路由到付费模型），不补。vision 链首选顺延 Dots3-Note；`listingMatch` 机制随唯一使用者消亡休眠保留。
- **核查留档**：OVH 的 Mistral-7B-Instruct-v0.3 已于 2026-10-01 移除（官方 lifecycle：07-02 公告 / 10-01 移除，实拉 `/v1/models` 22 项无此 ID）——该模型从未入池，无物可移；池内 Mistral Small 3.2 / Mistral Nemo 已被 OVH 列入退役表（2026-11-04 移除），宽限期内仍可调用，届时须复检移除。

### 验证

- `test:free` 26/26（新增 3 例：隐私开关链组装剔除 / 带图仅剩 Qwen2.5-VL / handler 不拉 listing 且 Kilo 零调用）；`test:toolcall` 18/18；`test:update` 416/416
- 双侧 typecheck 绿；`esbuild --production` 与 webview 构建重打包；bundle 校验：死模型 ID 0 命中、开关字段（host 侧）与 UI 文案（webview 侧）均在

## 3.91.6 — 2026-10-24

### 修复

- **撤销更新后，更新状态文件跟着回滚（此前会让插件从此误报「已经是最新的了」）**。更新成功时 `.era-harness/update-state.json` 已被写成新快照，而撤销只还原游戏文件、不还原状态 → 下次更新把所有旧文件判成「用户改过」并返回 up-to-date——游戏实际停在旧版本，插件还说没问题。备份目录里其实一直躺着 `state-before.json`（设计如此），是生产路径漏了这步。现在撤销时读回状态；更新前没有状态（首次更新）则删掉状态文件；老备份没有该文件时保持原行为。
- **更新中途失败且回滚没跑干净时，不再谎报「什么都没变」**。原实现无条件宣称已恢复原状，即使回滚途中有的文件还原失败（被杀毒/游戏占用）。现在 `rolledBack` 如实反映回滚结果；有残留时明说「有些文件可能停在更新到一半的状态，需要手动处理」，并给出备份目录。
- **用户确认的计划 ≠ 实际执行的计划**。确认之后要重新联网取最新、重新扫盘、重建计划，中间还可能隔着一整段对话式合并——期间社区推了新版本，写盘集合就会和确认过的不同，而原来的 `confirm: () => true` 把安全闸门短路了。现在新增 `planFingerprint()`（纯函数）对两份计划做指纹比对：一致直接放行；漂移就把新清单再弹一次，用户重新拍板。
- **写后校验的结果不再被丢弃**。更新完会对全部写入文件做 sha1 复核，但结果从不展示——磁盘内容不符也照常报「更新完成」。现在校验没过就点名文件（最多列 5 个）、建议重跑更新。
- **项目画像不再把 CP932 文件读成乱码**。画像的全部文本读取（emuera.config / lazyloading.cfg / DIM.ERH / 全部 CSV/ALS）此前裸用 `readFile(utf8)`：CP932 解成 U+FFFD、BOM 留在首字段（首条 CSV 的 id 直接解析失败）——而核心库自己的编码安全通道 `readTextFile` 正是为这两种情况写的。现全部改走该通道。
- **编码采样不再在第 1024 字节硬切**。采样点几乎必然切在日文多字节字符中间，让无 BOM 的合法 UTF-8 文件被误判成 CP932（统计失真还误导写回决策）。现在截断点退到整行边界（与 `readTextFile` 同策略），且不再为看 1KB 把整个大文件读进内存。

### 验证

- `test:update` 416/416（新增 14 例：状态回滚 3、诚实回滚 2、计划指纹 6、文案 3；`plan-drift.spec.ts` 已注册进 `run.mjs`）
- 核心库 `test` 130/130（新增 4 例：CP932 解码、BOM 剥离、采样边界、超长单行）；`test:free` 24/24
- 双侧 typecheck 绿；`esbuild --production` 重打包；biome 无问题
- 未修复的中低危问题（15 条，含 `src/core/update/http.ts` 零测试盲区）已带 file:line 证据落盘到工作区知识库 `21-已知问题清单.md`，按 P1/P2/P3 排序待销项

## 3.91.5 — 2026-10-23

### 改进

- **ERB 编辑的 SEARCH 匹配规则写进了领域提示**。`replace_in_file` 是通用工具，提示词只说「逐个字符匹配，包括空白、缩进、行结尾」，没说过三件模型反复踩的事：
  - **缩进是制表符时，重复 N 次也是重复 N+1 次那行的子串** —— 只给「缩进＋正文」当 SEARCH，会误命中相邻缩进级别的行。实测里是靠断言 count 从 1 跳到 3 才发现的。
  - **同一句台词在剧情分支里常出现多次**（复制粘贴的剧情）。按「命中几次就放行」处理会误伤后续分支；正确做法是按出现顺序逐块改。
  - **「顺手统一格式」是破坏性操作**：给 `CALL` 补右括号、给地文行补「」、批量把半角标点换成全角（Emuera 词法器只认半角，会连代码位的逗号/括号/取反一起吃掉）、在改写处新造顿号 —— 这几件事在真实校对里都造成过返工。
  - 这四条来自集群知识库 `erabasic/erb-text-edit-pitfalls.md` 的实证（K42 / K67 / K72 / K139 轮次），已摘进 `era_domain.ts` 的「编辑铁律」，**只在探测到 Emuera 工程时渲染**，普通项目完全不受影响。
  - 为什么不写进 `replace_in_file` 的提示词：那是所有项目共用的工具描述，塞 ERB 规则会污染写 JS/Python 的项目。

### 验证

- `test/update` 402/402（新增 5 例：`era-domain-prompt.spec.ts`）
- 变异检验：① 把 `\\t` 改回 `\t`（模板字符串里会变成真制表符）→ 红；② 删掉「不给 CALL 补右括号」→ 红
- tsc 0 错；biome 无问题

## 3.91.4 — 2026-10-23

### 修复

- **MiMo 一次同步回来 7 个模型，其中 4 个根本不能聊天**。`/v1/models` 回的是「这把密钥能访问的全部模型」，小米按用途分成三类：语言模型 3 个（`mimo-v2.6-flash` / `-pro` / `-pro-ultraspeed`）、ASR 1 个（`mimo-v2.5-asr`，¥0.5/小时音频）、TTS 3 个（`mimo-v2.5-tts` / `-tts-voiceclone` / `-tts-voicedesign`，限时免费）。语音模型走 `/audio/*`，选进聊天必然报错。
  - `/v1/models` **只回 id、不返回任何类型字段**，所以只能用 id 里的 `asr` / `tts` **段**判断（前后必须是 `-` 或边界，不是子串匹配——否则将来叫 `xxx-ttsx` 的新模型会被误藏）。判据收成 `isChatCapableModelId()`。
  - 卡片文案改成「已从 MiMo 同步 3 个对话模型（另有 4 个语音模型不在此列）」。**不静默藏**：用户在控制台明明看到 7 个，下拉里只剩 3 个却没人解释，比列出来更让人困惑。
- **点「打开诊断目录」弹出「打开外部程序时出错 / Failed to open: 系统找不到指定的文件。(0x2)」**。命令确实执行了（`[runCommand] era-harness.openDiagnosticsFolder` 在日志里），目录也确实建好了（`<globalStorage>/diagnostics` 里有 audit 文件），失败在最后一步 `vscode.env.openExternal(vscode.Uri.file(dir))`。
  - **实测证据**：同一路径 `explorer.exe <dir>`、`cmd start "" <dir>` 都能正常打开；目录存在且有内容。所以不是路径问题，是 VS Code 打开**目录**时底层 ShellExecute 拿到了 0x2（该用户目录是 `C:\Users\周远航`，含中文，怀疑是原生层传路径丢了编码）。
  - **真正让这个 bug 变难查的是我们自己**：`openExternal` 失败时**不抛错、只 `resolve(false)`**，老代码 `await` 完就当成功了，既没打开、也没有任何我们自己的提示，用户只看到 VS Code 弹的裸错误框。
  - **修法**：Windows 上直接起 `explorer.exe`（路径由 Node 以 UTF-16 传给 CreateProcess，不经过 VS Code 的 opener）；起不来才退回 `openExternal`，并**检查它的返回值**；两条都失败就把路径显示出来、给一个「复制路径」。判定收在 `open-in-os.ts` 的 `openFolderInOs()`，只写一份。
  - 只看 `spawn` 事件、**不看退出码**：explorer.exe 即使成功也常返回 1。

### 验证

- `test/update` 397/397（新增 8 例：1 例覆盖那 7 个真实模型 id 的对话/语音判定，7 例覆盖打开目录的各条分支）
- 变异检验：① 判定恒为 `true` → 红；② 去掉 `asr|tts` 段边界 → 红；③ 把 `openExternal` 的 `false` 当成功 → 2 例红；④ 去掉 Windows 走 explorer 的分支 → 红

## 3.91.3 — 2026-10-23

### 修复

- **MiMo 请求同时带 `api-key` 与 `Authorization: Bearer`**。官方文档自相矛盾：curl 示例用 `--header "api-key: $MIMO_API_KEY"`，Python SDK 示例用 `api_key=`（SDK 只会发 `Authorization: Bearer`）。实测**无法区分**——无效 key 在「无头 / Bearer / api-key / 两者都给」四种情况下返回的错误体逐字相同，所以拿不到「服务端认哪个头」的证据。两个都带上：认哪个都能过，多一个头不会导致失败。
  > ⚠️ **仍未证实用户那把 key 本身是否有效**。判断方法见下方「如何自查密钥」。
- **聊天错误块渲染成 `[MIMO] 401401 Invalid API Key`**。`ErrorRow` 把 `code` 和 `message` 直接拼在一起，而服务端回的 `code` 就是 `"401"`、`message` 自己也以 `401` 开头。新增 `isDuplicateErrorCode(status, code)`，只比结构化字段（不读文案），重复时不显示 code。
- **设置页把 401 说成「接口返回了 0 个模型」**。`refreshOpenAiModels` 原来把所有异常 `catch` 成 `values: []`，调用方只能看到空列表——于是 401、断网、账号下真没模型三者长得一模一样。现在抛出真实原因（`formatModelListError` 只读 HTTP status / axios code / 服务端 message），卡片上直接显示 `同步失败原因：401 Invalid API Key`。

### 如何自查密钥（不依赖插件）

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "api-key: sk-你的密钥" \
  -H "Content-Type: application/json" \
  -d '{"model":"mimo-v2.6-flash","messages":[{"role":"user","content":"hi"}],"max_completion_tokens":8}' \
  https://api.xiaomimimo.com/v1/chat/completions
```

返回 `200` = 密钥有效（那就是插件的问题，请把日志给我）；返回 `401` = 密钥被服务端拒绝（与插件无关，去控制台确认密钥是否启用/是否属于 Token Plan）。

## 3.91.2 — 2026-10-23

### 修复

- **底部「切换模型来源」菜单里没有小米 MiMo**。菜单的条目是硬编码的 `free / deepseek / openai` 三项，MiMo 加进来时只接了设置页，没接这里。现在补上，排在 DeepSeek 之后（付费区）。
- **点 DeepSeek 会「切到小米」——其实是切了 provider 但没换模型 id**。快速切换只写 `planModeApiProvider / actModeApiProvider`，把上一家的模型 id 原样留在原地；设置页那套「只纠正明显属于别家清单的 id」的判据（`shouldResetModelForProvider`）根本没被调用。
  - **实测后果**（`task_metadata.json` + `ui_messages.json` 硬证据）：`provider=deepseek` + `model=mimo-v2.6-pro` → 请求打到 **DeepSeek 官方**，回 `402 Insufficient Balance`；再切回 MiMo 后又一路 `401`。
  - **修法**：判据收成 `modelIdToWriteOnProviderSwitch(provider, currentModelId)` 放进 `@shared/api`，设置页与快速切换**调同一个函数**，且 provider 与 modelId 同批原子写入。这是本项目第 5 次栽在「同一判据写了两份，只改了一份」上。
  - **再加一道闸**：`createHandlerForProvider` 在发请求前用同一函数再校验一次，命中就在日志里写明「模型 id 属于别家，本次改用默认档」。UI 哪条路径再漏改，也不会把 A 家的模型名发到 B 家的端点。
- **密钥首尾空白统一吃掉**。粘贴时很容易带进空格，`Bearer sk-xxx ` 会被服务端当成另一把 key（401）。在 `buildApiHandler` 入口处对 DeepSeek / MiMo / OpenAI 兼容三家的 key 统一 `trim()`。MiMo 的基址还由密钥前缀（`sk-` / `tp-` / `ttp-`）决定，空白会让前缀判定和请求头一起错。
  - 注：**没有证据表明这就是本次 401 的原因**，属于防御性收口；真实原因待用户核对密钥后确认。
- **MiMo 设置卡片不再静默吞掉同步失败**。以前 `catch {}` 之后只显示「同步失败，暂用内置清单」，用户分不清是断网还是密钥被拒。现在把真实原因打出来，并在 401 时给出可操作提示（确认复制完整、末尾无空格；Token Plan 密钥需已订阅套餐）。

### 说明

本版同时充当**更新靶子**：3.91.1 的新更新器（进度条 / 三档超时 / 可选镜像）是装上去之后才开始工作的，`releases/latest` 若仍停在 3.91.1，它一次都跑不起来。发 3.91.2 才能让它第一次真正执行，顺带验证 `withProgress` 进度条位置、`installExtension` 的 90 秒 race、取消能否掐断 undici reader、以及三个下载按钮的返回值映射。

## 3.91.1 — 2026-10-22

### 修复

- **点「下载并安装」像没反应 —— 其实是真的失败了**。三条实测证据：装完仍是 3.90.0；`globalStorage/.../updates/` 目录建了但**是空的**；Release 资产实测只有 **≈34 KB/s**（7.6 MB 要约 4 分钟）。四个叠加原因：
  1. 下载**零进度上报**，4 分钟里屏幕上什么都不变；
  2. 失败只弹**非模态 toast**，且弹在进度条还开着的时候（通知区只剩最后一条）；
  3. `checkInFlight` 把「检查」和「下载安装」罩在**同一把锁**里，下载挂住时它一直是 `true`，再点只回一句「正在检查更新，请稍候」；
  4. 下载 `fetch` **没有任何超时**，卡住就永远卡住。
- **下载现在有可视化进度**：右下角通知进度条，文案形如 `下载中 42% · 3.2/7.6 MB · 812 KB/s · 约剩 1 分`（整数百分比或 ≥200ms 才上报，速率 500ms 采样 + EMA 平滑），**可随时点「取消」**。分阶段：连接 → 下载 0–90% → 校验 90–94% → 安装 94–100%。
- **两把锁拆开**：`checkInFlight` 只罩「查 API」，新增 `installInFlight` 罩下载安装。下载中再点「检查更新」会明确回一句「正在下载 vX，进度在右下角」，不再假装在检查。
- **所有弹窗移到进度条之外**：检查用的进度条先退出，再弹「发现新版本」；下载失败的错误框也在进度条关闭后才弹，不会被压住。
- **三档超时**：首字节 15 秒 / 停滞 30 秒 / 总计 10 分钟；检查 GitHub API 也加了 20 秒超时（超时会放锁，不会一直转圈）。取消或超时一律删掉 `.part`，当前版本不动。
- **流式落盘**：`fs.open(.part)` + 逐块 `write`（背压显式、内存恒定），边下边算 sha256；第一块就验 ZIP 头，GitHub 回 HTML 错误页时立刻失败，不白下 8 MB；全部校验通过才 `rename` 成正式名，`.part` 绝不交给安装器。
- **设置页按钮不再假死**：`检查更新` 加了 loading 态（「已发起…」+ disabled）。第二步（下载安装）在扩展侧已脱离命令链，gRPC 立刻返回。

### 新增

- **「用镜像下载」是可选项，不是自动行为**：发现新版本的通知现在给 `[直接下载] [用镜像下载] [复制下载链接]`。
  - **直接下载**只走 GitHub 官方地址，永不改道；**没有任何按速度自动切镜像的代码**。
  - **用镜像下载**只在「配了前缀 **且** 资产带 sha256」时出现；点了才走镜像，且字节必须通过 sha256 校验才落盘。镜像只负责传输，域名白名单（`TRUSTED_RELEASE_PREFIX`）一个字都没放宽。
  - 镜像失败**不在镜像之间重试**，直接回官方源并在进度文案里写明「镜像不可用，改走直连…」；**摘要不匹配不自动回退**（那属于安全事件），只给「用直连重试」按钮。
  - 新增配置 `eraHarness.update.mirrorPrefix`（默认 `https://gh-proxy.com`）。**留空则镜像选项彻底不出现**。
  - 为什么只内置一个：今天实测 `ghfast.top` 20 秒超时、`ghproxy.net` 返回 HTTP 500、`gh-proxy.com` 200/1.35 秒且前 64 KB 与本地逐字节一致。镜像死得快，其余交给用户自己填。
- **「复制下载链接」手工退路**：把官方地址写进剪贴板，可用浏览器/下载器拉取后在扩展面板「从 VSIX 安装」。
- **安装步骤兜底**：`installExtension` 加 90 秒 race。超时**不删 vsix**（VS Code 可能还在读），改提示「已交给 VS Code，请到扩展面板确认；若版本没变，检查扩展是否被「固定」」。

### 已知限制

- **从 3.90.0 升到 3.91.1 这一跳仍走旧逻辑**：旧版没有进度条、没有超时，还是静默 4 分钟。想看到新 UI，需要 3.91.1 → 3.91.2 那一跳。
- 仓库里 `fetch` 是 Node 原生 undici（`src/shared/net.ts`），**不读 VS Code 的 `http.proxy` 设置**；34 KB/s 有可能就是这个原因，但本次未实测确认（已记入 `知识库/04`）。
- 不做断点续传（8 MB 一次性下完即可），不做 webview 内嵌进度条。

## 3.91.0 — 2026-10-22

### 修复

- **模型反复读同一个文件**：不是单点 bug，而是三层叠加，一起收口。
  - 循环检测从「只认严格连续」改为**滑动窗口**：最近 12 次调用里同一调用出现 ≥3 次即软警告（同一调用只警告一次），≥5 次直接升级；「读 A → 读 A → 搜一下 → 读 A」这种间歇重复不再能绕过阈值。
  - 同一文件同一行区间从第 3 次读起**只回 `[SAME CONTENT]` 短标记**，不再重复回全文；第 2 次仍给正文并标注「第 N 次读取」。不同区间、编辑后的重读都正常返回。
  - 文件列表把同文件同区间的重复读**合并成一行并标 `×N`**，不再刷屏；分组头仍按真实调用次数计数，界面与日志一致。
  - 编辑文件后自动清空该文件的重读历史与计数，避免把「改完再读」误判成循环。

### 新增

- **操作日志 / 排障（诊断）**：`<globalStorage>/diagnostics/audit-YYYY-MM-DD.jsonl` 记录每次工具调用（工具名、目标、行区间、是否命中缓存、同一区间第几次读、耗时、结果、provider/model）；只记元数据，**不记对话正文、不记密钥**（白名单字段 + 强制擦除 `sk-…`/`Bearer …`/长哈希）。每日轮转、单文件 8MB、保留 14 天，写盘失败不影响任务。
  - 设置 → 关于 新增「导出诊断包」「打开诊断目录」两个按钮（命令面板同名命令）：导出的 `diagnostics-*.txt` 含插件/VS Code/系统版本、**脱敏设置摘要**（provider/model/思维强度/温度/是否有 key）与最近 500 条审计记录。
  - 日志始终开启，不新增 `eraHarness.*` 配置项；靠轮转与保留期控制体积。
- **小米 MiMo（Xiaomi MiMo）供应商**：OpenAI 兼容基址 `https://api.xiaomimimo.com/v1`，密钥独立保存（`mimoApiKey`），模型列表在填入密钥后自动同步（内置 `MiMo-V2.6-Flash` / `MiMo-V2.6-Pro` 作为种子），plan/act 模型信息与 DeepSeek 同构。
  - 深度思考走官方 `thinking: { type: "enabled" | "disabled" }` 开关（只有开 / 关，无档位；官方默认开启，选「关闭」才发 `disabled`）；端点 400/422 明确拒绝该参数时自动去参重试，并记住该端点 30 分钟。
  - 设置页提供「打开 MiMo 开放平台（余额）」「注册 / 登录」「API 文档」三个入口，并提示邀请码 `PTA7TX` 可得 10 元试用赠金。
  - 切换 provider 时，若当前模型 id 不属于目标 provider 的内置清单，自动写回其默认 id（避免 `deepseek-flash` 被发到 MiMo 端点）。
- **DeepSeek 设置页补「API 文档」入口**（`https://api-docs.deepseek.com/zh-cn/`）。

### 审查后修复（同日代码审查）

- **审计日志只对完整调用记账**：流式分片（partial）不再写日志——一次工具调用会触发几十个分片，旧实现会在日志里写出几十条半截路径的「成功」并把缓存命中/次数的统计冲成噪声。
- **审计结果可信**：`outcome` 由执行路径直接返回——异常、handler 正常返回的 `toolError`、用户拒绝/重复调用/计划模式拦截（`denied`）、取消（`cancelled`）都能区分；旧实现只覆盖抛异常一条路径，且绝大多数失败仍记 `ok`。
- **导出诊断包不再丢最新事件**：同日分片按「日期 + 分片号」降序读取，合并与截取由纯函数保证「最新在包尾、只保留最新 N 行」；不再依赖字典序（`-2.jsonl` 会排在基础文件之前的坑）。
- **同区间第 3 次确实降级**：首读也播种区间计数（`commitRangeRead` 统一两个分支），修正旧实现「实际第 4 次才降级、日志与提示都少记一次」的 off-by-one。
- **审批流下的读不再拆两行**：合并键把「无区间」视为通配，`ask→say` 重新折叠为一行；且只有两条已完成调用才累加 `×N`（单次读取不会显示成 ×2），无区间消息也不会抹掉已完成行的区间。
- **编辑后失效更准**：路径改为归一化后精确比较（编辑 `foo.ts` 不再误清 `foo.ts.bak`/`myfoo.ts`，`a\\b.ts` 与 `a/b.ts` 视为同一文件），并从 `apply_patch` 的 patch 文本提取受影响路径（之前对 apply_patch 完全失效）。
- **切 provider 改为一次原子写入**：旧实现连写两次全量配置且不 await，后一次会用旧 provider 覆盖前一次，可能出现「UI 已切到 MiMo、请求仍走 DeepSeek」。
- **切 provider 不再误改模型 id**：只有当前 id 明显属于别的 provider 时才写回默认 id；否则不碰 `modelId`——避免把在线同步/手填的非内置 id 静默换掉。切到 OpenAI 兼容（读独立字段 `openAiModelId`）时也不再清空用户在 DeepSeek/MiMo 上选的模型。
- **MiMo 思维开关按官方语义**：原「档位」改成「开/关」（官方只有 `thinking.type` 开关，没有档位）。
- **Provider 顺序**：下拉列表为「免费模型 → DeepSeek → Xiaomi MiMo → OpenAI Compatible」，MiMo 不再排到末尾。
- **拒绝审批终于能被审计查到**：handler 在用户点「拒绝」时是**正常返回**固定文案（不抛异常），旧实现把它记成 `ok`；现在归入 `denied`——包括 WriteToFile 带「文件未更新/未创建」后缀、ApplyPatch 的独立文案。

### 第三轮审查修复（同日：审计 / 重复读 / MiMo）

- **拒绝不再被记成成功**：`WriteToFile` 的拒绝文案会带「文件未更新/未创建」后缀、`ApplyPatch` 用另一句话，旧的全等比较把这两种最高频的拒绝记成 `ok`；现在按前缀识别，统一归入 `denied`。
- **审计不再带出正文块**：`message` 先剥离 `<file_content>` / `<initial_task>` 等块再压到 80 字；`replace_in_file` 的 SEARCH 失败、MCP 业务失败也改走 `toolError`，不再因 handler 先 push 后返回空值而在审计里隐身。（**当时的声明过头了**：SEARCH 文案只归一了一种结尾，另两种仍会漏出最多 80 字正文，已在第四轮补上。）
- **完成前复核不再算错误**：`attempt_completion` 的二次确认是流程控制，改回普通 tool result。
- **命令后重复读仍会降级**：`execute_command` 不再清空读缓存（缓存只存元数据，命中时仍重新读盘），mtime 才是「内容变了没有」的判据；`start_line` 缺省与 `=1` 归一为同一计数键。
- **被拒绝/失败的写不再白送一次全文重读**：只有 `outcome === "ok"` 的写才失效读历史。
- **MiMo 混排消息不再整批丢思考**：软警告/图片等文本会让「当前轮」窗口边界后移，带 `tool_calls` 的历史 assistant 现在一律回传 `reasoning_content`；关闭思考时则不再回传。
- **设置页不再显示错模型**：`GET /v1/models` 返回大小写不同的 id 时按归一后的 id 取元数据；切 provider 不再清空用户选的模型 id。
- **回归网**：MiMo 请求体构造下沉为纯函数 `buildMimoParams`，单测锁住 `max_completion_tokens` / `thinking.type` / 无 `reasoning_effort` / 工具参数合并；模型清单不再锁死总数。

### 第四轮审查修复（同日：审计正文 / 重复读判死 / 模型 id）

- **审计的 SEARCH 归一不再漏**：上一轮只认 `does not match anything in the file.` 这一种结尾，而 `diff.ts` 有 4 处 throw、**3 种结尾**（另两种是 `is malformatted.` 与 `matched an incorrect content in the file.`），后两种会把最多 80 字的**文件正文**写进「可以直接发给陌生人」的诊断包。判据改为钉在头部 `The SEARCH block:`（兼容 `Error <tool>: ` 前缀），结尾怎么变都拦得住。
- **MCP 失败只留「哪一类失败」**：`use_mcp_tool` 的 `isError` 文本是服务端返回的任意内容（可能是整段 JSON 或文件正文），只截 80 字挡不住；错误文本现在带结构化头 `MCP tool returned an error (server/tool)`，审计只保留这个头。
- **已降级的重复读不再判死任务**：第 3 次同区间读起只回 `[SAME CONTENT]`（本回合几乎零成本），但第 5 次会撞上 `hardEscalation` 把 `consecutiveMistakeCount` 顶到上限——yolo 模式下任务直接失败。现在已降级的读不参与第 5 次判死，延后到第 8 次；未降级的重复读仍按原规则判死。（**当时的判据选错了**：用的是 `windowCount`，见第五轮。）
- **同一次读不再写两条对不上的审计**：审计 `dedupeKey` 与内存区间计数键收口到 `readDedupeKey` / `readRangeKey` 一份归一逻辑；`start_line` 缺省与 `=1` 同键，`start_line="abc"` 也不会再写出 `p|NaN|` 这种键。
- **切换 provider 不再吃掉新模型 id**：只纠正「明显属于**别家**清单」的 id；`deepseek-v5` 这类官方新增 / 在线同步回来的 id 会被保留（旧实现静默换回默认档，与代码里自己的注释相反）。
- **DeepSeek 模型 id 也按小写归一**：`DeepSeek-V4-Pro` 之前会被当成未知模型 → 元数据落到 flash 的价格与上下文，且扩展侧还会把非规范 id 原样发出去；`isBuiltinModelId` / `modelIdBelongsToKnownCatalog` / `getModel()` / 设置页取值现在共用 `resolveDeepSeekModelId`，不再各自手写 `toLowerCase` 或 `in` 判断。未知模型仍走「保留 id + 保守默认」的老分支（不改成默认档的上限，避免高估上下文）。
- **MiMo「必须回传思考」有了真正的回归网**：`effort → 是否回传` 与 `attachToAllToolCalls` 的接线下沉为 `prepareMimoMessages`；删掉接线会让单测变红（旧测试只测 `addReasoningContent` 本身，接线删掉仍全绿）。
- **回归网**：`test/update` 342 → 353 条，新增 `model-id.spec.ts`。R1 / R2 / R4 / R6 均做过变异检验（把修复改回原样，对应用例确实变红）。

### 第五轮审查修复（同日：判死判据 / 审计前缀 / 模型 id）

- **判死判据换成「同一区间第几次读」（上一轮引入的回归）**：上一轮把「已降级的读」排除出第 5 次判死，判据用的是 `windowCount >= 8`。但 `windowCount` 是「最近 12 条非豁免调用里同签名的条数」，在 `读A → 命令 → 读A → 命令` 交替下该签名**最多只占 6 槽**，`>= 8` 结构不可达；更要命的是第一次 `hardEscalation` 为真的那一拍（第 5 次读）响应**必然已降级**，于是 `shouldEscalateLoop` 返回 false 且此后再无机会为真——**判死从此永不触发**（改之前第 5 次就停，等于把刹车拆了）。
  - 现在降级标记首行带机器可读的 `read=N`（`commitRangeRead` 的同区间累计次数，单调、与窗口占空比无关），判据改为 `readCount >= 8`；`toolName` 改成**必填**并限定 `read_file`，别的工具（或模型回显）恰好以该标记开头不再能拿到「延后判死」的豁免。
  - **回归网**：`读A/命令/读A/命令` 跑 16 轮，断言首次判死恰好落在第 8 次读。旧的纯重复 8 次用例恰好落在「能达成 8」的路径上，所以上一轮全绿也测不到这个洞。
  - **已知残留（未修）**：若模型在每次重读之间插入 ≥3 次其它调用，窗口计数始终 < 5，仍不会判死；此时每次重读只回 `[SAME CONTENT]`，token 成本已接近零，属于可接受。
- **审计的 `Error executing <tool>: ` 前缀终于剥得掉**：`handleError` 拼的是 `Error executing replace_in_file: `（**两段**：`executing` + 工具名），旧正则 `[a-z_]+` 只吃一段，前缀剥不掉 → SEARCH 归一规则实际不命中。当前没有活着的泄漏（`diff.ts` 的 4 处 throw 全被 `WriteToFileToolHandler` 就地 catch 并 return，`handleError` 到不了），但**测试锁的是一个生产不会产生的形状**。正则改为不枚举前缀段数（`Error <任意说明>: ` 一律剥掉），测试夹具换成真实形状，并新增一个**目前不存在**的第 4 种 SEARCH 结尾——锁「钉头部」而不是「枚举结尾」。
- **在线同步的模型不再在设置页出现两行**：`GET /models` 返回 `DeepSeek-V4-Pro` 时与内置清单里的 `deepseek-v4-pro` 是两个不同的键，而 `ModelSelector` 不做去重 → 同一个模型两行。合并键改用 `resolveDeepSeekModelId` / `resolveMimoModelId` 的**规范 id**，两家共用同一个 `mergeLiveModelIds`（`providerUtils.ts`），不再各写一遍。
- **已知风险（未修，仅记录）**：思维强度存在共享字段 `planModeReasoningEffort` / `actModeReasoningEffort` 里，OpenAI 兼容与 MiMo 共用。在 OpenAI 兼容下选过 `none` 的用户切到 MiMo，会直接得到 `thinking.type = "disabled"`（MiMo 的「关闭」映射到同一个 `none`）。
- **已知限制（未修，仅记录）**：降级读靠 `mtime` 判断「内容有没有变」。用 `cp -p` / `rsync -a` / 恢复旧版本等方式写入时 mtime 可能保持不变，此时降级读会继续回 `[SAME CONTENT]`，模型拿不到新内容——需要用户重新打开文件或触发一次真实修改。

### 按官方文档适配 MiMo

上一版多处参数是从「OpenAI 兼容」这个形状推测的。本次逐页读了官方文档（`/docs/zh-CN/quick-start/summary/model`、`/docs/zh-CN/quick-start/summary/first-api-call`、`/docs/zh-CN/quick-start/usage-guide/text-generation/deep-thinking`）并改了四处实质错误、补上一处价格缺口：

1. **思考参数**：官方是 `thinking: { type: "enabled" | "disabled" }`，**不是 `reasoning_effort`**。旧实现发的 `reasoning_effort` 会被 MiMo 忽略——用户选什么都等于没选。现在：默认不发（官方已默认开启），选「关闭」才发 `disabled`。
2. **输出长度参数**：官方用 `max_completion_tokens`（限制「思考 + 回答」总长），旧实现发的是 `max_tokens`。
3. **多轮工具调用会 400**：官方明确写着「历史 assistant 含工具调用时必须完整回传 `reasoning_content`，否则 400」（官方点名 Cursor/TRAE/Roo Code/Codex 这类 Agent）。旧实现没回传——现在走与 DeepSeek 思考模型同一套 `addReasoningContent`。
4. **能力与上限按官方表改写**：三款 `mimo-v2.6-*`（补上 `mimo-v2.6-pro-ultraspeed`）均为**上下文 1M / 最大输出 128K**、支持**全模态理解**与**缓存命中**（旧值 128K / 8K 且不开图像）。思考开启时 `temperature`/`top_p` 由服务端强制 1.0/0.95，因此仍不发。
5. **价格入库，成本不再恒为 0**：官方定价页（`/docs/zh-CN/price/pay-as-you-go`，公开可访问）与三张模型页逐项一致——`flash` 命中 0.02 / 未命中 1 / 输出 2，`pro` 0.025 / 3 / 6，`pro-ultraspeed` 0.25 / 30 / 60（元 / 百万 tokens，实时推理档）。字段沿用 DeepSeek 口径（`cacheWritesPrice` = 未命中输入价），模型信息行直接显示三档价；批量推理半价、联网搜索按次另计、Token Plan 按套餐扣费，均不在此表。缓存命中价 0.025 的显示精度一并修正（原固定两位小数会四舍五入成 0.03）。

配套：入口按密钥前缀自动选（实时 API `api.xiaomimimo.com/v1` 与 Token Plan `token-plan-cn.xiaomimimo.com/v1` 不互通，密钥 `sk-` / `tp-` / `ttp-`）；基址与开关映射下沉到 `src/shared/mimo-request.ts`，扩展侧与设置页在线同步共用一份，不会再漂移；模型 id 改为大小写不敏感匹配（在线同步回 `MiMo-V2.6-Pro` 不会再被当成未知模型）。

### 已知限制

- MiMo 价格是**编译期常量**（官方按量计费实时档），官方调价需发新版本才会更新；用 Token Plan 密钥（`tp-` / `ttp-`）时按套餐扣费，界面显示的是等价 token 价值，实际以控制台用量页为准。批量推理半价、联网搜索按次另计，均未建模。
- 在线同步到内置清单之外的 MiMo 模型时，元数据与单价按 flash 种子估算；若官方新增 UltraSpeed 档的新 id，成本会被低估（已知局限，见 `知识库/18` §18.9）。
- MiMo 走 OpenAI 兼容协议（`/v1`）；官方另有 Anthropic 兼容 `/anthropic` 与批量推理入口，本插件未接。`thinking` 参数被网关拒绝时的自动去参重试仍尚未用真实 Key 实测（日志会留一条 warn）。
- 设置页新增文案（MiMo 页、诊断按钮、记忆页、思维强度选择器）仍是中文硬编码，未走 i18n。
- 诊断包中的文件路径可能包含系统用户名，外发前请自行确认。

## 3.90.0 — 2026-10-21

### 新增

- **全局记忆（设置 → 记忆）**：跨工作区长期有效的用户偏好（称呼、回答语言、工作习惯、通用约定）。
  - 模型通过新工具 `global_memory`（list / add / update / remove）读写；没有 clear 模式，清空只能由用户点两次确认。
  - 每次写入在聊天里留一条 info 记录，可审计；设置页可逐条删除、一键清空、随时关闭。
  - 关闭后既不注入提示词，也不向模型暴露工具；子代理运行时不暴露写入工具。
  - 写入前统一清洗与限量（50 条 / 单条 200 字 / 注入上限 4KB），不会把错误结论静默固化成「圣经」：注入段明确写着「这是偏好，不是本工程实测事实，冲突时以代码为准」。
  - 插件只为「回答语言」「称呼」写确定性种子（写入可读名，如「简体中文」而非 `zh-CN`），用户删除后不会再被写回，也不做对话自动总结。
- **检查更新（完全按钮触发）**：只有点「检查更新」（命令面板或设置 → 关于）才联网检查，启动时不自动联网；查到新版本后还要再点「下一步：下载并安装」才会下载并安装，装完提示重载。没有静默安装、没有后台轮询。
- **OpenAI 兼容端点支持思维强度（reasoning_effort）**：设置页始终列出档位；未知模型默认「不发送」，已知思维家族按官方默认 medium 并在界面标注；显式选择才发送，端点 400/422 明确拒绝时才自动去参重试一次并记住该端点。

### 修复

- **Shell 集成不可用提示重做**：命令其实已经执行，旧文案却像报错、还夹着英文硬编码。现在是「说明 + 3 条自查 + 改用后台模式 + 官方文档链接」，容器改为 warning 配色。
- **降级提示去重**：只有真实发生降级才计数；5 分钟内不重复弹，1 小时内第 3 次才建议切后台终端。旧实现从命令开始就计数，连跑 3 条正常命令也会误报。
- **Shell 集成失败后不再每条命令白等 4 秒**：失败后 10 分钟冷却期直接走兜底；冷却不会因后续失败自动续期，终端重新获得 shell 集成（改 profile / 重开终端）时立即恢复。
- **兜底读取修正**：抓取前先切到执行命令的终端再全选复制，结束后把活动终端还给用户；读不到剪贴板时直接放弃快照，绝不让终端内容（可能含密钥）留在用户剪贴板里。
- 终端显示名从 `Cline` 改为 `era harness`。

### 已知限制

- `planModeReasoningEffort` / `actModeReasoningEffort` 是 plan/act 共享字段：从 DeepSeek 切到 OpenAI 兼容端点时会沿用上次档位（首屏会显示当前档位，可改回「不发送」；自动降级兜底）。
- 只支持 `reasoning_effort` 一种参数名；`enable_thinking` / `thinking_budget` 等 provider 私有形态后续按需加适配器。
- 全局记忆的写入工具按「可逆操作」自动放行，不打断对话；发现写错可在设置页删除或清空。
- 设置 → 记忆 页与思维强度选择器的文案目前硬编码中文，未走 i18n（界面语言为英文时这一页仍是中文）；待补 `settings.memory.*` 键。
- 更新检查完全由用户点击触发：不启动时自动检查、不静默安装；只认本仓库 Release 的 vsix 资产（官方下载域名 + 声明与实际双重体积校验 + ZIP 头校验）。

## 3.89.6 — 2026-10-21

### 修复

- **卸载 sasami.erabasic 后「收回」清不掉残留关联**：让位时写入的 `*.erb/*.erh = erabasic`，在 sasami 被卸载后 `getExtension` 读不到语言 id，原实现只删 `era-erb`，导致「收回」无效、`.erb` 仍是纯文本。现在用 sasami 的稳定语言 id 兜底清理，卸载后点一次「收回」即可恢复。

## 3.89.5 — 2026-10-21

### 样式

- 「EraBasic 语法归属」从两个并排按钮改成**二选一单选卡**：当前生效项整卡实心高亮（蓝底白字 + 勾选图标），另一项只留描边；切换时显示加载动画，完成后回读宿主真实状态（sasami 未安装时不会误亮）。

### 实现

- 新增 `UiService.getEraBasicLanguageOwner`（只读 RPC）：webview 不直接读 VS Code 配置，由宿主返回归一化后的 `era` / `sasami`。

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
