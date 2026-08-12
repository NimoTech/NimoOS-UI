<script setup lang="ts">
// Task 6 (SP7-P5 人物): 人物列表视图 —— 横幅 + 置信度下拉 + 筛选/排序行 + 两条警告横幅 +
// 合并建议横幅 + Pinned/Named/Unnamed 三分区网格 + 浮动操作菜单 + 空态。
// 逐段对照 Vue2 NimoOS-UI src/views/Photos/PhotosPeopleView.vue:2-235 与
// src/views/Photos/photos-people.scss:1-275 移植;Ask Nimo 分支照 brief 不建。
// 壳照 PhotosAlbums.vue:185-188 的 AreaShell/.photos-layout/PhotosSidebar/.photos-main 复制
// (不抽公共,P3/P4 既定)。document 级监听照 PhotosAlbums.vue:159-181。
//
// T7(本次追加):接入 ClusterActionDialog(命名/合并/删除三态弹窗),`dialog` 状态从
// T6 的隐藏占位节点换成真实弹窗;三条提交路径(renamePerson/mergePersonInto/
// purgePersonWithUndo)的 store 调用、重入守卫、toast 全部收在这里 —— 弹窗本身只 emit
// (分工同 ClusterActionDialog.vue 头部注释)。路由注册与侧栏条目归 T16。
//
// T8(本次追加):接入 MergeReviewDialog(合并建议逐条审阅弹窗),`reviewOpen`/`reviewIdx`
// 从 T7 遗留的隐藏占位节点换成真实弹窗。accept/reject 两条提交路径的 store 调用、独立
// in-flight 守卫、toast、index 钳制全部收在这里(分工同上,弹窗本身只 emit)——钳制逻辑
// 之所以放宿主而不是弹窗:宿主才持有 suggestions 数组与 index 这两份状态(brief 明确要求)。
//
// T7 两条 Vue2 bug 修正(brief 明确要求改的,不照抄):
//  8) Vue2 confirmMergeTo :654-660 不 await 会拒绝的 mergeClusterInto、且**先弹"已合并"
//     成功 toast 再关弹窗**——合并失败时用户仍会看到"已合并到 xxx"的假成功提示,promise
//     rejection 也完全没处理(未捕获拒绝)。这里改成 await + 只在成功路径 toast 成功文案,
//     失败路径 toast `photosPersonMergeFailed`。
//  9) Vue2 本页的 toast 引用是坏的(T6 偏离登记 1 已记录:默认导入了没有对应 export 的
//     photosToast.js,四处调用实际抛 TypeError)。三条提交路径的 toast 一律走本仓 useToast()。
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
//  7) Vue2 :97 在设置链接后硬编码了一个英文句点(中文界面下中西混排,且无法本地化)——
//     不复制,详见该处行内注释。
//
// T3 漏掉的两条文案由协调者补给(zh_CN.json:2072 / :2079),已加进两个 locale 并照 Vue2 渲染:
// photosPeopleMinScore(置信度下拉小标题,:24-26)、photosPeopleClusterHint(未命名卡片
// 悬停提示,:204,连同 scss:242-243 的 .ct / .name-action 悬停互换一起补齐)。
import '../photos/styles/vue2-parity'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AreaShell from '../components/shell/AreaShell.vue'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import PersonAvatar from '../photos/components/PersonAvatar.vue'
import ClusterActionDialog from '../photos/components/ClusterActionDialog.vue'
import MergeReviewDialog, { type MergeSuggestion } from '../photos/components/MergeReviewDialog.vue'
import { usePhotosPeople } from '../photos/stores/people'
import { useTimelineStore } from '../photos/stores/timeline'
import { usePhotosSettingsStore } from '../photos/stores/settings'
import { useToast } from '../stores/toast'
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
const settings = usePhotosSettingsStore()
const toast = useToast()

// Vue2 :448
const CONFIDENCE_OPTIONS = [50, 60, 70, 80, 90, 95]

// Vue2 data() :461-472。sort 刻意不持久化(照 Vue2);confidence/showSingletons 在 store 里持久化。
const filter = ref<FilterId>('all')
const sort = ref<SortId>('freq')
const showUnnamed = ref(true)
const confidenceOpen = ref(false)
const sortOpen = ref(false)
const clusterMenu = ref<{ person: Person; x: number; y: number } | null>(null)
// T7 三态弹窗状态(本次接了真实弹窗)/ T8 审阅弹窗状态(仍是占位节点)。
const dialog = ref<{ mode: DialogMode; person: Person } | null>(null)
const reviewOpen = ref(false)
const reviewIdx = ref(0)
// 命名/合并各自独立的 in-flight 守卫(brief 硬约束:P4 期这类 bug 被抓了三次)。两个 ref
// 分开、不共用——理由同 AlbumPickerDialog.vue:35-42 的先例:两条路径都可能在真实使用中被
// 连续触发(比如命名成功后立刻又点了合并),共用一个标志会让互不相干的操作彼此误伤。
//
// 评审必修 2(第二轮,已删除 deletingSubmitting ref):删除路径原来也仿照这个形状加了
// 一个独立的 `deletingSubmitting` ref,但评审做了删码验证——`onSubmitDelete` 全程没有
// `await`(purgePersonWithUndo 同步返回 undo 闭包),函数体在一次 dispatchEvent 里跑完,
// `dialog.value = null` 在函数体内**同步**发生,早于任何"守卫复位"的必要性。把这个 ref
// 整段(声明/置位/finally 复位)删掉后,回归测试依然绿,因为挡住第二次调用的从来是
// `onSubmitDelete` 开头的 `!dialog.value` 短路,不是这个 ref——ref 只是"标准形状"的
// 装饰,没有实际保护价值。已在 fix 报告里记录这次删码验证的具体做法与结果,这里不再
// 加回这个 ref。命名/合并两条路径的 async 守卫经评审确认确凿有效,不受影响。
const namingSubmitting = ref(false)
const mergingSubmitting = ref(false)
// P8a-T6(§7e-10):facesEnabled 曾经是本页自己 onMounted 直读一次 /photos/config 的临时
// 实现(P8 归属前没有共享 store)。现在改读 T1 的 photosSettings store —— 语义不变:缺
// 字段/请求失败一律按开启处理(不显示警告横幅,宁可不吓用户),这条防御性语义已经在
// store.fetchAiFeatures() 里落实(readAiFeatures 的 `on()` 判据),这里只是消费,不重复实现。
const facesEnabled = computed(() => settings.aiFeatures.faces)

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

// 偏离登记(计划第 9 条):Vue2 :575-580 把 locale 写死成 'en',中文界面下会显示英文月份。
// 这里跟随当前 i18n locale('zh_cn' → BCP47 'zh-cn');非法日期仍返回 ''(照 Vue2)。
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
  // encodeURIComponent:后端 id 目前是数字/短串,但它进的是 URL 路径段,含 `/` `#` `?`
  // 的 id 会把路径截断成别的路由(评审顺手项)。数字 id 编码后不变,不影响既有行为。
  router.push('/photos/people/' + encodeURIComponent(String(p.id)))
}
function openClusterMenu(p: Person, e: MouseEvent): void {
  e.stopPropagation()
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  clusterMenu.value = { person: p, x: rect.left + rect.width / 2, y: rect.bottom + 8 }
}
// 用户验收新增:菜单里的「查看这些照片」。与 openDialog 同款"先关菜单再动作"的顺序
// (菜单里的 person 是唯一事实,关菜单会清掉它,所以必须先取出来)。
function viewClusterPhotos(): void {
  const p = clusterMenu.value?.person ?? null
  clusterMenu.value = null
  if (!p) return
  openPerson(p)
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

// T8:store 的 mergeSuggestions 是后端 JSON 直通的宽松类型(Array<Record<string, unknown>>),
// MergeReviewDialog 的契约要求更窄的 MergeSuggestion[] 形状——两者运行时字段实际一致
// (id/fromId/intoId/intoName/confidence),这里只是收紧类型给弹窗用,不做数据转换。
const reviewSuggestions = computed<MergeSuggestion[]>(
  () => people.mergeSuggestions as unknown as MergeSuggestion[],
)

// 照 brief:index 钳制逻辑放宿主(它持有 suggestions 与 index),弹窗只 emit。
// store 的 acceptMergeSuggestion/rejectMergeSuggestion 内部已经在函数最开头**同步**把这条
// 建议从 mergeSuggestions 里摘掉了(见 people.ts 头部注释),所以这里在 await 完成之后
// 看到的 suggestions.length 已经反映了摘除后的结果——不需要再自己减一次。
function clampReviewIndex(): void {
  const len = people.mergeSuggestions.length
  if (len === 0) { reviewOpen.value = false; return }
  if (reviewIdx.value >= len) reviewIdx.value = Math.max(0, len - 1)
}

// 照 Vue2 onAcceptReview :595-604,改成 await(Vue2 原版不 await,fire-and-forget)。
// toast 复用既有 photosPersonMergedToast(brief 未单独给"Merged as…"这句的键;与 T7
// onSubmitMerge 的成功 toast 同属"已合并到 X"这一类语义,已在报告登记为有意的一次统一,
// 不是遗漏)。intoName 必须在调用 store **之前**捕获——store 会同步先把这条建议从数组里
// 摘掉,调用之后再找就找不到了。
//
// 评审必修(第二轮,同 T7 §11 的先例):brief 要求"两条路径都要独立 in-flight 守卫 ref",
// 起草时确实各加了一个(reviewAccepting/reviewRejecting)。删码验证:把两处 `if (guard)
// return` 临时改成 `if (false) return`(guard 判定整段失效,其余逻辑不变),重跑
// "T8 合并建议审阅弹窗接线" 整个 describe 块——两条"连点两次…只被调一次"的回归测试
// 依然全绿,包括 T7/T8 全量测试(50/50)都没有变红。真正挡住第二次调用的是两层已有机制,
// 不是这两个 ref:
//   1) 本组件的 MergeReviewDialog.onAccept/onReject 各自开头 `if (!current.value) return`
//      (MergeReviewDialog.vue)——store 的 acceptMergeSuggestion/rejectMergeSuggestion
//      在函数体最开头就**同步**把这条建议从 mergeSuggestions 数组里摘掉了(people.ts 头部
//      注释),这个移除发生在任何 await 之前,不等网络。第一次点击的整条同步链路(dispatch
//      → emit → 这里的函数体开头到第一个 await)跑完之后,`current.value` 已经是
//      `undefined`——无论第二次点击隔多久(哪怕两次点击间隔为 0,浏览器也是顺序派发两个
//      独立的 click 事件,不会把两个事件处理器交叠在同一个同步执行栈里),弹窗自己的
//      按钮从源头就不会再 emit 第二次。
//   2) 即使真有什么路径绕过弹窗直接调了两次(假设的场景,当前不存在),store 侧
//      `if (s) { ... }` 的判定本身就是幂等的——找不到这条建议(已被第一次摘掉)时整段
//      try/catch/finally 都不会跑,第二次调用是安全的空操作。
// 两层保护都已经在,独立 ref 只是"标准形状"的装饰,没有实际保护价值——同 T7 delete 路径
// 的 `deletingSubmitting` 一样,删掉。还原 `if (false) return` 为空(即整段判断连同 ref
// 一起去掉)后复跑,测试依然绿。
//
// ⚠依赖前提(协调者点名要单独写清楚,别只藏在上面那段里):以上"不需要独立守卫 ref"的
// 结论**依赖 people.ts 里 acceptMergeSuggestion/rejectMergeSuggestion 的当前实现顺序 ——
// 先同步 filter 掉这条建议、再 await 后端**(T2 的实现细节)。如果将来有人把这个顺序倒过来
// (比如改成先 await 确认成功再移除,想做成"失败就不动本地状态"的语义),
// `current.value` 就不会在第一次点击后立刻变 undefined,本节这套"天然防重入"论证会失效,
// 需要重新评估是否要把独立守卫 ref 加回来。
async function onReviewAccept(id: string | number): Promise<void> {
  const s = people.mergeSuggestions.find((m) => String(m.id) === String(id))
  const intoName = (s?.intoName as string | undefined) ?? ''
  try {
    await people.acceptMergeSuggestion(id)
    toast.show(t('photosPersonMergedToast', { name: intoName || t('photosPersonMergeAsSame') }))
  } catch {
    // 失败:store 会 void fetchMergeSuggestions() 纠正性重拉(people.ts 头部注释"先乐观
    // 移除建议,失败重拉建议列表纠正")。下面 finally 里的 clampReviewIndex() 与这条纠正
    // 重拉谁先落地是一个天然的时序竞态——真实网络延迟下几乎总是 clamp 先跑(此刻建议仍是
    // 空,只剩这一条就会关弹窗);单测用的全同步 mock 下顺序会反过来(重拉先落地、建议已
    // 恢复,不关)。这是设计里固有的竞态,不是本次要修的 bug,task-8-report.md §8 有更完整
    // 的说明;测试(PhotosPeople.test.ts "失败:...")刻意不断言弹窗开关状态,只断言调用
    // 参数与失败 toast。
    toast.show(t('photosPersonMergeFailed'))
  } finally {
    clampReviewIndex()
  }
}

// 照 Vue2 onRejectReview :605-614,改成 await。失败 toast 复用 photosPersonMergeFailed,
// 不为"忽略失败"单开一个新键(已在报告登记)。同上一段的删码验证结论,不加独立守卫 ref;
// 同一份 current.value 依赖前提(见 onReviewAccept 头部的⚠依赖前提)与失败路径竞态说明
// 同样适用于这里,不重复贴一遍。
async function onReviewReject(id: string | number): Promise<void> {
  try {
    await people.rejectMergeSuggestion(id)
    toast.show(t('photosPersonMergeDismissedToast'))
  } catch {
    toast.show(t('photosPersonMergeFailed'))
  } finally {
    clampReviewIndex()
  }
}

// ClusterActionDialog 只 emit,不碰 store/toast(分工见该组件头部注释)——三条提交路径的
// 真实调用、重入守卫、toast 全部在这里。`update:open(false)` 统一走 closeDialog(取消/Esc/
// 点遮罩/关闭按钮都走这一条路)。
function closeDialog(): void {
  dialog.value = null
}

// 照 Vue2 confirmName :645-652,乐观关弹窗改为等 store 成功才关(brief 明确的路径):
// 短路 → await renamePerson → 成功 toast + 关弹窗;失败 toast 失败文案,弹窗留着(照
// AlbumPickerDialog submitCreate 失败不关面板的先例,让用户能看清失败原因并重试)。
async function onSubmitName(name: string): Promise<void> {
  if (!dialog.value || namingSubmitting.value) return
  const person = dialog.value.person
  namingSubmitting.value = true
  try {
    await people.renamePerson(person.id, name)
    toast.show(t('photosPersonNamedToast', { name, count: person.count }))
    dialog.value = null
  } catch {
    // store 已经 console.error 过,这里只管用户可见的失败反馈。
    toast.show(t('photosPersonRenamedFailed'))
  } finally {
    namingSubmitting.value = false
  }
}

// T7 偏离登记(brief 明确要求改的 Vue2 bug,见文件头注释第 8 条):Vue2 confirmMergeTo
// :654-660 不 await mergeClusterInto、且在发起请求后立刻弹"已合并"成功 toast、再无条件关
// 弹窗——请求真失败时用户看到的是假成功提示,而且返回的 rejected promise 完全没人处理
// (未捕获拒绝)。这里改成 await + 只在成功路径弹成功 toast;失败弹 photosPersonMergeFailed;
// 无论成败都在 finally 关弹窗(照 brief:"finally 关弹窗 + 复位",合并这条不像命名那样让
// 用户留在弹窗里重试——目标人物是从候选列表里点的,不是打字输入,失败重开菜单重新选更清楚)。
async function onSubmitMerge(targetId: string | number): Promise<void> {
  if (!dialog.value || mergingSubmitting.value) return
  const fromId = dialog.value.person.id
  const targetName = people.personById(targetId)?.name ?? ''
  mergingSubmitting.value = true
  try {
    await people.mergePersonInto(fromId, targetId)
    // P8a-T10:与上方 confirmMergeTo(:266)同一兜底,目标未命名(或 personById 找不到)时不
    // 渲染成「已合并到「」」。
    toast.show(t('photosPersonMergedToast', { name: targetName || t('photosPersonMergeAsSame') }))
  } catch {
    toast.show(t('photosPersonMergeFailed'))
  } finally {
    dialog.value = null
    mergingSubmitting.value = false
  }
}

// 照 Vue2 confirmDelete :661-674,purgePersonWithUndo 同步返回 undo 闭包(不是 Promise,
// 不 await)。评审必修 2:这条路径**不需要**独立的 in-flight 守卫 ref——函数体全程无
// await,一次 dispatchEvent 内跑完;`dialog.value = null` 就是这条路径天然的防重入锁,
// 两次连点在 Vue 把弹窗从 DOM 摘掉之前的那个同步窗口里都命中同一个按钮时,第二次调用会
// 在函数体最开头被 `!dialog.value` 挡下(第一次调用已经把它置空)。删码验证见 fix 报告:
// 曾经这里也仿照命名/合并加过一个 `deletingSubmitting` ref,删掉整段(声明/置位/finally
// 复位)后回归测试依然绿——证明它没有实际保护价值,不再加回。
function onSubmitDelete(): void {
  if (!dialog.value) return
  const person = dialog.value.person
  const undo = people.purgePersonWithUndo(person.id)
  dialog.value = null
  // 终审 Important 4:名字为空时的占位标签必须是 photosPersonUnnamedLabel(「未命名人物」),
  // 不是 photosPersonThisPerson(「这个人」)。Vue2 两处删除路径
  // (PhotosPeopleView.vue:665 与 PhotosPersonDetail.vue:962)**都是** $t('Unnamed person'),
  // 已回源逐字核对。而且本页的删除入口只挂在未命名人物的三态弹窗上 —— 「名字为空」是这一页的
  // **常态路径**,给错的恰好是主路径。引号风格也照 Vue2 用 ASCII 双引号(与详情页统一)。
  const label = person.name && person.name.trim() ? `"${person.name.trim()}"` : t('photosPersonUnnamedLabel')
  toast.show(t('photosPersonDeletedToast', { label }), 5000, { label: t('photosPersonUndo'), onClick: undo })
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

onMounted(() => {
  // Vue2 :526-527 每次进页面都重拉,不做 loaded 去重,照搬。
  void people.fetchPeople()
  void people.fetchMergeSuggestions()
  // P8a-T6:改读共享 photosSettings store(§7e-10)。侧栏(PhotosSidebar,本页也挂载它)
  // 同帧也会调用 fetchAiFeatures() —— 并发去重收在 settings.ts 里,这里不需要关心。
  void settings.fetchAiFeatures()
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
                <div class="people-menu-head" data-test="conf-head">{{ t('photosPeopleMinScore') }}</div>
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
                <!-- 偏离登记 4:设置页归 P8,这里是强调文本而非可点链接。
                     偏离登记 7:Vue2 :97 在 </a> 后还硬编码了一个英文句点,中文 locale 下会
                     得到「…重新开启 设置 · AI 行为.」这种中西混排的错误标点,且它不在任何
                     可翻译串里(没有对应键)——这里不复制那个句点。 -->
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
              <!-- Vue2 scss:266-268 的 .stack .dot 是 28px **含** 2px 描边(border-box),
                   所以内圈头像是 24px、总外径 28px。评审 Minor 修正:原先传 28 再加 2px 描边
                   会得到 32px 外径。 -->
              <div class="stack-dot"><PersonAvatar :person-id="suggestionId('fromId')" :ver="verOf(suggestionId('fromId'))" :size="24" /></div>
              <div class="stack-dot"><PersonAvatar :person-id="suggestionId('intoId')" :ver="verOf(suggestionId('intoId'))" :size="24" /></div>
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
                <!-- 悬停时与 .ct 互换(scss:242-243):照片数隐、操作提示显 -->
                <div class="name-action" data-test="cluster-hint">{{ t('photosPeopleClusterHint') }}</div>
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
    <!-- 用户验收新增(Vue2 菜单 :213-231 只有命名/合并/删除三项,整个 Vue2 列表页没有任何
         通往未命名人物详情页的入口)。放在首位:它是"只看不改"的动作,三个会改数据的动作
         排在后面。走与已命名卡片同一个 openPerson,共用 encodeURIComponent 守卫。 -->
    <button type="button" class="cluster-menu-item" data-test="menu-view" @click="viewClusterPhotos">
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/></svg>
      <span>{{ t('photosPersonViewPhotos') }}</span>
    </button>
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

  <!-- T7:三态操作弹窗真正接上。候选传全量 named——排序/过滤/截断在弹窗内部(brief 定案)。 -->
  <ClusterActionDialog
    :open="dialog !== null"
    :mode="dialog?.mode ?? 'name'"
    :person="dialog?.person ?? null"
    :candidates="people.named"
    @update:open="(v) => { if (!v) closeDialog() }"
    @submit-name="onSubmitName"
    @submit-merge="onSubmitMerge"
    @submit-delete="onSubmitDelete"
  />

  <!-- T8:合并建议审阅弹窗接上。update:index 声明了但从不会被 emit(见 MergeReviewDialog
       头部注释——没有独立的"跳到第 N 条"导航控件),接线仍然完整覆盖以保持契约一致;宿主侧
       目前唯一改变 reviewIdx 的路径是 accept/reject 之后的 clampReviewIndex。 -->
  <MergeReviewDialog
    :open="reviewOpen"
    :suggestions="reviewSuggestions"
    :index="reviewIdx"
    :people="people.people"
    @update:open="(v) => { if (!v) reviewOpen = false }"
    @update:index="(v) => { reviewIdx = v }"
    @accept="onReviewAccept"
    @reject="onReviewReject"
  />
</template>

<style scoped>
/* height(不是 min-height):这一屏封顶,只有内层滚动容器滚 —— 同源修复,理由与 Vue2
   出处见 src/views/Photos.vue 同一规则处的注释。 */
.photos-layout { display: flex; gap: 16px; align-items: flex-start; height: 100%; }
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
/* 置信度下拉小标题(Vue2 :24-26 的内联样式) */
.people-menu-head {
  font-size: 10.5px; color: var(--fg-muted); text-transform: uppercase;
  letter-spacing: 0.06em; padding: 4px 6px 8px;
}
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
/* Vue2 scss:132-136 给收藏头像加一圈 accent 内环(data-fav)。
   评审 Important 2(两处一起改):
   ① **必须是 ::after 覆盖层,不能是 .person-avatar-ring 自己的 box-shadow**。
      inset 阴影按 CSS 规范画在「内容与后代之前」,而圆环内部的 .person-avatar-img /
      .person-avatar-fallback 铺满整个 padding box —— 那圈 2px accent 100% 被人脸照片盖死,
      Pinned 分区因此完全看不出「置顶收藏」这个视觉记号。Vue2 用的正是 ::after
      (scss:132-136),伪元素叠在 img 之上才可见。
   ② 选择器补上 data-fav 条件(PersonAvatar 根元素新增该属性,同 Vue2 `.ring[data-fav]`)。
      原来无条件命中 .face-grid-lg 下所有头像,当前语义等价(Pinned 只渲染收藏项)但复用即串。
   挂在 .person-avatar(组件根,position:relative 且与圆环同一个盒)而不是 .person-avatar-ring
   上:圆环自己 overflow:hidden,伪元素若以它为定位父级会被它裁掉。
   **只画内环、不画外发光**:Vue2 那条规则里的第二段外发光(0 0 0 3px,accent 20% 透明度)同样被
   `.ring { overflow: hidden }`(scss:120)裁掉,在 Vue2 里从未渲染过 —— 不照抄这段死代码
   (照抄反而会渲染出 Vue2 没有的一圈光晕,是新增视觉而非 1:1)。 */
.face-grid-lg .face-card :deep(.person-avatar[data-fav="true"])::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 50%;
  box-shadow: inset 0 0 0 2px var(--accent);
  pointer-events: none;
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
/* 悬停互换(scss:237-243):平时只显照片数,悬停换成「+ 命名 / 合并 / 删除」 */
.cluster-card .name-action { font-size: 11.5px; color: var(--accent-text); display: none; }
.cluster-card:hover .name-action { display: block; }
.cluster-card:hover .ct { display: none; }

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
