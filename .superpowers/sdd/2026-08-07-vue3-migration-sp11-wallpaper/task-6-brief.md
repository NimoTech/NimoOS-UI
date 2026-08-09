### Task 6: 弹窗接上传与「从 NAS 选择」

**Files:**
- Modify: `src/components/WallpaperDialog.vue`(把 `<slot name="sources" />` 换成真实两个入口 + NAS 子视图)
- Modify: `src/settings/panels/account/NasImagePicker.vue:129`(`pick` 载荷改成 `{ path, src }`)
- Modify: `src/settings/panels/AccountPanel.vue:100`(唯一调用点跟着改)
- Modify: `src/components/WallpaperDialog.test.ts`(追加用例)
- Modify: `src/settings/panels/AccountPanel.test.ts`(既有「从 NAS 选中图片」那条用例的 emit 载荷跟着改)
- Modify: `src/settings/panels/account/OwnerCard.test.ts`(若断言了 pick 载荷则同改;只断言 `choose-from-nas` 的话不用动)

**Interfaces:**
- Consumes: Task 4 的 `wp.uploadAndPreview`;`NasImagePicker` 的新 `pick` 载荷
- Produces: `NasImagePicker` 的 `pick` 事件签名变为 `[{ path: string; src: string }]`

- [ ] **Step 1: 改 `NasImagePicker` 的 emit 契约**

`src/settings/panels/account/NasImagePicker.vue` —— 声明处:
```ts
// SP11: the payload carries both halves because the two consumers need different
// ones -- the avatar cropper wants a displayable URL, the wallpaper picker needs
// the on-disk NAS path to hand to PUT /users/current/image/wallpaper.
const emit = defineEmits<{ pick: [{ path: string; src: string }] }>()
```
`:129`:
```ts
  else emit('pick', { path: item.path, src: service.image.imageUrl(item.path, 'original') })
```

`src/settings/panels/AccountPanel.vue:100`:
```ts
function onNasPick(picked: { path: string; src: string }) {
  // NAS picks are /v1/image URLs, not objectURLs, so no revoke is needed (second arg false).
  setPickedImage(picked.src, false)
  goto(4)
}
```

- [ ] **Step 2: 跑既有测试,看它红在哪**

Run: `pnpm vitest run src/settings/panels/AccountPanel.test.ts src/settings/panels/account`
Expected: 「从 NAS 选中图片 → 进 state 4」那条 FAIL(它 emit 的还是裸字符串)。按新载荷改测试里的 `emit('pick', …)` 调用,再跑至全绿。这是**契约变更驱动的测试更新**,不是放宽断言。

- [ ] **Step 3: 写弹窗新用例** —— 追加到 `src/components/WallpaperDialog.test.ts`:

```ts
describe('WallpaperDialog sources', () => {
  it('rejects an oversized upload inline without hitting the network', async () => {
    const w = mountOpen()
    const input = w.find('[data-test="wp-file"]')
    const big = new File([new Uint8Array(1)], 'big.jpg')
    Object.defineProperty(big, 'size', { value: 10 * 1024 * 1024 + 1 })
    Object.defineProperty(input.element, 'files', { value: [big] })
    await input.trigger('change')
    await flushPromises()
    expect(w.find('[data-test="wp-error"]').text()).toBe('图片不能超过 10 MB')
  })

  it('a successful upload previews the uploaded image without persisting', async () => {
    const w = mountOpen()
    const input = w.find('[data-test="wp-file"]')
    const small = new File([new Uint8Array([1])], 'a.jpg')
    Object.defineProperty(input.element, 'files', { value: [small] })
    await input.trigger('change')
    await flushPromises()
    expect(useWallpaperStore().record).toMatchObject({ kind: 'image', path: '/d/1/wallpaper.jpg' })
    expect(setCustomStorage).not.toHaveBeenCalled()
  })

  it('the nas button swaps in the picker, and a pick previews then returns to the grid', async () => {
    const w = mountOpen()
    await w.find('[data-test="wp-nas"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="wp-nas-picker"]').exists()).toBe(true)

    await w.findComponent({ name: 'NasImagePicker' })
      .vm.$emit('pick', { path: '/DATA/Gallery/a.png', src: '/v1/image?path=/DATA/Gallery/a.png' })
    await flushPromises()
    expect(useWallpaperStore().record).toMatchObject({ kind: 'image', path: '/d/1/wallpaper.png' })
    expect(w.find('[data-test="wp-nas-picker"]').exists()).toBe(false)
    expect(w.find('[data-test="wp-preset-w01"]').exists()).toBe(true)
  })
})
```

- [ ] **Step 4: 跑测试确认失败**

Run: `pnpm vitest run src/components/WallpaperDialog.test.ts`
Expected: 新三条 FAIL(`wp-file` / `wp-nas-picker` 不存在)。

- [ ] **Step 5: 实现两个来源入口** —— 把 `WallpaperDialog.vue` 里的 `<div class="wp-actions"><slot name="sources" /></div>` 替换为:

```vue
        <div v-if="!nasOpen" class="wp-actions">
          <button type="button" class="bar-btn" data-test="wp-upload" :disabled="wp.busy"
            @click="fileEl?.click()">{{ t('wpUpload') }}</button>
          <!-- Hidden native input rather than a drop zone: mirrors Vue2's single
               "pick a file" affordance, and needs no new dependency. -->
          <input ref="fileEl" class="wp-file" type="file" data-test="wp-file"
            accept="image/png,image/jpeg,image/bmp,image/gif,image/svg+xml" @change="onFile" />
          <button type="button" class="bar-btn" data-test="wp-nas"
            @click="nasOpen = true">{{ t('wpFromNas') }}</button>
        </div>
        <div v-else class="wp-nas" data-test="wp-nas-picker">
          <NasImagePicker @pick="onNasPick" />
        </div>
```

script 段补:
```ts
// Cross-area import, registered in spec section 4.5: NasImagePicker stays under
// settings/ because it depends on settings.css, and dragging that stylesheet into
// the global bundle would cost more than this one import.
import NasImagePicker from '../settings/panels/account/NasImagePicker.vue'

const fileEl = ref<HTMLInputElement | null>(null)
const nasOpen = ref(false)

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  error.value = ''
  try {
    await wp.uploadAndPreview(file)
  } catch (err) {
    // The size check throws before any request; anything else is a real upload failure.
    error.value = /too large/i.test(String(err)) ? t('wpTooLarge') : t('wpUploadFailed')
  } finally {
    input.value = ''   // allow re-picking the same file after a failure
  }
}

async function onNasPick(picked: { path: string; src: string }) {
  error.value = ''
  try {
    await wp.setFromNasPath(picked.path)
    nasOpen.value = false
  } catch (err) {
    // The backend caps this path at 10 MB and reports it as HTTP 200 + success!=200;
    // show its message rather than a generic one.
    error.value = String((err as Error)?.message || t('wpUploadFailed'))
  }
}
```

样式补:
```css
.wp-file { display: none; }
.wp-nas { max-height: 46vh; overflow: auto; }
```

> **注意** `setFromNasPath` 会**立即落服务端**(它同时服务文件区右键那条无弹窗路径)。在弹窗里这意味着从 NAS 选图不需要再点「应用」—— 这是刻意的:图已经被后端拷进用户目录了,回滚也删不掉它,再让「取消」假装能撤销是骗人。**在 `onNasPick` 成功后调 `wp.beginPreview()` 重置快照**,这样随后的「取消」不会把已落盘的选择又回滚掉。

- [ ] **Step 6: 跑测试确认通过**

Run: `pnpm vitest run src/components/WallpaperDialog.test.ts src/settings && pnpm vue-tsc --noEmit`
Expected: 全绿 + exit 0。

- [ ] **Step 7: Commit**

```bash
git add src/components/WallpaperDialog.vue src/components/WallpaperDialog.test.ts src/settings
git commit -o src/components/WallpaperDialog.vue src/components/WallpaperDialog.test.ts src/settings -m "feat(wallpaper): wire upload and choose-from-NAS into the picker

NasImagePicker now emits both the on-disk path and a displayable URL, because
the wallpaper flow needs the path for the backend copy while the avatar cropper
needs the URL. A NAS pick persists immediately and resets the rollback
snapshot: the backend has already copied the file, so letting Cancel pretend to
undo it would be a lie.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

