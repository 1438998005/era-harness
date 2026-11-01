import { CheckoutBranchRequest, WorktreeResult } from "@shared/proto/cline/worktree"
import { getWorkspacePath } from "@utils/path"
import simpleGit from "simple-git"
import { isSafeGitRef } from "@/utils/git"
import { Controller } from ".."

/**
 * Checks out a branch in the current worktree (git checkout)
 * @param controller The controller instance
 * @param request The checkout branch request containing the branch name
 * @returns WorktreeResult indicating success or failure
 */
export async function checkoutBranch(_controller: Controller, request: CheckoutBranchRequest): Promise<WorktreeResult> {
	const cwd = await getWorkspacePath()
	if (!cwd) {
		return WorktreeResult.create({
			success: false,
			message: "No workspace folder found",
		})
	}

	const { branch } = request

	if (!branch) {
		return WorktreeResult.create({
			success: false,
			message: "Branch name is required",
		})
	}

	// #169：branch 原样进 simple-git 的 args——`--force` 会被 git 当 flag 解析，
	// 静默吞掉工作区未提交的更改。
	if (!isSafeGitRef(branch)) {
		return WorktreeResult.create({
			success: false,
			message: `Invalid branch name: ${branch}`,
		})
	}

	try {
		const git = simpleGit(cwd)
		await git.checkout(branch)

		return WorktreeResult.create({
			success: true,
			message: `Switched to branch '${branch}'`,
		})
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		return WorktreeResult.create({
			success: false,
			message: `Failed to checkout branch: ${errorMessage}`,
		})
	}
}
