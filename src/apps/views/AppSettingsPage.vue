<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle,
} from 'reka-ui'
import { service, type DockerNetwork } from '@nimotech/nimoos-service'
import AreaShell from '../../components/shell/AreaShell.vue'
import AppsSidebar from '../components/AppsSidebar.vue'
import ComposeSettingsForm from '../components/settings/ComposeSettingsForm.vue'
import YamlEditor from '../components/custom/YamlEditor.vue'
import { useAppSettings } from '../composables/useAppSettings'
import { useInstalledAppsStore } from '../stores/installedApps'
import { useToast } from '../../stores/toast'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const installed = useInstalledAppsStore()
const id = computed(() => String(route.params.name ?? ''))
const s = useAppSettings(id)
const app = computed(() => installed.apps.find((a) => a.id === id.value))

const networks = ref<DockerNetwork[]>([])
const stableTags = ref<Record<string, string | null>>({})

// 表单⇄YAML 逃生口(P6 验收补丁②):默认 form,yamlText 只在切到 yaml tab 时由 toYaml() 现取一次
// (带过表单已做的修改);切回 form 走 replaceFromYaml,失败则不切换、留在 yaml tab 看红条。
const tab = ref<'form' | 'yaml'>('form')
const yamlText = ref('')
function selectTab(next: 'form' | 'yaml') {
  if (next === tab.value) return
  if (next === 'yaml') { yamlText.value = s.toYaml(); tab.value = 'yaml' }
  else if (s.replaceFromYaml(yamlText.value)) tab.value = 'form'
}

onMounted(() => {
  void s.load().then(() => {
    const m = s.model.value
    if (!m) return
    // 逐 service 查 stable tag;非商店应用(如手动导入)返回 null,tag 下拉自动隐藏
    void Promise.all(m.services.map((svc) =>
      service.appstore.stableTag(id.value, svc.name).then((tag) => [svc.name, tag] as const).catch(() => [svc.name, null] as const),
    )).then((entries) => { stableTags.value = Object.fromEntries(entries) })
  })
  if (!installed.apps.length) installed.refresh().catch(() => {})  // 深链直达补一次(标题/图标用)
  service.container.getNetworks().then((n) => { networks.value = n }).catch(() => { networks.value = [] })
})

// 端口冲突先弹窗:保存钮在长表单最底部,顶部红条在视野外,用户看不到(真机验收反馈)。
// 确认后关弹窗,顶部红条 + 端口行标红保留,并滚回红条处。
const conflictDlg = ref(false)
const bannerEl = ref<HTMLElement | null>(null)

async function onSave() {
  const ok = await s.save()
  if (ok) {
    toast.show(t('appsSettingsApplying'), 5000)
    router.push({ name: 'apps' })
  } else if (s.conflicts.value.length) {
    conflictDlg.value = true
  } else {
    toast.show(s.saveError.value || t('appsSettingsSaveFailed'), 5000)
  }
}
function onConflictAck() {
  conflictDlg.value = false
  // scrollIntoView 在 jsdom 未实现,可选链保护
  void nextTick(() => bannerEl.value?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }))
}

// YAML tab 内保存:直接以原文 dry_run→PUT,不经表单弹窗,冲突/其它错误都走 tab 内红条(brief 明确
// 不做表单那套行级标红+弹窗,直接红条即可)。
async function onSaveYaml() {
  const ok = await s.saveYaml(yamlText.value)
  if (ok) {
    toast.show(t('appsSettingsApplying'), 5000)
    router.push({ name: 'apps' })
  }
}
function back() { router.push({ name: 'apps' }) }
</script>

<template>
  <AreaShell :title="t('appsTitle')">
    <!-- yaml-mode:YAML 标签下布局切定高(min-height→height),否则编辑器 height:100% 的分母
         是内容驱动的(编辑器随内容长高、永不内部溢出),滚动条只会出现在整页上 -->
    <div class="apps-layout" :class="{ 'yaml-mode': tab === 'yaml' }">
      <AppsSidebar />
      <main class="apps-main">
        <button class="bar-btn detail-back" type="button" @click="back">‹ {{ t('appsSettingsBack') }}</button>
        <header class="set-head">
          <img v-if="app?.icon" :src="app.icon" alt="" class="set-icon" />
          <h2 class="set-title">{{ app?.title ?? id }} · {{ t('appsSettings') }}</h2>
        </header>

        <p v-if="s.loading.value" class="apps-empty">{{ t('appsSettingsLoading') }}</p>
        <div v-else-if="s.loadError.value" class="apps-empty">
          {{ t('appsSettingsLoadFailed') }}
          <button class="bar-btn" type="button" @click="s.load()">{{ t('appsStoreRetry') }}</button>
        </div>

        <template v-else-if="s.model.value">
          <nav class="settings-tabs" role="tablist">
            <button
              type="button" role="tab" data-test="settings-tab-form"
              :aria-selected="tab === 'form'" :class="{ on: tab === 'form' }"
              @click="selectTab('form')"
            >{{ t('appsSettingsTabForm') }}</button>
            <button
              type="button" role="tab" data-test="settings-tab-yaml"
              :aria-selected="tab === 'yaml'" :class="{ on: tab === 'yaml' }"
              @click="selectTab('yaml')"
            >{{ t('appsSettingsTabYaml') }}</button>
          </nav>

          <template v-if="tab === 'form'">
            <div v-if="s.conflicts.value.length" ref="bannerEl" class="set-conflict" data-test="settings-conflict">
              {{ t('appsSettingsPortConflict', { ports: s.conflicts.value.join(', ') }) }}
            </div>
            <ComposeSettingsForm :model="s.model.value" :conflicts="s.conflicts.value" :networks="networks" :stable-tags="stableTags" />
            <div class="set-actions">
              <button class="bar-btn" type="button" :disabled="s.saving.value" @click="back">{{ t('appsSettingsCancel') }}</button>
              <button class="set-save" type="button" data-test="settings-save" :disabled="s.saving.value" @click="onSave">
                {{ s.saving.value ? t('appsWorking') : t('appsSettingsSave') }}
              </button>
            </div>
          </template>

          <div v-else class="settings-yaml-panel" data-test="settings-yaml-panel">
            <div v-if="s.parseError.value" class="set-conflict" data-test="yaml-parse-error">
              {{ t('appsSettingsYamlParseError') }}{{ s.parseError.value }}
            </div>
            <div v-else-if="s.conflicts.value.length" class="set-conflict" data-test="settings-conflict">
              {{ t('appsSettingsPortConflict', { ports: s.conflicts.value.join(', ') }) }}
            </div>
            <div v-else-if="s.saveError.value" class="set-conflict" data-test="yaml-save-error">{{ s.saveError.value }}</div>
            <YamlEditor v-model="yamlText" class="settings-yaml-editor" />
            <div class="set-actions">
              <button class="bar-btn" type="button" :disabled="s.saving.value" @click="back">{{ t('appsSettingsCancel') }}</button>
              <button class="set-save" type="button" data-test="settings-yaml-save" :disabled="s.saving.value" @click="onSaveYaml">
                {{ s.saving.value ? t('appsWorking') : t('appsSettingsYamlSave') }}
              </button>
            </div>
          </div>
        </template>
      </main>
    </div>

    <DialogRoot :open="conflictDlg" @update:open="(v) => { if (!v) onConflictAck() }">
      <DialogPortal>
        <DialogOverlay class="cfl-overlay" />
        <DialogContent class="cfl-content" data-test="settings-conflict-dlg">
          <DialogTitle class="cfl-title">{{ t('appsSettingsPortConflictTitle') }}</DialogTitle>
          <p class="cfl-body">{{ t('appsSettingsPortConflict', { ports: s.conflicts.value.join(', ') }) }}</p>
          <div class="cfl-footer">
            <button class="cfl-btn primary" type="button" data-test="settings-conflict-ok" @click="onConflictAck">
              {{ t('appsSettingsConflictOk') }}
            </button>
          </div>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  </AreaShell>
</template>

<style scoped>
.apps-layout { display: flex; gap: 16px; align-items: flex-start; min-height: 100%; }
.apps-main { flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; }
/* YAML 标签:定高布局,编辑器占满剩余空间在内部滚(表单标签保持整页文档式滚动不受影响) */
.apps-layout.yaml-mode { height: 100%; }
.apps-layout.yaml-mode .apps-main { min-height: 0; }
.detail-back { font-size: 13px; margin-bottom: 14px; }
.apps-empty { color: var(--fg-muted); font-size: 14px; padding: 24px 8px; }
.set-head { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.set-icon { width: 44px; height: 44px; border-radius: 11px; object-fit: contain; }
.set-title { font-size: 18px; font-weight: 600; margin: 0; color: var(--fg); }
.settings-tabs { display: flex; gap: 6px; margin-bottom: 14px; }
.settings-tabs button {
  padding: 5px 16px; border-radius: 9px; border: 1px solid var(--card-border);
  background: transparent; color: var(--fg-muted); cursor: pointer; font-size: 13px;
}
.settings-tabs button.on { background: var(--chip-bg-hi); color: var(--fg); }
.settings-yaml-panel { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: 12px; }
.settings-yaml-editor { flex: 1 1 auto; min-height: 320px; }
.set-conflict {
  /* 全仓库其它「危险/冲突」提示均用半透明 --drop-bad 当底 + --remove-fg 当字(见 GridGhost.vue .bad、
     UploadPanel.vue 等)——brief 原稿写的 background: var(--remove-bg) 与本行 color 撞色(两者色相/明度
     接近,深色主题下几乎不出对比度),改用 --drop-bad 保持可读,同为 token,不算新增字面量色。 */
  margin-bottom: 14px; padding: 10px 14px; font-size: 13px; border-radius: var(--radius);
  color: var(--remove-fg); background: var(--drop-bad); border: 1px solid var(--remove-fg);
}
.set-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
/* YAML 标签:按钮栏与编辑器的间距只留面板 gap(12px),多出的 margin 让给编辑器高度 */
.settings-yaml-panel .set-actions { margin-top: 0; }
.set-save { font-size: 13.5px; padding: 8px 24px; cursor: pointer; color: var(--on-accent); background: var(--accent); border: none; border-radius: 10px; }
.set-save:hover { filter: brightness(1.08); }
.set-save:disabled { opacity: 0.55; cursor: default; filter: none; }
@media (max-width: 768px) { .apps-layout { gap: 0; } }

/* 端口冲突确认弹窗(PreInstallTips pit-* 同款;scoped 经 Portal 仍生效,data-v 随模板 vnode 走) */
.cfl-overlay { position: fixed; inset: 0; background: var(--overlay-bg); backdrop-filter: var(--overlay-blur); z-index: 1000; }
.cfl-content {
  position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1001;
  min-width: 320px; max-width: min(480px, 92vw); padding: 20px; border-radius: 18px;
  background: var(--popup-bg); border: 1px solid var(--card-border); backdrop-filter: blur(20px);
  color: var(--fg); box-shadow: var(--card-shadow-hi);
}
.cfl-title { font-size: 16px; font-weight: 600; margin: 0 0 10px; color: var(--remove-fg); }
.cfl-body { font-size: 13.5px; line-height: 1.7; margin: 0; color: var(--fg); overflow-wrap: anywhere; }
.cfl-footer { display: flex; justify-content: flex-end; margin-top: 18px; }
.cfl-btn { padding: 7px 20px; border-radius: 999px; border: 1px solid var(--chip-border); background: var(--chip-bg); color: var(--fg); cursor: pointer; font-size: 13px; }
.cfl-btn.primary { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
</style>
