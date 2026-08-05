### Task 9: `TrashView.vue` — 回收站视图

**Files:**
- Create: `src/views/PhotosTrash.vue`
- Test: `src/views/__tests__/PhotosTrash.test.ts`

**Interfaces:**
- Consumes:`AreaShell`、`PhotosSidebar`、Task 3 `usePhotosTrash`、`useToast`、Task 2 `TrashPhoto`、`service.photos.thumbnailUrl`(缩略图,带 token)、i18n(T7)。
- Produces:路由组件(T10 注册 `/photos/trash`);**自绘分桶网格**(不复用 PhotosGrid),照 Vue2 `PhotosTrashView.vue` 重塑为 New-UI token 语言:
  - 壳:`<AreaShell :title="t('photosTrashTitle')"><div class="photos-layout"><PhotosSidebar/><main>…</main></div></AreaShell>`。
  - hero:标题 + 计数(`items.length` · photo/video 数 · 总 MB `可释放`)+ 「恢复全部」「清空回收站」按钮(空时 disabled)。
  - 空态:`loaded && items.length===0` → `photosTrashEmpty*`(hint 带 `{days: trash.retentionDays}`)。
  - filter chips(all/photo/video)+ sort(daysleft/recent),本地 `ref`;分桶用 `BUCKETS` 常量(照 Vue2 `:126-131`,4 桶,`min/max/tone`),`bucketed` computed = 对 sorted 过滤后的项按 `daysLeft` 落桶、空桶过滤;桶标题/描述走 i18n 键(T7)。
  - 瓦片:`<img :src="service.photos.thumbnailUrl(p.id,'small')">`(**不硬编码 URL**)+ 倒计时角标(`photosTrashDaysLeft {days}`,urgent `daysLeft<=7` / warn `8..14` 用 token 色)+ 多选勾选圈(`@click.stop` toggle)+ meta(`photosTrashFrom {source}` · deletedAt)。
  - 多选:本地 `selected: Set`;`onTileClick(p,e)` → `e.shiftKey || selected.size>0 ? toggleSelect(p) : toggleSelect(p)`(**P3 回收站点瓦片=切换选择,不开灯箱**,记台账);bulk bar(选中时):恢复选中 / 永久删除选中 / 取消。
  - 二次确认模态(照 Vue2 `askConfirm` 模式,一个 `confirm` ref 承载 `{title,body,ctaLabel,danger,onConfirm}`):恢复全部 / 永久删除选中 / 清空全部 三入口都走它;ESC 关模态。
  - 操作接 store:恢复选中 `trash.restore(ids)` → 成功 toast(`photosTrashRestoredToast`,**带 Undo**,记 `_undoIds`)/ 失败 toast;永久删除选中 `trash.purge(ids)`;恢复全部 `trash.restoreAll()`(记全量 ids 供 undo);清空 `trash.empty()`。Undo → `trash.undoRestore(_undoIds)`。toast 4500ms(照 Vue2)。
  - `onMounted`:`trash.fetchRetention()` + `trash.fetchTrash()`。
- **样式**:整屏 token 化(倒计时 urgent/warn/normal 三档色、hero、chips、模态、toast 全走 `var(--…)`);color-guard 必过。

- [ ] **Step 1: 写失败测试**（挂 Pinia + i18n;mock 共享包 trash 方法 + `thumbnailUrl`）
  - `loaded` 且空 → 渲染 `photosTrashEmptyTitle`,hero 按钮 disabled。
  - 有项 → 渲染分桶(按 daysLeft),瓦片 img src = `thumbnailUrl(id,'small')`(mock),倒计时角标含 `{days}`。
  - 点勾选圈 → 该项进 `selected`,bulk bar 出现。
  - 点「恢复选中」→ 开确认?(恢复选中 Vue2 无二次确认,直接执行——见 `restoreSelected` `:190`;**仅 恢复全部/永久删除/清空 有确认**)→ `trash.restore(ids)` 被调 + 恢复 toast 带 Undo。
  - 点 Undo → `trash.undoRestore(ids)` 被调。
  - 点「清空回收站」→ 开确认模态 → 确认 → `trash.empty()` 被调。
  - ESC 关确认模态。
- [ ] **Step 2: RED**;**Step 3: 实现**;**Step 4: GREEN + 全量 + tsc + color-guard**。
- [ ] **Step 5: Commit** — `feat(photos): 回收站视图(分桶网格 + 多选恢复/清空二次确认 + undo + 保留天数只读)`

---

