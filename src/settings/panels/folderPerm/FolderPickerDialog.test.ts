import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn.sp9'
import FolderPickerDialog from './FolderPickerDialog.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

const ROOTS = [
  { path: '/DATA', label: 'System (/DATA)' },
  { path: '/media', label: '/media' },
  { path: '/mnt', label: '/mnt' },
]

// B4:Dialog 经 reka DialogPortal teleport → 必须 attachTo body 并查 document。
// ⚠️ 同 P3 AppPathDialog.test.ts:49-87 的教训:attachTo body 的 mount 不显式 unmount 时,
// Portal 内容会残留在 document 里,下一个用例的 querySelector 会取到**上一次**的节点
// (本文件第一版就栽了三条:根按钮数成了 18 = 6 次 mount × 3)。
let mountedWrappers: Array<{ unmount: () => void }> = []
afterEach(() => {
  for (const w of mountedWrappers) {
    try { w.unmount() } catch { /* 测试自己已 unmount 过 */ }
  }
  mountedWrappers = []
  document.body.innerHTML = ''
})

function mountDialog(open = true) {
  const w = mount(FolderPickerDialog, {
    props: { open, title: zh.settingsFpAddFolder, roots: ROOTS },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
  mountedWrappers.push(w)
  return w
}

describe('FolderPickerDialog', () => {
  it('关闭时不渲染任何内容', () => {
    mountDialog(false)
    expect(document.querySelector('[data-test="fp-picker-body"]')).toBeNull()
  })

  it('打开时列出三个内置根(本期候选恒空 → pickerRoots 的回退形态)', async () => {
    const w = mountDialog()
    await w.vm.$nextTick()
    const labels = [...document.querySelectorAll('[data-test="fp-picker-root"]')].map((n) => n.textContent?.trim())
    expect(labels).toEqual(['System (/DATA)', '/media', '/mnt'])
  })

  it('标题透传', async () => {
    const w = mountDialog()
    await w.vm.$nextTick()
    expect(document.querySelector('.ui-dialog-title')?.textContent).toBe(zh.settingsFpAddFolder)
  })

  it('手输框存在,且带 .set-net-field 容器(C7:否则吃到 .set-input 的 92px)', async () => {
    const w = mountDialog()
    await w.vm.$nextTick()
    const field = document.querySelector('[data-test="fp-picker-field"]')
    expect(field).not.toBeNull()
    expect(field?.classList.contains('set-net-field')).toBe(true)
    expect(field?.querySelector('input')).not.toBeNull()
  })

  it('本期「添加」按钮恒 disabled —— 政策三写操作禁用(B6:断属性,不 trigger)', async () => {
    const w = mountDialog()
    await w.vm.$nextTick()
    const add = document.querySelector('[data-test="fp-picker-add"]') as HTMLButtonElement
    expect(add).not.toBeNull()
    expect(add.disabled).toBe(true)
  })

  it('即便输入了合法绝对路径,「添加」仍然 disabled', async () => {
    const w = mountDialog()
    await w.vm.$nextTick()
    const input = document.querySelector('[data-test="fp-picker-field"] input') as HTMLInputElement
    input.value = '/DATA/Docs'
    input.dispatchEvent(new Event('input'))
    await w.vm.$nextTick()
    expect((document.querySelector('[data-test="fp-picker-add"]') as HTMLButtonElement).disabled).toBe(true)
  })

  it('根按钮也是 disabled —— 本期不发列目录请求', async () => {
    const w = mountDialog()
    await w.vm.$nextTick()
    const roots = [...document.querySelectorAll('[data-test="fp-picker-root"]')] as HTMLButtonElement[]
    expect(roots).toHaveLength(3)
    expect(roots.every((b) => b.disabled)).toBe(true)
  })

  it('取消按钮把 open 置回 false', async () => {
    const w = mountDialog()
    await w.vm.$nextTick()
    ;(document.querySelector('[data-test="fp-picker-cancel"]') as HTMLButtonElement).click()
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('重新打开会清掉上次输入的路径(Vue2 openAdd 每次重置 newPath)', async () => {
    const w = mountDialog(false)
    await w.setProps({ open: true })
    await w.vm.$nextTick()
    const input = document.querySelector('[data-test="fp-picker-field"] input') as HTMLInputElement
    input.value = '/DATA/X'
    input.dispatchEvent(new Event('input'))
    await w.vm.$nextTick()
    await w.setProps({ open: false })
    await w.setProps({ open: true })
    await w.vm.$nextTick()
    expect((document.querySelector('[data-test="fp-picker-field"] input') as HTMLInputElement).value).toBe('')
  })
})
