<!--
  1:1 移植自 Vue2 src/views/AI/Agent/shell/AgentSidebar.vue(143 行)。
  差异(1a 裁剪 + New-UI 适配):
  - 删除确认:Buefy `$buefy.dialog.confirm` → New-UI `AlertDialog`(destructive)。
    reka-ui 的 AlertDialogAction 点击时 update:open(false) 先于 confirm 事件派发,
    所以 open 与待删 id 打包在同一个 ref 里,v-model:open 只改 .open,confirm
    处理器读 .id 之后再 emit——参照 src/apps/views/InstalledAppsPage.vue:25-70
    记录的 SP5-P1 CRITICAL 教训。
  - `$EventBus` 的 avatar-changed 订阅整段删除(1c 再补,见下方模板注释)。
  - `$store.state.access_token` → `localStorage.getItem('access_token')`;
    `$store.state.user` → New-UI 目前没有专门的响应式 user store,session store
    只是把登录/状态响应体原样落 `localStorage['user']`(与 access_token 同款
    落盘方式,见 src/stores/session.ts:USER),这里直接同口径读取解析,不额外
    发一次 service.users 请求。
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AgentIcon from '../icons/AgentIcon.vue'
import AlertDialog from '../../../components/ui/AlertDialog.vue'
import brandLogo from '../../assets/nimo-ai-logo.png'
import defaultAvatar from '../../assets/default-avatar.svg'

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
}>()

const { t } = useI18n()
const router = useRouter()

const AVATAR_URL = '/v1/users/avatar?token='

const avatarVersion = ref(1)
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
  return `${AVATAR_URL}${token}&v=${avatarVersion.value}`
})

// Fall back to the bundled default avatar when the endpoint is unavailable
// (e.g. the user never set a custom avatar — the backend has no default file
// on disk and returns 404). Mirrors the main OS avatar behaviour.
const avatarSrc = computed(() => (avatarUrl.value && !avatarFailed.value ? avatarUrl.value : defaultAvatar))

function onAvatarError() {
  avatarFailed.value = true
}

// 1c: avatar-changed refresh (Vue2 $EventBus 'avatar-changed' 订阅在这里补回)

function goBack() {
  if (window.history.length > 1) router.go(-1)
  else router.push('/')
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
      <img class="brand-mark" :src="brandLogo" alt="Nimo AI" style="margin: 0 0 14px" />
      <button class="icon-btn" @click="emit('new')"><AgentIcon name="edit" :size="16" /></button>
      <div style="flex: 1" />
      <button class="icon-btn" @click="emit('open-settings')" :title="t('aiSettings')"><AgentIcon name="settings" :size="16" /></button>
    </template>
    <template v-else>
      <div class="sidebar-head">
        <img class="brand-mark" :src="brandLogo" alt="Nimo AI" />
        <div style="flex: 1; min-width: 0">
          <div class="brand-name">Nimo</div>
          <div class="brand-sub">AI · NAS</div>
        </div>
      </div>

      <button class="side-back" @click="goBack" :title="t('aiBack')">
        <AgentIcon name="arrowBack" :size="15" />
        <span>{{ t('aiBack') }}</span>
      </button>

      <button class="new-chat-btn" @click="emit('new')">
        <AgentIcon name="edit" :size="14" />
        <span>{{ t('aiNewConversation') }}</span>
        <span class="kbd">⌘N</span>
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
