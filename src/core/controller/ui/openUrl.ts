import type { StringRequest } from "@shared/proto/cline/common"
import { Empty } from "@shared/proto/cline/common"
import { Logger } from "@/shared/services/Logger"
import { isSafeExternalUrl } from "@/shared/url"
import { openUrlInBrowser } from "../../../utils/github-url-utils"
import type { Controller } from "../index"

/**
 * Opens a URL in the default browser
 * @param controller The controller instance
 * @param request The URL to open
 * @returns Empty response
 */
export async function openUrl(_controller: Controller, request: StringRequest): Promise<Empty> {
	const target = (request.value ?? "").trim()
	// #118/#143：白名单收敛到 @shared/url 单一来源（openInBrowser 同款闸）。
	// `openUrlInBrowser` 在 Windows 上走 `rundll32 url.dll,FileProtocolHandler`，
	// 它接受任意协议，等于把 webview 的请求变成一个本地程序启动器。
	if (!isSafeExternalUrl(target)) {
		Logger.warn(`[openUrl] 拒绝非 http(s) 协议或非法 URL：${target}`)
		return Empty.create({})
	}
	try {
		await openUrlInBrowser(target)
		return Empty.create({})
	} catch (error) {
		Logger.error(`Failed to open URL: ${error}`)
		throw error
	}
}
