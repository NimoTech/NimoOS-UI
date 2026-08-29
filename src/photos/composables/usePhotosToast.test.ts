import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { usePhotosToast } from './usePhotosToast'

describe('usePhotosToast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    usePhotosToast().__resetForTests()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('show() enqueues a toast, carrying text/icon/action', () => {
    const { show, toasts } = usePhotosToast()
    show({ text: 'Moved to Trash', icon: 'trash' })
    expect(toasts.value).toHaveLength(1)
    expect(toasts.value[0].text).toBe('Moved to Trash')
    expect(toasts.value[0].icon).toBe('trash')
  })

  it('without action, auto-removes after 2800ms by default', () => {
    const { show, toasts } = usePhotosToast()
    show({ text: 'Favorited' })
    vi.advanceTimersByTime(2799)
    expect(toasts.value).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(toasts.value).toHaveLength(0)
  })

  it('with action, auto-removes after 5000ms by default', () => {
    const { show, toasts } = usePhotosToast()
    show({ text: 'Moved to Trash', action: { label: 'Undo', onClick: () => {} } })
    vi.advanceTimersByTime(4999)
    expect(toasts.value).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(toasts.value).toHaveLength(0)
  })

  it('explicit duration overrides the default value', () => {
    const { show, toasts } = usePhotosToast()
    show({ text: 'Custom', duration: 1000 })
    vi.advanceTimersByTime(999)
    expect(toasts.value).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(toasts.value).toHaveLength(0)
  })

  it('action.onClick fires and removes immediately, without waiting for the timer', () => {
    const onClick = vi.fn()
    const { show, toasts } = usePhotosToast()
    show({ text: 'Moved to Trash', action: { label: 'Undo', onClick } })
    expect(toasts.value).toHaveLength(1)
    toasts.value[0].action?.onClick()
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(toasts.value).toHaveLength(0)
    // After removal, no leftover pending timer should try to clear the already-empty queue again and throw
    vi.advanceTimersByTime(6000)
    expect(toasts.value).toHaveLength(0)
  })

  it('when action.onClick throws, the toast is still removed (matches the try/catch behavior in Vue2 photosToast.js:123-124)', () => {
    const onClick = vi.fn(() => {
      throw new Error('boom')
    })
    const { show, toasts } = usePhotosToast()
    show({ text: 'Moved to Trash', action: { label: 'Undo', onClick } })
    expect(() => toasts.value[0].action?.onClick()).not.toThrow()
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(toasts.value).toHaveLength(0)
  })

  it('__resetForTests clears the queue and timers', () => {
    const { show, toasts, __resetForTests } = usePhotosToast()
    show({ text: 'A' })
    __resetForTests()
    expect(toasts.value).toHaveLength(0)
  })
})
