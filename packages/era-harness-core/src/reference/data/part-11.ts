// 本文件由 scripts/build-reference.ts 生成，请勿手工修改。
//
// 数据来源：https://github.com/qirchen421/emuera.sk.doc  docs/Reference、docs/Emuera、docs/tutorial/*.zh.md
// 上游版本：41451be6091363e37ed066aaf04416decbf0127f
// 许可：CC BY-NC 4.0（http://creativecommons.org/licenses/by-nc/4.0/）
//       与本仓库代码的 Apache-2.0 分开管理，见 NOTICE-emuera-sk-doc.md
import type { ReferenceEntry } from '../types.js';

export const ENTRIES_PART_11: readonly ReferenceEntry[] = [
  {
    "id": "XML_REMOVENODE",
    "title": "XML_REMOVENODE 系列",
    "names": [
      "XML_REMOVENODE",
      "XML_REMOVENODE_BYNAME"
    ],
    "signatures": [
      {
        "name": "XML_REMOVENODE",
        "params": "`int`, `string`(, `int`)",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": [
          "`ref` `string`, `string`(, `int`)"
        ]
      },
      {
        "name": "XML_REMOVENODE_BYNAME",
        "params": "`string`, `string`(, `int`)",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      }
    ],
    "summary": "从指定的 XML 中删除（根节点除外）xpath 选择的节点（详见 XPath 的介绍）。",
    "body": "!!! info \"API\"\n\n    ```erb\n    1. int XML_REMOVENODE xmlId, xpath(, doSetAll)\n    2. int XML_REMOVENODE ref xml, xpath(, doSetAll)\n    3. int XML_REMOVENODE_BYNAME xmlName, xpath(, doSetAll)\n    ```\n    从指定的 `XML` 中删除（根节点除外）`xpath` 选择的节点（详见 [`XPath` 的介绍](https://www.octoparse.jp/blog/xpath-introduction)）。\n    当 `xpath` 的匹配结果存在多个时，必须将参数 `doSetAll` 设为 `0` 以外的数值才能成功删除节点。\n    删除节点成功时，返回已删除节点的数量；失败时返回 `0`。\n\n    1.  从以 `xmlId` 的字符串转换结果([`TOSTR`](https://osdn.net/projects/emuera/wiki/exmeth#h5-str.20TOSTR.28int.20value.2C.20str.20format.20.3D.20.22.22.29))为 ID 而指定的 [`XmlDocument`](https://docs.microsoft.com/zh-cn/dotnet/api/system.xml.xmldocument?view=netframework-4.8) 中检索元素。若指定的 `XmlDocument` 不存在，返回 `-1`。\n    2. 从指定的 `xml` 内容中检索元素，并将新的结果重新赋值给 `xml`；`xml` 必须是变量。\n    3. 从以 `xmlName` 为 ID 而指定的 `XmlDocument` 中检索元素。若指定的 `XmlDocument` 不存在，返回 `-1`。\n\n    !!! warning \"注意\"\n\n        获取的 XML 不是真正的 `XmlNode` 节点实例，因此在 `xpath` 的开头使用「`//`」快捷表示方法并不会生效。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        #DIMS xml = \"<xml><brother/><brother/><sister/></xml>\"\n\n        XML_DOCUMENT 0, xml\n        PRINTFORML {XML_REMOVENODE(xml, \"/xml/brother\", 1)} -> %xml%\n\n        PRINTFORML {XML_REMOVENODE(0, \"/xml/sister\", 1)}\n        PRINTSL XML_TOSTR(0)\n\n        ONEINPUT\n    ```\n    ```text\n    2 -> <xml><sister /></xml>\n    1\n    <xml><brother /><brother /></xml>\n    ```",
    "sourcePath": "docs/Reference/XML_REMOVENODE.zh.md"
  },
  {
    "id": "XML_REPLACE",
    "title": "XML_REPLACE 系列",
    "names": [
      "XML_REPLACE",
      "XML_REPLACE_BYNAME"
    ],
    "signatures": [
      {
        "name": "XML_REPLACE",
        "params": "`any`, `string`",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": [
          "`int`, `string`, `string`(, `int`)",
          "`ref` `string`, `string`, `string`(, `int`)"
        ]
      },
      {
        "name": "XML_REPLACE_BYNAME",
        "params": "`string`, `string`, `string`(, `int`)",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      }
    ],
    "summary": "从指定的 XML 中将 xpath 选择的节点（详见 XPath 的介绍）替换为参数 newXml（新的 XML 文本）。当 xpath 的匹配结果存在多个时，必须将参数 doSetAll 设为 0 以外的数值才能成功更新节点。更新节点成功时，返回已更新节点的数量；失败时返回 0。",
    "body": "!!! info \"API\"\n\n    ```erb\n    1. int XML_REPLACE xmlId, newXml\n    2. int XML_REPLACE xmlId, xpath, newXml(, doSetAll)\n    3. int XML_REPLACE ref xml, xpath, newXml(, doSetAll)\n    4. int XML_REPLACE_BYNAME xmlName, xpath, newXml(, doSetAll)\n    ```\n    从指定的 `XML` 中将 `xpath` 选择的节点（详见 [`XPath` 的介绍](https://www.octoparse.jp/blog/xpath-introduction)）替换为参数 `newXml`（新的 XML 文本）。当 `xpath` 的匹配结果存在多个时，必须将参数 `doSetAll` 设为 `0` 以外的数值才能成功更新节点。更新节点成功时，返回已更新节点的数量；失败时返回 `0`。\n\n    1. 将 `xmlId` 指定的 [`XmlDocument`](https://docs.microsoft.com/zh-cn/dotnet/api/system.xml.xmldocument?view=netframework-4.8) 从根节点开始全部替换为 `newXml`。若指定的 `XmlDocument` 不存在，返回 `-1`。若 `xmlId` 为整数，则使用其字符串转换结果值([`TOSTR`](https://osdn.net/projects/emuera/wiki/exmeth#h5-str.20TOSTR.28int.20value.2C.20str.20format.20.3D.20.22.22.29))。\n    2. 从以 `xmlId` 的字符串转换结果(`TOSTR`)为 ID 而指定的 `XmlDocument` 中检索元素。若指定的 `XmlDocument` 不存在，返回 `-1`。\n    3. 从指定的 `xml` 内容中检索元素节点进行替换，并将新的结果重新赋值给 `xml`；`xml` 必须是变量。\n    4. 从以 `xmlName` 为 ID 而指定的 `XmlDocument` 中检索元素。若指定的 `XmlDocument` 不存在，返回 `-1`。\n\n    !!! warning \"注意\"\n\n        获取的 XML 不是真正的 `XmlNode` 节点实例，因此在 `xpath` 的开头使用「`//`」快捷表示方法并不会生效。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        #DIMS xml = \"<xml/>\"\n\n        XML_DOCUMENT 0, xml\n        PRINTFORML {XML_REPLACE(0, \"<xml><boy/></xml>\")} -> %XML_TOSTR(0)%\n        PRINTFORML {XML_REPLACE(0, \"/xml/boy\", \"<girl/>\")} -> %XML_TOSTR(0)%\n\n        ONEINPUT\n    ```\n    ```text\n    1 -> <xml><boy /></xml>\n    1 -> <xml><girl /></xml>\n    ```",
    "sourcePath": "docs/Reference/XML_REPLACE.zh.md"
  },
  {
    "id": "XML_SET",
    "title": "XML_SET 系列",
    "names": [
      "XML_SET",
      "XML_SET_BYNAME"
    ],
    "signatures": [
      {
        "name": "XML_SET",
        "params": "`int`, `string`, `string`(, `int`, `int`)",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": [
          "`ref` `string`, `string`, `string`(, `int`, `int`)"
        ]
      },
      {
        "name": "XML_SET_BYNAME",
        "params": "`string`, `string`, `string`(, `int`, `int`)",
        "returns": "`int`",
        "engines": [
          "em"
        ],
        "overloads": []
      }
    ],
    "summary": "从指定的 XML 中将 xpath 选择的节点（详见 XPath 的介绍）内容设为 value。当 xpath 的匹配结果存在多个时，必须将参数 doSetAll 设为 0 以外的数值才能成功更新节点。更新节点成功时，返回已更新节点的数量；失败时返回 0。",
    "body": "!!! info \"API\"\n\n    ```erb\n    1. int XML_SET xmlId, xpath, value(, doSetAll, outputType)\n    2. int XML_SET ref xml, xpath, value(, doSetAll, outputType)\n    3. int XML_SET_BYNAME xmlName, xpath, value(, doSetAll, outputType)\n    ```\n    从指定的 `XML` 中将 `xpath` 选择的节点（详见 [`XPath` 的介绍](https://www.octoparse.jp/blog/xpath-introduction)）内容设为 `value`。当 `xpath` 的匹配结果存在多个时，必须将参数 `doSetAll` 设为 `0` 以外的数值才能成功更新节点。更新节点成功时，返回已更新节点的数量；失败时返回 `0`。\n\n    1. 从以 `xmlId` 的字符串转换结果([`TOSTR`](https://osdn.net/projects/emuera/wiki/exmeth#h5-str.20TOSTR.28int.20value.2C.20str.20format.20.3D.20.22.22.29))为 ID 而指定的 [`XmlDocument`](https://docs.microsoft.com/zh-cn/dotnet/api/system.xml.xmldocument?view=netframework-4.8) 中检索元素节点进行更新。若指定的 `XmlDocument` 不存在，返回 `-1`。\n    2. 从指定的 `xml` 内容中检索元素节点进行更新，并将新的结果重新赋值给 `xml`；`xml` 必须是变量。\n    3. 从以 `xmlName` 为 ID 而指定的 `XmlDocument` 中检索元素节点进行更新。若指定的 `XmlDocument` 不存在，返回 `-1`。\n\n    根据参数 `outputType` 的值决定返回结果的类型：\n\n    - `1`: 节点的 `InnerText`\n    - `2`: 节点的 `InnerXml`\n    - 其他值或直接省略: 节点的 `Value`\n\n    !!! warning \"注意\"\n\n        获取的 XML 不是真正的 `XmlNode` 节点实例，因此在 `xpath` 的开头使用「`//`」快捷表示方法并不会生效。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n        #DIMS xml = \"<test><file name='A.txt'>InnerText内容A</file><a>A</a></test>\"\n\n        ; 直接从字符串中检索节点\n        PRINTFORML 匹配结果数量：{XML_SET(xml, \"/test/*\", \"B\", 1, 1)}\n        PRINTSL xml\n        XML_DOCUMENT 0, xml\n\n        ; 从 XmlDocument 中检索节点\n        PRINTFORML 匹配结果数量：{XML_SET(0, \"/test/file/@name\", \"X.xml\")}\n        XML_GET 0, \"/test/file/@name\", 1\n        PRINTSL RESULTS\n\n        ONEINPUT\n    ```\n    ```text\n    匹配结果数量：2\n    <test><file name=\"A.txt\">B</file><a>B</a></test>\n    匹配结果数量：1\n    X.xml\n    ```",
    "sourcePath": "docs/Reference/XML_SET.zh.md"
  },
  {
    "id": "XML_TOSTR",
    "title": "XML_TOSTR",
    "names": [
      "XML_TOSTR"
    ],
    "signatures": [
      {
        "name": "XML_TOSTR",
        "params": "`any`",
        "returns": "`string`",
        "engines": [
          "em"
        ],
        "overloads": []
      }
    ],
    "summary": "以 XML 文本形式返回 xmlId 指定的 XmlDocument 中保存的内容。若 xmlId 为整数，则使用其字符串转换结果值(TOSTR)。",
    "body": "!!! info \"API\"\n\n    ```erb\n    string XML_TOSTR xmlId\n    ```\n    以 XML 文本形式返回 `xmlId` 指定的 [`XmlDocument`](https://docs.microsoft.com/zh-cn/dotnet/api/system.xml.xmldocument?view=netframework-4.8) 中保存的内容。若 `xmlId` 为整数，则使用其字符串转换结果值([`TOSTR`](https://osdn.net/projects/emuera/wiki/exmeth#h5-str.20TOSTR.28int.20value.2C.20str.20format.20.3D.20.22.22.29))。\n\n!!! hint \"提示\"\n\n    命令 / 行内函数两种写法均有效。\n\n!!! example \"示例代码\"\n\n    ```erb\n    @SYSTEM_TITLE\n\n        XML_DOCUMENT 0, \"<xml/>\"\n\n        PRINTSL XML_TOSTR(0)\n\n        ONEINPUT\n    ```\n    ```text\n    <xml />\n    ```",
    "sourcePath": "docs/Reference/XML_TOSTR.zh.md"
  }
];
