import { ref } from 'vue'
import type { Ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import type { KvmSnapshot } from '@nimotech/nimoos-service'

// 快照数据层。视觉/交互无关,纯状态 + 数据获取。逐字对 NimoOS-UI/src/components/KVM/
// KVMFullPage.vue 的 Snapshot Methods 段落(:1223-1320):fetchSnapshots/createSnapshot/
// restoreSnapshot/deleteSnapshot/formatDate。二次确认(pendingConfirmAction/Id)与进度
// 遮罩的拼接留给视图层(SnapshotsTab.vue / KvmPage.vue),这里只管"发请求→结果"。
//
// 真机 fixture(2026-08-03 curl `GET /v1/kvm/vms/<id>/snapshots`)→
// `{"success":true,"data":{"data":[]}}`——两层信封,共享包 getSnapshots 已经剥好,
// 这里拿到的直接是 KvmSnapshot[]。

/** 照抄 Vue2 getErrMsg(KVMFullPage.vue:841-844)剥掉开头的 `[xxx] ` 前缀这一步,
 * 与 useVmList.ts 的 errText 逐字同一实现——两处各自就地写一份,不抽公共 util
 * (本项目既有惯例,useKvmHostInfo.save() 也是就地写自己的错误取值逻辑)。 */
function errText(e: unknown, fallback: string): string {
  const raw = (e instanceof Error && e.message) || fallback
  return raw.replace(/^\[.*?\]\s*/, '')
}

export function useSnapshots() {
  const snapshots: Ref<KvmSnapshot[]> = ref([])

  // 就地过期守卫(硬约束 8,同 useVmList/useKvmHostInfo 的既有写法,不抽公共 guard)。
  let alive = true

  async function fetch(vmId: string): Promise<void> {
    try {
      const res = await service.kvm.getSnapshots(vmId)
      if (!alive) return // 过期守卫:组件已卸载,这份迟到的响应不再写 state
      snapshots.value = res
    } catch (e) {
      // 有意照抄 Vue2(:1232-1234):失败只 console.warn,不清空列表、不写任何错误状态——
      // 拉取失败时停在原地比清空列表更安全(用户还能看到上一次成功拉到的快照)。这不是
      // 吞错遗漏,是显式保留的既有行为。
      console.warn('[KVM] Failed to fetch snapshots:', e)
    }
  }

  // 返回值(''=成功,非空=这次调用失败的文案):契约同 useVmList.create/update。
  // 成功后照 Vue2 createSnapshot(:1251)自己再 fetch 一遍拿最新列表(不是本地拼接一条,
  // 后端可能会补全 state 等字段)。
  async function create(vmId: string, name: string, description: string): Promise<string> {
    try {
      await service.kvm.createSnapshot(vmId, { name, description })
      if (!alive) return '' // dispose 之后到达的结果不再补一次 fetch(评审既有惯例)
      await fetch(vmId)
      return ''
    } catch (e) {
      return errText(e, 'kvmFailedToCreateSnapshot')
    }
  }

  // 返回值同上。成功后照 Vue2 deleteSnapshot(:1307)本地过滤掉那一条,不重新 fetch。
  async function remove(vmId: string, snapshotId: string): Promise<string> {
    try {
      await service.kvm.deleteSnapshot(vmId, snapshotId)
      if (!alive) return '' // dispose 之后到达的结果不再写 state(评审既有惯例)
      snapshots.value = snapshots.value.filter((s) => s.id !== snapshotId)
      return ''
    } catch (e) {
      return errText(e, 'kvmFailedToDeleteSnapshot')
    }
  }

  // 返回值同上。restore 成功不写本 composable 的任何 state(Vue2 restoreSnapshot
  // :1278-1288 同样不改 this.snapshots——它只关设置弹窗,那是视图层的事,见
  // SnapshotsTab.vue/KvmPage.vue)。因此**不需要** alive 守卫:这里没有状态可保护,
  // 硬加一层 `if (!alive) return ''` 会把"请求真的失败了、只是恰好在 dispose 之后
  // 落定"谎报成功(同 useKvmHostInfo.save() 顶部注释踩过的同一个教训,评审 Important #3)。
  async function restore(vmId: string, snapshotId: string): Promise<string> {
    try {
      await service.kvm.restoreSnapshot(vmId, snapshotId)
      return ''
    } catch (e) {
      return errText(e, 'kvmFailedToRestoreSnapshot')
    }
  }

  function dispose(): void {
    alive = false
  }

  return { snapshots, fetch, create, remove, restore, dispose }
}
