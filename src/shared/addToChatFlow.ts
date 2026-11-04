/**
 * #209：资源管理器右键「添加到聊天」的编排逻辑（纯模块，依赖注入，可真跑行为测试）。
 *
 * 取证：右键菜单可能在侧栏从未打开时触发；`waitForSidebarVisible()` 只轮询等待，
 * 不会把侧栏带出来（webview 要可见才创建），而 `sendAddToInputEvent` 对空订阅集合
 * 是 Promise.all([]) 静默成功——旧实现用户点了完全没反应，也看不到任何报错。
 *
 * extension.ts 带 vscode 依赖，node:test 跑不了；这里把副作用全部注入，
 * 自动化测试能真跑「先打开侧栏 → 再等订阅 → 插 mention」的顺序与超时告警分支，
 * 而不只是断言源码里出现过某个函数名。
 */

export interface AddToChatTarget {
	readonly fsPath: string
	/** 是否为目录：文件夹 mention 要补尾斜杠。判定失败时按文件处理，不阻断插入。 */
	readonly isDirectory?: () => Promise<boolean>
}

export interface AddToChatDeps {
	/** 主动把侧栏带出来（不是 focus，是 show）。 */
	showWebview: () => Promise<unknown>
	/** 等 React 完成 addToInput 订阅；返回 false 代表超时。 */
	waitForVisible: () => Promise<boolean>
	toMention: (fsPath: string) => Promise<string>
	sendToInput: (text: string) => Promise<unknown>
	showWarning: (message: string) => void
	logWarning?: (message: string) => void
}

export interface AddToChatOutcome {
	readonly sent: boolean
	readonly ready: boolean
	readonly mentions: readonly string[]
}

export const NO_TARGET_WARNING = "未选中任何文件或文件夹。"
export const SIDEBAR_NOT_READY_WARNING = "聊天窗口还没准备好；如果输入框里没有出现引用，请点开左侧 era harness 图标后重试。"

export async function runAddResourcesToChat(targets: readonly AddToChatTarget[], deps: AddToChatDeps): Promise<AddToChatOutcome> {
	if (targets.length === 0) {
		deps.showWarning(NO_TARGET_WARNING)
		return { sent: false, ready: false, mentions: [] }
	}

	// 只轮询等待永远不会就绪：必须先主动带出侧栏，再等 webview 完成订阅。
	await deps.showWebview()
	const ready = await deps.waitForVisible()
	if (!ready) {
		deps.logWarning?.("[addResourcesToChat] 等待聊天窗口可见超时")
		deps.showWarning(SIDEBAR_NOT_READY_WARNING)
	}

	const mentions: string[] = []
	for (const target of targets) {
		let mention = await deps.toMention(target.fsPath)
		// 尾斜杠决定 parseMentions 的 <folder_content> 标签与提示文案；
		// 内容读取本身走 fs.stat 兜底，所以这里拿不到目录信息也照样插入。
		if ((await target.isDirectory?.()) === true && !mention.endsWith("/")) {
			mention += "/"
		}
		mentions.push(mention)
	}
	await deps.sendToInput(mentions.join("\n"))
	return { sent: true, ready, mentions }
}
