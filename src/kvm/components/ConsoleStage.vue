<script setup lang="ts">
// Console canvas host (VNC canvas mount point) + placeholder layer (error message / power on/resume large buttons).
// Visual 1:1 correspondence with Vue2 components/KVM/KVMFullPage.vue `.console-display`/`.console-placeholder`
// that template section (:154-192, verified 2026-08-02). The actual RFB lifecycle belongs to useVncConsole.ts, this component
// is only responsible for providing it a stable mount point (hostEl) + rendering "what should be shown when not connected".
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { KvmVM } from '@nimotech/nimoos-service'
import powerIcon from '../assets/power.svg'
import playIcon from '../assets/play.svg'

const props = defineProps<{
  vm: KvmVM
  connected: boolean
  /** Can be either an i18n key (e.g. 'kvmVncFetchFailed') or already-parsed raw text —
   * both cases are passed to errorText below to be uniformly determined via te()/t(), same as
   * the existing pattern of lastErrorText in KvmPage (P5 evaluation established convention). */
  errorKey: string
  processing: boolean
}>()

// consoleEnter/consoleLeave/consoleMove (Task 7, review fix): forward mouse events on `.console-display`
// to the parent component (KvmPage), which drives the show/hide state machine of the SendKey floating toolbar.
// ⚠️ Architecture correction (review Important #1): initial version of Task 7 used `<Teleport :to="hostEl">` +
// manually written `addEventListener` in parent to "stuff" the toolbar into this node, the reason was that brief's Files list
// did not include ConsoleStage.vue. Review pointed out this was overly cautious — brief's list is "anticipated changes"
// not a boundary prohibiting modifications, and "add a slot + forward three mouse events" is simpler than Teleport +
// manually written lifecycle management, with smaller risk surface (no need to manually maintain "remove/attach listener when node changes"
// this whole set, the framework's slot/event system itself guarantees it). Changing here rather than parent's manual listening
// is returning to the most direct approach.
const emit = defineEmits<{
  start: []
  resume: []
  'console-enter': []
  'console-leave': []
  'console-move': [e: MouseEvent]
}>()

const { t, te } = useI18n()

const errorText = computed(() => (props.errorKey && te(props.errorKey)) ? t(props.errorKey) : props.errorKey)

// Review Minor registration (unreported deviation, supplementary registration): Vue2's two <img alt>
// are literal English "Power"/"Play" (KVMFullPage.vue:178/188), here changed to t('kvmPowerOn')/t('kvmResume')
// (switches with language and keeps consistent with the button's own aria-label, avoiding "screen reader reads Chinese
// alt reads English" mismatch). The `type="button"` on both buttons is also new — Vue2's two <button> have no explicit
// type, other buttons in this repository (ConsoleHeader/OverflowMenu) all write type="button" to prevent accidental form submission,
// here we complete the same convention. All harmless improvements, not reverted.

// This div is the Vue2 `ref="consoleDisplay"` node — noVNC mounts the canvas here,
// useVncConsole also clears residual canvas from here. Exposed to parent component (KvmPage) which passes it to useVncConsole.
const hostEl = ref<HTMLElement | null>(null)
defineExpose({ hostEl })
</script>

<template>
  <div
    class="console-display"
    ref="hostEl"
    @mouseenter="emit('console-enter')"
    @mouseleave="emit('console-leave')"
    @mousemove="emit('console-move', $event)"
  >
    <div v-if="!connected" class="console-placeholder">
      <p v-if="errorText" class="console-hint is-error">{{ errorText }}</p>
      <template v-else>
        <button
          v-if="vm.state === 'stopped'"
          type="button"
          class="start-vm-btn"
          :disabled="processing"
          :aria-label="t('kvmPowerOn')"
          @click="emit('start')"
        >
          <span class="power-icon">
            <img :src="powerIcon" :alt="t('kvmPowerOn')" class="power-svg" />
          </span>
        </button>
        <button
          v-if="vm.state === 'paused'"
          type="button"
          class="start-vm-btn"
          :disabled="processing"
          :aria-label="t('kvmResume')"
          @click="emit('resume')"
        >
          <span class="power-icon">
            <img :src="playIcon" :alt="t('kvmResume')" class="power-svg" />
          </span>
        </button>
      </template>
    </div>
    <!-- SendKey floating toolbar (Task 7) is passed in from here as slot content, DOM hierarchy is identical
         to Vue2 (toolbar is direct child of `.console-display`), positioning reference is still this component's hostEl. -->
    <slot />
  </div>
</template>
