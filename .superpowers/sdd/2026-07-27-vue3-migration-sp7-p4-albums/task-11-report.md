# Task 11 报告:侧栏第 4 条目 + 路由注册 + 集成验收

## 实现了什么

1. `src/router/index.ts`
   - 新增 import:`PhotosAlbums`(`../views/PhotosAlbums.vue`)、`PhotosAlbumDetail`(`../views/PhotosAlbumDetail.vue`),照 `:16-18` 既有体例插在 `PhotosTrash` import 之后。
   - 新增两条路由,插在 `/photos/trash` 行之后:
     ```ts
     { path: '/photos/albums', name: 'photos-albums', component: PhotosAlbums },
     { path: '/photos/albums/:id', name: 'photos-album-detail', component: PhotosAlbumDetail },
     ```
     静态段 `/photos/albums` 在动态段 `/photos/albums/:id` 之前,不影响精确匹配。

2. `src/photos/components/PhotosSidebar.vue`
   - `NAV` 表插入一行,位置在 `library` 之后、`favorites` 之前:
     ```ts
     { id: 'albums', route: '/photos/albums', labelKey: 'photosAlbums' },
     ```
   - `isActive`/`activeNavId` 逻辑未改动(P3 T6 的最长前缀匹配纯函数直接复用,`/photos/albums/7` 天然只命中 `albums`)。

## 测了什么及结果(TDD 证据)

### RED(实现前)
```
pnpm test -- src/router/index.test.ts src/photos/components/__tests__/PhotosSidebar.test.ts
...
Test Files  2 failed (2)
     Tests  6 failed | 10 passed (16)
```
失败断言包括:`items` 长度期望 4 实际 3、`/photos/favorites`/`/photos/albums`/`/photos/albums/7` 场景下 active class 断言全部落空(此时 router/NAV 尚未加 albums)。

### GREEN(实现后,聚焦测试)
```
pnpm test -- src/router/index.test.ts src/photos/components/__tests__/PhotosSidebar.test.ts src/photos/util/__tests__/activeNavId.test.ts
Test Files  3 passed (3)
     Tests  21 passed (21)
```

### 全量
```
pnpm test
Test Files  252 passed (252)
     Tests  1647 passed (1647)
```
基线 1643(其中 1 个 `src/files/upload/persist.test.ts` 用例在全量并发下偶发失败,单独跑/隔离重跑必绿——已用
`pnpm test -- src/files/upload/persist.test.ts` 单独验证 14/14 通过,确认是既有 flaky,与本任务无关)+ 本期新增 4
条断言(router 2 条 + sidebar 2 条新场景;另有 2 条既有断言因条目数变化同步改写下标,未净增用例数)。

```
pnpm exec vue-tsc --noEmit
```
无输出,类型检查通过。color-guard.test.ts、i18n/parity.test.ts 均含在全量 252 文件里,全绿(另外单独跑
parity.test.ts 确认 3/3 通过)。

新增/修改的具体测试:
- `src/router/index.test.ts`:新增两条 `it`——`/photos/albums` 命中 `photos-albums`;`/photos/albums/7` 命中
  `photos-album-detail` 且 `params.id === '7'`。
- `src/photos/components/__tests__/PhotosSidebar.test.ts`:
  - 原「渲染三条导航项」改写为四条(补 albums 断言,下标同步右移)。
  - 原「/photos/favorites 时仅 favorites active」补上 albums 下标不 active 的断言。
  - 新增「/photos/albums 时仅 albums 项 active」。
  - 新增「/photos/albums/7(三级路径,相册详情)时仍只有 albums 项 active,library 不误伤」——这是
    brief 硬约束要求的三级路径回归测试,断言 `items[0]`(library)不带 `active`。

## 改了哪些文件

- `src/router/index.ts`
- `src/photos/components/PhotosSidebar.vue`
- `src/router/index.test.ts`
- `src/photos/components/__tests__/PhotosSidebar.test.ts`

Commit:`57c3620 feat(photos): 注册相册路由 + 侧栏相册条目,P4 收官`

## 收官自查(五项逐条结论)

### 1. `grep -rn "v1/photos" src/` —— 全仓无手拼 photos URL?

命令与输出(节选):全部命中都在 `*.test.ts` 里,作为 mock 返回值出现(`thumbnailUrl`/`originalUrl`/
`liveUrl`/`exportFavoritesUrl` 的 mock 实现),例如:
```
src/photos/lightbox/__tests__/PhotoImageViewer.test.ts:9:  originalUrl: (id) => `/v1/photos/assets/${id}/original?token=t`,
src/views/__tests__/PhotosFavorites.test.ts:20:  exportFavoritesUrl: vi.fn(() => '/v1/photos/favorites/export?token=T1'),
```
**结论:合规。** 组件/store 源码里没有任何一处手拼 `/v1/photos/...`,全部通过共享包
(`service.photos.thumbnailUrl`/`originalUrl`/... )生成,测试文件里出现的字符串只是 mock 桩,不是违规。

### 2. `grep -rn "@keydown.esc" src/photos src/views/Photos*.vue` —— 浮层关闭都走 document 级?

命中列表:
```
src/photos/components/AlbumPickerDialog.vue:54   (注释,说明用 document 级)
src/photos/components/AlbumLibraryPicker.vue:94  (注释)
src/views/PhotosFavorites.vue:12/109             (注释)
src/views/PhotosAlbumDetail.vue:277              (注释)
src/views/PhotosAlbumDetail.vue:391              @keydown.esc.prevent="cancelTitleEdit"  ← 唯一真实模板绑定
src/views/PhotosAlbums.vue:12                    (注释)
```
唯一一处真实模板绑定在 `PhotosAlbumDetail.vue:391`,绑在相册标题重命名的 `<input ref="titleInputRef" ...>`
自身上(`@keydown.enter.prevent="commitTitle"` / `@keydown.esc.prevent="cancelTitleEdit"` 同一元素),不是浮层/模态
的关闭逻辑——**属于 brief 明确的合规例外(绑在输入框自身上)**。
**结论:合规,无需改动。**

### 3. `grep -rn "on-accent" src/views/PhotosAlbum*.vue` —— 只剩「背景确为 accent 实底」的两处?

`PhotosAlbum*.vue` 这个 glob 同时匹配 `PhotosAlbumDetail.vue` 和 `PhotosAlbums.vue` 两个文件。实际
`var(--on-accent)` 的真实 CSS 使用(排除注释行)有 **4 处**,分布在两个文件:

| 文件 | 行 | 选择器 | 背景是否确为 accent 实底 |
|---|---|---|---|
| PhotosAlbumDetail.vue | 708 | `.tile[data-cover="true"]::after`(★Cover 徽章) | 是,`background: color-mix(in srgb, var(--accent) 85%, transparent)` |
| PhotosAlbumDetail.vue | 742 | `.tile-select-check`(选择勾选圈,`[data-selected="true"]` 时) | 是,`.tile[data-selected="true"] .tile-select-check { background: var(--accent); }` |
| PhotosAlbums.vue | 389 | `.album-cover-icon` | 是,叠在 `.album-cover-fallback` 的渐变(终色 `var(--accent)`)上 |
| PhotosAlbums.vue | 440 | `.albums-btn-cta` | 是,`background: var(--accent)` 直接实底按钮 |

**结论:brief 文字里「只剩那两处」字面上只对了一半** —— 若只看 `PhotosAlbumDetail.vue`(T8 评审 Critical 1
的原始上下文),确实是两处(★Cover 徽章、选择勾选圈),且第三处 `.tile-cover-btn` 星标按钮已被评审改为固定
`#fff` 并写了 theme-exception 注释,不再用 `--on-accent`。但本任务的自查命令用的 glob `PhotosAlbum*.vue` 会
额外带出 `PhotosAlbums.vue`(列表页)的 2 处,加起来共 4 处。**逐一核实后 4 处全部满足"背景确为 accent 实底"
的合规条件,不是违规,只是 brief 里"两处"这个数字没有把列表页也算进去** —— 列为报告项而非自行修改,是否需要
更新 brief 措辞或补充说明由控制器定。

### 4. P4 新增 i18n 键是否都被引用?

对 `zh_cn.ts` 里全部 81 个 `photosAlbum*` 前缀键逐一用 `grep -rn "['\"\`]<key>['\"\`]"` 核对 `src/**/*.vue`、
`src/**/*.ts`(排除 i18n 文件本身与 parity 测试),发现 **2 个死键**:

- `photosAlbumsMine`("我的相册")
- `photosAlbumsMineHint`("你创建的相册")

两键在 `zh_cn.ts:656-657` 与 `en_us.ts:657-658` 都存在(parity 测试不会报——两文件键集合一致),但全仓搜索
不到任何 `.vue`/`.ts` 源码引用。**列为报告项,未自行删除**——不确定是 P4 早期规划的分组标题(后来 UI 简化掉
没清理),还是留给未来"我的相册 vs 共享相册"分组功能的预留位,交控制器判断是否清理。

### 5. `src/photos/stores/albums.ts` 与两个视图是否有遗留 TODO / 占位 / 死代码?

- `grep -n "TODO\|FIXME\|XXX\|placeholder\|占位\|待办\|未实现"` 命中的都不是真正的遗留:
  - `PhotosAlbums.vue:74`「渐变占位」、`PhotosAlbumDetail.vue:91`「渐变占位」——指封面缺失时的视觉占位态(功能已实现,非代码占位)。
  - `PhotosAlbumDetail.vue:67` `function onAlbumPickerAdded(): void {}` —— 空函数,但紧邻注释明确说明这是有意为之
    的一致性接线(灯箱「加入相册」加到的是别的相册,不是本相册,故无需刷新;与 `Photos.vue`/`PhotosFavorites.vue`
    同名接线保持可读性一致),**不是遗留 TODO**。
  - `PhotosAlbumDetail.vue:692` 注释提到 sortablejs `ghostClass` 拖拽占位元素——第三方库概念名,非代码遗留。
- `src/photos/stores/albums.ts`(197 行)通读一遍:每个 action 都有对应 Vue2 行号注释 + 乐观/回滚策略说明,
  `__resetForTest` 是标准测试重置钩子,没有发现 TODO、注释掉的代码块或未使用的导出。
**结论:无遗留 TODO/占位/死代码。**

## 自审发现

- 全量测试 1647/1647 通过,`vue-tsc --noEmit` 无输出(通过)。
- 唯一的测试噪音是 `pnpm test` 全量输出里两条 jsdom `Error: Not implemented: navigation (except hash changes)`
  堆栈(来自 `src/photos/stores/favorites.ts:97` 的 `exportZip` 走 `location.href = ...` 触发下载,在
  `favorites.test.ts` 里被 mock 场景触发)——这是 stderr 打印,不是断言失败,测试仍标记为通过;与本任务改动无关,
  不在本次修改范围内。
- 侧栏与路由改动都是纯增量:未改动任何既有路由/NAV 条目的 id、labelKey 或跳转行为,`git diff --stat` 显示
  4 个文件、+47/-6 行,全部落在 brief 划定的文件范围内。

## 遗留疑虑(交控制器决定,未自行处理)

1. `photosAlbumsMine` / `photosAlbumsMineHint` 两个 i18n 死键(zh_cn.ts:656-657、en_us.ts:657-658)——是否清理。
2. 收官自查第 3 项:`on-accent` 在 `PhotosAlbum*.vue` glob 下实际命中 4 处(分布两个文件),而不是 brief 字面
   写的"两处"——已逐一核实全部合规,仅供控制器确认这个数字口径。

## 验收说明(转述给用户)

```bash
cd /home/nimo/NimoTech/.sp7/NimoOS-New-UI && pnpm dev --host --port 5277
```
浏览器打开 `http://192.168.1.143:5277/`(先登录)→ 地址栏跳转 `/app/#/photos/albums`,或在照片区侧栏点击新出现
的「相册」条目(位于「照片库」之后、「收藏」之前)。看点:
- 侧栏四条:照片库 / 相册 / 收藏 / 最近删除,当前页对应条目高亮,其余不高亮。
- 进入某个相册详情(`/photos/albums/<id>`)时,侧栏仍只有「相册」高亮,「照片库」不会被误伤(三级路径回归点)。
