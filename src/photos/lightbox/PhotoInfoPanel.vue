<script setup lang="ts">
// EXIF/详情栏——移植自 Vue2 NimoOS-UI src/views/Photos/PhotosLightbox.vue:74-149(<aside class="lb-info">)。
// 纯展示组件:props { photo, visible },emits 无。
// delta(见 task-7-brief.md):
//   1) 删「交给 Nimo」/「Hand off to Nimo」按钮(Vue2 :84-87)——本组件不渲染任何 ask-nimo 交互。
//   2) 人物段 face chip 不引入 asset-scoped face-thumbnail(P2 尚无该接口),用文字首字母占位,同 Vue2 底子。
//   3) tags/scene/faces 在 P2 时间线路径恒为空 → 对应段落整体隐藏(v-if 挡在外层 div 上),保留结构以便后续接入真实数据后无需改模板。
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { copyText } from '../../files/util/clipboard'
import { osmEmbedSrc } from './util/osmMap'
import type { Photo } from '../util/assetToPhoto'

const props = defineProps<{ photo: Photo | null; visible: boolean }>()

const { t } = useI18n()

// —— 相机/拍摄字段格式化(照 Vue2 :95-96 的 toFixed 规则) ——
const apertureLabel = computed(() => {
  const a = props.photo?.aperture
  if (a == null || a === '') return null
  return `f/${Number(a).toFixed(1)}`
})
const focalLabel = computed(() => {
  const f = props.photo?.focal
  if (f == null || f === '') return null
  return `${Number(f).toFixed(0)} mm`
})

const hasLocation = computed(() => !!(props.photo?.latitude && props.photo?.longitude))
const mapSrc = computed(() => hasLocation.value ? osmEmbedSrc(props.photo!.latitude, props.photo!.longitude) : '')

const faces = computed(() => (props.photo?.faces as string[] | undefined) ?? [])
const tags = computed(() => (props.photo?.tags as string[] | undefined) ?? [])

// —— 复制文件路径 ——(HTTP 非安全上下文兜底走 src/files/util/clipboard.ts 既有 copyText)
const justCopied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | null = null
async function onCopyPath(): Promise<void> {
  const path = props.photo?.filePath
  if (!path) return
  try {
    await copyText(path)
    justCopied.value = true
    if (copiedTimer) clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => { justCopied.value = false; copiedTimer = null }, 2000)
  } catch {
    // 两条兜底路径都失败——静默忽略,不打断详情栏展示(与 Vue2 行为一致,未做 toast)
  }
}
</script>

<template>
  <aside v-if="visible && photo" class="info-panel scroll">
    <!-- 图片:相机与拍摄 -->
    <div v-if="!photo.isVideo" class="info-section">
      <div class="info-label">{{ t('photosInfoCameraCapture') }}</div>
      <div v-if="photo.camera" class="info-row" data-field="camera"><span class="k">{{ t('photosFieldCamera') }}</span><span class="v">{{ photo.camera }}</span></div>
      <div v-if="photo.iso" class="info-row" data-field="iso"><span class="k">{{ t('photosFieldIso') }}</span><span class="v">{{ photo.iso }}</span></div>
      <div v-if="photo.shutter" class="info-row" data-field="shutter"><span class="k">{{ t('photosFieldShutter') }}</span><span class="v">{{ photo.shutter }}</span></div>
      <div v-if="apertureLabel" class="info-row" data-field="aperture"><span class="k">{{ t('photosFieldAperture') }}</span><span class="v">{{ apertureLabel }}</span></div>
      <div v-if="focalLabel" class="info-row" data-field="focal"><span class="k">{{ t('photosFieldFocal') }}</span><span class="v">{{ focalLabel }}</span></div>
      <div v-if="photo.dim" class="info-row" data-field="dimensions"><span class="k">{{ t('photosFieldDimensions') }}</span><span class="v">{{ photo.dim }}</span></div>
      <div v-if="photo.size" class="info-row" data-field="file-size"><span class="k">{{ t('photosFieldFileSize') }}</span><span class="v">{{ photo.size }}</span></div>
    </div>

    <!-- 视频:编码/帧率/码率/旋转 -->
    <div v-if="photo.isVideo" class="info-section">
      <div class="info-label">{{ t('photosInfoVideo') }}</div>
      <div v-if="photo.duration" class="info-row" data-field="duration"><span class="k">{{ t('photosFieldDuration') }}</span><span class="v">{{ photo.duration }}</span></div>
      <div v-if="photo.dim" class="info-row" data-field="resolution"><span class="k">{{ t('photosFieldResolution') }}</span><span class="v">{{ photo.dim }}</span></div>
      <div v-if="photo.videoCodec" class="info-row" data-field="video-codec"><span class="k">{{ t('photosFieldVideoCodec') }}</span><span class="v">{{ photo.videoCodec }}</span></div>
      <div v-if="photo.audioCodec" class="info-row" data-field="audio-codec"><span class="k">{{ t('photosFieldAudioCodec') }}</span><span class="v">{{ photo.audioCodec }}</span></div>
      <div v-if="photo.frameRate" class="info-row" data-field="frame-rate"><span class="k">{{ t('photosFieldFrameRate') }}</span><span class="v">{{ photo.frameRate }}</span></div>
      <div v-if="photo.bitRate" class="info-row" data-field="bit-rate"><span class="k">{{ t('photosFieldBitRate') }}</span><span class="v">{{ photo.bitRate }}</span></div>
      <div v-if="photo.rotation" class="info-row" data-field="rotation"><span class="k">{{ t('photosFieldRotation') }}</span><span class="v">{{ photo.rotation }}°</span></div>
      <div v-if="photo.size" class="info-row" data-field="file-size"><span class="k">{{ t('photosFieldFileSize') }}</span><span class="v">{{ photo.size }}</span></div>
    </div>

    <!-- 位置:图片/视频共用 -->
    <div v-if="photo.place || photo.coords" class="info-section" data-section="location">
      <div class="info-label">{{ t('photosInfoLocation') }}</div>
      <div v-if="photo.place" class="info-row" data-field="place"><span class="k">{{ t('photosFieldPlace') }}</span><span class="v">{{ photo.place }}</span></div>
      <div v-if="photo.coords" class="info-row" data-field="coordinates"><span class="k">{{ t('photosFieldCoordinates') }}</span><span class="v">{{ photo.coords }}</span></div>
      <div v-if="hasLocation" class="map-mini">
        <iframe :src="mapSrc" title="map" loading="lazy"></iframe>
        <div class="map-pin"></div>
      </div>
    </div>

    <!-- 人物(P2 时间线路径 faces 多为空,恒隐藏本段;有数据时渲染 chip,不引入 face-thumbnail) -->
    <div v-if="faces.length > 0" class="info-section" data-section="people">
      <div class="info-label">{{ t('photosInfoPeople') }} · {{ faces.length }}</div>
      <div class="face-row">
        <div v-for="f in faces" :key="f" class="face-chip">
          <span class="face-avatar">{{ f[0] }}</span>{{ f }}
        </div>
      </div>
    </div>

    <!-- Nimo 识别(P2 时间线路径 tags/scene 恒空,隐藏本段;保留结构等后续接入) -->
    <div v-if="tags.length > 0" class="info-section" data-section="nimo-sees">
      <div class="info-label">{{ t('photosInfoNimoSees') }}<template v-if="photo.scene"> · {{ photo.scene }}</template></div>
      <div class="tag-row">
        <span v-for="tag in tags" :key="tag" class="tag-chip">{{ tag }}</span>
      </div>
    </div>

    <!-- 文件路径 + 复制 -->
    <div class="info-section">
      <div class="info-label">{{ t('photosInfoFile') }}</div>
      <div class="path-row">
        <span class="path-text">{{ photo.filePath }}</span>
        <button type="button" class="copy-btn" :title="t('photosCopyPath')" @click="onCopyPath">
          {{ justCopied ? t('photosCopied') : t('photosCopyPath') }}
        </button>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.info-panel {
  width: 360px;
  max-width: 100%;
  flex: 0 0 auto;
  box-sizing: border-box;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: var(--panel-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius);
  box-shadow: var(--panel-shadow);
  backdrop-filter: var(--blur);
  color: var(--fg);
}
.info-section { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.info-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: var(--fg-muted); }
.info-row { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; font-size: 13px; }
.info-row .k { color: var(--fg-muted); flex: 0 0 auto; }
.info-row .v { color: var(--fg); text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.map-mini { position: relative; border-radius: 10px; overflow: hidden; height: 140px; border: 1px solid var(--card-border); }
.map-mini iframe { width: 100%; height: 100%; border: none; }
.map-pin {
  position: absolute; top: 50%; left: 50%; width: 10px; height: 10px;
  transform: translate(-50%, -50%); border-radius: 50%;
  background: var(--accent); box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 30%, transparent);
  pointer-events: none;
}

.face-row, .tag-row { display: flex; flex-wrap: wrap; gap: 8px; }
.face-chip {
  display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px 4px 4px;
  border-radius: 999px; font-size: 12px; color: var(--fg); background: var(--chip-bg);
}
.face-avatar {
  display: inline-flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; border-radius: 50%; font-size: 11px; font-weight: 600;
  color: var(--fg); background: color-mix(in srgb, var(--accent) 30%, transparent);
}
.tag-chip { display: inline-flex; padding: 4px 10px; border-radius: 999px; font-size: 12px; color: var(--fg); background: var(--chip-bg); }

.path-row { display: flex; align-items: center; gap: 8px; }
.path-text { flex: 1 1 auto; min-width: 0; font-size: 12px; color: var(--fg-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.copy-btn {
  flex: 0 0 auto; font-size: 12px; padding: 4px 10px; border-radius: 8px;
  border: 1px solid var(--card-border); background: transparent; color: var(--fg); cursor: pointer;
}
.copy-btn:hover { background: var(--chip-bg-hi); }

/* 窄屏:桌面态右栏 → 底部浮层/全宽覆盖(独立浮层,不接 useSidebarDrawer——那是侧栏专用) */
@media (max-width: 768px) {
  .info-panel {
    position: fixed; left: 0; right: 0; bottom: 0; top: auto;
    width: auto; max-height: 70vh;
    border-radius: var(--radius) var(--radius) 0 0;
    border-bottom: none;
  }
}
</style>
