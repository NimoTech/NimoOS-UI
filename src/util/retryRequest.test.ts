import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { retryRequest } from './retryRequest'

describe('retryRequest', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('returns the first successful result without waiting', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    await expect(retryRequest(fn)).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries after the configured delays and resolves on a later attempt', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom1'))
      .mockRejectedValueOnce(new Error('boom2'))
      .mockResolvedValue('ok')
    const p = retryRequest(fn, [1000, 3000])
    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(3000)
    await expect(p).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('throws the LAST error after exhausting every delay', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('first'))
      .mockRejectedValueOnce(new Error('second'))
      .mockRejectedValue(new Error('last'))
    const p = retryRequest(fn, [1000, 3000])
    const assertion = expect(p).rejects.toThrow('last')
    await vi.advanceTimersByTimeAsync(4000)
    await assertion
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('makes exactly one attempt when the delay list is empty', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('nope'))
    await expect(retryRequest(fn, [])).rejects.toThrow('nope')
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
