<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AreaShell from '../../components/shell/AreaShell.vue'
import AppsSidebar from '../components/AppsSidebar.vue'
import YamlEditor from '../components/custom/YamlEditor.vue'
import AlertDialog from '../../components/ui/AlertDialog.vue'
import { useCustomInstall } from '../composables/useCustomInstall'
import { ensureComposeMeta, normalizeVolumes, dockerRunToCompose } from '../util/importNormalize'
import { listLinkApps, saveLinkApp, deleteLinkApp, type LinkApp } from '../util/linkApps'
import { useValidation } from '../../composables/useValidation'
import { useToast } from '../../stores/toast'

type TabKey = 'yaml' | 'import' | 'link'
const TABS: TabKey[] = ['yaml', 'import', 'link']

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { validateYaml, installYaml } = useCustomInstall()
const { required } = useValidation()

// Single source of truth = route query, deep-linkable (?tab=yaml|import|link, default yaml)
const tab = computed<TabKey>(() => {
  const q = route.query.tab
  return typeof q === 'string' && (TABS as string[]).includes(q) ? (q as TabKey) : 'yaml'
})
function setTab(k: TabKey) {
  router.replace({ query: { ...route.query, tab: k === 'yaml' ? undefined : k } })
}

// ── tab1: YAML edit & install ──
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
    if (res.ok) router.push('/apps') // go to /apps to watch the install progress card
    else yamlError.value = { message: res.message, ports: res.ports }
  } finally {
    yamlBusy.value = false
  }
}

// ── tab2: docker run command import ──
const dockerCmd = ref('')
const convertError = ref('')

function onConvert() {
  convertError.value = ''
  try {
    const composeRaw = dockerRunToCompose(dockerCmd.value)
    // Derive the name once first (for normalizeVolumes' appName); the final meta (name/title/icon) injection
    // is done again after volume normalization, ensuring it lands on the final output YAML.
    const { name } = ensureComposeMeta(composeRaw)
    const normalized = normalizeVolumes(composeRaw, name)
    const { yaml } = ensureComposeMeta(normalized)
    yamlText.value = yaml
    setTab('yaml')
  } catch (e) {
    convertError.value = e instanceof Error ? e.message : String(e)
  }
}

// ── tab3: external link (LinkApp) management ──
const links = ref<LinkApp[]>([])
const linksLoading = ref(false)
const editingName = ref<string | null>(null) // non-null = editing an existing entry, name field locked (same as Vue2 disableEditName)
const linkName = ref('')
const linkHostname = ref('')
const linkIcon = ref('')
const linkError = ref('')
const linkBusy = ref(false)

onMounted(() => { void loadLinks() })

async function loadLinks() {
  linksLoading.value = true
  try {
    links.value = await listLinkApps()
  } finally {
    linksLoading.value = false
  }
}

function resetLinkForm() {
  editingName.value = null
  linkName.value = ''
  linkHostname.value = ''
  linkIcon.value = ''
  linkError.value = ''
}

function onEditLink(l: LinkApp) {
  editingName.value = l.name
  linkName.value = l.name
  linkHostname.value = l.hostname
  linkIcon.value = l.icon
  linkError.value = ''
}

function validateLinkForm(): boolean {
  const nameErr = required(linkName.value)
  if (nameErr) { linkError.value = t(nameErr); return false }
  const hostErr = required(linkHostname.value)
  if (hostErr) { linkError.value = t(hostErr); return false }
  if (!/^https?:\/\//.test(linkHostname.value.trim())) {
    linkError.value = t('appsCustomLinkHostInvalid')
    return false
  }
  return true
}

async function onSubmitLink() {
  if (linkBusy.value) return
  linkError.value = ''
  if (!validateLinkForm()) return
  linkBusy.value = true
  try {
    links.value = await saveLinkApp({ name: linkName.value.trim(), hostname: linkHostname.value.trim(), icon: linkIcon.value.trim() })
    resetLinkForm()
  } catch (e) {
    linkError.value = e instanceof Error ? e.message : String(e)
  } finally {
    linkBusy.value = false
  }
}

// Delete confirmation: the open flag and target are stored in two independent refs (not fields of one object) —
// reka AlertDialogAction emits update:open(false) before firing @confirm on click; if both shared
// the same clearing logic, target could be cleared before the confirm handler reads it. Two independent refs avoid this timing trap at the root.
const linkDelOpen = ref(false)
const linkDelTarget = ref<LinkApp | null>(null)
function onDeleteLink(l: LinkApp) { linkDelTarget.value = l; linkDelOpen.value = true }
async function confirmDeleteLink() {
  const target = linkDelTarget.value
  if (!target) return
  linkError.value = ''
  try {
    links.value = await deleteLinkApp(target.name)
    if (editingName.value === target.name) resetLinkForm()
  } catch (e) {
    linkError.value = e instanceof Error ? e.message : String(e)
  }
}
</script>

<template>
  <AreaShell :title="t('appsTitle')">
    <!-- yaml-mode: same as AppSettingsPage — fixed-height layout under the YAML tab, editor scrolls internally instead of the whole page -->
    <div class="apps-layout" :class="{ 'yaml-mode': tab === 'yaml' }">
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
          <div class="link-form">
            <div class="link-field">
              <label>{{ t('appsCustomLinkName') }}</label>
              <input
                v-model="linkName" class="set-input" type="text" data-test="link-name"
                :disabled="!!editingName"
              />
            </div>
            <div class="link-field">
              <label>{{ t('appsCustomLinkHost') }}</label>
              <input v-model="linkHostname" class="set-input" type="text" data-test="link-hostname" placeholder="https://" />
            </div>
            <div class="link-field">
              <label>{{ t('appsCustomLinkIcon') }}</label>
              <input v-model="linkIcon" class="set-input" type="text" data-test="link-icon" />
            </div>
            <div v-if="linkError" class="custom-error" data-test="link-error">{{ linkError }}</div>
            <div class="custom-actions">
              <button
                v-if="editingName" type="button" class="bar-btn" data-test="link-cancel-edit"
                @click="resetLinkForm"
              >{{ t('appsCancel') }}</button>
              <button type="button" class="custom-install-btn" data-test="link-submit" :disabled="linkBusy" @click="onSubmitLink">
                {{ editingName ? t('appsCustomLinkSave') : t('appsCustomLinkAdd') }}
              </button>
            </div>
          </div>

          <p v-if="!linksLoading && !links.length" class="custom-hint" data-test="link-empty">{{ t('appsCustomLinkEmpty') }}</p>
          <ul v-else class="link-list">
            <li v-for="l in links" :key="l.name" class="link-row" data-test="link-row">
              <span class="link-ic" :class="l.icon ? 'has-img' : 'ic-app'">
                <img v-if="l.icon" :src="l.icon" alt="" loading="lazy" />
                <span v-else>{{ (l.name[0] || '?').toUpperCase() }}</span>
              </span>
              <span class="link-name">{{ l.name }}</span>
              <span class="link-host">{{ l.hostname }}</span>
              <button type="button" class="bar-btn" data-test="link-edit" @click="onEditLink(l)">{{ t('appsCustomLinkEdit') }}</button>
              <button type="button" class="bar-btn" data-test="link-delete" @click="onDeleteLink(l)">{{ t('appsCustomLinkDelete') }}</button>
            </li>
          </ul>
        </section>
      </main>
    </div>

    <AlertDialog
      v-model:open="linkDelOpen"
      :title="t('appsCustomLinkDelete')"
      :message="t('appsCustomLinkDeleteConfirm')"
      :confirm-text="t('appsCustomLinkDelete')"
      :cancel-text="t('appsCancel')"
      destructive
      @confirm="confirmDeleteLink"
    />
  </AreaShell>
</template>

<style scoped>
.apps-layout { display: flex; gap: 16px; align-items: flex-start; min-height: 100%; }
.apps-main { flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; }
/* YAML tab: fixed-height layout, the editor fills remaining space and scrolls internally (other tabs keep document-style scrolling) */
.apps-layout.yaml-mode { height: 100%; }
.apps-layout.yaml-mode .apps-main { min-height: 0; }

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
  /* Same as AppSettingsPage .set-conflict: translucent --drop-bad background + --remove-fg text, unified "conflict/failure" visual language */
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

/* ── tab3: external links (LinkApp) ── */
.link-form { display: flex; flex-direction: column; gap: 10px; margin-bottom: 18px; }
.link-field { display: flex; flex-direction: column; gap: 5px; }
.link-field label { font-size: 12px; color: var(--fg-muted); }
.set-input {
  width: 100%; box-sizing: border-box; padding: 8px 12px; font-size: 13px;
  color: var(--fg); background: var(--chip-bg); border: 1px solid var(--card-border); border-radius: 9px; outline: none;
}
.set-input:focus { border-color: var(--accent); }
.set-input:disabled { opacity: 0.6; cursor: not-allowed; }

.link-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.link-row {
  display: flex; align-items: center; gap: 10px; padding: 8px 10px;
  background: var(--chip-bg); border: 1px solid var(--card-border); border-radius: 10px;
}
.link-ic {
  flex: 0 0 auto; width: 28px; height: 28px; border-radius: 8px; overflow: hidden;
  display: grid; place-items: center; font-size: 12px; font-weight: 600; color: var(--on-accent);
}
.link-ic.has-img { background: var(--chip-bg-hi); }
.link-ic.has-img img { width: 100%; height: 100%; object-fit: contain; }
/* .ic-app is the brand gradient from theme.css (theme-exception: icon fallback gradient, skin-independent, see the comment at the top of theme.css) */
.link-name { flex: 0 1 auto; font-size: 13.5px; color: var(--fg); font-weight: 500; }
.link-host { flex: 1 1 auto; min-width: 0; font-size: 12.5px; color: var(--fg-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
