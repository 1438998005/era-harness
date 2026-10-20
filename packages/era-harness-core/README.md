# era harness

面向 **eraTW 画蛇添足版**（eratw-sub-modding，Emuera Skia V16）的 AI 辅助开发 harness 核心库。
长期目标：让不懂 AI 的口上作者 / 魔改开发者直接用上 AI 辅助（"eratw 版的 Cline"）。

> 本包是 era harness 工作区中的**分发包**（将来传仓库的就是本目录）；
> 开发期的 AI 协作者约定与项目知识库在工作区根，不随包分发。

## 当前进度

- [x] Emuera 日志格式调研（含 fatal 错误块、bad/ 归档实测）
- [x] 日志解析器 `src/log/` + 诊断分类（13 类）
- [x] 项目画像提取器 `src/profile/`（config/DIM/CSV家族/目录/编码 → ProjectProfile）
- [x] 编码安全读取 `src/encoding/`（UTF-8 BOM / CP932 自动探测 → 统一 UTF-8）
- [x] **MCP server** `src/mcp/`（parse_emuera_log / profile_project / read_erb_file / lookup_reference / search_reference，stdio）
- [x] **官方指令手册** `src/reference/`（emuera.sk.doc 内化：312 页 / 653 个可检索名字 / 312 条签名表，离线可用）
- [ ] 项目函数索引（项目自身函数 + 口上标签）
- [ ] harness 内核接入（MCP + rules 零 fork 验证优先；fork 决策晚绑定：中文版 Cline 为首选候选）
- [x] 错误闭环（启动 V16 → 解析日志 → AI 修复 → 重启验证）——插件侧的 `run_game` + `log_diagnose` 已打通

## 目录

```
src/log/             日志解析与诊断分类（Phase 0 交付物）
src/profile/         项目画像提取（Phase 0 交付物）
src/encoding/        编码安全读取：BOM 探测 + CP932 解码 + decodeToUtf8 / readTextFile
src/reference/       官方指令手册：types / parse / query / online（双线并轨）+ data/（生成物）
src/mcp/server.ts    MCP server 入口（stdio）
test/                测试（node:test + tsx，fixtures 为程序化合成的脱敏工程）
scripts/             CLI：analyze-log / profile-project / build-reference
docs/log-format.md        Emuera 日志格式规范（解析器行为规格）
docs/project-profile.md   项目画像格式规范
docs/encoding.md          编码安全读取规范
NOTICE-emuera-sk-doc.md   指令数据的来源、CC BY-NC 4.0 许可与更新方式
```

## 开发

```bash
npm install
npm test                    # node --import tsx --test（typecheck 全绿为准）
npm run typecheck
npm run analyze -- <日志路径>      # 分析 Emuera 运行日志
npm run profile -- <工程路径>      # 提取 eratw 工程画像（--json 输出 JSON）
npm run build:reference           # 抓取/重新生成内置指令手册（--offline 只用缓存）
npm run mcp                 # 以源码方式启动 MCP server（stdio，供 Cline/Zoo Code 等接入）
```

要求 Node >= 22（开发机为 Node 24）。

## 作为 MCP server 接入 Cline / Zoo Code

开发期直接用源码（包目录下）：`npm run mcp`。
分发时先 `npm run build`，用 `dist/src/mcp/server.js`（`bin` 名 `era-harness-mcp`）。

Cline 的 MCP 配置（`cline_mcp_settings.json`，参考 `mcp-settings.example.json`）：

```json
{
  "mcpServers": {
    "era-harness": {
      "command": "node",
      "args": ["--import", "tsx", "src/mcp/server.ts"],
      "cwd": "<era harness 包绝对路径>"
    }
  }
}
```

工具（本包全部只读）：`parse_emuera_log`（日志→结构化诊断）、`profile_project`（工程画像）、`read_erb_file`（编码安全读文件）、`lookup_reference`（查指令手册，在线优先/本地兜底）、`search_reference`（按关键词检索指令，永不出网）。
写文件与硬约束检查（`check_write_allowed`）尚未实现，当前**不要**让 AI 直接改动游戏目录。
启动引擎是**插件侧**能力（`run_game` 工具 + `src/core/era/game-runner.ts`），不在 MCP server 里：MCP 客户端没有进程生命周期管理，容易留下失控的僵尸进程。

### 可选：限制工具能读到的路径

三个工具接受调用方给的任意路径。默认不限制（与宿主 harness 的 `read_file` 同权限模型，审批在宿主侧）；
若想防止 AI 被工作区里的内容诱导去读项目外文件（如 `~/.ssh/id_rsa`），在 MCP 配置里加环境变量：

```json
{
  "mcpServers": {
    "era-harness": {
      "command": "node",
      "args": ["--import", "tsx", "src/mcp/server.ts"],
      "cwd": "<era harness 包绝对路径>",
      "env": { "ERA_HARNESS_MCP_ROOTS": "D:/games;E:/backup" }
    }
  }
}
```

多个根用 `;` 或 `,` 分隔；超出范围的路径直接报错。注意它只做字面路径比较，不解析符号链接。

### 指令手册的在线/离线开关

正文默认**先取上游最新页**（只请求命中的那一页），取不到才用内置快照；索引（名字/签名/摘要）永远用内置快照。
两端不会混用，返回结果里的 `origin` 说明本次用的是哪一份。

```json
{
  "mcpServers": {
    "era-harness": {
      "command": "node",
      "args": ["--import", "tsx", "src/mcp/server.ts"],
      "cwd": "<era harness 包绝对路径>",
      "env": {
        "ERA_HARNESS_REFERENCE_ONLINE": "off",
        "ERA_HARNESS_REFERENCE_BASE": "https://raw.githubusercontent.com/<owner>/<repo>/<branch>"
      }
    }
  }
}
```

`ERA_HARNESS_REFERENCE_ONLINE=off` 完全禁止联网；`ERA_HARNESS_REFERENCE_BASE` 可指向自建镜像或换分支。

## 数据来源与边界

- 格式规格来自 eraTW 画蛇添足版（Emuera Skia V10/V16）实测日志；测试 fixture 已脱敏（不含任何游戏文本）。
- 引擎：Emuera.NET SkiaSharp 1824+v24+EMv18+EEv56+Skiav16；游戏：eraTW 4.981 画蛇添足版。
- 目标游戏目录只读；本包只做分析与读取，不做写入。

## 许可

代码采用 [Apache-2.0](LICENSE)（Copyright 2026 era harness contributors）。

`src/reference/data/` 下的内置指令数据派生自 [emuera.sk.doc](https://github.com/qirchen421/emuera.sk.doc)，
采用 **CC BY-NC 4.0**（署名—非商业性使用），**与代码许可分开管理**。
来源版本、署名方式与更新流程见 [NOTICE-emuera-sk-doc.md](NOTICE-emuera-sk-doc.md)。
