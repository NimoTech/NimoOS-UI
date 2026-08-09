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
  it('成功后落 decision,并清掉 submitting', async () => {
    const { api } = host()
    await api.run('accept', async () => {})
    expect(api.decision.value).toBe('accept')
    expect(api.submitting.value).toBe(false)
    expect(api.expired.value).toBe(false)
    expect(api.submitError.value).toBe('')
  })

  it('409 是终态:置 expired,不置 decision', async () => {
    const { api } = host()
    await api.run('accept', async () => { throw httpError(409) })
    expect(api.expired.value).toBe(true)
    expect(api.decision.value).toBeNull()
    expect(api.submitError.value).toBe('确认已过期，请重新发送指令')
  })

  it('expired 之后再点一次,send 根本不会被调用', async () => {
    const { api } = host()
    await api.run('accept', async () => { throw httpError(409) })
    const send = vi.fn(async () => {})
    await api.run('decline', send)
    expect(send).not.toHaveBeenCalled()
  })

  it('500 可重试:不置 expired,只写 submitError', async () => {
    const { api } = host()
    await api.run('accept', async () => { throw httpError(500) })
    expect(api.expired.value).toBe(false)
    expect(api.decision.value).toBeNull()
    expect(api.submitError.value).toContain('提交失败')
  })

  it('无 response 的网络错也走可重试分支', async () => {
    const { api } = host()
    await api.run('accept', async () => { throw new Error('Network Error') })
    expect(api.expired.value).toBe(false)
    expect(api.submitError.value).toContain('Network Error')
  })

  it('非 409 错误优先用 response.data.detail(字符串),而不是 e.message', async () => {
    const { api } = host()
    const err = Object.assign(new Error('Request failed with status code 500'), {
      response: { status: 500, data: { detail: 'disk quota exceeded' } },
    })
    await api.run('accept', async () => { throw err })
    expect(api.submitError.value).toContain('disk quota exceeded')
    expect(api.submitError.value).not.toContain('Request failed with status code 500')
  })

  it('detail 不是字符串(如后端返回对象)时退回 e.message', async () => {
    const { api } = host()
    const err = Object.assign(new Error('boom'), {
      response: { status: 500, data: { detail: { code: 'x' } } },
    })
    await api.run('accept', async () => { throw err })
    expect(api.submitError.value).toContain('boom')
  })

  it('submitting 期间的重入被挡住', async () => {
    const { api } = host()
    let release: () => void = () => {}
    const first = api.run('accept', () => new Promise<void>((r) => { release = r }))
    const send = vi.fn(async () => {})
    await api.run('decline', send)
    expect(send).not.toHaveBeenCalled()
    release()
    await first
  })

  it('fail() 直接写错误,不动 decision/expired', () => {
    const { api } = host()
    api.fail('aiConfirmInvalid')
    expect(api.submitError.value).toBe('确认请求无效（缺少 confirm_id）')
    expect(api.decision.value).toBeNull()
    expect(api.expired.value).toBe(false)
  })
})
