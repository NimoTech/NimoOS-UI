import { describe, it, expect, vi, afterEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { useIsMobile } from './useIsMobile'

function mountWith(matches: boolean) {
  let listener: ((e: { matches: boolean }) => void) | null = null
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches,
    media: query,
    addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => { listener = fn },
    removeEventListener: () => { listener = null },
  }))
  let result: ReturnType<typeof useIsMobile> | null = null
  const w = mount(defineComponent({
    setup() { result = useIsMobile(); return () => h('div') },
  }))
  return { w, result: result!, fire: (m: boolean) => listener?.({ matches: m }) }
}

afterEach(() => vi.unstubAllGlobals())

describe('useIsMobile', () => {
  it('reflects the initial match state', () => {
    expect(mountWith(true).result.value).toBe(true)
    expect(mountWith(false).result.value).toBe(false)
  })
  it('updates reactively on media query change', async () => {
    const { result, fire } = mountWith(false)
    fire(true)
    expect(result.value).toBe(true)
  })
  it('defaults to false when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined)
    const w = mount(defineComponent({
      setup() { const m = useIsMobile(); return () => h('div', String(m.value)) },
    }))
    expect(w.text()).toBe('false')
  })
})
