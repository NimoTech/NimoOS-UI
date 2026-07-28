<!--
  SP8-P2b Task 4 —— 1:1 移植自 Vue2 src/views/AI/Settings/sections/BlacklistSection.vue(105 行)。

  【D2 申报】本分区是 7 个分区里唯一消费 settingsStore 的一个 —— 因为 Vue2 的
  blacklist 状态本来就在 settingsStore.js 里(其余 6 个分区在 Vue2 里是组件本地
  data + 直调 ai.js,本期照原样保留,不做 P1 Agent 区那种 store 集中)。
  用户 2026-07-28 拍板。

  【逻辑修正 1】Vue2 mounted 里 loadBlacklist 的错误是静默吞的(`catch (e) {}`),
  这里照搬 —— 首屏加载失败不弹 toast 是有意的:该分区与另外 4 个分区同属 stack 组
  会一起挂载,5 个分区同时弹错误 toast 会糊满屏幕。列表为空时空态文案本身就是反馈。
-->
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useToast } from '../../../../stores/toast'
import { apiErrorMessage } from '../../../util/apiError'
import AgentIcon from '../../icons/AgentIcon.vue'

// 1:1 取自 Vue2 BlacklistSection.vue:56-64。内置只读黑名单,前端硬编码展示用,
// 真正的拦截在后端。顺序与分行照抄,便于逐行对照。
const BUILTIN = [
  '**/.ssh/**', '**/.gnupg/**', '**/.pki/**', '**/.aws/**',
  '**/.config/gcloud/**', '**/.docker/config.json',
  '**/*.key', '**/*.pem', '**/*.p12', '**/*.pfx',
  '**/id_rsa*', '**/id_ed25519*', '**/id_ecdsa*',
  '/etc/**', '/root/**', '/proc/**', '/sys/**', '/dev/**', '/boot/**',
  '/usr/**', '/bin/**', '/sbin/**', '/lib/**', '/lib64/**',
  '/var/lib/nimoos/**', '/usr/share/nimoos/**', '/opt/nimoos/**',
]

const { t } = useI18n()
const store = useSettingsStore()
const toast = useToast()

const newPattern = ref('')
const adding = ref(false)

onMounted(() => {
  void store.loadBlacklist().catch(() => { /* Vue2 mounted 同样静默,见文件头注释 */ })
})

async function add() {
  const p = newPattern.value.trim()
  if (!p) return
  adding.value = true
  try {
    await store.addBlacklist(p)
    newPattern.value = ''
  } catch (e) {
    toast.show(apiErrorMessage(e, t('aiCfgAddFailed')), 3000, 'danger')
  } finally {
    adding.value = false
  }
}

async function remove(id: string | number) {
  try {
    await store.removeBlacklist(id)
  } catch (e) {
    // 逻辑修正(final review Fix 2):原先此处兜底文案用的是 t('aiCfgDelete')(裸名词
    // 「删除」),是本任务 brief 原文要求的写法,但最终评审判定与 McpTokensSection.vue:146 /
    // ChannelsSection.vue:223,276 三处的既有做法不一致 —— 那三处删除失败一律兜底
    // t('aiCfgDeleteFailed')(「删除失败」)。Vue2 两处都不构成约束(Vue2 只是裸显示
    // e.message,可能是空串),所以这属于可改的逻辑修正,不是 1:1 违规:brief 的选择
    // 被最终评审推翻,改成与另外三处一致的 aiCfgDeleteFailed。
    toast.show(apiErrorMessage(e, t('aiCfgDeleteFailed')), 3000, 'danger')
  }
}
</script>

<template>
  <div class="set-inner">
    <div class="set-page-head">
      <h1 class="set-h1">{{ t('aiCfgFilesystem') }}</h1>
      <p class="set-desc">{{ t('aiCfgBlacklistDesc') }}</p>
    </div>

    <div class="sk-section">
      <div class="sk-section-head">
        <div class="sk-section-title">{{ t('aiCfgBuiltinReadonly') }}</div>
        <div class="sk-section-hint">{{ BUILTIN.length }}</div>
      </div>
      <div class="sk-section-body">
        <div class="fs-chips">
          <span v-for="(p, i) in BUILTIN" :key="i" class="fs-chip">
            <span class="lk"><AgentIcon name="lock" :size="11" /></span>{{ p }}
          </span>
        </div>
      </div>
    </div>

    <div class="sk-section">
      <div class="sk-section-head">
        <div class="sk-section-title">{{ t('aiCfgYourPatterns') }}</div>
        <div class="sk-section-hint">{{ store.blacklist.length }}</div>
      </div>
      <div class="sk-section-body">
        <div class="set-addrow">
          <input
            v-model="newPattern"
            class="set-input mono"
            maxlength="256"
            :placeholder="t('aiCfgPatternPlaceholder')"
            @keydown.enter="add"
          >
          <button class="set-addbtn" :disabled="!newPattern || adding" @click="add">
            {{ adding ? t('aiCfgAddingPattern') : t('aiCfgAddPattern') }}
          </button>
        </div>
        <div v-if="store.blacklist.length === 0" class="fs-empty">
          {{ t('aiCfgNoCustomPatterns') }}
        </div>
        <div v-for="p in store.blacklist" v-else :key="p.id" class="fs-userrow">
          <span class="pat">{{ p.pattern }}</span>
          <button class="dir-del" :title="t('aiCfgDelete')" @click="remove(p.id)">
            <AgentIcon name="trash" :size="14" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
