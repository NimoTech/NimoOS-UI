import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, DOMWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import PhotosToastHost from './PhotosToastHost.vue'
import { usePhotosToast } from '../composables/usePhotosToast'
import { __resetPhotosThemeForTests, usePhotosTheme } from '../composables/usePhotosTheme'

let activeWrapper: ReturnType<typeof mount> | null = null
const body = () => new DOMWrapper(document.body)

async function mountHost() {
  activeWrapper = mount(PhotosToastHost, { attachTo: document.body })
  await nextTick()
  return activeWrapper
}

describe('PhotosToastHost', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    usePhotosToast().__resetForTests()
    __resetPhotosThemeForTests()
    localStorage.clear()
  })

  afterEach(() => {
    activeWrapper?.unmount()
    activeWrapper = null
    document.body.innerHTML = ''
    vi.useRealTimers()
  })

  it('渲染队列里的 toast 文案', async () => {
    await mountHost()
    usePhotosToast().show({ text: 'Moved to Trash' })
    await nextTick()
    expect(body().text()).toContain('Moved to Trash')
  })

  it('Teleport 之后的宿主带 photos-root 类', async () => {
    await mountHost()
    usePhotosToast().show({ text: 'Favorited' })
    await nextTick()
    const host = body().find('.photos-root')
    expect(host.exists()).toBe(true)
  })

  it('主题为 light 时宿主同时带 is-light 类(themeClass 跟随 usePhotosTheme)', async () => {
    usePhotosTheme().set('light')
    await mountHost()
    usePhotosToast().show({ text: 'Favorited' })
    await nextTick()
    const host = body().find('.photos-root')
    expect(host.classes()).toContain('is-light')
  })

  it('点击 Undo 按钮触发 action.onClick,并把该 toast 从视图移除', async () => {
    const onClick = vi.fn()
    await mountHost()
    usePhotosToast().show({ text: 'Moved to Trash', action: { label: 'Undo', onClick } })
    await nextTick()
    const btn = body().find('[data-role="photos-toast-action"]')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toBe('Undo')
    await btn.trigger('click')
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(body().text()).not.toContain('Moved to Trash')
  })

  it('icon:"trash" 在文案前渲染出 trash 图标', async () => {
    await mountHost()
    usePhotosToast().show({ text: 'Moved to Trash', icon: 'trash' })
    await nextTick()
    const icon = body().find('[data-role="photos-toast-icon"]')
    expect(icon.exists()).toBe(true)
    expect(icon.attributes('data-icon')).toBe('trash')
  })

  it('未知 icon 名称不渲染任何图标节点', async () => {
    await mountHost()
    usePhotosToast().show({ text: 'Something', icon: 'not-a-real-icon' })
    await nextTick()
    expect(body().find('[data-role="photos-toast-icon"]').exists()).toBe(false)
  })

  it('不带 icon 时不渲染图标节点', async () => {
    await mountHost()
    usePhotosToast().show({ text: 'No icon here' })
    await nextTick()
    expect(body().find('[data-role="photos-toast-icon"]').exists()).toBe(false)
  })

  it('多条 toast 按入队顺序渲染', async () => {
    await mountHost()
    usePhotosToast().show({ text: 'First' })
    usePhotosToast().show({ text: 'Second' })
    await nextTick()
    const text = body().text()
    expect(text).toContain('First')
    expect(text).toContain('Second')
  })
})
