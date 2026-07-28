import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import type { RaidStatus } from '@nimotech/nimoos-service'
import { i18n } from '../../i18n'
import { useToast } from '../../stores/toast'
import { mapVolumes, mapDrives, mapAvailDisks, type StorageVolume, type PhysicalDrive, type AvailDisk } from '../util/storageMap'
import { asRaidArray, mapTask, type RaidArray, type RaidUsage, type RaidTask } from '../util/raidView'

export const useStorageStore = defineStore('storage', () => {
  const volumes = ref<StorageVolume[]>([])
  const drives = ref<PhysicalDrive[]>([])
  const availDisks = ref<AvailDisk[]>([])
  const raidNames = ref<string[]>([])
  const raidArrays = ref<RaidArray[]>([])
  const raidStatusMap = ref<Record<string, RaidStatus>>({})
  const raidLoading = ref(false)
  const raidDetail = ref<{ array: RaidArray; status: RaidStatus | null; usage: RaidUsage | null } | null>(null)
  const raidDetailLoading = ref(false)
  const creatingTask = ref<RaidTask | null>(null)
  let clearTimer: number | undefined
  const loading = ref(false)
  const unmounting = ref(false)
  const creating = ref(false)
  const formatting = ref(false)
  const raidCreating = ref(false)
  const raidRemoving = ref(false)
  const raidReplacing = ref(false)
  const raidRecovering = ref(false)
  const t = i18n.global.t

  async function loadVolumes() {
    try {
      // raid.list 兜底空数组:老后端无 /v2/raid 时卷列表照常工作
      const [storageRes, raidRes] = await Promise.all([
        service.storage.list({ system: 'show' }),
        service.raid.list().catch(() => [] as unknown[]),
      ])
      const raidArr = Array.isArray(raidRes) ? raidRes : []
      const raidMounts = new Set(
        raidArr
          .map((r) => (r as { mount_point?: string })?.mount_point)
          .filter((m): m is string => !!m),
      )
      raidNames.value = raidArr
        .map((r) => (r as { name?: string })?.name)
        .filter((n): n is string => !!n)
      volumes.value = mapVolumes(storageRes, raidMounts)
    } catch (e) {
      console.warn('[storage] volumes load failed', e)
      volumes.value = []
      raidNames.value = []
    }
  }

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

  async function loadAll() {
    loading.value = true
    try {
      await Promise.all([loadVolumes(), loadDrives()])
    } finally {
      loading.value = false
    }
  }

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
      await loadAll() // 成败都刷新;置于 finally 内,守卫持有至刷新完成
      creating.value = false
    }
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

  async function loadRaid() {
    if (raidLoading.value) return // 在途守卫:防轮询/热插拔重叠拉取
    raidLoading.value = true
    try {
      const listRes = await service.raid.list()
      const arrays = (Array.isArray(listRes) ? listRes : []).map(asRaidArray)
      raidArrays.value = arrays
      // 并发逐阵列拉 status;单个失败不拖垮整表(allSettled)
      const results = await Promise.allSettled(arrays.map((a) => service.raid.getStatus(a.id)))
      const map: Record<string, RaidStatus> = {}
      results.forEach((r, i) => { if (r.status === 'fulfilled') map[String(arrays[i].id)] = r.value })
      raidStatusMap.value = map
    } catch (e) {
      console.warn('[storage] raid load failed', (e as Error)?.message)
      raidArrays.value = []
      raidStatusMap.value = {}
    } finally {
      raidLoading.value = false
    }
  }

  async function loadRaidDetail(id: number | string) {
    if (raidDetailLoading.value) return
    raidDetailLoading.value = true
    try {
      const array = raidArrays.value.find((a) => String(a.id) === String(id))
        || asRaidArray({ id } as Record<string, unknown>)
      const [status, usage] = await Promise.all([
        service.raid.getStatus(id).catch(() => null),
        service.raid.getUsage(id).catch(() => null),
      ])
      raidDetail.value = { array, status: status as RaidStatus | null, usage: usage as RaidUsage | null }
    } catch (e) {
      console.warn('[storage] raid detail failed', (e as Error)?.message)
      raidDetail.value = null
    } finally {
      raidDetailLoading.value = false
    }
  }

  async function detectCreatingTask() {
    try {
      const res = await service.raid.listTasks()
      const tasks = Array.isArray(res) ? (res as Record<string, unknown>[]) : []
      const creatingRaw = tasks.find((t) => (t as { status?: string }).status === 'creating')
      if (creatingRaw) {
        clearTimeout(clearTimer)
        creatingTask.value = mapTask(creatingRaw)
      }
    } catch (e) {
      console.warn('[storage] listTasks failed', (e as Error)?.message)
    }
  }

  function startCreateTask(task: RaidTask) { clearTimeout(clearTimer); creatingTask.value = task } // P4 向导用
  function dismissCreateTask() { clearTimeout(clearTimer); creatingTask.value = null }

  // 创建:成功后不在此刷新列表(阵列进"创建中"任务流,由 startCreateTask + 轮询接管),
  // 从响应取 task 供向导调 startCreateTask。
  async function createRaid(body: {
    name: string; level: number; disk_paths: string[]
    chunk_kb: 512; filesystem: 'btrfs' | 'ext4'; enable_snapshots: boolean
  }): Promise<RaidTask | null> {
    if (raidCreating.value) return null
    raidCreating.value = true
    const toast = useToast()
    try {
      const res = (await service.raid.create(body)) as { data?: { task_id?: string } } | undefined
      const taskId = res?.data?.task_id
      // 用请求信息 + task_id 组装 creatingTask(step 未知先给初值,轮询会填)
      const task: RaidTask = {
        taskId: taskId ?? '', name: body.name, level: body.level,
        filesystem: body.filesystem, diskCount: body.disk_paths.length,
        step: 0, stepName: '', progress: 0, elapsedSeconds: 0, error: '', status: 'creating',
      }
      return task
    } catch (e) {
      console.warn('[storage] raid create failed', (e as Error)?.message)
      toast.show(t('raidCreateFailedToast'))
      return null
    } finally {
      raidCreating.value = false
    }
  }

  async function removeRaid(id: number | string): Promise<boolean> {
    if (raidRemoving.value) return false
    raidRemoving.value = true
    const toast = useToast()
    let ok = false
    try {
      await service.raid.remove(id)
      toast.show(t('raidRemoveSuccess'))
      ok = true
    } catch (e) {
      console.warn('[storage] raid remove failed', (e as Error)?.message)
      toast.show(t('raidRemoveFailed'))
    } finally {
      await loadRaid()
      raidRemoving.value = false
    }
    return ok
  }

  async function replaceRaidDisk(id: number | string, body: { old_disk_path: string; new_disk_path: string }): Promise<boolean> {
    if (raidReplacing.value) return false
    raidReplacing.value = true
    const toast = useToast()
    let ok = false
    try {
      await service.raid.replaceDisk(id, body)
      toast.show(t('raidReplaceSuccess'))
      ok = true
    } catch (e) {
      console.warn('[storage] raid replace failed', (e as Error)?.message)
      toast.show(t('raidReplaceFailed'))
    } finally {
      await loadRaid()
      raidReplacing.value = false
    }
    return ok
  }

  async function recoverRaid(id: number | string): Promise<{ state: string } | null> {
    if (raidRecovering.value) return null
    raidRecovering.value = true
    const toast = useToast()
    try {
      const res = (await service.raid.recover(id)) as { data?: { data?: { state?: string } } } | undefined
      const state = res?.data?.data?.state ?? 'retrying'
      if (state === 'active' || state === 'degraded' || state === 'rebuilding') toast.show(t('raidRecoverSuccess'))
      else toast.show(t('raidRecoverFailed'))
      return { state }
    } catch (e) {
      console.warn('[storage] raid recover failed', (e as Error)?.message)
      toast.show(t('raidRecoverFailed'))
      return null
    } finally {
      await loadRaid()
      raidRecovering.value = false
    }
  }

  async function pollCreateTaskOnce() {
    const cur = creatingTask.value
    if (!cur) return
    try {
      const raw = (await service.raid.getTask(cur.taskId)) as Record<string, unknown>
      // 保留身份字段(name/level/filesystem/diskCount);step/progress/error/elapsed 每拍以后端最新为准(总是回传)
      const merged = mapTask({ ...raw, task_id: cur.taskId, name: raw.name ?? cur.name, level: raw.level ?? cur.level, filesystem: raw.filesystem ?? cur.filesystem, disk_count: raw.disk_count ?? cur.diskCount })
      creatingTask.value = merged
      if (merged.status === 'done') {
        await loadRaid()
        clearTimeout(clearTimer)
        const doneId = merged.taskId
        clearTimer = window.setTimeout(() => {
          if (creatingTask.value?.taskId === doneId) creatingTask.value = null
        }, 1000)
      }
      // failed:卡保留(不清),交给用户 dismiss
    } catch (e) {
      // 404 视为任务已消失:清卡 + 刷新。两种形状都要接住——
      // axios 真 404 的 .code 是字符串('ERR_BAD_REQUEST'),数字状态码在 .response.status;
      // service unwrap() 抛的 Error 则把后端 success 数字塞进 .code。真 OR,不能用 ??。
      const err = e as { code?: unknown; response?: { status?: number } }
      if (err.code === 404 || err.response?.status === 404) {
        creatingTask.value = null
        await loadRaid()
      } else {
        console.warn('[storage] getTask failed', (e as Error)?.message)
      }
    }
  }

  return {
    volumes,
    drives,
    availDisks,
    raidNames,
    raidArrays,
    raidStatusMap,
    raidLoading,
    raidDetail,
    raidDetailLoading,
    loading,
    creating,
    formatting,
    unmounting,
    creatingTask,
    raidCreating,
    raidRemoving,
    raidReplacing,
    raidRecovering,
    loadVolumes,
    loadDrives,
    loadAll,
    unmount,
    createStorage,
    formatVolume,
    loadRaid,
    loadRaidDetail,
    detectCreatingTask,
    pollCreateTaskOnce,
    startCreateTask,
    dismissCreateTask,
    createRaid,
    removeRaid,
    replaceRaidDisk,
    recoverRaid,
  }
})
