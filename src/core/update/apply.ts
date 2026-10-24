/**
 * eratw 一键更新 —— 执行与回滚（唯一会真正改用户文件的模块）。
 *
 * 铁律（任何改动都必须先满足这三条）：
 * 1. **写前必备份**：每个被覆盖/被删除的原文件先进 `_备份/update_backup_…/files/`，
 *    并且 `manifest.json` 在动第一个文件之前就落盘（崩溃也能人工恢复）。
 * 2. **失败必回滚**：任何一步出错，把已改的全部还原，并报告"什么都没变"。
 * 3. **只碰计划内路径**：受保护前缀（sav/_备份/.era-harness）与越界路径一律拒绝。
 *
 * 两种取内容的方式，共用同一套备份/回滚机制：
 * - `applyPlan`：由调用方按路径提供字节（本地目录源 / 少量文件）
 * - `applyPlanFromTar`：流式读归档，只写计划内的条目（650MB 不落临时解压目录）
 */

import fs from "node:fs/promises"
import path from "node:path"
import { hashLocalFile, isProtectedPath, statePath, toFsPath, winLongPath } from "./manifest"
import { extractTar } from "./tarball"
import type { PlanEntry, RelPath, UpdatePlan } from "./types"
import { STATE_DIR, STATE_FILE } from "./types"

export type BackupStatus = "applying" | "done" | "rolled-back"

export interface ManifestAction {
	path: RelPath
	action: "write" | "delete"
	/** 改动前是否存在 */
	existed: boolean
	beforeSha1: string | null
	afterSha1: string | null
}

export interface BackupManifest {
	schemaVersion: 1
	/** 游戏根绝对路径（回滚时校验，防止备份目录被搬走后误还原到别处） */
	root: string
	label: string
	createdAt: string
	status: BackupStatus
	source: { commit?: string; nowVersion?: string }
	actions: ManifestAction[]
}

export interface ApplyOptions {
	root: string
	plan: UpdatePlan
	/** 备份目录名后缀，例如 `develop20261017` */
	label: string
	/** 备份根目录，默认 `<root>/_备份` */
	backupRoot?: string
	/** 更新前状态快照，原样写进 `state-before.json` */
	stateBefore?: unknown
	source?: { commit?: string; nowVersion?: string }
	/** 备份保留策略之外的只读演练：只做预检与备份，不写盘 */
	dryRun?: boolean
	/**
	 * 内容覆盖：这些路径不取上游原文，直接写这里给的字节。
	 * 用途是「AI 合并后的结果」—— 它既不是本地版本也不是上游版本，
	 * 归档里当然找不到。键必须同时出现在 `plan` 的 write 条目里。
	 */
	overrides?: Map<RelPath, Buffer>
	/**
	 * 逐个动作的进度回调。
	 * `action` 让调用方能分清"正在写入"和"正在删掉"——两者文案不能说反，
	 * 否则用户会以为刚删掉的旧文件又被写回来了。
	 */
	onProgress?: (done: number, total: number, current: string, action: "write" | "delete") => void
	/** 测试注入：执行到第 N 个动作后故意抛错，用于验证回滚 */
	failAfter?: number
}

export interface ApplyReport {
	ok: boolean
	backupDir: string | null
	written: number
	deleted: number
	bytesWritten: number
	errors: Array<{ path: string; message: string }>
	/**
	 * 自动回滚的结果：true = 磁盘已完整恢复原状；
	 * false = 回滚本身也出了错（磁盘可能停在半更新状态，UI 必须如实告诉用户，
	 * 不能再说"什么都没变"——那是 U2 踩过的谎报）。
	 */
	rolledBack: boolean
	skipped: number
}

export interface RollbackReport {
	ok: boolean
	restored: number
	removed: number
	errors: Array<{ path: string; message: string }>
}

function pad2(n: number): string {
	return String(n).padStart(2, "0")
}

/** 备份目录名的固定前缀：`backupDirName()` 生成，`rollbackFromBackup()` 校验 */
export const BACKUP_DIR_PREFIX = "update_backup_"

/** `update_backup_20261018_develop20261017`（沿用用户既有备份命名习惯） */
export function backupDirName(label: string, date = new Date()): string {
	const stamp = `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}_${pad2(date.getHours())}${pad2(date.getMinutes())}`
	return `${BACKUP_DIR_PREFIX}${stamp}_${label}`
}

function isInsideRoot(root: string, rel: RelPath): boolean {
	if (rel.startsWith("/") || /^[a-zA-Z]:/.test(rel) || rel.split("/").includes("..")) {
		return false
	}
	const abs = path.resolve(root, ...rel.split("/"))
	const normalizedRoot = path.resolve(root)
	const withSep = normalizedRoot.endsWith(path.sep) ? normalizedRoot : `${normalizedRoot}${path.sep}`
	return abs.startsWith(withSep)
}

/** 计划里真正要动盘的动作 */
function actionableEntries(plan: UpdatePlan): PlanEntry[] {
	return plan.entries.filter((e) => e.action === "write" || e.action === "delete")
}

async function fileExists(abs: string): Promise<boolean> {
	try {
		await fs.stat(winLongPath(abs))
		return true
	} catch {
		return false
	}
}

async function freeSpace(dir: string): Promise<number | null> {
	try {
		const stats = await fs.statfs(dir)
		return stats.bavail * stats.bsize
	} catch {
		return null
	}
}

class Applier {
	private readonly actions: PlanEntry[]
	private readonly backupDir: string
	private readonly manifest: BackupManifest
	private written = 0
	private deleted = 0
	private bytesWritten = 0
	private errors: Array<{ path: string; message: string }> = []
	private ops = 0

	constructor(private readonly opts: ApplyOptions) {
		this.actions = actionableEntries(opts.plan)
		const backupRoot = opts.backupRoot ?? path.join(opts.root, "_备份")
		this.backupDir = path.join(backupRoot, backupDirName(opts.label))
		this.manifest = {
			schemaVersion: 1,
			root: path.resolve(opts.root),
			label: opts.label,
			createdAt: new Date().toISOString(),
			status: "applying",
			source: opts.source ?? {},
			actions: [],
		}
	}

	get total(): number {
		return this.actions.length
	}

	get backupPath(): string {
		return this.backupDir
	}

	get writtenCount(): number {
		return this.written
	}

	/** 预检：路径合法性、磁盘空间。任何一条不过就直接抛错，一个字节都不写 */
	async preflight(): Promise<void> {
		for (const entry of this.actions) {
			if (!isInsideRoot(this.opts.root, entry.path)) {
				throw new Error(`拒绝执行：路径越界 ${entry.path}`)
			}
			if (isProtectedPath(entry.path)) {
				throw new Error(`拒绝执行：受保护路径 ${entry.path}`)
			}
		}

		// 备份体积 ≈ 所有受影响文件的旧大小；写入时的临时文件与旧文件并存，再留 50% 余量
		let need = 0
		for (const entry of this.actions) {
			need += (await this.localSize(entry.path)) ?? 0
		}
		const free = await freeSpace(this.opts.root)
		if (free !== null && need > 0 && free < need * 1.5) {
			throw new Error(
				`磁盘空间不足：约需 ${Math.ceil((need * 1.5) / 1024 / 1024)} MB，剩余 ${Math.floor(free / 1024 / 1024)} MB`,
			)
		}
	}

	private async localSize(rel: RelPath): Promise<number | null> {
		try {
			const stat = await fs.stat(winLongPath(toFsPath(this.opts.root, rel)))
			return stat.size
		} catch {
			return null
		}
	}

	/** 备份所有将被覆盖/删除的文件，并在动第一个文件之前落盘 manifest */
	async backup(): Promise<void> {
		await fs.mkdir(path.join(this.backupDir, "files"), { recursive: true })

		for (const entry of this.actions) {
			const abs = toFsPath(this.opts.root, entry.path)
			const exists = await fileExists(abs)
			let beforeSha1: string | null = null
			if (exists) {
				beforeSha1 = (await hashLocalFile(abs)).sha1
				const dest = path.join(this.backupDir, "files", ...entry.path.split("/"))
				await fs.mkdir(path.dirname(winLongPath(dest)), { recursive: true })
				await fs.copyFile(winLongPath(abs), winLongPath(dest))
			}
			this.manifest.actions.push({
				path: entry.path,
				action: entry.action as "write" | "delete",
				existed: exists,
				beforeSha1,
				afterSha1: entry.theirsSha1 ?? null,
			})
		}

		if (this.opts.stateBefore !== undefined) {
			await fs.writeFile(
				path.join(this.backupDir, "state-before.json"),
				JSON.stringify(this.opts.stateBefore, null, 2),
				"utf8",
			)
		}
		await this.writeManifest()
	}

	private async writeManifest(): Promise<void> {
		const target = path.join(this.backupDir, "manifest.json")
		const tmp = `${target}.tmp`
		await fs.writeFile(tmp, JSON.stringify(this.manifest, null, 2), "utf8")
		await fs.rename(tmp, target)
	}

	private tick(rel: RelPath, action: "write" | "delete"): void {
		this.ops++
		if (this.opts.failAfter !== undefined && this.ops > this.opts.failAfter) {
			throw new Error(`注入失败（第 ${this.ops} 个动作）`)
		}
		this.opts.onProgress?.(this.ops, this.actions.length, rel, action)
	}

	/** 原子写：同目录临时文件 + rename，避免半截文件 */
	async writeFile(rel: RelPath, content: Buffer): Promise<void> {
		const abs = toFsPath(this.opts.root, rel)
		const dir = path.dirname(abs)
		await fs.mkdir(winLongPath(dir), { recursive: true })
		const tmp = path.join(dir, `${path.basename(abs)}.era-harness.tmp`)
		await fs.writeFile(winLongPath(tmp), content)
		await fs.rename(winLongPath(tmp), winLongPath(abs))
		this.written++
		this.bytesWritten += content.length
		this.tick(rel, "write")
	}

	async deleteFile(rel: RelPath): Promise<void> {
		await fs.unlink(winLongPath(toFsPath(this.opts.root, rel)))
		this.deleted++
		this.tick(rel, "delete")
	}

	/**
	 * 流式写入：边收边落盘，避免把大文件（resources 里的图）整块塞进内存。
	 * 仍然走"同目录临时文件 + rename"，所以对用户而言是原子的。
	 */
	async beginStreamedWrite(rel: RelPath): Promise<{
		write: (chunk: Buffer) => Promise<void>
		commit: () => Promise<void>
		abort: () => Promise<void>
	}> {
		const abs = toFsPath(this.opts.root, rel)
		const dir = path.dirname(abs)
		await fs.mkdir(winLongPath(dir), { recursive: true })
		const tmp = path.join(dir, `${path.basename(abs)}.era-harness.tmp`)
		const handle = await fs.open(winLongPath(tmp), "w")
		let bytes = 0
		let closed = false
		return {
			write: async (chunk: Buffer) => {
				await handle.write(chunk)
				bytes += chunk.length
			},
			commit: async () => {
				if (closed) {
					return
				}
				closed = true
				await handle.close()
				await fs.rename(winLongPath(tmp), winLongPath(abs))
				this.written++
				this.bytesWritten += bytes
				this.tick(rel, "write")
			},
			abort: async () => {
				if (!closed) {
					closed = true
					try {
						await handle.close()
					} catch {
						// 已经关了就算了
					}
				}
				try {
					await fs.unlink(winLongPath(tmp))
				} catch {
					// 临时文件可能还没创建成功
				}
			},
		}
	}

	/** 计划里要写的路径集合（流式归档模式用来过滤） */
	writeSet(): Set<RelPath> {
		return new Set(this.actions.filter((e) => e.action === "write").map((e) => e.path))
	}

	deleteList(): RelPath[] {
		return this.actions.filter((e) => e.action === "delete").map((e) => e.path)
	}

	skippedCount(): number {
		return this.opts.plan.entries.filter((e) => e.action === "keep" || e.action === "conflict").length
	}

	async finish(): Promise<ApplyReport> {
		this.manifest.status = "done"
		await this.writeManifest()
		return {
			ok: true,
			backupDir: this.backupDir,
			written: this.written,
			deleted: this.deleted,
			bytesWritten: this.bytesWritten,
			errors: this.errors,
			rolledBack: false,
			skipped: this.skippedCount(),
		}
	}

	/** 回滚：写过的还原（原本不存在的删掉），删掉的从备份拷回 */
	async rollback(): Promise<void> {
		this.errors = []
		for (const action of [...this.manifest.actions].reverse()) {
			const abs = toFsPath(this.opts.root, action.path)
			try {
				if (action.existed) {
					const src = path.join(this.backupDir, "files", ...action.path.split("/"))
					await fs.mkdir(path.dirname(winLongPath(abs)), { recursive: true })
					await fs.copyFile(winLongPath(src), winLongPath(abs))
				} else if (await fileExists(abs)) {
					await fs.unlink(winLongPath(abs))
				}
			} catch (error) {
				this.errors.push({ path: action.path, message: (error as Error).message })
			}
		}
		this.manifest.status = "rolled-back"
		try {
			await this.writeManifest()
		} catch {
			// 回滚阶段的 manifest 写失败不应掩盖回滚结果
		}
	}

	failedReport(error: unknown): ApplyReport {
		// rollback() 开头会清空 errors，所以这里的 this.errors 只剩回滚阶段的错误：
		// 有残留 = 没恢复干净，必须如实报 false，让 UI 说"需要手动处理"而不是谎报原状
		return {
			ok: false,
			backupDir: this.backupDir,
			written: 0,
			deleted: 0,
			bytesWritten: 0,
			errors: [...this.errors, { path: "", message: (error as Error).message }],
			rolledBack: this.errors.length === 0,
			skipped: this.skippedCount(),
		}
	}
}

/** 由调用方按路径提供内容（目录源、少量文件） */
export async function applyPlan(
	opts: ApplyOptions & { provide: (rel: RelPath) => Promise<Buffer> | Buffer },
): Promise<ApplyReport> {
	const applier = new Applier(opts)
	await applier.preflight()
	if (applier.total === 0) {
		return {
			ok: true,
			backupDir: null,
			written: 0,
			deleted: 0,
			bytesWritten: 0,
			errors: [],
			rolledBack: false,
			skipped: applier.skippedCount(),
		}
	}
	if (opts.dryRun) {
		// 演练：只跑预检，不备份、不写盘
		return {
			ok: true,
			backupDir: null,
			written: 0,
			deleted: 0,
			bytesWritten: 0,
			errors: [],
			rolledBack: false,
			skipped: applier.skippedCount(),
		}
	}
	await applier.backup()

	try {
		for (const entry of actionableEntries(opts.plan)) {
			if (entry.action === "write") {
				const override = opts.overrides?.get(entry.path)
				await applier.writeFile(entry.path, override ?? (await opts.provide(entry.path)))
			} else {
				await applier.deleteFile(entry.path)
			}
		}
	} catch (error) {
		await applier.rollback()
		return applier.failedReport(error)
	}

	return applier.finish()
}

/** 流式读归档，只写计划内的条目（650MB 不产生临时解压目录） */
export async function applyPlanFromTar(opts: ApplyOptions & { stream: AsyncIterable<Buffer> }): Promise<ApplyReport> {
	const applier = new Applier(opts)
	await applier.preflight()
	if (applier.total === 0) {
		return {
			ok: true,
			backupDir: null,
			written: 0,
			deleted: 0,
			bytesWritten: 0,
			errors: [],
			rolledBack: false,
			skipped: applier.skippedCount(),
		}
	}
	if (opts.dryRun) {
		return {
			ok: true,
			backupDir: null,
			written: 0,
			deleted: 0,
			bytesWritten: 0,
			errors: [],
			rolledBack: false,
			skipped: applier.skippedCount(),
		}
	}
	await applier.backup()

	const allWrites = applier.writeSet()
	// 有覆盖内容的路径直接从内存写，不再等归档里的那一条
	const overridden = new Set<RelPath>()
	if (opts.overrides) {
		for (const [rel, bytes] of opts.overrides) {
			if (allWrites.has(rel)) {
				await applier.writeFile(rel, bytes)
				overridden.add(rel)
			}
		}
	}
	const writeSet = new Set([...allWrites].filter((rel) => !overridden.has(rel)))
	const expectedWrites = allWrites.size
	// 用容器持有当前条目，避免闭包内的类型收窄把 pending 判成 null
	const buffer: {
		current: { path: RelPath; writer: Awaited<ReturnType<Applier["beginStreamedWrite"]>> } | null
	} = { current: null }

	try {
		await extractTar(opts.stream, {
			filter: (entry) => writeSet.has(entry.path),
			onFile: async (entry, chunk) => {
				if (!buffer.current || buffer.current.path !== entry.path) {
					buffer.current = { path: entry.path, writer: await applier.beginStreamedWrite(entry.path) }
				}
				await buffer.current.writer.write(chunk)
			},
			onFileEnd: async (entry) => {
				if (!buffer.current || buffer.current.path !== entry.path) {
					// 兜底：这一条没收到内容块（0 字节文件），仍要落一个空文件，
					// 否则会漏写并触发下面的"归档里缺少 N 个应写入的文件"
					buffer.current = { path: entry.path, writer: await applier.beginStreamedWrite(entry.path) }
				}
				await buffer.current.writer.commit()
				buffer.current = null
			},
		})

		if (applier.writtenCount < expectedWrites) {
			throw new Error(`归档里缺少 ${expectedWrites - applier.writtenCount} 个应写入的文件`)
		}

		for (const rel of applier.deleteList()) {
			await applier.deleteFile(rel)
		}
	} catch (error) {
		if (buffer.current) {
			await buffer.current.writer.abort()
		}
		await applier.rollback()
		return applier.failedReport(error)
	}

	return applier.finish()
}

/** 事后撤销：读备份目录里的 manifest，把文件还原回去 */
export async function rollbackFromBackup(backupDir: string): Promise<RollbackReport> {
	// 只接受本插件自己生成的备份目录（`update_backup_*`）：撤销会写文件，
	// 不能让一个任意目录（或别人塞进来的 manifest.json）决定往哪里写。
	const base = path.basename(path.resolve(backupDir))
	if (!base.startsWith(BACKUP_DIR_PREFIX)) {
		throw new Error(`不是本插件生成的备份目录，无法自动撤销：${base}`)
	}

	const manifestPath = path.join(backupDir, "manifest.json")
	const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as BackupManifest
	if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.actions)) {
		throw new Error("备份清单格式不认识，无法撤销")
	}
	if (manifest.status === "rolled-back") {
		return { ok: true, restored: 0, removed: 0, errors: [] }
	}
	// manifest.root 是回滚的目标根：拒绝磁盘根目录（否则一个伪造清单就能改写整个盘）
	const manifestRoot = path.resolve(manifest.root)
	if (manifestRoot === path.parse(manifestRoot).root) {
		throw new Error("备份清单里的游戏根是磁盘根目录，拒绝执行")
	}

	const errors: Array<{ path: string; message: string }> = []
	let restored = 0
	let removed = 0

	for (const action of [...manifest.actions].reverse()) {
		if (!isInsideRoot(manifest.root, action.path)) {
			errors.push({ path: action.path, message: "路径越界，已跳过" })
			continue
		}
		const abs = toFsPath(manifest.root, action.path)
		try {
			if (action.existed) {
				const src = path.join(backupDir, "files", ...action.path.split("/"))
				await fs.mkdir(path.dirname(winLongPath(abs)), { recursive: true })
				await fs.copyFile(winLongPath(src), winLongPath(abs))
				restored++
			} else if (await fileExists(abs)) {
				await fs.unlink(winLongPath(abs))
				removed++
			}
		} catch (error) {
			errors.push({ path: action.path, message: (error as Error).message })
		}
	}

	manifest.status = "rolled-back"
	await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8")

	// 状态也要跟着回去：更新成功时 `.era-harness/update-state.json` 已被写成新快照，
	// 只还原文件不还原状态的话，下次更新会以新快照为基线，把所有旧文件判成
	// 「用户改过」并误报已经是最新的。`state-before.json` 正是为此备份的。
	// （备份目录里没有这个文件 = 老版本备份，保持只还原文件的原行为。）
	const stateBeforePath = path.join(backupDir, "state-before.json")
	try {
		const raw = await fs.readFile(stateBeforePath, "utf8")
		const parsed = JSON.parse(raw) as unknown
		if (parsed === null) {
			// 更新前没有状态（首次更新）：撤销后状态文件也不该留着
			await fs.rm(winLongPath(statePath(manifest.root)), { force: true })
		} else if (typeof parsed === "object" && (parsed as { schemaVersion?: unknown }).schemaVersion === 1) {
			const target = winLongPath(statePath(manifest.root))
			await fs.mkdir(path.dirname(target), { recursive: true })
			await fs.writeFile(target, raw, "utf8")
		} else {
			errors.push({
				path: `${STATE_DIR}/${STATE_FILE}`,
				message: "state-before.json 格式不认识，更新状态没有还原",
			})
		}
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
			errors.push({ path: `${STATE_DIR}/${STATE_FILE}`, message: (error as Error).message })
		}
	}

	return { ok: errors.length === 0, restored, removed, errors }
}
