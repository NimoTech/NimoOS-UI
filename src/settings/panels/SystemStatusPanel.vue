<script setup lang="ts">
// 设置 · 系统状态。对位 Vue2 components/settings/SystemStatus.vue(89 行)。
// 数据源:GET /v1/gateway/components(**裸 JSON 无信封**,P1 实测校正①)。
// Vue2 的失败分支是"清空 + 空态",这里照留(它不是吞错:整块内容就是这一个接口)。
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { service, type GatewayComponent } from '@nimotech/nimoos-service'
import SettingsSection from '../components/SettingsSection.vue'
import { groupComponents, statusHint } from '../util/components'
import '../styles/settings.css'

const { t } = useI18n()
const components = ref<GatewayComponent[]>([])
const loading = ref(false)
const groups = computed(() => groupComponents(components.value))

// 异步过期守卫(全局约束 #2,就地实现,不抽公共 helper):
// 刷新按钮可在挂载取数落定前再次触发 load(),两次请求谁先返回不确定。
// 用一个代际计数器标记"当前是第几次 load 发起的",落定时只有代数仍是最新的
// 那一次才允许写 components —— 更旧的一次即使后落定也必须被丢弃。
let loadSeq = 0

async function load() {
  const seq = ++loadSeq
  loading.value = true
  try {
    const data = await service.sys.getGatewayComponents()
    if (seq !== loadSeq) return // 已被更新的一次 load 取代,丢弃这份旧结果
    components.value = data
  } catch {
    if (seq !== loadSeq) return
    components.value = []
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}
onMounted(load)
</script>

<template>
  <SettingsSection :title="t('settingsStatusTitle')">
    <div class="set-comp-head">
      <!-- Vue2 对位用 Buefy b-button :loading="loading"(只转圈,不禁用点击)——
           这里不加 disabled 是刻意保持一致:允许用户在请求进行中再次点刷新,
           新旧两次谁先落定不确定,靠上面的代际计数器守卫,而不是靠禁用按钮堵住这条路。 -->
      <button
        class="set-btn set-comp-refresh" type="button"
        :title="t('settingsStatusRefresh')" @click="load"
      >
        {{ t('settingsStatusRefresh') }}
      </button>
    </div>

    <div v-for="g in groups" :key="g.key" class="set-comp-group">
      <p class="set-comp-group-title">{{ t(g.labelKey) }}</p>
      <div v-for="c in g.items" :key="c.name" class="set-comp-row">
        <span class="set-comp-dot" :class="c.status === 'online' ? 'is-online' : 'is-offline'" />
        <span class="set-comp-name">{{ c.name }}</span>
        <span class="set-comp-ver">{{ c.version || '—' }}</span>
        <span
          class="set-comp-state"
          :class="c.status === 'online' ? 'is-online' : 'is-offline'"
          :title="c.status === 'online' ? undefined : statusHint(c)"
        >
          {{ c.status === 'online' ? t('settingsStatusOnline') : t('settingsStatusOffline') }}
        </span>
      </div>
    </div>

    <p v-if="!loading && !components.length" class="set-comp-empty">{{ t('settingsStatusNoData') }}</p>
  </SettingsSection>
</template>
