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

import { createReadStream } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"
import { createGunzip } from "node:zlib"
import { CanonicalHasher, looksTextPath } from "./canonical"
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
	/**
	 * 只取「动过 ERB/DIM.ERH」的提交（= 历次发版点），新→旧。
	 * 首次同步定位历史基线用：NOW_VERSION 随发版单调递增，DIM.ERH 只在发版时被改。
	 */
	listVersionCommits(maxPages?: number): Promise<Array<{ id: string }>>
}

/** GitLab 提交 id 的合法形态：40 位十六进制（大小写不敏感，GitLab 实际下发小写）。 */
const GIT_COMMIT_RE = /^[0-9a-f]{40}$/i

/**
 * #69：提交 id 会被拼进缓存路径（`cachePath(root, `${commit}.tar.gz`)`），
 * 必须先在**数据入口**校验形态。上游账号/服务器被入侵时，`commit.id` 带 `..` 或分隔符
 * 就能把几百 MB 归档写到游戏目录之外。不合法直接抛，调用方按「拿不到」降级。
 */
export function assertCommitId(id: string, context: string): string {
	if (!GIT_COMMIT_RE.test(id)) {
		throw new Error(`上游返回了非法的提交 id（${context}）：${JSON.stringify(id)}`)
	}
	return id
}

/** 非抛出版本：调用方需要「不合法就静默降级」时用（如历史基线回落 mtime）。 */
export function isValidCommitId(id: string | null | undefined): id is string {
	return typeof id === "string" && GIT_COMMIT_RE.test(id)
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
			// #69：先校验再往下传——后面会拿它拼缓存文件名
			assertCommitId(commit, "分支 head")
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

		async listVersionCommits(maxPages = 3): Promise<Array<{ id: string }>> {
			const out: Array<{ id: string }> = []
			for (let page = 1; page <= maxPages; page++) {
				const url = `${apiBase(project)}/repository/commits?ref_name=${encodeURIComponent(
					project.branch,
				)}&path=${encodeURIComponent("ERB/DIM.ERH")}&per_page=100&page=${page}`
				const res = await httpGetBuffer(url, { headers: headers(project) })
				if (res.status < 200 || res.status >= 300) {
					break
				}
				const data = JSON.parse(res.body.toString("utf8")) as Array<{ id?: string }>
				for (const item of data) {
					// #69：坏 id 不进候选列表 → findBaseCommit 拿不到 → 回落 mtime 基线
					if (item.id && GIT_COMMIT_RE.test(item.id)) {
						out.push({ id: item.id })
					}
				}
				if (data.length < 100) {
					break
				}
			}
			return out
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
	const files = new Map<RelPath, { sha1: string; canonBlobSha1?: string; size: number }>()
	let current: { path: RelPath; size: number; hasher: CanonicalHasher } | null = null
	let count = 0
	let bytes = 0

	// raw = git blob sha1（sha1("blob <size>\0" + content)）；canon = 换行/BOM 无关指纹
	const startHash = (entryPath: RelPath, size: number) => ({
		path: entryPath,
		size,
		hasher: new CanonicalHasher({ text: looksTextPath(entryPath), size }),
	})

	const stats = await extractTar(stream, {
		onFile: (entry, chunk) => {
			if (!current || current.path !== entry.path) {
				current = startHash(entry.path, entry.size)
			}
			current.hasher.update(chunk)
		},
		onFileEnd: (entry) => {
			// 兜底：即使这一条没收到内容块，也必须记录。
			// 漏记的后果不是"少一个文件"，而是下游把它当成"上游已删除"→ 误删用户本地副本。
			const tracked = current !== null && current.path === entry.path ? current : startHash(entry.path, entry.size)
			const { raw, canonBlob } = tracked.hasher.digest()
			files.set(entry.path, { sha1: raw, canonBlobSha1: canonBlob, size: entry.size })
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
	const files = new Map<RelPath, { sha1: string; canonBlobSha1?: string; size: number }>()
	for (const [rel, fp] of scan.files) {
		files.set(
			rel,
			fp.canonBlobSha1
				? { sha1: fp.sha1, canonBlobSha1: fp.canonBlobSha1, size: fp.size }
				: { sha1: fp.sha1, size: fp.size },
		)
	}
	return { label: label ?? dir, files }
}

/** 读本地文件的 git blob sha1（给测试与调试用） */
export async function fileSha1(absPath: string): Promise<string> {
	const buf = await fs.readFile(absPath)
	return gitBlobSha1(buf)
}
