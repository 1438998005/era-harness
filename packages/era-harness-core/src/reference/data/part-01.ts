// 本文件由 scripts/build-reference.ts 生成，请勿手工修改。
//
// 数据来源：https://github.com/qirchen421/emuera.sk.doc  docs/Reference/*.zh.md
// 上游版本：606670cd78b58f5d9a050013d1d3f41db5a87a1b
// 许可：CC BY-NC 4.0（http://creativecommons.org/licenses/by-nc/4.0/）
//       与本仓库代码的 Apache-2.0 分开管理，见 NOTICE-emuera-sk-doc.md
import type { ReferenceEntry } from '../types.js';

export const ENTRIES_PART_01: readonly ReferenceEntry[] = [
  {
    "id": "ABS",
    "title": "ABS, SIGN",
    "names": [
      "ABS",
      "SIGN"
    ],
    "signatures": [
      {
        "name": "ABS",
        "params": "`int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "SIGN",
        "params": "`int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "这是分别用于计算绝对值和表示正负方向的命令/表达式函数。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint ABS int\n\tint SIGN int\n    ```\n\t这是分别用于计算绝对值和表示正负方向的命令/表达式函数。\n\t`ABS`返回绝对值，`SIGN`在值为负时返回`-1`，为`0`时返回`0`，为正时返回`1`。\n\n!!! hint \"提示\"\n\n    同时支持指令和表达式函数。"
  },
  {
    "id": "ADDCHARA",
    "title": "ADDCHARA",
    "names": [
      "ADDCHARA"
    ],
    "signatures": [
      {
        "name": "ADDCHARA",
        "params": "`int`(, `int`,...)",
        "returns": "无",
        "engines": [
          "eramaker",
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "从 CharaXX.csv 文件中添加指定编号的角色。",
    "body": "!!! info \"API\"\n\n    ```erb\n    ADDCHARA charaNo(, charaNo,...)\n    ```\n    从 `CharaXX.csv` 文件中添加指定编号的角色。\n    在 `Emuera` 中，可以一次性添加多个角色。\n\n!!! hint \"提示\"\n\n    仅支持指令形式。\n\n!!! example \"例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\t;假设登记编号 (CharaID) 0的角色名为浩之，是主人公。\n\t\t;假设角色注册编号 (NO) 3的角色名为智子，编号5的角色名为蕾米，编号6的角色名为琴音\n\t\tPRINTFORML 当前在场角色有{CHARANUM}人。\n\t\tADDCHARA 3\n\t\tADDCHARA 5\n\t\tADDCHARA 6\n\t\tPRINTFORML 当前在场角色有{CHARANUM}人。\n\t\tREPEAT CHARANUM\n\t\t\tPRINTFORML {COUNT}号是%NAME:COUNT%。\n\t\tREND\n\t\tDELCHARA 2\n\t\tPRINTFORML 当前在场角色有{CHARANUM}人。\n\t\tREPEAT CHARANUM\n\t\tPRINTFORML {COUNT}号是%NAME:COUNT%。\n\t\t\tREND\n\t```\n    ```text\n\t当前在场角色有1人。\n\t当前在场角色有4人。\n\t0号是浩之。\n\t1号是智子。\n\t2号是蕾米。\n\t3号是琴音。\n\t当前在场角色有3人。\n\t0号是浩之。\n\t1号是智子。\n\t2号是琴音。\n    ```\n\n### 相关项目\n* DELCHARA\n* ADDVOIDCHARA\n* ADDCOPYCHARA"
  },
  {
    "id": "ADDCOPYCHARA",
    "title": "ADDCOPYCHARA",
    "names": [
      "ADDCOPYCHARA"
    ],
    "signatures": [
      {
        "name": "ADDCOPYCHARA",
        "params": "`int`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "新增一个与参数指定登记编号 (CharaID) 的角色数据完全相同的角色。也就是说，这是 ADDCHARA 的一个变体。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tADDCOPYCHARA charaID\n    ```\n\t新增一个与参数指定登记编号 (CharaID) 的角色数据完全相同的角色。也就是说，这是 `ADDCHARA` 的一个变体。\n\n!!! hint \"提示\"\n\n    仅支持作为指令使用。\n\n### 相关项目\n* ADDCHARA"
  },
  {
    "id": "ADDDEFCHARA",
    "title": "ADDDEFCHARA",
    "names": [
      "ADDDEFCHARA"
    ],
    "signatures": [
      {
        "name": "ADDDEFCHARA",
        "params": "无",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "执行游戏开始时的系统角色添加处理。",
    "body": "!!! info \"API\"\n\n    ```erb\n    ADDDEFCHARA\n    ```\n    执行游戏开始时的系统角色添加处理。\n    添加在 `chara0*.csv` 中定义的角色，以及在 `gamebase.csv` 中指定的初始角色。\n    `ADDCHARA 0` 是查找并添加角色 `NO` 为 `0` 的角色，而 `ADDDEFCHARA` 是根据 csv 的编号来添加角色。\n    如果对应的 csv 不存在，则会像 `ADDVOIDCHARA` 一样创建一个空角色。\n    这是为了重现 erameaker 初始化处理的命令，只能在 `@SYSTEM_TITLE` 中使用。\n\n!!! hint \"提示\"\n\n    仅支持作为命令使用。"
  },
  {
    "id": "ADDVOIDCHARA",
    "title": "ADDVOIDCHARA",
    "names": [
      "ADDVOIDCHARA"
    ],
    "signatures": [
      {
        "name": "ADDVOIDCHARA",
        "params": "无",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "此指令用于不依赖 CSV 文件添加角色。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tADDVOIDCHARA\n    ```\n\t此指令用于不依赖 CSV 文件添加角色。\n\t通过 `ADDVOIDCHARA` 添加的角色，其所有变量均被赋值为 `0` 或空字符串。\n\n!!! hint \"提示\"\n\n    仅支持指令形式。\n\n### 相关项目\n* ADDCHARA"
  },
  {
    "id": "ALIGNMENT",
    "title": "ALIGNMENT, CURRENTALIGN",
    "names": [
      "ALIGNMENT",
      "CURRENTALIGN",
      "ALIGHNMENT",
      "CURRENTALIGHN"
    ],
    "signatures": [
      {
        "name": "ALIGNMENT",
        "params": "`keyword`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "CURRENTALIGN",
        "params": "无",
        "returns": "`string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "ALIGNMENT 之后的文本行将按指定位置对齐。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tALIGHNMENT keyword\n\tstring CURRENTALIGHN\n    ```\n    `ALIGNMENT` 之后的文本行将按指定位置对齐。\n    关键字可指定为 `LEFT`、`CENTER`、`RIGHT` 中的任意一个。\n    通常的显示为 `ALIGNMENT LEFT`，即左对齐。\n    通过 `ALIGNMENT CENTER` 可以实现像标题画面那样的居中对齐。\n    `ALIGNMENT` 的效果在换行时生效。\n\n    当前的 `ALIGNMENT` 状态可以通过 `CURRENTALIGN` 获取。\n\n!!! hint \"提示\"\n\n    `CURRENTALIGHN` 支持在表达式中作为函数使用。\n\n!!! example \"例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tALIGNMENT RIGHT\n\t\tPRINTFORML あああ CURRENTALIGHN:%CURRENTALIGN()%\n\t\tALIGNMENT CENTER\n\t\tPRINTFORMW いいい CURRENTALIGHN:%CURRENTALIGN()%\n    ```\n\t![](../assets/images/ALIGNMENT.png)"
  },
  {
    "id": "ARGLEN",
    "title": "ARGLEN",
    "names": [
      "ARGLEN"
    ],
    "signatures": [
      {
        "name": "ARGLEN",
        "params": "无",
        "returns": "`int`",
        "engines": [
          "skia"
        ],
        "overloads": []
      }
    ],
    "summary": "返回当前函数调用中传入的可变长参数（VARIADIC）的数量。仅在用 VARIADIC 关键字声明的函数内返回有意义的值。",
    "body": "!!! info \"API\"\n\n\t```erb\n\tint ARGLEN\n\t```\n\n\t返回当前函数调用中传入的可变长参数（VARIADIC）的数量。仅在用 `VARIADIC` 关键字声明的函数内返回有意义的值。\n\n\t- `VARIADIC` 只能指定在函数参数声明的最后一个参数位置。\n\t- `VARIADIC` 只能修饰 `ARG`、`ARGS`、`ARGF`。\n\t- 同类型的 `ARG`/`ARGS`/`ARGF` 不能同时出现在固定参数和 VARIADIC 参数中（固定参数请使用私有变量）。\n\t- ARGLEN 本身不接受任何参数。\n\n!!! example \"示例\"\n\n\t```erb\n\t@SYSTEM_TITLE\n\t\tPRINTFORML 参数数量: {MYFUNC(1, 2, 3)}\n\n\t@MYFUNC(VARIADIC ARG:0)\n\t\t#FUNCTION\n\t\tRETURNF ARGLEN\n\t```\n\t```text\n\t参数数量: 3\n\t```\n\n\t混合固定参数与可变长参数的示例：\n\n\t```erb\n\t@SYSTEM_TITLE\n\t\tCALL GREET(\"你好\", \"田中\", \"佐藤\")\n\n\t@GREET(PREFIX, VARIADIC ARGS:0)\n\t\t; PREFIX 是私有变量（固定参数），ARGS:0... 是可变长字符串参数\n\t\tPRINTFORM %PREFIX%:\n\t\tREPEAT ARGLEN\n\t\t\tPRINTFORM  %ARGS:COUNT%\n\t\tREND\n\t\tPRINTL\n\t```\n\t```text\n\t你好: 田中 佐藤\n\t```"
  },
  {
    "id": "ARRAYCOPY",
    "title": "ARRAYCOPY",
    "names": [
      "ARRAYCOPY"
    ],
    "signatures": [
      {
        "name": "ARRAYCOPY",
        "params": "`varible`, `variable`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "实现无差别数组复制指令 ARRAYCOPY",
    "body": "!!! info \"API\"\n\n    ```erb\n\tARRAYCOPY variableName, variableName\n\t```\n\t实现无差别数组复制指令 ARRAYCOPY\n\t格式：ARRAYCOPY <源变量名>, <目标变量名>\n\t说明：将源变量的值复制到目标变量\n\t　　　类型变量要求类型相同且维度数相同\n\t　　　此外，不支持角色变量\n\t　　　若元素数量不同，则仅复制可复制的部分\n\n!!! hint \"提示\"\n\n    仅支持指令形式。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\t#DIM HOGE, 10\n\t\t#DIM HOGE2, 10\n\n\t\tREPEAT 10\n\t\t\tHOGE:COUNT = RAND:10\n\t\t\tHOGE2:COUNT = RAND:10\n\t\t\tPRINTFORML HOGE:{COUNT}={HOGE:COUNT} HOGE2:{COUNT}={HOGE2:COUNT}\n\t\tREND\n\n\t\tARRAYCOPY \"HOGE\", \"HOGE2\"\n\n\t\tPRINTL 复制后...\n\n\t\tREPEAT 10\n\t\t\tPRINTFORML HOGE:{COUNT}={HOGE:COUNT} HOGE2:{COUNT}={HOGE2:COUNT}\n\t\tREND\n\t\tWAIT\n    ```\n    ```text\n\tHOGE:0=9 HOGE2:0=3\n\tHOGE:1=0 HOGE2:1=3\n\tHOGE:2=7 HOGE2:2=0\n\tHOGE:3=3 HOGE2:3=3\n\tHOGE:4=1 HOGE2:4=3\n\tHOGE:5=2 HOGE2:5=0\n\tHOGE:6=3 HOGE2:6=9\n\tHOGE:7=3 HOGE2:7=3\n\tHOGE:8=4 HOGE2:8=9\n\tHOGE:9=5 HOGE2:9=2\n\tAfter copy...\n\tHOGE:0=9 HOGE2:0=9\n\tHOGE:1=0 HOGE2:1=0\n\tHOGE:2=7 HOGE2:2=7\n\tHOGE:3=3 HOGE2:3=3\n\tHOGE:4=1 HOGE2:4=1\n\tHOGE:5=2 HOGE2:5=2\n\tHOGE:6=3 HOGE2:6=3\n\tHOGE:7=3 HOGE2:7=3\n\tHOGE:8=4 HOGE2:8=4\n\tHOGE:9=5 HOGE2:9=5\n    ```"
  },
  {
    "id": "ARRAYMSORT",
    "title": "ARRAYMSORT",
    "names": [
      "ARRAYMSORT",
      "ARRAY1",
      "ARRAY2",
      "PRINTFORML",
      "FOR",
      "NEXT"
    ],
    "signatures": [
      {
        "name": "ARRAYMSORT",
        "params": "`variable`(, `variable`...)",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "ARRAYMSORT 将 variableName1 按升序排序，并按照相同的顺序重新排列 variableName2 及后续的数组。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tARRAYMSORT variableName1(, variableName2,...)\n    ```\n\t`ARRAYMSORT` 将 `variableName1` 按升序排序，并按照相同的顺序重新排列 `variableName2` 及后续的数组。\n\t`variableName1` 必须是一维数组。`variableName2` 及后续参数可以接受多维数组。\n\t当 `variableName1` 中存在 `0` 或空字符串元素时，会将其视为数组的结束标志，其后的元素将不参与排序。\n\t如果 `variableName2` 及后续数组的元素数量少于 `variableName1` 排序后的元素数量，则指令会中断，并将 `0` 赋值给 `RESULT:0` 后结束。\n\t如果所有数组排序成功，此指令会将非 0 值赋值给 `RESULT:0` 后结束。\n\n    ```erb\n    @TEST\n    #DIM ARRAY1,4\n    #DIM ARRAY2,4\n    #DIM ARRAY3,4,3\n    ARRAY1 = 3,1,2,0\n    ARRAY2 = 1001,1002,1003,0\n    ARRAY3:0:0 = 1, 101, 2763\n    ARRAY3:1:0 = 2, 102, 9615\n    ARRAY3:2:0 = 3, 103, 7035\n\n    ARRAYMSORT ARRAY1,ARRAY2,ARRAY3\n    PRINTFORML > ARRAY1 == {ARRAY1:0},{ARRAY1:1},{ARRAY1:2},{ARRAY1:3}\n    PRINTFORML > ARRAY2 == {ARRAY2:0},{ARRAY2:1},{ARRAY2:2},{ARRAY2:3}\n    FOR I,0,3\n        PRINTFORML > ARRAY3:{I}:0 == {ARRAY3:I:0},{ARRAY3:I:1},{ARRAY3:I:2}\n    NEXT\n\n\t;;;输出\n\t> ARRAY1 == 1,2,3,0\n\t> ARRAY2 == 1002,1003,1001,0\n\t> ARRAY3:0:0 == 2,102,9615\n\t> ARRAY3:1:0 == 3,103,7035\n\t> ARRAY3:2:0 == 1,101,2763\n\t```\n\n!!! hint \"提示\"\n\n    仅支持命令。\n\n### 相关项目\n* ARRAYSORT"
  },
  {
    "id": "ARRAYMSORTEX",
    "title": "ARRAYMSORTEX",
    "names": [
      "ARRAYMSORTEX"
    ],
    "signatures": [
      {
        "name": "ARRAYMSORTEX",
        "params": "`string`, `ref` `string[]`(, `int`, `int`)",
        "returns": "`1`",
        "engines": [
          "em"
        ],
        "overloads": [
          "`ref` `int`, `ref` `string[]`(, `int`, `int`)"
        ]
      }
    ],
    "summary": "与本家的 ARRAYMSORTEX 函数类似。",
    "body": "!!! info \"API\"\n\n    ```erb\n    1. 1 ARRAYMSORTEX array_indexName, arrayNameList(, sortAscending, size)\n    2. 1 ARRAYMSORTEX array_indexArray, arrayNameList(, sortAscending, size)\n    ```\n\n    与本家的 [`ARRAYMSORTEX`](https://osdn.net/projects/emuera/wiki/excom#h5-ARRAYMSORT.20array_a.7B.2C.20array_b....7D) 函数类似。\n\n    1. 将名为 `array_indexName` 的数组变量重新排序，以排序后的顺序为基准，继续排列 `arrayNameList` 里的矩阵。\n    2. 将数组变量 `array_indexArray` 重新排序，以排序后的顺序为基准，继续排列 `arrayNameList` 里的矩阵。\n\n    `sortAscending` 参数设置为「`0` 以外的数值」或直接省略时，顺序排列；否则倒序排列。若指定了 `size`，则不将 `0` / 空字符串视为数组结尾，而是参考指定的数组范围。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        #DIM array_index = 4, 3, 1, 2\n        #DIMS array_key = \"1\", \"2\", \"3\", \"4\"\n        #DIM array_a = 14, 13, 11, 12\n        #DIMS array_b = \"D\", \"C\", \"A\", \"B\"\n        #DIMS arrays_name = \"array_index\", \"array_a\", \"array_b\"  ; 不加入 array_index 就不会重新排序\n\n        ARRAYMSORTEX array_index, arrays_name  ; 顺序\n        PRINTFORML > array_index == {array_index},{array_index:1},{array_index:2},{array_index:3}\n        PRINTFORML > array_a == {array_a},{array_a:1},{array_a:2},{array_a:3}\n        PRINTFORML > array_b == %array_b%,%array_b:1%,%array_b:2%,%array_b:3%\n        PRINTL\n        ARRAYMSORTEX \"array_key\", arrays_name, 0  ; 倒序\n        PRINTFORML > array_key == %array_key%,%array_key:1%,%array_key:2%,%array_key:3%\n        PRINTFORML > array_a == {array_a},{array_a:1},{array_a:2},{array_a:3}\n        PRINTFORML > array_b == %array_b%,%array_b:1%,%array_b:2%,%array_b:3%\n\n        ONEINPUT\n    ```\n    ```text\n    > array_index == 1,2,3,4\n    > array_a == 11,12,13,14\n    > array_b == A,B,C,D\n\n    > array_key == 1,2,3,4\n    > array_a == 14,13,12,11\n    > array_b == D,C,B,A\n    ```\n\n### 相关项目\n* ARRAYSORT"
  },
  {
    "id": "ARRAYREMOVE",
    "title": "ARRAYREMOVE",
    "names": [
      "ARRAYREMOVE"
    ],
    "signatures": [
      {
        "name": "ARRAYREMOVE",
        "params": "`variable`, `int`, `int`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "实现用于部分删除数组元素的指令 ARRAYREMOVE。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tARRAYREMOVE variableName, startIndex, clearCount\n    ```\n\t实现用于部分删除数组元素的指令 ARRAYREMOVE。\n\t格式：`ARRAYREMOVE` `<目标变量>, <删除范围起始索引>, <删除元素数量>`\n\t说明：从指定的起始索引开始，删除数组变量中指定数量的元素，并将后续元素向前移动填补空缺。\n　　　　　若删除元素数量设置为0或负数，则会删除从起始索引开始到数组末尾的所有元素。\n\n!!! hint \"提示\"\n\n    仅支持指令形式。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\t#DIM HOGE, 10\n\t\t#DIM HOGE2, 10\n\n\t\tREPEAT 10\n\t\t\tHOGE:COUNT = COUNT\n\t\t\tHOGE2:COUNT = COUNT\n\t\tREND\n\n\t\tARRAYREMOVE HOGE, 4, 3\n\t\tARRAYREMOVE HOGE2, 6, -1\n\n\t\tREPEAT 10\n\t\t\tPRINTFORML HOGE:{COUNT}={HOGE:COUNT} HOGE2:{COUNT}={HOGE2:COUNT}\n\t\tREND\n\t\tWAIT\n    ```\n    ```text\n\tHOGE:0=0 HOGE2:0=0\n\tHOGE:1=1 HOGE2:1=1\n\tHOGE:2=2 HOGE2:2=2\n\tHOGE:3=3 HOGE2:3=3\n\tHOGE:4=7 HOGE2:4=4\n\tHOGE:5=8 HOGE2:5=5\n\tHOGE:6=9 HOGE2:6=0\n\tHOGE:7=0 HOGE2:7=0\n\tHOGE:8=0 HOGE2:8=0\n\tHOGE:9=0 HOGE2:9=0\n    ```"
  },
  {
    "id": "ARRAYSHIFT",
    "title": "ARRAYSHIFT",
    "names": [
      "ARRAYSHIFT"
    ],
    "signatures": [
      {
        "name": "ARRAYSHIFT",
        "params": "`variable`, `int`, `value`(, `int`, `int`)",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "实现用于数组位移的命令 ARRAYSHIFT",
    "body": "!!! info \"API\"\n\n    ```erb\n\tARRAYSHIFT variable, shiftCount, value(, startIndex, targetCount)\n    ```\n\t实现用于数组位移的命令 ARRAYSHIFT\n\t格式：`ARRAYSHIFT <目标变量>, <位移数量>, <位移后空白区域的初始值>{, <位移数组范围的起始索引>, <位移数组元素的范围数量>}`\n\t说明：将数组变量按指定数量进行位移，正数向索引增大的方向位移，负数向索引减小的方向位移\n\t　　　超出数组范围的值将被丢弃，位移后产生的空白区域将用第二个参数指定的值填充\n\t　　　使用可选的第四和第五个参数，可以仅对数组的一部分范围进行位移\n\n!!! hint \"提示\"\n\n    仅支持命令形式。\n\n!!! example \"例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\t#DIM HOGE, 10\n\t\t#DIM HOGE2, 10\n\n\t\tREPEAT 10\n\t\t\tHOGE:COUNT = COUNT\n\t\t\tHOGE2:COUNT = COUNT\n\t\tREND\n\n\t\tARRAYSHIFT HOGE, 3, -1\n\t\tARRAYSHIFT HOGE2, 3, -1, 5, 5\n\n\t\tREPEAT 10\n\t\t\tPRINTFORML HOGE:{COUNT}={HOGE:COUNT} HOGE2:{COUNT}={HOGE2:COUNT}\n\t\tREND\n\t\tWAIT\n    ```\n    ```text\n\tHOGE:0=-1 HOGE2:0=0\n\tHOGE:1=-1 HOGE2:1=1\n\tHOGE:2=-1 HOGE2:2=2\n\tHOGE:3=0 HOGE2:3=3\n\tHOGE:4=1 HOGE2:4=4\n\tHOGE:5=2 HOGE2:5=-1\n\tHOGE:6=3 HOGE2:6=-1\n\tHOGE:7=4 HOGE2:7=-1\n\tHOGE:8=5 HOGE2:8=5\n\tHOGE:9=6 HOGE2:9=6\n    ```"
  },
  {
    "id": "ARRAYSORT",
    "title": "ARRAYSORT",
    "names": [
      "ARRAYSORT"
    ],
    "signatures": [
      {
        "name": "ARRAYSORT",
        "params": "`variable`(, `sortFormat`, `int`, `int`)",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "对数组变量进行排序的ARRAYSORT实现",
    "body": "!!! info \"API\"\n\n    ```erb\n    ARRAYSORT variableName(, FORWARD or BACK, startIndex, targetCount)\n    ```\n    对数组变量进行排序的ARRAYSORT实现\n    格式：`ARRAYSORT` \\[目标变量\\](, \\[排序方式(FORWARD or BACK)\\], \\[起始索引\\], \\[目标元素数量\\])\n    说明：从起始索引开始，对指定数量的数组数据进行排序\n    　　　`FORWARD`为升序，`BACK`为降序\n\n!!! hint \"提示\"\n\n    仅支持命令形式。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\t#DIM HOGE, 10\n\t\t#DIM HOGE2, 10\n\n\t\tREPEAT 10\n\t\t\tHOGE:COUNT = RAND:10\n\t\t\tHOGE2:COUNT = COUNT\n\t\t\tPRINTFORML HOGE:{COUNT}={HOGE:COUNT} HOGE2:{COUNT}={HOGE2:COUNT}\n\t\tREND\n\n\t\tARRAYSORT HOGE\n\t\tARRAYSORT HOGE2, BACK, 4, 4\n\n\t\tPRINTL 排序后...\n\n\t\tREPEAT 10\n\t\t\tPRINTFORML HOGE:{COUNT}={HOGE:COUNT} HOGE2:{COUNT}={HOGE2:COUNT}\n\t\tREND\n\t\tWAIT\n    ```\n    ```text\n\tHOGE:0=9 HOGE2:0=0\n\tHOGE:1=9 HOGE2:1=1\n\tHOGE:2=0 HOGE2:2=2\n\tHOGE:3=8 HOGE2:3=3\n\tHOGE:4=3 HOGE2:4=4\n\tHOGE:5=8 HOGE2:5=5\n\tHOGE:6=6 HOGE2:6=6\n\tHOGE:7=7 HOGE2:7=7\n\tHOGE:8=5 HOGE2:8=8\n\tHOGE:9=1 HOGE2:9=9\n\tAfter sort...\n\tHOGE:0=0 HOGE2:0=0\n\tHOGE:1=1 HOGE2:1=1\n\tHOGE:2=3 HOGE2:2=2\n\tHOGE:3=5 HOGE2:3=3\n\tHOGE:4=6 HOGE2:4=7\n\tHOGE:5=7 HOGE2:5=6\n\tHOGE:6=8 HOGE2:6=5\n\tHOGE:7=8 HOGE2:7=4\n\tHOGE:8=9 HOGE2:8=8\n\tHOGE:9=9 HOGE2:9=9\n    ```\n\n### 相关项目\n* ARRAYMSORT\n* ARRAYMSORTEX"
  },
  {
    "id": "ASSERT",
    "title": "ASSERT",
    "names": [
      "ASSERT"
    ],
    "signatures": [
      {
        "name": "ASSERT",
        "params": "`int`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "DEBUG 系列命令仅在以调试模式启动时才会执行。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tASSERT bool\n    ```\n\t`DEBUG` 系列命令仅在以[调试模式](../Emuera/debug.zh.md)启动时才会执行。\n\t在非调试模式下，这些命令不会执行任何操作。\n\t在非调试模式下，甚至不会解析参数，因此即使<格式化字符串>中存在错误，也不会导致报错。\n\n    `ASSERT` 在参数为真（非零）时，不执行任何操作。\n    当参数为假（0）时，会输出错误并停止脚本执行。\n\n!!! hint \"提示\"\n\n    仅支持命令形式。\n\n### 相关项目\n* THROW"
  },
  {
    "id": "AWAIT",
    "title": "AWAIT",
    "names": [
      "AWAIT",
      "REDRAW",
      "FOR",
      "PRINTSL",
      "CLEARLINE",
      "NEXT"
    ],
    "signatures": [
      {
        "name": "AWAIT",
        "params": "`int`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "暂停ERB的执行，进行Windows的处理。",
    "body": "!!! info \"API\"\n\n    ```erb\n    AWAIT milliSecond\n    ```\n    暂停ERB的执行，进行Windows的处理。\n    如果指定了参数，则等待执行指定的毫秒数。\n    `AWAIT`指令会中断Emuera的无限循环警告，防止Emuera进程进入“无响应”状态。\n    请在执行耗时处理时使用。\n    但是，`AWAIT`指令本身也需要一定的执行时间，过于频繁地使用会导致速度变慢。\n    另外，为了避免让用户感到不安，建议像下面这样逐次显示工作进度。\n    ```erb\n    REDRAW 0\n    FOR LCNT, 0, 100\n        PRINTSL \"处理中・・・ \" + TOSTR(LCNT) + \"％ 完成\"\n        AWAIT\n        CLEARLINE 1\n        ;耗时处理\n    NEXT\n    ```\n\n!!! hint \"提示\"\n\n    仅支持作为指令使用。\n\n### 相关项目\n* WAIT\n* TWAIT\n* TINPUTNF"
  },
  {
    "id": "BACKGROUND",
    "title": "BACKGROUND操作系",
    "names": [
      "SETBGIMAGE",
      "REMOVEBGIMAGE",
      "CLEARBGIMAGE",
      "BACKGROUND"
    ],
    "signatures": [
      {
        "name": "SETBGIMAGE",
        "params": "`string`(, `int`, `int`)",
        "returns": "无",
        "engines": [
          "etc"
        ],
        "overloads": []
      },
      {
        "name": "REMOVEBGIMAGE",
        "params": "`string`",
        "returns": "无",
        "engines": [
          "etc"
        ],
        "overloads": []
      },
      {
        "name": "CLEARBGIMAGE",
        "params": "无",
        "returns": "无",
        "engines": [
          "etc"
        ],
        "overloads": []
      }
    ],
    "summary": "制作者：Neo_Kesha",
    "body": "制作者：Neo_Kesha\n\n!!! info \"API\"\n\t```erb\n\tSETBGIMAGE resourceName(, depth, opacity)\n\tREMOVEBGIMAGE resourceName\n\tCLEARBGIMAGE\n\t```\n\n\t`SETBGIMAGE` 将参数指定的图像设置为 Emuera 的背景图像。Depth（深度）和 Opacity（透明度）为可选参数。\n\tDepth 的默认值为 0，也可以指定负值。\n\tOpacity 可以用 0 到 255 的数值指定。\n\n\t`REMOVEBGIMAGE` 用于删除由 `SETBGIMAGE` 设置的背景图像。\n\t`CLEARBGIMAGE` 用于删除所有背景图像。\n\n\t这是一组用于向 Emuera 控制台窗口添加背景的命令。不支持 WINAPI。\n\t背景必须在资源 CSV 文件中定义。背景支持透明度和图层。\n\t背景会动态调整大小以适合控制台窗口，同时保持宽高比。\n\n!!! note \"参数解析说明\"\n\n\t`resourceName` 参数的解析方式因版本而异：\n\n\t| 版本 | 解析方式 | 变量参数行为 |\n\t|:---|:---|:---|\n\t| emuera.em | `FORM_STR_ANY` | ❌ 变量名被当作字面量字符串查找，静默失败 |\n\t| lazyloading 变体 | 类型化字符串表达式 | ✅ 正确读取变量值 |\n\n\t**示例**：\n\t```erb\n\t#DIMS temp_name\n\ttemp_name = \"小帽_笑_3\"\n\tSETBGIMAGE temp_name  ; lazyloading 正常工作，emuera.em 静默失败\n\tSETBGIMAGE %temp_name%  ; emuera.em 正确写法\n\t```\n\n!!! hint \"提示\"\n\n\t仅支持命令形式。"
  },
  {
    "id": "BAR",
    "title": "BAR(L)",
    "names": [
      "BAR",
      "BARL"
    ],
    "signatures": [
      {
        "name": "BAR",
        "params": "`int`, `int`, `int`",
        "returns": "无",
        "engines": [
          "eramaker"
        ],
        "overloads": []
      },
      {
        "name": "BARL",
        "params": "`int`, `int`, `int`",
        "returns": "无",
        "engines": [
          "eramaker"
        ],
        "overloads": []
      }
    ],
    "summary": "绘制一个条形图，表示第一个参数相对于第二个参数的比例。第三个参数可以设置条形的长度。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tBAR value, maxValue, length\n    ```\n    绘制一个条形图，表示第一个参数相对于第二个参数的比例。第三个参数可以设置条形的长度。\n\t`BAR` 在显示后不换行，而 `BARL` 在显示后会换行。\n\n!!! hint \"提示\"\n\n    仅支持指令。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tBAR 2, 10, 20\n\t\tPRINTL (2/10)\n\t\tBARL 114, 514, 81\n    ```\n    ```text\n\t[****................](2/10)\n\t[*****************................................................................]\n    ```\n\n### 相关项目\n* BARSTR"
  },
  {
    "id": "BARSTR",
    "title": "BARSTR",
    "names": [
      "BARSTR"
    ],
    "signatures": [
      {
        "name": "BARSTR",
        "params": "`int`, `int`, `int`",
        "returns": "`string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "将使用相同参数的BAR命令所显示的字符串赋值给RESULTS:0或返回该字符串。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tstring BARSTR value, maxValue, length\n    ```\n\t将使用相同参数的`BAR`命令所显示的字符串赋值给RESULTS:0或返回该字符串。\n\n!!! hint \"提示\"\n\n    该功能同时支持作为命令和表达式函数使用。\n\n### 相关项目\n* BAR"
  },
  {
    "id": "BEGIN",
    "title": "BEGIN",
    "names": [
      "BEGIN"
    ],
    "signatures": [
      {
        "name": "BEGIN",
        "params": "`identifier`",
        "returns": "无",
        "engines": [
          "eramaker"
        ],
        "overloads": []
      }
    ],
    "summary": "BEGIN 通过调用各种系统指令来推进游戏进程。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tBEGIN identifier\n    ```\n\t`BEGIN` 通过调用各种系统指令来推进游戏进程。\n\t调用 `BEGIN` 时，**当前函数**立即终止 —— `BEGIN` 之后的语句不会执行。但它**不会中断调用链**：调用者会照常执行完毕，控制权逐层交还，直到整个调用栈清空时才真正切换到目标状态（届时才由引擎调用该状态对应的事件函数）。不要把它理解为\"整个流程到此为止\"。`BEGIN` 也不改写 `RESULT`。\n\n    `BEGIN TRAIN` 用于开始调教。\n    `BEGIN AFTERTRAIN` 用于结束调教。\n    `BEGIN ABLUP` 用于呼出能力提升界面。\n    `BEGIN TURNEND` 用于结束当前回合。\n    `BEGIN SHOP` 用于呼出 `SHOP`。\n\n    在 Emuera 中，新增了 `FIRST` 和 `TITLE` 作为关键字。\n    `BEGIN FIRST` 的效果与在标题画面选择 `[0] 从头开始` 相同，将执行事件函数 `@EVENTFIRST`。\n    `BEGIN TITLE` 用于返回标题画面。\n    请注意，这两条指令均不会初始化变量，请根据需要适时执行 `RESETDATA` 指令。\n\n!!! hint \"提示\"\n\n    仅支持作为指令使用。\n\n### 相关项目\n* FORCE_BEGIN\n* FLOWINPUT\n* CALLEVENT"
  },
  {
    "id": "BINPUT",
    "title": "BINPUT(S)",
    "names": [
      "BINPUT",
      "BINPUTS"
    ],
    "signatures": [
      {
        "name": "BINPUT",
        "params": "(`int`, `int`, `int`)",
        "returns": "`int`",
        "engines": [
          "ee"
        ],
        "overloads": []
      },
      {
        "name": "BINPUTS",
        "params": "(`string`, `int`, `int`)",
        "returns": "`string`",
        "engines": [
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "仅接受在执行时已按钮化的值的 INPUT(S)。",
    "body": "!!! info \"API\"\n\n    ```erb\n    BINPUT (defaultValue, AllowClick, CanSkip)\n    BINPUTS (defaultValue, AllowClick, CanSkip)\n    ```\n\n    仅接受在执行时已按钮化的值的 INPUT(S)。\n    并非“仅接受通过按钮输入”，而是“仅接受已按钮化的值”，因此可以在兼顾键盘操作和鼠标操作的同时，排除预期之外的值。\n    如果没有任何按钮，则不会等待输入，而是将默认值放入 RESULT(S)；如果没有默认值，则会发生错误。\n    参数规格与 EM+EE 的 INPUT 扩展相同。\n\n!!! hint \"提示\"\n\n\t由于是命令，因此不能作为表达式中的函数使用。\n\n### 相关项目\n* INPUT"
  },
  {
    "id": "BIT_OPERATION",
    "title": "BIT操作系",
    "names": [
      "GETBIT",
      "SETBIT",
      "CLEARBIT",
      "INVERTBIT",
      "RESULT",
      "X",
      "Y",
      "Z",
      "BIT_OPERATION"
    ],
    "signatures": [
      {
        "name": "GETBIT",
        "params": "`int`, `int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "SETBIT",
        "params": "`integerVariable`, `int`(, `int`...)",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "CLEARBIT",
        "params": "`integerVariable`, `int`(, `int`...)",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "INVERTBIT",
        "params": "`integerVariable`, `int`(, `int`...)",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "这是用于位操作的函数。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint GETBIT targetInt, bit\n\tSETBIT integerVariable, bit(, bit...)\n\tCLEARBIT integerVariable, bit(, bit...)\n\tINVERTBIT integerVariable, bit(, bit...)\n    ```\n\t这是用于位操作的函数。\n\n\t`GETBIT` 用于获取参数中特定的位。\n\t第一个参数指定目标数字，第二个参数指定要获取的位的位置。第二个参数可以指定的值范围为 `0～63`，指定范围外的数值会导致错误。\n\t如果第二个参数是常量，例如 `5`，那么：\n\n    ```erb\n\tGETBIT X, 5\n\tRESULT = (X & 1p5) != 0\n\t```\n\n\t这两行代码会产生相同的结果。\n\n    `SETBIT`、`CLEARBIT`、`INVERTBIT` 用于操作第一个参数指定的变量中，由第二个及后续参数指定位置的比特位。\n        `SETBIT` 将比特位设为 `1`，`CLEARBIT` 设为 `0`，`INVERTBIT` 则进行翻转。\n\n    ```erb\n\tSETBIT X, A\n\tCLEARBIT Y, B\n\tINVERTBIT Z, C\n\t```\n\n\t其结果与以下代码相同：\n\n    ```erb\n\tX |= 1 << A\n\tY &= ~(1 << B)\n\tZ ^= 1 << C\n\t```\n\n\t此外，这些格式与 `GETBIT` 相对应。\n\t可以通过 `GETBIT(X, A)` 来引用由 `SETBIT X, A` 更改的比特位。\n\n!!! hint \"提示\"\n\n    除 `SETBIT` 外，其他函数均支持在表达式中使用。\n\n### 相关项目\n* [系统改造Q&A>二进制位操作](../manual/erawiki-modification-QandA.zh.md)\n* [ERB制作实践篇>关于位数](../manual/erawiki-ERBmanual.md#_7)"
  },
  {
    "id": "BITARRAY",
    "title": "BITSET / BITGET / BITTOGGLE / BITINDEXOFFIRST",
    "names": [
      "BITSET",
      "BITGET",
      "BITTOGGLE",
      "BITINDEXOFFIRST",
      "BITARRAY"
    ],
    "signatures": [
      {
        "name": "BITSET",
        "params": "`ref int[]`, `int`(, `int`, `int`)",
        "returns": "`int`",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "BITGET",
        "params": "`ref int[]`, `int`",
        "returns": "`int`",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "BITTOGGLE",
        "params": "`ref int[]`, `int`",
        "returns": "`int`",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "BITINDEXOFFIRST",
        "params": "`ref int[]`(, `int`)",
        "returns": "`int`",
        "engines": [
          "skia"
        ],
        "overloads": []
      }
    ],
    "summary": "使用整数数组模拟位图（Bitmap），提供位的设置、读取、翻转和查找功能。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int BITSET arrayRef, idxID{, val, length}\n    int BITGET arrayRef, idxID\n    int BITTOGGLE arrayRef, idxID\n    int BITINDEXOFFIRST arrayRef{, val}\n    ```\n\n    使用整数数组模拟位图（Bitmap），提供位的设置、读取、翻转和查找功能。\n\n    1. **BITSET** - 设置位图中指定位置的一个或多个连续位\n       - `array`: 位图数组（REF传递，会被修改）\n       - `idx`: 起始位索引（从0开始）\n       - `val`: 要设置的值（0为清除，1为设置，非0值也视为1），默认为1\n       - `length`: 连续设置的位数，默认为1\n       - 返回 1 表示操作成功\n\n    2. **BITGET** - 读取位图中指定位置的位值\n       - `array`: 位图数组\n       - `idx`: 要读取的位索引（从0开始）\n       - 返回位值（0或1），索引超出范围时返回-1\n\n    3. **BITTOGGLE** - 翻转位图中指定位置的位值（0变1，1变0）\n       - `array`: 位图数组（REF传递，会被修改）\n       - `idx`: 要翻转的位索引（从0开始）\n       - 返回 1=成功翻转，0=索引超出范围\n\n    4. **BITINDEXOFFIRST** - 查找位图中第一个具有指定值的位的位置\n       - `array`: 位图数组\n       - `val`: 要查找的位值（0或1，0以外的值都视为1），默认为0\n       - 返回第一个匹配位的索引，未找到时返回-1\n\n    !!! warning \"注意\"\n        - 位图使用小端序存储，每个数组元素存储64位\n        - 索引从0开始，超出范围的操作会被忽略\n        - 使用前需先声明整数数组作为位图的存储容器\n\n!!! hint \"提示\"\n\n    支持命令和表达式函数两种形式。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n        ; 创建位图数组（4个元素 = 256位）\n        #DIM DYNAMIC BIT_ARRAY, 4\n\n        ; BITSET - 设置位\n        BITSET BIT_ARRAY, 5, 1, 1\n        PRINTFORML BITGET(BIT_ARRAY, 5) = {BITGET(BIT_ARRAY, 5)}\n\n        ; BITGET - 读取位\n        PRINTFORML BITGET(BIT_ARRAY, 4) = {BITGET(BIT_ARRAY, 4)}\n        PRINTFORML BITGET(BIT_ARRAY, 6) = {BITGET(BIT_ARRAY, 6)}\n\n        ; BITTOGGLE - 翻转位\n        BITTOGGLE BIT_ARRAY, 5\n        PRINTFORML BITGET(BIT_ARRAY, 5) = {BITGET(BIT_ARRAY, 5)} (应为0)\n\n        ; 批量设置\n        BITSET BIT_ARRAY, 10, 1, 6\n        PRINTFORML BITINDEXOFFIRST(BIT_ARRAY, 1) = {BITINDEXOFFIRST(BIT_ARRAY, 1)}\n\n        ; 清除位\n        BITSET BIT_ARRAY, 5, 0, 1\n        PRINTFORML BITINDEXOFFIRST(BIT_ARRAY, 1) = {BITINDEXOFFIRST(BIT_ARRAY, 1)}\n\n        ; 越界访问\n        PRINTFORML BITGET(BIT_ARRAY, 300) = {BITGET(BIT_ARRAY, 300)} (应返回-1)\n\n        ONEINPUT\n    ```\n    ```text\n    BITGET(BIT_ARRAY, 5) = 1\n    BITGET(BIT_ARRAY, 4) = 0\n    BITGET(BIT_ARRAY, 6) = 0\n    BITGET(BIT_ARRAY, 5) = 0 (应为0)\n    BITINDEXOFFIRST(BIT_ARRAY, 1) = 5\n    BITINDEXOFFIRST(BIT_ARRAY, 1) = 10\n    BITGET(BIT_ARRAY, 300) = -1 (应返回-1)\n    ```"
  },
  {
    "id": "BITMAP_CACHE_ENABLE",
    "title": "BITMAP_CACHE_ENABLE",
    "names": [
      "BITMAP_CACHE_ENABLE"
    ],
    "signatures": [
      {
        "name": "BITMAP_CACHE_ENABLE",
        "params": "`int`",
        "returns": "void",
        "engines": [
          "etc"
        ],
        "overloads": []
      }
    ],
    "summary": "制作者：JukesBouver99",
    "body": "制作者：JukesBouver99\n\n!!! info \"API\"\n\n    ```erb\n    BITMAP_CACHE_ENABLE bool\n    ```\n\n    通过将频繁改变颜色的文本作为位图进行绘制，以提高绘制速度。\n    启用后，将应用于之后的所有行。通过用 `BITMAP_CACHE_ENABLE 1` 和 `BITMAP_CACHE_ENABLE 0` 包围处理负荷较重的部分，有望实现加速。\n\n    启用此功能后，文本的显示位置可能会发生偏移。\n\n!!! hint \"提示\"\n\n    该功能同时支持指令和表达式函数两种形式。\n\n!!! skia \"Skia版的变更\"\n\n    | 项目 | EM+EE | Skia版 |\n    |:---|:---|:---|\n    | `BITMAP_CACHE_ENABLE` | 式中函数（有返回值） | 命令（无返回值） |\n\n    EM+EE 中作为式中函数实现，Skia 版重构为命令。功能本身无变化。\n\n### 相关项目\n- [命令 vs 表达式 — 两种求值路径的根本差异](../tutorial/command-vs-expression.zh.md) — RESULT 污染问题与式中函数重构为命令的原因\n- [Skia版规格变更一览](../Skia/Skia_Summary.zh.md#changed-commands)"
  },
  {
    "id": "BREAKBUTTON",
    "title": "BREAKBUTTON",
    "names": [
      "BREAKBUTTON"
    ],
    "signatures": [
      {
        "name": "BREAKBUTTON",
        "params": "`()`",
        "returns": "无",
        "engines": [
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "强制更新画面的按钮化状态。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tBREAKBUTTON\n    ```\n\n    强制更新画面的按钮化状态。\n    通常，按钮化会在每一帧自动进行，但使用此命令可以立即更新按钮化状态。\n    特别适用于动态更改文本后需要立即启用按钮的场景。\n\n!!! hint \"提示\"\n\n    由于是命令，因此不能作为表达式中的函数使用。\n    无参数。\n\n### 相关项目\n* INPUT"
  },
  {
    "id": "CALL",
    "title": "CALL",
    "names": [
      "CALL"
    ],
    "signatures": [
      {
        "name": "CALL",
        "params": "`functionName`",
        "returns": "`void`¹",
        "engines": [
          "eramaker"
        ],
        "overloads": []
      }
    ],
    "summary": "调用以@开头的字符串定义的函数",
    "body": "!!! info \"API\"\n\n\t```erb\n\tCALL funcName\n\t```\n\n    调用以`@`开头的字符串定义的函数\n    当到达函数末尾或执行`RETURN`时，函数结束并返回到执行`CALL`的那一行\n    如果执行了`RETURN`，则其参数会存入`RESULT`；如果到达函数末尾，则`0`会存入`RESULT`\n\n!!! hint \"提示\"\n\n\t此功能仅作为指令使用。\n\n!!! example \"示例\"\n\n\t```erb\n\t@SYSTEM_TITLE\n\t\tCALL AAA\n\t\tPRINTFORML {RESULT}\n\t\tCALL BBB\n\t\tPRINTFORML {RESULT}\n\t\tWAIT\n\n\t@AAA\n\t\tPRINTL Here is @AAA\n\t\tRETURN 123\n\n\t@BBB\n\t\tPRINTL Here is @BBB\n\t```\n\n\t```text\n\tHere is @AAA\n\t123\n\tHere is @BBB\n\t0\n\t```\n\n### 相关项目\n- CALLFORM\n- TRYCALLFORM\n- EXISTFUNCTION\n- CALLSTR\n\n### [Skia]Skia 版变更\n\n!!! info \"参数安全性优化\"\n\n    Skia 版对原版函数调用中的参数处理安全性进行了以下改善：\n\n    - **多余参数静默丢弃**：原版中调用时的参数超过函数定义的参数数量会报错，Skia 版则静默忽略多余参数。这与 CALLSTR 系的运行时解析行为保持一致。\n    - **TRY 系安全网**：原版中 `ConvertArg` 失败时，`TRYCALL` 等也会崩溃，Skia 版通过 `isTry` 标志安全跳转到 `CATCH` 句。"
  },
  {
    "id": "CALLEVENT",
    "title": "CALLEVENT",
    "names": [
      "CALLEVENT"
    ],
    "signatures": [
      {
        "name": "CALLEVENT",
        "params": "`functionName`",
        "returns": "`void`¹",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "将事件函数作为事件函数调用。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tCALLEVENT eventFuction\n    ```\n\t将事件函数作为事件函数调用。\n\t无法传递参数。\n\t也无法在事件函数内部或从事件函数调用的函数内部使用。\n\n!!! hint \"提示\"\n\n    仅支持命令形式。"
  },
  {
    "id": "CALLF",
    "title": "CALLF, CALLFORMF",
    "names": [
      "CALLF",
      "CALLFORMF"
    ],
    "signatures": [
      {
        "name": "CALLF",
        "params": "`functionName`",
        "returns": "`void`¹",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "CALLFORMF",
        "params": "`formedString`",
        "returns": "`void`¹",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "以下摘自私家改造版更新日志：",
    "body": "!!! info \"API\"\n\n    ```erb\n\tCALLF functionName\n\tCALLFORMF formedString\n    ```\n\t以下摘自私家改造版更新日志：\n\n\t\t实现了用于忽略返回值调用表达式中函数的指令 CALLF、CALLFORMF。\n\t\t格式：CALLF 函数名, 参数1, ....\n\t\t　　（虽然是表达式中函数，但请使用普通函数的参数格式调用）\n\t\t内容：将表达式中函数当作普通函数调用，返回值会被丢弃。\n\t\t当初是为了制作伪 SETTER 而做的，现在正在反省。\n\n\t当然，除非在被调用的表达式中函数内部进行了操作，否则 RESULT 或 RESULTS 不会发生变化。\n\t同系列的指令中，EM+EE 版本新增了 `TRYCALLF`、`TRYCALLFORMF`。\n\n!!! hint \"提示\"\n\n    仅指令支持此功能。\n\n    **为什么需要 CALLF？** ERABASIC 中 `FUNC(args)` 括号语法不能作为独立命令（函数名后必须跟空格/制表符）。\n    而空格语法 `FUNC args` 调用表达式函数会污染 RESULT。CALLF 同时解决了这两个问题。\n    详见教程 [命令 vs 表达式](../tutorial/command-vs-expression.zh.md)。\n\n### 相关项目\n* TRYCALLF\n* TRYCALLFORMF\n* EXISTFUNCTION\n* [表达式中可用的函数](../Emuera/in_expression_function.zh.md)\n* [命令 vs 表达式（教程）](../tutorial/command-vs-expression.zh.md)"
  },
  {
    "id": "CALLSHARP",
    "title": "CALLSHARP",
    "names": [
      "CALLSHARP"
    ],
    "signatures": [
      {
        "name": "CALLSHARP",
        "params": "`functionName`",
        "returns": "`void`¹",
        "engines": [
          "etc"
        ],
        "overloads": []
      }
    ],
    "summary": "制作者：Neo_Kesha",
    "body": "制作者：Neo_Kesha\n\n!!! info \"API\"\n\n\t```erb\n\tCALLSHARP funcName\n\t```\n\n    当仅使用EraBasic感到不足时，可以创建用于Emuera的C#插件。\n    要添加插件，请在Emuera的安装文件夹中创建Plugins/文件夹，并将插件的DLL文件放置其中。\n\n    请务必注意，还需在Emuera.exe所在的文件夹中添加一个`pluginsAware.txt`文件。否则，启动时会发生崩溃。\n\n    插件创建方法（简单示例 [https://gitlab.com/EvilMask/emuera.em/-/tree/master/EmueraPluginExample](https://gitlab.com/EvilMask/emuera.em/-/tree/master/EmueraPluginExample)）\n    1. 克隆 Emuera 仓库 https://gitlab.com/EvilMask/emuera.em\n    2. 在 Visual Studio 中打开项目\n    3. 向解决方案添加新项目。选择类库类型。\n    4. 将 Emuera 添加为依赖项目。\n    5. 创建 `.cs` 文件（例如：\"`Manifest.cs`\"）。\n    6. 创建一个名为 `PluginManifest` 的类，继承自 `PluginManifestAbstract`。\n    7. `PluginName`、`PluginDescription`、`PluginAuthor`、`PluginVersion` 字段是可选的，目前尚未使用。\n    8. 创建 `.cs` 文件（例如：\"`MyCoolCode.cs`\"）。\n    9. 每个方法都是一个继承自 `IPluginMethod` 的类。\n    10. 创建类（例如：`MyCoolNativeMethod : IPluginMethod`）\n    11. 重写 \"`Name`\" 字段。这将是 ERB 端调用时使用的方法名。例如：\"`MyCoolMethod1`\"\n    12. 用任意代码重写 `Execute` 方法。\n    13. 在 `PluginManifest` 的构造函数中，将类添加到方法列表，如下所示：\n    `methods.Add(new MyCoolNativeMethod ())`\n    14. 使用 `CALLSHARP MyCoolMethod1()` 从 ERB 调用 C# 代码。\n\n    ## 关于参数\n\n    可以在 ERB 与 Plugin 之间传递参数。将变量作为参数传递时，可以从 Plugin 中修改该变量的值。\n    `Execute` 方法以 `PluginMethodParameter` 数组的形式接收参数。参数可以指定为字符串类型或数值类型。\n    扩展示例（基于 [https://gitlab.com/EvilMask/emuera.em/-/tree/master/EmueraPluginExample](https://gitlab.com/EvilMask/emuera.em/-/tree/master/EmueraPluginExample) 的示例）：\n\n    ```c#\n            public void Execute(PluginMethodParameter[] args)\n                {\n                    // 展开变量\n                    var characterId = args[0].intValue；\n                    var characterName = args[1].strValue；\n                    // 调用代码\n                    var result = SET_CHAR_NAME(characterId, characterName)；\n                    // 更新返回值\n                    if (args.Length > 2) {\n                    args[2].intValue = result；\n                    }\n                }\n\n            internal static int SET_CHAR_NAME(int charId, string charName) { // 执行代码。\n                // 执行代码\n            }\n    ```\n\n    ## 插件API\n    插件系统中存在`PluginManager`调用，它作为代理Emuera便捷功能给插件的API运行。\n\n    ```c#\n    var api = PluginManager.GetInstance()；\n    ```\n\n    可以执行如下基本处理：\n\n    ```c#\n    api.Print(\"Hiiiii\")；\n    ```\n\n    也可以处理变量：\n\n    ```c#\n    api.FLAG[intKey] = 11；\n    api.FLAG[strKey] = 15; // 通过字符串访问比通过intKey访问要慢。\n    api.FLAG[FlagsEnum.CoolFlagIUseALot] = 17; // 使用枚举类型代替字符串。\n    ```\n\n    可以使用PluginAPICharContext来处理字符串变量。\n\n    ```c#\n    PluginAPICharContext ctx = api.CreateCharContext(charId);\n    for (int i = 1; i <= 24; ++i)\n    {\n        ctx.CFLAG[200 + i] = ctx.EQUIP[i];\n    }\n    ctx.UserDefined[\"UDArray\", 0] = 13;\n    ```"
  },
  {
    "id": "CALLSTR",
    "title": "CALLSTR系",
    "names": [
      "CALLSTR",
      "JUMPSTR",
      "TRYCALLSTR",
      "TRYJUMPSTR",
      "TRYCCALLSTR",
      "TRYCJUMPSTR"
    ],
    "signatures": [
      {
        "name": "CALLSTR",
        "params": "`stringVariable`",
        "returns": "`void`¹",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "JUMPSTR",
        "params": "`stringVariable`",
        "returns": "`void`¹",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "TRYCALLSTR",
        "params": "`stringVariable`",
        "returns": "`void`¹",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "TRYJUMPSTR",
        "params": "`stringVariable`",
        "returns": "`void`¹",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "TRYCCALLSTR",
        "params": "`stringVariable`",
        "returns": "`void`¹",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "TRYCJUMPSTR",
        "params": "`stringVariable`",
        "returns": "`void`¹",
        "engines": [
          "skia"
        ],
        "overloads": []
      }
    ],
    "summary": "与 CALL、JUMP 及其 TRY 系统类似，但允许通过一个字符串表达式来指定完整的函数调用行（包括函数名和参数）。",
    "body": "!!! info \"API\"\n\n    ```erb\n    CALLSTR stringVariable\n    JUMPSTR stringVariable\n    TRYCALLSTR stringVariable\n    TRYJUMPSTR stringVariable\n    TRYCCALLSTR stringVariable\n    TRYCJUMPSTR stringVariable\n    ```\n\n    与 `CALL`、`JUMP` 及其 `TRY` 系统类似，但允许通过一个**字符串表达式**来指定**完整的函数调用行**（包括函数名和参数）。\n\n    被调用函数中执行了 `RETURN` 时，`RESULT` 会被设为其参数值；函数到达末尾时，`RESULT` 会被设为 `0`。此行为与 `CALL` 完全一致。\n\n    与 `CALLFORM` 的区别在于：`CALLFORM` 的参数结构在编译时必须固定，而 `CALLSTR` 系列是在运行时解析整个字符串。这意味着可以动态地改变传递给函数的参数数量或类型。\n\n    - **CALLSTR / JUMPSTR**：将指定字符串作为函数调用执行。\n    - **TRYCALLSTR / TRYJUMPSTR**：如果字符串中指定的函数名不存在，程序不会报错，而是直接跳过执行。\n    - **TRYCCALLSTR / TRYCJUMPSTR**：属于 `TRYC` 系统，如果指定的函数存在则执行；如果不存在，则执行随后的 `CATCH` 分句。\n\n    !!! warning \"注意\"\n        - 仅支持命令语法，不支持表达式调用。\n        - 字符串支持以下两种解析格式：\n          1. **函数式写法**：`\"FUNC_NAME(ARG1, ARG2)\"`\n          2. **逗号分隔写法**：`\"FUNC_NAME, ARG1, ARG2\"`\n        - 字符串内的参数会根据当前的执行上下文进行解析。例如，`\"MY_FUNC(LOCAL)\"` 在执行时会读取当前函数内 `LOCAL` 变量的值。\n        - 由于该命令涉及运行时的词法分析与语法解析，其执行效率略低于静态的 `CALL` 或 `CALLFORM`。在对性能要求极高的超大型循环中应谨慎使用。\n        - 字符串内的语法错误（如括号不匹配）将在运行时触发 `CodeEE` 报错。\n        - 接受 INPUTS 系指令的 RESULTS 作为参数时需要注意，由控制台输入的部分字符需要 `\\\\` 转义，包括小括号。\n\n!!! hint \"提示\"\n\n    仅命令语法可用。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n        #DIMS DYNAMIC COMMAND\n        ; 动态构造调用字符串\n        COMMAND '= \"TEST_FUNC\" + \"(100, 200)\"\n        CALLSTR COMMAND\n\n        ; 直接传递包含参数的字符串\n        LOCALS = SHOW_STATUS, 1, \"READY\"\n        TRYCALLSTR LOCALS\n\n    @TEST_FUNC(ARG:0, ARG:1)\n        PRINTFORML 接收到的参数为: {ARG:0} 和 {ARG:1}\n\n    @SHOW_STATUS(ARG, ARGS)\n        PRINTFORML ID:{ARG} 模式:%ARGS%\n    ```\n    ```text\n    接收到的参数为: 100 和 200\n    ID:1 模式:READY\n    ```\n\n### 相关项\n- CALL\n- CALLFORM\n- TRYCALL\n- TRYC系\n- [动态解析与反射](../tutorial/dynamic-reflection.zh.md) — CALLSTR 属于第四代\"函数名+参数全动态反射\"\n\n### [Skia]与 CALLFORM 的设计比较\n\n!!! info \"运行时参数反射的意义\"\n\n    `CALLFORM` 只能在运行时构造函数名，参数在编译时固定。这是一种\"函数名动态但参数静态\"的非对称设计，并非真正意义上的动态调用。\n\n    `CALLSTR` 系列可以在运行时字符串中同时指定函数名和参数，实现完整的运行时函数反射。为配合此设计，Skia 版还新增了 `ConvertArg` 多余参数静默丢弃和 TRY 系安全网。"
  },
  {
    "id": "CALLTRAIN",
    "title": "CALLTRAIN",
    "names": [
      "CALLTRAIN"
    ],
    "signatures": [
      {
        "name": "CALLTRAIN",
        "params": "`int`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "连续命令执行指令。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tCALLTRAIN comCount\n    ```\n\t连续命令执行指令。\n\t需要预先将命令编号赋值给`SELECTCOM:(1～)`，并以要执行的命令数量作为参数来执行。\n\n    ```erb\n\tSELECTCOM:1 = XXX\n\tSELECTCOM:2 = YYY\n\t　　　・\n\t　　　・\n\t　　　・\n\tSELECTCOM:N = ZZZ\n\n\tCALLTRAIN (設定したコマンドの数)\n\t```\n\t与通常的命令执行一样，也会调用`SHOW_STATUS`和`SHOW_USERCOM`，但不会显示`TRAIN`命令和`USERCOM`。\n\t如果无论如何都想显示`USERCOM`，使用`NOSKIP～ENDNOSKIP`会是一个好办法。\n\t`CALLTRAIN`自动执行结束后，系统函数`@CALLTRAINEND`会被调用。\n\t请注意，`@CALLTRAINEND`不是事件函数，因此不能多重定义。\n\t另外，用于指定命令的命令编号，不是游戏中的值，而是`TRAIN.CSV`中指定的值。\n\n!!! hint \"提示\"\n\n    仅支持命令。\n\n### 相关项目\n* DOTRAIN\n* STOPCALLTRAIN"
  },
  {
    "id": "CARRAY",
    "title": "SUMCARRAY, CMATCH, MAXCARRAY, MINCARRAY",
    "names": [
      "SUMCARRAY",
      "CMATCH",
      "MAXCARRAY",
      "MINCARRAY",
      "CARRAY"
    ],
    "signatures": [
      {
        "name": "SUMCARRAY",
        "params": "`charaArray`(, `int`, `int`)",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "CMATCH",
        "params": "`charaArray`, `any`(, `int`, `int`)",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "MAXCARRAY",
        "params": "`charaArray`(, `int`, `int`)",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "MINCARRAY",
        "params": "`charaArray`(, `int`, `int`)",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "这是遍历角色间的 SUMARRAY、MATCH、MAXARRAY、MINARRAY 的变体。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint SUMCARRAY charaArray(, start, end)\n\tint CMATCH charaArray, value(, start, end)\n\tint MAXCARRAY charaArray(, start, end)\n\tint MINCARRAY charaArray(, start, end)\n    ```\n    这是遍历角色间的 `SUMARRAY`、`MATCH`、`MAXARRAY`、`MINARRAY` 的变体。\n    `charaArray` 必须是角色数组变量。\n    `start, end` 需通过角色登记编号 (CharaID) 指定。\n    例如，`RESULT = SUMCARRAY(CFLAG:2, A, B)` 也可以写成如下形式。\n    （`B` 必须小于 `CHARANUM`）\n\n        RESULT = 0\n        FOR COUNT, A, B\n            RESULT += CFLAG:COUNT:2\n        REND\n\n!!! hint \"提示\"\n\n    同时支持指令和表达式内函数两种形式。"
  },
  {
    "id": "CBGCLEAR",
    "title": "CBGCLEAR",
    "names": [
      "CBGCLEAR"
    ],
    "signatures": [
      {
        "name": "CBGCLEAR",
        "params": "无",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "解除所有通过以CBG开头的各种CBG系命令设置的背景图片设定。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint CBGCLEAR\n    ```\n    解除所有通过以`CBG`开头的各种`CBG`系命令设置的背景图片设定。\n\n!!! hint \"提示\"\n\n    同时支持命令形式和表达式函数形式。\n\n### 相关项目\n- CBGSETG\n- CGBSETSPRITE"
  },
  {
    "id": "CBGCLEARBUTTON",
    "title": "CBGCLEARBUTTON",
    "names": [
      "CBGCLEARBUTTON"
    ],
    "signatures": [
      {
        "name": "CBGCLEARBUTTON",
        "params": "无",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "解除由 CBGSETBUTTONSPRITE 命令设置的按钮配置。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint CBGCLEARBUTTON\n    ```\n\t解除由 `CBGSETBUTTONSPRITE` 命令设置的按钮配置。\n\n!!! hint \"提示\"\n\n    该功能同时支持在命令和表达式函数中使用。"
  },
  {
    "id": "CBGREMOVEMAPB",
    "title": "CBGREMOVEMAPB",
    "names": [
      "CBGREMOVEMAPB"
    ],
    "signatures": [
      {
        "name": "CBGREMOVEMAPB",
        "params": "无",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "解除由 CBGSETBMAPG 命令设置的按钮映射配置。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint CBGREMOVEMAPB\n    ```\n\t解除由 `CBGSETBMAPG` 命令设置的按钮映射配置。\n\n!!! hint \"提示\"\n\n    同时支持作为命令和表达式函数使用。"
  },
  {
    "id": "CBGREMOVERANGE",
    "title": "CBGREMOVERANGE",
    "names": [
      "CBGREMOVERANGE"
    ],
    "signatures": [
      {
        "name": "CBGREMOVERANGE",
        "params": "`int`, `int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "解除由 CBGSETG、CBGSETSPRITE、CBGSETBUTTONSPRITE 命令设置的图像中，Z深度在 zMin 以上 zMax 以下（含）的图像。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint CBGREMOVERANGE zMin, zMax\n    ```\n\t解除由 `CBGSETG`、`CBGSETSPRITE`、`CBGSETBUTTONSPRITE` 命令设置的图像中，Z深度在 `zMin` 以上 `zMax` 以下（含）的图像。\n\n!!! hint \"提示\"\n\n    该函数同时支持在命令和表达式中使用。"
  },
  {
    "id": "CBGSETBMAPG",
    "title": "CBGSETBMAPG",
    "names": [
      "CBGSETBMAPG"
    ],
    "signatures": [
      {
        "name": "CBGSETBMAPG",
        "params": "`int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "将gID指定的Graphics设置为客户端区域的按钮映射。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int CBGSETBMAPG gID\n    ```\n    将`gID`指定的`Graphics`设置为客户端区域的按钮映射。\n    此处设置的按钮映射会影响`CBGSETBUTTONSPRITE`命令及`INPUTMOUSEKEY`命令。\n    按钮映射图像不会显示，但会像`CBGSETG`命令设置的图像一样，使画面左下角与图像左下角对齐进行放置。\n    鼠标光标正下方的按钮映射图像的颜色，将被识别为按钮的值。\n    但是，当颜色的Alpha值不为255（透明或半透明）时，将不会被识别为按钮的值。\n\n!!! hint \"提示\"\n\n    该函数同时支持命令和表达式函数两种形式。"
  },
  {
    "id": "CBGSETBUTTONSPRITE",
    "title": "CBGSETBUTTONSPRITE",
    "names": [
      "CBGSETBUTTONSPRITE"
    ],
    "signatures": [
      {
        "name": "CBGSETBUTTONSPRITE",
        "params": "`int`, `string`, `string`, `int`, `int`, `zDepth`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": [
          "`int`, `string`, `string`, `int`, `int`, `zDepth`, `string`"
        ]
      }
    ],
    "summary": "此命令与CBGSETBMAPG命令设置的按钮映射联动，用于设置可选择的按钮。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint CBGSETBUTTONSPRITE button, spriteName, spriteNameB, x, y, zDepth\n\tint CBGSETBUTTONSPRITE button, spriteName, spriteNameB, x, y, zDepth, tooltip\n    ```\n\t此命令与`CBGSETBMAPG`命令设置的按钮映射联动，用于设置可选择的按钮。\n\t当鼠标正下方的按钮映射图像颜色的`0xRRGGBB`值与参数`button`相等时，将显示`spriteNameB`指定的精灵；其他情况下，则显示`spriteName`指定的精灵。\n\t`spriteName`或`spriteNameB`可以指定为空字符串，这种情况下，在非选中或选中状态将不显示任何内容。\n\t`x, y, zdepth`参数与`CBGSETSPRITE`命令相同。请注意，基准位置`(x,y) = (0,0)`是屏幕左下角与图像左下角重合的位置。\n\t可选地，可以通过`tooltip`参数指定选中该按钮时显示的工具提示字符串。\n\t可以为同一个`button`值分配多个`CBGSETBUTTONSPRITE`命令，并且按钮的位置无需与图像位置一致。\n\t在这种情况下，工具提示的显示与图像的`x, y`位置无关，将优先显示在设置了工具提示字符串的精灵中`zDepth`值最大的那个（最先被绘制、看起来在最底层的精灵）。\n\n!!! hint \"提示\"\n\n    命令和表达式函数均支持。"
  },
  {
    "id": "CBGSETG",
    "title": "CBGSETG",
    "names": [
      "CBGSETG"
    ],
    "signatures": [
      {
        "name": "CBGSETG",
        "params": "`int`, `int`, `int`, `int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "将指定gID的Graphics设置为在客户端区域内显示。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint CBGSETG gID, x, y, zDepth\n    ```\n    将指定`gID`的`Graphics`设置为在客户端区域内显示。\n    当`x`和`y`指定为0时，图像左下角将与客户端区域的左下角对齐显示。\n    `x`的正方向为右，`y`的正方向为下，`zDepth`的正方向为屏幕纵深方向（向里）。\n    `zDepth`必须指定非零值。通常的文字绘制相当于`zDepth==0`，如果`zDepth`为负值，则会在文字的前方绘制。\n\n!!! hint \"提示\"\n\n    此函数同时支持作为命令和表达式内函数使用。\n\n### 相关项目\n- CBGSETSPRITE\n- CBGCLEAR"
  },
  {
    "id": "CBGSETSPRITE",
    "title": "CBGSETSPRITE",
    "names": [
      "CBGSETSPRITE"
    ],
    "signatures": [
      {
        "name": "CBGSETSPRITE",
        "params": "`string`, `int`, `int`, `int`(, `int`, `int`, `int`, `var`)",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "将指定资源名 spriteName 对应的精灵（sprite）设置为在客户端区域显示。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int CBGSETSPRITE, spriteName, x, y, zDepth{, width, height, opacity, colorMatrix}\n    ```\n\n    将指定资源名 `spriteName` 对应的精灵（sprite）设置为在客户端区域显示。\n    当 `x` 和 `y` 指定为 0 时，精灵将显示在客户端区域的左下角，且其左下角与区域左下角对齐。\n    `x` 轴正方向为右，`y` 轴正方向为下，`zDepth` 轴正方向为屏幕向里（远离观察者）。\n    `zDepth` 必须指定非零值。通常的文字绘制相当于 `zDepth==0`，若 `zDepth` 为负值，则精灵将绘制在文字的前方。\n\n    **Skia（SkiaSharp版）扩展参数**（第5个参数起，均可省略）：\n\n    | 参数 | 类型 | 默认值 | 说明 |\n    | :--- | :--- | :----- | :--- |\n    | `width` | `int` | `0` | 目标宽度。0 表示使用 Sprite 原始宽度 |\n    | `height` | `int` | `0` | 目标高度。0 表示使用 Sprite 原始高度 |\n    | `opacity` | `int` | `255` | 不透明度（0～255）。255 为完全不透明 |\n    | `colorMatrix` | `var` | `null` | 5×5 颜色矩阵数组引用（如 `CM_GRAY:0:0`）。省略则不应用颜色变换 |\n\n    - `opacity` 为整数 0～255，引擎内部会除以 255 转为浮点数。\n    - `colorMatrix` 传递二维/三维整数数组的起始地址（如 `CM:0:0` 或 `CM_PRESET:0:0:0`），引擎读取 5×5 子矩阵并除以 256 转为浮点数。\n\n    !!! warning \"注意\"\n        - `zDepth` 不可为 0。\n        - `colorMatrix` 参数在 WINAPI 模式下不支持。\n\n!!! hint \"提示\"\n\n    此函数同时支持作为命令和表达式函数使用。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n        ; 基本渲染：在 (0,0) 位置以 depth=1 显示 Sprite\n        CBGSETSPRITE \"pet_1\", 0, 0, 1\n\n        ; 缩放 + 透明度：缩放到 200x200，约 78% 不透明\n        CBGSETSPRITE \"pet_2\", 100, 50, 2, 200, 200, 200\n\n        ; 颜色矩阵：灰度效果\n        #DIM CM_GRAY, 5, 5\n        CM_GRAY:0:0 =  77, 150,  29,   0,   0\n        CM_GRAY:1:0 =  77, 150,  29,   0,   0\n        CM_GRAY:2:0 =  77, 150,  29,   0,   0\n        CM_GRAY:3:0 =   0,   0,   0, 256,   0\n        CM_GRAY:4:0 =   0,   0,   0,   0, 256\n        CBGSETSPRITE \"pet_3\", 300, 50, 3, 150, 150, 255, CM_GRAY:0:0\n\n        ; 作为表达式调用\n        RESULT = CBGSETSPRITE(\"pet_1\", 0, 0, 1)\n        PRINTVL RESULT\n    ```\n\n### 相关项目\n- CBGSETG\n- CBGCLEAR"
  },
  {
    "id": "CHARATU",
    "title": "CHARATU",
    "names": [
      "CHARATU"
    ],
    "signatures": [
      {
        "name": "CHARATU",
        "params": "`string`, `int`",
        "returns": "`string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "获取字符串中指定位置字符的式中函数CHARATU",
    "body": "!!! info \"API\"\n\n    ```erb\n\tstring CHARATU string, position\n    ```\n\t获取字符串中指定位置字符的式中函数`CHARATU`\n\n\t\tCHARATU(<参照字符串>, [获取字符位置])\n\n    获取字符串中指定位置的字符\n　　处理系统采用Unicode编码\n\n!!! hint \"提示\"\n\n    该功能同时支持指令和表达式函数两种形式。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\t#DIMS HOGES = \"いろはにほ\"\n\n\t\tREPEAT 5\n\t\t\tPRINTFORML %CHARATU(HOGES, COUNT)%\n\t\tREND\n\t\tWAIT\n    ```\n    ```text\n\tい\n\tろ\n\tは\n\tに\n\tほ\n    ```\n\n### 相关项目\n- SUBSTRING"
  }
];
