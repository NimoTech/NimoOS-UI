<script setup lang="ts">
// 设置区每个 tab 的通用外框。三种头部形态严格对位 Vue2 SettingsPanel.vue L51-56:
//   backTo 有值 → 返回按钮(developer);title 有值 → h1(多数 tab);都没有 → 无头部(terminal)。
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
