<!--
  SP8-P5f Task 6(上半)+ **Task 7(下半,本刀)** —— 「Wiki 导航」页
  (rail 第 3 项,路由 `/ai/knowledge/wiki`),
  1:1 移植自 Vue2 蓝本 `NimoOS-UI` @ `7a6ee6b7`
  `src/views/AI/Knowledge/WikiView.vue`(314 行,`git -C ../../NimoOS-UI show 7a6ee6b7:` 读取
  —— 治理 §0.4:那个仓的工作树是别的分支,不可信)。

  ═══════════════════ 🔴 T6 / T7 的分刀边界(下一刀先读这段)═══════════════════

  本刀(T6)搬的是:
    · 模板 `:1-46`  —— 左树三态(skeleton / 加载失败+重试 / 「尚未生成」)+ 有树时的节点列表,
                       以及右侧「空树 onboarding」那屏(`kw-pending` + 「管理知识根」按钮);
    · 模板 `:48-75` —— 面包屑 / 标题 / 「打开文件夹」/ 文章骨架(`nodeLoading` 的四条 `k-skel`);
    · 模板 `:76-81` —— `<template v-else>` 与它内部的 `kw-meta` 三行。
      🔴 **边界申报**:T6 brief 的「范围」写「模板 `:48-75`」,而同一份 brief 的「不写」写
      「`:76-141` 的 **`kw-meta` 之后**全部」—— 两句对 `:76-81` 给出相反归属。
      本刀取**后者**(「kw-meta 之后」= `kw-meta` 本身归 T6),理由是 brief 的 DoD 第 8 条
      要求「`updatedFmt` / `selAiLabel` 的兜底」用例,而这两个 computed **只有 `kw-meta`
      一个渲染落点** —— 不搬 `kw-meta` 就没有任何可观测面,那条 DoD 无法落地
      (治理 §10 申报纪律 2 的同族情形)。**已在 T6 报告里显式申报。**
    · script:`visibleNodes` / `trail` / `crumbParents` / `selTreeNode` / `selName` /
      `selAiLabel` / `updatedFmt` / `owningRoot` · `loadTree` / `isOpen` / `toggle` /
      `nodeClick` / `select` / `fetchArticle` / `openFolder` · `$route.query.path` 的 watch。

  🔴 **T6 不搬、留给 T7 的**(模板 `:83-141` + script):
    摘要渲染(`kw-summary` / `kw-rawsrc` / `v-html`)· 「此目录还没有 wiki 摘要」那屏 + 重扫按钮 ·
    目录区(`kw-sec` / `kw-children`)· 最近变更(`kw-changes`)· 页脚(`kw-foot`)与「查看原文」切换;
    以及 `html` / `changes` / `childIsDir` / `childPath` / `childClick` / `rescan` / `fmtTs` /
    `OP_LABEL_KEYS` / `rescanBusy`。
    ⚠️ **T6 刻意没有为了「能看见」提前写摘要区 markup**(brief 明令)。
    ⚠️ `showSource` 在 T6 已声明 —— 它不是 T7 专属:蓝本 `fetchArticle`(`:264`)每次取文章
      都把它重置为 `false`,那一行在**T6 的范围内**,ref 不声明就写不出来。

  ═══════════════════════ 🔴 T7(本刀)搬入的 ═══════════════════════

    · 模板 `:83-141` —— 摘要区(`class="kw-summary kw-md"` 的 `v-html` / `kw-rawsrc` 源码视图)·
      「此目录还没有 wiki 摘要」那屏(`kw-pending` + `v-if="owningRoot"` 的重扫按钮)·
      目录区(`kw-sec` / `kw-children` / `kw-child*`)· 最近变更(`kw-changes` / `kw-change*`)·
      页脚 `kw-foot`(「查看原文 / 渲染视图」切换);
    · script:`rescanBusy` · `OP_LABEL_KEYS` · `html` / `changes` 两个 computed ·
      `childIsDir` / `childPath` / `childClick` / `rescan` / `fmtTs`。
    🔴 T6 布下的**自动上膛**守卫(`WikiView.test.ts`「自动上膛守卫」那一组)
      ——「本文件模板一旦出现 `kw-summary`,就必须同时出现 `showSource` 切换按钮」——
      **本刀写下 `class="kw-summary kw-md"` 的那一刻已上膛,并且已满足**:
      页脚 `kw-foot` 里的 `@click="showSource = !showSource"` 就是那个切换入口。
      ⚠️ 上面这句话本身含 `kw-summary` 字面串,而它在**文件头注释**里 ——
      那条守卫的模板抽取器已按裁定 **R28** 改成**第 0 列锚定**,不会再被文件头注释骗到
      (T6 的裸 `indexOf('<template>')` 会,评审实测报红过)。

  【§9.15 —— `v-html` 是本期唯一 XSS 面(K49 同族第二次)】
    `html` = `renderWikiMarkdown(raw || '')` = `util/wikiViewHelpers.ts` 转发本仓
    `src/ai/markdown/renderMarkdown.ts`(**内含 DOMPurify**)。`.wiki.md` 的正文是
    **后端从用户目录里的文件名/用户笔记拼出来的**,含攻击者可控串 ⇒ 必须走消毒后再 `v-html`。
    🔴 守卫落在**本刀的代码**上:`WikiView.test.ts` 的「§9.15 XSS」一组**挂载真组件、查真实 DOM**,
    且**全程不 mock `renderMarkdown`**(mock 掉再声称验过 XSS = 安慰剂测试,治理 §9.15 明令)。

  【N58 —— `childPath` 的 `base === '' ? '' : base` 是恒等表达式,照抄不化简】
    蓝本 `:283-286`。两支结果**完全相同**(都返回 `base`)⇒ 它是蓝本原文的意图痕迹,
    化简掉之后再有人改这里就看不出「作者当年考虑过 `sel` 为根时 base 会被剥成空串」这件事。
    **照抄、不化简、在报告里点明**(治理 §3.5 的 N58 原文要求)。

  【N49 —— Go nil slice 的兜底】`node.childMap` / `node.recentChanges` 的 `|| []` 兜底
    **在共享包的 `normalizeNode` 里**(`NimoOS-Service/src/wiki.ts:113-114`)⇒ 页面拿到的
    永远是数组。本刀模板照抄蓝本的 `v-if="node && node.childMap.length"`
    ——「`node` 为 null」这一半仍是页面必须自己挡的(N48 的 404→null 业务态)。
    `changes` 里的 `(node ? node.recentChanges : [])` 同理,照抄。

  结构对照(蓝本行区间 → 本文件):
    :2      `.kw-split` 两栏壳
    :4-33   左栏 `.kw-tree` → `.kw-tree-scroll` → 四态(loading / error / empty / 有树)
    :36-46  右栏 `.kw-article` → `.kw-article-inner` → 空树 onboarding
    :48-55  面包屑(**K56:`:key` 挪到 `<template v-for>` 自身**)
    :57-66  标题行 + 「打开文件夹」
    :69-74  文章骨架
    :76-81  `<template v-else>` + `kw-meta`
    :83-95  摘要区二选一(`kw-rawsrc` / `kw-summary`)+ 「还没有摘要」那屏(**T7**)
    :97-117 目录区 `kw-sec` / `kw-children`(**T7**)
    :119-132 最近变更 `kw-sec` / `kw-changes`(**T7**)
    :134-140 页脚 `kw-foot` + 「查看原文 / 渲染视图」切换(**T7**)
    :156    `OP_LABEL_KEYS`(**T7**)
    :161-176 `data()` 的十一项页面级瞬态(**不含 `store` 那一项**;蓝本 `data()` 共 12 个键)
             → 组件本地 `ref`(T6 落其中十项,第十一项 `rescanBusy` 由 **T7** 落)
    :177-209 `computed` → `computed()`
    :210-214 `watch '$route.query.path'` → `watch(() => route.query.path, …)`
    :215-218 `created()` → `onMounted()`
    :219-312 `methods` → 普通函数

  ─────────────────────────────────────────────────────────────────────────────
  【零 style 块 —— K44 / 治理 §3】蓝本本页**自带零 `<style>` 块**(它的 `kw-*` 类原本就在
    蓝本 `knowledge.scss:2453-2561`),T2 已整段搬进 `src/ai/styles/knowledge.scss`
    (嵌在 `.knowledge-app` 下,K9)⇒ **本文件一个 style 块都没有**。
    `knowledge.scss` 由 `KnowledgeLayout.vue` 侧 import,本文件不再 import 样式
    (先例:`QueueView.vue` / `SettingsView.vue` / `AllowlistView.vue` / `RootsView.vue`)。
    守卫:`knowledgeStyles.test.ts` 的 K44 参数化断言(T2b 布,裁定 R20 C-1)——
    它**先剥注释、再行首锚定**,所以上面这句话本身不会把它撞红(裁定 **R19** 的直接后果)。
    另外本文件必须在 `knowledgeStyles.test.ts` 的 `KNOWLEDGE_VUE_FILES` 清单里登记
    (集合相等防漂移;不登记 = 那条断言报红,**那是正确行为,不许去改断言**)。

  【K56 —— 面包屑的 `:key` 位置是 Vue 3 编译器的硬要求,不是选择】
    蓝本 `:50-53` 是 Vue 2 写法:`<template v-for>` 内部的 `<button>` 与 `<span>` **各自**
    带 key,后者还拼了 `+ '/sep'`。**Vue 3 编译器要求 `key` 放在 `<template v-for>` 上**
    (放内部子元素上会编译告警/失效)⇒ 本文件 `:key="c.path"` 写在 `<template>` 自身,
    内部两个元素**不再各带 key**。
    🔴 渲染出的 DOM 序列与蓝本**逐个一致**(`button, span('/')` 交替 + 末尾 `span.cur`),
    由 `WikiView.test.ts` 的「K56 面包屑 DOM 序列」一条断言钉死。

  【K1 —— store 降层,逐处】蓝本 `this.store.state.wikiRoots`(`:196`)、
    `this.store.actions.loadRoots/loadWikiTree/loadWikiNode/loadWikiRaw/toast`,
    本仓 `knowledgeStore` 是 Pinia setup store,**`state` 与 `actions` 两层整个消失**
    → `store.wikiRoots` / `store.loadRoots()` / `store.loadWikiTree()` / …。

  【K58 形态 A —— `fetchArticle` 的 catch 不回显后端 body】
    蓝本 `:277`:`toast($t('Operation failed') + ': ' + (e.message || e))`。
    K5/K58 明令禁止把后端串回显进界面;`p5f-task-0-report.md` §12 认定的本仓既定做法
    (先例 `QueueView.vue:212-217` / `IndexedFilesView.vue:592-593` / `NoteEditPane.vue:461`,
    同期 `RootsView.vue` 四处)是 —— **catch 里丢掉 `e.message`,只弹一个固定 i18n 键,
    且「无第二句可拼故不留 `': '` 前缀」**。本文件唯一一处 catch-toast 落成 `aiKbOpFailed`。
    **不自造第二套映射。**
    落地判据是**排除式断言**(见测试文件 K58 那一组:让 store action reject 一个带可识别
    文本的错误,断言 toast 文本与整页 DOM 都**不含**那段文本)。
    ⚠️ 那个探针文本**故意不出现在本文件里**(治理 §9:否定式断言撞注释 = 假报红)。

  【K27 同族 —— toast 一律走 `store.toast(...)`】裁定 **R27**(P5e)/ 勘误 **E-62**:
    `knowledgeStore.ts` 里 `toast()` 内部是 `useToast().show(msg, 2400)`,而**全局 `show()`
    默认只有 1500ms** ⇒ 直调 `useToast()` 会丢掉蓝本自己的 2400ms。既有 8 页全走
    `store.toast()`,本页照同一份 —— 本刀范围内**共 1 处**(`fetchArticle` 的 catch)。

  ═══════════════════ 照抄申报(§3.5 的 N 条目)═══════════════════

  【N46 —— 两种命名风格,本期最容易搞错的一点】Wiki 的 `WikiRoot` **无 json tag** ⇒ HTTP 响应
    是 PascalCase;而 `/tree`、`/node`、`/raw` 是 snake_case。**双向归一化已在共享包里**
    (`NimoOS-Service/src/wiki.ts:85 normalizeRoot` / `:102 normalizeTreeNode` /
    `:112 normalizeNode`)⇒ **store 出口一律 camelCase**(T0 实测定案,
    `p5f-task-0-report.md` §4.4)。本页只消费 camelCase 的 `aiLabel` / `lastModified` /
    `r.path` / `r.id`,**不许在页面里再归一化一次**。

  【N48 —— `loadWikiNode` / `loadWikiRaw` 的 404→null 分层,照抄】
    404(节点尚未入索引 / `.wiki.md` 尚未生成)在 **store 层**转 `null`,其余错误原样上抛
    (`knowledgeStore.ts:715` / `:725`)⇒ 本页的 `try` 里拿到的 `null` 是**合法业务态**
    (T7 的「此目录还没有 wiki 摘要」那屏),而 `catch` 只接真错误。**有意分层,不许拉平。**

  【N55 —— `fetchArticle` 的过期守卫是蓝本自带的,照抄】蓝本 `:270` / `:274` / `:279`
    三处 `if (this.sel !== p)`。三处**一处都不能少**,各自守不同的事:
      · try 里那处   —— 迟到的成功响应不许覆盖新选中的文章;
      · catch 里那处 —— 迟到的**失败**同样不许清空新选中的文章、也不许弹 toast;
      · finally 那处 —— 迟到的响应不许把**新选中**的骨架 `nodeLoading` 提前关掉
                        (否则新文章还没回来,界面就先闪成「已加载完」的空白)。
    🔴 除「逻辑」外还要守**变量作用域**那一半(治理 §9.1 / K15 同族第 10 次):
    `p` 与 `sel` 都必须是**组件实例级**的,不能是模块级 —— 两个 WikiView 实例并存时,
    模块级变量会让 A 实例的响应去比 B 实例的选中。测试里配了「两实例交错」用例
    (**判据:把 `sel` 挪到模块级 → 必须报红**)。

  【N56 —— 深链的两半是**两条不同路径**,不许「统一」成 `immediate: true`】
    · 初始选中:在 `loadTree()` 里读**一次** `route.query.path`(蓝本 `:230-232`);
    · 后续变化:`watch` **无 `immediate`**(蓝本 `:210-214`),条件 `v && v !== sel && byPath[v]`。
    🔴 **为什么不能合并**:watch 的条件里有 `byPath[v]`,而 `byPath` 是 `loadTree()` **回包后**
    才建起来的 —— `immediate: true` 在挂载那一刻跑,`byPath` 还是空对象,那一发会**静默什么
    都不做**,深链就此失效(而且三门不会响)。蓝本的初始化走的是另一条路径,照抄。
    🔴 「挂载后改地址栏 query → 真的切换」必须有用例(记忆 `newui-router-query-only-no-remount`:
    只在 `onMounted` 里读一次 query 的写法,用户改地址栏一行都不跑)。

  【N57 —— `select()` 的 `router.replace(...).catch(() => {})`,照抄】蓝本 `:256-258`。
    vue-router 4 对**重复导航**会 reject 一个 `NavigationDuplicated` 风格的错误;蓝本这里
    本来就没有 log,吞掉是既定做法 ⇒ **K6「`console.error` 不照抄」不适用于此**(无可不照抄的 log)。

  【N49 —— Go nil slice 兜底】本刀范围内的命中点在 `buildWikiTree`(`util/wikiViewHelpers.ts`
    的 `(list || [])`)与 store 侧,本文件不再重复兜底。

  ═══════════════════ Vue2 → Vue3 强制改写(治理 §2,不算偏离)═══════════════════
    | 蓝本(Options API) | 本文件 | 依据 |
    |---|---|---|
    | `data()` 对象 | `ref()` | `<script setup>` 无 `this` |
    | `computed: { … }` | `computed()` | 同上 |
    | `watch: { '$route.query.path'(v) {} }` | `watch(() => route.query.path, (v) => …)` | 字符串路径 watch 在 setup 里不可用 |
    | `created()` | `onMounted()` | 蓝本那两发同样**不阻塞首屏**(没 await) |
    | `methods: { … }` | 普通函数 | 同上 |
    | `this.$route` / `this.$router` | `useRoute()` / `useRouter()` | 本仓既定 |
    | `this.$t` | `useI18n().t` | 本仓既定 |
    | `this.store.actions.x()` | `store.x()` | Pinia setup store 无 `actions` 那一层 |
    | `$router.push(...)`(模板内) | `router.push(...)` | `<script setup>` 里模板拿不到 `$router` 之外的差别仅此 |

  🔴 **零 `any`**(承 K41):树节点用 `util/wikiViewHelpers.ts` 导出的 `WikiViewTreeNode`,
    文章节点用共享包的 `WikiNode`,root 用共享包的 `WikiRoot`。
  🔴 `route.query.path` 的类型是 `LocationQueryValue | LocationQueryValue[] | undefined`
    (可能是数组:`?path=a&path=b`)⇒ 本文件用 `queryPath()` 收窄成 `string`
    (非字符串一律 `''`)。**语义与蓝本等价**:蓝本把数组直接喂给 `byPath[…]`,JS 会把它
    toString 成一个绝不可能存在的 key ⇒ 同样落到「未命中」那一支。
-->
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import type { WikiChildMapEntry, WikiNode } from '@nimotech/nimoos-service'
import KIcon from '../components/KIcon.vue'
import { useKnowledgeStore, fmtAgo } from '../stores/knowledgeStore'
import { openDirInNewTab, openFileInNewTab } from '../../services/openInApp'
import {
  buildWikiTree,
  trailFor,
  opToType,
  parseTs,
  rootForPath,
  renderWikiMarkdown,
} from '../util/wikiViewHelpers'
import type { WikiViewTreeNode } from '../util/wikiViewHelpers'

/**
 * 蓝本 `:156` —— 文件事件 `op` → 标签文案。**四个值过 `$t()`**(动态键,同 P5e 的 `MTIMES` 模具)
 * ⇒ 蓝本的 `'Added'/'Updated'/'Removed'/'Renamed'` 在本仓换成对应的 `aiKbWkOp*` 键
 * (i18n 由 T1 落,见 `zh_cn.ts` / `en_us.ts`;两档值逐字照蓝本 `zh_CN.json` / `en_US.json`)。
 * 🔴 **未知 op 兜底 `Updated`** 是蓝本 `:205` 的 `OP_LABEL_KEYS[c.op] || 'Updated'`,照抄
 * —— 与 `opToType` 的「modify + 任何未知值 → 'mod'」是**两条各自独立的兜底**,别合并。
 */
const OP_LABEL_KEYS: Record<string, string> = {
  create: 'aiKbWkOpAdded',
  modify: 'aiKbWkOpUpdated',
  delete: 'aiKbWkOpRemoved',
  rename: 'aiKbWkOpRenamed',
}

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const store = useKnowledgeStore()

/* ── 蓝本 data()(`:161-176`)的页面级瞬态,一律组件本地 ref,不塞 store(治理 §5.1)。
      🔴 组件本地 = 每个实例一份 —— N55 的「两实例交错」守卫钉的就是这件事。 ── */

/** 蓝本 `:164` —— 初值 `true`(挂载即骨架,不闪空)。 */
const treeLoading = ref(true)
/** 蓝本 `:165`。 */
const treeError = ref(false)
/** 蓝本 `:166` —— `buildWikiTree` 的森林顶层。 */
const treeRoots = ref<WikiViewTreeNode[]>([])
/** 蓝本 `:167` —— path → 树节点(`buildWikiTree` 的第二个出参)。 */
const byPath = ref<Record<string, WikiViewTreeNode>>({})
/** 蓝本 `:168` —— 展开中的路径。蓝本用数组 + `indexOf`,照抄(不换 Set)。 */
const openPaths = ref<string[]>([])
/** 蓝本 `:169` —— 当前选中路径。**N55 的过期守卫比的就是它。** */
const sel = ref('')
/** 蓝本 `:170` —— `/wiki/node` 的响应(T7 渲染目录区与最近变更)。 */
const node = ref<WikiNode | null>(null)
/** 蓝本 `:171` —— `.wiki.md` 原文;**`null` 是合法业务态**(N48:404 在 store 层转 null)。 */
const raw = ref<string | null>(null)
/** 蓝本 `:172`。 */
const nodeLoading = ref(false)
/** 蓝本 `:173` —— 「查看原文 / 渲染视图」开关(页脚 `kw-foot` 的按钮翻它);**T6 已声明**,
 *  因为蓝本 `fetchArticle`(`:264`)每次取文章都把它重置为 false,那一行在 T6 范围内。 */
const showSource = ref(false)
/** 蓝本 `:174`(**T7**)—— 重扫在飞的门;`rescan()` 的函数门与按钮的 `:disabled` 都读它。 */
const rescanBusy = ref(false)

/**
 * 蓝本 `:178-186` —— 把森林压平成「可见行」(带缩进深度),折叠的子树不出现在里面。
 * `isOpen` 决定要不要继续往下走 ⇒ `openPaths` 一变,本 computed 自动重算。
 */
const visibleNodes = computed<Array<{ n: WikiViewTreeNode; depth: number }>>(() => {
  const out: Array<{ n: WikiViewTreeNode; depth: number }> = []
  const walk = (n: WikiViewTreeNode, depth: number): void => {
    out.push({ n, depth })
    if (isOpen(n.path)) n.children.forEach((c) => walk(c, depth + 1))
  }
  treeRoots.value.forEach((r) => walk(r, 0))
  return out
})

/** 蓝本 `:187` —— 祖先链(root-most first,含自身)。 */
const trail = computed<WikiViewTreeNode[]>(() => trailFor(byPath.value, sel.value))
/** 蓝本 `:188` —— 面包屑只显示**祖先**,当前节点由末尾的 `.cur` 单独渲染。 */
const crumbParents = computed<WikiViewTreeNode[]>(() => trail.value.slice(0, -1))
/** 蓝本 `:189`。 */
const selTreeNode = computed<WikiViewTreeNode | null>(() => byPath.value[sel.value] || null)
/** 蓝本 `:190` —— 🔴 兜底:树里查不到时**退化成整条路径**(不是空白)。 */
const selName = computed<string>(() => (selTreeNode.value ? selTreeNode.value.name : sel.value))
/** 蓝本 `:191` —— 兜底成空串(`kw-meta` 里 `v-if` 掉整个 `<span>`)。 */
const selAiLabel = computed<string>(() => (selTreeNode.value ? selTreeNode.value.aiLabel : ''))
/**
 * 蓝本 `:192-195` —— `parseTs` 回**毫秒**(0 = 后端 formatTS 送的空串 / 非法值),
 * 0 时整块不渲染。🔴 `fmtAgo` 吃的也是毫秒(`knowledgeStore.ts:190`)。
 */
const updatedFmt = computed<string>(() => {
  const ms = selTreeNode.value ? parseTs(selTreeNode.value.lastModified) : 0
  return ms ? fmtAgo(ms) : ''
})
/** 蓝本 `:196`(K1 降层)—— 当前选中路径归哪个索引根(最长前缀);重扫按钮要它的 `id`。 */
const owningRoot = computed(() => rootForPath(store.wikiRoots, sel.value))

/**
 * 蓝本 `:197`(**T7**)—— 🔴 **§9.15:本期唯一的 XSS 面**。
 * `renderWikiMarkdown` 只是转发本仓 `renderMarkdown`(含 DOMPurify),消毒发生在那里。
 * 🔴 `raw || ''` 照抄 —— `raw` 为 `null` 时模板走的是另一支(`kw-pending`),
 *    但 computed 本身会先求值一次,`null` 直接喂 markdown 渲染器会炸,兜底不许删。
 */
const html = computed<string>(() => renderWikiMarkdown(raw.value || ''))

/** `changes` 的行形状(蓝本 `:201-207` 那个对象字面量,零 `any`)。 */
interface WikiChangeRow {
  path: string
  name: string
  type: ReturnType<typeof opToType>
  label: string
  timeFmt: string
}

/**
 * 蓝本 `:198-208`(**T7**)—— 「最近变更」时间线的行数据。四件事,逐条照抄:
 *   ① **`.slice(0, 10)` 上限** —— 后端一次能送几十条,页面只列最近 10 条;
 *   ② **前缀剥离** —— 属于当前索引根的路径显示**相对路径**,不命中前缀的显示**全路径**
 *      (`/outside/...` 这类跨根条目会原样保留,蓝本 `:203` 的 `indexOf(prefix) === 0` 判据);
 *   ③ `opToType(c.op)` → `data-type`(CSS 的 `--tone` 靠它上色);
 *   ④ **`OP_LABEL_KEYS[c.op] || 'Updated'`** 的未知 op 兜底 + `c.at` 为空串时 `timeFmt` 为 `''`。
 * 🔴 `root.path.replace(/\/+$/, '') + '/'` 照抄(根是 `/` 时会拼成 `//`,与蓝本同解 —— 不「修」)。
 * 🔴 `(node ? node.recentChanges : [])` 照抄(N48 的 `null` 业务态由这里挡)。
 */
const changes = computed<WikiChangeRow[]>(() => {
  const root = owningRoot.value
  const prefix = root ? root.path.replace(/\/+$/, '') + '/' : ''
  return (node.value ? node.value.recentChanges : []).slice(0, 10).map((c) => ({
    path: c.path,
    name: prefix && c.path.indexOf(prefix) === 0 ? c.path.slice(prefix.length) : c.path,
    type: opToType(c.op),
    label: t(OP_LABEL_KEYS[c.op] || 'aiKbWkOpUpdated'),
    timeFmt: c.at ? fmtAgo(parseTs(c.at)) : '',
  }))
})

/**
 * `route.query.path` 的类型收窄(见文件头「强制改写」表最后一条)。
 * 非字符串(缺席 / `?path=a&path=b` 的数组形态)一律 `''` —— 与蓝本落到「未命中」同解。
 */
function queryPath(): string {
  const q = route.query.path
  return typeof q === 'string' ? q : ''
}

/**
 * 蓝本 `:220-238`。
 * 🔴 **刻意不加过期守卫**(治理 §5.2 第 2 行),四条理由:
 *   ① 触发点只有两个 —— `onMounted` 跑一次,和 `treeError` 分支里的「重试」按钮;
 *   ② 那个重试按钮**无法并发触发两发**:第一发一开始就把 `treeLoading` 置 true,
 *      而按钮所在的 `v-else-if="treeError"` 分支在 `treeLoading` 为真时**整块不渲染**
 *      (`v-if="treeLoading"` 排在它前面)⇒ 请求在飞时按钮**不存在**,点不到;
 *      🔴 这一条由 `WikiView.test.ts` 的「treeLoading 期间重试按钮不渲染」一条用例当守卫,
 *      **它就是这个「不加」决定的依据** —— 将来谁把三态的排布改成「重试按钮常驻」,
 *      那条用例会先报红,提醒他连带补上过期守卫;
 *   ③ 本页无「切换 root 重新拉树」之类的入参 —— `loadWikiTree()` 无参数,两发的结果必然同源;
 *   ④ 蓝本自己也没有(`fetchArticle` 那处**有**)⇒ 加了就是未申报的偏离。
 * 🔴 初始选中在这里读**一次** `route.query.path`(N56 的第一半):
 *    query 命中 → 选它;未命中 → `roots[0]`;都没有 → `''`(不选,右侧走 onboarding/空白)。
 */
async function loadTree(): Promise<void> {
  treeLoading.value = true
  treeError.value = false
  try {
    const flat = await store.loadWikiTree()
    const built = buildWikiTree(flat)
    treeRoots.value = built.roots
    byPath.value = built.byPath
    // top-level roots start expanded(蓝本 `:228` 的原注释)
    openPaths.value = built.roots.map((r) => r.path)
    const q = queryPath()
    const initial = q && built.byPath[q] ? q : built.roots[0] ? built.roots[0].path : ''
    // 🔴 `fromRoute: q === initial` —— 地址栏本来就是这个值时不再 replace 一次(防回环)。
    if (initial) select(initial, { fromRoute: q === initial })
  } catch {
    treeError.value = true
  } finally {
    treeLoading.value = false
  }
}

/** 蓝本 `:239`。 */
function isOpen(path: string): boolean {
  return openPaths.value.indexOf(path) !== -1
}

/** 蓝本 `:240-244` —— 纯翻转;模板里挂在 chevron 上且 **`@click.stop`**(点它不触发选中)。 */
function toggle(path: string): void {
  const i = openPaths.value.indexOf(path)
  if (i === -1) openPaths.value.push(path)
  else openPaths.value.splice(i, 1)
}

/**
 * 蓝本 `:245-248` —— 点整行:先选中,**再**把有子节点且当前折叠的展开(只展不收)。
 *
 * 🔴 **申报:第二行在蓝本里其实是不可达分支**(与 N58 的恒等表达式同族,**照抄不化简**)。
 *   推演:`select(n.path)` 里的 `trailFor(byPath, n.path)` 返回的祖先链**含 `n` 自己**
 *   (`util/wikiViewHelpers.ts` 的 `trailFor`:逐段拼 `cur` 并在命中 `byPath` 时 push,
 *   最后一段就是 `n.path` 本身)⇒ `select()` 的循环已经把 `n.path` 推进 `openPaths`;
 *   而 `n` 一定在 `byPath` 里(它是从 `visibleNodes` 里点出来的),`select()` 的
 *   `if (!byPath[path]) return` 早退也不会发生 ⇒ 回到这里时 `isOpen(n.path)` 恒为 `true`,
 *   `!isOpen(...)` 恒 `false`,这一行**永远不会执行**。
 *   ⇒ 「点整行会展开」这个**可观测行为**是真的(由 `select()` 提供),用例照常钉;
 *      但它的守卫落在 `select()` 的祖先循环上,不在这一行。**不删、不化简**:
 *      删了会让「将来有人改动 `select()` 的循环」时失去这处的意图痕迹(N58 同款理由)。
 */
function nodeClick(n: WikiViewTreeNode): void {
  select(n.path)
  if (n.children.length && !isOpen(n.path)) openPaths.value.push(n.path)
}

/**
 * 蓝本 `:249-260` —— **三件事**:
 *   ① 设 `sel`;
 *   ② **展开每一个祖先**(`trailFor` 循环)—— 少了它,深链到深层节点时那一行在树里看不见;
 *   ③ 把选中写进地址栏 `?path=`(`router.replace`,不进历史)。
 * 🔴 `fromRoute: true`(来自 watch / 初始 query 命中)时**跳过第 ③ 步**,防「watch → replace →
 *    watch」的回环。
 * 🔴 **N57**:`.catch(() => {})` 照抄 —— vue-router 对重复导航会 reject。
 */
function select(path: string, opts: { fromRoute?: boolean } = {}): void {
  const fromRoute = opts.fromRoute === true
  if (!byPath.value[path]) return
  sel.value = path
  // expand every ancestor so the selection is visible in the tree(蓝本 `:252` 原注释)
  for (const anc of trailFor(byPath.value, path)) {
    if (!isOpen(anc.path)) openPaths.value.push(anc.path)
  }
  if (!fromRoute && queryPath() !== path) {
    router.replace({ query: { ...route.query, path } }).catch(() => {})
  }
  fetchArticle()
}

/**
 * 蓝本 `:261-281`。
 * 🔴 **N55 —— 三处过期守卫逐字照抄**(理由逐处见文件头)。`p` 是**这一发**的路径快照。
 * 🔴 `Promise.all` 照抄 —— 两个请求并发,不串行。
 * 🔴 **N48**:404 已在 store 层转成 `null`(合法业务态,走 try);其余错误上抛 → 走 catch。
 * 🔴 **K58 形态 A**:catch 只弹固定键,不回显 `e.message`(蓝本 `:277` 回显,本仓不照抄)。
 */
async function fetchArticle(): Promise<void> {
  const p = sel.value
  nodeLoading.value = true
  showSource.value = false
  try {
    const [n, r] = await Promise.all([store.loadWikiNode(p), store.loadWikiRaw(p)])
    if (sel.value !== p) return // stale response — a newer selection won(蓝本 `:270` 原注释)
    node.value = n
    raw.value = r
  } catch {
    if (sel.value !== p) return
    node.value = null
    raw.value = null
    store.toast(t('aiKbOpFailed'))
  } finally {
    if (sel.value === p) nodeLoading.value = false
  }
}

/** 蓝本 `:282`(**T7**)—— 子项是不是目录 = 它的全路径在树里有没有节点。
 *  🔴 判据是 `byPath`,不是文件名有没有后缀 —— 「有 `.wiki.md` 的目录」才算目录,
 *  被折叠的目录(`is_opaque`)不在树里 ⇒ 这里判 `false`,点它走文件管理器(与蓝本同解)。 */
function childIsDir(c: WikiChildMapEntry): boolean {
  return !!byPath.value[childPath(c)]
}

/**
 * 蓝本 `:283-286`(**T7**)。
 * 🔴 **N58 —— `base === '' ? '' : base` 是恒等表达式,两支结果相同,照抄不化简。**
 *   触发它的唯一场景:`sel` 是 `'/'` ⇒ `replace(/\/+$/, '')` 把它剥成 `''`
 *   ⇒ 拼出 `'' + '/' + name` = `/name`(而不是 `//name`)。作者当年写下这个三元
 *   显然是在标注「这里 base 可能为空」,化简掉就把那处意图痕迹擦了。
 */
function childPath(c: WikiChildMapEntry): string {
  const base = sel.value.replace(/\/+$/, '')
  return (base === '' ? '' : base) + '/' + c.name
}

/**
 * 蓝本 `:287-291`(**T7**)—— 两分支:
 *   · 树里有这个路径(= 有自己的 `.wiki.md` 的目录)→ 就地 `select()` 换文章;
 *   · 否则(普通文件,或被折叠的目录)→ 到「文件」应用里打开并高亮它。
 */
function childClick(c: WikiChildMapEntry): void {
  const full = childPath(c)
  if (byPath.value[full]) select(full)
  else openFileInNewTab(full) // plain file (or opaque dir) → file manager, highlighted(蓝本 `:290` 原注释)
}

/** 蓝本 `:292-294` —— 在「文件」应用里打开当前目录本身(不高亮任何文件)。 */
function openFolder(): void {
  openDirInNewTab(sel.value)
}

/**
 * 蓝本 `:295-307`(**T7**)—— 手动重扫当前选中所属的索引根。
 * 🔴 **函数门 `if (!root || rescanBusy) return`** 照抄(治理 §5.2 第 4 行):
 *   · `!root` —— 选中不属于任何索引根时不发请求(模板里那个按钮本来就 `v-if="owningRoot"`,
 *     但函数门是**第二道**,不许因为「按钮不渲染」就省掉);
 *   · `rescanBusy` —— 第一发在飞时不发第二发。
 * ⚠️ 模板上的 `:disabled="rescanBusy"` 与这道函数门是**两层**;jsdom 不向 `:disabled` 元素
 *   派发 click(裁定 R27 的常驻教训)⇒ 测试验函数门时**直接调 `vm.rescan()`**,
 *   不去点那个带 `:disabled` 的按钮(点它测到的是 `:disabled` 绑定,不是函数门)。
 * 🔴 **K58 形态 A**:catch 只弹固定键,不回显 `e.message`(蓝本 `:303` 回显,本仓不照抄)。
 * 🔴 `finally` 里无条件 `rescanBusy = false` 照抄(**不带过期守卫** —— 蓝本如此,且门本身
 *   保证同一时刻只有一发在飞)。
 */
async function rescan(): Promise<void> {
  const root = owningRoot.value
  if (!root || rescanBusy.value) return
  rescanBusy.value = true
  try {
    await store.rescanRoot(root.id)
    store.toast(t('aiKbRescanStarted'))
  } catch {
    store.toast(t('aiKbOpFailed'))
  } finally {
    rescanBusy.value = false
  }
}

/** 蓝本 `:308-311`(**T7**)—— RFC3339 → 「x 分钟前」;后端 `formatTS` 的空串 / 非法值
 *  经 `parseTs` 得 0 ⇒ 返回空串(不显示 `1970`,承 P5d-T3 的单位教训)。 */
function fmtTs(rfc3339: string): string {
  const ms = parseTs(rfc3339)
  return ms ? fmtAgo(ms) : ''
}

/**
 * 蓝本 `:210-214` —— **N56 的第二半**:watch **无 `immediate`**。
 * 条件三件:有值 · 与当前选中不同 · 树里真有这个路径。
 * 🔴 `fromRoute: true` —— 值本来就来自地址栏,不再 replace 回去(防回环)。
 */
watch(
  () => route.query.path,
  () => {
    const v = queryPath()
    if (v && v !== sel.value && byPath.value[v]) select(v, { fromRoute: true })
  },
)

/**
 * 蓝本 `:215-218` 的 `created()`。
 * 🔴 `if (!wikiRoots.length)` 照抄 —— 从别的知识库页切过来时 store 里已有根列表,不重复拉。
 * ⚠️ 这一发**不 await**(蓝本也没有):`/v1/wiki/roots` 在本机会等满 60 s axios 超时(D1),
 *    await 它会把整页首屏也拖住。`loadRoots` 自己带 catch + toast(`knowledgeStore.ts:661-663`)。
 *    调用形态与同期 `RootsView.vue` 的 `onMounted` 逐字同款(不传 `silent`)。
 */
onMounted(() => {
  if (!store.wikiRoots.length) store.loadRoots()
  loadTree()
})
</script>

<template>
  <div class="kw-split">
    <!-- Left: directory tree (one node per folder = one .wiki.md)(蓝本 :3 原注释)-->
    <aside class="kw-tree">
      <div class="kw-tree-scroll">
        <template v-if="treeLoading">
          <span
            v-for="i in 6"
            :key="i"
            class="k-skel"
            style="display: block; height: 22px; margin: 6px 8px"
          />
        </template>
        <template v-else-if="treeError">
          <div class="kw-tree-note">
            {{ t('aiKbWkTreeError') }}
            <!-- 🔴 治理 §5.2:这个按钮**只在 treeError 分支里**渲染,而 treeLoading 为真时
                 上面那个 v-if 分支胜出 ⇒ 请求在飞时它不存在 = loadTree 不需要过期守卫。 -->
            <button class="k-btn outline" style="margin-top: 8px" @click="loadTree">
              {{ t('aiKbRetry') }}
            </button>
          </div>
        </template>
        <template v-else-if="!treeRoots.length">
          <div class="kw-tree-note">{{ t('aiKbWkEmptyTitle') }}</div>
        </template>
        <template v-else>
          <button
            v-for="item in visibleNodes"
            :key="item.n.path"
            class="kw-node"
            :data-active="String(sel === item.n.path)"
            :style="{ paddingLeft: 8 + item.depth * 14 + 'px' }"
            @click="nodeClick(item.n)"
          >
            <!-- 🔴 @click.stop:点 chevron 只折叠/展开,**不**触发整行的选中(蓝本 :26)。 -->
            <span
              v-if="item.n.children.length"
              class="kw-node-chev"
              :data-open="String(isOpen(item.n.path))"
              @click.stop="toggle(item.n.path)"
            ><KIcon name="chev" :size="11" /></span>
            <span v-else class="kw-node-chev" />
            <span class="kw-node-ico">
              <KIcon :name="item.depth === 0 ? 'drive' : 'folder'" :size="13" />
            </span>
            <span class="kw-node-name">{{ item.n.name }}</span>
          </button>
        </template>
      </div>
    </aside>

    <!-- Right: .wiki.md article(蓝本 :35 原注释)-->
    <div class="kw-article">
      <div class="kw-article-inner">
        <!-- Tree empty: onboarding pointer(蓝本 :38 原注释)
             🔴 §9.17:本机 /v1/wiki/tree 是**超时**不是空 ⇒ 走的是 treeError,这一屏本机到不了。 -->
        <div
          v-if="!treeLoading && !treeError && !treeRoots.length"
          class="kw-pending"
        >
          <div class="kw-pending-orb"><KIcon name="layers" :size="20" /></div>
          <div class="kw-pending-title">{{ t('aiKbWkEmptyTitle') }}</div>
          <div class="kw-pending-sub">{{ t('aiKbWkEmptySub') }}</div>
          <button class="k-btn primary" @click="router.push('/ai/knowledge/roots')">
            <KIcon name="drive" :size="12" /> {{ t('aiKbManageRoots') }}
          </button>
        </div>

        <template v-else-if="sel">
          <!-- K56 —— `:key` 必须在 `<template v-for>` 自身(Vue 3 编译器要求),
               内部两个元素不再各带 key;渲染出的 DOM 序列与蓝本 :50-53 逐个一致。 -->
          <div class="kw-crumb">
            <template v-for="c in crumbParents" :key="c.path">
              <button @click="select(c.path)">{{ c.name }}</button>
              <span>/</span>
            </template>
            <span class="cur">{{ selName }}</span>
          </div>

          <div class="kw-head">
            <h1 class="kw-title">
              <!-- 蓝本 :59 的两个 `--ly` 变量已核实两档都有值(knowledge.scss 的两个
                   声明块),照抄不改(附录 B §B.5)。 -->
              <span
                class="k2-tag"
                style="--ly: var(--ly-wiki); --ly-soft: var(--ly-wiki-soft)"
              >TREE</span>{{ selName }}
            </h1>
            <div class="kw-actions">
              <button class="k-btn ghost" @click="openFolder">
                <KIcon name="folder" :size="12" /> {{ t('aiKbWkOpenFolder') }}
              </button>
            </div>
          </div>

          <!-- Article loading skeleton(蓝本 :68 原注释)-->
          <div
            v-if="nodeLoading"
            style="margin-top: 18px; display: flex; flex-direction: column; gap: 10px"
          >
            <span class="k-skel" style="display: block; height: 12px; width: 45%" />
            <span class="k-skel" style="display: block; height: 80px" />
            <span class="k-skel" style="display: block; height: 44px" />
            <span class="k-skel" style="display: block; height: 44px" />
          </div>

          <template v-else>
            <div class="kw-meta">
              <span v-if="updatedFmt">{{ t('aiKbWkSummaryUpdated', { t: updatedFmt }) }}</span>
              <span v-if="selAiLabel"><b>{{ selAiLabel }}</b></span>
              <span>{{ t('aiKbWkMaintained') }}</span>
            </div>

            <!-- Summary: sanitized .wiki.md markdown (or its raw source)(蓝本 :83 原注释)
                 🔴 §9.15:`v-html` 的输入必须是 renderWikiMarkdown 的产物(DOMPurify 消毒过)。 -->
            <template v-if="raw !== null">
              <pre v-if="showSource" class="kw-rawsrc">{{ raw }}</pre>
              <div v-else class="kw-summary kw-md" v-html="html" />
            </template>
            <div v-else class="kw-pending">
              <div class="kw-pending-orb"><KIcon name="layers" :size="20" /></div>
              <div class="kw-pending-title">{{ t('aiKbWkNoSummaryTitle') }}</div>
              <div class="kw-pending-sub">{{ t('aiKbWkNoSummarySub') }}</div>
              <!-- 🔴 §9.17 可点性:`owningRoot` 为 null(选中不属于任何索引根)时**整个按钮不渲染**,
                   点不到 —— 不是「渲染出来但 disabled」。`:disabled="rescanBusy"` 是另一层。 -->
              <button v-if="owningRoot" class="k-btn primary" :disabled="rescanBusy" @click="rescan">
                <KIcon name="refresh" :size="12" /> {{ t('aiKbWkRescanRoot') }}
              </button>
            </div>

            <!-- Contents (child_map)(蓝本 :97 原注释)-->
            <div v-if="node && node.childMap.length" class="kw-sec">
              <div class="kw-sec-head">
                <span class="kw-sec-title">{{ t('aiKbWkContents') }}</span>
                <!-- 🔴 附录 A §A.4:`kw-sec-en` 的英文是蓝本**未过 $t()** 的装饰文案,
                     照抄字面量,不许顺手 i18n 化。 -->
                <span class="kw-sec-en">Contents</span>
                <span class="kw-sec-count">{{ t('aiKbWkItemCount', { n: node.childMap.length }) }}</span>
              </div>
              <div class="kw-children">
                <button v-for="c in node.childMap" :key="c.name" class="kw-child" @click="childClick(c)">
                  <span class="kw-child-ico" :data-kind="childIsDir(c) ? 'dir' : 'file'">
                    <KIcon :name="childIsDir(c) ? 'folder' : 'file'" :size="14" />
                  </span>
                  <span class="kw-child-body">
                    <span class="kw-child-name">{{ c.name }}</span>
                    <div v-if="c.isOpaque" class="kw-child-sum">{{ t('aiKbWkCollapsed') }}</div>
                  </span>
                  <span class="kw-child-meta">{{ c.lastModified ? fmtTs(c.lastModified) : '' }}</span>
                  <span class="kw-child-chev"><KIcon name="chev" :size="12" /></span>
                </button>
              </div>
            </div>

            <!-- Recent changes (root-wide timeline)(蓝本 :119 原注释)-->
            <div v-if="changes.length" class="kw-sec">
              <div class="kw-sec-head">
                <span class="kw-sec-title">{{ t('aiKbWkRecentChanges') }}</span>
                <!-- 同上:蓝本未过 $t() 的装饰文案,照抄字面量(附录 A §A.4)。 -->
                <span class="kw-sec-en">Recent changes</span>
              </div>
              <div class="kw-changes">
                <div v-for="(c, i) in changes" :key="i" class="kw-change" :data-type="c.type">
                  <span class="kw-change-type">{{ c.label }}</span>
                  <span class="kw-change-name" :title="c.path">{{ c.name }}</span>
                  <span class="kw-change-time">{{ c.timeFmt }}</span>
                </div>
              </div>
            </div>

            <div v-if="raw !== null" class="kw-foot">
              <KIcon name="info" :size="12" />
              {{ t('aiKbWkRenderNote', { path: sel + '/.wiki.md' }) }}
              <button @click="showSource = !showSource">
                {{ showSource ? t('aiKbWkRenderedView') : t('aiKbWkViewSource') }} →
              </button>
            </div>
          </template>
        </template>
      </div>
    </div>
  </div>
</template>
