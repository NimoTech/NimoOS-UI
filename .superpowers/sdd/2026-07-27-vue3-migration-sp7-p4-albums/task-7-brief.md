### Task 7: `PhotosAlbums.vue` — 相册列表视图

**Files:**
- Create: `src/views/PhotosAlbums.vue`
- Test: `src/views/__tests__/PhotosAlbums.test.ts`

**Interfaces:**
- Consumes:`AreaShell`(`src/components/shell/AreaShell.vue`,`<AreaShell :title>`)、`PhotosSidebar`、T2 `usePhotosAlbums`、T1 `albumToView`/`sortAlbums`、T6 `AlbumLibraryPicker`、`useTimelineStore`(「最近 30 天」填充需要)、`useToast`、`service.photos.thumbnailUrl`、i18n(T3)、`useRouter`。
- Produces:路由组件(T11 注册 `/photos/albums`)。壳照 `Photos.vue:176-180` 的 `.photos-layout` / `.photos-main`(复制,不抽公共 —— P3 T8 同样处理,保持一致)。
- 结构(照 Vue2 `PhotosAlbumsView.vue:16-86,99-165`,**去掉 Ask Nimo / 共享相册**):
  - **顶部 banner**:`h1` = `photosAlbumsTitle`;副标题 `photosAlbumsCount {count}`;右侧 = 排序下拉按钮(点击展开 `.sort-menu`,6 项 label+hint,当前项打勾)+ 主按钮 `photosAlbumNew`。
  - **卡片网格** `grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))`(照 `photos.scss:3229-3231`):
    - 首个是「新建」占位卡(虚线边框 + `+` + `photosAlbumNew` / `photosAlbumNewHint`),点击 = 打开新建模态。
    - 相册卡:封面 `thumbnailUrl(view.cover,'large')`,无封面 → `.album-cover-fallback`(渐变,起色 Vue2 `#2A1F4A` → 改 `color-mix(in srgb, var(--accent) 35%, var(--panel-bg))`,终色 `var(--accent)`)+ 相册图标;标题;`photosItemsCount`;`view.dateRange`(为空则不渲染该行);hover `translateY(-2px)` + 封面 `scale(1.04)`。
    - 点卡片 → `router.push('/photos/albums/' + view.id)`(**Vue2 是页内 state,New-UI 走真路由**)。
  - **空态**(`albumsLoaded && albums.length===0`)→ `photosAlbumsEmptyTitle` / `photosAlbumsEmptyHint`;**空态下仍渲染「新建」占位卡**(否则用户无入口)。
  - **新建模态**(照 Vue2 `:99-165`):遮罩 `@click.self` 关;标题 `photosAlbumCreateTitle` + 副标题;名称 input(回车提交);填充方式三选一单选(`empty` / `recent` / `select`,各带 label+hint);底部 `photosCancel` + 主按钮(`creating` 时 `photosAlbumCreating` 且禁用;名称 trim 为空时禁用)。
- 行为:
  - `onMounted`:`void albums.fetchAlbums()`。
  - `sort` 本地 `ref('updated')`;`views` computed = `sortAlbums(albums.albums.map(a => albumToView(a, t('photosAlbumUntitled'))), sort)`。
  - 排序菜单:`document` 上 `mousedown` 关闭 + `Escape` 关闭(照 Vue2 `:240-259` 的两个全局监听),`onUnmounted` 必须移除。
  - `confirmCreate()`(照 Vue2 `:309-358`,**去掉 nimo 分支**):
    1. `const created = await albums.createAlbum(name.trim())`
    2. `source==='recent'` → 取 `timeline` 全部照片中 `takenAt` 在近 30 天内的 id 集(照 Vue2 `:317-329`),非空则 `await albums.addAssetsToAlbum(created.id, ids)`
    3. `source==='select'` → `await albums.fetchAlbumAssets(created.id)`(预取,照 Vue2 `:330-335`)后打开 `AlbumLibraryPicker`(`pickerAlbumId=created.id`、`pickerAlbumName=name`)
    4. 成功 toast `photosAlbumCreatedToast {name}`;catch → 409 → `photosAlbumNameExists`,否则 `photosAlbumCreateFailed`;`finally` 关模态 + `creating=false`(照 Vue2 `:354-357`)
  - `AlbumLibraryPicker` 的 `@added` → `void albums.fetchAlbums()`(刷新计数/封面)。
- **删除相册不在列表页**(照 Vue2:入口只在详情页 ⋯ 菜单;Vue2 的 `onDeleteAlbum` 在列表页只是接收详情页 emit —— New-UI 改真路由后删除后由详情页 `router.push('/photos/albums')` 返回,列表页无需该 handler)。

- [ ] **Step 1: 写失败测试**(挂 Pinia + i18n + router;mock 共享包):
  - `albumsLoaded` 且列表空 → 渲染 `photosAlbumsEmptyTitle`,且「新建」占位卡仍在。
  - 有相册 → 渲染卡片:标题、`photosItemsCount`、封面 img src === `thumbnailUrl(cover,'large')`(mock 返回值)、无封面项渲染 fallback 而非 `<img>`。
  - 点卡片 → `router.push` 收到 `/photos/albums/<id>`(**用数字 id 的相册验证 URL 拼接正确**)。
  - 切排序为 `name` → 卡片顺序变为字母序(断言 DOM 顺序,证明接了 `sortAlbums` 而不是死排)。
  - 点「新建」→ 模态出现;名称空时主按钮 disabled;填名 + 选 `empty` + 提交 → `createAlbum(name)` 被调 + 成功 toast + 模态关闭。
  - `source==='recent'` → `createAlbum` 后 `addAssetsToAlbum` 被调,且传入 id 集只含近 30 天的照片(用 fake timers 固定 now)。
  - `source==='select'` → 提交后 `AlbumLibraryPicker` 渲染(`open===true`)。
  - `createAlbum` 抛 409 → 渲染/toast 重名文案,模态关闭(照 Vue2 `finally` 语义)。
- [ ] **Step 2: RED**;**Step 3: 实现**;**Step 4: GREEN + 全量 + tsc + color-guard**。
- [ ] **Step 5: Commit** — `feat(photos): 相册列表视图(卡片网格 + 排序 + 新建三种填充方式 + 空态)`

---

