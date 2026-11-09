/**
 * 免费模型池：单一静态候选表 + Kilo listing 解析 + 候选链组装。
 *
 * 数据来源（2026-11-05 复核）：
 * - Zen 侧上下文/输出以 **models.dev 的 opencode provider 免费版登记**为准
 *   （免费版与付费版窗口不同：GLM 5.3 Flash Free / DeepSeek V4.1 Flash Free /
 *     Big Pickle 均为 200K，付费版才是 1M；Cat Jam 正式 ID 为 `cat-jam-free`）；
 * - Kilo 侧以运行时 listing `GET https://api.kilo.ai/api/gateway/models` 的 `isFree === true` 行为准
 *   （context_length / top_provider.max_completion_tokens / architecture.input_modalities）；
 *   **判据不是 `:free` 后缀**：无后缀的 `reflection/beam-free`、`stealth/glyph-cluster`、
 *   `stealth/crouton-alpha` 同样是免费行；反过来去掉 `:free` 的付费行绝不能拿来补位。
 * - OVH 侧以端点 `GET /v1/models`（无 key 可拉）的 context_length 为准；
 *   maxOutput 端点未登记 → 保守估值，handler 的 FREE_REQUEST_MAX_OUTPUT 截断兜底。
 *   **但目录存在 ≠ 推理端点可用**：退役生效日必须逐个 `POST /v1/chat/completions` 实测
 *   （404 `no Route matched with those values` = 已下架；429 = 存活只是限流）。
 * - vision 以 listing `input_modalities` 含 `image` 为准（未验证不声明，保守 false）。
 *
 * 池顺序（2026-11-08 补入 LFM3-1.7B；2026-11-05 二次修订，KB 08 #241 用户裁定「只调整英伟达家族 4 项」）：
 * Beam 1.0(kilo) → Qwen3.8-27B(ovh) → Qwen3.6-27B(ovh) → Glyph Cluster(kilo) → Crouton Alpha(kilo) →
 * Dots3-Note(kilo) → Qwen3.5-397B(ovh) → North Mini Code(kilo) → gpt-oss-120b(ovh) →
 * Mistral Small 3.2(ovh) → gpt-oss-20b(ovh) → Llama 3.3 70B(ovh) → Qwen3.5-9B(ovh) →
 * Qwen2.5-VL-72B(ovh) → Nemotron 3 Ultra(kilo) → LFM3-1.7B(kilo) → Nemotron 3.5 Lightning(kilo) →
 * Nemotron 3 Nano Omni(kilo) → Nemotron 3.5 Super VL(kilo)。
 * （共 19 项：OVH 9 + Kilo 10；**前 14 项相对顺序与 #229 旧序逐字不变**，本轮只把 Kilo 新免费行
 * LFM3-1.7B 插为新 #16（Ultra 之后、Lightning 之前），其余 18 项相对顺序逐字不动、不重新评估；
 * 「保持原序」≠ 已按新三源重新评估；原 Zen 10 项已移出池，客户端代码休眠保留待恢复，
 * 门控判据见 free-lanes.ts。带图链不单独定序，仍是 `filter(vision)`：首位 stealth/crouton-alpha，
 * 用户明确裁定「这是合理的」，不为它微调任何非 NVIDIA 项。）
 *
 * 排序口径（#241 用户裁定「三源并重，任一源不得独占」）：
 * ① **本地实测（硬门槛）**：本插件 XML 工具协议实弹回放——标签闭合率 / `parse repair` 数 /
 *    命令失败率 / 端到端结论可复核；池首与带图链首位须有实弹记录（回升时才逐个补做）。
 * ② **编码与代码能力榜单**：SWE-V / SWE-bench / Terminal-Bench / LiveCodeBench / AA Coding Index 等
 *    **能力基准**；与「按 token 用量占比排的榜」分开登记，不得互相替代。
 * ③ **社区评价·渠道多元化**：Reddit 子版 / HF 模型卡与讨论 / 厂商 GitHub issue /
 *    OpenRouter 官方页工具调用错误率与可用性 / **其他平台用量排行**等交叉。
 * ⚠️ 仅移除「Kilo Leaderboard 真实用量排行」这**一个渠道**（它衡量被采用程度，不衡量本插件协议下的
 * 可靠性）；**不是把「用量排行」整个类别拉黑**。旧 #229 以该单渠道为主证据把 Super VL 提到池首，
 * 实测任务 1793888219697 中 Super VL 畸形 `<regex>` / 两次 search_files 失败 / 9 次命令失败全被审计记 ok，
 * 最终产出「未实装净土」的错误结论（只读复验仍有 20 个文件精确命中），故本轮把它**末位隔离**；
 * Ultra 有独立能力基准且无协议失败实证 → 家族首位，Lightning / Nano Omni 属「零实弹、同源
 * chat template / tool-call 方言风险未排除」的保守处置，**不是已证伪**。
 * 回升判据：逐个做本插件多轮实弹（含 search_files + execute_command），标签闭合率 100%、无 parse repair、
 * 命令结果正确、结论可复核，再由能力榜与多渠道社区评价独立佐证；一次只回升一个。
 *
 * 2026-11-05 变更（用户发起全渠道存活复核后的实施，KB 08 #229 销项）：
 * ① 移除 5 个 Kilo 免费行整行消失的死项：`thinkingmachines/inkling:free`（旧 #1，曾是 vision 链首选）、
 *    `recursive/flint-v1.0:free`、`xingchen-agi/xing4.0-29b-a4b:free`、`google/gemma-4-31b-it:free`、
 *    `liquid/lfm-2.5-2.6b:free`。其中 Inkling/Gemma/LFM 只剩去 `:free` 后缀的付费行（isFree=false），
 *    **不得用付费行补位**（会静默路由到付费模型）。
 * ② 移除 OVH `Mistral-Nemo-Instruct-2407`：`GET /v1/models` 仍列该 ID，但两次 POST 稳定 404
 *    `no Route matched with those values` → 已下架。旧池里它每次都会白烧一次请求再 failover。
 *    同日退役公告的 `Mistral-Small-3.2-24B-Instruct-2506` 实测仍 HTTP 200，保留。
 * ③ 新增 3 个 Kilo 真实免费行：`stealth/crouton-alpha`（1M/943_718，text+image+video+file+audio）、
 *    `nvidia/nemotron-3.5-lightning:free`（1M/65_536，text）、
 *    `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`（256K/65_536，text+audio+image+video）。
 * ④ **两个虚拟路由器 ID 明确不入池**：`kilo-auto/free`（Kilo Auto Model Free 档，官方
 *    `Rotates through available free models`）与 `openrouter/free`（OpenRouter Free Models Router，
 *    官方 `selects free models at random`）。它们是上游网关在单次请求内部黑盒选模型，不是真实权重，
 *    客户端事先不知道落到谁；实测请求 ID 与响应体 `model` 不同（分别落到 Dots3-Note 与 Nemotron 3.5 Super VL）。
 *    入池会破坏能力排序、`hasImages` 硬过滤、上下文管理、审计口径与可复现性。插件自己的 failover 是
 *    **客户端显式候选链**：按池序逐个发请求，只在 `classifyFreeFailure` 判 switchable 后才换下一个。
 *    「渠道」在本项目特指 `zen`/`kilo`/`ovh` 三条车道（`FreeLane`），ID 里带 `free` 不代表渠道。
 * ⑤ Nemotron 3.5 Super VL 由旧 #10 升到池首：旧序依据 r/opencode 单条「失望」帖，被平台级真实用量
 *    （Code/Plan/Debug 三榜 #1）覆盖——这正是「社区评价（重点）」权重 changes 的直接结果。
 *    **带图链首选同步由 Inkling 改为本模型**。
 *    ⚠️ **此条与 ⑥ 的「社区评价（重点）」口径已被 KB 08 #241 推翻**：见文件头二次修订块——
 *    Super VL 现为 #18 末位隔离、带图链首选为 Crouton Alpha；保留原行仅作 #229 的历史裁定记录。
 * ⑥ Glyph Cluster / Crouton Alpha 低置信放中段：前者匿名 stealth、零基准分，仅有自家榜用量；
 *    后者 2026-11-03 新上线、零社区评价，OpenRouter 官方页标 Tool call error rate **8.13%**、可用性约 97%，
 *    且是推理模型（响应带 `reasoning.encrypted` 型 `reasoning_details`，多轮须完整回传，免费池路径未实弹验证）。
 *    隐私口径冲突（OpenRouter 称「不用于训练」vs Kilo listing `mayTrainOnYourPrompts=true`）按项目保守规则
 *    仍走 Kilo 渠道 `collectsData=true`。故排在 Glyph 之后、Dots3 之前，随时可调。
 * ⑦ Lightning / Nano Omni 按官方定位（执行层快速模型 / 感知子代理 30B-A3B）放中后段，不因「新」而靠前。
 * 历史裁定：2026-11-04 Gemma 4 31B 因社区实测降位（合成基准系统性高估 Gemma 系编码，该模型本轮已死项移除）；
 * 2026-11-03 Inkling 完整版免费回归与 Gemma 加入；2026-10-24 移除 Inkling Small / Ling 3.0 Flash Sante。
 * 详见 git 与 KB 07 §7.9。）
 *
 * 2026-11-08 本轮增补（用户裁定：只给新模型定序，其余 18 项相对顺序不动）：
 * ① 两渠道清单快照：Kilo `GET /api/gateway/models` 与 `/api/v1/models` 均 383 行，`isFree === true` 12 行
 *    （10 个真实模型 + `kilo-auto/free` / `openrouter/free` 两个虚拟路由器）；池内原 9 个 Kilo 项全存活，
 *    **新增 `liquid/lfm-3-1.7b:free`**（2026-11-06 上线，262144/8192、纯文本、推理模型、0/0 价）。
 *    OVH `/v1/models` 与 catalog_v2 各 21 行，池内 9 项全在；目录仅清掉早已移出池的
 *    `Mistral-Nemo-Instruct-2407`。净变化 = 补 1 项，无池内死项。
 * ② `openrouter/free` 来源澄清：它是 OpenRouter 官方 2026-02-01 发布的 Free Models Router
 *    （`selects free models at random`），被 Kilo 网关收录进自己的目录并标 `isFree=true`；
 *    `inference_provider_ids:["virtual"]` / `tokenizer:"Router"` / 窗口与 maxOut 为 null。
 *    ⚠️ **它不是插件的第三个渠道**：请求只发到 Kilo 网关，由上游黑盒选模型（实测响应体 `model`
 *    与请求 ID 不同），不需要也不接受用户配置 OpenRouter 账号/Key。本轮按用户裁定把它做成设置页
 *    「自动路由 / 指定模型 / OpenRouter 免费路由」三选一的**独立路由模式**，⛔ 仍不进 FREE_POOL
 *    （④ 的不入池理由继续成立，见 KB 07 §7.9 修订行）。OpenRouter 侧 5 个独有免费行
 *    （`flint-v1.0` / `xing4.0-29b-a4b` / `lfm-2.5-2.6b` / `gemma-4-26b-a4b-it` / `gemma-4-31b-it`，
 *    均为 `:free` 后缀）在 Kilo 目录全部缺失（3 个只剩付费行）：「OpenRouter 免费 ≠ Kilo 网关免费」，
 *    ⛔ 不得用精确 ID 或付费行补位。
 * ③ 评分口径（用户 2026-11-08 裁定）：社区评价（**排除 Kilo Leaderboard 一切用量/占比**）+
 *    AA 榜单 + 代码/工具/工程能力榜单等多维度；**#241 的本地实弹硬门槛本轮暂不纳入**（实弹未测完，
 *    不废止历史裁定），实弹完成后按三源统一复核。本轮只给 LFM3 定序，其余 18 项不重排。
 *    LFM3 评分表与逐条出处见 KB 07 §7.9：AA `artificialanalysis.ai/models/lfm-3-1-7b` 404 → 标「未列」
 *    而非 0 分；OpenRouter 官方页 Availability 3d 92.09% / Uptime 99.99%；独立媒体指全部基准为厂商
 *    自报且官方模型卡「not recommended for agentic coding」；LMSpeed V3.0 Overall 45.0(#169/189)、
 *    Coding 28.4 / Agents 42.3；能力榜 SWE-V 43.4、SWE-Multi 23.0、TB2.1 12.9、MCP-Atlas 32.6
 *    弱于 Qwen3.5-9B，但 BFCL V4 71.4、ToolSandbox 80.4、IFEval 96.7、AutomationBench 41.3、
 *    LiveClaw 45.6 强 → 工具·指令特化、仓库级编码偏弱，故插在 Ultra(#15) 之后、Lightning 之前。
 * ④ 可用性门禁（KB 07 §7.8）：2026-11-08 实测 OVH 9 项逐个 HTTP 200；Kilo 新项零凭据
 *    200 / cost=0（偶发 429 `Provider returned error`，重试即成功），且该端点**强制推理不可关闭**
 *    （`reasoning:{enabled:false}` → 400）；`openrouter/free` 20/20 成功、7 次落到池外独有免费模型，
 *    `kilo-auto/free` 20/20 固定 Dots3-Note（零增量）。探针见工作区根 `probe-openrouter-router.mjs`，
 *    ⛔ 不进分发包、不落响应正文。
 * ⑤ 回升判据不变：#241 三源并重的逐项实弹仍未完成；LFM3 零实弹且官方不建议 agentic coding，
 *    不得因此前移到带图链首位或池首，实弹完成后按文件头三源判据逐个复核。
 *
 * 设计要点：
 * - 顺序 = 本地实测（硬门槛）+ 能力基准 + 多渠道社区评价三源并重（#241），依次尝试直到成功；
 * - OVH 候选始终进链（匿名可打全部；Zen 免费门为 lane 级拒绝，已暂时移出池、代码保留）；
 * - Kilo 候选受 listing 门控：拉取成功时只保留仍在免费池的；拉取失败时只放行已实证
 *   精确 ID 的条目（宁缺毋滥）；
 * - `needsProxy`：原区域敏感候选（Muse Spark 1.3/1.2、Cat Jam）均随 Zen 移出池，当前池内不触发；
 * - `collectsData` 按渠道查表（LANE_META）：Kilo 实证 mayTrainOnYourPrompts=true（明文收集）；
 *   OVH 零数据保留、不用于训练。UI「明文收集」徽标的数据源。
 */

export type FreeLane = "zen" | "kilo" | "ovh"
export type FreeWire = "chat" | "responses"

/** 渠道级元数据：UI 徽标与激活引导的数据源（按渠道查，不逐模型硬编码） */
export interface FreeLaneMeta {
	/** 上游是否标记会收集（训练）提示词 */
	collectsData: boolean
	/** 渠道当前可用性备注（设置页引导文案用） */
	note?: string
}

export const LANE_META: Record<FreeLane, FreeLaneMeta> = {
	// Zen 渠道已暂时移出池（开箱即用原则）；客户端代码保留休眠待恢复，门控三要素见 free-lanes.ts
	zen: { collectsData: false, note: "已暂时移出池，代码保留待恢复（需本机 opencode 客户端激活，三要素见 free-lanes.ts）" },
	// Kilo listing 实证全部 mayTrainOnYourPrompts=true → 明文收集（提示词以明文被上游收集/可能用于训练）
	kilo: { collectsData: true },
	// OVH：欧盟托管、零数据保留、不用于训练；匿名 2rpm（无需配置，Key 槽已移除）
	ovh: { collectsData: false, note: "匿名 2 次/分钟（无需配置）" },
}

export interface FreeCandidate {
	/** 上游真实模型 ID；待 listing 解析的条目为空串（此时必须带 listingMatch） */
	id: string
	lane: FreeLane
	wire: FreeWire
	displayName: string
	contextWindow: number
	maxOutput: number
	vision: boolean
	/**
	 * 原生 function calling：已实测确认（Kilo listing `supports_function_calling: true`，
	 * 且最小探针返回 `finish_reason=tool_calls`）。未验证不声明，保守 false——与 vision 同口径。
	 * 仅「指定模型」精确命中时启用原生工具通道；自动路由保持 XML（见 KB 08 #254）。
	 */
	nativeTools?: boolean
	/** 需要代理才能访问（区域敏感；被 RegionError 封锁时走 failover，换出口可解） */
	needsProxy?: boolean
	/** Kilo 条目从 listing 解析真实 ID 的匹配器（ID 未实证时使用；2026-10-24 起池内无使用者，机制休眠保留） */
	listingMatch?: RegExp
}

/** 单一候选池：顺序 = 三源并重（本地实测硬门槛 / 能力基准 / 多渠道社区评价），KB 08 #241 定稿 18 项；2026-11-08 只插入 LFM3-1.7B 为新 #16 → 共 19 项（OVH 9 + Kilo 10），前 14 项相对序与 #229 完全一致 */
export const FREE_POOL: readonly FreeCandidate[] = [
	{
		id: "reflection/beam-free",
		lane: "kilo",
		wire: "chat",
		displayName: "Beam 1.0",
		contextWindow: 1_048_576, // Kilo listing 实证
		maxOutput: 131_072,
		vision: false, // listing input_modalities 仅 text
		// #1：Reflection AI 501B-A23B（Apache 2.0），SWE-V 80.9~81.6、TB 2.1 80.1、SWE-Pro-Hard 77.2；
		// Kilo 榜 Code 15.5% #3 / Ask #1 / Plan·Debug #2 / 24h 159.9B #3 → 基准与真实用量双高，#241 后升为池首。
		// 注意 id 无 `:free` 后缀但 isFree=true，Kilo listing 门控按逐字相等匹配。
	},
	{
		id: "Qwen3.8-27B",
		lane: "ovh",
		wire: "chat",
		displayName: "Qwen3.8 27B",
		contextWindow: 262_144, // OVH 端点 /v1/models 实证
		maxOutput: 32_768, // 端点未登记，保守估值（handler 截断兜底）
		vision: false,
		// #2：OVH 侧编码首选。r/LocalLLaMA 社区共识 Qwen 系编码「大幅胜出」Gemma 系（SWE-V 73.4 vs 52.0），
		// 欧盟零数据保留渠道的最强工程模型；POST 实测 HTTP 200。
	},
	{
		id: "Qwen3.6-27B",
		lane: "ovh",
		wire: "chat",
		displayName: "Qwen3.6 27B",
		contextWindow: 262_144,
		maxOutput: 32_768,
		vision: false,
		// #3：Qwen3.8 的同系前代，SWE-V 73.4 社区实测背书；POST 实测 HTTP 200。
	},
	{
		id: "stealth/glyph-cluster",
		lane: "kilo",
		wire: "chat",
		displayName: "Glyph Cluster",
		contextWindow: 256_000, // Kilo listing 实证
		maxOutput: 256_000,
		vision: false,
		nativeTools: true, // 2026-11-09 实测：listing `supports_function_calling: true`，原生探针 `finish_reason=tool_calls`；XML-only 下 29 轮零工具（KB 08 #254）
		// #4（低置信）：Kilo/Vercel 双渠道 stealth 槽位，tokenizer 疑似 Microsoft，**无任何基准分**；
		// 排位依据仅 Kilo 自家榜用量 Code 11.9% #4 / Plan #3 / Ask #2 / kiloclaw 29.0% #1 → 中段，随时可调。
		// stealth 期 prompt 被上游留存：Kilo 渠道级 collectsData=true 已覆盖，无新增恶化。
	},
	{
		id: "stealth/crouton-alpha",
		lane: "kilo",
		wire: "chat",
		displayName: "Crouton Alpha (stealth)",
		contextWindow: 1_048_576, // Kilo listing 实证（2026-11-05 复核）
		maxOutput: 943_718, // 极大值仅登记，handler FREE_REQUEST_MAX_OUTPUT 截断兜底
		vision: true, // listing 含 image+video+file+audio；vision 链第 1 位（#241 带图链首选，多模态未实弹验证）
		// #5（低置信，2026-11-05 新增）：2026-11-03 上线的匿名 stealth 模型，Kilo listing isFree=true / 0-0 价格，
		// 零凭据 POST 实测 HTTP 200、cost=0；OpenRouter 官方页 Free / 1.0M context / Tool call error rate 8.13% /
		// 可用性约 97%。支持 tools / structured_outputs / reasoning_effort。**零社区评价**，
		// 且是推理模型：响应带 `reasoning.encrypted` 型 `reasoning_details`，多轮须完整回传
		// （openai-format.ts 有通用清洗/回传逻辑，但免费池路径未实弹验证）；低 max token 时 content 可为 null。
		// 隐私口径冲突（OpenRouter「不用于训练」vs Kilo `mayTrainOnYourPrompts=true`）按保守规则走 Kilo 收集标记。
		// 故排在 Glyph 之后、Dots3 之前；#241 后成为带图链首位（用户裁定合理），若工具调用错误率实测偏高可随时下调。
	},
	{
		id: "dots-studio/dots-3-note-preview:free",
		lane: "kilo",
		wire: "chat",
		displayName: "Dots3-Note Preview",
		contextWindow: 512_000, // Kilo listing 实证
		maxOutput: 460_800,
		vision: true, // vision 链第 2 位
		// #6：Kilo 榜 Code 3.7% #7 / 24h 70.4B #5，有真实用量但 agent 实战弱于前三；
		// 历史教训：厂商自报基准须打折（与 Gemma 系同款），社区口碑优先。
	},
	{
		id: "Qwen3.5-397B-A17B",
		lane: "ovh",
		wire: "chat",
		displayName: "Qwen3.5 397B A17B",
		contextWindow: 262_144,
		maxOutput: 32_768,
		vision: false,
		// #7：OVH 侧大 MoE，agentic 对比胜 Gemma 5/8；POST 实测 HTTP 200。
	},
	{
		id: "cohere/north-mini-code:free",
		lane: "kilo",
		wire: "chat",
		displayName: "North Mini Code",
		contextWindow: 256_000, // Kilo listing 实证
		maxOutput: 64_000,
		vision: false,
		// #8：Cohere 编码特化小模型，未进 Kilo 榜各 agent 前 10 → 编码中段。
	},
	{
		id: "gpt-oss-120b",
		lane: "ovh",
		wire: "chat",
		displayName: "gpt-oss-120b",
		contextWindow: 131_072,
		maxOutput: 32_768,
		vision: false,
	},
	{
		id: "Mistral-Small-3.2-24B-Instruct-2506",
		lane: "ovh",
		wire: "chat",
		displayName: "Mistral Small 3.2 24B",
		contextWindow: 131_072,
		maxOutput: 32_768,
		vision: false,
		// 2026-11-05 生效日实测：与 Nemo 同日退役公告，但 POST 仍 HTTP 200 → 保留（同公告 ≠ 同步下架）；
		// 目录滞后陷阱见文件头。旧 24B，编程中等偏下。
	},
	{
		id: "gpt-oss-20b",
		lane: "ovh",
		wire: "chat",
		displayName: "gpt-oss-20b",
		contextWindow: 131_072,
		maxOutput: 32_768,
		vision: false,
	},
	{
		id: "Meta-Llama-3_3-70B-Instruct",
		lane: "ovh",
		wire: "chat",
		displayName: "Llama 3.3 70B Instruct",
		contextWindow: 131_072,
		maxOutput: 32_768,
		vision: false,
	},
	{
		id: "Qwen3.5-9B",
		lane: "ovh",
		wire: "chat",
		displayName: "Qwen3.5 9B",
		contextWindow: 262_144,
		maxOutput: 32_768,
		vision: false,
	},
	{
		id: "Qwen2.5-VL-72B-Instruct",
		lane: "ovh",
		wire: "chat",
		displayName: "Qwen2.5 VL 72B",
		contextWindow: 32_768, // OVH 端点实证
		maxOutput: 8_192,
		vision: true, // vision 链第 3 位；OVH 侧唯一 vision 候选（隐私开关下带图请求唯一可打的模型）
		// VL = 视觉语言模型；32K 窗口对工程任务太短，排序靠后，但隐私开关开启时是唯一可用带图候选。
	},
	{
		id: "nvidia/nemotron-3-ultra-550b-a55b:free",
		lane: "kilo",
		wire: "chat",
		displayName: "Nemotron 3 Ultra (550B-A55B)",
		contextWindow: 1_000_000, // Kilo listing 实证
		maxOutput: 65_536,
		vision: false,
		// #15（KB 08 #241）：550B-A55B 超大 MoE，Kilo 榜 Code 18.1% #2 / 24h 180.8B #2，
		// 但 **Code agent rank 仅 #34**；有独立能力基准、且无本插件协议失败实证 → NVIDIA 家族首位。
		// ⚠️ 旧 #4 位次已废止：#241 只重排 NVIDIA 四项，其余 14 项相对序不动。
	},
	{
		id: "liquid/lfm-3-1.7b:free",
		lane: "kilo",
		wire: "chat",
		displayName: "LFM3-1.7B",
		contextWindow: 262_144, // Kilo listing 实证
		maxOutput: 8_192,
		vision: false, // listing input_modalities 仅 text
		// #16（2026-11-08 新增，用户裁定「只给新模型定序」）：Liquid AI 1.73B 三混合架构，2026-11-06 上线。
		// 社区评价（**排除 Kilo 调用量**）：OpenRouter 官方页 Availability 3d 92.09% / Uptime 99.99%，
		// 独立媒体指全部基准为厂商自报、模型卡「not recommended for agentic coding」；多家社区实测共识
		// 「窄范围工具调用可用、复杂任务不足」；LMSpeed V3.0 Overall 45.0(#169/189)、Coding 28.4、Agents 42.3。
		// AA 榜单：artificialanalysis.ai/models/lfm-3-1-7b 404 → 标「未列」，不计 0 分（权重按比例归一化）。
		// 能力榜（LMSpeed V3.0 / 官方 README）：工具·指令强 BFCL V4 71.4 / ToolSandbox 80.4 /
		// IFEval 96.7 / IFStruct 93.7 / AutomationBench 41.3 / LiveClaw 45.6；仓库级编码弱
		// SWE-V 43.4、SWE-Multi 23.0、TB2.1 12.9、MCP-Atlas 32.6（低于 Qwen3.5-9B 的 51.2/35.0/18.0/42.7）。
		// 风险：262K/8K、纯文本、**强制推理不可关闭**（reasoning:false → 400）、零凭据偶发 429、
		// mayTrainOnYourPrompts=true、官方不建议 agentic coding → 零实弹，不得进池首或带图链首位。
		// 位次：低于 Ultra(#15，AA 49.3 / SWE-V 70.7)，高于三个零实弹观察项，不占 Super VL 末位隔离位。
		// 评分表与逐条出处见 KB 07 §7.9；本轮 #241 实弹硬门槛暂不纳入（实弹未测完），完成后按三源复核。
	},
	{
		id: "nvidia/nemotron-3.5-lightning:free",
		lane: "kilo",
		wire: "chat",
		displayName: "Nemotron 3.5 Lightning (free)",
		contextWindow: 1_000_000, // Kilo listing 实证（2026-11-05 复核）
		maxOutput: 65_536,
		vision: false, // listing input_modalities 仅 text
		// #17（KB 08 #241）：NVIDIA 官方定位「执行层 / 低延迟」快速模型，24h 21.3B #8 有真实用量，
		// 但未进任一 agent 榜前 10，且**零本插件实弹** → 家族内部第 2 位，保守隔离在 #15–19 段。
	},
	{
		id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
		lane: "kilo",
		wire: "chat",
		displayName: "Nemotron 3 Nano Omni (30B-A3B)",
		contextWindow: 256_000, // Kilo listing 实证（2026-11-05 复核）
		maxOutput: 65_536,
		vision: true, // listing 含 text+audio+image+video；vision 链第 4 位
		// #18（KB 08 #241）：NVIDIA 官方定位「感知子代理」omni 小模型（30B-A3B，3B 活跃），
		// 面向多模态输入理解而非主力编码/工程链路，无榜单用量背书、零本插件实弹 → 家族第 3 位，
		// 但仍保留 vision 链第 4 位的补位价值（带图链不单独定序）。
	},
	{
		id: "nvidia/nemotron-3.5-super-vl:free",
		lane: "kilo",
		wire: "chat",
		displayName: "Nemotron 3.5 Super VL (120B-A12B)",
		contextWindow: 1_000_000, // Kilo listing 实证
		maxOutput: 131_072,
		vision: true, // listing input_modalities 含 image+video；vision 链第 5 位（末位，不再作带图链首选）
		// #19（KB 08 #241 末位隔离）：NVIDIA 通用代理模型（编码/搜索/工具/文档），旧 #229 由 #10 升池首
		// 的依据是 Kilo Leaderboard 单渠道真实用量（Code/Plan/Debug 三榜 #1、24h 273.0B #1、
		// Code agent rank #6）；该渠道只衡量被采用程度，不衡量本插件 XML 工具协议下的可靠性。
		// 任务 1793888219697 实弹：畸形 `<regex>`、search_files 两次失败、9 次命令失败、最终错误结论
		// → 唯一有本地实测且实测失败的 NVIDIA 项，本轮降到末位。回升须按文件头三源判据逐个补做实弹。
	},
]

/**
 * OpenRouter Free Models Router 的精确 ID（**只导出，不进 FREE_POOL**）。
 * 设置页第三路由模式与 host 侧单候选链共用本常量，避免两边各写一份字符串。
 * 该 ID 是 Kilo 免费清单里的虚拟路由器行：请求只发到 Kilo 网关，由上游随机选免费模型，
 * 响应体 `model` 与请求 ID 不同；入池会破坏能力排序 / hasImages 硬过滤 / 审计口径（KB 07 §7.9）。
 */
export const OPENROUTER_FREE_ROUTER_ID = "openrouter/free"

/** 虚拟路由器候选的保守上下文窗口（Kilo listing 标称 200000）。仅第三路由模式用，不进 FREE_POOL。 */
export const OPENROUTER_FREE_ROUTER_CONTEXT_WINDOW = 200_000

/**
 * KB 08 #236（用户裁定）：模型池表格的**保底可视行数**。整页滚为主、表格内滚只在表格区域
 * 生效；表格容器按本值设最大高度，矮视口下也至少能看到这么多行，不会塌成 1～2 行。
 * 单源常量：设置页容器与元测试都从这里派生，不各写一份 10。
 */
export const FREE_POOL_MIN_VISIBLE_ROWS = 10

/**
 * KB 08 #242：pinned 失败错误里的恢复入口标记。host 侧写进错误文本，webview 的 ErrorRow
 * 据此渲染「切回自动路由」按钮（点了才切，绝不自动切）；显示前会把标记从文案里剥掉。
 */
export const FREE_PINNED_RECOVERY_MARKER = "[ERA_FREE_PINNED_RECOVERY]"

/** Kilo listing 拉到的免费行（最小可用元数据） */
export interface KiloFreeRow {
	id: string
	contextWindow: number
	maxOutput: number
	vision: boolean
}

export interface FreeChainOptions {
	/** 请求是否携带图片（决定多模态硬过滤） */
	hasImages: boolean
	/** Kilo 免费清单；undefined = 拉取失败（回退静态实证表） */
	kiloFreeRows?: KiloFreeRow[]
	/** 隐私开关：true = 剔除收集提示词的渠道（LANE_META.collectsData），当前即排除 Kilo */
	excludeCollecting?: boolean
	/**
	 * KB 08 #242：指定的**真实上游模型 ID**。先按下面四道门构造完整链，再做钳制，
	 * 因此指定模型同样要过隐私 / listing / vision / 车道冷却四道门；链长恰为 1 或 0。
	 * ⛔ 不是 displayName，也不是池内下标——#241 重排后下标会串位。
	 */
	pinnedModelId?: string
}

/**
 * 组装候选链（保持池内顺序 = 用户指定优先级）：
 * 1. 隐私开关开启时先剔除收集渠道（当前即 Kilo，listing 无需拉取/解析）；
 * 2. Kilo 条目按 listing 门控（见文件头说明）；Zen / OVH 始终进链；
 * 3. 带图请求只保留 vision 候选（"an image must never ride a text-only model"）；
 * 4. KB 08 #242：最后才按 pinnedModelId 钳制（不另起一条链、不绕过任何一道门）。
 */
export function buildFreeCandidateChain(options: FreeChainOptions): FreeCandidate[] {
	const chain: FreeCandidate[] = []

	for (const candidate of FREE_POOL) {
		if (options.excludeCollecting && LANE_META[candidate.lane].collectsData) {
			continue
		}
		if (candidate.lane === "kilo") {
			const resolved = resolveKiloCandidate(candidate, options.kiloFreeRows)
			if (resolved) {
				chain.push(resolved)
			}
			continue
		}
		// Zen / OVH 候选始终进链：Zen 免费门是 lane 级拒绝且随时可能恢复；OVH 匿名可打全部
		chain.push(candidate)
	}

	const gated = options.hasImages ? chain.filter((candidate) => candidate.vision) : chain
	const pinned = options.pinnedModelId?.trim()
	if (!pinned) {
		return gated
	}
	return gated.filter((candidate) => candidate.id === pinned)
}

/**
 * KB 08 #242：钳制后链为空时，说明被**哪一道门**排除。
 * 专供 free.ts 抛专门报错用，⛔ 不落到 composeFinalError 的「已尝试 0 个候选」。
 * 返回 undefined 表示门控都通过（链空是车道冷却等运行时状态，交给下面的冷却提示）。
 */
export function describePinnedGateConflict(
	pinnedModelId: string,
	options: Pick<FreeChainOptions, "hasImages" | "excludeCollecting" | "kiloFreeRows">,
): string | undefined {
	const candidate = FREE_POOL.find((c) => c.id === pinnedModelId)
	if (!candidate) {
		return `指定的模型 ID「${pinnedModelId}」不在免费模型池中（可能已下线或已转付费）。`
	}
	if (options.excludeCollecting && LANE_META[candidate.lane].collectsData) {
		return `指定的模型「${candidate.displayName}」所在渠道会收集提示词，已被「仅使用不收集信息的模型」开关排除。`
	}
	if (options.hasImages && !candidate.vision) {
		return `指定的模型「${candidate.displayName}」不支持图片输入，本次带图请求无法使用它。`
	}
	if (candidate.lane === "kilo" && !resolveKiloCandidate(candidate, options.kiloFreeRows)) {
		return `指定的模型「${candidate.displayName}」当前不在 Kilo 免费清单中（清单拉取失败或该模型已下线）。`
	}
	return undefined
}

function resolveKiloCandidate(candidate: FreeCandidate, rows: KiloFreeRow[] | undefined): FreeCandidate | undefined {
	if (!rows) {
		// listing 拉取失败：只放行已实证精确 ID 的条目
		return candidate.id ? candidate : undefined
	}
	if (candidate.id) {
		const row = rows.find((r) => r.id === candidate.id)
		if (!row) {
			return undefined // 已不在免费池（转付费或下线）
		}
		return { ...candidate, contextWindow: row.contextWindow, maxOutput: row.maxOutput, vision: row.vision }
	}
	if (candidate.listingMatch) {
		const row = rows.find((r) => candidate.listingMatch?.test(r.id))
		if (!row) {
			return undefined
		}
		return { ...candidate, id: row.id, contextWindow: row.contextWindow, maxOutput: row.maxOutput, vision: row.vision }
	}
	return undefined
}

/** 解析 Kilo `/models` 响应中的免费行（isFree === true） */
export function parseKiloFreeRows(payload: unknown): KiloFreeRow[] {
	const data = (payload as { data?: unknown[] })?.data
	if (!Array.isArray(data)) {
		return []
	}
	const rows: KiloFreeRow[] = []
	for (const item of data) {
		const row = item as {
			id?: unknown
			isFree?: unknown
			context_length?: unknown
			top_provider?: { context_length?: unknown; max_completion_tokens?: unknown }
			architecture?: { input_modalities?: unknown }
		}
		if (row.isFree !== true || typeof row.id !== "string" || !row.id) {
			continue
		}
		const contextWindow = numberOr(row.context_length) ?? numberOr(row.top_provider?.context_length) ?? 131_072
		const maxOutput = numberOr(row.top_provider?.max_completion_tokens) ?? 32_768
		const modalities = Array.isArray(row.architecture?.input_modalities) ? row.architecture?.input_modalities : []
		rows.push({
			id: row.id,
			contextWindow,
			maxOutput,
			vision: modalities.includes("image"),
		})
	}
	return rows
}

function numberOr(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

/** 全部候选（供设置页展示） */
export function getAllFreeCandidates(): FreeCandidate[] {
	return [...FREE_POOL]
}

/**
 * 该模型是否已实测支持原生 function calling。
 * 只认 FREE_POOL 的精确 ID；虚拟路由器（如 `openrouter/free`）与未验证候选一律 false，
 * 避免把 `tools` 发给不支持的模型（KB 08 #254）。
 */
export function supportsFreeNativeTools(modelId: string): boolean {
	return FREE_POOL.some((candidate) => candidate.id === modelId && candidate.nativeTools === true)
}
