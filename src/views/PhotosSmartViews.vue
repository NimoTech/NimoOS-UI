<script setup lang="ts">
// SP7-P7a-T4: PhotosSmartViews.vue —— 智能视图列表页(壳 + AI 横幅 + hero + 网格 + 新建卡)。
// 逐段照 Vue2 NimoOS-UI src/views/Photos/PhotosSmartViewsView.vue:14-38(列表部分,
// 详情/弹窗部分归其余任务)、内联横幅 :15-19、hero :22-30、网格 :31-38 移植;
// 样式照 photos-smartview.scss:4-25(hero/create-btn/grid)+ :118-145(create-card)。
// 壳照 PhotosPeople.vue 头部注释的既定形态复制(AreaShell/.photos-layout/PhotosSidebar/
// .photos-main,含 ≤768px 的 gap:0),不抽公共(P3/P4 既定)。
//
// 本任务范围(brief 结构规格 1-9):
//  1) 外壳
//  2) AI 横幅——`aiSmartViewOff` 的读法照 PhotosPeople.vue:379 的 P5 先例(onMounted 直读
//     一次 getConfig,缺字段/失败一律按开启处理,不吓用户)。
//  3) hero(标题 + 副标题 + 创建按钮)
//  4) 网格(SmartViewCard v-for + 末尾新建卡)
//  5) 加载态用骨架(New-UI 新增,Vue2 没有);listLoaded 且空列表时**不加空态**——那张
//     新建卡本身就是这页的空态(照 Vue2 的信息层级,登记见 task-4-report.md)。
//  6) 创建弹窗挂载点:T5 才建。本任务只留 `createOpen` state + 两个入口 @click 置真 +
//     一条 TODO 注释指向 T5,模板里不挂弹窗组件。
//
// 偏离登记:
//  1) Vue2 :15 的横幅链接是 <a href="javascript:void(0)">,点击 $emit('open-settings',
//     'ai')。New-UI 设置页归 P8(尚不存在),渲染成不可点的 <span aria-disabled="true">,
//     title 走新增键 photosSvSettingsPending(「设置页待迁移(P8)」)—— P8 接线点在此,
//     届时把这个 span 换成真链接/路由跳转。
//  2) Vue2 :19 在链接文字后还有一个裸英文句点(`</a>.`),中文界面下会中西混排且不在
//     任何可翻译串里——不复制(同 PhotosPeople.vue 偏离登记 7 的先例)。
//  3) 横幅琥珀色:Vue2 是内联 rgba(255,159,10,…)/#FF9F0A 字面量,这里改用本仓既有的
//     --dem-fg/--dem-bg/--dem-bd 家族(grep theme.css 已确认两套主题都有取值,PhotosTrash.vue
//     的 warn 语义已是这套 token 的既定先例,不新增 token)。
//  4) .sv-create-btn 背景:Vue2 是 linear-gradient(135deg, var(--accent), var(--accent-hi))
//     渐变,本仓没有 --accent-hi(Global Constraints §33),改用 var(--accent) 实底 +
//     hover 时 filter: brightness(1.08)(照 PhotosPersonDetail.vue:1142 等既有先例)。
//     fix round 1 · I2:这条只解释了背景色的替换,**不覆盖** Vue2 hover 态的
//     transform: translateY(-1px)(上浮)——那是与颜色 token 无关的独立视觉属性,
//     之前被静默丢了,已在样式块补回(两者可共存)。
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { service } from '@nimotech/nimoos-service'
import AreaShell from '../components/shell/AreaShell.vue'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import SmartViewCard from '../photos/components/SmartViewCard.vue'
import { usePhotosSmartViews } from '../photos/stores/smartViews'

const { t } = useI18n()
const router = useRouter()
const store = usePhotosSmartViews()

// aiFeatures.smartview 的临时来源:本仓没有 settings store(归 P8),onMounted 直接读一次
// /photos/config。失败或字段缺失一律按开启处理(宁可不吓用户),照 PhotosPeople.vue:376-386
// 的 loadFacesEnabled 先例。
const aiSmartViewOff = ref(false)

// T5 才建的创建弹窗。本任务只留 state + 两个入口置真,模板里不挂弹窗组件(brief 第 6 条,
// 控制器补充 1)。TODO(T5): 挂 <SmartViewCreateDialog v-model:open="createOpen" @created="..." />。
const createOpen = ref(false)
function openCreate(): void {
  createOpen.value = true
}

function onCardOpen(id: string): void {
  router.push('/photos/smart-views/' + id)
}

// 测试观测点:T4 不挂真弹窗(T5 才建),没有 DOM 可断言"弹窗真的开了"——照
// PlacesMap.vue 的既有 defineExpose 先例,暴露这个 ref 供测试直接读取,而不是新增一个
// 纯为了测试存在的隐藏 DOM 标记节点。T5 接上真弹窗后,这个 ref 仍会是 v-model:open 的
// 绑定目标,defineExpose 可以留着或按 T5 实际需要收窄。
defineExpose({ createOpen })

async function loadAiSmartViewOff(): Promise<void> {
  try {
    const cfg = await service.photos.getConfig()
    const ai = cfg?.aiFeatures as { smartview?: unknown } | undefined
    aiSmartViewOff.value = ai?.smartview === false
  } catch (e) {
    console.error('[photos-smartviews] getConfig', e)
    aiSmartViewOff.value = false
  }
}

onMounted(() => {
  void store.fetchSmartViews()
  void loadAiSmartViewOff()
})
</script>

<template>
  <AreaShell :title="t('photosTitle')">
    <div class="photos-layout">
      <PhotosSidebar />
      <main class="photos-main">
        <!-- ── AI 横幅(Vue2 :15-19,内联 style 改 class)── -->
        <div v-if="aiSmartViewOff" class="svs-banner" data-test="svs-ai-banner">
          <div class="svs-banner-icon">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
          </div>
          <div class="svs-banner-body">
            <div class="svs-banner-title">{{ t('photosSvSmartViewsAutoUpdate') }}</div>
            <div class="svs-banner-desc">
              {{ t('photosSvTheseSavedSearchesStay') }}
              <!-- 偏离登记 1:设置页归 P8,不可点;偏离登记 2:不复制 Vue2 链接后的裸英文句点。 -->
              <span
                class="svs-banner-link"
                aria-disabled="true"
                data-test="svs-settings-link"
                :title="t('photosSvSettingsPending')"
              >{{ t('photosPeopleFacesOffLink') }}</span>
            </div>
          </div>
        </div>

        <!-- ── hero(Vue2 :22-30)── -->
        <div class="sv-hero">
          <div class="sv-hero-text">
            <h1>{{ t('photosSvSmartViews') }}</h1>
            <p>{{ t('photosSvSavedSearchesStayLive') }}</p>
          </div>
          <button type="button" class="sv-create-btn" data-test="sv-hero-create" @click="openCreate">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/></svg>
            {{ t('photosSvCreateSmartView') }}
          </button>
        </div>

        <!-- ── 加载态骨架(New-UI 新增,Vue2 没有这层概念,登记见 task-4-report.md)── -->
        <div v-if="store.listLoading && !store.listLoaded" class="sv-grid" data-test="sv-skeleton">
          <div v-for="i in 6" :key="i" class="sv-skel-card"></div>
        </div>

        <!-- ── 网格(Vue2 :31-38)── listLoaded 且空列表时不加独立空态,新建卡本身就是空态。 -->
        <div v-else class="sv-grid">
          <SmartViewCard v-for="sv in store.smartViews" :key="String(sv.id)" :sv="sv" @open="onCardOpen" />
          <div class="sv-create-card" data-test="sv-create-card" @click="openCreate">
            <div class="plus">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            </div>
            <h3>{{ t('photosSvNewSmartView') }}</h3>
            <p>{{ t('photosSvDescribeWantSetQuality') }}</p>
          </div>
        </div>
      </main>
    </div>
  </AreaShell>
</template>

<style scoped>
.photos-layout { display: flex; gap: 16px; align-items: flex-start; min-height: 100%; }
.photos-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }

/* ── AI 横幅(Vue2 内联 :15-19 → --dem-fg 家族,先例:PhotosTrash.vue .trash-bucket-dot
     [data-tone="warn"])── */
/* fix round 1 · I1:Vue2 是 `margin: 24px 32px 0`(横幅在 .sv-page 内部,.sv-page 本身已有
   32px 横向 padding,横幅又加 32px margin ⇒ 距页面边缘 64px,比 .sv-hero/.sv-grid(两者都
   无横向 margin,停在 32px)多缩进一层——刻意的视觉层级:"这是一条附加提示,层级低于页面
   主体")。本仓容器是 .area-body(桌面态 padding:20px)而非 Vue2 的 32px,照抄字面 32px
   不等于照抄视觉——这里保留 Vue2 的**额外缩进量** 32px 作为 margin-left/right,使横幅比
   hero/网格多缩进 32px,维持与 Vue2 相同的相对关系。上边距照抄 Vue2 的 24px。下边距
   Vue2 是 0(与 hero 顶边贴合,因为 .sv-hero 无 margin-top)——这里不照抄 0,保留 20px
   间距(偏离登记:纯 0 会让横幅与 hero 标题在视觉上过于贴近,20px 是本页其余区块间距
   的既定量级,判断为可安全登记的偏离,不是静默改掉)。 */
.svs-banner {
  margin: 24px 32px 20px; padding: 14px 16px;
  background: var(--dem-bg); border: 1px solid var(--dem-bd); border-radius: 10px;
  display: flex; gap: 10px; align-items: flex-start;
}
.svs-banner-icon {
  width: 26px; height: 26px; border-radius: 7px;
  background: color-mix(in srgb, var(--dem-fg) 18%, transparent); color: var(--dem-fg);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px;
}
.svs-banner-title { font-size: 12.5px; font-weight: 600; color: var(--dem-fg); }
.svs-banner-desc { font-size: 11.5px; color: var(--fg-muted); margin-top: 3px; line-height: 1.5; }
/* 不可点的设置链接标注(偏离登记 1):保留 Vue2 视觉上的强调下划线,但不是 <a>。 */
.svs-banner-link { color: var(--accent-text); text-decoration: underline; cursor: default; }

/* ── hero(scss:5-19)── */
.sv-hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 28px; }
.sv-hero-text h1 { font-size: 26px; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 4px; color: var(--fg); }
.sv-hero-text p { font-size: 13.5px; color: var(--fg-muted); margin: 0; max-width: 520px; line-height: 1.5; }
.sv-create-btn {
  display: inline-flex; align-items: center; gap: 6px; flex: 0 0 auto;
  padding: 9px 16px; border-radius: 99px; border: 0;
  background: var(--accent); color: var(--on-accent);
  font: inherit; font-weight: 500; font-size: 13px; cursor: pointer;
}
/* fix round 1 · I2:Vue2 scss:20 的 hover 效果是 `transform: translateY(-1px)`(按钮上浮)——
   这是与颜色 token 无关的独立视觉属性,之前只补了本仓 primary 按钮 hover 的既定变亮写法
   (`filter: brightness(1.08)`,理由见文件头部偏离登记 4:渐变改实色因本仓无 --accent-hi),
   把 Vue2 的上浮效果静默丢了。两者不冲突,这里补回。 */
.sv-create-btn:hover { background: var(--accent); filter: brightness(1.08); transform: translateY(-1px); }

/* ── 网格(scss:21-25)── */
.sv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; flex: 1 1 auto; }

/* 骨架卡片(New-UI 新增) */
.sv-skel-card { aspect-ratio: 16 / 9; border-radius: var(--radius-sm); background: var(--skeleton-bg); }

/* ── 新建卡(scss:118-143)── */
.sv-create-card {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  border: 1.5px dashed var(--card-border); background: transparent;
  border-radius: var(--radius-sm); padding: 40px 20px; text-align: center; cursor: pointer;
  min-height: 280px;
}
.sv-create-card:hover { border-color: var(--accent); background: var(--accent-soft); }
.sv-create-card .plus {
  width: 44px; height: 44px; border-radius: 50%;
  background: var(--accent); color: var(--on-accent);
  display: flex; align-items: center; justify-content: center; margin-bottom: 12px;
}
.sv-create-card h3 { font-size: 14px; font-weight: 600; margin: 0 0 4px; color: var(--fg); }
.sv-create-card p { font-size: 12px; color: var(--fg-muted); margin: 0; max-width: 200px; line-height: 1.4; }

/* ≤768px:侧栏已收抽屉,布局单列 */
@media (max-width: 768px) {
  .photos-layout { gap: 0; }
}
</style>
