import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import SkModal from './SkModal.vue'

// reka 的 Portal 目标默认是 '.set-app'(设置页根元素)。测试里手工造一个,
// 顺带证明「内容确实落在这个容器里、而不是 document.body 直挂」——这正是
// D1 要防的 token 作用域逃逸。
function withHost() {
  const host = document.createElement('div')
  host.className = 'set-app'
  document.body.appendChild(host)
  return host
}

describe('SkModal', () => {
  let host: HTMLElement
  beforeEach(() => { host = withHost() })
  afterEach(() => { document.body.innerHTML = '' })

  it('open=false 时不渲染任何弹窗内容', async () => {
    mount(SkModal, { props: { open: false, title: '标题' }, attachTo: document.body })
    await nextTick()
    expect(host.querySelector('.sk-modal')).toBeNull()
  })

  it('open=true 时内容渲染进 .set-app 容器内(不是 body 直挂)', async () => {
    mount(SkModal, {
      props: { open: true, title: '令牌已创建' },
      slots: { default: '<p class="probe">正文</p>' },
      attachTo: document.body,
    })
    await nextTick()
    const modal = host.querySelector('.sk-modal')
    expect(modal).not.toBeNull()
    expect(host.querySelector('.sk-modal-title')?.textContent).toBe('令牌已创建')
    expect(host.querySelector('.sk-modal-body .probe')?.textContent).toBe('正文')
    // 关键断言:弹窗节点的祖先链上必须有 .set-app,否则 AI 区 token 全部失效
    expect(modal!.closest('.set-app')).toBe(host)
  })

  it('footer 插槽渲染进 .sk-modal-foot 的 .right 里', async () => {
    mount(SkModal, {
      props: { open: true, title: 't' },
      slots: { footer: '<button class="fbtn">完成</button>' },
      attachTo: document.body,
    })
    await nextTick()
    expect(host.querySelector('.sk-modal-foot .right .fbtn')?.textContent).toBe('完成')
  })

  it('没有 footer 插槽时不渲染脚部(Vue2 的令牌弹窗有脚、配对码弹窗结构一致,加机器人表单也有脚;但保持插槽可选)', async () => {
    mount(SkModal, { props: { open: true, title: 't' }, attachTo: document.body })
    await nextTick()
    expect(host.querySelector('.sk-modal-foot')).toBeNull()
  })

  it('点关闭按钮 emit update:open=false', async () => {
    const w = mount(SkModal, { props: { open: true, title: 't' }, attachTo: document.body })
    await nextTick()
    const x = host.querySelector('.sk-x') as HTMLElement
    expect(x).not.toBeNull()
    x.click()
    await nextTick()
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('portalTo 可覆盖(给非设置页复用留口)', async () => {
    const other = document.createElement('div')
    other.id = 'other-host'
    document.body.appendChild(other)
    mount(SkModal, { props: { open: true, title: 't', portalTo: '#other-host' }, attachTo: document.body })
    await nextTick()
    expect(other.querySelector('.sk-modal')).not.toBeNull()
    expect(host.querySelector('.sk-modal')).toBeNull()
  })
})
