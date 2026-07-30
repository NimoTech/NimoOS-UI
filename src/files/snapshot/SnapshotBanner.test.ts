import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import SnapshotBanner from './SnapshotBanner.vue'
import zh from '../../i18n/zh_cn'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const INFO = { mount: '/DATA', snapshotName: '20260713T061900Z_manual_改版前', relPath: 'Photos' }
const mountIt = (props: Record<string, unknown> = {}) =>
  mount(SnapshotBanner, {
    props: { info: INFO, restoring: false, canRestore: true, ...props },
    global: { plugins: [i18n] },
  })

describe('SnapshotBanner', () => {
  it('info 为 null 时整条不渲染', () => {
    expect(mountIt({ info: null }).find('.snap-banner').exists()).toBe(false)
  })
  it('显示解析出的人话时间,而不是原始快照名', () => {
    const text = mountIt().text()
    expect(text).not.toContain('20260713T061900Z')
    expect(text).toContain('只读')
  })
  it('快照名解析不出来时回退显示原始名字(不留空)', () => {
    const w = mountIt({ info: { ...INFO, snapshotName: 'weird' } })
    expect(w.text()).toContain('weird')
  })
  it('常驻提示行一直在(不是一次性 toast)', () => {
    expect(mountIt().find('.snap-banner-hint').text()).toContain('恢复')
  })
  it('点退出 emit exit', async () => {
    const w = mountIt()
    await w.find('.snap-banner-exit').trigger('click')
    expect(w.emitted('exit')).toHaveLength(1)
  })
  it('点恢复 emit restore', async () => {
    const w = mountIt()
    await w.find('.snap-banner-restore').trigger('click')
    expect(w.emitted('restore')).toHaveLength(1)
  })
  it('没有可恢复的选中项时恢复按钮禁用且不 emit', async () => {
    const w = mountIt({ canRestore: false })
    expect(w.find('.snap-banner-restore').attributes('disabled')).toBeDefined()
    await w.find('.snap-banner-restore').trigger('click')
    expect(w.emitted('restore')).toBeUndefined()
  })
  it('恢复在途时按钮禁用并显示忙态', async () => {
    const w = mountIt({ restoring: true })
    expect(w.find('.snap-banner-restore').attributes('disabled')).toBeDefined()
    expect(w.find('.snap-banner-restore').classes()).toContain('is-busy')
  })
})
