<script setup lang="ts">
// SP7-P7a-T3: SmartViewCard.vue —— 智能视图列表页的拼贴卡片(Task 4 的列表页 v-for
// 出它)。逐段照 Vue2 NimoOS-UI src/views/Photos/PhotosSmartViewsView.vue:244-285
// 内联组件 `SmartViewCard` 移植;样式照 photos-smartview.scss:26-117。
//
// D15 占位态(net-new,唯一的偏离登记):Vue2 在 sv.seeds 不足 3 条时,`photoUrl(seed)`
// (PhotosSmartViewsView.vue:350-358)对非字符串 seed 会去时间线 `allPhotos` 按数字下标
// 取模拿一张**与该智能视图毫无关系**的库内照片顶替空位。这具有真实误导性——用户看到一张
// 照片出现在"智能视图"的拼贴里,会理解成"这张照片已经匹配进了这个智能视图",而实际上
// 它只是时间线里随便一张照片。New-UI 不照抄这个行为:三个拼贴格子各自独立判断
// `seeds[0]`/`seeds[1]`/`seeds[2]` 是否存在,缺的格子渲染中性占位块(sparkles 图标 +
// `--chip-bg` 底色),绝不渲染 `<img>`。`photoUrl` 的数字索引回落分支是死代码(后端
// `Seeds` 是 `[]string`,永远不会是数字),不迁移。
//
// 偏离登记(其余,均已在 task-3-report.md 逐条登记):
//  - emit('open', id) 只传 id(字符串),不像 Vue2 那样传整个 sv 对象——详情页改为
//    byId(id) 现取(§7e-2,T2 store 的 byId 已就位),消灭引用陈旧的可能性。
//  - 千分位跟 locale:`sv.count.toLocaleString(locale)`,而不是 Vue2 的裸
//    `toLocaleString()`(依赖运行环境默认 locale,不确定)。
//  - `.sv-name` 补齐单行省略三件套(Vue2 没有,长名会撑破卡片)。
//  - 本周新增绿色:Vue2 是内联 `style="color:#34C759"`,这里改用 `--success` token
//    (grep theme.css 已确认存在两套主题取值的绿色 token,不新增)。
//  - `.sv-card:hover` 的 border-color 变化(Vue2 `scss:37` 用 `--line-strong`)在本仓没有
//    对应 token(grep 确认 theme.css 无此 token 也无等价物),故只保留 transform + 阴影
//    抬升,不引入未定义 token 或裸色字面量。
//
// SP15-P2b Task 3(登记新增):根节点原来没有 `data-test`——grep 确认过,组件里此前零个
// data-test 属性。PhotosAlbums.vue 的混排网格测试需要一个稳定选择器来数「这是几张智能
// 卡」,补 `data-test="sv-card"`,只加这一处,不动组件其余任何标记。
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import type { SmartView } from '../stores/smartViews'

const props = defineProps<{ sv: SmartView }>()
const emit = defineEmits<{ (e: 'open', id: string): void }>()

const { t, locale } = useI18n()
// BCP-47 转换(本仓既定写法,照 PlacesRail.vue:84 / PersonHero.vue:113 / relTime.ts:21
// 等既有先例):本仓 locale 标识是 'zh_cn'/'en_us'(下划线),不是合法的 BCP-47 标签,
// 裸传给 toLocaleString 会抛 `RangeError: Incorrect locale information provided`。
const localeTag = computed(() => locale.value.replace('_', '-'))

interface CollageSlot { seed: string | undefined, main: boolean }

// 三个拼贴格子各自独立的数据源(D15 核心):main = seeds[0](大图,占左侧,grid-row
// 跨两行),两个小图 = seeds[1] / seeds[2](Vue2 `rest = sv.seeds.slice(1)` 之后取
// rest[0]/rest[1],等价于 seeds[1]/seeds[2])。
const collageSlots = computed<CollageSlot[]>(() => [
  { seed: props.sv.seeds[0], main: true },
  { seed: props.sv.seeds[1], main: false },
  { seed: props.sv.seeds[2], main: false },
])

// 缩略图一律走共享包生成器(自动带 token),不手拼 `/v1/photos/...`(Vue2 四处手拼且不
// 带 token 之一;智能视图卡片尺寸口径固定 'large',照 Vue2 `scss:size=large` 查询参数)。
function thumbUrl(seedId: string): string {
  return service.photos.thumbnailUrl(seedId, 'large')
}

const condsShown = computed(() => props.sv.conds.slice(0, 3))
const extraConds = computed(() => props.sv.conds.length - 3)

function onClick(): void {
  emit('open', String(props.sv.id))
}
</script>

<template>
  <div class="sv-card" data-test="sv-card" @click="onClick">
    <div class="sv-collage">
      <template v-for="(slot, i) in collageSlots" :key="i">
        <img
          v-if="slot.seed"
          :class="{ 'sv-collage-main': slot.main }"
          :src="thumbUrl(slot.seed)"
          alt=""
        >
        <div v-else class="sv-collage-ph" :class="{ 'sv-collage-main': slot.main }">
          <svg
            class="sv-collage-ph-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
          ><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /><circle cx="12" cy="12" r="3" /></svg>
        </div>
      </template>
      <div class="sv-collage-overlay" />
      <div class="sv-collage-badge">
        <svg
          width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
        ><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /><circle cx="12" cy="12" r="3" /></svg>
        {{ t('photosSvBadgeSmartView') }}
      </div>
      <div class="sv-collage-status" :data-paused="!props.sv.live">
        <span class="live-dot" />
        {{ props.sv.live ? t('photosSvLive') : t('photosSvPaused') }}
      </div>
    </div>
    <div class="sv-meta">
      <h3 class="sv-name">
        {{ props.sv.name }}
      </h3>
      <div class="sv-conds">
        <span v-for="(c, i) in condsShown" :key="i" class="sv-cond">{{ c }}</span>
        <span v-if="props.sv.conds.length > 3" class="sv-cond">+{{ extraConds }}</span>
      </div>
      <div class="sv-stats">
        <b>{{ props.sv.count.toLocaleString(localeTag) }}</b> {{ t('photosSvPhotosCount') }}
        <span v-if="props.sv.addedThisWeek > 0" class="sv-added">{{ t('photosSvAddedThisWeek', { n: props.sv.addedThisWeek }) }}</span>
        <span style="flex:1" />
        <span class="sv-thresh-mini">≥ {{ props.sv.threshold }}%</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sv-card {
  display: flex;
  flex-direction: column;
  /* Vue2 字面 14px,本仓无逐值对应 token——按 T3 brief 的 token 映射表就近取
     --radius-sm(卡片类小圆角语义),不留裸字面量(见文件头部偏离登记)。 */
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid var(--card-border);
  background: var(--card-bg);
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}
.sv-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--card-shadow-hi);
}

.sv-collage {
  position: relative;
  aspect-ratio: 16 / 9;
  display: grid;
  grid-template-columns: 2fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 2px;
  background: var(--bg);
}
.sv-collage img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.sv-collage-main {
  grid-row: 1 / span 2;
}
/* D15 占位块:中性底 + 居中图标,不使用任何字面色(见文件头部偏离登记)。 */
.sv-collage-ph {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--chip-bg);
}
.sv-collage-ph-icon {
  width: 22px;
  height: 22px;
  color: var(--fg-subtle);
}

.sv-collage-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 70%;
  pointer-events: none;
  /* theme-exception: 拼贴底部渐变遮罩,为下方钉死浅色的徽标/状态文字提供跨主题恒定的
     可读对比度(同 PersonHero.vue .hero-scrim 的先例,理由见 PersonHero.vue 文件头
     "配色红线"注释)。 */
  background: linear-gradient(to top, rgba(0, 0, 0, 0.85), transparent);
}

.sv-collage-badge {
  position: absolute;
  top: 10px;
  left: 10px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px 3px 6px;
  border-radius: var(--chip-radius, 999px);
  /* accent 家族的 color-mix 写法(本仓没有 --accent-rgb,见 plan Global Constraints §33),
     不是裸字面量,不需要 theme-exception。 */
  background: color-mix(in srgb, var(--accent) 85%, transparent);
  backdrop-filter: var(--blur);
  font-size: 10.5px;
  font-weight: 600;
  /* theme-exception: 徽标文字/图标压在照片拼贴之上,需要跨主题恒定浅色前景,禁用
     --on-accent(它默认深色主题下是深藏青,叠在照片上会深底深字,同 PhotosGrid.vue
     .tile-vid 视频徽标的先例)。 */
  color: #fff;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.sv-collage-status {
  position: absolute;
  top: 10px;
  right: 10px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: var(--chip-radius, 999px);
  /* theme-exception: 右上状态徽标,恒叠在照片拼贴之上,需要跨主题恒定的暗底(同
     PhotosGrid.vue .tile-vid 视频徽标的先例)。 */
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: var(--blur);
  font-size: 10.5px;
  font-weight: 500;
  /* theme-exception: 状态文字压在上面这条固定暗底之上,需要跨主题恒定浅色前景,禁用
     --on-accent(理由同 .sv-collage-badge)。 */
  color: #fff;
}
.live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  /* theme-exception: 状态点固定叠在 .sv-collage-status 的暗底上,恒定不随主题(Vue2
     scss:84-86 的 live 态原值,理由同上方徽标注释)。 */
  background: #34C759; box-shadow: 0 0 6px #34C759;
  animation: pulse 1.6s infinite;
}
.sv-collage-status[data-paused="true"] .live-dot {
  /* theme-exception: 暂停态点色,恒定不随主题(Vue2 scss:88 的 data-paused 变体原值)。 */
  background: #FF9F0A; box-shadow: 0 0 6px #FF9F0A;
  animation: none;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.sv-meta {
  padding: 14px 16px 16px;
  /* flex 子项省略的必要条件(P6b-T4 教训):.sv-card 是 flex-direction:column,.sv-meta
     作为直接子项默认 min-width:auto,内容宽度会撑破容器,子级的 text-overflow 不生效。 */
  min-width: 0;
}
.sv-name {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 4px;
  letter-spacing: -0.01em;
  /* Vue2 scss:94 没有截断,长名会撑破卡片——New-UI 补齐单行省略三件套(偏离登记)。 */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sv-conds {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 12px;
}
.sv-cond {
  padding: 2px 8px;
  border-radius: var(--chip-radius, 999px);
  background: var(--chip-bg);
  color: var(--fg-muted);
  font-size: 11px;
}
.sv-stats {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11.5px;
  color: var(--fg-subtle);
  font-variant-numeric: tabular-nums;
}
.sv-stats b {
  color: var(--fg);
  font-weight: 600;
}
/* Vue2 内联 style 写死的本周新增绿(iOS 系统绿)→ 本仓 --success token(SearchDialog.vue
   .media-acc-num 的既有先例),两套主题都已有取值,不新增、不裸写字面量。 */
.sv-added {
  color: var(--success);
}
.sv-thresh-mini {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 7px;
  border-radius: var(--chip-radius, 999px);
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: var(--accent-text);
  font-weight: 600;
}
</style>
