# SP8-P3b Task 6 —— 实现者报告

`SkillDetail.vue` 顶部条写操作(开关 + 更多菜单 + 复制/导出)+ 删除/卸载确认弹窗。

工作区:`/home/nimo/NimoTech/.sp8/NimoOS-New-UI`,分支 `sp8-ai`,起点 `c27e050`(工作树干净)。

## 1. 改了哪些文件

- `src/ai/components/settings/skills/SkillDetail.vue` —— 主实现,+205/-4(净增约 201 行)。
- `src/ai/components/settings/skills/SkillDetail.test.ts` —— 新增 19 条用例 + 反转 1 条(19→38)。

未新增任何 `.vue` 文件(color-guard 用例数不受本任务影响,详见 §7)。

## 2. Vue2 `file:line` → New-UI 对照

蓝本:`/home/nimo/NimoTech/NimoOS-UI/src/views/AI/Skills/SkillDetail.vue`(271 行)。

| Vue2 | New-UI | 说明 |
|---|---|---|
| `:21-28` `.sw` 开关(`role="switch"` + `@click="$emit('toggle', …)"`) | `SetSwitch` 组件,`:model-value="skill.enabled"` `:disabled="!!busy[skill.id]"` `:title="switchTitle"` `@change="emit('toggle', skill.id, !skill.enabled)"` | 只接 `@change`,不接 `v-model`(任务书 6.1 §1 明确要求) |
| `:33-56` `menuWrap` + `.sk-pill-more` + `.sk-menu`(4 项 + `<hr>`) | 同构 `div ref="menuWrap"` + 按钮 + `v-if="menuOpen"` 的 `.sk-menu`,逐项对照见 §4 | 图标 `SkillIcon`→`AgentIcon`(承 P3a 偏离 2) |
| `:200-201` props `skill`/`busy` | `defineProps<{ skill; busy? }>()` + `withDefaults(busy: () => ({}))` | 类型化 |
| `:205-206` `data() { menuOpen, confirm }` | `ref(false)` ×2,`confirm` 改名 `confirmOpen`(避开与 Vue `computed` 场景下 `confirm` 全局函数同名的歧义,纯改名不改行为) | |
| `:214-225` `watch(menuOpen)` 条件式 add/removeEventListener | 复用既有 `useClickOutside` composable(见 §8 偏离说明,非三件套意义上的"偏离") | |
| `:226-229` `watch('skill.id')` 复位 `menuOpen`/`confirm` | `watch(() => props.skill?.id, () => { menuOpen.value=false; confirmOpen.value=false })` | 逐字对齐 |
| `:235` `closeAnd(fn)` | 同名函数,逐字对齐 | |
| `:236-239` `doDelete()` | 同名函数,逐字对齐(加 `if (!s) return` 空值防御,Vue2 里 `this.skill` 在弹窗存在时必非空,同等安全) | |
| `:240-242` `tryInChat()` | P3a 已落地,未改动 | |
| `:243-253` `copyMarkdown()` 手写 clipboard/execCommand 兜底 | `useCopyFeedback().copy()`(偏离申报 1,见 §8) | |
| `:255-262` `exportSkill()` | 同名函数,逐字对齐(隐藏 `<a>` + `download` + click + remove) | |
| `:64-73` 状态圆点内联 `:style` | P3a 已处理(`data-disabled` + 静态 CSS),本任务未动 | |
| `:155-184` 确认弹窗 DOM(`.sk-modal-bg`/`.sk-confirm`/`.sk-confirm-body`/`.sk-confirm-skill`/`.sk-modal-foot`) | reka `DialogRoot`/`DialogPortal to=".set-app" defer`/`DialogOverlay`/`DialogContent` 拼出同一套类名(偏离申报 2,见 §8) | |

## 3. 三门完整终值

```
pnpm test                      exit=0   Test Files  296 passed (296)   Tests  2532 passed (2532)
pnpm exec vue-tsc --noEmit     exit=0   (无输出)
pnpm build                     exit=0   built in 11.72s(仅既有 >500KB chunk 警告)
```

单独跑本文件:`pnpm vitest run src/ai/components/settings/skills/SkillDetail.test.ts` → 38 passed。

**噪声记录**:`pnpm test` 第一次跑时,出现 1 个与本任务无关的 `Unhandled Rejection`
(`window is not defined`,源头 `AgentComposer.test.ts` 的 vue-i18n `t()` 调用,teardown 时序
竞态),导致进程 exit=1 但个例仍全部标记 passed(296 files / 2532 tests / 1 error)。复跑一次
后干净通过(exit=0,同样 296/2532)。这是一条**新的**噪声(不是公共约束 §8 已登记的
`persist.test.ts` 那条),已在报告里如实记录,归属 `AgentComposer.test.ts`,与
`SkillDetail.vue`/`SkillDetail.test.ts` 无关联(不同文件、不同子系统)。

## 4. `.sk-menu` 逐项对照(Vue2 `:37-55` vs New-UI)

| 顺序 | Vue2 图标(SkillIcon) | New-UI 图标(AgentIcon) | 文案键(New-UI) | data-danger | 点击动作 |
|---|---|---|---|---|---|
| 1 | `pause` | `pause` | `enabled ? aiSkDisableTemporarily : aiSkEnable` | 否 | `closeAnd(toggleFromMenu)` → `emit('toggle', id, !enabled)` |
| 2 | `edit` | `edit` | `copiedKey==='skillmd' ? aiCopied : aiSkCopyMd` | 否 | `closeAnd(copyMarkdown)` |
| 3 | `download` | `download` | `aiSkExport` | 否 | `closeAnd(exportSkill)` |
| — | `<hr />` | `<hr>` | — | — | 分隔线,位置与 Vue2 完全一致(第 3 项之后、危险项之前) |
| 4 | `trash` | `trash` | `system ? aiSkUninstall : aiSkDeleteSkill` | `true` | `closeAnd(() => { confirmOpen = true })` |

顺序、图标名、`data-danger` 落点、`<hr>` 位置与 Vue2 `:37-55` 一一对应,零插错。

## 5. i18n 复用/新增

**本任务零新增键** —— T2 已把全部所需键铺好。复用清单:`aiSkDisable` / `aiSkEnable` /
`aiSkDisableTemporarily` / `aiSkCopyMd` / `aiSkExport` / `aiSkUninstall` / `aiSkDeleteSkill` /
`aiSkDelete` / `aiSkUninstallTitle` / `aiSkDeleteTitle` / `aiSkUninstallBody` / `aiSkDeleteBody` /
`aiSkNPrevRuns` / `aiCopied` / `aiCancel`。逐字核对 `zh_cn.ts`/`en_us.ts` 两档均在、值未改动。

## 6. RED→GREEN 证据

**探针 1(开关 emit)**:把 `SetSwitch` 的 `@change="emit('toggle', skill.id, !skill.enabled)"`
临时改成 `@change="() => {}"`,单跑
`开关:data-on/aria-checked 反映 enabled,点击 emit toggle(id, !enabled)` →
```
AssertionError: expected undefined to deeply equal [ [ 'sk-1', false ] ]
```
还原后 `diff` 与备份文件逐字节相同,复跑该用例绿。

**探针 2(外部点击关闭菜单)**:把 `useClickOutside(menuWrap, () => { menuOpen.value = false })`
临时改成 `useClickOutside(menuWrap, () => {})`,单跑
`更多菜单:外部 mousedown 关闭菜单,菜单内部点击不触发外部关闭逻辑` →
```
AssertionError: expected true to be false
```
还原后 `diff` 与备份文件逐字节相同,复跑该用例绿。

两次探针后都执行 `diff /tmp/SkillDetail.vue.bak src/.../SkillDetail.vue` 确认 `IDENTICAL`,
`git status` 干净(只有本任务的两处改动)。

## 7. 算术核对

本任务**未新增任何 `.vue` 文件**,只改了既有的 `SkillDetail.vue`。color-guard 用例数不受本
任务影响(brief 提到的「本期新增 2 个 `.vue`」指整个 P3b 期的 TestPanel/AddSkillModal,均已在
Task 4/5 落地,不计入本任务)。

## 8. 偏离显式申报

**偏离申报 1(公共约束 §3 偏离 12)**:复制走 `useCopyFeedback`(内部 `copyText` execCommand
兜底 + toast + 打勾态),不照抄 Vue2 `:243-253` 手写的 `navigator.clipboard.writeText` +
临时 `<textarea>` + `document.execCommand('copy')` 那份兜底。理由:公共约束 §3 已授权此项
(第 12 条),复用现成 composable,行为等价(复制失败会有 `aiCfgCopyFailed` toast,比 Vue2
纯静默失败更好)。

**偏离申报 2(任务书 6.1 协调者修订,公共约束 §3 偏离 11 的延伸)**:删除确认弹窗不套 `SkModal`,
直接用 reka Dialog 原语(`DialogRoot`/`DialogPortal to=".set-app" defer`/`DialogOverlay`/
`DialogContent` + `VisuallyHidden`+`DialogTitle`)拼出 Vue2 `:155-184` 的确切 DOM。理由见任务书
6.1(`SkModal` 强制标题栏+关闭按钮、`.sk-modal-body` padding 会与 `.sk-confirm-body` 叠加、
`.sk-modal` 类写死加不上 `.sk-confirm`)。确认/取消按钮用纯 `<button @click>`,不用
`AlertDialogAction`/`DialogClose`(躲开 P1c1 Task 11 那条"`update:open` 先于自定义 handler"的
时序坑,虽然本组件的 handler 只读 `props.skill.id`、不依赖 `open` 状态,天然不受影响,但仍按
`SkModal.vue` 关闭按钮的既有写法保持风格一致)。

**实现选择说明(非三件套意义上的"偏离",类比 `SetSwitch.vue` 头注释里
"v-model/update:modelValue 是框架 API 差异,非行为改动"那条)**:外部点击关闭菜单复用了已有的
`useClickOutside` composable(`src/ai/composables/useClickOutside.ts`,已有先例
`ModelPicker.vue:26,69`),而不是手写 Vue2 `:214-225` 那份 `watch(menuOpen)` 里条件式
add/removeEventListener。对用户可见行为完全等价(外部 mousedown 关闭菜单、组件卸载后监听器
必移除,已用 RED 探针 2 验证),且 `useClickOutside` 用 `onMounted`/`onUnmounted` 无条件挂/摘,
反而没有 Vue2 那种"仅当 `menuOpen` 为真才挂监听"的条件竞态面(P1c1 Task 7 的泄漏正是出在
条件式挂载的时序上)。之所以不算需要三件套申报的"偏离":公共约束 §2 的偏离定义针对的是
"逻辑/bug 不照抄"(修一个可复现的错误行为),而这里是纯框架实现手段的等价替换,不改变任何
可观察行为,与 SetSwitch.vue 已有先例同一性质。若协调者认为仍应申报,请指出,我可以补一条
台账项。

**vue-tsc 窄化绕行(工程细节,非行为偏离)**:菜单第一项最初写成模板内联
`closeAnd(() => emit('toggle', skill.id, !skill.enabled))`,vue-tsc 报
`TS18047 'skill' is possibly 'null'`(`v-else` 分支的非空窄化不穿透进内联箭头函数体)。改成
具名函数 `toggleFromMenu()`(在 `<script>` 里用 `props.skill` 重新判空),模板改成
`closeAnd(toggleFromMenu)`。行为与内联写法完全等价,不涉及三件套。

## 9. §3 末三处回源复核

本任务未涉及技能 ID 正则、Task 1 色字面量扫描、Task 5 行内错误类名——这三处分别属于
Task 2/1/5,均已在各自任务完成。本任务复核的是自己动到的部分:

- `.sk-menu`/`.sw`/`.sk-pill-more`/`.sk-modal-bg`/`.sk-modal`/`.sk-confirm*`/`.sk-modal-foot`/
  `.sk-btn` 全部 `grep` 确认存在于 `skills-styles.scss`/`sk-shared.scss`(见文件头注释列表),
  未凭空造类。
- i18n 键(§5 清单)逐个 `grep` 确认在 `zh_cn.ts`/`en_us.ts` 均已存在,值未改动、未新增。

## 10. 既有用例反转(改前/改后原文)

**改前**(P3a 版本,`SkillDetail.test.ts` 原 `:57-67`):
```js
  it('顶部条:标题/name code/试用按钮,不渲染开关与更多菜单(P3b 范围)', () => {
    const w = mountDetail(makeSkill({ title: 'Weekly Report', name: 'weekly-report' }))
    expect(w.find('.sk-name span').text()).toBe('Weekly Report')
    expect(w.find('.sk-name code').text()).toBe('weekly-report')
    expect(w.find('.sk-pill-try').exists()).toBe(true)
    expect(w.find('.sk-pill-try').text()).toContain('在对话中试用')
    // §5.2 明确不取的写操作控件,必须完全不出现。
    expect(w.find('.sw').exists()).toBe(false)
    expect(w.find('.sk-pill-more').exists()).toBe(false)
    expect(w.find('.sk-menu').exists()).toBe(false)
  })
```

**改后**(本任务):
```js
  // 【反转,SP8-P3b Task 6,公共约束 §9 明确要求「反转不是删除」】P3a 版本断言这
  // 三个写操作控件「必须完全不出现」;P3b 落地后 `.sw`/`.sk-pill-more` 必须渲染,
  // `.sk-menu` 仍是 false ——但语义已经从「永不渲染」变成「默认收起」(菜单展开的
  // 交互由下方专项用例覆盖)。改前/改后原文已贴进任务报告。
  it('顶部条:标题/name code/试用按钮/开关/更多菜单按钮全部渲染(P3b 写操作落地)', () => {
    const w = mountDetail(makeSkill({ title: 'Weekly Report', name: 'weekly-report' }))
    expect(w.find('.sk-name span').text()).toBe('Weekly Report')
    expect(w.find('.sk-name code').text()).toBe('weekly-report')
    expect(w.find('.sk-pill-try').exists()).toBe(true)
    expect(w.find('.sk-pill-try').text()).toContain('在对话中试用')
    expect(w.find('.sw').exists()).toBe(true)
    expect(w.find('.sk-pill-more').exists()).toBe(true)
    expect(w.find('.sk-menu').exists()).toBe(false)
  })
```

`.sw`/`.sk-pill-more` 从 `false` 反转为 `true`(证明控件确实渲染了);`.sk-menu` 保留 `false`
是因为菜单默认收起(与 Vue2 `menuOpen: false` 初始态一致),该值本身是新语义下的正确断言,不是
削弱——菜单**会**展开这件事由新增的 `更多菜单:点击 .sk-pill-more 开合` 等专项用例覆盖并用
RED 探针验证过外部关闭逻辑(见 §6)。

**`:146` 那条(TestPanel 占位)完全未动**,按公共约束与任务书要求原样保留,不属于本任务范围。

## 11. 关键测试清单(38 条,新增 19 条 + 反转 1 条)

新增用例名(节选,完整列表见 diff):开关反映 enabled/disabled 且 emit toggle · busy[id] 驱动
disabled · 更多菜单开合 · 外部 mousedown 关闭(RED 验证过)· 菜单项顺序/文案/data-danger/`<hr>`
位置 · 暂停/启用双态文案 · 内置/用户危险项文案 · 复制调 `copyText`(含空字符串边界)·
导出 `<a>` href/download(含 name 为空时回落 `skill.tar.gz`)· 危险项打开确认弹窗(含 portal
落点断言)· 内置/用户确认弹窗标题/正文/按钮文案(含 D3 "不含重新安装" 钉子)· 确认/取消按钮的
emit 与关闭 · `skill.id` 变化复位菜单与确认弹窗(两条独立用例)。
