<!--
  SP8-P5f Task 5 —— 「索引目录」页(rail 第 7 项,路由 `/ai/knowledge/roots`),
  1:1 移植自 Vue2 蓝本 `NimoOS-UI` @ `7a6ee6b7`
  `src/views/AI/Knowledge/RootsView.vue`(289 行,`git -C ../../NimoOS-UI show 7a6ee6b7:` 读取
  —— 治理 §0.4:那个仓的工作树是别的分支,不可信)。

  结构对照(蓝本行区间 → 本文件):
    :2-4     `.k-view` → `.k-scroll` → `.k-scroll-inner` 三层壳(逐层照抄)
    :5-40    区头(标题 / 副标题 / 右上「添加索引目录」)+ 空态 `.kr-empty` / 列表 `.k-set-card` 两侧
    :43-91   「添加索引目录」弹窗(**K57:转 reka 原语 + portal 到 `.knowledge-app`**)
    :93-120  「删除索引目录?」确认弹窗(同上)
    :131-141 `data()` 的七项页面级瞬态 → 组件本地 `ref`
    :142-148 `computed`(roots / canSubmit / browserRoots)
    :149-151 `created()` → `onMounted()`
    :152-219 `methods` → 普通函数

  ─────────────────────────────────────────────────────────────────────────────
  【零 style 块 —— K44 / K53 / 治理 §3】本页蓝本自带 `<style lang="scss" scoped>`
    (`:223-289`,66 行 / 9 个 `kr-*` 类:`.kr-empty` `.kr-path` `.kr-badge` `.kr-label`
    `.kr-input` `.kr-adv-row` `.kr-error` `.kr-check` `.kr-hint`),已由 **T2** 整块搬进
    `src/ai/styles/knowledge.scss`(嵌在 `.knowledge-app` 下,K9)并过评审 ⇒ **本文件
    一个 style 块都没有**。`knowledge.scss` 由 `KnowledgeLayout.vue` 侧 import,
    本文件不再 import 样式(先例:`QueueView.vue` / `SettingsView.vue` / `AllowlistView.vue`)。
    守卫:`knowledgeStyles.test.ts` 的 K44 参数化断言(T2b 布,裁定 R20 C-1)——
    它**先剥注释、再行首锚定**,所以上面这句话本身不会把它撞红(裁定 **R19** 的直接后果)。
    另外本文件必须在 `knowledgeStyles.test.ts` 的 `KNOWLEDGE_VUE_FILES` 清单里登记
    (集合相等防漂移;不登记 = 那条断言报红,**那是正确行为,不许去改断言**)。

  【K54 —— 两处 `var(--x, <字面量>)` 兜底已在 scss 侧去掉】蓝本 `:243` 的
    `var(--bg-tertiary, …)` → `var(--bg-chip)`、`:254` 的 `var(--border, …)` → `var(--line)`
    (附录 B §B.2,取值定死)。**那两处在 scss 里,本文件不涉及**;此处登记以免下一刀漏掉。
    ⚠️ 裁定 **R8**:`--bg-tertiary` 在两侧都零声明 ⇒ 兜底一直在生效 ⇒ `.kr-badge`
    换 token 是**可见变化,不是等价替换**(验收清单已写明要顺带看一眼那个小徽标)。

  【K1 —— store 降层,逐处】蓝本 `this.store.state.wikiRoots`(`:143`)/
    `this.store.state.wikiRootsLoading`(`:13`)/ `this.store.state.wikiCandidates`(`:146`),
    本仓 `knowledgeStore` 是 Pinia setup store,**`state` 那一层整个消失**
    → `store.wikiRoots` / `store.wikiRootsLoading` / `store.wikiCandidates`。
    降层点共 **3 处**(computed 2 + 模板 1)—— 漏一处那一块整个空白且不报错。

  【K57 —— 两个弹窗转 reka 原语】蓝本 `:44` / `:94` 都是裸 `.k-modal-bg` +
    遮罩 `@click="adding = false"` / `@click="deleting = null"` + 内层 `@click.stop`。
    本仓改 `DialogRoot` / `DialogPortal to=".knowledge-app" defer` /
    `DialogOverlay class="k-modal-bg"` / `DialogContent class="k-modal"`,
    结构照既有先例 `SettingsView.vue`(K29 落地)与同期 `AllowlistView.vue`(T4)**抄同一份**,
    **不自创第二套**。三处映射:
      · 遮罩点击关闭 / 点弹窗内不关闭 → `DialogContent` 的 `pointerDownOutside`(等价),
        🔴 **不再写 `@click.stop`**;
      · 新增弹窗的三条关闭路径(× / 取消 / 点遮罩)都只把 `adding` 置 false ⇒
        `@update:open` 直接写 `adding = $event`(同 `AllowlistView`);
        删除弹窗的 state 是**对象**(`deleting`)而不是布尔 ⇒ 需要一个具名回调
        `onDeletingOpen`,把「关闭」翻译成 `deleting = null`。
        🔴 **蓝本关闭时并不重置 `purgeFiles`**(只有 `confirmDelete` 才重置,`:218`)
        ⇒ 本仓照抄,`onDeletingOpen` 里**不**碰 `purgeFiles`。
      · reka 的 a11y 要求一个 `DialogTitle`。**两个弹窗蓝本 `:47` / `:97` 本来就有
        `.k-modal-title`** → 用 `<DialogTitle as-child>` 直接套在那个 div 上,DOM 结构与蓝本
        逐字一致(不多一个隐藏节点),**不需要 `VisuallyHidden`** —— 同 `SettingsView` 的选择。
    ⚠️ `DialogPortal to=".knowledge-app"` **只认第一个同名宿主**(P5b 交接项 #3)。
      本页在生产里挂在 `KnowledgeLayout.vue` 之下,而 `.knowledge-app` 这个 class 全仓
      **只有 `KnowledgeLayout.vue` 一处**在渲染 ⇒ 同一时刻页面上有且只有一个宿主,
      `to` 指哪个不存在歧义。测试里自己在 body 备一个宿主(`RootsView.test.ts` 的 `withHost()`)。
    ⚠️ **两个弹窗同时最多只开一个**(`adding` 与 `deleting` 互不触发),两个 Portal 指向
      同一个宿主也不冲突 —— 关着的那个 `DialogContent` 根本不渲染内容。

  【K58 / K59 —— 错误提示的两条落法】
    · **K59(弹窗内联)**:蓝本 `:77-81` 的 `.kr-error` 本来就是**弹窗内的行内块**,
      **不是 toast** ⇒ 这一半是照抄。🔴 顺带兑现记忆 `newui-dialog-error-not-toast`:
      toast 是 `z-index: 60`、弹窗遮罩 1000 还带 blur,**弹窗内的错误一律内联**,
      写成 toast 会被遮罩压住 + 糊掉。
      偏离的是另一半:蓝本 `:202` 直接把 `e.response.data.message` 回显进 `addError`
      (K5/K58 明令禁止回显后端 body)⇒ 本仓非 409 分支改走固定 i18n 键。
    · **K58(形态 A)**:`p5f-task-0-report.md` §12 认定的既定做法 ——
      **catch 里丢掉 `e.message`,只弹一个固定 i18n 键,且「无第二句可拼故不留 `': '` 前缀」**
      (先例 `QueueView.vue:212-217` / `IndexedFilesView.vue:592-593` / `NoteEditPane.vue:461`)。
      蓝本四处 `$t('Operation failed') + ': ' + (e.message || e)`(`:171` `:180` `:216`)与
      `addError = e.response.data.message`(`:202`)全部落成固定键 `aiKbOpFailed`。
      **不自造第二套映射。**
      🔴 **两个例外照抄(形态 B 的同族,第二句是蓝本固有的固定文案,不是后端 body)**:
      `toggle()` 的 404 专属文案(N51)与 `submit()` 的 409 只读文案(N50)。
      落地判据是**排除式断言**(见测试文件 K58 那一组:让 store action reject 一个带可识别
      文本的错误,断言 toast 文本与整页 DOM 都**不含**那段文本)。
      ⚠️ 那个探针文本**故意不出现在本文件里**(治理 §9:否定式断言撞注释 = 假报红)。

  【K27 同族 —— toast 一律走 `store.toast(...)`】裁定 **R27** / 勘误 **E-62**:
    `knowledgeStore.ts` 里 `toast()` 内部是 `useToast().show(msg, 2400)`,而**全局 `show()`
    默认只有 1500ms** ⇒ 直调 `useToast()` 会丢掉蓝本自己的 2400ms。既有 7 页全走
    `store.toast()`,本页照同一份 —— 共 **7 处** = toggle 2(成功 + catch)+ rescan 2 +
    confirmDelete 2 + submit 成功 1。🔴 **submit 的失败路径按 K59 走弹窗内联,不弹 toast**
    ⇒ 它是本页唯一「有 catch 但不 toast」的分支,别照着别处的模具顺手补一个。

  ═══════════════════ 照抄申报(§3.5 的 N 条目)═══════════════════

  【N46 —— 🔴 本期最容易搞错的一点】Wiki 的 `WikiRoot` / `CreateArgs` **Go 结构体无 json tag**
    ⇒ HTTP 响应是 **PascalCase**、POST body 必须用 **Go 字段名**(Go 解码器大小写不敏感
    但**下划线不匹配**,`watch_mode` 会被**静默丢弃**、真机无报错)。
    🔴 **双向归一化已在共享包里**(`NimoOS-Service/src/wiki.ts:85` `normalizeRoot` /
    `:136` `createRootBody`)⇒ **store 出口一律 camelCase**(T0 实测定案,
    `p5f-task-0-report.md` §4.4),本页只消费 `r.id` / `r.path` / `r.enabled` /
    `r.watchMode` / `r.scanIntervalS` / `r.lastScanAt`,**不许在页面里再归一化一次**。
    🔴 **发 body 一律经共享包的 `createRootBody`,本仓不重写**(D3 已进包)。

  【N49 —— Go nil slice 兜底】`pickerRoots(...)` 自己带 `(candidates || [])`
    (`util/folderBrowser.ts:75`),本页把 `store.wikiCandidates` 原样递进去即可。

  【N50 —— 409 → 镜像模式重试,照抄】蓝本 `:196-206`。
    ⚠️ `storage_mode=mirror` **后端从未实现**(记忆 + `NimoOS-Wiki/OVERVIEW.md`,勘误 **E-64**)
    ⇒ **界面照抄,不许删按钮**;验收清单已写明「镜像模式后端未实现,点了不会生效」。
    ⚠️ §9.17:本机 `/v1/wiki/roots` 是**超时**不是 409 ⇒ 这条分支**真机不可达**,只在单测里验。

  【N51 —— `toggle()` 的 404 专属文案,照抄】蓝本 `:168-170`。这是蓝本对**本期正在发生的
    后端落后**的专门提示。

  ═══════════════════ 🔴🔴 `toggle()` 的 toast 方向:**不是蓝本 bug**(裁定 R9)═══════════════════

  蓝本 `:163-173`:
      await this.store.actions.setRootEnabled(r.id, !r.enabled)
      this.store.actions.toast(r.enabled ? $t('Root enabled') : $t('Root disabled'))
  乍看「调的是 `!r.enabled`、读的却是 `r.enabled`」= 文案反了。**逐步推演后并不反**:
    ① `!r.enabled` 在**调用发生前**求值 —— 它就是**目标态**(旧值取反);
    ② `setRootEnabled`(`knowledgeStore.ts:736-747`)是**乐观更新**:
       `root.enabled = enabled` 写在 `await` **之前**,即请求还没发出去就已就地改好;
    ③ `v-for="r in roots"` 里的 `r` 与 store 里 `wikiRoots.value.find(...)` 拿到的
       **是同一个对象引用**(store 只改字段,没有替换数组元素)⇒ `r.enabled` 与 `root.enabled`
       是同一格内存;
    ④ 所以 `await` 落地后读到的 `r.enabled` **已经是新值** ⇒ 文案方向正确;
    ⑤ 失败路径:`setRootEnabled` 先回滚 `root.enabled = prev` 再 `throw` ⇒ 走 catch,
       **那行成功 toast 根本不执行**。
  ⇒ 按裁定 **R9**「论证为什么不是 bug」的那一支:**逐字照抄,不改逻辑。**

  🔴 **但这条正确性完全挂在「store 就地改的是同一个对象」这个不变量上**,而本仓 store 是
    Pinia `ref<WikiRoot[]>` —— 将来 `loadRoots` 若改成整体替换数组、或 `setRootEnabled` 改成
    `wikiRoots.value = wikiRoots.value.map(...)`,**这里会静默变错**(界面开关照翻,只有 toast
    文案反过来,三门也不会响)。⇒ 测试里配了守卫用例(见 `RootsView.test.ts` 的
    「R9 不变量」一组):「成功后 toast 文案是**新**状态」两侧 +「失败时**不弹**成功 toast」。
    🔴 **判据订正(申报裁定 R18)**:裁定 R9 给的判据「把 `root.enabled = enabled` 挪到
    `await` 之后」**实测不报红**(60/60 仍全绿)—— 那行挪到 `await` 之后仍在
    `setRootEnabled` **函数内部**,而调用方是在该函数返回之后才恢复的,赋值早已完成。
    **实测成立的判据 = 把就地改换成整体替换数组**
    (`wikiRoots.value = wikiRoots.value.map((r) => (r.id === id ? { ...r, enabled } : r))`)
    → **3 条报红**。理由与落地证据见 `RootsView.test.ts` 的「R9 不变量」注释与 T5 报告 §7。

  ═══════════════════ Vue2 → Vue3 强制改写(治理 §2,不算偏离)═══════════════════
    | 蓝本(Options API) | 本文件 | 依据 |
    |---|---|---|
    | `data()` 对象 | `ref()` | `<script setup>` 无 `this` |
    | `computed: { roots/canSubmit/browserRoots }` | `computed()` | 同上 |
    | `created()` | `onMounted()` | 蓝本那一发 `loadRoots()` 同样**不阻塞首屏**(它没 await) |
    | `methods: { … }` | 普通函数 | 同上 |
    | `this.$refs.fb` | `ref<InstanceType<typeof FolderBrowser>>` | `FolderBrowser.vue:97` 有 `defineExpose({ reset })` |
    | `this.$nextTick` | `nextTick` | 同上 |
    | `this.$t` | `useI18n().t` | 本仓既定 |
    | `this.store.actions.x()` | `store.x()` | Pinia setup store 无 `actions` 那一层 |
    | `methods: { fmtAgo }` | 直接 `import { fmtAgo }` | 蓝本把它挂进 methods 只为模板可见 |

  🔴 **零 `any`**(承 K41):`WikiRoot` 类型直接从共享包 import;HTTP 状态码的取法收在
    本文件的 `httpStatus(e: unknown)` 里,用类型收窄而不是 `as any`。
  🔴 `confirmDelete()` 里多出的 `if (!r) return` 是 **TS 的 null 收窄要求**
    (蓝本 `deleting` 无类型,本仓是 `WikiRoot | null`)—— **不可达分支**:
    该函数只能从「只在 `deleting` 非空时才渲染」的弹窗里点到。
-->
<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
} from 'reka-ui'
import { createRootBody } from '@nimotech/nimoos-service'
import type { WikiRoot } from '@nimotech/nimoos-service'
import KIcon from '../components/KIcon.vue'
import FolderBrowser from '../components/FolderBrowser.vue'
import { pickerRoots } from '../util/folderBrowser'
import { useKnowledgeStore, fmtAgo } from '../stores/knowledgeStore'

const { t } = useI18n()
const store = useKnowledgeStore()

/** 蓝本 `:139` 的 `form` 四字段。`hours` 是**小时**(送进 `createRootBody` 的
 *  `scanIntervalH`,包内 `* 3600` 换成秒);`watchMode` 是 `'auto' | 'scan_only'`
 *  两个后端枚举串,**照抄不改**。 */
interface RootForm {
  path: string
  watchMode: string
  hours: number
  advOpen: boolean
}

/** 蓝本 `:135-140` 的初值 —— `openAdd()`(`:154`)每次重置回**这一份**,逐字同值。 */
function emptyForm(): RootForm {
  return { path: '', watchMode: 'auto', hours: 6, advOpen: false }
}

/* ── 蓝本 data()(`:132-140`)的七项页面级瞬态,一律组件本地 ref,不塞 store(治理 §5.1)── */

/** 蓝本 `:134` —— 「添加索引目录」弹窗开关。 */
const adding = ref(false)
/** 蓝本 `:135` —— 删除确认弹窗的目标行(null = 不开)。 */
const deleting = ref<WikiRoot | null>(null)
/** 蓝本 `:136` —— 删除时是否连 `.wiki.md` 一起清掉。 */
const purgeFiles = ref(false)
/** 蓝本 `:137` —— 提交门(治理 §5.2:蓝本自带,照抄)。 */
const submitting = ref(false)
/** 蓝本 `:138` —— K59:弹窗**内联**错误文案(不是 toast)。 */
const addError = ref('')
/** 蓝本 `:139` —— 409 时才为 true,决定「以镜像模式添加」按钮出不出(N50)。 */
const mirrorOffer = ref(false)
/** 蓝本 `:140`。 */
const form = ref<RootForm>(emptyForm())

/** 蓝本 `:53` 的 `ref="fb"` —— Vue3 里靠 `defineExpose({ reset })` 拿到实例方法。 */
const fb = ref<InstanceType<typeof FolderBrowser> | null>(null)

/** 蓝本 `:143`(K1 降层:`store.state.wikiRoots` → `store.wikiRoots`)。 */
const roots = computed<WikiRoot[]>(() => store.wikiRoots)

/** 蓝本 `:144` —— 只认绝对路径。`submit()` 里也再守一次(治理 §5.2)。 */
const canSubmit = computed<boolean>(() => form.value.path.startsWith('/'))

/** 蓝本 `:145-147`(K1 降层 + N49:`pickerRoots` 自带 `(candidates || [])` 兜底)。 */
const browserRoots = computed(() => pickerRoots(store.wikiCandidates))

/** 蓝本 `:149-151` 的 `created()`。蓝本没有 await、也没有 catch —— 照抄
 *  (`loadRoots` 自己带 catch + toast,`knowledgeStore.ts:661-663`)。 */
onMounted(() => {
  store.loadRoots()
})

/**
 * 从 axios 错误里取 HTTP 状态码。**零 `any`**(承 K41):用 `in` 收窄,不做断言式转型。
 * 蓝本写的是 `e && e.response && e.response.status === 404`(`:168`)/
 * `e && e.response && e.response.status`(`:195`)—— 语义逐字相同,只是收进一个函数。
 */
function httpStatus(e: unknown): number | undefined {
  if (e && typeof e === 'object' && 'response' in e) {
    const res = (e as { response?: { status?: number } }).response
    if (res && typeof res.status === 'number') return res.status
  }
  return undefined
}

/**
 * 蓝本 `:153-160` —— 打开新增弹窗:重置表单 / 清错误 / 开弹窗 / 拉候选 /
 * **`$nextTick` 里把 `FolderBrowser` 归位**。
 * 🔴 那一发 `reset()` 不能省:弹窗关掉时 `FolderBrowser` 内部的 `current` / `entries`
 * 还停在上次浏览到的目录,不重置的话下次打开会看见上一次的中间态。
 * 🔴 `nextTick` 也不能省:`adding = true` 这一刻 `DialogContent` 还没渲染,
 * `fb.value` 仍是 null。
 */
function openAdd(): void {
  form.value = emptyForm()
  addError.value = ''
  mirrorOffer.value = false
  adding.value = true
  store.loadCandidates()
  nextTick(() => {
    fb.value?.reset()
  })
}

/** 蓝本 `:161-163` —— 空路径不回填(点根层面包屑时 `FolderBrowser` 本来就不 emit)。 */
function onBrowsePick(path: string): void {
  if (path) form.value.path = path
}

/**
 * 蓝本 `:164-174` —— 🔴 **裁定 R9:文案方向不是 bug**,完整推演见文件头。
 * 一句话:`setRootEnabled` 在 `await` **之前**就把 `root.enabled` 就地改成新值,
 * 而 `r` 与 store 里那个 `root` 是**同一个对象** ⇒ 这里读到的已是新状态。
 * 失败路径回滚并 `throw` ⇒ 走 catch,成功 toast 不执行。
 * N51:404 是**专属文案**(后端落后的专门提示),照抄;其余错走 K58 形态 A。
 */
async function toggle(r: WikiRoot): Promise<void> {
  try {
    await store.setRootEnabled(r.id, !r.enabled)
    store.toast(r.enabled ? t('aiKbRtRootEnabled') : t('aiKbRtRootDisabled'))
  } catch (e) {
    store.toast(httpStatus(e) === 404 ? t('aiKbRtBackendTooOld') : t('aiKbOpFailed'))
  }
}

/** 蓝本 `:175-182`。K58 形态 A:失败只弹固定键,不回显后端 body。 */
async function rescan(r: WikiRoot): Promise<void> {
  try {
    await store.rescanRoot(r.id)
    store.toast(t('aiKbRescanStarted'))
  } catch {
    store.toast(t('aiKbOpFailed'))
  }
}

/**
 * 蓝本 `:183-208`。
 * · `submitting` 门是蓝本自带的(治理 §5.2),照抄 —— 重复点击不发第二发。
 * · **K59**:错误一律写进 `addError`(弹窗内联),**不弹 toast**。
 * · **N50**:409 → 只读文案 + 「以镜像模式添加」按钮(该按钮再调 `submit(true)`)。
 * · **K58**:非 409 分支蓝本回显 `e.response.data.message`,本仓改固定键。
 * · **N46**:body 一律经共享包 `createRootBody`,三个入参 `watchMode` / `scanIntervalH` /
 *   `mirror` 必须真的传到位 —— 传丢了后端会**静默忽略**,真机无报错。
 */
async function submit(mirror: boolean): Promise<void> {
  if (!canSubmit.value || submitting.value) return
  submitting.value = true
  addError.value = ''
  mirrorOffer.value = false
  try {
    await store.createRoot(
      createRootBody({
        path: form.value.path,
        watchMode: form.value.watchMode,
        scanIntervalH: form.value.hours,
        mirror,
      }),
    )
    adding.value = false
    store.toast(t('aiKbRtRootAdded'))
  } catch (e) {
    if (httpStatus(e) === 409) {
      addError.value = t('aiKbRtReadOnly')
      mirrorOffer.value = true
    } else {
      addError.value = t('aiKbOpFailed')
    }
  } finally {
    submitting.value = false
  }
}

/**
 * 蓝本 `:209-219` —— 成功/失败**都**关弹窗并把 `purgeFiles` 归位
 * (那两行在 try/catch **之外**,照抄)。
 */
async function confirmDelete(): Promise<void> {
  const r = deleting.value
  // TS null 收窄(蓝本无此行);不可达 —— 本函数只能从 `deleting` 非空时渲染的弹窗里点到。
  if (!r) return
  try {
    await store.deleteRoot(r.id, purgeFiles.value)
    store.toast(t('aiKbRtRootDeleted'))
  } catch {
    store.toast(t('aiKbOpFailed'))
  }
  deleting.value = null
  purgeFiles.value = false
}

/** K57 —— 删除弹窗的 state 是对象不是布尔,`@update:open` 需要一个翻译层。
 *  🔴 蓝本三条关闭路径(× / 取消 / 点遮罩)**都只把 `deleting` 置 null**,
 *  **不重置 `purgeFiles`**(只有 `confirmDelete` 才重置,`:218`)—— 照抄。 */
function onDeletingOpen(open: boolean): void {
  if (!open) deleting.value = null
}
</script>

<template>
  <div class="k-view">
    <div class="k-scroll">
      <div class="k-scroll-inner">
        <div class="k-section">
          <!-- 区头(蓝本 :6-11)-->
          <div class="k-section-head">
            <div class="k-section-title">{{ t('aiKbNavRoots') }}</div>
            <div class="k-section-hint">{{ t('aiKbRtSubtitle') }}</div>
            <button class="k-btn primary" style="margin-left: auto" @click="openAdd">
              <KIcon name="plus" :size="12" /> {{ t('aiKbRtAddRoot') }}
            </button>
          </div>
          <div class="k-section-body">
            <!-- 空态(蓝本 :13-19)—— 🔴 §9.17:本机 `/v1/wiki/roots` 超时 ⇒ 这是唯一可达态。 -->
            <div v-if="!roots.length && !store.wikiRootsLoading" class="kr-empty">
              <!-- 蓝本 :15 的 `color="var(--text-tertiary)"` 已经是 token,照抄(附录 B §B.5)。 -->
              <KIcon name="folder" :size="28" color="var(--text-tertiary)" />
              <div>{{ t('aiKbRtEmpty') }}</div>
              <button class="k-btn primary" @click="openAdd">
                <KIcon name="plus" :size="12" /> {{ t('aiKbRtAddRoot') }}
              </button>
            </div>
            <!-- 列表(蓝本 :20-40)-->
            <div v-else class="k-set-card" style="margin: 12px 16px">
              <div v-for="r in roots" :key="r.id" class="k-set-row">
                <div class="k-set-row-info">
                  <div class="k-set-row-title kr-path" :data-off="String(!r.enabled)">
                    {{ r.path }}
                  </div>
                  <div class="k-set-row-desc">
                    <span class="kr-badge">{{
                      r.watchMode === 'auto' ? t('aiKbRealtimeWatch') : t('aiKbScheduledScanOnly')
                    }}</span>
                    ·
                    {{ t('aiKbRtScanEvery', { h: Math.max(1, Math.round(r.scanIntervalS / 3600)) }) }}
                    · {{ t('aiKbLastScan') }} {{ r.lastScanAt ? fmtAgo(r.lastScanAt) : t('aiKbNever') }}
                  </div>
                </div>
                <button
                  class="k-btn ghost"
                  :disabled="!r.enabled"
                  :title="t('aiKbRtRescanNow')"
                  @click="rescan(r)"
                >
                  <KIcon name="refresh" :size="13" />
                </button>
                <button class="k-btn ghost" :title="t('aiKbRtDelete')" @click="deleting = r">
                  <KIcon name="trash" :size="13" />
                </button>
                <button class="k-sw" :data-on="String(r.enabled)" @click="toggle(r)" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add modal(蓝本 :43-91)—— K57:reka Dialog 原语,portal 到知识库容器。
         蓝本的「点遮罩关闭 / 点弹窗内不关闭」由 DialogContent 的 pointerDownOutside 等价表达。 -->
    <DialogRoot :open="adding" @update:open="adding = $event">
      <DialogPortal to=".knowledge-app" defer>
        <DialogOverlay class="k-modal-bg">
          <DialogContent class="k-modal" :aria-describedby="undefined">
            <div class="k-modal-head">
              <DialogTitle as-child>
                <div class="k-modal-title">{{ t('aiKbRtAddRoot') }}</div>
              </DialogTitle>
              <button class="k-modal-x" @click="adding = false">
                <KIcon name="x" :size="12" />
              </button>
            </div>
            <div class="k-modal-body">
              <FolderBrowser
                ref="fb"
                style="margin-top: 0"
                :roots="browserRoots"
                @pick="onBrowsePick"
              />

              <div class="kr-label">{{ t('aiKbRtSelectedPath') }}</div>
              <input
                v-model.trim="form.path"
                class="kr-input"
                type="text"
                placeholder="/DATA"
                spellcheck="false"
              />

              <button
                class="k-adv-toggle"
                style="margin-top: 12px"
                :data-open="String(form.advOpen)"
                @click="form.advOpen = !form.advOpen"
              >
                <span class="chev"><KIcon name="chev" :size="11" /></span>
                <KIcon name="settings" :size="12" />
                {{ t('aiKbRtAdvancedOptions') }}
              </button>
              <template v-if="form.advOpen">
                <div class="kr-adv-row">
                  <span>{{ t('aiKbRtWatchMode') }}</span>
                  <div class="k-radio-group">
                    <button
                      :data-on="String(form.watchMode === 'auto')"
                      @click="form.watchMode = 'auto'"
                    >
                      {{ t('aiKbRtWatchAuto') }}
                    </button>
                    <button
                      :data-on="String(form.watchMode === 'scan_only')"
                      @click="form.watchMode = 'scan_only'"
                    >
                      {{ t('aiKbRtWatchScanOnly') }}
                    </button>
                  </div>
                </div>
                <div class="kr-adv-row">
                  <span>{{ t('aiKbRtScanInterval') }}</span>
                  <input
                    v-model.number="form.hours"
                    class="kr-input"
                    style="width: 90px"
                    type="number"
                    min="1"
                  />
                </div>
              </template>

              <!-- K59 —— 错误内联在弹窗里(不是 toast:toast z-index 60,会被遮罩 1000 压住)。 -->
              <div v-if="addError" class="kr-error">
                <KIcon name="danger" :size="12" />
                <span>{{ addError }}</span>
                <!-- N50:mirror 后端未实现,但界面 1:1 照抄,不许删这个按钮。 -->
                <button v-if="mirrorOffer" class="k-btn outline" @click="submit(true)">
                  {{ t('aiKbRtAddMirror') }}
                </button>
              </div>
            </div>
            <div class="k-modal-foot">
              <button class="k-btn outline" @click="adding = false">{{ t('aiKbCancel') }}</button>
              <button
                class="k-btn primary"
                :disabled="!canSubmit || submitting"
                @click="submit(false)"
              >
                <KIcon name="plus" :size="12" /> {{ t('aiKbAdd') }}
              </button>
            </div>
          </DialogContent>
        </DialogOverlay>
      </DialogPortal>
    </DialogRoot>

    <!-- Delete confirm modal(蓝本 :93-120)-->
    <DialogRoot :open="!!deleting" @update:open="onDeletingOpen">
      <DialogPortal to=".knowledge-app" defer>
        <DialogOverlay class="k-modal-bg">
          <DialogContent class="k-modal" :aria-describedby="undefined">
            <div class="k-modal-head">
              <DialogTitle as-child>
                <div class="k-modal-title">{{ t('aiKbRtDeleteTitle') }}</div>
              </DialogTitle>
              <button class="k-modal-x" @click="deleting = null">
                <KIcon name="x" :size="12" />
              </button>
            </div>
            <div class="k-modal-body">
              <div class="kr-path" style="margin-bottom: 10px">{{ deleting?.path }}</div>
              <label class="kr-check">
                <input v-model="purgeFiles" type="checkbox" />
                {{ t('aiKbRtPurgeFiles') }}
              </label>
              <div class="kr-hint">{{ t('aiKbRtDeleteHint') }}</div>
            </div>
            <div class="k-modal-foot">
              <button class="k-btn outline" @click="deleting = null">{{ t('aiKbCancel') }}</button>
              <button class="k-btn danger" @click="confirmDelete">
                <KIcon name="trash" :size="12" /> {{ t('aiKbRtDelete') }}
              </button>
            </div>
          </DialogContent>
        </DialogOverlay>
      </DialogPortal>
    </DialogRoot>
  </div>
</template>
