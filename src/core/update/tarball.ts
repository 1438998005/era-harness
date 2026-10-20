/**
 * eratw 一键更新 —— 零依赖流式 tar.gz 解析。
 *
 * 为什么自己写：项目坚持零运行时依赖（AGENTS.md §3.4），而 `tar` / `adm-zip` 都是外部依赖。
 * Node 自带 `zlib`，tar 格式本身只是 512 字节头 + 内容 + 对齐填充，够简单。
 *
 * 必须支持的三件事（否则真实归档会解析错）：
 * 1. **pax 扩展头**（typeflag 'x'）：git archive 遇到超过 100 字节的路径（日文长名）时，
 *    真实路径放在 pax 记录里，头里的 name 是截断的。不支持 = 路径全错。
 * 2. **GNU 长名**（typeflag 'L'）：另一种长路径表示法，同样要认。
 * 3. **顶层目录剥离**：GitLab 归档固定是 `<proj>-<branch>/…`，且用 `?path=` 导出时
 *    前缀会变成 `<proj>-<branch>-CSV/` —— 所以必须动态探测，不能写死。
 *
 * 内存恒定：内容按块喂给 `onFile`，不整块缓存（650MB 归档不会炸）。
 */

const BLOCK = 512

export type TarEntryType = "file" | "dir" | "other"

export interface TarEntry {
	/** 已剥离顶层目录、已 NFC 归一、"/" 分隔 */
	path: string
	size: number
	type: TarEntryType
	mode: number
	mtimeMs: number
}

export interface ExtractOptions {
	/**
	 * 剥掉归档顶层目录。
	 * - `true`（默认）：自动探测（首个条目是目录且其路径只有一段时视为前缀）
	 * - `false`：保留原样
	 * - 字符串：按指定前缀剥离
	 */
	stripTopLevel?: boolean | string
	/** 只处理关心的条目；返回 false 时内容会被丢弃（但仍消费流） */
	filter?: (entry: TarEntry) => boolean
	/**
	 * 收到一个内容块。**0 字节文件也会收到一次 `Buffer.alloc(0)`** ——
	 * 因为快照、写盘、读单文件这三个调用方都靠这个回调建立"当前条目"状态，
	 * 不回调就会把空文件整条丢掉（真实归档里这类文件有 134 个，
	 * 例如 `sound/游戏bgm/…/bgm`，丢了会被误判成"上游已删除"）。
	 */
	onFile?: (entry: TarEntry, chunk: Buffer) => void | Promise<void>
	onFileEnd?: (entry: TarEntry) => void | Promise<void>
}

export interface ExtractStats {
	entries: number
	files: number
	bytes: number
	prefix: string
	skipped: number
	/** 被拒绝的条目（路径穿越、绝对路径等） */
	rejected: string[]
}

class ByteStream {
	private chunks: Buffer[] = []
	private buffered = 0
	private exhausted = false

	constructor(private readonly iterator: AsyncIterator<Buffer>) {}

	private async pull(): Promise<boolean> {
		if (this.exhausted) {
			return false
		}
		const next = await this.iterator.next()
		if (next.done) {
			this.exhausted = true
			return false
		}
		const value = next.value
		if (value && value.length > 0) {
			this.chunks.push(value)
			this.buffered += value.length
		}
		return true
	}

	async ensure(n: number): Promise<boolean> {
		while (this.buffered < n) {
			if (!(await this.pull())) {
				return false
			}
		}
		return true
	}

	async read(n: number): Promise<Buffer> {
		if (!(await this.ensure(n))) {
			throw new Error("tar: 数据意外结束")
		}
		const out = Buffer.allocUnsafe(n)
		let offset = 0
		while (offset < n) {
			const head = this.chunks[0]
			if (!head) {
				throw new Error("tar: 缓冲区状态异常")
			}
			const take = Math.min(head.length, n - offset)
			head.copy(out, offset, 0, take)
			offset += take
			if (take === head.length) {
				this.chunks.shift()
			} else {
				this.chunks[0] = head.subarray(take)
			}
			this.buffered -= take
		}
		return out
	}

	/** 流式读 n 字节，按块回调（不整块进内存） */
	async readInto(n: number, sink: (chunk: Buffer) => void | Promise<void>): Promise<void> {
		let remaining = n
		while (remaining > 0) {
			if (!(await this.ensure(1))) {
				throw new Error("tar: 数据意外结束")
			}
			const head = this.chunks[0]
			if (!head) {
				throw new Error("tar: 缓冲区状态异常")
			}
			const take = Math.min(head.length, remaining)
			await sink(head.subarray(0, take))
			remaining -= take
			if (take === head.length) {
				this.chunks.shift()
			} else {
				this.chunks[0] = head.subarray(take)
			}
			this.buffered -= take
		}
	}

	async skip(n: number): Promise<void> {
		let remaining = n
		while (remaining > 0) {
			if (!(await this.ensure(1))) {
				return
			}
			const head = this.chunks[0]
			if (!head) {
				return
			}
			const take = Math.min(head.length, remaining)
			remaining -= take
			if (take === head.length) {
				this.chunks.shift()
			} else {
				this.chunks[0] = head.subarray(take)
			}
			this.buffered -= take
		}
	}
}

function readString(buf: Buffer, start: number, length: number): string {
	const slice = buf.subarray(start, start + length)
	const nul = slice.indexOf(0)
	return (nul >= 0 ? slice.subarray(0, nul) : slice).toString("utf8")
}

/** 八进制字段；同时兼容 GNU base-256（最高位为 1）编码 */
function readNumeric(buf: Buffer, start: number, length: number): number {
	const slice = buf.subarray(start, start + length)
	const first = slice[0] ?? 0
	if (first & 0x80) {
		let value = 0
		for (let i = 1; i < slice.length; i++) {
			value = value * 256 + (slice[i] ?? 0)
		}
		return value
	}
	const text = readString(buf, start, length).trim()
	if (!text) {
		return 0
	}
	const parsed = Number.parseInt(text, 8)
	return Number.isFinite(parsed) ? parsed : 0
}

function isZeroBlock(block: Buffer): boolean {
	for (let i = 0; i < block.length; i++) {
		if (block[i] !== 0) {
			return false
		}
	}
	return true
}

/** 解析 pax 记录：`<长度> <key>=<value>\n` */
function parsePax(buf: Buffer): Record<string, string> {
	const out: Record<string, string> = {}
	let i = 0
	while (i < buf.length) {
		const space = buf.indexOf(0x20, i)
		if (space < 0) {
			break
		}
		const length = Number(buf.subarray(i, space).toString("ascii"))
		if (!Number.isFinite(length) || length <= 0) {
			break
		}
		const end = i + length
		if (end > buf.length) {
			break
		}
		const record = buf.subarray(space + 1, end - 1).toString("utf8")
		const eq = record.indexOf("=")
		if (eq > 0) {
			out[record.slice(0, eq)] = record.slice(eq + 1)
		}
		i = end
	}
	return out
}

/** 规范化归档内路径；返回 null 表示不安全（路径穿越 / 绝对路径 / 空） */
export function normalizeEntryPath(raw: string): string | null {
	let p = raw.replace(/\\/g, "/").normalize("NFC")
	while (p.startsWith("./")) {
		p = p.slice(2)
	}
	// 目录条目在 tar 里常带尾部斜杠（`ERB/`），必须先去掉再判空段
	p = p.replace(/\/+$/, "")
	if (p === "" || p === ".") {
		return null
	}
	if (p.startsWith("/") || /^[a-zA-Z]:/.test(p)) {
		return null
	}
	const segments = p.split("/")
	if (segments.some((s) => s === ".." || s === "")) {
		return null
	}
	return segments.join("/")
}

/**
 * 流式解析 tar.gz。
 * `stream` 是**已解压**的 tar 字节流；调用方负责套 `zlib.createGunzip()`。
 */
export async function extractTar(stream: AsyncIterable<Buffer>, opts: ExtractOptions = {}): Promise<ExtractStats> {
	const stats: ExtractStats = { entries: 0, files: 0, bytes: 0, prefix: "", skipped: 0, rejected: [] }
	const byteStream = new ByteStream(stream[Symbol.asyncIterator]())

	let prefix: string | null = typeof opts.stripTopLevel === "string" ? opts.stripTopLevel : null
	let prefixResolved = typeof opts.stripTopLevel === "string" || opts.stripTopLevel === false
	let pendingPath: string | null = null
	let pendingPax: Record<string, string> = {}

	for (;;) {
		if (!(await byteStream.ensure(BLOCK))) {
			break
		}
		const header = await byteStream.read(BLOCK)
		if (isZeroBlock(header)) {
			break
		}

		const name = readString(header, 0, 100)
		const prefixField = readString(header, 345, 155)
		const typeflag = String.fromCharCode(header[156] ?? 0)
		let size = readNumeric(header, 124, 12)
		let rawPath = prefixField ? `${prefixField}/${name}` : name
		const mode = readNumeric(header, 100, 8)
		const mtimeMs = readNumeric(header, 136, 12) * 1000

		// pax / GNU 扩展头：先读内容，再作用于下一个真实条目
		if (typeflag === "x" || typeflag === "g") {
			const body = await byteStream.read(size)
			await byteStream.skip((BLOCK - (size % BLOCK)) % BLOCK)
			if (typeflag === "x") {
				pendingPax = { ...pendingPax, ...parsePax(body) }
			}
			continue
		}
		if (typeflag === "L" || typeflag === "K") {
			const body = await byteStream.read(size)
			await byteStream.skip((BLOCK - (size % BLOCK)) % BLOCK)
			const value = body.toString("utf8").replace(/\0+$/, "")
			if (typeflag === "L") {
				pendingPath = value
			}
			continue
		}

		if (pendingPax.path) {
			rawPath = pendingPax.path
		}
		if (pendingPath) {
			rawPath = pendingPath
		}
		if (pendingPax.size) {
			const paxSize = Number.parseInt(pendingPax.size, 10)
			if (Number.isFinite(paxSize)) {
				size = paxSize
			}
		}
		pendingPax = {}
		pendingPath = null

		const normalized = normalizeEntryPath(rawPath)
		if (!normalized) {
			stats.rejected.push(rawPath)
			await byteStream.skip(size + ((BLOCK - (size % BLOCK)) % BLOCK))
			continue
		}

		// 顶层目录探测：首个条目若是一条目录且路径只有一段，视为归档前缀
		if (!prefixResolved) {
			const isDir = typeflag === "5"
			const segments = normalized.split("/")
			if (isDir && segments.length === 1) {
				prefix = segments[0] ?? null
			}
			prefixResolved = true
		}

		let entryPath = normalized
		if (prefix && entryPath.startsWith(`${prefix}/`)) {
			entryPath = entryPath.slice(prefix.length + 1)
		} else if (prefix && entryPath === prefix) {
			entryPath = ""
		}
		stats.prefix = prefix ?? ""

		const type: TarEntryType =
			typeflag === "5" ? "dir" : typeflag === "0" || typeflag === "\0" || typeflag === "7" ? "file" : "other"
		const entry: TarEntry = { path: entryPath, size, type, mode, mtimeMs }

		if (type === "dir") {
			await byteStream.skip(size + ((BLOCK - (size % BLOCK)) % BLOCK))
			continue
		}

		stats.entries++

		const wanted = entry.path !== "" && (opts.filter ? opts.filter(entry) : true)
		if (!wanted) {
			stats.skipped++
			await byteStream.skip(size + ((BLOCK - (size % BLOCK)) % BLOCK))
			continue
		}

		if (type === "file") {
			if (opts.onFile) {
				if (size === 0) {
					// 空文件没有内容块，但仍要回调一次，让调用方建立条目状态（见 onFile 注释）
					await opts.onFile(entry, Buffer.alloc(0))
				} else {
					await byteStream.readInto(size, (chunk) => opts.onFile?.(entry, chunk))
				}
			} else {
				await byteStream.skip(size)
			}
			stats.files++
			stats.bytes += size
			await byteStream.skip((BLOCK - (size % BLOCK)) % BLOCK)
			if (opts.onFileEnd) {
				await opts.onFileEnd(entry)
			}
			continue
		}

		// 符号链接等：只记录，不处理内容
		await byteStream.skip(size + ((BLOCK - (size % BLOCK)) % BLOCK))
	}

	return stats
}
