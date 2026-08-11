<script setup lang="ts">
// A centered "preparing upload…" spinner shown between the moment files are
// received (folder tree walk on drop, conflict listing, batch registration)
// and the moment the upload actually starts. The parent hides it while a
// same-name conflict dialog is open so the two never stack.
defineProps<{ open: boolean }>()
</script>

<template>
  <Transition name="prep-fade">
    <div v-if="open" class="prep-overlay" role="status" aria-live="polite">
      <div class="prep-card">
        <span class="prep-spinner" aria-hidden="true"></span>
        <span class="prep-text">{{ $t('filesUploadPreparing') }}</span>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.prep-overlay {
  position: fixed; inset: 0; z-index: 900;
  display: grid; place-items: center;
  background: var(--overlay-bg);
}
.prep-card {
  display: flex; align-items: center; gap: 12px;
  padding: 18px 24px; border-radius: 14px;
  background: var(--popup-bg); color: var(--fg);
  border: 1px solid var(--card-border);
  box-shadow: var(--card-shadow-hi);
  backdrop-filter: var(--blur);
}
.prep-spinner {
  width: 20px; height: 20px;
  border: 3px solid color-mix(in srgb, var(--fg-muted) 40%, transparent);
  border-top-color: var(--accent); border-radius: 999px;
  animation: prep-spin 0.7s linear infinite;
}
.prep-text { font-size: 14px; }
@keyframes prep-spin { to { transform: rotate(360deg); } }
.prep-fade-enter-active, .prep-fade-leave-active { transition: opacity .15s ease; }
.prep-fade-enter-from, .prep-fade-leave-to { opacity: 0; }
</style>
