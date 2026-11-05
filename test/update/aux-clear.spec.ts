import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { describe, it } from "node:test"

/**
 * #230 防同类回归（2026-11-05）：「清空」不是 undefined。
 *
 * 旧缺陷：AuxiliaryModelSettings 把清空编码成 undefined，
 * StateManager.setApiConfiguration 为保护 {...secrets, ...settings} 读回而跳过 undefined，
 * 两层合起来 = UI 以为清空了、持久化旧密钥/旧模型 id 还在。
 * 这里覆盖三层：① 字段名清单与存储名单对齐（元测试）；② 清空判据（行为）；
 * ③ 真实 ClineFileStorage 的「undefined → delete」磁盘语义（往返）；④ 接线没被拆掉。
 */

import { AUXILIARY_CONFIG_KEYS, auxiliaryFieldsToClear } from "@shared/aux-model"
import { ApiHandlerSettingsKeys, SecretKeys } from "@shared/storage/state-keys"
import { createStorageContext } from "@shared/storage/storage-context"

const REPO_ROOT = process.cwd()

const ALL_AUX_KEYS = [...AUXILIARY_CONFIG_KEYS.enhance, ...AUXILIARY_CONFIG_KEYS.subagent]

describe("#230：辅助配置清空判据单源且字段名不漂移", () => {
	it("两套各 6 个字段、互不重叠，且都登记在存储名单里", () => {
		assert.equal(AUXILIARY_CONFIG_KEYS.enhance.length, 6)
		assert.equal(AUXILIARY_CONFIG_KEYS.subagent.length, 6)
		assert.equal(new Set(ALL_AUX_KEYS).size, 12)

		const registered = new Set<string>([
			...(SecretKeys as readonly string[]),
			...(ApiHandlerSettingsKeys as readonly string[]),
		])
		for (const key of ALL_AUX_KEYS) {
			assert.ok(registered.has(key), `${key} 不在 secrets/settings 名单里，clear 会被存储层忽略`)
		}
	})

	it("provider 未设置 = 整组清空；空串与 undefined 等价", () => {
		assert.deepEqual(auxiliaryFieldsToClear(undefined), [])
		assert.deepEqual(auxiliaryFieldsToClear({}), [...ALL_AUX_KEYS])

		const cleared = auxiliaryFieldsToClear({
			enhanceApiProvider: "",
			enhanceApiKey: "sk-should-be-deleted",
			subagentApiProvider: "deepseek" as never,
			subagentApiKey: "sk-subagent",
			subagentApiModelId: "deepseek-chat",
			subagentModelInfo: {} as never,
			subagentReasoningEffort: "high",
			subagentMoonshotApiLine: "china",
		} as never)
		// enhance 整组（provider 空串），subagent 一个都不删（六个字段齐全）
		assert.deepEqual(cleared, [...AUXILIARY_CONFIG_KEYS.enhance])
	})

	it("provider 已设置时只删本次为空的单字段（模型回默认档 / 思考强度留空 / 密钥清空）", () => {
		const cleared = auxiliaryFieldsToClear({
			enhanceApiProvider: "deepseek" as never,
			enhanceApiKey: "sk-enhance",
			enhanceApiModelId: "",
			enhanceModelInfo: {} as never,
			enhanceReasoningEffort: undefined,
			enhanceMoonshotApiLine: "" as never,
			subagentApiProvider: "free" as never,
			subagentApiKey: "",
			subagentApiModelId: "qwen",
			subagentModelInfo: {} as never,
			subagentReasoningEffort: "low",
			subagentMoonshotApiLine: "china",
		} as never)
		assert.deepEqual(cleared, [
			"enhanceApiModelId",
			"enhanceReasoningEffort",
			// enhanceMoonshotApiLine 空串也要删（该 provider 下这个字段无意义）
			"enhanceMoonshotApiLine",
			"subagentApiKey",
		])
	})
})

describe("#230：真实存储层把 undefined 当成删除（写满 → 清空 → 读回）", () => {
	it("globalState 与 secrets 都能真删，读回不再是旧值也不是空串", () => {
		const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "era-aux-clear-"))
		try {
			const ctx = createStorageContext({ clineDir: tmp })

			// 写满一套辅助配置：密钥走 secrets，其余走 globalState
			ctx.secrets.setBatch({ enhanceApiKey: "sk-enhance-old" })
			ctx.globalState.setBatch({
				enhanceApiProvider: "deepseek",
				enhanceApiModelId: "deepseek-chat",
				enhanceModelInfo: { contextWindow: 128000 },
				enhanceReasoningEffort: "high",
			})
			assert.equal(ctx.secrets.get("enhanceApiKey"), "sk-enhance-old")
			assert.equal(ctx.globalState.get("enhanceApiProvider"), "deepseek")

			// host 侧 clearApiConfigurationFields 的落盘形态：cache 置 undefined →
			// persistGlobalStateBatch / persistSecretsBatch 的 setBatch({key: undefined})
			const toClear = auxiliaryFieldsToClear({
				enhanceApiProvider: undefined,
				enhanceApiKey: undefined,
				enhanceApiModelId: undefined,
				enhanceModelInfo: undefined,
				enhanceReasoningEffort: undefined,
				enhanceMoonshotApiLine: undefined,
				subagentApiProvider: undefined,
			} as never)
			assert.equal(toClear.length, 12)

			const secretsBatch: Record<string, string | undefined> = {}
			const globalBatch: Record<string, unknown> = {}
			for (const key of toClear) {
				if ((SecretKeys as readonly string[]).includes(key)) {
					secretsBatch[key] = undefined
				} else {
					globalBatch[key] = undefined
				}
			}
			ctx.secrets.setBatch(secretsBatch)
			ctx.globalState.setBatch(globalBatch as never)

			for (const key of AUXILIARY_CONFIG_KEYS.enhance) {
				const value = (SecretKeys as readonly string[]).includes(key) ? ctx.secrets.get(key) : ctx.globalState.get(key)
				assert.equal(value, undefined, `${key} 清空后仍能读回旧值`)
			}

			// 重新读一份新的 StorageContext（模拟重启后从磁盘加载），旧值不该复活
			const reopened = createStorageContext({ clineDir: tmp })
			assert.equal(reopened.secrets.get("enhanceApiKey"), undefined)
			assert.equal(reopened.globalState.get("enhanceApiProvider"), undefined)
			assert.equal(reopened.globalState.get("enhanceModelInfo"), undefined)
		} finally {
			fs.rmSync(tmp, { recursive: true, force: true })
		}
	})
})

describe("#230：清空通道接线没被拆掉（防「只改 UI 忘了 host」）", () => {
	it("StateManager 提供显式删除方法且写入路径调用了它", () => {
		const stateManagerCode = fs.readFileSync(path.join(REPO_ROOT, "src/core/storage/StateManager.ts"), "utf8")
		const handlerCode = fs.readFileSync(
			path.join(REPO_ROOT, "src/core/controller/models/updateApiConfigurationProto.ts"),
			"utf8",
		)
		const uiCode = fs.readFileSync(
			path.join(REPO_ROOT, "webview-ui/src/components/settings/AuxiliaryModelSettings.tsx"),
			"utf8",
		)

		assert.match(stateManagerCode, /clearApiConfigurationFields\(keys: readonly \(keyof ApiConfiguration\)\[\]\)/)
		assert.match(stateManagerCode, /this\.pendingSecrets\.add/)
		assert.match(stateManagerCode, /this\.pendingGlobalState\.add/)
		assert.match(handlerCode, /clearApiConfigurationFields\(auxiliaryFieldsToClear\(/)
		// UI 侧字段名来自共享清单，不再手写 6 个键、不再用 never 断言逃逸类型检查。
		// 源码文本断言前先剥注释：注释里常写「不要这么写」的反例（KB 08 同类型排查）。
		const stripComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")
		assert.match(uiCode, /AUXILIARY_CONFIG_KEYS\[prefix\]/)
		assert.doesNotMatch(stripComments(uiCode), /as never/)
	})
})
