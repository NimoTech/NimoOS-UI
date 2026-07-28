# SP6-P1 存储区骨架 + 只读列表 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 New-UI 建立 `/storage` 路由区骨架,交付存储卷列表(含卸载)与物理盘列表两个只读页 + 磁盘热插拔刷新 + 主页入口,并为 5273 预览端口配好 API 代理。

**Architecture:** 纯映射函数(TS + 单测)→ Pinia setup store(service 域调用 + toast)→ StorageShell 自带头部(回主页 + 页签)包两个视图;主页入口走 SYSTEM_APPS + useOpenAction 应用内跳转。全部工作在 `.sp6/NimoOS-New-UI` worktree(分支 `sp6-storage`)。

**Tech Stack:** Vue 3 `<script setup>` + Pinia + vue-router 4 + vue-i18n 9 + reka-ui(经 `src/components/ui/Dialog.vue` 壳)+ `@nimotech/nimoos-service`(P0 已补 `disks`/`raid` 域)。

## Global Constraints

- 工作目录:`/home/nimo/NimoTech/.sp6/NimoOS-New-UI`,分支 `sp6-storage`。**禁止**触碰 `/home/nimo/NimoTech/NimoOS-New-UI`(主检出)、NimoOS-UI 仓、`deploy.sh`、`/var/lib/nimoos`。
- 包管理器 pnpm。测试命令:`pnpm test`(vitest 全量),类型检查:`pnpm exec vue-tsc --noEmit`。
- **一切可见颜色必须是 theme token(`var(--…)`)**,禁止 hex/rgb/具名色字面量(`src/styles/color-guard.test.ts` 强制;例外须带 `theme-exception` 注释,仅限既有例外类)。
- **i18n 键必须同时加进 `src/i18n/zh_cn.ts` 与 `src/i18n/en_us.ts`**(`parity.test.ts` 强制),平铺 camelCase,存储区统一 `storage*` 前缀。
- **后端契约(2026-07-23 真机核实)**:`GET /v1/storage?system=show` 返回的 children 里 `size`/`avail`/`used` 是**字符串**,必须 `Number()` 显式转换;系统卷判定 `disk_name === "System"`;占用率 `100 - Math.floor(avail*100/size)`(与 Vue2 逐字一致)。
- **卸载契约**:`DELETE /v1/disks`,body `{ path: <父盘路径>, password: <登录密码> }`——注意 path 是卷条目的 `disk`(父盘 path),不是分区 path。
- MessageBus 订阅 handler **不可阻塞**(buffer=1):热插拔刷新用 500ms `setTimeout` 防抖(Vue2 MountList 先例)。
- service 调用一律 `import { service } from '@nimotech/nimoos-service'`;测试里在模块边界 `vi.mock('@nimotech/nimoos-service', …)`(hoisted,先 mock 后 import store)。
- 语义色:良好 `var(--sem-fg)`,警示 `var(--dem-fg)`,危险 `var(--remove-fg)`,主进度 `var(--accent)`。
- 容量格式化复用 `src/home/util/format.ts` 的 `fmtSize`,不得另写字节格式化。

---

### Task 1: storage 映射纯函数

**Files:**
- Create: `src/storage/util/storageMap.ts`
- Test: `src/storage/util/storageMap.test.ts`

**Interfaces:**
- Consumes: 无(纯函数,零依赖)。
- Produces: `StorageVolume`、`PhysicalDrive` 接口;`mapVolumes(groups, raidMountPoints?)`、`mapDrives(disks)`、`usageLevel(pct)`、`toFahrenheit(c)` —— Task 2 的 store 与 Task 3/4 的组件按此签名消费。

- [ ] **Step 1: 写失败测试**

`src/storage/util/storageMap.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mapVolumes, mapDrives, usageLevel, toFahrenheit } from './storageMap'

// 真机 2026-07-23 实拍:size/avail 是字符串
const LIVE_GROUPS = [
  {
    disk_name: 'System', size: 512110190592, path: '/dev/nvme0n1', type: 'nvme',
    children: [
      {
        uuid: 'da0e4da3', mount_point: '/', size: '512110190592', avail: '384614653440',
        used: '127495537152', type: 'ext4', path: '/dev/nvme0n1p7',
        drive_name: 'nvme0n1p7', label: 'NimoOS-HD',
      },
    ],
  },
  {
    disk_name: 'Storage1', size: 2000000000000, path: '/dev/sda', type: 'sata',
    children: [
      { uuid: 'aaa', mount_point: '/mnt/s1', size: '2000000000000', avail: '1000000000000', type: 'ext4', path: '/dev/sda1', drive_name: 'sda1', label: 'Storage1' },
      { uuid: 'bbb', mount_point: '/mnt/raid0', size: '100', avail: '50', type: 'ext4', path: '/dev/sda9', drive_name: 'sda9', label: 'zzz-on-raid' },
    ],
  },
]

describe('mapVolumes', () => {
  it('拍平 children、字符串数值转数字、算占用率', () => {
    const v = mapVolumes(LIVE_GROUPS)
    const sys = v.find((x) => x.isSystem)!
    expect(sys.name).toBe('NimoOS-HD')
    expect(sys.size).toBe(512110190592)
    expect(sys.availSize).toBe(384614653440)
    expect(sys.usedSize).toBe(512110190592 - 384614653440)
    // Vue2 逐字:100 - Math.floor(avail*100/size)
    expect(sys.usePercent).toBe(100 - Math.floor((384614653440 * 100) / 512110190592))
    expect(sys.fsType).toBe('ext4')
    expect(sys.mountPoint).toBe('/')
    expect(sys.disk).toBe('/dev/nvme0n1')
    expect(sys.driveName).toBe('nvme0n1p7')
  })
  it('isSystem 只认 disk_name === "System"', () => {
    const v = mapVolumes(LIVE_GROUPS)
    expect(v.filter((x) => x.isSystem)).toHaveLength(1)
    expect(v.find((x) => x.name === 'Storage1')!.isSystem).toBe(false)
  })
  it('RAID 挂载点被排除', () => {
    const v = mapVolumes(LIVE_GROUPS, new Set(['/mnt/raid0']))
    expect(v.map((x) => x.name)).not.toContain('zzz-on-raid')
    expect(v).toHaveLength(2)
  })
  it('排序:父盘名 desc、label asc(System 在前)', () => {
    const v = mapVolumes(LIVE_GROUPS)
    expect(v[0].isSystem).toBe(true)
    expect(v[1].name < (v[2]?.name ?? '￿')).toBe(true)
  })
  it('size 为 0 或缺失时占用率为 0,不产生 NaN', () => {
    const v = mapVolumes([{ disk_name: 'X', path: '/dev/x', children: [{ label: 'e', mount_point: '/e' }] }])
    expect(v[0].usePercent).toBe(0)
    expect(v[0].size).toBe(0)
  })
  it('非数组/垃圾输入返回空数组', () => {
    expect(mapVolumes(null)).toEqual([])
    expect(mapVolumes({ nope: 1 })).toEqual([])
  })
})

describe('mapDrives', () => {
  const LIVE_DISKS = [
    { name: 'nvme0n1', size: 512110190592, model: 'WPBSNM8-512GTP', health: 'true', temperature: 35, disk_type: 'SSD', serial: 'LP0625', path: '/dev/nvme0n1' },
  ]
  it('映射真机字段', () => {
    const d = mapDrives(LIVE_DISKS)
    expect(d[0]).toMatchObject({ name: 'nvme0n1', model: 'WPBSNM8-512GTP', size: 512110190592, diskType: 'SSD', healthy: true, temperature: 35 })
  })
  it('health 只认 true/"true"(修正 Vue2 把字符串 "false" 当健康的隐患)', () => {
    expect(mapDrives([{ health: 'false' }])[0].healthy).toBe(false)
    expect(mapDrives([{ health: true }])[0].healthy).toBe(true)
    expect(mapDrives([{}])[0].healthy).toBe(false)
  })
  it('非数组输入返回空数组', () => {
    expect(mapDrives(undefined)).toEqual([])
  })
})

describe('usageLevel', () => {
  it('阈值与 Vue2 getProgressType 一致(80/90)', () => {
    expect(usageLevel(0)).toBe('ok')
    expect(usageLevel(79)).toBe('ok')
    expect(usageLevel(80)).toBe('warn')
    expect(usageLevel(89)).toBe('warn')
    expect(usageLevel(90)).toBe('danger')
    expect(usageLevel(100)).toBe('danger')
  })
})

describe('toFahrenheit', () => {
  it('与 Vue2 filter 一致:(32 + c*1.8).toFixed(1)', () => {
    expect(toFahrenheit(35)).toBe('95.0')
    expect(toFahrenheit(0)).toBe('32.0')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test -- src/storage/util/storageMap.test.ts`
Expected: FAIL(模块不存在)

- [ ] **Step 3: 实现**

`src/storage/util/storageMap.ts`:

```ts
// /v1/storage children 的 size/avail/used 是字符串(2026-07-23 真机核实),必须显式 Number()。
// usePercent 公式与 Vue2 StorageManagerPanel 逐字一致,保证迁移前后读数不变。

export interface StorageVolume {
  uuid: string
  name: string
  isSystem: boolean
  fsType: string
  size: number
  availSize: number
  usedSize: number
  usePercent: number
  driveName: string
  path: string
  mountPoint: string
  disk: string
}

export interface PhysicalDrive {
  name: string
  model: string
  size: number
  diskType: string
  healthy: boolean
  temperature: number
}

interface RawChild {
  uuid?: string
  label?: string
  type?: string
  size?: unknown
  avail?: unknown
  path?: string
  drive_name?: string
  mount_point?: string
}
interface RawGroup { path?: string; disk_name?: string; children?: RawChild[] }

export function mapVolumes(groups: unknown, raidMountPoints: Set<string> = new Set()): StorageVolume[] {
  const arr = Array.isArray(groups) ? (groups as RawGroup[]) : []
  const flat: Array<RawChild & { _disk: string; _diskName: string }> = []
  for (const g of arr) {
    for (const c of g?.children || []) {
      if (raidMountPoints.has(c?.mount_point || '')) continue // RAID 卷归 /storage/raid(P3)
      flat.push({ ...c, _disk: g?.path || '', _diskName: g?.disk_name || '' })
    }
  }
  // Vue2 orderBy(['diskName','label'],['desc','asc']):System 组排最前
  flat.sort((a, b) => {
    if (a._diskName !== b._diskName) return a._diskName < b._diskName ? 1 : -1
    const la = a.label || ''
    const lb = b.label || ''
    return la < lb ? -1 : la > lb ? 1 : 0
  })
  return flat.map((c) => {
    const size = Number(c.size) || 0
    const avail = Number(c.avail) || 0
    return {
      uuid: c.uuid || '',
      name: c.label || c.drive_name || '',
      isSystem: c._diskName === 'System',
      fsType: c.type || '',
      size,
      availSize: avail,
      usedSize: Math.max(0, size - avail),
      usePercent: size > 0 ? 100 - Math.floor((avail * 100) / size) : 0,
      driveName: c.drive_name || '',
      path: c.path || '',
      mountPoint: c.mount_point || '',
      disk: c._disk,
    }
  })
}

interface RawDisk {
  name?: string
  model?: string
  size?: unknown
  disk_type?: string
  health?: unknown
  temperature?: unknown
}

export function mapDrives(disks: unknown): PhysicalDrive[] {
  const arr = Array.isArray(disks) ? (disks as RawDisk[]) : []
  return arr.map((d) => ({
    name: d.name || '',
    model: d.model || '',
    size: Number(d.size) || 0,
    diskType: d.disk_type || '',
    // 后端 health 是字符串 "true"/"false";严格比较,避免 "false" 被当真值(Vue2 隐患)
    healthy: d.health === true || d.health === 'true',
    temperature: Number(d.temperature) || 0,
  }))
}

// 与 Vue2 mixin getProgressType 阈值一致
export function usageLevel(pct: number): 'ok' | 'warn' | 'danger' {
  if (pct < 80) return 'ok'
  if (pct < 90) return 'warn'
  return 'danger'
}

export function toFahrenheit(c: number): string {
  return (32 + c * 1.8).toFixed(1)
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test -- src/storage/util/storageMap.test.ts`
Expected: PASS(全部用例)

- [ ] **Step 5: 类型检查 + 提交**

```bash
pnpm exec vue-tsc --noEmit
git add src/storage/util/storageMap.ts src/storage/util/storageMap.test.ts
git commit -m "feat(storage): 映射纯函数——字符串数值转换/占用率/health 严格判定(SP6-P1)"
```

---

### Task 2: storage Pinia store

**Files:**
- Create: `src/storage/stores/storage.ts`
- Test: `src/storage/stores/storage.test.ts`
- Modify: `src/i18n/zh_cn.ts`、`src/i18n/en_us.ts`(加 2 个键)

**Interfaces:**
- Consumes: Task 1 的 `mapVolumes/mapDrives` 与类型;`service.storage.list` / `service.raid.list` / `service.disks.getDiskList` / `service.disks.umount`(P0 已在共享包);`useToast()`(`src/stores/toast`)、`i18n.global.t`。
- Produces: `useStorageStore()` → `{ volumes, drives, loading, loadVolumes(), loadDrives(), loadAll(), unmount(diskPath, password): Promise<boolean> }` —— Task 3/4 视图消费。

- [ ] **Step 1: 写失败测试**

`src/storage/stores/storage.test.ts`(照 `src/files/stores/mounts.test.ts` 的 hoisted mock 模式):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const storageList = vi.fn()
const raidList = vi.fn()
const getDiskList = vi.fn()
const umount = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    storage: { list: (...a: unknown[]) => storageList(...a) },
    raid: { list: (...a: unknown[]) => raidList(...a) },
    disks: { getDiskList: (...a: unknown[]) => getDiskList(...a), umount: (...a: unknown[]) => umount(...a) },
  },
}))
const toastShow = vi.fn()
vi.mock('../../stores/toast', () => ({ useToast: () => ({ show: toastShow }) }))
vi.mock('../../i18n', () => ({ i18n: { global: { t: (k: string) => k } } }))

import { useStorageStore } from './storage'

const GROUPS = [
  { disk_name: 'System', path: '/dev/nvme0n1', children: [{ label: 'NimoOS-HD', mount_point: '/', size: '100', avail: '40', type: 'ext4', drive_name: 'p7', path: '/dev/nvme0n1p7', uuid: 'u1' }] },
  { disk_name: 'S1', path: '/dev/sda', children: [{ label: 'raidvol', mount_point: '/mnt/r0', size: '10', avail: '5', type: 'ext4', drive_name: 'sda1', path: '/dev/sda1', uuid: 'u2' }] },
]

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('loadVolumes', () => {
  it('storage+raid 并取,RAID 挂载点被排除', async () => {
    storageList.mockResolvedValue(GROUPS)
    raidList.mockResolvedValue([{ id: 1, mount_point: '/mnt/r0' }])
    const s = useStorageStore()
    await s.loadVolumes()
    expect(storageList).toHaveBeenCalledWith({ system: 'show' })
    expect(s.volumes).toHaveLength(1)
    expect(s.volumes[0].name).toBe('NimoOS-HD')
  })
  it('raid.list 失败不影响卷列表', async () => {
    storageList.mockResolvedValue(GROUPS)
    raidList.mockRejectedValue(new Error('404'))
    const s = useStorageStore()
    await s.loadVolumes()
    expect(s.volumes).toHaveLength(2)
  })
  it('storage.list 失败置空,不抛', async () => {
    storageList.mockRejectedValue(new Error('boom'))
    raidList.mockResolvedValue([])
    const s = useStorageStore()
    await expect(s.loadVolumes()).resolves.toBeUndefined()
    expect(s.volumes).toEqual([])
  })
})

describe('loadDrives', () => {
  it('取 disks 字段映射', async () => {
    getDiskList.mockResolvedValue({ disks: [{ name: 'nvme0n1', model: 'M', size: 100, disk_type: 'SSD', health: 'true', temperature: 35 }], avail: [] })
    const s = useStorageStore()
    await s.loadDrives()
    expect(s.drives).toHaveLength(1)
    expect(s.drives[0].healthy).toBe(true)
  })
  it('失败置空不抛', async () => {
    getDiskList.mockRejectedValue(new Error('x'))
    const s = useStorageStore()
    await expect(s.loadDrives()).resolves.toBeUndefined()
    expect(s.drives).toEqual([])
  })
})

describe('unmount', () => {
  it('成功:发 {path,password}、toast 成功文案、重载、返回 true', async () => {
    umount.mockResolvedValue({})
    storageList.mockResolvedValue([])
    raidList.mockResolvedValue([])
    getDiskList.mockResolvedValue({ disks: [] })
    const s = useStorageStore()
    const ok = await s.unmount('/dev/sda', 'pw')
    expect(umount).toHaveBeenCalledWith({ path: '/dev/sda', password: 'pw' })
    expect(toastShow).toHaveBeenCalledWith('storageUnmountSuccess')
    expect(storageList).toHaveBeenCalled()
    expect(ok).toBe(true)
  })
  it('失败:toast 失败文案、返回 false、不抛', async () => {
    umount.mockRejectedValue(new Error('wrong password'))
    const s = useStorageStore()
    const ok = await s.unmount('/dev/sda', 'bad')
    expect(toastShow).toHaveBeenCalledWith('storageUnmountFailed')
    expect(ok).toBe(false)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test -- src/storage/stores/storage.test.ts`
Expected: FAIL(store 不存在)

- [ ] **Step 3: 实现 store + i18n 键**

`src/storage/stores/storage.ts`:

```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { i18n } from '../../i18n'
import { useToast } from '../../stores/toast'
import { mapVolumes, mapDrives, type StorageVolume, type PhysicalDrive } from '../util/storageMap'

export const useStorageStore = defineStore('storage', () => {
  const volumes = ref<StorageVolume[]>([])
  const drives = ref<PhysicalDrive[]>([])
  const loading = ref(false)
  const t = i18n.global.t

  async function loadVolumes() {
    try {
      // raid.list 兜底空数组:老后端无 /v2/raid 时卷列表照常工作
      const [storageRes, raidRes] = await Promise.all([
        service.storage.list({ system: 'show' }),
        service.raid.list().catch(() => [] as unknown[]),
      ])
      const raidMounts = new Set(
        (Array.isArray(raidRes) ? raidRes : [])
          .map((r) => (r as { mount_point?: string })?.mount_point)
          .filter((m): m is string => !!m),
      )
      volumes.value = mapVolumes(storageRes, raidMounts)
    } catch (e) {
      console.warn('[storage] volumes load failed', e)
      volumes.value = []
    }
  }

  async function loadDrives() {
    try {
      const res = (await service.disks.getDiskList()) as { disks?: unknown } | null
      drives.value = mapDrives(res?.disks)
    } catch (e) {
      console.warn('[storage] drives load failed', e)
      drives.value = []
    }
  }

  async function loadAll() {
    loading.value = true
    try {
      await Promise.all([loadVolumes(), loadDrives()])
    } finally {
      loading.value = false
    }
  }

  async function unmount(diskPath: string, password: string): Promise<boolean> {
    const toast = useToast()
    try {
      // 契约:DELETE /v1/disks {path: 父盘路径, password}(Vue2 StorageItem 同款)
      await service.disks.umount({ path: diskPath, password })
      toast.show(t('storageUnmountSuccess'))
      await loadAll()
      return true
    } catch (e) {
      console.warn('[storage] unmount failed', e)
      toast.show(t('storageUnmountFailed'))
      return false
    }
  }

  return { volumes, drives, loading, loadVolumes, loadDrives, loadAll, unmount }
})
```

i18n:在 `src/i18n/zh_cn.ts` 加(位置:文件内新起 `// storage 存储区` 注释组,放在文件已有分组之后):

```ts
  storageUnmountSuccess: '存储已移除',
  storageUnmountFailed: '移除失败,请检查密码后重试',
```

`src/i18n/en_us.ts` 同名键:

```ts
  storageUnmountSuccess: 'Storage removed',
  storageUnmountFailed: 'Failed to remove, check your password and try again',
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test -- src/storage/stores/storage.test.ts src/i18n/parity.test.ts`
Expected: PASS

- [ ] **Step 5: 类型检查 + 提交**

```bash
pnpm exec vue-tsc --noEmit
git add src/storage/stores/storage.ts src/storage/stores/storage.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(storage): Pinia store——卷/盘装载、RAID 排除、卸载动作(SP6-P1)"
```

---

### Task 3: StorageShell + 物理盘视图 + 路由

**Files:**
- Create: `src/storage/components/StorageShell.vue`
- Create: `src/storage/components/DriveCard.vue`
- Create: `src/views/StorageDrives.vue`
- Modify: `src/router/index.ts`(加 `/storage/drives` 路由)
- Modify: `src/i18n/zh_cn.ts`、`src/i18n/en_us.ts`
- Test: `src/storage/components/StorageShell.test.ts`、`src/storage/components/DriveCard.test.ts`、`src/views/StorageDrives.test.ts`

**Interfaces:**
- Consumes: Task 1 `PhysicalDrive`/`toFahrenheit`;Task 2 `useStorageStore`;`fmtSize`(`src/home/util/format.ts`);`useMessageBus`(`src/composables/useMessageBus`,`bus.on(event, cb) → off()`)。
- Produces: `StorageShell`(default slot 容器,自带回主页 + 「存储卷/物理硬盘」页签)—— Task 4 复用;路由名 `storage-drives`。

- [ ] **Step 1: 写失败测试**

`src/storage/components/DriveCard.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DriveCard from './DriveCard.vue'

const DRIVE = { name: 'nvme0n1', model: 'WPBSNM8-512GTP', size: 512110190592, diskType: 'SSD', healthy: true, temperature: 35 }

describe('DriveCard', () => {
  it('渲染名称/型号/容量/类型', () => {
    const w = mount(DriveCard, { props: { drive: DRIVE } })
    expect(w.text()).toContain('nvme0n1')
    expect(w.text()).toContain('WPBSNM8-512GTP')
    expect(w.text()).toContain('SSD')
    expect(w.text()).toContain('477 GB') // fmtSize(512110190592):≥100 取整 → "477 GB"
  })
  it('健康态:healthy=true 绿色文案,false 危险文案', () => {
    const ok = mount(DriveCard, { props: { drive: DRIVE } })
    expect(ok.find('.dc-health.ok').exists()).toBe(true)
    const bad = mount(DriveCard, { props: { drive: { ...DRIVE, healthy: false } } })
    expect(bad.find('.dc-health.bad').exists()).toBe(true)
  })
  it('温度:>0 显示 °C/°F,否则 N/A', () => {
    const w = mount(DriveCard, { props: { drive: DRIVE } })
    expect(w.text()).toContain('35°C')
    expect(w.text()).toContain('95.0°F')
    const na = mount(DriveCard, { props: { drive: { ...DRIVE, temperature: 0 } } })
    expect(na.text()).toContain('N/A')
  })
})
```

`src/storage/components/StorageShell.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { defineComponent } from 'vue'
import StorageShell from './StorageShell.vue'

const Stub = defineComponent({ template: '<div />' })

async function mountShell(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: Stub },
      { path: '/storage', component: Stub },
      { path: '/storage/drives', component: Stub },
    ],
  })
  await router.push(path)
  await router.isReady()
  const w = mount(StorageShell, { global: { plugins: [router] }, slots: { default: '<p class="probe">body</p>' } })
  return { w, router }
}

describe('StorageShell', () => {
  it('渲染标题、两个页签和 slot 内容', async () => {
    const { w } = await mountShell('/storage')
    expect(w.find('.st-title').exists()).toBe(true)
    expect(w.findAll('.st-tab')).toHaveLength(2)
    expect(w.find('.probe').text()).toBe('body')
  })
  it('当前路由的页签带 active', async () => {
    const { w } = await mountShell('/storage/drives')
    const tabs = w.findAll('.st-tab')
    expect(tabs[0].classes()).not.toContain('active')
    expect(tabs[1].classes()).toContain('active')
  })
  it('回主页按钮 push /', async () => {
    const { w, router } = await mountShell('/storage')
    await w.find('.st-home').trigger('click')
    await router.isReady()
    expect(router.currentRoute.value.path).toBe('/')
  })
})
```

`src/views/StorageDrives.test.ts`(锁热插拔接线:订阅两事件、500ms 防抖合并、卸载时退订):

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { defineComponent } from 'vue'

const storageList = vi.fn().mockResolvedValue([])
const raidList = vi.fn().mockResolvedValue([])
const getDiskList = vi.fn().mockResolvedValue({ disks: [] })
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    storage: { list: (...a: unknown[]) => storageList(...a) },
    raid: { list: (...a: unknown[]) => raidList(...a) },
    disks: { getDiskList: (...a: unknown[]) => getDiskList(...a), umount: vi.fn() },
  },
}))

const handlers: Record<string, (p?: unknown) => void> = {}
const offs: Record<string, ReturnType<typeof vi.fn>> = {}
vi.mock('../composables/useMessageBus', () => ({
  useMessageBus: () => ({
    on: (ev: string, cb: (p?: unknown) => void) => {
      handlers[ev] = cb
      offs[ev] = vi.fn()
      return offs[ev]
    },
  }),
}))

import StorageDrives from './StorageDrives.vue'

const Stub = defineComponent({ template: '<div />' })

async function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: Stub },
      { path: '/storage', component: Stub },
      { path: '/storage/drives', component: StorageDrives },
    ],
  })
  await router.push('/storage/drives')
  await router.isReady()
  return mount(StorageDrives, { global: { plugins: [router] } })
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('StorageDrives 热插拔接线', () => {
  it('挂载即取数,并订阅 added/removed 两事件', async () => {
    await mountView()
    expect(getDiskList).toHaveBeenCalledTimes(1)
    expect(handlers['local-storage:disk:added']).toBeTypeOf('function')
    expect(handlers['local-storage:disk:removed']).toBeTypeOf('function')
  })
  it('热插拔 500ms 防抖合并成一次刷新', async () => {
    await mountView()
    getDiskList.mockClear()
    handlers['local-storage:disk:added']()
    handlers['local-storage:disk:removed']()
    expect(getDiskList).not.toHaveBeenCalled() // handler 本身不打接口(不阻塞)
    vi.advanceTimersByTime(500)
    expect(getDiskList).toHaveBeenCalledTimes(1)
  })
  it('组件卸载时退订', async () => {
    const w = await mountView()
    w.unmount()
    expect(offs['local-storage:disk:added']).toHaveBeenCalled()
    expect(offs['local-storage:disk:removed']).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test -- src/storage/components src/views/StorageDrives.test.ts`
Expected: FAIL(组件不存在)

- [ ] **Step 3: 实现组件、视图、路由、i18n**

`src/storage/components/StorageShell.vue`:

```vue
<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
function goHome() {
  router.push('/')
}
</script>

<template>
  <div class="storage-shell">
    <header class="st-bar">
      <button class="st-home" type="button" @click="goHome">‹ {{ t('areaBackHome') }}</button>
      <h1 class="st-title">{{ t('storageTitle') }}</h1>
      <nav class="st-tabs">
        <RouterLink to="/storage" class="st-tab" :class="{ active: route.path === '/storage' }">{{ t('storageTabVolumes') }}</RouterLink>
        <RouterLink to="/storage/drives" class="st-tab" :class="{ active: route.path === '/storage/drives' }">{{ t('storageTabDrives') }}</RouterLink>
      </nav>
    </header>
    <main class="st-body"><slot /></main>
  </div>
</template>

<style scoped>
.storage-shell { min-height: 100dvh; display: flex; flex-direction: column; background: var(--bg); color: var(--fg); }
.st-bar { display: flex; align-items: center; gap: 14px; padding: 14px 22px; }
.st-home {
  border: 1px solid var(--chip-border); background: var(--chip-bg); color: var(--fg);
  border-radius: 999px; padding: 6px 14px; font-size: 13px; cursor: pointer; white-space: nowrap;
}
.st-home:hover { background: var(--chip-bg-hi); }
.st-title { font-size: 18px; font-weight: 600; margin: 0; }
.st-tabs { display: flex; gap: 6px; margin-left: auto; }
.st-tab {
  padding: 6px 16px; border-radius: 999px; font-size: 13px; text-decoration: none;
  color: var(--fg-muted); border: 1px solid transparent;
}
.st-tab:hover { color: var(--fg); background: var(--hover); }
.st-tab.active { color: var(--fg); background: var(--chip-bg-hi); border-color: var(--chip-border); }
.st-body { flex: 1; overflow-y: auto; padding: 8px 22px 28px; }
.st-body > :deep(*) { max-width: 980px; margin-left: auto; margin-right: auto; }
@media (max-width: 768px) {
  .st-bar { flex-wrap: wrap; padding: 10px 14px; gap: 8px; }
  .st-tabs { margin-left: 0; width: 100%; }
  .st-body { padding: 4px 14px 20px; }
}
</style>
```

`src/storage/components/DriveCard.vue`:

```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { fmtSize } from '../../home/util/format'
import { toFahrenheit, type PhysicalDrive } from '../util/storageMap'

defineProps<{ drive: PhysicalDrive }>()
const { t } = useI18n()
</script>

<template>
  <article class="drive-card">
    <div class="dc-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3.5" y="6.5" width="17" height="11" rx="2" />
        <path d="M3.5 13.5h17" />
        <circle cx="17" cy="15.5" r="0.9" fill="currentColor" stroke="none" />
      </svg>
    </div>
    <div class="dc-main">
      <h3 class="dc-name">{{ drive.name }}</h3>
      <p class="dc-meta">{{ drive.model || '—' }} · {{ fmtSize(drive.size) }} {{ drive.diskType }}</p>
      <p class="dc-stats">
        <span class="dc-health" :class="drive.healthy ? 'ok' : 'bad'">
          {{ t('storageDriveHealth') }}: <b>{{ drive.healthy ? t('storageDriveHealthy') : t('storageDriveDamaged') }}</b>
        </span>
        <span class="dc-temp">
          {{ t('storageDriveTemp') }}:
          <b v-if="drive.temperature > 0">{{ drive.temperature }}°C / {{ toFahrenheit(drive.temperature) }}°F</b>
          <b v-else>N/A</b>
        </span>
      </p>
    </div>
  </article>
</template>

<style scoped>
.drive-card {
  display: flex; gap: 16px; align-items: center; padding: 16px 18px;
  background: var(--card-bg); border: 1px solid var(--card-border); border-radius: var(--radius-sm);
}
.drive-card + .drive-card { margin-top: 12px; }
.dc-icon { width: 44px; height: 44px; flex: none; color: var(--fg-muted); }
.dc-icon svg { width: 100%; height: 100%; }
.dc-main { min-width: 0; }
.dc-name { margin: 0; font-size: 15px; font-weight: 600; }
.dc-meta { margin: 3px 0 0; font-size: 13px; color: var(--fg-muted); }
.dc-stats { margin: 6px 0 0; font-size: 12.5px; color: var(--fg-muted); display: flex; gap: 16px; flex-wrap: wrap; }
.dc-health.ok b { color: var(--sem-fg); }
.dc-health.bad b { color: var(--remove-fg); }
</style>
```

`src/views/StorageDrives.vue`:

```vue
<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import StorageShell from '../storage/components/StorageShell.vue'
import DriveCard from '../storage/components/DriveCard.vue'
import { useStorageStore } from '../storage/stores/storage'
import { useMessageBus } from '../composables/useMessageBus'

const store = useStorageStore()
const { t } = useI18n()
const bus = useMessageBus()

// MessageBus handler 不可阻塞(buffer=1):500ms 防抖后刷新(Vue2 MountList 先例)
let hotplugTimer: number | undefined
function onHotplug() {
  clearTimeout(hotplugTimer)
  hotplugTimer = window.setTimeout(() => {
    store.loadAll()
  }, 500)
}

let offAdd: (() => void) | undefined
let offRemove: (() => void) | undefined
onMounted(() => {
  store.loadAll()
  offAdd = bus.on('local-storage:disk:added', onHotplug)
  offRemove = bus.on('local-storage:disk:removed', onHotplug)
})
onUnmounted(() => {
  offAdd?.()
  offRemove?.()
  clearTimeout(hotplugTimer)
})
</script>

<template>
  <StorageShell>
    <div v-if="store.loading && !store.drives.length" class="st-hint">{{ t('storageLoading') }}</div>
    <p v-else-if="!store.drives.length" class="st-hint">{{ t('storageDrivesEmpty') }}</p>
    <div v-else>
      <DriveCard v-for="d in store.drives" :key="d.name" :drive="d" />
    </div>
  </StorageShell>
</template>

<style scoped>
.st-hint { padding: 40px 0; text-align: center; color: var(--fg-muted); font-size: 14px; }
</style>
```

`src/router/index.ts`:在 import 区加

```ts
import StorageDrives from '../views/StorageDrives.vue'
```

在路由表 `/apps/sources` 之后、`/files/:path(.*)*` 通配之前加:

```ts
  { path: '/storage/drives', name: 'storage-drives', component: StorageDrives },
```

i18n `zh_cn.ts`(追加进 Task 2 建的 storage 组):

```ts
  storageTitle: '存储',
  storageTabVolumes: '存储卷',
  storageTabDrives: '物理硬盘',
  storageLoading: '加载中…',
  storageDrivesEmpty: '未检测到硬盘',
  storageDriveHealth: '健康',
  storageDriveHealthy: '正常',
  storageDriveDamaged: '损坏',
  storageDriveTemp: '温度',
```

`en_us.ts`:

```ts
  storageTitle: 'Storage',
  storageTabVolumes: 'Volumes',
  storageTabDrives: 'Drives',
  storageLoading: 'Loading…',
  storageDrivesEmpty: 'No drives detected',
  storageDriveHealth: 'Health',
  storageDriveHealthy: 'Healthy',
  storageDriveDamaged: 'Damaged',
  storageDriveTemp: 'Temp',
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test -- src/storage src/i18n/parity.test.ts src/styles/color-guard.test.ts`
Expected: PASS

- [ ] **Step 5: 类型检查 + 全量测试 + 提交**

```bash
pnpm exec vue-tsc --noEmit
pnpm test
git add src/storage/components/StorageShell.vue src/storage/components/StorageShell.test.ts src/storage/components/DriveCard.vue src/storage/components/DriveCard.test.ts src/views/StorageDrives.vue src/views/StorageDrives.test.ts src/router/index.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(storage): StorageShell 骨架 + /storage/drives 物理盘列表 + 热插拔刷新(SP6-P1)"
```

---

### Task 4: 存储卷视图 + 卸载弹窗

**Files:**
- Create: `src/storage/components/VolumeCard.vue`
- Create: `src/storage/components/UnmountDialog.vue`
- Create: `src/views/StorageVolumes.vue`
- Modify: `src/router/index.ts`(加 `/storage` 路由)
- Modify: `src/i18n/zh_cn.ts`、`src/i18n/en_us.ts`
- Test: `src/storage/components/VolumeCard.test.ts`、`src/storage/components/UnmountDialog.test.ts`

**Interfaces:**
- Consumes: Task 1 `StorageVolume`/`usageLevel`;Task 2 `useStorageStore().unmount(diskPath, password)`;Task 3 `StorageShell`;`src/components/ui/Dialog.vue`(`open`/`title` props + `update:open` + default/footer slots)。
- Produces: 路由名 `storage`(路径 `/storage`)。

- [ ] **Step 1: 写失败测试**

`src/storage/components/VolumeCard.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import VolumeCard from './VolumeCard.vue'

const VOL = {
  uuid: 'u1', name: 'NimoOS-HD', isSystem: false, fsType: 'ext4',
  size: 512110190592, availSize: 384614653440, usedSize: 127495537152, usePercent: 25,
  driveName: 'nvme0n1p7', path: '/dev/nvme0n1p7', mountPoint: '/', disk: '/dev/nvme0n1',
}

describe('VolumeCard', () => {
  it('渲染名称、文件系统、已用/总量', () => {
    const w = mount(VolumeCard, { props: { volume: VOL } })
    expect(w.text()).toContain('NimoOS-HD')
    expect(w.text()).toContain('EXT4')
    expect(w.text()).toContain('119 GB') // fmtSize(127495537152):≥100 取整 → "119 GB"
    expect(w.text()).toContain('477 GB') // fmtSize(512110190592) → "477 GB"
  })
  it('进度条按占用率上色分级', () => {
    const ok = mount(VolumeCard, { props: { volume: VOL } })
    expect(ok.find('.vc-fill.ok').exists()).toBe(true)
    const warn = mount(VolumeCard, { props: { volume: { ...VOL, usePercent: 85 } } })
    expect(warn.find('.vc-fill.warn').exists()).toBe(true)
    const danger = mount(VolumeCard, { props: { volume: { ...VOL, usePercent: 95 } } })
    expect(danger.find('.vc-fill.danger').exists()).toBe(true)
  })
  it('系统卷:显示 OS 徽标、无移除按钮', () => {
    const w = mount(VolumeCard, { props: { volume: { ...VOL, isSystem: true } } })
    expect(w.find('.vc-os').exists()).toBe(true)
    expect(w.find('.vc-remove').exists()).toBe(false)
  })
  it('非系统卷:点移除按钮 emit unmount', async () => {
    const w = mount(VolumeCard, { props: { volume: VOL } })
    await w.find('.vc-remove').trigger('click')
    expect(w.emitted('unmount')).toHaveLength(1)
  })
})
```

`src/storage/components/UnmountDialog.test.ts`(Dialog 经 Portal 挂到 body,断言用 `document.body`):

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import UnmountDialog from './UnmountDialog.vue'

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('UnmountDialog', () => {
  it('open 时渲染密码框,确认键无密码时禁用', async () => {
    mount(UnmountDialog, { props: { open: true, name: 'Storage1' } })
    const input = document.body.querySelector<HTMLInputElement>('.ud-input')
    expect(input).toBeTruthy()
    const okBtn = document.body.querySelector<HTMLButtonElement>('.ud-btn.danger')
    expect(okBtn?.disabled).toBe(true)
  })
  it('输入密码点确认 emit confirm(password)', async () => {
    const w = mount(UnmountDialog, { props: { open: true, name: 'Storage1' } })
    const input = document.body.querySelector<HTMLInputElement>('.ud-input')!
    input.value = 'secret'
    input.dispatchEvent(new Event('input'))
    await w.vm.$nextTick()
    document.body.querySelector<HTMLButtonElement>('.ud-btn.danger')!.click()
    expect(w.emitted('confirm')![0]).toEqual(['secret'])
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test -- src/storage/components/VolumeCard.test.ts src/storage/components/UnmountDialog.test.ts`
Expected: FAIL(组件不存在)

- [ ] **Step 3: 实现**

`src/storage/components/VolumeCard.vue`:

```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { fmtSize } from '../../home/util/format'
import { usageLevel, type StorageVolume } from '../util/storageMap'

defineProps<{ volume: StorageVolume }>()
defineEmits<{ (e: 'unmount'): void }>()
const { t } = useI18n()
</script>

<template>
  <article class="volume-card">
    <div class="vc-head">
      <h3 class="vc-name">
        {{ volume.name }}
        <span v-if="volume.isSystem" class="vc-os">OS</span>
      </h3>
      <button v-if="!volume.isSystem" class="vc-remove" type="button" @click="$emit('unmount')">
        {{ t('storageUnmount') }}
      </button>
    </div>
    <p class="vc-meta">{{ t('storageVolumeSingle') }} · {{ volume.fsType.toUpperCase() }}</p>
    <p class="vc-usage">{{ fmtSize(volume.usedSize) }} / {{ fmtSize(volume.size) }}</p>
    <div class="vc-track" role="progressbar" :aria-valuenow="volume.usePercent" aria-valuemin="0" aria-valuemax="100">
      <div class="vc-fill" :class="usageLevel(volume.usePercent)" :style="{ width: Math.min(100, Math.max(0, volume.usePercent)) + '%' }" />
    </div>
  </article>
</template>

<style scoped>
.volume-card {
  padding: 16px 18px; background: var(--card-bg);
  border: 1px solid var(--card-border); border-radius: var(--radius-sm);
}
.volume-card + .volume-card { margin-top: 12px; }
.vc-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.vc-name { margin: 0; font-size: 15px; font-weight: 600; display: flex; align-items: center; gap: 8px; min-width: 0; }
.vc-os {
  font-size: 10.5px; font-weight: 700; padding: 1px 7px; border-radius: 999px;
  background: var(--nrm-bg); color: var(--nrm-fg); border: 1px solid var(--nrm-bd);
}
.vc-remove {
  border: 1px solid var(--chip-border); background: var(--chip-bg); color: var(--remove-fg);
  border-radius: 999px; padding: 5px 14px; font-size: 12.5px; cursor: pointer; flex: none;
}
.vc-remove:hover { background: var(--chip-bg-hi); }
.vc-meta { margin: 3px 0 0; font-size: 13px; color: var(--fg-muted); }
.vc-usage { margin: 10px 0 6px; font-size: 12.5px; color: var(--fg-muted); font-family: var(--num-font); }
.vc-track { height: 6px; border-radius: 999px; background: var(--nrm-bg); overflow: hidden; }
.vc-fill { height: 100%; border-radius: 999px; }
.vc-fill.ok { background: var(--accent); }
.vc-fill.warn { background: var(--dem-fg); }
.vc-fill.danger { background: var(--remove-fg); }
</style>
```

`src/storage/components/UnmountDialog.vue`:

```vue
<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Dialog from '../../components/ui/Dialog.vue'

const props = defineProps<{ open: boolean; name: string }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void; (e: 'confirm', password: string): void }>()
const { t } = useI18n()
const password = ref('')
// 每次打开清空上次输入
watch(
  () => props.open,
  (o) => {
    if (o) password.value = ''
  },
)
</script>

<template>
  <Dialog :open="open" :title="t('storageUnmountTitle')" @update:open="emit('update:open', $event)">
    <p class="ud-msg">{{ t('storageUnmountMsg', { name }) }}</p>
    <input
      v-model="password"
      type="password"
      class="ud-input"
      :placeholder="t('storageUnmountPassword')"
      @keyup.enter="password && emit('confirm', password)"
    />
    <template #footer>
      <button class="ud-btn" type="button" @click="emit('update:open', false)">{{ t('storageCancel') }}</button>
      <button class="ud-btn danger" type="button" :disabled="!password" @click="emit('confirm', password)">
        {{ t('storageUnmountOk') }}
      </button>
    </template>
  </Dialog>
</template>

<style scoped>
.ud-msg { margin: 0 0 12px; font-size: 14px; color: var(--fg-muted); }
.ud-input {
  width: 100%; box-sizing: border-box; padding: 9px 12px; font-size: 14px;
  border-radius: 10px; border: 1px solid var(--chip-border);
  background: var(--chip-bg); color: var(--fg); outline: none;
}
.ud-input:focus { border-color: var(--accent); }
.ud-btn {
  padding: 7px 16px; border-radius: 999px; border: 1px solid var(--chip-border);
  background: var(--chip-bg); color: var(--fg); cursor: pointer; font-size: 13px;
}
.ud-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.ud-btn.danger { color: var(--remove-fg); border-color: var(--remove-fg); }
</style>
```

`src/views/StorageVolumes.vue`:

```vue
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import StorageShell from '../storage/components/StorageShell.vue'
import VolumeCard from '../storage/components/VolumeCard.vue'
import UnmountDialog from '../storage/components/UnmountDialog.vue'
import { useStorageStore } from '../storage/stores/storage'
import { useMessageBus } from '../composables/useMessageBus'
import type { StorageVolume } from '../storage/util/storageMap'

const store = useStorageStore()
const { t } = useI18n()
const bus = useMessageBus()

const dialogOpen = ref(false)
const pending = ref<StorageVolume | null>(null)
function askUnmount(v: StorageVolume) {
  pending.value = v
  dialogOpen.value = true
}
async function doUnmount(password: string) {
  if (!pending.value) return
  const ok = await store.unmount(pending.value.disk, password)
  if (ok) dialogOpen.value = false
}

// MessageBus handler 不可阻塞(buffer=1):500ms 防抖后刷新(Vue2 MountList 先例)
let hotplugTimer: number | undefined
function onHotplug() {
  clearTimeout(hotplugTimer)
  hotplugTimer = window.setTimeout(() => {
    store.loadAll()
  }, 500)
}

let offAdd: (() => void) | undefined
let offRemove: (() => void) | undefined
onMounted(() => {
  store.loadAll()
  offAdd = bus.on('local-storage:disk:added', onHotplug)
  offRemove = bus.on('local-storage:disk:removed', onHotplug)
})
onUnmounted(() => {
  offAdd?.()
  offRemove?.()
  clearTimeout(hotplugTimer)
})
</script>

<template>
  <StorageShell>
    <div v-if="store.loading && !store.volumes.length" class="st-hint">{{ t('storageLoading') }}</div>
    <p v-else-if="!store.volumes.length" class="st-hint">{{ t('storageVolumesEmpty') }}</p>
    <div v-else>
      <VolumeCard v-for="v in store.volumes" :key="v.uuid || v.path" :volume="v" @unmount="askUnmount(v)" />
    </div>
    <UnmountDialog v-model:open="dialogOpen" :name="pending?.name || ''" @confirm="doUnmount" />
  </StorageShell>
</template>

<style scoped>
.st-hint { padding: 40px 0; text-align: center; color: var(--fg-muted); font-size: 14px; }
</style>
```

`src/router/index.ts`:import 区加

```ts
import StorageVolumes from '../views/StorageVolumes.vue'
```

路由表在 `/storage/drives` 前一行加:

```ts
  { path: '/storage', name: 'storage', component: StorageVolumes },
```

i18n `zh_cn.ts` 追加:

```ts
  storageVolumesEmpty: '还没有存储卷',
  storageVolumeSingle: '单盘存储',
  storageUnmount: '移除',
  storageUnmountTitle: '移除存储',
  storageUnmountMsg: '将移除存储「{name}」,数据不会被删除,重新插入或挂载后可再次访问。输入登录密码以继续:',
  storageUnmountPassword: '登录密码',
  storageUnmountOk: '确认移除',
  storageCancel: '取消',
```

`en_us.ts` 追加:

```ts
  storageVolumesEmpty: 'No storage volumes yet',
  storageVolumeSingle: 'Single drive storage',
  storageUnmount: 'Remove',
  storageUnmountTitle: 'Remove storage',
  storageUnmountMsg: 'Storage "{name}" will be removed. Data is not deleted and becomes available again after remounting. Enter your login password to continue:',
  storageUnmountPassword: 'Login password',
  storageUnmountOk: 'Remove',
  storageCancel: 'Cancel',
```

> 台账备注(P6 记入 roadmap):Vue2 系统卷占用 ≥80% 时的「Free up storage」CasaOS wiki 外链**不迁**(外链已过时)。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test -- src/storage src/i18n/parity.test.ts src/styles/color-guard.test.ts`
Expected: PASS

- [ ] **Step 5: 类型检查 + 全量测试 + 提交**

```bash
pnpm exec vue-tsc --noEmit
pnpm test
git add src/storage/components/VolumeCard.vue src/storage/components/VolumeCard.test.ts src/storage/components/UnmountDialog.vue src/storage/components/UnmountDialog.test.ts src/views/StorageVolumes.vue src/router/index.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(storage): /storage 存储卷列表 + 密码确认卸载弹窗(SP6-P1)"
```

---

### Task 5: 主页入口 + folders.loadDisks 统一通道

**Files:**
- Create: `src/home/apps/icons/storage.svg`
- Modify: `src/home/apps/systemApps.ts`
- Modify: `src/home/composables/useOpenAction.ts`
- Modify: `src/home/stores/folders.ts`
- Modify: `src/i18n/zh_cn.ts`、`src/i18n/en_us.ts`(加 `appStorage`)
- Test: `src/home/stores/folders.test.ts`(已存在则改造其 mock;不存在则新建)

**Interfaces:**
- Consumes: `SYSTEM_APPS` 注册表(`SystemApp` 接口)、`useOpenAction.openApp` 的 system 分支、`service.storage.list`。
- Produces: 主页出现「存储」系统应用磁贴,点击 `router.push('/storage')`。

- [ ] **Step 1: 写失败测试**

先看 `src/home/stores/folders.test.ts` 是否已存在:存在则在其中把 `loadDisks` 的数据来源 mock 从 `getHttp` 改为 `service.storage.list` 并保持既有断言;不存在则新建:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const storageList = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: { storage: { list: (...a: unknown[]) => storageList(...a) } },
}))

import { useFoldersStore } from './folders'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('loadDisks(经 service.storage.list)', () => {
  it('根挂载点折算为 /DATA、label 兜底 NimoOS-HD、usb 标记', async () => {
    storageList.mockResolvedValue([
      { type: 'nvme', children: [{ mount_point: '/', label: '' }] },
      { type: 'usb', children: [{ mount_point: '/mnt/u1', label: 'U盘' }] },
    ])
    const s = useFoldersStore()
    await s.loadDisks()
    expect(storageList).toHaveBeenCalledWith({ system: 'show' })
    expect(s.disks).toEqual([
      { name: 'NimoOS-HD', path: '/DATA', usb: false },
      { name: 'U盘', path: '/mnt/u1', usb: true },
    ])
  })
  it('失败置空不抛', async () => {
    storageList.mockRejectedValue(new Error('x'))
    const s = useFoldersStore()
    await expect(s.loadDisks()).resolves.toBeUndefined()
    expect(s.disks).toEqual([])
  })
})
```

> 注意:folders store 若还有其他 service 依赖(读文件夹列表等),mock 对象需按现文件补齐,以现有测试文件/实现为准——**不改 loadDisks 之外的行为**。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test -- src/home/stores/folders.test.ts`
Expected: FAIL(loadDisks 仍走 getHttp,`service.storage.list` 未被调用)

- [ ] **Step 3: 实现**

`src/home/stores/folders.ts` 里 `loadDisks()` 的取数改为(**映射逻辑保持逐字不动**):

```ts
  async function loadDisks() {
    try {
      // SP6-P1:统一走 service.storage.list(行为等价,原 getHttp 直打 /storage)
      const groups = ((await service.storage.list({ system: 'show' })) as any[]) || []
      const out: DiskRoot[] = []
      const seen = new Set<string>()
      for (const g of groups) {
        const usb = g?.type === 'usb'
        for (const child of g?.children || []) {
          let mp = child?.mount_point || ''
          let label = child?.label || ''
          if (mp === '/') {
            mp = '/DATA'
            if (!label) label = 'NimoOS-HD'
          }
          if (!mp || seen.has(mp)) continue
          if (!label) label = mp.split('/').filter(Boolean).pop() || mp
          seen.add(mp)
          out.push({ name: label, path: mp, usb })
        }
      }
      disks.value = out
    } catch (e) {
      console.warn('[home] disk load failed', e)
      disks.value = []
    }
  }
```

import 区把 `getHttp` 改为 `service`(若 `getHttp` 在该文件还有其他用途则保留双导入)。

`src/home/apps/icons/storage.svg`(新建;渐变与 theme.css `.ic-storage` 同族琥珀色——图标资产不受 CSS token 约束,同既有 `.ic-*` 例外):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <defs>
    <linearGradient id="stg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fcd34d"/>
      <stop offset="0.6" stop-color="#f59e0b"/>
      <stop offset="1" stop-color="#b45309"/>
    </linearGradient>
  </defs>
  <rect width="96" height="96" rx="22" fill="url(#stg)"/>
  <g fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="24" y="30" width="48" height="36" rx="7"/>
    <path d="M24 52h48"/>
  </g>
  <circle cx="61" cy="59" r="3" fill="#ffffff"/>
</svg>
```

`src/home/apps/systemApps.ts`:

- import 区加 `import iconStorage from './icons/storage.svg'`
- `G` 加一条:`drive: '<rect x="4" y="7" width="16" height="10" rx="2"/><path d="M4 13.5h16"/><circle cx="16.5" cy="15.2" r=".8"/>',`
- `SYSTEM_APPS` 在 `files` 条目之后插入:

```ts
  { key: 'storage', name: 'Storage', label: 'appStorage', cls: 'ic-storage', glyph: G.drive, icon: iconStorage },
```

`src/home/composables/useOpenAction.ts` 的 `openApp` system 分支,`files` 之后加:

```ts
      if (key === 'storage') { router.push('/storage'); return }
```

(同时把文件顶部注释里「其余系统入口仍指 Vue2」的清单口径更新:storage 已迁本应用。`SYS_ROUTE` 里**不要**加 storage。)

i18n:`zh_cn.ts` 在既有 `app*` 组加 `appStorage: '存储',`;`en_us.ts` 加 `appStorage: 'Storage',`。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test -- src/home src/i18n/parity.test.ts`
Expected: PASS(若 home 区既有测试对 SYSTEM_APPS 数量/键有快照断言,按新增 storage 条目更新断言)

- [ ] **Step 5: 类型检查 + 全量测试 + 提交**

```bash
pnpm exec vue-tsc --noEmit
pnpm test
git add src/home/apps/icons/storage.svg src/home/apps/systemApps.ts src/home/composables/useOpenAction.ts src/home/stores/folders.ts src/home/stores/folders.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(home): 存储系统应用入口 + loadDisks 统一走 service.storage(SP6-P1)"
```

---

### Task 6: vite preview 代理(5273 独立端口部署)

**Files:**
- Modify: `vite.config.ts`

**Interfaces:**
- Consumes: 现有 `defineConfig`(`base: '/app/'`,`server.port: 5273`)。
- Produces: `pnpm build && pnpm exec vite preview --host` 后,`:5273/app/#/storage` 可用真机数据(API/WS/旧 UI 均转发 `127.0.0.1:80`)。

- [ ] **Step 1: 修改配置**

在 `vite.config.ts` 的 `server: { port: 5273 },` 之后加:

```ts
  // SP6 并行验收(spec §5):5273 只伺服 /app/ 构建产物,其余(API /v1|/v2|/v3、
  // MessageBus WS、Vue2 登录页)全部转发真机网关 80。正式部署仍走 scripts/deploy.sh。
  preview: {
    port: 5273,
    host: true,
    proxy: {
      '^/(?!app/)': { target: 'http://127.0.0.1:80', changeOrigin: true, ws: true },
    },
  },
```

- [ ] **Step 2: 构建 + 冒烟验证**

```bash
pnpm build
pnpm exec vite preview --host >/tmp/claude-1000/-home-nimo-NimoTech/c9494a60-34fb-4269-8212-e69415925ed6/scratchpad/vite-preview-smoke.log 2>&1 &
sleep 2
curl -s http://127.0.0.1:5273/v1/storage | head -c 120   # 期望:{"success":200,...}(代理通)
curl -s http://127.0.0.1:5273/app/ | head -c 120          # 期望:<!DOCTYPE html>(产物通)
kill %1
```

Expected: 两个 curl 分别返回 JSON envelope 与 HTML。

- [ ] **Step 3: 提交**

```bash
git add vite.config.ts
git commit -m "chore: vite preview 5273 代理真机网关,供 SP6 并行验收(SP6-P1)"
```

---

## 收尾(控制者执行,不派子代理)

1. 全量回归:`pnpm test` + `pnpm exec vue-tsc --noEmit` 全绿。
2. 全分支终审(requesting-code-review,BASE = New-UI 分支起点 `b056ed3`)。
3. 常驻部署:`pnpm build` 后以后台常驻方式起 `pnpm exec vite preview --host`,冒烟 curl 通过。
4. 请用户浏览器眼验 `http://<设备IP>:5273/app/#/storage`(新端口 localStorage 独立,需登录一次):卷列表(本机预期显示系统卷 NimoOS-HD)、物理硬盘页(NVMe 型号/温度/健康)、主页「存储」磁贴、窄屏样式;卸载按钮只验到弹窗(本机无非系统卷,天然只读)。
