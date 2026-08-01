<script setup lang="ts">
// KVM 区主页(路由 /kvm)。视觉 1:1 对 Vue2 components/KVM/KVMFullPage.vue。
// P5 = 列表 + 控制台 + 电源;P6 补创建向导 / VM 设置 / 快照 / 全局设置。
//
// ⚠️ 本区**固定深色,不跟随全局主题** —— Vue2 该页是写死的深色控制台配色,
// --kvm-* token 在两个主题块里同值(见 styles/theme.sp9.css 注释)。
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import '../styles/kvm.css'

const { t } = useI18n()

// Vue2 isSidebarCollapsed = sidebarCollapsed && !sidebarHover ——
// 折叠后鼠标移上去临时展开,移开又收回。照抄(KVMFullPage.vue:689-690)。
const sidebarCollapsed = ref(false)
const sidebarHover = ref(false)
const collapsed = computed(() => sidebarCollapsed.value && !sidebarHover.value)
</script>

<template>
  <div class="kvm-page">
    <div class="kvm-content">
      <button
        class="kvm-sidebar-toggle"
        :class="{ collapsed }"
        :aria-label="t('kvmToggleSidebar')"
        @click="sidebarCollapsed = !sidebarCollapsed"
      >
        <!-- ‹ 是临时占位单色符号(禁 emoji),后续任务(T4/T8)换成 Vue2 同款 collapse svg 图标。 -->
        <span class="toggle-icon" aria-hidden="true">‹</span>
      </button>

      <aside
        class="kvm-sidebar"
        :class="{ collapsed }"
        @mouseenter="sidebarHover = true"
        @mouseleave="sidebarHover = false"
      >
        <header class="kvm-header">
          <div class="kvm-header-left">
            <div class="kvm-header-text">
              <h2 class="kvm-title">{{ t('kvmTitle') }}</h2>
            </div>
          </div>
        </header>
        <div class="vm-list" />
      </aside>

      <main class="kvm-main">
        <div class="main-empty">
          <div class="empty-icon-ring">
            <!-- ▭ 是临时占位单色符号(禁 emoji),后续任务换成 Vue2 同款空态图标。 -->
            <span class="main-empty-icon" aria-hidden="true">▭</span>
          </div>
          <h3>{{ t('kvmSelectVmTitle') }}</h3>
          <p>{{ t('kvmSelectVmHint') }}</p>
        </div>
      </main>
    </div>
  </div>
</template>
