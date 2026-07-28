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
  }>(),
  {
    name: '',
    ver: null,
    size: 72,
    dashed: false,
    fav: false,
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

function onImgError(): void {
  failed.value = true
}
</script>

<template>
  <div
    class="person-avatar"
    :class="{ 'is-dashed': dashed }"
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
    <div v-if="fav" data-test="avatar-fav" class="person-avatar-fav" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M12 3.5l2.6 5.3 5.9.86-4.25 4.14 1 5.86L12 17.9l-5.25 2.76 1-5.86L3.5 9.66l5.9-.86z"/></svg>
    </div>
  </div>
</template>

<style scoped>
.person-avatar {
  position: relative;
  flex-shrink: 0;
}
.person-avatar-ring {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  overflow: hidden;
}
/* --line-stronger 在本仓 theme.css 不存在(已 grep 确认,两套主题块均无此 token)——
   借用已在两套主题都有真实定义的 --card-border(卡片描边)做虚线环描边,登记为对
   brief 字面 token 名的替代,而非新增或臆造。 */
.person-avatar.is-dashed .person-avatar-ring {
  border: 1px dashed var(--card-border);
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
/* 首字母/图标前景色实算(完整过程见任务报告,数值细节看 theme.css 里 --accent/
   --on-accent 的实际取值,这里不重复写十六进制字面量以免被 color-guard 误判成裸颜色):
   兜底渐变两个色标是 --accent 与「--accent 与黑混色」,取渐变对角线中点(单个居中字形
   实际落点的代表色,而非角落极值)算对比度 —— 深色主题、浅色主题的 --on-accent 对中点色
   均 ≥ WCAG AA 4.5:1 门槛(深色主题约 4.76:1,浅色主题约 7.16:1),故用 --on-accent
   (饱和填充色之上的可读前景语义 token),不钉死字面量;与 PhotosAlbums.vue
   .album-cover-icon 用法同一先例。 */
.person-avatar-initial {
  font-weight: 600;
  line-height: 1;
  color: var(--on-accent);
}
.person-avatar-icon {
  width: 32%;
  height: 32%;
  color: var(--on-accent);
}
.person-avatar-fav {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 36%;
  height: 36%;
  min-width: 15px;
  min-height: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  /* --overlay-bg 是两套主题各自定义的半透明暗底(非固定跨皮肤值),用于在不可控的
     真实人脸缩略图之上垂放收藏星标,不需要 theme-exception。 */
  background: var(--overlay-bg);
}
.person-avatar-fav svg {
  width: 60%;
  height: 60%;
  /* --star-fg 未在 theme.css 定义具体值,是本仓已确立的先例(PhotosGrid.vue:389,395 /
     PhotoLightbox.vue:345 均为 var(--star-fg, #ffd60a)):固定金色星标跨皮肤不变,用
     var(fallback) 形式表达而非字面量,color-guard 按 token 用法放行,这里复用同一先例
     而不是另起字面量。 */
  color: var(--star-fg, #ffd60a);
}
</style>
