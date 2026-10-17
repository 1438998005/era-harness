import { StringRequest } from "@shared/proto/cline/common"
import { McpDownloadResponse } from "@shared/proto/cline/mcp"
import { Controller } from ".."

/**
 * era harness 减法：MCP 市场（cline.bot 目录 + 一键下载安装）已移除。
 *
 * 保留 RPC 仅为协议兼容（webview 侧入口在批次 4 删除）。
 * 本地版添加 MCP 服务器的方式：手动编辑 mcp_settings.json 或在 MCP 面板中添加远程服务器。
 */
export async function downloadMcp(_controller: Controller, _request: StringRequest): Promise<McpDownloadResponse> {
	return McpDownloadResponse.create({
		mcpId: "",
		githubUrl: "",
		name: "",
		author: "",
		description: "",
		readmeContent: "",
		llmsInstallationContent: "",
		requiresApiKey: false,
		error: "MCP 市场已在 era harness 本地版中移除，请手动在 mcp_settings.json 中添加服务器",
	})
}
