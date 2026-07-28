<!--
  SP8-P2a Task 11 —— 1:1 移植自 Vue2
  `src/views/AI/Settings/sections/ThinkingDefaultsSection.vue`(73 行)。**这个分区
  不经 store**——挂载时自己直接调 `service.ai.getThinkingDefaults()`,改动时自己
  直接调 `putThinkingDefaults()`(Vue2 原本就是这样,照搬)。一个信息横幅 + 两行
  (默认开启思考开关 · 默认强度下拉四档,`!enabled` 时下拉 disabled)+ 一行状态
  提示(`saving` → 「保存中…」;`savedAt` 非 0 → 「已保存」;否则空)。

  【取数口径,非行为改动】Vue2 `mounted()` 写的是
  `const d = await ai.getThinkingDefaults(); this.enabled = d.enabled`——注意它
  **没有** `.data`。共享包 `service.ai.getThinkingDefaults()` 同样返 body-level
  （见 NimoOS-Service/src/ai.ts `getThinkingDefaults`:内部已经 `return res.data`
  剥了一层,不需要在这里再剥一次）。取数口径与 `agentStore.ts:744-748`
  `loadThinkingDefaults()` 对齐同一端点、同一写法、同一吞错策略,不自行发明。

  【观察项,照搬不改,只登记】本分区与 `agentStore`(`agentStore.ts:161-167` 的
  `thinking.defaults`)各自持有一份独立的 thinking defaults 状态。在设置页把默认
  值改了,已挂载的 Agent 页 store 不会自动刷新——要等用户切到 Agent 页重新走一次
  `loadThinkingDefaults()` 才能看到新值。Vue2 同样如此(它的组件级 store 每次挂载
  新建,靠切页重建掩盖这个落差),这不是本仓单例化才引入的新问题,照搬不修。

  【纪律修复,申报①②③见任务报告】Vue2 `save()`(:62-70)只有 try/finally,没有
  catch——`putThinkingDefaults` 失败时会产生一个未处理的 promise rejection,且
  用户看不到任何提示:开关已经拨过去了,后端没存上,界面一声不吭。这是可复现的
  错误行为(不是设计选择),按移植纪律改成正确逻辑:见下方 `save()` 内 catch 处
  的注释。`mounted()` 的 `catch {}` 静默吞错**保留**——硬编码兜底
  (`enabled: true`/`level: 'medium'`)是合理降级,不是缺陷。
-->
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { useToast } from '../../../../stores/toast'
import AgentIcon from '../../icons/AgentIcon.vue'
import SetSwitch from '../SetSwitch.vue'

const toast = useToast()
const { t } = useI18n()

const enabled = ref(true)
const level = ref('medium')
const saving = ref(false)
const savedAt = ref(0)

onMounted(async () => {
  try {
    const d = (await service.ai.getThinkingDefaults()) as { enabled: boolean; level: string }
    enabled.value = d.enabled
    level.value = d.level
  } catch {
    // Vue2 ThinkingDefaultsSection.vue:54-60 `catch {}`——故意静默吞错:enabled/level
    // 的初值已经是产品定的兜底(true/'medium'),接口失败时没必要打断整个页面,用户
    // 仍能正常手动切换后自行保存。与 agentStore.ts:744-748 loadThinkingDefaults 的
    // 既定吞错策略一致(同一后端端点)。
  }
})

/**
 * Vue2 :62-70 —— 原文只有 try/finally,**没有 catch**:
 *   async save() {
 *     this.saving = true
 *     try {
 *       await ai.putThinkingDefaults({ enabled: this.enabled, level: this.level })
 *       this.savedAt = Date.now()
 *     } finally {
 *       this.saving = false
 *     }
 *   }
 * 保存失败时这会产生一个未处理的 promise rejection,且用户看不到任何提示——开关
 * 已经拨过去了、后端没存上、界面一声不吭。这是可复现的错误行为,按移植纪律改成
 * 正确逻辑:加 catch,弹 danger 档「保存失败」toast。
 */
async function save() {
  saving.value = true
  try {
    await service.ai.putThinkingDefaults({ enabled: enabled.value, level: level.value })
    savedAt.value = Date.now()
  } catch {
    toast.show(t('aiCfgSaveFailed'), 1500, 'danger')
  } finally {
    saving.value = false
  }
}

function onToggle(v: boolean) {
  enabled.value = v
  void save()
}

function onLevelChange(e: Event) {
  level.value = (e.target as HTMLSelectElement).value
  void save()
}
</script>

<template>
  <div class="set-inner">
    <div class="set-page-head">
      <h1 class="set-h1">{{ t('aiCfgThinkingIntensity') }}</h1>
      <p class="set-desc">{{ t('aiCfgThinkingDesc') }}</p>
    </div>

    <div class="sk-section">
      <div class="sk-section-head">
        <div class="sk-section-title">{{ t('aiCfgThinkingDefaultsTitle') }}</div>
      </div>
      <div class="sk-section-body">
        <div class="set-banner">
          <span class="ico"><AgentIcon name="sparkle" :size="12" /></span>
          <span>{{ t('aiCfgThinkingBanner') }}</span>
        </div>
        <div class="set-rows">
          <div class="set-row">
            <div class="lbl">{{ t('aiCfgEnableThinkingDefault') }}</div>
            <div class="val end">
              <SetSwitch :model-value="enabled" @change="onToggle" />
            </div>
          </div>
          <div class="set-row">
            <div class="lbl">{{ t('aiCfgDefaultIntensity') }}</div>
            <div class="val end">
              <select class="set-select" :value="level" :disabled="!enabled" @change="onLevelChange">
                <option value="low">{{ t('aiThinkingLow') }}</option>
                <option value="medium">{{ t('aiThinkingMedium') }}</option>
                <option value="high">{{ t('aiThinkingHigh') }}</option>
                <option value="max">{{ t('aiThinkingMax') }}</option>
              </select>
            </div>
          </div>
        </div>
        <span class="set-actions">
          <span class="hint">{{ saving ? t('aiCfgSaving') : savedAt ? t('aiCfgSaved') : '' }}</span>
        </span>
      </div>
    </div>
  </div>
</template>
