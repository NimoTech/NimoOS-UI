import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import RaidDeleteDialog from './RaidDeleteDialog.vue'
import zh from '../../i18n/zh_cn'
const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

// attachTo: document.body 挂载的实例不会在测试间自动 unmount(Dialog 内容还经
// reka-ui Portal Teleport 到 body,脱离 wrapper 根节点),不清空的话下一测试的
// querySelector 会先命中上一测试留在 body 里的旧节点——同目录 FormatDialog.test.ts/
// UnmountDialog.test.ts 均以此 beforeEach 处理,这里沿用同一模式。
beforeEach(() => {
  document.body.innerHTML = ''
})

describe('RaidDeleteDialog', () => {
  const mountIt = () => mount(RaidDeleteDialog, {
    props: { open: true, name: 'vault' }, global: { plugins: [i18n] },
    attachTo: document.body,
  })
  it('输入不等于阵列名 → 删除按钮禁用', async () => {
    const w = mountIt()
    // Dialog 底座(reka-ui DialogPortal)把内容 Teleport 进 body 是异步的(onMounted 里翻 isMounted
    // 再触发一次渲染),挂载后必须先等一次 nextTick 才能查到内容——同目录 FormatDialog.test.ts/
    // UnmountDialog.test.ts 均遵循这个模式;brief 给的样例测试代码在第一次查询前漏了这次 await,
    // 实测会导致 querySelector 恒为 null(与阵列名是否匹配无关),故在此补上,不改变任何断言意图。
    await w.vm.$nextTick()
    const input = document.body.querySelector('.rdd-input') as HTMLInputElement
    input.value = 'vaul'; input.dispatchEvent(new Event('input'))
    await w.vm.$nextTick()
    const ok = document.body.querySelector('.rdd-ok') as HTMLButtonElement
    expect(ok.disabled).toBe(true)
  })
  it('输入等于阵列名 → 启用,点击 emit confirm(无 payload)', async () => {
    const w = mountIt()
    await w.vm.$nextTick()
    const input = document.body.querySelector('.rdd-input') as HTMLInputElement
    input.value = 'vault'; input.dispatchEvent(new Event('input'))
    await w.vm.$nextTick()
    const ok = document.body.querySelector('.rdd-ok') as HTMLButtonElement
    expect(ok.disabled).toBe(false)
    ok.click()
    expect(w.emitted('confirm')).toHaveLength(1)
    expect(w.emitted('confirm')![0]).toEqual([])
  })
  it('开/关都清空输入', async () => {
    const w = mountIt()
    await w.vm.$nextTick()
    const input = document.body.querySelector('.rdd-input') as HTMLInputElement
    input.value = 'vault'; input.dispatchEvent(new Event('input'))
    await w.setProps({ open: false }); await w.setProps({ open: true })
    await w.vm.$nextTick()
    expect((document.body.querySelector('.rdd-input') as HTMLInputElement).value).toBe('')
  })
})
