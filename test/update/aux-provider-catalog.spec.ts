import assert from "node:assert/strict"
import { describe, it } from "node:test"

// 辅助模型面板 provider 目录回归（2026-11-24，KB 08 #272）。
// 期望值从 @shared/aux-model 的支持清单派生：以后往 AUXILIARY_SUPPORTED_PROVIDERS 加
// provider 而忘了补目录（标签 / 模型表），这里先红——面板内联表的年代这道缺口
// 静默存在过（腾讯云两家 #270 已注册归属、面板却选不到；bigmodel-plan 缺模型表）。
// ⛔ 不断言源码排版（pre-commit 的 biome 会重排，KB 04 §4.25 反例⑤）。
// host 侧 spec 直接 import webview 纯模块：mimo-model.spec.ts / model-id.spec.ts 先例。

import { AUXILIARY_SUPPORTED_PROVIDERS } from "../../src/shared/aux-model"
import { auxProviderLabel, auxProviderModels } from "../../webview-ui/src/components/settings/utils/aux-provider-catalog"

describe("辅助模型面板 provider 目录覆盖支持清单（#272）", () => {
	it("清单里每家都有显示标签（漏登记会回退成原始 id）", () => {
		for (const provider of AUXILIARY_SUPPORTED_PROVIDERS) {
			assert.notEqual(auxProviderLabel(provider), provider, `${provider} 缺标签，下拉会露出原始 id`)
		}
	})

	it("除 free 外每家都有内置模型表（选了 provider 却没有模型列表 = 半配置）", () => {
		for (const provider of AUXILIARY_SUPPORTED_PROVIDERS) {
			if (provider === "free") {
				// free 无内置清单（在线池）：面板按「无模型表」处理是既有行为，钉住不回退
				assert.equal(auxProviderModels(provider), undefined, "free 不应有内置模型表")
				continue
			}
			const models = auxProviderModels(provider)
			assert.ok(models && Object.keys(models).length > 0, `${provider} 缺内置模型表`)
		}
	})

	it("本批补的三家缺口钉死不回退：腾讯云两家 + 智谱套餐（含各自默认档）", () => {
		assert.equal(auxProviderLabel("tencent-tokenhub"), "腾讯云 TokenHub")
		assert.equal(auxProviderLabel("tencent-coding-plan"), "腾讯云 Coding Plan")
		assert.equal(auxProviderModels("tencent-tokenhub")?.["hy3"]?.contextWindow, 262_144)
		assert.equal(auxProviderModels("tencent-coding-plan")?.["tc-code-latest"]?.outputPrice, 0)
		assert.ok(auxProviderModels("bigmodel-plan")?.["glm-5.3"], "bigmodel-plan 模型表缺失（#272 顺带补的既有缺口）")
	})
})
