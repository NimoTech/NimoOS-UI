### Task 5: PhotosGrid 恢复 per-tile 收藏星标(消费 store)

**Files:**
- Modify: `src/photos/components/PhotosGrid.vue`
- Test: `src/photos/components/__tests__/PhotosGrid.test.ts`（追加星标用例;挂 Pinia）

**Interfaces:**
- Consumes:Task 1 `usePhotosFavorites`（`isFav(id)` 读、`toggle(id)` 写）。
- 变更:
  - `<script setup>` 加 `import { usePhotosFavorites } from '../stores/favorites'` + `const fav = usePhotosFavorites()`。
  - 磁贴模板(现 `:275-310` 循环 `v-for="p in m.filtered"`)加右上角星标按钮:
    ```html
    <button class="tile-fav" :class="{ 'is-fav': fav.isFav(p.id) }"
            :aria-label="fav.isFav(p.id) ? t('photosUnfavorite') : t('photosFavorite')"
            @click.stop="fav.toggle(p.id)">
      <!-- 实心/描边星 SVG,色用 var(--accent)/var(--fg) token -->
    </button>
    ```
    行为:已收藏项**恒显实心星**;未收藏项 **hover 时**显描边星(CSS `.tile:hover .tile-fav` 显隐,已收藏则恒显)。点击 `@click.stop` 阻止冒泡到 open/select,调 `fav.toggle(p.id)`(乐观 + 回滚在 store)。**星标判定用 `fav.isFav(p.id)`(值比较,合规)**,绝不用对象引用。
  - **不新增 emit**(收藏是全局横切态,grid 直接调 store,与 open/toggle-select 的 emit 分工:那两个是"选择/翻页集"这类视图级关注点,收藏是全局数据)。选择复选框(现 `.tile-check` `:298-306`)与星标共存,分区放置(check 左上、fav 右上,或 check 在 selecting 态才显)。
  - 样式:`.tile-fav` 绝对定位、token 化(`var(--overlay-bg)` 底 + `var(--accent)` 实心星),color-guard 合规。
- **删除路径不变**(仍走父层 selection toolbar / 灯箱)。

- [ ] **Step 1: 写失败测试**（`createTestingPinia({ stubActions: false })` 或 `setActivePinia`;喂 months 造瓦片）
```ts
// 挂 Pinia + i18n;months = 一个含 {id:'a'} 的月
it('已收藏项星标 is-fav;点击调 store.toggle', async () => {
  setActivePinia(createPinia())
  const fav = usePhotosFavorites()
  await fav.reconcileFavIds() // mock listFavoriteIds 返 ['a']
  const spy = vi.spyOn(fav, 'toggle').mockResolvedValue()
  const w = mount(PhotosGrid, { props: { months: [{ key:'m', title:'M', loc:'', photos:[{ id:'a', isVideo:false }] }] }, global: { plugins: [i18n] } })
  const star = w.find('.tile-fav')
  expect(star.classes()).toContain('is-fav')
  await star.trigger('click')
  expect(spy).toHaveBeenCalledWith('a')
})
it('点星标不触发 open/toggle-select(@click.stop)', async () => { /* 断言 emit open/toggle-select 未发 */ })
```

- [ ] **Step 2: RED**;**Step 3: 实现**;**Step 4: GREEN + 全量 + tsc + color-guard**。
- [ ] **Step 5: Commit** — `feat(photos): PhotosGrid 恢复 per-tile 收藏星标(消费 photosFavorites store)`

---

