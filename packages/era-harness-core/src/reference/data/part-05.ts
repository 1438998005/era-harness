// 本文件由 scripts/build-reference.ts 生成，请勿手工修改。
//
// 数据来源：https://github.com/qirchen421/emuera.sk.doc  docs/Reference/*.zh.md
// 上游版本：606670cd78b58f5d9a050013d1d3f41db5a87a1b
// 许可：CC BY-NC 4.0（http://creativecommons.org/licenses/by-nc/4.0/）
//       与本仓库代码的 Apache-2.0 分开管理，见 NOTICE-emuera-sk-doc.md
import type { ReferenceEntry } from '../types.js';

export const ENTRIES_PART_05: readonly ReferenceEntry[] = [
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tINPUTMOUSEKEY timeLimit\n    ```\n    `INPUTMOUSEKEY` 指令用于直接识别鼠标或键盘的输入。\n    参数以毫秒为单位指定执行超时处理前的等待时间，类似于 `TINPUT`。\n    如果省略参数或指定了 0 或负数，则不会执行超时处理。\n    此指令可以识别 `ONEINPUT` 等指令无法捕获的功能键、方向键、PageUp 键等作为输入。\n    另一方面，在此指令等待输入期间，无法使用 ESC 键或右键的跳过功能、宏功能以及其他功能，仅能接收按下 ESC 键等的结果。\n    此外，此指令不执行任何 `PRINT` 处理，包括超时显示等。\n    如果需要实现跳过功能或显示输入内容等，需要在 ERB 侧进行相应处理。\n    通过在第一参数中指定以毫秒为单位的数值，将执行超时处理。`INPUTMOUSEKEY` 的返回值最多有 6 个，分别赋值给 `RESULT:0`、`RESULT:1`、`RESULT:2`、`RESULT:3`、`RESULT:4`、`RESULT:5`。\n\n        RESULT:0 == 1; 检测到鼠标按下\n        　RESULT:1 ;鼠标按钮 - 左0x100000、右键 0x200000、中0x400000。对应 C# 的 System.WindowForms.MouseButtons 枚举的整数值\n        　RESULT:2 ;鼠标 X 坐标 以客户端的左下角为基准。始终为正值。\n        　RESULT:3 ;鼠标 Y 坐标 以客户端的左下角为基准。始终为负值。\n        　RESULT:4 ;当 CBGSETBMAP 已执行点击坐标正下方的颜色不透明度为 0xF时，返回颜色的 0xRRGGBB 值。否回 -1。\n        　RESULT:5 ;被点击按钮的值\n        RESULT:0 == 2; 检测到鼠标滚轮滚动\n        　RESULT:1 ;滚轮量\n        　RESULT:2 ;鼠标 X 坐标\n        　RESULT:3 ;鼠标 Y 坐标\n        RESULT:0 == 3; 检测到键盘按下\n        　RESULT:1 ;被按下键的代码。不包饰键代码（Alt、Ctrl、Shift）。于 KeyCode。对应 C# 的 SysteWindows.Forms.Keys 枚举的整数值\n        　RESULT:2 ;被按下键的代码。包含键代码。相当于 KeyData\n        RESULT:0 == 4; 因超时而结束\n\n<!-- 关于鼠标按钮，请参考 _VirtualKey.ERH 中的 MB_LEFT 到 MB_MIDDLE；关于键码，请参考 _VirtualKey.ERH 中的 VK_~。 -->\n键码与 `GETKEY` 函数通用。\n请注意，鼠标滚轮的滚动量不是 1 或 -1，而是至少为 120 等较大的值。\n此外，当光标位于 Emuera 窗口外时，滚轮是否被检测到取决于 Windows 的设置，Emuera 端无法更改。\n在默认设置下，Windows 8.1 及更早版本会检测到，但在 Windows 10 中，窗口外的滚轮似乎不会被检测到。\n\n!!! hint \"提示\"\n\n    仅支持指令。\n\n### 相关项目\n- INPUT"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tint INRANGEARRAY integerArray, minValue, maxValue(, start, end)\n\tint INRANGEARRAY charaArray, minValue, maxValue(, start, end)\n    ```\n\t`INRANGEARRAY` 返回指定数组中，值满足 `minValue <= value < maxValue` 的元素数量。\n\t`INRANGECARRAY` 返回指定角色数组中，值满足 `minValue <= value < maxValue` 的元素数量。\n\n!!! hint \"提示\"\n\n    同时支持作为指令和表达式函数使用。"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tISACTIVE\n    ```\n\t返回 Emuera 窗口的状态。\n\t如果窗口处于活动状态则返回 1，否则返回 0。\n\n!!! hint \"提示\"\n\n    该函数既可作为指令使用，也可在表达式中使用。"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    int ISDEFINED macroName\n    ```\n\n    如果定义了与`macroName`同名的宏(`#DEFINE XXX`)，则返回`1`。如果没有定义，则返回`0`。\n\n!!! hint \"提示\"\n\n    支持指令和表达式内函数两种方式。\n\n!!! example \"示例\"\n\n    ```erb\n    #DEFINE 体力 0\n    #DEFINE 气力 1\n    ```\n    ```erb\n    @SYSTEM_TITLE\n        #DIM 角色数据, 2 = 1000, 200\n\n        PRINTFORML {ISDEFINED(\"体力\")} {角色数据:体力}\n        PRINTFORML {ISDEFINED(\"气力\")} {角色数据:气力}\n        PRINTFORML {ISDEFINED(\"攻击力\")}\n\n        ONEINPUT\n    ```\n    ```text\n    1 1000\n    1 200\n    0\n    ```\n\n### 相关项目\n- [函数・预处理器>表示特殊块的行>\\[IF XXX\\]](../Emuera/function.md#if-xxxelseif-xxxelseendif)\n- [动态解析与反射](../tutorial/dynamic-reflection.zh.md) — ISDEFINED 属于第三代\"变量存在检查\""
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tJUMP functionName\n    ```\n    以 `@` 开头的字符串定义的函数\n    当到达函数末端或执行 `RETURN` 时，结束函数\n    与 `CALL` 的区别在于，执行时不会将函数压入栈，因此即使跳转到的函数结束也不会返回。所以，如果没有调用栈，可能会导致错误终止\n\n    ¹ `void` 表示指令本身不返回值，但 JUMP 目标函数中的 `RETURN` 仍会设置 `RESULT`。详见下方「JUMP 与 RESULT 的关系」。\n\n!!! hint \"提示\"\n\n    仅支持指令。\n\n!!! info \"JUMP 与 RESULT 的关系\"\n\n    JUMP 目标函数中执行 `RETURN` 时，`RESULT` 会正常设置。JUMP 只是替换栈帧，不影响 `RETURN` 设置 `RESULT` 的行为。\n\n    JUMP 目标函数结束时，`Return()` 会检测到 `IsJump` 标志，**递归地回退栈帧**，直到回到最初的非 JUMP 调用方（如 `CALL`）。JUMP 链（A→JUMP B→JUMP C→RETURN）中 RESULT 也能正确设置。\n\n    ```erb\n    @SYSTEM_TITLE\n        CALL AAA\n        PRINTVL RESULT    ; 42（BBB 的 RETURN 42 设置了 RESULT）\n\n    @AAA\n        JUMP BBB          ; AAA 被 BBB 替换\n        PRINTL 不可达     ; 不会执行\n\n    @BBB\n        RETURN 42         ; RESULT = 42，递归回退到 SYSTEM_TITLE\n    ```\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tPRINTL CALL to AAA\n\t\tCALL AAA\n\n\t\tPRINTW Backed SYSTEM_TITLE\n\n\t\t@AAA\n\t\tPRINTL JUMP to BBB\n\t\tJUMP BBB\n\n\t\tPRINTL Can not reach here\n\n\t\t@BBB\n\t\tPRINTL Exit BBB\n\t\tRETURN\n    ```\n    ```text\n\tCALL to AAA\n\tJUMP to BBB\n\tExit BBB\n\tBacked SYSTEM_TITLE\n    ```\n\n### 相关项目\n- JUMPFORM\n- TRYJUMPFORM\n- TRYCJUMP"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tint LINEISEMPTY\n    ```\n    判断当前正在`PRINT`的行是否为空行的指令。\n    在执行此指令时，如果尝试执行`PRINTL`的结果将只是一个空行，则向`RESULT:0`赋值或返回`1`，否则赋值或返回`0`。\n    在使用`PRINTC`系列指令根据条件依次排列按钮时，最后使用此指令可以判断是否有要显示的按钮，如果没有，则可以执行专用的显示处理。\n\n!!! hint \"提示\"\n\n    同时支持作为指令和表达式函数使用。"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    LOADCHARA filename\n    ```\n    第一个参数指定要加载数据的文件名（的一部分）。实际的文件名将是`chara_*.dat`。\n    如果读取失败，则向`RESULT:0`赋值`0`；如果成功，则赋值`1`。\n    在`LOADCHARA`之前，应使用`CHKCHARADATA`函数检查文件的适用性。\n    `LOADCHARA`会根据SAVE中保存的角色数量，注册相应数量的新角色。\n    因此，不会影响已存在的注册角色。\n    要了解添加了多少名角色，请比较加载前后的`CHARANUM`值。\n\n!!! hint \"提示\"\n\n    仅支持指令形式。\n\n### 相关项目\n- SAVECHARA\n- CHKCHARADATA"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tLOADDATA saveID\n    ```\n\t加载由 `saveID` 指定编号的文件数据。\n\t如果加载失败，将导致错误终止。\n\t请务必先使用 `CHKDATA` 指令检查是否可以加载，然后再执行此操作。\n\t`LOADDATA`（与 `LOADGAME` 指令不同）可以在脚本的任何位置调用。\n\n!!! info \"EM+EE 扩展：存档格式增强\"\n\n    EM+EE 扩展了 `LOADDATA` 的加载行为，在加载标准存档数据之前，会先清除当前内存中的 EM 专属数据：\n\n    - **Map 数据**：标记为 `SAVEDATA` 关键字的 `MAP` 字典会被清空\n    - **Xml 数据**：标记为 `SAVEDATA` 关键字的 XML 文档会被移除\n    - **DataTable 数据**：标记为 `SAVEDATA` 关键字的 DataTable 表会被清空\n\n    清除后，从存档中恢复对应的 EM 专属数据，确保存档切换时数据一致性。\n    这意味着如果存档中不包含某些 EM 专属数据，加载后这些数据将不存在（而非保留加载前的值）。\n\n!!! hint \"提示\"\n\n    仅支持指令形式。\n\n### 相关项目\n- SAVEDATA\n- CHKDATA"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    LOADGLOBAL\n    ```\n    加载 `GLOBAL` 与 `GLOBALS`。保存目标文件为 `global.sav`。\n    即使加载失败也不会引发错误。\n    加载成功时，将 `1` 赋值给 `RESULT`；失败时，将 `0` 赋值给 `RESULT`。\n    与普通的存档数据类似，在 `gamebase.csv` 中设置的 [`代码、版本`](../Emuera/variables.md#gamebasecsv) 不正确的文件将无法加载。\n    关于变量 `GLOBAL` 的详细信息，请参阅变量章节。\n\n!!! hint \"提示\"\n\n    仅支持作为指令使用。\n\n### 相关项目\n- SAVEGLOBAL\n- [常量·变量>存档间共享的变量](../Emuera/variables.md#_8)"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tLOADTEXT fileNo{, force_savdir, int force_UTF8}\n    ```\n\t`LOADTEXT` 命令版本会读取 `textXX.sav` 文件并将其结果赋值给 `RESULTS:0`。\n\t若指定第二个参数为非 0，则无论选项如何，都会在 sav 文件夹内寻找文件。\n\t若指定第三个参数为非 0，则会以 UTF-8 编码格式读取文件。\n\t如果失败，`RESULTS:0` 将变为空字符串。\n\t也存在同名的表达式中函数，它不操作 `RESULTS:0`，而是将读取结果或空字符串作为返回值返回。\n\n!!! info \"EM+EE 扩展：字符串路径重载\"\n\n    ```erb\n\tLOADTEXT filePath\n    ```\n    当第一个参数为**字符串**时，将其作为文件路径加载。这是 EM+EE 新增的参数类型重载，提供更灵活的文件读取能力：\n\n    - 路径为相对于 `Emuera.exe` 的相对路径，`..` 无效\n    - 只能使用由设置界面或 `Emuera.config` 中「LOADTEXTとSAVETEXTで使える拡張子」项目所允许的扩展名（默认为仅 `txt`）\n    - 如果指定的扩展名不在允许列表中，**直接返回空字符串**（不会自动改为 `.txt`，与 SAVETEXT 行为不同）\n    - 使用字符串路径时，**自动检测文件编码**（忽略 `force_UTF8` 参数）\n    - 读取结果中的 `\\r` 会被自动移除\n\n    ```text\n    LOADTEXTとSAVETEXTで使える拡張子:txt,xml,json\n    ```\n\n    ```erb\n    ; 标准用法：按编号从 sav 文件夹加载\n    LOADTEXT 0\n\n    ; EM+EE 扩展：按路径从自定义位置加载\n    LOCALS = %LOADTEXT(\"plugins/config.json\")%\n    ```\n\n!!! hint \"提示\"\n\n    该功能同时支持作为命令和表达式函数使用。\n\n### 相关项目\n- SAVETEXT"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    int MAP_MERGE destMapName, srcMapName\n    int MAP_REMOVEIF mapName, matchValue, mode\n    string MAP_FINDKEY mapName, matchValue, mode\n    ```\n\n    Skia（SkiaSharp版）新增的 `MAP` 扩展操作函数。提供批量合并、条件删除、条件查找功能。\n\n    - `MAP_MERGE`：将 `srcMapName` 的所有键值对合并到 `destMapName`。同名 key 的值会被源 MAP 覆盖。成功返回 `1`，任一 MAP 不存在返回 `0`。\n    - `MAP_REMOVEIF`：根据 `mode` 指定的匹配模式，批量删除符合条件的键值对。返回实际删除的数量，无效模式返回 `-1`。\n    - `MAP_FINDKEY`：根据 `mode` 指定的匹配模式，查找符合条件的 key，返回逗号分隔的 key 列表。`RESULT` 设置为匹配数量。\n\n    **匹配模式**（`MAP_REMOVEIF` 和 `MAP_FINDKEY` 共用）：\n\n    | 模式 | 说明 |\n    | :--- | :--- |\n    | `\"KEY_CONTAINS\"` | key 包含 matchValue |\n    | `\"KEY_PREFIX\"` | key 以 matchValue 开头 |\n    | `\"KEY_SUFFIX\"` | key 以 matchValue 结尾 |\n    | `\"VAL_CONTAINS\"` | value 包含 matchValue |\n    | `\"VAL_EQ\"` | value 等于 matchValue |\n\n    `MAP_REMOVEIF` 额外支持的模式：\n\n    | 模式 | 说明 |\n    | :--- | :--- |\n    | `\"VAL_NE\"` | value 不等于 matchValue |\n\n    !!! note \"MAP_FINDKEY 与 MAP_REMOVEIF 的区别\"\n        `MAP_FINDKEY` 不支持 `\"VAL_NE\"` 模式（查找\"不等于\"意义不大，且结果可能过多）。`MAP_FINDKEY` 只查找不删除，`MAP_REMOVEIF` 查找并删除。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        ; === MAP_MERGE ===\n        MAP_CREATE \"baseDB\"\n        MAP_SET \"baseDB\", \"name\", \"无名\"\n        MAP_SET \"baseDB\", \"level\", \"1\"\n\n        MAP_CREATE \"overrideDB\"\n        MAP_SET \"overrideDB\", \"name\", \"勇者\"\n        MAP_SET \"overrideDB\", \"class\", \"战士\"\n\n        MAP_MERGE \"baseDB\", \"overrideDB\"\n        PRINTFORML 合并后: %MAP_TOSTRING(\"baseDB\")%\n\n        ; === MAP_FINDKEY ===\n        MAP_CREATE \"itemDB\"\n        MAP_SET \"itemDB\", \"sword\", \"铁剑\"\n        MAP_SET \"itemDB\", \"potion_hp\", \"药水\"\n        MAP_SET \"itemDB\", \"potion_mp\", \"药水\"\n        MAP_SET \"itemDB\", \"shield\", \"木盾\"\n\n        LOCALS = MAP_FINDKEY(\"itemDB\", \"potion_\", \"KEY_PREFIX\")\n        PRINTFORML potion_ 前缀的键: %LOCALS% (共{RESULT}个)\n\n        LOCALS = MAP_FINDKEY(\"itemDB\", \"药水\", \"VAL_CONTAINS\")\n        PRINTFORML 值含\"药水\"的键: %LOCALS% (共{RESULT}个)\n\n        ; === MAP_REMOVEIF ===\n        MAP_CREATE \"tempDB\"\n        MAP_SET \"tempDB\", \"a\", \"1\"\n        MAP_SET \"tempDB\", \"b\", \"2\"\n        MAP_SET \"tempDB\", \"c\", \"1\"\n        MAP_SET \"tempDB\", \"d\", \"3\"\n\n        LOCAL = MAP_REMOVEIF(\"tempDB\", \"1\", \"VAL_EQ\")\n        PRINTFORML 删除了 {LOCAL} 个值为1的条目\n        PRINTFORML 剩余: %MAP_TOSTRING(\"tempDB\")%\n\n        ; === 清理 ===\n        MAP_RELEASE \"baseDB\"\n        MAP_RELEASE \"overrideDB\"\n        MAP_RELEASE \"itemDB\"\n        MAP_RELEASE \"tempDB\"\n\n        ONEINPUT\n    ```\n    ```text\n    合并后: name=勇者,level=1,class=战士\n    potion_ 前缀的键: potion_hp,potion_mp (共2个)\n    值含\"药水\"的键: potion_hp,potion_mp (共2个)\n    删除了 2 个值为1的条目\n    剩余: b=2,d=3\n    ```\n\n### 相关项目\n- MAP管理\n- MAP操作\n- MAP键值获取\n- MAP序列化"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    1. string MAP_GETKEYS, mapName\n    2. string MAP_GETKEYS, mapName, doOutput\n    3. string MAP_GETKEYS, mapName, ref outputArray, doOutput\n    4. string MAP_VALUES, mapName\n    5. string MAP_VALUES, mapName, doOutput\n    6. string MAP_VALUES, mapName, ref outputArray, doOutput\n    ```\n\n    输出 `MAP`（键值对映射数组，或称「字典」，[`Dictionary<string,string>`](https://docs.microsoft.com/zh-cn/dotnet/api/system.collections.generic.dictionary-2?view=netframework-4.8)）中保存的键名（key）或值（value）。\n\n    - `MAP_GETKEYS`：输出 `MAP` 的所有键名。\n    - `MAP_VALUES`：Skia（SkiaSharp版）新增。输出 `MAP` 的所有值。与 `MAP_GETKEYS` 对称。\n\n    1. 返回形如 `键名1,键名2,键名3,...` 的字符串。如果指定的 `MAP` 不存在，则返回空字符串。不会抛出异常，如有需要请使用 `MAP_EXIST` 提前进行检查。\n    2. 参数 `doOutput` 为 `0` 以外的数值时，将获取到的键名（或值）依次保存到 `RESULTS`，返回 `RESULTS:0`；并将获取到的 `MAP` 大小保存到 `RESULT`。\n    3. 参数 `doOutput` 为 `0` 以外的数值时，将获取到的键名（或值）依次保存到字符串数组 `outputArray`，返回空字符串。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        #DIM i\n        #DIMS keys, 5\n\n        MAP_CREATE \"MyMap\"\n        FOR i, 0, 5\n            MAP_SET \"MyMap\", TOSTR(i*100), \"\"\n        NEXT\n        PRINTSL MAP_GETKEYS(\"MyMap\")\n        PRINTSL MAP_GETKEYS(\"MyMap\", 1)\n        FOR i, 0, 5\n            PRINTFORML RESULTS:[%RESULTS:i%] key:[%keys:i%]\n        NEXT\n        VARSET RESULTS\n        PRINTSL MAP_GETKEYS(\"MyMap\", keys, 1)\n        FOR i, 0, 5\n            PRINTFORML RESULTS:[%RESULTS:i%] key:[%keys:i%]\n        NEXT\n\n        ONEINPUT\n    ```\n    ```text\n    0,100,200,300,400\n    0\n    RESULTS:[0] key:[]\n    RESULTS:[100] key:[]\n    RESULTS:[200] key:[]\n    RESULTS:[300] key:[]\n    RESULTS:[400] key:[]\n\n    RESULTS:[] key:[0]\n    RESULTS:[] key:[100]\n    RESULTS:[] key:[200]\n    RESULTS:[] key:[300]\n    RESULTS:[] key:[400]\n    ```\n\n### 相关项目\n- MAP操作"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    int MAP_CREATE mapName\n    int MAP_EXIST mapName\n    1 MAP_RELEASE mapName\n    ```\n\n    创建 / 删除 / 判断是否存在 `MAP`（键值对映射数组，或称「字典」，[`Dictionary<string,string>`](https://docs.microsoft.com/zh-cn/dotnet/api/system.collections.generic.dictionary-2?view=netframework-4.8)）的一系列函数。\n\n    - `MAP_CREATE`：生成名为 `mapName` 的 `MAP`。\n        如果已经存在名为 `mapName` 的 `MAP`（创建失败），返回 `0`；若创建成功，返回 `1`。\n    - `MAP_EXIST`：判断是否存在名为 `mapName` 的 `MAP`，若存在，返回 `1`；否则返回 `0`。\n    - `MAP_RELEASE`：删除名为 `mapName` 的 `MAP`。\n\n    !!! warning \"注意\"\n\n        关于生成的 `MAP` 保存进存档文件请参考「`XML`、`MAP`、`DataTable` 保存功能」。「タイトル画面へ戻る（返回标题界面）」或 [`RESETDATA`](https://osdn.net/projects/emuera/wiki/excom#h5-RESETDATA) 后会自动删除。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        PRINTFORML MAP「MyMap」是否存在：{MAP_EXIST(\"MyMap\")}\n        MAP_CREATE \"MyMap\"\n        PRINTSL RESULT ? \"创建成功\" # \"已经存在\"\n        MAP_CREATE \"MyMap\"\n        PRINTSL RESULT ? \"创建成功\" # \"已经存在\"\n\n        RESETDATA ; 自动删除所有 MAP\n\n        MAP_CREATE \"MyMap\"\n        PRINTSL RESULT ? \"创建成功\" # \"已经存在\"\n        PRINTFORML MAP「MyMap」是否存在：{MAP_EXIST(\"MyMap\")}\n        MAP_RELEASE \"MyMap\"\n        PRINTFORML MAP「MyMap」是否存在：{MAP_EXIST(\"MyMap\")}\n\n        ONEINPUT\n    ```\n    ```text\n    MAP「MyMap」是否存在：0\n    创建成功\n    已经存在\n    创建成功\n    MAP「MyMap」是否存在：1\n    MAP「MyMap」是否存在：0\n    ```\n\n### 相关项目\n- MAP操作"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    string MAP_GET mapName, key\n    int MAP_HAS mapName, key\n    int MAP_SET mapName, key, value\n    int MAP_REMOVE mapName, key\n    int MAP_SIZE mapName\n    int MAP_CLEAR mapName\n    ```\n\n    操作已保存的 `MAP`（键值对映射数组，或称「字典」，[`Dictionary<string,string>`](https://docs.microsoft.com/zh-cn/dotnet/api/system.collections.generic.dictionary-2?view=netframework-4.8)）的一系列函数。\n\n    - `MAP_GET`：在名为 `mapName` 的 `MAP` 中取出 `key` 对应的值。指定的 `MAP` 不存在，或没有找到该 `key` 时，返回空字符串。不会抛出异常，如有需要请使用 `MAP_HAS` / `MAP_EXIST` 提前进行检查。\n    - `MAP_HAS`：判断名为 `mapName` 的 `MAP` 中是否存在指定的 `key`。如果存在，返回 `1`，否则返回 `0`。若指定的 `MAP` 本身就不存在，返回 `-1`。\n    - `MAP_SET`：在名为 `mapName` 的 `MAP` 中覆写 `key` 对应的值（`value`）；若指定的 `key` 不存在，自动添加 `key`；成功设置新值后返回 `1`。若指定的 `MAP` 本身就不存在，返回 `-1`。\n    - `MAP_REMOVE`：在名为 `mapName` 的 `MAP` 中删除 `key` 对应的键值对，返回 `1`。若指定的 `MAP` 本身就不存在，返回 `-1`。\n    - `MAP_SIZE`：返回名为 `mapName` 的 `MAP` 中保存的键值对数量。若指定的 `MAP` 本身就不存在，返回 `-1`。\n    - `MAP_CLEAR`：删除名为 `mapName` 的 `MAP` 中保存的所有键值对，返回 `1`。若指定的 `MAP` 本身就不存在，返回 `-1`。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n\n        MAP_CREATE \"MyMap\"\n        PRINTFORML 「MyMap」的大小：{MAP_SIZE(\"MyMap\")}\n        MAP_SET \"MyMap\", \"Id\", \"username\"\n        MAP_SET \"MyMap\", \"PassWord\", \"123456\"\n        PRINTFORML ID：%MAP_GET(\"MyMap\", \"Id\")% Password：%MAP_GET(\"MyMap\", \"PassWord\")%\n        PRINTFORML Name?:{MAP_HAS(\"MyMap\", \"Name\")}\n        PRINTFORML 「MyMap」的大小：{MAP_SIZE(\"MyMap\")}\n        MAP_CLEAR \"MyMap\"\n        PRINTFORML 「MyMap」的大小：{MAP_SIZE(\"MyMap\")}\n\n        ONEINPUT\n    ```\n    ```text\n    「MyMap」的大小：0\n    ID：username Password：123456\n    Name?:0\n    「MyMap」的大小：2\n    「MyMap」的大小：0\n    ```\n\n### 相关项目\n- MAP生成"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    1. string MAP_TOXML, mapName\n    2. int MAP_FROMXML, mapName, xmlMap\n    3. string MAP_TOSTRING, mapName{, sep, kvSep}\n    4. int MAP_FROMSTRING, mapName, data{, sep, kvSep}\n    ```\n\n    将 `MAP`（键值对映射数组，或称「字典」，[`Dictionary<string,string>`](https://docs.microsoft.com/zh-cn/dotnet/api/system.collections.generic.dictionary-2?view=netframework-4.8)）与 `XML` 或字符串互相转换的函数。想把 `MAP` 的内容保存到文件（数据持久化）的时候可以使用。\n\n    - `MAP_TOXML`：将名为 `mapName` 的 `MAP` 转换为 `XML`，返回转换后的 XML 文本。\n    - `MAP_FROMXML`：解析对应格式的 `XML` 并将内容读取到名为 `mapName` 的 `MAP` 中。\n    - `MAP_TOSTRING`：Skia（SkiaSharp版）新增。将名为 `mapName` 的 `MAP` 序列化为 `key=value` 格式的字符串。`sep` 为条目分隔符（默认 `\",\"`），`kvSep` 为键值分隔符（默认 `\"=\"`）。例如：`\"k1=v1,k2=v2,k3=v3\"`。\n    - `MAP_FROMSTRING`：Skia（SkiaSharp版）新增。将 `MAP_TOSTRING` 序列化的字符串反序列化到 `MAP` 中。`sep` 和 `kvSep` 含义与 `MAP_TOSTRING` 相同。按第一个 `kvSep` 分割键和值，空条目或无 `kvSep` 的条目会被跳过。\n\n    `XML` 必须为如下格式：\n    ``` xml\n    <map>\n        <p><k>键名1</k><v>值1</v></p>\n        <p><k>键名2</k><v>值2</v></p>\n        <p><k>键名2</k><v>值3</v></p>\n        ....\n    </map>\n    ```\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        #DIM i\n        #DIMS xml\n\n        MAP_CREATE \"MyMap\"\n        FOR i, 0, 3\n            MAP_SET \"MyMap\", TOSTR(i), TOSTR(i*100)\n        NEXT\n        xml '= MAP_TOXML(\"MyMap\")\n        PRINTSL xml\n\n        MAP_CLEAR \"MyMap\"\n        FOR i, 0, 3\n            MAP_SET \"MyMap\", TOSTR(i), TOSTR(i)\n            PRINTFORML MyMap[\"%TOSTR(i)%\"] = %MAP_GET(\"MyMap\", TOSTR(i))%\n        NEXT\n        PRINTL\n\n        MAP_FROMXML \"MyMap\", xml\n        FOR i, 0, 3\n            PRINTFORML MyMap[\"%TOSTR(i)%\"] = %MAP_GET(\"MyMap\", TOSTR(i))%\n        NEXT\n\n        ONEINPUT\n    ```\n    ```text\n    <map><p><k>0</k><v>0</v></p><p><k>1</k><v>100</v></p><p><k>2</k><v>200</v></p></map>\n    MyMap[\"0\"] = 0\n    MyMap[\"1\"] = 1\n    MyMap[\"2\"] = 2\n\n    MyMap[\"0\"] = 0\n    MyMap[\"1\"] = 100\n    MyMap[\"2\"] = 200\n    ```"
  },
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tint MATCH array, value(, start, end)\n    ```\n    `MATCH` 函数用于返回 `array` 指定的数组变量中，与 `value` 值相等的元素数量。\n    `value` 的类型必须与 `array` 相同。\n    `array` 指定要搜索的一维数组，并在 `start` 以上、`end` 未满的元素范围内进行搜索。\n    如果省略 `end`，则搜索范围直到数组的最后一个元素。\n    `RESULT = MATCH(X, Y, A, B)` 的结果等同于：\n\n            RESULT = 0\n            FOR COUNT, A, B\n                IF X:COUNT == Y\n                    RESULT += 1\n                ENDIF\n            REND\n\n    与以下代码等价。（即使指定字符串数组和字符串表达式代替`X`、`Y`也能正常工作）\n    `array`只能指定一维数组变量，不能指定多维数组。\n    当`array`指定为`CFLAG`等角色数组时，仅对指定的角色进行计数。\n\n!!! hint \"提示\"\n\n    同时支持指令和表达式函数两种形式。\n\n### 相关项目\n- GROUPMATCH"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    MATCHALL var, value[, beg, end[, outArr]]\n    MATCHALLEX \"varName\", value[, beg, end[, outArr]]\n    ```\n    在数组中搜索所有匹配值的索引，返回匹配数量。\n\n    - 第一参数：`MATCHALL` 为变量引用，`MATCHALLEX` 为字符串变量名\n    - 第二参数：搜索值（类型需与数组元素类型一致）\n    - 第三参数（可选）：搜索起始索引（默认 0）\n    - 第四参数（可选）：搜索结束索引（默认数组长度）\n    - 第五参数（可选）：输出数组变量引用，匹配的索引将写入该数组（从 0 开始）\n\n    返回值：匹配的元素数量。未找到返回 0。\n\n!!! hint \"提示\"\n\n    支持命令语法（`MATCHALL ARR, 2`）与表达式语法（`LOCAL = MATCHALL(ARR, 2)`）两种形式。作为命令调用时结果写入 `RESULT` 数组。与 MATCH 不同，MATCHALL 返回所有匹配位置而非仅计数。\n\n    `MATCHALL` 与 `MATCHALLEX` 的区别类似于 `GETNUM` 与 `GETNUMB`：\n    - `MATCHALL` 第一参数是变量引用（编译期解析），性能更好\n    - `MATCHALLEX` 第一参数是字符串变量名（运行期解析），灵活性更高\n\n    当第五参数数组长度不足时，多余的匹配索引被静默丢弃，返回值仍为实际匹配数量。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n        #DIM ARR, 10 = 1, 2, 3, 2, 5, 2, 7, 8, 2, 10\n        #DIM IDX, 10\n\n        ; 仅计数\n        LOCAL = MATCHALL(ARR, 2)\n        PRINTFORML 找到 {LOCAL} 个 2\n\n        ; 输出索引到 IDX\n        LOCAL = MATCHALL(ARR, 2, 0, 10, IDX)\n        FOR I, 0, LOCAL\n            PRINTFORML IDX:{I} = {IDX:I}\n        NEXT\n    ```\n    ```text\n    找到 4 个 2\n    IDX:0 = 1\n    IDX:1 = 3\n    IDX:2 = 5\n    IDX:3 = 8\n    ```\n\n### 相关项目\n- MATCH — 仅计数首个匹配\n- FINDELEMENT — 查找单个元素位置"
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
    "body": "## 基本数学函数\n\n!!! info \"API\"\n\n    ```erb\n    int CBRT value\n    int LOG value\n    int LOG10 value\n    int EXPOMENT value\n    ```\n\n    以下摘自私家改造版更新日志\n\n        新增数学函数作为表达式内函数\n        CBRT（立方根）\n        LOG（自然对数）\n        LOG10（常用对数）\n        EXPONENT（指数函数）\n        所有格式均为：函数名(参数)\n\n    由于 Emuera 无法处理小数，使用时需要一些技巧。\n\n## 三角函数\n\n| 函数名                                                          | 参数          | 返回值              |\n| :-------------------------------------------------------------- | :------------ | :------------------ |\n| [Skia]`SIN`   | `int`/`float` | `int`/`float`（同型） |\n| [Skia]`COS`   | `int`/`float` | `int`/`float`（同型） |\n| [Skia]`TAN`   | `int`/`float` | `int`/`float`（同型） |\n| [Skia]`ASIN`  | `int`/`float` | `int`/`float`（同型） |\n| [Skia]`ACOS`  | `int`/`float` | `int`/`float`（同型） |\n| [Skia]`ATAN`  | `int`/`float` | `int`/`float`（同型） |\n\n!!! info \"API\"\n\n    ```erb\n    int/float SIN angle\n    int/float COS angle\n    int/float TAN angle\n    int/float ASIN value\n    int/float ACOS value\n    int/float ATAN value\n    ```\n\n    Skia（SkiaSharp版）新增。C# 原生三角函数。\n\n    **同名重载**：函数名不区分 Int/Float 版本（无 F 后缀变体）。当参数为 Float 类型时返回 Float，为 Int 类型时返回 Int。与运算符重载一致（`1 + 2.0` 返回 Float，`SIN(1.0)` 也返回 Float）。\n\n    - 参数均为**弧度制**。如需角度转弧度，使用 `angle * PI() / 180`。\n    - `ASIN`/`ACOS` 的参数必须在 `[-1, 1]` 范围内，超出时抛出错误。\n    - Int 版本返回截断小数后的整数值（如 `SIN(1) = 0`，因为 sin(1 rad) ≈ 0.84 → 截断为 0）。\n    - Float 版本返回完整的 double 精度浮点数。\n\n## 端数处理\n\n| 函数名                                                            | 参数          | 返回值              |\n| :---------------------------------------------------------------- | :------------ | :------------------ |\n| [Skia]`FLOOR`   | `int`/`float` | `int`/`float`（同型） |\n| [Skia]`CEIL`    | `int`/`float` | `int`/`float`（同型） |\n| [Skia]`ROUND`   | `int`/`float` | `int`/`float`（同型） |\n\n!!! info \"API\"\n\n    ```erb\n    int/float FLOOR value\n    int/float CEIL value\n    int/float ROUND value\n    ```\n\n    Skia（SkiaSharp版）新增。端数处理函数。同名重载（与三角函数相同）。\n\n    - `FLOOR`：向下取整（向负无穷方向）。\n    - `CEIL`：向上取整（向正无穷方向）。\n    - `ROUND`：四舍五入（`MidpointRounding.AwayFromZero`，0.5 向远离零的方向舍入）。\n    - Int 版本对整数参数无实际效果（整数本身已是整数），主要供语义完整性使用。\n    - Float 版本返回浮点数结果。\n\n!!! hint \"提示\"\n\n    基本数学函数同时支持命令和表达式内函数。三角函数和端数处理仅支持表达式内函数（在表达式中使用）。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n        ; 三角函数（弧度制，Int参数→Int返回值）\n        PRINTFORML SIN(1) = {SIN(1)}\n        PRINTFORML COS(1) = {COS(1)}\n\n        ; Float版（Float参数→Float返回值）\n        #DIMF rad = 0.7853981633974483\n        PRINTFORML SIN(rad) = {SIN(rad)}\n        PRINTFORML COS(rad) = {COS(rad)}\n\n        ; 反三角函数\n        PRINTFORML ASIN(0) = {ASIN(0)}\n        PRINTFORML ACOS(0) = {ACOS(0)}\n\n        ; 端数处理\n        #DIMF val = 3.7\n        PRINTFORML FLOOR(val) = {FLOOR(val)}\n        PRINTFORML CEIL(val) = {CEIL(val)}\n        PRINTFORML ROUND(val) = {ROUND(val)}\n    ```\n    ```text\n    SIN(1) = 0\n    COS(1) = 0\n    SIN(rad) = 0.707106781186548\n    COS(rad) = 0.707106781186548\n    ASIN(0) = 0\n    ACOS(0) = 1\n    FLOOR(val) = 3\n    CEIL(val) = 4\n    ROUND(val) = 4\n    ```"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tint MAX int(, int...)\n\tint MIN int(, int...)\n\tint LIMIT int, minValue, maxValue\n\tint INRANGE int, minValue, maxValue\n    ```\n\t`MAX` 返回参数中的最大值。\n\n\t`MIN` 返回参数中的最小值。\n\n\t`LIMIT` 返回第一个参数的值。\n\t但是，如果第一个参数小于第二个参数，则返回第二个参数的值；如果大于第三个参数，则返回第三个参数的值。\n\t例如，当你想将 `X - Y` 赋值给 `A`，但希望赋值后的值在 `0` 到 `100` 之间时，通常需要这样写：\n\n    ```erb\n\tA = X - Y\n\tSIF A < 0\n\t\tA = 0\n\tSIF A > 100\n\t\tA = 100\n\t```\n\n\t使用 `LIMIT` 命令可以将此操作简化为两行甚至一行。\n\n    ```erb\n    LIMIT X - Y, 0, 100\n    A = RESULT\n\n    A = LIMIT(X - Y, 0, 100)\n    ```\n\n    `INRANGE` 在第一参数的值大于等于第二参数且小于等于第三参数时返回 `1`，在第一参数小于第二参数或大于第三参数时返回 `0`。\n\n!!! hint \"提示\"\n\n    该功能同时支持命令形式和函数形式。\n\n### 相关项目\n- MAXARRAY,MINARRAY"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tint MAXARRAY integerArray(, start, end)\n\tint MINARRAY integerArray(, start, end)\n    ```\n\t返回数组最大值或最小值的函数。\n\t在`integerArray`中指定要搜索的一维数组，并在`start`以上`end`未满的元素范围内进行搜索。\n\t如果省略`end`，则搜索范围直到数组的最后一个元素。\n\t`RESULT = MAXARRAY(X, A, B)`的结果等同于\n\n\t\tRESULT = X:A\n\t\tFOR COUNT, A, B\n\t\t\tIF X:COUNT > RESULT\n\t\t\t\tRESULT = X:COUNT\n\t\t\tENDIF\n\t\tREND\n\n    与以下代码等价。\n    `integerArray` 仅可指定数值型一维数组变量，不能指定字符串变量或多维数组。\n    若在 `integerArray` 中指定了 `CFLAG` 等角色数组，则仅搜索指定的角色。\n\n!!! hint \"提示\"\n\n    同时支持指令和表达式函数两种形式。\n\n### 相关项目\n- MAX,MIN"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tstring MONEYSTR\n    ```\n    对于参数给定的数值，将附有[已设定的货币单位](../Emuera/replace.zh.md)的字符串赋值给`RESULTS:0`或返回。\n    单位的前置/后置也会自动处理。\n    第二个参数与`TOSTR`指令类似，是数值字符串化时的转换格式指定符。\n\n!!! hint \"提示\"\n\n    同时支持指令和表达式函数两种形式。"
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
    "body": "!!! info \"API\"\n\n\t```erb\n\tstring MOUSEB\n\t```\n\n\t获取鼠标悬停中的按钮内容\n\n!!! hint \"提示\"\n\n    支持在表达式中使用\n\t可与 AWAIT 组合使用\n\t由于执行时点无法确定是 `INPUT` 还是 `INPUTS`，因此返回字符串类型\n\n### 相关项目\n- AWAIT"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    MOUSEX\n    MOUSEY\n    ```\n    获取鼠标光标当前的X坐标或Y坐标。\n    坐标是相对于客户端区域左下角位置(0,0)的相对位置，右方向为x轴正方向，下方向为y轴正方向。\n    请注意，当光标位于客户端区域内时，MOUSEY会返回负值。\n    客户端区域的大小可以通过`CLIENTWIDTH`、`CLIENTHEIGHT`函数获取。\n    （如果需要以客户端区域左上角为基准的Y坐标，可以通过`MOUSEY()+CLIENTHEIGHT()`获取）\n    即使Emuera窗口未处于活动状态，或者鼠标光标位于窗口外，此函数也能正常工作。\n\n!!! hint \"提示\"\n\n    同时支持指令和表达式函数两种形式。\n\n### 相关项目\n- AWAIT"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tONEINPUT defaultValue\n\tONEINPUTS defaultValue\n    ```\n\t单字符限定输入自动处理指令 `ONEINPUT`、`ONEINPUTS`\n\t格式：`ONEINPUT` 或 `ONEINPUTS`\n\t功能：仅接受单个字符的输入，输入后自动进行下一步处理\n\n    使用粘贴等方式一次性输入多位数（多个字符）时，仅第一个数字（字符）会被视为有效输入进行处理。\n    与`INPUT`和`INPUTS`类似，可以通过参数设置输入空字符串时的默认值。\n    但是，当`ONEINPUT`指定了负值，或`ONEINPUTS`指定了空字符串时，参数将无效，行为与无参数时相同。\n    此外，若参数为多位数（多个字符），则仅第一个数字（字符）会被作为默认值。\n    省略参数并输入空字符串时，`ONEINPUT`会要求重新输入，`ONEINPUTS`则会将空字符串赋值给`RESULTS`并继续执行后续处理，这与通常行为一致。\n    对于`ONEINPUTS`，即使直接按Enter键保持空字符串，也会被视为输入了空字符串。\n    需要注意的是，使用这些指令时，即使Emuera的CONFIG设置中启用了键盘宏功能，\n    也可能出现无法正常工作的情况，这是预期行为。\n    此外，在`ONEINPUTS`中，与`INPUTS`一样可以使用宏表达式。\n    若需将`()`作为字符串使用，请使用`\\`进行转义。\n\n!!! hint \"提示\"\n\n    仅支持命令。\n### 相关项目\n- INPUT\n- WAITANYKEY"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tOUTPUTLOG (filePath)\n    ```\n    这是日志输出命令 `OUTPUTLOG`。过度使用会缩短磁盘寿命，请适度使用。\n    另外，日志的字符编码是 Unicode。\n    在 EM+EE 中，通过指定参数，可以输出为指定的文件名.扩展名。字面量规则与 `PRINTS` 等相同。\n    `v5fix` 版本修复了可以指定父目录的漏洞。可以指定子目录。\n\n!!! hint \"提示\"\n\n    仅支持命令形式。\n\n### 相关项目\n- SAVETEXT"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    PICKUPCHARA charaID(, charaID...)\n    ```\n    此指令仅保留参数指定的角色，并删除所有其他角色。\n    `MASTER:0`、`TARGET:0`、`ASSI:0` 等会自动跟随调整，指令执行后无需手动重新设置。\n    若为目标角色指定负值将导致错误，但若将 `MASTER`、`TARGET`、`ASSI` 等变量本身设为目标，\n    且这些变量内容为负值时，则作为例外不会出错（会被忽略）。\n\n!!! hint \"提示\"\n\n    仅支持指令形式。\n\n### 相关项目\n- DELCHARA\n- DELALLCHARA"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    PLAYBGM MediaFile\n    ```\n\n    循环播放指定的音频文件（位于 `./sound/` 目录下）。\n\n!!! hint \"提示\"\n\n    只能作为命令使用。\n    最多可以同时播放 10 个音频文件。\n    因为使用了 WMPLib 支持库，所以允许使用 Windows Media Player 进行播放。\n\n### 相关项目\n- PLAYSOUND\n- STOPBGM\n- SETBGMVOLUME"
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
    "body": "!!! info \"API\"\n\n\t```erb\n\tPLAYSOUND MediaFile\n\t```\n\n\t播放一次指定的音频文件（位于 `./sound/` 目录下）。\n\n!!! hint \"提示\"\n\n    只能作为命令使用。\n    最多可以同时播放 10 个音频文件。\n    因为使用了 WMPLib 支持库，所以允许使用 Windows Media Player 进行播放。\n\n### 関連項目\n- PLAYBGM\n- SETSOUNDVOLUME"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tPOWER integerVariable, int, int\n\tint POWER int, int\n\tint/float POWER int/float, int/float\n    ```\n    命令和函数形式的参数不同。\n    命令形式下，会将第二个参数的数值以第三个参数为指数进行乘方运算，结果赋值给第一个参数的变量。\n    函数形式下，会将第一个参数的数值以第二个参数为指数进行乘方运算，并返回结果。\n\n    !!! warning \"Skia 版：函数形式的动态返回类型\"\n\n        Skia 版中，函数形式 `POWER` 传入 Float 型参数时返回 Float 型（`CanReturnFloat` 机制）。所有参数为 Integer 型时，仍返回 Integer 型。\n\n        ```erb\n        POWER(2, 32) - 1      ; Integer → 4294967295\n        POWER(1.1, 6) * 200   ; Float → 354.3122\n        ```\n\n!!! hint \"提示\"\n\n    同时支持命令形式和函数形式。\n\n!!! example \"例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tADDVOIDCHARA\n\t\tTARGET = 0\n\t\tX = 11\n\t\tY = 2\n\t\tPOWER A, X, 2\n\t\tPRINTFORML <TEST1> = {A}\n\t\tPOWER CFLAG:2, X + 1, Y + 1\n\t\tPRINTFORML <TEST2> = {CFLAG:2}\n    ```\n    ```text\n\t<TEST1> = 121\n\t<TEST2> = 1728\n    ```\n\n### 相关项目\n- CBRT, LOG, LOG10, EXPOMENT"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    PRINTV(|K|D)(|L|W|N) expression[, expression, ...]\n    PRINTS(|K|D)(|L|W|N) stringVariable\n    PRINTFORM(|K|D)(|L|W|N) formedString\n    PRINTFORMS(|K|D)(|L|W|N) string\n    ```\n    PRINT系列的基本指令。\n\n    [eramaker]第一个括号内的关键字指定参数类型。\n\n    - 无 - (<字符串>)\n    - V - (<表达式> [, <表达式> ……]) — 每个参数独立求值，整数表达式输出数值，字符串表达式输出文本\n    - S - <字符串表达式>\n    - FORM - (<格式化字符串>)\n    - FORMS - <格式化字符串表达式>\n\n    [Emuera]第二个括号内的关键字\"K\"指定应用FORCEKANA指令。关键字\"D\"指定忽略SETCOLOR指令。关键字K和D不能同时指定。\n\n    - 无 - 忽略`FORCEKANA`，并以`SETCOLOR`指定的颜色绘制。\n    - K - 应用`FORCEKANA`进行绘制。\n    - D - 忽略`SETCOLOR`，以配置中指定的默认颜色绘制。\n\n    [eramaker]第三个括号内的关键字指定绘制后的换行和WAIT是否存在。\n\n    - 无 - 仅`PRINT`，不换行也不执行`WAIT`。\n    - L - `PRINT`后换行。\n    - W - `PRINT`后换行并执行`WAIT`指令。\n    - [.NET]N - `PRINT`后不换行，仅执行`WAIT`指令。目前不能与第二个括号内的关键字K或D组合使用。\n    - 这些组合使得例如`PRINTSDW`意味着：以<字符串表达式>为参数，以默认颜色绘制，并在`PRINT`后执行`WAIT`指令。\n\n!!! hint \"提示\"\n\n    仅支持作为指令使用。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n    #DIM HOGE\n    #DIMS HOGES\n    \tPRINT 1+2=\n    \tHOGE = 3\n    \tPRINTV HOGE\n    \tPRINTL\n    \tPRINT HOGES is\n    \tHOGES = String\n    \tPRINTSL HOGES\n    \tPRINT HOGE*HOGE=\n    \tPRINTFORMSL HOGES*HOGE\n    \tSETCOLORBYNAME yellow\n    \tHOGE = GETCOLOR()\n    \tPRINTFORML Now color is R:{HOGE/0x10000} G:{HOGE/0x100%0x100} B:{HOGE%0x100}\n    \tHOGES = but PRINTD will ignore SETCOLOR\n    \tPRINTSDL HOGES\n    \tHOGES = 示例到此结束\n    \tFORCEKANA 2\n    \tPRINTK 打印的\n    \tPRINTFORMKW %HOGES%\n    ```\n    ![](../assets/images/PRINT.png)\n\n### 相关项目\n- [基本输出](../tutorial/basic-output.zh.md) — PRINT 系列教程：参数类型、行为后缀、输出颜色、按钮\n- PRINTBUTTON\n- BITMAP_CACHE_ENABLE\n- [Emuera新增语法>格式化字符串（FORM语法）扩展](../Emuera/expression.md#form_1)"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tPRINT_IMG spriteName\n\tPRINT_IMG spriteName, width, height, ypos\n\tPRINT_IMG spriteName, spriteNameBack, width, height, ypos\n\tPRINT_IMG spriteName, spriteNameBack, colorMatrix, width, height, ypos\n    ```\n\t在行中显示指定的图像。\n\t相当于 [`HTML_PRINT` 命令的 `<img>` 标签](../Emuera/HTML_PRINT.md#img)。\n\tEM+EE 中扩展了语法。详情请参阅[摘要](../EMEE/EMEE_Summary.zh.md)。\n\n!!! hint \"提示\"\n\n    仅支持命令形式。\n\n### 相关项目\n- SPRITECREATE"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tPRINT_RECT width\n\tPRINT_RECT xPos, yPos, width, height\n    ```\n\t在行内显示一个宽度为字体大小参数百分比的长方形。或者，在行内显示一个`x`、`y`、`宽度`、`高度`分别为参数百分比的长方形。\n\t可以通过`SETCOLOR`命令像改变字体颜色一样改变其颜色。\n\t相当于[`HTML_PRINT`命令的`<shape type='rect'>`标签](../Emuera/HTML_PRINT.md#shape)。\n\t在EM+EE中，也支持使用`px`单位进行指定。\n\n!!! hint \"提示\"\n\n    仅支持命令形式。"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    PRINT_SPACE width\n    ```\n    创建一个宽度为参数指定字体大小百分比的无内容显示空间。\n    相当于 [`HTML_PRINT` 命令的 `<shape type='space'>` 标签](../Emuera/HTML_PRINT.md#shape)。\n    在 EM+EE 中，现在也可以使用 `px` 单位来指定宽度。\n\n!!! hint \"提示\"\n\n    仅支持作为命令使用。"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tPRINT_ABL charaID\n\tPRINT_TALENT charaID\n\tPRINT_MARK charaID\n\tPRINT_EXP charaID\n\tPRINT_PALAM charaID\n\tPRINT_ITEM\n\tPRINT_SHOPITEM\n    ```\n    分别简易显示当前状态。`PRINT_ABL`、`PRINT_TALENT`、`PRINT_MARK`、`PRINT_EXP`、`PRINT_PALAM` 请将角色登记编号 (CharaID) 指定为参数。\n\n!!! hint \"提示\"\n\n    仅支持指令。\n\n!!! example \"示例\"\n\n    ```erb\n\t0,能力0\n\t1,能力1\n\t2,能力2\n\t```\n\n    ```erb\n    @SYSTEM_TITLE\n            ADDVOIDCHARA\n            ABL:0:0 = 2\n            ABL:0:2 = 3\n\n            PRINT_ABL 0\n            WAIT\n    ```\n    ```text\n    能力0LV2 能力2LV3\n    ```"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    PRINTBUTTON(|C|LC) string, buttonValue\n    ```\n    `PRINTBUTTON` 指令用于生成可通过鼠标点击的按钮。\n    其格式与 `PRINTS` 指令相似，但需要指定第二个参数，即点击按钮时输入的数字或字符串。如果第一个参数中包含换行符，该换行符将被忽略且不会导致换行。\n\n    Emuera 会自动将类似 `[300] 保存` 这样用 `[]` 括起来的数字及其前后的字符串转换为按钮。\n    `PRINTBUTTON` 指令的作用就是强制生成此类按钮，而非依赖自动转换。\n    该指令在以下情况下特别有用：\n\n    ```erb\n    PRINT 这样可以吗？ [0] 是    [1] 否\n    INPUT\n    ```\n\n    对于这样的行，Emuera 无法正确识别按钮，会将其识别为 `これでいい？ [0] はい` 和 `[1] いいえ` 两个按钮。\n    使用 `PRINTBUTTON` 重写后如下所示：\n\n    ```erb\n    PRINTS \"これでいい？ \"\n    PRINTBUTTON \"[0] はい\", 0\n    PRINTS \"     \"\n    PRINTBUTTON \"[1] いいえ\", 1\n    INPUT\n    ```\n\n    （这里使用`PRINTS`命令代替`PRINT`是为了明确显示半角空格的数量）\n    这样处理后，`これでいい？ `将不再是按钮，只有`[0] はい`和`[1] いいえ`会成为按钮。\n    需要注意的是，`PRINTBUTTON`命令中显示的字符串并非必须包含`[0]`或`[1]`等数字，但如果完全不显示对应的数字，可能会让使用数字键盘等设备进行操作的玩家感到困惑。因此建议仍按惯例显示`[0]`等数字。\n    此外，`PRINTBUTTON`命令不仅可以创建输入数字的按钮，还可以创建输入字符串的按钮。这样创建的按钮可以在执行`INPUTS`命令时被点击。\n\n    ```erb\n    PRINTL 请输入姓名。\n    PRINTBUTTON \"[HogeHoge] \", \"HogeHoge\"\n    PRINTBUTTON \"[PugePuge] \", \"PugePuge\"\n    PRINTBUTTON \"[FooBar] \", \"FooBar\"\n    INPUTS\n    ```\n\n    括号内的关键字用于指定文本对齐方式。\n\n    - 无 - 不对齐\n    - `C` - 与 `PRINTC` 类似，向右对齐\n    - `LC` - 与 `PRINTLC` 类似，向左对齐\n\n!!! hint \"提示\"\n\n    仅支持命令。\n\n### 相关项目\n- PRINT"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    PRINT(C|L)(|K|D) string\n    PRINTFORM(C|L)(|K|D)(|L|W) formedString\n    ```\n    这是 `PRINTC` 系列命令。\n    这些命令会根据配置 [`PRINTC的字符数`](../Emuera/config.md#printc_1)（默认值 25）指定的字符数，通过补充半角空格来对齐并打印字符串。\n    此外，在 Emuera 中，对已 `PRINT` 的字符串进行按钮化处理时，会对 `PRINTC` 系列命令进行一些特殊处理。\n\n    第一个括号内的关键字指定参数类型。\n\n    - 无 - <字符串>\n    - `FORM` - <格式化字符串>\n\n    第二个括号内的关键字指定对齐方式。\n\n    - `C` - 右对齐（在左侧添加半角空格）\n    - `LC` - 左对齐。\n\n    第三个括号内的 `K`、`D` 与 `PRINT` 系列命令相同。\n\n    !!! hint \"提示\"\n\n        仅支持命令形式。\n\n    !!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n        PRINTC AAA\n        PRINT |\n        PRINTC BBB\n        PRINT |\n        PRINTC CCC\n        PRINTL |\n        PRINTLC DDD\n        PRINT |\n        PRINTLC EEE\n        PRINT |\n        PRINTLC FFF\n        PRINTL |\n        PRINTC GGG\n        PRINT |\n        PRINTLC HHH\n        PRINT |\n        PRINTC III\n        PRINTW |\n    ```\n    ```text\n                            AAA|                      BBB|                      CCC|\n    DDD                        |EEE                      |FFF                      |\n                            GGG|HHH                      |                      III|\n\n    ```\n\n### 相关项目\n- PRINTCPERLINE\n- PRINTCLENGTH"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tint PRINTCLENGTH\n    ```\n\t返回配置项[`PRINTC的字符数`](../Emuera/config.md#printc_1)的值。与 RESULT = GETCONFIG(\"PRINTC的字符数\") 同义。\n\n!!! hint \"提示\"\n\n    同时支持指令和表达式函数。\n\n### 相关项目\n- PRINTCPERLINE"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tint PRINTCPERLINE\n    ```\n\t将[配置`PRINTC排列数量`](../Emuera/config.md#printc)中指定的数值赋值给RESULT:0，或返回该值。默认值为3。\n\t等同于`RESULT = GETCONFIG(\"PRINTC排列数量\")`\n\n!!! hint \"提示\"\n\n    支持指令和表达式函数两种用法。\n\n### 相关项目\n- PRINTCLENGTH"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    PRINTDATA(|K|D)(|L|W)\n    \tDATA string\n    \tDATAFORM formedString\n    \tDATALIST\n    \tENDLIST\n    ENDDATA\n    ```\n    这是 `PRINTDATA` 系列指令。根据私家改造版 readme 的说明，\n\n    ```erb\n    ;*格式*\n    PRINTDATA (数值变量：可省略)\n    \tDATA (字符串)\n    \tDATAFORM (FORM字符串)\n    \tDATALIST\n    \t\t(DATA 或 DATAFORM 的罗列)\n    \tENDLIST\n    ENDDATA\n    ```\n\n\t    *内容*\n\t    将DATA、DATAFORM以及DATALIST～ENDLIST中指定的字符串以等概率随机显示\n\t    无需使用IF和RAND即可实现随机显示\n\t    若在参数中指定了数值变量，则会存入所显示的变量DATA的编号\n\t    适用于想根据显示的字符串来调整后续处理的情况\n\t    DATALIST～ENDLIST内部，每个DATA或DATAFORM相当于一行\n\n\t如上所述。\n\t`K`、`D`、`L`、`W`关键字的效果与`PRINT`系命令相同。\n\t若`PRINTDATA`系～`ENDDATA`内部没有通过`DATA`系提供显示数据，则不执行任何操作并继续执行后续命令。\n\t不能在`PRINTDATA`系～`ENDDATA`以及`DATALIST`～`ENDLIST`内部书写上述语法以外的内容。\n\n!!! hint \"提示\"\n\n\t仅支持命令形式。\n\n!!! example \"示例\"\n\n```erb\n@SYSTEM_TITLE\n\tREPEAT 10\n\t\tPRINTDATA\n\t\t\tDATA A\n\t\t\tDATA B\n\t\t\tDATA C\n\t\t\tDATA D\n\t\t\tDATA E\n\t\tENDDATA\n\tREND\n\n\tWAIT\n```\n```text\nDBDAEACDAE\n```\n\n### 相关项目\n- STRDATA\n- SELECTCASE\n- RAND"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    PRINTN string\n    PRINTVN expression[, expression, ...]\n    PRINTSN stringVariable\n    PRINTFORMN formedString\n    PRINTFORMSN string\n    ```\n    这是不换行的 `PRINTW` 命令。仅添加在上述基本的 `PRINT` 命令中。\n    各命令的行为和字面量与 `PRINT` 系列命令 相同。\n\n!!! hint \"提示\"\n\n    仅命令本身支持此功能。\n\n### 相关项目\n- PRINT"
  }
];
