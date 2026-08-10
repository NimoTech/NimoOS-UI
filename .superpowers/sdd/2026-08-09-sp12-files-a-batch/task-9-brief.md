### Task 9: F9 —— 收藏项用按名字的专属图标

**用户看到什么**：侧栏收藏里的 Downloads / Gallery / Media / Documents / AppData 显示各自的专属图标，而不是清一色的通用文件夹图标。

**⚠️ 这不是「USB 图标」**。取证见本计划开头的推翻表：Vue2 `TreeList.vue:49` 用的是按名字的 `FAVORITE_ICON_MAP`，零 USB 概念。New-UI 的等价物是 `icons.ts:59-66` 的 `FOLDER_BY_NAME`，经 `iconNameFor` 暴露 —— **不要扩 `Favorite` 类型**。

**Files:**
- Modify: `src/files/components/FilesSidebar.vue`（收藏项那条 `<img>`，`:235` 附近）
- Test: `src/files/components/FilesSidebar.test.ts`

- [ ] **Step 1: 写失败的测试**

```ts
it('gives a favourite the icon its name maps to, not the generic folder', () => {
  const w = mountSidebar({ favorites: [{ name: 'Downloads', path: '/DATA/Downloads' }] })
  const src = w.find('.side-fav .side-icon').attributes('src')
  expect(src).toContain('folder-download')
})

it('falls back to the generic folder icon for an unmapped name', () => {
  const w = mountSidebar({ favorites: [{ name: 'Trip 2026', path: '/DATA/Trip 2026' }] })
  const src = w.find('.side-fav .side-icon').attributes('src')
  expect(src).toContain('folder-default')
})
```

> 若收藏 `<li>` 上没有 `.side-fav` 这样可定位的类，就加一个（属于本任务范围），别用 `findAll('.side-item')[n]` 这种靠顺序的脆弱定位。

- [ ] **Step 2: 跑测试确认它红**

```bash
pnpm exec vitest run src/files/components/FilesSidebar.test.ts
```

- [ ] **Step 3: 实现**

`FilesSidebar.vue` 引入 `iconNameFor`（同文件已引 `iconUrl`），收藏项的 `<img>` 改成：

```vue
<!-- Favourites are always folders, so the name map in icons.ts is the whole
     story -- same as Vue2's FAVORITE_ICON_MAP. -->
<img class="side-icon" :src="iconUrl(iconNameFor({ name: fav.name, is_dir: true }))" alt="" />
```

- [ ] **Step 4: 跑测试确认它绿**

```bash
pnpm exec vitest run src/files/components/FilesSidebar.test.ts
```

- [ ] **Step 5: 提交**

```bash
git add src/files/components/FilesSidebar.vue src/files/components/FilesSidebar.test.ts
git commit -m "fix(files): give sidebar favourites their per-name folder icons

The name-to-icon map already existed and the file listing already used it;
the sidebar hardcoded the generic folder icon instead."
```

---

