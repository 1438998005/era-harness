import { VcsType, WorkspaceRoot } from "@shared/multi-root/types"
import * as path from "path"
import { HostProvider } from "@/hosts/host-provider"
import { getLatestGitCommitHash, isGitRepository } from "@/utils/git"

/**
 * Detect the VCS type for a given directory path.
 * Currently supports Git; returns None otherwise.
 */
export async function detectVcs(dirPath: string): Promise<VcsType> {
	try {
		const isGit = await isGitRepository(dirPath)
		return isGit ? VcsType.Git : VcsType.None
	} catch {
		return VcsType.None
	}
}

/**
 * Detect workspace roots from the host editor (VS Code, etc.).
 *
 * era harness 只认用户真正打开的文件夹：没有工作区时返回空数组，
 * 不再退回「桌面」这种隐式目录（那会让模型在用户不知情的位置读写文件）。
 */
export async function detectWorkspaceRoots(): Promise<WorkspaceRoot[]> {
	const workspacePaths = await HostProvider.workspace.getWorkspacePaths({})

	if (!workspacePaths.paths || workspacePaths.paths.length === 0) {
		return []
	}

	// Convert workspace paths to WorkspaceRoots
	const roots: WorkspaceRoot[] = []
	for (const workspacePath of workspacePaths.paths) {
		const vcs = await detectVcs(workspacePath)
		roots.push({
			path: workspacePath,
			name: path.basename(workspacePath),
			vcs,
			commitHash: vcs === VcsType.Git ? (await getLatestGitCommitHash(workspacePath)) || undefined : undefined,
		})
	}

	return roots
}
