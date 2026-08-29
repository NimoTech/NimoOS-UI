<script setup lang="ts">
// Single VM row. Visual 1:1 match of Vue2 components/KVM/KVMFullPage.vue:36-58
// (vm-list-item / vm-item-icon / vm-item-info / vm-item-status structure).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { KvmVM } from '@nimotech/nimoos-service'
import { stateLabelKey } from '../util/vmState'
import { formatRam, osIconFor } from '../util/format'

const props = defineProps<{ vm: KvmVM; active: boolean }>()
defineEmits<{ select: [] }>()

const { t, te } = useI18n()

// stateLabelKey(T1) returns an i18n key for known states, and returns the backend
// state string as-is for unknown states (crashed/missing) — which is not a real i18n
// key. Use te() to check whether it's actually registered before deciding whether to
// call t(); if not registered, just display the original string. This is functionally
// equivalent to Vue2 `$t(getStateLabel(state))` (vue-i18n also returns non-existent
// keys as-is), but using te() to check avoids the console being flooded with
// vue-i18n's missing-key warnings.
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
