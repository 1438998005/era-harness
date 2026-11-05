import assert from "node:assert/strict"
import { describe, it } from "node:test"

/**
 * #233 元测试：`MODEL_INFO_FIELD_PROTO_TYPE` 映射表与 proto 定义、手写转换清单三方一致。
 *
 * 期望值**来自 proto/cline/models.proto 文本本身**（不来自被测代码），防止「映射表照抄
 * 被测代码」式假绿（#231 教训：结构测试的期望值不能来自被测路径的产出）。
 *
 * 锁三层：
 * ① proto 文本 ↔ 映射表：ModelsApiConfiguration 的全部 `*model_info` 字段被映射表完整
 *   登记（不多不少），且登记的 message 类型与 proto 声明一致；
 * ② 映射表 ↔ 手写清单：updateApiConfigurationProto.ts 里每个映射字段都有对应转换行，
 *   且所用转换器与 proto 类型匹配（Oca 误用 fromProtobufModelInfo 会再次 TypeError）；
 * ③ proto message 类型 ↔ 转换器期望：每个类型都有登记的期望转换器（防新增类型漏配）。
 */

import { MODEL_INFO_FIELD_PROTO_TYPE } from "@shared/proto-conversions/models/api-configuration-conversion"
import { readCode, readRaw } from "./source-probe"

/** proto message 类型 → updateApiConfigurationProto.ts 中应使用的转换器名 */
const EXPECTED_CONVERTER_BY_TYPE = {
	OpenRouterModelInfo: "fromProtobufModelInfo",
	OpenAiCompatibleModelInfo: "fromProtobufOpenAiCompatibleModelInfo",
	LiteLLMModelInfo: "fromProtobufOpenAiCompatibleModelInfo",
	OcaModelInfo: "fromProtobufOcaModelInfo",
} as const satisfies Record<string, string>

const snakeToCamel = (s: string) => s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())

/** 括号配对截取 message 消息体（proto 文本不含字符串字面量花括号，计数安全） */
function extractMessageBody(protoText: string, messageName: string): string {
	const marker = `message ${messageName} {`
	const start = protoText.indexOf(marker)
	assert.ok(start >= 0, `proto/cline/models.proto 里找不到 message ${messageName}`)
	let depth = 0
	let end = -1
	for (let i = start + marker.length - 1; i < protoText.length; i++) {
		if (protoText[i] === "{") {
			depth++
		} else if (protoText[i] === "}") {
			depth--
			if (depth === 0) {
				end = i
				break
			}
		}
	}
	assert.ok(end > start, `无法截取 message ${messageName} 的完整消息体`)
	return protoText.slice(start + marker.length, end)
}

const PROTO_TEXT = readRaw("proto/cline/models.proto")
const MODEL_INFO_ENTRIES: Array<readonly [string, string]> = [
	...extractMessageBody(PROTO_TEXT, "ModelsApiConfiguration").matchAll(
		/(?:optional|repeated)\s+(\w+)\s+([a-z0-9_]+)\s*=\s*\d+[^;]*;/g,
	),
]
	.filter(([, typeName]) => typeName.endsWith("ModelInfo"))
	.map(([, typeName, fieldName]) => [snakeToCamel(fieldName), typeName] as const)

const UPDATE_PROTO_SOURCE = readCode("src/core/controller/models/updateApiConfigurationProto.ts")

describe("#233：ModelInfo proto 类型映射三方一致（期望值来自 proto 文本）", () => {
	it("探测自守门：从 proto 文本解析出的 *ModelInfo 字段数足够多（防正则失效假绿）", () => {
		assert.ok(
			MODEL_INFO_ENTRIES.length >= 30,
			`从 models.proto 解析出的 *ModelInfo 字段只有 ${MODEL_INFO_ENTRIES.length} 个，解析正则可能已失效`,
		)
	})

	it("proto 文本 ↔ 映射表：全部字段已登记且 message 类型一致，映射表无多登", () => {
		const parsed = new Map(MODEL_INFO_ENTRIES)
		for (const [camelField, protoType] of parsed) {
			const registered = (MODEL_INFO_FIELD_PROTO_TYPE as Record<string, string>)[camelField]
			assert.ok(registered, `映射表缺 ${camelField}（proto 类型 ${protoType}）`)
			assert.equal(registered, protoType, `${camelField} 登记类型 ${registered} 与 proto 声明 ${protoType} 不一致`)
		}
		for (const key of Object.keys(MODEL_INFO_FIELD_PROTO_TYPE)) {
			assert.ok(parsed.has(key), `映射表多登 ${key}：proto ModelsApiConfiguration 没有该字段`)
		}
	})

	it("映射表 ↔ 手写清单：updateApiConfigurationProto.ts 每个映射字段都有转换行且转换器与类型匹配", () => {
		for (const [field, protoType] of Object.entries(MODEL_INFO_FIELD_PROTO_TYPE)) {
			const expectedConverter = EXPECTED_CONVERTER_BY_TYPE[protoType]
			assert.ok(expectedConverter, `proto 类型 ${protoType} 没有登记期望转换器（新增类型漏配）`)
			const match = UPDATE_PROTO_SOURCE.match(
				new RegExp(`${field}:\\s*protoApiConfiguration\\.${field}\\s*\\?\\s*(\\w+)\\s*\\(`),
			)
			assert.ok(match, `updateApiConfigurationProto.ts 缺 ${field} 的转换行（靠 spread 透传 proto 形状 = #233 同类）`)
			assert.equal(
				match[1],
				expectedConverter,
				`${field} 用了 ${match[1]}，期望 ${expectedConverter}（${protoType} 误用别的转换器 = #233 同类）`,
			)
		}
	})
})
