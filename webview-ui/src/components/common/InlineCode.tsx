import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * 行内代码（设置页说明文案用）。
 *
 * 为什么不直接写 `<code>`：全局基础层有 `code { @apply bg-code }`（`index.css`），
 * 而 `--color-code` = `--vscode-editor-background`，且没有前景色 / padding / 圆角；
 * 再叠上 `* { @apply text-base }`，行内 code 会比周围正文大一号、并渲染成一块
 * 与文字同色的深色矩形——深色主题下就是「说明文案被黑块盖住」（08 #173）。
 *
 * 这里把 `.inline-markdown-block code` 的完整样式（`theme.css`）显式落到 class 上：
 * 前景 / 背景 / 边框 / 圆角 / 字号都自己给，不依赖全局兜底。
 */
export function InlineCode({ children, className }: { children: ReactNode; className?: string }) {
	return (
		<code
			className={cn(
				"mx-0.5 inline-block rounded-xs border border-text-separator bg-code-block-background px-1 py-0.5 font-mono text-xs text-preformat whitespace-pre-line break-words align-baseline",
				className,
			)}>
			{children}
		</code>
	)
}
