import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react-swc"
import { resolve } from "path"
import { defineConfig } from "vite"

/**
 * 「eraTW 更新中心」面板的独立构建（计划任务 D / F5）。
 *
 * 为什么不并进 vite.config.ts 的多页入口：主构建开了 `inlineDynamicImports`，
 * 与多输入互斥；主产物（index.html + assets/main.js）是三年稳定路径，
 * 不为面板去动它。这里单页、`emptyOutDir: false`（不清主构建的产物），
 * 产物与主构建并排落在 build/：update-center.html + assets/。
 */
export default defineConfig({
	base: "./",
	plugins: [react(), tailwindcss()],
	build: {
		outDir: "build",
		emptyOutDir: false,
		reportCompressedSize: false,
		minify: true,
		sourcemap: false,
		rollupOptions: {
			input: resolve(__dirname, "update-center.html"),
			output: {
				entryFileNames: `assets/[name].js`,
				chunkFileNames: `assets/[name].js`,
				assetFileNames: `assets/[name].[ext]`,
			},
		},
	},
	define: {
		__PLATFORM__: JSON.stringify("vscode"),
		process: JSON.stringify({
			platform: JSON.stringify(process?.platform),
			env: {
				NODE_ENV: JSON.stringify("production"),
				CLINE_ENVIRONMENT: JSON.stringify("production"),
				IS_DEV: JSON.stringify(undefined),
				IS_TEST: JSON.stringify(undefined),
				CI: JSON.stringify(undefined),
				TELEMETRY_SERVICE_API_KEY: JSON.stringify(undefined),
				ERROR_SERVICE_API_KEY: JSON.stringify(undefined),
			},
		}),
	},
	resolve: {
		alias: {
			"@": resolve(__dirname, "./src"),
			"@components": resolve(__dirname, "./src/components"),
			"@context": resolve(__dirname, "./src/context"),
			"@shared": resolve(__dirname, "../src/shared"),
			"@utils": resolve(__dirname, "./src/utils"),
		},
	},
})
