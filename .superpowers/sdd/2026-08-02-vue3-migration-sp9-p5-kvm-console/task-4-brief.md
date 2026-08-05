## Task 4: 左侧栏两个组件

**Files:**
- Create: `src/kvm/components/VmListItem.vue` + `VmListItem.test.ts`
- Create: `src/kvm/components/VmSidebar.vue` + `VmSidebar.test.ts`
- Modify: `src/kvm/views/KvmPage.vue`(把 T2 的占位 `<aside>` 换成 `<VmSidebar>`)
- Modify: `src/kvm/styles/kvm.css`(追加列表项与状态点样式)

**Interfaces:**
- Consumes: `osIconFor` / `formatRam` / `stateLabelKey`(T1)· `useVmList`(T3)
- Produces:
  - `VmListItem` props `{ vm: KvmVM, active: boolean }`,emit `select`
  - `VmSidebar` props `{ vms: KvmVM[], selectedId: string | null, runningCount: number, isLoading: boolean, collapsed: boolean }`,emit `select(vm)`

- [ ] **Step 1: 写 `VmListItem.test.ts`(失败)**

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import VmListItem from './VmListItem.vue'
import { i18n } from '../../i18n'
import type { KvmVM } from '@nimotech/nimoos-service'

const VM = (over: Partial<KvmVM> = {}) => ({
  id: 'vm-1', name: 'sp9-alpine-test', state: 'running', vcpu: 2, memory: 1024,
  os: 'linux', ...over,
} as KvmVM)

const mk = (vm = VM(), active = false) =>
  mount(VmListItem, { props: { vm, active }, global: { plugins: [i18n] } })

describe('VmListItem', () => {
  it('显示名字、vCPU 数、内存(照 Vue2 :47-50 的 "2 vCPU" / "1.0 GB")', () => {
    const t = mk().text()
    expect(t).toContain('sp9-alpine-test')
    expect(t).toContain('2 vCPU')
    expect(t).toContain('1.0 GB')
  })

  it('状态点带 state 类,文字走 i18n', () => {
    const w = mk()
    expect(w.get('.status-dot').classes()).toContain('running')
    expect(w.text()).toContain('运行中')
  })

  it('未知状态(crashed)原样显示后端字符串,不显示空白', () => {
    expect(mk(VM({ state: 'crashed' })).text()).toContain('crashed')
  })

  it('active 时加 active 类', () => {
    expect(mk(VM(), true).classes()).toContain('active')
    expect(mk(VM(), false).classes()).not.toContain('active')
  })

  it('点击 emit select', async () => {
    const w = mk()
    await w.trigger('click')
    expect(w.emitted('select')).toHaveLength(1)
  })

  it('OS 图标 alt 用 os 字段(可访问性)', () => {
    expect(mk(VM({ os: 'ubuntu' })).get('img.os-icon').attributes('alt')).toBe('ubuntu')
  })

  it('长名字不撑破:类上有省略号样式钩子', () => {
    expect(mk(VM({ name: 'a'.repeat(80) })).find('.vm-item-name').exists()).toBe(true)
  })
})
```

- [ ] **Step 2: 实现 `VmListItem.vue`,跑测试转绿**

模板照 Vue2 `KVMFullPage.vue:36-59`。样式追加到 `kvm.css`,数值照 `:1836-1948`:`.vm-list-item` padding `.75rem`、`margin-bottom:.25rem`、`border-radius:.5rem`、`border:1px solid transparent`,hover `background: var(--kvm-elev)`,active `background: var(--kvm-accent-soft); border-color: var(--kvm-accent)`;`.vm-item-icon` `2.25rem` 方、`border-radius:.5rem`、底 `var(--kvm-elev)`、`margin-right:.75rem`,内 `.os-icon` `1.5rem`;`.vm-item-name` `.9rem/500` + 省略号三件套;`.vm-item-specs` `gap:.75rem; font-size:.75rem`;`.vm-item-status .status-dot` `.5rem` 方圆点,running/paused/suspended/error 各带呼吸动画(`breathe-green` 2s / `breathe-yellow` 2s / `breathe-yellow` 4s / `breathe-red` 2s),stopped 纯 `var(--kvm-idle)`;`.status-text` `.65rem`、`margin-left:.375rem`。三个 `@keyframes breathe-*` 照 `:2762-2793`。

- [ ] **Step 3: 写 `VmSidebar.test.ts`(失败)**

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import VmSidebar from './VmSidebar.vue'
import { i18n } from '../../i18n'
import type { KvmVM } from '@nimotech/nimoos-service'

const VM = (id: string, state = 'running') => ({ id, name: id, state, vcpu: 1, memory: 512, os: 'linux' } as KvmVM)
const mk = (props: Partial<InstanceType<typeof VmSidebar>['$props']> = {}) =>
  mount(VmSidebar, {
    props: { vms: [VM('a'), VM('b', 'stopped')], selectedId: 'a', runningCount: 1, isLoading: false, collapsed: false, ...props },
    global: { plugins: [i18n] },
  })

describe('VmSidebar', () => {
  it('头部显示 "1 / 2 运行中"', () => {
    expect(mk().get('.kvm-status').text().replace(/\s+/g, ' ')).toContain('1 / 2 运行中')
  })

  it('有运行中的机器时头部状态点亮起', () => {
    expect(mk().get('.kvm-status .status-dot').classes()).toContain('running')
    expect(mk({ runningCount: 0 }).get('.kvm-status .status-dot').classes()).not.toContain('running')
  })

  it('渲染出每台 VM', () => {
    expect(mk().findAll('.vm-list-item')).toHaveLength(2)
  })

  it('点某台 emit select 并带上那台的对象', async () => {
    const w = mk()
    await w.findAll('.vm-list-item')[1].trigger('click')
    expect((w.emitted('select')![0][0] as KvmVM).id).toBe('b')
  })

  it('空列表且已加载完 → 显示空态文案', () => {
    expect(mk({ vms: [], runningCount: 0 }).text()).toContain('暂无虚拟机')
  })

  it('加载中且列表为空 → 不显示空态(照 Vue2 v-if="vms.length===0 && !isLoading")', () => {
    expect(mk({ vms: [], runningCount: 0, isLoading: true }).text()).not.toContain('暂无虚拟机')
  })

  it('Add VM 按钮渲染但禁用,带 title 说明(P6 才实现)', () => {
    const btn = mk().get('.add-vm-btn')
    expect(btn.attributes('disabled')).toBeDefined()
    expect(btn.attributes('title')).toContain('即将支持')
  })

  it('头部齿轮(全局设置)同样渲染但禁用', () => {
    const btn = mk().get('.kvm-settings-btn')
    expect(btn.attributes('disabled')).toBeDefined()
    expect(btn.attributes('aria-label')).toBeTruthy()
  })

  it('collapsed 透传到根元素', () => {
    expect(mk({ collapsed: true }).classes()).toContain('collapsed')
  })
})
```

- [ ] **Step 4: 实现 `VmSidebar.vue`,把 `KvmPage.vue` 接上,跑测试**

模板照 Vue2 `:10-67`。**Add VM / 齿轮两个按钮渲染但 `disabled` + `:title="t('kvmComingSoon')"`**(用户 2026-08-02 拍板);齿轮要有 `aria-label`,图标用单色符号,**不许 emoji**。`KvmPage.vue` 里引入 `useVmList`,`onMounted` 调 `fetchVMs()`,`onUnmounted` 调 `dispose()`。

- [ ] **Step 5: 全量 + dev server 目视 + 提交**

Run: `pnpm test && pnpm vue-tsc --noEmit`;`pnpm dev --host` 看 `#/kvm` 左栏出现 `sp9-alpine-test` 一行、状态点绿色呼吸、头部「1 / 1 运行中」

```bash
git add src/kvm/components/VmListItem.vue src/kvm/components/VmListItem.test.ts src/kvm/components/VmSidebar.vue src/kvm/components/VmSidebar.test.ts src/kvm/views/KvmPage.vue src/kvm/views/KvmPage.test.ts src/kvm/styles/kvm.css src/kvm/styles/kvmStyles.test.ts
git commit -m "feat(kvm): 左侧 VM 列表(状态呼吸点/运行计数/P6 入口占位禁用)"
```

---

