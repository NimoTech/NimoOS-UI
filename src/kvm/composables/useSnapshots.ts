import { ref } from 'vue'
import type { Ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import type { KvmSnapshot } from '@nimotech/nimoos-service'

// Snapshot data layer. Visuals/interactions omitted; pure state + data fetching. Mirrors
// the Vue 2 panel's src/components/KVM/KVMFullPage.vue Snapshot Methods section (:1223-1320):
// fetchSnapshots/createSnapshot/restoreSnapshot/deleteSnapshot/formatDate word-for-word.
// Confirmation UI (pendingConfirmAction/Id) and progress overlay bridging belongs to the
// view layer (SnapshotsTab.vue / KvmPage.vue); this composable handles only "send request
// → result".
//
// Live fixture (2026-08-03 curl `GET /v1/kvm/vms/<id>/snapshots`) →
// `{"success":true,"data":{"data":[]}}` — two-layer envelope already unwrapped by the
// shared package getSnapshots; we receive KvmSnapshot[] directly.

/** Mirrors Vue2 getErrMsg (KVMFullPage.vue:841-844) stripping the leading `[xxx] ` prefix.
 * Implemented identically to useVmList.ts errText — both written in-place, not extracted
 * to a shared util (project convention: useKvmHostInfo.save() also implements its own
 * error extraction logic in-place). */
function errText(e: unknown, fallback: string): string {
  const raw = (e instanceof Error && e.message) || fallback
  return raw.replace(/^\[.*?\]\s*/, '')
}

export function useSnapshots() {
  const snapshots: Ref<KvmSnapshot[]> = ref([])

  // Local expiry guard (hard constraint 8, same pattern as useVmList/useKvmHostInfo,
  // not extracted to a shared guard).
  let alive = true

  async function fetch(vmId: string): Promise<void> {
    try {
      const res = await service.kvm.getSnapshots(vmId)
      if (!alive) return // Expiry guard: component unmounted; discard this late response
      snapshots.value = res
    } catch (e) {
      // Deliberately mirrors Vue2 (:1232-1234): on failure, only console.warn without
      // clearing the list or writing error state — staying in place on fetch failure is
      // safer than clearing (user can still see the last successful snapshot list). This
      // is not error suppression; it is explicit preservation of existing behavior.
      console.warn('[KVM] Failed to fetch snapshots:', e)
    }
  }

  // Return value ('' = success, non-empty = error message): contract mirrors useVmList.create/update.
  // After success, fetch again per Vue2 createSnapshot (:1251) to get the latest list
  // (not locally appending one, since backend may populate state and other fields).
  async function create(vmId: string, name: string, description: string): Promise<string> {
    try {
      await service.kvm.createSnapshot(vmId, { name, description })
      if (!alive) return '' // Result arriving after dispose; skip the extra fetch (review convention)
      await fetch(vmId)
      return ''
    } catch (e) {
      return errText(e, 'kvmFailedToCreateSnapshot')
    }
  }

  // Return value same as above. After success, locally filter out that entry per Vue2
  // deleteSnapshot (:1307); do not re-fetch.
  async function remove(vmId: string, snapshotId: string): Promise<string> {
    try {
      await service.kvm.deleteSnapshot(vmId, snapshotId)
      if (!alive) return '' // Result arriving after dispose; do not write state (review convention)
      snapshots.value = snapshots.value.filter((s) => s.id !== snapshotId)
      return ''
    } catch (e) {
      return errText(e, 'kvmFailedToDeleteSnapshot')
    }
  }

  // Return value same as above. On restore success, do not write any state in this
  // composable (Vue2 restoreSnapshot :1278-1288 does not modify this.snapshots either —
  // it only handles the dialog UI, which belongs to the view layer in SnapshotsTab.vue /
  // KvmPage.vue). Therefore **no alive guard needed here**: there is no state to protect.
  // Adding `if (!alive) return ''` would lie about a real request failure that merely
  // happens to arrive after dispose (same lesson as useKvmHostInfo.save() top comment;
  // see review Important #3).
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
