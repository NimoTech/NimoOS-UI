<script setup lang="ts">
// SendKey floating toolbar: four modifier keys (Ctrl/Alt/Shift/Win) + Tab/Esc + Ctrl+Alt+Del + fullscreen.
// Visual 1:1 correspondence with Vue2 components/KVM/KVMFullPage.vue `.sendkey-toolbar` template
// (:195-223, verified 2026-08-02). This component only handles rendering + emit — mouse hover show/hide rules (mouseenter/
// mouseleave/mousemove that entire state machine), source of isFullscreen (document.fullscreenElement),
// Teleport mount location all belong to KvmPage.vue, reason see that file's top comment (brief: `.console-display` is
// a DOM node inside ConsoleStage component, not KvmPage's own template, this component doesn't care where it's mounted).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import ctrlAltDelIcon from '../assets/ctrl-alt-del.svg'
import fullscreenIcon from '../assets/fullscreen.svg'
import exitFullscreenIcon from '../assets/exitfullscreen.svg'

type Modifiers = { ctrl: boolean; alt: boolean; shift: boolean; win: boolean }

const props = defineProps<{ modifiers: Modifiers; isFullscreen: boolean }>()

const emit = defineEmits<{
  toggle: [name: keyof Modifiers]
  key: [keysym: number]
  ctrlAltDel: []
  fullscreen: []
}>()

const { t } = useI18n()

// Fullscreen button's title/aria-label switches with isFullscreen (kvmFullscreen ⇄ kvmExitFullscreen).
// ⚠️ Deviation from Vue2 (not a new decision for this task, i18n/zh_cn.sp9.ts:405-408 already registered established conclusion,
// here we just follow it): Vue2 fullscreen button's title is always $t('Fullscreen') (never switches with isFullscreen,
// is legacy copy bug), alt attribute hardcoded English "Exit Fullscreen"/"Fullscreen" and never goes through i18n.
// Per porting discipline (interface 1:1, don't copy Vue2's bugs, fix correct logic and register via comment): New-UI lets the copy
// correctly switch with isFullscreen, kvmExitFullscreen key is not in zh_CN.json, added specifically for this.
const fullscreenLabel = computed(() => (t(props.isFullscreen ? 'kvmExitFullscreen' : 'kvmFullscreen')))
</script>

<template>
  <div class="sendkey-toolbar">
    <button
      class="sendkey-btn"
      type="button"
      :class="{ active: modifiers.ctrl }"
      :title="t('kvmToggleCtrl')"
      @click="emit('toggle', 'ctrl')"
    >
      <span>Ctrl</span>
    </button>
    <button
      class="sendkey-btn"
      type="button"
      :class="{ active: modifiers.alt }"
      :title="t('kvmToggleAlt')"
      @click="emit('toggle', 'alt')"
    >
      <span>Alt</span>
    </button>
    <button
      class="sendkey-btn"
      type="button"
      :class="{ active: modifiers.shift }"
      :title="t('kvmToggleShift')"
      @click="emit('toggle', 'shift')"
    >
      <span>Shift</span>
    </button>
    <button
      class="sendkey-btn"
      type="button"
      :class="{ active: modifiers.win }"
      :title="t('kvmToggleWin')"
      :aria-label="t('kvmToggleWin')"
      @click="emit('toggle', 'win')"
    >
      <!-- ⊞ is monochrome text symbol placeholder (emoji prohibited) — Vue2 uses casa icon font's
           b-icon icon="windows", New-UI doesn't have that font set. Same batch of placeholder debt as ‹/▭ in KvmPage.vue,
           ⚙/⋮ in ConsoleHeader.vue, all to be collected together when that batch is unified and replaced with real icons. -->
      <span aria-hidden="true">⊞</span>
    </button>
    <button
      class="sendkey-btn"
      type="button"
      :title="t('kvmPressTab')"
      @click="emit('key', 0xff09)"
    >
      <span>Tab</span>
      <span class="sendkey-hint">{{ t('kvmPressTab') }}</span>
    </button>
    <button
      class="sendkey-btn"
      type="button"
      :title="t('kvmPressEsc')"
      @click="emit('key', 0xff1b)"
    >
      <span>Esc</span>
    </button>
    <hr class="sendkey-divider" />
    <button
      class="sendkey-btn"
      type="button"
      :title="t('kvmPressCtrlAltDel')"
      :aria-label="t('kvmPressCtrlAltDel')"
      @click="emit('ctrlAltDel')"
    >
      <img :src="ctrlAltDelIcon" :alt="t('kvmPressCtrlAltDel')" class="sendkey-img" />
    </button>
    <button
      class="sendkey-btn sendkey-btn--fullscreen"
      type="button"
      :title="fullscreenLabel"
      :aria-label="fullscreenLabel"
      @click="emit('fullscreen')"
    >
      <img v-if="isFullscreen" :src="exitFullscreenIcon" :alt="fullscreenLabel" class="fullscreen-svg" />
      <img v-else :src="fullscreenIcon" :alt="fullscreenLabel" class="fullscreen-svg" />
    </button>
  </div>
</template>
