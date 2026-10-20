// 本文件由 scripts/build-reference.ts 生成，请勿手工修改。
//
// 数据来源：https://github.com/qirchen421/emuera.sk.doc  docs/Reference/*.zh.md
// 上游版本：606670cd78b58f5d9a050013d1d3f41db5a87a1b
// 许可：CC BY-NC 4.0（http://creativecommons.org/licenses/by-nc/4.0/）
//       与本仓库代码的 Apache-2.0 分开管理，见 NOTICE-emuera-sk-doc.md
import type { ReferenceEntry } from '../types.js';

export const ENTRIES_PART_08: readonly ReferenceEntry[] = [
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tTOOLTIP_CUSTOM bool\n    TOOLTIP_SETFONT fontName\n    TOOLTIP_SETFONTSIZE fontSize\n    TOOLTIP_FORMAT formatFlags\n    ```\n\n\t`HTML_PRINT` 的提示框功能扩展。\n\n\t- `TOOLTIP_CUSTOM`：要使用以下提示框功能扩展时，`TOOLTIP_CUSTOM` 的参数设为非 `0` 以开启功能。指定为 `0` 时扩展功能关闭，以原版提示框的方式显示。\n\t- `TOOLTIP_SETFONT`：设置提示框内文字的字体名称。\n\t- `TOOLTIP_SETFONTSIZE`：设置提示框内文字的字体大小名称。\n\t- `TOOLTIP_FORMAT`：设置提示框内文本的格式。参数参考 C# 的 [`TextFormatFlags`](https://learn.microsoft.com/zh-cn/dotnet/api/system.windows.forms.textformatflags?view=netframework-4.8)。\n\t- 原版中已有的 `TOOLTIP_SETCOLOR` 现在在扩展功能开启时能正常生效。\n\t- 提示框内现在可使用 `<br>` 标签。扩展功能关闭时仍然有效。\n\n!!! hint \"提示\"\n\n    仅支持命令式写法。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tTOOLTIP_CUSTOM 1\n\t\tTOOLTIP_SETCOLOR 0x00AA00, 0x00FF00\n\t\tTOOLTIP_SETFONT \"Ariel\"\n\t\tTOOLTIP_SETFONTSIZE 24\n\t\tTOOLTIP_FORMAT 2;Right Alignment\n\n\t\tHTML_PRINT \"<nonbutton title='tooltip<br>123'>テキスト1</nonbutton>\"\n\t\tPRINTL\n\t\tPRINTL\n\t\tPRINTL\n\t\tWAIT\n\n\t\tTOOLTIP_SETCOLOR 0x333333, 0xAAAAAA\n\t\tTOOLTIP_SETFONT \"ＭＳ 明朝\"\n\t\tTOOLTIP_SETFONTSIZE 12\n\t\tTOOLTIP_FORMAT 1;Center\n\t\tHTML_PRINT \"<nonbutton title='古池や<br>蛙飛びこむ<br>水の音'>テキスト2</nonbutton>\"\n\t\tPRINTL\n\t\tPRINTL\n\t\tPRINTL\n\t\tWAIT\n    ```\n\t![](../assets/images/TOOLTIP_EXTENSION1.png)\n\t![](../assets/images/TOOLTIP_EXTENSION2.png)\n\n### 相关项目\n- 工具提示显示操作\n- TOOLTIP_SETCOLOR"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    TOOLTIP_SETDELAY milliSecond\n    TOOLTIP_SETDURATION milliSecond\n    ```\n    `TOOLTIP_SETDELAY` 用于设置工具提示显示前的延迟时间，单位为毫秒。\n    默认值为 500（毫秒），最大值为 32767。\n\n    `TOOLTIP_SETDURATION` 用于设置工具提示的显示持续时间，单位为毫秒。指定 0 则使用默认显示时间。\n\n!!! hint \"提示\"\n\n    仅支持作为指令使用。\n\n### 相关项目\n- 工具提示扩展功能\n- TOOLTIP_SETCOLOR"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tTOOLTIP_SETCOLOR colorCode, colorCode\n    ```\n\t设置工具提示的前景色和背景色，使用 0xRRGGBB 格式的数值。第一个参数是文字颜色，第二个参数是背景颜色。\n\t如果想使用 R、G、B 值或字符串来指定颜色，请使用 `COLOR_FROMRGB` 或 `COLOR_FROMNAME` 函数。\n\n\t此指令在原版 Emuera 中无效。它是 EM+EE 中新增的功能，需与 `TOOLTIP_CUSTOM` 配合使用才能生效。\n\n!!! hint \"提示\"\n\n    仅支持指令形式。\n\n### 相关项目\n- 工具提示扩展功能\n- 工具提示显示操作"
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
    "body": "!!! info \"API — TOSTR\"\n\n    ```erb\n\tstring TOSTR int, option\n    ```\n\t将数值转换为字符串的命令。\n\t第一个参数指定要转换的数字，第二个参数以字符串形式指定转换格式。\n\t第二个参数可以省略，省略时，其行为与 `PRINTFORM` 的 `{}` 内相同，即简单地转换为字符串。\n\t此函数内部调用 C# 的 [`Int64.ToString() 函数`](https://learn.microsoft.com/ja-jp/dotnet/api/system.int64.tostring)，可以使用与 C# 相同的格式指定。如果第二个参数不合适，将发生错误。\n\t简单的格式指定示例，请参考同名的可在表达式中使用的函数。格式指定的详细信息，请参考讲解 C# 数值格式字符串的网站。\n\n!!! info \"API — TOSTRF\"\n\n    [Skia] Skia 新增\n\n    ```erb\n\tstring TOSTRF float, option\n    ```\n\t将浮点数转换为字符串的命令。\n\t第一个参数指定要转换的浮点数，第二个参数以字符串形式指定转换格式。\n\t第二个参数可以省略，省略时直接转换为字符串。\n\t此函数内部调用 C# 的 [`Double.ToString() 函数`](https://learn.microsoft.com/ja-jp/dotnet/api/system.double.tostring)，可以使用与 C# 相同的格式指定。如果第二个参数不合适，将发生错误。\n\n\t常用格式：\n\n\t| 格式 | 示例 | 结果 | 说明 |\n\t|------|------|------|------|\n\t| `\"F2\"` | `TOSTRF(3.14, \"F2\")` | `\"3.14\"` | 固定小数点，2 位 |\n\t| `\"F4\"` | `TOSTRF(3.14, \"F4\")` | `\"3.1400\"` | 固定小数点，4 位 |\n\t| `\"E\"` | `TOSTRF(3.14, \"E\")` | `\"3.140000E+000\"` | 科学计数法 |\n\t| `\"G4\"` | `TOSTRF(3.14, \"G4\")` | `\"3.14\"` | 通用格式，4 位有效数字 |\n\t| `\"0.00\"` | `TOSTRF(3.14, \"0.00\")` | `\"3.14\"` | 自定义数字格式 |\n\n\t精度+宽度填充需配合 FORM `%...%` 语法：\n\n\t```erb\n\tPRINTFORML %TOSTRF(PI, \"F2\"),10%      ; → \"      3.14\"（右对齐）\n\tPRINTFORML %TOSTRF(PI, \"F2\"),10,LEFT% ; → \"3.14      \"（左对齐）\n\t```\n\n!!! hint \"提示\"\n\n    同时支持命令形式和表达式函数形式。\n\n!!! example \"例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tA = 438765\n\t\tPRINTSL TOSTR(A)\n\t\tPRINTSL TOSTR(A, \"x\")\n\t\tPRINTSL TOSTR(A, \"X\")\n\t\tPRINTSL TOSTR(A, \"D8\")\n\t\tPRINTSL TOSTR(A, \"X8\")\n\t\tPRINTSL TOSTR(A, \"00000000\")\n\t\tPRINTSL TOSTR(A, \"########\")\n\t\tPRINTSL TOSTR(A, \"#,###\")\n\t\tPRINTSL TOSTR(A, \"0000万0000\")\n    ```\n    ```text\n\t438765　//标准\n\t6b1ed　//\"x\" 十六进制(小写)\n\t6B1ED　//\"X\" 十六进制(大写)\n\t00438765　//\"D8\" 十进制 + 8位\n\t0006B1ED　//\"X8\" 十六进制 + 8位\n\t00438765　//\"00000000\" 十进制 + 8位\n\t438765　//\"########\" 十进制\n\t438,765　//\"#,###\" 每3位加\",\"\n\t0043万8765　//\"0000万0000\" 8位 + 第4位插入\"万\"\n    ```\n\n### 相关项目\n- TOINT"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tstring TOUPPER string\n\tstring TOLOWER string\n\tstring TOHALF string\n\tstring TOFULL string\n    ```\n\t将参数字符串进行特定转换后的结果赋值给 `RESULTS:0` 或作为返回值。\n\t`TOUPPER` 将字母转换为大写，`TOLOWER` 将字母转换为小写。\n\t`TOHALF` 将全角字符转换为半角，但对于没有对应半角字符的全角字符则保持不变。\n\t`TOFULL` 将半角字符转换为全角。\n\n!!! hint \"提示\"\n\n    同时支持作为指令和表达式内函数使用。\n\n!!! example \"例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\tPRINTFORML %TOUPPER(\"eRAseRmOToRpHAntOM\")%\n\tPRINTFORML %TOLOWER(\"BEATMANIA\")+\"IIDX\"%\n\tPRINTFORML %TOHALF(\"パルスのファルシのルシがパージでコクーン\")%\n\tPRINTFORMW %TOFULL(\"SUGOI DEKAI\")%\n    ```\n    ```text\n\tERASERMOTORPHANTOM\n\tbeatmaniaIIDX\n\tﾊﾟﾙｽのﾌｧﾙｼのﾙｼがﾊﾟｰｼﾞでｺｸｰﾝ\n\tＳＵＧＯＩ　ＤＥＫＡＩ\n    ```"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tTRYCALL functionName(, `argument`...)\n\tTRYJUMP functionName(, `argument`...)\n\tTRYGOTO labelName\n    ```\n\t与 `JUMP`、`CALL`、`GOTO` 相同，但即使指定的函数不存在也不会报错。\n\t如果指定的函数不存在，则不执行任何操作。\n\t`TRYJUMP` 和 `TRYCALL` 可以指定参数。详情请参阅[函数页面的`自定义函数中的参数指定`一节](../Emuera//function.md#_2)。\n\t另外，当使用 `TRYGOTO` 直接跳转到 `IF～ELSEIF～ELSE～ENDIF` 内部时，会正常执行到 `ELSEIF`、`ELSE`、`ENDIF` 之前，然后跳转到 `ENDIF` 的下一行继续处理。\n\t当直接跳转到 `REPEAT～REND` 内部时，会正常执行到 `REND` 之前，然后忽略 `REND` 并从下一行继续处理。\n\t这些处理方式与 `GOTO` 或其他 `GOTO` 系命令相同。关于 Emuera 中新增的其他循环/分支语法，请参阅 [`循环/分支语法`](../Reference/README.zh.md#flow-control) 和 `TRYC` 系 章节。\n\n!!! hint \"提示\"\n\n    仅支持命令。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tTRYCALL AAA\n\t\tTRYCALL BBB\n\t\tTRYCALL CCC\n\t\tWAIT\n\n\t@AAA\n\t\tPRINTL AAA\n\n\t@CCC\n\t\tPRINTL CCC\n    ```\n    ```text\n\tAAA\n\tCCC\n    ```\n\n### 相关项目\n- TRY◯◯FORM\n- CALL\n- JUMP\n- GOTO"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    TRYCCALL functionName(, argument...)\n    TRYCJUMP functionName(, argument...)\n    TRYCJUMP labelName\n    TRYCCALLFORM formedString(, argument...)\n    TRYCJUMPFORM formedString(, argument...)\n    TRYCGOTOFORM formedString\n    CATCH\n    ENDCATCH\n    ```\n    `TRYC` 系列指令可以在函数调用时，控制当函数未找到时的行为。\n    如果函数存在，则调用该函数并执行 `TRYC` 之后的行；如果函数不存在，则执行 `CATCH` 之后的行。\n    其语法与 `IF～ELSE～ENDIF` 类似（区别在于即使函数存在时没有要执行的处理也可以省略）。\n    因此，当使用 `GOTO` 等指令直接跳转到 `TRYC系列～CATCH～ENDCATCH` 内部时，其行为与 `IF～ELSEIF～ELSE～ENDIF` 类似：\n    会正常执行到 `CATCH` 或 `ENDCATCH` 的前一行，然后跳转到 `ENDCATCH` 的下一行继续执行。\n    另外，关于使用 `TRYCGOTO` 或 `TRYCGOTOFORM` 直接跳入循环或分支结构内部的情况，请参阅 `TRYGOTO` 或 [`循环·分支结构`](../Reference/README.zh.md#flow-control) 章节。\n\n    ```erb\n\t\tTRYCCALL UNKNOWN_FUNC ;调用不存在的函数\n\t\t\t;函数存在时，函数执行后要进行的处理（如果有的话，没有则可以省略，直接接CATCH即可）\n\t\tCATCH\n\t\t\t;函数不存在时要进行的处理\n\t\tENDCATCH\n\t```\n\n\t此外，支持嵌套使用。\n\n!!! hint \"提示\"\n\n    仅支持指令。\n\n### 相关项目\n- TRY系\n- CALL\n- JUMP\n- GOTO"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    TRYCALLF funcName\n    ```\n\n    附加 `TRY` 功能的 `CALLF` 函数。\n    即便调用的目标函数不存在也不会报错；与此同时，`CALLF` 通过 `RETURNF` 返回的值也被丢弃。\n\n!!! hint \"提示\"\n\n    仅支持命令式写法。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n\n        TRYCALLF NULL\n        TRYCALLF TEST\n        WAIT\n\n    @TEST\n    #FUNCTION\n\n        PRINT 已调用 \"TEST\" 函数\n        RETURNF 0\n    ```\n\n    ```text\n    已调用 \"TEST\" 函数\n    ```\n\n### 相关项目\n- CALLF\n- TRYCALLFORMF"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    TRYCALLFORMF funcName\n    ```\n\n    附加 `TRY` 功能的 `CALLFORMF` 函数。\n    即便调用的目标函数不存在也不会报错；与此同时，`CALLFORMF` 通过 `RETURNF` 返回的值也被丢弃。\n\n!!! hint \"提示\"\n\n    仅支持命令式写法。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n\n    \tREPEAT 5\n    \t\tTRYCALLFORMF TEST{COUNT}\n    \t\tSIF !LINEISEMPTY()\n    \t\t\tPRINTL\n    \tREND\n    \tWAIT\n\n    @TEST1\n    #FUNCTION\n\n    \tPRINT 已调用 \"TEST1\" 函数\n    \tRETURNF 0\n\n    @TEST3\n    #FUNCTIONS\n\n    \tPRINT 已调用 \"TEST3\" 函数\n    \tRETURNF \"HOGE\"\n    ```\n\n    ```text\n    已调用 \"TEST1\" 函数\n    已调用 \"TEST3\" 函数\n    ```\n\n### 相关项目\n- CALLF\n- TRYCALLF"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tTRYCALLFORM formedString(, argument...)\n\tTRYJUMPFORM formedString(, argument...)\n\tTRYGOTOFORM formedString\n    ```\n\t与 `JUMP`、`CALL`、`GOTO` 相同，但可以像 `PRINTFORM` 一样指定函数名，即使函数不存在也不会报错。\n\t`TRYJUMPFORM` 和 `TRYCALLFORM` 可以指定参数。详情请参阅[函数页面的`自定义函数中的参数指定`一节](../Emuera//function.md#_2)。\n\t另外，关于使用 `TRYGOTOFORM` 直接进入循环/分支结构内部的情况，请参阅 `TRYGOTO`、[`循环/分支结构`](../Reference/README.zh.md#flow-control) 以及 `TRYC` 系列 的说明。\n\n!!! hint \"提示\"\n\n    仅支持命令。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\t#DIMS HOGE\n\t\tHOGES = AAA\n\n\t\tTRYCALLFORM %HOGES%\n\t\tTRYCALLFORM %HOGES%BBB\n\t\tTRYJUMPFORM %\"C\"*3%\n\n\t@AAA\n\t\tPRINTL AAA\n\n\t@BBB\n\t\tPRINTL BBB\n\n\t@CCC\n\t\tPRINTL CCC\n\t\tWAIT\n    ```\n    ```text\n\tAAA\n\tCCC\n    ```\n\n### 相关项目\n- TRY系\n- CALL\n- JUMP\n- GOTO"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tTRYCALLLIST\n\tTRYJUMPLIST\n\tTRYGOTOLIST\n\tFUNC functionName(, argument...)\n\tENDFUNC\n    ```\n\t这是一个用于指定多个函数（标签）并仅调用第一个找到的函数的语法。\n\t在 `TRYLIST系～ENDFUNC` 内部，不能使用上述语法以外的描述。\n\t另外，关于使用 `TRYGOTOLIST` 直接进入循环/分支结构的情况，请参考 `TRYGOTO`、[`循环/分支结构`](../Reference/README.zh.md#flow-control) 以及 `TRYC` 系 的章节。\n\t使用方法如下所示：\n\n    ```erb\n\tTRYCALLLIST\n\t\tFUNC 函数1\n\t\tFUNC 函数2\n\tENDFUNC\n\t```\n\n    `FUNC` 指定的函数将按顺序尝试调用，若成功则调用后跳转至 `ENDFUNC`，若失败则跳转至下一行的 `FUNC`（或 `ENDFUNC`）。\n    这等同于以下脚本：\n\n    ```erb\n    TRYCCALL 関数1\n    CATCH\n        TRYCCALL 関数2\n        CATCH\n        ENDCATCH\n    ENDCATCH\n    ```\n\n!!! hint \"提示\"\n\n    仅支持指令。\n\n### 相关项目\n- TRY系\n- TRYC系\n- CALL\n- JUMP\n- GOTO"
  },
  {
    "id": "TWAIT",
    "title": "TWAIT",
    "names": [
      "TWAIT"
    ],
    "signatures": [
      {
        "name": "TWAIT",
        "params": "`int`, `int`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "第一参数为限制时间，第二参数为输入接收标志。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tTWAIT timeLimit, forceWait\n    ```\n\t第一参数为限制时间，第二参数为输入接收标志。\n\t在限制时间经过前，将暂停执行。\n\t实际行为会根据输入接收标志的指定而变化。\n\n    - 输入接收标志 = 0：接受输入，一旦有输入，即使未到限制时间也会继续执行\n    - 输入接收标志 != 0：不接受输入（可以强制等待直到限制时间）\n\n!!! hint \"提示\"\n\n    仅支持指令。\n\n### 相关项目\n- WAIT\n- TINPUT"
  },
  {
    "id": "UNCHECKED",
    "title": "UNCHECKED 计算",
    "names": [
      "UNCHECKED_ADD",
      "UNCHECKED_SUB",
      "UNCHECKED_MUL",
      "UNCHECKED_NEG",
      "UNCHECKED"
    ],
    "signatures": [
      {
        "name": "UNCHECKED_ADD",
        "params": "`int`, `int`",
        "returns": "`int`",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "UNCHECKED_SUB",
        "params": "`int`, `int`",
        "returns": "`int`",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "UNCHECKED_MUL",
        "params": "`int`, `int`",
        "returns": "`int`",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "UNCHECKED_NEG",
        "params": "`int`",
        "returns": "`int`",
        "engines": [
          "skia"
        ],
        "overloads": []
      }
    ],
    "summary": "Skia（SkiaSharp版）新增。在 C# 的 unchecked 上下文中执行运算，溢出时不抛出异常，而是回环折返（wrap-around）。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int UNCHECKED_ADD a, b\n    int UNCHECKED_SUB a, b\n    int UNCHECKED_MUL a, b\n    int UNCHECKED_NEG a\n    ```\n\n    Skia（SkiaSharp版）新增。在 C# 的 `unchecked` 上下文中执行运算，溢出时不抛出异常，而是回环折返（wrap-around）。\n\n    Skia 版中，普通算术运算符（`+`、`-`、`*`、一元 `-`）由 SafeArithmetic 提供溢出保护。溢出时会输出警告，并将结果钳位到 `Long.MaxValue` 或 `Long.MinValue`。\n\n    然而，在哈希计算、随机数生成等场景中，**需要故意使用回环溢出行为**。UNCHECKED 系列函数即为这种向后兼容需求而提供。\n\n    | 函数 | 对应运算 | 说明 |\n    |:---|:---|:---|\n    | `UNCHECKED_ADD(a, b)` | `a + b` | 加法回环溢出 |\n    | `UNCHECKED_SUB(a, b)` | `a - b` | 减法回环溢出 |\n    | `UNCHECKED_MUL(a, b)` | `a * b` | 乘法回环溢出 |\n    | `UNCHECKED_NEG(a)` | `-a` | 取反回环溢出 |\n\n!!! warning \"注意\"\n\n    这些函数在溢出时**不会输出警告**。容易引入非预期的溢出 bug，请仅在确实需要回环行为的场景中使用。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n        ; 普通加法（SafeArithmetic）：溢出时钳位\n        ; 9223372036854775807 + 1 → Long.MaxValue（钳位，有警告）\n\n        ; UNCHECKED_ADD：溢出时回环折返\n        ; 9223372036854775807 + 1 → -9223372036854775808（折返，无警告）\n\n        ; 哈希计算中的使用示例\n        #DIM hash = 0\n        hash = UNCHECKED_ADD(hash, UNCHECKED_MUL(31, someValue))\n    ```"
  },
  {
    "id": "UNICODE",
    "title": "UNICODE, ENCODETOUNI",
    "names": [
      "UNICODE",
      "ENCODETOUNI",
      "PRINTFORMW"
    ],
    "signatures": [
      {
        "name": "UNICODE",
        "params": "`int`",
        "returns": "`string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "ENCODETOUNI",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "UNICODE 是根据参数值返回对应 Unicode 字符的命令/式中函数。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tstring UNICODE characterCode\n\tint ENCODETOUNI string(, position)\n    ```\n\t`UNICODE` 是根据参数值返回对应 Unicode 字符的命令/式中函数。\n\t例如，以下脚本会显示一个空心爱心符号。\n\t但是，此函数无法处理代理对。\n\t此外，如果字体不支持，则无法显示。\n\n    ```erb\n\tUNICODE 0x2661\n\tPRINTFORMW %RESULTS%\n\t```\n\n\t请注意，Emuera 的 Unicode 支持并不完全。\n\t例如，当 Emuera 使用代理对时，无法保证其行为完全正确。\n\n\t`ENCODETOUNI` 将给定的字符串编码为 Unicode 并返回其字节的数值。\n\t作为命令使用时：\n\n\t- RESULT:0 　字符数\n\t- RESULT:1～ 字节数值\n\n    式中函数的情况下，将目标位置的字符转换为 Unicode 代码值并返回。位置可以省略，省略时以 `0`（开头）为目标。\n\n!!! hint \"提示\"\n\n    命令和式中函数均支持。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n        #DIMS HOGES = @\"%UNICODE(0x2661)%\"\n        PRINTFORMW %HOGES% %CONVERT(ENCODETOUNI(HOGES), 16)%\n    ```\n    ```text\n    ♡ 2661\n    ```"
  },
  {
    "id": "UPCHECK",
    "title": "UPCHECK",
    "names": [
      "UPCHECK"
    ],
    "signatures": [
      {
        "name": "UPCHECK",
        "params": "无",
        "returns": "无",
        "engines": [
          "eramaker"
        ],
        "overloads": []
      }
    ],
    "summary": "将TARGET的UP、DOWN状态值累加到PALAM中，并显示增减量",
    "body": "!!! info \"API\"\n\n    ```erb\n\tUPCHECK\n    ```\n    将`TARGET`的`UP`、`DOWN`状态值累加到`PALAM`中，并显示增减量\n\n!!! hint \"提示\"\n\n    仅支持作为指令使用。\n\n!!! example \"示例\"\n    ```erb\n\t0,能力0\n\t1,能力1\n\t2,能力2\n\t```\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tADDVOIDCHARA\n\t\tTARGET = 0\n\t\tUP:0 = 123\n\t\tUP:1 = 456\n\t\tUP:2 = 789\n\n\t\tUPCHECK\n\t\tWAIT\n    ```\n    ```text\n\t能力0 0+123=123\n\t能力1 0+456=456\n\t能力2 0+789=789\n    ```\n\n### 相关项目\n- CUPCHECK"
  },
  {
    "id": "UPDATECHECK",
    "title": "UPDATECHECK",
    "names": [
      "UPDATECHECK"
    ],
    "signatures": [
      {
        "name": "UPDATECHECK",
        "params": "`void`",
        "returns": "`int`",
        "engines": [
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "从 GameBase.csv 配置的 バージョン情報URL 获取最新版本信息，如果当前版本不是最新版则弹出对话框提醒更新。",
    "body": "!!! info \"API\"\n\n    ```erb\n    UPDATECHECK\n    ```\n\n    从 `GameBase.csv` 配置的 `バージョン情報URL` 获取最新版本信息，如果当前版本不是最新版则弹出对话框提醒更新。\n\n    1. `./csv/GameBase.csv` 新增「バージョン名」「バージョン情報URL」配置项。\n        `バージョン名` 是字符串类型的任意格式版本号，`バージョン情報URL` 是确认最新版本信息用的 URL。\n    2. 上述记载的 URL 应该响应最新版本的版本号和下载地址。\n        第 1 行写最新的版本号，第 2 行写最新的资源下载地址，第 3 行及之后可以写任意备注文本。\n        如果你使用的是公开的 Git 仓库，可以把最新的版本信息推送到远程存储库，通过 raw 格式进行访问。\n    3. 执行 `UPDATECHECK` 时访问 `GameBase.csv` 配置的 URL（更新信息地址）。\n        如果当前版本已经是最新版，将 `RESULT` 赋值为 `0`，结束。\n        如果当前版本与最新版本不同，弹出对话框询问玩家是否打开云端记载的最新版本资源地址。\n    4. 如果选择「いいえ（不更新）」，将 `RESULT` 赋值为 `1`，除此之外什么都不做；\n        如果选择「はい（更新）」，将 `RESULT` 赋值为 `2`，并打开默认浏览器访问最新版本资源地址；\n        如果因为任意原因失败（访问更新信息地址失败，更新信息地址的响应结果中没有包含版本信息 / 最新版本资源地址等等），将 `RESULT` 赋值为 `3`。\n\n!!! hint \"提示\"\n\n    只能作为命令使用。\n\n!!! example \"示例代码\"\n    ```erb\n    バージョン情報URL, https://gitlab.com/EvilMask/emuera.em.doc/-/raw/master/version.txt\n    バージョン名, 1.00\n    ```\n\n    ```text\n    1.01\n    https://evilmask.gitlab.io/emuera.em.doc/\n    ```\n\n    ```erb\n    @SYSTEM_TITLE\n        UPDATECHECK\n    ```\n\n    ![](../assets/images/UPDATECHECK.png)"
  },
  {
    "id": "VAR",
    "title": "VARI,VARS",
    "names": [
      "VARI",
      "VARS",
      "PRINTFORML",
      "REPEAT",
      "REND",
      "VAR"
    ],
    "signatures": [
      {
        "name": "VARI",
        "params": "`string`(, `int`)",
        "returns": "无",
        "engines": [
          "net"
        ],
        "overloads": []
      },
      {
        "name": "VARS",
        "params": "`string`(, `int`)",
        "returns": "无",
        "engines": [
          "net"
        ],
        "overloads": []
      }
    ],
    "summary": "可以在函数中的任意位置定义函数本地的动态变量。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tVARI variableName = intValue\n\tVARS variableName = strValue\n\tVARI variableName(, arraySize)\n\tVARS variableName(, arraySize)\n    ```\n\n\t可以在函数中的任意位置定义函数本地的动态变量。\n\t`VARI` 用于整数，`VARS` 用于字符串。\n\t数组不会被赋予初始值，字符串必须用 `\"～\"` 括起来。\n\n    ```erb\n\tVARS QUESTION = \"生命、宇宙、以及万物存在的终极问题的答案\"\n\tVARI ANSWER = 42\n\tPRINTFORML Q.%QUESTION%\n\tPRINTFORML A.{ANSWER}\n\n\tVARI INTEGER, 3\n\n\tREPEAT 4\n\t\tINTEGER:COUNT = COUNT*14\n\t\tPRINTFORML {INTEGER:COUNT}\n\tREND\n\t```\n\n    ```text\n\tQ.生命、宇宙、以及万物存在的终极问题的答案\n\tA.42\n\n\t0\n\t14\n\t28\n\t42\n\t```\n\n!!! hint \"提示\"\n\n    仅支持命令。\n\n### 相关项目\n- [函数·预处理器>#DIM](../Emuera/function.md#dim)"
  },
  {
    "id": "VARSET",
    "title": "VARSET",
    "names": [
      "VARSET"
    ],
    "signatures": [
      {
        "name": "VARSET",
        "params": "`variable`(, `value`, `startIndex`, `endIndex`)",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "将第二参数的值赋值给指定变量数组的指定范围。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tVARSET variableName(, value, startIndex, endIndex)\n    ```\n\t将第二参数的值赋值给指定变量数组的指定范围。\n\t若省略第二参数，则赋值 `0` 或空字符串。\n\t若省略第三及后续参数，则赋值给数组的全部元素。\n\t例如\n\n    ```erb\n\tVARSET FLAG, 0\n\tVARSET STR, \"あああ\", 0, 10\n\tVARSET TA:0:0:0,5678\n\t```\n\n    在这个例子中，`FLAG` 的所有元素都将变为 `0`。\n    `STR:0` 到 `STR:9` 将被赋值为 `あああ`，`TA` 的所有三维数组元素也将被赋值为 `5678`。\n    同样的事情也可以在 ERB 中使用 `FOR-NEXT` 循环等来实现，但当循环次数达到数十万次时，执行时间就不可忽视了。\n    `VARSET` 指令可以比在 ERB 中进行赋值更快地完成处理。\n    当将角色变量作为 `VARSET` 指令的目标时，赋值将仅作用于指定角色的元素。\n\n    ```erb\n\tVARSET CFLAG:MASTER:0, 0\n\tVARSET CSTR, \"\"\n\t```\n\n\t此例中，`MASTER` 的 `CFLAG:0～999`（若未更改 VariableSize.csv）将变为 `0`，但其他角色的 `CFLAG` 不受影响。\n\t此外，省略对象时，将如常视为 `TARGET`，因此 `TARGET` 的所有 `CSTR` 都将变为空字符串。其他角色的 `CSTR` 不受影响。\n\t对于一维数组及数组型角色变量以外的类型，如用于 `DITEMTYPE` 或 `TA` 等时，第三及之后的参数将被忽略，并对数组的所有元素进行赋值。\n\n!!! hint \"提示\"\n\n    仅支持命令形式。\n\n### 相关项目\n- VARSETEX"
  },
  {
    "id": "VARSETEX",
    "title": "VARSETEX",
    "names": [
      "VARSETEX"
    ],
    "signatures": [
      {
        "name": "VARSETEX",
        "params": "`string`, `any`(, `int`, `int`, `int`)",
        "returns": "`1`",
        "engines": [
          "em"
        ],
        "overloads": []
      }
    ],
    "summary": "与本家的 VARSET 类似，将名为 varName（字符串）的变量赋值为 value，而不是直接使用变量标识符。",
    "body": "!!! info \"API\"\n\n    ```erb\n    1 VARSETEX varName, value(, setAllDim, from, to)\n    ```\n\n    与本家的 [`VARSET`](https://osdn.net/projects/emuera/wiki/excom#h5-VARSET.20.3C.E5.A4.89.E6.95.B0.E5.90.8D.3E.7B.2C.20.3C.E6.95.B0.E5.BC.8F.20or.20.E6.96.87.E5.AD.97.E5.88.97.E5.BC.8F.3E.2C.20.3C.E9.85.8D.E5.88.97.E7.AF.84.E5.9B.B2.E5.88.9D.E5.80.A4.3E.2C.20.3C.E9.85.8D.E5.88.97.E7.AF.84.E5.9B.B2.E7.B5.82.E5.80.A4.2B1.3E.7D) 类似，将名为 `varName`（字符串）的变量赋值为 `value`，而不是直接使用变量标识符。\n    `setAllDim` 不为 `0` 或直接省略时，将整个数组的所有元素赋值为 `value`；否则，只赋值给最低维度的数组。\n    可以用 `from` / `to` 两个参数来指定赋值数组开始和结束的位置（不包括下标为 `to` 的元素）。\n    省略 `to` 参数时，一直赋值到数组的末尾；省略 `from` 参数时，从数组的第一个元素（下标为 `0`）开始赋值。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    #DIM 整型数组 = 1, 2, 3, 4, 5, 6\n    #DIM 二维整型数组, 3, 4\n    ```\n    ```erb\n    @SYSTEM_TITLE\n        #DIMS 临时字符串数组 = \"Cat1\", \"Cat2\", \"Cat3\"\n        #DIM i\n        #DIM j\n\n        ; 省略第二个参数：预计在 v8 版本实现\n        ; VARSETEX \"临时字符串数组\"\n        VARSETEX \"临时字符串数组\", \"dog\"\n        FOR i, 0, 3\n            PRINTS 临时字符串数组:i + \" \"\n        NEXT\n        PRINTL\n        ; 对于一维数组来说，第三个参数无所谓\n        VARSETEX \"整型数组\", -1, 0, 3, 5\n        FOR i, 0, 6\n            PRINTFORMS @\"{整型数组:i} \"\n        NEXT\n        PRINTL\n        ; 开始位置是数组 1 的下标 2，第四个参数为 1（包括的范围比 2 大，视为 2）\n        ; 第三个参数为 0，因此只对数组 1 生效\n        VARSETEX \"二维整型数组:1:2\", -1, 0, 1\n        FOR i, 0, 3\n            PRINTFORMS @\"数组{i} -> \"\n            FOR j, 0, 4\n                PRINTFORM {二维整型数组:i:j, 3, RIGHT}\n            NEXT\n            PRINTL\n        NEXT\n        PRINTL\n        VARSET 二维整型数组\n\n        ; 第三个参数省略时\n        VARSETEX \"二维整型数组:1:2\", -1\n        FOR i, 0, 3\n            PRINTFORMS @\"数组{i} -> \"\n            FOR j, 0, 4\n                PRINTFORM {二维整型数组:i:j, 3, RIGHT}\n            NEXT\n            PRINTL\n        NEXT\n\n        ONEINPUT\n    ```\n    ```text\n    dog dog dog\n    1 2 3 -1 -1 6\n    数组0 ->   0  0  0  0\n    数组1 ->   0  0 -1 -1\n    数组2 ->   0  0  0  0\n\n    数组0 ->   0  0 -1 -1\n    数组1 ->   0  0 -1 -1\n    数组2 ->   0  0 -1 -1\n    ```\n\n### 相关项目\n- VARSET"
  },
  {
    "id": "VARSIZE",
    "title": "VARSIZE",
    "names": [
      "VARSIZE",
      "PRINTFORML",
      "WAIT",
      "X"
    ],
    "signatures": [
      {
        "name": "VARSIZE",
        "params": "`variable`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "VARSIZE",
        "params": "`variable`(, `dimension`)",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "命令和表达式中函数的规格不同。",
    "body": "!!! info \"API\"\n\n    ```erb\n    VARSIZE variableName\n    VARSIZE(variableName(, dimension))\n    ```\n    命令和表达式中函数的规格不同。\n    作为命令使用时，会将指定变量数组的大小赋值给`RESULT:0`。\n    对于多维数组变量，会按从左到右的顺序依次赋值给`RESULT:0`、`RESULT:1`、`RESULT:2`。\n    数组的大小是在`VariableSize.csv`中指定的值。\n\n    ```erb\n    VARSIZE FLAG\n    PRINTFORML <TEST1> = {RESULT:0}\n    VARSIZE SAVESTR\n    PRINTFORML <TEST2> = {RESULT:0}\n    VARSIZE TALENT\n    PRINTFORML <TEST3> = {RESULT:0}\n    WAIT\n    ```\n\n    结果（未更改大小时）\n\n\t\t<TEST1> = 10000\n\t\t<TEST2> = 100\n\t\t<TEST3> = 1000\n\n\t※由于实际上并不引用变量，因此不会发生数组越界错误。\n\t　在上面的例子中，即使`TARGET == -1`，也不会尝试引用第`-1`个人的`TALENT`而导致错误。\n\n\t作为表达式函数使用时：\n\n\t```erb\n\tX = VARSIZE(\"FLAG\")\n\t```\n\n    必须以字符串形式指定。\n    此外，获取`DITEMTYPE`或`TA`等多维数组变量的大小时，需要通过第二个参数指定维度（从最左侧的元素开始，依次为`0, 1, 2`）。\n    若要一次性获取多维数组变量的元素总数，请使用对应的命令形式。\n    另外，如果在EM+EE中启用了[`使VARSIZE的维度指定与ERD保持一致`](../Emuera/config.md#varsizeerd)选项，则维度指定将遵循ERD系统，从左到右变为`1, 2, 3`。\n\n!!! hint \"提示\"\n\n    同时支持命令形式和表达式函数形式。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n        #DIM HOGE, 1, 2, 3\n        #DIMS HOGES, 4, 5, 6\n    ```\n\n    ```erb\n    @SYSTEM_TITLE\n\t\t#DIM HOGE, 1, 2, 3\n\t\t#DIMS HOGES, 4, 5, 6\n\t\tVARSIZE HOGE\n\t\tPRINTFORML HOGE 1维:{RESULT:0} 2维:{RESULT:1} 3维:{RESULT:2}\n\t\tPRINTFORMW HOGES 1维:{VARSIZE(\"HOGES\", 0)} 2维:{VARSIZE(\"HOGES\", 1)} 3维:{VARSIZE(\"HOGES\", 2)}\n    ```\n    ```text\n\tHOGE 1维:1 2维:2 3维:3\n\tHOGES 1维:4 2维:5 3维:6\n    ```"
  },
  {
    "id": "WAIT",
    "title": "WAIT",
    "names": [
      "WAIT"
    ],
    "signatures": [
      {
        "name": "WAIT",
        "params": "无",
        "returns": "`void`",
        "engines": [
          "eramaker"
        ],
        "overloads": []
      }
    ],
    "summary": "等待一次鼠标点击或 Enter 键输入",
    "body": "!!! info \"API\"\n\n    ```erb\n\tWAIT\n    ```\n    等待一次鼠标点击或 Enter 键输入\n\n!!! hint \"提示\"\n\n    仅支持指令形式。\n\n### 相关项目\n- WAITANYKEY\n- TWAIT\n- AWAIT"
  },
  {
    "id": "WAITANYKEY",
    "title": "WAITANYKEY",
    "names": [
      "WAITANYKEY"
    ],
    "signatures": [
      {
        "name": "WAITANYKEY",
        "params": "无",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "等待任意按键输入或鼠标点击的 WAIT 指令。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tWAITANYKEY\n    ```\n\t等待任意按键输入或鼠标点击的 `WAIT` 指令。\n\t也可以说是 `WAIT` 的 `ONEINPUT` 版本。\n\n!!! hint \"提示\"\n\n    仅指令本身同时支持两种输入方式。\n\n### 相关项目\n- WAIT\n- ONEINPUT"
  },
  {
    "id": "WHILE",
    "title": "WHILE-WEND",
    "names": [
      "WHILE",
      "WEND"
    ],
    "signatures": [
      {
        "name": "WHILE",
        "params": "`int`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "WEND",
        "params": "无",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "这是类似于 REPEAT～REND 或 FOR～NEXT 的一种循环结构。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tWHILE bool\n\tWEND\n    ```\n\t这是类似于 `REPEAT～REND` 或 `FOR～NEXT` 的一种循环结构。\n\t只要 `WHILE` 的 `bool` 不为 0，就会重复执行循环。\n\t如果给定的条件始终满足，除非使用 `BREAK` 跳出，否则将形成无限循环。\n\t如果循环处理时间过长，Emuera 可能会报错。\n\t另外，如果通过 `GOTO` 等指令直接跳转到 `WHILE～WEND` 循环内部，当执行到 `WEND` 时，会正常跳回 `WHILE` 处进行条件判断。\n\n!!! hint \"提示\"\n\n    仅支持指令形式。\n\n### 相关项目\n- REPEAT-REND\n- FOR-NEXT\n- CONTINUE.BREAK"
  },
  {
    "id": "XML_ADDATTRIBUTE",
    "title": "XML_ADDATTRIBUTE 系列",
    "names": [
      "XML_ADDATTRIBUTE",
      "XML_ADDATTRIBUTE_BYNAME"
    ],
    "signatures": [
      {
        "name": "XML_ADDATTRIBUTE",
        "params": "`int`, `string`, `string`(, `string`, `int`, `int`)",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": [
          "`ref` `string`, `string`, `string`(, `string`, `int`, `int`)"
        ]
      },
      {
        "name": "XML_ADDATTRIBUTE_BYNAME",
        "params": "`string`, `string`, `string`(, `string`, `int`, `int`)",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      }
    ],
    "summary": "根据 xpath 选择的元素节点 / 属性（详见 XPath 的介绍）添加新的属性「attrName=attrValue」到指定的 XML 中。省略参数 attrValue 时，新增的属性值默认设为空字符串。当 xpath 的匹配结果存在多个时，必须将参数 doSetAll 设为 0 以外的数值才能成功新增属性。",
    "body": "!!! info \"API\"\n\n    ```erb\n    1. int XML_ADDATTRIBUTE xmlId, xpath, attrName(, attrValue, methodType, doSetAll)\n    2. int XML_ADDATTRIBUTE ref xml, xpath, attrName(, attrValue, methodType, doSetAll)\n    3. int XML_ADDATTRIBUTE_BYNAME xmlName, xpath, attrName(, attrValue, methodType, doSetAll)\n    ```\n    根据 `xpath` 选择的元素节点 / 属性（详见 [`XPath` 的介绍](https://www.octoparse.jp/blog/xpath-introduction)）添加新的属性「`attrName`=`attrValue`」到指定的 `XML` 中。省略参数 `attrValue` 时，新增的属性值默认设为空字符串。当 `xpath` 的匹配结果存在多个时，必须将参数 `doSetAll` 设为 `0` 以外的数值才能成功新增属性。\n\n    - `methodType` 为 `0` 或直接省略时，在选择的元素节点的属性列表末尾添加新属性。\n    - `methodType` 为 `1` 时，在选择的元素节点的属性之前添加新属性。\n    - `methodType` 为 `2` 时，在选择的元素节点的属性之后添加新属性。\n\n    新属性添加成功时返回新增的次数（因为可能会匹配到多个结果，导致新增复数次）；失败时返回 `0`。\n\n    1.  从以 `xmlId` 的字符串转换结果([`TOSTR`](https://osdn.net/projects/emuera/wiki/exmeth#h5-str.20TOSTR.28int.20value.2C.20str.20format.20.3D.20.22.22.29))为 ID 而指定的 [`XmlDocument`](https://docs.microsoft.com/zh-cn/dotnet/api/system.xml.xmldocument?view=netframework-4.8) 中检索元素。若指定的 `XmlDocument` 不存在，返回 `-1`。\n    2. 从指定的 `xml` 内容中检索元素，并将新的结果重新赋值给 `xml`；`xml` 必须是变量。\n    3. 从以 `xmlName` 为 ID 而指定的 `XmlDocument` 中检索元素。若指定的 `XmlDocument` 不存在，返回 `-1`。\n\n    !!! warning \"注意\"\n\n        获取的 XML 不是真正的 `XmlNode` 节点实例，因此在 `xpath` 的开头使用「`//`」快捷表示方法并不会生效。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        #DIMS xml = \"<xml/>\"\n\n        PRINTFORML {XML_ADDATTRIBUTE(xml, \"/xml\", \"foo\")} -> %xml%\n\n        XML_DOCUMENT 0, xml\n        PRINTFORML {XML_ADDATTRIBUTE(0, \"/xml/@foo\", \"id\", \"1\", 1)} -> %XML_TOSTR(0)%\n\n        ONEINPUT\n    ```\n    ```text\n    1 -> <xml foo=\"\" />\n    1 -> <xml id=\"1\" foo=\"\" />\n    ```"
  },
  {
    "id": "XML_ADDNODE",
    "title": "XML_ADDNODE 系列",
    "names": [
      "XML_ADDNODE",
      "XML_ADDNODE_BYNAME"
    ],
    "signatures": [
      {
        "name": "XML_ADDNODE",
        "params": "`int`, `string`, `string`(, `int`, `int`)",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": [
          "`ref` `string`, `string`, `string`(, `int`, `int`)"
        ]
      },
      {
        "name": "XML_ADDNODE_BYNAME",
        "params": "`string`, `string`, `string`(, `int`, `int`)",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      }
    ],
    "summary": "根据 xpath 选择的元素节点（详见 XPath 的介绍）添加新的元素节点到指定的 XML 中。当 xpath 的匹配结果存在多个时，必须将参数 doSetAll 设为 0 以外的数值才能成功新增节点。",
    "body": "!!! info \"API\"\n\n    ```erb\n    1. int XML_ADDNODE xmlId, xpath, nodeXml(, methodType, doSetAll)\n    2. int XML_ADDNODE ref xml, xpath, nodeXml(, methodType, doSetAll)\n    3. int XML_ADDNODE_BYNAME xmlName, xpath, nodeXml(, methodType, doSetAll)\n    ```\n    根据 `xpath` 选择的元素节点（详见 [`XPath` 的介绍](https://www.octoparse.jp/blog/xpath-introduction)）添加新的元素节点到指定的 `XML` 中。当 `xpath` 的匹配结果存在多个时，必须将参数 `doSetAll` 设为 `0` 以外的数值才能成功新增节点。\n\n    - `methodType` 为 `0` 或直接省略时，将选择的元素作为父级节点，在子节点列表末尾添加 `nodeXml` 作为子节点。\n    - `methodType` 为 `1` 时，在选择的元素节点（根节点除外）之前添加 `nodeXml` 作为兄弟节点。\n    - `methodType` 为 `2` 时，在选择的元素节点（根节点除外）之后添加 `nodeXml` 作为兄弟节点。\n\n    新节点添加成功时返回新增的次数（因为可能会匹配到多个结果，导致新增复数次）；失败时返回 `0`。\n\n    1.  从以 `xmlId` 的字符串转换结果([`TOSTR`](https://osdn.net/projects/emuera/wiki/exmeth#h5-str.20TOSTR.28int.20value.2C.20str.20format.20.3D.20.22.22.29))为 ID 而指定的 [`XmlDocument`](https://docs.microsoft.com/zh-cn/dotnet/api/system.xml.xmldocument?view=netframework-4.8) 中检索元素。若指定的 `XmlDocument` 不存在，返回 `-1`。\n    2. 从指定的 `xml` 内容中检索元素，并将新的结果重新赋值给 `xml`；`xml` 必须是变量。\n    3. 从以 `xmlName` 为 ID 而指定的 `XmlDocument` 中检索元素。若指定的 `XmlDocument` 不存在，返回 `-1`。\n\n    !!! warning \"注意\"\n\n        获取的 XML 不是真正的 `XmlNode` 节点实例，因此在 `xpath` 的开头使用「`//`」快捷表示方法并不会生效。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        #DIMS xml = \"<xml/>\"\n\n        PRINTFORML {XML_ADDNODE(xml, \"/xml\", \"<child/>\")} -> %xml%\n\n        XML_DOCUMENT 0, xml\n\n        PRINTFORML {XML_ADDNODE(0, \"/xml/child\", \"<brother/>\", 1)}\n        PRINTSL XML_TOSTR(0)\n\n        ONEINPUT\n    ```\n    ```text\n    1 -> <xml><child /></xml>\n    1\n    <xml><brother /><child /></xml>\n    ```"
  },
  {
    "id": "XML_GET",
    "title": "XML_GET 系列",
    "names": [
      "XML_GET",
      "XML_GET_BYNAME"
    ],
    "signatures": [
      {
        "name": "XML_GET",
        "params": "`any`, `string`(, `int`, `int`)",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": [
          "`any`, `string`, `ref` `string[]`(, `int`)"
        ]
      },
      {
        "name": "XML_GET_BYNAME",
        "params": "`string`, `string`(, `int`, `int`)",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": [
          "`string`, `string`, `ref` `string[]`(, `int`)"
        ]
      }
    ],
    "summary": "根据 xpath 选择的元素节点（详见 XPath 的介绍）在指定的 XML 中检索。",
    "body": "!!! info \"API\"\n\n    ```erb\n    1. int XML_GET xml, xpath(, doOutput, outputType)\n    2. int XML_GET xml, xpath, ref outputArray(, outputType)\n    3. int XML_GET_BYNAME xmlName, xpath(, doOutput, outputType)\n    4. int XML_GET_BYNAME xmlName, xpath, ref outputArray(, outputType)\n    ```\n    根据 `xpath` 选择的元素节点（详见 [`XPath` 的介绍](https://www.runoob.com/xpath/xpath-tutorial.html)）在指定的 `XML` 中检索。\n\n    对于形式 `1` 和 `2`，如果 `xml` 是字符串，则在内容的 XML 文本中检索节点。如果 `xml` 是整型数值，则在以其字符串转换结果([`TOSTR`](https://osdn.net/projects/emuera/wiki/exmeth#h5-str.20TOSTR.28int.20value.2C.20str.20format.20.3D.20.22.22.29))为 ID 而指定的 [`XmlDocument`](https://docs.microsoft.com/zh-cn/dotnet/api/system.xml.xmldocument?view=netframework-4.8) 中检索节点；若 `XmlDocument` 不存在，返回 `-1`。\n\n    对于形式 `3` 和 `4`，在以 `xmlName` 为 ID 指定的 `XmlDocument` 中检索节点；若 `XmlDocument` 不存在，返回 `-1`。\n\n    同时，\n\n    - 对于形式`1`和`3`: 如果参数 `doOutput` 为 `0` 或直接省略，仅返回匹配到的结果数量；否则将匹配结果赋值给 `RESULTS`。\n    - 对于形式`2`和`4`: 如果参数 `outputArray` 为字符串数组变量，则会将匹配结果赋值给 `outputArray`。\n\n    根据参数 `outputType` 的值决定返回结果的类型：\n\n    - `1`: 节点的 `InnerText`\n    - `2`: 节点的 `InnerXml`\n    - `3`: 节点的 `OuterXml`\n    - `4`: 节点的 `Name`\n    - 其他值或直接省略: 节点的 `Value`\n\n    !!! warning \"注意\"\n\n        获取的 XML 不是真正的 `XmlNode` 节点实例，因此在 `xpath` 的开头使用「`//`」快捷表示方法并不会生效。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        #DIMS xml = \"<test><dir readonly='false'><file name='A.txt'>InnerText内容A</file></dir><file name='B.txt'>InnerText内容B</file></test>\"\n        #DIMS nodes, 10\n        XML_DOCUMENT 0, xml\n\n        ; 直接从字符串中检索节点\n        PRINTFORML 匹配结果数量：{XML_GET(xml, \"/test//file\", 1, 3)}\n        PRINTFORML InnerXml(1)：%RESULTS:0%\n        PRINTFORML InnerXml(2)：%RESULTS:1%\n\n        ; 从 XmlDocument 中检索节点\n        PRINTFORML 匹配结果数量：{XML_GET(0, \"/test//file/@name\", 1)}\n        PRINTFORML Value(1)：%RESULTS:0%\n        PRINTFORML Value(2)：%RESULTS:1%\n        PRINTFORML 匹配结果数量：{XML_GET(0, \"/test/dir/*[1]\", nodes, 1)}\n        PRINTFORML InnerText：%nodes:0%\n\n        ONEINPUT\n    ```\n    ```text\n    匹配结果数量：2\n    InnerXml(1)：<file name=\"A.txt\">InnerText内容A</file>\n    InnerXml(2)：<file name=\"B.txt\">InnerText内容B</file>\n    匹配结果数量：2\n    Value(1)：A.txt\n    Value(2)：B.txt\n    匹配结果数量：1\n    InnerText：InnerText内容A\n    ```"
  },
  {
    "id": "XML_MANAGE",
    "title": "XML_DOCUMENT 处理系列",
    "names": [
      "XML_DOCUMENT",
      "XML_RELEASE",
      "XML_EXIST",
      "XML_MANAGE"
    ],
    "signatures": [
      {
        "name": "XML_DOCUMENT",
        "params": "`any`, `string`",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      },
      {
        "name": "XML_RELEASE",
        "params": "`any`",
        "returns": "`1`",
        "engines": [
          "em"
        ],
        "overloads": []
      },
      {
        "name": "XML_EXIST",
        "params": "`any`",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      }
    ],
    "summary": "关于 XmlDocument 的生成、删除、判断是否存在的一系列函数。若 xmlId 为整数，则使用其字符串转换结果值(TOSTR)。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int XML_DOCUMENT xmlId, xmlContent\n    1 XML_RELEASE xmlId\n    int XML_EXIST xmlId\n    ```\n\n    关于 [`XmlDocument`](https://docs.microsoft.com/zh-cn/dotnet/api/system.xml.xmldocument?view=netframework-4.8) 的生成、删除、判断是否存在的一系列函数。若 `xmlId` 为整数，则使用其字符串转换结果值([`TOSTR`](https://osdn.net/projects/emuera/wiki/exmeth#h5-str.20TOSTR.28int.20value.2C.20str.20format.20.3D.20.22.22.29))。\n\n    - `XML_DOCUMENT`：解析 `xmlContent` 并保存为 `XmlDocument`。\n        如果已经存在 `xmlId` 对应的 `XmlDocument`（创建失败），返回 `0`；创建成功时，返回 `1`。\n    - `XML_RELEASE`：删除 `xmlId` 对应的 `XmlDocument`。\n    - `XML_EXIST`：判断 `xmlId` 对应的 `XmlDocument` 是否存在。如果存在，返回 `1`；否则返回 `0`。\n\n    !!! warning \"注意\"\n\n        关于将生成的 `XmlDocument` 保存进存档文件请参考「`XML`、`MAP`、`DataTable` 保存功能」。「タイトル画面へ戻る（返回标题界面）」或 [`RESETDATA`](https://osdn.net/projects/emuera/wiki/excom#h5-RESETDATA) 后会自动删除。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        PRINTFORML 0号XmlDocument是否存在：{XML_EXIST(0)}\n        XML_DOCUMENT 0, \"<xml/>\"\n        PRINTSL RESULT ? \"创建成功\" # \"已经存在\"\n        XML_DOCUMENT 0, \"<xml/>\"\n        PRINTSL RESULT ? \"创建成功\" # \"已经存在\"\n\n        RESETDATA  ; 自动删除所有 XmlDocument\n\n        XML_DOCUMENT 0, \"<xml/>\"\n        PRINTSL RESULT ? \"创建成功\" # \"已经存在\"\n        PRINTFORML 0号XmlDocument是否存在：{XML_EXIST(0)}\n        XML_RELEASE 0\n        PRINTFORML 0号XmlDocument是否存在：{XML_EXIST(0)}\n\n        ONEINPUT\n    ```\n    ```text\n    0号XmlDocument是否存在：0\n    创建成功\n    已经存在\n    创建成功\n    0号XmlDocument是否存在：1\n    0号XmlDocument是否存在：0\n    ```"
  },
  {
    "id": "XML_REMOVEATTRIBUTE",
    "title": "XML_REMOVEATTRIBUTE 系列",
    "names": [
      "XML_REMOVEATTRIBUTE",
      "XML_REMOVEATTRIBUTE_BYNAME"
    ],
    "signatures": [
      {
        "name": "XML_REMOVEATTRIBUTE",
        "params": "`int`, `string`(, `int`)",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": [
          "`ref` `string`, `string`(, `int`)"
        ]
      },
      {
        "name": "XML_REMOVEATTRIBUTE_BYNAME",
        "params": "`string`, `string`(, `int`)",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      }
    ],
    "summary": "从指定的 XML 中删除 xpath 选择的属性（详见 XPath 的介绍）。当 xpath 的匹配结果存在多个时，必须将参数 doSetAll 设为 0 以外的数值才能成功删除属性。删除属性成功时，返回已删除属性的数量；失败时返回 0。",
    "body": "!!! info \"API\"\n\n    ```erb\n    1. int XML_REMOVEATTRIBUTE xmlId, xpath(, doSetAll)\n    2. int XML_REMOVEATTRIBUTE ref xml, xpath(, doSetAll)\n    3. int XML_REMOVEATTRIBUTE_BYNAME xmlName, xpath(, doSetAll)\n    ```\n    从指定的 `XML` 中删除 `xpath` 选择的属性（详见 [`XPath` 的介绍](https://www.octoparse.jp/blog/xpath-introduction)）。当 `xpath` 的匹配结果存在多个时，必须将参数 `doSetAll` 设为 `0` 以外的数值才能成功删除属性。删除属性成功时，返回已删除属性的数量；失败时返回 `0`。\n\n    1.  从以 `xmlId` 的字符串转换结果([`TOSTR`](https://osdn.net/projects/emuera/wiki/exmeth#h5-str.20TOSTR.28int.20value.2C.20str.20format.20.3D.20.22.22.29))为 ID 而指定的 [`XmlDocument`](https://docs.microsoft.com/zh-cn/dotnet/api/system.xml.xmldocument?view=netframework-4.8) 中检索元素。若指定的 `XmlDocument` 不存在，返回 `-1`。\n    2. 从指定的 `xml` 内容中检索元素，并将新的结果重新赋值给 `xml`；`xml` 必须是变量。\n    3. 从以 `xmlName` 为 ID 而指定的 `XmlDocument` 中检索元素。若指定的 `XmlDocument` 不存在，返回 `-1`。\n\n    !!! warning \"注意\"\n\n        获取的 XML 不是真正的 `XmlNode` 节点实例，因此在 `xpath` 的开头使用「`//`」快捷表示方法并不会生效。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        #DIMS xml = \"<xml id='1' name='foo'/>\"\n\n        PRINTFORML {XML_REMOVEATTRIBUTE(xml, \"/xml/@id\")} -> %xml%\n\n        XML_DOCUMENT 0, xml\n        PRINTFORML {XML_REMOVEATTRIBUTE(0, \"/xml/@name\")} -> %XML_TOSTR(0)%\n\n        ONEINPUT\n    ```\n    ```text\n    1 -> <xml name=\"foo\" />\n    1 -> <xml />\n    ```"
  },
  {
    "id": "XML_REMOVENODE",
    "title": "XML_REMOVENODE 系列",
    "names": [
      "XML_REMOVENODE",
      "XML_REMOVENODE_BYNAME"
    ],
    "signatures": [
      {
        "name": "XML_REMOVENODE",
        "params": "`int`, `string`(, `int`)",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": [
          "`ref` `string`, `string`(, `int`)"
        ]
      },
      {
        "name": "XML_REMOVENODE_BYNAME",
        "params": "`string`, `string`(, `int`)",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      }
    ],
    "summary": "从指定的 XML 中删除（根节点除外）xpath 选择的节点（详见 XPath 的介绍）。",
    "body": "!!! info \"API\"\n\n    ```erb\n    1. int XML_REMOVENODE xmlId, xpath(, doSetAll)\n    2. int XML_REMOVENODE ref xml, xpath(, doSetAll)\n    3. int XML_REMOVENODE_BYNAME xmlName, xpath(, doSetAll)\n    ```\n    从指定的 `XML` 中删除（根节点除外）`xpath` 选择的节点（详见 [`XPath` 的介绍](https://www.octoparse.jp/blog/xpath-introduction)）。\n    当 `xpath` 的匹配结果存在多个时，必须将参数 `doSetAll` 设为 `0` 以外的数值才能成功删除节点。\n    删除节点成功时，返回已删除节点的数量；失败时返回 `0`。\n\n    1.  从以 `xmlId` 的字符串转换结果([`TOSTR`](https://osdn.net/projects/emuera/wiki/exmeth#h5-str.20TOSTR.28int.20value.2C.20str.20format.20.3D.20.22.22.29))为 ID 而指定的 [`XmlDocument`](https://docs.microsoft.com/zh-cn/dotnet/api/system.xml.xmldocument?view=netframework-4.8) 中检索元素。若指定的 `XmlDocument` 不存在，返回 `-1`。\n    2. 从指定的 `xml` 内容中检索元素，并将新的结果重新赋值给 `xml`；`xml` 必须是变量。\n    3. 从以 `xmlName` 为 ID 而指定的 `XmlDocument` 中检索元素。若指定的 `XmlDocument` 不存在，返回 `-1`。\n\n    !!! warning \"注意\"\n\n        获取的 XML 不是真正的 `XmlNode` 节点实例，因此在 `xpath` 的开头使用「`//`」快捷表示方法并不会生效。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        #DIMS xml = \"<xml><brother/><brother/><sister/></xml>\"\n\n        XML_DOCUMENT 0, xml\n        PRINTFORML {XML_REMOVENODE(xml, \"/xml/brother\", 1)} -> %xml%\n\n        PRINTFORML {XML_REMOVENODE(0, \"/xml/sister\", 1)}\n        PRINTSL XML_TOSTR(0)\n\n        ONEINPUT\n    ```\n    ```text\n    2 -> <xml><sister /></xml>\n    1\n    <xml><brother /><brother /></xml>\n    ```"
  },
  {
    "id": "XML_REPLACE",
    "title": "XML_REPLACE 系列",
    "names": [
      "XML_REPLACE",
      "XML_REPLACE_BYNAME"
    ],
    "signatures": [
      {
        "name": "XML_REPLACE",
        "params": "`any`, `string`",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": [
          "`int`, `string`, `string`(, `int`)",
          "`ref` `string`, `string`, `string`(, `int`)"
        ]
      },
      {
        "name": "XML_REPLACE_BYNAME",
        "params": "`string`, `string`, `string`(, `int`)",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      }
    ],
    "summary": "从指定的 XML 中将 xpath 选择的节点（详见 XPath 的介绍）替换为参数 newXml（新的 XML 文本）。当 xpath 的匹配结果存在多个时，必须将参数 doSetAll 设为 0 以外的数值才能成功更新节点。更新节点成功时，返回已更新节点的数量；失败时返回 0。",
    "body": "!!! info \"API\"\n\n    ```erb\n    1. int XML_REPLACE xmlId, newXml\n    2. int XML_REPLACE xmlId, xpath, newXml(, doSetAll)\n    3. int XML_REPLACE ref xml, xpath, newXml(, doSetAll)\n    4. int XML_REPLACE_BYNAME xmlName, xpath, newXml(, doSetAll)\n    ```\n    从指定的 `XML` 中将 `xpath` 选择的节点（详见 [`XPath` 的介绍](https://www.octoparse.jp/blog/xpath-introduction)）替换为参数 `newXml`（新的 XML 文本）。当 `xpath` 的匹配结果存在多个时，必须将参数 `doSetAll` 设为 `0` 以外的数值才能成功更新节点。更新节点成功时，返回已更新节点的数量；失败时返回 `0`。\n\n    1. 将 `xmlId` 指定的 [`XmlDocument`](https://docs.microsoft.com/zh-cn/dotnet/api/system.xml.xmldocument?view=netframework-4.8) 从根节点开始全部替换为 `newXml`。若指定的 `XmlDocument` 不存在，返回 `-1`。若 `xmlId` 为整数，则使用其字符串转换结果值([`TOSTR`](https://osdn.net/projects/emuera/wiki/exmeth#h5-str.20TOSTR.28int.20value.2C.20str.20format.20.3D.20.22.22.29))。\n    2. 从以 `xmlId` 的字符串转换结果(`TOSTR`)为 ID 而指定的 `XmlDocument` 中检索元素。若指定的 `XmlDocument` 不存在，返回 `-1`。\n    3. 从指定的 `xml` 内容中检索元素节点进行替换，并将新的结果重新赋值给 `xml`；`xml` 必须是变量。\n    4. 从以 `xmlName` 为 ID 而指定的 `XmlDocument` 中检索元素。若指定的 `XmlDocument` 不存在，返回 `-1`。\n\n    !!! warning \"注意\"\n\n        获取的 XML 不是真正的 `XmlNode` 节点实例，因此在 `xpath` 的开头使用「`//`」快捷表示方法并不会生效。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        #DIMS xml = \"<xml/>\"\n\n        XML_DOCUMENT 0, xml\n        PRINTFORML {XML_REPLACE(0, \"<xml><boy/></xml>\")} -> %XML_TOSTR(0)%\n        PRINTFORML {XML_REPLACE(0, \"/xml/boy\", \"<girl/>\")} -> %XML_TOSTR(0)%\n\n        ONEINPUT\n    ```\n    ```text\n    1 -> <xml><boy /></xml>\n    1 -> <xml><girl /></xml>\n    ```"
  },
  {
    "id": "XML_SET",
    "title": "XML_SET 系列",
    "names": [
      "XML_SET",
      "XML_SET_BYNAME"
    ],
    "signatures": [
      {
        "name": "XML_SET",
        "params": "`int`, `string`, `string`(, `int`, `int`)",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": [
          "`ref` `string`, `string`, `string`(, `int`, `int`)"
        ]
      },
      {
        "name": "XML_SET_BYNAME",
        "params": "`string`, `string`, `string`(, `int`, `int`)",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      }
    ],
    "summary": "从指定的 XML 中将 xpath 选择的节点（详见 XPath 的介绍）内容设为 value。当 xpath 的匹配结果存在多个时，必须将参数 doSetAll 设为 0 以外的数值才能成功更新节点。更新节点成功时，返回已更新节点的数量；失败时返回 0。",
    "body": "!!! info \"API\"\n\n    ```erb\n    1. int XML_SET xmlId, xpath, value(, doSetAll, outputType)\n    2. int XML_SET ref xml, xpath, value(, doSetAll, outputType)\n    3. int XML_SET_BYNAME xmlName, xpath, value(, doSetAll, outputType)\n    ```\n    从指定的 `XML` 中将 `xpath` 选择的节点（详见 [`XPath` 的介绍](https://www.octoparse.jp/blog/xpath-introduction)）内容设为 `value`。当 `xpath` 的匹配结果存在多个时，必须将参数 `doSetAll` 设为 `0` 以外的数值才能成功更新节点。更新节点成功时，返回已更新节点的数量；失败时返回 `0`。\n\n    1. 从以 `xmlId` 的字符串转换结果([`TOSTR`](https://osdn.net/projects/emuera/wiki/exmeth#h5-str.20TOSTR.28int.20value.2C.20str.20format.20.3D.20.22.22.29))为 ID 而指定的 [`XmlDocument`](https://docs.microsoft.com/zh-cn/dotnet/api/system.xml.xmldocument?view=netframework-4.8) 中检索元素节点进行更新。若指定的 `XmlDocument` 不存在，返回 `-1`。\n    2. 从指定的 `xml` 内容中检索元素节点进行更新，并将新的结果重新赋值给 `xml`；`xml` 必须是变量。\n    3. 从以 `xmlName` 为 ID 而指定的 `XmlDocument` 中检索元素节点进行更新。若指定的 `XmlDocument` 不存在，返回 `-1`。\n\n    根据参数 `outputType` 的值决定返回结果的类型：\n\n    - `1`: 节点的 `InnerText`\n    - `2`: 节点的 `InnerXml`\n    - 其他值或直接省略: 节点的 `Value`\n\n    !!! warning \"注意\"\n\n        获取的 XML 不是真正的 `XmlNode` 节点实例，因此在 `xpath` 的开头使用「`//`」快捷表示方法并不会生效。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        #DIMS xml = \"<test><file name='A.txt'>InnerText内容A</file><a>A</a></test>\"\n\n        ; 直接从字符串中检索节点\n        PRINTFORML 匹配结果数量：{XML_SET(xml, \"/test/*\", \"B\", 1, 1)}\n        PRINTSL xml\n        XML_DOCUMENT 0, xml\n\n        ; 从 XmlDocument 中检索节点\n        PRINTFORML 匹配结果数量：{XML_SET(0, \"/test/file/@name\", \"X.xml\")}\n        XML_GET 0, \"/test/file/@name\", 1\n        PRINTSL RESULTS\n\n        ONEINPUT\n    ```\n    ```text\n    匹配结果数量：2\n    <test><file name=\"A.txt\">B</file><a>B</a></test>\n    匹配结果数量：1\n    X.xml\n    ```"
  },
  {
    "id": "XML_TOSTR",
    "title": "XML_TOSTR",
    "names": [
      "XML_TOSTR"
    ],
    "signatures": [
      {
        "name": "XML_TOSTR",
        "params": "`any`",
        "returns": "`string`",
        "engines": [
          "em"
        ],
        "overloads": []
      }
    ],
    "summary": "以 XML 文本形式返回 xmlId 指定的 XmlDocument 中保存的内容。若 xmlId 为整数，则使用其字符串转换结果值(TOSTR)。",
    "body": "!!! info \"API\"\n\n    ```erb\n    string XML_TOSTR xmlId\n    ```\n    以 XML 文本形式返回 `xmlId` 指定的 [`XmlDocument`](https://docs.microsoft.com/zh-cn/dotnet/api/system.xml.xmldocument?view=netframework-4.8) 中保存的内容。若 `xmlId` 为整数，则使用其字符串转换结果值([`TOSTR`](https://osdn.net/projects/emuera/wiki/exmeth#h5-str.20TOSTR.28int.20value.2C.20str.20format.20.3D.20.22.22.29))。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n\n        XML_DOCUMENT 0, \"<xml/>\"\n\n        PRINTSL XML_TOSTR(0)\n\n        ONEINPUT\n    ```\n    ```text\n    <xml />\n    ```"
  }
];
