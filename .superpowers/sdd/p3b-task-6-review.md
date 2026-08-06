# SP8-P3b Task 6 —— 独立评审(SkillDetail 写操作 + 删除确认弹窗)

评审者:独立于实现者,不采信报告,自行 grep/读源/跑测试。
工作区:`/home/nimo/NimoTech/.sp8/NimoOS-New-UI`,分支 `sp8-ai`,提交 `c13e102`,BASE `c27e050`。

## 判定

- **规格合规:✅** —— 顶部条控件位置/顺序、`.sk-menu` 四项+`<hr>`、确认弹窗内容,逐项对 Vue2 蓝本 `SkillDetail.vue`(271 行)均一致。零新增 i18n 键(全部复用 T2 已铺好的键),值逐字核对生产语言包已存在且未改动。
- **代码质量:通过** —— 零 `<style>` 块,所有用到的 CSS 类(`.sw`/`.sk-pill-more`/`.sk-menu`/`.sk-modal-bg`/`.sk-modal`/`.sk-confirm*`/`.sk-modal-foot`/`.sk-btn`/`.right`)均已 grep 确认存在于 `sk-shared.scss`/`skills-styles.scss`。无 hex/rgb/具名色(仅注释里提及 Vue2 旧代码的 `rgba(...)` 字面量,非违规)。

## 发现

无 Critical / Important / Minor 发现。逐条硬约束核查结果:

1. **顶部条位置与顺序**:`.sw`(SetSwitch)确认位于 `.sk-name` 与 `.sk-pill-try` 之间(`SkillDetail.vue:253-258`);`.sk-pill-more`+`.sk-menu` 确认位于 `.sk-pill-try` 之后(`:266-289`)。与 P3a 占位注释标位一致,无插错。
2. **`.sk-menu` 四项+`<hr>`**:逐项对 Vue2 `:37-55` —— 图标名(`pause`/`edit`/`download`/`trash`)、文案键、顺序、`data-danger="true"` 落在第 4 项、`<hr>` 位于第 3、4 项之间,全部一致。停用/启用文案在 enabled/disabled 两态分别是 `aiSkDisableTemporarily`/`aiSkEnable`,与 Vue2 `:40` 一致。
3. **确认弹窗内容**:对 Vue2 `:155-184` —— 两套标题(`aiSkUninstallTitle`/`aiSkDeleteTitle`)、两套正文(`aiSkUninstallBody`/`aiSkDeleteBody`,内置那条经 D3 改写「说实话」,已核实两档语言包都不含「重新安装」字样)、`.sk-confirm-skill`(SkillTile 28/8 + 名称 + `aiSkNPrevRuns`)、底栏取消+danger 按钮(两套文案 + `trash` 图标)全部对齐。
4. **T7 边界**:`grep TestPanel` 确认 `:166-167`(即当前文件 `:329` 处的占位注释)与 test 文件里「TestPanel 占位」用例(现文件行号 `:192-194`,对应任务书说的原 `:146`)本次 diff 完全未触碰 —— `package.md` 的 diff hunk 里不含这段。未越界。
5. **既有用例反转**:`SkillDetail.test.ts` 原 `:57-67`「不渲染开关与更多菜单(P3b 范围)」的 `expect(...).toBe(false)`×3(`.sw`/`.sk-pill-more`/`.sk-menu`)已改为 `.sw`/`.sk-pill-more` → `true`(反转),`.sk-menu` 保留 `false`(菜单默认收起,新语义下的正确断言,菜单展开由新增专项用例覆盖并有 RED 验证)。是反转不是削弱,未见任何既有断言被拿掉或减弱。
6. **reka Dialog 用法**:`DialogPortal to=".set-app" defer` 确认存在(`:372`,与 `SkModal.vue` D1 先例一致);`<VisuallyHidden as-child><DialogTitle>` 确认存在(`:375`),写法与 `SearchDialog.vue:317` 先例完全一致。
7. **`useClickOutside` 替换的等价性(独立判定)**:已读 `src/ai/composables/useClickOutside.ts` 全文。判定为**等价，且不构成需申报的逻辑偏离**:
   - 事件同为 `mousedown`,均在冒泡阶段(非 capture),不拦 `touchstart`,与 Vue2 `:214-225` 一致。
   - 命中判定 `!el.contains(event.target as Node)` 与 Vue2 的 `!w.contains(e.target)` 逐字等价。
   - 挂载在 `onMounted`、摘除在 `onUnmounted`,同步无条件挂/摘,不存在"await 之后再挂"的时序泄漏面(P1c1 Task 7 那类问题的必要条件是条件式/异步挂载,这里没有)。
   - 唯一形式差异:Vue2 只在 `menuOpen===true` 期间挂监听,New-UI 从 mount 到 unmount 全程挂着,对已关闭的菜单再触发一次 `menuOpen.value = false` 是空操作(值本就是 false),对外部可观察行为无差异。
   - 实现者称"非三件套意义上的偏离",本评审同意这一判断:公共约束 §2 的偏离定义针对的是"逻辑/bug 不照抄"(修正一个可复现错误行为),而这里是等价的框架实现手段替换,不改变任何可观察行为,不需要三件套申报。
8. **`SetSwitch` 用法**:确认只接 `@change`(`:257`),没有 `v-model`/`update:modelValue` 绑定;`:disabled="!!busy[skill.id]"` 到位;`busy[id]` 为真时用例断言 `aria-disabled="true"` 通过。
9. **`skill.id` 变化复位**:`watch(() => props.skill?.id, …)` 同时复位 `menuOpen` 与 `confirmOpen`(`:120-123`),对齐 Vue2 `:226-229`。已用 RED 探针验证(见下)。
10. **导出**:`href = service.ai.exportSkillURL(id)`、`download = (name || 'skill') + '.tar.gz'`,`appendChild → click → remove` 顺序对齐 Vue2 `:255-262`,测试覆盖了 name 为空回落 `skill.tar.gz` 的边界。
11. **复制**:`useCopyFeedback().copy(skill.md ?? '', 'skillmd')` 三件套齐全(内部走 `copyText` 兜底 + toast + `copiedKey` 驱动打勾态文案 `aiCopied`),已授权偏离,已申报。
12. **配色**:组件零 `<style>` 块,模板/脚本中无 hex/rgb/具名色;`.right` 的 `margin-left: auto` 已在 `sk-shared.scss:149` 落地为 CSS 规则,New-UI 去掉 Vue2 的等价内联 style 属于安全的样式下沉,不违反配色纪律(内联的是布局属性不是颜色)。

## RED 探针

破坏点:临时删去 `watch(() => props.skill?.id, …)` 内的 `confirmOpen.value = false` 一行(只保留 `menuOpen.value = false`)。
单跑 `skill.id 变化时复位确认弹窗(弹窗打开中途切换技能,弹窗自动关闭)`:

```
AssertionError: expected <div class="sk-confirm-skill">…</div> to be null
 ❯ …SkillDetail.test.ts:494:47
Tests  1 failed | 37 skipped (38)
```

红后立即用备份文件 `diff` 校验 `IDENTICAL`,`git status --short` 干净。

## 自跑测试数字

- `pnpm vitest run src/ai/components/settings/skills/SkillDetail.test.ts` → `Test Files 1 passed (1)` / `Tests 38 passed (38)`,与报告一致。
- `pnpm test`(全量)→ `exit=0`,`Test Files 296 passed (296)` / `Tests 2532 passed (2532)`。本次自跑未复现报告里提到的 `AgentComposer.test.ts` 偶发红(该噪声本就标注为偶发,未复现不代表不存在)。

## 算术核对

本任务未新增 `.vue` 文件(只改 `SkillDetail.vue` 既有文件),故 color-guard 用例数不应变化;上一任务(Task 5)终值 2513 → 本任务终值 2532,增量 +19(新增 19 条用例,反转 1 条不计入增量,与报告 §7/§11 的算术一致)。
