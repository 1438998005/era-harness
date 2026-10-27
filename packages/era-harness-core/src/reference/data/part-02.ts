// 本文件由 scripts/build-reference.ts 生成，请勿手工修改。
//
// 数据来源：https://github.com/qirchen421/emuera.sk.doc  docs/Reference、docs/Emuera、docs/tutorial/*.zh.md
// 上游版本：41451be6091363e37ed066aaf04416decbf0127f
// 许可：CC BY-NC 4.0（http://creativecommons.org/licenses/by-nc/4.0/）
//       与本仓库代码的 Apache-2.0 分开管理，见 NOTICE-emuera-sk-doc.md
import type { ReferenceEntry } from '../types.js';

export const ENTRIES_PART_02: readonly ReferenceEntry[] = [
  {
    "id": "CHKCHARADATA",
    "title": "CHKCHARADATA",
    "names": [
      "CHKCHARADATA"
    ],
    "signatures": [
      {
        "name": "CHKCHARADATA",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "返回 dat 文件夹内由 chara_*.dat 表示的文件名所对应的数据信息。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int CHKCHARADATA filename\n    ```\n    返回 dat 文件夹内由 `chara_*.dat` 表示的文件名所对应的数据信息。\n    如果可以加载则返回 0，如果因某些原因无法加载则返回非 0 值。\n    此外，如果可以加载，则将存档数据的备注赋值给 `RESULTS:0`；如果无法加载，则将原因赋值给 `RESULTS:0`。\n\n!!! hint \"提示\"\n\n    同时支持指令和表达式函数两种形式。\n\n### 相关项目\n- SAVECHARA\n- LOADCHARA",
    "sourcePath": "docs/Reference/CHKCHARADATA.zh.md"
  },
  {
    "id": "CHKDATA",
    "title": "CHKDATA",
    "names": [
      "CHKDATA"
    ],
    "signatures": [
      {
        "name": "CHKDATA",
        "params": "`int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "将saveID所指定编号的文件数据信息赋值给RESULT:0和RESULTS:0。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint CHKDATA saveID\n    ```\n\t将`saveID`所指定编号的文件数据信息赋值给`RESULT:0`和`RESULTS:0`。\n\t`RESULT:0`可取得以下值。仅在值为`0`时，可以加载该文件。\n\n    - 0 - 该文件可加载。\n    - 1 - 指定文件不存在。\n    - 2 - 游戏代码不匹配。（数据中[gamebase.csv的`代码`](../Emuera/variables.md#gamebasecsv)值不同）\n    - 3 - 版本不匹配。（数据中[gamebase.csv的`版本`](../Emuera/variables.md#gamebasecsv)值不同，且不属于可兼容的版本）\n    - 4 - 文件存在上述之外的其他问题。\n\n    当 `RESULT:0` 为 `0` 时，`RESULTS:0` 会被代入存档数据的注释（在 `@SAVEINFO` 中使用 `PUTFORM` 输入的字符串，或 `SAVEDATA` 的第二个参数）。\n        当 `RESULT:0` 不为 `0` 时，`RESULTS:0` 会被代入诸如 `存档数据的版本不同` 之类的错误信息。\n        另外，`RESULT:1` 会被代入存档数据的版本号。\n        当文件不存在或发生游戏代码不匹配等错误时，其值为 `0`；当版本不匹配或数据正常时，则代入数据内的版本值。\n        另外，如果在调用 `CHKDATA` 时并非处于向 `RESULT:0` 赋值的过程中（例如 `RESULT:0 = CHKDATA(LOCAL)`），\n        则 `RESULT:0` 会被代入存档数据的时间戳（例如，2009年3月28日13时5分23秒678毫秒会表示为 `RESULT = 20090328130523678`）。\n\n!!! hint \"提示\"\n\n    该函数同时支持作为命令和表达式函数使用。\n\n### 相关项目\n- SAVEDATA\n- LOADDATA\n- FIND_CHARADATA",
    "sourcePath": "docs/Reference/CHKDATA.zh.md"
  },
  {
    "id": "CLEARIMAGELAYER",
    "title": "CLEARIMAGELAYER / CLEARIMAGELAYER_ALL",
    "names": [
      "CLEARIMAGELAYER",
      "CLEARIMAGELAYER_ALL"
    ],
    "signatures": [
      {
        "name": "CLEARIMAGELAYER",
        "params": "`int`",
        "returns": "无",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "CLEARIMAGELAYER_ALL",
        "params": "无",
        "returns": "无",
        "engines": [
          "skia"
        ],
        "overloads": []
      }
    ],
    "summary": "仅命令语法可用。",
    "body": "!!! info \"API\"\n\n    ```erb\n    CLEARIMAGELAYER depth\n    CLEARIMAGELAYER_ALL\n    ```\n\n    - **CLEARIMAGELAYER**：清除指定 `depth` 的 `SETIMAGELAYER` 图层。\n    - **CLEARIMAGELAYER_ALL**：清除所有 `SETIMAGELAYER` 图层。\n\n    | 参数 | 类型 | 说明 |\n    | :--- | :--- | :--- |\n    | `depth` | int | 要清除的图层深度值 |\n\n    !!! warning \"注意\"\n        - 仅支持命令语法，不支持表达式调用。\n        - `CLEARIMAGELAYER` 清除的图层可通过再次调用 `SETIMAGELAYER` 重新创建。\n        - 这两个命令仅影响 `SETIMAGELAYER` 创建的图层，不影响 `CBGSETSPRITE` 或 `SETBGIMAGE` 创建的背景图。\n\n!!! hint \"提示\"\n\n    仅命令语法可用。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n        SETIMAGELAYER \"pet_1\", 1\n        SETIMAGELAYER \"pet_2\", 2\n\n        ; 清除指定图层\n        CLEARIMAGELAYER 1\n\n        ; 检测是否已清除\n        PRINTVL EXISTSIMAGELAYER(1)\n        PRINTVL EXISTSIMAGELAYER(2)\n\n        ; 清除所有图层\n        CLEARIMAGELAYER_ALL\n    ```\n    ```text\n    0\n    1\n    ```\n\n### 相关项\n- SETIMAGELAYER\n- EXISTSIMAGELAYER",
    "sourcePath": "docs/Reference/CLEARIMAGELAYER.zh.md"
  },
  {
    "id": "CLEARLINE",
    "title": "CLEARLINE",
    "names": [
      "CLEARLINE"
    ],
    "signatures": [
      {
        "name": "CLEARLINE",
        "params": "`int`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "删除指定行数的字符串（行数的计数方式与LINECOUNT相同）。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tCLEARLINE line\n    ```\n\t删除指定行数的字符串（行数的计数方式与`LINECOUNT`相同）。\n\t行数是指从`PRINTL`等命令开始到发生换行为止的内容算作一行。\n\t请注意，即使一个长字符串被分割成多行显示，也会被整体视为一行。\n\n!!! hint \"提示\"\n\n    仅命令支持两种方式。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tPRINTL SSS\n\t\tPRINTL OOO\n\t\tPRINTL UUU\n\t\tPRINTL NNN\n\t\tPRINTL DDD\n\t\tPRINTL VVV\n\t\tPRINTL OOO\n\t\tPRINTL LLL\n\t\tPRINTL TTT\n\t\tCLEARLINE 8\n\t\tPRINTL EEE\n\t\tPRINTW XXX\n    ```\n    ```text\n\tSSS\n\tEEE\n\tXXX\n    ```\n\n### 相关项目\n- REUSELASTLINE",
    "sourcePath": "docs/Reference/CLEARLINE.zh.md"
  },
  {
    "id": "CLEARMEMORY",
    "title": "CLEARMEMORY",
    "names": [
      "CLEARMEMORY"
    ],
    "signatures": [
      {
        "name": "CLEARMEMORY",
        "params": "`void`",
        "returns": "`int`",
        "engines": [
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "释放内存，并返回释放的内存量（单位为 byte）。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int CLEARMEMORY\n    ```\n\n    释放内存，并返回释放的内存量（单位为 byte）。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n    在运行 `LOADDATA`、`DELCHARA`、重启 Emuera 这三种情况之后使用效果比较好，其他场景下就没什么效果了。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        REPEAT 10000\n            ADDVOIDCHARA\n        REND\n        DELALLCHARA\n        PRINTFORMW CLEARMEMORY 已执行完成，合计释放了 {CLEARMEMORY()/1024/1024} MB 的内存\n    ```\n\n    ```text\n    CLEARMEMORY 已执行完成，合计释放了 840 MB 的内存\n    ```\n\n### 相关项目\n- GETMEMORYUSAGE",
    "sourcePath": "docs/Reference/CLEARMEMORY.zh.md"
  },
  {
    "id": "CLEARTEXTBOX",
    "title": "CLEARTEXTBOX",
    "names": [
      "CLEARTEXTBOX"
    ],
    "signatures": [
      {
        "name": "CLEARTEXTBOX",
        "params": "无",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "清除最底部输入栏中的所有文本。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tCLEARTEXTBOX\n    ```\n\t清除最底部输入栏中的所有文本。\n\n!!! hint \"提示\"\n\n    仅支持指令形式。",
    "sourcePath": "docs/Reference/CLEARTEXTBOX.zh.md"
  },
  {
    "id": "CLIENTFIELD",
    "title": "CLIENTWIDTH, CLIENTHEIGHT",
    "names": [
      "CLIENTWIDTH",
      "CLIENTHEIGHT",
      "INT",
      "CLIENTFIELD"
    ],
    "signatures": [
      {
        "name": "CLIENTWIDTH",
        "params": "无",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "CLIENTHEIGHT",
        "params": "无",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "获取客户端区域（窗口绘图区域）的当前宽度或高度。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint CLIENTWIDTH\n\tINT CLIENTHEIGHT\n    ```\n    获取客户端区域（窗口绘图区域）的当前宽度或高度。\n    此数值不包含窗口边框、菜单栏、滚动条或文本输入区域的宽度或高度。\n    请注意，`CLIENTHEIGHT` 的值可能在游戏过程中被用户更改。\n\n!!! hint \"提示\"\n\n    该函数同时支持在指令和表达式中使用。",
    "sourcePath": "docs/Reference/CLIENTFIELD.zh.md"
  },
  {
    "id": "COLOR_FROM",
    "title": "COLOR_FROMNAME, COLOR_FROMRGB",
    "names": [
      "COLOR_FROMNAME",
      "COLOR_FROMRGB",
      "COLOR_ROMRGB",
      "COLOR_FROM"
    ],
    "signatures": [
      {
        "name": "COLOR_FROMNAME",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "COLOR_FROMRGB",
        "params": "`int`, `int`, `int`",
        "returns": "`string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "COLOR_FROMNAME 将给定的参数作为颜色名进行判断，并返回 0xRRGGBB 格式的数值。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint COLOR_FROMNAME colorName\n\tstring COLOR_ROMRGB R, G, B\n    ```\n\t`COLOR_FROMNAME` 将给定的参数作为颜色名进行判断，并返回 `0xRRGGBB` 格式的数值。\n\t如果不存在对应的颜色名，则返回 -1。\n\n\t`COLOR_FROMRGB` 将给定的 `R, G, B` 值作为 `0xRRGGBB` 格式的数值返回。\n\t如果参数超出 `0-255` 的范围，将发生错误。\n\n!!! hint \"提示\"\n\n    同时支持指令和表达式函数。\n\n### 相关项目\n- SETCOLOR",
    "sourcePath": "docs/Reference/COLOR_FROM.zh.md"
  },
  {
    "id": "CONTINUE",
    "title": "CONTINUE, BREAK",
    "names": [
      "CONTINUE",
      "BREAK",
      "LOOPINSTRUCTION",
      "LOOPENDINSTRUCTION"
    ],
    "signatures": [
      {
        "name": "CONTINUE",
        "params": "无",
        "returns": "无",
        "engines": [
          "eramaker"
        ],
        "overloads": []
      },
      {
        "name": "BREAK",
        "params": "无",
        "returns": "无",
        "engines": [
          "eramaker"
        ],
        "overloads": []
      }
    ],
    "summary": "可在 REPEAT、FOR、WHILE、DO 内部使用的循环控制指令。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tloopInstruction\n\t\tCONTINUE\n\t\tBREAK\n\tloopendInstruction\n    ```\n    可在 `REPEAT`、`FOR`、`WHILE`、`DO` 内部使用的循环控制指令。\n    `CONTINUE` 在执行时会返回到循环开始行，对于 `REPEAT` 和 `FOR` 循环，还会递增或递减对应的计数变量。\n    `BREAK` 在执行时会中断后续的循环处理，并跳转到循环结束行。\n\n!!! hint \"提示\"\n\n    仅支持指令形式。\n\n!!! example \"例\"\n\n    ```erb\n\t@SYSTEM_TITLE\n\t\tREPEAT 5\n\t\t\tSIF COUNT == 2\n\t\t\t\tCONTINUE\n\t\t\tSIF COUNT == 4\n\t\t\t\tBREAK\n\t\t\tPRINTFORML {COUNT}\n\t\tREND\n\t\tPRINTFORML {COUNT}\n\n\t\tDO\n\t\t\tCOUNT++\n\t\t\tIF UNICODE(COUNT) == \"A\"\n\t\t\t\tFOR COUNT, COUNT, COUNT+26\n\t\t\t\t\tPRINTFORM %UNICODE(COUNT)%\n\t\t\t\tNEXT\n\t\t\t\tBREAK\n\t\t\tENDIF\n\t\tLOOP 1\n\t\tWAIT\n    ```\n    ```text\n\t0\n\t1\n\t3\n\t5\n\tABCDEFGHIJKLMNOPQRSTUVWXYZ\n    ```",
    "sourcePath": "docs/Reference/CONTINUE.zh.md"
  },
  {
    "id": "CONVERT",
    "title": "CONVERT",
    "names": [
      "CONVERT"
    ],
    "signatures": [
      {
        "name": "CONVERT",
        "params": "`int`, `int`",
        "returns": "`string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "※处只能填入2、8、10、16。",
    "body": "!!! info \"API\"\n\n    ```erb\n\n\tstring CONVERT value, ※\n    ```\n\t※处只能填入2、8、10、16。\n\t返回将第一个参数表示为2、8、10或16进制数的字符串。\n\n!!! hint \"提示\"\n\n    同时支持指令和表达式函数两种形式。\n\n### 相关项目\n- [变量的规格与一览>常量的表示](../Emuera/variables.md#_3)",
    "sourcePath": "docs/Reference/CONVERT.zh.md"
  },
  {
    "id": "COPYCHARA",
    "title": "COPYCHARA",
    "names": [
      "COPYCHARA"
    ],
    "signatures": [
      {
        "name": "COPYCHARA",
        "params": "`int`, `int`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "将第一个参数指定的登记编号 (CharaID) 角色的所有数据复制到第二个参数指定的登记编号 (CharaID) 角色。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tCOPYCHARA charaID, charaID\n    ```\n\t将第一个参数指定的登记编号 (CharaID) 角色的所有数据复制到第二个参数指定的登记编号 (CharaID) 角色。\n\n!!! hint \"提示\"\n\n    仅支持指令形式。",
    "sourcePath": "docs/Reference/COPYCHARA.zh.md"
  },
  {
    "id": "CSV_STATUS",
    "title": "CSV状态获取函数",
    "names": [
      "CSVBASE",
      "CSVCSTR",
      "CSVABL",
      "CSVTALENT",
      "CSVMARK",
      "CSVEXP",
      "CSVRELATION",
      "CSVJUEL",
      "CSVEQUIP",
      "CSVCFLAG",
      "CSV_STATUS"
    ],
    "signatures": [
      {
        "name": "CSVBASE",
        "params": "`int`, `int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "CSVCSTR",
        "params": "`int`, `int`",
        "returns": "`string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "CSVABL",
        "params": "`int`, `int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "CSVTALENT",
        "params": "`int`, `int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "CSVMARK",
        "params": "`int`, `int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "CSVEXP",
        "params": "`int`, `int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "CSVRELATION",
        "params": "`int`, `int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "CSVJUEL",
        "params": "`int`, `int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "CSVEQUIP",
        "params": "`int`, `int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "CSVCFLAG",
        "params": "`int`, `int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "这是直接调用 CSV 中定义的值的函数。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tCSVBASE charaNo, index\n\tCSVCSTR charaNo, index\n\tCSVABL charaNo, index\n\tCSVTALENT charaNo, index\n\tCSVMARK charaNo, index\n\tCSVEXP charaNo, index\n\tCSVRELATION charaNo, index\n\tCSVJUEL charaNo, index\n\tCSVEQUIP charaNo, index\n\tCSVCFLAG charaNo, index\n    ```\n\t这是直接调用 CSV 中定义的值的函数。\n\t第一参数为角色注册编号 (NO)，第二参数为各变量的索引。\n\t`CSVCSTR` 会将字符串赋值给 `RESULTS`，其他函数则将数值赋值给 `RESULT`。\n\n!!! hint \"提示\"\n\n    同时支持指令和表达式函数两种形式。\n\n!!! example \"例\"\n\n\t``` { title Chara0.csv }\n\t番号,0\n\t名前,絵夢 江良\n\t呼び名,江良\n\n\t能力,0,3\n\t経験,1,200\n\tCSTR,2,このキャラはテスト用キャラです\n\t```\n    ```erb\n    @SYSTEM_TITLE\n\t\tPRINTFORMW %CSVNAME(0)%のABL:0={CSVABL(0, 0)} EXP:1={CSVEXP(0, 1)} %CSVCSTR(0, 2)%\n    ```\n    ```text\n\t絵夢 江良のABL:0=3 EXP:1=200 このキャラはテスト用キャラです\n    ```\n\n### 相关项目\n- CSVNAME系列",
    "sourcePath": "docs/Reference/CSV_STATUS.zh.md"
  },
  {
    "id": "CSVNAME",
    "title": "CSVNAME系",
    "names": [
      "CSVNAME",
      "CSVCALLNAME",
      "CSVNICKNAME",
      "CSVMASTERNAME"
    ],
    "signatures": [
      {
        "name": "CSVNAME",
        "params": "`int`",
        "returns": "`string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "CSVCALLNAME",
        "params": "`int`",
        "returns": "`string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "CSVNICKNAME",
        "params": "`int`",
        "returns": "`string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "CSVMASTERNAME",
        "params": "`int`",
        "returns": "`string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "这是直接调用 CSV 中定义的 NAME、CALLNAME、NICKNAME、MASTERNAME 的函数。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tCSVNAME charaNo\n\tCSVCALLNAME charaNo\n\tCSVNICKNAME charaNo\n\tCSVMASTERNAME charaNo\n    ```\n\t这是直接调用 CSV 中定义的 `NAME`、`CALLNAME`、`NICKNAME`、`MASTERNAME` 的函数。\n\t当你想要获取未拥有角色的名字等情况时可以使用。\n\t第一个参数是角色注册编号 (NO)（`NO` 对应的那个）。\n\n!!! hint \"提示\"\n\n    同时支持作为指令和表达式函数使用。\n\n!!! example \"示例\"\n    ``` { title Chara0.csv }\n    番号,0\n    名前,絵夢 江良\n    呼び名,江良\n    ```\n\n    ```erb\n    @SYSTEM_TITLE\n        PRINTFORMW 角色注册编号 (NO) 0的全名:%CSVNAME(0)% 称呼名:%CSVCALLNAME(0)%\n    ```\n    ```text\n    角色注册编号 (NO) 0的全名:絵夢 江良 称呼名:江良\n    ```\n\n### 相关项目\n- CSV状态获取类\n- GETCSVNOBY系 — 从名字查编号（逆操作）\n- [动态解析与反射](../tutorial/dynamic-reflection.zh.md) — CSVNAME 属于第一代\"固定映射\"",
    "sourcePath": "docs/Reference/CSVNAME.zh.md"
  },
  {
    "id": "CUPCHECK",
    "title": "CUPCHECK",
    "names": [
      "CUPCHECK"
    ],
    "signatures": [
      {
        "name": "CUPCHECK",
        "params": "`int`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "CUPCHECK 是 CUP、CDOWN 对应的 UPCHECK。",
    "body": "!!! info \"API\"\n\n    ```erb\n    CUPCHECK charaID\n    ```\n    CUPCHECK 是 CUP、CDOWN 对应的 UPCHECK。\n    　格式：CUPCHECK <角色>\n    　内容：对参数指定的角色执行 UPCHECK，仅此而已。\n    当然，不会受到 UP、DOWN 的影响。此外，UPCHECK 会显示结果，但 CUPCHECK 产生的结果不会显示。\n\n!!! hint \"提示\"\n\n    仅支持指令。\n\n### 相关项目\n- UPCHECK",
    "sourcePath": "docs/Reference/CUPCHECK.zh.md"
  },
  {
    "id": "CUSTOMDRAWLINE",
    "title": "CUSTOMDRAWLINE, DRAWLINEFORM",
    "names": [
      "CUSTOMDRAWLINE",
      "DRAWLINEFORM",
      "CUSTOMDRALINE"
    ],
    "signatures": [
      {
        "name": "CUSTOMDRAWLINE",
        "params": "`string`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "DRAWLINEFORM",
        "params": "`formedString`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "使用指定的字符串显示一行分隔符。DRAWLINEFORM 支持 FORM 语法。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tCUSTOMDRALINE string\n\tDRAWLINEFORM formedString\n    ```\n\t使用指定的字符串显示一行分隔符。DRAWLINEFORM 支持 FORM 语法。\n\n!!! hint \"提示\"\n\n    仅支持作为指令使用。\n\n!!! example \"例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tCUSTOMDRAWLINE *\n\t\tDRAWLINEFORM {123+211}\n\t\tWAIT\n    ```\n    ```text\n\t************************************************************************************************************************************************\n\t334334334334334334334334334334334334334334334334334334334334334334334334334334334334334334334334334334334334334334334334334334334334334334334334\n    ```\n\n### 相关项目\n- DRAWLINE",
    "sourcePath": "docs/Reference/CUSTOMDRAWLINE.zh.md"
  },
  {
    "id": "CVARSET",
    "title": "CVARSET",
    "names": [
      "CVARSET",
      "REPEAT",
      "REND"
    ],
    "signatures": [
      {
        "name": "CVARSET",
        "params": "`charaVariable`(, `int`, `int`, `int`, `int`)",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "此命令用于对指定已注册角色，向其角色变量的特定元素赋值。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tCVARSET characterVariable, index, value, startID, endID\n    ```\n\t此命令用于对指定已注册角色，向其角色变量的特定元素赋值。\n\t对于第一参数指定的变量，针对第四参数及之后参数指定的已注册角色，将第三参数指定的值赋给第二参数指定的元素。\n\t对于`NAME`、`ISASSI`等一维数组变量，第二参数不影响处理。因此，若不省略第三参数，请指定一个适当的值。\n\t若省略第三参数，则赋值`0`或空字符串。\n\t若也省略第二参数，则赋值给第`0`个元素。\n\t若省略第四参数及之后的参数，则对所有已注册角色赋值。\n\n    ```erb\n\tCVARSET CFLAG, 10, 123\n\t```\n\n\t此脚本与以下代码等效。\n\n    ```erb\n    REPEAT CHARANUM\n\t    CFLAG:COUNT:10 = 123\n    REND\n    ```\n\n!!! hint \"提示\"\n\n    仅支持命令形式。\n\n### 相关项目\n- VARSET",
    "sourcePath": "docs/Reference/CVARSET.zh.md"
  },
  {
    "id": "DEBUGPRINT",
    "title": "DEBUGPRINT 系列",
    "names": [
      "DEBUGPRINT",
      "DEBUGPRINTL",
      "DEBUGPRINTFORM",
      "DEBUGPRINTFORML",
      "DEBUGCLEAR"
    ],
    "signatures": [
      {
        "name": "DEBUGPRINT",
        "params": "`string`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "DEBUGPRINTL",
        "params": "`string`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "DEBUGPRINTFORM",
        "params": "`formedString`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "DEBUGPRINTFORML",
        "params": "`formedString`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "DEBUGCLEAR",
        "params": "无",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "DEBUG 系列命令仅在以调试模式启动时才会执行。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tDEBUGPRINT string\n\tDEBUGPRINTL string\n\tDEBUGPRINTFORM formedString\n\tDEBUGPRINTFORML formedString\n    ```\n\t`DEBUG` 系列命令仅在以[调试模式](../Emuera/debug.zh.md)启动时才会执行。\n\t在非调试模式下，这些命令不会执行任何操作。\n\t在非调试模式下，甚至不会对参数进行解析，因此即使<格式化字符串>中存在错误，也不会引发错误。\n\n\t`DEBUGPRINT` 系列命令分别与 `PRINT` 命令和 `PRINTL` 命令具有相同的功能。\n\t不同之处在于，它们的输出目标是调试控制台，而非主控制台。\n\t此外，它们不受 `SKIPDISP` 命令的影响，也无法使用 `n` 参数。\n\n    `DEBUGCLEAR` 会删除调试控制台中的所有 PRINT 内容。\n\n!!! hint \"提示\"\n\n    仅支持命令形式。",
    "sourcePath": "docs/Reference/DEBUGPRINT.zh.md"
  },
  {
    "id": "DELALLCHARA",
    "title": "DELALLCHARA",
    "names": [
      "DELALLCHARA",
      "REPEAT",
      "DELCHARA",
      "REND"
    ],
    "signatures": [
      {
        "name": "DELALLCHARA",
        "params": "无",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "删除所有已注册的角色。 效果等同于以下脚本：",
    "body": "!!! info \"API\"\n\n    ```erb\n\tDELALLCHARA\n    ```\n\t删除所有已注册的角色。 效果等同于以下脚本：\n\n    ```erb\n\tREPEAT CHARANUM\n\t\tDELCHARA 0\n\tREND\n\t```\n\n!!! hint \"提示\"\n\n    仅支持作为命令使用。\n\n### 相关项目\n- DELCHARA",
    "sourcePath": "docs/Reference/DELALLCHARA.zh.md"
  },
  {
    "id": "DELCHARA",
    "title": "DELCHARA",
    "names": [
      "DELCHARA"
    ],
    "signatures": [
      {
        "name": "DELCHARA",
        "params": "`int`(, `int`,...)",
        "returns": "无",
        "engines": [
          "eramaker",
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "删除指定ID的角色。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tDELCHARA charaID(, charaID,...)\n    ```\n    删除指定ID的角色。\n\t在`Emuera`中，可以一次性删除多个角色。\n\n!!! hint \"提示\"\n\n    仅支持指令形式。\n\n!!! example \"例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\t;假设登记编号 (CharaID) 0的角色名为浩之，是主人公。\n\t\t;假设角色注册编号 (NO) 3的角色名为智子，编号5的角色名为蕾米，编号6的角色名为琴音\n\t\tPRINTFORML 当前存在的角色有{CHARANUM}人。\n\t\tADDCHARA 3\n\t\tADDCHARA 5\n\t\tADDCHARA 6\n\t\tPRINTFORML 当前存在的角色有{CHARANUM}人。\n\t\tREPEAT CHARANUM\n\t\t\tPRINTFORML {COUNT}号是%NAME:COUNT%。\n\t\tREND\n\t\tDELCHARA 2\n\t\tPRINTFORML 当前存在的角色有{CHARANUM}人。\n\t\tREPEAT CHARANUM\n\t\tPRINTFORML {COUNT}号是%NAME:COUNT%。\n\t\t\tREND\n\t```\n    ```text\n\t当前存在的角色有1人。\n\t当前存在的角色有4人。\n\t0号是浩之。\n\t1号是智子。\n\t2号是蕾米。\n\t3号是琴音。\n\t当前存在的角色有3人。\n\t0号是浩之。\n\t1号是智子。\n\t2号是琴音。\n    ```\n\n### 相关项目\n- ADDCHARA\n- DELALLCHARA",
    "sourcePath": "docs/Reference/DELCHARA.zh.md"
  },
  {
    "id": "DELDATA",
    "title": "DELDATA",
    "names": [
      "DELDATA"
    ],
    "signatures": [
      {
        "name": "DELDATA",
        "params": "`int`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "删除由 saveID 指定编号的文件数据。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tDELDATA saveID\n    ```\n\t删除由 `saveID` 指定编号的文件数据。\n\t即使文件不存在也不会报错。\n\n!!! hint \"提示\"\n\n    仅支持指令形式。",
    "sourcePath": "docs/Reference/DELDATA.zh.md"
  },
  {
    "id": "DISABLE_INPUT_MACRO",
    "title": "DISABLE_INPUT_MACRO ![](../assets/images/IconSK.webp)",
    "names": [
      "DISABLE_INPUT_MACRO"
    ],
    "signatures": [
      {
        "name": "DISABLE_INPUT_MACRO",
        "params": "无",
        "returns": "`integer`",
        "engines": [
          "skia"
        ],
        "overloads": []
      }
    ],
    "summary": "关闭所有输入（textbox + SEQUENCEINPUT）的宏解析。调用后，输入按字面整段喂入，不再解析 (...) 重复宏，不再按 \\n 拆分，也不再处理 \\e MesSkip。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint DISABLE_INPUT_MACRO\n    ```\n    关闭所有输入（textbox + SEQUENCEINPUT）的宏解析。调用后，输入按字面整段喂入，不再解析 `(...)` 重复宏，不再按 `\\n` 拆分，也不再处理 `\\e` MesSkip。\n\n    - 默认状态为宏解析开启（与原版 PressEnterKey 一致）\n    - 可通过 `ENABLE_INPUT_MACRO` 恢复默认行为\n    - 返回值始终为 `0`\n\n!!! warning \"注意\"\n\n    由于 `CanRestructure = false`，不会成为常量折叠的对象。\n\n### 相关项目\n- ENABLE_INPUT_MACRO\n- SEQUENCEINPUT\n- INPUT",
    "sourcePath": "docs/Reference/DISABLE_INPUT_MACRO.zh.md"
  },
  {
    "id": "DO",
    "title": "DO-LOOP",
    "names": [
      "DO",
      "LOOP"
    ],
    "signatures": [
      {
        "name": "DO",
        "params": "无",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "LOOP",
        "params": "`int`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "REPEAT～REND 和 FOR～NEXT 一样，是一种循环结构。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tDO\n\tLOOP bool\n    ```\n\t`REPEAT～REND` 和 `FOR～NEXT` 一样，是一种循环结构。\n\t与 C 语言的 `do～while`、VB 的 `do～loop while` 结构类似，只要 `LOOP` 的 `bool` 不为 `0`，就会继续执行循环。\n\t其特点是，与 `WHILE～WEND` 不同，它至少会执行一次。\n\t另外，在 `DO～LOOP` 内执行 `CONTINUE` 时，如果 `LOOP` 的条件不满足，则会直接跳出 `LOOP`。请注意，执行 `CONTINUE` 后不一定会返回到 `DO` 语句。\n\t此外，如果通过 `GOTO` 等命令直接跳转到 `DO～LOOP` 内部，在正常到达 `LOOP` 时会进行条件判断，如果 `bool` 不为 `0`，则会循环回 `DO`。\n\n!!! hint \"提示\"\n\n    仅支持命令。",
    "sourcePath": "docs/Reference/DO.zh.md"
  },
  {
    "id": "DOTRAIN",
    "title": "DOTRAIN",
    "names": [
      "DOTRAIN",
      "SIF",
      "RETURN",
      "RESULT",
      "TRYCALLFORM"
    ],
    "signatures": [
      {
        "name": "DOTRAIN",
        "params": "`int`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "强制进行TRAIN的命令。",
    "body": "!!! info \"API\"\n\n    ```erb\n    DOTRAIN trainNo\n    ```\n    强制进行`TRAIN`的命令。\n    仅在`@EVENTTRAIN`、`@SHOW_STATUS`、`@SHOW_USERCOM`、`@USERCOM`、`@EVENTCOMEND`及从这些函数中调用的函数内可用。\n    参数指定的编号对应于`train.csv`中定义的编号。\n    其行为与选择命令时相同：初始化`UP`、`DOWN`等变量，将参数赋值给`SELECTCOM`，调用`@EVENTCOM`，调用`@COM{SELECTCOM}`……依此流程进行。\n\n    若参数小于`0`或大于等于`TRAINNAME`的元素数量，则会发生错误，但除此之外不会进行其他检查。\n    即使参数是`train.csv`中未定义的数字，也会强制尝试执行。\n    此外，不会调用`@COM_ABLE`，而是强制执行。\n    如有必要，请在`DOTRAIN`之前执行如下检查：\n\n    ```erb\n    SIF ( X < 0 || X >= VARSIZE(\"TRAINNAME\") || TRAINNAME:X == \"\" )\n        RETURN\n    RESULT = 1\n    TRYCALLFORM COM_ABLE{X}\n    SIF RESULT == 0\n        RETURN\n    DOTRAIN X\n    ```\n    相反地，也可以使用 `DOTRAIN` 来自行实现 `TRAIN` 命令。\n    例如，将 `train.csv` 留空，通过 `@SHOW_USERCOM` 自行显示，并在 `@USERCOM` 中执行 `DOTRAIN`。\n    或者，也可以不将 `train.csv` 留空，而是让所有的 `@COM_ABLE` 都返回 `0`。\n    除了修改 `@COM_ABLE`，还可以删除所有的 `@COM_ABLE`，并将 [`_replace.csv` 的 `COM_ABLE初始值`](../Emuera/replace.zh.md) 设置为 `0`。\n    另外，如果在 `CALLTRAIN` 的处理过程中执行了 `DOTRAIN`，则 `CALLTRAIN` 的剩余部分将无效。\n\n!!! hint \"提示\"\n\n    仅支持命令。\n\n### 相关项目\n- CALLTRAIN",
    "sourcePath": "docs/Reference/DOTRAIN.zh.md"
  },
  {
    "id": "DRAWLINE",
    "title": "DRAWLINE",
    "names": [
      "DRAWLINE"
    ],
    "signatures": [
      {
        "name": "DRAWLINE",
        "params": "无",
        "returns": "无",
        "engines": [
          "eramaker"
        ],
        "overloads": []
      }
    ],
    "summary": "从屏幕右端到左端用 - 画一条线",
    "body": "!!! info \"API\"\n\n    ```erb\n\tDRAWLINE\n    ```\n    从屏幕右端到左端用 `-` 画一条线\n\n!!! hint \"提示\"\n\n    仅支持指令形式。\n\n!!! example \"例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tDRAWLINE\n\t\tWAIT\n    ```\n    ```text\n\t------------------------------------------------------------------------------------------------------------------------------------------------\n    ```\n\n### 相关项目\n- CUSTOMDRAWLINE",
    "sourcePath": "docs/Reference/DRAWLINE.zh.md"
  },
  {
    "id": "DT_CELL",
    "title": "DataTable 单元格管理相关函数",
    "names": [
      "DT_CELL_GET",
      "DT_CELL_GETF",
      "DT_CELL_GETS",
      "DT_CELL_ISNULL",
      "DT_CELL_SET",
      "DT_CELL"
    ],
    "signatures": [
      {
        "name": "DT_CELL_GET",
        "params": "`string`, `int`, `string`(, `int`)",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      },
      {
        "name": "DT_CELL_GETF",
        "params": "`string`, `int`, `string`(, `int`)",
        "returns": "`float`",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "DT_CELL_GETS",
        "params": "`string`, `int`, `string`(, `int`)",
        "returns": "`string`",
        "engines": [
          "em"
        ],
        "overloads": []
      },
      {
        "name": "DT_CELL_ISNULL",
        "params": "`string`, `int`, `string`(, `int`)",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      },
      {
        "name": "DT_CELL_SET",
        "params": "`string`, `int`, `string`(, `any`, `int`)",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      }
    ],
    "summary": "操作 DataTable（数据库，基于 DataTable 类）单元格的函数。",
    "body": "!!! info \"API\"\n\n\t```erb\n\tint DT_CELL_GET dataTableName, row, columnName(, asId)\n\tfloat DT_CELL_GETF dataTableName, row, columnName(, asId)\n\tstring DT_CELL_GETS dataTableName, row, columnName(, asId)\n\tint DT_CELL_ISNULL dataTableName, row, columnName(, asId)\n\tint DT_CELL_SET dataTableName, row, columnName(, value, asId)\n\t```\n\n\t操作 `DataTable`（数据库，基于 [`DataTable`](https://learn.microsoft.com/zh-cn/dotnet/api/system.data.datatable?view=netframework-4.8) 类）单元格的函数。\n\n\t- `DT_CELL_GET`：返回 `dataTableName` 对应的 `DataTable` 中行 `row` 的列 `columnName` 的整数值。失败时返回 `0`。\n\t- `DT_CELL_GETF`：返回 `dataTableName` 对应的 `DataTable` 中行 `row` 的列 `columnName` 的浮点数值。失败时返回 `0.0`。\n\t- `DT_CELL_GETS`：返回 `dataTableName` 对应的 `DataTable` 中行 `row` 的列 `columnName` 的字符串值。失败时返回空字符串。\n\t\t- 若 `asId` 为 `1`，操作的行为 `id` 列的值等于 `row` 的行。\n\t\t- 若 `asId` 其它值或被省略，操作的行为第 `row` 行（起始行为第0行）。\n\t- `DT_CELL_ISNULL`：若名为 `dataTableName` 的 `DataTable` 的 `row` 行 `columnName` 列的值为空（不同于整数和字符串）时返回 `1`。\n\t\t- 返回值为 `0` 时，所查询的值不为空。\n\t\t- 返回值为 `-1` 时，指定的 `DataTable` 本身就不存在。\n\t\t- 返回值为 `-2` 时，指定的行或列不存在。\n\t- `DT_CELL_SET`：将名为 `dataTableName` 的 `DataTable` 的 `row` 行 `columnName` 列的单元格赋值为 `value`。若省略 `value`，赋值为空。根据列的类型自动判定 `value` 的类型（整数列接受整数、浮点数列接受浮点数、字符串列接受字符串）。\n\t\t- 返回值为 `1` 时，赋值成功。\n\t\t- 返回值为 `0` 时，尝试设置 `id` 列的值。\n\t\t- 返回值为 `-1` 时，指定的 `DataTable` 本身就不存在。\n\t\t- 返回值为 `-2` 时，`value` 的类型与该单元格的类型不符。\n\t\t- 返回值为 `-3` 时，指定的行或列不存在。\n\n\t!!! warning \"注意\"\n\n\t\t不能编辑 `id` 列的值。\n\n!!! hint \"提示\"\n\n\t命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n\t```erb\n\t@SYSTEM_TITLE\n\t\t#DIM id\n\n\t\tDT_CREATE \"db\"\n\t\tDT_COLUMN_ADD \"db\", \"name\"\n\t\tDT_COLUMN_ADD \"db\", \"height\", \"int16\"\n\t\tDT_COLUMN_ADD \"db\", \"age\", \"int16\"\n\n\t\tid = DT_ROW_ADD(\"db\", \"name\", \"Name1\", \"age\", 11)\n\t\tDT_ROW_ADD \"db\", \"name\", \"Name2\", \"age\", 21, \"height\", 164\n\t\tDT_ROW_ADD \"db\", \"name\", \"Name3\", \"age\", 18, \"height\", 159\n\t\tDT_ROW_ADD \"db\", \"name\", \"Name4\", \"age\", 33, \"height\", 180\n\t\tDT_ROW_ADD \"db\", \"name\", \"Name5\", \"age\", 18, \"height\", 172\n\n\t\tPRINTFORML 第1行的height列的值为\\@DT_CELL_ISNULL(\"db\", id, \"height\", 1)==1?空#非空\\@\n\n\t\tDT_CELL_SET \"db\", 0, \"height\", 132\n\n\t\tPRINTFORM 第1行 - 姓名：%DT_CELL_GETS(\"db\", 0, \"name\")%\n\t\tPRINTFORM 年龄：{DT_CELL_GET(\"db\", 0, \"age\")}\n\t\tPRINTFORML 身高：{DT_CELL_GET(\"db\", 0, \"height\")}\n\n\t\tONEINPUT\n\t```\n\t```text\n\t第1行的height列的值为空\n\t第1行 - 姓名：Name1 年龄：11 身高：132\n\t```",
    "sourcePath": "docs/Reference/DT_CELL.zh.md"
  },
  {
    "id": "DT_COLUMN",
    "title": "DataTable 列管理相关函数",
    "names": [
      "DT_COLUMN_ADD",
      "DT_COLUMN_EXIST",
      "DT_COLUMN_REMOVE",
      "DT_COLUMN_LENGTH",
      "DT_COLUMN_OPTIONS",
      "DT_COLUMN_NAMES",
      "DT_COLUMN"
    ],
    "signatures": [
      {
        "name": "DT_COLUMN_ADD",
        "params": "`string`, `string`(, `any`, `int`)",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      },
      {
        "name": "DT_COLUMN_EXIST",
        "params": "`string`, `string`",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      },
      {
        "name": "DT_COLUMN_REMOVE",
        "params": "`string`, `string`",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      },
      {
        "name": "DT_COLUMN_LENGTH",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      },
      {
        "name": "DT_COLUMN_OPTIONS",
        "params": "`string`, `string`, `keyword`, `any`([,`keyword`, `any`] ...)",
        "returns": "无",
        "engines": [
          "em"
        ],
        "overloads": []
      },
      {
        "name": "DT_COLUMN_NAMES",
        "params": "`string`(, `ref` `string[]`)",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      }
    ],
    "summary": "DataTable （数据库，基于 DataTable 类）的列的操作相关的一系列函数。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int DT_COLUMN_ADD dataTableName, columnName(, type, nullable)\n    int DT_COLUMN_EXIST dataTableName, columnName\n    int DT_COLUMN_REMOVE dataTableName, columnName\n    int DT_COLUMN_LENGTH dataTableName\n    int DT_COLUMN_OPTIONS dataTableName, columnName, option, optionValue([, option, optionValue] ...)\n    ```\n\n    `DataTable` （数据库，基于 [`DataTable`](https://learn.microsoft.com/zh-cn/dotnet/api/system.data.datatable?view=netframework-4.8) 类）的列的操作相关的一系列函数。\n\n    - `DT_COLUMN_ADD`：为名为 `dataTableName` 的 `DataTable` 添加 `columnName` 列。`columnName` 已经存在时，返回 `0`；若创建成功，返回 `1`。\n        - `type` 用于指定该列存储的数据的类型。\n            - `1`（整数）/ `int8`（字符串）：8位带符号整数\n            - `2`（整数）/ `int16`（字符串）：16位带符号整数\n            - `3`（整数）/ `int32`（字符串）：32位带符号整数\n            - `4`（整数）/ `int64`（字符串）：64位带符号整数\n            - `5`（整数）/ `string`（字符串）：字符串（默认值）\n        - `nullable` 为 `0` 以外的数（默认值）时，该列的数据可以为空。\n    - `DT_COLUMN_EXIST`：判断在名为 `dataTableName` 的 `DataTable` 中是否存在 `columnName` 列。若存在，返回存储类型对应的数值（参照 `DT_COLUMN_ADD` 的 `type` 参数）。否则返回 `0`。\n    - `DT_COLUMN_REMOVE`：将名为 `dataTableName` 的 `DataTable` 中断 `columnName` 列删除。若删除成功，返回 `1`。\n    - `DT_COLUMN_LENGTH`：返回名为 `dataTableName` 的 `DataTable` 的列数。若指定的 `DataTable` 本身就不存在，返回 `-1`。\n    - `DT_COLUMN_OPTIONS`：对名为 `dataTableName` 的 `DataTable` 的 `columnName` 列的设置项进行设置。`option` 无视大小写。\n        - `option` 为 `DEFAULT`：设定指定列的默认值。\n    - `DT_COLUMN_NAMES`：对名为 `dataTableName` 的 `DataTable` 的列名依次赋值给 `outputArray`。若 `outputArray` 被省略，则次赋值给 `RESULTS`。返回列数。\n\n    !!! warning \"注意\"\n\n        不能删除列 `id` 。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。`DT_COLUMN_OPTIONS` 只支持命令形式。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n\n        DT_CREATE \"db\"\n        DT_COLUMN_ADD \"db\", \"name\"\n        DT_COLUMN_ADD \"db\", \"height\", \"int16\"\n        DT_COLUMN_ADD \"db\", \"age\", \"int16\"\n\n        DT_COLUMN_OPTIONS \"db\", \"age\", DEFAULT, 5\n\n        DT_ROW_ADD \"db\", \"name\", \"Name1\", \"age\", 11, \"height\", 132\n        DT_ROW_ADD \"db\", \"name\", \"Name2\", \"height\", 164\n        DT_ROW_ADD \"db\", \"name\", \"Name3\", \"age\", 18, \"height\", 159\n        DT_ROW_ADD \"db\", \"name\", \"Name4\", \"age\", 33, \"height\", 180\n        DT_ROW_ADD \"db\", \"name\", \"Name5\", \"age\", 18, \"height\", 172\n\n        PRINT 列名：\n        FOR LOCAL, 0, DT_COLUMN_NAMES(\"db\")\n            PRINTFORM %RESULTS:LOCAL%\n        NEXT\n        PRINTL\n\n        PRINTFORML 列数：{DT_COLUMN_LENGTH(\"db\")}，列「age」是否存在：{DT_COLUMN_EXIST(\"db\", \"age\")}\n\n        PRINTFORML %DT_CELL_GETS(\"db\", 1, \"name\")%的年龄为{DT_CELL_GET(\"db\", 1, \"age\")}\n\n        DT_COLUMN_REMOVE \"db\", \"age\"\n\n        PRINTFORML 列数：{DT_COLUMN_LENGTH(\"db\")}，列「age」是否存在：{DT_COLUMN_EXIST(\"db\", \"age\")}\n\n        ONEINPUT\n    ```\n    ```text\n    列名：id name height age\n    列数：4，列「age」是否存在：2\n    Name2的年龄为5\n    列数：3，列「age」是否存在：0\n    ```",
    "sourcePath": "docs/Reference/DT_COLUMN.zh.md"
  },
  {
    "id": "DT_MANAGE",
    "title": "DataTable 管理相关函数",
    "names": [
      "DT_CREATE",
      "DT_EXIST",
      "DT_RELEASE",
      "DT_CLEAR",
      "DT_NOCASE",
      "DT_MANAGE"
    ],
    "signatures": [
      {
        "name": "DT_CREATE",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      },
      {
        "name": "DT_EXIST",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      },
      {
        "name": "DT_RELEASE",
        "params": "`string`",
        "returns": "`1`",
        "engines": [
          "em"
        ],
        "overloads": []
      },
      {
        "name": "DT_CLEAR",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      },
      {
        "name": "DT_NOCASE",
        "params": "`string`, `int`",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      }
    ],
    "summary": "DataTable （数据库，基于 DataTable 类）的创建 / 删除 / 判断是否存在 / 数据清除 / 大小写无视设定相关的一系列函数。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int DT_CREATE dataTableName\n    int DT_EXIST dataTableName\n    1 DT_RELEASE dataTableName\n    int DT_CLEAR dataTableName\n    int DT_NOCASE dataTableName, ignoreCase\n    ```\n\n    `DataTable` （数据库，基于 [`DataTable`](https://learn.microsoft.com/zh-cn/dotnet/api/system.data.datatable?view=netframework-4.8) 类）的创建 / 删除 / 判断是否存在 / 数据清除 / 大小写无视设定相关的一系列函数。\n\n    - `DT_CREATE`：生成名为 `dataTableName` 的 `DataTable`。\n        如果已经存在名为 `dataTableName` 的 `DataTable`（创建失败），返回 `0`；若创建成功，返回 `1`。\n    - `DT_EXIST`：判断是否存在名为 `dataTableName` 的 `DataTable`，若存在，返回 `1`；否则返回 `0`。\n    - `DT_RELEASE`：删除名为 `dataTableName` 的 `DataTable`。\n    - `DT_CLEAR`：删除名为 `dataTableName` 的 `DataTable` 中保存的所有行（不会清除列的设置），返回 `1`。若指定的 `DataTable` 本身就不存在，返回 `-1`。\n    - `DT_NOCASE`：设置名为 `dataTableName` 的 `DataTable` 在 `DT_SELECT` 函数处理字符串比较时是否无视大小写。返回 `1`。若指定的 `DataTable` 本身就不存在，返回 `-1`。\n        - `ignoreCase` 为 `0` 时（默认值）：大小写敏感\n        - `ignoreCase` 为其它值时：无视大小写\n\n    !!! warning \"注意\"\n\n        生成 `DataTable` 之后会自动添加 `id` 列。若需要保存进存档文件请参考「`XML`、`MAP`、`DataTable` 保存功能」。「タイトル画面へ戻る（返回标题界面）」或 [`RESETDATA`](https://osdn.net/projects/emuera/wiki/excom#h5-RESETDATA) 后会自动删除。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        PRINTFORML DataTable「db」是否存在：{DT_EXIST(\"db\")}\n        DT_CREATE \"db\"\n        PRINTSL RESULT ? \"创建成功\" # \"已经存在\"\n        DT_CREATE \"db\"\n        PRINTSL RESULT ? \"创建成功\" # \"已经存在\"\n\n        CALL GEN_DB_DATA\n\n        PRINTFORML DataTable「db」中的数据：{DT_ROW_LENGTH(\"db\")}行ｘ{DT_COLUMN_LENGTH(\"db\")}列\n        PRINTFORML 「name」以「n」开头的列数：{DT_SELECT(\"db\", \"name LIKE 'n%'\")}\n        DT_NOCASE \"db\", 1\n        PRINTFORML 「name」以「n」开头的列数：{DT_SELECT(\"db\", \"name LIKE 'n%'\")}\n        DT_CLEAR \"db\"\n        PRINTFORML DataTable「db」中的数据：{DT_ROW_LENGTH(\"db\")}行ｘ{DT_COLUMN_LENGTH(\"db\")}列\n\n        RESETDATA ; すべてのDataTableが自動的に削除される\n\n        DT_CREATE \"db\"\n        PRINTSL RESULT ? \"创建成功\" # \"已经存在\"\n        PRINTFORML DataTable「db」是否存在：{DT_EXIST(\"db\")}\n        DT_RELEASE \"db\"\n        PRINTFORML DataTable「db」是否存在：{DT_EXIST(\"db\")}\n\n        ONEINPUT\n\n    @GEN_DB_DATA\n        DT_COLUMN_ADD \"db\", \"name\"\n        DT_COLUMN_ADD \"db\", \"height\", \"int16\"\n        DT_COLUMN_ADD \"db\", \"age\", \"int16\"\n\n        DT_ROW_ADD \"db\", \"name\", \"Name1\", \"age\", 11, \"height\", 132\n        DT_ROW_ADD \"db\", \"name\", \"Name2\", \"age\", 21, \"height\", 164\n        DT_ROW_ADD \"db\", \"name\", \"Name3\", \"age\", 18, \"height\", 159\n        DT_ROW_ADD \"db\", \"name\", \"Name4\", \"age\", 33, \"height\", 180\n        DT_ROW_ADD \"db\", \"name\", \"Name5\", \"age\", 18, \"height\", 172\n    ```\n    ```text\n    DataTable「db」是否存在：0\n    创建成功\n    已经存在\n    DataTable「db」中的数据：5行ｘ4列\n    「name」以「n」开头的列数：0\n    「name」以「n」开头的列数：5\n    DataTable「db」中的数据：0行ｘ4列\n    创建成功\n    DataTable「db」是否存在：1\n    DataTable「db」是否存在：0\n    ```",
    "sourcePath": "docs/Reference/DT_MANAGE.zh.md"
  },
  {
    "id": "DT_ROW",
    "title": "DataTable 行管理相关函数",
    "names": [
      "DT_ROW_ADD",
      "DT_ROW_SET",
      "DT_ROW_REMOVE",
      "DT_ROW_LENGTH",
      "DT_ROW"
    ],
    "signatures": [
      {
        "name": "DT_ROW_ADD",
        "params": "`string`([, `string`, `any`] ...)",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": [
          "`string`, `ref` `string[]`, `ref` `any[]`, `int`"
        ]
      },
      {
        "name": "DT_ROW_SET",
        "params": "`string`, `int`, `string`, `any`([, `string`, `any`] ...)",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": [
          "`string`, `int`, `ref` `string[]`, `ref` `any[]`, `int`"
        ]
      },
      {
        "name": "DT_ROW_REMOVE",
        "params": "`string`, `int`",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": [
          "`string`, `ref` `int[]`, `int`"
        ]
      },
      {
        "name": "DT_ROW_LENGTH",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      }
    ],
    "summary": "DataTable （数据库，基于 DataTable 类）的行的操作相关的一系列函数。",
    "body": "!!! info \"API\"\n\n    ```erb\n    a. int DT_ROW_ADD dataTableName, ([, columnName, columnValue] ...)\n    b. int DT_ROW_ADD dataTableName, columnNames, columnValues, count\n\n    a. int DT_ROW_SET dataTableName, idValue, ([, columnName, columnValue] ...)\n    b. int DT_ROW_ADD dataTableName, idValue, columnNames, columnValues, count\n\n    a. int DT_ROW_REMOVE dataTableName, idValue\n    b. int DT_ROW_REMOVE dataTableName, idValues, count\n\n    int DT_ROW_LENGTH dataTableName\n    ```\n\n    `DataTable` （数据库，基于 [`DataTable`](https://learn.microsoft.com/zh-cn/dotnet/api/system.data.datatable?view=netframework-4.8) 类）的行的操作相关的一系列函数。\n\n    - `DT_ROW_ADD`：为名为 `dataTableName` 的 `DataTable` 添加行。若指定的 `DataTable` 本身就不存在，返回 `-1`。\n        1. 添加新行，将该行的 `columnName` 列赋值为 `columnValue`，返回该行的 `id` 列的值。可以传入多组 `columnName`・`columnValue`。\n        2. 添加新行，依次从 `columnNames` 中取出行名，从 `columnValues` 中取出值，为对应行赋值，最大重复 `count` 次。返回该行的 `id` 列的值。\n    - `DT_ROW_SET`：修改名为 `dataTableName` 的 `DataTable` 的 `id` 为 `idValue` 的行。若指定的 `DataTable` 本身就不存在，返回 `-1`。\n        1. 将该行的 `columnName` 列的值设置为 `columnValue`，返回编辑成功的值的总数。可以传入多组 `columnName`・`columnValue`。\n        2. 依次从 `columnNames` 中取出行名，从 `columnValues` 中取出值，为对应行赋值，最大重复 `count` 次。返回编辑成功的值的总数。\n    - `DT_ROW_REMOVE`：将名为 `dataTableName` 的 `DataTable` 中的行删除。若指定的 `DataTable` 本身就不存在，返回 `-1`。\n        1. 删除 `id` 列的值为 `idValue` 的行。若删除成功，返回 `1`。\n        2. 依次将 `id` 与 `idValues` 的元素的值相等的行删除，最大重复 `count` 次。若删除成功，返回删除的行的数量。\n    - `DT_ROW_LENGTH`：返回名为 `dataTableName` 的 `DataTable` 的行数。若指定的 `DataTable` 本身就不存在，返回 `-1`。\n\n    !!! warning \"注意\"\n\n        不能编辑 `id` 列的值。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        #DIM id\n        #DIMS columnNames = \"age\", \"height\"\n        #DIM columnValues = 11, 132\n\n        DT_CREATE \"db\"\n        DT_COLUMN_ADD \"db\", \"name\"\n        DT_COLUMN_ADD \"db\", \"height\", \"int16\"\n        DT_COLUMN_ADD \"db\", \"age\", \"int16\"\n\n        id = DT_ROW_ADD(\"db\", \"name\", \"Name1\")\n        DT_ROW_SET \"db\", id, columnNames, columnValues, 2\n        DT_ROW_ADD \"db\", \"name\", \"Name2\", \"age\", 21, \"height\", 164\n        DT_ROW_ADD \"db\", \"name\", \"Name3\", \"age\", 18, \"height\", 159\n        DT_ROW_ADD \"db\", \"name\", \"Name4\", \"age\", 33, \"height\", 180\n        DT_ROW_ADD \"db\", \"name\", \"Name5\", \"age\", 18, \"height\", 172\n\n        PRINTFORML 行数：{DT_ROW_LENGTH(\"db\")}\n\n        CALL PRINTL_ROW(0)\n        DT_ROW_SET \"db\", id, \"age\", 0, \"height\", 50\n        CALL PRINTL_ROW(0)\n\n        ONEINPUT\n\n    @PRINTL_ROW(index)\n        #DIM index\n        PRINTFORM 第{index+1}行 - 姓名：%DT_CELL_GETS(\"db\", index, \"name\")%\n        PRINTFORM 年龄：{DT_CELL_GET(\"db\", index, \"age\")}\n        PRINTFORML 身高：{DT_CELL_GET(\"db\", index, \"height\")}\n    ```\n    ```text\n    行数：5\n    第1行 - 姓名：Name1 年龄：11 身高：132\n    第1行 - 姓名：Name1 年龄：0 身高：50\n    ```",
    "sourcePath": "docs/Reference/DT_ROW.zh.md"
  },
  {
    "id": "DT_SELECT",
    "title": "DT_SELECT",
    "names": [
      "DT_SELECT"
    ],
    "signatures": [
      {
        "name": "DT_SELECT",
        "params": "`string`(, `string`, `string`, `ref` `int[]`)",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      }
    ],
    "summary": "从名为 dataTableName 的 DataTable 中选择满足 filterExpression 的行，将其 id 列的值按照 sortRule 的规则排序、依次代入 output 数组中。返回被选择的行的总数。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int DT_SELECT dataTableName(, filterExpression, sortRule, output)\n    ```\n\n    从名为 `dataTableName` 的 `DataTable` 中选择满足 `filterExpression` 的行，将其 `id` 列的值按照 `sortRule` 的规则排序、依次代入 `output` 数组中。返回被选择的行的总数。\n\n    - 若省略 `filterExpression`，选择所有的行。\n    - 若省略 `sortRule`，不进行排序。\n    - 若未指定 `output` ，将 `id` 的值依次代入 `RESULT` 数组（从 `RESULT:1` 开始）。\n\n    请参考 [`C#` 的 `DataTable.Select`](https://learn.microsoft.com/zh-cn/dotnet/api/system.data.datatable.select?view=netframework-4.8#system-data-datatable-select(system-string-system-string)) 的说明。\n\n!!! warning \"注意\"\n\n    返回值可能会超过 `output` / `RESULT` 数组的大小。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        #DIM idx, 10\n        #DIM count\n        #DIM i\n\n        DT_CREATE \"db\"\n        DT_COLUMN_ADD \"db\", \"name\"\n        DT_COLUMN_ADD \"db\", \"height\", \"int16\"\n        DT_COLUMN_ADD \"db\", \"age\", \"int16\"\n\n        DT_ROW_ADD \"db\", \"name\", \"Name1\", \"age\", 11, \"height\", 132\n        DT_ROW_ADD \"db\", \"name\", \"Name2\", \"age\", 21, \"height\", 164\n        DT_ROW_ADD \"db\", \"name\", \"Name3\", \"age\", 18, \"height\", 159\n        DT_ROW_ADD \"db\", \"name\", \"Name4\", \"age\", 33, \"height\", 180\n        DT_ROW_ADD \"db\", \"name\", \"Name5\", \"age\", 18, \"height\", 172\n\n        count = DT_SELECT(\"db\", \"age >= 18\", \"age ASC, height DESC\", idx)\n\n        PRINTL 18岁及以上的人：\n        FOR i, 0, count\n            CALL PRINTL_ROW(idx:i)\n        NEXT\n\n        ONEINPUT\n\n    @PRINTL_ROW(id)\n        #DIM id\n        PRINTFORM 姓名：%DT_CELL_GETS(\"db\", id, \"name\", 1)%\n        PRINTFORM 年龄：{DT_CELL_GET(\"db\", id, \"age\", 1)}\n        PRINTFORML 身高：{DT_CELL_GET(\"db\", id, \"height\", 1)}\n    ```\n    ```text\n    18岁及以上的人：\n    姓名：Name5 年龄：18 身高：172\n    姓名：Name3 年龄：18 身高：159\n    姓名：Name2 年龄：21 身高：164\n    姓名：Name4 年龄：33 身高：180\n    ```",
    "sourcePath": "docs/Reference/DT_SELECT.zh.md"
  },
  {
    "id": "DT_SERIALIZATION",
    "title": "DataTable 序列化相关函数",
    "names": [
      "DT_TOXML",
      "DT_FROMXML",
      "DT_SERIALIZATION"
    ],
    "signatures": [
      {
        "name": "DT_TOXML",
        "params": "`string`(, `ref` `string`)",
        "returns": "`string`",
        "engines": [
          "em"
        ],
        "overloads": []
      },
      {
        "name": "DT_FROMXML",
        "params": "`string`, `string`, `string`",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      }
    ],
    "summary": "DataTable （数据库，基于 DataTable 类）与 XML互相转换的函数。",
    "body": "!!! info \"API\"\n\n    ```erb\n    1. string DT_TOXML, dataTableName(, schemaOutput)\n    2. int DT_FROMXML, dataTableName, schemaXml, dataXml\n    ```\n\n    `DataTable` （数据库，基于 [`DataTable`](https://learn.microsoft.com/zh-cn/dotnet/api/system.data.datatable?view=netframework-4.8) 类）与 `XML`互相转换的函数。\n\n    - `DT_TOXML`：为名为 `dataTableName` 的 `DataTable` 转换为 `XML`，格式相关信息的 `XML` 保存至 `schemaOutput`（若省略则保存至`RESULTS:1`）。返回数据 `XML`。\n    - `DT_FROMXML`：解析格式相关信息 `schemaXml` 与 数据 `dataXml`，覆盖名为 `dataTableName` 的 `DataTable`。若成功则返回 `1`，否则返回`0`。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        #DIMS schema\n        #DIMS data\n\n        DT_CREATE \"db\"\n        DT_COLUMN_ADD \"db\", \"name\"\n        DT_COLUMN_ADD \"db\", \"height\", \"int16\"\n        DT_COLUMN_ADD \"db\", \"age\", \"int16\"\n\n        DT_ROW_ADD \"db\", \"name\", \"Name1\", \"age\", 11, \"height\", 132\n\n        data '= DT_TOXML(\"db\", schema)\n\n        DT_RELEASE \"db\"\n\n        DT_FROMXML \"db\", schema, data\n        PRINTFORML %DT_CELL_GETS(\"db\", 0, \"name\")%的年龄为{DT_CELL_GET(\"db\", 0, \"age\")}\n\n        ONEINPUT\n    ```\n    ```text\n    Name1的年龄为11\n    ```",
    "sourcePath": "docs/Reference/DT_SERIALIZATION.zh.md"
  },
  {
    "id": "Emuera/config_files",
    "sourcePath": "docs/Emuera/config_files.zh.md",
    "title": "配置设置的强制设定",
    "names": [],
    "signatures": [],
    "summary": "当Emuera检测到csv文件夹内存在名为fixed.config和/或default.config的文件时，将会读取这些文件。",
    "body": "# 配置设置的强制设定\n当Emuera检测到csv文件夹内存在名为`_fixed.config`和/或`_default.config`的文件时，将会读取这些文件。\n各个`.config`文件的格式与`emuera.config`相同。各项配置的具体含义请参见配置项目。\n\n各文件的优先级取决于Emuera读取配置文件的顺序。\nEmuera读取配置文件的顺序如下：\n\n\tcsv\\_default.config\n\temuera.config\n\tcsv\\_fixed.config\n\n按照此顺序，后读取的设置将覆盖先前的设置。也就是说，`_default.config`中的设置会被`emuera.config`覆盖，而`emuera.config`中的设置则会被`_fixed.config`覆盖。请注意，只有使用上述路径和文件名的文件才会被加载。\n也就是说，如果将`_fixed.config`或`_default.config`放在csv文件夹下的子文件夹中，或者使用缺少下划线的文件名如`default.config`等，这些文件都不会被读取。\n\n## `_fixed.config`\n在`_fixed.config`中设置的选项优先于`emuera.config`中的设置。\n此外，在`_fixed.config`中指定的项目将无法通过Emuera的设置对话框进行修改。\n请仅在某些特定选项对于期望的功能是必需的情况下使用`_fixed.config`。\n依赖Emuera换行位置的脚本需要将\"不在按钮中间换行\"选项设为\"YES\"。\n另外，如果需要使用`_Replace.csv`和`_Rename.csv`，则必须设置相关的选项。\n除此之外，如果使用`SETCOLOR`，可能需要固定背景色、文字颜色等。\n但是，如果连非必需的选项也在`_fixed.config`中设置，将会导致用户无法进行自定义。\n请尽量减少在`_fixed.config`中设置的项目数量。\n\n## `_default.config`\n如果有不是必须强制设定但推荐使用的选项，可以使用`_default.config`代替`_fixed.config`。\n当`emuera.config`不存在时，`_default.config`将作为初始设置使用。\n如果`emuera.config`存在，则以`emuera.config`中设置的选项为准，因此不会覆盖用户的设置。"
  },
  {
    "id": "Emuera/config#FPS",
    "pageId": "Emuera/config",
    "sourcePath": "docs/Emuera/config.zh.md",
    "localOnly": true,
    "title": "FPS",
    "names": [
      "FPS"
    ],
    "signatures": [],
    "summary": "是否接受鼠标输入。",
    "body": "### 使用鼠标\n\n是否接受鼠标输入。\n\n### 使用菜单\n\n是否显示菜单。\n如果设置为不显示，将无法通过菜单更改设置，需要修改`emuera.config`才能还原。\n\n### 使用调试命令\n\n是否在主控制台接受调试命令。默认为`NO`。\n无论此选项如何，都可以在调试控制台执行调试命令。\n\n### 允许运行多个窗口实例\n\n是否允许重复启动多个Emuera实例。\n\n### 使用键盘宏\n\n是否使用`F1～F12`的键盘宏。\n另外，使用包含`ONEINPUT`或`ONEINPUTS`指令的代码时，键盘宏可能无法正常工作，这是正常现象。\n\n### 开始自动保存\n\n是否在`BEGIN SHOP`指令的同时执行自动保存。此功能可在ERB脚本侧实质上禁用，因此即使设置了也可能实际上不会执行保存。\n\n### 将存档保存到sav文件夹\n\n设置是将保存数据放在exe文件所在目录下，还是创建sav文件夹并将保存数据放在其中。默认为`NO`。\n设置为`YES`时，如果不存在sav文件夹，会出现一个自动移动sav文件的对话框。\n回答`是`后，所有现有的`global.sav`和`save*.sav`文件都将移动到sav文件夹中。\n当从`YES`切换到`NO`等设置时，请手动移动sav文件。\n\n### 用英文输出配置文件的设置项目\n\nEM+EE的功能。默认为`NO`。只改变文件内容，不影响运行\n\n### 历史日志行数\n\n保存历史记录的最大行数。下限为`500`行。\n\n### 无限循环警告超时毫秒数\n\n如果`[WAIT](../Reference/WAIT.zh.md)`系列指令在此时间间隔内未执行，将显示警告对话框。\n设置为`0`时，此功能无效。\n如下所示的脚本虽然是无限循环，但由于中间插入了WAIT，所以不会触发警告。\n\n\t$LOOP\n\tWAIT\n\tGOTO LOOP\n\n即使右键单击或按ESC跳过消息，只要插入了`WAIT`就不会发出警告。\n\n### 每页显示的存档数\n\n在存档加载画面中显示的存档数量。下限为`20`（与eramaker相同），上限为`80`。\n\n### 关联的文本编辑器\n\n点击错误消息时，可以使用此处设置的文本编辑器打开对应的文件。\n\n### 命令行参数\n\n指定将文件传递给文本编辑器时附加的命令行参数。\n\n### 渲染API\n\n用于渲染的接口。\n\n- `WINAPI` - 使用`gdi32.dll`的TextOut函数进行渲染。（GDI渲染）\n\t- 1.700版本中新增的渲染方法，比其他方法渲染速度更快。（但在某些环境下可能比其他方法慢）\n- `GRAPHICS`（默认值） - 使用`Graphics.DrawString`函数进行渲染。（GDI+渲染）\n\t- 与旧的`GDI+を使う:YES`选项相同。\n\t- 由于GDI+的特点，即使是等宽字体也可能导致字符串宽度偏差。\n- `TEXTRENDERER` - 使用`TextRenderer.DrawText`函数进行渲染。（GDI渲染）\n\t- 与旧的`GDI+を使う:NO`选项相同。\n\n### （使用图像缓冲区）\n\n此选项在1.818版本中已被废弃。\n由于渲染处理的更改，不再需要图像缓冲区。\n\n### （渲染时使用GDI+）\n\n此选项在1.700版本中已被废弃。\n请使用`渲染接口`选项进行设置。\n\n每秒最多渲染多少次。数值越小运行越快。\n如果`最大跳帧数`较小，则即使减小每秒帧数也不会变快。\n\n它实际被用作\"非强制性渲染的最小间隔\"（`1000 / 每秒帧数` 毫秒）。\n进入等待用户输入的命令（`INPUT`系）时的渲染，以及 [`REDRAW`](../Reference/REDRAW.zh.md) 加上 `2` 的命令所进行的强制渲染，都不受此限制。\n对于单帧渲染耗时较长的画面（如动画循环等），实际渲染间隔会远大于该值，因此即使改变每秒帧数，观感也可能没有变化。\n\n### （最大跳帧数）\n\n此选项已被废弃。\n\n### PRINTC的每行项目数\n\n`PRINT_SHOPITEM`等系统执行`PRINTC`指令时，每隔多少次换行。 本家eramaker中为`3`。\n设置为`0`时，不根据`PRINTC`的数量进行换行。\n设置为`0`时，请同时将`按钮中途不换行`设为`YES`。\n这样，当超出窗口大小时会自动换行。\n\n### PRINTC项目的文字长度\n\n`PRINTC`整体左侧补全半角空格直到达到指定字符数。\n本家eramaker中为`25`。\nSHOP商品显示时使用此字符数+1。\neramaker中SHOP商品整理为26个字符。\n一行可排列的字符数约为`(窗口宽度) / (字体大小) * 2`，因此请确保`` (PRINTC字符数+1) * (PRINTC排列数量)`小于该值。\n\n### 按钮文本不换行\n\n按钮是指`[200] - 存档`等可以鼠标选择和点击的字符串。\n默认值为`NO`，这与eramaker显示方式相同。\n将此选项设为`YES`时，超出窗口边界的按钮整体将移到下一行。\n\n### Emuera界面语言\n\nEM+EE的功能。可以选择UI和错误消息等的语言。默认为`空字符串(日语)`，还包括英语和中文语言文件\n使用与Emuera同目录下的`lang`文件夹内的xml文件\n\n### 窗口宽度\n\n指定启动时窗口的宽度。\n不是整体尺寸，而是绘制区域的尺寸。\n\n### 窗口高度\n\n指定启动时窗口的高度。\n虽然包括绘制区域的尺寸，但也包括底部输入部分的高度。\n\n### 窗口高度可变\n\n是否可以在运行中更改窗口大小。\n\n### 启动时窗口最大化\n\n默认为`NO`。\n设置为`YES`时，Emuera将以最大化状态启动。\n\n### 固定启动时的窗口位置\n\n是否在运行中指定窗口位置。\n如果不指定，则`窗口位置X、Y`没有意义。\n\n### 窗口位置X\n\n固定窗口位置时的固定位置。\nX确定水平轴方向的位置。显示器左上角为`0,0`，向右X值增大。\n\n### 窗口位置Y\n\n固定窗口位置时的固定位置。\nY确定垂直轴方向的位置。显示器左上角为`0,0`，向下Y值增大。\n\n### 滚动行数\n\n指定鼠标滚轮滚动一次移动的行数。\n\n### 背景颜色\n\n背景色。\n\n### 文字颜色\n\n文字颜色。如果脚本中执行`SETCOLOR`指令，则以该指令为准。\n\n### 选中文本颜色\n\n鼠标选中按钮时的文字颜色。\n\n### 历史日志颜色\n\n后台日志显示中的文字颜色。如果脚本中执行`SETCOLOR`指令，则以该指令为准。\n\n### 字体名称\n\n指定字体。不能指定光栅字体。\n可以指定比例字体，但不推荐，因为会导致显示混乱。\nEM+EE的功能，现在可以从与Emuera同目录下的`font`文件夹及`ttf`、`otf`文件中选择\n\n### 字体大小\n\n以像素为单位指定文字大小（高度）。\n\n### 一行的高度\n\n以像素为单位指定单行高度。不能小于字体大小。\n与字体大小相同时似乎会导致显示混乱。\n建议设置为字体大小+1～2左右。\n推荐设置为`字体大小 = 18`, `单行高度 = 19`左右。\n\n### 无视文字的大小写\n\n这些选项是面向ERB创建者设计的。更改系统项目可能会导致ERB脚本不能按作者意图正常运行。\n\n是否忽略ERB中指令和变量的大小写差异。默认为`YES（忽略）`。\n\n### 使用 _Rename.csv\n\n是否使用`EraMakerEx`的`_Rename.csv`。默认为`NO（不使用）`。\n关于`_Rename.csv`的规格，请参考`EraMakerEx`的`Readme.txt`（Emuera中未包含）。\n`_Rename.csv`与`[[名字]]`记法的详细说明见教程的[Rename 宏](../tutorial/rename-macro.zh.md)。\n\n### 使用 _Replace.csv\n\n是否使用私家改造版1.52a-c中新增的`_Replace.csv`功能。\n\n### 搜索子文件夹\n\n是否读取CSV和ERB文件夹内子文件夹中的文件。默认为`NO`。\n设置为`YES`时，将读取`chara*.csv`和`*.ERB`子文件夹中的文件。\n除`chara*.csv`以外的csv文件不受此选项影响。\n读取顺序是文件夹内文件、文件夹优先，其他文件在后。\n如果启用了`按文件名排序读取顺序`选项，文件夹也将按名称排序。\n\n### 读取顺序以文件名排序\n\n是否按文件名顺序对文件读取顺序进行排序。默认为`NO`。\n有关与文件系统和读取顺序相关的问题，请参阅eramaker差异项中的相关内容。\n设置为`NO`时，读取顺序将是C#的`Directory.GetFiles`函数返回的顺序。\n`GetFiles`函数内部使用`Kernel32.dll`的`FindNextFile`函数，结果取决于文件系统。\n`Directory.GetFiles`函数的结果可能重现了eramaker的读取顺序，但这会因用户环境而导致脚本行为不同。\n设置为`YES`时，将在读取前按文件名对文件列表进行排序。\n请注意，排序结果可能与NTFS文件顺序不一致。\n例如，`_（下划线）`在NTFS中位于数字或字母之前，但在文件名排序中会出现在数字之后。\n\n### 允许覆盖系统函数\n\n是否允许使用用户定义函数覆盖表达式中可用的函数。\n默认为`YES（允许）`。\n\n### 系统函数被覆盖时发出警告\n\n是否显示用户定义函数覆盖表达式中可用函数的警告。\n默认为`YES（显示）`。\n如果`允许覆盖系统函数`选项为`YES`，则不管此项目设置如何都会显示警告。\n\n### 定义了多个同名的非事件函数发出警告\n\n在eramaker系统中，即使存在多个同名函数，也只有效第一个加载的，后续的会被忽略。\n这种规格虽有用处，但也会因用户环境不同而导致脚本行为不同。\n将此选项设为`YES（警告）`时，当存在多个同名函数时会发出警告。\n\n### 全角空格视为普通空格\n\n默认为`YES（包含）`，设为`NO（不包含）`后将无法使用全角空格作为空白字符。\n这意味着可以禁止在ERB中使用全角空格替代半角空格或制表符作为缩进等。\n\n### 程序的非Unicode的言\n\n对于`STRLENS`等依赖内部区域设置的处理，可以选择处理所用的区域设置。\n但是，UI等不会发生变化。默认为`日语(ja-JP)`。\n支持以下语言。\n・`日语（Shift-JIS，默认）`\n・`韩语（ko-KR）`\n・`简体中文（zh-CN）（未经测试）`\n・`繁体中文（zh-TW）（未经测试）`\n\n### 不展开FORM中的三联符号\n\neramaker的FORM语法中，当`///`或`+++`等符号连续出现三次时，会展开为`NAME:ASSI`或`CALLNAME:ASSI`等字符串。\n将此项设为`YES（不展开）`后，将不认可此功能，保持符号原样。\n默认为`NO（展开）`。\n\n### 存档以二进制的形式保存\n\n是否以二进制格式写入存档数据。默认为`NO（不保存）`。\n设置为`NO（不保存）`时，存档数据的字符编码与eramaker语法相同。\n以二进制格式保存可减小容量，反之亦然，更改设置时请注意。\n使用`#DIM SAVEDATA`定义的可保存角色型变量和多维字符串变量必须将此选项设为YES。\n\n### 以UTF-8保存存档数据\n\n是否以字符编码`UTF-8`写入存档数据。默认为`NO（不保存）`。\n设置为`NO（不保存）`时，存档数据的字符编码与eramaker相同为`SJIS`。\n当`以二进制格式保存存档数据`为`YES`时，此选项无效（强制使用`UTF-8`）\n\n### 压缩保存存档数据\n\nEM+EE的功能。压缩存档数据大小。只有在`以二进制格式保存存档数据`项目为`YES`时才可使用\n\n### 允许ONEINPUT系列指令中鼠标输入多个字符\n\n此项目不在配置界面显示，只能通过直接编辑`emuera.config`进行设置。\n默认为`NO（不允许）`。\n设置为`YES`时，对于`ONEINPUT`系列指令，鼠标输入多个字符值时不会截断为首字符。\n\n### 读取UTF-8(BOM无)编码的文件\n\nEM+EE的功能。设置为`YES`时可支持UTF-8(BOM无)文件\n\n### 不自动补全角色变量的参数\n\n默认为`NO`。使用角色变量如`CFLAG`等时，如输入`CFLAG:0`会自动补全为`CFLAG:TARGET:0`并执行，\n但当此选项为`YES`时不会补全，需要逐一标记\n\n### 禁止UPDATECHECK\n\nEM+EE的功能。设置为`YES`时，执行[`UPDATECHECK`](../Reference/UPDATECHECK.zh.md)时不执行处理，`RESULT`会被赋值为`4`\n\n### 使用ERD功能\n\nEM+EE的功能。设置为`NO`可禁用[ERD功能](../EMEE/EMEE_Summary.zh.md)\n\n### 将VARSIZE的维度指定与ERD功能对齐\n\nEM+EE的功能。ERD功能中维度从左至右为`1`, `2`, `3`，而`VARSIZE`中从左至右为`0`, `1`, `2`\n将此选项设为`YES`时，`VARSIZE`也会像ERD一样从左至右为`1`, `2`, `3`\n\n### 执行无法解释的行\n\n这些选项用于解决eramaker与Emuera运行方式不同、Emuera旧版本可运行的脚本无法运行等问题。\n如果没有问题，请不要更改默认设置。\n\n默认为`NO`，启动时如果解析失败的行存在，将在标题画面结束并显示错误。\n此选项可停止此行为，即使存在无法解析的行也能从标题继续前进。\n\n### 当CALLNAME为时以NAME的值代入\n\n默认为`NO`。\n设置为`YES`时，如果`chara*.csv`中的`CALLNAME`未设置或设置为空字符串，将被视为与`NAME`相同的字符串。\n这是为了重现eramaker在`CALLNAME`为空字符串时返回`NAME`的行为。\n不过，此选项也无法完全重现。\n例如，将eramaker中添加角色的存档数据在Emuera中读取时，可能会出现行为差异。\n\n### 将虚拟变量RAND的表现与eramaker一致\n\n默认为`NO`。\n设置为`YES`时，`RAND`的生成方式将与eramaker相同。\n这种方式具有即使参数为负值也能运行、不会返回`32767`以上值、当`X`超过`1000`左右时值的偏差变得不可忽视等特点。\n详情请参阅与eramaker的差异。\n\n### 函数以及参数的大小写敏感\n\n默认为`NO`。\neramaker对指令和变量不区分大小写，但对函数名和属性（性质）区分大小写。\n将此项设为`YES`并配合`忽略大小写差异:YES`可实现与eramaker相同的操作。\n\n### 允许调用事件函数\n\n默认为`NO`。\n设置为`YES`时，可通过`[CALL](../Reference/CALL.zh.md)`指令调用事件函数，与eramaker规格相同。\n\n### 回调至ver1739以前的非按钮换行\n\n默认为`NO`。\n设置为`YES`时，将重现Emuera1.739以前的`DRAWLINE`等规格。 这样可以使依赖Emuera1.739以前非按钮换行规格的脚本等正常运行。\n升级Emuera版本后如果显示错乱，将此配置设为`YES`可能解决问题。\n\n### （DRAWLINE始终在新行执行）\n\n此选项在1.806版本中已被废弃。\n现在已迁移到`重现ver1739以前的非按钮换行`选项。\n\n### 允许省略用户定义函数的所有参数\n\n默认为`NO`。\n设置为`YES`时，即使将ARG、ARGS、用户定义的私有变量之外的变量设置为函数参数，在调用时也可以忽略参数。\n可以重现Emuera1.807以前使用这些变量作为参数但省略参数时，不会发生赋值并维持调用前状态的特性。\n从Emuera1.807以前升级版本时，如果函数出现错误，将此配置设为`YES`可能解决问题。\n\n详见 [参数省略与兼容设置](function.zh.md#arg-omission)。\n\n### 允许用户定义函数的参数自动补全TOSTR命令\n\n默认为`NO`。\n设置为`YES`时，与Emuera1.807以前一样，在调用函数时向字符串参数传递数值时，会自动转换为字符串类型。\n从Emuera1.807以前升级版本时，如果函数出现错误，将此配置设为`YES`可能解决问题。\n在Emuera1.820(Emuera1819+v10)期间，此选项的效果存在反转的bug。\n\n### 使用SP角色\n\n默认为`NO`。\n此选项用于恢复1.816版本中删除的SP角色相关功能。\n从Emuera1.816以前升级版本时，如果出现错误，将此配置设为`YES`可能解决问题。\n\n### 与eramaker不兼容时发出警告\n\n显示与eramaker兼容性相关的警告\n\n### 读取脚本时显示报告\n\n是否在加载时显示总行数、函数数量等报告。\n不显示时，将显示`_replace.csv`中指定的加载中消息。\n\n### 检查ERD标识符与局部变量重复\n\nEM+EE的功能。引用[ERD功能](../EMEE/EMEE_Summary.md#csv-erd-erh)中定义的变量时，如果局部变量与标识符重复，可能会引用意外的数组\n将此设为`YES`后，启动时会警告标识符与局部变量的重复\n\n### 读取时解析参数\n\n是否在加载时解析指令的参数。\n加载时进行解析会使加载明显变慢，但执行会稍微变快。\n如果不是为了错误检查，建议设为`NO`以便更舒适地运行。\n- `始终不执行（NO）` - 不进行解析。\n- `仅在更新时执行（ONCE）` - 仅在csv或ERB自上次启动以来有更新时才解析。\n- `始终执行（YES）` - 进行解析。\n\n### 最低显示警告级别\n\n加载时显示的警告级别。低于指定值的警告不会显示。\n- `0` - 使用`==`代替`=`等不会特别引起问题的警告。\n- `1` - 在函数声明外使用`#PRI`等可忽略并继续执行的程度的问题。\n- `2` - 无法解析的行、不匹配的`IF～ENDIF`等运行时会出错的行。\n- `3` - 加载过程中发生的不可恢复错误。强制显示。\n\n### （加载时解析FORM字符串）\n\n此选项在1.800版本中已被废弃。\n\n### 忽略没有被调用的函数\n\n仅在加载时解析参数时有效。\n设置为`YES`时，对未被调用的函数不进行参数解析。\n\n### 找不到函数时的警告处理\n\n仅在加载时解析参数时有效。\n当`[CALL](../Reference/CALL.zh.md)`指令或`[JUMP](../Reference/JUMP.zh.md)`指令的目标函数不存在时是否发出警告。\n- `忽略（IGNORE）` - 不发出警告。\n- `稍后显示总数（LATER）` - 不发出警告，但稍后报告忽略的数量。\n- `每个文件仅显示一次（ONCE）` - 每个文件仅警告一次。\n- `显示（DISPLAY）` - 显示全部。\n\n需要注意的是，对于`CALLFORM`或`JUMPFORM`等情况不适用于此处理。\n\n### 函数没有被调用时的警告处理\n\n仅在加载时解析参数时有效。\n当定义了`@～～`但从未被调用时是否发出警告。\n格式与`函数未找到警告处理`相同。\n\n### （忽略指定文件中的警告）\n\n此功能已被删除\n\n### 启动时显示调试窗口\n\n调试相关选项仅在以调试模式启动Emuera时有效。\n有关调试模式的详细信息，请参阅调试模式的文章。\n\n在调试模式启动时自动显示调试窗口。\n\n### 调试窗口前置显示\n\n打开调试窗口时，默认前置显示。\n打开后可以通过调试窗口内的按钮切换。\n\n### 调试窗口宽度\n\n指定调试窗口的宽度。\n包括窗口边缘在内的整体尺寸。\n\n### 调试窗口高度\n\n指定调试窗口的高度。\n包括窗口边缘在内的整体尺寸。\n调试窗口与主窗口不同，打开后仍可自由调整大小。\n要使用设置对话框的`获取当前窗口大小`按钮，需要在打开调试窗口的状态下打开设置对话框。\n\n### 指定调试窗口位置\n\n是否指定打开调试窗口时的位置。\n如果不指定，则调试窗口位置`X、Y`没有意义。\n\n### 调试窗口位置X\n\n固定调试窗口位置时的固定位置。\nX确定水平轴方向的位置。显示器左上角为`(0, 0)`，向右X值增大。\n\n### 调试窗口位置Y\n\n固定调试窗口位置时的固定位置。\nY确定垂直轴方向的位置。显示器左上角为`(0, 0)`，向下Y值增大。\n要使用设置对话框的`获取当前窗口位置`按钮，需要在打开调试窗口的状态下打开设置对话框。\n\n### 复制显示文本到剪贴板\n\n所有功能均为EM+EE新增功能，从英语版Emuera-Anchor移植的功能\n\n设置为`YES`以启用剪贴板功能\n\n### 无视文本中的<>标签\n\n是否忽略HTML标签的选项\n\n### 将标签<>替换为以下文字\n\n将HTML标签替换为任意字符串\n\n### 只复制新行\n\n仅复制新`PRINT`的行\n\n### 画面清除的同时清除剪贴板与历史记录\n\n重启或返回标题时清除剪贴板和复制用缓冲区\n\n### 鼠标左键单击时\n\n左键单击时进行复制\n\n### 转动鼠标滚轮时\n\n鼠标滚轮单击时进行复制\n\n### 双击鼠标左键时\n\n双击时进行复制\n\n### WAIT时\n\n执行[`WAIT`](../Reference/WAIT.zh.md)时进行复制\n\n### INPUT时\n\n执行[`INPUT`](../Reference/INPUT.zh.md)时进行复制\n\n### 复制到剪贴板的行数\n\n功能触发时指定粘贴到剪贴板的行数\n\n### 总缓冲大小\n\n指定保存粘贴到剪贴板的文章的最大缓冲区大小\n\n### 滚动行数\n\n一次滚动操作中回溯到剪贴板的复制范围的行数\n\n### 剪贴板更新间隔(毫秒)\n\n指定剪贴板更新间隔\n\n### 使用RIKAICHAN\n\n所有功能均为EM+EE新增功能，是关于日语→英语弹出翻译功能的配置\n要启用功能，需在`RIKAICHAN文件路径`中指定适当的翻译语言文件（已随EmueraEM+EE附带）\n\n设置为`YES`以启用弹出词典\n\n### RIKAICHAN文件路径\n\n以相对路径指定用于弹出词典的语言文件\n\n### 弹出背景色\n\n更改弹出框的背景色\n\n### 弹出文字色\n\n更改弹出框的文字色\n\n### 高亮翻译中的词语\n\n用框高亮显示正在翻译的词语"
  },
  {
    "id": "Emuera/debug",
    "sourcePath": "docs/Emuera/debug.zh.md",
    "title": "调试模式",
    "names": [],
    "signatures": [],
    "summary": "调试模式是在ver 1.750中新增的模式。",
    "body": "# 调试模式\n调试模式是在ver 1.750中新增的模式。\n此功能与`使用调试命令`选项无关。\n\n## 以调试模式启动Emuera\n要以调试模式启动Emuera，需要在命令行参数中传入`-Debug`。\n\n传递命令行参数的简单方法是，\n右键点击`EmueraXXXX.exe`，选择`创建快捷方式`，\n右键点击创建的快捷方式，选择`属性`，\n在属性中`目标`字符串的末尾加上` -Debug`。\n（如果目标为`\"C:\\～～\\EmueraXXX.exe\"`这样被`\"\"`包围的情况，请在`\"`后面加上` -Debug`）\n双击快捷方式即可以调试模式启动。\n\n## 调试模式下的动作\n以调试模式启动时会自动创建名为`debug`的文件夹。\n后述的变量监视列表和调试控制台日志都会保存在`debug`文件夹中。\n\n调试模式时除了通常执行的行外，还会执行以`;#;`开头的行、`[IF_DEBUG]～[ENDIF]`之间的行。\n非调试模式时这些行会被当作注释处理，不执行。\n相反，调试模式时，`[IF_NDEBUG]～[ENDIF]`之间的行会被当作注释处理，不执行。\n\n\t\t;#;PRINTL 这一行仅在调试模式时执行。\n\t[IF_DEBUG]  `\n\t\tPRINTL 这一行仅在调试模式时执行。\n\t[ENDIF]\n\t[IF_NDEBUG]\n\t\tPRINTL 这一行仅在非调试模式时执行。\n\t[ENDIF]\n\n另外，有一些仅在调试模式下才有效的指令。\n`DEBUGPRINT`、`DEBUGPRINTFORM`、`DEBUGPRINTL`、`DEBUGPRINTFORML`指令具有与`[PRINT](../Reference/PRINT.zh.md)`指令相同的功能，但输出目的地是调试窗口。\n`ASSERT`指令在参数为0时产生错误。参数非0时什么都不做。\n`DEBUGCLEAR`指令清除调试窗口的所有文字。没有参数。\n这些指令在非调试模式时什么都不做。\n由于也不解析参数，即使`DEBUGPRINTFORM`格式错误，在非调试模式时也不会发生任何事情。\n这些指令只是被当作什么都不做的指令，而不是注释行，所以即使在`[SIF](../Reference/IF.zh.md)`指令后直接使用也是安全的。\n\n另外，变量`__FILE__`, `__LINE__`, `__FUNCTION__`仅在调试时返回有意义的值。\n非调试模式时返回0或空字符串。\n\n## 调试窗口\n调试模式时可以打开调试窗口\n请从菜单的调试中打开，或在控制台输入`@DEBUG`。\n另外，也可以在主控制台使用快捷键`Ctrl+D`打开调试窗口。\n根据配置选项，启动时调试窗口可能会自动打开。\n\n调试窗口尺寸可变。请根据用途调整尺寸。\n调试窗口的初始尺寸和初始位置可以从设置对话框的`调试`项更改。\n打开调试窗口状态下打开设置对话框，可以获得当前的尺寸和位置。\n\n调试窗口中显示的信息可以通过调试窗口内的标签切换。\n信息会在调试窗口获得焦点或切换标签等时候更新。\n另外，也可以通过主控制台的快捷键`Ctrl+R`更新信息，\n还可以使用`DEBUGCLEAR`指令清除所有文字。\n\n### 控制台\n调试用控制台。\n是`DEBUGPRINT`或`DEBUGPRINTFORM`等的输出目的地。\n另外，主控制台输出的信息中，错误和警告等也会输出到调试控制台。\n可以从最下方的文本框输入调试命令。\n与主控制台的调试命令不同，不需要在开头加上`@`。\n即使`使用调试命令`选项为NO，此功能也有效。\n另外，`MASTER`的名称也不会变成作弊。\n\n### 变量监视\n请点击写着`对象`的列附近下边。应该会进入编辑模式。\n在这里输入像`TALENT:MASTER:2`、`NAME:TARGET`这样的想了解值的变量名，就会在`值`项显示值。\n值获取过程中发生错误时，会显示错误内容。\n要删除对象时，请编辑对象使其成为空字符串。\n在变量监视更新时，该行会被删除。\n添加到变量监视的对象在关闭调试窗口时会被保存，在打开时被读取。\n如果想在其他时间进行保存/读取，请从菜单的文件进行保存/读取。\n\n勾选`锁定`列复选框后，该行的`值`被固定为实际值，之后调试窗口**每 200ms**（仅在游戏未执行中的安全时机）自动把该值写回变量——变量被脚本改动后，也会在数周期内被拉回固定值，便于隔离验证。\n表达式、函数、常量、只读变量等不可赋值的对象，勾选时会显示错误且不会锁定。\n锁定状态只在当前会话内有效，不会被保存；取消勾选后停止写回，恢复实时刷新。\n在游戏开始初期、读取存档之前等值尚未确定的时机，建议先不锁定，等值正常后再锁定。\n\n单击、双击`对象`单元格，或按 F2 键，可以编辑表达式。\n\n单击、双击`值`单元格也可以编辑，确认后执行`对象 = 输入值`的赋值。\n赋值与调试控制台走同一执行路径，仅可赋值变量（变量、数组元素等）有效。\n表达式、函数、常量或只读变量等无法赋值的对象，错误信息会显示在`值`单元格。\n游戏执行中与调试控制台一样不会执行赋值。\n\n`对象`不仅可以使用变量，还可以使用常量和表达式，但调用表达式函数时请注意。\n变量监视每次更新值时都会实际调用该表达式函数。\n如果被调用的表达式函数有改变其他变量等副作用，在变量监视更新时副作用会发生。\n\n### 堆栈跟踪\n是正在调用的函数的信息。\n最上面是当前函数，下面是调用当前函数的函数、调用该函数的函数，以此类推。"
  },
  {
    "id": "Emuera/debugCom",
    "sourcePath": "docs/Emuera/debugCom.zh.md",
    "title": "调试命令",
    "names": [],
    "signatures": [],
    "summary": "※默认情况下无法使用调试命令。",
    "body": "# 调试命令\n※默认情况下无法使用调试命令。\n如有需要，请在帮助的设置中勾选`使用调试命令`。\n\n**※此功能是调试模式尚未出现版本的简易功能。**\n**建议现版本调试使用调试模式启动。**\n\n在脚本执行中（游戏中），输入以`@`开头的字符串时会作为调试命令接收。\n是否区分大小写取决于`emuera.config`中的`忽略大小写差异`设置。\n\n调试命令使用与ERB相同的格式指定。\n例如，\n\n\t@MONEY = 10000\n\t@PRINTV FLAG:200\n\t@PRINTFORM %NAME:MASTER%的CFAG(1) = {CFLAG:MASTER:1}\n\t@ADDCHARA 1\n\n可以这样书写。\n另外，仅输入变量或表达式时，会输出它们的值\n（下面@后面的半角空格不是必需的）\n\n\t@ FLAG:200\n\t@ @\"%NAME:MASTER%的CFAG(1) = {CFLAG:MASTER:1}\"\n\n但是无法使用改变脚本流程的指令如`[IF](../Reference/IF.zh.md)`、`[CALL](../Reference/CALL.zh.md)`，以及要求输入的指令如`[INPUT](../Reference/INPUT.zh.md)`、`[WAIT](../Reference/WAIT.zh.md)`。\n\n还有一些ERB中没有的指令。\n\n\t@REBOOT\n\n重新启动并重新读取`emuera.config`、csv和erb文件。\n\n\t@OUTPUT\n\n将当前日志输出到`emuera.log`。如果已存在则会覆盖。\n这与`OUTPUTLOG`指令相同操作。\n\n\t@EXIT\n\n退出Emuera。与`[QUIT](../Reference/QUIT.zh.md)`指令相同操作。\n\n\t@CONFIG\n\n打开设置对话框。\n\n\t@DEBUG\n\n打开调试对话框。这仅在以调试模式启动时有效。\n\n除上述外，即执行普通ERB指令时，MASTER的姓名和称呼名会被强制改为`作弊`。\n这是因为调试命令也具有作弊的性质，为防止滥用而采取的措施。"
  },
  {
    "id": "Emuera/differences_of_Emuera_and_eramaker",
    "sourcePath": "docs/Emuera/differences_of_Emuera_and_eramaker.zh.md",
    "title": "与eramaker的差异点",
    "names": [],
    "signatures": [],
    "summary": "在eramaker中，如果数组的最后一个元素不是0，加载时数据会被破坏。",
    "body": "# 与eramaker的差异点\n## Bug和不自然动作的修复\n### 数组最后一个元素无法使用\n在eramaker中，如果数组的最后一个元素不是0，加载时数据会被**破坏**。\nEmuera中不会出现这个问题。\n这个问题是由于eramaker中保存和加载机制不统一导致的，而Emuera统一使用了保存时的机制。\n因此，用eramaker保存并用Emuera加载不会出现问题，但用Emuera保存并用eramaker加载时会重现此问题。\n\n### 单目运算符`-`的异常\neramaker中存在`-100 < 0`为假等问题。\nEmuera中不会出现这个问题。\n\n### 文件最后一行无法读取\neramaker会忽略没有换行符的行。\n也就是说，无论是CSV还是ERB，文件的最后一行都会被忽略。\nEmuera不会重现这种行为。\n\n### 数组有多余元素时被忽略\n\n\tA:1:2 = 34\n\n上述表达式在eramaker中会将`34`赋值给`A:1`。\nEmuera会将其视为错误。\n\n### 数组调用时特定格式无法使用\neramaker中可以使用`A:0`或`A:(COUNT+1)`这样的变量用法。\n然而，对于二维数组变量，写成`ABL:0:2`或`TALENT:(COUNT+1):2`这样的格式时会出错。\n此外，在调用字符串变量时省略参数可能导致错误。\nEmuera不会出现这个问题。\n二维数组参数无论是常数还是表达式都不会出错，字符串变量的参数也可以省略。\n\n### CSV中异常数值当作整数处理\n\n\t0,罗塔,200\n\t0xFF,路由,200\n\n如果上述内容出现在`Item.csv`中，eramaker会将`0xFF`解释为`0`，并定义`TALENT:0`为路由。\nEmuera不会重现这种情况，而是报错并使此定义无效，`TALENT:0`将被定义为罗塔。\n\n### 不自然的记号能正常运行\n\n\tA:0:1:99999 +-RESULTS:0=@=+123|*?=Y\n\n上述表达式在eramaker中可以运行。\nEmuera会将其视为错误。\n\n## 其他与eramaker运行不同的地方\n[`SIF`](../Reference/IF.zh.md)后直接是空行或注释行等情况\n\n对于如下脚本：\n\tSIF 条件\n\t\t;注释\n\t\tPRINT hogehoge\n\neramaker总是执行[`PRINT`](../Reference/PRINT.zh.md)行。\n因为eramaker认为`SIF`的下一行是\";注释\"。\n\nEmuera与吉里吉里等一样，只在条件为真时执行`PRINT`行。\nEmuera将空行和注释行完全当作不存在，认为`SIF`的下一行是`PRINT hogehoge`。\n此外，eramaker中可以在`SIF`后放置[`IF`](../Reference/IF.zh.md)语句或REPEAT语句，但这通常会导致与作者意图不同的行为，因此Emuera限制了可以放在`SIF`后的内容。\n\n### 省略`IF`、`ELSEIF`等参数时的动作\neramaker中省略`IF`、`ELSEIF`或赋值语句的参数时，动作会不确定。\n不过，省略[`RETURN`](../Reference/RETURN.zh.md)参数时为`RETURN 0`。\nEmuera总是将省略的参数解释为`0`，因此`IF`以下永远不执行，但会被警告。\n\n### 函数名可使用的字符\neramaker中符号、全角字符等所有字符都可以使用。\nEmuera中也可以使用全角字符，但除了`_（下划线）`以外的符号不能使用。\n此外，Emuera不建议函数名以半角数字开头。\n以下脚本在eramaker中可以运行，但在Emuera中会报错。\n\n\tCALL \\.,)(][+-%*　@&$\n\n\t@\\.,)(][+-%*　@&$\n\tPRINTL 函数@\\.,)(][+-%*　@&$被调用。\n\tRETURN 0\n\nEmuera中，如果函数名包含\",\"或\"(\"，会被误认为是函数参数。\n另外，如果函数名包含\"@\"或运算符符号等，`LOCAL@函数名`这种调用方式就无法正常工作。\n包含\"{}\"或\"%\"时，`CALLFORM`调用会受阻。\n因此，Emuera与C#、吉里吉里等许多编程语言一样，禁止在函数名中使用符号。\n在ver 1.721中，这只是警告级别1，并不会立即错误终止，但可能会出现意外行为。\n另外，如果函数名以半角数字开头，则无法作为`表达式中可使用的函数`(in_expression_functions.zh.md)调用。\n因为在表达式中，会根据第一个字符判断是数字还是变量/函数。\n\n### `RAND`的规格\n\n\tA = RAND:X\n\n关于这一点，eramaker中当`X`为`0`时返回`0`。\n其他情况下，返回`(0～32767的随机数) % (X的绝对值)`。\n这种方式即使X为负值也能运行，不会返回`32767`以上的值，当`X`超过1000左右时值的偏差变得不可忽视。\n\nEmuera不会重现这些特性。\nEmuera返回`(0～18446744073709551615的随机数) % (X)`。\n当`X`为`0`或负值时，Emuera会产生错误。\n（基于官方说明中\"RAND:A返回的是0到A-1之间的整数\"的描述，为了保持返回值的一致性）\n此外，`X`的有效范围是`1～9223372036854775807`（64位有符号整数的正值范围）。\n只要X在100万亿以下，几乎不会有明显的偏差。\n\n### `WAIT`的规格\neramaker中执行[`WAIT`](../Reference/WAIT.zh.md)指令时不换行，按Enter键时才换行。\nEmuera中执行`WAIT`指令时如果光标在行中间则会换行，而在\"按Enter键\"、\"左键单击\"等操作时不换行。\n\n### `JUMP`的规格\neramaker中无法从通过[`CALL`](../Reference/CALL.zh.md)调用的函数中执行[`JUMP`](../Reference/JUMP.zh.md)。\nEmuera中即使是被`CALL`调用的函数也可以执行`JUMP`。\n在`JUMP`目标处执行[`RETURN`](../Reference/RETURN.zh.md)时，与从`JUMP`源函数返回时动作相同。\n\n**示例**\n\n\tCALL FOOBAR\n\n\t@FOO\n\tPRINTL 函数@FOO\n\tJUMP BAR\n\t@BAR\n\tPRINTL 函数@BAR\n\tRETURN 0\n\t@FOOBAR\n\tPRINTL 函数@FOOBAR\n\tCALL FOO\n\tPRINTW 返回到函数@FOOBAR\n\n**执行结果**\n**eramaker（错误）**\n\n\t试图从CALL调用的函数中执行JUMP函数\n\n**Emuera**\n\n\t函数@FOOBAR\n\t函数@FOO\n\t函数@BAR\n\t返回到函数@FOOBAR\n\n### CALLNAME的规格\neramaker中引用`CALLNAME`时，如果`CALLNAME`为空字符串，则返回`NAME`的值。\nEmuera中如果`CALLNAME`为空字符串则返回空字符串。\n\n为了弥补这个差异，Emuera提供了`当CALLNAME为空字符串时代入NAME`选项。\n当此选项为`YES`时，如果在`chara*.csv`中未设置`CALLNAME`或设置为空字符串，则当作与`NAME`相同字符串处理。\n不过，即使使用此选项也不能完全重现。\n例如，将eramaker中添加角色的存档数据在Emuera中读取时，可能会出现不同的行为。\n\n### `PRINTFORM`等`FORM`的展开\neramaker会重复展开直到没有可展开的内容为止。\n如果有自引用或循环引用，会导致程序冻结。\nEmuera只展开一次。\neramaker的展开大概是按以下方式进行的。\n\n\tstr = 要展开的字符串\n\twhile(str中包含{～～})\n\t\t展开最左边的{～～}\n\twhile(str中包含%～～%)\n\t\t展开最左边的%～～%\n\twhile(str中包含***)\n\t\t展开最左边的***\n\twhile(str中包含$$$)\n\t\t展开最左边的$$$\n\twhile(str中包含+++)\n\t\t展开最左边的+++\n\twhile(str中包含///)\n\t\t展开最左边的///\n\twhile(str中包含===)\n\t\t展开最左边的===\n\n因此，eramaker中可以做到以下事情。\n\n**示例**\n\n\tSTR:1 = S1%STR:2%3%4%\n\tSTR:2 = S2%STR:\n\tSTR:3 = S3%STR:\n\tSTR:4 = S4\n\tPRINTFORMSL STR:1\n\tPRINTFORML %STR:1%\n\tDRAWLINE\n\n**结果**\n\n\t;S1S2S3S4\n\t;S1S2S3S4\n\nEmuera不会重现这种情况。\n\n### EVENT函数的属性\neramaker中事件函数的调用如下进行。\n\n\tforeach(#PRI标注的函数)\n\t{\n\t\t函数调用\n\t\tif(#SINGLE且返回值为1)\n\t\t\tbreak;\n\t}\n\tforeach(既没有#PRI也没有#LATER标注的函数)\n\t{\n\t\t函数调用\n\t\tif(#SINGLE且返回值为1)\n\t\t\tbreak;\n\t}\n\tforeach(#LATER标注的函数)\n\t{\n\t\t函数调用\n\t\tif(#SINGLE且返回值为1)\n\t\t\tbreak;\n\t}\n\n同时标注了`#PRI`和`#LATER`的事件函数会被调用两次。\n`#SINGLE`仅在返回值为`1`时才中断后续函数调用。\n此外，`#SINGLE`引起的函数调用中断是按`#PRI`或`#LATER`组合分别进行的。\n从ver1.800（开发版包括1.756alpha018）开始，Emuera准确重现了这种行为。\n\n更早的Emuera中，事件函数的调用如下进行。\n根据`#PRI`、`#LATER`对函数列表排序\n\n\tforeach(所有函数)\n\t{\n\t\t函数调用\n\t\tif(#SINGLE且返回值为1)\n\t\t\tbreak;\n\t}\n\n同时标注`#PRI`和`#LATER`时，会当作两者都没标注一样处理。\n`#SINGLE`中断函数调用时，无论有无`#PRI`、`#LATER`，该事件函数的调用都会结束。\n\n顺便说一下，Emuera1.751b之前，`#SINGLE`会在返回值非0时中断后续函数调用。\n这在1.752中得到了修正，当前版本中与eramaker一样，只在返回值为1时中断后续函数调用。\n\n### `gamebase.csv`\"代码\"的读取方式\n当在[`gamebase.csv`](../eramaker/CSV_format.md#gamebasecsv)的代码中写入超出eramaker可处理数字范围`-2147483648～2147483647`的数值时，\neramaker会将csv中的值转换为十六进制，并取其后8位作为游戏代码。\n例如，`代码,08231000181818110`的情况下，游戏代码会变为`301712126`，变成eramaker可处理的范围。\n\nEmuera不会重现这种行为。\nver1.803以前的Emuera中，`代码,08231000181818110`的情况下，游戏代码会变为`0`。\nEmuera可以处理`-9223372036854775808～9223372036854775807`范围的数字，\n但`GAMEBASE_GAMECODE`与eramaker一样，只能处理`-2147483648～2147483647`范围的数字，超出范围时会变为`0`。\n\n此外，从ver1.804开始的Emuera中，`代码,08231000181818110`的情况下，游戏代码会按所写变为`8231000181818110`。\n（`GAMEBASE_GAMECODE`也已改为与其他变量同样处理范围的变量）\n这种情况下，如果像`代码,98231000181818110110`一样，数值超出Emuera可处理的范围，游戏代码会变为`0`。\n另外，从ver1.805开始的Emuera中，即使存档数据的游戏代码为`0`，也可以不受游戏端游戏代码的影响进行加载。\n\n### `abl.csv`等的读取方式\neramaker中可以为索引指定负值或非常大的值，如`99999:技巧`。\n不过，这里指定的编号会在[`PRINT_ABL`](../Reference/PRINT_STATUS.zh.md)等时使用，因此在`PRINT_ABL`时（在eramaker内部）会引用`ABL:99999`，导致错误。\n因此，实用上可用的值与`ABL`或`TALENT`的数组数量相同。\n在`item.csv`中，`SHOP`引用`ITEM`或`ITEMSALES`时也会出错。\nEmuera中无法指定`ABL`等数组范围外的值。\n这样的行会被忽略。\n作为替代，可以通过`VariableSize.csv`改变数组范围。\n\n### train.csv的读取方式\n基本上与其他csv文件相同，但略有不同。\neramaker中即使定义了`XXX,99999`，只要`@COM99999`被定义，就能正常执行。\n另一方面，如果像`YYY,-2`一样定义负值，虽然命令会显示，但选择后什么都不会发生。\n\nEmuera不会重现这种行为。\n可定义的范围为`VariableSize.csv`中指定的`TRAINNAME`大小，其他会被忽略。\n如果没有改变`TRAINNAME`的大小，则有效范围是`0～999`。\n\n### chara*.csv的读取方式\neramaker中，即使`号码`为0以下或1000以上，也能正常执行[`ADDCHARA`](../Reference/ADDCHARA.zh.md)。\nEmuera也是如此。\n\neramaker中，如`基础,0`一样，第三位值是必需的情况下省略该值时，会当作`0`处理。\n另外，如`素质,0,100`一样，第三位值不需要时指定值也会被忽略，变为`1`。\nEmuera不会重现这种行为。\n`基础,0`的话`MAXBASE:0`会变为`1`，`素质,0,100`的话`TALENT:0`会变为`100`。\n\n### 文件换行符\neramaker中，将`[CR][LF]`和`[LF]`当作换行符，但只有`[CR]`时不会被当作换行符，会出现各种错误行为。\nEmuera不会重现这种行为，只有`[CR]`时也视为换行。\n\n## 未修复的Bug和不自然行为\n### 文件读取顺序依赖于文件系统\neramaker basic中，多重定义的函数在被[`CALL`](../Reference/CALL.zh.md)调用时等，动作依赖于文件读取顺序。\n然而，由于eramaker的文件读取顺序依赖于文件系统，可能不会按预期运行。\nEmuera中也会重现这个问题。\n目前公开的许多脚本都假设文件系统是NTFS，如果文件系统是FAT则无法正常运行。\n\n### REPEAT-REND结束时COUNT递增\neramaker中，从[`REPEAT-REND`](../Reference/REPEAT.zh.md)退出时`COUNT`会+1。\n即使是用`BREAK`退出也会+1。\nEmuera会重现这种行为。\n`FOR-NEXT`结构中同样会对循环变量+1。\n请注意，这与一般编程语言的`for`结构和`break`语句动作不同。\n\n### NEXTCOM的动作\neramaker中`NEXTCOM`的初始值是-1，但`NEXTCOM`执行后被赋的值不是-1而是0。\n因此，除非ERB侧再次赋值，否则会一直重复`COM0`。\n另外，eramaker的官方说明中并未记载`NEXTCOM`的存在。\nEmuera也会重现这种行为。\n`NEXTCOM`功能仅为与eramaker兼容而重现，不推荐使用。\n对于不打算在eramaker中运行的代码，建议考虑使用`DOTRAIN`或`CALLTRAIN`指令。\n\n## 修改的功能\n### SP角色\neramaker中，csv中`CFLAG:0`被设置为非0的角色是SP角色。\n需要通过[`ADDCHARA`](../Reference/ADDCHARA.zh.md)注册，而不能用`ADDCHARA`注册，这有点难以理解。\n此外，无意中将`CFLAG:0`设置为非0，导致无法用`ADDCHARA`注册，这也是造成bug的原因之一。\n从ver 1.816开始，Emuera决定默认不支持此功能。\n`CFLAG:0`不再特殊处理，所有角色都可以通过`ADDCHARA`注册。\n虽然可以通过兼容性选项\"使用SP角色\"重现eramaker的动作，但不推荐将其用于除运行旧脚本以外的目的。\n\n<!--\n## 新增功能\n参考Emuera中新增的扩展语法\n-->"
  },
  {
    "id": "Emuera/ERH",
    "sourcePath": "docs/Emuera/ERH.zh.md",
    "title": "头文件",
    "names": [],
    "signatures": [],
    "summary": "在ERB文件夹中，除了扩展名为ERB的文件外，还可以放置扩展名为ERH的文件。",
    "body": "# 头文件\n在ERB文件夹中，除了扩展名为ERB的文件外，还可以放置扩展名为ERH的文件。\nERH文件中应写入需要在ERB之前处理的内容。\n具体来说，就是用`#DIM`和`#DIMS`定义全局变量和用`#DEFINE`定义宏。\n在头文件中不能写入`#DIM`、`#DIMS`和`#DEFINE`以外的行。\n\nEmuera会读取ERB文件夹中的所有`*.ERH`文件。\n处理顺序是`csv文件夹内的文件`→`*.ERH`→`*.ERB`，所以ERH的效果不会影响CSV文件夹内的内容。\n相反，`_rename.csv`的替换也会应用到`*.ERH`。\neramakerEX不会对`*.ERH`应用`_rename.csv`，因此使用ERH文件会失去与`eramakerEX`的兼容性。\n\n## 全局变量的声明\n※请同时参考用户定义的变量。\n\n头文件中可以声明新变量。\n这与在ERB中声明的私有变量不同，成为可以在ERB中所有地方引用的全局变量。\n与私有变量不同，没有`DYNAMIC`、`STATIC`的区别，也不能声明使用`REF`的引用型变量，但可以像平常一样声明使用`CONST`的常量。\n可声明的变量最多可定义三维数组。\n如果不指定元素数，将成为元素数为1的数组，可以像非数组变量一样使用。\n变量声明按如下方式使用`#DIM`或`#DIMS`进行。\n例如，`#DIM HOGE,1,2`会成为二维数组。\n\n\t<*.ERH>\n\t\t#DIM MY_INT\n\t\t#DIM MY_INT_ARRAY, 100\n\t\t#DIMS MY_STR\n\t\t#DIMS MY_STR_ARRAY, 100\n\n在ERH中按上述方式定义后，在ERB中可以如下使用变量：\n\n\t<*.ERB>\n\t\tMY_INT = 100\n\t\tMY_INT_ARRAY:10 = MY_INT_ARRAY:10 + 45\n\t\tMY_STR = 哎呀呀\n\t\tPRINTFORML {MY_INT_ARRAY:10} %MY_STR%\n\n`#DIM`变量声明的元素数指定除了数值外，也可以用常量表达式指定。\n但请注意，与`*.ERB`中的`#DIM`不同，宏不会展开。\n\n### `SAVEDATA` 关键字\n\n在变量声明时添加`SAVEDATA`关键字可以声明可保存的变量。\n但是，使用`SAVEDATA`关键字声明可保存的多维变量时，选项`以二进制格式保存存档数据`必须启用。\n\n\t<*.ERH>\n\t\t#DIM SAVEDATA MY_INT_ARRAY, 100\n\t\t#DIMS SAVEDATA MY_STR_ARRAY, 100\n\n这样声明后，`MY_INT_ARRAY`、`MY_STR_ARRAY`的内容会与`DAY`、`MONEY`等现有变量一样被保存和加载。\n换句话说，没有添加`SAVEDATA`关键字声明的变量不会被保存，加载时会被初始化。\n\n### `CHARADATA` 关键字\n在变量声明时添加`CHARADATA`关键字可以声明角色变量。\n`CHARADATA`可以与`SAVEDATA`关键字同时使用。\n\n\t<*.ERH>\n\t\t#DIM CHARADATA C_INT_ARRAY, 100\n\t\t#DIMS CHARADATA C_STR_ARRAY, 100\n\t\t#DIM CHARADATA SAVEDATA CS_INT_ARRAY, 100\n\n上面的例子中，`C_INT_ARRAY`、`C_STR_ARRAY`是角色变量，但不会被保存加载。\n`CS_INT_ARRAY`既是角色变量，也进行保存和加载。\n\n### `GLOBAL` 关键字\n在变量声明时添加`GLOBAL`关键字可以声明全局变量。\n`GLOBAL`可以与`SAVEDATA`关键字同时使用。\n\n\t<*.ERH>\n\t\t#DIM GLOBAL G_INT_ARRAY, 100\n\t\t#DIMS GLOBAL G_STR_ARRAY, 100\n\t\t#DIM GLOBAL SAVEDATA GS_INT_ARRAY, 100\n\n全局变量在通常的保存加载时既不会加载也不会初始化。\n由于这个特性，可以在不同的存档数据之间共享数据。\n当同时使用`GLOBAL`和`SAVEDATA`关键字时，将成为通过`SAVEGLOBAL`、`LOADGLOBAL`指令读写`global.sav`文件的变量。\n\n其他关于初始值、常量化等详细信息请参考用户定义的变量。\n\n## 宏的定义\n这里所说的宏是将ERB代码中的字符串替换为预先定义的另一字符串的功能。\n虽然名为宏，但与Emuera运行中`F1～F12键`可用的键盘宏无关。\n此功能参考了C或C++的`#define`。\n在ERH文件中定义宏后会应用于所有ERB文件内的代码。\n\n### 基本用法\n宏通常定义如下：\n\n\t<*.ERH>\n\t\t#DEFINE <替换源标识符> <替换后表达式>\n\n这样在ERB中<替换源标识符>会被替换为<替换后表达式>。例如，在.ERH中\n\n\t<*.ERH>\n\t\t#DEFINE FIVE 5\n\n预先定义后，.ERB中的FIVE字符串将被替换为5。例如\n\n\t<*.ERB>\n\t\tX = FIVE\n\n展开为\n\n\t(展开后)\n\t\tX = 5\n\n宏也可以添加行末注释。\n分号以后的部分会被忽略为注释。\n分号以后的部分不会包含在宏中，也不会被展开。\n\n\t<*.ERH>\n\t\t#DEFINE FIVE 5 ;注释\n\t<*.ERB>\n\t\tX = FIVE + FIVE\n\t(展开后)\n\t\tX = 5 + 5\n\n请注意宏的展开几乎是直接进行字符串替换。\n\n\t<*.ERH>\n\t\t#DEFINE SIX       1 + 5\n\t\t#DEFINE NINE      8 + 1\n\t<*.ERB>\n\t\tX = SIX * NINE\n\n你可能以为`X`会被赋值为`6*9`，也就是36，但实际上展开为\n\n\t(展开后)\n\t\tX = 1 + 5 * 8 + 1\n\n所以乘法优先，结果是`X = 42`。\n\n宏可以展开为`\"～～\"`等常量字符串，也可以是变量、函数、表达式。\n只要认为`#DEFINE`右侧的字符串直接展开，大致就能理解。\n\n\t<*.ERH>\n\t\t#DEFINE HOGE    \"霍格霍格\"\n\t\t#DEFINE PIYO    A\n\t\t#DEFINE FUGA    DA:10\n\t\t#DEFINE HOGERA    LOCAL + MY_FUNC(X, Y)\n\t<*.ERB>\n\t\tX = STRLEN(HOGE)\n\t\tY = PIYO + 5\n\t\tFUGA:20 += PIYO\n\t\tLOCAL = HOGERA\n\n\t\t@MY_FUNC(ARG, ARG:1)\n\t\t#FUNCTION\n\t\t\t～略～\n\t(展开后)\n\t\tX = STRLEN(\"霍格霍格\")\n\t\tY = A + 5\n\t\tDA:10:20 += A\n\t\tLOCAL = LOCAL + MY_FUNC(X, Y)\n\n\t\t@MY_FUNC(ARG, ARG:1)\n\t\t#FUNCTION\n\t\t\t～略～\n\n由于宏按字符串直接展开，替换后可以不是完整的表达式，而是运算符或表达式的一部分。\n但不推荐这样使用。\n若不小心使用，会严重损害代码的可读性。\n\n\t<*.ERH>\n\t\t#DEFINE PLUS     +\n\t\t#DEFINE FIVEPLUS   5 +\n\t<*.ERB>\n\t\tX = 1 PLUS 2\n\t\tY = FIVEPLUS 2\n\t(展开后)\n\t\tX = 1 + 2\n\t\tY = 5 + 2\n\n### 宏的多重展开\n可以定义包含宏的宏。这样的宏在ERB加载时会反复展开，直到无法再应用宏为止。\n\n\t<.ERH>\n\t\t#DEFINE FIVE_1 5\n\t\t#DEFINE FIVE_2 FIVE_1 + FIVE_1\n\t\t#DEFINE FIVE_3 FIVE_2 + FIVE_2\n\t<.ERB>\n\t\tX = FIVE_3\n\t(展开后)\n\t\tX = 5 + 5 + 5 + 5\n\n即使重复展开一定次数后宏仍然存在，Emuera会认为是自引用或循环引用宏而停止处理并报错。\n请注意不要创建如下自引用或循环引用的宏。\n\n\t<.ERH>\n\t\t#DEFINE HOGE HOGE\n\t\t#DEFINE PIYO FUGA + 1\n\t\t#DEFINE FUGA PIYO + 2\n\t<.ERB>\n\t;会出错\n\t\tX = HOGE\n\t\tY = PIYO\n\n### 预处理器\n可以根据宏是否定义来决定执行多行或分支。\n`[IF XXX]`行和`[ENDIF]`行之间的行只在`XXX`被`DEFINE`时执行。例如如下使用\n\n\t<*.ERB>\n\t\t[IF HOGE]\n\t\t\tPRINTL HOGE被定义了\n\t\t[ELSEIF PUYO]\n\t\t\tPRINTL HOGE未被定义\n\t\t\tPRINTL PUYO被定义了\n\t\t[ELSE]\n\t\t\tPRINTL HOGE和PUYO都未被定义\n\t\t[ENDIF]\n\n为此目的，也可以定义空宏（没有替换目标的宏）。\n\n\t<*.ERH>\n\t\t#DEFINE HOGE\n\n同样的用途，EM+EE也可以使用[`ISDEFINED`](../Reference/ISDEFINED.zh.md)\n\n### 宏的限制\n宏展开基本只在表达式中进行。\n\n\t<*.ERH>\n\t\t#DEFINE FIVE 5\n\t<*.ERB>\n\t\tPRINT FIVE\n\n只是打印`FIVE`字符。这与`PRINT X`只打印`X`字符而不打印`X`的值是一样的。\n\n宏的替换目标不能是赋值运算符，也不能包含赋值运算符的表达式。以下宏定义会报错。\n\n\t<*.ERH>\n\t;会出错\n\t\t#DEFINE HOGE =\n\t\t#DEFINE PUGE X = 1\n\n虽然说宏的替换目标可以是表达式的一部分，但括号对应必须在宏内部完成。以下宏定义会报错。\n\n\t<*.ERH>\n\t;会出错\n\t\t#DEFINE HOGE ( X +\n\t\t#DEFINE PUGE Y )\n\t<*.ERB>\n\t\tZ = HOGE PUGE\n\n宏的替换目标不能是指令。以下宏定义会报错。\n\n\t<*.ERH>\n\t\t#DEFINE MY_PRINTL   PRINTL\n\t<*.ERB>\n\t\tMY_PRINTL 这是PRINTL\n\t(展开后)\n\t\t;会出错\n\n如前所述，宏只应用于`*.ERB`，不应用于`*.csv`和`*.ERH`。\n此外，在`*.ERB`中，预处理器、属性名和行首符号也不应用宏。\n`[SKIPSTART]`等、`#DIM`或`#FUNCTION`等、`@EVENTFIRST`等的`@`部分，都不在替换范围内。\n例如即使`#DEFINE HOGE SKIPSTART`，`[HOGE]`也不会开始注释。\n但是，即使是以`#`开头的字符串，`#DIM`的变量名等也会被替换。\n例如以下代码\n\n\t<*.ERH>\n\t\t#DEFINE HOGE MY_INT\n\t\t#DEFINE FIVE 5\n\t<*.ERB>\n\t\t@FUNC\n\t\t#DIM HOGE, FIVE\n\t\tHOGE:0 = 10\n\t(展开后)\n\t\t@FUNC\n\t\t#DIM MY_INT, 5\n\t\tMY_INT:0 = 10\n\n会如此展开，所以能正常运行。"
  },
  {
    "id": "Emuera/expression",
    "sourcePath": "docs/Emuera/expression.zh.md",
    "title": "Emuera中新增的语法",
    "names": [],
    "signatures": [],
    "summary": "A = B ;将B赋值给A",
    "body": "# Emuera中新增的语法\n## 行末注释\n\n\tA = B ;将B赋值给A\n\n这样可以在行末插入注释\n不过，也有例外，如[`PRINT`](../Reference/PRINT.zh.md)指令那样参数为简单字符串的指令，不会被注释化，而是被评价为字符串的一部分\n\n\tPRINT foobar;霍格霍格\n\n这种情况下，会`PRINT` `foobar;霍格霍格`\n\n## 行连接\n\n\t{\n\t\tDIM CONST HOGE =\n\t\t\t1,2,3,4\n\t}\n\n这样写会被解释为`#DIM CONST HOGE = 1,2,3,4`\n`{`、`}`行不能有空白字符以外的其他字符\n换行符号的位置会补充半角空格\n也就是说不能在函数名·变量名中间分割行，\n分割`PRINT`等会导致显示字符串中包含换行时的半角空格\n在Emuera的语法解释中，行连接处理在注释解释之前进行\n也就是说\n\n\t{\n\t\t#DIM CONST HOGE =\n\t\t\t1,2,3,4 ;注释\n\t\t\t,5,6,7,8\n\t}\n\n会变成`#DIM CONST HOGE = 1,2,3,4 ;注释 ,5,6,7,8`，\n`,5,6,7,8`被视为行末注释的一部分而被忽略\n\n## 特殊注释行\n### `;!;`\n无论Emuera还是eramaker，以`;`开头的行都被视为注释行，但Emuera将`;!;`开头的行视为有效行而非注释。\n在eramaker中不想执行的语句可以这样写。\n例如，在`@SHOWSHOP`中加入以下脚本可以禁止在Emuera中运行。\n\n\t;!;PRINTW 此脚本无法在Emuera中运行\n\t;!;QUIT\n\n另外，与`[SKIPSTART]`和`[SKIPEND]`一起使用时，可以像以下脚本一样禁止在Emuera以外运行。\n请在不想在Emuera以外执行的语句中使用。\n\n\t;!;[SKIPSTART]\n\tPRINTW 此脚本无法在Emuera以外运行\n\tQUIT\n\t;!;[SKIPEND]\n\n### `;#;`\n以`;#;`开头的行只在调试模式时执行。\n非调试模式时被视为注释行不执行。\n但是，`DEBUG`系列指令原本在非调试模式时就被忽略，所以不需要在行首添加`;#;`。\n同样，调试变量在非调试模式时也为空字符串或0，不用担心出错。\n关于调试模式请参考这里。\n\n## 角色数组\neramaker中可能只为角色创建准备了100个数组。\n因此，即使在`chara3.csv`和`chara03.csv`和`chara3B.csv`中分别定义不同的角色，也只有一个生效。\nEmuera中只要内存允许，可以定义任意多个角色。\n另外，只要是符合`chara*.csv`的，`chara101.csv`、`charaABC.csv`等任何文件都会读取。\n角色注册编号 (NO) 重复，在使用[`ADDCHARA`](../Reference/ADDCHARA.zh.md)或`ADDSPCHARA`时有多个候选时，只有先读取的那个生效。\n\n## 整数类型的值范围\neramaker中可处理的整数是32位有符号整数，即`-2147483648～2147483647`范围。\nEmuera中与吉里吉里一样，处理64位有符号整数，`-9223372036854775808～9223372036854775807`范围的值。\n\n## 数组变量批量赋值\n\n\tA:10 = 1,2,3\n\tDA:0:0 = 1,2,3\n\n像上面这样写时，分别将`1`,`2`,`3`赋值给`A:10`～`A:12`\n像下面这样的多维数组中，分别将`1`,`2`,`3`赋值给`DA:0:0`～`DA:0:2`\n不会在`DA:0:0`～`DA:0:99`之后赋值给`DA:1:0`，而是数组越界引用错误\n不过，复合赋值运算不能使用（不能写`A += 1,2,3`等）。\n另外，对字符串型数组变量赋值使用批量赋值时，必须使用[字符串表达式赋值](#_9)\n\n\t;STR:20被赋值为\"草莓,蜜瓜,蓝色夏威夷\"这样的字符串\n\tSTR:20 = 草莓,蜜瓜,蓝色夏威夷\n\t;分别将\"草莓\"\"蜜瓜\"\"蓝色夏威夷\"赋值给STR:20～STR22\n\tSTR:20 '= \"草莓\", \"蜜瓜\", \"蓝色夏威夷\"\n\n## 使用FORM语法对字符串变量赋值\n对字符串变量赋值时，可以使用与[`PRINTFORM`](../Reference/PRINT.zh.md)相同的形式指定要赋值的字符串。\n\n\tSAVESTR:0 = %RESULTS%\n\n这句中可以将`RESULTS`的内容赋值给`SAVESTR:0`。\n同一语句在eramaker中会将字符串`%RESULTS%`本身赋值给`SAVESTR:0`。\n在Emuera中想将字符串`%RESULTS%`本身赋值时，请如下书写。\n\n\tSAVESTR:0 = \\%RESULT\\%\n\n`\\`符号后面的字符不会被当作系统符号处理。\n想在字符串中包含`\\`符号本身时，请写成`\\\\`\n虽然不太常见，但想让eramaker和Emuera有相同动作时，需要如下书写。\n\n\t;!;SAVESTR:0 = \\%RESULT\\%\n\t;!;[SKIPSTART]\n\tSAVESTR:0 = %RESULTS%\n\t;!;[SKIPEND]\n\n## 使用字符串表达式对字符串变量赋值\n从ver1813开始的Emuera中，新增了可以用赋值运算符`'=`和字符串表达式对字符串变量赋值的功能。\n\n\t;\"STR = あいう\"与之相同\n\tSTR '= \"あいう\"\n\t;\"STR = %TSTR:0%いろは\"与之相同\n\tSTR '= TSTR:0 + \"いろは\"\n\n## 用字符串指定数组变量元素 { #string-array-element }\n以下变量，可以用`*.csv`中定义的字符串作为参数调用。\n关于Emuera新增变量的详细信息，请参阅Emuera新增的扩展语法 - 常量·变量。\n\n\tITEM (item.csv)\n\tITEMSALES (item.csv)\n\tLOSEBASE (base.csv)\n\tBASE (base.csv)\n\tMAXBASE (base.csv)\n\tABL (abl.csv)\n\tTALENT (talent.csv)\n\tEXP (exp.csv)\n\tMARK (mark.csv)\n\tRELATION (chara*.csv)\n\tUP (palam.csv)\n\tDOWN (palam.csv)\n\tPALAM (palam.csv)\n\tJUEL (palam.csv)\n\tGOTJUEL (palam.csv)\n\tSTAIN (stain.csv)\n\tSOURCE (source.csv)\n\tEX (ex.csv)\n\tNOWEX (ex.csv)\n\tTEQUIP (tequip.csv)\n\tEQUIP (equip.csv)\n\tFLAG (flag.csv)\n\tTFLAG (tflag.csv)\n\tCFLAG (cflag.csv)\n\tSTR (strname.csv)\n\tSAVESTR (savestr.csv)\n\t以下是Emuera新增的变量\n\tITEMPRICE (item.csv)\n\tDOWNBASE (base.csv)\n\tCUP (palam.csv)\n\tCDOWN (palam.csv)\n\tTCVAR (tcvar.csv)\n\tTSTR (tstr.csv)\n\tCSTR (cstr.csv)\n\tCDFLAG (cdflag1.csv, cdflag2.csv)\n\tGLOBAL (global.csv)\n\tGLOBALS (globals.csv)\n\n例如，如果`abl.csv`中有`2,技巧`这样的定义，则以下4行含义相同。\n\n\tABL:技巧 += 1\n\tABL:2 += 1\n\tABL:\"技巧\" += 1\n\tABL:(ABLNAME:2) += 1\n\n`RELATION`可以用`NAME`或`CALLNAME`指定。\n同名有多个定义时，优先调用先定义的。\n例如，如果`abl.csv`中有`2,技巧`和`4,技巧`，且`2,技巧`在前面的行中定义，则`ABL:技巧`等同于`ABL:2`。\n字符串也可以是表达式或变量。这种情况下请如下添加()。\n\n\tABL:(RESULTS:0) = ABL:(RESULTS:0) + 1\n\n省略`()`时，可能存在物品名与变量名相同的情况。这种情况下优先使用变量。\n例如，即使`abl.csv`中有`0,罗塔`这样的定义，\n\n\t@HOGE\n\t#DIM 罗塔, 0\n\t罗塔 = 1\n\tPRINTFORML {ABL:罗塔}\n\n这种情况下，会被解释为1号`ABL`而不是0号`ABL`。\n同样，如果物品名是数值，则优先按数值解释。\n例如，如果`abl.csv`中有`0,10`这样的定义，引用`ABL:10`时不会被解释为0号`ABL`而是10号`ABL`。\n这也可以在`chara*.csv`的定义中使用。\n例如，如果`abl.csv`中有`2,技巧`这样的定义，则以下2行含义相同。\n\n\t能力,2,2\n\t能力,技巧,2\n\n不过，不能用于相性(`RELATION`)。\n因为在读取`chara*.csv`阶段，系统还未掌握`chara`的姓名与`NO`的对应关系。\n\n## 格式化字符串（FORM语法）扩展\n在[`PRINTFORM`](../Reference/PRINT.zh.md)等使用的格式化字符串中，可以为`{}`、`%%`指定显示位数（字符数）。\n指定格式为`{变量·表达式等,显示位数, 对齐(LEFT or RIGHT)}`、`%变量、字符串表达式等, 显示位数, 对齐(LEFT or RIGHT)%`。\n字符数按全角字符算2字符计算。\n不足显示位数（字符数）的部分会补充半角空格。\n通常为右对齐，指定关键词`LEFT`则为左对齐。\n指定的显示位数小于原始位数时，按原样显示。\n\n**示例**\n\n\tA = 123456\n\tSTR:0 = あいう\n\tPRINTFORML [{A}]\n\tPRINTFORML [{A,10}]\n\tPRINTFORML [{A,10,LEFT}]\n\tPRINTFORML [%STR:0%]\n\tPRINTFORML [%STR:0,10%]\n\tPRINTFORML [%STR:0,10,LEFT%]\n\tPRINTFORML [{A,2}]\n\tPRINTFORML [%STR:0,2%]\n\n**结果**\n\n\t[123456]\n\t[  123456]\n\t[123456  ]\n\t[あいう]\n\t[  あいう]\n\t[あいう  ]\n\t[123456]\n\t[あいう]\n\n## 在字符串表达式中使用格式化字符串（`FORM`语法）\n在`PRINTS`或用户定义的表达式函数参数等字符串表达式中使用`FORM`语法时会出错。\n因此，在字符串表达式中使用格式化字符串时，与在字符串表达式中使用定字符串时使用`\"～\"`一样，\n使用`@\"～\"`。另外，如果`@\"～\"`中的字符串仅为`\\@～\\@`的三元运算子记述，则可以省略`@\"～\"`直接写成`\\@～\\@`。\n\n**正确示例**\n\n\t;赋值使用FORM语法\n\tSTR:0 = あいう\n\t;加法使用字符串表达式\n\tRESULTS += STR:0\n\t;字符串表达式中使用定字符串示例\n\tRESULTS += \"えお\"\n\t;字符串表达式中使用FORM语法示例\n\tPRINTS @\"%RESULTS%かきくけこ\"\n\n\t;以下4行都相同\n\tPRINTS STR:0 + \"！\"\n\tPRINTFORM %STR:0%！\n\tPRINTS @\"%STR:0%！\"\n\tPRINTFORM %STR:0 + \"！\"%\n\n**错误示例**\n\n\t;内容为\"RESULTS\"\n\tSTR:0 = RESULTS\n\t;出错\n\tRESULTS += えお\n\t;出错\n\tRESULTS += %STR:0%\n\t;显示\"@\"和\"\"\n\tPRINTFORM @\"%RESULTS%かきくけこ\"\n\n## `INPUTS`系列中使用宏语法\n在[`INPUTS`](../Reference/INPUT.zh.md)及类似输入接收指令中，可以使用宏表达式。\n关于宏的语法，请参考使用方法中的宏项。\n如果不使用宏语法，单纯将`()`作为字符串使用时，请使用`\\`转义。"
  },
  {
    "id": "Emuera/function#CALLTRAINEND",
    "pageId": "Emuera/function",
    "sourcePath": "docs/Emuera/function.zh.md",
    "localOnly": true,
    "title": "@CALLTRAINEND",
    "names": [
      "@CALLTRAINEND"
    ],
    "signatures": [],
    "summary": "CALLTRAIN自动执行结束后，系统内部自动调用的函数。",
    "body": "`CALLTRAIN`自动执行结束后，系统内部自动调用的函数。\n请注意，这不是事件函数，因此不能多重定义。\n\n### 格式\n\n<!--※1.54u到1.60版本间规格不同！※  -->\n\n**函数侧**\n\n　　　@(函数名),(参数1),{(参数2)....}\n　　　参数为数值时使用ARG(:0,1,2...)，为字符串时使用ARGS(:0,1,2...)\n　　　在函数中使用#DIM、#DIMS定义的私有变量也可以作为参数\n\n**调用侧**\n\n　　　CALL (函数名),(参数1),{(参数2)....}\n\n数值可以使用数值表达式或字符串表达式。\n将字符串字面量（常量）作为参数时，请用`\"\"`括起来。\n将格式化字符串字面量作为参数时，请写成`@\"～～\"`。\n除了[`CALL`](../Reference/CALL.zh.md)外，[`JUMP`](../Reference/JUMP.zh.md)、CALLFORM、TRYCALL等也可以使用相同格式。\n函数侧可以指定任意多个参数。\n截至ver1.808，函数侧和调用侧类型不同时，无论从数值到字符串还是从字符串到数值，都会出错而不是转换。\n如果想像ver1.807以前一样在字符串型参数中传递数值进行调用，请更改配置设置或使用`TOSTR`函数。\n参数可以省略。省略时，数值型参数为0，字符串型参数为空字符串（未设置初始值的情况下）。\n被调用的函数侧可以通过`ARG`和`ARGS`引用传递的值\n基本上是值传递，因此请注意修改`ARG`内容不会改变传递的原始变量等的值。\n也可以将`ARG`、`ARGS`或函数中使用`#DIM`、`#DIMS`定义的私有变量以外的变量（`A`或`STR`）作为参数，但有几个限制。\n截至ver1.808，使用这些变量时无法设置初始值，也不能省略参数。\n\n\t;定义\n\t@FOOBAR, ARG:0, ARGS:0\n\t\t～～\n\t@HOGEHOGE, ARG:0, ARG:1, ARG:2\n\t\t～～\n\t;调用\n\t;用变量指定\n\t\tCALL FOOBAR, X , STR:0\n\t;用常量指定\n\t\tCALL FOOBAR, 123 , \"あいう\"\n\t;用格式化字符串指定\n\t\tCALL FOOBAR, 123 , @\"[{COUNT}] あいう\"\n\t;用表达式指定\n\t\tCALL FOOBAR, X + 10, \"あいう\" * 10\n\t;省略参数-全部\n\t\tCALL FOOBAR\n\t;省略参数-第1参数\n\t\tCALL FOOBAR, , \"あいう\"\n\t;省略参数-第2参数\n\t\tCALL FOOBAR, 123\n\n**<会出错的例子>**\n\n\t;错误(参数过多)\n\t\tCALL FOOBAR, X , STR:0, Y\n\t;错误(参数类型不同-尝试将字符串赋值给数值型第1参数)\n\t\tCALL FOOBAR, \"あいう\", \"かきく\"\n\t;错误(参数类型不同-尝试将数值赋值给字符串型第2参数)\n\t\tCALL FOOBAR, 123 , 456\n\n**<虽然可以运行但不推荐的例子>**\n\n\t;虽然可以不用ARG、ARGS作为赋值目标，但通常建议使用ARG\n\t@FOOBAR, X, Y\n\t;可以将赋值目标设为可变的，但可读性会降低。\n\t@FOOBAR, ARG:X, ARG:Y\n\t;可读性会降低。\n\t@FOOBAR, ARG:0, ARG:(ARG:0)\n\n### 参数初始值\n\n可以为函数参数设置初始值。\n设置初始值时，函数侧如下所示。\n\n\t@(函数名),(参数1 = 初始值1),{(参数2 = 初始值2)....}\n\t参数为数值时使用ARG(:0,1,2...)，为字符串时使用ARGS(:0,1,2...)，\n\t或函数中使用#DIM、#DIMS定义的私有变量\n\t指定其他参数时无法设置初始值。\n\n可指定的初始值仅限常量和常字符串，不能指定变量。\n另外，字符串初始值请用`\"\"`括起来。\n设置初始值且调用侧省略参数时，会赋值为设置的初始值。\n不省略参数调用函数时，与平常一样，`ARG`和`ARGS`会接收到传递的值。\n\n\t;设置初始值（部分省略也可以）\n\t@FUNCTION, ARGS:0 = \"かきく\", ARG:0 = 111, ARG:1, ARG:2 = 200\n\t\t～～\n\n\t;错误(初始值仅限常量和常字符串)\n\t@FOOBAR, ARG:0 = MASTER, ARG:1 = TARGET\n\t;对 ARG、ARGS、#DIM/#DIMS 私有变量以外的参数设置初始值会触发解析错误（ArgCanOnlyPrivVar）。\n\t;初始值请设置在 ARG/ARGS/私有变量上。\n\t@FOOBAR, X = 5, Y = 4\n\n### 参数省略与兼容设置\n\n能否省略参数由**形参类型**决定。`ALLOW ARGUMENTS OMISSION FOR USER FUNCTIONS`（允许省略用户定义函数的所有参数）只影响其中**除 ARG/ARGS/私有变量以外**（全局变量）的形参。\n\n| 形参 | 可省略 | 省略时的值 | 是否受配置影响 |\n|---|---|---|---|\n| `ARG`／`ARGS`／`ARGF`、`#DIM`/`#DIMS` 私有变量（有初始值） | 可 | 初始值 | 否 |\n| 同上（无初始值） | 可 | 数值 `0`／实数 `0.0`／字符串 `\"\"` | 否 |\n| 全局变量（`A`、`STR` 等）且无初始值 | `NO`：不可（`CanNotOmitArg`）／`YES`：可 | `YES` 时不赋值，维持调用前的值（1.807 以前行为） | **是** |\n| 非 `OUT` 的 `REF` 形参 | 不可（`CanNotOmitRefArg`） | — | 否 |\n| `OUT` 的 `REF` 形参 | 可 | 空引用 | 否 |\n\n- 配置名虽叫「所有参数」，实际只影响**全局变量形参（无初始值）**；`ARG`/`ARGS`/私有变量的省略在 `NO` 下也始终合法。\n- 判定由现行 fork 的 `ErbLoader.cs` 的 `canDef` 分支（`ARG`/`ARGS`/`ARGF`/私有变量补 `0`/`0.0`/`\"\"`）与 `Process.CalledFunction.cs` 的 `ConvertArg`（`func.Def[i]` 为 `null` 且配置 `NO` 时报 `CanNotOmitArg`）完成。\n- 初始值只能设置在 `ARG`/`ARGS`/私有变量上；给全局变量形参写初始值会触发 `ArgCanOnlyPrivVar` 解析错误。\n\n```\n@F(ARGS:0 = \"x\", ARG:1)   ; 省略第 2 参时 ARG:1 = 0\n@G(FLAG:0)                ; 配置 NO 时不能省略 FLAG:0\n```\n\n### 参数引用传递\n\n从ver1.810开始，通过在形参中使用引用型变量可以实现参数的引用传递。\n引用型变量的定义方法请参考[引用型变量](user_defined_variables.md#_6)章节。\n\n**<xxx.ERB>**\n\n\t@SYSTEM_TITLE\n\tA = 0\n\tCALL TEST(A)\n\tB = 1\n\tCALL TEST(B)\n\tPRINTFORML A == {A}\n\tPRINTFORML B == {B}\n\tWAIT\n\n\t@TEST(HOGE)\n\t#DIM REF HOGE\n\tHOGE = 100\n\tRETURN\n\n**<执行结果>**\n\n\tA == 100\n\tB == 100\n\n在上面的例子中，函数`@TEST`的形参使用了引用型变量。\n第一次调用`@TEST`时，`HOGE`会引用实参`A`。\n在函数`@TEST`中执行`HOGE = 100`时，引用的目标变量`A`被赋值为`100`，所以第一次`PRINTFORML`的结果是`100`。\n同样，第二次调用`@TEST`时，变量`B`被赋值为`100`，第二次`PRINTFORML`的结果也是`100`。"
  },
  {
    "id": "Emuera/function#DEFINE",
    "pageId": "Emuera/function",
    "sourcePath": "docs/Emuera/function.zh.md",
    "localOnly": true,
    "title": "#DEFINE",
    "names": [
      "#DEFINE"
    ],
    "signatures": [],
    "summary": "DEFINE宏声明。在ERH中使用时，可以将全ERB代码中的字符串替换为预先定义的另一字符串。",
    "body": "DEFINE宏声明。在ERH中使用时，可以将全ERB代码中的字符串替换为预先定义的另一字符串。\n详情请参考头文件（ERH）。"
  },
  {
    "id": "Emuera/function#DIM",
    "pageId": "Emuera/function",
    "sourcePath": "docs/Emuera/function.zh.md",
    "localOnly": true,
    "title": "#DIM",
    "names": [
      "#DIM"
    ],
    "signatures": [],
    "summary": "用户定义变量声明。在ERB中的特定函数内使用，可以定义仅在该函数内使用的数值型变量。",
    "body": "用户定义变量声明。在ERB中的特定函数内使用，可以定义仅在该函数内使用的数值型变量。\n详情请参考用户定义的变量。\n另外，在ERH中使用时，可以定义所有函数间共享值的数值型变量。\n详情请参考头文件（ERH）。"
  }
];
