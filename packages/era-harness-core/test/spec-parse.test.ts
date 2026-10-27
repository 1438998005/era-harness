import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractDirectiveNames,
  parseSpecPage,
  splitSections,
} from '../src/reference/spec-parse.js';

/**
 * 夹具按 `docs/Emuera/function.zh.md` 的真实形态缩编：
 * 带 frontmatter、`##` 分组、`##` 下的引导句、一条标题挂两条指令、
 * 带锚点的无名标题、以及围栏里伪装的 `###`。
 */
const FIXTURE = `---
hide:
  - toc
---

# 函数·预处理器

## 特殊函数

### \`@EVENTLOAD\`

在读取存档后调用。

## 定义

在函数中记录以 \`#\` 开头的预处理器时，必须紧接在函数下方。

### \`#LOCALSIZE <常量表达式>\`,\`#LOCALSSIZE <常量表达式>\`

为每个函数单独指定\`LOCAL\`和\`LOCALS\`元素数量的预处理器。

常量表达式的结果必须是大于0的整数，其他情况会被忽略。

### \`#DIM\`

用户定义变量声明。

\`\`\`erb
#DIM MYVAR, 10
### 这不是标题
\`\`\`

### 格式

补充说明：格式是 \`#DIM 变量名, 元素数\`。
`;

test('extractDirectiveNames：一条标题挂两条指令', () => {
  assert.deepEqual(extractDirectiveNames('`#LOCALSIZE <常量表达式>`,`#LOCALSSIZE <常量表达式>`'), [
    '#LOCALSIZE',
    '#LOCALSSIZE',
  ]);
});

test('extractDirectiveNames：四种名字形态都能认', () => {
  assert.deepEqual(extractDirectiveNames('`#DIM`'), ['#DIM']);
  assert.deepEqual(extractDirectiveNames('`@EVENTLOAD`'), ['@EVENTLOAD']);
  assert.deepEqual(extractDirectiveNames('`[SKIPSTART]`～`[SKIPEND]`'), ['[SKIPSTART]', '[SKIPEND]']);
});

test('extractDirectiveNames：带锚点的普通标题不算名字', () => {
  assert.deepEqual(extractDirectiveNames('参数省略与兼容设置 {#arg-omission}'), []);
  assert.deepEqual(extractDirectiveNames('格式'), []);
});

test('splitSections：围栏内的 ### 不切段', () => {
  const sections = splitSections(FIXTURE);
  const titles = sections.map((section) => section.heading);
  assert.ok(!titles.some((title) => title.includes('这不是标题')), '围栏里的 ### 被误当标题');
  // heading 保留原始反引号，去反引号是 parseSpecPage 生成 title 时的事
  assert.deepEqual(titles, [
    '`@EVENTLOAD`',
    '`#LOCALSIZE <常量表达式>`,`#LOCALSSIZE <常量表达式>`',
    '`#DIM`',
    '格式',
  ]);
});

test('splitSections：## 下的引导句挂到该组首个小节', () => {
  const sections = splitSections(FIXTURE);
  const localsize = sections.find((section) => section.heading.includes('#LOCALSIZE'));
  assert.ok(localsize);
  assert.match(localsize.body, /必须紧接在函数下方/, '## 引导句丢了');
  assert.equal(localsize.group, '定义');
});

test('parseSpecPage：切出条目、名字合并、pageId 指回页面', () => {
  const entries = parseSpecPage('Emuera/function', 'docs/Emuera/function.zh.md', FIXTURE);
  const ids = entries.map((entry) => entry.id);
  assert.deepEqual(ids, [
    'Emuera/function#EVENTLOAD',
    'Emuera/function#LOCALSIZE',
    'Emuera/function#DIM',
  ]);
  for (const entry of entries) {
    assert.equal(entry.pageId, 'Emuera/function');
    assert.equal(entry.sourcePath, 'docs/Emuera/function.zh.md');
    assert.equal(entry.localOnly, true, '切段条目必须标 localOnly，否则在线整页替换会把它并回一页');
    assert.deepEqual(entry.signatures, []);
    assert.ok(!entry.id.includes('##'), `id 出现双井号：${entry.id}`);
  }

  const localsize = entries.find((entry) => entry.id === 'Emuera/function#LOCALSIZE');
  assert.deepEqual(localsize?.names, ['#LOCALSIZE', '#LOCALSSIZE']);
  assert.match(localsize?.body ?? '', /大于0的整数/);
  assert.match(localsize?.body ?? '', /为每个函数单独指定/);
});

test('parseSpecPage：无名小节并入上一节而不是单独成条', () => {
  const entries = parseSpecPage('Emuera/function', 'docs/Emuera/function.zh.md', FIXTURE);
  const dim = entries.find((entry) => entry.id === 'Emuera/function#DIM');
  assert.match(dim?.body ?? '', /补充说明/, '「格式」小节没并进 #DIM');
  assert.match(dim?.body ?? '', /#DIM MYVAR, 10/, '围栏里的示例代码丢了');
});

test('parseSpecPage：整页无指令名时退回单条页面级条目', () => {
  const entries = parseSpecPage(
    'tutorial/concept',
    'docs/tutorial/concept.zh.md',
    '# 概念说明\n\n这是一段没有小节标题的正文，用来验证兜底路径。\n',
  );
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.id, 'tutorial/concept');
  assert.equal(entries[0]?.pageId, undefined);
  assert.match(entries[0]?.body ?? '', /没有小节标题/);
});

test('parseSpecPage：同名小节重复出现时 id 不冲突', () => {
  const markdown = [
    '## 甲',
    '### `#DIM`',
    '第一次出现。',
    '## 乙',
    '### `#DIM`',
    '第二次出现。',
  ].join('\n\n');
  const entries = parseSpecPage('Emuera/dup', 'docs/Emuera/dup.zh.md', markdown);
  assert.equal(entries.length, 2);
  assert.equal(new Set(entries.map((entry) => entry.id)).size, 2, 'id 必须唯一');
});
