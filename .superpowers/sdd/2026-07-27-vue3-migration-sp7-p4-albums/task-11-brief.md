### Task 11: 侧栏第 4 条目 + 路由注册 + 集成验收

**Files:**
- Modify: `src/photos/components/PhotosSidebar.vue`(NAV 加一行)
- Modify: `src/router/index.ts`(两条路由 + 两个 import)
- Test: `src/photos/components/__tests__/PhotosSidebar.test.ts`、`src/router/__tests__/`(照 P3 T10 的既有路由断言体例)

**Interfaces:**
- `PhotosSidebar.vue:30-34` 的 NAV 注册表**加在 library 之后、favorites 之前**(照 Vue2 相册的信息层级):
  ```ts
  { id: 'albums', route: '/photos/albums', labelKey: 'photosAlbums' },
  ```
  `isActive` 已走 `activeNavId`(最长前缀匹配,P3 T6),**`/photos/albums/7` 会正确命中 albums 而非 library** —— 但必须**补一条测试**证明这一点(现有测试只覆盖到二级路径)。
- `router/index.ts`:在 `/photos/trash` 行**之后**追加(hash 路由精确匹配,`:id` 动态段放静态段之后更稳):
  ```ts
  { path: '/photos/albums', name: 'photos-albums', component: PhotosAlbums },
  { path: '/photos/albums/:id', name: 'photos-album-detail', component: PhotosAlbumDetail },
  ```
  加对应 import(照 `:16-18` 体例)。

- [ ] **Step 1: 写失败测试**:
  - `router.resolve('/photos/albums').name === 'photos-albums'`;`router.resolve('/photos/albums/7').name === 'photos-album-detail'` 且 `params.id === '7'`。
  - `PhotosSidebar`:路由在 `/photos/albums` 时只有 albums 高亮;在 `/photos/albums/7` 时**仍只有 albums 高亮**(library 不高亮 —— 三级路径回归)。
- [ ] **Step 2: RED**;**Step 3: 实现**;**Step 4: GREEN + 全量(1503 + 本期新增)+ tsc + color-guard + parity**。
- [ ] **Step 5: Commit** — `feat(photos): 注册相册路由 + 侧栏相册条目,P4 收官`
- [ ] **Step 6: 验收说明写进报告**(控制器转述用户):`cd /home/nimo/NimoTech/.sp7/NimoOS-New-UI && pnpm dev --host --port 5277`,浏览器 `http://192.168.1.143:5277/`(先登录)→ `/app/#/photos/albums`。看点见文末验收清单。

---

