# era harness

**eraTW 画蛇添足版（R18）开发助手** —— 一个只为本地工作流服务的 VSCode 智能体插件。

不是通用编程助手，是给 eraTW / Emuera 这类日文脚本工程做长期改造的**夹具（harness）**：
编码安全读写、日志解析、工具扩展、改动可审。每一步修改都生成 diff，你点了才落盘。

---

## 它解决什么问题

eraTW 的源码是 CP932 的 `.ERB` / `.CSV`，混着全角符号、特殊转义和几十万行口上文本。
通用 AI 编辑器在这里会稳定翻车：

- 按 UTF-8 写回 → 全文件乱码
- 大文件整段替换 → 行尾与编码漂移
- 只看单文件 → 改了口上却漏了口上的引用表
- 自动执行一切 → 一条命令把你的工程洗了

era harness 把这几件事当成**一等约束**处理，而不是让模型「注意一下」。

## 当前能力

| 能力 | 状态 |
| --- | --- |
| 会话读写闭环（diff → 审批 → 落盘） | 可用 |
| MCP 服务器接入（stdio / SSE / HTTP） | 可用，本地配置 |
| Skill 本地加载（`SKILL.md` 扫描 + `use_skill`） | 可用，无远端来源 |
| 模型提供方 | DeepSeek、OpenAI 兼容（自定义 baseURL） |
| 身份选择（本体侧 / 口上·剧本侧 / 权限全开） | 每轮对话可选，随时切换 |
| 编码安全 IO（CP932 写回校验） | 开发中 |
| Emuera 日志解析 | 开发中 |

## 安装（仅本地）

本插件**不进入任何在线分发渠道**，只做本地 sideload：

```bash
code --install-extension era-harness-3.86.6.vsix
```

首次启动即用，无需登录、无需账号。API Key 在设置页填写，只存在本机。

## 设计取向

1. **减法优先**。上游 Cline 的账号体系、遥测、特性开关、插件市场、远端配置轮询全部移除，
   保留的是「本地能跑起来的最小闭环」。没有网络回调，没有静默上报。
2. **改动可审**。任何写盘前都能看到 diff；批量替换有范围提示。
3. **编码是硬约束**。不靠提示词祈求模型别写坏文件，靠写入前校验 + 失败即回滚。
4. **身份可切换**。同一段对话里，你可以让它以「本体」身份直说，也可以切到「口上」侧按剧本口吻产出，
   或者干脆放开全部工具权限跑批处理。

## 目录

```
src/           扩展宿主侧（TypeScript）
webview-ui/    侧栏界面（React + Vite）
assets/icons/  图标
scripts/       构建、proto 生成、图标生成
```

## 构建

```bash
npm install
npm run protos      # 生成 proto 客户端
npm run package     # 类型检查 + webview 构建 + lint + 打包 dist
npx vsce package --no-dependencies --allow-missing-repository
```

## 免责声明

- 本插件为个人本地开发工具，按现状提供，不附带任何担保。
- 使用者需自行确认所处理内容的合法性与授权范围，并对自己的操作负责。
- 本项目基于 Apache-2.0 许可的上游项目改造，上游版权归其原作者所有。

---

> 上游血缘：[Cline](https://github.com/cline/cline) → [Cline Chinese](https://github.com/SSYCloud/cline-chinese)。
> 本仓库为其减法改造版，与上述团队无隶属关系。
