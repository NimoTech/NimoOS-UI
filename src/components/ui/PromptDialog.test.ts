import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import PromptDialog from './PromptDialog.vue'

const base = {
  open: true, title: '添加模型', message: '输入模型名称',
  confirmText: '确定', cancelText: '取消',
}

// reka-ui teleports content to body; tests query document instead of the wrapper.
const q = (sel: string) => document.querySelector(sel)

// SP8-P2a Task 6 — declared deviation (differs from the brief's Step 2 wording; logged in the
// report and the ledger): reka-ui@2.10.1's Teleport component
// (node_modules/reka-ui/dist/Teleport/Teleport.js) uses `@vueuse/core`'s `useMounted()` as an
// SSR safety gate: the first synchronous render is always `isMounted=false` → it emits only a
// `<!--v-if-->` placeholder comment, and the re-render triggered by flipping it true in
// `onMounted` doesn't actually move content into document.body until Vue's next microtask
// (`nextTick`). This is not introduced by this component's implementation — reproducing the same
// way with `src/components/ui/AlertDialog.vue` (shipped, reviewed) and asserting right after
// `mount(...,{open: true})` without waiting a tick fails the same way (AlertDialog.test.ts
// itself also asserts only after `await nextTick()`, see that file). So the 4 cases below that
// "query the DOM synchronously right after mount" (the brief's original text had no wait) add
// one `await nextTick()` so the content lands in document.body; assertion content and order
// match the brief exactly, just one extra tick.
// For implementers: clear document.body between tests, otherwise Teleport leftovers make later
// queries pick up nodes from the previous case.
afterEach(() => {
  document.body.innerHTML = ''
})

describe('PromptDialog', () => {
  it('打开时渲染标题、说明与输入框', async () => {
    mount(PromptDialog, { props: base, attachTo: document.body })
    // See the declaration at the top of this file: even with open already true at mount,
    // the content still takes one tick before reka-ui's Teleport moves it into document.body.
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
