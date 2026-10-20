# 项目画像格式规范（ProjectProfile）

> `src/profile/` 的行为规格。输入 eratw 工程根目录，输出结构化 JSON 画像，是上下文装配器/AI "读懂工程" 的入口。

## 1. 输入约定

- **纯只读**；根目录不存在 → 抛错；其余任何文件缺失 → 降级为空值，不抛异常。
- 依赖的 eratw 标准结构：`emuera.config`、`lazyloading.cfg`、`Emuera*.exe`、`ERB/DIM.ERH`、`ERB/DIM_als.ERH`、`ERB/口上・メッセージ関連/個人口上/`、`ERB/魔改内容/`、`CSV/*.als` + `*.csv`、`CSV/Chara/`。
- 目录名为 era 系通用日文名；非 eratw 工程"缺啥降级啥"，不报错。

## 2. 输出结构（ProjectProfile）

| 字段 | 内容 |
|---|---|
| `root` / `profiledAt` | 工程绝对路径 / ISO 时间戳 |
| `engine.exeFiles` | 根目录 `Emuera*.exe` 列表（新版本在前） |
| `engine.configFound` | `emuera.config` 是否存在 |
| `engine.lazyLoadingEntries` | `lazyloading.cfg` 的懒加载目录行 |
| `config` | `{ entries, lookup }`；查找大小写不敏感 |
| `variant` | `{ nowVersion, eraVersion, subVersion }`（来自 DIM 常量，剥离 `@` 与引号） |
| `scale` | `{ erbFileCount, csvFileCount, totalBytes }` |
| `directories` | ERB/ 顶层段 `[{ name, fileCount, erbCount }]`，按文件数降序 |
| `variableFamilies` | `[{ name, alsEnumCount, csvEnumCount, sampleNames }]`，按枚举总数降序 |
| `characters.charaCsvCount` | `CSV/Chara/` 下 CSV 数 |
| `koujo` | `{ present, personalDirCount }` |
| `modding.moddingDirPresent` | `ERB/魔改内容/` 是否存在 |
| `encoding` | `{ sampledFiles, utf8Bom, utf8, cp932, unknown }` |
| `hints` | 派生观察（见 §4） |

## 3. 解析规则

- **config**：`KEY:VALUE` 行；`;`/`#` 注释；空行忽略；`YES`/`NO` → boolean，纯数字 → number。
- **DIM.ERH**：`#DIM CONST 名 = 值` / `#DIMS CONST 名 = "串"` / `= @"FORM"`；`;` 开头的注释行不算；同时统计全部 `#DIM` 行数。
- **.als**：`ID,名称` 行；**名称保留首个逗号后的全部内容**（als 严格两列）。
- **.csv**：按逗号分列，**只取前两列**——era 的 .csv 可能是多列数据文件（`Item.csv` 第三列起是价格，`Talent.csv` 第三列起是注释），名称取第二列。
- **目录扫描**：ERB/ 递归，按顶层段聚合；`.ERB` 匹配大小写不敏感。
- **编码探测**：BOM(EF BB BF) → UTF-8 严格解码成功 → CP932 兜底；UTF-16 BOM 记 `unknown`；只读前 1KB；等距取样默认 30 个。
- **家族过滤**：跳过 `_` 前缀（`_Rename.csv` 等）与 `VariableSize`。

## 4. hints 生成规则

| 条件 | 提示 |
|---|---|
| `USELAZYLOADING=YES` | 懒加载已开启：诊断可能延迟，单次日志干净≠无问题 |
| `ALLOW DEBUG COMMANDS=YES` | 调试指令已允许 |
| `USE ERD=YES` | ERD 命名生效 |
| `_Rename`/`_Replace=YES` | 启动时重命名标识符，静态索引需还原 |
| `MINIMUM WARNING LEVEL=0` | 警告量大，勿为消警告改逻辑 |
| `SEARCH SUBFOLDERS=YES` | 递归加载+按文件名排序，索引可依赖 |
| exe > 1 个 | 实际行为以启动的为准 |
| 口上目录存在 | 個人口上 N 个角色目录 |
| 魔改内容存在 | 自研代码集中地，先判身份 |
| N 个家族 als+csv 并存 | 简繁双语命名，修标识符必须查证 |
| 采样有 CP932 | 读写必须编码探测 |

## 5. 实测基准（2026-10-15，画蛇添足版 V16）

```
引擎 exe : Emuera_skiaV16_x64.exe, Emuera_skiaV10_x64.exe
版本     : NOW_VERSION=20261013  eraTW=4.981
规模     : ERB 4095 / CSV 208 / 171.9 MB
口上     : 個人口上 155 个角色目录；Chara CSV 168
编码     : 30 样本 = BOM 27 + UTF-8 3 + CP932 0
家族     : 22 个双语并存；STR.csv 1986 条；Item.csv 多列
```

## 6. 已知边界

- 全量 `stat` 顺序执行，4095 文件约数百毫秒；更大工程可并行化（未做）。
- CP932 探测只看前 1KB；纯 ASCII 的 CP932 文件会被误判为 UTF-8（无法区分，可接受）。
- 画像**不含** ERB 内容索引（label/函数/宏）——那是 Phase 2 双层索引的职责。
- 变量家族只统计根目录 `CSV/*.als|csv`，不含子目录。
