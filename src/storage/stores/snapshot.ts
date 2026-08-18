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
  // Vue2 SnapshotPanel/SnapshotTimeline both initialize loading to true (panel uses v-if="!loading"),
  // so the first frame never flashes an empty state — carried over byte-for-byte.
  const volumeLoading = ref(true)
  const listLoading = ref(true)
  const toggling = ref(false)
  const policySaving = ref(false)
  const creatingSnapshot = ref(false)
  const deletingName = ref<string | null>(null)
  const t = i18n.global.t

  // Stale-response guard (must-fix 2): when loadVolume/loadSnapshots switch volumes, record the
  // uuid that "currently owns this call"; if the guard already points at a different uuid by the
  // time the response comes back (meaning a newer call was made in the meantime), discard the
  // whole response — don't write state, don't touch loading — so an old volume's slow response
  // can't clobber a new volume's already-landed fast response.
  let volumeRequestUuid: string | null = null
  let snapshotsRequestUuid: string | null = null

  // Must-fix 1 (Critical): a singleton store naturally survives across route changes; in Vue2
  // volume/policy/loading were component data(), auto-reset on every mount. Here we need an
  // explicit reset paired with SnapshotPanel's onMounted/watch calls, otherwise switching arrays
  // (the same routed component instance gets reused by vue-router) would render the first frame
  // with the old volume's data. volumeLoading/listLoading are forced back to true so the panel
  // collapses (a 1:1 reproduction of Vue2's loading:true initial value), staying collapsed until
  // the new volume's data lands, so it never flashes the old volume's toggle/summary for a
  // frame; both request guards are cleared at the same time, so any request still in flight is
  // guaranteed to be judged stale.
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
    // Ledger 7: don't send a request for an empty uuid — the list may contain another volume
    // that also lacks a uuid, and find() would match it by mistake.
    if (!uuid) {
      volume.value = null
      volumeLoading.value = false
      return
    }
    volumeRequestUuid = uuid
    try {
      const list = await service.snapshot.listVolumes()
      if (volumeRequestUuid !== uuid) return // stale response: a newer call is already in flight/landed
      const hit = (Array.isArray(list) ? list : []).find(
        (v) => (v as { volume_uuid?: string })?.volume_uuid === uuid,
      )
      volume.value = hit ? asSnapshotVolume(hit) : null
    } catch (e) {
      if (volumeRequestUuid !== uuid) return
      // Snapshots are an optional feature (an older backend returns 404 for all /v2/snapshot/*):
      // swallow the error and fall into the unsupported state — must never bring down the RAID
      // detail page — same semantics as Vue2's SnapshotPanel.fetchVolume.
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
      if (snapshotsRequestUuid !== uuid) return // stale response, same guard semantics as loadVolume
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
      // Vue2's failure branch does volume.enabled = !val, i.e. revert to the pre-toggle value — carried over byte-for-byte
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
      // Policy writes always go through patchPolicy (read-modify-write); PUT is a full replace, and a missing field would zero out its retention count
      await service.snapshot.patchPolicy(uuid, { ...form })
      // ⚠️ Not replicating a Vue2 bug: the backend's PUT /v2/snapshot/policy returns data:null
      // (NimoOS-LocalStorage route/snapshot.go putSnapshotPolicy), yet Vue2 assigns the whole
      // response envelope to policy, which makes the summary line show "retain undefined" after
      // saving. Here we instead merge the form values we just wrote into the local policy — PUT
      // is a full replace, so we know exactly what was persisted.
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
      // Contract: POST /v2/snapshot {volume_uuid} + include label only when the note isn't empty (matches Vue2 byte-for-byte)
      await service.snapshot.create({ volume_uuid: uuid, ...(trimmed ? { label: trimmed } : {}) })
      toast.show(t('snapCreated'))
      // Vue2 triggers the timeline refresh indirectly via refreshSignal (count|last_at); here the
      // store connects directly, refreshing the volume summary + list right after creation
      // (equivalent behavior, one fewer layer of string signaling)
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
      // Argument order is (name, volumeUuid); the shared package encodeURIComponent's name internally (names often contain Chinese)
      await service.snapshot.remove(name, uuid)
      snapshots.value = snapshots.value.filter((s) => s.name !== name)
      toast.show(t('snapDeleted'))
      // Deleting changes the volume's count/last_at: refresh the summary (Vue2 does the same thing via @deleted bubbling up to the parent component)
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
