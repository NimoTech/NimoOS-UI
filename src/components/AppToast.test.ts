import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useToast } from '../stores/toast'
import AppToast from './AppToast.vue'

describe('AppToast', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('renders no pill when message is empty', () => {
    const w = mount(AppToast)
    expect(w.find('.toast').exists()).toBe(false)
  })

  it('renders the message from useToast', async () => {
    const t = useToast()
    const w = mount(AppToast)
    t.show('saved')
    await w.vm.$nextTick()
    expect(w.get('.toast').text()).toBe('saved')
  })

  it('stacks multiple toasts', async () => {
    const t = useToast()
    const w = mount(AppToast)
    t.show('first')
    t.show('second')
    await w.vm.$nextTick()
    const pills = w.findAll('.toast')
    expect(pills).toHaveLength(2)
    expect(pills.map((p) => p.text())).toEqual(['first', 'second'])
  })

  // Task 9 (SP7-P3 回收站视图): show() 的第三个可选参数 action 渲染成可点的行内按钮
  // (如「撤销」),点击后立即触发回调并从堆栈里移除该 toast(不等自动消失计时器)。
  it('show 带 action 时渲染可点按钮,点击触发回调并立即移除该 toast', async () => {
    const t = useToast()
    const w = mount(AppToast)
    const onClick = vi.fn()
    t.show('已恢复', 4500, { label: '撤销', onClick })
    await w.vm.$nextTick()

    const pill = w.get('.toast')
    expect(pill.text()).toBe('已恢复 撤销')
    const btn = pill.get('.toast-action')
    expect(btn.text()).toBe('撤销')

    await btn.trigger('click')
    expect(onClick).toHaveBeenCalledTimes(1)
    await w.vm.$nextTick()
    expect(w.find('.toast').exists()).toBe(false)
  })
})
