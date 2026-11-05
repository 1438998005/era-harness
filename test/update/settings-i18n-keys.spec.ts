import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { describe, it } from "node:test"

/**
 * #231 防同类元测试（2026-11-05）：设置页 provider 组件里的每个 `t("...")` key
 * 必须能在真实 locale 资源里解析出文案。
 *
 * 旧缺陷：`MoonshotProvider.tsx` 用 `useTranslation("settings")` 却写
 * `t("settings.providers.moonshot.*")` —— namespace 已经吃掉一层，实际查找
 * `settings.settings.providers.moonshot.*`，真实 UI 显示原始 key；而单元测试把
 * `t` mock 成 `key => key`，甚至直接断言这个错误 key 存在，全绿但零防护。
 *
 * 这里的期望值来自 locale JSON 本身，不写死任何组件字段名：新增 key 忘配文案、
 * namespace 多写一层、locale 文件被删键，都会立刻红。
 */

const REPO_ROOT = process.cwd()
const PROVIDERS_DIR = path.join(REPO_ROOT, "webview-ui/src/components/settings/providers")
const LOCALES = ["en", "zh-CN"] as const

/** 源码文本断言前先剥注释：注释里常写「不要这么写」的反例（KB 08 同类型排查）。 */
function stripComments(code: string): string {
	return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")
}

function readJson(relative: string): Record<string, unknown> {
	return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relative), "utf8")) as Record<string, unknown>
}

function lookup(root: Record<string, unknown>, key: string): unknown {
	return key
		.split(".")
		.reduce<unknown>(
			(node, part) => (node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined),
			root,
		)
}

interface ComponentKeys {
	file: string
	namespace: string
	keys: string[]
}

function collectProviderKeys(): ComponentKeys[] {
	const files = fs
		.readdirSync(PROVIDERS_DIR)
		.filter((f) => f.endsWith(".tsx") && !f.includes(".test."))
		.sort()
	return files.map((file) => {
		const code = stripComments(fs.readFileSync(path.join(PROVIDERS_DIR, file), "utf8"))
		const namespace = /useTranslation\(\s*"([^"]+)"/.exec(code)?.[1] ?? ""
		const keys = [...code.matchAll(/\bt\(\s*"([^"]+)"/g)].map((match) => match[1])
		return { file, namespace, keys }
	})
}

describe("#231：provider 组件的 i18n key 全部能在双语 locale 解析", () => {
	it("扫描到足够多的组件与 key（防止正则失效导致 0 个假绿）", () => {
		const components = collectProviderKeys()
		const totalKeys = components.reduce((sum, c) => sum + c.keys.length, 0)
		assert.ok(components.length >= 7, `provider 组件太少（${components.length}），扫描路径可能不对`)
		assert.ok(totalKeys >= 40, `提取到的 t() key 太少（${totalKeys}），正则可能失效`)
		const moonshot = components.find((c) => c.file === "MoonshotProvider.tsx")
		assert.ok(moonshot, "MoonshotProvider.tsx 不在扫描结果里")
		assert.ok(moonshot.keys.length >= 10, `Moonshot 的 key 太少（${moonshot.keys.length}）`)
	})

	it("每个组件都显式使用 settings namespace（否则查表口径会变）", () => {
		for (const component of collectProviderKeys()) {
			assert.equal(component.namespace, "settings", `${component.file} 的 namespace 不是 settings`)
		}
	})

	it("每个 t() key 在 en / zh-CN 的 settings.json 里都是字符串", () => {
		const resources = Object.fromEntries(
			LOCALES.map((lng) => [lng, readJson(`webview-ui/src/locales/${lng}/settings.json`)]),
		) as Record<(typeof LOCALES)[number], Record<string, unknown>>

		for (const component of collectProviderKeys()) {
			for (const key of component.keys) {
				for (const lng of LOCALES) {
					const value = lookup(resources[lng], key)
					assert.equal(
						typeof value,
						"string",
						`${component.file}: t("${key}") 在 ${lng} 解析不到文案（namespace 多写一层？locale 缺键？）`,
					)
				}
			}
		}
	})

	it("不允许再出现 settings.providers. 叠层（providers 与 settings 是平级顶层键）", () => {
		// 注意：t("settings.model") 是合法的——settings.json 顶层有 settings 子树，解析为 settings.settings.model。
		// 真正无效的是 settings.providers.*：providers 不在 settings 子树里，useTranslation("settings") 下必查空。
		for (const component of collectProviderKeys()) {
			for (const key of component.keys) {
				assert.ok(
					!key.startsWith("settings.providers."),
					`${component.file}: t("${key}") 叠了无效的 settings. 层 —— useTranslation("settings") 下应写 t("providers.moonshot.*")`,
				)
			}
		}
	})
})
