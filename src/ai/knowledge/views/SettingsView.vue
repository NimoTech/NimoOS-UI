<!--
  SP8-P5c Task 8 —— 「系统设置」页(rail 第 9 项,路由 `/ai/knowledge/settings`),
  1:1 移植自 Vue2 蓝本 `NimoOS-UI` (main@7a6ee6b7)
  `src/views/AI/Knowledge/SettingsView.vue`(322 行,`git show main:` 读取 ——
  治理 §1:那个仓的工作树是旧分支,不可信)。

  🔴 **本刀只做蓝本的上半**;下半(笔记根目录折叠区 + 迁移确认弹窗 + 自动捕获开关 +
  `notesSettings` / `rootPicker` / `dirProbe` / `browserRoots` 那一整套 script)归 **T9**,
  按计划书要求**不留占位符、不留注释桩**,T9 直接把 DOM 插在「运行档卡」与「沙盒入口」之间。

  结构对照(蓝本行区间 → 本文件,New-UI 行号由脚本重算,见 T8 报告 §2):
    :2-4     `.k-view` → `.k-scroll` → `.k-scroll-inner` 三层壳(逐层照抄)
    :7-19    服务卡:状态灯 `[data-state]` + 两行文案 + 恢复/暂停按钮
    :22-34   运行档卡 · 并发行:三个按钮,文字**就是数字**(无档位名)
    :36-49   运行档卡 · 设备行:auto / cuda|gpu / cpu 三档 + `deviceLabel`
    :51-60   运行档卡 · OCR 行:`.k-sw` 开关 + `.warn` 警示句
    :159-166 沙盒入口 `.k-sandbox-link`
    :169-186 危险区 `.k-section` + 硬编码 `disabled` 的重建按钮
    :215-223 computed `controlState` / `deviceLabel`
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
    (挂载即拉 + 10 秒轮询)填充,本页**自己不发只读请求**(蓝本 `created()` 里那一发
    是 `notesApi.getSettings()`,归 T9)。
-->
<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import KIcon from '../components/KIcon.vue'
import { useKnowledgeStore } from '../stores/knowledgeStore'

const { t } = useI18n()
const router = useRouter()
const store = useKnowledgeStore()

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
