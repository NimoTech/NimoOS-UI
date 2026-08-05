## Task 5: 控制台头 + 溢出菜单 + 电源动作 + 进度遮罩

**Files:**
- Create: `src/kvm/components/OverflowMenu.vue` + `OverflowMenu.test.ts`
- Create: `src/kvm/components/ConsoleHeader.vue` + `ConsoleHeader.test.ts`
- Create: `src/kvm/components/ProgressOverlay.vue`
- Modify: `src/kvm/views/KvmPage.vue` · `src/kvm/styles/kvm.css` · `kvmStyles.test.ts`(白名单已含相关类)

**Interfaces:**
- Consumes: T1 全部派生 · T3 的电源动作
- Produces:
  - `OverflowMenu` props `{ vm: KvmVM, processing: boolean }`,emit `action(name)`,`name ∈ 'start'|'stop'|'restart'|'pause'|'resume'|'wakeup'|'autostart'|'delete'`
  - `ConsoleHeader` props `{ vm: KvmVM, processing: boolean }`,emit `action(name)`
  - `ProgressOverlay` props `{ title: string, message: string }`

**就地二次确认的实现契约**(用户 2026-08-02 拍板照 Vue2):
- 组件内两个 ref:`pendingAction: string`(''/'stop'/'restart'/'delete')、`pendingId: string`
- 只有 **stop / restart / delete** 三项需要确认(Vue2 只给这三项写了 `confirmXxx`);start / pause / resume / wakeup / autostart **直接执行**
- 第一次点:文字换成「确定吗?」并加 `.confirm-text-danger` 类,**不发请求**
- 第二次点同一项:清确认态 → emit action → 关菜单
- 关菜单 / 点菜单外 / 切换 VM → `resetPendingConfirm()`
- **确认目标必须用非响应式变量存**(P4 教训 ③:响应式变量在弹窗关闭动画期间被清空,导致确认落到空目标)

- [ ] **Step 1: 写 `OverflowMenu.test.ts`(失败)**

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import OverflowMenu from './OverflowMenu.vue'
import { i18n } from '../../i18n'
import type { KvmVM } from '@nimotech/nimoos-service'

const VM = (state: string, over: Partial<KvmVM> = {}) =>
  ({ id: 'vm-1', name: 'x', state, autostart: false, ...over } as KvmVM)
const mk = (vm: KvmVM, processing = false) =>
  mount(OverflowMenu, { props: { vm, processing }, global: { plugins: [i18n] } })
const labels = (w: ReturnType<typeof mk>) => w.findAll('.dropdown-item').map((b) => b.text())

describe('菜单项按状态显隐(对 Vue2 :97-135)', () => {
  it('running:关机/重启/暂停/自启,无开机、无删除', () => {
    const t = labels(mk(VM('running')))
    expect(t.some((x) => x.includes('强制关机'))).toBe(true)
    expect(t.some((x) => x.includes('强制重启'))).toBe(true)
    expect(t.some((x) => x.includes('暂停'))).toBe(true)
    expect(t.some((x) => x.includes('开机自启'))).toBe(true)
    expect(t.some((x) => x === '开机')).toBe(false)
    expect(t.some((x) => x.includes('删除'))).toBe(false)
  })
  it('stopped:开机/自启/删除,且删除上方有分隔线', () => {
    const w = mk(VM('stopped'))
    const t = labels(w)
    expect(t.some((x) => x.includes('开机'))).toBe(true)
    expect(t.some((x) => x.includes('删除'))).toBe(true)
    expect(w.find('.dropdown-divider').exists()).toBe(true)
  })
  it('paused:重启/继续,无暂停', () => {
    const t = labels(mk(VM('paused')))
    expect(t.some((x) => x.includes('继续'))).toBe(true)
    expect(t.some((x) => x.includes('强制重启'))).toBe(true)
    expect(t.some((x) => x === '暂停')).toBe(false)
  })
  it('suspended:只有唤醒(+自启)', () => {
    const t = labels(mk(VM('suspended')))
    expect(t.some((x) => x.includes('唤醒'))).toBe(true)
    expect(t.some((x) => x.includes('开机'))).toBe(false)
  })
  it('missing:只能删除,且不画分隔线', () => {
    const w = mk(VM('missing'))
    expect(labels(w).some((x) => x.includes('删除'))).toBe(true)
    expect(w.find('.dropdown-divider').exists()).toBe(false)
  })
  it('autostart 开关的指示点按 vm.autostart 亮灭', () => {
    expect(mk(VM('running', { autostart: true })).get('.toggle-indicator').classes()).toContain('on')
    expect(mk(VM('running')).get('.toggle-indicator').classes()).not.toContain('on')
  })
  it('processing 时自启项禁用(Vue2 :127 的 :disabled="_processing")', () => {
    const item = mk(VM('running'), true).findAll('.dropdown-item').find((b) => b.text().includes('开机自启'))!
    expect(item.attributes('disabled')).toBeDefined()
  })
})

describe('就地二次确认', () => {
  const clickByText = async (w: ReturnType<typeof mk>, txt: string) => {
    const b = w.findAll('.dropdown-item').find((x) => x.text().includes(txt))!
    await b.trigger('click')
    return b
  }

  it('关机第一次点只变文字,不 emit', async () => {
    const w = mk(VM('running'))
    await clickByText(w, '强制关机')
    expect(w.emitted('action')).toBeUndefined()
    expect(w.text()).toContain('确定吗?')
    expect(w.find('.confirm-text-danger').exists()).toBe(true)
  })

  it('第二次点才 emit action("stop")', async () => {
    const w = mk(VM('running'))
    await clickByText(w, '强制关机')
    await clickByText(w, '确定吗?')
    expect(w.emitted('action')![0]).toEqual(['stop'])
  })

  it('重启与删除同样是两次点', async () => {
    const w1 = mk(VM('running'))
    await clickByText(w1, '强制重启'); expect(w1.emitted('action')).toBeUndefined()
    await clickByText(w1, '确定吗?'); expect(w1.emitted('action')![0]).toEqual(['restart'])

    const w2 = mk(VM('stopped'))
    await clickByText(w2, '删除'); expect(w2.emitted('action')).toBeUndefined()
    await clickByText(w2, '确定吗?'); expect(w2.emitted('action')![0]).toEqual(['delete'])
  })

  it('开机/暂停/继续/唤醒/自启是一次点,不需要确认', async () => {
    const a = mk(VM('stopped')); await clickByText(a, '开机')
    expect(a.emitted('action')![0]).toEqual(['start'])
    const b = mk(VM('running')); await clickByText(b, '暂停')
    expect(b.emitted('action')![0]).toEqual(['pause'])
    const c = mk(VM('paused')); await clickByText(c, '继续')
    expect(c.emitted('action')![0]).toEqual(['resume'])
    const d = mk(VM('suspended')); await clickByText(d, '唤醒')
    expect(d.emitted('action')![0]).toEqual(['wakeup'])
    const e = mk(VM('running')); await clickByText(e, '开机自启')
    expect(e.emitted('action')![0]).toEqual(['autostart'])
  })

  it('确认态挂在 stop 上时,点 restart 会把确认态转移过去而不是误触发 stop', async () => {
    const w = mk(VM('running'))
    await clickByText(w, '强制关机')          // stop 进入待确认
    const restart = w.findAll('.dropdown-item').find((x) => x.text().includes('强制重启'))!
    await restart.trigger('click')            // 点了另一项
    expect(w.emitted('action')).toBeUndefined()
    expect(restart.text()).toContain('确定吗?')
  })

  it('父组件调 reset 后确认态清空', async () => {
    const w = mk(VM('running'))
    await clickByText(w, '强制关机')
    ;(w.vm as unknown as { reset: () => void }).reset()
    await w.vm.$nextTick()
    expect(w.text()).not.toContain('确定吗?')
  })
})
```

- [ ] **Step 2: 实现 `OverflowMenu.vue`,跑绿**

`defineExpose({ reset })` 供父组件在关菜单 / 切 VM 时清确认态。样式照 Vue2 `:2130-2199`:`.overflow-dropdown` 绝对定位 `top:100%; right:0; margin-top:.25rem`、底 `var(--kvm-panel)`、`1px solid var(--kvm-border)`、`border-radius:.5rem`、`box-shadow: 0 8px 24px var(--kvm-shadow)`、`z-index:50`、`min-width:10rem`、`padding:.375rem`;`.dropdown-item` `padding:.5rem .75rem`、`font-size:.85rem`、`border-radius:.375rem`、hover `var(--kvm-elev)`;`.is-danger` 文字 `var(--kvm-danger)`、hover `var(--kvm-danger-soft)`;`.confirm-text-danger` 文字 `var(--kvm-danger)`;`.toggle-indicator` `1rem` 圆、灭 `var(--kvm-toggle-off)`、亮 `var(--kvm-ok)`;`.dropdown-divider` `1px` 高、`var(--kvm-border)`、`margin:.25rem 0`。

- [ ] **Step 3: 写 `ConsoleHeader.test.ts` 并实现**

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ConsoleHeader from './ConsoleHeader.vue'
import { i18n } from '../../i18n'
import type { KvmVM } from '@nimotech/nimoos-service'

const VM = (state = 'running') => ({ id: 'vm-1', name: 'sp9-alpine-test', state, os: 'linux', autostart: false } as KvmVM)
const mk = (vm = VM()) => mount(ConsoleHeader, { props: { vm, processing: false }, global: { plugins: [i18n] } })

describe('ConsoleHeader', () => {
  it('显示 VM 名与 OS 图标', () => {
    expect(mk().text()).toContain('sp9-alpine-test')
    expect(mk().find('img.console-os-icon').exists()).toBe(true)
  })
  it('状态点带 state 类', () => {
    expect(mk().get('.console-status .status-dot').classes()).toContain('running')
  })
  it('Settings 按钮渲染但禁用(P6),带 title', () => {
    const b = mk().findAll('.action-btn')[0]
    expect(b.attributes('disabled')).toBeDefined()
    expect(b.attributes('title')).toContain('即将支持')
    expect(b.attributes('aria-label')).toBeTruthy()
  })
  it('⋮ 按钮点击展开菜单,再点收起', async () => {
    const w = mk()
    expect(w.find('.overflow-dropdown').exists()).toBe(false)
    await w.findAll('.action-btn')[1].trigger('click')
    expect(w.find('.overflow-dropdown').exists()).toBe(true)
    await w.findAll('.action-btn')[1].trigger('click')
    expect(w.find('.overflow-dropdown').exists()).toBe(false)
  })
  it('菜单里的 action 透传给父组件,并顺手关菜单', async () => {
    const w = mk(VM('stopped'))
    await w.findAll('.action-btn')[1].trigger('click')
    const item = w.findAll('.dropdown-item').find((b) => b.text().includes('开机'))!
    await item.trigger('click')
    expect(w.emitted('action')![0]).toEqual(['start'])
    expect(w.find('.overflow-dropdown').exists()).toBe(false)
  })
  it('点菜单外面关闭菜单(document click 监听)', async () => {
    const w = mount(ConsoleHeader, { props: { vm: VM(), processing: false },
      global: { plugins: [i18n] }, attachTo: document.body })
    await w.findAll('.action-btn')[1].trigger('click')
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('.overflow-dropdown').exists()).toBe(false)
    w.unmount()
  })
  it('切换 VM 时菜单与确认态一起清空', async () => {
    const w = mk(VM('running'))
    await w.findAll('.action-btn')[1].trigger('click')
    await w.findAll('.dropdown-item').find((b) => b.text().includes('强制关机'))!.trigger('click')
    await w.setProps({ vm: { ...VM('running'), id: 'vm-2' } as KvmVM })
    expect(w.find('.overflow-dropdown').exists()).toBe(false)
  })
  it('卸载时摘掉 document 监听(不泄漏)', () => {
    const w = mount(ConsoleHeader, { props: { vm: VM(), processing: false },
      global: { plugins: [i18n] }, attachTo: document.body })
    const before = (document as unknown as { __c?: number }).__c
    w.unmount()
    expect(before).toBe((document as unknown as { __c?: number }).__c)  // 占位:实现里用 onUnmounted 摘
  })
})
```

> 最后一条测不好写成硬断言 —— 实现者改成:用 `vi.spyOn(document, 'removeEventListener')` 断言 unmount 时被调用过一次、且事件名是 `'click'`。

样式照 Vue2 `:2020-2129`:`.console-header` `padding:1rem`、透明底;`.console-os-icon` `2rem`;`h3` `1rem/600`;`.console-status .status-text` 默认 `opacity:0`,`:hover` 才 `1`(Vue2 特有,照抄);`.action-btn` `2rem` 方、`border-radius:.375rem`、底 `var(--kvm-elev)`、hover `var(--kvm-accent-soft)` + 字 `var(--kvm-accent)`、`:disabled { opacity:.35; cursor:not-allowed }` 且 disabled 下 hover 不变色。

- [ ] **Step 4: `ProgressOverlay.vue` + 接进 `KvmPage.vue`**

Vue2 用 `b-modal` + `b-message` 显示「正在停止 / 正在重启 / 正在删除…」不可取消遮罩(`:495-505`)。New-UI 没有 buefy,自绘:全屏 `position:fixed` 半透明遮罩 + 居中卡片(标题 + 一行消息 + 旋转 spinner)。`can-cancel=false` → 遮罩点击不关闭。

`KvmPage.vue` 里:`stop` / `restart` / `delete` 三个动作确认通过后先设 `progress = { titleKey, name }`,`await` 动作,`finally` 清空。其余动作不显示遮罩(照 Vue2)。

- [ ] **Step 5: 电源动作接线 + 全量 + 提交**

`KvmPage.vue` 的 `onAction(name)` 分派到 `useVmList` 的对应方法。`lastError` 非空时显示在控制台占位区内联(**不用 toast**,硬约束 9)。

Run: `pnpm test && pnpm vue-tsc --noEmit`

```bash
git add src/kvm/components/OverflowMenu.vue src/kvm/components/OverflowMenu.test.ts src/kvm/components/ConsoleHeader.vue src/kvm/components/ConsoleHeader.test.ts src/kvm/components/ProgressOverlay.vue src/kvm/views/KvmPage.vue src/kvm/views/KvmPage.test.ts src/kvm/styles/kvm.css
git commit -m "feat(kvm): 控制台头 + 溢出菜单(就地二次确认)+ 电源动作 + 进度遮罩"
```

---

