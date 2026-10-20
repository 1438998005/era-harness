// 本文件由 scripts/build-reference.ts 生成，请勿手工修改。
//
// 数据来源：https://github.com/qirchen421/emuera.sk.doc  docs/Reference/*.zh.md
// 上游版本：606670cd78b58f5d9a050013d1d3f41db5a87a1b
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
    "body": "!!! info \"API\"\n\n    ```erb\n    int CHKCHARADATA filename\n    ```\n    返回 dat 文件夹内由 `chara_*.dat` 表示的文件名所对应的数据信息。\n    如果可以加载则返回 0，如果因某些原因无法加载则返回非 0 值。\n    此外，如果可以加载，则将存档数据的备注赋值给 `RESULTS:0`；如果无法加载，则将原因赋值给 `RESULTS:0`。\n\n!!! hint \"提示\"\n\n    同时支持指令和表达式函数两种形式。\n\n### 相关项目\n- SAVECHARA\n- LOADCHARA"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tint CHKDATA saveID\n    ```\n\t将`saveID`所指定编号的文件数据信息赋值给`RESULT:0`和`RESULTS:0`。\n\t`RESULT:0`可取得以下值。仅在值为`0`时，可以加载该文件。\n\n    - 0 - 该文件可加载。\n    - 1 - 指定文件不存在。\n    - 2 - 游戏代码不匹配。（数据中[gamebase.csv的`代码`](../Emuera/variables.md#gamebasecsv)值不同）\n    - 3 - 版本不匹配。（数据中[gamebase.csv的`版本`](../Emuera/variables.md#gamebasecsv)值不同，且不属于可兼容的版本）\n    - 4 - 文件存在上述之外的其他问题。\n\n    当 `RESULT:0` 为 `0` 时，`RESULTS:0` 会被代入存档数据的注释（在 `@SAVEINFO` 中使用 `PUTFORM` 输入的字符串，或 `SAVEDATA` 的第二个参数）。\n        当 `RESULT:0` 不为 `0` 时，`RESULTS:0` 会被代入诸如 `存档数据的版本不同` 之类的错误信息。\n        另外，`RESULT:1` 会被代入存档数据的版本号。\n        当文件不存在或发生游戏代码不匹配等错误时，其值为 `0`；当版本不匹配或数据正常时，则代入数据内的版本值。\n        另外，如果在调用 `CHKDATA` 时并非处于向 `RESULT:0` 赋值的过程中（例如 `RESULT:0 = CHKDATA(LOCAL)`），\n        则 `RESULT:0` 会被代入存档数据的时间戳（例如，2009年3月28日13时5分23秒678毫秒会表示为 `RESULT = 20090328130523678`）。\n\n!!! hint \"提示\"\n\n    该函数同时支持作为命令和表达式函数使用。\n\n### 相关项目\n- SAVEDATA\n- LOADDATA\n- FIND_CHARADATA"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    CLEARIMAGELAYER depth\n    CLEARIMAGELAYER_ALL\n    ```\n\n    - **CLEARIMAGELAYER**：清除指定 `depth` 的 `SETIMAGELAYER` 图层。\n    - **CLEARIMAGELAYER_ALL**：清除所有 `SETIMAGELAYER` 图层。\n\n    | 参数 | 类型 | 说明 |\n    | :--- | :--- | :--- |\n    | `depth` | int | 要清除的图层深度值 |\n\n    !!! warning \"注意\"\n        - 仅支持命令语法，不支持表达式调用。\n        - `CLEARIMAGELAYER` 清除的图层可通过再次调用 `SETIMAGELAYER` 重新创建。\n        - 这两个命令仅影响 `SETIMAGELAYER` 创建的图层，不影响 `CBGSETSPRITE` 或 `SETBGIMAGE` 创建的背景图。\n\n!!! hint \"提示\"\n\n    仅命令语法可用。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n        SETIMAGELAYER \"pet_1\", 1\n        SETIMAGELAYER \"pet_2\", 2\n\n        ; 清除指定图层\n        CLEARIMAGELAYER 1\n\n        ; 检测是否已清除\n        PRINTVL EXISTSIMAGELAYER(1)\n        PRINTVL EXISTSIMAGELAYER(2)\n\n        ; 清除所有图层\n        CLEARIMAGELAYER_ALL\n    ```\n    ```text\n    0\n    1\n    ```\n\n### 相关项\n- SETIMAGELAYER\n- EXISTSIMAGELAYER"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tCLEARLINE line\n    ```\n\t删除指定行数的字符串（行数的计数方式与`LINECOUNT`相同）。\n\t行数是指从`PRINTL`等命令开始到发生换行为止的内容算作一行。\n\t请注意，即使一个长字符串被分割成多行显示，也会被整体视为一行。\n\n!!! hint \"提示\"\n\n    仅命令支持两种方式。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tPRINTL SSS\n\t\tPRINTL OOO\n\t\tPRINTL UUU\n\t\tPRINTL NNN\n\t\tPRINTL DDD\n\t\tPRINTL VVV\n\t\tPRINTL OOO\n\t\tPRINTL LLL\n\t\tPRINTL TTT\n\t\tCLEARLINE 8\n\t\tPRINTL EEE\n\t\tPRINTW XXX\n    ```\n    ```text\n\tSSS\n\tEEE\n\tXXX\n    ```\n\n### 相关项目\n- REUSELASTLINE"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    int CLEARMEMORY\n    ```\n\n    释放内存，并返回释放的内存量（单位为 byte）。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n    在运行 `LOADDATA`、`DELCHARA`、重启 Emuera 这三种情况之后使用效果比较好，其他场景下就没什么效果了。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        REPEAT 10000\n            ADDVOIDCHARA\n        REND\n        DELALLCHARA\n        PRINTFORMW CLEARMEMORY 已执行完成，合计释放了 {CLEARMEMORY()/1024/1024} MB 的内存\n    ```\n\n    ```text\n    CLEARMEMORY 已执行完成，合计释放了 840 MB 的内存\n    ```\n\n### 相关项目\n- GETMEMORYUSAGE"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tCLEARTEXTBOX\n    ```\n\t清除最底部输入栏中的所有文本。\n\n!!! hint \"提示\"\n\n    仅支持指令形式。"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tint CLIENTWIDTH\n\tINT CLIENTHEIGHT\n    ```\n    获取客户端区域（窗口绘图区域）的当前宽度或高度。\n    此数值不包含窗口边框、菜单栏、滚动条或文本输入区域的宽度或高度。\n    请注意，`CLIENTHEIGHT` 的值可能在游戏过程中被用户更改。\n\n!!! hint \"提示\"\n\n    该函数同时支持在指令和表达式中使用。"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tint COLOR_FROMNAME colorName\n\tstring COLOR_ROMRGB R, G, B\n    ```\n\t`COLOR_FROMNAME` 将给定的参数作为颜色名进行判断，并返回 `0xRRGGBB` 格式的数值。\n\t如果不存在对应的颜色名，则返回 -1。\n\n\t`COLOR_FROMRGB` 将给定的 `R, G, B` 值作为 `0xRRGGBB` 格式的数值返回。\n\t如果参数超出 `0-255` 的范围，将发生错误。\n\n!!! hint \"提示\"\n\n    同时支持指令和表达式函数。\n\n### 相关项目\n- SETCOLOR"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tloopInstruction\n\t\tCONTINUE\n\t\tBREAK\n\tloopendInstruction\n    ```\n    可在 `REPEAT`、`FOR`、`WHILE`、`DO` 内部使用的循环控制指令。\n    `CONTINUE` 在执行时会返回到循环开始行，对于 `REPEAT` 和 `FOR` 循环，还会递增或递减对应的计数变量。\n    `BREAK` 在执行时会中断后续的循环处理，并跳转到循环结束行。\n\n!!! hint \"提示\"\n\n    仅支持指令形式。\n\n!!! example \"例\"\n\n    ```erb\n\t@SYSTEM_TITLE\n\t\tREPEAT 5\n\t\t\tSIF COUNT == 2\n\t\t\t\tCONTINUE\n\t\t\tSIF COUNT == 4\n\t\t\t\tBREAK\n\t\t\tPRINTFORML {COUNT}\n\t\tREND\n\t\tPRINTFORML {COUNT}\n\n\t\tDO\n\t\t\tCOUNT++\n\t\t\tIF UNICODE(COUNT) == \"A\"\n\t\t\t\tFOR COUNT, COUNT, COUNT+26\n\t\t\t\t\tPRINTFORM %UNICODE(COUNT)%\n\t\t\t\tNEXT\n\t\t\t\tBREAK\n\t\t\tENDIF\n\t\tLOOP 1\n\t\tWAIT\n    ```\n    ```text\n\t0\n\t1\n\t3\n\t5\n\tABCDEFGHIJKLMNOPQRSTUVWXYZ\n    ```"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\n\tstring CONVERT value, ※\n    ```\n\t※处只能填入2、8、10、16。\n\t返回将第一个参数表示为2、8、10或16进制数的字符串。\n\n!!! hint \"提示\"\n\n    同时支持指令和表达式函数两种形式。\n\n### 相关项目\n- [变量的规格与一览>常量的表示](../Emuera/variables.md#_3)"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tCOPYCHARA charaID, charaID\n    ```\n\t将第一个参数指定的登记编号 (CharaID) 角色的所有数据复制到第二个参数指定的登记编号 (CharaID) 角色。\n\n!!! hint \"提示\"\n\n    仅支持指令形式。"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tCSVBASE charaNo, index\n\tCSVCSTR charaNo, index\n\tCSVABL charaNo, index\n\tCSVTALENT charaNo, index\n\tCSVMARK charaNo, index\n\tCSVEXP charaNo, index\n\tCSVRELATION charaNo, index\n\tCSVJUEL charaNo, index\n\tCSVEQUIP charaNo, index\n\tCSVCFLAG charaNo, index\n    ```\n\t这是直接调用 CSV 中定义的值的函数。\n\t第一参数为角色注册编号 (NO)，第二参数为各变量的索引。\n\t`CSVCSTR` 会将字符串赋值给 `RESULTS`，其他函数则将数值赋值给 `RESULT`。\n\n!!! hint \"提示\"\n\n    同时支持指令和表达式函数两种形式。\n\n!!! example \"例\"\n\n\t``` { title Chara0.csv }\n\t番号,0\n\t名前,絵夢 江良\n\t呼び名,江良\n\n\t能力,0,3\n\t経験,1,200\n\tCSTR,2,このキャラはテスト用キャラです\n\t```\n    ```erb\n    @SYSTEM_TITLE\n\t\tPRINTFORMW %CSVNAME(0)%のABL:0={CSVABL(0, 0)} EXP:1={CSVEXP(0, 1)} %CSVCSTR(0, 2)%\n    ```\n    ```text\n\t絵夢 江良のABL:0=3 EXP:1=200 このキャラはテスト用キャラです\n    ```\n\n### 相关项目\n- CSVNAME系列"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tCSVNAME charaNo\n\tCSVCALLNAME charaNo\n\tCSVNICKNAME charaNo\n\tCSVMASTERNAME charaNo\n    ```\n\t这是直接调用 CSV 中定义的 `NAME`、`CALLNAME`、`NICKNAME`、`MASTERNAME` 的函数。\n\t当你想要获取未拥有角色的名字等情况时可以使用。\n\t第一个参数是角色注册编号 (NO)（`NO` 对应的那个）。\n\n!!! hint \"提示\"\n\n    同时支持作为指令和表达式函数使用。\n\n!!! example \"示例\"\n    ``` { title Chara0.csv }\n    番号,0\n    名前,絵夢 江良\n    呼び名,江良\n    ```\n\n    ```erb\n    @SYSTEM_TITLE\n        PRINTFORMW 角色注册编号 (NO) 0的全名:%CSVNAME(0)% 称呼名:%CSVCALLNAME(0)%\n    ```\n    ```text\n    角色注册编号 (NO) 0的全名:絵夢 江良 称呼名:江良\n    ```\n\n### 相关项目\n- CSV状态获取类\n- GETCSVNOBY系 — 从名字查编号（逆操作）\n- [动态解析与反射](../tutorial/dynamic-reflection.zh.md) — CSVNAME 属于第一代\"固定映射\""
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
    "body": "!!! info \"API\"\n\n    ```erb\n    CUPCHECK charaID\n    ```\n    CUPCHECK 是 CUP、CDOWN 对应的 UPCHECK。\n    　格式：CUPCHECK <角色>\n    　内容：对参数指定的角色执行 UPCHECK，仅此而已。\n    当然，不会受到 UP、DOWN 的影响。此外，UPCHECK 会显示结果，但 CUPCHECK 产生的结果不会显示。\n\n!!! hint \"提示\"\n\n    仅支持指令。\n\n### 相关项目\n- UPCHECK"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tCUSTOMDRALINE string\n\tDRAWLINEFORM formedString\n    ```\n\t使用指定的字符串显示一行分隔符。DRAWLINEFORM 支持 FORM 语法。\n\n!!! hint \"提示\"\n\n    仅支持作为指令使用。\n\n!!! example \"例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tCUSTOMDRAWLINE *\n\t\tDRAWLINEFORM {123+211}\n\t\tWAIT\n    ```\n    ```text\n\t************************************************************************************************************************************************\n\t334334334334334334334334334334334334334334334334334334334334334334334334334334334334334334334334334334334334334334334334334334334334334334334334\n    ```\n\n### 相关项目\n- DRAWLINE"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tCVARSET characterVariable, index, value, startID, endID\n    ```\n\t此命令用于对指定已注册角色，向其角色变量的特定元素赋值。\n\t对于第一参数指定的变量，针对第四参数及之后参数指定的已注册角色，将第三参数指定的值赋给第二参数指定的元素。\n\t对于`NAME`、`ISASSI`等一维数组变量，第二参数不影响处理。因此，若不省略第三参数，请指定一个适当的值。\n\t若省略第三参数，则赋值`0`或空字符串。\n\t若也省略第二参数，则赋值给第`0`个元素。\n\t若省略第四参数及之后的参数，则对所有已注册角色赋值。\n\n    ```erb\n\tCVARSET CFLAG, 10, 123\n\t```\n\n\t此脚本与以下代码等效。\n\n    ```erb\n    REPEAT CHARANUM\n\t    CFLAG:COUNT:10 = 123\n    REND\n    ```\n\n!!! hint \"提示\"\n\n    仅支持命令形式。\n\n### 相关项目\n- VARSET"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tDEBUGPRINT string\n\tDEBUGPRINTL string\n\tDEBUGPRINTFORM formedString\n\tDEBUGPRINTFORML formedString\n    ```\n\t`DEBUG` 系列命令仅在以[调试模式](../Emuera/debug.zh.md)启动时才会执行。\n\t在非调试模式下，这些命令不会执行任何操作。\n\t在非调试模式下，甚至不会对参数进行解析，因此即使<格式化字符串>中存在错误，也不会引发错误。\n\n\t`DEBUGPRINT` 系列命令分别与 `PRINT` 命令和 `PRINTL` 命令具有相同的功能。\n\t不同之处在于，它们的输出目标是调试控制台，而非主控制台。\n\t此外，它们不受 `SKIPDISP` 命令的影响，也无法使用 `n` 参数。\n\n    `DEBUGCLEAR` 会删除调试控制台中的所有 PRINT 内容。\n\n!!! hint \"提示\"\n\n    仅支持命令形式。"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tDELALLCHARA\n    ```\n\t删除所有已注册的角色。 效果等同于以下脚本：\n\n    ```erb\n\tREPEAT CHARANUM\n\t\tDELCHARA 0\n\tREND\n\t```\n\n!!! hint \"提示\"\n\n    仅支持作为命令使用。\n\n### 相关项目\n- DELCHARA"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tDELCHARA charaID(, charaID,...)\n    ```\n    删除指定ID的角色。\n\t在`Emuera`中，可以一次性删除多个角色。\n\n!!! hint \"提示\"\n\n    仅支持指令形式。\n\n!!! example \"例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\t;假设登记编号 (CharaID) 0的角色名为浩之，是主人公。\n\t\t;假设角色注册编号 (NO) 3的角色名为智子，编号5的角色名为蕾米，编号6的角色名为琴音\n\t\tPRINTFORML 当前存在的角色有{CHARANUM}人。\n\t\tADDCHARA 3\n\t\tADDCHARA 5\n\t\tADDCHARA 6\n\t\tPRINTFORML 当前存在的角色有{CHARANUM}人。\n\t\tREPEAT CHARANUM\n\t\t\tPRINTFORML {COUNT}号是%NAME:COUNT%。\n\t\tREND\n\t\tDELCHARA 2\n\t\tPRINTFORML 当前存在的角色有{CHARANUM}人。\n\t\tREPEAT CHARANUM\n\t\tPRINTFORML {COUNT}号是%NAME:COUNT%。\n\t\t\tREND\n\t```\n    ```text\n\t当前存在的角色有1人。\n\t当前存在的角色有4人。\n\t0号是浩之。\n\t1号是智子。\n\t2号是蕾米。\n\t3号是琴音。\n\t当前存在的角色有3人。\n\t0号是浩之。\n\t1号是智子。\n\t2号是琴音。\n    ```\n\n### 相关项目\n- ADDCHARA\n- DELALLCHARA"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tDELDATA saveID\n    ```\n\t删除由 `saveID` 指定编号的文件数据。\n\t即使文件不存在也不会报错。\n\n!!! hint \"提示\"\n\n    仅支持指令形式。"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tint DISABLE_INPUT_MACRO\n    ```\n    关闭所有输入（textbox + SEQUENCEINPUT）的宏解析。调用后，输入按字面整段喂入，不再解析 `(...)` 重复宏，不再按 `\\n` 拆分，也不再处理 `\\e` MesSkip。\n\n    - 默认状态为宏解析开启（与原版 PressEnterKey 一致）\n    - 可通过 `ENABLE_INPUT_MACRO` 恢复默认行为\n    - 返回值始终为 `0`\n\n!!! warning \"注意\"\n\n    由于 `CanRestructure = false`，不会成为常量折叠的对象。\n\n### 相关项目\n- ENABLE_INPUT_MACRO\n- SEQUENCEINPUT\n- INPUT"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tDO\n\tLOOP bool\n    ```\n\t`REPEAT～REND` 和 `FOR～NEXT` 一样，是一种循环结构。\n\t与 C 语言的 `do～while`、VB 的 `do～loop while` 结构类似，只要 `LOOP` 的 `bool` 不为 `0`，就会继续执行循环。\n\t其特点是，与 `WHILE～WEND` 不同，它至少会执行一次。\n\t另外，在 `DO～LOOP` 内执行 `CONTINUE` 时，如果 `LOOP` 的条件不满足，则会直接跳出 `LOOP`。请注意，执行 `CONTINUE` 后不一定会返回到 `DO` 语句。\n\t此外，如果通过 `GOTO` 等命令直接跳转到 `DO～LOOP` 内部，在正常到达 `LOOP` 时会进行条件判断，如果 `bool` 不为 `0`，则会循环回 `DO`。\n\n!!! hint \"提示\"\n\n    仅支持命令。"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    DOTRAIN trainNo\n    ```\n    强制进行`TRAIN`的命令。\n    仅在`@EVENTTRAIN`、`@SHOW_STATUS`、`@SHOW_USERCOM`、`@USERCOM`、`@EVENTCOMEND`及从这些函数中调用的函数内可用。\n    参数指定的编号对应于`train.csv`中定义的编号。\n    其行为与选择命令时相同：初始化`UP`、`DOWN`等变量，将参数赋值给`SELECTCOM`，调用`@EVENTCOM`，调用`@COM{SELECTCOM}`……依此流程进行。\n\n    若参数小于`0`或大于等于`TRAINNAME`的元素数量，则会发生错误，但除此之外不会进行其他检查。\n    即使参数是`train.csv`中未定义的数字，也会强制尝试执行。\n    此外，不会调用`@COM_ABLE`，而是强制执行。\n    如有必要，请在`DOTRAIN`之前执行如下检查：\n\n    ```erb\n    SIF ( X < 0 || X >= VARSIZE(\"TRAINNAME\") || TRAINNAME:X == \"\" )\n        RETURN\n    RESULT = 1\n    TRYCALLFORM COM_ABLE{X}\n    SIF RESULT == 0\n        RETURN\n    DOTRAIN X\n    ```\n    相反地，也可以使用 `DOTRAIN` 来自行实现 `TRAIN` 命令。\n    例如，将 `train.csv` 留空，通过 `@SHOW_USERCOM` 自行显示，并在 `@USERCOM` 中执行 `DOTRAIN`。\n    或者，也可以不将 `train.csv` 留空，而是让所有的 `@COM_ABLE` 都返回 `0`。\n    除了修改 `@COM_ABLE`，还可以删除所有的 `@COM_ABLE`，并将 [`_replace.csv` 的 `COM_ABLE初始值`](../Emuera/replace.zh.md) 设置为 `0`。\n    另外，如果在 `CALLTRAIN` 的处理过程中执行了 `DOTRAIN`，则 `CALLTRAIN` 的剩余部分将无效。\n\n!!! hint \"提示\"\n\n    仅支持命令。\n\n### 相关项目\n- CALLTRAIN"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tDRAWLINE\n    ```\n    从屏幕右端到左端用 `-` 画一条线\n\n!!! hint \"提示\"\n\n    仅支持指令形式。\n\n!!! example \"例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tDRAWLINE\n\t\tWAIT\n    ```\n    ```text\n\t------------------------------------------------------------------------------------------------------------------------------------------------\n    ```\n\n### 相关项目\n- CUSTOMDRAWLINE"
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
    "body": "!!! info \"API\"\n\n\t```erb\n\tint DT_CELL_GET dataTableName, row, columnName(, asId)\n\tfloat DT_CELL_GETF dataTableName, row, columnName(, asId)\n\tstring DT_CELL_GETS dataTableName, row, columnName(, asId)\n\tint DT_CELL_ISNULL dataTableName, row, columnName(, asId)\n\tint DT_CELL_SET dataTableName, row, columnName(, value, asId)\n\t```\n\n\t操作 `DataTable`（数据库，基于 [`DataTable`](https://learn.microsoft.com/zh-cn/dotnet/api/system.data.datatable?view=netframework-4.8) 类）单元格的函数。\n\n\t- `DT_CELL_GET`：返回 `dataTableName` 对应的 `DataTable` 中行 `row` 的列 `columnName` 的整数值。失败时返回 `0`。\n\t- `DT_CELL_GETF`：返回 `dataTableName` 对应的 `DataTable` 中行 `row` 的列 `columnName` 的浮点数值。失败时返回 `0.0`。\n\t- `DT_CELL_GETS`：返回 `dataTableName` 对应的 `DataTable` 中行 `row` 的列 `columnName` 的字符串值。失败时返回空字符串。\n\t\t- 若 `asId` 为 `1`，操作的行为 `id` 列的值等于 `row` 的行。\n\t\t- 若 `asId` 其它值或被省略，操作的行为第 `row` 行（起始行为第0行）。\n\t- `DT_CELL_ISNULL`：若名为 `dataTableName` 的 `DataTable` 的 `row` 行 `columnName` 列的值为空（不同于整数和字符串）时返回 `1`。\n\t\t- 返回值为 `0` 时，所查询的值不为空。\n\t\t- 返回值为 `-1` 时，指定的 `DataTable` 本身就不存在。\n\t\t- 返回值为 `-2` 时，指定的行或列不存在。\n\t- `DT_CELL_SET`：将名为 `dataTableName` 的 `DataTable` 的 `row` 行 `columnName` 列的单元格赋值为 `value`。若省略 `value`，赋值为空。根据列的类型自动判定 `value` 的类型（整数列接受整数、浮点数列接受浮点数、字符串列接受字符串）。\n\t\t- 返回值为 `1` 时，赋值成功。\n\t\t- 返回值为 `0` 时，尝试设置 `id` 列的值。\n\t\t- 返回值为 `-1` 时，指定的 `DataTable` 本身就不存在。\n\t\t- 返回值为 `-2` 时，`value` 的类型与该单元格的类型不符。\n\t\t- 返回值为 `-3` 时，指定的行或列不存在。\n\n\t!!! warning \"注意\"\n\n\t\t不能编辑 `id` 列的值。\n\n!!! hint \"提示\"\n\n\t命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n\t```erb\n\t@SYSTEM_TITLE\n\t\t#DIM id\n\n\t\tDT_CREATE \"db\"\n\t\tDT_COLUMN_ADD \"db\", \"name\"\n\t\tDT_COLUMN_ADD \"db\", \"height\", \"int16\"\n\t\tDT_COLUMN_ADD \"db\", \"age\", \"int16\"\n\n\t\tid = DT_ROW_ADD(\"db\", \"name\", \"Name1\", \"age\", 11)\n\t\tDT_ROW_ADD \"db\", \"name\", \"Name2\", \"age\", 21, \"height\", 164\n\t\tDT_ROW_ADD \"db\", \"name\", \"Name3\", \"age\", 18, \"height\", 159\n\t\tDT_ROW_ADD \"db\", \"name\", \"Name4\", \"age\", 33, \"height\", 180\n\t\tDT_ROW_ADD \"db\", \"name\", \"Name5\", \"age\", 18, \"height\", 172\n\n\t\tPRINTFORML 第1行的height列的值为\\@DT_CELL_ISNULL(\"db\", id, \"height\", 1)==1?空#非空\\@\n\n\t\tDT_CELL_SET \"db\", 0, \"height\", 132\n\n\t\tPRINTFORM 第1行 - 姓名：%DT_CELL_GETS(\"db\", 0, \"name\")%\n\t\tPRINTFORM 年龄：{DT_CELL_GET(\"db\", 0, \"age\")}\n\t\tPRINTFORML 身高：{DT_CELL_GET(\"db\", 0, \"height\")}\n\n\t\tONEINPUT\n\t```\n\t```text\n\t第1行的height列的值为空\n\t第1行 - 姓名：Name1 年龄：11 身高：132\n\t```"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    int DT_COLUMN_ADD dataTableName, columnName(, type, nullable)\n    int DT_COLUMN_EXIST dataTableName, columnName\n    int DT_COLUMN_REMOVE dataTableName, columnName\n    int DT_COLUMN_LENGTH dataTableName\n    int DT_COLUMN_OPTIONS dataTableName, columnName, option, optionValue([, option, optionValue] ...)\n    ```\n\n    `DataTable` （数据库，基于 [`DataTable`](https://learn.microsoft.com/zh-cn/dotnet/api/system.data.datatable?view=netframework-4.8) 类）的列的操作相关的一系列函数。\n\n    - `DT_COLUMN_ADD`：为名为 `dataTableName` 的 `DataTable` 添加 `columnName` 列。`columnName` 已经存在时，返回 `0`；若创建成功，返回 `1`。\n        - `type` 用于指定该列存储的数据的类型。\n            - `1`（整数）/ `int8`（字符串）：8位带符号整数\n            - `2`（整数）/ `int16`（字符串）：16位带符号整数\n            - `3`（整数）/ `int32`（字符串）：32位带符号整数\n            - `4`（整数）/ `int64`（字符串）：64位带符号整数\n            - `5`（整数）/ `string`（字符串）：字符串（默认值）\n        - `nullable` 为 `0` 以外的数（默认值）时，该列的数据可以为空。\n    - `DT_COLUMN_EXIST`：判断在名为 `dataTableName` 的 `DataTable` 中是否存在 `columnName` 列。若存在，返回存储类型对应的数值（参照 `DT_COLUMN_ADD` 的 `type` 参数）。否则返回 `0`。\n    - `DT_COLUMN_REMOVE`：将名为 `dataTableName` 的 `DataTable` 中断 `columnName` 列删除。若删除成功，返回 `1`。\n    - `DT_COLUMN_LENGTH`：返回名为 `dataTableName` 的 `DataTable` 的列数。若指定的 `DataTable` 本身就不存在，返回 `-1`。\n    - `DT_COLUMN_OPTIONS`：对名为 `dataTableName` 的 `DataTable` 的 `columnName` 列的设置项进行设置。`option` 无视大小写。\n        - `option` 为 `DEFAULT`：设定指定列的默认值。\n    - `DT_COLUMN_NAMES`：对名为 `dataTableName` 的 `DataTable` 的列名依次赋值给 `outputArray`。若 `outputArray` 被省略，则次赋值给 `RESULTS`。返回列数。\n\n    !!! warning \"注意\"\n\n        不能删除列 `id` 。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。`DT_COLUMN_OPTIONS` 只支持命令形式。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n\n        DT_CREATE \"db\"\n        DT_COLUMN_ADD \"db\", \"name\"\n        DT_COLUMN_ADD \"db\", \"height\", \"int16\"\n        DT_COLUMN_ADD \"db\", \"age\", \"int16\"\n\n        DT_COLUMN_OPTIONS \"db\", \"age\", DEFAULT, 5\n\n        DT_ROW_ADD \"db\", \"name\", \"Name1\", \"age\", 11, \"height\", 132\n        DT_ROW_ADD \"db\", \"name\", \"Name2\", \"height\", 164\n        DT_ROW_ADD \"db\", \"name\", \"Name3\", \"age\", 18, \"height\", 159\n        DT_ROW_ADD \"db\", \"name\", \"Name4\", \"age\", 33, \"height\", 180\n        DT_ROW_ADD \"db\", \"name\", \"Name5\", \"age\", 18, \"height\", 172\n\n        PRINT 列名：\n        FOR LOCAL, 0, DT_COLUMN_NAMES(\"db\")\n            PRINTFORM %RESULTS:LOCAL%\n        NEXT\n        PRINTL\n\n        PRINTFORML 列数：{DT_COLUMN_LENGTH(\"db\")}，列「age」是否存在：{DT_COLUMN_EXIST(\"db\", \"age\")}\n\n        PRINTFORML %DT_CELL_GETS(\"db\", 1, \"name\")%的年龄为{DT_CELL_GET(\"db\", 1, \"age\")}\n\n        DT_COLUMN_REMOVE \"db\", \"age\"\n\n        PRINTFORML 列数：{DT_COLUMN_LENGTH(\"db\")}，列「age」是否存在：{DT_COLUMN_EXIST(\"db\", \"age\")}\n\n        ONEINPUT\n    ```\n    ```text\n    列名：id name height age\n    列数：4，列「age」是否存在：2\n    Name2的年龄为5\n    列数：3，列「age」是否存在：0\n    ```"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    int DT_CREATE dataTableName\n    int DT_EXIST dataTableName\n    1 DT_RELEASE dataTableName\n    int DT_CLEAR dataTableName\n    int DT_NOCASE dataTableName, ignoreCase\n    ```\n\n    `DataTable` （数据库，基于 [`DataTable`](https://learn.microsoft.com/zh-cn/dotnet/api/system.data.datatable?view=netframework-4.8) 类）的创建 / 删除 / 判断是否存在 / 数据清除 / 大小写无视设定相关的一系列函数。\n\n    - `DT_CREATE`：生成名为 `dataTableName` 的 `DataTable`。\n        如果已经存在名为 `dataTableName` 的 `DataTable`（创建失败），返回 `0`；若创建成功，返回 `1`。\n    - `DT_EXIST`：判断是否存在名为 `dataTableName` 的 `DataTable`，若存在，返回 `1`；否则返回 `0`。\n    - `DT_RELEASE`：删除名为 `dataTableName` 的 `DataTable`。\n    - `DT_CLEAR`：删除名为 `dataTableName` 的 `DataTable` 中保存的所有行（不会清除列的设置），返回 `1`。若指定的 `DataTable` 本身就不存在，返回 `-1`。\n    - `DT_NOCASE`：设置名为 `dataTableName` 的 `DataTable` 在 `DT_SELECT` 函数处理字符串比较时是否无视大小写。返回 `1`。若指定的 `DataTable` 本身就不存在，返回 `-1`。\n        - `ignoreCase` 为 `0` 时（默认值）：大小写敏感\n        - `ignoreCase` 为其它值时：无视大小写\n\n    !!! warning \"注意\"\n\n        生成 `DataTable` 之后会自动添加 `id` 列。若需要保存进存档文件请参考「`XML`、`MAP`、`DataTable` 保存功能」。「タイトル画面へ戻る（返回标题界面）」或 [`RESETDATA`](https://osdn.net/projects/emuera/wiki/excom#h5-RESETDATA) 后会自动删除。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        PRINTFORML DataTable「db」是否存在：{DT_EXIST(\"db\")}\n        DT_CREATE \"db\"\n        PRINTSL RESULT ? \"创建成功\" # \"已经存在\"\n        DT_CREATE \"db\"\n        PRINTSL RESULT ? \"创建成功\" # \"已经存在\"\n\n        CALL GEN_DB_DATA\n\n        PRINTFORML DataTable「db」中的数据：{DT_ROW_LENGTH(\"db\")}行ｘ{DT_COLUMN_LENGTH(\"db\")}列\n        PRINTFORML 「name」以「n」开头的列数：{DT_SELECT(\"db\", \"name LIKE 'n%'\")}\n        DT_NOCASE \"db\", 1\n        PRINTFORML 「name」以「n」开头的列数：{DT_SELECT(\"db\", \"name LIKE 'n%'\")}\n        DT_CLEAR \"db\"\n        PRINTFORML DataTable「db」中的数据：{DT_ROW_LENGTH(\"db\")}行ｘ{DT_COLUMN_LENGTH(\"db\")}列\n\n        RESETDATA ; すべてのDataTableが自動的に削除される\n\n        DT_CREATE \"db\"\n        PRINTSL RESULT ? \"创建成功\" # \"已经存在\"\n        PRINTFORML DataTable「db」是否存在：{DT_EXIST(\"db\")}\n        DT_RELEASE \"db\"\n        PRINTFORML DataTable「db」是否存在：{DT_EXIST(\"db\")}\n\n        ONEINPUT\n\n    @GEN_DB_DATA\n        DT_COLUMN_ADD \"db\", \"name\"\n        DT_COLUMN_ADD \"db\", \"height\", \"int16\"\n        DT_COLUMN_ADD \"db\", \"age\", \"int16\"\n\n        DT_ROW_ADD \"db\", \"name\", \"Name1\", \"age\", 11, \"height\", 132\n        DT_ROW_ADD \"db\", \"name\", \"Name2\", \"age\", 21, \"height\", 164\n        DT_ROW_ADD \"db\", \"name\", \"Name3\", \"age\", 18, \"height\", 159\n        DT_ROW_ADD \"db\", \"name\", \"Name4\", \"age\", 33, \"height\", 180\n        DT_ROW_ADD \"db\", \"name\", \"Name5\", \"age\", 18, \"height\", 172\n    ```\n    ```text\n    DataTable「db」是否存在：0\n    创建成功\n    已经存在\n    DataTable「db」中的数据：5行ｘ4列\n    「name」以「n」开头的列数：0\n    「name」以「n」开头的列数：5\n    DataTable「db」中的数据：0行ｘ4列\n    创建成功\n    DataTable「db」是否存在：1\n    DataTable「db」是否存在：0\n    ```"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    a. int DT_ROW_ADD dataTableName, ([, columnName, columnValue] ...)\n    b. int DT_ROW_ADD dataTableName, columnNames, columnValues, count\n\n    a. int DT_ROW_SET dataTableName, idValue, ([, columnName, columnValue] ...)\n    b. int DT_ROW_ADD dataTableName, idValue, columnNames, columnValues, count\n\n    a. int DT_ROW_REMOVE dataTableName, idValue\n    b. int DT_ROW_REMOVE dataTableName, idValues, count\n\n    int DT_ROW_LENGTH dataTableName\n    ```\n\n    `DataTable` （数据库，基于 [`DataTable`](https://learn.microsoft.com/zh-cn/dotnet/api/system.data.datatable?view=netframework-4.8) 类）的行的操作相关的一系列函数。\n\n    - `DT_ROW_ADD`：为名为 `dataTableName` 的 `DataTable` 添加行。若指定的 `DataTable` 本身就不存在，返回 `-1`。\n        1. 添加新行，将该行的 `columnName` 列赋值为 `columnValue`，返回该行的 `id` 列的值。可以传入多组 `columnName`・`columnValue`。\n        2. 添加新行，依次从 `columnNames` 中取出行名，从 `columnValues` 中取出值，为对应行赋值，最大重复 `count` 次。返回该行的 `id` 列的值。\n    - `DT_ROW_SET`：修改名为 `dataTableName` 的 `DataTable` 的 `id` 为 `idValue` 的行。若指定的 `DataTable` 本身就不存在，返回 `-1`。\n        1. 将该行的 `columnName` 列的值设置为 `columnValue`，返回编辑成功的值的总数。可以传入多组 `columnName`・`columnValue`。\n        2. 依次从 `columnNames` 中取出行名，从 `columnValues` 中取出值，为对应行赋值，最大重复 `count` 次。返回编辑成功的值的总数。\n    - `DT_ROW_REMOVE`：将名为 `dataTableName` 的 `DataTable` 中的行删除。若指定的 `DataTable` 本身就不存在，返回 `-1`。\n        1. 删除 `id` 列的值为 `idValue` 的行。若删除成功，返回 `1`。\n        2. 依次将 `id` 与 `idValues` 的元素的值相等的行删除，最大重复 `count` 次。若删除成功，返回删除的行的数量。\n    - `DT_ROW_LENGTH`：返回名为 `dataTableName` 的 `DataTable` 的行数。若指定的 `DataTable` 本身就不存在，返回 `-1`。\n\n    !!! warning \"注意\"\n\n        不能编辑 `id` 列的值。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        #DIM id\n        #DIMS columnNames = \"age\", \"height\"\n        #DIM columnValues = 11, 132\n\n        DT_CREATE \"db\"\n        DT_COLUMN_ADD \"db\", \"name\"\n        DT_COLUMN_ADD \"db\", \"height\", \"int16\"\n        DT_COLUMN_ADD \"db\", \"age\", \"int16\"\n\n        id = DT_ROW_ADD(\"db\", \"name\", \"Name1\")\n        DT_ROW_SET \"db\", id, columnNames, columnValues, 2\n        DT_ROW_ADD \"db\", \"name\", \"Name2\", \"age\", 21, \"height\", 164\n        DT_ROW_ADD \"db\", \"name\", \"Name3\", \"age\", 18, \"height\", 159\n        DT_ROW_ADD \"db\", \"name\", \"Name4\", \"age\", 33, \"height\", 180\n        DT_ROW_ADD \"db\", \"name\", \"Name5\", \"age\", 18, \"height\", 172\n\n        PRINTFORML 行数：{DT_ROW_LENGTH(\"db\")}\n\n        CALL PRINTL_ROW(0)\n        DT_ROW_SET \"db\", id, \"age\", 0, \"height\", 50\n        CALL PRINTL_ROW(0)\n\n        ONEINPUT\n\n    @PRINTL_ROW(index)\n        #DIM index\n        PRINTFORM 第{index+1}行 - 姓名：%DT_CELL_GETS(\"db\", index, \"name\")%\n        PRINTFORM 年龄：{DT_CELL_GET(\"db\", index, \"age\")}\n        PRINTFORML 身高：{DT_CELL_GET(\"db\", index, \"height\")}\n    ```\n    ```text\n    行数：5\n    第1行 - 姓名：Name1 年龄：11 身高：132\n    第1行 - 姓名：Name1 年龄：0 身高：50\n    ```"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    int DT_SELECT dataTableName(, filterExpression, sortRule, output)\n    ```\n\n    从名为 `dataTableName` 的 `DataTable` 中选择满足 `filterExpression` 的行，将其 `id` 列的值按照 `sortRule` 的规则排序、依次代入 `output` 数组中。返回被选择的行的总数。\n\n    - 若省略 `filterExpression`，选择所有的行。\n    - 若省略 `sortRule`，不进行排序。\n    - 若未指定 `output` ，将 `id` 的值依次代入 `RESULT` 数组（从 `RESULT:1` 开始）。\n\n    请参考 [`C#` 的 `DataTable.Select`](https://learn.microsoft.com/zh-cn/dotnet/api/system.data.datatable.select?view=netframework-4.8#system-data-datatable-select(system-string-system-string)) 的说明。\n\n!!! warning \"注意\"\n\n    返回值可能会超过 `output` / `RESULT` 数组的大小。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        #DIM idx, 10\n        #DIM count\n        #DIM i\n\n        DT_CREATE \"db\"\n        DT_COLUMN_ADD \"db\", \"name\"\n        DT_COLUMN_ADD \"db\", \"height\", \"int16\"\n        DT_COLUMN_ADD \"db\", \"age\", \"int16\"\n\n        DT_ROW_ADD \"db\", \"name\", \"Name1\", \"age\", 11, \"height\", 132\n        DT_ROW_ADD \"db\", \"name\", \"Name2\", \"age\", 21, \"height\", 164\n        DT_ROW_ADD \"db\", \"name\", \"Name3\", \"age\", 18, \"height\", 159\n        DT_ROW_ADD \"db\", \"name\", \"Name4\", \"age\", 33, \"height\", 180\n        DT_ROW_ADD \"db\", \"name\", \"Name5\", \"age\", 18, \"height\", 172\n\n        count = DT_SELECT(\"db\", \"age >= 18\", \"age ASC, height DESC\", idx)\n\n        PRINTL 18岁及以上的人：\n        FOR i, 0, count\n            CALL PRINTL_ROW(idx:i)\n        NEXT\n\n        ONEINPUT\n\n    @PRINTL_ROW(id)\n        #DIM id\n        PRINTFORM 姓名：%DT_CELL_GETS(\"db\", id, \"name\", 1)%\n        PRINTFORM 年龄：{DT_CELL_GET(\"db\", id, \"age\", 1)}\n        PRINTFORML 身高：{DT_CELL_GET(\"db\", id, \"height\", 1)}\n    ```\n    ```text\n    18岁及以上的人：\n    姓名：Name5 年龄：18 身高：172\n    姓名：Name3 年龄：18 身高：159\n    姓名：Name2 年龄：21 身高：164\n    姓名：Name4 年龄：33 身高：180\n    ```"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    1. string DT_TOXML, dataTableName(, schemaOutput)\n    2. int DT_FROMXML, dataTableName, schemaXml, dataXml\n    ```\n\n    `DataTable` （数据库，基于 [`DataTable`](https://learn.microsoft.com/zh-cn/dotnet/api/system.data.datatable?view=netframework-4.8) 类）与 `XML`互相转换的函数。\n\n    - `DT_TOXML`：为名为 `dataTableName` 的 `DataTable` 转换为 `XML`，格式相关信息的 `XML` 保存至 `schemaOutput`（若省略则保存至`RESULTS:1`）。返回数据 `XML`。\n    - `DT_FROMXML`：解析格式相关信息 `schemaXml` 与 数据 `dataXml`，覆盖名为 `dataTableName` 的 `DataTable`。若成功则返回 `1`，否则返回`0`。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        #DIMS schema\n        #DIMS data\n\n        DT_CREATE \"db\"\n        DT_COLUMN_ADD \"db\", \"name\"\n        DT_COLUMN_ADD \"db\", \"height\", \"int16\"\n        DT_COLUMN_ADD \"db\", \"age\", \"int16\"\n\n        DT_ROW_ADD \"db\", \"name\", \"Name1\", \"age\", 11, \"height\", 132\n\n        data '= DT_TOXML(\"db\", schema)\n\n        DT_RELEASE \"db\"\n\n        DT_FROMXML \"db\", schema, data\n        PRINTFORML %DT_CELL_GETS(\"db\", 0, \"name\")%的年龄为{DT_CELL_GET(\"db\", 0, \"age\")}\n\n        ONEINPUT\n    ```\n    ```text\n    Name1的年龄为11\n    ```"
  },
  {
    "id": "ENABLE_INPUT_MACRO",
    "title": "ENABLE_INPUT_MACRO ![](../assets/images/IconSK.webp)",
    "names": [
      "ENABLE_INPUT_MACRO"
    ],
    "signatures": [
      {
        "name": "ENABLE_INPUT_MACRO",
        "params": "无",
        "returns": "`integer`",
        "engines": [
          "skia"
        ],
        "overloads": []
      }
    ],
    "summary": "恢复输入宏解析（默认行为）。调用 DISABLEINPUTMACRO 后可用此函数恢复原版 PressEnterKey 的宏解析、\\n 拆分和 \\e MesSkip 处理。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint ENABLE_INPUT_MACRO\n    ```\n    恢复输入宏解析（默认行为）。调用 `DISABLE_INPUT_MACRO` 后可用此函数恢复原版 PressEnterKey 的宏解析、`\\n` 拆分和 `\\e` MesSkip 处理。\n\n    - 返回值始终为 `0`\n\n!!! warning \"注意\"\n\n    由于 `CanRestructure = false`，不会成为常量折叠的对象。\n\n### 相关项目\n- DISABLE_INPUT_MACRO\n- SEQUENCEINPUT\n- INPUT"
  },
  {
    "id": "ENUMFILES",
    "title": "ENUMFILES",
    "names": [
      "ENUMFILES"
    ],
    "signatures": [
      {
        "name": "ENUMFILES",
        "params": "`string`(, `string`, `int`)",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      }
    ],
    "summary": "将文件夹dir下满足pattern规则的文件名代入RESULTS数组。返回符合条件的文件数。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int ENUMFILES dir, pattern, option\n    ```\n\n    将文件夹`dir`下满足`pattern`规则的文件名代入`RESULTS`数组。返回符合条件的文件数。\n\n    - `dir`必须为`Emuera.exe`同级的相对路径(试图使用`..`回到更上级的目录是无效的)。\n    - `pattern`的默认值是`*`(匹配所有文件)，详细用法请参考[Directory.EnumerateFiles](https://docs.microsoft.com/en-us/dotnet/api/system.io.directory.enumeratefiles?view=netframework-4.8)。\n    - `option`的默认值为`0`，不搜索子文件夹。为其它值时则也会搜索子文件夹下的文件。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n    ```text\n    csv\n     - Chara\n        - Chara001.csv\n     - _Default.config\n     - _Fixed.config\n     - VariableSize.csv\n    ```\n    ```erb\n    @SYSTEM_TITLE\n        #DIM i\n        #DIM total\n\n        total = ENUMFILES(\"csv\")\n        PRINTFORML 所有文件数目（子文件夹除外）：{total}\n        FOR i, 0, total\n            PRINTSL RESULTS:i\n        NEXT\n        PRINTL\n\n        total = ENUMFILES(\"csv\", \"*.csv\", 1)\n        PRINTFORML CSV文件数目：{total}\n        FOR i, 0, total\n            PRINTSL RESULTS:i\n        NEXT\n\n        ONEINPUT\n    ```\n    ```text\n    所有文件数目（子文件夹除外）：3\n    csv\\VariableSize.csv\n    csv\\_Default.config\n    csv\\_Fixed.config\n\n    CSV文件数目：2\n    csv\\VariableSize.csv\n    csv\\Chara\\Chara001.csv\n    ```\n\n### 相关项目\n- EXISTFILE"
  },
  {
    "id": "ENUMFUNC",
    "title": "ENUMFUNC 系列",
    "names": [
      "ENUMFUNCBEGINSWITH",
      "ENUMFUNCENDSWITH",
      "ENUMFUNCWITH",
      "ENUMFUNC"
    ],
    "signatures": [
      {
        "name": "ENUMFUNCBEGINSWITH",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      },
      {
        "name": "ENUMFUNCENDSWITH",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      },
      {
        "name": "ENUMFUNCWITH",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      }
    ],
    "summary": "将定义的函数名中包含 keyword 的具体函数名保存到 RESULTS 数组，同时返回总数（RESULT）。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int ENUMFUNCBEGINSWITH keyword\n    int ENUMFUNCENDSWITH keyword\n    int ENUMFUNCWITH keyword\n    ```\n\n    将定义的函数名中包含 `keyword` 的具体函数名保存到 `RESULTS` 数组，同时返回总数（`RESULT`）。\n\n    - `ENUMFUNCBEGINSWITH` 返回以 `keyword` 开头的函数数量。\n    - `ENUMFUNCENDSWITH` 返回以 `keyword` 结尾的函数数量。\n    - `ENUMFUNCWITH` 返回包含 `keyword` 的函数数量。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n\n        PRINTFORML 函数名以\"Foo\"开头的函数数量:{ENUMFUNCBEGINSWITH(\"Foo\")}\n        ENUMFUNCENDSWITH \"Foo\"\n        PRINTFORML 函数名以\"Foo\"结尾的函数数量:{RESULT}\n        CALL PrintFoo\n        ENUMFUNCWITH \"Foo\"\n        PRINTFORML 函数名包含\"Foo\"的函数数量:{RESULT}\n        CALL PrintFoo\n\n        ONEINPUT\n\n    @PrintFoo\n        #DIM i\n        FOR i, 0, RESULT\n            SIF i > 0\n                PRINTS \", \"\n            PRINTS RESULTS:i\n        NEXT\n        PRINTL\n\n    @Foo1\n    @Foo2\n    @Foo3\n    @Dummy1Foo\n    @Dummy2Foo\n    @My_Foo_Func\n    ```\n    ```text\n    函数名以\"Foo\"开头的函数数量:3\n    函数名以\"Foo\"结尾的函数数量:3\n    PrintFoo, Dummy1Foo, Dummy2Foo\n    函数名包含\"Foo\"的函数数量:7\n    PrintFoo, Foo1, Foo2, Foo3, Dummy1Foo, Dummy2Foo, My_Foo_Func\n    ```\n\n### 相关项目\n- ENUMVAR系 — 变量名枚举\n- ENUMMACRO系 — 宏名枚举\n- [动态解析与反射](../tutorial/dynamic-reflection.zh.md) — ENUMFUNC* 属于第三代\"函数名枚举\""
  },
  {
    "id": "ENUMMACRO",
    "title": "ENUMMACRO 系列",
    "names": [
      "ENUMMACROBEGINSWITH",
      "ENUMMACROENDSWITH",
      "ENUMMACROWITH",
      "ENUMMACRO"
    ],
    "signatures": [
      {
        "name": "ENUMMACROBEGINSWITH",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      },
      {
        "name": "ENUMMACROENDSWITH",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      },
      {
        "name": "ENUMMACROWITH",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      }
    ],
    "summary": "将定义的宏名中包含 keyword 的具体宏名保存到 RESULTS 数组，同时返回总数（RESULT）。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int ENUMMACROBEGINSWITH keyword\n    int ENUMMACROENDSWITH keyword\n    int ENUMMACROWITH keyword\n    ```\n\n    将定义的宏名中包含 `keyword` 的具体宏名保存到 `RESULTS` 数组，同时返回总数（`RESULT`）。\n\n    - `ENUMMACROBEGINSWITH` 返回以 `keyword` 开头的宏命令数量。\n    - `ENUMMACROENDSWITH` 返回以 `keyword` 结尾的宏命令数量。\n    - `ENUMMACROWITH` 返回包含 `keyword` 的宏命令数量。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    #DIMS CONST Foo1 = \"1\"\n    #DEFINE Foo2 \"Test\"\n    #DEFINE Foo3\n    #DEFINE MyFoo 1 + 1\n    #DEFINE YourFoo 1 + 1\n    #DEFINE AFooInTheMiddle\n    ```\n    ```erb\n    @SYSTEM_TITLE\n\n        PRINTFORML 宏名以\"Foo\"开头的宏命令数量:{ENUMMACROBEGINSWITH(\"Foo\")}\n        ENUMMACROENDSWITH \"Foo\"\n        PRINTFORML 宏名以\"Foo\"结尾的宏命令数量:{RESULT}\n        CALL PrintFoo\n        ENUMMACROWITH \"Foo\"\n        PRINTFORML 宏名包含\"Foo\"的宏命令数量:{RESULT}\n        CALL PrintFoo\n\n        ONEINPUT\n\n    @PrintFoo\n        #DIM i\n        FOR i, 0, RESULT\n            SIF i > 0\n                PRINTS \", \"\n            PRINTS RESULTS:i\n        NEXT\n        PRINTL\n    ```\n    ```text\n    宏名以\"Foo\"开头的宏命令数量:2\n    宏名以\"Foo\"结尾的宏命令数量:2\n    MyFoo, YourFoo\n    宏名包含\"Foo\"的宏命令数量:5\n    Foo2, Foo3, MyFoo, YourFoo, AFooInTheMiddle\n    ```\n\n### 相关项目\n- ENUMFUNC系 — 函数名枚举\n- ENUMVAR系 — 变量名枚举\n- ISDEFINED — 宏定义检查\n- [动态解析与反射](../tutorial/dynamic-reflection.zh.md) — ENUMMACRO* 属于第三代\"宏名枚举\""
  },
  {
    "id": "ENUMVAR",
    "title": "ENUMVAR 系列",
    "names": [
      "ENUMVARBEGINSWITH",
      "ENUMVARENDSWITH",
      "ENUMVARWITH",
      "ENUMVAR"
    ],
    "signatures": [
      {
        "name": "ENUMVARBEGINSWITH",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      },
      {
        "name": "ENUMVARENDSWITH",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      },
      {
        "name": "ENUMVARWITH",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      }
    ],
    "summary": "将定义的变量 / 常量名中包含 keyword 的具体变量 / 常量名保存到 RESULTS 数组，同时返回总数（RESULT）。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int ENUMVARBEGINSWITH keyword\n    int ENUMVARENDSWITH keyword\n    int ENUMVARWITH keyword\n    ```\n\n    将定义的变量 / 常量名中包含 `keyword` 的具体变量 / 常量名保存到 `RESULTS` 数组，同时返回总数（`RESULT`）。\n\n    - `ENUMVARBEGINSWITH` 返回以 `keyword` 开头的变量 / 常量数量。\n    - `ENUMVARENDSWITH` 返回以 `keyword` 结尾的变量 / 常量数量。\n    - `ENUMVARWITH` 返回包含 `keyword` 的变量 / 常量数量。\n\n    !!! warning \"注意\"\n\n        与 `EXISTVAR` 不同，不会列举局部变量 / 常量。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    #DIMS CONST Foo1 = \"1\"\n    #DIM Foo2, 2, 2\n    #DIMS CONST Foo3 = \"3\", \"4\"\n    #DIM MyFoo\n    ```\n    ```erb\n    @SYSTEM_TITLE\n        #DIMS Local3DFoo, 2, 2, 2\n\n        PRINTFORML 以\"Foo\"开头的变量/常量数量:{ENUMVARBEGINSWITH(\"Foo\")}\n        ENUMVARENDSWITH \"Foo\"\n        PRINTFORML 以\"Foo\"结尾的变量/常量数量:{RESULT}\n        CALL PrintFoo\n        ENUMVARWITH \"Foo\"\n        PRINTFORML 包含\"Foo\"的变量/常量数量:{RESULT}\n        CALL PrintFoo\n\n        ONEINPUT\n\n    @PrintFoo\n        #DIM i\n        FOR i, 0, RESULT\n            SIF i > 0\n                PRINTS \", \"\n            PRINTS RESULTS:i\n        NEXT\n        PRINTL\n    ```\n    ```text\n    以\"Foo\"开头的变量/常量数量:3\n    以\"Foo\"结尾的变量/常量数量:1\n    MyFoo\n    包含\"Foo\"的变量/常量数量:4\n    Foo1, Foo2, Foo3, MyFoo\n    ```\n\n### 相关项目\n- ENUMFUNC系 — 函数名枚举\n- ENUMMACRO系 — 宏名枚举\n- EXISTVAR — 变量存在检查\n- [动态解析与反射](../tutorial/dynamic-reflection.zh.md) — ENUMVAR* 属于第三代\"变量名枚举\""
  },
  {
    "id": "ERDNAME",
    "title": "ERDNAME",
    "names": [
      "ERDNAME"
    ],
    "signatures": [
      {
        "name": "ERDNAME",
        "params": "`variable`, `int`(, `int`)",
        "returns": "`string`",
        "engines": [
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "指定 ERD 变量的下标，返回元素的名称。可以用 dimension 来指定数组维度（与文件名规则相同，从左开始依次为 1, 2, 3）",
    "body": "!!! info \"API\"\n\n\t```erb\n\tstring ERDNAME variableName, index(, dimension)\n\t```\n\n\t指定 `ERD` 变量的下标，返回元素的名称。可以用 `dimension` 来指定数组维度（与文件名规则相同，从左开始依次为 1, 2, 3）\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n\t```erb\n\t0,AAA\n\t1,BBB\n\t2,CCC\n\t```\n\t```erb\n\t0,DDD\n\t1,EEE\n\t2,FFF\n\t```\n\t```erb\n\t0,GGG\n\t1,HHH\n\t2,III\n\t```\n    ```erb\n\t@SYSTEM_TITLE\n\n\t\tPRINTFORMW %ERDNAME(HOGE3D, 0, 1)% %ERDNAME(HOGE3D, 1, 2)% %ERDNAME(HOGE3D, 2, 3)%\n\t```\n\t```text\n\tAAA EEE III\n\t```\n\n### 相关项目\n- [用户定义变量>ERD功能](../Emuera/user_defined_variables.md#erderabasic-define)\n- [动态解析与反射](../tutorial/dynamic-reflection.zh.md) — ERDNAME 属于 EE 扩展\"编号→名称反查\""
  },
  {
    "id": "ESCAPE",
    "title": "ESCAPE",
    "names": [
      "ESCAPE"
    ],
    "signatures": [
      {
        "name": "ESCAPE",
        "params": "`string`",
        "returns": "`string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "对参数字符串中的正则表达式元字符进行转义，使其在正则表达式中被视为普通文本，并返回转义后的字符串。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tstring ESCAPE string\n    ```\n\t对参数字符串中的正则表达式元字符进行转义，使其在正则表达式中被视为普通文本，并返回转义后的字符串。\n\n!!! hint \"提示\"\n\n    该函数同时支持指令和表达式函数两种用法。\n\n!!! example \"例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tPRINTFORMW %ESCAPE(\"!#$%&'()\")%\n    ```\n    ```text\n\t!\\#\\$%&'\\(\\)\n    ```"
  },
  {
    "id": "EVAL",
    "title": "EVAL / EVALS / EVALF",
    "names": [
      "EVAL",
      "EVALS",
      "EVALF"
    ],
    "signatures": [
      {
        "name": "EVAL",
        "params": "`string`(, `int`)",
        "returns": "`int`",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "EVALS",
        "params": "`string`(, `string`)",
        "returns": "`string`",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "EVALF",
        "params": "`string`(, `float`)",
        "returns": "`float`",
        "engines": [
          "skia"
        ],
        "overloads": []
      }
    ],
    "summary": "将传入的字符串 expression 作为 ERB 表达式在运行时进行动态解析与求值。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int EVAL expressionString{, defaultValue}\n    string EVALS expressionString{, defaultValue}\n    float EVALF expressionString{, defaultValue}\n    ```\n\n    将传入的字符串 `expression` 作为 ERB 表达式在运行时进行动态解析与求值。\n    - `EVAL` 用于计算并返回**整数**结果。\n    - `EVALS` 用于计算并返回**字符串**结果。\n    - `EVALF` 用于计算并返回**浮点数**结果。\n\n    **安全失败机制（Fallback）**：\n    如果传入的表达式为空、存在语法错误、引用的变量不存在，或者计算结果的类型与函数要求的类型不匹配（例如用 `EVAL` 计算了一个字符串），引擎**不会抛出红字报错**，而是会静默拦截错误，并返回 `defaultValue`。\n    - 如果省略 `defaultValue`，`EVAL` 默认返回 `0`，`EVALS` 默认返回空字符串 `\"\"`，`EVALF` 默认返回 `0.0`。\n\n!!! hint \"提示\"\n\n    支持命令和表达式函数两种形式。\n\n    命令语法：\n    ```\n    EVAL \"LOCAL + 10\"\n    EVALS \"\\\"字符串结果\\\"\"\n    ```\n\n    表达式语法：\n    ```\n    LOCAL = EVAL(\"LOCAL + 10\")\n    RESULTS:0 '= EVALS(\"\\\"字符串结果\\\"\")\n    ```\n\n    表达式内的变量会绑定到**当前执行该函数的上下文**。\n    非常适合与 `DataTable` 或 `XML` 系统配合，将计算公式作为数据存储在外部，实现高度的数据驱动架构。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n        LOCAL:0 = 10\n        LOCAL:1 = 20\n\n        ; 1. 正常的数学运算\n        PRINTFORML EVAL(\"LOCAL:0 + LOCAL:1 * 2\") = {EVAL(\"LOCAL:0 + LOCAL:1 * 2\")}\n\n        ; 2. 带有三元运算符的复杂逻辑\n        PRINTFORML EVAL(\"LOCAL:0 > 5 ? 100 # 50\") = {EVAL(\"LOCAL:0 > 5 ? 100 # 50\")}\n\n        ; 3. 触发安全失败机制 (拼写错误的变量名，返回默认值 -1)\n        PRINTFORML EVAL(\"LOOOOCAL:0 + 1\", -1) = {EVAL(\"LOOOOCAL:0 + 1\", -1)}\n\n        ; 4. 字符串动态求值\n        LOCALS:0 = 剑士\n        PRINTFORML EVALS(\"\\\"职业是: \\\" + LOCALS:0\") = %EVALS(\"\\\"职业是: \\\" + LOCALS:0\", \"未知\")%\n\n        ONEINPUT\n    ```\n    ```text\n    EVAL(\"LOCAL:0 + LOCAL:1 * 2\") = 50\n    EVAL(\"LOCAL:0 > 5 ? 100 # 50\") = 100\n    EVAL(\"LOOOOCAL:0 + 1\", -1) = -1\n    EVALS(\"\\\"职业是: \\\" + LOCALS:0\") = 职业是: 剑士\n    ```\n\n### 相关项\n- CALLSTR系\n- [动态解析与反射](../tutorial/dynamic-reflection.zh.md) — EVAL/EVALS 属于第四代\"通用动态求值\""
  },
  {
    "id": "EXISTCSV",
    "title": "EXISTCSV",
    "names": [
      "EXISTCSV"
    ],
    "signatures": [
      {
        "name": "EXISTCSV",
        "params": "`int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "检查对应的角色是否已定义，并将结果赋值给RESULT:0或直接返回。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint EXISTCSV charaNO\n    ```\n\t检查对应的角色是否已定义，并将结果赋值给`RESULT:0`或直接返回。\n\t若已定义则返回`1`，未定义则返回`0`。\n\t可用于检查`ADDCHARA no`是否能无错误地执行。\n\n!!! hint \"提示\"\n\n    该函数同时支持命令和表达式函数两种调用方式。"
  },
  {
    "id": "EXISTFILE",
    "title": "EXISTFILE",
    "names": [
      "EXISTFILE"
    ],
    "signatures": [
      {
        "name": "EXISTFILE",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      }
    ],
    "summary": "判断 Emuera.exe 同级以及下级子目录（无法使用 .. 访问父级目录）的相对路径是否存在文件 relativePath。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int EXISTFILE relativePath\n    ```\n\n    判断 `Emuera.exe` 同级以及下级子目录（无法使用 `..` 访问父级目录）的相对路径是否存在文件 `relativePath`。\n\t\t如果存在，返回 `1`；否则返回 `0`。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        PRINT csv/VariableSize.csv:\n        PRINTSL EXISTFILE(\"csv/VariableSize.csv\") ? \" 存在\" # \" 不存在\"\n        PRINT erb/!@#$%^%^.txt:\n        PRINTSL EXISTFILE(\"erb/!@#$%^%^.txt\") ? \" 存在\" # \" 不存在\"\n\n        ONEINPUT\n    ```\n    ```text\n    csv/VariableSize.csv: 存在\n    erb/!@#$%^%^.txt: 不存在\n    ```\n\n### 相关项目\n- ENUMFILES"
  }
];
