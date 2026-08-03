<script setup lang="ts">
// 对位 Vue2 SettingsPanel.vue L102-116。
// **做样子(政策三 / 债务 D5)**:New-UI 没有壁纸系统(全仓只有 session 里一个
// 登出时清理的 localStorage key),Vue2 那边点 Change 会发 EventBus 打开换壁纸弹窗 ——
// 新 UI 没有那个弹窗的对位物。所以行保留、按钮禁用、下方写明原因。
import { useI18n } from 'vue-i18n'
import SettingsRow from '../../components/SettingsRow.vue'
const { t } = useI18n()
</script>

<template>
  <SettingsRow :label="t('settingsWallpaper')">
    <template #control>
      <button class="set-btn" type="button" disabled>{{ t('settingsWallpaperChange') }}</button>
    </template>
    <template #hint>{{ t('settingsWallpaperNa') }}</template>
  </SettingsRow>
</template>
