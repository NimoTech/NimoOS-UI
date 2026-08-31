<!--
  web_search / web_fetch 的设置分区,1:1 对应 Vue2 面板的
  `src/views/AI/Settings/sections/WebSection.vue`——两侧行为必须保持一致。

  改这个组件前要知道的两件事:

  1. API key 是 write-only。服务端永远不返回它(响应只有 `has_key` 布尔),所以输入框
     绝不能从服务端回填,保存成功后要清空。
  2. 输入框留空时,payload 里**整个不带** `api_key` 字段。后端语义是不对称的:省略
     = 保留已存密钥,发 `""` = 清除。发空串会让用户仅仅拨一下开关就抹掉可用的密钥。

  四个字段都在 `@change` 时各自调用同一个 `save()`(与 Vue2 侧及本目录
  `MemorySection.vue` 的自动保存约定一致),没有批量保存按钮。

  侧栏图标用 `cloud`,与「Cloud providers」撞图标是已知的待办:两侧图标集都缺一个
  globe/link 图标(本仓有 `external` 可作候选),补齐后再拆开。
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

// Auto-saves per field; all four entry points (switch/dropdown/SearXNG address/API key) share
// the same save(): every call PUTs the full current state back wholesale, except api_key,
// which is handled specially under the rule "omit it entirely if left blank".
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

function onEnabledChange(v: boolean) {
  enabled.value = v
  void save()
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
              <SetSwitch :model-value="enabled" @change="onEnabledChange" />
            </div>
          </div>
          <div class="set-row">
            <div class="lbl">{{ t('aiCfgWebProvider') }}</div>
            <div class="val end">
              <select class="set-input" data-test="web-backend" v-model="backend" @change="save">
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
              <input class="set-input" v-model="baseUrl" placeholder="http://searx.lan:8080" @change="save">
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
                @change="save"
              >
            </div>
          </div>
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
