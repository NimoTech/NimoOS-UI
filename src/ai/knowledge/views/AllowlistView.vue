<!--
  SP8-P5f Task 4 —— 「白名单」页(rail 第 8 项,路由 `/ai/knowledge/allowlist`),
  1:1 移植自 Vue2 蓝本 `NimoOS-UI` @ `7a6ee6b7`
  `src/views/AI/Knowledge/AllowlistView.vue`(249 行,`git -C ../../NimoOS-UI show 7a6ee6b7:` 读取
  —— 治理 §0.4:那个仓的工作树是别的分支,不可信)。

  结构对照(蓝本行区间 → 本文件):
    :2-4     `.k-view` → `.k-scroll` → `.k-scroll-inner` 三层壳(逐层照抄)
    :6-53    Section A「文件类型」:分组标题 + 全选/全不选 + 扩展名 chips + 高级折叠区 + 自定义输入
    :56-97   Section B「文件夹规则」:空态 / 表头 + 行 / 优先级提示
    :101-151 「添加文件夹规则」弹窗(**K57:转 reka 原语 + portal 到 `.knowledge-app`**)
    :159-166 `GROUPS_TEMPLATE` 三组模板(**K55:三个 `bg` 渐变改 token**)
    :171-179 `data()` 的四项页面级瞬态 → 组件本地 `ref`
    :180-188 `computed groups`(N54)
    :189-191 `created()` → `onMounted()`
    :192-246 `methods` → 普通函数

  ─────────────────────────────────────────────────────────────────────────────
  【零 <style> 块 —— K44 / 治理 §3】本页整段 scss(`.k-extgroup*` / `.k-ext-chip*` /
    `.k-custom-add` / `.k-frow*` / `.k-priority-hint` / `.k-field*` / `.k-radio-2` /
    `.k-radio-card*`)已由 **T2** 搬进 `src/ai/styles/knowledge.scss`(蓝本
    `knowledge.scss:985-1141` + `:1342-1396` + `:1500-1503` 的 `@media`)并过评审;
    `knowledge.scss` 由 `KnowledgeLayout.vue` 侧 import,本文件不再 import 样式
    (先例:`QueueView.vue` / `IndexedFilesView.vue` / `SettingsView.vue` 同款)。

  【K1 —— store 降层,逐处】蓝本 `this.store.state.extensions`(`:182`)/
    `this.store.state.folderRules`(`:65` `:75`),本仓 `knowledgeStore` 是 Pinia setup store,
    **`state` 那一层整个消失** → `store.extensions` / `store.folderRules`。
    降层点共 **3 处**(computed 1 + 模板 2)—— 漏一处那一块整个空白且不报错。

  【K55 —— `GROUPS_TEMPLATE` 三个 `bg` 渐变改 token】蓝本 `:160` / `:162` / `:164` 把三条
    `linear-gradient(135deg, …)` 字面量直接写在 `.vue` 的 `<script>` 常量里,经
    `:style="{background: g.bg}"`(`:14`)渲染。🔴 **`color-guard` 压根不扫 `.ts` / `.vue` 的
    `<script>` 常量**(cross-area §1 票 B 位置④,变异实测「注释注入色值全量全绿」)⇒ 那三条
    是全仓唯一裸奔的可见颜色。本仓改成 `var(--grad-ext-docs)` / `var(--grad-ext-text)` /
    `var(--grad-ext-code)` 三个 token(T2 已在 `knowledge.scss` 的暗/亮两档各声明一份,
    取值定死在附录 B §B.1 / §B.6)。
    落地守卫两条,都在 `src/ai/styles/knowledgeStyles.test.ts`:
      · T2b 布下的「自动上膛」条件断言(裁定 R20 的 M-a)—— 本文件一存在就上膛,
        钉三个分组各消费**对应**的 token(串位也会被抓);
      · 本刀在 `AllowlistView.test.ts` 里补的 K40 同款定向断言 —— 钉三个 `bg` 只含
        `var(--…)`、零 hex / rgb / 具名色(判据:注入一个色字面量 → 必须报红)。

  【K57 —— 「添加文件夹规则」弹窗转 reka 原语】蓝本 `:102-151` 是裸 `.k-modal-bg` +
    遮罩 `@click="adding = false"` + 内层 `@click.stop`。本仓改 `DialogRoot` /
    `DialogPortal to=".knowledge-app" defer` / `DialogOverlay class="k-modal-bg"` /
    `DialogContent class="k-modal"`,结构照既有先例 `SettingsView.vue`(K29 落地)抄,
    不自己发明。三处映射:
      · 遮罩点击关闭 / 点弹窗内不关闭 → `DialogContent` 的 `pointerDownOutside`(等价),
        🔴 **不再写 `@click.stop`**;
      · 蓝本三条关闭路径(× / 取消 / 点遮罩)都只把 `adding` 置 false,**没有第二个 state
        要清** ⇒ `@update:open` 直接写 `adding = $event`(与 `QueueView.vue` 的 `confirmClear`
        同款;`SettingsView` 之所以要绕一个 `closeMigrate()`,是因为它还要清 `migrateAck`);
      · reka 的 a11y 要求一个 `DialogTitle`。**本页蓝本 `:105` 本来就有 `.k-modal-title`**
        → 用 `<DialogTitle as-child>` 直接套在那个 div 上,DOM 结构与蓝本逐字一致
        (不多一个隐藏节点),**不需要 `VisuallyHidden`** —— 同 `SettingsView` 的选择。
    ⚠️ `DialogPortal to=".knowledge-app"` **只认第一个同名宿主**(P5b 交接项 #3)。
      本页在生产里挂在 `KnowledgeLayout.vue` 之下,而 `.knowledge-app` 这个 class 全仓
      **只有 `KnowledgeLayout.vue` 一处**在渲染(其余出现处都是 `knowledge.scss` 的选择器
      与测试里的临时宿主)⇒ 同一时刻页面上有且只有一个宿主,`to` 指哪个不存在歧义。
      测试里要自己在 body 备一个宿主(`AllowlistView.test.ts` 的 `withHost()`,
      先例 `SettingsView.test.ts` / `QueueView.test.ts`)。

  【K58(K5 同族)—— 5 个 catch 不回显后端文本】蓝本 5 处都是
    `this.store.actions.toast(this.$t('Save failed') + ': ' + (e.message || e))`
    (`:199` `:209` `:221` `:237` `:244`)—— 第二句正是 K5 禁止回显的 `e.message`。
    本仓按 `p5f-task-0-report.md` §12 认定的**既定做法(形态 A)**:**只弹固定 i18n 键、
    不留 `': '` 前缀**(「无第二句可拼故不留前缀」,先例 `QueueView.vue:212-217` /
    `IndexedFilesView.vue:592-593` / `NoteEditPane.vue:461`)。**不自造第二套映射。**
    五处落点:`toggle` / `setAllInGroup` → `aiKbAlSaveFailed`;`addCustom` → `aiKbAlAddFailed`;
    `saveRule` → `aiKbAlSaveFailed`;`removeRule` → `aiKbAlDeleteFailed`。
    落地判据是**排除式断言**(见测试文件 K58 那一组:让 store action reject 一个带可识别
    文本的错误,断言 toast 文本与整页 DOM 都**不含**那段文本)。
    ⚠️ 那个探针文本**故意不出现在本文件里**(治理 §9:否定式断言撞注释 = 假报红)。

  【K27 同族 —— toast 一律走 `store.toast(...)`】裁定 **R27** / 勘误 **E-62**:
    `knowledgeStore.ts` 里 `toast()` 内部是 `useToast().show(msg, 2400)`,而**全局 `show()`
    默认只有 1500ms** ⇒ 直调 `useToast()` 会丢掉蓝本自己的 2400ms。既有 6 页全走
    `store.toast()`,本页照同一份 —— 共 **10 处** = **5 个成功** + **5 个 catch**
    (catch 侧用 3 个键:`aiKbAlSaveFailed` ×3 / `aiKbAlAddFailed` / `aiKbAlDeleteFailed`)。
    🔴 **订正(T5 顺手做,裁定 R24 的 Minor M-1)**:本行原写「9 处 = 5 成功 + 4 catch」,
    漏数了 `toggle()` 的 catch。**只改这段注释,产品代码一行未动。**

  ═══════════════════ 照抄申报(§3.5 的 N 条目)═══════════════════

  【N47 —— `:data-on="String(e.enabled)"` 照抄】(`:27`)Parser 把 `enabled` 报成 SQLite
    **整数 0/1**,归一化(`!!e.enabled`)**在 store 里**(`knowledgeStore.ts:395`),
    🔴 **本页不再归一化一次**。模板侧的 `String(...)` 逐字照抄 —— `data-*` 不是布尔属性,
    假侧要渲染成字符串 `"false"` 而不是缺席,测试两侧都比 `'true'` / `'false'`。

  【N49 —— `store.extensions || []` 照抄】(蓝本 `:182`)Go / Python 侧的空数组可能序列化成
    `null`,这类兜底是必要防御,**不许删**。

  【N52 —— `setAllInGroup` 是串行 `for` + `await`,且带 `if (e.enabled !== on)` 跳过】
    (蓝本 `:202-211`)🔴 **不许改成 `Promise.all` 并发** —— 它打的是同一个 SQLite 后端,
    蓝本的串行是有意的。两条用例:已是目标态的不发请求 · 顺序是串行(判据:改成
    `Promise.all` → 必须报红)。
    ⚠️ 循环里读的 `g.exts` 是**点击那一刻的快照**:`store.toggleExtension` 内部会
    `loadAllowlist()` 整体换掉 `extensions`,`groups` 随之重算出新对象,而 `g` 仍指向旧快照
    ⇒ 后续几轮的 `e.enabled` 用的是旧值。**蓝本(Vue 2 computed)行为逐字相同,照抄不改。**

  【N53 —— `addCustom` 的规范化】(蓝本 `:212-223`)`trim().toLowerCase()`,不以 `.` 开头
    则补 `.`;空串直接 return(**不发请求**)。三条用例 + 成功后 `customExt` 清空一条。

  【N54 —— 三张 `match` 扩展名表逐字照抄】(蓝本 `:161` / `:163` / `:165`,**12 + 13 + 25 = 50**
    项,勘误 **E-74**)🔴 **不许「补全」也不许删减任何一项** —— 改了会静默隐藏 / 显示扩展名。
    `groups` 另外三件事也照抄:`localeCompare` 排序 · `filter(g => g.exts.length > 0)`
    空组整组不渲染 · **不在三组匹配表里的扩展名一个都不显示**。
    ⚠️ **本机后果(裁定 R6,是蓝本行为不是本期缺陷)**:Parser 认 45 个扩展名,其中 `.wps`
    (`enabled: 1`)**三组都不匹配** ⇒ 页面只显示 44 个,`.wps` 在本页既开不了也关不了。
    已另开记账票(裁定书 §四 票 E),**改它就是改蓝本行为,违「界面严格 1:1」**。

  ═══════════════════ Vue2 → Vue3 强制改写(治理 §2,不算偏离)═══════════════════
    | 蓝本(Options API) | 本文件 | 依据 |
    |---|---|---|
    | `data()` 对象 | `ref()` | `<script setup>` 无 `this` |
    | `computed: { groups() }` | `computed()` | 同上 |
    | `created()` | `onMounted()` | 蓝本那一发 `loadAllowlist()` 同样**不阻塞首屏**(它没 await),行为一致 |
    | `methods: { … }` | 普通函数 | 同上 |
    | `this.$t` | `useI18n().t` | 本仓既定 |
    | `this.store.actions.x()` | `store.x()` | Pinia setup store 无 `actions` 那一层 |

  🔴 **零 `any`**(承 K41):三处形状在下方各自声明了具名 interface;`store.extensions` /
    `store.folderRules` 的元素类型直接从 `knowledgeStore` import,不重写。
-->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
} from 'reka-ui'
import KIcon from '../components/KIcon.vue'
import { useKnowledgeStore } from '../stores/knowledgeStore'
import type { AllowlistExtension } from '../stores/knowledgeStore'

const { t } = useI18n()
const store = useKnowledgeStore()

/** 蓝本 `:159-166` 的分组模板一项。`labelKey` 经 `$t(g.labelKey)`(`:17`)与
 *  `$t('All {group} …', { group: $t(g.labelKey) })`(`:207`)两处渲染 ⇒ 它是**动态键**,
 *  必须进 i18n(附录 A §A.7),在模板里 grep 不到,**不许判成死键**。 */
interface ExtGroupTemplate {
  id: string
  labelKey: string
  icon: string
  /** 🔴 K55:只放 `var(--…)` 引用,**不许**放色字面量(附录 B §B.1)。 */
  bg: string
  match: (ext: string) => boolean
}

/** `groups` computed 的产物 —— 模板多出一个已过滤 + 已排序的 `exts`。 */
interface ExtGroup extends ExtGroupTemplate {
  exts: AllowlistExtension[]
}

/** 蓝本 `:171-178` 的 `form` 三字段。`root_id` / `path_glob` / `action` 是
 *  **Parser 的 HTTP 契约字段名(snake_case)**,原样发给后端(`knowledgeStore.ts:406-414`),
 *  🔴 **不许改成 camelCase**。 */
interface FolderRuleForm {
  root_id: string
  path_glob: string
  action: string
}

/**
 * 蓝本 `:159-166` —— 三个分组模板。
 * 🔴 **K55**:`bg` 的三条 `linear-gradient` 字面量 → 三个 token(附录 B §B.1,取值定死,
 *   实现者不许自选);token 声明在 `src/ai/styles/knowledge.scss` 的暗/亮两档,两档同值。
 * 🔴 **N54**:三张 `match` 表**逐字照抄**(12 + 13 + 25 = 50 项,勘误 E-74),
 *   **不许补全、不许删减** —— 改了会静默隐藏 / 显示扩展名。
 */
const GROUPS_TEMPLATE: ExtGroupTemplate[] = [
  { id: 'docs', labelKey: 'aiKbAlGroupDocuments', icon: 'file', bg: 'var(--grad-ext-docs)',
    match: (ext) => ['.pdf', '.docx', '.doc', '.pptx', '.ppt', '.xlsx', '.xls', '.odt', '.html', '.htm', '.xml', '.epub'].includes(ext) },
  { id: 'text', labelKey: 'aiKbAlGroupText', icon: 'edit', bg: 'var(--grad-ext-text)',
    match: (ext) => ['.md', '.markdown', '.txt', '.rst', '.csv', '.tsv', '.json', '.yaml', '.yml', '.toml', '.ini', '.env', '.log'].includes(ext) },
  { id: 'code', labelKey: 'aiKbAlGroupCode', icon: 'code', bg: 'var(--grad-ext-code)',
    match: (ext) => ['.py', '.go', '.js', '.ts', '.jsx', '.tsx', '.java', '.c', '.cc', '.cpp', '.h', '.hpp', '.cs', '.rb', '.rs', '.php', '.sh', '.bash', '.zsh', '.fish', '.sql', '.lua', '.kt', '.scala', '.swift'].includes(ext) },
]

/* ── 蓝本 data()(`:171-178`)的四项页面级瞬态,一律组件本地 ref,不塞 store(治理 §5.1)── */

/** 蓝本 `:174` —— 「高级:自定义扩展名」折叠区。 */
const customOpen = ref(false)
/** 蓝本 `:175`。 */
const customExt = ref('')
/** 蓝本 `:176` —— 「添加文件夹规则」弹窗开关。 */
const adding = ref(false)
/** 蓝本 `:177` —— 表单初值;`saveRule` 成功后重置回**这一份**(蓝本 `:234` 逐字同值)。 */
const form = ref<FolderRuleForm>({ root_id: 'any', path_glob: '/Downloads/*', action: 'deny' })

/**
 * 蓝本 `:181-187`(N54)。三件事逐字照抄:
 *   ① `match` 命中才进组 ⇒ **不在三张表里的扩展名一个都不显示**(本机 `.wps` 就是这一档);
 *   ② `localeCompare` 排序;
 *   ③ `filter(g => g.exts.length > 0)` ⇒ **空组整组不渲染**。
 * 🔴 K1 降层:蓝本 `this.store.state.extensions` → `store.extensions`;
 *    N49 的 `|| []` 兜底照抄不删。
 */
const groups = computed<ExtGroup[]>(() => {
  const all = store.extensions || []
  return GROUPS_TEMPLATE.map((g) => ({
    ...g,
    exts: all.filter((e) => g.match(e.ext)).sort((a, b) => a.ext.localeCompare(b.ext)),
  })).filter((g) => g.exts.length > 0)
})

/** 蓝本 `:189-191` 的 `created()`。蓝本没有 await、也没有 catch —— 照抄
 *  (先例 `QueueView.vue:290` 的 `onMounted(() => { loadForScope() })`)。 */
onMounted(() => {
  store.loadAllowlist()
})

/** 蓝本 `:193`。 */
function onCountFor(g: ExtGroup): number {
  return g.exts.filter((e) => e.enabled).length
}

/** 蓝本 `:194-201`(K58:catch 里只弹固定键,不回显后端文本)。 */
async function toggle(ext: string, enabled: boolean): Promise<void> {
  try {
    await store.toggleExtension(ext, enabled)
    store.toast(enabled ? t('aiKbAlNowIndexing', { ext }) : t('aiKbAlStoppedIndexing', { ext }))
  } catch {
    store.toast(t('aiKbAlSaveFailed'))
  }
}

/**
 * 蓝本 `:202-211` —— 🔴 **N52:串行 `for` + `await`,带 `if (e.enabled !== on)` 跳过**。
 * **不许改成 `Promise.all`**:它打的是同一个 SQLite 后端,蓝本的串行是有意的。
 */
async function setAllInGroup(g: ExtGroup, on: boolean): Promise<void> {
  try {
    for (const e of g.exts) {
      if (e.enabled !== on) await store.toggleExtension(e.ext, on)
    }
    store.toast(
      on
        ? t('aiKbAlAllSelected', { group: t(g.labelKey) })
        : t('aiKbAlAllDeselected', { group: t(g.labelKey) }),
    )
  } catch {
    store.toast(t('aiKbAlSaveFailed'))
  }
}

/** 蓝本 `:212-223` —— N53:`trim().toLowerCase()` + 不以 `.` 开头则补 `.`;空串直接 return。 */
async function addCustom(): Promise<void> {
  const ext = customExt.value.trim().toLowerCase()
  if (!ext) return
  const normalized = ext.startsWith('.') ? ext : '.' + ext
  try {
    await store.toggleExtension(normalized, true)
    store.toast(t('aiKbAlAddedExt', { ext: normalized }))
    customExt.value = ''
  } catch {
    store.toast(t('aiKbAlAddFailed'))
  }
}

/** 蓝本 `:224-238` —— 成功后关弹窗 + toast + **把表单重置回初值**(`:234` 逐字同值)。 */
async function saveRule(): Promise<void> {
  try {
    await store.addFolderRule({
      root_id: form.value.root_id || 'any',
      path_glob: form.value.path_glob.trim(),
      action: form.value.action,
    })
    adding.value = false
    store.toast(t('aiKbAlSavedCleaning'))
    // reset for next add(蓝本 `:233` 的注释原文)
    form.value = { root_id: 'any', path_glob: '/Downloads/*', action: 'deny' }
  } catch {
    store.toast(t('aiKbAlSaveFailed'))
  }
}

/** 蓝本 `:239-246`。 */
async function removeRule(id: string | number): Promise<void> {
  try {
    await store.deleteFolderRule(id)
    store.toast(t('aiKbAlDeletedCleaning'))
  } catch {
    store.toast(t('aiKbAlDeleteFailed'))
  }
}
</script>

<template>
  <div class="k-view">
    <div class="k-scroll">
      <div class="k-scroll-inner">
        <!-- Section A: file types(蓝本 :5-53)-->
        <div class="k-section">
          <div class="k-section-head">
            <div class="k-section-title">{{ t('aiKbAlFileTypes') }}</div>
            <div class="k-section-hint">{{ t('aiKbAlFileTypesHint') }}</div>
          </div>
          <div class="k-section-body">
            <div v-for="g in groups" :key="g.id" class="k-extgroup">
              <div class="k-extgroup-head">
                <div class="k-extgroup-icon" :style="{ background: g.bg }">
                  <KIcon :name="g.icon" :size="14" />
                </div>
                <div class="k-extgroup-title">{{ t(g.labelKey) }}</div>
                <div class="k-extgroup-meta">
                  {{ onCountFor(g) }}/{{ g.exts.length }} {{ t('aiKbAlEnabledSuffix') }}
                </div>
                <div class="k-extgroup-toggle">
                  <button @click="setAllInGroup(g, true)">{{ t('aiKbAlSelectAll') }}</button>
                  <button @click="setAllInGroup(g, false)">{{ t('aiKbAlSelectNone') }}</button>
                </div>
              </div>
              <div class="k-ext-chips">
                <button
                  v-for="e in g.exts"
                  :key="e.ext"
                  class="k-ext-chip"
                  :data-on="String(e.enabled)"
                  @click="toggle(e.ext, !e.enabled)"
                >
                  <span class="k-ext-chip-mark">
                    <!-- 蓝本 :30 那个具名色前景 → `var(--text-on-accent)`(附录 B §B.3-①)。
                         `.k-ext-chip-mark` 在 `[data-on="true"]` 下压在 `var(--accent)` 实底上,
                         语义就是「实底上的恒亮前景」。🔴 **不是 `--on-accent`** —— 那个 token 在
                         暗档是深色,压在实底上会变成「深前景压深底」(附录 B §B.3.1 整节的警告)。
                         ⚠️ 这里刻意**不复述蓝本那个具名色的字面拼写** —— §6 的色扫**不剥注释**,
                         写出来会被「模板内属性值位置零具名色」那条守卫真阳性打红(E-60 口径)。 -->
                    <KIcon v-if="e.enabled" name="check" :size="9" color="var(--text-on-accent)" />
                  </span>
                  {{ e.ext }}
                </button>
              </div>
            </div>

            <div style="padding: 0 16px 14px">
              <button
                class="k-adv-toggle"
                :data-open="String(customOpen)"
                @click="customOpen = !customOpen"
              >
                <span class="chev"><KIcon name="chev" :size="11" /></span>
                <KIcon name="settings" :size="12" />
                {{ t('aiKbAlAdvancedCustom') }}
              </button>
            </div>
            <div v-if="customOpen" class="k-custom-add">
              <input
                v-model="customExt"
                type="text"
                placeholder=".log, .ini, .conf …"
                @keydown.enter="addCustom"
              />
              <button class="k-btn primary" :disabled="!customExt.trim()" @click="addCustom">
                <KIcon name="plus" :size="12" /> {{ t('aiKbAdd') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Section B: folder rules(蓝本 :55-97)-->
        <div class="k-section">
          <div class="k-section-head">
            <div class="k-section-title">{{ t('aiKbAlFolderRules') }}</div>
            <div class="k-section-hint">{{ t('aiKbAlPriorityHint') }}</div>
            <button class="k-btn primary" style="margin-left: auto" @click="adding = true">
              <KIcon name="plus" :size="12" /> {{ t('aiKbAlAddRule') }}
            </button>
          </div>
          <div class="k-section-body">
            <div
              v-if="store.folderRules.length === 0"
              style="padding: 40px 20px; text-align: center; color: var(--text-tertiary); font-size: 13px"
            >
              {{ t('aiKbAlNoRules') }}
            </div>
            <template v-else>
              <div class="k-frow k-frow-head">
                <span>{{ t('aiKbAlLibrary') }}</span>
                <span>{{ t('aiKbColPath') }}</span>
                <span>{{ t('aiKbColAction') }}</span>
                <span />
              </div>
              <div v-for="r in store.folderRules" :key="r.id" class="k-frow">
                <span class="k-frow-root">
                  <span class="k-frow-root-icon"><KIcon name="drive" :size="11" /></span>
                  {{ r.root_id || 'any' }}
                </span>
                <span class="k-frow-path" :title="r.path_glob">{{ r.path_glob }}</span>
                <span class="k-frow-action" :data-act="r.action">
                  <KIcon :name="r.action === 'allow' ? 'check' : 'x'" :size="11" />
                  {{ r.action === 'allow' ? t('aiKbAlAllow') : t('aiKbAlDeny') }}
                </span>
                <span style="display: flex; justify-content: flex-end">
                  <button
                    class="k-row-action"
                    data-tone="danger"
                    :title="t('aiKbAlDeleteRule')"
                    @click="removeRule(r.id)"
                  >
                    <KIcon name="trash" :size="13" />
                  </button>
                </span>
              </div>
            </template>
            <div class="k-priority-hint">
              <KIcon name="info" :size="12" />
              {{ t('aiKbAlExampleHint') }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add rule modal(蓝本 :101-151)—— K57:reka Dialog 原语,portal 到知识库容器。
         蓝本的「点遮罩关闭 / 点弹窗内不关闭」由 DialogContent 的 pointerDownOutside 等价表达。 -->
    <DialogRoot :open="adding" @update:open="adding = $event">
      <DialogPortal to=".knowledge-app" defer>
        <DialogOverlay class="k-modal-bg">
          <DialogContent class="k-modal" :aria-describedby="undefined">
            <div class="k-modal-head">
              <!-- DialogTitle 套在蓝本自己的 .k-modal-title 上(as-child)—— 满足 reka 的 a11y
                   要求,又不多一个隐藏节点,DOM 与蓝本 :105 逐字一致。 -->
              <DialogTitle as-child>
                <div class="k-modal-title">{{ t('aiKbAlAddFolderRule') }}</div>
              </DialogTitle>
              <button class="k-modal-x" @click="adding = false">
                <KIcon name="x" :size="12" />
              </button>
            </div>
            <div class="k-modal-body">
              <div class="k-field">
                <label class="k-field-label">{{ t('aiKbAlLibrary') }}</label>
                <input v-model="form.root_id" type="text" placeholder="DATA / Backup / Media / any" />
                <div class="k-field-hint">{{ t('aiKbAlLibraryHint') }}</div>
              </div>
              <div class="k-field k-field-mono">
                <label class="k-field-label">{{ t('aiKbColPath') }}</label>
                <input v-model="form.path_glob" type="text" placeholder="/Downloads/*" />
                <div class="k-field-hint">{{ t('aiKbAlPathHint') }}</div>
              </div>
              <div class="k-field">
                <label class="k-field-label">{{ t('aiKbColAction') }}</label>
                <div class="k-radio-2">
                  <button
                    class="k-radio-card"
                    :data-on="String(form.action === 'allow')"
                    @click="form.action = 'allow'"
                  >
                    <span class="k-radio-card-icon" data-tone="allow"
                      ><KIcon name="check" :size="13"
                    /></span>
                    <div>
                      <div class="k-radio-card-text">{{ t('aiKbAlAllow') }}</div>
                      <div class="k-radio-card-desc">{{ t('aiKbAlAllowDesc') }}</div>
                    </div>
                  </button>
                  <button
                    class="k-radio-card"
                    :data-on="String(form.action === 'deny')"
                    @click="form.action = 'deny'"
                  >
                    <span class="k-radio-card-icon" data-tone="deny"
                      ><KIcon name="x" :size="13"
                    /></span>
                    <div>
                      <div class="k-radio-card-text">{{ t('aiKbAlDeny') }}</div>
                      <div class="k-radio-card-desc">{{ t('aiKbAlDenyDesc') }}</div>
                    </div>
                  </button>
                </div>
              </div>
              <div
                style="padding: 10px 12px; background: var(--bg-sunken); border-radius: var(--r-sm); font-size: 12px; color: var(--text-tertiary); line-height: 1.55"
              >
                <KIcon name="info" :size="11" /> {{ t('aiKbAlPriorityFull') }}
              </div>
            </div>
            <div class="k-modal-foot">
              <div class="right" style="margin-left: auto">
                <button class="k-btn ghost" @click="adding = false">{{ t('aiKbCancel') }}</button>
                <button
                  class="k-btn primary"
                  :disabled="!form.path_glob.trim()"
                  @click="saveRule"
                >
                  <KIcon name="check" :size="12" /> {{ t('aiKbAlSaveRule') }}
                </button>
              </div>
            </div>
          </DialogContent>
        </DialogOverlay>
      </DialogPortal>
    </DialogRoot>
  </div>
</template>
