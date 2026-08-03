<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
function goHome() {
  router.push('/')
}
</script>

<template>
  <div class="storage-shell">
    <header class="st-bar">
      <button class="st-home" type="button" @click="goHome">‹ {{ t('areaBackHome') }}</button>
      <h1 class="st-title">{{ t('storageTitle') }}</h1>
      <nav class="st-tabs">
        <RouterLink to="/storage" class="st-tab" :class="{ active: route.path === '/storage' }">{{ t('storageTabVolumes') }}</RouterLink>
        <RouterLink to="/storage/drives" class="st-tab" :class="{ active: route.path === '/storage/drives' }">{{ t('storageTabDrives') }}</RouterLink>
        <RouterLink to="/storage/raid" class="st-tab" :class="{ active: route.path.startsWith('/storage/raid') }">{{ t('storageTabRaid') }}</RouterLink>
      </nav>
    </header>
    <main class="st-body"><slot /></main>
  </div>
</template>

<style scoped>
/*
 * 布局约束(实盘验收 acceptance-fix-3):body 全局是 overflow:hidden(见 src/styles/theme.css:302,
 * 桌面端体验需要,不能改),所以本区域的滚动必须由 .st-body 这个「受视口约束」的容器自己承担。
 * 壳(.storage-shell)必须用 height 而不是 min-height —— min-height 会让壳随内容一起长高,
 * 永远撑满、永远不会被视口卡住,.st-body 的 overflow-y:auto 就永远量不出溢出、滚动条永不出现。
 * 参照同类外壳 src/components/shell/AreaShell.vue(文件区在用,滚动正常)的写法对齐。
 * 两行 height 是给不支持 dvh 的旧浏览器兜底,不要合并/删除其中一行。
 */
.storage-shell { height: 100vh; height: 100dvh; display: flex; flex-direction: column; background: var(--bg); color: var(--fg); }
.st-bar { display: flex; align-items: center; gap: 14px; padding: 14px 22px; flex: 0 0 auto; }
.st-home {
  border: 1px solid var(--chip-border); background: var(--chip-bg); color: var(--fg);
  border-radius: 999px; padding: 6px 14px; font-size: 13px; cursor: pointer; white-space: nowrap;
}
.st-home:hover { background: var(--chip-bg-hi); }
.st-title { font-size: 18px; font-weight: 600; margin: 0; }
.st-tabs { display: flex; gap: 6px; margin-left: auto; }
.st-tab {
  padding: 6px 16px; border-radius: 999px; font-size: 13px; text-decoration: none;
  color: var(--fg-muted); border: 1px solid transparent;
}
.st-tab:hover { color: var(--fg); background: var(--hover); }
.st-tab.active { color: var(--fg); background: var(--chip-bg-hi); border-color: var(--chip-border); }
/* min-height: 0 是必须的:flex 子项默认 min-height:auto,会阻止它收缩到小于内容高度,
 * 导致 overflow-y:auto 失效(内容再高也不触发滚动条)。AreaShell 靠 flex:1 1 auto 侥幸没踩到,
 * 这里显式写 0 更稳,不依赖浏览器实现细节。 */
.st-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 8px 22px 28px; }
.st-body > :deep(*) { max-width: 980px; margin-left: auto; margin-right: auto; }
@media (max-width: 768px) {
  .st-bar { flex-wrap: wrap; padding: 10px 14px; gap: 8px; }
  .st-tabs { margin-left: 0; width: 100%; }
  .st-body { padding: 4px 14px 20px; }
}
</style>
