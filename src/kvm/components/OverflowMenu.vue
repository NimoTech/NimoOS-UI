<script setup lang="ts">
// Overflow menu (⋮). Visual 1:1 match with Vue2 components/KVM/KVMFullPage.vue :102-136
// (the .overflow-dropdown block under v-if="showOverflowMenu").
//
// Menu toggle (showOverflowMenu) is not managed by this component — parent component ConsoleHeader
// controls this component's mount/unmount via v-if; this component only handles "which menu item was
// clicked" logic.
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { KvmVM } from '@nimotech/nimoos-service'
import {
  canPowerOn, canShutDown, canRestart, canPause, canResume, canWakeUp,
  canDelete, showDeleteDivider,
} from '../util/vmState'

const props = defineProps<{ vm: KvmVM; processing: boolean }>()
const emit = defineEmits<{ action: [name: string] }>()

const { t } = useI18n()

// In-place double confirmation (decided 2026-08-02; follows Vue2 confirmStopVM/confirmRestartVM/confirmDeleteVM
// :1322-1365 + resetPendingConfirm :1135-1137).
//
// Confirmation target is stored in non-reactive closure variables (P4 lesson: reactive variables
// can be cleared prematurely by external code during the dialog close animation, causing the
// "second click" to read an empty confirmation target, misinterpreting as "re-enter pending" instead
// of "confirm execution"). The actual decision logic (isPending) only reads these two plain variables;
// `tick` is a ref that doesn't participate in logic, only tells Vue "re-render needed" — the
// isPending() call in the template reads it to establish reactive dependency, but the decision itself
// is purely based on the two non-reactive variables above, independent of when Vue syncs the ref.
let pendingAction = ''
let pendingId = ''
const tick = ref(0)

function isPending(action: string): boolean {
  void tick.value
  return pendingAction === action && pendingId === props.vm.id
}

function setPending(action: string, id: string) {
  pendingAction = action
  pendingId = id
  tick.value++
}

function reset() {
  setPending('', '')
}

/** Three items requiring double confirmation (stop/restart/delete). First click stores the target,
 * second click (with matching target) emits. */
function confirmThenEmit(action: string) {
  if (isPending(action)) {
    reset()
    emit('action', action)
  } else {
    setPending(action, props.vm.id)
  }
}

/** Items executed directly on a single click (start/pause/resume/wakeup/autostart).
 * Following Vue2 pattern where each direct-action button had `resetPendingConfirm(); xxxVM(...); showOverflowMenu=false` —
 * menu close is left to the parent component (closes itself after receiving the action event);
 * here we only clear any pending-confirmation state on other items. */
function direct(action: string) {
  reset()
  emit('action', action)
}

// Cleanup item 8 (end of all-branch review): used to have `defineExpose({ reset })` here for
// ConsoleHeader to call explicitly when closing the menu. T5 review confirmed those call sites
// were dead code and removed them (v-if unmount naturally clears pendingAction/pendingId; see
// ConsoleHeader.vue top comment), so `reset` has had no external consumers since then — only
// unit tests in this file call it, pure YAGNI remnant of exposing internals for testing.
// Removed defineExpose; `reset` kept as an internal function (confirmThenEmit/direct still need it).

// Task 8 addition: Vue2 had a b-icon (icon + text layout) before each item (:103-133); T5
// only ported the text. New-UI has no casa icon font; following this area's existing pattern
// (⚙/⋮/‹ etc. as monochrome text symbol placeholders, no emoji) we add them here — the symbol
// itself is not an exact replica of the corresponding icon, it's a continuation of the placeholder
// approach; the 1:1 part is the layout intent "every item has an icon". Autostart item never had
// a b-icon in Vue2 (the toggle-indicator circle dot itself is its "icon"), so no extra symbol here,
// keep it as is.
// ⚠️ This comment is intentionally in the script block, not right above the root div in <template> —
// Vue 3 compiler treats "template-level comment + root element" as two root nodes/Fragment (see
// VmSidebar component's detailed pitfall record at the same place), placing it in script avoids
// polluting the template's single-root structure.
</script>

<template>
  <div class="overflow-dropdown">
    <button v-if="canPowerOn(vm)" class="dropdown-item" type="button" @click="direct('start')">
      <span class="dropdown-icon" aria-hidden="true">▶</span>
      <span>{{ t('kvmPowerOn') }}</span>
    </button>

    <button v-if="canShutDown(vm)" class="dropdown-item" type="button" @click="confirmThenEmit('stop')">
      <span class="dropdown-icon" aria-hidden="true">⊘</span>
      <span :class="{ 'confirm-text-danger': isPending('stop') }">
        {{ isPending('stop') ? t('kvmAreYouSure') : t('kvmForceShutDown') }}
      </span>
    </button>

    <button v-if="canRestart(vm)" class="dropdown-item" type="button" @click="confirmThenEmit('restart')">
      <span class="dropdown-icon" aria-hidden="true">↻</span>
      <span :class="{ 'confirm-text-danger': isPending('restart') }">
        {{ isPending('restart') ? t('kvmAreYouSure') : t('kvmForceRestart') }}
      </span>
    </button>

    <button v-if="canPause(vm)" class="dropdown-item" type="button" @click="direct('pause')">
      <span class="dropdown-icon" aria-hidden="true">‖</span>
      <span>{{ t('kvmPause') }}</span>
    </button>

    <button v-if="canResume(vm)" class="dropdown-item" type="button" @click="direct('resume')">
      <span class="dropdown-icon" aria-hidden="true">▶</span>
      <span>{{ t('kvmResume') }}</span>
    </button>

    <button v-if="canWakeUp(vm)" class="dropdown-item" type="button" @click="direct('wakeup')">
      <span class="dropdown-icon" aria-hidden="true">▶</span>
      <span>{{ t('kvmWakeUp') }}</span>
    </button>

    <button class="dropdown-item" type="button" :disabled="processing" @click="direct('autostart')">
      <span class="toggle-indicator" :class="{ on: vm.autostart }"></span>
      <span>{{ t('kvmAutoStart') }}</span>
    </button>

    <div v-if="showDeleteDivider(vm)" class="dropdown-divider"></div>

    <button v-if="canDelete(vm)" class="dropdown-item is-danger" type="button" @click="confirmThenEmit('delete')">
      <!-- Review minor fix: originally used × which is the same character as SpiceInfoBar's close
           button, same symbol different meaning on the same page. Changed to ⊟ (boxed minus,
           same Mathematical Operators block as ⊘/⊞, verified with screenshot to render clearly
           as monochrome), semantically "remove/subtract" is more apt than borrowing the close button's ×. -->
      <span class="dropdown-icon" aria-hidden="true">⊟</span>
      <span>{{ isPending('delete') ? t('kvmAreYouSure') : t('kvmDelete') }}</span>
    </button>
  </div>
</template>
