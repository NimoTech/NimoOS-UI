<script setup lang="ts">
// 从 NAS 选头像 —— 对位 Vue2 AccountPanel state 6(:763-846)。
// 两个视图:存储卡网格(nasView='storages')与目录浏览(nasView='browse')。
// **整块只读**:storage.list / raid.list / folder.getList / <img> 取 /v1/image,可放心在真机点。
//
// 🔧 plan C11:Vue2 选中图片后走 axios arraybuffer → Blob → createObjectURL,只为嗅探 mime,
// 而那个 mime **模板里零引用**(死代码)→ 这里直接把 /v1/image?...&type=original 当 <img src>
// (同源,cropper 能用),少一层内存拷贝、也不产生需要 revoke 的 objectURL。
// 🔧 Vue2 loadNasFolder 查的是 `res.data?.success === 200`(v1 信封),而共享包 folder.getList
// 已经 unwrap 过、直接给 FolderListing → **不要再查 success**,失败由 axios reject。
import { computed, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { mapVolumes } from '../../../storage/util/storageMap'
import { renderSize } from '../../../files/util/format'
import {
  buildNasStorages, filterNasItems, nasBreadcrumbs, nasNavigateUpTarget,
  type NasStorage,
} from '../../util/nasStorages'
import '../../styles/settings.css'

// SP11: the payload carries both halves because the two consumers need different
// ones -- the avatar cropper wants a displayable URL, the wallpaper picker needs
// the on-disk NAS path to hand to PUT /users/current/image/wallpaper.
const emit = defineEmits<{ pick: [{ path: string; src: string }] }>()
const { t } = useI18n()

const view = ref<'storages' | 'browse'>('storages')
const storages = ref<NasStorage[]>([])
const storagesLoading = ref(false)
const items = ref<{ name: string; path: string; is_dir: boolean }[]>([])
const itemsLoading = ref(false)
const error = ref('')
const nasPath = ref('')
const nasRootPath = ref('')
const displayNames = ref<Record<string, string>>({})

// 就地代际守卫(不抽公共 helper,plan C8)。列目录 ~百毫秒级,而用户点面包屑 / 上一层 /
// 目录都能在途时再发一次 —— 「前一次还在飞、后一次已回来」是真实路径,用 seq 区分同一组件的
// 前后两次请求(alive 布尔区分不了这个)。
let alive = true
let seq = 0
onUnmounted(() => {
  alive = false
})

async function loadStorages() {
  storagesLoading.value = true
  error.value = ''
  try {
    // Vue2 :278-281 用 $api.storage.list()(**无参**,不是 AppsPanel 的 {system:'show'})+
    // raid.list() 单独 catch 成空 —— RAID 取不到不该拖垮整屏。照抄。
    const [rawStorage, rawRaid] = await Promise.all([
      service.storage.list(),
      service.raid.list().catch(() => [] as unknown[]),
    ])
    if (!alive) return
    // displayNames:只映射**非根**挂载点(它们的名字就是卷 label)。
    // ⚠️ 为什么不把根卷的 label 映射到 "/DATA"(AppsPanel.vue:87-95 是那么做的):
    // Vue2 的 displayNames 来自专用端点 `GET /v2/nimoos/local_storage/display_names`,
    // 不是从卷 label 派生的。2026-08-01 实测该端点在本机返回
    //   {"data":{"/DATA":"NimoOS-HD"},"message":""}   ← 注意信封只有 data+message,**没有 success**
    // 也就是说 `/DATA` 的真实显示名**正好等于** Vue2 写死的兜底值 'NimoOS-HD'。
    // 而 local_storage 域按 SP6 定案不进共享包、本期(spec §5.7)也只补 users 域 →
    // 这里不发那个请求,让 /DATA 走 buildNasStorages 里的 'NimoOS-HD' 兜底,真机效果逐字一致。
    // ⚠️ `/DATA` 必须**种进 map**,不能只靠 buildNasStorages 里的兜底:面包屑走的是
    // nasBreadcrumbs → toVirtualPath(nasRootPath, displayNames),它没有那个兜底,
    // /DATA 不在 map 里时面包屑会显示成 `DATA` 而 Vue2 真机显示 `NimoOS-HD`(1:1 不符)。
    // 这里种的就是上面 curl 到的真实值。
    // 遗留:若用户把系统盘改过名,这张卡与面包屑会显示 'NimoOS-HD' 而不是自定义名(债务)。
    const map: Record<string, string> = { '/DATA': 'NimoOS-HD' }
    for (const v of mapVolumes(rawStorage)) {
      if (!v.mountPoint || v.mountPoint === '/') continue
      map[v.mountPoint] = v.name || v.mountPoint
    }
    displayNames.value = map
    storages.value = buildNasStorages(rawStorage, rawRaid, map)
  } catch (e) {
    if (!alive) return
    const r = e as { message?: string }
    error.value = r?.message || t('settingsAccLoadFolderFailed')
    storages.value = []
  } finally {
    if (alive) storagesLoading.value = false
  }
}
loadStorages()

async function openFolder(path: string) {
  const mySeq = ++seq
  itemsLoading.value = true
  error.value = ''
  try {
    const res = await service.folder.getList(path)
    if (!alive || mySeq !== seq) return
    nasPath.value = path
    items.value = filterNasItems(res?.content)
  } catch {
    if (!alive || mySeq !== seq) return
    error.value = t('settingsAccLoadFolderFailed')
    items.value = []
  } finally {
    if (alive && mySeq === seq) itemsLoading.value = false
  }
}

function enterStorage(s: NasStorage) {
  nasRootPath.value = s.path
  view.value = 'browse'
  openFolder(s.path)
}

function backToStorages() {
  view.value = 'storages'
  nasPath.value = ''
  nasRootPath.value = ''
  items.value = []
  error.value = ''
}

function up() {
  const target = nasNavigateUpTarget(nasPath.value, nasRootPath.value)
  if (!target) return // 已在根,Vue2 :348 也是直接 return,不发请求
  openFolder(target)
}

const crumbs = computed(() => nasBreadcrumbs(nasPath.value, nasRootPath.value, displayNames.value))
const atRoot = computed(() => nasPath.value === nasRootPath.value)

function onItemClick(item: { path: string; is_dir: boolean }) {
  if (item.is_dir) openFolder(item.path)
  else emit('pick', { path: item.path, src: service.image.imageUrl(item.path, 'original') })
}

function sizeText(s: NasStorage): string {
  return `${renderSize((s.size || 0) - (s.avail || 0))} / ${renderSize(s.size || 0)}`
}

defineExpose({ backToStorages, openFolder, view })
</script>

<template>
  <div class="set-acc-nas">
    <!-- ── 存储卡网格 (Vue2 L766-789) ── -->
    <template v-if="view === 'storages'">
      <p v-if="storagesLoading" class="set-fp-empty">…</p>
      <p v-else-if="error" class="set-danger">{{ error }}</p>
      <div v-else class="set-nas-grid">
        <button
          v-for="s in storages" :key="s.path" class="set-nas-card" type="button"
          data-test="nas-storage" @click="enterStorage(s)"
        >
          <span class="set-nas-name">{{ s.name }}</span>
          <span v-if="s.size" class="set-nas-sub">{{ sizeText(s) }}</span>
        </button>
      </div>
    </template>

    <!-- ── 目录浏览 (Vue2 L792-844) ── -->
    <template v-else>
      <div class="set-nas-toolbar">
        <button
          class="set-btn" type="button" :aria-label="t('settingsAccBack')"
          data-test="nas-back" @click="backToStorages"
        >‹</button>
        <div class="set-nas-crumbs" data-test="nas-crumbs">
          <!-- Vue2 :803 的 `i < len-1 &&` 守卫照抄:最后一段不可点 -->
          <span
            v-for="(c, i) in crumbs" :key="c.path" class="set-nas-crumb"
            :class="{ active: i === crumbs.length - 1 }" data-test="nas-crumb"
            @click="i < crumbs.length - 1 && openFolder(c.path)"
          >{{ c.name }}<span v-if="i < crumbs.length - 1" class="set-nas-crumb-sep">/</span></span>
        </div>
        <button
          class="set-btn" type="button" :disabled="atRoot" aria-label="↑"
          data-test="nas-up" @click="up"
        >↑</button>
      </div>

      <p v-if="itemsLoading" class="set-fp-empty">…</p>
      <p v-else-if="error" class="set-danger">{{ error }}</p>
      <p v-else-if="!items.length" class="set-fp-empty">{{ t('settingsAccNoImagesHere') }}</p>
      <div v-else class="set-nas-items">
        <button
          v-for="it in items" :key="it.path" class="set-nas-item" type="button"
          data-test="nas-item" @click="onItemClick(it)"
        >
          <!-- 这里是**类型标记**(不是操作按钮),保留彩色 emoji:Vue2 用的也是彩色 mdi 图标
               (folder 橙、image 紫)。⚠️ headless 截图里会显示成空方框(缺 emoji 字形),
               真实浏览器正常 —— 已列进验收清单。 -->
          <span class="set-nas-item-icon" aria-hidden="true">{{ it.is_dir ? '📁' : '🖼' }}</span>
          <span class="set-nas-item-name">{{ it.name }}</span>
        </button>
      </div>
    </template>
  </div>
</template>
