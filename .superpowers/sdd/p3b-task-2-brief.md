# SP8-P3b Task 2 任务书

**先读**:`.superpowers/sdd/p3b-common-constraints.md`(公共约束,与本文冲突时以它为准)。
**本文即你的需求**,里面的数值/键名/签名一律**逐字照用**,不要自行改写。
不要去读整份计划文件。

---

## Task 2 —— 两个纯 util + 本期全部 i18n 键

**Files:** 新建 `src/ai/util/sandboxRun.ts` + `.test.ts` · 新建 `src/ai/util/skillsErrorKey.ts` + `.test.ts` · 改 `src/i18n/{zh_cn,en_us}.ts`

**Produces:**
```ts
// sandboxRun.ts
export type SandboxStep = { kind: 'text' | 'tool'; text: string }
export type SandboxState = { steps: SandboxStep[]; ms: number | null; error: string; done: boolean }
export function initSandboxState(): SandboxState
export function reduceSandboxEvent(s: SandboxState, ev: Record<string, unknown>, elapsedMs: number): SandboxState

// skillsErrorKey.ts
export function createSkillErrorKey(e: unknown): string        // 后端错误 → i18n 键
export function validateSkillForm(name: string, description: string): string | null  // 前端校验 → i18n 键 | null
```

### 2.1 `sandboxRun.ts`

**纯函数,内部不读时钟**(`elapsedMs` 由调用方传入 —— 这样可测)。返回**新对象**,不就地改入参。

事件取舍(对 Vue2 `TestPanel.vue:160-172`,其余事件类型如 `thinking`/`tool_result`/`confirmation_required` 一概忽略):

| `ev.type` | 处理 |
|---|---|
| `message_delta` / `message` / `text`,且 `ev.content` 为非空字符串 | **若 `steps` 末项 `kind==='text'` 就把 content 追加到它的 `text`,否则 push 一个新的 `{kind:'text'}`**(= 拍板 D2 的累积) |
| `tool_call` | push `{ kind:'tool', text: '→ ' + (ev.tool ?? ev.name ?? 'tool') }` |
| `error` | `error = String(ev.content ?? '')` |
| `done` | `done = true`,`ms = elapsedMs` |
| 其它 / `content` 为空 | 原状返回 |

**不实现 `tokens`**:Vue2 模板 `TestPanel.vue:70-73` 有 `output.tokens != null` 分支,但 `output.tokens` 全组件**从未被赋值**(死分支)。照 P3a 处理 `trigger_human` 的先例:生产代码零引用,并在 `.test.ts` 里留一条 RED 探针式断言钉死(喂一个带 `tokens` 的 `done` 事件,断言 `SandboxState` 上不存在该字段)。

`.test.ts` 覆盖:两片连续 `message_delta` 合成一步且文本按序拼接 · `text` 与 `message` 也参与同一累积 · `text → tool_call → text` 得到 3 步且第 3 步是新的 text 步 · `tool_call` 无 `tool` 时回落 `ev.name`,两者都无回落 `'tool'` · `error` 事件写入 `error` · `done` 写 `done`/`ms` · 未知 type 与空 `content` 不改状态 · **入参对象未被就地修改**(断言原对象 `steps.length` 不变)。

### 2.2 `skillsErrorKey.ts`

`createSkillErrorKey(e)` 照 `channelsFormat.ts:65-76` 的形状取错误串(`e.response.data.message ?? .detail ?? data`,`String` 后 `trim().toLowerCase()`),按**包含匹配**判定。Go 侧是 `fmt.Errorf("%w: …")` 包装,所以串带前缀 —— **顺序:先判更长的 description 子类,再判 `invalid skill description` 本身,最后兜底**。

| 后端串(小写后包含) | 返回键 |
|---|---|
| `skill already exists` | `aiSkErrDuplicate` |
| `invalid skill id` | `aiSkErrBadId` |
| `description required` | `aiSkErrDescRequired` |
| `longer than 256 characters` | `aiSkErrDescTooLong` |
| `must be a single line` | `aiSkErrDescSingleLine` |
| `are not allowed` + 含 `'<'` | `aiSkErrDescAngle` |
| `control characters are not allowed` | `aiSkErrDescControl` |
| `invalid file path in bundle` | `aiSkErrBadPath` |
| `bundle exceeds size limits` | `aiSkErrBundleTooLarge` |
| `skill.md exceeds` | `aiSkErrMdTooLarge` |
| 其余 / 取不到串 | `aiSkErrCreateFailed` |

`validateSkillForm(name, description)` —— **拍板偏离①(提交前做与后端同款校验)**,规则逐条对 `NimoOS-AI/service/skills_store.go:37-59` 与 `route/v2/skills.go`:
- `name.trim()` 为空 → `aiSkErrBadId`;不匹配 `/^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/` → `aiSkErrBadId`
- `description.trim()` 为空 → `aiSkErrDescRequired`;长度 > 256 → `aiSkErrDescTooLong`;含 `\n`/`\r` → `aiSkErrDescSingleLine`;含 `<` 或 `>` → `aiSkErrDescAngle`;含控制字符 → `aiSkErrDescControl`
- 全过 → `null`

⚠️ 正则**必须自己回 Go 源核对**(`service/skills_store.go` 的 `ValidateSkillID` 与 Python `agent/main.py:2489` 的 `^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$` 两处),别信本表。

`.test.ts`:**11 个后端串各一例**(用真实串,不用简化串)· 单字符 name(`'a'`)合法 · 大写/下划线/首尾短横线非法 · 63 字符边界 · 256/257 字符边界 · 含换行 / 含 `<` / 含 `\x07` 各一例 · 合法输入返回 `null` · 取不到错误串时兜底键。

### 2.3 i18n 新键表

**英文档取 Vue2 的 key 字面量**(en_US.json 大量缺键,Vue2 实际显示的就是 key 本身);**中文档逐字照下表**(已从 `zh_CN.json` 抓出)。写之前 `grep` 确认键不存在。

**复用(不新增)**:`aiCancel`(取消)· `aiCfgRefresh`(刷新)· `aiSkDescription`(描述)· `aiSkTrigger`(触发方式)· `aiSkTagManual`(手动)· `aiCopied`(已复制)· `aiSkPaused`/`aiSkActive`。

| 键 | zh_cn | en_us |
|---|---|---|
| `aiSkAddSkill` | 添加技能 | Add skill |
| `aiSkDisable` | 禁用 | Disable |
| `aiSkEnable` | 启用 | Enable |
| `aiSkDisableTemporarily` | 临时禁用 | Disable temporarily |
| `aiSkCopyMd` | 复制 SKILL.md | Copy SKILL.md |
| `aiSkExport` | 导出技能 | Export skill |
| `aiSkUninstall` | 卸载 | Uninstall |
| `aiSkDeleteSkill` | 删除技能 | Delete skill |
| `aiSkDelete` | 删除 | Delete |
| `aiSkUninstallTitle` | 卸载这个技能? | Uninstall this skill? |
| `aiSkDeleteTitle` | 删除这个技能? | Delete this skill? |
| `aiSkUninstallBody` | **技能将从这台 NAS 移除。此界面无法恢复,需要重装系统或手工把技能目录放回。** | **It will be removed from this NAS. This interface cannot restore it — you would need to reinstall the system or put the skill folder back by hand.** |
| `aiSkDeleteBody` | 这会永久删除该技能及其 SKILL.md 文件,无法恢复。 | This permanently deletes the skill and its SKILL.md from your NAS. This cannot be undone. |
| `aiSkNPrevRuns` | 历史运行 {count} 次 | {count} previous runs |
| `aiSkEnabledToast` | 技能已启用 | Skill enabled |
| `aiSkPausedToast` | 技能已暂停 | Skill paused |
| `aiSkUpdateFailed` | 更新失败 | Update failed |
| `aiSkUninstalledName` | 已卸载 {name} | Uninstalled {name} |
| `aiSkDeletedName` | 已删除 {name} | Deleted {name} |
| `aiSkDeleteFailed` | 删除失败 | Delete failed |
| `aiSkAddedName` | 已添加 {name} | Added {name} |
| `aiSkAddTitle` | 添加新技能 | Add a new skill |
| `aiSkFieldName` | 名称 | Name |
| `aiSkNamePlaceholder` | 例如:invoice-tagger | e.g. invoice-tagger |
| `aiSkNameHint` | 仅小写字母与短横线 —— 这个名字会作为斜杠命令使用。 | Lowercase, dashes only — this becomes the slash command. |
| `aiSkDescPlaceholder` | Nimo 应该在什么时候用这个技能?它做什么? | When should Nimo use this skill? What does it do? |
| `aiSkDescFormHint` | 清晰的描述能帮助 Nimo 自动挑选合适的技能。 | A clear description helps Nimo pick the right skill automatically. |
| `aiSkFieldColor` | 颜色 | Color |
| `aiSkOptional` | 可选 | optional |
| `aiSkScriptFiles` | 脚本文件 | Script files |
| `aiSkScriptsHint` | 文件会保存在 bundle 的 scripts/{'<'}name{'>'} 路径下。 | Files are stored inside scripts/{'<'}name{'>'} in the bundle. |
| `aiSkSavedLocally` | 保存在这台 NAS 本地 | Saved locally on this NAS |
| `aiSkCreating` | 创建中… | Creating… |
| `aiSkCreate` | 创建技能 | Create skill |
| `aiSkTrigOptAuto` | 自动触发 | Automatic |
| `aiSkTrigDescAuto` | 由 Nimo 自行决定何时使用 | Nimo decides when to use it |
| `aiSkTrigOptSlash` | 斜杠命令 | Slash command |
| `aiSkTrigDescSlash` | 在对话中输入 /name 触发 | Run with /name in chat |
| `aiSkTrigDescManual` | 仅在明确调用时 | Only when explicitly invoked |
| `aiSkMdPlaceholderHead` | 你的技能 | Your skill |
| `aiSkMdPlaceholderBody` | 描述这个技能的工作方式… | Describe how the skill works… |
| `aiSkFilesSkippedTooBig` | **{n} 个文件超过 1 MiB,已跳过** | **{n} file(s) larger than 1 MiB were skipped** |
| `aiSkErrDuplicate` | 已存在同名技能 | A skill with this name already exists |
| `aiSkErrBadId` | 名称只能用小写字母、数字和短横线,且不能以短横线开头或结尾 | Name may only contain lowercase letters, digits and dashes, and cannot start or end with a dash |
| `aiSkErrDescRequired` | 请填写描述 | Description is required |
| `aiSkErrDescTooLong` | 描述不能超过 256 个字符 | Description cannot exceed 256 characters |
| `aiSkErrDescSingleLine` | 描述必须是单行 | Description must be a single line |
| `aiSkErrDescAngle` | 描述里不能包含 {'<'} 和 {'>'} | Description cannot contain {'<'} or {'>'} |
| `aiSkErrDescControl` | 描述里不能包含控制字符 | Description cannot contain control characters |
| `aiSkErrBadPath` | 脚本文件路径不合法 | Invalid file path in bundle |
| `aiSkErrBundleTooLarge` | 技能包体积超出限制 | Bundle exceeds size limits |
| `aiSkErrMdTooLarge` | SKILL.md 太大 | SKILL.md is too large |
| `aiSkErrCreateFailed` | 无法创建技能 | Could not create skill |
| `aiSkTestTitle` | 沙箱测试 | Test in sandbox |
| `aiSkTestHint` | 在隔离环境中运行,不会影响真实文件。 | Runs in an isolated container — won't touch real files. |
| `aiSkTestPill` | 沙箱 | Sandbox |
| `aiSkTestTryName` | 试用 {name},不影响你的 NAS | Try {name} without affecting your NAS |
| `aiSkTestDiscard` | 运行结束后输入和输出会被丢弃。 | Inputs and outputs are discarded after the run. |
| `aiSkTestOffTitle` | 技能已禁用,但仍可在沙箱中测试 | Skill is disabled — testing still works |
| `aiSkTestOffBadge` | 技能已关闭 | Skill off |
| `aiSkTestRun` | 运行 | Run |
| `aiSkTestRunning` | 运行中… | Running… |
| `aiSkTestExamples` | 示例提示 | Example prompts |
| `aiSkTestRunningLabel` | 在沙箱中运行… | Running in sandbox… |
| `aiSkTestBootstrapping` | 正在准备 {name} 运行环境… | Bootstrapping {name} environment… |
| `aiSkTestCompleted` | 用时 {ms} 毫秒 | Completed in {ms} ms |
| `aiSkTestClosed` | 沙箱已关闭,没有文件被修改。 | Sandbox closed. No files were modified. |
| `aiSkTestFailed` | 运行失败 | Run failed |
| `aiSkTestPlaceholderEx` | 试试:"{ex}" | Try: "{ex}" |
| `aiSkTestPlaceholder` | 在示例文件夹上运行该技能 | Run the skill on a sample folder |
| `aiSkTestHttpFailed` | **沙箱运行失败(HTTP {status})** | **Sandbox run failed (HTTP {status})** |
| `aiSkTryDisabledTitle` | **该技能已停用** | **This skill is paused** |
| `aiSkTryDisabledBody` | **停用的技能不会被加载,现在去对话里试用不会有任何效果。要先启用它吗?** | **A paused skill is not loaded, so trying it in chat will have no effect. Enable it first?** |
| `aiSkTryEnableAndTry` | **启用并试用** | **Enable and try** |

**加粗行 = Vue2 没有的新文案**(D2/D3/D4 拍板 + 前端校验 + >1 MiB 提示),须在报告里单列。

⚠️ **`{'<'}` / `{'>'}` 写法**:vue-i18n 9 的消息编译器对 `<`/`>` 本身不敏感,但 `aiSkScriptsHint` 与 `aiSkErrDescAngle` 里的尖括号**必须先实测**能正常渲染;若 `messageSyntax.test.ts` 或渲染报错,改用字面转义并在 `.test.ts` 里补一条渲染回归(先例:P1c1 那次 `@` 真故障)。

### 2.4 验收

- `pnpm test` 全量绿,`parity.test.ts` + `messageSyntax.test.ts` 绿;新增用例数 = 两个 `.test.ts` 之和(**无新 `.vue`,color-guard 用例数不变**)。
- 报告贴:复用键清单 · 新增键清单(标出加粗那 9 条新文案)· 正则回 Go 源核对的结论 · 尖括号渲染实测结果。

---

---

# 附:计划的 Global Constraints(本任务隐含包含)

## Global Constraints

从 spec 抄来的硬约束,**每个任务隐含包含本节**:

1. **只动 `.sp8/NimoOS-New-UI` 一个仓**。Service 仓本期零改动。禁碰 `NimoOS-New-UI`(SP6)、`.sp7/`(SP7)、真机 `/var/lib`,不跑 `deploy.sh`。
2. **移植纪律(用户 2026-07-27 拍板)**:界面/视觉/交互严格 1:1 照 Vue2;逻辑/bug 不照抄,但偏离必须**三件套**齐全 —— ① 代码注释注明 Vue2 `file:line` 的问题 ② 实现者报告显式申报 ③ 台账登记。**未申报的偏离本身就是缺陷。** 禁与需求无关的重构/改名/换库。
3. **配色**:一切可见颜色必须 `var(--…)` token。禁 `#hex`/`rgb()`/`rgba()`/具名色(含 `white`/`black`)。**内联 `:style` 里的颜色同样违规。** 禁用 `theme-exception` 逃逸。新 token 必须在浅色与 `[data-theme="dark"]` 两块都有值。⚠️ `color-guard.test.ts` 只 glob `.vue`/`.css` —— **`.scss` 无自动化守卫,本期这批 scss 靠评审逐行人肉扫**。
4. **数据契约**:后端 `NimoOS-AI/route/v2/skills.go` 全是 `c.JSON(code, out)` 裸对象/裸数组,无信封;共享包 `service.ai.*` 已 `return res.data` 剥掉 axios 层 → **消费端单层取数**。测试 mock 一律裸对象/裸数组,写 `{ data: … }` 就是把缺陷编码进断言。
5. **代码范式**:`<script setup lang="ts">` · `useI18n()` from `'vue-i18n'` · 后端走 `import { service } from '@nimotech/nimoos-service'` · **import 一律相对路径**(本仓无 `@/` 别名)· 状态一律组件本地 `ref`,不新建 store · 组件里**零 `<style>` 块**(样式全在 `.scss`)· 用到的每个 CSS 类先 `grep` 确认存在。
6. **toast 真签名**:`show(text, duration = 1500, tier: 'info'|'warning'|'danger' = 'info')`(`src/stores/toast.ts:18-27`)。
7. **i18n**:新键**同时**加 `src/i18n/zh_cn.ts` 与 `en_us.ts`(`parity.test.ts` 断言键集一致)。值逐字照 Task 2 的表,**不许自行翻译、不许改标点**。文案里字面 `@` 写成 `{'@'}`(`messageSyntax.test.ts` 全键守卫会拦)。
8. **测试门(每任务提交前)**:全量三门,**输出完整落盘禁 `| tail`**(P3a 那条偶发红就是靠这条留下名字的):
   ```bash
   cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
   pnpm test                  > /tmp/p3b-test.log  2>&1; echo "exit=$?"
   pnpm exec vue-tsc --noEmit > /tmp/p3b-tsc.log   2>&1; echo "exit=$?"
   pnpm build                 > /tmp/p3b-build.log 2>&1; echo "exit=$?"
   ```
   已知噪声:`src/files/upload/persist.test.ts` 是既有 IndexedDB flaky,只它红就复跑一次并说明。
9. **算术备忘**:`color-guard.test.ts` 按 `**/*.vue` 动态生成用例 → **每新增一个 `.vue` 全量用例数 +1**(本期新增 2 个 `.vue`)。
10. **禁空转用例**;无判别力的断言要做 **RED 验证**(故意弄坏 → 看到红 → 复原 → 看到绿,报告贴两段输出)。mock 骨架用 `vi.hoisted()`。异步断言用 `flushPromises()`,不用单个 `await nextTick()`。**不许削弱或删除既有断言**来让测试变绿。
11. 一个任务 = 一个语义提交。禁 `git add -A`/`git add .`,只许显式列路径;提交后 `git show --stat HEAD` 自查。不 rebase/reset/stash/merge/push。

---

---

# 附:权威源速查

## 权威源速查(所有任务共用)

| 用途 | 路径 |
|---|---|
| Vue2 组件蓝本 | `/home/nimo/NimoTech/NimoOS-UI/src/views/AI/Skills/{SkillsSection,SkillDetail,AddSkillModal,TestPanel}.vue` |
| Vue2 样式蓝本 | `…/src/views/AI/Skills/skills-styles.scss`(782 行) |
| Vue2 语言包 | `…/src/assets/lang/{zh_CN,en_US}.json`(en_US **大量缺键** → Vue2 回落显示 key 本身,故英文档取 key 字面量) |
| Vue2 SSE 蓝本 | `…/src/service/ai.js:204-258`(`streamSkillTest`) |
| 后端契约 | `/home/nimo/NimoTech/NimoOS-AI/route/v2/skills.go`、`route/v2/skills_files.go`、`service/skills_store.go` |
| 本仓 SSE 先例 | `src/ai/services/agentTransport.ts`(**照它的形状写 Task 3**) |
| 错误映射先例 | `src/ai/util/channelsFormat.ts:65-76`(`addBotErrorKey`) |
| 已评审通过的样板 | `src/ai/components/settings/sections/{BlacklistSection,ExecutionSection,MemorySection,ChannelsSection}.vue` |

---
