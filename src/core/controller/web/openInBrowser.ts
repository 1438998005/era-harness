import { Empty, StringRequest } from "@shared/proto/cline/common"
import { openExternal } from "@utils/env"
import { Logger } from "@/shared/services/Logger"
import { isSafeExternalUrl } from "@/shared/url"
import { Controller } from ".."

/**
 * Opens a URL in the user's default browser
 * @param controller The controller instance
 * @param request The URL to open
 * @returns Empty response since the client doesn't need a return value
 */
export async function openInBrowser(_controller: Controller, request: StringRequest): Promise<Empty> {
	try {
		if (request.value) {
			// #143：webview 可达的打开入口必须过协议白名单（单一来源 @shared/url）；
			// hostbridge RPC 失败时 openExternal 还会回落到接受任意 scheme 的 `open`
			// 包，所以闸必须在这一层、且先于 openExternal。
			if (!isSafeExternalUrl(request.value)) {
				Logger.warn(`[openInBrowser] 拒绝非 http(s) 协议或非法 URL：${request.value}`)
				return Empty.create()
			}
			await openExternal(request.value)
		}
		return Empty.create()
	} catch (error) {
		Logger.error("Error opening URL in browser:", error)
		return Empty.create()
	}
}
