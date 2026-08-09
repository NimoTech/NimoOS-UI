### Task 3: Photos Cache 迁移入口(Vue2 #103)+ 死条目清理(#105)

**Files:**
- Modify: `src/settings/util/appPaths.ts:20-30`(类型、`ORDER`、顶部注释)
- Modify: `src/settings/util/migrateBrowse.ts:24-29`(`browseDestPaths`)与 `:50-58`(`filterBrowseFolders`)
- Modify: `src/settings/panels/AppsPanel.vue:25-29`(`ROW_LABEL_KEY`)
- Modify: `src/settings/panels/panels.test.ts:107`
- Test: `src/settings/util/appPaths.test.ts`、`src/settings/util/migrateBrowse.test.ts`
- Modify: `src/i18n/zh_cn.sp9.ts` / `src/i18n/en_us.sp9.ts`

**Interfaces:**
- Consumes: 无跨任务依赖。
- Produces: `AppPathKey` 从三元组变成 `'app_data' | 'images' | 'database' | 'photos_data'`。

- [ ] **Step 1: 加 i18n 键**

`src/i18n/zh_cn.sp9.ts` 在 `settingsAppsDatabase` 那行之后加 `settingsAppsPhotosData: '相册缓存',`;
`src/i18n/en_us.sp9.ts` 同位置加 `settingsAppsPhotosData: 'Photos Cache',`。(两串逐字取自 Vue2 `#103`。)

- [ ] **Step 2: 写失败测试**

`src/settings/util/appPaths.test.ts` 追加(fixture 是 2026-08-09 真机 `GET /v1/sys/paths` 的响应):

```ts
  it('derives a fourth row for the photos cache (Vue2 #103)', () => {
    const paths = {
      app_data: { path: '/DATA/AppData', size: 6037987 },
      database: { path: '/DATA', size: 3557039799 },
      images: { path: '/DATA/.system_data/.docker & .containerd', size: 58125438307 },
      photos_data: { path: '/DATA/.system_data/photos', size: 6281536962 },
    }
    const rows = buildAppPathRows(paths as never, [])
    expect(rows.map((r) => r.key)).toEqual(['app_data', 'images', 'database', 'photos_data'])
    expect(rows[3].path).toBe('/DATA/.system_data/photos')
    expect(rows[3].size).toBe(6281536962)
  })
```

`src/settings/util/migrateBrowse.test.ts` 追加:

```ts
  it('points the photos cache at <target>/.system_data/photos (matches migrate.go)', () => {
    expect(browseDestPaths('photos_data', '/media/Backup')).toEqual([
      '/media/Backup/.system_data/photos',
    ])
    expect(browseDestPaths('photos_data', '/media/Backup/')).toEqual([
      '/media/Backup/.system_data/photos',
    ])
  })

  it('drops dot-prefixed folders before the blocked list is ever consulted (Vue2 #105)', () => {
    // #105 found the dot entries in the blocked list to be dead code: the dot filter
    // below already removed them. Same holds here, which is why photos_data adds no
    // `.system_data` entry to `blocked`.
    const items = [
      { name: '.system_data', path: '/DATA/.system_data', is_dir: true, is_symlink: false },
      { name: '.docker', path: '/DATA/.docker', is_dir: true, is_symlink: false },
      { name: 'Backup', path: '/DATA/Backup', is_dir: true, is_symlink: false },
    ]
    for (const type of ['app_data', 'images', 'database', 'photos_data'] as const) {
      expect(filterBrowseFolders(items as never, type, '').map((i) => i.name)).toEqual(['Backup'])
    }
  })
```

- [ ] **Step 3: 跑测试确认失败**

Run: `pnpm exec vitest run src/settings/util/appPaths.test.ts src/settings/util/migrateBrowse.test.ts`
Expected: FAIL —— 类型不认 `'photos_data'`;`browseDestPaths('photos_data', …)` 落到 database 的四目录分支。

- [ ] **Step 4: 改 `appPaths.ts`**

1. `export type AppPathKey = 'app_data' | 'images' | 'database' | 'photos_data'`
2. `const ORDER: AppPathKey[] = ['app_data', 'images', 'database', 'photos_data']`
3. 顶部那段注释里这句已经过期,必须改写(它现在会把人引向错误结论):

   > 后端(2026-08-01 实测 GET /v1/sys/paths)返回 4 个 key —— app_data / images / database / photos_data,而 Vue2 只渲染前 3 个。界面 1:1 → 这里也只产出 3 行。

   换成英文的现状描述:

   ```ts
   // The backend returns four keys -- app_data / images / database / photos_data
   // (verified 2026-08-09). Vue 2 rendered only the first three until #103 added the
   // photos cache row; all four are rendered here.
   ```

- [ ] **Step 5: 改 `migrateBrowse.ts`**

`browseDestPaths` 里,在 `if (type === 'app_data')` 那一行之后加:

```ts
  if (type === 'photos_data') return [`${b}/.system_data/photos`]
```

`filterBrowseFolders` 里删掉这一行:

```ts
  if (type !== 'images') blocked.push('.docker', '.containerd')
```

并在 `const blocked: string[] = []` 上方补注释:

```ts
  // Dot-prefixed folders (.docker/.containerd/.system_data) need no entry here: the
  // filter below drops every item whose name starts with '.' before `blocked` is even
  // consulted, so such entries would be dead code (Vue 2 #105 reached the same result).
```

- [ ] **Step 6: 跑测试确认通过**

Run: `pnpm exec vitest run src/settings/util/appPaths.test.ts src/settings/util/migrateBrowse.test.ts`
Expected: PASS

- [ ] **Step 7: 变异验证 —— 确认 dot 过滤那条用例不是空转**

临时把 `filterBrowseFolders` 里 `it.name.startsWith('.')` 这个条件删掉,重跑上面那条命令:**Step 2 里那条 `drops dot-prefixed folders…` 必须红**。确认后改回来再跑一次确认绿。不提交这次改动。

- [ ] **Step 8: 接面板第四行**

`src/settings/panels/AppsPanel.vue` 的 `ROW_LABEL_KEY` 加一项:

```ts
  photos_data: 'settingsAppsPhotosData',
```

`src/settings/panels/panels.test.ts:107` 的 `expect(w.findAll('.set-app-row')).toHaveLength(3)` 改成 `toHaveLength(4)`,并把同一个 `it` 描述里的「三行」改成「四行」(该描述是中文旧文,顺手整句改成英文)。

- [ ] **Step 9: 跑测试确认通过**

Run: `pnpm exec vitest run src/settings/panels/panels.test.ts src/settings/panels/AppsPanel.test.ts src/i18n/parity.test.ts`
Expected: 全部 PASS。若 `AppsPanel.test.ts` 因为 fixture 只有三个 key 而红,把它的 `PATHS` fixture 补上 `photos_data: { path: '/DATA/.system_data/photos', size: 6281536962 }`(与真机一致)。

- [ ] **Step 10: Commit**

```bash
git add src/settings src/i18n
git commit -m "feat(settings): show the photos cache under app data locations

The backend has reported photos_data from /sys/paths all along; the row
and its migration target were the only missing half. The dot-prefixed
entries in the browse blocklist go with it -- the dot filter above them
already made them unreachable."
```

---

