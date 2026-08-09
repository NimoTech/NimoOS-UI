## Task 7: 相册 → 智能相册

**Files:**
- Create: `src/photos/components/AlbumConvertToSmartDialog.vue`
- Create: `src/photos/components/__tests__/AlbumConvertToSmartDialog.test.ts`
- Modify: `src/views/PhotosAlbumDetail.vue`
- Modify: `src/views/__tests__/PhotosAlbumDetail.test.ts`
- Modify: `src/i18n/zh_cn.photos.ts` · `src/i18n/en_us.photos.ts`（+6 键）

**Interfaces:**
- Consumes: `smartViewsStore.convertFromAlbum`（T1）、`inferChips`（`../util/smartViewSuggest`）、
  `PhotosThreshSlider`（props `{ value, min?, max? }`，emit `input(v: number)`）、
  T6 的 `convertOpen` ref
- Produces:
  - `AlbumConvertToSmartDialog` props:
    `defineProps<{ open: boolean; albumId: string | number; albumName: string; albumCount: number }>()`
  - emits: `(e: 'update:open', v: boolean)` · `(e: 'converted', sv: SmartView)`

**回源**：`939a7d3a:PhotosAlbumDetail.vue:142-206`（弹窗模板）、`:294-298`（`convertChips`）、
`:310-345`（`openConvertModal` / `closeConvert` / `confirmConvert`）。

---

- [ ] **Step 1: 写失败测试（弹窗）**

```ts
  it('previews inferred conditions from the description, live', async () => {
    const w = mountConvert({ open: true, albumId: 'a1', albumName: 'A', albumCount: 12 })
    expect(w.find('[data-test="convert-chips"]').exists()).toBe(false)
    await w.find('[data-test="convert-desc"]').setValue('sunsets in tokyo')
    expect(w.findAll('[data-test="convert-chip"]').length).toBeGreaterThan(0)
  })

  it('blocks submit until a description is present', async () => {
    const w = mountConvert({ open: true, albumId: 'a1', albumName: 'A', albumCount: 12 })
    expect(w.find('[data-test="convert-submit"]').attributes('disabled')).toBeDefined()
    await w.find('[data-test="convert-desc"]').setValue('sunsets')
    expect(w.find('[data-test="convert-submit"]').attributes('disabled')).toBeUndefined()
    // Whitespace is not a description.
    await w.find('[data-test="convert-desc"]').setValue('   ')
    expect(w.find('[data-test="convert-submit"]').attributes('disabled')).toBeDefined()
  })

  it('sends only description and threshold, letting the backend parse the conditions', async () => {
    const w = mountConvert({ open: true, albumId: 'a1', albumName: 'A', albumCount: 12 })
    await w.find('[data-test="convert-desc"]').setValue('  sunsets  ')
    await w.find('[data-test="convert-submit"]').trigger('click')
    expect(convertFromAlbum).toHaveBeenCalledWith('a1', { description: 'sunsets', threshold: 80 })
  })

  it('emits the new smart view and closes on success', async () => {
    convertFromAlbum.mockResolvedValue({ id: 'sv-new', name: 'A' })
    const w = mountConvert({ open: true, albumId: 'a1', albumName: 'A', albumCount: 12 })
    await w.find('[data-test="convert-desc"]').setValue('sunsets')
    await w.find('[data-test="convert-submit"]').trigger('click')
    await flushPromises()
    expect(w.emitted('converted')?.[0]?.[0]).toMatchObject({ id: 'sv-new' })
    expect(w.emitted('update:open')?.at(-1)).toEqual([false])
  })

  it('stays open and reports the failure inline so the user can retry', async () => {
    convertFromAlbum.mockRejectedValue(new Error('boom'))
    const w = mountConvert({ open: true, albumId: 'a1', albumName: 'A', albumCount: 12 })
    await w.find('[data-test="convert-desc"]').setValue('sunsets')
    await w.find('[data-test="convert-submit"]').trigger('click')
    await flushPromises()
    expect(w.emitted('update:open')).toBeUndefined()
    expect(w.find('[data-test="convert-error"]').text()).toContain('转换失败')
    // Retry must be possible immediately -- the busy flag has to be cleared.
    expect(w.find('[data-test="convert-submit"]').attributes('disabled')).toBeUndefined()
  })

  it('reuses the existing duplicate-name copy for a 409', async () => {
    convertFromAlbum.mockRejectedValue({ response: { status: 409 } })
    const w = mountConvert({ open: true, albumId: 'a1', albumName: 'A', albumCount: 12 })
    await w.find('[data-test="convert-desc"]').setValue('sunsets')
    await w.find('[data-test="convert-submit"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="convert-error"]').text()).toContain('已存在')
  })

  it('refuses to close while the request is in flight', async () => {
    // Vue2 :317-320 guards closeConvert the same way.
    let release: (v: unknown) => void = () => {}
    convertFromAlbum.mockReturnValue(new Promise((r) => { release = r }))
    const w = mountConvert({ open: true, albumId: 'a1', albumName: 'A', albumCount: 12 })
    await w.find('[data-test="convert-desc"]').setValue('sunsets')
    await w.find('[data-test="convert-submit"]').trigger('click')
    await w.find('[data-test="convert-cancel"]').trigger('click')
    expect(w.emitted('update:open')).toBeUndefined()
    release({ id: 'sv-new' })
  })

  it('resets the draft each time it opens', async () => {
    // Persistent mount + prop-driven visibility: reset belongs in watch(open), not
    // onMounted (this area's recurring trap).
    const w = mountConvert({ open: false, albumId: 'a1', albumName: 'A', albumCount: 12 })
    await w.setProps({ open: true })
    await w.find('[data-test="convert-desc"]').setValue('sunsets')
    await w.setProps({ open: false })
    await w.setProps({ open: true })
    expect((w.find('[data-test="convert-desc"]').element as HTMLTextAreaElement).value).toBe('')
  })
```

- [ ] **Step 2: 跑测试确认失败**

- [ ] **Step 3: 加 6 个 i18n 键**

`photosAlbumConvertSuggestHint`、`photosAlbumConvertLockHint`、`photosAlbumConverting`、
`photosAlbumConvertedToSmart`、`photosAlbumConvertFailed`，取值见总表。
409 复用**既有** `photosAlbumNameExists`（不新增）。第 6 个是 `photosAlbumConvertToSmart`
—— T6 已加，本任务只是消费。**核一遍别重复加。**

- [ ] **Step 4: 实现 `AlbumConvertToSmartDialog.vue`**

结构照 `SmartViewCreateDialog.vue` 的 `.sv-modal-scrim` / `.sv-modal` / `.sv-modal-head` /
`.sv-modal-body`（**单列**：`grid-template-columns: 1fr`，本弹窗没有预览侧栏）/
`.sv-modal-foot` 五段；样式规则从该文件逐条复制（scoped 不跨组件）。要点：

```ts
const props = defineProps<{ open: boolean; albumId: string | number; albumName: string; albumCount: number }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void; (e: 'converted', sv: SmartView): void }>()

const desc = ref('')
const thresh = ref(80)
const converting = ref(false)
const errorText = ref('')

// Vue2 :296-298. Read-only preview: what actually takes effect is whatever the backend's
// svparser makes of `description`, so these chips are not editable and are not sent.
const chips = computed(() => inferChips(desc.value))
const canSubmit = computed(() => desc.value.trim().length > 0 && !converting.value)

// Persistent mount + prop-driven visibility, so the reset lives here rather than in
// onMounted -- this area's third repeat of that trap (see SmartViewCreateDialog's header).
watch(() => props.open, (isOpen) => {
  if (!isOpen) return
  desc.value = ''
  thresh.value = 80
  errorText.value = ''
  converting.value = false
})

function close(): void {
  // Vue2 :317-320: no dismissal mid-flight, or the user loses track of whether it landed.
  if (converting.value) return
  emit('update:open', false)
}

async function submit(): Promise<void> {
  if (!canSubmit.value) return
  converting.value = true
  errorText.value = ''
  try {
    const sv = await smartViews.convertFromAlbum(props.albumId, {
      description: desc.value.trim(),
      threshold: thresh.value,
    })
    emit('converted', sv)
    emit('update:open', false)
    toast.show(t('photosAlbumConvertedToSmart'))
  } catch (e) {
    console.error('[album-convert-to-smart] submit', e)
    // Inline, not a toast: this answers the button the user just pressed, so it belongs
    // next to it and must not time out. A 409 reuses the album pages' existing wording
    // rather than adding a second phrasing of the same thing (Vue2's final review round
    // made the same call).
    errorText.value = isConflict(e) ? t('photosAlbumNameExists') : t('photosAlbumConvertFailed')
  } finally {
    // Cleared even on failure -- the dialog stays open precisely so retry is one click.
    converting.value = false
  }
}
```

模板要点（文案键对应总表）：标题 `photosAlbumConvertToSmart` + 副标题
`photosAlbumConvertToSmartHint`；描述 textarea 复用 `photosSvNimoMatch` /
`photosSvDescribePlainEnglishConditions` / `photosSvSunsetsSaraOurTokyo` 三个既有键；
chips 段标题 `photosAlbumConvertSuggestHint`（`v-if="chips.length"`）；阈值段用
`<PhotosThreshSlider :value="thresh" @input="thresh = $event" />` + `photosSvQualityThreshold`
+ `≥ {{ thresh }}%`；锁定提示 `photosAlbumConvertLockHint`（`{ n: albumCount }`）；
脚部 Cancel（`photosCancel`，`data-test="convert-cancel"`）+ 提交（`data-test="convert-submit"`，
文案 `converting ? photosAlbumConverting : photosAlbumConvertToSmart`）；
错误行 `<div v-if="errorText" class="convert-error" data-test="convert-error">`，
颜色用 `--remove-fg` token。

Esc 处理照 `SmartViewCreateDialog` 的 `watch(open)` 挂/摘 document 监听形态，
**且 `converting` 时 Esc 也不关**（走同一个 `close()`）。

- [ ] **Step 5: 跑弹窗测试确认通过**

- [ ] **Step 6: 详情页接线 + 测试**

`PhotosAlbumDetail.vue` 挂弹窗并处理成功：

```html
  <AlbumConvertToSmartDialog
    v-if="album"
    :open="convertOpen"
    :album-id="album.id"
    :album-name="album.title"
    :album-count="album.count"
    @update:open="convertOpen = $event"
    @converted="onConverted"
  />
```

```ts
// Vue2 :721-743 closes the album detail, refetches both lists, then opens the new smart
// view's detail. Here the navigation does all of that: the source album no longer exists
// server-side, and the destination route loads the new smart view itself. No refetch, no
// nextTick dance -- Vue2 needed those because two mergeQuery calls in one tick raced over
// the same query snapshot, and New-UI has no query-based deep link here at all.
function onConverted(sv: SmartView): void {
  void router.push('/photos/smart-views/' + sv.id)
}
```

详情页测试追加：

```ts
  it('navigates to the new smart view once the conversion lands', async () => {
    const w = await mountDetail({ album: { id: 'a1', name: 'A' }, assets: [] })
    w.findComponent(AlbumConvertToSmartDialog).vm.$emit('converted', { id: 'sv-new' })
    await nextTick()
    expect(push).toHaveBeenCalledWith('/photos/smart-views/sv-new')
  })
```

- [ ] **Step 7: 登记新测试文件（若需要）+ 跑门 + 提交**

`src/photos/components/__tests__/` 在 `oss/manifest.mjs` 里由整目录 `'src/photos'` 覆盖，
预期**无需登记**。跑一次导出核实：

```bash
pnpm exec vitest run src/photos/components/__tests__/AlbumConvertToSmartDialog.test.ts src/views/__tests__/PhotosAlbumDetail.test.ts src/styles src/i18n/parity.test.ts
pnpm exec vue-tsc --noEmit
node oss/export.mjs --out /tmp/claude-1000/-home-nimo-NimoTech/4bd5688e-62a4-4e15-b431-6eedc1501e05/scratchpad/oss-t7 --no-commit --allow-dirty-oss
git add -A
git commit -m "feat(photos): let a manual album become a smart album

The more menu's Convert entry opens a dialog that takes a plain-language theme and
a quality threshold, previews the conditions inferred from the theme, and says
plainly that the current members stay locked in. Only the description and the
threshold are sent: the conditions that actually take effect are whatever the
backend's parser makes of the description, the same path Create takes, so
presenting the preview as a promise would be a lie.

Failure keeps the dialog open with an inline message and the button re-enabled,
because the answer belongs next to the button that was just pressed and retry
should be one click. A name collision reuses the album pages' existing wording.

Success simply navigates to the new smart view. Vue 2 also refetched both lists
and stepped through nextTick, but it had to: its list page stayed mounted and two
query rewrites in one tick raced over the same snapshot. Here the source album is
gone server-side and the destination route loads the smart view itself."
```

---

