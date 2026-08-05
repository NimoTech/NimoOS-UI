# Task 14 报告:SearchPeoplePopover.vue + SearchSaveSmartView.vue(D12 保存为智能视图接线做真)

## 实现内容

新建两个组件 + 两份测试,零 i18n 改动(见下方 C4 结论):

- `src/photos/components/SearchPeoplePopover.vue` —— 搜索栏「人物」筛选弹层
- `src/photos/components/SearchSaveSmartView.vue` —— 「保存为智能视图」弹层,D12 从假
  接线(Vue2 只置本地 state + toast)改成真调 `store.createSmartView`
- `src/photos/components/__tests__/SearchPeoplePopover.test.ts`(19 例)
- `src/photos/components/__tests__/SearchSaveSmartView.test.ts`(23 例)

## 最终接口签名

```ts
// SearchPeoplePopover.vue
defineProps<{ people: PersonOption[]; selected: string[] }>()
defineEmits<{
  (e: 'update:selected', v: string[]): void
  (e: 'apply'): void
  (e: 'cancel'): void
}>()
// 无 slot。selected 存人名(照搬 Vue2 按 name 过滤)。

// SearchSaveSmartView.vue(fix round 1 · I1 后签名有变化,T16 照此消费)
withDefaults(
  defineProps<{
    open: boolean
    query: string
    conditions: string[]
    defaultName: string
    ignoreEl?: HTMLElement | null   // 新增(fix round 1 · I1),默认 null
  }>(),
  { ignoreEl: null },
)
defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'saved', id: string): void
}>()
// 无 slot。
```

`SearchPeoplePopover.vue` 与 brief 接口段(Produces)完全一致,未做任何签名层面的偏离。
`SearchSaveSmartView.vue` 在 fix round 1 新增了 `ignoreEl?: HTMLElement | null` 一个可选
prop(I1,详见下方「fix round 1」一节)——`update:open`/`saved` 两个 emit 签名不变。

## PersonAvatar 复用决定(C10)

**决定:复用,不自绘。** 关键技巧:`:person-id="p.coverFaceId ? p.id : null"`(而不是直接
传 `p.id`)。

理由:PersonAvatar 的 `showImg` 只判 `personId !== null && !failed`,不看有没有封面——
如果直接传 `p.id`,无封面的人也会先尝试发一次图片请求,只有等 `@error` 触发后才会退回
首字母,这是一个**异步**过程。而 brief 要求的断言是"coverFaceId 为空 → **同步**无
img、直接显示首字母"。用 `personId = null` 复用 PersonAvatar 自身"personId 为 null 就走
首字母分支、不发任何请求"的既有语义,恰好等价于 Vue2 的 `v-if="p.coverFaceId"` 门控,且
**不需要改动 PersonAvatar.vue 一行代码**。删码验证清单第⑦条已实测钉住这个决定的必要性
(去掉这个门控,"无封面显示首字母"用例立即变红)。

选中环用 `:deep(.person-avatar-ring)` 挂在 PersonAvatar 的圆环元素上,不自绘一份头像:
基础态统一把边框宽度覆写成 2px(避免选中/取消选中时 1px→2px 的尺寸跳变),选中态换成
`var(--accent)` 描边 + `0 0 0 2px var(--accent-soft-2)` 光晕(0.20 阿尔法就近取
`--accent-soft-2`,本仓无逐分量 `accent-rgb` token)。

## 渲染项清单对照

### A. Vue2 `PhotosSearchView.vue:93-122`(people 弹层)→ New-UI

| Vue2 | New-UI 落点 |
|---|---|
| `.fpop` width:300 | `SearchPeoplePopover.vue` `.fpop` 类,width 固定 300px(无 prop) |
| `.fpop-search` + `v-model="peopleSearch"` | `search` ref + `.fpop-search` |
| `v-if="filteredPeopleList.length"` `.face-pop-grid` | `v-if="filtered.length"` `.face-pop-grid` |
| `.face-cell` `:data-on` `@click="toggleDraftItem"` | `.face-cell` `:data-on="isSel(p.name)"` `@click="toggle(p.name)"` |
| `.face-avatar`(渐变底+首字母/img) | `<PersonAvatar>` 复用(见上) |
| `p.named ? p.n[0] : '?'`(包在 `v-if="p.coverFaceId"` 的 `v-else`,`:104`)| 死代码不迁(C4/A-2),PersonAvatar 三级兜底覆盖 |
| `.face-cell-name` | `.face-cell-name`,`p.named ? p.n : Unnamed` 的死分支不迁 |
| `.face-cell-count` `toLocaleString()` | `.face-cell-count` `toLocaleString(localeTag)` |
| `v-else` 空态 `No people detected yet` | `.face-pop-empty` + `photosSearchNoPeopleDetectedYet` |
| 脚部 Cancel/Apply(margin-top:14px) | `.fpop-foot` Cancel/Apply,margin-top:14px |
| Apply 按钮的 `({{n}})` | `applyLabel` computed |

### B. Vue2 `:159-210`(保存弹层,按 C6 去掉 `:153-158` 的 `.save-smart` 触发按钮)→ New-UI

| Vue2 | New-UI 落点 |
|---|---|
| `<transition name="save-pop">` | `<Transition name="save-pop">`(Vue3 类名 `-enter-from`) |
| `.save-pop-head` 图标+标题+副标题+关闭 | `.save-pop-head` 结构 1:1,图标 accent 实底 |
| `.save-pop-body` 名称字段 | `.save-pop-field` + `.save-pop-input`,Enter 提交 |
| 条件字段 `.save-pop-conds` | `.save-pop-conds` v-for conditions,空态提示 |
| 阈值字段(滑块+数值) | `.save-pop-thresh-val` + `<PhotosThreshSlider>` |
| Keep it live 开关 | `.save-pop-toggle` + `.sv-switch`(role=switch) |
| `.save-pop-foot` ghost+primary | `.sv-btn-ghost`/`.sv-btn-primary` |
| `confirmSave()`(假接线) | `confirm()` 真调 `store.createSmartView` + try/catch |

## 两条腿审计(逐条声明粒度)

### `photos.scss:2689-2694`(.face-* 6 条)

1. `.face-pop-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; max-height:264px; overflow-y:auto }` → 逐条落地,token 化(无颜色需要映射)。
2. `.face-cell { display:flex; flex-direction:column; align-items:center; gap:4px; cursor:pointer }` → 逐条落地。
3. `.face-cell .face-avatar { width:48px; height:48px; font-size:18px; border:2px solid transparent }` → 宽高由 `<PersonAvatar :size="48">` 承担;`border:2px solid transparent` 由 `.face-cell :deep(.person-avatar-ring) { border-width:2px }` 承担(颜色未选中时沿用 PersonAvatar 自带的 `--card-border`,不是字面 transparent——已作为偏离登记在组件文件里:PersonAvatar 是跨多消费方冻结的公共组件,不为这一处改它的默认边框色)。`font-size:18px` 是 Vue2 内联首字母字号,PersonAvatar 自己的公式是 `size*0.32`(48*0.32=15.36px),本任务不改这个既有公式(P5 时期跨多消费方冻结的契约)。
4. `.face-cell[data-on="true"] .face-avatar { border-color:var(--accent); box-shadow:0 0 0 2px rgba(110,91,255,0.20) }` → `.face-cell[data-on="true"] :deep(.person-avatar-ring)`,border-color: var(--accent),box-shadow 用 `--accent-soft-2`。
5. `.face-cell-name { font-size:11.5px; color:var(--text-2) }` → `.face-cell-name { font-size:11.5px; color:var(--fg-muted) }`。
6. `.face-cell-count { font-size:10px; color:var(--text-4) }` → `.face-cell-count { font-size:10px; color:var(--fg-subtle) }`。

### `photos.scss:2795-2815`(.save-pop* 全组,含 2814-2815 的 transition)

1. `.save-pop { position:absolute; right:0; top:calc(100% + 8px); width:360px; background:var(--surface-1); border:1px solid var(--line); border-radius:14px; box-shadow:0 24px 60px rgba(0,0,0,0.65), 0 0 0 1px rgba(110,91,255,0.08); z-index:50; display:flex; flex-direction:column; overflow:hidden }` → 逐条落地,box-shadow 简化为 `var(--card-shadow-hi)`(省略额外的 1px accent 细描边,同 T5/T12/T13 三处既有先例的一致省略,非本任务新偏离)。
2. `.save-pop-head {...}` → 逐条落地,`--line`→`--card-border`。
3. `.save-pop-icon { width:28px; height:28px; border-radius:9px; ...; background:linear-gradient(135deg,#6E5BFF,#8A7AFF); flex-shrink:0 }` → 尺寸/圆角 1:1;背景改 `var(--accent)` 实底(C11 裁定),新增 `color:var(--on-accent)`(Vue2 svg 是字面 `color="white"`,改用 token,合法性由紧邻的 accent 实底背景自证)。
4. `.save-pop-title { font-size:13.5px; font-weight:600 }` → 落地 + 补 `color:var(--fg)`(Vue2 靠外层默认文字色级联,scoped 组件里显式声明,同 T5 既定做法)。
5. `.save-pop-sub { font-size:11px; color:var(--text-3); margin-top:1px }` → `--fg-faint`。
6. `.save-pop-body {...}` → 逐条落地。
7. `.save-pop-field {...}` → 逐条落地。
8. `.save-pop-label { font-size:11px; font-weight:500; color:var(--text-2) }` → `--fg-muted`。
9. `.save-pop-input {...}` → `--surface-2`→`--chip-bg`,`--line`→`--card-border`,`--text-1`→`--fg`。
10. `.save-pop-input:focus {...}` → `--surface-1`→`--popup-bg`。
11. `.save-pop-conds {...}` → 同上 token 映射。
12. `.save-pop-cond { ...; border:1px solid rgba(110,91,255,0.3); color:var(--text-hi) }`(注:Vue2 原文实为 `var(--accent-hi)`)→ border 用 `--accent-soft-bd`,color 用 `--accent-text`。
13. `.save-pop-toggle {...}` → 同上 token 映射。
14. `.save-pop-foot {...}` → 同上 token 映射,`--surface-1`→`--popup-bg`。
15. `.save-pop-enter-active, .save-pop-leave-active { transition:opacity 0.16s ease, transform 0.2s cubic-bezier(0.2,0.8,0.2,1); transform-origin:top right }` → 1:1 落地(**C7 要求项,已用测试钉住**)。
16. `.save-pop-enter, .save-pop-leave-to { opacity:0; transform:translateY(-4px) scale(0.97) }` → **类名改成 `.save-pop-enter-from`(Vue3 契约),值 1:1**。

### C5 裁定的 `.sv-switch`/`.sv-btn-ghost`/`.sv-btn-primary`(取 photos-smartview.scss 的高优先级值,不取 photos.scss:2817-2825 被压制的值)

逐条比对 `photos-smartview.scss:543-605` + `:970-1000`(生效值)与 T5 `SmartViewCreateDialog.vue`
已落地的实现,本组件**照抄同一套数值**(32×18 开关、14×14 拇指、`[data-on]::after` 的
`left:16px`、含 T8 的 M1 修复——`.sv-switch { transition:background 0.15s }` 与
`.sv-switch::after { box-shadow: 0 1px 3px color-mix(...) }`)。测试文件专门加了一组
"C5 反向锚定"断言,钉死 32×18/14×14/`left:16px`,防止未来有人误抄 `photos.scss:2817-2825`
的 36×20/18×18/`left:18px`。

### `.sv-slider`/`.sv-slider-marks`

未自己写,直接消费 T5 抽出的 `<PhotosThreshSlider :value="thresh" @input="onThreshInput" />`
(C9 契约:`{ value:number; min?:number; max?:number }` + `(e:'input', v:number)`,照 Vue2
`:value`+`@input`,非 `v-model`)。

## 回源核对结果(逐条)

| brief 断言 | 源码真值 | 符/不符 |
|---|---|---|
| C1 `photosSearchNoPeopleDetected` | 实为 `photosSearchNoPeopleDetectedYet`(zh_cn.ts:1294) | 符(已按控制器裁定修正) |
| C2 `photosSearchSaveAsSmartView` | 实为 `photosSearchSaveSmartView`(zh_cn.ts:1309) | 符 |
| C3 `photosSvCancel` | 不存在,复用 `photosCancel`(zh_cn.ts:555) | 符 |
| C4 `photosSearchUnnamed`(未命名键) | 确实存在(zh_cn.ts:1322/en_us.ts:1319),但落在死分支——按控制器裁定不删、零 i18n 改动 | 符(已验证 `parity.test.ts` 455 例全绿,零 i18n 文件改动) |
| brief `defaultSaveName`(:550-559) | 逐字核对,`< 40` 长度判据 + 三段拼接一致 | 符(本任务不实现,由 T16 消费,仅确认接口契约) |
| brief `openSave`/`confirmSave`(:798-812) | 逐字核对,阈值默认 75(非 T5 的 80) | 符 |
| C5 `.sv-switch` 32×18/14×14/left:16px | 逐行核对 `photos-smartview.scss:584-600` + `photos.scss:2819-2820` 低优先级补丁 | 符 |
| C7 `<transition name="save-pop">` + 两条 scss 规则 | `PhotosSearchView.vue:159` + `photos.scss:2814-2815` 逐字核对 | 符 |
| C8 store 契约(`createSmartView` 返回 `Promise<SmartView\|null>`,失败 throw) | `smartViews.ts:190-212` 逐行核对 | 符 |
| C9 `PhotosThreshSlider` props/emits | `PhotosThreshSlider.vue:21-25` 逐字核对 | 符 |
| C10 `PersonAvatar` 三级兜底 + props 形状 | `PersonAvatar.vue:20-42` 逐字核对 | 符,且发现 `showImg` 不看 coverFaceId 这一细节(见上方"复用决定") |
| C11 `.save-pop-icon` 28×28/border-radius:9px | `photos.scss:2802` 逐字核对 | 符 |
| C11 sparkles glyph | `SmartViewCard.vue:79`(与 `SmartViewCreateDialog.vue` 多处一致)逐字符核对 | 符 |
| C12 `.face-*`/`.save-pop*` 区间完整性 | 逐条清点,6 条 + 16 条(含 transition 两条),与控制器给出的行号范围精确对应(fix round 1 · M6 修正:此前误写"15 条",`.save-pop*` 区间 `2795-2815` 实际是 16 条独立规则) | 符 |
| 新查实:`.fpop-foot` 的 margin-top 在人物弹层是 14px,与 T12/T13 的 12px 不同 | `PhotosSearchView.vue:113`(`margin-top:14px`)vs 列表弹层(T12)`:142`/日期弹层(T13)`:84`(均 `margin-top:12px`,fix round 2 · N3 修正配对) | **本任务新查实的差异**(brief 未提及,已在两条腿审计与测试里钉住) |

## 偏离登记

1. **PersonAvatar 的 `personId` 门控**(`p.coverFaceId ? p.id : null`,而非直接传
   `p.id`)。Vue2 原样:`v-if="p.coverFaceId"` 才渲染 `<img>`,否则直接首字母,零网络请求。
   为什么:PersonAvatar 本身不看 coverFaceId,只看 `personId`+`failed`。若直接传 `p.id`,
   无封面的人会先发起一次注定失败的图片请求,`showImg` 要等 `@error` 触发后才变
   false——这是异步的,不满足 brief 要求的"同步无 img"断言,也会在真机上对每个无封面
   的人发一次注定 404 的请求。改用 `personId=null` 复用组件既有语义,零改动
   PersonAvatar.vue。注释位置:`SearchPeoplePopover.vue` 文件头 + `:person-id` 那一行上方。

2. **`.face-avatar` 的选中环基础态从"2px transparent"改为"2px var(--card-border)"**。
   Vue2 未选中时边框是 `2px solid transparent`(视觉上不可见,只占位)。这里复用
   PersonAvatar 自带的 `--card-border` 细描边(P5 时期跨组件的既有默认视觉,不是本任务
   引入),只把边框宽度统一钉到 2px 避免选中切换时的尺寸跳变。视觉上未选中头像会有一圈
   极细的中性描边(而不是完全不可见),判定为可接受的最小偏离——PersonAvatar 在应用其余
   位置本就一直带这圈描边,搜索弹层没有理由单独抠掉它。注释位置:
   `SearchPeoplePopover.vue` 的 `.face-cell-name` 声明上方注释 + `:deep()` 规则上方注释。

3. **brief 结构规格第 40 条要求的 `@keydown.esc.prevent="close"`(名称输入框)未绑定**。
   理由:本组件已有 document 级 Esc 监听器(Global Constraints 硬约束,Vue2 本身没有这层
   ——Vue2 靠这个内联绑定是因为它没有更高层的 Esc 处理),keydown 默认冒泡到 document,
   重复绑定会让同一次按键触发两次 `close()`/两次 `emit('update:open', false)`。同
   T5 `SmartViewCreateDialog.vue` 的既定做法(它的名称输入框同样只绑 `keydown.enter`)。
   注释位置:`SearchSaveSmartView.vue` 名称输入框上方的 HTML 注释。

4. **`.save-pop` 的 box-shadow 简化为 `var(--card-shadow-hi)`**,省略 Vue2 原文额外的
   `0 0 0 1px rgba(110,91,255,0.08)` 细描边。理由:本仓"不透明浮动面板"的既定组合是
   `--popup-bg + --card-border + --card-shadow-hi`,T5/T12/T13 三处先例均已统一省略这层
   极淡的 accent 描边,不是本任务新引入的偏离,是延续既有惯例。

5. **`.save-pop-title`/`.save-pop-icon` 补充显式 `color`**(Vue2 靠外层级联默认色,本仓
   scoped 组件显式声明),延续 T5 `SmartViewCreateDialog.vue` 的既定做法,不是新偏离。

## 删码验证清单

逐条按脚本删→跑对应测试→记录→用 Edit 手工还原(全部完成,无一条"删了不红"):

| # | 删的内容 | 结果 | 说明 |
|---|---|---|---|
| ① | `watch(() => props.open)` 的重置逻辑改挂到 `onMounted` | **红**(2 例失败) | "重置走 watch" 用例 + 一个连带的 confirm 用例受影响 |
| ② | `thresh.value = 75` → `80` | **红**(1 例) | "thresh 回到 75" 断言失败,显示 `≥80%` |
| ③ | `conds: [...props.conditions]` 去掉展开 | **红**(1 例) | 见下方"测试修正"——最初的引用比较断言不具区分力,已改为"确认之后原地 push 原数组,已发出的 conds 不受影响"这一可证伪写法,删码后确认变红 |
| ④ | `confirm()` 的 try/catch 整段去掉 | **红**(1 例 + 1 个未捕获 rejection) | 失败用例的 toast 断言落空,且暴露一个 unhandled rejection |
| ⑤ | `description: props.query` → `''` | **红**(1 例) | description 字段断言失败 |
| ⑥ | Apply 计数的三元(`selected.length>0` 分支)去掉 | **红**(1 例) | "2 人→含 (2)" 断言失败 |
| ⑦ | `p.coverFaceId ? p.id : null` 简化为直接 `p.id` | **红**(1 例) | "无封面显示首字母" 断言失败,变成有 img |

**测试修正记录**(删码验证过程中发现并修的一处假绿风险):最初 ③ 号验证点写的是
`expect(arg.conds).not.toBe(conditions)`(引用比较),删掉展开后跑测试**仍然全绿**——
原因是 Vue 的 props 是 `reactive()` 包出来的 Proxy,`props.conditions` 读到的本来就不是
原始数组本身(是包着它的 Proxy),这条引用比较对"有没有 `[...]` 展开"这件事天生没有区分
力。已改成:confirm 之后原地 `conditions.push(...)`,断言已经发出去的那次调用参数
`arg.conds` 不受这次原地修改影响——这才是"展开产生了独立快照"这件事本身可证伪的写法,
重新验证后①删除展开→红,②还原→绿。

## 交接下游的事实

- **T16 交接:`.save-smart` 触发按钮不在本任务范围内**(C6 裁定)。需要在宿主侧实现,已
  查实两个坑供 T16 参考:①按钮本身 `background: linear-gradient(...)` + `border` 用
  accent 字面 rgba(`photos.scss:2645`);②`[data-saved="true"]` 态用固定绿色(字面
  `#34C759`)+ 三个 `!important`(`:2652-2656`)——按 plan 全局约束,新增该绿色前应先
  grep `theme.css` 找现成的"成功色" token,没有再新增,不要直接照抄字面 `#34C759`。
- **T16 交接:`SearchSaveSmartView.vue` 的定位依赖宿主提供 `position:relative` 容器**。
  本组件根节点自带 `position:absolute; right:0; top:calc(100% + 8px)`,与 Vue2 一致——
  需要宿主把触发按钮与本组件包在同一个 `position:relative` 的外层容器里(同 Vue2
  `<div style="position:relative">` 那层)。
- **T16 交接:`SearchPeoplePopover`/`SearchSaveSmartView` 是两种不同的宿主契约(C13)**。
  `SearchPeoplePopover` 沿用 T12/T13 的"宿主 `v-if` 重新挂载复位内部 state"手法(本组件
  内部 `search` ref 无需宿主管理,复位靠重新挂载)；`SearchSaveSmartView` 则是
  **持久挂载 + prop 显隐**,复位靠 `watch(() => props.open)`——这是刻意的差异,不要"统一"
  成同一种模式。
- **T16 交接:`SearchSaveSmartView` 需要宿主传入 `query`/`conditions`/`defaultName`**,
  本组件本身不计算 `defaultSaveName`(照 Vue2 `:550-559` 由 T16 实现)。
- **T16 交接(fix round 1 · I1,新增,重要):`SearchSaveSmartView` 现在自己实现了
  Vue2 `_onDoc`(整体 :819-832,保存弹层那半判据在 :820-822)的点外部 mousedown 关闭,
  但判据的另一半需要宿主配合(fix round 2 · N2 修正行号)** ——
  必须把 `.save-smart` 触发按钮的 DOM element 传给新增的 `ignoreEl` prop,否则点触发按钮
  那一下会被判定为"外部点击"从而立刻把刚打开的弹层关掉(退化行为,已有测试钉住这条
  退化路径本身也是确定性的、不是未定义行为)。
- **T16 交接(fix round 1 · M9,新增):`people` prop 的顺序契约**——Vue2 `realPeopleList`
  (`:435-447`)以 `.sort((a,b) => b.c - a.c)` 按人脸计数降序结尾,`SearchPeoplePopover`
  只透传 `people` prop、不自己排序,T16 组装数组时必须保持这个降序,否则弹层网格顺序会
  与 Vue2 不一致。
- **T16/P7b 交接:i18n 表里 `photosSearchUnnamed` 键继续保留但零消费方**——T9 的 54 键表
  没有需要修正的地方,后续任何审计工具如果做"i18n 键未使用扫描",这一条属于已知的、
  经控制器裁定保留的例外,不是遗漏。

## 测试与结果

```bash
pnpm exec vitest run src/photos/components/__tests__/SearchPeoplePopover.test.ts
# Test Files  1 passed (1) / Tests  19 passed (19)

pnpm exec vitest run src/photos/components/__tests__/SearchSaveSmartView.test.ts
# Test Files  1 passed (1) / Tests  23 passed (23)

pnpm exec vue-tsc --noEmit
# (无输出,类型检查通过)

pnpm exec vitest run
# Test Files  310 passed (310) / Tests  3512 passed (3512)
# (一次偶发的 src/files/upload/persist.test.ts 假红,与本任务改动的文件无关——该文件
#  在 git status 里完全没有变化,单独连跑 4 次均为绿,判定为 IndexedDB 假计时器相关的
#  既有 flaky 用例,不阻塞本任务)

pnpm exec vitest run src/styles/color-guard.test.ts src/i18n/parity.test.ts
# Test Files  2 passed (2) / Tests  455 passed (455)
```

## TDD Evidence

两个组件的实现代码与测试代码是同批写就(测试先写完整清单,随即跟实现一起首次跑测试),
首次运行即全绿(未经历"先失败再修"的常规 RED 阶段,因为实现是按测试逐条对照写的)。**真
正的 RED 阶段体现在删码验证清单**——上表 7 条删码全部先出现 RED(逐条附有失败输出),
再用 Edit 手工还原到 GREEN,这是本任务对每一条关键行为的可证伪性验证记录,等价于
"如果这行代码不存在,测试会告诉我们"。

一个例外(TS 编译错误,真实的 RED→GREEN 循环):`SearchPeoplePopover.test.ts` 里
`w.get('[data-test="people-empty"]').exists()` 触发 tsc 报错(`get()` 返回类型没有
`exists` 方法),修正为直接断言 `.text()` 后 tsc 清零:

```
$ pnpm exec vue-tsc --noEmit
src/photos/components/__tests__/SearchPeoplePopover.test.ts(110,48): error TS2339:
Property 'exists' does not exist on type 'Omit<DOMWrapper<Element>, "exists">'.
```
修正后:
```
$ pnpm exec vue-tsc --noEmit
(无输出)
```

## Files changed

- `src/photos/components/SearchPeoplePopover.vue`(新建)
- `src/photos/components/SearchSaveSmartView.vue`(新建)
- `src/photos/components/__tests__/SearchPeoplePopover.test.ts`(新建)
- `src/photos/components/__tests__/SearchSaveSmartView.test.ts`(新建)
- `src/i18n/zh_cn.ts` / `src/i18n/en_us.ts`:**零改动**(C4 裁定,brief Step 5 的
  `git add` 清单里这两个文件已按控制器指示排除)

## Self-review 发现与处理

- 发现 `SearchSaveSmartView.vue` 曾在早期草稿里 import 了未使用的 `computed`(实现过程
  中没用上)——已删除该 import,`vue-tsc --noEmit` 保持零输出。
- 检查确认两个组件均未出现字面颜色(`#hex`/`rgb(`/`rgba(`)——`color-guard.test.ts`
  455 例全绿印证。
- 检查确认 `selected.includes(p.name)` 是按人名字符串比较(Vue2 同款语义),`p.id` 直传
  给 `PersonAvatar` 时不做 `String()` 转换(两者本就都是 `string` 类型,`PersonOption.id`
  与 `PersonAvatar.personId` 均为 `string`,无需转换)。
- 确认 `hoverBackgroundRules`/`winningHoverBackground` 断言均指向含 `:hover` 的胜出规则
  且带上具体类名子串(`-primary`/`-ghost`),不是恒真断言。
- 确认所有 scss 区间(C12 给出的 `.face-*` 6 条 + `.save-pop*` 16 条)在两条腿审计表里
  逐条出现,没有遗漏声明。

## Concerns

无阻塞性顾虑。以下两点留给下游:

1. T16 需要决定 `.save-smart` 触发按钮的绿色 `[data-saved]` 态具体用哪个 token(已交接
   坑位,見上)。
2. `.face-cell-name`/首字母字号(11.5px / PersonAvatar 公式算出的 15.36px)与 Vue2 字面
   18px 有约 2.6px 出入,已判定为可接受偏离(不改 PersonAvatar 冻结契约),但如果真机
   验收觉得偏小,需要回到 P5 的 PersonAvatar 契约层面讨论,不是本任务能单独调的。

---

# Fix Round 1(评审:Spec ❌ / 0 Critical + 2 Important + 10 Minor,并入 9 条 Minor,共处理 11 项)

## 处理清单与逐条改动

### I1(Important)点外部 mousedown 关闭 —— 补齐 Vue2 `_onDoc`(整体 :819-832,保存弹层
那半判据在 :820-822,fix round 2 · N2 修正行号)缺失的一半判据

**改动**(`SearchSaveSmartView.vue`):
- 新增可选 prop `ignoreEl?: HTMLElement | null`(默认 `null`,`withDefaults`)。
- 新增 `rootRef`,绑到根节点 `.save-pop`。
- 新增 `onDocMousedown(e)`:`insideRoot = rootRef.contains(target)`、
  `insideIgnore = ignoreEl?.contains(target)`,两者都算完再判断
  `if (!insideRoot && !insideIgnore) close()`——不写成"查一个命中就早退"的形态。
- `watch(() => props.open)` 里与 `onDocKeydown` 同款挂/摘 `mousedown` 监听,`onUnmounted`
  同样清理。

**新增测试**(7 条,`describe('点外部 mousedown 关闭(fix round 1 · I1)')`):
1. 点弹层内部 → 不关
2. 点弹层外 → emit `update:open(false)`
3. 传了 `ignoreEl` 时点 `ignoreEl` 内部 → 不关(新 prop 主守卫)
4. 不传 `ignoreEl` 时点"本该是触发按钮"的外部节点 → 仍然会关(退化行为,已注明)
5. `open:false` 时点外部 → 不 emit
6. 宿主把 `open` 收回 `false` 后再点外部 → 不再触发(监听器随 `watch(open)` 摘除)
7. 卸载时清掉 `document` 监听(`mousedown` 与 `keydown` 都摘除,照 `PlacesThemeMenu.test.ts`
   的既有断言写法用 `addSpy`/`removeSpy` 抓同一个函数引用)

**变异验证**(逐条 Edit 手工改回、确认红、再手工还原):
- 去掉 `insideIgnore` 判据 → `传了 ignoreEl 时点 ignoreEl 内部 → 不关` 红(见下方命令输出)
- 去掉 `document.addEventListener('mousedown', ...)` → 3 条测试红(点弹层外/ignoreEl 主守卫/卸载清理)
- 均已用 Edit 手工还原,`git status`/`git diff` 复核与还原前一致。

**确认要求逐项核实**:
- ①既有 42 例未被打破:改动前 42 例、改动后 `SearchSaveSmartView.test.ts` 独立跑 34 例
  (23 原有 + 7 I1 新增 + 3 I2 新增 + 1 M5 新增 = 34)、`SearchPeoplePopover.test.ts` 19 例
  不变,合计 53 例,全绿(见下方命令输出)。
- ②`onDocMousedown` 里没有早退:函数体是"算两个布尔量 → 一次 if"的线性结构,没有任何
  `if (cond) return` 提前退出。
- ③监听是 `watch(open)` 挂/摘、卸载时清掉:与 `onDocKeydown` 完全对称,`onUnmounted` 里
  两者都 `removeEventListener`。

### I2(Important)三处零断言(C11 尺寸 / `.save-pop` 定位 / 三枚 glyph)

**新增测试**(3 条):
1. `.save-pop-icon` 尺寸是 28×28、`border-radius:9px`(反向锚定,防止与 T5 `.sv-modal-icon`
   的 32×32/10px 焊到一起)
2. `.save-pop` 的 `width:360px`/`z-index:50`/`top:calc(100% + 8px)`/`right:0`
3. 两处 sparkles(head 图标块 + primary 按钮)与一处 x(关闭按钮)的 `path d` 逐字符正确
   (用整段字符串出现次数断言,不是单纯 `toContain`)

**变异验证**(逐条改回、确认红、还原):
- `.save-pop-icon` 改成 32×32/10px → 该条断言红,已还原
- `.save-pop` 的 `top`/`width` 改掉 → 该条断言红,已还原
- primary 按钮的 sparkles glyph 改一个字符(`7.7`→`7.9`)→ 断言红(次数从 2 变 1),已还原
- 关闭按钮 x 的 glyph 整体倒序改写 → `toContain(xD)` 红,已还原

### M1 `.icon-btn` 注释措辞修正

Vue2 真值(`photos.scss:216-223`)是 32×32、`color: var(--text-2)`、hover
`background: var(--surface-3); color: var(--text-1)`。原注释误写"等价",已改成偏离登记,
写明真值 + 沿用 T5 既有先例(28×28/`--fg-subtle`)的理由。**纯注释改动,无行为变化,不需要
变异验证。**

### M2 PersonAvatar 兜底底色偏离补登记

新增注释:Vue2 `:101-102` 的兜底底色是写死的浅紫→粉双色渐变(135 度角,`#A18CD1` 到
`#FBC2EB`,不属于 accent 家族;fix round 2 · N4 修正:上一轮把方向写反成"暖粉→浅粉紫"),
New-UI 走 `--avatar-fallback` token——两者色值不同,是复用 PersonAvatar 时继承的既有偏离
(P5 时期定的公共兜底色,非本任务新定)。**纯注释补登记,无行为变化。**

### M3 千分位断言重做

- 正则从 `/toLocaleString\(\s*\S+/`(`)` 本身是 `\S`,连裸调用都能匹配,零区分力)改成
  `/toLocaleString\(\s*localeTag\s*\)/`(钉住具体标识符)。
- 渲染断言加注释说明:zh-cn/en-us 对 1200 这个数字的千分位分组恰好相同,这条断言的职责
  是"渲染确实带分隔符"的基本回归锚点,不是 locale 区分力来源——真正的 locale 区分力在
  上面那条源文本正则。
- **变异验证**:把 `toLocaleString(localeTag)` 改成裸调用 `toLocaleString()` → 正则断言红
  (见下方命令输出),已还原。

### M4 Esc 依据修正

原注释说"Vue2 本身没有更高层的 Esc 处理"——**这句错**,Vue2 `mounted()` 里确实有
`document.addEventListener('keydown', this._onKey)`,只是它的效果是"Esc 关灯箱未开时
退出整个搜索页"(`exitSearch()`),不是关这个保存弹层。已改成准确表述:本组件新增的
document 级 Esc 监听器是专门服务本弹层的一层,不依赖"Vue2 没有更高层处理"这个(错误的)
前提,只依赖"避免同一次按键触发两次 emit"这条本身成立的理由。**纯注释修正。**

**改这条时顺带做的自查,又抓到 2 处此前未被评审点名的行号错(不在 11 项清单内,但属于
"通读全文自查注释所述 vs 代码真实行为"这项要求应做的事,顺手修了,未另开一轮)**:
- 名称输入框上方的偏离登记原写"照搬 Vue2 `:793`"(指 Vue2 `@keydown.esc.prevent=
  "saveOpen = false"` 那一行)——回源 `grep -n` 实际是 **`:175`**,`:793` 差了 618 行(疑似
  上一轮笔误时看错了别的文件的行号),已修正。
- `_onKey` 赋值 + `addEventListener('keydown', ...)` 原写 `:826-828`——回源核对
  `PhotosSearchView.vue:834-835` 才是真实位置(`:826-828` 落在 `_onDoc` 内部 `openPop`
  分支的另一段逻辑里,与 Esc 处理完全无关),已修正为 `:834-835`,I1 顶部注释里对应的
  `_onDoc` 整体范围引用也一并核对改成 `:819-832`(该函数体实际跨度),本弹层相关的判据
  片段精确到 `:819-823`。

### M5 `description` trim + `|| undefined`

- `description: props.query` → `description: props.query.trim() || undefined`。
- 新增测试:`query` 为 `'   '`(全空白)时 `description` 必须是 `undefined`,不是空/带空白
  字符串。
- **变异验证**:改回 `props.query` 直传 → 新增用例红(见下方命令输出),已还原。

### M6 行号/计数笔误修正(组件注释 + 报告双处)

逐条回源核实并修正:
- `SearchPeoplePopover.vue` 内 `realPeopleList` 的 `.filter` 引用:`:437` → `:438`(真值)。
- `SearchPeoplePopover.vue` 内脚部 `margin-top:14px` 引用:`:115` → `:113`(真值),并把对比
  的 T12/T13 引用从含糊的"`:87`/日期弹层的`:12px`"改成精确的"`:84`/`:142`(均
  `margin-top:12px`)"——**fix round 2 · N3 复审查实这一步把 T12/T13 与 :84/:142 的对应
  关系配反了**(误写成 T12→:84、T13→:142),真实对应是 T12(列表弹层)→:142、
  T13(日期弹层)→:84;本组件注释与上一行表格已在 fix round 2 改正,这里保留原始记录并
  加注说明,不倒填历史。
- `SearchPeoplePopover.vue` 内空态内联 style 引用:`:107-109` → `:110-112`(真值)。
- `task-14-report.md` 节点清点表里的死代码三元:`p.coverFaceId ? p.n[0] : '?'` → 改成真实
  的 `p.named ? p.n[0] : '?'`(包在 `v-if="p.coverFaceId"` 的 `v-else` 里,`:104`)。
- `task-14-report.md` 两处"6 条 + 15 条" → 改成"6 条 + 16 条"(`.save-pop*` 区间
  `2795-2815` 实际是 16 条独立规则,逐条重数已核对)。
- **改完对这 4 类结论(`:437`/`:115`/`:107-109`/"15 条")在两个组件文件与报告全文里各
  grep 一遍,确认再无第二处残留旧值**(见下方命令输出)。

### M7 恒真断言标注

`失败` 用例里 `expect(w.find('[data-test="ssv-root"]').exists()).toBe(true)` 本身恒真
(`open` 是父控 prop,组件在任何实现下都无法自关,测试也从未 `setProps`)。保留该行作为
"人话可读性锚点",加注释明确说明真正的行为守卫是上一行
`emitted('update:open')).toBeUndefined()`,这条不再被视为有效守卫。**纯注释澄清,不删断言
(评审给的两个选项之一)。**

### M8 三处加性改动登记

- `SearchSaveSmartView.vue` 开关 `tabindex="0"` + `@keydown.enter`/`@keydown.space`:
  Vue2 `:198-199` 只有 `@click.prevent`。已加注释,说明是延续 T5
  `SmartViewCreateDialog.vue` 已定的同型 a11y 基线,不是本任务重新决定。
- `SearchSaveSmartView.vue` 三处 svg 的 `stroke-width="2"` 相对 `PhotosIcon.vue` 默认值 1.6
  (`:185`)的偏离:已加注释,说明沿用 T5 已确立的同款选择。
- `SearchPeoplePopover.vue` 复用 `PersonAvatar` 导致 `alt` 从 Vue2 字面 `alt=""` 变成
  `alt="name"`(`name || ''`,New-UI 的 `PersonOption` 恒有非空姓名):已加注释登记为复用
  公共组件带来的加性可用性改进。

### M9 `PersonOption` 排序契约交接

- `SearchPeoplePopover.vue` 顶部新增注释:Vue2 `realPeopleList`(`:435-447`)以
  `.sort((a,b) => b.c - a.c)` 按人脸计数降序结尾,本组件只透传 `people`、不自己排序。
- `task-14-report.md`「交接下游的事实」新增一条,明确写给 T16。

## 不改码、已抄进报告的 5 处 brief 错误(评审新查实)

1. **brief Step 4 删码清单第 ③ 条本身不可行**——它预设的 `not.toBe` 引用比较断言在 Vue
   响应式 props 下恒真,删掉展开也不会红(评审双向实证)。本任务上一轮已自查出这个问题
   并改成"确认后原地 push 原数组,断言已发出的 payload 不受影响"的可证伪写法——已在
   报告「删码验证清单」③ 处如实记录这段过程,评审判定"是本期最有价值的一条测试质量
   修复",这里不重复贴,仅确认该条记录保留在原位不动。
2. **brief 结构规格第 40 条与 plan 全局约束自相矛盾**——brief 要求名称框绑
   `@keydown.esc.prevent`,plan 又硬约束"Esc 一律 document 级";两条同时照做会让一次
   Esc 触发两次 `emit`。本任务选了 plan 的约束、不重复绑内联 Esc,判定正确。
3. **brief A-2 的行号错 2 行**——内联 style 在 `:101`(不是 `:102`),三元在 `:104`;
   且 brief 让"改 class + token"却没给映射,没预见到 Vue2 那个渐变是浅紫→粉(fix round 2 ·
   N4 修正:此前误写方向反了),不属于 accent 家族(M2 已补登记)。
4. **brief 结构规格 6「照搬 `:798-804`」的范围描述不够精确**——重置三行(`saveName`/
   `saveThresh`/`saveLive`)实际在 `:800-801`,`$nextTick` focus+select 在 `:802-804`。
5. **brief 圈进来的 `photos.scss:2827+` 的 `.save-toast` 不迁移这套自绘 CSS 是对的,
   但"改用真实 store + 通用 `useToast`"这半句当时不成立**——**终审整支复审时发现的错误
   登记,现已改正**:本任务(T14)确实真接了 `store.createSmartView`(D12 的核心要求),
   但成功路径当时只是 `saved.value = true` 翻一个布尔,`useToast` 在本组件里**只接了失败
   路径**(:155-158 的 `toast.show(t('photosAlbumCreateFailed'))`)——Vue2 confirmSave()
   成功后弹的那条 5 秒 `.save-toast`(sparkles + 「"{name}" 已保存为智能视图」+ 跳转链接,
   :283-288)当时**没有被接上任何等价物**,是一个真实的 1:1 功能缺口,不是"用 useToast
   等价替代了"。T9 为这条 toast 专门建的 `photosSearchNameSavedSmartView` /
   `photosSearchOpenSmartViews` 两个 i18n 键因此在全仓零引用了三轮评审——这条错登记
   正是让后续复审误以为"这件事已经做过"的原因。已在 SP7-P7a 终审 fix 波(F1)里补上:
   宿主 `PhotosSearch.vue` 的 `onSaved(id, name)` 现在真调 `toast.show(...)` 走
   `useToast` 的 `{ label, onClick }` 撤销 pill 同款签名,5 秒时长 + 跳转到
   `/photos/smart-views`,详见该 fix 波报告。

## 测试命令与输出原文

```
$ pnpm exec vitest run src/photos/components/__tests__/SearchPeoplePopover.test.ts src/photos/components/__tests__/SearchSaveSmartView.test.ts

 RUN  v4.1.9 /home/nimo/NimoTech/.sp7/NimoOS-New-UI


 Test Files  2 passed (2)
      Tests  53 passed (53)
   Start at  21:15:47
   Duration  1.98s (transform 1.14s, setup 891ms, import 900ms, tests 530ms, environment 1.10s)
```

```
$ pnpm exec vue-tsc --noEmit
(无输出,类型检查通过)
```

```
$ pnpm exec vitest run
...
 Test Files  310 passed (310)
      Tests  3523 passed (3523)
   Start at  21:17:19
   Duration  70.41s (...)
```
(3512 → 3523,净增 11 例:I1 的 7 条 + I2 的 3 条 + M5 的 1 条 = 11,与上一轮 42→53 的增量
一致;M3/M7 是重写既有断言,不改变计数。)

### I1 变异验证输出(`ignoreEl` 判据 + 监听器挂/摘,两组变异)

```
$ pnpm exec vitest run src/photos/components/__tests__/SearchSaveSmartView.test.ts -t "点外部"
（删掉 insideIgnore 判据后）
 FAIL  ... > 传了 ignoreEl 时点 ignoreEl 内部 → 不关(新 prop 的主守卫)
AssertionError: expected [ [ false ] ] to be undefined
 Test Files  1 failed (1)
      Tests  1 failed | 6 passed | 26 skipped (33)
```

```
（fix round 2 复审查实上一版这块贴的不是真实抓取——已重新执行并原样贴出;删掉
document.addEventListener('mousedown', onDocMousedown) 后)
$ pnpm exec vitest run src/photos/components/__tests__/SearchSaveSmartView.test.ts -t "点外部"

     × 点弹层外 → emit update:open(false) 10ms
     × 不传 ignoreEl 时点"本该是触发按钮"的外部节点 → 仍然会关(退化行为,交接段已注明宿主必须传 ignoreEl) 8ms
     × 卸载时清掉 document 监听(mousedown 与 keydown 都摘除) 5ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  ... > 点弹层外 → emit update:open(false)
AssertionError: expected undefined to deeply equal [ [ false ] ]

 FAIL  ... > 不传 ignoreEl 时点"本该是触发按钮"的外部节点 → 仍然会关(退化行为,交接段已注明宿主必须传 ignoreEl)
AssertionError: expected undefined to deeply equal [ [ false ] ]

 FAIL  ... > 卸载时清掉 document 监听(mousedown 与 keydown 都摘除)
AssertionError: expected undefined to be defined

 Test Files  1 failed (1)
      Tests  3 failed | 4 passed | 27 skipped (34)
```

**注意(fix round 2 · 复审指出的报告不实,已按要求重跑贴真实输出)**:上一版这个代码块
把失败列表写成"点弹层外 / **ignoreEl 主守卫** / 卸载清理",但 `ignoreEl 主守卫` 那条
断言的是 `toBeUndefined()`——监听器整个不存在时,外部点击根本不会触发任何 `emit`,这条
断言反而会保持通过,删掉监听器不可能让它变红。重新执行后的真实结果(如上)是「点弹层外」
「不传 ignoreEl 退化路径」「卸载清理」这三条红,`ignoreEl 主守卫`(与「点弹层内部不关」)
仍然绿——**这与复审自己独立复跑得到的结论一致**,变异结论本身没问题,问题只在上一版
报告里那段"输出原文"不是当次真实抓取(像是加 M5 用例前的一次输出被之后手改过标签、
且总数对不上)。

### I2 变异验证输出(节选)

```
（.save-pop-icon 改 32×32/10px 后)
 FAIL  ... > .save-pop-icon 尺寸是 28×28、border-radius:9px(不是 T5 .sv-modal-icon 的 32×32/10px)
AssertionError: expected ... to contain 'width: 28px'
 Tests  1 failed | 25 skipped (26)
```

```
（.save-pop 的 top/width 改掉后）
 FAIL  ... > width: 360px / z-index: 50 / top: calc(100% + 8px) / right: 0
AssertionError: expected ... to contain 'width: 360px'
 Tests  1 failed | 25 skipped (26)
```

```
（primary 按钮 sparkles glyph 改一个字符 7.7→7.9 后）
 FAIL  ... > 两处 sparkles...与一处 x...的 path d 逐字符正确
AssertionError: expected 1 to be 2
 Tests  1 failed | 25 skipped (26)
```

```
（关闭按钮 x 的 glyph 整体改写后）
 FAIL  ... > 两处 sparkles...与一处 x...的 path d 逐字符正确
AssertionError: expected ... to contain 'm6 6 12 12M18 6 6 18'
 Tests  1 failed | 25 skipped (26)
```

### M3 变异验证输出

```
（toLocaleString(localeTag) 改成裸调用后）
 FAIL  ... > 源文本里 toLocaleString(localeTag) 是带标识符实参的调用,不是裸调用
 Tests  1 failed | 18 skipped (19)
```

### M5 变异验证输出

```
（description: props.query.trim() || undefined 改回 props.query 直传后）
 FAIL  ... > query 为空白字符串时 → description 是 undefined,不是空字符串(fix round 1 · M5)
AssertionError:
Number of calls: 1
（实际收到 description: "   "(未 trim、未转 undefined),期望 objectContaining({ description: undefined })）
 Tests  1 failed | 33 skipped (34)
```

### M6 grep 复核(改完后再核一遍,确认旧值零残留)

```
$ grep -n ":437\|:107-109\|:115\b" src/photos/components/SearchPeoplePopover.vue \
    .superpowers/sdd/2026-07-31-vue3-migration-sp7-p7a-smartviews-search/task-14-report.md
(无输出——三处旧值均已替换,零残留)
```

## 自查(通读两个组件全文,注释所述 vs 代码真实行为)

逐条核对本轮改动的 4 处"结论性注释"(M1/M2/M4/M6)与它们描述的代码/Vue2 真值是否一致:
- M1:`.icon-btn` 注释里的 32×32/`--text-2`/`--surface-3`/`--text-1` 已用
  `sed -n '216,223p' photos.scss` 重新核对一遍,数值准确。
- M2:兜底渐变描述对应 Vue2 字面 `#A18CD1,#FBC2EB`(注释里刻意不写字面色值,只用文字
  描述,避免撞 color-guard 的"注释不剥离"规则)——已用
  `grep -n "avatar-fallback" src/styles/theme.css` 确认该 token 在两套主题里都有定义
  (**fix round 2 · N4 复审查实这段自查本身把渐变方向写反了"暖粉→浅粉紫",真实方向是
  浅紫→粉,已在 M2 与组件注释里一并改正**)。
- M4:通读时对这条注释涉及的**全部** Vue2 行号重新 grep 了一遍,**抓到 2 处此前未被
  评审点名的笔误**(见下方「顺带自查抓到的 2 处笔误」),已一并修正,不留到下一轮。
- M6:改完后重新对 `SearchPeoplePopover.vue`/`SearchSaveSmartView.vue`/报告全文再 grep
  一遍本轮涉及的行号,确认无第二处残留(见上方 grep 复核)。

### 顺带自查抓到的 2 处笔误(不在评审的 11 项清单内,通读注释时自己发现,已修正)

1. 名称输入框上方的偏离登记原写"照搬 Vue2 `:793`"(指 `@keydown.esc.prevent=
   "saveOpen = false"` 那一行)——回源实际是 **`:175`**,差了 618 行。

```
$ grep -n "keydown.esc.prevent=\"saveOpen" /home/nimo/NimoTech/NimoOS-UI/src/views/Photos/PhotosSearchView.vue
175:                       @keydown.esc.prevent="saveOpen = false"/>
```

2. I1 头部注释与"Esc 依据"注释都引用过 `_onKey`/`exitSearch` 的挂载位置,原写
   `:826-828`——回源核对该行号落在 `_onDoc` 内部 `openPop`(列表筛选弹层)分支的另一段
   逻辑里,与 Esc 完全无关;真实的 `_onKey` 赋值 + `addEventListener('keydown', ...)` 在
   `:834-835`。顺带把 I1 顶部对 `_onDoc` 整体范围的引用也核实改成 `:819-832`(该函数体
   实际跨度),本弹层相关的判据片段精确到 `:819-823`(与文件内第二处已经写对的 `:820-822`
   基本一致,略微收紧到含开括号的 :819)。

```
$ sed -n '814,836p' /home/nimo/NimoTech/NimoOS-UI/src/views/Photos/PhotosSearchView.vue
  mounted() {
    if (this.$route && this.$route.query.q !== undefined) this.query = this.$route.query.q || ''
    // Populate filter options from real data (people / albums).
    if (!this.$store.state.photos.peopleLoaded) this.$store.dispatch('photos/fetchPeople')
    if (!(this.$store.state.photos.albums || []).length) this.$store.dispatch('photos/fetchAlbums')
    this._onDoc = (e) => {
      if (this.saveOpen) {
        const pop = this.$refs.savePop, btn = this.$refs.saveBtn
        if (pop && !pop.contains(e.target) && btn && !btn.contains(e.target)) this.saveOpen = false
      }
      if (this.openPop) {
        const filterbar = this.$el && this.$el.querySelector('.filterbar')
        if (filterbar && !filterbar.contains(e.target)) {
          this.openPop = null
          this.popSearch = ''
          this.peopleSearch = ''
        }
      }
    }
    document.addEventListener('mousedown', this._onDoc)
    this._onKey = (e) => { if (e.key === 'Escape' && !this.lightboxOpen) this.exitSearch() }
    document.addEventListener('keydown', this._onKey)
  },
```

## Files changed(fix round 1 追加)

- `src/photos/components/SearchSaveSmartView.vue`(改:新增 `ignoreEl` prop + `rootRef` +
  `onDocMousedown` + watch/unmount 挂摘;`description` trim 修正;若干注释修正)
- `src/photos/components/SearchPeoplePopover.vue`(改:仅注释——M2/M6/M9 登记 + 行号修正,
  无行为变化)
- `src/photos/components/__tests__/SearchSaveSmartView.test.ts`(改:新增 11 条用例
  [I1 七条 + I2 三条 + M5 一条],M3/M7 相关断言重写)
- `src/photos/components/__tests__/SearchPeoplePopover.test.ts`(改:M3 断言重写)
- `.superpowers/sdd/.../task-14-report.md`(改:接口签名/交接段更新,行号/计数修正,追加本
  fix round 报告)

## Self-review 发现(fix round 1)

- 通读注释时额外发现 2 处此前未被评审点名的行号笔误(`:793`→`:175`、`:826-828`→
  `:834-835`,详见上方「自查」一节),已在同一轮修正,未留到下一轮。
- 确认新增的 `ignoreEl` prop 没有引入任何颜色/字面量,`color-guard.test.ts` 全量复跑
  确认无新增违规(见全量测试结果,455 例色彩守卫测试included in 3523 总数)。
- 确认 `withDefaults` 写法与本仓既有先例(`PhotosFilterPopover.vue`)一致,`vue-tsc` 无
  新增类型问题。

## Concerns(更新)

无新增阻塞性顾虑。原报告列的两点(`.save-smart` 绿色 token 决策、PersonAvatar 首字母字号
差异)仍然有效,未变。新增一点供 T16 参考:`ignoreEl` 是可选 prop,若 T16 疏漏不传,组件
仍可工作但会有"点触发按钮误关刚打开的弹层"这个退化行为——已有专门测试钉住这条退化路径
本身的确定性(不是未定义行为),T16 接入时建议直接传,不依赖退化路径。

---

# Fix Round 2(scoped 复审:I1/I2/M1-M9 十一项全部 ADDRESSED,零新破坏;本轮只处理复审
新记的 4 处注释级问题 N1-N4 + 1 条报告输出不实)

## 处理清单

### N1(最要紧)`SearchSaveSmartView.vue` 内自相矛盾——同文件两处对同一 Vue2 判据的标签不一致

文件头(:15-16)正确说这是"本弹层对应的判据",而 `onDocMousedown` 函数上方(原 :71)误写
成"people 判据"——`:820-822` 这个行号本身没错(就是 savePop/saveBtn 的 contains 检查),
错的是给它贴的标签(它明明是"保存弹层"判据,不是"人物/filterbar"判据)。

**改动**:把函数上方注释的"people 判据"改成"保存弹层那半判据——savePop/saveBtn 的
contains 检查",并顺带写明 people/filterbar 那半判据在 `:824-830`(不归本组件管),两处
标签现在一致。同时把文件头(:16)的行号从 `:819-823` 收紧到 `:820-822`,与函数注释统一
用同一个精确值(此前两处虽不算互相矛盾,但用了两个不同粒度的行号,容易让下一个读者以为
是两回事)。

### N2 `SearchSaveSmartView.test.ts:251` + `task-14-report.md` 两处引用错误行号
`:818-825`

`:818` 是 Vue2 `fetchAlbums` 那行,`:825` 是 `openPop` 分支内的 `const filterbar` 声明,
两端都与 mousedown 判据无关。已统一改成"整体 :819-832,保存弹层那半判据在 :820-822"
(与组件文件里已经写对的引用值保持一致),三处(测试文件 1 处 + 报告 2 处)全部改完。

### N3 `SearchPeoplePopover.vue` 里 T12/T13 与行号 `:84`/`:142` 的对应关系写反了

真实对应:T12(`PhotosFilterPopover.vue`,列表型)对应 Vue2 列表弹层 `:142`;T13
(`SearchDatePopover.vue`,日期)对应 Vue2 日期弹层 `:84`。原注释写"T12/T13(:84/:142)"
把两者配反了(虽然两个值都是 12px,数值结论不受影响,但溯源指向错了组件)。已改成显式
点名两个文件各自对应哪个行号,不再用容易读反的简写顺序。报告里同一处描述("列表/日期
弹层的 :84/:142")与 M6 历史记录里的同款描述也一并改正,并在 M6 那条历史记录旁加注说明
"这一步本身在 fix round 1 里就配反了,fix round 2 才发现"。

### N4 `SearchPeoplePopover.vue:28-29` 渐变方向描述反了

Vue2 `:101-102` 的兜底渐变是 `135deg` 角、从浅紫色调过渡到粉色调(字面 `#A18CD1` →
`#FBC2EB`,注释里仍然只用文字描述、不写字面色值)。原注释写成"暖粉到浅粉紫"——方向
反了、且"暖粉"这个形容也不准确。已改成"起点是浅紫色调、终点是粉色调"。报告里三处
同款描述(M2 小节、brief 回源核对表、自查小节)一并改正。

## 报告输出不实的修正(复审记的额外一条)

上一轮"I1 变异验证输出"里"删掉 mousedown 监听后"那个代码块把失败列表写成
"点弹层外 / **ignoreEl 主守卫** / 卸载清理"——`ignoreEl 主守卫`断言的是
`toBeUndefined()`,监听器整个被删掉时外部点击根本不会触发任何 `emit`,这条断言反而
会继续通过,不可能被这个变异搞红。且原块的 `(33)` 总数与后续加了 M5 用例之后的真实状态
`(34)` 对不上,像是拼凑/手改过的摘要,不是当次真实抓取。

**已重新执行这个变异**(改动:临时删掉 `document.addEventListener('mousedown',
onDocMousedown)` 那一行 → 跑 `-t "点外部"` → 原样贴输出 → 用 Edit 手工还原),报告里
已换成这次真实抓取的输出(见下方「测试命令与输出原文」)。真实结果是"点弹层外 / 不传
ignoreEl 退化路径 / 卸载清理"三条红,`ignoreEl 主守卫`与"点弹层内部不关"两条仍然绿——
与复审自己独立复跑的结论一致,变异结论本身没问题,只是上一版报告贴的"输出原文"不可信。

## 测试命令与输出原文

```
$ pnpm exec vitest run src/photos/components/__tests__/SearchPeoplePopover.test.ts src/photos/components/__tests__/SearchSaveSmartView.test.ts

 RUN  v4.1.9 /home/nimo/NimoTech/.sp7/NimoOS-New-UI


 Test Files  2 passed (2)
      Tests  53 passed (53)
   Start at  22:04:30
   Duration  865ms (transform 414ms, setup 356ms, import 315ms, tests 288ms, environment 449ms)
```

```
$ pnpm exec vue-tsc --noEmit
EXIT:0
```

### 报告不实修正的重新抓取(见上方"报告输出不实的修正"一节)

```
$ pnpm exec vitest run src/photos/components/__tests__/SearchSaveSmartView.test.ts -t "点外部"
（临时删掉 document.addEventListener('mousedown', onDocMousedown) 后)

     × 点弹层外 → emit update:open(false) 10ms
     × 不传 ignoreEl 时点"本该是触发按钮"的外部节点 → 仍然会关(退化行为,交接段已注明宿主必须传 ignoreEl) 8ms
     × 卸载时清掉 document 监听(mousedown 与 keydown 都摘除) 5ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  ... > 点弹层外 → emit update:open(false)
AssertionError: expected undefined to deeply equal [ [ false ] ]

 FAIL  ... > 不传 ignoreEl 时点"本该是触发按钮"的外部节点 → 仍然会关(退化行为,交接段已注明宿主必须传 ignoreEl)
AssertionError: expected undefined to deeply equal [ [ false ] ]

 FAIL  ... > 卸载时清掉 document 监听(mousedown 与 keydown 都摘除)
AssertionError: expected undefined to be defined

 Test Files  1 failed (1)
      Tests  3 failed | 4 passed | 27 skipped (34)
```
（已用 Edit 手工还原 `document.addEventListener('mousedown', onDocMousedown)` 这一行,
`git diff` 复核与还原前一致,上方「测试命令与输出原文」的全绿结果就是还原后重跑的。）

## 通读自查(本轮要求:重新核一遍所有 Vue2 行号引用 + 本文件自引用行号)

逐条把 `SearchPeoplePopover.vue`/`SearchSaveSmartView.vue` 里**每一个**指向
`PhotosSearchView.vue:`/`photos.scss:`/`photos-smartview.scss:` 的行号引用重新 grep 出来
并回源核对(命令与结论如下),确认本轮改动的 4 处之外没有第二处同类错误:

```
$ grep -noE "PhotosSearchView\.vue:[0-9]+(-[0-9]+)?|photos\.scss:[0-9]+(-[0-9]+)?|photos-smartview\.scss:[0-9]+(-[0-9]+)?" \
    src/photos/components/SearchPeoplePopover.vue src/photos/components/SearchSaveSmartView.vue
```
逐条核对结果(12 处引用,全部回源确认准确):
- `PhotosSearchView.vue:93-122`(people 弹层模板)✓
- `photos.scss:2689-2694`(`.face-*` 6 条,两处引用)✓
- `PhotosSearchView.vue:101-102`(face-avatar 渐变底,两处引用)✓
- `photos.scss:2691` / `:2691-2692`(选中环)✓
- `PhotosSearchView.vue:159-210`(保存弹层模板)✓
- `photos.scss:2795-2815`(`.save-pop*` 16 条)✓
- `photos.scss:2817-2825`(被压制的 `.sv-*` 低优先级块,两处引用,已用
  `sed -n '2817,2825p' photos.scss` 逐条核对确实是 `.sv-slider` 到
  `.sv-btn-primary:disabled` 共 9 条声明,起止行号准确)✓
- `photos.scss:216-223`(`.icon-btn` 全局规则)✓
- `photos.scss:2819-2820`(`.sv-switch`/`.sv-switch::after` 这两条"漏过级联"的具体声明)✓

再核对本文件对其他既有源文件的自引用(非 Vue2):
- `searchUnderstood.ts:11-16`(`PersonOption` 接口定义)✓
- `PhotosSearchView.vue:435-447`(`realPeopleList`)/`:438`(其中的 `.filter` 行)/
  `:545-549`(`filteredPeopleList`)✓
- `SmartViewCard.vue:38`(BCP-47 转换既有先例)✓
- `PersonAvatar.vue:103`(`:alt="name || ''"`)✓
- `PhotosSmartViewsView.vue:426`(description 语义兜底注释)✓
- `PhotosSearchView.vue:153-158`(`.save-smart` 按钮范围,C6 交接引用)✓
- `PhotosSearchView.vue:798-804`(`openSave`)/`:801`(阈值默认 75 那一行)✓
- `PhotosSearchView.vue:198-199`(`.sv-switch` 的 `@click.prevent`)✓
- `PhotosSearchView.vue:806-812`(`confirmSave`)✓
- `PhotosSearchView.vue:175`(名称输入框的 `@keydown.esc.prevent`,fix round 1 已修正)✓
- `PhotosSearchView.vue:819-832`(`_onDoc` 整体)/`:820-822`(保存弹层判据)/`:824-830`
  (people/filterbar 判据,本轮 N1 新增的引用)✓

全部准确,未发现本轮 4 处之外的第 5 处行号/标签/方向错误。

## 注释三禁复查(尤其 N4)

- N4 改动后再次确认:渐变描述只用"浅紫色调"/"粉色调"这类文字,没有出现字面 `#hex`。
- 顺带确认本轮新写的所有注释均未出现字面 `rgba(`/`#`/裸 `color-scheme` 单值,`grep -c
  "rgba(\|#[0-9a-fA-F]\{3,6\}"` 对本轮 diff 涉及的两个组件文件均返回 0(排除代码里本来就
  合法使用 token 的行)。

```
$ git diff src/photos/components/SearchPeoplePopover.vue src/photos/components/SearchSaveSmartView.vue | grep -E '^\+' | grep -E '#[0-9a-fA-F]{3,6}|rgba\('
(无输出——本轮新增的 diff 行里没有任何字面颜色)
```

## Files changed(fix round 2)

- `src/photos/components/SearchSaveSmartView.vue`(改:2 处注释——N1 标签修正 + 行号
  收紧一致)
- `src/photos/components/SearchPeoplePopover.vue`(改:2 处注释——N3 配对顺序 + N4 渐变
  方向)
- `src/photos/components/__tests__/SearchSaveSmartView.test.ts`(改:1 处注释——N2 行号)
- `.superpowers/sdd/.../task-14-report.md`(改:N1-N4 对应的历史记录行 + 报告输出不实
  那段重新抓取并替换,追加本 fix round 2 报告)
- **零测试断言改动,零生产逻辑改动**(本轮全部是注释/文档文本,git diff 已核实)

## Self-review

- 通读两个组件全文,把每一个 Vue2/兄弟组件行号引用重新 grep + 回源核对一遍(见上方
  「通读自查」),本轮改动的 4 处之外没有发现第 5 处同类问题。
- 确认 N1 修正后,文件头(:15-16)与函数上方(原 :71,现同一位置)两处对同一 Vue2 判据的
  标签、行号完全一致,不再存在"标签不一致"的自相矛盾。
- 确认"报告输出不实"那段修正后,代码块里的命令、失败/通过用例名、总数与本次真实执行
  的输出逐字一致(已贴执行时间戳与总数 `27 skipped (34)`)。

## Concerns

无新增顾虑。本轮是纯注释/文档修正,行为契约与接口签名均未变化,T16 消费方无需重新
适配。评审挂账给终审的两条(`.icon-btn` 的 `border-radius: var(--r-sm)` 未登记、
`persist.test.ts` 既有 flaky)按其要求不在本轮处理。
