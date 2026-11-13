/**
 * KB 08 #258：编码写回纪律的两条回归——
 * ① 拒绝修改（revertChanges）后磁盘必须逐字节等于 open() 时的原始字节（宿主 saveDocument
 *    按 UTF-8 落盘也不能毁掉 CP932 原编码）；
 * ② 保存前的编辑器文本必须先做目标编码往返检查——编辑器按 CP932 落盘时不可表示字符
 *    已变 '？'（合法 CP932），只看磁盘字节发现不了丢字。
 *
 * 编辑器替身：DiffViewProvider 是抽象基类（无 vscode 直接依赖），这里用一个最小具体子类
 * 模拟「宿主按指定编码保存」——saveEncoding=cp932 时 iconv.encode 用 '?' 替换不可表示字符，
 * 与 VS Code 行为一致。真实 GUI 验收由用户执行（KB 08 #258 销项判据）。
 */

import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import * as iconv from "iconv-lite"
import { HostProvider } from "../../src/hosts/host-provider"
import { DiffViewProvider } from "../../src/integrations/editor/DiffViewProvider"

// 测试宿主：workspace 提供 getCwd / 诊断，window 兜 openFile；其余 creator 不会被调用。
// CWD 由各测试在 open() 前指向自己的临时目录（getCwd 从这里取第一个路径）。
let CWD = ""
HostProvider.initialize(
	(() => {
		throw new Error("not available in tests")
	}) as any,
	(() => {
		throw new Error("not available in tests")
	}) as any,
	(() => {
		throw new Error("not available in tests")
	}) as any,
	(() => {
		throw new Error("not available in tests")
	}) as any,
	{
		workspaceClient: {
			getWorkspacePaths: async () => ({ paths: [CWD] }),
			saveOpenDocumentIfDirty: async () => ({}),
			getDiagnostics: async () => ({ fileDiagnostics: [] }),
		},
		envClient: {},
		windowClient: {
			showTextDocument: async () => ({}),
			showMessage: async () => ({}),
			openFile: async () => ({}),
		},
		diffClient: {},
	} as any,
	() => {},
	async () => "",
	async () => "",
	".",
	".",
)

/** 最小编辑器替身：文档存内存，保存按 saveEncoding 落盘（CP932 时不可表示字符变 '?'） */
class StubDiffViewProvider extends DiffViewProvider {
	/** 编辑器文档的当前文本 */
	docText = ""
	/** 宿主保存编码：模拟「编辑器 settings 里 files.encoding 指向该编码」 */
	saveEncoding: "utf8" | "cp932" = "utf8"
	/** 编辑器自己这次保存后的 mtime（用于断言 enforceWriteEncoding 没有再重写） */
	mtimeAfterEditorSave?: number
	/** 模拟宿主 formatOnSave：保存时编辑器先改写文档（追加标记行）再落盘（KB 08 #264） */
	formatOnSave = false

	protected async openDiffEditor(): Promise<void> {
		this.docText = this.originalContent ?? ""
	}
	protected async scrollEditorToLine(): Promise<void> {}
	protected async scrollAnimation(): Promise<void> {}
	protected async truncateDocument(lineNumber: number): Promise<void> {
		this.docText = this.docText.split("\n").slice(0, lineNumber).join("\n")
	}
	protected async getDocumentLineCount(): Promise<number> {
		return this.docText.split("\n").length
	}
	protected async getDocumentText(): Promise<string | undefined> {
		return this.docText
	}
	protected async saveDocument(): Promise<boolean> {
		if (this.formatOnSave) {
			this.docText = `${this.docText}// formatted-by-editor\r\n`
		}
		const bytes = this.saveEncoding === "cp932" ? iconv.encode(this.docText, "cp932") : Buffer.from(this.docText, "utf8")
		await fs.writeFile(this.absolutePath!, bytes)
		this.mtimeAfterEditorSave = (await fs.stat(this.absolutePath!)).mtimeMs
		return true
	}
	protected async closeAllDiffViews(): Promise<void> {}
	protected async resetDiffView(): Promise<void> {}
	async replaceText(content: string): Promise<void> {
		this.docText = content
	}
}

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), "era-diff-enc-"))
	CWD = dir
	try {
		await run(dir)
	} finally {
		CWD = ""
		await fs.rm(dir, { recursive: true, force: true })
	}
}

test("拒绝修改后磁盘逐字节还原：CP932 原文件不被宿主的 UTF-8 保存毁掉（KB 08 #258）", async () => {
	await withTempDir(async (dir) => {
		const rel = "ERB/A.ERB"
		const abs = path.join(dir, "ERB", "A.ERB")
		await fs.mkdir(path.dirname(abs), { recursive: true })
		// 原文件：CP932 无 BOM、CRLF（eraTW 工程的典型形态）
		const originalBytes = iconv.encode("ログ: テスト表示\r\n", "cp932")
		await fs.writeFile(abs, originalBytes)

		const provider = new StubDiffViewProvider()
		provider.editType = "modify"
		provider.saveEncoding = "utf8" // 宿主按 UTF-8 保存——正是毁编码的场景
		await provider.open(rel)
		await provider.update("新しいメッセージ\r\n", true)

		await provider.revertChanges()

		const after = await fs.readFile(abs)
		assert.ok(after.equals(originalBytes), "拒绝修改后磁盘必须与原始字节逐字节一致（编码/BOM/行尾原样）")
		assert.equal(iconv.decode(after, "cp932"), "ログ: テスト表示\r\n")
	})
})

test("保存前往返检查：CP932 目标下不可表示字符检出并降级 UTF-8+BOM，不再静默丢字（KB 08 #258）", async () => {
	await withTempDir(async (dir) => {
		const rel = "ERB/B.ERB"
		const abs = path.join(dir, "ERB", "B.ERB")
		await fs.mkdir(path.dirname(abs), { recursive: true })
		await fs.writeFile(abs, iconv.encode("旧メッセージ\r\n", "cp932"))

		const provider = new StubDiffViewProvider()
		provider.editType = "modify"
		provider.saveEncoding = "cp932" // 编辑器按 CP932 保存：emoji 落盘前已变 '？'
		await provider.open(rel)
		const newContent = "メッセージ: 追加 😀\r\n"
		await provider.update(newContent, true)

		const result = await provider.saveChanges()

		assert.ok(result.encodingNote?.includes("降级"), `必须如实出编码 note：${result.encodingNote}`)
		const after = await fs.readFile(abs)
		assert.deepEqual([...after.subarray(0, 3)], [0xef, 0xbb, 0xbf], "降级目标 = UTF-8 带 BOM")
		assert.ok(iconv.decode(after, "utf8").includes("😀"), "emoji 必须保住，不得变成 '？'")
	})
})

test("往返检查不误伤：CP932 全可表示的正常编辑保持原形态、无 note、不重写（mtime 不动）", async () => {
	await withTempDir(async (dir) => {
		const rel = "ERB/C.ERB"
		const abs = path.join(dir, "ERB", "C.ERB")
		await fs.mkdir(path.dirname(abs), { recursive: true })
		const originalBytes = iconv.encode("一行目\r\n二行目\r\n", "cp932")
		await fs.writeFile(abs, originalBytes)

		const provider = new StubDiffViewProvider()
		provider.editType = "modify"
		provider.saveEncoding = "cp932"
		await provider.open(rel)
		await provider.update("一行目改\r\n二行目\r\n", true)

		const result = await provider.saveChanges()

		assert.equal(result.encodingNote, undefined, "符合判据时不得制造噪音")
		const after = await fs.readFile(abs)
		assert.ok(after.equals(iconv.encode("一行目改\r\n二行目\r\n", "cp932")), "正常编辑保持 CP932 无 BOM CRLF")
		assert.equal(
			(await fs.stat(abs)).mtimeMs,
			provider.mtimeAfterEditorSave,
			"形态已正确时 enforce 不得再重写（mtime 是引擎懒加载索引用的）",
		)
	})
})

test("保存时自动格式化 + CP932 降级叠加：格式化成果不得被编码重写抹掉（KB 08 #264）", async () => {
	await withTempDir(async (dir) => {
		const rel = "ERB/D.ERB"
		const abs = path.join(dir, "ERB", "D.ERB")
		await fs.mkdir(path.dirname(abs), { recursive: true })
		await fs.writeFile(abs, iconv.encode("旧メッセージ\r\n", "cp932"))

		const provider = new StubDiffViewProvider()
		provider.editType = "modify"
		provider.saveEncoding = "cp932"
		provider.formatOnSave = true // 保存时编辑器改写文档（追加标记行）
		await provider.open(rel)
		await provider.update("メッセージ: 追加 😀\r\n", true)

		const result = await provider.saveChanges()

		assert.ok(result.encodingNote?.includes("降级"), `必须如实出编码 note：${result.encodingNote}`)
		const after = await fs.readFile(abs)
		assert.deepEqual([...after.subarray(0, 3)], [0xef, 0xbb, 0xbf], "降级目标 = UTF-8 带 BOM")
		const text = iconv.decode(after, "utf8")
		assert.ok(text.includes("😀"), "emoji 必须保住")
		assert.ok(
			text.includes("// formatted-by-editor"),
			"保存时的格式化成果必须落盘（修复前用保存前文本重写磁盘，标记行被抹掉）",
		)
	})
})

test("open() 的 create 分支清空 originalBytes：同实例复用不得残留上一文件的字节（KB 08 #265）", async () => {
	await withTempDir(async (dir) => {
		await fs.mkdir(path.join(dir, "ERB"), { recursive: true })
		await fs.writeFile(path.join(dir, "ERB", "A2.ERB"), iconv.encode("A の中身\r\n", "cp932"))

		const provider = new StubDiffViewProvider()
		provider.editType = "modify"
		await provider.open("ERB/A2.ERB")
		assert.ok((provider as any).originalBytes, "前置：modify 打开后必须已捕获原始字节")

		// 异常复用路径：不经过 reset，同一实例改 create 打开尚不存在的新文件
		provider.editType = "create"
		await provider.open("ERB/B2.ERB")

		assert.equal((provider as any).originalBytes, undefined, "create 分支必须清空 originalBytes（修复前残留 A2 的字节）")
		assert.equal((provider as any).originalFacts, undefined, "与 originalFacts 同口径")
	})
})
