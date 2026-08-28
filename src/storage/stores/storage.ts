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
  // Task in progress for reclaiming a member disk (reattachable_members one-click reclaim). Same
  // mechanism as replaceTask: the recover endpoint returns readded synchronously, the incremental
  // sync runs in the kernel, and completion is judged by checking status.members (raidView.ts
  // reclaimOutcome). It's also the switch that forces list/detail page polling — for the first
  // few seconds after --re-add the disk is still spare and doesn't count as rebuilding, so relying
  // only on isRebuilding would send zero requests during that window.
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
    // Must be true when a selected disk carries a foreign array's leftover superblock
    // (role:"residue") — the user has already seen the "which disks' residue will be wiped"
    // list on the wizard's confirmation page — otherwise the backend rejects with 500.
    wipe_raid_residue: boolean
  }): Promise<RaidTask | null> {
    if (raidCreating.value) return null
    raidCreating.value = true
    const toast = useToast()
    try {
      // The backend (NimoOS-LocalStorage route/v2/raid.go:187-190) returns bare {task_id,status},
      // no .data envelope; the shared service package's src/raid.ts create() was changed in step to skip unwrap()
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

  // syncReclaimTask — reconcile the reclaim dashboard task after every array-status refresh
  // (same structure as syncReplaceTask). Completion toast likewise splits into two cases: the
  // reclaimed disks all being active sync only means **this reclaim** finished, the array may
  // still be unhealthy because another disk is also bad.
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

  // recover's Data has been {state, readded} since 2026-08-12 (NimoOS-LocalStorage PR #22);
  // an older backend buries state in data.data.state. Here it's uniformly narrowed to {state, readded}.
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

  // Create the dashboard task when reclaimed disks' readded is non-empty (must happen **before**
  // loadRaid(): loadRaid calls syncReclaimTask when it finishes, and on a fake disk the incremental
  // sync may already be done by that tick — the task must already be visible by then).
  function startReclaimTask(id: number | string, readded: string[]) {
    if (!readded.length) return
    reclaimTask.value = {
      arrayId: String(id),
      arrayName: raidArrays.value.find((a) => String(a.id) === String(id))?.name || '',
      paths: readded,
    }
  }

  // See the service package's RaidReplaceDiskBody for the body shape: a pulled disk sends
  // old_disk_path as '' and is identified via old_disk_serial; when the new disk carries RAID
  // residue, wipe_raid_residue must be true (the dialog has already double-confirmed this).
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
        // A pulled disk has no trustworthy path (old_disk_path=''), the dashboard card falls back to showing the serial
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
      // Re-detection may also incidentally reclaim member disks — this also needs to sustain polling through the spare→recovering transition window
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

  // Reclaim a member disk (the one-click fix when the status endpoint reports
  // reattachable_members): goes through the same recover endpoint, but the copy tells the user
  // the outcome using "reclaim" semantics — a separate entry point from the "re-detect" button
  // (recoverRaid) shown when the array is unreachable; they share the raidRecovering
  // single-flight guard, so both can never fire at once.
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
        // Backend found no disk to reclaim (e.g. the disk was pulled again before the status refreshed). Not an error, but the user must be told.
        toast.show(t('raidReclaimNothing'))
      }
      ok = true
    } catch (e) {
      console.warn('[storage] raid reclaim failed', (e as Error)?.message)
      toast.show(t('raidReclaimFailed'))
    } finally {
      await loadRaid()
      // The detail page renders raidDetail, and only loadRaidDetail updates it (same lesson as
      // replaceRaidDisk): without a refresh, the member list stays frozen on the pre-reclaim frame, and the polling switch is computed from stale data too.
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
