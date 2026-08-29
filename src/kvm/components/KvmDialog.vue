<script setup lang="ts">
// Dialog shell for the KVM area. Visual 1:1 with the .create-vm-modal three-part
// structure in Vue2 KVMFullPage.vue (:233-238 head / :404 body / :488-492 foot);
// all four dialogs plus OSSelector wrap in it.
//
// ⚠️ Why not reuse the global components/ui/Dialog.vue: its background is the
// var(--popup-bg) glass + --card-border, which turns white under the light theme —
// directly conflicting with "KVM area is fixed dark" (spec §6.1) — and its
// <style scoped> can't be overridden from outside. This uses the same reka-ui
// primitives (focus trap / Esc / overlay-click close for free), but all classes go
// through --kvm-*. This is a declared structural deviation (spec §6.2.5 item 1):
// Vue2 used buefy b-modal (create/settings/global settings) + a hand-written overlay
// (OSSelector); here everything is unified on reka — visual 1:1, container
// implementation changed.
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle } from 'reka-ui'
import { useI18n } from 'vue-i18n'
import { useSlots } from 'vue'

const props = withDefaults(defineProps<{
  open: boolean
  title: string
  /** The :width of each Vue2 dialog (create 560 / VM settings 600 / global settings 560 / OSSelector max 40rem). */
  width?: string
  /** Overlay z-index; content uses zBase+1. Default 900 (KVM dialog layer); OSSelector passes 920 to stack above the create dialog.
   *  P5's ProgressOverlay is 1000, so the progress overlay naturally covers dialogs, matching the Vue2 b-modal ordering. */
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
          <!-- ✕ is a monochrome text symbol (emoji forbidden), same batch of placeholder debt as P5's ⚙/⋮/‹. -->
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
