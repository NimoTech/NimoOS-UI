import { describe, it, expect, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { useConfirmResolve } from './useConfirmResolve'

// useI18n() needs a component instance, so the composable's return value is obtained
// through a host component.
// i18n is already set up globally by vitest.setup.ts -- do not create another
// createI18n here.
function host() {
  let api!: ReturnType<typeof useConfirmResolve<'accept' | 'decline' | 'cancel'>>
  const C = defineComponent({
    setup() { api = useConfirmResolve<'accept' | 'decline' | 'cancel'>(); return () => null },
  })
  const wrapper = mount(C)
  return { api, wrapper }
}

function httpError(status: number) {
  return Object.assign(new Error('boom'), { response: { status } })
}

describe('useConfirmResolve', () => {
  it('on success, sets decision and clears submitting', async () => {
    const { api } = host()
    await api.run('accept', async () => {})
    expect(api.decision.value).toBe('accept')
    expect(api.submitting.value).toBe(false)
    expect(api.expired.value).toBe(false)
    expect(api.submitError.value).toBe('')
  })

  it('409 is terminal state: sets expired, does not set decision', async () => {
    const { api } = host()
    await api.run('accept', async () => { throw httpError(409) })
    expect(api.expired.value).toBe(true)
    expect(api.decision.value).toBeNull()
    expect(api.submitError.value).toBe('确认已过期，请重新发送指令')
  })

  it('after expired, clicking again does not call send at all', async () => {
    const { api } = host()
    await api.run('accept', async () => { throw httpError(409) })
    const send = vi.fn(async () => {})
    await api.run('decline', send)
    expect(send).not.toHaveBeenCalled()
  })

  it('500 is retryable: does not set expired, only writes submitError', async () => {
    const { api } = host()
    await api.run('accept', async () => { throw httpError(500) })
    expect(api.expired.value).toBe(false)
    expect(api.decision.value).toBeNull()
    expect(api.submitError.value).toContain('提交失败')
  })

  it('network error without response also goes to retryable branch', async () => {
    const { api } = host()
    await api.run('accept', async () => { throw new Error('Network Error') })
    expect(api.expired.value).toBe(false)
    expect(api.submitError.value).toContain('Network Error')
  })

  it('non-409 errors prioritize response.data.detail (string) over e.message', async () => {
    const { api } = host()
    const err = Object.assign(new Error('Request failed with status code 500'), {
      response: { status: 500, data: { detail: 'disk quota exceeded' } },
    })
    await api.run('accept', async () => { throw err })
    expect(api.submitError.value).toContain('disk quota exceeded')
    expect(api.submitError.value).not.toContain('Request failed with status code 500')
  })

  it('when detail is not a string (e.g. backend returns object), falls back to e.message', async () => {
    const { api } = host()
    const err = Object.assign(new Error('boom'), {
      response: { status: 500, data: { detail: { code: 'x' } } },
    })
    await api.run('accept', async () => { throw err })
    expect(api.submitError.value).toContain('boom')
  })

  it('reentrancy during submitting is blocked', async () => {
    const { api } = host()
    let release: () => void = () => {}
    const first = api.run('accept', () => new Promise<void>((r) => { release = r }))
    const send = vi.fn(async () => {})
    await api.run('decline', send)
    expect(send).not.toHaveBeenCalled()
    release()
    await first
  })

  it('fail() writes error directly, does not touch decision/expired', () => {
    const { api } = host()
    api.fail('aiConfirmInvalid')
    expect(api.submitError.value).toBe('确认请求无效（缺少 confirm_id）')
    expect(api.decision.value).toBeNull()
    expect(api.expired.value).toBe(false)
  })
})
