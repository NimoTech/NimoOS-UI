<!--
  SP8-P2a Task 10 —— 1:1 移植自 Vue2
  `src/views/AI/Settings/sections/ProvidersSection.vue`(249 行)。本期最大件,
  三块:

    1. 服务商表格:名称 / Base URL / 协议徽章 / 启用开关 / 操作(展开模型 ·
       编辑 · 删除)
    2. 可展开的「模型」子面板(表格里插一整行 colspan=5):刷新模型 · 手动
       添加 · 每个模型一个收藏开关 + 🧠 思考标记 + 来源徽章 + manual 项的删除
    3. 内联表单(不是弹窗,是表格下面又一张 `sk-section` 卡):4 个预设 chip
       (仅新建时出现)+ 名称 / Base URL / API Key / 默认模型 / 协议单选 +
       保存 / 取消

  【Buefy → New-UI 替换】
  - $buefy.dialog.confirm(删服务商,:184-196)→ 共享 AlertDialog,destructive。
    deleteDlg 把 open 与待删 provider 打包在同一个 ref(同 ModelsSection.vue
    deleteDlg 的既定手法):reka 的 AlertDialogAction 点击时先派发
    update:open(false) 再派发 confirm,v-model:open 只改 .open,confirm 处理器
    仍能读到正确的 provider。
  - $buefy.dialog.prompt(手动加模型,:224-239)→ T6 的 PromptDialog。同款
    open+关联对象打包手法(addModelDlg 存 { open, provider })。title/
    confirmText 复用「+手动添加」/「添加」这两个既有动作名,不新造通用「确认」
    文案(同 AgentSidebar.vue:192-200 先例,ModelsSection.vue 头注释引用过)。
  - toast 三档:成功/中性 → info(不传第三参);
    `Auto-fetch failed. You can add models manually.` → **warning 档**
    (Vue2 :214 是 `is-warning`,不是 danger);其余失败 → danger。

  【Vue3 迁移必改的一处,非行为改动】Vue2 :28 是
  `<template v-for="p in store.state.providers">` 且把 `:key="p.id"` 打在了
  子元素 `<tr>` 上。Vue3 要求 `<template v-for>` 的 key 直接标在 `<template>`
  本身(同 ModelPicker.vue:120 的既定先例)。Vue2 这里一个 `p` 产出两行
  `<tr>`(主行 + 展开行,原分别用 `:key="p.id"` 和 `:key="p.id + '-models'"`),
  key 挪到 template 后自然只剩一个 —— Vue3 把 `<template>` 下的多个根节点当
  一组处理,这是正确的,不是行为改动。

  【expanded 是组件本地状态,不进 store】同 Vue2 `data() { return { expanded: {} } }`
  —— 展开哪些服务商的模型面板是纯 UI 瞬态,和 Pinia 单例是否会把「上次离开时
  的状态」带回来无关(D2 只处理 store 里的瞬态字段,expanded 从来就不在 store
  里,不受影响)。

  【懒加载守卫,Vue2 :203 逐字保留】`if (open && !this.store.state.providerModels[p.id])`
  —— 首次展开某个服务商时才拉取模型列表,已缓存过的展开不重复请求。

  【i18n:两个从未被 Vue2 $t() 包裹的英文字面量】`Base URL`(:25 表头、:107 表单
  label)与 `API Key`(:111 表单 label)在 Vue2 源码里是裸字面量,连 $t() 调用
  都没有 —— 不是「$t 键缺中文译文」那种情况。按 P1a 确立的既定政策(Vue2 从未
  i18n 的英文字面量,本期补键),这里补了 aiCfgBaseUrl / aiCfgApiKey 两个键,
  中英文值都保持 "Base URL" / "API Key" 原文(技术术语,生产 zh_CN.json 里也
  没有这两个词的中译先例)。`OpenAI`/`Anthropic`(:123/:126 协议单选文字)与
  预设 chip 名称同理是专有名词,Vue2 同样没有 $t() 包裹,不作翻译处理。
-->
<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useToast } from '../../../../stores/toast'
import AgentIcon from '../../icons/AgentIcon.vue'
import SetSwitch from '../SetSwitch.vue'
import AlertDialog from '../../../../components/ui/AlertDialog.vue'
import PromptDialog from '../../../../components/ui/PromptDialog.vue'
import type { Provider, ProviderModel, ProviderPreset } from '../../../stores/settingsStore'

const store = useSettingsStore()
const toast = useToast()
const { t } = useI18n()

// Vue2 ProvidersSection.vue:151-156 —— 四个预设,逐字照搬,不改 URL 和默认
// 模型名。
const PRESETS: ProviderPreset[] = [
  { name: 'OpenAI', base_url: 'https://api.openai.com/v1', default_model: 'gpt-4o', protocol: 'openai' },
  { name: 'Anthropic', base_url: 'https://api.anthropic.com/v1', default_model: 'claude-sonnet-4-6', protocol: 'anthropic' },
  { name: 'DeepSeek', base_url: 'https://api.deepseek.com/v1', default_model: 'deepseek-chat', protocol: 'openai' },
  { name: 'Moonshot', base_url: 'https://api.moonshot.cn/v1', default_model: 'moonshot-v1-8k', protocol: 'openai' },
]

// Vue2 ProvidersSection.vue:162 `data() { return { expanded: {} } }` —— 组件
// 本地瞬态状态,不进 store(见文件头说明)。
const expanded = ref<Record<string | number, boolean>>({})

function modelsOf(p: Provider) {
  return store.providerModels[p.id] || { loading: false, models: [] }
}

/** Vue2 :200-208 —— 首次展开才拉模型,已缓存的展开不重复请求(懒加载守卫)。 */
function onToggleModels(p: Provider) {
  const open = !expanded.value[p.id]
  expanded.value[p.id] = open
  if (open && !store.providerModels[p.id]) {
    store.loadProviderModels(p.id).catch(() => {
      toast.show(t('aiCfgFailedToLoadModels'), 1500, 'danger')
    })
  }
}

/** Vue2 :168-174 */
async function onToggle(p: Provider, value: boolean) {
  try {
    await store.toggleProvider(p.id, value)
  } catch {
    toast.show(t('aiCfgToggleFailed'), 1500, 'danger')
  }
}

/**
 * Vue2 :175-182 —— catch 优先展示 e.message,不带 message 才用兜底文案。
 *
 * 【类型收窄,非行为改动】Vue2 是 JS 的 duck-typed `e.message`(任何带
 * `.message` 字段的抛出值都读得到,不要求是 Error 实例)。TS strict 下
 * catch 变量类型是 `unknown`,这里按 `(e as { message?: unknown })?.message`
 * 断言窄化,而不是 `e instanceof Error`(后者会漏掉「抛出一个带 message 字段
 * 的普通对象」这种非 Error 实例的场景,比 Vue2 更严格,是需要避免的收窄)。
 * 断言写法与本文件同目录 settingsStore.ts:179-182 `isNotFound()` 的既定手法
 * 一致。
 */
async function onSave() {
  try {
    await store.saveProvider()
    toast.show(t('aiCfgSaved'))
  } catch (e) {
    const message = (e as { message?: unknown } | null | undefined)?.message
    toast.show((typeof message === 'string' && message) || t('aiCfgSaveFailed'), 1500, 'danger')
  }
}

// ── 删除服务商确认(Vue2 :183-196,Buefy → AlertDialog,见文件头说明)──
const deleteDlg = ref<{ open: boolean; provider: Provider | null }>({ open: false, provider: null })

function requestDelete(p: Provider) {
  deleteDlg.value = { open: true, provider: p }
}

async function onDeleteConfirm() {
  const p = deleteDlg.value.provider
  if (!p) return
  try {
    await store.deleteProvider(p.id)
    toast.show(t('aiCfgDeleted'))
  } catch {
    toast.show(t('aiCfgDeleteFailed'), 1500, 'danger')
  }
}

/** Vue2 :209-216 —— 失败弹 warning 档(不是 danger),文案指向手动添加。 */
async function onRefreshModels(p: Provider) {
  try {
    await store.refreshProviderModels(p.id)
    toast.show(t('aiCfgRefreshed'))
  } catch {
    toast.show(t('aiCfgAutoFetchFailedManual'), 1500, 'warning')
  }
}

/** Vue2 :217-223 */
async function onToggleFav(p: Provider, m: ProviderModel, favorite: boolean) {
  try {
    await store.toggleModelFavorite(p.id, m.name, favorite)
  } catch {
    toast.show(t('aiCfgSaveFailed'), 1500, 'danger')
  }
}

// ── 手动添加模型(Vue2 :224-239,Buefy prompt → PromptDialog,见文件头说明)──
const addModelDlg = ref<{ open: boolean; provider: Provider | null }>({ open: false, provider: null })

function onAddManual(p: Provider) {
  addModelDlg.value = { open: true, provider: p }
}

/** Vue2 :229-231 —— `(value || '').trim()`,空白值直接 return,不调用 action。 */
async function onAddModelConfirm(value: string) {
  const p = addModelDlg.value.provider
  if (!p) return
  const name = (value || '').trim()
  if (!name) return
  try {
    await store.addManualModel(p.id, name)
  } catch {
    toast.show(t('aiCfgAddFailed'), 1500, 'danger')
  }
}

/** Vue2 :240-246 */
async function onRemoveManual(p: Provider, m: ProviderModel) {
  try {
    await store.removeManualModel(p.id, m.name)
  } catch {
    toast.show(t('aiCfgDeleteFailed'), 1500, 'danger')
  }
}
</script>

<template>
  <div class="set-inner">
    <div class="set-page-head">
      <h1 class="set-h1">{{ t('aiCfgCloudProviders') }}</h1>
      <p class="set-desc">{{ t('aiCfgProvidersDesc') }}</p>
    </div>

    <div class="sk-section">
      <div class="sk-section-body">
        <div class="set-cardhead">
          <span class="t">{{ t('aiCfgConfiguredProviders') }}</span>
          <span class="ct">{{ store.providers.length }}</span>
          <span class="sp"></span>
          <button class="sk-btn primary" @click="store.showProviderForm()">
            <AgentIcon name="plus" :size="13" /> {{ t('aiCfgAdd') }}
          </button>
        </div>

        <div v-if="store.providersLoading" class="set-note">{{ t('aiCfgLoadingEllipsis') }}</div>
        <div v-else-if="store.providers.length === 0" class="set-note">
          {{ t('aiCfgNoProvidersYet') }}
        </div>
        <table v-else class="set-table">
          <thead>
            <tr>
              <th>{{ t('aiCfgColName') }}</th>
              <th>{{ t('aiCfgBaseUrl') }}</th>
              <th>{{ t('aiCfgProtocol') }}</th>
              <th>{{ t('aiCfgEnabled') }}</th>
              <th class="act">{{ t('aiCfgColActions') }}</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="p in store.providers" :key="p.id">
              <tr>
                <td>{{ p.name }}</td>
                <td class="mono">{{ p.base_url }}</td>
                <td>
                  <span class="set-proto">{{ p.protocol || 'openai' }}</span>
                </td>
                <td>
                  <SetSwitch :model-value="!!p.enabled" @change="(v: boolean) => onToggle(p, v)" />
                </td>
                <td class="act">
                  <button class="set-tbtn" @click="onToggleModels(p)">
                    <AgentIcon name="chevDown" :size="13" /> {{ t('aiCfgShowModels') }}
                  </button>
                  <button class="set-tbtn" @click="store.showProviderForm(p)">
                    <AgentIcon name="edit" :size="13" /> {{ t('aiCfgEdit') }}
                  </button>
                  <button class="set-tbtn danger" @click="requestDelete(p)">
                    <AgentIcon name="trash" :size="13" /> {{ t('aiCfgDelete') }}
                  </button>
                </td>
              </tr>
              <tr v-if="expanded[p.id]">
                <td colspan="5">
                  <div class="pm-panel">
                    <div class="pm-head">
                      <span>{{ t('aiCfgModelsCheckedHint') }}</span>
                      <span class="sp"></span>
                      <button class="set-minibtn" :disabled="modelsOf(p).loading" @click="onRefreshModels(p)">
                        <AgentIcon name="refresh" :size="13" /> {{ t('aiCfgRefreshModels') }}
                      </button>
                      <button class="set-minibtn" @click="onAddManual(p)">{{ t('aiCfgAddManually') }}</button>
                    </div>
                    <div v-if="modelsOf(p).loading" class="set-note">{{ t('aiCfgLoadingEllipsis') }}</div>
                    <ul v-else class="pm-list">
                      <li v-for="m in modelsOf(p).models" :key="m.name" class="pm-item">
                        <SetSwitch :model-value="!!m.favorite" @change="(v: boolean) => onToggleFav(p, m, v)" />
                        <span class="nm">{{ m.name }}</span>
                        <span v-if="m.supports_thinking" :title="t('aiCfgSupportsThinking')">🧠</span>
                        <span class="src">{{ m.source }}</span>
                        <button v-if="m.source === 'manual'" class="dir-del"
                                @click="onRemoveManual(p, m)" :title="t('aiCfgDelete')">
                          <AgentIcon name="trash" :size="12" />
                        </button>
                      </li>
                      <li v-if="modelsOf(p).models.length === 0" class="set-note">
                        {{ t('aiCfgNoModelsFoundHint') }}
                      </li>
                    </ul>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Inline form -->
    <div v-if="store.providerForm.visible" class="sk-section">
      <div class="sk-section-head">
        <div class="sk-section-title">{{ store.providerForm.editing ? t('aiCfgEditProvider') : t('aiCfgAddProvider') }}</div>
        <button class="set-ibtn" @click="store.hideProviderForm()">
          <AgentIcon name="x" :size="14" />
        </button>
      </div>
      <div class="set-form">
        <div v-if="!store.providerForm.editing" class="preset-row">
          <button v-for="preset in PRESETS" :key="preset.name" class="preset-chip"
                  @click="store.applyProviderPreset(preset)">
            {{ preset.name }}
          </button>
        </div>

        <div class="field">
          <label>{{ t('aiCfgColName') }} *</label>
          <input type="text" class="set-input full" v-model="store.providerForm.data.name" :placeholder="t('aiCfgProviderNamePlaceholder')" />
        </div>
        <div class="field">
          <label>{{ t('aiCfgBaseUrl') }} *</label>
          <input type="text" class="set-input full" v-model="store.providerForm.data.base_url" placeholder="https://api.example.com/v1" />
        </div>
        <div class="field">
          <label>{{ t('aiCfgApiKey') }}</label>
          <input type="password" class="set-input full" v-model="store.providerForm.data.api_key"
                 :placeholder="store.providerForm.editing ? t('aiCfgLeaveBlankKeepCurrent') : t('aiCfgApiKey')" />
        </div>
        <div class="field">
          <label>{{ t('aiCfgDefaultModel') }}</label>
          <input type="text" class="set-input full" v-model="store.providerForm.data.default_model" :placeholder="t('aiCfgEgGpt4o')" />
        </div>
        <div class="field">
          <label>{{ t('aiCfgProtocol') }}</label>
          <div class="radio-row">
            <label class="radio-option">
              <input type="radio" value="openai" v-model="store.providerForm.data.protocol" /> OpenAI
            </label>
            <label class="radio-option">
              <input type="radio" value="anthropic" v-model="store.providerForm.data.protocol" /> Anthropic
            </label>
          </div>
          <p class="help">{{ t('aiCfgProtocolHint') }}</p>
        </div>

        <div class="set-actions">
          <button class="sk-btn primary"
                  :disabled="store.providerForm.saving"
                  @click="onSave">
            {{ t('aiCfgSave') }}
          </button>
          <button class="sk-btn ghost" @click="store.hideProviderForm()">
            {{ t('aiCfgCancel') }}
          </button>
        </div>
      </div>
    </div>

    <AlertDialog
      v-model:open="deleteDlg.open"
      :title="t('aiCfgDelete')"
      :message="t('aiCfgConfirmDeleteProvider', { name: deleteDlg.provider?.name || '' })"
      :confirm-text="t('aiCfgDelete')"
      :cancel-text="t('aiCfgCancel')"
      destructive
      @confirm="onDeleteConfirm"
    />

    <PromptDialog
      v-model:open="addModelDlg.open"
      :title="t('aiCfgAddManually')"
      :message="t('aiCfgEnterModelNamePrompt')"
      :placeholder="t('aiCfgModelNamePromptPlaceholder')"
      :confirm-text="t('aiCfgAdd')"
      :cancel-text="t('aiCfgCancel')"
      @confirm="onAddModelConfirm"
    />
  </div>
</template>
