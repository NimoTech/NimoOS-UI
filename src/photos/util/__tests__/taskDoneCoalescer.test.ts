import { describe, it, expect, vi, afterEach } from 'vitest'
import { createTaskDoneCoalescer } from '../taskDoneCoalescer'

// NOTE on API shape: the brief's assumed signature was
// createTaskDoneCoalescer(announce: (tasks) => void, delayMs = 2600) -> { push, flushNow, dispose }.
// The actual Vue2 source (src/views/Photos/taskDoneCoalescer.js:11-45) takes a single options
// object { messageFor, emit, delay = 2600 } and returns { push, flush, cancel }: `messageFor`
// converts a task to a display string (or falsy to skip it), `emit` receives the final joined
// string (not an array of tasks), and buffering is keyed by task.type with a fixed announce
// order. Ported verbatim per "Vue2 source wins".

describe('createTaskDoneCoalescer', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('coalesces multiple pushes within the debounce window into a single emit call', () => {
    vi.useFakeTimers()
    const emit = vi.fn()
    const messageFor = (t: { type: string; label: string }) => `${t.label} done`
    const c = createTaskDoneCoalescer({ messageFor, emit })

    c.push({ type: 'index', label: 'Indexing' })
    vi.advanceTimersByTime(1000)
    c.push({ type: 'ocr', label: 'OCR' })

    expect(emit).not.toHaveBeenCalled()
    vi.advanceTimersByTime(2600)
    expect(emit).toHaveBeenCalledTimes(1)
    expect(emit).toHaveBeenCalledWith('Indexing done，OCR done')
  })

  it('orders the joined message by the fixed ORDER (index, embedding, ocr, face, aesthetic)', () => {
    vi.useFakeTimers()
    const emit = vi.fn()
    const messageFor = (t: { type: string }) => `${t.type}-msg`
    const c = createTaskDoneCoalescer({ messageFor, emit })

    // pushed out of order
    c.push({ type: 'face' })
    c.push({ type: 'index' })
    c.push({ type: 'ocr' })
    vi.advanceTimersByTime(2600)

    expect(emit).toHaveBeenCalledWith('index-msg，ocr-msg，face-msg')
  })

  it('unknown task types sort after all known ORDER entries', () => {
    vi.useFakeTimers()
    const emit = vi.fn()
    const messageFor = (t: { type: string }) => `${t.type}-msg`
    const c = createTaskDoneCoalescer({ messageFor, emit })

    c.push({ type: 'mystery' })
    c.push({ type: 'ocr' })
    vi.advanceTimersByTime(2600)

    expect(emit).toHaveBeenCalledWith('ocr-msg，mystery-msg')
  })

  it('skips buffering and does not call emit when messageFor returns falsy', () => {
    vi.useFakeTimers()
    const emit = vi.fn()
    const messageFor = () => null
    const c = createTaskDoneCoalescer({ messageFor, emit })

    c.push({ type: 'face' })
    vi.advanceTimersByTime(3000)

    expect(emit).not.toHaveBeenCalled()
  })

  it('resets the debounce timer on every push (only fires delay ms after the LAST push)', () => {
    vi.useFakeTimers()
    const emit = vi.fn()
    const messageFor = (t: { type: string }) => `${t.type}-msg`
    const c = createTaskDoneCoalescer({ messageFor, emit })

    c.push({ type: 'index' })
    vi.advanceTimersByTime(2000) // < 2600, no fire yet
    expect(emit).not.toHaveBeenCalled()

    c.push({ type: 'ocr' }) // resets the timer
    vi.advanceTimersByTime(2000) // total 4000ms since first push, but only 2000ms since 2nd
    expect(emit).not.toHaveBeenCalled()

    vi.advanceTimersByTime(600) // now 2600ms since the 2nd push
    expect(emit).toHaveBeenCalledTimes(1)
    expect(emit).toHaveBeenCalledWith('index-msg，ocr-msg')
  })

  it('cancel() stops a pending flush so emit never fires', () => {
    vi.useFakeTimers()
    const emit = vi.fn()
    const messageFor = (t: { type: string }) => `${t.type}-msg`
    const c = createTaskDoneCoalescer({ messageFor, emit })

    c.push({ type: 'index' })
    c.cancel()
    vi.advanceTimersByTime(5000)

    expect(emit).not.toHaveBeenCalled()
  })

  it('flush() fires immediately and clears the pending timer', () => {
    vi.useFakeTimers()
    const emit = vi.fn()
    const messageFor = (t: { type: string }) => `${t.type}-msg`
    const c = createTaskDoneCoalescer({ messageFor, emit })

    c.push({ type: 'index' })
    c.flush()
    expect(emit).toHaveBeenCalledTimes(1)
    expect(emit).toHaveBeenCalledWith('index-msg')

    // no double-fire once the original timer would have elapsed
    vi.advanceTimersByTime(3000)
    expect(emit).toHaveBeenCalledTimes(1)
  })

  it('flush() with an empty buffer does not call emit', () => {
    vi.useFakeTimers()
    const emit = vi.fn()
    const messageFor = () => null
    const c = createTaskDoneCoalescer({ messageFor, emit })

    c.flush()
    expect(emit).not.toHaveBeenCalled()
  })

  it('respects a custom delay override', () => {
    vi.useFakeTimers()
    const emit = vi.fn()
    const messageFor = (t: { type: string }) => `${t.type}-msg`
    const c = createTaskDoneCoalescer({ messageFor, emit, delay: 500 })

    c.push({ type: 'index' })
    vi.advanceTimersByTime(499)
    expect(emit).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(emit).toHaveBeenCalledTimes(1)
  })
})
