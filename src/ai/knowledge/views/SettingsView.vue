<!--
  SP8-P5c Task 8 —— 「系统设置」页(rail 第 9 项,路由 `/ai/knowledge/settings`),
  1:1 移植自 Vue2 蓝本 `NimoOS-UI` (main@7a6ee6b7)
  `src/views/AI/Knowledge/SettingsView.vue`(322 行,`git show main:` 读取 ——
  治理 §1:那个仓的工作树是旧分支,不可信)。

  上半(服务卡 / 运行档卡 / 沙盒入口 / 危险区)由 **T8** 落地并过评审;下半(笔记根目录
  折叠区 + 迁移确认弹窗 + 自动捕获开关 + `notesSettings` / `rootPicker` / `dirProbe` /
  `browserRoots` 那一整套 script)由 **T9** 插在「运行档卡」与「沙盒入口」之间 ——
  两刀合起来即蓝本 322 行的全量,**零占位符、零注释桩**。

  结构对照(蓝本行区间 → 本文件,New-UI 行号由脚本重算,见 T8 / T9 报告 §2):
    :2-4     `.k-view` → `.k-scroll` → `.k-scroll-inner` 三层壳(逐层照抄)
    :7-19    服务卡:状态灯 `[data-state]` + 两行文案 + 恢复/暂停按钮
    :22-34   运行档卡 · 并发行:三个按钮,文字**就是数字**(无档位名)
    :36-49   运行档卡 · 设备行:auto / cuda|gpu / cpu 三档 + `deviceLabel`
    :51-60   运行档卡 · OCR 行:`.k-sw` 开关 + `.warn` 警示句
    ── 以下为 T9 ────────────────────────────────────────────────────────────
    :63-70   笔记区 `.k-section` 区头(N16:`📝` 在 `t()` 外面)
    :71-102  笔记目录行:`<code>` 展示 + `openRootPicker` 折叠区 + `FolderBrowser`
             + 三档徽标 + 「仅指向」/「搬文件」两按钮 + `.kn-pick-note` 说明
    :104-116 自动捕获行:`.k-sw` 开关 + `v-if="!autoExtract"` 的 `.warn` 提示
    :120-156 迁移确认弹窗(**K29:转 reka 原语 + portal 到 `.knowledge-app`**)
    ── 以上为 T9 ────────────────────────────────────────────────────────────
    :159-166 沙盒入口 `.k-sandbox-link`
    :169-186 危险区 `.k-section` + 硬编码 `disabled` 的重建按钮
    :206-212 data():`notesSettings` / `rootPicker` / `dirProbe` / `migrating` / `migrateAck`(T9)
    :215-226 computed `controlState` / `deviceLabel` / `browserRoots`(第三个归 T9)
    :228-230 `created()` 拉 `notesApi.getSettings()`,catch 吞错保默认(T9)
    :232-281 `openRootPicker` / `onPick` / `toggleAutoExtract` / `closeMigrate` /
             `doMigrate` / `applyRoot`(T9)
    :282-319 `togglePause` / `setConcurrency` / `setDevice` / `toggleOcr` / `goSandbox`

  ─────────────────────────────────────────────────────────────────────────────
  【本页不在顶层路由,没有 K22/K31 那套外壳问题】
    本页挂在 `KnowledgeLayout` 之下(rail 第 9 项)→ `.k-scroll` 已有 `overflow-y:auto`
    (T2a/P5a 已就位),**不需要**自建滚动容器、**不许**挂 `.parser-app`(治理 §6.1 落地约束 4)。

  【零 `<style>` 块】设置页整段 scss(`.k-set-*` / `.k-svc-*` / `.k-radio-group` / `.k-sw` /
    `.k-section*` / `.k-sandbox-*` / `.k-set-danger` / `.k-set-soon` / `.warn`)由 **T2a**
    搬进 `src/ai/styles/knowledge.scss` 并过评审;`knowledge.scss` 由 `KnowledgeLayout.vue`
    侧 import,本文件不再 import 样式(先例:`QueueView.vue` / `IndexedFilesView.vue` 同款)。

  【K1 —— store 降层,逐处】蓝本 `this.store.state.controlState`(`:215`),本仓 `parserStore`/
    `knowledgeStore` 都是 Pinia setup store,**`state` 那一层整个消失** → `store.controlState`。
    本刀范围内的降层点共 **1 处 computed**(`:215` → 下方 `controlState`),它是模板里
    **12 处** `controlState.xxx` 读取(`paused` ×6 / `concurrency` ×1 / `device` ×3 /
    `ocr_enabled` ×1 / `resolved_device` ×1,`deviceLabel` 里 2 处走 computed)的唯一入口 ——
    漏这一层那些格子全是 `undefined`。蓝本 `:225` 的 `browserRoots`(第二处 `.state.`)归 T9。

  【K27 —— REST / toast 全部走包与 store】蓝本 `this.store.actions.setControl(...)` →
    `store.setControl(...)`(**4 处**);`this.store.actions.toast(...)` → `store.toast(...)`
    (**8 处** = 4 个成功 + 4 个 catch)。`store.toast` 内部转调全局 `useToast().show(msg, 2400)`
    (`knowledgeStore.ts:311-313`,2400ms 与蓝本一致),**本文件不直接用 `useToast()`** ——
    照 `QueueView.vue` 既有写法,不自己发明。

  【K30(K5 同族)—— 四个 catch 不回显后端文本】蓝本四处都是
    `toast($t('Operation failed') + ': ' + (e.message || e))`(`:287` / `:295` / `:304` / `:313`),
    本仓**只弹固定键**:`aiKbOpFailed`(三处)/ `aiKbSwitchFailed`(`setDevice` 那处)。
    落地判据是**排除式断言**(见 `SettingsView.test.ts` 的 K30 那一组:让 `parserControl`
    reject 一个带可识别文本的错误,断言 toast 文本与整页 DOM 都**不含**那段文本)。
    ⚠️ 那个探针文本**故意不出现在本文件里**(治理 §9 第九条:否定式断言撞注释 = 假报红)。

  【偏离,§2「Vue2 的 bug 不照抄」—— `togglePause` 的成功 toast 反了】
    蓝本 `:282-288`:
        await this.store.actions.setControl(this.controlState.paused ? 'resume' : 'pause')
        this.store.actions.toast(this.controlState.paused ? this.$t('Resumed') : this.$t('Paused'))
    `setControl` 内部 `await this.loadOverview()`(蓝本 `knowledgeStore.js:311-314`,本仓
    `knowledgeStore.ts:425-428` 逐字同构)会**把 `controlState` 换成后端刷新后的新值**
    → 第二次读到的 `paused` 已经是**动作之后**的状态:
        暂停中 → 发 `resume` → 刷新后 `paused === false` → 弹「已暂停」❌
        运行中 → 发 `pause`  → 刷新后 `paused === true`  → 弹「已继续」❌
    **两档都反**,是可复现的用户可见错误行为(治理 §2 判据「是 → 改并登记」)。
    🔴 蓝本自己的另外三个动作都是**先把意图存下来再发**(`setConcurrency` 用形参 `n`、
    `setDevice` 用形参 `d`、`toggleOcr` 用 `:308` 的 `const next = !ocr_enabled`)——
    **同一文件里四个动作三个对一个错**,可见这是漏改而非有意设计。
    本仓改法(最小):把 `paused` 在 `await` **之前**读一次存进 `wasPaused`,两处都用它
    → 恢复弹「已继续」、暂停弹「已暂停」。DOM / class / 图标 / 文案 / 请求载荷零变化,
    只有 toast 文案由「反的」变成「对的」。**已在 T8 报告显式申报,协调者若判「照抄」
    改回只需删掉 `wasPaused` 两处。**

  【K34 —— Vue 3 机械改写(零行为变化)】
    | 蓝本 | 本仓 | 为什么必需 |
    |---|---|---|
    | `this.$t(...)` | `t(...)`(`useI18n()`) | `<script setup>` 无 `this` |
    | `this.$router.push('/ai/parser/test')`(`:318`) | `router.push(...)`(`useRouter()`) | 同上 |
    | `computed: { controlState() {...} }` | `computed(() => ...)` | Options API → Composition API |
    保抛口径(T7 评审 M-1):本刀**零 `?.` / 零 `&&` 守卫**、零 `!` 非空断言 ——
    `deviceLabel` 里蓝本的 `(r || '').toUpperCase()` 是**蓝本自己写的**兜底,照抄不动
    (它不是 TS 逼出来的守卫:`resolved_device` 在 `ParserControlState` 里是必填 `string`)。

  【N16 —— emoji / 符号位置逐字照抄,一个都不许挪进/挪出 `t()`】
    在 `t()` **里面**:`⏸`(`aiKbSetSvcPausedLine` = `⏸ Paused` / `⏸ 已暂停`,蓝本 `:11`)·
                      `✅`(`aiKbSetSvcRunningLine`,同行)—— **键值本身含 emoji**。
    在 `t()` **外面**:`🧪`(蓝本 `:162`)· `⚠️`(蓝本 `:171`)。
    (`📝` 是蓝本 `:67` 笔记区的,归 T9。)

  【N21 #1 / #2 —— 两对「zh 撞车、只有 en 能判别」的键,两个都要用对】
    #1 `aiKbResume`(en `Resume`)vs 既有 `aiKbRebuild`(en `Rebuild`)—— zh **都是「恢复」**
       (Vue2 把 `Rebuild` 错译成「恢复」,`Resume`→「恢复」才是对的;不许统一)。
    #2 `aiKbSetSandboxTitle`(en `Test Sandbox`,大写 S)vs `aiKbPrTestLink`(en `Test sandbox`)
       —— zh 都是「测试沙盒」。**本页用前者。**
    另有两对本期治理文件没点名、T8 全表重扫得出的同族(见测试文件同名 describe):
    `aiKbDeviceAuto`(en `Auto`)vs `aiCfgAutoPlaceholder`(en `auto`,小写)·
    `aiKbSwitchFailed`(en `Switch failed`)vs `aiCfgToggleFailed`(en `Toggle failed`)。
    → 治理 §9.2 要求的 en 档强断言全部落在 `SettingsView.test.ts` 里。

  【裁定 A-1 —— 设备「自动」用 `aiKbDeviceAuto`,不复用 `aiKbOriginAuto`】
    两个键 en/zh **双双同值** → 渲染断言零判别力,守卫只能钉源码里的 `t()` 调用形状
    (照 T6 `ParserStatus.test.ts` 的做法)。

  【硬编码不进 i18n(N22 同族口径)】设备档的裸 `GPU` / `CPU`(蓝本 `:46-47`)与
    `deviceLabel` 的 `'GPU (CUDA)'` / `'CPU'`(蓝本 `:220-221`)—— 技术标识符,
    蓝本刻意没进 i18n,**不许顺手补键**。

  【N15 同族 —— 本页没有档位名称】并发那三个按钮的文字**就是 `{{ n }}`**。
    `Power-saving` / `Balanced` / `Full power` 是 **ParserStatus** 的东西(蓝本 `:38`),
    **不在本页**,不许把那边的写法搬过来。

  【危险区按钮硬编码 `disabled`】蓝本 `:181` 就是死的 `disabled`,永远不可点
    (治理 §13:验收只能验「是灰的 + 旁边有『即将上线』徽标」)。

  【本页此刻未上路由 = 预期】`knowledgeRoutes.ts` 的 `settings` 仍指占位页
    (`DEFERRED_TABS` 含 `'settings'`),**T10 才反转**;沙盒入口跳的 `/ai/parser/test`
    同样仍是占位页。浏览器里看不到本页,不是缺陷,不许改路由。

  【数据来源】`controlState` 由 `KnowledgeLayout.vue:186` 的 `store.loadOverview()`
    (挂载即拉 + 10 秒轮询)填充,上半**自己不发只读请求**;唯一的只读请求是蓝本
    `created()`(`:228-230`)那一发 `notesApi.getSettings()`,属下半(T9)。

  ═══════════════════ 以下为 T9(下半)的偏离/照抄申报 ═══════════════════

  【K29 —— 迁移确认弹窗转 reka 原语】蓝本 `:121-156` 是裸 `.k-modal-bg` + 遮罩
    `@click="closeMigrate"` + 内层 `@click.stop`。本仓改 `DialogRoot` / `DialogPortal` /
    `DialogOverlay` / `DialogContent`,`DialogPortal` 的 `to` 指向 `.knowledge-app`
    (K7 同族,SP8 已爆三次),结构照既有两个先例 `QueueView.vue:559-583` 与
    `IndexedFilesView.vue:1135-1180` 抄,不自己发明。三处映射:
      · 遮罩点击关闭 / 内层不关闭 → `DialogContent` 的 `pointerDownOutside`(等价)
      · 蓝本 `closeMigrate()` 清 **两个** state → 任何关闭路径都必须走它,故
        `@update:open` 接 `onMigrateOpenChange(v)`,`v === false` 时调 `closeMigrate()`
        (**不能**照 `QueueView` 那样直接写 `migrating = $event` —— 那会漏清 `migrateAck`)
      · reka 的 a11y 要求一个 `DialogTitle`。两个先例的蓝本里**没有**可见标题元素,
        所以它们用 `VisuallyHidden > DialogTitle` 另加一个隐藏节点;**本页蓝本 `:124`
        本来就有 `.k-modal-title`** → 用 `<DialogTitle as-child>` 直接套在那个 div 上,
        DOM 结构与蓝本逐字一致(不多一个隐藏节点),a11y 也满足。**这是比照抄先例更贴近
        1:1 的选择,已在 T9 报告显式申报。**
    ⚠️ `DialogPortal to=".knowledge-app"` **只认第一个同名宿主**(P5b 交接项 #3)——
      生产环境宿主由 `KnowledgeLayout.vue` 提供;测试里要自己在 body 备宿主
      (`SettingsView.test.ts` 的 `withHost()`,先例 `QueueView.test.ts:141-146`)。

  【K30(K5 同族)—— 下半再多两处 catch 不回显后端文本】
    · 蓝本 `applyRoot`(`:276-280`)catch 里读
      `(e.response && e.response.data && e.response.data.detail) || e.message || e`
      拼进 toast(蓝本自带注释说这是「400 = 非空目标目录的后端守卫,原样透出」)——
      本仓**只弹固定 `aiKbOpFailed`**。
    · 蓝本 `toggleAutoExtract`(`:259-261`)拼 `e.message || e` —— 同样只弹 `aiKbOpFailed`。
    落地判据是**排除式断言**(见测试文件 K30 那两组:让 `putSettings` reject 一个既带
    `response.data.detail` 又带 `message` 的错误,断言 toast / 全局 toast 栈 / 整页 DOM
    三处都不含那段文本)。⚠️ 探针文本**故意不出现在本文件里**(治理 §9 第九条)。

  【K1 —— 下半的第二处 store 降层】蓝本 `browserRoots`(`:225`)读
    `this.store.state.wikiCandidates` → 本仓 `store.wikiCandidates`;
    `this.store.actions.loadCandidates()` → `store.loadCandidates()`。

  【K27 —— `notesApi.*` 全部走共享包】蓝本 `notesApi.getSettings()` / `putSettings()` /
    `dirInfo()`(`@/service/notes.js`)→ `service.notes.*`。
    🔴 **层次**:`service.notes.getSettings/putSettings` 包内走 `normalizeSettings`
    (`NimoOS-Service/src/notes.ts:131-137`)→ 拿到的是 **camelCase 且只有
    `{ notesRoot, autoExtract }` 两个字段**;HTTP 层的 `distill_roots` /
    `distill_daily_cap` / `background_model` 被那个归一函数**丢掉了**。
    `dirInfo` 包内 `!!` 归一成 `{ exists: boolean, empty: boolean }`。
    ⚠️ `normalizeSettings` 的 `autoExtract: r.auto_extract !== false` —— 后端漏字段时
    归一成 `true`,与蓝本 `data()` 的默认值(`:206`)一致,照抄。

  【§5.2 / §9.1 —— `onPick` 的两处过期守卫照抄】蓝本 `:241-253`:成功分支
    `if (this.rootPicker.path !== path) return`(自带注释「A later pick may have
    superseded this probe」)+ catch 里 `if (this.rootPicker.path === path)` 才置
    `error`。**两处都照抄,一处都不许省。** 守卫变量是 `rootPicker.path` 这个**组件本地
    响应式 state**(不是模块级、也不是专用 epoch 计数器)—— 它同时被渲染
    (`v-if="rootPicker.path"` / `<code>` / 两个按钮的 `:disabled`),所以「两实例串号」
    在 DOM 上直接可见;测试仍按 §9.1 补了一条两实例交错用例。

  【N16 —— 下半的 emoji】`📝`(蓝本 `:67`)在 `t()` **外面**。
    下半没有任何 emoji 在 `t()` 里面。

  【N7 同族 —— `|| '/DATA/Notes'` 兜底照抄】蓝本 `:77` 与 `:129` 两处都写
    `notesSettings.notesRoot || '/DATA/Notes'`(后端返回空串时的展示兜底),两处都照抄。

  【K34 —— 下半的 Vue 3 机械改写(零行为变化)】
    | 蓝本 | 本仓 | 为什么必需 |
    |---|---|---|
    | `this.$refs.fb` + `this.$nextTick` | 模板 `ref="fb"` + `nextTick()` | `<script setup>` 无 `this` |
    | `async created()` | `onMounted(async () => …)` | Options API → Composition API;蓝本的 `created` 里那个 `await` 同样**不阻塞首屏**,故首帧都是走默认值渲染,行为一致 |
    | `data()` 对象 | `ref()` | 同上 |
    保抛口径(T7 评审 M-1):下半**零 `?.`、零 `!` 非空断言**。
    `if (fb.value) fb.value.reset()` 里那个 `if` **是蓝本自己写的守卫**
    (`:238` `if (this.$refs.fb)`),不是 TS 逼出来的 —— 逐字照抄。
-->
<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
} from 'reka-ui'
import { service } from '@nimotech/nimoos-service'
import type { NotesSettings } from '@nimotech/nimoos-service'
import KIcon from '../components/KIcon.vue'
import FolderBrowser from '../components/FolderBrowser.vue'
import { pickerRoots } from '../util/folderBrowser'
import { useKnowledgeStore } from '../stores/knowledgeStore'

const { t } = useI18n()
const router = useRouter()
const store = useKnowledgeStore()

/* ── T9:蓝本 data()(`:206-211`)的五项页面级瞬态,一律组件本地 ref,不塞 store ── */

/** 蓝本 `:206` —— 默认 `autoExtract: true`,与包内 `normalizeSettings` 的
 *  `r.auto_extract !== false`(后端漏字段 → true)一致。 */
const notesSettings = ref<NotesSettings>({ notesRoot: '', autoExtract: true })

/** 蓝本 `:207`。 */
const rootPicker = ref<{ open: boolean; path: string }>({ open: false, path: '' })

/** 蓝本 `:208-209` 的注释原文:`state: '' | 'loading' | 'done' | 'error'`;
 *  `migratable` = 目标目录**不存在或为空**。 */
const dirProbe = ref<{ state: '' | 'loading' | 'done' | 'error'; migratable: boolean }>({
  state: '',
  migratable: false,
})

/** 蓝本 `:210-211`。 */
const migrating = ref(false)
const migrateAck = ref(false)

/** 蓝本靠 `this.$refs.fb`(`:80` 的 `ref="fb"` + `:238` 的调用)—— Vue3 用模板 ref;
 *  `FolderBrowser` 侧 `defineExpose({ reset })` 已就位(T3)。 */
const fb = ref<InstanceType<typeof FolderBrowser> | null>(null)

/** 蓝本 computed `controlState`(`:215`)—— K1:`store.state.controlState` → `store.controlState`。 */
const controlState = computed(() => store.controlState)

/**
 * 蓝本 computed `deviceLabel`(`:216-223`)—— 四分支逐字照抄:
 *   `auto`        → `自动（当前 {r}）`,`r` 是 `resolved_device` 的大写(空值走蓝本的 `(r || '')` 兜底)
 *   `cuda` / `gpu` → 裸 `'GPU (CUDA)'`(硬编码技术标识符)
 *   `cpu`         → 裸 `'CPU'`
 *   其它          → 原样返回 `d`(后端将来加档位时不至于渲染成空)
 */
const deviceLabel = computed<string>(() => {
  const d = controlState.value.device
  const r = controlState.value.resolved_device
  if (d === 'auto') return t('aiKbSetDeviceAutoCurrent', { r: (r || '').toUpperCase() })
  if (d === 'cuda' || d === 'gpu') return 'GPU (CUDA)'
  if (d === 'cpu') return 'CPU'
  return d
})

/**
 * 蓝本 computed `browserRoots`(`:224-226`)—— K1 的第二处降层:
 * `this.store.state.wikiCandidates` → `store.wikiCandidates`。
 * `pickerRoots([])` 走兜底三根(`System (/DATA)` / `/media` / `/mnt`),治理 §4.3
 * 实测本机 `GET /v1/wiki/candidates` 就是 `[]` → 兜底那条是**真机走到的路径**。
 */
const browserRoots = computed(() => pickerRoots(store.wikiCandidates))

/**
 * 蓝本 `async created()`(`:228-230`)—— 唯一的只读请求。
 * 🔴 catch **吞错保默认值**(蓝本注释原文 `/* keep defaults *\/`):拉不到设置时
 * `notesSettings` 停在 `{ notesRoot: '', autoExtract: true }`,页面照旧渲染,
 * `notesRoot` 走模板里的 `|| '/DATA/Notes'` 兜底。照抄,不许改成弹 toast。
 */
onMounted(async () => {
  try {
    notesSettings.value = await service.notes.getSettings()
  } catch {
    /* keep defaults */
  }
})

/**
 * 蓝本 `openRootPicker()`(`:232-240`)—— 逐行照抄:先取反,**仅在打开时**清 path、
 * 重置探针、拉候选、下一帧重置 FolderBrowser。
 * ⚠️ `loadCandidates()` **不传 `silent`**(治理交接项 #7:只有后台预取传 `silent`,
 * 用户主动路径不传);蓝本同样不传参、也不 await(失败时 store 内部静默清空)。
 */
function openRootPicker(): void {
  rootPicker.value.open = !rootPicker.value.open
  if (rootPicker.value.open) {
    rootPicker.value.path = ''
    dirProbe.value = { state: '', migratable: false }
    store.loadCandidates()
    nextTick(() => {
      if (fb.value) fb.value.reset()
    })
  }
}

/**
 * 蓝本 `onPick(path)`(`:241-253`)—— **两处过期守卫逐字照抄**。
 * 成功分支那处蓝本自带注释:「A later pick may have superseded this probe — only
 * apply if current.」;catch 那处蓝本自带注释:「Probe is best-effort UX; the backend
 * migrate guard remains the gate.」
 * 🔴 少任一处守卫,「先点 A 再点 B、A 的响应后到」就会把 A 的探针结果盖到 B 的选择上
 * (徽标与「搬文件」按钮的可点性都会错)。
 */
async function onPick(path: string): Promise<void> {
  rootPicker.value.path = path
  dirProbe.value = { state: 'loading', migratable: false }
  try {
    const info = await service.notes.dirInfo(path)
    if (rootPicker.value.path !== path) return
    dirProbe.value = { state: 'done', migratable: !info.exists || info.empty }
  } catch {
    if (rootPicker.value.path === path) dirProbe.value = { state: 'error', migratable: false }
  }
}

/**
 * 蓝本 `toggleAutoExtract()`(`:254-262`)—— `next` 在发请求之前算(同 `toggleOcr`)。
 * 🔴 载荷**只带 `autoExtract`**,不带 `notesRoot`(包内 `buildSettingsBody` 只在
 * `notesRoot` 有值时才写 `notes_root` + `mode`)。catch 走 K30 固定键。
 */
async function toggleAutoExtract(): Promise<void> {
  const next = !notesSettings.value.autoExtract
  try {
    notesSettings.value = await service.notes.putSettings({ autoExtract: next })
    store.toast(next ? t('aiKbSetAutoCaptureOn') : t('aiKbSetAutoCaptureOff'))
  } catch {
    store.toast(t('aiKbOpFailed'))
  }
}

/** 蓝本 `closeMigrate()`(`:263-266`)—— **两个 state 都清**,照抄。 */
function closeMigrate(): void {
  migrating.value = false
  migrateAck.value = false
}

/**
 * K29 落地件:reka 的 `DialogRoot` 用 `@update:open` 表达「弹窗被关掉了」。
 * 蓝本的三条关闭路径(× 按钮 / 取消按钮 / 点遮罩)全都调 `closeMigrate()`,
 * 所以这里把 `v === false` 统一接到它 —— **不能**写成 `migrating = $event`
 * (那会漏清 `migrateAck`,下次打开时勾选框还是勾着的、danger 按钮直接可点)。
 */
function onMigrateOpenChange(v: boolean): void {
  if (!v) closeMigrate()
}

/** 蓝本 `doMigrate()`(`:267-270`)—— 🔴 **先关弹窗再发请求**,顺序照抄。 */
async function doMigrate(): Promise<void> {
  closeMigrate()
  await applyRoot('migrate')
}

/**
 * 蓝本 `applyRoot(mode)`(`:271-281`)—— `mode` 两个取值:`'adopt'`(仅指向)/
 * `'migrate'`(搬文件)。成功后关折叠区 + 弹「笔记目录已更新」。
 * catch 走 K30:蓝本在这里读 `e.response.data.detail` 原样透出后端 400 文案,
 * 本仓只弹固定键。
 */
async function applyRoot(mode: string): Promise<void> {
  try {
    notesSettings.value = await service.notes.putSettings({
      notesRoot: rootPicker.value.path,
      mode,
    })
    rootPicker.value.open = false
    store.toast(t('aiKbSetNotesFolderUpdated'))
  } catch {
    store.toast(t('aiKbOpFailed'))
  }
}

/**
 * 蓝本 `togglePause()`(`:282-289`)。
 * 🔴 `wasPaused` 是本仓修的那个 bug(见文件头「偏离,§2」那一节):蓝本在 `await` 之后
 * 又读了一次 `controlState.paused`,而 `setControl` 内部已 `await loadOverview()` 把它换成
 * 新值 → 两档 toast 全反。这里在发请求**之前**把意图存一次,两处都用它。
 */
async function togglePause(): Promise<void> {
  const wasPaused = controlState.value.paused
  try {
    await store.setControl(wasPaused ? 'resume' : 'pause')
    store.toast(wasPaused ? t('aiKbResumed') : t('aiKbPaused'))
  } catch {
    // K30:蓝本这里拼 `': ' + (e.message || e)`,本仓只弹固定键
    store.toast(t('aiKbOpFailed'))
  }
}

/** 蓝本 `setConcurrency(n)`(`:290-297`)—— 🔴 载荷键是 `n`(后端 `controlReq{ N *int json:"n" }`)。 */
async function setConcurrency(n: number): Promise<void> {
  try {
    await store.setControl('set_concurrency', { n })
    store.toast(t('aiKbSetConcurrencySet', { n }))
  } catch {
    store.toast(t('aiKbOpFailed'))
  }
}

/**
 * 蓝本 `setDevice(d)`(`:298-306`)—— toast 的 `label` 三元照抄:
 * `auto` 走 i18n,`cpu` / 其它是裸 `'CPU'` / `'GPU'`(注意:这里是裸 `GPU`,
 * 不是 `deviceLabel` 里那个 `'GPU (CUDA)'`,蓝本两处不同,别统一)。
 * 失败键是 `aiKbSwitchFailed`(「切换失败」),**不是** `aiKbOpFailed`。
 */
async function setDevice(d: string): Promise<void> {
  try {
    await store.setControl('set_device', { device: d })
    const label = d === 'auto' ? t('aiKbDeviceAuto') : d === 'cpu' ? 'CPU' : 'GPU'
    store.toast(t('aiKbSetDeviceSet', { label }))
  } catch {
    store.toast(t('aiKbSwitchFailed'))
  }
}

/** 蓝本 `toggleOcr()`(`:307-315`)—— `next` 在发请求之前算(蓝本如此,照抄)。 */
async function toggleOcr(): Promise<void> {
  const next = !controlState.value.ocr_enabled
  try {
    await store.setControl('set_ocr', { enabled: next })
    store.toast(next ? t('aiKbSetOcrOn') : t('aiKbSetOcrOff'))
  } catch {
    store.toast(t('aiKbOpFailed'))
  }
}

/** 蓝本 `goSandbox()`(`:316-319`)—— 复用既有 `/ai/parser/test` 页(此刻仍是占位页,T10 反转)。 */
function goSandbox(): void {
  router.push('/ai/parser/test')
}
</script>

<template>
  <div class="k-view">
    <div class="k-scroll">
      <div class="k-scroll-inner">

        <!-- 服务卡(蓝本 :6-19)—— N16:`⏸` / `✅` 在 t() 里面(键值自带) -->
        <div class="k-set-card k-set-svc">
          <div class="k-svc-state">
            <span class="k-svc-light" :data-state="controlState.paused ? 'paused' : 'running'" />
            <div style="flex: 1">
              <div class="k-svc-name">{{ controlState.paused ? t('aiKbSetSvcPausedLine') : t('aiKbSetSvcRunningLine') }}</div>
              <div class="k-svc-cn">{{ controlState.paused ? t('aiKbSetSvcPausedDesc') : t('aiKbSetSvcRunningDesc') }}</div>
            </div>
            <button :class="['k-btn', controlState.paused ? 'primary' : 'outline']" @click="togglePause">
              <KIcon :name="controlState.paused ? 'play' : 'pause'" :size="12" />
              {{ controlState.paused ? t('aiKbResume') : t('aiKbPause') }}
            </button>
          </div>
        </div>

        <!-- 运行档卡(蓝本 :21-61) -->
        <div class="k-set-card">
          <div class="k-set-row">
            <div class="k-set-row-info">
              <div class="k-set-row-title">{{ t('aiKbSetConcurrentFiles') }}</div>
              <div class="k-set-row-cn">{{ t('aiKbConcurrencyLevel') }}</div>
              <div class="k-set-row-desc">{{ t('aiKbSetConcurrencyDesc') }}</div>
            </div>
            <!-- 🔴 按钮文字**就是数字**(N15 同族:档位名在 ParserStatus,不在本页) -->
            <div class="k-radio-group">
              <button v-for="n in [1, 2, 4]" :key="n"
                      :data-on="String(controlState.concurrency === n)"
                      @click="setConcurrency(n)">{{ n }}</button>
            </div>
          </div>

          <div class="k-set-row">
            <div class="k-set-row-info">
              <div class="k-set-row-title">{{ t('aiKbInferenceDevice') }}</div>
              <div class="k-set-row-cn">{{ t('aiKbSetDeviceCn') }}</div>
              <div class="k-set-row-desc">
                {{ t('aiKbSetCurrentlyUsing') }} <b>{{ deviceLabel }}</b>
              </div>
            </div>
            <!-- 🔴 第二档的 data-on 吃 `cuda` **和** `gpu` 两个值(蓝本 :46) -->
            <div class="k-radio-group">
              <button :data-on="String(controlState.device === 'auto')" @click="setDevice('auto')">{{ t('aiKbDeviceAuto') }}</button>
              <button :data-on="String(controlState.device === 'cuda' || controlState.device === 'gpu')" @click="setDevice('cuda')">GPU</button>
              <button :data-on="String(controlState.device === 'cpu')" @click="setDevice('cpu')">CPU</button>
            </div>
          </div>

          <div class="k-set-row">
            <div class="k-set-row-info">
              <div class="k-set-row-title">{{ t('aiKbSetOcrTitle') }}</div>
              <div class="k-set-row-cn">{{ t('aiKbSetOcrCn') }}</div>
              <div class="k-set-row-desc">
                <span class="warn"><KIcon name="danger" :size="11" /> {{ t('aiKbSetOcrWarn') }}</span>. {{ t('aiKbSetOcrOnlyScanned') }}
              </div>
            </div>
            <!-- 🔴 `!!` 双取反照抄(蓝本 :59):后端漏字段时 String(undefined) 会渲染成 "undefined" -->
            <button class="k-sw" :data-on="String(!!controlState.ocr_enabled)" @click="toggleOcr" />
          </div>
        </div>

        <!-- 笔记区(蓝本 :63-118)—— N16:📝 在 t() 外面 -->
        <div class="k-section">
          <div class="k-section-head">
            <div>
              <div class="k-section-title">📝 {{ t('aiKbSetNotesSection') }}</div>
              <div class="k-section-hint">{{ t('aiKbSetNotesSectionHint') }}</div>
            </div>
          </div>
          <div class="k-set-card">
            <!-- 笔记目录行(蓝本 :72-102)—— 这一行的 align-items 是 flex-start(内容会长高) -->
            <div class="k-set-row" style="align-items: flex-start">
              <div class="k-set-row-info">
                <div class="k-set-row-title">{{ t('aiKbSetNotesFolder') }}</div>
                <div class="k-set-row-cn">{{ t('aiKbSetNotesFolderCn') }}</div>
                <div class="k-set-row-desc">
                  <!-- 🔴 N7 同族:`|| '/DATA/Notes'` 兜底照抄(后端返回空串时的展示兜底) -->
                  <code>{{ notesSettings.notesRoot || '/DATA/Notes' }}</code> — {{ t('aiKbSetNotesFolderDesc') }}
                </div>
                <div v-if="rootPicker.open" style="border-top: 1px dashed var(--line); margin-top: 12px; padding-top: 12px">
                  <FolderBrowser ref="fb" :roots="browserRoots" @pick="onPick" />
                  <div v-if="rootPicker.path" class="kn-picked" style="margin-top: 10px">
                    <!-- 冒号是模板里的裸 ASCII `:`(不在 t() 里),照抄蓝本 :82 -->
                    {{ t('aiKbSetSelected') }}: <code>{{ rootPicker.path }}</code>
                    <!-- 🔴 三档徽标:loading / done+可迁移 / done+不可迁移。
                         `state === 'error'` 时**三档都不出**(蓝本没有第四个分支)。 -->
                    <span v-if="dirProbe.state === 'loading'" class="kn-badge" data-s="archived">{{ t('aiKbSetChecking') }}</span>
                    <span v-else-if="dirProbe.state === 'done' && dirProbe.migratable" class="kn-badge" data-s="curated">{{ t('aiKbSetDirEmptyMigratable') }}</span>
                    <span v-else-if="dirProbe.state === 'done'" class="kn-badge" data-s="draft">{{ t('aiKbSetDirNotEmpty') }}</span>
                  </div>
                  <div class="kn-pick-actions" style="margin-top: 10px">
                    <button class="k-btn primary" :disabled="!rootPicker.path" @click="applyRoot('adopt')">
                      <KIcon name="folder" :size="12" /> {{ t('aiKbSetPointToExisting') }}
                    </button>
                    <!-- 🔴 这个按钮的 disabled 是**两个**条件:没选路径,或者探针明确说了目标非空。
                         探针还在 loading / 出错时它是**可点**的(后端 migrate 守卫才是最终关卡)。
                         点它只把 migrating 置 true,**不发任何请求**。 -->
                    <button class="k-btn outline" :disabled="!rootPicker.path || (dirProbe.state === 'done' && !dirProbe.migratable)"
                            @click="migrating = true">
                      <KIcon name="upload" :size="12" /> {{ t('aiKbSetMoveFiles') }}
                    </button>
                    <span class="kn-pick-note">{{ t('aiKbSetPickNote') }}</span>
                  </div>
                </div>
              </div>
              <button :class="['k-btn', rootPicker.open ? 'ghost' : 'outline']" @click="openRootPicker">
                {{ rootPicker.open ? t('aiKbCancel') : t('aiKbSetChange') }}
              </button>
            </div>

            <!-- 自动捕获行(蓝本 :104-116) -->
            <div class="k-set-row">
              <div class="k-set-row-info">
                <div class="k-set-row-title">{{ t('aiKbSetAutoCapture') }}</div>
                <div class="k-set-row-cn">{{ t('aiKbSetAutoCaptureCn') }}</div>
                <div class="k-set-row-desc">
                  {{ t('aiKbSetAutoCaptureDesc') }}
                  <!-- 🔴 本机实测 auto_extract:true → 这一行**不渲染**(治理 §13,是正确行为) -->
                  <span v-if="!notesSettings.autoExtract" class="warn" style="display: block; margin-top: 2px">
                    <KIcon name="danger" :size="11" /> {{ t('aiKbSetAutoCaptureOffWarn') }}
                  </span>
                </div>
              </div>
              <!-- 🔴 `!!` 双取反照抄(蓝本 :115) -->
              <button class="k-sw" :data-on="String(!!notesSettings.autoExtract)" @click="toggleAutoExtract" />
            </div>
          </div>
        </div>

        <!-- 迁移确认弹窗(蓝本 :120-156)—— K29:reka Dialog 原语,portal 到知识库容器。
             蓝本的「点遮罩关闭 / 点弹窗内不关闭」由 DialogContent 的 pointerDownOutside
             等价提供;所有关闭路径统一走 closeMigrate()(见 onMigrateOpenChange 注释)。 -->
        <DialogRoot :open="migrating" @update:open="onMigrateOpenChange">
          <DialogPortal to=".knowledge-app" defer>
            <DialogOverlay class="k-modal-bg">
              <DialogContent class="k-modal" style="width: min(460px, 100%)" :aria-describedby="undefined">
                <div class="k-modal-head">
                  <!-- DialogTitle 套在蓝本自己的 .k-modal-title 上(as-child)—— 满足 reka
                       的 a11y 要求且**不多一个隐藏节点**,DOM 与蓝本 :124 逐字一致。 -->
                  <DialogTitle as-child>
                    <div class="k-modal-title">{{ t('aiKbSetMigrateTitle') }}</div>
                  </DialogTitle>
                  <button class="k-modal-x" @click="closeMigrate"><KIcon name="x" :size="13" /></button>
                </div>
                <div class="k-modal-body">
                  <div class="kn-mig-path">
                    <span style="color: var(--text-tertiary)">{{ notesSettings.notesRoot || '/DATA/Notes' }}</span>
                    <KIcon name="arrowRight" :size="13" color="var(--warning)" />
                    <b>{{ rootPicker.path }}</b>
                  </div>
                  <ul class="kn-mig-req" style="margin-top: 10px">
                    <li>
                      <!-- 🔴 只有第一条的 :color 是三元(目标非空时变危险色),另两条恒 success -->
                      <KIcon name="check" :size="13" :color="dirProbe.state === 'done' && !dirProbe.migratable ? 'var(--danger)' : 'var(--success)'" />
                      <span>
                        {{ t('aiKbSetMigrateReq1') }}
                        <b v-if="dirProbe.state === 'done' && !dirProbe.migratable" style="color: var(--danger)">{{ t('aiKbSetMigrateNotEmpty') }}</b>
                      </span>
                    </li>
                    <li><KIcon name="check" :size="13" color="var(--success)" /><span>{{ t('aiKbSetMigrateReq2') }}</span></li>
                    <li><KIcon name="check" :size="13" color="var(--success)" /><span>{{ t('aiKbSetMigrateReq3') }}</span></li>
                  </ul>
                  <label class="kn-checkline" style="margin-top: 10px">
                    <input v-model="migrateAck" type="checkbox" />
                    {{ t('aiKbSetMigrateAck') }}
                  </label>
                </div>
                <div class="k-modal-foot">
                  <button class="k-btn ghost" @click="closeMigrate">{{ t('aiKbCancel') }}</button>
                  <button class="k-btn danger" :disabled="!migrateAck" @click="doMigrate">
                    <KIcon name="upload" :size="12" /> {{ t('aiKbSetMigrateStart') }}
                  </button>
                </div>
              </DialogContent>
            </DialogOverlay>
          </DialogPortal>
        </DialogRoot>

        <!-- 沙盒入口(蓝本 :158-166)—— N16:🧪 在 t() 外面 -->
        <a class="k-sandbox-link" @click.prevent="goSandbox">
          <div class="k-sandbox-icon"><KIcon name="test" :size="20" /></div>
          <div style="flex: 1">
            <div style="font-size: 14px; font-weight: 600; letter-spacing: -0.005em">🧪 {{ t('aiKbSetSandboxTitle') }}</div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px">{{ t('aiKbSetSandboxHint') }}</div>
          </div>
          <KIcon name="chev" :size="14" color="var(--text-tertiary)" />
        </a>

        <!-- 危险区(蓝本 :168-186)—— N16:⚠️ 在 t() 外面;按钮硬编码 disabled -->
        <div class="k-section">
          <div class="k-section-head">
            <div class="k-section-title" style="color: var(--danger)">⚠️ {{ t('aiKbSetDangerZone') }}</div>
            <div class="k-section-hint">{{ t('aiKbDeferredTitle') }}</div>
          </div>
          <div class="k-set-card k-set-danger">
            <div class="k-set-row" style="padding: 8px 0">
              <div class="k-set-row-info">
                <div class="k-set-row-title">{{ t('aiKbSetRebuildAll') }} <span class="k-set-soon">{{ t('aiKbDeferredTitle') }}</span></div>
                <div class="k-set-row-cn">{{ t('aiKbSetRebuildAll') }}</div>
                <div class="k-set-row-desc">{{ t('aiKbSetRebuildAllDesc') }}</div>
              </div>
              <button class="k-btn danger" disabled>
                <KIcon name="danger" :size="12" /> {{ t('aiKbSetRebuildEllipsis') }}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>
