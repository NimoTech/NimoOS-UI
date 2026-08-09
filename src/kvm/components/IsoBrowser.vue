<script setup lang="ts">
// ISO 选择器弹窗 —— 自定义(本地文件浏览)半。视觉 1:1 对 Vue2 components/KVM/OSSelector.vue
// 模板 :54-93(可折叠标题条 + 面包屑 + 文件列表),逻辑对 fetchCustomDir(:304-321)/
// navigateCustomUp(:323-326)/handleCustomItemClick(:328-361)——后两者已下沉到
// useIsoBrowser composable(Task 6 本任务新增),本组件只负责渲染与把点击翻译成
// composable 调用 + 对上层 emit('select', ...)。
//
// Task 5 的 OsSelector 官方模板半是纯展示层(isos 由页面级 useIsoList 持有),但本组件
// 不同:本地目录浏览状态(当前路径/列表/loading)只在"自定义区展开"这段交互里才有意义,
// 没有跨组件复用或需要在关闭弹窗后继续推进的理由(不像 ISO 下载进度),所以让
// IsoBrowser 自己创建 useIsoBrowser() 实例,组件卸载时 dispose() 即可。
import { ref, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FolderEntry } from '@nimotech/nimoos-service'
import { useIsoBrowser } from '../composables/useIsoBrowser'
import { isIsoFile, formatFileSize, matchTemplateByFilename } from '../util/isoMatch'
import { osIconFor } from '../util/format'
import type { IsoRow } from '../composables/useIsoList'
import type { SelectedOs } from './OsSelector.vue'

const props = defineProps<{ isos: IsoRow[] }>()
const emit = defineEmits<{ select: [os: SelectedOs] }>()

const { t } = useI18n()

// 有意不解构(不写 `const { path, items, isLoading } = useIsoBrowser()`):Vue 的
// ref 自动解包(以及 vue-tsc 对模板里 ref 类型的对应窄化)只发生在"顶层 setup 绑定
// 本身就是一个 ref"这一种情况——一旦解构出 path/items/isLoading 作为顶层绑定,
// 模板里裸写 `path` 会被自动解包成 string,但显式写 `path.value` 反而会被 vue-tsc
// 当成"在 string 上取 .value"报类型错(TS2551,实测跑过);对着一个非 ref 的普通
// 对象取嵌套属性(`browser.path`)则不享受这层自动解包,`.value` 照常是合法的
// `Ref<string>` 访问。保留 `browser.xxx.value` 这种写法,类型与运行时行为一致。
const browser = useIsoBrowser()
onUnmounted(() => browser.dispose())

const expanded = ref(false)

function toggle(): void {
  expanded.value = !expanded.value
  // 照 Vue2 mounted/watch(visible)(:130-136):打开时拉取当前路径的目录内容。
  // Vue2 每次重新挂载都强制拉根目录;这里保留同样的"首次展开即拉一次"的效果——
  // path 初值就是 '/',composable 生命周期与本组件绑定,不需要额外的"是否已拉过"判断。
  if (expanded.value) browser.fetch(browser.path.value)
}

function onItemClick(item: FolderEntry): void {
  if (item.is_dir) {
    browser.fetch(item.path)
    return
  }
  // 防御性判断(非疏漏):真实数据流里 useIsoBrowser.fetch 已经把非目录/非 .iso 的
  // 条目过滤掉了,这里理论上只会收到 .iso 文件。但组件不该假设上游一定过滤干净
  // (brief Step 3 最后一条用例就是在验证这个防御,模拟"漏进来"的非 .iso 文件),
  // 命中这个分支时什么都不做,静默返回。
  if (!isIsoFile(item.name)) return

  // 照 Vue2 handleCustomItemClick(:328-357):按文件名反查模板,带出推荐规格;
  // 反查不到时 id 落 'local'、推荐规格全部 undefined。
  const tmpl = matchTemplateByFilename(item.name, props.isos)
  emit('select', {
    isLocal: true,
    id: tmpl ? tmpl.id : 'local',
    name: item.name,
    path: item.path,
    size: item.size,
    recommendedVcpu: tmpl?.recommendedVcpu,
    recommendedMemory: tmpl?.recommendedMemory,
    minMemory: tmpl?.minMemory,
    minDisk: tmpl?.minDisk,
  })
  // 注意:本组件不自己关弹窗——Vue2 的 handleCustomItemClick 命中 .iso 分支后自己调
  // this.close(),但 New-UI 把"选中后关弹窗"这个决定统一收在 OsSelector 的
  // onLocalSelect 里(与官方模板半 selectOS 走同一条路径),IsoBrowser 只管上报 select。
}
</script>

<template>
  <section class="custom-section">
    <!-- This divider is the only control that opens local ISO browsing, so a
         click-only div left keyboard users with no route in at all. It gains a
         button role, focusability and Enter/Space handling; nothing about it
         looks different. `.prevent` on Space is required — on a focusable
         element Space would otherwise scroll the dialog. -->
    <div
      class="custom-divider"
      role="button"
      tabindex="0"
      :aria-expanded="expanded"
      :aria-label="t('kvmToggleCustom')"
      @click="toggle"
      @keydown.enter.prevent="toggle"
      @keydown.space.prevent="toggle"
    >
      <span>{{ t('kvmCustom') }}</span>
      <span aria-hidden="true">{{ expanded ? '▴' : '▾' }}</span>
    </div>

    <div v-if="expanded" class="custom-browse">
      <div class="custom-breadcrumb">
        <button
          type="button"
          class="custom-back-btn"
          :disabled="browser.path.value === '/'"
          :aria-label="t('kvmParentDir')"
          @click="browser.up()"
        >
          <span aria-hidden="true">↑</span>
        </button>
        <span class="custom-path">{{ browser.path.value }}</span>
      </div>

      <div class="custom-file-list">
        <div v-if="browser.isLoading.value" class="custom-loading">
          <span class="kvm-spinner" aria-hidden="true"></span>
        </div>
        <div v-else-if="browser.items.value.length === 0" class="custom-empty">
          {{ t('kvmFolderEmpty') }}
        </div>
        <template v-else>
          <div
            v-for="item in browser.items.value"
            :key="item.path"
            class="custom-file-item"
            @click="onItemClick(item)"
          >
            <div class="custom-file-icon">
              <span v-if="item.is_dir" aria-hidden="true">▣</span>
              <img
                v-else-if="isIsoFile(item.name)"
                :src="osIconFor(item.name)"
                :alt="item.name"
                style="width: 2.25rem; height: 2.25rem; object-fit: contain;"
              />
              <span v-else aria-hidden="true">▤</span>
            </div>
            <div class="custom-file-info">
              <span class="custom-file-name">{{ item.name }}</span>
              <span v-if="!item.is_dir" class="custom-file-size">{{ formatFileSize(item.size) }}</span>
            </div>
            <span v-if="item.is_dir" class="custom-file-arrow" aria-hidden="true">▸</span>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>
