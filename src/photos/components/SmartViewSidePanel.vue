<script setup lang="ts">
// SP7-P7a-T8: SmartViewSidePanel.vue —— 智能视图详情页右栏三段(阈值 / 设置 / 统计),
// 挂载于 PhotosSmartViewDetail.vue 的 data-test="sv-side-mount"(T6 留的空挂载点)。
// 逐段照 Vue2 NimoOS-UI src/views/Photos/PhotosSmartViewDetail.vue:152-209(模板)、
// :288-291 + :345-371(阈值 debounce / paused 派生 / syncingSv)、:325-333(threshHelp /
// dist / distMax)、:424 + :444(formatMB / distStyle)移植;样式
// photos-smartview.scss:528-658(:543-563 的滑块本身已由 T5 抽到 PhotosThreshSlider.vue,
// 这里不重复)。
//
// ── 与 Vue2 的架构性简化(brief 明确要求,登记;fix round 2 改正:此前这段与 40 行后
//    新增的 `dragging` 门控自相矛盾,已按 fix-2-findings 的要求就地纠正,不是重写为
//    另一套说法)──────────────────────────────────────────────────────────────────
// Vue2 用「本地 thresh/paused/includeVideos + syncingSv 标志 + 三个 watcher」压制
// "prop 变化 → 复制进本地 state → 本地 watcher 又发一次 PATCH" 的自反馈死循环
// (:288-291、:345-371)。New-UI 只在用户交互(@input/@click)时才 emit('patch', …),
// prop 回流从不 emit,天然没有这条自反馈死循环 —— **不需要的是 Vue2 那个 `syncingSv`
// 标志**,New-UI 没有对应物。
// 但这不等于"prop 回流不需要任何门控":一次 PATCH 往返之间,只要用户还有尚未提交成功
// 的本地编辑,prop 带回来的旧值就不能覆盖显示,否则会出现 fix round 1 · I1 实测复现的
// 真 bug ——"拖到 92 → 响应落地把显示扳回 92 的路上,恰好把用户已经拖到的 60 冲掉"。
// **需要的是下面的 `dragging` 门控**,解决的是另一件事:别在用户手指还按着(或还有一轮
// 防抖/busy 重试没发出去)的时候,把显示抽回服务端旧值。两个开关比阈值更简单:纯派生
// (`computed(() => !sv.live)` / `sv.includeVideos` 本身)+ 点击直接 emit,连本地 draft
// 都不需要——开关是离散值,没有"用户手指还按着"这个中间态,不像阈值那样需要防抖节流
// 也不需要 `dragging` 门控。
//
// ── busy 守卫(net-new,T7 SmartViewConditionEditor.vue 同一约束的延伸,登记)───────
// Vue2 完全没有防止"PATCH 还没回来又点一次"的概念。宿主会传入 store.patchBusy,这里在
// busy 期间短路开关点击与阈值防抖到期后的最终 emit,避免并发 PATCH 竞态——按钮本身也用
// data-busy 露出视觉态,不是静默吞掉点击。
//
// ── token 映射(沿用 SmartViewCreateDialog.vue:436-438 已立的规范表,同一批 Vue2 源
//    文件、同一套映射,不再各写一份)──────────────────────────────────────────────
// --surface-1→--popup-bg / --surface-2→--chip-bg / --surface-3→--chip-bg-hi;
// --line→--card-border;--text-1→--fg / --text-2→--fg-muted / --text-3→--fg-faint /
// --text-4→--fg-subtle;--accent-hi(文字/图标色)→--accent-text。
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import PhotosThreshSlider from './PhotosThreshSlider.vue'
import { formatMB } from '../util/formatBytes'
import { relTime } from '../util/relTime'
import type { SmartView } from '../stores/smartViews'

const props = withDefaults(defineProps<{ sv: SmartView; busy?: boolean }>(), { busy: false })
const emit = defineEmits<{ patch: [patch: { threshold?: number; live?: boolean; includeVideos?: boolean }] }>()

const { t, locale } = useI18n()

// ── 1. 阈值段(结构规格 A-1)──────────────────────────────────────────────────
const thresh = ref(props.sv.threshold)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

// fix round 1 · I1(Important,评审实测复现):`dragging` 门控管的是「别把拇指从用户
// 手指底下抽走」——与"不需要 syncingSv"是两件不同的事,不能混为一谈。syncingSv 防的是
// New-UI 已经结构性不存在的自反馈死循环(New-UI 只在用户交互时才 emit,prop 回流从不
// emit,天然没有自反馈);但 prop 回流本身还是会发生——一次 PATCH 往返之间,只要用户
// 还有未提交的本地编辑(`dragging` 为真),prop 带回来的旧值就绝不能覆盖显示,否则就是
// 评审复现的"拖到 92 → 响应落地把显示扳回 92 的路上,恰好把用户已经拖到的 60 冲掉"。
// `dragging` 的语义是"是否存在尚未成功 emit 出去的本地编辑"——不是"手指是否按在滑块
// 上":从 onThreshInput 到 submitThreshold 真正把 emit 发出去之前的整个窗口(含 busy
// 重试期间)都算 dragging=true,这样即使响应先于本轮防抖到期落地,显示也不会被抢先冲掉。
const dragging = ref(false)

// prop 回流:dragging 时门控(删码验证②的主体:去掉这个门控或整条 watch,"prop 回流不
// 触发提交"与"跨 PATCH 往返不冲掉本地编辑"这两条用例都会红)。
watch(() => props.sv.threshold, (v) => {
  if (!dragging.value) thresh.value = v
})

// fix round 1 · I2(Important,评审实测复现):`submitThreshold` 用**闭包捕获的 `v`**
// 而不是读取当时的 `thresh.value` 活值——即使 `dragging` 门控本身有任何疏漏,真正发给
// 后端的值也始终是用户那一次交互实际拖到的数字,双重保险。busy 时**重新 arm 定时器**
// 而不是静默 return——阈值有本地 draft,吞掉一次 emit 就是"界面 92% / 后端 72%"永久
// 失同步(与两个开关不同:开关纯派生,吞掉点击后 UI 仍与 store 一致,不需要重试)。
function submitThreshold(v: number): void {
  if (props.busy) {
    // 已知边界(fix round 2 登记,控制器裁定可接受、不需要限流):这个重试没有退避
    // 也没有次数上限——如果 `patchBusy` 真的长期卡 true,会以固定 300ms 节奏永久重试
    // 下去。不是紧循环、不会冻死浏览器(每次都要等一整个 setTimeout),但确实没有上限。
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => submitThreshold(v), 300)
    return
  }
  dragging.value = false
  emit('patch', { threshold: v })
}

function onThreshInput(v: number): void {
  thresh.value = v
  dragging.value = true
  if (debounceTimer) clearTimeout(debounceTimer)
  // 照搬 Vue2 :359-366 的 300ms 节奏(删码验证①的主体:去掉这个 setTimeout 包装,
  // "连拖 5 次只 1 个 emit"这条用例就会红)。
  debounceTimer = setTimeout(() => submitThreshold(v), 300)
}
onBeforeUnmount(() => { if (debounceTimer) clearTimeout(debounceTimer) })

const newCount = computed(() => props.sv.addedThisWeek || 0)
// 照搬 Vue2 :326。
const threshN = computed(() => Math.round((newCount.value * (100 - thresh.value) / 22) * 1.4))
// 照搬 Vue2 :328-329(删码验证⑦的主体:去掉这两个 if,85/70 边界用例会红)。
const threshTail = computed(() => {
  if (thresh.value > 85) return t('photosSvMayMissBorderlineMatches')
  if (thresh.value < 70) return t('photosSvMayIncludeFalsePositives')
  return ''
})

// ── 2. 设置段(结构规格 A-2)──────────────────────────────────────────────────
// paused 与两个开关都是纯派生 + 直接 emit,没有本地 state(brief 控制器补充 2)。
const paused = computed(() => !props.sv.live)
function toggleLive(): void {
  if (props.busy) return
  // paused===true ⇔ 当前 !live,切换即取反 = paused 本身(同 PhotosSmartViewDetail.vue
  // 的 togglePaused 既有写法)。
  emit('patch', { live: paused.value })
}
function toggleIncludeVideos(): void {
  if (props.busy) return
  emit('patch', { includeVideos: !props.sv.includeVideos })
}

// ── 3. 统计段(结构规格 A-3)──────────────────────────────────────────────────
const median = computed(() => props.sv.median || 0)
const storageText = computed(() => formatMB(props.sv.storageBytes))
// 自己调 relTime,不吃宿主传入的 lastUpdated 字符串(brief:"两处都自己调 relTime,
// 避免多一个 prop")。声明的 Produces 契约里没有 now prop——这个 computed 本身就不是
// "跟着时钟走的响应式时钟",跟 Vue2 的同名 computed 一样只是"渲染那一刻算一次"。
const lastUpdated = computed(() => (props.sv.evaluatedAt ? relTime(props.sv.evaluatedAt, Date.now(), t, locale.value) : '—'))

// distribution 归一:T2 的 store 已经做过一次严格 length===10 校验,这里是双保险,照搬
// Vue2 :316 的判据保留、不收紧(brief 明示"照搬保留")——组件层不该假设传入的一定是
// 经过 store 归一的数据。
const dist = computed(() => (props.sv.distribution && props.sv.distribution.length ? props.sv.distribution : new Array(10).fill(0)))
const distMax = computed(() => Math.max(1, ...dist.value))
function distStyle(d: number, i: number): { height: string; opacity: number } {
  // 照搬 Vue2 :444。opacity 是布局量不是颜色,保留内联计算。
  return { height: `${(d / distMax.value) * 100}%`, opacity: 0.4 + i * 0.06 }
}
</script>

<template>
  <div class="sv-side-section">
    <h3>{{ t('photosSvQualityThreshold') }}</h3>
    <div class="sv-thresh-row">
      <span>{{ t('photosSvAutoAddWhenScore') }}</span>
      <b data-test="sv-thresh-value">{{ thresh }}%</b>
    </div>
    <PhotosThreshSlider :value="thresh" @input="onThreshInput" />
    <!-- 零 v-html(structural spec A-1):threshHelp 走 <i18n-t> 具名插槽,<b> 只包 {n},
         {pct} 走普通插槽(不加粗),尾巴两句是独立句子拼在插槽外(brief 明示不进插槽)。 -->
    <div class="sv-thresh-help" data-test="sv-thresh-help">
      <i18n-t keypath="photosSvThreshHelp" tag="span" scope="global">
        <template #pct>{{ thresh }}</template>
        <template #n><b>{{ threshN }}</b></template>
      </i18n-t>{{ threshTail ? ' ' + threshTail : '' }}
    </div>
  </div>

  <div class="sv-side-section">
    <h3>{{ t('photosSvSettingsSection') }}</h3>
    <div class="sv-toggle-row">
      <div class="label">
        {{ t('photosSvAutoAddMatches') }}
        <div class="desc">{{ paused ? t('photosSvPausedUploadsNotAdded') : t('photosSvRunEveryUpload') }}</div>
      </div>
      <div
        class="sv-switch" role="switch" tabindex="0" data-test="sv-switch-live"
        :aria-checked="!paused" :aria-label="t('photosSvAutoAddMatches')" :data-on="!paused" :data-busy="busy"
        @click="toggleLive" @keydown.enter.prevent="toggleLive" @keydown.space.prevent="toggleLive"
      />
    </div>
    <div class="sv-toggle-row">
      <div class="label">
        {{ t('photosSvIncludeVideos') }}
        <div class="desc">{{ t('photosSvMatchAgainstVideoKeyframes') }}</div>
      </div>
      <div
        class="sv-switch" role="switch" tabindex="0" data-test="sv-switch-videos"
        :aria-checked="sv.includeVideos" :aria-label="t('photosSvIncludeVideos')" :data-on="sv.includeVideos" :data-busy="busy"
        @click="toggleIncludeVideos" @keydown.enter.prevent="toggleIncludeVideos" @keydown.space.prevent="toggleIncludeVideos"
      />
    </div>
  </div>

  <div class="sv-side-section">
    <h3>{{ t('photosSvStats') }}</h3>
    <div class="sv-stat-grid">
      <div class="sv-stat-cell">
        <div class="v" data-test="sv-stat-count">{{ sv.count.toLocaleString(locale.replace('_', '-')) }}</div>
        <div class="l">{{ t('photosSvTotal') }} <span class="delta">+{{ newCount }}</span></div>
      </div>
      <div class="sv-stat-cell">
        <div class="v" data-test="sv-stat-median">{{ median }}%</div>
        <div class="l">{{ t('photosSvMedianMatch') }}</div>
      </div>
      <div class="sv-stat-cell">
        <div class="v" data-test="sv-stat-storage">{{ storageText }}</div>
        <div class="l">{{ t('photosStorage') }}</div>
      </div>
      <div class="sv-stat-cell">
        <div class="v" data-test="sv-stat-lastupdate">{{ lastUpdated }}</div>
        <div class="l">{{ t('photosSvLastUpdate') }}</div>
      </div>
    </div>
    <div style="margin-top:16px">
      <div class="sv-dist-head">{{ t('photosSvMatchScoreDistribution') }}</div>
      <div class="sv-distribution">
        <div v-for="(d, i) in dist" :key="i" class="sv-dist-bar" data-test="sv-dist-bar" :style="distStyle(d, i)" />
      </div>
      <!-- 三个刻度是纯数字字面量,不进 i18n(照 P6b formatSpotCoords 方向字母的既有先例,
           登记)。 -->
      <div class="sv-dist-x"><span>50%</span><span>75%</span><span>100%</span></div>
    </div>
  </div>
</template>

<style scoped>
/* ── 段标题(scss:528-536)── */
.sv-side-section { margin-bottom: 24px; }
.sv-side-section h3 {
  font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--fg-faint); margin: 0 0 10px;
}

/* ── 阈值段(scss:537-542、565-573;滑块本体在 PhotosThreshSlider.vue)── */
.sv-thresh-row { margin-bottom: 8px; display: flex; justify-content: space-between; align-items: baseline; font-size: 13px; }
.sv-thresh-row b { color: var(--accent-text); font-variant-numeric: tabular-nums; font-size: 18px; font-weight: 600; }
.sv-thresh-help {
  font-size: 11.5px; color: var(--fg-faint); line-height: 1.5; margin-top: 10px;
  padding: 8px 10px; background: var(--chip-bg); border-radius: 8px;
}

/* ── 设置段(scss:574-605,同 SmartViewCreateDialog.vue 里同一份 Vue2 源规则的既有
     移植,逐值保持一致)── */
.sv-toggle-row {
  display: flex; align-items: center; gap: 10px; padding: 10px 0;
  border-bottom: 1px solid var(--card-border); font-size: 12.5px; color: var(--fg-muted);
}
.sv-toggle-row:last-child { border-bottom: 0; }
.sv-toggle-row .label { flex: 1; color: var(--fg); }
.sv-toggle-row .desc { font-size: 11px; color: var(--fg-faint); margin-top: 2px; }
/* fix round 1 · M1(brief 漏给 photos.scss 那半区间,与 T5 漏整套滑块样式同一失效模式):
   Vue2 的 `.sv-switch` 其实有两份规则叠级联——`photos-smartview.scss:584-600`(高优先级,
   赢了尺寸)之外还有 `photos.scss:2819-2820` 的低优先级裸 `.sv-switch`,声明了
   `transition: background 0.15s` 与 `::after` 的投影,两者未被高优先级规则覆盖,照样
   合并生效。补齐这两条,轨道变色才是渐变过渡、拇指才有投影(不是瞬变 + 平的)。 */
.sv-switch { position: relative; width: 32px; height: 18px; background: var(--chip-bg-hi); border-radius: 99px; cursor: pointer; flex-shrink: 0; transition: background 0.15s; }
.sv-switch::after {
  content: ''; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%;
  background: var(--fg); transition: all 0.2s;
  /* 投影是纯粗黑阴影(不是语义色),用 color-mix 复刻 Vue2 原值(纯黑、约 30% 不透明度的
     投影),不写字面颜色函数,同 PhotosSmartViewDetail.vue 里 `.tile.recent::after`
     已立的既有先例("black 关键字 + color-mix"表达半透明黑)。 */
  box-shadow: 0 1px 3px color-mix(in srgb, black 30%, transparent);
}
.sv-switch[data-on="true"] { background: var(--accent); }
/* --on-accent 合法用法:滑块叠在紧邻这条 [data-on="true"] 实底(var(--accent),非渐变/
   半透明)之上,合法性由这条背景声明自证(同 SmartViewCreateDialog.vue 已立的先例)。 */
.sv-switch[data-on="true"]::after { left: 16px; background: var(--on-accent); }
.sv-switch[data-busy="true"] { cursor: not-allowed; opacity: 0.6; }

/* ── 统计段(scss:626-658)── */
.sv-stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.sv-stat-cell { background: var(--chip-bg); padding: 10px 12px; border-radius: 8px; }
.sv-stat-cell .v { font-size: 18px; font-weight: 600; font-variant-numeric: tabular-nums; }
.sv-stat-cell .l { font-size: 11px; color: var(--fg-faint); margin-top: 2px; }
.sv-stat-cell .delta { font-size: 11px; color: var(--success); margin-left: 4px; font-weight: 500; }
.sv-dist-head { font-size: 11.5px; color: var(--fg-faint); margin-bottom: 4px; }
.sv-distribution { height: 56px; display: flex; align-items: flex-end; gap: 2px; margin-top: 8px; }
.sv-dist-bar {
  flex: 1; min-width: 4px; border-radius: 2px 2px 0 0;
  /* Vue2 scss:648 写死渐变(accent → 字面浅紫)⇒ 改 accent 家族两档(同
     PersonRelationsTab.vue:251 的既有先例),不写字面颜色。 */
  background: linear-gradient(to top, var(--accent), var(--accent-text));
}
.sv-dist-x { display: flex; justify-content: space-between; font-size: 10px; color: var(--fg-subtle); margin-top: 4px; }
</style>
