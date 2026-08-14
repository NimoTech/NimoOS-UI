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
  it('首次失败允许刷新并记录时间', () => {
    const s = memStorage()
    expect(shouldReload(100_000, s)).toBe(true)
  })

  it('10s 内连续失败不再刷新(防死循环)', () => {
    const s = memStorage()
    expect(shouldReload(100_000, s)).toBe(true)
    expect(shouldReload(105_000, s)).toBe(false)
  })

  it('超过 10s 后允许再次刷新', () => {
    const s = memStorage()
    expect(shouldReload(100_000, s)).toBe(true)
    expect(shouldReload(111_000, s)).toBe(true)
  })
})

describe('installChunkReloadGuard', () => {
  it('监听 vite:preloadError:吞掉错误并整页刷新', () => {
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

  it('刷新被节流拒绝时不吞错误、不刷新', () => {
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
