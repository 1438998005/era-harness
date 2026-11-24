/**
 * 免费模型池：单一静态候选表 + Kilo listing 解析 + 候选链组装。
 *
 * 数据来源（2026-11-24 复核）：
 * - Kilo 侧以运行时 listing `GET https://api.kilo.ai/api/gateway/models` 的 `isFree === true` 行为准
 *   （context_length / top_provider.max_completion_tokens / architecture.input_modalities）；
 *   **判据不是 `:free` 后缀**：无后缀的 `stealth/glyph-cluster` 同样是免费行；反过来去掉
 *   `:free` 的付费行绝不能拿来补位。
 * - OVH 侧以端点 `GET /v1/models`（无 key 可拉）的 context_length **与 max_completion_tokens**
 *   为准（2026-11-24 起端点已登记输出上限，本批全部换实证值，不再保守估值）。
 *   **但目录存在 ≠ 推理端点可用**：退役生效日必须逐个 `POST /v1/chat/completions` 实测
 *   （404 `no Route matched with those values` = 已下架；429 = 存活只是限流）。
 * - vision 判据：Kilo 条目按 listing `input_modalities` 含 `image`；OVH 端点无模态字段，
 *   只有带图探针（1×1 PNG data URL）通过才声明，未验证保守 false。
 *
 * 池顺序（2026-11-24 全池重排 + 扩池，KB 08 #267；此前版本见 git 与 KB 07 §7.9）：
 * DeepSeek-V4.1-Flash-1017(ovh) → Qwen3.8-27B(ovh) → Qwen3.6-27B(ovh) →
 * Nemotron 3.5 Super VL(kilo) → Qwen3.5-397B(ovh) → Qwen3.6-35B-A3B(ovh) →
 * Dots3-Note(kilo) → ERNIE 5.5 Flash Preview(kilo) → Particle-1(kilo) → Glyph Cluster(kilo) →
 * Nemotron 3 Ultra(kilo) → Flint(kilo) → Nemotron3 Nano 30B(ovh) → gpt-oss-20b(ovh) →
 * gpt-oss-120b(ovh) → Laguna XS 2.1(ovh) → Mistral Small 3.2(ovh) → Llama 3.3 70B(ovh) →
 * Nemotron 3 Nano Omni(kilo) → Nemotron3 Omni 30B(ovh) → Qwen3-VL-30B(ovh，32K 链尾) →
 * Qwen2.5-VL-72B(ovh，32K 链尾) → Qwen3.5-9B(ovh) → Nemotron 3.5 Lightning(kilo) →
 * LFM3-1.7B(kilo)。
 * （共 25 项：OVH 15 + Kilo 10，池首 DeepSeek-V4.1-Flash-1017。本轮**新增 9 项**：
 *   DeepSeek-V4.1-Flash-1017 / qwen3.6-35b-a3b / nemotron3-nano-30b / laguna-xs-2.1 /
 *   nemotron3-omni-30b / qwen3-vl-30b-a3b（以上 OVH），ernie-5.5-flash-preview /
 *   particle-1 / flint-v1.0（以上 Kilo）；**移除 1 项**：cohere/north-mini-code:free
 *   （2026-11-23 起 Kilo listing 整行消失且 POST 404）。）
 *
 * 排序口径（2026-11-24 用户裁定，取代 #241「三源并重」与 #229/#241 的位次裁定）：
 * **合成分 = 外部强度 × 70% + 实弹 × 30%**（有实弹分者）；无实弹分 = 外部强度 × 风险系数
 * （XML 探针按本插件协议通过 0.95 / 方言不合规 0.90 / 未探 0.85）；无任何跑分的只用实弹分。
 * 外部强度取自能力基准的横向归一（AA 智能指数 / Terminal-Bench / llm-stats 的 HLE·GPQA·
 * SWE-V 等；**Kilo 调用量榜不用**——它衡量被采用程度，不衡量能力），逐模型证据表见
 * KB 07 §7.9 修订块与工作区 `免费模型实弹打分表-v4.0.md`。两条位置硬规则：
 * ① 打分表 v4.1 A 组未合格三项（Qwen3.5-9B / Lightning / LFM3-1.7B）垫底；
 * ② 登记窗口 < 64K 的排到非失败组末尾（Qwen3-VL-30B / Qwen2.5-VL-72B，32K 窗口对工程任务
 *    太短，排分再高也不该挡在长上下文候选前面）。
 * 外部权重敏感性（2026-11-24 重算复核，#277）：70% 上下各取 60%/80% 重算——取 60% 时
 * 5/6、11/12、19/20 位相邻互换；取 80% 时 4/5 互换、#14 gpt-oss-20b（47.4）落到 #16（48.6）之后；
 * 前 3 位、7–10 位与两条硬规则不受影响。
 * 回升/复测判据不变：新入池 9 项零实弹，位置暂定；按打分表八连发逐个补测后复核
 * （建议第一发 DeepSeek-V4.1-Flash-1017）。带图链不单独定序，仍是 `filter(vision)`：
 * 首位 Super VL（池序 #4 顺延）。
 *
 * 池首窗口连带后果（用户裁定「登记窗口不改 262K」的反向面）：池首 DeepSeek 登记窗口照实
 * 1,048,576，设置页自动路由展示的任务窗口与 Task 层截断/压缩阈值随之变为 1M——
 * 这是「窗口照实登记」的直接代价，已记入 KB 07 §7.9；上下文超限仍走 classifyFreeFailure
 * 的 context-exceeded（不切换候选，原样上抛交 Task 层截断重试）。
 *
 * 设计要点：
 * - 顺序 = 合成分降序（两条位置硬规则例外），依次尝试直到成功；
 * - OVH 候选始终进链（匿名可打全部；Zen 免费门为 lane 级拒绝，已暂时移出池、代码保留）；
 * - Kilo 候选受 listing 门控：拉取成功时只保留仍在免费池的；拉取失败时只放行已实证
 *   精确 ID 的条目（宁缺毋滥）；
 * - `needsProxy`：原区域敏感候选（Muse Spark 1.3/1.2、Cat Jam）均随 Zen 移出池，当前池内不触发；
 * - `collectsData` 按渠道查表（LANE_META）：Kilo 实证 mayTrainOnYourPrompts=true（明文收集）；
 *   OVH 零数据保留、不用于训练。UI「明文收集」徽标的数据源。
 *
 * 历史裁定（摘要，全文见 git log 与 KB 07 §7.9）：
 * #229（2026-11-05）三源并重初版；#241（2026-11-13）NVIDIA 家族四项重排、Super VL 末位隔离；
 * #255（11-11）Beam 1.0 渠道下线移除；#256（11-13）Crouton Alpha 下线移除；
 * #267（2026-11-24）本轮：实弹八连发 v4.0/v4.1 完成 + 三源替代榜单调研后全池重排扩池，
 * #241 的位次裁定与「前 14 项相对序不动」约束至此废止（新证据：外部强度主导 + 9 项新模型）。
 * Super VL 特记：#241 曾因实弹失败末位隔离；v4.x 复测 83 分（测试组第 4）后按合成分复位 #4，
 * 带图链首位随池序顺延。
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

/**
 * 单一候选池：顺序 = 合成分降序（外部强度 70% + 实弹 30%，两条位置硬规则例外）。
 * 2026-11-24 全池重排并扩池 19 → 25 项（KB 08 #267：新增 9、移除 North Mini Code），池首 DeepSeek-V4.1-Flash-1017。
 */
export const FREE_POOL: readonly FreeCandidate[] = [
	{
		id: "DeepSeek-V4.1-Flash-1017",
		lane: "ovh",
		wire: "chat",
		displayName: "DeepSeek V4.1 Flash 1017",
		// 用户裁定（2026-11-23）：登记窗口照实写、不封顶。连带后果见文件头「池首窗口连带后果」。
		contextWindow: 1_048_576, // OVH 端点 /v1/models 实证
		maxOutput: 262_144, // 2026-11-24 起端点登记 max_completion_tokens，全池换实证值
		vision: false, // 纯文本探针按本插件 XML 协议通过（2026-11-23）；带图未验证不声明
		// #1：合成分 95.0 = 外部强度 100 × 探针系数 0.95（XML 探针按本插件协议通过；无实弹分，
		// 按文件头口径不吃 70/30 权重）。AA II 32.6(max) / TB4.0 38.5%（官方榜 #23）/ HLE 43.3，
		// 显著强于池内其余全部候选；OVH 2026-11-17 前后上架。零实弹，位置暂定（八连发第一发建议）。
	},
	{
		id: "Qwen3.8-27B",
		lane: "ovh",
		wire: "chat",
		displayName: "Qwen3.8 27B",
		contextWindow: 262_144, // OVH 端点实证
		maxOutput: 262_144, // 2026-11-24 端点实证（原保守估值 32_768）
		vision: false,
		// #2：合成分 89.5（外部 88×0.7 + 实弹 93×0.3）。实弹八连发最高分，原池首让位给 DeepSeek。
	},
	{
		id: "Qwen3.6-27B",
		lane: "ovh",
		wire: "chat",
		displayName: "Qwen3.6 27B",
		contextWindow: 262_144,
		maxOutput: 262_144, // 2026-11-24 端点实证
		vision: false,
		// #3：合成分 84.0（外部 84×0.7 + 实弹 84×0.3）。
	},
	{
		id: "nvidia/nemotron-3.5-super-vl:free",
		lane: "kilo",
		wire: "chat",
		displayName: "Nemotron 3.5 Super VL (120B-A12B)",
		contextWindow: 1_000_000, // Kilo listing 实证
		maxOutput: 131_072,
		vision: true, // listing 含 image+video；带图链首位（池序 #4 顺延，不单独定序）
		// #4：合成分 79.5（外部 78×0.7 + 实弹 83×0.3）。#241 的「末位隔离」已被 v4.x 实弹复核推翻
		//（83 分，测试组第 4、NVIDIA 之首）；Kilo 调用量榜仍不参与排序。
	},
	{
		id: "Qwen3.5-397B-A17B",
		lane: "ovh",
		wire: "chat",
		displayName: "Qwen3.5 397B A17B",
		contextWindow: 262_144,
		maxOutput: 262_144, // 2026-11-24 端点实证
		vision: false,
		// #5：合成分 78.1（外部 82×0.7 + 实弹 69×0.3）。OVH 侧大 MoE。
	},
	{
		id: "qwen3.6-35b-a3b",
		lane: "ovh",
		wire: "chat",
		displayName: "Qwen3.6 35B A3B",
		contextWindow: 262_144, // OVH 端点实证
		maxOutput: 65_536,
		vision: false, // 纯文本 XML 探针通过（2026-11-23）；带图未验证
		// #6：合成分 77.9（外部 82×0.7，XML 探针通过 ×0.95 → 77.9）。AA 头对头与 Qwen3.8-27B 接近，
		// 厂商 SWE-V 73.4；零实弹，位置暂定。
	},
	{
		id: "dots-studio/dots-3-note-preview:free",
		lane: "kilo",
		wire: "chat",
		displayName: "Dots3-Note Preview",
		contextWindow: 512_000, // Kilo listing 实证
		maxOutput: 460_800,
		vision: true, // listing 含 image；带图链第 2 位
		// #7：合成分 76.0（实弹 76，无外部跑分 → 只用实弹分）。
	},
	{
		id: "baidu/ernie-5.5-flash-preview:free",
		lane: "kilo",
		wire: "chat",
		displayName: "ERNIE 5.5 Flash Preview",
		contextWindow: 1_024_000, // Kilo listing 实证
		maxOutput: 921_600,
		vision: false, // listing 仅 text
		// #8：合成分 76.0（外部 80×0.7，XML 探针通过 ×0.95 → 76.0）。280B-A14B MoE、1M 窗口、
		// 2026-11-11 上线的中转检查点；厂商自报 TB4.0 46.5 / DeepSWE 71.2，无独立榜单 entry。
		// 零实弹，位置暂定；偶发 429（Kilo 上游限流，重试即过）。
	},
	{
		id: "particle-ai/particle-1:free",
		lane: "kilo",
		wire: "chat",
		displayName: "Particle-1",
		contextWindow: 1_048_576, // Kilo listing 实证
		maxOutput: 131_072,
		vision: true, // listing 含 image（2026-11-24 带图请求 200 接受）
		// #9：合成分 76.0（外部 80×0.7，XML 探针通过 ×0.95 → 76.0）。DeepSeek V4.1 Flash rank-64
		// agentic LoRA，GPQA 90.4；独立测试 28/30 ≈ GPT-6.1 SOL。零实弹，位置暂定。
	},
	{
		id: "stealth/glyph-cluster",
		lane: "kilo",
		wire: "chat",
		displayName: "Glyph Cluster",
		contextWindow: 256_000, // Kilo listing 实证
		maxOutput: 256_000,
		vision: false,
		nativeTools: true, // 2026-11-09 实测：listing `supports_function_calling: true`，原生探针 `finish_reason=tool_calls`（KB 08 #254）
		// #10：合成分 75.0（实弹 75，无外部跑分 → 只用实弹分；与 test/free/spec.ts 的
		// BLENDED_SCORES 单源表一致）。stealth 槽位仍零基准分，位次靠实弹。
	},
	{
		id: "nvidia/nemotron-3-ultra-550b-a55b:free",
		lane: "kilo",
		wire: "chat",
		displayName: "Nemotron 3 Ultra (550B-A55B)",
		contextWindow: 1_000_000, // Kilo listing 实证
		maxOutput: 65_536,
		vision: false,
		// #11：合成分 63.3（外部 66×0.7 + 实弹 57×0.3）。550B-A55B 超大 MoE，NVIDIA 家族第 2 位。
	},
	{
		id: "recursive/flint-v1.0:free",
		lane: "kilo",
		wire: "chat",
		displayName: "Flint v1.0",
		contextWindow: 262_144, // Kilo listing 实证
		maxOutput: 235_929,
		vision: false, // listing 仅 text
		// #12：合成分 63.0（外部 70×0.7，方言不合规 ×0.90 → 63.0）。厂商自报 TB2.1 54.9 / SWE-V 74.2
		// / SWE-Pro v2 89.7，但社区对 agentic 场景评价负面；探针输出 Qwen `<tool_call>`+`arg_key`
		// 方言（已由 parse-assistant-message 归一器还原，KB 08 #269）。零实弹，位置暂定。
	},
	{
		id: "nemotron3-nano-30b",
		lane: "ovh",
		wire: "chat",
		displayName: "Nemotron3 Nano 30B",
		contextWindow: 262_144, // OVH 端点实证
		maxOutput: 65_536,
		vision: false, // 纯文本 XML 探针通过（2026-11-23）
		// #13：合成分 53.2（外部 56×0.7 ×0.95 探针通过 → 53.2）。30B-A3B（3.5B 活跃），
		// 思考型、英文为主、有 parser bug 记录；零实弹，位置暂定。
	},
	{
		id: "gpt-oss-20b",
		lane: "ovh",
		wire: "chat",
		displayName: "gpt-oss-20b",
		contextWindow: 131_072,
		maxOutput: 65_536, // 2026-11-24 端点实证（原保守估值 32_768）
		vision: false,
		// #14：合成分 49.1（外部 44×0.7 + 实弹 61×0.3）。
	},
	{
		id: "gpt-oss-120b",
		lane: "ovh",
		wire: "chat",
		displayName: "gpt-oss-120b",
		contextWindow: 131_072,
		maxOutput: 131_072, // 2026-11-24 端点实证（原保守估值 32_768）
		vision: false,
		// #15：合成分 49.1（外部 50×0.7 + 实弹 47×0.3）。AA II 3.8 明显低于 20b 的业界预期，
		// 与实弹分（47 < 61）同向 → 与 20b 并列，按外部稍高居前。
	},
	{
		id: "laguna-xs-2.1",
		lane: "ovh",
		wire: "chat",
		displayName: "Laguna XS 2.1",
		contextWindow: 131_072, // OVH 端点实证
		maxOutput: 65_536,
		vision: false, // 纯文本探针输出 Qwen `arg_key` 方言（归一器已覆盖）；带图未验证
		// #16：合成分 48.6（外部 54×0.7，方言不合规 ×0.90 → 48.6）。poolside 33B-A3B，
		// 厂商自报 TB2.0 37.5，社区有 harness 过拟合报告；零实弹，位置暂定。
	},
	{
		id: "Mistral-Small-3.2-24B-Instruct-2506",
		lane: "ovh",
		wire: "chat",
		displayName: "Mistral Small 3.2 24B",
		contextWindow: 131_072,
		maxOutput: 131_072, // 2026-11-24 端点实证（原保守估值 32_768）
		vision: false,
		// #17：合成分 44.2（外部 52×0.7 ×0.85 未探 → 44.2）。旧 24B，编码中下；2026-11-05 同公告
		// 退役实测仍 200 保留的旧裁定继续有效（2026-11-24 listing 在列）。
	},
	{
		id: "Meta-Llama-3_3-70B-Instruct",
		lane: "ovh",
		wire: "chat",
		displayName: "Llama 3.3 70B Instruct",
		contextWindow: 131_072,
		maxOutput: 131_072, // 2026-11-24 端点实证（原保守估值 32_768）
		vision: false,
		// #18：合成分 30.4（外部 28×0.7 + 实弹 36×0.3）。TB2.1 4.9 / HLE 3.6，代际明显落后。
	},
	{
		id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
		lane: "kilo",
		wire: "chat",
		displayName: "Nemotron 3 Nano Omni (30B-A3B)",
		contextWindow: 256_000, // Kilo listing 实证
		maxOutput: 65_536,
		vision: true, // listing 含 audio+image+video；带图链第 4 位
		// #19：合成分 24.8（外部 26×0.7 + 实弹 22×0.3）。感知子代理定位，非主力编码链路。
	},
	{
		id: "nemotron3-omni-30b",
		lane: "ovh",
		wire: "chat",
		displayName: "Nemotron3 Omni 30B",
		contextWindow: 131_072, // OVH 端点实证
		maxOutput: 65_536,
		vision: false, // 带图探针 2026-11-24 未完成（OVH 匿名限流），未验证不声明
		// #20：合成分 24.7（外部 26×0.7 ×0.95 探针通过 → 24.7）。与 Kilo Nano Omni 同权重，
		// 官方口径英文为主；零实弹，位置暂定。
	},
	{
		id: "qwen3-vl-30b-a3b",
		lane: "ovh",
		wire: "chat",
		displayName: "Qwen3-VL 30B A3B",
		contextWindow: 32_768, // OVH 端点实证；<64K → 位置硬规则②排到非失败组末尾
		maxOutput: 16_384,
		vision: false, // Instruct 变体、多语 OCR 强（外部 34），但带图探针 2026-11-24 未完成，未验证不声明
		// #21：合成分 32.3（外部 34×0.7 ×0.95 → 32.3），但 32K 窗口触发链尾规则，不按分数插队。
	},
	{
		id: "Qwen2.5-VL-72B-Instruct",
		lane: "ovh",
		wire: "chat",
		displayName: "Qwen2.5 VL 72B",
		contextWindow: 32_768, // OVH 端点实证；<64K → 位置硬规则②
		maxOutput: 32_768, // 2026-11-24 端点实证（原保守估值 8_192）
		vision: true, // 早期带图实测通过；隐私开关下带图请求的唯一 OVH 候选
		// #22：合成分 27.2（外部 32×0.7 ×0.85 未探 → 27.2）。代际最老的 VL；32K 窗口链尾，
		// 但隐私开关开启时仍是唯一 OVH 带图候选。
	},
	{
		id: "Qwen3.5-9B",
		lane: "ovh",
		wire: "chat",
		displayName: "Qwen3.5 9B",
		contextWindow: 262_144,
		maxOutput: 65_536, // 2026-11-24 端点实证（原保守估值 32_768）
		vision: false,
		// #23–25（A 组垫底，位置硬规则①）：v4.1 实弹 A 组未合格——Qwen3.5-9B（A1 9）、
		// Lightning（A2 0，A=11）、LFM3-1.7B（A=9）。合成分不参与排序，保持三者原有相对序。
	},
	{
		id: "nvidia/nemotron-3.5-lightning:free",
		lane: "kilo",
		wire: "chat",
		displayName: "Nemotron 3.5 Lightning (free)",
		contextWindow: 1_000_000, // Kilo listing 实证
		maxOutput: 65_536,
		vision: false, // listing 仅 text
		// #24：A 组未合格（A2 0，A=11）垫底；NVIDIA 官方定位「执行层 / 低延迟」快速模型。
	},
	{
		id: "liquid/lfm-3-1.7b:free",
		lane: "kilo",
		wire: "chat",
		displayName: "LFM3-1.7B",
		contextWindow: 262_144, // Kilo listing 实证
		maxOutput: 8_192,
		vision: false, // listing 仅 text
		// #25：A 组未合格（A=9）垫底。1.73B 三混合架构，官方「not recommended for agentic coding」、
		// 强制推理不可关闭（reasoning:false → 400）。2026-11-24 探活复活（前两日 429）。
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
	 * ⛔ 不是 displayName，也不是池内下标——#241/#267 重排后下标会串位。
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
