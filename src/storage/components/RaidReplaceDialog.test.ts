import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import RaidReplaceDialog from './RaidReplaceDialog.vue'
import zh from '../../i18n/zh_cn'
import type { RaidDisk } from '../util/raidLevels'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

// attachTo: document.body 挂载(reka-ui Portal Teleport 到 body)——同目录
// RaidDeleteDialog.test.ts/FormatDialog.test.ts 同款教训:测试间须清空 body。
beforeEach(() => {
  document.body.innerHTML = ''
})

const disks: RaidDisk[] = [
  { path: '/dev/sda', size: 1000 },
  { path: '/dev/sdb', size: 2000 },
  { path: '/dev/sdc', size: 3000 },
]

describe('RaidReplaceDialog', () => {
  const mountIt = (props: Record<string, unknown> = {}) =>
    mount(RaidReplaceDialog, {
      props: { open: true, raidId: 7, faultyDiskPath: '/dev/sdb', availableDisks: disks, ...props },
      global: { plugins: [i18n] },
      attachTo: document.body,
    })

  it('新盘下拉排除故障盘', async () => {
    mountIt()
    await new Promise((r) => setTimeout(r))
    const select = document.body.querySelector<HTMLSelectElement>('.rrd-select')!
    const values = Array.from(select.options).map((o) => o.value).filter(Boolean)
    expect(values).toEqual(['/dev/sda', '/dev/sdc'])
  })

  it('未选新盘时确认按钮禁用,选中后启用', async () => {
    mountIt()
    await new Promise((r) => setTimeout(r))
    const ok = document.body.querySelector<HTMLButtonElement>('.rrd-ok')!
    expect(ok.disabled).toBe(true)
    const select = document.body.querySelector<HTMLSelectElement>('.rrd-select')!
    select.value = '/dev/sda'
    select.dispatchEvent(new Event('change'))
    await new Promise((r) => setTimeout(r))
    expect(ok.disabled).toBe(false)
  })

  it('点击确认按钮 emit confirm(选中的新盘 path),无二次确认弹层', async () => {
    const w = mountIt()
    await new Promise((r) => setTimeout(r))
    const select = document.body.querySelector<HTMLSelectElement>('.rrd-select')!
    select.value = '/dev/sdc'
    select.dispatchEvent(new Event('change'))
    await new Promise((r) => setTimeout(r))
    document.body.querySelector<HTMLButtonElement>('.rrd-ok')!.click()
    expect(w.emitted('confirm')).toHaveLength(1)
    expect(w.emitted('confirm')![0]).toEqual(['/dev/sdc'])
  })

  it('开/关都清空已选新盘', async () => {
    const w = mountIt()
    await new Promise((r) => setTimeout(r))
    const select = document.body.querySelector<HTMLSelectElement>('.rrd-select')!
    select.value = '/dev/sda'
    select.dispatchEvent(new Event('change'))
    await w.setProps({ open: false })
    await w.setProps({ open: true })
    await new Promise((r) => setTimeout(r))
    expect(document.body.querySelector<HTMLSelectElement>('.rrd-select')!.value).toBe('')
  })

  it('busy 时确认按钮禁用', async () => {
    mountIt({ busy: true })
    await new Promise((r) => setTimeout(r))
    const select = document.body.querySelector<HTMLSelectElement>('.rrd-select')!
    select.value = '/dev/sda'
    select.dispatchEvent(new Event('change'))
    await new Promise((r) => setTimeout(r))
    expect(document.body.querySelector<HTMLButtonElement>('.rrd-ok')!.disabled).toBe(true)
  })

  it('故障盘只读展示 faultyDiskPath', async () => {
    mountIt()
    await new Promise((r) => setTimeout(r))
    // 故障盘展示在 disabled <input> 里,value 不进 textContent,须单独查 .value;
    // Dialog 内容经 reka-ui Portal Teleport 到 body(同目录 RaidDeleteDialog.test.ts 同款教训)。
    const input = document.body.querySelector<HTMLInputElement>('.rrd-input')!
    expect(input.value).toBe('/dev/sdb')
    expect(input.disabled).toBe(true)
  })
})
