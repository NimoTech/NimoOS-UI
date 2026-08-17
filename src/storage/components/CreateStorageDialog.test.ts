import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import CreateStorageDialog from './CreateStorageDialog.vue'

// The complete shape of AvailDisk (mapAvailDisks's output). disk_type/temperature/power_on_time
// are taken from the `avail` entry of a real device's `curl -s http://127.0.0.1/v1/disks`;
// health is backfilled by mapAvailDisks from the `disks` list in the same response
// (avail's own value is always an empty string — a backend assignment-order defect, see the
// storageMap.ts comment). This dialog doesn't read these four fields, but the type requires them
// to be complete, so the fixture is also given in the real shape, to avoid a future
// "hand-written fixture that lets a defect pass green" incident.
const DISKS = [
  { path: '/dev/sdb', name: 'sdb', model: 'WD Blue', size: 1e12, needFormat: true, serial: 'S1',
    disk_type: 'HDD', health: 'true', temperature: 38, power_on_time: 1381 },
  { path: '/dev/sdc', name: 'sdc', model: 'SG Iron', size: 2e12, needFormat: false, serial: 'S2',
    disk_type: 'HDD', health: 'true', temperature: 38, power_on_time: 1381 },
]

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('CreateStorageDialog', () => {
  it('fills in the default name and preselects the first disk on open', async () => {
    const w = mount(CreateStorageDialog, {
      props: { open: true, disks: DISKS, defaultName: 'Main-storage1' },
    })
    await w.vm.$nextTick()
    const input = document.body.querySelector<HTMLInputElement>('.cs-input')!
    expect(input.value).toBe('Main-storage1')
    const select = document.body.querySelector<HTMLSelectElement>('.cs-select')!
    expect(select.value).toBe('0')
  })

  it('name input filters out illegal characters (only \\w and hyphen allowed)', async () => {
    const w = mount(CreateStorageDialog, {
      props: { open: true, disks: DISKS, defaultName: 'x' },
    })
    await w.vm.$nextTick()
    const input = document.body.querySelector<HTMLInputElement>('.cs-input')!
    input.value = 'a b!c-d'
    input.dispatchEvent(new Event('input'))
    await w.vm.$nextTick()
    expect(input.value).toBe('abc-d')
  })

  it('need_format disk shows a wipe warning; a plug-and-use disk shows a notice and has an extra "Create Directly" button', async () => {
    const w = mount(CreateStorageDialog, {
      props: { open: true, disks: DISKS, defaultName: 'x' },
    })
    await w.vm.$nextTick()
    // index0 = needFormat
    let warn = document.body.querySelector('.cs-warn')!
    expect(warn.classList.contains('danger')).toBe(true)
    expect(warn.textContent).toContain(
      '所选硬盘将被清空。请再次确认所选硬盘上没有需要备份的重要数据。',
    )
    expect(document.body.textContent).not.toContain('直接创建')

    // Switch to index1 = plug-and-use
    const select = document.body.querySelector<HTMLSelectElement>('.cs-select')!
    select.value = '1'
    select.dispatchEvent(new Event('change'))
    await w.vm.$nextTick()
    warn = document.body.querySelector('.cs-warn')!
    expect(warn.classList.contains('notice')).toBe(true)
    expect(warn.textContent).toContain(
      '该硬盘可直接用作存储,也可以选择格式化后创建;格式化会清空所选硬盘。',
    )
    expect(document.body.textContent).toContain('直接创建')
  })

  it('confirm emits the full payload: format button → format:true, plug-and-use button → format:false', async () => {
    const w = mount(CreateStorageDialog, {
      props: { open: true, disks: DISKS, defaultName: 'MyVol' },
    })
    await w.vm.$nextTick()
    // Select sdc (index1, plug-and-use)
    const select = document.body.querySelector<HTMLSelectElement>('.cs-select')!
    select.value = '1'
    select.dispatchEvent(new Event('change'))
    await w.vm.$nextTick()

    const btns = Array.from(
      document.body.querySelectorAll<HTMLButtonElement>('.cs-btn'),
    )
    const directBtn = btns.find((b) => b.textContent?.includes('直接创建'))!
    directBtn.click()
    expect(w.emitted('confirm')![0]).toEqual([
      { path: '/dev/sdc', name: 'MyVol', format: false },
    ])

    const okBtn = document.body.querySelector<HTMLButtonElement>('.cs-btn.danger')!
    okBtn.click()
    expect(w.emitted('confirm')![1]).toEqual([
      { path: '/dev/sdc', name: 'MyVol', format: true },
    ])
  })

  it('submit button is disabled when the name is empty; while busy all buttons are disabled and the primary button label changes to storageCreating', async () => {
    const w = mount(CreateStorageDialog, {
      props: { open: true, disks: DISKS, defaultName: '' },
    })
    await w.vm.$nextTick()
    const okBtn = document.body.querySelector<HTMLButtonElement>('.cs-btn.danger')!
    expect(okBtn.disabled).toBe(true)

    await w.setProps({ busy: true, defaultName: 'Vol' })
    await w.setProps({ open: false })
    await w.setProps({ open: true })
    await w.vm.$nextTick()
    const btns = document.body.querySelectorAll<HTMLButtonElement>('.cs-btn')
    expect(btns.length).toBeGreaterThan(0)
    expect(Array.from(btns).every((b) => b.disabled)).toBe(true)
    const okBtn2 = document.body.querySelector<HTMLButtonElement>('.cs-btn.danger')!
    expect(okBtn2.textContent?.trim()).toBe('创建中…')
  })
})
