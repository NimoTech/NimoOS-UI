import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import RaidReplaceDialog from './RaidReplaceDialog.vue'
import zh from '../../i18n/zh_cn'
import type { ReplaceTarget, CandidateDiskLike } from '../util/raidReplace'
import type { DiskRaidInfo } from '@nimotech/nimoos-service'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

// attachTo: document.body 挂载(reka-ui Portal Teleport 到 body)——同目录
// RaidDeleteDialog.test.ts/FormatDialog.test.ts 同款教训:测试间须清空 body。
beforeEach(() => {
  document.body.innerHTML = ''
})

const RESIDUE: DiskRaidInfo = {
  role: 'residue', array_name: 'zimaos:fc5616382c017331', array_uuid: 'u-1', level: 'raid5',
  registered: false, active: false,
  created_at: 'Thu Aug  6 21:54:49 2026', updated_at: 'Fri Aug  7 00:29:17 2026',
}
const disks: CandidateDiskLike[] = [
  { path: '/dev/sda', size: 1000, serial: 'S-A' },
  { path: '/dev/sdb', size: 2000, serial: 'S-B', raid: RESIDUE },
  { path: '/dev/sdc', size: 3000, serial: 'S-C' },
]
// 在位 faulty 盘:path 可信,label = path
const faultyTarget: ReplaceTarget = { path: '/dev/sdc', serial: 'S-C', label: '/dev/sdc' }
// 拔掉的盘:path 为空(缓存路径不可信),label = serial
const pulledTarget: ReplaceTarget = { path: '', serial: 'OLD-4', label: 'OLD-4' }

const flush = () => new Promise((r) => setTimeout(r))
const q = <T extends Element>(sel: string) => document.body.querySelector<T>(sel)
async function pick(value: string) {
  const select = q<HTMLSelectElement>('.rrd-select')!
  select.value = value
  select.dispatchEvent(new Event('change'))
  await flush()
}

describe('RaidReplaceDialog', () => {
  const mountIt = (props: Record<string, unknown> = {}) =>
    mount(RaidReplaceDialog, {
      props: { open: true, raidId: 7, target: faultyTarget, disks, ...props },
      global: { plugins: [i18n] },
      attachTo: document.body,
    })

  it('候选盘经 filterReplacementCandidates 过滤:按 serial 排除被换盘自身', async () => {
    mountIt()
    await flush()
    const values = Array.from(q<HTMLSelectElement>('.rrd-select')!.options).map((o) => o.value).filter(Boolean)
    expect(values).toEqual(['/dev/sda', '/dev/sdb'])
  })

  it('拔掉的盘(target.path 空):故障盘展示 serial,坐在旧路径上的新盘不被排除', async () => {
    mountIt({ target: pulledTarget })
    await flush()
    // 故障盘展示在 disabled <input> 里,value 不进 textContent,须单独查 .value
    const input = q<HTMLInputElement>('.rrd-input')!
    expect(input.value).toBe('OLD-4')
    expect(input.disabled).toBe(true)
    const values = Array.from(q<HTMLSelectElement>('.rrd-select')!.options).map((o) => o.value).filter(Boolean)
    expect(values).toEqual(['/dev/sda', '/dev/sdb', '/dev/sdc'])
  })

  it('未选新盘时确认按钮禁用,选中后启用', async () => {
    mountIt()
    await flush()
    expect(q<HTMLButtonElement>('.rrd-ok')!.disabled).toBe(true)
    await pick('/dev/sda')
    expect(q<HTMLButtonElement>('.rrd-ok')!.disabled).toBe(false)
  })

  it('选非残留盘确认 → 直接 emit confirm({newDiskPath, wipeResidue:false}),无二次确认', async () => {
    const w = mountIt()
    await flush()
    await pick('/dev/sda')
    q<HTMLButtonElement>('.rrd-ok')!.click()
    expect(w.emitted('confirm')).toHaveLength(1)
    expect(w.emitted('confirm')![0]).toEqual([{ newDiskPath: '/dev/sda', wipeResidue: false }])
  })

  it('残留盘选项打警告标 + 选中后显示归属阵列说明', async () => {
    mountIt()
    await flush()
    const residueOption = Array.from(q<HTMLSelectElement>('.rrd-select')!.options).find((o) => o.value === '/dev/sdb')!
    expect(residueOption.textContent).toContain('RAID 残留')
    expect(q('.rrd-residue-hint')).toBeNull()
    await pick('/dev/sdb')
    expect(q('.rrd-residue-hint')!.textContent).toContain('zimaos:fc5616382c017331')
  })

  it('选残留盘确认 → 先弹清除确认(点名阵列/创建/最后活动),确认后才 emit wipeResidue:true', async () => {
    const w = mountIt()
    await flush()
    await pick('/dev/sdb')
    q<HTMLButtonElement>('.rrd-ok')!.click()
    await flush()
    // 第一步:不 emit,切到清除确认
    expect(w.emitted('confirm')).toBeUndefined()
    const msg = q('.rrd-wipe-msg')!
    expect(msg.textContent).toContain('zimaos:fc5616382c017331')
    expect(msg.textContent).toContain('Thu Aug  6 21:54:49 2026')
    expect(msg.textContent).toContain('Fri Aug  7 00:29:17 2026')
    // 第二步:清除并重建
    q<HTMLButtonElement>('.rrd-wipe')!.click()
    expect(w.emitted('confirm')![0]).toEqual([{ newDiskPath: '/dev/sdb', wipeResidue: true }])
  })

  it('清除确认步可取消:回到选盘步,不 emit', async () => {
    const w = mountIt()
    await flush()
    await pick('/dev/sdb')
    q<HTMLButtonElement>('.rrd-ok')!.click()
    await flush()
    q<HTMLButtonElement>('.rrd-cancel')!.click()
    await flush()
    expect(q('.rrd-wipe-msg')).toBeNull()
    expect(q<HTMLSelectElement>('.rrd-select')).not.toBeNull()
    expect(w.emitted('confirm')).toBeUndefined()
  })

  it('开/关都清空已选新盘与确认步', async () => {
    const w = mountIt()
    await flush()
    await pick('/dev/sdb')
    q<HTMLButtonElement>('.rrd-ok')!.click()
    await flush()
    await w.setProps({ open: false })
    await w.setProps({ open: true })
    await flush()
    expect(q('.rrd-wipe-msg')).toBeNull()
    expect(q<HTMLSelectElement>('.rrd-select')!.value).toBe('')
  })

  it('busy 时确认按钮禁用', async () => {
    mountIt({ busy: true })
    await flush()
    await pick('/dev/sda')
    expect(q<HTMLButtonElement>('.rrd-ok')!.disabled).toBe(true)
  })

  it('故障盘只读展示 target.label(在位盘 = 实时 path)', async () => {
    mountIt()
    await flush()
    const input = q<HTMLInputElement>('.rrd-input')!
    expect(input.value).toBe('/dev/sdc')
    expect(input.disabled).toBe(true)
  })
})
