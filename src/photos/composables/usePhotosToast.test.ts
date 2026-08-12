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

  it('show() 把 toast 入队,携带 text/icon/action', () => {
    const { show, toasts } = usePhotosToast()
    show({ text: 'Moved to Trash', icon: 'trash' })
    expect(toasts.value).toHaveLength(1)
    expect(toasts.value[0].text).toBe('Moved to Trash')
    expect(toasts.value[0].icon).toBe('trash')
  })

  it('不带 action 时默认 2800ms 后自动移除', () => {
    const { show, toasts } = usePhotosToast()
    show({ text: 'Favorited' })
    vi.advanceTimersByTime(2799)
    expect(toasts.value).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(toasts.value).toHaveLength(0)
  })

  it('带 action 时默认 5000ms 后自动移除', () => {
    const { show, toasts } = usePhotosToast()
    show({ text: 'Moved to Trash', action: { label: 'Undo', onClick: () => {} } })
    vi.advanceTimersByTime(4999)
    expect(toasts.value).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(toasts.value).toHaveLength(0)
  })

  it('显式传入 duration 时覆盖默认值', () => {
    const { show, toasts } = usePhotosToast()
    show({ text: 'Custom', duration: 1000 })
    vi.advanceTimersByTime(999)
    expect(toasts.value).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(toasts.value).toHaveLength(0)
  })

  it('action.onClick 触发后立即移除,不等到时', () => {
    const onClick = vi.fn()
    const { show, toasts } = usePhotosToast()
    show({ text: 'Moved to Trash', action: { label: 'Undo', onClick } })
    expect(toasts.value).toHaveLength(1)
    toasts.value[0].action?.onClick()
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(toasts.value).toHaveLength(0)
    // 移除后不应该再有挂起的定时器把已清空的队列重新清一次导致报错
    vi.advanceTimersByTime(6000)
    expect(toasts.value).toHaveLength(0)
  })

  it('__resetForTests 清空队列与计时器', () => {
    const { show, toasts, __resetForTests } = usePhotosToast()
    show({ text: 'A' })
    __resetForTests()
    expect(toasts.value).toHaveLength(0)
  })
})
