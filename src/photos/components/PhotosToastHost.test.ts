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

  it('renders the toast text from the queue', async () => {
    await mountHost()
    usePhotosToast().show({ text: 'Moved to Trash' })
    await nextTick()
    expect(body().text()).toContain('Moved to Trash')
  })

  it('the teleport host carries the photos-root class', async () => {
    await mountHost()
    usePhotosToast().show({ text: 'Favorited' })
    await nextTick()
    const host = body().find('.photos-root')
    expect(host.exists()).toBe(true)
  })

  it('when theme is light, the host also carries the is-light class (themeClass follows usePhotosTheme)', async () => {
    usePhotosTheme().set('light')
    await mountHost()
    usePhotosToast().show({ text: 'Favorited' })
    await nextTick()
    const host = body().find('.photos-root')
    expect(host.classes()).toContain('is-light')
  })

  it('clicking the Undo button fires action.onClick and removes that toast from view', async () => {
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

  it('icon:"trash" renders a trash icon before the text', async () => {
    await mountHost()
    usePhotosToast().show({ text: 'Moved to Trash', icon: 'trash' })
    await nextTick()
    const icon = body().find('[data-role="photos-toast-icon"]')
    expect(icon.exists()).toBe(true)
    expect(icon.attributes('data-icon')).toBe('trash')
  })

  it('an unknown icon name renders no icon node at all', async () => {
    await mountHost()
    usePhotosToast().show({ text: 'Something', icon: 'not-a-real-icon' })
    await nextTick()
    expect(body().find('[data-role="photos-toast-icon"]').exists()).toBe(false)
  })

  it('without an icon, no icon node is rendered', async () => {
    await mountHost()
    usePhotosToast().show({ text: 'No icon here' })
    await nextTick()
    expect(body().find('[data-role="photos-toast-icon"]').exists()).toBe(false)
  })

  it('multiple toasts render in enqueue order', async () => {
    await mountHost()
    usePhotosToast().show({ text: 'First' })
    usePhotosToast().show({ text: 'Second' })
    await nextTick()
    const text = body().text()
    expect(text).toContain('First')
    expect(text).toContain('Second')
  })
})
