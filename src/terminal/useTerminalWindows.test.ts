import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const listWindows = vi.fn()
const newWindow = vi.fn()
const selectWindow = vi.fn()
const closeWindow = vi.fn()
const renameWindow = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    terminal: {
      listWindows: () => listWindows(),
      newWindow: () => newWindow(),
      selectWindow: (i: number) => selectWindow(i),
      closeWindow: (i: number) => closeWindow(i),
      renameWindow: (i: number, name: string) => renameWindow(i, name),
    },
  },
}))

import { useTerminalWindows } from './useTerminalWindows'

function httpErr(status?: number) {
  const e = new Error('http') as Error & { response?: { status: number; data: unknown } }
  if (status !== undefined) e.response = { status, data: {} }
  return e
}

const WINS = [
  { index: 0, name: 'zsh', active: true },
  { index: 1, name: 'build', active: false },
]

beforeEach(() => {
  vi.useFakeTimers()
  for (const f of [listWindows, newWindow, selectWindow, closeWindow, renameWindow]) f.mockReset().mockResolvedValue(undefined)
  listWindows.mockResolvedValue(WINS)
})
afterEach(() => { vi.useRealTimers() })

describe('useTerminalWindows', () => {
  it('start refreshes immediately then polls every 3s', async () => {
    const w = useTerminalWindows(() => {})
    w.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(w.windows.value).toEqual(WINS)
    await vi.advanceTimersByTimeAsync(3000)
    expect(listWindows).toHaveBeenCalledTimes(2)
    w.stop()
    await vi.advanceTimersByTimeAsync(9000)
    expect(listWindows).toHaveBeenCalledTimes(2)
  })

  it('mutations refresh the list; a 401 anywhere reports auth loss', async () => {
    const onAuthLost = vi.fn()
    const w = useTerminalWindows(onAuthLost)
    await w.select(1)
    expect(selectWindow).toHaveBeenCalledWith(1)
    expect(listWindows).toHaveBeenCalledTimes(1) // refresh after the mutation
    selectWindow.mockRejectedValue(httpErr(401))
    await w.select(0)
    expect(onAuthLost).toHaveBeenCalledTimes(1)
  })

  it('closing the last window (409) is silently ignored', async () => {
    const onAuthLost = vi.fn()
    closeWindow.mockRejectedValue(httpErr(409))
    const w = useTerminalWindows(onAuthLost)
    await w.close(0)
    expect(onAuthLost).not.toHaveBeenCalled()
  })

  it('rename trims and skips the call entirely for an all-whitespace name', async () => {
    const w = useTerminalWindows(() => {})
    await w.rename(1, '   ')
    expect(renameWindow).not.toHaveBeenCalled()
    await w.rename(1, '  dev  ')
    expect(renameWindow).toHaveBeenCalledWith(1, 'dev')
  })

  it('a poll response landing after stop() must not repopulate the list', async () => {
    let release!: (v: unknown) => void
    listWindows.mockReturnValueOnce(new Promise((res) => { release = res }))
    const w = useTerminalWindows(() => {})
    w.start() // refresh now in flight
    w.stop()
    release(WINS)
    await vi.advanceTimersByTimeAsync(0)
    expect(w.windows.value).toEqual([]) // stale response discarded (spec §4-1)
  })
})
