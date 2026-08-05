## Task 1: 三个纯函数 util

**Files:**
- Create: `NimoOS-New-UI/src/kvm/util/vmState.ts` + `vmState.test.ts`
- Create: `NimoOS-New-UI/src/kvm/util/format.ts` + `format.test.ts`
- Create: `NimoOS-New-UI/src/kvm/util/spicePreserve.ts` + `spicePreserve.test.ts`

**Interfaces:**
- Consumes: `KvmVM`(T0)
- Produces:
  - `canPowerOn(vm) / canShutDown(vm) / canRestart(vm) / canPause(vm) / canResume(vm) / canWakeUp(vm) / canDelete(vm) / canEditSettings(vm): boolean`(参数 `vm: KvmVM | null | undefined`)
  - `showDeleteDivider(vm): boolean`
  - `stateLabelKey(state: string): string`(返回 i18n key 或原始 state)
  - `formatRam(mb: number): string` / `formatHostMem(mb: number): string`
  - `osIconFor(os: string): string`(返回 import 后的 svg url)
  - `preserveSpice(fresh: KvmVM, old: Pick<KvmVM,'spicePort'|'spiceTlsPort'> | null | undefined): KvmVM`

- [ ] **Step 1: 写 `vmState.test.ts`(失败)**

```ts
import { describe, it, expect } from 'vitest'
import type { KvmVM } from '@nimotech/nimoos-service'
import {
  canPowerOn, canShutDown, canRestart, canPause, canResume, canWakeUp,
  canDelete, canEditSettings, showDeleteDivider, stateLabelKey,
} from './vmState'

const vm = (state: string) => ({ id: 'x', state } as KvmVM)

describe('电源动作可用性派生(逐字对 Vue2 KVMFullPage.vue:665-700 的 computed)', () => {
  it('canPowerOn:stopped / crashed', () => {
    expect(canPowerOn(vm('stopped'))).toBe(true)
    expect(canPowerOn(vm('crashed'))).toBe(true)
    expect(canPowerOn(vm('running'))).toBe(false)
    expect(canPowerOn(vm('paused'))).toBe(false)
    expect(canPowerOn(vm('missing'))).toBe(false)
  })
  it('canShutDown:只有 running', () => {
    expect(canShutDown(vm('running'))).toBe(true)
    expect(canShutDown(vm('paused'))).toBe(false)
  })
  it('canRestart:running / paused', () => {
    expect(canRestart(vm('running'))).toBe(true)
    expect(canRestart(vm('paused'))).toBe(true)
    expect(canRestart(vm('stopped'))).toBe(false)
  })
  it('canPause:只有 running', () => {
    expect(canPause(vm('running'))).toBe(true)
    expect(canPause(vm('suspended'))).toBe(false)
  })
  it('canResume:只有 paused', () => {
    expect(canResume(vm('paused'))).toBe(true)
    expect(canResume(vm('suspended'))).toBe(false)
  })
  it('canWakeUp:只有 suspended', () => {
    expect(canWakeUp(vm('suspended'))).toBe(true)
    expect(canWakeUp(vm('paused'))).toBe(false)
  })
  it('canDelete:stopped / crashed / missing', () => {
    expect(canDelete(vm('stopped'))).toBe(true)
    expect(canDelete(vm('crashed'))).toBe(true)
    expect(canDelete(vm('missing'))).toBe(true)
    expect(canDelete(vm('running'))).toBe(false)
  })
  it('canEditSettings:stopped / crashed', () => {
    expect(canEditSettings(vm('stopped'))).toBe(true)
    expect(canEditSettings(vm('crashed'))).toBe(true)
    expect(canEditSettings(vm('running'))).toBe(false)
  })
  it('全部派生对 null 一律 false,不抛', () => {
    for (const f of [canPowerOn, canShutDown, canRestart, canPause, canResume, canWakeUp, canDelete, canEditSettings]) {
      expect(f(null)).toBe(false)
      expect(f(undefined)).toBe(false)
    }
  })
})

describe('showDeleteDivider', () => {
  it('crashed 时既能开机又能删 → 需要分隔线', () => {
    expect(showDeleteDivider(vm('crashed'))).toBe(true)
  })
  it('stopped 时也是既能开机又能删 → 需要分隔线', () => {
    expect(showDeleteDivider(vm('stopped'))).toBe(true)
  })
  it('missing 时只能删、没有任何电源项 → 不要分隔线', () => {
    expect(showDeleteDivider(vm('missing'))).toBe(false)
  })
  it('running 时不能删 → 不要分隔线', () => {
    expect(showDeleteDivider(vm('running'))).toBe(false)
  })
  it('null 不抛', () => {
    expect(showDeleteDivider(null)).toBe(false)
  })
})

describe('stateLabelKey', () => {
  it('五个已知状态映射到 i18n key', () => {
    expect(stateLabelKey('running')).toBe('kvmStateRunning')
    expect(stateLabelKey('stopped')).toBe('kvmStateStopped')
    expect(stateLabelKey('paused')).toBe('kvmStatePaused')
    expect(stateLabelKey('suspended')).toBe('kvmStateSuspended')
    expect(stateLabelKey('error')).toBe('kvmStateError')
  })
  it('未知状态原样返回(照 Vue2:crashed/missing 没有映射,直接显示原文)', () => {
    expect(stateLabelKey('crashed')).toBe('crashed')
    expect(stateLabelKey('missing')).toBe('missing')
    expect(stateLabelKey('')).toBe('')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm vitest run src/kvm/util/vmState.test.ts`
Expected: FAIL —— 找不到模块

- [ ] **Step 3: 实现 `src/kvm/util/vmState.ts`**

```ts
import type { KvmVM } from '@nimotech/nimoos-service'

// 电源动作可用性派生。逐字对 Vue2 components/KVM/KVMFullPage.vue:665-700 的 computed。
// 抽成纯函数(Vue2 是绑在 selectedVM 上的 computed)—— 行为一致,但能单测,且列表项
// 与菜单可以共用同一套判定。
type MaybeVM = Pick<KvmVM, 'state'> | null | undefined

const is = (vm: MaybeVM, ...states: string[]) => !!vm && states.includes(vm.state)

export const canPowerOn = (vm: MaybeVM) => is(vm, 'stopped', 'crashed')
export const canShutDown = (vm: MaybeVM) => is(vm, 'running')
export const canRestart = (vm: MaybeVM) => is(vm, 'running', 'paused')
export const canPause = (vm: MaybeVM) => is(vm, 'running')
export const canResume = (vm: MaybeVM) => is(vm, 'paused')
export const canWakeUp = (vm: MaybeVM) => is(vm, 'suspended')
export const canDelete = (vm: MaybeVM) => is(vm, 'stopped', 'crashed', 'missing')
/** 设置只能在关机态改(Vue2 canEditSettings)。P5 里 Settings 按钮恒禁用,这个派生留给 P6。 */
export const canEditSettings = (vm: MaybeVM) => is(vm, 'stopped', 'crashed')

/** 删除项上方要不要画分隔线:能删、且上面至少还有一个电源项时才画。 */
export const showDeleteDivider = (vm: MaybeVM) =>
  canDelete(vm) &&
  (canPowerOn(vm) || canShutDown(vm) || canRestart(vm) || canPause(vm) || canResume(vm) || canWakeUp(vm))

// Vue2 getStateLabel(:1615)只映射这五个,crashed / missing 落到 `|| state` 分支
// 直接显示后端原文。照抄——不自作主张补映射(界面 1:1)。
const LABEL: Record<string, string> = {
  running: 'kvmStateRunning',
  stopped: 'kvmStateStopped',
  paused: 'kvmStatePaused',
  suspended: 'kvmStateSuspended',
  error: 'kvmStateError',
}

/** 返回 i18n key;未知状态返回原始 state 字符串,调用处用 te() 判断后决定是否 t()。 */
export const stateLabelKey = (state: string) => LABEL[state] ?? state
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/kvm/util/vmState.test.ts`
Expected: PASS

- [ ] **Step 5: 写 `format.test.ts`(失败)**

```ts
import { describe, it, expect } from 'vitest'
import { formatRam, formatHostMem, osIconFor } from './format'

describe('formatRam(逐字对 Vue2 :1633-1636)', () => {
  it('>= 1024 MB 换算成 GB,一位小数', () => {
    expect(formatRam(1024)).toBe('1.0 GB')
    expect(formatRam(2048)).toBe('2.0 GB')
    expect(formatRam(1536)).toBe('1.5 GB')
    expect(formatRam(10254)).toBe('10.0 GB')
  })
  it('< 1024 MB 保持 MB', () => {
    expect(formatRam(512)).toBe('512 MB')
    expect(formatRam(1023)).toBe('1023 MB')
  })
  it('0 / NaN / undefined 一律 "0 MB"(Vue2 的 !mb 分支)', () => {
    expect(formatRam(0)).toBe('0 MB')
    expect(formatRam(NaN)).toBe('0 MB')
    expect(formatRam(undefined as unknown as number)).toBe('0 MB')
  })
})

describe('formatHostMem 与 formatRam 行为一致(Vue2 里是两个同实现的方法)', () => {
  it('同输入同输出', () => {
    for (const v of [0, 512, 1024, 10254]) expect(formatHostMem(v)).toBe(formatRam(v))
  })
})

describe('osIconFor(逐字对 Vue2 :1619-1631 的匹配顺序)', () => {
  it('按子串命中各发行版', () => {
    expect(osIconFor('Windows 11')).toContain('windows')
    expect(osIconFor('ubuntu-2404')).toContain('ubuntu')
    expect(osIconFor('Debian 13')).toContain('debian')
    expect(osIconFor('CentOS Stream 9')).toContain('centos')
    expect(osIconFor('alpine-319')).toContain('alpine')
    expect(osIconFor('Arch Linux')).toContain('arch')
    expect(osIconFor('FreeBSD 14')).toContain('freebsd')
  })
  it('大小写不敏感', () => {
    expect(osIconFor('UBUNTU')).toBe(osIconFor('ubuntu'))
  })
  it('认不出来的一律回退 linux 图标;空/undefined 同样', () => {
    const fallback = osIconFor('linux')
    expect(osIconFor('gentoo')).toBe(fallback)
    expect(osIconFor('')).toBe(fallback)
    expect(osIconFor(undefined as unknown as string)).toBe(fallback)
  })
  it('win 优先于其它:名字里同时含 win 和 arch 时取 windows', () => {
    // Vue2 的 if 链顺序:win 在最前
    expect(osIconFor('win-arch')).toContain('windows')
  })
})
```

- [ ] **Step 6: 跑测试确认失败,然后实现 `src/kvm/util/format.ts`**

Run: `pnpm vitest run src/kvm/util/format.test.ts` → FAIL

```ts
import windowsIcon from '../assets/windows.svg'
import ubuntuIcon from '../assets/ubuntu.svg'
import debianIcon from '../assets/debian.svg'
import centosIcon from '../assets/centos.svg'
import alpineIcon from '../assets/alpine.svg'
import archIcon from '../assets/arch.svg'
import freebsdIcon from '../assets/freebsd.svg'
import linuxIcon from '../assets/linux.svg'

/** 内存格式化。逐字对 Vue2 KVMFullPage.vue:1633-1636(formatRam / formatHostMem 同实现)。 */
export function formatRam(mb: number): string {
  if (!mb) return '0 MB'
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`
}

/** Vue2 里 formatHostMem 与 formatRam 是两个一模一样的方法。保留两个名字以对齐调用处语义。 */
export const formatHostMem = formatRam

// Vue2 getOsIcon(:1619-1631)的 if 链,**顺序有意义**(win 在最前)。照抄顺序。
const ICONS: [string, string][] = [
  ['win', windowsIcon],
  ['ubuntu', ubuntuIcon],
  ['debian', debianIcon],
  ['centos', centosIcon],
  ['alpine', alpineIcon],
  ['arch', archIcon],
  ['freebsd', freebsdIcon],
]

export function osIconFor(os: string): string {
  const lower = (os || '').toLowerCase()
  for (const [key, icon] of ICONS) if (lower.includes(key)) return icon
  return linuxIcon
}
```

> ⚠️ 本步依赖 T2 拷进来的 svg。**执行顺序上 T2 的「拷图标」子步骤要提前到这里做**:先 `cp /home/nimo/NimoTech/NimoOS-UI/src/assets/img/kvm/*.svg /home/nimo/NimoTech/NimoOS-New-UI/src/kvm/assets/`(13 个文件),再跑测试。

- [ ] **Step 7: 跑测试确认通过**

Run: `pnpm vitest run src/kvm/util/format.test.ts`
Expected: PASS

- [ ] **Step 8: 写 `spicePreserve.test.ts`(失败)**

```ts
import { describe, it, expect } from 'vitest'
import type { KvmVM } from '@nimotech/nimoos-service'
import { preserveSpice } from './spicePreserve'

const mk = (over: Partial<KvmVM>) => ({ id: 'a', name: 'vm', state: 'running',
  spicePort: 0, spiceTlsPort: 0, ...over } as KvmVM)

describe('preserveSpice —— 列表接口不返回 spicePort 时的保活合并', () => {
  it('新数据缺 spicePort、旧数据有 → 沿用旧值(含 TlsPort)', () => {
    const out = preserveSpice(mk({ spicePort: 0, spiceTlsPort: 0 }), { spicePort: 5901, spiceTlsPort: 5902 })
    expect(out.spicePort).toBe(5901)
    expect(out.spiceTlsPort).toBe(5902)
  })
  it('新数据自己有 spicePort → 以新数据为准,不被旧值覆盖', () => {
    const out = preserveSpice(mk({ spicePort: 5911, spiceTlsPort: 0 }), { spicePort: 5901, spiceTlsPort: 5902 })
    expect(out.spicePort).toBe(5911)
    expect(out.spiceTlsPort).toBe(0)
  })
  it('旧数据也没有 → 保持新数据的 0', () => {
    expect(preserveSpice(mk({}), { spicePort: 0, spiceTlsPort: 0 }).spicePort).toBe(0)
  })
  it('旧数据为 null / undefined → 原样返回', () => {
    expect(preserveSpice(mk({ spicePort: 7 }), null).spicePort).toBe(7)
    expect(preserveSpice(mk({ spicePort: 7 }), undefined).spicePort).toBe(7)
  })
  it('不修改入参,返回新对象(避免在 reactive 数组里就地改引发的连锁更新)', () => {
    const fresh = mk({ spicePort: 0 })
    const out = preserveSpice(fresh, { spicePort: 5901, spiceTlsPort: 0 })
    expect(fresh.spicePort).toBe(0)
    expect(out).not.toBe(fresh)
  })
  it('其余字段全部来自新数据', () => {
    const out = preserveSpice(mk({ state: 'stopped', name: 'new-name', spicePort: 0 }),
      { spicePort: 5901, spiceTlsPort: 0 })
    expect(out.state).toBe('stopped')
    expect(out.name).toBe('new-name')
  })
})
```

- [ ] **Step 9: 实现 `src/kvm/util/spicePreserve.ts`**

```ts
import type { KvmVM } from '@nimotech/nimoos-service'

type SpicePorts = Pick<KvmVM, 'spicePort' | 'spiceTlsPort'>

/**
 * spicePort 保活合并。
 *
 * 为什么需要它:后端 `ListVMs`(service/vm_service.go:245-262)吐的是内存快照,而
 * spicePort / spiceTlsPort 只有在 `GetVMVNCInfo`(:700-703)被调用时才回写进那个快照。
 * 所以列表里的 spicePort **可能陈旧、也可能是 0**(KVM 服务重启后、或从未开过控制台时),
 * 并非稳定可信的数据源;唯一权威来源是 `GET /v1/kvm/vms/:id/vnc`。若不做兜底,刷新列表
 * 时会把之前从 /vnc 拿到的真实端口冲成 0,SPICE 提示条闪一下就消失。
 *
 * Vue2 用「新值 <= 0 且旧值 > 0 就沿用旧值」兜底(KVMFullPage.vue:893-897 / :919-922 /
 * :930-936,同一段逻辑抄了三遍)。**这是后端字段缺失的兜底,不是 bug**,照抄;
 * 这里抽成一个纯函数,三处调用点共用。
 */
export function preserveSpice(fresh: KvmVM, old: SpicePorts | null | undefined): KvmVM {
  if (!old) return fresh
  if (fresh.spicePort > 0 || !(old.spicePort > 0)) return fresh
  return { ...fresh, spicePort: old.spicePort, spiceTlsPort: old.spiceTlsPort }
}
```

- [ ] **Step 10: 跑三个 util 的测试 + 全量**

Run: `pnpm vitest run src/kvm/util/` 然后 `pnpm test`
Expected: 三个文件全绿;全量相对基线不新增红

- [ ] **Step 11: 提交(显式 pathspec)**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git add src/kvm/util/ src/kvm/assets/
git commit -m "feat(kvm): 状态派生/格式化/spice 保活三个纯函数 util + OS 图标"
```

---


