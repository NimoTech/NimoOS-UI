<script setup lang="ts">
// Non-cancellable progress overlay. Corresponds to Vue2 :495-514's `<b-modal :can-cancel="false">` + `<b-message>`
// (the spinner dialog for "Stopping/Restarting/Deleting VM"). New-UI has no buefy, self-drawn.
//
// Fallback for can-cancel=false: the entire component has no click handlers at all — neither the overlay
// itself nor the card will close when clicked; the only way to close is for the parent component to stop
// rendering this component after the action ends (v-if removed).
//
// ⚠️ Teleport to body (hard constraint 6 requires clear justification): .kvm-page is a stacking context (T2 adds
// position:relative + z-index:1 to override the global ambient light layer). If this component renders inside .kvm-page,
// its effective stacking level relative to body-level siblings (AppToast's z-index:60, Dialog.vue-like dialogs'
// z-index:1000) will be clamped to 1 — cannot cover them. Vue2's b-modal itself is under body via buefy (not a child
// of kvm-full-page), so Teleport here restores Vue2's actual mount position, not new behavior. Stop/Restart/Delete
// are "irreversible" operations, the overlay should dominate the screen during this period and cannot be obscured by
// passing global toasts/dialogs or be mistaken as allowing interaction with what's behind.
// <Teleport> is a built-in template component, no import needed.
defineProps<{ title: string; message: string }>()
</script>

<template>
  <Teleport to="body">
    <div class="kvm-progress-overlay">
      <div class="kvm-progress-card">
        <div class="kvm-progress-title">
          <span>{{ title }}</span>
          <span class="kvm-spinner" aria-hidden="true"></span>
        </div>
        <div class="kvm-progress-msg">{{ message }}</div>
      </div>
    </div>
  </Teleport>
</template>
