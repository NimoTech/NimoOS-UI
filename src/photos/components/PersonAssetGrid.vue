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

.person-month { margin-bottom: 28px; }
.person-month-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 4px 0 10px;
}
.person-month-head .title {
  font-family: var(--font);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--fg);
}
.person-month-head .sub {
  color: var(--fg-muted);
  font-size: 12px;
}
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

/* 照 photos-people.scss:492-500 —— 固定 8 列 + 3px 圆角,与 PhotosGrid 的响应式
   auto-fill/density 契约刻意不同(brief 记账理由②)。 */
.person-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 3px;
}

.tile {
  position: relative;
  aspect-ratio: 1;
  border-radius: 3px;
  overflow: hidden;
  cursor: pointer;
  background: var(--chip-bg);
}
.tile img { width: 100%; height: 100%; object-fit: cover; display: block; }
.tile[data-selected="true"] { outline: 3px solid var(--accent); outline-offset: -3px; }
/* 终审 Minor 3:Vue2 :1222 —— 选中的瓦片把图压暗一档。原实现只有 accent 描边,选中/未选中在
   一屏缩略图里对比太弱。 */
.tile[data-selected="true"] img { opacity: 0.85; }

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

/* 终审 Minor 3(几何逐条回 Vue2 :1184-1215 核对后对齐):20×20 / 偏移 6px / **2px** 描边 /
   勾 12px —— 原实现是 18×18 / 4px / 1px / 10px,整体偏小一档且描边太细,在 8 列小瓦片上
   与「移出」按钮几乎分不出体量差。描边由 var(--card-border) 改回钉死的半透明浅色:这个圈叠在
   不可控的人脸照片上,随主题的描边在浅色主题下会变成浅底浅边、直接消失(同本组件其它前景元素
   的"配色红线"处理,见文件头)。 */
.tile-check {
  position: absolute; top: 6px; left: 6px; z-index: 2;
  display: flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; padding: 0;
  /* theme-exception: 叠在照片上的选择圈描边,需跨主题恒定浅色(照 Vue2 :1195) */
  border: 2px solid rgba(255, 255, 255, 0.85);
  border-radius: 50%;
  background: var(--overlay-bg);
  cursor: pointer;
  /* 照 Vue2 PhotosPersonDetail.vue:1199-1208 —— 默认透明,只在 hover/选择态可见,不是
     永久叠在每张缩略图上(同本仓已确立先例 PhotosGrid.vue:374-376 .tile-check-box)。
     Vue2 原文只靠 opacity 隐藏、未加 :focus-visible 覆盖,键盘 tab 仍能聚焦到隐藏态的
     按钮——这是 Vue2 自带的可访问性缺口,照搬登记,不在本任务范围内补(未申报的新增
     范围)。 */
  opacity: 0;
  transform: scale(0.85);
  /* background/border-color 也要过渡 —— 下面 :hover 与选中态都改这两个属性(照 Vue2 :1202) */
  transition: opacity 0.15s, transform 0.15s, background 0.15s, border-color 0.15s;
}
.tile:hover .tile-check,
.tile[data-selection-mode="true"] .tile-check,
.tile[data-selected="true"] .tile-check {
  opacity: 1;
  transform: scale(1);
}
/* 终审 Minor 3:Vue2 :1209-1212 的**按钮自身 hover 变深**。原实现整格 hover 只让按钮从透明
   淡入,鼠标压在按钮本体上没有任何反馈 —— 认不出它是个可点的控件。 */
.tile-check:hover {
  /* theme-exception: 在叠照片的半透明底上再掺一档黑加深,掺入量是固定观感调校值、与主题无关
     (同 PersonHero.vue .hero-back:hover 掺白提亮的既有先例,方向相反而已) */
  background: color-mix(in srgb, var(--overlay-bg) 65%, #000 35%);
  /* theme-exception: hover 时描边提到全不透明白(照 Vue2 :1211) */
  border-color: #fff;
}
.tile[data-selected="true"] .tile-check {
  /* 选中态背景切到饱和 --accent 实底(不再叠在照片上,是组件自己控制的纯色)——这正是
     --on-accent 合法使用的前提场景(任务颜色红线:--on-accent 只在 var(--accent) 饱和
     实底上可用),与未选中态(半透明叠在照片上,须钉死浅色前景)刻意区分,不是疏漏。 */
  background: var(--accent);
  border-color: var(--accent);
}
.tile-check-icon { color: var(--on-accent); }

/* 终审 Minor 3(几何逐条回 Vue2 :1148-1181 核对后对齐):22×22 / 偏移 6px / 1px 半透明浅色描边
   / backdrop-filter —— 原实现是 18×18 / 4px / 无描边 / 无模糊。 */
.tile-detach {
  position: absolute; top: 6px; right: 6px; z-index: 2;
  display: flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; padding: 0;
  /* theme-exception: 叠在照片上的移出按钮描边,需跨主题恒定半透明浅色(照 Vue2 :1156,
     同 PersonAvatar.vue .person-avatar-fav 的既有先例) */
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 50%;
  background: var(--overlay-bg);
  /* 照 Vue2 :1165 —— 半透明底之上再糊一层,免得照片高频细节从按钮里透出来 */
  backdrop-filter: var(--blur);
  cursor: pointer;
  /* 照 Vue2 PhotosPersonDetail.vue:1162-1171 —— 默认透明,只在 .tile:hover 时可见;
     不像 .tile-check 那样受 selectionMode/selected 强制可见(Vue2 原文只给 tile-check
     加了那两条强制可见规则,tile-detach 没有——照搬,不是遗漏)。 */
  opacity: 0;
  transform: scale(0.9);
  transition: opacity 0.15s, transform 0.15s, background 0.15s, color 0.15s, border-color 0.15s;
  /* theme-exception: 同 .tile-vid——叠在照片上的移出按钮,恒定浅色前景。透明度 0.85 照
     Vue2 :1157(不是全白):默认态刻意比 hover 态弱一档。 */
  color: rgba(255, 255, 255, 0.85);
}
.tile:hover .tile-detach {
  opacity: 1;
  transform: scale(1);
}
/* 终审 Minor 3:Vue2 :1172-1177 的**按钮自身 hover 变危险色**。这是本组件唯一的破坏性动作
   (把照片从这个人物身上摘掉),缺了这一步它跟旁边的选择圈只有位置差别 —— 终审原话:
   叠加起来会让这个「×」认不出是删除键。--remove-bg 是本仓已有的实底危险红
   (两套主题都定义,theme.css:165/254;同 theme.css:392 `.grid-item .remove` 的既有用法)。 */
.tile-detach:hover {
  background: var(--remove-bg);
  border-color: transparent;
  /* theme-exception: 危险红实底之上的白色图标,同 theme.css:392 的既有惯例,不用
     --on-accent(它只在 var(--accent) 饱和实底上可用,这里背景不是 accent)。 */
  color: #fff;
}
</style>
