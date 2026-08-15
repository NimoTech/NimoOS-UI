<script setup lang="ts">
// Task 11 (SP7-P5 人物): PersonAssetGrid.vue —— 人物详情页按月资产网格
// (多选 / 移出 / 每月展开全部)。逐段照 Vue2 NimoOS-UI
// src/views/Photos/PhotosPersonDetail.vue:132-154(网格模板)、:760-763(assetThumb,
// size=large)、:868-883(选择逻辑)移植;样式段照 photos-people.scss:474-500
// (.person-month / .person-grid,8 列 + 3px 圆角)。
//
// 为什么不复用 PhotosGrid(见 task-11-brief.md 记账,三条硬理由):①每格多一个
// 「不是这个人」移出按钮(PhotosGrid 不暴露插槽);②固定 8 列 + 每月默认只渲 16 张,
// 与 PhotosGrid 的响应式 auto-fill minmax(140px,1fr) + density 三态契约冲突;
// ③缩略图用 size=large 而非 small。代价:人物页无视频悬停预览(Vue2 详情页同样没有)。
//
// 本任务定位:纯展示 + emit——不碰 store、不发请求、不弹 toast(全部在 T14 容器里)。
// 整格点击的分支收回组件内部(协调者裁定,原提交曾把这个决策下推给 T14 容器,已改正):
// 逐字节对应 Vue2 onTileClick(:874-880)—— selectionMode 为真时 emit('toggle-select', p.id),
// 否则 emit('open', p),单一入口内分支。理由:①组件已经收了 selectionMode prop,它本来就
// 有决策所需的全部信息——若只用来控制移出按钮显隐,这个 prop 就名不副实;②行为与 Vue2
// 1:1 的可验证性更强,"选择态点整格→只 toggle-select、不 open" 能在组件测试里直接钉住,
// 不必等容器接线才发现漏了分支;③下推给容器意味着容器要「收到 open 但在选择态下忽略它」,
// 多一层隐式约定,是这期一直在消除的那类隐患。
//
// 唯一的有意偏离(计划登记第 8 条,brief 明确要求):Vue2 :138 每月只渲 m.photos.slice(0,16),
// 月份头却写真实总数,超出的照片在网格里永久不可见(只有灯箱翻页能翻到)。这里默认仍只渲
// 16 张(视觉 1:1 不变),但 photos.length > 16 时在月份头右侧加「查看全部 {n} 张 / 收起」
// 文本按钮,补齐 affordance——不是改版式。
//
// 铁律:选中判定用 selected.some(x => String(x) === String(p.id)),绝不用 includes
// (后端 asset id 可能是数字、父组件可能传字符串,两侧类型可能不一致)。
//
// 配色红线:瓦片上叠在照片之上的元素(时长角标 .tile-vid、移出按钮 .tile-detach、
// 未选中态的选择圈 .tile-check)背景走 var(--overlay-bg)(叠在不可控照片像素上,主题
// token 本身就是半透明黑/半透明深棕两套值,不是裸字面量),前景钉死浅色 + theme-exception
// 注释(同 PersonHero.vue 已确立的先例,理由见该文件头部"配色红线"说明,这里不重复)。
// 例外:选中态的 .tile-check 背景切到饱和 var(--accent) 实底(不再叠在照片上,是
// 组件自己控制的纯色),这正是 --on-accent 合法使用的前提场景(见任务颜色红线:
// --on-accent 只在 var(--accent) 饱和实底上可用),与未选中态刻意区分。
import { reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import type { Month, Photo } from '../util/assetToPhoto'

const props = defineProps<{
  months: Month[]
  selected: Array<string | number>
  selectionMode: boolean
}>()

const emit = defineEmits<{
  (e: 'open', photo: Photo): void
  (e: 'toggle-select', id: string | number): void
  (e: 'detach', ids: Array<string | number>): void
}>()

const { t } = useI18n()

// 每月展开态,key 是 Month.key。默认全部收起(只渲前 16 张)。
const expanded = reactive<Record<string, boolean>>({})

function toggleExpand(key: string): void {
  expanded[key] = !expanded[key]
}

function visiblePhotos(m: Month): Photo[] {
  return expanded[m.key] ? m.photos : m.photos.slice(0, 16)
}

// 铁律:绝不用 includes——两侧 id 类型可能不一致(数字 vs 字符串)。
function isSelected(id: string | number): boolean {
  return props.selected.some((x) => String(x) === String(id))
}

// 整格点击(Vue2 :874-880 onTileClick 逐字节对应,理由见文件头注释)。
function onTileClick(p: Photo): void {
  if (props.selectionMode) emit('toggle-select', p.id)
  else emit('open', p)
}

function thumbnailSrc(id: string | number): string {
  return service.photos.thumbnailUrl(id, 'large')
}
</script>

<template>
  <div class="person-asset-grid">
    <div v-if="months.length === 0" class="empty-state" data-test="empty-state">
      {{ t('photosPersonNoPhotos') }}
    </div>

    <template v-else>
      <div v-for="m in months" :key="m.key" class="person-month">
        <div class="person-month-head">
          <span class="title">{{ m.title }}</span>
          <span class="sub">
            {{ t('photosPeoplePhotosCount', { n: m.photos.length }) }}
            <template v-if="m.photos[0] && m.photos[0].place"> · {{ m.photos[0].place }}</template>
          </span>
          <button
            v-if="m.photos.length > 16"
            type="button"
            class="show-all-btn"
            data-test="show-all-toggle"
            @click="toggleExpand(m.key)"
          >{{ expanded[m.key] ? t('photosPersonShowLess') : t('photosPersonShowAll', { n: m.photos.length }) }}</button>
        </div>

        <div class="person-grid">
          <div
            v-for="p in visiblePhotos(m)"
            :key="p.id"
            class="tile"
            :data-selected="isSelected(p.id)"
            :data-selection-mode="selectionMode"
            @click="onTileClick(p)"
          >
            <img :src="thumbnailSrc(p.id)" alt="" />

            <div v-if="p.isVideo" class="tile-vid">
              <span class="vid-play">▶</span> {{ p.duration }}
            </div>

            <button
              type="button"
              class="tile-check"
              :title="isSelected(p.id) ? t('photosPersonDeselect') : t('photosPersonSelect')"
              @click.stop="emit('toggle-select', p.id)"
            >
              <svg
                v-if="isSelected(p.id)"
                class="tile-check-icon"
                viewBox="0 0 24 24"
                width="12"
                height="12"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
              ><path d="M5 13l4 4L19 7" /></svg>
            </button>

            <button
              v-if="!selectionMode"
              type="button"
              class="tile-detach"
              :title="t('photosPersonNotThePerson')"
              @click.stop="emit('detach', [p.id])"
            >
              <!-- x 字形只占视口一半,标称尺寸需要更大才能看清(同 Vue2 :150 注释)。
                   15px 是 Vue2 的**生效值**:模板给的 :size="20" 被样式段 :1179-1183 的
                   `.tile-detach svg { width:15px; height:15px }` 覆盖(终审 Minor 3 回源核得)。 -->
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.empty-state {
  padding: 60px 20px;
  text-align: center;
  color: var(--fg-muted);
  font-size: 13px;
}

/* Task 5 (Plan D) shadowing cleanup: `.person-month`/`.person-month-head` (+`.title`/`.sub`)
   duplicated parity's own rules under the same selectors and have been deleted — parity now
   governs directly. */
.show-all-btn {
  margin-left: auto;
  padding: 0;
  border: none;
  background: none;
  font-family: var(--font);
  font-size: 12px;
  font-weight: 500;
  color: var(--accent);
  cursor: pointer;
}
.show-all-btn:hover { text-decoration: underline; }

/* Task 5 (Plan D) shadowing cleanup: `.person-grid` (8-column grid) duplicated parity's own
   rule and has been deleted. `.tile img`/`[data-selected] { outline }`/`[data-selected] img
   { opacity }` are likewise now transcribed into parity's `.person-grid .tile` family
   (geometry was already Vue2-accurate here; only the color tokens moved — see
   task-5-report.md). Base positioning (`position/overflow`) also moved to parity; what's left
   here is New-UI-only: a placeholder background while the thumbnail loads (no Vue2 value to
   transcribe) and `cursor: pointer`, which parity doesn't set for `.tile` either. */
.tile { background: var(--chip-bg); cursor: pointer; }
/* New-UI addition, no Vue2 source: Vue2's build has a global image reset this app doesn't
   (its own `.tile img` rule is likewise absent from both Vue2's scoped block and parity —
   confirmed by grep), so this app's raw `<img>` needs its own cover-fit sizing rule or it
   would render at native image size instead of filling the tile. */
.tile img { width: 100%; height: 100%; object-fit: cover; display: block; }

.tile-vid {
  position: absolute; right: 4px; bottom: 4px; z-index: 2;
  display: flex; align-items: center; gap: 3px;
  padding: 1px 5px; border-radius: 999px; font-size: 9px;
  background: var(--overlay-bg);
  /* theme-exception: 叠在照片缩略图上的时长角标,需跨主题恒定浅色前景(同
     PhotosGrid.vue .tile-vid / PersonHero.vue 系列的既有先例,理由见 PersonHero.vue
     文件头"配色红线"说明,这里不重复)。 */
  color: #fff;
}
.vid-play { font-size: 7px; }

/* Task 5 (Plan D) shadowing cleanup: the full `.tile-check`/`.tile-detach` geometry, opacity,
   transitions and hover states duplicated parity's newly-added `.person-grid .tile .tile-check`
   / `.tile-detach` family (transcribed from Vue2's own PhotosPersonDetail.vue:1263-1331) and
   have been deleted — parity now governs directly, including the background/border colors
   (Vue2's own literal fixed overlay colors, not this app's theme tokens; see
   task-5-report.md's deviations table for the token → literal-color changes this produced).
   `.tile-check-icon` survives: Vue2 sets this icon's color via an inline `color="white"` prop
   on its icon component (PhotosPersonDetail.vue:150), not a CSS rule — there is nothing for
   parity to hold, and this app's SVG needs a CSS-driven color since it isn't prop-driven. */
.tile-check-icon { color: var(--on-accent); }
</style>
