<script setup lang="ts">
// Task 8 (SP7-P5 人物): MergeReviewDialog.vue —— 合并建议逐条审阅弹窗。逐段照 Vue2
// NimoOS-UI src/views/Photos/PhotosPeopleView.vue:364-434(模板结构)与 :595-614
// (onAcceptReview/onRejectReview 的 emit 语义)移植。
//
// 分工(同 T7 ClusterActionDialog 的先例,反过来也一样成立):本组件只收集用户点击并
// emit,不调用 store、不发 toast、不做 index 钳制——这三件事全部在宿主 PhotosPeople.vue
// (它持有 suggestions 数组与 index,brief 明确要求钳制逻辑放父组件)。
//
// 头像复用 T5 的 PersonAvatar(加了 shape='square' 的加性扩展,见该组件改动),不自绘——
// 好处是三级兜底(真图→首字母→person 图标)、失败态自愈全部白得,不用重复实现 Vue2
// :385-399/403-417 的 avatarFailed/onAvatarError 那一套本地状态。
//
// 保真的不对称(brief 明确要求照搬,登记为 Vue2 现状,不是本组件的疏漏):左侧(fromId)
// 姓名从 people 列表反查(:395-396);右侧(intoId)直接用 suggestion.intoName(:413-414),
// 不查 people——intoName 是建议生成时刻的快照,可能与当前最新改名不一致,Vue2 就是这样。
//
// i18n 缺口(brief 列举的键里没有,确认缺失后按"确实缺了报上来"补的,已在任务报告登记):
// photosPersonMergeGroupA/B(两列固定标签,原 Vue2 $t('Cluster A'/'Cluster B'),旧仓
// zh_CN.json:1993-1994 译"集群 A/B" 触犯本期术语红线,改"组 A/B")、
// photosPersonMergeNimoLead(理由条品牌前缀 $t('Nimo:'))。
//
// Plan D Task 4 (scoped zeroed out): this component's class names are unchanged (Task 1 already
// landed them in parity under the current .mrd-* names — Vue2's entire dialog is likewise built
// from :style bindings, so there's no class to anchor to). The whole local scoped style block
// that used to live at the end of this file has been deleted: every rule now has a matching,
// line-by-line-compared counterpart in src/photos/styles/vue2-parity/photos-people.scss (the
// genuine gap filled in during the diff — the old `:deep(.person-avatar)` avatar square
// constraint has been rewritten in parity as a plain descendant selector
// `.mrd-side .person-avatar`, since parity isn't scoped CSS and doesn't need :deep; the local
// drift from Vue2 corrected along the way — .mrd-overlay's padding — is also documented in that
// parity rule's own comment). Parity is a plain global stylesheet, and once this component
// carries no local scoped rules at all, nothing can out-specificity parity's own declaration
// order anymore — the hover-fix comment that used to be here (":hover losing its background to
// the base class's hover") existed precisely because a local scoped rule carries its own
// specificity bump; once scoped is entirely zeroed out, that precondition no longer holds and
// can't recur.
import { computed, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import PersonAvatar from './PersonAvatar.vue'
import { mergeConfidencePct, mergeReasonKey, type Person } from '../util/peopleView'
// 协调者裁定(fix,收到 task-8 报告后追加):头部品牌圆头像不是"AI 装饰件可以自由替代"的
// 那一类,计划里明确写了要照 Vue2 用真资产。Vue2 的 nimo-logo.png(PhotosPeopleView.vue:370,
// 372)本仓原来确实没有,现从旧仓 src/views/Photos/nimo-logo.png 原样复制进
// src/photos/assets/nimo-logo.png(44850 字节,md5 校验与源文件一致),不是重新画的图。
import nimoLogoUrl from '../assets/nimo-logo.png'

export interface MergeSuggestion {
  id: string | number
  fromId: string | number
  intoId: string | number
  intoName?: string
  confidence?: number
}

const props = defineProps<{
  open: boolean
  suggestions: MergeSuggestion[]
  index: number
  people: Person[]
}>()
const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  // 声明满足 brief 给定的接口契约,但目前从未被调用:本组件没有任何独立的"跳到第 N 条"
  // 导航控件(Vue2 也没有——reviewIdx 只在 openReview 时置 0,此后只随 accept/reject 由
  // 宿主钳制)。留着这个 emit 是为了让 open/index 保持同一套 v-model 形态,不因为"暂时
  // 用不到"就砍掉接口里明确要求的部分。
  (e: 'update:index', v: number): void
  (e: 'accept', id: string | number): void
  (e: 'reject', id: string | number): void
}>()

const { t } = useI18n()

// 铁律:按 id 比较一律 String() 归一,后端 id 可能是数字。
function sameId(a: string | number, b: string | number): boolean {
  return String(a) === String(b)
}

// Vue2 :518 currentMerge = mergeSuggestions[reviewIdx]。index 越界(宿主钳制发生在
// await 之后,accept/reject 请求在途的那个窗口期里 suggestions 已经少一条但 index 还没
// 钳过来)时落到 undefined——模板 v-if 一并挡住,不崩,同 Vue2 `v-if="reviewOpen && currentMerge"`
// 的防御方式。
const current = computed<MergeSuggestion | undefined>(() => props.suggestions[props.index])

const titleText = computed(() =>
  t('photosPersonMergeSuggestTitle', { idx: props.index + 1, total: props.suggestions.length }),
)
const confidenceText = computed(() =>
  t('photosPersonMergeSuggestConfidence', { n: mergeConfidencePct(current.value?.confidence) }),
)

// 左侧姓名反查(Vue2 :395-396):从 people 列表按 fromId 找,找不到落空串
// (personInitial 空串兜底走 person 图标,同 Vue2 `|| ''`)。
const fromName = computed(() => {
  const s = current.value
  if (!s) return ''
  return props.people.find((p) => sameId(p.id, s.fromId))?.name ?? ''
})
// 头像缓存击穿 ver:两侧都走同一份查找逻辑(Vue2 :560-563 的 avatarUrl 对 fromId/intoId
// 一视同仁,不对称的只是姓名显示,不是头像 URL/ver)。
const fromVer = computed(() => {
  const s = current.value
  if (!s) return null
  return props.people.find((p) => sameId(p.id, s.fromId))?.coverFaceId ?? null
})
const intoVer = computed(() => {
  const s = current.value
  if (!s) return null
  return props.people.find((p) => sameId(p.id, s.intoId))?.coverFaceId ?? null
})

const reasonText = computed(() => {
  const r = mergeReasonKey(current.value ?? null)
  return t(r.key, r.params)
})

// 主按钮文案:intoName 存在 → photosPersonMergeAs {name};缺失 → 用 photosPersonMergeAsSame
// 填充同一个键的 {name} 槶位(Vue2 :429-430 的 v-if/v-else 两句在 New-UI locale 已经合成了
// 一句,见 zh_cn.ts / en_us.ts 的 photosPersonMergeAs 定义)。
const acceptLabel = computed(() =>
  t('photosPersonMergeAs', { name: current.value?.intoName || t('photosPersonMergeAsSame') }),
)

function close(): void {
  emit('update:open', false)
}
function onReject(): void {
  if (!current.value) return
  emit('reject', current.value.id)
}
function onAccept(): void {
  if (!current.value) return
  emit('accept', current.value.id)
}

// Esc:document 级 + watch(open) 挂/摘 + 分支内 stopPropagation(同 AlbumPickerDialog.vue:
// 70-100 / ClusterActionDialog.vue:103-134 的先例)。点遮罩 @click.self 关闭。
// z-index 必须低于三态弹窗(ClusterActionDialog 是 220,Vue2 本身两者是 100 vs 200 的比例
// 关系),见样式区注释。
function onDocumentKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  e.stopPropagation()
  close()
}
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) document.addEventListener('keydown', onDocumentKeydown)
    else document.removeEventListener('keydown', onDocumentKeydown)
  },
  { immediate: true },
)
onUnmounted(() => document.removeEventListener('keydown', onDocumentKeydown))
</script>

<template>
  <div v-if="open && current" class="mrd-overlay" data-test="mrd-overlay" @click.self="close">
    <div class="mrd-panel" data-test="mrd-panel">
      <div class="mrd-head">
        <!-- Vue2 :372 用 nimoLogoUrl 图片渲染品牌圆头像(background:url(...) center/cover)。
             这里用等效的 <img> + object-fit:cover 还原同一几何,真资产见 import 处注释。 -->
        <img :src="nimoLogoUrl" class="mrd-logo" data-test="mrd-logo" alt="" aria-hidden="true">

        <div class="mrd-head-text">
          <div class="mrd-title" data-test="mrd-title">{{ titleText }}</div>
          <div class="mrd-confidence" data-test="mrd-confidence">{{ confidenceText }}</div>
        </div>
        <button type="button" class="mrd-close" data-test="mrd-close" :aria-label="t('photosClose')" @click="close">×</button>
      </div>

      <div class="mrd-compare">
        <div class="mrd-side" data-test="mrd-side-from">
          <PersonAvatar :person-id="current.fromId" :name="fromName" :ver="fromVer" :size="200" shape="square" />
          <div class="mrd-side-label" data-test="mrd-label-from">{{ t('photosPersonMergeGroupA') }}</div>
        </div>
        <div class="mrd-side" data-test="mrd-side-into">
          <PersonAvatar :person-id="current.intoId" :name="current.intoName || ''" :ver="intoVer" :size="200" shape="square" />
          <div class="mrd-side-label" data-test="mrd-label-into">{{ t('photosPersonMergeGroupB') }}</div>
        </div>
      </div>

      <div class="mrd-reason" data-test="mrd-reason">
        <b class="mrd-reason-lead">{{ t('photosPersonMergeNimoLead') }}</b> {{ reasonText }}
      </div>

      <div class="mrd-actions">
        <button type="button" class="mrd-btn" data-test="mrd-reject" @click="onReject">{{ t('photosPersonNotAMatch') }}</button>
        <button type="button" class="mrd-btn mrd-btn-primary" data-test="mrd-accept" @click="onAccept">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
          {{ acceptLabel }}
        </button>
      </div>
    </div>
  </div>
</template>
