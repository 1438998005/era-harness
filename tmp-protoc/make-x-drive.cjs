// make-x-drive.cjs — 为构建期 protoc 插件创建无空格/无中文的 X: 虚拟盘。
//
// 背景（三重坑）：
// 1. protoc 在 Windows 用 CreateProcess 拉起 --plugin 指定的 .cmd；
// 2. npm 的 .bin/*.cmd 依赖 %~dp0，工作区路径含空格（"era harness工作区"）时被切碎；
// 3. .cmd 内容含中文路径时，cmd.exe 按 GBK 读文件，UTF-8 写入即乱码。
// 解法：subst 一个 X: 盘指向仓库根（含中文的路径交给 subst 内部处理），
// shim .cmd 内容全 ASCII，node.exe 用 %USERPROFILE% 运行时展开。
//
// 用法：node tmp-protoc/make-x-drive.cjs  （幂等；X: 已存在则跳过）
// 移除：node tmp-protoc/make-x-drive.cjs --remove
const { execSync } = require("child_process")
const path = require("path")

const repo = path.resolve(__dirname, "..")

function driveExists() {
	try {
		const out = execSync("subst", { encoding: "utf16le" }).toString()
		return /X:\\/.test(out) || /X:\\.*=>/.test(out)
	} catch {
		return false
	}
}

if (process.argv.includes("--remove")) {
	try {
		execSync("subst X: /D", { stdio: "ignore" })
		console.log("X: drive removed")
	} catch {
		console.log("X: drive not present")
	}
	process.exit(0)
}

if (driveExists()) {
	console.log("X: already mapped")
	process.exit(0)
}

execSync(`subst X: "${repo}"`, { stdio: "inherit" })
console.log(`X: -> ${repo}`)
