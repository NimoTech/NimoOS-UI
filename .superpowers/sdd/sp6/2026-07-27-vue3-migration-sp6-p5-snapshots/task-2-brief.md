### Task 2: 快照 store(`stores/snapshot.ts`)

新建 Pinia setup-store,承接 Vue2 `SnapshotPanel` 的 `fetchVolume/fetchPolicy/onToggle/savePolicy/createSnapshot` 与 `SnapshotTimeline` 的 `fetchSnapshots/doDelete`。**本 Task 只做 store + 单测锁死请求形状**,组件在 T3–T6。

**Files:**
- Create: `src/storage/stores/snapshot.ts`
- Test: `src/storage/stores/snapshot.test.ts`
- Modify: `src/i18n/zh_cn.ts`、`src/i18n/en_us.ts`(本 Task 只加 8 个 toast 键,见附录 A 标「T2」的行)

**Interfaces:**
- Consumes: `service.snapshot.*`(签名见 Global Constraints);`useToast()`(`src/stores/toast.ts`,`show(text)`);`i18n.global.t`;T1 的 `asSnapshotVolume`/`SnapshotVolumeView`/`SnapshotRaw`/`PolicyForm`。
- Produces:
  ```ts
  export const useSnapshotStore = defineStore('snapshot', () => ({
    volume: Ref<SnapshotVolumeView | null>          // 初值 null
    policy: Ref<SnapshotPolicy | null>              // 初值 null
    snapshots: Ref<SnapshotRaw[]>                   // 初值 []
    volumeLoading: Ref<boolean>                     // 初值 true(Vue2 loading 初值 true,面板 v-if="!loading")
    listLoading: Ref<boolean>                       // 初值 true
    toggling: Ref<boolean>
    policySaving: Ref<boolean>
    creatingSnapshot: Ref<boolean>
    deletingName: Ref<string | null>                // 初值 null
    loadVolume(uuid: string): Promise<void>
    loadPolicy(uuid: string): Promise<void>
    loadSnapshots(uuid: string): Promise<void>
    toggle(uuid: string, enabled: boolean): Promise<void>
    savePolicy(uuid: string, form: PolicyForm): Promise<boolean>
    createSnapshot(uuid: string, label: string): Promise<boolean>
    removeSnapshot(uuid: string, name: string): Promise<boolean>
  }))
  ```

- [ ] **Step 1: 写失败测试** `src/storage/stores/snapshot.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const listVolumes = vi.fn()
const listMock = vi.fn()
const getPolicy = vi.fn()
const patchPolicy = vi.fn()
const togglePolicy = vi.fn()
const createMock = vi.fn()
const removeMock = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    snapshot: {
      listVolumes: (...a: unknown[]) => listVolumes(...a),
      list: (...a: unknown[]) => listMock(...a),
      getPolicy: (...a: unknown[]) => getPolicy(...a),
      patchPolicy: (...a: unknown[]) => patchPolicy(...a),
      togglePolicy: (...a: unknown[]) => togglePolicy(...a),
      create: (...a: unknown[]) => createMock(...a),
      remove: (...a: unknown[]) => removeMock(...a),
    },
  },
}))
const toastShow = vi.fn()
vi.mock('../../stores/toast', () => ({ useToast: () => ({ show: toastShow }) }))
vi.mock('../../i18n', () => ({ i18n: { global: { t: (k: string) => k } } }))

import { useSnapshotStore } from './snapshot'

const VOL = { volume_uuid: 'u1', mount: '/DATA', supported: true, enabled: true, count: 2, last_at: '2026-07-27T01:00:00Z' }

beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

describe('loadVolume', () => {
  it('按 volume_uuid 命中本卷,收窄成视图对象', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'other' }, VOL])
    const s = useSnapshotStore()
    await s.loadVolume('u1')
    expect(s.volume?.volume_uuid).toBe('u1')
    expect(s.volume?.count).toBe(2)
    expect(s.volumeLoading).toBe(false)
  })
  it('列表里没有本卷 → volume=null(面板落 unsupported 态)', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'other' }])
    const s = useSnapshotStore()
    await s.loadVolume('u1')
    expect(s.volume).toBeNull()
  })
  it('端点 404/抛错 → volume=null、loading 释放、只记 message 不记整个 error', async () => {
    listVolumes.mockRejectedValue(Object.assign(new Error('boom'), { config: { data: 'secret' } }))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const s = useSnapshotStore()
    await s.loadVolume('u1')
    expect(s.volume).toBeNull()
    expect(s.volumeLoading).toBe(false)
    expect(warn).toHaveBeenCalled()
    expect(JSON.stringify(warn.mock.calls)).not.toContain('config')
  })
})

describe('loadSnapshots', () => {
  it('取回列表;非数组响应归一为空数组', async () => {
    listMock.mockResolvedValue([{ name: 'a', created_at: '2026-07-27T00:00:00Z' }])
    const s = useSnapshotStore()
    await s.loadSnapshots('u1')
    expect(listMock).toHaveBeenCalledWith('u1')
    expect(s.snapshots).toHaveLength(1)
    listMock.mockResolvedValue(null)
    await s.loadSnapshots('u1')
    expect(s.snapshots).toEqual([])
    expect(s.listLoading).toBe(false)
  })
  it('抛错 → 列表清空、loading 释放', async () => {
    listMock.mockRejectedValue(new Error('x'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const s = useSnapshotStore()
    await s.loadSnapshots('u1')
    expect(s.snapshots).toEqual([])
    expect(s.listLoading).toBe(false)
  })
})

describe('toggle', () => {
  it('成功:调 togglePolicy(uuid, enabled)、本地 enabled 跟随、出成功 toast、单飞', async () => {
    listVolumes.mockResolvedValue([VOL])
    togglePolicy.mockResolvedValue(undefined)
    const s = useSnapshotStore()
    await s.loadVolume('u1')
    await Promise.all([s.toggle('u1', false), s.toggle('u1', false)]) // 并发第二发被守卫吞掉
    expect(togglePolicy).toHaveBeenCalledTimes(1)
    expect(togglePolicy).toHaveBeenCalledWith('u1', false)
    expect(s.volume?.enabled).toBe(false)
    expect(toastShow).toHaveBeenCalledWith('snapToggleOff')
    expect(s.toggling).toBe(false)
  })
  it('失败:本地回滚到原值 + 失败 toast', async () => {
    listVolumes.mockResolvedValue([VOL])           // enabled: true
    togglePolicy.mockRejectedValue(new Error('x'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const s = useSnapshotStore()
    await s.loadVolume('u1')
    await s.toggle('u1', false)
    expect(s.volume?.enabled).toBe(true)
    expect(toastShow).toHaveBeenCalledWith('snapToggleFailed')
  })
})

describe('savePolicy', () => {
  const form = { hourly_keep: 12, daily_keep: 5, weekly_keep: 3, pause_threshold_pct: 80 }
  it('走 patchPolicy(读-改-写)传整个表单;成功返回 true', async () => {
    patchPolicy.mockResolvedValue(null)
    const s = useSnapshotStore()
    const ok = await s.savePolicy('u1', form)
    expect(patchPolicy).toHaveBeenCalledWith('u1', form)
    expect(ok).toBe(true)
    expect(toastShow).toHaveBeenCalledWith('snapPolicySaved')
  })
  it('后端 PUT 返回 null 时,本地 policy 用刚保存的表单值(Vue2 此处会显示 undefined,不照抄)', async () => {
    getPolicy.mockResolvedValue({ volume_uuid: 'u1', enabled: true, hourly_keep: 24, daily_keep: 7, weekly_keep: 4, pause_threshold_pct: 90 })
    patchPolicy.mockResolvedValue(null)
    const s = useSnapshotStore()
    await s.loadPolicy('u1')
    await s.savePolicy('u1', form)
    expect(s.policy?.hourly_keep).toBe(12)
    expect(s.policy?.pause_threshold_pct).toBe(80)
    expect(s.policy?.enabled).toBe(true)      // 未在表单里的字段保持原值
  })
  it('失败 → 返回 false + 失败 toast + busy 复位', async () => {
    patchPolicy.mockRejectedValue(new Error('x'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const s = useSnapshotStore()
    expect(await s.savePolicy('u1', form)).toBe(false)
    expect(toastShow).toHaveBeenCalledWith('snapPolicySaveFailed')
    expect(s.policySaving).toBe(false)
  })
})

describe('createSnapshot', () => {
  it('有备注:body = {volume_uuid, label}(label 前后空白被 trim)', async () => {
    createMock.mockResolvedValue(undefined)
    listVolumes.mockResolvedValue([VOL])
    listMock.mockResolvedValue([])
    const s = useSnapshotStore()
    expect(await s.createSnapshot('u1', '  升级前  ')).toBe(true)
    expect(createMock).toHaveBeenCalledWith({ volume_uuid: 'u1', label: '升级前' })
    expect(toastShow).toHaveBeenCalledWith('snapCreated')
  })
  it('无备注:body 里不得出现 label 字段', async () => {
    createMock.mockResolvedValue(undefined)
    listVolumes.mockResolvedValue([VOL])
    listMock.mockResolvedValue([])
    const s = useSnapshotStore()
    await s.createSnapshot('u1', '   ')
    expect(createMock).toHaveBeenCalledWith({ volume_uuid: 'u1' })
    expect(Object.keys(createMock.mock.calls[0][0] as object)).toEqual(['volume_uuid'])
  })
  it('成功后刷新卷摘要与快照列表', async () => {
    createMock.mockResolvedValue(undefined)
    listVolumes.mockResolvedValue([VOL])
    listMock.mockResolvedValue([])
    const s = useSnapshotStore()
    await s.createSnapshot('u1', '')
    expect(listVolumes).toHaveBeenCalled()
    expect(listMock).toHaveBeenCalledWith('u1')
  })
  it('单飞:并发第二发被吞;失败出失败 toast 且 busy 复位', async () => {
    createMock.mockResolvedValue(undefined)
    listVolumes.mockResolvedValue([VOL]); listMock.mockResolvedValue([])
    const s = useSnapshotStore()
    await Promise.all([s.createSnapshot('u1', ''), s.createSnapshot('u1', '')])
    expect(createMock).toHaveBeenCalledTimes(1)
    createMock.mockRejectedValue(new Error('x'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await s.createSnapshot('u1', '')).toBe(false)
    expect(toastShow).toHaveBeenCalledWith('snapCreateFailed')
    expect(s.creatingSnapshot).toBe(false)
  })
})

describe('removeSnapshot', () => {
  it('调 remove(name, uuid) —— 参数顺序不可颠倒;成功后本地摘除该条并刷新卷摘要', async () => {
    listMock.mockResolvedValue([
      { name: 'snap-a', created_at: '2026-07-27T00:00:00Z' },
      { name: 'snap-b', created_at: '2026-07-26T00:00:00Z' },
    ])
    listVolumes.mockResolvedValue([VOL])
    removeMock.mockResolvedValue(undefined)
    const s = useSnapshotStore()
    await s.loadSnapshots('u1')
    expect(await s.removeSnapshot('u1', 'snap-a')).toBe(true)
    expect(removeMock).toHaveBeenCalledWith('snap-a', 'u1')
    expect(s.snapshots.map(x => x.name)).toEqual(['snap-b'])
    expect(listVolumes).toHaveBeenCalled()
    expect(toastShow).toHaveBeenCalledWith('snapDeleted')
    expect(s.deletingName).toBeNull()
  })
  it('删除中再点(同一/另一条)被守卫吞掉', async () => {
    listMock.mockResolvedValue([{ name: 'snap-a', created_at: '2026-07-27T00:00:00Z' }])
    listVolumes.mockResolvedValue([VOL])
    removeMock.mockResolvedValue(undefined)
    const s = useSnapshotStore()
    await s.loadSnapshots('u1')
    await Promise.all([s.removeSnapshot('u1', 'snap-a'), s.removeSnapshot('u1', 'snap-a')])
    expect(removeMock).toHaveBeenCalledTimes(1)
  })
  it('失败 → 返回 false、列表不变、失败 toast、守卫复位', async () => {
    listMock.mockResolvedValue([{ name: 'snap-a', created_at: '2026-07-27T00:00:00Z' }])
    removeMock.mockRejectedValue(new Error('x'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const s = useSnapshotStore()
    await s.loadSnapshots('u1')
    expect(await s.removeSnapshot('u1', 'snap-a')).toBe(false)
    expect(s.snapshots).toHaveLength(1)
    expect(toastShow).toHaveBeenCalledWith('snapDeleteFailed')
    expect(s.deletingName).toBeNull()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run src/storage/stores/snapshot.test.ts`
Expected: FAIL(store 不存在)。

- [ ] **Step 3: 实现 `src/storage/stores/snapshot.ts`**

```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import type { SnapshotPolicy } from '@nimotech/nimoos-service'
import { i18n } from '../../i18n'
import { useToast } from '../../stores/toast'
import { asSnapshotVolume, type SnapshotVolumeView, type SnapshotRaw, type PolicyForm } from '../util/snapshotView'

export const useSnapshotStore = defineStore('snapshot', () => {
  const volume = ref<SnapshotVolumeView | null>(null)
  const policy = ref<SnapshotPolicy | null>(null)
  const snapshots = ref<SnapshotRaw[]>([])
  // Vue2 SnapshotPanel/SnapshotTimeline 的 loading 初值都是 true(面板 v-if="!loading"),
  // 首帧不闪空态,逐字继承。
  const volumeLoading = ref(true)
  const listLoading = ref(true)
  const toggling = ref(false)
  const policySaving = ref(false)
  const creatingSnapshot = ref(false)
  const deletingName = ref<string | null>(null)
  const t = i18n.global.t

  async function loadVolume(uuid: string) {
    try {
      const list = await service.snapshot.listVolumes()
      const hit = (Array.isArray(list) ? list : []).find(
        (v) => (v as { volume_uuid?: string })?.volume_uuid === uuid,
      )
      volume.value = hit ? asSnapshotVolume(hit) : null
    } catch (e) {
      // 快照是可选功能(老后端 /v2/snapshot/* 全 404):吞错落 unsupported 态,
      // 绝不能把 RAID 详情页拖垮 —— Vue2 SnapshotPanel.fetchVolume 同款语义。
      console.warn('[snapshot] load volume failed', (e as Error)?.message)
      volume.value = null
    } finally {
      volumeLoading.value = false
    }
  }

  async function loadPolicy(uuid: string) {
    try {
      policy.value = await service.snapshot.getPolicy(uuid)
    } catch (e) {
      console.warn('[snapshot] load policy failed', (e as Error)?.message)
      policy.value = null
    }
  }

  async function loadSnapshots(uuid: string) {
    listLoading.value = true
    try {
      const res = await service.snapshot.list(uuid)
      snapshots.value = Array.isArray(res) ? (res as SnapshotRaw[]) : []
    } catch (e) {
      console.warn('[snapshot] load list failed', (e as Error)?.message)
      snapshots.value = []
    } finally {
      listLoading.value = false
    }
  }

  async function toggle(uuid: string, enabled: boolean) {
    if (toggling.value) return
    toggling.value = true
    const toast = useToast()
    try {
      await service.snapshot.togglePolicy(uuid, enabled)
      if (volume.value) volume.value.enabled = enabled
      toast.show(enabled ? t('snapToggleOn') : t('snapToggleOff'))
    } catch (e) {
      console.warn('[snapshot] toggle failed', (e as Error)?.message)
      // Vue2 失败分支写的是 volume.enabled = !val,即回到切换前的值 —— 逐字继承
      if (volume.value) volume.value.enabled = !enabled
      toast.show(t('snapToggleFailed'))
    } finally {
      toggling.value = false
    }
  }

  async function savePolicy(uuid: string, form: PolicyForm): Promise<boolean> {
    if (policySaving.value) return false
    policySaving.value = true
    const toast = useToast()
    try {
      // 策略写一律走 patchPolicy(读-改-写);PUT 是全量替换,漏字段会把保留数清零
      await service.snapshot.patchPolicy(uuid, { ...form })
      // ⚠️ Vue2 bug 不照抄:后端 PUT /v2/snapshot/policy 返回 data:null
      //(NimoOS-LocalStorage route/snapshot.go putSnapshotPolicy),Vue2 却把整个响应
      // 信封赋给 policy,导致保存后摘要行显示 "保留 undefined"。这里改成用刚写进去的
      // 表单值合并进本地 policy —— PUT 是全量替换,我们确知落库内容。
      policy.value = { ...(policy.value ?? {}), ...form }
      toast.show(t('snapPolicySaved'))
      return true
    } catch (e) {
      console.warn('[snapshot] save policy failed', (e as Error)?.message)
      toast.show(t('snapPolicySaveFailed'))
      return false
    } finally {
      policySaving.value = false
    }
  }

  async function createSnapshot(uuid: string, label: string): Promise<boolean> {
    if (creatingSnapshot.value) return false
    creatingSnapshot.value = true
    const toast = useToast()
    try {
      const trimmed = label.trim()
      // 契约:POST /v2/snapshot {volume_uuid} + 仅在备注非空时带 label(Vue2 逐字)
      await service.snapshot.create({ volume_uuid: uuid, ...(trimmed ? { label: trimmed } : {}) })
      toast.show(t('snapCreated'))
      // Vue2 用 refreshSignal(count|last_at)间接触发时间线刷新;这里 store 直连,
      // 建完直接刷卷摘要 + 列表(行为等价,少一层字符串信号)
      await Promise.all([loadVolume(uuid), loadSnapshots(uuid)])
      return true
    } catch (e) {
      console.warn('[snapshot] create failed', (e as Error)?.message)
      toast.show(t('snapCreateFailed'))
      return false
    } finally {
      creatingSnapshot.value = false
    }
  }

  async function removeSnapshot(uuid: string, name: string): Promise<boolean> {
    if (deletingName.value) return false
    deletingName.value = name
    const toast = useToast()
    try {
      // 参数顺序 (name, volumeUuid);共享包内部对 name 做 encodeURIComponent(名字常含中文)
      await service.snapshot.remove(name, uuid)
      snapshots.value = snapshots.value.filter((s) => s.name !== name)
      toast.show(t('snapDeleted'))
      // 删除会改变卷的 count/last_at:刷新摘要(Vue2 靠 @deleted 冒泡回父组件做同一件事)
      await loadVolume(uuid)
      return true
    } catch (e) {
      console.warn('[snapshot] delete failed', (e as Error)?.message)
      toast.show(t('snapDeleteFailed'))
      return false
    } finally {
      deletingName.value = null
    }
  }

  return {
    volume, policy, snapshots,
    volumeLoading, listLoading, toggling, policySaving, creatingSnapshot, deletingName,
    loadVolume, loadPolicy, loadSnapshots, toggle, savePolicy, createSnapshot, removeSnapshot,
  }
})
```

加 i18n(附录 A 标 T2 的 8 个键)到 `zh_cn.ts` 与 `en_us.ts`,位置紧跟现有 `raid*` 键之后。

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run src/storage/stores/snapshot.test.ts` → PASS
Run: `pnpm exec vitest run src/i18n/parity.test.ts` → PASS
Run: `pnpm exec vue-tsc --noEmit` → 零错

- [ ] **Step 5: Commit**

```bash
git add src/storage/stores/snapshot.ts src/storage/stores/snapshot.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(storage): 快照 store 六 action + 守卫 + 请求形状单测锁死(P5 T2)"
```

---

