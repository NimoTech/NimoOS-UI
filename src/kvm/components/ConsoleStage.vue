<script setup lang="ts">
// 控制台画布宿主(VNC 画布挂载点)+ 占位层(错误提示 / 开机·恢复大按钮)。
// 视觉 1:1 对 Vue2 components/KVM/KVMFullPage.vue `.console-display`/`.console-placeholder`
// 那段模板(:154-192,2026-08-02 核对)。真正的 RFB 生命周期归 useVncConsole.ts,本组件
// 只负责给它一个稳定的挂载点(hostEl)+ 渲染"没连上时该显示什么"。
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { KvmVM } from '@nimotech/nimoos-service'
import powerIcon from '../assets/power.svg'
import playIcon from '../assets/play.svg'

const props = defineProps<{
  vm: KvmVM
  connected: boolean
  /** 可能是 i18n key(如 'kvmVncFetchFailed'),也可能是已经解析好的原文——
   * 两种情况都交给下面的 errorText 用 te()/t() 统一判定,同 KvmPage 里 lastErrorText
   * 的既有写法(P5 evaluation 已定的约定)。 */
  errorKey: string
  processing: boolean
}>()

const emit = defineEmits<{ start: []; resume: [] }>()

const { t, te } = useI18n()

const errorText = computed(() => (props.errorKey && te(props.errorKey)) ? t(props.errorKey) : props.errorKey)

// 评审 Minor 登记(未申报偏离,补注册):Vue2 这两个 <img alt> 是字面英文
// "Power"/"Play"(KVMFullPage.vue:178/188),这里换成了 t('kvmPowerOn')/t('kvmResume')
// (随语言切换、且与按钮自己的 aria-label 保持一致,不会出现"屏幕阅读器读中文、alt 读
// 英文"的割裂)。两个按钮的 `type="button"` 也是新增——Vue2 那两个 <button> 没有显式
// type,本仓库其它按钮(ConsoleHeader/OverflowMenu)都写了 type="button" 防止意外提交
// 表单,这里补齐同款惯例。均为无害改进,不回退。

// 这个 div 就是 Vue2 `ref="consoleDisplay"` 那个节点——noVNC 把 canvas 挂进这里,
// useVncConsole 也从这里清残留 canvas。expose 给父组件(KvmPage)转交给 useVncConsole。
const hostEl = ref<HTMLElement | null>(null)
defineExpose({ hostEl })
</script>

<template>
  <div class="console-display" ref="hostEl">
    <div v-if="!connected" class="console-placeholder">
      <p v-if="errorText" class="console-hint is-error">{{ errorText }}</p>
      <template v-else>
        <button
          v-if="vm.state === 'stopped'"
          type="button"
          class="start-vm-btn"
          :disabled="processing"
          :aria-label="t('kvmPowerOn')"
          @click="emit('start')"
        >
          <span class="power-icon">
            <img :src="powerIcon" :alt="t('kvmPowerOn')" class="power-svg" />
          </span>
        </button>
        <button
          v-if="vm.state === 'paused'"
          type="button"
          class="start-vm-btn"
          :disabled="processing"
          :aria-label="t('kvmResume')"
          @click="emit('resume')"
        >
          <span class="power-icon">
            <img :src="playIcon" :alt="t('kvmResume')" class="power-svg" />
          </span>
        </button>
      </template>
    </div>
  </div>
</template>
