import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import CreateStorageDialog from './CreateStorageDialog.vue'

const DISKS = [
  { path: '/dev/sdb', name: 'sdb', model: 'WD Blue', size: 1e12, needFormat: true, serial: 'S1' },
  { path: '/dev/sdc', name: 'sdc', model: 'SG Iron', size: 2e12, needFormat: false, serial: 'S2' },
]

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('CreateStorageDialog', () => {
  it('打开时填入默认名并预选第一块盘', async () => {
    const w = mount(CreateStorageDialog, {
      props: { open: true, disks: DISKS, defaultName: 'Main-storage1' },
    })
    await w.vm.$nextTick()
    const input = document.body.querySelector<HTMLInputElement>('.cs-input')!
    expect(input.value).toBe('Main-storage1')
    const select = document.body.querySelector<HTMLSelectElement>('.cs-select')!
    expect(select.value).toBe('0')
  })

  it('名称输入过滤非法字符(仅 \\w 和连字符)', async () => {
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

  it('need_format 盘显示清空警告;可直连盘显示提示且多出「直接创建」按钮', async () => {
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

    // 切到 index1 = 可直连
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

  it('确认 emit 完整 payload:格式化按钮 format:true,直连按钮 format:false', async () => {
    const w = mount(CreateStorageDialog, {
      props: { open: true, disks: DISKS, defaultName: 'MyVol' },
    })
    await w.vm.$nextTick()
    // 选 sdc(index1,可直连)
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

  it('名称为空时提交按钮禁用;busy 时全部按钮禁用且主按钮文案变 storageCreating', async () => {
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
