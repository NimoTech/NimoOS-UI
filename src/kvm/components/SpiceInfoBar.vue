<script setup lang="ts">
// SPICE 连接提示条:选中的 VM 已切回硬盘引导(bootFromDisk=true)且有 spicePort 时短暂
// 显示,提示用 virt-viewer 之类的 SPICE 客户端连接体验更好。视觉 1:1 对 Vue2
// components/KVM/KVMFullPage.vue 模板 :156-165 + 样式 :2795-2865(在**第一个、scoped**
// 的 `<style>` 块里,与安装横幅那个在文件末尾的全局块不是同一处)。
//
// 显示条件(state==='running' 之类都不在这里判)、180 秒自动收起的定时器、切换 VM 时的
// 复位,都由父组件(KvmPage)算好——本组件只管"给了就渲染,点了关闭就 emit"。
import { useI18n } from 'vue-i18n'

defineProps<{ hostname: string; spicePort: number; isWindowsGuest: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
</script>

<template>
  <div class="spice-info-bar">
    <div class="spice-info-content">
      <span>{{ t('kvmSpiceHint') }} <code>spice://{{ hostname }}:{{ spicePort }}</code></span>
      <span class="spice-agent-hint">
        {{ t(isWindowsGuest ? 'kvmSpiceAgentWin' : 'kvmSpiceAgentLinux') }}
      </span>
    </div>
    <button
      type="button"
      class="spice-info-close"
      :aria-label="t('kvmClose')"
      @click="emit('close')"
    >
      <!-- × 是单色文字符号占位(禁 emoji),对位 Vue2 b-icon icon="close-outline"。 -->
      <span aria-hidden="true">×</span>
    </button>
  </div>
</template>
