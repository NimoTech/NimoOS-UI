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

  // 过期响应守卫(必修 2):loadVolume/loadSnapshots 换卷时,记录"当前认领这次调用"的
  // uuid;响应回来时如果这个守卫已经指向别的 uuid(说明期间又发起了更新的一次调用),
  // 整段丢弃 —— 不写 state、不落 loading,避免旧卷的慢响应盖掉新卷已经落地的快响应。
  let volumeRequestUuid: string | null = null
  let snapshotsRequestUuid: string | null = null

  // 必修 1(Critical):单例 store 天然跨路由存活,Vue2 里 volume/policy/loading 是组件
  // data(),每次挂载自动复位;这里需要显式复位配合 SnapshotPanel 的 onMounted/watch 调用,
  // 否则换阵列时(同一路由组件实例被 vue-router 复用)首帧会用旧卷数据渲染。
  // volumeLoading/listLoading 打回 true 让面板收起(1:1 复刻 Vue2 loading:true 初值),
  // 直到新卷数据落地才重新展开,不会闪一帧旧卷的开关/摘要;两个 request 守卫一并清空,
  // 让任何仍在途的旧请求肯定被判定为过期。
  function reset() {
    volume.value = null
    policy.value = null
    snapshots.value = []
    volumeLoading.value = true
    listLoading.value = true
    volumeRequestUuid = null
    snapshotsRequestUuid = null
  }

  async function loadVolume(uuid: string) {
    // 台账 7:空 uuid 不发请求 —— 列表里可能有另一个同样无 uuid 的卷,find() 会误命中。
    if (!uuid) {
      volume.value = null
      volumeLoading.value = false
      return
    }
    volumeRequestUuid = uuid
    try {
      const list = await service.snapshot.listVolumes()
      if (volumeRequestUuid !== uuid) return // 过期响应:已有更新的一次调用在途/落地
      const hit = (Array.isArray(list) ? list : []).find(
        (v) => (v as { volume_uuid?: string })?.volume_uuid === uuid,
      )
      volume.value = hit ? asSnapshotVolume(hit) : null
    } catch (e) {
      if (volumeRequestUuid !== uuid) return
      // 快照是可选功能(老后端 /v2/snapshot/* 全 404):吞错落 unsupported 态,
      // 绝不能把 RAID 详情页拖垮 —— Vue2 SnapshotPanel.fetchVolume 同款语义。
      console.warn('[snapshot] load volume failed', (e as Error)?.message)
      volume.value = null
    } finally {
      if (volumeRequestUuid === uuid) volumeLoading.value = false
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
    snapshotsRequestUuid = uuid
    listLoading.value = true
    try {
      const res = await service.snapshot.list(uuid)
      if (snapshotsRequestUuid !== uuid) return // 过期响应,同 loadVolume 的守卫语义
      snapshots.value = Array.isArray(res) ? (res as SnapshotRaw[]) : []
    } catch (e) {
      if (snapshotsRequestUuid !== uuid) return
      console.warn('[snapshot] load list failed', (e as Error)?.message)
      snapshots.value = []
    } finally {
      if (snapshotsRequestUuid === uuid) listLoading.value = false
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
    reset, loadVolume, loadPolicy, loadSnapshots, toggle, savePolicy, createSnapshot, removeSnapshot,
  }
})
