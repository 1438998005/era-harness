# Emuera Skia 日志格式规范（eratw 画蛇添足版实测）

> 来源：`eratw-sub-modding-main` 实测日志（2026-09 ~ 2026-10，引擎 Skiav10.1 / Skiav16）。
> 本文件是 `src/log/parser.ts` 的行为规格；与代码冲突时以代码 + 新实测为准。

## 1. 日志产物清单

| 产物 | 说明 |
|---|---|
| `YYYYMMDD-HHMMSS.log` | 每次运行生成一份，根目录累积 |
| `emuera.log` | 最近一次运行的副本（内容与最新日期日志一致） |
| `bad/bad_apple*.txt` | **已实测为 `@` 字符墙，无任何错误文本**，不要作为错误来源 |

harness 读取策略：优先取根目录最新的 `YYYYMMDD-HHMMSS.log`；`emuera.log` 为兜底。

## 2. 日志结构

```
# 环境信息
Emuera.NET SkiaSharp 1824+v24+EMv18+EEv56+Skiav16     ← 引擎版本行
                                                       （空行）
# 变体
eraThe World【画蛇添足版】 0.00                        ← 游戏名 + 版本号
                                                       （空行）
# 日志
                                                       （空行）
如果出现了错误，请根据目录下的报错指导文件进行报错          ← 固定说明（headerNotes）
注意：外部插件功能已启用。因该功能引发的问题不在Emuera支持范围内
已记录 2262 个文件到懒加载索引表中                      ← 会话信息
警告Lv2:<路径>:第<N>行:<消息>                           ← 诊断行
<源码行>                                               ← 源码片段（可多行）
……
发生了预期以外的错误:<引擎版本串>                        ← 致命错误块（罕见但致命）
<异常类>:<异常消息>
由于ERB脚本出现无法解释的行，Emuera停止运行
※……
已修改的文件：16                                       ← 尾部统计
文件读取完成。耗时：1.95 秒
字典加载完毕 用时35毫秒
```

## 3. 诊断行格式

```
警告Lv(\d+):(.+):第(\d+)行:(.*)
```

- **LvN**：严重度，N 越小越严重（实测 Lv1/Lv2；`MINIMUM WARNING LEVEL:0` 时可能出现 Lv0）
- **路径**：相对路径，反斜杠分隔，可含中文/方括号/逗号/空格；用 `:第N行:` 锚定切分
- **行号**：1 基；引擎可能输出 `第0行`（如 `[SKIPEND]` 类）
- **消息**：位置前缀之后的全部文本
- **源码片段**：诊断行之后连续的non-marker行，直到空行或下一个 marker 行；原样保留

## 4. 致命错误块

以 `发生了预期以外的错误:<引擎版本串>` 开头，随后：

- 首个匹配 `^([A-Za-z_][\w.]*):(.*)$` 的行 → `exceptionClass` / `exceptionMessage`（如 `MinorShift.Emuera.Runtime.Utils.CodeEE:意料之外的行连接结束符号'}'`）
- 含 `Emuera停止运行` 的行 → 停止通知
- 其余行（`※` 兼容性提示、`日志已保存至…` 等）→ `detailLines`

**这是 AI 闭环的最高优先级信号**：出现即游戏无法启动，必须优先于一切警告处理。

## 5. 会话信息行模式

| 模式 | 字段 |
|---|---|
| `已记录 N 个文件到懒加载索引表中` | `lazyIndexCount` |
| `未找到懒加载索引表文件…` | `lazyIndexRegenerated` |
| `已更新 LazyLoading 索引表` | `lazyIndexUpdated` |
| `已修改的文件：N` / `未修改的文件：N` | `modifiedFileCount` / `unmodifiedFileCount` |
| `文件读取完成。耗时：X 秒` | `loadSeconds` |
| `字典加载完毕 用时N毫秒` | `dictLoadMs` |

## 6. 诊断分类表（taxonomy）

| kind | 消息特征（实测样例） | 抽取字段 | Lv |
|---|---|---|---|
| `unresolved-identifier` | `无法解析的标识符"X"` | identifier | 2 |
| `variable-not-in-function` | `变量"X"未在此函数中定义` | identifier | 2 |
| `continue-outside-loop` | `在REPEAT, FOR, WHILE, DO语法以外使用了"CONTINUE"` | — | 2 |
| `missing-next` | `缺少"FOR"对应的"NEXT"` | — | 2 |
| `callf-non-function` | `对未被标记为#FUNCTION的函数"@X"使用了CALLF系列的命令进行调用` | functionName | 2 |
| `unparseable-line` | `无法解析的行` | — | 2 |
| `hash-line-not-after-declaration` | `#行只能在函数声明后立刻使用` | — | 1 |
| `skipend-missing` | `[SKIPEND]不存在` | — | 1 |
| `chara-array-too-many-args` | `角色一维数组变量"X"的参数过多` | identifier | 2 |
| `unclosed-triple-quote` | `没有闭合的"""` | — | 2 |
| `arg-type-mismatch` | `不能将"@X"的第N个参数从字符串型转换为整型` | functionName, argIndex | 2 |
| `unmatched-percent` | `发现没有对应'%'的'%'` | — | 2 |
| `text-after-command` | `以命令开始的行在命令后有半角空格和水平制表符以外的文字` | — | 2 |
| `fatal-unexpected-error` | 致命错误块（见 §4） | exceptionClass 等 | fatal |
| `other` | 未匹配任何规则（保留原文） | — | — |

## 7. AI 闭环使用约定

1. **优先级**：fatalError > severity 升序 > 高频 identifier（`summarizeDiagnostics` 给出排行）。
2. **噪音纪律**（来自 AGENTS.md）：`MINIMUM WARNING LEVEL:0` + `FUNCTION NOT CALLED WARNING:ONCE` 会刷大量 Lv1 警告，**不得为消警告而改逻辑**；只在用户要求或确认是真 bug 时处理。
3. **简繁/ERD 是最高频痛点**：`unresolved-identifier` 的大量积压通常来自繁体口上引用简体 ERD 名（如 `兒童人数` vs `儿童人数`），修复前必须查 `CSV/*.als` / `_Rename.csv` 确认正确拼写，**不要猜测**。
4. **动态调用盲区**：日志只能发现加载期问题；`CALLFORM/CALLSTR/EVAL` 类运行时错误日志里看不到，索引器需单独处理。

## 8. 已知边界

- **日志文件带 UTF-8 BOM**（实测），解析前必须剥离，否则首行 `# 环境信息` 匹配失败导致引擎版本丢失。
- 源码片段按“空行/marker 行”截止；游戏输出（`<img …>` 等）若紧贴诊断行无空行会被误并入片段（实测未出现）。
- 懒加载开启时（`USELAZYLOADING:YES`），未加载文件的诊断可能延迟到实际调用后才出现——单次日志“干净”不等于没问题。
- 日志编码为 UTF-8；游戏脚本本身可能是 Shift-JIS/CP932，读取脚本时另做探测。
