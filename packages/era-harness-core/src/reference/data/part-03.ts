// 本文件由 scripts/build-reference.ts 生成，请勿手工修改。
//
// 数据来源：https://github.com/qirchen421/emuera.sk.doc  docs/Reference/*.zh.md
// 上游版本：606670cd78b58f5d9a050013d1d3f41db5a87a1b
// 许可：CC BY-NC 4.0（http://creativecommons.org/licenses/by-nc/4.0/）
//       与本仓库代码的 Apache-2.0 分开管理，见 NOTICE-emuera-sk-doc.md
import type { ReferenceEntry } from '../types.js';

export const ENTRIES_PART_03: readonly ReferenceEntry[] = [
  {
    "id": "EXISTFUNCTION",
    "title": "EXISTFUNCTION",
    "names": [
      "EXISTFUNCTION"
    ],
    "signatures": [
      {
        "name": "EXISTFUNCTION",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "判定是否定义过以参数 funcName 为名的函数 / 行内函数。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int EXISTFUNCTION funcName\n    ```\n\n    判定是否定义过以参数 `funcName` 为名的函数 / 行内函数。\n    常规函数（命令）返回 `1`，行内函数（数值型）返回 `2`，行内函数（字符串型）返回 `3`，其他情况返回 `0`。\n    如果在 ERB 中覆写过系统函数，返回 `1`，否则也返回 `0`。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n\n        PRINTVL EXISTFUNCTION(\"TEST1\")\n        PRINTVL EXISTFUNCTION(\"TEST2\")\n        PRINTVL EXISTFUNCTION(\"TEST3\")\n        PRINTVL EXISTFUNCTION(\"SYSTEM_TITLE\")\n        PRINTVL EXISTFUNCTION(\"SHOP\")\n        WAIT\n\n    @TEST1\n\n    @TEST2\n    #FUNCTION\n\n    @TEST3\n    #FUNCTIONS\n    ```\n\n    ```text\n    1\n    2\n    3\n    1\n    0\n    ```\n\n### 相关项目\n- ENUMFUNC"
  },
  {
    "id": "EXISTMETH",
    "title": "EXISTMETH",
    "names": [
      "EXISTMETH"
    ],
    "signatures": [
      {
        "name": "EXISTMETH",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "etc"
        ],
        "overloads": []
      }
    ],
    "summary": "检查是否存在指定的表达式中函数，如果是#FUNCTION则返回1，如果是#FUNCTIONS则返回2，否则返回0。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint EXISTMETH functionName\n    ```\n\t检查是否存在指定的表达式中函数，如果是`#FUNCTION`则返回1，如果是`#FUNCTIONS`则返回2，否则返回0。\n\n!!! hint \"提示\"\n\n    该函数同时支持命令和表达式中函数。\n\n### 相关项目\n- EXISTFUNCTION\n- GETMETH,GETMETHS"
  },
  {
    "id": "EXISTSIMAGELAYER",
    "title": "EXISTSIMAGELAYER",
    "names": [
      "EXISTSIMAGELAYER"
    ],
    "signatures": [
      {
        "name": "EXISTSIMAGELAYER",
        "params": "`int`",
        "returns": "`int`",
        "engines": [
          "skia"
        ],
        "overloads": []
      }
    ],
    "summary": "检测指定 depth 的 SETIMAGELAYER 图层是否存在。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int EXISTSIMAGELAYER(depth)\n    ```\n\n    检测指定 `depth` 的 `SETIMAGELAYER` 图层是否存在。\n\n    **参数**：\n\n    | 参数 | 类型 | 说明 |\n    | :--- | :--- | :--- |\n    | `depth` | int | 图层深度值 |\n\n    **返回值**：存在返回 1，不存在返回 0。\n\n!!! hint \"提示\"\n\n    支持命令和表达式函数两种形式。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n        SETIMAGELAYER \"pet_1\", 1\n\n        IF EXISTSIMAGELAYER(1)\n            PRINTL depth=1 的图层已存在\n        ELSE\n            PRINTL depth=1 的图层不存在\n        ENDIF\n\n        ; 作为表达式使用\n        #DIM L_COUNT\n        FOR L_COUNT, 1, 5\n            PRINTVL EXISTSIMAGELAYER(L_COUNT)\n        NEXT\n    ```\n    ```text\n    depth=1 的图层已存在\n    1\n    0\n    0\n    0\n    ```\n\n### 相关项\n- SETIMAGELAYER\n- CLEARIMAGELAYER"
  },
  {
    "id": "EXISTSOUND",
    "title": "EXISTSOUND",
    "names": [
      "EXISTSOUND"
    ],
    "signatures": [
      {
        "name": "EXISTSOUND",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "判断音频资源目录 ./sound/ 中是否存在参数 MediaFile 指定的音频文件；存在返回 1，不存在返回 0。",
    "body": "!!! info \"API\"\n\n\t```erb\n\tEXISTSOUND MediaFile\n\t```\n\n\t判断音频资源目录 `./sound/` 中是否存在参数 `MediaFile` 指定的音频文件；存在返回 `1`，不存在返回 `0`。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n### 相关项目\n- PLAYSOUND\n- PLAYBGM"
  },
  {
    "id": "EXISTVAR",
    "title": "EXISTVAR",
    "names": [
      "EXISTVAR"
    ],
    "signatures": [
      {
        "name": "EXISTVAR",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      }
    ],
    "summary": "如果存在与 varName 同名的变量 / 常量则返回对应的正整数，否则返回 0。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int EXISTVAR varName\n    ```\n\n    如果存在与 `varName` 同名的变量 / 常量则返回对应的正整数，否则返回 `0`。\n\n    - 为整数类型时，返回值 setbit 1\n    - 为字符串类型时，返回值 setbit 2\n    - 为常量类型时，返回值 setbit 3\n    - 为二维数组时，返回值 setbit 4\n    - 为三维数组时，返回值 setbit 5\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    #DIM CONST BIT = 0, 1, 1p1, 1p2, 1p3, 1p4, 1p5, 1p6, 1p7\n    ```\n    ```erb\n    @SYSTEM_TITLE\n        #DIM 角色数据, 2, 2\n        #DIMS 名字\n\n        ; 「角色数据」为二维整数类型数组 setbit 1、4\n        PRINTFORML {EXISTVAR(\"角色数据\")} {BIT:1|BIT:4} ; 0b1001 == 1 + 8\n        ; 「BIT」为整数类型数组常量 setbit 1、3\n        PRINTFORML {EXISTVAR(\"BIT\")} {BIT:1|BIT:3} ; 0b0101 == 1 + 4\n        ; 「名字」为字符串类型变量 setbit 2\n        PRINTFORML {EXISTVAR(\"名字\")} {BIT:2} ; 0b0010 == 2\n        ; 当前不存在名为「性别」的变量或常量\n        PRINTFORML {EXISTVAR(\"性别\")} ; 「性别」声明于另一个函数(Foo)的作用域\n\n        ONEINPUT\n\n    @Foo\n        #DIMS 性别\n    ```\n    ```text\n    9 9\n    5 5\n    2 2\n    0\n    ```\n\n### 相关项目\n- ENUMVAR\n- [动态解析与反射](../tutorial/dynamic-reflection.zh.md) — EXISTVAR 属于第三代\"变量存在检查\""
  },
  {
    "id": "FIND_CHARADATA",
    "title": "FIND_CHARADATA",
    "names": [
      "FIND_CHARADATA"
    ],
    "signatures": [
      {
        "name": "FIND_CHARADATA",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "在 dat 文件夹中搜索可以作为 LOADCHARA 目标的文件，并将文件名（chara.dat 中的  部分）代入 RESULTS。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint FIND_CHARADATA filename\n    ```\n    在 dat 文件夹中搜索可以作为 `LOADCHARA` 目标的文件，并将文件名（`chara_*.dat` 中的 `*` 部分）代入 `RESULTS`。\n    返回值是命中数（找到的文件数）。\n    参数可以指定 `chara_*.dat` 中的 `*` 部分。\n    例如，`FIND_CHARADATA(\"*あなた*\")` 会搜索 `chara_*あなた*.dat`，`chara_001あなた.dat` 和 `chara_あなたABC.dat` 会被命中。\n    省略参数时，相当于指定了 `*`，会搜索 `chara_*.dat`。\n    另外，`chara_.dat`（`*` 为空字符串）无法通过 `LOADCHARA` 指定，因此不会被命中。\n    如果命中数超过 `RESULTS` 的元素数量，不会报错，但超出部分的文件名不会被代入。\n\n!!! hint \"提示\"\n\n    命令和表达式函数均支持。\n\n### 相关项目\n- SAVECHARA\n- LOADCHARA\n- CHKCHARADATA"
  },
  {
    "id": "FINDCHARA",
    "title": "FINDCHARA, FINDLASTCHARA",
    "names": [
      "FINDCHARA",
      "FINDLASTCHARA",
      "X",
      "WHILE",
      "SIF",
      "BREAK",
      "PRINTFORML",
      "WEND"
    ],
    "signatures": [
      {
        "name": "FINDCHARA",
        "params": "`charaVariable`, `int`(, `int`, `int`)",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "FINDLASTCHARA",
        "params": "`charaVariable`, `int`(, `int`, `int`)",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "FINDCHARA 指令通过指定角色变量和值，返回变量等于该值的角色的登记编号 (CharaID)。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint FINDCHARA charaVariable, value(, startID, endID)\n\tint FINDLASTCHARA charaVariable, value(, startID, endID)\n    ```\n\t`FINDCHARA` 指令通过指定角色变量和值，返回变量等于该值的角色的登记编号 (CharaID)。\n\t如果找到多个匹配项，`FINDCHARA` 返回第一个命中的角色，\n\t`FINDLASTCHARA` 返回最后一个命中的角色。如果未找到，则返回 `-1`。\n\t此外，通过指定第 3 个参数可以指定搜索的起始位置，指定第 4 个参数可以指定搜索的结束位置。\n\t但是，如果搜索范围超出角色数量的范围，将会导致错误。\n\n    ```erb\n\tX = -1\n\tWHILE 1\n\t\tFINDCHARA CFLAG:10, 123, X + 1\n\t\tX = RESULT\n\t\tSIF X < 0\n\t\t\tBREAK\n\t\tPRINTFORML %NAME:X%\n\tWEND\n\t```\n\n\t上述脚本会列出所有`CFLAG:10`为`123`的角色。\n\n!!! hint \"提示\"\n\n    该功能同时支持命令形式和函数形式。\n\n### 相关项目\n- GETCHARA — 按模板编号查找角色\n- [动态解析与反射](../tutorial/dynamic-reflection.zh.md) — FINDCHARA 属于第一代\"固定映射\""
  },
  {
    "id": "FINDELEMENT",
    "title": "FINDELEMENT",
    "names": [
      "FINDELEMENT",
      "FINDLASTELEMENT",
      "FINDLASTEELEMENT"
    ],
    "signatures": [
      {
        "name": "FINDELEMENT",
        "params": "`variable`, `value`(, `int`, `int`, `int`)",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "FINDLASTELEMENT",
        "params": "`variable`, `value`(, `int`, `int`, `int`)",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "此函数用于从数组的指定范围内查找特定元素的位置。",
    "body": "!!! info \"API\"\n\n    ```erb\n    FINDELEMENT variableName, value(, startIndex, endIndex, completeMatch)\n    FINDLASTEELEMENT variableName, value(, startIndex, endIndex, completeMatch)\n    ```\n    此函数用于从数组的指定范围内查找特定元素的位置。\n    `value` 的类型必须与 `variableName` 相同。\n    如果在 `startIndex` 和 `endIndex` 指定的数组元素搜索范围内，存在与 `value` 指定内容相同的元素，则返回其位置。\n    如果省略 `endIndex`，则搜索范围将覆盖到数组的最后一个元素。\n    如果存在多个匹配项，`FINDELEMENT` 返回第一个匹配项的位置，\n    `FINDLASTELEMENT` 返回最后一个匹配项的位置。如果没有匹配项，则返回 `-1`。\n    如果搜索目标是字符串类型，则可以像 `REPLACE` 一样使用正则表达式。\n    `completeMatch` 仅在搜索目标是字符串类型时有效，如果为 `0`，则允许部分字符串匹配；\n    如果为非 `0` 值，则要求字符串完全匹配。\n\n    `variableName` 中只能指定一维数组变量，不能指定多维数组。\n    如果在 `variableName` 中指定了 CFLAG 等角色数组，则仅对指定的角色进行计数。\n\n!!! hint \"提示\"\n\n    该功能同时支持指令和表达式函数。"
  },
  {
    "id": "FLOWINPUT",
    "title": "FLOWINPUT,FLOWINPUTS",
    "names": [
      "FLOWINPUT",
      "FLOWINPUTS"
    ],
    "signatures": [
      {
        "name": "FLOWINPUT",
        "params": "`int`(, `int`, `int`, `int`)",
        "returns": "`void`",
        "engines": [
          "ee"
        ],
        "overloads": []
      },
      {
        "name": "FLOWINPUTS",
        "params": "`int`(, `string`)",
        "returns": "`void`",
        "engines": [
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "为流程中的 INPUT（例如在 @SHOW_SHOP 内）添加默认值、是否允许左键点击以及是否允许跳过等选项。",
    "body": "!!! info \"API\"\n\n\t```erb\n\tFLOWINPUT default(, AllowLeftClick, AllowSkip, ForceSkip)\n\tFLOWINPUTS toggle(, default)\n\t```\n\n\t为流程中的 INPUT（例如在 `@SHOW_SHOP` 内）添加默认值、是否允许左键点击以及是否允许跳过等选项。\n\t以下是各选项的引用说明：\n\n\t```\n\t`INPUT`, `INPUTS`, `ONEINPUT`, `ONEINPUTS` 新增第二参数（整数类型，可省略，默认值为 `0`）\n\n    `TINPUT`, `TINPUTS`, `TONEINPUT`, `TONEINPUTS` 新增第五参数（整数类型，可省略，默认值为 `0`）\n\n    - 追加引数`==0`时，或省略时 与原版行为相同。\n    - 追加引数`!=0`时 将鼠标点击视为回车键（向`RESULTS`代入空字符串。若按下按钮，则将按钮索引代入`RESULTS:1`），左键点击时`RESULT:1`设为`1`，右键点击时`RESULT:1`设为`2`。同时，若按下++shift++、++ctrl++、++alt++键，则将其按键状态保存到`RESULT:2`中。（bit 16 17 18）\n    ```\n    ```\n    `INPUT`、`INPUTS`、`ONEINPUT`、`ONEINPUTS` 新增第三参数（整数型，可省略，默认值为`0`）\n\n    `TINPUT`、`TINPUTS`、`TONEINPUT`、`TONEINPUTS` 新增第六参数（整数型，可省略，默认值为`0`）\n\n    - 当追加参数 `==0` 或省略时，行为与原版相同\n    - 当追加参数 `!=0` 时，在右键等导致的跳过过程中不进行输入等待\n    但默认值会被应用。与上述 `INPUT系命令接受鼠标点击` 功能并用时，默认值会分别代入 `RESULT:1` 及 `RESULTS:1`；\n    未并用时，默认值会照常代入 `RESULT:0` 及 `RESULTS:0`\n    在 EEv46 中增加了第四参数。若设置为非0，则会向 `RESULT` 填入默认值并强制跳过\n    ```\n\n    FLOWINPUTS在第一参数非0时启用。启用后，系统流程上的所有 `INPUT` 都将被视为 `INPUTS` 处理\n    在商店画面等根据输入值改变处理的场景，建议使用 `FLOWINPUT` 来设置默认值。其他行为控制也通过 `FLOWINPUT` 进行\n\n!!! hint \"提示\"\n\n\t指令和表达式函数均支持此功能。\n\n### 相关项目\n- BEGIN"
  },
  {
    "id": "FONT_OPERATION",
    "title": "字体操作相关",
    "names": [
      "FONTBOLD",
      "FONTITALIC",
      "FONTSTYLE",
      "FONTREGULAR",
      "GETSTYLE",
      "FONT_OPERATION"
    ],
    "signatures": [
      {
        "name": "FONTBOLD",
        "params": "无",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "FONTITALIC",
        "params": "无",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "FONTSTYLE",
        "params": "`int`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "FONTREGULAR",
        "params": "无",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "GETSTYLE",
        "params": "无",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "将后续文字更改为指定样式",
    "body": "!!! info \"API\"\n\n    ```erb\n\tFONTBOLD\n\tFONTITALIC\n\tFONTSTYLE\n\tFONTREGULAR bitStyle\n\tint GETSTYLE\n    ```\n\t将后续文字更改为指定样式\n\t`BOLD`和`ITALIC`可以叠加（粗斜体）\n\t调用`REGULAR`将取消粗体和斜体设置\n\n\tFONTSTYLE 将后续文字更改为指定样式。\n\t0为常规，1为粗体（与`FONTBOLD`同义），2为斜体（与`FONTITALIC`同义），4为删除线，8为下划线。\n\t这些样式可以按位组合。\n\t例如，FONTSTYLE 3 表示粗体且斜体。\n\t`FONTBOLD`、`FONTITALIC`会在当前样式上分别添加粗体、斜体样式。\n\t`FONTREGULAR`等同于`FONTSTYLE 0`，即恢复为常规样式。\n\n    `GETSTYLE` 会将当前字体的样式（粗体、斜体等）赋值给 `RESULT:0`。\n    这与 `SETSTYLE` 指令指定的值相同。\n    当未执行 `SETSTYLE` 指令时，返回 `0`。\n\n!!! hint \"提示\"\n\n    只有 `GETSTYLE` 支持在表达式中作为函数使用。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tFONTSTYLE 1 + 2\n\t\tPRINTL 粗体+斜体\n\t\tFONTSTYLE 5\n\t\tPRINTL 粗体+删除线\n\t\tFONTITALIC\n\t\tPRINTL 粗体+斜体+删除线\n\t\tPRINTFORML GETSTYLE:{GETSTYLE()}\n\t\tFONTSTYLE 0\n\t\tPRINTW 正常\n    ```\n\t![](../assets/images/FONT_OPERATION.png)"
  },
  {
    "id": "FOR",
    "title": "FOR-NEXT",
    "names": [
      "FOR",
      "NEXT",
      "REPEAT",
      "REND",
      "X"
    ],
    "signatures": [
      {
        "name": "FOR",
        "params": "`integerVariable`, `int`, `int`(, `int`)",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "NEXT",
        "params": "无",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "FOR～NEXT 是 REPEAT～REND 的功能增强版。",
    "body": "!!! info \"API\"\n\n    ```erb\n    FOR integerVariable, startNum, endNum(, value)\n    ```\n    `FOR～NEXT` 是 `REPEAT～REND` 的功能增强版。\n    第一个参数表示用于计数的变量（在 `REPEAT` 中始终是 `COUNT:0`）。\n    第二个参数表示最初赋值给变量的值（在 `REPEAT` 中始终是 `0`）。\n    第三个参数表示循环结束的值（相当于 `REPEAT` 中可设置的值）。\n    第四个参数表示每次循环累加的值（在 `REPEAT` 中始终是 `1`）。\n\n    ```erb\n    FOR COUNT, 0, X\n        ;～～\n    NEXT\n    REPEAT X\n        ;～～\n    REND\n    ```\n\n\t上面的两个语句功能几乎相同。\n\t两者都是执行X次循环的语法，在循环过程中可以使用`CONTINUE`或`BREAK`。\n\t不同之处在于可以指定用于计数的变量，并且可以更改起始值和步长。\n\t此外，`FOR～NEXT`可以嵌套使用。\n\n    ```erb\n\tFOR Y, 0, 100\n\t\tFOR X, 0, 100\n\t\t\t～～\n\t\tNEXT\n\tNEXT\n\t```\n\n    第1个参数`integerVariable`只能指定数值类型的变量，不能使用角色变量。\n    第4个参数`value`是可选的，如果省略则默认为`1`。\n    当`value`为正值时，在每次循环时向`integerVariable`变量增加`value`值，直到达到第3个参数`endNum`时循环结束。\n    当`value`为负值时，当`integerVariable`变量的值小于等于`endNum`时循环结束。\n    如果`value`为0，则会产生无限循环，直到执行`BREAK`语句才会退出。\n    各个值在循环开始时就被固定下来，即使在循环过程中变量发生变化也不会受到影响。\n    以下两个例子会产生相同的结果。\n\n    ```erb\n    ;１\n    X = 10\n    FOR COUNT:X, 0, X, X/10\n        X = 10000\n    NEXT\n    ;２\n    FOR COUNT:10, 0, 10, 10/10\n        X = 10000\n    NEXT\n    ```\n    此外，如果通过 `GOTO` 等指令直接跳转到 `FOR～NEXT` 循环内部，其行为与 `REPEAT～REND` 类似：会从进入点开始正常执行，直到 `NEXT` 指令的前一行，然后忽略 `NEXT` 指令，并从下一行继续执行。\n\n!!! hint \"提示\"\n\n    仅支持指令。\n\n### 相关项目\n- REPEAT-REND\n- WHILE-WEND\n- CONTINUE,BREAK"
  },
  {
    "id": "FORCE_BEGIN",
    "title": "FORCE_BEGIN",
    "names": [
      "FORCE_BEGIN"
    ],
    "signatures": [
      {
        "name": "FORCE_BEGIN",
        "params": "`string`",
        "returns": "`void`",
        "engines": [
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "忽略流程控制的影响，强制执行 BEGIN 命令。",
    "body": "!!! info \"API\"\n\n    ```erb\n    FORCE_BEGIN SystemFuncName\n    ```\n\n    忽略流程控制的影响，强制执行 `BEGIN` 命令。\n\n!!! hint \"提示\"\n\n    只能在命令中使用。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        BEGIN ABLUP\n\n    @SHOW_JUEL\n        PRINTL @SHOW_JUEL\n        FORCE_BEGIN SHOP\n\n    @EVENTSHOP\n        PRINTL @EVENTSHOP\n\n    @SHOW_SHOP\n        PRINTL @SHOW_SHOP\n        FORCE_BEGIN TURNEND\n\n    @EVENTTURNEND\n        PRINTL @EVENTTURNEND\n        WAIT\n\n    ```\n\n    ```text\n    @SHOW_JUEL\n    @EVENTSHOP\n    @SHOW_SHOP\n    @EVENTTURNEND\n    ```\n\n### 相关项目\n- BEGIN"
  },
  {
    "id": "FORCE_QUIT",
    "title": "FORCE_QUIT",
    "names": [
      "FORCE_QUIT"
    ],
    "signatures": [
      {
        "name": "FORCE_QUIT",
        "params": "`void`",
        "returns": "`void`",
        "engines": [
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "未附加 WAIT 的 QUIT。（即直接退出）",
    "body": "!!! info \"API\"\n\n\t```erb\n\tFORCE_QUIT\n\t```\n\n\t未附加 `WAIT` 的 `QUIT`。（即直接退出）\n\n!!! hint \"提示\"\n\n    只能作为命令使用。\n\n### 相关项目\n- QUIT"
  },
  {
    "id": "FORCE_QUIT_AND_RESTART",
    "title": "FORCE_QUIT_AND_RESTART",
    "names": [
      "FORCE_QUIT_AND_RESTART"
    ],
    "signatures": [
      {
        "name": "FORCE_QUIT_AND_RESTART",
        "params": "`void`",
        "returns": "`void`",
        "engines": [
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "未附加 WAIT 的 QUITANDRESTART。（即直接重启）",
    "body": "!!! info \"API\"\n\n    ```erb\n    FORCE_QUIT_AND_RESTART\n    ```\n\n    未附加 `WAIT` 的 `QUIT_AND_RESTART`。（即直接重启）\n\n!!! hint \"提示\"\n\n    只能作为命令使用。\n\t\t未插入输入等待，导致连续执行（死循环）的情况下弹出警告对话框。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n\n        FORCE_QUIT_AND_RESTART\n    ```\n\n    ![](../assets/images/FORCE_QUIT_AND_RESTART.png)\n\n### 相关项目\n- QUIT_AND_RESTART"
  },
  {
    "id": "FORCEKANA",
    "title": "FORCEKANA",
    "names": [
      "FORCEKANA"
    ],
    "signatures": [
      {
        "name": "FORCEKANA",
        "params": "`int`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "指定显示命令的平假名/片假名转换。",
    "body": "!!! info \"API \"\n\n    ```erb\n\tFORCEKANA int\n    ```\n\t指定显示命令的平假名/片假名转换。\n\t对包含关键字`K`的各种`PRINT`系命令有效。\n\t根据参数指定的值，会产生以下影响。\n\n    - 0:不进行转换\n    - 1:平假名→片假名\n    - 2:片假名→平假名（仅全角）\n    - 3:片假名→平假名（全角、半角均转换）\n\n!!! hint \"提示\"\n\n    仅支持命令。"
  },
  {
    "id": "FORCEWAIT",
    "title": "FORCEWAIT",
    "names": [
      "FORCEWAIT"
    ],
    "signatures": [
      {
        "name": "FORCEWAIT",
        "params": "无",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "这是一个无法通过右键点击或宏跳过功能跳过的 WAIT 指令。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tFORCEWAIT\n    ```\n\t这是一个无法通过右键点击或宏跳过功能跳过的 `WAIT` 指令。\n\t当执行到此指令时，这些跳过状态将被解除。\n\n!!! hint \"提示\"\n\n    仅支持指令形式。\n\n### 相关项目\n- WAIT"
  },
  {
    "id": "FORM",
    "title": "CALLFORM, JUMPFORM, GOTOFORM",
    "names": [
      "CALLFORM",
      "JUMPFORM",
      "GOTOFORM",
      "FORM"
    ],
    "signatures": [
      {
        "name": "CALLFORM",
        "params": "`functionName`(, `any`...)",
        "returns": "`void`¹",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "JUMPFORM",
        "params": "`functionName`(, `any`...)",
        "returns": "`void`¹",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "GOTOFORM",
        "params": "`labelName`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "与 CALL、JUMP、GOTO 相同，但可以像 PRINTFORM 一样指定函数名。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tCALLFORM functionName(, argument...)\n\tJUMPFORM functionName(, argument...)\n\tGOTOFORM labelName\n    ```\n\t与 `CALL`、`JUMP`、`GOTO` 相同，但可以像 `PRINTFORM` 一样指定函数名。\n\n    ```erb\n\tCALLFORM KOJO_{NO:TARGET}_{SELECTCOM}\n\t```\n\n    可以像这样使用。`JUMPFORM`和`CALLFORM`可以指定参数，详情请参见[函数的`自定义函数中的参数指定`](../Emuera//function.md#_2)一节。\n    另外，关于使用`GOTOFORM`直接进入循环/分支结构内部的情况，请参阅`TRYGOTO`、[`循环/分支结构`](../Reference/README.zh.md#flow-control)以及`TRYC`系列等章节。\n\n!!! hint \"提示\"\n\n    仅支持命令形式。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\t#DIMS HOGE\n\t\tHOGES = AAA\n\t\tCALLFORM %HOGES%\n\t\tJUMPFORM %\"C\"*3%\n\n\t@AAA\n\t\tPRINTL AAA\n\n\t@CCC\n\t\tPRINTL CCC\n\t\tWAIT\n    ```\n    ```text\n\tAAA\n\tCCC\n    ```\n\n### 相关项目\n- CALL\n- JUMP\n- GOTO\n- TRYC系命令\n- [动态解析与反射](../tutorial/dynamic-reflection.zh.md) — CALLFORM 属于第二代\"函数名反射\""
  },
  {
    "id": "G_POLYGON",
    "title": "G_POLYGON 系列",
    "names": [
      "G_POLYGON_DRAW",
      "G_POLYGON_FILL",
      "G_POLYGON_POINT_ADD",
      "G_POLYGON_POINT_CLEAR",
      "G_POLYGON"
    ],
    "signatures": [
      {
        "name": "G_POLYGON_DRAW",
        "params": "`int`",
        "returns": "`int`",
        "engines": [
          "net"
        ],
        "overloads": []
      },
      {
        "name": "G_POLYGON_FILL",
        "params": "`int`",
        "returns": "`int`",
        "engines": [
          "net"
        ],
        "overloads": []
      },
      {
        "name": "G_POLYGON_POINT_ADD",
        "params": "`int`, `int`, `int`",
        "returns": "`int`",
        "engines": [
          "net"
        ],
        "overloads": []
      },
      {
        "name": "G_POLYGON_POINT_CLEAR",
        "params": "`int`",
        "returns": "`int`",
        "engines": [
          "net"
        ],
        "overloads": []
      }
    ],
    "summary": "GPOLYGONPOINT_ADD向指定gID的图形添加顶点。",
    "body": "!!! info \"API\"\n\n\t```erb\n\tint G_POLYGON_DRAW gID\n\tint G_POLYGON_FILL gID\n\tint G_POLYGON_POINT_ADD gID, x, y\n\tint G_POLYGON_POINT_CLEAR gID\n\t```\n\n\t`G_POLYGON_POINT_ADD`向指定`gID`的图形添加顶点。\n\t`G_POLYGON_DRAW`用当前画笔将添加的顶点绘制为多边形。\n\t`G_POLYGON_FILL`用当前画刷将添加的顶点填充为多边形。\n\t`G_POLYGON_POINT_CLEAR`清除所有已添加的顶点。\n\n\t这些函数仅在 SkiaSharp 绘图模式下可用。GDI 模式下会报错。\n\n!!! hint \"提示\"\n\n    支持命令和表达式函数两种形式。\n\n!!! example \"示例\"\n\n\t```erb\n\t@SYSTEM_TITLE\n\t\t; 创建 400x300 的画布\n\t\tGCREATE 0, 400, 300\n\t\tGCLEAR 0, 0xFFFFFF\n\n\t\t; 设置红色画笔和蓝色画刷\n\t\tGSETPEN 0, 0xFF0000, 3\n\t\tGSETBRUSH 0, 0x0000FF\n\n\t\t; 添加三角形顶点\n\t\tG_POLYGON_POINT_ADD 0, 50, 50\n\t\tG_POLYGON_POINT_ADD 0, 350, 50\n\t\tG_POLYGON_POINT_ADD 0, 200, 250\n\n\t\t; 先填充再描边\n\t\tG_POLYGON_FILL 0\n\t\tG_POLYGON_DRAW 0\n\n\t\t; 显示\n\t\tCBGSETG 0, 0, 0, 0\n\t\tWAIT\n\t```\n\n### 相关项目\n- GCREATE\n- GSETPEN\n- GSETBRUSH\n- GFILLRECTANGLE"
  },
  {
    "id": "GCLEAR",
    "title": "GCLEAR",
    "names": [
      "GCLEAR"
    ],
    "signatures": [
      {
        "name": "GCLEAR",
        "params": "`int`, `int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "将指定gID的Graphics对象的整个区域替换为指定颜色。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint GCLEAR gID, cARGB\n    ```\n\t将指定`gID`的`Graphics`对象的整个区域替换为指定颜色。\n\t处理成功时返回非0值。\n\t若`gID`或颜色指定不恰当，将发生错误。\n\n!!! hint \"提示\"\n\n    同时支持指令形式和表达式函数形式。\n\n### 相关项目\n- GSETCOLOR"
  },
  {
    "id": "GCREATE",
    "title": "GCREATE",
    "names": [
      "GCREATE"
    ],
    "signatures": [
      {
        "name": "GCREATE",
        "params": "`int`, `int`, `int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "以指定尺寸创建指定 gID 的 Graphics。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint GCREATE gID, width, height\n    ```\n    以指定尺寸创建指定 `gID` 的 `Graphics`。\n    `Graphics` 的 `gID` 必须是 0 或以上的整数，`width` 和 `height` 必须是 1 到 8192 之间的整数。\n    如果参数超出此范围，将发生错误。\n    创建成功时，返回非 0 值。\n    如果指定 `gID` 的 `Graphics` 已存在，则返回 0。\n    若要重新创建 `Graphics`，请使用 `GDISPOSE` 命令销毁现有的 `Graphics`。\n\n!!! hint \"提示\"\n\n    同时支持指令和表达式函数形式。\n\n### 相关项目\n- GCREATEFROMFILE\n- GDISPOSE"
  },
  {
    "id": "GCREATED",
    "title": "GCREATED",
    "names": [
      "GCREATED"
    ],
    "signatures": [
      {
        "name": "GCREATED",
        "params": "`int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "如果指定gID的Graphics已创建则返回1，未创建（包括已销毁）则返回0。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint GCREATED gID\n    ```\n\t如果指定`gID`的`Graphics`已创建则返回1，未创建（包括已销毁）则返回0。\n\n!!! hint \"提示\"\n\n    同时支持指令和表达式函数两种用法。\n\n### 相关项目\n- GCREATE"
  },
  {
    "id": "GCREATEFROMFILE",
    "title": "GCREATEFROMFILE",
    "names": [
      "GCREATEFROMFILE"
    ],
    "signatures": [
      {
        "name": "GCREATEFROMFILE",
        "params": "`int`, `string`(, `int`)",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "使用相对于 resources 文件夹的路径指定图像文件，打开该图像并创建 Graphics。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int GCREATEFROMFILE gID, filePath{, isRelative}\n    ```\n\n    使用相对于 `resources` 文件夹的路径指定图像文件，打开该图像并创建 `Graphics`。\n    与在 `resources` 文件夹内的 csv 文件中声明资源不同，图像文件不会被锁定。（在 EM+EE 中，通过 CSV 指定的图像也不会被锁定）\n    如果创建成功，则返回非 0 值。\n    如果指定 `gID` 的 `Graphics` 已经存在，则 `Graphics` 创建失败，此命令不执行任何操作并返回 0 结束。\n    如果因文件不存在、无法识别为图像、文件过大等原因失败，也返回 0。\n\n    **Skia（SkiaSharp版）扩展参数**：\n\n    - `isRelative`（可选，默认 `0`）：设为 `1` 时，`filePath` 将从当前工作目录而非程序目录解析相对路径。如果指定了绝对路径，此参数将被忽略。\n\n!!! hint \"提示\"\n\n    此功能同时支持作为命令和表达式函数使用。\n\n### 相关项目\n- GCREATE"
  },
  {
    "id": "GDASHSTYLE",
    "title": "GDASHSTYLE",
    "names": [
      "GDASHSTYLE",
      "GDRAWLINE"
    ],
    "signatures": [
      {
        "name": "GDASHSTYLE",
        "params": "`int`, `int`, `int`",
        "returns": "1",
        "engines": [
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "指定GDRAWLINE的线条样式。DashStyle和DashCap分别可以使用C#的DashStyle、DashCap枚举的数值来指定。",
    "body": "!!! info \"API\"\n\n\t```erb\n\tint GDRAWline gID, DashStyle, DashCap\n\t```\n\n    指定GDRAWLINE的线条样式。DashStyle和DashCap分别可以使用C#的DashStyle、DashCap枚举的数值来指定。\n    DashStyle 0=普通线条 1=由短划线构成的线条 2=由点构成的线条 3=由短划线和点构成的线条 4=由短划线和两个点构成的线条\n    DashCap(线条端点的形状) 0=普通形状(直角) 2=圆形 3=三角形 1是缺号。有意见请向Microsoft反映。\n\n!!! hint \"提示\"\n\n\t该功能同时支持命令和表达式函数两种形式。\n\n!!! example \"示例\"\n\n\t```erb\n\t@SYSTEM_TITLE\n\t\t#DIM DYNAMIC LCOUNT\n\t\tFOR LCOUNT, 0, 5\n\t\t\tGCREATE LCOUNT, 100, 100\n\n\t\t\tGSETPEN LCOUNT, 0xFFFF0000, 5\n\n\t\t\tGDASHSTYLE LCOUNT, 1, 3\n\t\t\tGSETPEN LCOUNT, 0xFFFF0000, 4\n\n\t\t\tGCLEAR LCOUNT, 0xFFFFFFFF\n\n\t\t\tGDRAWLINE LCOUNT, 0, 0, 100, (LCOUNT+1)*20\n\n\t\t\tSPRITECREATE @\"LINE{LCOUNT}\", LCOUNT\n\t\t\tHTML_PRINT @\"<img src='LINE{LCOUNT}' srcb='' height='500'>\"\n\t\t\tREPEAT 4\n\t\t\t\tPRINTL\n\t\t\tREND\n\t\tNEXT\n\t\tWAIT\n\t```\n\n\t![](../assets/images/GDASHSTYLE.png)\n\n### 相关项目\n- GDRAWLINE"
  },
  {
    "id": "GDISPOSE",
    "title": "GDISPOSE",
    "names": [
      "GDISPOSE"
    ],
    "signatures": [
      {
        "name": "GDISPOSE",
        "params": "`int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "销毁指定gID的Graphics对象。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint GDISPOSE gID\n    ```\n\t销毁指定`gID`的`Graphics`对象。\n\t销毁成功时返回非0值。\n\t当指定`gID`的`Graphics`对象尚未创建（包括已销毁的情况）时，返回0。\n\n!!! hint \"提示\"\n\n    该函数同时支持指令和表达式函数两种使用方式。"
  },
  {
    "id": "GDRAWG",
    "title": "GDRAWG",
    "names": [
      "GDRAWG"
    ],
    "signatures": [
      {
        "name": "GDRAWG",
        "params": "`int`, `int`, `int`, `int`, `int`, `int`, `int`, `int`, `int`, `int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": [
          "`int`, `int`, `int`, `int`, `int`, `int`, `int`, `int`, `int`, `int`, `integerVariable`"
        ]
      }
    ],
    "summary": "将指定的 srcID 对应的 Graphics 绘制到指定的 destID 对应的 Graphics 上。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint GDRAWG destID, srcID, destX, destY, destWidth, destHeight, srcX, srcY, srcWidth, srcHeight\n\tint GDRAWG destID, srcID, destX, destY, destWidth, destHeight, srcX, srcY, srcWidth, srcHeight, colorMatrix\n    ```\n    将指定的 `srcID` 对应的 `Graphics` 绘制到指定的 `destID` 对应的 `Graphics` 上。\n    通过四个整数指定目标 `dest` `Graphics` 的位置和大小，通过另外四个整数指定源 `src` `Graphics` 的位置和大小。\n    可选地，可以通过指定一个 5x5 或更大的二维数值数组作为 `colorMatrix` 来应用颜色矩阵进行绘制。\n    `colorMatrix` 的所有元素会除以 256 后传递给 .Net Framework 的 `ColorMatrix` 类。也就是说，对角线元素全为 256 的 5x5 矩阵是单位矩阵。\n    处理成功时，返回非 0 值。\n    当目标 `Graphics` 或源 `Graphics` 中任意一个未创建等情况下，返回 0。\n    目标 `Graphics` 和源 `Graphics` 可以是同一个。\n\n!!! hint \"提示\"\n\n    命令和表达式函数均支持。\n\n### 相关项目\n- GDRAWSPRITE"
  },
  {
    "id": "GDRAWGWITHMASK",
    "title": "GDRAWGWITHMASK",
    "names": [
      "GDRAWGWITHMASK"
    ],
    "signatures": [
      {
        "name": "GDRAWGWITHMASK",
        "params": "`int`, `int`, `int`, `int`, `int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "在指定的 destID 的 Graphics 上，使用 maskID 的 Graphics 作为蒙版，绘制 srcID 的 Graphics。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tGDRAWGWITHMASK destID, srcID, maskID, destX, destY\n    ```\n\t在指定的 `destID` 的 `Graphics` 上，使用 `maskID` 的 `Graphics` 作为蒙版，绘制 `srcID` 的 `Graphics`。\n\t通过 `destX, destY` 指定在输出目标 `destID` 的 `Graphics` 内的绘制位置。\n\t处理成功时，返回非 0 值。\n\t成功的条件是：`srcID` 与 `maskID` 的宽度和高度必须完全一致，且绘制区域不能超出 `destID` 的范围。\n\t所谓“应用蒙版绘制”，具体是指将蒙版图像的蓝色通道值作为不透明度应用到源图像上进行绘制。\n\t例如，如果蒙版图像完全是纯白色（即所有位置的蓝色通道值均为最大值），则源图像将像没有蒙版一样被原样绘制。\n\t如果蒙版图像完全是纯黑色（即所有位置的蓝色通道值均为 0），则源图像将被视为完全透明，不会发生任何绘制。\n\t此命令的处理由 CPU 单线程完成，而非 GPU。请不要对其速度抱有期待。\n\n!!! hint \"提示\"\n\n    命令和表达式函数均支持。"
  },
  {
    "id": "GDRAWGWITHROTATE",
    "title": "GDRAWGWITHROTATE",
    "names": [
      "GDRAWGWITHROTATE"
    ],
    "signatures": [
      {
        "name": "GDRAWGWITHROTATE",
        "params": "`int`, `int`, `int`(, `int`, `int`)",
        "returns": "`int`",
        "engines": [
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "将 destID 指定的图像顺时针旋转 Angle 的角度，并把旋转后的图像粘贴到 gID 指定的图像。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int GDRAWGWITHROTATE gID, destID, Angle(, x, y)\n    ```\n\n    将 `destID` 指定的图像顺时针旋转 `Angle` 的角度，并把旋转后的图像粘贴到 `gID` 指定的图像。\n    参数 `x` / `y` 可以指定旋转的中心点。省略则默认使用 `(x/2, y/2)`（图像整体的中心点）。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n    #DIMS HTML\n\n        GCREATE 0, 400, 400\n        GCREATE 1, 400, 400\n        GCREATE 2, 400, 400\n\n        GSETFONT 0, \"Arial\", 100\n        GDRAWTEXT 0, \"Emuera\", 30, 150\n\n        GDRAWGWITHROTATE 1, 0, 90\n        GDRAWGWITHROTATE 2, 0, 180\n\n        REPEAT 3\n            SPRITECREATE @\"TEST{COUNT}\", COUNT\n            HTML += @\"<img src='TEST{COUNT}' height = '400' width = '400'>\"\n        REND\n        HTML_PRINT HTML\n        PRINTL\n        PRINTL\n        PRINTL\n        WAIT\n    ```\n\n    ![](../assets/images/GDRAWGWITHROTATE.png)"
  },
  {
    "id": "GDRAWLINE",
    "title": "GDRAWLINE",
    "names": [
      "GDRAWLINE"
    ],
    "signatures": [
      {
        "name": "GDRAWLINE",
        "params": "`int`, `int`, `int`, `int`, `int`",
        "returns": "1",
        "engines": [
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "在gID指定的Graphics上，从fromX,fromY坐标到forX,forY坐标绘制一条直线。",
    "body": "!!! info \"API\"\n\n\t```erb\n\tint GDRAWline gID, fromX, fromY, forX, forY\n\t```\n\n    在`gID`指定的`Graphics`上，从`fromX`,`fromY`坐标到`forX`,`forY`坐标绘制一条直线。\n    线条的颜色和粗细使用`GSETPEN`指定的设置。\n\n!!! hint \"提示\"\n\n    该功能同时支持命令形式和函数形式。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n    #DIM DYNAMIC LCOUNT\n\n\t\tFOR LCOUNT, 0, 5\n\t\t\tGCREATE LCOUNT, 100, 100\n\t\t\tGCLEAR LCOUNT, 0xFFFFFFFF\n\t\t\tGSETPEN LCOUNT, 0xFFFF0000, 5\n\t\t\tGDRAWLINE LCOUNT, 0, 0, 100, (LCOUNT+1)*20\n\t\t\tSPRITECREATE @\"LINE{LCOUNT}\", LCOUNT\n\t\t\tHTML_PRINT @\"<img src='LINE{LCOUNT}' srcb='' height='500'>\"\n\t\t\tREPEAT 4\n\t\t\t\tPRINTL\n\t\t\tREND\n\t\tNEXT\n\t\tWAIT\n\t```\n\n\t![](../assets/images/GDRAWLINE.png)\n\n### 相关项目\n- GSETPEN\n- GDASHSTYLE"
  },
  {
    "id": "GDRAWSPRITE",
    "title": "GDRAWSPRITE",
    "names": [
      "GDRAWSPRITE"
    ],
    "signatures": [
      {
        "name": "GDRAWSPRITE",
        "params": "`int`, `string`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": [
          "`int`, `string`, `int`, `int`",
          "`int`, `string`, `int`, `int`, `int`, `int`",
          "`int`, `string`, `int`, `int`, `int`, `int`, `integerVariable`"
        ]
      }
    ],
    "summary": "在指定gID的Graphics上，绘制指定spriteName的Sprite。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint GDRAWSPRITE gID, spriteName\n\tint GDRAWSPRITE gID, spriteName, destX, destY\n\tint GDRAWSPRITE gID, spriteName, destX, destY, destWidth, destHeight\n\tint GDRAWSPRITE gID, spriteName, destX, destY, destWidth, destHeight, colorMatrix\n    ```\n\t在指定`gID`的`Graphics`上，绘制指定`spriteName`的`Sprite`。\n\t可选地，通过`destX,destY`指定`Graphics`内部的位置，将`Sprite`绘制在该位置。\n\t此外，通过`destWidth,destHeight`指定绘制宽度和高度，可以将`Sprite`放大或缩小到该尺寸进行绘制。\n\t更进一步，在`colorMatrix`中指定一个5x5矩阵，可以应用颜色矩阵进行绘制。\n\t注意，`Sprite`的尺寸可以通过`SPRITEWIDTH(str imgName), SPRITEHEIGHT(str imgName)`函数获取。\n\t处理成功时，返回非0值。\n\n    当指定动画精灵时，将绘制运行时的一个帧。\n\n!!! hint \"提示\"\n\n    同时支持指令和表达式函数。\n\n### 相关项目\n- GDRAWG"
  },
  {
    "id": "GDRAWTEXT",
    "title": "GDRAWTEXT",
    "names": [
      "GDRAWTEXT"
    ],
    "signatures": [
      {
        "name": "GDRAWTEXT",
        "params": "`int`, `string`(, `int`, `int`)",
        "returns": "`int`",
        "engines": [
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "在 gID 指定的 Graphics 中绘制 text。字体、描边等使用 GSETFONT / GSETPEN 指定的样式。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int GDRAWTEXT gID, text(, x, y)\n    ```\n\n    在 `gID` 指定的 `Graphics` 中绘制 `text`。字体、描边等使用 `GSETFONT` / `GSETPEN` 指定的样式。\n    省略参数 `x` / `y` 时，默认在 `(0, 0)` 的位置绘制。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n    #DIM DYNAMIC LCOUNT\n\n    \tFOR LCOUNT, 1, 6\n    \t\tGCREATE LCOUNT, 2000, 300\n    \t\tGSETFONT LCOUNT, \"Arial\", LCOUNT*50, 0\n    \t\tGSETPEN LCOUNT, 0xFFFF0000, 5\n    \t\tGDRAWTEXT LCOUNT, \"ABC\"\n    \t\tSPRITECREATE @\"TEST{LCOUNT}\", LCOUNT\n    \t\tHTML_PRINT @\"<img src='TEST{LCOUNT}' srcb='' height='300'>\"\n    \t\tREPEAT 2\n    \t\t\tPRINTL\n    \t\tREND\n    \tNEXT\n    ```\n\n    ![](../assets/images/GDRAWTEXT.png)\n\n### 相关项目\n- GSETFONT\n- GSETPEN\n- GGETTEXTSIZE"
  },
  {
    "id": "GETCHARA",
    "title": "GETCHARA",
    "names": [
      "GETCHARA"
    ],
    "signatures": [
      {
        "name": "GETCHARA",
        "params": "`int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "判断指定角色是否在当前持有的角色列表中，如果在则返回其在列表中的位置，否则返回-1。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint GETCHARA charaNO\n    ```\n\t判断指定角色是否在当前持有的角色列表中，如果在则返回其在列表中的位置，否则返回`-1`。\n\t可用于从整个列表中确认特定角色是否存在。\n\n!!! hint \"提示\"\n\n    该函数同时支持作为指令和表达式函数使用。\n\n### 相关项目\n- FINDCHARA — 按变量值查找角色\n- [动态解析与反射](../tutorial/dynamic-reflection.zh.md) — GETCHARA 属于第一代\"固定映射\""
  },
  {
    "id": "GETCOLOR",
    "title": "GETCOLOR 系列",
    "names": [
      "GETCOLOR",
      "GETBGCOLOR",
      "GETDEFCOLOR",
      "GETDEFBGCOLOR",
      "GETFOCUSCOLOR"
    ],
    "signatures": [
      {
        "name": "GETCOLOR",
        "params": "无",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "GETBGCOLOR",
        "params": "无",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "GETDEFCOLOR",
        "params": "无",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "GETDEFBGCOLOR",
        "params": "无",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "GETFOCUSCOLOR",
        "params": "无",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "分别将颜色代码赋值给 RESULT:0 或返回。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint GETCOLOR\n\tint GETBGCOLOR\n\tint GETDEFCOLOR\n\tint GETDEFBGCOLOR\n\tint GETFOCUSCOLOR\n    ```\n\t分别将颜色代码赋值给 `RESULT:0` 或返回。\n\t`GETCOLOR` 返回当前使用的文字颜色，`GETDEFCOLOR` 返回[配置中指定的文字颜色](../Emuera/config.md#_28)，`GETBGCOLOR` 返回当前使用的背景颜色，\n\t`GETDEFBGCOLOR` 返回[默认使用的背景颜色](../Emuera/config.md#_27)，`GETFOCUSCOLOR` 返回[按钮选中时的文字颜色](../Emuera/config.md#_29)。\n\t返回值为十六进制的 `0xRRGGBB`。\n\t例如，橙色 (R,G,B) = (`255, 128, 0`) 则返回 `0xFF8000`（十进制为 `16744448`）。\n\t关于颜色与数字的对应关系，可以参考讲解 web color 的网站。\n\t自 1.731 版本变更后，`SETCOLOR` 命令也可以使用 `SETCOLOR 0xFF8000` 这样的形式来指定了。\n\n!!! hint \"提示\"\n\n    该函数在指令和表达式中均可使用。\n\n### 相关项目\n- SETCOLOR\n- SETBGCOLOR\n- GETCONFIG"
  },
  {
    "id": "GETCONFIG",
    "title": "GETCONFIG(S)",
    "names": [
      "GETCONFIG",
      "GETCONFIGS"
    ],
    "signatures": [
      {
        "name": "GETCONFIG",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "GETCONFIGS",
        "params": "`string`",
        "returns": "`string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "获取配置项及 replace.csv 设置项的整数值或字符串值。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint GETCONFIG configWord\n\tstring GETCONFIGS configWord\n    ```\n    获取配置项及 [`replace.csv`](../Emuera/replace.zh.md) 设置项的整数值或字符串值。\n    可获取的项目请参阅[配置](../Emuera/config.zh.md)页面。\n\n!!! hint \"提示\"\n\n    该函数既可作为指令使用，也可在表达式中使用。\n\n### 相关项目\n- GETCOLOR\n- PRINTCPERLINE"
  },
  {
    "id": "GETCSVNOBY",
    "title": "GETCSVNOBY系",
    "names": [
      "GETCSVNOBYNAME",
      "GETCSVNOBYNICKNAME",
      "GETCSVNOBYCALLNAME",
      "GETCSVNOBYMASTERNAME",
      "GETCSVNOBY"
    ],
    "signatures": [
      {
        "name": "GETCSVNOBYNAME",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "net",
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "GETCSVNOBYNICKNAME",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "net",
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "GETCSVNOBYCALLNAME",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "net",
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "GETCSVNOBYMASTERNAME",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "net",
          "skia"
        ],
        "overloads": []
      }
    ],
    "summary": "通过角色的名字反查角色注册编号 (NO)。是 CSVNAME系 的逆操作：CSVNAME 从编号查名字，GETCSVNOBY 从名字查编号。",
    "body": "!!! info \"API\"\n\n    ```erb\n    GETCSVNOBYNAME name\n    GETCSVNOBYNICKNAME nickname\n    GETCSVNOBYCALLNAME callname\n    GETCSVNOBYMASTERNAME mastername\n    ```\n    通过角色的名字反查角色注册编号 (NO)。是 CSVNAME系 的逆操作：CSVNAME 从编号查名字，GETCSVNOBY 从名字查编号。\n\n    - `GETCSVNOBYNAME`：通过 `NAME`（角色名）反查\n    - `GETCSVNOBYNICKNAME`：通过 `NICKNAME`（昵称）反查\n    - `GETCSVNOBYCALLNAME`：通过 `CALLNAME`（称呼）反查\n    - `GETCSVNOBYMASTERNAME`：通过 `MASTERNAME`（主人名）反查\n\n    返回值：找到则返回角色注册编号 (NO)（≥0），未找到返回 -1。\n\n    当存在多个同名角色时，返回最后加载的注册编号。\n\n    !!! warning \"与 FINDCHARA 的区别\"\n        `GETCSVNOBY*` 查询的是 CSV 模板数据，角色无需已被 `ADDCHARA` 添加即可查找。\n        FINDCHARA 查询的是运行时已添加的角色，返回的是登记编号 (CharaID) 而非注册编号 (NO)。\n\n!!! hint \"提示\"\n\n    支持命令语法（`GETCSVNOBYNAME \"絵夢 江良\"`）与表达式语法（`LOCAL = GETCSVNOBYNAME(\"絵夢 江良\")`）两种形式。作为命令调用时结果写入 `RESULT`。查找为 O(1) 复杂度。\n\n!!! example \"示例\"\n    ``` { title Chara0.csv }\n    番号,0\n    名前,絵夢 江良\n    呼び名,江良\n    ```\n\n    ```erb\n    @SYSTEM_TITLE\n        LOCAL = GETCSVNOBYNAME(\"絵夢 江良\")\n        PRINTFORMW 番号={LOCAL} 呼び名番号={GETCSVNOBYCALLNAME(\"江良\")}\n    ```\n    ```text\n    番号=0 呼び名番号=0\n    ```\n\n### 相关项目\n- CSVNAME系 — 从编号查名字（逆操作）\n- FINDCHARA — 从已添加角色中查找\n- [动态解析与反射](../tutorial/dynamic-reflection.zh.md) — GETCSVNOBY* 属于 DotNet 扩展\"角色名→编号反查\""
  },
  {
    "id": "GETDISPLAYLINE",
    "title": "GETDISPLAYLINE",
    "names": [
      "GETDISPLAYLINE"
    ],
    "signatures": [
      {
        "name": "GETDISPLAYLINE",
        "params": "`int`",
        "returns": "`istring`",
        "engines": [
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "从已显示的行中，返回指定行的字符串",
    "body": "!!! info \"API\"\n\n\t```erb\n\tstring GETDISPLAYLINE lineNumber\n\t```\n\n\t从已显示的行中，返回指定行的字符串\n\n\t!!! warning \"Skia 扩展\"\n\n\t\t负数参数表示从底部倒数索引：`-1` = 最后一行，`-2` = 倒数第二行，以此类推。超出范围时返回空字符串。\n\n!!! hint \"提示\"\n\n    该函数既可作为命令使用，也可在表达式中作为函数使用。\n    显示行以数组形式管理，因此索引从0开始。使用`LINECOUNT`变量进行循环即可获取所有行。\n    注意：`LINECOUNT`是逻辑行数，`GETDISPLAYLINE`是显示行索引，两者可能不对齐。使用负数索引可直接从底部计数，避免不对齐问题。\n\n!!! example \"示例\"\n\n\t```erb\n\t@SYSTEM_TITLE\n\t\tPRINTL AAA\n\t\tPRINTL BBB\n\t\tPRINTL CCC\n\n\t\tREPEAT LINECOUNT\n\t\t\tPRINTFORML {COUNT}行目:%GETDISPLAYLINE(COUNT)%\n\t\tREND\n\t\tWAIT\n\t```\n\t```text\n\tNow Loading...\n\tAAA\n\tBBB\n\tCCC\n\t0行目:Now Loading...\n\t1行目:AAA\n\t2行目:BBB\n\t3行目:CCC\n\t```\n\n### 相关项目\n- HTML_POPPRINTINGSTR"
  },
  {
    "id": "GETDOINGFUNCTION",
    "title": "GETDOINGFUNCTION",
    "names": [
      "GETDOINGFUNCTION"
    ],
    "signatures": [
      {
        "name": "GETDOINGFUNCTION",
        "params": "无",
        "returns": "`string`",
        "engines": [
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "返回当前正在执行的函数的标签名。若在系统待机中（如标题画面）调用，则返回空字符串。",
    "body": "!!! info \"API\"\n\n\t```erb\n\tstring GETDOINGFUNCTION\n\t```\n\n\t返回当前正在执行的函数的标签名。若在系统待机中（如标题画面）调用，则返回空字符串。\n\n!!! example \"示例\"\n\n\t```erb\n\t@EVENTSHOP\n\t\tPRINTFORML 当前函数: %GETDOINGFUNCTION%\n\t```\n\t```text\n\t当前函数: EVENTSHOP\n\t```"
  },
  {
    "id": "GETKEY",
    "title": "GETKEY, GETKEYTRIGGERED",
    "names": [
      "GETKEY",
      "GETKEYTRIGGERED"
    ],
    "signatures": [
      {
        "name": "GETKEY",
        "params": "`keyCode`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "GETKEYTRIGGERED",
        "params": "`keyCode`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "GETKEY 返回键盘及鼠标按键的状态。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tGETKEY keyCode\n\tGETKEYTRIGGERED keyCode\n    ```\n\t`GETKEY` 返回键盘及鼠标按键的状态。\n\t如果参数指定的按键被按下则返回 1，否则返回 0。\n\n\t`GETKEYTRIGGERED` 与 `GETKEY` 类似，返回键盘及鼠标按键的状态。\n\t`GETKEY` 获取的是当前是否被按下，而 `GETKEYTRIGGERED` 仅在按键被按下的瞬间返回 1。\n\t也就是说，持续按住按键时，`GETKEY` 会返回 1，但 `GETKEYTRIGGERD` 仅在最初返回 1，之后返回 0。\n\n    这些函数仅在Emuera窗口处于活动状态时返回1，如果窗口非活动状态，则无论按键状态如何都返回0。\n    关于键码数值与实际按键的对应关系，请参考微软公司MSDN中[`GetKeyState()`](https://learn.microsoft.com/ja-jp/windows/win32/api/winuser/nf-winuser-getkeystate)的说明。\n\n!!! hint \"提示\"\n\n    该函数同时支持指令和表达式函数两种使用方式。\n\n### 相关项目\n- AWAIT"
  },
  {
    "id": "GETLINESTR",
    "title": "GETLINESTR",
    "names": [
      "GETLINESTR"
    ],
    "signatures": [
      {
        "name": "GETLINESTR",
        "params": "`string`",
        "returns": "`string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "将参数字符串传递给 CUSTOMDRAWLINE、DRAWLINEFORM 时，返回将显示的字符串。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tstring GETLINESTR pattern\n    ```\n    将参数字符串传递给 `CUSTOMDRAWLINE`、`DRAWLINEFORM` 时，返回将显示的字符串。\n    不保证此命令及表达式中函数返回的字符串长度与 `1行に表示できる文字列長`（一行可显示的字符串长度）相对应。\n\n!!! hint \"提示\"\n\n    同时支持命令和表达式中函数。\n\n### 相关项目\n- DRAWLINE\n- CUSTOMDRAWLINE"
  },
  {
    "id": "GETLINEY",
    "title": "GETLINEY",
    "names": [
      "GETLINEY"
    ],
    "signatures": [
      {
        "name": "GETLINEY",
        "params": "`int`",
        "returns": "`int`",
        "engines": [
          "skia"
        ],
        "overloads": []
      }
    ],
    "summary": "返回指定行号的物理 Y 坐标（左下原点），与 SETIMAGELAYER 的坐标系一致。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int GETLINEY(lineNo)\n    ```\n\n    返回指定行号的物理 Y 坐标（左下原点），与 `SETIMAGELAYER` 的坐标系一致。\n\n    **参数**：\n\n    | 参数 | 类型 | 说明 |\n    | :--- | :--- | :--- |\n    | `lineNo` | int | 行号（≥0） |\n\n    **返回值**：指定行的物理 Y 坐标（像素）。左下原点坐标系，与 `SETIMAGELAYER` 的 `y` 参数使用相同坐标系。\n\n!!! warning \"注意\"\n\n    Skia 版专有表达式函数。传入负数参数将抛出 `CodeEE`。\n\n!!! hint \"提示\"\n\n    用于将 `SETIMAGELAYER` 的图像与 HTML 文本流对齐。通过 `GETLINEY(LINECOUNT)` 获取当前行的 Y 坐标，传递给 `SETIMAGELAYER` 的 `y` 参数，即可将图像图层精确放置在文本所在行。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n        ; 获取当前行号\n        #DIM L_LINE\n        L_LINE = LINECOUNT\n\n        ; 输出文本\n        PRINTL 你好\n\n        ; 在同一行放置图像图层\n        #DIM L_Y\n        L_Y = GETLINEY(L_LINE)\n        SETIMAGELAYER \"icon\", 1, 100, L_Y, 50, 50\n    ```\n\n### 相关项\n- SETIMAGELAYER\n- EXISTSIMAGELAYER\n- CLEARIMAGELAYER"
  },
  {
    "id": "GETMEMORYUSAGE",
    "title": "GETMEMORYUSAGE",
    "names": [
      "GETMEMORYUSAGE"
    ],
    "signatures": [
      {
        "name": "GETMEMORYUSAGE",
        "params": "`void`",
        "returns": "`int`",
        "engines": [
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "返回当前运行中的 Emuera 占用的内存使用量（单位为 byte）。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int GETMEMORYUSAGE\n    ```\n\n    返回当前运行中的 Emuera 占用的内存使用量（单位为 byte）。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        PRINTFORMW 当前的内存使用量为 {GETMEMORYUSAGE()/1024/1024} MB\n        REPEAT 10000\n            ADDVOIDCHARA\n        REND\n        PRINTFORMW 运行 10000 次 ADDVOIDCHARA 之后的内存使用量为 {GETMEMORYUSAGE()/1024/1024} MB\n    ```\n\n    ```text\n    当前的内存使用量为 65 MB\n    运行 10000 次 ADDVOIDCHARA 之后的内存使用量为 913 MB\n    ```\n\n### 相关项目\n- CLEARMEMORY"
  }
];
