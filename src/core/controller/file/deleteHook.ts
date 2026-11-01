import { DeleteHookRequest, DeleteHookResponse } from "@shared/proto/cline/file"
import fs from "fs/promises"
import { HookDiscoveryCache } from "../../hooks/HookDiscoveryCache"
import { isValidHookType, resolveExistingHookPath, resolveHooksDirectory, VALID_HOOK_TYPES } from "../../hooks/utils"
import { Controller } from ".."
import { refreshHooks } from "./refreshHooks"

export async function deleteHook(
	controller: Controller,
	request: DeleteHookRequest,
	globalHooksDirOverride?: string,
): Promise<DeleteHookResponse> {
	const { hookName, isGlobal, workspaceName } = request

	// #141：hookName 未经校验就 path.join(hooksDir, hookName + ".ps1")——`../x` 可
	// 穿越删任意文件。对照 createHook 补同款校验；发现阶段（refreshHooks）只按
	// VALID_HOOK_TYPES 建 toggle，UI 只会发合法名，加闸不误伤任何合法流程。
	if (!isValidHookType(hookName)) {
		throw new Error(`Invalid hook type: "${hookName}". Valid hook types are: ${VALID_HOOK_TYPES.join(", ")}`)
	}

	// Determine hook path
	const hooksDir = await resolveHooksDirectory(isGlobal, workspaceName, globalHooksDirOverride)
	const hookPath = await resolveExistingHookPath(hooksDir, hookName)

	// Verify hook exists before attempting deletion
	if (!hookPath) {
		throw new Error(`Hook ${hookName} does not exist in ${hooksDir}`)
	}

	// Delete the hook file
	await fs.unlink(hookPath)

	// Invalidate hook discovery cache
	await HookDiscoveryCache.getInstance().invalidateAll()

	// Return updated hooks state
	const hooksToggles = await refreshHooks(controller, undefined, globalHooksDirOverride)
	return DeleteHookResponse.create({ hooksToggles })
}
