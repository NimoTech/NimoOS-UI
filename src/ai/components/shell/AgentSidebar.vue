<!--
  1:1 port from Vue2 src/views/AI/Agent/shell/AgentSidebar.vue (143 lines).
  Differences (1a trim + New-UI adaptation):
  - Delete confirmation: Buefy `$buefy.dialog.confirm` → New-UI `AlertDialog` (destructive).
    Reka-ui's AlertDialogAction emits update:open(false) before the confirm event, so open and
    the to-be-deleted id are bundled in the same ref; v-model:open only changes .open, and the
    confirm handler reads .id before emitting — see the SP5-P1 CRITICAL lesson recorded in
    src/apps/views/InstalledAppsPage.vue:25-70.
  - `$EventBus` avatar-changed subscription removed entirely (to be added back in 1c; see
    template comment below).
  - `$store.state.access_token` → `localStorage.getItem('access_token')`;
    `$store.state.user` → New-UI currently has no dedicated reactive user store; the session
    store simply persists the login/status response body as-is to `localStorage['user']` (same
    persistence method as access_token; see src/stores/session.ts:USER), so here we directly
    read and parse using the same channel without making an additional service.users request.
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AgentIcon from '../icons/AgentIcon.vue'
import AlertDialog from '../../../components/ui/AlertDialog.vue'
import defaultAvatar from '../../assets/default-avatar.svg'
import { useUserProfile } from '../../../stores/userProfile'

export interface AgentSidebarSession {
  id: string | number
  title?: string | null
  snippet?: string | null
}

withDefaults(
  defineProps<{
    sessions: AgentSidebarSession[]
    activeId?: string | number | null
    collapsed?: boolean
  }>(),
  {
    sessions: () => [],
    activeId: null,
    collapsed: false,
  },
)

const emit = defineEmits<{
  (e: 'new'): void
  (e: 'select', id: string | number): void
  (e: 'delete', id: string | number): void
  (e: 'open-settings'): void
  (e: 'open-tasks'): void
}>()

const { t } = useI18n()
const router = useRouter()

const AVATAR_URL = '/v1/users/avatar?token='

// SP8-P1c2 Task 7: avatarVersion moved out of local state into useUserProfile
// (see src/stores/userProfile.ts for the full rationale). This sidebar is now
// just one consumer of the shared version — bumping it from anywhere (e.g. a
// future account panel's upload-success handler) recomputes avatarUrl below.
const userProfile = useUserProfile()
// avatarFailed stays local: it is this one <img>'s load-failure state, not
// shared profile data — every avatar instance tracks its own load outcome.
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

const displayName = computed(() => user.value.nickname || user.value.username || 'User')
const userMeta = computed(() => user.value.role || 'NimoOS')

const avatarUrl = computed(() => {
  const token = localStorage.getItem('access_token')
  if (!token) return ''
  return `${AVATAR_URL}${token}&v=${userProfile.avatarVersion}`
})

// Fall back to the bundled default avatar when the endpoint is unavailable
// (e.g. the user never set a custom avatar — the backend has no default file
// on disk and returns 404). Mirrors the main OS avatar behaviour.
const avatarSrc = computed(() => (avatarUrl.value && !avatarFailed.value ? avatarUrl.value : defaultAvatar))

function onAvatarError() {
  avatarFailed.value = true
}

// No 'avatar-changed' subscription here (unlike Vue2's $EventBus version):
// New-UI has no event bus, and no account/avatar UI to change it from yet —
// the only place to change an avatar today is the old Vue2 app, a separate
// page load, so a live cross-app refresh isn't possible and isn't worth
// inventing a channel for. Instead, avatarUrl above reads userProfile's
// shared avatarVersion (src/stores/userProfile.ts); when New-UI gets its own
// account panel, its upload-success handler calls bumpAvatarVersion() and
// this (and every other) avatar refreshes automatically. Changing the
// avatar in the *old* app only shows up here after a page reload — that's
// expected, not a bug (see the store's comment for why).

// The single "back" entry for the whole agent shell (the topbar used to have a
// second one; both were merged here, at the top-left). The Agent page is opened
// in a new tab from the home launcher, so the tab's history may not include
// `/`. Try a router push first; if there's no history (we were the entry
// point) fall back to a hard navigation so the back button always works.
function goBack() {
  if (window.history.length > 1 && router.currentRoute.value.path !== '/') {
    router.push('/').catch(() => { window.location.href = '/' })
  } else {
    // No history to pop (opened fresh from the launcher in a new tab): hard-navigate
    // to the site root, which this app now owns directly.
    window.location.href = '/'
  }
}

const deleteDlg = ref<{ open: boolean; id: string | number | null }>({ open: false, id: null })

function requestDelete(id: string | number) {
  deleteDlg.value = { open: true, id }
}

function onDeleteConfirm() {
  const id = deleteDlg.value.id
  if (id !== null) emit('delete', id)
}
</script>

<template>
  <aside class="sidebar" :class="{ collapsed }">
    <template v-if="collapsed">
      <button class="side-back side-back-rail" data-test="back" @click="goBack" :title="t('aiBack')">
        <AgentIcon name="arrowBack" :size="16" />
      </button>
      <button class="icon-btn" @click="emit('new')"><AgentIcon name="edit" :size="16" /></button>
      <!-- Vue2 AgentSidebar.vue:6 — the collapsed rail's scheduled-tasks entry. -->
      <button class="icon-btn" :title="t('aiTasksTitle')" data-test="open-tasks" @click="emit('open-tasks')">
        <AgentIcon name="clock" :size="16" />
      </button>
      <div style="flex: 1" />
      <button class="icon-btn" @click="emit('open-settings')" :title="t('aiSettings')"><AgentIcon name="settings" :size="16" /></button>
    </template>
    <template v-else>
      <button class="side-back" data-test="back" @click="goBack" :title="t('aiBack')">
        <AgentIcon name="arrowBack" :size="15" />
        <span>{{ t('aiBack') }}</span>
      </button>

      <button class="new-chat-btn" @click="emit('new')">
        <AgentIcon name="edit" :size="14" />
        <span>{{ t('aiNewConversation') }}</span>
        <span class="kbd">⌘N</span>
      </button>

      <!-- Vue2 AgentSidebar.vue:30-33 — the expanded rail's scheduled-tasks entry. -->
      <button class="side-nav-btn" data-test="open-tasks" @click="emit('open-tasks')">
        <AgentIcon name="clock" :size="14" />
        <span>{{ t('aiTasksTitle') }}</span>
      </button>

      <div class="sidebar-section-label">Sessions</div>
      <div class="chat-list scroll">
        <div
          v-for="s in sessions"
          :key="s.id"
          class="chat-item"
          :data-active="s.id === activeId"
          @click="emit('select', s.id)"
        >
          <div class="chat-item-title">{{ s.title || t('aiUntitled') }}</div>
          <div class="chat-item-snippet">{{ s.snippet || '' }}</div>
          <button
            class="icon-btn delete-btn"
            style="position: absolute; right: 8px; top: 8px; width: 22px; height: 22px"
            @click.stop="requestDelete(s.id)"
          >
            <AgentIcon name="trash" :size="12" />
          </button>
        </div>
        <div
          v-if="sessions.length === 0"
          style="padding: 16px; text-align: center; font-size: 12px; color: var(--text-tertiary)"
        >
          {{ t('aiNoConversations') }}
        </div>
      </div>

      <div class="sidebar-foot">
        <div class="avatar">
          <img :src="avatarSrc" :alt="displayName" @error="onAvatarError" />
        </div>
        <div style="flex: 1; min-width: 0">
          <div class="user-name">{{ displayName }}</div>
          <div class="user-meta">{{ userMeta }}</div>
        </div>
        <button class="icon-btn" @click="emit('open-settings')" :title="t('aiSettings')">
          <AgentIcon name="settings" :size="15" />
        </button>
      </div>
    </template>

    <AlertDialog
      v-model:open="deleteDlg.open"
      :title="t('aiConfirm')"
      :message="t('aiDeleteSessionConfirm')"
      :confirm-text="t('aiConfirm')"
      :cancel-text="t('aiCancel')"
      destructive
      @confirm="onDeleteConfirm"
    />
  </aside>
</template>

<style scoped>
.chat-item:hover .delete-btn { opacity: 1; }
.chat-item .delete-btn { opacity: 0; transition: opacity 120ms; }
</style>
