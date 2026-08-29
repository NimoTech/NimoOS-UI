import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import IsoBrowser from './IsoBrowser.vue'
import { i18n } from '../../i18n'

const items = { value: [] as unknown[] }
const isLoading = { value: false }
const path = { value: '/' }
const fetchFn = vi.fn(); const upFn = vi.fn()
vi.mock('../composables/useIsoBrowser', () => ({
  useIsoBrowser: () => ({ path, items, isLoading, fetch: fetchFn, up: upFn, dispose: vi.fn() }),
}))

const ISOS = [{ id: 'win11', name: 'Windows 11', version: '24H2', category: 'windows', size: '5.8 GB', status: 'available', progress: 0, recommendedVcpu: 2, recommendedMemory: 8192, minMemory: 4096, minDisk: 60, _downloading: false, _downloaded: false, _progress: 0, _downloadedBytes: 0 }]

let w: VueWrapper | null = null
// SP16 Task 6: after expand state is controlled, the component no longer holds it itself — so this helper acts as the parent component
// (this is how KvmPage receives it): upon receiving update:expanded, write the new value back to prop. Existing test cases
// "click to expand" therefore remain word-for-word identical, while the component is truly controlled.
const mk = (extra: Record<string, unknown> = {}) => {
  w = mount(IsoBrowser, {
    props: {
      isos: ISOS as never,
      expanded: false,
      'onUpdate:expanded': (v: boolean) => { void w?.setProps({ expanded: v }) },
      ...extra,
    },
    global: { plugins: [i18n] },
  })
  return w
}
// Mount without writing back — used to prove "controlled" is not fake (component internally does not secretly keep a copy of state).
const mkUncontrolled = (extra: Record<string, unknown> = {}) => {
  w = mount(IsoBrowser, { props: { isos: ISOS as never, expanded: false, ...extra }, global: { plugins: [i18n] } })
  return w
}
afterEach(() => { w?.unmount(); w = null; items.value = []; isLoading.value = false; path.value = '/'; fetchFn.mockReset(); upFn.mockReset() })

describe('IsoBrowser', () => {
  it('Collapsed by default, click title bar to expand and fetch root directory (per Vue2 :56-60 + :130-136)', async () => {
    const wr = mk()
    expect(wr.find('.custom-browse').exists()).toBe(false)
    await wr.get('.custom-divider').trigger('click')
    expect(wr.find('.custom-browse').exists()).toBe(true)
    expect(fetchFn).toHaveBeenCalledWith('/')
  })

  it('Collapse toggle is focusable, both Enter and Space can expand it (only keyboard entry point for keyboard users)', async () => {
    const wr = mk()
    const divider = wr.get('.custom-divider')
    expect(divider.attributes('role')).toBe('button')
    expect(divider.attributes('tabindex')).toBe('0')
    expect(divider.attributes('aria-expanded')).toBe('false')

    await divider.trigger('keydown', { key: 'Enter' })
    expect(wr.find('.custom-browse').exists()).toBe(true)
    expect(wr.get('.custom-divider').attributes('aria-expanded')).toBe('true')

    await divider.trigger('keydown', { key: ' ' })
    expect(wr.find('.custom-browse').exists()).toBe(false)
  })

  it('Up button is disabled when at root directory', async () => {
    const wr = mk(); await wr.get('.custom-divider').trigger('click')
    expect(wr.get('.custom-back-btn').attributes('disabled')).toBeDefined()
  })

  it('Up button is clickable and calls up() when not at root directory', async () => {
    path.value = '/DATA'
    const wr = mk(); await wr.get('.custom-divider').trigger('click')
    await wr.get('.custom-back-btn').trigger('click')
    expect(upFn).toHaveBeenCalled()
  })

  it('Empty directory shows empty state text', async () => {
    const wr = mk(); await wr.get('.custom-divider').trigger('click')
    expect(wr.text()).toContain('此目录为空')
  })

  it('Directory items show name and right arrow, click to enter; file items show size, no arrow', async () => {
    items.value = [
      { name: 'KVM', path: '/DATA/KVM', is_dir: true, is_symlink: false, size: 4096 },
      { name: 'win11.iso', path: '/DATA/win11.iso', is_dir: false, is_symlink: false, size: 6227151974 },
    ]
    const wr = mk(); await wr.get('.custom-divider').trigger('click')
    const rows = wr.findAll('.custom-file-item')
    expect(rows[0].find('.custom-file-arrow').exists()).toBe(true)
    expect(rows[1].find('.custom-file-arrow').exists()).toBe(false)
    expect(rows[1].text()).toContain('5.8 GB')
    await rows[0].trigger('click')
    expect(fetchFn).toHaveBeenLastCalledWith('/DATA/KVM')
  })

  it('Click .iso file emit select with isLocal=true, and look up win11 recommended specs by filename', async () => {
    items.value = [{ name: 'Win11_24H2.iso', path: '/DATA/Win11_24H2.iso', is_dir: false, is_symlink: false, size: 6227151974 }]
    const wr = mk(); await wr.get('.custom-divider').trigger('click')
    await wr.get('.custom-file-item').trigger('click')
    expect(wr.emitted('select')![0][0]).toMatchObject({
      isLocal: true, id: 'win11', name: 'Win11_24H2.iso', path: '/DATA/Win11_24H2.iso',
      recommendedVcpu: 2, recommendedMemory: 8192, minMemory: 4096, minDisk: 60,
    })
  })

  it('When lookup fails, id falls back to local, recommended specs all undefined (per Vue2 :350-357)', async () => {
    items.value = [{ name: 'haiku-r1.iso', path: '/DATA/haiku-r1.iso', is_dir: false, is_symlink: false, size: 1 }]
    const wr = mk(); await wr.get('.custom-divider').trigger('click')
    await wr.get('.custom-file-item').trigger('click')
    expect(wr.emitted('select')![0][0]).toMatchObject({ isLocal: true, id: 'local' })
    expect((wr.emitted('select')![0][0] as { minDisk?: number }).minDisk).toBeUndefined()
  })

  it('Clicking non-.iso files does nothing', async () => {
    items.value = [{ name: 'readme.txt', path: '/DATA/readme.txt', is_dir: false, is_symlink: false, size: 1 }]
    const wr = mk(); await wr.get('.custom-divider').trigger('click')
    // Filtering happens at the composable layer, here we simulate the "leaking in" case, component should not emit either
    await wr.get('.custom-file-item').trigger('click')
    expect(wr.emitted('select')).toBeUndefined()
  })
})

// SP16 Task 6: expand state is controlled — dialog content is rebuilt by reka every time it reopens, if expand state is kept inside
// the component it will necessarily reset to zero. Parent component holds it, this component only reports toggle actions.
describe('IsoBrowser expand state is held by parent component', () => {
  it('When parent passes expanded=true, expand directly and fetch current path once (list cannot be empty after reopening)', () => {
    const wr = mk({ expanded: true })
    expect(wr.find('.custom-browse').exists()).toBe(true)
    expect(wr.get('.custom-divider').attributes('aria-expanded')).toBe('true')
    expect(fetchFn).toHaveBeenCalledWith('/')
  })

  it('Click title bar only emits update:expanded, does not change state itself (controlled)', async () => {
    const wr = mkUncontrolled()
    await wr.get('.custom-divider').trigger('click')
    expect(wr.emitted('update:expanded')).toEqual([[true]])
    // Parent component does not write back prop ⇒ interface stays collapsed, proving it is truly controlled and not keeping a copy of state internally
    expect(wr.find('.custom-browse').exists()).toBe(false)
  })

  it('When already expanded, click title bar emits false', async () => {
    const wr = mk({ expanded: true })
    await wr.get('.custom-divider').trigger('click')
    expect(wr.emitted('update:expanded')).toEqual([[false]])
  })
})
