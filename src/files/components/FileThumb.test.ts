import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import FileThumb from './FileThumb.vue'

vi.mock('@nimotech/nimoos-service', () => ({
  service: { image: { thumbUrl: (p: string) => `/v1/image?path=${encodeURIComponent(p)}&type=thumbnail` } },
}))

// fake IntersectionObserver:observe 时立即回报 intersecting
beforeEach(() => {
  ;(globalThis as any).IntersectionObserver = class {
    cb: (entries: { isIntersecting: boolean }[]) => void
    constructor(cb: any) { this.cb = cb }
    observe() { this.cb([{ isIntersecting: true }]) }
    disconnect() {}
  }
})

describe('FileThumb', () => {
  it('renders a lazy thumbnail img for image entries once in view', async () => {
    const w = mount(FileThumb, { props: { entry: { name: 'p.png', path: '/DATA/p.png', is_dir: false } } })
    await nextTick()
    const img = w.get('img.thumb-img')
    expect(img.attributes('src')).toContain('type=thumbnail')
    expect(decodeURIComponent(img.attributes('src')!)).toContain('/DATA/p.png')
  })
  it('renders the type icon for non-image entries', () => {
    const w = mount(FileThumb, { props: { entry: { name: 'a.txt', path: '/DATA/a.txt', is_dir: false } } })
    expect(w.find('img.thumb-img').exists()).toBe(false)
    expect(w.get('img.thumb-icon').attributes('src')).toBeTruthy()
  })
  it('falls back to the type icon when the thumbnail errors', async () => {
    const w = mount(FileThumb, { props: { entry: { name: 'p.png', path: '/DATA/p.png', is_dir: false } } })
    await nextTick()
    await w.get('img.thumb-img').trigger('error')
    expect(w.find('img.thumb-img').exists()).toBe(false)
    expect(w.get('img.thumb-icon').attributes('src')).toBeTruthy()
  })
})
