<script setup lang="ts">
// Mirrors Vue2 SettingsPanel.vue L119-135.
// **Placeholder (policy 3 / debt D6)**: Vue2 dynamically enumerates 31 languages from @/assets/lang;
// New-UI currently only has two locale files (zh_cn / en_us), so only 2 entries are listed here -- tracked under roadmap §5's full i18n closeout.
// Writes go through the locale store's persist() (internally now routed through the systemConfig serial queue),
// don't patch lang directly here -- both paths writing the same field would inevitably race.
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
