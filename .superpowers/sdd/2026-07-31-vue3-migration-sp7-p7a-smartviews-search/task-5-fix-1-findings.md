## Fix round 1 —— 3 条 Important(9 条 Minor 里控制器挑了 4 条一并做,其余记台账不进本轮)

### I1(Important)—— 阈值滑块整套自绘外观漏移植,真机上会退化成浏览器默认灰控件

**根因是我 brief 给的 scss read 区间 `:659-1013` 没盖到 `:543`** —— 这条算 plan 的错,不算你的。

Vue2 生效规则(`photos-smartview.scss:543-563`,优先级 (0,2,0),压过 `photos.scss:2817` 那条单类 `.sv-slider`;弹窗确实在 `.photos-root` 内,shell 是 `PhotosTimeline.vue:934`)—— **控制器已回源逐行核过**:

```
.photos-root .sv-slider {
  appearance: none; width: 100%; height: 6px;
  background: linear-gradient(to right, rgba(var(--accent-rgb), 0.25), var(--accent));
  border-radius: 99px; outline: 0;
}
.photos-root .sv-slider::-webkit-slider-thumb {
  appearance: none; width: 18px; height: 18px; border-radius: 50%;
  background: white; border: 2px solid var(--accent);
  box-shadow: 0 2px 8px rgba(var(--accent-rgb), 0.4); cursor: pointer;
}
.photos-root .sv-slider-marks { …; margin-top: 4px; }
```

你现在只有 `.sv-slider { width: 100% }` 与 `.sv-slider-marks`(**丢了 `margin-top: 4px`**),全仓 grep `slider-thumb` / `accent-color` **零命中** ⇒ 质量阈值这个弹窗最核心的交互件会显示成系统默认灰轨灰点。这正是本工程「漏渲染」最高频缺陷的形态,三道门全测不出。

**改法(控制器决定,顺带解决后续重复)—— 抽成组件 `src/photos/components/PhotosThreshSlider.vue`**:

- **理由**:同一套「range + `.sv-slider-marks` 三档(宽松/平衡/严格)」在本期要用**三次** —— 本任务、**T8**(详情页右栏阈值段)、**T14**(保存为智能视图弹层)。我已核过三处的标记完全相同。scoped SFC 下若各写一份就是 14 行样式重复三遍(P6b-T5 那种 `.detail-section h4` 重复是不得已的单行规则,这里量级不同)。抽组件也正是本期 D14 已授权的「抽基元」范式。
- **契约**(T8/T14 会照此消费,请严格按这个签名,我会写进它们的 brief):
  ```ts
  // props
  { value: number; min?: number; max?: number }   // 默认 min 50 / max 99
  // emits
  (e: 'input', v: number): void                   // @input 即时,不做 debounce(节流是消费方的事)
  ```
  内部渲染 `<input type="range" :value class="sv-slider">` + `.sv-slider-marks`(三个 span,文案用 `photosSvLoose` / `photosSvBalanced` / `photosSvStrict`)。**照 Vue2 用 `:value` + `@input` 而非 `v-model`。**
- **颜色映射**:Vue2 用 `rgba(var(--accent-rgb), α)`,**本仓无 `--accent-rgb`** ⇒ 轨道渐变用既有 accent 家族(`--accent-soft` / `--accent-soft-2` / `--accent`)就近取;thumb 的 `background: white` 压在 accent 描边 + accent 渐变轨上 ⇒ **钉死浅色 + `theme-exception`**(**不要**用 `--on-accent`,它是深藏青);`box-shadow` 的 accent 光晕同理就近取或 `theme-exception`。**层级不够就新增 token 并两套主题块都给值 + 进 `docs/THEMING.md`。**
- **`::-moz-range-thumb` 一并写**(Vue2 只写了 webkit,但 Firefox 下会退化成默认控件 —— 这是**补 Vue2 的缺**,注释登记)。
- **断言**:先锚定 `.sv-slider` 与 `.sv-slider::-webkit-slider-thumb` 的规则体、再断言 `height` / `background` / `width`(用 `cssCascade.ts` 的 `extractStyleBlock` + `parseCssRules`,像你窄屏那条一样);`.sv-slider-marks` 断言含 `margin-top`。各做一次删码验证。
- 本任务的模板改成消费这个新组件,原有的阈值相关用例要继续绿(必要时调整选择器)。

### I2(Important)—— 模板行的 sparkles 图标色从 accent 变成了前景白

Vue2 `:164` 是 `<photos-icon name="sparkles" :size="11" color="var(--accent-hi)"/>`,而 Vue2 `PhotosIcon.vue` 的 `color` prop 直接落到 `:stroke` ⇒ 那 5 个模板行的图标在 Vue2 里是 **accent 色**。你的 svg 写 `stroke="currentColor"`,继承的是 `.sv-template-row { color: var(--fg) }` ⇒ 渲染成前景白。

注意同文件另两处 sparkles 之所以对,是因为 `.sv-suggest-head` / `.sv-preview-head` 这两条规则自己的 `color` 就是 `--accent-text`;唯独模板行的容器 color 是 `--fg`,`currentColor` 在这里刚好继承错。

**改法**:`.sv-template-row svg { color: var(--accent-text); }`(本仓无 `--accent-hi`,用 `--accent-text`);**hover 态 Vue2 也保持 accent,一并覆盖**。补一条先锚定规则体的断言。

### I3(Important)—— 引用了本分支不存在的先例为「免测」背书

你在文件头(`:22-23`)、样式注释(`:668-669`)与报告的「`--on-accent` 用法」专节里引了 **`SettingsSwitch.vue` / `settings.css:154-157`** 为 `.sv-switch[data-on]::after` 的 `--on-accent` 用法背书。**这两个文件在本分支零命中**(`find src -name "SettingsSwitch*"` / `-name settings.css`)—— 它们只存在于 master 工作树,而本工程明令禁止拿 master 当依据(它领先本分支 60+ 提交)。**用本分支不存在的文件为设计决策背书,论证不成立。** 而且 `role="switch"` 在本分支是**全仓第一次使用**(grep 只命中你这两行),本来就没有分支内先例 —— 那条注释反而把「首例」写成了「跟随既有」。

**三处 `--on-accent` 用法本身全部合法**(评审逐处读了紧邻背景声明:`.sv-modal-icon` 自带 `background: var(--accent)`;`.sv-switch[data-on="true"]::after` 的宿主是 accent **实底**不是渐变也不是半透;`.sv-btn-primary` 自带 `background: var(--accent)`)—— **实现不用改**。要改的是:

1. **删掉 `SettingsSwitch.vue` / `settings.css` 的引用**,改写成「本分支首个 `role="switch"`;`--on-accent` 的合法性由紧邻的 `[data-on="true"] { background: var(--accent) }` 自证」。另两个先例 `ClusterActionDialog.vue:320` / `MergeReviewDialog.vue:262` 是真的、可以留。
2. **给 `.sv-switch[data-on="true"]::after` 与 `.sv-btn-primary` 各补一条正向断言**(和你 `.sv-modal-icon` 那条同型:断言该规则用 `--accent` 实底 + `--on-accent` 前景)。3 行的事,既然 brief 授权的 net-new 一贯要正向钉死,这两处也钉上。

### 顺带一并做的 4 条 Minor(控制器挑的,其余 5 条记台账不进本轮)

- **M1 Esc 关闭是未申报的 net-new**:Vue2 这个弹窗完全没有 Esc 处理。代码注释解释了(引 `AlbumPickerDialog.vue`,该文件真实存在、可以留),但**报告的 8 条偏离清单里没有它** —— 按本项目「未申报的偏离即缺陷」补登记,并补一条 `document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))` → `update:open(false)` 的用例。
- **M5 `.sv-preview-grid` 的 `<img>` 渲染路径零覆盖**:33 个用例里 `store.preview.seeds` 恒为空,`thumbUrl()` 从未执行,`'large'` 口径无保护。补一条「设 `preview.seeds = ['a','b']` → 渲染 2 个 img + `thumbnailUrl(seed,'large')` 被调 + 带 `loading="lazy"`」。
- **M6 自动聚焦零断言**(brief 结构规格第 3 条明写要自动聚焦名称输入框):补一条 `document.activeElement` 断言。自加的 `tabindex="0"` + Enter/Space 键盘可操作性也补一条。
- **M7 `onUnmounted` 没调 `store.cancelPreview()`**:弹窗开着时离开路由,那发已排好的 300ms 防抖预览请求会成为孤儿照常发出(Vue2 靠整页 `beforeDestroy` 的 `clearTimeout` 兜住)。一行的事,补上 + 一条用例。

### 本轮要求

- 每条都要有**能变红**的断言(样式类一律**先锚定规则体、再断言属性**,全文件级 `toContain` 恒真不算)。
- 只跑覆盖改动的测试文件 + 一次 `pnpm exec vue-tsc --noEmit` + `color-guard.test.ts`;**不用重跑全量**。
- 新增 token(若有)两套主题块都给值 + 进 `docs/THEMING.md`。
- 逐个删码验证新加的断言(一次一处,**Edit 手工还原,禁 `git checkout --`**)。
- **fix 报告追加到同一份 `task-5-report.md` 末尾**,别新建文件。**`PhotosThreshSlider.vue` 的最终 props/emits 签名请在报告里显式写出来**(我要抄进 T8/T14 的 brief)。
- 返回值仍只要:状态 / commit 起止 / 一行测试小结 / concerns。
