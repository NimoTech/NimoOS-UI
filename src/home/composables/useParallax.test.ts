import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Stub rAF to execute synchronously so tests are deterministic
const rafStub = (cb: FrameRequestCallback): number => { cb(0); return 0 }
const cafStub = (_id: number): void => {}

describe('useParallax', () => {
  beforeEach(() => {
    // Reset CSS vars
    document.documentElement.style.removeProperty('--mx')
    document.documentElement.style.removeProperty('--my')

    // Stub rAF/cAF globally — synchronous execution
    vi.stubGlobal('requestAnimationFrame', rafStub)
    vi.stubGlobal('cancelAnimationFrame', cafStub)

    // Default: reduced-motion OFF
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }))

    // Known viewport
    vi.stubGlobal('innerWidth', 1000)
    vi.stubGlobal('innerHeight', 800)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('Test A: sets --mx and --my on pointermove after rAF flush', async () => {
    const { useParallax } = await import('./useParallax')
    const { stop } = useParallax()

    // clientX=750 → mx = 750/1000 - 0.5 = 0.25
    // clientY=600 → my = 600/800  - 0.5 = 0.25
    const evt = new MouseEvent('pointermove', { clientX: 750, clientY: 600, bubbles: true })
    window.dispatchEvent(evt)

    expect(document.documentElement.style.getPropertyValue('--mx')).toBe('0.25')
    expect(document.documentElement.style.getPropertyValue('--my')).toBe('0.25')

    stop()
  })

  it('Test B: reduced-motion=true → no-op, --mx stays unset', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }))

    const { useParallax } = await import('./useParallax')
    const { stop } = useParallax()

    const evt = new MouseEvent('pointermove', { clientX: 750, clientY: 600, bubbles: true })
    window.dispatchEvent(evt)

    expect(document.documentElement.style.getPropertyValue('--mx')).toBe('')
    expect(document.documentElement.style.getPropertyValue('--my')).toBe('')

    stop()
  })

  it('Test C: after stop(), subsequent pointermove does not update --mx', async () => {
    const { useParallax } = await import('./useParallax')
    const { stop } = useParallax()

    // First move to establish a value
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 500, clientY: 400, bubbles: true }))
    expect(document.documentElement.style.getPropertyValue('--mx')).toBe('0')

    stop()

    // Reset so we can detect any change
    document.documentElement.style.setProperty('--mx', 'sentinel')

    // Move after stop — should not update
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 750, clientY: 600, bubbles: true }))

    expect(document.documentElement.style.getPropertyValue('--mx')).toBe('sentinel')
  })
})
