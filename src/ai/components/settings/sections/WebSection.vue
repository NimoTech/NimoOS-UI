<!--
  agent web tools Task 9 —— 1:1 移植自 Vue2 NimoOS-UI `src/views/AI/Settings/sections/WebSection.vue`
  (commit a1de5fe2)。web_search / web_fetch 设置分区:服务商选择(Tavily/Brave/SearXNG)、
  启用开关、write-only 的 API key 输入框(从不回显/预填,保存成功后清空;留空保存时
  整个不带 api_key 字段,防止误清已存密钥)。

  【与 brief 的差异,申报】
  1. SetSwitch 的 v-model 契约是 `modelValue`(见同目录 SetSwitch.vue / MemorySection.vue
     的 `:model-value="enabled" @change="..."`),brief 示例误写成 `:value`——按真实
     props 契约改用 `:model-value`,行为(受控绑定 + change 回调)不变。
  2. 错误提示:brief 示例写的是 `toast.error(apiErrorMessage(e))`,但本仓 `useToast`
     store 只有 `show(text, duration?, tier?)`,没有 `error()` 方法,且 `apiErrorMessage`
     的签名是 `(e, fallback)` 两个必填参数(见 apiError.ts:21),brief 的单参调用编译不过。
     按同目录 MemorySection.vue 的真实用法改为
     `toast.show(apiErrorMessage(e, t(fallbackKey)), 3000, 'danger')`,fallback 分别用
     `aiCfgLoadFailed`(读取失败)/`aiCfgSaveFailed`(保存失败)两个已存在的通用键。

  【fix round 1(协调者确认,2026-08-18)】sections.ts 的 icon 已从 brief 原文的
  'globe' 改成 'cloud'。原因:本仓 `AgentIcon.vue` 的 PATHS 表里根本没有 'globe'
  这个键,写 'globe' 会让导航栏这一项渲染出空图标;而 Vue2 侧已落地的
  `sections.js`(commit a1de5fe2)本来就是 `icon: 'cloud'`——协调者确认这是
  brief 自己的笔误(移植 Vue2 时因为 SkillIcon.vue 同样没有 globe 才把 Vue2
  侧改成了 cloud,但漏了把这个修正带进本任务的 brief)。'cloud' 与「Cloud
  providers」项(`providers`)撞图标是已知问题,留作后续:给两侧图标集各加
  一个真正的 globe/link 图标再拆开,不在本任务里改。本仓 `external` 图标已
  存在、语义上更贴近"网页",留给做该后续的人做候选,这里不用它——移植纪律
  是与 Vue2 落地版 1:1,不为了美观在本任务里临时挑一个不同的图标。

  【fix round 2(协调者确认,2026-08-18)—— 撤回批量保存按钮,改回逐字段自动保存】
  brief 原模板给的是"改一堆字段 + 点一个 Save 按钮批量提交"。这是 brief 自己的
  设计缺陷,不是移植需要:Vue2 落地版(a1de5fe2)里这个分区**没有保存按钮**——
  switch/下拉/SearXNG 地址/API key 四个字段各自在 `@change` 时立即调用同一个
  `save()`;本仓同目录 `MemorySection.vue` 的 `onEnabledChange`/`onCompactionChange`/
  `saveContextWindow`(input 上 `v-model` 叠 `@change`)也是同一套自动保存约定。
  批量保存按钮版本一度让两个 UI 在同一功能上出现用户可见的行为分歧(且与本仓
  自己的姊妹分区风格不一致),现改回自动保存,`.set-actions` 保存按钮整块与
  `data-test="web-save"` 一并撤走;`data-test="web-backend"` / `web-api-key` 两个
  钩子保留。留空跳过 api_key、保存成功清空输入框、掩码占位符、"已保存密钥"提示、
  隐私横幅这几条不受影响,原样保留。
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

// 逐字段自动保存,四个入口(switch/下拉/SearXNG 地址/API key)共用同一个
// save():每次都把当前完整状态整体 PUT 回去,只有 api_key 按"留空则不带"的
// 规则单独处理——见 fix round 2 头注释。
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
