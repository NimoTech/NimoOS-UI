import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'
import { useToast } from '../../stores/toast'
import { useCopyFeedback } from './useCopyFeedback'

// SP8-P2b 验收第 5 轮 —— 见 useCopyFeedback.ts 头注释的需求原文。
const h = vi.hoisted(() => ({ copyText: vi.fn() }))
vi.mock('../../files/util/clipboard', () => ({ copyText: h.copyText }))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

/** 把 composable 装进一个真组件里跑(useI18n 需要组件上下文)。 */
function setup() {
  let api!: ReturnType<typeof useCopyFeedback>
  const C = defineComponent({
    setup() { api = useCopyFeedback(); return () => null },
  })
  const w = mount(C, { global: { plugins: [i18n] }, globalProperties: {} } as never)
  return { api, w }
}

describe('useCopyFeedback', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    h.copyText.mockReset()
    h.copyText.mockResolvedValue(undefined)
  })

  it('初始没有任何按钮打勾', () => {
    const { api } = setup()
    expect(api.copiedKey.value).toBeNull()
  })

  it('复制成功 → 该 key 打勾,并弹「已复制」', async () => {
    const { api } = setup()
    const show = vi.spyOn(useToast(), 'show')
    await api.copy('http://x/v1/ai/mcp-rpc/', 'endpoint')
    expect(h.copyText).toHaveBeenCalledWith('http://x/v1/ai/mcp-rpc/')
    expect(api.copiedKey.value).toBe('endpoint')
    expect(show).toHaveBeenCalledWith(zh.aiCopied)
  })

  it('复制别的东西 → 勾转移过去(旧的自动撤销,同时只有一个)', async () => {
    const { api } = setup()
    await api.copy('a', 'endpoint')
    await api.copy('b', 'json')
    expect(api.copiedKey.value).toBe('json')
  })

  it('复制失败 → 不打勾,且把旧的勾一并撤掉(不留自相矛盾的信号)', async () => {
    const { api } = setup()
    await api.copy('a', 'endpoint')
    expect(api.copiedKey.value).toBe('endpoint')
    h.copyText.mockRejectedValueOnce(new Error('nope'))
    const show = vi.spyOn(useToast(), 'show')
    await api.copy('b', 'json')
    expect(api.copiedKey.value).toBeNull()
    expect(show).toHaveBeenCalledWith(zh.aiCfgCopyFailed, 3000, 'warning')
  })

  it('resetCopied 撤掉勾(弹窗关闭时用)', async () => {
    const { api } = setup()
    await api.copy('a', 'endpoint')
    api.resetCopied()
    expect(api.copiedKey.value).toBeNull()
  })
})
