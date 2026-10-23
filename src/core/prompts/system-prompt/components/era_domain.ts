import { type EraProjectProfile, getEraProjectProfile } from "@core/era/project-profile"
import { KNOWLEDGE_ENTRIES, knowledgeRulesFor } from "@eraharness/knowledge/index"
import type { SystemPromptContext } from "../types"

/**
 * Emuera 领域提示词。
 *
 * 三个原则：
 * 1. **不预设任何路径**：工程根、脚本目录、口上目录全部来自运行时探测，
 *    探测不到就明确写「未探测到」，不给模型留下「按习惯拼路径」的借口。
 * 2. **不假设工作区是完整 eraTW**：脚本可能只有几个，目录可能被改名，
 *    所以只写「模型不看代码就会做错」的通用硬事实，不写任何工程的具体统计。
 * 3. 探测不到 Emuera 工程时返回空串，普通项目完全不受影响。
 *
 * 常驻注入的铁律小节只取 `injectedKnowledgeIds` 里那几个条目（正本在 shared-trae `knowledge/`）——
 * 提示层不复制正文，只消费 rules 级短句；其余条目与整篇判据都经原生工具 `era_knowledge` 按需检索
 * （独立宿主下另有 MCP `lookup_knowledge` / `search_knowledge`，共用同一份条目表）。
 */

function formatList(values: string[], empty: string): string {
	return values.length > 0 ? values.join("、") : empty
}

/** 编码铁律取自内嵌知识库（正本：shared-trae knowledge/lazyloading/encoding-discipline.md） */
const encodingRules = knowledgeRulesFor(KNOWLEDGE_ENTRIES, "interpreter-encoding-discipline")
/** 结构与槽位铁律（正本：shared-trae knowledge/eratw/project-structure.md 等，见 data 文件头） */
const structureRules = knowledgeRulesFor(KNOWLEDGE_ENTRIES, "project-structure-discipline")
/** 主流程与指令生命周期铁律（正本：shared-trae knowledge/eratw/game-flow-command-pipeline.md） */
const flowRules = knowledgeRulesFor(KNOWLEDGE_ENTRIES, "main-flow-pipeline")

/**
 * 常驻注入的条目白名单：其余条目只走按需检索（⛔ 全量进提示层会让 era 域膨胀）。
 * 目录行由 KNOWLEDGE_ENTRIES 现算，⛔ 手写清单——新增条目时这里不用改。
 */
const injectedKnowledgeIds = new Set(["interpreter-encoding-discipline", "project-structure-discipline", "main-flow-pipeline"])

const shortKnowledgeTitle = (title: string) => title.split("（")[0]

const injectedKnowledgeLines = KNOWLEDGE_ENTRIES.filter((entry) => injectedKnowledgeIds.has(entry.id))
	.map((entry) => `- era_knowledge mode=lookup entry_id=${entry.id}（${shortKnowledgeTitle(entry.title)}）`)
	.join("\n")

const onDemandKnowledgeLines = KNOWLEDGE_ENTRIES.filter((entry) => !injectedKnowledgeIds.has(entry.id))
	.map((entry) => `- ${entry.id}：${shortKnowledgeTitle(entry.title)}（检索词如 ${entry.tags.slice(0, 3).join("、")}）`)
	.join("\n")

/** 纯函数：给定探测结果渲染 era 域小节。导出供测试断言提示词文本（`getEraDomainSection` 需要真实目录探测）。 */
export function buildEraDomainSection(profile: EraProjectProfile): string {
	const rootLines = profile.relativeRoots
		.slice(0, 5)
		.map((relPath, index) => `  ${index + 1}. ${relPath}${index === 0 ? "（主工程）" : ""}`)
		.join("\n")

	const scriptDirs = formatList(profile.scriptDirNames, "未探测到（脚本可能直接放在工程根下）")
	const csvDirs = formatList(profile.csvDirNames, "未探测到")
	const personaDirs = formatList(profile.personaDirNames, "未探测到")
	const backupDirs = formatList(profile.backupDirNames, "未探测到")
	const extensions = formatList(profile.scriptExtensions, ".erb")

	return `====
# Emuera（EraBasic）工程约定

当前工作区里探测到了 Emuera 工程。以下事实来自本次运行时探测，不是对本工程结构的预设。

## 探测结果
- 工程根（相对工作区）：
${rootLines}
- 命中特征：${formatList(profile.markers, "仅脚本扩展名")}
- 脚本目录：${scriptDirs}
- 脚本文件：${profile.scriptFileCountTruncated ? "至少 " : "约 "}${profile.scriptFileCount} 个（${extensions}）
- CSV 目录：${csvDirs}
- 口上（剧本）目录：${personaDirs}
- 备份目录：${backupDirs}
- 引擎配置文件：${profile.hasEngineConfig ? "存在" : "未探测到"}

## 路径判断铁律
- 工作区根**不一定**是工程根：工程可能在子目录里，也可能一个工作区里放着多个工程（本体 / 魔改 / 整合包）。改文件前先按上面的相对路径确认真实位置。
- 目录名会被创作者改名、嵌套或拆分。上面写着「未探测到」的目录就是不存在，不要凭习惯拼路径；需要定位时先用 era_symbols 或 search_files 查真实路径。
- 脚本文件数量是本次扫描的估算值，且只统计脚本目录内部；需要精确文件列表时用 era_symbols 或 search_files。

## 本扩展自带的能力（先说这个，再给手动流程）
- **更新游戏 / 合并上游**：侧边栏 Era Harness 面板标题栏右上角的下载图标，或命令面板「era harness: 更新 eraTW（跟社区最新版）」。它自己会完成「检查 → 取上游快照 → 扫本地 → 生成计划 → **弹窗列改动等用户确认** → 备份后写入 → 自检」，被覆盖或删除的原文件进 _备份/update_backup_<日期>_<版本>/files/。
- 所以用户问「怎么更新 eraTW / 怎么合上游」时，**第一句就说有这个按钮**，再解释它覆盖了哪些步骤；只有用户明确要手工做、或按钮用不了（离线/非 GitLab 源）时才讲下载 zip、hash 对比那套流程。
- 你**不能**替用户点这个按钮，也不要说「我已经帮你更新了」；要更新必须由用户点。

## 工具选择
- 不确定某个指令的参数顺序、返回值，或它属于哪个引擎扩展时，用 era_reference 查：mode=lookup 按名字取整页，mode=search 按关键词检索（正文中文也算），mode=names 列出全部页面。不要凭记忆写签名，也不要为此去搜网页。
- era_reference 的返回值带「来源」标注：在线版本表示本次取到了上游最新版，内置快照表示离线兜底。两者不会混用，引用参数时以返回的那一份为准。
- 机制与纪律类问题（编码、变量槽位、口上命名与分发、指令时序与回合快照、OBJ 属性键、上游内容合并闸门）用 era_knowledge 查内置知识库：mode=search 按关键词找条目，mode=lookup 取全文（铁律＋反模式＋正文），mode=list 看目录。库里的内容是集群知识库的内置**快照**，⛔ 当成本工程的实测结论——具体数值与现状仍要读代码确认。
- 需要实测改动能否被引擎加载时用 run_game：它会启动真实引擎、等加载结束，并报告「加载痕迹」（lazyloading 索引有没有重建）与本次新写出的日志。只读代码判断不了语法层面的加载失败。
- 引擎停在标题画面时**不会写游戏日志**，所以 run_game 说「日志没变」不等于加载失败 —— 是否加载成功要看「加载痕迹」那一节；要验证一次改动，先真的改至少一个 ERB 再跑。
- run_game 会弹出游戏窗口，并让引擎重写游戏目录里它自己的文件（懒加载索引、全局存档），只应在用户明确要求实测时使用；默认报告完自动关闭（不保存进度），需要保留窗口才传 keep_alive=true。

## EraBasic 语法要点
- 分号开头是注释；#DIM / #DIMS 声明变量；#FUNCTION 表示带返回值的函数。
- 控制流必须配平：IF/ELSEIF/ELSE/ENDIF、SELECTCASE/CASE/ENDSELECT、FOR/NEXT、REPEAT/REND、DO/LOOP、WHILE/WEND。
- PRINTDATA / STRDATA 是数据块，内部用 DATAFORM 分隔分支。
- 命令与参数之间用半角空格；全角符号（，、；）在表达式里会被当成普通字符，不能当分隔符。
- 标签与变量作用域：@ 开头是全局标签，$ 开头是仅在当前函数内可见的局部标签。

## 编码铁律
${encodingRules.map((rule) => `- ${rule.text}`).join("\n")}
- BOM 与换行风格和同目录现有文件一致；没有可参照的兄弟文件时，脚本默认带 BOM、CSV 跟随同目录 CSV 的现状。

## 结构与槽位铁律
${structureRules.map((rule) => `- ${rule.text}`).join("\n")}

## 指令主流程铁律
${flowRules.map((rule) => `- ${rule.text}`).join("\n")}

以上三节只给铁律短句；要完整判据（反模式、取证链、目录地图）用 era_knowledge 取：
${injectedKnowledgeLines}
另有按需检索的条目（⛔ 不常驻注入，命中场景先用 era_knowledge mode=search）：
${onDemandKnowledgeLines}

## 编辑铁律
- 超过 200KB 的脚本优先用 replace_in_file 做定点替换；这种大小的文件整篇重写极容易丢内容。
- 读超大文件用 read_file 的 start_line / end_line 分段读，不要试图一次读完整篇。
- 改完脚本后如果工具返回「ERB 结构警告」，必须回去检查对应块是否配平，不要直接结束任务。
- SEARCH 片段必须能唯一定位：制表符（\\t）重复 N 次也是重复 N+1 次那行的子串，只给「缩进＋正文」会误命中相邻缩进的行 ⇒ 把行首命令词（PRINTFORM / CALL / IF…）连同前后行写进 SEARCH。同一句台词在剧情分支里常出现多次，命中多处时按出现顺序逐块改，⛔ 不要用「命中几次就放行」代替唯一性。
- 只改用户要求改的那几个字，⛔ 不顺手「统一格式」：不给 CALL 补右括号、不给地文行补「」、不批量把半角标点换成全角（Emuera 词法器只认半角，会连代码位的逗号/括号/取反一起吃掉）、不在改写处新造顿号。同一文件里同类写法不统一是上游历史事实，不是待修缺陷。
- 动整行前先看该文件同类行的主流写法（占多数的那个），按它写；拿不准就照抄相邻行。

## 禁止事项
- 不删除、不移动上面探测到的备份目录。
- 不修改探测到的引擎配置文件，除非用户明确要求。
- 不确定某个目录是不是有效源码时，先读一个文件确认，不要批量重命名或批量移动。
====`
}

export function getEraDomainSection(context: SystemPromptContext): string {
	const workspaceRoots = context.workspaceRoots?.map((root) => root.path)
	const profile = getEraProjectProfile(context.cwd, workspaceRoots)
	return profile.isEra ? buildEraDomainSection(profile) : ""
}
