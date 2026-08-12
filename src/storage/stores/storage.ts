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
  // 换盘进行中的看板任务。后端 PUT /v2/raid/:id/replace-disk 是**同步**的
  // (route/v2/raid.go:266 ReplaceDisk,mdadm --fail/--remove/--add 完成即返回),
  // 没有创建流程那样的 task_id / 6 步进度 —— 真正的重建在内核里跑,进度只能从
  // status 接口的 rebuild_pct 读。所以这份任务态由前端自己维护:提交成功时建立,
  // 每次刷新阵列状态时核对"新盘是否已 active sync",是则算完成。
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
      // 传 res.disks 进去补 health:avail 里的 health 恒为空串(后端赋值顺序缺陷),
      // 同一块盘在 disks 列表里才有真实的 "true"/"false"。详见 mapAvailDisks 注释。
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

  // clearRaidDetail —— 进详情页前先把上一次的快照清掉。
  // 详情页渲染的是这份 store 状态,而进页面要跑两次串行请求(loadRaid → loadRaidDetail)
  // 才会更新它;不清空的话这段窗口里页面会原样渲染**上一次**的数据 —— 换完盘再点进
  // 详情页会看到换盘前那一帧(空槽位 + 故障盘,4 行成员),看起来像替换没生效
  // (2026-07-28 实盘验收发现)。
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

  function startCreateTask(task: RaidTask) { clearTimeout(clearTimer); creatingTask.value = task } // P4 向导用
  function dismissCreateTask() { clearTimeout(clearTimer); creatingTask.value = null }

  // 创建:成功后不在此刷新列表(阵列进"创建中"任务流,由 startCreateTask + 轮询接管),
  // 从响应取 task 供向导调 startCreateTask。
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
      // 后端(NimoOS-LocalStorage route/v2/raid.go:187-190)返回裸 {task_id,status},
      // 无 .data 信封;共享包 NimoOS-Service src/raid.ts create() 已同步改成不 unwrap()、
      // 直接透传该裸体(万一后端将来补上标准信封,也兼容读 res?.data?.task_id)。
      // 此前多读一层 .data 拿到的是 undefined,taskId 落空串,进度弹窗/轮询盯着空 id 卡死。
      const res = (await service.raid.create(body)) as { task_id?: string; data?: { task_id?: string } } | undefined
      const taskId = res?.task_id ?? res?.data?.task_id
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

  function dismissReplaceTask() { replaceTask.value = null }

  // syncReplaceTask —— 每次刷新阵列状态后核对换盘看板任务。
  // 完成/阵列消失时撤掉看板;完成额外弹一次 toast(内核重建结束没有任何回调,
  // 只能靠轮询发现 —— 这也是「换完没有完成提示」那条缺陷的修法)。
  //
  // toast 文案分两种,不是同一句:新盘 active sync 只说明**这一次替换**完成了,
  // 阵列可能因为另一块盘也坏而仍未恢复健康。那种情况下报"阵列已恢复健康"是撒谎。
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
      // 看板任务须在 loadRaid() **之前**建立:loadRaid 结束时会调 syncReplaceTask,
      // 512MB 假盘上重建可能在这一拍就已完成,那一拍必须已经看得见任务。
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
      // 详情页渲染的是 raidDetail,只有 loadRaidDetail 会更新它 —— 此前这里只刷了
      // 列表数据,详情页的成员列表会一直停在替换前那一帧(还显示空槽位 + 故障盘),
      // 而"重建中每 5 秒自动刷新"的开关又是从这份过期数据算的,于是轮询永不启动、
      // 完成也永远观察不到(2026-07-28 实盘验收发现)。
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
