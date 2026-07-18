# 手机端主页启动器(Mobile Home Launcher)设计

日期:2026-07-18 · 状态:已批准(用户选定方案 B + 只读)

## 问题

`/app/` 主页桌面网格写死 12 列、格子下限 40px,最小宽度 656px;手机竖屏(~390px)
必须左右滚动才能看全。顶栏和 Dock 已有 ≤720px 适配,唯独网格没有。

## 决策(用户拍板)

1. 手机端体验 = **手机风格启动器**:小组件全宽卡片竖排,应用图标 4 列流式,整页只上下滚动。
2. **只读**:手机上不支持编辑(拖拽排序/增删);排序、增删只在桌面做。
3. 不单独持久化手机布局:顺序 = 桌面布局的视觉顺序(先行后列)。

## 方案(B:手机专用视图组件)

`Home.vue` 按屏宽分叉:≤720px 渲染新组件 `MobileHome.vue`,否则渲染现有
`GridCanvas`。数据生命周期(loadInitial/loadServer/refreshApps/容器事件/photos)
全部留在 `Home.vue`,与分支无关。**桌面渲染路径一行不改。**

### 新增单元

| 单元 | 职责 | 依赖 |
|---|---|---|
| `src/home/grid/linearize.ts` | `linearizeLayout(items)`:按 (r,c) 排序线性化,纯函数 | types.ts |
| `src/home/composables/useIsMobile.ts` | 响应式 `(max-width: 720px)` 判断;jsdom 无 matchMedia 时恒 false(照抄 useSidebarDrawer 模式) | — |
| `src/home/components/MobileHome.vue` | 只读启动器视图 | linearize、WidgetCard、AppTile、FolderTile、PhotoTile、useOpenAction |

### MobileHome 布局

- 线性化后分两段:`widget`/`appwidget` → 全宽卡片区(保持桌面 w:h 宽高比,
  `max-height: 60vh` 封顶);`app`/`folder`/`photo` → 4 列图标网格区。
- 图标网格 `grid-auto-rows` = 列宽(格子正方形,与桌面同构);photo 磁贴
  `span 2×2`,`grid-auto-flow: dense` 补洞。
- 根元素设 `--cell: calc((100vw - 60px) / 4)`,复用桌面磁贴的等比字号/间距/圆角
  (本日已改为随 --cell 缩放)。
- 点击 = `useOpenAction().openItem(item)`,与桌面同一套打开逻辑。
- Dock 保留(已有 ≤720 适配);MobileHome 挂载时把全局 `--app-size` 设为 52px
  (手机上无 measure() 来设它,CSS 兜底 64px 偏大)。

### Home.vue 改动

- 模板:`<MobileHome v-if="isMobile" />` / `<GridCanvas v-else ... />`。
- `watch(isMobile)`:切回桌面时 `nextTick` 重新捕获 gridEl 并 `relayout()`
  (gridEl 原本只在 onMounted 捕获一次,转屏/拉窗会拿不到)。
- 手机上隐藏顶栏的"+ 添加"和"编辑"按钮(只读);搜索、主题切换保留。

## 错误处理

- 布局为空 → 两段自然为空,页面只剩 Dock,无报错。
- matchMedia 不存在(旧内核/测试)→ 恒桌面模式,行为与现状一致。

## 测试

1. `linearize.test.ts`:乱序 items 按 (r,c) 排序。
2. `useIsMobile.test.ts`:stub matchMedia,断言初值与 change 事件响应。
3. `MobileHome.test.ts`:seed layout store,断言小组件区/图标区的成员与顺序、
   photo 磁贴 span class、点击调用 openItem。

## 明确不做(YAGNI)

- 手机端编辑/拖拽;手机独立布局持久化;左右分页;Dock 超宽的极端适配(记债)。
