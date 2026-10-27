// 本文件由 scripts/build-reference.ts 生成，请勿手工修改。
//
// 数据来源：https://github.com/qirchen421/emuera.sk.doc  docs/Reference、docs/Emuera、docs/tutorial/*.zh.md
// 上游版本：41451be6091363e37ed066aaf04416decbf0127f
// 许可：CC BY-NC 4.0（http://creativecommons.org/licenses/by-nc/4.0/）
//       与本仓库代码的 Apache-2.0 分开管理，见 NOTICE-emuera-sk-doc.md
import type { ReferenceEntry } from '../types.js';

export const ENTRIES_PART_04: readonly ReferenceEntry[] = [
  {
    "id": "Emuera/variables#GLOBAL",
    "pageId": "Emuera/variables",
    "sourcePath": "docs/Emuera/variables.zh.md",
    "localOnly": true,
    "title": "GLOBAL",
    "names": [
      "GLOBAL"
    ],
    "signatures": [],
    "summary": "GLOBAL",
    "body": ""
  },
  {
    "id": "Emuera/variables#GLOBALS",
    "pageId": "Emuera/variables",
    "sourcePath": "docs/Emuera/variables.zh.md",
    "localOnly": true,
    "title": "GLOBALS",
    "names": [
      "GLOBALS"
    ],
    "signatures": [],
    "summary": "可以在不同存档数据间共享的变量。",
    "body": "可以在不同存档数据间共享的变量。\n`GLOBAL`为整数，`GLOBALS`为字符串\n大小基本为`GLOBAL`1000，`GLOBALS`100，可通过`VariableSize.csv`更改。\n不与其它数据一同保存·加载。\n要保存全局变量，使用`SAVEGLOBAL`指令。\n执行`SAVEGLOBAL`时，`GLOBAL`和`GLOBALS`会被保存到`global.sav`。\n写入时如果已有`global.sav`，会覆盖\n通过`LOADGLOBAL`指令，可从`global.sav`读取`GLOBAL`和`GLOBALS`。\n建议在`@EVENTFIRST`和`@EVENTLOAD`时机执行`LOADGLOBAL`。\n通过`GLOBAL`、`GLOBALS`可以在不同存档数据间共享数据。\n\n### （用户定义的全局变量）\n\n在ERH中定义`#DIM GLOBAL`或`#DIMS GLOBAL`定义的变量成为全局变量。\n另外，使用`#DIM SAVEDATA GLOBAL`可以成为可保存的全局变量。\n详情请参考头文件（ERH）。\n\n### 角色变量"
  },
  {
    "id": "Emuera/variables#ISTIMEOUT",
    "pageId": "Emuera/variables",
    "sourcePath": "docs/Emuera/variables.zh.md",
    "localOnly": true,
    "title": "ISTIMEOUT",
    "names": [
      "ISTIMEOUT"
    ],
    "signatures": [],
    "summary": "以下，摘自私人修改版1809+v2附带的readme",
    "body": "以下，摘自私人修改版1809+v2附带的readme\n\n\t○新增检查TINPUT系列是否超时的变量ISTIMEOUT\n\t　TINPUT系列被调用时初始化为0，超时时变为1。\n\n截至ver1815，此变量可能无法使用。\n\n### __INT_MAX__\n\n### __INT_MIN__\n\n记录数值型变量定义域最大值、最小值的常量的非数组数值型变量，赋值·保存均不可能。\n不是调试变量，普通启动时也可以使用。\n\n### （用户定义的全局变量）\n\n在ERH中定义`#DIM`或`#DIMS`定义的变量成为全局变量，可像一字符变量（`A`等）一样自由处理。\n详情请参考头文件（ERH）。\n\n### （用户定义的常量）\n\n在ERH中及特定函数中，定义`#DIM`或`#DIMS`定义的变量成为一维数组常量，作为不可赋值的变量处理。\n详情请参考用户定义的变量。\n\n### （用户定义的引用型变量）\n\n在特定函数中定义`#DIM REF`或`#DIMS REF`定义的变量成为引用型变量。\n详情请参考用户定义的变量。\n\n### 与maker的规格差异"
  },
  {
    "id": "Emuera/variables#LINECOUNT",
    "pageId": "Emuera/variables",
    "sourcePath": "docs/Emuera/variables.zh.md",
    "localOnly": true,
    "title": "LINECOUNT",
    "names": [
      "LINECOUNT"
    ],
    "signatures": [],
    "summary": "返回迄今为止PRINT的行数的变量。",
    "body": "返回迄今为止`PRINT`的行数的变量。\n`LINECOUNT`从启动后开始，每当换行（不包括因窗口宽度导致的换行）时+1，`CLEARLINE`时减少相应的数量。\n不会因日志缓冲区（标准5000）溢出导致的删除而变动。\n非数组数值型变量，赋值·保存均不可能。\n另外，计数方式与`CLEARLINE`相同。"
  },
  {
    "id": "Emuera/variables#LOCAL",
    "pageId": "Emuera/variables",
    "sourcePath": "docs/Emuera/variables.zh.md",
    "localOnly": true,
    "title": "LOCAL",
    "names": [
      "LOCAL"
    ],
    "signatures": [],
    "summary": "Emuera中有两种不同的\"角色编号\"概念，理解它们的区别对于正确操作角色数据至关重要：",
    "body": "### 核心概念区分\n\nEmuera中有两种不同的\"角色编号\"概念，理解它们的区别对于正确操作角色数据至关重要：\n\n| 概念 | 标识符 | 日文原文 | 定义 | 特点 |\n|------|--------|---------|------|------|\n| **角色登记编号 (CharaID)** | `MASTER`/`TARGET`/`ASSI`/`PLAYER` | キャラ登録番号 | 当前游戏状态中动态分配的索引 | 从0开始连续，随角色增删而变化 |\n| **角色注册编号 (NO)** | `NO` | キャラ番号 | CharaXX.CSV中定义的固定编号 | 静态不变，用于标识角色模板 |\n\n### 详细说明\n\n### 角色登记编号 (CharaID)（动态索引）\n\n**`MASTER`** `[VariableCode.MASTER]` — 主角的登记编号 (CharaID)，通常为 `0`\n\n**`TARGET`** `[VariableCode.TARGET]` — 当前调教中角色的登记编号 (CharaID)\n\n**`ASSI`** `[VariableCode.ASSI]` — 助手角色的登记编号 (CharaID)，无助手时为 `-1`\n\n登记编号 (CharaID) 的特点：\n- 游戏启动时，主角自动登记，登记编号 (CharaID) 为 `0`\n- 通过 `ADDCHARA` 指令登记新角色时，分配下一个连续的编号\n- 通过 `DELCHARA` 指令删除角色后，后续角色的登记编号 (CharaID) 会重新排列\n- 始终从 `0` 开始连续分配（如：0, 1, 2, 3...）\n\n### 角色注册编号 (NO)（静态编号）\n\n**`NO`** `[VariableCode.NO]` — 角色在 CSV 文件中定义的固定编号\n\n角色注册编号 (NO) 的特点：\n- 在 `CharaXX.CSV` 文件的第一列（编号列）中定义\n- 不会随角色的添加/删除而改变\n- 用于标识角色的模板定义\n- `ADDCHARA` 指令使用此编号指定要添加的角色模板\n\n### 访问方式对比\n\n```erb\n; 通过登记编号 (CharaID) 访问（动态索引）\nBASE:TARGET:0      ; 读取调教中角色的基础参数0\nEX:MASTER:5        ; 读取主角的经验值5\n\n; 通过角色注册编号 (NO) 访问（静态编号）\n; 使用 GETCHARA 函数获取登记编号 (CharaID)\n#DIM L_REG_NO\nL_REG_NO = GETCHARA(5)      ; 获取角色注册编号 (NO) 为5的角色的登记编号 (CharaID)\nBASE:L_REG_NO:0     ; 读取该角色的基础参数0\n\n; RELATION 是特殊情况，第二参数是角色注册编号 (NO) 而非登记编号 (CharaID)\nRELATION:TARGET:3   ; 调教中角色与角色注册编号 (NO) 为3的角色的相性\n```\n\n### 常用操作\n\n```erb\n; 遍历所有已登记角色\nREPEAT CHARANUM\n    ; COUNT 为当前角色的登记编号 (CharaID)（0 ~ CHARANUM-1）\n    PRINTFORML 登记编号(CharaID)={COUNT}, 注册编号(NO)={NO:COUNT}\nREND\n\n; 查找指定角色注册编号 (NO) 的登记编号 (CharaID)\n#DIM L_FIND\nL_FIND = GETCHARA(10)   ; 查找角色注册编号 (NO) 为10的角色\nIF L_FIND >= 0\n    PRINTFORML 找到角色，登记编号(CharaID)={L_FIND}\nELSE\n    PRINTL 角色不存在\nENDIF\n```\n\n---\n\n### 常量表示\n\n在Emuera中，除了八进制表示外，可以直接使用吉里吉里中可用的常量表示。\n例如以下各行都具有相同含义。\n\n\tX = 32\n\tX = 0b100000\n\tX = 0x20\n\tX = 1p5\n\n从上到下依次为普通`十进制表示`、`二进制`、`十六进制`、`1×2的5次方`。\n像`1p5`这样的表示在与位运算符结合使用、获取或设置各位时很方便。\n例如以下条件语句在`A`的第0位或第3位为1时为真。\n\n\tIF (A & 1p0) || (A & 1p3)\n\n另外，使用`e`代替`p`可以表示`n×10的m次方`。\n例如`13e3`等于`13000`。\n以上都只是常量的表示，不能使用表达式。\n以下表示会出错。\n\n\tX = 13e(A + 1)\n\n由于与eramaker的兼容性问题，没有采用`八进制表示`。\n`012`被解释为`12`而不是`10`。\n\n### 变量大小指定\n\n在Emuera中，可以在csv文件夹中放置名为`VariableSize.csv`的文件来指定现有变量的元素数。\n另外，通过将元素数指定为`-1`，可以禁止在ERB中使用该变量。\n\n在ERB中对被禁止设置的变量进行赋值或引用时会出错。当系统需要使用被禁止设置的变量时，赋值处理会被忽略，值始终被视为`-1`。\n（发生在`MONEY`或`NEXTCOM`被禁止时的情况）\n另外，当`COUNT`被设为禁止变量时，`REPEAT`也会不可用，并在运行时出错（EM+EE）\n\n### 局部变量"
  },
  {
    "id": "Emuera/variables#LOCALS",
    "pageId": "Emuera/variables",
    "sourcePath": "docs/Emuera/variables.zh.md",
    "localOnly": true,
    "title": "LOCALS",
    "names": [
      "LOCALS"
    ],
    "signatures": [],
    "summary": "※此变量已过时，不推荐使用。请使用#DIM、#DIMS替代。",
    "body": "**※此变量已**过时**，不推荐使用。请使用`#DIM`、`#DIMS`替代。**\n**详情请参考用户定义的变量。**\n**对于新游戏开发，建议在`VariableSize.csv`中将`LOCAL`和`LOCALS`的元素数均设为`-1`以禁用，强制迁移到`#DIM`/`#DIMS`。**\n\n局部变量（函数级变量）。\n`LOCAL`为整数型，`LOCALS`为字符串型。\n默认大小为`LOCAL`1000，`LOCALS`100。\n另外，可以通过`#LOCALSIZE <元素数>`和`#LOCALSSIZE <元素数>`\n对每个函数分别更改元素数。（但设置的值必须是大于0的整数）\n不会被保存。\n\n\t@EVENTFIRST\n\t\tLOCAL:10 = 123\n\t\tCALL FUNC001\n\t\tPRINTV LOCAL:10\n\t\tWAIT\n\t@FUNC001\n\t\tLOCAL:10 = 567\n\t\tRETURN\n\n上述代码的[`PRINTV`](../Reference/PRINT.zh.md)结果为`123`。\n在`@FUNC001`中修改了`LOCAL:10`，但不会影响`@EVENTFIRST`中的`LOCAL`。\n与多数语言的局部变量不同，函数调用时不会进行初始化。\n\n内部实现为创建`LOCAL@函数名`这样的变量。\n因此，事件函数等同名函数存在多个定义时，它们会共用同一组 LOCAL 变量。另外，递归调用时也会使用相同的变量。\n像`LOCAL@EVENTFIRST:10 = 567`这样访问其他函数的变量也是可以的，但不推荐（这是调试用功能）。\n另外，访问其他函数的变量时，如果被调用函数名包含运算符等特殊字符会出错"
  },
  {
    "id": "Emuera/variables#MASTERNAME",
    "pageId": "Emuera/variables",
    "sourcePath": "docs/Emuera/variables.zh.md",
    "localOnly": true,
    "title": "MASTERNAME",
    "names": [
      "MASTERNAME"
    ],
    "signatures": [],
    "summary": "与NAME或CALLNAME相同的可保存字符串型变量。",
    "body": "与`NAME`或`CALLNAME`相同的可保存字符串型变量。\n在`chara*.csv`中指定为`NICKNAME`、`MASTERNAME`或`昵称`、`主人的称呼`。"
  },
  {
    "id": "Emuera/variables#NAME",
    "pageId": "Emuera/variables",
    "sourcePath": "docs/Emuera/variables.zh.md",
    "localOnly": true,
    "title": "NAME",
    "names": [
      "NAME"
    ],
    "signatures": [],
    "summary": "NAME",
    "body": ""
  },
  {
    "id": "Emuera/variables#NICKNAME",
    "pageId": "Emuera/variables",
    "sourcePath": "docs/Emuera/variables.zh.md",
    "localOnly": true,
    "title": "NICKNAME",
    "names": [
      "NICKNAME"
    ],
    "signatures": [],
    "summary": "NICKNAME",
    "body": ""
  },
  {
    "id": "Emuera/variables#RAND",
    "pageId": "Emuera/variables",
    "sourcePath": "docs/Emuera/variables.zh.md",
    "localOnly": true,
    "title": "RAND",
    "names": [
      "RAND"
    ],
    "signatures": [],
    "summary": "RAND",
    "body": ""
  },
  {
    "id": "Emuera/variables#RANDDATA",
    "pageId": "Emuera/variables",
    "sourcePath": "docs/Emuera/variables.zh.md",
    "localOnly": true,
    "title": "RANDDATA",
    "names": [
      "RANDDATA"
    ],
    "signatures": [],
    "summary": "记录随机数状态的数组。数值型一维数组，可赋值、可保存。",
    "body": "记录随机数状态的数组。数值型一维数组，可赋值、可保存。\n通过`DUMPRAND`记录，通过`INITRAND`读取。"
  },
  {
    "id": "Emuera/variables#SAVEDATA_TEXT",
    "pageId": "Emuera/variables",
    "sourcePath": "docs/Emuera/variables.zh.md",
    "localOnly": true,
    "title": "SAVEDATA_TEXT",
    "names": [
      "SAVEDATA_TEXT"
    ],
    "signatures": [],
    "summary": "保存在存档数据中，在保存/加载画面显示的文本。",
    "body": "保存在存档数据中，在保存/加载画面显示的文本。\n也是加载后可通过`LASTLOAD_TEXT`引用的文本。\n可以引用也可以赋值。\n在`@SAVEINFO`被调用时，会赋值为表示当前时间的字符串，是可以用`PUTFORM`追加的字符串。\n在`@SAVEINFO`中直接对此字符串赋值可以自定义时间显示。\n使用`SAVEGAME`和`PUTFORM`（使用`SAVELOAD.ERB`时）时才有用。\n\n### （用户定义的可保存全局变量）\n\n在ERH中定义`#DIM SAVEDATA`或`#DIMS SAVEDATA\"`定义的变量成为可保存的全局变量。\n但是，使用`#DIMS SAVEDATA`定义可保存的多维全局变量时，选项[`以二进制格式保存存档数据`](config.md#_43)必须启用。\n详情请参考头文件（ERH）。\n\n### 多维数组变量"
  },
  {
    "id": "Emuera/variables#TCVAR",
    "pageId": "Emuera/variables",
    "sourcePath": "docs/Emuera/variables.zh.md",
    "localOnly": true,
    "title": "TCVAR",
    "names": [
      "TCVAR"
    ],
    "signatures": [],
    "summary": "数值型数组变量。",
    "body": "数值型数组变量。\n分别设想作为`UP`、`DOWN`、`LOSEBASE`、`TFLAG`的角色变量版本使用。\n因此初始化时机和是否可保存也与这些变量相同。\n但是，`CUP`和`CDOWN`需要使用`CUPCHECK`指令代替[`UPCHECK`](../Reference/UPCHECK.zh.md)指令。"
  },
  {
    "id": "Emuera/variables#TSTR",
    "pageId": "Emuera/variables",
    "sourcePath": "docs/Emuera/variables.zh.md",
    "localOnly": true,
    "title": "TSTR",
    "names": [
      "TSTR"
    ],
    "signatures": [],
    "summary": "字符串型一维数组。一维数组，不保存。",
    "body": "字符串型一维数组。一维数组，不保存。\n与`TFLAG`相同时机初始化。"
  },
  {
    "id": "Emuera/variables#WINDOW_TITLE",
    "pageId": "Emuera/variables",
    "sourcePath": "docs/Emuera/variables.zh.md",
    "localOnly": true,
    "title": "WINDOW_TITLE",
    "names": [
      "WINDOW_TITLE"
    ],
    "signatures": [],
    "summary": "Emuera窗口标题栏显示的字符串。",
    "body": "Emuera窗口标题栏显示的字符串。\n非数组字符串型变量。初始值为`gamebase.csv`中设置的`窗口标题`值。\n如果没有设置`窗口标题`，则根据`标题`和`版本`生成。\n如果连`标题`都没有设置，则为`Emuera`。\n\n### 其他与csv相关的变量\n\n##### `MONEYLABEL`\n记录货币单位的变量。\n非数组字符串型变量，不可赋值、不保存变量。\n初始值为在`_Replace.csv`中设置的`货币单位`值。\n如果没有设置`货币单位`，则与eramaker相同为`$`。\n\n##### `DRAWLINESTR`\n记录执行[`DRAWLINE`](../Reference/DRAWLINE.zh.md)指令时显示的字符串的变量。\n非数组字符串型变量，不可赋值、不保存变量。\n初始值为重复在`_Replace.csv`中设置的`DRAWLINE字符`的值。\n因此并不直接包含`DRAWLINE字符`设置的字符串。\n如果没有设置`DRAWLINE字符`，则与eramaker相同，例如\n`------------------------------------------------------------------------------------------------------------`。\n\n### 保存加载相关\n\n### LASTLOAD_*\n\n用于引用最后一次加载的数据信息的变量。\n可以引用但不能赋值。\n全部初始值为`-1`或空字符串。\n加载时更新，执行`RESETDATA`或菜单的\"返回标题\"时恢复初始值。\n\n##### `LASTLOAD_VERSION`\n最后加载的数据的版本（`gamebase.csv`中定义的值）\n\n##### `LASTLOAD_NO`\n最后加载的数据的编号（`save*.sav`的`*`对应的编号）\n\n##### `LASTLOAD_TEXT`\n文本（在[`PUTFORM`](../Reference/PUTFORM.zh.md)中添加的文本。`SAVEDATA_TEXT`）"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tint ENABLE_INPUT_MACRO\n    ```\n    恢复输入宏解析（默认行为）。调用 `DISABLE_INPUT_MACRO` 后可用此函数恢复原版 PressEnterKey 的宏解析、`\\n` 拆分和 `\\e` MesSkip 处理。\n\n    - 返回值始终为 `0`\n\n!!! warning \"注意\"\n\n    由于 `CanRestructure = false`，不会成为常量折叠的对象。\n\n### 相关项目\n- DISABLE_INPUT_MACRO\n- SEQUENCEINPUT\n- INPUT",
    "sourcePath": "docs/Reference/ENABLE_INPUT_MACRO.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    int ENUMFILES dir, pattern, option\n    ```\n\n    将文件夹`dir`下满足`pattern`规则的文件名代入`RESULTS`数组。返回符合条件的文件数。\n\n    - `dir`必须为`Emuera.exe`同级的相对路径(试图使用`..`回到更上级的目录是无效的)。\n    - `pattern`的默认值是`*`(匹配所有文件)，详细用法请参考[Directory.EnumerateFiles](https://docs.microsoft.com/en-us/dotnet/api/system.io.directory.enumeratefiles?view=netframework-4.8)。\n    - `option`的默认值为`0`，不搜索子文件夹。为其它值时则也会搜索子文件夹下的文件。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n    ```text\n    csv\n     - Chara\n        - Chara001.csv\n     - _Default.config\n     - _Fixed.config\n     - VariableSize.csv\n    ```\n    ```erb\n    @SYSTEM_TITLE\n        #DIM i\n        #DIM total\n\n        total = ENUMFILES(\"csv\")\n        PRINTFORML 所有文件数目（子文件夹除外）：{total}\n        FOR i, 0, total\n            PRINTSL RESULTS:i\n        NEXT\n        PRINTL\n\n        total = ENUMFILES(\"csv\", \"*.csv\", 1)\n        PRINTFORML CSV文件数目：{total}\n        FOR i, 0, total\n            PRINTSL RESULTS:i\n        NEXT\n\n        ONEINPUT\n    ```\n    ```text\n    所有文件数目（子文件夹除外）：3\n    csv\\VariableSize.csv\n    csv\\_Default.config\n    csv\\_Fixed.config\n\n    CSV文件数目：2\n    csv\\VariableSize.csv\n    csv\\Chara\\Chara001.csv\n    ```\n\n### 相关项目\n- EXISTFILE",
    "sourcePath": "docs/Reference/ENUMFILES.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    int ENUMFUNCBEGINSWITH keyword\n    int ENUMFUNCENDSWITH keyword\n    int ENUMFUNCWITH keyword\n    ```\n\n    将定义的函数名中包含 `keyword` 的具体函数名保存到 `RESULTS` 数组，同时返回总数（`RESULT`）。\n\n    - `ENUMFUNCBEGINSWITH` 返回以 `keyword` 开头的函数数量。\n    - `ENUMFUNCENDSWITH` 返回以 `keyword` 结尾的函数数量。\n    - `ENUMFUNCWITH` 返回包含 `keyword` 的函数数量。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n\n        PRINTFORML 函数名以\"Foo\"开头的函数数量:{ENUMFUNCBEGINSWITH(\"Foo\")}\n        ENUMFUNCENDSWITH \"Foo\"\n        PRINTFORML 函数名以\"Foo\"结尾的函数数量:{RESULT}\n        CALL PrintFoo\n        ENUMFUNCWITH \"Foo\"\n        PRINTFORML 函数名包含\"Foo\"的函数数量:{RESULT}\n        CALL PrintFoo\n\n        ONEINPUT\n\n    @PrintFoo\n        #DIM i\n        FOR i, 0, RESULT\n            SIF i > 0\n                PRINTS \", \"\n            PRINTS RESULTS:i\n        NEXT\n        PRINTL\n\n    @Foo1\n    @Foo2\n    @Foo3\n    @Dummy1Foo\n    @Dummy2Foo\n    @My_Foo_Func\n    ```\n    ```text\n    函数名以\"Foo\"开头的函数数量:3\n    函数名以\"Foo\"结尾的函数数量:3\n    PrintFoo, Dummy1Foo, Dummy2Foo\n    函数名包含\"Foo\"的函数数量:7\n    PrintFoo, Foo1, Foo2, Foo3, Dummy1Foo, Dummy2Foo, My_Foo_Func\n    ```\n\n### 相关项目\n- ENUMVAR系 — 变量名枚举\n- ENUMMACRO系 — 宏名枚举\n- [动态解析与反射](../tutorial/dynamic-reflection.zh.md) — ENUMFUNC* 属于第三代\"函数名枚举\"",
    "sourcePath": "docs/Reference/ENUMFUNC.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    int ENUMMACROBEGINSWITH keyword\n    int ENUMMACROENDSWITH keyword\n    int ENUMMACROWITH keyword\n    ```\n\n    将定义的宏名中包含 `keyword` 的具体宏名保存到 `RESULTS` 数组，同时返回总数（`RESULT`）。\n\n    - `ENUMMACROBEGINSWITH` 返回以 `keyword` 开头的宏命令数量。\n    - `ENUMMACROENDSWITH` 返回以 `keyword` 结尾的宏命令数量。\n    - `ENUMMACROWITH` 返回包含 `keyword` 的宏命令数量。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    #DIMS CONST Foo1 = \"1\"\n    #DEFINE Foo2 \"Test\"\n    #DEFINE Foo3\n    #DEFINE MyFoo 1 + 1\n    #DEFINE YourFoo 1 + 1\n    #DEFINE AFooInTheMiddle\n    ```\n    ```erb\n    @SYSTEM_TITLE\n\n        PRINTFORML 宏名以\"Foo\"开头的宏命令数量:{ENUMMACROBEGINSWITH(\"Foo\")}\n        ENUMMACROENDSWITH \"Foo\"\n        PRINTFORML 宏名以\"Foo\"结尾的宏命令数量:{RESULT}\n        CALL PrintFoo\n        ENUMMACROWITH \"Foo\"\n        PRINTFORML 宏名包含\"Foo\"的宏命令数量:{RESULT}\n        CALL PrintFoo\n\n        ONEINPUT\n\n    @PrintFoo\n        #DIM i\n        FOR i, 0, RESULT\n            SIF i > 0\n                PRINTS \", \"\n            PRINTS RESULTS:i\n        NEXT\n        PRINTL\n    ```\n    ```text\n    宏名以\"Foo\"开头的宏命令数量:2\n    宏名以\"Foo\"结尾的宏命令数量:2\n    MyFoo, YourFoo\n    宏名包含\"Foo\"的宏命令数量:5\n    Foo2, Foo3, MyFoo, YourFoo, AFooInTheMiddle\n    ```\n\n### 相关项目\n- ENUMFUNC系 — 函数名枚举\n- ENUMVAR系 — 变量名枚举\n- ISDEFINED — 宏定义检查\n- [动态解析与反射](../tutorial/dynamic-reflection.zh.md) — ENUMMACRO* 属于第三代\"宏名枚举\"",
    "sourcePath": "docs/Reference/ENUMMACRO.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    int ENUMVARBEGINSWITH keyword\n    int ENUMVARENDSWITH keyword\n    int ENUMVARWITH keyword\n    ```\n\n    将定义的变量 / 常量名中包含 `keyword` 的具体变量 / 常量名保存到 `RESULTS` 数组，同时返回总数（`RESULT`）。\n\n    - `ENUMVARBEGINSWITH` 返回以 `keyword` 开头的变量 / 常量数量。\n    - `ENUMVARENDSWITH` 返回以 `keyword` 结尾的变量 / 常量数量。\n    - `ENUMVARWITH` 返回包含 `keyword` 的变量 / 常量数量。\n\n    !!! warning \"注意\"\n\n        与 `EXISTVAR` 不同，不会列举局部变量 / 常量。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    #DIMS CONST Foo1 = \"1\"\n    #DIM Foo2, 2, 2\n    #DIMS CONST Foo3 = \"3\", \"4\"\n    #DIM MyFoo\n    ```\n    ```erb\n    @SYSTEM_TITLE\n        #DIMS Local3DFoo, 2, 2, 2\n\n        PRINTFORML 以\"Foo\"开头的变量/常量数量:{ENUMVARBEGINSWITH(\"Foo\")}\n        ENUMVARENDSWITH \"Foo\"\n        PRINTFORML 以\"Foo\"结尾的变量/常量数量:{RESULT}\n        CALL PrintFoo\n        ENUMVARWITH \"Foo\"\n        PRINTFORML 包含\"Foo\"的变量/常量数量:{RESULT}\n        CALL PrintFoo\n\n        ONEINPUT\n\n    @PrintFoo\n        #DIM i\n        FOR i, 0, RESULT\n            SIF i > 0\n                PRINTS \", \"\n            PRINTS RESULTS:i\n        NEXT\n        PRINTL\n    ```\n    ```text\n    以\"Foo\"开头的变量/常量数量:3\n    以\"Foo\"结尾的变量/常量数量:1\n    MyFoo\n    包含\"Foo\"的变量/常量数量:4\n    Foo1, Foo2, Foo3, MyFoo\n    ```\n\n### 相关项目\n- ENUMFUNC系 — 函数名枚举\n- ENUMMACRO系 — 宏名枚举\n- EXISTVAR — 变量存在检查\n- [动态解析与反射](../tutorial/dynamic-reflection.zh.md) — ENUMVAR* 属于第三代\"变量名枚举\"",
    "sourcePath": "docs/Reference/ENUMVAR.zh.md"
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
    "body": "!!! info \"API\"\n\n\t```erb\n\tstring ERDNAME variableName, index(, dimension)\n\t```\n\n\t指定 `ERD` 变量的下标，返回元素的名称。可以用 `dimension` 来指定数组维度（与文件名规则相同，从左开始依次为 1, 2, 3）\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n\t```erb\n\t0,AAA\n\t1,BBB\n\t2,CCC\n\t```\n\t```erb\n\t0,DDD\n\t1,EEE\n\t2,FFF\n\t```\n\t```erb\n\t0,GGG\n\t1,HHH\n\t2,III\n\t```\n    ```erb\n\t@SYSTEM_TITLE\n\n\t\tPRINTFORMW %ERDNAME(HOGE3D, 0, 1)% %ERDNAME(HOGE3D, 1, 2)% %ERDNAME(HOGE3D, 2, 3)%\n\t```\n\t```text\n\tAAA EEE III\n\t```\n\n### 相关项目\n- [用户定义变量>ERD功能](../Emuera/user_defined_variables.md#erderabasic-define)\n- [动态解析与反射](../tutorial/dynamic-reflection.zh.md) — ERDNAME 属于 EE 扩展\"编号→名称反查\"",
    "sourcePath": "docs/Reference/ERDNAME.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tstring ESCAPE string\n    ```\n\t对参数字符串中的正则表达式元字符进行转义，使其在正则表达式中被视为普通文本，并返回转义后的字符串。\n\n!!! hint \"提示\"\n\n    该函数同时支持指令和表达式函数两种用法。\n\n!!! example \"例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tPRINTFORMW %ESCAPE(\"!#$%&'()\")%\n    ```\n    ```text\n\t!\\#\\$%&'\\(\\)\n    ```",
    "sourcePath": "docs/Reference/ESCAPE.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    int EVAL expressionString{, defaultValue}\n    string EVALS expressionString{, defaultValue}\n    float EVALF expressionString{, defaultValue}\n    ```\n\n    将传入的字符串 `expression` 作为 ERB 表达式在运行时进行动态解析与求值。\n    - `EVAL` 用于计算并返回**整数**结果。\n    - `EVALS` 用于计算并返回**字符串**结果。\n    - `EVALF` 用于计算并返回**浮点数**结果。\n\n    **安全失败机制（Fallback）**：\n    如果传入的表达式为空、存在语法错误、引用的变量不存在，或者计算结果的类型与函数要求的类型不匹配（例如用 `EVAL` 计算了一个字符串），引擎**不会抛出红字报错**，而是会静默拦截错误，并返回 `defaultValue`。\n    - 如果省略 `defaultValue`，`EVAL` 默认返回 `0`，`EVALS` 默认返回空字符串 `\"\"`，`EVALF` 默认返回 `0.0`。\n\n!!! hint \"提示\"\n\n    支持命令和表达式函数两种形式。\n\n    命令语法：\n    ```\n    EVAL \"LOCAL + 10\"\n    EVALS \"\\\"字符串结果\\\"\"\n    ```\n\n    表达式语法：\n    ```\n    LOCAL = EVAL(\"LOCAL + 10\")\n    RESULTS:0 '= EVALS(\"\\\"字符串结果\\\"\")\n    ```\n\n    表达式内的变量会绑定到**当前执行该函数的上下文**。\n    非常适合与 `DataTable` 或 `XML` 系统配合，将计算公式作为数据存储在外部，实现高度的数据驱动架构。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n        LOCAL:0 = 10\n        LOCAL:1 = 20\n\n        ; 1. 正常的数学运算\n        PRINTFORML EVAL(\"LOCAL:0 + LOCAL:1 * 2\") = {EVAL(\"LOCAL:0 + LOCAL:1 * 2\")}\n\n        ; 2. 带有三元运算符的复杂逻辑\n        PRINTFORML EVAL(\"LOCAL:0 > 5 ? 100 # 50\") = {EVAL(\"LOCAL:0 > 5 ? 100 # 50\")}\n\n        ; 3. 触发安全失败机制 (拼写错误的变量名，返回默认值 -1)\n        PRINTFORML EVAL(\"LOOOOCAL:0 + 1\", -1) = {EVAL(\"LOOOOCAL:0 + 1\", -1)}\n\n        ; 4. 字符串动态求值\n        LOCALS:0 = 剑士\n        PRINTFORML EVALS(\"\\\"职业是: \\\" + LOCALS:0\") = %EVALS(\"\\\"职业是: \\\" + LOCALS:0\", \"未知\")%\n\n        ONEINPUT\n    ```\n    ```text\n    EVAL(\"LOCAL:0 + LOCAL:1 * 2\") = 50\n    EVAL(\"LOCAL:0 > 5 ? 100 # 50\") = 100\n    EVAL(\"LOOOOCAL:0 + 1\", -1) = -1\n    EVALS(\"\\\"职业是: \\\" + LOCALS:0\") = 职业是: 剑士\n    ```\n\n### 相关项\n- CALLSTR系\n- [动态解析与反射](../tutorial/dynamic-reflection.zh.md) — EVAL/EVALS 属于第四代\"通用动态求值\"",
    "sourcePath": "docs/Reference/EVAL.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tint EXISTCSV charaNO\n    ```\n\t检查对应的角色是否已定义，并将结果赋值给`RESULT:0`或直接返回。\n\t若已定义则返回`1`，未定义则返回`0`。\n\t可用于检查`ADDCHARA no`是否能无错误地执行。\n\n!!! hint \"提示\"\n\n    该函数同时支持命令和表达式函数两种调用方式。",
    "sourcePath": "docs/Reference/EXISTCSV.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    int EXISTFILE relativePath\n    ```\n\n    判断 `Emuera.exe` 同级以及下级子目录（无法使用 `..` 访问父级目录）的相对路径是否存在文件 `relativePath`。\n\t\t如果存在，返回 `1`；否则返回 `0`。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        PRINT csv/VariableSize.csv:\n        PRINTSL EXISTFILE(\"csv/VariableSize.csv\") ? \" 存在\" # \" 不存在\"\n        PRINT erb/!@#$%^%^.txt:\n        PRINTSL EXISTFILE(\"erb/!@#$%^%^.txt\") ? \" 存在\" # \" 不存在\"\n\n        ONEINPUT\n    ```\n    ```text\n    csv/VariableSize.csv: 存在\n    erb/!@#$%^%^.txt: 不存在\n    ```\n\n### 相关项目\n- ENUMFILES",
    "sourcePath": "docs/Reference/EXISTFILE.zh.md"
  },
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
    "body": "!!! info \"API\"\n\n    ```erb\n    int EXISTFUNCTION funcName\n    ```\n\n    判定是否定义过以参数 `funcName` 为名的函数 / 行内函数。\n    常规函数（命令）返回 `1`，行内函数（数值型）返回 `2`，行内函数（字符串型）返回 `3`，其他情况返回 `0`。\n    如果在 ERB 中覆写过系统函数，返回 `1`，否则也返回 `0`。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n\n        PRINTVL EXISTFUNCTION(\"TEST1\")\n        PRINTVL EXISTFUNCTION(\"TEST2\")\n        PRINTVL EXISTFUNCTION(\"TEST3\")\n        PRINTVL EXISTFUNCTION(\"SYSTEM_TITLE\")\n        PRINTVL EXISTFUNCTION(\"SHOP\")\n        WAIT\n\n    @TEST1\n\n    @TEST2\n    #FUNCTION\n\n    @TEST3\n    #FUNCTIONS\n    ```\n\n    ```text\n    1\n    2\n    3\n    1\n    0\n    ```\n\n### 相关项目\n- ENUMFUNC",
    "sourcePath": "docs/Reference/EXISTFUNCTION.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tint EXISTMETH functionName\n    ```\n\t检查是否存在指定的表达式中函数，如果是`#FUNCTION`则返回1，如果是`#FUNCTIONS`则返回2，否则返回0。\n\n!!! hint \"提示\"\n\n    该函数同时支持命令和表达式中函数。\n\n### 相关项目\n- EXISTFUNCTION\n- GETMETH,GETMETHS",
    "sourcePath": "docs/Reference/EXISTMETH.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    int EXISTSIMAGELAYER(depth)\n    ```\n\n    检测指定 `depth` 的 `SETIMAGELAYER` 图层是否存在。\n\n    **参数**：\n\n    | 参数 | 类型 | 说明 |\n    | :--- | :--- | :--- |\n    | `depth` | int | 图层深度值 |\n\n    **返回值**：存在返回 1，不存在返回 0。\n\n!!! hint \"提示\"\n\n    支持命令和表达式函数两种形式。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n        SETIMAGELAYER \"pet_1\", 1\n\n        IF EXISTSIMAGELAYER(1)\n            PRINTL depth=1 的图层已存在\n        ELSE\n            PRINTL depth=1 的图层不存在\n        ENDIF\n\n        ; 作为表达式使用\n        #DIM L_COUNT\n        FOR L_COUNT, 1, 5\n            PRINTVL EXISTSIMAGELAYER(L_COUNT)\n        NEXT\n    ```\n    ```text\n    depth=1 的图层已存在\n    1\n    0\n    0\n    0\n    ```\n\n### 相关项\n- SETIMAGELAYER\n- CLEARIMAGELAYER",
    "sourcePath": "docs/Reference/EXISTSIMAGELAYER.zh.md"
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
    "body": "!!! info \"API\"\n\n\t```erb\n\tEXISTSOUND MediaFile\n\t```\n\n\t判断音频资源目录 `./sound/` 中是否存在参数 `MediaFile` 指定的音频文件；存在返回 `1`，不存在返回 `0`。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n### 相关项目\n- PLAYSOUND\n- PLAYBGM",
    "sourcePath": "docs/Reference/EXISTSOUND.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    int EXISTVAR varName\n    ```\n\n    如果存在与 `varName` 同名的变量 / 常量则返回对应的正整数，否则返回 `0`。\n\n    - 为整数类型时，返回值 setbit 1\n    - 为字符串类型时，返回值 setbit 2\n    - 为常量类型时，返回值 setbit 3\n    - 为二维数组时，返回值 setbit 4\n    - 为三维数组时，返回值 setbit 5\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    #DIM CONST BIT = 0, 1, 1p1, 1p2, 1p3, 1p4, 1p5, 1p6, 1p7\n    ```\n    ```erb\n    @SYSTEM_TITLE\n        #DIM 角色数据, 2, 2\n        #DIMS 名字\n\n        ; 「角色数据」为二维整数类型数组 setbit 1、4\n        PRINTFORML {EXISTVAR(\"角色数据\")} {BIT:1|BIT:4} ; 0b1001 == 1 + 8\n        ; 「BIT」为整数类型数组常量 setbit 1、3\n        PRINTFORML {EXISTVAR(\"BIT\")} {BIT:1|BIT:3} ; 0b0101 == 1 + 4\n        ; 「名字」为字符串类型变量 setbit 2\n        PRINTFORML {EXISTVAR(\"名字\")} {BIT:2} ; 0b0010 == 2\n        ; 当前不存在名为「性别」的变量或常量\n        PRINTFORML {EXISTVAR(\"性别\")} ; 「性别」声明于另一个函数(Foo)的作用域\n\n        ONEINPUT\n\n    @Foo\n        #DIMS 性别\n    ```\n    ```text\n    9 9\n    5 5\n    2 2\n    0\n    ```\n\n### 相关项目\n- ENUMVAR\n- [动态解析与反射](../tutorial/dynamic-reflection.zh.md) — EXISTVAR 属于第三代\"变量存在检查\"",
    "sourcePath": "docs/Reference/EXISTVAR.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tint FIND_CHARADATA filename\n    ```\n    在 dat 文件夹中搜索可以作为 `LOADCHARA` 目标的文件，并将文件名（`chara_*.dat` 中的 `*` 部分）代入 `RESULTS`。\n    返回值是命中数（找到的文件数）。\n    参数可以指定 `chara_*.dat` 中的 `*` 部分。\n    例如，`FIND_CHARADATA(\"*あなた*\")` 会搜索 `chara_*あなた*.dat`，`chara_001あなた.dat` 和 `chara_あなたABC.dat` 会被命中。\n    省略参数时，相当于指定了 `*`，会搜索 `chara_*.dat`。\n    另外，`chara_.dat`（`*` 为空字符串）无法通过 `LOADCHARA` 指定，因此不会被命中。\n    如果命中数超过 `RESULTS` 的元素数量，不会报错，但超出部分的文件名不会被代入。\n\n!!! hint \"提示\"\n\n    命令和表达式函数均支持。\n\n### 相关项目\n- SAVECHARA\n- LOADCHARA\n- CHKCHARADATA",
    "sourcePath": "docs/Reference/FIND_CHARADATA.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tint FINDCHARA charaVariable, value(, startID, endID)\n\tint FINDLASTCHARA charaVariable, value(, startID, endID)\n    ```\n\t`FINDCHARA` 指令通过指定角色变量和值，返回变量等于该值的角色的登记编号 (CharaID)。\n\t如果找到多个匹配项，`FINDCHARA` 返回第一个命中的角色，\n\t`FINDLASTCHARA` 返回最后一个命中的角色。如果未找到，则返回 `-1`。\n\t此外，通过指定第 3 个参数可以指定搜索的起始位置，指定第 4 个参数可以指定搜索的结束位置。\n\t但是，如果搜索范围超出角色数量的范围，将会导致错误。\n\n    ```erb\n\tX = -1\n\tWHILE 1\n\t\tFINDCHARA CFLAG:10, 123, X + 1\n\t\tX = RESULT\n\t\tSIF X < 0\n\t\t\tBREAK\n\t\tPRINTFORML %NAME:X%\n\tWEND\n\t```\n\n\t上述脚本会列出所有`CFLAG:10`为`123`的角色。\n\n!!! hint \"提示\"\n\n    该功能同时支持命令形式和函数形式。\n\n### 相关项目\n- GETCHARA — 按模板编号查找角色\n- [动态解析与反射](../tutorial/dynamic-reflection.zh.md) — FINDCHARA 属于第一代\"固定映射\"",
    "sourcePath": "docs/Reference/FINDCHARA.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    FINDELEMENT variableName, value(, startIndex, endIndex, completeMatch)\n    FINDLASTEELEMENT variableName, value(, startIndex, endIndex, completeMatch)\n    ```\n    此函数用于从数组的指定范围内查找特定元素的位置。\n    `value` 的类型必须与 `variableName` 相同。\n    如果在 `startIndex` 和 `endIndex` 指定的数组元素搜索范围内，存在与 `value` 指定内容相同的元素，则返回其位置。\n    如果省略 `endIndex`，则搜索范围将覆盖到数组的最后一个元素。\n    如果存在多个匹配项，`FINDELEMENT` 返回第一个匹配项的位置，\n    `FINDLASTELEMENT` 返回最后一个匹配项的位置。如果没有匹配项，则返回 `-1`。\n    如果搜索目标是字符串类型，则可以像 `REPLACE` 一样使用正则表达式。\n    `completeMatch` 仅在搜索目标是字符串类型时有效，如果为 `0`，则允许部分字符串匹配；\n    如果为非 `0` 值，则要求字符串完全匹配。\n\n    `variableName` 中只能指定一维数组变量，不能指定多维数组。\n    如果在 `variableName` 中指定了 CFLAG 等角色数组，则仅对指定的角色进行计数。\n\n!!! hint \"提示\"\n\n    该功能同时支持指令和表达式函数。",
    "sourcePath": "docs/Reference/FINDELEMENT.zh.md"
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
    "body": "!!! info \"API\"\n\n\t```erb\n\tFLOWINPUT default(, AllowLeftClick, AllowSkip, ForceSkip)\n\tFLOWINPUTS toggle(, default)\n\t```\n\n\t为流程中的 INPUT（例如在 `@SHOW_SHOP` 内）添加默认值、是否允许左键点击以及是否允许跳过等选项。\n\t以下是各选项的引用说明：\n\n\t```\n\t`INPUT`, `INPUTS`, `ONEINPUT`, `ONEINPUTS` 新增第二参数（整数类型，可省略，默认值为 `0`）\n\n    `TINPUT`, `TINPUTS`, `TONEINPUT`, `TONEINPUTS` 新增第五参数（整数类型，可省略，默认值为 `0`）\n\n    - 追加引数`==0`时，或省略时 与原版行为相同。\n    - 追加引数`!=0`时 将鼠标点击视为回车键（向`RESULTS`代入空字符串。若按下按钮，则将按钮索引代入`RESULTS:1`），左键点击时`RESULT:1`设为`1`，右键点击时`RESULT:1`设为`2`。同时，若按下++shift++、++ctrl++、++alt++键，则将其按键状态保存到`RESULT:2`中。（bit 16 17 18）\n    ```\n    ```\n    `INPUT`、`INPUTS`、`ONEINPUT`、`ONEINPUTS` 新增第三参数（整数型，可省略，默认值为`0`）\n\n    `TINPUT`、`TINPUTS`、`TONEINPUT`、`TONEINPUTS` 新增第六参数（整数型，可省略，默认值为`0`）\n\n    - 当追加参数 `==0` 或省略时，行为与原版相同\n    - 当追加参数 `!=0` 时，在右键等导致的跳过过程中不进行输入等待\n    但默认值会被应用。与上述 `INPUT系命令接受鼠标点击` 功能并用时，默认值会分别代入 `RESULT:1` 及 `RESULTS:1`；\n    未并用时，默认值会照常代入 `RESULT:0` 及 `RESULTS:0`\n    在 EEv46 中增加了第四参数。若设置为非0，则会向 `RESULT` 填入默认值并强制跳过\n    ```\n\n    FLOWINPUTS在第一参数非0时启用。启用后，系统流程上的所有 `INPUT` 都将被视为 `INPUTS` 处理\n    在商店画面等根据输入值改变处理的场景，建议使用 `FLOWINPUT` 来设置默认值。其他行为控制也通过 `FLOWINPUT` 进行\n\n!!! hint \"提示\"\n\n\t指令和表达式函数均支持此功能。\n\n### 相关项目\n- BEGIN",
    "sourcePath": "docs/Reference/FLOWINPUT.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tFONTBOLD\n\tFONTITALIC\n\tFONTSTYLE\n\tFONTREGULAR bitStyle\n\tint GETSTYLE\n    ```\n\t将后续文字更改为指定样式\n\t`BOLD`和`ITALIC`可以叠加（粗斜体）\n\t调用`REGULAR`将取消粗体和斜体设置\n\n\tFONTSTYLE 将后续文字更改为指定样式。\n\t0为常规，1为粗体（与`FONTBOLD`同义），2为斜体（与`FONTITALIC`同义），4为删除线，8为下划线。\n\t这些样式可以按位组合。\n\t例如，FONTSTYLE 3 表示粗体且斜体。\n\t`FONTBOLD`、`FONTITALIC`会在当前样式上分别添加粗体、斜体样式。\n\t`FONTREGULAR`等同于`FONTSTYLE 0`，即恢复为常规样式。\n\n    `GETSTYLE` 会将当前字体的样式（粗体、斜体等）赋值给 `RESULT:0`。\n    这与 `SETSTYLE` 指令指定的值相同。\n    当未执行 `SETSTYLE` 指令时，返回 `0`。\n\n!!! hint \"提示\"\n\n    只有 `GETSTYLE` 支持在表达式中作为函数使用。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tFONTSTYLE 1 + 2\n\t\tPRINTL 粗体+斜体\n\t\tFONTSTYLE 5\n\t\tPRINTL 粗体+删除线\n\t\tFONTITALIC\n\t\tPRINTL 粗体+斜体+删除线\n\t\tPRINTFORML GETSTYLE:{GETSTYLE()}\n\t\tFONTSTYLE 0\n\t\tPRINTW 正常\n    ```\n\t![](../assets/images/FONT_OPERATION.png)",
    "sourcePath": "docs/Reference/FONT_OPERATION.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    FOR integerVariable, startNum, endNum(, value)\n    ```\n    `FOR～NEXT` 是 `REPEAT～REND` 的功能增强版。\n    第一个参数表示用于计数的变量（在 `REPEAT` 中始终是 `COUNT:0`）。\n    第二个参数表示最初赋值给变量的值（在 `REPEAT` 中始终是 `0`）。\n    第三个参数表示循环结束的值（相当于 `REPEAT` 中可设置的值）。\n    第四个参数表示每次循环累加的值（在 `REPEAT` 中始终是 `1`）。\n\n    ```erb\n    FOR COUNT, 0, X\n        ;～～\n    NEXT\n    REPEAT X\n        ;～～\n    REND\n    ```\n\n\t上面的两个语句功能几乎相同。\n\t两者都是执行X次循环的语法，在循环过程中可以使用`CONTINUE`或`BREAK`。\n\t不同之处在于可以指定用于计数的变量，并且可以更改起始值和步长。\n\t此外，`FOR～NEXT`可以嵌套使用。\n\n    ```erb\n\tFOR Y, 0, 100\n\t\tFOR X, 0, 100\n\t\t\t～～\n\t\tNEXT\n\tNEXT\n\t```\n\n    第1个参数`integerVariable`只能指定数值类型的变量，不能使用角色变量。\n    第4个参数`value`是可选的，如果省略则默认为`1`。\n    当`value`为正值时，在每次循环时向`integerVariable`变量增加`value`值，直到达到第3个参数`endNum`时循环结束。\n    当`value`为负值时，当`integerVariable`变量的值小于等于`endNum`时循环结束。\n    如果`value`为0，则会产生无限循环，直到执行`BREAK`语句才会退出。\n    各个值在循环开始时就被固定下来，即使在循环过程中变量发生变化也不会受到影响。\n    以下两个例子会产生相同的结果。\n\n    ```erb\n    ;１\n    X = 10\n    FOR COUNT:X, 0, X, X/10\n        X = 10000\n    NEXT\n    ;２\n    FOR COUNT:10, 0, 10, 10/10\n        X = 10000\n    NEXT\n    ```\n    此外，如果通过 `GOTO` 等指令直接跳转到 `FOR～NEXT` 循环内部，其行为与 `REPEAT～REND` 类似：会从进入点开始正常执行，直到 `NEXT` 指令的前一行，然后忽略 `NEXT` 指令，并从下一行继续执行。\n\n!!! hint \"提示\"\n\n    仅支持指令。\n\n### 相关项目\n- REPEAT-REND\n- WHILE-WEND\n- CONTINUE,BREAK",
    "sourcePath": "docs/Reference/FOR.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    FORCE_BEGIN SystemFuncName\n    ```\n\n    忽略流程控制的影响，强制执行 `BEGIN` 命令。\n\n!!! hint \"提示\"\n\n    只能在命令中使用。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        BEGIN ABLUP\n\n    @SHOW_JUEL\n        PRINTL @SHOW_JUEL\n        FORCE_BEGIN SHOP\n\n    @EVENTSHOP\n        PRINTL @EVENTSHOP\n\n    @SHOW_SHOP\n        PRINTL @SHOW_SHOP\n        FORCE_BEGIN TURNEND\n\n    @EVENTTURNEND\n        PRINTL @EVENTTURNEND\n        WAIT\n\n    ```\n\n    ```text\n    @SHOW_JUEL\n    @EVENTSHOP\n    @SHOW_SHOP\n    @EVENTTURNEND\n    ```\n\n### 相关项目\n- BEGIN",
    "sourcePath": "docs/Reference/FORCE_BEGIN.zh.md"
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
    "body": "!!! info \"API\"\n\n\t```erb\n\tFORCE_QUIT\n\t```\n\n\t未附加 `WAIT` 的 `QUIT`。（即直接退出）\n\n!!! hint \"提示\"\n\n    只能作为命令使用。\n\n### 相关项目\n- QUIT",
    "sourcePath": "docs/Reference/FORCE_QUIT.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    FORCE_QUIT_AND_RESTART\n    ```\n\n    未附加 `WAIT` 的 `QUIT_AND_RESTART`。（即直接重启）\n\n!!! hint \"提示\"\n\n    只能作为命令使用。\n\t\t未插入输入等待，导致连续执行（死循环）的情况下弹出警告对话框。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n\n        FORCE_QUIT_AND_RESTART\n    ```\n\n    ![](../assets/images/FORCE_QUIT_AND_RESTART.png)\n\n### 相关项目\n- QUIT_AND_RESTART",
    "sourcePath": "docs/Reference/FORCE_QUIT_AND_RESTART.zh.md"
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
    "body": "!!! info \"API \"\n\n    ```erb\n\tFORCEKANA int\n    ```\n\t指定显示命令的平假名/片假名转换。\n\t对包含关键字`K`的各种`PRINT`系命令有效。\n\t根据参数指定的值，会产生以下影响。\n\n    - 0:不进行转换\n    - 1:平假名→片假名\n    - 2:片假名→平假名（仅全角）\n    - 3:片假名→平假名（全角、半角均转换）\n\n!!! hint \"提示\"\n\n    仅支持命令。",
    "sourcePath": "docs/Reference/FORCEKANA.zh.md"
  }
];
