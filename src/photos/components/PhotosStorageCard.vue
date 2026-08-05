<!--
  SP7-P8a-T3: 设置页存储卡。
  回源坐标:Vue2 PhotosSettings.vue:39-126(模板)、:299-331(capGB/freeGB/usedGB/
  prunableBytes/scanIntervalOptions/breakdown/pctOf)、:382(fmt)、:405-457
  (fmtBytes/clearCache/rescanNow/setScanInterval)。

  卡片自己不弹 toast —— @toast 事件统一由 T5 的容器承接,同 Vue2 把 toast 状态放在容器
  PhotosSettings.vue、showToast() 定义在 :487-491 一致。

  接口边界记录(brief 的 Consumes 列表没点名,这里显式登记给 T5/T4 的实现者看):
  - `about`/`deviceName` 直接读 store.about?.deviceName,不在本卡调用 fetchAbout()——
    Vue2 mounted() 里 loadAbout() 与 loadStorage() 是同一个组件的两个并列调用,拆分后
    "谁取 about" 没有强制归属;由本卡的姐妹组件(T5 容器,footer 也要 about.version)
    统一取一次更省一次网络往返。取数完成前显示 Vue2 同款兜底 'NAS'。
  - retentionDays/scanIntervalMinutes 同理不在本卡调用 fetchRetention()/fetchScanInterval()
    (brief 的 Consumes 列表也没点这两个 action 名)——假定 T5 在挂载整页时统一取一次;
    在那之前直接读 store 默认值(30/1440),取数落地后随 store 响应式更新。
  - fetchStorage() **有**在 Consumes 列表里点名,所以本卡自己在 mounted 时调用一次
    (与 Vue2 loadStorage() 对应),不依赖 T5。
-->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePhotosSettingsStore } from '../stores/settings'
import { fmtGB, fmtBytes, buildBreakdown, type StorageSegKey } from '../util/storagePalette'

const emit = defineEmits<{ toast: [{ icon: string; text: string }] }>()

const { t } = useI18n()
const store = usePhotosSettingsStore()

const deviceName = computed(() => store.about?.deviceName || 'NAS')

const capGB = computed(() => (store.storage ? store.storage.diskTotalBytes / 1024 ** 3 : 0))
const freeGB = computed(() => (store.storage ? store.storage.diskFreeBytes / 1024 ** 3 : 0))
const usedGB = computed(() => Math.max(0, capGB.value - freeGB.value))
const prunableBytes = computed(() => store.storage?.prunableBytes ?? 0)
const breakdown = computed(() => (store.storage ? buildBreakdown(store.storage, usedGB.value) : []))
function pctOf(gb: number): number {
  return capGB.value > 0 ? (gb / capGB.value) * 100 : 0
}

const SEG_LABEL_KEYS: Record<StorageSegKey, string> = {
  photos: 'photosSettingsSegPhotos',
  videos: 'photosSettingsSegVideos',
  raw: 'photosSettingsSegRaw',
  thumbs: 'photosSettingsSegThumbs',
  ai: 'photosSettingsSegAi',
  other: 'photosSettingsSegOther',
}

const RETENTION_OPTIONS = [7, 15, 30, 60, 90] as const

// Vue2 PhotosSettings.vue:304-311 的 scanIntervalOptions:6h/12h/24h/7d 这四个 label 在源里
// 是裸字面量、从不过 $t(只有 off 那一档过 $t('scan_interval_off'))——它们是时长单位缩写
// (小时/天),不是需要按语言翻译的自然语言句子,故照搬为字面量,不新增/复用 i18n key
// (task-3-brief.md 的 ruling #1)。
//
// 终审 Minor 7(不改行为,仅登记):retention(:186,photosSettingsRetentionDay)译成了
// 「{n} 天」,这里的扫描间隔挡位却保留 6h/12h/24h/7d 字面量——zh 下两组相邻分段控件因此
// 一个读「7 天 | 15 天 | 30 天 …」、一个读「关闭 | 6h | 12h | 24h | 7d」,Vue2 原本两组
// 内部风格一致(都是 7d…/Off 6h…字面量)。两种做法各自都说得通(retention 走 $t 是本期
// 刻意登记的选择,见上一段注释链;scan 保留单位缩写也有它的理由),但相邻不一致本身没被
// 登记过——写在这里存证,是决策而非疏漏。是否统一,留给机主上机验收时拍板(不在本波修复
// 范围)。
const scanIntervalOptions = computed(() => [
  { min: 0, label: t('photosSettingsScanIntervalOff') },
  { min: 360, label: '6h' },
  { min: 720, label: '12h' },
  { min: 1440, label: '24h' },
  { min: 10080, label: '7d' },
])

async function selectRetention(d: number): Promise<void> {
  const ok = await store.setRetention(d)
  if (!ok) {
    // Vue2 :254-262 的 retention watcher 失败时走 $buefy.toast(与本卡 showToast 完全不同的
    // 提示组件,New-UI 没有等价物),不是 showToast(icon,...) 调用,所以源里没有一个可以照搬
    // 的 icon 名。按语义最接近的既有 showToast 调用类比——":274-279" features 保存失败同样是
    // "设置保存失败"场景,用的是 'shield' —— 这里同样取 'shield'。
    emit('toast', { icon: 'shield', text: t('photosSettingsRetentionFailed') })
  }
}

async function selectScanInterval(min: number): Promise<void> {
  const ok = await store.setScanInterval(min)
  if (!ok) {
    // Vue2 :447-457 的失败分支同样走 $buefy.toast,文案还复用了 retention 的
    // "Failed to save retention"(拷贝失误,不是本卡引入的新缺陷)。T2 没有为 scanInterval
    // 单开一个失败文案键,本任务文件清单不含 i18n(不能新增/改键),故沿用同一个已存在的键,
    // 与 Vue2 的实际文案选择保持一致——真正的修法是给 i18n 补一个专属键,挂账留给后续任务。
    emit('toast', { icon: 'shield', text: t('photosSettingsRetentionFailed') })
  }
}

const busy = ref(false)
const cleared = ref(false)
let clearedTimer: ReturnType<typeof setTimeout> | undefined

async function clearCache(): Promise<void> {
  if (busy.value) return
  busy.value = true
  try {
    const freed = await store.pruneCache()
    cleared.value = true
    emit('toast', { icon: 'trash', text: t('photosSettingsCacheClearedToast', { size: fmtBytes(freed) }) })
    // Vue2 :423 —— 清完必须重拉一次 storage,否则容量条/大数字不会反映刚清出的空间。
    await store.fetchStorage()
    clearTimeout(clearedTimer)
    clearedTimer = setTimeout(() => { cleared.value = false }, 2000)
  } catch {
    emit('toast', { icon: 'trash', text: t('photosSettingsCacheClearFailed') })
  } finally {
    busy.value = false
  }
}

const scanBusy = ref(false)
async function rescanNow(): Promise<void> {
  if (scanBusy.value) return
  scanBusy.value = true
  try {
    await store.triggerScan()
    emit('toast', { icon: 'check', text: t('photosSettingsRescanStarted') })
  } catch {
    // Vue2 :441 同样的拷贝缺陷("Failed to start rebuild",不是重扫专属文案),原因同上
    // selectScanInterval 的注释——沿用 Vue2 实际选择的既有键,不新增。
    emit('toast', { icon: 'trash', text: t('photosSettingsRebuildStartFailed') })
  } finally {
    scanBusy.value = false
  }
}

onMounted(() => {
  void store.fetchStorage()
})
</script>

<template>
  <section class="psc-card" id="storage">
    <header class="psc-head">
      <div class="psc-icon">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 10h18" />
          <circle cx="7" cy="14" r="1" fill="currentColor" stroke="none" />
        </svg>
      </div>
      <div>
        <h2 class="psc-title">{{ t('photosSettingsStorage') }}</h2>
        <div class="psc-sub">{{ deviceName }} &middot; {{ fmtGB(capGB) }} GB {{ t('photosSettingsVolume') }}</div>
      </div>
      <div class="psc-spacer"></div>
      <div class="psc-headline" data-test="storage-headline">
        <div v-if="store.storage" class="big">{{ fmtGB(freeGB) }} GB <span>{{ t('photosSettingsFree') }}</span></div>
        <div v-else class="big">&mdash;</div>
        <div v-if="store.storage" class="sub">{{ fmtGB(usedGB) }} GB {{ t('photosSettingsUsedOf') }} {{ fmtGB(capGB) }} GB</div>
        <div v-else-if="store.storageError" class="sub">{{ t('photosSettingsStorageUnavailable') }}</div>
      </div>
    </header>

    <div class="psc-bar">
      <div
        v-for="seg in breakdown" :key="seg.key" class="psc-bar-seg" data-test="bar-seg"
        :title="`${t(SEG_LABEL_KEYS[seg.key])} · ${fmtGB(seg.gb)} GB`"
        :style="{ width: pctOf(seg.gb) + '%', background: seg.color }"
      ></div>
      <div class="psc-bar-free" data-test="bar-free" :style="{ width: pctOf(freeGB) + '%' }"></div>
    </div>
    <div class="psc-legend">
      <div v-for="seg in breakdown" :key="seg.key" class="psc-legend-row">
        <span class="dot" :style="{ background: seg.color }"></span>
        <span class="lbl">{{ t(SEG_LABEL_KEYS[seg.key]) }}</span>
        <span class="val">{{ fmtGB(seg.gb) }} GB</span>
      </div>
      <div class="psc-legend-row">
        <span class="dot psc-dot-free"></span>
        <span class="lbl">{{ t('photosSettingsSegFree') }}</span>
        <span class="val">{{ fmtGB(freeGB) }} GB</span>
      </div>
    </div>

    <div class="psc-divider"></div>

    <div class="psc-row">
      <div class="psc-row-text">
        <div class="psc-row-label">{{ t('photosSettingsRetentionLabel') }}</div>
        <div class="psc-row-desc">{{ t('photosSettingsRetentionDesc') }}</div>
      </div>
      <div class="psc-seg" data-test="retention-seg">
        <button
          v-for="d in RETENTION_OPTIONS" :key="d" type="button" class="seg-btn"
          :data-active="store.retentionDays === d" @click="selectRetention(d)"
        >{{ t('photosSettingsRetentionDay', { n: d }) }}</button>
      </div>
    </div>

    <div class="psc-row">
      <div class="psc-row-text">
        <div class="psc-row-label">{{ t('photosSettingsRescanLabel') }}</div>
        <div class="psc-row-desc">{{ t('photosSettingsRescanDesc') }}</div>
      </div>
      <button type="button" class="psc-btn" data-test="rescan-now" :disabled="scanBusy" @click="rescanNow">
        <span v-if="scanBusy" class="psc-spinner"></span>
        {{ scanBusy ? t('photosSettingsRescanning') : t('photosSettingsRescanNow') }}
      </button>
    </div>

    <div class="psc-row">
      <div class="psc-row-text">
        <div class="psc-row-label">{{ t('photosSettingsScanIntervalLabel') }}</div>
        <div class="psc-row-desc">{{ t('photosSettingsScanIntervalDesc') }}</div>
      </div>
      <div class="psc-seg" data-test="scan-seg">
        <button
          v-for="opt in scanIntervalOptions" :key="opt.min" type="button" class="seg-btn"
          :data-active="store.scanIntervalMinutes === opt.min" @click="selectScanInterval(opt.min)"
        >{{ opt.label }}</button>
      </div>
    </div>

    <div class="psc-row">
      <div class="psc-row-text">
        <div class="psc-row-label">{{ t('photosSettingsCacheLabel') }}</div>
        <div class="psc-row-desc">{{ t('photosSettingsCacheDesc') }}</div>
      </div>
      <button type="button" class="psc-btn" data-test="clear-cache" :disabled="busy || !prunableBytes" @click="clearCache">
        <svg v-if="!busy && !cleared" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
        <span v-if="busy" class="psc-spinner"></span>
        <svg v-if="cleared" class="psc-check" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
        {{ busy ? t('photosSettingsClearing') : cleared ? t('photosSettingsCleared') : `${t('photosSettingsClearCache')} (${fmtBytes(prunableBytes)})` }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.psc-card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-sm);
  box-shadow: var(--card-shadow);
  padding: 20px 22px;
  display: flex;
  flex-direction: column;
}

.psc-head { display: flex; align-items: flex-start; gap: 12px; }

.psc-icon {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-soft);
  color: var(--accent);
}

.psc-title { margin: 0; font-size: 15px; font-weight: 600; color: var(--fg); }
.psc-sub { font-size: 12px; color: var(--fg-muted); margin-top: 2px; }
.psc-spacer { flex: 1; }

.psc-headline { text-align: right; }
.psc-headline .big { font-size: 20px; font-weight: 600; color: var(--fg); font-family: var(--num-font); }
.psc-headline .big span { font-size: 12px; font-weight: 400; color: var(--fg-muted); margin-left: 4px; }
.psc-headline .sub { font-size: 12px; color: var(--fg-muted); margin-top: 2px; }

.psc-bar {
  display: flex;
  height: 8px;
  border-radius: 999px;
  overflow: hidden;
  background: var(--divider);
  margin-top: 14px;
}
.psc-bar-seg { height: 100%; }
.psc-bar-free { height: 100%; background: var(--divider); }

.psc-legend { display: flex; flex-wrap: wrap; gap: 8px 16px; margin-top: 10px; }
.psc-legend-row { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--fg-muted); }
.dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.psc-dot-free { background: var(--divider); border: 1px solid var(--card-border); }
.val { color: var(--fg); font-weight: 500; }

.psc-divider { height: 1px; background: var(--divider); margin: 16px 0; }

.psc-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 10px 0; }
.psc-row-label { font-size: 13px; font-weight: 500; color: var(--fg); }
.psc-row-desc { font-size: 12px; color: var(--fg-muted); margin-top: 2px; max-width: 360px; }

.psc-seg {
  display: inline-flex;
  background: var(--chip-bg);
  border: 1px solid var(--card-border);
  border-radius: 999px;
  padding: 2px;
  gap: 2px;
  flex-shrink: 0;
}

.seg-btn {
  border: none;
  background: transparent;
  color: var(--fg-muted);
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 999px;
  cursor: pointer;
}
.seg-btn:hover { background: var(--chip-bg-hi); }
.seg-btn[data-active="true"] { background: var(--accent); color: var(--on-accent); }
/* 本区已栽四次的坑:基类 `.seg-btn:hover`(优先级 2:一个类 + 一个伪类)与变体
   `.seg-btn[data-active="true"]`(优先级 2:一个类 + 一个属性选择器)相等——同优先级下
   源码顺序在.seg-btn:hover之后声明的[data-active]规则平时能压住,但鼠标一进按钮触发
   `.seg-btn:hover`,若没有专门的 [data-active]:hover 规则,两条同优先级规则的胜负会变得
   脆弱(依赖书写顺序而非语义)。变体必须自带 :hover 规则,用第三个选择器把优先级明确
   抬高到 3,不依赖 tie-break。 */
.seg-btn[data-active="true"]:hover { background: var(--accent); color: var(--on-accent); }

.psc-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--card-border);
  background: var(--chip-bg);
  color: var(--fg);
  font-size: 12px;
  padding: 7px 12px;
  border-radius: 999px;
  cursor: pointer;
  flex-shrink: 0;
}
.psc-btn:hover:not(:disabled) { background: var(--chip-bg-hi); }
.psc-btn:disabled { opacity: 0.5; cursor: default; }
.psc-btn svg { flex-shrink: 0; }
.psc-check { color: var(--success); }

.psc-spinner {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--chip-border);
  border-top-color: var(--accent);
  animation: psc-spin 0.8s linear infinite;
}
@keyframes psc-spin { to { transform: rotate(360deg); } }
</style>
