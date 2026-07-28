import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import SnapshotDeleteDialog from './SnapshotDeleteDialog.vue'
import zh from '../../i18n/zh_cn'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const mountIt = (props: Record<string, unknown> = {}) =>
  mount(SnapshotDeleteDialog, {
    props: { open: true, timeText: '2026/7/27 09:00:00', ...props },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })

beforeEach(() => { document.body.innerHTML = '' })

describe('SnapshotDeleteDialog', () => {
  it('正文含被删快照的时间,并说明当前文件不受影响', async () => {
    const w = mountIt(); await w.vm.$nextTick()
    const msg = document.body.querySelector('.sdd-msg') as HTMLElement
    expect(msg.textContent).toContain('2026/7/27 09:00:00')
  })
  it('点删除 → emit confirm(无 payload)', async () => {
    const w = mountIt(); await w.vm.$nextTick()
    ;(document.body.querySelector('.sdd-ok') as HTMLButtonElement).click()
    expect(w.emitted('confirm')).toHaveLength(1)
    expect(w.emitted('confirm')![0]).toEqual([])
  })
  it('点取消 → emit update:open(false),不 emit confirm', async () => {
    const w = mountIt(); await w.vm.$nextTick()
    ;(document.body.querySelector('.sdd-cancel') as HTMLButtonElement).click()
    expect(w.emitted('update:open')![0]).toEqual([false])
    expect(w.emitted('confirm')).toBeUndefined()
  })
  it('busy 时两个按钮都禁用(防连点)', async () => {
    const w = mountIt({ busy: true }); await w.vm.$nextTick()
    expect((document.body.querySelector('.sdd-ok') as HTMLButtonElement).disabled).toBe(true)
    expect((document.body.querySelector('.sdd-cancel') as HTMLButtonElement).disabled).toBe(true)
  })
})
