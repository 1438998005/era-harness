/**
 * era harness 标识：东方 Project 语汇——御札（符纸）+ 红白蝴蝶结 + 背后魔法阵，
 * 中央为块状 E 字标。与扩展图标同源，界面内按主题前景色与固定朱红着色。
 */
interface EraLogoProps {
	className?: string
	/** 兼容旧 Logo 组件的入参，当前不参与渲染 */
	environment?: string
}

const EraLogo = ({ className }: EraLogoProps) => (
	<svg
		aria-label="era harness"
		className={className}
		fill="none"
		role="img"
		viewBox="0 0 512 512"
		xmlns="http://www.w3.org/2000/svg">
		<defs>
			<linearGradient id="era-paper" x1="0" x2="0" y1="0" y2="1">
				<stop offset="0%" stopColor="#f9f4e8" />
				<stop offset="100%" stopColor="#ece3d1" />
			</linearGradient>
		</defs>

		{/* 魔法阵 */}
		<g opacity="0.35" stroke="#e8c896">
			<circle cx="256" cy="256" r="206" strokeWidth="2" />
			<circle cx="256" cy="256" opacity="0.7" r="188" strokeWidth="1.2" />
			<path d="M256 78 L410 344 L102 344 Z" opacity="0.5" strokeWidth="1.2" />
			<path d="M256 434 L102 168 L410 168 Z" opacity="0.5" strokeWidth="1.2" />
		</g>

		{/* 樱花瓣 */}
		<g fill="#f2a8c0">
			<ellipse cx="96" cy="120" opacity="0.75" rx="15" ry="8" transform="rotate(32 96 120)" />
			<ellipse cx="430" cy="300" opacity="0.65" rx="13" ry="7" transform="rotate(-24 430 300)" />
			<ellipse cx="112" cy="392" opacity="0.55" rx="12" ry="6" transform="rotate(58 112 392)" />
		</g>

		{/* 御札 */}
		<rect fill="url(#era-paper)" height="258" rx="11" stroke="#c8434b" strokeWidth="6" width="180" x="166" y="138" />
		<rect fill="none" height="222" opacity="0.35" rx="6" stroke="#c8434b" strokeWidth="1.6" width="144" x="184" y="156" />

		{/* E 字标 */}
		<g fill="#1d1430">
			<rect height="148" rx="5" width="22" x="200" y="196" />
			<rect height="22" rx="5" width="112" x="200" y="196" />
			<rect height="22" rx="5" width="92" x="200" y="259" />
			<rect height="22" rx="5" width="112" x="200" y="322" />
		</g>

		{/* 红白蝴蝶结 */}
		<g>
			<ellipse cx="212" cy="150" fill="#de545c" rx="47" ry="31" transform="rotate(-16 212 150)" />
			<ellipse cx="300" cy="150" fill="#de545c" rx="47" ry="31" transform="rotate(16 300 150)" />
			<rect fill="#f3e9d6" height="42" rx="8" stroke="#c8434b" strokeWidth="3" width="36" x="238" y="129" />
		</g>

		{/* 星芒 */}
		<g fill="#e8c896">
			<path d="M126 201 L129 211 L139 214 L129 217 L126 227 L123 217 L113 214 L123 211 Z" />
			<path d="M392 222 L394 230 L402 232 L394 234 L392 242 L390 234 L382 232 L390 230 Z" opacity="0.85" />
		</g>
	</svg>
)

export default EraLogo
