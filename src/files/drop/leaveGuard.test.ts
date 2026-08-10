import { describe, it, expect, vi } from 'vitest'
import { installDropUnloadGuard } from './leaveGuard'

function fakeWindow() {
  const handlers: Record<string, EventListener[]> = {}
  return {
    handlers,
    addEventListener: (t: string, h: EventListener) => { (handlers[t] ||= []).push(h) },
    removeEventListener: (t: string, h: EventListener) => {
      handlers[t] = (handlers[t] || []).filter((x) => x !== h)
    },
  } as unknown as Window & { handlers: Record<string, EventListener[]> }
}

describe('installDropUnloadGuard', () => {
  it('prompts the browser while a transfer is running', () => {
    const win = fakeWindow() as never as Window & { handlers: Record<string, EventListener[]> }
    installDropUnloadGuard(() => true, win)
    const e = { preventDefault: vi.fn(), returnValue: undefined } as unknown as BeforeUnloadEvent
    win.handlers.beforeunload[0](e as unknown as Event)
    expect(e.preventDefault).toHaveBeenCalled()
  })

  it('stays out of the way when nothing is in flight', () => {
    const win = fakeWindow() as never as Window & { handlers: Record<string, EventListener[]> }
    installDropUnloadGuard(() => false, win)
    const e = { preventDefault: vi.fn(), returnValue: undefined } as unknown as BeforeUnloadEvent
    win.handlers.beforeunload[0](e as unknown as Event)
    expect(e.preventDefault).not.toHaveBeenCalled()
  })

  it('removes its listener when the returned cleanup runs', () => {
    const win = fakeWindow() as never as Window & { handlers: Record<string, EventListener[]> }
    const off = installDropUnloadGuard(() => true, win)
    off()
    expect(win.handlers.beforeunload.length).toBe(0)
  })

  it('is a no-op in an environment with no window', () => {
    expect(() => installDropUnloadGuard(() => true, undefined as never)()).not.toThrow()
  })
})
