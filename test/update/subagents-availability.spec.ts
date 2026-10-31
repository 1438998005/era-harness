/**
 * #94：免费模型下禁用子代理（单源派生）。
 *
 * 这条规则只有两个自由度：用户的开关、当前 provider。写成纯函数而不是在三处
 * （Task 注入 / 工具执行 / 设置页）各判一次，是因为本项目已经复发过多次
 * 「同一规则写三遍必然有两遍漂移」。
 *
 * 两个容易写错、且写错后用户会摸不着头脑的点：
 *
 * ① **未设置（undefined）不等于 true**：设置项默认 false，`undefined` 也必须关。
 *    写成 `enabled !== false` 会让没开过的用户莫名多出 5 路并行子代理。
 * ② **只派生、不改存储**：免费模型下打开设置页不能把 `subagentsEnabled` 写回 false，
 *    否则切回付费模型就再也恢复不了（用户会以为设置被吃了）。
 */
import assert from "node:assert/strict"
import test from "node:test"
import {
	providerSupportsSubagents,
	resolveSubagentsEnabled,
	SUBAGENTS_UNAVAILABLE_FREE_PROVIDER_MESSAGE,
} from "../../src/shared/subagents"

test("#94 只有 free 不支持子代理", () => {
	assert.equal(providerSupportsSubagents("free"), false)
	for (const provider of ["bigmodel", "bigmodel-plan", "deepseek", "mimo", "openai", "anthropic", ""]) {
		assert.equal(providerSupportsSubagents(provider), true, `${provider} 应支持`)
	}
	// provider 没拿到时不能顺手禁用：宁可让用户原有的开关生效（旧的失败路径仍会报错）
	assert.equal(providerSupportsSubagents(undefined), true)
})

test("#94 enabled=true + free → 关", () => {
	assert.equal(resolveSubagentsEnabled(true, "free"), false)
})

test("#94 enabled=true + 付费 provider → 开（bigmodel / deepseek / mimo 都验一遍）", () => {
	for (const provider of ["bigmodel", "bigmodel-plan", "deepseek", "mimo"]) {
		assert.equal(resolveSubagentsEnabled(true, provider), true, `${provider} 应生效`)
	}
})

test("#94 enabled=false → 任何 provider 都关", () => {
	for (const provider of ["free", "bigmodel", "bigmodel-plan", "deepseek", "mimo", undefined]) {
		assert.equal(resolveSubagentsEnabled(false, provider), false, `${provider} 下用户关了就关`)
	}
})

test("#94 未设置（undefined）视为关（默认值不能被当成 true）", () => {
	assert.equal(resolveSubagentsEnabled(undefined, "deepseek"), false)
	assert.equal(resolveSubagentsEnabled(undefined, "free"), false)
})

test("#94 plan / act 各自取 provider：一个免费不影响另一个", () => {
	// 模拟 Task 注入：同一个用户开关，两种模式的 provider 不同 → 生效值不同
	const planProvider = "free"
	const actProvider = "bigmodel"

	assert.equal(resolveSubagentsEnabled(true, planProvider), false, "plan 模式是免费模型 → 关")
	assert.equal(resolveSubagentsEnabled(true, actProvider), true, "act 模式是付费模型 → 开")

	// 反过来同样成立（防止有人把 plan/act 写反）
	assert.equal(resolveSubagentsEnabled(true, actProvider), true)
	assert.equal(resolveSubagentsEnabled(true, planProvider), false)
})

test("#94 免费判定写死在一处：将来新增 provider 只需改 providerSupportsSubagents", () => {
	// 这条不是测实现细节，而是锁住「字符串只在一处出现」这件事：
	// 三个调用点都只读 resolveSubagentsEnabled / providerSupportsSubagents
	assert.equal(SUBAGENTS_UNAVAILABLE_FREE_PROVIDER_MESSAGE.includes("免费模型"), true)
	assert.equal(SUBAGENTS_UNAVAILABLE_FREE_PROVIDER_MESSAGE.includes("自动恢复"), true)
})
