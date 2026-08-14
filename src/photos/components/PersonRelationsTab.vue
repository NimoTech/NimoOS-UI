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
// Task 8 (Plan D): 洞察卡底部「深挖」按钮(Vue2 :228-230 `.nimo-btn`,$emit('ask-nimo', ...))
// 此前推迟到 SP8 未渲染,现按 Vue2 补上。点击是 no-op —— 接线(真正调用 Ask Nimo)归 Plan G。
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

// Task 8 (Plan D): Vue2 :228 emits 'ask-nimo' with a canned prompt string; this component's
// own ask-nimo wiring lands in Plan G (per this task's brief).
// wired in Plan G (Ask Nimo)
function onDigDeeper(): void {}
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
            <!-- Task 6 (Plan D, PR 137 gap-close): Vue2 PR 137 patch (PhotosPersonDetail.vue,
                 graph-tab rel-row) added `r.name || $t('Unnamed person')` here — this list row
                 was missing that fallback. -->
            <div class="nm">{{ r.name || t('photosPersonUnnamedTitle') }}</div>
            <div class="ct">{{ t('photosPersonPhotosTogether', { n: r.count }) }}</div>
          </div>
          <div class="bar"><div :style="{ width: (r.count / relMax * 100) + '%' }" /></div>
        </div>
      </div>

      <div class="rel-insight-card" style="margin-top: 18px">
        <div class="hd"><span class="orb" :style="{ backgroundImage: `url(${nimoLogoUrl})` }" /> {{ t('photosPersonNimoRead') }}</div>
        <!-- eslint-disable-next-line vue/no-v-html -- 插值参数已在 nimoReadHtml 里逐个转义,残留的 <b> 只可能来自翻译模板本身,见脚本区注释 -->
        <p class="insight-text" data-test="insight-text" v-html="nimoReadHtml" />
        <!-- Task 8 (Plan D): 「深挖」按钮 —— Vue2 :228-230,点击是 no-op(onDigDeeper),
             接线归 Plan G。 -->
        <button type="button" class="nimo-btn" data-test="rel-insight-dig-deeper" @click="onDigDeeper">
          {{ t('photosPersonDigDeeper') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Task 5 (Plan D) shadowing cleanup: `.rel-section`, `.detail-section-title`(+`.sub`),
   `.rel-graph-wrap`(+`.legend` family), `.rel-list`/`.rel-row`(+`.body`/`.nm`/`.ct`/`.bar`/
   `.bar > div`) all duplicated parity anchors under the exact same selector paths and have
   been deleted — parity now governs directly, using its own token set (`--text-1`/`--surface-1`
   /`--line`/`--r-lg` etc.) rather than this app's theme.css tokens the comments here used to
   explain as substitutes. See task-5-report.md's deviations table for the resulting value
   changes (mostly cosmetic: parity's tokens resolve to Vue2's own pixel values inside
   `.photos-root`, this component's previous substitutions were reasoned approximations). */

/* `.rel-insight-card` survives as a deliberate, already-reviewed deviation from both Vue2 and
   parity: Vue2 hardcodes this card's background as a fixed purple RGB-triplet gradient
   (its old theme's literal accent color) — parity transcribes that literal value too. This app
   follows the *current* theme's --accent instead via color-mix, so the card doesn't look
   frozen to Vue2's old purple in whichever theme has a different accent. Not a bug to fix;
   kept exactly as previously reasoned. */
.rel-insight-card {
  background: linear-gradient(
    160deg,
    color-mix(in srgb, var(--accent) 10%, transparent),
    color-mix(in srgb, var(--accent) 3%, transparent)
  );
  border: 1px solid color-mix(in srgb, var(--accent) 22%, transparent);
  border-radius: var(--radius-sm);
  padding: 16px;
}
/* `.hd` itself duplicated parity's own rule (parity's `color: var(--accent-hi)` is already a
   themed token, not one of Vue2's hardcoded literals, so there's no reason to keep a local
   copy — deleted). `.hd .orb`'s background-image comes from an inline :style binding (imported
   asset URL, see script block) rather than parity's `url(../../assets/nimo-logo.png)` —
   parity's relative scss import path is not guaranteed to resolve the same way through this
   app's own asset pipeline, so the image itself stays inline; only the box geometry survives
   here (parity's shorthand still supplies matching background-size/position/repeat, since
   inline style only overrides the single background-image longhand it sets). `.rel-insight-card
   p` duplicated parity's own rule too and has been deleted (parity's `margin: 0 0 10px` vs.
   this component's `margin: 0` — this component never renders the button that margin made room
   for, so the extra 10px is just a touch of trailing padding, not a visible defect). */
.rel-insight-card .hd .orb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
}
</style>
