## Task 7: SendKeyToolbar + 全屏

**Files:**
- Create: `src/kvm/components/SendKeyToolbar.vue` + `SendKeyToolbar.test.ts`
- Modify: `src/kvm/views/KvmPage.vue` · `src/kvm/styles/kvm.css`

**Interfaces:**
- Consumes: `useVncConsole` 的 `modifiers` / `toggleModifier` / `sendKey` / `sendCtrlAltDel`
- Produces: `SendKeyToolbar` props `{ modifiers, isFullscreen }`,emit `toggle(name)` / `key(keysym)` / `ctrlAltDel` / `fullscreen`

**悬浮显隐规则**(照 Vue2 `:153`、`:1136-1151`):
- 鼠标进入 `.console-display` → 显示
- 鼠标离开 → 隐藏,**除非鼠标此刻在工具条上**(`sendKeyToolbarHover`)
- 鼠标在容器内移动:`mouseX >= width - 80` → 显示;否则(且不在工具条上)→ 隐藏
- 只在 `vm.state === 'running'` 时生效
- 进入全屏时强制显示一次

**键位表**(照 Vue2):Ctrl `0xffe3` · Alt `0xffe9` · Shift `0xffe1` · Win `0xffeb` · Tab `0xff09` · Esc `0xff1b`

- [ ] **Step 1: 写 `SendKeyToolbar.test.ts`(失败)**

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SendKeyToolbar from './SendKeyToolbar.vue'
import { i18n } from '../../i18n'

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
```

- [ ] **Step 2: 实现组件,跑绿**

样式照 Vue2 `:2337-2416`:`.sendkey-toolbar` 绝对定位右侧垂直居中、竖排、`gap:.25rem`、`padding:.5rem`、底 `var(--kvm-overlay)`、`1px solid var(--kvm-border)`、`border-radius:.5rem 0 0 .5rem`、`backdrop-filter: blur(8px)`、`z-index:40`;`.sendkey-btn` `2.75rem` 方、`border-radius:.375rem`、底 `var(--kvm-elev)`、`font-size:.7rem`,hover `var(--kvm-accent-soft)`,`.active` 底 `var(--kvm-accent)` + 字 `var(--kvm-on-accent)`;`.sendkey-hint` 绝对定位在按钮左侧、默认 `opacity:0`、hover 显示;进出场过渡 `sendkey-slide-*`(`translateX(100%) translateY(-50%)` → 0,进 .2s 出 .15s)。**Vue 3 的过渡类名是 `-enter-from` 不是 Vue2 的 `-enter`**,已在白名单里按 Vue 3 命名列。

- [ ] **Step 3: 显隐 + 全屏接进 `KvmPage.vue`**

在 `KvmPage.vue` 里加:
- `sendKeyVisible` / `toolbarHover` 两个 ref
- `.console-display` 上绑 `@mouseenter` / `@mouseleave` / `@mousemove`,逻辑照上面「悬浮显隐规则」逐条实现
- `toggleFullscreen()`:`hostEl.requestFullscreen()` 成功后 `isFullscreen = true; sendKeyVisible = true`;已在全屏则 `document.exitFullscreen()`;两者都 `.catch(() => {})`
- `document` 上监听 `fullscreenchange` → `isFullscreen = !!document.fullscreenElement`,且进入全屏且 VM running 时强制 `sendKeyVisible = true`;`onUnmounted` 摘监听

给 `KvmPage.test.ts` 补 4 条:
```ts
it('鼠标进入控制台区显示工具条,离开隐藏', ...)
it('鼠标停在工具条上时,离开控制台区不隐藏', ...)
it('mousemove 到右侧 80px 内显示,移回左侧隐藏', ...)
it('VM 不是 running 时,鼠标怎么动都不显示工具条', ...)
```

- [ ] **Step 4: 全量 + 真机验收 + 提交**

真机:鼠标移到控制台右侧 → 工具条滑出;点 Ctrl 变紫、再点复原;点 Ctrl+Alt+Del;点全屏进出。

```bash
git add src/kvm/components/SendKeyToolbar.vue src/kvm/components/SendKeyToolbar.test.ts src/kvm/views/KvmPage.vue src/kvm/views/KvmPage.test.ts src/kvm/styles/kvm.css
git commit -m "feat(kvm): SendKey 悬浮工具条(修饰键/Tab/Esc/Ctrl+Alt+Del/全屏)"
```

---

