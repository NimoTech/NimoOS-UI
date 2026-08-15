<!--
  SP8-P4 Task 6 —— 1:1 移植自 Vue2 `NimoOS-UI/src/views/AI/MCP/McpServerDetail.vue`
  (174 行)的 `:1-157`。Task 7(测试连接)补全了 T6 留白的三段:
    - `:50-53` 「测试连接」按钮
    - `:87-100` 测试提示 `.mcp-test-hint` / 结果面板 `.mcp-test-result`
    - `:158-171` `runTest()` 方法与 `testing`/`testResult`(本仓 `testView`)状态,
      外加 `watch(() => props.server?.id)` 里对应的重置
  T7 的两条偏离(**D8** 错误呈现本地化 + 可折叠技术详情、**D11** 在途请求竞态守卫)
  见 `<script>` 里 `runTest`/`reqSeq` 头注释与模板 `mcp-test-result` 分支内的注释。

  【偏离 D3,公共约束 §3 第 3 条】`SkillIcon.vue` 不移植,统一用
  `../../icons/AgentIcon.vue`(承 P3a/T5 先例)。
  Vue2 `:121` 给删除按钮的 `SkillIcon` 传了一个具名色字面量——本仓不传。
  已 grep 确认 `.sk-btn.danger`(sk-shared.scss:50-54)自带前景色声明:背景取
  危险语义色 `--danger`、图标/文字继承该规则块里固定写死的前景色(修复轮 M7:
  原文逐字引用了那行 CSS 源码里的颜色字面量,按公共约束 §6「注释里也不许出现
  颜色字面量」的纪律改写成本段描述,不再照抄源码)。
  `AgentIcon` 的 `color` prop 默认值本就是 `currentColor`(AgentIcon.vue:79),
  SVG `stroke` 走 `currentColor`(AgentIcon.vue:88)会继承按钮的前景色声明,
  不需要在本组件重复书写颜色——与 `SkillDetail.vue:507-510` 删除按钮的既有写法
  (同样不传 color)完全一致,不是新模式。

  【偏离 D9,公共约束 §3 第 9 条】Vue2 `:36-37` 的状态圆点用内联 `:style` 现场拼
  `background` 与 `boxShadow`(两个色字面量,按配色约定不许出现在本文件里,已改写
  成中文描述:「启用」态取语义色 `--success` 的实心点 + 同色半透明发光圈,「停用」态
  取语义色 `--text-quaternary` 的实心点 + 同色半透明发光圈)。本仓整段内联 style 删掉,
  只保留 `.val` 上的 `:data-disabled`,颜色改由 `skills-styles.scss` 已有的两条静态
  规则供:`.sk-meta-cell .val .dot`(基础态,:351-369)与
  `.val[data-disabled="true"] .dot`(停用态覆写,:370-376)。DOM 结构逐字相同——
  `<div class="val" :data-disabled="...">` 包一个零属性的 `<span class="dot" />`,
  两条选择器天然按 CSS 级联命中,零新 token。

  【偏离 D6,公共约束 §3 第 6 条】移除确认弹窗不套 `SkModal`,直接用 reka Dialog
  原语(`DialogRoot`/`DialogPortal`/`DialogOverlay`/`DialogContent`/`DialogTitle`)
  手拼,写法照抄 `../skills/SkillDetail.vue:486-517`。同一分区两种弹窗外壳并存的
  理由(与该文件头注释「偏离申报 2」同构):Vue2 的确认弹窗(`:112-125`)没有标题栏
  (标题就是 `.sk-confirm-body` 里的 `<h3>`),`SkModal` 强制渲染标题栏 + 关闭按钮、
  默认插槽套 `.sk-modal-body` 会与 `.sk-confirm-body` 自带的 padding 叠加、
  `.sk-modal` 类也写死加不上 `.sk-confirm`——三条都套不上 `SkModal` 的形状,必须
  手拼才能逐像素还原 Vue2。`DialogPortal to=".set-app"` 不可省——AI 区 token 定义在
  `.agent-app`/`.set-app` 作用域(tokens.scss:31),portal 到 body 会让 `var(--…)`
  全部解析失败,弹窗变透明底(这条已在本期文档里记录爆过三次)。无障碍标题用
  `<VisuallyHidden as-child><DialogTitle>`,与 `SkillDetail.vue:492` 同款先例。

  【外部点击关菜单,协调者裁定 5】Vue2 `:143-153` 是 `watch(menuOpen)` 里条件式
  加/删 `document` 的 `mousedown` 监听 + `beforeDestroy` 兜底移除。本文件按裁定
  用 `watch` + `onBeforeUnmount` 逐字等价实现(不用 `useClickOutside` composable
  ——那是 P3b `SkillDetail.vue` 的实现选择,本任务书明确要求这里手写以对齐 Vue2
  的条件式挂载时序)。只监听 `mousedown`,不额外监听 `click`,也不加 Esc——那些是
  未申报的偏离。

  【偏离 D4,公共约束 §3 第 4 条】不写 `console.error`(本文件里也没有会产生错误
  需要打日志的路径,纯展示 + 转发 emit)。

  【实现选择,非行为偏离】Vue2 data 字段名是 `confirm`(布尔),本仓改名
  `confirmOpen`——原因与 `SkillDetail.vue:156-158` 完全相同:避免与 JS 全局
  `window.confirm` 同名产生阅读歧义,纯标识符改名,DOM/行为不变。
  Vue2 `color()`/`label2()` 两个 computed/方法只是对 `serverColor`/`transportLabel`
  的直接转发,本仓比照 `McpServerGroup.vue`(T5)的先例直接在模板里调用工具函数,
  不新增等价的包装 computed。
  Vue2 `:119` 的 `<div class="right" style="margin-left: auto">` 与
  `sk-shared.scss:149` 已有的 `.sk-modal-foot .right { margin-left: auto; ... }`
  规则重复(同 `SkillDetail.vue:505` 的既有写法),故不重复书写这条内联样式——
  视觉结果不变,不是遗漏。

  零 `<style>` 块:用到的每个类均已存在于 `skills-styles.scss`
  (`sk-detail*`/`sk-name`/`sk-meta-*`/`sk-section*`/`sk-menu`/`sk-pill-more`/
  `sk-confirm*`)、`sk-shared.scss`(`sw`/`sk-modal*`/`sk-btn`)或 T1 的
  `mcp-styles.scss`(`mcp-config*`/`mcp-code`)。
-->
<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import {
  DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle, VisuallyHidden,
} from 'reka-ui'
import type { McpServer, McpTestView } from '../../../types/mcpServer'
import type { McpToolRow } from '@nimotech/nimoos-service'
import { toTestView, toTestViewFromError } from '../../../util/mcpErrorKey'
import { protocolLine } from '../../../util/mcpProtocol'
import { serverColor, transportLabel, SERVER_GLYPH } from '../../../util/mcpServerVisual'
import AgentIcon from '../../icons/AgentIcon.vue'
import SkillTile from '../skills/SkillTile.vue'
import McpToolList from '../sections/McpToolList.vue'

// 对齐 Vue2 `props: { server: { type: Object, default: null } }`(:139)。
const props = defineProps<{ server: McpServer | null }>()

// 对齐 Vue2 `$emit('toggle', …)`(:18)/`$emit('edit', …)`(:22)/`$emit('delete', …)`(:157)。
const emit = defineEmits<{
  (e: 'toggle', id: number, enabled: boolean): void
  (e: 'edit', server: McpServer): void
  (e: 'delete', id: number): void
}>()

const { t } = useI18n()

// 后端没有图标字段,全部 MCP 服务统一用这个字形(Vue2 `data(){ glyph: SERVER_GLYPH }`,:140)。
const glyph = SERVER_GLYPH

// 更多菜单开合,对齐 Vue2 `data(){ menuOpen: false }`(:140)。
const menuOpen = ref(false)
// 删除确认弹窗,对齐 Vue2 `data(){ confirm: false }`(:140)——改名 confirmOpen,
// 见文件头注释「实现选择,非行为偏离」。
const confirmOpen = ref(false)
// `.sk-pill-more` 按钮 + `.sk-menu` 下拉的包裹元素,对齐 Vue2 `ref="menuWrap"`(:19)。
const menuWrap = ref<HTMLElement | null>(null)

// 测试连接,对齐 Vue2 `data(){ testing: false, testResult: null }`(:140)——本仓
// `testResult` 改名 `testView`,因为存的是 T3 `toTestView`/`toTestViewFromError`
// 映射后的 `McpTestView`(i18n 键 + detail),不是后端裸响应,改名避免与
// `McpTestResult`(后端原始形状,types/mcpServer.ts)混淆。
const testing = ref(false)
const testView = ref<McpTestView | null>(null)
// 【偏离 D11,公共约束 §3 第 11 条】Vue2 `runTest`(`:158-171`)没有请求令牌:
// stdio 探测最长 100 秒(`NimoOS-AI/route/v2/mcp.go:346`),这期间用户切到别的
// 服务器时,上面的 `watch(() => props.server?.id)` 已经把 `testView` 清空,
// 但在途 promise 落地后仍会执行 `testView.value = ...`,把**旧服务器的结果**
// 写进**新服务器的面板**——可复现的错配,不是无害的时序巧合。这里用单调递增的
// `reqSeq` 守卫:进入时取号,`watch` 里切换服务器会让号作废,成功/失败/finally
// 三处落地前都比对号是否还是自己发出时的那个,不是就整体丢弃(包括不复位
// `testing`,因为那已经是新一轮的状态,由新一轮自己的 finally 负责)。
const reqSeq = ref(0)

// #141: the protocol-version line shown under the success panel, derived from
// the current testView via the T8 pure function (see mcpProtocol.ts).
const protoLine = computed(() => (testView.value ? protocolLine(testView.value) : null))

// 对齐 Vue2 `runTest()`(:158-171)。
async function runTest() {
  if (!props.server || testing.value) return // Vue2 :159 逐字对应
  const seq = ++reqSeq.value
  const id = props.server.id
  testing.value = true
  testView.value = null
  try {
    // 【偏离 D1,公共约束 §3 第 1 条】单层取数:共享包 `service.ai.testMCPServer`
    // 已 `return res.data`(`NimoOS-Service/src/ai.ts:388-391`),后端
    // `mcp.go:355` 是 `c.JSONBlob` 裸对象。Vue2 `:164` 的 `resp.data` 在本仓
    // 恒为 `undefined`,会让「测试连接」**永远显示连接失败**,哪怕后端返回
    // `ok:true`——照抄即缺陷,这里直接用 `body` 本身。
    const body = await service.ai.testMCPServer(id)
    if (seq !== reqSeq.value) return
    testView.value = toTestView(body)
  } catch (e) {
    if (seq !== reqSeq.value) return
    testView.value = toTestViewFromError(e)
  } finally {
    if (seq === reqSeq.value) testing.value = false
  }
}

// 外部点击关闭菜单,逐字等价 Vue2 `watch: { menuOpen(v) {...} }`(:143-150)+
// `beforeDestroy`(:153)。见文件头注释「外部点击关菜单」。
let docListener: ((e: MouseEvent) => void) | null = null
watch(menuOpen, (v) => {
  if (v) {
    docListener = (e: MouseEvent) => {
      const w = menuWrap.value
      if (w && !w.contains(e.target as Node)) menuOpen.value = false
    }
    document.addEventListener('mousedown', docListener)
  } else if (docListener) {
    document.removeEventListener('mousedown', docListener)
    docListener = null
  }
})
onBeforeUnmount(() => {
  if (docListener) document.removeEventListener('mousedown', docListener)
})

// 对齐 Vue2 `watch: { 'server.id'() {...} }`(:151),同一行还清了
// `this.testing = false; this.testResult = null`。本仓额外 `reqSeq.value++`
// ——【偏离 D11】见下方 `runTest` 头注释:让切走时仍在途的旧请求失效,落地时
// 序号比对不通过就整体丢弃,不会把旧服务器的测试结果写进新服务器的面板。
watch(() => props.server?.id, () => {
  menuOpen.value = false
  confirmOpen.value = false
  reqSeq.value += 1
  testing.value = false
  testView.value = null
})

// Task 20 (mcp-progressive-disclosure plan) -- the persisted tool list +
// approval state, read via `listMCPTools` and handed to `McpToolList.vue`.
// Zero-network on the server side (see that component's file header), so
// this loads instantly even for a server that is currently unreachable --
// unlike `runTest()` above, which actually dials the server.
const toolRows = ref<McpToolRow[]>([])
const toolsLoading = ref(false)
// Same race the `reqSeq` guard above protects `runTest()` against, applied
// to this independent request: switching servers while a `listMCPTools` call
// is in flight must not let the old server's tools land in the new server's
// panel. Kept as its own counter rather than reusing `reqSeq` -- the two
// requests are unrelated and run concurrently, sharing one counter would let
// finishing one wrongly invalidate the other.
let toolsSeq = 0

async function loadTools(id: number) {
  const seq = ++toolsSeq
  toolsLoading.value = true
  try {
    const res = await service.ai.listMCPTools(id)
    if (seq !== toolsSeq) return
    toolRows.value = Array.isArray(res?.tools) ? res.tools : []
  } catch {
    if (seq !== toolsSeq) return
    toolRows.value = []
  } finally {
    if (seq === toolsSeq) toolsLoading.value = false
  }
}

watch(() => props.server?.id, (id) => {
  toolsSeq += 1 // invalidate any in-flight load from the previous server
  toolRows.value = []
  toolsLoading.value = false
  if (id !== undefined) loadTools(id)
}, { immediate: true })

// 对齐 Vue2 `closeAnd(fn)`(:155)。
function closeAnd(fn?: () => void) {
  menuOpen.value = false
  fn?.()
}

// 对齐 Vue2 菜单第一项内联箭头 `() => $emit('edit', server)`(:22)。拆成具名函数
// (而不是模板内联箭头函数体)是因为 vue-tsc 对 v-else 分支里 `server` 的非空窄化
// 不会穿透进模板内联箭头函数体(TS18047),具名函数在 <script> 里用 `props.server`
// 重新判空即可规避——与 `SkillDetail.vue` `toggleFromMenu` 头注释同款说明,行为与
// 内联写法完全等价。
function emitEdit() {
  const s = props.server
  if (!s) return
  emit('edit', s)
}

// 对齐 Vue2 菜单第二项内联箭头 `() => confirm = true`(:24),理由同上。
function openConfirmDialog() {
  confirmOpen.value = true
}

// 对齐 Vue2 `doDelete()`(:157)。
function doDelete() {
  const s = props.server
  if (!s) return
  confirmOpen.value = false
  emit('delete', s.id)
}
</script>

<template>
  <div class="sk-detail">
    <template v-if="!server">
      <div class="sk-detail-empty">
        <div class="sk-detail-empty-inner">
          <div class="orb" />
          <div class="empty-title">{{ t('aiMcpSrvPickHint') }}</div>
          <div class="empty-sub">{{ t('aiMcpSrvPickSub') }}</div>
        </div>
      </div>
    </template>
    <template v-else>
      <div class="sk-detail-bar">
        <SkillTile :color="serverColor(server.name)" :icon="glyph" :size="28" :radius="8" />
        <div class="sk-name"><span>{{ server.name }}</span><code>{{ transportLabel(server.transport) }}</code></div>
        <div
          class="sw"
          :data-on="server.enabled ? 'true' : 'false'"
          role="switch"
          :aria-checked="server.enabled ? 'true' : 'false'"
          @click="emit('toggle', server.id, !server.enabled)"
        />
        <div ref="menuWrap" style="position: relative">
          <button class="sk-pill-more" @click="menuOpen = !menuOpen">
            <AgentIcon name="settings" :size="16" />
          </button>
          <div v-if="menuOpen" class="sk-menu">
            <button @click="closeAnd(emitEdit)">
              <AgentIcon name="edit" :size="13" /> {{ t('aiMcpSrvEditConfig') }}
            </button>
            <hr>
            <button data-danger="true" @click="closeAnd(openConfirmDialog)">
              <AgentIcon name="trash" :size="13" /> {{ t('aiMcpSrvRemove') }}
            </button>
          </div>
        </div>
      </div>

      <div class="sk-detail-body">
        <div class="sk-detail-inner">
          <div class="sk-meta-grid">
            <div class="sk-meta-cell">
              <div class="lbl">{{ t('aiMcpSrvStatus') }}</div>
              <div class="val" :data-disabled="!server.enabled ? 'true' : 'false'">
                <span class="dot" />
                {{ server.enabled ? t('aiCfgEnabled') : t('aiMcpSrvDisabled') }}
              </div>
            </div>
            <div class="sk-meta-cell">
              <div class="lbl">{{ t('aiMcpSrvTransport') }}</div>
              <div class="val">{{ transportLabel(server.transport) }}</div>
            </div>
            <div v-if="server.transport !== 'stdio'" class="sk-meta-cell">
              <div class="lbl">{{ t('aiMcpSrvHeaders') }}</div>
              <div class="val">{{ server.has_headers ? t('aiMcpSrvConfigured') : t('aiMcpSrvNone') }}</div>
            </div>
            <div class="sk-meta-cell">
              <div class="lbl">{{ t('aiMcpSrvEnv') }}</div>
              <div class="val">{{ server.has_env ? t('aiMcpSrvConfigured') : t('aiMcpSrvNone') }}</div>
            </div>
          </div>

          <div class="sk-section">
            <div class="sk-section-head">
              <div class="sk-section-title">{{ t('aiMcpSrvConfiguration') }}</div>
              <div class="sk-section-hint">{{ t('aiMcpSrvConfigHint') }}</div>
              <!-- 对齐 Vue2 :50-53。 -->
              <button class="sk-btn ghost mcp-test-btn" :disabled="testing" @click="runTest">
                <span v-if="testing" class="sk-spinner" />
                {{ testing ? t('aiMcpSrvTesting') : t('aiMcpSrvTest') }}
              </button>
            </div>
            <div class="sk-section-body">
              <div class="mcp-config">
                <template v-if="server.transport === 'stdio'">
                  <div class="mcp-config-row">
                    <div class="lbl">{{ t('aiMcpSrvCommand') }}</div>
                    <div class="val"><code class="mcp-code">{{ server.command }}</code></div>
                  </div>
                  <div class="mcp-config-row">
                    <div class="lbl">{{ t('aiMcpSrvArgs') }}</div>
                    <div class="val"><code class="mcp-code">{{ (server.args || []).join(' ') || t('aiMcpSrvNone') }}</code></div>
                  </div>
                  <div class="mcp-config-row">
                    <div class="lbl">{{ t('aiMcpSrvEnvVars') }}</div>
                    <div class="val">{{ server.has_env ? t('aiMcpSrvConfiguredHidden') : t('aiMcpSrvNone') }}</div>
                  </div>
                </template>
                <template v-else>
                  <div class="mcp-config-row">
                    <div class="lbl">{{ t('aiMcpSrvUrl') }}</div>
                    <div class="val"><code class="mcp-code">{{ server.url }}</code></div>
                  </div>
                  <div class="mcp-config-row">
                    <div class="lbl">{{ t('aiMcpSrvReqHeaders') }}</div>
                    <div class="val">{{ server.has_headers ? t('aiMcpSrvConfiguredHidden') : t('aiMcpSrvNone') }}</div>
                  </div>
                  <div class="mcp-config-row">
                    <div class="lbl">{{ t('aiMcpSrvEnvVars') }}</div>
                    <div class="val">{{ server.has_env ? t('aiMcpSrvConfiguredHidden') : t('aiMcpSrvNone') }}</div>
                  </div>
                </template>
              </div>

              <!-- Aligns with Vue2 :87-100. The wording dropped its hard-coded
                   duration (was "~90s") — that number was copied across a repo
                   boundary and drifted twice in one change set; a number-free
                   phrasing cannot go stale. -->
              <div v-if="testing && server.transport === 'stdio'" class="mcp-test-hint">
                {{ t('aiMcpSrvTestStdioHint') }}
              </div>
              <div v-if="testView" class="mcp-test-result" :data-ok="testView.ok ? 'true' : 'false'">
                <template v-if="testView.ok">
                  <div class="mcp-test-line">✓ {{ t('aiMcpSrvTestOk', { n: testView.toolCount }) }}</div>
                  <div class="mcp-test-tools">
                    <span v-for="tool in testView.tools" :key="tool" class="mcp-tool-chip">{{ tool }}</span>
                  </div>
                  <!-- Which MCP protocol version the server negotiated (see the
                       script comment above protoLine for the tracking ticket --
                       spelling it out with a leading "#" here trips the bare-hex-
                       color guard in src/ai/styles/knowledgeStyles.test.ts (the
                       template-scanning guard driven by COMPONENTS_VUE_FILES),
                       since three decimal digits are also valid hex digits;
                       the sister guard for this file's <script> block comments
                       is pinned to a different file list, which is why the
                       identical ticket number there is not flagged). -->
                  <div v-if="protoLine" class="mcp-test-proto" :class="{ 'is-legacy': protoLine.key === 'aiMcpSrvProtoLegacy' }">
                    {{ t(protoLine.key, protoLine.params) }}
                  </div>
                </template>
                <template v-else>
                  <div class="mcp-test-line">✗ {{ t(testView.msgKey) }}</div>
                  <!-- 【偏离 D8,公共约束 §3 第 8 条】Vue2 `:98` 直接显示后端拼好的
                       英文 error 串(`testResult.error`)。这里改成 `error_key`
                       映射出的本地化一句话(`testView.msgKey`)+ 默认折叠的技术
                       详情(`testView.detail`,用户 2026-07-31 拍板);后端英文
                       原文一律不上界面。`detail` 为空时整个折叠区不渲染
                       (`v-if="testView.detail"`)——本控件 Vue2 没有,是本期新增
                       的、已授权的界面偏离,不是"照抄之外顺手加的东西"。 -->
                  <details v-if="testView.detail" class="mcp-test-detail">
                    <summary>{{ t('aiMcpSrvTestDetail') }}</summary>
                    <pre>{{ testView.detail }}</pre>
                  </details>
                </template>
              </div>
            </div>
          </div>

          <!-- Task 20 (mcp-progressive-disclosure plan): the persisted tool
               list + per-tool/server-level approval toggles, replacing what
               was previously just a static note here. -->
          <div class="sk-section">
            <div class="sk-section-head">
              <div class="sk-section-title">{{ t('aiMcpSrvToolsTitle') }}</div>
            </div>
            <div class="sk-section-body">
              <div class="sk-description">{{ t('aiMcpSrvToolsNote') }}</div>
              <div v-if="toolsLoading" style="display: grid; place-items: center; padding: 14px 0">
                <div class="sk-spinner" />
              </div>
              <McpToolList
                v-else
                :server-id="server.id"
                :tools="toolRows"
                show-server-level
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 移除确认弹窗,对齐 Vue2 :112-125。偏离 D6(见文件头注释):不套 SkModal,
           reka 原语手拼,写法照抄 SkillDetail.vue:486-517。 -->
      <DialogRoot :open="confirmOpen" @update:open="confirmOpen = $event">
        <DialogPortal to=".set-app" defer>
          <DialogOverlay class="sk-modal-bg">
            <DialogContent class="sk-modal sk-confirm" :aria-describedby="undefined">
              <VisuallyHidden as-child><DialogTitle>{{ t('aiMcpSrvRemoveTitle') }}</DialogTitle></VisuallyHidden>
              <div class="sk-confirm-body">
                <h3>{{ t('aiMcpSrvRemoveTitle') }}</h3>
                <p>{{ t('aiMcpSrvRemoveBody', { name: server.name }) }}</p>
              </div>
              <div class="sk-modal-foot">
                <div class="right">
                  <button class="sk-btn ghost" @click="confirmOpen = false">{{ t('aiCancel') }}</button>
                  <!-- 偏离 D3(见文件头注释):不传具名色,由 .sk-btn.danger 自带的
                       前景色声明供色,AgentIcon 默认 currentColor 继承(修复轮 M7:
                       注释不再逐字引用 CSS 源码里的颜色字面量)。 -->
                  <button class="sk-btn danger" @click="doDelete">
                    <AgentIcon name="trash" :size="13" /> {{ t('aiMcpSrvRemoveConfirm') }}
                  </button>
                </div>
              </div>
            </DialogContent>
          </DialogOverlay>
        </DialogPortal>
      </DialogRoot>
    </template>
  </div>
</template>
