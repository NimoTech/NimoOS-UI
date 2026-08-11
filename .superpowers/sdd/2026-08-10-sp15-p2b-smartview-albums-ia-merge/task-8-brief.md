## Task 8: 智能相册 → 普通相册 + 活动流文案

**Files:**
- Modify: `src/views/PhotosSmartViewDetail.vue`
- Modify: `src/views/__tests__/PhotosSmartViewDetail.test.ts`
- Modify: `src/photos/components/SmartViewActivityFeed.vue`
- Modify: `src/photos/components/__tests__/SmartViewActivityFeed.test.ts`
- Modify: `src/i18n/zh_cn.photos.ts` · `src/i18n/en_us.photos.ts`（+7 键）

**Interfaces:**
- Consumes: `albumsStore.convertFromSmartView`（T1）
- Produces: 无（本任务是叶子）

**回源**：`git -C /home/nimo/NimoTech/NimoOS-UI diff 899af59b 939a7d3a -- src/views/Photos/PhotosSmartViewDetail.vue`
（78 行的完整 diff：菜单项、确认弹窗、`activityText` 分支、四个方法）。

---

- [ ] **Step 1: 写失败测试**

```ts
  it('offers Convert to regular album above the destructive separator', async () => {
    const w = await mountDetail({ sv: { id: 's1', name: 'S', count: 12 } })
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    const menu = w.find('[data-test="sv-more-menu"]')
    const html = menu.html()
    expect(menu.find('[data-test="sv-more-convert"]').exists()).toBe(true)
    // Grouped with rename/duplicate, i.e. before the separator, not next to Delete.
    expect(html.indexOf('sv-more-convert')).toBeLessThan(html.indexOf('sv-export-sep'))
  })

  it('asks for confirmation and spells out that the theme is discarded', async () => {
    const w = await mountDetail({ sv: { id: 's1', name: 'S', count: 12 } })
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    await w.find('[data-test="sv-more-convert"]').trigger('click')
    expect(w.find('[data-test="sv-more-menu"]').exists()).toBe(false)
    const body = w.find('[data-test="sv-convert-confirm"]').text()
    expect(body).toContain('12')
    expect(body).toContain('主题与条件将被移除')
  })

  it('navigates to the new album on success', async () => {
    convertFromSmartView.mockResolvedValue({ id: 'al-new' })
    const w = await mountDetail({ sv: { id: 's1', name: 'S', count: 12 } })
    await openConvertConfirm(w)
    await w.find('[data-test="sv-convert-ok"]').trigger('click')
    await flushPromises()
    expect(push).toHaveBeenCalledWith('/photos/albums/al-new')
  })

  it('keeps the confirmation open with an inline message when it fails', async () => {
    convertFromSmartView.mockRejectedValue(new Error('boom'))
    const w = await mountDetail({ sv: { id: 's1', name: 'S', count: 12 } })
    await openConvertConfirm(w)
    await w.find('[data-test="sv-convert-ok"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="sv-convert-confirm"]').exists()).toBe(true)
    expect(w.find('[data-test="sv-convert-error"]').text()).toContain('转换失败')
    expect(push).not.toHaveBeenCalledWith(expect.stringContaining('/photos/albums/'))
  })

  it('reuses the duplicate-name copy for a 409', async () => {
    convertFromSmartView.mockRejectedValue({ response: { status: 409 } })
    const w = await mountDetail({ sv: { id: 's1', name: 'S', count: 12 } })
    await openConvertConfirm(w)
    await w.find('[data-test="sv-convert-ok"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="sv-convert-error"]').text()).toContain('已存在')
  })

  it('one Escape closes the convert confirmation along with any other open overlay', async () => {
    // The existing invariant on this page: three independent ifs, never an early return.
    const w = await mountDetail({ sv: { id: 's1', name: 'S', count: 12 } })
    await openConvertConfirm(w)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(w.find('[data-test="sv-convert-confirm"]').exists()).toBe(false)
  })

  it('does not dismiss the confirmation mid-flight', async () => {
    let release: (v: unknown) => void = () => {}
    convertFromSmartView.mockReturnValue(new Promise((r) => { release = r }))
    const w = await mountDetail({ sv: { id: 's1', name: 'S', count: 12 } })
    await openConvertConfirm(w)
    await w.find('[data-test="sv-convert-ok"]').trigger('click')
    await w.find('[data-test="sv-convert-cancel"]').trigger('click')
    expect(w.find('[data-test="sv-convert-confirm"]').exists()).toBe(true)
    release({ id: 'al-new' })
  })
```

活动流测试追加：

```ts
  it('renders the converted-from-album event, with the locked-in count when available', () => {
    const w = mountFeed([{ id: '1', eventType: 'converted_from_album', detail: '', assetIds: ['a', 'b'], occurredAt: NOW }])
    expect(w.text()).toContain('锁定 2 张照片')
  })

  it('falls back to the count-free wording when the event carries no asset ids', () => {
    const w = mountFeed([{ id: '1', eventType: 'converted_from_album', detail: '', assetIds: [], occurredAt: NOW }])
    expect(w.text()).toContain('由相册转换而来')
    expect(w.text()).not.toContain('锁定')
  })

  it('still drops genuinely unknown event types', () => {
    const w = mountFeed([{ id: '1', eventType: 'no_such_thing', detail: '', assetIds: [], occurredAt: NOW }])
    expect(w.findAll('[data-test="sv-activity-row"]')).toHaveLength(0)
  })
```

- [ ] **Step 2: 跑测试确认失败**

- [ ] **Step 3: 加 7 个 i18n 键**

`photosSvConvertToAlbum`、`photosSvConvertToAlbumHint`、`photosSvConvertToAlbumTitle`、
`photosSvConvertToAlbumBody`、`photosSvConvertedToAlbum`、
`photosSvActConvertedFromAlbum`、`photosSvActConvertedFromAlbumN`。取值见总表。
失败文案复用 T7 已加的 `photosAlbumConvertFailed` 与既有 `photosAlbumNameExists`。

- [ ] **Step 4: 活动流两分支**

`SmartViewActivityFeed.vue`：`Kind` union 加 `'convertedFromAlbumN' | 'convertedFromAlbum'`，
`rows` 的 `switch` 加一个 case（放在 `renamed` 之后、`default` 之前）：

```ts
      // The backend records this when ConvertFromAlbum finishes; assetIds is the original
      // album's full membership, so the count is real when present. Absent is defensive
      // only -- keep the count-free wording rather than printing "0 photos locked in".
      case 'converted_from_album': {
        const n = (a.assetIds && a.assetIds.length) || 0
        out.push({ a, kind: n > 0 ? 'convertedFromAlbumN' : 'convertedFromAlbum', n })
        break
      }
```

模板里照该文件既有分支的形态加两行（**零 `v-html`**，这两句 Vue2 侧不含 `<b>`，
所以是纯文本插值，不需要 P7a 那套「主句键 + 加粗短语键」拆分）。

- [ ] **Step 5: 详情页菜单项 + 内联确认框**

菜单项插在 duplicate 之后、`<div class="sv-export-sep" />` **之前**（Vue2 diff 明写
「放在 Delete 分隔线上方，与 Rename/Duplicate 同组」），形态照该文件既有 `sv-export-item`：

```html
                  <button type="button" class="sv-export-item" data-test="sv-more-convert" @click="askConvertToAlbum">
                    <div class="sv-export-icon"> … album/plus svg … </div>
                    <div>
                      <div class="sv-export-title">{{ t('photosSvConvertToAlbum') }}</div>
                      <div class="sv-export-desc">{{ t('photosSvConvertToAlbumHint') }}</div>
                    </div>
                  </button>
```

确认框照该文件既有 `.sv-confirm-*` 整块复制（`:819-833`），改文案与 `data-test`，
**并加一行内联错误**：

```html
    <Transition name="sv-confirm">
    <div v-if="convertToAlbumOpen" class="sv-confirm-scrim" data-test="sv-convert-confirm" @click.self="closeConvertToAlbum">
      <div class="sv-confirm-panel">
        <div class="sv-confirm-icon"> … album svg … </div>
        <div class="sv-confirm-title">{{ t('photosSvConvertToAlbumTitle', { name: sv?.name }) }}</div>
        <div class="sv-confirm-body">{{ t('photosSvConvertToAlbumBody', { n: fmtNum(sv?.count ?? 0) }) }}</div>
        <div v-if="convertError" class="sv-confirm-error" data-test="sv-convert-error">{{ convertError }}</div>
        <div class="sv-confirm-foot">
          <button type="button" class="sv-confirm-cancel" data-test="sv-convert-cancel" :disabled="convertingToAlbum" @click="closeConvertToAlbum">{{ t('photosCancel') }}</button>
          <button type="button" class="sv-confirm-ok" data-test="sv-convert-ok" :disabled="convertingToAlbum" @click="doConvertToAlbum">
            {{ convertingToAlbum ? t('photosAlbumConverting') : t('photosSvConvertToAlbum') }}
          </button>
        </div>
      </div>
    </div>
    </Transition>
```

⚠ 提交按钮**不加** `.danger` —— 这不是破坏性删除，Vue2 用的也是 `trash-btn-cta`
（普通主行动）而非 danger 档。`.sv-confirm-error` 新增一条规则，颜色用 `--remove-fg`。

script：

```ts
const convertToAlbumOpen = ref(false)
const convertingToAlbum = ref(false)
const convertError = ref('')

function askConvertToAlbum(): void {
  moreOpen.value = false
  convertError.value = ''
  convertToAlbumOpen.value = true
}

function closeConvertToAlbum(): void {
  if (convertingToAlbum.value) return
  convertToAlbumOpen.value = false
}

async function doConvertToAlbum(): Promise<void> {
  const s = sv.value
  if (!s || convertingToAlbum.value) return
  convertingToAlbum.value = true
  convertError.value = ''
  try {
    const album = await albums.convertFromSmartView(s.id)
    convertToAlbumOpen.value = false
    toast.show(t('photosSvConvertedToAlbum'))
    // Vue2 :631-647 emits to its host, which closes the panel, refetches both lists and
    // opens the new album. Here the destination is a real route that loads the album
    // itself, and the smart view no longer exists server-side.
    void router.push('/photos/albums/' + String(album.id))
  } catch (e) {
    console.error('[photos-smartviews] convertToAlbum', e)
    convertError.value = isConflict(e) ? t('photosAlbumNameExists') : t('photosAlbumConvertFailed')
  } finally {
    convertingToAlbum.value = false
  }
}
```

⚠ **`anyOverlayOpen` 与 `onDocumentKeydown` 都要把 `convertToAlbumOpen` 加进去**
（该页硬约束：三个 `if` 各自独立、禁止提前 `return`；现在是四个）。
`onDocumentKeydown` 里那行走 `closeConvertToAlbum()` 而不是直接置 false ——
否则 Esc 能在请求在途时关掉弹窗，与 Cancel 的守卫不一致。

- [ ] **Step 6: 顺手清 P2a 挂账的中文注释**

`src/views/PhotosSmartViewDetail.vue` 约 `:1168-1173` 有一条 P2a 修复轮写下的**中文
模板注释**（P2a 台账 PARKED 项，明写「fold it into whichever task next edits that file」）。
本任务正在编辑该文件 ⇒ **翻成英文**，内容不变。先用
`grep -n "修复\|评审\|轮" src/views/PhotosSmartViewDetail.vue` 定位（行号会因本任务的
改动而漂移，不要照搬 1168）。

- [ ] **Step 7: 跑门 + 提交**

```bash
pnpm exec vitest run src/views/__tests__/PhotosSmartViewDetail.test.ts src/photos/components/__tests__/SmartViewActivityFeed.test.ts src/styles src/i18n/parity.test.ts
pnpm exec vue-tsc --noEmit
git add -A
git commit -m "feat(photos): let a smart album freeze into a regular one

The more menu gains the reverse of Task 7, grouped with rename and duplicate
rather than beside Delete, and its confirmation says all three consequences out
loud -- updates stop, the current members are fixed, the theme and conditions go
away. It is not dressed up as reversible.

Failure keeps the confirmation open with an inline message, matching the forward
direction. Escape routes through the same guard as Cancel, so an in-flight request
cannot be dismissed from the keyboard either; convertToAlbumOpen joins the page's
existing rule that one Escape closes every open overlay via independent ifs.

The activity feed learns converted_from_album. The backend records the original
album's full membership on that event, so the count is real when present; the
count-free wording is the defensive branch, not '0 photos locked in'.

Also translates the one Chinese template comment P2a parked for whichever task
next edited this file."
```

---

