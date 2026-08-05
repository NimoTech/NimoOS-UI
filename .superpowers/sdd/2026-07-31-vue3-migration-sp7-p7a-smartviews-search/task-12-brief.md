### Task 12: `PhotosFilterChip.vue` + `PhotosFilterPopover.vue`(D14 基元,P7b 复用)

**Files:**
- Create: `src/photos/components/PhotosFilterChip.vue` + `__tests__/PhotosFilterChip.test.ts`
- Create: `src/photos/components/PhotosFilterPopover.vue` + `__tests__/PhotosFilterPopover.test.ts`
- Read-only 参考: `PhotosSearchView.vue:51-59`(chip)、`:124-147`(list 弹层)、`PhotosFilterBar.vue:16-24`+`:25-63`(**逐字比对确认两边相同**)、`photos.scss:2610-2701`

**Interfaces:**
- Produces:
  ```ts
  // PhotosFilterChip.vue
  // props
  { label: string; icon: string; active: boolean; open?: boolean }
  // emits
  (e: 'toggle'): void        // 点 chip 主体
  (e: 'clear'): void         // 点清除叉(已 @click.stop)
  // slots: 默认插槽用于挂弹层(chip 与弹层同处一个 .fchip-wrap 定位上下文)

  // PhotosFilterPopover.vue
  // props
  {
    title: string
    items: string[]
    selected: string[]           // draft 值,由宿主持有
    searchPlaceholder: string
    emptyHint: string
    width?: number               // 默认 260(搜索用),FilterBar 用 240
    multiple?: boolean           // 默认 true;false = 单选(File type / Albums)
    labelFor?: (item: string) => string   // 可选:显示名转换(File type 要 t(item))
  }
  // emits
  (e: 'update:selected', v: string[]): void   // 弹层内勾选即时更新 draft
  (e: 'apply'): void
  (e: 'cancel'): void
  ```
  **两个基元都不碰 store、不碰 i18n 的业务键**(文案全从 props 进来)⇒ P7b 复用时零改动。**只有 `photosCancel` / 「应用」两个通用键在组件内直接 `t()`**(它们跨消费方一致)。

**结构规格:**

1. **先做一次逐字比对**(动手前必做,写进任务报告):`PhotosSearchView.vue:51-59` 与 `PhotosFilterBar.vue:16-24` 的 chip 标记、以及 `:124-147` 与 `:25-63` 的 list 弹层标记。**若发现任何不一致(class 名、图标尺寸、`stroke-width`、结构层级),以搜索侧为准并在报告里列出差异**,P7b 届时按差异决定是给 prop 还是照搬。
2. **`PhotosFilterChip.vue`**:根 `.fchip-wrap`(`position: relative`)→ `.fchip`(`:data-on="active"`,`@click` → `emit('toggle')`)含:`.fchip-icon`(13px 图标)+ `<span>{{ label }}</span>` + chevD 图标(11px,色 `--fg-subtle`)+ `v-if="active"` 的 `.fchip-x` 按钮(x 图标 10px、`stroke-width` **2.4**,`@click.stop` → `emit('clear')`)→ 之后是默认插槽(弹层挂点)。
   - **图标**:本仓的图标组件是 `PhotosIcon.vue`?**先 grep** —— P6b 提到过 `PhotosIcon.vue` 的 glyph 比对,确认本仓有这个组件及其 `name` 支持的 glyph 列表(`clock` / `person` / `map` / `album` / `video` / `filter` / `settings` / `check` / `x` / `chevD` / `chevL` / `chevR` / `search` / `sparkles` / `plus` / `trash` / `edit` / `copy` / `more` / `download` / `play` / `pause` / `star` / `info` 本期都要用)。**缺哪个 glyph 就照 Vue2 `PhotosIcon.vue` 逐字符补**(P6b 终审抓过 4 处 glyph 漏抄,三道门全测不出 ⇒ **补 glyph 必须配 `?raw` 正则断言:先锚定该 name 的渲染块,再 `toContain` 具体 path,并 `not.toContain` 旧 glyph**)。
   - **hover 硬约束**:`.fchip` 基类有 hover、`.fchip[data-on="true"]` 是变体(**属性选择器优先级 0,2,0 与 `.fchip:hover` 相等 ⇒ 靠源码顺序苟活的第二种形态**)⇒ 变体自带 `:hover`,cssCascade 断言胜出选择器含 `:hover` 且含 `data-on`。
3. **`PhotosFilterPopover.vue`**:根 `<div @click.stop>` → `.fpop`(`:style="{ width: width + 'px' }"`)含:
   - `.fpop-title`(`{{ title }}`)
   - `<input class="fpop-search">`(`v-model="search"`,`:placeholder="searchPlaceholder"`)
   - 滚动列表(`max-height: 280px; overflow-y: auto`)→ `v-for` 出 `.nav-item`(`:data-active="isSel(it) ? 'true' : 'false'"`,`@click="toggle(it)"`)含 `.nav-icon`(16px 宽,选中时渲染 check 图标 12px、色 `--accent-text`、`stroke-width` 2.5)+ `<span>{{ labelFor ? labelFor(it) : it }}</span>`
   - `v-if="filtered.length === 0"` → 空态一行(`{{ emptyHint }}`)
   - 脚:`.fpop-quick`(`photosCancel`,`@click` → `emit('cancel')`)+ `.btn.btn-primary`(「应用」,`@click` → `emit('apply')`)。**「应用」需要一个键**:上表里搜索侧有 `Apply` → 用生成的那个键名(**回表核对**)。
   - **`filtered`**:`search` 空 → `items`;否则 `items.filter(i => i.toLowerCase().includes(search.toLowerCase()))`(照搬 `:778-782`)。
   - **`toggle(it)`**:`multiple` → 在 `selected` 里则移除、否则追加(**返回新数组,不原地改 prop**);`!multiple` → 已选则置 `[]`、否则置 `[it]`(照搬 Vue2 `toggleDraftItem` 的单值分支语义 `v === it ? null : it`)。
   - **`.nav-item` 在本仓不存在**(Vue2 全局类)⇒ 自己写。
   - **`.btn` / `.btn-primary` 同样不存在** ⇒ 自己写,且 primary 自带 `:hover`(硬约束)。
   - **`.fpop-quick` 基类与 `[data-on]` 变体**:本组件的 Cancel 按钮不带 `data-on`(那是 date 弹层的快捷区间用的),但**样式类共用** ⇒ 变体的 hover 处理留给 T13,本任务只保证基类 hover 存在且 cssCascade 断言基类自身。
   - **`search` 在弹层每次打开时要清空** ⇒ 由**宿主**通过 `v-if` 重新挂载来实现(Vue2 `togglePop` 里显式清 `popSearch`;New-UI 弹层是 `v-if` 挂载的 ⇒ 天然清空。**注释登记这个等价性**)。
4. **不做 portal / Teleport**(P6a 明确裁定:会破坏「点外部关闭」的容器 ref 判定)。**点外部关闭与 Esc 由宿主统一处理**(T16),基元只发 `cancel`。

- [ ] **Step 1: 写失败测试**

`PhotosFilterChip.test.ts`:
- 结构:`.fchip-wrap` / `.fchip` / `.fchip-icon` / chevD 各一;`active: false` → **无** `.fchip-x`;`true` → 有。
- `data-on` 随 `active`;`label` 渲染。
- 点 `.fchip` → `toggle`;点 `.fchip-x` → `clear` 且 **`toggle` 未被触发**(`@click.stop` 守卫,**事件要 `bubbles: true`**)。
- 默认插槽内容被渲染在 `.fchip-wrap` 内。
- cssCascade:`.fchip[data-on="true"]` 的 hover 胜出规则含 `:hover` 且含 `data-on`。
- x 图标的 `stroke-width` 是 `2.4`、check 无关(读渲染的 prop 或源文本)。

`PhotosFilterPopover.test.ts`:
- 结构:`.fpop` / `.fpop-title` / `.fpop-search` / 列表 / 两个脚按钮。
- `width` 默认 260;传 240 → 行内 style 是 `240px`。
- `items` 5 条 → 5 个 `.nav-item`;`selected` 含第 2 条 → 它 `data-active="true"` 且内部有 check 图标,其余 `"false"` 且无 check。
- 搜索过滤:输入过滤词 → 列表变短;大小写不敏感;过滤到 0 条 → 空态文案出现且列表 0 条。
- `multiple: true`:点未选项 → `update:selected` 带 `[...原, it]`;点已选项 → 带移除后的数组;**断言 prop 数组未被原地改**(传入的引用内容不变)。
- `multiple: false`:点未选项 → `[it]`;点已选项 → `[]`。
- `labelFor` 生效:传 `it => 'X' + it` → 渲染文本含 `X`。
- 点 Cancel → `cancel`;点 Apply → `apply`;**点弹层内部空白不冒泡到宿主**(根 `@click.stop`:派发一个 `click` 到 `.fpop` 并断言宿主监听未收到 —— 用父级包裹组件测)。
- cssCascade:`.btn.btn-primary` 的 hover 胜出规则含 `:hover` 且含 `-primary`。
- 滚动容器有 `max-height` 与 `overflow-y: auto`(先锚定规则体)。

- [ ] **Step 2: 跑测试确认失败**

- [ ] **Step 3: 实现两个基元(含按需补 `PhotosIcon` glyph + `?raw` 断言)**

- [ ] **Step 4: 跑全量 + tsc + color-guard,逐个删码验证**

删码清单:①`.fchip-x` 的 `@click.stop` → 「toggle 未触发」用例红;②`active` 的 `v-if` → 无叉用例红;③`toggle` 里的新数组(改成 `push`)→ 「prop 未被原地改」用例红;④`multiple: false` 的单值分支 → 单选用例红;⑤`filtered` 的 `toLowerCase` → 大小写用例红;⑥`.fchip[data-on="true"]:hover` → cssCascade 用例红;⑦根节点的 `@click.stop` → 冒泡用例红。

- [ ] **Step 5: Commit**

```bash
git add src/photos/components/PhotosFilterChip.vue src/photos/components/PhotosFilterPopover.vue src/photos/components/__tests__/PhotosFilterChip.test.ts src/photos/components/__tests__/PhotosFilterPopover.test.ts src/photos/components/PhotosIcon.vue
git commit -m "feat(photos): P7a-T12 chip 与 list 弹层两个基元(D14,P7b 复用)"
```

---

