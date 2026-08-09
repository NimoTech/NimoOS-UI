## Task 10: 导出相册 / 删除时刻

**Files:**
- Modify: `src/views/PhotosMomentDetail.vue`
- Modify: `src/views/PhotosMomentDetail.test.ts`
- Modify: `src/i18n/zh_cn.photos.ts` · `src/i18n/en_us.photos.ts`

**Interfaces:**
- Consumes: `store.exportAlbum` / `store.remove`（Task 3）
- Produces: 无新导出

**新增 i18n 键**：`photosMoSaveAsAlbum` · `photosMoAlbumCreated`（`相册「{name}」已创建 · {count} 张照片`）· `photosMoOpen` · `photosMoAlbumExists` · `photosMoAlbumFailed` · `photosMoDeleteMoment` · `photosMoPhotosStay` · `photosMoDeleteTitle`（`删除「{name}」？`）· `photosMoDeleteBody` · `photosMoDeleted` · `photosMoDeleteFailed` · `photosMoCancel` · `photosMoDelete`

- [ ] **Step 1: 写失败的测试**

在 `src/views/PhotosMomentDetail.test.ts` 追加：

```ts
describe('导出相册', () => {
  it('成功时 toast 带"打开"动作,点它跳新相册', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    vi.spyOn(s, 'exportAlbum').mockResolvedValue({ albumId: 'al1', name: 'Bozeman', count: 42 })
    const toast = useToast(); const show = vi.spyOn(toast, 'show')
    const { w, router } = await mountDetail()
    await w.find('[data-test="mo-save-album"]').trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    const action = show.mock.calls[0][2] as { label: string; onClick: () => void }
    expect(action.label).toBeTruthy()
    action.onClick()
    await router.isReady()
    expect(router.currentRoute.value.path).toBe('/photos/albums/al1')
  })

  it('重名(409)时给出专门的文案,不是笼统失败', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    vi.spyOn(s, 'exportAlbum').mockRejectedValue({ response: { status: 409 } })
    const toast = useToast(); const show = vi.spyOn(toast, 'show')
    const { w } = await mountDetail()
    await w.find('[data-test="mo-save-album"]').trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    expect(show.mock.calls[0][0]).toContain('已存在')
  })

  it('导出进行中时按钮禁用,防重复点击', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    let release: () => void = () => {}
    vi.spyOn(s, 'exportAlbum').mockImplementation(() => new Promise((r) => { release = () => r({}) }))
    const { w } = await mountDetail()
    await w.find('[data-test="mo-save-album"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('[data-test="mo-save-album"]').attributes('disabled')).toBeDefined()
    release()
  })
})

describe('删除时刻', () => {
  it('更多菜单里点删除先弹确认框,不直接删', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const remove = vi.spyOn(s, 'remove')
    const { w } = await mountDetail()
    await w.find('[data-test="mo-more"]').trigger('click')
    await w.find('[data-test="mo-delete"]').trigger('click')
    expect(w.find('[data-test="mo-delete-confirm"]').exists()).toBe(true)
    expect(remove).not.toHaveBeenCalled()
  })

  it('确认后删除并跳回智能视图页', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    vi.spyOn(s, 'remove').mockResolvedValue(undefined)
    const { w, router } = await mountDetail()
    await w.find('[data-test="mo-more"]').trigger('click')
    await w.find('[data-test="mo-delete"]').trigger('click')
    await w.find('[data-test="mo-delete-go"]').trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    expect(router.currentRoute.value.path).toBe('/photos/smart-views')
  })

  it('删除失败时留在原页,错误提示内联在确认框里(不是 toast)', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    vi.spyOn(s, 'remove').mockRejectedValue(new Error('nope'))
    const { w, router } = await mountDetail()
    await w.find('[data-test="mo-more"]').trigger('click')
    await w.find('[data-test="mo-delete"]').trigger('click')
    await w.find('[data-test="mo-delete-go"]').trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    expect(router.currentRoute.value.path).toBe('/photos/moments/m1')
    expect(w.find('[data-test="mo-delete-error"]').exists()).toBe(true)
  })

  it('取消关闭确认框', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w } = await mountDetail()
    await w.find('[data-test="mo-more"]').trigger('click')
    await w.find('[data-test="mo-delete"]').trigger('click')
    await w.find('[data-test="mo-delete-cancel"]').trigger('click')
    expect(w.find('[data-test="mo-delete-confirm"]').exists()).toBe(false)
  })

  it('点菜单外关闭更多菜单', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w } = await mountDetail()
    await w.find('[data-test="mo-more"]').trigger('click')
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="mo-delete"]').exists()).toBe(false)
  })
})
```

- [ ] **Step 2: 跑测试确认它失败**

Run: `pnpm exec vitest run src/views/PhotosMomentDetail.test.ts --reporter=verbose`
Expected: FAIL —— `[data-test="mo-save-album"]` 找不到

- [ ] **Step 3: 实现**

```ts
const exporting = ref(false)
const moreOpen = ref(false)
const confirmDeleteOpen = ref(false)
const deleteError = ref('')

async function saveAsAlbum(): Promise<void> {
  if (exporting.value) return
  exporting.value = true
  try {
    const data = await store.exportAlbum(momentId.value)
    const name = data.name || moment.value?.title || ''
    const count = data.count ?? 0
    toast.show(t('photosMoAlbumCreated', { name, count }), 5000, {
      label: t('photosMoOpen'),
      onClick: () => { router.push('/photos/albums/' + data.albumId) },
    })
  } catch (e) {
    const status = (e as { response?: { status?: number } })?.response?.status
    toast.show(status === 409 ? t('photosMoAlbumExists') : t('photosMoAlbumFailed'), 2500, 'danger')
  } finally {
    exporting.value = false
  }
}

async function doDelete(): Promise<void> {
  deleteError.value = ''
  try {
    await store.remove(momentId.value)
    router.push('/photos/smart-views')
  } catch (e) {
    // 弹窗内的失败提示走内联,不用 toast —— 答的是刚按下的那个按钮,得钉在旁边、
    // 不自动消失(本仓既定做法)。Vue2 这里是 toast + 关框,用户会以为删掉了。
    console.error('[photos-moments] deleteMoment', e)
    deleteError.value = t('photosMoDeleteFailed')
  }
}
```

更多菜单的 document mousedown 关闭逻辑照 Vue2 `:295-305`，用 `onMounted` / `onBeforeUnmount`。

模板：`data-test` 依次为 `mo-save-album` / `mo-more` / `mo-delete` / `mo-delete-confirm` / `mo-delete-go` / `mo-delete-cancel` / `mo-delete-error`。确认框结构与样式照 `PhotosSmartViewDetail.vue:609` 起的既有删除确认弹窗，**不新造**。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/views/PhotosMomentDetail.test.ts src/i18n/parity.test.ts --reporter=verbose`
Expected: PASS，累计 37 个详情页用例

- [ ] **Step 5: 提交**

```bash
git add src/views/PhotosMomentDetail.vue src/views/PhotosMomentDetail.test.ts src/i18n/zh_cn.photos.ts src/i18n/en_us.photos.ts
git commit -m "feat(photos): save a moment as an album, and delete a moment

A failed delete keeps its message inline in the confirmation dialog rather than
in a toast. Vue 2 closes the dialog and shows a toast, which reads as \"it
worked\" for the second or so before the message registers; the answer to a
button press belongs next to that button and should not time out.

The 409 case gets its own wording so a name clash is not reported as a generic
failure the user cannot act on."
```

---

