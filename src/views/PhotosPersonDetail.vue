<script setup lang="ts">
// Task 14 (SP7-P5 人物): 人物详情视图容器 —— 本期最大的一件。逐段对照 Vue2 NimoOS-UI
// src/views/Photos/PhotosPersonDetail.vue(1561 行)移植:四态门控(骨架 / 加载失败+重试 /
// 人物不存在 / 正常)+ PersonHero(T10)+
// 三个 tab(时间线自绘共现横条 + PersonAssetGrid T11 / PersonPlacesTab T12 /
// PersonRelationsTab T13)+ 选择态浮动条 + **七个自绘弹窗**(改名 / 建相册 /
// 「暂无可用照片」提示 / 移出确认 / 删除确认 / 背景选择 / 合并到他人 —— brief 的清单列了
// 六个,第三个是 Vue2 promptDialog 的 info 模式 :845-851,补齐见偏离登记 B)+
// PhotoLightbox(P2)接线。
//
// 本文件只做编排:数据在 usePersonDetail(T9),写入在 usePhotosPeople(T2)/
// usePhotosAlbums(P4),展示在 T10-T13。九条动作的调用/成功/失败三段都在这里。
//
// ── 铁律逐条落实 ────────────────────────────────────────────────────────────
//  1) route.params.id 恒为字符串:personId = computed(() => String(route.params.id)),
//     **所有**下游调用(load / renamePerson / setPersonRelation / setPersonFavorite /
//     setPersonCover / setPersonHero / mergePersonInto / purgePersonWithUndo /
//     detachAssetsFromPerson)一律传这个归一值,不猜后端 id 的真实类型。
//  2) hash 路由同组件不重建:watch(() => route.params.id) 重新 load + 清 selectedIds +
//     tab 复位 + 关掉所有弹窗(照 PhotosAlbumDetail.vue:323-334 的前例)。
//  3) 首次 load 在 <script setup> 顶层同步发起,不放 onMounted(照 PhotosAlbumDetail.vue
//     :302-309:loading 标志在 await 之前同步置位,放 onMounted 会晚一帧、首帧闪空态)。
//  4) 一切按 id 比较用 String() 值比较,不用引用相等。
//
// ── 与 Vue2 的有意偏离(全部登记,brief 明确要求或本期"移植纪律"要求)────────────
//  A) Vue2 的 hero/tab 内容是同一个巨型组件;这里拆成 T10-T13 四个子组件,容器只接 emit。
//  B) Vue2 用一个 promptDialog 对象承载 rename/album/detach/info 四种模式;这里拆成四个
//     独立的开关 + 各自的状态(照 P3/P4 惯例每个弹窗自绘,不抽公共外壳;CSS 类共享)。
//     Vue2 的第四种模式 info(:845-851「没有照片可加入相册」)brief 的六个弹窗清单里没有,
//     但它是 Vue2 真实存在的界面元素 —— 补齐为第七个弹窗,不砍(报告已登记)。
//  C) 收藏/关系分组:Vue2 fire-and-forget 且不回滚(:764-768,:951-955)。这里乐观 patch +
//     失败精确回滚 + toast(偏离登记 3 / 4,store 层已 rethrow)。
//  D) 改名失败:Vue2 只 console.error 且照样关弹窗(:915-918),用户看不到失败也丢了输入。
//     这里 toast + **不关弹窗**(便于改)。
//  E) 移出失败:Vue2 只 console.error(:943)。这里补 toast(偏离登记 1)。
//  F) 建相册:Vue2 成功后 $emit('album-created') 但**没有任何人监听**,用户零反馈(:923)。
//     这里 toast;409 用相册区已有的重名文案(偏离登记 1)。
//  G) 建相册默认名:Vue2 :855 用 `this.person.id.slice(0, 8)` —— 后端 id 是数字时
//     Number.prototype 没有 slice,直接抛 TypeError。这里 String(id).slice(0, 8)。
//  H) 合并失败:照 Vue2 停在当前页 + finally 关弹窗(已知瑕疵,brief 明确不修)。
//  I) 背景弹窗的四条 toast(:681,683,694,696):brief 说合成两条,回源核对后发现两个入口
//     的文案语义确实不同(「重置回关键照片」vs「改成选中的这张」)—— 协调者裁定 3 拍板
//     **不合并**,补 photosPersonHeroResetToast / photosPersonHeroResetFailed 两键,
//     按 assetId === null 分流(见 saveHero)。
//  J) 合并候选池:Vue2 用 allPeople(含未命名)(:517);brief 定为 people.named 排除自身。
//     照 brief。连带结果:候选名字恒非空(namedOf 保证 name.trim() !== ''),Vue2 :406/410
//     的 `p.name || $t('Unnamed')` 兜底在这里不可达,不渲染(不是漏渲染)。
//  K) route watch 加 `params.id === undefined` 短路:删除/合并成功后 router.push 到
//     /photos/people(无 :id),Vue2 那边是父组件卸载子组件所以 watch 压根不会响;这里
//     组件常驻,不短路会白发一次 load('undefined')(PhotosAlbumDetail.vue:323 有同款缺口,
//     那边记账,这里直接堵掉)。
//  L) 共现横条头像尺寸 72px:brief 写的是 56,回 Vue2 源核对
//     photos-people.scss:701-703 `.coappear-card .ring { width:72px; height:72px }`,
//     以源为准(同 T13 的 36px 教训)。
//  M) 门控从三态扩到四态(协调者裁定 4):Vue2 加载失败只 console.error(:746),视图无法
//     区分「加载失败」与「没有这个人」,两者都是一片空白。T9 的 failed 标志正是为此而加 ——
//     这里 failed 单独一支:photosPersonLoadFailed + 重试钮(P4 遗留过一条同类账:详情页
//     加载失败 → 永久骨架、无错误态无重试,本期不再留)。
//
// ── 身份守卫(终审 Important 3;与 in-flight 重入守卫是两件不同的事)────────────
//  in-flight 守卫(favBusy/renaming/…)防的是「同一个人物上连点两次」;身份守卫防的是
//  「请求在途期间用户换人了,晚到的响应把 A 的数据写到 B 上」。T9 的 seq 只保护 load()
//  自己的回写(过期响应丢弃),容器方向此前完全没有对应机制。
//
//  确定复现路径:人物 A 页 → 改名「张三」→ PATCH 在途 → **按浏览器后退键**(hash 路由,
//  不必点穿遮罩)→ route watch(见文件末尾)加载 B → B 就绪 → A 的 PATCH 才 resolve →
//  无守卫时 patchPerson({name:'张三'}) 命中的是 **B**:B 的 hero 姓名/顶栏/建相册默认名
//  全变成「张三」,刷新才恢复。收藏/关系分组的**失败回滚**同理会把 A 的旧值写到 B 上,
//  并在 B 的页面上弹属于 A 的失败 toast。
//
//  机制:每条动作在发请求**之前**同步抓一份 `const myId = personId.value`,后续所有
//  写回一律走 `detail.patchPerson(patch, myId)`(第二参必填,类型强制)/ `detail.isCurrent(myId)`。
//  patchPerson 返回 false ⇒「已经切人了」⇒ 连 toast 一起放弃。id 比较在 composable 内部
//  统一走 String() 归一(铁律 4)。
//
// ── Esc 分层(P4 终审同款,七个弹窗全覆盖)────────────────────────────────────
//  本页挂着 PhotoLightbox,它在 **window** 上挂 keydown(PhotoLightbox.vue:144)。弹窗的
//  Esc 一律 **document** 级 + watch(anyDialogOpen) 挂/摘,分支内**必须** e.stopPropagation()
//  —— 原生 keydown 冒泡顺序是 document 先于 window,不挡住就一次 Esc 关两层。
//  逐字参考 AlbumPickerDialog.vue:70-100。没有弹窗打开时监听整个摘掉,Esc 照常关灯箱。
//
// ── 配色 ────────────────────────────────────────────────────────────────────
//  面板底一律 var(--popup-bg)(不是 --card-bg:深色主题下近透明会看穿 —— P2 血泪)。
//  用到的每个 token 都已在 theme.css 两套主题块里确认存在;--line / --accent-hi /
//  --surface-* / --text-* / --ink 在本仓不存在,分别代以 --divider/--card-border /
//  --accent-text / --card,--panel-bg,--chip-bg / --fg,--fg-muted,--fg-subtle。
//  不使用 --on-accent,除了「主按钮」这一处 —— 它的底色是 var(--accent) 饱和实底,
//  正是 --on-accent 唯一合法的前提场景。
import '../photos/styles/vue2-parity'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { service } from '@nimotech/nimoos-service'
import { usePhotosTheme } from '../photos/composables/usePhotosTheme'
import { useSidebarCollapse } from '../photos/composables/useSidebarCollapse'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import PhotosTopbar from '../photos/components/PhotosTopbar.vue'
import PersonAvatar from '../photos/components/PersonAvatar.vue'
import PersonHero from '../photos/components/PersonHero.vue'
import PersonAssetGrid from '../photos/components/PersonAssetGrid.vue'
import PersonPlacesTab from '../photos/components/PersonPlacesTab.vue'
import PersonRelationsTab from '../photos/components/PersonRelationsTab.vue'
import AlbumPickerDialog from '../photos/components/AlbumPickerDialog.vue'
import PhotoLightbox from '../photos/lightbox/PhotoLightbox.vue'
import { useLightbox } from '../photos/lightbox/useLightbox'
import { usePersonDetail } from '../photos/composables/usePersonDetail'
import { usePhotosPeople } from '../photos/stores/people'
import { usePhotosAlbums } from '../photos/stores/albums'
import { useTimelineStore } from '../photos/stores/timeline'
import { useToast } from '../stores/toast'
import { groupPlaces, type Person } from '../photos/util/peopleView'
import { isConflict, isNotFound } from '../photos/util/httpErrors'
import type { Photo } from '../photos/util/assetToPhoto'

type Tab = 'timeline' | 'places' | 'relations'

const { t } = useI18n()
const { themeClass } = usePhotosTheme()
// Plan D Task 3(换壳):同 T2(PhotosPeople.vue)/Plan C Task 2(PhotosAlbums.vue)的共享
// composable —— 折叠态是跨 Photos 区所有页面的单例,不在这里另起一份。
const { collapsed, toggle: onToggleCollapse } = useSidebarCollapse()
const route = useRoute()
const router = useRouter()
const people = usePhotosPeople()
const albums = usePhotosAlbums()
const timeline = useTimelineStore()
const toast = useToast()
const lb = useLightbox()
const detail = usePersonDetail()

// 铁律 1:唯一的归一点。
const personId = computed(() => String(route.params.id))

// ── 本地状态 ────────────────────────────────────────────────────────────────
const tab = ref<Tab>('timeline')
// 隐式选择态(照 Vue2 :488-489):有任意一张被选中就是选择态,没有独立的"进入选择模式"按钮。
const selectedIds = ref<Array<string | number>>([])
const selectionMode = computed(() => selectedIds.value.length > 0)

// 弹窗 1:改名
const renameOpen = ref(false)
const renameInput = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)
// 弹窗 2:建相册(+ 弹窗 7:没有照片可用的提示,照 Vue2 promptDialog 的 info 模式)
const albumOpen = ref(false)
const albumInput = ref('')
const albumIds = ref<Array<string | number>>([])
const albumInputRef = ref<HTMLInputElement | null>(null)
const noPhotosOpen = ref(false)
// 弹窗 3:移出确认
const detachOpen = ref(false)
const detachIds = ref<Array<string | number>>([])
// 弹窗 4:删除人物确认
const deleteOpen = ref(false)
// 弹窗 5:背景选择(宽弹窗)
const heroOpen = ref(false)
const heroSelectedId = ref<string | number | null>(null)
// 弹窗 6:合并到他人
const mergeOpen = ref(false)
const mergeQuery = ref('')
const mergeTarget = ref<Person | null>(null)

// in-flight 重入守卫。**只给真的有防护价值的路径加**(判断依据逐条写在各自的函数注释里):
// 删除人物 / 移出资产两条是纯同步提交路径(弹窗在 await 之前就已关闭),守卫会是装饰性的,
// 刻意不加(T7/T8 的教训:装饰性 ref 只会让人误以为那里有保护)。
const favBusy = ref(false)
const relationBusy = ref(false)
const renaming = ref(false)
const keyPhotoBusy = ref(false)
const heroSaving = ref(false)
const merging = ref(false)
const albumSaving = ref(false)

// 灯箱「加入相册」→ 复用 T5 的选择面板(它自带 document 级 Esc + stopPropagation)。
const albumPickerOpen = ref(false)
const albumPickerIds = ref<Array<string | number>>([])

// ── 派生数据 ────────────────────────────────────────────────────────────────
// Vue2 :530-532 —— 共现横条按 count 降序(不改动 detail.relations 本身)。
const sortedRelations = computed(() => [...detail.relations.value].sort((a, b) => b.count - a.count))
// 地点 tab 自己算分组;关系 tab 要的 PlaceGroup[] 由容器算好传下去(T13 契约)。
const placeGroups = computed(() => groupPlaces(detail.places.value, t('photosPersonUnknownPlace')))
// 未裁剪的全量照片:灯箱翻页集(照 Vue2 :878)与背景选择网格(照 :510-512)共用。
const allPhotos = computed<Photo[]>(() => detail.flatPhotos())
// Vue2 :165-166,:241,:887 共用的兜底:名字为空时用"这个人"。
const displayName = computed(() => detail.person.value?.name || t('photosPersonThisPerson'))

// Plan D Task 3(换壳):PhotosTopbar 的 detail 态口径,逐字对照 Vue2
// PhotosPeopleTopbar.vue:7-8/36(`view === 'detail'` 分支)—— 标题=人物名,空名兜底
// $t('Unnamed person')(与 PersonHero.vue:90 的 heroTitle 同一兜底键,不另开一个);
// 副行=固定文案「人物详情 · 面孔与关系」,不随 named/unnamed 计数变化(那是 index 态的口径,
// 归 T2/PhotosPeople.vue 的 topbarSub)。
const topbarTitle = computed(() => detail.person.value?.name || t('photosPersonUnnamedTitle'))

// 合并候选(偏离登记 J):named 排除自身 → count 降序、同 count 按 name 升序(排序同 T7
// ClusterActionDialog.vue:85-92)→ 搜索过滤 → **不截断**(照 Vue2 详情页 :515-520;
// T7 那个弹窗才有 6/8 的截断)。
const mergeCandidates = computed(() => {
  const pool = people.named.filter((p) => String(p.id) !== personId.value)
  const sorted = [...pool].sort((a, b) => (b.count !== a.count ? b.count - a.count : a.name.localeCompare(b.name)))
  const q = mergeQuery.value.trim().toLowerCase()
  return q ? sorted.filter((p) => p.name.toLowerCase().includes(q)) : sorted
})

// ── 弹窗开关 ────────────────────────────────────────────────────────────────
function closeAllDialogs(): void {
  renameOpen.value = false
  albumOpen.value = false
  noPhotosOpen.value = false
  detachOpen.value = false
  detachIds.value = []
  deleteOpen.value = false
  heroOpen.value = false
  heroSelectedId.value = null
  mergeOpen.value = false
  mergeQuery.value = ''
  mergeTarget.value = null
}

function openRename(): void {
  renameInput.value = detail.person.value?.name ?? ''
  renameOpen.value = true
  // 照 Vue2 :780 的 $nextTick(focusDialogInput):focus + select,方便直接改名。
  void nextTick(() => {
    renameInputRef.value?.focus()
    renameInputRef.value?.select()
  })
}
function closeRename(): void { renameOpen.value = false }

// 照 Vue2 onMakeAlbum :841-867 —— 没有照片时弹 info 提示,不进创建流程。
function openMakeAlbum(): void {
  const p = detail.person.value
  if (!p) return
  const ids = allPhotos.value.map((x) => x.id)
  if (!ids.length) {
    noPhotosOpen.value = true
    return
  }
  albumIds.value = ids
  // 偏离登记 G:String(p.id) 再 slice —— 数字 id 也不炸。
  albumInput.value = p.name.trim() ? p.name : t('photosPersonAlbumNameFallback', { id: String(p.id).slice(0, 8) })
  albumOpen.value = true
  void nextTick(() => {
    albumInputRef.value?.focus()
    albumInputRef.value?.select()
  })
}
function closeAlbum(): void { albumOpen.value = false }

// 照 Vue2 openDetachDialog :884-897(空数组直接不开)。
function openDetach(ids: Array<string | number>): void {
  if (!detail.person.value || !ids.length) return
  detachIds.value = [...ids]
  detachOpen.value = true
}
function closeDetach(): void {
  detachOpen.value = false
  detachIds.value = []
}

function openDelete(): void { deleteOpen.value = true }
function closeDelete(): void { deleteOpen.value = false }

// 照 Vue2 onOpenHeroDialog :665-672 —— 打开时预选当前 heroAssetId。
// 评审 Minor 7:原来用 `?? null` 只挡 null/undefined,但「无 hero」发给后端的值是**空串**
// (people.ts:194 `heroAssetId: assetId ?? ''`)。若后端原样回吐 `''`,`?? null` 会让
// heroSelectedId 变成 `''` —— 网格里没有任何瓦片高亮(没有 id 为空串的照片),而保存钮的
// disabled 条件 `heroSelectedId === null` 却是 false,于是「看不出选了谁但保存钮可点」,
// 点下去把空串再发一遍还 toast「背景已更新」。这里改成真值判断(照 Vue2 :667 的
// `person.heroAssetId ? … : null`),但**显式只排除 null/undefined/''**,不用 `||` ——
// 后者会把数字 id `0` 也当成"没有 hero"(与 people.ts:186-192 已登记的同一条推理一致:
// falsy 的 id 可能是合法 id,不该被静默清空)。
function openHeroPicker(): void {
  const h = detail.person.value?.heroAssetId
  heroSelectedId.value = (h === null || h === undefined || h === '') ? null : h
  heroOpen.value = true
}
function closeHeroPicker(): void {
  heroOpen.value = false
  heroSelectedId.value = null
}

// 照 Vue2 openMergeDialog :701-711。
function openMerge(): void {
  if (!people.peopleLoaded) void people.fetchPeople()
  mergeQuery.value = ''
  mergeTarget.value = null
  mergeOpen.value = true
}
function closeMerge(): void {
  mergeOpen.value = false
  mergeQuery.value = ''
  mergeTarget.value = null
}

// ── 九条动作 ────────────────────────────────────────────────────────────────

// 1) 收藏切换(Vue2 :764-768 + 偏离登记 3)。
// 守卫判断:hero 上的星标按钮在请求在途期间**一直可点**,连点会打出两次相反的 PATCH,
// 后到的响应决定最终值 —— 真实竞态,守卫有防护价值。
async function onToggleFav(): Promise<void> {
  const p = detail.person.value
  if (!p || favBusy.value) return
  favBusy.value = true
  const next = !p.favorite
  const myId = personId.value                    // 身份守卫,见"身份守卫"小节
  detail.patchPerson({ favorite: next }, myId)
  try {
    await people.setPersonFavorite(myId, next)
  } catch {
    // patchPerson 返回 false = 请求在途期间已经切到别人页了:回滚与 toast 都属于上一位人物,
    // 一起放弃(否则把 A 的旧值写进 B、还在 B 的页面上弹 A 的失败提示)。
    if (!detail.patchPerson({ favorite: !next }, myId)) return
    toast.show(t('photosPersonFavFailed'))
  } finally {
    favBusy.value = false
  }
}

// 2) 关系分组(Vue2 :951-955 + 偏离登记 4)。
// 守卫判断:选完一项菜单会关,但用户可以立刻再打开菜单选另一项 —— 与收藏同款竞态,守卫有效。
async function onPickRelation(relation: string): Promise<void> {
  const p = detail.person.value
  if (!p || relationBusy.value) return
  relationBusy.value = true
  const prev = p.relation
  const myId = personId.value                    // 身份守卫,见"身份守卫"小节
  detail.patchPerson({ relation }, myId)
  try {
    await people.setPersonRelation(myId, relation)
  } catch {
    if (!detail.patchPerson({ relation: prev }, myId)) return
    toast.show(t('photosPersonRelationFailed'))
  } finally {
    relationBusy.value = false
  }
}

// 3) 改名(Vue2 :910-918 + 偏离登记 D)。
// 守卫判断:失败路径**不关弹窗**(这是有意的),所以确认按钮在请求在途期间仍在 DOM 上且可点
// —— 连点会发两次 PATCH,守卫有防护价值。
async function confirmRename(): Promise<void> {
  const p = detail.person.value
  const v = renameInput.value.trim()
  if (!p || renaming.value) return
  // 照 Vue2 :911:空名或没改动 → 直接关,不发请求。
  if (!v || v === p.name) {
    closeRename()
    return
  }
  renaming.value = true
  const myId = personId.value                    // 身份守卫,见"身份守卫"小节
  try {
    await people.renamePerson(myId, v)
    // 已经切到别人页了:名字属于上一位人物,不写、也不动弹窗(弹窗早被 closeAllDialogs 关了)。
    if (!detail.patchPerson({ name: v }, myId)) return
    closeRename()
  } catch {
    if (!detail.isCurrent(myId)) return
    toast.show(t('photosPersonRenamedFailed'))    // 弹窗保持打开
  } finally {
    renaming.value = false
  }
}

// 4) 设为关键照片(Vue2 onSetKeyPhoto :642-662)。
// 守卫判断:成功后才退出选择态(await 之后),在途期间浮动条与按钮都还在 —— 守卫有防护价值。
async function onSetKeyPhoto(): Promise<void> {
  if (selectedIds.value.length !== 1 || !detail.person.value || keyPhotoBusy.value) return
  const assetId = selectedIds.value[0]
  keyPhotoBusy.value = true
  const myId = personId.value                    // 身份守卫,见"身份守卫"小节
  try {
    const coverFaceId = await people.setPersonCover(myId, assetId)
    // 头像/hero 背景的 URL 都把 coverFaceId 当 ?v= 用,patch 后自动 cache-bust(Vue2 :648-652)。
    // 评审必修 1:**必须**区分 undefined(后端响应里没带这个字段 → 保持本地原值)与
    // 显式 null(后端要求清空封面 → 写 null)。无条件 patch 的话,后端返回 `200 {}` 时
    // 本地 coverFaceId 会被抹成 null,PersonHero.vue:76 的 isFallback 立刻为真 ——
    // hero 大图退成渐变、200px 头像退成首字母,刷新才恢复。Vue2 :648-652 是从 store 列表
    // 读值,字段缺席时读到的就是原值,同样不会退化。
    // 身份守卫:patch 本身是有条件的(见上),所以这里用 isCurrent 单独把 toast/清选择态
    // 一起挡在门外 —— 属于上一位人物的成功提示不该弹在新页面上。
    if (!detail.isCurrent(myId)) return
    if (coverFaceId !== undefined) detail.patchPerson({ coverFaceId }, myId)
    toast.show(t('photosPersonKeyPhotoToast'))
    selectedIds.value = []
  } catch (e) {
    if (!detail.isCurrent(myId)) return
    // 404 是后端专门表达"这张照片里没有这个人的脸",必须与其它失败分成两句(Vue2 :656-657)。
    toast.show(isNotFound(e) ? t('photosPersonKeyPhotoNoFace') : t('photosPersonKeyPhotoFailed'))
  } finally {
    keyPhotoBusy.value = false
  }
}

// 5) 保存背景(Vue2 onUseKeyPhoto :675-685 / onSaveHero :688-698,偏离登记 I)。
// 守卫判断:成功才关弹窗(await 之后),在途期间两个按钮都还可点 —— 守卫有防护价值。
// 两个入口共用一个 heroSaving:它们互不调用(不会像 T5 submitCreate→pick 那样被自己的守卫误伤)。
// 文案分流(协调者裁定 3):两个入口在 Vue2 里各有一对**语义不同**的文案 ——「重置回关键
// 照片」与「改成选中的这张」,不合并。assetId === null 恰好就是「使用关键照片」这条入口
// (onSaveHero 只在 heroSelectedId 非 null 时才调用),用它做分流不需要额外参数。
async function saveHero(assetId: string | number | null): Promise<void> {
  if (!detail.person.value || heroSaving.value) return
  heroSaving.value = true
  const isReset = assetId === null
  const myId = personId.value                    // 身份守卫,见"身份守卫"小节
  try {
    await people.setPersonHero(myId, assetId)
    if (!detail.patchPerson({ heroAssetId: assetId }, myId)) return
    toast.show(t(isReset ? 'photosPersonHeroResetToast' : 'photosPersonHeroSavedToast'))
    closeHeroPicker()
  } catch {
    if (!detail.isCurrent(myId)) return
    toast.show(t(isReset ? 'photosPersonHeroResetFailed' : 'photosPersonHeroFailed'))
  } finally {
    heroSaving.value = false
  }
}
function onUseKeyPhoto(): void { void saveHero(null) }
function onSaveHero(): void {
  if (heroSelectedId.value == null) return
  void saveHero(heroSelectedId.value)
}

// 6) 合并到他人(Vue2 confirmMerge :715-727)。
// 守卫判断:弹窗在 finally 才关(await 之后),在途期间确认按钮可点 —— 守卫有防护价值。
async function confirmMerge(): Promise<void> {
  const target = mergeTarget.value
  if (!target || !detail.person.value || merging.value) return
  merging.value = true
  try {
    await people.mergePersonInto(personId.value, target.id)
    // P8a-T10:与 PhotosPeople.vue 的合并 toast 同一兜底,目标未命名时不渲染成「已合并到「」」。
    // 注:mergeCandidates(:184-188)只取 people.named,name.trim() 恒非空(偏离登记 J);
    // target 又是候选点击时捕获的对象引用,confirm 前的任何 store 写(patchPerson/fetchPeople)
    // 都是整体替换而非原地改,不会回写到这个引用上——按当前接线这条兜底分支不可达,纯防御性
    // 补齐(与另外两处保持一致,防未来候选池放开到含未命名时悄悄回归空书名号)。
    toast.show(t('photosPersonMergedToast', { name: target.name || t('photosPersonMergeAsSame') }))
    void router.push('/photos/people')            // Vue2 是 $emit('back')
  } catch {
    toast.show(t('photosPersonMergeFailed'))      // 偏离登记 H:停在当前页(照 Vue2)
  } finally {
    merging.value = false
    closeMerge()                                  // 成功失败都关(照 Vue2 :726)
  }
}

// 7) 删除人物(Vue2 confirmDeletePerson :959-972)。
// 守卫判断:**不需要**独立守卫。purgePersonWithUndo 是同步函数(T2 store:217,返回 undo 闭包
// 而不是 promise),整条路径没有 await —— 关弹窗发生在同一个同步块内,确认按钮在第二次点击
// 到来之前就已从 DOM 上消失,加 ref 只是装饰。真实防护机制 = 同步关闭弹窗(有测试钉住)。
function confirmDeletePerson(): void {
  const p = detail.person.value
  if (!p) return
  // 终审 Important 4:引号风格与列表页统一为 ASCII 双引号 —— Vue2 两处
  // (PhotosPersonDetail.vue:962 / PhotosPeopleView.vue:665)都是 `"${name}"`,已回源核对。
  const label = p.name.trim() ? `"${p.name.trim()}"` : t('photosPersonUnnamedLabel')
  const undo = people.purgePersonWithUndo(personId.value)
  closeDelete()
  void router.push('/photos/people')
  toast.show(t('photosPersonDeletedToast', { label }), 5000, {
    label: t('photosPersonUndo'),
    onClick: undo,
  })
}

// 8) 移出资产(Vue2 confirmDialog 的 detach 分支 :928-946 + 偏离登记 E)。
// 守卫判断:**不需要**独立守卫。乐观更新 + 关弹窗 + 退出选择态全部在发请求**之前**同步完成,
// 确认按钮在第二次点击到来之前就已不在 DOM 上。真实防护机制 = 同步关闭弹窗(有测试钉住)。
async function confirmDetach(): Promise<void> {
  const p = detail.person.value
  const ids = [...detachIds.value]
  if (!p || !ids.length) return
  const myId = personId.value                     // 身份守卫,见"身份守卫"小节
  detail.removePhotosLocally(ids)                 // 先乐观(同步,在 await 之前,不会串页)
  selectedIds.value = []
  closeDetach()
  try {
    await service.photos.detachAssetsFromPerson(myId, ids)
  } catch (e) {
    console.error('[person-detail] detach', e)
    if (detail.isCurrent(myId)) toast.show(t('photosPersonDetachFailed'))
  } finally {
    // 无论成败都重新对账(照 Vue2 :941 与 :945 两个分支都 loadPerson)。身份守卫:已经切到
    // 别人页时不再对账 —— 那会把刚加载好的 B 清空重拉一次(可见闪烁 + 一次多余请求)。
    if (detail.isCurrent(myId)) void detail.load(myId)
  }
}

// 9) 建相册(Vue2 confirmDialog 的 album 分支 :919-927 + 偏离登记 F)。
// 守卫判断:成功才关弹窗(await 之后),在途期间确认按钮可点,且 createAlbum 有持久副作用
// (连点真会建出两个同名相册,第二个还会 409)—— 守卫有防护价值。
async function confirmCreateAlbum(): Promise<void> {
  const name = albumInput.value.trim()
  if (!name || albumSaving.value) return
  albumSaving.value = true
  try {
    await albums.saveAsAlbum(name, albumIds.value)
    toast.show(t('photosPersonAlbumCreatedToast', { name }))
    closeAlbum()
  } catch (e) {
    toast.show(isConflict(e) ? t('photosAlbumNameExists') : t('photosPersonAlbumFailed'))
  } finally {
    albumSaving.value = false
  }
}

// ── 网格 / 灯箱 / 导航接线 ──────────────────────────────────────────────────
// T11 已在组件内部做了 selectionMode 分支(选择态 → toggle-select,否则 → open),
// 这里只接住两个 emit。
function toggleSelect(id: string | number): void {
  const i = selectedIds.value.findIndex((x) => String(x) === String(id))
  if (i >= 0) selectedIds.value.splice(i, 1)
  else selectedIds.value.push(id)
}
function exitSelectionMode(): void { selectedIds.value = [] }

// 照 Vue2 :878 —— 翻页集是**未裁剪的全量**(网格每月只渲 16 张,灯箱能翻到全部)。
function onTileClick(p: Photo): void {
  lb.openAt(p, allPhotos.value, 0)
}

async function onLightboxDelete(assetId: string | number): Promise<void> {
  // 照 PhotosAlbumDetail.vue:275-283:读 deleteAssets 的真实成功计数,4000ms 时长(P3 定的)。
  const n = await timeline.deleteAssets([String(assetId)])
  toast.show(t('photosDeletedToast', { count: n }), 4000)
  void detail.load(personId.value)
}
function openAlbumPicker(ids: Array<string | number>): void {
  albumPickerIds.value = ids
  albumPickerOpen.value = true
}

// 具名函数(照 PhotosAlbumDetail.vue:215-217):模板里内联 router.push 会把 promise 挂在事件
// 处理器上不管,导航被取消/重复时 reject 没人接住。
function goToPeopleList(): void { void router.push('/photos/people') }

// 加载失败态的重试(协调者裁定 4)。
// 评审 Minor 3(自我修正):原实现在这里加了 `if (detail.loading.value) return` 短路、模板上
// 又加了 `:disabled="detail.loading.value"` —— 两层**都不可达**:门控分支②的前提本就是
// `!loading`,按钮只在 loading 为 false 时才存在,所以 `:disabled` 恒为 false;而
// `detail.load()` 在 await 之前就同步置 loading=true,门控当帧把这个按钮整个卸载掉,
// 第二次点击根本无处可点。两层拿掉后测试仍全绿 —— 这正是 T7/T8 定过性的「装饰性守卫」,
// 按本期纪律删掉,不留下让人误以为此处有保护的代码。
// **真实防护机制 = 门控切换把按钮卸载**(有测试钉住:点一次后按钮已不在 DOM、骨架出现、
// getPerson 调用次数只 +1)。
function retryLoad(): void {
  void detail.load(personId.value)
}
function goToPerson(id: string | number): void {
  void router.push('/photos/people/' + encodeURIComponent(String(id)))
}

// ── Esc(文件头"Esc 分层"说明)────────────────────────────────────────────────
const anyDialogOpen = computed(() =>
  renameOpen.value || albumOpen.value || noPhotosOpen.value || detachOpen.value
  || deleteOpen.value || heroOpen.value || mergeOpen.value)

function onDocumentKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  // 必须挡住,否则同一次 Esc 冒泡到 window 会把灯箱一起关掉(P4 终审抓到过)。
  e.stopPropagation()
  if (renameOpen.value) { closeRename(); return }
  if (albumOpen.value) { closeAlbum(); return }
  if (noPhotosOpen.value) { noPhotosOpen.value = false; return }
  if (detachOpen.value) { closeDetach(); return }
  if (deleteOpen.value) { closeDelete(); return }
  if (heroOpen.value) { closeHeroPicker(); return }
  if (mergeOpen.value) closeMerge()
}

watch(anyDialogOpen, (open) => {
  if (open) document.addEventListener('keydown', onDocumentKeydown)
  else document.removeEventListener('keydown', onDocumentKeydown)
})
onBeforeUnmount(() => document.removeEventListener('keydown', onDocumentKeydown))

// ── 生命周期 / watch ────────────────────────────────────────────────────────
// 铁律 3:首次 load 在 setup 阶段同步发起(不放 onMounted)。
void detail.load(personId.value)
// 合并弹窗的候选列表需要人物全量列表;这里只在还没加载过时补一次。
if (!people.peopleLoaded) void people.fetchPeople()

// 铁律 2:hash 路由同组件不重建。
watch(() => route.params.id, (raw) => {
  if (raw === undefined) return                   // 偏离登记 K:已离开本路由,别白发一次 load
  selectedIds.value = []
  tab.value = 'timeline'
  closeAllDialogs()
  void detail.load(personId.value)
})
</script>

<template>
  <!-- Plan D Task 3(换壳):同 T2(PhotosPeople.vue)/PhotosAlbums.vue:353-367 的既定结构 ——
       .photos-root[themeClass] > .app[data-collapsed] > PhotosSidebar + main.main >
       PhotosTopbar + .photos-main。四态门控整体挪进 .photos-main,吃 parity 的
       .person-detail-fallback / .person-skeleton* 规则(挂在 .photos-main 的锚点上)。 -->
  <div class="photos-root" :class="themeClass">
    <div class="app" :data-collapsed="collapsed">
      <PhotosSidebar :collapsed="collapsed" />
      <main class="main">
        <!-- Fix round 1 (controller ruling on Deviation A, 2026-08-14): no `back` here —
             Vue2 truth (PhotosPeopleTopbar.vue:6-9/36) is that the People detail topbar always
             shows title+sub, never a back chevron; the back affordance lives in the hero
             (Vue2 `.detail-hero .back`; here that's PersonHero's own `hero-back` button, wired
             to `goToPeopleList` below via `@back`). PhotosTopbar's `back` prop is mutually
             exclusive with title/sub in its own template (built for PhotosSearch.vue's
             exit-search case) — passing it here would have hidden this page's title/sub
             entirely, which is what Deviation A flagged. -->
        <PhotosTopbar
          :collapsed="collapsed"
          :title="topbarTitle"
          :sub="t('photosPersonSubtitle')"
          :show-search="false"
          @toggle-collapse="onToggleCollapse"
        />
       <div class="photos-main">
        <!-- 门控 ①:还在加载且还没有数据 → 骨架 -->
        <div v-if="detail.loading.value && !detail.person.value" class="person-skeleton" data-test="person-skeleton">
          <div class="person-skeleton-hero" />
          <div class="person-skeleton-tabs" />
          <div class="person-skeleton-grid">
            <div v-for="i in 16" :key="i" class="person-skeleton-tile" />
          </div>
        </div>

        <!-- 门控 ②:加载失败(≠「没有这个人」)→ 错误文案 + 重试。协调者裁定 4:T9 的
             failed 标志就是为了让视图能区分这两种"person 为 null";Vue2 只 console.error,
             两者在界面上完全一样。 -->
        <div v-else-if="!detail.person.value && detail.failed.value" class="empty-state" data-test="person-load-failed">
          <div class="empty-state-title">{{ t('photosPersonLoadFailed') }}</div>
          <!-- 评审 Minor 3:原来这里有 :disabled="detail.loading.value" —— 门控前提本就是
               !loading,该绑定恒为 false,已删(理由见 retryLoad 注释)。 -->
          <button
            type="button" class="person-dialog-btn" data-test="person-retry"
            @click="retryLoad"
          >{{ t('photosPersonRetry') }}</button>
        </div>

        <!-- 门控 ③:加载完了确实没有这个人 -->
        <div v-else-if="!detail.person.value" class="empty-state" data-test="person-not-found">
          <div class="empty-state-title">{{ t('photosPersonNotFound') }}</div>
          <button type="button" class="person-dialog-btn" data-test="person-not-found-back" @click="goToPeopleList">
            {{ t('photosPersonBack') }}
          </button>
        </div>

        <!-- 门控 ④:正常内容 -->
        <template v-else>
          <PersonHero
            :person="detail.person.value"
            :relation-count="detail.relations.value.length"
            :places-count="detail.person.value.placesCount"
            @back="goToPeopleList"
            @toggle-fav="onToggleFav"
            @rename="openRename"
            @merge="openMerge"
            @delete="openDelete"
            @pick-relation="onPickRelation"
            @make-album="openMakeAlbum"
            @open-hero-picker="openHeroPicker"
          />

          <!-- Tabs(Vue2 :95-105)-->
          <div class="detail-tabs">
            <button
              type="button" class="detail-tab" data-test="person-tab-timeline"
              :data-active="tab === 'timeline'" @click="tab = 'timeline'"
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
              {{ t('photosPersonTabTimeline') }}
            </button>
            <button
              type="button" class="detail-tab" data-test="person-tab-places"
              :data-active="tab === 'places'" @click="tab = 'places'"
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
              {{ t('photosPersonTabPlaces') }}
            </button>
            <button
              type="button" class="detail-tab" data-test="person-tab-relations"
              :data-active="tab === 'relations'" @click="tab = 'relations'"
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.5L18 9l-4.1 1.5L12 15l-1.9-4.5L6 9l4.1-1.5z" /></svg>
              {{ t('photosPersonTabRelations') }}
            </button>
          </div>

          <div class="detail-body scroll">
            <!-- 时间线 tab:共现横条(Vue2 :108-130)+ 按月资产网格(T11)-->
            <template v-if="tab === 'timeline'">
              <div class="detail-section">
                <div class="detail-section-title">
                  {{ t('photosPersonSameFrame') }}
                  <span class="sub">{{ t('photosPersonSameFrameSub', { name: displayName }) }}</span>
                </div>
                <div class="coappear-strip">
                  <div
                    v-for="r in sortedRelations" :key="r.personId"
                    class="coappear-card" data-test="coappear-card"
                    :data-person-id="String(r.personId)"
                    @click="goToPerson(r.personId)"
                  >
                    <!-- 尺寸 72px:回 Vue2 photos-people.scss:701-703 核对得(偏离登记 L)-->
                    <PersonAvatar :person-id="r.personId" :name="r.name" :ver="r.coverFaceId" :size="72" />
                    <div class="name-row">
                      <span class="nm">{{ r.name }}</span>
                      <span class="ct">{{ r.count.toLocaleString() }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <PersonAssetGrid
                :months="detail.months.value"
                :selected="selectedIds"
                :selection-mode="selectionMode"
                @open="onTileClick"
                @toggle-select="toggleSelect"
                @detach="openDetach"
              />
            </template>

            <PersonPlacesTab
              v-else-if="tab === 'places'"
              :places="detail.places.value"
              :person-name="detail.person.value.name"
            />

            <PersonRelationsTab
              v-else
              :relations="detail.relations.value"
              :person="detail.person.value"
              :places="placeGroups"
              @open-person="goToPerson"
            />
          </div>
        </template>
       </div>
      </main>
    </div>

    <!-- Plan D Task 3(弹层归位):选择态浮动条(Vue2 :232-244)与下面的七个弹窗、
         AlbumPickerDialog 一并搬进 .photos-root 内(.app 的兄弟位)—— parity 的
         `.photos-root .selection-bar` / `.photos-root .person-dialog-scrim` 等选择器都是后代选择器,
         挂在模板根的兄弟节点上够不到(同 PhotosPeople.vue Task 2 注释的同一条道理)。
         position:fixed 意味着挪进这里不会被 .app 的 overflow:hidden 裁剪。 -->
    <div v-if="selectionMode && detail.person.value" class="selection-bar" data-test="person-selection-bar">
    <div class="selection-count">{{ t('photosSelectedCount', { count: selectedIds.length }) }}</div>
    <div class="selection-spacer" />
    <button
      v-if="selectedIds.length === 1"
      type="button" class="selection-btn selection-btn-star" data-test="person-set-key-photo"
      @click="onSetKeyPhoto"
    >
      <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M12 3.5l2.6 5.3 5.9.86-4.25 4.14 1 5.86L12 17.9l-5.25 2.76 1-5.86L3.5 9.66l5.9-.86z" /></svg>
      {{ t('photosPersonSetKeyPhoto') }}
    </button>
    <button
      type="button" class="selection-btn selection-btn-danger" data-test="person-remove-from"
      @click="openDetach(selectedIds)"
    >
      <!-- 评审必修 2:Vue2 :240 这个钮内有 x 图标(size 13),原实现漏了 -->
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
      {{ t('photosPersonRemoveFrom', { name: displayName }) }}
    </button>
    <button type="button" class="selection-btn" data-test="person-selection-cancel" @click="exitSelectionMode">
      {{ t('photosCancel') }}
    </button>
  </div>

  <!-- ── 弹窗 1:改名(Vue2 :268-285 的 rename 模式)── -->
  <div v-if="renameOpen" class="person-dialog-scrim" data-test="person-rename-dialog" @click.self="closeRename">
    <div class="person-dialog">
      <div class="person-dialog-head">
        <PersonAvatar
          :person-id="detail.person.value?.id ?? null" :name="detail.person.value?.name"
          :ver="detail.person.value?.coverFaceId ?? null" :size="48"
        />
        <div class="person-dialog-titles">
          <div class="person-dialog-title">{{ t('photosPersonRename') }}</div>
          <div class="person-dialog-sub">{{ t('photosPersonRenameHint') }}</div>
        </div>
        <button type="button" class="icon-btn" :aria-label="t('photosClose')" @click="closeRename">×</button>
      </div>
      <label class="person-dialog-label">{{ t('photosPersonNameLabel') }}</label>
      <input
        ref="renameInputRef" v-model="renameInput" class="person-dialog-input" data-test="person-rename-input"
        :placeholder="t('photosPersonNamePlaceholder')" @keydown.enter="confirmRename"
      >
      <div class="person-dialog-actions">
        <button type="button" class="person-dialog-btn" @click="closeRename">{{ t('photosCancel') }}</button>
        <button
          type="button" class="person-dialog-btn person-dialog-btn-primary" data-test="person-rename-confirm"
          :disabled="!renameInput.trim()" @click="confirmRename"
        >{{ t('photosPersonSaveName') }}</button>
      </div>
    </div>
  </div>

  <!-- ── 弹窗 2:建相册(Vue2 :268-285 的 album 模式)── -->
  <div v-if="albumOpen" class="person-dialog-scrim" data-test="person-album-dialog" @click.self="closeAlbum">
    <div class="person-dialog">
      <div class="person-dialog-head">
        <PersonAvatar
          :person-id="detail.person.value?.id ?? null" :name="detail.person.value?.name"
          :ver="detail.person.value?.coverFaceId ?? null" :size="48"
        />
        <div class="person-dialog-titles">
          <div class="person-dialog-title">{{ t('photosAlbumCreateTitle') }}</div>
          <div class="person-dialog-sub">{{ t('photosPersonAlbumHint', { n: albumIds.length }) }}</div>
        </div>
        <button type="button" class="icon-btn" :aria-label="t('photosClose')" @click="closeAlbum">×</button>
      </div>
      <label class="person-dialog-label">{{ t('photosAlbumNameLabel') }}</label>
      <input
        ref="albumInputRef" v-model="albumInput" class="person-dialog-input" data-test="person-album-input"
        :placeholder="t('photosAlbumNamePlaceholder')" @keydown.enter="confirmCreateAlbum"
      >
      <div class="person-dialog-actions">
        <button type="button" class="person-dialog-btn" @click="closeAlbum">{{ t('photosCancel') }}</button>
        <button
          type="button" class="person-dialog-btn person-dialog-btn-primary" data-test="person-album-confirm"
          :disabled="!albumInput.trim()" @click="confirmCreateAlbum"
        >{{ t('photosAlbumCreate') }}</button>
      </div>
    </div>
  </div>

  <!-- ── 弹窗 7(Vue2 promptDialog 的 info 模式 :845-851;brief 六个清单外的补齐)── -->
  <div v-if="noPhotosOpen" class="person-dialog-scrim" data-test="person-no-photos-dialog" @click.self="noPhotosOpen = false">
    <div class="person-dialog">
      <div class="person-dialog-head">
        <PersonAvatar
          :person-id="detail.person.value?.id ?? null" :name="detail.person.value?.name"
          :ver="detail.person.value?.coverFaceId ?? null" :size="48"
        />
        <div class="person-dialog-titles">
          <div class="person-dialog-title">{{ t('photosPersonNoPhotosTitle') }}</div>
          <div class="person-dialog-sub">{{ t('photosPersonNoPhotosAlbumHint') }}</div>
        </div>
        <button type="button" class="icon-btn" :aria-label="t('photosClose')" @click="noPhotosOpen = false">×</button>
      </div>
      <div class="person-dialog-actions">
        <button type="button" class="person-dialog-btn" @click="noPhotosOpen = false">{{ t('photosCancel') }}</button>
      </div>
    </div>
  </div>

  <!-- ── 弹窗 3:移出确认(Vue2 :268-285 的 detach 模式)── -->
  <div v-if="detachOpen" class="person-dialog-scrim" data-test="person-detach-dialog" @click.self="closeDetach">
    <div class="person-dialog">
      <div class="person-dialog-head">
        <PersonAvatar
          :person-id="detail.person.value?.id ?? null" :name="detail.person.value?.name"
          :ver="detail.person.value?.coverFaceId ?? null" :size="48"
        />
        <div class="person-dialog-titles">
          <div class="person-dialog-title">
            {{ detachIds.length === 1
              ? t('photosPersonDetachTitleOne', { name: displayName })
              : t('photosPersonDetachTitleMany', { name: displayName, n: detachIds.length }) }}
          </div>
          <div class="person-dialog-sub">
            {{ detachIds.length === 1
              ? t('photosPersonDetachHintOne', { name: displayName })
              : t('photosPersonDetachHintMany', { name: displayName, n: detachIds.length }) }}
          </div>
        </div>
        <button type="button" class="icon-btn" :aria-label="t('photosClose')" @click="closeDetach">×</button>
      </div>
      <div class="person-dialog-actions">
        <button type="button" class="person-dialog-btn" @click="closeDetach">{{ t('photosCancel') }}</button>
        <button
          type="button" class="person-dialog-btn person-dialog-btn-danger" data-test="person-detach-confirm"
          @click="confirmDetach"
        >{{ t('photosPersonDetachConfirm') }}</button>
      </div>
    </div>
  </div>

  <!-- ── 弹窗 4:删除人物确认(Vue2 :290-323)── -->
  <div v-if="deleteOpen" class="person-dialog-scrim" data-test="person-delete-dialog" @click.self="closeDelete">
    <div class="person-dialog">
      <div class="person-dialog-head">
        <PersonAvatar
          :person-id="detail.person.value?.id ?? null" :name="detail.person.value?.name"
          :ver="detail.person.value?.coverFaceId ?? null" :size="48"
        />
        <div class="person-dialog-titles">
          <!-- 评审 Minor 4:原来错用了 photosPersonDeleteTitle(= "删除这个人物分组?",
               T7 警示条专用的另一句,ClusterActionDialog.vue:66 注释已声明不可共用)。
               Vue2 :304 是 "Delete person?",另开专属键。 -->
          <div class="person-dialog-title">{{ t('photosPersonDeletePersonTitle') }}</div>
        </div>
        <button type="button" class="icon-btn" :aria-label="t('photosClose')" @click="closeDelete">×</button>
      </div>
      <!-- 评审 Minor 6:Vue2 :310-312 是两档灰 —— 正文(--text-2)+ 更淡的
           "You can undo within 5 seconds."(--text-3)。原实现合成了单色一条。 -->
      <div class="person-dialog-body">
        {{ t('photosPersonDeleteKeptBody') }}
        <span class="person-dialog-body-dim">{{ t('photosPersonDeleteUndoHint') }}</span>
      </div>
      <div class="person-dialog-actions">
        <button type="button" class="person-dialog-btn" @click="closeDelete">{{ t('photosCancel') }}</button>
        <button
          type="button" class="person-dialog-btn person-dialog-btn-danger" data-test="person-delete-confirm"
          @click="confirmDeletePerson"
        >
          <!-- 评审必修 2:Vue2 :319 钮内有 trash 图标(size 11),原实现漏了 -->
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
          {{ t('photosPersonDelete') }}
        </button>
      </div>
    </div>
  </div>

  <!-- ── 弹窗 5:背景选择(宽弹窗,Vue2 :325-371)── -->
  <div v-if="heroOpen" class="person-dialog-scrim" data-test="person-hero-dialog" @click.self="closeHeroPicker">
    <div class="person-dialog person-dialog-wide">
      <div class="person-dialog-head">
        <PersonAvatar
          :person-id="detail.person.value?.id ?? null" :name="detail.person.value?.name"
          :ver="detail.person.value?.coverFaceId ?? null" :size="48"
        />
        <div class="person-dialog-titles">
          <div class="person-dialog-title">{{ t('photosPersonHeroTitle') }}</div>
          <div class="person-dialog-sub">{{ t('photosPersonHeroSub') }}</div>
        </div>
        <button type="button" class="icon-btn" :aria-label="t('photosClose')" @click="closeHeroPicker">×</button>
      </div>

      <div class="hero-picker-grid">
        <button
          v-for="p in allPhotos" :key="p.id"
          type="button" class="hero-picker-tile" data-test="hero-picker-tile"
          :data-selected="String(heroSelectedId) === String(p.id)"
          @click="heroSelectedId = p.id"
        >
          <img :src="service.photos.thumbnailUrl(p.id, 'large')" alt="">
          <!-- 评审必修 2:Vue2 :352 角标是 play 图标 + 时长;同期 T11
               PersonAssetGrid.vue:118 的同一视觉元素已经渲染了 ▶,这里按同一手法补齐。 -->
          <span v-if="p.isVideo" class="tile-vid">
            <span class="vid-play">▶</span> {{ p.duration }}
          </span>
          <span v-if="String(heroSelectedId) === String(p.id)" class="hero-picker-check">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7" /></svg>
          </span>
        </button>
        <div v-if="!allPhotos.length" class="hero-picker-empty">{{ t('photosPersonNoPhotos') }}</div>
      </div>

      <div class="person-dialog-actions">
        <button type="button" class="person-dialog-btn person-dialog-btn-ghost" data-test="person-hero-use-key" @click="onUseKeyPhoto">
          {{ t('photosPersonUseKeyPhoto') }}
        </button>
        <button type="button" class="person-dialog-btn" @click="closeHeroPicker">{{ t('photosCancel') }}</button>
        <button
          type="button" class="person-dialog-btn person-dialog-btn-primary" data-test="person-hero-save"
          :disabled="heroSelectedId === null" @click="onSaveHero"
        >{{ t('photosPersonSaveHero') }}</button>
      </div>
    </div>
  </div>

  <!-- ── 弹窗 6:合并到他人(Vue2 :374-432)── -->
  <div v-if="mergeOpen" class="person-dialog-scrim" data-test="person-merge-dialog" @click.self="closeMerge">
    <div class="person-dialog">
      <div class="person-dialog-head">
        <PersonAvatar
          :person-id="detail.person.value?.id ?? null" :name="detail.person.value?.name"
          :ver="detail.person.value?.coverFaceId ?? null" :size="48"
        />
        <div class="person-dialog-titles">
          <div class="person-dialog-title">{{ t('photosPersonMergeInto') }}</div>
          <div class="person-dialog-sub">{{ t('photosPersonMergeIntoSub') }}</div>
        </div>
        <button type="button" class="icon-btn" :aria-label="t('photosClose')" @click="closeMerge">×</button>
      </div>

      <input
        v-model="mergeQuery" class="person-dialog-input" data-test="person-merge-search"
        :placeholder="t('photosPersonMergeSearch')"
      >

      <div class="merge-candidates-list">
        <button
          v-for="p in mergeCandidates" :key="p.id"
          type="button" class="merge-candidate-row" data-test="person-merge-candidate"
          :data-person-id="String(p.id)"
          :data-selected="mergeTarget !== null && String(mergeTarget.id) === String(p.id)"
          @click="mergeTarget = p"
        >
          <PersonAvatar :person-id="p.id" :name="p.name" :ver="p.coverFaceId" :size="36" />
          <span class="merge-candidate-info">
            <span class="merge-candidate-name">{{ p.name }}</span>
            <span class="merge-candidate-meta">{{ t('photosPeoplePhotosCount', { n: p.count.toLocaleString() }) }}</span>
          </span>
          <svg
            v-if="mergeTarget !== null && String(mergeTarget.id) === String(p.id)"
            class="merge-candidate-check" viewBox="0 0 24 24" width="13" height="13" fill="none"
            stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"
          ><path d="M5 13l4 4L19 7" /></svg>
        </button>
        <div v-if="!mergeCandidates.length" class="merge-candidates-empty">{{ t('photosPersonNoMatch') }}</div>
      </div>

      <div class="person-dialog-actions">
        <button type="button" class="person-dialog-btn" @click="closeMerge">{{ t('photosCancel') }}</button>
        <button
          type="button" class="person-dialog-btn person-dialog-btn-primary" data-test="person-merge-confirm"
          :disabled="mergeTarget === null" @click="confirmMerge"
        >
          <!-- 评审必修 2:Vue2 :427 选中目标后钮内有 sparkles 图标(size 13),未选中时不渲染
               (`v-if="mergeConfirmTarget"`),原实现漏了整个图标。 -->
          <svg v-if="mergeTarget !== null" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.5L18 9l-4.1 1.5L12 15l-1.9-4.5L6 9l4.1-1.5z" /></svg>
          {{ mergeTarget
            ? t('photosPersonMergeConfirm', { name: mergeTarget.name })
            : t('photosPersonMergeSelectPrompt') }}
        </button>
      </div>
    </div>
  </div>

  <AlbumPickerDialog v-model:open="albumPickerOpen" :asset-ids="albumPickerIds" @added="() => {}" />
  </div>

  <!-- Plan D Task 3(标准做法沿用):PhotoLightbox 依旧是 .photos-root 的**兄弟**,不挪进去
       —— 这是 Plan F 落地前的既定铁律(同 PhotosAlbumDetail.vue / PhotosPeople.vue 的
       PhotoLightbox 接线先例)。灯箱自身是 fixed 全屏遮罩,挪进 .photos-root 会被
       `.app` 的 overflow:hidden 裁剪;等 Plan F 统一处理灯箱定位时再一并搬,不在本任务
       越权处理。 -->
  <PhotoLightbox
    @delete="onLightboxDelete"
    @toggle-fav="() => {}"
    @add-to-album="(id) => openAlbumPicker([id])"
  />
</template>

<style scoped>
/* Plan D Task 3(换壳)shadowing cleanup: the transitional `.sidebar` width pin and the
   flex-row `.photos-layout` rule (Fix round 1's stopgap, back when this page's root only wore
   `.photos-root` without its own `.app` grid) are both dead now — the real `.app` CSS Grid
   this task gave the page supplies the sidebar's column width directly, same as
   PhotosPeople.vue/PhotosAlbums.vue's own re-skin. `.photos-main` stays: no parity selector
   exists by that name (it's this page's own scroll-region scaffolding), same as those two
   pages' own local copy. */
.photos-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }

.empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px; padding: 60px 20px; color: var(--fg-muted); text-align: center;
}
.empty-state-title { font-size: 16px; font-weight: 600; color: var(--fg); }

/* ── 骨架(New-UI 补:Vue2 person 为 null 时整个模板 v-if 掉,首帧是全白)── */
.person-skeleton { display: flex; flex-direction: column; gap: 12px; padding: 4px; }
.person-skeleton-hero { height: 280px; border-radius: 20px; background: var(--skeleton-bg); }
.person-skeleton-tabs { height: 42px; border-radius: 10px; background: var(--skeleton-bg); }
.person-skeleton-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 3px; }
.person-skeleton-tile { aspect-ratio: 1; border-radius: 3px; background: var(--skeleton-bg); }

/* ── Tabs(照 photos-people.scss:445-465;Vue2 的 --line/--text-3/--text-1 代以
      --divider/--fg-muted/--fg)── */
.detail-tabs {
  flex: none; display: flex; gap: 4px; padding: 0 8px;
  border-bottom: 1px solid var(--divider);
}
.detail-tab {
  padding: 12px 14px 11px; font: inherit; font-size: 13px; font-weight: 500;
  color: var(--fg-muted); background: transparent; border: 0;
  border-bottom: 2px solid transparent; margin-bottom: -1px; cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px;
}
.detail-tab:hover { color: var(--fg); }
.detail-tab[data-active="true"] { color: var(--fg); border-bottom-color: var(--accent); }

/* ── Body(照 photos-people.scss:467-472)── */
.detail-body { flex: 1; min-height: 0; overflow-y: auto; padding: 24px 8px 80px; }

/* ── 共现横条(照 photos-people.scss:685-722)── */
.detail-section { margin-top: 8px; margin-bottom: 22px; }
.detail-section-title {
  font-family: var(--font); font-size: 16px; font-weight: 600; letter-spacing: -0.01em;
  margin: 0 0 14px; display: flex; align-items: baseline; gap: 10px; color: var(--fg);
}
.detail-section-title .sub {
  font-family: var(--font); font-size: 12px; font-weight: 400;
  color: var(--fg-muted); letter-spacing: 0;
}
.coappear-strip { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 4px; }
.coappear-strip::-webkit-scrollbar { height: 0; }
.coappear-card {
  flex: none; width: 96px; display: flex; flex-direction: column; align-items: center;
  gap: 6px; padding: 8px 4px; border-radius: var(--radius-sm); cursor: pointer;
}
.coappear-card:hover { background: var(--hover); }
.coappear-card .name-row { display: inline-flex; align-items: baseline; gap: 6px; max-width: 100%; }
.coappear-card .nm {
  font-size: 12px; font-weight: 500; max-width: 88px; color: var(--fg);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.coappear-card .ct { font-size: 11px; color: var(--fg-muted); font-variant-numeric: tabular-nums; }

/* ── 选择态浮动条(照 Vue2 :1224-1276;--pop-bg → --popup-bg,--ink 混色 → --chip-bg)── */
.selection-bar {
  position: fixed; left: 50%; transform: translateX(-50%); bottom: 24px; z-index: 150;
  display: flex; align-items: center; gap: 12px; padding: 10px 14px;
  background: var(--popup-bg); border: 1px solid var(--card-border);
  border-radius: 14px; box-shadow: var(--card-shadow-hi);
  backdrop-filter: var(--blur); min-width: 360px;
}
.selection-count { font-size: 13px; font-weight: 600; color: var(--fg); font-variant-numeric: tabular-nums; }
.selection-spacer { flex: 1; }
.selection-btn {
  display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 14px;
  font: inherit; font-size: 12.5px; font-weight: 500; color: var(--fg);
  background: var(--chip-bg); border: 1px solid var(--chip-border);
  border-radius: 999px; cursor: pointer;
}
.selection-btn:hover { background: var(--chip-bg-hi); }
/* --star-fg 两套主题都不各自定义,是本仓已确立的先例(PhotosGrid.vue / PersonAvatar.vue /
   PersonHero.vue 均为 var(--star-fg, #ffd60a))——固定金色星标跨皮肤不变,用 var(fallback)
   形式表达,color-guard 按 token 用法放行。 */
.selection-btn-star {
  color: var(--star-fg, #ffd60a);
  background: color-mix(in srgb, var(--star-fg, #ffd60a) 12%, transparent);
  border-color: color-mix(in srgb, var(--star-fg, #ffd60a) 30%, transparent);
  font-weight: 600;
}
.selection-btn-star:hover { background: color-mix(in srgb, var(--star-fg, #ffd60a) 20%, transparent); }
.selection-btn-danger {
  color: var(--remove-fg);
  background: color-mix(in srgb, var(--remove-fg) 12%, transparent);
  border-color: color-mix(in srgb, var(--remove-fg) 40%, transparent);
  font-weight: 600;
}
.selection-btn-danger:hover { background: color-mix(in srgb, var(--remove-fg) 20%, transparent); }

/* ── 弹窗外壳(Plan D Task 4:七个弹窗的 pd-* 类名工程 + scoped 清零)──────────────
   模板类名已全部改锚到 Vue2 的 person-dialog-* / hero-picker-* / merge-candidate(s)-*
   家族,parity(photos-people.scss)已经落位这整套规则(含本任务新补的
   .person-dialog-body(-dim)/.person-dialog-btn-danger/.hero-picker-empty/
   .merge-candidate-check/.merge-candidates-empty),下面这套 New-UI 本地 scoped
   规则因此全部作废、删除。只留两条真正无法被 parity 覆盖的幸存者(见各自注释)。 */

/* Survivor 1: parity 的 .person-dialog-btn 与 Vue2 自身逐字一致 —— Vue2 源
   (NimoOS-UI/.../PhotosPersonDetail.vue:1476-1488)本就没有 flex 布局,因为 Vue2 的图标
   走 <photos-icon> 组件、自带对齐。New-UI 的删除确认 / 合并确认按钮内嵌的是裸 <svg> +
   文本,没有这层布局就会图标与文字错位对不齐(基线不一致)。这是 New-UI 自己的排版增强,
   不是 parity 遗漏,所以留在本地、不塞进 parity(parity 必须逐字忠于 Vue2)。 */
.person-dialog-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
}

/* Survivor 2: 与 T11 PersonAssetGrid.vue 的 .vid-play 逐字同款(同一视觉元素,同一字号)——
   Vue2 这里没有对应类(用 <photos-icon name="play"/>),.vid-play 是 New-UI 自己给 ▶
   字符定字号的手段,PersonAssetGrid.vue 保留了它自己的一份本地 scoped 副本,这里同款
   留一份,不挪进 parity(parity 只收跨组件共享的全局规则)。 */
.vid-play { font-size: 7px; }

@media (max-width: 768px) {
  .person-skeleton-grid { grid-template-columns: repeat(4, 1fr); }
}
</style>
