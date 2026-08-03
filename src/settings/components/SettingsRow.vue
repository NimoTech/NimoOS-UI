<script setup lang="ts">
// 设置列表里一行的通用骨架。对位 Vue2 SettingsPanel.vue 的 .settings-list-item:
// 左侧标签(可带副标题)撑开、右侧放控件、可点的整行右端带 ›。
// Vue2 每行左侧还有一个 casa 图标字体的图标(b-icon pack="casa");
// New-UI 没有引入那套图标字体(仍是 CasaOS 品牌资源,见顶层 CLAUDE.md 的 iconfonts-casaos 记债),
// 故本期不渲染行内图标 —— 这是既有的图标体系差异,不是本期新增偏离。
import '../styles/settings.css'

defineProps<{ label: string; sub?: string; clickable?: boolean; disabled?: boolean }>()
const emit = defineEmits<{ click: [] }>()
</script>

<template>
  <div class="set-row-wrap">
    <component
      :is="clickable ? 'button' : 'div'"
      class="set-list-item"
      :class="{ clickable }"
      :type="clickable ? 'button' : undefined"
      :disabled="clickable && disabled ? true : undefined"
      @click="clickable && !disabled && emit('click')"
    >
      <span class="set-row-text">
        <span class="set-row-label">{{ label }}</span>
        <span v-if="sub" class="set-row-sub">{{ sub }}</span>
      </span>
      <span class="set-row-ctl"><slot name="control" /></span>
      <span v-if="clickable" class="set-chevron" aria-hidden="true">›</span>
    </component>
    <p v-if="$slots.hint" class="set-row-hint"><slot name="hint" /></p>
  </div>
</template>
