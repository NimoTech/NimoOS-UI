<script setup lang="ts">
// P0 空骨架 + developer 入口行。
// Vue2 (SettingsPanel.vue L314-321) 把「开发者模式」做成 general 页最后一行,常驻可见、
// 无任何开关门控 —— spec §4.1 写「只在开发者模式开启后出现」与源码不符,此处以源码为准。
// general 的真实内容(设备信息卡/壁纸/语言/时区/磁盘待机/端口/更新/关机重启…)见 spec §5.1,P1 填。
import { useI18n } from 'vue-i18n'
import SettingsSection from '../components/SettingsSection.vue'
const { t } = useI18n()
const emit = defineEmits<{ 'open-tab': [tab: string] }>()
</script>

<template>
  <SettingsSection :title="t('settingsTabGeneral')">
    <div class="set-skeleton">{{ t('settingsSkeletonHint') }}</div>
    <button class="set-dev-entry" type="button" @click="emit('open-tab', 'developer')">
      <span>{{ t('settingsTabDeveloper') }}</span>
      <span class="set-dev-chevron" aria-hidden="true">›</span>
    </button>
  </SettingsSection>
</template>

<style scoped>
.set-dev-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--card-bg);
  color: var(--fg);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
  text-align: left;
}
.set-dev-entry:hover {
  background: var(--hover);
}
.set-dev-chevron {
  color: var(--fg-faint);
}
</style>
