import type { KnowledgeEntry } from '../types.js';

/**
 * 解释器编码纪律。
 * 正本：shared-trae `knowledge/lazyloading/encoding-discipline.md`（2026-10-20，
 * EncodingHandler 源码取证 + PowerShell 8 用例实证）。本副本为产品内嵌快照。
 */
export const encodingDisciplineEntry: KnowledgeEntry = {
  id: 'interpreter-encoding-discipline',
  domain: 'encoding',
  title: '解释器编码纪律（Emuera 文件读写）',
  summary:
    '引擎只认 UTF-8（带 BOM 最稳）与 CP932；GBK/Big5 静默乱码不报错；带 BOM+坏字节响亮失败、无 BOM+坏字节静默损坏；引擎从不写脚本数据文件。',
  tags: ['编码', 'encoding', 'BOM', 'CP932', 'Shift_JIS', 'SJIS', 'UTF-8', '乱码', 'GBK', 'Big5', '文字コード', 'EncodingHandler'],
  rules: [
    {
      id: 'enc-01',
      text: '只信任两种脚本编码：UTF-8（带 BOM 最稳）与 CP932。GBK/Big5/EUC-JP 会被当成 CP932 静默乱码，引擎不报错。',
    },
    {
      id: 'enc-02',
      text: '新建 .ERB/.ERH 一律 UTF-8 带 BOM；既有文件保持原编码、原 BOM、原行尾，不做任何编码互转。',
    },
    {
      id: 'enc-03',
      text: '改文件用定点替换（replace_in_file），禁止整篇重写；写后复检 BOM 有无与行尾（CRLF/LF）是否与改前一致。',
    },
    {
      id: 'enc-04',
      text: '禁止用 PowerShell Set-Content / Out-File 或 shell echo 写脚本和 CSV——默认 ANSI/UTF-16 落盘即毁文件。',
    },
    {
      id: 'enc-05',
      text: '启动引擎前保存并关闭编辑器：引擎探测编码时以独占方式打开文件，文件被占用会静默按 CP932 解码。',
    },
    {
      id: 'enc-06',
      text: '保存必须更新文件 mtime：引擎懒加载索引（lazyloading.bin）按 mtime 判断 ERB 是否变更，保留旧时间戳会让新函数不被加载。',
    },
    {
      id: 'enc-07',
      text: '带 BOM 的 UTF-8 若含非法字节，引擎响亮报错（日志出现「文字コード異常」或「打开文件失败」）；无 BOM 文件含坏字节则静默损坏。报错比乱码好排查——优先保持 BOM。',
    },
    {
      id: 'enc-08',
      text: 'CSV 一律用带 BOM 的 UTF-8：可绕开引擎 CSV 源行回显按 CP932 解码的缺陷（错误行原文显示乱码/抛异常）。',
    },
  ],
  pitfalls: [
    {
      symptom: '加载后大量「未定义函数」',
      cause: '文件编码损坏，引擎中断 ERB 加载（Preload 警告 + 打开文件失败 + 加载中止）',
      fix: '查日志里「文字コード異常。文字コードを確認してください（SJIS,UTF-8推奨）」「打开文件失败」两条消息，定位到具体文件后按原编码修复',
    },
    {
      symptom: '游戏内文字是乱码或半角片假名',
      cause: '文件被存成 GBK/Big5，字节大多合法 CP932，被静默解码（不抛异常）',
      fix: '确认原编码后整体转为 UTF-8 BOM；先读一个样本文件确认，不要盲目转码',
    },
    {
      symptom: '改了口上/函数却没生效',
      cause: '写入保留了旧 mtime，懒加载索引未重建',
      fix: '用正常保存（更新 mtime）后重启引擎；不要用保留时间戳的方式写文件',
    },
    {
      symptom: '日志说打不开文件，但编辑器里明明能打开',
      cause: '编辑器独占打开文件，引擎 DetectEncoding 的 File.Open 不带 FileShare',
      fix: '关闭编辑器再启动游戏',
    },
  ],
  body: `# 解释器编码纪律（快照 2026-10-20）

引擎只有一套编码判定：\`EncodingHandler.DetectEncoding\`（Emuera/Runtime/Utils/EncodingHandler.cs）。
所有脚本/数据文件（ERB/ERH/CSV/als/erd/macro.txt/HOTKEY.ERB/_Rename.csv）都经它。

## 判定四分支

1. 首 3 字节 \`EF BB BF\` → UTF-8（BOM 编码）
2. 否则 StreamReader 探 BOM：FF FE / FE FF → UTF-16LE/BE
3. 否则以 throwOnInvalidBytes 的严格 UTF-8 通读全文件；**一个非法字节即判负**
4. 任何失败/异常 → **CP932（code page 932）**，且 encoder/decoder 均为 ExceptionFallback

BOM 由 StreamReader 无条件剥离（detectEncodingFromByteOrderMarks 默认 true），
首行 \`@LABEL\` 从剥离后首字符判断——带不带 BOM 的首行标签完全等价。

## 支持矩阵

| 输入 | 结果 |
|---|---|
| UTF-8 + BOM，合法 | 正常（最稳） |
| UTF-8 无 BOM，合法 | 正常 |
| CP932 无 BOM | 正常（兜底编码） |
| UTF-16LE/BE + BOM | 正常（但不建议，与工具链不兼容） |
| UTF-8 + BOM + 非法字节 | **抛 DecoderFallbackException**（响亮失败） |
| UTF-8 无 BOM + 非法字节 | **整文件按 CP932 解码**（静默损坏：ASCII 幸存，0xFF→U+F8F3，CJK 全垃圾） |
| GBK/Big5/EUC-JP | **静默乱码**（字节大多合法 CP932，不抛异常；实测「中文」D6 D0 CE C4 → U+FF96 U+FF90 U+FF8E U+FF84 半角假名） |
| 混用 \\n / \\r\\n | 正常（ReadLine 三者全吃） |

## 失败链路（编码损坏的 .ERB）

Preload 读行抛异常 → Warn「文字コード異常…（SJIS,UTF-8推奨）」并跳过该文件 →
ErbLoader 打开文件失败 → 加载整体中止。**先找这两条日志消息，不要从「未定义函数」反查。**

## 写侧保证（引擎写什么）

引擎**从不写**脚本与数据文件（.ERB/.CSV/.ERH/.erd/.als/_Rename.csv/*.config 只读）。
引擎会写：emuera.config / sav / emuera.log / macro.txt / debug/* / setting.json / 懒加载表
（config/sav/log/macro 均为 UTF-8 **带 BOM**；读档自动识别编码，手工改档位只要编码合法仍可读）。

## 已知引擎缺陷

1. CSV 源行回显按 CP932 解码（Process.cs:724 把 ErbDir 传给 DetectEncoding）→ CSV 用带 BOM UTF-8 绕开。
2. DetectEncoding 的 File.Open 无 FileShare → 编辑器独占打开时静默走 CP932 → 保存后关编辑器再启动。
3. 懒加载表按 mtime 判断变更 → 保存必须更新 mtime。

## 误区

- \`useLanguage\`（DEFAULT ANSI ENCODING）**不影响文件读取编码**，只影响 STRLENU 等字节计数。
- 引擎不随系统 ANSI 代码页读文件。
- 没有用户可配的「读取编码」项；引擎官方建议就是「SJIS, UTF-8」。

> 完整正本（含全部路径:行号证据与实证记录）：shared-trae \`knowledge/lazyloading/encoding-discipline.md\`。
`,
  source: {
    upstream: 'shared-trae/knowledge/lazyloading/encoding-discipline.md',
    sha: '606670c',
    snapshotAt: '2026-10-20',
  },
};
