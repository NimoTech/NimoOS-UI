<script setup lang="ts">
// 设置 · 文件夹权限。1:1 对位 Vue2 NimoOS-UI/src/components/settings/FolderPermissions.vue(337 行)。
//
// ⚠️ **spec §5.7 把这块写成「权限矩阵(表头 / 行 / 各子系统列的开关)」,与源码不符** ——
// Vue2 实际是**四个纵向堆叠的分区**(文件名索引 / 知识库 / 禁止 AI 访问的文件夹 / 照片),
// 各自一份列表,没有矩阵表头也没有列。按 P0 先例「spec 与源码出入时以源码为准、界面严格 1:1」
// 照源码做四分区(plan C3)。
//
// ⚠️ 本期按 spec §3.1 **政策三**只做界面骨架:数据源是 folderPermissionsSnapshot.ts 的空实现
// (四路全 offline),写操作禁用。合并 sp7/sp8 后只换那个文件里的两个函数(债务 D11)。
// 空快照四路 offline 正好复用 Vue2 的「服务离线」形态,不另造空态。
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SettingsSection from '../components/SettingsSection.vue'
import FolderPickerDialog from './folderPerm/FolderPickerDialog.vue'
import type { FolderPermSnapshot } from '../util/folderPermissions'
import { emptySnapshot, fetchSnapshot, WIRED } from '../util/folderPermissionsSnapshot'
import {
  aiItems, knowledgeExcludeItems, knowledgeRootItems, photosItems, searchItems,
} from '../util/folderPermissionsView'
import { pickerRoots } from '../util/folderBrowser'
import '../styles/settings.css'

const { t } = useI18n()

const snap = ref<FolderPermSnapshot>(emptySnapshot())
const loading = ref(false)

// 就地过期守卫(不抽公共 helper —— 评审判定过早抽象,plan C8)。本面板**确实有第二个触发点**
// (刷新按钮),所以守卫不是空转:快速连点刷新 / 点完立刻切 tab 时,后落定的那次不许回写。
let alive = true
let seq = 0
onUnmounted(() => {
  alive = false
})

async function reload() {
  const mySeq = ++seq
  loading.value = true
  try {
    const s = await fetchSnapshot()
    if (!alive || mySeq !== seq) return
    snap.value = s
  } finally {
    if (alive && mySeq === seq) loading.value = false
  }
}
onMounted(reload)

const offline = computed(() => snap.value.offline)
const photosAuto = computed(() => snap.value.photos.auto && !snap.value.photos.stale)
const photosStale = computed(() => snap.value.photos.stale)
const lists = computed(() => ({
  search: searchItems(snap.value),
  knowledgeRoots: knowledgeRootItems(snap.value),
  knowledgeExcludes: knowledgeExcludeItems(snap.value),
  ai: aiItems(snap.value),
  photos: photosItems(snap.value),
}))
const browserRoots = computed(() => pickerRoots(snap.value.candidates))

// 添加弹窗:本期只开得起来、确认按钮恒 disabled(政策三)。target 保留 Vue2 的 5 种取值,
// 接线时直接照 Vue2 confirmAdd()(L304-323)的分流写。
type AddTarget = 'search' | 'knowledge-root' | 'knowledge-exclude' | 'ai' | 'photos'
const adding = ref(false)
const addTarget = ref<AddTarget>('search')
function openAdd(target: AddTarget) {
  addTarget.value = target
  adding.value = true
}
const addTitle = computed(() =>
  addTarget.value === 'knowledge-exclude' ? t('settingsFpAddExclusion') : t('settingsFpAddFolder'),
)
</script>

<template>
  <SettingsSection :title="t('settingsTabFolderPermissions')">
    <!-- 顶部:Vue2 L3-8 的说明 + 刷新按钮 -->
    <div class="set-fp-head">
      <p class="set-fp-intro">{{ t('settingsFpIntro') }}</p>
      <button class="set-btn" type="button" data-test="fp-refresh" :disabled="loading" @click="reload">
        ⟳
      </button>
    </div>

    <!-- 本期新增(Vue2 没有):政策三要求在界面上标注数据源留空 -->
    <p v-if="!WIRED" class="set-info" data-test="fp-pending">{{ t('settingsFpDataPending') }}</p>

    <!-- ① 文件名索引 (Vue2 L10-36) -->
    <div class="set-fp-box">
      <div class="set-fp-box-head">
        <span class="set-fp-title">{{ t('settingsFpFilenameIndex') }}</span>
        <span v-if="offline.search" class="set-fp-tag" data-test="fp-offline">{{ t('settingsFpServiceOffline') }}</span>
        <button v-else class="set-btn" type="button" data-test="fp-add-search" @click="openAdd('search')">
          + {{ t('settingsFpAddFolder') }}
        </button>
      </div>
      <p class="set-fp-desc">{{ t('settingsFpFilenameDesc') }}</p>
      <template v-if="!offline.search">
        <!-- D11 接线时补:!coveredBy 的行要有删除按钮 → run(path,'search',false)(Vue2 L30) -->
        <div v-for="it in lists.search" :key="`s-${it.path}`" class="set-fp-item">
          <span class="set-fp-path">{{ it.path }}</span>
          <span v-if="it.coveredBy" class="set-fp-tag">{{ t('settingsFpCoveredBy', { p: it.coveredBy }) }}</span>
        </div>
        <p v-if="!lists.search.length" class="set-fp-empty">{{ t('settingsFpNoFolders') }}</p>
      </template>
    </div>

    <!-- ② 知识库 (Vue2 L38-81) -->
    <div class="set-fp-box">
      <div class="set-fp-box-head">
        <span class="set-fp-title">{{ t('settingsFpKnowledge') }}</span>
        <span v-if="offline.knowledge" class="set-fp-tag" data-test="fp-offline">{{ t('settingsFpServiceOffline') }}</span>
      </div>
      <p class="set-fp-desc">{{ t('settingsFpKnowledgeDesc') }}</p>
      <template v-if="!offline.knowledge">
        <div class="set-fp-sub-head">
          <span class="set-fp-sub-title">{{ t('settingsFpIndexedFolders') }}</span>
          <button class="set-btn" type="button" data-test="fp-add-knowledge-root" @click="openAdd('knowledge-root')">
            + {{ t('settingsFpAddFolder') }}
          </button>
        </div>
        <!-- D11 接线时补:每行一个开关 → run(path,'knowledge',v)(Vue2 L58-61) -->
        <div v-for="it in lists.knowledgeRoots" :key="`kr-${it.rootId}`" class="set-fp-item">
          <span class="set-fp-path">{{ it.path }}</span>
        </div>
        <p v-if="!lists.knowledgeRoots.length" class="set-fp-empty">{{ t('settingsFpNoFolders') }}</p>

        <div class="set-fp-sub-head">
          <span class="set-fp-sub-title">{{ t('settingsFpExcludedSubfolders') }}</span>
          <button class="set-btn" type="button" data-test="fp-add-knowledge-exclude" @click="openAdd('knowledge-exclude')">
            + {{ t('settingsFpAddExclusion') }}
          </button>
        </div>
        <!-- D11 接线时补:每行一个删除按钮 → removeDenyRule(it.id)(Vue2 L75) -->
        <div v-for="it in lists.knowledgeExcludes" :key="`ke-${it.id}`" class="set-fp-item">
          <span class="set-fp-path">{{ it.path }}</span>
        </div>
        <p v-if="!lists.knowledgeExcludes.length" class="set-fp-empty">{{ t('settingsFpNoExclusions') }}</p>
      </template>
    </div>

    <!-- ③ 禁止 AI 访问的文件夹 (Vue2 L83-115) -->
    <div class="set-fp-box">
      <div class="set-fp-box-head">
        <span class="set-fp-title">{{ t('settingsFpAiHidden') }}</span>
        <span class="set-fp-tag">{{ t('settingsFpCurrentUserOnly') }}</span>
        <span v-if="offline.ai" class="set-fp-tag" data-test="fp-offline">{{ t('settingsFpServiceOffline') }}</span>
        <button v-else class="set-btn" type="button" data-test="fp-add-ai" @click="openAdd('ai')">
          + {{ t('settingsFpAddFolder') }}
        </button>
      </div>
      <p class="set-fp-desc">{{ t('settingsFpAiDesc') }}</p>
      <template v-if="!offline.ai">
        <!-- D11 接线时补:每行一个删除按钮 → run(path,'ai',true)(Vue2 L106) -->
        <div v-for="it in lists.ai.items" :key="`a-${it.id}`" class="set-fp-item">
          <span class="set-fp-path">{{ it.path }}</span>
          <span v-if="it.coveredBy" class="set-fp-tag">{{ t('settingsFpCoveredBy', { p: it.coveredBy }) }}</span>
        </div>
        <p v-if="!lists.ai.items.length" class="set-fp-empty">{{ t('settingsFpNoAiBlocked') }}</p>
        <p v-if="lists.ai.globCount" class="set-fp-desc">
          {{ t('settingsFpGlobRules', { n: lists.ai.globCount }) }}
        </p>
      </template>
    </div>

    <!-- ④ 照片 (Vue2 L117-155) -->
    <div class="set-fp-box">
      <div class="set-fp-box-head">
        <span class="set-fp-title">{{ t('settingsFpPhotos') }}</span>
        <span v-if="offline.photos" class="set-fp-tag" data-test="fp-offline">{{ t('settingsFpServiceOffline') }}</span>
        <span v-else-if="photosStale" class="set-fp-tag">{{ t('settingsFpUpdateRequired') }}</span>
        <button v-else-if="!photosAuto" class="set-btn" type="button" data-test="fp-add-photos" @click="openAdd('photos')">
          + {{ t('settingsFpAddFolder') }}
        </button>
      </div>
      <p class="set-fp-desc">{{ t('settingsFpPhotosDesc') }}</p>
      <template v-if="!offline.photos && !photosStale">
        <p v-if="photosAuto" class="set-info">{{ t('settingsFpPhotosAuto') }}</p>
        <!-- D11 接线时补:非 auto 且 !coveredBy 的行要有删除按钮 → run(path,'photos',false)
             (Vue2 L143);photosAuto 时底部还有「转为手动管理」按钮 → materialize()(L148) -->
        <div v-for="it in lists.photos" :key="`p-${it.path}`" class="set-fp-item">
          <span class="set-fp-path">{{ it.path }}</span>
          <span v-if="it.coveredBy" class="set-fp-tag">{{ t('settingsFpCoveredBy', { p: it.coveredBy }) }}</span>
        </div>
        <p v-if="!lists.photos.length" class="set-fp-empty">{{ t('settingsFpNoFolders') }}</p>
      </template>
      <p v-else-if="photosStale" class="set-fp-desc">{{ t('settingsFpPhotosStale') }}</p>
    </div>

    <FolderPickerDialog v-model:open="adding" :title="addTitle" :roots="browserRoots" />
  </SettingsSection>
</template>
