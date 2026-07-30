import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import SnapshotSelectionToolbar from './SnapshotSelectionToolbar.vue'
import zh from '../../i18n/zh_cn'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const mountIt = (props = {}) =>
  mount(SnapshotSelectionToolbar, { props: { count: 2, restoring: false, ...props }, global: { plugins: [i18n] } })

describe('SnapshotSelectionToolbar', () => {
  it('只有恢复与下载两个动词(没有删除/剪切/复制/共享)', () => {
    const w = mountIt()
    expect(w.find('.snap-sel-restore').exists()).toBe(true)
    expect(w.find('.snap-sel-download').exists()).toBe(true)
    expect(w.findAll('button')).toHaveLength(3) // 恢复 + 下载 + 取消选择
    expect(w.text()).not.toContain('删除')
  })
  it('显示选中数量', () => { expect(mountIt({ count: 3 }).text()).toContain('3') })
  it('点击分别 emit restore / download / clear', async () => {
    const w = mountIt()
    await w.find('.snap-sel-restore').trigger('click')
    await w.find('.snap-sel-download').trigger('click')
    await w.find('.snap-sel-clear').trigger('click')
    expect(w.emitted('restore')).toHaveLength(1)
    expect(w.emitted('download')).toHaveLength(1)
    expect(w.emitted('clear')).toHaveLength(1)
  })
  it('恢复在途时禁用且不 emit', async () => {
    const w = mountIt({ restoring: true })
    expect(w.find('.snap-sel-restore').attributes('disabled')).toBeDefined()
    await w.find('.snap-sel-restore').trigger('click')
    expect(w.emitted('restore')).toBeUndefined()
  })
})
