<script setup lang="ts">
// 头像裁剪 —— 对位 Vue2 AccountPanel state 4(:746-760)+ saveAvatar(:442-462)。
// 左 220×220 裁剪框(1:1 方形 stencil,输出 160×160 canvas),右 80×80 圆形预览 + 「预览」字样。
//
// ⚠️ 后端 PUT /v1/users/avatar 只 strip `data:image/png;base64,` 这一种前缀,且解码失败会
// log.Fatal 打死 UserService(全集群 JWT 失效、所有人重新登录;systemd 会 100ms 拉起)。
// canvas.toDataURL() 无参默认就是 PNG —— **不要加 'image/jpeg' 之类参数**。
// 本期这条写路径在开发机上一次都没真发过(plan D 表 / 债务 D27),覆盖靠单测。
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Cropper, Preview } from 'vue-advanced-cropper'
import 'vue-advanced-cropper/dist/style.css'
import { service } from '@nimotech/nimoos-service'
import '../../styles/settings.css'

const props = defineProps<{ src: string }>()
const { t } = useI18n()

const result = ref<{ coordinates: unknown; image: unknown; canvas: HTMLCanvasElement | null }>({
  coordinates: null,
  image: null,
  canvas: null,
})
const busy = ref(false)
const error = ref('')

function onChange(payload: { coordinates: unknown; image: unknown; canvas: HTMLCanvasElement }) {
  result.value = payload
}

// Vue2 defaultSize(:383-388):优先可见区域,其次整图尺寸。
function defaultSize({ imageSize, visibleArea }: {
  imageSize: { width: number; height: number }
  visibleArea?: { width: number; height: number }
}) {
  const s = visibleArea || imageSize
  return { width: s.width, height: s.height }
}

async function submit(): Promise<boolean> {
  if (busy.value) return false
  const canvas = result.value.canvas
  // 🔧 Vue2 直接 `this.result.canvas.toDataURL()` —— 用户没动过裁剪框时 canvas 是 null,
  // 会抛 TypeError 被 .catch 吞成笼统的「更新失败」。这里显式早退(plan C1「吞错不照抄」)。
  if (!canvas) return false
  busy.value = true
  error.value = ''
  try {
    await service.users.saveAvatar(canvas.toDataURL())
    return true
  } catch (e) {
    const r = e as { response?: { data?: { message?: string } }; message?: string }
    error.value = r?.response?.data?.message || r?.message || String(e)
    return false
  } finally {
    busy.value = false
  }
}
defineExpose({ submit })
</script>

<template>
  <div class="set-acc-crop">
    <div class="set-acc-crop-box">
      <Cropper
        :src="props.src" :debounce="false" :stencil-props="{ aspectRatio: 1 }" check-orientation
        :min-height="80" :min-width="80" :canvas="{ height: 160, width: 160 }"
        :default-size="defaultSize" @change="onChange"
      />
    </div>
    <div class="set-acc-crop-preview">
      <Preview :width="80" :height="80" :image="result.image" :coordinates="result.coordinates" />
      <p class="set-acc-crop-label">{{ t('settingsAccPreview') }}</p>
    </div>
    <p v-if="error" class="set-danger" data-test="acc-crop-error">{{ error }}</p>
  </div>
</template>

<style scoped>
.set-acc-crop { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; }
/* Vue2 .cropper-wrapper 是 220×220、底色是一层两成不透明的黑 → 换成 token(C4)。
   ⚠️ 注释里也不能写颜色字面量 —— color-guard.test.ts **不剥注释**,写了就翻红。 */
.set-acc-crop-box {
  width: 220px; height: 220px; flex: 0 0 auto; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  background: var(--overlay-bg);
}
.set-acc-crop-preview { text-align: center; }
/* Vue2 .preview { border-radius: 50% } —— 库内部结构,用 :deep 穿透 */
.set-acc-crop-preview :deep(.vue-preview) { border-radius: 50%; overflow: hidden; }
.set-acc-crop-label { margin: 8px 0 0; font-size: 13px; color: var(--fg-muted); }
</style>
