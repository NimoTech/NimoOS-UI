<!-- src/files/drop/components/DropCenter.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { dropAsset } from '../dropIcons'
const { t } = useI18n()
</script>

<template>
  <div class="drop-center">
    <img class="drop-center-ic" :src="dropAsset('drop_icon')" alt="" />
    <p class="drop-center-hint">{{ t('filesDropHint') }}</p>
  </div>
</template>

<style scoped>
.drop-center {
  position: absolute; left: 50%; bottom: 40px; transform: translateX(-50%);
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  pointer-events: none; opacity: 0.85;
}
.drop-center-ic { width: 48px; height: 48px; }
.drop-center-hint { margin: 0; font-size: 13px; color: var(--fg-muted); }
</style>
