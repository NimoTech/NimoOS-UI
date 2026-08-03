<!--
  SP8-P5c Task 6 —— 「Parser 详情」页(路由 `/ai/parser`),1:1 移植自 Vue2 蓝本
  `NimoOS-UI` (main@7a6ee6b7) `src/views/AI/Parser/ParserStatus.vue`(164 行,
  `git show main:` 读取 —— 治理 §1:那个仓的工作树是旧分支,不可信)。

  结构对照(蓝本行区间 → 本文件):
    :3-9     页头:标题 + 🧪 测试沙盒链接 + 刷新按钮(`:disabled` 吃 store.loading)
    :11-14   unreachable 警示卡(与下面整个 `<template v-else>` 二选一)
    :18-66   控制卡:暂停灯/按钮 · 并发档三选一 · 推理设备三选一 + 解析提示 · OCR 开关
    :69-76   队列卡:6 格 emoji + 数字
    :79-89   文件夹卡:标题带 {top}/{total} · 空态 · 列表 + 进度条
    :92-102  失败卡:折叠按钮(无条件渲染)+ 列表(N19:v-show + v-if 同挂)
    :119-125 deviceOptions computed
    :127-135 mounted/beforeDestroy —— 5 秒轮询 + document.hidden 守卫(N20)
    :136-157 五个转调 + 三个纯函数(formatCursor / barWidth / truncateErr)

  ─────────────────────────────────────────────────────────────────────────────
  【K31 —— 根元素必须两层】(协调者 2026-08-03 裁定,治理 §3 K31)
    `<div class="parser-app"><div class="parser-status-page">…</div></div>`
    ——**比蓝本多一层 DOM**。外层 `.parser-app` 只带 K22 那三行结构属性
    (`height:100vh; height:100dvh; overflow-y:auto`,见 `parser-styles.scss:68-72`),
    内层 `.parser-status-page` 是蓝本的 `padding:16px; max-width:900px; margin:0 auto`。
    🔴 为什么不能压成同一个元素:`src/styles/theme.css:318` 是 `body{overflow:hidden}`,
    `/ai/parser` 是**顶层路由**(不在 KnowledgeLayout 之下),不自建滚动容器内容永远看不到
    (K22);而滚动容器若同时是那条 900px 居中列,`overflow-y:auto` 的滚动条就落在
    **列的右缘(宽屏上约在屏幕中间)**,而 Vue2 是整页滚动、滚动条在**视口最右缘**
    —— 那是**用户可见的界面不 1:1**。多一层 DOM 用户不可见,取后者。
    先例本来就是两元素:`AreaShell.vue` 的 `.area-shell` + `.area-body`、
    `knowledge.scss` 的 `.knowledge-app` 外壳 + `.k-scroll` 内滚动器。
    ⚠️ 计划书 `p5c-plan.md:204` 仍写着 K31 之前的 `class="parser-app parser-status-page"`
    (单元素),**已被 K31 覆盖**;治理文件 + 附录 > brief > 计划书,以 K31 为准。

  【K24 —— 样式走 JS 侧 import,零 `<style>` 块】`import '../../styles/parser-styles.scss'`
    (T2b 建的独立文件)。蓝本 `:162-164` 是 `<style lang="scss" scoped>@import './parser-styles.scss'`;
    scoped 隔离在 New-UI 换成 K9 的「规则全嵌在页面作用域下」。先例:`KnowledgeLayout.vue:43`
    / `AgentPage.vue:72` / `SettingsPage.vue:70`。
    🔴 本文件是 `parser-styles.scss` 的**第一个也是唯一一个生产 import 方**(T7 之前),
    所以「`dist/assets/*.css` 里能搜到 `parser-status-page`」这条额外门归本刀。

  【K26 + K1 —— store 降层】蓝本是 `Vue.observable({state:{…}})`,`ParserStatus.vue` 里
    处处写 `store.state.xxx`;T5 落地的 `parserStore.ts` 是 Pinia setup store,
    **`state` 那一层整个消失** → 本文件一律 `store.xxx`。🔴 逐处降层,共 **20 处**
    (清单见 T6 报告 §K1);漏一处那一格就是 `undefined`。
    同理 `store.actions.loadAll()` → `store.loadAll()`(五个动作同)。

  【K27】REST 全部在 store 里走共享包,本文件零直调。

  【零 KIcon】(治理 §1.2 / E-2 / N16)两个 Parser 页蓝本一个 KIcon 都不用 ——
    用 emoji + 纯文字按钮。**不许"顺手换成 KIcon"**(界面不 1:1)。

  【N16 —— emoji / 符号位置逐字照抄,一个都不许挪进/挪出 `t()`】
    在 `t()` **外面**:`🧪`(:6)· `⏳`(:70)· `🔄`(:71)· `✅`(:72)· `❌`(:73)·
                      `📦`(:74)· `📍`(:75)· `▼`/`▶` 折叠箭头(:94)
    由 **script 拼接**:`'▶ ' + t('aiKbResume')` / `'⏸ ' + t('aiKbPause')`(:27)——
      i18n 键值是纯 `Resume` / `Pause`,符号不进语言包。
    在 `t()` **里面**:一个都没有(本页零此类)。
    `→` 在 `aiKbPrResolvedHint` 的**键值里**(`→ actual {device}` / `→ 实际 {device}`,:53)。
    `—` 是 `formatCursor` 的空值回退(:147,U+2014),`…` 是 `truncateErr` 的截断号(:156,U+2026)。

  【N17 —— 并发档用数组下标取 i18n,照抄这个写法】
    `[t('aiKbPrCcPowerSaving'), t('aiKbCcBalanced'), t('aiKbPrCcFullPower')][[1,2,4].indexOf(n)]`
    (蓝本 :38)。🔴 **不许改成 computed 映射表**(与需求无关的顺手改动)。
    ⚠️ 键的选法有讲究(N21 #3 / 附录 A):`Balanced` **复用** `aiKbCcBalanced`(en+zh 双双一致);
    `Power-saving` / `Full power` **必须新建** `aiKbPrCcPowerSaving` / `aiKbPrCcFullPower`,
    **不能**复用 `aiKbCcPowerSaver` / `aiKbCcFullSpeed` —— 后两者 zh 虽同(省电 / 全力),
    en 是 `Power saver` / `Full speed`,复用会让英文档渲染得与 Vue2 不同。

  【N19 —— 失败列表 `v-show` + `v-if` 同挂一个 `<ul>`,两个指令都照抄】(蓝本 :96)
    Vue 里 `v-if` 优先级高于 `v-show` → `failedJobs` 为空时整个 `<ul>` **不渲染**、
    `v-show` 是死的。🔴 合并成单一指令 = 改 DOM 结构 = 回归。
    ⚠️ 本机 `jobs?status=failed&limit=5` 实测 `{"jobs":[]}`(治理 §4.3)→ 折叠按钮
    **能点**(它无条件渲染,文案「最近失败(0)」),但点开后列表整个不渲染 ——
    **这是正确行为**,不是缺陷(治理 §13 已点名)。

  【N20 —— 5 秒轮询 + `document.hidden` 守卫 + 卸载清理】(蓝本 :127-135)
    频率 `5000`、守卫、清理时机全照抄;`beforeDestroy` → Vue3 的 `onBeforeUnmount`。
    定时器句柄是**组件本地** `let`(蓝本是 `this._timer`)—— 🔴 **不进 store**:
    `parserStore.ts` 里零定时器,那是对的(治理 §3.5 N20 / `parserStore.ts` 头注释)。

  【纯函数三条照抄】(蓝本 :146-157)
    `formatCursor(ms)`:`if (!ms) return '—'`(0 / NaN / undefined 都走这条)
    `barWidth(count)`:`reduce` 求 max + **`|| 1` 兜底**(max=0 时防除零 → 0/1*100 = 0)
    `truncateErr(s)`:`> 120` 才截,`slice(0,120) + '…'`;`!s` → `''`
    🔴 三条都不许"改进"(不加 `Intl` 格式化、不改截断长度、不删 `|| 1`)。

  【硬编码不进 i18n】`'GPU (CUDA)'` / `'CPU'`(蓝本 :123-124)—— 技术标识符,
    蓝本刻意没进 i18n(N22 同族口径)。**不许顺手补键**(会多出 Vue2 没有的键,
    且 en/zh 两档一填英文 = 纯噪音)。只有 `Auto` 进 i18n → `aiKbDeviceAuto`
    (🔴 裁定 A-1:**新建**,**不复用** `aiKbOriginAuto` —— 后者语义是「沉淀任务来源」)。

  【K5/K30 不适用于此处】`:13` 的 `<small>{{ store.error }}</small>` 回显的是
    `e.message || String(e)`(网络层错误信息,`parserStore.ts:184`),**蓝本行为,照抄**。
    K5/K30 管的是「不把后端响应 body 的 `detail` 拼进 toast」,不是同一件事
    (brief §3.6 已就此显式裁定)。

  【偏离,类型安全机械改写】`@change="setOcr($event.target.checked)"`(蓝本 :61)在 TS 下
    需要 `($event.target as HTMLInputElement).checked` —— `EventTarget` 上没有 `checked`。
    先例 `src/ai/components/settings/sections/ChannelsSection.vue:354` 同款写法。
    渲染与行为零变化,只是类型标注。
-->
<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useParserStore } from '../stores/parserStore'
import '../../styles/parser-styles.scss'

const { t } = useI18n()
const store = useParserStore()

/** 蓝本 data() :112-117 —— `store` 那一项在 Vue3 里是上面的 `useParserStore()`,
 *  只剩 `failedOpen` 是页面级瞬态(治理 §5.1:不塞 store)。 */
const failedOpen = ref(false)

/** 蓝本 `this._timer`(:129)—— 组件本地句柄,不进 store(N20)。 */
let timer: ReturnType<typeof setInterval> | null = null

/** 蓝本 computed deviceOptions(:119-125)—— 只有 `Auto` 走 i18n,
 *  `GPU (CUDA)` / `CPU` 是硬编码技术标识符。 */
const deviceOptions = computed<{ value: string; label: string }[]>(() => [
  { value: 'auto', label: t('aiKbDeviceAuto') },
  { value: 'cuda', label: 'GPU (CUDA)' },
  { value: 'cpu', label: 'CPU' },
])

/** 蓝本 mounted()(:127-132)—— 先立即拉一次,再起 5 秒轮询;
 *  `document.hidden` 时**跳过这一拍**(不是停表:定时器继续走,只是不发请求)。 */
onMounted(() => {
  store.loadAll()
  timer = setInterval(() => {
    if (!document.hidden) store.loadAll()
  }, 5000)
})

/** 蓝本 beforeDestroy()(:133-135)—— Vue3 对应 `onBeforeUnmount`。 */
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

/** 蓝本 reload()(:137)。 */
function reload(): void {
  store.loadAll()
}

/**
 * 蓝本 togglePause()(:138-142)—— **三元表达式语句**分派,逐字照抄
 * (不改写成 `if/else`:等价但不是蓝本写的形状,属无关重构)。
 * 两支都返回 Promise 且蓝本都不 await —— 照抄这一点:点完按钮立刻交给
 * `resume()`/`pause()` 内部的 `await loadAll()` 去刷新,期间 `loading` 已置真、
 * 按钮由 `:disabled` 挡住重复点击。
 */
function togglePause(): void {
  store.controlState.paused ? store.resume() : store.pause()
}

/** 蓝本 :143-145 —— 三个纯转调。 */
function setConcurrency(n: number): void {
  store.setConcurrency(n)
}
function setDevice(device: string): void {
  store.setDevice(device)
}
function setOcr(enabled: boolean): void {
  store.setOcr(enabled)
}

/** 蓝本 formatCursor(ms)(:146-149)—— `!ms` 覆盖 0 / NaN / undefined,回退 U+2014。 */
function formatCursor(ms: number): string {
  if (!ms) return '—'
  return new Date(ms).toLocaleString()
}

/**
 * 蓝本 barWidth(count)(:150-153)—— 拿当前列表里的最大 count 当 100%。
 * 🔴 `|| 1` 兜底不许删:列表为空或所有 count 都是 0 时 `reduce` 得 0,除零会得
 * `NaN`/`Infinity` 并写进 `style="width: NaN%"`。
 */
function barWidth(count: number): number {
  const max = store.folders.folders.reduce((m, f) => Math.max(m, f.count), 0) || 1
  return Math.round((count / max) * 100)
}

/** 蓝本 truncateErr(s)(:154-157)—— 严格 `> 120` 才截(=120 原样返回),截断号 U+2026。 */
function truncateErr(s?: string | null): string {
  if (!s) return ''
  return s.length > 120 ? s.slice(0, 120) + '…' : s
}
</script>

<template>
  <div class="parser-app">
    <!-- K31:外层 `.parser-app` = K22 滚动容器(height:100dvh + overflow-y:auto),
         内层 `.parser-status-page` = 蓝本的 900px 居中列。理由见文件头注释。
         ⚠️ 这条注释必须写在外层 div **内部**:写在 `<template>` 的第一个位置会让组件
         多一个注释根节点,VTU 的 `wrapper.element` 就不再是那个 div 了。 -->
    <div class="parser-status-page">
      <!-- 页头(蓝本 :3-9) -->
      <header class="page-header">
        <h2>{{ t('aiKbPrDetailsTitle') }}</h2>
        <div class="header-actions">
          <!-- N16:🧪 在 t() 外面 -->
          <router-link to="/ai/parser/test" class="test-link">🧪 {{ t('aiKbPrTestLink') }}</router-link>
          <button class="refresh-btn" @click="reload" :disabled="store.loading">{{ t('aiKbRefresh') }}</button>
        </div>
      </header>

      <!-- unreachable 警示卡(蓝本 :11-14)—— `<small>` 回显 store.error 是蓝本行为,见文件头 K5/K30 说明 -->
      <div v-if="store.unreachable" class="card unreachable">
        {{ t('aiKbPrUnreachable') }}<br />
        <small>{{ store.error }}</small>
      </div>

      <template v-else>
        <!-- 控制卡(蓝本 :17-66) -->
        <div class="card control-card">
          <div class="row">
            <span class="status-text">
              <span class="dot" :class="{ paused: store.controlState.paused }" />
              {{ store.controlState.paused ? t('aiKbPaused') : t('aiKbRunning') }}
            </span>
            <!-- N16:`▶ ` / `⏸ ` 由 script 侧字符串拼接产生,不进 i18n 键值(蓝本 :27) -->
            <button class="pause-btn"
                    @click="togglePause"
                    :disabled="store.loading">
              {{ store.controlState.paused ? ('▶ ' + t('aiKbResume')) : ('⏸ ' + t('aiKbPause')) }}
            </button>
          </div>
          <div class="row concurrency-row">
            <label>{{ t('aiKbConcurrencyLevel') }}:</label>
            <label v-for="n in [1, 2, 4]" :key="n" class="radio">
              <input type="radio"
                     :value="n"
                     :checked="store.controlState.concurrency === n"
                     :disabled="store.loading"
                     @change="setConcurrency(n)" />
              <!-- N17:数组下标取 i18n,照抄蓝本 :38 这个写法,不许改成 computed 映射表 -->
              {{ [t('aiKbPrCcPowerSaving'), t('aiKbCcBalanced'), t('aiKbPrCcFullPower')][[1,2,4].indexOf(n)] }} ({{ n }})
            </label>
          </div>
          <div class="row device-row">
            <label>{{ t('aiKbInferenceDevice') }}:</label>
            <label v-for="opt in deviceOptions" :key="opt.value" class="radio">
              <input type="radio"
                     :value="opt.value"
                     :checked="store.controlState.device === opt.value"
                     :disabled="store.loading"
                     @change="setDevice(opt.value)" />
              {{ opt.label }}
            </label>
            <span v-if="store.controlState.device === 'auto' && store.controlState.resolved_device"
                  class="resolved-hint">
              {{ t('aiKbPrResolvedHint', { device: store.controlState.resolved_device.toUpperCase() }) }}
            </span>
          </div>
          <div class="row">
            <label class="checkbox">
              <input type="checkbox"
                     :checked="store.controlState.ocr_enabled"
                     :disabled="store.loading"
                     @change="setOcr(($event.target as HTMLInputElement).checked)" />
              {{ t('aiKbPrOcrLabel') }}
            </label>
            <span class="resolved-hint">{{ t('aiKbPrOcrHint') }}</span>
          </div>
        </div>

        <!-- 队列卡(蓝本 :68-76)—— N16:六个 emoji 全在 t() 外面 -->
        <div class="card queue-card">
          <div class="kv">⏳ {{ t('aiKbPending') }} <b>{{ store.stats.queue_depth.pending }}</b></div>
          <div class="kv">🔄 {{ t('aiKbPrQueueRunning') }} <b>{{ store.stats.queue_depth.running }}</b></div>
          <div class="kv">✅ {{ t('aiKbPrQueueDone') }} <b>{{ store.stats.queue_depth.done }}</b></div>
          <div class="kv">❌ {{ t('aiKbFailed') }} <b>{{ store.stats.queue_depth.failed }}</b></div>
          <div class="kv">📦 {{ t('aiKbPrIndexedVectors') }} <b>{{ store.stats.total_vectors_text }}</b></div>
          <div class="kv">📍 {{ t('aiKbLastSynced') }} <b>{{ formatCursor(store.stats.last_cursor_ms) }}</b></div>
        </div>

        <!-- 文件夹卡(蓝本 :78-89)—— {top} 是本页列表长度、{total} 是后端总组数,两个数字各有来源 -->
        <div class="card folders-card">
          <h3>{{ t('aiKbPrFoldersTitle', { top: store.folders.folders.length, total: store.folders.total_groups }) }}</h3>
          <div v-if="!store.folders.folders.length" class="empty">{{ t('aiKbPrNoPending') }}</div>
          <ul v-else class="folder-list">
            <li v-for="(f, i) in store.folders.folders" :key="i" class="folder-row">
              <span class="folder-path">{{ f.folder }}</span>
              <span class="folder-count">{{ f.count }}</span>
              <span class="folder-bar" :style="{ width: barWidth(f.count) + '%' }" />
            </li>
          </ul>
        </div>

        <!-- 失败卡(蓝本 :91-102) -->
        <div class="card failures-card">
          <button class="toggle" @click="failedOpen = !failedOpen">
            {{ failedOpen ? '▼' : '▶' }} {{ t('aiKbPrRecentFailures', { n: store.failedJobs.length }) }}
          </button>
          <!-- 🔴 N19:两个指令都照抄。v-if 优先级更高 → failedJobs 为空时整个 <ul> 不渲染 -->
          <ul v-show="failedOpen" v-if="store.failedJobs.length" class="failure-list">
            <li v-for="j in store.failedJobs" :key="j.id">
              <div class="path">{{ j.path }}</div>
              <div class="error">{{ truncateErr(j.last_error) }}</div>
            </li>
          </ul>
        </div>
      </template>
    </div>
  </div>
</template>
