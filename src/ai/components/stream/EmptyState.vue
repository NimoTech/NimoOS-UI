<!--
  1:1 移植自 Vue2 src/views/AI/Agent/stream/EmptyState.vue。
  SP8-P1b Task 11:@pick 直接 store.send(prompt) —— send() 存在后不再需要
  暂存 pendingPrompt + "coming soon" toast 的占位行为。store 走
  useProvidedAgentStore(),供 Photos 受限 profile 嵌入时解析到正确的祖先 store。
-->
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useProvidedAgentStore } from '../../composables/useProvidedAgentStore'
import AgentIcon from '../icons/AgentIcon.vue'

const { t } = useI18n()
const store = useProvidedAgentStore()

const suggestions = computed(() => [
  {
    icon: 'image', color: 'var(--photos-accent)',
    title: t('aiEmptyFindPhotos'),
    desc: t('aiEmptyFindPhotosExample'),
    prompt: t('aiEmptyFindPhotosPrompt'),
  },
  {
    icon: 'trash', color: 'var(--warning)',
    title: t('aiEmptyCleanDup'),
    desc: t('aiEmptyCleanDupExample'),
    prompt: t('aiEmptyCleanDupPrompt'),
  },
  {
    icon: 'folder', color: 'var(--accent)',
    title: t('aiEmptyOrganize'),
    desc: t('aiEmptyOrganizeExample'),
    prompt: t('aiEmptyOrganizePrompt'),
  },
  {
    icon: 'code', color: 'var(--success)',
    title: t('aiEmptyScript'),
    desc: t('aiEmptyScriptExample'),
    prompt: t('aiEmptyScriptPrompt'),
  },
])

function pick(prompt: string) {
  store.send(prompt)
}
</script>

<template>
  <div class="empty-state">
    <div class="empty-orb" />
    <h1 class="empty-title">{{ t('aiEmptyTitle') }}</h1>
    <p class="empty-sub">{{ t('aiEmptySubtitle') }}</p>
    <div class="suggest-grid">
      <button
        v-for="(s, i) in suggestions"
        :key="i"
        class="suggest-card"
        @click="pick(s.prompt)"
      >
        <div class="suggest-icon" :style="{ background: s.color }">
          <AgentIcon :name="s.icon" :size="16" />
        </div>
        <div class="suggest-text">
          <span class="suggest-title">{{ s.title }}</span>
          <span class="suggest-desc">{{ s.desc }}</span>
        </div>
      </button>
    </div>
  </div>
</template>
