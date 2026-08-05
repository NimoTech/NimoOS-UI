<script setup lang="ts">
// Task 13 (SP7-P5 人物): PersonRelationsTab.vue —— 人物详情页「关系」tab
// (关系图区 + 共现列表 + Nimo's read 洞察卡)。逐段照 Vue2 NimoOS-UI
// src/views/Photos/PhotosPersonDetail.vue:187-227(整个 v-if="tab==='graph'" 块)、
// :530-536(sortedRelations/relMax)、:571-585(nimoRead 拼句)移植;样式段照
// photos-people.scss:502-568(关系图区+共现列表)与 :647-682(洞察卡)。
//
// 段落标题(协调者裁定,同 T12):Vue2 的两处 .detail-section-title(:189-192
// 关系图、:202 共同出现)都在 v-if="tab==='graph'" 块内,是这个 tab 自己的一
// 部分,不是容器负责的东西——容器(T14)只切 tab。
//
// 补齐 affordance(brief 明确要求,非 Vue2 行为):PersonRelGraph 的
// open-person(点卫星节点跳转)在这里原样透传给父级;Vue2 关系图节点本不可点,
// 这条补齐已在 PersonRelGraph.vue 顶部登记。
//
// nimoRead 拼句的纯函数部分已挪到 peopleView.ts 的 nimoReadParts(T13 新增,
// 见该文件注释),这里只做 t(key, params) 解析 + 空格拼接(照 :584
// `parts.join(' ')`),以及 v-html 的安全加固(见下方 escapeHtml 注释)。
//
// v-html 安全性(brief 给的两个选项之间的取舍,已在报告里详细说明):brief 建议
// 「低成本的话改用 <i18n-t> 具名插槽把 <b> 做成 slot」。这里改用另一条更低成本、
// 同样能关闭风险的路径——在拼句前对每个插值参数(人名/地名,均来自后端/用户输入)
// 做 HTML 转义,再 v-html 拼好的字符串。转义后字符串里唯一残留的 "<b>"/"</b>"
// 只可能来自我们自己写的翻译模板,不可能来自数据,XSS 风险已闭合,且不依赖
// vue-i18n 富插值 slot 的动态插槽名机制(那条路径对 5 个不同 key、不同参数集
// 要各自处理 bold/非 bold 参数分流,复杂度明显更高)。Vue2 对同样的参数是
// 完全不转义的裸插值(:576 `$t('...<b>{other}</b>.', {..., other: top.name})`),
// 所以这里已经比 Vue2 更安全,不是"同等风险搬过来"。
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import PersonRelGraph from './PersonRelGraph.vue'
import PersonAvatar from './PersonAvatar.vue'
import nimoLogoUrl from '../assets/nimo-logo.png'
import { nimoReadParts, type Person, type PlaceGroup } from '../util/peopleView'
import type { PersonRelation } from '../composables/usePersonDetail'

const props = defineProps<{
  relations: PersonRelation[]
  person: Person | null
  places: PlaceGroup[]
}>()

const emit = defineEmits<{ (e: 'open-person', id: string | number): void }>()

const { t } = useI18n()

// Vue2 :530-532 sortedRelations —— 按 count 降序,不改变 props.relations 本身
// (nimoReadParts 需要读原始顺序的 relations[0],见下方 nimoReadHtml)。
const sortedRelations = computed(() => [...props.relations].sort((a, b) => b.count - a.count))

// Vue2 :533-536 relMax。评审登记的一处正确性修正(非照抄 bug,按项目"移植纪律"
// 约定改正确逻辑并注释登记):Vue2 在 relations 非空但全部 count===0 时会算出
// Math.max(...[0,0])===0,导致条形宽度 `0/0*100%` = NaN%(浏览器会忽略这个非法
// 内联样式值,视觉上退化成"没有宽度设置"而不是崩溃,但仍是坏值)。这里在
// Math.max 调用里也补上 ,1 兜底,与 PersonRelGraph 的 maxCount 用同一招——
// 对真实数据(count 从不为 0,否则这条关系压根不会被收进 relations)没有任何
// 行为差异,只堵住这一个理论上的除零缺口。
const relMax = computed(() =>
  props.relations.length ? Math.max(...props.relations.map((r) => r.count), 1) : 1,
)

// escapeHtml 见脚本头部的 v-html 安全性说明。只转义 HTML 特殊字符,不做多余
// 的规则化 —— 转义后的文本原样交给 vue-i18n 的 t() 做插值。
function escapeHtml(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Vue2 :571-585 nimoRead。person 为 null 时 Vue2 也是直接返回空串
// (:572 `if (!this.person) return ''`)。
const nimoReadHtml = computed(() => {
  if (!props.person) return ''
  // 用户验收新增:未命名人物现在能进详情页,而洞察卡的句子模板全部带 {name} 槶位,裸
  // person.name 会渲染成「 的照片还不够多…」这种前置空格残句(Vue2 同病,但它进不来所以
  // 不可达)。兜底口径与同期的 PersonPlacesTab.vue:51 完全一致 —— 都用 photosPersonThisPerson。
  const name = props.person.name.trim() || t('photosPersonThisPerson')
  const parts = nimoReadParts(name, props.relations, props.places)
  return parts
    .map((part) => {
      const escaped: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(part.params)) escaped[k] = escapeHtml(v)
      return t(part.key, escaped)
    })
    .join(' ')
})
</script>

<template>
  <div class="rel-section">
    <div>
      <div class="detail-section-title">
        {{ t('photosPersonGraphTitle') }}
        <span class="sub">{{ t('photosPersonGraphSub') }}</span>
      </div>
      <div class="rel-graph-wrap">
        <div class="legend">
          <span><span class="l" /> {{ t('photosPersonGraphLegendFrequent') }}</span>
          <span><span class="l thin" /> {{ t('photosPersonGraphLegendOccasional') }}</span>
        </div>
        <PersonRelGraph
          :relations="relations" :person="person"
          @open-person="emit('open-person', $event)"
        />
      </div>
    </div>
    <div>
      <div class="detail-section-title">{{ t('photosPersonCoappearTitle') }}</div>
      <div class="rel-list">
        <div
          v-for="r in sortedRelations" :key="r.personId" class="rel-row"
          @click="emit('open-person', r.personId)"
        >
          <PersonAvatar :person-id="r.personId" :name="r.name" :ver="r.coverFaceId" :size="36" />
          <div class="body">
            <div class="nm">{{ r.name }}</div>
            <div class="ct">{{ t('photosPersonPhotosTogether', { n: r.count }) }}</div>
          </div>
          <div class="bar"><div :style="{ width: (r.count / relMax * 100) + '%' }" /></div>
        </div>
      </div>

      <div class="rel-insight-card" style="margin-top: 18px">
        <div class="hd"><span class="orb" :style="{ backgroundImage: `url(${nimoLogoUrl})` }" /> {{ t('photosPersonNimoRead') }}</div>
        <!-- eslint-disable-next-line vue/no-v-html -- 插值参数已在 nimoReadHtml 里逐个转义,残留的 <b> 只可能来自翻译模板本身,见脚本区注释 -->
        <p class="insight-text" data-test="insight-text" v-html="nimoReadHtml" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 关系图区(照 photos-people.scss:502-535)。 */
.rel-section {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 24px;
  align-items: start;
}
/* Vue2 用 --font-display/--font-sans 两个字体 token 区分标题/副标题字重来源;
   New-UI 只有一个统一的 --font token(已在 theme.css 核实),两处都用它,同
   PersonPlacesTab.vue 的 .detail-section-title/.sub 既有先例(T12,同款
   flex+baseline+gap 结构,同款 --fg/--fg-muted 配色)——两个 tab 各自渲染自己
   的段落标题(协调者裁定),CSS 规则因此各写一份,不是漏共享。 */
.detail-section-title {
  font-family: var(--font);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.01em;
  margin: 0 0 14px;
  display: flex;
  align-items: baseline;
  gap: 10px;
  color: var(--fg);
}
.detail-section-title .sub {
  font-family: var(--font);
  font-size: 12px;
  font-weight: 400;
  color: var(--fg-muted);
  letter-spacing: 0;
}
/* Vue2 这张卡用 --surface-1(背景)/--line(边框)/--r-lg(圆角)三个 token,
   本仓均不存在(已 grep 确认两套主题块都没有)——分别代以 --card(同 T12
   .map-card 先例)/--card-border/--radius-sm。 */
.rel-graph-wrap {
  background: var(--card);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-sm);
  padding: 16px;
  position: relative;
  min-height: 420px;
  overflow: hidden;
}
/* Vue2 图例文字用 --text-3,本仓不存在,代以语义对应的 --fg-muted。 */
.rel-graph-wrap .legend {
  position: absolute;
  top: 14px;
  left: 16px;
  font-size: 11px;
  color: var(--fg-muted);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.rel-graph-wrap .legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.rel-graph-wrap .legend .l {
  width: 18px;
  height: 2px;
  background: var(--accent);
  opacity: 0.8;
}
.rel-graph-wrap .legend .l.thin {
  opacity: 0.4;
}

/* 共现列表(照 photos-people.scss:537-568)。 */
.rel-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.rel-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
}
/* Vue2 用 --surface-2,本仓不存在,代以 --hover(同 PersonHero.vue
   .hero-menu-item:hover 先例:透明背景上的行级 hover 淡叠层)。 */
.rel-row:hover {
  background: var(--hover);
}
.rel-row .body {
  flex: 1;
  min-width: 0;
}
.rel-row .nm {
  font-size: 13px;
  font-weight: 500;
  color: var(--fg);
}
.rel-row .ct {
  font-size: 11.5px;
  color: var(--fg-muted);
}
.rel-row .bar {
  width: 60px;
  height: 4px;
  border-radius: 99px;
  /* Vue2 这条轨道背景用的是 --ink 这个 token 混 6% 透明度,而 --ink 在本仓
     不存在(已 grep 确认两套主题块均无该 token)——改用同语义的中性淡叠层
     token --divider 代替(两套主题皆有定义)。 */
  background: var(--divider);
  overflow: hidden;
  flex: none;
}
.rel-row .bar > div {
  height: 100%;
  /* Vue2 用 var(--accent-hi) —— 本仓不存在该 token,用 --accent-text 代替
     (两套主题皆有定义,语义同为"强调色的高亮/文本变体")。 */
  background: linear-gradient(90deg, var(--accent), var(--accent-text));
}

/* Nimo's read 洞察卡(照 photos-people.scss:647-673;不含 :674-682 的
   "深挖"按钮样式 —— 该按钮本任务不渲染,归 SP8)。 */
.rel-insight-card {
  /* Vue2 这张卡的底色是硬编码的固定紫色透明度渐变(色值 110,91,255)—— 那正是
     Vue2 旧主题的强调色字面量,不是皮肤无关的数据可视化色。改用 color-mix
     基于当前主题的 --accent 派生,跟随主题切换,而不是钉死一个紫色(两套
     主题的 accent 并不相同)。 */
  background: linear-gradient(
    160deg,
    color-mix(in srgb, var(--accent) 10%, transparent),
    color-mix(in srgb, var(--accent) 3%, transparent)
  );
  border: 1px solid color-mix(in srgb, var(--accent) 22%, transparent);
  border-radius: var(--radius-sm);
  padding: 16px;
}
.rel-insight-card .hd {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--accent-text);
  font-weight: 600;
  margin-bottom: 10px;
}
.rel-insight-card .hd .orb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background-size: cover;
  background-repeat: no-repeat;
  background-position: center;
}
.rel-insight-card p {
  font-size: 12.5px;
  color: var(--fg-muted);
  line-height: 1.55;
  margin: 0;
}
</style>
