<script setup lang="ts">
// Left sidebar: header (logo + title + running count + settings gear) + VM list + bottom add button.
// Visual 1:1 match with Vue2 components/KVM/KVMFullPage.vue:10-67 (<aside class="kvm-sidebar">…</aside>).
//
// Collapsed state is computed by parent component KvmPage and passed in; this component only
// reflects it to the root element's class — the collapsed/expanded mouse hover logic is not this
// component's responsibility; KvmPage attaches @mouseenter/@mouseleave directly on the <VmSidebar>
// tag. Vue 3 automatically passes unelaborated native DOM event listeners to a single-root
// component's root element (attrs fallthrough), no need for this component to explicitly forward.
//
// The `active` class on the root element drives narrow-screen drawer visibility (separate media
// query in kvm.css for ≤768px, this class has no visual effect at desktop width). Vue2 legacy bug
// fixed at T8 end: the trigger class for Vue2's narrow-screen drawer was never actually add/remove'd
// (dead code, see comment above `.kvm-sidebar.active` rule in kvm.css), here we reuse the existing
// `collapsed` state, `active = !collapsed` on narrow screens — default expanded, clicking the same
// collapse button closes it.
// ⚠️ Pitfall record: this comment was originally in <template>, right above the `<aside>` root tag,
// but Vue 3 compiler treated "template-level comment + root element" as two root nodes of a Fragment
// (Vue preserves comment vnodes by default, doesn't exclude them from root node count), causing
// @vue/test-utils wrapper root to become a synthetic wrapping <div>, so `wrapper.classes()` could
// never read any class on the aside (verified with debug script, not a test-utils behavior blind spot,
// the template really did have an extra root). Moved here (plain comment in script block, not compiled
// into template) solves it; component remains a single <aside> root.
import type { KvmVM } from '@nimotech/nimoos-service'
import { useI18n } from 'vue-i18n'
import VmListItem from './VmListItem.vue'
import kvmLogo from '../assets/kvm.svg'

defineProps<{
  vms: KvmVM[]
  selectedId: string | null
  runningCount: number
  isLoading: boolean
  collapsed: boolean
}>()
// P6 Task 8: 'add-vm' unlocked — per Vue2 `@click="showCreateVM"` (:61-64). This component only
// forwards the click; parent component (KvmPage.openCreateDialog) decides to reset selectedOS and open the dialog.
defineEmits<{ select: [vm: KvmVM]; 'open-global-settings': []; 'add-vm': [] }>()

const { t } = useI18n()
</script>

<template>
  <aside class="kvm-sidebar" :class="{ collapsed, active: !collapsed }">
    <header class="kvm-header">
      <div class="kvm-header-left">
        <img :src="kvmLogo" class="kvm-logo" alt="KVM" />
        <div class="kvm-header-text">
          <h2 class="kvm-title">{{ t('kvmTitle') }}</h2>
          <span class="kvm-status">
            <span class="status-dot" :class="{ running: runningCount > 0 }"></span>
            {{ runningCount }} / {{ vms.length }} {{ t('kvmRunningSuffix') }}
          </span>
        </div>
      </div>
      <div class="kvm-header-right">
        <!-- Gear = global settings entry (Task 2 unlocked). ⚙ is a monochrome text symbol (no emoji),
             color comes from .kvm-settings-btn's color token. -->
        <button
          class="kvm-settings-btn"
          type="button"
          :title="t('kvmSettings')"
          :aria-label="t('kvmSettings')"
          @click="$emit('open-global-settings')"
        >
          <span aria-hidden="true">⚙</span>
        </button>
      </div>
    </header>

    <div class="vm-list">
      <div v-if="vms.length === 0 && !isLoading" class="empty-state">
        <!-- ⬚ is a monochrome text symbol placeholder (no emoji) — Vue2 used the remote-desktop-outline
             icon font, New-UI doesn't have that font. Same batch of placeholder debt as ‹/▭ in KvmPage.vue
             and ⚙/⋮ in ConsoleHeader.vue, to be consolidated when swapping real icons all at once
             (cleanup item 5, not an oversight of this task). -->
        <span class="empty-icon" aria-hidden="true">⬚</span>
        <p class="empty-text">{{ t('kvmNoVms') }}</p>
      </div>

      <VmListItem
        v-for="vm in vms"
        :key="vm.id"
        :vm="vm"
        :active="selectedId === vm.id"
        @select="$emit('select', vm)"
      />
    </div>

    <!-- Add VM (P6 Task 8 unlocked, per Vue2 :61-64). Two rules in kvm.css .add-vm-btn:disabled and
         :hover:not(:disabled) are kept as-is — button no longer enters disabled state, but the rules
         themselves are still correct (hard constraint, task spec explicitly says do not delete). -->
    <button class="add-vm-btn" type="button" @click="$emit('add-vm')">
      <span aria-hidden="true">+</span>
      <span>{{ t('kvmAddVm') }}</span>
    </button>
  </aside>
</template>
