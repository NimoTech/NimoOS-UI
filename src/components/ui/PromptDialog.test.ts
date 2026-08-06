import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import PromptDialog from './PromptDialog.vue'

const base = {
  open: true, title: '添加模型', message: '输入模型名称',
  confirmText: '确定', cancelText: '取消',
}

// reka-ui 用 Teleport 把内容送到 body,测试里查 document 而不是 wrapper。
const q = (sel: string) => document.querySelector(sel)

// SP8-P2a Task 6 —— 申报偏离(brief Step 2 原文与此处不同,已在报告与台账登记):
// reka-ui@2.10.1 的 Teleport 组件(node_modules/reka-ui/dist/Teleport/Teleport.js)
// 用 `@vueuse/core` 的 `useMounted()` 做 SSR 安全闸:首次同步渲染必定是
// `isMounted=false` → 只吐一个 `<!--v-if-->` 占位注释,`onMounted` 里把它翻
// true 触发的重渲染要等 Vue 的下一个 microtask(`nextTick`)才真正把内容搬进
// document.body。这不是本组件实现引入的问题——用同样手法复现
// `src/components/ui/AlertDialog.vue`(已上线、已过评审)在 `mount(...,{open:
// true})` 后不等 tick 直接断言,同样断言失败(AlertDialog.test.ts 自己也是
// `await nextTick()` 之后才断言,见该文件)。故以下 4 处「mount 后立即同步查
// DOM」的用例(brief 原文没有先等一拍)补一次 `await nextTick()` 才能让内容
// 落地到 document.body,断言内容与顺序与 brief 原文完全一致,只多了等一拍。
// 实现者:测试之间要清 document.body,否则 Teleport 残留会让后续查询取到
// 上一个用例的节点。
afterEach(() => {
  document.body.innerHTML = ''
})

describe('PromptDialog', () => {
  it('打开时渲染标题、说明与输入框', async () => {
    mount(PromptDialog, { props: base, attachTo: document.body })
    // 见文件头部申报:mount 时 open 已是 true,内容仍要等一个 tick 才会被
    // reka-ui 的 Teleport 真正搬进 document.body。
    await nextTick()
    expect(document.body.textContent).toContain('添加模型')
    expect(document.body.textContent).toContain('输入模型名称')
    expect(q('input')).not.toBeNull()
  })

  it('确认时把输入框当前值原样带出(不 trim —— trim 交调用方)', async () => {
    const w = mount(PromptDialog, { props: base, attachTo: document.body })
    await nextTick()
    const input = q('input') as HTMLInputElement
    input.value = '  gpt-4o  '
    input.dispatchEvent(new Event('input'))
    await w.vm.$nextTick()
    ;(q('[data-testid="prompt-confirm"]') as HTMLElement).click()
    await w.vm.$nextTick()
    expect(w.emitted('confirm')).toEqual([['  gpt-4o  ']])
  })

  it('回车等同于确认', async () => {
    const w = mount(PromptDialog, { props: base, attachTo: document.body })
    await nextTick()
    const input = q('input') as HTMLInputElement
    input.value = 'claude'
    input.dispatchEvent(new Event('input'))
    await w.vm.$nextTick()
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('confirm')).toEqual([['claude']])
  })

  it('重新打开会清掉上次的输入(组件常驻,不清会残留)', async () => {
    const w = mount(PromptDialog, { props: { ...base, open: false }, attachTo: document.body })
    await w.setProps({ open: true })
    const input = q('input') as HTMLInputElement
    input.value = 'stale'
    input.dispatchEvent(new Event('input'))
    await w.vm.$nextTick()
    await w.setProps({ open: false })
    await w.setProps({ open: true })
    expect((q('input') as HTMLInputElement).value).toBe('')
  })

  it('initialValue 作为打开时的预填值', async () => {
    const w = mount(PromptDialog, { props: { ...base, open: false, initialValue: 'gpt-4o' }, attachTo: document.body })
    await w.setProps({ open: true })
    expect((q('input') as HTMLInputElement).value).toBe('gpt-4o')
  })

  it('取消不 emit confirm', async () => {
    const w = mount(PromptDialog, { props: base, attachTo: document.body })
    await nextTick()
    ;(q('[data-testid="prompt-cancel"]') as HTMLElement).click()
    await w.vm.$nextTick()
    expect(w.emitted('confirm')).toBeUndefined()
  })
})
