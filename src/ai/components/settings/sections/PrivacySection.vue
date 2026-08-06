<!--
  SP8-P2a Task 11 —— 1:1 移植自 Vue2
  `src/views/AI/Settings/sections/PrivacySection.vue`(74 行)。三行配置:允许云端
  请求(开关)· 默认后端(下拉:local/cloud)· 本地失败时确认(开关)。每次改动
  调 `store.updatePolicyField(field, value)`;成功弹 toast(Vue2 :67 显式写了
  `duration: 1500`,不是隐式吃默认值——这里同样显式传,好让「1500ms」这个产品
  决定不随 toast store 未来改默认值而漂移),失败弹 danger 档。三态包裹:
  `policyLoading` → 加载中;`!policy` → 「无法加载策略」;否则渲染卡片。

  【Vue2 :22/:43 的 `!!` 归一逐字保留】`policy.allow_remote`/`escalation_prompt`
  在接口尚未返回该字段时可能是 `undefined`,`!!` 把它归一成布尔再交给 SetSwitch
  的 `modelValue: boolean` prop——不加会把 undefined 传给声明为 boolean 的 prop。
-->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useToast } from '../../../../stores/toast'
import SetSwitch from '../SetSwitch.vue'
import type { Policy } from '../../../stores/settingsStore'

const store = useSettingsStore()
const toast = useToast()
const { t } = useI18n()

/** Vue2 :64-71 —— 三行共用同一条改动路径:调 action → 成功 toast(1500ms)→ 失败 danger toast。 */
async function onChange<K extends keyof Policy>(field: K, value: Policy[K]) {
  try {
    await store.updatePolicyField(field, value)
    toast.show(t('aiCfgSaved'), 1500)
  } catch {
    toast.show(t('aiCfgSaveFailed'), 1500, 'danger')
  }
}

function onBackendChange(e: Event) {
  onChange('default_backend', (e.target as HTMLSelectElement).value)
}
</script>

<template>
  <div class="set-inner">
    <div class="set-page-head">
      <h1 class="set-h1">{{ t('aiCfgPrivacyCloud') }}</h1>
      <p class="set-desc">{{ t('aiCfgPrivacyDesc') }}</p>
    </div>

    <div v-if="store.policyLoading" class="set-note">{{ t('aiCfgLoadingEllipsis') }}</div>
    <div v-else-if="!store.policy" class="set-note">{{ t('aiCfgUnableLoadPolicy') }}</div>

    <div v-else class="sk-section">
      <div class="sk-section-head">
        <div class="sk-section-title">{{ t('aiCfgDataBackend') }}</div>
      </div>
      <div class="sk-section-body">
        <div class="set-rows">
          <div class="set-row">
            <div class="lbl">
              {{ t('aiCfgAllowCloudRequests') }}
              <span class="sub">{{ t('aiCfgAllowCloudRequestsSub') }}</span>
            </div>
            <div class="val end">
              <SetSwitch
                :model-value="!!store.policy.allow_remote"
                @change="(v: boolean) => onChange('allow_remote', v)"
              />
            </div>
          </div>
          <div class="set-row">
            <div class="lbl">
              {{ t('aiCfgDefaultBackend') }}
              <span class="sub">{{ t('aiCfgDefaultBackendSub') }}</span>
            </div>
            <div class="val end">
              <select class="set-select" :value="store.policy.default_backend" @change="onBackendChange">
                <option value="local">{{ t('aiCfgBackendLocal') }}</option>
                <option value="cloud">{{ t('aiCfgBackendCloud') }}</option>
              </select>
            </div>
          </div>
          <div class="set-row">
            <div class="lbl">
              {{ t('aiCfgConfirmLocalFailure') }}
              <span class="sub">{{ t('aiCfgConfirmLocalFailureSub') }}</span>
            </div>
            <div class="val end">
              <SetSwitch
                :model-value="!!store.policy.escalation_prompt"
                @change="(v: boolean) => onChange('escalation_prompt', v)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
