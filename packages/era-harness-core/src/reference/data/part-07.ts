// 本文件由 scripts/build-reference.ts 生成，请勿手工修改。
//
// 数据来源：https://github.com/qirchen421/emuera.sk.doc  docs/Reference/*.zh.md
// 上游版本：606670cd78b58f5d9a050013d1d3f41db5a87a1b
// 许可：CC BY-NC 4.0（http://creativecommons.org/licenses/by-nc/4.0/）
//       与本仓库代码的 Apache-2.0 分开管理，见 NOTICE-emuera-sk-doc.md
import type { ReferenceEntry } from '../types.js';

export const ENTRIES_PART_07: readonly ReferenceEntry[] = [
  {
    "id": "SPRITEANIMEADDFRAME",
    "title": "SPRITEANIMEADDFRAME",
    "names": [
      "SPRITEANIMEADDFRAME"
    ],
    "signatures": [
      {
        "name": "SPRITEANIMEADDFRAME",
        "params": "`string`, `int`, `int`, `int`, `int`, `int`, `int`, `int`, `int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "向spriteName指定的资源名所对应的动画精灵添加帧。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint SPRITEANIMEADDFRAME spriteName, gID, x, y, width, height, offsetx, offsety, delay\n    ```\n\t向`spriteName`指定的资源名所对应的动画精灵添加帧。\n\t将`gID`指定的`Graphics`中，由`x`, `y`, `width`, `height`指定的矩形区域作为帧，并放置在精灵左上角偏移`offsetx`, `offsety`的位置。\n\t超出创建动画精灵时设定尺寸范围的部分将不会被绘制。\n\t`delay`用于指定此帧的显示时间，单位为毫秒。\n\t如果`spriteName`指定的资源名不存在，或者不是动画精灵，则此命令失败，不执行任何操作。\n\t如果帧添加成功则返回1，失败则返回0。\n\n!!! hint \"提示\"\n\n命令、式中函数均可使用。\n\n### 相关项目\n- SPRITRANIMECREATE"
  },
  {
    "id": "SPRITEANIMECREATE",
    "title": "SPRITEANIMECREATE",
    "names": [
      "SPRITEANIMECREATE"
    ],
    "signatures": [
      {
        "name": "SPRITEANIMECREATE",
        "params": "`string`, `int`, `int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "创建一个动画精灵，其资源名由 spriteName 指定，尺寸由 width 和 height 指定。创建成功时返回非0值。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint SPRITEANIMECREATE spriteName, width, height\n    ```\n\t创建一个动画精灵，其资源名由 `spriteName` 指定，尺寸由 `width` 和 `height` 指定。创建成功时返回非0值。\n\t若因已存在相同资源名的精灵等原因导致失败，则返回0。\n\t要使其产生动画效果，需要使用 `SPRITEANIMEADDFRAME` 指令添加帧。\n\t关于动画精灵的注意事项，也请参阅 [`resouces`](../Emuera/resources.zh.md)。\n\n!!! hint \"提示\"\n\n    该指令同时支持在指令和表达式中使用。\n\n### 相关项目\n- SPRITEANIMEADDFRAME\n- SETANIMETIMER"
  },
  {
    "id": "SPRITECREATE",
    "title": "SPRITECREATE",
    "names": [
      "SPRITECREATE"
    ],
    "signatures": [
      {
        "name": "SPRITECREATE",
        "params": "`string`, `int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": [
          "`string`, `int`, `int`, `int`, `int`, `int`",
          "`string`, `int`, `int`, `int`, `int`, `int`, `int`, `int`",
          "`string`, `int`, `int`, `int`, `int`, `int`, `int`, `int`, `int`, `int`"
        ]
      }
    ],
    "summary": "基于 gID 所指定的 Graphics 图像的全部或部分，创建一个资源名为 spriteName 的精灵。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int SPRITECREATE spriteName, gID\n    int SPRITECREATE spriteName, gID, x, y, width, height\n    int SPRITECREATE spriteName, gID, x, y, width, height, posX, posY\n    int SPRITECREATE spriteName, gID, x, y, width, height, posX, posY, destWidth, destHeight\n    ```\n\n    基于 `gID` 所指定的 `Graphics` 图像的全部或部分，创建一个资源名为 `spriteName` 的精灵。\n    通过指定 `x, y, width, height` 参数，可以截取 `Graphics` 图像的特定部分作为精灵。\n    创建成功时，返回非 0 值。\n    因已存在同名精灵资源等原因导致失败时，返回 0。\n    精灵仅保存了其父 `Graphics` 的 `gID` 和截取位置信息，因此当父 `Graphics` 发生变更时，精灵也会随之改变。\n    此外，如果父 `Graphics` 被销毁，该精灵也将被视为已销毁。\n    创建的精灵可以像在 `resources` 文件夹内的 csv 文件中声明的资源一样使用。\n    例如，可以在 `PRINT_IMG` 命令或 [`HTML_PRINT 的 img 标签`](../Emuera/HTML_PRINT.md#img) 中使用。\n\n    **Skia（SkiaSharp版）扩展参数**（第7个参数起）：\n\n    - `posX`, `posY`（可选，默认 `0`）：精灵的绘制偏移。指定精灵被绘制时相对于原点的偏移位置。\n    - `destWidth`, `destHeight`（可选，默认与源矩形相同尺寸）：精灵的绘制目标尺寸。指定与源矩形不同的尺寸时，精灵会被缩放绘制。负值会被取绝对值处理。\n\n!!! hint \"提示\"\n\n    该功能同时支持命令和表达式函数两种形式。\n\n### 相关项目\n- GCREATE"
  },
  {
    "id": "SPRITECREATED",
    "title": "SPRITECREATED",
    "names": [
      "SPRITECREATED"
    ],
    "signatures": [
      {
        "name": "SPRITECREATED",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "若指定名称的精灵已创建则返回1，若未创建或已销毁则返回0。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint SPRITECREATED spriteName\n    ```\n    若指定名称的精灵已创建则返回1，若未创建或已销毁则返回0。\n\n!!! hint \"提示\"\n\n    该函数同时支持在指令和表达式中使用。\n\n### 相关项目\n- SPRITECREATE"
  },
  {
    "id": "SPRITECREATEFROMFILE",
    "title": "SPRITECREATEFROMFILE",
    "names": [
      "SPRITECREATEFROMFILE"
    ],
    "signatures": [
      {
        "name": "SPRITECREATEFROMFILE",
        "params": "`string`, `string`(, `int`, `int`, `int`, `int`)",
        "returns": "`int`",
        "engines": [
          "skia"
        ],
        "overloads": []
      }
    ],
    "summary": "直接从图像文件创建 Sprite。可以一步完成 GCREATEFROMFILE 创建 Graphics 再用 SPRITECREATE 创建 Sprite 的两步操作。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int SPRITECREATEFROMFILE spriteName, filePath(, x, y, width, height)\n    ```\n\n    直接从图像文件创建 Sprite。可以一步完成 `GCREATEFROMFILE` 创建 Graphics 再用 `SPRITECREATE` 创建 Sprite 的两步操作。\n\n    **参数**：\n\n    | 参数 | 类型 | 说明 |\n    | :--- | :--- | :--- |\n    | `spriteName` | string | 要创建的 Sprite 资源名 |\n    | `filePath` | string | 图像文件路径 |\n    | `x` | int | 裁剪起始 X 坐标（省略时为0） |\n    | `y` | int | 裁剪起始 Y 坐标（省略时为0） |\n    | `width` | int | 裁剪宽度（省略时为0，即图像整体宽度） |\n    | `height` | int | 裁剪高度（省略时为0，即图像整体高度） |\n\n    **返回值**：创建成功返回 1，失败返回 0。\n\n    !!! warning \"注意\"\n        - 支持命令和表达式函数两种形式。\n        - 如果同名 Sprite 已存在，则创建失败，返回 0。\n        - `filePath` 可以是 `resources` 文件夹的相对路径或绝对路径。\n        - 创建的 Sprite 可用于 `PRINT_IMG` 命令或 [`HTML_PRINT 的 img 标签`](../Emuera/HTML_PRINT.zh.md#img) 等。\n        - 与 `SPRITECREATE` 不同，此函数创建的 Sprite 没有父 Graphics，因此 Sprite 作为独立图像数据保存。\n\n!!! hint \"提示\"\n\n    支持命令和表达式函数两种形式。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n        ; 从整个文件创建 Sprite\n        IF SPRITECREATEFROMFILE(\"my_img\", \"image/character.png\")\n            PRINTL Sprite 创建成功\n            PRINT_IMG my_img\n        ELSE\n            PRINTL Sprite 创建失败\n        ENDIF\n\n        ; 从文件的一部分裁剪创建 Sprite\n        SPRITECREATEFROMFILE \"my_icon\", \"image/icons.png\", 0, 0, 32, 32\n    ```\n\n### 相关项\n- SPRITECREATE\n- GCREATEFROMFILE\n- PRINT_IMG"
  },
  {
    "id": "SPRITEDISPOSE",
    "title": "SPRITEDISPOSE",
    "names": [
      "SPRITEDISPOSE",
      "SPRITDISPOSE"
    ],
    "signatures": [
      {
        "name": "SPRITEDISPOSE",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "废弃（释放）由 spriteName 指定的资源名所对应的精灵。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint SPRITDISPOSE spriteName\n    ```\n\t废弃（释放）由 `spriteName` 指定的资源名所对应的精灵。\n\t若废弃成功，则返回非零值。\n\t此指令不会影响构成该精灵来源的 `Graphics` 等对象。\n\t若要释放分配给 `Graphics` 的内存，请使用 `GDISPOSE` 指令。\n\n!!! hint \"提示\"\n\n    此功能同时支持指令形式和表达式函数形式。\n\n### 相关项目\n- SPRITECREAATE\n- SPRITEDISPOSEALL"
  },
  {
    "id": "SPRITEDISPOSEALL",
    "title": "SPRITEDISPOSEALL",
    "names": [
      "SPRITEDISPOSEALL"
    ],
    "signatures": [
      {
        "name": "SPRITEDISPOSEALL",
        "params": "`int`",
        "returns": "`int`",
        "engines": [
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "销毁所有 SPRITE。若参数为 0，则仅销毁 ERB 上创建的 SPRITE；若参数非 0，则同时销毁 resources 内 CSV 创建的所有 SPRITE。",
    "body": "!!! info \"API\"\n\n\t```erb\n\tint SPRITEDISPOSEALL, containCsvSprite\n\t```\n\n    销毁所有 SPRITE。若参数为 0，则仅销毁 ERB 上创建的 SPRITE；若参数非 0，则同时销毁 resources 内 CSV 创建的所有 SPRITE。\n    返回被销毁的精灵数量。\n\n!!! hint \"提示\"\n\n    同时支持指令和表达式函数两种形式。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n        GCREATE 0, 100, 100\n\n        SPRITECREATE \"AAA\", 0\n        SPRITECREATE \"BBB\", 0\n        SPRITECREATE \"CCC\", 0\n\n        PRINTFORMW {SPRITEDISPOSEALL(0)}\n    ```\n\n    ```text\n    3\n    ```\n\n### 相关项目\n- SPRITEDISPOSE"
  },
  {
    "id": "SPRITEGETCOLOR",
    "title": "SPRITEGETCOLOR",
    "names": [
      "SPRITEGETCOLOR"
    ],
    "signatures": [
      {
        "name": "SPRITEGETCOLOR",
        "params": "`string`, `int`, `int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "获取指定spriteName资源名对应的精灵在指定位置的颜色，以0xAARRGGBB格式的整数值返回。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint SPRITEGETCOLOR spriteName, x, y\n    ```\n    获取指定`spriteName`资源名对应的精灵在指定位置的颜色，以`0xAARRGGBB`格式的整数值返回。\n    如果`spriteName`指定的精灵未创建或已销毁，或者`x, y`坐标位于图像范围之外，则返回-1。\n\n    请注意，这是唯一一个在失败时返回-1而非0的命令。\n    当获取到的位置颜色为黑色且完全透明时，此命令将返回0。\n\n!!! hint \"提示\"\n\n    此功能同时支持作为命令和表达式函数使用。"
  },
  {
    "id": "SPRITEMOVE",
    "title": "SPRITEMOVE",
    "names": [
      "SPRITEMOVE"
    ],
    "signatures": [
      {
        "name": "SPRITEMOVE",
        "params": "`string`, `int`, `int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "将指定的值加到指定名称的精灵的相对位置的X、Y坐标上。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint SPRITEMOVE spriteName, movex, movey\n    ```\n\t将指定的值加到指定名称的精灵的相对位置的X、Y坐标上。\n\t也就是说，\n\n\t\tSPRITESETPOS spriteName, SPRITEPOSX(spriteName) + movex, SPRITEPOSY(spriteName) + movey\n\n\t是等价的。\n\t成功时返回非0值，如果因指定的精灵未创建或已销毁等原因失败，则返回0。\n\n!!! hint \"提示\"\n\n    同时支持指令和表达式函数两种形式。"
  },
  {
    "id": "SPRITEPOSXY",
    "title": "SPRITEPOSX, SPRITEPOSY",
    "names": [
      "SPRITEPOSX",
      "SPRITEPOSY",
      "SPRITEPOSXY"
    ],
    "signatures": [
      {
        "name": "SPRITEPOSX",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "SPRITEPOSY",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "获取指定名称的精灵的相对位置的 X、Y 坐标。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int SPRITEPOSX spriteName\n    int SPRITEPOSY spriteName\n    ```\n    获取指定名称的精灵的相对位置的 `X`、`Y` 坐标。\n    如果精灵尚未创建或已被销毁，则返回 0。\n    要区分相对位置的 `X`、`Y` 坐标是 0 还是精灵未创建/已销毁，请另外调用 `SPRITECREATED`。\n\n!!! hint \"提示\"\n\n    该函数在指令和表达式中均可使用。"
  },
  {
    "id": "SPRITESETPOS",
    "title": "SPRITESETPOS",
    "names": [
      "SPRITESETPOS"
    ],
    "signatures": [
      {
        "name": "SPRITESETPOS",
        "params": "`string`, `int`, `int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "设置指定名称的精灵的相对位置 X、Y。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint SPRITESETPOS spriteName, posX, posY\n    ```\n    设置指定名称的精灵的相对位置 `X`、`Y`。\n    成功时返回非0值，若因指定精灵未创建或已销毁等原因失败则返回0。\n\n!!! hint \"提示\"\n\n    同时支持指令和表达式函数形式。"
  },
  {
    "id": "SPRITEWIDTHHEIGHT",
    "title": "SPRITEWIDTH, SPRITEHEIGHT",
    "names": [
      "SPRITEWIDTH",
      "SPRITEHEIGHT",
      "SPRITEWIDTHHEIGHT"
    ],
    "signatures": [
      {
        "name": "SPRITEWIDTH",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "SPRITEHEIGHT",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "获取指定名称的精灵的宽度或高度。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int SPRITEWIDTH spriteName\n    int SPRITEHEIGHT spriteName\n    ```\n    获取指定名称的精灵的宽度或高度。\n    如果精灵尚未创建或已被销毁，则返回0。\n\n!!! hint \"提示\"\n\n    该函数同时支持在指令和表达式中使用。"
  },
  {
    "id": "SQL_CONNECT",
    "title": "SQL 连接管理",
    "names": [
      "SQL_CONNECTION_OPEN",
      "SQL_CONNECT",
      "SQL_DISCONNECT",
      "SQL"
    ],
    "signatures": [
      {
        "name": "SQL_CONNECTION_OPEN",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "net"
        ],
        "overloads": []
      },
      {
        "name": "SQL_CONNECT",
        "params": "`string`(, `string`)",
        "returns": "`int`",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "SQL_DISCONNECT",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "skia"
        ],
        "overloads": []
      }
    ],
    "summary": "SQLite 数据库的连接与断开相关函数。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int SQL_CONNECTION_OPEN name\n    int SQL_CONNECT dbName(, connectionString)\n    int SQL_DISCONNECT dbName\n    ```\n\n    SQLite 数据库的连接与断开相关函数。\n\n    - `SQL_CONNECTION_OPEN`：以 `name` 为名，在 `sav/sql/` 目录下自动创建或打开 SQLite 数据库文件（`name.db`）。若已存在同名连接则先关闭再重新打开。成功返回 `1`。\n        - DotNet 上游行为：自动设置 `PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF;` 以追求极致写入性能，但游戏崩溃时数据库有损坏风险。且 `name` 参数未做路径校验，恶意或写错的 ERB 脚本可通过 `../../` 等路径穿越 `sav/sql/` 目录，在系统任意位置创建或覆盖 `.db` 文件。\n        - **Skia 变体变更**：改为 `PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;`，写入性能接近 OFF 模式且崩溃时数据库不会损坏。同时 `name` 参数增加安全校验，仅允许合法文件名，禁止包含路径分隔符或 `..`（防止路径穿越）。\n    - `SQL_CONNECT`：以 `dbName` 为标识名，使用 `connectionString` 连接 SQLite 数据库。若省略 `connectionString`，默认使用内存数据库（`Data Source=:memory:`）。若已存在同名连接则直接返回 `1`。成功返回 `1`，失败抛出错误。\n    - `SQL_DISCONNECT`：断开名为 `dbName` 的数据库连接并释放资源。返回 `1`。\n\n    !!! warning \"注意\"\n\n        - `SQL_CONNECTION_OPEN` 是 DotNet 版新增的便捷函数，自动处理路径映射，适合大多数场景。\n        - `SQL_CONNECT` 是 Skia 版的底层连接函数，提供更灵活的持久化交互能力：\n            - 可指定任意路径的数据库文件（如 `Data Source=plugins/my_data.db`），不限于 `sav/sql/` 目录\n            - 可使用内存数据库（`Data Source=:memory:`）进行临时数据处理\n            - 可通过连接字符串自定义 SQLite 行为（WAL 模式、缓存大小、只读模式等）\n            - 不自动设置 PRAGMA，可自行控制 `journal_mode`、`synchronous` 等参数\n        - 两者共享同一连接池，不可对同一 `name`/`dbName` 同时使用两种方式连接。\n        - 「返回标题界面」或 `RESETDATA` 时会自动关闭所有连接。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        ; 使用 SQL_CONNECTION_OPEN 便捷连接（数据库文件位于 sav/sql/mydb.db）\n        SQL_CONNECTION_OPEN \"mydb\"\n        PRINTFORML 连接成功：{RESULT}\n\n        ; 执行建表\n        SQL_EXECUTE_NONQUERY \"mydb\", \"CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, name TEXT, price INTEGER)\"\n\n        ; 使用 SQL_CONNECT 连接内存数据库（临时数据处理）\n        SQL_CONNECT \"memdb\"\n        PRINTFORML 内存数据库连接成功：{RESULT}\n\n        ; 使用 SQL_CONNECT 连接自定义路径的数据库（如插件数据目录）\n        SQL_CONNECT \"QOL_DATA\", \"Data Source=plugins/qol_data.db\"\n        PRINTFORML 插件数据库连接成功：{RESULT}\n\n        ; 断开连接\n        SQL_DISCONNECT \"mydb\"\n        SQL_DISCONNECT \"memdb\"\n        SQL_DISCONNECT \"QOL_DATA\"\n\n        WAIT\n    ```"
  },
  {
    "id": "SQL_EXECUTE",
    "title": "SQL 执行操作",
    "names": [
      "SQL_EXECUTE_NONQUERY",
      "SQL_EXECUTE_READER",
      "SQL_EXECUTE_SCALAR_LONG",
      "SQL_EXECUTE_SCALAR_STRING",
      "SQL_EXECUTE_SCALAR_FLOAT",
      "STR",
      "SQL",
      "SQL_EXECUTE"
    ],
    "signatures": [
      {
        "name": "SQL_EXECUTE_NONQUERY",
        "params": "`string`, `string`",
        "returns": "`int`",
        "engines": [
          "net"
        ],
        "overloads": []
      },
      {
        "name": "SQL_EXECUTE_READER",
        "params": "`string`, `string`",
        "returns": "`int`",
        "engines": [
          "net"
        ],
        "overloads": []
      },
      {
        "name": "SQL_EXECUTE_SCALAR_LONG",
        "params": "`string`, `string`",
        "returns": "`int`",
        "engines": [
          "net"
        ],
        "overloads": []
      },
      {
        "name": "SQL_EXECUTE_SCALAR_STRING",
        "params": "`string`, `string`",
        "returns": "`string`",
        "engines": [
          "net"
        ],
        "overloads": []
      },
      {
        "name": "SQL_EXECUTE_SCALAR_FLOAT",
        "params": "`string`, `string`",
        "returns": "`float`",
        "engines": [
          "skia"
        ],
        "overloads": []
      }
    ],
    "summary": "SQLite 数据库的 SQL 语句执行相关函数。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int SQL_EXECUTE_NONQUERY dbName, sql\n    int SQL_EXECUTE_READER dbName, sql\n    int SQL_EXECUTE_SCALAR_LONG dbName, sql\n    str SQL_EXECUTE_SCALAR_STRING dbName, sql\n    float SQL_EXECUTE_SCALAR_FLOAT dbName, sql\n    ```\n\n    SQLite 数据库的 SQL 语句执行相关函数。\n\n    - `SQL_EXECUTE_NONQUERY`：执行非查询 SQL 语句（INSERT / UPDATE / DELETE / CREATE TABLE 等），返回受影响的行数。\n    - `SQL_EXECUTE_READER`：执行查询 SQL 语句（SELECT），返回 Reader ID（用于后续 `SQL_READER_READ` 等操作）。\n    - `SQL_EXECUTE_SCALAR_LONG`：执行标量查询，返回结果的第一行第一列的整数值。若结果为 NULL 或无结果，返回 `0`。\n    - `SQL_EXECUTE_SCALAR_STRING`：执行标量查询，返回结果的第一行第一列的字符串值。若结果为 NULL 或无结果，返回空字符串。\n    - `SQL_EXECUTE_SCALAR_FLOAT`：执行标量查询，返回结果的第一行第一列的浮点数值。若结果为 NULL 或无结果，返回 `0.0`。\n\n    !!! warning \"注意\"\n\n        - 执行前必须先通过 `SQL_CONNECTION_OPEN` 或 `SQL_CONNECT` 建立连接。\n        - 若需要参数化查询（防 SQL 注入），请使用 `SQL_P_EXECUTE_*` 系列函数。\n        - `SQL_EXECUTE_READER` 返回的 Reader ID 使用完毕后必须调用 `SQL_READER_CLOSE` 关闭，否则会泄漏资源。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        SQL_CONNECTION_OPEN \"test\"\n\n        ; 建表\n        SQL_EXECUTE_NONQUERY \"test\", \"CREATE TABLE IF NOT EXISTS scores (name TEXT, score INTEGER)\"\n\n        ; 插入数据\n        SQL_EXECUTE_NONQUERY \"test\", \"INSERT INTO scores VALUES ('Alice', 95)\"\n        SQL_EXECUTE_NONQUERY \"test\", \"INSERT INTO scores VALUES ('Bob', 82)\"\n\n        ; 标量查询\n        PRINTFORML 最高分：{SQL_EXECUTE_SCALAR_LONG(\"test\", \"SELECT MAX(score) FROM scores\")}\n        PRINTFORML 第一名姓名：{SQL_EXECUTE_SCALAR_STRING(\"test\", \"SELECT name FROM scores ORDER BY score DESC LIMIT 1\")}\n\n        ; Reader 查询\n        LOCAL = SQL_EXECUTE_READER(\"test\", \"SELECT * FROM scores\")\n        REPEAT 100\n            SIF !SQL_READER_READ(LOCAL)\n                BREAK\n            PRINTFORML %SQL_READER_GET_STRING(LOCAL, 0)%: {SQL_READER_GET_LONG(LOCAL, 1)}分\n        REND\n        SQL_READER_CLOSE LOCAL\n\n        SQL_DISCONNECT \"test\"\n        WAIT\n    ```"
  },
  {
    "id": "SQL_PARAM",
    "title": "SQL 参数化查询",
    "names": [
      "SQL_ESCAPE",
      "SQL_P_EXECUTE_NONQUERY",
      "SQL_P_EXECUTE_READER",
      "SQL_P_EXECUTE_SCALAR_LONG",
      "SQL_P_EXECUTE_SCALAR_STRING",
      "SQL_P_EXECUTE_SCALAR_FLOAT",
      "STR",
      "SQL",
      "SQL_PARAM"
    ],
    "signatures": [
      {
        "name": "SQL_ESCAPE",
        "params": "`string`",
        "returns": "`string`",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "SQL_P_EXECUTE_NONQUERY",
        "params": "`string`, `string`(, `string`...)",
        "returns": "`int`",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "SQL_P_EXECUTE_READER",
        "params": "`string`, `string`(, `string`...)",
        "returns": "`int`",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "SQL_P_EXECUTE_SCALAR_LONG",
        "params": "`string`, `string`(, `string`...)",
        "returns": "`int`",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "SQL_P_EXECUTE_SCALAR_STRING",
        "params": "`string`, `string`(, `string`...)",
        "returns": "`string`",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "SQL_P_EXECUTE_SCALAR_FLOAT",
        "params": "`string`, `string`(, `string`...)",
        "returns": "`float`",
        "engines": [
          "skia"
        ],
        "overloads": []
      }
    ],
    "summary": "SQLite 参数化查询相关函数，用于防止 SQL 注入攻击。",
    "body": "!!! info \"API\"\n\n    ```erb\n    str SQL_ESCAPE str\n    int SQL_P_EXECUTE_NONQUERY dbName, sql(, param0, param1, ...)\n    int SQL_P_EXECUTE_READER dbName, sql(, param0, param1, ...)\n    int SQL_P_EXECUTE_SCALAR_LONG dbName, sql(, param0, param1, ...)\n    str SQL_P_EXECUTE_SCALAR_STRING dbName, sql(, param0, param1, ...)\n    float SQL_P_EXECUTE_SCALAR_FLOAT dbName, sql(, param0, param1, ...)\n    ```\n\n    SQLite 参数化查询相关函数，用于防止 SQL 注入攻击。\n\n    - `SQL_ESCAPE`：对字符串进行 SQL 转义（将单引号 `''` 双写），返回转义后的字符串。适用于手动拼接 SQL 的场景。\n    - `SQL_P_EXECUTE_NONQUERY`：参数化执行非查询 SQL。SQL 中使用 `@0`、`@1`、`@2`... 作为占位符，后续参数按顺序替换。返回受影响的行数。\n    - `SQL_P_EXECUTE_READER`：参数化执行查询 SQL。返回 Reader ID。\n    - `SQL_P_EXECUTE_SCALAR_LONG`：参数化执行标量查询，返回整数值。\n    - `SQL_P_EXECUTE_SCALAR_STRING`：参数化执行标量查询，返回字符串值。\n    - `SQL_P_EXECUTE_SCALAR_FLOAT`：参数化执行标量查询，返回浮点数值。\n\n    !!! warning \"注意\"\n\n        - **推荐使用参数化查询**而非手动拼接 SQL 字符串，以防止 SQL 注入攻击。\n        - `SQL_ESCAPE` 仅在无法使用参数化查询时作为后备方案。\n        - 参数占位符为 `@0`、`@1`、`@2`...（从 0 开始编号），而非 `?` 或命名参数。\n        - 所有参数值均以字符串形式传入，SQLite 会根据列类型自动转换。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        SQL_CONNECTION_OPEN \"test\"\n        SQL_EXECUTE_NONQUERY \"test\", \"CREATE TABLE IF NOT EXISTS users (name TEXT, age INTEGER)\"\n\n        ; 参数化插入（安全）\n        SQL_P_EXECUTE_NONQUERY \"test\", \"INSERT INTO users VALUES (@0, @1)\", \"Alice\", \"25\"\n        SQL_P_EXECUTE_NONQUERY \"test\", \"INSERT INTO users VALUES (@0, @1)\", \"Bob\", \"30\"\n\n        ; 参数化查询\n        LOCAL = SQL_P_EXECUTE_READER(\"test\", \"SELECT * FROM users WHERE age > @0\", \"26\")\n        REPEAT 100\n            SIF !SQL_READER_READ(LOCAL)\n                BREAK\n            PRINTFORML %SQL_READER_GET_STRING(LOCAL, 0)%: {SQL_READER_GET_LONG(LOCAL, 1)}岁\n        REND\n        SQL_READER_CLOSE LOCAL\n\n        ; 参数化标量查询\n        PRINTFORML 25岁以上的人数：{SQL_P_EXECUTE_SCALAR_LONG(\"test\", \"SELECT COUNT(*) FROM users WHERE age > @0\", \"25\")}\n\n        SQL_DISCONNECT \"test\"\n        WAIT\n    ```"
  },
  {
    "id": "SQL_READER",
    "title": "SQL Reader 操作",
    "names": [
      "SQL_READER_READ",
      "SQL_READER_GET_LONG",
      "SQL_READER_GET_STRING",
      "SQL_READER_GET_FLOAT",
      "SQL_READER_ISNULL",
      "SQL_READER_CLOSE",
      "STR",
      "SQL",
      "SQL_READER"
    ],
    "signatures": [
      {
        "name": "SQL_READER_READ",
        "params": "`int`",
        "returns": "`int`",
        "engines": [
          "net"
        ],
        "overloads": []
      },
      {
        "name": "SQL_READER_GET_LONG",
        "params": "`int`, `int`",
        "returns": "`int`",
        "engines": [
          "net"
        ],
        "overloads": []
      },
      {
        "name": "SQL_READER_GET_STRING",
        "params": "`int`, `int`",
        "returns": "`string`",
        "engines": [
          "net"
        ],
        "overloads": []
      },
      {
        "name": "SQL_READER_GET_FLOAT",
        "params": "`int`, `int`",
        "returns": "`float`",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "SQL_READER_ISNULL",
        "params": "`int`, `int`",
        "returns": "`int`",
        "engines": [
          "net"
        ],
        "overloads": []
      },
      {
        "name": "SQL_READER_CLOSE",
        "params": "`int`",
        "returns": "`int`",
        "engines": [
          "net"
        ],
        "overloads": []
      }
    ],
    "summary": "SQLite 查询结果（Reader）的读取与操作相关函数。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int SQL_READER_READ readerId\n    int SQL_READER_GET_LONG readerId, columnIndex\n    str SQL_READER_GET_STRING readerId, columnIndex\n    float SQL_READER_GET_FLOAT readerId, columnIndex\n    int SQL_READER_ISNULL readerId, columnIndex\n    int SQL_READER_CLOSE readerId\n    ```\n\n    SQLite 查询结果（Reader）的读取与操作相关函数。\n\n    - `SQL_READER_READ`：将 Reader 前进到下一行。有数据返回 `1`，无更多行返回 `0`。\n    - `SQL_READER_GET_LONG`：获取当前行指定列（从 0 开始）的整数值。\n    - `SQL_READER_GET_STRING`：获取当前行指定列的字符串值。\n    - `SQL_READER_GET_FLOAT`：获取当前行指定列的浮点数值。\n    - `SQL_READER_ISNULL`：判断当前行指定列是否为 NULL，是返回 `1`，否返回 `0`。\n    - `SQL_READER_CLOSE`：关闭 Reader 并释放资源。返回 `1`。\n\n    !!! warning \"注意\"\n\n        - `readerId` 由 `SQL_EXECUTE_READER` 返回。\n        - 读取列值前必须先调用 `SQL_READER_READ` 至少一次。\n        - 使用完毕后**必须**调用 `SQL_READER_CLOSE` 关闭，否则会泄漏资源。\n        - `columnIndex` 从 0 开始。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        SQL_CONNECTION_OPEN \"test\"\n        SQL_EXECUTE_NONQUERY \"test\", \"CREATE TABLE IF NOT EXISTS data (k TEXT, v INTEGER, f REAL)\"\n        SQL_EXECUTE_NONQUERY \"test\", \"INSERT INTO data VALUES ('a', 10, 3.14)\"\n        SQL_EXECUTE_NONQUERY \"test\", \"INSERT INTO data VALUES ('b', NULL, NULL)\"\n\n        LOCAL = SQL_EXECUTE_READER(\"test\", \"SELECT * FROM data\")\n        REPEAT 100\n            SIF !SQL_READER_READ(LOCAL)\n                BREAK\n            PRINTFORM %SQL_READER_GET_STRING(LOCAL, 0)%:\n            SIF SQL_READER_ISNULL(LOCAL, 1)\n                PRINT NULL\n            SIF !SQL_READER_ISNULL(LOCAL, 1)\n                PRINTFORM {SQL_READER_GET_LONG(LOCAL, 1)}\n            PRINTFORM  /\n            SIF SQL_READER_ISNULL(LOCAL, 2)\n                PRINT NULL\n            SIF !SQL_READER_ISNULL(LOCAL, 2)\n                PRINTFORM {SQL_READER_GET_FLOAT(LOCAL, 2)}\n            PRINTL\n        REND\n        SQL_READER_CLOSE LOCAL\n\n        SQL_DISCONNECT \"test\"\n        WAIT\n    ```"
  },
  {
    "id": "SQL_XML",
    "title": "SQL XML 导入导出",
    "names": [
      "SQL_IMPORT_MAP_XML",
      "SQL_IMPORT_DT_XML",
      "SQL_EXPORT_MAP_XML",
      "SQL_EXPORT_DT_XML",
      "SQL_IMPORT_XML_CUSTOM",
      "SQL",
      "XML",
      "SQL_XML"
    ],
    "signatures": [
      {
        "name": "SQL_IMPORT_MAP_XML",
        "params": "`string`, `string`, `string`",
        "returns": "`int`",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "SQL_IMPORT_DT_XML",
        "params": "`string`, `string`, `string`, `string`",
        "returns": "`int`",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "SQL_EXPORT_MAP_XML",
        "params": "`string`, `string`, `string`",
        "returns": "`int`",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "SQL_EXPORT_DT_XML",
        "params": "`string`, `string`, `string`, `string`",
        "returns": "`int`",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "SQL_IMPORT_XML_CUSTOM",
        "params": "`string`, `string`, `string`, `string`, `string`",
        "returns": "`int`",
        "engines": [
          "skia"
        ],
        "overloads": []
      }
    ],
    "summary": "SQLite 数据库与 XML 文件之间的导入导出相关函数。支持 MAP 格式、DataTable 格式和自定义格式的 XML 互操作。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int SQL_IMPORT_MAP_XML dbName, tableName, filePath\n    int SQL_IMPORT_DT_XML dbName, tableName, schemaPath, dataPath\n    int SQL_EXPORT_MAP_XML dbName, tableName, filePath\n    int SQL_EXPORT_DT_XML dbName, tableName, schemaPath, dataPath\n    int SQL_IMPORT_XML_CUSTOM dbName, tableName, filePath, rowXPath, columnMappings\n    ```\n\n    SQLite 数据库与 XML 文件之间的导入导出相关函数。支持 MAP 格式、DataTable 格式和自定义格式的 XML 互操作。\n\n    - `SQL_IMPORT_MAP_XML`：将 MAP 格式的 XML 文件（`<map><p><k>key</k><v>value</v></p></map>`）导入到 SQLite 表。自动创建表（`k TEXT PRIMARY KEY, v TEXT`）并使用 `INSERT OR REPLACE`。成功返回 `1`。\n    - `SQL_IMPORT_DT_XML`：将 DataTable 格式的 XML 文件（Schema + Data）导入到 SQLite 表。根据 Schema 自动推断列类型（INTEGER / TEXT）。成功返回 `1`。\n    - `SQL_EXPORT_MAP_XML`：将 SQLite 表导出为 MAP 格式的 XML 文件。成功返回 `1`。\n    - `SQL_EXPORT_DT_XML`：将 SQLite 表导出为 DataTable 格式的 XML 文件（Schema + Data）。成功返回 `1`。\n    - `SQL_IMPORT_XML_CUSTOM`：将自定义格式的 XML 文件导入到 SQLite 表。通过 `rowXPath` 指定行节点路径，通过 `columnMappings` 指定列映射（格式：`\"ColName1=childNode,ColName2=@attr\"`）。所有列类型为 TEXT。成功返回 `1`。\n\n    !!! warning \"注意\"\n\n        - 执行前必须先通过 `SQL_CONNECTION_OPEN` 或 `SQL_CONNECT` 建立连接。\n        - `SQL_IMPORT_MAP_XML` 和 `SQL_IMPORT_DT_XML` 使用流式解析（XmlReader），支持大文件。\n        - `SQL_IMPORT_DT_XML` 的 Schema 文件用于推断列类型，Data 文件包含实际数据。\n        - 导出文件路径相对于程序目录。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        SQL_CONNECTION_OPEN \"mydb\"\n\n        ; 从 MAP XML 导入\n        SQL_IMPORT_MAP_XML \"mydb\", \"config\", \"data/config_map.xml\"\n\n        ; 从 DT XML 导入\n        SQL_IMPORT_DT_XML \"mydb\", \"items\", \"data/items_schema.xml\", \"data/items_data.xml\"\n\n        ; 导出为 MAP XML\n        SQL_EXPORT_MAP_XML \"mydb\", \"config\", \"output/config_export.xml\"\n\n        ; 导出为 DT XML\n        SQL_EXPORT_DT_XML \"mydb\", \"items\", \"output/items_schema.xml\", \"output/items_data.xml\"\n\n        SQL_DISCONNECT \"mydb\"\n        WAIT\n    ```"
  },
  {
    "id": "SQRT",
    "title": "SQRT",
    "names": [
      "SQRT"
    ],
    "signatures": [
      {
        "name": "SQRT",
        "params": "`int`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "返回参数的平方根。由于小数部分会被舍去，建议在使用前先将数值放大。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint SQRT int\n    ```\n    返回参数的平方根。由于小数部分会被舍去，建议在使用前先将数值放大。\n\n!!! hint \"提示\"\n\n    该函数同时支持指令和表达式函数两种用法。\n\n### 相关项目\n- CBRT, LOG, LOG10, EXPOMENT"
  },
  {
    "id": "STOPBGM",
    "title": "STOPBGM",
    "names": [
      "STOPBGM"
    ],
    "signatures": [
      {
        "name": "STOPBGM",
        "params": "`void`",
        "returns": "`void`",
        "engines": [
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "停止 PLAYBGM 正在播放的音轨。",
    "body": "!!! info \"API\"\n\n    ```erb\n    STOPBGM\n    ```\n\n    停止 `PLAYBGM` 正在播放的音轨。\n\n!!! hint \"提示\"\n\n    只能作为命令使用。\n\n### 相关项目\n- PLAYBGM"
  },
  {
    "id": "STOPCALLTRAIN",
    "title": "STOPCALLTRAIN",
    "names": [
      "STOPCALLTRAIN"
    ],
    "signatures": [
      {
        "name": "STOPCALLTRAIN",
        "params": "无",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "如果在 CALLTRAIN 指令正在运行时被调用，则会立即终止 CALLTRAIN 的处理。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tSTOPCALLTRAIN\n    ```\n\t如果在 `CALLTRAIN` 指令正在运行时被调用，则会立即终止 CALLTRAIN 的处理。\n\t其他情况下不执行任何操作。\n\n!!! hint \"提示\"\n\n    仅支持命令形式。\n\n### 相关项目\n- CALLTRAIN"
  },
  {
    "id": "STOPSOUND",
    "title": "STOPSOUND",
    "names": [
      "STOPSOUND"
    ],
    "signatures": [
      {
        "name": "STOPSOUND",
        "params": "`void`",
        "returns": "`void`",
        "engines": [
          "ee"
        ],
        "overloads": []
      }
    ],
    "summary": "停止 PLAYSOUND 正在播放的音轨。",
    "body": "!!! info \"API\"\n\n    ```erb\n    STOPSOUND\n    ```\n\n    停止 `PLAYSOUND` 正在播放的音轨。\n\n!!! hint \"提示\"\n\n    只能作为命令使用。\n\n### 相关项目\n- PLAYSOUND"
  },
  {
    "id": "STRCOUNT",
    "title": "STRCOUNT",
    "names": [
      "STRCOUNT"
    ],
    "signatures": [
      {
        "name": "STRCOUNT",
        "params": "`string`, `string`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "获取字符串中指定子字符串的数量的指令。将匹配的数量赋值给RESULT:0或返回该值。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint STRCOUNT string, searchWord\n    ```\n\t获取字符串中指定子字符串的数量的指令。将匹配的数量赋值给`RESULT:0`或返回该值。\n\t搜索字符串的格式遵循C#正则表达式的规范。\n\n!!! hint \"提示\"\n\n    支持指令和表达式函数两种用法。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tPRINTFORML 「も」的数目:{STRCOUNT(\"すもももももももものうち\", \"も\")}\n\t\tPRINTFORMW 半角数字的数目:{STRCOUNT(\"1日1歩 3日で3歩 3歩進んで2歩下がる\", \"[0-9]\")}\n    ```\n    ```text\n\t「も」的数目:8\n\t半角数字的数目:6\n    ```\n\n### 相关项目\n- STRFIND"
  },
  {
    "id": "STRDATA",
    "title": "STRDATA",
    "names": [
      "STRDATA",
      "DATA",
      "DATAFORM",
      "DATALIST",
      "ENDLIST",
      "ENDDATA"
    ],
    "signatures": [
      {
        "name": "STRDATA",
        "params": "`stringVariable`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "此指令用于将字符串赋值给指定的字符串型变量，而非使用 PRINTDATA 来显示字符串。",
    "body": "!!! info \"API\"\n\n    ```erb\n    STRDATA stringVariable\n        DATA\n        DATAFORM\n        DATALIST\n        ENDLIST\n    ENDDATA\n    ```\n    此指令用于将字符串赋值给指定的字符串型变量，而非使用 `PRINTDATA` 来显示字符串。\n    各格式与 `PRINTDATA` 相同，请参阅该页面。\n\n!!! hint \"提示\"\n\n    仅该指令同时支持两种用法。\n### 相关项目\n- PRINTDATA"
  },
  {
    "id": "STRFIND",
    "title": "STRFIND",
    "names": [
      "STRFIND",
      "STRFINDU"
    ],
    "signatures": [
      {
        "name": "STRFIND",
        "params": "`string`, `string`(, `int`)",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "STRFINDU",
        "params": "`string`, `string`(, `int`)",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "字符串搜索指令。",
    "body": "!!! info \"API\"\n\n    ```erb\n    int STRFIND string, searchWord(, startPosition)\n    int STRFINDU string, searchWord(, startPosition)\n    ```\n    字符串搜索指令。\n    第一参数指定被搜索的目标字符串，使用字符串表达式。第二参数指定要搜索的字符串，使用字符串表达式。\n    `STRFIND` 将全角字符计为2个字符，`STRFINDU` 将全角字符计为1个字符，并返回从0开始的索引。如果未找到，则返回-1。\n    自1.712版本起，STRFIND(U)指令可以指定第三参数。\n    第三参数指定搜索的起始位置，使用从0开始的索引。\n\n    ```erb\n    STRFIND \"abcdeabced\",\"a\",3\n    ```\n\n\t根据上一行的结果，`RESULT` 将被赋值为 `5`。\n\t虽然 `a` 也存在于位置 0，但由于指定了第三参数，搜索将从位置 3（即 `d`）开始，因此找到的第一个 `a` 位于位置 5。\n\n!!! hint \"提示\"\n\n    该功能同时支持命令形式和函数形式。\n\n!!! example \"例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tSTR:0 = abcdefghi\n\t\tSTR:1 = あいうえお\n\t\tSTR:2 = うえ\n\t\tSTRFIND STR:0, \"cde\"\n\t\tPRINTFORML <TEST1> = {RESULT:0}\n\t\tSTRFIND STR:1, \"いうえ\"\n\t\tPRINTFORML <TEST2> = {RESULT:0}\n\t\tSTRFIND STR:1, STR:2\n\t\tPRINTFORML <TEST3> = {RESULT:0}\n\t\tSTRFIND STR:1, \"か\"\n\t\tPRINTFORML <TEST4> = {RESULT:0}\n    ```\n    ```text\n\t<TEST1> = 2\n\t<TEST2> = 2\n\t<TEST3> = 4\n\t<TEST4> = -1\n    ```\n\n### 相关项目\n- STRCOUNT\n- SUBSTRING"
  },
  {
    "id": "STRFORM",
    "title": "STRFORM",
    "names": [
      "STRFORM",
      "STRFORMCHECK"
    ],
    "signatures": [
      {
        "name": "STRFORM",
        "params": "`string`",
        "returns": "`string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "将给定的字符串视为与PRINTFORM等相同的格式化字符串，并返回展开后的字符串。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tstring STRFORM formedString\n    ```\n    将给定的字符串视为与PRINTFORM等相同的格式化字符串，并返回展开后的字符串。\n\n!!! hint \"提示\"\n\n    同时支持指令和表达式函数两种形式。\n\n---\n\n# STRFORMCHECK [Skia]\n\n| 函数名 | 参数 | 返回值 |\n| :--- | :--- | :--- |\n| [Skia][`STRFORMCHECK`](./STRFORM.zh.md#strformcheck) | `string` | `integer` |\n\n!!! info \"API\"\n\n    ```erb\n\tint STRFORMCHECK formedString\n    ```\n    将给定的字符串视为与STRFORM相同的格式化字符串，判断其是否可展开。可展开返回 `1`，不可展开返回 `0`。\n\n    - 语法错误（如未闭合大括号）→ `0`\n    - 运行时求值失败（如变量不存在）→ `0`\n    - 与STRFORM共享同一套解析器，语义一致性有保证\n\n!!! warning \"注意\"\n\n    由于 `CanRestructure = false`，该函数不是常量折叠的候选。\n\n### 相关项目\n- GETVAR,GETVARS\n- GETMETH,GETMETHS"
  },
  {
    "id": "STRICT_FONT_FALLBACK",
    "title": "STRICT_FONT_FALLBACK",
    "names": [
      "STRICT_FONT_FALLBACK"
    ],
    "signatures": [
      {
        "name": "STRICT_FONT_FALLBACK",
        "params": "`int`",
        "returns": "void",
        "engines": [
          "skia"
        ],
        "overloads": []
      }
    ],
    "summary": "切换字体回退的严格模式。",
    "body": "!!! info \"API\"\n\n    ```erb\n    STRICT_FONT_FALLBACK value\n    ```\n\n    切换字体回退的严格模式。\n\n    - `value` 设为 `1` 启用严格模式，设为 `0` 禁用\n    - 严格模式启用时，指定字体中不存在字形的字符不会使用回退字体替代，而是显示为 □（tofu）\n    - 严格模式禁用（默认）时，不存在字形的字符会自动使用回退字体绘制\n\n!!! hint \"提示\"\n\n    该功能同时支持指令和表达式函数两种形式。\n\n!!! example \"例\"\n\n    ```erb\n    ; 启用严格模式（无字体回退）\n    STRICT_FONT_FALLBACK 1\n    PRINTL 此文本不会回退到其他字体\n    ; 禁用严格模式（默认回退行为）\n    STRICT_FONT_FALLBACK 0\n    ```\n\n### 関連項目\n- SETFONT\n- SKIA_RENDER"
  },
  {
    "id": "STRLEN",
    "title": "STRLEN系",
    "names": [
      "STRLEN",
      "STRLENS",
      "STRLENFORM",
      "STRLENU",
      "STRLENSU",
      "STRLENFORMU"
    ],
    "signatures": [
      {
        "name": "STRLEN",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "STRLENS",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "STRLENFORM",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "STRLENU",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "STRLENSU",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "STRLENFORMU",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "STRLEN、STRLENS、STRLENFORM 用于测量字符串长度，并将结果赋值给 RESULT:0。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tSTRLEN string\n\tint STRLENS string\n\tSTRLENFORM formedString\n\tSTRLENU string\n\tint STRLENSU string\n\tSTRLENFORMU formedString\n    ```\n\t`STRLEN`、`STRLENS`、`STRLENFORM` 用于测量字符串长度，并将结果赋值给 `RESULT:0`。\n\t长度以 `SHIFT-JIS` 编码的字节数为准。即全角字符按 2 个字符计数。\n\n\t`STRLENU`、`STRLENSU`、`STRLENFORMU` 是 Unicode 版本。区别在于全角字符也按 1 个字符计数。\n\n!!! hint \"提示\"\n\n    `STRLENS`、`STRLENSU` 支持在表达式中作为函数使用。\n\n!!! example \"例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tSTRLEN ABCあいう\n\t\tPRINTFORML <TEST1> = {RESULT}\n\t\tSTR:0 = ABCあいう\n\t\tSTRLENS STR:0\n\t\tPRINTFORML <TEST2> = {RESULT}\n\t\tSTRLENFORM abc%STR:0%\n\t\tPRINTFORML <TEST3> = {RESULT}\n\n\t\t;STRLENSは文字列式にも対応\n\t\tSTRLENS \"abc\" + STR:0\n\t\tPRINTFORML <TEST4> = {RESULT}\n\t\tWAIT\n    ```\n    ```text\n\t<TEST1> = 9\n\t<TEST2> = 9\n\t<TEST3> = 12\n\t<TEST4> = 12\n    ```"
  },
  {
    "id": "SUBSTRING",
    "title": "SUBSTRING",
    "names": [
      "SUBSTRING",
      "SUBSTRINGU"
    ],
    "signatures": [
      {
        "name": "SUBSTRING",
        "params": "`string`, `int`, `int`",
        "returns": "`string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "SUBSTRINGU",
        "params": "`string`, `int`, `int`",
        "returns": "`string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "返回指定字符串表达式中，从第一个参数指定的位置开始、长度为第二个参数指定字符数的子字符串。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tstring SUBSTRING string, startPosition, characterCount\n\tstring SUBSTRINGU string, startPosition, characterCount\n    ```\n\t返回指定字符串表达式中，从第一个参数指定的位置开始、长度为第二个参数指定字符数的子字符串。\n\t起始位置以字符串开头为`0`。如果指定的起始位置超过原字符串长度，则返回空字符串。\n\t对于字符数，`SUBSTRING` 以 SHIFT-JIS 编码的字节数指定。即全角字符计为2个字符。`SUBSTRINGU` 则以 Unicode 字符数计数，全角字符也计为1个字符。\n\t如果指定的字符数为负值，或者指定的结束位置超过原字符串末尾，则返回从起始位置到字符串末尾的字符串。\n\t如果起始位置或结束位置无法在字符边界处切割（例如指向全角字符的中间部分），则会被视为指定了下一个字符边界。\n\t请注意，这可能导致返回的子字符串长度比指定的字符数多一个字符。\n\n!!! hint \"提示\"\n\n    支持命令和表达式函数两种形式。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tSTR:0 = 01234あいうえお\n\t\tSUBSTRING STR:0, 0, -1\n\t\tPRINTFORML <TEST1> = %RESULTS:0%\n\t\tSUBSTRING STR:0, 1, 3\n\t\tPRINTFORML <TEST2> = %RESULTS:0%\n\t\tSUBSTRING STR:0, 6, 3\n\t\tPRINTFORML <TEST3> = %RESULTS:0%\n\t\tWAIT\n    ```\n    ```text\n\t<TEST1> = 01234あいうえお\n\t<TEST2> = 123\n\t<TEST3> = いう\n    ```\n\n### 相关项目\n- STRFIND"
  },
  {
    "id": "SUMARRAY",
    "title": "SUMARRAY",
    "names": [
      "SUMARRAY"
    ],
    "signatures": [
      {
        "name": "SUMARRAY",
        "params": "`integerArray`(, `int`, `int`)",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "此函数用于返回数组值的总和。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint SUMARRAY integerArray(, startIndex, endIndex)\n    ```\n\t此函数用于返回数组值的总和。\n\t指定 `integerArray` 为要求总和的1维数值型数组，并合计 `startIndex` 以上、`endIndex` 未满的元素范围。\n\t若省略 `endIndex`，则合计至数组末尾。\n\t`RESULT = SUMARRAY(X, A, B)` 的结果等同于：\n\n\t\tRESULT = 0\n\t\tFOR COUNT, A, B\n\t\t\tRESULT += X:COUNT\n\t\tREND\n\n\t请注意，被加算的值到 `X:(B - 1)` 为止，`X:B` 不会被加算。\n\t`integerArray` 仅可指定数值型1维数组变量，不能指定字符串变量或多维数组。\n\t若为 `integerArray` 指定了 `CFLAG` 等角色数组，则仅合计指定的角色。\n\n!!! hint \"提示\"\n\n    命令和表达式函数两种形式均支持。"
  },
  {
    "id": "SWAP",
    "title": "SWAP",
    "names": [
      "SWAP"
    ],
    "signatures": [
      {
        "name": "SWAP",
        "params": "`variable`, `variable`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "交换变量1和变量2的内容。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tSWAP variable, variable\n    ```\n\t交换变量1和变量2的内容。\n\t用于交换的两个变量必须是相同类型（整数型与整数型、字符串型与字符串型）。\n\n!!! hint \"提示\"\n\n    仅支持作为指令使用。\n\n!!! example \"例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\t#DIM AAA\n\t\t#DIM BBB\n\n\t\tAAA = 123\n\t\tBBB = 456\n\n\t\tREPEAT 2\n\t\t\tPRINTFORML AAA:{AAA} BBB:{BBB}\n\t\t\tSWAP AAA, BBB\n\t\tREND\n\t\tWAIT\n    ```\n    ```text\n\tAAA:123 BBB:456\n\tAAA:456 BBB:123\n    ```"
  },
  {
    "id": "SWAPCHARA",
    "title": "SWAPCHARA",
    "names": [
      "SWAPCHARA"
    ],
    "signatures": [
      {
        "name": "SWAPCHARA",
        "params": "`int`, `int`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "交换指定两个角色的登记编号 (CharaID)。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tSWAPCHARA charaID, charaID\n    ```\n    交换指定两个角色的登记编号 (CharaID)。\n\n!!! hint \"提示\"\n\n    仅支持指令形式。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\t;假设初始只有MASTER\n\t\tADDCHARA 10\n\t\tADDCHARA 11\n\t\tPRINTFORML NO:1 = {NO:1}, NO:2 = {NO:2}\n\t\tSWAPCHARA 1,2\n\t\tPRINTFORMW NO:1 = {NO:1}, NO:2 = {NO:2}\n    ```\n    ```text\n\tNO:1 = 10, NO:2 = 11\n\tNO:1 = 11, NO:2 = 10\n    ```\n\n### 相关项目\n- SORTCHARA"
  },
  {
    "id": "TEXT_BGC",
    "title": "TEXT_BGC_ON / TEXT_BGC_OFF",
    "names": [
      "TEXT_BGC_ON",
      "TEXT_BGC_OFF",
      "TEXT_BGC"
    ],
    "signatures": [
      {
        "name": "TEXT_BGC_ON",
        "params": "`int`, `int`, `int`, `int`",
        "returns": "void",
        "engines": [
          "skia"
        ],
        "overloads": []
      },
      {
        "name": "TEXT_BGC_OFF",
        "params": "无",
        "returns": "void",
        "engines": [
          "skia"
        ],
        "overloads": []
      }
    ],
    "summary": "TEXTBGCON 为后续所有行设置整行背景色。TEXTBGCOFF 清除背景色，恢复透明。",
    "body": "!!! info \"API\"\n\n    ```erb\n    TEXT_BGC_ON R, G, B, Alpha%\n    TEXT_BGC_OFF\n    ```\n\n    `TEXT_BGC_ON` 为后续所有行设置**整行**背景色。`TEXT_BGC_OFF` 清除背景色，恢复透明。\n\n    - `R`, `G`, `B`：背景色的 RGB 值（0～255）\n    - `Alpha%`：不透明度（0～100）。0=完全透明，100=完全不透明\n    - 背景以行全宽（`ClientWidth`）× 行高（`LineHeight`）的矩形绘制\n    - 仅当行内存在实际文本时才绘制背景（空行不绘制）\n    - 设置在调用 `TEXT_BGC_OFF` 之前持续生效\n\n!!! warning \"注意\"\n\n    - 背景色以**行**为单位应用。如需单个文字或 span 级别的背景色，请使用 HTML 内联样式\n    - 不支持嵌套（save/restore）。设置新颜色会覆盖旧颜色\n\n!!! example \"例\"\n\n    ```erb\n    ; 红色背景显示警告文本\n    TEXT_BGC_ON 255, 0, 0, 30\n    PRINTL 警告：HP已降低！\n    TEXT_BGC_OFF\n\n    ; 半透明蓝色背景\n    TEXT_BGC_ON 0, 0, 128, 50\n    PRINTL 这行有蓝色背景\n    PRINTL 这行也是同样的背景色\n    TEXT_BGC_OFF\n    ```\n\n### 関連項目\n- SETCOLOR\n- SETBGCOLOR\n- HTML_PRINT"
  },
  {
    "id": "TEXTBOX",
    "title": "输入框相关命令",
    "names": [
      "SETTEXTBOX",
      "GETTEXTBOX",
      "MOVETEXTBOX",
      "RESUMETEXTBOX",
      "TEXTBOX"
    ],
    "signatures": [
      {
        "name": "SETTEXTBOX",
        "params": "`string`",
        "returns": "`1`",
        "engines": [
          "ee"
        ],
        "overloads": []
      },
      {
        "name": "GETTEXTBOX",
        "params": "无",
        "returns": "`string`",
        "engines": [
          "ee"
        ],
        "overloads": []
      },
      {
        "name": "MOVETEXTBOX",
        "params": "`int`, `int`, `int`",
        "returns": "`1`",
        "engines": [
          "em"
        ],
        "overloads": []
      },
      {
        "name": "RESUMETEXTBOX",
        "params": "无",
        "returns": "`1`",
        "engines": [
          "em"
        ],
        "overloads": []
      }
    ],
    "summary": "命令 / 行内函数两种写法均有效。",
    "body": "!!! info \"API\"\n\n    ```erb\n    1 SETTEXTBOX text\n    string GETTEXTBOX\n    1 MOVETEXTBOX xPos, yPos, width\n    1 RESUMETEXTBOX\n    ```\n\n    - `SETTEXTBOX`：将输入框内容替换为 `text`。\n    - `GETTEXTBOX`：返回执行时输入框内的字符串。\n    - `MOVETEXTBOX`：下次执行 `INPUT` / `INPUTS` 时将输入框移的宽度设置为`width`，并移动端指定位置。\n        - 基准位置 (`xPos`, `yPos`) = (`0`, `0`) 为画面左下角。`yPos` 为正时向上移动。\n        - 画面向上卷动（浏览历史记录）时，输入框会暂时返回原本位置。\n        - `INPUT` / `INPUTS` 结束后，输入框返回原本位置。\n    - `RESUMETEXTBOX`：无效上一次 `MOVETEXTBOX` 的设置，令输入框返回原本位置。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。"
  },
  {
    "id": "THROW",
    "title": "THROW",
    "names": [
      "THROW"
    ],
    "signatures": [
      {
        "name": "THROW",
        "params": "`string`",
        "returns": "无",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "此命令会强制引发错误，并使用给定的参数字符串进行错误显示。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tTHROW formedString\n    ```\n    此命令会强制引发错误，并使用给定的参数字符串进行错误显示。\n\n!!! hint \"提示\"\n\n    仅支持作为命令使用。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\tTHROW お気の毒ですが、冒険の書は消えてしまいました\n    ```\n    ```text\n\tNow Loading...\n\tMAIN.ERB第2行发生THROW\n\tTHROW お気の毒ですが、冒険の書は消えてしまいました\n\tTHROW内容：お気の毒ですが、冒険の書は消えてしまいました\n\t当前函数：@SYSTEM_TITLE（MAIN.ERB第1行）\n\t函数调用栈：\n\t※※※日志文件已输出至emuera.log※※※\n    ```"
  },
  {
    "id": "TIMES",
    "title": "TIMES",
    "names": [
      "TIMES"
    ],
    "signatures": [
      {
        "name": "TIMES",
        "params": "`int`, `float`",
        "returns": "无",
        "engines": [
          "eramaker"
        ],
        "overloads": []
      }
    ],
    "summary": "将第二参数的浮点数乘以第一参数的变量。默认设置下会舍去小数部分。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tTIMES integerVariable, float\n    ```\n    将第二参数的浮点数乘以第一参数的变量。默认设置下会舍去小数部分。\n\n!!! hint \"提示\"\n\n    仅支持作为指令使用。\n\n!!! example \"示例\"\n\n    ```erb\n    @SYSTEM_TITLE\n\t\t#DIM HOGE\n\n\t\tHOGE = 100\n\t\tTIMES HOGE, 1.25\n\t\tPRINTFORML {HOGE}\n\t\tTIMES HOGE, 2.672\n\t\tPRINTFORMW {HOGE}\n    ```\n    ```text\n\t125\n\t334\n    ```"
  },
  {
    "id": "TINPUT",
    "title": "TINPUT(S)",
    "names": [
      "TINPUT",
      "TINPUTS"
    ],
    "signatures": [
      {
        "name": "TINPUT",
        "params": "`int`, `int`(, `int`, `string`, `int`)",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "TINPUTS",
        "params": "`int`, `int`(, `int`, `string`, `int`)",
        "returns": "`string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "这是带有时间限制的输入接收命令。第一个参数是时间限制（毫秒），但即使设置小于100ms的值也无法精确运作。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tTINPUT timeLimit, defaultValue(, displayTimeRemain, timeOverMessage, allowClick)\n\tTINPUTS timeLimit, defaultValue(, displayTimeRemain, timeOverMessage, allowClick)\n    ```\n\t这是带有时间限制的输入接收命令。第一个参数是时间限制（毫秒），但即使设置小于100ms的值也无法精确运作。\n\t第二个参数是超时时的默认返回值。\n\t第三个参数控制是否显示剩余时间，0为不显示，其他值为显示。省略时默认为1（显示）。\n\t第四个参数是超时时显示的字符串。如果为空字符串，则会清除计时器显示并继续执行后续处理。\n\t请注意，如果设置了第四个参数，则不能省略第三个参数。\n\t此外，在`TINPUTS`中，与`INPUTS`一样，可以使用宏表达式。\n\t若要在字符串中使用`()`，请使用``进行转义。\n\n    EM+EE中可设置可选的第五个参数。\n    非0时，将鼠标点击视为回车键（向`RESULTS`赋值空字符串。若按下按钮，则将按钮索引赋值给`RESULTS:1`），左键点击时`RESULT:1`设为`1`，右键点击时`RESULT:1`设为`2`。同时，若按下++shift++、++ctrl++、++alt++，则将其按键状态保存至`RESULT:2`。（bit 16 17 18）\n\n!!! hint \"提示\"\n\n    仅支持指令。\n\n### 相关项目\n- INPUT\n- TINPUTNF\n- TONEINPUT"
  },
  {
    "id": "TINPUTNF",
    "title": "TINPUT(S)NF",
    "names": [
      "TINPUTNF",
      "TINPUTSNF"
    ],
    "signatures": [
      {
        "name": "TINPUTNF",
        "params": "`int`, `int`(, `int`, `string`, `int`)",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "TINPUTSNF",
        "params": "`int`, `int`(, `int`, `string`, `int`)",
        "returns": "`string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "与 TINPUT / TINPUTS 功能完全相同，但不强制滚动到底部。",
    "body": "!!! info \"API\"\n\n    ```erb\n    TINPUTNF timeLimit, defaultValue(, displayTimeRemain, timeOverMessage, allowClick)\n    TINPUTSNF timeLimit, defaultValue(, displayTimeRemain, timeOverMessage, allowClick)\n    ```\n    与 `TINPUT` / `TINPUTS` 功能完全相同，但**不强制滚动到底部**。\n\n    NF = NoFocus。执行时进入 `WaitInputNoFocus` 状态，与 `WaitInput` 的唯一区别是不调用文本框定位，因此用户可以自由滚动浏览历史输出。\n\n    效果：\n    - ✅ 按钮高亮和 Tooltip 正常工作\n    - ✅ 输入可靠性（引擎原生输入管线）\n    - ✅ 用户可自由滚动，滚动位置不会被强制拉回底部\n    - ✅ 超时机制与原版 TINPUT 相同\n\n    参数和返回值与原版完全一致，参见 `TINPUT` / `TINPUTS`。\n\n!!! hint \"提示\"\n\n    仅支持指令。\n\n### 典型用途\n\n需要定时刷新界面但又不希望强制滚动的场景——例如动态地图动画、实时标题画面等。\n\n```erb\n; 动态地图动画：每帧刷新，按钮可点击，用户可自由滚动\n$MAP_LOOP\nCALL DRAW_MAP\nIF ANIM_INTERVAL > 0\n    TINPUTSNF ANIM_INTERVAL, \"UPDATE\", 0, \"\"\nELSE\n    INPUTS\nENDIF\nSELECTCASE RESULTS\nCASE \"UPDATE\"\n    ; 超时 → 刷新动画帧\n    GOTO MAP_LOOP\nCASEELSE\n    ; 用户点击按钮 → 正常处理\nENDSELECT\n```\n\n### 相关项目\n- TINPUT\n- TONEINPUTNF\n- AWAIT"
  },
  {
    "id": "TOINT",
    "title": "TOINT, ISNUMERIC, TOFLOAT",
    "names": [
      "TOINT",
      "ISNUMERIC",
      "TOFLOAT"
    ],
    "signatures": [
      {
        "name": "TOINT",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "ISNUMERIC",
        "params": "`string`",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "TOFLOAT",
        "params": "`string`",
        "returns": "`float`",
        "engines": [
          "skia"
        ],
        "overloads": []
      }
    ],
    "summary": "TOINT 将参数字符串数值化，并将结果赋值给 RESULT:0 或直接返回。但是，只有由半角数字构成的字符串才能被数值化。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tint TOINT string\n\tint ISNUMERIC string\n    ```\n    `TOINT` 将参数字符串数值化，并将结果赋值给 `RESULT:0` 或直接返回。但是，只有由半角数字构成的字符串才能被数值化。\n    如果参数无法被解释为数值，则将 `0` 赋值给 `RESULT:0` 或直接返回。全角数字的情况也同样处理。\n    当传入的值不确定时，在 `TOINT` 之前使用 `ISNUMERIC` 可以提高代码的稳定性。\n\n    `ISNUMERIC` 用于判断字符串是否可以被解析为数值（即是否可以通过 `TOINT` 获取值）。\n    如果参数可以被解释为数值，则将 `1` 赋值给 `RESULT:0` 或直接返回；否则，赋值或返回 `0`。\n\n!!! hint \"提示\"\n\n    该函数同时支持作为指令和表达式函数使用。\n\n!!! example \"例\"\n\n    ```erb\n    @SYSTEM_TITLE\n        #DIMS HOGES\n        REPEAT 3\n            SELECTCASE COUNT\n                CASE 0\n                    HOGES = 123\n                CASE 1\n                    HOGES = 一二三\n                CASE 2\n                    HOGES = １２３\n            ENDSELECT\n            IF ISNUMERIC(HOGES)\n                PRINTFORML 变量HOGES可以转换为数值类型({TOINT(HOGES)})\n            ELSE\n                PRINTFORML 变量HOGES无法转换为数值类型(%HOGES%)\n            ENDIF\n        REND\n        WAIT\n    ```\n    ```text\n    变量HOGES可以转换为数值类型(123)\n    变量HOGES无法转换为数值类型(一二三)\n    变量HOGES无法转换为数值类型(１２３)\n    ```\n\n!!! info \"API — TOFLOAT\"\n\n    [Skia] Skia 新增\n\n    ```erb\n\tfloat TOFLOAT string\n    ```\n    将字符串转换为浮点数。\n    将参数字符串解释为浮点数，并将结果赋值给 `RESULTF:0` 或直接返回。\n    如果参数无法被解释为数值，则将 `0.0` 赋值给 `RESULTF:0` 或直接返回。\n\n!!! hint \"提示\"\n\n    该函数同时支持作为指令和表达式函数使用。\n\n!!! example \"例\"\n\n    ```erb\n    @SYSTEM_TITLE\n        #DIMF L_F\n        L_F = TOFLOAT(\"3.14\")          ; → 3.14\n        L_F = TOFLOAT(\"-1.5e2\")        ; → -150.0\n        L_F = TOFLOAT(\"abc\")           ; → 0.0（解析失败）\n        PRINTFORML {L_F}\n        WAIT\n    ```\n    ```text\n    0.0\n    ```\n\n### 相关项目\n- TOSTR"
  },
  {
    "id": "TONEINPUT",
    "title": "TONEINPUT",
    "names": [
      "TONEINPUT",
      "TONEINPUTS"
    ],
    "signatures": [
      {
        "name": "TONEINPUT",
        "params": "`int`, `int`(, `int`, `string`, `int`)",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "TONEINPUTS",
        "params": "`int`, `string`(, `int`, `string`, `int`)",
        "returns": "`string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "参数分别与 TINPUT、TINPUTS 相同。",
    "body": "!!! info \"API\"\n\n    ```erb\n\tTONEINPUT timeLimit, defaultValue(, displayTimeRemain, timeOverMessage, allowClick)\n\tTONEINPUTS timeLimit, defaultValue(, displayTimeRemain, timeOverMessage, allowClick)\n    ```\n\t参数分别与 `TINPUT`、`TINPUTS` 相同。\n\t这是兼具 `ONEINPUT` 与 TINPUT、`ONEINPUTS` 与 TINPUTS 性质的输入接收命令。\n\t使用这些命令时，即使在 Emuera 的 CONFIG 设置中启用了键盘宏功能，\n\t也可能出现无法正常工作的情况，这是已知的特性。\n\t此外，在 `TONEINPUTS` 中，与 `INPUTS` 一样，可以使用宏表达式。\n\t若要在字符串中使用 `()`，请使用 `\\` 进行转义。\n\n\t在EM+EE中，第5个参数变为可选设置。\n\t当该参数非0时，将鼠标点击视为回车键（向`RESULTS`赋值空字符串。若按下按钮，则将按钮的索引赋值给`RESULTS:1`），左键点击时`RESULT:1`设为`1`，右键点击时`RESULT:1`设为`2`。同时，若按下++shift++、++ctrl++、++alt++键，则将该按键状态保存到`RESULT:2`中。（bit 16 17 18）\n\n!!! hint \"提示\"\n\n    仅支持命令形式。\n\n### 相关项目\n- TINPUT\n- ONEINPUT"
  },
  {
    "id": "TONEINPUTNF",
    "title": "TONEINPUT(S)NF",
    "names": [
      "TONEINPUTNF",
      "TONEINPUTSNF"
    ],
    "signatures": [
      {
        "name": "TONEINPUTNF",
        "params": "`int`, `int`(, `int`, `string`, `int`)",
        "returns": "`int`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      },
      {
        "name": "TONEINPUTSNF",
        "params": "`int`, `string`(, `int`, `string`, `int`)",
        "returns": "`string`",
        "engines": [
          "emuera"
        ],
        "overloads": []
      }
    ],
    "summary": "与 TONEINPUT / TONEINPUTS 功能完全相同，但不强制滚动到底部。",
    "body": "!!! info \"API\"\n\n    ```erb\n    TONEINPUTNF timeLimit, defaultValue(, displayTimeRemain, timeOverMessage, allowClick)\n    TONEINPUTSNF timeLimit, defaultValue(, displayTimeRemain, timeOverMessage, allowClick)\n    ```\n    与 `TONEINPUT` / `TONEINPUTS` 功能完全相同，但**不强制滚动到底部**。\n\n    NF = NoFocus。执行时进入 `WaitInputNoFocus` 状态，与 `WaitInput` 的唯一区别是不调用文本框定位，因此用户可以自由滚动浏览历史输出。\n\n    效果：\n    - ✅ 按钮高亮和 Tooltip 正常工作\n    - ✅ 输入可靠性（引擎原生输入管线）\n    - ✅ 用户可自由滚动，滚动位置不会被强制拉回底部\n    - ✅ 超时机制与原版 TONEINPUT 相同\n\n    参数和返回值与原版完全一致，参见 `TONEINPUT` / `TONEINPUTS`。\n\n!!! hint \"提示\"\n\n    仅支持命令形式。\n\n### 典型用途\n\n需要定时刷新界面但又不希望强制滚动的场景——例如动态地图动画、实时标题画面等。\n\n```erb\n; 动态地图动画：每帧刷新，按钮可点击，用户可自由滚动\n$MAP_LOOP\nCALL DRAW_MAP\nIF ANIM_INTERVAL > 0\n    TONEINPUTSNF ANIM_INTERVAL, \"UPDATE\", 0, \"\"\nELSE\n    INPUTS\nENDIF\nSELECTCASE RESULTS\nCASE \"UPDATE\"\n    ; 超时 → 刷新动画帧\n    GOTO MAP_LOOP\nCASEELSE\n    ; 用户点击按钮 → 正常处理\nENDSELECT\n```\n\n### 相关项目\n- TONEINPUT\n- TONEINPUTS\n- TINPUTNF\n- AWAIT"
  }
];
