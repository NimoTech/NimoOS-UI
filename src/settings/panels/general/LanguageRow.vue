<script setup lang="ts">
// 对位 Vue2 SettingsPanel.vue L119-135。
// **做样子(政策三 / 债务 D6)**:Vue2 从 @/assets/lang 动态枚举出 31 种语言;
// New-UI 目前只有 zh_cn / en_us 两个 locale 文件,所以只列 2 项 —— 归 roadmap §5 的 i18n 全量收口。
// 写入走 locale store 的 persist()(它内部已改接 systemConfig 串行队列),
// 不在这里自己 patch lang —— 两条路径都写同一个字段必然打架。
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { LOCALES, useLocaleStore, type Locale } from '../../../stores/locale'
import SettingsRow from '../../components/SettingsRow.vue'
import '../../styles/settings.css'

const { t, locale } = useI18n()
const localeStore = useLocaleStore()

const LABELS: Record<Locale, string> = { zh_cn: '简体中文', en_us: 'English' }
const current = computed(() => locale.value as Locale)

async function onChange(e: Event) {
  const v = (e.target as HTMLSelectElement).value as Locale
  await localeStore.persist(v)
}
</script>

<template>
  <SettingsRow :label="t('settingsLanguage')">
    <template #control>
      <select class="set-select" :value="current" @change="onChange">
        <option v-for="l in LOCALES" :key="l" :value="l">{{ LABELS[l] }}</option>
      </select>
    </template>
    <template #hint>{{ t('settingsLanguageNa') }}</template>
  </SettingsRow>
</template>
