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
