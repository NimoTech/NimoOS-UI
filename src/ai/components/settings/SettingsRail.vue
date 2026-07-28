<!--
  SP8-P2a Task 7 —— 1:1 移植自 Vue2 src/views/AI/Settings/SettingsRail.vue(113 行)。

  差异(与 AgentSidebar.vue 的既有口径一致,非新偏离):
  - `$EventBus` 的 `avatar-changed` 订阅(Vue2 :84-95)整段不移植 —— New-UI 没有
    事件总线,共享的 avatarVersion 改由 Pinia store 提供,见
    `src/stores/userProfile.ts` 头注释(那里写了完整理由,以及为什么这不是
    功能缺失而是把能力挪到了正确的位置)。本文件与 AgentSidebar.vue 用的是
    同一套机制。
  - `$store.state.user` → New-UI 没有响应式 user store,直接读
    `localStorage['user']`(与 access_token 同款落盘方式),与 AgentSidebar.vue
    同口径。
  - 头像 URL 前缀 `/v1/users/avatar?token=`(带前导斜杠)。Vue2 源文件
    (:51)是不带斜杠的 `'v1/users/avatar?token='`;本仓挂在 `/app/` 基座下,
    不带斜杠会把请求解析成相对于当前路由的路径而 404 —— 这是 P1a 终审已经
    修过的坑,照 AgentSidebar.vue 的版本,不照 Vue2 改回去。
-->
<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AgentIcon from '../icons/AgentIcon.vue'
import defaultAvatar from '../../assets/default-avatar.svg'
import { useUserProfile } from '../../../stores/userProfile'
import { GROUPS, groupOf, type SectionId } from './sections'

const props = withDefaults(
  defineProps<{ activeId: string; modelCount?: number | null }>(),
  { modelCount: null },
)

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'select', id: SectionId): void
}>()

const { t } = useI18n()

const AVATAR_URL = '/v1/users/avatar?token='

// Start with the active section's group expanded, others collapsed
// (Vue2 data(): `expanded[groupOf(this.activeId).id] = true`).
const expanded = ref<Record<string, boolean>>({ [groupOf(props.activeId).id]: true })

function isOpen(gid: string) {
  return !!expanded.value[gid]
}

function toggleGroup(gid: string) {
  expanded.value[gid] = !expanded.value[gid]
}

function onSelect(item: { id: SectionId }) {
  emit('select', item.id)
}

// Whenever the active section changes (click, deep-link or scroll-spy),
// make sure its group is expanded so the highlight is visible — only
// expand, never collapse the others (Vue2 watch `activeId` :96-102).
watch(
  () => props.activeId,
  (id) => {
    const gid = groupOf(id).id
    if (!expanded.value[gid]) expanded.value[gid] = true
  },
)

// SP8-P1c2 Task 7: avatarVersion lives in the shared userProfile store (see
// its header comment for the full rationale) instead of local component
// state — bumping it from anywhere recomputes avatarUrl below.
const userProfile = useUserProfile()
// avatarFailed stays local: it is this one <img>'s load-failure state, not
// shared profile data.
const avatarFailed = ref(false)

interface StoredUser { nickname?: string; username?: string; role?: string }

const user = computed<StoredUser>(() => {
  try {
    const raw = localStorage.getItem('user')
    return raw ? (JSON.parse(raw) as StoredUser) : {}
  } catch {
    return {}
  }
})

const userLabel = computed(() => user.value.nickname || user.value.username || t('aiCfgYou'))
const userMeta = computed(() => user.value.role || t('aiCfgLocalAccount'))

const avatarUrl = computed(() => {
  const token = localStorage.getItem('access_token')
  if (!token) return ''
  return `${AVATAR_URL}${token}&v=${userProfile.avatarVersion}`
})

const avatarSrc = computed(() => (avatarUrl.value && !avatarFailed.value ? avatarUrl.value : defaultAvatar))

function onAvatarError() {
  avatarFailed.value = true
}
</script>

<template>
  <aside class="set-rail">
    <div class="set-rail-head">
      <a class="set-rail-back" :title="t('aiCfgBackToNimo')" @click="emit('back')">
        <span style="transform: scaleX(-1); display: inline-flex">
          <AgentIcon name="chev" :size="14" color="currentColor" />
        </span>
      </a>
      <div style="flex: 1; min-width: 0" class="txt">
        <div class="set-rail-title">{{ t('aiCfgPersonalize') }}</div>
        <div class="set-rail-sub">Nimo · NAS</div>
      </div>
    </div>
    <nav class="set-nav">
      <div v-for="g in GROUPS" :key="g.id" class="set-nav-group">
        <button class="set-nav-grouphead" :data-open="isOpen(g.id) ? 'true' : 'false'"
                @click="toggleGroup(g.id)">
          <span class="set-nav-grouptt">{{ t(g.labelKey) }}</span>
          <span class="set-nav-chev"><AgentIcon name="chev" :size="13" /></span>
        </button>
        <!-- Vue2 :22 uses v-show here (items stay in the DOM, hidden via
             inline style) so the narrow-screen override in settings-styles.scss
             (`@media (max-width:720px) .set-nav-groupbody{display:flex!important}`)
             can force every item visible regardless of expand state. This repo's
             canonical Task 7 test suite ("点分区 emit select") asserts that
             `.set-nav-item` queries only return the currently-open group's
             items, which only holds with conditional rendering — so this uses
             v-if instead. Concrete, documented trade-off: on narrow screens the
             icon-only rail will only show the initially-active group's items,
             not every item, until that group is opened. Flagged in the task
             report; not a "Vue2 bug fix", a rendering-strategy choice forced by
             the given test contract. -->
        <div v-if="isOpen(g.id)" class="set-nav-groupbody">
          <a v-for="item in g.items" :key="item.id"
             class="set-nav-item"
             :data-active="item.id === activeId ? 'true' : 'false'"
             @click="onSelect(item)">
            <span class="ico"><AgentIcon :name="item.icon" :size="16" /></span>
            <span>{{ t(item.labelKey) }}</span>
            <span v-if="item.id === 'models' && modelCount" class="set-nav-badge">{{ modelCount }}</span>
          </a>
        </div>
      </div>
    </nav>
    <div class="set-foot">
      <span class="ava">
        <img :src="avatarSrc" :alt="userLabel" @error="onAvatarError" />
      </span>
      <div class="txt" style="flex: 1; min-width: 0">
        <div class="nm">{{ userLabel }}</div>
        <div class="sub">{{ userMeta }}</div>
      </div>
    </div>
  </aside>
</template>
