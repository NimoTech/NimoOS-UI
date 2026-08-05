### Task 9: 灯箱「加入相册」按钮 + 选择工具栏批量加相册 + 两处宿主接线

**Files:**
- Modify: `src/photos/lightbox/PhotoLightbox.vue`(顶栏加按钮 + 新 emit)
- Modify: `src/photos/components/PhotosSelectionToolbar.vue`(加「加入相册」按钮 + 新 emit)
- Modify: `src/views/Photos.vue`(时间线:接两处 → `AlbumPickerDialog`)
- Modify: `src/views/PhotosFavorites.vue`(收藏:同上)
- Modify: `src/views/PhotosAlbumDetail.vue`(详情:灯箱的 `add-to-album` 接线 —— T8 已挂灯箱,这里补该 emit)
- Test: 相应 `__tests__` 补测试(`PhotoLightbox.test.ts`、`PhotosSelectionToolbar.test.ts`、`Photos.integration.test.ts` 或新建、`PhotosFavorites.test.ts`、`PhotosAlbumDetail.test.ts`)

**Interfaces:**
- `PhotoLightbox`:新增 emit `(e: 'add-to-album', id: string | number): void`;顶栏在**收藏按钮与下载按钮之间**插入「加入相册」按钮(照 Vue2 `PhotosLightbox.vue:13-14` 的位置,P2 因范围收口删除的正是此处,注释 `delta: 1) 删「加入相册」「交给 Nimo」两钮` 要相应更新为「加入相册已于 P4 加回;Ask Nimo 仍归 SP8」),`aria-label`/`title` = `photosAddToAlbum`;点击 `emit('add-to-album', lb.current.value.id)`,**不关闭灯箱**(照 Vue2:emit 后由宿主开面板,灯箱保持打开)。
- `PhotosSelectionToolbar`:新增 emit `(e: 'add-to-album'): void`;在「取消」与「删除」之间插入按钮 `photosAddToAlbum`(非 danger 样式)。**保持既有 `clear`/`delete` 契约不变**(~两处宿主已在用)。
- 三处宿主统一模式:
  ```ts
  const pickerOpen = ref(false)
  const pickerIds = ref<Array<string | number>>([])
  function openAlbumPicker(ids: Array<string | number>) { pickerIds.value = ids; pickerOpen.value = true }
  // 模板:<AlbumPickerDialog v-model:open="pickerOpen" :asset-ids="pickerIds" @added="onAlbumAdded" />
  ```
  - `Photos.vue`(时间线):`<PhotosSelectionToolbar @add-to-album="openAlbumPicker([...selected])">`、`<PhotoLightbox @add-to-album="(id) => openAlbumPicker([id])">`;`onAlbumAdded` → 清空 selection(照 Vue2 `pickAlbum:587-595` 结尾 `this.selected = []`)。
  - `PhotosFavorites.vue`:同上两处接线;`onAlbumAdded` → 清空 selection(收藏列表本身不变)。
  - `PhotosAlbumDetail.vue`:只接灯箱一处(edit 工具条已有自己的「添加照片」语义,不重复放「加入相册」);`onAlbumAdded` → 无需刷新本相册(加到的是**别的**相册)。
- **z-index 注意**:灯箱是全屏覆盖层,`AlbumPickerDialog` 从宿主渲染时必须叠在灯箱之上 —— 检查 `PhotoLightbox` 的 z-index 值,给 picker 更高值(或与删除确认模态同层级),并在测试外真机验收时确认(记入验收清单)。

- [ ] **Step 1: 写失败测试**
  - `PhotoLightbox`:打开灯箱 → 存在「加入相册」按钮;点击 → emit `add-to-album` 带当前项 id;**灯箱仍 open**。
  - `PhotosSelectionToolbar`:渲染三个按钮;点「加入相册」→ emit;既有 `clear`/`delete` emit 未受影响(回归)。
  - `Photos.vue`:选中两项 → 点工具栏「加入相册」→ `AlbumPickerDialog` `open===true` 且 `assetIds` 为两项;其 `@added` → selection 清空。
  - `Photos.vue`:灯箱 emit `add-to-album(id)` → picker open 且 `assetIds===[id]`。
  - `PhotosFavorites.vue`:同样两条。
  - `PhotosAlbumDetail.vue`:灯箱 emit → picker open。
- [ ] **Step 2: RED**;**Step 3: 实现**;**Step 4: GREEN + 全量 + tsc + color-guard**。
- [ ] **Step 5: Commit** — `feat(photos): 灯箱与选择工具栏「加入相册」入口 + 三处宿主接线`

---

