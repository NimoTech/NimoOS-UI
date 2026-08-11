## Task 4: 创建融合（嵌入式智能创建表单） ← 逐任务评审

**Files:**
- Modify: `src/photos/components/SmartViewCreateDialog.vue`
- Modify: `src/views/PhotosAlbums.vue`
- Modify: `src/photos/components/__tests__/SmartViewCreateDialog.test.ts`（追加）
- Modify: `src/views/__tests__/PhotosAlbums.test.ts`（追加）
- Modify: `src/i18n/zh_cn.photos.ts` · `src/i18n/en_us.photos.ts`（+4 键）

**Interfaces:**
- Consumes: T3 的 `aiSmartViewOff` / `createOpen` / `newAlbumTitle` / `newAlbumSource`
- Produces:
  - `SmartViewCreateDialog` props 变为
    `withDefaults(defineProps<{ open: boolean; embedded?: boolean; initialName?: string }>(), { embedded: false, initialName: '' })`
  - `PhotosAlbums.vue` 的 `SourceId` 增加 `'nimo'`

**回源**：`939a7d3a:src/views/Photos/PhotosSmartAlbumCreate.vue:1-30`（嵌入模式的两层
类名与理由）、`:232-241`（两个 prop）、`:271-277`（`effectiveName` / `canSubmit`）、
`:325`（`onScrimClick`）；`939a7d3a:PhotosAlbumsView.vue:147-225`（宿主面板）、
`:329-336`（四个 source）、`:519-530`（`selectSource` / `confirmCreate` 短路）、
`:575-578`（`onSmartAlbumCreated`）。

---

- [ ] **Step 1: 核对 `Let Nimo draft it` 两句的 zh 取值（只读）**

```bash
git -C /home/nimo/NimoTech/NimoOS-UI show 939a7d3a:src/assets/lang/zh_CN.json \
  | grep -n "Let Nimo draft it\|Describe the theme, let AI fill it in"
```

把实际值写进任务报告，并用它替换总表里 `photosSvLetNimoDraft` /
`photosSvLetNimoDraftHint` 的猜测值。**总表那两行是待核值，不是权威。**

- [ ] **Step 2: 写失败测试（弹窗嵌入模式）**

```ts
  it('embedded mode drops its own scrim, header and name field', async () => {
    const w = mountDialog({ open: true, embedded: true, initialName: 'Trip' })
    expect(w.find('[data-test="sv-modal-scrim"]').exists()).toBe(false)
    expect(w.find('[data-test="sv-close-btn"]').exists()).toBe(false)
    expect(w.find('[data-test="sv-name-input"]').exists()).toBe(false)
  })

  it('embedded mode submits the host-supplied name, live as the host edits it', async () => {
    const w = mountDialog({ open: true, embedded: true, initialName: '' })
    // Empty host name => cannot submit even with a description present.
    await w.find('[data-test="sv-desc-textarea"]').setValue('sunsets')
    expect(w.find('[data-test="sv-confirm-btn"]').attributes('disabled')).toBeDefined()
    // The host field is the single source of truth, not a copy seeded on open, so a name
    // typed after picking the nimo option still arrives.
    await w.setProps({ initialName: 'Trip' })
    expect(w.find('[data-test="sv-confirm-btn"]').attributes('disabled')).toBeUndefined()
    await w.find('[data-test="sv-confirm-btn"]').trigger('click')
    expect(createSmartView).toHaveBeenCalledWith(expect.objectContaining({ name: 'Trip' }))
  })

  it('standalone mode still owns its scrim, header and name field', () => {
    const w = mountDialog({ open: true })
    expect(w.find('[data-test="sv-modal-scrim"]').exists()).toBe(true)
    expect(w.find('[data-test="sv-name-input"]').exists()).toBe(true)
  })

  it('embedded mode does not close on a click inside its own root', async () => {
    // The host panel owns the scrim; a stray self-click here must not shut the panel.
    const w = mountDialog({ open: true, embedded: true, initialName: 'Trip' })
    await w.find('[data-test="sv-embed-host"]').trigger('click')
    expect(w.emitted('update:open')).toBeUndefined()
  })

  it('embedded mode leaves Escape to the host', async () => {
    const w = mountDialog({ open: true, embedded: true, initialName: 'Trip' })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(w.emitted('update:open')).toBeUndefined()
  })
```

- [ ] **Step 3: 跑测试确认失败，然后实现弹窗侧**

props/emits：

```ts
const props = withDefaults(defineProps<{
  open: boolean
  // Vue2 939a7d3a:PhotosSmartAlbumCreate.vue:232-240. Embedded mode is what the Albums
  // page's "Let Nimo draft it" option renders in place of its own footer.
  embedded?: boolean
  initialName?: string
}>(), { embedded: false, initialName: '' })
```

名字取值（Vue2 `:271-273`）：

```ts
// Embedded mode reads the host's Album name field live rather than copying it into the
// draft on open. Vue2 :237-239 explains why: a one-time seed leaves the user stuck if
// they pick the nimo option before typing a name.
const effectiveName = computed(() => (props.embedded ? props.initialName : draft.name).trim())
```

`canSubmit` 与 `confirm` 里的 `draft.name.trim()` 全部换成 `effectiveName.value`。

Esc / 关闭（Vue2 `:325`）：

```ts
function close(): void {
  // In embedded mode the host panel owns dismissal -- it has the scrim, the Cancel
  // button and the Escape handler. Emitting from here would close the smart form while
  // leaving the host panel open around an empty hole.
  if (props.embedded) {
    emit('close')
    return
  }
  emit('update:open', false)
}
```

⚠ 这会引出一个契约问题：嵌入态"取消"要通知宿主关整个面板，而 `update:open` 语义是
"关我自己"。**加一个 `close` emit**：

```ts
const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'created', id: string): void
  // Embedded mode only: the host closes its whole panel. Vue2 :322 emits the same event.
  (e: 'close'): void
}>()
```

`watch(() => props.open)` 里那段 `document.addEventListener('keydown', …)` 改成
**只在非嵌入态挂**：

```ts
      if (!props.embedded) document.addEventListener('keydown', onDocumentKeydown)
```

（`onUnmounted` / `else` 分支里的 `removeEventListener` 保持无条件调用 —— 摘一个没挂过的
监听是 no-op，加条件反而会在 prop 中途变化时漏摘。）

`confirm` 成功后：嵌入态 emit `created` + `close`；独立态维持现状。

template 两层根节点（Vue2 `:20-21`，含 `display:contents` 的理由）：

```html
  <Transition name="sv-modal">
    <div
      v-if="open"
      :class="embedded ? 'sv-embed-host' : 'sv-modal-scrim'"
      :data-test="embedded ? 'sv-embed-host' : 'sv-modal-scrim'"
      @click.self="onRootClick"
    >
      <div class="sv-modal" :class="{ 'sv-modal-embedded': embedded }" :role="embedded ? undefined : 'dialog'" :aria-label="embedded ? undefined : t('photosSvNewSmartView')">
        <div v-if="!embedded" class="sv-modal-head"> … 原样 … </div>
```

名字字段整段包 `v-if="!embedded"`；提交按钮文案嵌入态用 `photosSvCreateSmartAlbum`、
独立态维持 `photosSvCreateSmartView`。

```ts
function onRootClick(): void {
  if (!props.embedded) close()
}
```

样式（照 Vue2 `photos-smartview.scss` 那两条新规则，理由注释一并搬）：

```css
/* Embedded mode: this wrapper removes itself from the box model so the host panel's
   flex column hands the remaining height straight to .sv-modal, instead of this
   style-less div being sized by its content and then clipped. Vue2 photos-smartview.scss
   .sv-modal-embed-host. */
.sv-embed-host { display: contents; }
/* Strip only the standalone chrome (fixed width, radius, border, shadow, viewport-relative
   max-height) -- the host already provides those. The flex column and overflow:hidden stay,
   because .sv-modal-body / .sv-modal-form / .sv-modal-side rely on them for their own
   scrolling; without flex:1;min-height:0 a short viewport clips the submit button out of
   reach. */
.sv-modal.sv-modal-embedded {
  width: auto; max-width: none; max-height: none;
  flex: 1 1 auto; min-height: 0;
  background: transparent; border: 0; border-radius: 0; box-shadow: none;
}
```

- [ ] **Step 4: 跑弹窗测试确认通过**

```bash
pnpm exec vitest run src/photos/components/__tests__/SmartViewCreateDialog.test.ts
```

- [ ] **Step 5: 加 4 个 i18n 键**

`photosSvCreateSmartAlbum` / `photosSvLetNimoDraft` / `photosSvLetNimoDraftHint` /
`photosSvSmartViewsOffCreateHint`，取值见总表（前两条用 Step 1 核到的真值）。

- [ ] **Step 6: 写失败测试（宿主侧）**

```ts
  it('offers a fourth fill option that drafts a smart album', async () => {
    const w = await mountAlbums({ albums: [] })
    await w.find('[data-test="albums-new-btn"]').trigger('click')
    expect(w.find('[data-test="source-nimo"]').exists()).toBe(true)
  })

  it('disables the nimo option and explains why when smart views are off', async () => {
    const w = await mountAlbums({ albums: [], aiFeatures: { smartview: false } })
    await w.find('[data-test="albums-new-btn"]').trigger('click')
    const opt = w.find('[data-test="source-nimo"]')
    expect(opt.attributes('disabled')).toBeDefined()
    expect(opt.attributes('title')).toContain('智能视图已关闭')
    await opt.trigger('click')
    expect(w.find('[data-test="sv-embed-host"]').exists()).toBe(false)
  })

  it('swaps its own footer for the embedded smart form when nimo is picked', async () => {
    const w = await mountAlbums({ albums: [] })
    await w.find('[data-test="albums-new-btn"]').trigger('click')
    await w.find('[data-test="source-nimo"]').trigger('click')
    expect(w.find('[data-test="sv-embed-host"]').exists()).toBe(true)
    // Two submit entry points side by side would be ambiguous, so the host footer goes.
    expect(w.find('[data-test="albums-confirm-create"]').exists()).toBe(false)
  })

  it('never creates an empty manual album when nimo is the picked source', async () => {
    // Vue2 :525-530 short-circuits here; the old behaviour created a throwaway album first.
    const w = await mountAlbums({ albums: [] })
    await w.find('[data-test="albums-new-btn"]').trigger('click')
    await w.find('[data-test="albums-name-input"]').setValue('Trip')
    await w.find('[data-test="source-nimo"]').trigger('click')
    await w.find('[data-test="albums-name-input"]').trigger('keydown.enter')
    expect(createAlbum).not.toHaveBeenCalled()
  })

  it('closes the whole panel once the embedded form reports success', async () => {
    const w = await mountAlbums({ albums: [] })
    await w.find('[data-test="albums-new-btn"]').trigger('click')
    await w.find('[data-test="source-nimo"]').trigger('click')
    w.findComponent(SmartViewCreateDialog).vm.$emit('created', 'sv-new')
    await nextTick()
    expect(w.find('[data-test="albums-create-modal"]').exists()).toBe(false)
    // Vue2 :575-578 stays on the list -- the new card is already there because the store
    // unshifted it. No navigation.
    expect(push).not.toHaveBeenCalledWith('/photos/smart-views/sv-new')
  })
```

- [ ] **Step 7: 实现宿主侧**

- `SourceId` 加 `'nimo'`；`sourceOptions` 加第 4 项（`label`/`hint` 用新键）
- 加 `nimoSourceDisabled`（= `aiSmartViewOff`，**不要**再写一个同义 computed，直接复用）
- source 按钮从 `@click="newAlbumSource = s.id"` 改成 `@click="selectSource(s)"`，并加
  `:disabled` 与 `:title`：

```ts
// Vue2 :521-524: clicking the disabled option is a no-op, the same defensive guard the
// old standalone New Smart Album button had.
function selectSource(s: { id: SourceId }): void {
  if (s.id === 'nimo' && nimoSourceDisabled.value) return
  newAlbumSource.value = s.id
}
```

- `confirmCreate` 顶部短路：

```ts
  // Vue2 :525-530: with nimo picked, the panel body *is* the smart form and it owns its
  // own submit. Falling through here used to create a throwaway empty manual album first.
  if (newAlbumSource.value === 'nimo') return
```

- 模态根节点加宽类：`:class="{ 'albums-modal-wide': newAlbumSource === 'nimo' }"`
- 面板脚 `v-if="newAlbumSource !== 'nimo'"`；其后挂嵌入表单：

```html
        <SmartViewCreateDialog
          v-if="newAlbumSource === 'nimo'"
          :open="true"
          embedded
          :initial-name="newAlbumTitle"
          @created="onSmartAlbumCreated"
          @close="closeCreate"
        />
```

```ts
function onSmartAlbumCreated(): void {
  // Vue2 :575-578: close the shared panel and stay on the list. The card is already
  // visible -- smartViews.createSmartView unshifted it -- so there is nothing to insert
  // and nowhere to navigate.
  closeCreate()
}
```

⚠ **把常驻挂载的那个 `<SmartViewCreateDialog>` 留在原处不要动** —— 本页原本没有它；
只新增这一个嵌入实例。它由 `v-if` 控制，因此**每次选中 nimo 都是全新挂载**，
`watch(open, …, { immediate: true })` 会在挂载时跑一次重置 —— 这正是需要的行为。

- 样式（Vue2 `photos.scss` 的 `.albums-modal.albums-modal-wide`）：

```css
/* The embedded form is a two-column layout (body + preview rail); 440px cannot hold it.
   Widen to the standalone dialog's own width and become a flex column so the embedded
   .sv-modal's flex:1 has something to fill. */
.albums-modal.albums-modal-wide {
  width: min(820px, 100%); max-height: calc(100vh - 80px);
  display: flex; flex-direction: column; overflow: hidden;
}
.albums-source-item:disabled { opacity: 0.5; cursor: not-allowed; }
```

- [ ] **Step 8: 跑测试 + 类型检查 + color-guard，然后提交**

```bash
pnpm exec vitest run src/views/__tests__/PhotosAlbums.test.ts src/photos/components/__tests__/SmartViewCreateDialog.test.ts src/styles src/i18n/parity.test.ts
pnpm exec vue-tsc --noEmit
git add -A
git commit -m "feat(photos): fold smart-album creation into the New album panel

Picking 'Let Nimo draft it' now swaps the panel body for the smart-view form
instead of opening a second modal, and the host's own footer hides so there is
only ever one submit button on screen.

The embedded form reads the host's name field live rather than copying it once on
open: a user who picks the nimo option before typing a name would otherwise have
no way to supply one.

Escape and the scrim stay with the host in embedded mode. The dialog owning them
too would tear down the smart form while leaving the host panel open around an
empty hole.

confirmCreate short-circuits for the nimo source -- the old fall-through created
a throwaway empty album before handing off."
```

---

