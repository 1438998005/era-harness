// 本文件由 scripts/build-reference.ts 生成，请勿手工修改。
//
// 数据来源：https://github.com/qirchen421/emuera.sk.doc  docs/Reference、docs/Emuera、docs/tutorial/*.zh.md
// 上游版本：41451be6091363e37ed066aaf04416decbf0127f
// 许可：CC BY-NC 4.0（http://creativecommons.org/licenses/by-nc/4.0/）
//       与本仓库代码的 Apache-2.0 分开管理，见 NOTICE-emuera-sk-doc.md
import type { ReferenceEntry } from '../types.js';

export const ENTRIES_PART_06: readonly ReferenceEntry[] = [
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
    "body": "!!! info \"API\"\n\n\t```erb\n\tint GGETPENWIDTH gID\n\t```\n\n\t返回  `gID` 代表的图像中 `GSETPEN` 所指定的画笔宽度。\n\n!!! warning \"Skia版注意\"\n\n\t`GCREATE` 后未调用 `GSETPEN` 就调用 `GGETPENWIDTH` 时，EM+EE 会抛出 NullReferenceException，而 Skia 版返回 `0`。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n\t```erb\n\t@SYSTEM_TITLE\n\t\tGCREATE 0, 100, 100\n\t\tGSETPEN 0, 0xFF00FF00, 5\n\n\t\tPRINTFORMW Color:{GGETPEN(0)}(%CONVERT(GGETPEN(0), 16)%) Width:{GGETPENWIDTH(0)}\n\t```\n\n\t```text\n\tColor:4278255360(ff00ff00) Width:5\n\t```\n\n### 相关项目\n- GSETPEN\n- GGETPENWIDTH",
    "sourcePath": "docs/Reference/GGETPENWIDTH.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    int GGETTEXTSIZE text, fontName, fontSize(, fontStyle)\n    ```\n\n    预测 `GDRAWTEXT` 使用指定的参数绘制时生成的 `Width` / `Height`（分别代入 `RESULT:0` / `RESULT:1`）。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。若使用行内函数形式需要另行处理 `RESULT:1`，因此推荐使用命令形式。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n\n        GGETTEXTSIZE \"USA\", \"Arial\", 150\n        PRINTFORML Width:{RESULT:0} Height:{RESULT:1}\n        GGETTEXTSIZE \"日本\", \"Arial\", 150\n        PRINTFORML Width:{RESULT:0} Height:{RESULT:1}\n        GGETTEXTSIZE \"USA\", \"ＭＳ Ｐゴシック\", 150\n        PRINTFORML Width:{RESULT:0} Height:{RESULT:1}\n        GGETTEXTSIZE \"日本\", \"ＭＳ Ｐゴシック\", 150\n        PRINTFORML Width:{RESULT:0} Height:{RESULT:1}\n        WAIT\n    ```\n\n    ```text\n    Width:308 Height:167\n    Width:330 Height:172\n    Width:281 Height:150\n    Width:300 Height:150\n    ```\n### 関連項目\n- GDRAWTEXT",
    "sourcePath": "docs/Reference/GGETTEXTSIZE.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tGOTO labelName\n\t$labelName\n    ```\n    跳转到函数内由`$`定义的标签处\n\n!!! hint \"提示\"\n\n    仅支持在指令中使用。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tPRINTL 1\n\t\tGOTO THREE\n\n\t\t$TWO\n\t\tPRINTL 2\n\t\tGOTO FIVE\n\n\t\t$THREE\n\t\tPRINTL 3\n\t\tGOTO TWO\n\n\t\t$FOUR\n\t\tPRINTL 4\n\t\tGOTO END\n\n\t\t$FIVE\n\t\tPRINTL 5\n\t\tGOTO FOUR\n\n\t\t$END\n\t\tPRINTW END\n    ```\n    ```text\n\t1\n\t3\n\t2\n\t5\n\t4\n\tEND\n    ```\n\n### 相关项目\n- GOTOFORM",
    "sourcePath": "docs/Reference/GOTO.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tint GROUPMATCH key, value...\n\tint NOSAMES value, value...\n\tint ALLSAMES value, value...\n    ```\n    所有参数必须是同一类型。\n    `GROUPMATCH` 返回第一个参数指定的值与第二个及后续参数中指定的值相匹配的总数。\n    `NOSAMES` 当所有参数指定的值都不同时返回 1，否则返回 0。\n    `ALLSAMES` 当所有参数指定的值都相同时返回 1，否则返回 0。\n\n!!! hint \"提示\"\n\n    该函数既可作为指令使用，也可在表达式中使用。\n\n### 相关项目\n- MATCH",
    "sourcePath": "docs/Reference/GROUPCHECK.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tint GSAVE gID, fileNo\n\tint GLOAD gID, fileNo\n    ```\n\t`GSAVE` 将指定 `gID` 的 `Graphics` 图像以 `png` 格式输出并保存，文件名带有 `fileNo` 编号。\n\t处理成功时，返回非 0 值。\n\n\t`GLOAD` 打开带有 `fileNo` 编号的文件名的图像，并创建 `Graphics`。\n\t其行为与 `GCREATEFORMFILE` 指令几乎相同，但区别在于它不是从 `resouces` 文件夹内的图像创建，而是从 `GSAVE` 指令保存的图像创建。\n\t处理成功时，返回非 0 值。\n\t如果指定 `gID` 的 `Graphics` 已经存在，则 `Graphics` 创建失败，此指令不执行任何操作并返回 0 后结束。\n\n!!! hint \"提示\"\n\n    同时支持指令和表达式函数两种形式。\n\n### 相关项目\n- GCREATE\n- GCREATEFROMFILE",
    "sourcePath": "docs/Reference/GSAVELOAD.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tint GSETBRUSH gID, cARGB\n    ```\n    为指定ID的Graphics对象设置指定颜色的画刷。\n    指定的画刷在Graphics对象被GDISPOSE命令销毁前会一直保持。\n    处理成功时返回非0值。\n    设置好的画刷颜色可以通过`GGETBRUSH`获取。\n    此处设置的画刷颜色将在以下命令/表达式中函数中使用：\n\n    - `GFILLRECTANGLE`\n\n!!! hint \"提示\"\n\n    同时支持命令形式和表达式函数形式。\n\n### 相关项目\n- GGETBRUSH\n- GFILLRECTANGLE",
    "sourcePath": "docs/Reference/GSETBRUSH.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tint GSETCOLOR gID, cARGB, x, y\n    ```\n    将指定ID的Graphics对象在指定位置的像素替换为指定颜色。\n    处理成功时，返回非0值。\n    此命令速度并不快。\n    尝试结合`GGETCOLOR`命令重写大尺寸图像的整个区域，将无法在实用时间内完成。\n\n!!! hint \"提示\"\n\n    同时支持指令和表达式函数形式。\n\n### 相关项目\n- GGETCOLOR",
    "sourcePath": "docs/Reference/GSETCOLOR.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tint GSETFONT gID, fontName, fontSize(, fontStyle)\n    ```\n\t为指定`gID`的`Graphics`对象设置指定名称和尺寸的字体。\n\t指定的字体将被记忆，直到使用`GDISPOSE`命令销毁该`Graphics`对象为止。\n\t处理成功时返回非0值。\n\t要获取已设置的字体名称和字体尺寸，请使用`GGETFONT`和`GGETFONTSIZE`。\n\tEM+EE版本中增加了可选的第四个参数。可以指定字体样式。使用与`SETFONT`相同的4位数值来指定。\n\tEM+EE版本中，现在也可以指定[`font`文件夹内的`ttf`、`otf`文件](../EMEE/EMEE_Summary.zh.md)。\n\t通过`GSETFONT`设置的字体将在以下命令/表达式中函数中使用。\n\n    - `GDRAWTEXT`\n\n!!! hint \"提示\"\n\n    该命令同时支持在命令和表达式函数中使用。\n\n### 相关项目\n- GDRAWTEXT\n- GGETFONT\n- GGETFONTSIZE\n- GGETFONTSTYLE",
    "sourcePath": "docs/Reference/GSETFONT.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tint GSETPEN gID, cARGB, penWidth\n    ```\n\t为指定`gID`的`Graphics`对象设置指定颜色和宽度的画笔。\n\t指定的画笔将被记忆，直到通过`GDISPOSE`命令销毁该`Graphics`对象为止。\n\t处理成功时返回非0值。\n\t要获取已设置的画笔颜色和画笔宽度，请分别使用`GGETPEN`和`GGETPENWIDTH`。\n\t通过`GSETPEN`设置的画笔颜色和宽度将用于以下命令/表达式函数：\n\n\t- `GDRAWTEXT`\n\t- `GDRAWLINE`\n\n!!! hint \"提示\"\n\n    同时支持命令形式和表达式函数形式。\n\n### 相关项目\n- GDRAWTEXT\n- GDRAWLINE\n- GGETPEN\n- GGETPENWIDTH",
    "sourcePath": "docs/Reference/GSETPEN.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tint GWIDTH gID\n\tint GHEIGHT gID\n    ```\n\t获取指定`gID`的`Graphics`的宽度或高度。\n\t如果`Graphics`尚未创建（包括已销毁的），则返回0。\n\n!!! hint \"提示\"\n\n    该函数同时支持指令和表达式函数两种使用方式。",
    "sourcePath": "docs/Reference/GWIDTHHEIGHT.zh.md"
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
    "body": "!!! info \"API\"\n\n\t```erb\n\tint HOTKEY_STATE keyCode(, state)\n\tint HOTKEY_STATE_INIT mode\n\t```\n\n\t管理快捷键状态的函数。\n\n\t- `HOTKEY_STATE`：设置指定键码的快捷键状态。省略 `state` 时默认为 `1`（启用）。始终返回 `0`。\n\t- `HOTKEY_STATE_INIT`：初始化快捷键状态。`mode` 指定为 `0` 时禁用所有快捷键，指定为 `1` 时读取 ERB 脚本中定义的快捷键设置。始终返回 `0`。\n\n\t!!! warning \"注意\"\n\n\t\t此函数为其他贡献者追加的扩展功能，标准版 Emuera 中不可用。",
    "sourcePath": "docs/Reference/HOTKEY_STATE.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    str HTML_ESCAPE, htmlString\n    ```\n    将目标字符串转义为HTML格式（转换为字符引用）。\n    要取消转义，请使用`HTML_TOPLAINTEXT`函数。\n\n!!! hint \"提示\"\n\n    同时支持指令和表达式函数两种形式。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tPRINTFORMW %HTML_ESCAPE(\"A&B<C>D'E\")%\n    ```\n    ```text\n\tA&amp;B&lt;C&gt;D&apos;E\n    ```\n\n### 相关项目\n- HTML_TOPLAINTEXT\n- ESCAPE",
    "sourcePath": "docs/Reference/HTML_ESCAPE.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    str HTML_GETPRINTEDSTR, lineNo\n    ```\n    获取已显示行中由`lineNo`指定行的内容，以HTML格式字符串形式返回。\n    行号计数方式与`LINECOUNT`或`CLEARLINE`指令相同。\n\n!!! hint \"提示\"\n\n    该函数同时支持指令形式和表达式函数形式。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\t#DIMS HOGES, 4\n\t\tFONTBOLD\n\t\tPRINTL AAA\n\t\tFONTITALIC\n\t\tPRINTL BBB\n\t\tFONTSTYLE 4\n\t\tPRINTL CCC\n\t\tFONTSTYLE 0\n\t\tFONTREGULAR\n\n\t\tREPEAT 4\n\t\t\tHOGES:COUNT = %HTML_GETPRINTEDSTR(COUNT)%\n\t\tREND\n\t\tREPEAT 4\n\t\t\tPRINTFORML %HOGES:COUNT%\n\t\tREND\n\n\t\tWAIT\n    ```\n\t![](../assets/images/HTML_GETPRINTEDSTR.png)\n\n### 相关项目\n- GETDISPLAYLINE",
    "sourcePath": "docs/Reference/HTML_GETPRINTEDSTR.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tstring HTML_POPPRINTINGSTR\n    ```\n    获取当前 `PRINT` 中处于换行等待状态的字符串缓冲区的 HTML 格式内容，并清空缓冲区。\n    由于不包含 `p` 标签，因此 `ALIGNMENT` 指令设置的 `align` 属性不会生效。\n\n!!! hint \"提示\"\n\n    该函数同时支持在指令和表达式中使用。\n\n!!! example \"示例\"\n\n    ```erb\n\t@SYSTEM_TITLE\n\t#DIMS HOGES\n\t\tFONTBOLD\n\t\tPRINT AAA\n\t\tFONTITALIC\n\t\tPRINT BBB\n\t\tFONTSTYLE 4\n\t\tPRINT CCC\n\t\tFONTSTYLE 0\n\t\tFONTREGULAR\n\n\t\tHOGES = %HTML_POPPRINTINGSTR()%\n\t\tPRINTL DDD\n\n\t\tPRINTFORMW %HOGES%\n    ```\n    ```text\n\tDDD\n\t<b>AAA</b><i><b>BBB</b></i><s>CCC</s>\n    ```",
    "sourcePath": "docs/Reference/HTML_POPPRINTINGSTR.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tHTML_PRINT htmlStyleString\n    ```\n\t这是一个使用类似HTML标签进行`PRINT`的命令。\n\t其参数不是像`PRINT`那样的字符串，而是与`PRINTS`相同的字符串表达式，并且会自动换行，因此其行为实际上更接近`PRINTSL`。（在EM+EE版本中，添加了不换行的选项）\n\t`HTML_PRINT`的绘制不受`ALIGNMENT`、`SETFONT`、`SETCOLOR`、`FONTSTYLE`命令及其类似命令的影响。\n\t要获得这些效果，必须全部通过标签来指定。\n\t详情请参阅[`HTML_PRINT`相关](../Emuera/HTML_PRINT.zh.md)。\n\n!!! hint \"提示\"\n\n    仅支持作为命令使用。\n\n### 相关项目\n- [HTML_PRINT相关](../Emuera/HTML_PRINT.zh.md)",
    "sourcePath": "docs/Reference/HTML_PRINT.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    HTML_PRINT_ISLAND htmlStyleString\n    ```\n    其标签语法与 `HTML_PRINT` 相同，但不依赖于行信息。\n    由于不依赖于行信息，与普通的 `PRINT` 指令不同，无论滚动多少都不会消失。\n    详情请参阅 [`HTML_PRINT` 相关](../Emuera/HTML_PRINT.zh.md) 文档。\n\n!!! hint \"提示\"\n\n    仅支持指令形式。",
    "sourcePath": "docs/Reference/HTML_PRINT_ISLAND.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    HTML_PRINTC htmlString {, cellWidth}\n    HTML_PRINTLC htmlString {, cellWidth}\n    ```\n\n    `HTML_PRINT` 的右对齐和左对齐变体。使用 HTML 标签进行渲染，但对齐位置不同。\n\n    - **HTML_PRINTC**：将 HTML 渲染结果**右对齐**显示。\n    - **HTML_PRINTLC**：将 HTML 渲染结果**左对齐**显示。\n\n    第二参数 `cellWidth` 为可选的整数表达式，指定单元格宽度（像素）。省略时使用 `PrintCLength * FontSize / 2` 的默认值。\n\n    与 `HTML_PRINT` 相同，不受 `ALIGNMENT`、`SETFONT`、`SETCOLOR`、`FONTSTYLE` 命令的影响。对齐方式由命令本身控制。\n\n    详细信息请参阅 [`HTML_PRINT` 相关](../Emuera/HTML_PRINT.zh.md)。\n\n    !!! warning \"注意\"\n        - 仅支持命令语法，不支持表达式调用。\n        - 参数与 `PRINTS` 相同，为字符串表达式。自动换行。\n\n!!! hint \"提示\"\n\n    仅命令语法可用。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n        ; 右对齐的 HTML 渲染\n        HTML_PRINTC \"<b>右对齐文本</b>\"\n\n        ; 左对齐的 HTML 渲染\n        HTML_PRINTLC \"<b>左对齐文本</b>\"\n\n        ; 指定单元格宽度（200像素）\n        HTML_PRINTC \"<b>右对齐文本</b>\", 200\n\n        ; 普通 HTML_PRINT（遵循 ALIGNMENT 设置）\n        HTML_PRINT \"<b>默认对齐</b>\"\n    ```\n\n### 相关项\n- HTML_PRINT\n- [HTML_PRINT相关](../Emuera/HTML_PRINT.zh.md)",
    "sourcePath": "docs/Reference/HTML_PRINTC.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    int HTML_STRINGLEN html(, returnPixel)\n    ```\n\n    `HTML_PRINT` 返回 `html` 渲染结果的宽度，有多行的情况下则返回第一行宽度。\n    `returnPixel` 值为 `0` 或省略时返回值为半角字符的长度（数量），否则返回宽度占用的像素数量。\n\n    !!! warning \"注意\"\n\n        只要没有用`<nobr></nobr>`标签包围，无论文字多长，返回的数值都不会超过「窗口宽度-滚动条宽度」。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n\n        PRINTFORML {HTML_STRINGLEN(\"<b>B</b>\")}\n        PRINTFORML {HTML_STRINGLEN(\"<b>B</b>\", 1)} {GETCONFIG(\"フォントサイズ\")/2}\n\n        ONEINPUT\n    ```\n    ```text\n    2\n    9 8\n    ```\n    因为粗体比常规字体宽。\n\n### 相关项目\n- STRLEN",
    "sourcePath": "docs/Reference/HTML_STRINGLEN.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    int HTML_STRINGLINES html, width\n    ```\n\n    `html` 在 `HTML_PRINT` 中打印的结果，按 `width`（半角字符数）分割后的行数。\n\n!!! hint \"提示\"\n\n    同时支持指令和表达式函数。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\n        PRINTVL HTML_STRINGLINES(\"AB<b>CD</b>\",4)\n\n        ONEINPUT\n    ```\n    ```text\n    2\n    ```\n    因为粗体比普通字体更宽。",
    "sourcePath": "docs/Reference/HTML_STRINGLINES.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    string HTML_SUBSTRING html, width\n    ```\n\n    使用 `HTML_PRINT` 命令打印 `html` 时，返回不超过 `width`（半角字符数量）的部分。\n\n    截取部分赋值给 `RESULTS:0`（与返回值相同），剩余部分赋值给 `RESULTS:1`。\n    截取时会自动闭合未关闭的标签，剩余部分会自动重开被闭合的标签。\n\n    !!! warning \"注意\"\n\n        `v8b` 开始将返回值从整数型(固定为 `1`)更改为字符串型(与 `RESULTS:0` 相同)。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n\n        PRINTSL HTML_SUBSTRING(\"AB<b>CD</b>EFG\",4)\n        PRINTSL RESULTS:1\n\n        ONEINPUT\n    ```\n    ```text\n    AB<b>C</b>\n    <b>D</b>EFG\n    ```\n    因为粗体比常规字体宽。\n\n    ```erb\n    ; 用 HTML_SUBSTRING 逐行分割（自动处理标签配对）\n    #DIMS L_REMAIN\n    #DIMS L_LINE\n    #DIM L_LINE_CNT\n\n    L_REMAIN '= HTML_CONTENT\n    L_LINE_CNT = 0\n    WHILE STRLENS(L_REMAIN) > 0\n        L_LINE '= HTML_SUBSTRING(L_REMAIN, L_WIDTH)\n        L_LINES:L_LINE_CNT '= L_LINE\n        L_LINE_CNT += 1\n        L_REMAIN '= RESULTS:1\n    WEND\n    ```\n\n### 相关项目\n- SUBSTRING",
    "sourcePath": "docs/Reference/HTML_SUBSTRING.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tHTML_TAGSPLIT string(, integerVariable, stringVariable)\n    ```\n\n\t将目标字符串解释为HTML字符串，分割为标签和纯文本，并将分割数量赋值给`RESULT`，分割后的字符串赋值给`RESULTS`。\n\t如果指定了第二、第三个参数，则赋值给指定的变量，而不是`RESULT`和`RESULTS`。\n\t分割处理过程中发生错误时，会将-1赋值给RESULT。\n\t`HTML_TAGSPLIT`不会验证标签内容或对应关系的正确性。\n\t如果分割数量超过`RESULTS`数组的大小，超出部分将不会被赋值到`RESULTS`中。\n\n!!! hint \"提示\"\n\n    仅支持指令形式。\n\n!!! example \"例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tHTML_TAGSPLIT \"<p align='right'>あ<!--comment-->い<font color='red'>う</font></p>\"\n\t\tREPEAT 8\n\t\t\tPRINTFORML RESULTS:{COUNT} = %RESULTS:COUNT%\n\t\tREND\n\t\tPRINTFORML RESULT = {RESULT}\n\t\tWAIT\n    ```\n    ```text\n\tRESULTS:0 = <p align='right'>\n\tRESULTS:1 = あ\n\tRESULTS:2 = <!--comment-->\n\tRESULTS:3 = い\n\tRESULTS:4 = <font color='red'>\n\tRESULTS:5 = う\n\tRESULTS:6 = </font>\n\tRESULTS:7 = </p>\n\tRESULT = 8\n\n    ```\n\n### 相关项目\n- SPLIT",
    "sourcePath": "docs/Reference/HTML_TAGSPLIT.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tstr HTML_TOPLAINTEXT, string\n    ```\n\t将目标HTML字符串转换为纯文本。\n\t具体来说，会删除字符串中的HTML标签并展开字符引用。\n\n!!! hint \"提示\"\n\n    该函数同时支持指令和表达式内函数两种使用方式。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tPRINTFORMW %HTML_TOPLAINTEXT(\"<b>AAA</b><i><b>BBB</b></i><s>CCC</s>\")%\n    ```\n    ```text\n\tAAABBBCCC\n    ```",
    "sourcePath": "docs/Reference/HTML_TOPLAINTEXT.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tIF operand(int)\n\tELSEIF operand(int)\n\tELSE\n\tENDIF\n\tSIF operand(int)\n    ```\n    `SIF` 在条件表达式成立时，执行下一行。不成立时，则跳过下一行。\n    `IF` 在条件表达式成立时，执行从下一行开始直到遇到 `ELSEIF`、`ELSE`、`ENDIF` 为止的代码，然后跳转到 `ENDIF` 所在行。不成立时，则跳过直到遇到 `ELSEIF`、`ELSE`、`ENDIF` 为止的代码。\n    `ELSEIF` 在其条件表达式成立时，执行从下一行开始直到遇到 `ELSEIF`、`ELSE` 或 `ENDIF` 为止的代码，然后跳转到 `ENDIF` 所在行。如果不成立，则跳过直到遇到下一个 `ELSEIF`、`ELSE` 或 `ENDIF` 为止的代码，并重复此过程。\n    `ELSE` 则执行从下一行开始直到遇到 `ENDIF` 为止的代码。`ELSE` 必须跟在 `ELSEIF` 之后执行，并且 `ELSE` 之后必须是 `ENDIF`。\n    条件表达式严格来说是 `int` 类型，0 视为不成立，非 0 视为成立。\n\n!!! hint \"提示\"\n\n    仅支持命令形式\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t#DIM CONST TRUE = 1\n\t#DIM CONST FALSE = 0\n\t\tIF TRUE\n\t\t\tPRINTL IF=TRUE\n\t\tELSE\n\t\t\tPRINTL Can not reach here\n\t\tENDIF\n\n\t\tIF FALSE\n\t\t\tPRINTL Can not reach here\n\t\tELSEIF TRUE\n\t\t\tPRINTL ELSEIF=TRUE\n\t\tELSE\n\t\t\tPRINTL Can not reach here\n\t\tENDIF\n\n\t\tIF FALSE\n\t\t\tPRINTL Can not reach here\n\t\tELSEIF FALSE\n\t\t\tPRINTL Can not reach here\n\t\tELSE\n\t\t\tPRINTL Reached ELSE\n\t\tENDIF\n\n\t\tWAIT\n    ```\n    ```text\n\tNow Loading...\n\tIF=TRUE\n\tELSEIF=TRUE\n\tReached ELSE\n    ```\n\n### 相关项目\n- SELECTCASE",
    "sourcePath": "docs/Reference/IF.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    INPUT (defaultValue, canClick, allowSkip)\n    INPUTS (defaultValue, canClick, allowSkip)\n    ```\n    等待输入，`INPUT`将输入的数字赋值给`RESULT`，`INPUTS`将输入的字符串赋值给`RESULTS`\n    若设置了第一个参数，则在未输入任何内容时，将默认值赋值给各变量\n    作为EE的附加功能，接受中键点击，与通常的左键点击同等处理。中键点击时，`RESULT:1`中将被置入3\n\n    当设置了第二个参数时，将鼠标点击视作回车键（将空字符串赋值给RESULTS，按下按钮时将按钮索引赋值给RESULTS:1），左键点击时RESULT:1设为1，右键点击时RESULT:1设为2，中键点击时RESULT:1设为3。同时按下Shift、Ctrl、Alt键时，将按键状态保存到RESULT:2中（位16、17、18）。\n\n    当设置了第三个参数时，在右键点击等跳过过程中不进行输入等待，但会应用默认值。如果与上述\"INPUT系列接受鼠标点击\"功能一起使用，则分别将值赋给RESULT:1和RESULTS:1，如果不一起使用，则按常规方式赋值给RESULT:0及...\n\n!!! hint \"提示\"\n\n    仅支持命令形式。\n\n### 相关项目\n- TINPUTNF\n- TINPUT\n- INPUTMOUSEKEY\n- BINPUT\n- INPUTANY\n- REUSELASTLINE",
    "sourcePath": "docs/Reference/INPUT.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tINPUTANY\n    ```\n\n\t同时接受整数和字符串输入的 `INPUT` 命令\n\t执行时也接受用鼠标点击 `PRINTBUTTON` 以及 `[{int}]` 的输入\n\t整数型的输入保存进 `RESULT`，字符串类型的输入保存进 `RESULTS` 中\n\n!!! hint \"提示\"\n\n\t只能作为命令中使用。\n\n!!! example \"示例代码\"\n\n    ```erb\n\t@SYSTEM_TITLE\n\n\tPRINTL [0] 输入0\n\tPRINTL [1] 输入1\n\tPRINTBUTTON \"[A] 输入A\", \"A\"\n\tPRINTL\n\n\tINPUTANY\n\n\tPRINTFORMW 输入结果为\\@ RESULTS != \"\" ? %RESULTS% # {RESULT} \\@\n\n    ```\n    ```text\n\t[0] 输入0\n\t[1] 输入1\n\t[A] 输入A\n\t1\n\t输入结果为1\n    ```\n\n    ```text\n\t[0] 输入0\n\t[1] 输入1\n\t[A] 输入A\n\tA\n\t输入结果为A\n    ```",
    "sourcePath": "docs/Reference/INPUTANY.zh.md"
  },
  {
    "id": "INPUTMOUSEKEY",
    "title": "INPUTMOUSEKEY",
    "names": [
      "INPUTMOUSEKEY"
    ],
    "signatures": [
      {
        "name": "INPUTMOUSEKEY",
        "params": "`int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "INPUTMOUSEKEY 指令用于直接识别鼠标或键盘的输入。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tINPUTMOUSEKEY timeLimit\n    ```\n    `INPUTMOUSEKEY` 指令用于直接识别鼠标或键盘的输入。\n    参数以毫秒为单位指定执行超时处理前的等待时间，类似于 `TINPUT`。\n    如果省略参数或指定了 0 或负数，则不会执行超时处理。\n    此指令可以识别 `ONEINPUT` 等指令无法捕获的功能键、方向键、PageUp 键等作为输入。\n    另一方面，在此指令等待输入期间，无法使用 ESC 键或右键的跳过功能、宏功能以及其他功能，仅能接收按下 ESC 键等的结果。\n    此外，此指令不执行任何 `PRINT` 处理，包括超时显示等。\n    如果需要实现跳过功能或显示输入内容等，需要在 ERB 侧进行相应处理。\n    通过在第一参数中指定以毫秒为单位的数值，将执行超时处理。`INPUTMOUSEKEY` 的返回值最多有 6 个，分别赋值给 `RESULT:0`、`RESULT:1`、`RESULT:2`、`RESULT:3`、`RESULT:4`、`RESULT:5`。\n\n        RESULT:0 == 1; 检测到鼠标按下\n        　RESULT:1 ;鼠标按钮 - 左0x100000、右键 0x200000、中0x400000。对应 C# 的 System.WindowForms.MouseButtons 枚举的整数值\n        　RESULT:2 ;鼠标 X 坐标 以客户端的左下角为基准。始终为正值。\n        　RESULT:3 ;鼠标 Y 坐标 以客户端的左下角为基准。始终为负值。\n        　RESULT:4 ;当 CBGSETBMAP 已执行点击坐标正下方的颜色不透明度为 0xF时，返回颜色的 0xRRGGBB 值。否回 -1。\n        　RESULT:5 ;被点击按钮的值\n        RESULT:0 == 2; 检测到鼠标滚轮滚动\n        　RESULT:1 ;滚轮量\n        　RESULT:2 ;鼠标 X 坐标\n        　RESULT:3 ;鼠标 Y 坐标\n        RESULT:0 == 3; 检测到键盘按下\n        　RESULT:1 ;被按下键的代码。不包饰键代码（Alt、Ctrl、Shift）。于 KeyCode。对应 C# 的 SysteWindows.Forms.Keys 枚举的整数值\n        　RESULT:2 ;被按下键的代码。包含键代码。相当于 KeyData\n        RESULT:0 == 4; 因超时而结束\n\n<!-- 关于鼠标按钮，请参考 _VirtualKey.ERH 中的 MB_LEFT 到 MB_MIDDLE；关于键码，请参考 _VirtualKey.ERH 中的 VK_~。 -->\n键码与 `GETKEY` 函数通用。\n请注意，鼠标滚轮的滚动量不是 1 或 -1，而是至少为 120 等较大的值。\n此外，当光标位于 Emuera 窗口外时，滚轮是否被检测到取决于 Windows 的设置，Emuera 端无法更改。\n在默认设置下，Windows 8.1 及更早版本会检测到，但在 Windows 10 中，窗口外的滚轮似乎不会被检测到。\n\n!!! hint \"提示\"\n\n    仅支持指令。\n\n### 相关项目\n- INPUT",
    "sourcePath": "docs/Reference/INPUTMOUSEKEY.zh.md"
  },
  {
    "id": "INRANGEARRAY",
    "title": "INRANGEARRAY, INRANGECARRAY",
    "names": [
      "INRANGEARRAY",
      "INRANGECARRAY"
    ],
    "signatures": [
      {
        "name": "INRANGEARRAY",
        "params": "`integerArray`, `int`, `int`(, `int`, `int`)",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "INRANGECARRAY",
        "params": "`charaArray`, `int`, `int`(, `int`, `int`)",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "INRANGEARRAY 返回指定数组中，值满足 minValue <= value < maxValue 的元素数量。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint INRANGEARRAY integerArray, minValue, maxValue(, start, end)\n\tint INRANGEARRAY charaArray, minValue, maxValue(, start, end)\n    ```\n\t`INRANGEARRAY` 返回指定数组中，值满足 `minValue <= value < maxValue` 的元素数量。\n\t`INRANGECARRAY` 返回指定角色数组中，值满足 `minValue <= value < maxValue` 的元素数量。\n\n!!! hint \"提示\"\n\n    同时支持作为指令和表达式函数使用。",
    "sourcePath": "docs/Reference/INRANGEARRAY.zh.md"
  },
  {
    "id": "ISACTIVE",
    "title": "ISACTIVE",
    "names": [
      "ISACTIVE"
    ],
    "signatures": [
      {
        "name": "ISACTIVE",
        "params": "无",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "返回 Emuera 窗口的状态。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tISACTIVE\n    ```\n\t返回 Emuera 窗口的状态。\n\t如果窗口处于活动状态则返回 1，否则返回 0。\n\n!!! hint \"提示\"\n\n    该函数既可作为指令使用，也可在表达式中使用。",
    "sourcePath": "docs/Reference/ISACTIVE.zh.md"
  },
  {
    "id": "ISDEFINED",
    "title": "ISDEFINED",
    "names": [
      "ISDEFINED"
    ],
    "signatures": [
      {
        "name": "ISDEFINED",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      }
    ],
    "summary": "如果定义了与macroName同名的宏(#DEFINE XXX)，则返回1。如果没有定义，则返回0。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int ISDEFINED macroName\n    ```\n\n    如果定义了与`macroName`同名的宏(`#DEFINE XXX`)，则返回`1`。如果没有定义，则返回`0`。\n\n!!! hint \"提示\"\n\n    支持指令和表达式内函数两种方式。\n\n!!! example \"示例\"\n\n    ```erb\n    #DEFINE 体力 0\n    #DEFINE 气力 1\n    ```\n    ```erb\n    @SYSTEM_TITLE\n        #DIM 角色数据, 2 = 1000, 200\n\n        PRINTFORML {ISDEFINED(\"体力\")} {角色数据:体力}\n        PRINTFORML {ISDEFINED(\"气力\")} {角色数据:气力}\n        PRINTFORML {ISDEFINED(\"攻击力\")}\n\n        ONEINPUT\n    ```\n    ```text\n    1 1000\n    1 200\n    0\n    ```\n\n### 相关项目\n- [函数・预处理器>表示特殊块的行>\\[IF XXX\\]](../Emuera/function.md#if-xxxelseif-xxxelseendif)\n- [动态解析与反射](../tutorial/dynamic-reflection.zh.md) — ISDEFINED 属于第三代\"变量存在检查\"",
    "sourcePath": "docs/Reference/ISDEFINED.zh.md"
  },
  {
    "id": "JUMP",
    "title": "JUMP",
    "names": [
      "JUMP"
    ],
    "signatures": [
      {
        "name": "JUMP",
        "params": "`functionName`",
        "returns": "`void`¹",
        "engines": [
          "eramaker"
        ],
        "overloads": []
      }
    ],
    "summary": "以 @ 开头的字符串定义的函数",
    "body": "!!! info \"API\"\n\n    ```erb\n\tJUMP functionName\n    ```\n    以 `@` 开头的字符串定义的函数\n    当到达函数末端或执行 `RETURN` 时，结束函数\n    与 `CALL` 的区别在于，执行时不会将函数压入栈，因此即使跳转到的函数结束也不会返回。所以，如果没有调用栈，可能会导致错误终止\n\n    ¹ `void` 表示指令本身不返回值，但 JUMP 目标函数中的 `RETURN` 仍会设置 `RESULT`。详见下方「JUMP 与 RESULT 的关系」。\n\n!!! hint \"提示\"\n\n    仅支持指令。\n\n!!! info \"JUMP 与 RESULT 的关系\"\n\n    JUMP 目标函数中执行 `RETURN` 时，`RESULT` 会正常设置。JUMP 只是替换栈帧，不影响 `RETURN` 设置 `RESULT` 的行为。\n\n    JUMP 目标函数结束时，`Return()` 会检测到 `IsJump` 标志，**递归地回退栈帧**，直到回到最初的非 JUMP 调用方（如 `CALL`）。JUMP 链（A→JUMP B→JUMP C→RETURN）中 RESULT 也能正确设置。\n\n    ```erb\n    @SYSTEM_TITLE\n        CALL AAA\n        PRINTVL RESULT    ; 42（BBB 的 RETURN 42 设置了 RESULT）\n\n    @AAA\n        JUMP BBB          ; AAA 被 BBB 替换\n        PRINTL 不可达     ; 不会执行\n\n    @BBB\n        RETURN 42         ; RESULT = 42，递归回退到 SYSTEM_TITLE\n    ```\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tPRINTL CALL to AAA\n\t\tCALL AAA\n\n\t\tPRINTW Backed SYSTEM_TITLE\n\n\t\t@AAA\n\t\tPRINTL JUMP to BBB\n\t\tJUMP BBB\n\n\t\tPRINTL Can not reach here\n\n\t\t@BBB\n\t\tPRINTL Exit BBB\n\t\tRETURN\n    ```\n    ```text\n\tCALL to AAA\n\tJUMP to BBB\n\tExit BBB\n\tBacked SYSTEM_TITLE\n    ```\n\n### 相关项目\n- JUMPFORM\n- TRYJUMPFORM\n- TRYCJUMP",
    "sourcePath": "docs/Reference/JUMP.zh.md"
  },
  {
    "id": "LINEISEMPTY",
    "title": "LINEISEMPTY",
    "names": [
      "LINEISEMPTY"
    ],
    "signatures": [
      {
        "name": "LINEISEMPTY",
        "params": "无",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "判断当前正在PRINT的行是否为空行的指令。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint LINEISEMPTY\n    ```\n    判断当前正在`PRINT`的行是否为空行的指令。\n    在执行此指令时，如果尝试执行`PRINTL`的结果将只是一个空行，则向`RESULT:0`赋值或返回`1`，否则赋值或返回`0`。\n    在使用`PRINTC`系列指令根据条件依次排列按钮时，最后使用此指令可以判断是否有要显示的按钮，如果没有，则可以执行专用的显示处理。\n\n!!! hint \"提示\"\n\n    同时支持作为指令和表达式函数使用。",
    "sourcePath": "docs/Reference/LINEISEMPTY.zh.md"
  },
  {
    "id": "LOADCHARA",
    "title": "LOADCHARA",
    "names": [
      "LOADCHARA"
    ],
    "signatures": [
      {
        "name": "LOADCHARA",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "第一个参数指定要加载数据的文件名（的一部分）。实际的文件名将是chara_*.dat。",
    "body": "!!! info \"API\"\n\n    ```erb\n    LOADCHARA filename\n    ```\n    第一个参数指定要加载数据的文件名（的一部分）。实际的文件名将是`chara_*.dat`。\n    如果读取失败，则向`RESULT:0`赋值`0`；如果成功，则赋值`1`。\n    在`LOADCHARA`之前，应使用`CHKCHARADATA`函数检查文件的适用性。\n    `LOADCHARA`会根据SAVE中保存的角色数量，注册相应数量的新角色。\n    因此，不会影响已存在的注册角色。\n    要了解添加了多少名角色，请比较加载前后的`CHARANUM`值。\n\n!!! hint \"提示\"\n\n    仅支持指令形式。\n\n### 相关项目\n- SAVECHARA\n- CHKCHARADATA",
    "sourcePath": "docs/Reference/LOADCHARA.zh.md"
  },
  {
    "id": "LOADDATA",
    "title": "LOADDATA",
    "names": [
      "LOADDATA"
    ],
    "signatures": [
      {
        "name": "LOADDATA",
        "params": "`int`",
        "returns": "无",
        "engines": [
          "emuera",
          "em"
        ],
        "overloads": []
      }
    ],
    "summary": "加载由 saveID 指定编号的文件数据。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tLOADDATA saveID\n    ```\n\t加载由 `saveID` 指定编号的文件数据。\n\t如果加载失败，将导致错误终止。\n\t请务必先使用 `CHKDATA` 指令检查是否可以加载，然后再执行此操作。\n\t`LOADDATA`（与 `LOADGAME` 指令不同）可以在脚本的任何位置调用。\n\n!!! info \"EM+EE 扩展：存档格式增强\"\n\n    EM+EE 扩展了 `LOADDATA` 的加载行为，在加载标准存档数据之前，会先清除当前内存中的 EM 专属数据：\n\n    - **Map 数据**：标记为 `SAVEDATA` 关键字的 `MAP` 字典会被清空\n    - **Xml 数据**：标记为 `SAVEDATA` 关键字的 XML 文档会被移除\n    - **DataTable 数据**：标记为 `SAVEDATA` 关键字的 DataTable 表会被清空\n\n    清除后，从存档中恢复对应的 EM 专属数据，确保存档切换时数据一致性。\n    这意味着如果存档中不包含某些 EM 专属数据，加载后这些数据将不存在（而非保留加载前的值）。\n\n!!! hint \"提示\"\n\n    仅支持指令形式。\n\n### 相关项目\n- SAVEDATA\n- CHKDATA",
    "sourcePath": "docs/Reference/LOADDATA.zh.md"
  },
  {
    "id": "LOADGLOBAL",
    "title": "LOADGLOBAL",
    "names": [
      "LOADGLOBAL"
    ],
    "signatures": [
      {
        "name": "LOADGLOBAL",
        "params": "无",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "加载 GLOBAL 与 GLOBALS。保存目标文件为 global.sav。",
    "body": "!!! info \"API\"\n\n    ```erb\n    LOADGLOBAL\n    ```\n    加载 `GLOBAL` 与 `GLOBALS`。保存目标文件为 `global.sav`。\n    即使加载失败也不会引发错误。\n    加载成功时，将 `1` 赋值给 `RESULT`；失败时，将 `0` 赋值给 `RESULT`。\n    与普通的存档数据类似，在 `gamebase.csv` 中设置的 [`代码、版本`](../Emuera/variables.md#gamebasecsv) 不正确的文件将无法加载。\n    关于变量 `GLOBAL` 的详细信息，请参阅变量章节。\n\n!!! hint \"提示\"\n\n    仅支持作为指令使用。\n\n### 相关项目\n- SAVEGLOBAL\n- [常量·变量>存档间共享的变量](../Emuera/variables.md#_8)",
    "sourcePath": "docs/Reference/LOADGLOBAL.zh.md"
  },
  {
    "id": "LOADTEXT",
    "title": "LOADTEXT",
    "names": [
      "LOADTEXT",
      "LOCALS"
    ],
    "signatures": [
      {
        "name": "LOADTEXT",
        "params": "`int`(, `int`, `int`)",
        "returns": "`string`",
        "engines": [
          "emuera",
          "em"
        ],
        "overloads": []
      }
    ],
    "summary": "LOADTEXT 命令版本会读取 textXX.sav 文件并将其结果赋值给 RESULTS:0。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tLOADTEXT fileNo{, force_savdir, int force_UTF8}\n    ```\n\t`LOADTEXT` 命令版本会读取 `textXX.sav` 文件并将其结果赋值给 `RESULTS:0`。\n\t若指定第二个参数为非 0，则无论选项如何，都会在 sav 文件夹内寻找文件。\n\t若指定第三个参数为非 0，则会以 UTF-8 编码格式读取文件。\n\t如果失败，`RESULTS:0` 将变为空字符串。\n\t也存在同名的表达式中函数，它不操作 `RESULTS:0`，而是将读取结果或空字符串作为返回值返回。\n\n!!! info \"EM+EE 扩展：字符串路径重载\"\n\n    ```erb\n\tLOADTEXT filePath\n    ```\n    当第一个参数为**字符串**时，将其作为文件路径加载。这是 EM+EE 新增的参数类型重载，提供更灵活的文件读取能力：\n\n    - 路径为相对于 `Emuera.exe` 的相对路径，`..` 无效\n    - 只能使用由设置界面或 `Emuera.config` 中「LOADTEXTとSAVETEXTで使える拡張子」项目所允许的扩展名（默认为仅 `txt`）\n    - 如果指定的扩展名不在允许列表中，**直接返回空字符串**（不会自动改为 `.txt`，与 SAVETEXT 行为不同）\n    - 使用字符串路径时，**自动检测文件编码**（忽略 `force_UTF8` 参数）\n    - 读取结果中的 `\\r` 会被自动移除\n\n    ```text\n    LOADTEXTとSAVETEXTで使える拡張子:txt,xml,json\n    ```\n\n    ```erb\n    ; 标准用法：按编号从 sav 文件夹加载\n    LOADTEXT 0\n\n    ; EM+EE 扩展：按路径从自定义位置加载\n    LOCALS = %LOADTEXT(\"plugins/config.json\")%\n    ```\n\n!!! hint \"提示\"\n\n    该功能同时支持作为命令和表达式函数使用。\n\n### 相关项目\n- SAVETEXT",
    "sourcePath": "docs/Reference/LOADTEXT.zh.md"
  },
  {
    "id": "MAP_ENHANCED",
    "title": "MAP 扩展操作函数",
    "names": [
      "MAP_MERGE",
      "MAP_REMOVEIF",
      "MAP_FINDKEY",
      "MAP",
      "MAP_ENHANCED"
    ],
    "signatures": [
      {
        "name": "MAP_MERGE",
        "params": "`string`, `string`",
        "returns": "`int`",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "MAP_REMOVEIF",
        "params": "`string`, `string`, `string`",
        "returns": "`int`",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "MAP_FINDKEY",
        "params": "`string`, `string`, `string`",
        "returns": "`string`",
        "engines": [
          "skia"
        ],
        "overloads": []
      }
    ],
    "summary": "Skia（SkiaSharp版）新增的 MAP 扩展操作函数。提供批量合并、条件删除、条件查找功能。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int MAP_MERGE destMapName, srcMapName\n    int MAP_REMOVEIF mapName, matchValue, mode\n    string MAP_FINDKEY mapName, matchValue, mode\n    ```\n\n    Skia（SkiaSharp版）新增的 `MAP` 扩展操作函数。提供批量合并、条件删除、条件查找功能。\n\n    - `MAP_MERGE`：将 `srcMapName` 的所有键值对合并到 `destMapName`。同名 key 的值会被源 MAP 覆盖。成功返回 `1`，任一 MAP 不存在返回 `0`。\n    - `MAP_REMOVEIF`：根据 `mode` 指定的匹配模式，批量删除符合条件的键值对。返回实际删除的数量，无效模式返回 `-1`。\n    - `MAP_FINDKEY`：根据 `mode` 指定的匹配模式，查找符合条件的 key，返回逗号分隔的 key 列表。`RESULT` 设置为匹配数量。\n\n    **匹配模式**（`MAP_REMOVEIF` 和 `MAP_FINDKEY` 共用）：\n\n    | 模式 | 说明 |\n    | :--- | :--- |\n    | `\"KEY_CONTAINS\"` | key 包含 matchValue |\n    | `\"KEY_PREFIX\"` | key 以 matchValue 开头 |\n    | `\"KEY_SUFFIX\"` | key 以 matchValue 结尾 |\n    | `\"VAL_CONTAINS\"` | value 包含 matchValue |\n    | `\"VAL_EQ\"` | value 等于 matchValue |\n\n    `MAP_REMOVEIF` 额外支持的模式：\n\n    | 模式 | 说明 |\n    | :--- | :--- |\n    | `\"VAL_NE\"` | value 不等于 matchValue |\n\n    !!! note \"MAP_FINDKEY 与 MAP_REMOVEIF 的区别\"\n        `MAP_FINDKEY` 不支持 `\"VAL_NE\"` 模式（查找\"不等于\"意义不大，且结果可能过多）。`MAP_FINDKEY` 只查找不删除，`MAP_REMOVEIF` 查找并删除。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        ; === MAP_MERGE ===\n        MAP_CREATE \"baseDB\"\n        MAP_SET \"baseDB\", \"name\", \"无名\"\n        MAP_SET \"baseDB\", \"level\", \"1\"\n\n        MAP_CREATE \"overrideDB\"\n        MAP_SET \"overrideDB\", \"name\", \"勇者\"\n        MAP_SET \"overrideDB\", \"class\", \"战士\"\n\n        MAP_MERGE \"baseDB\", \"overrideDB\"\n        PRINTFORML 合并后: %MAP_TOSTRING(\"baseDB\")%\n\n        ; === MAP_FINDKEY ===\n        MAP_CREATE \"itemDB\"\n        MAP_SET \"itemDB\", \"sword\", \"铁剑\"\n        MAP_SET \"itemDB\", \"potion_hp\", \"药水\"\n        MAP_SET \"itemDB\", \"potion_mp\", \"药水\"\n        MAP_SET \"itemDB\", \"shield\", \"木盾\"\n\n        LOCALS = MAP_FINDKEY(\"itemDB\", \"potion_\", \"KEY_PREFIX\")\n        PRINTFORML potion_ 前缀的键: %LOCALS% (共{RESULT}个)\n\n        LOCALS = MAP_FINDKEY(\"itemDB\", \"药水\", \"VAL_CONTAINS\")\n        PRINTFORML 值含\"药水\"的键: %LOCALS% (共{RESULT}个)\n\n        ; === MAP_REMOVEIF ===\n        MAP_CREATE \"tempDB\"\n        MAP_SET \"tempDB\", \"a\", \"1\"\n        MAP_SET \"tempDB\", \"b\", \"2\"\n        MAP_SET \"tempDB\", \"c\", \"1\"\n        MAP_SET \"tempDB\", \"d\", \"3\"\n\n        LOCAL = MAP_REMOVEIF(\"tempDB\", \"1\", \"VAL_EQ\")\n        PRINTFORML 删除了 {LOCAL} 个值为1的条目\n        PRINTFORML 剩余: %MAP_TOSTRING(\"tempDB\")%\n\n        ; === 清理 ===\n        MAP_RELEASE \"baseDB\"\n        MAP_RELEASE \"overrideDB\"\n        MAP_RELEASE \"itemDB\"\n        MAP_RELEASE \"tempDB\"\n\n        ONEINPUT\n    ```\n    ```text\n    合并后: name=勇者,level=1,class=战士\n    potion_ 前缀的键: potion_hp,potion_mp (共2个)\n    值含\"药水\"的键: potion_hp,potion_mp (共2个)\n    删除了 2 个值为1的条目\n    剩余: b=2,d=3\n    ```\n\n### 相关项目\n- MAP管理\n- MAP操作\n- MAP键值获取\n- MAP序列化",
    "sourcePath": "docs/Reference/MAP_ENHANCED.zh.md"
  },
  {
    "id": "MAP_GETKEYS",
    "title": "MAP_GETKEYS / MAP_VALUES",
    "names": [
      "MAP_GETKEYS",
      "MAP_VALUES"
    ],
    "signatures": [
      {
        "name": "MAP_GETKEYS",
        "params": "`string`",
        "returns": "`string`",
        "engines": [
          "em"
        ],
        "overloads": [
          "`string`, `int`",
          "`string`, `ref` `string[]`, `int`"
        ]
      },
      {
        "name": "MAP_VALUES",
        "params": "`string`",
        "returns": "`string`",
        "engines": [
          "skia"
        ],
        "overloads": [
          "`string`, `int`",
          "`string`, `ref` `string[]`, `int`"
        ]
      }
    ],
    "summary": "输出 MAP（键值对映射数组，或称「字典」，Dictionary<string,string>）中保存的键名（key）或值（value）。",
    "body": "!!! info \"API\"\n\n    ```erb\n    1. string MAP_GETKEYS, mapName\n    2. string MAP_GETKEYS, mapName, doOutput\n    3. string MAP_GETKEYS, mapName, ref outputArray, doOutput\n    4. string MAP_VALUES, mapName\n    5. string MAP_VALUES, mapName, doOutput\n    6. string MAP_VALUES, mapName, ref outputArray, doOutput\n    ```\n\n    输出 `MAP`（键值对映射数组，或称「字典」，[`Dictionary<string,string>`](https://docs.microsoft.com/zh-cn/dotnet/api/system.collections.generic.dictionary-2?view=netframework-4.8)）中保存的键名（key）或值（value）。\n\n    - `MAP_GETKEYS`：输出 `MAP` 的所有键名。\n    - `MAP_VALUES`：Skia（SkiaSharp版）新增。输出 `MAP` 的所有值。与 `MAP_GETKEYS` 对称。\n\n    1. 返回形如 `键名1,键名2,键名3,...` 的字符串。如果指定的 `MAP` 不存在，则返回空字符串。不会抛出异常，如有需要请使用 `MAP_EXIST` 提前进行检查。\n    2. 参数 `doOutput` 为 `0` 以外的数值时，将获取到的键名（或值）依次保存到 `RESULTS`，返回 `RESULTS:0`；并将获取到的 `MAP` 大小保存到 `RESULT`。\n    3. 参数 `doOutput` 为 `0` 以外的数值时，将获取到的键名（或值）依次保存到字符串数组 `outputArray`，返回空字符串。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        #DIM i\n        #DIMS keys, 5\n\n        MAP_CREATE \"MyMap\"\n        FOR i, 0, 5\n            MAP_SET \"MyMap\", TOSTR(i*100), \"\"\n        NEXT\n        PRINTSL MAP_GETKEYS(\"MyMap\")\n        PRINTSL MAP_GETKEYS(\"MyMap\", 1)\n        FOR i, 0, 5\n            PRINTFORML RESULTS:[%RESULTS:i%] key:[%keys:i%]\n        NEXT\n        VARSET RESULTS\n        PRINTSL MAP_GETKEYS(\"MyMap\", keys, 1)\n        FOR i, 0, 5\n            PRINTFORML RESULTS:[%RESULTS:i%] key:[%keys:i%]\n        NEXT\n\n        ONEINPUT\n    ```\n    ```text\n    0,100,200,300,400\n    0\n    RESULTS:[0] key:[]\n    RESULTS:[100] key:[]\n    RESULTS:[200] key:[]\n    RESULTS:[300] key:[]\n    RESULTS:[400] key:[]\n\n    RESULTS:[] key:[0]\n    RESULTS:[] key:[100]\n    RESULTS:[] key:[200]\n    RESULTS:[] key:[300]\n    RESULTS:[] key:[400]\n    ```\n\n### 相关项目\n- MAP操作",
    "sourcePath": "docs/Reference/MAP_GETKEYS.zh.md"
  },
  {
    "id": "MAP_MANAGE",
    "title": "MAP 管理相关函数",
    "names": [
      "MAP_CREATE",
      "MAP_EXIST",
      "MAP_RELEASE",
      "MAP",
      "MAP_MANAGE"
    ],
    "signatures": [
      {
        "name": "MAP_CREATE",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      },
      {
        "name": "MAP_EXIST",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      },
      {
        "name": "MAP_RELEASE",
        "params": "`string`",
        "returns": "`1`",
        "engines": [
          "em"
        ],
        "overloads": []
      }
    ],
    "summary": "创建 / 删除 / 判断是否存在 MAP（键值对映射数组，或称「字典」，Dictionary<string,string>）的一系列函数。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int MAP_CREATE mapName\n    int MAP_EXIST mapName\n    1 MAP_RELEASE mapName\n    ```\n\n    创建 / 删除 / 判断是否存在 `MAP`（键值对映射数组，或称「字典」，[`Dictionary<string,string>`](https://docs.microsoft.com/zh-cn/dotnet/api/system.collections.generic.dictionary-2?view=netframework-4.8)）的一系列函数。\n\n    - `MAP_CREATE`：生成名为 `mapName` 的 `MAP`。\n        如果已经存在名为 `mapName` 的 `MAP`（创建失败），返回 `0`；若创建成功，返回 `1`。\n    - `MAP_EXIST`：判断是否存在名为 `mapName` 的 `MAP`，若存在，返回 `1`；否则返回 `0`。\n    - `MAP_RELEASE`：删除名为 `mapName` 的 `MAP`。\n\n    !!! warning \"注意\"\n\n        关于生成的 `MAP` 保存进存档文件请参考「`XML`、`MAP`、`DataTable` 保存功能」。「タイトル画面へ戻る（返回标题界面）」或 [`RESETDATA`](https://osdn.net/projects/emuera/wiki/excom#h5-RESETDATA) 后会自动删除。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        PRINTFORML MAP「MyMap」是否存在：{MAP_EXIST(\"MyMap\")}\n        MAP_CREATE \"MyMap\"\n        PRINTSL RESULT ? \"创建成功\" # \"已经存在\"\n        MAP_CREATE \"MyMap\"\n        PRINTSL RESULT ? \"创建成功\" # \"已经存在\"\n\n        RESETDATA ; 自动删除所有 MAP\n\n        MAP_CREATE \"MyMap\"\n        PRINTSL RESULT ? \"创建成功\" # \"已经存在\"\n        PRINTFORML MAP「MyMap」是否存在：{MAP_EXIST(\"MyMap\")}\n        MAP_RELEASE \"MyMap\"\n        PRINTFORML MAP「MyMap」是否存在：{MAP_EXIST(\"MyMap\")}\n\n        ONEINPUT\n    ```\n    ```text\n    MAP「MyMap」是否存在：0\n    创建成功\n    已经存在\n    创建成功\n    MAP「MyMap」是否存在：1\n    MAP「MyMap」是否存在：0\n    ```\n\n### 相关项目\n- MAP操作",
    "sourcePath": "docs/Reference/MAP_MANAGE.zh.md"
  },
  {
    "id": "MAP_OPERATION",
    "title": "MAP 操作相关函数",
    "names": [
      "MAP_GET",
      "MAP_HAS",
      "MAP_SET",
      "MAP_REMOVE",
      "MAP_SIZE",
      "MAP_CLEAR",
      "MAP",
      "MAP_OPERATION"
    ],
    "signatures": [
      {
        "name": "MAP_GET",
        "params": "`string`, `string`",
        "returns": "`string`",
        "engines": [
          "em"
        ],
        "overloads": []
      },
      {
        "name": "MAP_HAS",
        "params": "`string`, `string`",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      },
      {
        "name": "MAP_SET",
        "params": "`string`, `string`, `string`",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      },
      {
        "name": "MAP_REMOVE",
        "params": "`string`, `string`",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      },
      {
        "name": "MAP_SIZE",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      },
      {
        "name": "MAP_CLEAR",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      }
    ],
    "summary": "操作已保存的 MAP（键值对映射数组，或称「字典」，Dictionary<string,string>）的一系列函数。",
    "body": "!!! info \"API\"\n\n    ```erb\n    string MAP_GET mapName, key\n    int MAP_HAS mapName, key\n    int MAP_SET mapName, key, value\n    int MAP_REMOVE mapName, key\n    int MAP_SIZE mapName\n    int MAP_CLEAR mapName\n    ```\n\n    操作已保存的 `MAP`（键值对映射数组，或称「字典」，[`Dictionary<string,string>`](https://docs.microsoft.com/zh-cn/dotnet/api/system.collections.generic.dictionary-2?view=netframework-4.8)）的一系列函数。\n\n    - `MAP_GET`：在名为 `mapName` 的 `MAP` 中取出 `key` 对应的值。指定的 `MAP` 不存在，或没有找到该 `key` 时，返回空字符串。不会抛出异常，如有需要请使用 `MAP_HAS` / `MAP_EXIST` 提前进行检查。\n    - `MAP_HAS`：判断名为 `mapName` 的 `MAP` 中是否存在指定的 `key`。如果存在，返回 `1`，否则返回 `0`。若指定的 `MAP` 本身就不存在，返回 `-1`。\n    - `MAP_SET`：在名为 `mapName` 的 `MAP` 中覆写 `key` 对应的值（`value`）；若指定的 `key` 不存在，自动添加 `key`；成功设置新值后返回 `1`。若指定的 `MAP` 本身就不存在，返回 `-1`。\n    - `MAP_REMOVE`：在名为 `mapName` 的 `MAP` 中删除 `key` 对应的键值对，返回 `1`。若指定的 `MAP` 本身就不存在，返回 `-1`。\n    - `MAP_SIZE`：返回名为 `mapName` 的 `MAP` 中保存的键值对数量。若指定的 `MAP` 本身就不存在，返回 `-1`。\n    - `MAP_CLEAR`：删除名为 `mapName` 的 `MAP` 中保存的所有键值对，返回 `1`。若指定的 `MAP` 本身就不存在，返回 `-1`。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n\n        MAP_CREATE \"MyMap\"\n        PRINTFORML 「MyMap」的大小：{MAP_SIZE(\"MyMap\")}\n        MAP_SET \"MyMap\", \"Id\", \"username\"\n        MAP_SET \"MyMap\", \"PassWord\", \"123456\"\n        PRINTFORML ID：%MAP_GET(\"MyMap\", \"Id\")% Password：%MAP_GET(\"MyMap\", \"PassWord\")%\n        PRINTFORML Name?:{MAP_HAS(\"MyMap\", \"Name\")}\n        PRINTFORML 「MyMap」的大小：{MAP_SIZE(\"MyMap\")}\n        MAP_CLEAR \"MyMap\"\n        PRINTFORML 「MyMap」的大小：{MAP_SIZE(\"MyMap\")}\n\n        ONEINPUT\n    ```\n    ```text\n    「MyMap」的大小：0\n    ID：username Password：123456\n    Name?:0\n    「MyMap」的大小：2\n    「MyMap」的大小：0\n    ```\n\n### 相关项目\n- MAP生成",
    "sourcePath": "docs/Reference/MAP_OPERATION.zh.md"
  },
  {
    "id": "MAP_SERIALIZATION",
    "title": "MAP 序列化相关函数",
    "names": [
      "MAP_TOXML",
      "MAP_FROMXML",
      "MAP_TOSTRING",
      "MAP_FROMSTRING",
      "MAP",
      "MAP_SERIALIZATION"
    ],
    "signatures": [
      {
        "name": "MAP_TOXML",
        "params": "`string`",
        "returns": "`string`",
        "engines": [
          "em"
        ],
        "overloads": []
      },
      {
        "name": "MAP_FROMXML",
        "params": "`string`, `string`",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      },
      {
        "name": "MAP_TOSTRING",
        "params": "`string`(, `string`, `string`)",
        "returns": "`string`",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "MAP_FROMSTRING",
        "params": "`string`, `string`(, `string`, `string`)",
        "returns": "`int`",
        "engines": [
          "skia"
        ],
        "overloads": []
      }
    ],
    "summary": "将 MAP（键值对映射数组，或称「字典」，Dictionary<string,string>）与 XML 或字符串互相转换的函数。想把 MAP 的内容保存到文件（数据持久化）的时候可以使用。",
    "body": "!!! info \"API\"\n\n    ```erb\n    1. string MAP_TOXML, mapName\n    2. int MAP_FROMXML, mapName, xmlMap\n    3. string MAP_TOSTRING, mapName{, sep, kvSep}\n    4. int MAP_FROMSTRING, mapName, data{, sep, kvSep}\n    ```\n\n    将 `MAP`（键值对映射数组，或称「字典」，[`Dictionary<string,string>`](https://docs.microsoft.com/zh-cn/dotnet/api/system.collections.generic.dictionary-2?view=netframework-4.8)）与 `XML` 或字符串互相转换的函数。想把 `MAP` 的内容保存到文件（数据持久化）的时候可以使用。\n\n    - `MAP_TOXML`：将名为 `mapName` 的 `MAP` 转换为 `XML`，返回转换后的 XML 文本。\n    - `MAP_FROMXML`：解析对应格式的 `XML` 并将内容读取到名为 `mapName` 的 `MAP` 中。\n    - `MAP_TOSTRING`：Skia（SkiaSharp版）新增。将名为 `mapName` 的 `MAP` 序列化为 `key=value` 格式的字符串。`sep` 为条目分隔符（默认 `\",\"`），`kvSep` 为键值分隔符（默认 `\"=\"`）。例如：`\"k1=v1,k2=v2,k3=v3\"`。\n    - `MAP_FROMSTRING`：Skia（SkiaSharp版）新增。将 `MAP_TOSTRING` 序列化的字符串反序列化到 `MAP` 中。`sep` 和 `kvSep` 含义与 `MAP_TOSTRING` 相同。按第一个 `kvSep` 分割键和值，空条目或无 `kvSep` 的条目会被跳过。\n\n    `XML` 必须为如下格式：\n    ``` xml\n    <map>\n        <p><k>键名1</k><v>值1</v></p>\n        <p><k>键名2</k><v>值2</v></p>\n        <p><k>键名2</k><v>值3</v></p>\n        ....\n    </map>\n    ```\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        #DIM i\n        #DIMS xml\n\n        MAP_CREATE \"MyMap\"\n        FOR i, 0, 3\n            MAP_SET \"MyMap\", TOSTR(i), TOSTR(i*100)\n        NEXT\n        xml '= MAP_TOXML(\"MyMap\")\n        PRINTSL xml\n\n        MAP_CLEAR \"MyMap\"\n        FOR i, 0, 3\n            MAP_SET \"MyMap\", TOSTR(i), TOSTR(i)\n            PRINTFORML MyMap[\"%TOSTR(i)%\"] = %MAP_GET(\"MyMap\", TOSTR(i))%\n        NEXT\n        PRINTL\n\n        MAP_FROMXML \"MyMap\", xml\n        FOR i, 0, 3\n            PRINTFORML MyMap[\"%TOSTR(i)%\"] = %MAP_GET(\"MyMap\", TOSTR(i))%\n        NEXT\n\n        ONEINPUT\n    ```\n    ```text\n    <map><p><k>0</k><v>0</v></p><p><k>1</k><v>100</v></p><p><k>2</k><v>200</v></p></map>\n    MyMap[\"0\"] = 0\n    MyMap[\"1\"] = 1\n    MyMap[\"2\"] = 2\n\n    MyMap[\"0\"] = 0\n    MyMap[\"1\"] = 100\n    MyMap[\"2\"] = 200\n    ```",
    "sourcePath": "docs/Reference/MAP_SERIALIZATION.zh.md"
  }
];
