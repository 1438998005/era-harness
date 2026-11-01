import { getSkillsDirectoriesForScan } from "@core/storage/disk"
import { DeleteSkillRequest, SkillsToggles } from "@shared/proto/cline/file"
import fs from "fs/promises"
import path from "path"
import { HostProvider } from "@/hosts/host-provider"
import { Logger } from "@/shared/services/Logger"
import { fileExistsAtPath } from "@/utils/fs"
import { Controller } from ".."

/**
 * Deletes an existing skill directory
 * @param controller The controller instance
 * @param request The request containing skill path and isGlobal flag
 * @returns The updated skills toggles
 */
export async function deleteSkillFile(controller: Controller, request: DeleteSkillRequest): Promise<SkillsToggles> {
	const { skillPath, isGlobal } = request

	if (!skillPath || typeof skillPath !== "string" || typeof isGlobal !== "boolean") {
		Logger.error("deleteSkillFile: Missing or invalid parameters", {
			skillPath: typeof skillPath === "string" ? skillPath : `Invalid: ${typeof skillPath}`,
			isGlobal: typeof isGlobal === "boolean" ? isGlobal : `Invalid: ${typeof isGlobal}`,
		})
		throw new Error("Missing or invalid parameters for deleteSkillFile")
	}

	// Get the skill directory (skillPath points to SKILL.md, so get parent)
	const skillDir = path.dirname(skillPath)

	// #139：skillPath 来自 webview，此前只查非空——dirname 之后直接 recursive rm
	// 等于把「删一个 skill」放大成「删任意目录」。skills 的合法根只有扫描清单里
	// 那几个（与发现/创建共用同一来源），白名单外一律拒绝。
	const workspacePaths = await HostProvider.workspace.getWorkspacePaths({})
	const roots = getSkillsDirectoriesForScan(workspacePaths.paths[0] ?? "")
	const insideSkillRoot = roots.some((root) => {
		const rel = path.relative(root.path, skillDir)
		return rel !== "" && rel !== ".." && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel)
	})
	if (!insideSkillRoot) {
		Logger.warn(`deleteSkillFile: Refusing to delete outside skills directories: ${skillDir}`)
		throw new Error(`Refusing to delete a directory outside the skills directories: ${skillDir}`)
	}

	// Verify the path exists
	if (!(await fileExistsAtPath(skillDir))) {
		Logger.warn(`deleteSkillFile: Skill directory not found: ${skillDir}`)
		// Return current toggles anyway
		const globalToggles = controller.stateManager.getGlobalSettingsKey("globalSkillsToggles") || {}
		const localToggles = controller.stateManager.getWorkspaceStateKey("localSkillsToggles") || {}
		return SkillsToggles.create({
			globalSkillsToggles: globalToggles,
			localSkillsToggles: localToggles,
		})
	}

	// Delete the skill directory
	await fs.rm(skillDir, { recursive: true, force: true })

	// Remove from toggles
	let globalToggles = controller.stateManager.getGlobalSettingsKey("globalSkillsToggles") || {}
	let localToggles = controller.stateManager.getWorkspaceStateKey("localSkillsToggles") || {}

	if (isGlobal) {
		const { [skillPath]: _, ...remaining } = globalToggles
		globalToggles = remaining
		controller.stateManager.setGlobalState("globalSkillsToggles", globalToggles)
	} else {
		const { [skillPath]: _, ...remaining } = localToggles
		localToggles = remaining
		controller.stateManager.setWorkspaceState("localSkillsToggles", localToggles)
	}

	await controller.postStateToWebview()

	return SkillsToggles.create({
		globalSkillsToggles: globalToggles,
		localSkillsToggles: localToggles,
	})
}
