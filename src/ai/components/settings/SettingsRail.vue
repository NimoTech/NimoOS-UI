<!--
  1:1 ported from Vue2 src/views/AI/Settings/SettingsRail.vue (113 lines).

  Differences (consistent with existing approach in AgentSidebar.vue, not new divergence):
  - `$EventBus` `avatar-changed` subscription (Vue2 :84-95) entire section not ported — New-UI has no
    event bus, shared avatarVersion now provided by Pinia store, see
    `src/stores/userProfile.ts` header comment (complete rationale written there, and why this is
    not a missing feature but moving capability to the correct location). This file and AgentSidebar.vue
    use the same mechanism.
  - `$store.state.user` → New-UI has no reactive user store, directly reads
    `localStorage['user']` (same persistence method as access_token), consistent with AgentSidebar.vue.
  - Avatar URL prefix `/v1/users/avatar?token=` (with leading slash). Vue2 source file
    (:51) has no slash: `'v1/users/avatar?token='`; with hash routing, without the leading
    slash the request would be parsed relative to the current hash route and 404 — this is
    a bug that P1a final review already fixed, follow AgentSidebar.vue version, not reverting to Vue2.
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

// avatarVersion lives in the shared userProfile store (see
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
        <!-- Vue2 :22 uses v-show here — collapsed groups' items must stay in
             the DOM (only hidden via inline `display:none`), because
             settings-styles.scss's narrow-screen override
             (`@media (max-width:720px) { .set-nav-grouphead{display:none}
             .set-nav-groupbody{display:flex!important} }`) relies on that
             `!important` to force every item visible and flatten the rail
             into an icon-only column with no group headers. Swapping this to
             v-if (fix round 1's earlier mistake, reverted) removes collapsed
             items from the DOM entirely, making that CSS rule dead and
             breaking the narrow-screen rail — a real 1:1 visual regression.
             `v-show` is required; the test that assumed v-if semantics was
             the bug, not this template (see SettingsRail.test.ts). -->
        <div v-show="isOpen(g.id)" class="set-nav-groupbody">
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
