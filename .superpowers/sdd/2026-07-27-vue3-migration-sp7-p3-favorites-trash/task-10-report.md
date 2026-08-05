# Task 10 报告:路由注册 + Photos.vue 收尾 + 集成验收(P3 收官)

## 变更文件
- `src/router/index.ts` — import `PhotosFavorites`(`../views/PhotosFavorites.vue`)、`PhotosTrash`(`../views/PhotosTrash.vue`);在 `/photos`(:32 原行)之后加两行:
  `{ path: '/photos/favorites', name: 'photos-favorites', component: PhotosFavorites }`
  `{ path: '/photos/trash', name: 'photos-trash', component: PhotosTrash }`
- `src/views/Photos.vue` —
  - import `usePhotosFavorites`(`../photos/stores/favorites`)
  - `onMounted` 内加一行 `usePhotosFavorites().reconcileFavIds()`(带中文注释说明原因:时间线首屏未开过灯箱/收藏视图时 per-tile 星标会因 favIds 未拉取而全部误报为未收藏)
  - `@toggle-fav="() => {}"` 上方补注释:收藏态由 `photosFavorites` store 同源(核实 `useLightbox.toggleFav()` 内部已直接调用 `usePhotosFavorites().toggle(item.id)`,Photos.vue 侧空接确属正确设计,非遗留占位)
- 测试:
  - `src/router/index.test.ts` — 新增两条 `it`:`router.resolve('/photos/favorites').name === 'photos-favorites'`、`/photos/trash` 同理
  - `src/views/__tests__/Photos.route.test.ts` — 新增一条 `it`:spy `usePhotosFavorites().reconcileFavIds`,mount 后断言被调用 1 次

## TDD 证据
1. **RED**(实现前跑新测试,3 条全红):
   - `/photos/favorites 命中 photos-favorites 路由` → `expected undefined to be 'photos-favorites'`
   - `/photos/trash 命中 photos-trash 路由` → `expected undefined to be 'photos-trash'`
   - `mount 触发 usePhotosFavorites().reconcileFavIds()` → `expected "vi.fn()" to be called 1 times, but got 0 times`
2. **实现**:见上方「变更文件」。
3. **GREEN**(实现后):
   - 目标测试:`pnpm exec vitest run src/router/index.test.ts src/views/__tests__/Photos.route.test.ts` → `2 passed (2 files) / 7 tests passed`
   - 全量 `pnpm test` → **244 test files passed / 1503 tests passed**(含 i18n parity、color-guard 全部在内,无一条红)。控制台有两条 jsdom `Not implemented: navigation` 报错噪音,来自既有 `src/photos/stores/__tests__/favorites.test.ts`(T1,exportZip 触发 `location.href=`),与本任务改动无关,不影响测试通过判定。
   - `pnpm exec vue-tsc --noEmit` → 无输出,类型检查通过。

## Self-Review
- 路由行为:hash 路由精确匹配,`/photos/favorites`、`/photos/trash` 各自命中新路由名,不受 `/photos` 影响,顺序无陷阱。
- `Photos.vue` 时间线逻辑**未改动**其余任何行为(fetchTimeline/startIndexPoll/fetchTasks/socket 订阅/onUnmounted 均原样),仅新增一行 reconcile 调用 + import + 注释,符合 brief「不改其它时间线逻辑」约束。
- `reconcileFavIds()` 内部已有 try/catch(store 定义于 T1),失败时仅 console.error、不抛出,不会影响 Photos.vue 挂载或既有测试(`Photos.integration.test.ts` 等旧 mock 缺 `listFavoriteIds` 时,内部 catch 吞掉即可,已跑全量验证无副作用)。
- 未新增/改动任何颜色字面量,无需 color-guard 关注点。
- diff 极小(4 文件,+30/-0),无越界改动。

## Commit
`2af1cbd` — `feat(photos): 注册收藏/回收站路由 + 时间线首屏收藏态,P3 收官`

## 验收说明(转述用户,真机 :5277)
```
cd /home/nimo/NimoTech/.sp7/NimoOS-New-UI && pnpm dev --host --port 5277
```
浏览器打开 `http://192.168.1.143:5277/`,先登录,再访问:
- `/app/#/photos/favorites` — 收藏视图:进入后应只见已收藏项按月分组;时间线里点星标应实心/空心即时切换(乐观);ZIP 导出按钮触发浏览器下载;点开某张图,灯箱翻页集应只在收藏集内;空收藏应显示空态文案;tab 过滤 all/photo/video 应生效。
- `/app/#/photos/trash` — 回收站视图:删除几张照片后进入应按剩余天数分桶显示、带倒计时角标;多选出现 bulk bar;恢复选中应弹带「撤销」的 toast;恢复全部/永久删除/清空回收站均应有二次确认(danger 样式);空回收站显示空态 + 保留天数文案;深浅色主题切换下颜色应正常(color-guard 已挡硬编码,真机需人工核对倒计时三档色对比度)。
- 侧栏应显示三条目(收藏库/收藏/回收站),切到 favorites/trash 时**只有对应那条**高亮(library 不应双高亮)。
- **本任务额外看点**:未开过灯箱/收藏视图的情况下,直接刷新进入时间线首页,已收藏的照片星标应立即显示为实心(而非需要先打开过灯箱才显示)——这是本任务新增的 `reconcileFavIds()` 首屏调用要验证的行为。

至此 SP7-P3(收藏/回收站)全部 10 个任务收官。
