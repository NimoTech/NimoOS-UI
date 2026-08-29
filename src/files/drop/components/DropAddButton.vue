<!-- src/files/drop/components/DropAddButton.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { dropAsset } from '../dropIcons'

const { t } = useI18n()
const open = ref(false)
const address = `${window.location.origin}/#/files/drop` // spec §6: navigate to full address
</script>

<template>
  <div class="drop-add">
    <button class="drop-add-btn" :title="t('filesDropLanTitle')" @click="open = !open">
      <img :src="dropAsset('add_btn')" alt="+" />
    </button>
    <div v-if="open" class="drop-add-pop">
      <h4 class="drop-add-title">{{ t('filesDropLanTitle') }}</h4>
      <p class="drop-add-hint">{{ t('filesDropLanHint') }}</p>
      <code class="drop-add-addr">{{ address }}</code>
    </div>
  </div>
</template>

<style scoped>
.drop-add { position: absolute; right: 24px; top: 24px; z-index: 20; }
.drop-add-btn {
  width: 44px; height: 44px; border-radius: 50%; border: 1px solid var(--card-border);
  background: var(--card-bg); cursor: pointer; display: grid; place-items: center;
}
.drop-add-btn img { width: 20px; height: 20px; }
.drop-add-pop {
  position: absolute; right: 0; top: 52px; min-width: 260px; padding: 12px 14px;
  border-radius: var(--radius, 12px); background: var(--popup-bg);
  border: 1px solid var(--card-border); color: var(--fg); animation: itemIn 0.2s ease both;
}
.drop-add-title { margin: 0 0 4px; font-size: 14px; }
.drop-add-hint { margin: 0 0 8px; font-size: 12px; color: var(--fg-muted); }
.drop-add-addr { font-size: 12px; word-break: break-all; user-select: all; }
</style>
