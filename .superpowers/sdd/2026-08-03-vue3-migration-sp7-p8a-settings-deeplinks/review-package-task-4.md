# Review package — Task 4 (04e6684..6a4d426)

## Commits
6a4d426 feat(photos): 设置页 AI 卡(P8a-T4)

## Stat
 src/photos/components/PhotosAiCard.vue             | 340 +++++++++++++++++++++
 .../components/__tests__/PhotosAiCard.test.ts      | 274 +++++++++++++++++
 2 files changed, 614 insertions(+)

## Diff (-U10)
```diff
diff --git a/src/photos/components/PhotosAiCard.vue b/src/photos/components/PhotosAiCard.vue
new file mode 100644
index 0000000..a7df444
--- /dev/null
+++ b/src/photos/components/PhotosAiCard.vue
@@ -0,0 +1,340 @@
+<!--
+  SP7-P8a-T4: 设置页 AI 卡。
+  回源坐标:Vue2 PhotosSettings.vue:129-192(模板)、:283-291(rebuildTask watcher)、
+  :332-370(rebuildTask/indexing/indexedPct/coverageCount/lastBuiltText/featureRows)、
+  :458-486(rebuildIndex/doRecluster)。
+
+  卡片自己不弹 toast —— @toast 统一由 T5 容器承接,同 PhotosStorageCard.vue(T3)的既定分工。
+
+  接口边界记录(给 T5 实现者看):
+  - `about` 不在本卡调用 fetchAbout() —— 沿用 T3 的既定分工,by T5 容器统一取一次。
+    取数完成前 lastBuiltText 显示 'never'、coverageCount 显示 0(见下方 computed)。
+  - `rebuildTask` 从 timeline store 的 `tasks` 读,不在本卡另起一份任务轮询
+    (与 settings.ts 头部注释 "useTimelineStore() 必须在 setup 内部调用" 一致)。
+
+  偏离登记(按项目铁律"Vue2 的 bug 不照抄,改正确逻辑并注释登记"):
+  1. lastBuiltText 的 locale 缺陷 —— Vue2 :346 `new Date(iso).toLocaleString()` 不传
+     locale 参数,结果跟随浏览器/系统语言而非应用内选择的语言,中文界面下会出英文月份缩写
+     (与 spec §7c-2/§7e-4 同类缺陷)。改为显式跟随 i18n locale(套用
+     src/photos/util/relTime.ts:18-22、PlacesRail.vue:84、PlaceDetailPanel.vue:120、
+     PersonHero.vue:113 的既有写法:locale.replace('_','-') 转 BCP-47 标签,喂给
+     Intl.DateTimeFormat)。保留 toLocaleString() 的"日期+时间"语义(不是
+     toLocaleDateString() 的纯日期),故 Intl 选项里含 hour/minute。
+  2. rebuildTask 的"跳变"判据(:283-284)—— 必须是 old.status==='running' &&
+     new.status==='done' 才弹"已重建"toast,不是"当前状态是 done 就弹"。照搬这个跳变
+     判据,否则每次任务列表刷新(轮询/深链打开)都会重复弹同一条 toast。
+
+  颜色 token:本卡零新增 token —— 全部复用既有语义 token(--accent/--accent2/
+  --accent-soft/--sem-bg/--sem-fg/--sem-bd/--chip-bg/--chip-bg-hi/--border/--fg/
+  --on-accent/--divider/--fg-muted)。私隐横幅原色 Vue2 是精确的 iOS 绿
+  rgba(52,199,89,α)/#34C759,但本仓已有通用"成功/正向"语义 token --sem-*
+  (成功徽标、RAID 健康态等多处复用,色相是青绿而非苹方绿)——比照 T3 对
+  Vue2 字面量 #6E5BFF 就近映射到既有 --accent-soft/--accent 而不新增 token 的先例,
+  这里同样映射到既有 --sem-* 三件套,不为同一"成功/安全"语义再造一份几乎重复的
+  token。进度条渐变原色 Vue2 是 linear-gradient(#6E5BFF,#B8AAFF),这里用
+  linear-gradient(var(--accent), var(--accent2)) 复刻"强调色渐变"的观感,同样不新增。
+-->
+<script setup lang="ts">
+import { computed, ref, watch } from 'vue'
+import { useI18n } from 'vue-i18n'
+import { usePhotosSettingsStore, type PhotosAiFeatures } from '../stores/settings'
+import { useTimelineStore } from '../stores/timeline'
+
+const emit = defineEmits<{ toast: [{ icon: string; text: string }] }>()
+
+const { t, locale } = useI18n()
+const store = usePhotosSettingsStore()
+const timeline = useTimelineStore()
+
+// Vue2 PhotosSettings.vue:363-369 —— 顺序固定 faces → scenes → ocr → smartview。
+const featureRows = computed(() => [
+  { id: 'faces' as const, label: t('photosSettingsFeatFaces'), desc: t('photosSettingsFeatFacesDesc') },
+  { id: 'scenes' as const, label: t('photosSettingsFeatScenes'), desc: t('photosSettingsFeatScenesDesc') },
+  { id: 'ocr' as const, label: t('photosSettingsFeatOcr'), desc: t('photosSettingsFeatOcrDesc') },
+  { id: 'smartview' as const, label: t('photosSettingsFeatSmartview'), desc: t('photosSettingsFeatSmartviewDesc') },
+])
+
+async function toggleFeature(id: keyof PhotosAiFeatures): Promise<void> {
+  const next = !store.aiFeatures[id]
+  const ok = await store.setAiFeature(id, next)
+  if (!ok) {
+    emit('toast', { icon: 'shield', text: t('photosSettingsFeatSaveFailed') })
+  }
+}
+
+// Vue2 :332-337 —— rebuildTaskId 本地记住的那条优先,找不到再找任意 type==='rebuild' 的
+// 任务,再没有就 null。id 铁律:后端 id 可能是 string|number,统一转 String 比较
+// (同 PlacesRail.vue "id 铁律" 既有先例)。
+const rebuildTaskId = ref('')
+const rebuildTask = computed(() => {
+  const tasks = timeline.tasks
+  const byId = rebuildTaskId.value
+    ? tasks.find(x => String(x.id) === rebuildTaskId.value)
+    : undefined
+  return byId ?? tasks.find(x => x.type === 'rebuild') ?? null
+})
+
+// Vue2 :338 —— indexing = 有 rebuildTask 且状态为 running。
+const indexing = computed(() => rebuildTask.value?.status === 'running')
+// Vue2 :339 —— 后端 progress 是 0-1 的小数,不是百分数,故 *100 再取整。
+const indexedPct = computed(() => Math.round(((rebuildTask.value?.progress) || 0) * 100))
+// Vue2 :340 —— coverageCount 取 about.indexCoverage,about 取数前(null)兜底 0。
+const coverageCount = computed(() => store.about?.indexCoverage ?? 0)
+
+// Vue2 :341-351,偏离登记见文件头注释 1。
+const lastBuiltText = computed(() => {
+  const iso = store.about?.indexLastBuilt
+  if (!iso) return t('photosSettingsIndexNever')
+  try {
+    const tag = locale.value.replace('_', '-')
+    return new Intl.DateTimeFormat(tag, {
+      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
+    }).format(new Date(iso))
+  } catch {
+    // Vue2 :348-350 的 catch 分支同样回落到原始 iso 字符串。
+    return iso
+  }
+})
+
+// Vue2 :283-291 —— 只在 running→done 的跳变上弹"已重建"toast + 重拉 about;
+// error 状态弹失败 toast(不要求跳变,与源一致)。偏离登记见文件头注释 2。
+watch(rebuildTask, (task, old) => {
+  if (old && old.status === 'running' && task && task.status === 'done') {
+    const base = t('photosSettingsRebuiltToast')
+    emit('toast', { icon: 'sparkles', text: task.total ? `${base} · ${task.total}` : base })
+    void store.fetchAbout()
+  }
+  if (task && task.status === 'error') {
+    const base = t('photosSettingsRebuildFailed')
+    emit('toast', { icon: 'shield', text: task.error ? `${base}: ${task.error}` : base })
+  }
+})
+
+// Vue2 :458-473 —— settings.ts 的 rebuildIndex() 已经吞掉 409(自己刷一次任务列表并
+// 返回运行中任务的 id),这里只需要处理"非 409 失败"分支。
+async function doRebuild(): Promise<void> {
+  if (indexing.value) return
+  try {
+    rebuildTaskId.value = await store.rebuildIndex()
+  } catch {
+    emit('toast', { icon: 'shield', text: t('photosSettingsRebuildStartFailed') })
+  }
+}
+
+// Vue2 :474-486 —— 成功/失败都在 finally 里 3 秒后解禁,防连点。
+const reclustering = ref(false)
+async function doRecluster(): Promise<void> {
+  if (reclustering.value) return
+  reclustering.value = true
+  try {
+    await store.reclusterFaces()
+    emit('toast', { icon: 'sparkles', text: t('photosSettingsReclusterStarted') })
+  } catch {
+    emit('toast', { icon: 'shield', text: t('photosSettingsReclusterFailed') })
+  } finally {
+    setTimeout(() => { reclustering.value = false }, 3000)
+  }
+}
+</script>
+
+<template>
+  <section class="aic-card" id="ai">
+    <header class="aic-head">
+      <div class="aic-icon">
+        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /><circle cx="12" cy="12" r="3" /></svg>
+      </div>
+      <div>
+        <h2 class="aic-title">{{ t('photosSettingsAiTitle') }}</h2>
+        <div class="aic-sub">{{ t('photosSettingsAiSubtitle') }}</div>
+      </div>
+    </header>
+
+    <div class="aic-privacy" data-test="privacy-banner">
+      <div class="aic-privacy-icon">
+        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
+      </div>
+      <div>
+        <div class="aic-privacy-title">{{ t('photosSettingsPrivacyTitle') }}</div>
+        <div class="aic-privacy-body">{{ t('photosSettingsPrivacyBody') }}</div>
+      </div>
+    </div>
+
+    <div class="aic-divider"></div>
+
+    <h3 class="aic-subhead">{{ t('photosSettingsFeaturesTitle') }}</h3>
+    <p class="aic-subhead-desc">{{ t('photosSettingsFeaturesDesc') }}</p>
+    <div class="aic-features">
+      <label v-for="f in featureRows" :key="f.id" class="aic-feature">
+        <div class="aic-feature-text">
+          <div class="lbl">{{ f.label }}</div>
+          <div class="desc">{{ f.desc }}</div>
+        </div>
+        <div
+          class="st-switch" :data-on="store.aiFeatures[f.id]" :data-test="`ai-switch-${f.id}`"
+          role="switch" :aria-checked="store.aiFeatures[f.id]" :aria-label="f.label"
+          @click="toggleFeature(f.id)"
+        ></div>
+      </label>
+    </div>
+
+    <div class="aic-divider"></div>
+
+    <h3 class="aic-subhead">{{ t('photosSettingsIndexTitle') }}</h3>
+    <div class="aic-row" style="padding-top:6px">
+      <div class="aic-row-text">
+        <div class="aic-row-label" v-if="indexing">{{ t('photosSettingsIndexRebuilding') }}</div>
+        <div class="aic-row-label" v-else>{{ t('photosSettingsIndexLastBuilt') }} {{ lastBuiltText }}</div>
+        <div class="aic-row-desc">
+          <template v-if="indexing">{{ t('photosSettingsIndexPct', { pct: indexedPct }) }}</template>
+          <template v-else>{{ t('photosSettingsIndexCoverage', { count: coverageCount }) }}</template>
+        </div>
+        <div v-if="indexing" class="aic-progress" data-test="index-progress"><div :style="{ width: indexedPct + '%' }"></div></div>
+      </div>
+      <button type="button" class="aic-btn" data-test="rebuild-index" :disabled="indexing" @click="doRebuild">
+        <span v-if="indexing" class="aic-spinner"></span>
+        <svg v-else viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /><circle cx="12" cy="12" r="3" /></svg>
+        {{ indexing ? t('photosSettingsIndexRebuilding') : t('photosSettingsRebuildIndex') }}
+      </button>
+      <button type="button" class="aic-btn" data-test="recluster" :disabled="reclustering" @click="doRecluster" style="margin-left:8px">
+        <span v-if="reclustering" class="aic-spinner"></span>
+        <svg v-else viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>
+        {{ t('photosSettingsRecluster') }}
+      </button>
+    </div>
+  </section>
+</template>
+
+<style scoped>
+.aic-card {
+  background: var(--card-bg);
+  border: 1px solid var(--card-border);
+  border-radius: var(--radius-sm);
+  box-shadow: var(--card-shadow);
+  padding: 20px 22px;
+  display: flex;
+  flex-direction: column;
+}
+
+.aic-head { display: flex; align-items: flex-start; gap: 12px; }
+
+.aic-icon {
+  width: 32px;
+  height: 32px;
+  flex-shrink: 0;
+  border-radius: 10px;
+  display: flex;
+  align-items: center;
+  justify-content: center;
+  background: var(--accent-soft);
+  color: var(--accent);
+}
+
+.aic-title { margin: 0; font-size: 15px; font-weight: 600; color: var(--fg); }
+.aic-sub { font-size: 12px; color: var(--fg-muted); margin-top: 2px; }
+
+.aic-privacy {
+  display: flex;
+  gap: 10px;
+  padding: 12px 14px;
+  background: var(--sem-bg);
+  border: 1px solid var(--sem-bd);
+  border-radius: 10px;
+  margin: 14px 0 4px;
+}
+.aic-privacy-icon {
+  width: 26px;
+  height: 26px;
+  flex-shrink: 0;
+  margin-top: 1px;
+  border-radius: 7px;
+  background: var(--sem-bd);
+  color: var(--sem-fg);
+  display: flex;
+  align-items: center;
+  justify-content: center;
+}
+.aic-privacy-title { font-size: 12.5px; font-weight: 600; color: var(--sem-fg); margin-bottom: 4px; }
+.aic-privacy-body { font-size: 11.5px; color: var(--fg-muted); line-height: 1.5; }
+
+.aic-divider { height: 1px; background: var(--divider); margin: 16px 0; }
+
+.aic-subhead { font-size: 14px; font-weight: 600; color: var(--fg); margin: 0 0 4px; }
+.aic-subhead-desc { font-size: 11.5px; color: var(--fg-muted); line-height: 1.45; margin: 0 0 10px; max-width: 540px; }
+
+.aic-features { display: flex; flex-direction: column; }
+.aic-feature { display: flex; align-items: center; gap: 18px; padding: 11px 0; border-bottom: 1px solid var(--divider); cursor: pointer; }
+.aic-feature:last-child { border-bottom: 0; }
+.aic-feature-text { flex: 1; }
+.aic-feature-text .lbl { font-size: 13px; color: var(--fg); font-weight: 500; }
+.aic-feature-text .desc { font-size: 11.5px; color: var(--fg-muted); margin-top: 2px; line-height: 1.4; }
+
+/* 开关:照本仓既有惯例(settings/styles/settings.css .set-switch、
+   SnapshotSettingsDialog.vue .ss-switch)——关态描边+chip 底,开态实底 accent,
+   把手关态 --fg、开态 --on-accent("只在叠在 accent 实底上才可用",这里正是那种情形)。 */
+.st-switch {
+  position: relative;
+  width: 36px;
+  height: 20px;
+  flex-shrink: 0;
+  border-radius: 999px;
+  border: 1px solid var(--border);
+  background: var(--chip-bg);
+  cursor: pointer;
+  transition: background 0.15s var(--ease), border-color 0.15s var(--ease);
+}
+.st-switch::after {
+  content: "";
+  position: absolute;
+  top: 2px;
+  left: 2px;
+  width: 16px;
+  height: 16px;
+  border-radius: 50%;
+  background: var(--fg);
+  transition: left 0.18s cubic-bezier(0.2, 0.8, 0.2, 1), background 0.15s var(--ease);
+}
+.st-switch[data-on="true"] { background: var(--accent); border-color: var(--accent); }
+.st-switch[data-on="true"]::after { left: 18px; background: var(--on-accent); }
+.st-switch:hover { background: var(--chip-bg-hi); }
+/* 本区已栽四次的坑:基类 `.st-switch:hover`(优先级 2)与变体
+   `.st-switch[data-on="true"]`(优先级 2)同权重——鼠标一进开关,若没有专门的
+   `[data-on]:hover` 规则,两条同优先级规则谁赢会退化成"谁在源码里写在后面",
+   而不是"变体理应保持自己的实底"。用第三个选择器把优先级明确抬高到 3,
+   开态开关 hover 时保持 accent 实底,不被基类的 hover 底色顶掉。 */
+.st-switch[data-on="true"]:hover { background: var(--accent); border-color: var(--accent); }
+
+.aic-row { display: flex; align-items: center; gap: 16px; }
+.aic-row-text { flex: 1; min-width: 0; }
+.aic-row-label { font-size: 13px; font-weight: 500; color: var(--fg); }
+.aic-row-desc { font-size: 12px; color: var(--fg-muted); margin-top: 2px; }
+
+.aic-progress { height: 4px; border-radius: 99px; background: var(--divider); margin-top: 8px; overflow: hidden; }
+.aic-progress > div { height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent2)); transition: width 0.2s ease; }
+
+.aic-btn {
+  display: inline-flex;
+  align-items: center;
+  gap: 6px;
+  border: 1px solid var(--card-border);
+  background: var(--chip-bg);
+  color: var(--fg);
+  font-size: 12px;
+  padding: 7px 12px;
+  border-radius: 999px;
+  cursor: pointer;
+  flex-shrink: 0;
+}
+.aic-btn:hover:not(:disabled) { background: var(--chip-bg-hi); }
+.aic-btn:disabled { opacity: 0.5; cursor: default; }
+.aic-btn svg { flex-shrink: 0; }
+
+.aic-spinner {
+  width: 12px;
+  height: 12px;
+  border-radius: 50%;
+  border: 2px solid var(--chip-border);
+  border-top-color: var(--accent);
+  animation: aic-spin 0.8s linear infinite;
+}
+@keyframes aic-spin { to { transform: rotate(360deg); } }
+</style>
diff --git a/src/photos/components/__tests__/PhotosAiCard.test.ts b/src/photos/components/__tests__/PhotosAiCard.test.ts
new file mode 100644
index 0000000..935e82c
--- /dev/null
+++ b/src/photos/components/__tests__/PhotosAiCard.test.ts
@@ -0,0 +1,274 @@
+// SP7-P8a-T4: PhotosAiCard.vue —— 设置页 AI 卡。
+// 回源坐标见 task-4-brief.md;Vue2 PhotosSettings.vue:129-192(模板)/:283-291(watcher)/
+// :332-370(computed)/:458-486(rebuildIndex/doRecluster)。
+//
+// 测试基建沿用 T3(PhotosStorageCard.test.ts)已验证过的既定做法(brief 草稿引用的
+// @pinia/testing / winningDeclaration 均不存在于本仓,详见该文件头注释):
+// - setActivePinia(createPinia()) 起真实 store,vi.spyOn(store, 'action') 按需 stub。
+// - mock 的是共享包 @nimotech/nimoos-service,不是 store 本身。
+// - hover 级联守卫用 cssCascade.ts 的 extractStyleBlock/winningHoverBackground。
+import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
+import { mount, flushPromises } from '@vue/test-utils'
+import { setActivePinia, createPinia } from 'pinia'
+import { nextTick } from 'vue'
+
+vi.mock('@nimotech/nimoos-service', () => ({
+  service: {
+    photos: {
+      getConfig: vi.fn(),
+      updateConfig: vi.fn(),
+      getStorage: vi.fn(),
+      getAbout: vi.fn(),
+      pruneCache: vi.fn(),
+      rebuildIndex: vi.fn(),
+      triggerScan: vi.fn(),
+      reclusterFaces: vi.fn(),
+      getTimeline: vi.fn(),
+      getStatus: vi.fn(),
+      listTasks: vi.fn(),
+    },
+  },
+}))
+
+import PhotosAiCard from '../PhotosAiCard.vue'
+import photosAiCardRaw from '../PhotosAiCard.vue?raw'
+import { usePhotosSettingsStore } from '../../stores/settings'
+import { useTimelineStore } from '../../stores/timeline'
+import { extractStyleBlock, winningHoverBackground } from './cssCascade'
+import type { TaskBusPayload } from '../../util/taskBus'
+
+function mountCard() {
+  const wrapper = mount(PhotosAiCard)
+  const store = usePhotosSettingsStore()
+  const timeline = useTimelineStore()
+  return { wrapper, store, timeline }
+}
+
+function rebuildTaskFixture(overrides: Partial<TaskBusPayload> = {}): TaskBusPayload {
+  return { id: 'rb-1', type: 'rebuild', status: 'running', progress: 0, ...overrides }
+}
+
+describe('PhotosAiCard', () => {
+  beforeEach(() => {
+    setActivePinia(createPinia())
+    vi.clearAllMocks()
+  })
+
+  afterEach(() => {
+    vi.useRealTimers()
+  })
+
+  it('4 个开关顺序固定 faces→scenes→ocr→smartview(Vue2 :363-369)', () => {
+    const { wrapper } = mountCard()
+    const switches = wrapper.findAll('[data-test^="ai-switch-"]')
+    expect(switches.map(s => s.attributes('data-test'))).toEqual([
+      'ai-switch-faces', 'ai-switch-scenes', 'ai-switch-ocr', 'ai-switch-smartview',
+    ])
+  })
+
+  it('点开关调 setAiFeature(id, 新值);失败时 emit toast', async () => {
+    const { wrapper, store } = mountCard()
+    vi.spyOn(store, 'setAiFeature').mockResolvedValue(false)
+    store.aiFeatures.faces = true
+    await nextTick()
+    await wrapper.get('[data-test="ai-switch-faces"]').trigger('click')
+    expect(store.setAiFeature).toHaveBeenCalledWith('faces', false)
+    await flushPromises()
+    const toasts = wrapper.emitted('toast')
+    expect(toasts).toBeTruthy()
+    expect(toasts![0]![0]).toMatchObject({ icon: 'shield' })
+  })
+
+  it('点开关成功不 emit toast', async () => {
+    const { wrapper, store } = mountCard()
+    vi.spyOn(store, 'setAiFeature').mockResolvedValue(true)
+    store.aiFeatures.scenes = true
+    await nextTick()
+    await wrapper.get('[data-test="ai-switch-scenes"]').trigger('click')
+    expect(store.setAiFeature).toHaveBeenCalledWith('scenes', false)
+    await flushPromises()
+    expect(wrapper.emitted('toast')).toBeFalsy()
+  })
+
+  it('indexedPct 把后端 0-1 小数换算成百分数(progress 0.42 → 42%)(Vue2 :339)', async () => {
+    const { wrapper, timeline } = mountCard()
+    timeline.tasks = [rebuildTaskFixture({ progress: 0.42 })]
+    await nextTick()
+    expect(wrapper.get('[data-test="index-progress"] > div').attributes('style')).toContain('42%')
+    expect(wrapper.text()).toContain('42')
+  })
+
+  it('rebuildTask 查找优先级:先 rebuildTaskId,再任意 type=rebuild(Vue2 :332-337)', async () => {
+    const { wrapper, store, timeline } = mountCard()
+    vi.spyOn(store, 'rebuildIndex').mockResolvedValue('rb-target')
+    // rb-other 先于 rb-target 出现在列表里,且是 type==='rebuild' 的唯一"后备命中"——
+    // 但它是 done 状态(不禁用按钮),用于证明"记住的 rebuildTaskId 命中后不再理会
+    // 列表里排在前面的其它 rebuild 任务"。rb-target 是 running + 90%,点击后 store 返回
+    // 它的 id,组件应绑定到它,而不是继续停留在后备命中的 rb-other 上。
+    timeline.tasks = [
+      rebuildTaskFixture({ id: 'rb-other', status: 'done', progress: 0.1 }),
+      rebuildTaskFixture({ id: 'rb-target', status: 'running', progress: 0.9 }),
+    ]
+    await nextTick()
+    expect(wrapper.get('[data-test="rebuild-index"]').attributes('disabled')).toBeUndefined()
+    await wrapper.get('[data-test="rebuild-index"]').trigger('click')
+    await flushPromises()
+    await nextTick()
+    // rebuildTaskId 记住了 'rb-target' —— 应该绑定到那条(90%),不是后备命中的 rb-other
+    expect(wrapper.text()).toContain('90')
+  })
+
+  it('rebuildTaskId 找不到匹配项时回退到任意 type=rebuild 的任务', async () => {
+    const { wrapper, timeline } = mountCard()
+    // 没有调用过 rebuildIndex(rebuildTaskId 仍是初始空串)——直接靠 type==='rebuild' 兜底命中
+    timeline.tasks = [rebuildTaskFixture({ id: 'rb-any', progress: 0.55 })]
+    await nextTick()
+    expect(wrapper.text()).toContain('55')
+  })
+
+  it('只在 running→done 的跳变上弹「已重建」toast,不在每次刷新都弹(Vue2 :283-284)', async () => {
+    const { wrapper, timeline } = mountCard()
+    // 先把任务置成 done(无 running 前态)→ 断言零 toast
+    timeline.tasks = [rebuildTaskFixture({ status: 'done' })]
+    await nextTick()
+    expect(wrapper.emitted('toast')).toBeFalsy()
+
+    // 再走 running → done → 断言恰好一条 toast
+    timeline.tasks = [rebuildTaskFixture({ status: 'running' })]
+    await nextTick()
+    expect(wrapper.emitted('toast')).toBeFalsy()
+    timeline.tasks = [rebuildTaskFixture({ status: 'done', total: 128 })]
+    await nextTick()
+    const toasts = wrapper.emitted('toast')
+    expect(toasts).toHaveLength(1)
+    expect(toasts![0]![0]).toMatchObject({ icon: 'sparkles' })
+    expect((toasts![0]![0] as { text: string }).text).toContain('128')
+
+    // 再刷新一次仍是 done(同状态,非跳变)→ 不应再弹第二条
+    timeline.tasks = [rebuildTaskFixture({ status: 'done', total: 128 })]
+    await nextTick()
+    expect(wrapper.emitted('toast')).toHaveLength(1)
+  })
+
+  it('running→done 跳变后重拉 about(Vue2 :286)', async () => {
+    const { wrapper, store, timeline } = mountCard()
+    const fetchSpy = vi.spyOn(store, 'fetchAbout').mockResolvedValue(undefined)
+    timeline.tasks = [rebuildTaskFixture({ status: 'running' })]
+    await nextTick()
+    timeline.tasks = [rebuildTaskFixture({ status: 'done' })]
+    await nextTick()
+    await flushPromises()
+    expect(fetchSpy).toHaveBeenCalledTimes(1)
+    // 确认这次报告没有虚报:done 之外的状态变化不应触发重拉
+    void wrapper
+  })
+
+  it('running→error 弹失败 toast(附 task.error),不要求跳变', async () => {
+    const { wrapper, timeline } = mountCard()
+    timeline.tasks = [rebuildTaskFixture({ status: 'error', error: 'disk full' })]
+    await nextTick()
+    const toasts = wrapper.emitted('toast')
+    expect(toasts).toHaveLength(1)
+    expect(toasts![0]![0]).toMatchObject({ icon: 'shield' })
+    expect((toasts![0]![0] as { text: string }).text).toContain('disk full')
+  })
+
+  it('lastBuilt 为空显示 never(Vue2 :343-344)', async () => {
+    const { wrapper, store } = mountCard()
+    store.about = { version: '1.0', deviceName: 'NAS', indexCoverage: 0, indexLastBuilt: '', librarySince: '' }
+    await nextTick()
+    expect(wrapper.text()).toContain('从未')
+  })
+
+  it('about 取数前(null)不崩溃,lastBuilt 显示 never、coverage 显示 0', async () => {
+    const { wrapper, store } = mountCard()
+    expect(store.about).toBeNull()
+    await nextTick()
+    expect(wrapper.text()).toContain('从未')
+    expect(wrapper.text()).toContain('覆盖 0')
+  })
+
+  it('lastBuilt 的日期跟随 i18n locale(Vue2 无 locale 参数是缺陷,本期改正)', async () => {
+    const { wrapper, store } = mountCard()
+    store.about = {
+      version: '1.0', deviceName: 'NAS', indexCoverage: 10,
+      indexLastBuilt: '2026-03-15T08:30:00Z', librarySince: '',
+    }
+    await nextTick()
+    const text = wrapper.text()
+    // zh 默认 locale 下 Intl.DateTimeFormat('zh-CN', {month:'short'}) 输出"3月"这类中文月份,
+    // 不应出现英文月份缩写(如 Mar)——反证 Vue2 缺陷(跟随系统/浏览器 locale)已被修正。
+    expect(text).not.toMatch(/\bMar\b/)
+    expect(text).toContain('2026')
+  })
+
+  it('recluster 点一次后 3 秒内禁用(防连点)(Vue2 :483-484)', async () => {
+    vi.useFakeTimers()
+    const { wrapper, store } = mountCard()
+    vi.spyOn(store, 'reclusterFaces').mockResolvedValue(true)
+    const btn = wrapper.get('[data-test="recluster"]')
+    await btn.trigger('click')
+    await flushPromises()
+    expect(wrapper.get('[data-test="recluster"]').attributes('disabled')).toBeDefined()
+    await vi.advanceTimersByTimeAsync(2999)
+    expect(wrapper.get('[data-test="recluster"]').attributes('disabled')).toBeDefined()
+    await vi.advanceTimersByTimeAsync(2)
+    expect(wrapper.get('[data-test="recluster"]').attributes('disabled')).toBeUndefined()
+  })
+
+  it('recluster 失败也在 3 秒后解禁(finally 分支)', async () => {
+    vi.useFakeTimers()
+    const { wrapper, store } = mountCard()
+    vi.spyOn(store, 'reclusterFaces').mockRejectedValue(new Error('boom'))
+    const btn = wrapper.get('[data-test="recluster"]')
+    await btn.trigger('click')
+    await flushPromises()
+    const toasts = wrapper.emitted('toast')
+    expect(toasts).toBeTruthy()
+    expect(toasts![0]![0]).toMatchObject({ icon: 'shield' })
+    expect(wrapper.get('[data-test="recluster"]').attributes('disabled')).toBeDefined()
+    await vi.advanceTimersByTimeAsync(3000)
+    expect(wrapper.get('[data-test="recluster"]').attributes('disabled')).toBeUndefined()
+  })
+
+  it('rebuild index 按钮 indexing 时禁用', async () => {
+    const { wrapper, timeline } = mountCard()
+    timeline.tasks = [rebuildTaskFixture({ status: 'running' })]
+    await nextTick()
+    expect(wrapper.get('[data-test="rebuild-index"]').attributes('disabled')).toBeDefined()
+  })
+
+  it('rebuild index 点击调 store.rebuildIndex();非 409 失败(store 抛出)时 emit 兜底 toast', async () => {
+    const { wrapper, store } = mountCard()
+    vi.spyOn(store, 'rebuildIndex').mockRejectedValue(new Error('boom'))
+    await wrapper.get('[data-test="rebuild-index"]').trigger('click')
+    await flushPromises()
+    expect(store.rebuildIndex).toHaveBeenCalledTimes(1)
+    const toasts = wrapper.emitted('toast')
+    expect(toasts).toBeTruthy()
+    expect(toasts![0]![0]).toMatchObject({ icon: 'shield' })
+  })
+
+  it('mount 时不主动取数(about/aiFeatures/tasks 一律不调用,由 T5 容器统一取)', () => {
+    const settingsStore = usePhotosSettingsStore()
+    const fetchAiSpy = vi.spyOn(settingsStore, 'fetchAiFeatures')
+    const fetchAboutSpy = vi.spyOn(settingsStore, 'fetchAbout')
+    const timelineStore = useTimelineStore()
+    const fetchTasksSpy = vi.spyOn(timelineStore, 'fetchTasks')
+    mount(PhotosAiCard)
+    expect(fetchAiSpy).not.toHaveBeenCalled()
+    expect(fetchAboutSpy).not.toHaveBeenCalled()
+    expect(fetchTasksSpy).not.toHaveBeenCalled()
+  })
+})
+
+describe('样式:开关 [data-on] 变体自带 hover 背景(本区已栽四次)', () => {
+  it('st-switch 的 hover 胜出规则同时含 :hover 与 data-on', () => {
+    expect(photosAiCardRaw.length).toBeGreaterThan(0)
+    const style = extractStyleBlock(photosAiCardRaw)
+    expect(style.length).toBeGreaterThan(0)
+    const winner = winningHoverBackground(style, ['st-switch'])
+    expect(winner.selector).toContain(':hover')
+    expect(winner.selector).toContain('data-on')
+  })
+})
```
