<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useSnapshotStore } from '../stores/snapshot'
import { groupSnapshotsByDay, defaultExpandedDayKeys } from '../util/snapshotView'
import type { SnapshotItemView } from '../util/snapshotView'
import { snapshotBrowsePath } from '../../files/util/snapshotPath'
import SnapshotDeleteDialog from './SnapshotDeleteDialog.vue'

defineOptions({ name: 'SnapshotTimeline' })
const props = defineProps<{ volumeUuid: string }>()
const store = useSnapshotStore()
const { t } = useI18n()
const router = useRouter()
const mountPoint = computed(() => store.volume?.mount ?? '')

// Jumps to the Files area's read-only snapshot browsing, via the existing deep-link format
// /files?path=<real path>: Files.vue's sync() normalizes it into the canonical /files/<virtual
// segment> (the real-path -> virtual-path mapping depends on displayNames, which isn't fully
// populated on the storage side — better to let Files resolve it itself).
function browse(name: string) {
  if (!mountPoint.value) return
  router.push({ path: '/files', query: { path: snapshotBrowsePath(mountPoint.value, name) } })
}

const expandedKeys = ref<string[]>([])
let expandInitialized = false

const deleteOpen = ref(false)
const deleteTarget = ref<SnapshotItemView | null>(null)
// Time shown in the dialog body: Vue2 uses new Date(item.createdAt).toLocaleString()
const deleteTimeText = computed(() =>
  deleteTarget.value ? new Date(deleteTarget.value.createdAt).toLocaleString() : '',
)

function confirmDelete(item: SnapshotItemView) {
  deleteTarget.value = item
  deleteOpen.value = true
}

// Deviation disclosure (Important I1): Vue2's buefy dialog.confirm closes the dialog as soon
// as you click confirm, then runs the delete request in the background — on failure it only
// shows a toast, and by then the user can't see the dialog anymore. This is **deliberately not
// replicated**: here the dialog only closes after the delete succeeds; on failure it stays put
// (still busy -> non-busy, directly retryable), so the user doesn't have to re-find the entry
// and click delete again — more correct for the user, but explicitly a deviation from Vue2.
async function onDeleteConfirmed() {
  const target = deleteTarget.value
  if (!target) return
  const ok = await store.removeSnapshot(props.volumeUuid, target.name)
  if (ok) { deleteOpen.value = false; deleteTarget.value = null }
}

const groups = computed(() => groupSnapshotsByDay(store.snapshots))

// Vue2: only initializes the default expansion (last 2 days) the first time a non-empty
// group arrives; subsequent refreshes don't override the user's collapse choices
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
                <button v-if="mountPoint" class="st-btn st-browse" type="button" @click="browse(item.name)">
                  {{ t('snapBrowse') }}
                </button>
                <button
                  class="st-btn st-delete"
                  type="button"
                  :disabled="store.deletingName !== null"
                  @click="confirmDelete(item)"
                >{{ t('snapDelete') }}</button>
              </div>
            </li>
          </ul>
        </transition>
      </div>
    </div>

    <SnapshotDeleteDialog
      :open="deleteOpen"
      :time-text="deleteTimeText"
      :busy="store.deletingName !== null"
      @update:open="deleteOpen = $event"
      @confirm="onDeleteConfirmed"
    />
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
/* Only visible on hover, but kept in the DOM so it stays tabbable (same rationale as the Vue2 comment) */
.st-actions { display: flex; flex: none; gap: 6px; opacity: 0; pointer-events: none; transition: opacity 0.15s var(--ease); }
.st-btn { padding: 3px 10px; border-radius: 999px; font-size: 11px; cursor: pointer; font-family: inherit; }
.st-browse { border: 1px solid var(--accent); background: var(--chip-bg); color: var(--accent); }
.st-delete {
  border: 1px solid var(--remove-fg); background: var(--chip-bg); color: var(--remove-fg);
}
.st-delete:disabled { opacity: 0.45; cursor: not-allowed; }

@keyframes st-shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }

/* Ported 1:1 from Vue2 SnapshotTimeline.vue:353-361's collapse/expand transition — colors and
   durations carried over as-is, only the class names rewritten for Vue3 Transition semantics:
   Vue2 uses `-enter`, Vue3 uses `-enter-from`
  (`-leave-to`/`-enter-active`/`-leave-active` share the same names in both versions). */
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
