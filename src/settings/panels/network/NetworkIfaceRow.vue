<script setup lang="ts">
// 接口列表里的一行。对位 Vue2 SettingsPanel.vue L500-577。
// 菜单项按 wireless.mode 决定(Vue2 L545-550 的注释表):
//   ap          → 编辑 + 切到 Wi-Fi (+ 混合,若 hybridCapable)
//   client      → 编辑 + 切到热点   (+ 混合,若 hybridCapable)
//   concurrent  → 只有编辑
//   无 wireless → 只有编辑
// 虚拟口(zt*/docker0/br-*/veth*)不给菜单,用等宽占位保持右侧对齐。
// ⚠️ 菜单样式故意不复用 apps/components/AppActionsMenu.vue 的 .ui-drop-*:那是**非 scoped
//    全局块**,只在该组件被 import 时注入;设置区不 import 它 → 菜单会裸奔。
//    改用 settings.css 里自带的 .set-net-menu-*。
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
          <!-- DHCP / Static 在 Vue2 侧就是硬编码英文字面量(L518),不走 i18n,照留 -->
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
