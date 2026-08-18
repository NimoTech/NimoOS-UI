<!-- src/files/drop/components/DropPage.vue -->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter, onBeforeRouteLeave } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AreaShell from '../../../components/shell/AreaShell.vue'
import FilesSidebar from '../../components/FilesSidebar.vue'
import DropItem from './DropItem.vue'
import DropCenter from './DropCenter.vue'
import DropAddButton from './DropAddButton.vue'
import ReceivePrompt from './ReceivePrompt.vue'
import AlertDialog from '../../../components/ui/AlertDialog.vue'
import { useDropStore } from '../stores/drop'
import { useFilesStore } from '../../stores/files'
import { contentsBox, positionFor, DISPLAY_ORDER } from '../dropLayout'
import { virtualPathToRouteParam } from '../../util/pathUtils'
import { installDropUnloadGuard } from '../leaveGuard'

const router = useRouter()
const { t } = useI18n()
const drop = useDropStore()
const files = useFilesStore()

const areaEl = ref<HTMLElement | null>(null)
const box = ref(contentsBox(1200, 700))
const isNarrow = ref(false)

function resize() {
  const el = areaEl.value
  if (!el) return
  isNarrow.value = el.clientWidth < 720 // narrow screen responsive (replaces vue-breakpoint-mixin)
  box.value = contentsBox(el.clientWidth, el.clientHeight)
}

function goVirtual(virtualPath: string) {
  router.push('/files/' + virtualPathToRouteParam(virtualPath))
}

// self is already placed at top of store (index 0); display order array determines ring position (Vue2 initIndexArray)
const placed = computed(() =>
  drop.peers.map((p, i) => ({
    peer: p,
    isSelf: p.id === drop.selfId,
    position: positionFor(DISPLAY_ORDER[i] ?? i, box.value.radius, box.value.center),
  })),
)

// Leave-page confirmation: transfers only exist while this page is mounted
// (onBeforeUnmount below tears the connections down), so both the route
// guard and the beforeunload guard live here rather than at App.vue -- see
// the doc comment in leaveGuard.ts for why that's the opposite of the
// upload queue's app-level guard.
const leaveOpen = ref(false)
let leaveResolver: ((ok: boolean) => void) | null = null

function settleLeave(ok: boolean) {
  const r = leaveResolver
  if (!r) return
  leaveResolver = null
  leaveOpen.value = false
  r(ok)
}

// reka-ui's AlertDialogAction fires update:open(false) on the SAME click that
// runs our @confirm, and the order between the two handlers is not
// guaranteed (see the note in UploadPanel.vue). Deferring the cancel answer
// by a tick lets a confirm that lands in the same task win first (settleLeave
// is idempotent once leaveResolver is cleared); a real cancel has no confirm
// behind it, so its deferred answer still runs.
function onLeaveOpenChange(v: boolean) {
  leaveOpen.value = v
  if (!v) setTimeout(() => settleLeave(false), 0)
}

function askLeave(): Promise<boolean> {
  return new Promise((resolve) => {
    leaveResolver = resolve
    leaveOpen.value = true
  })
}

onBeforeRouteLeave(async () => {
  if (!drop.hasActiveTransfers()) return true
  return await askLeave()
})

let offUnloadGuard: (() => void) | null = null

onMounted(() => {
  window.addEventListener('resize', resize)
  resize()
  drop.init()
  if (!files.disks.length) files.loadRoots() // sidebar disk list (align with SharesPage; if omitted DISKS area will remain empty)
  offUnloadGuard = installDropUnloadGuard(() => drop.hasActiveTransfers())
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  offUnloadGuard?.()
  offUnloadGuard = null
  drop.destroy()
})
</script>

<template>
  <AreaShell :title="t('filesTitle')">
    <div class="files-layout">
      <FilesSidebar @navigate="goVirtual" />
      <main ref="areaEl" class="drop-main" :class="{ narrow: isNarrow }">
        <h2 class="drop-title">{{ t('filesDropTitle') }}</h2>
        <div class="drop-pulse" aria-hidden="true"><i /><i /><i /></div>
        <div class="drop-area" :style="!isNarrow ? { width: box.width + 'px', height: box.height + 'px' } : undefined">
          <DropItem
            v-for="p in placed"
            :key="p.peer.id"
            :device="p.peer"
            :is-self="p.isSelf"
            :is-float="!isNarrow"
            :position="p.position"
            :transfer="drop.transfers[p.peer.id]"
            :suspended="!drop.connected"
            @select-files="(files) => drop.sendFiles(p.peer.id, files)"
            @cancel-transfer="drop.cancelTransfer(p.peer.id)"
            @transfer-stalled="drop.cancelTransfer(p.peer.id, 'timeout')"
          />
        </div>
        <DropCenter v-if="!isNarrow" />
        <DropAddButton />
        <ReceivePrompt />
      </main>
    </div>
    <AlertDialog
      :open="leaveOpen"
      :title="t('filesDropLeaveTitle')"
      :message="t('filesDropLeaveMessage')"
      :confirm-text="t('filesDropLeaveConfirm')"
      :cancel-text="t('filesCancel')"
      destructive
      @update:open="onLeaveOpenChange"
      @confirm="settleLeave(true)"
    />
  </AreaShell>
</template>

<style scoped>
/* Key difference between Drop page and SharesPage: this page's main area content is entirely
   absolute positioned (doesn't expand height), so the container must provide a definite height
   —— height:100% (not min-height) + drop-main stretch. Otherwise .drop-main collapses to
   title height, resize() measures ~56px, contentsBox calculates negative geometry, bubbles
   fly out of viewport entirely. */
.files-layout { display: flex; gap: 16px; align-items: flex-start; height: 100%; }
.drop-main { position: relative; flex: 1; align-self: stretch; overflow: hidden; display: flex; flex-direction: column; align-items: center; }
.drop-title { align-self: flex-start; margin: 16px 20px; font-size: 18px; color: var(--fg); }
.drop-area { position: absolute; left: 50%; bottom: 0; transform: translateX(-50%); }
.drop-main.narrow .drop-area {
  position: relative; left: auto; bottom: auto; transform: none;
  display: flex; flex-wrap: wrap; justify-content: center; gap: 28px; padding: 24px; width: 100%;
}
/* pulse ripple background: CSS replaces Vue2 GSAP DropBg */
.drop-pulse { position: absolute; left: 50%; bottom: 0; transform: translateX(-50%); pointer-events: none; }
.drop-pulse i {
  position: absolute; left: 50%; bottom: -40px; transform: translateX(-50%);
  border: 1px solid var(--card-border); border-radius: 50%;
  animation: dropPulse 6s linear infinite; opacity: 0;
}
.drop-pulse i:nth-child(1) { width: 300px; height: 300px; }
.drop-pulse i:nth-child(2) { width: 300px; height: 300px; animation-delay: 2s; }
.drop-pulse i:nth-child(3) { width: 300px; height: 300px; animation-delay: 4s; }
@keyframes dropPulse {
  0% { transform: translateX(-50%) scale(0.4); opacity: 0; }
  20% { opacity: 0.6; }
  100% { transform: translateX(-50%) scale(3.2); opacity: 0; }
}
@media (max-width: 768px) {
  .files-layout { gap: 0; }
}
</style>
