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

// consoleEnter/consoleLeave/consoleMove(Task 7,评审修复):把 `.console-display` 上的
// 鼠标事件转发给父组件(KvmPage),父组件驱动 SendKey 悬浮工具条的显隐状态机。
// ⚠️ 架构订正(评审 Important #1):Task 7 最初版本用 `<Teleport :to="hostEl">` +
// 父组件里手写 `addEventListener` 把工具条"塞"进这个节点,理由是 brief 的 Files 清单
// 没列 ConsoleStage.vue。评审指出这是过度谨慎——brief 清单是"预计会改哪些"而不是禁止
// 改动的边界,而"加一个 slot + 转发三个鼠标事件"比 Teleport + 手写生命周期管理更简单、
// 风险面更小(不需要再自己维护"节点变化时摘/挂监听"这一整套,框架的插槽/事件系统本身
// 就保证了这一点)。改这里而不是父组件手写监听,是回到了最直接的方案。
const emit = defineEmits<{
  start: []
  resume: []
  'console-enter': []
  'console-leave': []
  'console-move': [e: MouseEvent]
}>()

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
  <div
    class="console-display"
    ref="hostEl"
    @mouseenter="emit('console-enter')"
    @mouseleave="emit('console-leave')"
    @mousemove="emit('console-move', $event)"
  >
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
    <!-- SendKey 悬浮工具条(Task 7)从这里作为 slot 内容传入,DOM 层级与 Vue2 完全一致
         (工具条是 `.console-display` 的直接子节点),定位基准仍是本组件的 hostEl。 -->
    <slot />
  </div>
</template>
