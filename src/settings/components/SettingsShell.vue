<script setup lang="ts">
// Settings area shell: left tab rail + right content. Counterpart of Vue2 SettingsPanel.vue's
// .settings-sidebar / .settings-content, but the container changed from modal to routed page (authorized deviation #2, spec §12).
// The shutdown/restart buttons at the rail bottom are out of P0 scope — the power flow (incl. 6 status overlays)
// belongs to P1 as a whole (spec §5.1); only the .set-rail-foot placeholder container is left here, filled in P1.
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { railTabsFor, TAB_LABEL_KEY, type SettingsTab } from '../util/tabs'
import PowerFlow from './PowerFlow.vue'
import '../styles/settings.css'

defineProps<{ current: SettingsTab }>()
const emit = defineEmits<{ select: [tab: SettingsTab] }>()

const router = useRouter()
const { t } = useI18n()

// User info is written to localStorage['user'] at login (stores/session.ts setUser).
// P0 makes zero backend calls, so only read the local cache; no /v1/users/current request.
const user = computed<Record<string, unknown>>(() => {
  try {
    const raw = localStorage.getItem('user')
    const parsed = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {} // Bad JSON: treat as no user, don't blow up the whole settings area
  }
})

// Vue2 L18: nickname || username || 'admin'
const userName = computed(() => {
  const nick = user.value.nickname
  const name = user.value.username
  if (typeof nick === 'string' && nick) return nick
  if (typeof name === 'string' && name) return name
  return 'admin'
})
const initial = computed(() => userName.value.slice(0, 1).toUpperCase())
const railTabs = computed(() =>
  railTabsFor(typeof user.value.role === 'string' ? user.value.role : undefined),
)
</script>

<template>
  <div class="settings-shell">
    <aside class="set-rail">
      <button class="set-user" type="button" @click="emit('select', 'account')">
        <span class="set-user-avatar" aria-hidden="true">{{ initial }}</span>
        <span class="set-user-name">{{ userName }}</span>
      </button>

      <nav class="set-rail-list">
        <button
          v-for="tab in railTabs"
          :key="tab"
          class="set-rail-item"
          :class="{ active: tab === current }"
          :data-tab="tab"
          type="button"
          @click="emit('select', tab)"
        >
          {{ t(TAB_LABEL_KEY[tab]) }}
        </button>
      </nav>

      <!-- Filled in P1: shutdown / restart (spec §5.1) -->
      <div class="set-rail-foot"><PowerFlow /></div>
    </aside>

    <div class="set-main">
      <header class="set-bar">
        <button class="set-home" type="button" @click="router.push('/')">
          ‹ {{ t('areaBackHome') }}
        </button>
        <h1 class="set-title">{{ t('settingsTitle') }}</h1>
      </header>
      <main class="set-body"><slot /></main>
    </div>
  </div>
</template>

<style scoped>
/*
 * Layout constraint (same origin as storage/components/StorageShell.vue, verified on device in SP6):
 * body has global overflow:hidden (src/styles/theme.css, needed for desktop, cannot change),
 * so scrolling must be handled by the viewport-constrained .set-body itself — the shell must use
 * height, not min-height, otherwise it grows with content, overflow is never measured, and the
 * scrollbar never appears.
 * The two height lines are a fallback for old browsers without dvh support; do not merge/delete either line.
 */
.settings-shell {
  height: 100vh;
  height: 100dvh;
  display: flex;
  background: var(--bg);
  color: var(--fg);
}

.set-rail {
  flex: 0 0 200px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 18px 12px;
  background: var(--set-rail-bg);
  border-right: 1px solid var(--set-rail-border);
  overflow-y: auto;
}
.set-user {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px;
  margin-bottom: 18px;
  border: 0;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--fg);
  font: inherit;
  cursor: pointer;
  text-align: left;
}
.set-user:hover {
  background: var(--hover);
}
.set-user-avatar {
  flex: 0 0 36px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-soft);
  color: var(--accent-text);
  font-size: 15px;
  font-weight: 600;
}
.set-user-name {
  font-size: 15px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.set-rail-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.set-rail-item {
  padding: 9px 12px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--fg-muted);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
  text-align: left;
}
.set-rail-item:hover {
  background: var(--hover);
  color: var(--fg);
}
/* Vue2 .sidebar-item.active: transparent background + accent border + accent text (SettingsPanel.vue L2418-2424) */
.set-rail-item.active {
  background: transparent;
  border-color: var(--accent);
  color: var(--accent-text);
  font-weight: 500;
}
.set-rail-foot {
  margin-top: auto;
}

.set-main {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.set-bar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 22px;
  flex: 0 0 auto;
}
.set-home {
  border: 1px solid var(--chip-border);
  background: var(--chip-bg);
  color: var(--fg);
  border-radius: 999px;
  padding: 6px 14px;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  font-family: inherit;
}
.set-home:hover {
  background: var(--chip-bg-hi);
}
.set-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}
/* min-height:0 is required: flex children default to min-height:auto, which prevents
 * shrinking below content height and breaks overflow-y:auto. */
.set-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 22px 28px;
}
.set-body > :deep(*) {
  max-width: 980px;
}

/* Narrow screens: Vue2 was a fixed-size modal with zero @media in the whole file — no behavior to align with;
 * designed after StorageShell (device-verified in SP6) — the rail collapses into a top horizontal scroller.
 * Covered by authorized deviation #2 (modal → routed page). */
@media (max-width: 768px) {
  .settings-shell {
    flex-direction: column;
  }
  .set-rail {
    flex: 0 0 auto;
    padding: 10px 12px;
    border-right: 0;
    border-bottom: 1px solid var(--set-rail-border);
  }
  .set-user {
    margin-bottom: 10px;
  }
  .set-rail-list {
    flex-direction: row;
    gap: 6px;
    overflow-x: auto;
    /* The tabs are cut off mid-word at 420px. They do scroll, but with no
       affordance it reads as broken rather than scrollable. A right-edge fade
       shows there is more; the opaque stop below is a mask channel value, not a
       visible colour, so it is skin-independent and needs no token. */
    /* theme-exception: mask channel value, skin-independent */
    mask-image: linear-gradient(to right, #000 calc(100% - 24px), transparent 100%);
    /* theme-exception: mask channel value, skin-independent */
    -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 24px), transparent 100%);
  }
  .set-rail-item {
    white-space: nowrap;
  }
  .set-bar {
    padding: 10px 14px;
  }
  .set-body {
    padding: 4px 14px 20px;
  }
}
</style>
