# SP8-P3b Task 8 —— `SkillsSection.vue` 接线,实现报告

工作区:`/home/nimo/NimoTech/.sp8/NimoOS-New-UI`,分支 `sp8-ai`,起点 `19b7f6e`。

## 逐文件改动

### 1. `src/ai/types/skill.ts`(改)

纯新增,不改动既有 `Skill`/`SkillFile`。新增并导出两个 interface(协调者预先解歧义①的搬移落地):

- `SkillScript { path: string; content: string }`
- `SkillFormPayload { name, title, description, trigger, color, md, examples, scripts }`

字段与 `AddSkillModal.vue` 原来未导出的同名 interface **逐字一致,一个字未改**——纯搬移。

### 2. `src/ai/components/settings/skills/AddSkillModal.vue`(改)

删掉本地 `interface SkillScript` / `interface SkillFormPayload`,改成
`import type { SkillFormPayload } from '../../../types/skill'`。`PickedFile` 是纯组件内部形状(不跨组件边界),留在本地未搬。

验证:`AddSkillModal.test.ts` 15 例全绿(见下方三门数字)。

### 3. `src/ai/components/settings/sections/SkillsSection.vue`(改,本任务主体)

- 新增状态:`adding`/`saving`/`busy`/`createError`,逐字照 brief §1。
- `watch(adding, v => { if (!v) createError.value = '' })`——关闭弹窗清行内错误(协调者预先解掉的第 2 处)。
- `+` 按钮填进 `:119-121` 占位注释处,在刷新按钮之后;`AgentIcon name="plus"` 不传 `color`,靠 `.sk-add-btn { color: var(--text-on-accent) }`(skills-styles.scss:193,已 grep 确认这条规则里确有 `color` 声明)供色。
- 四个方法 `onToggle`/`onDelete`/`onCreate`/`onTest`,逐字照 brief §2 的代码骨架实现(细节见下方「Vue2 对照」与「承接的行为」)。
- 接线:`<SkillDetail :skill :busy @toggle @delete @test>` · `<AddSkillModal v-model:open="adding" :saving :server-error="createError" @save="onCreate">`。
- `onCreate` 里 `service.ai.createSkill(payload)` 需要一次 `payload as unknown as Record<string, unknown>` 转型(不在 brief 逐字代码骨架里,是补 vue-tsc 报的 TS2345/TS2352——`SkillFormPayload` 是具名 interface,不带隐式索引签名,直传给共享包签名 `createSkill(data: Record<string, unknown>)` 编译不过;字段值本身未做任何改动,纯类型层的转型)。

### 4. `src/ai/components/settings/sections/SkillsSection.test.ts`(改)

- 顶部 mock 补 `updateSkill`/`deleteSkill`/`createSkill` 三个 `vi.fn()`。
- `mountSection` 加 `attachTo: document.body`;两个 `describe` 的 `beforeEach` 都补 `.set-app` host + `afterEach` 清空 body(AddSkillModal 走 `SkModal`,`DialogPortal` 默认目标 `.set-app`,先例 `ChannelsSection.test.ts`)。
- 新增 `describe('SkillsSection(P3b 写操作半)')`,12 条新用例(见下方逐条列举)。

## Vue2 `file:line` → New-UI 对照

| Vue2 | New-UI |
|---|---|
| `:6-11`(refresh → `+` 按钮顺序) | 模板同顺序,`.sk-add-btn` 插在 `.icon-btn` 之后 |
| `:147-161 onToggle` | `onToggle(id, enabled)`,单层取数 |
| `:162-183 onDelete` | `onDelete(id)`,单层取数(DELETE 本就是 204,两边都不读返回值) |
| `:184-203 onCreate` | `onCreate(payload)`,单层取数,失败不关弹窗 |
| `:204-214 onTest` | `onTest()`,对当前 `activeId` 项做同样的乐观更新公式 |
| `:65-70 v-if="adding"` | `v-model:open="adding"`(常挂,理由见下) |
| `:139,156,178,196 console.error` | 不移植(申报,见下) |
| `:10 color="white"` | 不移植(申报,见下) |

## 承接了 Vue2 哪些行为

- 搜索/分组/选中态保持逻辑:P3a 已承接,本任务未改动。
- `onToggle`/`onDelete`/`onCreate` 三个方法体的**业务语义**(参数、成功/失败分支、toast 文案选择规则)与 Vue2 完全一致,只是取数深度从两层改成一层(见下方偏离①)。
- `onTest` 的乐观更新公式(`last_used='Just now'`、`calls+1`)与 Vue2 逐字一致。
- 删除后选中项落位的**非当前项分支**(`activeId` 不动)与 Vue2 `:168-170` 一致——这不是新增行为,是 Vue2 原逻辑本来就有的条件分支(`if (this.activeId === id)`),只是 brief 特别点名要求测试钉住它。

## 偏离申报(公共约束 §2 三件套,逐条对齐组件头注释「SP8-P3b Task 8」段)

1. **单层取数**(§3 偏离 1 的延伸,brief §10.2 逐字点名)——`onToggle`/`onCreate` 不再像 Vue2 那样多剥一层 `.data`。已回源核对 `NimoOS-AI/route/v2/skills.go`:PATCH(`:112-130`)走 `h.Get(c)` → 200 裸 skill(`:52`);POST(`:75-105`)→ 201 裸 skill(`:105`);DELETE(`:133-145`)→ `c.NoContent(204)`,两边都没读返回值,不构成偏离。RED 探针见下。
2. **`console.error` 不照抄**(Vue2 `:139,156,178,196`)——四个方法全部不写,失败态统一交给 toast/行内错误,与本仓三个兄弟分区(Blacklist/Execution/Memory)及本文件 P3a 已有的 `reload()` 惯例一致。
3. **`+` 按钮不传具名色**(公共约束 §3 偏离 8)——Vue2 `:10 color="white"` 不照抄,`AgentIcon` 走 `currentColor`,由 `.sk-add-btn` 的 `color: var(--text-on-accent)` 供色(已 grep 确认,skills-styles.scss:193)。
4. **onTest 乐观本地值,不落库**(对齐 Vue2 `:204-214`,brief §10.2 明确要求申报)——`service/skills.go:352 RecordRun` 全仓零调用点,已 grep 确认(`grep -rn RecordRun NimoOS-AI --include='*.go'` 只命中定义那一行)。`reload()`/切技能/刷新页面都会把这两个字段打回后端原值。这是公共约束 §3 偏离 4 已登记的既有事实的另一半,不是本任务新引入的缺陷,原样保留 Vue2 的本地体感。
5. **弹窗常挂写法**(`v-model:open` 而非 `v-if`)——grep 先例后二选一:`ChannelsSection.vue:427`(`SkModal :open="showAdd"`)与本文件同级 `SkillDetail.vue` 的 D4 弹窗(`SkModal :open="tryModalOpen"`)都是常挂写法;且 `AddSkillModal.vue` 自己的 `watch(() => props.open, ...)` 已经是按「组件常驻、`open` 驱动可见」设计的(关闭时 `resetForm()`)。跟随先例,不引入第三种模式。

## RED→GREEN 证据(单层取数)

把 `onToggle` 改回 Vue2 的双层取数(`((await service.ai.updateSkill(...)) as {data?:Skill}|undefined)?.data`)：

```
❯ src/ai/components/settings/sections/SkillsSection.test.ts (23 tests | 2 failed) 531ms
    × toggle 成功:后端返回裸 skill,列表项原地替换,toast 按新状态提示对应文案
    × 单层取数口径(反):toggle 喂 { data: skill } 信封形状 → 列表项名称变空...

 FAIL ... toggle 成功...
 AssertionError: expected false to be true
   expect(w.find('.sk-item-off').exists()).toBe(true)

 FAIL ... 单层取数口径(反)...
 AssertionError: expected 'renamed' to be ''
   expect(w.find('.sk-item-name').text()).toBe('')

 Test Files  1 failed (1)
      Tests  2 failed | 21 passed (23)
```

精确报红:只有 toggle 相关的 2 条红,其余 21 条(delete/create/test/+ 按钮等)不受影响,证明这两条测试确实锚定了 `onToggle` 的单层取数逻辑,不是空转。已用 `cp /tmp/SkillsSection.vue.bak` 还原,`git status`/`git diff --stat` 确认还原后与还原前 diff 完全一致(未残留探针改动)。

## 新增测试用例清单(`describe('SkillsSection(P3b 写操作半)')`,12 条)

1. 点击 `+` 打开弹窗(标题正确)
2. toggle 成功:裸 skill 原地替换 + toast
3. 单层取数(反):喂 `{data: skill}` → 列表项名称变空(RED 探针见上)
4. toggle 飞行中 busy 传给 SkillDetail,结束后清空
5. toggle 失败:danger toast(3000ms)+ 列表不变
6. 删除成功:从列表消失 + toast(system 区分卸载/删除文案)
7. **删的不是当前选中项时 activeId 不变**(brief 明确点名的条件)
8. 删除失败:danger toast + 列表存活
9. 创建成功:push + 选中 + 关弹窗 + toast
10. 创建失败(409 `skill already exists`)→ `createError` = `aiSkErrDuplicate` 文案 + 弹窗仍开 + 列表不变
11. 创建失败后取消关闭再打开:行内错误已清空(钉住协调者预先解掉的第 2 处)
12. onTest:只改当前选中项的 calls/last_used,不污染其它技能

（第 2/3/4/5/6/7/8/12 条(toggle/delete/onTest 相关)均用直接 `findComponent(SkillDetail).vm.$emit(...)` 触发——先例：本文件同一树里 `TestPanel` 用 `tp.vm.$emit('test')`,`SkillDetail.test.ts:665`。理由：`brief §10.2` 要求的「删的不是当前选中项」这个场景,UI 上没有天然入口能删除非选中项——SkillDetail 只渲染 `activeSkill` 的删除按钮——直接 emit 是测试 `SkillsSection` 处理逻辑本身、不依赖 UI 可达性的合理手法。第 1/9/10/11 条(+ 按钮/创建流程)走真实 DOM 点击/表单填写。）

## i18n

**复用,零新增**:`aiSkAddSkill`/`aiSkEnabledToast`/`aiSkPausedToast`/`aiSkUpdateFailed`/`aiSkUninstalledName`/`aiSkDeletedName`/`aiSkDeleteFailed`/`aiSkAddedName`/`aiSkErrDuplicate`/`aiCfgRefresh` 等,均已在 `zh_cn.ts`/`en_us.ts` 就位(grep 逐一核对过存在)。本任务未新增任何 i18n 键。

## §3 末三处回源复核

Task 8 不涉及技能 ID 正则、Task 1 色字面量扫描、Task 5 行内错误类名——这三处已在各自任务(T1/T2/T5)的报告里复核过,本任务未重复触碰相关代码,不重新复核。唯一新做的回源复核是上方「Vue2 对照」表里的后端响应形状(`route/v2/skills.go`)。

## 三门完整终值

```
pnpm test                   exit=0   Test Files  296 passed (296)   Tests  2554 passed (2554)
pnpm exec vue-tsc --noEmit  exit=0
pnpm build                  exit=0   (仅 >500KB chunk 警告,既有噪声)
```

无红项。`color-guard.test.ts` 单跑 167 例(本任务未新增 `.vue` 文件,`git status --porcelain` 确认只改了 4 个既有文件:`SkillsSection.vue`/`SkillsSection.test.ts`/`AddSkillModal.vue`/`skill.ts`,算术数不变)。

已知噪声 `persist.test.ts` 的 IndexedDB flaky 本次全量跑未出现,不需要复跑说明。

## 偏离清单汇总(供台账)

| # | 内容 | 依据 |
|---|---|---|
| 1 | onToggle/onCreate 单层取数 | 公共约束 §3 偏离 1 延伸 / brief §10.2 |
| 2 | console.error 不照抄(4 处) | 公共约束 §3 偏离 10 |
| 3 | `+` 按钮不传具名 color | 公共约束 §3 偏离 8 |
| 4 | onTest 乐观本地值,后端 RecordRun 零调用点 | 公共约束 §3 偏离 4(既有登记事实的另一半) |
| 5 | AddSkillModal 常挂(`v-model:open` 非 `v-if`) | 跟随既有先例(ChannelsSection/SkillDetail D4) |

---

# 修复轮(独立评审 Important #1)

评审 RED 探针发现:`删的不是当前选中项时 activeId 不变` 那条用例的原 fixture(`[a, b]`,选中 a,删 b)是空转——删完剩 `[a]`,不管 `onDelete` 里 `if (activeId.value === id)` 那个条件生效与否,`activeId` 落点都是 `a`,两种实现给出同一结果,断言分辨不出来(评审把条件整个删掉,23 例仍全绿)。

## 改了什么

### 1. `SkillsSection.test.ts` —— 重设「删的不是当前选中项」用例的 fixture

三项 `[a, b, c]`,先切到 **c**(不是删完后剩余列表 `[a, c]` 的第一项),再删 **b**——条件生效:`activeId` 仍是 `c`;条件被删(无条件回落 `skills[0]`):会错误跳成 `a`。两种实现在这个 fixture 下必然分道。

**RED 验证(把 `onDelete` 里的条件整段删掉,改成无条件 `activeId.value = skills.value[0]?.id ?? null`)**:

```
❯ src/ai/components/settings/sections/SkillsSection.test.ts (23 tests | 1 failed) 547ms
     × 删的不是当前选中项时 activeId 不变,详情面板仍显示原选中的技能

 FAIL ... 删的不是当前选中项时 activeId 不变...
 AssertionError: expected 'Skill A' to be 'Skill C'
   expect(w.find('.sk-name span').text()).toBe('Skill C')

 Test Files  1 failed (1)
      Tests  1 failed | 22 passed (23)
```

精确报红,只这一条(其余 22 条不受影响)。已用 `cp /tmp/SkillsSection.vue.bak2` 精确还原,`git diff --stat src/ai/components/settings/sections/SkillsSection.vue` 确认还原后与提交 `5fd5f19` 完全一致(空 diff),还原后重跑 23 例全绿。

### 2. 同档自查——发现同类问题一处,已一并修

自查了这个测试档里另外 11 条新用例,逐条核对「断言值是否在两种合理实现下恰好相同」。

**发现**:`onTest:只改当前选中项的 calls/last_used` 那条也中同一个坑。原版只在默认选中项 `a`(恰好是 `skills[0]`,index 0)上调用一次 `test()`,再切到 `b` 断言 `b` 没被污染——但如果实现把 `onTest` 里 `skills.value.findIndex(s => s.id === activeId.value)` 错写成硬编码 `idx = 0`,由于 `a` 恰好就是 index 0,断言值与"正确实现"完全相同,这条测试原样全绿,抓不到回归。

**RED 验证(把 `onTest` 的 `idx` 硬编码成 `0`)**——先用**原版**测试跑一遍,确认它抓不到:

```
❯ src/ai/components/settings/sections/SkillsSection.test.ts -t "onTest"
 Test Files  1 passed (1)
      Tests  1 passed | 22 skipped (23)
```

原版测试对 `idx = 0` 硬编码 bug **无判别力**(全绿本身就是问题所在,不是要保留的结论)。

**修复**:补一段——切到 `b` 之后**再调用一次** `test()`,断言改的是 `b`(index 1,`calls` 5→6)而不是 `a`;随后切回 `a` 确认它仍停在第一次调用后的值(4 次),没被第二次调用误伤。用**同一个** `idx = 0` 硬编码 bug 重跑修复后的测试:

```
❯ src/ai/components/settings/sections/SkillsSection.test.ts -t "onTest"
 ❯ src/ai/components/settings/sections/SkillsSection.test.ts (23 tests | 1 failed | 22 skipped) 93ms
     × onTest:只改当前选中项的 calls/last_used,不影响其它技能(乐观本地值,不落库)

 AssertionError: expected '— · 共 5 次' to contain 'Just now'
 ❯ ...ts:563:63
    561|     await flush()
    562|     expect(w.find('.sk-name span').text()).toBe('Skill B')
    563|     expect(w.findAll('.sk-meta-cell')[3].find('.val').text()).toContain('Just now')

 Test Files  1 failed (1)
      Tests  1 failed | 22 skipped (23)
```

精确报红,证明补的这一段真的抓住了「硬编码 idx」这类回归。已用 `cp /tmp/SkillsSection.vue.bak3` 精确还原(`git diff --stat` 确认空 diff),还原后重跑 23 例全绿。

其余 10 条(`+` 按钮/toggle 成功&失败/单层取数负例/busy 生命周期/delete 成功&失败/create 成功&失败/清错误)逐条核对过:每条的断言组合(具体 toast 文案、具体 id/name、具体列表长度、`busy` 对象的具体键值、弹窗开合状态)都足以在"正确实现"与至少一种合理的"错误实现"之间产生不同结果,没有再发现同类空转。

## 同档自查结论

**查过,发现并修了 1 处同类问题**(`onTest` 用例,见上);其余 10 条未发现「断言值恰好在两种实现下相同」的问题。

## 三门(修复后完整终值)

```
pnpm test                   exit=0   Test Files  296 passed (296)   Tests  2554 passed (2554)
pnpm exec vue-tsc --noEmit  exit=0
pnpm build                  exit=0   (仅 >500KB chunk 警告,既有噪声)
```

## Minor 处置

1. 报告里「17 条新用例」的口误已改成「12 条」(算术 2542→2554 本身是对的,只是用例条数写错)。
2. D4 弹窗依赖 `onToggle` 成功替换列表项的跨组件链路缺端到端整合测试——评审已判定为覆盖缺口非缺陷、记入台账留终审 triage,本轮未做(超出本次修复范围)。

## 提交

在 `5fd5f19` 之上新开一个提交,只改 `SkillsSection.test.ts`(未改任何生产代码文件)。
