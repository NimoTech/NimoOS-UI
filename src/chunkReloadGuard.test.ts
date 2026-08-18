import { describe, it, expect, vi } from 'vitest'
import { shouldReload, installChunkReloadGuard } from './chunkReloadGuard'

function memStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v) },
  }
}

describe('shouldReload', () => {
  it('First failure allows reload and records time', () => {
    const s = memStorage()
    expect(shouldReload(100_000, s)).toBe(true)
  })

  it('Continuous failures within 10s do not reload (prevent infinite loops)', () => {
    const s = memStorage()
    expect(shouldReload(100_000, s)).toBe(true)
    expect(shouldReload(105_000, s)).toBe(false)
  })

  it('Allow reload again after 10s', () => {
    const s = memStorage()
    expect(shouldReload(100_000, s)).toBe(true)
    expect(shouldReload(111_000, s)).toBe(true)
  })
})

describe('installChunkReloadGuard', () => {
  it('Listens to vite:preloadError: swallows error and performs full-page reload', () => {
    const listeners = new Map<string, (e: Event) => void>()
    const target = {
      addEventListener: (type: string, fn: EventListenerOrEventListenerObject) => {
        listeners.set(type, fn as (e: Event) => void)
      },
    } as unknown as Pick<Window, 'addEventListener'>
    const reload = vi.fn()
    installChunkReloadGuard(target, reload, memStorage())

    const handler = listeners.get('vite:preloadError')
    expect(handler).toBeTruthy()
    const ev = new Event('vite:preloadError', { cancelable: true })
    handler!(ev)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(ev.defaultPrevented).toBe(true)
  })

  it('When reload is throttled and rejected, do not swallow error or reload', () => {
    const listeners = new Map<string, (e: Event) => void>()
    const target = {
      addEventListener: (type: string, fn: EventListenerOrEventListenerObject) => {
        listeners.set(type, fn as (e: Event) => void)
      },
    } as unknown as Pick<Window, 'addEventListener'>
    const reload = vi.fn()
    const storage = memStorage()
    installChunkReloadGuard(target, reload, storage)

    const handler = listeners.get('vite:preloadError')!
    handler(new Event('vite:preloadError', { cancelable: true }))
    expect(reload).toHaveBeenCalledTimes(1)

    const second = new Event('vite:preloadError', { cancelable: true })
    handler(second)
    expect(reload).toHaveBeenCalledTimes(1) // no second reload
    expect(second.defaultPrevented).toBe(false) // error keeps bubbling, visible in the console
  })
})
