/**
 * #150–#164、#166–#172：第六轮加固的守卫断言。
 *
 * 构成：
 *  - 行为测试（纯模块）：#159 checkContextWindowExceededError、#172 envExpansion、
 *    #169 isSafeGitRef——三者 import 链干净（无 vscode）。
 *  - 源码探针（readCode 剥注释）：其余目标都在 vscode 链上（DiffViewProvider /
 *    ApplyPatchHandler / checkpoints / StateManager / McpHub），进不了默认 SPECS
 *    的运行时，锁「守卫有没有接线、顺序对不对」——与 hardening-guards 同款。
 *
 * #165（第五轮守卫的钉力修复）直接改 hardening-guards.spec.ts 本体，不在本文件。
 */

import assert from "node:assert/strict"
import test from "node:test"
import { checkContextWindowExceededError } from "../../src/core/context/context-management/context-error-handling"
import { expandEnvironmentVariables } from "../../src/utils/envExpansion"
import { isSafeGitRef } from "../../src/utils/git"
import { readCode } from "./source-probe"

// ---------------------------------------------------------------------------
// 行为测试
// ---------------------------------------------------------------------------

test("#159 Anthropic 400 必须同时命中上下文文案才算超窗，不得任意 invalid_request 都砍历史", () => {
	// 修复前：checkIsAnthropicContextWindowError 只看 type —— 模型名写错、参数不支持
	// 等任意 400 都会被当成「超窗」，触发 quarter 截断静默删掉 3/4 历史（task/index.ts:2246）。
	const notWindowError = {
		error: { error: { type: "invalid_request_error", message: "model not found: claude-3-xyz" } },
	}
	assert.equal(checkContextWindowExceededError(notWindowError), false, "无关的 invalid_request 不得判成超窗")

	const overWindowError = {
		error: {
			error: {
				type: "invalid_request_error",
				message: "prompt is too long: 200000 tokens > 180000 maximum",
			},
		},
	}
	assert.equal(checkContextWindowExceededError(overWindowError), true, "真超窗必须仍然命中")

	const missingTypeError = { error: { error: { message: "prompt is too long: 200000 tokens" } } }
	assert.equal(checkContextWindowExceededError(missingTypeError), false, "type 不符不得判成超窗")
})

test("#172 ${env:VAR} 只取自有属性，不得沿原型链展开", () => {
	// biome noTemplateCurlyInString：用拼接构造 ${env:*} 字面量
	const envRef = (name: string) => "$" + "{" + `env:${name}` + "}"
	// 修复前 process.env["toString"] 取到 Object.prototype.toString，展开成
	// "function toString() { [native code] }" 进 MCP 配置。
	assert.equal(expandEnvironmentVariables(envRef("toString")), envRef("toString"))
	assert.equal(expandEnvironmentVariables(envRef("constructor")), envRef("constructor"))

	process.env.ERA_HARNESS_TEST_VAR = "v1"
	try {
		assert.equal(expandEnvironmentVariables(`Bearer ${envRef("ERA_HARNESS_TEST_VAR")}`), "Bearer v1")
	} finally {
		delete process.env.ERA_HARNESS_TEST_VAR
	}

	process.env.ERA_HARNESS_TEST_EMPTY = ""
	try {
		assert.equal(expandEnvironmentVariables(`x${envRef("ERA_HARNESS_TEST_EMPTY")}y`), "xy", "空串是合法值")
	} finally {
		delete process.env.ERA_HARNESS_TEST_EMPTY
	}
})

test("#169 isSafeGitRef 拒绝选项注入与空白/控制字符", () => {
	for (const bad of ["--force", "-b", "-C/tmp", "", "   ", "a b", "x\ty", "HEAD\n", "a..b"]) {
		assert.equal(isSafeGitRef(bad), false, JSON.stringify(bad))
	}
	for (const good of ["main", "feature/x", "v1.2.3", "HEAD", "refs/heads/main", "patch-1"]) {
		assert.equal(isSafeGitRef(good), true, good)
	}
})

// ---------------------------------------------------------------------------
// 一、编辑链路（DiffViewProvider / FileEditProvider / ApplyPatchHandler）
// ---------------------------------------------------------------------------

test("#150 delete 不得复用 create 语义：open 不清零盘上文件，revert 不删文件", () => {
	// 修复前 open() 用 editType === "modify" 判 fileExists，"delete" 落入 create 分支：
	// 审批前 fs.writeFile(path,"") 清零待删文件；拒绝后 revertChanges 走 !fileExists
	// 分支 fs.rm —— 点拒绝等于把文件彻底删掉。
	const source = readCode("src/integrations/editor/DiffViewProvider.ts")
	assert.ok(
		(source.match(/this\.editType !== "create"/g) ?? []).length >= 2,
		"open 与 revertChanges 都必须按 !== create 判定已有文件（delete 与 modify 同路）",
	)
	assert.equal((source.match(/this\.editType === "modify"/g) ?? []).length, 0, "不得再用 === modify 折叠 delete 的枚举语义")
	const writeFileGate = source.indexOf('this.editType === "create"')
	const writeFile = source.indexOf("fs.writeFile(this.absolutePath")
	assert.ok(writeFileGate > 0 && writeFileGate < writeFile, "fs.writeFile 清空文件必须只在 create 分支发生")
})

test("#151 deleteFile 的目标校验必须是规范化等值比较，不得用 endsWith", () => {
	// 修复前 fileLocation(反斜杠绝对路径).endsWith(fileName(正斜杠相对路径)) 在
	// Windows 上恒 false —— 审批后的删除静默落空，留下被 open 清零的 0 字节文件。
	const source = readCode("src/integrations/editor/DiffViewProvider.ts")
	assert.ok(!source.includes("endsWith(fileName)"), "endsWith 跨分隔符失配，必须换成 arePathsEqual")
	assert.ok(/arePathsEqual\(\s*(this\.absolutePath|fileLocation)/.test(source), "必须用 arePathsEqual 对打开中的文件做等值比较")
})

test("#152 loadFiles 必须编码感知读取，不得 utf8 硬解", () => {
	// 修复前 readFile(absolutePath, "utf8") 把 CP932 的 ERB 解成 mojibake，
	// applyChunks 以它为基底生成 newContent 整文件写回 —— 数据破坏。
	const source = readCode("src/core/task/tools/handlers/ApplyPatchHandler.ts")
	assert.ok(!/readFile\([^)]*,\s*"utf8"\)/.test(source), "不得再 utf8 硬解")
	// 调用形态探针：`detectEncoding` 裸名会命中 import 行（#165 同款教训）
	const buffer = source.indexOf("readFile(absolutePath)")
	const detect = source.indexOf("detectEncoding(")
	const decode = source.indexOf("iconv.decode(")
	assert.ok(buffer > 0 && detect > buffer && decode > detect, "必须 buffer 读取 → detectEncoding → iconv.decode")
	assert.ok(source.includes("iconv.encodingExists"), "iconv 不支持的编码必须兜底回 utf8（对齐 #167）")
})

test("#153 saveChanges 不得静默早退全 undefined，必须抛错让模型重试", () => {
	// 修复前 diff 编辑器被关闭时返回全 undefined，handler 照报成功并产出
	// <final_file_content>undefined</final_file_content> —— 文件其实没保存。
	const source = readCode("src/integrations/editor/DiffViewProvider.ts")
	assert.ok(!/newProblemsMessage: undefined,/.test(source), "全 undefined 的成功形状早退必须删除")
	const noContent = source.indexOf("this.newContent === undefined")
	assert.ok(noContent > 0, "无 active edit 必须显式判 undefined")
	const preSave = source.indexOf("preSaveContent === undefined")
	assert.ok(preSave > 0, "文档消失必须显式判 undefined")
	const thrown = source.indexOf("throw new Error", preSave)
	assert.ok(thrown > 0 && thrown - preSave < 200, "preSaveContent undefined 必须紧接 throw")
})

test("#155 FileEditProvider.saveDocument 空串是合法编辑，不得拒写", () => {
	// 修复前 !this.documentContent 把空串当 falsy 拒写，但上层照报成功。
	const source = readCode("src/integrations/editor/FileEditProvider.ts")
	const fnStart = source.indexOf("protected async saveDocument")
	assert.ok(fnStart > 0)
	// 只看 saveDocument 方法体：文件里 getDocumentLineCount 等其他方法也有
	// !this.documentContent（空文档行数语义，不是本条要管的）。
	const region = source.slice(fnStart, fnStart + 600)
	assert.ok(region.includes("this.documentContent === undefined"), "空串必须被允许写入")
	assert.ok(!/!\s*this\.documentContent\b/.test(region), "falsy 判断必须移除")
})

test("#154 revertChanges 必须保证落回终态（try/finally reset）", () => {
	// 修复前 replaceText 抛 "User closed text editor"（openDiffEditor 超时后）会让
	// revertChanges 中途崩掉，reset 不执行，isEditing 永久卡 true。
	const source = readCode("src/integrations/editor/DiffViewProvider.ts")
	const start = source.indexOf("async revertChanges")
	assert.ok(start > 0)
	const slice = source.slice(start, start + 4500)
	const finallyIdx = slice.indexOf("finally {")
	assert.ok(finallyIdx > 0, "revertChanges 必须有 finally")
	const resetIdx = slice.indexOf("this.reset()", finallyIdx)
	assert.ok(resetIdx > 0 && resetIdx - finallyIdx < 200, "finally 里必须 reset")
})

test("#156 patch 预览不得残留 editType，write_to_file 不得信任非编辑态的 editType", () => {
	// 修复前 previewPatchStream 只设 editType="modify" 不 open 不 reset，残留值被
	// WriteToFileToolHandler 信任成 fileExists=true，新文件走 modify 分支 ENOENT。
	const patch = readCode("src/core/task/tools/handlers/ApplyPatchHandler.ts")
	assert.ok((patch.match(/prevEditType/g) ?? []).length >= 2, "previewPatchStream 必须记录进入前的 editType 并在 finally 恢复")
	const write = readCode("src/core/task/tools/handlers/WriteToFileToolHandler.ts")
	const gate = write.indexOf("diffViewProvider.isEditing")
	const trust = write.indexOf("editType !== undefined")
	assert.ok(gate > 0 && gate < trust, "信任 editType 前必须先确认 isEditing")
})

test("#157 patchToCommit 静默跳过必须改成抛错（clineignore 命中不得报成功）", () => {
	// 修复前 resolveAndValidate 返回 undefined 时 continue——ADD 到 clineignore 路径
	// 被静默跳过，最终回复仍是 Successfully applied patch。
	const source = readCode("src/core/task/tools/handlers/ApplyPatchHandler.ts")
	// 锚定 patchToCommit 里的那次调用（previewPatchStreamInner 里也有一个
	// !targetResolution 但走 return，不归本条管；movePath 的校验在同函数更后面）。
	const anchor = source.indexOf('"ApplyPatchHandler.patchToCommit"')
	assert.ok(anchor > 0)
	const slice = source.slice(anchor, anchor + 400)
	assert.ok(slice.includes("throw new DiffError"), "target 校验失败必须 throw，不得 continue")
})

test("#161 markFileAsEditedByCline 必须在 saveChanges 成功之后", () => {
	// 修复前先标记再保存，保存抛错时标记残留，用户随后的手动编辑被当成 cline 编辑消费。
	const source = readCode("src/core/task/tools/handlers/WriteToFileToolHandler.ts")
	const mark = source.indexOf("markFileAsEditedByCline")
	const save = source.indexOf("diffViewProvider.saveChanges()")
	assert.ok(mark > 0 && save > 0 && mark > save, "标记必须后置于保存成功")
})

// ---------------------------------------------------------------------------
// 二、context 与 checkpoints
// ---------------------------------------------------------------------------

test("#158 checkpoint 恢复不得用空 ContextManager 覆写 contextHistory", () => {
	// 修复前 new ContextManager()（内存 map 为空）直接 truncate + save——磁盘上的
	// 截断记录被空 map 覆盖，恢复后首条消息替换/截断通知全丢、token 暴涨。
	const source = readCode("src/integrations/checkpoints/index.ts")
	const init = source.indexOf("initializeContextHistory")
	const trunc = source.indexOf("truncateContextHistory")
	assert.ok(init > 0, "truncate 前必须先 initializeContextHistory 从磁盘加载")
	assert.ok(trunc > init, "加载必须先于截断")
})

test("#160 checkpoint staging 失败必须终止提交，不得产出指向旧树的 hash", () => {
	// 修复前 addCheckpointFiles 失败仅 log，git.commit 照常执行（空提交），消息上
	// 记录的 lastCheckpointHash 不含本次改动——恢复到该点等于静默回滚。
	const source = readCode("src/integrations/checkpoints/CheckpointTracker.ts")
	const idx = source.indexOf("addFilesResult.success")
	assert.ok(idx > 0)
	const slice = source.slice(idx, idx + 400)
	assert.ok(slice.includes("throw"), "staging 失败必须 throw（对齐 initShadowGit 语义）")
})

test("#162 getNewContextMessagesAndMetadata 的 JSON.parse 必须有守卫", () => {
	// api_req_started.text 损坏（半截 JSON）时解析抛错会中断整轮请求循环；
	// 对齐 getSavedContextHistory 的兜底。
	const source = readCode("src/core/context/context-management/ContextManager.ts")
	// 文件里有多处同型 parse（早处本来就有 try）——必须逐处检查，任何一处
	// 紧邻 120 字符内没有 try 就算未守卫。
	const probe = "JSON.parse(previousRequestText)"
	let idx = -1
	let unguarded = 0
	for (;;) {
		idx = source.indexOf(probe, idx + 1)
		if (idx < 0) {
			break
		}
		if (!source.slice(Math.max(0, idx - 120), idx).includes("try {")) {
			unguarded++
		}
	}
	assert.ok(unguarded === 0, `仍有 ${unguarded} 处 JSON.parse(previousRequestText) 没有 try 守卫`)
})

test("#163 截断区间不得产出倒置空区间", () => {
	// 修复前 messagesToRemove=0 时 rangeEndIndex=startOfRest-1，落盘 [2,1] 甚至 [2,0]。
	const source = readCode("src/core/context/context-management/ContextManager.ts")
	assert.ok(source.includes("messagesToRemove <= 0"), "零移除必须短路返回现有区间")
})

test("#164 checkpoint 必须排除密钥类文件", () => {
	// *.pem/*.key/id_rsa*/.ssh 等会明文进 globalStorage 影子 git，只在删全部任务时清理。
	const source = readCode("src/integrations/checkpoints/CheckpointExclusions.ts")
	for (const pattern of ["*.pem", "*.key", "id_rsa*", ".ssh/", ".npmrc"]) {
		assert.ok(source.includes(`"${pattern}"`), `缺少排除模式 ${pattern}`)
	}
})

// ---------------------------------------------------------------------------
// 三、clineignore 与读取链
// ---------------------------------------------------------------------------

test("#166a validateAccess 必须归一 Win32 尾随空格/点，不得被绕过", () => {
	// "src/secrets.env "（尾随空格）在 Win32 文件层打开的就是 secrets.env，
	// 但 ignore 纯字符串匹配不到规则 —— 必须先归一再匹配。
	const source = readCode("src/core/ignore/ClineIgnoreController.ts")
	assert.ok((source.match(/stripTrailingWin32Chars/g) ?? []).length >= 2, "必须有归一 helper 且在 validateAccess 接线")
	assert.ok(source.includes('process.platform === "win32"'), "归一只在 Win32 文件层语义下需要")
})

test("#166b loadClineIgnore 不得先清空再读取（fail-open）", () => {
	// 修复前第 101 行先 ignoreInstance = ignore() 再读文件，读取抛错（EBUSY）时
	// 旧规则已经没了，到下次成功加载前所有忽略文件可读。
	const source = readCode("src/core/ignore/ClineIgnoreController.ts")
	const assignments = (source.match(/this\.ignoreInstance = ignore\(\)/g) ?? []).length
	assert.equal(assignments, 1, "ignore() 只允许出现在构造函数，loadClineIgnore 必须建临时实例成功后替换")
	assert.ok(source.includes("nextInstance"), "loadClineIgnore 必须在临时实例上构建")
})

test("#166c read_file/list_files 的 clineignore 校验必须在路径解析之后（hint 前缀）", () => {
	// 修复前校验发生在 resolveWorkspacePath 之前，`@主根:src/secrets.env` 的 hint
	// 前缀还没剥掉，字面串匹配不到任何规则 —— 等于绕过。
	// 调用形态探针（带 `(`），避免匹配到 import 行造成假绿——#139 的写法。
	const read = readCode("src/core/task/tools/handlers/ReadFileToolHandler.ts")
	assert.ok(
		read.indexOf("resolveWorkspacePath(config") < read.indexOf("checkClineIgnorePath("),
		"ReadFileToolHandler：先解析后校验",
	)
	const list = readCode("src/core/task/tools/handlers/ListFilesToolHandler.ts")
	assert.ok(
		list.indexOf("resolveWorkspacePath(config") < list.indexOf("checkClineIgnorePath("),
		"ListFilesToolHandler：先解析后校验",
	)
})

test("#167 extract-text：20MB 限流前置到全部分支 + iconv 编码兜底", () => {
	// 修复前 20MB 检查只在 default 文本分支，PDF/DOCX/XLSX/IPYNB 直接全量读盘；
	// chardet 返回 iconv-lite 不支持的编码（ISO-2022-JP）时 decode 抛错、read_file 永久失败。
	const source = readCode("src/integrations/misc/extract-text.ts")
	const stat = source.indexOf("fileStat.size")
	const firstBranch = source.indexOf('case ".pdf"')
	assert.ok(stat > 0 && firstBranch > stat, "大小限流必须在进入分支之前")
	assert.ok((source.match(/iconv\.encodingExists/g) ?? []).length >= 2, "default 与 ipynb 两条 decode 路径都要兜底")
})

// ---------------------------------------------------------------------------
// 四、持久化与杂项
// ---------------------------------------------------------------------------

test("#168a persistPendingState 不得吞掉 await 窗口内的新写入", () => {
	// 修复前直接把活动 pending Set 传进 persist*Batch，await 结束后统一 .clear()——
	// 防抖窗口内新写入的 key 被一起清掉，之后 early-return，永不落盘。
	const source = readCode("src/core/storage/StateManager.ts")
	const fnStart = source.indexOf("private async persistPendingState")
	assert.ok(fnStart > 0)
	const region = source.slice(fnStart, source.indexOf("public async flushPendingState", fnStart))
	const clear = region.indexOf(".clear()")
	const all = region.indexOf("await Promise.all")
	assert.ok(clear > 0 && all > 0 && clear < all, "必须先换出快照并清空字段，再 await 持久化")
})

test("#168b 持久化失败必须重试，不得只 log", () => {
	// 修复前 catch 里只清 timeout + 回调 onPersistenceError（仅 Logger.error），
	// 注释声称「自动重试」但没有任何重试——pending 数据滞留内存直到进程退出。
	const source = readCode("src/core/storage/StateManager.ts")
	const idx = source.indexOf("Failed to persist pending changes")
	assert.ok(idx > 0)
	const slice = source.slice(idx, idx + 600)
	assert.ok(slice.includes("scheduleDebouncedPersistence()"), "失败后必须重新调度重试")
})

test("#168c deactivate 必须 flush 防抖中的状态", () => {
	// 持久化有 500ms 防抖，任何状态写入后立刻关窗/重载会丢最后一批。
	const source = readCode("src/extension.ts")
	const deactivate = source.indexOf("export async function deactivate")
	assert.ok(deactivate > 0)
	const slice = source.slice(deactivate)
	assert.ok(slice.includes("flushPendingState"), "deactivate 必须落盘 pending state")
})

test("#169 checkoutBranch / createWorktree 的 ref 参数必须过 isSafeGitRef", () => {
	// 修复前 branch="--force" 原样进 simple-git args → git checkout --force 吞掉
	// 未提交更改；worktree add 同理。
	const checkout = readCode("src/core/controller/worktree/checkoutBranch.ts")
	const checkoutGuard = checkout.indexOf("isSafeGitRef(")
	const doCheckout = checkout.indexOf("git.checkout(")
	assert.ok(checkoutGuard > 0 && checkoutGuard < doCheckout, "checkoutBranch 必须先校验")
	const worktree = readCode("src/utils/git-worktree.ts")
	assert.ok(worktree.includes("isSafeGitRef("), "createWorktree 的 branch/baseBranch 必须校验")
})

test("#170 不得再跨窗口 rm 全局 tasks/checkpoints 目录", () => {
	// 修复前 deleteTasksWithIds 在「本窗口历史删光」时 rm 全局两个目录——窗口 B
	// 正在跑的任务数据被窗口 A 整体删掉；deleteAllTaskHistory 的 Delete Everything 同款。
	const deleteIds = readCode("src/core/controller/task/deleteTasksWithIds.ts")
	assert.ok(!deleteIds.includes('"checkpoints"'), "deleteTasksWithIds 不得再碰全局 checkpoints 目录（per-task 清理上方已完成）")
	const deleteAll = readCode("src/core/controller/task/deleteAllTaskHistory.ts")
	assert.ok(
		!/fs\.rm\(taskDirPath,\s*\{\s*recursive:\s*true/.test(deleteAll),
		"deleteAllTaskHistory 不得整目录 rm tasks/，只能按本窗口 task id 逐个删",
	)
	assert.ok(deleteAll.includes("hashWorkingDir"), "checkpoints 清理必须按本工作区 hash 收敛")
})

test("#171 McpHub 的 error 字段必须截断，不得无界追加", () => {
	// 修复前 .slice(0, 800) 被注释，stderr 每块含 "error" 的输出无限追加——内存
	// 无界增长，且每次 notifyWebviewOfServerChanges 全文推 webview。
	const source = readCode("src/services/mcp/McpHub.ts")
	// 修复前截断是行尾注释 `= newError //.slice(0, 800)`——探针必须要求真实的
	// 赋值形态，注释形态匹配不到。
	assert.ok(
		/connection\.server\.error = \w+\.slice\(0, 800\)/.test(source),
		"appendErrorMessage 必须恢复 800 字符截断（真实赋值，不是注释）",
	)
})

test("#169 补充：isSafeGitRef 必须是纯函数模块（无 vscode 依赖）", () => {
	const source = readCode("src/utils/git.ts")
	assert.ok(!source.includes("vscode"), "工具模块不得引入 vscode")
})
