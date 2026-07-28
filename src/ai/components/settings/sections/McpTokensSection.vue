<!--
  SP8-P2b Task 10 —— 1:1 移植自 Vue2 src/views/AI/Settings/sections/McpTokensSection.vue(247 行)。
  纯函数(endpointUrl computed / buildInstruction / buildJson / fmtCreated 与 fmtLastUsed 的
  「按毫秒格式化」核心)已由 Task 9 抽到 ../../../util/mcpConnect.ts,这里只保留组件专属状态
  与 i18n 拼接。

  【D2 申报】状态留在组件本地(ref)、直调 service.ai —— 与 Vue2 归属一致(Vue2 data() 是
  组件本地状态),不做 store 集中。用户 2026-07-28 拍板(见 BlacklistSection.vue 头注释)。

  【D1 申报】Vue2 :91-120 的明文令牌弹窗是手写 `.sk-modal-bg` 裸 div + `@click.self` 关闭,
  换成 Task 3 的 SkModal(reka Dialog 外壳,视觉规则不变,详见 SkModal.vue 头注释的 D1)。
  Vue2 里 `.mcp-x` 关闭按钮 scoped 样式已被 SkModal 内置的 `.sk-x` 收编,这里不再重复定义。
  Vue2 `$buefy.dialog.confirm`(:185-191 删除确认)→ 共享 AlertDialog;
  Vue2 `$buefy.dialog.prompt`(:167-174 创建令牌)→ 共享 PromptDialog(P2a Task 6 建)——
  用法与 title/confirmText 复用既有动作名的手法,同 ProvidersSection.vue 的既定先例。

  【SkModal 三条关闭路径统一处理】遮罩点击 / Esc / 右上 × 都会经 `update:open(false)`,
  「完成」按钮走同一个 `onRevealClose`——与 Vue2 `@click.self="closeReveal"` 和 × 都走同一个
  `closeReveal` 语义一致,详见下方 `handleRevealOpenChange`。

  【服务端响应形状核实,纠正 brief Step 3 伪代码】brief 给的伪代码把 load()/createToken()
  写成 `res?.data?.tokens` / `res?.data?.token`,那是把 Vue2 的 axios 包装层重复算了一遍:
  Vue2 `res` 是 axios 响应,`res.data` 才是后端 body,`res.data.tokens` 只有一层 `.data`。
  已读 NimoOS-AI/agent/main.py:232-235(`GET /mcp-tokens` 返回 `{"tokens": [...]}`)与
  :221-229(`POST /mcp-tokens` 返回 `{"id","token","label"}`)确认后端 body 是**扁平**结构,
  没有信封。本仓 `service.ai.*`「返回 body 原样」= Vue2 的 `res.data`,所以正确映射是
  `res.tokens` / `res.token`(比 brief 伪代码少一层 `.data`)——公共约束 §5 明确禁止
  「多剥一层 .data」,这里就是那一层要去掉的地方。防御性 `&&`/`|| []` 兜底语义原样保留。

  【PromptDialog 无 maxlength prop,降级方案,已在 brief Step 3 获授权】Vue2 :170
  `inputAttrs.maxlength = 64` 在 PromptDialog(P2a 共享原语)上没有对应 prop;本期不给它
  加 prop(会动 P2a 在途文件),改为在 `createToken()` 里 `label.slice(0, 64)`——用户能多打
  但存不进去多的字符,行为等价降级,不是静默丢弃需求。

  【评审补漏,声明】Vue2 :238-247(scoped `<style>`)给三个类定了样:`.mcp-x`(已被 D1 的
  SkModal `.sk-x` 收编,见上)、`.mcp-label`(:245)、`.mcp-reveal-warn`(:246)。首次落地时
  只顾上 `.mcp-x` 的替代,漏收后两条 —— 模板里仍在用这两个类(明文弹窗里的两处“把下面这段
  交给…”标签 + 顶部警示文案),没有对应 CSS,渲染成无样式默认字体/黑色文字,是未申报的 1:1
  视觉回归。修复:值逐字保留(两条本来就是纯 token,`var(--text-secondary)`/`var(--danger)`,
  不含裸色 fallback,不用摘),**放进 `src/ai/styles/settings-styles.scss`**(不给本组件补
  `<style>` 块)——同 Task 8 把 Vue2 `ObservabilitySection.vue` 的 scoped `.status` 挪去该档
  的先例,**范围扩张,已申报**:这是本组件第二次因为「分区组件零 `<style>` 块」的惯例把 Vue2
  scoped 样式挪到那个全局档。类名未改(`mcp-` 前缀已避开撞名,不像 `.px-msg` 那次需要改名)。
  见 `settings-styles.scss` 里同一处的注释;回归测试见
  `src/ai/styles/settingsStyles.test.ts`(McpTokensSection 描述块的两条断言)。
-->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { useToast } from '../../../../stores/toast'
import { apiErrorMessage } from '../../../util/apiError'
import { copyText } from '../../../../files/util/clipboard'
import {
  mcpEndpointUrl, buildMcpInstruction, buildMcpJson, formatEpochMs, MCP_PLACEHOLDER_TOKEN,
} from '../../../util/mcpConnect'
import AgentIcon from '../../icons/AgentIcon.vue'
import SkModal from '../SkModal.vue'
import AlertDialog from '../../../../components/ui/AlertDialog.vue'
import PromptDialog from '../../../../components/ui/PromptDialog.vue'

interface McpToken {
  id: string | number
  label?: string
  created_at?: number
  last_used_at?: number | null
}

const { t } = useI18n()
const toast = useToast()

const tokens = ref<McpToken[]>([])
const loading = ref(false)
const error = ref(false)
const revealedToken = ref('')
const showReveal = ref(false)
const promptOpen = ref(false)
const confirmDeleteOpen = ref(false)
const pendingDeleteId = ref<string | number | null>(null)

const endpointUrl = computed(() => mcpEndpointUrl())
const instructionTemplate = computed(() => t('aiCfgMcpInstructionTemplate'))

// Vue2 是 created() 里 load(),本仓用 onMounted —— 两者对本组件等价(无 SSR、不依赖
// 挂载前时序),且与其余 6 个分区写法统一。
onMounted(() => { void load() })

async function load() {
  loading.value = true
  error.value = false
  try {
    const res = (await service.ai.listMCPTokens()) as { tokens?: McpToken[] } | null | undefined
    tokens.value = (res && res.tokens) || [] // Vue2 :150 三重兜底,已核实后端 body 扁平,见文件头注释
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}

function buildInstruction(token: string): string {
  return buildMcpInstruction(instructionTemplate.value, endpointUrl.value, token)
}

function buildJson(token: string): string {
  return buildMcpJson(endpointUrl.value, token)
}

function openPrompt() {
  promptOpen.value = true
}

// Vue2 :172 `(value || '').trim()` —— trim 在这里做,64 字软上限在 createToken() 里做
// (见文件头注释)。
function onPromptConfirm(value: string) {
  void createToken((value || '').trim())
}

async function createToken(label: string) {
  const trimmedLabel = label.slice(0, 64)
  try {
    const res = (await service.ai.createMCPToken({ label: trimmedLabel })) as { token?: string } | null | undefined
    revealedToken.value = (res && res.token) || ''
    showReveal.value = true
  } catch (e) {
    toast.show(apiErrorMessage(e, t('aiCfgCreateFailed')), 3000, 'danger')
  }
}

function confirmDelete(tk: McpToken) {
  pendingDeleteId.value = tk.id
  confirmDeleteOpen.value = true
}

async function onConfirmDelete() {
  const id = pendingDeleteId.value
  if (id == null) return
  await doDelete(id)
}

async function doDelete(id: string | number) {
  try {
    await service.ai.deleteMCPToken(id)
    tokens.value = tokens.value.filter((x) => x.id !== id)
  } catch (e) {
    toast.show(apiErrorMessage(e, t('aiCfgDeleteFailed')), 3000, 'danger')
  }
}

// 明文弹窗关闭时:先清明文、再重新拉列表(Vue2 :207-211 同序)。清明文必须在 await 之前
// —— 否则请求在途这段时间明文还留在内存/DOM 里。
async function onRevealClose() {
  showReveal.value = false
  revealedToken.value = ''
  await load()
}

// 遮罩点击 / Esc / 右上 × 三条路径统一走这里(见文件头 D1 说明)。
function handleRevealOpenChange(open: boolean) {
  if (!open) void onRevealClose()
}

function fmtCreated(tk: McpToken): string {
  return `${t('aiCfgCreatedAt')}: ${formatEpochMs(tk.created_at)}`
}

function fmtLastUsed(tk: McpToken): string {
  // 承接 Task 9 复核结论:last_used_at 为空时是裸「从未使用」串,不带前缀
  // (Vue2 :213-216),不能写成 `'上次使用:' + formatEpochMs(x)`(会渲染成
  // 「上次使用:-」的 1:1 回归)。
  if (!tk.last_used_at) return t('aiCfgNeverUsed')
  return `${t('aiCfgLastUsed')}: ${formatEpochMs(tk.last_used_at)}`
}

async function copy(text: string) {
  try {
    await copyText(text)
    toast.show(t('aiCopied'))
  } catch {
    toast.show(t('aiCfgCopyFailed'), 3000, 'warning')
  }
}
</script>

<template>
  <div class="set-inner">
    <div class="set-page-head">
      <h1 class="set-h1">{{ t('aiCfgMcpTokens') }}</h1>
      <p class="set-desc">{{ t('aiCfgMcpTokensDesc') }}</p>
    </div>

    <!-- A. connection info -->
    <div class="sk-section">
      <div class="sk-section-head">
        <div class="sk-section-title">{{ t('aiCfgMcpEndpoint') }}</div>
      </div>
      <div class="sk-section-body">
        <div class="set-rows">
          <div class="set-row top">
            <div class="lbl">{{ t('aiCfgMcpEndpointUrl') }}</div>
            <div class="val">
              <div class="set-copy">
                <input class="set-input full mono" :value="endpointUrl" readonly>
                <button class="set-copybtn" @click="copy(endpointUrl)">
                  <AgentIcon name="copy" :size="13" /> {{ t('aiCopy') }}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="set-banner">
          <span class="ico"><AgentIcon name="key" :size="12" /></span>
          <span>{{ t('aiCfgMcpEndpointBanner') }}</span>
        </div>
      </div>
    </div>

    <!-- A2. onboarding (persistent, placeholder token) -->
    <div class="sk-section">
      <div class="sk-section-head">
        <div class="sk-section-title">{{ t('aiCfgConnectAnAgent') }}</div>
      </div>
      <div class="sk-section-body">
        <div class="set-rows">
          <div class="set-row top">
            <div class="lbl">{{ t('aiCfgGiveThisToAgent') }}</div>
            <div class="val">
              <div class="set-copy">
                <textarea
                  class="set-input code" :value="buildInstruction(MCP_PLACEHOLDER_TOKEN)"
                  readonly rows="7"
                />
                <button class="set-copybtn" @click="copy(buildInstruction(MCP_PLACEHOLDER_TOKEN))">
                  <AgentIcon name="copy" :size="13" /> {{ t('aiCopy') }}
                </button>
              </div>
            </div>
          </div>
          <div class="set-row top">
            <div class="lbl">{{ t('aiCfgOrPasteIntoConfig') }}</div>
            <div class="val">
              <div class="set-copy">
                <textarea class="set-input code" :value="buildJson(MCP_PLACEHOLDER_TOKEN)" readonly rows="7" />
                <button class="set-copybtn" @click="copy(buildJson(MCP_PLACEHOLDER_TOKEN))">
                  <AgentIcon name="copy" :size="13" /> {{ t('aiCopy') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- B & C. tokens list -->
    <div class="sk-section">
      <div class="sk-section-head">
        <div class="sk-section-title">{{ t('aiCfgTokens') }}</div>
        <div class="sk-section-hint">{{ tokens.length }}</div>
        <button class="sk-btn primary" style="margin-left:auto" @click="openPrompt">
          <AgentIcon name="plus" :size="13" /> {{ t('aiCfgCreateToken') }}
        </button>
      </div>
      <div class="sk-section-body">
        <div v-if="loading" class="set-note">{{ t('aiCfgLoadingDots') }}</div>
        <div v-else-if="error" class="set-note">{{ t('aiCfgLoadFailed') }}</div>
        <div v-else-if="!tokens.length" class="set-note">{{ t('aiCfgNoTokensYet') }}</div>
        <div v-else v-for="tk in tokens" :key="tk.id" class="tok-row">
          <span class="tok-ic"><AgentIcon name="key" :size="16" /></span>
          <div class="tok-body">
            <div class="tok-name">{{ tk.label || t('aiCfgNoLabel') }}</div>
            <div class="tok-meta">
              <span>{{ fmtCreated(tk) }}</span>
              <span class="sep" />
              <span :class="{ never: !tk.last_used_at }">{{ fmtLastUsed(tk) }}</span>
            </div>
          </div>
          <button class="tok-del" @click="confirmDelete(tk)">
            <AgentIcon name="trash" :size="13" /> {{ t('aiCfgDelete') }}
          </button>
        </div>
      </div>
    </div>

    <!-- reveal modal: plaintext + inlined onboarding shown once -->
    <SkModal :open="showReveal" :title="t('aiCfgTokenCreated')" @update:open="handleRevealOpenChange">
      <p class="mcp-reveal-warn">{{ t('aiCfgTokenShownOnce') }}</p>
      <div class="set-copy">
        <input class="set-input full mono" :value="revealedToken" readonly>
        <button class="set-copybtn" @click="copy(revealedToken)">
          <AgentIcon name="copy" :size="13" /> {{ t('aiCopy') }}
        </button>
      </div>
      <label class="mcp-label">{{ t('aiCfgGiveThisToAgent') }}</label>
      <div class="set-copy">
        <textarea class="set-input code" :value="buildInstruction(revealedToken)" readonly rows="6" />
        <button class="set-copybtn" @click="copy(buildInstruction(revealedToken))">
          <AgentIcon name="copy" :size="13" /> {{ t('aiCopy') }}
        </button>
      </div>
      <label class="mcp-label">{{ t('aiCfgOrPasteIntoConfig') }}</label>
      <div class="set-copy">
        <textarea class="set-input code" :value="buildJson(revealedToken)" readonly rows="7" />
        <button class="set-copybtn" @click="copy(buildJson(revealedToken))">
          <AgentIcon name="copy" :size="13" /> {{ t('aiCopy') }}
        </button>
      </div>
      <template #footer>
        <button class="sk-btn primary" @click="onRevealClose">{{ t('aiDone') }}</button>
      </template>
    </SkModal>

    <AlertDialog
      v-model:open="confirmDeleteOpen"
      :title="t('aiCfgDelete')"
      :message="t('aiCfgDeleteTokenConfirm')"
      :confirm-text="t('aiCfgDelete')"
      :cancel-text="t('aiCancel')"
      destructive
      @confirm="onConfirmDelete"
    />

    <PromptDialog
      v-model:open="promptOpen"
      :title="t('aiCfgCreateToken')"
      :message="t('aiCfgTokenLabelPrompt')"
      :placeholder="t('aiCfgTokenLabel')"
      :confirm-text="t('aiCfgCreateToken')"
      :cancel-text="t('aiCancel')"
      @confirm="onPromptConfirm"
    />
  </div>
</template>
