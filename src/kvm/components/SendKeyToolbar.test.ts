import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SendKeyToolbar from './SendKeyToolbar.vue'
import { i18n } from '../../i18n'

// 悬浮工具条(修饰键/Tab/Esc/Ctrl+Alt+Del/全屏)。视觉 1:1 对 Vue2
// components/KVM/KVMFullPage.vue `.sendkey-toolbar` 模板(:195-223,2026-08-02 核对)。
// 本组件只管渲染 + emit,鼠标悬浮显隐规则 / 全屏状态本身归 KvmPage.vue(见该文件注释)。

const MODS = { ctrl: false, alt: false, shift: false, win: false }
const mk = (p: Record<string, unknown> = {}) =>
  mount(SendKeyToolbar, { props: { modifiers: MODS, isFullscreen: false, ...p }, global: { plugins: [i18n] } })

describe('SendKeyToolbar', () => {
  it('渲染 8 个按钮:四修饰键 + Tab + Esc + Ctrl+Alt+Del + 全屏', () => {
    expect(mk().findAll('.sendkey-btn')).toHaveLength(8)
  })
  it('点 Ctrl emit toggle("ctrl")', async () => {
    const w = mk()
    await w.findAll('.sendkey-btn')[0].trigger('click')
    expect(w.emitted('toggle')![0]).toEqual(['ctrl'])
  })
  it('修饰键按下时该按钮加 active 类', () => {
    expect(mk({ modifiers: { ...MODS, alt: true } }).findAll('.sendkey-btn')[1].classes()).toContain('active')
  })
  it('Tab / Esc emit key 带正确 keysym', async () => {
    const w = mk()
    const btns = w.findAll('.sendkey-btn')
    await btns[4].trigger('click'); expect(w.emitted('key')![0]).toEqual([0xff09])
    await btns[5].trigger('click'); expect(w.emitted('key')![1]).toEqual([0xff1b])
  })
  it('Ctrl+Alt+Del emit ctrlAltDel', async () => {
    const w = mk()
    await w.findAll('.sendkey-btn')[6].trigger('click')
    expect(w.emitted('ctrlAltDel')).toHaveLength(1)
  })
  it('全屏按钮 emit fullscreen,图标按 isFullscreen 切换', async () => {
    const w = mk()
    await w.findAll('.sendkey-btn')[7].trigger('click')
    expect(w.emitted('fullscreen')).toHaveLength(1)
    expect(mk({ isFullscreen: true }).get('.sendkey-btn--fullscreen img').attributes('alt'))
      .not.toBe(mk({ isFullscreen: false }).get('.sendkey-btn--fullscreen img').attributes('alt'))
  })
  it('每个按钮都有 title(悬浮提示),Win 与图标按钮另有 aria-label', () => {
    const w = mk()
    w.findAll('.sendkey-btn').forEach((b) => expect(b.attributes('title')).toBeTruthy())
    expect(w.findAll('.sendkey-btn')[3].attributes('aria-label')).toBeTruthy()
    expect(w.get('.sendkey-btn--fullscreen').attributes('aria-label')).toBeTruthy()
  })
})
