/**
 * #139–#143、#145–#147：第五轮加固的源码级断言。
 *
 * 这批目标（controller 删除类 handler / openInBrowser / oauth / 实体解码）都依赖
 * vscode 链，进不了默认 SPECS 的运行时，只能用源码探针锁「校验有没有接线、
 * 顺序对不对」——与 subagent-command-guard / webview-input-guard 同款。
 * #149（HistoryView 高亮）经核实是死代码链（highlight 无人调用、ModelAutocomplete
 * 无引用、无 dangerouslySetInnerHTML 消费点），不修，见 KB 24 §24.13。
 */

import assert from "node:assert/strict"
import test from "node:test"
import { readCode } from "./source-probe"

test("#139 deleteSkillFile 删除前必须对 skills 合法根做包含性校验", () => {
	// skillPath 来自 webview，dirname 之后直接 recursive rm 等于「删任意目录」。
	// 合法根只有 getSkillsDirectoriesForScan 列出的那几个；白名单外一律拒绝。
	const source = readCode("src/core/controller/file/deleteSkillFile.ts")
	const roots = source.indexOf("getSkillsDirectoriesForScan(")
	const guard = source.indexOf("insideSkillRoot")
	const rm = source.indexOf("fs.rm(")
	assert.ok(roots > 0, "合法根必须取自 getSkillsDirectoriesForScan（单一来源，不另造目录清单）")
	assert.ok(guard > 0, "必须有包含性校验（insideSkillRoot）")
	assert.ok(rm > 0, "仍然要执行删除")
	assert.ok(guard < rm, "包含性校验必须在 fs.rm 之前")
})

test("#140 apply_patch 的 Move to 目标必须过 resolveAndValidate，脏路径扫描要覆盖 MOVE 行", () => {
	// `*** Move to:` 的目标此前不经过任何校验直通 createFile——clineignore 与
	// 路径合法性对真实写盘目标形同虚设；extractAllFiles 也只扫 ADD/UPDATE/DELETE。
	const source = readCode("src/core/task/tools/handlers/ApplyPatchHandler.ts")
	assert.match(source, /resolveAndValidate\(\s*action\.movePath/, "movePath 必须走与旧路径同款的 resolveAndValidate")
	assert.ok(source.includes("PATCH_MARKERS.MOVE"), "头部 <、> 脏路径扫描必须覆盖 MOVE 行的目标")
})

test("#141 deleteHook 的 hookName 必须过 isValidHookType 才能拼路径删文件", () => {
	// 对照 createHook 是校验的；deleteHook 漏了——`../x` 可穿越删任意文件。
	// 发现阶段（refreshHooks）只按 VALID_HOOK_TYPES 建 toggle，UI 只会发合法名，
	// 加闸不误伤任何合法流程。
	const source = readCode("src/core/controller/file/deleteHook.ts")
	// #165 修订：探针必须用调用形态（带实参括号）——裸函数名会命中文件头的
	// import 行，把守卫整个删掉测试照样绿（对照 #139 的 `getSkillsDirectoriesForScan(`）。
	const valid = source.indexOf("isValidHookType(hookName)")
	const unlink = source.indexOf("fs.unlink(")
	assert.ok(valid > 0, "必须校验 hookName（对照 createHook 同款）")
	assert.ok(unlink > 0, "仍然要执行删除")
	assert.ok(valid < unlink, "校验必须在 fs.unlink 之前")
})

test("#142 deleteRuleFile 只能删 toggle 表里登记过的路径", () => {
	// toggle 表就是白名单：refresh/synchronize 只为各 rules/workflows 目录下的文件
	// 建键。路径必须是其中一张表里登记过的键（resolve 归一后比较），否则拒绝。
	const source = readCode("src/core/context/instructions/user-instructions/rule-helpers.ts")
	const registered = source.indexOf("!isRulePathRegistered")
	const rm = source.indexOf("fs.rm(rulePath")
	assert.ok(registered > 0, "必须有登记表成员资格校验（isRulePathRegistered）")
	assert.ok(rm > 0, "仍然要执行删除")
	assert.ok(registered < rm, "登记校验必须在 fs.rm 之前")
})

test("#143 openInBrowser 必须走共享协议白名单，且白名单单一来源在 @shared/url", () => {
	// openUrl 在 #118 加了 http/https 白名单，openInBrowser 同功能却直通
	// openExternal（RPC 失败还会回落到接受任意 scheme 的 `open` 包）。
	const browser = readCode("src/core/controller/web/openInBrowser.ts")
	// #165 修订：同上，调用形态探针，避开 import 行。
	const guard = browser.indexOf("isSafeExternalUrl(request.value)")
	const open = browser.indexOf("openExternal(")
	assert.ok(guard > 0, "必须有协议白名单校验")
	assert.ok(open > 0, "仍然要调用 openExternal")
	assert.ok(guard < open, "白名单必须在 openExternal 之前")
	const shared = readCode("src/shared/url.ts")
	assert.ok(shared.includes('"https:"'), "白名单本体必须落在 @shared/url")
	const openUrl = readCode("src/core/controller/ui/openUrl.ts")
	assert.ok(openUrl.includes("isSafeExternalUrl"), "openUrl 也要改用共享白名单（单一来源）")
	assert.ok(!openUrl.includes("ALLOWED_PROTOCOLS"), "openUrl 不得再保留本地白名单副本（防两份漂移）")
})

test("#145 codex oauth 回调端口必须只绑 127.0.0.1", () => {
	// 未绑 host 时 Node 默认监听全部网卡，局域网可达 OAuth 回调（redirect_uri
	// 是 http://localhost:1455，回环才是预期）。
	const source = readCode("src/integrations/openai-codex/oauth.ts")
	assert.ok(source.includes('server.listen(OPENAI_CODEX_OAUTH_CONFIG.callbackPort, "127.0.0.1"'), "listen 必须显式绑定回环地址")
})

test("#146 oauth 刷新后必须先落凭证再清 refreshPromise", () => {
	// 修复前 refreshPromise 在 saveCredentials 完成前置 null：窗口期内并发
	// getAccessToken 会拿旧 refresh_token 二次刷新，上游轮换时 invalid_grant
	// → clearCredentials 把用户登出。
	const source = readCode("src/integrations/openai-codex/oauth.ts")
	const saveProbe = "await this.saveCredentials(newCredentials)"
	const clearProbe = "this.refreshPromise = null"
	// #165 修订：oauth.ts 有两处同型（forceRefreshAccessToken + getAccessToken），
	// 上一版只 indexOf 第一对——getAccessToken 那处改回「先清后存」测试照样绿。
	// 逐处 save 检查：save 紧前方（200 字符）不得出现 clear——旧竞态顺序是
	// 「先清 refreshPromise 再 saveCredentials」，两者相邻；方法尾部的 catch
	// 兜底 clear 距离很远，不参与判定。
	let cursor = 0
	let pairs = 0
	for (;;) {
		const save = source.indexOf(saveProbe, cursor)
		if (save < 0) {
			break
		}
		const before = source.slice(Math.max(0, save - 200), save)
		assert.ok(
			!before.includes(clearProbe),
			`第 ${pairs + 1} 处 saveCredentials 之前紧邻着 refreshPromise = null（旧竞态顺序）`,
		)
		assert.ok(source.indexOf(clearProbe, save) > 0, `第 ${pairs + 1} 处 saveCredentials 之后必须清 refreshPromise`)
		pairs++
		cursor = save + saveProbe.length
	}
	assert.ok(pairs >= 2, `getAccessToken 与 forceRefreshAccessToken 两处都必须钉住（实际扫到 ${pairs} 处）`)
})

test("#147 数字实体解码必须有 0x10FFFF 上界，越界保留原文本", () => {
	// `&#999999999;` 会让 fromCodePoint 抛 RangeError，把整轮流式解析炸断。
	const source = readCode("src/core/assistant-message/parse-assistant-message.ts")
	const bound = source.indexOf("0x10ffff")
	const fcp = source.indexOf("String.fromCodePoint")
	assert.ok(bound > 0, "必须有码点上界校验")
	assert.ok(fcp > 0, "仍然要解码合法实体")
	assert.ok(bound < fcp, "上界校验必须在 fromCodePoint 之前")
})
