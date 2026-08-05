# Task 5 报告:SmartViewCreateDialog.vue —— 智能视图创建弹窗

状态:**DONE**

## 改了哪些文件

- 新建 `src/photos/components/SmartViewCreateDialog.vue`
- 新建 `src/photos/components/__tests__/SmartViewCreateDialog.test.ts`(33 例)
- 改 `src/views/PhotosSmartViews.vue`:挂 `<SmartViewCreateDialog v-model:open="createOpen"
  @created="onCreated" />`,`onCreated` 跳详情页(同 `onCardOpen` 目标路径);更新头部注释第
  6 条,不再是 TODO
- 改 `src/views/__tests__/PhotosSmartViews.test.ts`:「创建入口」describe 从「只断言
  `createOpen` 内部 state」升级为「弹窗真渲染」(`.sv-modal-scrim` 出现/消失),新增一条
  「弹窗内点关闭 → scrim 消失」;`svc.photos` mock 补 `previewSmartView`(弹窗接线后
  `refreshPreview` 最终会调它,不 mock 会在某条测试后的 300ms 宏任务里抛错、污染下一条)
- 改 `src/photos/stores/smartViews.ts`(控制器授权,见下方「store 决策」):
  `CreateSmartViewInput.description` 收紧为可选;新增 `cancelPreview()` 并导出
- 改 `src/photos/stores/__tests__/smartViews.test.ts`:新增 `cancelPreview` describe,3 例

## Vue2 `:42-182` 节点清点表(逐节点 → New-UI 落点)

| Vue2 行号 | 节点 | New-UI 落点 |
|---|---|---|
| 41-43 | `<transition name="sv-modal">` → `.sv-modal-scrim`(`v-if`,`@click.self`)→ `.sv-modal`(`role=dialog`) | `<Transition name="sv-modal">` → `.sv-modal-scrim`(`v-if="open"`,`data-test="sv-modal-scrim"`,`@click.self="close"`)→ `.sv-modal` |
| 44-51 | `.sv-modal-head`:图标块 + 标题/副标题 + 关闭钮 | `.sv-modal-head` → `.sv-modal-icon` + `.sv-modal-head-text`(`.sv-modal-title`/`.sv-modal-sub`)+ `.icon-btn`(`data-test="sv-close-btn"`) |
| 55-61 | 名称字段:label + input(ref/`@keydown.enter.prevent`) | `.sv-field` → `[data-test="sv-name-input"]`,`ref="nameInputRef"` |
| 63-72 | 描述字段:label + hint + textarea(`@input=refreshPreview`) | `.sv-field` → `[data-test="sv-desc-textarea"]`,`@input="triggerPreview"` |
| 74-86 | Nimo 建议:`v-if` 块 + head + chip 按钮 `v-for` | `.sv-suggest`(`v-if="suggestedChips.length>0"`)→ `.sv-suggest-head` + `.sv-suggest-row` → `.sv-suggest-chip` |
| 88-106 | 条件 bin:label + chip-bin(`v-for` chip + x 按钮)+ 自定义 input + hint | `.sv-chip-bin` → `.sv-chip-item`(+`.sv-chip-x`)+ `[data-test="sv-chip-input"]` + `.sv-hint-spaced` |
| 108-119 | 阈值:label + thresh-val + range(`:value`+`@input`)+ marks + hint | `.sv-thresh-val` + `[data-test="sv-thresh-range"]` + `.sv-slider-marks` + `.sv-hint-spaced` |
| 121-136 | 两个开关行 | 两个 `.sv-toggle-row` → `.sv-switch`(`data-test="sv-switch-live"`/`"sv-switch-videos"`,`role=switch`) |
| 139-143 | 右栏 preview-head | `.sv-preview-head` |
| 144-147 | preview-count | `.sv-preview-count` |
| 148-150 | preview-grid(`v-for` img) | `.sv-preview-grid` |
| 151-159 | preview-help 三档三元 | 三个 `v-if/v-else-if/v-else` `.sv-preview-help` |
| 161-170 | 模板区:head + 5 行 `v-for` | `.sv-templates` → `.sv-templates-head` + `.sv-template-row` |
| 174-180 | foot:Cancel + 主按钮 | `.sv-modal-foot` → `.sv-btn-ghost` + `[data-test="sv-confirm-btn"]` |

逐节点均已实现,无遗漏。

## 必含用例 → it 对应表

| brief 必含用例 | `it` |
|---|---|
| 结构清点(6+4+5+2) | `结构清点 > open:true → scrim 渲染,且左栏 6 段…` |
| open:false 不渲染/置真渲染 | `结构清点` 两条 |
| draft 重置走 watch(持久挂载坑) | `draft 重置走 watch(持久挂载坑) > 打开→填 name→关闭→再打开…` |
| 建议 chips 出现 + 点击进 bin 且消失 + refreshPreview 被调 | `Nimo 建议` 两条 |
| chip 增删(Enter/逗号/去重/删除)各断言 refreshPreview | `chip 增删` 四条 |
| 占位文案二态 + hint | `chip 输入占位文案二态` 两条 |
| 阈值拖动 + refreshPreview + 三档文案 + 边界 88/65 | `阈值滑块` 两条 |
| threshMuted 空表单不算失效 | `threshMuted` 两条 |
| 两开关 accessible name + live 不调/videos 调 refreshPreview | `两个开关` 三条 |
| 模板:descEn 契约 | `模板` 一条 |
| canSubmit 四态 | `canSubmit` 四条 |
| confirm 成功逐字段 + created/update:open | `confirm` 三条(含 desc 非空一条) |
| confirm 失败 → toast + 不关弹窗 | `confirm` 一条 |
| cssCascade hover | `hover 态背景` 两条 |
| 前景色合规(`.sv-modal-icon`) | `前景色合规` 一条 |
| 窄屏规则 | `窄屏规则` 一条 |

另加 3 条非 brief 字面要求、为完整性补的用例:点关闭按钮/Cancel/scrim 自身各 emit
`update:open(false)`(`关闭` describe)。共 33 个 `it`,全部通过。

## 8 条删码验证逐条结果

全部**逐个手工改 → 跑测试确认变红(或确认"不成立"的真实原因)→ Edit 手工还原**(未用
`git checkout --`)。

1. **①`watch(() => props.open)` → `onMounted`** —— 「draft 重置走 watch」用例变红
   (`expected 'My View' to be ''`)。**成立**,已还原。
2. **②`useTemplate` 的 `descEn` → `descKey`** —— **字面按 brief 写法验证,不成立**:33 例
   全绿。回源确认原因与 T1 已查实的结论一致(`smartViewSuggest.ts` 文件头注释):
   `descKey`(如 `photosSvFamilyWeekendsPark`)是 `descEn`(`Family weekends in the
   park`)的驼峰化,小写后子串 `familyweekendspark` 仍包含 `family` 等 POOL 关键词,
   `inferChips(descKey)` 恰好不为空,构造不出红。**改用 T1 建议的真实反例**验证同一条
   保护:把 `descEn` 换成 `t(row.descKey)`(翻译后的中文文案 `'在公园度过的家庭周末'`)
   —— 这才是真正会被写错的那一行代码(拿翻译文本而不是英文原文去匹配)。此次验证
   **变红**(`expected 0 to be greater than 0`,因为中文文本在 POOL 里零命中)。已如实
   登记这条删码清单按字面写法不成立,并给出真正命中的替代验证,还原为 `descEn`。
3. **③`suggestedChips` 的 `.filter(c => !chips.includes(c))`** —— 「建议消失」用例变红
   (`expected true to be false`)。**成立**,已还原。
4. **④`threshMuted` 的第二个条件** —— 「空表单不算失效」用例变红(hint 文案出现在不该
   出现的地方)。**成立**,已还原。
5. **⑤`live` 开关误加 `refreshPreview`** —— 「live 未调」用例变红
   (`expected "wrappedAction" not to have been called`但实际调了一次)。**成立**,已
   还原。
6. **⑥`description: … || undefined` 的 `|| undefined`** —— 「空 desc 字段」用例变红
   (`description` 收到 `""` 而不是 `undefined`)。**成立**,已还原。
7. **⑦`confirm` 的 `catch`** —— 首次验证时发现原测试只靠"没有 `update:open`"这个间接
   信号,删掉 `catch` 后由于 promise 变成未处理 rejection,具体 `it` 反而仍报"passed"
   (只有 vitest 的 unhandled-rejection 检测让整个文件以非零退出码收场,`Errors 1
   error`)。判断这不是干净的可证伪断言,**补强测试**:加 `vi.spyOn(useToast(), 'show')`
   直接断言 toast 真的被调(`toHaveBeenCalledWith(zh.photosAlbumCreateFailed)`)。补强后
   重新删除 `catch` → 该断言**干净地变红**(`Number of calls: 0`)。**成立**(补强后),
   已还原并保留补强后的断言(比原计划更强)。
8. **⑧`.sv-btn-primary:hover` 整条** —— cssCascade 用例变红(`expected
   '.sv-btn-primary' to contain ':hover'`,胜出规则退化成不含 `:hover` 的基础态)。
   **成立**,已还原。

**8 条里 7 条按预期成立,1 条(②)按 brief 字面写法不成立(已回源确认是 T1 已知的同一个
误判),已用真正命中的反例重新验证并确认保护有效**。

## 回源核对结论

- **模板(`PhotosSmartViewsView.vue:42-182`)**:逐段核对,见上方节点清点表,无遗漏节点。
  **出入(均已在组件文件头注释登记)**:
  1. `.sv-modal-icon` 尺寸:brief 结构规格第 2 条写 "28×28",回源 `scss:690-691` 实际是
     **32×32**——brief 这条记错了,以真源为准。
  2. 窄屏:brief 说 "Vue2 零 `@media`,≤768px 是偏离新增"——回源 `scss:1018-1022` 实际
     **已有** `@media (max-width: 760px)`(改 `.sv-modal-body` 单列 + `.sv-modal-side`
     的 `border-left`→`border-top`)。**这条 brief 记错了两次**:①不是零 `@media`,
     是真实存在的响应式规则;②断点数字是 760 不是 768。本任务的实现是"1:1 搬运真实的两条
     变化,但断点数字对齐本仓同类文件 `PhotosSmartViews.vue`(T4)已用的 768"——这一点
     (760→768)才是真正的偏离,已登记。brief 建议再加的 `.sv-modal` 宽度
     `min(100% - 24px, …)` 覆盖判断为多余:Vue2 的 `max-width:100%` + 外层 scrim 的
     `40px 24px` padding 已经让弹窗在窄屏下天然收缩,未添加。
- **逻辑(`:359-436`)**:逐条核对 `_emptyDraft`/`addChip`/`removeChip`/`addCustom`/
  `onChipKey`/`useTemplate`/`refreshPreview`/`openCreate`/`confirmCreate`,方法体逐字段
  比对,行为 1:1(除 brief 已预先点名的 `confirm` 失败路径 catch/toast 偏离)。额外发现:
  `useTemplate` 的 `t.label`/`t.desc` 在 Vue2 源码里实际是**字面英文字符串**(如
  `'Family weekends'`)、被当作 vue-i18n 的 key 直接喂给 `$t()`——这与 T1
  `smartViewSuggest.ts` 把 `labelKey`/`descKey` 设计成 i18n 键名的做法完全对应,不是
  T1 的臆测,已在源码 `:221-227` 核实。
- **样式(`photos-smartview.scss:659-1013` + 补读 `:574-605` + `:1018-1022`)**:
  逐条核对。brief 只要求读 `:659-1013`,但 `.sv-toggle-row`/`.sv-switch` 的完整定义在
  `:574-605`(brief 读区间没盖到),已补读并 1:1 移植(含 `.sv-switch::after` 的
  knob 颜色、`data-on="true"` 时的背景/knob 联动)。窄屏媒体块在 `:1018-1022`(同样在
  brief 读区间之外),已补读(见上方"出入"第 2 条)。**token 映射出入(均已在样式块
  注释登记)**:
  - brief 结构规格第 7 条只给了 `--surface/--line/scrim/投影` 的映射,没提 Vue2 的
    `--text-1/2/3/4` 四档——本任务自行决定映射为 `--fg`/`--fg-muted`/`--fg-faint`/
    `--fg-subtle`(按深色主题不透明度从高到低排列,`--fg-faint` 已有既有先例
    `PersonPlacesTab.vue:201` 等)。
  - `--font-display`(Vue2 用于预览计数大字号)本仓无对应 token,纯排版选择、非颜色,
    直接省略、继承 `--font`,不新增 token。
  - `rgba(var(--accent-rgb), α)` 系列按三档 `accent-soft` 家族就近取(低→
    `--accent-soft`,中→`--accent-soft-2`,高→`--accent-soft-bd`),精确 α 值不是
    一一对应,是就近映射(本仓无 `--accent-rgb`,Global Constraints §33 已预告此
    映射方式)。

## `--on-accent` 用法:与 brief 的出入

brief Step1 断言原文:"`.sv-modal-icon` 用的是 `--accent` 实底 + `--on-accent` 前景
(**这一条是本期唯一合法的 `--on-accent` 用法**,要正向断言);其余压照片的元素本组件没有。"

回源 + 全仓 grep 后判断:**这句里"唯一合法用法"过窄,本组件实际有三处合法使用
`--on-accent`**,但"其余压照片的元素本组件没有"这半句是对的(`.sv-preview-grid img`
是纯图,无覆盖文字,不需要 `theme-exception` 钉浅色)。三处:

1. `.sv-modal-icon`(brief 点名的这条,已正向断言)。
2. `.sv-switch[data-on="true"]::after`(开关滑块在 `data-on=true` 时叠在 `var(--accent)`
   实底上)—— 与 `NimoOS-New-UI`(master)`SettingsSwitch.vue`/`settings.css:154-157`
   完全同构的先例(那份文件自己也有一行同款确认注释"`--on-accent` 只有叠在 accent
   实底上才可用 —— 这里正是那种情形")。
3. `.sv-btn-primary`(`background: var(--accent); color: var(--on-accent)`)—— 与本仓
   既有 primary 按钮先例同构:`ClusterActionDialog.vue:320`、`MergeReviewDialog.vue:262`。

已在组件 `<script>` 头部与 `<style>` 内对应规则旁都留了注释登记。**未新增测试断言这两处**
(只在 Step1 明确要求的 `.sv-modal-icon` 上写了正向断言)——判断理由:这两处是"延伸既有
先例",不是本组件特有的、需要单独钉死的设计决策;若要断言,会变成给 `ClusterActionDialog`/
`SettingsSwitch` 已经验证过的模式重复背书,而不是验证本组件的新东西。已在报告与代码注释
双重登记,供后续审阅判断是否需要补断言。

## Store 决策:`cancelPreview` 选了哪条路径

选了**路径 ①(控制器建议的路径)**:在 `smartViews.ts` 里补 `cancelPreview()`
(`clearTimeout` + `previewSeq += 1`),并加 3 个用例(定时器未触发时取消/请求已在途时
取消/取消后 `refreshPreview` 仍能正常工作)。

**理由**:
- store 是这个"过期预览"问题唯一的正确归属地——`previewTimer`/`previewSeq` 都是 store
  内部私有闭包变量,组件侧完全拿不到,只能通过 store 暴露的函数操作,不可能在组件里
  "规避"(路径 ②在这个具体场景下技术上不可行,不只是"不推荐"这么简单)。
- 复用现有的 `previewSeq` 计数器即可实现"让已在途响应作废",不需要新增任何标志位,
  与 `places.ts` 的 `clearDetail` 思路(递增序号让旧请求的 `mine !== seq` 判断自然
  失效)完全同构,是本仓已验证过的成熟模式,不是发明新机制。
- 顺带把 `CreateSmartViewInput.description` 从 `string` 收紧为 `string?`——这不是
  为 `cancelPreview` 而做,是因为 brief 要求 `confirm()` 照搬 Vue2 `:431` 的
  `|| undefined` 语义(空描述不传字段,后端 `omitempty`),而原接口类型是 `string`
  强制,传 `undefined` 会被 `vue-tsc --noEmit` 拒绝。这处收紧已确认不影响其余消费方
  (`updateSmartView` 用 `Partial<CreateSmartViewInput>`,`refreshPreview` 用
  `Omit<…, 'name'|'live'>`,两者都是直接透传,不做非空校验)。

## 任何申报的偏离

1. `.sv-modal-icon` 尺寸 28×28→32×32(brief 记错,以真源为准)。
2. 窄屏断点 760→768(对齐本仓 T4 已用的约定值,Vue2 真实断点是 760,不是 brief 说的
   "零 `@media`")。
3. `--text-1/2/3/4` 四档映射为 `--fg`/`--fg-muted`/`--fg-faint`/`--fg-subtle`(brief 的
   映射表没覆盖这四档,本任务自行决定)。
4. `--font-display` 省略,不新增 token。
5. `--on-accent` 实际有三处合法用法(brief 说"唯一"),已登记差异,详见上方专节。
6. `.sv-switch` 补 `tabindex="0"` + `keydown.enter/space` 键盘操作(brief 只要求
   `role`/`aria-checked`/`aria-label`)——判断"role=switch 却没有键盘可操作性"本身就是
   不完整的无障碍实现,补上是低风险的自然延伸,不是范围蔓延。
7. `confirm()` 失败路径的 toast 断言从 brief 隐含的"没有 `update:open` 即视为不关"升级为
   直接 spy `useToast().show`(见删码验证⑦),更强、更诚实的断言。
8. 删码验证②按 brief 字面写法不成立(T1 已知的同一误判),已用真实反例重新验证。

## 测试小结

- 新增:store 3 例(`cancelPreview`)+ 组件 33 例 + 视图升级 1 例(净增 1 条 `it`,原 2
  条断言升级 + 新增 1 条关闭态验证)。
- `pnpm exec vitest run`:**294 个测试文件、3118 例全部通过**。
- `pnpm exec vue-tsc --noEmit`:exit 0,无输出。
- `pnpm exec vitest run src/styles/color-guard.test.ts src/i18n/parity.test.ts`:
  2 个文件、425 例全部通过(本任务未新增 i18n 键,parity 不受影响;color-guard 修过一处
  ——`<style>` 块头部的 token 映射注释里字面写了 `rgba(var(--accent-rgb),α)`,被
  color-guard 当成裸颜色字面量判红,已改写措辞去掉字面 `rgba(` 模式,不影响注释含义)。

## Concerns

无阻塞性问题。两点供下游知情:

1. `--on-accent` 用法数量与 brief 的出入(见专节)——如后续评审认为需要,可以给
   `.sv-switch[data-on]`/`.sv-btn-primary` 也补正向断言,当前判断为可选加固,非缺陷。
2. `.sv-switch` 的键盘可操作性(tabindex + enter/space)是本任务主动补的,brief 未要求
   也未提供对应测试用例范式——已加最小实现,未过度设计(未加 focus 环样式等)。

---

# Fix round 1 报告

评审判定:Spec ✅ / Task 质量 Needs fixes,3 Important + 9 Minor(控制器挑了 4 条 Minor
一并做,其余 5 条记台账不进本轮)。评审同时**双双证实**本任务报告已登记的两条 brief 事实
错误(`.sv-modal-icon` 是 32×32、Vue2 真有 `@media (max-width: 760px)`),我的 1:1 搬运与
760→768 的登记判为正确;另查出我给的「内联 style 密集处」行号有误(`:113-114` 是内联
`@input` 不是 style,`:151-159`/`:174-179` 根本没有内联 style)——已记台账,不进本轮。

## I1(Important)—— 阈值滑块整套自绘外观漏移植,真机上会退化成浏览器默认灰控件

**根因(评审判定,plan 的错不是任务的错)**:T5 brief 给的 scss read 区间 `:659-1013`
没盖到真正生效的滑块规则 `photos-smartview.scss:543-563`(优先级 (0,2,0),压过
`photos.scss:2817` 的单类 `.sv-slider`)。首版只写了 `.sv-slider { width: 100% }`,全仓
`slider-thumb` 零命中——质量阈值这个弹窗最核心的交互件会显示成系统默认灰轨灰点。

**改法(控制器决定)**:抽成独立组件 **`src/photos/components/PhotosThreshSlider.vue`**——
同一套「range + `.sv-slider-marks` 三档」标记本期要用三次(本任务 + T8 详情页右栏阈值段 +
T14 保存为智能视图弹层)。

**最终契约(签名已冻结,T8/T14 请照此消费)**:

```ts
// props
{ value: number; min?: number; max?: number }   // 默认 min 50 / max 99
// emits
(e: 'input', v: number): void                    // @input 即时,不做 debounce(节流是消费方的事)
```

内部渲染 `<input type="range" :min :max :value class="sv-slider" data-test="pts-range">` +
`.sv-slider-marks`(三个 span,文案 `photosSvLoose`/`photosSvBalanced`/`photosSvStrict`),
`:value` + `@input`(不是 `v-model`,照 Vue2 `:113-114` 既定写法)。emit 出的是已经
`Number()` 转换过的值,不是原始 `Event`。

**颜色映射**:Vue2 用 `rgba(var(--accent-rgb), α)`,本仓无该 token,轨道渐变与 thumb 光晕
都改用既有 `--accent-soft-2`(dark .24 / light .20,比 `--accent-soft` 的 .14/.11 更接近
Vue2 原值的 .25/.4 量级)——不需要新增 token,`docs/THEMING.md` 无需改动。thumb 的
`background: white` 保留字面浅色 + `theme-exception`(叠在 accent 描边 + accent 渐变轨上,
不用 `--on-accent`——它默认深色主题下是深藏青,会失去"白点"识别度,这是 Vue2 的刻意设计,
不是随主题变化的语义色)。

**补齐 Vue2 的缺**:`::-moz-range-thumb` 一并写(Vue2 只写了 `::-webkit-slider-thumb`,
Firefox 下会退化成默认控件,私有前缀选择器必须独立声明才生效,不能靠逗号合并 selector
list)。

**踩坑**:样式块注释里逐字引用 Vue2 原声明(含 `rgba(var(--accent-rgb), …)` 与
`--accent-rgb(Global Constraints…`)两次触发 color-guard 误判——前者是字面 `rgba(` 模式,
后者是 `--accent-rgb(` 里的 `rgb(` 子串被 `\b(rgba?|hsla?)\s*\(` 命中(`-` 是非单词字符,
`\b` 在 `-` 与 `r` 之间成立)。两处都改写成不含这些字面子串的描述性文字,不影响注释含义。
另踩到 `cssCascade.ts` 警告过的「假开标签」坑:脚本头部注释里写了字面 `<style>` 一词,
被 `extractStyleBlock` 的非贪婪正则当成了真开标签,导致提取的"样式块"从脚本注释中段开始、
后面所有断言全部基于错误内容跑(却因为规则体解析巧合仍能报出看似合理的失败信息,不易
一眼看出)——改写成"下方样式块注释"避免这个词面陷阱。

**测试**:新建 `PhotosThreshSlider.test.ts`(7 例:结构/默认 min-max/emit/三条样式断言,
均先锚定规则体再断言属性),`SmartViewCreateDialog.test.ts` 里阈值相关用例的选择器从
`sv-thresh-range` 改成 `pts-range`(元素现在渲染在子组件里)。4 条样式删码验证(轨道/
webkit thumb/moz thumb/marks margin-top)逐个改红复原,全部成立。

## I2(Important)—— 模板行 sparkles 图标色从 accent 变成了前景白

Vue2 `:164` 给 5 个模板行的图标显式传 `color="var(--accent-hi)"`(Vue2 `PhotosIcon` 把
`color` 落到 `:stroke`)= accent 色;New-UI 用 `stroke="currentColor"` 继承了
`.sv-template-row { color: var(--fg) }` = 前景白。同文件另两处 sparkles(`.sv-suggest-head`/
`.sv-preview-head`)之所以碰巧对,是因为那两条规则自己的 `color` 就是 `--accent-text`,
唯独模板行容器是 `--fg`。

**改法**:`.sv-template-row svg { color: var(--accent-text); }`(本仓无 `--accent-hi`)。
Vue2 hover 态(`scss:955-958`)本来就只改 `border-color`/`background`,不改图标色,这里
直接给 `svg` 定死 `color`(不随容器 `:hover` 变化),天然覆盖两态,不需要单独写
`:hover svg` 规则。

**测试**:新增一条先锚定 `.sv-template-row svg` 规则体、断言含 `color: var(--accent-text)`
的用例。删码验证:去掉这行 `color` 声明 → 断言变红(`Received: " margin-top: 2px;
flex-shrink: 0; "`)。**成立**,已还原。

## I3(Important)—— 引用了本分支不存在的先例为「免测」背书

原文件头(`:20-26`)与样式注释(`:668-669`)引了 `SettingsSwitch.vue`/`settings.css:
154-157` 为 `.sv-switch[data-on]::after` 的 `--on-accent` 用法背书——这两个文件**在本分支
零命中**(只存在于禁止依赖的 master 工作树),且 `role="switch"` 在本分支是**第一次使用**
(grep 全仓只命中本组件这两行),注释却把"首例"写成了"跟随既有",论证不成立。

**评审已逐处核实三处 `--on-accent` 用法本身全部合法**(`.sv-modal-icon` 自带
`background: var(--accent)`;`.sv-switch[data-on="true"]::after` 的宿主是 accent 实底,
不是渐变也不是半透明;`.sv-btn-primary` 自带 `background: var(--accent)`)——**实现不用
改**,只改了:

1. 删掉 `SettingsSwitch.vue`/`settings.css` 的引用,改写成"`role="switch"` 是本分支首例;
   `--on-accent` 的合法性由紧邻的 `[data-on="true"] { background: var(--accent) }` 自证"。
   另两个先例 `ClusterActionDialog.vue:320`/`MergeReviewDialog.vue:262` 是真的,留着。
2. 给 `.sv-switch[data-on="true"]::after` 与 `.sv-btn-primary` 各补一条正向断言(和
   `.sv-modal-icon` 那条同型:断言该规则用 `--accent` 实底 + `--on-accent` 前景)。

**测试**:新增两条正向断言(见上)。删码验证:分别去掉 `.sv-switch[data-on="true"]::after`
的 `background: var(--on-accent)` 与 `.sv-btn-primary` 的 `color: var(--on-accent)` →
两条断言各自变红。**均成立**,已还原。

## 4 条 Minor(控制器挑的)

### M1 —— Esc 关闭是未申报的 net-new

Vue2 这个弹窗完全没有 Esc 处理;代码注释引的 `AlbumPickerDialog.vue`(真实存在)只解释了
"怎么写",没解释"为什么这里会有一个 Vue2 没有的行为"。已在文件头注释补登记第 7 条,并补
两条用例:`open:true` 时 document 派发 `Escape` → emit `update:open(false)`;`open:false`
时同样派发 → 不 emit(监听器只在打开时挂载)。删码验证:把 `onDocumentKeydown` 改成
不调 `close()` 的空判断 → 「open:true 按 Esc」用例变红。**成立**,已还原。

### M5 —— `.sv-preview-grid` 的 `<img>` 渲染路径零覆盖

33 个原始用例里 `store.preview.seeds` 恒为空,`thumbUrl()` 从未真正执行过,`'large'`
尺寸口径完全没有回归保护。补一条:设 `store.preview = { seeds: ['seed-a','seed-b'], … }`
→ 断言渲染 2 个 `img`、`thumbnailUrl` 分别以 `('seed-a','large')`/`('seed-b','large')`
被调、`loading="lazy"`。删码验证:把 `:src="thumbUrl(s)"` 改成 `:src="s"` → 断言变红
(`Number of calls: 0`)。**成立**,已还原。

### M6 —— 自动聚焦零断言 + 开关键盘可操作性零断言

brief 结构规格第 3 条明写"弹窗打开后自动聚焦"名称输入框,但原 33 例里没有一条验证它。
补一条:用 `attachTo: document.body` 挂载(jsdom 下 `document.activeElement` 只在元素
真正挂进 `document` 时才生效,默认 `mount()` 挂在游离 div 上测不出真实 focus)→
`await nextTick()` → 断言 `document.activeElement` 就是名称输入框。另补一条覆盖自加的
`tabindex="0"` + Enter/Space 键盘操作:断言两个开关都有 `tabindex="0"`,`keydown.enter`/
`keydown.space` 都能切换 `aria-checked`。删码验证两条各自成立(分别去掉自动聚焦调用与
`tabindex="0"` → 各自变红),已还原。

### M7 —— `onUnmounted` 没调 `store.cancelPreview()`

弹窗开着时若组件被真正卸载(如离开路由、宿主 `v-if` 整页收起),已排好的 300ms 防抖预览
请求会成为孤儿照常发出(Vue2 靠整页 `beforeDestroy` 的 `clearTimeout` 兜住,New-UI 的
`watch(open)` 只在"关闭"这个状态转换时清,不覆盖"直接卸载"这条路径)。`onUnmounted` 补
一行 `store.cancelPreview()`,补一条用例:挂载 → `unmount()` → 断言
`store.cancelPreview` 被调。删码验证:去掉这行 → 断言变红(`expected "wrappedAction" to
have been called at least once`)。**成立**,已还原。

## 删码验证汇总(本轮全部逐个改红复原,Edit 手工还原,未用 `git checkout --`)

| 项 | 断言 | 结果 |
|---|---|---|
| I1-a `.sv-slider` 轨道声明 | appearance/background 断言 | 变红,已还原 |
| I1-b `::-webkit-slider-thumb` | width/height/border-radius/border/box-shadow 断言 | 变红,已还原 |
| I1-c `::-moz-range-thumb` | 整条规则存在性断言 | 变红,已还原 |
| I1-d `.sv-slider-marks` 的 `margin-top` | margin-top 断言 | 变红,已还原 |
| I2 `.sv-template-row svg` 的 `color` | color 断言 | 变红,已还原 |
| I3-a `.sv-switch[data-on]::after` 的 `background: var(--on-accent)` | 正向断言 | 变红,已还原 |
| I3-b `.sv-btn-primary` 的 `color: var(--on-accent)` | 正向断言 | 变红,已还原 |
| M1 `onDocumentKeydown` 的 `close()` | Esc 用例 | 变红,已还原 |
| M5 `thumbUrl(s)` | thumbnailUrl 调用断言 | 变红,已还原 |
| M6-a 自动聚焦调用 | `document.activeElement` 断言 | 变红,已还原 |
| M6-b `tabindex="0"` | tabindex 断言 | 变红,已还原 |
| M7 `onUnmounted` 里的 `store.cancelPreview()` | cancelPreview 调用断言 | 变红,已还原 |

**12 条全部成立**,无一条判"不适用"。

## 改了哪些文件(本轮)

- 新建 `src/photos/components/PhotosThreshSlider.vue`(I1)
- 新建 `src/photos/components/__tests__/PhotosThreshSlider.test.ts`(7 例)
- 改 `src/photos/components/SmartViewCreateDialog.vue`:消费 `PhotosThreshSlider`(删掉
  内联 range+marks 与对应 CSS)、`.sv-template-row svg` 补 `color`(I2)、去掉两处不存在
  的先例引用并补充自证说明(I3)、文件头注释补第 7 条 Esc 登记(M1)、`onUnmounted` 补
  `store.cancelPreview()`(M7)
- 改 `src/photos/components/__tests__/SmartViewCreateDialog.test.ts`:阈值相关选择器
  `sv-thresh-range`→`pts-range`;新增 9 例(I2 一条 + I3 两条 + M1 两条 + M5 一条 + M6 两条
  + M7 一条)

未改动 `docs/THEMING.md`(本轮未新增 token)。

## 测试小结

`pnpm exec vitest run src/photos/components/__tests__/SmartViewCreateDialog.test.ts
src/photos/components/__tests__/PhotosThreshSlider.test.ts
src/views/__tests__/PhotosSmartViews.test.ts src/photos/stores/__tests__/smartViews.test.ts
src/styles/color-guard.test.ts src/i18n/parity.test.ts`:**6 个文件、545 例全部通过**;
`pnpm exec vue-tsc --noEmit`:exit 0,无输出。另跑了一次全量兜底(非本轮强制要求,顺手
确认无回归):**295 个测试文件、3137 例全部通过**。

## Concerns

无阻塞性问题。`PhotosThreshSlider.vue` 的 props/emits 契约已在上方 I1 小节完整给出,可
直接抄进 T8/T14 的 brief。
