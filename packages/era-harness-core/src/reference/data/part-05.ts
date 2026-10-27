// 本文件由 scripts/build-reference.ts 生成，请勿手工修改。
//
// 数据来源：https://github.com/qirchen421/emuera.sk.doc  docs/Reference、docs/Emuera、docs/tutorial/*.zh.md
// 上游版本：41451be6091363e37ed066aaf04416decbf0127f
// 许可：CC BY-NC 4.0（http://creativecommons.org/licenses/by-nc/4.0/）
//       与本仓库代码的 Apache-2.0 分开管理，见 NOTICE-emuera-sk-doc.md
import type { ReferenceEntry } from '../types.js';

export const ENTRIES_PART_05: readonly ReferenceEntry[] = [
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tFORCEWAIT\n    ```\n\t这是一个无法通过右键点击或宏跳过功能跳过的 `WAIT` 指令。\n\t当执行到此指令时，这些跳过状态将被解除。\n\n!!! hint \"提示\"\n\n    仅支持指令形式。\n\n### 相关项目\n- WAIT",
    "sourcePath": "docs/Reference/FORCEWAIT.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tCALLFORM functionName(, argument...)\n\tJUMPFORM functionName(, argument...)\n\tGOTOFORM labelName\n    ```\n\t与 `CALL`、`JUMP`、`GOTO` 相同，但可以像 `PRINTFORM` 一样指定函数名。\n\n    ```erb\n\tCALLFORM KOJO_{NO:TARGET}_{SELECTCOM}\n\t```\n\n    可以像这样使用。`JUMPFORM`和`CALLFORM`可以指定参数，详情请参见[函数的`自定义函数中的参数指定`](../Emuera//function.md#_2)一节。\n    另外，关于使用`GOTOFORM`直接进入循环/分支结构内部的情况，请参阅`TRYGOTO`、[`循环/分支结构`](../Reference/README.zh.md#flow-control)以及`TRYC`系列等章节。\n\n!!! hint \"提示\"\n\n    仅支持命令形式。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\t#DIMS HOGE\n\t\tHOGES = AAA\n\t\tCALLFORM %HOGES%\n\t\tJUMPFORM %\"C\"*3%\n\n\t@AAA\n\t\tPRINTL AAA\n\n\t@CCC\n\t\tPRINTL CCC\n\t\tWAIT\n    ```\n    ```text\n\tAAA\n\tCCC\n    ```\n\n### 相关项目\n- CALL\n- JUMP\n- GOTO\n- TRYC系命令\n- [动态解析与反射](../tutorial/dynamic-reflection.zh.md) — CALLFORM 属于第二代\"函数名反射\"",
    "sourcePath": "docs/Reference/FORM.zh.md"
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
    "body": "!!! info \"API\"\n\n\t```erb\n\tint G_POLYGON_DRAW gID\n\tint G_POLYGON_FILL gID\n\tint G_POLYGON_POINT_ADD gID, x, y\n\tint G_POLYGON_POINT_CLEAR gID\n\t```\n\n\t`G_POLYGON_POINT_ADD`向指定`gID`的图形添加顶点。\n\t`G_POLYGON_DRAW`用当前画笔将添加的顶点绘制为多边形。\n\t`G_POLYGON_FILL`用当前画刷将添加的顶点填充为多边形。\n\t`G_POLYGON_POINT_CLEAR`清除所有已添加的顶点。\n\n\t这些函数仅在 SkiaSharp 绘图模式下可用。GDI 模式下会报错。\n\n!!! hint \"提示\"\n\n    支持命令和表达式函数两种形式。\n\n!!! example \"示例\"\n\n\t```erb\n\t@SYSTEM_TITLE\n\t\t; 创建 400x300 的画布\n\t\tGCREATE 0, 400, 300\n\t\tGCLEAR 0, 0xFFFFFF\n\n\t\t; 设置红色画笔和蓝色画刷\n\t\tGSETPEN 0, 0xFF0000, 3\n\t\tGSETBRUSH 0, 0x0000FF\n\n\t\t; 添加三角形顶点\n\t\tG_POLYGON_POINT_ADD 0, 50, 50\n\t\tG_POLYGON_POINT_ADD 0, 350, 50\n\t\tG_POLYGON_POINT_ADD 0, 200, 250\n\n\t\t; 先填充再描边\n\t\tG_POLYGON_FILL 0\n\t\tG_POLYGON_DRAW 0\n\n\t\t; 显示\n\t\tCBGSETG 0, 0, 0, 0\n\t\tWAIT\n\t```\n\n### 相关项目\n- GCREATE\n- GSETPEN\n- GSETBRUSH\n- GFILLRECTANGLE",
    "sourcePath": "docs/Reference/G_POLYGON.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tint GCLEAR gID, cARGB\n    ```\n\t将指定`gID`的`Graphics`对象的整个区域替换为指定颜色。\n\t处理成功时返回非0值。\n\t若`gID`或颜色指定不恰当，将发生错误。\n\n!!! hint \"提示\"\n\n    同时支持指令形式和表达式函数形式。\n\n### 相关项目\n- GSETCOLOR",
    "sourcePath": "docs/Reference/GCLEAR.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tint GCREATE gID, width, height\n    ```\n    以指定尺寸创建指定 `gID` 的 `Graphics`。\n    `Graphics` 的 `gID` 必须是 0 或以上的整数，`width` 和 `height` 必须是 1 到 8192 之间的整数。\n    如果参数超出此范围，将发生错误。\n    创建成功时，返回非 0 值。\n    如果指定 `gID` 的 `Graphics` 已存在，则返回 0。\n    若要重新创建 `Graphics`，请使用 `GDISPOSE` 命令销毁现有的 `Graphics`。\n\n!!! hint \"提示\"\n\n    同时支持指令和表达式函数形式。\n\n### 相关项目\n- GCREATEFROMFILE\n- GDISPOSE",
    "sourcePath": "docs/Reference/GCREATE.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tint GCREATED gID\n    ```\n\t如果指定`gID`的`Graphics`已创建则返回1，未创建（包括已销毁）则返回0。\n\n!!! hint \"提示\"\n\n    同时支持指令和表达式函数两种用法。\n\n### 相关项目\n- GCREATE",
    "sourcePath": "docs/Reference/GCREATED.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    int GCREATEFROMFILE gID, filePath{, isRelative}\n    ```\n\n    使用相对于 `resources` 文件夹的路径指定图像文件，打开该图像并创建 `Graphics`。\n    与在 `resources` 文件夹内的 csv 文件中声明资源不同，图像文件不会被锁定。（在 EM+EE 中，通过 CSV 指定的图像也不会被锁定）\n    如果创建成功，则返回非 0 值。\n    如果指定 `gID` 的 `Graphics` 已经存在，则 `Graphics` 创建失败，此命令不执行任何操作并返回 0 结束。\n    如果因文件不存在、无法识别为图像、文件过大等原因失败，也返回 0。\n\n    **Skia（SkiaSharp版）扩展参数**：\n\n    - `isRelative`（可选，默认 `0`）：设为 `1` 时，`filePath` 将从当前工作目录而非程序目录解析相对路径。如果指定了绝对路径，此参数将被忽略。\n\n!!! hint \"提示\"\n\n    此功能同时支持作为命令和表达式函数使用。\n\n### 相关项目\n- GCREATE",
    "sourcePath": "docs/Reference/GCREATEFROMFILE.zh.md"
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
    "body": "!!! info \"API\"\n\n\t```erb\n\tint GDRAWline gID, DashStyle, DashCap\n\t```\n\n    指定GDRAWLINE的线条样式。DashStyle和DashCap分别可以使用C#的DashStyle、DashCap枚举的数值来指定。\n    DashStyle 0=普通线条 1=由短划线构成的线条 2=由点构成的线条 3=由短划线和点构成的线条 4=由短划线和两个点构成的线条\n    DashCap(线条端点的形状) 0=普通形状(直角) 2=圆形 3=三角形 1是缺号。有意见请向Microsoft反映。\n\n!!! hint \"提示\"\n\n\t该功能同时支持命令和表达式函数两种形式。\n\n!!! example \"示例\"\n\n\t```erb\n\t@SYSTEM_TITLE\n\t\t#DIM DYNAMIC LCOUNT\n\t\tFOR LCOUNT, 0, 5\n\t\t\tGCREATE LCOUNT, 100, 100\n\n\t\t\tGSETPEN LCOUNT, 0xFFFF0000, 5\n\n\t\t\tGDASHSTYLE LCOUNT, 1, 3\n\t\t\tGSETPEN LCOUNT, 0xFFFF0000, 4\n\n\t\t\tGCLEAR LCOUNT, 0xFFFFFFFF\n\n\t\t\tGDRAWLINE LCOUNT, 0, 0, 100, (LCOUNT+1)*20\n\n\t\t\tSPRITECREATE @\"LINE{LCOUNT}\", LCOUNT\n\t\t\tHTML_PRINT @\"<img src='LINE{LCOUNT}' srcb='' height='500'>\"\n\t\t\tREPEAT 4\n\t\t\t\tPRINTL\n\t\t\tREND\n\t\tNEXT\n\t\tWAIT\n\t```\n\n\t![](../assets/images/GDASHSTYLE.png)\n\n### 相关项目\n- GDRAWLINE",
    "sourcePath": "docs/Reference/GDASHSTYLE.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tint GDISPOSE gID\n    ```\n\t销毁指定`gID`的`Graphics`对象。\n\t销毁成功时返回非0值。\n\t当指定`gID`的`Graphics`对象尚未创建（包括已销毁的情况）时，返回0。\n\n!!! hint \"提示\"\n\n    该函数同时支持指令和表达式函数两种使用方式。",
    "sourcePath": "docs/Reference/GDISPOSE.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tint GDRAWG destID, srcID, destX, destY, destWidth, destHeight, srcX, srcY, srcWidth, srcHeight\n\tint GDRAWG destID, srcID, destX, destY, destWidth, destHeight, srcX, srcY, srcWidth, srcHeight, colorMatrix\n    ```\n    将指定的 `srcID` 对应的 `Graphics` 绘制到指定的 `destID` 对应的 `Graphics` 上。\n    通过四个整数指定目标 `dest` `Graphics` 的位置和大小，通过另外四个整数指定源 `src` `Graphics` 的位置和大小。\n    可选地，可以通过指定一个 5x5 或更大的二维数值数组作为 `colorMatrix` 来应用颜色矩阵进行绘制。\n    `colorMatrix` 的所有元素会除以 256 后传递给 .Net Framework 的 `ColorMatrix` 类。也就是说，对角线元素全为 256 的 5x5 矩阵是单位矩阵。\n    处理成功时，返回非 0 值。\n    当目标 `Graphics` 或源 `Graphics` 中任意一个未创建等情况下，返回 0。\n    目标 `Graphics` 和源 `Graphics` 可以是同一个。\n\n!!! hint \"提示\"\n\n    命令和表达式函数均支持。\n\n### 相关项目\n- GDRAWSPRITE",
    "sourcePath": "docs/Reference/GDRAWG.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tGDRAWGWITHMASK destID, srcID, maskID, destX, destY\n    ```\n\t在指定的 `destID` 的 `Graphics` 上，使用 `maskID` 的 `Graphics` 作为蒙版，绘制 `srcID` 的 `Graphics`。\n\t通过 `destX, destY` 指定在输出目标 `destID` 的 `Graphics` 内的绘制位置。\n\t处理成功时，返回非 0 值。\n\t成功的条件是：`srcID` 与 `maskID` 的宽度和高度必须完全一致，且绘制区域不能超出 `destID` 的范围。\n\t所谓“应用蒙版绘制”，具体是指将蒙版图像的蓝色通道值作为不透明度应用到源图像上进行绘制。\n\t例如，如果蒙版图像完全是纯白色（即所有位置的蓝色通道值均为最大值），则源图像将像没有蒙版一样被原样绘制。\n\t如果蒙版图像完全是纯黑色（即所有位置的蓝色通道值均为 0），则源图像将被视为完全透明，不会发生任何绘制。\n\t此命令的处理由 CPU 单线程完成，而非 GPU。请不要对其速度抱有期待。\n\n!!! hint \"提示\"\n\n    命令和表达式函数均支持。",
    "sourcePath": "docs/Reference/GDRAWGWITHMASK.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    int GDRAWGWITHROTATE gID, destID, Angle(, x, y)\n    ```\n\n    将 `destID` 指定的图像顺时针旋转 `Angle` 的角度，并把旋转后的图像粘贴到 `gID` 指定的图像。\n    参数 `x` / `y` 可以指定旋转的中心点。省略则默认使用 `(x/2, y/2)`（图像整体的中心点）。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n    #DIMS HTML\n\n        GCREATE 0, 400, 400\n        GCREATE 1, 400, 400\n        GCREATE 2, 400, 400\n\n        GSETFONT 0, \"Arial\", 100\n        GDRAWTEXT 0, \"Emuera\", 30, 150\n\n        GDRAWGWITHROTATE 1, 0, 90\n        GDRAWGWITHROTATE 2, 0, 180\n\n        REPEAT 3\n            SPRITECREATE @\"TEST{COUNT}\", COUNT\n            HTML += @\"<img src='TEST{COUNT}' height = '400' width = '400'>\"\n        REND\n        HTML_PRINT HTML\n        PRINTL\n        PRINTL\n        PRINTL\n        WAIT\n    ```\n\n    ![](../assets/images/GDRAWGWITHROTATE.png)",
    "sourcePath": "docs/Reference/GDRAWGWITHROTATE.zh.md"
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
    "body": "!!! info \"API\"\n\n\t```erb\n\tint GDRAWline gID, fromX, fromY, forX, forY\n\t```\n\n    在`gID`指定的`Graphics`上，从`fromX`,`fromY`坐标到`forX`,`forY`坐标绘制一条直线。\n    线条的颜色和粗细使用`GSETPEN`指定的设置。\n\n!!! hint \"提示\"\n\n    该功能同时支持命令形式和函数形式。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n    #DIM DYNAMIC LCOUNT\n\n\t\tFOR LCOUNT, 0, 5\n\t\t\tGCREATE LCOUNT, 100, 100\n\t\t\tGCLEAR LCOUNT, 0xFFFFFFFF\n\t\t\tGSETPEN LCOUNT, 0xFFFF0000, 5\n\t\t\tGDRAWLINE LCOUNT, 0, 0, 100, (LCOUNT+1)*20\n\t\t\tSPRITECREATE @\"LINE{LCOUNT}\", LCOUNT\n\t\t\tHTML_PRINT @\"<img src='LINE{LCOUNT}' srcb='' height='500'>\"\n\t\t\tREPEAT 4\n\t\t\t\tPRINTL\n\t\t\tREND\n\t\tNEXT\n\t\tWAIT\n\t```\n\n\t![](../assets/images/GDRAWLINE.png)\n\n### 相关项目\n- GSETPEN\n- GDASHSTYLE",
    "sourcePath": "docs/Reference/GDRAWLINE.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tint GDRAWSPRITE gID, spriteName\n\tint GDRAWSPRITE gID, spriteName, destX, destY\n\tint GDRAWSPRITE gID, spriteName, destX, destY, destWidth, destHeight\n\tint GDRAWSPRITE gID, spriteName, destX, destY, destWidth, destHeight, colorMatrix\n    ```\n\t在指定`gID`的`Graphics`上，绘制指定`spriteName`的`Sprite`。\n\t可选地，通过`destX,destY`指定`Graphics`内部的位置，将`Sprite`绘制在该位置。\n\t此外，通过`destWidth,destHeight`指定绘制宽度和高度，可以将`Sprite`放大或缩小到该尺寸进行绘制。\n\t更进一步，在`colorMatrix`中指定一个5x5矩阵，可以应用颜色矩阵进行绘制。\n\t注意，`Sprite`的尺寸可以通过`SPRITEWIDTH(str imgName), SPRITEHEIGHT(str imgName)`函数获取。\n\t处理成功时，返回非0值。\n\n    当指定动画精灵时，将绘制运行时的一个帧。\n\n!!! hint \"提示\"\n\n    同时支持指令和表达式函数。\n\n### 相关项目\n- GDRAWG",
    "sourcePath": "docs/Reference/GDRAWSPRITE.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    int GDRAWTEXT gID, text(, x, y)\n    ```\n\n    在 `gID` 指定的 `Graphics` 中绘制 `text`。字体、描边等使用 `GSETFONT` / `GSETPEN` 指定的样式。\n    省略参数 `x` / `y` 时，默认在 `(0, 0)` 的位置绘制。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n    #DIM DYNAMIC LCOUNT\n\n    \tFOR LCOUNT, 1, 6\n    \t\tGCREATE LCOUNT, 2000, 300\n    \t\tGSETFONT LCOUNT, \"Arial\", LCOUNT*50, 0\n    \t\tGSETPEN LCOUNT, 0xFFFF0000, 5\n    \t\tGDRAWTEXT LCOUNT, \"ABC\"\n    \t\tSPRITECREATE @\"TEST{LCOUNT}\", LCOUNT\n    \t\tHTML_PRINT @\"<img src='TEST{LCOUNT}' srcb='' height='300'>\"\n    \t\tREPEAT 2\n    \t\t\tPRINTL\n    \t\tREND\n    \tNEXT\n    ```\n\n    ![](../assets/images/GDRAWTEXT.png)\n\n### 相关项目\n- GSETFONT\n- GSETPEN\n- GGETTEXTSIZE",
    "sourcePath": "docs/Reference/GDRAWTEXT.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tint GETCHARA charaNO\n    ```\n\t判断指定角色是否在当前持有的角色列表中，如果在则返回其在列表中的位置，否则返回`-1`。\n\t可用于从整个列表中确认特定角色是否存在。\n\n!!! hint \"提示\"\n\n    该函数同时支持作为指令和表达式函数使用。\n\n### 相关项目\n- FINDCHARA — 按变量值查找角色\n- [动态解析与反射](../tutorial/dynamic-reflection.zh.md) — GETCHARA 属于第一代\"固定映射\"",
    "sourcePath": "docs/Reference/GETCHARA.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tint GETCOLOR\n\tint GETBGCOLOR\n\tint GETDEFCOLOR\n\tint GETDEFBGCOLOR\n\tint GETFOCUSCOLOR\n    ```\n\t分别将颜色代码赋值给 `RESULT:0` 或返回。\n\t`GETCOLOR` 返回当前使用的文字颜色，`GETDEFCOLOR` 返回[配置中指定的文字颜色](../Emuera/config.md#_28)，`GETBGCOLOR` 返回当前使用的背景颜色，\n\t`GETDEFBGCOLOR` 返回[默认使用的背景颜色](../Emuera/config.md#_27)，`GETFOCUSCOLOR` 返回[按钮选中时的文字颜色](../Emuera/config.md#_29)。\n\t返回值为十六进制的 `0xRRGGBB`。\n\t例如，橙色 (R,G,B) = (`255, 128, 0`) 则返回 `0xFF8000`（十进制为 `16744448`）。\n\t关于颜色与数字的对应关系，可以参考讲解 web color 的网站。\n\t自 1.731 版本变更后，`SETCOLOR` 命令也可以使用 `SETCOLOR 0xFF8000` 这样的形式来指定了。\n\n!!! hint \"提示\"\n\n    该函数在指令和表达式中均可使用。\n\n### 相关项目\n- SETCOLOR\n- SETBGCOLOR\n- GETCONFIG",
    "sourcePath": "docs/Reference/GETCOLOR.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tint GETCONFIG configWord\n\tstring GETCONFIGS configWord\n    ```\n    获取配置项及 [`replace.csv`](../Emuera/replace.zh.md) 设置项的整数值或字符串值。\n    可获取的项目请参阅[配置](../Emuera/config.zh.md)页面。\n\n!!! hint \"提示\"\n\n    该函数既可作为指令使用，也可在表达式中使用。\n\n### 相关项目\n- GETCOLOR\n- PRINTCPERLINE",
    "sourcePath": "docs/Reference/GETCONFIG.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    GETCSVNOBYNAME name\n    GETCSVNOBYNICKNAME nickname\n    GETCSVNOBYCALLNAME callname\n    GETCSVNOBYMASTERNAME mastername\n    ```\n    通过角色的名字反查角色注册编号 (NO)。是 CSVNAME系 的逆操作：CSVNAME 从编号查名字，GETCSVNOBY 从名字查编号。\n\n    - `GETCSVNOBYNAME`：通过 `NAME`（角色名）反查\n    - `GETCSVNOBYNICKNAME`：通过 `NICKNAME`（昵称）反查\n    - `GETCSVNOBYCALLNAME`：通过 `CALLNAME`（称呼）反查\n    - `GETCSVNOBYMASTERNAME`：通过 `MASTERNAME`（主人名）反查\n\n    返回值：找到则返回角色注册编号 (NO)（≥0），未找到返回 -1。\n\n    当存在多个同名角色时，返回最后加载的注册编号。\n\n    !!! warning \"与 FINDCHARA 的区别\"\n        `GETCSVNOBY*` 查询的是 CSV 模板数据，角色无需已被 `ADDCHARA` 添加即可查找。\n        FINDCHARA 查询的是运行时已添加的角色，返回的是登记编号 (CharaID) 而非注册编号 (NO)。\n\n!!! hint \"提示\"\n\n    支持命令语法（`GETCSVNOBYNAME \"絵夢 江良\"`）与表达式语法（`LOCAL = GETCSVNOBYNAME(\"絵夢 江良\")`）两种形式。作为命令调用时结果写入 `RESULT`。查找为 O(1) 复杂度。\n\n!!! example \"示例\"\n    ``` { title Chara0.csv }\n    番号,0\n    名前,絵夢 江良\n    呼び名,江良\n    ```\n\n    ```erb\n    @SYSTEM_TITLE\n        LOCAL = GETCSVNOBYNAME(\"絵夢 江良\")\n        PRINTFORMW 番号={LOCAL} 呼び名番号={GETCSVNOBYCALLNAME(\"江良\")}\n    ```\n    ```text\n    番号=0 呼び名番号=0\n    ```\n\n### 相关项目\n- CSVNAME系 — 从编号查名字（逆操作）\n- FINDCHARA — 从已添加角色中查找\n- [动态解析与反射](../tutorial/dynamic-reflection.zh.md) — GETCSVNOBY* 属于 DotNet 扩展\"角色名→编号反查\"",
    "sourcePath": "docs/Reference/GETCSVNOBY.zh.md"
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
    "body": "!!! info \"API\"\n\n\t```erb\n\tstring GETDISPLAYLINE lineNumber\n\t```\n\n\t从已显示的行中，返回指定行的字符串\n\n\t!!! warning \"Skia 扩展\"\n\n\t\t负数参数表示从底部倒数索引：`-1` = 最后一行，`-2` = 倒数第二行，以此类推。超出范围时返回空字符串。\n\n!!! hint \"提示\"\n\n    该函数既可作为命令使用，也可在表达式中作为函数使用。\n    显示行以数组形式管理，因此索引从0开始。使用`LINECOUNT`变量进行循环即可获取所有行。\n    注意：`LINECOUNT`是逻辑行数，`GETDISPLAYLINE`是显示行索引，两者可能不对齐。使用负数索引可直接从底部计数，避免不对齐问题。\n\n!!! example \"示例\"\n\n\t```erb\n\t@SYSTEM_TITLE\n\t\tPRINTL AAA\n\t\tPRINTL BBB\n\t\tPRINTL CCC\n\n\t\tREPEAT LINECOUNT\n\t\t\tPRINTFORML {COUNT}行目:%GETDISPLAYLINE(COUNT)%\n\t\tREND\n\t\tWAIT\n\t```\n\t```text\n\tNow Loading...\n\tAAA\n\tBBB\n\tCCC\n\t0行目:Now Loading...\n\t1行目:AAA\n\t2行目:BBB\n\t3行目:CCC\n\t```\n\n### 相关项目\n- HTML_POPPRINTINGSTR",
    "sourcePath": "docs/Reference/GETDISPLAYLINE.zh.md"
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
    "body": "!!! info \"API\"\n\n\t```erb\n\tstring GETDOINGFUNCTION\n\t```\n\n\t返回当前正在执行的函数的标签名。若在系统待机中（如标题画面）调用，则返回空字符串。\n\n!!! example \"示例\"\n\n\t```erb\n\t@EVENTSHOP\n\t\tPRINTFORML 当前函数: %GETDOINGFUNCTION%\n\t```\n\t```text\n\t当前函数: EVENTSHOP\n\t```",
    "sourcePath": "docs/Reference/GETDOINGFUNCTION.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tGETKEY keyCode\n\tGETKEYTRIGGERED keyCode\n    ```\n\t`GETKEY` 返回键盘及鼠标按键的状态。\n\t如果参数指定的按键被按下则返回 1，否则返回 0。\n\n\t`GETKEYTRIGGERED` 与 `GETKEY` 类似，返回键盘及鼠标按键的状态。\n\t`GETKEY` 获取的是当前是否被按下，而 `GETKEYTRIGGERED` 仅在按键被按下的瞬间返回 1。\n\t也就是说，持续按住按键时，`GETKEY` 会返回 1，但 `GETKEYTRIGGERD` 仅在最初返回 1，之后返回 0。\n\n    这些函数仅在Emuera窗口处于活动状态时返回1，如果窗口非活动状态，则无论按键状态如何都返回0。\n    关于键码数值与实际按键的对应关系，请参考微软公司MSDN中[`GetKeyState()`](https://learn.microsoft.com/ja-jp/windows/win32/api/winuser/nf-winuser-getkeystate)的说明。\n\n!!! hint \"提示\"\n\n    该函数同时支持指令和表达式函数两种使用方式。\n\n### 相关项目\n- AWAIT",
    "sourcePath": "docs/Reference/GETKEY.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n\tstring GETLINESTR pattern\n    ```\n    将参数字符串传递给 `CUSTOMDRAWLINE`、`DRAWLINEFORM` 时，返回将显示的字符串。\n    不保证此命令及表达式中函数返回的字符串长度与 `1行に表示できる文字列長`（一行可显示的字符串长度）相对应。\n\n!!! hint \"提示\"\n\n    同时支持命令和表达式中函数。\n\n### 相关项目\n- DRAWLINE\n- CUSTOMDRAWLINE",
    "sourcePath": "docs/Reference/GETLINESTR.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    int GETLINEY(lineNo)\n    ```\n\n    返回指定行号的物理 Y 坐标（左下原点），与 `SETIMAGELAYER` 的坐标系一致。\n\n    **参数**：\n\n    | 参数 | 类型 | 说明 |\n    | :--- | :--- | :--- |\n    | `lineNo` | int | 行号（≥0） |\n\n    **返回值**：指定行的物理 Y 坐标（像素）。左下原点坐标系，与 `SETIMAGELAYER` 的 `y` 参数使用相同坐标系。\n\n!!! warning \"注意\"\n\n    Skia 版专有表达式函数。传入负数参数将抛出 `CodeEE`。\n\n!!! hint \"提示\"\n\n    用于将 `SETIMAGELAYER` 的图像与 HTML 文本流对齐。通过 `GETLINEY(LINECOUNT)` 获取当前行的 Y 坐标，传递给 `SETIMAGELAYER` 的 `y` 参数，即可将图像图层精确放置在文本所在行。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n        ; 获取当前行号\n        #DIM L_LINE\n        L_LINE = LINECOUNT\n\n        ; 输出文本\n        PRINTL 你好\n\n        ; 在同一行放置图像图层\n        #DIM L_Y\n        L_Y = GETLINEY(L_LINE)\n        SETIMAGELAYER \"icon\", 1, 100, L_Y, 50, 50\n    ```\n\n### 相关项\n- SETIMAGELAYER\n- EXISTSIMAGELAYER\n- CLEARIMAGELAYER",
    "sourcePath": "docs/Reference/GETLINEY.zh.md"
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
    "body": "!!! info \"API\"\n\n    ```erb\n    int GETMEMORYUSAGE\n    ```\n\n    返回当前运行中的 Emuera 占用的内存使用量（单位为 byte）。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        PRINTFORMW 当前的内存使用量为 {GETMEMORYUSAGE()/1024/1024} MB\n        REPEAT 10000\n            ADDVOIDCHARA\n        REND\n        PRINTFORMW 运行 10000 次 ADDVOIDCHARA 之后的内存使用量为 {GETMEMORYUSAGE()/1024/1024} MB\n    ```\n\n    ```text\n    当前的内存使用量为 65 MB\n    运行 10000 次 ADDVOIDCHARA 之后的内存使用量为 913 MB\n    ```\n\n### 相关项目\n- CLEARMEMORY",
    "sourcePath": "docs/Reference/GETMEMORYUSAGE.zh.md"
  },
  {
    "id": "GETMETH",
    "title": "GETMETH,GETMETHS,GETMETHF",
    "names": [
      "GETMETH",
      "GETMETHS",
      "GETMETHF"
    ],
    "signatures": [
      {
        "name": "GETMETH",
        "params": "`string`(, `int`, `argument`...)",
        "returns": "`int`",
        "engines": [
          "etc"
        ],
        "overloads": []
      },
      {
        "name": "GETMETHS",
        "params": "`string`(, `string`, `argument`...)",
        "returns": "`string`",
        "engines": [
          "etc"
        ],
        "overloads": []
      },
      {
        "name": "GETMETHF",
        "params": "`string`(, `float`, `argument`...)",
        "returns": "`float`",
        "engines": [
          "skia"
        ],
        "overloads": []
      }
    ],
    "summary": "可以从字符串调用式中函数。GETMETH 对应 #FUNCTION，GETMETHS 对应 #FUNCTIONS，GETMETHF 对应 #FUNCTIONF。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint GETMETH functionName(, defaultValue, argument...)\n\tstring GETMETHs functionName(, defaultValue, argument...)\n\tfloat GETMETHF functionName(, defaultValue, argument...)\n    ```\n    可以从字符串调用式中函数。`GETMETH` 对应 `#FUNCTION`，`GETMETHS` 对应 `#FUNCTIONS`，`GETMETHF` 对应 `#FUNCTIONF`。\n    第二参数是函数未找到时的返回值，第三参数及后续参数将成为第一参数所指定的式中函数的参数。\n\n!!! hint \"提示\"\n\n    同时支持命令和式中函数。\n\n### 相关项目\n- GETVAR,GETVARS,SETVAR",
    "sourcePath": "docs/Reference/GETMETH.zh.md"
  },
  {
    "id": "GETMILLISECOND",
    "title": "GETMILLISECOND",
    "names": [
      "GETMILLISECOND"
    ],
    "signatures": [
      {
        "name": "GETMILLISECOND",
        "params": "无",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "获取自公元0001年1月1日起经过的时间，单位为毫秒。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int GETMILLISECOND\n    ```\n    获取自公元0001年1月1日起经过的时间，单位为毫秒。\n    由于可以直接进行加减运算，因此比 GETTIME 更适合用于测量经过的时间。\n    请注意，返回值的精度取决于运行环境，大约在十几到几十毫秒之间。\n    （如果仅经过了几毫秒，可能会返回相同的值）\n    若用于性能测量，请留意此点。\n\n!!! hint \"提示\"\n\n    该函数既可作为指令使用，也可在表达式中作为函数使用。\n\n### 相关项目\n- GETSECOND\n- GETTIME",
    "sourcePath": "docs/Reference/GETMILLISECOND.zh.md"
  },
  {
    "id": "GETNUM",
    "title": "GETNUM",
    "names": [
      "GETNUM"
    ],
    "signatures": [
      {
        "name": "GETNUM",
        "params": "`variable`, `string`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "从各 CSV 文件中定义的名称获取其对应的数值，并赋值给 RESULT:0。",
    "body": "!!! info \"API\"\n\n    ```erb\n    GETNUM variableName, indexName\n    ```\n    从各 CSV 文件中定义的名称获取其对应的数值，并赋值给 `RESULT:0`。\n    例如，如果在 `abl.csv` 中定义了 `2,技巧`，那么执行 `GETNUM ABL, \"技巧\"` 后，`RESULT:0` 将被赋值为 `2`。\n    如果未定义，则结果为 `-1`。\n    CSV 文件与变量的对应关系遵循 [「Emuera 新增语法」页面中的「通过字符串指定数组变量元素」](../Emuera/expression.md#string-array-element) 部分。\n\n!!! hint \"提示\"\n\n    此功能同时支持指令和表达式函数两种形式。\n\n### 相关项目\n- CSV 状态相关\n- [动态解析与反射](../tutorial/dynamic-reflection.zh.md) — GETNUM 属于第二代\"名称反查\"反射",
    "sourcePath": "docs/Reference/GETNUM.zh.md"
  },
  {
    "id": "GETPALAMLV",
    "title": "GETPALAMLV, GETEXPLV",
    "names": [
      "GETPALAMLV",
      "GETEXPLV"
    ],
    "signatures": [
      {
        "name": "GETPALAMLV",
        "params": "`int`, `int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "GETEXPLV",
        "params": "`int`, `int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "将给定值与 PALAMLV 和 EXPLV 进行比较，并将该参数在 PALAMLV 和 EXPLV 中达到或超过的等级赋值给 RESULT:0。",
    "body": "!!! info \"API\"\n\n    ```erb\n    GETPALAMLV int, maxLV\n    GETEXPLV int, maxLV\n    ```\n    将给定值与 `PALAMLV` 和 `EXPLV` 进行比较，并将该参数在 `PALAMLV` 和 `EXPLV` 中达到或超过的等级赋值给 `RESULT:0`。\n    第二个参数表示要调查的最大等级。请在使用前设置好 `PALAMLV` 和 `EXPLV` 的值。\n\n!!! hint \"提示\"\n\n    该函数既可作为指令使用，也可在表达式中作为函数使用。\n\n### 相关项目\n- [动态解析与反射](../tutorial/dynamic-reflection.zh.md) — GETPALAMLV/GETEXPLV 属于第一代\"数值→等级查询\"",
    "sourcePath": "docs/Reference/GETPALAMLV.zh.md"
  },
  {
    "id": "GETPLATFORM",
    "title": "GETPLATFORM",
    "names": [
      "GETPLATFORM"
    ],
    "signatures": [
      {
        "name": "GETPLATFORM",
        "params": "无",
        "returns": "`int`",
        "engines": [
          "skia"
        ],
        "overloads": []
      }
    ],
    "summary": "返回当前运行平台的整数编码。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint GETPLATFORM\n    ```\n\t返回当前运行平台的整数编码。\n\n\t| 返回值 | 平台    |\n\t| :----- | :------ |\n\t| 0      | Windows |\n\t| 1      | Android |\n\t| 2      | iOS     |\n\t| 3      | macOS   |\n\t| 4      | Linux   |\n\t| 5      | Unknown |\n\n\t可作为表达式中函数使用。`CanRestructure = true`，编译时可进行常量折叠。\n\n!!! hint \"提示\"\n\n\tERB脚本可以根据平台进行条件分支。\n\t例如，仅在移动环境下跳过特定处理时使用。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tIF GETPLATFORM() == 0\n\t\t\tPRINTL Windows环境\n\t\tELSEIF GETPLATFORM() == 1\n\t\t\tPRINTL Android环境\n\t\tELSE\n\t\t\tPRINTL 其他环境\n\t\tENDIF\n    ```\n\n### 相关项\n- GETCONFIG\n- GETSTYLE",
    "sourcePath": "docs/Reference/GETPLATFORM.zh.md"
  },
  {
    "id": "GETSECOND",
    "title": "GETSECOND",
    "names": [
      "GETSECOND",
      "GETTIME"
    ],
    "signatures": [
      {
        "name": "GETSECOND",
        "params": "无",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "获取自公元0001年1月1日起经过的时间（以秒为单位），并赋值给RESULT:0。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint GETTIME\n    ```\n\t获取自公元0001年1月1日起经过的时间（以秒为单位），并赋值给RESULT:0。\n\t由于可以直接进行加减运算，因此比GETTIME更适合用于计算经过的时间等场景。\n\n!!! hint \"提示\"\n\n    该函数同时支持作为指令和表达式函数使用。\n\n### 相关项目\n- GETMILLISECOND\n- GETTIME",
    "sourcePath": "docs/Reference/GETSECOND.zh.md"
  },
  {
    "id": "GETSETVAR",
    "title": "SETVAR / GETVAR 系列",
    "names": [
      "GETVAR",
      "GETVARF",
      "GETVARS",
      "SETVAR",
      "GETSETVAR"
    ],
    "signatures": [
      {
        "name": "GETVAR",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      },
      {
        "name": "GETVARF",
        "params": "`string`",
        "returns": "`float`",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "GETVARS",
        "params": "`string`",
        "returns": "`string`",
        "engines": [
          "em"
        ],
        "overloads": []
      },
      {
        "name": "SETVAR",
        "params": "`string`, `any`",
        "returns": "`1`",
        "engines": [
          "em"
        ],
        "overloads": []
      }
    ],
    "summary": "名为 varName 的变量 / 常量的 GET / SET 函数（常量无法使用 SET 修改值）。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int GETVAR varName\n    float GETVARF varName\n    string GETVARS varName\n    1 SETVAR varName, value\n    ```\n\n    名为 `varName` 的变量 / 常量的 `GET` / `SET` 函数（常量无法使用 `SET` 修改值）。\n\n    - `GETVAR` 返回 `varName` 表示的整型变量 / 常量的值。\n    - `GETVARF` 返回 `varName` 表示的浮点型变量 / 常量的值。\n    - `GETVARS` 返回 `varName` 表示的字符串变量 / 常量的值。\n    - `SETVAR` 将 `varName` 赋值为 `value`。`value` 的类型必须与该变量原本的类型相同。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    #DIMS CONST 字符串常量 = \"Banana\"\n    #DIM 整型变量 = 10\n    ```\n    ```erb\n    @SYSTEM_TITLE\n        #DIMS 临时字符串变量 = \"local\"\n\n        ; PRINTFORML {GETVAR(\"Foo\")}\n        ; 报错：\"Foo\"は解釈できない識別子です\n        PRINTFORMS @\"{GETVAR(\"整型变量\")} %GETVARS(\"临时字符串变量\")% \"\n        PRINTSL GETVARS(\"字符串常量\")\n\n        ; SETVAR \"字符串常量\", \"Apple\"\n        ; 报错：\"字符串常量\"が変数ではありません\n        ; SETVAR \"整型变量\", \"Apple\"\n        ; 报错：\"整型变量\"が文字列型ではありません\n        SETVAR \"临时字符串变量\", \"temp\"\n        PRINTSL 临时字符串变量\n\n        ONEINPUT\n    ```\n    ```text\n    10 local Banana\n    temp\n    ```\n\n### 相关项目\n- STRFORM\n- GETMETH,GETMETHS\n- [动态解析与反射](../tutorial/dynamic-reflection.zh.md) — GETVAR/GETVARS/SETVAR 属于第三代\"变量反射\"",
    "sourcePath": "docs/Reference/GETSETVAR.zh.md"
  },
  {
    "id": "GETTIME",
    "title": "GETTIME",
    "names": [
      "GETTIME",
      "GETTIMES"
    ],
    "signatures": [
      {
        "name": "GETTIME",
        "params": "无",
        "returns": "`int`, `string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "GETTIME",
        "params": "无",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "GETTIMES",
        "params": "无",
        "returns": "`string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "将计算机的当前日期/时间信息赋值给 RESULT:0 和 RESULTS:0。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tGETTIME\n\tint GETTIME\n\tstring GETTIMES\n    ```\n\t将计算机的当前日期/时间信息赋值给 `RESULT:0` 和 `RESULTS:0`。\n\t如果当前日期时间是 2009年3月28日13时5分23秒678毫秒，则 `RESULT:0` 将被赋值为 `20090328130523678`。\n\t`RESULTS:0` 将被赋值为 `2009/03/28 13:05:23`。\n\t`RESULTS:0` 主要预想用于存档数据的注释。\n\t若希望对年月日使用自定义的表示方式，请分解 `RESULT:0` 来使用。\n\t另外，`RESULT:0` 的精度取决于运行环境，大约在十几到几十毫秒左右。\n\t（如果只经过了几毫秒，可能会返回相同的值）\n\t若以性能测量为目的，请注意这一点。\n\n    作为表达式内函数使用的`GETTIME()`和`GETTIMES()`，分别返回执行`GETTIME`命令时赋值给`RESULT:0`和`RESULTS:0`的值。\n\n!!! hint \"提示\"\n\n    同时支持命令形式和表达式内函数形式。\n\n### 相关项目\n- GETSECOND\n- GETMILLISECOND",
    "sourcePath": "docs/Reference/GETTIME.zh.md"
  },
  {
    "id": "GFILLRECTANGLE",
    "title": "GFILLRECTANGLE",
    "names": [
      "GFILLRECTANGLE"
    ],
    "signatures": [
      {
        "name": "GFILLRECTANGLE",
        "params": "`int`, `int`, `int`, `int`, `int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "在指定的gID对应的Graphics上，绘制由x, y, width, height定义的矩形。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint GFILLRECTANGLE gID, x, y, width, height\n    ```\n    在指定的`gID`对应的`Graphics`上，绘制由`x`, `y`, `width`, `height`定义的矩形。\n    如果处理成功，则返回非0值。\n    绘制颜色必须预先通过`GSETBRUSH`命令指定，否则将使用Emuera配置中的文字颜色进行绘制。\n\n!!! hint \"提示\"\n\n    此功能同时支持作为命令和表达式内函数使用。\n\n### 相关项目\n- GSETBRUSH",
    "sourcePath": "docs/Reference/GFILLRECTANGLE.zh.md"
  },
  {
    "id": "GGETBRUSH",
    "title": "GGETBRUSH",
    "names": [
      "GGETBRUSH"
    ],
    "signatures": [
      {
        "name": "GGETBRUSH",
        "params": "`int`",
        "returns": "`int`",
        "engines": [
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "返回  gID 代表的图像中 GSETBRUSH 所指定的颜色（cARGB）。",
    "body": "!!! info \"API\"\n\n\t```erb\n\tint GGETBRUSH gID\n\t```\n\n\t返回  `gID` 代表的图像中 `GSETBRUSH` 所指定的颜色（cARGB）。\n\n!!! warning \"Skia版注意\"\n\n\t`GCREATE` 后未调用 `GSETBRUSH` 就调用 `GGETBRUSH` 时，EM+EE 会抛出 NullReferenceException，而 Skia 版返回 `0`。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n\t```erb\n\t@SYSTEM_TITLE\n\t\tGCREATE 0, 100, 100\n\t\tGSETBRUSH 0, 0xFF112233\n\n\t\tPRINTFORMW Color:{GGETBRUSH(0)}(%CONVERT(GGETBRUSH(0), 16)%)\n\t```\n\n\t```text\n\tColor:4279312947(ff112233)\n\t```\n\n### 相关项目\n- GSETBRUSH",
    "sourcePath": "docs/Reference/GGETBRUSH.zh.md"
  },
  {
    "id": "GGETCOLOR",
    "title": "GGETCOLOR",
    "names": [
      "GGETCOLOR"
    ],
    "signatures": [
      {
        "name": "GGETCOLOR",
        "params": "`int`, `int`, `int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "获取指定gID的Graphics在指定位置的颜色，以0xAARRGGBB格式的整数值返回。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint GGETCOLOR gID, x, y\n    ```\n    获取指定`gID`的`Graphics`在指定位置的颜色，以`0xAARRGGBB`格式的整数值返回。\n    如果`Graphics`未创建或已销毁，或者`x,y`位于图像范围之外，则返回-1。\n\n    请注意，此命令是唯一一个在失败时返回-1而非0的命令。\n    当获取到黑色且完全透明位置的颜色时，此命令将返回0。\n\n!!! hint \"提示\"\n\n    同时支持作为命令和表达式函数使用。\n\n### 相关项目\n- GSETCOLOR",
    "sourcePath": "docs/Reference/GGETCOLOR.zh.md"
  },
  {
    "id": "GGETFONT",
    "title": "GGETFONT",
    "names": [
      "GGETFONT"
    ],
    "signatures": [
      {
        "name": "GGETFONT",
        "params": "`int`",
        "returns": "`string`",
        "engines": [
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "返回指定的 gID 使用 GSETFONT 设置的字体名称。",
    "body": "!!! info \"API\"\n\n    ```erb\n    string GGETFONT gID\n    ```\n\n    返回指定的 `gID` 使用 `GSETFONT` 设置的字体名称。\n\n!!! warning \"Skia版注意\"\n\n    `GCREATE` 后未调用 `GSETFONT` 就调用 `GGETFONT` 时，EM+EE 会抛出 NullReferenceException，而 Skia 版返回空字符串 `\"\"`。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n    \tGCREATE 0, 100, 100\n    \tGSETFONT 0, \"Arial\", 100\n\n    \tGCREATE 1, 100, 100\n    \tGSETFONT 1, \"ＭＳ ゴシック\", 100\n\n    \tPRINTSL GGETFONT(0)\n    \tPRINTSL GGETFONT(1)\n    \tWAIT\n    ```\n\n    ```text\n    Arial\n    ＭＳ ゴシック\n    ```\n\n### 相关项目\n- GSETFONT\n- GGETFONTSIZE\n- GGETFONTSTYLE",
    "sourcePath": "docs/Reference/GGETFONT.zh.md"
  },
  {
    "id": "GGETFONTSIZE",
    "title": "GGETFONTSIZE",
    "names": [
      "GGETFONTSIZE"
    ],
    "signatures": [
      {
        "name": "GGETFONTSIZE",
        "params": "`int`",
        "returns": "`int`",
        "engines": [
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "返回指定的 gID 使用 GSETFONT 设置的字体大小。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int GGETFONTSIZE gID\n    ```\n\n    返回指定的 `gID` 使用 `GSETFONT` 设置的字体大小。\n\n!!! warning \"Skia版注意\"\n\n    `GCREATE` 后未调用 `GSETFONT` 就调用 `GGETFONTSIZE` 时，EM+EE 会抛出 NullReferenceException，而 Skia 版返回 `0`。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n    \tGCREATE 0, 100, 100\n    \tGSETFONT 0, \"Arial\", 100\n\n    \tGCREATE 1, 100, 100\n    \tGSETFONT 1, \"ＭＳ ゴシック\", 200\n\n    \tPRINTVL GGETFONTSIZE(0)\n    \tPRINTVL GGETFONTSIZE(1)\n    \tWAIT\n    ```\n\n    ```text\n    100\n    200\n    ```\n\n### 相关项目\n- GSETFONT\n- GGETFONT\n- GGETFONTSTYLE",
    "sourcePath": "docs/Reference/GGETFONTSIZE.zh.md"
  },
  {
    "id": "GGETFONTSTYLE",
    "title": "GGETFONTSTYLE",
    "names": [
      "GGETFONTSTYLE"
    ],
    "signatures": [
      {
        "name": "GGETFONTSTYLE",
        "params": "`int`",
        "returns": "`int`",
        "engines": [
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "返回指定的 gID 使用 GSETFONT 设置的字体样式标记。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int GGETFONTSTYLE gID\n    ```\n\n    返回指定的 `gID` 使用 `GSETFONT` 设置的字体样式标记。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        GCREATE 0, 100, 100\n        GSETFONT 0, \"Arial\", 100, 1|8  ; 0b0001|0b1000 => 0b1001 => 9\n\n        GCREATE 1, 100, 100\n        GSETFONT 1, \"ＭＳ ゴシック\", 100, 2|4  ; 0b0010|0b0100 => 0b0110 => 6\n\n        PRINTVL GGETFONTSTYLE(0)\n        PRINTVL GGETFONTSTYLE(1)\n        WAIT\n    ```\n\n    ```text\n    9\n    6\n    ```\n\n### 相关项目\n- GSETFONT\n- GGETFONT\n- GGETFONTSIZE",
    "sourcePath": "docs/Reference/GGETFONTSTYLE.zh.md"
  },
  {
    "id": "GGETPEN",
    "title": "GGETPEN",
    "names": [
      "GGETPEN"
    ],
    "signatures": [
      {
        "name": "GGETPEN",
        "params": "`int`",
        "returns": "`int`",
        "engines": [
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "返回  gID 代表的图像中 GSETPEN 所指定的颜色（cARGB）。",
    "body": "!!! info \"API\"\n\n\t```erb\n\tint GGETPEN gID\n\t```\n\n\t返回  `gID` 代表的图像中 `GSETPEN` 所指定的颜色（cARGB）。\n\n!!! warning \"Skia版注意\"\n\n\t`GCREATE` 后未调用 `GSETPEN` 就调用 `GGETPEN` 时，EM+EE 会抛出 NullReferenceException，而 Skia 版返回 `0`。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n\t```erb\n\t@SYSTEM_TITLE\n\t\tGCREATE 0, 100, 100\n\t\tGSETPEN 0, 0xFF00FF00, 5\n\n\t\tPRINTFORMW Color:{GGETPEN(0)}(%CONVERT(GGETPEN(0), 16)%) Width:{GGETPENWIDTH(0)}\n\t```\n\n\t```text\n\tColor:4278255360(ff00ff00) Width:5\n\t```\n\n### 相关项目\n- GSETPEN\n- GGETPENWIDTH",
    "sourcePath": "docs/Reference/GGETPEN.zh.md"
  }
];
