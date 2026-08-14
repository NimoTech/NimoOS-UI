<!--
  SP8-P2b Task 3 — settings area modal shell.

  Vue2's three modals (McpTokensSection token plaintext / ChannelsSection add bot + pair code)
  are hand-written `.sk-modal-bg` bare div + `@click.self` close, no focus trap, Esc not handled.
  This repo uses reka Dialog instead (user approved 2026-07-28; precedent in src/files/components/ dialogs,
  src/components/ui/Dialog.vue), visual rules still `.sk-modal*` ported in Task 1 to sk-shared.scss,
  so users won't notice the structure changed.

  【D1 critical constraint】Must portal back to settings page root element `.set-app`. AI region tokens
  defined in `.agent-app` scope (src/ai/styles/tokens.scss:31), reka DialogPortal by default sends content
  to document.body — sent out of scope, `var(--bg-elevated)` / `var(--line)` etc. all fail to parse,
  modal becomes transparent/wrong color. `defer` on to let Teleport resolve selector after target element
  mounts (settings root and this component same tree, order-safe, but defer is free).
-->
<script setup lang="ts">
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle } from 'reka-ui'
import AgentIcon from '../icons/AgentIcon.vue'

const props = withDefaults(
  defineProps<{ open: boolean; title: string; portalTo?: string }>(),
  { portalTo: '.set-app' },
)
const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>()
// SP8-P3b Task 5 — add an optional footerLeft slot. Vue2 AddSkillModal.vue:96-108 footer is
// two columns: left `.save-note` (save note + check icon), right `.right` (cancel/create buttons),
// sk-shared.scss:139-150 `.sk-modal-foot` already supports both `.save-note` and `.right`
// (latter `margin-left: auto`), but this component originally wedged entire `#footer` slot in `.right` —
// AddSkillModal using only existing slot, "Save locally" line gets pushed right next to buttons, wrong vs Vue2 visual.
// Pure additive: when footerLeft not passed by default <slot name="footerLeft" /> renders no content, existing three consumers
// (ChannelsSection two places, McpTokensSection one place) only pass #footer, behavior unchanged.
const slots = defineSlots<{ default?: () => unknown; footer?: () => unknown; footerLeft?: () => unknown }>()
</script>

<template>
  <DialogRoot :open="props.open" @update:open="emit('update:open', $event)">
    <DialogPortal :to="props.portalTo" defer>
      <DialogOverlay class="sk-modal-bg">
        <DialogContent class="sk-modal" :aria-describedby="undefined">
          <div class="sk-modal-head">
            <DialogTitle class="sk-modal-title">{{ props.title }}</DialogTitle>
            <button type="button" class="sk-x" @click="emit('update:open', false)">
              <AgentIcon name="x" :size="14" />
            </button>
          </div>
          <div class="sk-modal-body"><slot /></div>
          <!-- v-if checks both slots: condition must hold logically when only footerLeft passed without footer
               (even if no consumers do this yet), can't write condition covering only one footer side. -->
          <div v-if="slots.footer || slots.footerLeft" class="sk-modal-foot">
            <slot name="footerLeft" />
            <div class="right"><slot name="footer" /></div>
          </div>
        </DialogContent>
      </DialogOverlay>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
/* Close button: in Vue2 is two identical scoped styles — .mcp-x in McpTokensSection.vue:241-244 and
   .chan-x in ChannelsSection.vue:395-398, consolidated into one here. */
.sk-x {
  width: 28px; height: 28px;
  display: inline-grid; place-items: center;
  border: 0; background: transparent;
  border-radius: 8px; cursor: pointer;
  color: var(--text-secondary);
  transition: background 100ms ease, color 100ms ease;
}
.sk-x:hover { background: var(--bg-chip); color: var(--text-primary); }
</style>
