<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AreaShell from '../../components/shell/AreaShell.vue'
import AppsSidebar from '../components/AppsSidebar.vue'
import YamlEditor from '../components/custom/YamlEditor.vue'
import { useCustomInstall } from '../composables/useCustomInstall'
import { ensureComposeMeta, normalizeVolumes, dockerRunToCompose } from '../util/importNormalize'
import { useToast } from '../../stores/toast'

type TabKey = 'yaml' | 'import' | 'link'
const TABS: TabKey[] = ['yaml', 'import', 'link']

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { validateYaml, installYaml } = useCustomInstall()

// 单一事实源=路由 query,深链可达(?tab=yaml|import|link,默认 yaml)
const tab = computed<TabKey>(() => {
  const q = route.query.tab
  return typeof q === 'string' && (TABS as string[]).includes(q) ? (q as TabKey) : 'yaml'
})
function setTab(k: TabKey) {
  router.replace({ query: { ...route.query, tab: k === 'yaml' ? undefined : k } })
}

// ── tab1:YAML 编辑安装 ──
const yamlText = ref('')
const yamlBusy = ref(false)
const yamlError = ref<{ message: string; ports?: string[] } | null>(null)

async function onValidate() {
  if (yamlBusy.value) return
  yamlError.value = null
  yamlBusy.value = true
  try {
    const res = await validateYaml(yamlText.value)
    if (res.ok) toast.show(t('appsCustomValidateOk'))
    else yamlError.value = { message: res.message, ports: res.ports }
  } finally {
    yamlBusy.value = false
  }
}
async function onInstall() {
  if (yamlBusy.value) return
  yamlError.value = null
  yamlBusy.value = true
  try {
    const res = await installYaml(yamlText.value)
    if (res.ok) router.push('/apps') // 进 /apps 看安装进度卡
    else yamlError.value = { message: res.message, ports: res.ports }
  } finally {
    yamlBusy.value = false
  }
}

// ── tab2:docker run 命令导入 ──
const dockerCmd = ref('')
const convertError = ref('')

function onConvert() {
  convertError.value = ''
  try {
    const composeRaw = dockerRunToCompose(dockerCmd.value)
    // 先取一次派生名(供 normalizeVolumes 的 appName 用);最终 meta(name/title/icon)注入
    // 在 volumes 归一化之后再做一遍,确保注入落在最终产出的 YAML 上。
    const { name } = ensureComposeMeta(composeRaw)
    const normalized = normalizeVolumes(composeRaw, name)
    const { yaml } = ensureComposeMeta(normalized)
    yamlText.value = yaml
    setTab('yaml')
  } catch (e) {
    convertError.value = e instanceof Error ? e.message : String(e)
  }
}
</script>

<template>
  <AreaShell :title="t('appsTitle')">
    <div class="apps-layout">
      <AppsSidebar />
      <main class="apps-main">
        <div class="custom-tabs" role="tablist">
          <button
            type="button" class="custom-tab" data-test="tab-yaml"
            :class="{ active: tab === 'yaml' }" @click="setTab('yaml')"
          >{{ t('appsCustomTabYaml') }}</button>
          <button
            type="button" class="custom-tab" data-test="tab-import"
            :class="{ active: tab === 'import' }" @click="setTab('import')"
          >{{ t('appsCustomTabImport') }}</button>
          <button
            type="button" class="custom-tab" data-test="tab-link"
            :class="{ active: tab === 'link' }" @click="setTab('link')"
          >{{ t('appsCustomTabLink') }}</button>
        </div>

        <section v-if="tab === 'yaml'" class="custom-panel" data-test="panel-yaml">
          <YamlEditor v-model="yamlText" class="custom-editor" />
          <div v-if="yamlError" class="custom-error" data-test="yaml-error">
            <p>{{ yamlError.message }}</p>
            <p v-if="yamlError.ports?.length">{{ t('appsInstallPortConflict', { ports: yamlError.ports.join(', ') }) }}</p>
          </div>
          <div class="custom-actions">
            <button
              type="button" class="bar-btn" data-test="custom-validate"
              :disabled="yamlBusy" @click="onValidate"
            >{{ t('appsCustomValidate') }}</button>
            <button
              type="button" class="custom-install-btn" data-test="custom-install"
              :disabled="yamlBusy" @click="onInstall"
            >{{ t('appsCustomInstall') }}</button>
          </div>
        </section>

        <section v-else-if="tab === 'import'" class="custom-panel" data-test="panel-import">
          <p class="custom-hint">{{ t('appsCustomImportHint') }}</p>
          <textarea
            v-model="dockerCmd" class="custom-textarea" data-test="custom-import-textarea"
            :placeholder="t('appsCustomImportPlaceholder')" rows="6"
          ></textarea>
          <div v-if="convertError" class="custom-error" data-test="convert-error">
            {{ t('appsCustomConvertFail') }}: {{ convertError }}
          </div>
          <div class="custom-actions">
            <button type="button" class="custom-install-btn" data-test="custom-convert" @click="onConvert">
              {{ t('appsCustomConvert') }}
            </button>
          </div>
        </section>

        <section v-else class="custom-panel" data-test="tab-link-panel">
          <div data-test="tab-link" class="custom-hint">{{ t('appsCustomLinkComingSoon') }}</div>
        </section>
      </main>
    </div>
  </AreaShell>
</template>

<style scoped>
.apps-layout { display: flex; gap: 16px; align-items: flex-start; min-height: 100%; }
.apps-main { flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; }

.custom-tabs { display: flex; gap: 6px; margin-bottom: 14px; }
.custom-tab {
  font-size: 13px; padding: 7px 16px; cursor: pointer; color: var(--fg);
  background: var(--chip-bg); border: 1px solid var(--card-border); border-radius: 999px;
}
.custom-tab.active { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }

.custom-panel { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: 12px; }
.custom-editor { flex: 1 1 auto; min-height: 320px; }
.custom-hint { color: var(--fg-muted); font-size: 13px; margin: 0; }
.custom-textarea {
  width: 100%; box-sizing: border-box; resize: vertical; font-family: var(--font-mono, monospace);
  font-size: 13px; padding: 10px 12px; color: var(--fg); background: var(--chip-bg);
  border: 1px solid var(--card-border); border-radius: var(--radius); outline: none;
}
.custom-textarea::placeholder { color: var(--fg-muted); }
.custom-textarea:focus { border-color: var(--accent-soft-bd); }

.custom-error {
  /* 同 AppSettingsPage .set-conflict:半透明 --drop-bad 底 + --remove-fg 字,统一「冲突/失败」视觉语言 */
  padding: 10px 14px; font-size: 13px; border-radius: var(--radius);
  color: var(--remove-fg); background: var(--drop-bad); border: 1px solid var(--remove-fg);
}
.custom-error p { margin: 0; }
.custom-error p + p { margin-top: 4px; }

.custom-actions { display: flex; justify-content: flex-end; gap: 10px; }
.custom-install-btn {
  font-size: 13.5px; padding: 8px 24px; cursor: pointer; color: var(--on-accent);
  background: var(--accent); border: none; border-radius: 10px;
}
.custom-install-btn:hover { filter: brightness(1.08); }
.custom-install-btn:disabled { opacity: 0.55; cursor: default; filter: none; }
@media (max-width: 768px) { .apps-layout { gap: 0; } }
</style>
