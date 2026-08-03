<script setup lang="ts">
// 设置区外壳:左 tab rail + 右内容。对位 Vue2 SettingsPanel.vue 的 .settings-sidebar / .settings-content,
// 但容器形态由模态改为路由页(授权偏离 #2,spec §12)。
// 侧栏底部的关机/重启按钮不在 P0 范围 —— 电源流(含 6 个状态浮层)整体归 P1(spec §5.1),
// 此处只留 .set-rail-foot 容器占位,P1 往里填。
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

// 用户信息由登录时写进 localStorage['user'](stores/session.ts setUser)。
// P0 零后端调用,所以只读本地缓存,不发 /v1/users/current。
const user = computed<Record<string, unknown>>(() => {
  try {
    const raw = localStorage.getItem('user')
    const parsed = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {} // 坏 JSON:按无用户处理,不炸整个设置区
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

      <!-- P1 填:关机 / 重启(spec §5.1) -->
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
 * 布局约束(与 storage/components/StorageShell.vue 同源,SP6 实盘验收过):
 * body 全局 overflow:hidden(src/styles/theme.css,桌面端需要,不能改),
 * 所以滚动必须由「受视口约束」的 .set-body 自己承担 —— 外壳必须用 height 而非 min-height,
 * 否则它随内容一起长高、永远量不出溢出,滚动条永不出现。
 * 两行 height 是给不支持 dvh 的旧浏览器兜底,不要合并/删除其中一行。
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
/* Vue2 .sidebar-item.active:透明底 + 主色描边 + 主色字(SettingsPanel.vue L2418-2424) */
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
/* min-height:0 必须写:flex 子项默认 min-height:auto,会阻止收缩到小于内容高度,
 * 导致 overflow-y:auto 失效。 */
.set-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 22px 28px;
}
.set-body > :deep(*) {
  max-width: 980px;
}

/* 窄屏:Vue2 是固定尺寸模态、整文件零 @media,没有可对齐的行为;
 * 按 StorageShell(SP6 已实盘验收)的思路自定 —— rail 收到顶部横向滚动条。
 * 覆盖在授权偏离 #2(模态→路由页)范围内。 */
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
