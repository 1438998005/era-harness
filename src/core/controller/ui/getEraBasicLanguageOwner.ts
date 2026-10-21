import type { EmptyRequest, String as StringMessage } from "@shared/proto/cline/common"
import { String as StringValue } from "@shared/proto/cline/common"
import * as vscode from "vscode"
import type { Controller } from "../index"

/**
 * 读取 EraBasic 语言归属（`era` / `sasami`），供设置页画二选一选中态。
 * 写入仍走 runCommand → 扩展命令，保证「设置 + files.associations」由同一段代码维护。
 */
export async function getEraBasicLanguageOwner(_controller: Controller, _request: EmptyRequest): Promise<StringMessage> {
	const value = vscode.workspace.getConfiguration("eraHarness.erabasic").get<string>("languageOwner", "era")
	return StringValue.create({ value: value === "sasami" ? "sasami" : "era" })
}
