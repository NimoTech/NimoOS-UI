## Task 6: `useVncConsole` + ConsoleStage

**Files:**
- Create: `src/kvm/composables/useVncConsole.ts` + `useVncConsole.test.ts`
- Create: `src/kvm/components/ConsoleStage.vue` + `ConsoleStage.test.ts`
- Modify: `src/kvm/views/KvmPage.vue` · `src/kvm/styles/kvm.css`

**Interfaces:**
- Consumes: `service.kvm.getVNC`(T0)· T3 的 `onVncShouldConnect/Disconnect`
- Produces:
```ts
useVncConsole(hostEl: Ref<HTMLElement | null>): {
  connected: Ref<boolean>
  errorKey: Ref<string>          // '' | 'kvmVncPortUnavailable' | 'kvmVncFetchFailed'
  modifiers: Ref<{ ctrl: boolean; alt: boolean; shift: boolean; win: boolean }>
  connect(vm: KvmVM): Promise<void>
  disconnect(): void
  toggleModifier(name: 'ctrl'|'alt'|'shift'|'win'): void
  sendKey(keysym: number): void
  sendCtrlAltDel(): void
  dispose(): void
}
```
- `ConsoleStage` props `{ vm: KvmVM, connected: boolean, errorKey: string, processing: boolean }`,emit `start` / `resume`,expose `hostEl`

**RFB 生命周期契约**(照 Vue2 `:940-1013`,加代际守卫):
1. `connect(vm)`:`vm.state !== 'running'` → 直接 `disconnect()` 返回
2. 自增 `gen`,记 `myGen`
3. `await service.kvm.getVNC(vm.id)` —— **失败** → `disconnect()` + `errorKey = 'kvmVncFetchFailed'`
4. **返回后先比对 `myGen !== gen` → 丢弃**(Vue2 缺这道,快速切换 VM 会把旧 VM 的画面接到新 VM 的容器上 —— **登记为逻辑修正**)
5. 把 `spicePort`/`spiceTlsPort` 回写给调用方(通过回调,别在 composable 里直接改 `vms`)
6. `wsPort || vncPort` 都没有 → `disconnect()` + `errorKey = 'kvmVncPortUnavailable'`
7. `wsUrl = \`ws://${window.location.hostname}:${wsPort ?? vncPort}\`` —— **浏览器直连宿主机端口,不走网关、无鉴权**;本机 ws 口是 5700
8. 销毁旧 RFB、清掉容器里残留的 `<canvas>`,再 `new RFB(host, wsUrl, { scaleViewport: true, resizeSession: false })`
9. 监听 `connect` → `connected = true`;`disconnect` → `connected = false`
10. `disconnect()`:先 `releaseModifiers()`(否则修饰键卡在按下态)→ `rfb.disconnect()` → 置 null → 清 canvas → `connected=false; errorKey=''`

- [ ] **Step 1: 写 `useVncConsole.test.ts`(失败)**

用一个假的 RFB 类替代 `@novnc/novnc`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import type { KvmVM } from '@nimotech/nimoos-service'

const instances: FakeRFB[] = []
class FakeRFB {
  handlers: Record<string, (() => void)[]> = {}
  disconnected = false
  sent: [number, boolean | null][] = []
  cad = 0
  constructor(public el: unknown, public url: string, public opts: unknown) { instances.push(this) }
  addEventListener(ev: string, cb: () => void) { (this.handlers[ev] ||= []).push(cb) }
  fire(ev: string) { (this.handlers[ev] || []).forEach((h) => h()) }
  disconnect() { this.disconnected = true }
  sendKey(k: number, _c: unknown, down: boolean | null = null) { this.sent.push([k, down]) }
  sendCtrlAltDel() { this.cad++ }
}
vi.mock('@novnc/novnc', () => ({ default: FakeRFB }))

const getVNC = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({ service: { get kvm() { return { getVNC } } } }))

import { useVncConsole } from './useVncConsole'

const VM = (over: Partial<KvmVM> = {}) => ({ id: 'vm-1', state: 'running', ...over } as KvmVM)
const host = () => ref(document.createElement('div'))

beforeEach(() => {
  instances.length = 0
  getVNC.mockReset()
  getVNC.mockResolvedValue({ vncPort: 5900, vncWebsocketPort: 5700, spicePort: 5901, spiceTlsPort: 0 })
})

describe('connect', () => {
  it('用 vncWebsocketPort 拼 ws url,直连 location.hostname', async () => {
    const c = useVncConsole(host())
    await c.connect(VM())
    expect(instances[0].url).toBe(`ws://${window.location.hostname}:5700`)
    expect(instances[0].opts).toEqual({ scaleViewport: true, resizeSession: false })
  })

  it('没有 websocket 口时回退 vncPort', async () => {
    getVNC.mockResolvedValue({ vncPort: 5900, vncWebsocketPort: 0, spicePort: 0, spiceTlsPort: 0 })
    const c = useVncConsole(host())
    await c.connect(VM())
    expect(instances[0].url).toBe(`ws://${window.location.hostname}:5900`)
  })

  it('两个端口都没有 → 报端口不可用,不建连接', async () => {
    getVNC.mockResolvedValue({ vncPort: 0, vncWebsocketPort: 0, spicePort: 0, spiceTlsPort: 0 })
    const c = useVncConsole(host())
    await c.connect(VM())
    expect(instances).toHaveLength(0)
    expect(c.errorKey.value).toBe('kvmVncPortUnavailable')
  })

  it('getVNC 失败 → 报获取失败', async () => {
    getVNC.mockRejectedValue(new Error('404'))
    const c = useVncConsole(host())
    await c.connect(VM())
    expect(c.errorKey.value).toBe('kvmVncFetchFailed')
    expect(c.connected.value).toBe(false)
  })

  it('VM 不是 running 时直接不连', async () => {
    const c = useVncConsole(host())
    await c.connect(VM({ state: 'stopped' }))
    expect(getVNC).not.toHaveBeenCalled()
    expect(instances).toHaveLength(0)
  })

  it('RFB 触发 connect/disconnect 事件时同步 connected', async () => {
    const c = useVncConsole(host())
    await c.connect(VM())
    instances[0].fire('connect'); expect(c.connected.value).toBe(true)
    instances[0].fire('disconnect'); expect(c.connected.value).toBe(false)
  })

  it('重复 connect 会先销毁上一个 RFB', async () => {
    const c = useVncConsole(host())
    await c.connect(VM())
    await c.connect(VM())
    expect(instances[0].disconnected).toBe(true)
    expect(instances).toHaveLength(2)
  })

  it('连接前把容器里残留的 canvas 清掉', async () => {
    const h = host()
    h.value!.appendChild(document.createElement('canvas'))
    const c = useVncConsole(h)
    await c.connect(VM())
    expect(h.value!.querySelectorAll('canvas')).toHaveLength(0)
  })

  it('把 spice 端口通过回调交出去(composable 不直接改列表)', async () => {
    const c = useVncConsole(host())
    const onSpice = vi.fn()
    c.onSpicePorts(onSpice)
    await c.connect(VM())
    expect(onSpice).toHaveBeenCalledWith('vm-1', { spicePort: 5901, spiceTlsPort: 0 })
  })
})

describe('代际守卫(修 Vue2 缺失:快速切换 VM 会把旧机器的画面接到新容器上)', () => {
  it('前一次 getVNC 迟到返回时不得建立连接', async () => {
    let slowResolve: (v: unknown) => void = () => {}
    getVNC
      .mockImplementationOnce(() => new Promise((r) => { slowResolve = r }))
      .mockResolvedValueOnce({ vncPort: 0, vncWebsocketPort: 5701, spicePort: 0, spiceTlsPort: 0 })
    const c = useVncConsole(host())
    const slow = c.connect(VM({ id: 'a' }))
    await c.connect(VM({ id: 'b' }))
    slowResolve({ vncPort: 0, vncWebsocketPort: 5700, spicePort: 0, spiceTlsPort: 0 })
    await slow
    expect(instances).toHaveLength(1)
    expect(instances[0].url).toContain('5701')     // 只有后发那次生效
  })

  it('dispose 之后迟到的 getVNC 不建连接', async () => {
    let r: (v: unknown) => void = () => {}
    getVNC.mockImplementationOnce(() => new Promise((x) => { r = x }))
    const c = useVncConsole(host())
    const p = c.connect(VM())
    c.dispose()
    r({ vncPort: 0, vncWebsocketPort: 5700, spicePort: 0, spiceTlsPort: 0 })
    await p
    expect(instances).toHaveLength(0)
  })
})

describe('修饰键与按键', () => {
  it('toggleModifier 按下再抬起,状态跟着翻转', async () => {
    const c = useVncConsole(host())
    await c.connect(VM())
    c.toggleModifier('ctrl')
    expect(c.modifiers.value.ctrl).toBe(true)
    expect(instances[0].sent.at(-1)).toEqual([0xffe3, true])
    c.toggleModifier('ctrl')
    expect(c.modifiers.value.ctrl).toBe(false)
    expect(instances[0].sent.at(-1)).toEqual([0xffe3, false])
  })

  it('四个修饰键的 keysym 正确(Vue2 :1015-1035)', async () => {
    const c = useVncConsole(host())
    await c.connect(VM())
    c.toggleModifier('alt'); expect(instances[0].sent.at(-1)![0]).toBe(0xffe9)
    c.toggleModifier('shift'); expect(instances[0].sent.at(-1)![0]).toBe(0xffe1)
    c.toggleModifier('win'); expect(instances[0].sent.at(-1)![0]).toBe(0xffeb)
  })

  it('disconnect 时把按下的修饰键全部释放(否则卡在按下态)', async () => {
    const c = useVncConsole(host())
    await c.connect(VM())
    c.toggleModifier('ctrl'); c.toggleModifier('alt')
    const rfb = instances[0]
    c.disconnect()
    expect(rfb.sent.filter(([, d]) => d === false).map(([k]) => k).sort()).toEqual([0xffe3, 0xffe9].sort())
    expect(c.modifiers.value.ctrl).toBe(false)
    expect(c.modifiers.value.alt).toBe(false)
  })

  it('sendKey 直接透传', async () => {
    const c = useVncConsole(host())
    await c.connect(VM())
    c.sendKey(0xff09)
    expect(instances[0].sent.at(-1)).toEqual([0xff09, null])
  })

  it('sendCtrlAltDel 调 RFB 的专用方法并清空所有修饰键状态', async () => {
    const c = useVncConsole(host())
    await c.connect(VM())
    c.toggleModifier('ctrl')
    c.sendCtrlAltDel()
    expect(instances[0].cad).toBe(1)
    expect(c.modifiers.value.ctrl).toBe(false)
  })

  it('没有连接时按键调用是空操作,不抛', () => {
    const c = useVncConsole(host())
    expect(() => { c.sendKey(0xff09); c.sendCtrlAltDel(); c.toggleModifier('ctrl') }).not.toThrow()
  })

  it('RFB.sendKey 抛异常时被吞掉、不冒泡(照 Vue2 的 try/catch)', async () => {
    const c = useVncConsole(host())
    await c.connect(VM())
    instances[0].sendKey = () => { throw new Error('socket closed') }
    expect(() => c.sendKey(0xff1b)).not.toThrow()
  })
})
```

- [ ] **Step 2: 实现 `useVncConsole.ts`,跑绿**

代际守卫处必须写注释登记与 Vue2 的偏离:
```ts
// ⚠️ 与 Vue2 的偏离(SP9-P5 登记):Vue2 connectVNC(:952)拿到 /vnc 响应后直接建连,
// 没有代际判定。快速切换 VM 时,先发的那次响应可能晚于后发的一次到达,于是把 A 机器的
// 画面接到了已经切到 B 的容器上(且 B 的 RFB 被 A 覆盖)。这里加 gen 守卫,过期即丢弃。
```

- [ ] **Step 3: `ConsoleStage.test.ts` + 实现**

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ConsoleStage from './ConsoleStage.vue'
import { i18n } from '../../i18n'
import type { KvmVM } from '@nimotech/nimoos-service'

const VM = (state: string) => ({ id: 'v', name: 'x', state } as KvmVM)
const mk = (p: Record<string, unknown> = {}) =>
  mount(ConsoleStage, { props: { vm: VM('running'), connected: false, errorKey: '', processing: false, ...p },
    global: { plugins: [i18n] } })

describe('ConsoleStage 占位层', () => {
  it('未连接时显示占位层,连上后隐藏', () => {
    expect(mk().find('.console-placeholder').exists()).toBe(true)
    expect(mk({ connected: true }).find('.console-placeholder').exists()).toBe(false)
  })
  it('stopped 时显示开机大按钮,点了 emit start', async () => {
    const w = mk({ vm: VM('stopped') })
    const b = w.get('.start-vm-btn')
    await b.trigger('click')
    expect(w.emitted('start')).toHaveLength(1)
  })
  it('paused 时显示继续大按钮,点了 emit resume', async () => {
    const w = mk({ vm: VM('paused') })
    await w.get('.start-vm-btn').trigger('click')
    expect(w.emitted('resume')).toHaveLength(1)
  })
  it('running 但没连上时不显示大按钮(照 Vue2 :168-190 的 v-if 条件)', () => {
    expect(mk().find('.start-vm-btn').exists()).toBe(false)
  })
  it('processing 时大按钮禁用', () => {
    expect(mk({ vm: VM('stopped'), processing: true }).get('.start-vm-btn').attributes('disabled')).toBeDefined()
  })
  it('有错误时显示红色错误文案,且不显示大按钮(Vue2 的 v-if/else)', () => {
    const w = mk({ vm: VM('stopped'), errorKey: 'kvmVncFetchFailed' })
    expect(w.get('.console-hint').classes()).toContain('is-error')
    expect(w.text()).toContain('获取 VNC 信息失败')
    expect(w.find('.start-vm-btn').exists()).toBe(false)
  })
  it('暴露 hostEl 供 composable 挂 RFB', () => {
    const w = mk()
    expect((w.vm as unknown as { hostEl: HTMLElement }).hostEl).toBeTruthy()
  })
  it('大按钮有 aria-label', () => {
    expect(mk({ vm: VM('stopped') }).get('.start-vm-btn').attributes('aria-label')).toBeTruthy()
  })
})
```

样式照 Vue2 `:2204-2288`:`.console-display` `flex:1; height:0; min-height:300px; border-radius:.75rem; overflow:hidden; position:relative`,`:fullscreen` 时圆角归零;内部 `canvas` 绝对定位铺满 + `object-fit:contain` + `z-index:2`;`.console-placeholder` 绝对铺满 `z-index:1`;`.start-vm-btn` 128px 方、透明底、`:disabled{opacity:.5}`。

- [ ] **Step 4: 接进 `KvmPage.vue`**

把 `useVmList` 的 `onVncShouldConnect/Disconnect` 接到 `useVncConsole` 的 `connect/disconnect`;`ConsoleStage` 的 `hostEl` 传给 `useVncConsole`。切换 VM 时(`selectVM`)照 Vue2 watch 逻辑:新 VM 是 running 就连、否则断。

- [ ] **Step 5: 全量 + 真机验收控制台出画面 + 提交**

Run: `pnpm test && pnpm vue-tsc --noEmit`;`pnpm dev --host` → `#/kvm` → 点 `sp9-alpine-test` → **控制台应出现 Alpine 画面**。若黑屏,先确认 `ws://<ip>:5700` 从浏览器可达(防火墙)。

```bash
git add src/kvm/composables/useVncConsole.ts src/kvm/composables/useVncConsole.test.ts src/kvm/components/ConsoleStage.vue src/kvm/components/ConsoleStage.test.ts src/kvm/views/KvmPage.vue src/kvm/views/KvmPage.test.ts src/kvm/styles/kvm.css
git commit -m "feat(kvm): noVNC 控制台(RFB 生命周期/代际守卫/修饰键/占位与错误态)"
```

---

