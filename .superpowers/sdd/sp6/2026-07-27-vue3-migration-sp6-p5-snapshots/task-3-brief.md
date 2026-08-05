### Task 3: 快照面板三态骨架 + 保护开关(`SnapshotPanel.vue`)

迁移 Vue2 `SnapshotPanel.vue` 的**卡片骨架与三态**:`unsupported`(只有一行说明)/ `disabled`(开关 + 一行解释,若有历史快照再加一行"保留"承诺)/ `enabled`(开关 + 状态摘要行 + 暂停警告行 + 保留承诺行 + 策略摘要行)。**高级表单与手动创建行留 T4,时间线留 T5**(本 Task 先把这两处留空注释占位)。

**Files:**
- Create: `src/storage/components/SnapshotPanel.vue`
- Test: `src/storage/components/SnapshotPanel.test.ts`
- Modify: `src/i18n/zh_cn.ts`、`src/i18n/en_us.ts`(附录 A 标「T3」的 8 个键)

**Interfaces:**
- Consumes: `useSnapshotStore()`(T2);`resolveSnapshotState`(T1);`useI18n`。
- Produces: 组件 props `{ volumeUuid: string }`,无 emits。稳定 class 契约(后续 Task 与详情页测试依赖):根 `.sp-card`、开关 `.sp-switch`、不支持行 `.sp-unsupported`、状态行 `.sp-status`、暂停行 `.sp-paused`、保留承诺行 `.sp-kept`、策略摘要 `.sp-policy-summary`、高级设置按钮 `.sp-advanced-btn`(T4)。

**Vue2 逐字对照点**(`SnapshotPanel.vue`):
- `v-if="!loading"`:加载中整卡不渲染(`:2`)。
- `unsupported` 分支只有标题 + 一行灰字(`:4-9`),**没有开关**。
- 开关 `:value="volume && volume.enabled"`、`:loading="toggling"`、`:disabled="toggling"`,`@input` → toggle(`:16-23`)。
- `disabled` 分支的解释行(`:27-31`)。
- `enabled` 分支的状态文案(`:133-140`):`count===0 && !last_at` → 「暂无快照」;否则 `{n} snapshots so far · last at {time}`,`time` = `new Date(last_at).toLocaleString()`,`last_at` 为空时用「从未」。
- 暂停行(`:38-40` + `:141-149`):`paused_reason` 非空才出,前缀 ⚠️。
- 保留承诺行:`enabled` 时一行(`:41-43`);`disabled` **且** `count > 0` 时也出一行(`:95-97`)。
- 策略摘要(`:150-158`):`policy` 为空 → 空字符串;否则 `每小时快照:保留 {hourly} · 每天:保留 {daily} · 每周:保留 {weekly}`。
- 策略拉取时机(`:160-164` 的 watcher):`state` 变为 `enabled` 且原先不是 `enabled` 时才 `loadPolicy` —— **每次转换只拉一次**,不要在 mounted 里无条件拉。
- `mounted` 只调 `fetchVolume`(`:165-167`)。

- [ ] **Step 1: 写失败测试** `src/storage/components/SnapshotPanel.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import SnapshotPanel from './SnapshotPanel.vue'
import zh from '../../i18n/zh_cn'

const listVolumes = vi.fn()
const getPolicy = vi.fn()
const listMock = vi.fn().mockResolvedValue([])
const togglePolicy = vi.fn().mockResolvedValue(undefined)
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    snapshot: {
      listVolumes: (...a: unknown[]) => listVolumes(...a),
      getPolicy: (...a: unknown[]) => getPolicy(...a),
      list: (...a: unknown[]) => listMock(...a),
      togglePolicy: (...a: unknown[]) => togglePolicy(...a),
      patchPolicy: vi.fn(),
      create: vi.fn(),
      remove: vi.fn(),
    },
  },
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const mountPanel = () => mount(SnapshotPanel, { props: { volumeUuid: 'u1' }, global: { plugins: [i18n] } })
const flush = async (w: ReturnType<typeof mountPanel>) => {
  await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()
}

beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks(); getPolicy.mockResolvedValue({ hourly_keep: 24, daily_keep: 7, weekly_keep: 4, pause_threshold_pct: 90 }) })

describe('SnapshotPanel 三态', () => {
  it('端点 404(listVolumes 抛错)→ 不支持态:有说明、无开关,且不拉策略', async () => {
    listVolumes.mockRejectedValue(new Error('404'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const w = mountPanel(); await flush(w)
    expect(w.find('.sp-unsupported').exists()).toBe(true)
    expect(w.find('.sp-switch').exists()).toBe(false)
    expect(getPolicy).not.toHaveBeenCalled()
  })
  it('supported=false → 不支持态', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: false }])
    const w = mountPanel(); await flush(w)
    expect(w.find('.sp-unsupported').exists()).toBe(true)
  })
  it('已关闭态:有开关(未选中)+ 解释行,无状态行/无策略摘要', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: false, count: 0 }])
    const w = mountPanel(); await flush(w)
    expect(w.find('.sp-switch').attributes('aria-checked')).toBe('false')
    expect(w.find('.sp-status').exists()).toBe(false)
    expect(w.find('.sp-policy-summary').exists()).toBe(false)
    expect(getPolicy).not.toHaveBeenCalled()
  })
  it('已关闭但仍有历史快照 → 额外出"已有快照仍会保留"行', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: false, count: 3 }])
    const w = mountPanel(); await flush(w)
    expect(w.find('.sp-kept').exists()).toBe(true)
  })
  it('已启用态:开关选中 + 状态摘要 + 保留承诺 + 策略摘要(且策略只拉一次)', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: true, count: 5, last_at: '2026-07-27T01:00:00Z' }])
    const w = mountPanel(); await flush(w)
    expect(w.find('.sp-switch').attributes('aria-checked')).toBe('true')
    expect(w.find('.sp-status').text()).toContain('5')
    expect(w.find('.sp-kept').exists()).toBe(true)
    expect(w.find('.sp-policy-summary').text()).toContain('24')
    expect(getPolicy).toHaveBeenCalledTimes(1)
  })
  it('已启用但零快照 → 状态行显示"暂无快照"', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: true, count: 0, last_at: '' }])
    const w = mountPanel(); await flush(w)
    expect(w.find('.sp-status').text()).toBe(zh.snapNoneYet)
  })
  it('paused_reason 非空 → 出暂停警告行,内容含原因', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: true, count: 1, last_at: '2026-07-27T01:00:00Z', paused_reason: '磁盘使用率 95%' }])
    const w = mountPanel(); await flush(w)
    expect(w.find('.sp-paused').text()).toContain('磁盘使用率 95%')
  })
  it('无 paused_reason → 不出暂停行', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: true, count: 1 }])
    const w = mountPanel(); await flush(w)
    expect(w.find('.sp-paused').exists()).toBe(false)
  })
})

describe('SnapshotPanel 保护开关', () => {
  it('点开关 → togglePolicy(uuid, 目标值);切换后本地状态跟随', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: true, count: 1 }])
    const w = mountPanel(); await flush(w)
    await w.find('.sp-switch').trigger('click')
    await flush(w)
    expect(togglePolicy).toHaveBeenCalledWith('u1', false)
    expect(w.find('.sp-switch').attributes('aria-checked')).toBe('false')
  })
  it('切换在途时开关禁用(防连点)', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: false, count: 0 }])
    let release: (v?: unknown) => void = () => {}
    togglePolicy.mockImplementation(() => new Promise((r) => { release = r }))
    const w = mountPanel(); await flush(w)
    await w.find('.sp-switch').trigger('click')
    await w.vm.$nextTick()
    expect((w.find('.sp-switch').element as HTMLButtonElement).disabled).toBe(true)
    release(); await flush(w)
    expect((w.find('.sp-switch').element as HTMLButtonElement).disabled).toBe(false)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run src/storage/components/SnapshotPanel.test.ts`
Expected: FAIL(组件不存在)。

- [ ] **Step 3: 实现 `SnapshotPanel.vue`**

```vue
<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSnapshotStore } from '../stores/snapshot'
import { resolveSnapshotState } from '../util/snapshotView'

const props = defineProps<{ volumeUuid: string }>()
const store = useSnapshotStore()
const { t } = useI18n()

const state = computed(() => resolveSnapshotState(store.volume))

const statusText = computed(() => {
  const v = store.volume
  if (!v) return ''
  if (!v.count && !v.last_at) return t('snapNoneYet')
  const time = v.last_at ? new Date(v.last_at).toLocaleString() : t('snapNever')
  return t('snapStatus', { n: v.count, time })
})

const pausedText = computed(() => {
  const reason = store.volume?.paused_reason
  return reason ? t('snapPaused', { reason }) : ''
})

const policySummaryText = computed(() => {
  const p = store.policy
  if (!p) return ''
  return t('snapPolicySummary', { hourly: p.hourly_keep, daily: p.daily_keep, weekly: p.weekly_keep })
})

// Vue2 的 state watcher(SnapshotPanel.vue:160-164):只在"变成 enabled"这一刻拉策略,
// 每次转换只拉一次(初次加载即 enabled 也算一次转换)。
watch(state, (val, oldVal) => {
  if (val === 'enabled' && oldVal !== 'enabled') store.loadPolicy(props.volumeUuid)
})

onMounted(() => { store.loadVolume(props.volumeUuid) })

function onToggle() {
  store.toggle(props.volumeUuid, !(store.volume?.enabled ?? false))
}
</script>

<template>
  <div v-if="!store.volumeLoading" class="sp-card">
    <div class="sp-title">{{ t('snapTitle') }}</div>

    <!-- 不支持:无开关,只有一行说明(Vue2 SnapshotPanel.vue:4-9) -->
    <div v-if="state === 'unsupported'" class="sp-row sp-unsupported">
      <span class="sp-muted">{{ t('snapUnsupported') }}</span>
    </div>

    <template v-else>
      <div class="sp-row">
        <span class="sp-key">{{ t('snapTitle') }}</span>
        <button
          type="button"
          class="sp-switch"
          role="switch"
          :aria-checked="String(store.volume?.enabled === true)"
          :class="{ on: store.volume?.enabled }"
          :disabled="store.toggling"
          @click="onToggle"
        ><span class="sp-switch-thumb"></span></button>
      </div>

      <div v-if="state === 'disabled'" class="sp-row">
        <span class="sp-muted">{{ t('snapDisabledHint') }}</span>
      </div>

      <template v-if="state === 'enabled'">
        <div class="sp-row sp-status"><span class="sp-muted">{{ statusText }}</span></div>
        <div v-if="pausedText" class="sp-row sp-paused"><span>⚠️ {{ pausedText }}</span></div>
        <div class="sp-row sp-kept"><span class="sp-muted">{{ t('snapKept') }}</span></div>
        <div class="sp-row sp-policy-row">
          <div class="sp-policy-summary sp-muted">{{ policySummaryText }}</div>
          <!-- 高级设置按钮 + 表单:P5 T4 -->
        </div>
        <!-- 手动创建快照行:P5 T4 -->
      </template>

      <div v-if="state === 'disabled' && (store.volume?.count ?? 0) > 0" class="sp-row sp-kept">
        <span class="sp-muted">{{ t('snapKept') }}</span>
      </div>

      <!-- 快照历史时间线:P5 T5 -->
    </template>
  </div>
</template>

<style scoped>
/* 结构照 StorageRaidDetail 的 .rd-card —— scoped 样式不穿透子组件,与 Vue2
   SnapshotPanel 重复 .info-card 是同一个原因(见 Vue2:260-261 注释)。 */
.sp-card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: var(--radius-sm); overflow: hidden; margin-bottom: 14px; }
.sp-title { font-size: 11px; font-weight: 600; color: var(--fg-muted); text-transform: uppercase; letter-spacing: 0.4px; padding: 8px 12px; border-bottom: 1px solid var(--card-border); }
.sp-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 7px 12px; border-bottom: 1px solid var(--card-border); font-size: 12.5px; }
.sp-row:last-child { border-bottom: none; }
.sp-key { color: var(--fg-muted); }
.sp-muted { color: var(--fg-muted); font-size: 12px; }
.sp-paused { color: var(--dem-fg); font-size: 12px; }
.sp-policy-row { align-items: flex-start; }

.sp-switch {
  position: relative; width: 38px; height: 21px; flex: none; padding: 0; cursor: pointer;
  border-radius: 999px; border: 1px solid var(--chip-border); background: var(--chip-bg);
  transition: background 0.15s var(--ease), border-color 0.15s var(--ease);
}
.sp-switch.on { background: var(--accent); border-color: var(--accent); }
.sp-switch:disabled { opacity: 0.55; cursor: not-allowed; }
.sp-switch-thumb {
  position: absolute; top: 2px; left: 2px; width: 15px; height: 15px; border-radius: 50%;
  background: var(--fg); transition: transform 0.15s var(--ease);
}
.sp-switch.on .sp-switch-thumb { transform: translateX(17px); background: var(--on-accent); }
</style>
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run src/storage/components/SnapshotPanel.test.ts` → PASS
Run: `pnpm exec vitest run src/styles/color-guard.test.ts src/i18n/parity.test.ts` → PASS
Run: `pnpm exec vue-tsc --noEmit` → 零错

- [ ] **Step 5: Commit**

```bash
git add src/storage/components/SnapshotPanel.vue src/storage/components/SnapshotPanel.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(storage): 快照面板三态骨架+保护开关(P5 T3)"
```

---

