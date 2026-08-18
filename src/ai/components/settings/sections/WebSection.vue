<!--
  agent web tools Task 9 —— 1:1 移植自 Vue2 NimoOS-UI `src/views/AI/Settings/sections/WebSection.vue`
  (commit a1de5fe2)。web_search / web_fetch 设置分区:服务商选择(Tavily/Brave/SearXNG)、
  启用开关、write-only 的 API key 输入框(从不回显/预填,保存成功后清空;留空保存时
  整个不带 api_key 字段,防止误清已存密钥)。

  【与 brief 的差异,申报】
  1. 按钮样式:brief 给的示例用 `.set-btn` + `data-test="web-save"`,但 `.set-btn` 在
     本仓不是设置分区的真实按钮 class(只在 ParserTest.vue/parser-styles.scss 里出现,
     与本页无关);本仓设置分区里"保存"按钮的真实约定是 `.set-actions` 包一个
     `.sk-btn.primary`(见 SearchSection.vue:254-257、291,ProvidersSection.vue:333)。
     这里改用真实约定,`data-test="web-save"` 契约不变。
  2. SetSwitch 的 v-model 契约是 `modelValue`(见同目录 SetSwitch.vue / MemorySection.vue
     的 `:model-value="enabled" @change="..."`),brief 示例误写成 `:value`——按真实
     props 契约改用 `:model-value`,行为(受控绑定 + change 回调)不变。
  3. 错误提示:brief 示例写的是 `toast.error(apiErrorMessage(e))`,但本仓 `useToast`
     store 只有 `show(text, duration?, tier?)`,没有 `error()` 方法,且 `apiErrorMessage`
     的签名是 `(e, fallback)` 两个必填参数(见 apiError.ts:21),brief 的单参调用编译不过。
     按同目录 MemorySection.vue 的真实用法改为
     `toast.show(apiErrorMessage(e, t(fallbackKey)), 3000, 'danger')`,fallback 分别用
     `aiCfgLoadFailed`(读取失败)/`aiCfgSaveFailed`(保存失败)两个已存在的通用键。

  【发现 brief 与已落地 Vue2 (a1de5fe2) 的不一致,原样保留 brief 值并在此申报,不擅自改】
  brief 给的 sections.ts 片段是 `icon: 'globe'`,但 Vue2 侧实际落地的
  `sections.js` diff 用的是 `icon: 'cloud'`。本仓 `AgentIcon.vue` 的 PATHS 表里没有
  'globe' 这个键(只有 cloud/lock/key/search/book/waves 等),按 brief 写 'globe' 会
  让导航栏这一项渲染出**空图标**(pathHtml 落空,不报错但看不见图标)——是本仓的一个
  真实视觉缺陷,不是风格分歧。遵照任务约束「照抄 brief,不擅自改进,报告里说明」,
  这里原样使用 'globe',缺陷记在报告里,留给评审定夺是否改回 'cloud'。
-->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { useToast } from '../../../../stores/toast'
import { apiErrorMessage } from '../../../util/apiError'
import SetSwitch from '../SetSwitch.vue'

const { t } = useI18n()
const toast = useToast()

const backend = ref('')
const baseUrl = ref('')
const apiKey = ref('') // never populated from the server
const hasKey = ref(false)
const enabled = ref(false)

async function load() {
  try {
    const s = (await service.ai.getWebSettings()) as {
      backend: string
      base_url: string
      enabled: boolean
      has_key: boolean
    }
    backend.value = s.backend || ''
    baseUrl.value = s.base_url || ''
    enabled.value = !!s.enabled
    hasKey.value = !!s.has_key
  } catch (e) {
    toast.show(apiErrorMessage(e, t('aiCfgLoadFailed')), 3000, 'danger')
  }
}

async function save() {
  const payload: {
    backend: string
    base_url: string
    enabled: boolean
    api_key?: string
  } = { backend: backend.value, base_url: baseUrl.value, enabled: enabled.value }
  // Only send a key the user actually typed: "" would CLEAR the stored one,
  // and this component never holds the real value to send back.
  if (apiKey.value !== '') payload.api_key = apiKey.value
  try {
    const s = (await service.ai.putWebSettings(payload)) as { has_key: boolean }
    hasKey.value = !!s.has_key
    apiKey.value = ''
  } catch (e) {
    toast.show(apiErrorMessage(e, t('aiCfgSaveFailed')), 3000, 'danger')
  }
}

onMounted(load)
</script>

<template>
  <div class="set-inner">
    <div class="set-page-head">
      <h1 class="set-h1">{{ t('aiCfgWebAccess') }}</h1>
      <p class="set-desc">{{ t('aiCfgWebAccessDesc') }}</p>
    </div>

    <div class="sk-section">
      <div class="sk-section-head">
        <div class="sk-section-title">{{ t('aiCfgWebSearch') }}</div>
      </div>
      <div class="sk-section-body">
        <div class="set-banner warn">{{ t('aiCfgWebSearchPrivacy') }}</div>
        <div class="set-rows">
          <div class="set-row">
            <div class="lbl">
              {{ t('aiCfgWebSearchEnable') }}
              <span class="sub">{{ t('aiCfgWebSearchEnableDesc') }}</span>
            </div>
            <div class="val end">
              <SetSwitch :model-value="enabled" @change="(v: boolean) => (enabled = v)" />
            </div>
          </div>
          <div class="set-row">
            <div class="lbl">{{ t('aiCfgWebProvider') }}</div>
            <div class="val end">
              <select class="set-input" data-test="web-backend" v-model="backend">
                <option value="">{{ t('aiCfgWebNotConfigured') }}</option>
                <option value="tavily">Tavily</option>
                <option value="brave">Brave Search</option>
                <option value="searxng">SearXNG ({{ t('aiCfgWebSelfHosted') }})</option>
              </select>
            </div>
          </div>
          <div class="set-row" v-if="backend === 'searxng'">
            <div class="lbl">
              {{ t('aiCfgWebSearxngUrl') }}
              <span class="sub">{{ t('aiCfgWebSearxngUrlDesc') }}</span>
            </div>
            <div class="val end">
              <input class="set-input" v-model="baseUrl" placeholder="http://searx.lan:8080">
            </div>
          </div>
          <div class="set-row" v-if="backend === 'tavily' || backend === 'brave'">
            <div class="lbl">
              {{ t('aiCfgWebApiKey') }}
              <span class="sub" v-if="hasKey">{{ t('aiCfgWebKeySaved') }}</span>
            </div>
            <div class="val end">
              <input
                class="set-input"
                type="password"
                data-test="web-api-key"
                v-model="apiKey"
                :placeholder="hasKey ? '••••••••' : t('aiCfgWebPasteKey')"
              >
            </div>
          </div>
        </div>
        <div class="set-actions">
          <button class="sk-btn primary" data-test="web-save" @click="save">{{ t('aiCfgSave') }}</button>
        </div>
      </div>
    </div>

    <div class="sk-section">
      <div class="sk-section-head">
        <div class="sk-section-title">{{ t('aiCfgWebFetchTitle') }}</div>
      </div>
      <div class="sk-section-body">
        <p class="set-desc">{{ t('aiCfgWebFetchDesc') }}</p>
      </div>
    </div>
  </div>
</template>
