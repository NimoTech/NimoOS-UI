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

<style scoped>
.mrd-overlay {
  position: fixed;
  inset: 0;
  /* 必须低于三态弹窗 ClusterActionDialog(220)——Vue2 源两者的比例是 100(本弹窗)
     vs 200(三态弹窗),这里在本仓既有 z-index 序列里按"低于三态弹窗"这条硬约束取值,
     不是照搬 Vue2 的绝对数字(本仓其它浮层已经占用了 50/150/220/230 这些值)。 */
  z-index: 200;
  background: var(--overlay-bg);
  backdrop-filter: var(--overlay-blur);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
}

/* P2 血泪(同 ClusterActionDialog.vue:257-258 的先例):面板底色须用 --popup-bg,
   不用 --card-bg(深色主题下 --card-bg 近透明,叠在暗底上会看穿)。 */
.mrd-panel {
  width: 560px;
  max-width: 100%;
  background: var(--popup-bg);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  padding: 24px;
  box-shadow: var(--card-shadow-hi);
}

.mrd-head { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.mrd-logo {
  width: 40px; height: 40px; flex: 0 0 auto; border-radius: 50%;
  object-fit: cover;
  /* 图片加载前(或加载失败,<img> 没有兜底)的占位底色,不是给内容用的排版容器——
     不需要 display:flex/align-items/justify-content/color(那套是给内部子节点排版的,
     <img> 没有子节点)。 */
  background: var(--accent-soft);
}
.mrd-head-text { flex: 1 1 auto; min-width: 0; }
.mrd-title { font-size: 15px; font-weight: 600; color: var(--fg); }
.mrd-confidence { font-size: 11.5px; color: var(--fg-muted); margin-top: 2px; }
.mrd-close {
  flex: 0 0 auto;
  width: 24px; height: 24px; border-radius: 50%; border: 0; background: transparent;
  color: var(--fg-muted); font-size: 15px; line-height: 1; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}
.mrd-close:hover { background: var(--hover); color: var(--fg); }

.mrd-compare { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
.mrd-side { display: flex; flex-direction: column; align-items: center; gap: 8px; }
/* PersonAvatar 的 size prop 只接受固定像素,不是百分比——Vue2 这里的头像是
   width:100%/aspect-ratio:1 的真流式方块(:387,405)。用 !important 覆盖组件内联 style
   把根节点收窄到"跟随列宽、保持 1:1"(CSS max-width/aspect-ratio 的计算优先级本就在
   width 之后应用,这是标准行为,不是 hack),size=200 只留作 PersonAvatar 内部比例计算
   的基准值(本处未展示收藏星标,不受影响)。窄屏兜底:没有这条,200px 方块在窄面板上
   会溢出(560px 面板在手机宽度上会被 max-width:100% 压窄,方块却仍是钉死的 200px)。 */
.mrd-side :deep(.person-avatar) {
  max-width: 100%;
  height: auto !important;
  aspect-ratio: 1;
}
.mrd-side-label { font-size: 12px; color: var(--fg-muted); }

.mrd-reason {
  padding: 12px; background: var(--accent-soft); border-radius: 10px;
  font-size: 12px; color: var(--fg); line-height: 1.5; margin-bottom: 16px;
}
/* Vue2 :423 用 var(--accent-hi)——本仓 theme.css 未定义这个 token(已 grep 确认两套主题块
   均无),借用在两套主题都有真实定义的 --accent-text(同色调、已确立的"强调文字"角色,
   同 PhotosPeople.vue .em / .check 的既有惯例),不新增/臆造 token。 */
.mrd-reason-lead { color: var(--accent-text); }

.mrd-actions { display: flex; gap: 8px; }
.mrd-btn {
  flex: 1; height: 38px; border-radius: 10px; background: var(--chip-bg);
  border: 1px solid var(--chip-border); color: var(--fg); font: inherit; font-size: 13px;
  font-weight: 500; cursor: pointer;
}
.mrd-btn:hover { background: var(--chip-bg-hi); }
.mrd-btn-primary {
  background: var(--accent); border-color: var(--accent); color: var(--on-accent); font-weight: 600;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
}
.mrd-btn-primary:hover { filter: brightness(1.08); }
</style>
