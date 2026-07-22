import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { EditorView } from '@codemirror/view'
import YamlEditor from './YamlEditor.vue'

// CM6 in jsdom: mounting、doc content 与 dispatch→updateListener 全部真的跑(手工探针验证过,
// 非 mock)。唯独"用户真实敲键盘"在 jsdom 里无法可靠模拟(依赖浏览器原生 contenteditable/IME 事件),
// 所以"文档变化→emit"这条走 EditorView.findFromDOM(公开 CM6 API,不是 hack)拿到真实 view 实例,
// 用 view.dispatch() 制造一次真实的文档变更事务——这就是组件对外契约(修改文档→emit)的忠实模拟,
// 只是换了个"敲键盘"的入口而已,不是绕过组件逻辑。
function mountEditor(modelValue: string) {
  return mount(YamlEditor, { props: { modelValue }, attachTo: document.body })
}

describe('YamlEditor', () => {
  it('挂载时用 modelValue 初始化 CM6 文档内容', () => {
    const w = mountEditor('services:\n  a:\n    image: foo\n')
    const host = w.find('[data-test="yaml-editor"]').element as HTMLElement
    const view = EditorView.findFromDOM(host)
    expect(view).not.toBeNull()
    expect(view!.state.doc.toString()).toBe('services:\n  a:\n    image: foo\n')
    w.unmount()
  })

  it('文档变化(view.dispatch 制造的真实事务)→ emit update:modelValue', async () => {
    const w = mountEditor('a: 1')
    const host = w.find('[data-test="yaml-editor"]').element as HTMLElement
    const view = EditorView.findFromDOM(host)!
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: 'b: 2' } })
    await nextTick()
    const emitted = w.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
    expect(emitted![emitted!.length - 1]).toEqual(['b: 2'])
    w.unmount()
  })

  it('外部 modelValue 变化(如 tab2 转换写入)同步进编辑器', async () => {
    const w = mountEditor('a: 1')
    const host = w.find('[data-test="yaml-editor"]').element as HTMLElement
    await w.setProps({ modelValue: 'name: converted\nservices: {}\n' })
    await nextTick()
    const view = EditorView.findFromDOM(host)!
    expect(view.state.doc.toString()).toBe('name: converted\nservices: {}\n')
    w.unmount()
  })

  it('回填相同内容不触发反馈环(setProps 用当前文档同值不 dispatch,不产生多余 emit)', async () => {
    const w = mountEditor('a: 1')
    await w.setProps({ modelValue: 'a: 1' }) // 与当前文档一致
    await nextTick()
    expect(w.emitted('update:modelValue')).toBeFalsy()
    w.unmount()
  })

  it('销毁时清理 EditorView(卸载后 findFromDOM 拿不到实例)', () => {
    const w = mountEditor('a: 1')
    const host = w.find('[data-test="yaml-editor"]').element as HTMLElement
    w.unmount()
    expect(EditorView.findFromDOM(host)).toBeNull()
  })
})
