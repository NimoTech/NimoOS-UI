# SP8-P3b Task 7 报告 —— SkillDetail.vue D4 弹窗 + 挂 TestPanel

提交:`d8078aa`(`sp8-ai` 分支,基于 `c13e102`)
改动文件:
- `src/ai/components/settings/skills/SkillDetail.vue`
- `src/ai/components/settings/skills/SkillDetail.test.ts`

## 1. 逐文件改了什么

### SkillDetail.vue

1. **import**:新增 `SkModal from '../SkModal.vue'`、`TestPanel from './TestPanel.vue'`。
2. **emits**:新增 `test: []`,由 TestPanel 的 `test` 原样转发(不加任何本文件自己的触发条件)。
3. **新状态**:
   - `tryModalOpen = ref(false)` —— D4 弹窗开合。
   - `pendingTryId = ref<string | null>(null)` —— 「启用并试用」一次性挂号,记录**发起请求那一刻的技能 id**(不是布尔标志)。
4. **既有 `watch(() => props.skill?.id, …)`**(Vue2 `:226-229` 对应的复位 watch)追加两行:`tryModalOpen.value = false`、`pendingTryId.value = null`。
5. **`tryInChat()`**:对齐 Vue2 `:240-242`,但改成正确逻辑(见下方偏离③)——`skill.enabled === false` 时不跳转,改开 `tryModalOpen`;`enabled === true` 行为不变(P3a 已实现,直接 `router.push`)。
6. **新函数**:
   - `confirmEnableAndTry()`:关弹窗 → 记 `pendingTryId = s.id` → `emit('toggle', s.id, true)`。
   - `cancelTryModal()`:关弹窗 → `pendingTryId = null`。
7. **新 `watch(() => props.skill?.enabled, …)`**:仅当 `pendingTryId` 非空、当前 `skill.id === pendingTryId`、且新值为 `true` 时,清空挂号并 `router.push`。
8. **模板**:
   - 在「描述」`.sk-section` 与 `SKILL.md` `.sk-section` 之间插入 `<TestPanel :key="skill.id" :skill="skill" @test="emit('test')" />`,填掉 P3a 留的占位注释。
   - 在既有删除确认弹窗(reka 原语)之后新增一个 `<SkModal>` 块作为 D4 弹窗:`:title="t('aiSkTryDisabledTitle')"`,正文 `<p>{{ t('aiSkTryDisabledBody') }}</p>`,`#footer` 里 `.sk-btn.ghost`(`aiCancel` → `cancelTryModal`)+ `.sk-btn.primary`(`aiSkTryEnableAndTry` → `confirmEnableAndTry`)。

### SkillDetail.test.ts

- 反转 P3a 的 TestPanel 占位用例(见 §5)。
- 修正「附带文件:逐行渲染…」用例里 `.sk-section-hint` 的期望长度/下标(3→4,`hints[2]`→`hints[3]`)——TestPanel 挂回后自带一个段头 hint,是结构性位移,不是断言被削弱。
- 新增 7 条用例(D4 五条 + P3a 回归一条 + test 转发一条),见 §4。

## 2. Vue2 file:line → New-UI 对照

| Vue2 | New-UI |
|---|---|
| `SkillDetail.vue:240-242 tryInChat()` | `tryInChat()`,新增 `enabled === false` 分支 |
| `SkillDetail.vue:108-112`(TestPanel 位置) | `<TestPanel>` 挂在描述段与 SKILL.md 段之间 |
| （无对应)| D4 弹窗(`tryModalOpen`/`SkModal`)—— 本期新增,见偏离③ |

## 3. 承接了 Vue2 哪些行为

- `enabled === true` 时点「在对话中试用」直接 `router.push({ path: '/ai/agent', query: { skill } })`,与 Vue2 `:240-242` 完全一致(P3a 已实现,本任务未改动这条分支,只是补了回归用例)。
- TestPanel 在详情页里的挂载位置(描述段与 SKILL.md 段之间)与 `:key="skill.id"` 严格对齐 Vue2 `:108-112`/`:109`。

## 4. 新增测试用例清单

1. `D4:停用技能点「在对话中试用」不跳转,弹出确认弹窗(标题/正文命中 i18n 文案)`
2. `D4「启用并试用」:emit toggle(id,true) 且此刻未 push;父组件把 enabled 改成 true 后才 push`
3. `D4:toggle 失败(父组件不改 enabled)→ 永不 push`
4. `D4:点「取消」关闭弹窗,不 push、不 emit toggle`
5. `D4「启用并试用」挂号后切到别的技能,原技能迟到的 enabled=true 不再触发 push(残留清除,pendingTryId 一次性语义)`
6. `enabled === true 时点「在对话中试用」直接跳转,不弹 D4 弹窗(P3a 既有行为未回归)`
7. `TestPanel 的 test 事件被向上转发成本组件的 test emit`

D4 弹窗断言走 `.sk-modal-title`/`.sk-btn.primary`/`.sk-btn.ghost`(`SkModal` 标准壳既有先例,同 `ChannelsSection.test.ts`「3. genCode…」用例),不是删除确认弹窗专属的 `.sk-confirm*` 类名——两套弹窗断言手法刻意分开,呼应组件里两套外壳并存。

## 5. 反转用例:改前 / 改后原文

**改前**(P3a Task 5):
```ts
it('TestPanel 占位:描述段与 SKILL.md 段之间没有渲染任何写操作控件(P3b 范围)', () => {
  const w = mountDetail(makeSkill())
  expect(w.findComponent({ name: 'TestPanel' }).exists()).toBe(false)
  expect(w.find('.sk-test').exists()).toBe(false)
})
```

**改后**(本任务):
```ts
it('TestPanel 挂载在描述段与 SKILL.md 段之间(P3b 落地,按 DOM 顺序断言,不只是「存在」)', () => {
  const w = mountDetail(makeSkill())
  const tp = w.findComponent({ name: 'TestPanel' })
  expect(tp.exists()).toBe(true)
  const titles = w.findAll('.sk-section-title').map((n) => n.text())
  expect(titles).toEqual(['描述', '沙箱测试', 'SKILL.md', '附带文件'])
})
```
用 `.sk-section-title` 的完整 DOM 顺序断言,而不只是「TestPanel 存在」——后者即使 TestPanel 被插到文件末尾也会通过,钉不住「夹在描述段与 SKILL.md 段之间」这个位置要求。

## 6. RED → GREEN 证据

### 证据 1:`skill.id` 变化时清空 `pendingTryId` 的复位 watch(残留清除测试的真实防线)

破坏(从 id-reset watch 里删掉 `pendingTryId.value = null` 一行):
```
 FAIL  ... > D4「启用并试用」挂号后切到别的技能,原技能迟到的 enabled=true 不再触发 push(残留清除,pendingTryId 一次性语义)
AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times
Received: 1st vi.fn() call: [ { path: "/ai/agent", query: { skill: "sk-10" } } ]
```
复原后:该用例单独跑绿,全文件 45/45 绿。

### 证据 2:「启用并试用」成功才跳转(`enabled === true` 分支)

破坏(把判断改成 `enabled === false`):
```
 FAIL  ... > D4「启用并试用」:emit toggle(id,true) 且此刻未 push;父组件把 enabled 改成 true 后才 push
AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
```
复原后:该用例单独跑绿,全文件 45/45 绿。

### 附加说明:`s.id !== pendingTryId.value` 这层 id 核对未能独立 RED

我曾尝试单独破坏 `watch(enabled)` 里的 `s.id !== pendingTryId.value` 检查来验证它的判别力,但因为**同一次 `props.skill` 更新会同时触发 id-reset watch 与 enabled-watch**,而 id-reset watch 在本文件里注册在前、按 Vue 调度顺序先跑并已经把 `pendingTryId` 清空,enabled-watch 的 `!pendingTryId.value` 前置 guard 先短路退出——这条 id 核对在当前测试路径下**永远轮不到被执行**,删掉它现有测试仍然全绿。它是「不依赖 Vue watcher 调度顺序」这条设计原则的防御性冗余(注释里已如实写明这一点),不是被测试覆盖的必要逻辑。如实申报,不假装它被 RED 验证过。

## 7. 三门完整终值

```
pnpm test                  exit=0   Test Files  296 passed (296)   Tests  2539 passed (2539)
pnpm exec vue-tsc --noEmit exit=0   (空输出)
pnpm build                 exit=0   built in 11.93s(仅既有第三方 chunk 体积警告)
```
无红项,无需复跑既知 flaky(`persist.test.ts`)。

**算术核对**:本任务未新增 `.vue` 文件,单独跑 `color-guard.test.ts` + `SkillDetail.test.ts`:改动前(`c13e102`)205 例 → 改动后 212 例,增量恰为本任务新增的 7 条用例,color-guard 自身用例数不变。

## 8. i18n 复用/新增键清单

- 全部复用,**零新增**:`aiSkTryDisabledTitle` / `aiSkTryDisabledBody` / `aiSkTryEnableAndTry` / `aiCancel`(T2 已就位,已在 `zh_cn.ts`/`en_us.ts` 核对存在且未重复定义)。

## 9. 每一条偏离显式申报

### 偏离①(公共约束 §3 偏离 11,延续):D4 弹窗用 `SkModal`,不用 reka 原语

D4 这个弹窗 **Vue2 里完全不存在**(用户 2026-07-30 拍板新增,收 P3a 挂账③)。因为没有逐像素复刻目标,直接用现成标准壳 `SkModal`(`:open`+`@update:open`+默认插槽+`#footer`,先例 `sections/ChannelsSection.vue:427`),拿它自带的 Esc/焦点陷阱/`.set-app` 作用域处理免费。

**两种弹窗外壳并存的理由已写进代码注释**(`SkillDetail.vue` 文件头「两种弹窗外壳并存,不是不一致」一节,以及 D4 弹窗模板处的就地注释):删除确认弹窗要逐像素复刻 Vue2 一个没有标题栏的弹窗,`SkModal` 的强制标题栏套不上去,所以手拼 reka 原语;D4 没有复刻目标,直接用标准壳。两者选型依据同一条规则,不是风格漂移。

### 偏离②(公共约束 §3 偏离 3):D4 收 P3a 挂账③,修正 `tryInChat()` 的错误行为

Vue2 `SkillDetail.vue:240-242 tryInChat()` 完全不检查 `skill.enabled`,对停用的技能也会直接跳转到对话页——但后端 `NimoOS-AI/service/skills_runtime.go:57` 把 `disabled` 的技能排除出运行时视图,`X-Skill-Id` 照发但 agent 找不到对应 `SKILL.md`,导致跳转过去后界面零反馈。这是一个**可复现的错误行为**(判据:公共约束 §2),不是要 1:1 复刻的视觉/交互,所以改成:`enabled === false` 时不跳转,弹 D4 确认;`enabled === true` 时行为不变。

### `pendingTryId` 一次性语义的推演(任务书 §验收要求)

- **实现**:`pendingTryId: Ref<string | null>`,记录「启用并试用」发起那一刻的技能 id(不是布尔标志)。`confirmEnableAndTry()` 里设置;两处清空:一是 `watch(() => props.skill?.enabled, …)` 命中 `id 匹配 && enabled===true` 时清空并跳转;二是 `cancelTryModal()`;三是既有 `watch(() => props.skill?.id, …)` 复位 watch 里清空。
- **清除路径①(跳转后立即清空)**:`watch(enabled)` 回调里 `pendingTryId.value = null` 与 `router.push(...)` 在同一次回调、同一行紧邻,清空发生在跳转**之前**(先清后跳,顺序不影响正确性,因为两者都是同步语句,清空发生在本次回调返回前)。之后无论这个技能的 `enabled` 再怎么变化(比如用户以后手动开关它),`!pendingTryId.value` guard 都会短路退出,**不会重复跳转**——不存在「以后每次 enabled 变 true 都跳转」的残留:该 ref 只在 `confirmEnableAndTry()` 里被设置一次性写入,写入后唯一的读取路径就是这个 watch,一读即清。
- **清除路径②(取消)**:`cancelTryModal()` 直接 `pendingTryId.value = null`,且此函数只在用户点「取消」时调用、点击时 `pendingTryId` 此刻必为 `null`(因为「取消」出现在弹窗打开阶段,而弹窗打开时还没调用过 `confirmEnableAndTry`)——这条路径实际是防御性的(等幂),真正的负载在路径③。
- **清除路径③(`skill.id` 变化)**:与既有 `menuOpen`/`confirmOpen` 复位共用同一个 `watch(() => props.skill?.id, …)`,新增一行清空 `pendingTryId`。RED→GREEN 已验证(§6 证据 1):删掉这一行,「挂号后切到别的技能,原技能迟到的 enabled=true 不再 push」用例立即报红。
- **为什么不出现「以后每次 enabled 变 true 都跳转」**:`pendingTryId` 默认值是 `null`,只有显式调用 `confirmEnableAndTry()` 才会被赋非空值,且赋值后的**唯一**出路是被上述三条路径之一清空。清空动作都是同步、无条件的(不依赖网络往返或计时器),所以在任意两次「用户点击启用并试用」之间,`pendingTryId` 处于非空状态的窗口严格限定在「点击『启用并试用』」到「三条清除路径之一触发」之间,不会跨技能、跨会话残留。
- **watcher 调度顺序的补充说明**:`watch(enabled)` 内部额外核对了 `s.id === pendingTryId.value`,意图是不依赖「id-reset watch 一定先于 enabled-watch 执行」这个 Vue 内部实现细节。但实测(见 §6 附加说明)由于两个 watch 都挂在同一个 `props.skill` 上、id-reset watch 注册在前,当前测试路径下 id-reset watch 总是先跑、已经把 `pendingTryId` 清空,这条 id 核对因此从未被现有测试逼到「真正需要它」的分支——如实标注为防御性冗余,不谎报它被 RED 验证过。

## 10. 公共约束 §3 末三处回源复核

本任务未新增技能 ID 校验逻辑、未碰 Task 1 的 scss 颜色扫描、未碰 Task 5 的行内错误类名,三处复核结论均为「与本任务无关,沿用此前任务的复核结论,未重新触碰」。

---

## 11. 评审后修订(2026-07-30,独立评审 2 Important)

提交:`<待填,见下方 commit>`(在 `d8078aa` 之上新开一个提交)。
改动文件:同上两个(`SkillDetail.vue` / `SkillDetail.test.ts`)。

### Important 1 —— 任务书漏了设计文档 §9.4 的一句,以设计文档为准

设计文档 `NimoOS-UI/docs/superpowers/specs/2026-07-30-vue3-migration-sp8-p3b-skills-write-design.md`
§9.4 原话:「启用并试用」→ 先 `toggle(id, true)`,**成功才跳转**;**失败则留在弹窗** + danger
toast,不跳转。协调者给的任务书把这句简化成了「发 toggle 后关弹窗」,只留了后半句(失败不跳
转),漏了前半句(弹窗必须留到成功为止)——这是任务书对设计文档的简化遗漏,不是我的实现选
择,按设计文档改。

**改了什么**:
- `confirmEnableAndTry()` 不再在发 `toggle` 那一刻就 `tryModalOpen.value = false`。现在它只做两
  件事:记挂号(`pendingTryId.value = s.id`)+ `emit('toggle', s.id, true)`。弹窗保持打开。
- `watch(() => props.skill?.enabled, …)` 命中「id 匹配 && `enabled===true`」的成功分支里,新增
  `tryModalOpen.value = false`,与清挂号、`router.push` 三件事在同一个回调里**同一步**发生——
  这就是「成功才跳转,同时才关弹窗」的实现落点。
- toggle 失败时父组件不改 `enabled`,`watch` 不会看到值变化,回调不会执行,`tryModalOpen` 保
  持 `true`——弹窗天然留在原地,不需要额外的失败分支。danger toast 由父组件
  (T8 `SkillsSection.onToggle`)负责,本组件没有、也不应该重复发。
- **顺带(自主判断范围,非设计文档强制,已在代码注释里说明)**:「启用并试用」按钮加了
  `:disabled="!!busy[skill.id]"`——`busy` 是父组件在 toggle/delete 请求飞行中维护的 id 集合
  (既有 prop,`.sw` 开关已经在用同一个字段禁用),这里复用同一约定防止请求还没返回时被连续
  点击、叠加发出多条 `toggle` 请求。

**测试改动**:原「emit toggle(id,true) 且此刻未 push;父组件把 enabled 改成 true 后才 push」一
条拆成两条(各自更聚焦):
1. `D4「启用并试用」:点击后弹窗仍开、未 push,只 emit toggle(id,true)`——断言
   `host.querySelector('.sk-modal-title')` 仍然可查到(弹窗没关)。
2. `D4「启用并试用」:父组件把 enabled 真的改成 true(toggle 成功)后,弹窗关闭 + push 同一步
   发生`——`setProps` 到 `enabled:true` 之后才断言 push 与弹窗消失。

`D4:toggle 失败(父组件不改 enabled)→ 弹窗仍开、永不 push`(原「→ 永不 push」)追加一行断
言:`host.querySelector('.sk-modal-title')` 在失败之后仍然存在。

### Important 2 —— `pendingTry` 两道核心防线补测试 + RED 验证

评审的 RED 探针发现:删掉「跳转前清空 `pendingTryId`」那行、以及删掉 `if (enabled === true)`
判断,原 45 条用例零报红。新增两条用例分别钉住这两道防线,并各自做了一次 RED→GREEN。

**用例 1**:`D4:成功跳转一次后,同一技能之后被手动开关多次,push 总次数仍是 1(挂号已被消费,
不会残留重复触发)`——走完一次完整的成功流程(push 一次)后,不改 `skill.id`,直接把
`enabled` 改 `false` 再改回 `true`(模拟用户后来自己用开关启用),断言 push 总次数仍是 1。

RED 验证(删掉成功分支里的 `pendingTryId.value = null`,只留 `tryModalOpen.value = false` +
`router.push`):
```
 FAIL  ... > D4:成功跳转一次后,同一技能之后被手动开关多次,push 总次数仍是 1(挂号已被消费,不会残留重复触发)
AssertionError: expected "vi.fn()" to be called 1 times, but got 2 times
 ❯ src/ai/components/settings/skills/SkillDetail.test.ts:623:18
```
还原后该用例与全文件 48/48 重新变绿。

**用例 2**:`D4:挂号后 watcher 第一次真正触发时 enabled 是 false(不是 true)→ 不 push(钉住
\`if (enabled === true)\` 判断)`。这条需要一个能让 `watch(enabled)` 在 `pendingTryId` 已挂号
的情况下**第一次真正触发时收到 `false`** 的场景——由于 Vue 的 `watch` 只在值真的变化时才回
调,而 `pendingTryId` 只能在 `skill.enabled` 当前是 `false` 时被设置(只有走 D4 弹窗才会设
置,弹窗只在 `enabled===false` 时打开),从 `false` 出发的第一次变化必然是变成 `true`——不
存在「从 false 直接变到 false」的可观察事件。所以构造了一个合成竞态来制造「变化到 true 但
`pendingTryId` 还没挂号,随后才挂号,此后再变回 false」的顺序:
1. 打开 D4 弹窗(`enabled:false`),**还没点确认**(`pendingTryId` 仍是 `null`)。
2. 技能被别处启用(`setProps enabled:true`)——`watch(enabled)` 触发,但因为 `!pendingTryId.value`
   guard 直接短路退出,不产生任何影响。
3. 用户此刻才点确认——`pendingTryId` 挂号,`emit('toggle', id, true)`。因为 `enabled` 已经是
   `true`(上一步已经变了),不会再有「变成 true」的事件触发 `watch`,`pendingTryId` 悬而不清。
4. `enabled` 被别处改回 `false`——这是 `watch(enabled)` 挂号后**第一次真正触发**,`newVal` 是
   `false`。断言不 push。

RED 验证(把 `if (enabled === true)` 判断整段删掉,变成 id 匹配后无条件清挂号 + 关弹窗 + push):
```
 FAIL  ... > D4:挂号后 watcher 第一次真正触发时 enabled 是 false(不是 true)→ 不 push(钉住 `if (enabled === true)` 判断)
AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times
Received: 1st vi.fn() call: [ { path: "/ai/agent", query: { skill: "sk-9" } } ]
 ❯ src/ai/components/settings/skills/SkillDetail.test.ts:649:22
```
还原后该用例与全文件 48/48 重新变绿。

两次破坏均已用 `Edit` 精确还原,`git diff` 校验最终代码与还原前一致(见下方三门结果里的
`git status`/`git diff --stat`)。

### Minor(协调者已记账延后,未改动)

`s.id !== pendingTryId.value` 那条分支结构性不可达(两个 watch 同订阅 `props.skill`,id-watch
先声明,同一 tick 内先跑并已清空 `pendingTryId`)——维持防御性冗余原状,没有为了「造出能覆盖
它的用例」去写一个依赖 Vue 内部 effect 调度顺序的测试。

### 修复后测试覆盖

- `SkillDetail.test.ts` 单独跑:48/48 绿(比 Task 7 首次提交的 45 条 +3:Important 1 把 1 条拆
  成 2 条 +1、Important 2 新增 2 条)。
- 全量三门(`/tmp/p3b-test-t7fix.log` / `/tmp/p3b-tsc-t7fix.log` / `/tmp/p3b-build-t7fix.log`):
  ```
  pnpm test                  exit=0   Test Files  296 passed (296)   Tests  2542 passed (2542)
  pnpm exec vue-tsc --noEmit exit=0   (空输出)
  pnpm build                 exit=0   built in 11.94s(仅既有第三方 chunk 体积警告)
  ```
  2542 - 2539(首次提交时的全量数)= +3,与 `SkillDetail.test.ts` 的净增量一致;本次修复未新
  增 `.vue` 文件,color-guard 用例数不受影响。
