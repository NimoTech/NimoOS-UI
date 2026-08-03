<script setup lang="ts">
// 设置 · 应用 —— 「App 数据存储位置」里的一行。对位 Vue2 SettingsPanel.vue:596-633。
// 形态:左侧标题 + 两个 chip(用量/容量 · 路径),右侧一个"更改存储位置"按钮。
// sizeText/pathText 由父组件(AppsPanel.vue)算好传入 —— 这个组件本身不碰 renderSize/
// toVirtualPath,保持纯展示,避免每行各自重算一遍。
import { useI18n } from 'vue-i18n'
import '../../styles/settings.css'

defineProps<{ label: string; sizeText: string; pathText: string }>()
const emit = defineEmits<{ change: [] }>()
const { t } = useI18n()
</script>

<template>
  <div class="set-app-row">
    <div class="set-app-row-main">
      <div class="set-app-row-label">{{ label }}</div>
      <div class="set-app-chips">
        <span class="set-app-chip">{{ sizeText }}</span>
        <span class="set-app-chip set-app-chip-path">{{ pathText }}</span>
      </div>
    </div>
    <button class="set-app-act" type="button" :title="t('settingsAppsChangeLocation')" @click="emit('change')">
      ⤴
    </button>
  </div>
</template>
