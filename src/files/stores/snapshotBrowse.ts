import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { useFilesStore } from './files'
import {
  parseSnapshotBrowsePath, shouldGuardSnapshotView, findVolumeForPath,
  type SnapshotVolumeLike, type VolumesState,
} from '../util/snapshotPath'

// 文件区快照浏览的共享态:卷列表缓存 + 由 currentPath 派生的只读锁 + 时间机器开关。
// 对应 Vue2 FilePanel.vue 的 snapshotVolumesState / isSnapshotView / currentSnapshotVolume /
// canShowSnapshotEntry / isSnapshotWheelOpen 那一组 data + computed —— Vue2 里它们散在一个
// 3000 行组件里,这里收成一个 store,好处是禁写 guard(useFileOps)与右键菜单也能直接读到
// 同一份判定,不必层层传 prop。
export const useSnapshotBrowseStore = defineStore('snapshotBrowse', () => {
  const status = ref<VolumesState['status']>('idle')
  const volumes = ref<SnapshotVolumeLike[]>([])
  const wheelOpen = ref(false)
  const files = useFilesStore()

  // 同一次会话里并发调用共用这一个在途 Promise,避免文件区挂载与深链解析各发一次请求
  let inflight: Promise<void> | null = null

  // 每会话拉一次(Vue2 ensureSnapshotVolumesLoaded 同款语义)。error 是本会话的终态:
  // 快照是可选功能(老后端 /v2/snapshot/* 全 404),失败后一直重试只会每次导航都白打一次
  // 请求;而 error 态在 shouldGuardSnapshotView 里本就保持只读锁定,是安全的一侧。
  async function ensureVolumes(): Promise<void> {
    if (status.value === 'ready' || status.value === 'error') return
    if (inflight) return inflight
    status.value = 'loading'
    inflight = (async () => {
      try {
        const list = await service.snapshot.listVolumes()
        volumes.value = Array.isArray(list) ? (list as SnapshotVolumeLike[]) : []
        status.value = 'ready'
      } catch (e) {
        console.warn('[snapshot-browse] load volumes failed', (e as Error)?.message)
        volumes.value = []
        status.value = 'error'
      } finally {
        inflight = null
      }
    })()
    return inflight
  }

  const parsed = computed(() => parseSnapshotBrowsePath(files.currentPath))
  const volumesState = computed<VolumesState>(() => ({ status: status.value, volumes: volumes.value }))

  /** 只读锁是否生效 —— 路径形状 + 卷确证的双重判定,fail-safe 方向见 snapshotPath.ts 注释 */
  const isSnapshotView = computed(() => shouldGuardSnapshotView(parsed.value, volumesState.value))
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

  function reset() {
    status.value = 'idle'
    volumes.value = []
    wheelOpen.value = false
    inflight = null
  }

  return {
    status, volumes, wheelOpen,
    parsed, isSnapshotView, browseInfo, currentVolume, canShowEntry,
    ensureVolumes, openWheel, closeWheel, reset,
  }
})
