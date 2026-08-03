<script setup lang="ts">
// KVM 区弹窗外壳。视觉 1:1 对 Vue2 KVMFullPage.vue 的 .create-vm-modal 三段结构
// (:233-238 head / :404 body / :488-492 foot),四个弹窗与 OSSelector 全部套它。
//
// ⚠️ 为什么不复用全局 components/ui/Dialog.vue:它的背景是 var(--popup-bg) 玻璃 +
// --card-border,浅色主题下会变白底,与「KVM 区固定深色」(spec §6.1)直接冲突,而它的
// <style scoped> 从外面覆盖不了。这里用同一套 reka-ui 原语(白拿焦点陷阱 / Esc /
// 遮罩点击关闭),但 class 全走 --kvm-*。属已申报的结构偏离(spec §6.2.5 第 1 条):
// Vue2 用的是 buefy b-modal(创建/设置/全局设置)+ 手写 overlay(OSSelector),
// 这里统一到 reka —— 视觉 1:1,容器实现变。
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle } from 'reka-ui'
import { useI18n } from 'vue-i18n'
import { useSlots } from 'vue'

const props = withDefaults(defineProps<{
  open: boolean
  title: string
  /** Vue2 各弹窗的 :width(创建 560 / VM 设置 600 / 全局设置 560 / OSSelector max 40rem)。 */
  width?: string
  /** 遮罩 z-index;内容取 zBase+1。默认 900(KVM 弹窗层),OSSelector 传 920 叠在创建弹窗之上。
   *  P5 的 ProgressOverlay 是 1000,因此进度遮罩天然盖在弹窗之上,与 Vue2 b-modal 次序一致。 */
  zBase?: number
}>(), { width: '560px', zBase: 900 })

const emit = defineEmits<{ 'update:open': [v: boolean] }>()
const { t } = useI18n()
const slots = useSlots()
</script>

<template>
  <DialogRoot :open="open" @update:open="emit('update:open', $event)">
    <DialogPortal>
      <DialogOverlay class="kvm-dialog-overlay" :style="{ zIndex: String(props.zBase) }" />
      <DialogContent
        class="kvm-dialog-content create-vm-modal"
        :style="{ zIndex: String(props.zBase + 1), width: props.width }"
        :aria-describedby="undefined"
      >
        <header class="create-vm-head">
          <DialogTitle class="create-vm-title">{{ title }}</DialogTitle>
          <!-- ✕ 是单色文字符号(禁 emoji),同 P5 的 ⚙/⋮/‹ 一批占位债务。 -->
          <button
            type="button"
            class="create-vm-close"
            :aria-label="t('kvmClose')"
            @click="emit('update:open', false)"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </header>

        <slot name="tabs" />

        <section class="create-vm-body"><slot /></section>

        <footer v-if="slots.footer" class="create-vm-foot"><slot name="footer" /></footer>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
