# Review package — Task 3 (29167c4..050b12f)

## Commits
050b12f feat(photos): 设置页存储卡(P8a-T3)

## Stat
 docs/THEMING.md                                    |   1 +
 src/photos/components/PhotosStorageCard.vue        | 342 +++++++++++++++++++++
 .../components/__tests__/PhotosStorageCard.test.ts | 241 +++++++++++++++
 src/photos/util/storagePalette.ts                  |  65 ++++
 src/styles/theme.css                               |  34 ++
 5 files changed, 683 insertions(+)

## Diff (-U10)
```diff
diff --git a/docs/THEMING.md b/docs/THEMING.md
index df0ea9b..b608da4 100644
--- a/docs/THEMING.md
+++ b/docs/THEMING.md
@@ -324,20 +324,21 @@ setTheme(t):  documentElement.dataset.theme = (t === 'blue' ? '' : t)   // blue
 
 以下颜色**故意不走主题 token**，是有意设计而非残留。每处代码须有注释说明原因：
 
 | 例外 | 位置 | 为何是有意例外 |
 |---|---|---|
 | `.ic-*` app 图标渐变（`.ic-files` / `.ic-photos` / `.ic-video` / `.ic-music` / `.ic-ai` / `.ic-backup` / `.ic-download` / `.ic-docker` / `.ic-vm` / `.ic-share` / `.ic-search` / `.ic-settings` / `.ic-users` / `.ic-storage` / `.ic-appstore` / `.ic-terminal` 等） | `theme.css` §「应用图标配色」 | **品牌识别色，皮肤无关**——文件蓝、照片虹彩、音乐粉紫等是产品视觉资产，两套主题都保持一致，不应随皮肤变。用户靠颜色识别应用。 |
 | 第三方库内部主题（如 CodeMirror 编辑器配色） | 引入该库的组件 | 库有自己的主题机制，颜色由库内部管理，无法用 CSS 变量穿透。应走该库自身的 theme 配置，而非硬塞 token。 |
 | `PLACE_PALETTE`（7 色循环：`#6E5BFF`/`#FF9AC2`/`#5AC8FA`/`#FFD60A`/`#34C759`/`#FF9F0A`/`#FF6B5C`） | `src/photos/util/peopleView.ts`（人物详情页地点 tab：迷你地图点 + 图例 + 地点卡片，消费于 `PersonPlacesTab.vue`） | **数据可视化分类色板**，不是主题皮肤色——同一张地图/图例上要把互不相同的地点互相区分开，颜色语义是"第几个数据系列"而不是"主题强调色"，两套主题下都必须保持同一组值不变。值放 `.ts`（不是 `theme.css`）刻意避免为 7 个数据系列各造一个一次性 token。 |
 | 地图主题预设 4×7 色 | `src/photos/util/placesMapThemes.ts` | 用户可选的地图可视化调色板，与应用主题正交（spec SP7 D5）；浅色变体由全局 data-theme 触发。 |
 | `--badge-photo`（`rgba(50,190,230,0.9)` 青）/ `--badge-video`（`rgba(255,149,10,0.92)` 橙）/ `--badge-ocr`（`rgba(16,185,129,0.92)` 翠绿） | `theme.css`（`:root` 与 `:root[data-theme="light"]` 均定义，同值）；消费于 `src/photos/components/SearchResultTile.vue` 的 `.type-badge[data-type="photo"\|"video"\|"ocr"]` | **数据可视化类别色**（与 `PLACE_PALETTE` 同类，但只有 3 个固定类别、且要在 scoped `<style>` 里按 `[data-type]` 属性选择器消费，故落地为 `theme.css` 里的具名 token 而非 `.ts` 数组）——同一批搜索结果卡片上要把"照片 / 视频 / OCR 命中"三种类别互相区分开，颜色语义是"第几类"而不是"主题强调色"，精确复刻 Vue2 `photos.scss:2768-2770` 的字面量，两套主题块给同一个值，不随皮肤深浅变化。不用 `--accent`/`--danger` 就近凑：那是"强调"/"危险"语义，与这里的"类别标识"语义不同。 |
+| `--photos-seg-video`（深 `#5e94ff` / 浅 `#3560d8`）/ `--photos-seg-raw`（深 `#ff9ac2` / 浅 `#c93f79`）/ `--photos-seg-ai`（深 `#ff9f0a` / 浅 `#a15f0a`）/ `--photos-seg-other`（深 `rgba(255,255,255,0.25)` / 浅 `rgba(28,27,25,0.25)`） | `theme.css`（`:root` 与 `:root[data-theme="light"]` 各给不同值）；消费于 `src/photos/util/storagePalette.ts` 的 `STORAGE_SEG_COLORS`，渲染于 `src/photos/components/PhotosStorageCard.vue` 的容量条 + 图例 | **数据可视化类别色**（与 `--badge-*` 同类）——设置页存储卡的容量条上要把 videos/RAW/AI 索引/其它数据四个类别互相区分开，颜色语义是"第几类数据"而不是"主题强调色"；photos 段与 thumbs 段复用既有 `--accent`/`--success`（不重造）。**与 `--badge-*` 的差异**：`--badge-*` 两套主题同值（Vue2 该视图只有一套设计），这四个 Vue2 深色原值（`PhotosSettings.vue:320/321/323`）铺在本仓浅色主题的纯白 `--card-bg` 上会偏灰、分段边界糊掉，故浅色档各自加深/提高饱和度（同色相）保持可辨识，两套主题给不同值。`other` 段精确复刻 Vue2 `rgba(var(--ink),0.25)` 的 alpha，RGB 换成本仓 `--fg` 的真实分解值（同 `--zb-hover-bg`/`--zb-track-bg` 的既定换基先例，本仓无 `--ink` 三元组 token）。 |
 
 注：`.ic-ai` 与 `.ic-all` / `.ic-app` 例外地**引用了** token（`--accent` / `--accent2` /
 `--orb-core` / `--all-bg` 等）——这部分仍随主题走，只有各图标的**固定品牌渐变**是例外。
 
 补充：`.grid-item .remove`、`.resize-handle::after`、`.media-play` 等全局规则里仍有个别
 `#fff` / `rgba(0,0,0,…)` 字面色（阴影、纯白箭头等中性值）。按 §0 约定，这些在收编硬编码色时
 应逐步 token 化；若判定为主题无关的纯中性值而保留，须在该行加注释说明。
 
 ---
 
diff --git a/src/photos/components/PhotosStorageCard.vue b/src/photos/components/PhotosStorageCard.vue
new file mode 100644
index 0000000..ebe41b0
--- /dev/null
+++ b/src/photos/components/PhotosStorageCard.vue
@@ -0,0 +1,342 @@
+<!--
+  SP7-P8a-T3: 设置页存储卡。
+  回源坐标:Vue2 PhotosSettings.vue:39-126(模板)、:299-331(capGB/freeGB/usedGB/
+  prunableBytes/scanIntervalOptions/breakdown/pctOf)、:382(fmt)、:405-457
+  (fmtBytes/clearCache/rescanNow/setScanInterval)。
+
+  卡片自己不弹 toast —— @toast 事件统一由 T5 的容器承接,同 Vue2 把 toast 状态放在容器
+  PhotosSettings.vue、showToast() 定义在 :487-491 一致。
+
+  接口边界记录(brief 的 Consumes 列表没点名,这里显式登记给 T5/T4 的实现者看):
+  - `about`/`deviceName` 直接读 store.about?.deviceName,不在本卡调用 fetchAbout()——
+    Vue2 mounted() 里 loadAbout() 与 loadStorage() 是同一个组件的两个并列调用,拆分后
+    "谁取 about" 没有强制归属;由本卡的姐妹组件(T5 容器,footer 也要 about.version)
+    统一取一次更省一次网络往返。取数完成前显示 Vue2 同款兜底 'NAS'。
+  - retentionDays/scanIntervalMinutes 同理不在本卡调用 fetchRetention()/fetchScanInterval()
+    (brief 的 Consumes 列表也没点这两个 action 名)——假定 T5 在挂载整页时统一取一次;
+    在那之前直接读 store 默认值(30/1440),取数落地后随 store 响应式更新。
+  - fetchStorage() **有**在 Consumes 列表里点名,所以本卡自己在 mounted 时调用一次
+    (与 Vue2 loadStorage() 对应),不依赖 T5。
+-->
+<script setup lang="ts">
+import { computed, onMounted, ref } from 'vue'
+import { useI18n } from 'vue-i18n'
+import { usePhotosSettingsStore } from '../stores/settings'
+import { fmtGB, fmtBytes, buildBreakdown, type StorageSegKey } from '../util/storagePalette'
+
+const emit = defineEmits<{ toast: [{ icon: string; text: string }] }>()
+
+const { t } = useI18n()
+const store = usePhotosSettingsStore()
+
+const deviceName = computed(() => store.about?.deviceName || 'NAS')
+
+const capGB = computed(() => (store.storage ? store.storage.diskTotalBytes / 1024 ** 3 : 0))
+const freeGB = computed(() => (store.storage ? store.storage.diskFreeBytes / 1024 ** 3 : 0))
+const usedGB = computed(() => Math.max(0, capGB.value - freeGB.value))
+const prunableBytes = computed(() => store.storage?.prunableBytes ?? 0)
+const breakdown = computed(() => (store.storage ? buildBreakdown(store.storage, usedGB.value) : []))
+function pctOf(gb: number): number {
+  return capGB.value > 0 ? (gb / capGB.value) * 100 : 0
+}
+
+const SEG_LABEL_KEYS: Record<StorageSegKey, string> = {
+  photos: 'photosSettingsSegPhotos',
+  videos: 'photosSettingsSegVideos',
+  raw: 'photosSettingsSegRaw',
+  thumbs: 'photosSettingsSegThumbs',
+  ai: 'photosSettingsSegAi',
+  other: 'photosSettingsSegOther',
+}
+
+const RETENTION_OPTIONS = [7, 15, 30, 60, 90] as const
+
+// Vue2 PhotosSettings.vue:304-311 的 scanIntervalOptions:6h/12h/24h/7d 这四个 label 在源里
+// 是裸字面量、从不过 $t(只有 off 那一档过 $t('scan_interval_off'))——它们是时长单位缩写
+// (小时/天),不是需要按语言翻译的自然语言句子,故照搬为字面量,不新增/复用 i18n key
+// (task-3-brief.md 的 ruling #1)。
+const scanIntervalOptions = computed(() => [
+  { min: 0, label: t('photosSettingsScanIntervalOff') },
+  { min: 360, label: '6h' },
+  { min: 720, label: '12h' },
+  { min: 1440, label: '24h' },
+  { min: 10080, label: '7d' },
+])
+
+async function selectRetention(d: number): Promise<void> {
+  const ok = await store.setRetention(d)
+  if (!ok) {
+    // Vue2 :254-262 的 retention watcher 失败时走 $buefy.toast(与本卡 showToast 完全不同的
+    // 提示组件,New-UI 没有等价物),不是 showToast(icon,...) 调用,所以源里没有一个可以照搬
+    // 的 icon 名。按语义最接近的既有 showToast 调用类比——":274-279" features 保存失败同样是
+    // "设置保存失败"场景,用的是 'shield' —— 这里同样取 'shield'。
+    emit('toast', { icon: 'shield', text: t('photosSettingsRetentionFailed') })
+  }
+}
+
+async function selectScanInterval(min: number): Promise<void> {
+  const ok = await store.setScanInterval(min)
+  if (!ok) {
+    // Vue2 :447-457 的失败分支同样走 $buefy.toast,文案还复用了 retention 的
+    // "Failed to save retention"(拷贝失误,不是本卡引入的新缺陷)。T2 没有为 scanInterval
+    // 单开一个失败文案键,本任务文件清单不含 i18n(不能新增/改键),故沿用同一个已存在的键,
+    // 与 Vue2 的实际文案选择保持一致——真正的修法是给 i18n 补一个专属键,挂账留给后续任务。
+    emit('toast', { icon: 'shield', text: t('photosSettingsRetentionFailed') })
+  }
+}
+
+const busy = ref(false)
+const cleared = ref(false)
+let clearedTimer: ReturnType<typeof setTimeout> | undefined
+
+async function clearCache(): Promise<void> {
+  if (busy.value) return
+  busy.value = true
+  try {
+    const freed = await store.pruneCache()
+    cleared.value = true
+    emit('toast', { icon: 'trash', text: t('photosSettingsCacheClearedToast', { size: fmtBytes(freed) }) })
+    // Vue2 :423 —— 清完必须重拉一次 storage,否则容量条/大数字不会反映刚清出的空间。
+    await store.fetchStorage()
+    clearTimeout(clearedTimer)
+    clearedTimer = setTimeout(() => { cleared.value = false }, 2000)
+  } catch {
+    emit('toast', { icon: 'trash', text: t('photosSettingsCacheClearFailed') })
+  } finally {
+    busy.value = false
+  }
+}
+
+const scanBusy = ref(false)
+async function rescanNow(): Promise<void> {
+  if (scanBusy.value) return
+  scanBusy.value = true
+  try {
+    await store.triggerScan()
+    emit('toast', { icon: 'check', text: t('photosSettingsRescanStarted') })
+  } catch {
+    // Vue2 :441 同样的拷贝缺陷("Failed to start rebuild",不是重扫专属文案),原因同上
+    // selectScanInterval 的注释——沿用 Vue2 实际选择的既有键,不新增。
+    emit('toast', { icon: 'trash', text: t('photosSettingsRebuildStartFailed') })
+  } finally {
+    scanBusy.value = false
+  }
+}
+
+onMounted(() => {
+  void store.fetchStorage()
+})
+</script>
+
+<template>
+  <section class="psc-card" id="storage">
+    <header class="psc-head">
+      <div class="psc-icon">
+        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
+          <rect x="3" y="4" width="18" height="16" rx="2" />
+          <path d="M3 10h18" />
+          <circle cx="7" cy="14" r="1" fill="currentColor" stroke="none" />
+        </svg>
+      </div>
+      <div>
+        <h2 class="psc-title">{{ t('photosSettingsStorage') }}</h2>
+        <div class="psc-sub">{{ deviceName }} &middot; {{ fmtGB(capGB) }} GB {{ t('photosSettingsVolume') }}</div>
+      </div>
+      <div class="psc-spacer"></div>
+      <div class="psc-headline" data-test="storage-headline">
+        <div v-if="store.storage" class="big">{{ fmtGB(freeGB) }} GB <span>{{ t('photosSettingsFree') }}</span></div>
+        <div v-else class="big">&mdash;</div>
+        <div v-if="store.storage" class="sub">{{ fmtGB(usedGB) }} GB {{ t('photosSettingsUsedOf') }} {{ fmtGB(capGB) }} GB</div>
+        <div v-else-if="store.storageError" class="sub">{{ t('photosSettingsStorageUnavailable') }}</div>
+      </div>
+    </header>
+
+    <div class="psc-bar">
+      <div
+        v-for="seg in breakdown" :key="seg.key" class="psc-bar-seg" data-test="bar-seg"
+        :title="`${t(SEG_LABEL_KEYS[seg.key])} · ${fmtGB(seg.gb)} GB`"
+        :style="{ width: pctOf(seg.gb) + '%', background: seg.color }"
+      ></div>
+      <div class="psc-bar-free" data-test="bar-free" :style="{ width: pctOf(freeGB) + '%' }"></div>
+    </div>
+    <div class="psc-legend">
+      <div v-for="seg in breakdown" :key="seg.key" class="psc-legend-row">
+        <span class="dot" :style="{ background: seg.color }"></span>
+        <span class="lbl">{{ t(SEG_LABEL_KEYS[seg.key]) }}</span>
+        <span class="val">{{ fmtGB(seg.gb) }} GB</span>
+      </div>
+      <div class="psc-legend-row">
+        <span class="dot psc-dot-free"></span>
+        <span class="lbl">{{ t('photosSettingsSegFree') }}</span>
+        <span class="val">{{ fmtGB(freeGB) }} GB</span>
+      </div>
+    </div>
+
+    <div class="psc-divider"></div>
+
+    <div class="psc-row">
+      <div class="psc-row-text">
+        <div class="psc-row-label">{{ t('photosSettingsRetentionLabel') }}</div>
+        <div class="psc-row-desc">{{ t('photosSettingsRetentionDesc') }}</div>
+      </div>
+      <div class="psc-seg" data-test="retention-seg">
+        <button
+          v-for="d in RETENTION_OPTIONS" :key="d" type="button" class="seg-btn"
+          :data-active="store.retentionDays === d" @click="selectRetention(d)"
+        >{{ t('photosSettingsRetentionDay', { n: d }) }}</button>
+      </div>
+    </div>
+
+    <div class="psc-row">
+      <div class="psc-row-text">
+        <div class="psc-row-label">{{ t('photosSettingsRescanLabel') }}</div>
+        <div class="psc-row-desc">{{ t('photosSettingsRescanDesc') }}</div>
+      </div>
+      <button type="button" class="psc-btn" :disabled="scanBusy" @click="rescanNow">
+        <span v-if="scanBusy" class="psc-spinner"></span>
+        {{ scanBusy ? t('photosSettingsRescanning') : t('photosSettingsRescanNow') }}
+      </button>
+    </div>
+
+    <div class="psc-row">
+      <div class="psc-row-text">
+        <div class="psc-row-label">{{ t('photosSettingsScanIntervalLabel') }}</div>
+        <div class="psc-row-desc">{{ t('photosSettingsScanIntervalDesc') }}</div>
+      </div>
+      <div class="psc-seg" data-test="scan-seg">
+        <button
+          v-for="opt in scanIntervalOptions" :key="opt.min" type="button" class="seg-btn"
+          :data-active="store.scanIntervalMinutes === opt.min" @click="selectScanInterval(opt.min)"
+        >{{ opt.label }}</button>
+      </div>
+    </div>
+
+    <div class="psc-row">
+      <div class="psc-row-text">
+        <div class="psc-row-label">{{ t('photosSettingsCacheLabel') }}</div>
+        <div class="psc-row-desc">{{ t('photosSettingsCacheDesc') }}</div>
+      </div>
+      <button type="button" class="psc-btn" data-test="clear-cache" :disabled="busy || !prunableBytes" @click="clearCache">
+        <svg v-if="!busy && !cleared" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
+        <span v-if="busy" class="psc-spinner"></span>
+        <svg v-if="cleared" class="psc-check" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
+        {{ busy ? t('photosSettingsClearing') : cleared ? t('photosSettingsCleared') : `${t('photosSettingsClearCache')} (${fmtBytes(prunableBytes)})` }}
+      </button>
+    </div>
+  </section>
+</template>
+
+<style scoped>
+.psc-card {
+  background: var(--card-bg);
+  border: 1px solid var(--card-border);
+  border-radius: var(--radius-sm);
+  box-shadow: var(--card-shadow);
+  padding: 20px 22px;
+  display: flex;
+  flex-direction: column;
+}
+
+.psc-head { display: flex; align-items: flex-start; gap: 12px; }
+
+.psc-icon {
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
+.psc-title { margin: 0; font-size: 15px; font-weight: 600; color: var(--fg); }
+.psc-sub { font-size: 12px; color: var(--fg-muted); margin-top: 2px; }
+.psc-spacer { flex: 1; }
+
+.psc-headline { text-align: right; }
+.psc-headline .big { font-size: 20px; font-weight: 600; color: var(--fg); font-family: var(--num-font); }
+.psc-headline .big span { font-size: 12px; font-weight: 400; color: var(--fg-muted); margin-left: 4px; }
+.psc-headline .sub { font-size: 12px; color: var(--fg-muted); margin-top: 2px; }
+
+.psc-bar {
+  display: flex;
+  height: 8px;
+  border-radius: 999px;
+  overflow: hidden;
+  background: var(--divider);
+  margin-top: 14px;
+}
+.psc-bar-seg { height: 100%; }
+.psc-bar-free { height: 100%; background: var(--divider); }
+
+.psc-legend { display: flex; flex-wrap: wrap; gap: 8px 16px; margin-top: 10px; }
+.psc-legend-row { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--fg-muted); }
+.dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
+.psc-dot-free { background: var(--divider); border: 1px solid var(--card-border); }
+.val { color: var(--fg); font-weight: 500; }
+
+.psc-divider { height: 1px; background: var(--divider); margin: 16px 0; }
+
+.psc-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 10px 0; }
+.psc-row-label { font-size: 13px; font-weight: 500; color: var(--fg); }
+.psc-row-desc { font-size: 12px; color: var(--fg-muted); margin-top: 2px; max-width: 360px; }
+
+.psc-seg {
+  display: inline-flex;
+  background: var(--chip-bg);
+  border: 1px solid var(--card-border);
+  border-radius: 999px;
+  padding: 2px;
+  gap: 2px;
+  flex-shrink: 0;
+}
+
+.seg-btn {
+  border: none;
+  background: transparent;
+  color: var(--fg-muted);
+  font-size: 12px;
+  padding: 6px 10px;
+  border-radius: 999px;
+  cursor: pointer;
+}
+.seg-btn:hover { background: var(--chip-bg-hi); }
+.seg-btn[data-active="true"] { background: var(--accent); color: var(--on-accent); }
+/* 本区已栽四次的坑:基类 `.seg-btn:hover`(优先级 2:一个类 + 一个伪类)与变体
+   `.seg-btn[data-active="true"]`(优先级 2:一个类 + 一个属性选择器)相等——同优先级下
+   源码顺序在.seg-btn:hover之后声明的[data-active]规则平时能压住,但鼠标一进按钮触发
+   `.seg-btn:hover`,若没有专门的 [data-active]:hover 规则,两条同优先级规则的胜负会变得
+   脆弱(依赖书写顺序而非语义)。变体必须自带 :hover 规则,用第三个选择器把优先级明确
+   抬高到 3,不依赖 tie-break。 */
+.seg-btn[data-active="true"]:hover { background: var(--accent); color: var(--on-accent); }
+
+.psc-btn {
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
+.psc-btn:hover:not(:disabled) { background: var(--chip-bg-hi); }
+.psc-btn:disabled { opacity: 0.5; cursor: default; }
+.psc-btn svg { flex-shrink: 0; }
+.psc-check { color: var(--success); }
+
+.psc-spinner {
+  width: 12px;
+  height: 12px;
+  border-radius: 50%;
+  border: 2px solid var(--chip-border);
+  border-top-color: var(--accent);
+  animation: psc-spin 0.8s linear infinite;
+}
+@keyframes psc-spin { to { transform: rotate(360deg); } }
+</style>
diff --git a/src/photos/components/__tests__/PhotosStorageCard.test.ts b/src/photos/components/__tests__/PhotosStorageCard.test.ts
new file mode 100644
index 0000000..18b126c
--- /dev/null
+++ b/src/photos/components/__tests__/PhotosStorageCard.test.ts
@@ -0,0 +1,241 @@
+// SP7-P8a-T3: PhotosStorageCard.vue —— 设置页存储卡。
+// 回源坐标见 task-3-brief.md;Vue2 PhotosSettings.vue:39-126(模板)/:299-331(computed)/
+// :382(fmt)/:405-457(fmtBytes/五个动作方法)。
+//
+// 测试基建偏离登记(brief 与本仓实际不符,以本仓实测为准):
+// 1. brief 草稿用 `@pinia/testing` 的 `createTestingPinia({ stubActions: true })`,但本仓
+//    package.json 未装该包(`node_modules/.pnpm` 无 `@pinia/testing` 任何版本)。改用本仓
+//    settings.test.ts / AlbumPickerDialog.test.ts 的既定做法:`setActivePinia(createPinia())`
+//    起一个真实 store 实例,用 `vi.spyOn(store, 'action')` 单独按需 stub 需要控制返回值的
+//    action,其余走真实实现(mock 的是共享包 `@nimotech/nimoos-service`,不是 store 本身)。
+// 2. brief Step7 引用的 `winningDeclaration(css, [...], 'background', {hover, dataActive})`
+//    与 `readComponentStyle()` 在 `cssCascade.ts` 里都不存在——该文件实际只导出
+//    `extractStyleBlock`/`winningHoverBackground`/`parseCssRules`/`ownBackground`。改用
+//    `PhotosFilterChip.test.ts:107-114` 的既定写法:`?raw` 导入组件源码 → `extractStyleBlock`
+//    → `winningHoverBackground(style, ['seg-btn'])`,断言胜出选择器同时含 `:hover` 与
+//    `data-active`。
+import { describe, it, expect, vi, beforeEach } from 'vitest'
+import { mount, flushPromises } from '@vue/test-utils'
+import { setActivePinia, createPinia } from 'pinia'
+import { nextTick } from 'vue'
+import { fmtGB, fmtBytes, buildBreakdown } from '../../util/storagePalette'
+
+describe('storage 卡纯函数', () => {
+  it('fmtGB:>=100 取整,否则一位小数(Vue2 :382)', () => {
+    expect(fmtGB(100)).toBe('100')
+    expect(fmtGB(99.94)).toBe('99.9')
+    expect(fmtGB(0)).toBe('0.0')
+  })
+
+  it('fmtBytes:逐级进位,>=100 取整(Vue2 :405-413)', () => {
+    expect(fmtBytes(0)).toBe('0 B')
+    expect(fmtBytes(-1)).toBe('0 B')
+    expect(fmtBytes(512)).toBe('512 B') // 512 >= 100 ⇒ 取整
+    expect(fmtBytes(1536)).toBe('1.5 KB')
+    expect(fmtBytes(1024 ** 4 * 2)).toBe('2.0 TB')
+    // 单位表到 TB 为止,更大的值继续用 TB 表示(while 的 i < len-1 上界)
+    expect(fmtBytes(1024 ** 5)).toBe('1024 TB')
+  })
+
+  it('buildBreakdown:段序固定,other 仅在剩余 > 0.05 GB 时追加(Vue2 :327)', () => {
+    const GB = 1024 ** 3
+    const segs = buildBreakdown(
+      { photosBytes: 3 * GB, videosBytes: 2 * GB, rawBytes: GB, cacheBytes: 0, aiBytes: 0 },
+      10, // usedGB
+    )
+    expect(segs.map((s) => s.key)).toEqual(['photos', 'videos', 'raw', 'thumbs', 'ai', 'other'])
+    expect(segs.find((s) => s.key === 'other')!.gb).toBeCloseTo(4, 5)
+  })
+
+  it('buildBreakdown:剩余恰好 0.05 GB 不追加 other(边界是严格大于)', () => {
+    // 偏离登记(brief 自身的测试夹具数字有浮点误差,不是源码/brief 逻辑冲突):
+    // brief 草稿原用 `{photosBytes: 1GB}, usedGB=1.05` 意图让 other = 1.05-1 恰好命中 0.05,
+    // 但 `1.05 - 1` 在 IEEE-754 双精度下是 0.050000000000000044(> 0.05),不是精确的 0.05,
+    // 导致这条"边界不追加"的用例在原数字下必然误判为"追加"——这是计算机浮点减法的固有噪声,
+    // 与 buildBreakdown/Vue2 源的 `other > 0.05` 判据本身无关。改用 known=0(不含任何已知段)
+    // + usedGB=0.05,让 other = Math.max(0, 0.05 - 0) 与实现里的字面量 0.05 是同一个双精度
+    // 比特模式,真正落在边界上,不引入减法噪声。
+    const segs = buildBreakdown(
+      { photosBytes: 0, videosBytes: 0, rawBytes: 0, cacheBytes: 0, aiBytes: 0 },
+      0.05,
+    )
+    expect(segs.map((s) => s.key)).not.toContain('other')
+  })
+
+  it('buildBreakdown:负数字节按 0 处理(Vue2 :317 的 Math.max(0, b))', () => {
+    const segs = buildBreakdown(
+      { photosBytes: -1, videosBytes: 0, rawBytes: 0, cacheBytes: 0, aiBytes: 0 },
+      0,
+    )
+    expect(segs.find((s) => s.key === 'photos')!.gb).toBe(0)
+  })
+})
+
+// ---------------------------------------------------------------------------
+// 组件测试:真实 Pinia store + mock 共享包(不是 mock store 本身)
+// ---------------------------------------------------------------------------
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
+    },
+  },
+}))
+
+import PhotosStorageCard from '../PhotosStorageCard.vue'
+import photosStorageCardRaw from '../PhotosStorageCard.vue?raw'
+import { usePhotosSettingsStore } from '../../stores/settings'
+import { extractStyleBlock, winningHoverBackground } from './cssCascade'
+
+const GB = 1024 ** 3
+
+function mountCard() {
+  const wrapper = mount(PhotosStorageCard)
+  const store = usePhotosSettingsStore()
+  return { wrapper, store }
+}
+
+describe('PhotosStorageCard', () => {
+  beforeEach(() => {
+    setActivePinia(createPinia())
+    vi.clearAllMocks()
+  })
+
+  it('storageError 时大数字位显示破折号 + 不可用副行', async () => {
+    const { wrapper, store } = mountCard()
+    store.storage = null
+    store.storageError = true
+    await nextTick()
+    expect(wrapper.get('[data-test="storage-headline"]').text()).toContain('—')
+    expect(wrapper.text()).toContain('不可用')
+  })
+
+  it('retention 5 档,当前档带 data-active', async () => {
+    const { wrapper, store } = mountCard()
+    store.retentionDays = 30
+    await nextTick()
+    const btns = wrapper.findAll('[data-test="retention-seg"] button')
+    expect(btns).toHaveLength(5)
+    expect(btns.filter((b) => b.attributes('data-active') === 'true')).toHaveLength(1)
+    expect(btns[2]!.attributes('data-active')).toBe('true') // [7,15,30,60,90] 的第三档
+  })
+
+  it('点 retention 档位调 setRetention;失败时 emit toast', async () => {
+    const { wrapper, store } = mountCard()
+    vi.spyOn(store, 'setRetention').mockResolvedValue(false)
+    await wrapper.findAll('[data-test="retention-seg"] button')[4]!.trigger('click')
+    expect(store.setRetention).toHaveBeenCalledWith(90)
+    await flushPromises()
+    expect(wrapper.emitted('toast')).toBeTruthy()
+  })
+
+  it('点 retention 档位成功不 emit toast', async () => {
+    const { wrapper, store } = mountCard()
+    vi.spyOn(store, 'setRetention').mockResolvedValue(true)
+    await wrapper.findAll('[data-test="retention-seg"] button')[0]!.trigger('click')
+    await flushPromises()
+    expect(wrapper.emitted('toast')).toBeFalsy()
+  })
+
+  it('scanInterval 5 档,off 档的值走 i18n(其余四档是单位缩写字面量,不过 $t)', async () => {
+    const { wrapper } = mountCard()
+    const btns = wrapper.findAll('[data-test="scan-seg"] button')
+    expect(btns).toHaveLength(5)
+    expect(btns.map((b) => b.text())).toEqual([
+      expect.not.stringMatching(/^\d/), '6h', '12h', '24h', '7d',
+    ])
+  })
+
+  it('点 scanInterval 档位调 setScanInterval;失败时 emit toast', async () => {
+    const { wrapper, store } = mountCard()
+    vi.spyOn(store, 'setScanInterval').mockResolvedValue(false)
+    await wrapper.findAll('[data-test="scan-seg"] button')[1]!.trigger('click')
+    expect(store.setScanInterval).toHaveBeenCalledWith(360)
+    await flushPromises()
+    expect(wrapper.emitted('toast')).toBeTruthy()
+  })
+
+  it('缓存按钮:prunableBytes 为 0 时禁用', async () => {
+    const { wrapper, store } = mountCard()
+    store.storage = {
+      diskTotalBytes: 100 * GB, diskFreeBytes: 40 * GB, prunableBytes: 0,
+      photosBytes: 30 * GB, videosBytes: 20 * GB, rawBytes: 5 * GB, cacheBytes: 2 * GB, aiBytes: GB,
+    }
+    await nextTick()
+    expect(wrapper.get('[data-test="clear-cache"]').attributes('disabled')).toBeDefined()
+  })
+
+  it('缓存按钮:prunableBytes > 0 时可点', async () => {
+    const { wrapper, store } = mountCard()
+    store.storage = {
+      diskTotalBytes: 100 * GB, diskFreeBytes: 40 * GB, prunableBytes: 512 * 1024 * 1024,
+      photosBytes: 30 * GB, videosBytes: 20 * GB, rawBytes: 5 * GB, cacheBytes: 2 * GB, aiBytes: GB,
+    }
+    await nextTick()
+    expect(wrapper.get('[data-test="clear-cache"]').attributes('disabled')).toBeUndefined()
+  })
+
+  it('清缓存成功后重拉 storage(Vue2 :423)且 emit 成功 toast', async () => {
+    const { wrapper, store } = mountCard()
+    store.storage = {
+      diskTotalBytes: 100 * GB, diskFreeBytes: 40 * GB, prunableBytes: 512 * 1024 * 1024,
+      photosBytes: 30 * GB, videosBytes: 20 * GB, rawBytes: 5 * GB, cacheBytes: 2 * GB, aiBytes: GB,
+    }
+    await nextTick()
+    vi.spyOn(store, 'pruneCache').mockResolvedValue(1024 * 1024)
+    const fetchSpy = vi.spyOn(store, 'fetchStorage').mockResolvedValue(undefined)
+    await wrapper.get('[data-test="clear-cache"]').trigger('click')
+    await flushPromises()
+    expect(fetchSpy).toHaveBeenCalled()
+    expect(wrapper.emitted('toast')).toBeTruthy()
+  })
+
+  it('清缓存失败:emit 失败 toast,不重拉 storage', async () => {
+    const { wrapper, store } = mountCard()
+    store.storage = {
+      diskTotalBytes: 100 * GB, diskFreeBytes: 40 * GB, prunableBytes: 512 * 1024 * 1024,
+      photosBytes: 30 * GB, videosBytes: 20 * GB, rawBytes: 5 * GB, cacheBytes: 2 * GB, aiBytes: GB,
+    }
+    await nextTick()
+    vi.spyOn(store, 'pruneCache').mockRejectedValue(new Error('boom'))
+    const fetchSpy = vi.spyOn(store, 'fetchStorage').mockResolvedValue(undefined)
+    await wrapper.get('[data-test="clear-cache"]').trigger('click')
+    await flushPromises()
+    expect(fetchSpy).not.toHaveBeenCalled()
+    expect(wrapper.emitted('toast')).toBeTruthy()
+  })
+
+  it('容量条段数 = breakdown 段数 + 1 个 free 段', async () => {
+    const { wrapper, store } = mountCard()
+    store.storage = {
+      diskTotalBytes: 100 * GB, diskFreeBytes: 40 * GB, prunableBytes: 512 * 1024 * 1024,
+      photosBytes: 30 * GB, videosBytes: 20 * GB, rawBytes: 5 * GB, cacheBytes: 2 * GB, aiBytes: GB,
+    }
+    await nextTick()
+    expect(wrapper.findAll('[data-test="bar-seg"]').length).toBeGreaterThanOrEqual(5)
+    expect(wrapper.findAll('[data-test="bar-free"]')).toHaveLength(1)
+  })
+
+  it('mount 时自取一次 storage(fetchStorage 被调,矫正 T3 Consumes 接口列表里点名的动作)', () => {
+    const fetchSpy = vi.spyOn(usePhotosSettingsStore(), 'fetchStorage')
+    mount(PhotosStorageCard)
+    expect(fetchSpy).toHaveBeenCalled()
+  })
+})
+
+describe('样式:分段器 [data-active] 变体自带 hover 背景(本区已栽四次)', () => {
+  it('seg-btn 的 hover 胜出规则同时含 :hover 与 data-active', () => {
+    const style = extractStyleBlock(photosStorageCardRaw)
+    expect(style.length).toBeGreaterThan(0)
+    const winner = winningHoverBackground(style, ['seg-btn'])
+    expect(winner.selector).toContain(':hover')
+    expect(winner.selector).toContain('data-active')
+  })
+})
diff --git a/src/photos/util/storagePalette.ts b/src/photos/util/storagePalette.ts
new file mode 100644
index 0000000..56ad0a0
--- /dev/null
+++ b/src/photos/util/storagePalette.ts
@@ -0,0 +1,65 @@
+// SP7-P8a-T3: 存储条的分段调色板 + 纯格式化函数。照 D5 / PLACE_PALETTE(P5-T12)/
+// placesMapThemes.ts(P6a)/ --badge-photo 等(P7a-T15)的既定先例:**数据可视化调色板**
+// 归 docs/THEMING.md 第0约定第三类例外 —— photos/thumbs 两段直接引用既有语义 token,
+// 其余三段(videos/raw/ai)与 other 段是 Vue2 内联的、与主题皮肤无关的分类识别色,值落在
+// theme.css 的具名 token 里(同 --badge-* 的落地方式,不是散落在 <style> 块里的字面量,
+// 也不是本 .ts 文件里的字面量——那样会在两套主题间失去"跟随皮肤微调对比度"的能力)。
+//
+// 「palette」这个文件名承载的不只是调色板——fmtGB/fmtBytes/buildBreakdown 三个格式化/
+// 分段纯函数也放在这里,是任务文件结构的既定安排(task-3-brief.md),不要拆文件。
+export const STORAGE_SEG_COLORS = {
+  photos: 'var(--accent)',
+  videos: 'var(--photos-seg-video)',
+  raw: 'var(--photos-seg-raw)',
+  thumbs: 'var(--success)',
+  ai: 'var(--photos-seg-ai)',
+  other: 'var(--photos-seg-other)',
+} as const
+
+export type StorageSegKey = keyof typeof STORAGE_SEG_COLORS
+
+export interface StorageSeg { key: StorageSegKey; gb: number; color: string }
+
+export interface StorageBytes {
+  photosBytes: number
+  videosBytes: number
+  rawBytes: number
+  cacheBytes: number
+  aiBytes: number
+}
+
+// Vue2 PhotosSettings.vue:382
+export function fmtGB(g: number): string {
+  return g >= 100 ? g.toFixed(0) : g.toFixed(1)
+}
+
+// Vue2 PhotosSettings.vue:405-413
+const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const
+export function fmtBytes(b: number): string {
+  if (!b || b <= 0) return '0 B'
+  let i = 0
+  let v = b
+  while (v >= 1024 && i < BYTE_UNITS.length - 1) {
+    v /= 1024
+    i++
+  }
+  return `${v >= 100 ? v.toFixed(0) : v.toFixed(1)} ${BYTE_UNITS[i]}`
+}
+
+// Vue2 PhotosSettings.vue:313-330 —— 段序固定;other 段只在「已用总量减去已知段合计」
+// 严格大于 0.05 GB 时追加(小于这个量的零头不值得画一段)。
+const OTHER_THRESHOLD_GB = 0.05
+export function buildBreakdown(bytes: StorageBytes, usedGB: number): StorageSeg[] {
+  const gb = (b: number): number => Math.max(0, b) / 1024 ** 3
+  const segs: StorageSeg[] = [
+    { key: 'photos', gb: gb(bytes.photosBytes), color: STORAGE_SEG_COLORS.photos },
+    { key: 'videos', gb: gb(bytes.videosBytes), color: STORAGE_SEG_COLORS.videos },
+    { key: 'raw', gb: gb(bytes.rawBytes), color: STORAGE_SEG_COLORS.raw },
+    { key: 'thumbs', gb: gb(bytes.cacheBytes), color: STORAGE_SEG_COLORS.thumbs },
+    { key: 'ai', gb: gb(bytes.aiBytes), color: STORAGE_SEG_COLORS.ai },
+  ]
+  const known = segs.reduce((a, s) => a + s.gb, 0)
+  const other = Math.max(0, usedGB - known)
+  if (other > OTHER_THRESHOLD_GB) segs.push({ key: 'other', gb: other, color: STORAGE_SEG_COLORS.other })
+  return segs
+}
diff --git a/src/styles/theme.css b/src/styles/theme.css
index 234f322..4653f6e 100644
--- a/src/styles/theme.css
+++ b/src/styles/theme.css
@@ -156,20 +156,37 @@
   /* SP7-P7a-T15:搜索结果卡片左上角媒体类别徽标(.type-badge[data-type])三色——
      数据可视化类别色（THEMING.md §0 第三类例外的变体：同一批结果里要把"照片/视频/
      OCR 命中"这三种互不相同的类别互相区分开，颜色语义是"第几类"而非"主题强调色"）。
      精确复刻 Vue2 photos.scss:2768-2770 的字面量,两套主题块同值——不随皮肤深浅走,
      同 --place-current-trip/--console-bg 的既有先例(同类先例见 THEMING.md §6)。
      不用 --accent/--danger 就近凑:它们是三个并列的类别标识,不是"强调"或"危险"语义。 */
   --badge-photo: rgba(50, 190, 230, 0.9);   /* 青 cyan */
   --badge-video: rgba(255, 149, 10, 0.92);  /* 橙 orange */
   --badge-ocr: rgba(16, 185, 129, 0.92);    /* 翠绿 emerald */
 
+  /* SP7-P8a-T3:设置页存储卡容量条分段色(PhotosStorageCard.vue,消费于
+     src/photos/util/storagePalette.ts 的 STORAGE_SEG_COLORS)——同上一组一样是**数据可视化
+     类别色**:同一条容量条上要把 videos/raw/ai/other 四个互不相同的数据段互相区分开,
+     颜色语义是"第几类数据"而不是"主题强调色"。photos 段用 --accent、thumbs 段用 --success
+     (既有语义 token 直接复用,不新增),这四个是 Vue2 内联的、本仓无对应语义 token 的字面量,
+     故新增。深色精确复刻 Vue2 PhotosSettings.vue:320/321/323 的字面量;浅色不能照抄深色值——
+     videos 的中蓝、raw 的浅粉柔和色铺在本主题纯白 --card-bg 上会偏灰、分段边界糊掉,故各自
+     加深/提高饱和度保持在白底上可辨识(同 --warn-fg 浅色把 #FF9F0A 压成 #96610a 保对比度的
+     既定手法,但这里是三个并列的类别色而非单一警告语义,故各给独立值而非借用 --warn-fg)。 */
+  --photos-seg-video: #5e94ff;
+  --photos-seg-raw: #ff9ac2;
+  --photos-seg-ai: #ff9f0a;
+  /* other 段 Vue2 原值是 rgba(var(--ink),0.25)("跟随文字色的透明度斜坡"),本仓无 --ink
+     三元组 token——同 --zb-hover-bg/--zb-track-bg 的既定换基先例:alpha 精确复刻 0.25,
+     RGB 改取本仓 --fg 的真实分解值(dark #ffffff→255,255,255)。 */
+  --photos-seg-other: rgba(255, 255, 255, 0.25);
+
   /* P6 终端/日志控制台(终端语义固定深色,不随主题翻转;两套主题块同值,与 Vue2 旧实现一致) */
   --console-bg: #1e1e1e;
   --console-fg: #d4d4d4;
   /* 固定深底区域(monokai 编辑器/日志/终端)的滚动条拇指:全局滚动条颜色随主题翻转,
      浅色主题下会变成深拇指、落在这些固定深底上不可见——故单独给亮色拇指,两套主题同值 */
   --console-scroll-thumb: rgba(255, 255, 255, 0.32);
   --console-scroll-thumb-hover: rgba(255, 255, 255, 0.5);
 
   /* 时间机器覆盖层。跟随主题(用户拍板):深色是深空,浅色是纸感 —— 两套各自成立,
      不是一套深色硬塞进浅色主题里。 */
@@ -431,20 +448,37 @@
      故前景压到深琥珀(同 --dem-fg 的 #92600c 一档),底/描边给纸感主题的实色。 */
   --warn-fg: #96610a;
   --warn-bg: #fdf3e2;
   --warn-border: #f0d7a6;
 
   /* SP7-P7a-T15:同 :root 同名注释——三个媒体类别徽标色,两套主题块同值,不随皮肤翻转。 */
   --badge-photo: rgba(50, 190, 230, 0.9);
   --badge-video: rgba(255, 149, 10, 0.92);
   --badge-ocr: rgba(16, 185, 129, 0.92);
 
+  /* SP7-P8a-T3:同 :root 同名注释——存储卡容量条分段色。浅色主题按可读性微调(不是照抄
+     Vue2 唯一深色设计的原值):
+     --photos-seg-video 从 Vue2 的中蓝 #5e94ff 加深到 #3560d8——纸感白底 --card-bg(#ffffff)
+     上原值发灰、和相邻分段边界不够清楚,加深/提高饱和度后仍是同一色相的蓝。
+     --photos-seg-raw 从 Vue2 的浅粉 #ff9ac2 加深到 #c93f79——浅粉铺在纯白底上几乎融进背景,
+     压深成同色相的玫红以保证分段轮廓可辨。
+     --photos-seg-ai 从 Vue2 的橙 #ff9f0a 压到 #a15f0a——同 --warn-fg 浅色档处理同一个字面量
+     色值的既定手法(压暗保对比度),但这里是独立的类别标识 token,不直接借用 --warn-fg
+     (那是"警告"语义,这里是"第几类数据"语义,同一个字面量色值、两个不同的 token)。 */
+  --photos-seg-video: #3560d8;
+  --photos-seg-raw: #c93f79;
+  --photos-seg-ai: #a15f0a;
+  /* alpha 与 :root 同为 0.25(精确复刻 Vue2 other 段 rgba(var(--ink),0.25)),RGB 换成本仓
+     浅色 --fg 的真实分解值(#1c1b19→28,27,25)——同 --zb-hover-bg/--zb-track-bg 浅色档的既定
+     换基公式。 */
+  --photos-seg-other: rgba(28, 27, 25, 0.25);
+
   /* P6 终端/日志控制台(终端语义固定深色,不随主题翻转;两套主题块同值,与 Vue2 旧实现一致) */
   --console-bg: #1e1e1e;
   --console-fg: #d4d4d4;
   /* 固定深底区域(monokai 编辑器/日志/终端)的滚动条拇指:全局滚动条颜色随主题翻转,
      浅色主题下会变成深拇指、落在这些固定深底上不可见——故单独给亮色拇指,两套主题同值 */
   --console-scroll-thumb: rgba(255, 255, 255, 0.32);
   --console-scroll-thumb-hover: rgba(255, 255, 255, 0.5);
 
   /* 时间机器 —— 浅色纸感:没有星空(--tm-star 透明),背景是米白 + 极淡光晕 */
   --tm-bg:
```
