<!-- src/files/drop/components/ReceivePrompt.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDropStore } from '../stores/drop'
import { renderSize } from '../../util/format'

const { t } = useI18n()
const drop = useDropStore()
const head = computed(() => drop.receiveQueue[0] ?? null)
</script>

<template>
  <transition name="fade">
    <div v-if="head" class="receive-card">
      <p class="receive-text">
        {{ t('filesDropSavePrompt', { name: head.file.name, size: renderSize(head.file.size), device: drop.deviceName(head.from) }) }}
      </p>
      <div class="receive-actions">
        <button class="receive-ignore" @click="drop.ignoreCurrent()">{{ t('filesDropIgnore') }}</button>
        <button class="receive-save" @click="drop.saveCurrent()">{{ t('filesDropSave') }}</button>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.receive-card {
  position: absolute; left: 50%; bottom: 24px; transform: translateX(-50%);
  min-width: 320px; max-width: 90%; padding: 14px 18px; border-radius: var(--radius, 12px);
  background: var(--popup-bg); border: 1px solid var(--card-border);
  color: var(--fg); z-index: 50; animation: itemIn 0.25s ease both;
}
.receive-text { margin: 0 0 10px; font-size: 14px; word-break: break-all; }
.receive-actions { display: flex; justify-content: flex-end; gap: 10px; }
.receive-actions button {
  padding: 6px 16px; border-radius: 8px; border: 1px solid var(--card-border);
  background: transparent; color: var(--fg); cursor: pointer; font-size: 13px;
}
.receive-save { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }

.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@keyframes itemIn {
  from { opacity: 0; transform: translate(-50%, 12px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}
</style>
