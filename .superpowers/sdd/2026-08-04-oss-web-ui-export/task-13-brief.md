### Task 13: 测试同步 —— 删 9 个 + 抠约 15 个里的用例

**Files:**
- Modify: `oss/manifest.mjs`(`DELETE` 追加 9 条;`PATCH` 追加抠用例的锚点)
- Test: `oss/tree.test.mjs`

**Interfaces:**
- Produces: 产出树 `pnpm test` 全绿(比私有侧少约 25 个文件)

**为什么删而不是改写**(spec §7.1):约 25 个测试文件混着测被删功能与保留功能。改写成 `oss/files/` 里的分身 = 造 25 个会静默过期的冻结分身,正是哈希钉要防的问题 ×25。换法:**开源仓覆盖率低一截,私有主干一条测试都不少。** 划得来。

**抠用例的锚点以 `it(...)` 整块为单位** —— 私有侧以后改到那条用例,导出就报错把人叫回来,那正是我们要的信号。

- [ ] **Step 1: 写失败断言**

```js
describe('类 4 · 测试同步', () => {
  it('被删功能的测试文件整体不在', () => {
    for (const rel of [
      'src/home/components/PhotoTile.test.ts',
      'src/home/components/SearchDialog.test.ts',
      'src/home/components/widgets/AiWidget.test.ts',
      'src/home/stores/photos.test.ts',
      'src/files/viewers/speakerWave.test.ts',
      'src/settings/panels/FolderPermissionsPanel.test.ts',
      'src/settings/util/folderPermissions.test.ts',
      'src/settings/util/folderPermissionsSnapshot.test.ts',
      'src/settings/util/folderPermissionsView.test.ts',
      'packages/service/src/photos.test.ts',
    ]) expect(exists(rel), rel).toBe(false)
  })

  it('混合型测试文件保留,但里面不再提被删的东西', () => {
    for (const rel of [
      'src/home/components/HomeTopbar.test.ts',
      'src/home/components/MobileHome.test.ts',
      'src/home/components/GridItem.click.test.ts',
      'src/home/composables/useDock.test.ts',
      'src/home/composables/useOpenAction.test.ts',
      'src/home/grid/defaultLayout.test.ts',
      'src/home/stores/homeUi.test.ts',
      'src/settings/panels/panels.test.ts',
      'src/views/Home.integration.test.ts',
      'src/stores/locale.test.ts',
    ]) {
      expect(exists(rel), rel).toBe(true)
      const s = read(rel)
      for (const bad of ['PhotoTile', 'SearchDialog', 'AiWidget', 'usePhotosStore',
                         'search_switch', 'FolderPermissionsPanel', 'folderPermissions']) {
        expect(s, `${rel} :: ${bad}`).not.toContain(bad)
      }
      // UserFolderPermission(成员文件夹授权)是保留面,不在上面的禁列里 —— 见 E4
    }
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run oss/tree.test.mjs -t '测试同步'`
Expected: FAIL(2 例)

- [ ] **Step 3: `DELETE` 追加 9 条 + `SERVICE_DELETE` 已含 photos.test.ts**

```js
  // 测试同步:被删功能的测试整体删除(spec §7.2,零维护)
  'src/home/components/PhotoTile.test.ts',
  'src/home/components/SearchDialog.test.ts',
  'src/home/components/widgets/AiWidget.test.ts',
  'src/home/stores/photos.test.ts',
  'src/files/viewers/speakerWave.test.ts',
  'src/settings/panels/FolderPermissionsPanel.test.ts',
  'src/settings/util/folderPermissions.test.ts',
  'src/settings/util/folderPermissionsSnapshot.test.ts',
  'src/settings/util/folderPermissionsView.test.ts',
```

- [ ] **Step 4: 逐个混合型测试文件抠用例**

对下面每个文件,先列出命中被删功能的用例,再把每个 `it(...)` 整块做成一条 PATCH:

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
for f in src/home/components/HomeTopbar.test.ts src/home/components/MobileHome.test.ts \
         src/home/components/GridItem.click.test.ts src/home/components/FolderTile.test.ts \
         src/home/composables/useDock.test.ts src/home/composables/useDock.reorder.test.ts \
         src/home/composables/useOpenAction.test.ts src/home/grid/defaultLayout.test.ts \
         src/home/grid/gridMath.test.ts src/home/stores/homeUi.test.ts \
         src/settings/panels/panels.test.ts src/settings/panels/AppsPanel.test.ts \
         src/settings/util/appPaths.test.ts src/settings/util/migrateBrowse.test.ts \
         src/apps/util/systemApp.test.ts src/files/util/icons.test.ts \
         src/files/util/protect.test.ts src/stores/locale.test.ts \
         src/views/Home.integration.test.ts src/views/Files.test.ts; do
  echo "===== $f"
  grep -nE "it\(|describe\(" "$f" | grep -iE "photo|search|\bai\b|transcript|speaker|folderPerm|相册"
done
```

对每条命中,用 `sed -n 'A,Bp'` 取出 `it('…', …)` 到它的收尾 `})` 整块逐字粘贴成 PATCH 的 `find`,`replace: ''`。**注意**:
- `defaultLayout.test.ts` 大概率整文件都在断言私有版布局 —— 若它的每条用例都指向旧坐标,就改为**整体删除**(加进 DELETE),并在 `oss/tree.test.mjs` 里已有的布局断言当替代覆盖。
- `locale.test.ts` 的两处 `search_switch`(第 55、59 行)是 E2 的连带改动,按同样手法抠或改。
- `panels.test.ts` 若断言 `PANEL_BY_TAB` 的键数,数字要从 9 改 8。
- `useOpenAction.test.ts` 里断言 `window.location.href` 的用例,在开源版改成 `router.push` 后行为变了 —— 这些用例要删掉(§8.2 的有意偏离,不是回归)。

- [ ] **Step 5: 跑产出树全量测试**

```bash
pnpm exec vitest run oss/tree.test.mjs
node oss/export.mjs --out /tmp/oss-t13 --skip-guard --no-commit
cd /tmp/oss-t13 && pnpm install && pnpm test 2>&1 | tail -8; echo "EXIT=${PIPESTATUS[0]}"
```

Expected:`Test Files … passed`(约 352 − 25 ≈ 327)、`Tests … passed`、无 `Errors` 行、`EXIT=0`。
**任何一条红都不能放过** —— 红的原因只有两种:补丁漏了(去补)或行为偏离没登记(去 §8.2 登记 + 删对应用例)。

- [ ] **Step 6: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git add oss/manifest.mjs oss/tree.test.mjs
git commit -m "feat(oss): 测试同步(9 个整体删除 + 混合文件抠用例)"
```

---

