/**
 * 手写补充层：`*.generated.ts` 抽不到、但使用者最想问的那一半。
 *
 * 生成物只能回答「它叫什么、默认值是什么」；能不能回答「关掉会怎样」取决于这段文字。
 * 硬规则（与「⛔ 不猜」一致）：
 *   - 只写**能指出代码依据**的后果；没把握就整条留空，`whenOff` 不是必填；
 *   - 不写营销描述，不重复 `summary`；
 *   - 键必须是最终 catalog 里的 `key`（`data/index.ts` 应用时按 key 精确匹配，
 *     `test/settings.test.ts` 会校验这里没有残留的孤儿键）。
 */
import type { SettingRecord } from '../types.js';

/** 允许覆盖的字段：title 也给手写留口（生成物的 `autoTakeover` 之类不可读） */
export type SettingOverride = Partial<Pick<SettingRecord, 'title' | 'summary' | 'whenOff' | 'related'>>;

export const SETTING_OVERRIDES: Record<string, SettingOverride> = {
  // ── agent ──────────────────────────────────────────────────────────
  subagents: {
    whenOff: '`use_subagents` 工具会直接返回错误（Subagents are disabled），主任务只能自己串行读完所有文件。',
    related: ['并行工具调用'],
  },
  'native-tool-call': {
    whenOff: '回退到 XML 文本协议解析工具调用。端点本身不支持原生函数调用时，保持关闭反而更稳。',
  },
  'parallel-tool-calling': {
    whenOff: '提示词改为「一次只调一个工具并等结果」；连续写多个文件也不再并行，长任务明显变慢。',
    related: ['子智能体'],
  },
  'strict-plan-mode': {
    whenOff: '计划模式下仍可能改动文件——计划模式不再是硬约束，只剩提示词层面的约定。',
  },
  'auto-compact': {
    whenOff: '上下文接近上限时改为裁剪对话历史（丢掉中间部分），而不是让模型生成摘要压缩。',
  },
  'focus-chain': {
    whenOff: '任务进度清单不再跨交互保持，模型每次都要自己重建「做到哪了」。',
  },

  // ── editor ─────────────────────────────────────────────────────────
  'show-feature-tips': {
    whenOff: '思考阶段不再显示轮换的功能提示。',
  },
  'background-edit': {
    whenOff: '改为在编辑器里打开 diff 视图，会抢占编辑焦点；批量改文件时更明显。',
  },
  checkpoints: {
    whenOff: 'CheckpointManager 不初始化，检查点列表为空，无法回滚到某一步的工作区快照。',
  },
  'cline-web-tools': {
    whenOff: '网页抓取/搜索类工具不再提供给模型（这一项同时受远端 feature flag 控制，勾上也未必生效）。',
  },
  worktrees: {
    whenOff: 'Git 工作树相关能力关闭，无法为并行任务各开一份工作树。',
    related: ['子智能体', '并行工具调用'],
  },

  // ── experimental ───────────────────────────────────────────────────
  yolo: {
    whenOff: '每个写文件/执行命令的动作都要人工确认；模型也不能自行从计划模式切到执行模式。',
    related: ['严格计划模式'],
  },
  'double-check-completion': {
    whenOff: '`attempt_completion` 首次调用即结束任务，不再拒绝第一次并要求模型回头核对原始需求。',
  },
  'lazy-teammate': {
    whenOff: '不往提示词里注入「懒队友」规则（该开关只影响语气，不影响任何工具权限）。',
  },

  // ── advanced ───────────────────────────────────────────────────────
  hooks: {
    whenOff: '生命周期钩子脚本全部跳过：TaskStart / UserPromptSubmit / PreToolUse / PostToolUse / TaskResume 都不执行。',
  },

  // ── auto-approve（自动批准）────────────────────────────────────────────
  // 这 11 项的键与默认值由生成器从 src/shared/AutoApprovalSettings.ts 抽出，
  // 这里只负责把英文注释/裸字段名换成能直接给使用者看的中文。
  autoApprovalSettings: {
    title: '自动批准（开关集合）',
    summary:
      '自动批准的总容器：真正起作用的是下面 9 个 action 子项与「完成通知」。enabled / maxRequests / favorites 是遗留字段（恒为 true / 功能已移除），⛔ 不要按它们判断行为。',
    whenOff: '容器本身没有「关掉」这个动作——要收紧权限，就逐个关掉下面的 action 子项。',
  },
  'autoApprovalSettings.actions.readFiles': {
    title: '自动批准：读取工作区文件',
    summary: '自动同意读取工作区内的文件与目录列表（列目录、读文件都算）。',
    whenOff: '每次读工作区内的文件都要点一次确认。',
  },
  'autoApprovalSettings.actions.readFilesExternally': {
    title: '自动批准：读取工作区外文件',
    summary: '自动同意读取工作区之外的文件（例如工程引用了工作区外的共享库）。',
    whenOff: '读工作区外的文件要人工确认（默认就是关的）。',
  },
  'autoApprovalSettings.actions.editFiles': {
    title: '自动批准：修改工作区文件',
    summary: '自动同意在工作区内写文件、替换内容，不再先弹 diff 确认。',
    whenOff: '每次落盘改动都要先看 diff 再点确认（默认关）。',
    related: ['自动批准：修改工作区外文件'],
  },
  'autoApprovalSettings.actions.editFilesExternally': {
    title: '自动批准：修改工作区外文件',
    summary: '自动同意写入工作区之外的文件。',
    whenOff: '改工作区外的文件必须人工确认（默认关，建议保持）。',
  },
  'autoApprovalSettings.actions.executeSafeCommands': {
    title: '自动批准：执行安全命令',
    summary: '自动同意执行被判为「安全」的终端命令（只读类，如 ls / cat / grep）。',
    whenOff: '所有终端命令都要人工确认。',
  },
  'autoApprovalSettings.actions.executeAllCommands': {
    title: '自动批准：执行所有命令',
    summary: '自动同意执行任意终端命令，不再区分安全与否。',
    whenOff: '只有安全命令可自动执行，其余要人工确认（默认关，这是风险最高的一项）。',
    related: ['YOLO 模式'],
  },
  'autoApprovalSettings.actions.useBrowser': {
    title: '自动批准：浏览器操作',
    summary: '自动同意浏览器类工具（打开页面、点击、截图等）。',
    whenOff: '浏览器操作要人工确认（默认关）。',
  },
  'autoApprovalSettings.actions.useMcp': {
    title: '自动批准：MCP 工具',
    summary: '自动同意调用已配置的 MCP 服务器工具。',
    whenOff: '每次调 MCP 工具都要人工确认。',
  },
  'autoApprovalSettings.actions.autoApproveByIdentity': {
    title: '自动批准：按身份放行文件修改',
    summary: 'era harness 自有开关：落在「当前身份可写范围内」的文件修改自动同意，跨范围的仍需人工确认。',
    whenOff: '不启用按身份放行；文件修改只按「修改工作区文件 / 修改工作区外文件」两个粒度判断（默认关）。',
    related: ['自动批准：修改工作区文件'],
  },
  'autoApprovalSettings.enableNotifications': {
    title: '自动批准：完成与审批通知',
    summary: '自动批准动作发生或任务完成时弹系统通知。',
    whenOff: '不弹通知，只能从界面看结果（默认关）。',
  },

  // ── erabasic（VS Code 配置项）───────────────────────────────────────
  'eraHarness.erabasic.autoTakeover': {
    title: 'erabasic 自动接管',
    whenOff: '不再写入 .erb/.erh 的 files.associations，只保留内置方法数据；高亮、补全、跳转失效。',
  },
};

/**
 * proto 字段名与设置键不同名时的对照（左：`UpdateSettingsRequest` 的 snake_case，右：目录里的 key）。
 *
 * 只有一项：proto 叫 `native_tool_call_enabled`，而设置页那个开关的 stateKey 是
 * `nativeToolCallSetting`、目录 key 是 `native-tool-call`——两侧都是历史命名，改不动，只能对照。
 * `scripts/gate-baseline.mjs` 的「设置目录完整性」闸门先查本表再查目录，所以别名不会算漏。
 */
export const SETTING_KEY_ALIASES: Record<string, string> = {
  native_tool_call_enabled: 'native-tool-call',
};

/**
 * 明确「不收录」的设置项 → 原因。
 *
 * 为什么要这张表：`UpdateSettingsRequest` 有 37 个字段，而结构化的 `FeatureToggle[]` 只覆盖
 * 其中 15 个；剩下的 22 个文案内联在 JSX 里、或本身就是纯数据（API 配置、语言、模式）。
 * 与其让模型对着一半的设置说「不知道」，不如把「不知道」显式登记下来：
 *   - `scripts/gate-baseline.mjs` 的「设置目录完整性」闸门要求每个 proto 字段
 *     ∈ 目录 ∪ 本表，否则红灯——新增字段必须有人做一次判断；
 *   - `formatSetting` 命中本表时给出这里的理由，而不是装作没这个设置。
 */
export const UNCOVERED_SETTINGS: Record<string, string> = {
  metadata: '协议元数据（版本/时机），不是使用者可调的设置',
  api_configuration: 'API 配置是结构化对象（供应商/模型/密钥），文案在 ApiConfigurationSection 的 JSX 里，v1 不收录',
  telemetry_setting: '遥测开关，文案内联在设置页 JSX，v1 不收录',
  plan_act_separate_models_setting: '「计划/执行分别用不同模型」，文案内联在设置页 JSX，v1 不收录',
  mcp_marketplace_enabled: 'MCP 市场开关，文案内联在设置页 JSX，v1 不收录',
  shell_integration_timeout: '终端集成超时（毫秒数值），文案内联在 TerminalSettingsSection，v1 不收录',
  terminal_reuse_enabled: '终端复用开关，文案内联在 TerminalSettingsSection，v1 不收录',
  mcp_responses_collapsed: 'MCP 响应折叠（纯展示偏好），v1 不收录',
  mcp_display_mode: 'MCP 展示模式（纯展示偏好），v1 不收录',
  terminal_output_line_limit: '终端输出行数上限（数值），v1 不收录',
  mode: '当前模式（plan / act）是运行时状态，不是「设置项」',
  preferred_language: '界面与回复语言，v1 不收录',
  custom_prompt: '自定义提示词预设，v1 不收录',
  default_terminal_profile: '默认终端 profile，v1 不收录',
  multi_root_enabled: '多根工作区开关，当前恒为开启（featureFlag 写死 true），用户改了也无效果',
  vscode_terminal_execution_mode: '终端执行方式（vscodeTerminal / backgroundExec），v1 不收录',
  max_consecutive_mistakes: '连续犯错上限（数值），v1 不收录',
  subagent_terminal_output_line_limit: '子智能体的终端输出行数上限（数值），v1 不收录',
  cline_env: 'CLINE_ENV 覆盖（调试用），v1 不收录',
  onboarding_models: '引导页用的模型清单缓存，不是使用者设置',
  oca_reasoning_effort: 'OCA 供应商专用推理强度，v1 不收录',
  opt_out_of_remote_config: '退出远端配置，文案内联在设置页 JSX，v1 不收录',
};
