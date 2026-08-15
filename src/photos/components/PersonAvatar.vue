<script setup lang="ts">
// Task 5 (SP7-P5 人物): 通用人物头像 —— 被 T6(人物首页)/T7(合并对话框候选)/
// T8(合并建议横幅)/T10/T13 共用。Vue2 把下面这套三级兜底结构在 5 处复制粘贴
// (PhotosPeopleView.vue:135-145,254,314,391,409;PhotosPersonDetail.vue:9-19),
// 这里收成一个组件。
//
// 三级兜底(照 PhotosPeopleView.vue:135-145):
//   ① personId 存在且上次没有加载失败 → 真实头像图(personFaceThumbnailUrl(id, ver))
//   ② 否则若 personInitial(name) 非空 → 渐变底 + 大写首字母
//   ③ 否则 → 渐变底 + person 图标
//
// 偏离登记(Vue2 的坏点不带过来):Vue2 把失败态记在父组件 avatarErrors 字典里且整个会话
// 不清除(:474,566-571)——换了封面 URL 也不会重试,永久显示兜底。这里 `failed` 是组件
// 自己的 ref,并 watch [personId, ver] 变化时复位为 false,换封面（ver=coverFaceId 变了）
// 或换人（personId 变了）都会重新尝试加载真图,不会被上一次失败卡死。
import { computed, ref, watch } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { personInitial } from '../util/peopleView'

const props = withDefaults(
  defineProps<{
    personId: string | number | null
    name?: string
    ver?: string | number | null
    size?: number
    dashed?: boolean
    fav?: boolean
    // Task 8 加性扩展(SP7-P5 人物,MergeReviewDialog):Vue2 合并建议审阅弹窗的两侧头像是
    // 方形圆角(border-radius:12px + aspect-ratio:1),是全区唯一的方形头像处
    // (PhotosPeopleView.vue:387,390,405,408)。默认仍是 'circle',不改变任何既有调用点的
    // 渲染结果 —— 只在传 'square' 时切换圆环的 border-radius,三级兜底逻辑完全不变。
    shape?: 'circle' | 'square'
  }>(),
  {
    name: '',
    ver: null,
    size: 72,
    dashed: false,
    fav: false,
    shape: 'circle',
  },
)

// 内部自持失败态(见头部注释的偏离登记)。
const failed = ref(false)
watch(
  () => [props.personId, props.ver],
  () => {
    failed.value = false
  },
)

const showImg = computed(() => props.personId !== null && !failed.value)
// service.photos.personFaceThumbnailUrl 内部已带 token,组件不手拼 URL(硬约束)。
// 铁律:数字 id 原样传给 service 层,不做 String() 转换——转换发生在比较场景,不是这里。
const avatarUrl = computed(() =>
  props.personId === null ? '' : service.photos.personFaceThumbnailUrl(props.personId, props.ver),
)
const initial = computed(() => personInitial(props.name))
// 首字母字号 = size * 0.32 向下取整(brief 明确公式)。
const initialFontSize = computed(() => Math.floor(props.size * 0.32))

// 根元素上的 data-fav(照 Vue2 photos-people.scss:132 的 `.ring[data-fav="true"]`):
// 父层要给收藏头像画 accent 内环时需要一个选择器钩子。评审 Important 2:原先父层
// (PhotosPeople.vue)是**无条件**给 .face-grid-lg 下所有头像画环 —— 当前语义等价(Pinned
// 分区只渲染收藏项),但这个网格类一旦被复用就会把非收藏头像也画上环。把条件挪回数据本身。
//
// 收藏星标的尺寸与水平偏移都随 size **等比**缩放,唯一锚点是 Vue2 大号卡片那一档:
//   photos-people.scss:150-156  .face-card .fav-mark { width/height: 24px; transform: translateX(34px) }
// 对应 size=124(scss:118 的 .ring 是 124px)。故比例 = 24/124 与 34/124,代回 124 精确复现 24px / 34px。
//
// 为什么只认 124 这一个锚点(评审 Important 修正):scss:165 的
// `.face-grid-md … .fav-mark { transform: translateX(20px) }` 在 Vue2 里是**死代码** ——
// .face-grid-md 只出现在 Named 分区,而该分区的数据源是 `others = filteredNamed.filter(p => !p.favorite)`,
// 星标本身又是 `v-if="p.favorite"`,那一档从未真正绘制过。上一轮我拿它当第二个锚点拟合直线,
// 依据是假的,已废弃。
//
// 星标尺寸夹在 [15, 24]:上界是 Vue2 的原值,下界 15px 沿用本组件初版的 `min-width: 15px`
// (星形图标再小就认不出)。**关键**:尺寸必须随 size 缩,不能像上一轮那样钉死 24px ——
// 48px 头像配 24px 星标会占掉半个头像宽、压在人脸正中;等比缩放后 48px 头像的星标是 15px(31%),
// 且「星标中心到圆心的距离 / 半径」在各尺寸下都稳定在 0.92-0.94,与 124px 那一档几何相似。
const favSize = computed(() => Math.min(24, Math.max(15, Math.round(props.size * (24 / 124)))))
const favOffset = computed(() => Math.round(props.size * (34 / 124)))

function onImgError(): void {
  failed.value = true
}
</script>

<template>
  <div
    class="person-avatar"
    :class="{ 'is-dashed': dashed, 'is-square': shape === 'square' }"
    :data-fav="fav ? 'true' : 'false'"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <div class="person-avatar-ring">
      <img
        v-if="showImg"
        data-test="avatar-img"
        class="person-avatar-img"
        :src="avatarUrl"
        :alt="name || ''"
        @error="onImgError"
      >
      <div v-else class="person-avatar-fallback">
        <span
          v-if="initial"
          data-test="avatar-initial"
          class="person-avatar-initial"
          :style="{ fontSize: `${initialFontSize}px` }"
        >{{ initial }}</span>
        <svg
          v-else
          data-test="avatar-icon"
          class="person-avatar-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        ><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>
      </div>
    </div>
    <div
      v-if="fav"
      data-test="avatar-fav"
      class="person-avatar-fav"
      :style="{
        width: `${favSize}px`,
        height: `${favSize}px`,
        transform: `translateX(${favOffset}px)`,
      }"
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M12 3.5l2.6 5.3 5.9.86-4.25 4.14 1 5.86L12 17.9l-5.25 2.76 1-5.86L3.5 9.66l5.9-.86z"/></svg>
    </div>
  </div>
</template>

<style scoped>
/* Task 5 (Plan D) shadowing cleanup — audited, nothing to shrink here (and deliberately no
   class renames): unlike the other five components in this task, this one has no single Vue2
   ancestor to align to. It replaces FIVE different pieces of Vue2 markup that each use their
   own class names for what is structurally the same three-tier avatar (real image / initial /
   icon fallback): `.face-card .ring` (people list), `.rel-row .av` (co-appear list), `.coappear-
   card .ring` (person-detail timeline strip), `.detail-hero .avatar` (hero), and the merge
   dialog's own avatar markup. Parity anchors each of those five shapes to its own selector
   path with its own sizing/border — this component can't literally *be* `.ring` and `.av` and
   `.detail-hero .avatar` at once without either duplicating itself per call site or accepting
   a variant-name prop (out of scope: "props/emits/logic untouched"). The already-established
   pattern (see PhotosPeople.vue's Task 2 survivor comments) is the opposite direction: keep
   this component's own class names (`.person-avatar-img` etc.) stable, and let each *consumer*
   add its own `:deep()` override for the one Vue2 shape it needs. PersonHero.vue and
   PersonRelationsTab.vue (both touched by this task) were checked against this same rule — see
   task-5-report.md. Nothing here duplicates a parity anchor (there isn't one to duplicate),
   and the `--card-border`/`--avatar-fallback`/`--overlay-bg`/`--star-fg` tokens below are this
   app's own theme.css tokens (not parity's private set), left as-is: since there is no single
   parity anchor this component's own class names should adopt, there's also no reason to
   switch its token vocabulary — that decision belongs to whichever consumer's `:deep()`
   override, if any, needs to match a specific parity anchor (see PhotosPeople.vue's Task 2
   survivors for the established pattern). */
.person-avatar {
  position: relative;
  flex-shrink: 0;
}
.person-avatar-ring {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  overflow: hidden;
  /* 评审 Minor 修正:Vue2 的 .face-card .ring(photos-people.scss:124)**无条件**带一圈
     1px 实线发丝边,原先只在 is-dashed 时给边 —— Named 分区 84px 头像因此少了一圈描边
     (Pinned 124px 被 accent 光环盖住才没露出来)。这里改成默认实线、虚线态覆盖。 */
  border: 1px solid var(--card-border);
}
/* --line / --line-stronger 在本仓 theme.css 都不存在(已 grep 确认,两套主题块均无这两个
   token)—— 一律借用在两套主题都有真实定义的 --card-border(卡片描边),登记为对 Vue2/brief
   字面 token 名的替代,而非新增或臆造。 */
.person-avatar.is-dashed .person-avatar-ring {
  border-style: dashed;
}
/* Task 8 加性扩展:方形圆角变体(默认仍是圆形 border-radius:50%,见上方规则),
   仅 MergeReviewDialog 的两侧对比头像使用。 */
.person-avatar.is-square .person-avatar-ring {
  border-radius: 12px;
}
.person-avatar-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.person-avatar-fallback {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--avatar-fallback);
}
.person-avatar-initial {
  font-weight: 600;
  line-height: 1;
}
.person-avatar-icon {
  width: 32%;
  height: 32%;
}
/* theme-exception: --avatar-fallback 不是纯 accent 实底（暗色主题一端混了 55% 黑，
   见 theme.css 同名 token），--on-accent 默认暗色主题下是深藏青，叠在这种偏暗渐变上
   会深底深字（评审 Critical 修正，同 PhotosAlbumDetail.vue:733 的 tile-cover-btn
   先例）。沿渐变对角轴只偏移约 10% 对比度就跌破小字 4.5:1 门槛，字形笔画范围本身就
   落在这个偏移量之外，圆形裁切裁不掉这个风险，合并候选行等小尺寸头像的字号更小，
   没有大字 3:1 豁免。两套主题统一钉死浅色，不只改暗色分支。 */
.person-avatar-initial,
.person-avatar-icon {
  color: #fff;
}
/* 几何逐条照 Vue2 photos-people.scss:150-164 的 .fav-mark:圆环「上方偏右」而不是右下角。
   尺寸与水平偏移由 :style 注入(都随 size 等比缩放,见 script 的 favSize/favOffset 注释)。
   top 的参考系换算(评审 Minor 修正):Vue2 的 .fav-mark 挂在 .face-card 上,该卡片有
   padding:6px(scss:112),故它的 top:4px 实际等于「圆环顶边**上方** 2px」;本组件的定位
   父级就是圆环本体,要还原同一视觉位置得写 -2px,直接照抄 4px 会比 Vue2 低 6px。 */
.person-avatar-fav {
  position: absolute;
  top: -2px;
  left: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  pointer-events: none;
  z-index: 2;
  /* --overlay-bg 是两套主题各自定义的半透明暗底(非固定跨皮肤值),用于在不可控的
     真实人脸缩略图之上垂放收藏星标,不需要 theme-exception。 */
  background: var(--overlay-bg);
  backdrop-filter: var(--blur);
}
/* theme-exception: 星标压在不可控的人脸照片上,暗底之上需要恒定的半透明浅色描边勾边 */
.person-avatar-fav { border: 1px solid rgba(255, 255, 255, 0.12); }
.person-avatar-fav svg {
  /* 图标占星标底盘的一半(Vue2 是 24px 底盘配 12px 图标),跟着 favSize 一起缩 */
  width: 50%;
  height: 50%;
  /* --star-fg 未在 theme.css 定义具体值,是本仓已确立的先例(PhotosGrid.vue:389,395 /
     PhotoLightbox.vue:345 均为 var(--star-fg, #ffd60a)):固定金色星标跨皮肤不变,用
     var(fallback) 形式表达而非字面量,color-guard 按 token 用法放行,这里复用同一先例
     而不是另起字面量。 */
  color: var(--star-fg, #ffd60a);
}
</style>
