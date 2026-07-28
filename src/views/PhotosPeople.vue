<script setup lang="ts">
// Task 6 (SP7-P5 人物): 人物列表视图 —— 横幅 + 置信度下拉 + 筛选/排序行 + 两条警告横幅 +
// 合并建议横幅 + Pinned/Named/Unnamed 三分区网格 + 浮动操作菜单 + 空态。
// 逐段对照 Vue2 NimoOS-UI src/views/Photos/PhotosPeopleView.vue:2-235 与
// src/views/Photos/photos-people.scss:1-275 移植;Ask Nimo 分支照 brief 不建。
// 壳照 PhotosAlbums.vue:185-188 的 AreaShell/.photos-layout/PhotosSidebar/.photos-main 复制
// (不抽公共,P3/P4 既定)。document 级监听照 PhotosAlbums.vue:159-181。
//
// 本任务不做:三态操作弹窗(T7)与合并建议审阅弹窗(T8)。菜单三项/Review 只把状态写进
// `dialog` / `reviewOpen`+`reviewIdx`,模板里各留一个隐藏的 v-if 占位节点(T7/T8 会把它
// 换成真实弹窗);路由注册与侧栏条目归 T16。
//
// 偏离 Vue2 登记(Vue2 的 bug 不照抄):
//  1) Vue2 本页的 toast 是坏的:PhotosPeopleView.vue:441 默认导入了没有对应 export 的
//     photosToast.js,四处 PhotosToast.show(...) 实际抛 TypeError。本任务范围内没有
//     toast 调用点(菜单只置状态),故这里不引 useToast;T7/T8 落弹窗时一律用本仓 useToast()。
//  2) Vue2 完全没有 Esc 关闭(三个浮层全靠点外部)。这里按本仓浮层规范补 document keydown。
//  3) Vue2 :8-10 的第二个分隔点无条件渲染,facesIndexedUpTo 为空时会留一个悬空的圆点。
//     这里把它与索引日期段一起 v-if,不复制这个视觉残留。
//  4) Vue2 :96-97 把「设置 · AI 行为」渲染成 <a href="#">,点了 $emit('open-settings')。
//     New-UI 设置页归 P8,渲染为强调文本(非链接),不留点不动的假链接。
//  5) Vue2 :575-579 的索引日期写死 'en' locale;这里跟随 i18n locale(偏离登记 9)。
//  6) 铁律:一切「当前项 === 循环项」「按 id 找对象」用 String 值比较,不用引用相等。
//
// 缺 i18n 键(未新增,报给协调者,见 task-6-report.md):
//  a) Vue2 :24-26 置信度下拉顶部的小标题 "Min face match score" —— 无对应键,本次不渲染。
//  b) Vue2 :204 未命名卡片悬停文案 "+ Name / Merge / Delete" —— 无对应键,本次不渲染;
//     连带不复制 scss:243 的 `:hover .ct { display:none }`(否则悬停整行变空白)。
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { service } from '@nimotech/nimoos-service'
import AreaShell from '../components/shell/AreaShell.vue'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import PersonAvatar from '../photos/components/PersonAvatar.vue'
import { usePhotosPeople } from '../photos/stores/people'
import { useTimelineStore } from '../photos/stores/timeline'
import {
  mergeConfidencePct, mergeReasonKey, sortNamed, unnamedCountAt, type Person,
} from '../photos/util/peopleView'

type FilterId = 'all' | 'family' | 'friend' | 'work' | 'recent'
type SortId = 'freq' | 'name' | 'recent' | 'oldest'
type DialogMode = 'name' | 'merge' | 'delete'

const { t, locale } = useI18n()
const router = useRouter()
const people = usePhotosPeople()
const timeline = useTimelineStore()

// Vue2 :448
const CONFIDENCE_OPTIONS = [50, 60, 70, 80, 90, 95]

// Vue2 data() :461-472。sort 刻意不持久化(照 Vue2);confidence/showSingletons 在 store 里持久化。
const filter = ref<FilterId>('all')
const sort = ref<SortId>('freq')
const showUnnamed = ref(true)
const confidenceOpen = ref(false)
const sortOpen = ref(false)
const clusterMenu = ref<{ person: Person; x: number; y: number } | null>(null)
// T7 三态弹窗状态 / T8 审阅弹窗状态 —— 本任务只写不读(模板里各有一个隐藏占位节点)。
const dialog = ref<{ mode: DialogMode; person: Person } | null>(null)
const reviewOpen = ref(false)
const reviewIdx = ref(0)
// aiFeatures.faces 的临时来源:本仓没有 settings store(归 P8),onMounted 直接读一次
// /photos/config。失败或字段缺失一律按 true(不显示警告横幅,宁可不吓用户)。
const facesEnabled = ref(true)

const confMenuRef = ref<HTMLElement | null>(null)
const sortMenuRef = ref<HTMLElement | null>(null)
const clusterMenuRef = ref<HTMLElement | null>(null)

// 随 locale 热切换重新求值(照 PhotosAlbums.vue:52-60 的既有教训:computed 而非常量固化一份)。
const sortOptions = computed(() => [
  { id: 'freq' as SortId, label: t('photosPeopleSortFreq'), hint: t('photosPeopleSortFreqHint') },
  { id: 'name' as SortId, label: t('photosPeopleSortName'), hint: t('photosPeopleSortNameHint') },
  { id: 'recent' as SortId, label: t('photosPeopleSortRecent'), hint: t('photosPeopleSortRecentHint') },
  { id: 'oldest' as SortId, label: t('photosPeopleSortOldest'), hint: t('photosPeopleSortOldestHint') },
])
const filterChips = computed(() => [
  { id: 'all' as FilterId, label: t('photosPeopleFilterAll'), count: people.named.length },
  { id: 'family' as FilterId, label: t('photosPeopleFilterFamily'), count: relationCount('family') },
  { id: 'friend' as FilterId, label: t('photosPeopleFilterFriends'), count: relationCount('friend') },
  { id: 'work' as FilterId, label: t('photosPeopleFilterWork'), count: relationCount('work') },
  // recent 刻意无计数徽标(照 Vue2 :57-59)
  { id: 'recent' as FilterId, label: t('photosPeopleFilterRecent'), count: null },
])

function relationCount(rel: string): number {
  return people.named.filter((p) => p.relation === rel).length
}

// Vue2 :493-508。排序/关系筛选走 T1 的 sortNamed(不在视图里重写)。
const filteredNamed = computed(() => sortNamed(people.named, filter.value, sort.value, Date.now()))
const pinned = computed(() => filteredNamed.value.filter((p) => p.favorite))
const others = computed(() => filteredNamed.value.filter((p) => !p.favorite))
const filteredUnnamed = computed(() => people.visibleUnnamed)
const currentSort = computed(() => sortOptions.value.find((s) => s.id === sort.value) ?? sortOptions.value[0])
// New-UI 补齐的空态(Vue2 没有):只在确认拉取成功且真的零人物时出现,失败态不冒充空。
const isEmpty = computed(() => people.peopleLoaded && people.people.length === 0)

const firstSuggestion = computed(() => people.mergeSuggestions[0] ?? null)
const mergeReasonText = computed(() => {
  const r = mergeReasonKey(firstSuggestion.value as { confidence?: unknown; intoName?: unknown } | null)
  return t(r.key, r.params)
})
function suggestionId(k: 'fromId' | 'intoId'): string | number | null {
  const s = firstSuggestion.value
  const v = s ? (s[k] as string | number | undefined) : undefined
  return v ?? null
}
// 头像缓存击穿版本号 = 该人物的 coverFaceId(Vue2 :560-563 的 avatarUrl 同语义,但这里
// 只取 ver,URL 由 PersonAvatar 内部经 service 生成)。找不到该人物就传 null。
function verOf(id: string | number | null): string | number | null {
  return id == null ? null : (people.personById(id)?.coverFaceId ?? null)
}

// Vue2 :575-580,偏离登记 5:跟随 i18n locale('zh_cn' → BCP47 'zh-cn'),非法日期返回 ''。
function formatIndexedDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const tag = locale.value.replace('_', '-')
  return new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'short', day: 'numeric' }).format(d)
}

// 下拉里每档旁的预览计数(Vue2 :581-584)——单照片按当前开关值算,不模拟切换。
function previewCount(v: number): number {
  return unnamedCountAt(people.unnamed, v, people.filter.showSingletons)
}

function pickConfidence(v: number): void {
  confidenceOpen.value = false
  people.setConfidence(v)
}
function pickSort(id: SortId): void {
  sort.value = id
  sortOpen.value = false
}
function toggleSingletons(): void {
  people.setShowSingletons(!people.filter.showSingletons)
}
function openPerson(p: Person): void {
  // Vue2 是 $emit('open', p.id) 页内切换,New-UI 走真路由(T16 注册)。
  router.push('/photos/people/' + p.id)
}
function openClusterMenu(p: Person, e: MouseEvent): void {
  e.stopPropagation()
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  clusterMenu.value = { person: p, x: rect.left + rect.width / 2, y: rect.bottom + 8 }
}
// Vue2 :624-643 的三个 openXxxDialog 只有 mode 不同,这里收成一个。
function openDialog(mode: DialogMode): void {
  const p = clusterMenu.value?.person ?? null
  clusterMenu.value = null
  if (!p) return
  dialog.value = { mode, person: p }
}
function openReview(): void {
  reviewIdx.value = 0
  reviewOpen.value = true
}

// ── document 级浮层监听(Vue2 mounted :525-540 的 _onDoc + 本仓补的 Esc)──
function onDocMousedown(e: MouseEvent): void {
  const target = e.target as Node
  if (confidenceOpen.value && confMenuRef.value && !confMenuRef.value.contains(target)) confidenceOpen.value = false
  if (sortOpen.value && sortMenuRef.value && !sortMenuRef.value.contains(target)) sortOpen.value = false
  if (clusterMenu.value && clusterMenuRef.value && !clusterMenuRef.value.contains(target)) clusterMenu.value = null
}
function onDocKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  if (clusterMenu.value) { clusterMenu.value = null; return }
  if (confidenceOpen.value) { confidenceOpen.value = false; return }
  if (sortOpen.value) sortOpen.value = false
}

async function loadFacesEnabled(): Promise<void> {
  try {
    const cfg = await service.photos.getConfig()
    const ai = cfg?.aiFeatures as { faces?: unknown } | undefined
    facesEnabled.value = ai?.faces !== false
  } catch (e) {
    // 失败按开启处理:宁可不显示警告,也不要因为一次配置读取抖动就吓用户。
    console.error('[photos-people] getConfig', e)
    facesEnabled.value = true
  }
}

onMounted(() => {
  // Vue2 :526-527 每次进页面都重拉,不做 loaded 去重,照搬。
  void people.fetchPeople()
  void people.fetchMergeSuggestions()
  void loadFacesEnabled()
  document.addEventListener('mousedown', onDocMousedown)
  document.addEventListener('keydown', onDocKeydown)
})
onUnmounted(() => {
  document.removeEventListener('mousedown', onDocMousedown)
  document.removeEventListener('keydown', onDocKeydown)
})
</script>

<template>
  <AreaShell :title="t('photosPeople')">
    <div class="photos-layout">
      <PhotosSidebar />
      <main class="photos-main">
        <!-- ── 横幅(Vue2 :3-42)── -->
        <div class="people-banner">
          <div class="people-banner-text">
            <h1>{{ t('photosPeople') }}</h1>
            <div class="people-sub" data-test="people-sub">
              <span>{{ t('photosPeopleNamed', { n: people.named.length }) }}</span>
              <span class="sep"></span>
              <span>{{ t('photosPeopleUnnamedClusters', { n: filteredUnnamed.length }) }}</span>
              <!-- 偏离登记 3:分隔点与索引日期同进同退,不留悬空圆点 -->
              <template v-if="people.facesIndexedUpTo">
                <span class="sep"></span>
                <span data-test="people-indexed">
                  {{ t('photosPeopleIndexedUpTo', { date: formatIndexedDate(people.facesIndexedUpTo) }) }}
                </span>
              </template>
            </div>
          </div>
          <div class="people-banner-actions">
            <div ref="confMenuRef" class="people-pop-wrap">
              <button type="button" class="bar-btn" data-test="conf-btn" @click.stop="confidenceOpen = !confidenceOpen">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h18l-7 8v6l-4 2v-8z"/></svg>
                {{ t('photosPeopleConfidence', { n: people.filter.confidence }) }}
                <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
              </button>
              <div v-if="confidenceOpen" class="people-menu people-menu-conf" data-test="conf-menu">
                <button
                  v-for="v in CONFIDENCE_OPTIONS" :key="v"
                  type="button"
                  class="people-menu-item"
                  data-test="conf-option"
                  :data-value="v"
                  :data-active="v === people.filter.confidence"
                  @click="pickConfidence(v)"
                >
                  <span class="check">{{ v === people.filter.confidence ? '✓' : '' }}</span>
                  <span class="lbl">{{ t('photosPeopleConfidenceOption', { n: v }) }}</span>
                  <span class="tail" data-test="conf-count">{{ t('photosPeopleClusters', { n: previewCount(v) }) }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- ── 筛选行(Vue2 :44-84)── -->
        <div class="people-filters">
          <button
            v-for="c in filterChips" :key="c.id"
            type="button"
            class="people-chip"
            data-test="filter-chip"
            :data-filter="c.id"
            :data-active="filter === c.id"
            @click="filter = c.id"
          >
            {{ c.label }}
            <span v-if="c.count !== null" class="ct" data-test="chip-count">{{ c.count }}</span>
          </button>
          <div class="people-filters-spacer"></div>
          <div ref="sortMenuRef" class="people-pop-wrap">
            <button type="button" class="people-chip" data-test="sort-btn" @click.stop="sortOpen = !sortOpen">
              {{ t('photosPeopleSort', { label: currentSort.label }) }}
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <div v-if="sortOpen" class="people-menu people-menu-sort" data-test="sort-menu">
              <button
                v-for="s in sortOptions" :key="s.id"
                type="button"
                class="people-menu-item is-stacked"
                data-test="sort-item"
                :data-sort-id="s.id"
                :data-active="s.id === sort"
                @click="pickSort(s.id)"
              >
                <span class="check">{{ s.id === sort ? '✓' : '' }}</span>
                <span class="stack-text">
                  <span class="lbl">{{ s.label }}</span>
                  <span class="hint">{{ s.hint }}</span>
                </span>
              </button>
            </div>
          </div>
        </div>

        <!-- ── 正文(Vue2 :86-235)── -->
        <div class="people-body">
          <!-- 两条警告横幅互斥(Vue2 :87-113);mlReady 三态:null=未知,不告警 -->
          <div v-if="!facesEnabled" class="merge-banner is-warn" data-test="warn-faces-off">
            <div class="icon-wrap">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
            </div>
            <div class="body">
              <div class="title">{{ t('photosPeopleFacesOffTitle') }}</div>
              <div class="desc">
                {{ t('photosPeopleFacesOffBody') }}
                <!-- 偏离登记 4:设置页归 P8,这里是强调文本而非可点链接 -->
                <span class="em">{{ t('photosPeopleFacesOffLink') }}</span>
              </div>
            </div>
          </div>
          <div v-else-if="timeline.indexStatus.mlReady === false" class="merge-banner is-warn" data-test="warn-ml-offline">
            <div class="icon-wrap">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
            </div>
            <div class="body">
              <div class="title">{{ t('photosPeopleMlOfflineTitle') }}</div>
              <div class="desc">{{ t('photosPeopleMlOfflineBody') }}</div>
            </div>
          </div>

          <!-- 合并建议横幅:独立 v-if,可与警告横幅同时出现(照 Vue2 :115) -->
          <div v-if="people.mergeSuggestions.length > 0" class="merge-banner" data-test="merge-banner">
            <div class="icon-wrap">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/><path d="M18 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/></svg>
            </div>
            <div class="body">
              <div class="title">{{ t('photosPeopleMergeFound', { n: people.mergeSuggestions.length }) }}</div>
              <div class="desc">{{ mergeReasonText }}</div>
            </div>
            <div class="stack">
              <div class="stack-dot"><PersonAvatar :person-id="suggestionId('fromId')" :ver="verOf(suggestionId('fromId'))" :size="28" /></div>
              <div class="stack-dot"><PersonAvatar :person-id="suggestionId('intoId')" :ver="verOf(suggestionId('intoId'))" :size="28" /></div>
            </div>
            <button type="button" class="bar-btn people-btn-primary" data-test="merge-review" @click="openReview">
              {{ t('photosPeopleMergeReview') }}
            </button>
            <button
              type="button"
              class="people-icon-btn"
              data-test="merge-dismiss"
              :aria-label="t('photosPeopleMergeDismissAll')"
              @click="people.dismissAllMerges()"
            >&#215;</button>
          </div>

          <div v-if="isEmpty" class="empty-state" data-test="people-empty">
            <div class="empty-state-title">{{ t('photosPeopleEmptyTitle') }}</div>
            <div class="empty-state-desc">{{ t('photosPeopleEmptyHint') }}</div>
          </div>

          <template v-else>
            <!-- Pinned(Vue2 :129-150)-->
            <div class="section-head" data-test="section-pinned">
              <h2>{{ t('photosPeoplePinned') }}</h2>
              <span class="sub">{{ t('photosPeoplePinnedHint') }}</span>
            </div>
            <div class="face-grid-lg">
              <div
                v-for="p in pinned" :key="p.id"
                class="face-card"
                data-test="pinned-card"
                :data-id="p.id"
                @click="openPerson(p)"
              >
                <PersonAvatar :person-id="p.id" :name="p.name" :ver="p.coverFaceId" :size="124" :fav="true" />
                <div class="name">{{ p.name }}</div>
                <div class="meta">{{ t('photosPeoplePhotosCount', { n: p.count.toLocaleString() }) }}</div>
              </div>
            </div>

            <!-- Named(Vue2 :152-174)-->
            <div class="section-head" data-test="section-named">
              <h2>{{ t('photosPeopleNamedSection') }}</h2>
              <span class="sub">{{ t('photosPeopleNamedHint', { n: others.length }) }}</span>
            </div>
            <div class="face-grid-md">
              <div
                v-for="p in others" :key="p.id"
                class="face-card"
                data-test="named-card"
                :data-id="p.id"
                @click="openPerson(p)"
              >
                <PersonAvatar :person-id="p.id" :name="p.name" :ver="p.coverFaceId" :size="84" />
                <div class="name-row" data-test="named-name-row">
                  <span class="name">{{ p.name }}</span>
                  <span class="meta">{{ p.count.toLocaleString() }}</span>
                </div>
              </div>
            </div>

            <!-- Unnamed(Vue2 :176-206)-->
            <div class="section-head" data-test="section-unnamed">
              <h2>{{ t('photosPeopleUnnamedSection') }}</h2>
              <span class="sub">{{ t('photosPeopleUnnamedHint', { n: filteredUnnamed.length }) }}</span>
              <div class="section-actions">
                <button
                  v-if="showUnnamed && (people.hiddenSingletonCount > 0 || people.filter.showSingletons)"
                  type="button"
                  class="more"
                  data-test="singleton-toggle"
                  @click="toggleSingletons"
                >
                  {{ people.filter.showSingletons
                    ? t('photosPeopleHideSingle')
                    : t('photosPeopleShowSingle', { n: people.hiddenSingletonCount }) }}
                </button>
                <button type="button" class="more" data-test="unnamed-toggle" @click="showUnnamed = !showUnnamed">
                  {{ showUnnamed ? t('photosPeopleHide') : t('photosPeopleShow') }}
                </button>
              </div>
            </div>
            <div v-if="showUnnamed" class="cluster-grid" data-test="cluster-grid">
              <div
                v-for="p in filteredUnnamed" :key="p.id"
                class="cluster-card"
                data-test="cluster-card"
                :data-id="p.id"
                @click="openClusterMenu(p, $event)"
              >
                <PersonAvatar :person-id="p.id" :name="p.name" :ver="p.coverFaceId" :size="72" dashed />
                <!-- 角标必须是头像圆环的兄弟节点:圆环 overflow:hidden 会把它裁掉(Vue2 :201)-->
                <div class="badge" data-test="cluster-badge">{{ mergeConfidencePct(p.confidence) }}%</div>
                <div class="ct">{{ t('photosPeoplePhotosCount', { n: p.count }) }}</div>
              </div>
            </div>
          </template>
        </div>
      </main>
    </div>
  </AreaShell>

  <!-- 浮动操作菜单(Vue2 :208-234)。position:fixed,放在 AreaShell 之外避免被祖先的
       backdrop-filter 变成包含块(同 PhotosAlbums.vue 把模态放在壳外的先例)。 -->
  <div
    v-if="clusterMenu"
    ref="clusterMenuRef"
    class="cluster-menu"
    data-test="cluster-menu"
    :style="{ left: clusterMenu.x + 'px', top: clusterMenu.y + 'px' }"
  >
    <button type="button" class="cluster-menu-item" data-test="menu-name" @click="openDialog('name')">
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>
      <span>{{ t('photosPersonNameThis') }}</span>
    </button>
    <button type="button" class="cluster-menu-item" data-test="menu-merge" @click="openDialog('merge')">
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/></svg>
      <span>{{ t('photosPersonMergeExisting') }}</span>
    </button>
    <button type="button" class="cluster-menu-item is-danger" data-test="menu-delete" @click="openDialog('delete')">
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>
      <span>{{ t('photosPersonDeleteCluster') }}</span>
    </button>
  </div>

  <!-- T7/T8 占位:本任务只置状态,不渲染真实弹窗。两个节点隐藏,仅供 T7/T8 接管与测试断言。 -->
  <div
    v-if="dialog"
    hidden
    data-test="cluster-dialog-state"
    :data-mode="dialog.mode"
    :data-person-id="dialog.person.id"
  ></div>
  <div v-if="reviewOpen" hidden data-test="review-state" :data-idx="reviewIdx"></div>
</template>

<style scoped>
.photos-layout { display: flex; gap: 16px; align-items: flex-start; min-height: 100%; }
.photos-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }

/* ── 横幅(scss:5-35)── */
.people-banner {
  display: flex; align-items: flex-end; gap: 18px;
  padding: 4px 4px 14px;
  border-bottom: 1px solid var(--divider);
  /* Vue2 深色主题有一抹 5% 紫的顶部渐变、浅色主题整块去掉(scss:9,14)。
     这里改成随 accent 的极淡渐变:两套主题各自的 accent 都足够淡,不需要按主题分叉。 */
  background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 5%, transparent), transparent 80%);
}
.people-banner-text { min-width: 0; }
.people-banner h1 { font-size: 22px; font-weight: 600; letter-spacing: -0.01em; margin: 0; color: var(--fg); }
.people-sub { color: var(--fg-muted); font-size: 12.5px; margin-top: 4px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.people-sub .sep { width: 4px; height: 4px; border-radius: 50%; background: var(--fg-faint); flex: 0 0 auto; }
.people-banner-actions { margin-left: auto; display: inline-flex; gap: 8px; }
.people-pop-wrap { position: relative; }

/* ── 筛选行(scss:38-60)── */
.people-filters { display: flex; align-items: center; gap: 10px; padding: 12px 4px; border-bottom: 1px solid var(--divider); flex-wrap: wrap; }
.people-filters-spacer { flex: 1 1 auto; }
.people-chip {
  height: 28px; padding: 0 12px; border-radius: 999px;
  background: var(--chip-bg); border: 1px solid var(--chip-border); color: var(--fg-muted);
  font: inherit; font-size: 12px; font-weight: 500; cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px;
}
.people-chip:hover { background: var(--chip-bg-hi); color: var(--fg); }
.people-chip[data-active="true"] {
  background: var(--accent-soft);
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
  color: var(--accent-text);
}
.people-chip .ct { font-variant-numeric: tabular-nums; opacity: 0.7; font-size: 11px; }

/* ── 下拉菜单(Vue2 内联样式 :20-39 / :66-82)── */
.people-menu {
  position: absolute; top: calc(100% + 6px); right: 0; z-index: 20;
  background: var(--popup-bg); border: 1px solid var(--card-border); border-radius: 10px;
  box-shadow: var(--card-shadow-hi);
}
.people-menu-conf { min-width: 200px; padding: 8px; }
.people-menu-sort { min-width: 220px; padding: 4px; }
.people-menu-item {
  display: flex; width: 100%; align-items: center; gap: 8px; padding: 6px 8px;
  background: transparent; border: 0; border-radius: 6px; color: var(--fg);
  font: inherit; font-size: 12.5px; cursor: pointer; text-align: left;
}
.people-menu-item.is-stacked { align-items: flex-start; padding: 8px 10px; }
.people-menu-item:hover { background: var(--hover); }
.people-menu-item[data-active="true"] { background: var(--accent-soft); }
.people-menu-item .check { width: 12px; flex: 0 0 auto; color: var(--accent-text); }
.people-menu-item .lbl { flex: 1 1 auto; }
.people-menu-item .tail { color: var(--fg-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
.people-menu-item .stack-text { flex: 1 1 auto; display: flex; flex-direction: column; }
.people-menu-item .stack-text .lbl { font-weight: 500; }
.people-menu-item .stack-text .hint { font-size: 11px; color: var(--fg-muted); margin-top: 2px; }

/* ── 正文滚动容器(scss:63-67)── */
.people-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 24px 4px 80px; }

.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 60px 20px 20px; color: var(--fg-muted); text-align: center; }
.empty-state-title { font-size: 16px; font-weight: 600; color: var(--fg); }
.empty-state-desc { font-size: 13px; }

/* ── 分区头(scss:69-100)── */
.section-head { display: flex; align-items: baseline; gap: 10px; padding: 22px 0 14px; flex-wrap: wrap; }
.section-head h2 { font-size: 18px; font-weight: 600; letter-spacing: -0.01em; margin: 0; color: var(--fg); }
.section-head .sub { color: var(--fg-muted); font-size: 12px; }
.section-actions { margin-left: auto; display: inline-flex; align-items: baseline; gap: 14px; }
.section-actions .more + .more { padding-left: 14px; border-left: 1px solid var(--divider); }
.section-head .more { color: var(--fg-muted); font-size: 12px; background: transparent; border: 0; font-family: inherit; cursor: pointer; padding: 0; }
.section-head .more:hover { color: var(--accent-text); }

/* ── Pinned / Named 网格(scss:103-194)── */
.face-grid-lg { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 18px 14px; }
.face-grid-md { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 16px 10px; }
.face-card {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  cursor: pointer; padding: 6px; border-radius: 14px; position: relative;
}
.face-card:hover { background: var(--hover); }
/* 悬停时头像轻微推近(scss:129-131)。PersonAvatar 内部不带这个交互,父层 :deep 命中其 img。 */
.face-card :deep(.person-avatar-img) { transition: transform 0.4s ease; }
.face-card:hover :deep(.person-avatar-img) { transform: scale(1.05); }
/* Vue2 scss:132-136 给收藏头像加一圈 accent 光环(data-fav)。PersonAvatar 不带这个变体,
   这里在父层用 :deep 命中它的圆环,不改组件契约。 */
.face-grid-lg .face-card :deep(.person-avatar-ring) {
  box-shadow: inset 0 0 0 2px var(--accent), 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent);
}
.face-card .name {
  font-size: 13px; font-weight: 500; color: var(--fg); text-align: center; max-width: 130px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.face-card .meta { font-size: 11px; color: var(--fg-muted); font-variant-numeric: tabular-nums; }
.face-grid-md .face-card .name-row { display: inline-flex; align-items: baseline; gap: 6px; max-width: 100%; }
.face-grid-md .face-card .name-row .name { font-size: 12.5px; max-width: 90px; }
.face-grid-md .face-card .name-row .meta { font-size: 11px; }

/* ── 未命名网格(scss:197-243)── */
.cluster-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(86px, 1fr)); gap: 14px 10px; position: relative; }
.cluster-card { position: relative; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 6px; }
/* 未命名人脸略压一档不透明度,与已命名分区拉开层次(scss:215) */
.cluster-card :deep(.person-avatar-img) { opacity: 0.92; }
.cluster-card .badge {
  position: absolute;
  /* 锚在头像中心右上:无论列宽多少都只擦过圆弧一点点(照 Vue2 scss:218-220) */
  top: -6px; left: calc(50% + 20px);
  white-space: nowrap; font-size: 10.5px; padding: 2px 6px; border-radius: 99px;
  background: var(--overlay-bg); backdrop-filter: var(--blur);
  font-variant-numeric: tabular-nums; font-weight: 500;
}
/* theme-exception: 角标压在不可控的人脸照片上,两套主题都需要恒定暗底浅字浅描边 */
.cluster-card .badge { color: rgba(255, 255, 255, 0.78); }
/* theme-exception: 同上,恒定浅色描边 */
.cluster-card .badge { border: 1px solid rgba(255, 255, 255, 0.1); }
.cluster-card .ct { font-size: 11px; color: var(--fg-muted); font-variant-numeric: tabular-nums; }

/* ── 横幅条(scss:246-274)── */
.merge-banner {
  display: flex; align-items: center; gap: 14px; padding: 14px 16px;
  background: linear-gradient(120deg, color-mix(in srgb, var(--accent) 10%, transparent), color-mix(in srgb, var(--accent) 4%, transparent));
  border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
  border-radius: 14px; margin-bottom: 18px; flex-wrap: wrap;
}
.merge-banner .icon-wrap {
  width: 34px; height: 34px; border-radius: 50%; background: var(--accent-soft);
  display: flex; align-items: center; justify-content: center; color: var(--accent-text); flex: none;
}
.merge-banner .body { flex: 1 1 auto; min-width: 0; }
.merge-banner .title { font-size: 13px; font-weight: 600; color: var(--fg); }
.merge-banner .desc { font-size: 12px; color: var(--fg-muted); margin-top: 2px; }
.merge-banner .desc .em { color: var(--accent-text); font-weight: 500; }
.merge-banner .stack { display: inline-flex; }
.merge-banner .stack .stack-dot { border-radius: 50%; border: 2px solid var(--panel-bg); margin-left: -10px; line-height: 0; }
.merge-banner .stack .stack-dot:first-child { margin-left: 0; }
/* 警告变体(Vue2 :87-113 的内联橙色 → --warn-* 三个 token)*/
.merge-banner.is-warn { background: var(--warn-bg); border-color: var(--warn-border); }
.merge-banner.is-warn .icon-wrap { background: color-mix(in srgb, var(--warn-fg) 18%, transparent); color: var(--warn-fg); }
.merge-banner.is-warn .title { color: var(--warn-fg); }

.people-btn-primary { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
.people-btn-primary:hover { background: var(--accent); filter: brightness(1.08); }
.people-icon-btn {
  width: 28px; height: 28px; flex: 0 0 auto; border-radius: 50%; border: 0; background: transparent;
  color: var(--fg-muted); font-size: 16px; line-height: 1; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}
.people-icon-btn:hover { background: var(--chip-bg-hi); color: var(--fg); }

/* ── 浮动操作菜单(Vue2 内联样式 :208-233)── */
.cluster-menu {
  position: fixed; transform: translateX(-50%); min-width: 200px; z-index: 50;
  background: var(--popup-bg); border: 1px solid var(--card-border); border-radius: 10px;
  padding: 4px; box-shadow: var(--card-shadow-hi);
}
.cluster-menu-item {
  display: flex; width: 100%; align-items: center; gap: 8px; padding: 8px 10px;
  background: transparent; border: 0; border-radius: 6px; color: var(--fg);
  font: inherit; font-size: 12.5px; cursor: pointer; text-align: left;
}
.cluster-menu-item:hover { background: var(--hover); }
.cluster-menu-item svg { flex: 0 0 auto; color: var(--accent-text); }
.cluster-menu-item span { flex: 1 1 auto; }
.cluster-menu-item.is-danger { color: var(--remove-fg); }
.cluster-menu-item.is-danger svg { color: var(--remove-fg); }

/* ≤768px:侧栏已收抽屉,布局单列 */
@media (max-width: 768px) {
  .photos-layout { gap: 0; }
}
</style>
