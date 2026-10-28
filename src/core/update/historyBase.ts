/**
 * eratw 一键更新 —— 首次同步的历史基线定位（F1，计划任务 D）。
 *
 * 事故背景（2026-10-28，真实用户）：第三方整合包的 mtime 多样（打包者分批拼装），
 * 无 ≥ 阈值的大批次 → mtime 批量判定把几乎所有文件判成「人手改过」，叠加整合包基于
 * 旧版社区 ⇒ 590 个 both-changed 冲突窗口（KB 13 §13.3.3 的适用边界）。
 *
 * 修复思路：**不必猜**。NOW_VERSION 随发版单调递增、DIM.ERH 只在发版时被改，所以
 * 「动过 DIM.ERH 的提交」就是历次发版点。从新到旧走到 NOW_VERSION 等于本地值的那一档，
 * 取该档**最早**的提交（= 发版起点，最接近打包快照）下载归档建基线 —— 首次同步从
 * 「mtime 猜测」升级为真三方。
 *
 * 定位不到（魔改版改过版本号 / 本地比上游还新 / 网络失败）⇒ 返回 null，调用方回退
 * 既有 mtime 批次路径，行为与旧版完全一致。
 *
 * 纯 Node、无 vscode；网络调用只走传入的 GitLabSource。
 */

import { type GitLabSource, parseNowVersion } from "./source"
import type { RelPath } from "./types"

export interface HistoricalBase {
	/** 基线 commit（= 本地 NOW_VERSION 对应发版点里最早的那个提交） */
	commit: string
	/** 该提交的全量 blob 清单；sha1 与快照扫描器同构（git blob sha1） */
	files: Map<RelPath, { sha1: string }>
}

/**
 * 在上游提交历史里定位「本地 NOW_VERSION 对应的发版点」。
 *
 * - 沿「动过 DIM.ERH 的提交」从新到旧走；NOW_VERSION 相等的**最后一个**匹配
 *   （= 时间上最早的发版起点）胜出；
 * - 遇到严格更旧的版本号即可停（单调性）：再往后不可能还有匹配；
 * - 单个提交的 DIM.ERH 读不到就跳过（提交被撤 / 权限抖动不应炸整条流程）。
 *
 * @returns 基线 commit；本地版本不在上游历史里 / 历史不可读时返回 null
 */
export async function findBaseCommit(
	client: Pick<GitLabSource, "listVersionCommits" | "rawFile">,
	localNowVersion: string,
): Promise<string | null> {
	const trimmed = localNowVersion.trim()
	if (!trimmed) {
		return null
	}
	const commits = await client.listVersionCommits().catch(() => [])
	let candidate: string | null = null
	for (const commit of commits) {
		const content = await client.rawFile("ERB/DIM.ERH", commit.id).catch(() => null)
		if (!content) {
			continue
		}
		const version = parseNowVersion(content)
		if (!version) {
			continue
		}
		if (version === trimmed) {
			// 继续往旧走：同一版本的更早提交更接近打包快照点
			candidate = commit.id
			continue
		}
		if (version < trimmed) {
			break
		}
	}
	return candidate
}
