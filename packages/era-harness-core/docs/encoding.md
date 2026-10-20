# 编码安全读取规范（src/encoding/）

> `src/encoding/` 的行为规格。把工程里的 ERB/CSV/日志/config 等文件**安全读成统一 UTF-8 文本**，是 `read_erb_file` 工具与后续索引器的地基。

## 1. 为什么需要它

- 目标工程文件编码并存：UTF-8 带 BOM（日志、多数 ERB）、UTF-8 无 BOM、CP932/Shift-JIS（上游老文件），读错 = 乱码或抛异常。
- Node 的 `TextDecoder` **不支持 `'cp932'` 标签**（WHATWG Encoding Standard 无此标签，直接抛 RangeError）；full-ICU 构建下 `'windows-31j'` 即 CP932。本模块统一封装该事实。

## 2. API

| 函数 | 说明 |
|---|---|
| `detectBom(buffer)` | 细粒度 BOM 探测：`none` / `utf8` / `utf16le` / `utf16be`；只看前几字节，短缓冲区安全 |
| `decodeToUtf8(buffer)` | Buffer → `DecodedText`；**不抛异常**，任何字节序列都有输出 |
| `readTextFile(path, options?)` | 文件路径 → `ReadTextResult`（= `DecodedText` + `path` + `totalBytes` + `truncated`）；IO 错误照常抛，不吞 |

`ReadTextOptions.maxBytes`：只读取文件开头这么多字节。存在的理由：日志动辄上百 MB，
整份读进来再解析会把扩展宿主卡死，而调用方拿到的结果最终还要被截断到几 KB。
截断点退到**最后一个 `0x0A`**（换行在 UTF-8 与 CP932 里都不会出现在多字节字符内部），
否则残字节会让 `detectEncoding` 误判编码、整个开头变乱码。

`DecodedText` 字段：

| 字段 | 内容 |
|---|---|
| `text` | 解码后文本；源 BOM 已剥离；**CRLF 原样保留**（不改写换行，行号保真） |
| `encoding` | 复用 `profile/scan.ts` 的 `detectEncoding` 粗分类：`utf8Bom` / `utf8` / `cp932` / `unknown` |
| `bom` | BOM 细分类（`detectEncoding` 归入 `unknown` 的 UTF-16 在此区分 LE/BE） |
| `byteLength` | 源字节总长（含 BOM） |
| `lossy` | 是否有不可解码字节被 `U+FFFD` 替换；true 时文本有损，调用方应知晓 |
| `totalBytes` | 磁盘上的真实字节数（未限流时等于 `byteLength`） |
| `truncated` | 是否因 `maxBytes` 只读了开头一段；true 时 `text` 末尾附带一行截断说明 |

## 3. 解码顺序（判定规则）

1. `detectBom` 优先：UTF-8 BOM → 剥 3 字节后按 UTF-8 解；UTF-16LE/BE BOM → 对应解码（BE 走 `swap16` 转 LE）。
2. 无 BOM：`detectEncoding` 判定——`cp932` → `windows-31j` 解码；`utf8` → UTF-8 解码（`detectEncoding` 已 fatal 严格校验合法）。
3. 每个标签都**先 fatal 后非 fatal**：fatal 失败 → 非 fatal 重解（坏字节变 `U+FFFD`，`lossy=true`）；标签不被支持（small-icu 极端构建）→ latin1 兜底，`lossy=true`。

## 4. 已知边界

- **只读不写**：写文件必须按原编码/项目规范还原（判据见内嵌知识条目 `interpreter-encoding-discipline`，正本＝shared-trae `knowledge/lazyloading/encoding-discipline.md`），本模块不含写路径。
- UTF-16 文件在 era 工程未见，但解码路径已覆盖（探测成本为零）。
- CP932 语义取 Windows-31J；与严格 Shift-JIS 的差异字节（NEC/IBM 扩展区）在 era 文件中未出现，如出现由 fatal→lossy 路径兜底。

## 5. 实测验证

- 单测 17 例（`test/encoding.test.ts`）：四种编码往返、BOM 边界、CRLF 保真、UTF-8 BOM 主体损坏、不完整 CP932 双字节、空文件、文件不存在抛错，
  以及 `maxBytes` 的三条：未超限时内容完整、超限时落在整行边界、CP932 双字节不被切断。
- 真实工程（画蛇添足版）：日志 `utf8Bom`/`ERB`/`config` 读取 lossy=0；ERB 树 300 文件抽样 lossy=0、cp932=0（与画像 §2.8 的 30 样本结论一致：该魔改版全 UTF-8）。

- **更新**：2026-10-20（新增 `maxBytes` 限流与 `totalBytes`/`truncated` 字段）
