// 本文件由 scripts/build-reference.ts 生成，请勿手工修改。
//
// 数据来源：https://github.com/qirchen421/emuera.sk.doc  docs/Reference、docs/Emuera、docs/tutorial/*.zh.md
// 上游版本：41451be6091363e37ed066aaf04416decbf0127f
// 许可：CC BY-NC 4.0（http://creativecommons.org/licenses/by-nc/4.0/）
//       与本仓库代码的 Apache-2.0 分开管理，见 NOTICE-emuera-sk-doc.md
import type { ReferenceEntry } from '../types.js';

export const ENTRIES_PART_03: readonly ReferenceEntry[] = [
  {
    "id": "Emuera/function#DIMS",
    "pageId": "Emuera/function",
    "sourcePath": "docs/Emuera/function.zh.md",
    "localOnly": true,
    "title": "#DIMS",
    "names": [
      "#DIMS"
    ],
    "signatures": [],
    "summary": "用户定义变量声明。在ERB中的特定函数内使用，可以定义仅在该函数内使用的字符串型变量。",
    "body": "用户定义变量声明。在ERB中的特定函数内使用，可以定义仅在该函数内使用的字符串型变量。\n详情请参考用户定义的变量。 另外，在ERH中使用时，可以定义所有函数间共享值的字符串型变量。\n详情请参考头文件（ERH）。"
  },
  {
    "id": "Emuera/function#ELSE",
    "pageId": "Emuera/function",
    "sourcePath": "docs/Emuera/function.zh.md",
    "localOnly": true,
    "title": "[IF XXX]～[ELSEIF XXX]～[ELSE]～[ENDIF]",
    "names": [
      "[ELSE]",
      "[ENDIF]"
    ],
    "signatures": [],
    "summary": "可以根据名称XXX的宏是否定义来决定执行多行或分支。",
    "body": "可以根据名称`XXX`的宏是否定义来决定执行多行或分支。\n详情请参考头文件（ERH）。"
  },
  {
    "id": "Emuera/function#EVENTLOAD",
    "pageId": "Emuera/function",
    "sourcePath": "docs/Emuera/function.zh.md",
    "localOnly": true,
    "title": "@EVENTLOAD",
    "names": [
      "@EVENTLOAD"
    ],
    "signatures": [],
    "summary": "数据加载完成后立即调用。",
    "body": "数据加载完成后立即调用。\n由于是事件函数，可以定义多个。\n如果没有定义`@EVENTLOAD`，则会转移到`@SHOW_SHOP`（与eramaker相同动作）"
  },
  {
    "id": "Emuera/function#FUNCTION",
    "pageId": "Emuera/function",
    "sourcePath": "docs/Emuera/function.zh.md",
    "localOnly": true,
    "title": "#FUNCTION",
    "names": [
      "#FUNCTION"
    ],
    "signatures": [],
    "summary": "表达式函数的属性。",
    "body": "表达式函数的属性。\n表达式函数不能用普通的RETURN结束，需要用`RETURNF <数值表达式>`结束。\n详情请参考用户定义的表达式函数。"
  },
  {
    "id": "Emuera/function#FUNCTIONS",
    "pageId": "Emuera/function",
    "sourcePath": "docs/Emuera/function.zh.md",
    "localOnly": true,
    "title": "#FUNCTIONS",
    "names": [
      "#FUNCTIONS"
    ],
    "signatures": [],
    "summary": "表达式函数的属性。",
    "body": "表达式函数的属性。\n表达式函数不能用普通的`RETURN`结束，需要用RETURNF <字符串表达式>结束。\n详情请参考用户定义的表达式函数。"
  },
  {
    "id": "Emuera/function#IF_DEBUG",
    "pageId": "Emuera/function",
    "sourcePath": "docs/Emuera/function.zh.md",
    "localOnly": true,
    "title": "[IF_DEBUG]～[ENDIF]",
    "names": [
      "[IF_DEBUG]",
      "[ENDIF]"
    ],
    "signatures": [],
    "summary": "从[IF_DEBUG]到[ENDIF]之间写的行只在调试模式时执行。",
    "body": "从`[IF_DEBUG]`到`[ENDIF]`之间写的行只在调试模式时执行。\n非调试模式时被视为注释行不执行。\n不过，`DEBUG`系列指令原本在非调试模式时就被忽略，因此不需要在行首添加`;#;`。\n同样，调试变量在非调试模式时也是空字符串或0，不用担心出错。\n关于调试模式请参考这里。"
  },
  {
    "id": "Emuera/function#IF_NDEBUG",
    "pageId": "Emuera/function",
    "sourcePath": "docs/Emuera/function.zh.md",
    "localOnly": true,
    "title": "[IF_NDEBUG]～[ENDIF]",
    "names": [
      "[IF_NDEBUG]",
      "[ENDIF]"
    ],
    "signatures": [],
    "summary": "从[IF_NDEBUG]到[ENDIF]之间写的行只在非调试模式时执行。",
    "body": "从`[IF_NDEBUG]`到`[ENDIF]`之间写的行只在非调试模式时执行。\n调试模式时被视为注释行不执行。\n与`[IF_DEBUG]`的判断正好相反。\n关于调试模式请参考这里。"
  },
  {
    "id": "Emuera/function#LOCALSIZE",
    "pageId": "Emuera/function",
    "sourcePath": "docs/Emuera/function.zh.md",
    "localOnly": true,
    "title": "#LOCALSIZE <常量表达式>,#LOCALSSIZE <常量表达式>",
    "names": [
      "#LOCALSIZE",
      "#LOCALSSIZE"
    ],
    "signatures": [],
    "summary": "定义变量名称及其规格的预处理器。",
    "body": "定义变量名称及其规格的预处理器。\n在函数中记录以`#`开头的预处理器时，必须紧接在函数下方。\n\n为每个函数单独指定`LOCAL`和`LOCALS`元素数量的预处理器。\n常量表达式的结果必须是大于0的整数，其他情况或包含变量的表达式或无法解释的字符串会被忽略。\n被忽略或未使用此预处理器时，按常规使用`VariableSize.csv`的设置值。\n在事件函数中使用此预处理器时，使用最先执行的设置（截至ver1800）。"
  },
  {
    "id": "Emuera/function#ONLY",
    "pageId": "Emuera/function",
    "sourcePath": "docs/Emuera/function.zh.md",
    "localOnly": true,
    "title": "#ONLY",
    "names": [
      "#ONLY"
    ],
    "signatures": [],
    "summary": "决定函数规格和动作的预处理器。",
    "body": "决定函数规格和动作的预处理器。\n在函数中记录以#开头的预处理器时，必须紧接在函数下方。\n\n事件函数专用属性。\n如果指定了`#ONLY`的事件函数存在，只执行这一个，不会执行其他同名事件函数。\n另外，如果有多个指定了`#ONLY`的同名事件函数，也只执行\"最初的那一个\"。"
  },
  {
    "id": "Emuera/function#SKIPSTART",
    "pageId": "Emuera/function",
    "sourcePath": "docs/Emuera/function.zh.md",
    "localOnly": true,
    "title": "[SKIPSTART]～[SKIPEND]",
    "names": [
      "[SKIPSTART]",
      "[SKIPEND]"
    ],
    "signatures": [],
    "summary": "这些都是预处理器行。",
    "body": "这些都是预处理器行。\n在记录这些的同行，不能在紧接其后继续记录指令、函数或注释等。\n这些在eramaker中无法解释，因此在编码时有时需要使用`;!;`。\n\n从`[SKIPSTART]`到`[SKIPEND]`之间写的行在Emuera中不会被读取和执行。\n这是有意改变Emuera和eramaker行为时使用的。\n请在不想在Emuera中执行的语句中使用。\n另外，与`;!;`一起使用时，可以在Emuera以外不执行不想执行的语句。\n详情请参考Emuera中新增的语法章节。"
  },
  {
    "id": "Emuera/function#SYSTEM_AUTOSAVE",
    "pageId": "Emuera/function",
    "sourcePath": "docs/Emuera/function.zh.md",
    "localOnly": true,
    "title": "@SYSTEM_AUTOSAVE",
    "names": [
      "@SYSTEM_AUTOSAVE"
    ],
    "signatures": [],
    "summary": "在自动保存时机被调用。",
    "body": "在自动保存时机被调用。\n可以自定义自动保存的内容。\n如果没有定义，将使用标准保存功能。"
  },
  {
    "id": "Emuera/function#SYSTEM_TITLE",
    "pageId": "Emuera/function",
    "sourcePath": "docs/Emuera/function.zh.md",
    "localOnly": true,
    "title": "@SYSTEM_TITLE",
    "names": [
      "@SYSTEM_TITLE"
    ],
    "signatures": [],
    "summary": "在csv加载完成时被调用。",
    "body": "在csv加载完成时被调用。\n另外，通过`BEGIN TITLE`也会被调用。\n通过定义`@SYSTEM_TITLE`可以使用自定义标题画面。\n如果没有定义，将使用标准标题画面。"
  },
  {
    "id": "Emuera/function#TITLE_LOADGAME",
    "pageId": "Emuera/function",
    "sourcePath": "docs/Emuera/function.zh.md",
    "localOnly": true,
    "title": "@TITLE_LOADGAME",
    "names": [
      "@TITLE_LOADGAME"
    ],
    "signatures": [],
    "summary": "在标准标题画面选择加载时被调用。",
    "body": "在标准标题画面选择加载时被调用。\n通过定义`@TITLE_LOADGAME`，可以在标题画面使用自定义加载画面。\n如果没有定义，将使用标准加载画面。\n如果定义了`@SYSTEM_TITLE`，除非明确使用[`CALL`](../Reference/CALL.zh.md)，否则不会调用`@TITLE_LOADGAME`。"
  },
  {
    "id": "Emuera/glossary#FUNCTION",
    "pageId": "Emuera/glossary",
    "sourcePath": "docs/Emuera/glossary.zh.md",
    "localOnly": true,
    "title": "#FUNCTION(S)函数",
    "names": [
      "#FUNCTION"
    ],
    "signatures": [],
    "summary": "普通启动Emuera时的模式。",
    "body": "### 通常模式\n\n普通启动Emuera时的模式。\n双击`EmueraXXXX.exe`启动时为这种模式。\n\n### 解析模式\n\n将想要解析的文件名作为命令行参数传递启动时的模式。\n将文件拖拽到`EmueraXXXX.exe`上启动时为这种模式。\n解析模式会对拖拽的文件进行语法检查。\n因此可以确认开发中文件的语法错误等。\n但因为需要检查字符串指定的元素，所以需要使用计划使用的变体的CSV文件夹。\n最好将文件拖拽到计划使用的变体的`EmueraXXXX.exe`上。\n另外，从`1738g`开始，解析模式下如果\"加载时显示报告\"已启用，\n则会显示每个加载的ERB文件中使用的函数列表。\n如果函数太多导致日志滚动，请增加配置中的日志行数。\n\n### 调试模式\n\n将`-Debug`作为命令行参数传递启动时的模式。详情请参见调试模式。\n\n### 主窗口\n\n通常启动时最初打开的窗口。\n\n### 主控制台\n\n主窗口中专门用于输入输出的部分。\n\n### 调试窗口\n\n调试模式启动时可以打开的窗口。\n\n### 调试控制台\n\n调试窗口中选择\"控制台\"标签时显示的输入输出部分。\n\n### 设置对话框\n\n从主窗口菜单的帮助、设置中打开的对话框。\n\n### 剪贴板对话框\n\n从主控制台按Ctrl+C打开的对话框。\n\n### 指令\n\n如[`PRINT`](../Reference/PRINT.zh.md)或[`WAIT`](../Reference/WAIT.zh.md)等。\n\n### 函数\n\n在ERB脚本中用`@～～`语句定义名称，通过[`CALL`](../Reference/CALL.zh.md)指令等调用的对象。\n包括可在表达式中使用的函数中用`@～～`语句定义名称的。\n\n### 事件函数\n\n函数中以`EVENT`开头并由系统调用的函数。\n如果有多个定义，全部会被调用。\n\n### 预处理器\n\n在ERB文件夹中的文件中，比其他指令先处理的行。\n以`#`开头的行，或由`[]`括起来的词语组成的行。\n以`#`开头的行可分为属性和定义，详情请参见相应部分。\n由`[]`括起来的词语组成的行表示特殊的块。\n详情请参见此页面。\n\n### 属性（预处理器）\n\n指定给函数的以`#`开头的行，是决定函数规格和动作的预处理器。\n有用于控制事件函数执行时行为的`#PRI`、`#LATER`、`#SINGLE`、`#ONLY`，\n有用于指定表达式函数种类的`#FUNCTION`、`#FUNCTIONS`。\n\n### 定义（预处理器）\n\n以`#`开头的行，是定义变量名称及其规格的预处理器。\n指定给函数的有用于指定`LOCAL`、`LOCALS`变量元素数的`#LOCALSIZE`、`#LOCALSSIZE`，\n有用于定义变量的`#DIM`、`#DIMS`，有用于在ERH中定义DEFINE宏的`#DEFINE`。\n\n### 表达式中可使用的函数\n\n可在表达式中调用的\"函数\"。\n\"函数\"不仅包括上述函数，还包括后述的内置函数。\n在多数编程语言中简称为\"函数\"。\n\n### 表达式函数\n\n表达式中可使用函数的简称。\n与编程语言中的表达式函数（匿名函数）或内联函数无关。\n\n### 内置函数\n\n表达式函数中，Emuera原有内置且无需`@～～`语句定义即可使用的。\n如`ABS(X)`或`GETTIME()`等。\n虽然有些混淆，但不符合上述函数的定义。\n可以认为是\"表达式中可使用的指令\"。\n\n### 用户定义函数\n\n用户定义的函数。\n在ERB脚本中用`@～～`语句定义名称，通过[`CALL`](../Reference/CALL.zh.md)指令等调用的。\n即与上述函数是同一概念。\n\n用@～～语句定义名称，带有#FUNCTION(S)属性的。\n即是函数又是表达式函数的函数。\n\n### 行\n\n从换行符到下一个换行符的内容。\n在编程相关领域也称为物理行。\n虽然有些混淆，但在编辑器相关领域常称为逻辑行。\n\n### 语句\n\n语句或逻辑行是Emuera中的一个处理单元。\n多数语句由一个指令及其参数，或变量、赋值运算符和表达式组成。\n在ERB中有一行一语句的铁则，因此行和语句几乎同义。\n本Wiki中也不特别区分。\n\n### 表达式\n\n变量、常量、表达式函数、非赋值运算符、括号及其组合。\n赋值运算符只能作为赋值语句的第一个运算符使用，不能在表达式中使用。\n\n### 数值表达式\n\n求值结果（运算结果）为数值的表达式。\n例如，`A+B`、`STR == \"あいう\"`等。\n\n### 字符串表达式\n\n求值结果（运算结果）为字符串的表达式。\n例如，`STR + STR:1`、`\"あ\" * 10`等。\n\n### 伪变量\n\n如RAND或CHARANUM等可写成变量形式但实际不是变量的东西。\n内部动作类似于表达式函数。\n\n### 角色登记编号 (CharaID)\n\n日文「キャラ登録番号」。当前游戏状态中动态分配给角色的索引值，从0开始连续分配。通过`MASTER`、`TARGET`、`ASSI`、`PLAYER`等变量访问。角色添加时分配新编号，删除后重新排列。角色变量的第一维使用此编号。\n\n### 角色注册编号 (NO)\n\n日文「キャラ番号」。在`CharaXX.CSV`文件中定义的固定编号，通过`NO`变量访问。与登记编号 (CharaID) 不同，角色注册编号是静态的，不会随角色的添加/删除而改变。`ADDCHARA`指令使用此编号指定要添加的角色模板。\n\n### 角色变量\n\n记录角色状态的变量，如`BASE`、`ABL`、`TALENT`、`EXP`等。访问方式为`VAR:登记编号(CharaID):元素编号`，例如`BASE:TARGET:0`表示调教中角色的第一个基础参数。\n\n### 数组变量\n\n具有多个元素的变量。\n数组变量的元素数可通过`VariableSize.csv`更改，通常在脚本中不会增减，\n但部分局部变量可在脚本中指定数组元素数。\n\n### 角色变量\n\n记录角色状态的变量。\n与C语言等的char型变量无关。\n因其特性，随`ADDCHARA`或`DELCHARA`导致的角色增减，元素数也会增减。\n如`NO:TARGET`等，以与数组变量相同的格式指定元素，因此在eramaker说明中被当作数组变量之一，但本Wiki中区分角色变量和数组变量。\n\n### 二维数组变量\n\n既是角色变量又是数组变量的变量。\n如`CFLAG:TARGET:2`，接受2个参数（可省略）。\n因为是角色变量，所以第一参数表示角色登记编号 (CharaID)。\n另外，随角色增减，第一维度的元素数也会增减。\n第二维度的元素数只能通过`VariableSize.csv`更改，在脚本中不会增减。\n\n本Wiki中除eramaker规格说明外，不使用\"二维数组\"这一术语。\n而使用\"既是角色变量又是数组变量\"这样的称呼。\n\n### 多维数组变量\n\n如`DITEMYTPE`等二维数组变量及`TA`等三维数组变量。\n如`DA:0:1`或`TA:1:2:3`，接受2个或3个参数。\n多维数组变量的元素数只能通过`VariableSize.csv`更改，在脚本中不会增减。\n另外，多维数组变量的参数不能省略。\n\n### 角色多维数组变量\n\n既是角色变量又是多维数组变量的变量。\n如`CFLAG:TARGET:0:2`，接受3个参数（不可省略）。\n因为是角色变量，所以第一参数表示角色登记编号 (CharaID)。\n另外，随角色增减，第一维度的元素数也会增减。\n第二维度·第三维度的元素数只能通过`VariableSize.csv`更改，在脚本中不会增减。\n\n截至ver1807，符合此变量的只有`CDFLAG`。\n详情请参见`CDFLAG`。\n\n### 局部变量\n\n为每个函数（函数名）准备的变量，如`LOCAL`、`LOCALS`或私有变量等。\n关于私有变量请参见其他条目。\n`LOCAL`、`LOCALS`中私有变量以外的，实际上不是通常意义上的局部变量，\n而是名为`LOCAL@函数名`或`LOCALS@函数名`的`public static`变量。\n离开函数后值也会保留，可以从函数外部进行赋值、引用。\n另外，像递归调用那样多次调用时，值也会共享。\n\n### 全域变量\n\n属于除`LOCAL`、`LOCALS`或私有变量等以外的大多数变量，所有函数中值共享的变量。\n也可以说是通用编程语言中的全局变量概念。\n另外，通过在ERH中使用`#DIM`或`#DIMS`可以定义全局变量。\n详情请参见头文件（ERH）页面。\n\n### 全局变量\n\n可在不同存档数据间共享值的变量。全局变量也包含在全局变量中。\n与通常变量相比，保存加载或初始化的时机不同。\nEmuera的全局变量与通用编程语言中的全局变量概念无关。\n\n### 私有变量\n\n为每个函数（函数名）通过`#DIM`或`#DIMS`定义的变量。\n这些也是局部变量，因此对每个函数都是独立的。\n但是，与同样是局部变量的`LOCAL`等不同，无法从函数外部通过`@函数名`等进行赋值、引用。\n详情请参见用户定义变量页面。"
  },
  {
    "id": "Emuera/HTML_PRINT#BR",
    "pageId": "Emuera/HTML_PRINT",
    "sourcePath": "docs/Emuera/HTML_PRINT.zh.md",
    "localOnly": true,
    "title": "br",
    "names": [
      "BR"
    ],
    "signatures": [],
    "summary": "此效果是显示行的换行，所以无论有多少<br>，在CLEARLINE或LINECOUT中都视为一行。",
    "body": "进行换行。\n    此效果是显示行的换行，所以无论有多少`<br>`，在`CLEARLINE`或`LINECOUT`中都视为一行。\n\n### button, nonbutton\n\n\t<button value='～' title='～' pos='～'>文本</button>\n\t<nonbutton title='～' pos='～'>文本</nonbutton>\n\n`button`将包围的文本部分设为可点击的按钮。\n`nonbutton`将包围的文本部分显示为非按钮文本。\n\n- `value`属性\n\t只能指定给`button`。\n\t省略`value`时，将变为不可点击的与`<nonbutton>`类似的非按钮。\n\n- `title`属性\n\t指定鼠标悬停时显示的工具提示内容。\n\n- `pos`属性\n\t仅在`align`为`left`且使用了`nobr`标签时可以使用。\n\t以字体大小的百分比指定从屏幕左端的位置。\n\t例如`<button pos='300'>按钮</button>`的话，按钮将写在与`「　　　按钮」`几乎相同的位置。"
  },
  {
    "id": "Emuera/HTML_PRINT#CLEARBUTTON",
    "pageId": "Emuera/HTML_PRINT",
    "sourcePath": "docs/Emuera/HTML_PRINT.zh.md",
    "localOnly": true,
    "title": "clearbutton",
    "names": [
      "CLEARBUTTON"
    ],
    "signatures": [],
    "summary": "EM+EE中新增的功能。<clearbutton>使包围部分的按钮无效（title、pos属性功能仍保留）",
    "body": "EM+EE中新增的功能。`<clearbutton>`使包围部分的按钮无效（`title`、`pos`属性功能仍保留）\n\n- 属性`notooltip`为`true`时，按钮`title`属性也无效"
  },
  {
    "id": "Emuera/HTML_PRINT#DIV",
    "pageId": "Emuera/HTML_PRINT",
    "sourcePath": "docs/Emuera/HTML_PRINT.zh.md",
    "localOnly": true,
    "title": "div",
    "names": [
      "DIV"
    ],
    "signatures": [],
    "summary": "EM+EE中新增的功能。<div>可以在指定区域内显示包围的内容。<div>不支持嵌套结构。可以与其他标签结合使用。",
    "body": "EM+EE中新增的功能。`<div>`可以在指定区域内显示包围的内容。`<div>`不支持嵌套结构。可以与其他标签结合使用。\n\n- `width`属性：子区域的宽度。可以像`<img>`、`<shape>`标签一样用`px`、字体大小的百分比指定。\n- `height`属性：子区域的高度。可以像`<img>`、`<shape>`标签一样用`px`、字体大小的百分比指定。\n- `xpos`属性：子区域从当前位置的横向距离。可省略。负数则靠左，正数则靠右。可以像`<img>`、`<shape>`标签一样用`px`、字体大小的百分比指定。\n- `ypos`属性：子区域从当前位置的纵向距离。可省略。负数则靠上，正数则靠下。可以像`<img>`、`<shape>`标签一样用`px`、字体大小的百分比指定。\n- `size`属性：`width`和`height`的简化。格式：`size='width,height'`。\n- `rect`属性：`xpos`、`ypos`、`width`和`height`的简化。格式：`rect='xpos,ypos,width,height'`。\n- `depth`属性：子区域的深度。可省略。负数则靠前，正数则靠后。\n- `color`属性：子区域的背景色。可省略。指定格式与`<font>`标签的`color`属性相同。\n\n- `display`属性：子区域的绘制形式。可省略。\n    - `relative`（默认）：在当前文字位置绘制。\n    - `absolute`：在窗口固定位置绘制，滚动时也不会移动。(0, 0)是窗口左下，ypos向上为正。\n\n- `margin`属性：子区域四个边的边距区域。可省略。\n    - `margin='all'`：将`all`应用到四边。可使用`px`或字体大小百分比。\n    - `margin='leftRight,topBottom'`：将`leftRight`应用到上下，`leftRight`应用到左右。可使用`px`或字体大小百分比。\n    - `margin='top,leftRight,bottom'`：将`top`应用到上，`leftRight`应用到左右，`bottom`应用到下。可使用`px`或字体大小百分比。\n    - `margin='top,right,bottom,left'`：将`top`应用到上，`right`应用到右，`bottom`应用到下，`left`应用到左。可使用`px`或字体大小百分比。\n\n- `padding`属性：子区域四个边的内边距区域。可省略。指定格式与`margin`属性相同。\n- `border`属性：子区域边界的宽度。可省略。指定格式与`margin`属性相同。\n- `bcolor`属性：子区域边界的颜色。可省略。指定格式与`margin`属性类似，但颜色格式与`<font>`标签的`color`属性相同。\n\n- `radius`属性：子区域边界外侧的圆角（半径）。可省略。\n    - `radius='all'`：将`all`应用到四个角。可使用`px`或字体大小百分比。\n    - `radius='ltRb,rtLb'`：将`ltRb`应用到左上和右下，`rtLb`应用到右上和左下。可使用`px`或字体大小百分比。\n    - `radius='lt,rtLb,rb'`：将`lt`应用到左上，`rtLb`应用到右上和左下，`rb`应用到右下。可使用`px`或字体大小百分比。\n    - `radius='lt,rt,rb,lb'`：将`lt`应用到左上，`rt`应用到右上，`rb`应用到右下，`lb`应用到左下。可使用`px`或字体大小百分比。\n\n### 字符引用\n\n如果有被`&`和`;`包围的单词，将其作为字符引用处理。\n支持的字符引用有`&amp;`、`&gt;`、`&lt;`、`&quot;`、`&apos;`及`&#nn;`、`&#xnn;`。\n\n### 注释\n\n\t<!-- 注释 -->\n\n在html解析中，`<!--`和`-->`包围的文字会被忽略"
  },
  {
    "id": "Emuera/HTML_PRINT#FONT",
    "pageId": "Emuera/HTML_PRINT",
    "sourcePath": "docs/Emuera/HTML_PRINT.zh.md",
    "localOnly": true,
    "title": "font",
    "names": [
      "FONT"
    ],
    "signatures": [],
    "summary": "<font face='～' color='～' bcolor='～' size='～'>文本</font>",
    "body": "<font face='～' color='～' bcolor='～' size='～'>文本</font>\n\n更改包围部分的字体、显示颜色、按钮选中时的显示颜色、字体大小\n此标签可以嵌套\n\n- face属性\n\t指定字体名称。指定空字符串时，使用配置中指定的字体。\n\t如果指定的字体不存在或不支持，将使用\"Microsoft Sans Serif\"。\n\t（这是由于.Net Framework的System.Drawing.Font类的规格）\n\n- color属性\n\t指定文本的显示颜色。\n\t颜色指定可以使用`#FF0080`这样的十六进制格式或`red`、`blue`这样的单词格式。\n\t颜色名称遵循`.Net Framework`的`Color结构体`的定义颜色。\n\t但`Transparent`不能作为颜色名称指定。\n\n- bcolor属性\n\t指定按钮选中时的显示颜色。\n\n- size属性 [Skia]\n\t以像素为单位指定字体大小。可使用 `size='24'` 或 `size='24px'` 格式。\n\t嵌套 `<font>` 标签时继承外层字体大小设置。\n\n### b, i, u, s\n\n\t<b>粗体</b>, <i>斜体</i>, <u>下划线</u>, <s>删除线</s>\n\n将包围部分的字符分别设为粗体、斜体、带下划线、带删除线"
  },
  {
    "id": "Emuera/HTML_PRINT#IMG",
    "pageId": "Emuera/HTML_PRINT",
    "sourcePath": "docs/Emuera/HTML_PRINT.zh.md",
    "localOnly": true,
    "title": "img",
    "names": [
      "IMG"
    ],
    "signatures": [],
    "summary": "<img src='～～' srcb='～～' height='～～'>",
    "body": "<img src='～～' srcb='～～' height='～～'>\n\n在行内显示图像。\n准备图像的方法请参考资源设置。\n\n- `src`属性\n\t必需\n\t指定在`resources`文件夹的csv中创建的资源名\n\t不指定`height`或`width`时，保持纵横比，缩小或放大到纵高与字体大小一致。\n\t绘制接口为`WINAPI`时，不进行alpha混合。\n\n- `srcb`属性\n\t指定在`resources`文件夹的csv中创建的资源名\n\t`srcb`指定按钮选中时应显示的资源名。\n\t省略时使用与`src`相同的图像。\n\t图像会缩放或放大到与`src`相同的大小显示。\n\n- `height`属性\n\t以字体大小的百分比指定显示尺寸的高度。省略时为100。\n\t指定负值时，图像垂直翻转显示。\n\n- `width`属性\n\t以字体大小的百分比指定显示尺寸的宽度。省略时为0。\n\t为0时，会变为保持原图纵横比的值。\n\t指定负值时，图像水平翻转显示。\n\n- `ypos`属性\n\t以字体大小的百分比指定显示位置的纵向位置。省略时为0。\n\t请注意基准是\"字体大小\"而不是\"行高\"。\n\t横向位置的调整请使用`<shape type='space'>`或button的`pos`属性。\n\n- `px`表示\n\t对于上述属性，可以在数值后加上`px`进行像素指定\n\n- `srcm`属性\n\t类似于CBG系统的按钮映射。执行[INPUT系的扩展模式](../EMEE/EMEE_Summary.md#input)或`INPUTMOUSEKEY`命令时，将鼠标光标正下方按钮映射图像的颜色（RGB部分）赋值给`RESULT:3`（`INPUTMOUSEKEY`时为`RESULT:6`）。"
  },
  {
    "id": "Emuera/HTML_PRINT#NOBR",
    "pageId": "Emuera/HTML_PRINT",
    "sourcePath": "docs/Emuera/HTML_PRINT.zh.md",
    "localOnly": true,
    "title": "nobr",
    "names": [
      "NOBR"
    ],
    "signatures": [],
    "summary": "利用类似html的标签进行PRINT的命令。",
    "body": "### p\n\n利用类似html的标签进行`PRINT`的命令。\n参数不像`PRINT`那样的字符串，而是与`PRINTS`相同的字符串表达式，由于会自动换行，实际上接近`PRINTSL`的操作。\n`HTML_PRINT`的绘制不受`ALIGNMENT`、`SETFONT`、`COLOR`、`FONTSTYLE`命令及其类似命令的影响。\n要获得这些效果，必须全部通过标签指定。\n使用`<标签名 属性='属性值'>文本</标签名>`这样的形式。\n属性值必须用`'～'`或`\"～\"`包围。\n为了与Emuera中的字符串区别，推荐使用`'～'`包围。\n\nEM+EE的新增功能，当第二个参数为`0`（默认）以外时，将不再强制换行。\n\n\t<p align='～'>文本</p>\n\n`p`标签只能放在字符串前，`</p>`只能放在最后。\n`</p>`可以省略。\n\n- `align`属性\n\t必需\n\t相当于`ALIGNMENT`命令。可以指定`left`、`center`、`right`三种。\n\n\t<nobr>文本</nobr>\n\n相当于`PRINTSINGLE`命令的绘制\n添加此标签后，不会因超出绘制区域而进行隐式换行（可以进行由`<br>`引起的显式换行）\n但Emuera与浏览器不同，无法横向滚动，所以超出窗口宽度的部分将不可见。\n`<nobr>`只能放在第一个文本之前，`</nobr>`只能放在最后一个文本之后。\n`</nobr>`可以省略"
  },
  {
    "id": "Emuera/HTML_PRINT#SHAPE",
    "pageId": "Emuera/HTML_PRINT",
    "sourcePath": "docs/Emuera/HTML_PRINT.zh.md",
    "localOnly": true,
    "title": "shape",
    "names": [
      "SHAPE"
    ],
    "signatures": [],
    "summary": "<shape type='rect' param='～～' color='～～' bcolor='～～'>",
    "body": "<shape type='rect' param='～～' color='～～' bcolor='～～'>\n\t<shape type='space' param='～～'>\n\n在行中绘制指定图形。\n\n- `type`属性\n\t必需\n\t指定要绘制的图形类型。\n\t可以使用`rect`或`space`。\n\t- `type='rect'`\n\t\t绘制矩形。\n\t\t`param`指定1个或4个数字。\n\t\t`param`为1个时指定矩形的宽度。\n\t\t`<shape type='rect' param='400'>`绘制宽度为字体大小400%的矩形。\n\t\t`param`为4个时按`x`、`y`、`宽度`、`高度`顺序指定。\n\t\t`<shape type='rect' param='0,25,400,50'>`在行的上下中央绘制高度为字体大小50%的矩形。\n\t\t`param='400'`与`param='0,0,400,100'`意思相同。\n\t- `type='space'`\n\t\t不显示指定宽度的内容。\n\t\t例如`<shape type='space' param='400'>`只在字体大小400%的区间不绘制任何内容。\n\t\t这大约等于四个全角空格的宽度。\n\n- `param`属性\n\t必需\n\t以与字体大小的比例（百分比）指定图形绘制的参数。\n\t指定多个值时用逗号分隔。\n\n- `color`属性\n\t指定图形的颜色。指定格式与`<font>`标签相同。\n\n- `bcolor`属性\n\t指定图形按钮选中时的颜色。指定格式与`<font>`标签相同。"
  },
  {
    "id": "Emuera/in_expression_function",
    "sourcePath": "docs/Emuera/in_expression_function.zh.md",
    "title": "表达式中可使用的函数",
    "names": [],
    "signatures": [],
    "summary": "本页面解释的语法不是必需的。",
    "body": "# 表达式中可使用的函数\n**本页面解释的语法不是必需的。**\n**ERB中所有能做的事情都可以不使用\"表达式中可使用的函数\"（只是脚本会稍微变长）来执行。**\n**如果对至今为止的语法没有感到不便，则没有必要使用\"表达式中可使用的函数\"。**\n\n\"表达式中可使用的函数\"是在Emuera ver 1.712中新增的语法。\n这在许多编程语言中简称为\"函数\"。\n在eramaker basic中，将用`@～～`定义并用[`CALL`](../Reference/CALL.zh.md)调用的称为\"函数\"，因此在Emuera中将新的\"函数\"称为\"表达式中可使用的函数\"。\n以下，如无误解可能，将\"表达式中可使用的函数\"简称为函数。\n\n另外，在其他页面中\"表达式中可使用的函数\"可能会简称为\"表达式函数\"。\n但是，这与其它编程语言中的表达式函数（匿名函数）或内联函数无关。\n非内置函数、在ERB中定义使用的\"表达式中可使用的函数\"请参考用户定义的表达式函数。\n\n\"表达式中可使用的函数\"使用方法如下。\n\n\tA = ABS(A)\n\tIF STRLENS(STR:0) > A\n\t\tLOCALS:0 = %SUBSTRING(STR:0, A, 1)%\n\tENDIF\n\n这是，\n求A的绝对值并赋值给A，\n如果`STR:0`的字符串长度大于`A`，\n将`STR:0`的第`A`个字符赋值给`LOCALS:0`，\n这样的脚本。\n上述脚本可以替换为不使用\"表达式中可使用的函数\"的形式，如下所示。\n\n\tABS A\n\tA = RESULT\n\tSTRLENS STR:0\n\tIF RESULT > A\n\t\tSUBSTRING STR:0, A, 1\n\t\tLOCALS:0 = %RESULTS:0%\n\tENDIF\n\n除了`RESULT`和`RESULTS`被赋予中间值外，与上述完全相同。\n\n# 图例\n以下是对说明中符号的解释。\n例如，\n\n\tint STRLENS(str s)\n\tstr SUBSTRING(str s, int start = 0, int length = -1)\n\n等中，开头的`int`和`str`表示返回值类型。\n`int`表示整数型，`str`表示字符串型。\n以下脚本中第1行正常运行，第2行会出错。\n\n\tA = STRLENS(\"abc\")\n\tA = SUBSTRING(\"abc\", 0, 1)\n\n[`SUBSTRING`](../Reference/SUBSTRING.zh.md)的返回值是`str`，即字符串型，所以不能赋值给整数型变量`A`。虽然字符串型函数不能赋值，但在其他方面可以像字符串变量一样处理。\n\n\tSTR = %SUBSTRING(\"abc\", 0, 1)%\n\n接下来的[`STRLENS`](../Reference/STRLEN.zh.md)和`SUBSTRING`是函数名称。\n\n`()`中的文字，如`str s`表示参数。\n如果有多个参数，用`,`（逗号）分隔。`STRLENS`有1个参数，`SUBSTRING`有3个参数。\n\n参数开头的单词是参数类型。\n`STRLENS`的参数是字符串型(str)。\n`SUBSTRING`第1参数是字符串型(str)，第2和第3参数是整数型(int)。\n接下来的`str`、`start`、`length`等单词是参数名称。\n参数名称是为了在说明文中使用而设置的方便名称，不必特别在意。\n\n参数名称后面的`= 0`等表示该参数可省略，以及省略时的默认值。\n以下脚本各行都具有相同含义。\n\n\tSTR = SUBSTRING(RESULTS)\n\tSTR = SUBSTRING(RESULTS, 0)\n\tSTR = SUBSTRING(RESULTS, , -1)\n\tSTR = SUBSTRING(RESULTS, 0, -1)\n\n在省略参数时，如果不是省略最后的参数而是省略中间的参数，需要像`SUBSTRING(RESULTS, , -1)`这样用`,`表明省略了哪个参数。\n但是，如果明显知道省略了哪个参数则不需要。\n以下脚本各行都具有相同含义。\n\n\t;int RAND(int min = 0, int max)\n\tA = RAND(100)\n\tA = RAND( , 100)\n\tA = RAND(0, 100)\n\n另外，\n\n\tint GETTIME()\n\n表示没有参数。这种情况下，`()`仍是必需的（为了与变量区分）。\n\n\tint FINDCHARA(var key, ? value, int start = 0)\n\n中，`var`表示变量类型。这里传递`TALENT`等变量。\n?表示接受多种类型。\n`FINDCHARA`中，根据第1参数指定的变量，第2参数应传递的类型会改变。\n\n\tint MAX(int n, int m...)\n\n表示参数数量不限。\n\n\tM = MAX(A, B, C, D, E, F, G)\n\n将A～G中最大的数字赋值给M。\n\nEM+EE的文档中记法略有不同。"
  },
  {
    "id": "Emuera/operand",
    "sourcePath": "docs/Emuera/operand.zh.md",
    "title": "运算",
    "names": [],
    "signatures": [],
    "summary": "格式（数值）　：<赋值目标变量> = <条件表达式> ? <为真时的赋值> # <为假时的赋值>",
    "body": "# 运算\n## 运算符\n### 一元运算符\n- `~` 按位取反(按位NOT) 一元运算符（优先级最高）\n- `!` 逻辑否定(NOT) 一元运算符（优先级最高）\n\n### 二元运算符\n- `<<` 左位移。比较和位运算优先级更高，算术运算优先级更低。\n- `>>` 右位移。比较和位运算优先级更高，算术运算优先级更低。\n- `^` 按位异或(按位XOR) 优先级与&、|相同\n- `^^` 非按位异或(非按位XOR) 优先级与&&、||相同\n- `!&` 非按位与非(非按位NAND) 优先级与&&、||相同\n- `!|` 非按位或非(非按位NOR) 优先级与&&、||相同\n\n### 三元运算符\n- `?～#` 普通三元运算符 优先级在=之上，其他运算符之下（判断和结果先合并再处理）\n\n\t\t格式（数值）　：<赋值目标变量> = <条件表达式> ? <为真时的赋值> # <为假时的赋值>\n\t\t格式（字符串）：<赋值目标变量> = \\@<条件表达式> ? <为真时的赋值> # <为假时的赋值>\\@\n\n\t处理上等同于\n\n\t\tIF <条件表达式>\n\t\t\t<赋值目标变量> = <为真时的赋值>\n\t\tELSE\n\t\t\t<赋值目标变量> = <为假时的赋值>\n\t\tENDIF\n\n\t是一样的。\n\t另外，数值三元运算符，可以通过放入`()`中，在通常计算中使用，字符串三元运算符可以直接在[`PRINTFORM`](../Reference/PRINT.zh.md)系列指令中使用。\n\t不过，在`\\@～\\@`格式的三元运算符中，`#`也可以省略（省略时假值为空字符串，并会产生警告）。\n\n### 赋值运算符\n- `'=` 用于字符串型变量的字符串表达式赋值运算符 [详情请见](expression.md#form_2)\n\n### 自增·自减\n- `++` 自增\n- `--` 自减\n代替赋值语句使用。不能与其他运算符组合。\n\n## 临时运算符优先级表\n|分类               |优先级|复合赋值 |符号                         |\n|:------------------|:-----|:------------|:----------------------------|\n|否定运算符         |高    |×           |`~`, `!`                     |\n|算术运算符         |↑    |○           |`*`, `\\`, `%`                |\n|                   |      |○           |`+`, `-`                     |\n|位移运算符         |      |○           |`<<`, `>>`                   |\n|比较运算符         |      |×           |`<`, `>`, `<=`, ``>=`        |\n|                   |      |×           |`==`, `!=`                   |\n|逻辑运算符         |      |○           |`&`, `|`, `^`                |\n|                   |↓    |×           |`&&`, `!&`, `||`, `!|`, `^^`|\n|三元运算符         |低    |×           |`～?…#＿`                   |\n\n## 运算的新增\n- `==` 字符串之间的比较。不能比较数值和字符串。\n- `!=` 字符串之间的比较。\n- `<` 字符串之间的比较。比较从开头开始，找到不同字符时立即确定。\n- `>` 字符串之间的比较。\n- `<=` 字符串之间的比较。\n- `>=` 字符串之间的比较。\n- `+` 字符串之间的连接。不能对数值和字符串进行加法·连接。\n- `*` 字符串与整数的乘法。不能将字符串与字符串相乘。\n\n\t**示例**\n\n\t\tSTR:0 = % \"あ\" * 10 %\n\t\tPRINTFORML STR:0 = \"%STR:0%\"\n\t\tWAIT\n\n\t**结果**\n\n\t\tSTR:0 = \"ああああああああああ\"\n\n## 逻辑运算符的短路评估\n短路评估是指例如在`(X && Y)`这样的表达式中，当`X`为`0`时，无论`Y`的值如何，运算结果都明显为`0`，因此不评估`Y`的评估方法。\n包括吉里吉里在内的许多语言对逻辑运算符进行短路评估。\n通过这种评估方法，可以进行如下写法。\n\n\tIF (ASSI >= 0) && (NO:ASSI == 1)\n\t\t～～～\n\tELSE\n\t\t～～～\n\tENDIF\n\n当`ASSI`小于等于0时，无论`(NO:ASSI == 1)`的结果如何，整体结果都是`0`，所以不会引用`NO:ASSI`。因此也不会发生错误。\n评估顺序是左项优先，右项在后。\n\n\tIF (NO:ASSI == 1) && (ASSI >= 0)\n\n这样写的话，会先计算`(NO:ASSI == 1)`，所以在`ASSI < 0`时会出错。"
  },
  {
    "id": "Emuera/replace",
    "sourcePath": "docs/Emuera/replace.zh.md",
    "title": "_replace.csv",
    "names": [],
    "signatures": [],
    "summary": "通过在csv文件夹中放置名为_replace.csv的文件，可以进行与显示相关的设置。",
    "body": "# _replace.csv\n通过在csv文件夹中放置名为_replace.csv的文件，可以进行与显示相关的设置。\n\n## お金の単位(Currency symbol)\n在`PRINT_SHOPITEM`显示的商品价格上附加的单位。\n标准为`$`。可以是全角字符或多字符字符串。\n\n## 単位の位置(Currency symbol position)\n在`PRINT_SHOPITEM`显示的商品价格上附加的单位是位于数字前还是数字后。\n用`前`或`後`指定。标准为`後`。\n\n## 起動時簡略表示(Loading message)\n在配置中将`ロード時にレポートを表示する`功能设为OFF时，代替显示的字符串。\n标准为`Now Loading...`。\n\n## 販売アイテム数(Max shop item storage)\n在eramaker的通常SHOP处理中，`PRINT_SHOPITEM`会显示`ITEMSALES`不为0的`ITEMNAME(0～999)`全部。\n而购买处理和`@EVENTBUY`的处理只在输入了`0～99`的情况下进行，输入其他值时会调用`@USERSHOP`。\n\nEmuera也基本上重现了这个处理。\n修改`販売アイテム数`时，调用购买处理的商品范围会发生变化。\n例如，将销售商品数量设为`1000`时，输入`0～999`的情况下进行购买处理，输入负值或`1000`以上值时调用`@USERSHOP`。\n\n请注意，输入0～(销售商品数量-1)时，无论购买成功与否，都不会调用@USERSHOP。\n例如销售商品数量为1000时，\"[200] - 存档\"或\"[300] - 读档\"会被视为尝试购买200号、300号商品的处理，不会调用@USERSHOP。\n\n另外，如想增加（减少）`PRINT_SHOPITEM`显示的商品，请更改`VariableSize.csv`中`ITEMNAME`和`ITEMSALES`数组的元素数量。\n`ITEMNAME`和`ITEMSALES`数组元素数量中较小的那个将成为`PRINT_SHOPITEM`显示的商品范围。\n\n## DRAWLINE文字(DRAWLINE character)\n`[DRAWLINE](../Reference/DRAWLINE.zh.md)`指令显示的字符。\n标准为`-`。\n\n## BAR文字1(BAR character 1)\n## BAR文字2(BAR character 2)\n指定用于`[BAR](../Reference/BAR.zh.md)`或`[BARL](../Reference/BAR.zh.md)`指令的字符。\n标准为`BAR字符1`为`*`，`BAR字符2`为`.`。\n这种情况下会显示为`[****....]`。\n也可以指定全角字符或多字符字符串，但请考虑显示偏移。\n另外，指定数字时，Emuera会为了将`[88881111]`等视为可点击按钮而做出不自然的动作。\n\n## システムメニュー0(System menu 0)\n## システムメニュー1(System menu 1)\n标题画面最初显示的选择项说明使用的字符串。\n标准分别为`从最初开始`、`读取后开始`，\n\n\t[0] 从最初开始\n\t[1] 读取后开始\n\n如上所示显示。\n定义`@SYSTEM_TITLE`使用自定义标题画面时，这里指定的字符串不会使用。\n请在`@SYSTEM_TITLE`中创建显示处理。\n\n## COM_ABLE初期値(Default COM_ABLE)\n在`TRAIN`中找不到`@COM_ABLE{X}`时的值。\n标准为1，未定义对应`@COM_ABLE`时视为COM可执行。\n将此值设为0时，未定义`@COM_ABLE`的情况下视为COM不可执行。\n\n## 汚れの初期値(Default Stain)\n`STAIN`初始化时赋值的值。\n用`/`分隔可以指定`STAIN:1`之后的值。\n标准为`0, 0, 2, 1, 8`。\n\n## 時間切れ表示(Time up message)\n`TINPUT`等有限时输入指令时间到时显示的字符串。\n标准为`时间到`。\n\n## EXPLVの初期値(Default EXPLV)\n指定`EXPLV`的初始值。\n用`/`分隔可以指定`EXPLV:1`之后的值。\n标准为`0, 1, 4, 20, 50, 200`。\n\n## PALAMLVの初期値(Default PALAMLV)\n指定`PALAMLV`的初始值。\n用`/`分隔可以指定`PALAMLV:1`之后的值。\n标准为`0, 100, 500, 3000, 10000, 30000, 60000, 100000, 150000, 250000`。\n\n## PBANDの初期値(Default PALAMLV)\n指定`PBAND:0`的初始值。\n标准为`4`。\n\n## RELATIONの初期値(Default RELATION)\n在`Chara**.csv`中，未指定时`RELATION`的初始值。\n标准为`0`。"
  },
  {
    "id": "Emuera/resources",
    "sourcePath": "docs/Emuera/resources.zh.md",
    "title": "资源文件（历史文档）",
    "names": [],
    "signatures": [],
    "summary": "本页描述的是原版 Emuera 的资源设置方法。Skia 版已全面重构图像资源管理（懒加载索引、SharedBitmapCache、AnimSpriteCache），资源设置说明已迁移至 资源设置 — 图像资源的准备方法。",
    "body": "# 资源文件（历史文档）\n\n!!! warning \"历史文档\"\n\n    本页描述的是原版 Emuera 的资源设置方法。Skia 版已全面重构图像资源管理（懒加载索引、SharedBitmapCache、AnimSpriteCache），资源设置说明已迁移至 [资源设置 — 图像资源的准备方法](../tutorial/resources.zh.md)。\n\n这里介绍在Emuera中显示图像所需的资源文件的准备方法。\n\n资源文件需要在可执行文件所在的文件夹中创建`resources`文件夹并将其放入其中。\n文件在`resources`文件夹内，即使是子文件夹也没关系（1.823及以上版本）。\n\n## 资源指定文件(csv)\n在`resources`文件夹中放置csv格式的文本时，会作为资源指定文件读取。格式如下。\n\n\t;注释行\n\t资源名A, 原文件名, x, y, width, height, posx, posy\n\t资源名B, 原文件名, x, y, width, height, posx, posy\n\n\t资源名C, ANIME, width, height\n\t资源名C, 原文件名, x, y, width, height, posx, posy, delay\n\t资源名C, 原文件名, x, y, width, height, posx, posy, delay\n\n- 注释行\n\t以分号开头的行作为注释行被忽略。\n\n- 精灵\n\n\t\t资源名A, 原文件名, x, y, width, height, posx, posy\n\n\t通过上述格式可以创建具有`资源名A`的精灵。\n\t资源名是作为`<img src='资源名A'>`的`src`属性的属性值使用的名称。\n\t另外，也可以以`SPRITECREATED(\"资源名A\")`这样的形式使用。\n\t资源名不能与其他资源名称重复。\n\t原文件名是图像文件的名称。包含扩展名指定。使用相对于csv文件的路径指定。\n\t不能指定csv文件上级目录的图像文件。\n\t请指定与csv文件同级或其子文件夹中的图像文件。\n\t`x, y, width, height`以像素为单位指定原图像中使用的部分。\n\t`x, y, width, height`可以省略，此时使用整个图像。\n\t`posx, posy`指定图像的相对位置。该值可以通过`SPRITEPOS`或`SPRITEMOVE`指令动态更改。\n\t`posx, posy`可以省略，此时等同于指定了`0,0`。\n\n- 动画精灵\n\n\t\t资源名C, ANIME, width, height\n\t\t资源名C, 原文件名, x, y, width, height, offsetx, offsety, delay\n\t\t资源名C, 原文件名, x, y, width, height, offsetx, offsety, delay\n\t\t……\n\n\t通过上述格式可以创建具有`资源名C`的动画精灵。\n\t要创建动画精灵，需要在文件名处写`ANIME`并指定精灵整体的尺寸。\n\t此`width, height`必须是正整数。不能省略。\n\t从下一行开始，指定动画的各个帧图像。\n\t各帧的定义方法与普通精灵相同。\n\t`delay`以毫秒为单位指定该帧的显示时间。省略时为`1000ms`。\n\t注意，Emuera标准情况下在[`INPUT`](../Reference/INPUT.zh.md)等等待时间内不进行重绘，因此动画精灵看起来像是静止在特定帧。\n\t请执行`SETANIMETIMER`指令以在INPUT中进行重绘。\n\t`SETANIMETIMER`指令的详细信息请参考指令说明。\n\n## 图像文件\n显示图像需要图像文件。\n图像文件准备为`bmp`、`jpg`、`png`格式之一并放入`resources`文件夹中。\nEM+EE中通过捆绑库也可以使用`webp`格式\n在ERB内可以通过`GCREATEFROMFILE`生成图形\n\n## 注意事项\ncsv文件中指定的所有图像文件会在Emuera启动时展开到内存中并占用内存直至结束。\n比起读取大量图像文件，建议将图像合成为一个单一文件并指定范围使用，这样在内存和速度上都有利。\n另外，适当时机进行`GCREATEFROMFILE`与`GDISPOSE`、`SPRITECREATE`与`SPRITEDISPOSE`的处理也很有效\n在配置的绘制接口中指定`WINAPI`时，通过`GDI`处理，不进行Alpha混合。\n绘制接口为`Graphics`或`TextRenderer`时，通过`GDI+`处理，进行Alpha混合。\n放大缩小也因`WINAPI(GDI)`与`Graphics`或`TextRenderer(GDI+)`而略有不同。\n\n!!! info \"Skia 版特性变更\"\n\n    以上注意事项仅适用于原版 Emuera（GDI/GDI+ 渲染）。Skia 版采用以下新机制：\n\n    - **懒加载**：CSV 预加载仅建立索引，图片首次渲染时才解码，不再启动时全量加载\n    - **SharedBitmapCache**：全局 LRU 位图池（max 200），同一文件只解码一次\n    - **AnimSpriteCache**：动画精灵 LRU 缓存（max 6），超出自动释放\n    - **SPRITECREATEFROMFILE**：运行时动态加载，无需 CSV 预定义\n\n    详见 [HTML 与图形 — 资源设置](../tutorial/html-syntax.zh.md#resource-configuration)"
  },
  {
    "id": "Emuera/shortcut",
    "sourcePath": "docs/Emuera/shortcut.zh.md",
    "title": "快捷键",
    "names": [],
    "signatures": [],
    "summary": "Emuera可以通过快捷键执行几种操作。",
    "body": "# 快捷键\nEmuera可以通过快捷键执行几种操作。\n也介绍EmueraEM+EE新增的功能。\n\n!!! note \"`Ctrl + B`\"\n\t将Emuera窗口最小化。\n\n!!! note \"`Ctrl + C`, `Ctrl + Insert`\"\n\t打开剪贴板对话框。\n\t此操作仅在未选择任何文字时有效。\n\t如果选择了文字，则只是复制所选文字。\n\n!!! note \"`Ctrl + V`, `Shift + Insert`\"\n\t粘贴复制的文字。\n\n!!! note \"`Ctrl + D`\"\n\t打开调试窗口。\n\t这仅在以调试模式启动时有效。\n\n!!! note \"`Ctrl + R`\"\n\t更新调试窗口内的信息。焦点不会移动。\n\t这仅在以调试模式启动时有效。\n\n!!! note \"`Ctrl + 0～9`\"\n\t将宏循环切换到组0～9。\n\n!!! note \"`Shift + F1～F12`\"\n\t将当前字符串分配为F1～F12的宏。\n\n!!! note \"`F1～F12`\"\n\t调用分配给各键的宏。\n\n!!! note \"`Esc`\"\n\t在宏执行过程中按下可中断宏。\n\n!!! note \"`Ctrl + T`\"\n\tEM+EE新增的功能。返回标题画面。\n\n!!! note \"`Ctrl + R`\"\n\tEM+EE新增的功能。重新启动。\n\n!!! note \"`Ctrl + O`\"\n\tEM+EE新增的功能。重新加载ERB。"
  },
  {
    "id": "Emuera/system_flow",
    "sourcePath": "docs/Emuera/system_flow.zh.md",
    "title": "流程图",
    "names": [],
    "signatures": [],
    "summary": "流程图使用DiagramDesigner制作。",
    "body": "# 流程图\n流程图使用`DiagramDesigner`制作。\n数据文件在此处。\n\n以下说明文中，除非特别注明，句子的主语均为Emuera.exe。\n\n## TITLE\n启动并读取erb结束后，以及执行`BEGIN TITLE`后。\n\n> 各事件函数的详细说明请参阅[事件函数](../tutorial/event-functions.zh.md)。\n\n![](../assets/images/title.gif)\n\n如果定义了`@SYSTEM_TITLE`则调用它，其他什么也不做。\n如果在`@SYSTEM_TITLE`中没有执行[`BEGIN`](../Reference/BEGIN.zh.md)指令或`LOADDATA`指令，而是执行了[`RETURN`](../Reference/RETURN.zh.md)，则由于没有要执行的处理而错误终止。\n如果没有定义`@SYSTEM_TITLE`，则执行标准的标题处理。\n标准标题画面的`[0] 从最初开始`等文字是可以更改的。\n详情请参考_replace.csv。\n\n选择`[0] 从最初开始`时，首先进行数据初始化。\n具体来说是设置`STR`或`PRINTLV`的初始值（与`RESETDATA`指令相同）、`ADDCHARA 0`等。\n接着执行`BEGIN FIRST`，转移到`FIRST`。\n\n选择`[1] 读取后开始`时，如果定义了`@TITLE_LOADGAME`则调用它。\n如果没有定义则显示标准的加载画面。\n与`LOADGAME`调用的画面略有不同。\n\n## FIRST\n在标题画面选择`[0] 从最初开始`时，以及执行`BEGIN FIRST`后。\n如果在`@EVENTFIRST`中没有执行[`BEGIN`](../Reference/BEGIN.zh.md)指令，由于没有要执行的处理而错误终止。\n\n![](../assets/images/first.gif)\n\n## SHOP\n加载后，以及执行`BEGIN SHOP`后。\n加载后的情况下不执行`@EVENTSHOP`的处理。\n\n![](../assets/images/shop.gif)\n\n调用`@SHOW_SHOP`后要求输入。此输入中，输入`0～99`则执行购买处理，其他输入则调用`@USERSHOP`。\n此范围可通过`_replace.csv`更改。详情请参考_replace.csv。\n另外，`PRINT_ITEMSHOP`指令显示的商品范围为`ITEMNAME`和`ITEMSALES`元素数中较小的一个（标准为1000）。\n\n如果调用购买处理，会判断对应的`ITEMSALES`是否不为`0`，或`MONEY`是否大于`ITEMPRICE`。\n如果购买判断失败，再次要求输入。\n在eramaker中，购买失败时会从`@SHOW_SHOP`重新开始。\n\n购买判断成功时，将`ITEM`编号赋值给`BOUGHT`变量，将`ITEM:BOUGHT`增加`1`，将`MONEY`减少`ITEMPRICE:BOUGHT`。\n调用`@EVENTBUY`并返回`@SHOW_SHOP`。\n\n只要不执行[`BEGIN`](../Reference/BEGIN.zh.md)指令，就不会离开`SHOP`。\n\n## TRAIN\n执行`BEGIN TRAIN`后。\n\n![](../assets/images/train.gif)\n\n首先初始化部分变量。\n具体来说，将`0`赋值给`ASSIPLAY:0`，将`-1`赋值给`PREVCOM:0`、`NEXTCOM:0`。\n此外将所有`TFLAG`设为`0`，将所有角色的`GOTJUELP`、`TEQUIP`、`EX`、`PALAM`、`SOURCE`全部设为0。\n最后将所有角色的`STAIN:2`设为`2`，`STAIN:3`设为`1`，`STAIN:4`设为`8`，其他设为`0`。\n\n离开`TRAIN`时不进行初始化，所以在`SHOP`中保存时，这些值会留在存档数据中。\n通过在`@SAVEINFO`等中将角色的`GOTJUEL`、`TEQUIP`、`EX`、`PALAM`等设为`0`，可以节省存档数据的大小。\n关于给`NEXTCOM`赋非负值时的动作存在严重的缺陷，因此这里不作说明。\nEmuera的`NEXTCOM`是为了重现旧代码动作（包括前述缺陷）而实现的，不设想用于新用途。\n关于`CALLTRAIN`指令请参考扩展指令。\n\n调用`@SHOW_STATUS`后显示可执行的`TRAIN`。\n对于已定义的`TRAINNAME`，寻找`@COM_ABLExx`。\n搜索范围（图中的`MAX_TRAIN`）在Emuera中为`VariableSize.csv`中指定的TRAINNAME范围，eramaker中为`2147483647`。\n如果未定义`@COM_ABLExx`或返回非0值，则可执行，显示`TRAINNAME`。\n如果`@COM_ABLExx`返回`0`，则不可执行，不显示`TRAINNAME`。\n此时记住是否可执行。（执行时不重新调用`@COM_ABLExx`。）\n\n`TRAINNAME`显示完毕后调用`@SHOW_USERCOM`。\n`@SHOW_USERCOM`后，在输入前初始化`UP`、`DOWN`、`LOSEBASE`。\n之后要求输入。\n\n将输入结果与前述`@COM_ABLExx`的结果对照，如果是可执行的命令，则调用对应的`@COMxx`。\n首先，将`TRAIN`编号赋值给`SELECTCOM`变量，将所有角色的`NOWEX`的所有元素设为0。\n接着调用`@EVENTCOM`，然后调用对应的`@COM`。\n如果`@COM`返回非0值，则调用`@SOURCE_CHECK`、`@EVENTCOMEND`，返回`@SHOW_STATUS`。\n`@SOURCE_CHECK`结束后，在调用`@EVENTCOMEND`前将所有角色的`SOURCE`的所有元素设为0。\n`@SOURCE_CHECK`结束后，如果`@EVENTCOMEND`不存在或在`@EVENTCOMEND`中没有执行`WAIT`指令，则在`@SHOW_STATUS`前产生`WAIT`。\n\n> **注**：`@SOURCE_CHECK` 是**脚本侧的系统函数**——引擎在这里只负责\"在 `@COM` 返回非 0 值之后调用它\"。它内部做什么（数值结算、口上分发……）全部由作品脚本自行实现，引擎不介入。正因如此，eraTW 一类作品会在 `@SOURCE_CHECK` 内进一步 `CALL` 自己的指令执行层（如 `@CALL_COM`，其中含 SCOM 分支与 `TFLAG:50` 解析）。排查这类流程时不要以引擎文档为准，要去读对应作品的脚本。\n如果`@COM`返回`0`则返回`@SHOW_STATUS`。\n另外，执行`UPCHECK`指令时，将`UP`和`DOWN`的值加减到`TARGET`的`PALAM`上，并将`UP`和`DOWN`的所有值设为`0`。\n如果输入结果不是可执行的命令，则调用`@USERCOM`，返回`@SHOW_STATUS`。\n\n只要不执行[`BEGIN`](../Reference/BEGIN.zh.md)指令，就不会离开`TRAIN`。\n\n## ABLUP\n执行`BEGIN ABLUP`后。\n\n![](../assets/images/ablup.gif)\n\n调用`@SHOW_JUEL`、`@SHOW_ABLUP_SELECT`，要求输入。\n\n如果输入在`0～99`范围内，则寻找对应的`@ABLUP`。\n如果定义了对应的`@ABLUP`则调用`@ABLUP`，返回`@SHOW_JUEL`。\n如果没有定义，再次要求输入。\n在eramaker中，如果没有定义则从`@SHOW_JUEL`重新开始。\n\n如果输入超出`0～99`范围，则调用`@USERABLUP`，返回`@SHOW_JUEL`。\n截至Emuera1.705，没有改变此范围的方法。\n\n只要不执行[`BEGIN`](../Reference/BEGIN.zh.md)指令，就不会离开`ABLUP`。\n\n## AFTERTRAIN\n执行`BEGIN AFTERTRAIN`后。\n如果在`@EVENTEND`中没有执行[`BEGIN`](../Reference/BEGIN.zh.md)指令，由于没有要执行的处理而错误终止。\n\n![](../assets/images/aftertrain.gif)\n\n## TURNEND\n执行`BEGIN TURNEND`后。\n如果在`@EVENTTURNEND`中没有执行[`BEGIN`](../Reference/BEGIN.zh.md)指令，由于没有要执行的处理而错误终止。\n\n![](../assets/images/turnend.gif)\n\n## LOADGAME\n执行[`LOADGAME`](../Reference/SAVEGAME.zh.md)指令时。\n[`BEGIN`](../Reference/BEGIN.zh.md)指令包含[`RETURN`](../Reference/RETURN.zh.md)指令，因此`[BEGIN]`以下的语句决不会执行，但[`LOADGAME`](../Reference/SAVEGAME.zh.md)和[`SAVEGAME`](../Reference/SAVEGAME.zh.md)指令与[`CALL`](../Reference/CALL.zh.md)指令一样会回到原来的位置。\n不过，如果执行了LOAD，则会忘记原来的位置并转移到`LOADDATAEND`。\n\n![](../assets/images/loadgame.gif)\n\n## SAVEGAME\n执行[`SAVEGAME`](../Reference/SAVEGAME.zh.md)指令时。\n调用`@SAVEINFO`的时机是在实际写入前一刻。\n\n![](../assets/images/savegame.gif)\n\n## LOADDATAEND\n在[`LOADGAME`](../Reference/SAVEGAME.zh.md)中执行LOAD后，以及执行`LOADDATA`指令后。\n在执行LOAD时，调用中的函数等之前的状态全部被清除。\n\n![](../assets/images/loaddataend1821.gif)\n\n在eramaker中这里什么也不做，转移到`@SHOW_SHOP`。\n在Emuera中，如果定义了`@SYSTEM_LOADEND`则执行`@SYSTEM_LOADEND`。\n直到`@SYSTEM_LOADEND`结束前如果执行了[`BEGIN`](../Reference/BEGIN.zh.md)指令，则转移到那里。\n否则如果定义了`@EVENTLOAD`则执行`@EVENTLOAD`。\n\n直到`@EVENTLOAD`结束前如果执行了[`BEGIN`](../Reference/BEGIN.zh.md)指令，则转移到那里。\n如果没有执行[`BEGIN`](../Reference/BEGIN.zh.md)指令，则照常转移到`@SHOW_SHOP`。\n\n## 错误处理流程（SK 专属）\n\n### THROW 异常处理\n\n当执行 `THROW` 指令时，引擎会检查是否定义了 `@BEFORE_THROW` 事件函数：\n\n```\nTHROW 指令执行\n    │\n    ├─ 检查是否已在 @BEFORE_THROW 中（防止递归）\n    │   ├─ 是 → 直接打印消息并退出\n    │   │\n    │   └─ 否 → 检查是否定义了 @BEFORE_THROW\n    │           ├─ 是 → 延迟抛出，调用 @BEFORE_THROW\n    │           │       → @BEFORE_THROW 结束后抛出异常\n    │           │\n    │           └─ 否 → 直接抛出异常\n```\n\n### 通用错误处理\n\n当发生任何未捕获的错误时（包括运行时错误、脚本错误等），引擎会检查是否定义了 `@BEFORE_ERROR` 事件函数：\n\n```\n错误发生\n    │\n    ├─ 检查是否已在 @BEFORE_ERROR 中（防止递归）\n    │   ├─ 是 → 直接处理错误并退出\n    │   │\n    │   └─ 否 → 检查是否定义了 @BEFORE_ERROR\n    │           ├─ 是 → 延迟处理，调用 @BEFORE_ERROR\n    │           │       → @BEFORE_ERROR 结束后处理错误\n    │           │\n    │           └─ 否 → 直接处理错误\n```\n\n> **SK 专属说明**：`BEFORE_THROW` 和 `BEFORE_ERROR` 事件函数是 Skia 版本新增的功能，允许脚本在异常抛出前进行拦截和处理。原版 Emuera 不支持这些事件。\n> 详见[事件函数 — BEFORE_THROW / BEFORE_ERROR](../tutorial/event-functions.zh.md#before_throw)。"
  },
  {
    "id": "Emuera/usage",
    "sourcePath": "docs/Emuera/usage.zh.md",
    "title": "Emuera使用方法",
    "names": [],
    "signatures": [],
    "summary": "需要.NET Framework 4.5环境。(EM+EE需要7.0)",
    "body": "# Emuera使用方法\n\n## 运行环境\n需要.NET Framework 4.5环境。(EM+EE需要7.0)\n已停止支持XP、Vista。已在Windows 10、11上确认可运行\n\n如果出现\"应用程序未能正确初始化\"的错误而无法启动，请安装.NET Framework 4.5。\n请从Microsoft网站下载并安装.NET Framework 4.5运行时。\n\n## 使用方法\n请将`EmueraXXX.exe`放入与`eramaker.exe`相同的文件夹中启动。\n(XXX中包含表示版本的数字，根据环境可能不显示.exe)\n如果无法启动，请阅读\"运行环境\"章节。\n启动后立即生成`emuera.config`，如果错误终止则生成`emuera.log`。\n\n基本操作与`eramaker.exe`几乎相同，但可以使用鼠标操作。\n请用鼠标指向并点击选择项（用[]括起来的数字）。\n可以使用ESC键或右键单击跳转到下一个选择项，按住右键选择选择项时，会选择并同时跳转到下一个选择项。\n其他还有，`Ctrl+V`粘贴剪贴板内容，（与`eramaker.exe`一样）按上下键调出之前的输入等。\n\n可以使用`EraMakerEx`中进行字符串转换的文件直接启动。\n但此功能默认是禁用的，如需使用请在帮助设置中勾选`使用_Rename.csv`。\n\n## 宏\nEmuera有简单的宏功能。\n例如，输入`\\e`时与按ESC键或右键单击一样，会跳转到下一个选择项。\n输入`\\n`时会在那里分割输入，进行下一个输入。\n例如，输入`0\\e\\n1\\e\\n`时，会输入0并跳转到下一个选择项，输入1并跳转到下一个选择项。\n另外，用(～～)*n括起来的输入会重复n次。\n`(0\\e\\n)*3`与`0\\e\\n0\\e\\n0\\e\\n`相同。\n另外，可以在宏执行中按ESC键，中止宏的执行。\n\n创建的宏可以与`F1-F12`键关联保存。\n按住`Shift`键并按下`F1～F12`键，将当前输入内容保存到`F1～F12`键。\n之后，按下`F1～F12键`即可输入保存的宏。\n保存的宏存储在`macro.txt`中。\n（需要启用配置选项\"使用键盘宏\"）\n\n另外，按住`Ctrl`键并按下数字`0～9`键，可以切换宏组。\n（Emuera启动后默认选择组0）\n由于可以在组0的`F1～F12`和组1的`F1～F12`中存储不同的宏，可以记忆更多的宏\n组也可以从输入框的右键菜单中更改\n\n也可以直接用文本编辑器编辑`macro.txt`\n在`宏键F○:`冒号右侧，写下按下`F○键`时要输入的宏\n`G×:宏键F○:`是选择组×时的宏\n如果更改`组×:设置为宏组×`冒号右侧的消息，\n也可以更改切换到组×时的显示字符串。\n\n## 菜单\n使用此功能需要在配置中启用`使用菜单`项目。\n默认已启用。\n\n### 文件\n#### 重新启动\n重新启动Emuera。\n如果没有保存，正在运行的游戏信息会丢失，请注意。\n\n#### 保存日志\n将过去日志另存为文件。\n保存的最大行数与历史日志行数相同。\n\n#### 返回标题画面\n返回标题。\n如果没有保存，正在运行的游戏信息会丢失，请注意。\n\n#### 重新读取代码\n保持游戏信息不变，重新读取.erb文件。\n已调用的函数会执行读取前的代码。\n调用的函数消失前的代码会留在内存中，连续使用可能导致内存不足。\n\n#### 退出\n退出Emuera\n\n### 帮助\n#### 设置\n进行配置设置。设置详细信息请参考配置。"
  },
  {
    "id": "Emuera/user_defined_in_expression_function",
    "sourcePath": "docs/Emuera/user_defined_in_expression_function.zh.md",
    "title": "用户定义的表达式函数",
    "names": [],
    "signatures": [],
    "summary": "除了内置函数外，还可以在表达式中调用用@～～定义的函数作为\"表达式中可使用的函数\"。",
    "body": "# 用户定义的表达式函数\n除了内置函数外，还可以在表达式中调用用`@～～`定义的函数作为\"表达式中可使用的函数\"。\n关于\"表达式中可使用的函数\"中的内置函数，请参考[表达式中可使用的函数](../Reference/README.zh.md)。\n\n## 格式\n被调用的函数必须带有`#FUNCTION`标志或`#FUNCTIONS`标志，并以`RETURNF`结束。\n\n添加`#FUNCTION`会被识别为返回数值的函数。\n添加`#FUNCTIONS`会被识别为返回字符串的函数。\n带有`#FUNCTION(S)`的函数不能用通常的[`RETURN`](../Reference/RETURN.zh.md)结束。而是用`RETURNF`结束。\n`RETURNF`需要指定数值表达式或字符串表达式。这必须与`#FUNCTION(S)`所指示的类型一致。\n省略`RETURNF`的参数，或在没有`RETURNF`的情况下到达函数末端时，返回`0`或空字符串。\n\n\tX = GET_CFLAG(TARGET, Y)\n\tSTR = %GET_NAME(TARGET)%\n\n\t@GET_CFLAG(ARG:0, ARG:1)\n\t#FUNCTION\n\t\tSIF ARG:0 <= 0 || ARG:0 >= CHARANUM\n\t\t\tRETURNF 0\n\t\tRETURNF CFLAG:(ARG:0):(ARG:1)\n\n\t@GET_NAME(ARG:0)\n\t#FUNCTIONS\n\t\tSIF ARG:0 <= 0 || ARG:0 >= CHARANUM\n\t\t\tRETURNF \"\"\n\t\tRETURNF NAME:(ARG:0)\n\n※虽然函数定义的参数用`()`括起来，但这不是定义时的必要语法。\n调用表达式函数时，必须使用用`()`括起来的语法。\n也可以像通常函数一样用逗号分隔函数名和参数。\n以下两行意思相同。\n\n\t@GET_CFLAG(ARG:0, ARG:1)\n\t@GET_CFLAG, ARG, ARG:1\n\n另外，可以为参数设置初始值。\n关于初始值的语法，请参考[自定义函数中的参数指定](./function.md#_2)。\n\n## 限制\n### 无法从CALL调用\n带有`FUNCTION(S)`标志的函数无法通过[`CALL`](../Reference/CALL.zh.md)等通常调用方式调用。\n只能在表达式中调用。\n\n\t\t;错误\n\t\tCALL GET_CFLAG, X, Y\n\t@GET_CFLAG(ARG:0, ARG:1)\n\t#FUNCTION\n\t\tSIF ARG:0 <= 0 || ARG:0 >= CHARANUM\n\t\t\tRETURNF 0\n\t\tRETURNF CFLAG:(ARG:0):(ARG:1)\n\n可以通过专用于调用`#FUNCTION(S)`的指令`CALLF`、`CALLFORMF`进行调用。\n\n### 部分指令不可使用\n在带有`FUNCTION(S)`标志的函数中，不能使用[`WAIT`](../Reference/WAIT.zh.md)等伴随输入的指令、`CALL`等伴随函数调用的指令。\n使用时会出错。\n\n虽然不能使用`CALL`指令，但可以在表达式中调用带有`FUNCTION(S)`标志的函数。\n另外，也可以通过`CALLF`、`CALLFORMF`指令调用`#FUNCTION(S)`。\n\n### 无法重载\n无法根据参数数量、类型的不同区分调用多个`#FUNCTION(S)`函数。\n同名函数只能定义一个，定义多个同名函数时只有第一个定义的函数有效。\n\n### 覆盖内置函数\n定义与内置函数同名的函数时，该内置函数将无法调用。\n例如，定义`@ABS`后就无法调用原来的ABS。\n内置函数被覆盖时，Emuera启动时会显示警告。\n由于内置函数被覆盖可能导致非预期动作，可以通过配置禁止函数覆盖。\n也有配置选项可以不警告即使被覆盖（仅在有意覆盖时，不推荐）。\n\n## 注意事项\n不应该在带有`FUNCTION(S)`标志的函数中改变局部变量以外的变量。\n改变局部变量以外的变量的函数（有副作用的函数）可能因后述的短路评估或表达式评估顺序等导致动作改变。\n另外，由于调试命令或调试用变量监视窗口等的意外调用，可能导致非预期动作。\n\n### 短路评估导致的调用省略\n即使表达式中有函数，也可能因短路评估而不被调用。\n\n例如以下脚本，在[`IF`](../Reference/IF.zh.md)语句中调用`GET_ASSI_CFLAG`，在`GET_ASSI_CFLAG`中修改`ASSI`。\n\n\t\tIF X || GET_ASSI_CFLAG(0)\n\t\t\tY = CFLAG:ASSI:2\n\t\tENDIF\n\t@GET_ASSI_CFLAG(ARG:0)\n\t#FUNCTION\n\t\tSIF ASSI < 0\n\t\t\tASSI = 0\n\t\tRETURNF CFLAG:ASSI:(ARG:0)\n\n乍一看，`Y = CFLAG:ASSI:2`执行时似乎不会出现`ASSI < 0`的情况。\n但是，当`X`不为`0`时，因短路评估`GET_ASSI_CFLAG`不会执行，因此可能在`ASSI < 0`状态下尝试评估`CFLAG:ASSI:2`而出错。\n\n### 因表达式评估顺序导致结果改变\n表达式中的变量·函数评估顺序是不确定的。\n有副作用的函数可能依赖于表达式中函数的调用顺序。\n请不要编写此类代码。\n虽然在相同版本的Emuera中调用顺序应该是相同的，但未来可能会更改。\n在以下脚本中，在`@ADDCHARA_CFLAG`中修改`TARGET`。\n\n\t\tX = CFLAG:TARGET:10 + ADDCHARA_CFLAG(0)\n\t@ADDCHARA_CFLAG(ARG)\n\t#FUNCTION\n\t\tADDCHARA ARG\n\t\tTARGET = CHARANUM -1\n\t\tRETURNF CFLAG:TARGET:2\n\n根据是在`@ADDCHARA_CFLAG`之前还是之后评估`CFLAG:TARGET:10`，`CFLAG:TARGET:10`所指的变量会改变。\n因此此脚本依赖于评估顺序。\n不应在带有`#FUNCTION(S)`标志的函数中使用[`ADDCHARA`](../Reference/ADDCHARA.zh.md)或给`TARGET`赋值。\n可能通过调试功能被调用\n带有`#FUNCTION(S)`标志的函数不仅可能从`*.ERB`文件中的脚本调用，还可能从调试命令或调试用变量监视窗口动态调用。\n特别是变量监视频繁尝试更新值，每次更新时都会调用该函数。\n有副作用的函数可能因这种调用而误动作。"
  },
  {
    "id": "Emuera/user_defined_variables",
    "sourcePath": "docs/Emuera/user_defined_variables.zh.md",
    "title": "用户定义的变量",
    "names": [],
    "signatures": [],
    "summary": "通过使用#DIM和#DIMS可以定义自己喜欢的变量。",
    "body": "# 用户定义的变量\n通过使用`#DIM`和`#DIMS`可以定义自己喜欢的变量。\n在函数内定义的变量成为仅在该函数内可用的私有变量，\n在头文件（ERH）内定义的变量成为在ERB中所有位置都可引用的全局变量。\n\n## 格式（私有变量的情况）\n在想要定义该变量的函数声明下方记录`#DIM(S) <变量名>, <元素数>{, <元素数>{, <元素数>}}`。\n`<变量名>`与函数名一样，以非数字开头，由符号仅包含`_`的任意字符串组成。\n`<元素数>`是`1～1000000`范围内的任意整数或常量表达式。省略时为`1`。\n根据给予的`<元素数>`数量，定义的变量维度会发生变化。最大为三维，无法定义四维以上的变量。\n通过`#DIM(S)`定义的私有变量可以在单一函数中定义多个。\n\n通过此方式，使用`<变量名>`指定的变量名在该函数内可用。\n变量可根据`<元素数>`指定的元素数进行赋值，但不会保存。初始值为`0`或空字符串。\n使用`#DIM`定义为整数型变量，使用`#DIMS`定义为字符串型变量。\n通过`#DIM(S)`定义的变量也可指定为其函数的参数。也可以设置初始值。\n\n\t@FIND_CSTR(KEY, VALUE)\n\t#FUNCTION\n\t#DIM LCOUNT\n\t#DIM KEY\n\t#DIMS VALUE\n\tSIF KEY < 0 || KEY >= VARSIZE(\"CSTR\")\n\t\tRETURNF -1\n\tFOR LCOUNT, 0, CHARANUM\n\t\tSIF LCOUNT == MASTER\n\t\t\tCONTINUE\n\t\tSIF CSTR:LCOUNT:KEY == VALUE\n\t\t\tRETURNF LCOUNT\n\tNEXT\n\n如上述脚本，通过根据用途命名变量，设置适当的元素数，\n也许可以改善因频繁使用不连续的`LOCAL`导致的可读性下降。\n\n## 初始值设置\n在声明一维数组变量时，可以定义初始值。\n定义了初始值的数组元素数可以省略，这种情况下初始值的数量自动成为数组的元素数。\n如果不省略元素数，则该数字成为数组的元素数。\n元素数未省略且初始值数量超过元素数时会出错。\n\n\t;因省略元素数，HOGE的元素数为3\n\t#DIM HOGE = 1,2,3\n\n\t;因未省略元素数，PUGE的元素数为100\n\t#DIM PUGE,100 = 4,5,6\n\n\t;错误（初始值数量超过指定元素数）\n\t#DIM HIGE,1 = 7,8,9\n\n\t;字符串变量也可以（用字符串表达式指定）\n\t#DIMS SHOGE = \"A\", \"B\", \"C\"\n\n另外，无法为多维数组定义初始值。\n\n## 动态变量\n像`#DIM(S) DYNAMIC <变量名>, <元素数>`这样在变量名前加入`DYNAMIC`时，定义的变量会被动态分配。\n具体来说，函数被调用时分配，在函数结束时变量和其中的值都会消失。\n（由于[`RESTART`](../Reference/RESTART.zh.md)指令是\"回到函数开头的指令\"，即使是动态分配的变量也不会重置）\n函数中调用自身（递归）时，也会为递归的次数分配变量，使递归处理行为稳定。\n但与不加`DYNAMIC`（静态变量）相比，运行速度会变慢。\n\n## 常量\n在定义一维数组变量时，在变量名前加入`CONST`，可以定义一维数组常量。\n与初始值一样，只能定义一维数组变量。\n常量声明必须有初始值，且中途无法通过赋值更改。\n另外，由于`CONST`的性质，无法与`GLOBAL`、`SAVEDATA`、`REF`、`DYNAMIC`关键字同时使用。\n另外，虽然可以指定数组元素数而不省略，但如果元素数与初始值数量不一致则会出错。\n\n\t;一维常量数组的定义\n\t#DIM CONST HOGE = 1,2,3\n\n\t;错误（初始值数量与元素数不一致）\n\t#DIM CONST PUGE,100 = 4,5,6\n\n\t;字符串变量也可以（用字符串表达式指定）\n\t#DIMS CONST SHOGE = \"A\", \"B\", \"C\"\n\n## 引用型变量\n在变量名前使用REF关键字，可以定义引用型变量。\n整数型1～3维数组、字符串型1～3维数组分别如下声明。\n\n\t#DIM REF HOGE1DIM,0\n\t#DIM REF HOGE2DIM,0,0\n\t#DIM REF HOGE3DIM,0,0,0\n\t#DIMS REF PUGE1DIM,0\n\t#DIMS REF PUGE2DIM,0,0\n\t#DIMS REF PUGE3DIM,0,0,0\n\n如果逗号数量正确，可以省略0。一维数组时也可以省略逗号。\n引用型变量没有实体，操作引用型变量时，会代替操作`REF`指令（截至ver1.815不可用）或通过引用传递接收到的变量。\n关于引用传递的详细信息，请参考函数-参数的引用传递。\n\n## 格式（全局变量的情况）\n在头文件（ERH）内记录`#DIM(S)`时，与在ERB中定义的私有变量不同，\n成为可从ERB中所有位置引用的全局变量。\n与私有变量不同，没有`DYNAMIC`、`STATIC`的区别，也无法定义使用`REF`的引用型变量，但可以像平常一样定义使用`CONST`的常量。\n作为函数中`DIM`没有的功能，可以定义可保存的变量、全局变量、角色变量。\n详情请参考头文件（ERH）项。\n\n## 限制\n### 无法使用与指令相同的名字\n不能定义与以下指令同名的变量。\n\n\t;错误\n\t#DIM PRINTFORM\n\t#DIM SELECTCASE\n\t#DIM CALL\n\t#DIM RETURN\n\t#DIM GOTO\n\t#DIM SQRT\n\t#DIM DATAFORM\n\t#DIM NOSKIP\n\t#DIM FUNC\n\t#DIM ENDFUNC\n\n可以定义与函数名·预处理器同名的变量，但不推荐。\n\n\t;不推荐\n\t#DIM EVENTFIRST\n\t#DIM COMF32\n\t#DIM COMABLE15\n\t#DIM SHOW_ABLUP_SELECT\n\t#DIM DIM\n\t#DIM PRI\n\t#DIM ONLY\n\t#DIM SKIPSTART\n\n### 无法从函数外部干预\n与其他`LOCAL@HOGE`的`LOCAL`不同，没有方法可以引用或赋值其他函数的私有变量。\n\n## `ERD(ERabasic Define)`功能\nEM+EE中新增的功能。可以在ERH中定义的变量上，像CSV变量一样使用`*.csv`文件或`*.ERD`文件设置标识符\n以下，摘自EM+EE摘要\n\n从`ERH`中定义的变量名开始准照文件加载，可以像现有`CSV`变量一样为数组命名\n`CSV`文件夹内可用的仍为传统的`\"变量名.csv\"`，`ERB`内可用的为`\"变量名.ERD\"`文件。格式与`CSV`变量文件相同。即使存在两个以上，只有定义了相同标识符时才会在启动时出错并终止。可以将不同标识符替换为相同整数\n另外，为多维数组变量命名时，可以通过在文件名后跟`@`和数字来对应各维度。从左边的下标开始对应`1`、`2`、`3`\n\n**ERH**\n\n  #DIM HOGE, 3\n  #DIM HOGE2D, 3, 3\n  #DIM HOGE3D, 3, 3, 3\n\n**文件构成**\n\n    HOGE.ERD\n    HOGE2D@1.ERD\n    HOGE2D@2.ERD\n    HOGE3D@1.ERD\n    HOGE3D@2.ERD\n    HOGE3D@3.ERD\n\n### 文件位置与合并规则\n\n- `CSV` 文件夹内使用传统的`\"变量名.csv\"`（仅顶层目录），`ERB` 文件夹内使用`\"变量名.ERD\"`（含子目录递归）。文件名匹配不区分大小写。\n- 同一个变量名同时存在 `.erd` 和 `.csv` 时**合并读取**：两个文件的标识符汇总进同一份\"标识符→下标\"字典，互补的名字都能用。\n- **只有定义了相同的标识符时才会在启动时出错并终止**（无论下标是否相同）。同一下标写不同标识符是合法的，两个名字指向同一个元素。\n\n    ; ERB/HOGE.ERD\n    0, りんご\n\n    ; CSV/HOGE.CSV\n    1, みかん\n    0, 林檎\n\n    HOGE:りんご   ; → 0（来自 ERD）\n    HOGE:みかん   ; → 1（来自 CSV）\n    HOGE:林檎     ; → 0（与 りんご 同一个元素）\n\n- 单个文件内同一下标写两行时，后一行覆盖前一行（仅警告），前一个名字失效。想给同一个下标起多个名字，要么像上面这样分两个文件写，要么使用同名 `.als` 别名文件（`HOGE.ERD` 配 `HOGE.als`，格式同样是`下标, 别名`，一个下标可挂多个别名；别名与已有标识符冲突时静默跳过，不报错）。\n\n### 与引擎内置变量的边界\n\n- ERD 只适用于在 ERH 中用 `#DIM` 定义的变量。`ITEM`、`CFLAG`、`ABL` 等引擎内置变量的名字只能在 `CSV` 文件夹内对应的 `ITEM.CSV`、`CFLAG.CSV` 等文件中定义，在 `ERB` 内放置同名的 `.ERD` 文件不会被读取。\n- 多维数组的每一维用独立文件命名（`HOGE2D@1.ERD`、`HOGE2D@2.ERD`），缺少某维文件时该维只能用数字下标。下标超出声明的元素数时该行被警告并跳过。"
  },
  {
    "id": "Emuera/variables#ARG",
    "pageId": "Emuera/variables",
    "sourcePath": "docs/Emuera/variables.zh.md",
    "localOnly": true,
    "title": "ARG",
    "names": [
      "ARG"
    ],
    "signatures": [],
    "summary": "ARG",
    "body": ""
  },
  {
    "id": "Emuera/variables#ARGS",
    "pageId": "Emuera/variables",
    "sourcePath": "docs/Emuera/variables.zh.md",
    "localOnly": true,
    "title": "ARGS",
    "names": [
      "ARGS"
    ],
    "signatures": [],
    "summary": "ARG为整数型，ARGS为字符串型。",
    "body": "局部变量。\n`ARG`为整数型，`ARGS`为字符串型。\n默认大小为`ARG`1000，`ARGS`100，可通过`VariableSize.csv`更改。\n另外，会自动确保足够的元素数，以供函数参数定义部分正常使用。（不会少于`VariableSize.csv`中指定的数值）\n\n\t@FUNC002, ARG:0, ARG:1, ARG,1100\n\t\tLOCAL = ARG:0 * ARG:1 / 100\n\t\tRETURN LOCAL\n\n这种情况下，`ARG`的元素数原本是`1000`，但在`@FUNC002`中`ARG`的元素数为0～1100共1101个。\n由于该变量设计用于函数参数传递，用于其他用途可能会降低可读性。\n\n### （用户定义的私有变量）\n\n在特定函数中定义`#DIM`或`#DIMS`定义的变量是私有变量，可按局部变量处理。\n详情请参考用户定义的变量。\n\n### 存档间共享的变量"
  },
  {
    "id": "Emuera/variables#CALLNAME",
    "pageId": "Emuera/variables",
    "sourcePath": "docs/Emuera/variables.zh.md",
    "localOnly": true,
    "title": "CALLNAME",
    "names": [
      "CALLNAME"
    ],
    "signatures": [],
    "summary": "在eramaker中不可赋值。",
    "body": "在eramaker中不可赋值。\n在Emuera中可以赋值。"
  },
  {
    "id": "Emuera/variables#CDFLAG",
    "pageId": "Emuera/variables",
    "sourcePath": "docs/Emuera/variables.zh.md",
    "localOnly": true,
    "title": "CDFLAG",
    "names": [
      "CDFLAG"
    ],
    "signatures": [],
    "summary": "数值型角色三维数组变量。",
    "body": "数值型角色三维数组变量。\n\n\tCDFLAG:MASTER:0:2\n\n等的第一参数为角色登记编号 (CharaID)，与传统角色变量相同，\n但需要第二和第三参数。\n\n### （用户定义的角色变量）\n\n在ERH中定义`#DIM CHARADATA`或`#DIMS CHARADATA`定义的变量成为角色变量，可像`CFLAG`等一样自由处理。\n详情请参考头文件（ERH）。\n\n### csv相关\n\n### csv变量\n\n用于引用在各csv中定义的值的变量。\n使用方法例如`TALENTNAME`和`talent.csv`的关系相同。\n全部为不可赋值、不保存的一维数组变量。\n如果csv中未定义，返回0或空字符串。\n\n|变量名     |文件   |类型      |元素数|\n|:----------|:----------|:-------|:-----|\n|ITEMPRICE  |item.csv   |整数型  |1000  |\n|TRAINNAME  |train.csv  |字符串型|1000  |\n|BASENAME   |base.csv   |字符串型|100   |\n|EQUIPNAME  |equip.csv  |字符串型|100   |\n|EQUIPNAME  |tequip.csv |字符串型|100   |\n|STAINNAME  |stain.csv  |字符串型|1000  |\n|EXNAME     |ex.csv     |字符串型|100   |\n|SOURCENAME |source.csv |字符串型|100   |\n|FLAGNAME   |flag.csv   |字符串型|10000 |\n|TFLAGNAME  |tflag.csv  |字符串型|1000  |\n|CFLAGNAME  |cflag.csv  |字符串型|1000  |\n|TCVARNAME  |tcvar.csv  |字符串型|100   |\n|STRNAME    |strname.csv|字符串型|20000 |\n|TSTRNAME   |tstr.csv   |字符串型|100   |\n|CSTRNAME   |cstr.csv   |字符串型|100   |\n|SAVESTRNAME|savestr.csv|字符串型|100   |\n|CDFLAGNAME1|cdflag1.csv|字符串型|1     |\n|CDFLAGNAME2|cdflag2.csv|字符串型|1     |\n|GLOBALNAME |global.csv |字符串型|100   |\n|GLOBALSNAME|globals.csv|字符串型|100   |\n\n请不要混淆`cstr.csv`等与`str.csv`的作用。\n`str.csv`是决定赋值给变量`STR`的值的文件，而`cstr.csv`是确定`CSTRNAME`的文件。\n确定`STRNAME`的文件是`strname.csv`。请注意`str.csv`和`strname.csv`的用法。\n\n### gamebase.csv变量\n\n用于引用在`gamebase.csv`中定义的值的变量。\n全部为非数组、不可赋值、不保存的变量。\n\n|变量名               |关键字              |类型    |\n|:--------------------|:-------------------|:-------|\n|GAMEBASE_AUTHOR      |作者                |字符串型|\n|GAMEBASE_INFO        |追加信息            |字符串型|\n|GAMEBASE_YEAR        |制作年              |字符串型|\n|GAMEBASE_TITLE       |标题                |字符串型|\n|GAMEBASE_GAMECODE    |代码                |整数型  |\n|GAMEBASE_VERSION     |版本                |整数型  |\n|GAMEBASE_ALLOWVERSION|版本差异承认        |整数型  |\n|GAMEBASE_DEFAULTCHARA|最初就在的角色      |整数型  |\n|GAMEBASE_NOITEM      |无道具              |整数型  |"
  },
  {
    "id": "Emuera/variables#CDOWN",
    "pageId": "Emuera/variables",
    "sourcePath": "docs/Emuera/variables.zh.md",
    "localOnly": true,
    "title": "CDOWN",
    "names": [
      "CDOWN"
    ],
    "signatures": [],
    "summary": "CDOWN",
    "body": ""
  },
  {
    "id": "Emuera/variables#CHARANUM",
    "pageId": "Emuera/variables",
    "sourcePath": "docs/Emuera/variables.zh.md",
    "localOnly": true,
    "title": "CHARANUM",
    "names": [
      "CHARANUM"
    ],
    "signatures": [],
    "summary": "在eramaker中可以赋值并保存·加载，但没有使用赋值的方法。",
    "body": "在eramaker中可以赋值并保存·加载，但没有使用赋值的方法。\n在Emuera中禁止赋值。\n\n### 临时规格表\n\n### eramaker中也存在的变量\n\n|变量名     |类型    |数组          |赋值|保存|禁止|初始值|初始化时机|备注|\n|:----------|:-----|:-------------|:---|:-----|:---|:-----|:---------------------|:---|\n|RESULT     |整数  |一维        |○  |○    |×  |-|-|-|\n|RESULTS    |字符串|一维        |○  |×    |×  |-|-|-|\n|A～Z       |整数  |一维        |○  |○    |○  |-|-|-|\n|COUNT      |整数  |一维        |○  |○    |○  |-|-|`COUNT:0`在`REPEAT`中作为计数器使用  禁用时`REPEAT`不可用|\n|DAY        |整数  |一维        |○  |○    |○  |-|-|-|\n|TIME       |整数  |一维        |○  |○    |○  |-|-|-|\n|MONEY      |整数  |一维        |○  |○    |○  |-|-|-|\n|MASTER     |整数  |一维        |○  |○    |○  |:0 = 0|-|主角角色的**登记编号 (CharaID)** `[VariableCode.MASTER]`，固定为0|\n|TARGET     |整数  |一维        |○  |○    |×  |:0 = 1|-|调教中角色的**登记编号 (CharaID)** `[VariableCode.TARGET]`，当前被调教对象|\n|ASSI       |整数  |一维        |○  |○    |○  |:0 = -1|-|助手角色的**登记编号 (CharaID)** `[VariableCode.ASSI]`，-1表示无助手|\n|PLAYER     |整数  |一维        |○  |○    |○  |:0 = 0|-|当前执行调教的角色的**登记编号 (CharaID)** `[VariableCode.PLAYER]`，等于MASTER或ASSI|\n|ASSIPLAY   |整数  |一维        |○  |○    |○  |:0 = 0|BEGIN TRAIN|-|\n|SELECTCOM  |整数  |一维        |○  |○    |×  |-|-|-|\n|PREVCOM    |整数  |一维        |○  |○    |○  |:0 = -1|BEGIN TRAIN|-|\n|NEXTCOM    |整数  |一维        |○  |○    |○  |:0 = -1|BEGIN TRAIN|-|\n|LOSEBASE   |整数  |一维        |○  |○    |○  |全部0|`@SHOW_USERCOM`结束时|可通过`BASENAME`指定元素|\n|UP         |整数  |一维        |○  |○    |○  |全部0|`@SHOW_USERCOM`结束时  `UPCHECK`时|可通过`PALAMNAME`指定元素|\n|DOWN       |整数  |一维        |○  |○    |○  |全部0|`@SHOW_USERCOM`结束时  `UPCHECK`时|可通过`PALAMNAME`指定元素|\n|PALAMLV    |整数  |一维        |○  |○    |×  |`_replace.csv`  `PALAMLV初始值`|-|-|\n|EXPLV      |整数  |一维        |○  |○    |×  |`_replace.csv`  `EXPLV初始值`|-|-|\n|EJAC       |整数  |一维        |○  |○    |○  |:0 = 10000|-|-|\n|FLAG       |整数  |一维        |○  |○    |○  |-|-|可通过`FLAGNAME`指定元素|\n|TFLAG      |整数  |一维        |○  |○    |○  |全部0|BEGIN TRAIN|可通过`TFLAGNAME`指定元素|\n|ITEM       |整数  |一维        |○  |○    |○  |-|-|可通过`ITEMNAME`指定元素|\n|ITEMSALES  |整数  |一维        |○  |○    |○  |-|-|可通过`ITEMNAME`指定元素|\n|BOUGHT     |整数  |一维        |○  |○    |○  |-|-|-|\n|PBAND      |整数  |一维        |○  |○    |○  |:0 = `_replace.csv``  `PBAND初始值`|-|-|\n|CHARANUM   |整数  |无维        |×  |×    |×  |-|-|无论指定哪个元素都返回角色注册数。|\n|RAND       |整数  |无维        |×  |×    |×  |-|-|`RAND:X`的`X`为`0`或负值时出错  其他情况下返回0～(元素数-1)的随机值。|\n|STR        |字符串|一维        |○  |×    |○  |`STR.CSV`|-|可通过`STRNAME`指定元素|\n|SAVESTR    |字符串|一维        |○  |○    |○  |-|-|可通过`SAVESTRNAME`指定元素|\n|NO         |数值  |角色＋无维|○  |○    |×  |-|-|角色注册编号 (NO) `[VariableCode.NO]`，在`CHARA**.CSV`中通过`编号,**`指定的**静态固定编号**，与动态分配的登记编号 (CharaID) 不同|\n|ISASSI     |数值  |角色＋无维|○  |○    |×  |-|-|在`CHARA**.CSV`中通过`助手,1`指定可从初始状态作为助手处理|\n|NAME       |字符串|角色＋无维|○  |○    |×  |-|-|在`CHARA**.CSV`中通过`姓名,**`指定|\n|CALLNAME   |字符串|角色＋无维|○  |○    |×  |-|-|在`CHARA**.CSV`中通过`称呼,**`指定|\n|BASE       |数值  |角色＋一维|○  |○    |○  |-|-|`ADDCHARA`时所有元素都变为与`MAXBASE`相同值  可通过`BASENAME`指定元素|\n|MAXBASE    |数值  |角色＋一维|○  |○    |○  ||-|在`CHARA**.CSV`中通过`基础,*,**`指定  可通过`BASENAME`指定元素|\n|ABL        |数值  |角色＋一维|○  |○    |○  |-|-|在`CHARA**.CSV`中通过`能力,*,**`指定  可通过`ABLNAME`指定元素|\n|TALENT     |数值  |角色＋一维|○  |○    |○  |-|-|在`CHARA**.CSV`中通过`素质,*`指定  可通过`素质,*,**`指定第三个值  可通过TALENTNAME指定元素|\n|EXP        |数值  |角色＋一维|○  |○    |○  |-|-|在`CHARA**.CSV`中通过`经验,*,**`指定  可通过`EXPNAME`指定元素|\n|MARK       |数值  |角色＋一维|○  |○    |○  |-|-|在`CHARA**.CSV`中通过`刻印,*,**`指定  可通过`MARKNAME`指定元素|\n|RELATION   |数值  |角色＋一维|○  |○    |○  |`replace.csv`  `RELATION初始值`|-|在`CHARA**.CSV`中通过`相性,*,**`指定  可通过`NAME`或`CALLNAME`指定元素|\n|JUEL       |数值  |角色＋一维|○  |○    |○  |-|-|在`CHARA**.CSV`中通过`珠,*,**`指定  可通过`PALAMNAME`指定元素|\n|CFLAG      |数值  |角色＋一维|○  |○    |○  |-|-|在`CHARA**.CSV`中通过`标志,*,**`指定  可通过`CFLAGNAME`指定元素|\n|EQUIP      |数值  |角色＋一维|○  |○    |○  |-|-|在`CHARA**.CSV`中通过`装备物,*,**`指定  可通过`EQUIPNAME`指定元素|\n|TEQUIP     |数值  |角色＋一维|○  |○    |○  |全部0|BEGIN TRAIN|可通过`TEQUIPNAME`指定元素|\n|PALAM      |数值  |角色＋一维|○  |○    |○  |全部0|BEGIN TRAIN|可通过`PALAMNAME`指定元素|\n|STAIN      |数值  |角色＋一维|○  |○    |×  |`_replace.csv`  `污渍初始值`|BEGIN TRAIN|可通过`STAINNAME`指定元素|\n|EX         |数值  |角色＋一维|○  |○    |○  |全部0|BEGIN TRAIN|可通过`EXNAME`指定元素|\n|SOURCE     |数值  |角色＋一维|○  |○    |○  |全部0|BEGIN TRAIN  `@SOURCE_CHECK`结束时|可通过`SOURCENAME`指定元素|\n|NOWEX      |数值  |角色＋一维|○  |○    |○  |全部0|`@EVENTCOM`前|`@USERCOM`前不更新  可通过`EXNAME`指定元素|\n|GOTJUEL    |数值  |角色＋一维|○  |○    |○  |全部0|BEGIN TRAIN|可通过`PALAMNAME`指定元素|\n|ABLNAME    |字符串|一维        |×  |×    |○  |`ABL.CSV`|-|-|\n|TALENTNAME |字符串|一维        |×  |×    |○  |`TALENT.CSV`|-|-|\n|EXPNAME    |字符串|一维        |×  |×    |○  |`EXP.CSV`|-|-|\n|MARKNAME   |字符串|一维        |×  |×    |○  |`MARK.CSV`|-|-|\n|PALAMNAME  |字符串|一维        |×  |×    |○  |`PALAM.CSV`|-|-|\n|ITEMNAME   |字符串|一维        |×  |×    |○  |`ITEM.CSV`|-|-|\n|NOITEM     |整数  |一维        |○  |○    |○  |:0 = gamebase.csv  \"无道具\"|-|可指定0和1以外的值|\n\n<!--下划线部分是eramaker和Emuera规格不同的部分-->\n\n### Emuera专用变量\n\n<!--校对累了，推迟-->\n|变量名|类型|数组|赋值|保存|禁止|初始值|初始化时机|备注|\n|:--|:--|:--|:--|:--|:--|:--|:--|:--|\n|LOCAL|整数|一维|○  |×  |○  |-|-|#LOCALSIZE根据函数改变元素数 **⚠过时，新游戏建议VariableSize.csv设为-1禁用**|\n|LOCALS|字符串|一维|○  |×  |○  |-|-|#LOCALSSIZE根据函数改变元素数 **⚠过时，新游戏建议VariableSize.csv设为-1禁用**|\n|ARG|整数|一维|○  |×  |○  |任意|函数被调用时※|※仅在作为参数设置时  每个函数确保参数定义的元素数|\n|ARGS|字符串|一维|○  |×  |○  |任意|函数被调用时※|※仅在作为参数设置时  每个函数确保参数定义的元素数|\n|(Private)|任意|任意|任意|×  |×  |任意|游戏开始  函数被调用时※|※仅在作为参数设置时  在函数中用#DIM或#DIMS定义|\n|(Refer)|任意|任意|※|※|×  |-|-|※依赖引用目标  在函数中的\"#DIM REF\"或\"#DIMS REF\"定义|\n|(Wide_area)|任意|任意|任意|任意|×  |任意|游戏开始|在ERH中用#DIM或#DIMS定义|\n|GLOBAL|整数|一维|○  |※|×  |-|-|※通过SAVEGLOBAL保存、LOADGLOBAL加载  可通过GLOBALNAME指定元素|\n|GLOBALS|字符串|一维|○  |※|×  |-|-|※通过SAVEGLOBAL保存、LOADGLOBAL加载  可通过GLOBALSNAME指定元素|\n|LINECOUNT|整数|无维|×  |×  |×  |-|-|-|\n|ISTIMEOUT|整数|无维|×|×|×|0|TINPUT系列指令执行时|TINPUT系列指令超时时赋值为1|\n|`__INT_MAX__`|整数|无维|×|×|×|9223372036854775807|-|-|\n|`__INT_MIN__`|整数|无维|×|×|×|-9223372036854775808|-|-|\n|RANDDATA|整数|一维|○|○|×|-|-|-|\n|TSTR|字符串|一维|○|×|○|全部空字符串|BEGIN TRAIN|可通过TSTRNAME指定元素|\n|DA|整数|二维|○|○|○|-|-|-|\n|DB|整数|二维|○|○|○|-|-|-|\n|DC|整数|二维|○|○|○|-|-|-|\n|DD|整数|二维|○|○|○|-|-|-|\n|DE|整数|二维|○|○|○|-|-|-|\n|DITEMTYPE|整数|二维|○|○|○|-|-|-|\n|TA|整数|三维|○|○|○|-|-|-|\n|TB|整数|三维|○|○|○|-|-|-|\n|NICKNAME|字符串|角色＋无维|○|○|×|-|-|在CHARA**.CSV中通过\"昵称,**\"指定|\n|MASTERNAME|字符串|角色＋无维|○|○|×|-|-|在CHARA**.CSV中通过\"主人的称呼,**\"指定|\n|DOWNBASE|整数|角色＋一维|○|○|○|全部0|@SHOW_USERCOM结束时|可通过BASENAME指定元素|\n|CUP|整数|角色＋一维|○|○|○|全部0|@SHOW_USERCOM结束时  UPCHECK时|可通过PALAMNAME指定元素|\n|CDOWN|整数|角色＋一维|○|○|○|全部0|@SHOW_USERCOM结束时  UPCHECK时|可通过PALAMNAME指定元素|\n|TCVAR|整数|角色＋一维|○|○|○|全部0|BEGIN TRAIN|可通过TCVARNAME指定元素|\n|CSTR|字符串|角色＋一维|○|○|○|-|-|在CHARA**.CSV中通过\"CSTR,*,**\"指定|  可通过CSTRNAME指定元素|\n|CDFLAG|整数|角色＋二维|○|○|○|-|-|可通过CFDLAGNAME1和CDFLAGNAME2指定元素  注意元素数的初始设置值为1･1|\n|ITEMPRICE|整数|一维|×|×|○|item.csv|-|可通过ITEMNAME指定元素|\n|TRAINNAME|字符串|一维|×|×|○|train.csv|-|-|\n|BASENAME|字符串|一维|×|×|○|base.csv|-|-|\n|EQUIPNAME|字符串|一维|×|×|○|equip.csv|-|-|\n|TEQUIPNAME|字符串|一维|×|×|○|tequip.csv|-|-|\n|STAINNAME|字符串|一维|×|×|○|stain.csv|-|-|\n|EXNAME|字符串|一维|×|×|○|ex.csv|-|-|\n|SOURCENAME|字符串|一维|×|×|○|source.csv|-|-|\n|FLAGNAME|字符串|一维|×|×|○|flag.csv|-|-|\n|TFLAGNAME|字符串|一维|×|×|○|tflag.csv|-|-|\n|CFLAGNAME|字符串|一维|×|×|○|cflag.csv|-|-|\n|TCVARNAME|字符串|一维|×|×|○|tcvar.csv|-|-|\n|STRNAME|字符串|一维|×|×|○|strname.csv|-|在str.csv中指定的是STR的内容，不是元素名|\n|TSTRNAME|字符串|一维|×|×|○|tstr.csv|-|-|\n|CSTRNAME|字符串|一维|×|×|○|cstr.csv|-|-|\n|SAVESTRNAME|字符串|一维|×|×|○|savestr.csv|-|-|\n|CDFLAGNAME1|字符串|一维|×|×|○|cdflag1.csv|-|-|\n|CDFLAGNAME2|字符串|一维|×|×|○|cdflag2.csv|-|-|\n|GLOBALNAME|字符串|一维|×|×|○|global.csv|-|-|\n|GLOBALSNAME|字符串|一维|×|×|○|globals.csv|-|-|\n|GAMEBASE_AUTHOR|字符串|无维|×|×|×|gamebase.csv  \"作者\"|-|-|\n|GAMEBASE_INFO|字符串|无维|×|×|×|gamebase.csv  \"追加信息\"|-|-|\n|GAMEBASE_YEAR|字符串|无维|×|×|×|gamebase.csv  \"制作年\"|-|-|\n|GAMEBASE_TITLE|字符串|无维|×|×|×|gamebase.csv  \"标题\"|-|-|\n|GAMEBASE_GAMECODE|整数|无维|×|×|×|gamebase.csv  \"代码\"|-|-|\n|GAMEBASE_VERSION|整数|无维|×|×|×|gamebase.csv  \"版本\"|-|-|\n|GAMEBASE_ALLOWVERSION|整数|无维|×|×|×|gamebase.csv  \"版本差异承认\"|-|-|\n|GAMEBASE_DEFAULTCHARA|整数|无维|×|×|×|gamebase.csv  \"最初就在的角色\"|-|-|\n|GAMEBASE_NOITEM|整数|无维|×|×|×|gamebase.csv  \"无道具\"|-|-|\n|WINDOW_TITLE|字符串|无维|○|×|×|gamebase.csv  \"窗口标题\"※|-|※没有时从\"标题\"和\"版本\"生成  没有\"标题\"时为\"Emuera\"|\n|MONEYLABEL|字符串|无维|×|×|×|_replace.csv  \"货币单位\"※|-|※没有时为\"$\"|\n|DRAWLINESTR|字符串|无维|×|×|×|_replace.csv  \"DRAWLINE字符\"※|-|※没有时为\"-\"的重复|\n|LASTLOAD_VERSION|整数|无维|×|×|×|-1|游戏开始  RESETDATA时|加载时值更新|\n|LASTLOAD_NO|整数|无维|×|×|×|-1|游戏开始  RESETDATA时|加载时值更新|\n|LASTLOAD_TEXT|字符串|无维|×|×|×|空字符串|游戏开始  RESETDATA时|加载时值更新|\n|SAVEDATA_TEXT|字符串|无维|○|※|×|※※|@SAVEINFO开始时|※作为存档数据标题保存  ※※表示当前时间的字符串|"
  },
  {
    "id": "Emuera/variables#CSTR",
    "pageId": "Emuera/variables",
    "sourcePath": "docs/Emuera/variables.zh.md",
    "localOnly": true,
    "title": "CSTR",
    "names": [
      "CSTR"
    ],
    "signatures": [],
    "summary": "可保存的字符串数组变量。",
    "body": "可保存的字符串数组变量。\n`CFLAG`的字符串版本。\n在`chara*.csv`中指定为`CSTR`。"
  },
  {
    "id": "Emuera/variables#CUP",
    "pageId": "Emuera/variables",
    "sourcePath": "docs/Emuera/variables.zh.md",
    "localOnly": true,
    "title": "CUP",
    "names": [
      "CUP"
    ],
    "signatures": [],
    "summary": "CUP",
    "body": ""
  },
  {
    "id": "Emuera/variables#DITEMTYPE",
    "pageId": "Emuera/variables",
    "sourcePath": "docs/Emuera/variables.zh.md",
    "localOnly": true,
    "title": "DITEMTYPE",
    "names": [
      "DITEMTYPE"
    ],
    "signatures": [],
    "summary": "※此变量已废弃。请考虑使用#DIM、#DIMS并根据用途命名。",
    "body": "### DA ～ DE\n\n**※此变量已废弃。请考虑使用#DIM、#DIMS并根据用途命名。**\n**详情请参考用户定义的变量。**\n\n固定长度的整数型二维数组。\n像`DITEMTYPE:1:2`这样调用。参数不能省略。\neramaker的二维数组第一参数指定角色登记编号 (CharaID)，因此数组大小因`CHARANUM`而异。\n`DITEMTYPE`等二维数组保持`VariableSize.csv`中指定的大小不变。\n作为`VARSIZE`指令的目标时，元素数分别赋值给`RESULT:0`和`RESULT:1`。\n如果在`VariableSize.csv`中设置`DITEMTYPE,100,200`，则可使用`DITEMTYPE:99:199`，`VARSIZE`指令中`RESULT:0`和`RESULT:1`会被赋值为`100`和`200`。\n\n### TA, TB\n\n**※此变量已废弃。请考虑使用#DIM、#DIMS并根据用途命名。**\n**详情请参考用户定义的变量。**\n\n固定长度的整数型三维数组。\n像`TA:1:2:3`这样调用。参数不能省略。\n大小标准为`100×100×100`。即可以使用`TA:99:99:99`。\n可在`VariableSize.csv`中更改大小，但不能指定总计超过100万的大小。\n作为`VARSIZE`指令的目标时，各元素数分别赋值给`RESULT:0`、`RESULT:1`和`RESULT:2`。\n\n### （用户定义的多维数组变量）\n\n从ver1.808开始，可以通过定义#DIM或#DIMS定义的变量成为多维数组。\n详情请参考用户定义的变量。\n\n### 调试变量\n\n调试变量是提供调试信息的变量。\n调试变量只在以调试模式启动时返回有意义的值。\n在通常模式启动时返回`空字符串`或`0`。\n\n全部名字前后都有两个下划线`_`。\n\n### __FILE__\n\n一维只读变量。\n返回当前执行脚本的文件名。\n文件名与错误信息等相同，包含文件夹结构和扩展名。\n\n在系统输入等待期间从调试命令或变量监视引用时等，\n当前没有执行脚本时返回空字符串。\n\n### __LINE__\n\n一维只读变量。\n返回当前执行脚本的行号。\n行号与错误信息等相同，从1开始的数字。\n\n当前没有执行脚本时返回-1。\n\n### __FUNCTION__\n\n一维只读变量。\n返回当前执行的函数名。\n函数名不包含`@`和参数列表。\n\n当前没有执行脚本时返回空字符串。\n\n### 其他"
  },
  {
    "id": "Emuera/variables#DOWNBASE",
    "pageId": "Emuera/variables",
    "sourcePath": "docs/Emuera/variables.zh.md",
    "localOnly": true,
    "title": "DOWNBASE",
    "names": [
      "DOWNBASE"
    ],
    "signatures": [],
    "summary": "DOWNBASE",
    "body": ""
  }
];
