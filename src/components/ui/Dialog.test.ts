import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import Dialog from './Dialog.vue'

describe('ui/Dialog', () => {
  it('does not throw when open=false', () => {
    const w = mount(Dialog, { props: { open: false, title: 'X' } })
    expect(w.exists()).toBe(true)
  })
  it('renders title and default slot when open=true (Teleport to body)', async () => {
    mount(Dialog, {
      props: { open: true, title: '新建文件夹' },
      slots: { default: '<p class="body">hi</p>' },
      attachTo: document.body,
    })
    // reka-ui teleports DialogContent to <body> asynchronously (Presence);
    // one tick is enough for it to land in jsdom.
    await nextTick()
    expect(document.body.textContent).toContain('新建文件夹')
    expect(document.body.querySelector('.body')).not.toBeNull()
  })
})
