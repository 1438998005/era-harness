/**
 * era 域提示词里的「编辑铁律」——守 2026-10-23 从集群知识库摘进来的几条匹配规则。
 *
 * 为什么值得单测：这几条是**纯文本**，删掉或改坏不会有任何类型错误、也不会有运行时异常，
 * 只会在真实编辑 ERB 时悄悄退化回「模型拿裸缩进当 SEARCH、误命中相邻行」。
 *
 * 最容易踩的坑是转义：模板字符串里写 `\t` 会变成**真的制表符**，
 * 提示词看起来像缩进错乱；必须写 `\\t` 才是给模型看的两个字符。
 * 下面第三条断言专门钉住这一点。
 */
import assert from "node:assert/strict"
import test from "node:test"
import type { EraProjectProfile } from "@core/era/project-profile"
import { buildEraDomainSection } from "@core/prompts/system-prompt/components/era_domain"

const profile: EraProjectProfile = {
	isEra: true,
	confidence: "high",
	roots: ["D:/game"],
	relativeRoots: ["."],
	markers: ["emuera.config"],
	scriptExtensions: [".erb"],
	scriptFileCount: 12,
	scriptFileCountTruncated: false,
	scriptDirNames: ["ERB"],
	csvDirNames: ["CSV"],
	backupDirNames: [],
	personaDirNames: ["ERB/口上"],
	hasEngineConfig: true,
}

const section = buildEraDomainSection(profile)

test("编辑铁律：SEARCH 必须能唯一定位，并解释制表符子串关系", () => {
	assert.ok(section.includes("## 编辑铁律"), "编辑铁律小节被删了")
	assert.ok(section.includes("SEARCH 片段必须能唯一定位"), "缺「SEARCH 唯一定位」这条")
	assert.ok(section.includes("重复 N 次也是重复 N+1 次那行的子串"), "缺制表符子串关系的说明")
	assert.ok(section.includes("命中多处时按出现顺序逐块改"), "缺「多处命中」的处理方式")
})

test("编辑铁律：禁止顺手统一格式", () => {
	assert.ok(section.includes("不给 CALL 补右括号"), "缺「别补右括号」")
	assert.ok(section.includes("不给地文行补「」"), "缺「别给地文行加引号」")
	assert.ok(section.includes("不批量把半角标点换成全角"), "缺「别批量全角化」")
	assert.ok(section.includes("不在改写处新造顿号"), "缺「别新造顿号」")
	assert.ok(section.includes("是上游历史事实，不是待修缺陷"), "缺「不统一是上游事实」的定性")
})

test("编辑铁律：动整行前先看主流写法", () => {
	assert.ok(section.includes("动整行前先看该文件同类行的主流写法"), "缺「先看主流写法」")
	assert.ok(section.includes("拿不准就照抄相邻行"), "缺兜底做法")
})

test("转义：制表符说明是字面 \\t，不是真的制表符", () => {
	// 写 \\t 才对；写成 \t 会让提示词里出现真制表符，视觉上像缩进错乱。
	assert.ok(section.includes("制表符（\\t）"), "应为字面反斜杠+t")
	assert.ok(!section.includes("\t"), "提示词里出现了真的制表符（多半是把 \\t 写成了 \t）")
})

test("原有三条编辑铁律没有被挤掉", () => {
	assert.ok(section.includes("超过 200KB 的脚本优先用 replace_in_file"), "缺大文件定点替换")
	assert.ok(section.includes("用 read_file 的 start_line / end_line 分段读"), "缺分段读")
	assert.ok(section.includes("ERB 结构警告"), "缺结构警告回检")
})

// —— 2026-10-28：容量指令被误删的根因是「提示层根本没讲它是什么」——

test("语法要点：说明 #LOCALSIZE 是每函数各自的元素数，不是变量定义", () => {
	assert.ok(section.includes("#LOCALSIZE n / #LOCALSSIZE n"), "缺容量指令的语义说明")
	assert.ok(section.includes("每个函数各自的"), "缺「每函数独立」这一定性")
	assert.ok(section.includes("不是变量定义"), "缺「不是变量定义」这一定性")
	assert.ok(section.includes("不要当重复定义去重"), "缺「别去重」的禁令")
	assert.ok(section.includes("VariableSize.csv"), "缺回退默认值的说明")
	// 回退值要写**目标工程实际生效的**那一层：eratw 的 CSV/VariableSize.csv 显式写了
	// LOCAL,200 / LOCALS,100。引擎内建默认（1000 / 100）只在文件里没写这两行时才生效，
	// 拿它当「删掉会变成多少」会低估后果（500 → 200 才是真实退化）。
	assert.ok(section.includes("LOCAL 200"), "回退值要写目标工程 VariableSize.csv 的实际设置（LOCAL 200）")
	assert.ok(section.includes("LOCALS 100"), "回退值要写目标工程 VariableSize.csv 的实际设置（LOCALS 100）")
	assert.ok(!section.includes("LOCAL 默认 1000"), "别把引擎内建默认（1000）当成本工程的回退值")
})

test("语法要点：位置错了要上移，不要删", () => {
	assert.ok(section.includes("必须紧接在 @函数名 之后"), "缺位置规则")
	assert.ok(section.includes("上移到函数头下方"), "缺「上移而不是删除」")
})

test("语法要点：#LOCALFSIZE 不与 #LOCALSIZE 并列（它是 EM+EE 扩展）", () => {
	assert.ok(section.includes("#LOCALFSIZE 是 EM+EE 扩展"), "缺 #LOCALFSIZE 的边界说明")
	assert.ok(!section.includes("#LOCALFSIZE n"), "#LOCALFSIZE 不该与 #LOCALSIZE 并列成同一形态")
})

test("工具路由：语法/预处理器走 era_reference，且声明库不是全量", () => {
	assert.ok(section.includes("语法/预处理器不归 era_knowledge"), "缺第三类路由")
	assert.ok(section.includes("不是上游全量"), "缺覆盖范围声明")
	assert.ok(section.includes("lookup 未命中时会自动去上游文档站检索一次"), "缺在线发现出口")
})

test("禁止事项：备份不落脚本树，统一写 _备份/", () => {
	assert.ok(section.includes("不把 .bak / .orig / .old / 副本 / 备份目录写进 ERB/"), "缺备份落点禁令")
	assert.ok(section.includes("_备份/<日期>_<用途>/"), "缺统一备份目录")
})
