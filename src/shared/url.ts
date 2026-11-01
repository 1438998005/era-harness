/**
 * #143：webview 请求「用浏览器打开」的协议白名单（单一来源）。
 *
 * Windows 上 `rundll32 url.dll,FileProtocolHandler` 与 `open` 包都接受任意协议
 * （`file:` / `ms-msdt:` / `vscode:` ...），不设白名单等于把 webview 的请求变成
 * 一个本地程序启动器——#118 在 openUrl 踩过，#143 在 openInBrowser 补齐同款闸。
 * 两个入口共用这一个清单，防止两份漂移（#94/#113 的判据漂移教训）。
 */
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"])

export function isSafeExternalUrl(url: string): boolean {
	try {
		return ALLOWED_PROTOCOLS.has(new URL(url).protocol)
	} catch {
		return false
	}
}
