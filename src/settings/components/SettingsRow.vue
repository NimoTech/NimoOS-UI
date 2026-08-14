<script setup lang="ts">
// Generic skeleton for one row in a settings list. Counterpart of Vue2 SettingsPanel.vue's .settings-list-item:
// left label (optional subtitle) stretches, control on the right, clickable rows get › at the far right.
// Vue2 also has a casa icon-font icon on the left of each row (b-icon pack="casa");
// New-UI has not adopted that icon font (still CasaOS-branded assets, see iconfonts-casaos debt note in the top-level CLAUDE.md),
// so no inline row icon in this sprint — a pre-existing icon-system difference, not a new deviation.
import '../styles/settings.css'

defineProps<{ label: string; sub?: string; clickable?: boolean; disabled?: boolean }>()
const emit = defineEmits<{ click: [] }>()
</script>

<template>
  <div class="set-row-wrap">
    <component
      :is="clickable ? 'button' : 'div'"
      class="set-list-item"
      :class="{ clickable }"
      :type="clickable ? 'button' : undefined"
      :disabled="clickable && disabled ? true : undefined"
      @click="clickable && !disabled && emit('click')"
    >
      <span class="set-row-text">
        <span class="set-row-label">{{ label }}</span>
        <span v-if="sub" class="set-row-sub">{{ sub }}</span>
      </span>
      <span class="set-row-ctl"><slot name="control" /></span>
      <span v-if="clickable" class="set-chevron" aria-hidden="true">›</span>
    </component>
    <p v-if="$slots.hint" class="set-row-hint"><slot name="hint" /></p>
  </div>
</template>
