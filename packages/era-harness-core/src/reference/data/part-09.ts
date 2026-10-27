// 本文件由 scripts/build-reference.ts 生成，请勿手工修改。
//
// 数据来源：https://github.com/qirchen421/emuera.sk.doc  docs/Reference、docs/Emuera、docs/tutorial/*.zh.md
// 上游版本：41451be6091363e37ed066aaf04416decbf0127f
// 许可：CC BY-NC 4.0（http://creativecommons.org/licenses/by-nc/4.0/）
//       与本仓库代码的 Apache-2.0 分开管理，见 NOTICE-emuera-sk-doc.md
import type { ReferenceEntry } from '../types.js';

export const ENTRIES_PART_09: readonly ReferenceEntry[] = [
  {
    "id": "SQL_READER",
    "title": "SQL Reader 操作",
    "names": [
      "SQL_READER_READ",
      "SQL_READER_GET_LONG",
      "SQL_READER_GET_STRING",
      "SQL_READER_GET_FLOAT",
      "SQL_READER_ISNULL",
      "SQL_READER_CLOSE",
      "STR",
      "SQL",
      "SQL_READER"
    ],
    "signatures": [
      {
        "name": "SQL_READER_READ",
        "params": "`int`",
        "returns": "`int`",
        "engines": [
          "net"
        ],
        "overloads": []
      },
      {
        "name": "SQL_READER_GET_LONG",
        "params": "`int`, `int`",
        "returns": "`int`",
        "engines": [
          "net"
        ],
        "overloads": []
      },
      {
        "name": "SQL_READER_GET_STRING",
        "params": "`int`, `int`",
        "returns": "`string`",
        "engines": [
          "net"
        ],
        "overloads": []
      },
      {
        "name": "SQL_READER_GET_FLOAT",
        "params": "`int`, `int`",
        "returns": "`float`",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "SQL_READER_ISNULL",
        "params": "`int`, `int`",
        "returns": "`int`",
        "engines": [
          "net"
        ],
        "overloads": []
      },
      {
        "name": "SQL_READER_CLOSE",
        "params": "`int`",
        "returns": "`int`",
        "engines": [
          "net"
        ],
        "overloads": []
      }
    ],
    "summary": "SQLite 查询结果（Reader）的读取与操作相关函数。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int SQL_READER_READ readerId\n    int SQL_READER_GET_LONG readerId, columnIndex\n    str SQL_READER_GET_STRING readerId, columnIndex\n    float SQL_READER_GET_FLOAT readerId, columnIndex\n    int SQL_READER_ISNULL readerId, columnIndex\n    int SQL_READER_CLOSE readerId\n    ```\n\n    SQLite 查询结果（Reader）的读取与操作相关函数。\n\n    - `SQL_READER_READ`：将 Reader 前进到下一行。有数据返回 `1`，无更多行返回 `0`。\n    - `SQL_READER_GET_LONG`：获取当前行指定列（从 0 开始）的整数值。\n    - `SQL_READER_GET_STRING`：获取当前行指定列的字符串值。\n    - `SQL_READER_GET_FLOAT`：获取当前行指定列的浮点数值。\n    - `SQL_READER_ISNULL`：判断当前行指定列是否为 NULL，是返回 `1`，否返回 `0`。\n    - `SQL_READER_CLOSE`：关闭 Reader 并释放资源。返回 `1`。\n\n    !!! warning \"注意\"\n\n        - `readerId` 由 `SQL_EXECUTE_READER` 返回。\n        - 读取列值前必须先调用 `SQL_READER_READ` 至少一次。\n        - 使用完毕后**必须**调用 `SQL_READER_CLOSE` 关闭，否则会泄漏资源。\n        - `columnIndex` 从 0 开始。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        SQL_CONNECTION_OPEN \"test\"\n        SQL_EXECUTE_NONQUERY \"test\", \"CREATE TABLE IF NOT EXISTS data (k TEXT, v INTEGER, f REAL)\"\n        SQL_EXECUTE_NONQUERY \"test\", \"INSERT INTO data VALUES ('a', 10, 3.14)\"\n        SQL_EXECUTE_NONQUERY \"test\", \"INSERT INTO data VALUES ('b', NULL, NULL)\"\n\n        LOCAL = SQL_EXECUTE_READER(\"test\", \"SELECT * FROM data\")\n        REPEAT 100\n            SIF !SQL_READER_READ(LOCAL)\n                BREAK\n            PRINTFORM %SQL_READER_GET_STRING(LOCAL, 0)%:\n            SIF SQL_READER_ISNULL(LOCAL, 1)\n                PRINT NULL\n            SIF !SQL_READER_ISNULL(LOCAL, 1)\n                PRINTFORM {SQL_READER_GET_LONG(LOCAL, 1)}\n            PRINTFORM  /\n            SIF SQL_READER_ISNULL(LOCAL, 2)\n                PRINT NULL\n            SIF !SQL_READER_ISNULL(LOCAL, 2)\n                PRINTFORM {SQL_READER_GET_FLOAT(LOCAL, 2)}\n            PRINTL\n        REND\n        SQL_READER_CLOSE LOCAL\n\n        SQL_DISCONNECT \"test\"\n        WAIT\n    ```",
    "sourcePath": "docs/Reference/SQL_READER.zh.md"
  },
  {
    "id": "SQL_XML",
    "title": "SQL XML 导入导出",
    "names": [
      "SQL_IMPORT_MAP_XML",
      "SQL_IMPORT_DT_XML",
      "SQL_EXPORT_MAP_XML",
      "SQL_EXPORT_DT_XML",
      "SQL_IMPORT_XML_CUSTOM",
      "SQL",
      "XML",
      "SQL_XML"
    ],
    "signatures": [
      {
        "name": "SQL_IMPORT_MAP_XML",
        "params": "`string`, `string`, `string`",
        "returns": "`int`",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "SQL_IMPORT_DT_XML",
        "params": "`string`, `string`, `string`, `string`",
        "returns": "`int`",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "SQL_EXPORT_MAP_XML",
        "params": "`string`, `string`, `string`",
        "returns": "`int`",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "SQL_EXPORT_DT_XML",
        "params": "`string`, `string`, `string`, `string`",
        "returns": "`int`",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "SQL_IMPORT_XML_CUSTOM",
        "params": "`string`, `string`, `string`, `string`, `string`",
        "returns": "`int`",
        "engines": [
          "skia"
        ],
        "overloads": []
      }
    ],
    "summary": "SQLite 数据库与 XML 文件之间的导入导出相关函数。支持 MAP 格式、DataTable 格式和自定义格式的 XML 互操作。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int SQL_IMPORT_MAP_XML dbName, tableName, filePath\n    int SQL_IMPORT_DT_XML dbName, tableName, schemaPath, dataPath\n    int SQL_EXPORT_MAP_XML dbName, tableName, filePath\n    int SQL_EXPORT_DT_XML dbName, tableName, schemaPath, dataPath\n    int SQL_IMPORT_XML_CUSTOM dbName, tableName, filePath, rowXPath, columnMappings\n    ```\n\n    SQLite 数据库与 XML 文件之间的导入导出相关函数。支持 MAP 格式、DataTable 格式和自定义格式的 XML 互操作。\n\n    - `SQL_IMPORT_MAP_XML`：将 MAP 格式的 XML 文件（`<map><p><k>key</k><v>value</v></p></map>`）导入到 SQLite 表。自动创建表（`k TEXT PRIMARY KEY, v TEXT`）并使用 `INSERT OR REPLACE`。成功返回 `1`。\n    - `SQL_IMPORT_DT_XML`：将 DataTable 格式的 XML 文件（Schema + Data）导入到 SQLite 表。根据 Schema 自动推断列类型（INTEGER / TEXT）。成功返回 `1`。\n    - `SQL_EXPORT_MAP_XML`：将 SQLite 表导出为 MAP 格式的 XML 文件。成功返回 `1`。\n    - `SQL_EXPORT_DT_XML`：将 SQLite 表导出为 DataTable 格式的 XML 文件（Schema + Data）。成功返回 `1`。\n    - `SQL_IMPORT_XML_CUSTOM`：将自定义格式的 XML 文件导入到 SQLite 表。通过 `rowXPath` 指定行节点路径，通过 `columnMappings` 指定列映射（格式：`\"ColName1=childNode,ColName2=@attr\"`）。所有列类型为 TEXT。成功返回 `1`。\n\n    !!! warning \"注意\"\n\n        - 执行前必须先通过 `SQL_CONNECTION_OPEN` 或 `SQL_CONNECT` 建立连接。\n        - `SQL_IMPORT_MAP_XML` 和 `SQL_IMPORT_DT_XML` 使用流式解析（XmlReader），支持大文件。\n        - `SQL_IMPORT_DT_XML` 的 Schema 文件用于推断列类型，Data 文件包含实际数据。\n        - 导出文件路径相对于程序目录。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        SQL_CONNECTION_OPEN \"mydb\"\n\n        ; 从 MAP XML 导入\n        SQL_IMPORT_MAP_XML \"mydb\", \"config\", \"data/config_map.xml\"\n\n        ; 从 DT XML 导入\n        SQL_IMPORT_DT_XML \"mydb\", \"items\", \"data/items_schema.xml\", \"data/items_data.xml\"\n\n        ; 导出为 MAP XML\n        SQL_EXPORT_MAP_XML \"mydb\", \"config\", \"output/config_export.xml\"\n\n        ; 导出为 DT XML\n        SQL_EXPORT_DT_XML \"mydb\", \"items\", \"output/items_schema.xml\", \"output/items_data.xml\"\n\n        SQL_DISCONNECT \"mydb\"\n        WAIT\n    ```",
    "sourcePath": "docs/Reference/SQL_XML.zh.md"
  },
  {
    "id": "SQRT",
    "title": "SQRT",
    "names": [
      "SQRT"
    ],
    "signatures": [
      {
        "name": "SQRT",
        "params": "`int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "返回参数的平方根。由于小数部分会被舍去，建议在使用前先将数值放大。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint SQRT int\n    ```\n    返回参数的平方根。由于小数部分会被舍去，建议在使用前先将数值放大。\n\n!!! hint \"提示\"\n\n    该函数同时支持指令和表达式函数两种用法。\n\n### 相关项目\n- CBRT, LOG, LOG10, EXPOMENT",
    "sourcePath": "docs/Reference/SQRT.zh.md"
  },
  {
    "id": "STOPBGM",
    "title": "STOPBGM",
    "names": [
      "STOPBGM"
    ],
    "signatures": [
      {
        "name": "STOPBGM",
        "params": "`void`",
        "returns": "`void`",
        "engines": [
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "停止 PLAYBGM 正在播放的音轨。",
    "body": "!!! info \"API\"\n\n    ```erb\n    STOPBGM\n    ```\n\n    停止 `PLAYBGM` 正在播放的音轨。\n\n!!! hint \"提示\"\n\n    只能作为命令使用。\n\n### 相关项目\n- PLAYBGM",
    "sourcePath": "docs/Reference/STOPBGM.zh.md"
  },
  {
    "id": "STOPCALLTRAIN",
    "title": "STOPCALLTRAIN",
    "names": [
      "STOPCALLTRAIN"
    ],
    "signatures": [
      {
        "name": "STOPCALLTRAIN",
        "params": "无",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "如果在 CALLTRAIN 指令正在运行时被调用，则会立即终止 CALLTRAIN 的处理。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tSTOPCALLTRAIN\n    ```\n\t如果在 `CALLTRAIN` 指令正在运行时被调用，则会立即终止 CALLTRAIN 的处理。\n\t其他情况下不执行任何操作。\n\n!!! hint \"提示\"\n\n    仅支持命令形式。\n\n### 相关项目\n- CALLTRAIN",
    "sourcePath": "docs/Reference/STOPCALLTRAIN.zh.md"
  },
  {
    "id": "STOPSOUND",
    "title": "STOPSOUND",
    "names": [
      "STOPSOUND"
    ],
    "signatures": [
      {
        "name": "STOPSOUND",
        "params": "`void`",
        "returns": "`void`",
        "engines": [
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "停止 PLAYSOUND 正在播放的音轨。",
    "body": "!!! info \"API\"\n\n    ```erb\n    STOPSOUND\n    ```\n\n    停止 `PLAYSOUND` 正在播放的音轨。\n\n!!! hint \"提示\"\n\n    只能作为命令使用。\n\n### 相关项目\n- PLAYSOUND",
    "sourcePath": "docs/Reference/STOPSOUND.zh.md"
  },
  {
    "id": "STRCOUNT",
    "title": "STRCOUNT",
    "names": [
      "STRCOUNT"
    ],
    "signatures": [
      {
        "name": "STRCOUNT",
        "params": "`string`, `string`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "获取字符串中指定子字符串的数量的指令。将匹配的数量赋值给RESULT:0或返回该值。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint STRCOUNT string, searchWord\n    ```\n\t获取字符串中指定子字符串的数量的指令。将匹配的数量赋值给`RESULT:0`或返回该值。\n\t搜索字符串的格式遵循C#正则表达式的规范。\n\n!!! hint \"提示\"\n\n    支持指令和表达式函数两种用法。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tPRINTFORML 「も」的数目:{STRCOUNT(\"すもももももももものうち\", \"も\")}\n\t\tPRINTFORMW 半角数字的数目:{STRCOUNT(\"1日1歩 3日で3歩 3歩進んで2歩下がる\", \"[0-9]\")}\n    ```\n    ```text\n\t「も」的数目:8\n\t半角数字的数目:6\n    ```\n\n### 相关项目\n- STRFIND",
    "sourcePath": "docs/Reference/STRCOUNT.zh.md"
  },
  {
    "id": "STRDATA",
    "title": "STRDATA",
    "names": [
      "STRDATA",
      "DATA",
      "DATAFORM",
      "DATALIST",
      "ENDLIST",
      "ENDDATA"
    ],
    "signatures": [
      {
        "name": "STRDATA",
        "params": "`stringVariable`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "此指令用于将字符串赋值给指定的字符串型变量，而非使用 PRINTDATA 来显示字符串。",
    "body": "!!! info \"API\"\n\n    ```erb\n    STRDATA stringVariable\n        DATA\n        DATAFORM\n        DATALIST\n        ENDLIST\n    ENDDATA\n    ```\n    此指令用于将字符串赋值给指定的字符串型变量，而非使用 `PRINTDATA` 来显示字符串。\n    各格式与 `PRINTDATA` 相同，请参阅该页面。\n\n!!! hint \"提示\"\n\n    仅该指令同时支持两种用法。\n### 相关项目\n- PRINTDATA",
    "sourcePath": "docs/Reference/STRDATA.zh.md"
  },
  {
    "id": "STRFIND",
    "title": "STRFIND",
    "names": [
      "STRFIND",
      "STRFINDU"
    ],
    "signatures": [
      {
        "name": "STRFIND",
        "params": "`string`, `string`(, `int`)",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "STRFINDU",
        "params": "`string`, `string`(, `int`)",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "字符串搜索指令。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int STRFIND string, searchWord(, startPosition)\n    int STRFINDU string, searchWord(, startPosition)\n    ```\n    字符串搜索指令。\n    第一参数指定被搜索的目标字符串，使用字符串表达式。第二参数指定要搜索的字符串，使用字符串表达式。\n    `STRFIND` 将全角字符计为2个字符，`STRFINDU` 将全角字符计为1个字符，并返回从0开始的索引。如果未找到，则返回-1。\n    自1.712版本起，STRFIND(U)指令可以指定第三参数。\n    第三参数指定搜索的起始位置，使用从0开始的索引。\n\n    ```erb\n    STRFIND \"abcdeabced\",\"a\",3\n    ```\n\n\t根据上一行的结果，`RESULT` 将被赋值为 `5`。\n\t虽然 `a` 也存在于位置 0，但由于指定了第三参数，搜索将从位置 3（即 `d`）开始，因此找到的第一个 `a` 位于位置 5。\n\n!!! hint \"提示\"\n\n    该功能同时支持命令形式和函数形式。\n\n!!! example \"例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tSTR:0 = abcdefghi\n\t\tSTR:1 = あいうえお\n\t\tSTR:2 = うえ\n\t\tSTRFIND STR:0, \"cde\"\n\t\tPRINTFORML <TEST1> = {RESULT:0}\n\t\tSTRFIND STR:1, \"いうえ\"\n\t\tPRINTFORML <TEST2> = {RESULT:0}\n\t\tSTRFIND STR:1, STR:2\n\t\tPRINTFORML <TEST3> = {RESULT:0}\n\t\tSTRFIND STR:1, \"か\"\n\t\tPRINTFORML <TEST4> = {RESULT:0}\n    ```\n    ```text\n\t<TEST1> = 2\n\t<TEST2> = 2\n\t<TEST3> = 4\n\t<TEST4> = -1\n    ```\n\n### 相关项目\n- STRCOUNT\n- SUBSTRING",
    "sourcePath": "docs/Reference/STRFIND.zh.md"
  },
  {
    "id": "STRFORM",
    "title": "STRFORM",
    "names": [
      "STRFORM",
      "STRFORMCHECK"
    ],
    "signatures": [
      {
        "name": "STRFORM",
        "params": "`string`",
        "returns": "`string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "将给定的字符串视为与PRINTFORM等相同的格式化字符串，并返回展开后的字符串。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tstring STRFORM formedString\n    ```\n    将给定的字符串视为与PRINTFORM等相同的格式化字符串，并返回展开后的字符串。\n\n!!! hint \"提示\"\n\n    同时支持指令和表达式函数两种形式。\n\n---\n\n# STRFORMCHECK [Skia]\n\n| 函数名 | 参数 | 返回值 |\n| :--- | :--- | :--- |\n| [Skia][`STRFORMCHECK`](./STRFORM.zh.md#strformcheck) | `string` | `integer` |\n\n!!! info \"API\"\n\n    ```erb\n\tint STRFORMCHECK formedString\n    ```\n    将给定的字符串视为与STRFORM相同的格式化字符串，判断其是否可展开。可展开返回 `1`，不可展开返回 `0`。\n\n    - 语法错误（如未闭合大括号）→ `0`\n    - 运行时求值失败（如变量不存在）→ `0`\n    - 与STRFORM共享同一套解析器，语义一致性有保证\n\n!!! warning \"注意\"\n\n    由于 `CanRestructure = false`，该函数不是常量折叠的候选。\n\n### 相关项目\n- GETVAR,GETVARS\n- GETMETH,GETMETHS",
    "sourcePath": "docs/Reference/STRFORM.zh.md"
  },
  {
    "id": "STRICT_FONT_FALLBACK",
    "title": "STRICT_FONT_FALLBACK",
    "names": [
      "STRICT_FONT_FALLBACK"
    ],
    "signatures": [
      {
        "name": "STRICT_FONT_FALLBACK",
        "params": "`int`",
        "returns": "void",
        "engines": [
          "skia"
        ],
        "overloads": []
      }
    ],
    "summary": "切换字体回退的严格模式。",
    "body": "!!! info \"API\"\n\n    ```erb\n    STRICT_FONT_FALLBACK value\n    ```\n\n    切换字体回退的严格模式。\n\n    - `value` 设为 `1` 启用严格模式，设为 `0` 禁用\n    - 严格模式启用时，指定字体中不存在字形的字符不会使用回退字体替代，而是显示为 □（tofu）\n    - 严格模式禁用（默认）时，不存在字形的字符会自动使用回退字体绘制\n\n!!! hint \"提示\"\n\n    该功能同时支持指令和表达式函数两种形式。\n\n!!! example \"例\"\n\n    ```erb\n    ; 启用严格模式（无字体回退）\n    STRICT_FONT_FALLBACK 1\n    PRINTL 此文本不会回退到其他字体\n    ; 禁用严格模式（默认回退行为）\n    STRICT_FONT_FALLBACK 0\n    ```\n\n### 関連項目\n- SETFONT\n- SKIA_RENDER",
    "sourcePath": "docs/Reference/STRICT_FONT_FALLBACK.zh.md"
  },
  {
    "id": "STRLEN",
    "title": "STRLEN系",
    "names": [
      "STRLEN",
      "STRLENS",
      "STRLENFORM",
      "STRLENU",
      "STRLENSU",
      "STRLENFORMU"
    ],
    "signatures": [
      {
        "name": "STRLEN",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "STRLENS",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "STRLENFORM",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "STRLENU",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "STRLENSU",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "STRLENFORMU",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "STRLEN、STRLENS、STRLENFORM 用于测量字符串长度，并将结果赋值给 RESULT:0。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tSTRLEN string\n\tint STRLENS string\n\tSTRLENFORM formedString\n\tSTRLENU string\n\tint STRLENSU string\n\tSTRLENFORMU formedString\n    ```\n\t`STRLEN`、`STRLENS`、`STRLENFORM` 用于测量字符串长度，并将结果赋值给 `RESULT:0`。\n\t长度以 `SHIFT-JIS` 编码的字节数为准。即全角字符按 2 个字符计数。\n\n\t`STRLENU`、`STRLENSU`、`STRLENFORMU` 是 Unicode 版本。区别在于全角字符也按 1 个字符计数。\n\n!!! hint \"提示\"\n\n    `STRLENS`、`STRLENSU` 支持在表达式中作为函数使用。\n\n!!! example \"例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tSTRLEN ABCあいう\n\t\tPRINTFORML <TEST1> = {RESULT}\n\t\tSTR:0 = ABCあいう\n\t\tSTRLENS STR:0\n\t\tPRINTFORML <TEST2> = {RESULT}\n\t\tSTRLENFORM abc%STR:0%\n\t\tPRINTFORML <TEST3> = {RESULT}\n\n\t\t;STRLENSは文字列式にも対応\n\t\tSTRLENS \"abc\" + STR:0\n\t\tPRINTFORML <TEST4> = {RESULT}\n\t\tWAIT\n    ```\n    ```text\n\t<TEST1> = 9\n\t<TEST2> = 9\n\t<TEST3> = 12\n\t<TEST4> = 12\n    ```",
    "sourcePath": "docs/Reference/STRLEN.zh.md"
  },
  {
    "id": "SUBSTRING",
    "title": "SUBSTRING",
    "names": [
      "SUBSTRING",
      "SUBSTRINGU"
    ],
    "signatures": [
      {
        "name": "SUBSTRING",
        "params": "`string`, `int`, `int`",
        "returns": "`string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "SUBSTRINGU",
        "params": "`string`, `int`, `int`",
        "returns": "`string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "返回指定字符串表达式中，从第一个参数指定的位置开始、长度为第二个参数指定字符数的子字符串。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tstring SUBSTRING string, startPosition, characterCount\n\tstring SUBSTRINGU string, startPosition, characterCount\n    ```\n\t返回指定字符串表达式中，从第一个参数指定的位置开始、长度为第二个参数指定字符数的子字符串。\n\t起始位置以字符串开头为`0`。如果指定的起始位置超过原字符串长度，则返回空字符串。\n\t对于字符数，`SUBSTRING` 以 SHIFT-JIS 编码的字节数指定。即全角字符计为2个字符。`SUBSTRINGU` 则以 Unicode 字符数计数，全角字符也计为1个字符。\n\t如果指定的字符数为负值，或者指定的结束位置超过原字符串末尾，则返回从起始位置到字符串末尾的字符串。\n\t如果起始位置或结束位置无法在字符边界处切割（例如指向全角字符的中间部分），则会被视为指定了下一个字符边界。\n\t请注意，这可能导致返回的子字符串长度比指定的字符数多一个字符。\n\n!!! hint \"提示\"\n\n    支持命令和表达式函数两种形式。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tSTR:0 = 01234あいうえお\n\t\tSUBSTRING STR:0, 0, -1\n\t\tPRINTFORML <TEST1> = %RESULTS:0%\n\t\tSUBSTRING STR:0, 1, 3\n\t\tPRINTFORML <TEST2> = %RESULTS:0%\n\t\tSUBSTRING STR:0, 6, 3\n\t\tPRINTFORML <TEST3> = %RESULTS:0%\n\t\tWAIT\n    ```\n    ```text\n\t<TEST1> = 01234あいうえお\n\t<TEST2> = 123\n\t<TEST3> = いう\n    ```\n\n### 相关项目\n- STRFIND",
    "sourcePath": "docs/Reference/SUBSTRING.zh.md"
  },
  {
    "id": "SUMARRAY",
    "title": "SUMARRAY",
    "names": [
      "SUMARRAY"
    ],
    "signatures": [
      {
        "name": "SUMARRAY",
        "params": "`integerArray`(, `int`, `int`)",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "此函数用于返回数组值的总和。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint SUMARRAY integerArray(, startIndex, endIndex)\n    ```\n\t此函数用于返回数组值的总和。\n\t指定 `integerArray` 为要求总和的1维数值型数组，并合计 `startIndex` 以上、`endIndex` 未满的元素范围。\n\t若省略 `endIndex`，则合计至数组末尾。\n\t`RESULT = SUMARRAY(X, A, B)` 的结果等同于：\n\n\t\tRESULT = 0\n\t\tFOR COUNT, A, B\n\t\t\tRESULT += X:COUNT\n\t\tREND\n\n\t请注意，被加算的值到 `X:(B - 1)` 为止，`X:B` 不会被加算。\n\t`integerArray` 仅可指定数值型1维数组变量，不能指定字符串变量或多维数组。\n\t若为 `integerArray` 指定了 `CFLAG` 等角色数组，则仅合计指定的角色。\n\n!!! hint \"提示\"\n\n    命令和表达式函数两种形式均支持。",
    "sourcePath": "docs/Reference/SUMARRAY.zh.md"
  },
  {
    "id": "SWAP",
    "title": "SWAP",
    "names": [
      "SWAP"
    ],
    "signatures": [
      {
        "name": "SWAP",
        "params": "`variable`, `variable`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "交换变量1和变量2的内容。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tSWAP variable, variable\n    ```\n\t交换变量1和变量2的内容。\n\t用于交换的两个变量必须是相同类型（整数型与整数型、字符串型与字符串型）。\n\n!!! hint \"提示\"\n\n    仅支持作为指令使用。\n\n!!! example \"例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\t#DIM AAA\n\t\t#DIM BBB\n\n\t\tAAA = 123\n\t\tBBB = 456\n\n\t\tREPEAT 2\n\t\t\tPRINTFORML AAA:{AAA} BBB:{BBB}\n\t\t\tSWAP AAA, BBB\n\t\tREND\n\t\tWAIT\n    ```\n    ```text\n\tAAA:123 BBB:456\n\tAAA:456 BBB:123\n    ```",
    "sourcePath": "docs/Reference/SWAP.zh.md"
  },
  {
    "id": "SWAPCHARA",
    "title": "SWAPCHARA",
    "names": [
      "SWAPCHARA"
    ],
    "signatures": [
      {
        "name": "SWAPCHARA",
        "params": "`int`, `int`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "交换指定两个角色的登记编号 (CharaID)。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tSWAPCHARA charaID, charaID\n    ```\n    交换指定两个角色的登记编号 (CharaID)。\n\n!!! hint \"提示\"\n\n    仅支持指令形式。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\t;假设初始只有MASTER\n\t\tADDCHARA 10\n\t\tADDCHARA 11\n\t\tPRINTFORML NO:1 = {NO:1}, NO:2 = {NO:2}\n\t\tSWAPCHARA 1,2\n\t\tPRINTFORMW NO:1 = {NO:1}, NO:2 = {NO:2}\n    ```\n    ```text\n\tNO:1 = 10, NO:2 = 11\n\tNO:1 = 11, NO:2 = 10\n    ```\n\n### 相关项目\n- SORTCHARA",
    "sourcePath": "docs/Reference/SWAPCHARA.zh.md"
  },
  {
    "id": "TEXT_BGC",
    "title": "TEXT_BGC_ON / TEXT_BGC_OFF",
    "names": [
      "TEXT_BGC_ON",
      "TEXT_BGC_OFF",
      "TEXT_BGC"
    ],
    "signatures": [
      {
        "name": "TEXT_BGC_ON",
        "params": "`int`, `int`, `int`, `int`",
        "returns": "void",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "TEXT_BGC_OFF",
        "params": "无",
        "returns": "void",
        "engines": [
          "skia"
        ],
        "overloads": []
      }
    ],
    "summary": "TEXTBGCON 为后续所有行设置整行背景色。TEXTBGCOFF 清除背景色，恢复透明。",
    "body": "!!! info \"API\"\n\n    ```erb\n    TEXT_BGC_ON R, G, B, Alpha%\n    TEXT_BGC_OFF\n    ```\n\n    `TEXT_BGC_ON` 为后续所有行设置**整行**背景色。`TEXT_BGC_OFF` 清除背景色，恢复透明。\n\n    - `R`, `G`, `B`：背景色的 RGB 值（0～255）\n    - `Alpha%`：不透明度（0～100）。0=完全透明，100=完全不透明\n    - 背景以行全宽（`ClientWidth`）× 行高（`LineHeight`）的矩形绘制\n    - 仅当行内存在实际文本时才绘制背景（空行不绘制）\n    - 设置在调用 `TEXT_BGC_OFF` 之前持续生效\n\n!!! warning \"注意\"\n\n    - 背景色以**行**为单位应用。如需单个文字或 span 级别的背景色，请使用 HTML 内联样式\n    - 不支持嵌套（save/restore）。设置新颜色会覆盖旧颜色\n\n!!! example \"例\"\n\n    ```erb\n    ; 红色背景显示警告文本\n    TEXT_BGC_ON 255, 0, 0, 30\n    PRINTL 警告：HP已降低！\n    TEXT_BGC_OFF\n\n    ; 半透明蓝色背景\n    TEXT_BGC_ON 0, 0, 128, 50\n    PRINTL 这行有蓝色背景\n    PRINTL 这行也是同样的背景色\n    TEXT_BGC_OFF\n    ```\n\n### 関連項目\n- SETCOLOR\n- SETBGCOLOR\n- HTML_PRINT",
    "sourcePath": "docs/Reference/TEXT_BGC.zh.md"
  },
  {
    "id": "TEXTBOX",
    "title": "输入框相关命令",
    "names": [
      "SETTEXTBOX",
      "GETTEXTBOX",
      "MOVETEXTBOX",
      "RESUMETEXTBOX",
      "TEXTBOX"
    ],
    "signatures": [
      {
        "name": "SETTEXTBOX",
        "params": "`string`",
        "returns": "`1`",
        "engines": [
          "ee"
        ],
        "overloads": []
      },
      {
        "name": "GETTEXTBOX",
        "params": "无",
        "returns": "`string`",
        "engines": [
          "ee"
        ],
        "overloads": []
      },
      {
        "name": "MOVETEXTBOX",
        "params": "`int`, `int`, `int`",
        "returns": "`1`",
        "engines": [
          "em"
        ],
        "overloads": []
      },
      {
        "name": "RESUMETEXTBOX",
        "params": "无",
        "returns": "`1`",
        "engines": [
          "em"
        ],
        "overloads": []
      }
    ],
    "summary": "命令 / 行内函数两种写法均有效。",
    "body": "!!! info \"API\"\n\n    ```erb\n    1 SETTEXTBOX text\n    string GETTEXTBOX\n    1 MOVETEXTBOX xPos, yPos, width\n    1 RESUMETEXTBOX\n    ```\n\n    - `SETTEXTBOX`：将输入框内容替换为 `text`。\n    - `GETTEXTBOX`：返回执行时输入框内的字符串。\n    - `MOVETEXTBOX`：下次执行 `INPUT` / `INPUTS` 时将输入框移的宽度设置为`width`，并移动端指定位置。\n        - 基准位置 (`xPos`, `yPos`) = (`0`, `0`) 为画面左下角。`yPos` 为正时向上移动。\n        - 画面向上卷动（浏览历史记录）时，输入框会暂时返回原本位置。\n        - `INPUT` / `INPUTS` 结束后，输入框返回原本位置。\n    - `RESUMETEXTBOX`：无效上一次 `MOVETEXTBOX` 的设置，令输入框返回原本位置。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。",
    "sourcePath": "docs/Reference/TEXTBOX.zh.md"
  },
  {
    "id": "THROW",
    "title": "THROW",
    "names": [
      "THROW"
    ],
    "signatures": [
      {
        "name": "THROW",
        "params": "`string`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "此命令会强制引发错误，并使用给定的参数字符串进行错误显示。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tTHROW formedString\n    ```\n    此命令会强制引发错误，并使用给定的参数字符串进行错误显示。\n\n!!! hint \"提示\"\n\n    仅支持作为命令使用。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tTHROW お気の毒ですが、冒険の書は消えてしまいました\n    ```\n    ```text\n\tNow Loading...\n\tMAIN.ERB第2行发生THROW\n\tTHROW お気の毒ですが、冒険の書は消えてしまいました\n\tTHROW内容：お気の毒ですが、冒険の書は消えてしまいました\n\t当前函数：@SYSTEM_TITLE（MAIN.ERB第1行）\n\t函数调用栈：\n\t※※※日志文件已输出至emuera.log※※※\n    ```",
    "sourcePath": "docs/Reference/THROW.zh.md"
  },
  {
    "id": "TIMES",
    "title": "TIMES",
    "names": [
      "TIMES"
    ],
    "signatures": [
      {
        "name": "TIMES",
        "params": "`int`, `float`",
        "returns": "无",
        "engines": [
          "eramaker"
        ],
        "overloads": []
      }
    ],
    "summary": "将第二参数的浮点数乘以第一参数的变量。默认设置下会舍去小数部分。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tTIMES integerVariable, float\n    ```\n    将第二参数的浮点数乘以第一参数的变量。默认设置下会舍去小数部分。\n\n!!! hint \"提示\"\n\n    仅支持作为指令使用。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\t#DIM HOGE\n\n\t\tHOGE = 100\n\t\tTIMES HOGE, 1.25\n\t\tPRINTFORML {HOGE}\n\t\tTIMES HOGE, 2.672\n\t\tPRINTFORMW {HOGE}\n    ```\n    ```text\n\t125\n\t334\n    ```",
    "sourcePath": "docs/Reference/TIMES.zh.md"
  },
  {
    "id": "TINPUT",
    "title": "TINPUT(S)",
    "names": [
      "TINPUT",
      "TINPUTS"
    ],
    "signatures": [
      {
        "name": "TINPUT",
        "params": "`int`, `int`(, `int`, `string`, `int`)",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "TINPUTS",
        "params": "`int`, `int`(, `int`, `string`, `int`)",
        "returns": "`string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "这是带有时间限制的输入接收命令。第一个参数是时间限制（毫秒），但即使设置小于100ms的值也无法精确运作。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tTINPUT timeLimit, defaultValue(, displayTimeRemain, timeOverMessage, allowClick)\n\tTINPUTS timeLimit, defaultValue(, displayTimeRemain, timeOverMessage, allowClick)\n    ```\n\t这是带有时间限制的输入接收命令。第一个参数是时间限制（毫秒），但即使设置小于100ms的值也无法精确运作。\n\t第二个参数是超时时的默认返回值。\n\t第三个参数控制是否显示剩余时间，0为不显示，其他值为显示。省略时默认为1（显示）。\n\t第四个参数是超时时显示的字符串。如果为空字符串，则会清除计时器显示并继续执行后续处理。\n\t请注意，如果设置了第四个参数，则不能省略第三个参数。\n\t此外，在`TINPUTS`中，与`INPUTS`一样，可以使用宏表达式。\n\t若要在字符串中使用`()`，请使用``进行转义。\n\n    EM+EE中可设置可选的第五个参数。\n    非0时，将鼠标点击视为回车键（向`RESULTS`赋值空字符串。若按下按钮，则将按钮索引赋值给`RESULTS:1`），左键点击时`RESULT:1`设为`1`，右键点击时`RESULT:1`设为`2`。同时，若按下++shift++、++ctrl++、++alt++，则将其按键状态保存至`RESULT:2`。（bit 16 17 18）\n\n!!! hint \"提示\"\n\n    仅支持指令。\n\n### 相关项目\n- INPUT\n- TINPUTNF\n- TONEINPUT",
    "sourcePath": "docs/Reference/TINPUT.zh.md"
  },
  {
    "id": "TINPUTNF",
    "title": "TINPUT(S)NF",
    "names": [
      "TINPUTNF",
      "TINPUTSNF"
    ],
    "signatures": [
      {
        "name": "TINPUTNF",
        "params": "`int`, `int`(, `int`, `string`, `int`)",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "TINPUTSNF",
        "params": "`int`, `int`(, `int`, `string`, `int`)",
        "returns": "`string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "与 TINPUT / TINPUTS 功能完全相同，但不强制滚动到底部。",
    "body": "!!! info \"API\"\n\n    ```erb\n    TINPUTNF timeLimit, defaultValue(, displayTimeRemain, timeOverMessage, allowClick)\n    TINPUTSNF timeLimit, defaultValue(, displayTimeRemain, timeOverMessage, allowClick)\n    ```\n    与 `TINPUT` / `TINPUTS` 功能完全相同，但**不强制滚动到底部**。\n\n    NF = NoFocus。执行时进入 `WaitInputNoFocus` 状态，与 `WaitInput` 的唯一区别是不调用文本框定位，因此用户可以自由滚动浏览历史输出。\n\n    效果：\n    - ✅ 按钮高亮和 Tooltip 正常工作\n    - ✅ 输入可靠性（引擎原生输入管线）\n    - ✅ 用户可自由滚动，滚动位置不会被强制拉回底部\n    - ✅ 超时机制与原版 TINPUT 相同\n\n    参数和返回值与原版完全一致，参见 `TINPUT` / `TINPUTS`。\n\n!!! hint \"提示\"\n\n    仅支持指令。\n\n### 典型用途\n\n需要定时刷新界面但又不希望强制滚动的场景——例如动态地图动画、实时标题画面等。\n\n```erb\n; 动态地图动画：每帧刷新，按钮可点击，用户可自由滚动\n$MAP_LOOP\nCALL DRAW_MAP\nIF ANIM_INTERVAL > 0\n    TINPUTSNF ANIM_INTERVAL, \"UPDATE\", 0, \"\"\nELSE\n    INPUTS\nENDIF\nSELECTCASE RESULTS\nCASE \"UPDATE\"\n    ; 超时 → 刷新动画帧\n    GOTO MAP_LOOP\nCASEELSE\n    ; 用户点击按钮 → 正常处理\nENDSELECT\n```\n\n### 相关项目\n- TINPUT\n- TONEINPUTNF\n- AWAIT",
    "sourcePath": "docs/Reference/TINPUTNF.zh.md"
  },
  {
    "id": "TOINT",
    "title": "TOINT, ISNUMERIC, TOFLOAT",
    "names": [
      "TOINT",
      "ISNUMERIC",
      "TOFLOAT"
    ],
    "signatures": [
      {
        "name": "TOINT",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "ISNUMERIC",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "TOFLOAT",
        "params": "`string`",
        "returns": "`float`",
        "engines": [
          "skia"
        ],
        "overloads": []
      }
    ],
    "summary": "TOINT 将参数字符串数值化，并将结果赋值给 RESULT:0 或直接返回。但是，只有由半角数字构成的字符串才能被数值化。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint TOINT string\n\tint ISNUMERIC string\n    ```\n    `TOINT` 将参数字符串数值化，并将结果赋值给 `RESULT:0` 或直接返回。但是，只有由半角数字构成的字符串才能被数值化。\n    如果参数无法被解释为数值，则将 `0` 赋值给 `RESULT:0` 或直接返回。全角数字的情况也同样处理。\n    当传入的值不确定时，在 `TOINT` 之前使用 `ISNUMERIC` 可以提高代码的稳定性。\n\n    `ISNUMERIC` 用于判断字符串是否可以被解析为数值（即是否可以通过 `TOINT` 获取值）。\n    如果参数可以被解释为数值，则将 `1` 赋值给 `RESULT:0` 或直接返回；否则，赋值或返回 `0`。\n\n!!! hint \"提示\"\n\n    该函数同时支持作为指令和表达式函数使用。\n\n!!! example \"例\"\n\n    ```erb\n    @SYSTEM_TITLE\n        #DIMS HOGES\n        REPEAT 3\n            SELECTCASE COUNT\n                CASE 0\n                    HOGES = 123\n                CASE 1\n                    HOGES = 一二三\n                CASE 2\n                    HOGES = １２３\n            ENDSELECT\n            IF ISNUMERIC(HOGES)\n                PRINTFORML 变量HOGES可以转换为数值类型({TOINT(HOGES)})\n            ELSE\n                PRINTFORML 变量HOGES无法转换为数值类型(%HOGES%)\n            ENDIF\n        REND\n        WAIT\n    ```\n    ```text\n    变量HOGES可以转换为数值类型(123)\n    变量HOGES无法转换为数值类型(一二三)\n    变量HOGES无法转换为数值类型(１２３)\n    ```\n\n!!! info \"API — TOFLOAT\"\n\n    [Skia] Skia 新增\n\n    ```erb\n\tfloat TOFLOAT string\n    ```\n    将字符串转换为浮点数。\n    将参数字符串解释为浮点数，并将结果赋值给 `RESULTF:0` 或直接返回。\n    如果参数无法被解释为数值，则将 `0.0` 赋值给 `RESULTF:0` 或直接返回。\n\n!!! hint \"提示\"\n\n    该函数同时支持作为指令和表达式函数使用。\n\n!!! example \"例\"\n\n    ```erb\n    @SYSTEM_TITLE\n        #DIMF L_F\n        L_F = TOFLOAT(\"3.14\")          ; → 3.14\n        L_F = TOFLOAT(\"-1.5e2\")        ; → -150.0\n        L_F = TOFLOAT(\"abc\")           ; → 0.0（解析失败）\n        PRINTFORML {L_F}\n        WAIT\n    ```\n    ```text\n    0.0\n    ```\n\n### 相关项目\n- TOSTR",
    "sourcePath": "docs/Reference/TOINT.zh.md"
  },
  {
    "id": "TONEINPUT",
    "title": "TONEINPUT",
    "names": [
      "TONEINPUT",
      "TONEINPUTS"
    ],
    "signatures": [
      {
        "name": "TONEINPUT",
        "params": "`int`, `int`(, `int`, `string`, `int`)",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "TONEINPUTS",
        "params": "`int`, `string`(, `int`, `string`, `int`)",
        "returns": "`string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "参数分别与 TINPUT、TINPUTS 相同。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tTONEINPUT timeLimit, defaultValue(, displayTimeRemain, timeOverMessage, allowClick)\n\tTONEINPUTS timeLimit, defaultValue(, displayTimeRemain, timeOverMessage, allowClick)\n    ```\n\t参数分别与 `TINPUT`、`TINPUTS` 相同。\n\t这是兼具 `ONEINPUT` 与 TINPUT、`ONEINPUTS` 与 TINPUTS 性质的输入接收命令。\n\t使用这些命令时，即使在 Emuera 的 CONFIG 设置中启用了键盘宏功能，\n\t也可能出现无法正常工作的情况，这是已知的特性。\n\t此外，在 `TONEINPUTS` 中，与 `INPUTS` 一样，可以使用宏表达式。\n\t若要在字符串中使用 `()`，请使用 `\\` 进行转义。\n\n\t在EM+EE中，第5个参数变为可选设置。\n\t当该参数非0时，将鼠标点击视为回车键（向`RESULTS`赋值空字符串。若按下按钮，则将按钮的索引赋值给`RESULTS:1`），左键点击时`RESULT:1`设为`1`，右键点击时`RESULT:1`设为`2`。同时，若按下++shift++、++ctrl++、++alt++键，则将该按键状态保存到`RESULT:2`中。（bit 16 17 18）\n\n!!! hint \"提示\"\n\n    仅支持命令形式。\n\n### 相关项目\n- TINPUT\n- ONEINPUT",
    "sourcePath": "docs/Reference/TONEINPUT.zh.md"
  },
  {
    "id": "TONEINPUTNF",
    "title": "TONEINPUT(S)NF",
    "names": [
      "TONEINPUTNF",
      "TONEINPUTSNF"
    ],
    "signatures": [
      {
        "name": "TONEINPUTNF",
        "params": "`int`, `int`(, `int`, `string`, `int`)",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "TONEINPUTSNF",
        "params": "`int`, `string`(, `int`, `string`, `int`)",
        "returns": "`string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "与 TONEINPUT / TONEINPUTS 功能完全相同，但不强制滚动到底部。",
    "body": "!!! info \"API\"\n\n    ```erb\n    TONEINPUTNF timeLimit, defaultValue(, displayTimeRemain, timeOverMessage, allowClick)\n    TONEINPUTSNF timeLimit, defaultValue(, displayTimeRemain, timeOverMessage, allowClick)\n    ```\n    与 `TONEINPUT` / `TONEINPUTS` 功能完全相同，但**不强制滚动到底部**。\n\n    NF = NoFocus。执行时进入 `WaitInputNoFocus` 状态，与 `WaitInput` 的唯一区别是不调用文本框定位，因此用户可以自由滚动浏览历史输出。\n\n    效果：\n    - ✅ 按钮高亮和 Tooltip 正常工作\n    - ✅ 输入可靠性（引擎原生输入管线）\n    - ✅ 用户可自由滚动，滚动位置不会被强制拉回底部\n    - ✅ 超时机制与原版 TONEINPUT 相同\n\n    参数和返回值与原版完全一致，参见 `TONEINPUT` / `TONEINPUTS`。\n\n!!! hint \"提示\"\n\n    仅支持命令形式。\n\n### 典型用途\n\n需要定时刷新界面但又不希望强制滚动的场景——例如动态地图动画、实时标题画面等。\n\n```erb\n; 动态地图动画：每帧刷新，按钮可点击，用户可自由滚动\n$MAP_LOOP\nCALL DRAW_MAP\nIF ANIM_INTERVAL > 0\n    TONEINPUTSNF ANIM_INTERVAL, \"UPDATE\", 0, \"\"\nELSE\n    INPUTS\nENDIF\nSELECTCASE RESULTS\nCASE \"UPDATE\"\n    ; 超时 → 刷新动画帧\n    GOTO MAP_LOOP\nCASEELSE\n    ; 用户点击按钮 → 正常处理\nENDSELECT\n```\n\n### 相关项目\n- TONEINPUT\n- TONEINPUTS\n- TINPUTNF\n- AWAIT",
    "sourcePath": "docs/Reference/TONEINPUTNF.zh.md"
  },
  {
    "id": "TOOLTIP_EXTENSION",
    "title": "TOOLTIPS 功能扩展",
    "names": [
      "TOOLTIP_CUSTOM",
      "TOOLTIP_SETFONT",
      "TOOLTIP_SETFONTSIZE",
      "TOOLTIP_FORMAT",
      "TOOLTIPS",
      "TOOLTIP_EXTENSION"
    ],
    "signatures": [
      {
        "name": "TOOLTIP_CUSTOM",
        "params": "`int`",
        "returns": "",
        "engines": [
          "ee"
        ],
        "overloads": []
      },
      {
        "name": "TOOLTIP_SETFONT",
        "params": "`string`",
        "returns": "",
        "engines": [
          "ee"
        ],
        "overloads": []
      },
      {
        "name": "TOOLTIP_SETFONTSIZE",
        "params": "`int`",
        "returns": "",
        "engines": [
          "ee"
        ],
        "overloads": []
      },
      {
        "name": "TOOLTIP_FORMAT",
        "params": "`int`",
        "returns": "",
        "engines": [
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "HTML_PRINT 的提示框功能扩展。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tTOOLTIP_CUSTOM bool\n    TOOLTIP_SETFONT fontName\n    TOOLTIP_SETFONTSIZE fontSize\n    TOOLTIP_FORMAT formatFlags\n    ```\n\n\t`HTML_PRINT` 的提示框功能扩展。\n\n\t- `TOOLTIP_CUSTOM`：要使用以下提示框功能扩展时，`TOOLTIP_CUSTOM` 的参数设为非 `0` 以开启功能。指定为 `0` 时扩展功能关闭，以原版提示框的方式显示。\n\t- `TOOLTIP_SETFONT`：设置提示框内文字的字体名称。\n\t- `TOOLTIP_SETFONTSIZE`：设置提示框内文字的字体大小名称。\n\t- `TOOLTIP_FORMAT`：设置提示框内文本的格式。参数参考 C# 的 [`TextFormatFlags`](https://learn.microsoft.com/zh-cn/dotnet/api/system.windows.forms.textformatflags?view=netframework-4.8)。\n\t- 原版中已有的 `TOOLTIP_SETCOLOR` 现在在扩展功能开启时能正常生效。\n\t- 提示框内现在可使用 `<br>` 标签。扩展功能关闭时仍然有效。\n\n!!! hint \"提示\"\n\n    仅支持命令式写法。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tTOOLTIP_CUSTOM 1\n\t\tTOOLTIP_SETCOLOR 0x00AA00, 0x00FF00\n\t\tTOOLTIP_SETFONT \"Ariel\"\n\t\tTOOLTIP_SETFONTSIZE 24\n\t\tTOOLTIP_FORMAT 2;Right Alignment\n\n\t\tHTML_PRINT \"<nonbutton title='tooltip<br>123'>テキスト1</nonbutton>\"\n\t\tPRINTL\n\t\tPRINTL\n\t\tPRINTL\n\t\tWAIT\n\n\t\tTOOLTIP_SETCOLOR 0x333333, 0xAAAAAA\n\t\tTOOLTIP_SETFONT \"ＭＳ 明朝\"\n\t\tTOOLTIP_SETFONTSIZE 12\n\t\tTOOLTIP_FORMAT 1;Center\n\t\tHTML_PRINT \"<nonbutton title='古池や<br>蛙飛びこむ<br>水の音'>テキスト2</nonbutton>\"\n\t\tPRINTL\n\t\tPRINTL\n\t\tPRINTL\n\t\tWAIT\n    ```\n\t![](../assets/images/TOOLTIP_EXTENSION1.png)\n\t![](../assets/images/TOOLTIP_EXTENSION2.png)\n\n### 相关项目\n- 工具提示显示操作\n- TOOLTIP_SETCOLOR",
    "sourcePath": "docs/Reference/TOOLTIP_EXTENSION.zh.md"
  },
  {
    "id": "TOOLTIP_SET",
    "title": "TOOLTIP_SETDELAY, TOOLTIP_SETDURATION",
    "names": [
      "TOOLTIP_SETDELAY",
      "TOOLTIP_SETDURATION",
      "TOOLTIP_SET"
    ],
    "signatures": [
      {
        "name": "TOOLTIP_SETDELAY",
        "params": "`int`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "TOOLTIP_SETDURATION",
        "params": "`int`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "TOOLTIP_SETDELAY 用于设置工具提示显示前的延迟时间，单位为毫秒。",
    "body": "!!! info \"API\"\n\n    ```erb\n    TOOLTIP_SETDELAY milliSecond\n    TOOLTIP_SETDURATION milliSecond\n    ```\n    `TOOLTIP_SETDELAY` 用于设置工具提示显示前的延迟时间，单位为毫秒。\n    默认值为 500（毫秒），最大值为 32767。\n\n    `TOOLTIP_SETDURATION` 用于设置工具提示的显示持续时间，单位为毫秒。指定 0 则使用默认显示时间。\n\n!!! hint \"提示\"\n\n    仅支持作为指令使用。\n\n### 相关项目\n- 工具提示扩展功能\n- TOOLTIP_SETCOLOR",
    "sourcePath": "docs/Reference/TOOLTIP_SET.zh.md"
  },
  {
    "id": "TOOLTIP_SETCOLOR",
    "title": "TOOLTIP_SETCOLOR",
    "names": [
      "TOOLTIP_SETCOLOR"
    ],
    "signatures": [
      {
        "name": "TOOLTIP_SETCOLOR",
        "params": "`int`, `int`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "设置工具提示的前景色和背景色，使用 0xRRGGBB 格式的数值。第一个参数是文字颜色，第二个参数是背景颜色。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tTOOLTIP_SETCOLOR colorCode, colorCode\n    ```\n\t设置工具提示的前景色和背景色，使用 0xRRGGBB 格式的数值。第一个参数是文字颜色，第二个参数是背景颜色。\n\t如果想使用 R、G、B 值或字符串来指定颜色，请使用 `COLOR_FROMRGB` 或 `COLOR_FROMNAME` 函数。\n\n\t此指令在原版 Emuera 中无效。它是 EM+EE 中新增的功能，需与 `TOOLTIP_CUSTOM` 配合使用才能生效。\n\n!!! hint \"提示\"\n\n    仅支持指令形式。\n\n### 相关项目\n- 工具提示扩展功能\n- 工具提示显示操作",
    "sourcePath": "docs/Reference/TOOLTIP_SETCOLOR.zh.md"
  },
  {
    "id": "TOSTR",
    "title": "TOSTR",
    "names": [
      "TOSTR",
      "TOSTRF"
    ],
    "signatures": [
      {
        "name": "TOSTR",
        "params": "`int`, `option`",
        "returns": "`string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "TOSTRF",
        "params": "`float`{, `option`}",
        "returns": "`string`",
        "engines": [
          "skia"
        ],
        "overloads": []
      }
    ],
    "summary": "将数值转换为字符串的命令。",
    "body": "!!! info \"API — TOSTR\"\n\n    ```erb\n\tstring TOSTR int, option\n    ```\n\t将数值转换为字符串的命令。\n\t第一个参数指定要转换的数字，第二个参数以字符串形式指定转换格式。\n\t第二个参数可以省略，省略时，其行为与 `PRINTFORM` 的 `{}` 内相同，即简单地转换为字符串。\n\t此函数内部调用 C# 的 [`Int64.ToString() 函数`](https://learn.microsoft.com/ja-jp/dotnet/api/system.int64.tostring)，可以使用与 C# 相同的格式指定。如果第二个参数不合适，将发生错误。\n\t简单的格式指定示例，请参考同名的可在表达式中使用的函数。格式指定的详细信息，请参考讲解 C# 数值格式字符串的网站。\n\n!!! info \"API — TOSTRF\"\n\n    [Skia] Skia 新增\n\n    ```erb\n\tstring TOSTRF float, option\n    ```\n\t将浮点数转换为字符串的命令。\n\t第一个参数指定要转换的浮点数，第二个参数以字符串形式指定转换格式。\n\t第二个参数可以省略，省略时直接转换为字符串。\n\t此函数内部调用 C# 的 [`Double.ToString() 函数`](https://learn.microsoft.com/ja-jp/dotnet/api/system.double.tostring)，可以使用与 C# 相同的格式指定。如果第二个参数不合适，将发生错误。\n\n\t常用格式：\n\n\t| 格式 | 示例 | 结果 | 说明 |\n\t|------|------|------|------|\n\t| `\"F2\"` | `TOSTRF(3.14, \"F2\")` | `\"3.14\"` | 固定小数点，2 位 |\n\t| `\"F4\"` | `TOSTRF(3.14, \"F4\")` | `\"3.1400\"` | 固定小数点，4 位 |\n\t| `\"E\"` | `TOSTRF(3.14, \"E\")` | `\"3.140000E+000\"` | 科学计数法 |\n\t| `\"G4\"` | `TOSTRF(3.14, \"G4\")` | `\"3.14\"` | 通用格式，4 位有效数字 |\n\t| `\"0.00\"` | `TOSTRF(3.14, \"0.00\")` | `\"3.14\"` | 自定义数字格式 |\n\n\t精度+宽度填充需配合 FORM `%...%` 语法：\n\n\t```erb\n\tPRINTFORML %TOSTRF(PI, \"F2\"),10%      ; → \"      3.14\"（右对齐）\n\tPRINTFORML %TOSTRF(PI, \"F2\"),10,LEFT% ; → \"3.14      \"（左对齐）\n\t```\n\n!!! hint \"提示\"\n\n    同时支持命令形式和表达式函数形式。\n\n!!! example \"例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tA = 438765\n\t\tPRINTSL TOSTR(A)\n\t\tPRINTSL TOSTR(A, \"x\")\n\t\tPRINTSL TOSTR(A, \"X\")\n\t\tPRINTSL TOSTR(A, \"D8\")\n\t\tPRINTSL TOSTR(A, \"X8\")\n\t\tPRINTSL TOSTR(A, \"00000000\")\n\t\tPRINTSL TOSTR(A, \"########\")\n\t\tPRINTSL TOSTR(A, \"#,###\")\n\t\tPRINTSL TOSTR(A, \"0000万0000\")\n    ```\n    ```text\n\t438765　//标准\n\t6b1ed　//\"x\" 十六进制(小写)\n\t6B1ED　//\"X\" 十六进制(大写)\n\t00438765　//\"D8\" 十进制 + 8位\n\t0006B1ED　//\"X8\" 十六进制 + 8位\n\t00438765　//\"00000000\" 十进制 + 8位\n\t438765　//\"########\" 十进制\n\t438,765　//\"#,###\" 每3位加\",\"\n\t0043万8765　//\"0000万0000\" 8位 + 第4位插入\"万\"\n    ```\n\n### 相关项目\n- TOINT",
    "sourcePath": "docs/Reference/TOSTR.zh.md"
  },
  {
    "id": "TOUPPER",
    "title": "TOUPPER, TOLOWER, TOHALF, TOFULL",
    "names": [
      "TOUPPER",
      "TOLOWER",
      "TOHALF",
      "TOFULL"
    ],
    "signatures": [
      {
        "name": "TOUPPER",
        "params": "`string`",
        "returns": "`string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "TOLOWER",
        "params": "`string`",
        "returns": "`string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "TOHALF",
        "params": "`string`",
        "returns": "`string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "TOFULL",
        "params": "`string`",
        "returns": "`string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "将参数字符串进行特定转换后的结果赋值给 RESULTS:0 或作为返回值。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tstring TOUPPER string\n\tstring TOLOWER string\n\tstring TOHALF string\n\tstring TOFULL string\n    ```\n\t将参数字符串进行特定转换后的结果赋值给 `RESULTS:0` 或作为返回值。\n\t`TOUPPER` 将字母转换为大写，`TOLOWER` 将字母转换为小写。\n\t`TOHALF` 将全角字符转换为半角，但对于没有对应半角字符的全角字符则保持不变。\n\t`TOFULL` 将半角字符转换为全角。\n\n!!! hint \"提示\"\n\n    同时支持作为指令和表达式内函数使用。\n\n!!! example \"例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\tPRINTFORML %TOUPPER(\"eRAseRmOToRpHAntOM\")%\n\tPRINTFORML %TOLOWER(\"BEATMANIA\")+\"IIDX\"%\n\tPRINTFORML %TOHALF(\"パルスのファルシのルシがパージでコクーン\")%\n\tPRINTFORMW %TOFULL(\"SUGOI DEKAI\")%\n    ```\n    ```text\n\tERASERMOTORPHANTOM\n\tbeatmaniaIIDX\n\tﾊﾟﾙｽのﾌｧﾙｼのﾙｼがﾊﾟｰｼﾞでｺｸｰﾝ\n\tＳＵＧＯＩ　ＤＥＫＡＩ\n    ```",
    "sourcePath": "docs/Reference/TOUPPER.zh.md"
  },
  {
    "id": "TRY",
    "title": "TRYJUMP, TRYCALL, TRYGOTO",
    "names": [
      "TRYCALL",
      "TRYJUMP",
      "TRYGOTO",
      "TRY"
    ],
    "signatures": [
      {
        "name": "TRYCALL",
        "params": "`functionName`(, `any`...)",
        "returns": "`void`¹",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "TRYJUMP",
        "params": "`functionName`(, `any`...)",
        "returns": "`void`¹",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "TRYGOTO",
        "params": "`labelName`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "与 JUMP、CALL、GOTO 相同，但即使指定的函数不存在也不会报错。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tTRYCALL functionName(, `argument`...)\n\tTRYJUMP functionName(, `argument`...)\n\tTRYGOTO labelName\n    ```\n\t与 `JUMP`、`CALL`、`GOTO` 相同，但即使指定的函数不存在也不会报错。\n\t如果指定的函数不存在，则不执行任何操作。\n\t`TRYJUMP` 和 `TRYCALL` 可以指定参数。详情请参阅[函数页面的`自定义函数中的参数指定`一节](../Emuera//function.md#_2)。\n\t另外，当使用 `TRYGOTO` 直接跳转到 `IF～ELSEIF～ELSE～ENDIF` 内部时，会正常执行到 `ELSEIF`、`ELSE`、`ENDIF` 之前，然后跳转到 `ENDIF` 的下一行继续处理。\n\t当直接跳转到 `REPEAT～REND` 内部时，会正常执行到 `REND` 之前，然后忽略 `REND` 并从下一行继续处理。\n\t这些处理方式与 `GOTO` 或其他 `GOTO` 系命令相同。关于 Emuera 中新增的其他循环/分支语法，请参阅 [`循环/分支语法`](../Reference/README.zh.md#flow-control) 和 `TRYC` 系 章节。\n\n!!! hint \"提示\"\n\n    仅支持命令。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tTRYCALL AAA\n\t\tTRYCALL BBB\n\t\tTRYCALL CCC\n\t\tWAIT\n\n\t@AAA\n\t\tPRINTL AAA\n\n\t@CCC\n\t\tPRINTL CCC\n    ```\n    ```text\n\tAAA\n\tCCC\n    ```\n\n### 相关项目\n- TRY◯◯FORM\n- CALL\n- JUMP\n- GOTO",
    "sourcePath": "docs/Reference/TRY.zh.md"
  },
  {
    "id": "TRYC",
    "title": "TRYC系",
    "names": [
      "TRYCCALL",
      "TRYCJUMP",
      "TRYGOTO",
      "TRYCCALLFORM",
      "TRYCGOTOFORM",
      "CATCH",
      "ENDCATCH",
      "TRYCJUMPFORM",
      "TRYC"
    ],
    "signatures": [
      {
        "name": "TRYCCALL",
        "params": "`functionName`(, `any`...)",
        "returns": "`void`¹",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "TRYCJUMP",
        "params": "`functionName`(, `any`...)",
        "returns": "`void`¹",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "TRYGOTO",
        "params": "`labelName`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "TRYCCALLFORM",
        "params": "`functionName`(, `any`...)",
        "returns": "`void`¹",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "TRYCCALLFORM",
        "params": "`functionName`(, `any`...)",
        "returns": "`void`¹",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "TRYCGOTOFORM",
        "params": "`labelName`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "CATCH",
        "params": "无",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "ENDCATCH",
        "params": "无",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "TRYC 系列指令可以在函数调用时，控制当函数未找到时的行为。",
    "body": "!!! info \"API\"\n\n    ```erb\n    TRYCCALL functionName(, argument...)\n    TRYCJUMP functionName(, argument...)\n    TRYCJUMP labelName\n    TRYCCALLFORM formedString(, argument...)\n    TRYCJUMPFORM formedString(, argument...)\n    TRYCGOTOFORM formedString\n    CATCH\n    ENDCATCH\n    ```\n    `TRYC` 系列指令可以在函数调用时，控制当函数未找到时的行为。\n    如果函数存在，则调用该函数并执行 `TRYC` 之后的行；如果函数不存在，则执行 `CATCH` 之后的行。\n    其语法与 `IF～ELSE～ENDIF` 类似（区别在于即使函数存在时没有要执行的处理也可以省略）。\n    因此，当使用 `GOTO` 等指令直接跳转到 `TRYC系列～CATCH～ENDCATCH` 内部时，其行为与 `IF～ELSEIF～ELSE～ENDIF` 类似：\n    会正常执行到 `CATCH` 或 `ENDCATCH` 的前一行，然后跳转到 `ENDCATCH` 的下一行继续执行。\n    另外，关于使用 `TRYCGOTO` 或 `TRYCGOTOFORM` 直接跳入循环或分支结构内部的情况，请参阅 `TRYGOTO` 或 [`循环·分支结构`](../Reference/README.zh.md#flow-control) 章节。\n\n    ```erb\n\t\tTRYCCALL UNKNOWN_FUNC ;调用不存在的函数\n\t\t\t;函数存在时，函数执行后要进行的处理（如果有的话，没有则可以省略，直接接CATCH即可）\n\t\tCATCH\n\t\t\t;函数不存在时要进行的处理\n\t\tENDCATCH\n\t```\n\n\t此外，支持嵌套使用。\n\n!!! hint \"提示\"\n\n    仅支持指令。\n\n### 相关项目\n- TRY系\n- CALL\n- JUMP\n- GOTO",
    "sourcePath": "docs/Reference/TRYC.zh.md"
  },
  {
    "id": "TRYCALLF",
    "title": "TRYCALLF",
    "names": [
      "TRYCALLF"
    ],
    "signatures": [
      {
        "name": "TRYCALLF",
        "params": "`string`",
        "returns": "`void`¹",
        "engines": [
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "附加 TRY 功能的 CALLF 函数。",
    "body": "!!! info \"API\"\n\n    ```erb\n    TRYCALLF funcName\n    ```\n\n    附加 `TRY` 功能的 `CALLF` 函数。\n    即便调用的目标函数不存在也不会报错；与此同时，`CALLF` 通过 `RETURNF` 返回的值也被丢弃。\n\n!!! hint \"提示\"\n\n    仅支持命令式写法。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n\n        TRYCALLF NULL\n        TRYCALLF TEST\n        WAIT\n\n    @TEST\n    #FUNCTION\n\n        PRINT 已调用 \"TEST\" 函数\n        RETURNF 0\n    ```\n\n    ```text\n    已调用 \"TEST\" 函数\n    ```\n\n### 相关项目\n- CALLF\n- TRYCALLFORMF",
    "sourcePath": "docs/Reference/TRYCALLF.zh.md"
  },
  {
    "id": "TRYCALLFORMF",
    "title": "TRYCALLFORMF",
    "names": [
      "TRYCALLFORMF"
    ],
    "signatures": [
      {
        "name": "TRYCALLFORMF",
        "params": "`string`",
        "returns": "`void`¹",
        "engines": [
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "附加 TRY 功能的 CALLFORMF 函数。",
    "body": "!!! info \"API\"\n\n    ```erb\n    TRYCALLFORMF funcName\n    ```\n\n    附加 `TRY` 功能的 `CALLFORMF` 函数。\n    即便调用的目标函数不存在也不会报错；与此同时，`CALLFORMF` 通过 `RETURNF` 返回的值也被丢弃。\n\n!!! hint \"提示\"\n\n    仅支持命令式写法。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n\n    \tREPEAT 5\n    \t\tTRYCALLFORMF TEST{COUNT}\n    \t\tSIF !LINEISEMPTY()\n    \t\t\tPRINTL\n    \tREND\n    \tWAIT\n\n    @TEST1\n    #FUNCTION\n\n    \tPRINT 已调用 \"TEST1\" 函数\n    \tRETURNF 0\n\n    @TEST3\n    #FUNCTIONS\n\n    \tPRINT 已调用 \"TEST3\" 函数\n    \tRETURNF \"HOGE\"\n    ```\n\n    ```text\n    已调用 \"TEST1\" 函数\n    已调用 \"TEST3\" 函数\n    ```\n\n### 相关项目\n- CALLF\n- TRYCALLF",
    "sourcePath": "docs/Reference/TRYCALLFORMF.zh.md"
  },
  {
    "id": "TRYFORM",
    "title": "TRYCALLFORM, TRYJUMPFORM, TRYGOTOFORM",
    "names": [
      "TRYCALLFORM",
      "TRYJUMPFORM",
      "TRYGOTOFORM",
      "TRYFORM"
    ],
    "signatures": [
      {
        "name": "TRYCALLFORM",
        "params": "`formedString`(, `any`...)",
        "returns": "`void`¹",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "TRYJUMPFORM",
        "params": "`formedString`(, `any`...)",
        "returns": "`void`¹",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "TRYGOTOFORM",
        "params": "`formedString`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "与 JUMP、CALL、GOTO 相同，但可以像 PRINTFORM 一样指定函数名，即使函数不存在也不会报错。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tTRYCALLFORM formedString(, argument...)\n\tTRYJUMPFORM formedString(, argument...)\n\tTRYGOTOFORM formedString\n    ```\n\t与 `JUMP`、`CALL`、`GOTO` 相同，但可以像 `PRINTFORM` 一样指定函数名，即使函数不存在也不会报错。\n\t`TRYJUMPFORM` 和 `TRYCALLFORM` 可以指定参数。详情请参阅[函数页面的`自定义函数中的参数指定`一节](../Emuera//function.md#_2)。\n\t另外，关于使用 `TRYGOTOFORM` 直接进入循环/分支结构内部的情况，请参阅 `TRYGOTO`、[`循环/分支结构`](../Reference/README.zh.md#flow-control) 以及 `TRYC` 系列 的说明。\n\n!!! hint \"提示\"\n\n    仅支持命令。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\t#DIMS HOGE\n\t\tHOGES = AAA\n\n\t\tTRYCALLFORM %HOGES%\n\t\tTRYCALLFORM %HOGES%BBB\n\t\tTRYJUMPFORM %\"C\"*3%\n\n\t@AAA\n\t\tPRINTL AAA\n\n\t@BBB\n\t\tPRINTL BBB\n\n\t@CCC\n\t\tPRINTL CCC\n\t\tWAIT\n    ```\n    ```text\n\tAAA\n\tCCC\n    ```\n\n### 相关项目\n- TRY系\n- CALL\n- JUMP\n- GOTO",
    "sourcePath": "docs/Reference/TRYFORM.zh.md"
  },
  {
    "id": "TRYLIST",
    "title": "TRYLIST系",
    "names": [
      "TRYCALLLIST",
      "TRYJUMPLIST",
      "TRYGOTOLIST",
      "FUNC",
      "ENDFUNC",
      "TRYCCALL",
      "CATCH",
      "ENDCATCH",
      "TRYLIST"
    ],
    "signatures": [
      {
        "name": "TRYCALLLIST",
        "params": "无",
        "returns": "`void`¹",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "TRYJUMPLIST",
        "params": "无",
        "returns": "`void`¹",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "TRYGOTOLIST",
        "params": "无",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "FUNC",
        "params": "`functionName`(, `any`...)",
        "returns": "`void`¹",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "ENDFUNC",
        "params": "无",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "这是一个用于指定多个函数（标签）并仅调用第一个找到的函数的语法。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tTRYCALLLIST\n\tTRYJUMPLIST\n\tTRYGOTOLIST\n\tFUNC functionName(, argument...)\n\tENDFUNC\n    ```\n\t这是一个用于指定多个函数（标签）并仅调用第一个找到的函数的语法。\n\t在 `TRYLIST系～ENDFUNC` 内部，不能使用上述语法以外的描述。\n\t另外，关于使用 `TRYGOTOLIST` 直接进入循环/分支结构的情况，请参考 `TRYGOTO`、[`循环/分支结构`](../Reference/README.zh.md#flow-control) 以及 `TRYC` 系 的章节。\n\t使用方法如下所示：\n\n    ```erb\n\tTRYCALLLIST\n\t\tFUNC 函数1\n\t\tFUNC 函数2\n\tENDFUNC\n\t```\n\n    `FUNC` 指定的函数将按顺序尝试调用，若成功则调用后跳转至 `ENDFUNC`，若失败则跳转至下一行的 `FUNC`（或 `ENDFUNC`）。\n    这等同于以下脚本：\n\n    ```erb\n    TRYCCALL 関数1\n    CATCH\n        TRYCCALL 関数2\n        CATCH\n        ENDCATCH\n    ENDCATCH\n    ```\n\n!!! hint \"提示\"\n\n    仅支持指令。\n\n### 相关项目\n- TRY系\n- TRYC系\n- CALL\n- JUMP\n- GOTO",
    "sourcePath": "docs/Reference/TRYLIST.zh.md"
  },
  {
    "id": "tutorial/assignment",
    "title": "赋值语句",
    "names": [
      "ASSIGNMENT"
    ],
    "signatures": [],
    "summary": "赋值语句是 ERABASIC 中最基本的操作之一——将值存入变量。虽然语法看起来简单，但 ERABASIC 的赋值有几种不同形式，每种适用于不同的场景：",
    "body": "!!! info \"本节对应手册\"\n\n    - **Reference 分类**: [算术](../Reference/README.zh.md#arithmetic)\n    - [Emuera 新增语法](../Emuera/expression.zh.md) — FORM 语法赋值、字符串表达式赋值\n    - [eramaker ERB 书式](../eramaker/ERB_format.zh.md) — 基本赋值语法（历史参考）\n\n---\n\n## 概述\n\n赋值语句是 ERABASIC 中最基本的操作之一——将值存入变量。虽然语法看起来简单，但 ERABASIC 的赋值有几种不同形式，每种适用于不同的场景：\n\n| 赋值形式 | 语法 | 适用类型 | 说明 |\n|---------|------|---------|------|\n| 基本赋值 | `X = 10` | 整数/浮点 | 最常用的形式 |\n| 字符串 FORM 赋值 | `S = Hello %NAME%` | 字符串 | 支持 `%变量%` 字符串替换、`{变量}` 数值插值 |\n| 字符串表达式赋值 | `S '= \"Hello\"` | 字符串 | 用表达式求值，不插值 |\n| 复合赋值 | `X += 5` | 整数/浮点/字符串 | 算术运算 + 赋值 |\n| 自增/自减 | `X ++` / `X --` | 整数/浮点 | 前置或后置 |\n| 批量赋值 | `A:10 = 1,2,3` | 数组 | 连续元素赋值 |\n\n!!! note \"eramaker 兼容性\"\n    基本赋值（`=`）、复合赋值（`+=`/`-=`/`*=`/`/=`/`%=`）、字符串 FORM 赋值是 eramaker 就存在的功能。自增/自减（`++`/`--`）、字符串表达式赋值（`'=`）、批量赋值是 Emuera 的扩展功能。\n\n---\n\n## 解析器如何识别赋值语句\n\nERABASIC 的解析器在遇到一行代码时，按以下顺序判断：\n\n```\n1. 行首是 ++ 或 -- ？ → 前置自增/自减语句\n2. 行首是已知命令名？ → 命令语句（如 PRINT、CALL 等）\n3. 以上都不是 → 尝试解析为赋值语句\n```\n\n当解析器判断一行不是命令时，它会：\n\n1. 用 `LexicalAnalyzer.Analyse` 读取赋值目标（等号左侧的变量）\n2. 用 `LexicalAnalyzer.ReadAssignmentOperator` 读取赋值运算符\n3. 将剩余部分作为表达式解析（等号右侧）\n\n这意味着**赋值语句的左侧必须是变量**，不能是表达式或常量。\n\n---\n\n## 基本赋值\n\n### 整数赋值\n\n```erb\nA = 100\nMONEY = 500\nFLAG:0 = 1\nABL:TARGET:0 = 3\n```\n\n等号右侧可以是任意整数表达式：\n\n```erb\nA = 10 + 20\nA = B * 2 + C\nA = MAX(10, 20)\nA = STRLEN(\"hello\")\n```\n\n### 浮点赋值\n\n```erb\n#DIMF SCORE\nSCORE = 3.14\nSCORE = 10 / 3.0\n```\n\n!!! warning \"整数除法 vs 浮点除法\"\n\n    `10 / 3` 的结果是 `3`（整数除法，截断小数），而 `10 / 3.0` 的结果是 `3.333...`（浮点除法）。\n    赋值目标变量的类型不影响右侧表达式的计算方式。\n\n---\n\n## 字符串赋值\n\n字符串变量有两种赋值方式，行为完全不同：\n\n### FORM 语法赋值(=) { #string-form-assignment }\n\n使用 `=` 赋值时，右侧按 FORM 语法解析——`{变量}` 会被插值，`%变量%` 也会被替换：\n\n```erb\nNAME:0 = 艾莉娜\nSTR:0 = 你好，%NAME:0%！        ; → \"你好，艾莉娜！\"\nSTR:1 = 金钱：{MONEY}元          ; → \"金钱：500元\"\nSTR:2 = %NAME:0%的冒险           ; → \"艾莉娜的冒险\"\nSTR:3 = NAME:0                   ; → \"NAME:0\"（不加 % 就是字面量！）\nSTR:4 = CSVNAME(0)               ; → \"CSVNAME(0)\"（函数不会被调用，原样字面量）\nSTR:5 = \"艾莉娜\"                 ; → 值 = \"艾莉娜\"（引号是字面字符，被原样保留！）\nSTR:6 = \"\"                       ; → 值 = \"\"（两个字面引号，不是空字符串！）\n```\n\n这是 eramaker 的原始行为。在 eramaker 中，`STR:0 = %RESULTS%` 会将 `RESULTS` 的内容赋给 `STR:0`。\n\n### 字符串表达式赋值（`'=`）\n\n使用 `'= ` 赋值时，右侧按**字符串表达式**解析——不做 FORM 插值，而是用表达式求值：\n\n```erb\nSTR:0 '= \"你好\"                  ; → \"你好\"（字面量）\nSTR:1 '= \"Hello %NAME:0%\"        ; → \"Hello %NAME:0%\"（不插值！百分号是字面文本）\nSTR:2 '= NAME:0 + \"的冒险\"       ; → \"艾莉娜的冒险\"（字符串拼接）\nSTR:3 '= TSTR:0 + \"继续\"         ; → 变量值 + \"继续\"\nSTR:4 '= CSVNAME(0)              ; → 角色0的姓名（表达式求值才会调用函数）\nSTR:5 '= \"艾莉娜\"                ; → 值 = 艾莉娜（引号是定界符，不存入字符串）\nSTR:6 '= \"\"                      ; → 值 = 空字符串（用 `'= ` 清空的正确方式）\n```\n\n### 两种方式对比\n\n| | `=` (FORM 语法) | `'= ` (表达式) |\n|------|:---:|:---:|\n| `{变量}` 插值 | ✅ | ❌ |\n| `%变量%` 替换 | ✅ | ❌ |\n| 字符串拼接 `+` | ❌ | ✅ |\n| 字符串字面量 `\"\"` | 不需要 | **必须** |\n| 表达式函数调用 | ❌ | ✅ |\n| eramaker 兼容 | ✅ | ❌（Emuera 新增） |\n\n!!! tip \"选择建议\"\n\n    - 需要简单的变量插值 → 用 `=`（FORM 语法更简洁）\n    - 需要字符串拼接、函数调用、复杂表达式 → 用 `'= `\n    - 不确定时，用 `'= ` + `\"\"` 包裹字符串更安全（不会意外插值）\n\n---\n\n## 复合赋值\n\n复合赋值运算符将算术运算和赋值合并为一步：\n\n```erb\nX += 5          ; X = X + 5\nX -= 3          ; X = X - 3\nX *= 2          ; X = X * 2\nX /= 4          ; X = X / 4\nX %= 10         ; X = X % 10（取余）\n```\n\nEmuera 还支持位运算复合赋值：\n\n```erb\nX <<= 2         ; X = X << 2（左移）\nX >>= 1         ; X = X >> 1（右移）\nX |= 0xFF       ; X = X | 0xFF（按位或）\nX &= 0x0F       ; X = X & 0x0F（按位与）\nX ^= 0xAA       ; X = X ^ 0xAA（按位异或）\n```\n\n字符串变量也支持 `+=`：\n\n```erb\nSTR:0 += \"追加文本\"     ; 字符串拼接（Emuera 扩展）\n```\n\n!!! warning \"复合赋值不能用于批量赋值\"\n\n    ```erb\n    ; ❌ 错误：复合赋值不支持批量赋值\n    A:10 += 1,2,3\n\n    ; ✅ 正确：使用基本赋值的批量形式\n    A:10 = 1,2,3\n    ```\n\n---\n\n## 自增与自减\n\n### 后置形式（语句行）\n\n```erb\nX ++            ; X = X + 1\nX --            ; X = X - 1\n```\n\n后置自增/自减作为**独立语句**使用，不能嵌入表达式中：\n\n```erb\n; ✅ 正确：独立语句\nX ++\n\n; ❌ 错误：不能嵌入表达式\nA = X ++ + 1\n```\n\n### 前置形式（语句行）\n\n```erb\n++X             ; 前置自增（作为独立语句）\n--X             ; 前置自减（作为独立语句）\n```\n\n前置自增/自减也是独立语句。解析器在行首检测到 `++` 或 `--` 时，会将其识别为前置自增/自减语句。\n\n!!! warning \"前置自增/自减的严格规则\"\n\n    行首的 `++` 或 `--` 必须紧跟一个变量名。如果 `++` 或 `--` 后面不是变量，会报错：\n\n    ```erb\n    ; ❌ 错误：++ 后面不是变量\n    ++ 5\n    ++ (A + B)\n\n    ; ✅ 正确\n    ++ A\n    ++ FLAG:0\n    ```\n\n### 表达式中的自增/自减\n\n在表达式内部（如赋值右侧、IF 条件等），可以使用后置 `++`/`--`：\n\n```erb\nA = X ++        ; A = X 的当前值，然后 X = X + 1\nIF Y -- > 0     ; 判断 Y > 0，然后 Y = Y - 1\n```\n\n但**不能**在表达式中使用前置 `++`/`--`：\n\n```erb\n; ❌ 错误：表达式中不能使用前置自增\nA = ++ X\n```\n\n---\n\n## 批量赋值\n\n对数组变量赋值时，可以用逗号分隔多个值，实现连续元素的批量赋值：\n\n```erb\n; 将 A:10、A:11、A:12 分别赋值为 1、2、3\nA:10 = 1,2,3\n\n; 二维数组：将 DA:0:0、DA:0:1、DA:0:2 分别赋值\nDA:0:0 = 1,2,3\n```\n\n!!! warning \"批量赋值的限制\"\n\n    1. **不跨行赋值**：二维数组批量赋值不会自动换行。`DA:0:0 = 1,2,3` 只赋值 `DA:0:0`~`DA:0:2`，不会继续到 `DA:1:0`\n    2. **不支持复合赋值**：不能写 `A:10 += 1,2,3`\n    3. **字符串批量赋值必须用 `'= `**：\n\n    ```erb\n    ; ❌ 错误：用 = 会将整个内容当作一个 FORM 字符串\n    STR:20 = 草莓,蜜瓜,蓝色夏威夷\n    ; → STR:20 = \"草莓,蜜瓜,蓝色夏威夷\"（一个字符串）\n\n    ; ✅ 正确：用 '= 分别赋值\n    STR:20 '= \"草莓\", \"蜜瓜\", \"蓝色夏威夷\"\n    ; → STR:20 = \"草莓\", STR:21 = \"蜜瓜\", STR:22 = \"蓝色夏威夷\"\n    ```\n\n---\n\n## `==` 作为赋值运算符\n\nERABASIC 有一个历史遗留行为：`==`（通常是比较运算符）出现在赋值位置时，会被当作赋值运算符 `=` 处理：\n\n```erb\nA == 10         ; 等同于 A = 10（会发出警告）\n```\n\n解析器检测到 `==` 在赋值位置时，会发出警告但仍然执行赋值。这是因为早期代码中经常误用 `==` 作为赋值，为了兼容性而保留此行为。\n\n!!! danger \"不要在新代码中使用 == 赋值\"\n\n    虽然引擎会容忍 `==` 赋值，但这会降低代码可读性并产生警告。始终使用 `=` 进行赋值，`==` 仅用于比较。\n\n---\n\n## 赋值与类型系统\n\nERABASIC 有三种基本类型：整数（Int64）、字符串（String）、浮点（Double）。赋值时类型必须匹配：\n\n| 目标变量类型 | 允许的赋值 | 不允许的赋值 |\n|------------|----------|------------|\n| 整数 (`#DIM`) | 整数表达式 | 字符串、浮点（截断为整数） |\n| 字符串 (`#DIMS`) | `=` FORM 语法 或 `'= ` 字符串表达式 | 整数表达式 |\n| 浮点 (`#DIMF`) | 浮点/整数表达式 | 字符串 |\n\n```erb\n#DIM L_INT\n#DIMS L_STR\n#DIMF L_FLOAT\n\nL_INT = 42                ; ✅ 整数赋值\nL_INT = 3.14              ; ⚠️ 浮点赋给整数，截断为 3\nL_STR = Hello             ; ✅ FORM 语法\nL_STR '= \"Hello\"          ; ✅ 字符串表达式\nL_STR = 42                ; ✅ FORM 语法：\"42\"（数字作为字符串字面量）\nL_FLOAT = 3.14            ; ✅ 浮点赋值\nL_FLOAT = 10              ; ✅ 整数自动转为浮点\n```\n\n---\n\n## #DIMS 初始化与赋值的语义差异 { #dims-init-vs-assignment }\n\n`#DIMS` 声明时的初始化 `=` 和赋值语句的 `=` 语义不同：\n\n| 位置 | 语法 | 解析方式 | 是否支持 FORM 插值 |\n|------|------|---------|-------------------|\n| `#DIMS` 初始化 | `#DIMS S = \"hello\"` | **表达式求值** | ❌ 不插值 |\n| 赋值语句 | `S = hello %NAME%` | **FORM 语法** | ✅ 插值 |\n\n```erb\n@MY_FUNC\n#DIMS L_STR = \"Hello %NAME%\"     ; → \"Hello %NAME%\"（字面文本，不插值！）\n    L_STR = Hello %NAME%         ; → \"Hello 艾莉娜\"（FORM 插值）\n    L_STR '= \"Hello %NAME%\"      ; → \"Hello %NAME%\"（表达式，不插值）\nRETURN\n```\n\n这是因为 `#DIMS` 初始化走 `ExpressionParser.ReduceArguments`（表达式语法），而赋值 `=` 走 `AnalyseFormattedString`（FORM 语法）。另外，`#DIMS` 没有 `'= ` 语法——初始化只能用 `=`，且必须是常量表达式。\n\n> 源码参考：`ArgumentBuilder.cs` 中 `FORM_STR_ANY`（赋值 `=`）vs `ReduceArguments`（#DIMS 初始化）。\n\n---\n\n## 常见陷阱 { #common-pitfalls }\n\n| 陷阱 | 错误写法 | 正确写法 | 原因 |\n|------|---------|---------|------|\n| 字符串不加引号 | `S '= hello` | `S '= \"hello\"` | 不加引号会被当作变量名 |\n| FORM 语法中意外插值 | `S = 100%` | `S = 100\\%` 或 `S '= \"100%\"` | `%` 在 FORM 语法中是变量替换符 |\n| 批量赋值用 `=` | `STR:0 = \"a\",\"b\"` | `STR:0 '= \"a\",\"b\"` | `=` 会将逗号作为 FORM 文本的一部分 |\n| `=` 赋带引号的字符串 | `S = \"text\"` / `S = \"\"` | `S '= \"text\"` / `S '= \"\"` | FORM 语法中 `\"` 是字面字符：`S = \"text\"` 存入 `\"text\"`，`S = \"\"` 存入 `\"\"`（非空字符串） |\n| `==` 误用为赋值 | `A == 10` | `A = 10` | `==` 是比较运算符，赋值应用 `=` |\n| 复合赋值批量 | `A:0 += 1,2,3` | `A:0 = 1,2,3` | 复合赋值不支持批量 |\n| 赋值目标不是变量 | `A + B = 10` | 不允许 | 赋值左侧必须是变量 |\n| #DIMS 初始化期望插值 | `#DIMS S = Hello {X}` | 赋值行写 `S = Hello {X}` | #DIMS 初始化走表达式，不插值 |\n\n---\n\n## 下一步\n\n| 你想了解什么 | 前往 |\n|:---|:---|\n| 值、类型与变量 | 值、类型与变量 |\n| 格式化字符串详解 | FORM 语法 |\n| 命令 vs 表达式的边界 | 命令 vs 表达式 |\n| ERB 文件格式扩展 | ERB 文件格式扩展 |",
    "sourcePath": "docs/tutorial/assignment.zh.md"
  },
  {
    "id": "tutorial/basic-output",
    "title": "基本输出",
    "names": [
      "BASIC-OUTPUT"
    ],
    "signatures": [],
    "summary": "输出是 ERABASIC 程序与玩家交互的基本方式。所有输出通过 PRINT 系列指令完成，它们遵循统一的命名规则：",
    "body": "!!! info \"本节对应手册\"\n\n    - **Reference 分类**: [PRINT 系列](../Reference/README.zh.md#print) / [显示操作・字体操作](../Reference/README.zh.md#display-font)\n    - [PRINT 系列](../Reference/PRINT.zh.md) — PRINT 指令完整 API 参考\n    - [PRINTSINGLE 系列](../Reference/PRINTSINGLE.zh.md) — 单行输出指令\n    - [PRINTDATA 系列](../Reference/PRINTDATA.zh.md) — 数据输出指令\n\n***\n\n## 概述\n\n输出是 ERABASIC 程序与玩家交互的基本方式。所有输出通过 PRINT 系列指令完成，它们遵循统一的命名规则：\n\n```\nPRINT(参数类型)(修饰)(行为后缀)\n```\n\n| 组成部分     | 选项                       | 含义                     |\n| -------- | ------------------------ | ---------------------- |\n| **参数类型** | 无 / V / S / FORM / FORMS | 决定参数的解析方式              |\n| **修饰**   | K / D                    | K=强制假名转换，D=忽略 SETCOLOR |\n| **行为后缀** | 无 / L / W / N            | 是否换行、是否等待输入            |\n\n!!! note \"eramaker 兼容性\"\n    `PRINT`/`PRINTL`/`PRINTW`/`PRINTV`/`PRINTVL`/`PRINTS`/`PRINTSL`/`PRINTFORM`/`PRINTFORML`/`PRINTFORMW` 是 eramaker 就存在的功能。`PRINTK`/`PRINTD`/`PRINTDATA` 系列/`PRINTSINGLE` 系列等是 Emuera 的扩展功能。\n\n***\n\n## 最基本的输出\n\n### PRINT — 输出不换行\n\n```erb\nPRINT 你好\nPRINT 世界\n; 输出：你好世界（不换行，两段文本连在一起）\n```\n\n`PRINT` 后面的文本是**简单字符串**——不需要引号包裹，也不做任何变量替换。\n\n### PRINTL — 输出并换行\n\n```erb\nPRINTL 你好\nPRINTL 世界\n; 输出：\n; 你好\n; 世界\n```\n\n`PRINTL` = `PRINT` + `L`（Line），是最常用的输出指令。每次输出后自动换行。\n\n### 单独换行\n\n```erb\nPRINTL              ; 输出一个空行\n```\n\n`PRINTL` 不带参数时仅输出换行。\n\n***\n\n## 参数类型：五种 PRINT 变体\n\nPRINT 系列指令根据参数类型分为五种变体，每种对参数的解析方式不同：\n\n| 指令           | 参数类型      | 参数解析方式             | 示例                      |\n| ------------ | --------- | ------------------ | ----------------------- |\n| `PRINT`      | 简单字符串     | 原样输出，不做替换          | `PRINT 你好`              |\n| `PRINTV`     | 表达式列表（每个独立求值） | 整数→数值，字符串→文本，自动拼接 | `PRINTV A + B, \"点\"`      |\n| `PRINTS`     | 字符串表达式    | 求值后输出              | `PRINTS NAME:TARGET`    |\n| `PRINTFORM`  | 格式化字符串    | FORM 语法，支持插值       | `PRINTFORM 你好，%NAME%！`  |\n| `PRINTFORMS` | 格式化字符串表达式 | 先求值为字符串，再按 FORM 解析 | `PRINTFORMS L_TEMPLATE` |\n\n### PRINT — 简单字符串\n\n`PRINT` 将后面的文本原样输出，不做任何变量替换：\n\n```erb\nPRINT 你好，世界          ; → 你好，世界\nPRINT %NAME%              ; → %NAME%（百分号是字面文本！）\nPRINT %RESULTS%           ; → %RESULTS%（百分号是字面文本！）\n```\n\n!!! warning \"PRINT 不做变量替换\"\n\n```\n`PRINT` 后面的文本是纯文本，`{变量}` 和 `%变量%` 不会被替换。需要变量替换时请使用 `PRINTFORM`。\n```\n\n### PRINTV — 表达式（整数·字符串）\n\n`PRINTV` 将后面的内容作为**表达式**求值，输出结果。每个参数独立求值：**整数表达式输出数值，字符串表达式输出文本**：\n\n```erb\n#DIM L_VAL = 42\nPRINTV L_VAL              ; → 42\nPRINTV L_VAL * 2          ; → 84\nPRINTV 10 + 20            ; → 30\n\n#DIMS L_NAME = \"艾莉娜\"\nPRINTV L_NAME             ; → 艾莉娜（字符串变量）\nPRINTV L_NAME + \"的冒险\"  ; → 艾莉娜的冒险（字符串表达式）\n```\n\n`PRINTV` 可以接受多个表达式，用逗号分隔，输出时拼接在一起。每个参数的类型可以不同：\n\n```erb\nPRINTV L_VAL, \"点\"        ; → 42点（整数 + 字符串）\nPRINTV L_VAL, \"点\", L_NAME ; → 42点艾莉娜（整数 + 字符串 + 字符串变量）\n```\n\n!!! tip \"PRINTV 的参数是表达式，不是 FORM 字符串\"\n\n```\n`PRINTV` 使用 `SP_PRINTV_ArgumentBuilder`，将参数解析为表达式列表。\n每个参数项独立求值：整数表达式输出数值，字符串表达式输出文本。\n因此 `PRINTV` 可以同时混合整数和字符串参数，无需统一类型。\n```\n\n### PRINTS — 字符串表达式\n\n`PRINTS` 将后面的内容作为**字符串表达式**求值，输出结果：\n\n```erb\n#DIMS L_NAME '= \"艾莉娜\"\nPRINTS L_NAME             ; → 艾莉娜\nPRINTS L_NAME + \"的冒险\"  ; → 艾莉娜的冒险\nPRINTS \"Hello\"            ; → Hello\n```\n\n### PRINTFORM — 格式化字符串\n\n`PRINTFORM` 是最常用的格式化输出指令，支持 FORM 语法的变量替换：\n\n```erb\n#DIM L_MONEY = 500\nPRINTFORM 你好，%NAME:TARGET%！       ; → 你好，艾莉娜！\nPRINTFORM 金钱：{L_MONEY}元            ; → 金钱：500元\nPRINTFORM %NAME:TARGET%的冒险          ; → 艾莉娜的冒险\n```\n\n| FORM 语法         | 功能        | 示例                                 |\n| --------------- | --------- | ---------------------------------- |\n| `{表达式}`         | 整数/浮点插值   | `{MONEY}` → `500`                  |\n| `{表达式,宽度}`      | 带填充的插值    | `{MONEY,8}` →      `     500`      |\n| `{表达式,宽度,LEFT}` | 左对齐填充     | `{MONEY,8,LEFT}` → `500     `      |\n| `%表达式%`         | 字符串插值     | `%NAME%` → `艾莉娜`                   |\n| `%表达式,宽度%`      | 带填充的字符串插值 | `%NAME%,10%` →     `    艾莉娜`       |\n\n> FORM 语法的完整说明见 FORM 语法。\n\n### PRINTFORMS — 格式化字符串表达式\n\n`PRINTFORMS` 先将参数作为字符串表达式求值，再对结果做 FORM 解析——也就是说，你可以用表达式动态构建出 FORM 语法字符串，就像拼接 HTML 一样：\n\n```erb\n; 甚至 %...% 中的变量名也是动态构建的\n#DIMS L_VARNAME = \"NAME:TARGET\"\n#DIMS L_TEMPLATE\nL_TEMPLATE '= \"你好，%\" + L_VARNAME + \"%！\"\n; L_TEMPLATE 求值后 → \"你好，%NAME:TARGET%！\"\n\nPRINTFORMS L_TEMPLATE      ; 先求值 L_TEMPLATE，再 FORM 解析 → 你好，艾莉娜！\n```\n\n`PRINTFORMS` 与 `PRINTFORM` 的区别：\n\n| <br /> |   `PRINTFORM`  |      `PRINTFORMS`     |\n| ------ | :------------: | :-------------------: |\n| 参数     | FORM 字符串（直接解析） | 字符串表达式（先求值，再 FORM 解析） |\n| 典型用途   |      固定模板      | 动态模板（运行时构建的 FORM 字符串） |\n\n***\n\n## 行为后缀：L / W / N\n\n所有 PRINT 变体都可以添加行为后缀，控制输出后的动作：\n\n| 后缀  | 含义                    | 示例          |\n| --- | --------------------- | ----------- |\n| 无   | 不换行，不等待               | `PRINT 你好`  |\n| `L` | 输出后换行                 | `PRINTL 你好` |\n| `W` | 输出后换行并等待玩家按键          | `PRINTW 你好` |\n| `N` | 不换行但等待玩家按键（DotNet 新增） | `PRINTN 你好` |\n\n### 组合示例\n\n```erb\n; PRINTFORM + L = PRINTFORML\nPRINTFORML 你好，%NAME:TARGET%！\n\n; PRINTS + W = PRINTSW\nPRINTSW \"按任意键继续...\"\n\n; PRINTV + L = PRINTVL\nPRINTVL A + B\n```\n\n!!! tip \"PRINTW 和 WAIT 的区别\"\n\n```\n`PRINTW` = `PRINTL` + `WAIT`。`WAIT` 单独使用时也会等待玩家按键，但不会输出任何文本。\n```\n\n### PRINTN — 不换行但等待按键\n\n```erb\nPRINTN 按任意键继续...\nPRINTL 继续后的文本\n; 按键前显示：按任意键继续...\n; 按键后显示：按任意键继续...继续后的文本（同一行）\n```\n\n`PRINTN` = `PRINT` + `N`（No line end）。与 `PRINTW` 不同——`PRINTW` 输出后换行并等待按键；`PRINTN` 输出后等待按键，但**结束行时标记为\"未结束\"**，后续输出会水平接在当前行末尾，而不是另起一行。\n\n!!! tip \"PRINTN 的典型用途\"\n\n    PRINTN 适合需要行内等待的场景，例如逐步展开的文本演出、需要玩家确认后才显示后续内容的对话行等。\n\n    ```erb\n    ; 错误：用 PRINT + WAIT 模拟行内等待\n    PRINT 请稍候...\n    WAIT\n    ; → 输出\"请稍候...\"，换行，暂停等待按键（后续内容将另起一行，无法同行追加）\n\n    ; 正确：用 PRINTN 实现行内等待\n    PRINTN 请稍候...\n    ; → 文本立即显示，等待按键，后续内容同行追加\n    ```\n\n> `PRINTN` 是 DotNet 新增的行为后缀，由emuera.EM引入支持。\n\n***\n\n## 输出数值\n\n### PRINTVL — 输出表达式并换行\n\n`PRINTVL` 是 `PRINTV` + `L` 的组合，输出表达式的值并换行（整数表达式→数值，字符串表达式→文本）：\n\n```erb\n#DIM L_VAL = 42\nPRINTVL L_VAL              ; → 42\nPRINTVL L_VAL * 2 + 1      ; → 85\n```\n\n### 在 FORM 字符串中输出数值\n\n使用 `{表达式}` 在格式化字符串中插入数值：\n\n```erb\n#DIM L_HP = 80\n#DIM L_MAXHP = 100\nPRINTFORML HP：{L_HP}/{L_MAXHP}        ; → HP：80/100\nPRINTFORML HP：{L_HP,5}/{L_MAXHP,5}    ; → HP：   80/  100\n```\n\n### 输出浮点数（Skia 变体）\n\n浮点数在 `{}` 中默认使用 `ToString()` 格式输出，但 `{}` 不支持精度控制。如需指定精度，须用 `TOSTRF` 函数将浮点转为字符串，再通过 `%` 替换输出（`TOSTRF` 返回字符串，必须用 `%...%` 而非 `{}`）：\n\n```erb\n#DIMF L_PI = 3.14159265\nPRINTFORML 圆周率：{L_PI}                ; → 圆周率：3.14159265（{} 默认格式，无精度控制）\nPRINTFORML 圆周率：%TOSTRF(L_PI, \"F2\")%   ; → 圆周率：3.14（%...% 字符串替换 + TOSTRF 精度控制）\n```\n\n***\n\n## 输出颜色\n\n### SETCOLOR — 设置文字颜色\n\n```erb\nSETCOLOR 0xFF0000          ; 红色（RGB 十六进制）\nPRINTL 这是红色文字\nSETCOLOR 0x00FF00          ; 绿色\nPRINTL 这是绿色文字\nSETCOLORBYNAME yellow      ; 用颜色名设置\nPRINTL 这是黄色文字\nRESETCOLOR                 ; 恢复默认颜色\n```\n\n### PRINTD — 忽略颜色设置\n\n`PRINTD` 系列忽略 `SETCOLOR` 设置，始终以默认颜色输出：\n\n```erb\nSETCOLOR 0xFF0000\nPRINTL 这是红色\nPRINTDL 这是默认颜色（忽略 SETCOLOR）\n```\n\n### TEXT\\_BGC\\_ON / TEXT\\_BGC\\_OFF — 文本背景色（SK 专属）\n\nSkia 版提供 `TEXT_BGC_ON` / `TEXT_BGC_OFF` 为整行设置背景色：\n\n```erb\nTEXT_BGC_ON 255, 0, 0, 30       ; 红色背景，30% 不透明度\nPRINTL 这行有红色背景\nTEXT_BGC_OFF                     ; 关闭背景色\n```\n\n详见 [TEXT\\_BGC 参考手册](../Reference/TEXT_BGC.zh.md)。\n\n***\n\n## 其他输出指令\n\n### DRAWLINE — 绘制分隔线\n\n```erb\nDRAWLINE                    ; 绘制一条横线\n```\n\n### PRINTSINGLE — 单行输出\n\n`PRINTSINGLE` 系列始终在一行内显示，超出屏幕边缘的字符不显示。自动换行，没有 L/W 后缀：\n\n```erb\nPRINTSINGLEFORM 很长很长的文本...    ; 不折行，超宽部分截断\n```\n\n### PRINTDATA — 数据输出\n\n`PRINTDATA` 从多个 `DATA` 项中随机选择一个输出：\n\n```erb\nPRINTDATA\n    DATA 苹果\n    DATA 橘子\n    DATA 香蕉\nENDDATA\n; 随机输出其中一种水果\n```\n\n### PRINTPLAIN — 不生成按钮的输出 { #prinTPLAIN-overview }\n\n`PRINTPLAIN` 的 `PLAIN` 修饰语义是**不生成按钮**——文本中的 `[数值]` 不会被转换为可点击的交互按钮。\n\n`PLAIN` 与 `FORM` 是两个**正交**的修饰维度，可以自由组合：\n\n| 维度 | 控制什么 | 可选值 |\n|------|---------|-------|\n| `FORM` | 是否做 `%变量%`/`{表达式}` 插值 | 有 = 做插值（`FORM_STR` 参数类型）/ 无 = 不做插值（`STR` 参数类型） |\n| `PLAIN` | 是否将 `[数值]` 转换为按钮 | 有 = 不生成按钮 / 无 = 正常生成按钮 |\n\n具体组合如下：\n\n| 指令 | 参数类型 | FORM 插值 | 生成按钮 |\n|------|---------|:--------:|:--------:|\n| `PRINT` | `STR` | ❌ | ✅ |\n| `PRINTFORM` | `FORM_STR` | ✅ | ✅ |\n| `PRINTPLAIN` | `STR_NULLABLE` | ❌ | ❌ |\n| `PRINTPLAINFORM` | `FORM_STR_NULLABLE` | ✅ | ❌ |\n\n`PRINTPLAIN` 使用 `STR_NULLABLE` 参数类型（同 `PRINT` 一样不做 FORM 插值），同时 `PLAIN` 修饰使其不生成按钮：\n\n```erb\nPRINTPLAIN %NAME%           ; → %NAME%（STR_NULLABLE，不做 FORM 插值；PLAIN，不生成按钮）\nPRINTPLAINFORM %NAME%       ; → 艾莉娜（FORM_STR_NULLABLE，做 FORM 插值；PLAIN，不生成按钮）\n```\n\n这意味着在 `INPUT` 阻塞时，`[0]`、`[100]` 等将保持为纯文本，用户无法通过点击输入数值，必须手动键入：\n\n```erb\nPRINT [0] 点击我           ; → 可点击按钮，点击自动输入 0\nPRINTPLAIN [0] 不能点我    ; → 纯文本，不可点击，必须手动输入\nINPUT\n```\n\n详细机制见 [输出中的按钮——PRINTPLAIN](#prinTPLAIN) 和 [PRINTPLAIN 参考手册](../Reference/PRINTPLAIN.zh.md)。\n\n***\n\n## PRINT 系列速查表\n\n| 指令                | 参数类型        | 换行   | 等价写法                  |\n| ----------------- | ----------- | ---- | --------------------- |\n| `PRINT 文本`        | 简单字符串       | ❌    | —                     |\n| `PRINTL 文本`       | 简单字符串       | ✅    | `PRINT` + 换行          |\n| `PRINTW 文本`       | 简单字符串       | ✅+等待 | `PRINTL` + `WAIT`     |\n| `PRINTN 文本`       | 简单字符串       | ❌（行合并） | `PRINT` + 入屏 + `WAIT` + 行合并 |\n| `PRINTV 表达式`      | 表达式（整数·字符串） | ❌    | —                     |\n| `PRINTVL 表达式`     | 表达式（整数·字符串） | ✅    | `PRINTV` + 换行         |\n| `PRINTS 表达式`      | 字符串表达式      | ❌    | —                     |\n| `PRINTSL 表达式`     | 字符串表达式      | ✅    | `PRINTS` + 换行         |\n| `PRINTFORM 格式串`   | FORM 字符串    | ❌    | —                     |\n| `PRINTFORML 格式串`  | FORM 字符串    | ✅    | `PRINTFORM` + 换行      |\n| `PRINTFORMW 格式串`  | FORM 字符串    | ✅+等待 | `PRINTFORML` + `WAIT` |\n| `PRINTFORMS 表达式`  | FORM 字符串表达式 | ❌    | —                     |\n| `PRINTFORMSL 表达式` | FORM 字符串表达式 | ✅    | `PRINTFORMS` + 换行     |\n\n***\n\n## 输出中的按钮\n\n### `[N]` 自动按钮\n\n在 Hello World 中你已经见过 `[0]` 自动变成按钮的写法。这里补充更多细节：\n\n**识别规则**：`[整数]` 模式会被引擎自动识别为按钮核。只有整数才有效——`[abc]`、`[1.5]`、`[]` 都不会生成按钮。\n\n**按钮范围**：当一行只有一个 `[N]` 时，**整行都是按钮区域**：\n\n```erb\nPRINTL [0] 开始游戏     ; 点击 \"开始游戏\" 或 \"[0]\" 都等效于输入 0\n```\n\n**多按钮行**：一行有多个 `[N]` 时，引擎按空格间隔拆分为独立按钮：\n\n```erb\nPRINT [0] 是    [1] 否\nINPUT\n; 两个独立按钮：点击 \"是\" → RESULT=0，点击 \"否\" → RESULT=1\n```\n\n!!! warning \"多按钮拆分的边界情况\"\n\n```\n当一行中 `[N]` 和说明文字的排列不规则时，自动拆分可能不符合预期。此时应使用 `PRINTBUTTON` 显式创建按钮（见 HTML 标签语法）。\n```\n\n### PRINTPLAIN — 不生成按钮的输出 { #prinTPLAIN }\n\n`PRINTPLAIN` 输出文本但**不生成按钮**，即使文本包含 `[0]`：\n\n```erb\nPRINTPLAIN [0] 这不是按钮    ; 原样输出，不可点击\n```\n\n**关键区别**：在 `INPUT` 阻塞场景下，`PRINT [0] 点击` 生成的按钮可点击并自动传递 `0` 给 `INPUT`；而 `PRINTPLAIN [0] 不可点击` 中的 `[0]` 只是普通文本——用户必须手动输入 `0` 才能被 `INPUT` 接收。详解见 \"其他输出指令\" 一节的 [PRINTPLAIN — 不生成按钮的输出](#prinTPLAIN-overview)。\n\n`PRINTPLAINFORM` 版同理：`PRINTPLAINFORM 价格为 {PRICE} 元，选择 [1] 购买` 中的 `[1]` 也**不会**生成按钮。`PRINTPLAINFORM` 同时会做 FORM 插值（`{PRICE}` 会被展开为数值）。\n\n***\n\n## 常见陷阱\n\n| 陷阱            | 错误写法              | 正确写法                          | 原因                |\n| ------------- | ----------------- | ----------------------------- | ----------------- |\n| PRINT 期望变量替换  | `PRINT %NAME%`    | `PRINTFORM %NAME%`            | PRINT 不做 FORM 插值  |\n| PRINTS 不加引号   | `PRINTS hello`    | `PRINTS \"hello\"`              | 不加引号会被当作变量名       |\n| 忘记换行          | `PRINT 你好`        | `PRINTL 你好`                   | PRINT 不换行，内容会粘在一起 |\n| FORM 中浮点精度    | `PRINTFORM {PI}`  | `PRINTFORM %TOSTRF(PI,\"F2\")%` | `{}` 对浮点无精度控制；TOSTRF 返回字符串，须用 `%...%` |\n| `[abc]` 期望变按钮 | `PRINTL [abc] 选项` | `PRINTL [0] 选项` | 只有 `[整数]` 才生成按钮 |\n| `PRINTPLAIN` 期望有按钮 | `PRINTPLAIN [0] 确定 [1] 取消\\nINPUT` | `PRINT [0] 确定 [1] 取消\\nINPUT` | `PRINTPLAIN` 不生成按钮，用户必须手动输入 |\n\n***\n\n## 下一步\n\n| 你想了解什么       | 前往                                   |\n| :----------- | :----------------------------------- |\n| FORM 语法详解    | FORM 语法         |\n| 赋值语句         | 赋值语句             |\n| 值、类型与变量      | 值、类型与变量        |\n| 输入与等待        | [INPUT 指令](../Reference/INPUT.zh.md) |\n| PRINT 完整 API | [PRINT 系列](../Reference/PRINT.zh.md) |",
    "sourcePath": "docs/tutorial/basic-output.zh.md"
  },
  {
    "id": "tutorial/call",
    "title": "函数与 CALL",
    "names": [
      "CALL"
    ],
    "signatures": [],
    "summary": "ERABASIC 程序由函数组成。每个函数以 @ 标签开头，可以被 CALL 调用。函数是代码组织的基本单位——你写的每一行代码都隶属于某个函数。",
    "body": "!!! info \"本节对应手册\"\n\n    - **Reference 分类**: [函数系列（CALL 等）](../Reference/README.zh.md#function-call) / [RETURN 系列](../Reference/README.zh.md#return) / [输入・等待](../Reference/README.zh.md#input-wait)\n    - [CALL](../Reference/CALL.zh.md) — CALL 指令 API 参考\n    - [JUMP](../Reference/JUMP.zh.md) — JUMP 指令 API 参考\n    - [RETURN](../Reference/RETURN.zh.md) — RETURN 指令 API 参考\n    - [INPUT](../Reference/INPUT.zh.md) — INPUT 指令 API 参考\n    - [函数定义](../Emuera/function.zh.md) — 函数规格说明\n    - [用户定义变量](../Emuera/user_defined_variables.zh.md) — #DIM 声明规格\n\n---\n\n## 概述\n\nERABASIC 程序由**函数**组成。每个函数以 `@` 标签开头，可以被 `CALL` 调用。函数是代码组织的基本单位——你写的每一行代码都隶属于某个函数。\n\n| 概念 | 说明 |\n|------|------|\n| `@标签` | 定义函数的入口 |\n| `CALL` | 调用函数，执行后返回 |\n| `JUMP` | 跳转到函数，不返回 |\n| `RETURN` | 从函数返回，设置 RESULT |\n| `RETURNF` | 从表达式函数返回值 |\n\n!!! note \"eramaker 兼容性\"\n    `@标签`/`CALL`/`JUMP`/`RETURN` 是 eramaker 就存在的功能。`RETURNF`、`TRYCALL`/`TRYJUMP`、`#FUNCTION`/`#FUNCTIONS` 等是 Emuera 的扩展功能。\n\n---\n\n## @标签 — 定义函数\n\n`@` 开头的行定义一个函数：\n\n```erb\n@MY_FUNC\n    PRINTL 这是我的函数\nRETURN\n```\n\n### 函数命名规则\n\n- 以 `@` 开头，后跟函数名\n- 函数名在整个项目中必须唯一\n- 函数名区分大小写\n- 函数名只能包含字母、数字和下划线\n\n### 函数的执行\n\n函数只有在被 `CALL` 或 `JUMP` 调用时才会执行。引擎会在特定时机自动调用一些函数（如 `@SYSTEM_TITLE`、`@EVENTFIRST` 等），详见 事件函数。\n\n---\n\n## CALL — 调用函数\n\n`CALL` 调用指定函数，执行完毕后返回到 `CALL` 的下一行：\n\n```erb\n@SYSTEM_TITLE\n    CALL GREETING\n    PRINTL 返回了\n    WAIT\n\n@GREETING\n    PRINTL 你好！\nRETURN\n; 输出：\n; 你好！\n; 返回了\n```\n\n### CALL 的参数传递\n\n`CALL` 可以传递参数给函数，函数内通过 `ARG`、`ARGS`、`ARGF` 接收：\n\n```erb\n@SYSTEM_TITLE\n    CALL SHOW_DAMAGE 100, 50\n    WAIT\n\n@SHOW_DAMAGE, ARG:0, ARG:1\n    PRINTFORML 物理伤害：{ARG:0}，魔法伤害：{ARG:1}\n    PRINTFORML 总伤害：{ARG:0 + ARG:1}\nRETURN\n; 输出：\n; 物理伤害：100，魔法伤害：50\n; 总伤害：150\n```\n\n| 参数变量 | 类型 | 说明 |\n|---------|------|------|\n| `ARG` | 整数 | 接收整数参数，`ARG:0`、`ARG:1`... |\n| `ARGS` | 字符串 | 接收字符串参数，`ARGS:0`、`ARGS:1`... |\n| `ARGF` | 浮点数 | 接收浮点参数（Skia 变体），`ARGF:0`、`ARGF:1`... |\n\n### 参数声明的两种方式\n\n**方式一：使用内置参数变量 ARG/ARGS/ARGF**\n\nERABASIC 没有标量——所有变量都是数组。`ARG`/`ARGS`/`ARGF` 也是数组，省略下标时默认访问第 0 号元素：\n\n```erb\n@SHOW_DAMAGE, ARG, ARG:1\n; ARG 省略下标 = ARG:0（第 0 号元素），ARG:1 = 第 1 号元素\n; ARG:0 = 第一个参数，ARG:1 = 第二个参数\n```\n\n!!! warning \"不能重复注册同一数组元素\"\n\n    `@SHOW_DAMAGE, ARG, ARG` 会将两个参数都绑定到 `ARG:0`，导致第二个参数覆盖第一个。引擎会发出重复参数警告。必须用不同下标区分：`ARG, ARG:1` 或 `ARG:0, ARG:1`。\n\n**方式二：使用命名私有变量**（推荐）\n\n```erb\n@SHOW_DAMAGE(L_PHYS, L_MAGIC)\n#DIM DYNAMIC L_PHYS\n#DIM DYNAMIC L_MAGIC\n; 签名中的名字是对 #DIM 变量的引用，参数含义一目了然\n    PRINTFORML 物理伤害：{L_PHYS}，魔法伤害：{L_MAGIC}\nRETURN\n```\n\n命名私有变量和 ARG 数组是**完全独立的实体**——命名参数不会自动赋值给对应的 ARG 元素。详见 [变量声明系统 → 命名参数 vs ARG 数组](variable-declaration.zh.md#arg)。\n\n### 字符串参数\n\n```erb\n@SYSTEM_TITLE\n    CALL GREET \"艾莉娜\"\n    WAIT\n\n@GREET, ARGS\n    PRINTFORML 你好，%ARGS%！\nRETURN\n; 输出：你好，艾莉娜！\n```\n\n### 混合参数\n\n```erb\n@SHOW_INFO, ARGS, ARG, ARG:1\n; ARGS = ARGS:0 = 名字，ARG = ARG:0 = 等级，ARG:1 = HP\n    PRINTFORML %ARGS% Lv.{ARG} HP:{ARG:1}\nRETURN\n```\n\n---\n\n## RETURN — 从函数返回\n\n`RETURN` 结束当前函数，返回到调用者：\n\n```erb\n@MY_FUNC\n    PRINTL 执行中\n    RETURN              ; 返回到调用者\n    PRINTL 不会执行     ; RETURN 后面的代码不会执行\n```\n\n### RETURN 设置 RESULT\n\n`RETURN` 的参数会存入 `RESULT`：\n\n```erb\n@SYSTEM_TITLE\n    CALL GET_ANSWER\n    PRINTFORML 答案是{RESULT}\n    WAIT\n\n@GET_ANSWER\n    RETURN 42\n; 输出：答案是42\n```\n\n### 多个返回值\n\n`RETURN` 可以返回多个值，依次存入 `RESULT:0`、`RESULT:1`...：\n\n```erb\n@SYSTEM_TITLE\n    CALL GET_COORDS\n    PRINTFORML X={RESULT:0} Y={RESULT:1}\n    WAIT\n\n@GET_COORDS\n    RETURN 10, 20\n; 输出：X=10 Y=20\n```\n\n### 无 RETURN 的函数\n\n如果函数执行到末尾没有 `RETURN`，`RESULT` 会被设为 `0`：\n\n```erb\n@NO_RETURN\n    PRINTL 没有RETURN\n; 函数结束时 RESULT = 0\n```\n\n### RETURN 必定覆盖 RESULT\n\n`RETURN` **必定**覆盖 `RESULT`。即使在函数中手动给 `RESULT` 赋值，`RETURN` 执行时也会被覆盖：\n\n```erb\n@MY_FUNC\n    RESULT = 999\n    RETURN 1\n    ; 调用方的 RESULT 是 1 而非 999\n```\n\n函数末尾也会隐式覆盖——没有 `RETURN` 时，`RESULT:0` 被设为 `0`。\n\n### RETURNF 不覆盖 RESULT\n\n`#FUNCTION` 声明的表达式函数使用 `RETURNF` 返回值。`RETURNF` **不会覆盖 RESULT**，函数末尾也不会隐式赋值：\n\n```erb\n@MY_EXPR_FUNC\n#FUNCTION\n    RESULT = 999\n    RETURNF 1\n    ; 调用方的 RESULT 仍为 999（RETURNF 不触碰 RESULT）\n```\n\n| 函数类型 | 返回关键字 | 是否覆盖 RESULT | 函数末尾 RESULT |\n|---------|-----------|:---:|:---:|\n| 命令式（默认） | `RETURN` | ✅ 覆盖 | 隐式 `RESULT:0 = 0` |\n| 表达式式（`#FUNCTION`） | `RETURNF` | ❌ 不覆盖 | 不修改 |\n\n### RETURNFORM — FORM 语法动态求值返回\n\n`RETURNFORM` 是 `RETURN` 的动态求值变体。它先通过 FORM 语法展开字符串，再将展开结果**作为整数表达式重新解析求值**，最终写入 `RESULT`。\n\n```erb\n@MY_FUNC\n    #DIMS L_EXPR '= \"A * 10\"\n    RETURNFORM %L_EXPR%\n; 执行过程：FORM 展开 → \"A * 10\" → 词法分析+整数表达式求值 → 写入 RESULT\n; 等价于 RETURN A * 10\n```\n\n!!! warning \"RETURNFORM 中 % 是字符串替换符\"\n\n    `RETURNFORM` 中 `%` 是 FORM 语法的字符串替换符，不是取模运算符。\n    `RETURNFORM A % 100` 会被解析为 `A ` + 变量 `100` 的值，而不是 `A mod 100`。\n\n!!! info \"RETURNFORM 返回整数，不返回字符串\"\n\n    `RETURNFORM` 的求值分两阶段：\n\n    1. **FORM 展开**：将 `%变量%` 和 `{表达式}` 替换为实际值，得到一个字符串\n    2. **二次解析**：将展开后的字符串当作**整数表达式**重新词法分析并求值\n\n    最终结果写入 `RESULT`（整数数组）。不存在 `RETURNSFORM` 指令——如需返回字符串，请用 `RESULTS = ...` 赋值后 `RETURN`。\n\n    这意味着 RETURNFORM 本质上是一种**受限的动态求值**机制：参数在编译期以 FORM 字符串形式存在，运行时先展开再解析为整数表达式。现代 ERABASIC 提供了更通用的 `EVAL`/`EVALS`/`EVALF` 表达式函数来实现完整的动态求值。\n\n---\n\n## JUMP — 跳转到函数\n\n`JUMP` 跳转到另一个函数，**不会返回**：\n\n```erb\n@SYSTEM_TITLE\n    CALL AAA\n    PRINTW 回到了 SYSTEM_TITLE\n\n@AAA\n    PRINTL 在 AAA 中\n    JUMP BBB           ; 跳转到 BBB，不返回 AAA\n    PRINTL 不会执行     ; JUMP 后面的代码不会执行\n\n@BBB\n    PRINTL 在 BBB 中\n    RETURN              ; 返回到 AAA 的调用者（SYSTEM_TITLE）\n; 输出：\n; 在 AAA 中\n; 在 BBB 中\n; 回到了 SYSTEM_TITLE\n```\n\n### CALL vs JUMP\n\n| | `CALL` | `JUMP` |\n|------|:---:|:---:|\n| 是否返回 | ✅ 返回调用者 | ❌ 不返回 |\n| 调用栈 | 压入栈 | 不压入栈 |\n| 典型用途 | 调用子函数 | 函数间跳转（尾调用优化） |\n\n!!! warning \"JUMP 的调用栈风险\"\n\n    `JUMP` 不压入调用栈。如果调用链中全部使用 `JUMP`，最终 `RETURN` 时可能找不到返回目标，导致错误。\n\n### JUMP 与 RESULT\n\nJUMP 目标函数中的 `RETURN` 会正常设置 `RESULT`。JUMP 只是替换栈帧，不影响 `RETURN` 设置 `RESULT` 的行为。\n\n当 JUMP 目标函数结束时，引擎会检测到 `IsJump` 标志，**递归地回退栈帧**，直到回到最初的非 JUMP 调用方（如 `CALL`）。JUMP 链也能正确传递 RESULT：\n\n```erb\n@SYSTEM_TITLE\n    CALL AAA\n    PRINTVL RESULT    ; 42\n\n@AAA\n    JUMP BBB          ; AAA 被 BBB 替换\n\n@BBB\n    RETURN 42         ; RESULT = 42，递归回退到 SYSTEM_TITLE\n```\n\n---\n\n## CALLF — 表达式函数调用\n\n`CALLF` 调用**表达式函数**（用 `#FUNCTION` 声明的函数），可以在表达式中使用返回值：\n\n```erb\n@SYSTEM_TITLE\n    #DIM L_RESULT\n    L_RESULT = IS_VALID(100)\n    PRINTFORML 结果={L_RESULT}\n    WAIT\n\n@IS_VALID, ARG\n#FUNCTION\n    IF ARG > 0 && ARG < 1000\n        RETURNF 1\n    ELSE\n        RETURNF 0\n    ENDIF\n```\n\n`#FUNCTION` 声明的函数使用 `RETURNF` 返回值（而不是 `RETURN`），可以在表达式中直接调用。\n\n> 关于表达式函数的详细说明，见 命令 vs 表达式。\n\n---\n\n## INPUT — 等待玩家输入\n\n`INPUT` 暂停程序执行，等待玩家输入，将结果存入 `RESULT`：\n\n```erb\n@SYSTEM_TITLE\n    PRINTL 请输入数字：\n    INPUT\n    PRINTFORML 你输入了{RESULT}\n    WAIT\n```\n\n### INPUT 的默认值\n\n```erb\nINPUT 0          ; 未输入时 RESULT = 0\nINPUT 100        ; 未输入时 RESULT = 100\n```\n\n### INPUTS — 字符串输入\n\n`INPUTS` 等待字符串输入，结果存入 `RESULTS`：\n\n```erb\nPRINTL 请输入名字：\nINPUTS\nPRINTFORML 你好，%RESULTS%！\n```\n\n### INPUT 与 RESULT\n\n`INPUT` 和 `CALL` 都会修改 `RESULT`。如果需要在 `CALL` 后使用 `INPUT` 的结果，应该先保存：\n\n```erb\nINPUT\n#DIM L_INPUT = RESULT       ; 保存输入值\nCALL SOME_FUNC              ; RESULT 被覆盖\nPRINTFORML 输入值={L_INPUT}  ; 使用保存的值\n```\n\n### INPUT 与按钮的联动\n\n在 Hello World 中你已经见过 `[N]` 按钮与 `INPUT` 的配合。这里补充关键细节：\n\n**类型匹配**：`INPUT` 只能点击整数按钮（`[0]`、`[1]` 等），`INPUTS` 只能点击字符串按钮。类型不匹配时按钮不可点击。\n\n```erb\n; INPUT + 整数按钮（常见）\nPRINTL [0] 开始\nPRINTL [1] 退出\nINPUT                        ; 点击 [0] → RESULT=0\n\n; INPUTS + 字符串按钮\nPRINTBUTTON \"[HogeHoge] \", \"HogeHoge\"\nPRINTBUTTON \"[PugePuge] \", \"PugePuge\"\nINPUTS                       ; 点击 → RESULTS=\"HogeHoge\"\n```\n\n**按钮只在 INPUT 等待时激活**：`PRINTL [0]` 创建了按钮，但只有执行到 `INPUT` 时按钮才变为可点击状态。此前的按钮点击无效。\n\n**旧按钮失效**：每次 `INPUT` 后，之前的按钮自动失效（不可再次点击），只有新的按钮才能被选中。\n\n---\n\n## 函数内的变量声明\n\n函数内用 `#DIM`/`#DIMS`/`#DIMF` 声明私有变量，这些变量只在当前函数内可见：\n\n```erb\n@MY_FUNC\n#DIM L_COUNT                ; 私有整数变量\n#DIMS L_NAME '= \"默认\"      ; 私有字符串变量\n#DIMF L_RATE = 0.5          ; 私有浮点变量（Skia 变体）\n\n    FOR L_COUNT, 0, 10\n        PRINTFORML %L_NAME%：{L_COUNT}\n    NEXT\nRETURN\n```\n\n!!! warning \"#DIM 必须在 @ 标签行之后、执行语句之前\"\n\n    `#DIM` 等预处理行必须写在函数开头，不能写在可执行语句之后。多个 `#` 行可以连续出现。\n\n> 关于变量声明的完整说明，见 值、类型与变量 和 [变量声明系统](../Emuera/user_defined_variables.zh.md)。\n\n---\n\n## 常见陷阱 { #common-pitfalls }\n\n| 陷阱 | 错误写法 | 正确写法 | 原因 |\n|------|---------|---------|------|\n| CALL 后用 RESULT | `CALL F` 后直接用 `RESULT` | 先保存 `RESULT` | 后续操作可能覆盖 RESULT |\n| JUMP 后写代码 | `JUMP F` 后写逻辑 | JUMP 后不写代码 | JUMP 不返回，后面代码不执行 |\n| #DIM 位置错误 | 可执行语句后写 `#DIM` | `@` 标签行之后 | #DIM 是预处理行 |\n| RETURNFORM 取模 | `RETURNFORM A % 100` | `RETURN A % 100` | % 在 RETURNFORM 中是替换符 |\n| 函数名冲突 | 两个 `@MY_FUNC` | 函数名唯一 | 项目内函数名不能重复 |\n| 忘记 RETURN | 函数末尾无 RETURN | 加 `RETURN` | 无 RETURN 时 RESULT = 0 |\n| 手动设 RESULT 后 RETURN | `RESULT = 999` 后 `RETURN 1` | 不要手动设 RESULT | RETURN 必定覆盖 RESULT |\n| 误以为 JUMP 不设 RESULT | 以为 JUMP 后 RESULT 不变 | JUMP 目标的 RETURN 正常设 RESULT | JUMP 替换栈帧但不影响 RESULT 设置 |\n| INPUT 选字符串按钮 | `INPUT` + `PRINTBUTTON \"x\", \"str\"` | 改用 `INPUTS` | INPUT 只能点击整数按钮 |\n\n---\n\n## 下一步\n\n| 你想了解什么 | 前往 |\n|:---|:---|\n| 值、类型与变量 | 值、类型与变量 |\n| 变量声明系统（REF/OUT/VARIADIC） | 变量声明系统 |\n| 条件分支 | 条件分支 |\n| 循环 | 循环 |\n| 事件函数 | 事件函数 |\n| 命令 vs 表达式 | 命令 vs 表达式 |\n| CALL 完整 API | [CALL](../Reference/CALL.zh.md) |\n| RETURN 完整 API | [RETURN](../Reference/RETURN.zh.md) |",
    "sourcePath": "docs/tutorial/call.zh.md"
  },
  {
    "id": "tutorial/character-variables",
    "title": "角色变量",
    "names": [
      "CHARACTER-VARIABLES"
    ],
    "signatures": [],
    "summary": "era 游戏的核心是角色——每个角色有自己的属性、状态、能力。ERABASIC 通过角色变量系统来管理这些数据。",
    "body": "!!! info \"本节对应手册\"\n\n    - **Reference 分类**: [角色操作・引用](../Reference/README.zh.md#character-operations) / [变量操作・CSV 引用](../Reference/README.zh.md#variable-operations)\n    - [变量规格与一览](../Emuera/variables.zh.md) — 所有变量的完整规格\n    - [用户定义变量](../Emuera/user_defined_variables.zh.md) — #DIM 声明规格\n    - [头文件（ERH）](../Emuera/ERH.zh.md) — 全局变量声明\n\n---\n\n## 概述\n\nera 游戏的核心是**角色**——每个角色有自己的属性、状态、能力。ERABASIC 通过**角色变量**系统来管理这些数据。\n\n角色变量与普通变量的关键区别：角色变量的第一维索引是**角色登记编号 (CharaID)**，每个角色拥有独立的一组数据。\n\n!!! note \"eramaker 兼容性\"\n    基础信息变量（`NAME`/`CALLNAME`/`NO`）、数值型角色变量（`BASE`/`ABL`/`TALENT`/`EXP`/`MARK`/`CFLAG`/`PALAM`/`SOURCE`）、角色管理指令（`ADDCHARA`/`DELCHARA`）是 eramaker 就存在的功能。`CSTR`/`CDFLAG`/`TCVAR`、CSV 读取函数（`CSVABL` 等）、`VariableSize.csv`、自定义角色变量（`#DIM CHARADATA`）是 Emuera 的扩展功能。\n\n```erb\n; 普通变量：一维索引\nFLAG:10 = 1\n\n; 角色变量：第一维是登记编号 (CharaID)\nCFLAG:TARGET:10 = 1    ; 当前调教角色的第10号 CFLAG\nCFLAG:MASTER:10 = 1    ; 主角的第10号 CFLAG\n```\n\n---\n\n## 角色编号系统\n\n理解角色变量的前提是理解两种\"角色编号\"：\n\n### 角色注册编号 (NO) vs 角色登记编号 (CharaID)\n\n| 概念 | 标识符 | 日文原文 | 说明 | 特点 |\n|------|--------|---------|------|------|\n| **角色注册编号 (NO)** | `NO` | キャラ番号 | CSV 中定义的固定编号 | 静态不变，标识角色身份，类似\"身份证号\" |\n| **角色登记编号 (CharaID)** | `MASTER`/`TARGET`/`ASSI`/`PLAYER` | キャラ登録番号 | 引擎动态分配的索引 | 从 0 开始连续，随增删变化，类似\"座位号\" |\n\n!!! warning \"日文原文命名与中文直觉相反\"\n\n    日文原文将 `CharacterList[i]` 的动态索引称为「キャラ登録番号」（字面：角色登记编号），\n    将 CSV 中的固定编号 `NO` 称为「キャラ番号」（字面：角色编号）。\n\n    在中文语境中，\"注册\"暗示\"登记在册、固定不变\"（如注册商标、注册号），\n    而\"登记\"暗示\"临时入住、动态分配\"（如酒店登记号）。\n\n    | 日文原文 | 中文术语 | 缩写 | 类比 | 特点 |\n    |---------|---------|------|------|------|\n    | キャラ番号 | **角色注册编号** | **(NO)** | 身份证号 | CSV 定义，永久不变 |\n    | キャラ登録番号 | **角色登记编号** | **(CharaID)** | 酒店登记号 | 动态分配，随 ADD/DEL 重排 |\n\n    `GETCHARA(NO值)` 的语义就是\"用角色注册编号 (NO) 查角色登记编号 (CharaID)\"——用身份证号找酒店房间号。\n\n```erb\n; 角色登记编号 (CharaID) 是动态的\n; 游戏启动时主角自动加载，登记编号 (CharaID) 为 0\n; ADDCHARA 分配下一个连续编号\n; DELCHARA 后编号重新排列\n\n; 角色注册编号 (NO) 是静态的\n; 在 CharaXX.csv 的番号行定义\n; 不会随添加/删除而改变\n```\n\n### 四个核心登记编号 (CharaID)\n\n| 变量 | 含义 | 默认值 | 说明 |\n|------|------|--------|------|\n| `MASTER` | 主角的登记编号 (CharaID) | `0`（固定） | 始终为 0 |\n| `TARGET` | 当前调教对象的登记编号 (CharaID) | `1` | 被调教的角色 |\n| `ASSI` | 助手的登记编号 (CharaID) | `-1`（无助手） | 辅助调教的角色 |\n| `PLAYER` | 当前执行调教者的登记编号 (CharaID) | `0`（= MASTER） | 通常等于 MASTER 或 ASSI，由脚本赋值 |\n\n> **PLAYER 与 ASSIPLAY 的关系**：`PLAYER` 表示\"谁在执行调教\"，`ASSIPLAY` 表示\"助手是否在执行调教\"（0=主角执行，1=助手执行）。当 `ASSIPLAY == 1` 时，`PLAYER` 通常被设为 `ASSI`。\n\n```erb\n; 访问主角的体力\nBASE:MASTER:0\n\n; 访问调教对象的体力\nBASE:TARGET:0\n\n; 访问助手的体力（ASSI 为 -1 时会出错）\nBASE:ASSI:0\n\n; 访问当前执行调教者的体力\nBASE:PLAYER:0\n\n; PLAYER 的典型赋值模式\nIF ASSIPLAY\n    PLAYER = ASSI\nELSE\n    PLAYER = MASTER\nENDIF\n```\n\n### 登记编号 (CharaID) 的动态性\n\n```erb\n; 初始状态：只有主角，登记编号 (CharaID) 0\n; MASTER == 0, CHARANUM == 1\n\nADDCHARA 5        ; 添加角色注册编号 (NO) 5的角色，登记编号 (CharaID) 变为 1\nADDCHARA 10       ; 添加角色注册编号 (NO) 10的角色，登记编号 (CharaID) 变为 2\n; CHARANUM == 3\n\nDELCHARA 1        ; 删除登记编号 (CharaID) 1的角色\n; 登记编号 (CharaID) 重新排列：原编号2变为1\n; CHARANUM == 2\n```\n\n### 遍历所有角色\n\n```erb\nREPEAT CHARANUM\n    ; COUNT 为当前角色的登记编号 (CharaID)（0 ~ CHARANUM-1）\n    PRINTFORML 登记编号(CharaID)={COUNT}, 注册编号(NO)={NO:COUNT}, 名字=%NAME:COUNT%\nREND\n```\n\n### 通过角色注册编号 (NO) 查找登记编号 (CharaID)\n\n```erb\n#DIM L_REG_NO\nL_REG_NO = GETCHARA(5)    ; 查找角色注册编号 (NO) 为5的登记编号 (CharaID)\nIF L_REG_NO >= 0\n    PRINTFORML 找到了，登记编号 (CharaID)={L_REG_NO}\nELSE\n    PRINTL 角色不存在\nENDIF\n```\n\n---\n\n## 角色变量分类\n\n### 基础信息变量\n\n每个角色必须有的基本信息：\n\n| 变量 | 类型 | 说明 |\n|------|------|------|\n| `NAME` | 字符串 | 角色名 |\n| `CALLNAME` | 字符串 | 角色称呼 |\n| `NICKNAME` | 字符串 | 昵称 |\n| `MASTERNAME` | 字符串 | 对主人的称呼 |\n| `NO` | 整数 | 角色注册编号 (NO)（CSV 定义，静态不变） |\n\n```erb\nPRINTFORML 名字：%NAME:TARGET%\nPRINTFORML 称呼：%CALLNAME:TARGET%\nPRINTFORML 角色注册编号 (NO)：{NO:TARGET}\n```\n\n### 数值型角色变量\n\n最常用的角色数据存储：\n\n| 变量 | 说明 | 保存 | 初始化时机 |\n|------|------|:----:|-----------|\n| `BASE` | 基础参数（体力、气力等） | ✅ | — |\n| `ABL` | 能力值 | ✅ | — |\n| `TALENT` | 素质（二值标记） | ✅ | — |\n| `EXP` | 经验值 | ✅ | — |\n| `MARK` | 刻印 | ✅ | — |\n| `CFLAG` | 自定义标记 | ✅ | — |\n| `PALAM` | 参数（调教中变化） | ✅ | TRAIN 循环开始时 |\n| `SOURCE` | 来源值（调教计算用） | ✅ | `@SOURCE_CHECK` 后清零 |\n| `EX` | 绝顶经验 | ✅ | TRAIN 循环开始时 |\n| `TEQUIP` | 装备状态 | ✅ | TRAIN 循环开始时 |\n| `STAIN` | 污渍 | ✅ | TRAIN 循环开始时 |\n| `EQUIP` | 装备 | ✅ | — |\n| `JUEL` | 宝石（能力提升用） | ✅ | — |\n| `GOTJUEL` | 获得的宝石 | ✅ | TRAIN 循环开始时 |\n\n```erb\n; 读取角色的体力\nPRINTFORML 体力：{BASE:TARGET:0}\n\n; 检查素质\nIF TALENT:TARGET:服从\n    PRINTL 她很服从\nENDIF\n\n; 设置自定义标记\nCFLAG:TARGET:好感度 += 10\n```\n\n### 字符串型角色变量\n\n| 变量 | 说明 | 保存 |\n|------|------|:----:|\n| `CSTR` | 自定义字符串 | ✅ |\n\n```erb\nCSTR:TARGET:10 = 特殊状态：发情\nPRINTFORML 状态：%CSTR:TARGET:10%\n```\n\n### TRAIN 循环专用角色变量\n\n这些变量在 TRAIN 循环开始时自动初始化为 0：\n\n| 变量 | 说明 | 对应全局变量 |\n|------|------|-------------|\n| `CUP` | 角色参数上升值 | `UP` |\n| `CDOWN` | 角色参数下降值 | `DOWN` |\n| `TCVAR` | 角色临时变量 | `TFLAG` |\n\n```erb\n; CUP/CDOWN 需要用 CUPCHECK 而非 UPCHECK\nCUP:TARGET:0 += 100\nCUPCHECK TARGET\n```\n\n### 三维角色变量\n\n| 变量 | 说明 |\n|------|------|\n| `CDFLAG` | 三维角色变量，需要三个索引 |\n\n```erb\n; 第一参数：角色登记编号 (CharaID)\n; 第二、三参数：自定义索引\nCDFLAG:MASTER:0:2 = 1\n```\n\n---\n\n## 角色管理指令\n\n### 添加角色\n\n```erb\n; 添加角色注册编号 (NO) 为 0 的角色（通常在 FIRST 中）\nADDCHARA 0\n\n; 添加指定角色注册编号 (NO) 的角色\nADDCHARA 5\n\n; 在指定位置插入角色\nADDCHARA 3, 1    ; 在登记编号 (CharaID) 1的位置插入角色注册编号 (NO) 3的角色\n```\n\n### 删除角色\n\n```erb\n; 删除指定登记编号 (CharaID) 的角色\nDELCHARA 2\n\n; 删除所有角色（除了 MASTER）\n; 注意：这不会自动重新编号\n```\n\n### 查找角色\n\n```erb\n; 按角色注册编号 (NO) 查找登记编号 (CharaID)\n#DIM L_CHARA_ID\nL_CHARA_ID = GETCHARA(5)\n; L_CHARA_ID >= 0 表示找到，-1 表示不存在\n\n; 按角色名查找登记编号 (CharaID) — 使用 FINDCHARA\nL_CHARA_ID = FINDCHARA(NAME, \"博丽灵梦\")\n; L_CHARA_ID >= 0 表示找到，-1 表示不存在\n\n; 按角色名反查注册编号 (NO) — 使用 GETCSVNOBYNAME\n#DIM L_NO\nL_NO = GETCSVNOBYNAME(\"博丽灵梦\")\n; L_NO >= 0 表示找到，-1 表示不存在\n; 注意：返回的是注册编号 (NO)，不是登记编号 (CharaID)\n; 若需登记编号，可组合使用：GETCHARA(GETCSVNOBYNAME(\"博丽灵梦\"))\n```\n\n### 角色数量\n\n```erb\n; CHARANUM 返回当前已注册的角色数量\nPRINTFORML 当前角色数：{CHARANUM}\n```\n\n---\n\n## CSV 定义角色数据\n\n角色数据在 `CSV/CHARA*.CSV` 文件中定义。文件名中的数字是**角色注册编号 (NO)**。\n\n### 基本格式\n\n```csv\n; CSV/CHARA0.CSV — 角色注册编号 (NO) 0\n番号,0\n名前,博丽灵梦\n呼び名,灵梦\n基礎,0,1000\n基礎,1,500\n素質,0,1\n能力,0,5\n```\n\n| 关键字 | 对应变量 | 说明 |\n|--------|---------|------|\n| `番号` | `NO` | 角色注册编号 (NO) |\n| `名前` | `NAME` | 角色名 |\n| `呼び名` | `CALLNAME` | 角色称呼 |\n| `基礎` | `BASE` | 基础参数 |\n| `素質` | `TALENT` | 素质 |\n| `能力` | `ABL` | 能力值 |\n| `経験` | `EXP` | 经验值 |\n| `刻印` | `MARK` | 刻印 |\n| `CFLAG` | `CFLAG` | 自定义标记 |\n| `CSTR` | `CSTR` | 自定义字符串 |\n\n### CSV 名称文件\n\n每种角色变量都有对应的 CSV 名称文件，定义索引对应的名称：\n\n```csv\n; CSV/base.csv — BASE 变量的名称\n0,体力\n1,气力\n```\n\n```erb\n; 引用名称\nPRINTFORML %BASENAME:0%：{BASE:TARGET:0}\n; 输出：体力：1000\n```\n\n内置变量的名字来自 `CSV` 文件夹内对应的 CSV 文件；用户变量用 `.erd`、别名用 `.als` 的完整机制见[变量标识符：CSV／ALS／ERD](variable-declaration.zh.md#identifiers)。\n\n### CSV → 变量的完整映射\n\nCSV 文件、名称变量、数据变量、CharaXX.csv 关键字、CSV读取函数的关系一览。\n\n#### 角色变量系\n\n| CSV 名称文件 | 名称变量 | 数据变量 | CharaXX.csv 关键字 | CSV读取函数 |\n|:--|:--|:--|:--|:--|\n| `abl.csv` | `ABLNAME` | `ABL` | `能力` | `CSVABL()` |\n| `talent.csv` | `TALENTNAME` | `TALENT` | `素質` | `CSVTALENT()` |\n| `exp.csv` | `EXPNAME` | `EXP` | `経験` | `CSVEXP()` |\n| `mark.csv` | `MARKNAME` | `MARK` | `刻印` | `CSVMARK()` |\n| `base.csv` | `BASENAME` | `BASE` / `MAXBASE` | `基礎` | `CSVBASE()` |\n| `palam.csv` | `PALAMNAME` | `PALAM` / `JUEL` / `GOTJUEL` | — | — |\n| `cflag.csv` | `CFLAGNAME` | `CFLAG` | `フラグ` | `CSVCFLAG()` |\n| `cstr.csv` | `CSTRNAME` | `CSTR` | `CSTR` | `CSVCSTR()` |\n| `source.csv` | `SOURCENAME` | `SOURCE` | — | — |\n| `ex.csv` | `EXNAME` | `EX` / `NOWEX` | — | — |\n| `equip.csv` | `EQUIPNAME` | `EQUIP` | — | — |\n| `tequip.csv` | `TEQUIPNAME` | `TEQUIP` | — | — |\n| `relation.csv` | — | `RELATION` | `相性` | `CSVRELATION()` |\n| `juel.csv` | — | `JUEL` | `珠` | `CSVJUEL()` |\n| `equip.csv` | — | `EQUIP` | `装着物` | `CSVEQUIP()` |\n| `stain.csv` | `STAINNAME` | `STAIN` | — | — |\n| `tcvar.csv` | `TCVARNAME` | `TCVAR` | — | — |\n| `cdflag1.csv` | `CDFLAGNAME1` | `CDFLAG`（第2索引） | — | — |\n| `cdflag2.csv` | `CDFLAGNAME2` | `CDFLAG`（第3索引） | — | — |\n\n#### 非角色变量系\n\n| CSV 名称文件 | 名称变量 | 数据变量 | 备注 |\n|:--|:--|:--|:--|\n| `flag.csv` | `FLAGNAME` | `FLAG` | |\n| `tflag.csv` | `TFLAGNAME` | `TFLAG` | |\n| `train.csv` | `TRAINNAME` | — | 命令名定义 |\n| `item.csv` | `ITEMNAME` / `ITEMPRICE` | `ITEM` / `ITEMSALES` | 第3列为价格 |\n| `strname.csv` | `STRNAME` | — | STR 的名称定义 |\n| `str.csv` | — | `STR` | **值的直接赋值**（非名称） |\n| `tstr.csv` | `TSTRNAME` | `TSTR` | |\n| `savestr.csv` | `SAVESTRNAME` | `SAVESTR` | |\n| `global.csv` | `GLOBALNAME` | `GLOBAL` | |\n| `globals.csv` | `GLOBALSNAME` | `GLOBALS` | |\n\n> **注意 `str.csv` 与 `strname.csv` 的区别**：`str.csv` 是向变量 `STR` 直接赋值的文件，`strname.csv` 是定义 `STRNAME`（索引名称）的文件。两者的作用完全不同。\n\n### CSV 到变量的转换示例\n\nCharaXX.csv 中定义的数据，在 `ADDCHARA` 执行时自动赋值到对应的变量。\n\n```csv\n; CSV/Chara5.csv\n番号,5\n名前,博丽灵梦\n呼び名,灵梦\n基礎,0,2000\n基礎,1,1000\n素質,0,1\n素質,3,1\n能力,0,5\n能力,2,3\n経験,1,100\nフラグ,0,1\nCSTR,0,测试用角色\n```\n\n```erb\n; ADDCHARA 执行后的变量状态（登记编号 (CharaID) = 1 时）\n; NO:1 = 5\n; NAME:1 = \"博丽灵梦\"\n; CALLNAME:1 = \"灵梦\"\n; BASE:1:0 = 2000,  BASE:1:1 = 1000\n; TALENT:1:0 = 1,   TALENT:1:3 = 1\n; ABL:1:0 = 5,      ABL:1:2 = 3\n; EXP:1:1 = 100\n; CFLAG:1:0 = 1\n; CSTR:1:0 = \"测试用角色\"\n```\n\n### 通过名称进行索引访问\n\n当名称变量已定义时，可以用名称代替数值索引来访问。\n\n```erb\n; 以下写法完全等价\nABL:TARGET:0\nABL:TARGET:従順        ; 当 ABLNAME:0 = \"従順\" 时\n\n; 名称访问也可以通过 GETNUM 实现\n#DIM idx\nidx = GETNUM(ABL, \"従順\")    ; idx = 0\nABL:TARGET:idx = 10\n```\n\n### CSV 读取函数\n\n无需 `ADDCHARA` 即可直接读取 CSV 定义值的函数群。第一参数是**角色注册编号 (NO)**（不是登记编号 (CharaID)）。\n\n```erb\n; 直接读取角色注册编号 (NO) 5的CSV数据（无需 ADDCHARA）\nPRINTFORML 能力0 = {CSVABL(5, 0)}\nPRINTFORML 素质3 = {CSVTALENT(5, 3)}\nPRINTFORML 基础0 = {CSVBASE(5, 0)}\nPRINTFORML CFLAG0 = {CSVCFLAG(5, 0)}\nPRINTFORML CSTR0 = %CSVCSTR(5, 0)%\n```\n\n> **CSV 读取函数与变量访问的区别**：`CSVABL(5, 0)` 读取角色注册编号 (NO) 5的 CSV 定义值。`ABL:TARGET:0` 读取登记编号 (CharaID) TARGET 的当前运行时值。CSV 读取函数用于引用初始值，运行时值用变量访问。\n\n### VariableSize.csv 修改数组大小\n\nEmuera 中可以通过 `CSV/VariableSize.csv` 修改各变量的元素数量。\n\n```csv\n; CSV/VariableSize.csv\nABL,100\nTALENT,1000\nCFLAG,10000\nSTR,20000\n```\n\neramaker 中各变量有固定上限（如 ABL 最多99、TALENT 最多99）。Emuera 中可通过 `VariableSize.csv` 扩展这些限制。但 `ABLNAME` 等名称变量的元素数不可修改（自动跟随 CSV 文件的行数）。\n\n---\n\n## 自定义角色变量\n\n当内置角色变量不够用时，可以在 ERH 头文件中声明自定义角色变量：\n\n```erb\n; ERH/VARIABLE.ERH\n\n; 自定义角色变量\n#DIM CHARADATA 好感度      ; 整数型，每个角色独立\n#DIMS CHARADATA 特殊状态   ; 字符串型，每个角色独立\n\n; 可保存的角色变量\n#DIM SAVEDATA CHARADATA 亲密度\n```\n\n使用方式与内置角色变量完全相同：\n\n```erb\n好感度:TARGET += 10\n特殊状态:TARGET:0 = 恋爱\n\nPRINTFORML 好感度：{好感度:TARGET}\nPRINTFORML 状态：%特殊状态:TARGET:0%\n```\n\n---\n\n## RELATION — 特殊的角色变量\n\n`RELATION` 是特殊的角色变量，它的第二参数是**角色注册编号 (NO)**而非登记编号 (CharaID)：\n\n```erb\n; RELATION:登记编号(CharaID):角色注册编号(NO)\n; 调教对象与角色注册编号 (NO) 3的角色的相性\nRELATION:TARGET:3 = 50\n```\n\n这与大多数角色变量不同——其他角色变量的第二参数是数组索引，而 `RELATION` 的第二参数是角色注册编号 (NO)。\n\n---\n\n## 常见陷阱\n\n| 陷阱 | 说明 | 解决方案 |\n|------|------|---------|\n| 混淆登记编号 (CharaID) 和角色注册编号 (NO) | 登记编号 (CharaID) 随增删变化，角色注册编号 (NO) 固定不变 | 用 `GETCHARA()` 按角色注册编号 (NO) 查找登记编号 (CharaID) |\n| `ASSI` 为 -1 时访问角色变量 | 没有助手时 `ASSI == -1`，访问 `BASE:ASSI:0` 会出错 | 先检查 `ASSI >= 0` |\n| `DELCHARA` 后登记编号 (CharaID) 变化 | 删除角色后，后续角色的登记编号 (CharaID) 会重新排列 | 遍历时用 `CHARANUM` 和 `REPEAT`，不要缓存登记编号 (CharaID) |\n| 忘记 `CUP`/`CDOWN` 用 `CUPCHECK` | `CUP`/`CDOWN` 需要用 `CUPCHECK` 而非 `UPCHECK` | 角色版用 `CUPCHECK`，全局版用 `UPCHECK` |\n| `TALENT` 是二值标记 | `TALENT` 的值是 0 或 1，不是任意整数 | 用 `IF TALENT:TARGET:服从` 而非 `IF TALENT:TARGET:服从 > 0` |\n| `SOURCE` 自动清零 | `@SOURCE_CHECK` 结束后所有 `SOURCE` 被设为 0 | 如需保留 SOURCE 值，在 `@SOURCE_CHECK` 前保存 |\n| `PALAM` 在 TRAIN 开始时清零 | `PALAM` 在 `BEGIN TRAIN` 时被初始化 | 需要跨 TRAIN 保留的数据用 `CFLAG` 或 `BASE` |\n\n---\n\n## 下一步\n\n| 你想了解什么 | 前往 |\n|:---|:---|\n| 事件函数详解 | 事件函数 |\n| 状态机流程 | 状态机流程 |\n| 变量声明系统 | 变量声明系统 |\n| 完整变量规格 | [变量规格与一览](../Emuera/variables.zh.md) |\n| 用户定义变量 | [用户定义变量](../Emuera/user_defined_variables.zh.md) |",
    "sourcePath": "docs/tutorial/character-variables.zh.md"
  }
];
