import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, DOMWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../i18n/zh_cn'
import zhSp9 from '../i18n/zh_cn.sp9'

const setCustomStorage = vi.fn(async () => undefined)
// Explicit function-type generic (see stores/wallpaper.test.ts precedent): the
// M2 test below needs to override this per-call with a promise it controls
// the resolution of, which vi.fn(async () => ...) doesn't support typing for.
const uploadImage = vi.fn<(key: string, file: File) => Promise<{ path: string; file_name: string; online_path: string }>>()
  .mockResolvedValue({ path: '/d/1/wallpaper.jpg', file_name: 'wallpaper.jpg', online_path: 'x' })
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    users: {
      getCustomStorage: async () => '',
      setCustomStorage: (...a: unknown[]) => setCustomStorage(...(a as [])),
      uploadImage: (...a: unknown[]) => uploadImage(...(a as [string, File])),
      setImageFromPath: async () => ({ path: '/d/1/wallpaper.png', file_name: 'wallpaper.png', online_path: 'x' }),
    },
    image: { imageUrl: (p: string) => `/v1/image?path=${p}` },
    storage: { list: async () => [] },
    raid: { list: async () => [] },
    folder: { getList: async () => ({ items: [] }) },
  },
}))

import WallpaperDialog from './WallpaperDialog.vue'
import { useWallpaperStore } from '../stores/wallpaper'
import { useThemeStore } from '../stores/theme'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })

// This component builds its sheet on reka-ui's DialogRoot/DialogPortal (see
// WallpaperDialog.vue header comment for why it does not reuse the shared
// Dialog.vue wrapper), which Teleports DialogContent to document.body. That
// puts it outside the subtree `mount()` returns, so `wrapper.find(...)` alone
// never sees it -- the same gap already documented in UpdateDialog.test.ts /
// DeviceInfoDialog.test.ts / ShareLinkDialog.test.ts. We attach to
// document.body and query through a DOMWrapper on it instead.
//
// Second, undeclared-in-the-brief adaptation: reka-ui's DialogPortal/DialogContent
// only teleport their content into document.body on the microtask after mount,
// not synchronously -- the same behaviour KvmDialog.test.ts and
// components/ui/Dialog.test.ts already document for this reka-ui version. The
// brief's `mountOpen` is synchronous and its callers assert immediately after
// calling it; run as written this is red on every test for a reason that has
// nothing to do with this component (a missing tick, not a missing feature).
// `mountOpen` is made async with a `nextTick()` after mount, and every call
// site awaits it -- the assertions themselves are unchanged from the brief.
let activeWrapper: ReturnType<typeof mount> | null = null

async function mountOpen() {
  const wp = useWallpaperStore()
  wp.openDialog()
  activeWrapper = mount(WallpaperDialog, { global: { plugins: [i18n] }, attachTo: document.body })
  await nextTick()
  return activeWrapper
}

const body = () => new DOMWrapper(document.body)

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  delete document.documentElement.dataset.wallpaper
  delete document.documentElement.dataset.theme
  setCustomStorage.mockClear()
  uploadImage.mockClear()
})

afterEach(() => {
  activeWrapper?.unmount()
  activeWrapper = null
  document.body.innerHTML = ''
})

describe('WallpaperDialog presets', () => {
  it('renders four presets plus upload and nas entries', async () => {
    await mountOpen()
    for (const id of ['blue', 'light', 'w01', 'w02']) {
      expect(body().find(`[data-test="wp-preset-${id}"]`).exists(), id).toBe(true)
    }
    expect(body().find('[data-test="wp-upload"]').exists()).toBe(true)
    expect(body().find('[data-test="wp-nas"]').exists()).toBe(true)
  })

  it('has no "restore default" button -- the blue base preset IS the default', async () => {
    await mountOpen()
    expect(body().find('[data-test="wp-restore"]').exists()).toBe(false)
  })

  it('picking a builtin previews live without persisting', async () => {
    await mountOpen()
    await body().find('[data-test="wp-preset-w01"]').trigger('click')
    expect(document.documentElement.dataset.wallpaper).toBe('')
    expect(setCustomStorage).not.toHaveBeenCalled()
  })

  it('picking a builtin leaves the theme alone', async () => {
    const theme = useThemeStore()
    theme.setTheme('light')
    await mountOpen()
    await body().find('[data-test="wp-preset-w01"]').trigger('click')
    expect(theme.theme).toBe('light')
  })

  it('picking the white base clears the wallpaper and switches the theme', async () => {
    const theme = useThemeStore()
    await mountOpen()
    await body().find('[data-test="wp-preset-w01"]').trigger('click')
    await body().find('[data-test="wp-preset-light"]').trigger('click')
    expect(document.documentElement.dataset.wallpaper).toBeUndefined()
    expect(theme.theme).toBe('light')
  })

  it('marks the active preset', async () => {
    await mountOpen()
    await body().find('[data-test="wp-preset-w02"]').trigger('click')
    expect(body().find('[data-test="wp-preset-w02"]').classes()).toContain('on')
    expect(body().find('[data-test="wp-preset-blue"]').classes()).not.toContain('on')
  })
})

describe('WallpaperDialog apply / cancel', () => {
  it('apply persists and closes', async () => {
    const wp = useWallpaperStore()
    await mountOpen()
    await body().find('[data-test="wp-preset-w01"]').trigger('click')
    await body().find('[data-test="wp-apply"]').trigger('click')
    await flushPromises()
    expect(setCustomStorage).toHaveBeenCalledWith('wallpaper_v3', { kind: 'builtin', id: 'w01' })
    expect(wp.dialogOpen).toBe(false)
  })

  it('cancel rolls back the record and the theme, and closes', async () => {
    const theme = useThemeStore()
    theme.setTheme('blue')
    await mountOpen()
    await body().find('[data-test="wp-preset-light"]').trigger('click')
    await body().find('[data-test="wp-cancel"]').trigger('click')
    expect(theme.theme).toBe('blue')
    expect(useWallpaperStore().dialogOpen).toBe(false)
  })

  it('I2: cancelling a previewed theme switch does not leave it in localStorage (survives reload)', async () => {
    // Repro from the finding: blue + no wallpaper -> open picker -> pick white
    // base -> Cancel (looks right) -> F5 -> the cancelled theme used to come
    // back, because the old pickBase() called theme.setTheme() (which writes
    // localStorage) immediately on pick, before Cancel ever ran. This is red
    // against that old code (localStorage would read 'light' here) and green
    // now that pickBase() only calls theme.previewTheme() (in-memory + DOM).
    const theme = useThemeStore()
    theme.setTheme('blue')
    await mountOpen()
    await body().find('[data-test="wp-preset-light"]').trigger('click')
    await body().find('[data-test="wp-cancel"]').trigger('click')
    expect(localStorage.getItem('theme')).toBe('blue')
  })

  it('I2 round 2: picking a base preset then switching to "from NAS" does not silently confirm the previewed theme', async () => {
    // Exact repro from the final review: open the picker, pick 白色底板
    // (previews the theme only, per the I2 fix above), change your mind and
    // choose 从 NAS 选择 instead, pick an image -- no Apply click anywhere in
    // this sequence. Verified this goes red against the code as it stood
    // right before this fix (wallpaper.ts's commit() ended with
    // `themeStore.setTheme(themeStore.theme)`): localStorage read back
    // 'light' here instead of 'blue', because setFromNasPath() (which
    // onNasPick calls) internally calls commit() too.
    const theme = useThemeStore()
    theme.setTheme('blue')
    const w = await mountOpen()
    await body().find('[data-test="wp-preset-light"]').trigger('click')
    expect(document.documentElement.dataset.theme).toBe('light') // preview took effect

    await body().find('[data-test="wp-nas"]').trigger('click')
    await flushPromises()
    await w.findComponent({ name: 'NasImagePicker' })
      .vm.$emit('pick', { path: '/DATA/Gallery/a.png', src: '/v1/image?path=/DATA/Gallery/a.png' })
    await flushPromises()

    expect(localStorage.getItem('theme')).toBe('blue')
  })

  it('I2: applying a previewed theme switch does persist it to localStorage', async () => {
    // The flip side of the test above: Apply (not Cancel) is what must turn the
    // preview into the confirmed value now that pickBase() itself no longer
    // persists anything.
    const theme = useThemeStore()
    theme.setTheme('blue')
    await mountOpen()
    await body().find('[data-test="wp-preset-light"]').trigger('click')
    await body().find('[data-test="wp-apply"]').trigger('click')
    await flushPromises()
    expect(localStorage.getItem('theme')).toBe('light')
  })

  it('Esc dismisses the sheet the same way Cancel does (M8: onOpenChange -> cancel)', async () => {
    // Esc/outside-dismiss is reka-ui's own DismissableLayer calling the root's
    // onOpenChange(false) -- nothing in this codebase's own code fires that
    // path directly, so this is the only test that exercises onOpenChange at
    // all. Not vacuous: onOpenChange's `if (!open) cancel()` guard means a stub
    // handler (or one that called closeDialog() instead of cancel()) would
    // leave the theme on 'light' here, same failure shape as the Cancel-button
    // test just above.
    const theme = useThemeStore()
    theme.setTheme('blue')
    await mountOpen()
    await body().find('[data-test="wp-preset-light"]').trigger('click')
    expect(document.documentElement.dataset.theme).toBe('light') // preview took effect
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(theme.theme).toBe('blue')
    expect(useWallpaperStore().dialogOpen).toBe(false)
  })

  it('M2: apply stays disabled while an upload is in flight (wp.busy), not just the local saving flag', async () => {
    // Old code was `:disabled="saving"` -- saving only flips true once apply()
    // itself starts, so it says nothing about an upload still in flight. This
    // is red against that: the button would be enabled right after the file
    // input change (saving is still false at that point) with the old binding.
    let resolveUpload!: (v: { path: string; file_name: string; online_path: string }) => void
    uploadImage.mockImplementationOnce(() => new Promise((resolve) => { resolveUpload = resolve }))
    await mountOpen()
    const input = body().find('[data-test="wp-file"]')
    const small = new File([new Uint8Array([1])], 'a.jpg')
    Object.defineProperty(input.element, 'files', { value: [small] })
    await input.trigger('change')
    await nextTick()
    expect(useWallpaperStore().busy).toBe(true)
    expect(body().find('[data-test="wp-apply"]').attributes('disabled')).toBeDefined()

    resolveUpload({ path: '/d/1/wallpaper.jpg', file_name: 'wallpaper.jpg', online_path: 'x' })
    await flushPromises()
    expect(useWallpaperStore().busy).toBe(false)
    expect(body().find('[data-test="wp-apply"]').attributes('disabled')).toBeUndefined()
  })

  it('a failed apply shows an inline error and keeps the dialog open', async () => {
    // Inline, not a toast: the toast layer is z-index 60 and a dialog overlay sits
    // above it, so a toast fired from inside a dialog is covered and blurred.
    setCustomStorage.mockRejectedValueOnce(new Error('boom'))
    await mountOpen()
    await body().find('[data-test="wp-preset-w01"]').trigger('click')
    await body().find('[data-test="wp-apply"]').trigger('click')
    await flushPromises()
    expect(body().find('[data-test="wp-error"]').text()).toBe('保存失败,请重试')
    expect(useWallpaperStore().dialogOpen).toBe(true)
  })
})

describe('WallpaperDialog sources', () => {
  it('rejects an oversized upload inline without hitting the network', async () => {
    await mountOpen()
    const input = body().find('[data-test="wp-file"]')
    const big = new File([new Uint8Array(1)], 'big.jpg')
    Object.defineProperty(big, 'size', { value: 10 * 1024 * 1024 + 1 })
    Object.defineProperty(input.element, 'files', { value: [big] })
    await input.trigger('change')
    await flushPromises()
    expect(body().find('[data-test="wp-error"]').text()).toBe('图片不能超过 10 MB')
  })

  it('a successful upload previews the uploaded image without persisting', async () => {
    await mountOpen()
    const input = body().find('[data-test="wp-file"]')
    const small = new File([new Uint8Array([1])], 'a.jpg')
    Object.defineProperty(input.element, 'files', { value: [small] })
    await input.trigger('change')
    await flushPromises()
    expect(useWallpaperStore().record).toMatchObject({ kind: 'image', path: '/d/1/wallpaper.jpg' })
    expect(setCustomStorage).not.toHaveBeenCalled()
  })

  it('the nas button swaps in the picker, and a pick previews then returns to the grid', async () => {
    // Note: findComponent runs on the root VueWrapper, not the document.body
    // DOMWrapper -- Teleport only moves rendered DOM nodes, not the Vue
    // component (VNode) tree, so the mounted wrapper still sees this child.
    const w = await mountOpen()
    await body().find('[data-test="wp-nas"]').trigger('click')
    await flushPromises()
    expect(body().find('[data-test="wp-nas-picker"]').exists()).toBe(true)

    await w.findComponent({ name: 'NasImagePicker' })
      .vm.$emit('pick', { path: '/DATA/Gallery/a.png', src: '/v1/image?path=/DATA/Gallery/a.png' })
    await flushPromises()
    expect(useWallpaperStore().record).toMatchObject({ kind: 'image', path: '/d/1/wallpaper.png' })
    expect(body().find('[data-test="wp-nas-picker"]').exists()).toBe(false)
    expect(body().find('[data-test="wp-preset-w01"]').exists()).toBe(true)
  })
})
