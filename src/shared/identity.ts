/**
 * 身份指令块的宿主侧副本。
 *
 * 为什么需要这一份：身份（写盘范围）本来由 webview 拼进每条用户消息
 * （`webview-ui/src/components/chat/identity/identity.ts` 的 `buildIdentityDirective`），
 * 但 era harness 自己发起的任务（更新合并、专属知识库）不经过 webview 的输入框，
 * 必须由宿主侧自己带上同样的前缀——`Controller.initTask` 会解析它并同步给
 * `isWriteAllowedByScope`，resume 时 `restoreIdentityFromSavedMessages` 也靠它重建。
 *
 * 文案与 webview 那份保持一致（模型看到的指令不该因为发起方不同而变）。
 * 漂移风险由 `test/update/era-identity-harness-dir.spec.ts` 锁住。
 */

/** 身份指令块必须以 `<era-identity mode="…">` 起头：webview 的剥离正则锚定行首。 */
export const UNRESTRICTED_IDENTITY_BLOCK = `<era-identity mode="unrestricted">
当前身份：权限全开（仅约束可写文件范围，不改变对话方式与任务风格）。
可修改任意文件，读写与命令不再逐条确认，一次做完再汇报。
仍须：每次改动输出 diff 摘要；涉及删除或覆盖前先备份，并列出影响范围。
</era-identity>
`

/** 把身份块拼到任务正文前面（中间留一个空行，与 webview 的拼法一致）。 */
export function withUnrestrictedIdentity(taskText: string): string {
	return `${UNRESTRICTED_IDENTITY_BLOCK}\n${taskText}`
}
