import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./i18n/config"
import "./main.css"
import "./index.css"
import App from "./App.tsx"
import { installUiErrorHandlers } from "./services/ui-error-reporter"

// 全局兜底要挂在首次渲染前：渲染期的同步异常也能被 window.onerror 接住
installUiErrorHandlers()

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<App />
	</StrictMode>,
)
