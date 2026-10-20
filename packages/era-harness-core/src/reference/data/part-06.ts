// 本文件由 scripts/build-reference.ts 生成，请勿手工修改。
//
// 数据来源：https://github.com/qirchen421/emuera.sk.doc  docs/Reference/*.zh.md
// 上游版本：606670cd78b58f5d9a050013d1d3f41db5a87a1b
// 许可：CC BY-NC 4.0（http://creativecommons.org/licenses/by-nc/4.0/）
//       与本仓库代码的 Apache-2.0 分开管理，见 NOTICE-emuera-sk-doc.md
import type { ReferenceEntry } from '../types.js';

export const ENTRIES_PART_06: readonly ReferenceEntry[] = [
  {
    "id": "PRINTPLAIN",
    "title": "PRINTPLAIN",
    "names": [
      "PRINTPLAIN"
    ],
    "signatures": [
      {
        "name": "PRINTPLAIN",
        "params": "`string`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "将参数字符串作为纯文本输出。此时即使存在按钮字符串（如0等）也不会将其按钮化。",
    "body": "!!! info \"API\"\n\n    ```erb\n    PRINTPLAIN(|FORM) string\n    ```\n    将参数字符串作为纯文本输出。此时即使存在按钮字符串（如0等）也不会将其按钮化。\n    括号内的关键字用于指定参数类型。\n\n    - 不加上`FORM` - <字符串>\n    - 加上`FORM` - <格式化字符串>\n\n!!! hint \"提示\"\n\n    仅支持指令形式。\n\n### 相关项目\n- PRINT"
  },
  {
    "id": "PRINTSINGLE",
    "title": "PRINTSINGLE 系列",
    "names": [
      "PRINTSINGLE",
      "PRINTSINGLEV",
      "PRINTSINGLES",
      "PRINTSINGLEFORM",
      "PRINTSINGLEFORMS"
    ],
    "signatures": [
      {
        "name": "PRINTSINGLE",
        "params": "`string`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "PRINTSINGLE 系列与 PRINTL 几乎相同，但 PRINTSINGLE 系列不会对字符串进行换行，始终在一行内显示。",
    "body": "!!! info \"API\"\n\n    ```erb\n    PRINTSINGLEV(|K|D) expression[, expression, ...]\n    PRINTSINGLES(|K|D) stringVariable\n    PRINTSINGLEFORM(|K|D) formedString\n    PRINTSINGLEFORMS(|K|D) string\n    ```\n    `PRINTSINGLE` 系列与 `PRINTL` 几乎相同，但 `PRINTSINGLE` 系列不会对字符串进行换行，始终在一行内显示。\n    超出屏幕边缘的字符不会被绘制。\n    此外，由于会自动添加换行，因此没有 `(|L|W)` 关键字。\n    其他关键字的含义与 PRINT 系列 相同。\n\n!!! hint \"提示\"\n\n    仅支持作为指令使用。\n\n### 相关项目\n- PRINT"
  },
  {
    "id": "PUTFORM",
    "title": "PUTFORM",
    "names": [
      "PUTFORM"
    ],
    "signatures": [
      {
        "name": "PUTFORM",
        "params": "`string`",
        "returns": "无",
        "engines": [
          "eramaker"
        ],
        "overloads": []
      }
    ],
    "summary": "PUTFORM 只能在名为 @SAVEINFO 的特殊函数中使用。",
    "body": "!!! info \"API\"\n\n    ```erb\n    PUTFORM saveInfo\n    ```\n    `PUTFORM` 只能在名为 `@SAVEINFO` 的特殊函数中使用。\n    通过使用与 `PRINTFORM` 相同的格式书写，可以为存档数据添加概要。\n    建议写入诸如第几天、角色能力如何、正在调教哪个角色等数据。\n\n!!! hint \"提示\"\n\n    仅支持指令。\n\n### 相关项目\n- SAVEDATA\n- [流程图>SAVEGAME](../Emuera/system_flow.md#savegame)"
  },
  {
    "id": "QUIT",
    "title": "QUIT",
    "names": [
      "QUIT"
    ],
    "signatures": [
      {
        "name": "QUIT",
        "params": "无",
        "returns": "无",
        "engines": [
          "eramaker"
        ],
        "overloads": []
      }
    ],
    "summary": "执行一次 WAIT 后结束 Emuera",
    "body": "!!! info \"API\"\n\n    ```erb\n\tQUIT\n    ```\n    执行一次 `WAIT` 后结束 `Emuera`\n\n!!! hint \"提示\"\n\n    仅支持作为指令使用。\n\n### 相关项目\n- FORCE_QUIT\n- QUIT_AND_RESTART"
  },
  {
    "id": "QUIT_AND_RESTART",
    "title": "QUIT_AND_RESTART",
    "names": [
      "QUIT_AND_RESTART"
    ],
    "signatures": [
      {
        "name": "QUIT_AND_RESTART",
        "params": "`void`",
        "returns": "`void`",
        "engines": [
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "和 QUIT 一样，插入 WAIT 后重启 Emuera。",
    "body": "!!! info \"API\"\n\n    ```erb\n    QUIT_AND_RESTART\n    ```\n\n    和 `QUIT` 一样，插入 WAIT 后重启 Emuera。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n### 相关项目\n- QUIT\n- FORCE_QUIT_AND_RESTART"
  },
  {
    "id": "RAND",
    "title": "RAND",
    "names": [
      "RAND"
    ],
    "signatures": [
      {
        "name": "RAND",
        "params": "`int`(, `int`)",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "与同名的变量功能几乎相同。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint RAND min(, max)\n    ```\n\t与同名的变量功能几乎相同。\n\t`RAND(X)` 与 `RAND:X` 的行为完全相同。\n\t使用完全相同的随机数生成器，可以通过 `RANDOMIZE` 或 `INITRAND` 来控制随机数。\n\t`RAND` 函数可以指定两个参数，当指定两个参数时，第一个参数将用作随机数的最小值。\n\t此函数生成一个 `0～18446744073709551615` (2的64次方-1) 之间的随机数，将其除以 `max-min` 取余数，然后加上 `min` 并返回结果。\n\t因此，`max` 必须是一个大于 `min` 的值（不能相等）。\n\t如果 `max-min` 超过有符号64位整数 (`9223372036854775807`) 的最大值，将会出错。\n\t此外，当 `max-min` 非常大时（大约1京？），由取余方法导致的偏差将变得不可忽视。\n\n!!! hint \"提示\"\n\n    命令和表达式函数均支持。\n\n!!! warning \"Skia 扩展\"\n\n    Skia 版在参数非法时不再弹出错误中断脚本（v12.2.0）。\n\n    - `RAND:n` 且 `n ≤ 0` 时：返回 `0`\n    - `RAND(max)` / `RAND(min,max)` 且 `max ≤ min` 时：返回下界 `min`（浮点参数同理）\n    - 仅首次触发时向控制台输出一次警告，之后静默钳制\n\n    原版在 `max` 不大于 `min` 或 `RAND:0` 等情况下会弹出错误并终止脚本。\n\n### 相关项目\n- PRINTDATA\n- STRDATA"
  },
  {
    "id": "RANDOMIZE",
    "title": "RANDOMIZE, DUMPRAND, INITRAND",
    "names": [
      "RANDOMIZE",
      "DUMPRAND",
      "INITRAND",
      "PRINTFORML"
    ],
    "signatures": [
      {
        "name": "RANDOMIZE",
        "params": "`int`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "DUMPRAND",
        "params": "无",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "INITRAND",
        "params": "无",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "这些是用于控制通过 RAND:X 获取的随机数的指令。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tRANDOMIZE int\n\tDUMPRAND\n\tINITRAND\n    ```\n\t这些是用于控制通过 `RAND:X` 获取的随机数的指令。\n\n\t`RANDOMIZE` 指令使用指定的值初始化随机数。\n\t如果使用相同的值进行初始化，`RAND` 必定会返回相同的结果。\n\t对于 `PRINTDATA` 和 `STRDATA` 也会返回相同的结果。\n\n\t`DUMPRAND` 将当前的随机数状态保存到 `RANDDATA` 变量中。\n\t`INITRAND` 从 `RANDDATA` 变量中读取保存的数据。\n\t请注意，不要在 `DUMPRAND` 之前执行 `INITRAND`。\n\t如果 `RANDDATA` 变量的内容不合适，`RAND` 将无法正常工作。\n\n    **示例**\n    ```erb\n\tPRINTFORML {RAND:100000}/{RAND:100000}/{RAND:100000}/{RAND:100000}/{RAND:100000}/{RAND:100000}\n\tRANDOMIZE 23478612\n\tPRINTFORML {RAND:100000}/{RAND:100000}/{RAND:100000}/{RAND:100000}/{RAND:100000}/{RAND:100000}\n\tRANDOMIZE 23478612\n\tPRINTFORML {RAND:100000}/{RAND:100000}/{RAND:100000}/{RAND:100000}/{RAND:100000}/{RAND:100000}\n\tDUMPRAND\n\tPRINTFORML {RAND:100000}/{RAND:100000}/{RAND:100000}/{RAND:100000}/{RAND:100000}/{RAND:100000}\n\tINITRAND\n\tPRINTFORML {RAND:100000}/{RAND:100000}/{RAND:100000}/{RAND:100000}/{RAND:100000}/{RAND:100000}\n\tINITRAND\n\tPRINTFORML {RAND:100000}/{RAND:100000}/{RAND:100000}/{RAND:100000}/{RAND:100000}/{RAND:100000}\n\t```\n\n    **结果**\n\t```\n\t92539/49469/48337/15839/48368/1604\n\t34536/91889/81167/22434/87922/95565\n\t34536/91889/81167/22434/87922/95565\n\t68286/10690/68868/82610/90769/60789\n\t68286/10690/68868/82610/90769/60789\n\t68286/10690/68868/82610/90769/60789\n\t```\n\n    在上述结果中，第一行的结果是随机的。每次运行时结果都会变化。\n    第二行和第三行由于在`RANDOMIZE`之后立即执行，因此结果必定相同。\n    在第四行之前执行了`DUMPRAND`命令。\n    通过在第五行之前执行`INITRAND`命令，将`RAND`的状态恢复到了`DUMPRAND`命令保存的状态。\n    因此，第四行和第五行的结果相同。\n    第六行通过再次执行`INITRAND`命令，重复获得了相同的结果。\n    由于`RANDDATA`变量是可保存的变量，通过在保存前执行`DUMPRAND`，并在加载后立即执行`INITRAND`，可以继续使用相同的随机数状态。\n\n!!! hint \"提示\"\n\n    仅支持命令。\n\n### [Skia]Skia 版变更\n\n!!! info \"与新随机数算法解耦\"\n\n    原版中 `UseNewRandom=true` 时，`INITRAND`/`DUMPRAND` 会输出警告并跳过。Skia 版移除了此检查，`INITRAND`/`DUMPRAND` 始终操作 MTRandom 状态，不影响 `GetNextRand`。"
  },
  {
    "id": "REDRAW",
    "title": "REDRAW, CURRENTREDRAW",
    "names": [
      "REDRAW",
      "CURRENTREDRAW",
      "CUREENTREDRAW",
      "PREV_REDRAW"
    ],
    "signatures": [
      {
        "name": "REDRAW",
        "params": "`int`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "CURRENTREDRAW",
        "params": "无",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "这是绘图控制命令。",
    "body": "!!! info \"API\"\n\n    ```erb\n    REDRAW int\n    int CUREENTREDRAW\n    ```\n\t这是绘图控制命令。\n\t当参数指定为`0`时，**抑制非强制性的绘图请求**（仅在需要用户输入的时刻等强制绘图时机进行绘图）。\n\t当参数指定为`1`时，将如常进行绘图。此时非强制性的绘图若未满足[配置中的`每秒帧数`](../Emuera/config.zh.md#fps)所决定的最小间隔（`1000 / 每秒帧数` 毫秒），则不会绘图。\n\t若在参数上加上`2`（例如`REDRAW 2`或`REDRAW 3`），则在上述效果的基础上，还会在执行`REDRAW`命令的瞬间强制进行绘图。\n\t当前的`REDRAW`状态（`0`或`1`）可以通过`CURRENTREDRAW`获取。\n\n!!! info \"详细\"\n\n\t`REDRAW`只持有`0`（抑制）与`1`（常规）两种状态，`CURRENTREDRAW`也只返回`0`或`1`。\n\t`REDRAW 1`仅恢复状态，**其本身不会进行绘图**。若想在`REDRAW`命令之后立刻绘图，请使用加上`2`的`REDRAW 3`。\n\t`REDRAW 0`抑制的只是非强制性的绘图。进入等待用户输入的命令（`INPUT`・`INPUTS`・`INPUTSNF`・`TINPUT`系）时的绘图，以及鼠标移动到按钮上引起的绘图，都不受抑制。\n\n!!! warning \"注意（批量绘图与滚动位置）\"\n\n\t对于\"先清掉、再重画\"的画面（动画循环、动态地图等），请用`REDRAW 0`包住从清除到重绘的区间，并在进入输入等待之前恢复原状。\n\n\t```erb\n\tPREV_REDRAW = CURRENTREDRAW()\n\tREDRAW 0\n\t;\tCLEARLINE 与重绘\n\tREDRAW PREV_REDRAW\n\t;\t之后的输入等待会强制绘图\n\t```\n\n\t若不做批量绘图，清除已完成、重绘未完成的中途状态会被真的绘制出来。由于绘图同时会同步滚动位置，**画面将无法固定在最新行**（表现为行删掉又回来、窗口晃动）。\n\n\t另外，请不要把`REDRAW 1`当作\"恢复绘图\"的收尾使用，它会覆盖调用方的设定。恢复请使用事先保存的值（`REDRAW PREV_REDRAW`）。\n\n!!! hint \"提示\"\n\n    `CURRENTREDRAW`支持在表达式中作为函数使用。"
  },
  {
    "id": "REGEXPMATCH",
    "title": "REGEXPMATCH",
    "names": [
      "REGEXPMATCH"
    ],
    "signatures": [
      {
        "name": "REGEXPMATCH",
        "params": "`string`, `string`(, `int`)",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": [
          "`string`, `string`, `ref` `int`, `ref` `string[]`"
        ]
      }
    ],
    "summary": "如果 str 符合 pattern 正则表达式规则，返回匹配到的结果数量，否则返回 0。",
    "body": "!!! info \"API\"\n\n    ```erb\n    1. int REGEXPMATCH str, pattern(, output)\n    2. int REGEXPMATCH str, pattern, ref groupCount, ref matches\n    ```\n\n    如果 `str` 符合 `pattern` 正则表达式规则，返回匹配到的结果数量，否则返回 `0`。\n\n    1. `output` 参数为 `0` 以外的整数时(默认为`0`)，匹配到的子表达式组数保存到 `RESULT:1`，所有的匹配结果全部保存到 `RESULTS` 数组（共「子表达式组数量」×「返回值（匹配结果数量）」个）。\n    2. 匹配到的子表达式组数保存到 `groupCount`，所有的匹配结果全部保存到 `matches`（数量同上）。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        #DIM groupCount\n        #DIMS matches, 10\n        #DIM i\n        #DIM j\n        #DIM count\n\n        REGEXPMATCH \"Apple Banana Car\", \"(.{2})\\\\b\"\n        PRINTFORML 匹配结果数量: {RESULT}\n        count = REGEXPMATCH(\"Apple Banana Car\", \".(.{2})\\\\b\", groupCount, matches)\n        PRINTFORML 匹配结果数量: {count}  子表达式组数量: {groupCount}\n        PRINTL\n        FOR i, 0, count\n            PRINTFORML 匹配结果{i+1}:\n            FOR j, 0, groupCount\n                PRINTFORML 子表达式组{j}: %matches:(i*groupCount+j)%\n            NEXT\n            PRINTL\n        NEXT\n\n        ONEINPUT\n\n    ```\n    ```text\n    匹配结果数量: 3\n    匹配结果数量: 3  子表达式组数量: 2\n\n    匹配结果1:\n    子表达式组0: ple\n    子表达式组1: le\n\n    匹配结果2:\n    子表达式组0: ana\n    子表达式组1: na\n\n    匹配结果3:\n    子表达式组0: Car\n    子表达式组1: ar\n    ```"
  },
  {
    "id": "REPEAT",
    "title": "REPEAT-REND",
    "names": [
      "REPEAT",
      "REND"
    ],
    "signatures": [
      {
        "name": "REPEAT",
        "params": "`int`",
        "returns": "无",
        "engines": [
          "eramaker"
        ],
        "overloads": []
      },
      {
        "name": "REND",
        "params": "无",
        "returns": "无",
        "engines": [
          "eramaker"
        ],
        "overloads": []
      }
    ],
    "summary": "REPEAT～REND之间的代码块，将按照参数指定的次数进行循环。循环次数被记录在COUNT变量中。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tREPEAT loopCount\n\tREND\n    ```\n    `REPEAT`～`REND`之间的代码块，将按照参数指定的次数进行循环。循环次数被记录在`COUNT`变量中。\n\t当执行`CONTINUE`时，将返回到`REPEAT`行，并将`COUNT`变量加1。\n\t当执行`BREAK`时，将终止后续的循环处理，并跳转到`REND`行。\n\n!!! hint \"提示\"\n\n    仅支持指令形式。\n\n!!! example \"例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tREPEAT 5\n\t\t\tSIF COUNT == 2\n\t\t\t\tCONTINUE\n\t\t\tSIF COUNT == 4\n\t\t\t\tBREAK\n\t\t\tPRINTFORML {COUNT}\n\t\tREND\n\t\tPRINTFORMW {COUNT}\n    ```\n    ```text\n\t0\n\t1\n\t3\n\t5\n    ```\n\n### 相关项目\n- FOR-NEXT\n- WHILE_WEND\n- CONTINUE,BREAK"
  },
  {
    "id": "REPLACE",
    "title": "REPLACE",
    "names": [
      "REPLACE"
    ],
    "signatures": [
      {
        "name": "REPLACE",
        "params": "`string`, `string`, `string`",
        "returns": "`string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "在目标字符串中搜索目标模式，如果匹配成功，则用替换字符串进行替换。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tstring REPLACE string, searchWord, replaceWord\n    ```\n\t在目标字符串中搜索目标模式，如果匹配成功，则用替换字符串进行替换。\n\t内部处理完全基于正则表达式。第二个参数遵循 C# 正则表达式的规范进行操作。\n\t因此，对于正则表达式中使用的符号，如 `()`、`[]`、`$`、`/`、`.`、`*`、`+` 等，必须进行转义。\n\n!!! hint \"提示\"\n\n    该函数同时支持指令和表达式内函数两种形式。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tPRINTFORMW %REPLACE(\"12億3456万7890円\", \"[^0-9]\", \"\")%\n    ```\n    ```text\n\t1234567890\n    ```"
  },
  {
    "id": "RESET_STAIN",
    "title": "RESET_STAIN",
    "names": [
      "RESET_STAIN"
    ],
    "signatures": [
      {
        "name": "RESET_STAIN",
        "params": "`int`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "这是初始化第1个参数所指定角色的STAIN的指令。初始值与BEGIN TRAIN时赋入的值相同，可通过_replace.csv的污渍初始值进行指定。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tRESET_STAIN charaID\n    ```\n\t这是初始化第1个参数所指定角色的`STAIN`的指令。初始值与`BEGIN TRAIN`时赋入的值相同，可通过[`_replace.csv`的`污渍初始值`](../Emuera/replace.zh.md)进行指定。\n\n!!! hint \"提示\"\n\n    仅支持作为指令使用。\n\n### 相关项目\n- [_replace.csv>污渍初始值](../Emuera/replace.zh.md)"
  },
  {
    "id": "RESETDATA",
    "title": "RESETDATA",
    "names": [
      "RESETDATA"
    ],
    "signatures": [
      {
        "name": "RESETDATA",
        "params": "无",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "初始化除全局变量外的所有变量。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tRESETDATA\n    ```\n\t初始化除全局变量外的所有变量。\n\t具体来说，会删除所有角色，并将所有局部变量及所有普通变量赋值为`0`或空字符串。\n\t此外，对于`PALAMLV`或`STR`等设置了初始值的变量，会为其赋予初始值。\n\n!!! hint \"提示\"\n\n    仅支持指令。\n\n!!! example \"例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tRESULT = 123\n\t\tLOCAL = 456\n\n\t\tRESETDATA\n\t\tPRINTFORMW {RESULT} {LOCAL}\n    ```\n    ```text\n\t0 0\n    ```\n\n### 相关项目\n- RESETGLOBAL"
  },
  {
    "id": "RESETGLOBAL",
    "title": "RESETGLOBAL",
    "names": [
      "RESETGLOBAL"
    ],
    "signatures": [
      {
        "name": "RESETGLOBAL",
        "params": "无",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "初始化全局变量。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tRESETGLOBAL\n    ```\n\t初始化全局变量。\n\t具体来说，将数值型全局变量赋值为`0`，将字符串型全局变量赋值为空字符串。\n\n!!! hint \"提示\"\n\n    仅支持指令形式。\n\n!!! example \"例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tGLOBAL = 123\n\n\t\tRESETGLOBAL\n\t\tPRINTFORMW {GLOBAL}\n    ```\n    ```text\n\t0\n    ```\n\n### 相关项目\n- RESETDATA"
  },
  {
    "id": "RESTART",
    "title": "RESTART",
    "names": [
      "RESTART"
    ],
    "signatures": [
      {
        "name": "RESTART",
        "params": "无",
        "returns": "无",
        "engines": [
          "eramaker"
        ],
        "overloads": []
      }
    ],
    "summary": "返回当前正在执行的函数的开头。使用DYNAMIC定义的动态变量不会被初始化",
    "body": "!!! info \"API\"\n\n    ```erb\n\tRESTART\n    ```\n    返回当前正在执行的函数的开头。使用`DYNAMIC`定义的动态变量不会被初始化\n\n!!! hint \"提示\"\n\n    仅支持作为指令使用。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\t#DIM DYNAMIC RESTARTCOUNT\n\n\t\tRESTARTCOUNT++\n\n\t\tSELECTCASE RESTARTCOUNT\n\t\t\tCASE 1\n\t\t\t\tPRINTL Doe, a deer, a female deer\n\t\t\t\tRESTART\n\t\t\tCASE 2\n\t\t\t\tPRINTL Ray, a drop of golden sun\n\t\t\t\tRESTART\n\t\t\tCASE 3\n\t\t\t\tPRINTL Me, a name I call my self\n\t\t\t\tRESTART\n\t\t\tCASE 4\n\t\t\t\tPRINTL Far, a long, long way to run\n\t\t\t\tRESTART\n\t\t\tCASE 5\n\t\t\t\tPRINTL Sew, a needle pulling thread\n\t\t\t\tRESTART\n\t\t\tCASE 6\n\t\t\t\tPRINTL La, a note to follow Sew\n\t\t\t\tRESTART\n\t\t\tCASE 7\n\t\t\t\tPRINTL Tea, a drink with jam and bread\n\t\t\t\tRESTART\n\t\tENDSELECT\n\n\t\tPRINTW That will bring us back to Do\n    ```\n    ```text\n\tDoe, a deer, a female deer\n\tRay, a drop of golden sun\n\tMe, a name I call my self\n\tFar, a long, long way to run\n\tSew, a needle pulling thread\n\tLa, a note to follow Sew\n\tTea, a drink with jam and bread\n\tThat will bring us back to Do\n    ```\n\n### 相关项目\n- RETURN"
  },
  {
    "id": "RETURN",
    "title": "RETURN",
    "names": [
      "RETURN",
      "RETURNFORM",
      "A",
      "CALL",
      "PRINTFORMW",
      "STR"
    ],
    "signatures": [
      {
        "name": "RETURN",
        "params": "`int`(, `int`,...)",
        "returns": "`与参数相同`",
        "engines": [
          "eramaker",
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "RETURNFORM",
        "params": "`string`(, `string`,...)",
        "returns": "`与参数相同（转换为数值类型）`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "将参数指定的值赋值给 RESULT，并结束正在执行的函数。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tRETURN result:0(, result:1,...)\n\tRETURNFORM formedString(, formedString,...)\n    ```\n    将参数指定的值赋值给 `RESULT`，并结束正在执行的函数。\n    `RETURN` 将参数从左到右依次赋值给 `RESULT:0`, `RESULT:1`,...\n\n    `RETURNFORM` 是 `RETURN` 的变体。\n    它将参数指定的格式化字符串解析为算术表达式，然后执行 `RETURN`。\n    例如，可以实现以下操作：\n\n    ```erb\n\tA = 100\n\tCALL TEST\n\tPRINTFORMW RESULT == {RESULT}\n\n\t@TEST\n\tSTR = A * 10\n\tRETURNFORM %STR%\n\t```\n\n    请注意，与 `RETURN` 不同，`%` 在此处被视为字符串表达式的开始，而不是取模运算符。\n\n    ```erb\n\t;正确。返回A的低2位。\n\t\tRETURN A % 100\n\n\t;错误。因为会将%之后的内容作为字符串表达式读取。\n\t\tRETURNFORM A % 100\n\t```\n\t此外，它还支持多个返回值。\n\t当指定多个返回值时，会按顺序赋值给`RESULT:0`、`RESULT:1`...。\n\n!!! hint \"提示\"\n\n    仅支持指令。\n\n!!! warning \"RESULT 的覆盖与函数末尾的隐式赋值\"\n\n    `RETURN` **必定**覆盖 `RESULT`。即使在函数中手动给 `RESULT` 赋值，`RETURN` 执行时也会被覆盖。\n\n    此外，当函数到达末尾（没有执行 `RETURN`）时，`RESULT:0` 会被隐式赋值为 `0`。\n\n    ```erb\n    @MY_FUNC\n        RESULT = 999\n        RETURN 1\n        ; 调用方的 RESULT 是 1 而非 999\n\n    @MY_FUNC2\n        RESULT = 999\n        ; 无 RETURN → 函数末尾 RESULT:0 = 0\n    ```\n\n    但是，声明了 [`#FUNCTION`](../Emuera/function.zh.md) 的表达式函数使用 `RETURNF`，`RETURNF` **不会覆盖 RESULT**。函数末尾也不会对 `RESULT` 进行隐式赋值。\n\n    ```erb\n    @MY_EXPR_FUNC\n        #FUNCTION\n        RESULT = 999\n        RETURNF 1\n        ; 调用方的 RESULT 仍为 999（RETURNF 不覆盖 RESULT）\n    ```\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tCALL AAA\n\n\t\tPRINTFORML {RESULT:0}, {RESULT:1}, {RESULT:2}\n\n\t\tCALL BBB\n\n\t\tPRINTFORMW {RESULT:0}\n\n\t\t@AAA\n\t\tRETURN 5, 7, 3\n\n\t\t@BBB\n\t\t#DIMS HOGES\n\n\t\tHOGES '= \"3\"*2\n\n\t\tRETURNFORM %HOGES%4\n    ```\n    ```text\n\t\t5, 7, 3\n\t\t334\n    ```\n\n### 相关项目\n- RESTART\n- [动态解析与反射](../tutorial/dynamic-reflection.zh.md) — RETURNFORM 属于第二代\"FORM 动态求值\""
  },
  {
    "id": "REUSELASTLINE",
    "title": "REUSELASTLINE",
    "names": [
      "REUSELASTLINE",
      "INPUT",
      "IF",
      "GOTO",
      "ENDIF"
    ],
    "signatures": [
      {
        "name": "REUSELASTLINE",
        "params": "`string`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "使用指定的格式化字符串重写最后一行，",
    "body": "!!! info \"API\"\n\n    ```erb\n    REUSELASTLINE string\n    ```\n\t使用指定的格式化字符串重写最后一行，\n\t但通过此方式重写的行，在添加下一行时会被替换掉。\n\t基本上仅在 `INPUT`、`INPUTS` 的循环处理中使用。\n\t参数可使用与 `PRINTFORM` 相同的格式。\n\t另外，使用 `REUSELASTLINE （此半角空格必需）` 可以在不显示警告信息的情况下清空该行。\n\n    ```erb\n\t$INPUT_LOOP\n\tINPUT\n\tIF RESULT != 0\n\t\t;!;CLEARLINE 1\n\t\t;!;REUSELASTLINE 無効ですよ\n\t\tGOTO INPUT_LOOP\n\tENDIF\n\t```\n\n\t类似这样，在`GOTO INPUT_LOOP`之前调用`REUSELASTLINE`，\n\t之前的输入会从画面中清除，下一次输入会显示在与前一次输入相同的行上\n\t这样一来，即使重复进行无效输入，行数也不会增加，\n\t应该能防止出现“回过神来选项已经跑到画面外了…”这种情况\n\t顺便一提，在`@USERXXX`系列函数的条件分支末尾\n\t（对象是`@USERCOM`、`@USERSHOP`、`@USERABLUP`这三个）\n\n    ```erb\n\t;!;ELSE\n\t\t;!;REUSELASTLINE\n\tENDIF\n\t```\n\n\t这样写的话…？\n\t(如果仅用于Emuera，则不需要`;!;`)\n\n!!! hint \"提示\"\n\n    仅支持指令。"
  },
  {
    "id": "SAVECHARA",
    "title": "SAVECHARA",
    "names": [
      "SAVECHARA"
    ],
    "signatures": [
      {
        "name": "SAVECHARA",
        "params": "`string`, `string`, `int`(, `int`...)",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "将指定角色的数据保存到文件的指令。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tSAVECHARA filename, memo, charaID{,charaID2...}\n    ```\n\t将指定角色的数据保存到文件的指令。\n\t第一个参数指定用于保存数据的文件名（的一部分）。实际的文件名将是 `chara_*.dat`。\n\t第二个参数保存一个字符串，作为存档数据的备注。之后可以通过 `CHKCHARADATA` 函数读取。\n\t从第三个参数开始，指定要保存的角色的登记编号 (CharaID)。可以指定任意多个，但不能多次指定同一个登记编号 (CharaID)。\n\t如果 dat 文件夹不存在，将尝试创建该文件夹。如果创建失败，将发生错误。\n\t此外，如果第一个参数是空字符串、第一个参数包含文件名中不能使用的字符等情况，也会发生错误。\n\n!!! hint \"提示\"\n\n    仅支持指令形式。\n\n### 相关项目\n- LOADCHARA\n- CHKCHARADATA"
  },
  {
    "id": "SAVEDATA",
    "title": "SAVEDATA",
    "names": [
      "SAVEDATA",
      "GETTIME"
    ],
    "signatures": [
      {
        "name": "SAVEDATA",
        "params": "`int`, `string`",
        "returns": "无",
        "engines": [
          "emuera",
          "em"
        ],
        "overloads": []
      }
    ],
    "summary": "将当前状态保存到由 saveID 指定编号的文件中。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tSAVEDATA saveID, saveInfo\n    ```\n\t将当前状态保存到由 `saveID` 指定编号的文件中。\n\t`SAVEDATA` 命令不会调用 `@SAVEINFO`，因此无法使用 `PUTFORM` 添加注释。\n\t作为替代，可以通过第二个参数 `saveInfo` 来指定注释。\n\t(从 1.704 版本开始，不仅可以使用字符串变量，还可以使用字符串表达式) 示例如下：\n\n    ```erb\n\tGETTIME\n\tSTR:0 = %RESULTS:0% {DAY+1}日目\n\tSAVEDATA 14, STR:0\n\tSAVEDATA 15, RESULTS:0 + \" \" + @\"{DAY+1}日目\"\n    ```\n\n\t\t结果（加载画面）\n\t\t[13] ----\n\t\t[14] 2009年03月28日 00:31:27 第1天\n\t\t[15] 2009年03月28日 00:31:27 第1天\n\t\t[16] ----\n\n\t本命令不会执行覆盖确认等操作，如有需要请在ERB侧自行准备。\n\t可以使用`CHKDATA`命令检查是否已存在数据。\n\t`SAVEDATA`命令（与`SAVEGAME`命令不同）可以在脚本的任何位置调用。\n\n!!! info \"EM+EE 扩展：存档格式增强\"\n\n    EM+EE 扩展了 `SAVEDATA` 的存档格式，在标准存档数据之后额外保存 EM 专属数据：\n\n    - **Map 数据**：标记为 `SAVEDATA` 关键字的 `MAP` 字典\n    - **Xml 数据**：标记为 `SAVEDATA` 关键字的 XML 文档\n    - **DataTable 数据**：标记为 `SAVEDATA` 关键字的 DataTable 表\n\n    这些数据在 `LOADDATA` 加载时会被先清除再从存档恢复，确保存档切换时数据一致性。\n\n!!! hint \"提示\"\n\n    仅支持命令形式。\n\n### 相关项目\n- LOADDATA\n- CHKDATA"
  },
  {
    "id": "SAVEGAME",
    "title": "SAVEGAME, LOADGAME",
    "names": [
      "SAVEGAME",
      "LOADGAME"
    ],
    "signatures": [
      {
        "name": "SAVEGAME",
        "params": "无",
        "returns": "无",
        "engines": [
          "eramaker"
        ],
        "overloads": []
      },
      {
        "name": "LOADGAME",
        "params": "无",
        "returns": "无",
        "engines": [
          "eramaker"
        ],
        "overloads": []
      }
    ],
    "summary": "SAVEGAME 用于呼出存档画面，LOADGAME 用于呼出读档画面。两者都只能在 SHOP 状态下调用。",
    "body": "!!! info \"API\"\n\n    ```erb\n    SAVEGAME\n    LOADGAME\n    ```\n    `SAVEGAME` 用于呼出存档画面，`LOADGAME` 用于呼出读档画面。两者都只能在 `SHOP` 状态下调用。\n\n!!! hint \"提示\"\n\n    仅支持作为指令使用。\n\n### 相关项目\n- PUTFORM"
  },
  {
    "id": "SAVEGLOBAL",
    "title": "SAVEGLOBAL",
    "names": [
      "SAVEGLOBAL"
    ],
    "signatures": [
      {
        "name": "SAVEGLOBAL",
        "params": "无",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "保存 GLOBAL 和 GLOBALS 变量。保存目标为 global.sav。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tSAVEGLOBAL\n    ```\n\t保存 `GLOBAL` 和 `GLOBALS` 变量。保存目标为 `global.sav`。\n\t如果在 ERH 文件中定义了拥有 `GLOBAL` 及 `SAVEDATA` 标志的变量，也会一并保存。\n\n!!! hint \"提示\"\n\n    仅支持命令形式。\n\n### 相关项目\n- LOADGLOBAL"
  },
  {
    "id": "SAVENOS",
    "title": "SAVENOS",
    "names": [
      "SAVENOS"
    ],
    "signatures": [
      {
        "name": "SAVENOS",
        "params": "`int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "作为命令时，获取配置显示存档数据数量中指定的数量，并赋值给指定的数值变量。默认值为20。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint SAVENOS variable\n    ```\n\t作为命令时，获取配置[`显示存档数据数量`](../Emuera/config.md#_10)中指定的数量，并赋值给指定的数值变量。默认值为`20`。\n\t不能省略数值变量。\n\n\t作为表达式函数时，返回配置`显示存档数据数量`中指定的数量。默认值为20。\n\t与`GETCONFIG(\"显示存档数据数量\")`同义。\n\n!!! hint \"提示\"\n\n    同时支持命令和表达式函数两种形式。"
  },
  {
    "id": "SAVETEXT",
    "title": "SAVETEXT",
    "names": [
      "SAVETEXT"
    ],
    "signatures": [
      {
        "name": "SAVETEXT",
        "params": "`string`, `int`(, `int`, `int`)",
        "returns": "`int`",
        "engines": [
          "emuera",
          "em"
        ],
        "overloads": []
      }
    ],
    "summary": "将 text 指定的文本保存到文件名为 textXX.txt 的文件中（例如，如果 fileNo 为 2，则文件名为 text02.txt）。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint SAVETEXT text, fileNo(, forceSavdir, forceUTF8)\n    ```\n\t将 `text` 指定的文本保存到文件名为 `textXX.txt` 的文件中（例如，如果 `fileNo` 为 `2`，则文件名为 `text02.txt`）。\n\t此命令会原样保存字符串，不会为文本添加或更改任何头部信息。\n\t此命令通常受选项设置影响，可能会在 sav 文件夹内创建文件，或以 `UTF-8` 编码保存。\n\t如果在第 3 个参数中指定了非 0 值，则会忽略选项设置，强制在 sav 文件夹内保存。sav 文件夹会在需要时自动创建。\n\t如果在第 4 个参数中指定了非 0 值，则会忽略选项设置，强制以 UTF-8 编码保存。\n\t成功时返回非 0 值，失败时返回 0。\n\t如果在短时间内重复向同一文件写入，可能会因防病毒软件等影响而导致写入失败，因此检查操作是否成功非常重要。\n\n!!! info \"EM+EE 扩展：字符串路径重载\"\n\n    ```erb\n\tint SAVETEXT text, filePath\n    ```\n    当第二个参数为**字符串**时，将其作为文件路径保存。这是 EM+EE 新增的参数类型重载，提供更灵活的文件保存能力：\n\n    - 路径为相对于 `Emuera.exe` 的相对路径，`..` 无效\n    - 只能使用由设置界面或 `Emuera.config` 中「LOADTEXTとSAVETEXTで使える拡張子」项目所允许的扩展名（默认为仅 `txt`）\n    - 如果指定的扩展名不在允许列表中，会自动改为 `.txt`\n    - 使用字符串路径时，**强制以 UTF-8 编码保存**（忽略 `forceUTF8` 参数）\n    - 如果路径中包含不存在的目录，会自动创建\n\n    ```text\n    LOADTEXTとSAVETEXTで使える拡張子:txt,xml,json\n    ```\n\n    ```erb\n    ; 标准用法：按编号保存到 sav 文件夹\n    SAVETEXT \"Hello\", 0\n\n    ; EM+EE 扩展：按路径保存到自定义位置\n    SAVETEXT \"配置数据\", \"plugins/config.json\"\n    SAVETEXT \"日志\", \"log/output.txt\"\n    ```\n\n!!! hint \"提示\"\n\n    指令和表达式函数均支持。\n\n### 相关项目\n- LOADTEXT\n- OUTPUTLOG"
  },
  {
    "id": "SELECTCASE",
    "title": "SELECTCASE",
    "names": [
      "SELECTCASE",
      "CASE",
      "CASEELSE",
      "ENDSELECT",
      "PRINTL"
    ],
    "signatures": [
      {
        "name": "SELECTCASE",
        "params": "`any`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "CASE",
        "params": "`any`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "CASEELSE",
        "params": "无",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "ENDSELECT",
        "params": "无",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "这是一个分支结构。其行为模仿了 Visual Basic 的同名结构。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tSELECTCASE anyValue\n\tCASE anyValue(, anyValue...)\n\tCASEELSE\n\tENDSELECT\n    ```\n\t这是一个分支结构。其行为模仿了 Visual Basic 的同名结构。\n\t它与 `IF` 结构类似，但 `SELECTCASE` 是根据一个值分支到多行代码的结构。\n\t根据 `SELECTCASE` 指定的参数值进行分支。最简单的用法如下所示。\n\n    ```erb\n\tSELECTCASE X\n\t\tCASE 1\n\t\t\tPRINTL X是1。\n\t\tCASE 3\n\t\t\tPRINTL X是3。\n\t\tCASEELSE\n\t\t\tPRINTL X既不是1也不是3。\n\tENDSELECT\n\t```\n\n    该脚本根据 `X` 的值进行分支。\n    执行 `SELECTCASE` 语句时，如果 `X` 为 `1`，则跳转到 `CASE 1` 所在行，并执行直到下一个 `CASE` 或 `CASEELSE` 之前的行。\n    同样地，如果 `X` 为 `3`，则跳转到 `CASE 3`。\n    当 `X` 的值没有对应的 `CASE` 语句时，如果存在 `CASEELSE` 语句，则跳转到该处；否则跳转到 `ENDSELECT`。\n    与 C 语言等的 `switch` 语句不同，它不会从一个 `CASE` 继续执行到下一个 `CASE`。\n    此外，无法使用 `BREAK` 语句跳转到 `ENDSELECT`。\n    另外，如果通过 `GOTO` 等指令直接进入 `SELECTCASE～CASE～CASEELSE～ENDSELECT` 内部，则会与 `IF～ELSEIF～ELSE～ENDIF` 类似，\n    正常执行直到 `CASE`、`CASEELSE`、`ENDSELECT` 的紧前位置，然后跳转到 `ENDSELECT` 的下一行继续处理。\n    `CASE` 的条件表达式有三种格式。\n    第一种是如上所述直接指定值的方法，第二种是 `IS <运算符> <表达式>`，第三种是 `<表达式> TO <表达式>`。\n    对于 `IS <运算符> <表达式>` 的情况，例如 `IS <= 30`，当 `X` 小于等于 `30` 时，将执行 `CASE` 以下的部分。\n    对于 `<表达式> TO <表达式>` 的情况，例如 `10 TO 20`，当 `X` 在 `10` 到 `20` 之间（含）时，将执行 `CASE` 以下的部分。\n    此外，可以在 `CASE` 中指定多个用逗号分隔的条件表达式。\n    利用这些特性，可以写出如下示例：\n\n    ```erb\n\tSELECTCASE X\n\t\tCASE 1\n\t\t\tPRINTL X是1。\n\t\tCASE 2,3\n\t\t\tPRINTL X不是1。\n\t\t\tPRINTL X是2或3。\n\t\tCASE 10 TO 20\n\t\t\tPRINTL X不是1、2、3中的任何一个。\n\t\t\tPRINTL X在10到20之间。\n\t\tCASE IS <= 30\n\t\t\tPRINTL X不是1、2、3，也不在10到20之间。\n\t\t\tPRINTL X小于等于30。\n\t\tCASE 40, 5 * 10 TO 6 * 10, IS >= 10 * 10\n\t\t\tPRINTL X大于30。\n\t\t\tPRINTL X是40、50到60之间、或100以上的值。\n\t\tCASEELSE\n\t\t\tPRINTL X不满足以上任何条件。\n\tENDSELECT\n    ```\n\n\t请注意，`IS` 和 `TO` 必须按照 `IS <运算符> <表达式>` 或 `<表达式> TO <表达式>` 的形式使用。\n\t例如，不能写成 `30 < IS` 或 `(10 TO 20) || (30 TO 40)`。\n\t此外，`<表达式> TO <表达式>` 仅在左值以上、右值以下时为真。\n\t如果右值小于左值，则该 `CASE` 永远不会被执行。\n\n\t请注意，当一个 `CASE` 包含多个条件表达式时，会发生短路求值。\n\t条件从左到右依次检查，一旦找到满足的条件，剩余的条件将不会被评估。\n\n\t也可以将字符串表达式用作 `SELECTCASE` 的参数。\n\t如果在 `SELECTCASE` 中指定了字符串，则 `CASE` 的条件表达式也必须是字符串表达式。\n\n!!! info \"Skia 扩展：跳转表优化\"\n\n    [Skia] Skia 对 `SELECTCASE` 引入了**跳转表（Jump Table）**编译期优化，将符合条件的 `CASE` 条件构建为哈希表（`Dictionary`），实现 **O(1) 运行时查找**，大幅提升多分支场景下的执行效率。\n\n    **适用条件**\n\n    跳转表优化仅在以下条件全部满足时生效：\n\n    - `SELECTCASE` 的所有 `CASE` 条件表达式均为**直接值**（即不使用 `TO` 或 `IS` 表达式）\n    - 所有 `CASE` 值均为**编译期常量**（例如字面量 `1`、`\"hello\"` 等，而非变量）\n    - `CASEELSE` 语句仍可作为默认分支正常使用\n\n    以下情况下跳转表优化不生效，回退到传统的线性扫描：\n\n    - 任一 `CASE` 包含 `TO` 表达式（范围匹配）或 `IS` 表达式（条件匹配）\n    - 任一 `CASE` 值包含非常量表达式（如变量）\n\n    支持整数、字符串、浮点数三种数据类型。\n\n!!! hint \"提示\"\n\n    仅支持指令。\n\n### 相关项目\n- IF-ENDIF\n- PRINTDATA\n- STRDATA"
  },
  {
    "id": "SEQUENCEINPUT",
    "title": "SEQUENCEINPUT ![](../assets/images/IconSK.webp)",
    "names": [
      "SEQUENCEINPUT"
    ],
    "signatures": [
      {
        "name": "SEQUENCEINPUT",
        "params": "`string`",
        "returns": "`integer`",
        "engines": [
          "skia"
        ],
        "overloads": []
      }
    ],
    "summary": "在下一次输入等待（INPUT/TINPUT/INPUTS/TINPUTS等）时，将指定字符串作为用户输入自动提交。调用 SEQUENCEINPUT 后，下一次进入 WaitInput 状态时，引擎调用 PressEnterKey 处理排队的字符串，行为与在文本框中输入并按回车一致。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint SEQUENCEINPUT inputString\n    ```\n    在下一次输入等待（INPUT/TINPUT/INPUTS/TINPUTS等）时，将指定字符串作为用户输入自动提交。调用 `SEQUENCEINPUT` 后，下一次进入 WaitInput 状态时，引擎调用 `PressEnterKey` 处理排队的字符串，行为与在文本框中输入并按回车一致。\n\n    - 字符串中的 `\\n` 会被拆分为多段，每段喂入一个 ERB WaitInput\n    - 字符串中的 `\\e` 会被识别为 MesSkip（跳过等待）。FORM 字符串解析中 `\\e` 会作为 2 个字符（`\\` + `e`）保留，使 SEQUENCEINPUT 路径能正确识别\n    - 同时作用于 `WaitInput` 和 `WaitInputNoFocus`（NF 后缀指令）\n    - 返回值始终为 `0`\n\n!!! warning \"注意\"\n\n    由于 `CanRestructure = false`，不会成为常量折叠的对象。\n\n!!! hint \"提示\"\n\n    指令和表达式函数均支持此功能。\n\n### 相关项目\n- FLOWINPUT,FLOWINPUTS\n- INPUT\n- INPUTS"
  },
  {
    "id": "SETANIMETIMER",
    "title": "SETANIMETIMER / GETANIMETIMER",
    "names": [
      "SETANIMETIMER",
      "GETANIMETIMER"
    ],
    "signatures": [
      {
        "name": "SETANIMETIMER",
        "params": "`int`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "GETANIMETIMER",
        "params": "无",
        "returns": "`int`",
        "engines": [
          "skia"
        ],
        "overloads": []
      }
    ],
    "summary": "为动画精灵指定以毫秒为单位的重绘间隔。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tSETANIMETIMER time\n\tint GETANIMETIMER\n    ```\n\t为动画精灵指定以毫秒为单位的重绘间隔。\n\tEmuera 通常不会在 `INPUT` 等输入等待期间进行重绘。\n\t通过此命令设置重绘间隔，可以在 `INPUT` 等输入等待期间使图像产生动画效果。\n\t注意，在 `TINPUT` 等具有超时处理的命令中不会进行重绘。\n\t实际的重绘间隔会因计算机状态而略慢于指定的时间。\n\t因此，若将重绘间隔设置为与动画的 `delay` 值相同，会导致频繁丢帧。\n\t请指定一个比 `delay` 值短得多的间隔。\n\n\t此命令与配置中的 `每秒帧数` 设置无关。\n\t同时，它不受 `REDRAW` 命令的重绘抑制效果影响。\n\n\t**GETANIMETIMER**：返回当前动画计时器的值（毫秒）。支持命令和表达式函数两种形式。\n\n!!! hint \"提示\"\n\n    `SETANIMETIMER` 仅支持命令。`GETANIMETIMER` 支持命令和表达式函数两种形式。\n\n!!! skia \"Skia版的变更\"\n\n    | 项目 | EM+EE | Skia版 |\n    |:---|:---|:---|\n    | `SETANIMETIMER` | 式中函数（返回值: 总是`1`） | 命令（无返回值） |\n    | `GETANIMETIMER` | ❌ 不存在 | ✅ 式中函数（返回当前计时器值） |\n\n    EM+EE 中 `SETANIMETIMER` 作为式中函数实现，可以使用 `RESULT = SETANIMETIMER(100)` 的方式调用。Skia 版将其重构为命令，因此这种写法会编译报错。\n\n### 相关项目\n- [命令 vs 表达式 — 两种求值路径的根本差异](../tutorial/command-vs-expression.zh.md) — RESULT 污染问题与式中函数重构为命令的原因\n- SPRITEANIMECREATE\n- [Skia版规格变更一览](../Skia/Skia_Summary.zh.md#changed-commands)"
  },
  {
    "id": "SETBGCOLOR",
    "title": "SETBGCOLOR",
    "names": [
      "SETBGCOLOR",
      "RESETBGCOLOR"
    ],
    "signatures": [
      {
        "name": "SETBGCOLOR",
        "params": "`int`, `int`, `int`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": [
          "`int`"
        ]
      },
      {
        "name": "RESETBGCOLOR",
        "params": "无",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "此命令用于将背景色更改为指定颜色。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tSETBGCOLOR R, G, B\n\tSETBGCOLOR hexaDecimal\n\tRESETBGCOLOR\n    ```\n\t此命令用于将背景色更改为指定颜色。\n\t其基本规格与 `SETCOLOR`・`RESETCOLOR` 相同，但出于安全考虑，如果在更改后的 0.2 秒内再次更改，将强制等待直到 0.2 秒过去。\n\t可以使用 `GETBGCOLOR` 获取当前背景色，使用 `GETDEFBGCOLOR` 获取默认背景色。\n\t如需使用颜色名称指定，请使用 `SETBGCOLORBYNAME`。\n\n    ```erb\n\tSETBGCOLOR 255, 128, 0\n\tSETBGCOLOR 0xFF8000\n\t```\n\n这两行代码具有相同的含义。通过 `GETBGCOLOR` 指令获取的值为后者（即十六进制格式）。\n\n!!! hint \"提示\"\n\n    仅指令本身支持两种格式。\n\n### 相关项目\n- SETCOLOR"
  },
  {
    "id": "SETBGMVOLUME",
    "title": "SETBGMVOLUME",
    "names": [
      "SETBGMVOLUME"
    ],
    "signatures": [
      {
        "name": "SETBGMVOLUME",
        "params": "`int`",
        "returns": "`void`",
        "engines": [
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "将 PLAYBGM 的音量设置为 0 ～ 100 之间。",
    "body": "!!! info \"API\"\n\n    ```erb\n    SETBGMVOLUME int(0～100)\n    ```\n\n    将 `PLAYBGM` 的音量设置为 `0` ～ `100` 之间。\n\n!!! hint \"提示\"\n\n    只能作为命令使用。\n\n### 相关项目\n- PLAYBGM"
  },
  {
    "id": "SETCOLOR",
    "title": "SETCOLOR, RESETCOLOR",
    "names": [
      "SETCOLOR",
      "RESETCOLOR"
    ],
    "signatures": [
      {
        "name": "SETCOLOR",
        "params": "`int`, `int`, `int`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": [
          "`int`"
        ]
      },
      {
        "name": "RESETCOLOR",
        "params": "无",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "将文字颜色更改为指定颜色，该设置将持续生效，直到调用RESETCOLOR。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tSETCOLOR R, G, B\n\tSETCOLOR hexaDecimal\n\tRESETCOLOR\n    ```\n\t将文字颜色更改为指定颜色，该设置将持续生效，直到调用`RESETCOLOR`。\n\t指定方式为`RGB`格式。\n\t使用`SETCOLOR`指定的颜色可以通过`RESETCOLOR`重置。\n\t当前文字颜色可通过`GETCOLOR`获取，默认文字颜色可通过`GETDEFCOLOR`获取。\n\t自1.731版本起，`SETCOLOR`支持使用`0xRRGGBB`格式指定颜色。\n\t如需使用颜色名称指定，请使用`SETCOLORBYNAME`。\n\n    ```erb\n\tSETCOLOR 255, 128, 0\n\tSETCOLOR 0xFF8000\n\t```\n\n这两行代码具有相同的效果。通过 `GETCOLOR` 命令获取到的颜色值将是后一种格式。\n\n!!! hint \"提示\"\n\n    此功能仅支持命令形式。\n\n### 相关项目\n- SETBGMCOLOR\n- SETCOLORBYNAME"
  },
  {
    "id": "SETCOLORBYNAME",
    "title": "SETCOLORBYNAME, SETBGCOLORBYNAME",
    "names": [
      "SETCOLORBYNAME",
      "SETBGCOLORBYNAME",
      "SETCOLOBYNAME"
    ],
    "signatures": [
      {
        "name": "SETCOLORBYNAME",
        "params": "`colorName`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "SETBGCOLORBYNAME",
        "params": "`colorName`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "此指令用于根据预定义的颜色名称来指定字体显示颜色或背景颜色。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tSETCOLOBYNAME colorName\n\tSETBGCOLORBYNAME colorName\n    ```\n\t此指令用于根据预定义的颜色名称来指定字体显示颜色或背景颜色。\n\t所有其他规范均与 `SETCOLOR` 和 `SETBGCOLOR` 相同。参数为颜色名称。预定义的颜色名称遵循 [KnownColor 枚举](https://learn.microsoft.com/ja-jp/dotnet/api/system.drawing.knowncolor)，请参考该文档。\n\n!!! hint \"提示\"\n\n    仅支持指令形式。\n\n!!! example \"例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tSETCOLORBYNAME yellow\n\t\tPRINTL yellow\n\t\tSETCOLORBYNAME green\n\t\tPRINTL green\n\t\tSETCOLORBYNAME blue\n\t\tPRINTW blue\n    ```\n\t![](../assets/images/SETCOLORBYNAME.png)\n\n### 相关项目\n- SETCOLOR"
  },
  {
    "id": "SETFONT",
    "title": "SETFONT 系命令",
    "names": [
      "CHKFONT",
      "SETFONT",
      "GETFONT"
    ],
    "signatures": [
      {
        "name": "CHKFONT",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "SETFONT",
        "params": "`string`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "GETFONT",
        "params": "无",
        "returns": "`string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "CHKFONT 用于检查指定名称的字体是否已安装。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint CHKFONT fontName\n\tSETFONT fontName\n\tstring GETFONT\n    ```\n\t`CHKFONT` 用于检查指定名称的字体是否已安装。\n\t如果已安装，则 `RESULT:0` 被赋值或返回 1；如果未安装，则赋值或返回 0。\n\n\t`SETFONT` 指令使后续的字符串显示使用指定名称的字体。\n\t如果省略参数或指定空字符串，则恢复为 [`emuera.config` 中指定的标准字体](../Emuera/config.md#_31)。\n\t如果指定的字体未安装，则将使用 `Microsoft Sans Serif` 作为替代。\n\t当指定可能未安装的字体时，请在 `SETFONT` 之前参考 `CHKFONT` 的结果。\n\n    `GETFONT` 会将当前使用的字体名称赋值或返回到 `RESULTS:0` 中。\n    这与 `SETFONT` 命令指定的名称相同。\n    当未执行 `SETFONT` 命令时，将赋值 [`emuera.config` 中指定的标准字体](../Emuera/config.md#_31) 的名称。\n\n    这些分别是 EM+EE 的附加功能，现在也可以使用 Emuera 同目录下 `font` 文件夹内的 `ttf`、`otf` 字体文件了。\n\n!!! hint \"提示\"\n\n    `CHKFONT`、`GETFONT` 支持在表达式中作为函数使用。\n\n!!! example \"例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tPRINTL abc123あいう(標準フォント)\n\t\tCHKFONT \"ＭＳ Ｐゴシック\"\n\t\tIF RESULT\n\t\t\tSETFONT \"ＭＳ Ｐゴシック\"\n\t\t\tPRINTL abc123あいう(ＭＳ Ｐゴシック)\n\t\tENDIF\n\t\tCHKFONT \"ＭＳ 明朝\"\n\t\tIF RESULT\n\t\t\tSETFONT \"ＭＳ 明朝\"\n\t\t\tPRINTL abc123あいう(ＭＳ 明朝)\n\t\tENDIF\n\t\tSTR:0 = ＭＳ Ｐ明朝\n\t\tCHKFONT STR:0\n\t\tIF RESULT\n\t\t\tSETFONT STR:0\n\t\t\tPRINTL abc123あいう(ＭＳ Ｐ明朝)\n\t\tENDIF\n\t\tSETFONT\n    ```\n\t![](../assets/images/SETFONT.png)"
  },
  {
    "id": "SETIMAGELAYER",
    "title": "SETIMAGELAYER",
    "names": [
      "SETIMAGELAYER"
    ],
    "signatures": [
      {
        "name": "SETIMAGELAYER",
        "params": "`str`, `int`, `int`, `int`, `int`, `int`, `int`, `var`, `int`",
        "returns": "无",
        "engines": [
          "skia"
        ],
        "overloads": []
      }
    ],
    "summary": "在独立图层上渲染指定 Sprite。与 CBGSETSPRITE 不同，SETIMAGELAYER 的图层与文本行解耦，支持视口裁剪和跟随滚动。",
    "body": "!!! info \"API\"\n\n    ```erb\n    SETIMAGELAYER spriteName, depth(, x, y, width, height, opacity, colorMatrix, followScroll)\n    ```\n\n    在独立图层上渲染指定 Sprite。与 `CBGSETSPRITE` 不同，SETIMAGELAYER 的图层与文本行解耦，支持视口裁剪和跟随滚动。\n\n    **参数**（`spriteName` 和 `depth` 不可省略，其余均可省略）：\n\n    | 参数 | 类型 | 默认值 | 说明 |\n    | :--- | :--- | :----- | :--- |\n    | `spriteName` | str | — | Sprite 名称（不可省略） |\n    | `depth` | int | — | 层深度（不可省略）。正值在文本后方，负值在文本前方 |\n    | `x` | int | `0` | 绘制 X 坐标 |\n    | `y` | int | `0` | 绘制 Y 坐标 |\n    | `width` | int | `0` | 目标宽度。0 表示使用 Sprite 原始宽度 |\n    | `height` | int | `0` | 目标高度。0 表示使用 Sprite 原始高度 |\n    | `opacity` | int | `255` | 不透明度（0～255）。255 为完全不透明 |\n    | `colorMatrix` | var | `null` | 5×5 颜色矩阵数组引用（如 `CM_GRAY:0:0`） |\n    | `followScroll` | int | `0` | 是否跟随文本滚动。0=固定位置，1=随文本滚动 |\n\n    !!! warning \"注意\"\n        - 仅支持命令语法，不支持表达式调用。\n        - `depth` 用于图层排序。相同 `depth` 的图层按添加顺序渲染，不会被覆盖。要删除同一 `depth` 的所有图层，请使用 `CLEARIMAGELAYER depth`。\n        - 第 3～9 参数支持空参数（`,,`），为空时使用默认值。\n        - `SETIMAGELAYERL` 是自动 `followScroll=1` + `GETLINEY` Y 坐标转换的后缀指令，适合需要与 HTML img 对齐的场景。\n        - 可通过 `EXISTSIMAGELAYER(depth)` 检测指定深度的图层是否存在。\n        - 可通过 `CLEARIMAGELAYER depth` 清除指定深度的图层，或 `CLEARIMAGELAYER_ALL` 清除所有图层。\n        - **渲染层级**（v7.0 统一 depth 管线）：SETIMAGELAYER、CBG、escapedParts（含 div）共享同一 depth 排序系统。SETIMAGELAYER 的 depth > div 的 depth 时，图层渲染在 div 之上。\n        - **渲染偏移差异**：SETIMAGELAYER 是像素级精准定位（无偏移），而 HTML `<img>` 渲染时引擎会自动加约 2-4px 的 X 偏移（`DrawingParam_ShapePositionShift`）。\n        - WINAPI 模式不支持此命令。\n\n!!! hint \"提示\"\n\n    仅命令语法可用。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n        ; 基本渲染：在 depth=1 显示 Sprite\n        SETIMAGELAYER \"pet_1\", 1\n\n        ; 指定位置和深度\n        SETIMAGELAYER \"pet_2\", 2, 100, 50\n\n        ; 缩放 + 透明度\n        SETIMAGELAYER \"pet_3\", 3, 200, 100, 150, 150, 200\n\n        ; 颜色矩阵 + 跟随滚动\n        #DIM CM_GRAY, 5, 5\n        CM_GRAY:0:0 =  77, 150,  29,   0,   0\n        CM_GRAY:1:0 =  77, 150,  29,   0,   0\n        CM_GRAY:2:0 =  77, 150,  29,   0,   0\n        CM_GRAY:3:0 =   0,   0,   0, 256,   0\n        CM_GRAY:4:0 =   0,   0,   0,   0, 256\n        SETIMAGELAYER \"pet_4\", 4, 300, 50, 150, 150, 255, CM_GRAY:0:0, 1\n\n        ; 检测图层是否存在\n        IF EXISTSIMAGELAYER(1)\n            PRINTL depth=1 的图层已存在\n        ENDIF\n\n        ; 清除指定图层\n        CLEARIMAGELAYER 1\n\n        ; 清除所有图层\n        CLEARIMAGELAYER_ALL\n    ```\n    ```text\n    depth=1 的图层已存在\n    ```\n\n### 相关项\n- SETIMAGELAYERL\n- CLEARIMAGELAYER\n- EXISTSIMAGELAYER\n- CBGSETSPRITE"
  },
  {
    "id": "SETIMAGELAYERL",
    "title": "SETIMAGELAYERL",
    "names": [
      "SETIMAGELAYERL"
    ],
    "signatures": [
      {
        "name": "SETIMAGELAYERL",
        "params": "`str`, `int`, `int`, `int`, `int`, `int`, `int`, `var`",
        "returns": "无",
        "engines": [
          "skia"
        ],
        "overloads": []
      }
    ],
    "summary": "SETIMAGELAYER 的行相对定位版本。自动设置 followScroll=1，始终锚定当前显示行。定位参数 xpos/ypos 为相对行位置的偏移，与 HTML_PRINT 的 <img> 标签的 xpos/ypos 属性语义一致。当 xpos=0, ypos=0 时，渲染位置与同行的 <img> 完全一…",
    "body": "!!! info \"API\"\n\n    ```erb\n    SETIMAGELAYERL spriteName, depth(, xpos, ypos, width, height, opacity, colorMatrix)\n    ```\n\n    `SETIMAGELAYER` 的行相对定位版本。自动设置 `followScroll=1`，始终锚定当前显示行。定位参数 `xpos`/`ypos` 为相对行位置的偏移，与 `HTML_PRINT` 的 `<img>` 标签的 `xpos`/`ypos` 属性语义一致。当 `xpos=0, ypos=0` 时，渲染位置与同行的 `<img>` 完全一致（包括 `ShapePositionShift` 偏移）。\n\n    **参数**（`spriteName` 和 `depth` 不可省略，其余均可省略）：\n\n    | 参数 | 类型 | 默认值 | 说明 |\n    | :--- | :--- | :----- | :--- |\n    | `spriteName` | str | — | Sprite 名称（不可省略） |\n    | `depth` | int | — | 层深度（不可省略）。正值在文本后方，负值在文本前方 |\n    | `xpos` | int | `0` | 相对行位置的 X 偏移（与 HTML `<img>` 的 `xpos` 属性一致，已包含 `ShapePositionShift`） |\n    | `ypos` | int | `0` | 相对行顶边的 Y 偏移（与 HTML `<img>` 的 `ypos` 属性一致） |\n    | `width` | int | `0` | 目标宽度。0 表示使用 Sprite 原始宽度 |\n    | `height` | int | `0` | 目标高度。0 表示使用 Sprite 原始高度 |\n    | `opacity` | int | `255` | 不透明度（0～255）。255 为完全不透明 |\n    | `colorMatrix` | var | `null` | 5×5 颜色矩阵数组引用（如 `CM_GRAY:0:0`） |\n\n    !!! warning \"注意\"\n        - 仅支持命令语法，不支持表达式调用。\n        - `followScroll` 始终为 `1`（跟随滚动）。需要固定位置的图层请使用 `SETIMAGELAYER`。\n        - 始终锚定当前显示行，不支持指定其他行号。\n        - `xpos` 和 `ypos` 是相对行位置的偏移，与 `SETIMAGELAYER` 的绝对坐标 `x`/`y` 语义不同。\n        - 第 3～8 参数支持空参数（`,,`），为空时使用默认值。\n        - WINAPI 模式不支持此命令。\n\n!!! hint \"提示\"\n\n    当需要将图层放置在 HTML img 相同位置时，使用 `SETIMAGELAYERL` 并设置 `xpos=0, ypos=0` 即可，无需手动计算 `GETLINEY` 或补偿 `ShapePositionShift`。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n        ; 基本渲染：在当前行显示 Sprite（xpos=0, ypos=0，与 HTML img 一致）\n        SETIMAGELAYERL \"pet_1\", 1\n\n        ; 指定 X 偏移\n        SETIMAGELAYERL \"pet_2\", 2, 100\n\n        ; 指定 X/Y 偏移和尺寸\n        SETIMAGELAYERL \"pet_3\", 3, 0, 0, 150, 150, 200\n\n        ; 带颜色矩阵\n        #DIM CM_GRAY, 5, 5\n        CM_GRAY:0:0 =  77, 150,  29,   0,   0\n        CM_GRAY:1:0 =  77, 150,  29,   0,   0\n        CM_GRAY:2:0 =  77, 150,  29,   0,   0\n        CM_GRAY:3:0 =   0,   0,   0, 256,   0\n        CM_GRAY:4:0 =   0,   0,   0,   0, 256\n        SETIMAGELAYERL \"pet_4\", 4, , , 150, 150, 255, CM_GRAY:0:0\n    ```\n\n### 相关项\n- SETIMAGELAYER\n- CLEARIMAGELAYER\n- EXISTSIMAGELAYER\n- GETLINEY"
  },
  {
    "id": "SETSOUNDVOLUME",
    "title": "SETSOUNDVOLUME",
    "names": [
      "SETSOUNDVOLUME"
    ],
    "signatures": [
      {
        "name": "SETSOUNDVOLUME",
        "params": "`int`",
        "returns": "`void`",
        "engines": [
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "将 PLAYSOUND 的音量设置为 0 ～ 100 之间。",
    "body": "!!! info \"API\"\n\n    ```erb\n    SETSOUNDVOLUME int(0～100)\n    ```\n\n    将 `PLAYSOUND` 的音量设置为 `0` ～ `100` 之间。\n\n!!! hint \"提示\"\n\n    只能作为命令使用。\n\n### 相关项目\n- PLAYSOUND"
  },
  {
    "id": "SKIA_RENDER",
    "title": "SET_TEXT_DRAWING_MODE / SET_SKIA_QUALITY",
    "names": [
      "SET_TEXT_DRAWING_MODE",
      "GET_TEXT_DRAWING_MODE",
      "SET_SKIA_QUALITY",
      "GET_SKIA_QUALITY",
      "SKIA_RENDER"
    ],
    "signatures": [
      {
        "name": "SET_TEXT_DRAWING_MODE",
        "params": "`int`",
        "returns": "`int`",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "GET_TEXT_DRAWING_MODE",
        "params": "无",
        "returns": "`int`",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "SET_SKIA_QUALITY",
        "params": "`int`(, `int`, `int`)",
        "returns": "`int`",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "GET_SKIA_QUALITY",
        "params": "`int`",
        "returns": "`int`",
        "engines": [
          "skia"
        ],
        "overloads": []
      }
    ],
    "summary": "Skia（SkiaSharp版）新增的渲染控制 API。动态控制文本的渲染管线和 SkiaSharp 质量参数。",
    "body": "!!! info \"API\"\n\n    ```erb\n    SET_TEXT_DRAWING_MODE modeID\n    int GET_TEXT_DRAWING_MODE\n    SET_SKIA_QUALITY qualityID{, hintingID, edgingID}\n    int GET_SKIA_QUALITY typeID\n    ```\n\n    Skia（SkiaSharp版）新增的渲染控制 API。动态控制文本的渲染管线和 SkiaSharp 质量参数。\n\n    ### SET_TEXT_DRAWING_MODE / GET_TEXT_DRAWING_MODE\n\n    动态切换全局文本渲染管线。\n\n    - **mode = 1**：`TEXTRENDERER` — 使用 GDI+ (TextRenderer) 渲染\n    - **mode = 3**：`SKIASHARP` — 使用 SkiaSharp 渲染\n\n    - `SET_TEXT_DRAWING_MODE`：仅命令语法。成功返回 1，失败返回 0。\n    - `GET_TEXT_DRAWING_MODE`：支持命令和表达式函数。返回当前渲染模式（1=GDI+, 3=SkiaSharp）。\n    - 默认为 `SKIASHARP` (3)。\n    - 切换渲染管线后，已缓存的字体可能需要重新加载才能生效。\n\n    ### SET_SKIA_QUALITY / GET_SKIA_QUALITY\n\n    控制 SkiaSharp 渲染的质量参数。所有参数均可省略，省略时保持当前值不变。\n\n    **SET_SKIA_QUALITY 参数**：\n\n    | 参数 | 值域 | 说明 |\n    | :--- | :--- | :--- |\n    | `quality` | 0～3 | 图像质量等级 |\n    | `hinting` | 0～3 | 字形微调：0=none, 1=slight, 2=normal, 3=full |\n    | `edging` | 0～2 | 抗锯齿方式：0=alias, 1=antialias, 2=subpixel |\n\n    **GET_SKIA_QUALITY 参数**：\n\n    | type | 返回值 |\n    | :--- | :--- |\n    | 0 | 当前 ImageQuality 值 |\n    | 1 | 当前 FontHinting 值 |\n    | 2 | 当前 FontEdging 值 |\n\n    - `SET_SKIA_QUALITY`：仅命令语法。调用后 FontFactory 会清除字体缓存。\n    - `edging=0` (alias) 可实现类似早期 Windows 字体的锐利像素风格。\n    - `edging=2` (subpixel) 提供最佳的视觉平滑效果。\n\n    **默认值（emuera.config）**：\n\n    | 参数 | 默认值 | 说明 |\n    | :--- | :--- | :--- |\n    | ImageQuality | High (3) | 图像质量等级 |\n    | FontHinting | None (0) | 字形微调 |\n    | FontEdging | SubpixelAntiAlias (2) | 抗锯齿方式 |\n\n    !!! warning \"注意\"\n        - `SET_TEXT_DRAWING_MODE` 和 `SET_SKIA_QUALITY` 仅支持命令语法。\n        - `GET_TEXT_DRAWING_MODE` 和 `GET_SKIA_QUALITY` 支持命令和表达式函数两种形式。\n        - 光栅字体（MS Gothic、MS Mincho 等）在 `render` 属性未指定时会自动使用 GDI+ 渲染。如需用 SkiaSharp 渲染，建议配合 `edging='alias'`。\n\n!!! hint \"提示\"\n\n    `SET_TEXT_DRAWING_MODE` 和 `SET_SKIA_QUALITY` 仅命令语法。`GET_TEXT_DRAWING_MODE` 和 `GET_SKIA_QUALITY` 支持命令和表达式函数两种形式。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n        ; 确认当前渲染模式\n        PRINTFORML 当前模式: {GET_TEXT_DRAWING_MODE()}\n\n        ; 设置高质量模式\n        SET_SKIA_QUALITY 3, 2, 2\n        PRINTFORML ImageQuality: {GET_SKIA_QUALITY(0)}\n\n        ; 像素风渲染\n        SET_SKIA_QUALITY 3, 0, 0\n        HTML_PRINT \"像素风文本\"\n\n        ; 切换到 GDI+ 模式\n        SET_TEXT_DRAWING_MODE 1\n        PRINTFORML 切换后模式: {GET_TEXT_DRAWING_MODE()}\n\n        ; 切回 SkiaSharp 模式\n        SET_TEXT_DRAWING_MODE 3\n    ```\n\n### HTML_PRINT font 标签扩展属性\n\n`HTML_PRINT` 的 `<font>` 标签新增以下属性：\n\n| 属性 | 值 | 说明 |\n    | :--- | :--- | :--- |\n    | `render` | `'gdi'` / `'skia'` | 指定渲染管线（覆盖全局设置） |\n    | `edging` | `'alias'` / `'antialias'` / `'subpixel'` | 控制抗锯齿方式 |\n    | `hinting` | `'none'` / `'slight'` / `'normal'` / `'full'` | 控制字形微调程度 |\n    | `size` | 正浮点数（可带 `px` 后缀） | 指定字体大小（像素） |\n\n    - 属性支持**嵌套继承**：内层 `<font>` 未指定的属性会继承外层设置。\n    - `render` 省略时，光栅字体自动使用 GDI+，其他字体遵循全局设置。\n    - `size` 属性支持浮点数（例：`<font size='12.5'>`）。\n\n    ```erb\n    HTML_PRINT \"<font render='gdi' face='MS Gothic'>[♥] GDI+渲染</font>\"\n    HTML_PRINT \"<font edging='alias'>像素风文本</font>\"\n    HTML_PRINT \"<font size='24'>大号字体（24px）</font>\"\n    HTML_PRINT \"<font render='skia' edging='subpixel' hinting='full'>SkiaSharp+高品质</font>\"\n    ```\n\n### 相关项\n- HTML_PRINT\n- SETFONT"
  },
  {
    "id": "SKIP_RELATE",
    "title": "SKIP系",
    "names": [
      "SKIPDISP",
      "NOSKIP",
      "ENDNOSKIP",
      "ISSKIP",
      "MOUSESKIP",
      "MESSKIP",
      "SKIP",
      "SKIP_RELATE"
    ],
    "signatures": [
      {
        "name": "SKIPDISP",
        "params": "`int`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "NOSKIP",
        "params": "无",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "ENDNOSKIP",
        "params": "无",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "ISSKIP",
        "params": "无",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "MOUSESKIP",
        "params": "无",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "MESSKIP",
        "params": "无",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "PRINT等画面输出指令以及WAIT、TWAIT等与控制相关的指令群。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tSKIPDISP bool\n\tNOSKIP\n\tENDNOSKIP\n\tint ISSKIP\n\tint MOUSESKIP\n\tint MESSKIP\n    ```\n\tPRINT等画面输出指令以及WAIT、TWAIT等与控制相关的指令群。\n\n\t- `SKIPDISP` <数值>\n\t\t- 参数：`0` = 设置为不忽略\n\t\t\t- 非0值 = 设置为忽略\n\t\t- 说明：设置此标志后，`PRINT`等输出将完全不会执行。\n\t\t\t- 此外，在此标志被设置期间，若执行到`INPUT`及`INPUTS`指令，\n\t\t\t- 考虑到用户将无从得知应如何操作，且跳过可能导致无限循环，\n\t\t\t- 系统会显示警告信息及处理方法，并引发错误。\n\n    在当前普遍使用的角色对话实现中，当对话内容可以隐藏时，\n    显示与隐藏状态下命令的执行结果或行为可能会发生变化。\n    因此，若在设置此标志后调用对话，则除了显示部分外，其他处理仍会执行，\n    从而可以确保在显示/隐藏状态下获得一致的行为。\n    若遇到与`INPUT/INPUTS`冲突的情况，可采取以下措施：\n    使用下述的`NOSKIP～ENDNOSKIP`包裹相关代码，\n    或先执行`SKIPDISP 0`，在`INPUT`处理后再执行`SKIPDISP 1`（原则上推荐前者）。\n    顺便一提，当前是否设置了忽略标志可通过`ISSKIP`获取。\n    从ver1.808开始，即使将其紧接在`SIF`语句之后也能正常工作。\n    需要注意的是，使用`SKIPDISP`时，无论参数如何，`RESULT:0`都会被重置为`0`，此为既定规格。\n\n    `NOSKIP～ENDNOSKIP`可用于指定忽略显示相关标志的代码区间。\n    被这两个命令包裹的区间，即使在`SKIPDISP 1`状态下，显示等操作也会正常执行。\n    主要用于需要`INPUT`输入的场景。\n    此外，此命令不会影响`SKIPDISP`的状态，\n    因此在可能设置`SKIPDISP`标志的环境下（例如包含显示/隐藏功能的角色对话相关代码），\n    使用此命令可以确保必须显示的内容能够正确显示。\n\n    `ISSKIP`会在`SKIPDISP`标志为非`0`值（即忽略`PRINT`等输出）时，将`1`赋值或返回给`RESULT:0`，否则为`0`。\n\n    `MOUSESKIP` 已在 Emuera 1.810 版本中合并到 `MESSKIP`。\n    请使用 `MESSKIP`。\n    此函数过去曾执行如下处理：\n\n        如果按下右键并处于 WAIT 跳过状态，则返回 1，否则返回 0。\n        在宏处理期间的跳过中返回 0。\n        如果宏处理的跳过与右键按下冲突，则优先宏处理并返回 0。\n        现在，无论是由 Esc 键还是右键引起的跳过，均不加以区分并返回 1。\n\n    `MESSKIP` 在处于 `WAIT` 跳过状态时返回 `1`，否则返回 `0`。\n\n!!! hint \"提示\"\n\n    `ISSKIP`、`MOUSESKIP`、`MESSKIP` 支持在表达式中作为函数使用。"
  },
  {
    "id": "SKIPLOG",
    "title": "SKIPLOG",
    "names": [
      "SKIPLOG"
    ],
    "signatures": [
      {
        "name": "SKIPLOG",
        "params": "`int`",
        "returns": "`void`",
        "engines": [
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "用于手动控制通过左键点击等方式跳过日志的状态。非0值启用跳过，0值解除跳过状态。",
    "body": "!!! info \"API\"\n\n\t```erb\n\tSKIPLOG bool\n\t```\n\n\t用于手动控制通过左键点击等方式跳过日志的状态。非0值启用跳过，0值解除跳过状态。\n\n!!! hint \"提示\"\n\n    仅可作为指令使用。"
  },
  {
    "id": "SORTCHARA",
    "title": "SORTCHARA",
    "names": [
      "SORTCHARA"
    ],
    "signatures": [
      {
        "name": "SORTCHARA",
        "params": "`charaVariable`, `keyword`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "根据任意键对角色列表进行排序。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tSORTCHARA charaVariable, FORWARDorBACK\n    ```\n\t根据任意键对角色列表进行排序。\n\t排序键可以是字符串变量（如`NAME`）、数值型变量（如`NO`）或数值数组变量（如`CFLAG`）。\n\t`charaVariable`可以省略，省略时则按角色注册编号 (NO)(`NO:XX`)排序。\n\t`FORWARD`表示升序，`BACK`表示降序。省略时默认为升序排序。\n\t`MASTER`不会被纳入排序对象。\n\t此外，`TARGET:0`、`ASSI:0`会自动跟随排序结果，无需在排序后手动操作。\n\t但是，使用了`TARGET:1`等变体的场合，需要手动使其跟随排序结果。\n\n    ```erb\n\t;按NO升序排序\n\tSORTCHARA\n\t;按NO降序排序\n\tSORTCHARA BACK\n\t;按CFLAG:2升序排序\n\tSORTCHARA CFLAG:2\n\t;按NAME降序排序\n\tSORTCHARA NAME, BACK\n\t```\n\n\t另外，即使`TARGET == -1`，也不会实际去引用`CFLAG:2`等值，因此不会出错。\n\n!!! hint \"提示\"\n\n    仅支持指令。\n\n### 相关项目\n- SWAPCHARA"
  },
  {
    "id": "SOUNDCONTROL",
    "title": "SOUNDCONTROL, BGMCONTROL, GETSOUNDORBGMINFO, ISPLAYINGSOUND, ISPLAYINGBGM",
    "names": [
      "SOUNDCONTROL",
      "BGMCONTROL",
      "GETSOUNDORBGMINFO",
      "ISPLAYINGSOUND",
      "ISPLAYINGBGM"
    ],
    "signatures": [
      {
        "name": "SOUNDCONTROL",
        "params": "`int`, `int`{, `int`, `int`}",
        "returns": "`int`",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "BGMCONTROL",
        "params": "`int`{, `int`, `int`}",
        "returns": "`int`",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "GETSOUNDORBGMINFO",
        "params": "`int`{, `int`}",
        "returns": "`int`",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "ISPLAYINGSOUND",
        "params": "{`int`}",
        "returns": "`int`",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "ISPLAYINGBGM",
        "params": "无",
        "returns": "`int`",
        "engines": [
          "skia"
        ],
        "overloads": []
      }
    ],
    "summary": "控制声音通道的播放。",
    "body": "!!! info \"API — SOUNDCONTROL\"\n\n    ```erb\n\tint SOUNDCONTROL channelId, action {, speed, preservePitch}\n    ```\n\t控制声音通道的播放。\n\n\t**参数**\n\n\t| 参数 | 类型 | 说明 |\n\t| :--- | :--- | :--- |\n\t| `channelId` | `int` | 声音通道编号（0～9） |\n\t| `action` | `int` | 控制动作（见下表） |\n\t| `speed` | `int` | `action=3` 时的播放速度（百分比，100=正常速度） |\n\t| `preservePitch` | `int` | `action=3` 时的音调保持（0=改变音调，1=保持音调，省略时=1） |\n\n\t**action 值**\n\n\t| 值 | 动作 | 额外参数 |\n\t| :--- | :--- | :--- |\n\t| 0 | 暂停 | 无 |\n\t| 1 | 恢复 | 无 |\n\t| 2 | 停止 | 无 |\n\t| 3 | 变速 | `speed`, `preservePitch` |\n\n\t**返回值**：成功时 `1`，无效通道编号时 `-1`，无效控制动作时 `-2`\n\n!!! info \"API — BGMCONTROL\"\n\n    ```erb\n\tint BGMCONTROL action {, speed, preservePitch}\n    ```\n\t控制 BGM 通道的播放。是 `SOUNDCONTROL` 的 BGM 版本。\n\n\t**参数**\n\n\t| 参数 | 类型 | 说明 |\n\t| :--- | :--- | :--- |\n\t| `action` | `int` | 控制动作（与 `SOUNDCONTROL` 相同） |\n\t| `speed` | `int` | `action=3` 时的播放速度（百分比，100=正常速度） |\n\t| `preservePitch` | `int` | `action=3` 时的音调保持（0=改变音调，1=保持音调，省略时=1） |\n\n\t**返回值**：成功时 `1`，无效控制动作时 `-2`\n\n!!! info \"API — GETSOUNDORBGMINFO\"\n\n    ```erb\n\tint GETSOUNDORBGMINFO channelId {, infoType}\n    ```\n\t获取声音或 BGM 通道的播放信息。`channelId` 指定为 `-1` 时表示 BGM 通道。\n\n\t**参数**\n\n\t| 参数 | 类型 | 说明 |\n\t| :--- | :--- | :--- |\n\t| `channelId` | `int` | 声音通道编号（0～9），`-1` 表示 BGM |\n\t| `infoType` | `int` | 获取的信息类型（省略时将所有信息存入 RESULT 数组） |\n\n\t**infoType 值**\n\n\t| 值 | 获取信息 | 单位 |\n\t| :--- | :--- | :--- |\n\t| 1 | 总时长 | 毫秒 |\n\t| 2 | 当前播放位置 | 毫秒 |\n\t| 3 | 播放状态 | 0=已暂停，1=播放中 |\n\t| 4 | 通道音量 | 0～100 |\n\t| 5 | 播放速度 | 百分比（100=正常速度） |\n\n\t省略 `infoType` 时，`RESULT:0`～`RESULT:4` 依次存储上述5项信息，函数返回值为 `RESULT:0`（总时长）。\n\n!!! info \"API — ISPLAYINGSOUND\"\n\n    ```erb\n\tint ISPLAYINGSOUND {channelId}\n    ```\n\t检查声音通道是否正在播放。\n\n\t指定 `channelId` 时，如果该通道正在播放则返回通道编号，否则返回 `-1`。\n\t省略 `channelId` 时，从第一个通道开始搜索，返回第一个正在播放的通道编号；如果没有正在播放的通道则返回 `-1`。\n\n!!! info \"API — ISPLAYINGBGM\"\n\n    ```erb\n\tint ISPLAYINGBGM\n    ```\n\t检查 BGM 是否正在播放。正在播放时返回 `1`，否则返回 `0`。\n\n!!! hint \"提示\"\n\n    所有函数均作为表达式函数使用。\n\t变速功能使用 SoundTouch 库实现。\n\n!!! example \"例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\t; 获取 BGM 播放信息\n\t\tGETSOUNDORBGMINFO -1\n\t\tPRINTFORML 总时长: {RESULT:0}ms  当前位置: {RESULT:1}ms\n\n\t\t; 检查 BGM 是否正在播放\n\t\tIF ISPLAYINGBGM\n\t\t\tPRINTFORML BGM 正在播放\n\t\t\t; 暂停 BGM\n\t\t\tBGMCONTROL 0\n\t\tENDIF\n\n\t\t; 将通道0设为2倍速（保持音调）\n\t\tSOUNDCONTROL 0, 3, 200, 1\n\n\t\t; 获取通道0的播放速度\n\t\tGETSOUNDORBGMINFO 0, 5\n\t\tPRINTFORML 速度: {RESULT}%\n\n\t\t; 查找正在播放的声音通道\n\t\tLOCAL = ISPLAYINGSOUND()\n\t\tPRINTFORML 正在播放的通道: {LOCAL}\n\t\tWAIT\n    ```\n\n### 相关项目\n- PLAYSOUND\n- PLAYBGM\n- STOPSOUND\n- STOPBGM\n- SETSOUNDVOLUME\n- SETBGMVOLUME"
  },
  {
    "id": "SPLIT",
    "title": "SPLIT, STRJOIN",
    "names": [
      "SPLIT",
      "STRJOIN"
    ],
    "signatures": [
      {
        "name": "SPLIT",
        "params": "`string`, `string`, `stringArray`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "STRJOIN",
        "params": "`stringArray`(, `string`, `int`, `int`)",
        "returns": "`string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "SPLIT 命令将第一个参数指定的字符串，以第二个参数指定的字符串作为分隔符进行分割，并将结果赋值给第三个参数指定的字符串数组变量。",
    "body": "!!! info \"API\"\n\n    ```erb\n    SPLIT string, sepalateWord, stringArray\n    string STRJOIN stringArray(, sepalateWord, startIndex, joinCount)\n    ```\n    `SPLIT` 命令将第一个参数指定的字符串，以第二个参数指定的字符串作为分隔符进行分割，并将结果赋值给第三个参数指定的字符串数组变量。\n    同时，将分割后的数量赋值给 `RESULT`。\n    第三个参数指定的变量必须是数组变量。\n\n    ```erb\n    SPLIT \"あい,うえ,,お\", \",\", LOCALS\n    ```\n\n    上述脚本执行后，`LOCALS:0` 将被赋值为 `あい`，`LOCALS:1` 为 `うえ`，`LOCALS:2` 为空字符串，`LOCALS:3` 为 `お`，`RESULT` 为 `4`。\n    如果分割后的元素数量超过了第3个参数所能容纳的元素数量，超出的部分将不会被赋值。\n    `RESULT` 中存放的是实际的分割数量，请据此进行判断。\n\n    `STRJOIN` 是与 `SPLIT` 功能相反的字符串连接指令。如果指定了角色变量，可能会引发错误。\n    `sepalateWord` 是在连接时插入在元素之间的字符串。与其他语言中的同类处理类似，省略时默认自动应用 `,`（若不需要分隔符，请传入 `\"\"`）。\n    如果指定了 `startIndex` 和 `joinCount`，则会在 `数组起始下标 ≤ i < 起始下标 + 数组元素数量` 的范围内进行连接。\n    指定后者时，前者不可省略。\n\n!!! hint \"提示\"\n\n    `STRJOIN` 支持在表达式中作为函数使用。\n\n!!! example \"例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tSPLIT \"あい,うえ,,お\", \",\", LOCALS\n\t\tREPEAT RESULT\n\t\t\tPRINTFORML %LOCALS:COUNT%\n\t\tREND\n\t\tPRINTFORMW %STRJOIN(LOCALS, \"\")%\n    ```\n    ```text\n\tあい\n\tうえ\n\n\tお\n\tあいうえお\n    ```"
  }
];
