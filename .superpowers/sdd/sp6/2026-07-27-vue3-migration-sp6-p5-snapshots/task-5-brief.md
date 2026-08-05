### Task 5: 快照历史时间线(`SnapshotTimeline.vue`)+ 嵌进面板

迁移 Vue2 `SnapshotTimeline.vue` 的**列表主体**:标题行 / 3 行骨架 / 空态双句 / 按天分组(默认展开最近 2 组,点组头折叠)/ 条目(类别圆点 + 时钟 + 类别徽章 + 备注)。**[浏览] 按钮不迁**(Global Constraints 第 1 条),条目动作区本 Task 先只留占位;删除按钮在 T6 落。然后把时间线嵌进 `SnapshotPanel`,可见性条件 1:1 照 Vue2:`enabled` 或(`disabled` 且 `count > 0`)。

**Files:**
- Create: `src/storage/components/SnapshotTimeline.vue`
- Test: `src/storage/components/SnapshotTimeline.test.ts`
- Modify: `src/storage/components/SnapshotPanel.vue`、`src/storage/components/SnapshotPanel.test.ts`
- Modify: `src/i18n/zh_cn.ts`、`src/i18n/en_us.ts`(附录 A 标「T5」的 6 个键)

**Interfaces:**
- Consumes: `useSnapshotStore()`(`snapshots`/`listLoading`/`loadSnapshots`);`groupSnapshotsByDay`/`defaultExpandedDayKeys`/`SnapshotDayGroup`(T1)。
- Produces: 组件 props `{ volumeUuid: string }`。稳定 class:根 `.st`、骨架 `.st-skeleton`、空态 `.st-empty`、组头 `.st-group-header`、组名 `.st-group-label`、组计数 `.st-group-count`、条目 `.st-item`、圆点 `.st-dot`(带 `.auto|.manual|.preop` 修饰)、徽章 `.st-badge`、时钟 `.st-time`、备注 `.st-label`。

**Vue2 逐字对照点**(`SnapshotTimeline.vue`):
- `mounted` 拉列表;`volumeUuid` 变化 → 重置展开态并重拉(`:92-104`)。
- 首次拿到非空分组时用 `defaultExpandedDayKeys` 初始化展开键,**只初始化一次**(`expandInitialized` 闸门,`:111-114`)——之后用户的折叠选择不被刷新覆盖。
- 分组头:`›` 雪佛龙(展开时旋转 90°)+ 组名(`i18nKey ? $t(key) : text`)+ 右侧计数。
- 条目 key:`item.id != null ? item.id : item.name`(`:26`)。
- 动作区 hover 才显形(`opacity` 过渡,**不是** `display:none`,保证键盘可达,Vue2 注释 `:339-341`)。

- [ ] **Step 1: 写失败测试** `src/storage/components/SnapshotTimeline.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import SnapshotTimeline from './SnapshotTimeline.vue'
import zh from '../../i18n/zh_cn'

const listMock = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: { snapshot: {
    list: (...a: unknown[]) => listMock(...a),
    listVolumes: vi.fn().mockResolvedValue([]), getPolicy: vi.fn(), patchPolicy: vi.fn(),
    togglePolicy: vi.fn(), create: vi.fn(), remove: vi.fn(),
  } },
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const mountIt = () => mount(SnapshotTimeline, { props: { volumeUuid: 'u1' }, global: { plugins: [i18n] } })
const flush = async (w: ReturnType<typeof mountIt>) => {
  await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()
}
const day = (d: number, h: number) => new Date(2026, 6, d, h, 0).toISOString()

beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

describe('SnapshotTimeline', () => {
  it('挂载即按卷拉列表', async () => {
    listMock.mockResolvedValue([])
    const w = mountIt(); await flush(w)
    expect(listMock).toHaveBeenCalledWith('u1')
  })
  it('加载中显示骨架、加载完不显示', async () => {
    let release: (v: unknown) => void = () => {}
    listMock.mockImplementation(() => new Promise((r) => { release = r }))
    const w = mountIt(); await w.vm.$nextTick()
    expect(w.find('.st-skeleton').exists()).toBe(true)
    release([]); await flush(w)
    expect(w.find('.st-skeleton').exists()).toBe(false)
  })
  it('空列表 → 空态双句', async () => {
    listMock.mockResolvedValue([])
    const w = mountIt(); await flush(w)
    expect(w.find('.st-empty').text()).toContain(zh.snapNoneYet)
    expect(w.find('.st-empty').text()).toContain(zh.snapEmptyHint)
  })
  it('按天分组:组头带组名与计数,最近两组默认展开、第三组收起', async () => {
    listMock.mockResolvedValue([
      { id: 1, name: 'a', type: 'auto-hourly', created_at: day(27, 9) },
      { id: 2, name: 'b', type: 'manual', label: '升级前', created_at: day(27, 20) },
      { id: 3, name: 'c', type: 'preop', created_at: day(26, 8) },
      { id: 4, name: 'd', type: 'auto-daily', created_at: day(20, 8) },
    ])
    const w = mountIt(); await flush(w)
    const headers = w.findAll('.st-group-header')
    expect(headers).toHaveLength(3)
    expect(headers[0].find('.st-group-count').text()).toBe('2')
    // 默认展开最近 2 组 = 3 条可见(2 + 1),第三组收起
    expect(w.findAll('.st-item')).toHaveLength(3)
  })
  it('点组头折叠/展开切换', async () => {
    listMock.mockResolvedValue([{ id: 1, name: 'a', type: 'manual', created_at: day(27, 9) }])
    const w = mountIt(); await flush(w)
    expect(w.findAll('.st-item')).toHaveLength(1)
    await w.find('.st-group-header').trigger('click')
    expect(w.findAll('.st-item')).toHaveLength(0)
    await w.find('.st-group-header').trigger('click')
    expect(w.findAll('.st-item')).toHaveLength(1)
  })
  it('条目渲染时钟/类别徽章/备注,类别圆点带类别修饰类', async () => {
    listMock.mockResolvedValue([{ id: 1, name: 'a', type: 'manual', label: '升级前', created_at: day(27, 9) }])
    const w = mountIt(); await flush(w)
    const item = w.find('.st-item')
    expect(item.find('.st-time').text()).toBe('09:00')
    expect(item.find('.st-badge').text()).toBe(zh.snapTypeManual)
    expect(item.find('.st-label').text()).toBe('升级前')
    expect(item.find('.st-dot').classes()).toContain('manual')
  })
  it('不渲染[浏览]入口(文件区快照套件推迟)', async () => {
    listMock.mockResolvedValue([{ id: 1, name: 'a', type: 'manual', created_at: day(27, 9) }])
    const w = mountIt(); await flush(w)
    expect(w.find('.st-browse').exists()).toBe(false)
    expect(w.text()).not.toContain(zh.filesTitle ?? '文件')
  })
  it('换卷 → 重置展开态并重拉', async () => {
    listMock.mockResolvedValue([{ id: 1, name: 'a', type: 'manual', created_at: day(27, 9) }])
    const w = mountIt(); await flush(w)
    listMock.mockClear()
    await w.setProps({ volumeUuid: 'u2' }); await flush(w)
    expect(listMock).toHaveBeenCalledWith('u2')
  })
})
```

> 注:最后一条负向断言里的 `zh.filesTitle` 只是"别把文件区文案漏进来"的兜底;若 `zh_cn.ts` 无该键,直接删掉那一行,保留 `.st-browse` 断言即可。

追加到 `SnapshotPanel.test.ts`:

```ts
describe('SnapshotPanel 内嵌时间线可见性(1:1 照 Vue2)', () => {
  it('已启用 → 时间线出现', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: true, count: 0 }])
    const w = mountPanel(); await flush(w)
    expect(w.findComponent({ name: 'SnapshotTimeline' }).exists()).toBe(true)
  })
  it('已关闭且有历史快照 → 时间线仍出现(保住"快照仍保留"的承诺)', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: false, count: 3 }])
    const w = mountPanel(); await flush(w)
    expect(w.findComponent({ name: 'SnapshotTimeline' }).exists()).toBe(true)
  })
  it('已关闭且无历史 → 无时间线;不支持 → 无时间线', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: false, count: 0 }])
    const w1 = mountPanel(); await flush(w1)
    expect(w1.findComponent({ name: 'SnapshotTimeline' }).exists()).toBe(false)
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: false }])
    const w2 = mountPanel(); await flush(w2)
    expect(w2.findComponent({ name: 'SnapshotTimeline' }).exists()).toBe(false)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run src/storage/components/SnapshotTimeline.test.ts src/storage/components/SnapshotPanel.test.ts`
Expected: FAIL。

- [ ] **Step 3: 实现**

`SnapshotTimeline.vue`:
```vue
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
</style>
```

`SnapshotPanel.vue`:import 组件,把 `<!-- 快照历史时间线:P5 T5 -->` 换成:
```vue
      <!-- 可见性 1:1 照 Vue2 SnapshotPanel.vue:99-102:启用时,或已关闭但仍有历史快照时 -->
      <SnapshotTimeline
        v-if="state === 'enabled' || (state === 'disabled' && (store.volume?.count ?? 0) > 0)"
        :volume-uuid="volumeUuid"
      />
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run src/storage/components/` → PASS
Run: `pnpm exec vitest run src/styles/color-guard.test.ts src/i18n/parity.test.ts` → PASS
Run: `pnpm exec vue-tsc --noEmit` → 零错

- [ ] **Step 5: Commit**

```bash
git add src/storage/components/SnapshotTimeline.vue src/storage/components/SnapshotTimeline.test.ts src/storage/components/SnapshotPanel.vue src/storage/components/SnapshotPanel.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(storage): 快照历史时间线+嵌入面板(P5 T5,浏览入口推迟)"
```

---

