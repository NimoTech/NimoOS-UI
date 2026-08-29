<script setup lang="ts">
// Generic frame for each settings tab. Three header forms strictly match Vue2 SettingsPanel.vue L51-56:
//   backTo set → back button (developer); title set → h1 (most tabs); neither → no header (terminal).
import '../styles/settings.css'

defineProps<{ title?: string; backTo?: string }>()
const emit = defineEmits<{ back: [tab: string] }>()
</script>

<template>
  <section class="set-section">
    <header v-if="backTo || title" class="set-section-head">
      <button v-if="backTo" class="set-back" type="button" @click="emit('back', backTo)">
        ‹ {{ title }}
      </button>
      <h1 v-else class="set-section-title">{{ title }}</h1>
    </header>
    <div class="set-section-body"><slot /></div>
  </section>
</template>
