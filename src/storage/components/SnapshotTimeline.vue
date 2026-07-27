<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSnapshotStore } from '../stores/snapshot'
import { groupSnapshotsByDay, defaultExpandedDayKeys } from '../util/snapshotView'

defineOptions({ name: 'SnapshotTimeline' })
const props = defineProps<{ volumeUuid: string }>()
const store = useSnapshotStore()
const { t } = useI18n()

const expandedKeys = ref<string[]>([])
let expandInitialized = false

const groups = computed(() => groupSnapshotsByDay(store.snapshots))

// Vue2:首次拿到非空分组时才初始化默认展开(最近 2 天),之后刷新不覆盖用户的折叠选择
watch(groups, (g) => {
  if (!expandInitialized && g.length) {
    expandedKeys.value = defaultExpandedDayKeys(g)
    expandInitialized = true
  }
})

watch(() => props.volumeUuid, (uuid) => {
  expandInitialized = false
  expandedKeys.value = []
  store.loadSnapshots(uuid)
})

onMounted(() => { store.loadSnapshots(props.volumeUuid) })

const isExpanded = (dayKey: string) => expandedKeys.value.includes(dayKey)
function toggleGroup(dayKey: string) {
  expandedKeys.value = isExpanded(dayKey)
    ? expandedKeys.value.filter((k) => k !== dayKey)
    : [...expandedKeys.value, dayKey]
}
</script>

<template>
  <div class="st">
    <div class="st-header">{{ t('snapHistory') }}</div>

    <div v-if="store.listLoading" class="st-skeleton">
      <div v-for="n in 3" :key="n" class="st-skeleton-row"></div>
    </div>

    <div v-else-if="groups.length === 0" class="st-empty">
      <p>{{ t('snapNoneYet') }}</p>
      <p>{{ t('snapEmptyHint') }}</p>
    </div>

    <div v-else class="st-body">
      <div v-for="group in groups" :key="group.dayKey" class="st-group">
        <button type="button" class="st-group-header" @click="toggleGroup(group.dayKey)">
          <span class="st-chevron" :class="{ open: isExpanded(group.dayKey) }">›</span>
          <span class="st-group-label">{{ group.label.i18nKey ? t(group.label.i18nKey) : group.label.text }}</span>
          <span class="st-group-count">{{ group.items.length }}</span>
        </button>
        <transition name="st-collapse">
          <ul v-if="isExpanded(group.dayKey)" class="st-list">
            <li v-for="item in group.items" :key="item.id != null ? item.id : item.name" class="st-item">
              <span class="st-dot" :class="item.typeKind"></span>
              <div class="st-info">
                <span class="st-time">{{ item.time }}</span>
                <span class="st-badge" :class="item.typeKind">{{ t(item.typeLabelKey) }}</span>
                <span v-if="item.label" class="st-label">{{ item.label }}</span>
              </div>
              <div class="st-actions">
                <!-- [浏览] 未迁:跳文件区快照只读浏览属文件区快照套件(只读横幅/禁写/退出),
                     SP4 未迁、SP6-P5 决策推迟到独立一期(见 P5 计划台账)。删除按钮:P5 T6 -->
              </div>
            </li>
          </ul>
        </transition>
      </div>
    </div>
  </div>
</template>

<style scoped>
.st { border-top: 1px solid var(--card-border); }
.st-header { padding: 8px 12px 2px; font-size: 11px; font-weight: 600; color: var(--fg-muted); text-transform: uppercase; letter-spacing: 0.4px; }
.st-empty { padding: 12px; text-align: center; }
.st-empty p { margin: 0 0 4px; font-size: 12px; color: var(--fg-muted); }
.st-skeleton { padding: 8px 12px; }
.st-skeleton-row {
  height: 14px; border-radius: 4px; margin-bottom: 8px;
  background: linear-gradient(90deg, var(--skeleton-bg) 25%, var(--nrm-bg) 37%, var(--skeleton-bg) 63%);
  background-size: 400% 100%; animation: st-shimmer 1.4s ease infinite;
}
.st-skeleton-row:last-child { margin-bottom: 0; }
.st-group:not(:last-child) { border-bottom: 1px solid var(--card-border); }
.st-group-header {
  display: flex; align-items: center; gap: 6px; width: 100%; padding: 6px 12px;
  background: none; border: none; cursor: pointer; font-family: inherit; text-align: left; color: var(--fg);
}
.st-group-header:hover { background: var(--hover); }
.st-chevron { display: inline-block; font-size: 12px; color: var(--fg-muted); transition: transform 0.15s var(--ease); }
.st-chevron.open { transform: rotate(90deg); }
.st-group-label { font-size: 12px; font-weight: 500; }
.st-group-count { margin-left: auto; font-size: 10px; font-weight: 600; color: var(--fg-muted); background: var(--nrm-bg); border-radius: 999px; padding: 0 7px; line-height: 16px; }
.st-list { position: relative; list-style: none; margin: 0; padding: 2px 12px 6px; }
.st-list::before { content: ''; position: absolute; top: 0; bottom: 10px; left: 20px; width: 1px; background: var(--card-border); }
.st-item { position: relative; display: flex; align-items: flex-start; gap: 10px; padding: 7px 0 7px 22px; border-radius: 6px; }
.st-item:hover { background: var(--hover); }
.st-item:hover .st-actions { opacity: 1; pointer-events: auto; }
.st-dot { position: absolute; left: 16px; top: 12px; width: 8px; height: 8px; border-radius: 50%; border: 2px solid var(--card-bg); box-shadow: 0 0 0 1px var(--card-border); }
.st-dot.auto { background: var(--nrm-fg); }
.st-dot.manual { background: var(--accent); }
.st-dot.preop { background: var(--dem-fg); }
.st-info { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; flex: 1 1 auto; min-width: 0; }
.st-time { font-size: 12px; font-weight: 500; font-family: var(--num-font); }
.st-badge { padding: 1px 7px; border-radius: 999px; font-size: 10px; font-weight: 500; }
.st-badge.auto { background: var(--nrm-bg); color: var(--nrm-fg); }
.st-badge.manual { background: var(--accent-soft); color: var(--accent); }
.st-badge.preop { background: var(--dem-bg); color: var(--dem-fg); }
.st-label { font-size: 12px; color: var(--fg-muted); overflow: hidden; text-overflow: ellipsis; }
/* hover 才显形,但保留在 DOM 里可 tab(Vue2 注释同款理由) */
.st-actions { display: flex; flex: none; gap: 6px; opacity: 0; pointer-events: none; transition: opacity 0.15s var(--ease); }

@keyframes st-shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }

/* Vue2 SnapshotTimeline.vue:353-361 的折叠/展开过渡 1:1 移植 —— 颜色/时长照搬,
   仅类名按 Vue3 Transition 语义改写:Vue2 用 `-enter`,Vue3 用 `-enter-from`
  (`-leave-to`/`-enter-active`/`-leave-active` 两版同名)。 */
.st-collapse-enter-active,
.st-collapse-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.st-collapse-enter-from,
.st-collapse-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
