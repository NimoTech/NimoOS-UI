<script setup lang="ts">
// 单条 VM 行。视觉 1:1 对 Vue2 components/KVM/KVMFullPage.vue:36-58
// (vm-list-item / vm-item-icon / vm-item-info / vm-item-status 结构)。
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { KvmVM } from '@nimotech/nimoos-service'
import { stateLabelKey } from '../util/vmState'
import { formatRam, osIconFor } from '../util/format'

const props = defineProps<{ vm: KvmVM; active: boolean }>()
defineEmits<{ select: [] }>()

const { t, te } = useI18n()

// stateLabelKey(T1)对已知状态返回 i18n key,对未知状态(crashed/missing)原样返回
// 后端 state 字符串——那不是一个真实的 i18n key。用 te() 判断是否真注册过再决定要不要
// t(),没注册就直接显示原字符串:效果上等价于 Vue2 `$t(getStateLabel(state))`(vue-i18n
// 对不存在的 key 也是原样吐出),但用 te() 判断能避免控制台被 vue-i18n 的缺 key 警告刷屏。
const stateKey = computed(() => stateLabelKey(props.vm.state))
const stateText = computed(() => (te(stateKey.value) ? t(stateKey.value) : stateKey.value))
</script>

<template>
  <div class="vm-list-item" :class="{ active }" @click="$emit('select')">
    <div class="vm-item-icon">
      <img :src="osIconFor(vm.os)" :alt="vm.os" class="os-icon" />
    </div>
    <div class="vm-item-info">
      <span class="vm-item-name">{{ vm.name }}</span>
      <div class="vm-item-specs">
        <span>{{ vm.vcpu }} vCPU</span>
        <span>{{ formatRam(vm.memory) }}</span>
      </div>
    </div>
    <div class="vm-item-status">
      <div class="status-indicator">
        <span class="status-dot" :class="vm.state"></span>
        <span class="status-text">{{ stateText }}</span>
      </div>
    </div>
  </div>
</template>
