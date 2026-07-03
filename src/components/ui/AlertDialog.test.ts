import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import AlertDialog from './AlertDialog.vue'

describe('ui/AlertDialog', () => {
  it('open=true 渲染 message 与两个按钮', async () => {
    mount(AlertDialog, {
      props: { open: true, title: '删除', message: '确定删除 1 项?', confirmText: '删除', cancelText: '取消' },
      attachTo: document.body,
    })
    // reka-ui teleports AlertDialogContent to <body> asynchronously (Presence);
    // one tick is enough for it to land in jsdom.
    await nextTick()
    expect(document.body.textContent).toContain('确定删除 1 项?')
    expect(document.body.textContent).toContain('删除')
    expect(document.body.textContent).toContain('取消')
  })
})
