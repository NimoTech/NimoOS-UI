<script setup lang="ts">
// ISO selector dialog — official template half (category filter + card grid + download three-state).
// Visual 1:1 mapping to Vue2 components/KVM/OSSelector.vue template :1-52 (header + categories + card grid),
// logic maps to filteredOS(:196-199)/getButtonClass(:251-255)/getButtonText(:257-265)/
// handleOSAction(:267-275)/selectOS(:287-290).
//
// This component is a pure presentation layer: `isos` is held at page level by useIsoList()
// (KvmPage, Task 8 wiring) and passed in as props. The component itself does not create useIsoList
// or subscribe to any MessageBus events — Vue2's OSSelector is permanently mounted (`v-if="visible"`
// on its own root), and the download-progress subscription stays active; closing the dialog doesn't
// affect progress updates. New-UI moved this state up to page level, so this component degrades to
// pure presentation, obtaining isos via props and reporting actions via emit (brief "why isos is props"
// section).
//
// The custom (local file browser) section is the IsoBrowser component (Task 6). This component only
// handles wiring: relay isos props and forward its select event + close the dialog (see onLocalSelect below).
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import KvmDialog from './KvmDialog.vue'
import IsoBrowser from './IsoBrowser.vue'
import { filterByCategory } from '../util/isoMatch'
import { osIconFor } from '../util/format'
import type { IsoRow } from '../composables/useIsoList'

/** Standard shape of OS selection result passed to parent after official template is selected
 * (Task 7 create dialog / Task 9 VM settings). Task 6 (local file browser) selectOS branch also
 * produces the same type; `isLocal` distinguishes the source.
 * ⚠️ Must match brief Interfaces block exactly; changes require coordination with Task 6/7/9. */
export interface SelectedOs {
  isLocal: boolean
  id: string
  name: string
  path: string
  size?: number
  recommendedVcpu?: number
  recommendedMemory?: number
  minMemory?: number
  minDisk?: number
}

const props = defineProps<{
  open: boolean
  isos: IsoRow[]
  /** Full-branch review fix (A3, reported): inline error message when ISO download fails. ''=no error.
   * Parent component (KvmPage) is responsible for clearing this before starting a new download round
   * or when closing this dialog — this component itself doesn't manage timing, only displays, using
   * the same contract as CreateVmDialog/VmSettingsDialog's submitError.
   * Why not use global toast: this component's mask has z-index 920 (see `<KvmDialog :z-base="920">` below),
   * global toast is z-index 60 (src/components/AppToast.vue:12) — download failures typically happen
   * while the user is watching the percentage in this dialog; the toast would be completely hidden behind
   * this mask. The card itself only quietly reverts from "12.34%" to "Download" (unlike successful downloads
   * where the card turns green with a fallback visual), so the net effect is the user sees no visible
   * failure explanation. Vue2 could use buefy toast because its toast z-index is higher than its own modal;
   * here the z-axis relationship is reversed, so we can't copy that approach. */
  downloadError: string
  /** SP16 Task 6: expanded state of the custom (local ISO browser) section. This component's content is
   * unmounted by reka when closed, so this state must be held at page level to persist across "close then
   * reopen" cycles. This component only relays the state; it doesn't interpret it. */
  browserExpanded: boolean
}>()
const emit = defineEmits<{
  'update:open': [v: boolean]
  select: [os: SelectedOs]
  download: [id: string]
  /** Clicked on a card that is currently downloading — parent shows "please wait for download to complete";
   * this component doesn't manage how it's shown, only reports the action. */
  'need-wait': []
  'update:browserExpanded': [v: boolean]
}>()

const { t } = useI18n()

// Mirrors Vue2 osCategories(:180-185); order must not change (all/windows/linux/bsd).
const CATEGORIES = [
  { key: 'all', label: 'kvmCatAll' },
  { key: 'windows', label: 'kvmCatWindows' },
  { key: 'linux', label: 'kvmCatLinux' },
  { key: 'bsd', label: 'kvmCatBsd' },
] as const

const selectedCategory = ref<string>('all')

// filterByCategory(Task 3) operates on KvmISO[] signature; IsoRow is structurally compatible (extends KvmISO).
// The filtered result elements are already IsoRow instances; here we just restore the type annotation,
// not re-implement filtering.
const filtered = computed<IsoRow[]>(() => filterByCategory(props.isos, selectedCategory.value) as IsoRow[])

// Mirrors Vue2 getButtonClass(:251-255).
function buttonClass(os: IsoRow): string {
  if (os._downloaded) return 'is-selected'
  if (os._downloading) return 'is-downloading-btn'
  return 'is-download'
}

// Mirrors Vue2 getButtonText(:257-265) — **does not port** the `${mb}MB` branch (dead code, already reported):
// the condition is `os._progress >= 0`; progress non-negative is always true, so that branch is unreachable.
function buttonText(os: IsoRow): string {
  if (os._downloaded) return t('kvmSelect')
  if (os._downloading) return `${os._progress.toFixed(2)}%`
  return t('kvmDownload')
}

// Mirrors Vue2 handleOSAction(:267-275) + selectOS(:287-290), plus path-missing guard
// (Vue2 lacks this): `path` is `json:"path,omitempty"`, appears only when status==='downloaded'.
// If "downloaded but no path" actually occurs, Vue2 would send iso:undefined to backend, getting 400 —
// here we fix it: don't emit, don't dispatch incomplete state.
function handleAction(os: IsoRow): void {
  if (os._downloaded) {
    if (!os.path) return
    emit('select', {
      isLocal: false,
      id: os.id,
      name: os.name,
      path: os.path,
      // ⚠️ Intentionally omitting size (not an oversight; Task 5 residual Minor note here
      // to prevent Task 7/9 from making the wrong call): `KvmISO.size` is a display string
      // (e.g. "676 MB"), while `SelectedOs.size?: number` is bytes — they come from different
      // sources and can't be legally derived from each other. Hardcoding would smuggle a string
      // or NaN into a field that should hold byte count. Local file paths (see IsoBrowser.vue
      // onItemClick) have the real byte count (FolderEntry.size); that branch correctly includes size.
      recommendedVcpu: os.recommendedVcpu,
      recommendedMemory: os.recommendedMemory,
      minMemory: os.minMemory,
      minDisk: os.minDisk,
    })
    emit('update:open', false)
  } else if (os._downloading) {
    // Full-branch review recorded debt (A3 side item, not a defect to fix this round; keeping current
    // behavior unchanged): Vue2 clicking a card that is downloading does nothing (OSSelector.vue:268-274
    // `else if (os._downloading) { return }`) — the "please wait for download to complete" toast is
    // hooked to selectOS, but selectOS only fires for `_downloaded` rows, so downloading rows never reach
    // that toast; it's dead code in Vue2. The `need-wait` emit here revives it into "alive but invisible" —
    // KvmPage.vue does show a toast (`@need-wait="toast.show(...)"`), but this dialog's own mask is z 920
    // and toast is z 60, so it gets completely hidden just like A3's download failure. Net effect matches Vue2
    // (clicked but no visible feedback), so we don't change behavior — but `need-wait` emit + i18n key
    // `kvmWaitForDownload` + KvmPage's toast wiring together form pure dead weight (looks intentionally designed,
    // but actually never truly active), logged as debt, not cleaning up this round (outside A3's defined scope;
    // cleaning it up requires deciding "should we simply delete this emit"; that's a behavior-change decision
    // for the controller/next cycle).
    emit('need-wait')
  } else {
    emit('download', os.id)
  }
}

// Task 6: local ISO selected in the custom section (local file browser) goes through the same select channel
// and closes the dialog — same decision as handleAction's downloaded branch (select closes), just different
// source (official template vs local file), no reason to fork into two different close timings.
function onLocalSelect(os: SelectedOs): void {
  emit('select', os)
  emit('update:open', false)
}
</script>

<template>
  <KvmDialog
    :open="props.open"
    :title="t('kvmSelectOsTitle')"
    width="40rem"
    :z-base="920"
    @update:open="emit('update:open', $event)"
  >
    <div class="os-selector-body">
      <!-- Category filter. Container markup divergence (reported): Vue2 uses buefy b-button, New-UI has no buefy → custom drawing. -->
      <div class="category-filter">
        <button
          v-for="cat in CATEGORIES"
          :key="cat.key"
          type="button"
          class="category-btn"
          :class="{ active: selectedCategory === cat.key }"
          @click="selectedCategory = cat.key"
        >
          {{ t(cat.label) }}
        </button>
      </div>

      <!-- Full-branch review fix (A3): must be above the mask (z 920) where user can see it — reuse
           existing .cv-error class (kvm.css already has styles, no new CSS), place between category tabs and
           card grid, positioned near the area most related to the "download failed" action. -->
      <p v-if="props.downloadError" class="cv-error">{{ props.downloadError }}</p>

      <section class="os-section">
        <div class="os-grid">
          <div
            v-for="os in filtered"
            :key="os.id"
            class="os-card"
            :class="{ 'is-downloaded': os._downloaded, 'is-downloading': os._downloading }"
          >
            <div class="os-icon-wrapper">
              <img :src="osIconFor(os.id)" :alt="os.name" class="os-icon" />
            </div>
            <div class="os-info">
              <span class="os-name">{{ os.name }}</span>
              <span class="os-version">{{ os.version }}</span>
              <span class="os-size">{{ os.size }}</span>
            </div>
            <button
              type="button"
              class="os-action-btn"
              :class="buttonClass(os)"
              @click="handleAction(os)"
            >
              {{ buttonText(os) }}
            </button>
          </div>
        </div>
      </section>

      <IsoBrowser
        :isos="props.isos"
        :expanded="props.browserExpanded"
        @update:expanded="emit('update:browserExpanded', $event)"
        @select="onLocalSelect"
      />
    </div>
  </KvmDialog>
</template>
