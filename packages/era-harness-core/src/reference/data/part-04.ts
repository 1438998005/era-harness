// 本文件由 scripts/build-reference.ts 生成，请勿手工修改。
//
// 数据来源：https://github.com/qirchen421/emuera.sk.doc  docs/Reference/*.zh.md
// 上游版本：606670cd78b58f5d9a050013d1d3f41db5a87a1b
// 许可：CC BY-NC 4.0（http://creativecommons.org/licenses/by-nc/4.0/）
//       与本仓库代码的 Apache-2.0 分开管理，见 NOTICE-emuera-sk-doc.md
import type { ReferenceEntry } from '../types.js';

export const ENTRIES_PART_04: readonly ReferenceEntry[] = [
  {
    "id": "GETMETH",
    "title": "GETMETH,GETMETHS,GETMETHF",
    "names": [
      "GETMETH",
      "GETMETHS",
      "GETMETHF"
    ],
    "signatures": [
      {
        "name": "GETMETH",
        "params": "`string`(, `int`, `argument`...)",
        "returns": "`int`",
        "engines": [
          "etc"
        ],
        "overloads": []
      },
      {
        "name": "GETMETHS",
        "params": "`string`(, `string`, `argument`...)",
        "returns": "`string`",
        "engines": [
          "etc"
        ],
        "overloads": []
      },
      {
        "name": "GETMETHF",
        "params": "`string`(, `float`, `argument`...)",
        "returns": "`float`",
        "engines": [
          "skia"
        ],
        "overloads": []
      }
    ],
    "summary": "可以从字符串调用式中函数。GETMETH 对应 #FUNCTION，GETMETHS 对应 #FUNCTIONS，GETMETHF 对应 #FUNCTIONF。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint GETMETH functionName(, defaultValue, argument...)\n\tstring GETMETHs functionName(, defaultValue, argument...)\n\tfloat GETMETHF functionName(, defaultValue, argument...)\n    ```\n    可以从字符串调用式中函数。`GETMETH` 对应 `#FUNCTION`，`GETMETHS` 对应 `#FUNCTIONS`，`GETMETHF` 对应 `#FUNCTIONF`。\n    第二参数是函数未找到时的返回值，第三参数及后续参数将成为第一参数所指定的式中函数的参数。\n\n!!! hint \"提示\"\n\n    同时支持命令和式中函数。\n\n### 相关项目\n- GETVAR,GETVARS,SETVAR"
  },
  {
    "id": "GETMILLISECOND",
    "title": "GETMILLISECOND",
    "names": [
      "GETMILLISECOND"
    ],
    "signatures": [
      {
        "name": "GETMILLISECOND",
        "params": "无",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "获取自公元0001年1月1日起经过的时间，单位为毫秒。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int GETMILLISECOND\n    ```\n    获取自公元0001年1月1日起经过的时间，单位为毫秒。\n    由于可以直接进行加减运算，因此比 GETTIME 更适合用于测量经过的时间。\n    请注意，返回值的精度取决于运行环境，大约在十几到几十毫秒之间。\n    （如果仅经过了几毫秒，可能会返回相同的值）\n    若用于性能测量，请留意此点。\n\n!!! hint \"提示\"\n\n    该函数既可作为指令使用，也可在表达式中作为函数使用。\n\n### 相关项目\n- GETSECOND\n- GETTIME"
  },
  {
    "id": "GETNUM",
    "title": "GETNUM",
    "names": [
      "GETNUM"
    ],
    "signatures": [
      {
        "name": "GETNUM",
        "params": "`variable`, `string`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "从各 CSV 文件中定义的名称获取其对应的数值，并赋值给 RESULT:0。",
    "body": "!!! info \"API\"\n\n    ```erb\n    GETNUM variableName, indexName\n    ```\n    从各 CSV 文件中定义的名称获取其对应的数值，并赋值给 `RESULT:0`。\n    例如，如果在 `abl.csv` 中定义了 `2,技巧`，那么执行 `GETNUM ABL, \"技巧\"` 后，`RESULT:0` 将被赋值为 `2`。\n    如果未定义，则结果为 `-1`。\n    CSV 文件与变量的对应关系遵循 [「Emuera 新增语法」页面中的「通过字符串指定数组变量元素」](../Emuera/expression.md#string-array-element) 部分。\n\n!!! hint \"提示\"\n\n    此功能同时支持指令和表达式函数两种形式。\n\n### 相关项目\n- CSV 状态相关\n- [动态解析与反射](../tutorial/dynamic-reflection.zh.md) — GETNUM 属于第二代\"名称反查\"反射"
  },
  {
    "id": "GETPALAMLV",
    "title": "GETPALAMLV, GETEXPLV",
    "names": [
      "GETPALAMLV",
      "GETEXPLV"
    ],
    "signatures": [
      {
        "name": "GETPALAMLV",
        "params": "`int`, `int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "GETEXPLV",
        "params": "`int`, `int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "将给定值与 PALAMLV 和 EXPLV 进行比较，并将该参数在 PALAMLV 和 EXPLV 中达到或超过的等级赋值给 RESULT:0。",
    "body": "!!! info \"API\"\n\n    ```erb\n    GETPALAMLV int, maxLV\n    GETEXPLV int, maxLV\n    ```\n    将给定值与 `PALAMLV` 和 `EXPLV` 进行比较，并将该参数在 `PALAMLV` 和 `EXPLV` 中达到或超过的等级赋值给 `RESULT:0`。\n    第二个参数表示要调查的最大等级。请在使用前设置好 `PALAMLV` 和 `EXPLV` 的值。\n\n!!! hint \"提示\"\n\n    该函数既可作为指令使用，也可在表达式中作为函数使用。\n\n### 相关项目\n- [动态解析与反射](../tutorial/dynamic-reflection.zh.md) — GETPALAMLV/GETEXPLV 属于第一代\"数值→等级查询\""
  },
  {
    "id": "GETPLATFORM",
    "title": "GETPLATFORM",
    "names": [
      "GETPLATFORM"
    ],
    "signatures": [
      {
        "name": "GETPLATFORM",
        "params": "无",
        "returns": "`int`",
        "engines": [
          "skia"
        ],
        "overloads": []
      }
    ],
    "summary": "返回当前运行平台的整数编码。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint GETPLATFORM\n    ```\n\t返回当前运行平台的整数编码。\n\n\t| 返回值 | 平台    |\n\t| :----- | :------ |\n\t| 0      | Windows |\n\t| 1      | Android |\n\t| 2      | iOS     |\n\t| 3      | macOS   |\n\t| 4      | Linux   |\n\t| 5      | Unknown |\n\n\t可作为表达式中函数使用。`CanRestructure = true`，编译时可进行常量折叠。\n\n!!! hint \"提示\"\n\n\tERB脚本可以根据平台进行条件分支。\n\t例如，仅在移动环境下跳过特定处理时使用。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tIF GETPLATFORM() == 0\n\t\t\tPRINTL Windows环境\n\t\tELSEIF GETPLATFORM() == 1\n\t\t\tPRINTL Android环境\n\t\tELSE\n\t\t\tPRINTL 其他环境\n\t\tENDIF\n    ```\n\n### 相关项\n- GETCONFIG\n- GETSTYLE"
  },
  {
    "id": "GETSECOND",
    "title": "GETSECOND",
    "names": [
      "GETSECOND",
      "GETTIME"
    ],
    "signatures": [
      {
        "name": "GETSECOND",
        "params": "无",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "获取自公元0001年1月1日起经过的时间（以秒为单位），并赋值给RESULT:0。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint GETTIME\n    ```\n\t获取自公元0001年1月1日起经过的时间（以秒为单位），并赋值给RESULT:0。\n\t由于可以直接进行加减运算，因此比GETTIME更适合用于计算经过的时间等场景。\n\n!!! hint \"提示\"\n\n    该函数同时支持作为指令和表达式函数使用。\n\n### 相关项目\n- GETMILLISECOND\n- GETTIME"
  },
  {
    "id": "GETSETVAR",
    "title": "SETVAR / GETVAR 系列",
    "names": [
      "GETVAR",
      "GETVARF",
      "GETVARS",
      "SETVAR",
      "GETSETVAR"
    ],
    "signatures": [
      {
        "name": "GETVAR",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      },
      {
        "name": "GETVARF",
        "params": "`string`",
        "returns": "`float`",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "GETVARS",
        "params": "`string`",
        "returns": "`string`",
        "engines": [
          "em"
        ],
        "overloads": []
      },
      {
        "name": "SETVAR",
        "params": "`string`, `any`",
        "returns": "`1`",
        "engines": [
          "em"
        ],
        "overloads": []
      }
    ],
    "summary": "名为 varName 的变量 / 常量的 GET / SET 函数（常量无法使用 SET 修改值）。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int GETVAR varName\n    float GETVARF varName\n    string GETVARS varName\n    1 SETVAR varName, value\n    ```\n\n    名为 `varName` 的变量 / 常量的 `GET` / `SET` 函数（常量无法使用 `SET` 修改值）。\n\n    - `GETVAR` 返回 `varName` 表示的整型变量 / 常量的值。\n    - `GETVARF` 返回 `varName` 表示的浮点型变量 / 常量的值。\n    - `GETVARS` 返回 `varName` 表示的字符串变量 / 常量的值。\n    - `SETVAR` 将 `varName` 赋值为 `value`。`value` 的类型必须与该变量原本的类型相同。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    #DIMS CONST 字符串常量 = \"Banana\"\n    #DIM 整型变量 = 10\n    ```\n    ```erb\n    @SYSTEM_TITLE\n        #DIMS 临时字符串变量 = \"local\"\n\n        ; PRINTFORML {GETVAR(\"Foo\")}\n        ; 报错：\"Foo\"は解釈できない識別子です\n        PRINTFORMS @\"{GETVAR(\"整型变量\")} %GETVARS(\"临时字符串变量\")% \"\n        PRINTSL GETVARS(\"字符串常量\")\n\n        ; SETVAR \"字符串常量\", \"Apple\"\n        ; 报错：\"字符串常量\"が変数ではありません\n        ; SETVAR \"整型变量\", \"Apple\"\n        ; 报错：\"整型变量\"が文字列型ではありません\n        SETVAR \"临时字符串变量\", \"temp\"\n        PRINTSL 临时字符串变量\n\n        ONEINPUT\n    ```\n    ```text\n    10 local Banana\n    temp\n    ```\n\n### 相关项目\n- STRFORM\n- GETMETH,GETMETHS\n- [动态解析与反射](../tutorial/dynamic-reflection.zh.md) — GETVAR/GETVARS/SETVAR 属于第三代\"变量反射\""
  },
  {
    "id": "GETTIME",
    "title": "GETTIME",
    "names": [
      "GETTIME",
      "GETTIMES"
    ],
    "signatures": [
      {
        "name": "GETTIME",
        "params": "无",
        "returns": "`int`, `string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "GETTIME",
        "params": "无",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "GETTIMES",
        "params": "无",
        "returns": "`string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "将计算机的当前日期/时间信息赋值给 RESULT:0 和 RESULTS:0。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tGETTIME\n\tint GETTIME\n\tstring GETTIMES\n    ```\n\t将计算机的当前日期/时间信息赋值给 `RESULT:0` 和 `RESULTS:0`。\n\t如果当前日期时间是 2009年3月28日13时5分23秒678毫秒，则 `RESULT:0` 将被赋值为 `20090328130523678`。\n\t`RESULTS:0` 将被赋值为 `2009/03/28 13:05:23`。\n\t`RESULTS:0` 主要预想用于存档数据的注释。\n\t若希望对年月日使用自定义的表示方式，请分解 `RESULT:0` 来使用。\n\t另外，`RESULT:0` 的精度取决于运行环境，大约在十几到几十毫秒左右。\n\t（如果只经过了几毫秒，可能会返回相同的值）\n\t若以性能测量为目的，请注意这一点。\n\n    作为表达式内函数使用的`GETTIME()`和`GETTIMES()`，分别返回执行`GETTIME`命令时赋值给`RESULT:0`和`RESULTS:0`的值。\n\n!!! hint \"提示\"\n\n    同时支持命令形式和表达式内函数形式。\n\n### 相关项目\n- GETSECOND\n- GETMILLISECOND"
  },
  {
    "id": "GFILLRECTANGLE",
    "title": "GFILLRECTANGLE",
    "names": [
      "GFILLRECTANGLE"
    ],
    "signatures": [
      {
        "name": "GFILLRECTANGLE",
        "params": "`int`, `int`, `int`, `int`, `int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "在指定的gID对应的Graphics上，绘制由x, y, width, height定义的矩形。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint GFILLRECTANGLE gID, x, y, width, height\n    ```\n    在指定的`gID`对应的`Graphics`上，绘制由`x`, `y`, `width`, `height`定义的矩形。\n    如果处理成功，则返回非0值。\n    绘制颜色必须预先通过`GSETBRUSH`命令指定，否则将使用Emuera配置中的文字颜色进行绘制。\n\n!!! hint \"提示\"\n\n    此功能同时支持作为命令和表达式内函数使用。\n\n### 相关项目\n- GSETBRUSH"
  },
  {
    "id": "GGETBRUSH",
    "title": "GGETBRUSH",
    "names": [
      "GGETBRUSH"
    ],
    "signatures": [
      {
        "name": "GGETBRUSH",
        "params": "`int`",
        "returns": "`int`",
        "engines": [
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "返回  gID 代表的图像中 GSETBRUSH 所指定的颜色（cARGB）。",
    "body": "!!! info \"API\"\n\n\t```erb\n\tint GGETBRUSH gID\n\t```\n\n\t返回  `gID` 代表的图像中 `GSETBRUSH` 所指定的颜色（cARGB）。\n\n!!! warning \"Skia版注意\"\n\n\t`GCREATE` 后未调用 `GSETBRUSH` 就调用 `GGETBRUSH` 时，EM+EE 会抛出 NullReferenceException，而 Skia 版返回 `0`。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n\t```erb\n\t@SYSTEM_TITLE\n\t\tGCREATE 0, 100, 100\n\t\tGSETBRUSH 0, 0xFF112233\n\n\t\tPRINTFORMW Color:{GGETBRUSH(0)}(%CONVERT(GGETBRUSH(0), 16)%)\n\t```\n\n\t```text\n\tColor:4279312947(ff112233)\n\t```\n\n### 相关项目\n- GSETBRUSH"
  },
  {
    "id": "GGETCOLOR",
    "title": "GGETCOLOR",
    "names": [
      "GGETCOLOR"
    ],
    "signatures": [
      {
        "name": "GGETCOLOR",
        "params": "`int`, `int`, `int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "获取指定gID的Graphics在指定位置的颜色，以0xAARRGGBB格式的整数值返回。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint GGETCOLOR gID, x, y\n    ```\n    获取指定`gID`的`Graphics`在指定位置的颜色，以`0xAARRGGBB`格式的整数值返回。\n    如果`Graphics`未创建或已销毁，或者`x,y`位于图像范围之外，则返回-1。\n\n    请注意，此命令是唯一一个在失败时返回-1而非0的命令。\n    当获取到黑色且完全透明位置的颜色时，此命令将返回0。\n\n!!! hint \"提示\"\n\n    同时支持作为命令和表达式函数使用。\n\n### 相关项目\n- GSETCOLOR"
  },
  {
    "id": "GGETFONT",
    "title": "GGETFONT",
    "names": [
      "GGETFONT"
    ],
    "signatures": [
      {
        "name": "GGETFONT",
        "params": "`int`",
        "returns": "`string`",
        "engines": [
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "返回指定的 gID 使用 GSETFONT 设置的字体名称。",
    "body": "!!! info \"API\"\n\n    ```erb\n    string GGETFONT gID\n    ```\n\n    返回指定的 `gID` 使用 `GSETFONT` 设置的字体名称。\n\n!!! warning \"Skia版注意\"\n\n    `GCREATE` 后未调用 `GSETFONT` 就调用 `GGETFONT` 时，EM+EE 会抛出 NullReferenceException，而 Skia 版返回空字符串 `\"\"`。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n    \tGCREATE 0, 100, 100\n    \tGSETFONT 0, \"Arial\", 100\n\n    \tGCREATE 1, 100, 100\n    \tGSETFONT 1, \"ＭＳ ゴシック\", 100\n\n    \tPRINTSL GGETFONT(0)\n    \tPRINTSL GGETFONT(1)\n    \tWAIT\n    ```\n\n    ```text\n    Arial\n    ＭＳ ゴシック\n    ```\n\n### 相关项目\n- GSETFONT\n- GGETFONTSIZE\n- GGETFONTSTYLE"
  },
  {
    "id": "GGETFONTSIZE",
    "title": "GGETFONTSIZE",
    "names": [
      "GGETFONTSIZE"
    ],
    "signatures": [
      {
        "name": "GGETFONTSIZE",
        "params": "`int`",
        "returns": "`int`",
        "engines": [
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "返回指定的 gID 使用 GSETFONT 设置的字体大小。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int GGETFONTSIZE gID\n    ```\n\n    返回指定的 `gID` 使用 `GSETFONT` 设置的字体大小。\n\n!!! warning \"Skia版注意\"\n\n    `GCREATE` 后未调用 `GSETFONT` 就调用 `GGETFONTSIZE` 时，EM+EE 会抛出 NullReferenceException，而 Skia 版返回 `0`。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n    \tGCREATE 0, 100, 100\n    \tGSETFONT 0, \"Arial\", 100\n\n    \tGCREATE 1, 100, 100\n    \tGSETFONT 1, \"ＭＳ ゴシック\", 200\n\n    \tPRINTVL GGETFONTSIZE(0)\n    \tPRINTVL GGETFONTSIZE(1)\n    \tWAIT\n    ```\n\n    ```text\n    100\n    200\n    ```\n\n### 相关项目\n- GSETFONT\n- GGETFONT\n- GGETFONTSTYLE"
  },
  {
    "id": "GGETFONTSTYLE",
    "title": "GGETFONTSTYLE",
    "names": [
      "GGETFONTSTYLE"
    ],
    "signatures": [
      {
        "name": "GGETFONTSTYLE",
        "params": "`int`",
        "returns": "`int`",
        "engines": [
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "返回指定的 gID 使用 GSETFONT 设置的字体样式标记。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int GGETFONTSTYLE gID\n    ```\n\n    返回指定的 `gID` 使用 `GSETFONT` 设置的字体样式标记。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        GCREATE 0, 100, 100\n        GSETFONT 0, \"Arial\", 100, 1|8  ; 0b0001|0b1000 => 0b1001 => 9\n\n        GCREATE 1, 100, 100\n        GSETFONT 1, \"ＭＳ ゴシック\", 100, 2|4  ; 0b0010|0b0100 => 0b0110 => 6\n\n        PRINTVL GGETFONTSTYLE(0)\n        PRINTVL GGETFONTSTYLE(1)\n        WAIT\n    ```\n\n    ```text\n    9\n    6\n    ```\n\n### 相关项目\n- GSETFONT\n- GGETFONT\n- GGETFONTSIZE"
  },
  {
    "id": "GGETPEN",
    "title": "GGETPEN",
    "names": [
      "GGETPEN"
    ],
    "signatures": [
      {
        "name": "GGETPEN",
        "params": "`int`",
        "returns": "`int`",
        "engines": [
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "返回  gID 代表的图像中 GSETPEN 所指定的颜色（cARGB）。",
    "body": "!!! info \"API\"\n\n\t```erb\n\tint GGETPEN gID\n\t```\n\n\t返回  `gID` 代表的图像中 `GSETPEN` 所指定的颜色（cARGB）。\n\n!!! warning \"Skia版注意\"\n\n\t`GCREATE` 后未调用 `GSETPEN` 就调用 `GGETPEN` 时，EM+EE 会抛出 NullReferenceException，而 Skia 版返回 `0`。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n\t```erb\n\t@SYSTEM_TITLE\n\t\tGCREATE 0, 100, 100\n\t\tGSETPEN 0, 0xFF00FF00, 5\n\n\t\tPRINTFORMW Color:{GGETPEN(0)}(%CONVERT(GGETPEN(0), 16)%) Width:{GGETPENWIDTH(0)}\n\t```\n\n\t```text\n\tColor:4278255360(ff00ff00) Width:5\n\t```\n\n### 相关项目\n- GSETPEN\n- GGETPENWIDTH"
  },
  {
    "id": "GGETPENWIDTH",
    "title": "GGETPENWIDTH",
    "names": [
      "GGETPENWIDTH"
    ],
    "signatures": [
      {
        "name": "GGETPENWIDTH",
        "params": "`int`",
        "returns": "`int`",
        "engines": [
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "返回  gID 代表的图像中 GSETPEN 所指定的画笔宽度。",
    "body": "!!! info \"API\"\n\n\t```erb\n\tint GGETPENWIDTH gID\n\t```\n\n\t返回  `gID` 代表的图像中 `GSETPEN` 所指定的画笔宽度。\n\n!!! warning \"Skia版注意\"\n\n\t`GCREATE` 后未调用 `GSETPEN` 就调用 `GGETPENWIDTH` 时，EM+EE 会抛出 NullReferenceException，而 Skia 版返回 `0`。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n\t```erb\n\t@SYSTEM_TITLE\n\t\tGCREATE 0, 100, 100\n\t\tGSETPEN 0, 0xFF00FF00, 5\n\n\t\tPRINTFORMW Color:{GGETPEN(0)}(%CONVERT(GGETPEN(0), 16)%) Width:{GGETPENWIDTH(0)}\n\t```\n\n\t```text\n\tColor:4278255360(ff00ff00) Width:5\n\t```\n\n### 相关项目\n- GSETPEN\n- GGETPENWIDTH"
  },
  {
    "id": "GGETTEXTSIZE",
    "title": "GGETTEXTSIZE",
    "names": [
      "GGETTEXTSIZE"
    ],
    "signatures": [
      {
        "name": "GGETTEXTSIZE",
        "params": "`string`, `string`, `int`(, `int`)",
        "returns": "`int`, `int`",
        "engines": [
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "预测 GDRAWTEXT 使用指定的参数绘制时生成的 Width / Height（分别代入 RESULT:0 / RESULT:1）。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int GGETTEXTSIZE text, fontName, fontSize(, fontStyle)\n    ```\n\n    预测 `GDRAWTEXT` 使用指定的参数绘制时生成的 `Width` / `Height`（分别代入 `RESULT:0` / `RESULT:1`）。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。若使用行内函数形式需要另行处理 `RESULT:1`，因此推荐使用命令形式。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n\n        GGETTEXTSIZE \"USA\", \"Arial\", 150\n        PRINTFORML Width:{RESULT:0} Height:{RESULT:1}\n        GGETTEXTSIZE \"日本\", \"Arial\", 150\n        PRINTFORML Width:{RESULT:0} Height:{RESULT:1}\n        GGETTEXTSIZE \"USA\", \"ＭＳ Ｐゴシック\", 150\n        PRINTFORML Width:{RESULT:0} Height:{RESULT:1}\n        GGETTEXTSIZE \"日本\", \"ＭＳ Ｐゴシック\", 150\n        PRINTFORML Width:{RESULT:0} Height:{RESULT:1}\n        WAIT\n    ```\n\n    ```text\n    Width:308 Height:167\n    Width:330 Height:172\n    Width:281 Height:150\n    Width:300 Height:150\n    ```\n### 関連項目\n- GDRAWTEXT"
  },
  {
    "id": "GOTO",
    "title": "GOTO",
    "names": [
      "GOTO"
    ],
    "signatures": [
      {
        "name": "GOTO",
        "params": "`labelName`",
        "returns": "无",
        "engines": [
          "eramaker"
        ],
        "overloads": []
      }
    ],
    "summary": "跳转到函数内由$定义的标签处",
    "body": "!!! info \"API\"\n\n    ```erb\n\tGOTO labelName\n\t$labelName\n    ```\n    跳转到函数内由`$`定义的标签处\n\n!!! hint \"提示\"\n\n    仅支持在指令中使用。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tPRINTL 1\n\t\tGOTO THREE\n\n\t\t$TWO\n\t\tPRINTL 2\n\t\tGOTO FIVE\n\n\t\t$THREE\n\t\tPRINTL 3\n\t\tGOTO TWO\n\n\t\t$FOUR\n\t\tPRINTL 4\n\t\tGOTO END\n\n\t\t$FIVE\n\t\tPRINTL 5\n\t\tGOTO FOUR\n\n\t\t$END\n\t\tPRINTW END\n    ```\n    ```text\n\t1\n\t3\n\t2\n\t5\n\t4\n\tEND\n    ```\n\n### 相关项目\n- GOTOFORM"
  },
  {
    "id": "GROUPCHECK",
    "title": "GROUPMATCH, NOSAMES, ALLSAMES",
    "names": [
      "GROUPMATCH",
      "NOSAMES",
      "ALLSAMES",
      "GROUPCHECK"
    ],
    "signatures": [
      {
        "name": "GROUPMATCH",
        "params": "`any`, `any`...",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "NOSAMES",
        "params": "`any`, `any`...",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "ALLSAMES",
        "params": "`any`, `any`...",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "所有参数必须是同一类型。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint GROUPMATCH key, value...\n\tint NOSAMES value, value...\n\tint ALLSAMES value, value...\n    ```\n    所有参数必须是同一类型。\n    `GROUPMATCH` 返回第一个参数指定的值与第二个及后续参数中指定的值相匹配的总数。\n    `NOSAMES` 当所有参数指定的值都不同时返回 1，否则返回 0。\n    `ALLSAMES` 当所有参数指定的值都相同时返回 1，否则返回 0。\n\n!!! hint \"提示\"\n\n    该函数既可作为指令使用，也可在表达式中使用。\n\n### 相关项目\n- MATCH"
  },
  {
    "id": "GSAVELOAD",
    "title": "GSAVE, GLOAD",
    "names": [
      "GSAVE",
      "GLOAD",
      "GSAVELOAD"
    ],
    "signatures": [
      {
        "name": "GSAVE",
        "params": "`int`, `int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "GLOAD",
        "params": "`int`, `int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "GSAVE 将指定 gID 的 Graphics 图像以 png 格式输出并保存，文件名带有 fileNo 编号。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint GSAVE gID, fileNo\n\tint GLOAD gID, fileNo\n    ```\n\t`GSAVE` 将指定 `gID` 的 `Graphics` 图像以 `png` 格式输出并保存，文件名带有 `fileNo` 编号。\n\t处理成功时，返回非 0 值。\n\n\t`GLOAD` 打开带有 `fileNo` 编号的文件名的图像，并创建 `Graphics`。\n\t其行为与 `GCREATEFORMFILE` 指令几乎相同，但区别在于它不是从 `resouces` 文件夹内的图像创建，而是从 `GSAVE` 指令保存的图像创建。\n\t处理成功时，返回非 0 值。\n\t如果指定 `gID` 的 `Graphics` 已经存在，则 `Graphics` 创建失败，此指令不执行任何操作并返回 0 后结束。\n\n!!! hint \"提示\"\n\n    同时支持指令和表达式函数两种形式。\n\n### 相关项目\n- GCREATE\n- GCREATEFROMFILE"
  },
  {
    "id": "GSETBRUSH",
    "title": "GSETBRUSH",
    "names": [
      "GSETBRUSH"
    ],
    "signatures": [
      {
        "name": "GSETBRUSH",
        "params": "`int`, `int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "为指定ID的Graphics对象设置指定颜色的画刷。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint GSETBRUSH gID, cARGB\n    ```\n    为指定ID的Graphics对象设置指定颜色的画刷。\n    指定的画刷在Graphics对象被GDISPOSE命令销毁前会一直保持。\n    处理成功时返回非0值。\n    设置好的画刷颜色可以通过`GGETBRUSH`获取。\n    此处设置的画刷颜色将在以下命令/表达式中函数中使用：\n\n    - `GFILLRECTANGLE`\n\n!!! hint \"提示\"\n\n    同时支持命令形式和表达式函数形式。\n\n### 相关项目\n- GGETBRUSH\n- GFILLRECTANGLE"
  },
  {
    "id": "GSETCOLOR",
    "title": "GSETCOLOR",
    "names": [
      "GSETCOLOR"
    ],
    "signatures": [
      {
        "name": "GSETCOLOR",
        "params": "`int`, `int`, `int`, `int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "将指定ID的Graphics对象在指定位置的像素替换为指定颜色。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint GSETCOLOR gID, cARGB, x, y\n    ```\n    将指定ID的Graphics对象在指定位置的像素替换为指定颜色。\n    处理成功时，返回非0值。\n    此命令速度并不快。\n    尝试结合`GGETCOLOR`命令重写大尺寸图像的整个区域，将无法在实用时间内完成。\n\n!!! hint \"提示\"\n\n    同时支持指令和表达式函数形式。\n\n### 相关项目\n- GGETCOLOR"
  },
  {
    "id": "GSETFONT",
    "title": "GSETFONT",
    "names": [
      "GSETFONT"
    ],
    "signatures": [
      {
        "name": "GSETFONT",
        "params": "`int`, `string`, `string`(, `int`)",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "为指定gID的Graphics对象设置指定名称和尺寸的字体。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint GSETFONT gID, fontName, fontSize(, fontStyle)\n    ```\n\t为指定`gID`的`Graphics`对象设置指定名称和尺寸的字体。\n\t指定的字体将被记忆，直到使用`GDISPOSE`命令销毁该`Graphics`对象为止。\n\t处理成功时返回非0值。\n\t要获取已设置的字体名称和字体尺寸，请使用`GGETFONT`和`GGETFONTSIZE`。\n\tEM+EE版本中增加了可选的第四个参数。可以指定字体样式。使用与`SETFONT`相同的4位数值来指定。\n\tEM+EE版本中，现在也可以指定[`font`文件夹内的`ttf`、`otf`文件](../EMEE/EMEE_Summary.zh.md)。\n\t通过`GSETFONT`设置的字体将在以下命令/表达式中函数中使用。\n\n    - `GDRAWTEXT`\n\n!!! hint \"提示\"\n\n    该命令同时支持在命令和表达式函数中使用。\n\n### 相关项目\n- GDRAWTEXT\n- GGETFONT\n- GGETFONTSIZE\n- GGETFONTSTYLE"
  },
  {
    "id": "GSETPEN",
    "title": "GSETPEN",
    "names": [
      "GSETPEN"
    ],
    "signatures": [
      {
        "name": "GSETPEN",
        "params": "`int`, `int`, `int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "为指定gID的Graphics对象设置指定颜色和宽度的画笔。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint GSETPEN gID, cARGB, penWidth\n    ```\n\t为指定`gID`的`Graphics`对象设置指定颜色和宽度的画笔。\n\t指定的画笔将被记忆，直到通过`GDISPOSE`命令销毁该`Graphics`对象为止。\n\t处理成功时返回非0值。\n\t要获取已设置的画笔颜色和画笔宽度，请分别使用`GGETPEN`和`GGETPENWIDTH`。\n\t通过`GSETPEN`设置的画笔颜色和宽度将用于以下命令/表达式函数：\n\n\t- `GDRAWTEXT`\n\t- `GDRAWLINE`\n\n!!! hint \"提示\"\n\n    同时支持命令形式和表达式函数形式。\n\n### 相关项目\n- GDRAWTEXT\n- GDRAWLINE\n- GGETPEN\n- GGETPENWIDTH"
  },
  {
    "id": "GWIDTHHEIGHT",
    "title": "GWIDTH, GHEIGHT",
    "names": [
      "GWIDTH",
      "GHEIGHT",
      "GWIDTHHEIGHT"
    ],
    "signatures": [
      {
        "name": "GWIDTH",
        "params": "`int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "GHEIGHT",
        "params": "`int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "获取指定gID的Graphics的宽度或高度。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint GWIDTH gID\n\tint GHEIGHT gID\n    ```\n\t获取指定`gID`的`Graphics`的宽度或高度。\n\t如果`Graphics`尚未创建（包括已销毁的），则返回0。\n\n!!! hint \"提示\"\n\n    该函数同时支持指令和表达式函数两种使用方式。"
  },
  {
    "id": "HOTKEY_STATE",
    "title": "HOTKEY_STATE / HOTKEY_STATE_INIT",
    "names": [
      "HOTKEY_STATE",
      "HOTKEY_STATE_INIT"
    ],
    "signatures": [
      {
        "name": "HOTKEY_STATE",
        "params": "`int`(, `int`)",
        "returns": "`int`",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "HOTKEY_STATE_INIT",
        "params": "`int`",
        "returns": "`int`",
        "engines": [
          "skia"
        ],
        "overloads": []
      }
    ],
    "summary": "管理快捷键状态的函数。",
    "body": "!!! info \"API\"\n\n\t```erb\n\tint HOTKEY_STATE keyCode(, state)\n\tint HOTKEY_STATE_INIT mode\n\t```\n\n\t管理快捷键状态的函数。\n\n\t- `HOTKEY_STATE`：设置指定键码的快捷键状态。省略 `state` 时默认为 `1`（启用）。始终返回 `0`。\n\t- `HOTKEY_STATE_INIT`：初始化快捷键状态。`mode` 指定为 `0` 时禁用所有快捷键，指定为 `1` 时读取 ERB 脚本中定义的快捷键设置。始终返回 `0`。\n\n\t!!! warning \"注意\"\n\n\t\t此函数为其他贡献者追加的扩展功能，标准版 Emuera 中不可用。"
  },
  {
    "id": "HTML_ESCAPE",
    "title": "HTML_ESCAPE",
    "names": [
      "HTML_ESCAPE",
      "STR"
    ],
    "signatures": [
      {
        "name": "HTML_ESCAPE",
        "params": "`string`",
        "returns": "`string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "将目标字符串转义为HTML格式（转换为字符引用）。",
    "body": "!!! info \"API\"\n\n    ```erb\n    str HTML_ESCAPE, htmlString\n    ```\n    将目标字符串转义为HTML格式（转换为字符引用）。\n    要取消转义，请使用`HTML_TOPLAINTEXT`函数。\n\n!!! hint \"提示\"\n\n    同时支持指令和表达式函数两种形式。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tPRINTFORMW %HTML_ESCAPE(\"A&B<C>D'E\")%\n    ```\n    ```text\n\tA&amp;B&lt;C&gt;D&apos;E\n    ```\n\n### 相关项目\n- HTML_TOPLAINTEXT\n- ESCAPE"
  },
  {
    "id": "HTML_GETPRINTEDSTR",
    "title": "HTML_GETPRINTEDSTR",
    "names": [
      "HTML_GETPRINTEDSTR",
      "STR"
    ],
    "signatures": [
      {
        "name": "HTML_GETPRINTEDSTR",
        "params": "`int`",
        "returns": "`string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "获取已显示行中由lineNo指定行的内容，以HTML格式字符串形式返回。",
    "body": "!!! info \"API\"\n\n    ```erb\n    str HTML_GETPRINTEDSTR, lineNo\n    ```\n    获取已显示行中由`lineNo`指定行的内容，以HTML格式字符串形式返回。\n    行号计数方式与`LINECOUNT`或`CLEARLINE`指令相同。\n\n!!! hint \"提示\"\n\n    该函数同时支持指令形式和表达式函数形式。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\t#DIMS HOGES, 4\n\t\tFONTBOLD\n\t\tPRINTL AAA\n\t\tFONTITALIC\n\t\tPRINTL BBB\n\t\tFONTSTYLE 4\n\t\tPRINTL CCC\n\t\tFONTSTYLE 0\n\t\tFONTREGULAR\n\n\t\tREPEAT 4\n\t\t\tHOGES:COUNT = %HTML_GETPRINTEDSTR(COUNT)%\n\t\tREND\n\t\tREPEAT 4\n\t\t\tPRINTFORML %HOGES:COUNT%\n\t\tREND\n\n\t\tWAIT\n    ```\n\t![](../assets/images/HTML_GETPRINTEDSTR.png)\n\n### 相关项目\n- GETDISPLAYLINE"
  },
  {
    "id": "HTML_POPPRINTINGSTR",
    "title": "HTML_POPPRINTINGSTR",
    "names": [
      "HTML_POPPRINTINGSTR"
    ],
    "signatures": [
      {
        "name": "HTML_POPPRINTINGSTR",
        "params": "`void`",
        "returns": "`string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "获取当前 PRINT 中处于换行等待状态的字符串缓冲区的 HTML 格式内容，并清空缓冲区。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tstring HTML_POPPRINTINGSTR\n    ```\n    获取当前 `PRINT` 中处于换行等待状态的字符串缓冲区的 HTML 格式内容，并清空缓冲区。\n    由于不包含 `p` 标签，因此 `ALIGNMENT` 指令设置的 `align` 属性不会生效。\n\n!!! hint \"提示\"\n\n    该函数同时支持在指令和表达式中使用。\n\n!!! example \"示例\"\n\n    ```erb\n\t@SYSTEM_TITLE\n\t#DIMS HOGES\n\t\tFONTBOLD\n\t\tPRINT AAA\n\t\tFONTITALIC\n\t\tPRINT BBB\n\t\tFONTSTYLE 4\n\t\tPRINT CCC\n\t\tFONTSTYLE 0\n\t\tFONTREGULAR\n\n\t\tHOGES = %HTML_POPPRINTINGSTR()%\n\t\tPRINTL DDD\n\n\t\tPRINTFORMW %HOGES%\n    ```\n    ```text\n\tDDD\n\t<b>AAA</b><i><b>BBB</b></i><s>CCC</s>\n    ```"
  },
  {
    "id": "HTML_PRINT",
    "title": "HTML_PRINT",
    "names": [
      "HTML_PRINT"
    ],
    "signatures": [
      {
        "name": "HTML_PRINT",
        "params": "`string`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "这是一个使用类似HTML标签进行PRINT的命令。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tHTML_PRINT htmlStyleString\n    ```\n\t这是一个使用类似HTML标签进行`PRINT`的命令。\n\t其参数不是像`PRINT`那样的字符串，而是与`PRINTS`相同的字符串表达式，并且会自动换行，因此其行为实际上更接近`PRINTSL`。（在EM+EE版本中，添加了不换行的选项）\n\t`HTML_PRINT`的绘制不受`ALIGNMENT`、`SETFONT`、`SETCOLOR`、`FONTSTYLE`命令及其类似命令的影响。\n\t要获得这些效果，必须全部通过标签来指定。\n\t详情请参阅[`HTML_PRINT`相关](../Emuera/HTML_PRINT.zh.md)。\n\n!!! hint \"提示\"\n\n    仅支持作为命令使用。\n\n### 相关项目\n- [HTML_PRINT相关](../Emuera/HTML_PRINT.zh.md)"
  },
  {
    "id": "HTML_PRINT_ISLAND",
    "title": "HTML_PRINT_ISLAND,HTML_PRINT_ISLAND_CLEAR",
    "names": [
      "HTML_PRINT_ISLAND",
      "HTML_PRINT_ISLAND_CLEAR"
    ],
    "signatures": [
      {
        "name": "HTML_PRINT_ISLAND",
        "params": "`string`",
        "returns": "无",
        "engines": [
          "net"
        ],
        "overloads": []
      },
      {
        "name": "HTML_PRINT_ISLAND_CLEAR",
        "params": "`string`",
        "returns": "无",
        "engines": [
          "net"
        ],
        "overloads": []
      }
    ],
    "summary": "其标签语法与 HTML_PRINT 相同，但不依赖于行信息。",
    "body": "!!! info \"API\"\n\n    ```erb\n    HTML_PRINT_ISLAND htmlStyleString\n    ```\n    其标签语法与 `HTML_PRINT` 相同，但不依赖于行信息。\n    由于不依赖于行信息，与普通的 `PRINT` 指令不同，无论滚动多少都不会消失。\n    详情请参阅 [`HTML_PRINT` 相关](../Emuera/HTML_PRINT.zh.md) 文档。\n\n!!! hint \"提示\"\n\n    仅支持指令形式。"
  },
  {
    "id": "HTML_PRINTC",
    "title": "HTML_PRINTC / HTML_PRINTLC",
    "names": [
      "HTML_PRINTC",
      "HTML_PRINTLC"
    ],
    "signatures": [
      {
        "name": "HTML_PRINTC",
        "params": "`string {, int}`",
        "returns": "无",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "HTML_PRINTLC",
        "params": "`string {, int}`",
        "returns": "无",
        "engines": [
          "skia"
        ],
        "overloads": []
      }
    ],
    "summary": "HTML_PRINT 的右对齐和左对齐变体。使用 HTML 标签进行渲染，但对齐位置不同。",
    "body": "!!! info \"API\"\n\n    ```erb\n    HTML_PRINTC htmlString {, cellWidth}\n    HTML_PRINTLC htmlString {, cellWidth}\n    ```\n\n    `HTML_PRINT` 的右对齐和左对齐变体。使用 HTML 标签进行渲染，但对齐位置不同。\n\n    - **HTML_PRINTC**：将 HTML 渲染结果**右对齐**显示。\n    - **HTML_PRINTLC**：将 HTML 渲染结果**左对齐**显示。\n\n    第二参数 `cellWidth` 为可选的整数表达式，指定单元格宽度（像素）。省略时使用 `PrintCLength * FontSize / 2` 的默认值。\n\n    与 `HTML_PRINT` 相同，不受 `ALIGNMENT`、`SETFONT`、`SETCOLOR`、`FONTSTYLE` 命令的影响。对齐方式由命令本身控制。\n\n    详细信息请参阅 [`HTML_PRINT` 相关](../Emuera/HTML_PRINT.zh.md)。\n\n    !!! warning \"注意\"\n        - 仅支持命令语法，不支持表达式调用。\n        - 参数与 `PRINTS` 相同，为字符串表达式。自动换行。\n\n!!! hint \"提示\"\n\n    仅命令语法可用。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n        ; 右对齐的 HTML 渲染\n        HTML_PRINTC \"<b>右对齐文本</b>\"\n\n        ; 左对齐的 HTML 渲染\n        HTML_PRINTLC \"<b>左对齐文本</b>\"\n\n        ; 指定单元格宽度（200像素）\n        HTML_PRINTC \"<b>右对齐文本</b>\", 200\n\n        ; 普通 HTML_PRINT（遵循 ALIGNMENT 设置）\n        HTML_PRINT \"<b>默认对齐</b>\"\n    ```\n\n### 相关项\n- HTML_PRINT\n- [HTML_PRINT相关](../Emuera/HTML_PRINT.zh.md)"
  },
  {
    "id": "HTML_STRINGLEN",
    "title": "HTML_STRINGLEN",
    "names": [
      "HTML_STRINGLEN"
    ],
    "signatures": [
      {
        "name": "HTML_STRINGLEN",
        "params": "`string`(, `int`)",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      }
    ],
    "summary": "HTML_PRINT 返回 html 渲染结果的宽度，有多行的情况下则返回第一行宽度。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int HTML_STRINGLEN html(, returnPixel)\n    ```\n\n    `HTML_PRINT` 返回 `html` 渲染结果的宽度，有多行的情况下则返回第一行宽度。\n    `returnPixel` 值为 `0` 或省略时返回值为半角字符的长度（数量），否则返回宽度占用的像素数量。\n\n    !!! warning \"注意\"\n\n        只要没有用`<nobr></nobr>`标签包围，无论文字多长，返回的数值都不会超过「窗口宽度-滚动条宽度」。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n\n        PRINTFORML {HTML_STRINGLEN(\"<b>B</b>\")}\n        PRINTFORML {HTML_STRINGLEN(\"<b>B</b>\", 1)} {GETCONFIG(\"フォントサイズ\")/2}\n\n        ONEINPUT\n    ```\n    ```text\n    2\n    9 8\n    ```\n    因为粗体比常规字体宽。\n\n### 相关项目\n- STRLEN"
  },
  {
    "id": "HTML_STRINGLINES",
    "title": "HTML_STRINGLINES",
    "names": [
      "HTML_STRINGLINES"
    ],
    "signatures": [
      {
        "name": "HTML_STRINGLINES",
        "params": "`string`, `int`",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      }
    ],
    "summary": "html 在 HTML_PRINT 中打印的结果，按 width（半角字符数）分割后的行数。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int HTML_STRINGLINES html, width\n    ```\n\n    `html` 在 `HTML_PRINT` 中打印的结果，按 `width`（半角字符数）分割后的行数。\n\n!!! hint \"提示\"\n\n    同时支持指令和表达式函数。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\n        PRINTVL HTML_STRINGLINES(\"AB<b>CD</b>\",4)\n\n        ONEINPUT\n    ```\n    ```text\n    2\n    ```\n    因为粗体比普通字体更宽。"
  },
  {
    "id": "HTML_SUBSTRING",
    "title": "HTML_SUBSTRING",
    "names": [
      "HTML_SUBSTRING"
    ],
    "signatures": [
      {
        "name": "HTML_SUBSTRING",
        "params": "`string`, `int`",
        "returns": "`string`",
        "engines": [
          "em"
        ],
        "overloads": []
      }
    ],
    "summary": "使用 HTML_PRINT 命令打印 html 时，返回不超过 width（半角字符数量）的部分。",
    "body": "!!! info \"API\"\n\n    ```erb\n    string HTML_SUBSTRING html, width\n    ```\n\n    使用 `HTML_PRINT` 命令打印 `html` 时，返回不超过 `width`（半角字符数量）的部分。\n\n    截取部分赋值给 `RESULTS:0`（与返回值相同），剩余部分赋值给 `RESULTS:1`。\n    截取时会自动闭合未关闭的标签，剩余部分会自动重开被闭合的标签。\n\n    !!! warning \"注意\"\n\n        `v8b` 开始将返回值从整数型(固定为 `1`)更改为字符串型(与 `RESULTS:0` 相同)。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n\n        PRINTSL HTML_SUBSTRING(\"AB<b>CD</b>EFG\",4)\n        PRINTSL RESULTS:1\n\n        ONEINPUT\n    ```\n    ```text\n    AB<b>C</b>\n    <b>D</b>EFG\n    ```\n    因为粗体比常规字体宽。\n\n    ```erb\n    ; 用 HTML_SUBSTRING 逐行分割（自动处理标签配对）\n    #DIMS L_REMAIN\n    #DIMS L_LINE\n    #DIM L_LINE_CNT\n\n    L_REMAIN '= HTML_CONTENT\n    L_LINE_CNT = 0\n    WHILE STRLENS(L_REMAIN) > 0\n        L_LINE '= HTML_SUBSTRING(L_REMAIN, L_WIDTH)\n        L_LINES:L_LINE_CNT '= L_LINE\n        L_LINE_CNT += 1\n        L_REMAIN '= RESULTS:1\n    WEND\n    ```\n\n### 相关项目\n- SUBSTRING"
  },
  {
    "id": "HTML_TAGSPLIT",
    "title": "HTML_TAGSPLIT",
    "names": [
      "HTML_TAGSPLIT"
    ],
    "signatures": [
      {
        "name": "HTML_TAGSPLIT",
        "params": "`string`(, `integerVariable`, `stringVariable`)",
        "returns": "`int`, `string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "将目标字符串解释为HTML字符串，分割为标签和纯文本，并将分割数量赋值给RESULT，分割后的字符串赋值给RESULTS。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tHTML_TAGSPLIT string(, integerVariable, stringVariable)\n    ```\n\n\t将目标字符串解释为HTML字符串，分割为标签和纯文本，并将分割数量赋值给`RESULT`，分割后的字符串赋值给`RESULTS`。\n\t如果指定了第二、第三个参数，则赋值给指定的变量，而不是`RESULT`和`RESULTS`。\n\t分割处理过程中发生错误时，会将-1赋值给RESULT。\n\t`HTML_TAGSPLIT`不会验证标签内容或对应关系的正确性。\n\t如果分割数量超过`RESULTS`数组的大小，超出部分将不会被赋值到`RESULTS`中。\n\n!!! hint \"提示\"\n\n    仅支持指令形式。\n\n!!! example \"例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tHTML_TAGSPLIT \"<p align='right'>あ<!--comment-->い<font color='red'>う</font></p>\"\n\t\tREPEAT 8\n\t\t\tPRINTFORML RESULTS:{COUNT} = %RESULTS:COUNT%\n\t\tREND\n\t\tPRINTFORML RESULT = {RESULT}\n\t\tWAIT\n    ```\n    ```text\n\tRESULTS:0 = <p align='right'>\n\tRESULTS:1 = あ\n\tRESULTS:2 = <!--comment-->\n\tRESULTS:3 = い\n\tRESULTS:4 = <font color='red'>\n\tRESULTS:5 = う\n\tRESULTS:6 = </font>\n\tRESULTS:7 = </p>\n\tRESULT = 8\n\n    ```\n\n### 相关项目\n- SPLIT"
  },
  {
    "id": "HTML_TOPLAINTEXT",
    "title": "HTML_TOPLAINTEXT",
    "names": [
      "HTML_TOPLAINTEXT",
      "STR"
    ],
    "signatures": [
      {
        "name": "HTML_TOPLAINTEXT",
        "params": "`string`",
        "returns": "`string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "将目标HTML字符串转换为纯文本。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tstr HTML_TOPLAINTEXT, string\n    ```\n\t将目标HTML字符串转换为纯文本。\n\t具体来说，会删除字符串中的HTML标签并展开字符引用。\n\n!!! hint \"提示\"\n\n    该函数同时支持指令和表达式内函数两种使用方式。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tPRINTFORMW %HTML_TOPLAINTEXT(\"<b>AAA</b><i><b>BBB</b></i><s>CCC</s>\")%\n    ```\n    ```text\n\tAAABBBCCC\n    ```"
  },
  {
    "id": "IF",
    "title": "(S)IF",
    "names": [
      "IF",
      "ELSEIF",
      "ELSE",
      "ENDIF",
      "SIF"
    ],
    "signatures": [
      {
        "name": "IF",
        "params": "`operand`",
        "returns": "`void`",
        "engines": [
          "eramaker"
        ],
        "overloads": []
      }
    ],
    "summary": "SIF 在条件表达式成立时，执行下一行。不成立时，则跳过下一行。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tIF operand(int)\n\tELSEIF operand(int)\n\tELSE\n\tENDIF\n\tSIF operand(int)\n    ```\n    `SIF` 在条件表达式成立时，执行下一行。不成立时，则跳过下一行。\n    `IF` 在条件表达式成立时，执行从下一行开始直到遇到 `ELSEIF`、`ELSE`、`ENDIF` 为止的代码，然后跳转到 `ENDIF` 所在行。不成立时，则跳过直到遇到 `ELSEIF`、`ELSE`、`ENDIF` 为止的代码。\n    `ELSEIF` 在其条件表达式成立时，执行从下一行开始直到遇到 `ELSEIF`、`ELSE` 或 `ENDIF` 为止的代码，然后跳转到 `ENDIF` 所在行。如果不成立，则跳过直到遇到下一个 `ELSEIF`、`ELSE` 或 `ENDIF` 为止的代码，并重复此过程。\n    `ELSE` 则执行从下一行开始直到遇到 `ENDIF` 为止的代码。`ELSE` 必须跟在 `ELSEIF` 之后执行，并且 `ELSE` 之后必须是 `ENDIF`。\n    条件表达式严格来说是 `int` 类型，0 视为不成立，非 0 视为成立。\n\n!!! hint \"提示\"\n\n    仅支持命令形式\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t#DIM CONST TRUE = 1\n\t#DIM CONST FALSE = 0\n\t\tIF TRUE\n\t\t\tPRINTL IF=TRUE\n\t\tELSE\n\t\t\tPRINTL Can not reach here\n\t\tENDIF\n\n\t\tIF FALSE\n\t\t\tPRINTL Can not reach here\n\t\tELSEIF TRUE\n\t\t\tPRINTL ELSEIF=TRUE\n\t\tELSE\n\t\t\tPRINTL Can not reach here\n\t\tENDIF\n\n\t\tIF FALSE\n\t\t\tPRINTL Can not reach here\n\t\tELSEIF FALSE\n\t\t\tPRINTL Can not reach here\n\t\tELSE\n\t\t\tPRINTL Reached ELSE\n\t\tENDIF\n\n\t\tWAIT\n    ```\n    ```text\n\tNow Loading...\n\tIF=TRUE\n\tELSEIF=TRUE\n\tReached ELSE\n    ```\n\n### 相关项目\n- SELECTCASE"
  },
  {
    "id": "INPUT",
    "title": "INPUT(S)",
    "names": [
      "INPUT",
      "INPUTS"
    ],
    "signatures": [
      {
        "name": "INPUT",
        "params": "(`int`, `int`, `int`)",
        "returns": "`void`",
        "engines": [
          "eramaker"
        ],
        "overloads": []
      },
      {
        "name": "INPUTS",
        "params": "(`int`, `int`, `int`)",
        "returns": "`void`",
        "engines": [
          "eramaker"
        ],
        "overloads": []
      }
    ],
    "summary": "等待输入，INPUT将输入的数字赋值给RESULT，INPUTS将输入的字符串赋值给RESULTS",
    "body": "!!! info \"API\"\n\n    ```erb\n    INPUT (defaultValue, canClick, allowSkip)\n    INPUTS (defaultValue, canClick, allowSkip)\n    ```\n    等待输入，`INPUT`将输入的数字赋值给`RESULT`，`INPUTS`将输入的字符串赋值给`RESULTS`\n    若设置了第一个参数，则在未输入任何内容时，将默认值赋值给各变量\n    作为EE的附加功能，接受中键点击，与通常的左键点击同等处理。中键点击时，`RESULT:1`中将被置入3\n\n    当设置了第二个参数时，将鼠标点击视作回车键（将空字符串赋值给RESULTS，按下按钮时将按钮索引赋值给RESULTS:1），左键点击时RESULT:1设为1，右键点击时RESULT:1设为2，中键点击时RESULT:1设为3。同时按下Shift、Ctrl、Alt键时，将按键状态保存到RESULT:2中（位16、17、18）。\n\n    当设置了第三个参数时，在右键点击等跳过过程中不进行输入等待，但会应用默认值。如果与上述\"INPUT系列接受鼠标点击\"功能一起使用，则分别将值赋给RESULT:1和RESULTS:1，如果不一起使用，则按常规方式赋值给RESULT:0及...\n\n!!! hint \"提示\"\n\n    仅支持命令形式。\n\n### 相关项目\n- TINPUTNF\n- TINPUT\n- INPUTMOUSEKEY\n- BINPUT\n- INPUTANY\n- REUSELASTLINE"
  },
  {
    "id": "INPUTANY",
    "title": "INPUTANY",
    "names": [
      "INPUTANY"
    ],
    "signatures": [
      {
        "name": "INPUTANY",
        "params": "无",
        "returns": "`int` / `string`",
        "engines": [
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "同时接受整数和字符串输入的 INPUT 命令",
    "body": "!!! info \"API\"\n\n    ```erb\n\tINPUTANY\n    ```\n\n\t同时接受整数和字符串输入的 `INPUT` 命令\n\t执行时也接受用鼠标点击 `PRINTBUTTON` 以及 `[{int}]` 的输入\n\t整数型的输入保存进 `RESULT`，字符串类型的输入保存进 `RESULTS` 中\n\n!!! hint \"提示\"\n\n\t只能作为命令中使用。\n\n!!! example \"示例代码\"\n\n    ```erb\n\t@SYSTEM_TITLE\n\n\tPRINTL [0] 输入0\n\tPRINTL [1] 输入1\n\tPRINTBUTTON \"[A] 输入A\", \"A\"\n\tPRINTL\n\n\tINPUTANY\n\n\tPRINTFORMW 输入结果为\\@ RESULTS != \"\" ? %RESULTS% # {RESULT} \\@\n\n    ```\n    ```text\n\t[0] 输入0\n\t[1] 输入1\n\t[A] 输入A\n\t1\n\t输入结果为1\n    ```\n\n    ```text\n\t[0] 输入0\n\t[1] 输入1\n\t[A] 输入A\n\tA\n\t输入结果为A\n    ```"
  }
];
