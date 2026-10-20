import { HostProvider } from "@/hosts/host-provider"

function normalize(value: string): string {
	return value.replace(/\\/g, "/").toLowerCase()
}

/**
 * 多根工作区里除主根之外的其它根，用作「额外扫描起点」。
 *
 * 只解决一个问题：用户在 A 根里开着对话，但游戏在 B 根里。
 * 拿不到工作区列表（单根 / 测试环境 / HostProvider 未初始化）时返回空数组，
 * 调用方自然退回单根行为，不需要另外判断。
 */
export async function getExtraWorkspaceRoots(primaryCwd: string | undefined): Promise<string[]> {
	try {
		const { paths } = await HostProvider.workspace.getWorkspacePaths({})
		if (!paths || paths.length === 0) {
			return []
		}
		const primary = primaryCwd ? normalize(primaryCwd) : ""
		return paths.filter((candidate) => candidate && normalize(candidate) !== primary)
	} catch {
		return []
	}
}
