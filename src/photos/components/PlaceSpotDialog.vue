<script setup lang="ts">
// P6b-T4: PlaceSpotDialog.vue —— 地点详情面板里的「拍摄点」弹窗。注意它不是浮层
// (无 Esc-document 监听/无遮罩)——是 PlaceDetailPanel.vue `.detail-body` 顶部的一张
// 内嵌卡片,挂载/卸载由容器据 activeSpotKey 是否命中 spots 列表来控制。逐段照 Vue2
// NimoOS-UI src/views/Photos/PhotosPlacesView.vue:1109-1150(模板)、:290-303(watch(
// spotDialog) 退出编辑态)、:486-516(startSpotRename/saveSpotName 的 nextTick focus +
// trim)移植,样式照 photos-places.scss:620-654。
//
// 分工:纯展示 + emit,不碰 store、不发请求——容器负责真正调用 store.setSpotName /
// store.resetSpotName,并把 store.spotBusy 透传成本组件的 busy prop。
//
// 偏离登记 7(brief 原文):props.spot 不持本地副本——Vue2 靠"重新赋值 this.spotDialog
// = { spot: fresh }"这个新对象来触发 watch(spotDialog) 顺带退出编辑态;这里没有那层
// 包装对象,只有裸的 spot prop,所以：
//  · 非编辑态的名字/坐标/统计一律直接读 props.spot.*——改名成功后父级把新
//    detail.spots 传下来,这里立刻显示新值,不需要任何额外信号。
//  · 编辑态的退出由两条 watch 负责,都不做乐观退出(不在"点了保存"这个动作本身上退出,
//    只在"父级传下来的数据真的变了"这件事上退出):"props.spot.key 变化"(钉 Vue2 watch
//    :303 的语义:换了一个不同的 spot)+ "props.spot.name 变化"(评审修复 I2:钉 Vue2
//    saveSpotName :495-516 成功后立刻退出编辑态、失败保留编辑态的可见行为——name 真的
//    被 store 回写了才退,失败时 name 不变、继续编辑,不会撒谎)。
//
// 偏离登记 16(用户 2026-07-31 pre-flight 裁定,brief 原文):坐标行不再照抄 Vue2 写死的
// `° N`/`° E`(南/西半球会显示成错误方向),改用 T2 的 formatSpotCoords 按符号出 N/S/E/W。
//
// D8(用户授权新增,net-new——Vue2 完全没有这颗按钮/这条能力,只有服务层 resetSpotName
// 全仓零调用点):「恢复默认名」按钮,见下面 .spot-dialog-reset。
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { formatSpotCoords } from '../util/placesMap'
import type { PlaceSpot } from '../stores/places'

const props = defineProps<{
  spot: PlaceSpot
  busy: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'rename', name: string): void
  (e: 'reset-name'): void
  (e: 'open-library'): void
  (e: 'open-photo', assetId: string): void
}>()

const { t } = useI18n()

const editing = ref(false)
const draftName = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

// 照 Vue2 watch :303(`spotDialog() { this.spotEditing = false }`)——那条 watch 在
// Vue2 里靠"整个 spotDialog 对象被重新赋值"触发,既覆盖"打开了另一个 spot"也覆盖
// "改名成功后 loadDetail 重建了同 key 的新对象"。这里没有包装对象,只钉住"换了一个
// 不同的 spot"这一种情形(见文件头偏离登记 7)。
watch(
  () => props.spot.key,
  () => { editing.value = false },
)

// 评审修复 I2(fix round 1):回源 Vue2 saveSpotName :495-516 —— `await` 成功后立刻
// `spotEditing = false`,只有失败(catch 块空着,显式"keep editing open on failure")
// 才保留编辑态。这里没有那次网络请求的可见性(容器/store 才知道成不成功),但不能因此
// 完全没有成功退出路径——改接到真实数据上:setSpotName 成功后 store 会就地回写
// detail.spots 命中项的 name、resetSpotName 成功后 store 会 await loadDetail 重拉,
// 两条路径都会让父级传下来的 spot.name 变化;失败时 name 不变,继续保持编辑态。
// 语义等价 Vue2 的可见行为,且不会在失败时撒谎。
// 已知边角(评审已认可,不做处理):草稿改成与当前名完全相同再保存,name 不变,编辑态
// 不退(Vue2 会退——它提交时无条件设 spotEditing=false,不区分是否真的变了)。
watch(
  () => props.spot.name,
  () => { editing.value = false },
)

// 照 Vue2 startSpotRename :486-494:草稿初值 = 当前名,nextTick 后 focus 输入框。
function startRename(): void {
  draftName.value = props.spot.name
  editing.value = true
  void nextTick(() => inputRef.value?.focus())
}

function cancelRename(): void {
  editing.value = false
}

const canSubmitRename = computed(() => draftName.value.trim().length > 0 && !props.busy)

// 照 Vue2 saveSpotName :495-496 的 trim;是否真正调用后端由容器接住 rename 事件后决定。
function submitRename(): void {
  if (!canSubmitRename.value) return
  emit('rename', draftName.value.trim())
}

// 偏离登记 16:整行不渲染由 formatSpotCoords 返回空串驱动(NaN/非法值 → '')。
const coordsText = computed(() => formatSpotCoords(props.spot.lat, props.spot.lon))

const thumbSrc = computed(() =>
  props.spot.thumb ? service.photos.thumbnailUrl(props.spot.thumb, 'small') : '',
)

function onThumbClick(): void {
  if (!props.spot.thumb) return
  emit('open-photo', props.spot.thumb)
}
</script>

<template>
  <div class="spot-dialog">
    <div class="spot-dialog-head">
      <svg
        viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
        style="color: var(--accent-text); flex: none"
      ><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z" /><path d="M9 4v14M15 6v14" /></svg>
      <div style="flex:1;min-width:0">
        <div v-if="!editing" class="spot-dialog-name">
          <span class="one-line">{{ spot.name }}</span>
          <button
            type="button" class="spot-rename-btn" :title="t('photosPlacesSpotRename')"
            @click="startRename"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4 20 10M3 21l4-1 11-11-3-3L4 17z" /></svg>
          </button>
        </div>
        <div v-else class="spot-rename">
          <input
            ref="inputRef" v-model="draftName" class="spot-rename-input"
            maxlength="60" :placeholder="t('photosPlacesSpotNamePlaceholder')"
            @keyup.enter="submitRename" @keyup.esc="cancelRename"
          >
          <button
            type="button" class="spot-rename-save" :disabled="!canSubmitRename"
            @click="submitRename"
          >
            {{ t('photosPlacesSpotSave') }}
          </button>
          <button type="button" class="spot-rename-cancel" @click="cancelRename">
            {{ t('photosCancel') }}
          </button>
          <!-- D8(用户 2026-07-31 授权新增,net-new——Vue2 无此按钮,只有服务层
               resetSpotName 全仓零调用点):恢复地点默认名。 -->
          <button
            type="button" class="spot-dialog-reset" :disabled="busy"
            @click="emit('reset-name')"
          >
            {{ t('photosPlacesSpotResetName') }}
          </button>
        </div>
        <div v-if="coordsText" class="spot-dialog-coords">
          {{ coordsText }}
        </div>
      </div>
      <button type="button" class="icon-btn" @click="emit('close')">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
      </button>
    </div>

    <div class="spot-dialog-stat">
      <b>{{ spot.count }}</b> {{ t('photosPlacesPhotosShotHere') }}
    </div>

    <div class="spot-dialog-thumbs">
      <img
        v-if="spot.thumb" :src="thumbSrc" alt=""
        style="cursor: pointer" @click="onThumbClick"
      >
    </div>

    <button type="button" class="spot-dialog-btn" @click="emit('open-library')">
      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M3 14l5-4 4 3 3-2 6 5" /></svg>
      {{ t('photosPlacesSpotViewInLibrary') }}
      <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6" /></svg>
    </button>
  </div>
</template>

<style scoped>
/* token 映射(Vue2 → New-UI,同 PlaceDetailPanel.vue 文件头 §6 既定表):--text-1/2/3 →
   --fg/--fg-muted/--fg-subtle;--surface-2 → --chip-bg;--line → --card-border;
   --r-sm → --radius-sm。 */
.spot-dialog {
  margin-bottom: 16px;
  padding: 14px;
  background: var(--accent-soft);
  /* 本仓无 --accent-rgb token:Vue2 那条边框色(accent 的 rgb 值配 0.3 透明度)换成
     本仓既定 --accent-soft-bd(深色主题 .36 / 浅色主题 .30,两套主题已各自定义)。 */
  border: 1px solid var(--accent-soft-bd);
  border-radius: 12px;
}
.spot-dialog-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.spot-dialog-name { font-size: 13.5px; font-weight: 600; color: var(--fg); display: flex; align-items: center; gap: 6px; }
/* 评审修复 I1(fix round 1):Vue2 `.one-line` 是全局工具类(NimoOS-UI
   src/assets/scss/common/_others.scss:55,-webkit-box + line-clamp:1 的单行省略写法),
   但本仓每个 SFC 都是 scoped 孤岛、没有对应的全局样式表——`.one-line` 在这里此前是
   一个不生效的空壳类,长地点名会换行/溢出、挤压右侧关闭钮。补一份等价的单行省略三件套,
   同 files/viewers/ViewerShell.vue `.one-line`(:47)既有先例的写法(white-space:nowrap
   版,视觉效果与 Vue2 的 -webkit-line-clamp:1 等价,写法更简单)。与 T3 漏
   backdrop-filter 同一根因:改写 Vue2 内联/全局样式为本仓 scoped 写法时,逐条对照容易
   漏,程序化断言见 PlaceSpotDialog.test.ts。min-width:0 是 flex 子项省略生效的前提
   (否则 flex item 默认 min-width:auto,撑开而不裁切)。 */
.spot-dialog-name .one-line {
  min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.spot-dialog-coords {
  font-size: 11px; color: var(--fg-subtle);
  /* 本仓等宽字体用既有 --num-font,不照抄 Vue2 的 ui-monospace, SFMono-Regular, monospace 字体栈。 */
  font-family: var(--num-font);
  margin-top: 2px;
}
.spot-rename-btn {
  flex: none; display: inline-flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; border: none; border-radius: 6px;
  background: transparent; color: var(--fg-subtle); cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.spot-rename-btn:hover { background: var(--chip-bg); color: var(--fg); }
.spot-rename { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.spot-rename-input {
  flex: 1; min-width: 0; height: 26px; padding: 0 8px;
  /* M1(评审 fix round 1,顺手登记):Vue2 这条输入框边框写的是一个带兜底值的 accent
     半透明 token(该 token 未定义时的字面量兜底,同语义"比 accent 更浅的软边框")——
     本仓已有恰好对应语义的 --accent-soft-bd,直接换用,不是就近凑色。 */
  border: 1px solid var(--accent-soft-bd);
  border-radius: 6px; background: var(--chip-bg);
  color: var(--fg); font: inherit; font-size: 12.5px; outline: none;
}
.spot-rename-input:focus { border-color: var(--accent); }
.spot-rename-save, .spot-rename-cancel, .spot-dialog-reset {
  flex: none; height: 26px; padding: 0 10px; border-radius: 6px;
  font: inherit; font-size: 11.5px; font-weight: 500; cursor: pointer;
  border: 1px solid var(--card-border); background: transparent; color: var(--fg-muted);
}
.spot-rename-save { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
.spot-rename-save:disabled { opacity: 0.4; pointer-events: none; }
.spot-rename-cancel:hover { color: var(--fg); }
/* D8(net-new):样式复用 .spot-rename-cancel 的 ghost 形态,busy 时禁用同款处理。 */
.spot-dialog-reset:hover { color: var(--fg); }
.spot-dialog-reset:disabled { opacity: 0.4; pointer-events: none; }
.spot-dialog-stat { font-size: 11.5px; color: var(--fg-muted); margin-bottom: 10px; }
.spot-dialog-stat b { color: var(--fg); font-weight: 600; }
.spot-dialog-thumbs { display: grid; grid-template-columns: repeat(6, 1fr); gap: 3px; margin-bottom: 10px; }
.spot-dialog-thumbs img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 4px; }
.spot-dialog-btn {
  width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px;
  height: 32px; padding: 0 12px; border-radius: 8px;
  background: var(--accent); border: 0; color: var(--on-accent);
  font: inherit; font-size: 12px; font-weight: 500; cursor: pointer;
}
/* 本仓无 --accent-hi:hover 换本仓既定写法(先例 PhotosPersonDetail.vue:1142
   .pd-btn-primary:hover)。 */
.spot-dialog-btn:hover { background: var(--accent); filter: brightness(1.08); }

/* New-UI 补的最小几何:Vue2 该关闭钮靠全局 photos.scss 的 `.photos-root .icon-btn`
   (32x32,见该文件 :216-224),本组件是独立 SFC 没有那层全局类,照此弹窗内其余按钮
   (26px 高)的尺度定一份等价的 scoped 版本,不是发明新样式语言。 */
.icon-btn {
  flex: none;
  width: 26px; height: 26px;
  display: inline-flex; align-items: center; justify-content: center;
  border: none; border-radius: 6px;
  background: transparent; color: var(--fg-subtle); cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.icon-btn:hover { background: var(--chip-bg); color: var(--fg); }
</style>
