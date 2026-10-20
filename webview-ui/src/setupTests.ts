// era harness：vitest 全局 setup（vite.config 的 setupFiles 指向本文件）。
// 有意保持为空：本仓不引 @testing-library/jest-dom（其传递依赖 @adobe/css-tools 未安装，
// 且新增依赖违反"零运行时/测试依赖膨胀"约束）。组件测试直接用原生 DOM 属性 + getBy* 断言。
export {}
