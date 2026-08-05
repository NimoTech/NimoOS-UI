### Task 8: `SmartViewSidePanel.vue` + `SmartViewActivityFeed.vue` —— 右栏 3 段 + 活动流

**Files:**
- Create: `src/photos/components/SmartViewSidePanel.vue`
- Create: `src/photos/components/__tests__/SmartViewSidePanel.test.ts`
- Create: `src/photos/components/SmartViewActivityFeed.vue`
- Create: `src/photos/components/__tests__/SmartViewActivityFeed.test.ts`
- Modify: `src/views/PhotosSmartViewDetail.vue`(把 T6 的右栏空壳兑现)
- Modify: `src/views/__tests__/PhotosSmartViewDetail.test.ts`
- Modify: `src/i18n/{zh_cn,en_us}.ts`(**可能**新增 1-2 个 `<i18n-t>` 拆分键,见下)
- Read-only 参考: `PhotosSmartViewDetail.vue:152-230`(模板)、`:270-280`(activityText)、`:315-331`(dist/activity/threshHelp)、`:444`(distStyle)、`photos-smartview.scss:528-658`

**Interfaces:**
- Consumes: T2 的 `type SmartView` / `type SmartViewActivity`、T1 的 `relTime`、T1 的键、`service.photos.thumbnailUrl`
- Produces:
  ```ts
  // SmartViewSidePanel props / emits
  { sv: SmartView; busy?: boolean }
  (e: 'patch', patch: { threshold?: number; live?: boolean; includeVideos?: boolean }): void
  // SmartViewActivityFeed props
  { activity: SmartViewActivity[]; now?: number }
  ```

**结构规格:**

**A. `SmartViewSidePanel.vue`(3 段)**

1. **阈值段**(`:153-162`):`<h3>{photosSvQualityThreshold}</h3>` + `.sv-thresh-row`(`photosSvAutoAddWhenScore` + `<b>{thresh}%</b>`)+ **`<PhotosThreshSlider>`(T5 已抽的共享组件,含 range + 三档标尺)** + `.sv-thresh-help`。**契约**:props `{ value: number; min?: number; max?: number }`(默认 50/99)、emit `(e:'input', v:number)`。**不要自己再写一份 range 与标尺样式** —— Vue2 的 `.sv-slider` 有 14 条声明(轨道 + `::-webkit-slider-thumb`),T5 实施时因 plan 漏给读取区间而整套漏移植过一次,现已抽成组件。
   - **`thresh` 是本地 draft + debounce 提交**:Vue2 `:359-366` 是「本地 `thresh` ref + 300ms debounce → `updateSmartView`」。**照搬这个节奏**(拖滑块不能每一像素发一个请求),但**本地值要跟着 prop 走**:`watch(() => props.sv.threshold, v => { if (!dragging) thresh.value = v })`。**不要照抄 Vue2 的 `syncingSv` 标志那套** —— 那是为了压制「本地 watcher 触发提交」的自反馈,New-UI 用「只在用户交互时调 `emit('patch')`」就没有这个问题(`@input` 是用户事件,prop 回流走 watch 且不 emit)。**注释登记这个简化。**
   - **`threshHelp` 走 `<i18n-t>`**(§7e-6):键 `photosSvThreshHelp` 的值是 `At {pct}%, expect ~<b>{n}</b> new photos per week.`,`<b>` 正好包住插值 `{n}` ⇒ **可直接用 `<i18n-t keypath="photosSvThreshHelp"><template #n><b>{{ n }}</b></template></i18n-t>`,不需要拆键**。但 zh 值是「阈值 {pct}% 时,预计每周新增约 <b>{n}</b> 张照片。」—— **两个 locale 的值里都还留着字面 `<b>` 标签,必须先把这两处的 `<b></b>` 从值里去掉**(T1 已按 json 原样写入,本任务负责改成插槽形态)。**这是本任务要动 i18n 文件的原因,报告里登记。**
   - `n` 的计算照搬 `:326`:`Math.round(newCount * (100 - thresh) / 22 * 1.4)`,`newCount = sv.addedThisWeek`。**尾巴两句照搬 `:328-329`**:`thresh > 85` 追加 `photosSvMayMissBorderlineMatches`;`< 70` 追加 `photosSvMayIncludeFalsePositives`;否则无尾巴。**这两句是独立句子,拼在 `<i18n-t>` 之后,不进插槽。**
2. **设置段**(`:164-180`):`<h3>{photosSvSettingsSection}</h3>`(**注意用的是新键,不是 `Settings`** —— 偏离登记 10)+ 两个 `.sv-toggle-row`:
   - `photosSvAutoAddMatches` + 说明随状态二选一(`paused` → `photosSvPausedUploadsNotAdded`;否则 `photosSvRunEveryUpload`)+ switch(`:data-on="!paused"`,切换 emit `{ live: paused }`)。
   - `photosSvIncludeVideos` + 说明 `photosSvMatchAgainstVideoKeyframes` + switch(`:data-on="sv.includeVideos"`,切换 emit `{ includeVideos: !sv.includeVideos }`)。
   - **两个 switch 同样要 `role="switch"` + `aria-checked` + `aria-label`**(与 T5 同一约束)。
   - **这两个开关是纯派生 + 直接 emit,没有本地 state**(与阈值滑块不同 —— 开关是离散的,不需要 debounce)。
3. **统计段**(`:182-209`):`<h3>{photosSvStats}</h3>` + `.sv-stat-grid` 四格:
   - count 千分位 / `photosSvTotal` + `<span class="delta">+{newCount}</span>`
   - `{median}%` / `photosSvMedianMatch`
   - `formatMB(storageBytes)` / `photosSvStorage`
   - `lastUpdated` / `photosSvLastUpdate`
   - **`formatMB` 由 T6 建在 `src/photos/util/formatBytes.ts`,本任务直接 import 消费,不要重建**(plan 自查修正 1)。`lastUpdated` 由宿主(T6)算好传进来?**不** —— 两处都自己调 `relTime`,避免多一个 prop;`now` 作为可选 prop 便于测试。
   - 下方:`photosSvMatchScoreDistribution` 小标题 + `.sv-distribution`(`v-for` 出 10 根柱,`:style="distStyle(d, i)"`)+ `.sv-dist-x` 三个刻度(`50%` / `75%` / `100%`,**这三个是纯数字字面量,不进 i18n** —— 照 P6b 方向字母的先例,注释登记)。
   - **`dist` 与 `distStyle` 照搬 `:315-317` 与 `:444`**:`dist = sv.distribution.length ? sv.distribution : new Array(10).fill(0)`(T2 已在归一层兜底,这里是双保险,**照搬保留**);`distMax = Math.max(1, ...dist)`;`distStyle = { height: (d / distMax * 100) + '%', opacity: 0.4 + i * 0.06 }`。
   - **柱子的颜色**:Vue2 `scss:640-651` 是写死渐变。改 token(accent 家族);`opacity` 的内联计算是布局量不是颜色,保留内联 style **但要给程序化断言**(`:style` 里的 opacity 值随 i 变)。

**B. `SmartViewActivityFeed.vue`**

4. `.sv-activity` → `v-for` 出 `.sv-activity-row`:
   - `.sv-activity-thumbs`:`a.assetIds.length > 0` → 最多 3 张 `<img>`(`thumbnailUrl(id, 'large')`);否则一个 26×26 的占位块(accent 软底 + sparkles 11px)。**Vue2 `:219-221` 是内联 style,改 class 并逐属性对照(含 `border-radius:4px`)。**
   - `.sv-activity-text`:**5 种 `eventType` → `<i18n-t>` 或纯文本**(§7e-6):
     | eventType | 键 | 形态 |
     |---|---|---|
     | `created` | `photosSvSmartViewCreated` | 纯文本 |
     | `updated` | `photosSvConditionsSettingsUpdated` | 纯文本 |
     | `matched` + `assetIds.length === 1` | `photosSvActOneMatched` | **值里 `<b>1 new photo</b>` 的 `1` 是静态的 ⇒ 必须拆成主句键 + 加粗词键**:新增 `photosSvActOneMatchedBold`(zh「1 张新照片」/ en `1 new photo`),主句键的值改成 `{photo} 已自动添加` / `{photo} auto-added`。**本任务新增这一个键。** |
     | `matched` + `length !== 1` | `photosSvActNMatched` | `<b>` 包住插值 `{n}` ⇒ 直接开槽,**同样要先把值里的字面 `<b></b>` 去掉** |
     | `exported` | `photosSvExportedDetail` | `{detail}`,`detail` 空则用 `photosSvExportFile`(照搬 `:276`)|
     | `renamed` | `photosSvSmartViewRenamed` | 纯文本 |
     | **其他/未知** | —— | **Vue2 `:278` 的 `default: return a.eventType` 会把后端原始 eventType 渲染给用户**。改成:**跳过该行不渲染 + `console.warn('[photos-smartviews] unknown activity eventType', type)`**(照 P6b insight 未知 key 的同款处置)。**偏离登记。** |
   - `.sv-activity-time`:`relTime(a.occurredAt, now, t, locale)`。
5. **`<i18n-t>` 的测试会吃到 i18n 插件重复注册的 dev warning** ⇒ 断言 `console.warn` 时必须按 `[photos-smartviews]` 前缀过滤。

- [ ] **Step 1: 写失败测试**

`SmartViewSidePanel.test.ts` 必含用例:
- 三段各存在:`h3` 三个、range 一个、两个 `role="switch"`、`.sv-stat-grid` 下 4 格、`.sv-distribution` 下 10 根柱、`.sv-dist-x` 三刻度。
- 阈值:拖 range 到 92 → `.sv-thresh-row b` 显示 `92%`;**用 fake timer 断言 300ms 后才 emit `patch` 且只 emit 一次**(连拖 5 次只 1 个);300ms 内改回原值 → 仍 emit(照搬,不做值比较)。
- prop 回流:`sv.threshold` 从 80 变 90 → 显示变 90 **且不 emit**(**这条钉住「prop 回流不触发提交」,替代 Vue2 的 `syncingSv`**)。
- `threshHelp`:`addedThisWeek = 10`、`thresh = 80` → `n = Math.round(10 * 20 / 22 * 1.4) = Math.round(12.727) = 13`(**手算过**);渲染出的 DOM 里 `<b>` 包着 `13`;`thresh = 90` → 尾巴含 `photosSvMayMissBorderlineMatches`;`thresh = 60` → 含 `photosSvMayIncludeFalsePositives`;`thresh = 80` → 两句都无。**边界 85 与 70 都走无尾巴。**
- **`threshHelp` 零 `v-html`**:读组件源文本断言不含 `v-html`;渲染结果里有真的 `<b>` 元素(`wrapper.find('.sv-thresh-help b').exists()`)。
- 设置段:`live: false` → 第一个 switch 的 `aria-checked` 是 `'false'`、说明是 `photosSvPausedUploadsNotAdded`;点它 → emit `{ live: true }`;`includeVideos` 开关点击 → emit `{ includeVideos: !原值 }`。
- 段标题用的是 `photosSvSettingsSection` 的值(**「设置」**),**不是**「系统设置」(偏离登记 10 的守卫 —— 断言渲染文本不含「系统」)。
- 统计四格数值:`median` 缺 → `0%`;`formatMB` 三档同 T6;`lastUpdated` 在 `evaluatedAt` 为空时是 `—`。
- 分布柱:`distribution = [1,2,3,4,5,6,7,8,9,10]` → 第 10 根 `height: 100%`、第 5 根 `height: 50%`;全 0 → `distMax = 1` 故全 `height: 0%`(**不是 NaN**,这条钉住 `Math.max(1, …)`);`opacity` 随 i 递增(断言第 0 根是 `0.4`、第 9 根是 `0.4 + 9*0.06 = 0.94`,**浮点比较用 `toBeCloseTo` 或字符串包含**)。
- `distribution` 为空数组 → 仍渲染 10 根柱(兜底)。

`SmartViewActivityFeed.test.ts` 必含用例:
- 6 种 eventType × 各一条:`created` / `updated` / `matched`(1 张)/ `matched`(3 张)/ `exported`(有 detail / 无 detail 两条)/ `renamed` 各渲染出对应文案。
- **未知 eventType → 该行不渲染 + `console.warn` 被调**(按 `[photos-smartviews]` 前缀过滤,**其它 warn 不算**)。
- `matched` 两条的 DOM 里都有真 `<b>` 元素;组件源文本不含 `v-html`。
- 缩略图:`assetIds` 5 条 → 只渲染 3 张 `img`;`assetIds` 为空 → 0 张 img + 1 个占位块;`thumbnailUrl` 参数是 `(id, 'large')`。
- `activity` 为空 → `.sv-activity` 渲染但内部 0 行(**Vue2 无空态,照搬**)。
- 时间:`now` prop 可覆写 → 30 秒前的项显示 `photosSvRelMinutes` 的值。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/photos/components/__tests__/SmartViewSidePanel.test.ts src/photos/components/__tests__/SmartViewActivityFeed.test.ts`

- [ ] **Step 3: 实现两个组件 + 去掉两个 i18n 值里的字面 `<b>` + 新增 `photosSvActOneMatchedBold` + 在详情页挂载**

- [ ] **Step 4: 跑全量 + tsc + color-guard + parity,逐个删码验证**

Run: `pnpm exec vitest run && pnpm exec vue-tsc --noEmit`

删码清单:①阈值的 300ms debounce → 「连拖 5 次只 1 个」用例红;②`watch(() => props.sv.threshold)` 里的 `dragging` 门控(或整条 watch)→ prop 回流用例红;③`distMax` 的 `Math.max(1, …)` → 全 0 用例红(会 NaN);④未知 eventType 的跳过 + warn → 对应用例红;⑤`assetIds.slice(0, 3)` → 5 条用例红;⑥段标题换回 `Settings` 键 → 「不含系统」用例红;⑦`threshHelp` 的尾巴两个 `if` → 边界用例红。

- [ ] **Step 5: Commit**

```bash
git add src/photos/components/SmartViewSidePanel.vue src/photos/components/SmartViewActivityFeed.vue src/photos/components/__tests__/ src/views/PhotosSmartViewDetail.vue src/views/__tests__/PhotosSmartViewDetail.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(photos): P7a-T8 智能视图右栏三段 + 活动流(i18n-t 零 v-html)"
```

---

## ⏸ D16 中途验收点

**T8 完成后停下,不要直接开 T9。** 控制器执行:

1. `pnpm exec vitest run && pnpm exec vue-tsc --noEmit`(全量四道门复跑一遍,记录数字)
2. `ss -ltn | grep 527` → **5277 有旧进程必须先杀**
3. `cd /home/nimo/NimoTech/.sp7/NimoOS-New-UI && pnpm dev --host --port 5277`
4. 请用户在 `http://192.168.1.143:5277/` 根路径登录,再进 `/app/#/photos/smart-views` 眼验
5. 把用户反馈按「Vue2 缺陷 / 本期回归 / 非缺陷」三类定性后处理,再开 T9

**中途验收清单(智能视图那半,jsdom 测不到的):**

1. 列表页 hero 与卡片网格的间距、卡片拼贴的三格比例(大图占左、两小图右侧上下)。
2. **D15 占位态**:新建一个条件很窄的智能视图(比如 `scene: 一个库里没有的东西`),它的 seeds 会是 0 条 → 卡片应显示三个中性占位块,**不应出现无关照片、也不应出现碎图标**。
3. Live / Paused 状态 pill 的绿点与灰点在**两套主题**下都看得清(压在照片上)。
4. 创建弹窗:左右两栏在桌面宽度下的比例;**窄屏(≤768px)应变单列**;右侧实时预览的计数与 6 张图在改描述/拖阈值时是否跟着变。
5. 建议 chips:输入「tokyo sunset」应冒出 `scene: sunset` 与 `place: Japan` 两颗。
6. 5 个模板行点下去,名称/描述/阈值/条件是否都填上(**条件非空是 T1 `descEn` 契约的真机验证**)。
7. 详情页:**改名后标题立即变**(这是 §7e-2 修复的核心,Vue2 是不变的);**加/删条件后 chips 立即变**(同上)。
8. 阈值滑块拖动的顺滑度(300ms debounce 之后才发请求,拖动过程中数字应实时跟手)。
9. 匹配分布柱状图的形状是否合理(全 0 时应是一条底线而不是空白或 NaN 撑破)。
10. 活动流的图标/文案/时间;**加粗部分应是真的粗体**(`<i18n-t>` 生效)。
11. **导出 ZIP 是否真的下载下来了**(§7e-1 修 401 的真机验证 —— Vue2 在这里必 401,是本期最值得眼验的一条)。
12. 「保存为静态相册」成功后的 toast。
13. 删除 → 确认弹窗 → 删掉后跳回列表;**撤销是否可用**(若 T6 报告里挂账了撤销能力,这条就只验跳转与 toast)。
14. more 菜单与导出菜单的层级、点外部关闭、一次 Esc 全关。
15. 「在搜索中细化」按钮此时应是**禁用 + 有说明**,不是能点但报错。
16. AI 横幅:若设备上 `aiFeatures.smartview` 为 true,这条横幅**不应出现**(眼验它没误报)。

---

## 第二半:搜索(T9-T16)

