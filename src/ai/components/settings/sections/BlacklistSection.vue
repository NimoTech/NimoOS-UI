<!--
  SP8-P2b Task 4 — 1:1 port from Vue2 src/views/AI/Settings/sections/BlacklistSection.vue (105 lines).

  [D2 declaration] This section is the only one of 7 sections that consumes settingsStore —
  because Vue2's blacklist state was already in settingsStore.js (the other 6 sections in Vue2
  use component-local data + direct calls to ai.js, this phase keeps it as-is, not doing
  store centralization like P1 Agent section). User decided on 2026-07-28.

  [Logic fix 1] Vue2's loadBlacklist error in mounted is silently swallowed (`catch (e) {}`),
  copied as-is here — no toast on first screen load failure is intentional: this section and
  4 others belong to the same stack group and mount together, 5 sections popping error toasts
  simultaneously would clutter the screen. Empty list state message itself is feedback.
-->
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useToast } from '../../../../stores/toast'
import { apiErrorMessage } from '../../../util/apiError'
import AgentIcon from '../../icons/AgentIcon.vue'

// 1:1 from Vue2 BlacklistSection.vue:56-64. Built-in read-only blacklist, hardcoded on
// frontend for display, actual interception on backend. Order and line breaks copied exactly
// for line-by-line comparison.
const BUILTIN = [
  '**/.ssh/**', '**/.gnupg/**', '**/.pki/**', '**/.aws/**',
  '**/.config/gcloud/**', '**/.docker/config.json',
  '**/*.key', '**/*.pem', '**/*.p12', '**/*.pfx',
  '**/id_rsa*', '**/id_ed25519*', '**/id_ecdsa*',
  '/etc/**', '/root/**', '/proc/**', '/sys/**', '/dev/**', '/boot/**',
  '/usr/**', '/bin/**', '/sbin/**', '/lib/**', '/lib64/**',
  '/var/lib/nimoos/**', '/usr/share/nimoos/**', '/opt/nimoos/**',
]

const { t } = useI18n()
const store = useSettingsStore()
const toast = useToast()

const newPattern = ref('')
const adding = ref(false)

onMounted(() => {
  void store.loadBlacklist().catch(() => { /* Vue2 mounted silently swallows too, see file header comment */ })
})

async function add() {
  const p = newPattern.value.trim()
  if (!p) return
  adding.value = true
  try {
    await store.addBlacklist(p)
    newPattern.value = ''
  } catch (e) {
    toast.show(apiErrorMessage(e, t('aiCfgAddFailed')), 3000, 'danger')
  } finally {
    adding.value = false
  }
}

async function remove(id: string | number) {
  try {
    await store.removeBlacklist(id)
  } catch (e) {
    // Logic fix (final review Fix 2): originally the fallback text here used t('aiCfgDelete')
    // (bare noun "Delete"), which was what the brief originally specified, but final review
    // determined it was inconsistent with existing practice in McpTokensSection.vue:146 /
    // ChannelsSection.vue:223,276 — those three places all use t('aiCfgDeleteFailed') for
    // delete failure fallback ("Delete failed"). Vue2 is not constraining either way (Vue2 just
    // displays e.message bare, possibly empty string), so this is a changeable logic fix, not
    // a violation of 1:1 copy: brief's choice was overridden by final review to match
    // aiCfgDeleteFailed in those other three places.
    toast.show(apiErrorMessage(e, t('aiCfgDeleteFailed')), 3000, 'danger')
  }
}
</script>

<template>
  <div class="set-inner">
    <div class="set-page-head">
      <h1 class="set-h1">{{ t('aiCfgFilesystem') }}</h1>
      <p class="set-desc">{{ t('aiCfgBlacklistDesc') }}</p>
    </div>

    <div class="sk-section">
      <div class="sk-section-head">
        <div class="sk-section-title">{{ t('aiCfgBuiltinReadonly') }}</div>
        <div class="sk-section-hint">{{ BUILTIN.length }}</div>
      </div>
      <div class="sk-section-body">
        <div class="fs-chips">
          <span v-for="(p, i) in BUILTIN" :key="i" class="fs-chip">
            <span class="lk"><AgentIcon name="lock" :size="11" /></span>{{ p }}
          </span>
        </div>
      </div>
    </div>

    <div class="sk-section">
      <div class="sk-section-head">
        <div class="sk-section-title">{{ t('aiCfgYourPatterns') }}</div>
        <div class="sk-section-hint">{{ store.blacklist.length }}</div>
      </div>
      <div class="sk-section-body">
        <div class="set-addrow">
          <input
            v-model="newPattern"
            class="set-input mono"
            maxlength="256"
            :placeholder="t('aiCfgPatternPlaceholder')"
            @keydown.enter="add"
          >
          <button class="set-addbtn" :disabled="!newPattern || adding" @click="add">
            {{ adding ? t('aiCfgAddingPattern') : t('aiCfgAddPattern') }}
          </button>
        </div>
        <div v-if="store.blacklist.length === 0" class="fs-empty">
          {{ t('aiCfgNoCustomPatterns') }}
        </div>
        <div v-for="p in store.blacklist" v-else :key="p.id" class="fs-userrow">
          <span class="pat">{{ p.pattern }}</span>
          <button class="dir-del" :title="t('aiCfgDelete')" @click="remove(p.id)">
            <AgentIcon name="trash" :size="14" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
