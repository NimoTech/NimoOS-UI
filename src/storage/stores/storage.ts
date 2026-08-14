import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import type { RaidStatus, RaidReplaceDiskBody } from '@nimotech/nimoos-service'
import { i18n } from '../../i18n'
import { useToast } from '../../stores/toast'
import { mapVolumes, mapDrives, mapAvailDisks, type StorageVolume, type PhysicalDrive, type AvailDisk } from '../util/storageMap'
import { asRaidArray, mapTask, replaceOutcome, reclaimOutcome, raidSeverity, resolveRaidState, type RaidArray, type RaidUsage, type RaidTask, type ReplaceTask, type ReclaimTask } from '../util/raidView'

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
  // Dashboard task for an in-progress disk replacement. Backend PUT /v2/raid/:id/replace-disk is **synchronous**
  // (route/v2/raid.go:266 ReplaceDisk; it returns as soon as mdadm --fail/--remove/--add finishes),
  // with no task_id / 6-step progress like the create flow —— the actual rebuild runs in the kernel, and progress
  // can only be read from the status endpoint's rebuild_pct. So this task state is maintained by the frontend itself:
  // created when the submit succeeds, and on every array-status refresh we check whether the new disk is
  // "active sync"; if so, the replacement counts as done.
  const replaceTask = ref<ReplaceTask | null>(null)
  // 收回成员盘进行中的任务(reattachable_members 一键收回)。与 replaceTask 同机制:
  // recover 接口同步返回 readded,增量同步在内核里跑,完成判定靠核对 status.members
  // (raidView.ts reclaimOutcome)。它同时是列表页/详情页强制轮询的开关 —— --re-add 后
  // 头几秒盘还是 spare、不算重建态,只挂 isRebuilding 会一拍都不发请求。
  const reclaimTask = ref<ReclaimTask | null>(null)
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
      // raid.list falls back to an empty array: the volume list keeps working when the old backend lacks /v2/raid
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
      // Pass res.disks in to backfill health: health in avail is always an empty string (backend assignment-order defect);
      // the same disk only carries the real "true"/"false" in the disks list. See the mapAvailDisks comment.
      availDisks.value = mapAvailDisks(res?.avail, res?.disks)
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
      // Contract: DELETE /v1/disks {path: parent disk path, password} (same as Vue2 StorageItem)
      await service.disks.umount({ path: diskPath, password })
      toast.show(t('storageUnmountSuccess'))
      await loadAll()
      return true
    } catch (e) {
      // Log only the message: AxiosError carries the request body (plaintext password), never log the whole object
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
      // Contract: POST /v1/storage {path, name, format}, exactly three fields (same as Vue2 submitCreate)
      await service.storage.create(payload)
      toast.show(t('storageCreateSuccess'))
      ok = true
    } catch (e) {
      console.warn('[storage] create failed', (e as Error)?.message)
      toast.show(t('storageCreateFailed'))
    } finally {
      await loadAll() // refresh on success and failure; kept in finally so the guard is held until the refresh completes
      creating.value = false
    }
    return ok
  }

  async function formatVolume(payload: { path: string; volume: string; password: string }): Promise<boolean> {
    if (formatting.value) return false
    formatting.value = true
    const toast = useToast()
    try {
      // Contract: PUT /v1/storage {path: partition path, volume: mount point, password} (same as Vue2 StorageItem formatStorage)
      await service.storage.format(payload)
      toast.show(t('storageFormatSuccess'))
      await loadAll() // Vue2 semantics: format refreshes only on success
      return true
    } catch (e) {
      // Log only the message: the request body contains the plaintext password
      console.warn('[storage] format failed', (e as Error)?.message)
      toast.show(t('storageFormatFailed'))
      return false
    } finally {
      formatting.value = false
    }
  }

  async function loadRaid() {
    if (raidLoading.value) return // in-flight guard: prevents overlapping fetches from polling/hotplug
    raidLoading.value = true
    try {
      const listRes = await service.raid.list()
      const arrays = (Array.isArray(listRes) ? listRes : []).map(asRaidArray)
      raidArrays.value = arrays
      // Fetch status per array concurrently; a single failure does not sink the whole table (allSettled)
      const results = await Promise.allSettled(arrays.map((a) => service.raid.getStatus(a.id)))
      const map: Record<string, RaidStatus> = {}
      results.forEach((r, i) => { if (r.status === 'fulfilled') map[String(arrays[i].id)] = r.value })
      raidStatusMap.value = map
      syncReplaceTask()
      syncReclaimTask()
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

  // clearRaidDetail —— clear the previous snapshot before entering the detail page.
  // The detail page renders this store state, and entering the page runs two serial requests
  // (loadRaid → loadRaidDetail) before it updates; without clearing, the page renders **last time's**
  // data verbatim in that window —— after replacing a disk, clicking into the detail page would show
  // the pre-replacement frame (empty slot + faulty disk, 4 member rows), as if the replacement did nothing
  // (found in on-device acceptance 2026-07-28).
  function clearRaidDetail() { raidDetail.value = null }

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

  function startCreateTask(task: RaidTask) { clearTimeout(clearTimer); creatingTask.value = task } // used by the P4 wizard
  function dismissCreateTask() { clearTimeout(clearTimer); creatingTask.value = null }

  // Create: no list refresh here on success (the array enters the "creating" task flow,
  // taken over by startCreateTask + polling); the task is taken from the response for the wizard to call startCreateTask.
  async function createRaid(body: {
    name: string; level: number; disk_paths: string[]
    chunk_kb: 512; filesystem: 'btrfs' | 'ext4'; enable_snapshots: boolean
    // 所选盘带外来阵列残留超块(role:"residue")时必须 true(用户已在向导确认页看到
    // "将清除哪些盘的残留"清单),否则后端 500 拒绝。
    wipe_raid_residue: boolean
  }): Promise<RaidTask | null> {
    if (raidCreating.value) return null
    raidCreating.value = true
    const toast = useToast()
    try {
      // The backend (NimoOS-LocalStorage route/v2/raid.go:187-190) returns bare {task_id,status},
      // no .data envelope; the shared package NimoOS-Service src/raid.ts create() was changed in step to skip unwrap()
      // and pass the bare body through (should the backend add the standard envelope later, res?.data?.task_id is still read as a fallback).
      // Previously reading one extra .data layer yielded undefined, taskId became an empty string, and the progress modal/polling stalled on an empty id.
      const res = (await service.raid.create(body)) as { task_id?: string; data?: { task_id?: string } } | undefined
      const taskId = res?.task_id ?? res?.data?.task_id
      // Assemble creatingTask from the request info + task_id (step unknown, seeded with initial values; polling fills them in)
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

  function dismissReplaceTask() { replaceTask.value = null }

  // syncReplaceTask —— reconcile the disk-replacement dashboard task after every array-status refresh.
  // Dismiss the dashboard when done or when the array disappears; on completion also show a toast once
  // (the kernel rebuild finishing has no callback whatsoever, it can only be discovered by polling ——
  // this is also the fix for the "no completion notice after replacing" defect).
  //
  // There are two toast messages, not one: the new disk being active sync only means **this replacement**
  // finished; the array may still be unhealthy because another disk is also bad. Reporting
  // "array restored to healthy" in that case would be lying.
  function syncReplaceTask() {
    const task = replaceTask.value
    if (!task) return
    const arrayExists = raidArrays.value.some((a) => String(a.id) === task.arrayId)
    const status = raidStatusMap.value[task.arrayId]
    const outcome = replaceOutcome(task, status, arrayExists)
    if (outcome === 'gone') { replaceTask.value = null; return }
    if (outcome !== 'done') return
    replaceTask.value = null
    const array = raidArrays.value.find((a) => String(a.id) === task.arrayId)
    const healthy = array ? raidSeverity(resolveRaidState(array, status)) === 'ok' : false
    useToast().show(healthy ? t('raidReplaceDoneHealthy') : t('raidReplaceDoneStillDegraded'))
  }

  function dismissReclaimTask() { reclaimTask.value = null }

  // syncReclaimTask —— 每次刷新阵列状态后核对收回看板任务(结构同 syncReplaceTask)。
  // 完成 toast 同样分两种:收回的盘全部 active sync 只说明**这一次收回**完成了,
  // 阵列可能因为别的盘也坏而仍未恢复健康。
  function syncReclaimTask() {
    const task = reclaimTask.value
    if (!task) return
    const arrayExists = raidArrays.value.some((a) => String(a.id) === task.arrayId)
    const status = raidStatusMap.value[task.arrayId]
    const outcome = reclaimOutcome(task, status, arrayExists)
    if (outcome === 'gone') { reclaimTask.value = null; return }
    if (outcome !== 'done') return
    reclaimTask.value = null
    const array = raidArrays.value.find((a) => String(a.id) === task.arrayId)
    const healthy = array ? raidSeverity(resolveRaidState(array, status)) === 'ok' : false
    useToast().show(healthy ? t('raidReclaimDoneHealthy') : t('raidReclaimDoneStillDegraded'))
  }

  // recover 的 Data 2026-08-12 起是 {state, readded}(NimoOS-LocalStorage PR #22);
  // 老后端把 state 埋在 data.data.state。这里统一收窄成 {state, readded}。
  function parseRecoverResult(res: unknown): { state: string; readded: string[] } {
    const r = res as { state?: unknown; readded?: unknown; data?: { data?: { state?: unknown } } } | null | undefined
    const legacy = r?.data?.data?.state
    const state = (typeof r?.state === 'string' && r.state)
      || (typeof legacy === 'string' && legacy)
      || 'retrying'
    const readded = Array.isArray(r?.readded)
      ? (r.readded as unknown[]).filter((p): p is string => typeof p === 'string')
      : []
    return { state, readded }
  }

  // 收回的盘 readded 非空时建立看板任务(须在 loadRaid() **之前**:loadRaid 结束会调
  // syncReclaimTask,假盘上增量同步可能那一拍就已完成,那一拍必须已经看得见任务)。
  function startReclaimTask(id: number | string, readded: string[]) {
    if (!readded.length) return
    reclaimTask.value = {
      arrayId: String(id),
      arrayName: raidArrays.value.find((a) => String(a.id) === String(id))?.name || '',
      paths: readded,
    }
  }

  // body 形状见 service 包 RaidReplaceDiskBody:拔掉的盘 old_disk_path 传 ''、靠
  // old_disk_serial 识别;新盘带 RAID 残留时 wipe_raid_residue 须为 true(弹窗已二次确认)。
  async function replaceRaidDisk(id: number | string, body: RaidReplaceDiskBody): Promise<boolean> {
    if (raidReplacing.value) return false
    raidReplacing.value = true
    const toast = useToast()
    let ok = false
    try {
      await service.raid.replaceDisk(id, body)
      toast.show(t('raidReplaceSuccess'))
      // The dashboard task must be created **before** loadRaid(): loadRaid calls syncReplaceTask when it
      // finishes, and on a 512MB fake disk the rebuild may already be done by that tick —— the task must be visible by then.
      replaceTask.value = {
        arrayId: String(id),
        arrayName: raidArrays.value.find((a) => String(a.id) === String(id))?.name || '',
        // 拔掉的盘没有可信路径(old_disk_path=''),看板卡展示退回 serial
        oldPath: body.old_disk_path || body.old_disk_serial,
        newPath: body.new_disk_path,
      }
      ok = true
    } catch (e) {
      console.warn('[storage] raid replace failed', (e as Error)?.message)
      toast.show(t('raidReplaceFailed'))
    } finally {
      await loadRaid()
      // The detail page renders raidDetail, and only loadRaidDetail updates it —— previously only the
      // list data was refreshed here, so the detail page's member list stayed frozen on the pre-replacement
      // frame (still showing the empty slot + faulty disk), and the "auto-refresh every 5s while rebuilding"
      // switch was computed from that stale data, so polling never started and completion was never
      // observed (found in on-device acceptance 2026-07-28).
      if (raidDetail.value && String(raidDetail.value.array.id) === String(id)) {
        await loadRaidDetail(id)
      }
      raidReplacing.value = false
    }
    return ok
  }

  async function recoverRaid(id: number | string): Promise<{ state: string; readded: string[] } | null> {
    if (raidRecovering.value) return null
    raidRecovering.value = true
    const toast = useToast()
    try {
      const { state, readded } = parseRecoverResult(await service.raid.recover(id))
      if (state === 'active' || state === 'degraded' || state === 'rebuilding') toast.show(t('raidRecoverSuccess'))
      else toast.show(t('raidRecoverFailed'))
      // 重新识别也可能顺手收回了成员盘 —— 同样要顶住 spare→recovering 过渡窗口的轮询
      startReclaimTask(id, readded)
      return { state, readded }
    } catch (e) {
      console.warn('[storage] raid recover failed', (e as Error)?.message)
      toast.show(t('raidRecoverFailed'))
      return null
    } finally {
      await loadRaid()
      raidRecovering.value = false
    }
  }

  // 收回成员盘(状态接口报 reattachable_members 时的一键补救):走同一个 recover 端点,
  // 但文案按"收回"语义给用户交代结果 —— 与阵列失联时的「重新识别」按钮(recoverRaid)
  // 是两个入口,共用 raidRecovering 单飞守卫,不会同时双发。
  async function reclaimRaidMembers(id: number | string): Promise<boolean> {
    if (raidRecovering.value) return false
    raidRecovering.value = true
    const toast = useToast()
    let ok = false
    try {
      const { readded } = parseRecoverResult(await service.raid.recover(id))
      if (readded.length) {
        toast.show(t('raidReclaimStarted', { paths: readded.join(', ') }))
        startReclaimTask(id, readded)
      } else {
        // 后端没找到能收回的盘(比如状态刷新前盘又被拔了)。不算错误,但要告诉用户。
        toast.show(t('raidReclaimNothing'))
      }
      ok = true
    } catch (e) {
      console.warn('[storage] raid reclaim failed', (e as Error)?.message)
      toast.show(t('raidReclaimFailed'))
    } finally {
      await loadRaid()
      // 详情页渲染的是 raidDetail,只有 loadRaidDetail 会更新它(同 replaceRaidDisk
      // 的教训):不刷,成员列表停在收回前那一帧,轮询开关也从过期数据算。
      if (raidDetail.value && String(raidDetail.value.array.id) === String(id)) {
        await loadRaidDetail(id)
      }
      raidRecovering.value = false
    }
    return ok
  }

  async function pollCreateTaskOnce() {
    const cur = creatingTask.value
    if (!cur) return
    try {
      const raw = (await service.raid.getTask(cur.taskId)) as Record<string, unknown>
      // Preserve identity fields (name/level/filesystem/diskCount); step/progress/error/elapsed follow the latest backend values each tick (always returned)
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
      // failed: card is kept (not cleared), left to the user to dismiss
    } catch (e) {
      // 404 means the task is gone: clear the card + refresh. Both shapes must be caught ——
      // a real axios 404 has a string .code ('ERR_BAD_REQUEST') with the numeric status at .response.status;
      // the Error thrown by service unwrap() stuffs the backend success number into .code. Needs a real OR, not ??.
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
    clearRaidDetail,
    detectCreatingTask,
    pollCreateTaskOnce,
    startCreateTask,
    dismissCreateTask,
    createRaid,
    removeRaid,
    replaceRaidDisk,
    replaceTask,
    dismissReplaceTask,
    reclaimTask,
    dismissReclaimTask,
    recoverRaid,
    reclaimRaidMembers,
  }
})
