import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { useFilesStore } from './files'
import {
  parseSnapshotBrowsePath, shouldGuardSnapshotView, findVolumeForPath, parseSnapshotsContainerPath,
  type SnapshotVolumeLike, type VolumesState,
} from '../util/snapshotPath'
import { performSnapshotRestore } from '../util/snapshotRestore'
import { useToast } from '../../stores/toast'
import { i18n } from '../../i18n'

// 文件区快照浏览的共享态:卷列表缓存 + 由 currentPath 派生的只读锁 + 时间机器开关。
// 对应 Vue2 FilePanel.vue 的 snapshotVolumesState / isSnapshotView / currentSnapshotVolume /
// canShowSnapshotEntry / isSnapshotWheelOpen 那一组 data + computed —— Vue2 里它们散在一个
// 3000 行组件里,这里收成一个 store,好处是禁写 guard(useFileOps)与右键菜单也能直接读到
// 同一份判定,不必层层传 prop。
export const useSnapshotBrowseStore = defineStore('snapshotBrowse', () => {
  const status = ref<VolumesState['status']>('idle')
  const volumes = ref<SnapshotVolumeLike[]>([])
  const wheelOpen = ref(false)
  const restoring = ref(false)
  // The backend takes one path per call, so the loop below stays serial. What
  // it cannot stay is silent: picking forty files meant a disabled button and
  // no sign of life until every one of them had come back.
  const restoreProgress = ref<{ done: number; total: number } | null>(null)
  const files = useFilesStore()

  // 同一次会话里并发调用共用这一个在途 Promise,避免文件区挂载与深链解析各发一次请求
  let inflight: Promise<void> | null = null

  // 过期响应守卫(同 src/storage/stores/snapshot.ts 的 volumeRequestUuid/snapshotsRequestUuid
  // 先例,风格与命名照抄;那里按 uuid 判过期,这里 ensureVolumes 没有天然的调用参数可以当
  // 身份,改用自增代次):reset() 会把它顶掉一级。若 reset() 之后又发起了新的 ensureVolumes()
  // 调用,旧调用只要落地(无论成功还是失败)就会拿着陈旧数据/陈旧 error 静默覆盖新调用已经
  // 写好的 state —— 必须在写 state 前确认自己这一代还没被顶掉,顶掉了就整段丢弃,不写
  // state、不动 inflight。
  let epoch = 0

  // 每会话拉一次(Vue2 ensureSnapshotVolumesLoaded 同款语义)。error 是本会话的终态:
  // 快照是可选功能(老后端 /v2/snapshot/* 全 404),失败后一直重试只会每次导航都白打一次
  // 请求;而 error 态在 shouldGuardSnapshotView 里本就保持只读锁定,是安全的一侧。
  async function ensureVolumes(): Promise<void> {
    if (status.value === 'ready' || status.value === 'error') return
    if (inflight) return inflight
    status.value = 'loading'
    const myEpoch = (epoch += 1)
    inflight = (async () => {
      try {
        const list = await service.snapshot.listVolumes()
        if (myEpoch !== epoch) return // 过期响应:期间被 reset() 顶掉,整段丢弃
        volumes.value = Array.isArray(list) ? (list as SnapshotVolumeLike[]) : []
        status.value = 'ready'
      } catch (e) {
        if (myEpoch !== epoch) return
        console.warn('[snapshot-browse] load volumes failed', (e as Error)?.message)
        volumes.value = []
        status.value = 'error'
      } finally {
        if (myEpoch === epoch) inflight = null
      }
    })()
    return inflight
  }

  const parsed = computed(() => parseSnapshotBrowsePath(files.currentPath))
  const volumesState = computed<VolumesState>(() => ({ status: status.value, volumes: volumes.value }))

  // 评审修复(Critical 1,第二轮):`<挂载点>/.snapshots` 容器目录本身——parseSnapshotBrowsePath
  // 对它返回 null(语义不变,恢复编排等处仍依赖这个 null),所以光靠 shouldGuardSnapshotView(parsed)
  // 判不出这里也该锁。第一轮的 isSnapshotsContainerPath 自己攒了一套 `volumes.some(...)` 判定,
  // volumes 为空(idle/loading/error)时恒为 false——三态全部漏锁,而 error 是 ensureVolumes() 的
  // 本会话终态,漏锁会持续整个会话(复核用真实探针实测坐实)。这里不再写第二套三态判断:把容器
  // 路径合成一个 snapshotName:'' 的 parsed 对象,直接喂给同一个 shouldGuardSnapshotView——
  // idle/loading/error 自动保持锁定,supported:false 的确证豁免也自动继承,与"选中了具体快照"
  // 那条路径的 fail-safe 方向不会再出现不一致。
  const containerParsed = computed(() => parseSnapshotsContainerPath(files.currentPath))
  const isSnapshotsContainer = computed(() => shouldGuardSnapshotView(containerParsed.value, volumesState.value))
  /** 只读锁是否生效 —— 路径形状 + 卷确证的双重判定,fail-safe 方向见 snapshotPath.ts 注释 */
  const isSnapshotView = computed(() => shouldGuardSnapshotView(parsed.value, volumesState.value) || isSnapshotsContainer.value)
  /** 锁确实生效时才把解析结果交给横幅/退出/恢复消费 */
  const browseInfo = computed(() => (isSnapshotView.value ? parsed.value : null))
  /** 当前路径落在哪个快照卷下(最长挂载前缀)—— 入口按钮与时间机器都要它的 uuid/mount */
  const currentVolume = computed(() => findVolumeForPath(volumes.value, files.currentPath))

  const canShowEntry = computed(
    () => status.value === 'ready'
      && !!currentVolume.value
      && currentVolume.value.supported === true
      && !isSnapshotView.value,
  )

  function openWheel() { wheelOpen.value = true }
  function closeWheel() { wheelOpen.value = false }

  // 恢复选中项。多条时逐条提交(后端一次只收一个 path),期间 restoring 为真,
  // 三个入口(横幅 / 选中工具条 / 右键菜单)共用这一个开关,任何一处在途都禁用其余两处。
  async function restore(entries: { path: string }[]): Promise<void> {
    if (restoring.value) return
    const list = entries || []
    if (!list.length) return
    const toast = useToast()
    const t = i18n.global.t
    restoring.value = true
    try {
      // 评审修复(Important):volumes.value 就是同一份 ready 数据(能走到这里必然已经在
      // 快照视图里——shouldGuardSnapshotView 要求 status==='ready' 才会判定出真快照,
      // 三个恢复入口都只在该状态下才渲染),没必要为选中的每一项都重新打一次
      // GET /v2/snapshot/volumes。改成注入同步读 volumes.value 的函数;万一(理论上不该
      // 发生,防御性兜底)真的还没加载,先拉一次,避免把"还没数据"误判成每一条都恢复失败。
      if (!volumes.value.length) await ensureVolumes()
      const results = []
      restoreProgress.value = { done: 0, total: list.length }
      for (const item of list) {
        results.push(await performSnapshotRestore({
          item,
          info: browseInfo.value,
          listVolumes: async () => volumes.value,
          restore: (body) => service.snapshot.restore(body),
        }))
        restoreProgress.value = { done: results.length, total: list.length }
      }
      const ok = results.filter((r) => r.ok) as { ok: true; restoredPath: string }[]
      const failed = results.filter((r) => !r.ok) as { ok: false; reason: string }[]
      // 评审修复:混合结果(部分成功部分失败)不能只报失败——成功落盘的那几条会被静默吞掉。
      // 三种结果分三条路径:全成功用原文案;全失败用具体原因文案;混合结果合成一条新文案,
      // 人类拍板舍弃具体失败原因(不再叠加 404/400/其它文案),只报成功/失败各几条。
      if (failed.length === 0) {
        if (ok.length === 1) toast.show(t('snapBrowseRestored', { path: ok[0].restoredPath }))
        else if (ok.length > 1) toast.show(t('snapBrowseRestoredN', { n: ok.length }))
      } else if (ok.length > 0) {
        toast.show(t('snapBrowseRestoredPartial', { ok: ok.length, fail: failed.length }))
      } else {
        const reason = failed[0].reason
        toast.show(
          reason === 'not-found' ? t('snapBrowseRestoreNotFound')
            : reason === 'invalid' ? t('snapBrowseRestoreInvalid')
              : t('snapBrowseRestoreFailed'),
        )
      }
    } finally {
      restoring.value = false
      restoreProgress.value = null
    }
  }

  function reset() {
    status.value = 'idle'
    volumes.value = []
    wheelOpen.value = false
    inflight = null
    epoch += 1 // 顶掉任何还在途的旧请求,防止它落地后用陈旧数据/陈旧 error 盖掉之后的新结果
  }

  return {
    status, volumes, wheelOpen, restoring, restoreProgress,
    parsed, isSnapshotView, browseInfo, currentVolume, canShowEntry,
    ensureVolumes, openWheel, closeWheel, reset, restore,
  }
})
