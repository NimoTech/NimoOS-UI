### Task 7: `PlaceCoverPicker.vue` —— 封面选择器全屏弹层

**Files:**
- Create: `src/photos/components/PlaceCoverPicker.vue`
- Create: `src/photos/components/__tests__/PlaceCoverPicker.test.ts`
- Modify(按需): `src/styles/theme.css` + `docs/THEMING.md`
- Read-only 参考: `PhotosPlacesView.vue:1253-1335`、`photos-places.scss:1026-1184`、`:296-312`(watch)、`:374-377`(coverTabLabel)、`:517-560`;本仓弹层先例 `PhotosPersonDetail.vue:880-915`(模板)与 `:1091-1113`(`.pd-scrim`/`.pd-panel` 样式)

**Interfaces:**
- Consumes: `type CoverCandidates`(stores/places.ts)、T1 的 cover 键、`service.photos.thumbnailUrl`
- Produces:
  ```ts
  // props
  {
    open: boolean
    city: string
    totalCount: number            // activePlace.count —— 副标题里的「从 N 张照片里选」
    currentAssetId: string        // 当前封面(打勾用),String 归一后传入
    candidates: CoverCandidates
    tab: string
    search: string
    page: number
    busy: boolean                 // store.coverBusy
  }
  // emits
  (e: 'close'): void
  (e: 'update:tab', tab: string): void
  (e: 'update:search', q: string): void
  (e: 'update:page', page: number): void
  (e: 'pick', assetId: string): void
  (e: 'reset'): void
  ```
  **状态与请求都在容器**(照 P6a T9/T10 两个弹层的既定分工:组件只 emit,容器决定落到哪个 action)。

**结构规格(逐段照 Vue2 `:1253-1335`):**

1. 根 `.cp-scrim`(`v-if="open"`,`position:fixed; inset:0; z-index:220`,底 `--overlay-bg` + `backdrop-filter: var(--overlay-blur)`,`@click.self` → `close`)。**z-index 与 `.pd-scrim`(`PhotosPersonDetail.vue:1092`)同档 220**,不用 Vue2 的 1200(那是 Vue2 自己的层级体系)。
2. `.cp-shell`:`width:900px; max-width:95vw; height:80vh`,`--popup-bg` 底(**不是 `--card-bg`** —— P2 血泪:深色近透明会看穿)、`--card-border` 边、`border-radius:16px`、`var(--card-shadow-hi)`、`overflow:hidden`、纵向 flex。
3. `.cp-head`:`.cp-head-thumb`(56×42,2px accent 边框,内 `<img>` 当前封面,`currentAssetId` 空则不渲染 img)+ `.cp-head-info`(`.cp-head-title` = `photosPlacesCoverTitle`({city})、`.cp-head-sub` = `photosPlacesCoverSubtitle`({count: 千分位化的 totalCount}))+ `.cp-close-btn`(28px,15px ×,`aria-label` 复用 `photosClose`)。
4. `.cp-tabs`:`.cp-tabs-group` 内 `v-for` 后端 `candidates.tabs`,每个 `.cp-tab`(`tab === t.id` 时 `.is-active`)= 11px 图标 + 标签 + `.cp-tab-count`;右侧 `.cp-search`(12px 放大镜 + `<input>`,`placeholder` = `photosPlacesCoverSearchPlaceholder`,`@input` → `update:search`)。
   - **标签文案 `coverTabLabel(t)`(照搬 Vue2 `:374-377` 的回落链)**:先查 `photosPlacesCoverTab{Recent|Top|Fav|All}`(按 `t.id` 映射),没有则回落 `t.label`,再没有回落 `t.id`。**映射表写在组件内**(只此一处消费,不进 util)。
   - **`.cp-tab-count` 的 `count > 999` → `` `${Math.round(count / 100) / 10}k` ``**(照搬 `:1284`)。
   - **图标按 `t.icon` 三/四分支内联 SVG,未知回落一个通用图标**(后端 tabs 的 icon 名不在本期契约内,回落必须存在)。
5. `.cp-body`:`candidates.items.length === 0` → `.cp-empty`(28px 放大镜 + `photosPlacesCoverNoMatch`({q: search}));否则 `.cp-grid`(8 列)内 `v-for` items → `.cp-cell`(`<button>`,`String(currentAssetId) === String(assetId)` 时 `.is-active` + 右上 `.cp-cell-check` 打勾),`@click` → `emit('pick', String(assetId))`,`:disabled="busy"`。
6. `.cp-foot`:`.cp-reset-btn`(11px 刷新图标 + `photosPlacesCoverResetDefault`,`:disabled="busy"`)→ `reset`;`.cp-foot-info` = `photosPlacesCoverPageInfo`({total, page: page + 1, pages: candidates.totalPages});`.cp-pagers` 两个 30px 方钮(`:disabled="page === 0"` / `:disabled="page >= candidates.totalPages - 1"`)→ `update:page` 带 `Math.max(0, page - 1)` / `Math.min(totalPages - 1, page + 1)`(**钳制照搬 Vue2 `:1322`/`:1328`**)。
7. **Esc 关闭**:`document` 级 keydown,`watch(() => props.open)` 挂/摘;**`onDocKeydown` 里除「非 Esc 直接 return」外禁止任何早退**(P5-T10 bug 形态);`onUnmounted` 兜底摘除。
8. token:`rgba(var(--ink), 0.04/0.06/0.10)` 三档 → `--chip-bg`(常态软底)、`--chip-bg-hi`(hover / `.is-active`);`--surface-1` → `--popup-bg`;`--line` → `--card-border`;文字三档同 T3 映射。`.cp-cell-check` 是 accent 实底上的白勾 → 可用 `--on-accent`(**这里背景确为 `var(--accent)` 饱和实底,是 `--on-accent` 的正确用法**,与 hero 上那些不同,注释写明这个区分)。
9. **hover 级联**:`.cp-tab:hover` 与 `.cp-tab.is-active`、`.cp-cell:hover` 与 `.cp-cell.is-active` 各是一对基类/变体 → 变体自带 `:hover`,cssCascade 断言。

- [ ] **Step 1: 写失败测试**

必含用例:
- `open=false` → 整层不渲染;`open=true` → `.cp-scrim` 与 `.cp-shell` 都在。
- 结构清点:head(thumb / title / sub / close)、tabs(tab 数 = `candidates.tabs.length`)、search input、grid(cell 数 = items 长度)、foot(reset / info / 两个 pager)各就位。
- 标题/副标题插值:`city='杭州'`、`totalCount=12345` → 标题含 `杭州`、副标题含千分位 `12,345`。
- 标签文案回落链三档:①`t.id='recent'` → 中文「近期」;②`t.id='zzz', label='Zzz'` → `Zzz`;③`t.id='zzz'` 无 label → `zzz`。
- `.cp-tab-count`:`count=1234` → 文本 `12.3k`(**先手算**:`Math.round(1234/100)/10 = 12.3`);`count=999` → `999`。
- 当前封面打勾:`currentAssetId` 为**数字** `7`、items 含字符串 `'7'` → 该 cell 有 `.is-active` 且含 `.cp-cell-check`(**String 归一守卫**)。
- 点 cell → emit `pick` 带 `String(assetId)`;`busy=true` 时所有 cell 与 reset 钮 disabled。
- 空态:`items=[]` → `.cp-empty` 出现且文案含查询词;`.cp-grid` 不渲染。
- 分页:`page=0` → 上一页 disabled;`page = totalPages - 1` → 下一页 disabled;点下一页 emit `update:page` 带 `page+1`;`totalPages=1` 时两个都 disabled。
- 页码信息:`total=88, page=0, totalPages=5` → 文本含 `88`、`1`、`5`(page 显示 +1)。
- 搜索:输入 `西湖` → emit `update:search` 带 `西湖`。
- 点标签 → emit `update:tab` 带 `t.id`。
- 关闭三路:点 `.cp-close-btn`、点 scrim 空白处(`click.self`)、按 Esc(**`document` 派发 + `bubbles: true`**)各 emit 一次 `close`;点 `.cp-shell` 内部**不**关闭。
- Esc 监听生命周期:`open` 由 true→false 后再派发 Esc **不再** emit;`unmount()` 后同样不 emit(断言 `removeEventListener` 被调)。
- cssCascade:hover 态下 `.cp-tab.is-active` 与 `.cp-cell.is-active` 的 background 各归属含 `:hover` 的变体规则。
- 颜色合规:`.cp-cell-check` 规则里用 `--on-accent` 是允许的(背景为 accent 实底);全样式块无字面 `#`/`rgba(`(除带 `theme-exception` 的行)。

- [ ] **Step 2: 跑测试确认失败**
- [ ] **Step 3: 实现**
- [ ] **Step 4: 跑测试确认通过 + color-guard 绿 + 逐个删码验证**

删码清单(一次只删一处):①`.cp-cell` 的 `String()` 归一去掉 → 数字 currentAssetId 用例红;②`count > 999` 分支删掉 → `12.3k` 用例红;③标签回落链的 `t.label` 一档删掉 → 回落用例中间那条红;④分页 `Math.max(0, ...)` 钳制删掉 → 需有一条断言在 `page=0` 时点上一页(强制 enable 后)不产生负数 —— 若测试构造不到就改钉 disabled 属性 + emit 参数;⑤Esc 的 `watch(open)` 摘除逻辑删掉 → 生命周期用例红;⑥`@click.self` 换成 `@click` → 「点 shell 内部不关闭」红;⑦`.cp-tab.is-active:hover` 整条删掉 → cssCascade 红。

- [ ] **Step 5: Commit** — `feat(photos): P6b-T7 封面选择器全屏弹层(标签页/搜索/分页/设为/恢复默认)`

---

