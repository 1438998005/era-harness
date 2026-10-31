# Handoff: 3.94.0 已出包（记忆开关抽搐 / 记忆有效性 / GLM 与免费款 / 循环刹车），待手测与发布

> 最后更新：2026-10-31。本文件取代上一份（3.93.0 收尾）。
> 改动**已全部本地完成**，但**未 commit、未 push**（§3.8：推送一律由用户手动执行）。
> 根因与取舍沉淀在 `知识库/26-全局记忆.md`、`知识库/12` §12.29、`知识库/23` §23.6、`知识库/08` 销项记录。

---

## 本轮做了什么

用户提了三件事：关闭全局记忆时设置页「反复抽搐」、彻查全局记忆是否真的生效、08 清单里疑似还有 BUG。按批准的
UltraPlan 执行，A–I 九组全部完成。

### A. 记忆开关抽搐（P0）

- **根因是受控复选框的 change 反馈环**（三层证据见 KB 26 §26.3）：
  1. React 包装器每次更新把 `_elementProps` 里每个键**无条件**写回元素（不做值比较）；
  2. FAST `checkedChanged` 在 `prev !== undefined` 时 `$emit("change")`；
  3. 旧代码**不看事件值**，按「重新读盘后取反」→ 回写触发第二次 change → 再取反……
- 修法：事件值为准 + 写前幂等判等 + `inFlightRef` 忽略写入期间的事件（`disabled` 拦不住属性回写）。
- 回归测试复刻 FAST 语义（受控值变化会回调 onChange），修复前必红、修复后「关闭只写一次」。

### B. 全局记忆有效性（P1）

- 结论：**链路通**（每轮读盘 → 段落注入 → 工具门控 → handler 双拦），真正的缺口是**没有指令告诉模型「什么时候该写」**。
- 只在工具描述中英双语补「主动记，不要等用户开口」；不做自动总结、不加手动提炼按钮（用户已拍板）。

### C. 08 #83 `<reasoning>` 漏正文

- `display-clean.ts` 新增 `stripReasoningSegments`：行首起的完整段/半截段/孤立闭标签整段删除；行内提及不误伤。
- 提示词不改（GLM/Hermes 的思考习惯不动），展示层兜底。

### D. 08 #84 4v-flash

- `api.ts` 标 `contextWindowIncludesOutput: true`（16K 含输出，输入预算 15K）。
- `extractBigmodelError` 新增 1210 人话：「16K 装不下系统提示词，压缩救不了，换窗口更大的模型」。
- 确定性 4xx 不再弹「3 次耗尽」卡片（首 chunk + 中流两处）；重试/失败卡片正文改 `clineError.message`，
  `serialize()` 只留在审计层。**不做**入口按窗口灰化（理由见计划 Rejected #4）。

### E. 08 #85 GLM 家族

- `isGLMModelFamily` 增补 `glm-4` / `glm 4`；四款老模型改吃 GLM 提示词变体与精简工具集。

### F. 08 #88 同轮重复读

- `TaskState.sameTurnReadKeys` + `claimSameTurnRead`：同一条 assistant 消息里第二次读同一区间直接回短标记
  （复用 `[SAME CONTENT]` 文案）；每轮开头清空，写入失效 / 读盘失败时释放名额，跨轮重读不受影响。

### G. 08 #87 task_progress 复读

- `ParseRepairStats.taskProgressStrippedChars` 记**单次最大**剥离字数（流式重解析下累加会倍增），
  >200 字计一次 mistake + 一行 info（单轮最多一次）。

### H. 08 #86 请求体指纹刹车

- 指纹 = 系统提示 + 最后一条 user 消息纯文本（**不接 assistant 文本**：复读时它每轮都变）。
- 连续 5 次同指纹 → 拉满 `consecutiveMistakeCount` 复用既有 mistake_limit 打断 + 审计 `api/fingerprint_loop`；
  手动重试 / 用户介入时重置。

### I. 文档与版本

- 新 `知识库/26-全局记忆.md`；`12` §12.29；`23` §23.6 台账回填；`08` #83–#88 销项 + #89 台账；
  `README.md` 索引加 26；`CHANGELOG.md` 3.94.0 四节。
- `package.json` / `package-lock.json` 3.93.0 → 3.94.0。

## 验证结果（本机实跑）

| 项 | 结果 |
|---|---|
| `npm run gate` | 全绿：用例登记 11+55 在册、核心库 160 例（159 过 / 1 跳过 / 0 败）、核心库 typecheck 0 错、`test/update` **627/627** |
| `npm run test:ui` | 8 文件 / **49 例**全过（含「关闭开关只写一次」回归；另有一条故意抛错的 stderr，属该用例设计） |
| `npm run check-types` | 通过（webview 走 `tsc -b`） |
| `npm run lint` | 通过（biome 1114 文件 + proto-lint） |
| `npm run package` | 通过 |
| `npm run vsix` | `era-harness-3.94.0.vsix`，**51 文件 / 7.84 MB**，无 HANDOFF/AGENTS |

SHA256：`92fbe0549babc151c57c2206f1b5a82de51ce1c7ef27a0c6e16c38361f03e7da`（3.94.0 已发布到 jihulab，`check-jihulab-release.mjs` 全部通过）

## 未完成

- [ ] **用户手测**（装 `era-harness-3.94.0.vsix`）：
  1. 设置 → 记忆：开关「关闭」连续点 3 次 → 复选框不来回跳、每次只变一次，关掉后重开设置仍是关；
  2. 关闭状态下说「记住我喜欢简短回答」→ 模型应回「记忆已关闭」而不是写入；
  3. 开启后说「以后都用简体中文回答」→ 模型应主动 `global_memory add`，聊天区出现记录；
  4. 选 `glm-4v-flash` 发一句 → 不出裸 JSON、不谎报「3 次尝试后失败」，提示指向换模型；
  5. `glm-4-flash-250414` 各跑一轮 list_files / read_file / replace_in_file（#85 生效性，自动化测不到）；
  6. 同轮让模型「再读一次同一个文件」→ 第二次回短标记而不是整份正文（#88）。
- [ ] **发布**（全部由用户手动执行）：
  ```powershell
  cd "D:/era harness工作区/era-harness-plugin"
  git add -A
  git commit -m "fix: 记忆开关去反馈环 + 记忆主动写入指引；08 #83-#88 修复、#89 台账（3.94.0）"
  git tag v3.94.0
  git push origin main
  git push origin v3.94.0
  node ../publish-release.mjs      # jihulab；脚本读 package.json，会发 3.94.0
  ```

## 风险与回滚

| 风险 | 缓解 |
|---|---|
| A 修完仍抽搐（别的路径也在写 `checked`） | 新测试复刻 FAST 语义红→绿；退路是换原生 `<input type="checkbox">` 套 VS Code 变量样式 |
| #85 扩家族后老模型吃精简工具集反而更差 | 真值表单测 + 六款人工回归；去掉 `glm-4` 分支一行回滚 |
| #86 指纹误判（合法重试/长回合） | 只在「最后一条 user 消息完全相同」时累计；手动重试/用户介入重置；阈值 5 高于 mistake 默认 3 |
| #88 同轮二次读被拦掩盖外部编辑 | 写入路径已 `invalidateRepeatWindowForPath`，本次一并清 `sameTurnReadKeys`；mtime 变化仍走缓存驱逐 |
| #87 阈值误伤正常清单 | 200 字 + 单轮只记一次；只计 mistake 不直接判死 |
| D1 标 true 后 4v-flash 压缩阈值变小 | 这是事实口径；实际仍会 400，靠 1210 人话与「不谎报」说清楚 |

## 关键决策（不重复正文，指向知识库）

- **记忆开关**：任何 `VSCodeCheckbox` 受控用法必须「用事件值 + 幂等 + 写入期间忽略事件」。见 KB 26 §26.3。
- **记忆能力**：只补「主动写入」指引，不做自动提炼（用户拍板）。见 KB 26 §26.2。
- **#83 只做展示层兜底**，不改 GLM/Hermes 的 `<reasoning>` 提示词。见 KB 12 §12.29。
- **#84 不做入口灰化**，用「口径正确 + 人话 + 不谎报」覆盖。
- **#86 不用文本相似度**：模型复读时文本每轮都变，用「系统提示 + 最后一条 user 消息」的请求指纹。

## 关键文件（本轮新增/改动摘要）

- 新：`知识库/26-全局记忆.md`；
  `test/update/{memory-gating,display-clean-reasoning,glm-family,read-turn-dedupe,task-progress-threshold,request-fingerprint}.spec.ts`
- 改：`webview-ui/.../MemorySettingsSection.tsx`（+ `.test.tsx`）、`prompts/system-prompt/tools/global_memory.ts`、
  `src/core/assistant-message/{display-clean,parse-assistant-message}.ts`、`src/utils/model-utils.ts`、
  `src/shared/{api,bigmodel-request}.ts`、`src/core/task/{index,TaskState,loop-detection}.ts`、
  `src/core/task/tools/handlers/ReadFileToolHandler.ts`、`test/update/run.mjs`、
  `CHANGELOG.md`、`package.json` / `package-lock.json`

## 推荐技能

- 发布/提交走仓库既有约定；**推送与 tag 必须用户手动**（§3.8）。
- 下一批开工前先读 `知识库/08`（当前 #83–#88 已销项、#89 台账）、`23` §23.6、`26`。
