# SP6-P2 创建存储向导 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 New-UI `/storage` 卷列表页补齐写路径:创建存储(选盘→格式化警告→执行 `POST /v1/storage`)+ 已有卷格式化(密码确认→`PUT /v1/storage`),并顺手清偿 P1 终审三笔债(卸载在途守卫、v.disk 转发断言、弹窗关闭清密码)。

**Architecture:** Vue2 的「创建向导」实为单弹窗内联表单(名称 + 单选盘 + 按 `need_format` 切换的内联警告 + Create / Format-and-Create 双按钮),New-UI 以 `CreateStorageDialog`(受控 Dialog,dumb 组件)1:1 复刻语义;格式化沿用 `UnmountDialog` 的密码确认弹窗模式新建 `FormatDialog`。所有写操作收敛进 Pinia storage store,自带在途守卫;候选盘来自 `GET /v1/disks` 响应的 `avail` 字段(新增纯函数 `mapAvailDisks`);默认存储名移植 Vue2 `storageNaming.js` 纯函数。

**Tech Stack:** Vue 3 `<script setup>` + TS strict · Pinia setup store · reka-ui(经现有 `components/ui/Dialog.vue`)· vitest + @vue/test-utils · vue-i18n(扁平 `storage*` key)

## Global Constraints

- **只动本仓库** `/home/nimo/NimoTech/.sp6/NimoOS-New-UI`(分支 `sp6-storage`)。NimoOS-Service 仓、Vue2 仓(NimoOS-UI)、roadmap、`/var/lib/nimoos` 一律不碰;不跑 `deploy.sh`。
- 包管理器 **pnpm**;测试与实现同目录(`*.test.ts`);全量验证命令:`pnpm test`(vitest run)+ `pnpm exec vue-tsc --noEmit`。
- **主题硬约束**:一切颜色必须 `var(--…)` token(定义在 `src/styles/theme.css`),禁止色值字面量;危险色用现有 `--remove-fg`。
- **i18n**:新 key 必须**同时**加 `src/i18n/zh_cn.ts` 和 `src/i18n/en_us.ts`(`parity.test.ts` 会红),扁平命名、统一 `storage` 前缀,追加在两文件 `// ── storage 存储区 ──` 段尾(zh 段尾现为 `storageDriveTemp`)。
- **请求契约(逐字,接口层单测锁死)**:
  - 创建:`service.storage.create` → `POST /v1/storage`,body `{ path: <盘路径>, name: <存储名>, format: <boolean> }`(仅三字段)。
  - 格式化已有卷:`service.storage.format` → `PUT /v1/storage`,body `{ path: <分区路径 v.path>, volume: <挂载点 v.mountPoint>, password: <登录密码> }`。
  - 卸载(已有):`service.disks.umount` → `DELETE /v1/disks`,body `{ path: <父盘 v.disk>, password }`。
- **密码安全**:任何携带密码请求的 catch 只准记 `(e as Error)?.message`,禁止把整个 error 对象/AxiosError 打日志(`config.data` 含明文密码,P1 终审 Important 教训)。
- **刷新语义照 Vue2**:创建成败**都**刷新列表;格式化**仅成功**刷新。
- 存储名输入过滤:`replace(/[^\w-]/g, '')`(Vue2 同款);名称必填。
- 不引任何新依赖(无 lottie/无表单库);进行中状态用按钮禁用 + 文案切换表达。
- MessageBus handler 不可阻塞(buffer=1)——本期不新增订阅,沿用页面既有 500ms 防抖。
- 后端布尔值可能是字符串(`"true"/"false"`,P1 血泪):`need_format` 判定必须严格 `=== true || === 'true'`。

---

### Task 1: 纯函数 — storageNaming 移植 + mapAvailDisks

**Files:**
- Create: `src/storage/util/storageNaming.ts`
- Create: `src/storage/util/storageNaming.test.ts`
- Modify: `src/storage/util/storageMap.ts`(文件尾追加 `AvailDisk` + `mapAvailDisks`)
- Modify: `src/storage/util/storageMap.test.ts`(追加 mapAvailDisks 用例)

**Interfaces:**
- Consumes: 无(纯模块)
- Produces:
  - `DEFAULT_STORAGE_NAME: string`(= `'Main-storage'`)
  - `computeNextStorageName(base?: string, takenNames?: string[]): string`
  - `interface AvailDisk { path: string; name: string; model: string; size: number; needFormat: boolean; serial: string }`
  - `mapAvailDisks(avail: unknown): AvailDisk[]`

- [ ] **Step 1: 写失败测试 `src/storage/util/storageNaming.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { DEFAULT_STORAGE_NAME, computeNextStorageName } from './storageNaming'

describe('computeNextStorageName', () => {
  it('无冲突时返回 base 本身', () => {
    expect(computeNextStorageName()).toBe('Main-storage')
    expect(computeNextStorageName('Main-storage', [])).toBe('Main-storage')
  })
  it('冲突时追加递增序号,取第一个空位', () => {
    expect(computeNextStorageName('Main-storage', ['Main-storage'])).toBe('Main-storage1')
    expect(computeNextStorageName('Main-storage', ['Main-storage', 'Main-storage1'])).toBe('Main-storage2')
    // 序号有洞取最小
    expect(computeNextStorageName('Main-storage', ['Main-storage', 'Main-storage2'])).toBe('Main-storage1')
  })
  it('大小写不敏感去重', () => {
    expect(computeNextStorageName('Main-storage', ['MAIN-STORAGE'])).toBe('Main-storage1')
  })
  it('忽略空值项', () => {
    expect(computeNextStorageName('Main-storage', ['', 'Main-storage'])).toBe('Main-storage1')
  })
  it('默认名常量导出', () => {
    expect(DEFAULT_STORAGE_NAME).toBe('Main-storage')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/storage/util/storageNaming.test.ts`
Expected: FAIL(模块不存在)

- [ ] **Step 3: 实现 `src/storage/util/storageNaming.ts`**(移植 Vue2 `NimoOS-UI/src/utils/storageNaming.js`,语义逐字)

```ts
// 存储 / RAID 创建时的默认名称计算(移植自 Vue2 utils/storageNaming.js,语义逐字一致)。
// RAID 阵列名与存储(分区)名共享同一命名空间,调用方需把两类已存在的名字合并后传入。

export const DEFAULT_STORAGE_NAME = 'Main-storage'

export function computeNextStorageName(
  base: string = DEFAULT_STORAGE_NAME,
  takenNames: string[] = [],
): string {
  const taken = new Set(
    (takenNames || []).filter((n) => n != null && n !== '').map((n) => String(n).toLowerCase()),
  )
  if (!taken.has(base.toLowerCase())) return base
  for (let i = 1; i < 100000; i++) {
    const cand = `${base}${i}`
    if (!taken.has(cand.toLowerCase())) return cand
  }
  return base
}
```

- [ ] **Step 4: 跑测试确认通过**,然后写 mapAvailDisks 失败测试(追加到 `src/storage/util/storageMap.test.ts`)

```ts
import { mapAvailDisks } from './storageMap' // 合并进文件顶部现有 import

describe('mapAvailDisks', () => {
  it('映射候选盘字段,size 字符串转数值', () => {
    const out = mapAvailDisks([
      { path: '/dev/sdb', name: 'sdb', model: 'WD Blue', size: '1000204886016', need_format: true, serial: 'S1' },
    ])
    expect(out).toEqual([
      { path: '/dev/sdb', name: 'sdb', model: 'WD Blue', size: 1000204886016, needFormat: true, serial: 'S1' },
    ])
  })
  it('need_format 字符串 "true"/"false" 严格判定(后端布尔字符串化,P1 health 同款)', () => {
    const out = mapAvailDisks([
      { path: '/dev/sdb', need_format: 'true' },
      { path: '/dev/sdc', need_format: 'false' },
      { path: '/dev/sdd' },
    ])
    expect(out.map((d) => d.needFormat)).toEqual([true, false, false])
  })
  it('非数组输入返回空数组', () => {
    expect(mapAvailDisks(undefined)).toEqual([])
    expect(mapAvailDisks({})).toEqual([])
  })
})
```

- [ ] **Step 5: 跑测试确认失败,然后在 `src/storage/util/storageMap.ts` 文件尾追加实现**

```ts
export interface AvailDisk {
  path: string
  name: string
  model: string
  size: number
  needFormat: boolean
  serial: string
}

interface RawAvail {
  path?: string
  name?: string
  model?: string
  size?: unknown
  need_format?: unknown
  serial?: string
}

// GET /v1/disks 响应的 avail 字段 → 创建存储候选盘。
// need_format 同 health:后端可能给字符串 "true"/"false",严格判定。
export function mapAvailDisks(avail: unknown): AvailDisk[] {
  const arr = Array.isArray(avail) ? (avail as RawAvail[]) : []
  return arr.map((d) => ({
    path: d.path || '',
    name: d.name || '',
    model: d.model || '',
    size: Number(d.size) || 0,
    needFormat: d.need_format === true || d.need_format === 'true',
    serial: d.serial || '',
  }))
}
```

- [ ] **Step 6: 跑 storage 目录全部测试 + tsc**

Run: `pnpm exec vitest run src/storage && pnpm exec vue-tsc --noEmit`
Expected: 全 PASS,tsc 无错

- [ ] **Step 7: Commit**

```bash
git add src/storage/util/storageNaming.ts src/storage/util/storageNaming.test.ts src/storage/util/storageMap.ts src/storage/util/storageMap.test.ts
git commit -m "feat(storage): 移植默认存储名纯函数 + 候选盘映射 mapAvailDisks(SP6-P2)"
```

---

### Task 2: store 写操作 — createStorage / formatVolume / 在途守卫

**Files:**
- Modify: `src/storage/stores/storage.ts`
- Modify: `src/storage/stores/storage.test.ts`
- Modify: `src/i18n/zh_cn.ts` + `src/i18n/en_us.ts`(4 个 toast key)

**Interfaces:**
- Consumes: Task 1 的 `mapAvailDisks` / `AvailDisk`(from `../util/storageMap`)
- Produces(store 新增导出,后续任务依赖):
  - `availDisks: Ref<AvailDisk[]>`(loadDrives 时从 `res.avail` 填充)
  - `raidNames: Ref<string[]>`(loadVolumes 时从 raid.list 结果收集 `name`,供默认名去重)
  - `creating: Ref<boolean>` / `formatting: Ref<boolean>` / `unmounting: Ref<boolean>`
  - `createStorage(payload: { path: string; name: string; format: boolean }): Promise<boolean>`
  - `formatVolume(payload: { path: string; volume: string; password: string }): Promise<boolean>`

- [ ] **Step 1: i18n 先行**——两文件 storage 段尾(zh `storageDriveTemp` 之后;en 同位置)各追加:

```ts
// zh_cn.ts
  storageCreateSuccess: '存储已创建',
  storageCreateFailed: '创建失败,请重试',
  storageFormatSuccess: '存储已格式化',
  storageFormatFailed: '格式化失败,请检查密码后重试',
// en_us.ts
  storageCreateSuccess: 'Storage created',
  storageCreateFailed: 'Failed to create storage, please try again',
  storageFormatSuccess: 'Storage formatted',
  storageFormatFailed: 'Failed to format, check your password and try again',
```

- [ ] **Step 2: 写失败测试**(追加到 `src/storage/stores/storage.test.ts`,沿用文件现有 mock 模式:外部 `vi.fn()` + `vi.mock('@nimotech/nimoos-service')` 工厂转发、i18n mock 返回 key、`setActivePinia(createPinia())`。需在 service mock 的 storage 域补 `create`/`format` 两个 `vi.fn()`,并让 `disks.getDiskList` 可返回 `{disks, avail}`)

```ts
describe('createStorage', () => {
  it('POST /storage 请求体逐字 {path,name,format},成功 toast + 返回 true', async () => {
    createMock.mockResolvedValue({})
    const s = useStorageStore()
    const ok = await s.createStorage({ path: '/dev/sdb', name: 'Main-storage', format: true })
    expect(ok).toBe(true)
    expect(createMock).toHaveBeenCalledWith({ path: '/dev/sdb', name: 'Main-storage', format: true })
    expect(toastMock).toHaveBeenCalledWith('storageCreateSuccess')
  })
  it('失败返回 false + 失败 toast,且成败都刷新列表(Vue2 语义)', async () => {
    createMock.mockRejectedValue(new Error('boom'))
    const s = useStorageStore()
    const ok = await s.createStorage({ path: '/dev/sdb', name: 'a', format: false })
    expect(ok).toBe(false)
    expect(toastMock).toHaveBeenCalledWith('storageCreateFailed')
    expect(listMock).toHaveBeenCalled() // loadAll 触达 storage.list
  })
  it('在途守卫:创建进行中再调直接返回 false,不重复发请求', async () => {
    let resolve!: (v: unknown) => void
    createMock.mockReturnValue(new Promise((r) => (resolve = r)))
    const s = useStorageStore()
    const p1 = s.createStorage({ path: '/dev/sdb', name: 'a', format: true })
    const p2 = s.createStorage({ path: '/dev/sdb', name: 'a', format: true })
    await expect(p2).resolves.toBe(false)
    expect(createMock).toHaveBeenCalledTimes(1)
    resolve({})
    await expect(p1).resolves.toBe(true)
  })
})

describe('formatVolume', () => {
  it('PUT /storage 请求体逐字 {path,volume,password},仅成功刷新', async () => {
    formatMock.mockResolvedValue({})
    const s = useStorageStore()
    const ok = await s.formatVolume({ path: '/dev/sdb1', volume: '/mnt/a', password: 'pw' })
    expect(ok).toBe(true)
    expect(formatMock).toHaveBeenCalledWith({ path: '/dev/sdb1', volume: '/mnt/a', password: 'pw' })
  })
  it('失败只记 message(不打整个 error,防明文密码)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    formatMock.mockRejectedValue(Object.assign(new Error('bad'), { config: { data: 'password=pw' } }))
    const s = useStorageStore()
    const ok = await s.formatVolume({ path: '/dev/sdb1', volume: '/mnt/a', password: 'pw' })
    expect(ok).toBe(false)
    for (const call of warn.mock.calls) {
      expect(JSON.stringify(call)).not.toContain('password=pw')
    }
    warn.mockRestore()
  })
})

describe('unmount 在途守卫(P1 债①)', () => {
  it('进行中再调返回 false 且只发一次请求', async () => {
    let resolve!: (v: unknown) => void
    umountMock.mockReturnValue(new Promise((r) => (resolve = r)))
    const s = useStorageStore()
    const p1 = s.unmount('/dev/sda', 'pw')
    const p2 = s.unmount('/dev/sda', 'pw')
    await expect(p2).resolves.toBe(false)
    expect(umountMock).toHaveBeenCalledTimes(1)
    resolve({})
    await expect(p1).resolves.toBe(true)
  })
})

describe('loadDrives 候选盘', () => {
  it('avail 字段映射进 availDisks', async () => {
    diskListMock.mockResolvedValue({ disks: [], avail: [{ path: '/dev/sdb', name: 'sdb', need_format: 'true' }] })
    const s = useStorageStore()
    await s.loadDrives()
    expect(s.availDisks).toHaveLength(1)
    expect(s.availDisks[0].needFormat).toBe(true)
  })
})
```

- [ ] **Step 3: 跑测试确认失败**

Run: `pnpm exec vitest run src/storage/stores/storage.test.ts`
Expected: FAIL(createStorage/formatVolume/availDisks 不存在)

- [ ] **Step 4: 实现 store 扩展**(`src/storage/stores/storage.ts`)

新增 state 与 import:

```ts
import { mapVolumes, mapDrives, mapAvailDisks, type StorageVolume, type PhysicalDrive, type AvailDisk } from '../util/storageMap'

const availDisks = ref<AvailDisk[]>([])
const raidNames = ref<string[]>([])
const unmounting = ref(false)
const creating = ref(false)
const formatting = ref(false)
```

`loadVolumes` 内 raidRes 处理处顺带收集名字(在现有 raidMounts 构建旁):

```ts
const raidArr = Array.isArray(raidRes) ? raidRes : []
raidNames.value = raidArr
  .map((r) => (r as { name?: string })?.name)
  .filter((n): n is string => !!n)
```

`loadDrives` 改为同时取 avail:

```ts
async function loadDrives() {
  try {
    const res = (await service.disks.getDiskList()) as { disks?: unknown; avail?: unknown } | null
    drives.value = mapDrives(res?.disks)
    availDisks.value = mapAvailDisks(res?.avail)
  } catch (e) {
    console.warn('[storage] drives load failed', e)
    drives.value = []
    availDisks.value = []
  }
}
```

`unmount` 加守卫(逻辑不变,外包一层):

```ts
async function unmount(diskPath: string, password: string): Promise<boolean> {
  if (unmounting.value) return false
  unmounting.value = true
  const toast = useToast()
  try {
    // 契约:DELETE /v1/disks {path: 父盘路径, password}(Vue2 StorageItem 同款)
    await service.disks.umount({ path: diskPath, password })
    toast.show(t('storageUnmountSuccess'))
    await loadAll()
    return true
  } catch (e) {
    // 只记 message:AxiosError 携带请求体(含明文密码),不可整个打日志
    console.warn('[storage] unmount failed', (e as Error)?.message)
    toast.show(t('storageUnmountFailed'))
    return false
  } finally {
    unmounting.value = false
  }
}
```

新增两个写操作:

```ts
async function createStorage(payload: { path: string; name: string; format: boolean }): Promise<boolean> {
  if (creating.value) return false
  creating.value = true
  const toast = useToast()
  let ok = false
  try {
    // 契约:POST /v1/storage {path, name, format} 仅三字段(Vue2 submitCreate 同款)
    await service.storage.create(payload)
    toast.show(t('storageCreateSuccess'))
    ok = true
  } catch (e) {
    console.warn('[storage] create failed', (e as Error)?.message)
    toast.show(t('storageCreateFailed'))
  } finally {
    creating.value = false
  }
  await loadAll() // Vue2 语义:成败都刷新
  return ok
}

async function formatVolume(payload: { path: string; volume: string; password: string }): Promise<boolean> {
  if (formatting.value) return false
  formatting.value = true
  const toast = useToast()
  try {
    // 契约:PUT /v1/storage {path: 分区路径, volume: 挂载点, password}(Vue2 StorageItem formatStorage 同款)
    await service.storage.format(payload)
    toast.show(t('storageFormatSuccess'))
    await loadAll() // Vue2 语义:格式化仅成功刷新
    return true
  } catch (e) {
    // 只记 message:请求体含明文密码
    console.warn('[storage] format failed', (e as Error)?.message)
    toast.show(t('storageFormatFailed'))
    return false
  } finally {
    formatting.value = false
  }
}
```

return 追加:`availDisks, raidNames, creating, formatting, unmounting, createStorage, formatVolume`。

- [ ] **Step 5: 跑测试 + tsc + i18n parity**

Run: `pnpm exec vitest run src/storage src/i18n && pnpm exec vue-tsc --noEmit`
Expected: 全 PASS

- [ ] **Step 6: Commit**

```bash
git add src/storage/stores/storage.ts src/storage/stores/storage.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(storage): store 写操作 createStorage/formatVolume + 全部在途守卫(SP6-P2)"
```

---

### Task 3: P1 债清偿 — UnmountDialog busy/清密码 + StorageVolumes 视图测试

**Files:**
- Modify: `src/storage/components/UnmountDialog.vue`
- Modify: `src/storage/components/UnmountDialog.test.ts`(补 busy/清密码用例)
- Modify: `src/views/StorageVolumes.vue`(传 `:busy`)
- Create: `src/views/StorageVolumes.test.ts`

**Interfaces:**
- Consumes: Task 2 的 `unmounting: Ref<boolean>`
- Produces: `UnmountDialog` 新增 prop `busy?: boolean`(Task 5 的 FormatDialog 同构参照;Task 6 复用本测试文件)

- [ ] **Step 1: 写失败测试**(追加到 `UnmountDialog.test.ts`,沿用文件现有惯例:mount 前 `document.body.innerHTML=''`、`document.body.querySelector`、`await w.vm.$nextTick()`)

```ts
it('busy 时确认与取消按钮均禁用', async () => {
  const w = mount(UnmountDialog, { props: { open: true, name: 'A', busy: true }, global: {...现有 global...} })
  await w.vm.$nextTick()
  const btns = document.body.querySelectorAll<HTMLButtonElement>('.ud-btn')
  expect(Array.from(btns).every((b) => b.disabled)).toBe(true)
})

it('弹窗关闭时清空密码(P1 债③:取消后明文不驻留)', async () => {
  const w = mount(UnmountDialog, { props: { open: true, name: 'A' }, global: {...现有 global...} })
  await w.vm.$nextTick()
  const input = document.body.querySelector<HTMLInputElement>('.ud-input')!
  input.value = 'secret'
  input.dispatchEvent(new Event('input'))
  await w.setProps({ open: false })
  await w.setProps({ open: true })
  await w.vm.$nextTick()
  expect(document.body.querySelector<HTMLInputElement>('.ud-input')!.value).toBe('')
})
```

- [ ] **Step 2: 跑测试确认失败**(busy 用例失败;清密码用例当前实现「打开时清」恰好也过——把 watch 断言升级为直接断组件行为即可,重点是 busy)

Run: `pnpm exec vitest run src/storage/components/UnmountDialog.test.ts`

- [ ] **Step 3: 修改 `UnmountDialog.vue`**

```ts
const props = defineProps<{ open: boolean; name: string; busy?: boolean }>()
// 开/关都清空:关闭后明文密码不得驻留内存(P1 债③)
watch(
  () => props.open,
  () => {
    password.value = ''
  },
)
```

模板:enter 提交加 busy 守卫,两按钮禁用态:

```html
@keyup.enter="password && !busy && emit('confirm', password)"
<button class="ud-btn" type="button" :disabled="busy" @click="emit('update:open', false)">{{ t('storageCancel') }}</button>
<button class="ud-btn danger" type="button" :disabled="!password || busy" @click="emit('confirm', password)">
```

- [ ] **Step 4: `StorageVolumes.vue` 传 busy**

```html
<UnmountDialog v-model:open="dialogOpen" :name="pending?.name || ''" :busy="store.unmounting" @confirm="doUnmount" />
```

- [ ] **Step 5: 写 `src/views/StorageVolumes.test.ts`(P1 债②)**。参照 `src/views/StorageDrives.test.ts` 的既有模式:mock `@nimotech/nimoos-service`(storage.list 返回真形状 fixture、raid.list 返 `[]`、disks.getDiskList 返 `{disks:[],avail:[]}`、disks.umount 外部 `vi.fn()`)、mock `../composables/useMessageBus`(`on` 返回退订函数)、`createRouter({ history: createMemoryHistory(), routes: [...stub] })`。核心用例:

```ts
const GROUP = {
  path: '/dev/sda', // 父盘路径 —— 卸载必须转发这个,不是 child.path
  disk_name: 'WD',
  children: [{ uuid: 'u1', label: 'Vol-A', type: 'ext4', size: '100', avail: '40', path: '/dev/sda1', mount_point: '/mnt/a' }],
}

it('卸载转发 v.disk(父盘路径)而非分区 path(P1 债②)', async () => {
  // mount 视图 → 等 loadAll 落定 → 点 VolumeCard 移除 → 弹窗输密码 → 确认
  // 断言:umountMock 收到 { path: '/dev/sda', password: 'pw' }
})

it('unmounting=true 时确认按钮禁用(在途防连点)', async () => {
  // umountMock 挂起不 resolve → 点确认 → 再查按钮 disabled
})
```

(实现体按 StorageDrives.test.ts 的 mount/flush 惯例写全;弹窗内容在 body,记得 `document.body.innerHTML=''` 复位。)

- [ ] **Step 6: 跑测试 + tsc**

Run: `pnpm exec vitest run src/storage src/views && pnpm exec vue-tsc --noEmit`
Expected: 全 PASS

- [ ] **Step 7: Commit**

```bash
git add src/storage/components/UnmountDialog.vue src/storage/components/UnmountDialog.test.ts src/views/StorageVolumes.vue src/views/StorageVolumes.test.ts
git commit -m "fix(storage): 卸载弹窗在途禁用+关闭清密码,补视图 v.disk 转发测试(P1 债,SP6-P2)"
```

---

### Task 4: CreateStorageDialog 组件

**Files:**
- Create: `src/storage/components/CreateStorageDialog.vue`
- Create: `src/storage/components/CreateStorageDialog.test.ts`
- Modify: `src/i18n/zh_cn.ts` + `src/i18n/en_us.ts`

**Interfaces:**
- Consumes: Task 1 `AvailDisk`;现有 `components/ui/Dialog.vue`(props `{open,title}` + `#footer` slot)、`home/util/format` 的 `fmtSize`
- Produces: `CreateStorageDialog` — props `{ open: boolean; disks: AvailDisk[]; defaultName: string; busy?: boolean }`,emits `update:open(boolean)`、`confirm({ path, name, format })`

- [ ] **Step 1: i18n key(两文件 storage 段尾追加)**

```ts
// zh_cn.ts
  storageCreate: '创建存储',
  storageCreateName: '存储名称',
  storageCreateChooseDisk: '选择硬盘',
  storageCreateWarnTitle: '警告',
  storageCreateWarnErase: '所选硬盘将被清空。请再次确认所选硬盘上没有需要备份的重要数据。',
  storageCreateAttentionTitle: '提示',
  storageCreateAttentionDirect: '该硬盘可直接用作存储,也可以选择格式化后创建;格式化会清空所选硬盘。',
  storageCreateOk: '格式化并创建',
  storageCreateDirect: '直接创建',
  storageCreating: '创建中…',
// en_us.ts
  storageCreate: 'Create storage',
  storageCreateName: 'Storage name',
  storageCreateChooseDisk: 'Choose drive',
  storageCreateWarnTitle: 'Warning',
  storageCreateWarnErase: 'The selected drive will be erased. Please make sure there is no important data on it that needs to be backed up.',
  storageCreateAttentionTitle: 'Attention',
  storageCreateAttentionDirect: 'This drive can be used as storage directly, or created after formatting. Formatting erases the selected drive.',
  storageCreateOk: 'Format and create',
  storageCreateDirect: 'Create',
  storageCreating: 'Creating…',
```

- [ ] **Step 2: 写失败测试 `CreateStorageDialog.test.ts`**(惯例同 UnmountDialog.test.ts:body 复位、nextTick、原生事件触发 v-model)

```ts
const DISKS = [
  { path: '/dev/sdb', name: 'sdb', model: 'WD Blue', size: 1e12, needFormat: true, serial: 'S1' },
  { path: '/dev/sdc', name: 'sdc', model: 'SG Iron', size: 2e12, needFormat: false, serial: 'S2' },
]

it('打开时填入默认名并预选第一块盘', ...)
  // props {open:true, disks:DISKS, defaultName:'Main-storage1'} → input value=Main-storage1,select 选中 index 0

it('名称输入过滤非法字符(仅 \\w 和连字符)', ...)
  // 输入 'a b!c-d' → value 变 'abc-d'

it('need_format 盘显示清空警告;可直连盘显示提示且多出「直接创建」按钮', ...)
  // 选 index0(needFormat)→ 有 storageCreateWarnErase,无 direct 按钮
  // 选 index1 → 有 storageCreateAttentionDirect,有 direct 按钮

it('确认 emit 完整 payload:格式化按钮 format:true,直连按钮 format:false', ...)
  // 选 sdc 点 direct → confirm 收到 {path:'/dev/sdc', name:<当前名>, format:false}
  // 点「格式化并创建」→ {path:'/dev/sdc', name:<当前名>, format:true}

it('名称为空时提交按钮禁用;busy 时全部按钮禁用且主按钮文案变 storageCreating', ...)
```

- [ ] **Step 3: 跑测试确认失败**

Run: `pnpm exec vitest run src/storage/components/CreateStorageDialog.test.ts`
Expected: FAIL(组件不存在)

- [ ] **Step 4: 实现 `CreateStorageDialog.vue`**

```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Dialog from '../../components/ui/Dialog.vue'
import { fmtSize } from '../../home/util/format'
import type { AvailDisk } from '../util/storageMap'

const props = defineProps<{ open: boolean; disks: AvailDisk[]; defaultName: string; busy?: boolean }>()
const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'confirm', payload: { path: string; name: string; format: boolean }): void
}>()
const { t } = useI18n()

const name = ref('')
const diskIndex = ref(0)
// 每次打开重置为默认名 + 预选第一块盘;immediate 兜住「初始即 open:true」的挂载
watch(
  () => props.open,
  (o) => {
    if (o) {
      name.value = props.defaultName
      diskIndex.value = 0
    }
  },
  { immediate: true },
)
// Vue2 同款:名称只允许 \w 与连字符
function onNameInput(e: Event) {
  const el = e.target as HTMLInputElement
  name.value = el.value.replace(/[^\w-]/g, '')
  el.value = name.value
}
const selected = computed<AvailDisk | undefined>(() => props.disks[diskIndex.value])
const canSubmit = computed(() => !!name.value && !!selected.value && !props.busy)
function submit(format: boolean) {
  if (!canSubmit.value || !selected.value) return
  emit('confirm', { path: selected.value.path, name: name.value, format })
}
</script>

<template>
  <Dialog :open="open" :title="t('storageCreate')" @update:open="emit('update:open', $event)">
    <label class="cs-label">{{ t('storageCreateName') }}</label>
    <input :value="name" class="cs-input" type="text" @input="onNameInput" />
    <label class="cs-label">{{ t('storageCreateChooseDisk') }}</label>
    <select v-model.number="diskIndex" class="cs-input cs-select">
      <option v-for="(d, i) in disks" :key="d.path" :value="i">
        {{ d.name }} ({{ d.model }} - {{ fmtSize(d.size) }})
      </option>
    </select>
    <aside v-if="selected" class="cs-warn" :class="selected.needFormat ? 'danger' : 'notice'">
      <strong>{{ selected.needFormat ? t('storageCreateWarnTitle') : t('storageCreateAttentionTitle') }}</strong>
      <p>{{ selected.needFormat ? t('storageCreateWarnErase') : t('storageCreateAttentionDirect') }}</p>
      <p v-if="!selected.needFormat">{{ t('storageCreateWarnErase') }}</p>
    </aside>
    <template #footer>
      <button class="cs-btn" type="button" :disabled="busy" @click="emit('update:open', false)">{{ t('storageCancel') }}</button>
      <button v-if="selected && !selected.needFormat" class="cs-btn" type="button" :disabled="!canSubmit" @click="submit(false)">
        {{ t('storageCreateDirect') }}
      </button>
      <button class="cs-btn danger" type="button" :disabled="!canSubmit" @click="submit(true)">
        {{ busy ? t('storageCreating') : t('storageCreateOk') }}
      </button>
    </template>
  </Dialog>
</template>

<style scoped>
.cs-label { display: block; margin: 12px 0 6px; font-size: 12.5px; color: var(--fg-muted); }
.cs-label:first-of-type { margin-top: 0; }
.cs-input {
  width: 100%; box-sizing: border-box; padding: 9px 12px; font-size: 14px;
  border-radius: 10px; border: 1px solid var(--chip-border);
  background: var(--chip-bg); color: var(--fg); outline: none;
}
.cs-input:focus { border-color: var(--accent); }
.cs-select { appearance: auto; }
.cs-warn { margin-top: 14px; padding: 10px 12px; border-radius: 10px; font-size: 13px; border: 1px solid var(--chip-border); }
.cs-warn strong { display: block; margin-bottom: 4px; font-size: 13px; }
.cs-warn p { margin: 0 0 4px; color: var(--fg-muted); }
.cs-warn.danger { border-color: var(--remove-fg); }
.cs-warn.danger strong { color: var(--remove-fg); }
.cs-btn {
  padding: 7px 16px; border-radius: 999px; border: 1px solid var(--chip-border);
  background: var(--chip-bg); color: var(--fg); cursor: pointer; font-size: 13px;
}
.cs-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.cs-btn.danger { color: var(--remove-fg); border-color: var(--remove-fg); }
</style>
```

(可直连盘的警告区同时展示「可直连」提示与「格式化会清空」补充句,对应 Vue2 mountable 分支的双句文案。)

- [ ] **Step 5: 跑测试 + parity + tsc**

Run: `pnpm exec vitest run src/storage src/i18n && pnpm exec vue-tsc --noEmit`
Expected: 全 PASS

- [ ] **Step 6: Commit**

```bash
git add src/storage/components/CreateStorageDialog.vue src/storage/components/CreateStorageDialog.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(storage): 创建存储弹窗组件(选盘+格式化警告+双按钮,SP6-P2)"
```

---

### Task 5: FormatDialog 组件 + VolumeCard 格式化按钮

**Files:**
- Create: `src/storage/components/FormatDialog.vue`
- Create: `src/storage/components/FormatDialog.test.ts`
- Modify: `src/storage/components/VolumeCard.vue`(非系统卷加「格式化」按钮)
- Modify: `src/storage/components/VolumeCard.test.ts`
- Modify: `src/i18n/zh_cn.ts` + `src/i18n/en_us.ts`

**Interfaces:**
- Consumes: Task 3 后的 UnmountDialog 形态(busy prop + 开关清密码,同构复刻)
- Produces:
  - `FormatDialog` — props `{ open: boolean; name: string; busy?: boolean }`,emits `update:open(boolean)`、`confirm(password: string)`
  - `VolumeCard` 新增 emit `format`(仅 `!volume.isSystem` 显示按钮)

- [ ] **Step 1: i18n key(两文件追加)**

```ts
// zh_cn.ts
  storageFormat: '格式化',
  storageFormatTitle: '格式化存储',
  storageFormatMsg: '将格式化存储「{name}」,其中所有数据将被清空且无法恢复。输入登录密码以继续:',
  storageFormatOk: '确认格式化',
// en_us.ts
  storageFormat: 'Format',
  storageFormatTitle: 'Format storage',
  storageFormatMsg: 'Storage "{name}" will be formatted. All data on it will be erased and cannot be recovered. Enter your login password to continue:',
  storageFormatOk: 'Format',
```

- [ ] **Step 2: 写失败测试**。`FormatDialog.test.ts` 用例(镜像 UnmountDialog.test.ts 全套):渲染 name 插值消息、密码空则确认禁用、输密码点确认 emit `confirm('pw')`、enter 提交、busy 双按钮禁用、开关清密码。`VolumeCard.test.ts` 追加:非系统卷点「格式化」emit `format`;系统卷无格式化按钮(现有「无移除按钮」用例旁)。

- [ ] **Step 3: 跑测试确认失败**

Run: `pnpm exec vitest run src/storage/components`
Expected: FAIL

- [ ] **Step 4: 实现 `FormatDialog.vue`**(UnmountDialog 同构,复用其样式量;类名前缀 `fd-`)

```vue
<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Dialog from '../../components/ui/Dialog.vue'

const props = defineProps<{ open: boolean; name: string; busy?: boolean }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void; (e: 'confirm', password: string): void }>()
const { t } = useI18n()
const password = ref('')
// 开/关都清空:关闭后明文密码不得驻留内存
watch(
  () => props.open,
  () => {
    password.value = ''
  },
)
</script>

<template>
  <Dialog :open="open" :title="t('storageFormatTitle')" @update:open="emit('update:open', $event)">
    <p class="fd-msg">{{ t('storageFormatMsg', { name }) }}</p>
    <input
      v-model="password"
      type="password"
      class="fd-input"
      :placeholder="t('storageUnmountPassword')"
      @keyup.enter="password && !busy && emit('confirm', password)"
    />
    <template #footer>
      <button class="fd-btn" type="button" :disabled="busy" @click="emit('update:open', false)">{{ t('storageCancel') }}</button>
      <button class="fd-btn danger" type="button" :disabled="!password || busy" @click="emit('confirm', password)">
        {{ t('storageFormatOk') }}
      </button>
    </template>
  </Dialog>
</template>

<style scoped>
.fd-msg { margin: 0 0 12px; font-size: 14px; color: var(--fg-muted); }
.fd-input {
  width: 100%; box-sizing: border-box; padding: 9px 12px; font-size: 14px;
  border-radius: 10px; border: 1px solid var(--chip-border);
  background: var(--chip-bg); color: var(--fg); outline: none;
}
.fd-input:focus { border-color: var(--accent); }
.fd-btn {
  padding: 7px 16px; border-radius: 999px; border: 1px solid var(--chip-border);
  background: var(--chip-bg); color: var(--fg); cursor: pointer; font-size: 13px;
}
.fd-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.fd-btn.danger { color: var(--remove-fg); border-color: var(--remove-fg); }
</style>
```

- [ ] **Step 5: `VolumeCard.vue` 加按钮**——`vc-head` 内按钮区改为(新增 emit 声明 `(e: 'format'): void`):

```html
<div v-if="!volume.isSystem" class="vc-actions">
  <button class="vc-act" type="button" @click="$emit('format')">{{ t('storageFormat') }}</button>
  <button class="vc-act danger" type="button" @click="$emit('unmount')">{{ t('storageUnmount') }}</button>
</div>
```

样式:原 `.vc-remove` 改成通用 `.vc-act`(中性 chip)+ `.vc-act.danger`(现 remove 样式),`.vc-actions { display:flex; gap:8px; flex:none; }`。同步更新 VolumeCard.test.ts 里对 `.vc-remove` 的既有选择器。

- [ ] **Step 6: 跑测试 + parity + tsc**

Run: `pnpm exec vitest run src/storage src/i18n && pnpm exec vue-tsc --noEmit`
Expected: 全 PASS

- [ ] **Step 7: Commit**

```bash
git add src/storage/components/FormatDialog.vue src/storage/components/FormatDialog.test.ts src/storage/components/VolumeCard.vue src/storage/components/VolumeCard.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(storage): 卷格式化弹窗 + VolumeCard 格式化入口(SP6-P2)"
```

---

### Task 6: StorageVolumes 页面接线(创建按钮 + 两弹窗)

**Files:**
- Modify: `src/views/StorageVolumes.vue`
- Modify: `src/views/StorageVolumes.test.ts`
- Modify: `src/i18n/zh_cn.ts` + `src/i18n/en_us.ts`(1 个 key)

**Interfaces:**
- Consumes: Task 1 `computeNextStorageName`/`DEFAULT_STORAGE_NAME`;Task 2 store(`availDisks`/`raidNames`/`creating`/`formatting`/`createStorage`/`formatVolume`);Task 4 `CreateStorageDialog`;Task 5 `FormatDialog` + VolumeCard `format` emit
- Produces: P2 完整用户链路(P3+ 无消费)

- [ ] **Step 1: i18n key**

```ts
// zh_cn.ts
  storageCreateNoDisk: '请先插入硬盘,再创建存储',
// en_us.ts
  storageCreateNoDisk: 'Insert a drive to create storage',
```

- [ ] **Step 2: 写失败测试**(追加到 `StorageVolumes.test.ts`,fixture 需给 `disks.getDiskList` 的 `avail` 填一块盘)

```ts
it('无候选盘时创建按钮禁用并带提示 title', ...)
  // avail:[] → button[disabled],title=storageCreateNoDisk

it('创建链路:点创建→弹窗→确认→service.storage.create 收到 {path,name,format}', ...)
  // avail 有 needFormat:'false' 盘 → 打开弹窗默认名 Main-storage(与现有卷名去重)
  // 点「格式化并创建」→ createMock 收到 { path:'/dev/sdb', name:'Main-storage', format:true }

it('默认名与现有卷名去重:已有 Main-storage 卷时默认填 Main-storage1', ...)

it('格式化链路:VolumeCard format → FormatDialog 密码 → service.storage.format 收到 {path: v.path, volume: v.mountPoint, password}', ...)
  // 断言 formatMock 收到 { path:'/dev/sda1', volume:'/mnt/a', password:'pw' } —— path 是分区路径,volume 是挂载点
```

- [ ] **Step 3: 跑测试确认失败**

Run: `pnpm exec vitest run src/views/StorageVolumes.test.ts`
Expected: FAIL

- [ ] **Step 4: 接线 `StorageVolumes.vue`**

script 新增:

```ts
import { computed } from 'vue' // 并入现有 import
import CreateStorageDialog from '../storage/components/CreateStorageDialog.vue'
import FormatDialog from '../storage/components/FormatDialog.vue'
import { computeNextStorageName, DEFAULT_STORAGE_NAME } from '../storage/util/storageNaming'

const createOpen = ref(false)
// 存储名与 RAID 名共享命名空间(Vue2 allUsedNames 同款)
const defaultName = computed(() =>
  computeNextStorageName(DEFAULT_STORAGE_NAME, [
    ...store.volumes.map((v) => v.name),
    ...store.raidNames,
  ]),
)
async function doCreate(payload: { path: string; name: string; format: boolean }) {
  const ok = await store.createStorage(payload)
  if (ok) createOpen.value = false
}

const formatOpen = ref(false)
const pendingFormat = ref<StorageVolume | null>(null)
function askFormat(v: StorageVolume) {
  pendingFormat.value = v
  formatOpen.value = true
}
async function doFormat(password: string) {
  if (!pendingFormat.value) return
  // 契约:path=分区路径,volume=挂载点(Vue2 formatStorage 同款)
  const ok = await store.formatVolume({
    path: pendingFormat.value.path,
    volume: pendingFormat.value.mountPoint,
    password,
  })
  if (ok) formatOpen.value = false
}
```

template:列表上方加工具行,卡片加 `@format`,尾部挂两弹窗:

```html
<StorageShell>
  <div class="sv-toolbar">
    <button
      class="sv-create"
      type="button"
      :disabled="!store.availDisks.length"
      :title="store.availDisks.length ? '' : t('storageCreateNoDisk')"
      @click="createOpen = true"
    >
      {{ t('storageCreate') }}
    </button>
  </div>
  <!-- 现有 loading/empty/v-for 保持,VolumeCard 加 @format="askFormat(v)" -->
  <CreateStorageDialog
    v-model:open="createOpen"
    :disks="store.availDisks"
    :default-name="defaultName"
    :busy="store.creating"
    @confirm="doCreate"
  />
  <FormatDialog v-model:open="formatOpen" :name="pendingFormat?.name || ''" :busy="store.formatting" @confirm="doFormat" />
  <!-- UnmountDialog 原样保留 -->
</StorageShell>
```

style 追加:

```css
.sv-toolbar { display: flex; justify-content: flex-end; margin-bottom: 14px; }
.sv-create {
  padding: 7px 18px; border-radius: 999px; border: 1px solid var(--chip-border);
  background: var(--chip-bg); color: var(--fg); cursor: pointer; font-size: 13px;
}
.sv-create:hover:not(:disabled) { background: var(--chip-bg-hi); }
.sv-create:disabled { opacity: 0.45; cursor: not-allowed; }
```

- [ ] **Step 5: 全量验证**

Run: `pnpm test && pnpm exec vue-tsc --noEmit`
Expected: 全绿(基线 1238 + 本期新增)

- [ ] **Step 6: Commit**

```bash
git add src/views/StorageVolumes.vue src/views/StorageVolumes.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(storage): 卷列表页接线创建存储+格式化完整链路(SP6-P2)"
```

---

## 收尾验收门(controller 执行,非 task)

1. 全分支终审(requesting-code-review,MERGE_BASE = c64298b)。
2. `pnpm build`(vue-tsc + vite build)刷新 `dist/`,确认 5273 常驻 preview 伺服新产物(`curl -s http://127.0.0.1:5273/app/ | head`)。
3. 用户眼验(§6 口径):创建链路验到确认弹窗;格式化验到密码弹窗前一步;无盘禁用态;有闲盘则按用户安排升级实盘验证。
4. 台账 `.superpowers/sdd/progress.md` 记账。
