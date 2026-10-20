/**
 * eratw 一键更新 —— 更新源适配器。
 *
 * 三条入口，下游完全一致（都产出 `UpstreamSnapshot`）：
 * 1. `createGitLabSource`：从 GitGud / 任意 GitLab 拉归档（默认路径，用户零输入）
 * 2. `snapshotFromArchiveFile`：用户朋友给的 `.tar.gz`（断网自救）
 * 3. `snapshotFromDir`：已经解压好的整合包目录（连压缩包都不必有）
 *
 * 设计要点：**快照阶段只读流、只算 hash、不落盘**。650MB 归档扫一遍就能得到
 * 全量清单，不需要先解压到磁盘；真正要写的文件等用户确认后再从缓存里取。
 */

import { createHash, type Hash } from "node:crypto"
import { createReadStream } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"
import { createGunzip } from "node:zlib"
import { httpDownload, httpGetBuffer } from "./http"
import { gitBlobSha1, scanLocal } from "./manifest"
import { extractTar } from "./tarball"
import type { RelPath, UpstreamSnapshot } from "./types"

/** 内置默认源（对用户透明：换源走 `UpdateSourceInput.projectUrl`，⛔ 改这里的常量） */
export const DEFAULT_PROJECT_URL = "https://gitgud.io/era-games-zh/touhou/eratw-sub-modding"
export const DEFAULT_BRANCH = "develop"

export interface GitLabProject {
	host: string
	/** `era-games-zh/touhou/eratw-sub-modding` */
	path: string
	branch: string
	token?: string
}

export interface RepoHead {
	commit: string
	committedAt: string
	nowVersion: string | null
}

/** 从 `https://host/a/b/c` 或 `git@host:a/b/c.git` 解析出 host + 项目路径 */
export function parseProjectUrl(url: string, branch = DEFAULT_BRANCH, token?: string): GitLabProject {
	let rest = url.trim()
	let host = ""
	const ssh = /^git@([^:]+):(.+)$/.exec(rest)
	if (ssh) {
		host = `https://${ssh[1]}`
		rest = ssh[2] ?? ""
	} else {
		const parsed = new URL(rest)
		host = `${parsed.protocol}//${parsed.host}`
		rest = parsed.pathname
	}
	rest = rest
		.replace(/^\/+/, "")
		.replace(/\.git$/, "")
		.replace(/\/+$/, "")
	if (!rest) {
		throw new Error(`无法解析仓库地址: ${url}`)
	}
	return { host, path: rest, branch, token }
}

function apiBase(project: GitLabProject): string {
	return `${project.host}/api/v4/projects/${encodeURIComponent(project.path)}`
}

function headers(project: GitLabProject): Record<string, string> {
	return project.token ? { "PRIVATE-TOKEN": project.token } : {}
}

/** `NOW_VERSION = 20261017` → `20261017` */
export function parseNowVersion(content: Buffer | string): string | null {
	const text = typeof content === "string" ? content : content.toString("utf8")
	const match = /NOW_VERSION\s*=\s*(\d+)/.exec(text)
	return match?.[1] ?? null
}

export interface GitLabSource {
	project: GitLabProject
	head(): Promise<RepoHead>
	/** 归档下载地址；不传 ref 用分支名 */
	archiveUrl(ref?: string): string
	rawFile(filePath: RelPath, ref: string): Promise<Buffer>
	/** 下载归档到本地文件（先写 .part，成功后 rename） */
	downloadArchive(destPath: string, ref: string, onProgress?: (received: number, total: number) => void): Promise<number>
}

export function createGitLabSource(project: GitLabProject): GitLabSource {
	const projectName = project.path.split("/").pop() ?? "archive"

	const source: GitLabSource = {
		project,

		archiveUrl(ref?: string): string {
			const target = ref ?? project.branch
			return `${project.host}/${project.path}/-/archive/${encodeURIComponent(target)}/${projectName}-${target}.tar.gz`
		},

		async head(): Promise<RepoHead> {
			const res = await httpGetBuffer(`${apiBase(project)}/repository/branches/${encodeURIComponent(project.branch)}`, {
				headers: headers(project),
			})
			if (res.status < 200 || res.status >= 300) {
				throw new Error(`读取分支失败: HTTP ${res.status}（分支 ${project.branch}）`)
			}
			const data = JSON.parse(res.body.toString("utf8")) as {
				commit?: { id?: string; committed_date?: string }
			}
			const commit = data.commit?.id
			if (!commit) {
				throw new Error("分支响应里没有 commit")
			}
			let nowVersion: string | null = null
			try {
				// `ERB/DIM.ERH` 是**上游仓库**里的固定路径（经 GitLab API 读取），
				// 与用户工作区的目录布局无关——用户把脚本目录改名也不影响这里。
				nowVersion = parseNowVersion(await source.rawFile("ERB/DIM.ERH", commit))
			} catch {
				nowVersion = null
			}
			return { commit, committedAt: data.commit?.committed_date ?? "", nowVersion }
		},

		async rawFile(filePath: RelPath, ref: string): Promise<Buffer> {
			const url = `${apiBase(project)}/repository/files/${encodeURIComponent(filePath)}/raw?ref=${encodeURIComponent(ref)}`
			const res = await httpGetBuffer(url, { headers: headers(project) })
			if (res.status < 200 || res.status >= 300) {
				throw new Error(`读取文件失败: ${filePath}（HTTP ${res.status}）`)
			}
			return res.body
		},

		async downloadArchive(destPath, ref, onProgress): Promise<number> {
			await fs.mkdir(path.dirname(destPath), { recursive: true })
			return httpDownload(source.archiveUrl(ref), destPath, { headers: headers(project), onProgress })
		},
	}

	return source
}

/** 归档字节流 → 全量清单（只读流、只算 hash、不落盘） */
export async function snapshotFromTarStream(
	stream: AsyncIterable<Buffer>,
	label: string,
	onProgress?: (files: number, bytes: number) => void,
): Promise<UpstreamSnapshot> {
	const files = new Map<RelPath, { sha1: string; size: number }>()
	let current: { path: RelPath; size: number; hash: Hash } | null = null
	let count = 0
	let bytes = 0

	// git blob sha1 = sha1("blob <size>\0" + content)；0 字节文件的 content 为空
	const startHash = (entryPath: RelPath, size: number) => ({
		path: entryPath,
		size,
		hash: createHash("sha1").update(Buffer.from(`blob ${size}\0`, "utf8")),
	})

	const stats = await extractTar(stream, {
		onFile: (entry, chunk) => {
			if (!current || current.path !== entry.path) {
				current = startHash(entry.path, entry.size)
			}
			current.hash.update(chunk)
		},
		onFileEnd: (entry) => {
			// 兜底：即使这一条没收到内容块，也必须记录。
			// 漏记的后果不是"少一个文件"，而是下游把它当成"上游已删除"→ 误删用户本地副本。
			const tracked = current !== null && current.path === entry.path ? current : startHash(entry.path, entry.size)
			files.set(entry.path, { sha1: tracked.hash.digest("hex"), size: entry.size })
			current = null
			count++
			bytes += entry.size
			onProgress?.(count, bytes)
		},
	})

	if (count !== stats.files) {
		throw new Error(`归档解析不完整：解析到 ${stats.files} 个文件，只记录了 ${count} 个`)
	}

	return { label, files }
}

/** 从本地 `.tar.gz` 构建清单 */
export async function snapshotFromArchiveFile(
	archivePath: string,
	label?: string,
	onProgress?: (files: number, bytes: number) => void,
): Promise<UpstreamSnapshot> {
	const input = createReadStream(archivePath)
	const gunzip = createGunzip()
	input.pipe(gunzip)
	return snapshotFromTarStream(gunzip, label ?? path.basename(archivePath), onProgress)
}

/** 从已解压目录构建清单（第三条入口：朋友给的整合包，解压好直接选文件夹） */
export async function snapshotFromDir(dir: string, label?: string): Promise<UpstreamSnapshot> {
	const scan = await scanLocal(dir, { excludeDirs: [".git", "node_modules"] })
	const files = new Map<RelPath, { sha1: string; size: number }>()
	for (const [rel, fp] of scan.files) {
		files.set(rel, { sha1: fp.sha1, size: fp.size })
	}
	return { label: label ?? dir, files }
}

/** 读本地文件的 git blob sha1（给测试与调试用） */
export async function fileSha1(absPath: string): Promise<string> {
	const buf = await fs.readFile(absPath)
	return gitBlobSha1(buf)
}
