# SP7-P6a 真机验收轮 1 —— 修复报告

工作分支:`sp7-photos`,工作区 `/home/nimo/NimoTech/.sp7/NimoOS-New-UI`。
起点 HEAD:`6f4ba61`(P6a 编码完成、终审通过,四道门全绿)。
本轮改动 4 个文件,未触碰任何 rebase 冲突文件。

两条反馈均为**真机验收轮发现的 Vue2 缺陷**(不是本期 P6a 引入的回归)——Vue2 源码逐条回源核对见下,两处行为在 Vue2 里就存在,New-UI 此前是"移植保真"照搬过来的。

---

## 反馈 1:时间范围结束日期必须 ≥ 起始日期

### 回源核对(Vue2 确实无约束)

`NimoOS-UI/src/views/Photos/PhotosPlacesView.vue:844-853`:

```html
<input v-model="customStart" type="date" @input="timeFilter = (customStart && customEnd) ? 'custom' : 'all'">
<input v-model="customEnd" type="date" @input="timeFilter = (customStart && customEnd) ? 'custom' : 'all'">
```

两个 `<input type="date">` 没有 `min`/`max`,判据只看"两头是否都非空",完全不比较先后。确认 Vue2 缺陷成立。

### 改动位置

`src/photos/components/PlacesFilterMenu.vue`:

1. 模板(起始 input `:148` 起、结束 input 紧随其后)新增:
   - 起始 input:`:max="filter.customEnd || undefined"`
   - 结束 input:`:min="filter.customStart || undefined"`
   - 用 `|| undefined` 而不是空串,避免 `min=""`/`max=""` 在部分内核下的不确定行为。
2. `setStart`/`setEnd`(script 部分)判据从「两头都填」收紧为「两头都填且 `customEnd >= customStart`」,非法区间归到既有的 `timeFilter = 'all'` 分支。

### 注释登记原文(落在 `setStart` 上方)

```
// 偏离登记(真机验收反馈,Vue2 缺陷,按铁律改正确 + 登记,不照抄):Vue2 这两个
// `<input type="date">` 互不约束,用户可以选出"结束早于起始"的倒置区间——filterPlaces
// 对倒置区间会筛出零结果,用户看到空地图却不知道为什么(两个输入看起来都填好了)。本仓
// 一是给模板里的两个 input 加原生 `:max`/`:min` 相互约束(原生日期选择器直接不让选到
// 非法值,用户实际就是用选择器点的);二是这里把 `timeFilter` 的判据从"两头都填"收紧为
// "两头都填且 customEnd >= customStart"(用户仍可能手打出非法值,原生约束防不住键盘
// 输入)——非法区间按"区间还没填好"处理,归到既有的 `timeFilter = 'all'` 分支,不新增
// 第三种语义。日期串是定长 'YYYY-MM-DD' 格式,字符串字典序比较即等价于日期先后比较,
// 不需要 `new Date()` 解析。「>=」不是「>」——两端同一天是合法的单日区间。
```

`setEnd` 上方加了一行指回上述登记("同上 setStart 的登记,逻辑对调 customStart/customEnd")。

### 新增测试(`src/photos/components/__tests__/PlacesFilterMenu.test.ts`)

- `describe('日期原生 min/max 相互约束(真机验收反馈 1)')`:
  - 起始输入 `max` 等于 `filter.customEnd`
  - 结束输入 `min` 等于 `filter.customStart`
  - 两端为空串时,对应 `max`/`min` 属性均为 `undefined`(不是空串)
- `describe('倒置区间视为未填好(真机验收反馈 1,逻辑兜底)')`:
  - 先填 end 再填更晚的 start(倒置)→ `timeFilter` 为 `'all'`
  - 先填 start 再填更早的 end(倒置)→ `timeFilter` 为 `'all'`
  - 合法区间(end > start)→ `'custom'`
  - 两端同一天(相等)→ 也是 `'custom'`(钉住「>=」不是「>」)
- 既有的「只填一头 → `'all'`」两条用例未改动,仍绿。

### 删码验证

| # | 操作 | 结果 |
|---|---|---|
| ① | 把 `setStart`/`setEnd` 里 `end >= value` / `value >= start` 两个不等式条件删掉(退回纯"两头都填") | 倒置区间的两条新测试红:`expected 'custom' to be 'all'`(先填 end 再填更晚 start、先填 start 再填更早 end 各一条) |
| ② | 把起始 input 的 `:max` 绑定删掉 | `起始输入的 max 等于 filter.customEnd` 红:`expected undefined to be '2026-02-15'` |
| ② | 把结束 input 的 `:min` 绑定删掉(①②分别单独验证,验完各自手工 Edit 复原,未用 `git checkout --`) | `结束输入的 min 等于 filter.customStart` 红:`expected undefined to be '2026-02-01'` |

三处均单独删、单独验、单独用 `Edit` 手工复原,复原后重跑确认全绿。

---

## 反馈 2:两个弹层要盖过缩放条

### 回源核对(z-index 确实都是 4,DOM 顺序确实是 toolbar 先于 zoombar)

- `NimoOS-UI/src/views/Photos/photos-places.scss:199-207`(`.map-toolbar`)与 `:234-238`(`.map-zoombar`,注释所在行区间 `:234-284`)—— 两条规则各自都是 `z-index: 4`,逐字确认。
- `NimoOS-UI/src/views/Photos/PhotosPlacesView.vue`:`grep` 定位 `.map-toolbar` 在 `:828`、`.map-zoombar` 在 `:952`,同一个 `.map-canvas-wrap` 容器内,toolbar 先声明、zoombar 后声明,DOM 顺序确认。

结论:Vue2 里 `.map-toolbar` 因 `position:absolute` + 非 `auto` 的 `z-index` 自成层叠上下文,工具栏内部的 Filters/主题弹层(`z-index:30`)只在 toolbar 内部竞争,跨不过同级的 `.map-zoombar`;同 z-index 时按 DOM 顺序决胜,`.map-zoombar` 排在后 → 缩放条画在弹层上面。**这是 Vue2 的既有缺陷**,New-UI 之前逐字复刻了这两个 z-index 值,所以照样穿透。

### 改动位置

`src/views/PhotosPlaces.vue`:`.map-toolbar` 规则(`:371` 起)的 `z-index` 从 `4` 改为 `7`。未改 `.map-toolbar > *` 的 `pointer-events` 规则、未改弹层自身的 `z-index: 30`、未做 portal。

### 注释登记原文(落在 `.map-toolbar` 规则内)

```
/* 偏离登记(真机验收反馈,Vue2 缺陷,按铁律改正确 + 登记,不照抄):Vue2
   photos-places.scss:199-207(.map-toolbar)与 :234-245(.map-zoombar)把两者都设成
   z-index:4——.map-toolbar 因 position:absolute 且 z-index 非 auto 自成层叠上下文,
   它内部弹层(PlacesFilterMenu.vue/PlacesThemeMenu.vue 的 z-index:30)只在 toolbar
   内部竞争,跨不过同级的 .map-zoombar;同 z-index 时由 DOM 顺序决胜,模板里
   .map-zoombar(PlacesZoomBar.vue)排在 .map-toolbar 之后,于是缩放条画在
   Filters/主题弹层上面——Vue2 里点开任一弹层,缩放条会从中间穿透过来。本仓把
   toolbar 从 4 提到 7:本区既有的层级梯度是 4(地图家具——zoombar/legend/stats)
   < 5(.map-tip)< 6(留给 P6b 详情面板)< 7(此处),7 让工具栏及其内部弹层稳定
   盖住地图区一切浮层,同时不占用给 P6b 预留的 6。 */
```

### 新增测试(`src/views/__tests__/PhotosPlaces.test.ts`)

`describe('.map-toolbar 层叠顺序守卫(真机验收反馈 2:弹层不应被缩放条穿透)')`:
- 程序化读 `PhotosPlaces.vue?raw` 与 `PlacesZoomBar.vue?raw` 两个源文件的样式块,用既有的 `parseCssRules`/`extractStyleBlock`(`cssCascade.ts`)解析出 `.map-toolbar`/`.map-legend`/`.map-stats`/`.map-tip`(容器内)与 `.map-zoombar`(另一文件)各自的 `z-index` 数值。
- 断言 `.map-toolbar` 的 z-index **严格大于**上述四者的最大值 —— 钉的是"工具栏在这些浮层之上"这条不变量,不是写死数值 7,任何等效的层级调整都放行。

### 删码验证

把 `.map-toolbar` 的 `z-index` 从 `7` 改回 `4` → 新测试红:`AssertionError: expected 4 to be greater than 5`(`.map-tip` 的 5 此时是四者最大值)。验完手工 `Edit` 复原为 `7`,重跑确认全绿。

---

## 四道门(本轮修复后,复原所有删码探针之后跑的最终结果)

```
$ pnpm test
 Test Files  280 passed (280)
      Tests  2675 passed (2675)
```
(基线 2667 + 本轮新增 8:PlacesFilterMenu 7 条 + PhotosPlaces 1 条。测试输出里出现的
`Error: Not implemented: navigation (except hash changes)` 是 favorites.test.ts 里
jsdom 对 `location.href =` 赋值的既有已知噪音,非本轮改动引入,不影响该测试文件本身
通过。)

```
$ pnpm exec vue-tsc --noEmit
(无输出,exit 0)
```

```
$ pnpm test -- src/styles/color-guard.test.ts src/i18n/parity.test.ts
 Test Files  2 passed (2)
      Tests  396 passed (396)
```
(color-guard 与 i18n parity 本身就是 vitest 用例,包含在上面 `pnpm test` 的 280 文件 /
2675 用例全量里;这里单独复跑一次确认这两道门本身没有被本轮改动碰坏。)

四道门:全量测试 √ / `vue-tsc --noEmit` exit 0 √ / color-guard √ / i18n parity √。

---

## `git diff --numstat 6b700c7..HEAD` 对 5 个 rebase 冲突文件

```
62   0   src/i18n/en_us.ts
65   0   src/i18n/zh_cn.ts
2    0   src/router/index.ts
364  0   src/photos/stores/places.ts
358  0   src/photos/util/placesMap.ts
```

删除列全为 0(HEAD 即 `6f4ba61`,本轮尚未提交,`git status --short` 只显示以下 4 个文件被
修改,均不在这 5 个 rebase 冲突文件之列——本轮完全没有碰它们,数值与验收开始前一致):

```
 M src/photos/components/PlacesFilterMenu.vue
 M src/photos/components/__tests__/PlacesFilterMenu.test.ts
 M src/views/PhotosPlaces.vue
 M src/views/__tests__/PhotosPlaces.test.ts
```

---

## 改动的文件清单

- `src/photos/components/PlacesFilterMenu.vue` —— 模板 `:max`/`:min` 绑定 + `setStart`/`setEnd` 逻辑收紧 + 登记注释。
- `src/photos/components/__tests__/PlacesFilterMenu.test.ts` —— 新增两个 describe 块(7 条测试)。
- `src/views/PhotosPlaces.vue` —— `.map-toolbar` z-index 4→7 + 登记注释。
- `src/views/__tests__/PhotosPlaces.test.ts` —— 新增 1 个 describe 块(1 条测试)+ 新增 `placesZoomBarRaw` import。

## 顾虑

- z-index 7 这个具体取值是我按 brief 给的梯度(4/5/6 已有,7 待落)选的,brief 明确要求测试不钉死这个数字、只钉"toolbar 高于其余浮层"这条不变量,已按此实现——若后续 P6b 详情面板真的用到 6,与本次的 7 不冲突。
- 两条修复都只动了判定逻辑/样式数值 + 补测试,没有牵动 store、路由、其它组件,风险面很小。
