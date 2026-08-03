<script setup lang="ts">
// ISO 选择器弹窗 —— 官方模板半(分类过滤 + 卡片网格 + 下载三态)。
// 视觉 1:1 对 Vue2 components/KVM/OSSelector.vue 模板 :1-52(header + 分类 + 卡片网格),
// 逻辑对 filteredOS(:196-199)/getButtonClass(:251-255)/getButtonText(:257-265)/
// handleOSAction(:267-275)/selectOS(:287-290)。
//
// 本组件是纯展示层:`isos` 由页面级 useIsoList()(KvmPage,Task 8 接线)持有并作为
// props 传入,组件自己不创建 useIsoList、不订阅任何 MessageBus 事件——Vue2 的
// OSSelector 是常驻挂载的(`v-if="visible"` 在它自己的根节点上),下载进度订阅一直
// 活着,关闭弹窗不影响进度推进;New-UI 把这层状态提到页面级后,本组件降级成纯展示,
// 通过 props 拿 isos、通过 emit 上报动作(brief「为什么 isos 是 props」一节)。
//
// 自定义(本地文件浏览)区是 IsoBrowser 组件(Task 6),本组件只负责接线:透传
// isos props、把它的 select 事件转发 + 关弹窗(见下面 onLocalSelect)。
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import KvmDialog from './KvmDialog.vue'
import IsoBrowser from './IsoBrowser.vue'
import { filterByCategory } from '../util/isoMatch'
import { osIconFor } from '../util/format'
import type { IsoRow } from '../composables/useIsoList'

/** 官方模板选中后派给上层(Task 7 创建弹窗 / Task 9 VM 设置)的规范形状。
 * Task 6(本地文件浏览)selectOS 分支也产出同一个类型,`isLocal` 区分来源。
 * ⚠️ 与 brief Interfaces 块逐字一致,改动需与 Task 6/7/9 一起协调。 */
export interface SelectedOs {
  isLocal: boolean
  id: string
  name: string
  path: string
  size?: number
  recommendedVcpu?: number
  recommendedMemory?: number
  minMemory?: number
  minDisk?: number
}

const props = defineProps<{
  open: boolean
  isos: IsoRow[]
  /** 全分支评审修复(A3,已申报):ISO 下载失败的内联报错文案。''=无错误。父组件
   * (KvmPage)负责在新一轮下载开始前 / 关闭本弹窗时清空——本组件自己不管什么时候清,
   * 只管显示,与 CreateVmDialog/VmSettingsDialog 的 submitError 是同一套契约。
   * 为什么不走全局 toast:本组件的遮罩是 z-index 920(见下面 `<KvmDialog :z-base="920">`),
   * 全局 toast 是 z-index 60(src/components/AppToast.vue:12)——下载失败通常发生在
   * 用户正盯着这个弹窗里的百分比时,toast 会被这层遮罩完全盖住,卡片本身又只是从
   * "12.34%" 悄悄退回"下载"(不像下载成功那样卡片会翻绿,还有个兜底视觉),净效果是
   * 用户没有任何可见的失败解释。Vue2 能用 buefy toast 是因为它的 toast z-index 高于
   * 它自己的 modal,这里 z 轴关系相反,不能照抄。 */
  downloadError: string
}>()
const emit = defineEmits<{
  'update:open': [v: boolean]
  select: [os: SelectedOs]
  download: [id: string]
  /** 点了正在下载的卡片 —— 视图层弹「请等待下载完成」,本组件不管怎么弹,只上报动作。 */
  'need-wait': []
}>()

const { t } = useI18n()

// 照 Vue2 osCategories(:180-185),顺序不可变(all/windows/linux/bsd)。
const CATEGORIES = [
  { key: 'all', label: 'kvmCatAll' },
  { key: 'windows', label: 'kvmCatWindows' },
  { key: 'linux', label: 'kvmCatLinux' },
  { key: 'bsd', label: 'kvmCatBsd' },
] as const

const selectedCategory = ref<string>('all')

// filterByCategory(Task 3)按 KvmISO[] 签名工作,IsoRow 结构上兼容(extends KvmISO),
// 过滤结果里的元素本来就是 IsoRow 实例,这里只是把类型标注还原回来,不是重新实现过滤。
const filtered = computed<IsoRow[]>(() => filterByCategory(props.isos, selectedCategory.value) as IsoRow[])

// 照 Vue2 getButtonClass(:251-255)。
function buttonClass(os: IsoRow): string {
  if (os._downloaded) return 'is-selected'
  if (os._downloading) return 'is-downloading-btn'
  return 'is-download'
}

// 照 Vue2 getButtonText(:257-265)——**不搬** `${mb}MB` 分支(死代码,已申报):
// 判断条件是 `os._progress >= 0`,进度非负恒真,那个分支永远到不了。
function buttonText(os: IsoRow): string {
  if (os._downloaded) return t('kvmSelect')
  if (os._downloading) return `${os._progress.toFixed(2)}%`
  return t('kvmDownload')
}

// 照 Vue2 handleOSAction(:267-275)+ selectOS(:287-290),外加 path 缺失守卫
// (Vue2 没有这层):`path` 是 `json:"path,omitempty"`,只有 status==='downloaded'
// 才会出现。真出现「已下载但无 path」时 Vue2 会把 iso:undefined 发给后端换来 400——
// 这里改正确:不 emit,不把半成品状态派发出去。
function handleAction(os: IsoRow): void {
  if (os._downloaded) {
    if (!os.path) return
    emit('select', {
      isLocal: false,
      id: os.id,
      name: os.name,
      path: os.path,
      // ⚠️ 有意不带 size(非疏漏,Task 5 遗留 Minor,补注于此免得 Task 7/9 翻错):
      // `KvmISO.size` 是展示串(例如 "676 MB"),而 `SelectedOs.size?: number` 是
      // 字节数——两者不同源、无法从前者推出合法的后者数值,硬填会把一个字符串或
      // NaN 塞进本该是字节数的字段。本地文件路径(见 IsoBrowser.vue onItemClick)
      // 才有真实的字节数(FolderEntry.size),那条分支正常带 size。
      recommendedVcpu: os.recommendedVcpu,
      recommendedMemory: os.recommendedMemory,
      minMemory: os.minMemory,
      minDisk: os.minDisk,
    })
    emit('update:open', false)
  } else if (os._downloading) {
    // 全分支评审记录的债务(A3 顺带项,不是本轮要修的缺陷,保持现状不改行为):Vue2
    // 点正在下载的卡片其实什么都不做(OSSelector.vue:268-274 `else if (os._downloading)
    // { return }`)——「请等待下载完成」那句 toast 挂在 selectOS 上,而 selectOS 只对
    // `_downloaded` 的行触发,下载中的行永远走不到那句 toast,是 Vue2 里的死代码。
    // 这里的 `need-wait` emit 把它复活成了"活着但看不见"——KvmPage.vue 确实会弹一条
    // toast(`@need-wait="toast.show(...)"`),但这个弹窗自己的遮罩是 z 920、toast 是
    // z 60,同 A3 的下载失败一样会被完全挡住。净效果与 Vue2 相同(点了没有可见反馈),
    // 所以不改行为——但 `need-wait` 这个 emit + i18n 键 `kvmWaitForDownload` + KvmPage
    // 那句 toast 接线,三者加在一起是纯粹的死重量(看着像有意设计,实际从未真正生效
    // 过),记为债务,不在本轮清理(不属于 A3 的既定范围,清理它需要决定"要不要索性
    // 删掉这条 emit"这类改动行为的问题,交给控制器/下一期裁定)。
    emit('need-wait')
  } else {
    emit('download', os.id)
  }
}

// Task 6:自定义区(本地文件浏览)选中的本地 ISO 走同一条 select 通道,同样关弹窗——
// 与上面 handleAction 的已下载分支是同一个决定(选中即关闭),只是来源不同(官方模板
// vs 本地文件),没有理由分叉成两套不同的关闭时机。
function onLocalSelect(os: SelectedOs): void {
  emit('select', os)
  emit('update:open', false)
}
</script>

<template>
  <KvmDialog
    :open="props.open"
    :title="t('kvmSelectOsTitle')"
    width="40rem"
    :z-base="920"
    @update:open="emit('update:open', $event)"
  >
    <div class="os-selector-body">
      <!-- 分类过滤。容器偏离(已申报):Vue2 用 buefy b-button,New-UI 没有 buefy → 自绘。 -->
      <div class="category-filter">
        <button
          v-for="cat in CATEGORIES"
          :key="cat.key"
          type="button"
          class="category-btn"
          :class="{ active: selectedCategory === cat.key }"
          @click="selectedCategory = cat.key"
        >
          {{ t(cat.label) }}
        </button>
      </div>

      <!-- 全分支评审修复(A3):必须在遮罩(z 920)之上、用户看得见——复用既有 .cv-error
           类(kvm.css 已有样式,不新增 CSS),放在分类 tab 与卡片网格之间,与「下载失败」
           这个动作最相关的区域挨在一起。 -->
      <p v-if="props.downloadError" class="cv-error">{{ props.downloadError }}</p>

      <section class="os-section">
        <div class="os-grid">
          <div
            v-for="os in filtered"
            :key="os.id"
            class="os-card"
            :class="{ 'is-downloaded': os._downloaded, 'is-downloading': os._downloading }"
          >
            <div class="os-icon-wrapper">
              <img :src="osIconFor(os.id)" :alt="os.name" class="os-icon" />
            </div>
            <div class="os-info">
              <span class="os-name">{{ os.name }}</span>
              <span class="os-version">{{ os.version }}</span>
              <span class="os-size">{{ os.size }}</span>
            </div>
            <button
              type="button"
              class="os-action-btn"
              :class="buttonClass(os)"
              @click="handleAction(os)"
            >
              {{ buttonText(os) }}
            </button>
          </div>
        </div>
      </section>

      <IsoBrowser :isos="props.isos" @select="onLocalSelect" />
    </div>
  </KvmDialog>
</template>
