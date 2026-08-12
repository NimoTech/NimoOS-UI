<!--
  SP7-P8a-T5: 设置页容器 —— 把 T3(存储卡)、T4(AI 卡)接成一个真路由页面
  `/photos/settings`,壳照 PhotosAlbums.vue:184-276 的 AreaShell/.photos-layout/
  .photos-main 结构复制(该文件头注释已说明这层布局刻意逐视图重复、不抽公共,这里
  同样不抽)。

  回源坐标:Vue2 PhotosSettings.vue:1-36(壳 + hero + 快速导航)、:194-214(页脚 + toast)、
  :383-386(scrollTo)、:487-491(showToast,2800ms)、:497-526(mounted 取数)、
  :527-530(卸载清理)。

  ── 架构偏离登记(四条,均按项目铁律"Vue2 的 bug/结构不照抄,改正确逻辑并注释登记") ──
  1. Vue2 是 `position:fixed;inset:0;z-index:500` 的全屏 overlay,自带一份
     `<photos-sidebar>` 与自己的 topbar,靠 `open` prop 开合。New-UI 走真路由 +
     AreaShell:回主页由 AreaShell 顶栏/PhotosSidebar.side-top 提供,本页只按
     PhotosAlbums.vue 的既定结构挂**一份** PhotosSidebar(与本区每个 /photos/* 视图
     一致),不是"AreaShell 自动生成侧栏"——AreaShell.vue 本身没有侧栏概念,这层去重
     是"整页只有一份 PhotosSidebar 副本"而不是"完全不挂"。测试见下方守卫用例。
  2. 没有 `open` prop、没有 ESC 关闭、没有 `$emit('close')`——路由页靠浏览器返回键,
     与本区其它视图一致。因此也没有 Vue2 :497-501/:527-528 的全局 keydown 监听。
  3. Vue2 的 `themeMixin`/`photosThemeClass`(相册私有明暗主题开关)不迁——台账第二笔,
     整个迁移期都不做。
  4. 页脚的「Sign out」不迁(D22)——New-UI 已有全局登出
     (`src/settings/panels/AccountPanel.vue:167` → `useAuth().logout()`),Vue2 那颗
     自己手清 4 个 localStorage 键 + 跳 `/logout`,与 New-UI 登出通道不一致。

  实现记录(非四条强制登记之列,但同样是与源的可见差异,如实记录):toast 只保留文字,
  不渲染 Vue2 `photos-icon :name="toast.icon"` 那个图标——本仓相册区没有 PhotosIcon.vue
  等价物(已 grep 确认零命中),T12 PhotosFilterChip.vue 头注释"偏离登记 1"就是同一结论
  (没有就不建一份迷你 icon 映射表)。本仓全局 toast(AppToast.vue)也是纯文字胶囊、
  没有图标,这里的视觉与本仓既有 toast 保持一致而非重建 Vue2 的图标+紫色配色。

  取数分工(接口债务,已与 T3/T4 对齐,详见两卡头注释与 task-5-report.md):
  fetchStorage() 由 PhotosStorageCard 自己在其 onMounted 里调用,本容器**不重复调用**;
  本容器 mounted 时只调用 fetchAbout/fetchRetention/fetchScanInterval/fetchAiFeatures
  这四个(Vue2 :497-526 的五个取数里去掉 loadStorage,即由子组件承接的那个)。

  `?section=` 深链:接的是 route.query.section,值只认 'storage'/'ai'(包含 Vue2
  `settings=1`"只是打开、不滚动"语义在内的其它任何值,一律忽略、不滚动)。T6 的
  「Settings · AI behavior」链接会指向 `/photos/settings?section=ai`。
  两条路径都处理(评审 Important 1,2026-08-04 补齐):①挂载时(`onMounted` +
  `nextTick`)②挂载之后 query 才变化时(不带 `immediate` 的 `watch(() =>
  route.query.section, ...)`)——后者补的是"用户已经停留在本页,手改地址栏 query 或
  未来某个页面内链接指向本页只是 section 不同"这种 vue-router 4 不会重新 mount 组件
  的场景。两条路径共用同一个 `scrollToSection`/`isSectionId` 判据,不允许各自维护
  一份白名单然后漂开。
-->
<script setup lang="ts">
import '../photos/styles/vue2-parity'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import AreaShell from '../components/shell/AreaShell.vue'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import PhotosStorageCard from '../photos/components/PhotosStorageCard.vue'
import PhotosAiCard from '../photos/components/PhotosAiCard.vue'
import { usePhotosSettingsStore } from '../photos/stores/settings'

interface ToastPayload { icon: string; text: string }

const { t, locale } = useI18n()
const route = useRoute()
const settings = usePhotosSettingsStore()

const pageRef = ref<HTMLElement | null>(null)

// Vue2 :302 —— about 取数前兜底 'NAS'。
const deviceName = computed(() => settings.about?.deviceName || 'NAS')

// Vue2 :352-361,偏离登记同 T4 AI 卡头注释「偏离登记 1」——不传 locale 会跟随系统语言
// 而非应用内选择的语言。这里显式套用 relTime.ts/PlacesRail.vue 等既有写法转 BCP-47。
// 与 lastBuiltText(T4)不同:Vue2 :359-361 这里的 catch 分支回落到空字符串而不是原始
// iso(源本身如此,照搬,不是本条的偏离)。
const librarySinceText = computed(() => {
  const iso = settings.about?.librarySince
  if (!iso) return ''
  try {
    const tag = locale.value.replace('_', '-')
    return new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(iso))
  } catch {
    return ''
  }
})

// Vue2 :383-386 —— 找不到目标元素时是 no-op,不抛错(jsdom 无 scrollIntoView 实现,
// 测试里 spy 掉即可,不需要真的滚动)。
function scrollTo(id: string): void {
  const el = pageRef.value?.querySelector('#' + id)
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// 白名单只在这一处判定,mounted 路径与"页面已停留、query 变化"路径共用同一个函数,
// 不允许各自维护一份判据然后慢慢漂开(评审 Important 1 的裁定原话)。
type SectionId = 'storage' | 'ai'
function isSectionId(v: unknown): v is SectionId {
  return v === 'storage' || v === 'ai'
}
function scrollToSection(section: unknown): void {
  if (isSectionId(section)) scrollTo(section)
}

const toast = ref<ToastPayload | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | undefined

// Vue2 :487-491 —— 承接两张卡片 @toast 上来的事件;重复触发必须先 clearTimeout 再
// 重新排定,否则第一条的定时器会提前把第二条 toast 也一并掐掉(变异验证锁住这条)。
function showToast(payload: ToastPayload): void {
  toast.value = payload
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = null }, 2800)
}

onMounted(() => {
  void settings.fetchAbout()
  void settings.fetchRetention()
  void settings.fetchScanInterval()
  void settings.fetchAiFeatures()

  void nextTick(() => scrollToSection(route.query.section))
})

// 评审 Important 1(2026-08-04):vue-router 4 对同一路由组件只 query 变化不重新
// mount——若用户已经停留在本页(比如手改地址栏 query,或未来某个页面内链接指向本页
// 只是 section 不同),仅靠 onMounted 那一次滚动够不到这种情形。这里补一个不带
// immediate 的 watch:mounted 时不重复触发(watch 默认不在装配时跑一次),只在挂载
// *之后* query 真的变化时才滚——与 mounted 路径共用同一个 scrollToSection/isSectionId
// 判据,不会各自维护一份白名单然后漂开。目标元素(#storage/#ai)是无条件渲染的静态内容,
// 不随 section 变化增删,故这里不需要像 mounted 路径那样等 nextTick。
watch(() => route.query.section, (section) => scrollToSection(section))

onUnmounted(() => {
  clearTimeout(toastTimer)
})
</script>

<template>
  <AreaShell :title="t('photosSettingsTitle')">
    <div class="photos-layout">
      <PhotosSidebar />
      <main class="photos-main">
        <div ref="pageRef" class="ps-scroll scroll">
          <div class="ps-hero">
            <h1>{{ t('photosSettingsTitle') }}</h1>
            <p>{{ t('photosSettingsHeroDesc') }}</p>
            <div class="ps-quicknav">
              <a href="#storage" @click.prevent="scrollTo('storage')">{{ t('photosSettingsNavStorage') }}</a>
              <a href="#ai" @click.prevent="scrollTo('ai')">{{ t('photosSettingsNavAi') }}</a>
            </div>
          </div>

          <PhotosStorageCard @toast="showToast" />
          <PhotosAiCard @toast="showToast" />

          <footer class="ps-footer">
            <div class="ps-footer-app">
              {{ t('photosSettingsFooterApp') }}<template v-if="settings.about?.version"> &middot; v{{ settings.about.version }}</template>
            </div>
            <div class="ps-footer-host">
              {{ t('photosSettingsRunningOn') }} {{ deviceName }}<template v-if="librarySinceText"> &middot; {{ t('photosSettingsLibrarySince') }} {{ librarySinceText }}</template>
            </div>
          </footer>
        </div>
      </main>
    </div>
  </AreaShell>

  <transition name="ps-toast">
    <div v-if="toast" class="ps-toast" data-test="settings-toast" role="status" aria-live="polite">{{ toast.text }}</div>
  </transition>
</template>

<style scoped>
/* height(不是 min-height):这一屏封顶,只有内层滚动容器滚 —— 同源修复,理由与 Vue2
   出处见 src/views/Photos.vue 同一规则处的注释。 */
.photos-layout { display: flex; gap: 16px; align-items: flex-start; height: 100%; }
.photos-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }

.ps-scroll { flex: 1 1 auto; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; padding: 4px 4px 24px; }

.ps-hero h1 { font-size: 22px; font-weight: 600; letter-spacing: -0.01em; margin: 0 0 6px; color: var(--fg); }
.ps-hero p { font-size: 13px; color: var(--fg-muted); margin: 0 0 12px; max-width: 640px; }
.ps-quicknav { display: flex; gap: 16px; }
.ps-quicknav a { color: var(--accent-text); font-size: 13px; font-weight: 500; text-decoration: none; }
.ps-quicknav a:hover { text-decoration: underline; }

.ps-footer { display: flex; flex-direction: column; gap: 2px; padding: 12px 4px 4px; }
.ps-footer-app { font-size: 12.5px; font-weight: 600; color: var(--fg); }
.ps-footer-host { font-size: 12px; color: var(--fg-muted); }

/* 评审 Important(2026-08-04,全量收尾门捕获):视觉上借用本仓全局 toast(AppToast.vue)
   的样式语言(见头注释「实现记录」),但这颗是**页面局部**的浮层,不是全局 toast 本尊——
   千万别照抄 AppToast.vue 那条"必须高于全仓所有模态遮罩"的 1100,那条硬约束只对*那一个*
   全局单例成立(docs/THEMING.md §8:"toast 必须高于全仓所有模态遮罩"里的"toast"专指
   AppToast.vue)。这里原先抄错成 1100,与全局 toast 撞层,`AppToast.zIndex.test.ts` 直接判红
   ——那条守卫是仓库级的,任何浮层只要 z-index ≥ 1100 就会被判定为"会压住全局 toast"。
   本设置页局部 toast 只需要盖住**这一页自己会渲染的东西**,按 §8 的阶梯落在"局部固定条
   60–150"这一档;但本页会挂一份 PhotosSidebar(架构偏离登记 1),它的窄屏抽屉
   `.photos-sidebar.is-drawer` 是 151(`side-scrim` 遮罩 150)——已经超出该档标称上限,是仓库
   既有事实,不是本处引入的。160 贴着清过这两个真实存在的同页浮层(151/150),同时远低于
   200 起的"区级/通用弹窗遮罩"整条band,更远低于 1100 的全局 toast,不会跟任何东西同层。
   见下方本文件内的守卫用例(锁 <1100;不锁 <1000/<200,因为约定本身只钉 toast 这一条硬线,
   其余数值是本处依据实测同页浮层做出的选择,不是仓库级不变量)。 */
.ps-toast {
  position: fixed; left: 50%; bottom: 32px; transform: translateX(-50%); z-index: 160;
  padding: 10px 18px; border-radius: 999px; border: 1px solid var(--chip-border);
  background: var(--toast-bg); color: var(--toast-fg, var(--fg)); font-size: 13px;
  box-shadow: var(--card-shadow-hi); backdrop-filter: var(--blur); white-space: nowrap;
  pointer-events: none;
}
.ps-toast-enter-active, .ps-toast-leave-active { transition: opacity 0.2s, transform 0.2s var(--ease, ease); }
.ps-toast-enter-from, .ps-toast-leave-to { opacity: 0; transform: translate(-50%, 12px); }

@media (max-width: 768px) {
  .photos-layout { gap: 0; }
}
</style>
