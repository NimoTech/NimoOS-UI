<!--
  1:1 移植自 Vue2 src/views/AI/Agent/tabs/SystemTab.vue(56 行)。SP8-P1c2 Task 11。

  用户拍板的有意偏离(brief 明确指出):Vue2 `mounted` 一次性拉 `/sys/utilization`
  且从不刷新;这里改用 New-UI 现成的实时通道 `useUtilization()`(首帧 HTTP +
  MessageBus `nimoos:system:utilization` 持续推送)驱动 2x2 磁贴的 `systemTiles`
  取值。存储条仍是一次性拉取(容量不需要实时,与 Vue2 同),数据源在
  `AgentPage.vue` 的 `onMounted` 里用 `service.disks.list()` 拉好、经
  `toStoragePayload` 转换后作为 `storage` prop 传入(Task 13 才会把这个 prop
  真正接到渲染出的 `AgentRightPanel` 上——本任务只保证组件自身独立可测)。

  Vue2 缺陷修复(项目 2026-07-27 拍板"移植纪律·界面照 Vue2 逻辑照正确")——
  CPU 磁贴的取值 bug 详见 `../../util/systemTiles.ts` 头部注释:Vue2 把标量
  `cpu.percent` 当数组用 `.length` 判断,导致 CPU 磁贴永远显示 "—"。已在纯函数
  里修复并在报告里登记。

  `useUtilization()` 挂载/卸载订阅由 composable 自己管(`onMounted`
  fetchOnce+订阅、`onUnmounted` 退订)。本组件是 `AgentRightPanel` 的
  `v-else-if="tab === 'system'"` 分支,切 tab 会卸载/重挂:每次重新挂载都会
  再 fetchOnce 一次 + 重新订阅一次,卸载时对应退订一次——composable 内部用一个
  局部闭包变量 `off` 持有当次订阅的取消函数,不会跨挂载期累积监听器,反复
  挂卸不会泄漏(SystemTab.test.ts 的"磁贴随实时数据更新"用例间接验证了订阅确实
  生效;Pinia store 本身是单例、跨挂载期保留最后一次数据,这也是刻意的——用户
  切走 System tab 再切回来,磁贴应该还留着上一屏看到的值,不必是空白)。
-->
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUtilization } from '../../../composables/useUtilization'
import { systemTiles } from '../../util/systemTiles'
import type { StoragePayload } from '../../util/toStoragePayload'
import StorageCard from '../blocks/StorageCard.vue'

withDefaults(
  defineProps<{ storage?: StoragePayload | null }>(),
  { storage: null },
)

const { t } = useI18n()
const utilStore = useUtilization()
const tiles = computed(() => systemTiles(utilStore.data))
</script>

<template>
  <div>
    <div style="font-size: 12px; color: var(--text-tertiary); margin-bottom: 10px;
                font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px">
      {{ t('aiSysHeader') }}
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px">
      <div v-for="m in tiles" :key="m.labelKey"
           style="padding: 10px 12px; border-radius: 12px; background: var(--bg-elevated); border: 1px solid var(--line-faint)">
        <div style="font-size: 11px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.4px; font-weight: 600">
          {{ t(m.labelKey) }}
        </div>
        <div style="font-size: 18px; font-weight: 600; letter-spacing: -0.02em; margin-top: 2px; font-variant-numeric: tabular-nums">
          {{ m.value }}
        </div>
        <div style="font-size: 11px; color: var(--text-tertiary)">
          {{ m.subKey ? t(m.subKey, m.subParams || {}) : (m.subText || '') }}
        </div>
      </div>
    </div>

    <StorageCard v-if="storage" v-bind="storage" />
    <div v-else style="padding: 16px; text-align: center; color: var(--text-tertiary); font-size: 12px">
      {{ t('aiStorageUnavailable') }}
    </div>
  </div>
</template>
