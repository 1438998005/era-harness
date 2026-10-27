// 本文件由 scripts/build-reference.ts 生成，请勿手工修改。
//
// 数据来源：https://github.com/qirchen421/emuera.sk.doc  docs/Reference、docs/Emuera、docs/tutorial/*.zh.md
// 上游版本：41451be6091363e37ed066aaf04416decbf0127f
// 许可：CC BY-NC 4.0（http://creativecommons.org/licenses/by-nc/4.0/）
//       与本仓库代码的 Apache-2.0 分开管理，见 NOTICE-emuera-sk-doc.md
import type { ReferenceEntry } from '../types.js';

export const ENTRIES_PART_07: readonly ReferenceEntry[] = [
  {
    "id": "MATCH",
    "title": "MATCH",
    "names": [
      "MATCH"
    ],
    "signatures": [
      {
        "name": "MATCH",
        "params": "`array`, `any`, `int`, `int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "MATCH 函数用于返回 array 指定的数组变量中，与 value 值相等的元素数量。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint MATCH array, value(, start, end)\n    ```\n    `MATCH` 函数用于返回 `array` 指定的数组变量中，与 `value` 值相等的元素数量。\n    `value` 的类型必须与 `array` 相同。\n    `array` 指定要搜索的一维数组，并在 `start` 以上、`end` 未满的元素范围内进行搜索。\n    如果省略 `end`，则搜索范围直到数组的最后一个元素。\n    `RESULT = MATCH(X, Y, A, B)` 的结果等同于：\n\n            RESULT = 0\n            FOR COUNT, A, B\n                IF X:COUNT == Y\n                    RESULT += 1\n                ENDIF\n            REND\n\n    与以下代码等价。（即使指定字符串数组和字符串表达式代替`X`、`Y`也能正常工作）\n    `array`只能指定一维数组变量，不能指定多维数组。\n    当`array`指定为`CFLAG`等角色数组时，仅对指定的角色进行计数。\n\n!!! hint \"提示\"\n\n    同时支持指令和表达式函数两种形式。\n\n### 相关项目\n- GROUPMATCH",
    "sourcePath": "docs/Reference/MATCH.zh.md"
  },
  {
    "id": "MATCHALL",
    "title": "MATCHALL / MATCHALLEX",
    "names": [
      "MATCHALL",
      "MATCHALLEX"
    ],
    "signatures": [
      {
        "name": "MATCHALL",
        "params": "`variable`, `any`(, `int`, `int`, `variable`)",
        "returns": "`int`",
        "engines": [
          "net",
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "MATCHALLEX",
        "params": "`string`, `any`(, `int`, `int`, `variable`)",
        "returns": "`int`",
        "engines": [
          "net",
          "skia"
        ],
        "overloads": []
      }
    ],
    "summary": "在数组中搜索所有匹配值的索引，返回匹配数量。",
    "body": "!!! info \"API\"\n\n    ```erb\n    MATCHALL var, value[, beg, end[, outArr]]\n    MATCHALLEX \"varName\", value[, beg, end[, outArr]]\n    ```\n    在数组中搜索所有匹配值的索引，返回匹配数量。\n\n    - 第一参数：`MATCHALL` 为变量引用，`MATCHALLEX` 为字符串变量名\n    - 第二参数：搜索值（类型需与数组元素类型一致）\n    - 第三参数（可选）：搜索起始索引（默认 0）\n    - 第四参数（可选）：搜索结束索引（默认数组长度）\n    - 第五参数（可选）：输出数组变量引用，匹配的索引将写入该数组（从 0 开始）\n\n    返回值：匹配的元素数量。未找到返回 0。\n\n!!! hint \"提示\"\n\n    支持命令语法（`MATCHALL ARR, 2`）与表达式语法（`LOCAL = MATCHALL(ARR, 2)`）两种形式。作为命令调用时结果写入 `RESULT` 数组。与 MATCH 不同，MATCHALL 返回所有匹配位置而非仅计数。\n\n    `MATCHALL` 与 `MATCHALLEX` 的区别类似于 `GETNUM` 与 `GETNUMB`：\n    - `MATCHALL` 第一参数是变量引用（编译期解析），性能更好\n    - `MATCHALLEX` 第一参数是字符串变量名（运行期解析），灵活性更高\n\n    当第五参数数组长度不足时，多余的匹配索引被静默丢弃，返回值仍为实际匹配数量。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n        #DIM ARR, 10 = 1, 2, 3, 2, 5, 2, 7, 8, 2, 10\n        #DIM IDX, 10\n\n        ; 仅计数\n        LOCAL = MATCHALL(ARR, 2)\n        PRINTFORML 找到 {LOCAL} 个 2\n\n        ; 输出索引到 IDX\n        LOCAL = MATCHALL(ARR, 2, 0, 10, IDX)\n        FOR I, 0, LOCAL\n            PRINTFORML IDX:{I} = {IDX:I}\n        NEXT\n    ```\n    ```text\n    找到 4 个 2\n    IDX:0 = 1\n    IDX:1 = 3\n    IDX:2 = 5\n    IDX:3 = 8\n    ```\n\n### 相关项目\n- MATCH — 仅计数首个匹配\n- FINDELEMENT — 查找单个元素位置",
    "sourcePath": "docs/Reference/MATCHALL.zh.md"
  },
  {
    "id": "MATH_EXTENSION",
    "title": "数学扩展函数",
    "names": [
      "CBRT",
      "LOG",
      "LOG10",
      "EXPOMENT",
      "MATH_EXTENSION"
    ],
    "signatures": [
      {
        "name": "CBRT",
        "params": "`int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "LOG",
        "params": "`int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "LOG10",
        "params": "`int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "EXPOMENT",
        "params": "`int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "以下摘自私家改造版更新日志",
    "body": "## 基本数学函数\n\n!!! info \"API\"\n\n    ```erb\n    int CBRT value\n    int LOG value\n    int LOG10 value\n    int EXPOMENT value\n    ```\n\n    以下摘自私家改造版更新日志\n\n        新增数学函数作为表达式内函数\n        CBRT（立方根）\n        LOG（自然对数）\n        LOG10（常用对数）\n        EXPONENT（指数函数）\n        所有格式均为：函数名(参数)\n\n    由于 Emuera 无法处理小数，使用时需要一些技巧。\n\n## 三角函数\n\n| 函数名                                                          | 参数          | 返回值              |\n| :-------------------------------------------------------------- | :------------ | :------------------ |\n| [Skia]`SIN`   | `int`/`float` | `int`/`float`（同型） |\n| [Skia]`COS`   | `int`/`float` | `int`/`float`（同型） |\n| [Skia]`TAN`   | `int`/`float` | `int`/`float`（同型） |\n| [Skia]`ASIN`  | `int`/`float` | `int`/`float`（同型） |\n| [Skia]`ACOS`  | `int`/`float` | `int`/`float`（同型） |\n| [Skia]`ATAN`  | `int`/`float` | `int`/`float`（同型） |\n\n!!! info \"API\"\n\n    ```erb\n    int/float SIN angle\n    int/float COS angle\n    int/float TAN angle\n    int/float ASIN value\n    int/float ACOS value\n    int/float ATAN value\n    ```\n\n    Skia（SkiaSharp版）新增。C# 原生三角函数。\n\n    **同名重载**：函数名不区分 Int/Float 版本（无 F 后缀变体）。当参数为 Float 类型时返回 Float，为 Int 类型时返回 Int。与运算符重载一致（`1 + 2.0` 返回 Float，`SIN(1.0)` 也返回 Float）。\n\n    - 参数均为**弧度制**。如需角度转弧度，使用 `angle * PI() / 180`。\n    - `ASIN`/`ACOS` 的参数必须在 `[-1, 1]` 范围内，超出时抛出错误。\n    - Int 版本返回截断小数后的整数值（如 `SIN(1) = 0`，因为 sin(1 rad) ≈ 0.84 → 截断为 0）。\n    - Float 版本返回完整的 double 精度浮点数。\n\n## 端数处理\n\n| 函数名                                                            | 参数          | 返回值              |\n| :---------------------------------------------------------------- | :------------ | :------------------ |\n| [Skia]`FLOOR`   | `int`/`float` | `int`/`float`（同型） |\n| [Skia]`CEIL`    | `int`/`float` | `int`/`float`（同型） |\n| [Skia]`ROUND`   | `int`/`float` | `int`/`float`（同型） |\n\n!!! info \"API\"\n\n    ```erb\n    int/float FLOOR value\n    int/float CEIL value\n    int/float ROUND value\n    ```\n\n    Skia（SkiaSharp版）新增。端数处理函数。同名重载（与三角函数相同）。\n\n    - `FLOOR`：向下取整（向负无穷方向）。\n    - `CEIL`：向上取整（向正无穷方向）。\n    - `ROUND`：四舍五入（`MidpointRounding.AwayFromZero`，0.5 向远离零的方向舍入）。\n    - Int 版本对整数参数无实际效果（整数本身已是整数），主要供语义完整性使用。\n    - Float 版本返回浮点数结果。\n\n!!! hint \"提示\"\n\n    基本数学函数同时支持命令和表达式内函数。三角函数和端数处理仅支持表达式内函数（在表达式中使用）。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n        ; 三角函数（弧度制，Int参数→Int返回值）\n        PRINTFORML SIN(1) = {SIN(1)}\n        PRINTFORML COS(1) = {COS(1)}\n\n        ; Float版（Float参数→Float返回值）\n        #DIMF rad = 0.7853981633974483\n        PRINTFORML SIN(rad) = {SIN(rad)}\n        PRINTFORML COS(rad) = {COS(rad)}\n\n        ; 反三角函数\n        PRINTFORML ASIN(0) = {ASIN(0)}\n        PRINTFORML ACOS(0) = {ACOS(0)}\n\n        ; 端数处理\n        #DIMF val = 3.7\n        PRINTFORML FLOOR(val) = {FLOOR(val)}\n        PRINTFORML CEIL(val) = {CEIL(val)}\n        PRINTFORML ROUND(val) = {ROUND(val)}\n    ```\n    ```text\n    SIN(1) = 0\n    COS(1) = 0\n    SIN(rad) = 0.707106781186548\n    COS(rad) = 0.707106781186548\n    ASIN(0) = 0\n    ACOS(0) = 1\n    FLOOR(val) = 3\n    CEIL(val) = 4\n    ROUND(val) = 4\n    ```",
    "sourcePath": "docs/Reference/MATH_EXTENSION.zh.md"
  },
  {
    "id": "MAX",
    "title": "MAX, MIN, LIMIT, INRANGE",
    "names": [
      "MAX",
      "MIN",
      "LIMIT",
      "INRANGE",
      "A",
      "SIF"
    ],
    "signatures": [
      {
        "name": "MAX",
        "params": "`int`(, `int`...)",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "MIN",
        "params": "`int`(, `int`...)",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "LIMIT",
        "params": "`int`, `int`, `int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "INRANGE",
        "params": "`int`, `int`, `int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "MAX 返回参数中的最大值。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint MAX int(, int...)\n\tint MIN int(, int...)\n\tint LIMIT int, minValue, maxValue\n\tint INRANGE int, minValue, maxValue\n    ```\n\t`MAX` 返回参数中的最大值。\n\n\t`MIN` 返回参数中的最小值。\n\n\t`LIMIT` 返回第一个参数的值。\n\t但是，如果第一个参数小于第二个参数，则返回第二个参数的值；如果大于第三个参数，则返回第三个参数的值。\n\t例如，当你想将 `X - Y` 赋值给 `A`，但希望赋值后的值在 `0` 到 `100` 之间时，通常需要这样写：\n\n    ```erb\n\tA = X - Y\n\tSIF A < 0\n\t\tA = 0\n\tSIF A > 100\n\t\tA = 100\n\t```\n\n\t使用 `LIMIT` 命令可以将此操作简化为两行甚至一行。\n\n    ```erb\n    LIMIT X - Y, 0, 100\n    A = RESULT\n\n    A = LIMIT(X - Y, 0, 100)\n    ```\n\n    `INRANGE` 在第一参数的值大于等于第二参数且小于等于第三参数时返回 `1`，在第一参数小于第二参数或大于第三参数时返回 `0`。\n\n!!! hint \"提示\"\n\n    该功能同时支持命令形式和函数形式。\n\n### 相关项目\n- MAXARRAY,MINARRAY",
    "sourcePath": "docs/Reference/MAX.zh.md"
  },
  {
    "id": "MAXMINARRAY",
    "title": "MAXARRAY, MINARRAY",
    "names": [
      "MAXARRAY",
      "MINARRAY",
      "MAXMINARRAY"
    ],
    "signatures": [
      {
        "name": "MAXARRAY",
        "params": "`integerArray`, `int`, `int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "MINARRAY",
        "params": "`integerArray`, `int`, `int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "返回数组最大值或最小值的函数。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint MAXARRAY integerArray(, start, end)\n\tint MINARRAY integerArray(, start, end)\n    ```\n\t返回数组最大值或最小值的函数。\n\t在`integerArray`中指定要搜索的一维数组，并在`start`以上`end`未满的元素范围内进行搜索。\n\t如果省略`end`，则搜索范围直到数组的最后一个元素。\n\t`RESULT = MAXARRAY(X, A, B)`的结果等同于\n\n\t\tRESULT = X:A\n\t\tFOR COUNT, A, B\n\t\t\tIF X:COUNT > RESULT\n\t\t\t\tRESULT = X:COUNT\n\t\t\tENDIF\n\t\tREND\n\n    与以下代码等价。\n    `integerArray` 仅可指定数值型一维数组变量，不能指定字符串变量或多维数组。\n    若在 `integerArray` 中指定了 `CFLAG` 等角色数组，则仅搜索指定的角色。\n\n!!! hint \"提示\"\n\n    同时支持指令和表达式函数两种形式。\n\n### 相关项目\n- MAX,MIN",
    "sourcePath": "docs/Reference/MAXMINARRAY.zh.md"
  },
  {
    "id": "MONEYSTR",
    "title": "MONEYSTR",
    "names": [
      "MONEYSTR"
    ],
    "signatures": [
      {
        "name": "MONEYSTR",
        "params": "`int`, `option`",
        "returns": "`string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "对于参数给定的数值，将附有已设定的货币单位的字符串赋值给RESULTS:0或返回。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tstring MONEYSTR\n    ```\n    对于参数给定的数值，将附有[已设定的货币单位](../Emuera/replace.zh.md)的字符串赋值给`RESULTS:0`或返回。\n    单位的前置/后置也会自动处理。\n    第二个参数与`TOSTR`指令类似，是数值字符串化时的转换格式指定符。\n\n!!! hint \"提示\"\n\n    同时支持指令和表达式函数两种形式。",
    "sourcePath": "docs/Reference/MONEYSTR.zh.md"
  },
  {
    "id": "MOUSEB",
    "title": "MOUSEB",
    "names": [
      "MOUSEB"
    ],
    "signatures": [
      {
        "name": "MOUSEB",
        "params": "无",
        "returns": "`string`",
        "engines": [
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "获取鼠标悬停中的按钮内容",
    "body": "!!! info \"API\"\n\n\t```erb\n\tstring MOUSEB\n\t```\n\n\t获取鼠标悬停中的按钮内容\n\n!!! hint \"提示\"\n\n    支持在表达式中使用\n\t可与 AWAIT 组合使用\n\t由于执行时点无法确定是 `INPUT` 还是 `INPUTS`，因此返回字符串类型\n\n### 相关项目\n- AWAIT",
    "sourcePath": "docs/Reference/MOUSEB.zh.md"
  },
  {
    "id": "MOUSEXY",
    "title": "MOUSEX, MOUSEY",
    "names": [
      "MOUSEX",
      "MOUSEY",
      "MOUSEXY"
    ],
    "signatures": [
      {
        "name": "MOUSEX",
        "params": "无",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "MOUSEY",
        "params": "无",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "获取鼠标光标当前的X坐标或Y坐标。",
    "body": "!!! info \"API\"\n\n    ```erb\n    MOUSEX\n    MOUSEY\n    ```\n    获取鼠标光标当前的X坐标或Y坐标。\n    坐标是相对于客户端区域左下角位置(0,0)的相对位置，右方向为x轴正方向，下方向为y轴正方向。\n    请注意，当光标位于客户端区域内时，MOUSEY会返回负值。\n    客户端区域的大小可以通过`CLIENTWIDTH`、`CLIENTHEIGHT`函数获取。\n    （如果需要以客户端区域左上角为基准的Y坐标，可以通过`MOUSEY()+CLIENTHEIGHT()`获取）\n    即使Emuera窗口未处于活动状态，或者鼠标光标位于窗口外，此函数也能正常工作。\n\n!!! hint \"提示\"\n\n    同时支持指令和表达式函数两种形式。\n\n### 相关项目\n- AWAIT",
    "sourcePath": "docs/Reference/MOUSEXY.zh.md"
  },
  {
    "id": "ONEINPUT",
    "title": "ONEINPUT(S)",
    "names": [
      "ONEINPUT",
      "ONEINPUTS"
    ],
    "signatures": [
      {
        "name": "ONEINPUT",
        "params": "`int`(, `int`)",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "ONEINPUTS",
        "params": "`string`(, `int`)",
        "returns": "`string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "单字符限定输入自动处理指令 ONEINPUT、ONEINPUTS",
    "body": "!!! info \"API\"\n\n    ```erb\n\tONEINPUT defaultValue\n\tONEINPUTS defaultValue\n    ```\n\t单字符限定输入自动处理指令 `ONEINPUT`、`ONEINPUTS`\n\t格式：`ONEINPUT` 或 `ONEINPUTS`\n\t功能：仅接受单个字符的输入，输入后自动进行下一步处理\n\n    使用粘贴等方式一次性输入多位数（多个字符）时，仅第一个数字（字符）会被视为有效输入进行处理。\n    与`INPUT`和`INPUTS`类似，可以通过参数设置输入空字符串时的默认值。\n    但是，当`ONEINPUT`指定了负值，或`ONEINPUTS`指定了空字符串时，参数将无效，行为与无参数时相同。\n    此外，若参数为多位数（多个字符），则仅第一个数字（字符）会被作为默认值。\n    省略参数并输入空字符串时，`ONEINPUT`会要求重新输入，`ONEINPUTS`则会将空字符串赋值给`RESULTS`并继续执行后续处理，这与通常行为一致。\n    对于`ONEINPUTS`，即使直接按Enter键保持空字符串，也会被视为输入了空字符串。\n    需要注意的是，使用这些指令时，即使Emuera的CONFIG设置中启用了键盘宏功能，\n    也可能出现无法正常工作的情况，这是预期行为。\n    此外，在`ONEINPUTS`中，与`INPUTS`一样可以使用宏表达式。\n    若需将`()`作为字符串使用，请使用`\\`进行转义。\n\n!!! hint \"提示\"\n\n    仅支持命令。\n### 相关项目\n- INPUT\n- WAITANYKEY",
    "sourcePath": "docs/Reference/ONEINPUT.zh.md"
  },
  {
    "id": "OUTPUTLOG",
    "title": "OUTPUTLOG",
    "names": [
      "OUTPUTLOG"
    ],
    "signatures": [
      {
        "name": "OUTPUTLOG",
        "params": "(`string`)",
        "returns": "无",
        "engines": [
          "emuera",
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "这是日志输出命令 OUTPUTLOG。过度使用会缩短磁盘寿命，请适度使用。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tOUTPUTLOG (filePath)\n    ```\n    这是日志输出命令 `OUTPUTLOG`。过度使用会缩短磁盘寿命，请适度使用。\n    另外，日志的字符编码是 Unicode。\n    在 EM+EE 中，通过指定参数，可以输出为指定的文件名.扩展名。字面量规则与 `PRINTS` 等相同。\n    `v5fix` 版本修复了可以指定父目录的漏洞。可以指定子目录。\n\n!!! hint \"提示\"\n\n    仅支持命令形式。\n\n### 相关项目\n- SAVETEXT",
    "sourcePath": "docs/Reference/OUTPUTLOG.zh.md"
  },
  {
    "id": "PICKUPCHARA",
    "title": "PICKUPCHARA",
    "names": [
      "PICKUPCHARA"
    ],
    "signatures": [
      {
        "name": "PICKUPCHARA",
        "params": "`int`(, `int`...)",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "此指令仅保留参数指定的角色，并删除所有其他角色。",
    "body": "!!! info \"API\"\n\n    ```erb\n    PICKUPCHARA charaID(, charaID...)\n    ```\n    此指令仅保留参数指定的角色，并删除所有其他角色。\n    `MASTER:0`、`TARGET:0`、`ASSI:0` 等会自动跟随调整，指令执行后无需手动重新设置。\n    若为目标角色指定负值将导致错误，但若将 `MASTER`、`TARGET`、`ASSI` 等变量本身设为目标，\n    且这些变量内容为负值时，则作为例外不会出错（会被忽略）。\n\n!!! hint \"提示\"\n\n    仅支持指令形式。\n\n### 相关项目\n- DELCHARA\n- DELALLCHARA",
    "sourcePath": "docs/Reference/PICKUPCHARA.zh.md"
  },
  {
    "id": "PLAYBGM",
    "title": "PLAYBGM",
    "names": [
      "PLAYBGM"
    ],
    "signatures": [
      {
        "name": "PLAYBGM",
        "params": "`string`",
        "returns": "`void`",
        "engines": [
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "循环播放指定的音频文件（位于 ./sound/ 目录下）。",
    "body": "!!! info \"API\"\n\n    ```erb\n    PLAYBGM MediaFile\n    ```\n\n    循环播放指定的音频文件（位于 `./sound/` 目录下）。\n\n!!! hint \"提示\"\n\n    只能作为命令使用。\n    最多可以同时播放 10 个音频文件。\n    因为使用了 WMPLib 支持库，所以允许使用 Windows Media Player 进行播放。\n\n### 相关项目\n- PLAYSOUND\n- STOPBGM\n- SETBGMVOLUME",
    "sourcePath": "docs/Reference/PLAYBGM.zh.md"
  },
  {
    "id": "PLAYSOUND",
    "title": "PLAYSOUND",
    "names": [
      "PLAYSOUND"
    ],
    "signatures": [
      {
        "name": "PLAYSOUND",
        "params": "`string`",
        "returns": "`void`",
        "engines": [
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "播放一次指定的音频文件（位于 ./sound/ 目录下）。",
    "body": "!!! info \"API\"\n\n\t```erb\n\tPLAYSOUND MediaFile\n\t```\n\n\t播放一次指定的音频文件（位于 `./sound/` 目录下）。\n\n!!! hint \"提示\"\n\n    只能作为命令使用。\n    最多可以同时播放 10 个音频文件。\n    因为使用了 WMPLib 支持库，所以允许使用 Windows Media Player 进行播放。\n\n### 関連項目\n- PLAYBGM\n- SETSOUNDVOLUME",
    "sourcePath": "docs/Reference/PLAYSOUND.zh.md"
  },
  {
    "id": "POWER",
    "title": "POWER",
    "names": [
      "POWER"
    ],
    "signatures": [
      {
        "name": "POWER",
        "params": "`integerVariable`, `int`, `int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": [
          "`int`, `int`"
        ]
      }
    ],
    "summary": "命令和函数形式的参数不同。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tPOWER integerVariable, int, int\n\tint POWER int, int\n\tint/float POWER int/float, int/float\n    ```\n    命令和函数形式的参数不同。\n    命令形式下，会将第二个参数的数值以第三个参数为指数进行乘方运算，结果赋值给第一个参数的变量。\n    函数形式下，会将第一个参数的数值以第二个参数为指数进行乘方运算，并返回结果。\n\n    !!! warning \"Skia 版：函数形式的动态返回类型\"\n\n        Skia 版中，函数形式 `POWER` 传入 Float 型参数时返回 Float 型（`CanReturnFloat` 机制）。所有参数为 Integer 型时，仍返回 Integer 型。\n\n        ```erb\n        POWER(2, 32) - 1      ; Integer → 4294967295\n        POWER(1.1, 6) * 200   ; Float → 354.3122\n        ```\n\n!!! hint \"提示\"\n\n    同时支持命令形式和函数形式。\n\n!!! example \"例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tADDVOIDCHARA\n\t\tTARGET = 0\n\t\tX = 11\n\t\tY = 2\n\t\tPOWER A, X, 2\n\t\tPRINTFORML <TEST1> = {A}\n\t\tPOWER CFLAG:2, X + 1, Y + 1\n\t\tPRINTFORML <TEST2> = {CFLAG:2}\n    ```\n    ```text\n\t<TEST1> = 121\n\t<TEST2> = 1728\n    ```\n\n### 相关项目\n- CBRT, LOG, LOG10, EXPOMENT",
    "sourcePath": "docs/Reference/POWER.zh.md"
  },
  {
    "id": "PRINT",
    "title": "PRINT 系",
    "names": [
      "PRINT",
      "PRINTV",
      "PRINTS",
      "PRINTFORM",
      "PRINTFORMS"
    ],
    "signatures": [
      {
        "name": "PRINT",
        "params": "`string`",
        "returns": "无",
        "engines": [
          "eramaker",
          "emuera",
          "net"
        ],
        "overloads": []
      }
    ],
    "summary": "PRINT系列的基本指令。",
    "body": "!!! info \"API\"\n\n    ```erb\n    PRINTV(|K|D)(|L|W|N) expression[, expression, ...]\n    PRINTS(|K|D)(|L|W|N) stringVariable\n    PRINTFORM(|K|D)(|L|W|N) formedString\n    PRINTFORMS(|K|D)(|L|W|N) string\n    ```\n    PRINT系列的基本指令。\n\n    [eramaker]第一个括号内的关键字指定参数类型。\n\n    - 无 - (<字符串>)\n    - V - (<表达式> [, <表达式> ……]) — 每个参数独立求值，整数表达式输出数值，字符串表达式输出文本\n    - S - <字符串表达式>\n    - FORM - (<格式化字符串>)\n    - FORMS - <格式化字符串表达式>\n\n    [Emuera]第二个括号内的关键字\"K\"指定应用FORCEKANA指令。关键字\"D\"指定忽略SETCOLOR指令。关键字K和D不能同时指定。\n\n    - 无 - 忽略`FORCEKANA`，并以`SETCOLOR`指定的颜色绘制。\n    - K - 应用`FORCEKANA`进行绘制。\n    - D - 忽略`SETCOLOR`，以配置中指定的默认颜色绘制。\n\n    [eramaker]第三个括号内的关键字指定绘制后的换行和WAIT是否存在。\n\n    - 无 - 仅`PRINT`，不换行也不执行`WAIT`。\n    - L - `PRINT`后换行。\n    - W - `PRINT`后换行并执行`WAIT`指令。\n    - [.NET]N - `PRINT`后不换行，仅执行`WAIT`指令。目前不能与第二个括号内的关键字K或D组合使用。\n    - 这些组合使得例如`PRINTSDW`意味着：以<字符串表达式>为参数，以默认颜色绘制，并在`PRINT`后执行`WAIT`指令。\n\n!!! hint \"提示\"\n\n    仅支持作为指令使用。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n    #DIM HOGE\n    #DIMS HOGES\n    \tPRINT 1+2=\n    \tHOGE = 3\n    \tPRINTV HOGE\n    \tPRINTL\n    \tPRINT HOGES is\n    \tHOGES = String\n    \tPRINTSL HOGES\n    \tPRINT HOGE*HOGE=\n    \tPRINTFORMSL HOGES*HOGE\n    \tSETCOLORBYNAME yellow\n    \tHOGE = GETCOLOR()\n    \tPRINTFORML Now color is R:{HOGE/0x10000} G:{HOGE/0x100%0x100} B:{HOGE%0x100}\n    \tHOGES = but PRINTD will ignore SETCOLOR\n    \tPRINTSDL HOGES\n    \tHOGES = 示例到此结束\n    \tFORCEKANA 2\n    \tPRINTK 打印的\n    \tPRINTFORMKW %HOGES%\n    ```\n    ![](../assets/images/PRINT.png)\n\n### 相关项目\n- [基本输出](../tutorial/basic-output.zh.md) — PRINT 系列教程：参数类型、行为后缀、输出颜色、按钮\n- PRINTBUTTON\n- BITMAP_CACHE_ENABLE\n- [Emuera新增语法>格式化字符串（FORM语法）扩展](../Emuera/expression.md#form_1)",
    "sourcePath": "docs/Reference/PRINT.zh.md"
  },
  {
    "id": "PRINT_IMG",
    "title": "PRINT_IMG",
    "names": [
      "PRINT_IMG"
    ],
    "signatures": [
      {
        "name": "PRINT_IMG",
        "params": "`string`",
        "returns": "无",
        "engines": [
          "emuera",
          "em"
        ],
        "overloads": [
          "`string`, `int`, `int`, `int`",
          "`string`, `string`, `int`, `int`, `int`",
          "`string`, `string`, `2DIntegerVariable`, `int`, `int`, `int`"
        ]
      }
    ],
    "summary": "在行中显示指定的图像。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tPRINT_IMG spriteName\n\tPRINT_IMG spriteName, width, height, ypos\n\tPRINT_IMG spriteName, spriteNameBack, width, height, ypos\n\tPRINT_IMG spriteName, spriteNameBack, colorMatrix, width, height, ypos\n    ```\n\t在行中显示指定的图像。\n\t相当于 [`HTML_PRINT` 命令的 `<img>` 标签](../Emuera/HTML_PRINT.md#img)。\n\tEM+EE 中扩展了语法。详情请参阅[摘要](../EMEE/EMEE_Summary.zh.md)。\n\n!!! hint \"提示\"\n\n    仅支持命令形式。\n\n### 相关项目\n- SPRITECREATE",
    "sourcePath": "docs/Reference/PRINT_IMG.zh.md"
  },
  {
    "id": "PRINT_RECT",
    "title": "PRINT_RECT",
    "names": [
      "PRINT_RECT"
    ],
    "signatures": [
      {
        "name": "PRINT_RECT",
        "params": "`int`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": [
          "`int`, `int`, `int`, `int`"
        ]
      }
    ],
    "summary": "在行内显示一个宽度为字体大小参数百分比的长方形。或者，在行内显示一个x、y、宽度、高度分别为参数百分比的长方形。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tPRINT_RECT width\n\tPRINT_RECT xPos, yPos, width, height\n    ```\n\t在行内显示一个宽度为字体大小参数百分比的长方形。或者，在行内显示一个`x`、`y`、`宽度`、`高度`分别为参数百分比的长方形。\n\t可以通过`SETCOLOR`命令像改变字体颜色一样改变其颜色。\n\t相当于[`HTML_PRINT`命令的`<shape type='rect'>`标签](../Emuera/HTML_PRINT.md#shape)。\n\t在EM+EE中，也支持使用`px`单位进行指定。\n\n!!! hint \"提示\"\n\n    仅支持命令形式。",
    "sourcePath": "docs/Reference/PRINT_RECT.zh.md"
  },
  {
    "id": "PRINT_SPACE",
    "title": "PRINT_SPACE",
    "names": [
      "PRINT_SPACE"
    ],
    "signatures": [
      {
        "name": "PRINT_SPACE",
        "params": "`int`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "创建一个宽度为参数指定字体大小百分比的无内容显示空间。",
    "body": "!!! info \"API\"\n\n    ```erb\n    PRINT_SPACE width\n    ```\n    创建一个宽度为参数指定字体大小百分比的无内容显示空间。\n    相当于 [`HTML_PRINT` 命令的 `<shape type='space'>` 标签](../Emuera/HTML_PRINT.md#shape)。\n    在 EM+EE 中，现在也可以使用 `px` 单位来指定宽度。\n\n!!! hint \"提示\"\n\n    仅支持作为命令使用。",
    "sourcePath": "docs/Reference/PRINT_SPACE.zh.md"
  },
  {
    "id": "PRINT_STATUS",
    "title": "PRINT_STATUS 相关函数",
    "names": [
      "PRINT_ABL",
      "PRINT_TALENT",
      "PRINT_MARK",
      "PRINT_EXP",
      "PRINT_PALAM",
      "PRINT_ITEM",
      "PRINT_SHOPITEM",
      "PRINT_STATUS"
    ],
    "signatures": [
      {
        "name": "PRINT_ABL",
        "params": "`int`",
        "returns": "无",
        "engines": [
          "eramaker"
        ],
        "overloads": []
      },
      {
        "name": "PRINT_TALENT",
        "params": "`int`",
        "returns": "无",
        "engines": [
          "eramaker"
        ],
        "overloads": []
      },
      {
        "name": "PRINT_MARK",
        "params": "`int`",
        "returns": "无",
        "engines": [
          "eramaker"
        ],
        "overloads": []
      },
      {
        "name": "PRINT_EXP",
        "params": "`int`",
        "returns": "无",
        "engines": [
          "eramaker"
        ],
        "overloads": []
      },
      {
        "name": "PRINT_PALAM",
        "params": "`int`",
        "returns": "无",
        "engines": [
          "eramaker"
        ],
        "overloads": []
      },
      {
        "name": "PRINT_ITEM",
        "params": "无",
        "returns": "无",
        "engines": [
          "eramaker"
        ],
        "overloads": []
      },
      {
        "name": "PRINT_SHOPITEM",
        "params": "无",
        "returns": "无",
        "engines": [
          "eramaker"
        ],
        "overloads": []
      }
    ],
    "summary": "分别简易显示当前状态。PRINTABL、PRINTTALENT、PRINTMARK、PRINTEXP、PRINT_PALAM 请将角色登记编号 (CharaID) 指定为参数。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tPRINT_ABL charaID\n\tPRINT_TALENT charaID\n\tPRINT_MARK charaID\n\tPRINT_EXP charaID\n\tPRINT_PALAM charaID\n\tPRINT_ITEM\n\tPRINT_SHOPITEM\n    ```\n    分别简易显示当前状态。`PRINT_ABL`、`PRINT_TALENT`、`PRINT_MARK`、`PRINT_EXP`、`PRINT_PALAM` 请将角色登记编号 (CharaID) 指定为参数。\n\n!!! hint \"提示\"\n\n    仅支持指令。\n\n!!! example \"示例\"\n\n    ```erb\n\t0,能力0\n\t1,能力1\n\t2,能力2\n\t```\n\n    ```erb\n    @SYSTEM_TITLE\n            ADDVOIDCHARA\n            ABL:0:0 = 2\n            ABL:0:2 = 3\n\n            PRINT_ABL 0\n            WAIT\n    ```\n    ```text\n    能力0LV2 能力2LV3\n    ```",
    "sourcePath": "docs/Reference/PRINT_STATUS.zh.md"
  },
  {
    "id": "PRINTBUTTON",
    "title": "PRINTBUTTON 系列",
    "names": [
      "PRINTBUTTON",
      "PRINT",
      "INPUT",
      "PRINTS",
      "PRINTL",
      "INPUTS"
    ],
    "signatures": [
      {
        "name": "PRINTBUTTON",
        "params": "`string`, `any`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "PRINTBUTTON 指令用于生成可通过鼠标点击的按钮。",
    "body": "!!! info \"API\"\n\n    ```erb\n    PRINTBUTTON(|C|LC) string, buttonValue\n    ```\n    `PRINTBUTTON` 指令用于生成可通过鼠标点击的按钮。\n    其格式与 `PRINTS` 指令相似，但需要指定第二个参数，即点击按钮时输入的数字或字符串。如果第一个参数中包含换行符，该换行符将被忽略且不会导致换行。\n\n    Emuera 会自动将类似 `[300] 保存` 这样用 `[]` 括起来的数字及其前后的字符串转换为按钮。\n    `PRINTBUTTON` 指令的作用就是强制生成此类按钮，而非依赖自动转换。\n    该指令在以下情况下特别有用：\n\n    ```erb\n    PRINT 这样可以吗？ [0] 是    [1] 否\n    INPUT\n    ```\n\n    对于这样的行，Emuera 无法正确识别按钮，会将其识别为 `これでいい？ [0] はい` 和 `[1] いいえ` 两个按钮。\n    使用 `PRINTBUTTON` 重写后如下所示：\n\n    ```erb\n    PRINTS \"これでいい？ \"\n    PRINTBUTTON \"[0] はい\", 0\n    PRINTS \"     \"\n    PRINTBUTTON \"[1] いいえ\", 1\n    INPUT\n    ```\n\n    （这里使用`PRINTS`命令代替`PRINT`是为了明确显示半角空格的数量）\n    这样处理后，`これでいい？ `将不再是按钮，只有`[0] はい`和`[1] いいえ`会成为按钮。\n    需要注意的是，`PRINTBUTTON`命令中显示的字符串并非必须包含`[0]`或`[1]`等数字，但如果完全不显示对应的数字，可能会让使用数字键盘等设备进行操作的玩家感到困惑。因此建议仍按惯例显示`[0]`等数字。\n    此外，`PRINTBUTTON`命令不仅可以创建输入数字的按钮，还可以创建输入字符串的按钮。这样创建的按钮可以在执行`INPUTS`命令时被点击。\n\n    ```erb\n    PRINTL 请输入姓名。\n    PRINTBUTTON \"[HogeHoge] \", \"HogeHoge\"\n    PRINTBUTTON \"[PugePuge] \", \"PugePuge\"\n    PRINTBUTTON \"[FooBar] \", \"FooBar\"\n    INPUTS\n    ```\n\n    括号内的关键字用于指定文本对齐方式。\n\n    - 无 - 不对齐\n    - `C` - 与 `PRINTC` 类似，向右对齐\n    - `LC` - 与 `PRINTLC` 类似，向左对齐\n\n!!! hint \"提示\"\n\n    仅支持命令。\n\n### 相关项目\n- PRINT",
    "sourcePath": "docs/Reference/PRINTBUTTON.zh.md"
  },
  {
    "id": "PRINTC",
    "title": "PRINTC 系列",
    "names": [
      "PRINT",
      "PRINTFORM",
      "PRINTC"
    ],
    "signatures": [
      {
        "name": "PRINT",
        "params": "`string`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "这是 PRINTC 系列命令。",
    "body": "!!! info \"API\"\n\n    ```erb\n    PRINT(C|L)(|K|D) string\n    PRINTFORM(C|L)(|K|D)(|L|W) formedString\n    ```\n    这是 `PRINTC` 系列命令。\n    这些命令会根据配置 [`PRINTC的字符数`](../Emuera/config.md#printc_1)（默认值 25）指定的字符数，通过补充半角空格来对齐并打印字符串。\n    此外，在 Emuera 中，对已 `PRINT` 的字符串进行按钮化处理时，会对 `PRINTC` 系列命令进行一些特殊处理。\n\n    第一个括号内的关键字指定参数类型。\n\n    - 无 - <字符串>\n    - `FORM` - <格式化字符串>\n\n    第二个括号内的关键字指定对齐方式。\n\n    - `C` - 右对齐（在左侧添加半角空格）\n    - `LC` - 左对齐。\n\n    第三个括号内的 `K`、`D` 与 `PRINT` 系列命令相同。\n\n    !!! hint \"提示\"\n\n        仅支持命令形式。\n\n    !!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n        PRINTC AAA\n        PRINT |\n        PRINTC BBB\n        PRINT |\n        PRINTC CCC\n        PRINTL |\n        PRINTLC DDD\n        PRINT |\n        PRINTLC EEE\n        PRINT |\n        PRINTLC FFF\n        PRINTL |\n        PRINTC GGG\n        PRINT |\n        PRINTLC HHH\n        PRINT |\n        PRINTC III\n        PRINTW |\n    ```\n    ```text\n                            AAA|                      BBB|                      CCC|\n    DDD                        |EEE                      |FFF                      |\n                            GGG|HHH                      |                      III|\n\n    ```\n\n### 相关项目\n- PRINTCPERLINE\n- PRINTCLENGTH",
    "sourcePath": "docs/Reference/PRINTC.zh.md"
  },
  {
    "id": "PRINTCLENGTH",
    "title": "PRINTCLENGTH",
    "names": [
      "PRINTCLENGTH"
    ],
    "signatures": [
      {
        "name": "PRINTCLENGTH",
        "params": "无",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "返回配置项PRINTC的字符数的值。与 RESULT = GETCONFIG(\"PRINTC的字符数\") 同义。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint PRINTCLENGTH\n    ```\n\t返回配置项[`PRINTC的字符数`](../Emuera/config.md#printc_1)的值。与 RESULT = GETCONFIG(\"PRINTC的字符数\") 同义。\n\n!!! hint \"提示\"\n\n    同时支持指令和表达式函数。\n\n### 相关项目\n- PRINTCPERLINE",
    "sourcePath": "docs/Reference/PRINTCLENGTH.zh.md"
  },
  {
    "id": "PRINTCPERLINE",
    "title": "PRINTCPERLINE",
    "names": [
      "PRINTCPERLINE"
    ],
    "signatures": [
      {
        "name": "PRINTCPERLINE",
        "params": "无",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "将配置PRINTC排列数量中指定的数值赋值给RESULT:0，或返回该值。默认值为3。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint PRINTCPERLINE\n    ```\n\t将[配置`PRINTC排列数量`](../Emuera/config.md#printc)中指定的数值赋值给RESULT:0，或返回该值。默认值为3。\n\t等同于`RESULT = GETCONFIG(\"PRINTC排列数量\")`\n\n!!! hint \"提示\"\n\n    支持指令和表达式函数两种用法。\n\n### 相关项目\n- PRINTCLENGTH",
    "sourcePath": "docs/Reference/PRINTCPERLINE.zh.md"
  },
  {
    "id": "PRINTDATA",
    "title": "PRINTDATA 系列",
    "names": [
      "PRINTDATA",
      "DATA",
      "DATAFORM",
      "DATALIST",
      "ENDLIST",
      "ENDDATA"
    ],
    "signatures": [
      {
        "name": "PRINTDATA",
        "params": "无",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "DATA",
        "params": "`string`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "DATAFORM",
        "params": "`formedString`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "DATALIST",
        "params": "无",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "ENDLIST",
        "params": "无",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "ENDDATA",
        "params": "无",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "这是 PRINTDATA 系列指令。根据私家改造版 readme 的说明，",
    "body": "!!! info \"API\"\n\n    ```erb\n    PRINTDATA(|K|D)(|L|W)\n    \tDATA string\n    \tDATAFORM formedString\n    \tDATALIST\n    \tENDLIST\n    ENDDATA\n    ```\n    这是 `PRINTDATA` 系列指令。根据私家改造版 readme 的说明，\n\n    ```erb\n    ;*格式*\n    PRINTDATA (数值变量：可省略)\n    \tDATA (字符串)\n    \tDATAFORM (FORM字符串)\n    \tDATALIST\n    \t\t(DATA 或 DATAFORM 的罗列)\n    \tENDLIST\n    ENDDATA\n    ```\n\n\t    *内容*\n\t    将DATA、DATAFORM以及DATALIST～ENDLIST中指定的字符串以等概率随机显示\n\t    无需使用IF和RAND即可实现随机显示\n\t    若在参数中指定了数值变量，则会存入所显示的变量DATA的编号\n\t    适用于想根据显示的字符串来调整后续处理的情况\n\t    DATALIST～ENDLIST内部，每个DATA或DATAFORM相当于一行\n\n\t如上所述。\n\t`K`、`D`、`L`、`W`关键字的效果与`PRINT`系命令相同。\n\t若`PRINTDATA`系～`ENDDATA`内部没有通过`DATA`系提供显示数据，则不执行任何操作并继续执行后续命令。\n\t不能在`PRINTDATA`系～`ENDDATA`以及`DATALIST`～`ENDLIST`内部书写上述语法以外的内容。\n\n!!! hint \"提示\"\n\n\t仅支持命令形式。\n\n!!! example \"示例\"\n\n```erb\n@SYSTEM_TITLE\n\tREPEAT 10\n\t\tPRINTDATA\n\t\t\tDATA A\n\t\t\tDATA B\n\t\t\tDATA C\n\t\t\tDATA D\n\t\t\tDATA E\n\t\tENDDATA\n\tREND\n\n\tWAIT\n```\n```text\nDBDAEACDAE\n```\n\n### 相关项目\n- STRDATA\n- SELECTCASE\n- RAND",
    "sourcePath": "docs/Reference/PRINTDATA.zh.md"
  },
  {
    "id": "PRINTN",
    "title": "PRINTN 系列",
    "names": [
      "PRINT",
      "PRINTN",
      "PRINTVN",
      "PRINTSN",
      "PRINTFORMN",
      "PRINTFORMSN"
    ],
    "signatures": [
      {
        "name": "PRINT",
        "params": "`string`",
        "returns": "无",
        "engines": [
          "net"
        ],
        "overloads": []
      }
    ],
    "summary": "这是不换行的 PRINTW 命令。仅添加在上述基本的 PRINT 命令中。",
    "body": "!!! info \"API\"\n\n    ```erb\n    PRINTN string\n    PRINTVN expression[, expression, ...]\n    PRINTSN stringVariable\n    PRINTFORMN formedString\n    PRINTFORMSN string\n    ```\n    这是不换行的 `PRINTW` 命令。仅添加在上述基本的 `PRINT` 命令中。\n    各命令的行为和字面量与 `PRINT` 系列命令 相同。\n\n!!! hint \"提示\"\n\n    仅命令本身支持此功能。\n\n### 相关项目\n- PRINT",
    "sourcePath": "docs/Reference/PRINTN.zh.md"
  },
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
    "body": "!!! info \"API\"\n\n    ```erb\n    PRINTPLAIN(|FORM) string\n    ```\n    将参数字符串作为纯文本输出。此时即使存在按钮字符串（如0等）也不会将其按钮化。\n    括号内的关键字用于指定参数类型。\n\n    - 不加上`FORM` - <字符串>\n    - 加上`FORM` - <格式化字符串>\n\n!!! hint \"提示\"\n\n    仅支持指令形式。\n\n### 相关项目\n- PRINT",
    "sourcePath": "docs/Reference/PRINTPLAIN.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    PRINTSINGLEV(|K|D) expression[, expression, ...]\n    PRINTSINGLES(|K|D) stringVariable\n    PRINTSINGLEFORM(|K|D) formedString\n    PRINTSINGLEFORMS(|K|D) string\n    ```\n    `PRINTSINGLE` 系列与 `PRINTL` 几乎相同，但 `PRINTSINGLE` 系列不会对字符串进行换行，始终在一行内显示。\n    超出屏幕边缘的字符不会被绘制。\n    此外，由于会自动添加换行，因此没有 `(|L|W)` 关键字。\n    其他关键字的含义与 PRINT 系列 相同。\n\n!!! hint \"提示\"\n\n    仅支持作为指令使用。\n\n### 相关项目\n- PRINT",
    "sourcePath": "docs/Reference/PRINTSINGLE.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    PUTFORM saveInfo\n    ```\n    `PUTFORM` 只能在名为 `@SAVEINFO` 的特殊函数中使用。\n    通过使用与 `PRINTFORM` 相同的格式书写，可以为存档数据添加概要。\n    建议写入诸如第几天、角色能力如何、正在调教哪个角色等数据。\n\n!!! hint \"提示\"\n\n    仅支持指令。\n\n### 相关项目\n- SAVEDATA\n- [流程图>SAVEGAME](../Emuera/system_flow.md#savegame)",
    "sourcePath": "docs/Reference/PUTFORM.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tQUIT\n    ```\n    执行一次 `WAIT` 后结束 `Emuera`\n\n!!! hint \"提示\"\n\n    仅支持作为指令使用。\n\n### 相关项目\n- FORCE_QUIT\n- QUIT_AND_RESTART",
    "sourcePath": "docs/Reference/QUIT.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    QUIT_AND_RESTART\n    ```\n\n    和 `QUIT` 一样，插入 WAIT 后重启 Emuera。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n### 相关项目\n- QUIT\n- FORCE_QUIT_AND_RESTART",
    "sourcePath": "docs/Reference/QUIT_AND_RESTART.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tint RAND min(, max)\n    ```\n\t与同名的变量功能几乎相同。\n\t`RAND(X)` 与 `RAND:X` 的行为完全相同。\n\t使用完全相同的随机数生成器，可以通过 `RANDOMIZE` 或 `INITRAND` 来控制随机数。\n\t`RAND` 函数可以指定两个参数，当指定两个参数时，第一个参数将用作随机数的最小值。\n\t此函数生成一个 `0～18446744073709551615` (2的64次方-1) 之间的随机数，将其除以 `max-min` 取余数，然后加上 `min` 并返回结果。\n\t因此，`max` 必须是一个大于 `min` 的值（不能相等）。\n\t如果 `max-min` 超过有符号64位整数 (`9223372036854775807`) 的最大值，将会出错。\n\t此外，当 `max-min` 非常大时（大约1京？），由取余方法导致的偏差将变得不可忽视。\n\n!!! hint \"提示\"\n\n    命令和表达式函数均支持。\n\n!!! warning \"Skia 扩展\"\n\n    Skia 版在参数非法时不再弹出错误中断脚本（v12.2.0）。\n\n    - `RAND:n` 且 `n ≤ 0` 时：返回 `0`\n    - `RAND(max)` / `RAND(min,max)` 且 `max ≤ min` 时：返回下界 `min`（浮点参数同理）\n    - 仅首次触发时向控制台输出一次警告，之后静默钳制\n\n    原版在 `max` 不大于 `min` 或 `RAND:0` 等情况下会弹出错误并终止脚本。\n\n### 相关项目\n- PRINTDATA\n- STRDATA",
    "sourcePath": "docs/Reference/RAND.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tRANDOMIZE int\n\tDUMPRAND\n\tINITRAND\n    ```\n\t这些是用于控制通过 `RAND:X` 获取的随机数的指令。\n\n\t`RANDOMIZE` 指令使用指定的值初始化随机数。\n\t如果使用相同的值进行初始化，`RAND` 必定会返回相同的结果。\n\t对于 `PRINTDATA` 和 `STRDATA` 也会返回相同的结果。\n\n\t`DUMPRAND` 将当前的随机数状态保存到 `RANDDATA` 变量中。\n\t`INITRAND` 从 `RANDDATA` 变量中读取保存的数据。\n\t请注意，不要在 `DUMPRAND` 之前执行 `INITRAND`。\n\t如果 `RANDDATA` 变量的内容不合适，`RAND` 将无法正常工作。\n\n    **示例**\n    ```erb\n\tPRINTFORML {RAND:100000}/{RAND:100000}/{RAND:100000}/{RAND:100000}/{RAND:100000}/{RAND:100000}\n\tRANDOMIZE 23478612\n\tPRINTFORML {RAND:100000}/{RAND:100000}/{RAND:100000}/{RAND:100000}/{RAND:100000}/{RAND:100000}\n\tRANDOMIZE 23478612\n\tPRINTFORML {RAND:100000}/{RAND:100000}/{RAND:100000}/{RAND:100000}/{RAND:100000}/{RAND:100000}\n\tDUMPRAND\n\tPRINTFORML {RAND:100000}/{RAND:100000}/{RAND:100000}/{RAND:100000}/{RAND:100000}/{RAND:100000}\n\tINITRAND\n\tPRINTFORML {RAND:100000}/{RAND:100000}/{RAND:100000}/{RAND:100000}/{RAND:100000}/{RAND:100000}\n\tINITRAND\n\tPRINTFORML {RAND:100000}/{RAND:100000}/{RAND:100000}/{RAND:100000}/{RAND:100000}/{RAND:100000}\n\t```\n\n    **结果**\n\t```\n\t92539/49469/48337/15839/48368/1604\n\t34536/91889/81167/22434/87922/95565\n\t34536/91889/81167/22434/87922/95565\n\t68286/10690/68868/82610/90769/60789\n\t68286/10690/68868/82610/90769/60789\n\t68286/10690/68868/82610/90769/60789\n\t```\n\n    在上述结果中，第一行的结果是随机的。每次运行时结果都会变化。\n    第二行和第三行由于在`RANDOMIZE`之后立即执行，因此结果必定相同。\n    在第四行之前执行了`DUMPRAND`命令。\n    通过在第五行之前执行`INITRAND`命令，将`RAND`的状态恢复到了`DUMPRAND`命令保存的状态。\n    因此，第四行和第五行的结果相同。\n    第六行通过再次执行`INITRAND`命令，重复获得了相同的结果。\n    由于`RANDDATA`变量是可保存的变量，通过在保存前执行`DUMPRAND`，并在加载后立即执行`INITRAND`，可以继续使用相同的随机数状态。\n\n!!! hint \"提示\"\n\n    仅支持命令。\n\n### [Skia]Skia 版变更\n\n!!! info \"与新随机数算法解耦\"\n\n    原版中 `UseNewRandom=true` 时，`INITRAND`/`DUMPRAND` 会输出警告并跳过。Skia 版移除了此检查，`INITRAND`/`DUMPRAND` 始终操作 MTRandom 状态，不影响 `GetNextRand`。",
    "sourcePath": "docs/Reference/RANDOMIZE.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    REDRAW int\n    int CUREENTREDRAW\n    ```\n\t这是绘图控制命令。\n\t当参数指定为`0`时，**抑制非强制性的绘图请求**（仅在需要用户输入的时刻等强制绘图时机进行绘图）。\n\t当参数指定为`1`时，将如常进行绘图。此时非强制性的绘图若未满足[配置中的`每秒帧数`](../Emuera/config.zh.md#fps)所决定的最小间隔（`1000 / 每秒帧数` 毫秒），则不会绘图。\n\t若在参数上加上`2`（例如`REDRAW 2`或`REDRAW 3`），则在上述效果的基础上，还会在执行`REDRAW`命令的瞬间强制进行绘图。\n\t当前的`REDRAW`状态（`0`或`1`）可以通过`CURRENTREDRAW`获取。\n\n!!! info \"详细\"\n\n\t`REDRAW`只持有`0`（抑制）与`1`（常规）两种状态，`CURRENTREDRAW`也只返回`0`或`1`。\n\t`REDRAW 1`仅恢复状态，**其本身不会进行绘图**。若想在`REDRAW`命令之后立刻绘图，请使用加上`2`的`REDRAW 3`。\n\t`REDRAW 0`抑制的只是非强制性的绘图。进入等待用户输入的命令（`INPUT`・`INPUTS`・`INPUTSNF`・`TINPUT`系）时的绘图，以及鼠标移动到按钮上引起的绘图，都不受抑制。\n\n!!! warning \"注意（批量绘图与滚动位置）\"\n\n\t对于\"先清掉、再重画\"的画面（动画循环、动态地图等），请用`REDRAW 0`包住从清除到重绘的区间，并在进入输入等待之前恢复原状。\n\n\t```erb\n\tPREV_REDRAW = CURRENTREDRAW()\n\tREDRAW 0\n\t;\tCLEARLINE 与重绘\n\tREDRAW PREV_REDRAW\n\t;\t之后的输入等待会强制绘图\n\t```\n\n\t若不做批量绘图，清除已完成、重绘未完成的中途状态会被真的绘制出来。由于绘图同时会同步滚动位置，**画面将无法固定在最新行**（表现为行删掉又回来、窗口晃动）。\n\n\t另外，请不要把`REDRAW 1`当作\"恢复绘图\"的收尾使用，它会覆盖调用方的设定。恢复请使用事先保存的值（`REDRAW PREV_REDRAW`）。\n\n!!! hint \"提示\"\n\n    `CURRENTREDRAW`支持在表达式中作为函数使用。",
    "sourcePath": "docs/Reference/REDRAW.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    1. int REGEXPMATCH str, pattern(, output)\n    2. int REGEXPMATCH str, pattern, ref groupCount, ref matches\n    ```\n\n    如果 `str` 符合 `pattern` 正则表达式规则，返回匹配到的结果数量，否则返回 `0`。\n\n    1. `output` 参数为 `0` 以外的整数时(默认为`0`)，匹配到的子表达式组数保存到 `RESULT:1`，所有的匹配结果全部保存到 `RESULTS` 数组（共「子表达式组数量」×「返回值（匹配结果数量）」个）。\n    2. 匹配到的子表达式组数保存到 `groupCount`，所有的匹配结果全部保存到 `matches`（数量同上）。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        #DIM groupCount\n        #DIMS matches, 10\n        #DIM i\n        #DIM j\n        #DIM count\n\n        REGEXPMATCH \"Apple Banana Car\", \"(.{2})\\\\b\"\n        PRINTFORML 匹配结果数量: {RESULT}\n        count = REGEXPMATCH(\"Apple Banana Car\", \".(.{2})\\\\b\", groupCount, matches)\n        PRINTFORML 匹配结果数量: {count}  子表达式组数量: {groupCount}\n        PRINTL\n        FOR i, 0, count\n            PRINTFORML 匹配结果{i+1}:\n            FOR j, 0, groupCount\n                PRINTFORML 子表达式组{j}: %matches:(i*groupCount+j)%\n            NEXT\n            PRINTL\n        NEXT\n\n        ONEINPUT\n\n    ```\n    ```text\n    匹配结果数量: 3\n    匹配结果数量: 3  子表达式组数量: 2\n\n    匹配结果1:\n    子表达式组0: ple\n    子表达式组1: le\n\n    匹配结果2:\n    子表达式组0: ana\n    子表达式组1: na\n\n    匹配结果3:\n    子表达式组0: Car\n    子表达式组1: ar\n    ```",
    "sourcePath": "docs/Reference/REGEXPMATCH.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tREPEAT loopCount\n\tREND\n    ```\n    `REPEAT`～`REND`之间的代码块，将按照参数指定的次数进行循环。循环次数被记录在`COUNT`变量中。\n\t当执行`CONTINUE`时，将返回到`REPEAT`行，并将`COUNT`变量加1。\n\t当执行`BREAK`时，将终止后续的循环处理，并跳转到`REND`行。\n\n!!! hint \"提示\"\n\n    仅支持指令形式。\n\n!!! example \"例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tREPEAT 5\n\t\t\tSIF COUNT == 2\n\t\t\t\tCONTINUE\n\t\t\tSIF COUNT == 4\n\t\t\t\tBREAK\n\t\t\tPRINTFORML {COUNT}\n\t\tREND\n\t\tPRINTFORMW {COUNT}\n    ```\n    ```text\n\t0\n\t1\n\t3\n\t5\n    ```\n\n### 相关项目\n- FOR-NEXT\n- WHILE_WEND\n- CONTINUE,BREAK",
    "sourcePath": "docs/Reference/REPEAT.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tstring REPLACE string, searchWord, replaceWord\n    ```\n\t在目标字符串中搜索目标模式，如果匹配成功，则用替换字符串进行替换。\n\t内部处理完全基于正则表达式。第二个参数遵循 C# 正则表达式的规范进行操作。\n\t因此，对于正则表达式中使用的符号，如 `()`、`[]`、`$`、`/`、`.`、`*`、`+` 等，必须进行转义。\n\n!!! hint \"提示\"\n\n    该函数同时支持指令和表达式内函数两种形式。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tPRINTFORMW %REPLACE(\"12億3456万7890円\", \"[^0-9]\", \"\")%\n    ```\n    ```text\n\t1234567890\n    ```",
    "sourcePath": "docs/Reference/REPLACE.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tRESET_STAIN charaID\n    ```\n\t这是初始化第1个参数所指定角色的`STAIN`的指令。初始值与`BEGIN TRAIN`时赋入的值相同，可通过[`_replace.csv`的`污渍初始值`](../Emuera/replace.zh.md)进行指定。\n\n!!! hint \"提示\"\n\n    仅支持作为指令使用。\n\n### 相关项目\n- [_replace.csv>污渍初始值](../Emuera/replace.zh.md)",
    "sourcePath": "docs/Reference/RESET_STAIN.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tRESETDATA\n    ```\n\t初始化除全局变量外的所有变量。\n\t具体来说，会删除所有角色，并将所有局部变量及所有普通变量赋值为`0`或空字符串。\n\t此外，对于`PALAMLV`或`STR`等设置了初始值的变量，会为其赋予初始值。\n\n!!! hint \"提示\"\n\n    仅支持指令。\n\n!!! example \"例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tRESULT = 123\n\t\tLOCAL = 456\n\n\t\tRESETDATA\n\t\tPRINTFORMW {RESULT} {LOCAL}\n    ```\n    ```text\n\t0 0\n    ```\n\n### 相关项目\n- RESETGLOBAL",
    "sourcePath": "docs/Reference/RESETDATA.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tRESETGLOBAL\n    ```\n\t初始化全局变量。\n\t具体来说，将数值型全局变量赋值为`0`，将字符串型全局变量赋值为空字符串。\n\n!!! hint \"提示\"\n\n    仅支持指令形式。\n\n!!! example \"例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tGLOBAL = 123\n\n\t\tRESETGLOBAL\n\t\tPRINTFORMW {GLOBAL}\n    ```\n    ```text\n\t0\n    ```\n\n### 相关项目\n- RESETDATA",
    "sourcePath": "docs/Reference/RESETGLOBAL.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tRESTART\n    ```\n    返回当前正在执行的函数的开头。使用`DYNAMIC`定义的动态变量不会被初始化\n\n!!! hint \"提示\"\n\n    仅支持作为指令使用。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\t#DIM DYNAMIC RESTARTCOUNT\n\n\t\tRESTARTCOUNT++\n\n\t\tSELECTCASE RESTARTCOUNT\n\t\t\tCASE 1\n\t\t\t\tPRINTL Doe, a deer, a female deer\n\t\t\t\tRESTART\n\t\t\tCASE 2\n\t\t\t\tPRINTL Ray, a drop of golden sun\n\t\t\t\tRESTART\n\t\t\tCASE 3\n\t\t\t\tPRINTL Me, a name I call my self\n\t\t\t\tRESTART\n\t\t\tCASE 4\n\t\t\t\tPRINTL Far, a long, long way to run\n\t\t\t\tRESTART\n\t\t\tCASE 5\n\t\t\t\tPRINTL Sew, a needle pulling thread\n\t\t\t\tRESTART\n\t\t\tCASE 6\n\t\t\t\tPRINTL La, a note to follow Sew\n\t\t\t\tRESTART\n\t\t\tCASE 7\n\t\t\t\tPRINTL Tea, a drink with jam and bread\n\t\t\t\tRESTART\n\t\tENDSELECT\n\n\t\tPRINTW That will bring us back to Do\n    ```\n    ```text\n\tDoe, a deer, a female deer\n\tRay, a drop of golden sun\n\tMe, a name I call my self\n\tFar, a long, long way to run\n\tSew, a needle pulling thread\n\tLa, a note to follow Sew\n\tTea, a drink with jam and bread\n\tThat will bring us back to Do\n    ```\n\n### 相关项目\n- RETURN",
    "sourcePath": "docs/Reference/RESTART.zh.md"
  }
];
