## Fix round 1 —— 3 Important + 5 Minor(全部并入本轮:这是眼验前最后一轮,一次收干净)

评审判 **Spec ❌ / Needs fixes**。**先说好的**:节点清点独立重做过、Vue2 `:152-230` 的 5 处内联 style 与 29 条 scss 规则逐条对齐、`PhotosThreshSlider`/`formatMB`/`relTime` 三处复用**全仓各只有一份**(没偷偷重造)、`<i18n-t>` 的 warn 前缀过滤有区分力、宿主 `-` 行只有 5 行且全是你自己留的空壳 describe(**T6/T7 的 103 条断言一条未动**)、颜色与注释三禁全干净。**7 条删码清单里 6 条经评审亲自变异全部成立**(含最像不成立的 `Math.max(1,…)` 那条)。

### I1(Important)—— 阈值滑块:拖动跨越一次 PATCH 往返 ⇒ 拇指被抽回旧值,且用户最后拖到的值被静默丢弃

`SmartViewSidePanel.vue:49` 少了 **brief 原文就写了的 `dragging` 门控**;`:56-59` 的防抖回调又读**活值** `thresh.value` 而不是触发时捕获的 `v`(Vue2 `:359-366` 是闭包捕获 `v`,并靠 `syncingSv` 挡回流重新 arm)。两者叠加成真 bug,**评审写临时用例实测复现、断言全部通过**:

`t=0` 拖到 92 → `t=300` emit `{92}`、PATCH 出门 → `t=350` 用户**没松手**继续拖到 60、显示 60% → `t=400` 上一发响应落地、store 回写 `sv.threshold=92` → **watch 无门控 ⇒ 显示从 60% 跳回 92%** → `t=650` 防抖到期、发出去的是 `{threshold: 92}` ⇒ **用户拖到的 60 消失,无提示无重试**。

**你申报的理由把两件事混成一件了**:brief 让你去掉的是 Vue2 的 **`syncingSv` 自反馈抑制**(那个确实不需要,因为 New-UI 只在 `@input` 时 emit);而 `dragging` 门控管的是**别把拇指从用户手指底下抽走** —— 这是另一回事。

**改法(两处都要)**:①watch 加 `dragging`/`pending` 门控(brief 给的写法);②`onThreshInput` 把 `v` **捕获进闭包**,`emit('patch', { threshold: v })`。**补一条走上面那个时序的回归用例。**

### I2(Important)—— busy 期间防抖到期的 emit 被静默吞掉且永不重试,界面与后端永久失同步

`SmartViewSidePanel.vue:57` 的 `if (props.busy) return`。评审实测:`busy=true` 时拖到 92 → 界面停在 92%、`emitted('patch')` 恒 `undefined`、**busy 解除后也不补发** ⇒ 「界面 92% / 后端 72%」永久不一致。

**与两个开关不同**:开关是纯派生,吞掉点击后 UI 仍与 store 一致;阈值有本地 draft,吞掉就是永久失同步。而且 `data-busy` 的视觉态只挂在两个开关上、滑块上没有任何提示。

**改法**:busy 时**重新 arm 定时器**而不是 `return`(等 busy 落下再发)。**根因在 store 的 `if (patchBusy.value) return` 也是静默 return,但 store 不在你可改范围 —— 组件侧这样兜住即可。**

**同时**:`busy=true` 的短路行为、`data-busy` 属性、宿主 `:busy="store.patchBusy"` 这条 prop 来源,**三者都零用例**。T7 的 fix round 1 刚被要求补齐同类 busy 覆盖,本任务又引入一份无覆盖的 —— **三条都补上**。

### I3(Important)—— `photosSvActNMatched` 加粗范围收窄成了「只有数字」,与相邻的单张行自相矛盾

**你的申报事实准确,但严重度低估了;而且根因是 brief 的前提写错 —— 不记在你头上。**

**控制器已回源核实 `zh_CN.json` 真值**:
- `<b>1 new photo</b> auto-added` → `<b>1 张新照片</b> 已自动添加`
- `<b>{n} new photos</b> auto-added` → **`<b>{n} 张新照片</b> 已自动添加`** ← `<b>` 包的是「插值 + 语言相关静态词」**整个短语**
- `At {pct}%, expect ~<b>{n}</b> new photos per week.` → `阈值 {pct}% 时,预计每周新增约 <b>{n}</b> 张照片。` ← **只有这条 brief 说对了**

现在的渲染结果(评审实测):单张行 `<b>1 张新照片</b> 已自动添加`(**与 Vue2 一致**),多张行 `<b>5</b> 张新照片 已自动添加`(加粗只剩数字)。**同一个活动流里相邻两行一行整短语粗、一行只有数字粗 —— 这不是「与 Vue2 略有差异」,是自相矛盾,读者会以为那是两种不同的事件。** 而且它恰好落在下一步就要肉眼看的那一屏(中途验收清单第 10 条原文就是「加粗部分应是真的粗体」)。

**改法(控制器解除「本任务只新增一个键」的上限)**:新增 **`photosSvActNMatchedBold`**(zh `'{n} 张新照片'` / en `'{n} new photos'`),主句键 `photosSvActNMatched` 改成 `'{photo} 已自动添加'` / `'{photo} auto-added'`,模板 `<template #photo><b>{{ t('photosSvActNMatchedBold', { n }) }}</b></template>` —— **与单张那条形态完全对称**,顺带把「新增 1 个键」造成的形态分裂也消掉。en_us.ts 同步、键序逐字节一致、只追加不重排。

### M1(并入)—— 1:1 审计只走了一条腿:漏了 `photos.scss:2819-2820` 那份低优先级 `.sv-switch`,**且要连 T5 的文件一起补**

**控制器已回源核实**:Vue2 里 `.sv-switch` 有**两份**规则 ——
- `photos.scss:2819`(裸 `.sv-switch`,0,1,0):`transition: background 0.15s`
- `photos.scss:2820`(`.sv-switch::after`):`box-shadow: 0 1px 3px …` + `transition: left 0.18s cubic-bezier(0.2,0.8,0.2,1)`
- `photos-smartview.scss:584-600`(`.photos-root .sv-switch`,0,2,0):**赢了尺寸之争(32×18 / 拇指 14×14)但没有声明 `transition: background`,`::after` 只覆盖了 `transition: all 0.2s`、没覆盖 `box-shadow`**

⇒ **那两条低优先级声明照样合并进级联** ⇒ **Vue2 的开关轨道颜色是渐变过渡、拇指有投影**,你的版本是瞬变 + 平的。开关是右栏最显眼的交互件,眼验前必修。

**同一失效模式 T5 也有**:`SmartViewCreateDialog.vue:657-681` 的 `.sv-switch` 有**完全相同的两处遗漏**(你是照它保持一致,不是自创)。**控制器授权你连 T5 那个文件一起补**,两处保持一致,各配一条先锚定规则体的断言。
顺带:`.sv-slider` 的 `cursor: pointer` 在 Vue2 是挂在**轨道**上的(`photos.scss:2817`),`PhotosThreshSlider` 只在 thumb 伪元素上有 —— **`PhotosThreshSlider.vue` 也授权你改这一处**(加轨道 `cursor: pointer`)。

### M2(并入,只需结账)—— T6 挂给你的滚动条美化落空且未登记

T6 在 `PhotosSmartViewDetail.vue:745` 原话:「不含滚动条美化 —— 那部分留给 T8 真正引入可滚动内容时再决定」。你引入了 4 段可滚动内容,既没做 `photos-smartview.scss:195-209`(accent 渐变 thumb / 10px 宽 / accent 6% 轨道),也没登记决定。**附带:brief 的 read-only 区间也没给 `:187-209`,这笔账从 T6 掉进了 brief 的缝里。**

**改法:不做重画,只把决定登记下来** —— 理由:本分支惯例是滚动条只 `display: none` 不重画(`PhotosGrid.vue:420` / `PhotoFilmstrip.vue` / `PhotosPersonDetail.vue:1041` 三处先例),且 `theme.css` 已有全局细滚动条;SP5-P6 还实证过 **Chrome 121+ 一旦元素吃到标准 `scrollbar-width/color` 就禁用全部 `::-webkit-scrollbar` 定制**,照搬进来是死代码。**在组件或宿主写一行注释登记这个决定 + 在报告里结掉这笔账。**

### M3 / M4 / M5(并入,各一行)

- **M3**:`lastUpdated` 非空分支零断言(只测了 `evaluatedAt=''` → `'—'`)。补一条 `evaluatedAt` 非空 → 文案含 `photosSvRelHours` 的断言,钉住 `relTime` 真被调用。
- **M4**:`SmartViewSidePanel.test.ts:100` 的用例标题写「n=Math.round(**13.63**) 手算=13」,**真值是 12.727**。结论 13 对但标题误导。**本仓硬约束:改一个值要 grep 它在注释/标题里的所有出现处一并改。**
- **M5**:`vi.useRealTimers()` 写在 `it` 末尾而非 `afterEach`(SidePanel 测试 3 处 + 宿主测试 1 处)⇒ 断言先失败时假时钟会漏给同文件后续用例。改 `afterEach`。

### 本轮要求

- I1/I2 各要一条**走真实时序**的回归用例(不是只断言函数被调)。
- 样式类断言一律**先锚定规则体、再断言属性**;逐个删码验证(一次一处,**Edit 手工还原,禁 `git checkout --`**)。
- **改了 `SmartViewCreateDialog.vue` 与 `PhotosThreshSlider.vue`(T5 的文件)⇒ 必须跑它们各自的测试文件确认没打破**,并在报告里说明改了哪几行。
- 只跑覆盖改动的测试文件 + `color-guard` + `parity` + 一次 `pnpm exec vue-tsc --noEmit`;**最后跑一次全量**(这是眼验前最后一轮,要给控制器一个干净的门数字)。
- **注释三禁**:`<style>` 块内注释不写字面 `#hex`;任何注释不写字面 `rgba(`;`<script>` 注释不写字面 `<style>` 一词。
- **fix 报告追加到同一份 `task-8-report.md` 末尾**。
- 返回值仍只要:状态 / commit 起止 / 一行测试小结 / concerns。
