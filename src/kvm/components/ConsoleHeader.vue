<script setup lang="ts">
// Console header (VM name/OS icon/status dot + settings/more action buttons).
// Visual 1:1 match with Vue2 components/KVM/KVMFullPage.vue :79-140 (entire console-header block).
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { KvmVM } from '@nimotech/nimoos-service'
import { stateLabelKey } from '../util/vmState'
import { osIconFor } from '../util/format'
import OverflowMenu from './OverflowMenu.vue'

const props = defineProps<{ vm: KvmVM; processing: boolean }>()
const emit = defineEmits<{ action: [name: string] }>()

const { t, te } = useI18n()

// State text: same pattern as VmListItem (used in T4); unregistered keys (crashed/missing) display as-is.
const stateKey = computed(() => stateLabelKey(props.vm.state))
const stateText = computed(() => (te(stateKey.value) ? t(stateKey.value) : stateKey.value))

// P6 Task 9: Settings button enabled — follows Vue2 canEditSettings (:674-676). Vue2's is
// `this.selectedVM && (...)`, no null-check needed here: ConsoleHeader is only mounted/rendered by
// KvmPage when `s.selectedVM.value` is truthy (v-else branch), so the `vm` prop is always a real VM object.
const canEditSettings = computed(() => props.vm.state === 'stopped' || props.vm.state === 'crashed')

// Overflow menu toggle. Uses v-if (not v-show) to mount/unmount OverflowMenu — each time it opens
// is a fresh instance, with internal pendingAction/pendingId naturally empty.
//
// Review minor fix (option b): previously toggleMenu/handleOutsideClick/watch had three places
// calling `overflowRef.value?.reset()`, mutation testing showed this was dead code — menu close
// always goes through `menuOpen.value = false`, and OverflowMenu is mounted under `v-if="menuOpen"`;
// once menuOpen becomes false the entire component instance and its internal pendingAction/pendingId
// are destroyed, there's no window where "users glimpse one frame of confirmation text during
// close animation" (v-if not v-show, no transition animation, destruction is synchronous on next patch).
// The previous comment's "per Vue2 toggleOverflowMenu needs explicit resetPendingConfirm" doesn't hold:
// Vue2's menu **stays in DOM**, uses `v-if="showOverflowMenu"` to control visibility but pendingConfirmAction
// is the parent (KVMFullPage) component's own data, not cleared when child nodes are destroyed, so Vue2
// must explicitly clear; here confirmation state is OverflowMenu's own internal state, naturally cleared
// when the component is destroyed, no need to call again. Deleted the three dead calls, and removed
// `overflowRef` call sites too. Cleanup item 8 (end of all-branch review) follow-up: OverflowMenu's own
// `defineExpose({ reset })` thus has no external consumers, already removed from that component (reset()
// itself remains its internal function, just no longer exposed externally).
const menuOpen = ref(false)
const wrapperEl = ref<HTMLElement | null>(null)

function toggleMenu() {
  menuOpen.value = !menuOpen.value
}

// Per Vue2 handleOutsideClick (:1108-1111): close menu when clicking outside dropdown-wrapper.
function handleOutsideClick(e: MouseEvent) {
  if (menuOpen.value && wrapperEl.value && !wrapperEl.value.contains(e.target as Node)) {
    menuOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', handleOutsideClick))
onUnmounted(() => document.removeEventListener('click', handleOutsideClick))

// When switching VMs, close the menu together (Task 5 brief in-place double-confirmation contract
// item 4: "confirmation state" is naturally cleared when OverflowMenu unmounts, just need to close the menu here).
watch(() => props.vm.id, () => {
  menuOpen.value = false
})

// When menu item is clicked: pass through to parent component and close menu (per Vue2 where
// each dropdown-item click expression ends with `showOverflowMenu=false`).
function onMenuAction(name: string) {
  emit('action', name)
  menuOpen.value = false
}
</script>

<template>
  <div class="console-header">
    <div class="console-title">
      <img :src="osIconFor(vm.os)" class="console-os-icon" :alt="vm.os" />
      <div>
        <h3>{{ vm.name }}</h3>
        <div class="console-status">
          <span class="status-dot" :class="vm.state"></span>
          <span class="status-text">{{ stateText }}</span>
        </div>
      </div>
    </div>
    <div class="console-actions">
      <!-- P6 Task 9 unlocked: per Vue2 :91-95 (b-tooltip + canEditSettings to toggle tooltip text).
           ⚙ remains a monochrome text symbol (no emoji), same placeholder approach as VmSidebar's gear,
           ending the P5-legacy "always disabled + kvmComingSoon" placeholder state. -->
      <button
        class="action-btn"
        type="button"
        :disabled="!canEditSettings"
        :title="canEditSettings ? t('kvmSettings') : t('kvmStopToModifySettings')"
        :aria-label="t('kvmSettings')"
        @click="emit('action', 'settings')"
      >
        <span aria-hidden="true">⚙</span>
      </button>
      <div class="dropdown-wrapper" ref="wrapperEl">
        <button
          class="action-btn"
          type="button"
          :title="t('kvmMore')"
          :aria-label="t('kvmMore')"
          @click="toggleMenu"
        >
          <span aria-hidden="true">⋮</span>
        </button>
        <OverflowMenu
          v-if="menuOpen"
          :vm="vm"
          :processing="processing"
          @action="onMenuAction"
        />
      </div>
    </div>
  </div>
</template>
