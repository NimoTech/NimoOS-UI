import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { messages } from '../../i18n/zh_cn'
import OperationStatusBar from './OperationStatusBar.vue'
import { useFileOpsStore } from '../stores/fileOps'

vi.mock('@nimotech/nimoos-service', () => ({
  service: { batch: { deleteTask: vi.fn().mockResolvedValue(undefined) }, folder: { getList: vi.fn() } },
  getHttp: () => ({ get: vi.fn() }),
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages })
const task = (o: Record<string, unknown>) => ({
  id: '1', type: 'copy', finished: false, status: 'PROCESSING',
  processing_path: '/DATA/Movies/a.mkv', processed_size: 30, total_size: 60, to: '/DATA/x', ...o,
})

describe('OperationStatusBar', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('无活动任务时不渲染', () => {
    const wrapper = mount(OperationStatusBar, { global: { plugins: [i18n] } })
    expect(wrapper.find('.op-status-bar').exists()).toBe(false)
  })

  it('有任务时逐个渲染,只显示 basename(不泄漏 /DATA)', async () => {
    const store = useFileOpsStore()
    store.active = [task({ id: '1' }), task({ id: '2', processing_path: '/DATA/b.txt' })] as never
    const wrapper = mount(OperationStatusBar, { global: { plugins: [i18n] } })
    expect(wrapper.findAll('.op-task')).toHaveLength(2)
    const html = wrapper.html()
    expect(html).toContain('a.mkv')
    expect(html).not.toContain('/DATA')
  })

  it('全部取消按钮调 store.cancelAll', async () => {
    const store = useFileOpsStore()
    store.active = [task({})] as never
    const spy = vi.spyOn(store, 'cancelAll').mockResolvedValue()
    const wrapper = mount(OperationStatusBar, { global: { plugins: [i18n] } })
    await wrapper.find('.op-cancel-all').trigger('click')
    expect(spy).toHaveBeenCalled()
  })
})
