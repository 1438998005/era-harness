/**
 * 测试用 tar 构造器：手工拼 ustar 头，不依赖系统 tar（Windows / CI 行为一致）。
 *
 * 支持：普通文件、目录、pax 扩展头（长路径）、GNU 长名（'L'）。
 */

export interface TarFixtureEntry {
	path: string
	content?: string | Buffer
	type?: "file" | "dir"
	/** 强制走 pax 扩展头（模拟 git archive 对超长日文路径的处理） */
	pax?: boolean
	/** 强制走 GNU 'L' 长名 */
	gnuLongName?: boolean
}

function octal(value: number, length: number): string {
	return `${value.toString(8).padStart(length - 1, "0")}\0`
}

function writeHeader(name: string, prefix: string, size: number, typeflag: string, mtime: number): Buffer {
	const header = Buffer.alloc(512)
	header.write(name, 0, 100, "utf8")
	header.write(octal(0o644, 8), 100, 8, "ascii")
	header.write(octal(0, 8), 108, 8, "ascii")
	header.write(octal(0, 8), 116, 8, "ascii")
	header.write(octal(size, 12), 124, 12, "ascii")
	header.write(octal(mtime, 12), 136, 12, "ascii")
	header.fill(0x20, 148, 156)
	header.write(typeflag, 156, 1, "ascii")
	header.write("ustar\0", 257, 6, "ascii")
	header.write("00", 263, 2, "ascii")
	header.write(prefix, 345, 155, "utf8")

	let sum = 0
	for (const byte of header) {
		sum += byte
	}
	header.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148, 8, "ascii")
	return header
}

function pad(body: Buffer): Buffer {
	const remainder = body.length % 512
	if (remainder === 0) {
		return body
	}
	return Buffer.concat([body, Buffer.alloc(512 - remainder)])
}

function paxRecord(key: string, value: string): string {
	const tail = ` ${key}=${value}\n`
	let length = Buffer.byteLength(tail) + 1
	for (;;) {
		const next = Buffer.byteLength(String(length)) + Buffer.byteLength(tail)
		if (next === length) {
			break
		}
		length = next
	}
	return `${length}${tail}`
}

export function buildTar(entries: TarFixtureEntry[], mtime = 1700000000): Buffer {
	const blocks: Buffer[] = []

	for (const entry of entries) {
		const isDir = entry.type === "dir"
		const body = isDir
			? Buffer.alloc(0)
			: typeof entry.content === "string"
				? Buffer.from(entry.content, "utf8")
				: (entry.content ?? Buffer.alloc(0))
		const pathBytes = Buffer.byteLength(entry.path)

		if (entry.pax || pathBytes > 100) {
			const records = Buffer.from(paxRecord("path", entry.path), "utf8")
			blocks.push(writeHeader("PaxHeaders/entry", "", records.length, "x", mtime))
			blocks.push(pad(records))
			blocks.push(writeHeader("truncated-name", "", body.length, isDir ? "5" : "0", mtime))
		} else if (entry.gnuLongName) {
			const long = Buffer.from(`${entry.path}\0`, "utf8")
			blocks.push(writeHeader("././@LongLink", "", long.length, "L", mtime))
			blocks.push(pad(long))
			blocks.push(writeHeader("short", "", body.length, isDir ? "5" : "0", mtime))
		} else {
			blocks.push(writeHeader(entry.path, "", body.length, isDir ? "5" : "0", mtime))
		}

		if (!isDir) {
			blocks.push(pad(body))
		}
	}

	blocks.push(Buffer.alloc(1024))
	return Buffer.concat(blocks)
}

/** 把 Buffer 包成 tar 解析器要的异步字节流（按固定大小切块，模拟网络分片） */
export async function* chunked(buffer: Buffer, size = 137): AsyncGenerator<Buffer> {
	for (let i = 0; i < buffer.length; i += size) {
		yield buffer.subarray(i, Math.min(i + size, buffer.length))
	}
}
