<script setup lang="ts">
// A single row in the interface list. Corresponds to Vue2 SettingsPanel.vue L500-577.
// Menu items are decided by wireless.mode (per the comment table in Vue2 L545-550):
//   ap          → Edit + switch to Wi-Fi (+ Hybrid, if hybridCapable)
//   client      → Edit + switch to Hotspot (+ Hybrid, if hybridCapable)
//   concurrent  → Edit only
//   no wireless → Edit only
// Virtual interfaces (zt*/docker0/br-*/veth*) get no menu; a fixed-width spacer keeps the right edge aligned.
// ⚠️ The menu style deliberately does not reuse apps/components/AppActionsMenu.vue's .ui-drop-*:
//    that is a **non-scoped global block**, only injected when that component is imported;
//    the settings area does not import it → the menu would render unstyled.
//    Use settings.css's own .set-net-menu-* instead.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  DropdownMenuRoot, DropdownMenuTrigger, DropdownMenuPortal, DropdownMenuContent, DropdownMenuItem,
} from 'reka-ui'
import type { MergedIface } from '../../util/netMerge'
import { ifaceTypeKey, speedLabel } from '../../util/ifaceDisplay'
import '../../styles/settings.css'

defineOptions({ name: 'NetworkIfaceRow' })
const props = defineProps<{ iface: MergedIface }>()
const emit = defineEmits<{ edit: []; switchMode: [mode: 'ap' | 'client' | 'concurrent'] }>()
const { t } = useI18n()

const typeName = computed(() => t(ifaceTypeKey(props.iface)))
const speed = computed(() => speedLabel(props.iface.speed, props.iface.maxSpeed))
const mode = computed(() => props.iface.wireless?.mode ?? '')
const switchable = computed(() => !!props.iface.wireless && mode.value !== 'concurrent')
</script>

<template>
  <div class="set-net-row">
    <span class="set-net-dot" :class="{ up: iface.state === 'up' }" aria-hidden="true"></span>

    <div class="set-net-main">
      <div class="set-net-type">{{ typeName }}</div>
      <div class="set-net-tags">
        <span class="set-net-tag">{{ iface.name }}</span>
        <span v-if="speed" class="set-net-tag">{{ speed }}</span>
        <span v-if="iface.addr" class="set-net-tag">
          <!-- DHCP / Static are hardcoded English literals on the Vue2 side (L518), not routed through i18n — kept as-is -->
          <span class="set-net-tag-key">{{ iface.dhcp ? 'DHCP' : 'Static' }}</span>
          {{ iface.addr }}
        </span>
      </div>
    </div>

    <DropdownMenuRoot v-if="!iface.isVirtual">
      <DropdownMenuTrigger class="set-net-menu-btn" :aria-label="t('settingsNetMenu')">⋮</DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent class="set-net-menu" :collision-padding="8" :side-offset="4" align="end">
          <DropdownMenuItem class="set-net-menu-item" @select="emit('edit')">
            {{ t('settingsNetEdit') }}
          </DropdownMenuItem>
          <template v-if="switchable">
            <DropdownMenuItem
              v-if="mode === 'ap'"
              class="set-net-menu-item"
              @select="emit('switchMode', 'client')"
            >{{ t('settingsNetSwitchClient') }}</DropdownMenuItem>
            <DropdownMenuItem
              v-if="mode === 'client'"
              class="set-net-menu-item"
              @select="emit('switchMode', 'ap')"
            >{{ t('settingsNetSwitchAp') }}</DropdownMenuItem>
            <DropdownMenuItem
              v-if="iface.hybridCapable"
              class="set-net-menu-item"
              @select="emit('switchMode', 'concurrent')"
            >{{ t('settingsNetSwitchHybrid') }}</DropdownMenuItem>
          </template>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
    <span v-else class="set-net-menu-spacer" aria-hidden="true"></span>
  </div>
</template>
