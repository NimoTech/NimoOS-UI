<!--
  SP8-P4 Task 8 —— 1:1 移植自 Vue2 `NimoOS-UI/src/views/AI/MCP/McpServerModal.vue`
  (216 行)。新增/编辑表单弹窗,含快速粘贴解析与 headers/env 的 KV 编辑器。

  ===== 接口偏离(协调者裁定 3,已授权)=====
  Vue2 是 `v-if="modalOpen"`(每次打开重新创建实例,`data()` 天然只跑一次)+ `@close`
  事件。本仓照 `../skills/AddSkillModal.vue` 先例改成 `v-model:open` 常挂(组件实例
  在整个设置页生命周期里只创建一次),并新增 `serverError` prop 承载保存失败的行内
  报错(Vue2 把保存失败塞进 toast,偏离 D5 要求改行内,先例 `.sk-field-err` /
  `.chan-field-err`,见下方 grep 证据)。
  组件实例常驻带来的后果:Vue2 靠“重新创建实例”天然获得“每次打开都是干净表单”,本仓
  必须显式在 `watch(open)` 里从当前 `props.server` 重新派生所有字段——这不只是“复位
  成空表单”(AddSkillModal 的做法,因为它没有“编辑已有数据”这个场景),而是“新增态
  复位成空、编辑态复位成该服务器的当前值”,因为持久实例可能被父组件先后用于编辑不同
  的服务器。watch(open) 的 true 分支统一处理这两种情况。

  ===== 偏离 D1(公共约束 §3 第 1 条,强制)=====
  `parsePaste()`:共享包 `service.ai.parseMCPCommand` 已 `return res.data`
  (`NimoOS-Service/src/ai.ts`),后端 `mcp.go:137` 是裸对象 `200`。Vue2 `:166` 的
  `const p = (resp && resp.data) || {}` 在本仓恒解出 `{}`——快速粘贴会永远静默填不进
  任何字段,且不报错(`{}` 落进各字段的 `|| ''`/`|| []` 兜底,界面看起来“什么都没
  发生”)。本仓直接把 `await service.ai.parseMCPCommand(cmd)` 的返回值当 `McpParsed`
  用,不再多剥一层 `.data`。

  ===== 偏离 D5(公共约束 §3 第 5 条)=====
  `pasteErr` 不再读 Vue2 `:182` 的 `e.response.data.message`(后端英文原文,界面永不
  回显原文的硬约束),改用 `util/mcpErrorKey.ts`(T3)的 `parseCommandErrorKey(e)` 映射
  成 i18n 键,`t()` 出当前语言的本地化文案再赋给 `pasteErr`。

  ===== N1(公共约束 §3.5 第 1 条,照抄不改,已确认照抄)=====
  Vue2 `valid`(`:141-146`)要求名称非空,后端 `validateAndClean`(`mcp.go:273-289`)
  对 `name` 零校验。本仓 `valid` 逐字照抄这条(见下方 computed),**不新增任何前置
  校验,也不删除这条**——判据见设计文档 §6 决策 N1:这不是“前端比后端严格”那类需要
  改的东西,是纯 UI 级要求(无名服务器在列表里就是一条无法辨识的空白条目),不涉及
  任何数据转换。

  ===== N2(公共约束 §3.5 第 2 条,照抄不改,已确认照抄)=====
  `parsePaste()` 的 non-stdio 分支(`p.transport !== 'stdio'`)**不清空 `headers`**——
  对齐 Vue2 `:174-179` 的 else 分支只清 `command`/`argsText`/`env`,不动 `headers`。
  stdio 分支(`:168-173`)才清 `headers`(因为 headers 只属于 http/sse)。这不是遗漏的
  不对称,是有意设计:解析成 http/sse 时保留用户已经手填的请求头是正确行为。

  ===== N3(公共约束 §3.5 第 3 条,照抄不改,已确认照抄)=====
  编辑态无法清空已有的 headers/env——`headers`/`env` 两个 ref 无论新增态还是编辑态
  都从空数组起步(Vue2 `data(){ headers: [], env: [] }`,`:132-133`,不读
  `server.has_headers`/`has_env` 的值填回表单,因为后端从不下发明文,见
  `types/mcpServer.ts` 对 `has_headers`/`has_env` 的注释)。`.mcp-kv-hint`
  (`aiMcpSrvKvHint`,值「留空保持不变;填写则覆盖全部。」)在编辑态且原有
  `has_headers`/`has_env` 为真时显示,明示这个语义——对应后端 `applyReq`
  (`mcp.go:230-269`)只覆盖请求体里出现的字段。

  ===== 内联 style / 占位符,尺寸不是颜色,照抄(公共约束 §6)=====
  - `style="font-family: var(--font-mono); font-size: 12.5px"`(快速粘贴输入框
    `:14`、URL 输入框 `:42`、命令输入框 `:65`)
  - `style="grid-template-columns: repeat(3, 1fr)"`(传输三选一 `:31`)
  - `argsText` 的 placeholder 用 `&#10;` 换行(`:73`),逐字照抄

  ===== 零 <style> 块,用到的每个类均已存在(grep 证据见任务报告)=====
  `.sk-field*`/`.sk-trig-options`/`.sk-trig-option`/`.sk-btn`/`.sw`/`.save-note`/
  `.sk-field-err`(`sk-shared.scss`)· `.mcp-quickadd-row`/`.mcp-quickadd-err`/
  `.mcp-kv*`/`.mcp-args`(T1 `mcp-styles.scss`)。⚠️ `.mcp-quickadd`(Vue2 `:9`,本组件
  也照抄这个类名挂在快速添加的 `.sk-field` 上)在 `mcp-styles.scss` 里本来就没有
  对应规则——Vue2 原文如此,不为它补 CSS。
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import SkModal from '../SkModal.vue'
import AgentIcon from '../../icons/AgentIcon.vue'
import { parseCommandErrorKey } from '../../../util/mcpErrorKey'
import type { McpServer, McpParsed, McpServerFormPayload } from '../../../types/mcpServer'

interface KvRow { k: string; v: string }

// 接口偏离(裁定 3):新增 `server`(编辑态数据来源)与 `serverError`(行内报错)。
const props = defineProps<{
  open: boolean
  server: McpServer | null
  saving: boolean
  serverError: string
}>()

const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'save', payload: McpServerFormPayload): void
}>()

const { t } = useI18n()

// 对齐 Vue2 `computed: { isEdit() { return !!this.server } }`(:140)。
const isEdit = computed(() => !!props.server)

const modalTitle = computed(() => (isEdit.value ? t('aiMcpSrvEditTitle') : t('aiMcpSrvAdd')))

// 对齐 Vue2 `data()`(:123-137)。表单字段一律组件本地 ref(公共约束 §5)。
const name = ref('')
const transport = ref('http')
const url = ref('')
const command = ref('')
const argsText = ref('')
const enabled = ref(true)
const headers = ref<KvRow[]>([])
const env = ref<KvRow[]>([])
const pasteCmd = ref('')
const pasteErr = ref('')
const parsing = ref(false)

const nameInputEl = ref<HTMLInputElement | null>(null)

// 对齐 Vue2 `computed: { valid() {...} } `(:141-146)。
// N1(照抄不改):名称非空是后端没有的 UI 级要求,不许因此新增其它前置校验。
const valid = computed(() => {
  if (name.value.trim().length === 0) return false
  return transport.value === 'stdio'
    ? command.value.trim().length > 0
    : url.value.trim().length > 0
})

// 对齐 Vue2 `computed: { transports() {...} }`(:147-153)。name 字段(HTTP/SSE/STDIO)
// 是字面量不是 i18n 键,与 Vue2 一致;desc 走 t()。
const transports = computed(() => [
  { id: 'http', name: 'HTTP', descKey: 'aiMcpSrvTransportHttp' },
  { id: 'sse', name: 'SSE', descKey: 'aiMcpSrvTransportSse' },
  { id: 'stdio', name: 'STDIO', descKey: 'aiMcpSrvTransportStdio' },
])

// 从当前 props.server 派生表单初值——新增态(server=null)全部清空,编辑态回填
// 除 headers/env 外的字段(N3:headers/env 一律从空数组起步,不回填明文,因为
// 后端从不下发)。见文件头「接口偏离」段:持久实例每次打开都要重新派生,不能只
// 在组件创建时读一次 props.server(那是 Vue2 v-if 重建实例才能吃到的免费红利)。
function resetForm() {
  const s = props.server
  name.value = s ? s.name : ''
  transport.value = s ? s.transport : 'http'
  url.value = s ? s.url : ''
  command.value = s ? (s.command || '') : ''
  argsText.value = s ? (s.args || []).join('\n') : ''
  enabled.value = s ? s.enabled : true
  headers.value = []
  env.value = []
  pasteCmd.value = ''
  pasteErr.value = ''
  parsing.value = false
}

// 对齐 Vue2 `mounted(){ this.$nextTick(() => focus) }`(:155-157)。
// 用 setTimeout(0) 而不是 nextTick——照 AddSkillModal.vue 头注释「reka 初始焦点
// 实测结论」的先例:reka Dialog 的 FocusScope 自己的 mount-auto-focus 与本组件的
// nextTick 是同一微任务级时序赛跑,宏任务级延迟才能稳定压过默认聚焦落到 SkModal
// 的关闭按钮上,不是新引入的偏离,是沿用已验证过的既有写法。
watch(
  () => props.open,
  (v) => {
    if (v) {
      resetForm()
      setTimeout(() => { nameInputEl.value?.focus() }, 0)
    }
  },
  { immediate: true },
)

// 对齐 Vue2 `methods: { parsePaste() {...} }`(:159-187)。
async function parsePaste() {
  const cmd = pasteCmd.value.trim()
  if (!cmd) return
  parsing.value = true
  pasteErr.value = ''
  try {
    // 偏离 D1(见文件头):单层取数,不再多剥 `.data`。
    const p = await service.ai.parseMCPCommand(cmd) as McpParsed
    transport.value = p.transport || 'http'
    if (p.transport === 'stdio') {
      command.value = p.command || ''
      argsText.value = (p.args || []).join('\n')
      env.value = Object.keys(p.env || {}).map((k) => ({ k, v: p.env[k] }))
      url.value = ''
      headers.value = []
    } else {
      // N2(照抄不改,见文件头):non-stdio 分支不清 headers。
      url.value = p.url || ''
      command.value = ''
      argsText.value = ''
      env.value = []
    }
    if (!name.value.trim() && p.suggested_name) name.value = p.suggested_name
  } catch (e) {
    // 偏离 D5(见文件头):不回显后端原文,走 error_key 映射 + t()。
    pasteErr.value = t(parseCommandErrorKey(e))
  } finally {
    parsing.value = false
  }
}

// 对齐 Vue2 `methods: { collect(rows) {...} }`(:188-195)。
function collect(rows: KvRow[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const r of rows) {
    const k = (r.k || '').trim()
    if (k) out[k] = r.v || ''
  }
  return out
}

// 对齐 Vue2 `methods: { parseArgs(text) {...} }`(:196-198)。
function parseArgs(text: string): string[] {
  return String(text || '').split('\n').map((s) => s.trim()).filter((s) => s.length > 0)
}

// 对齐 Vue2 `methods: { submit() {...} }`(:199-213)。
// N3(照抄不改,见文件头):`if (!isEdit || Object.keys(x).length)` 逐字照抄——
// 编辑态且 KV 为空时不带该字段,对应后端「只覆盖请求里出现的字段」。
function submit() {
  if (!valid.value) return
  const payload: McpServerFormPayload = {
    name: name.value.trim(),
    transport: transport.value,
    enabled: enabled.value,
  }
  if (transport.value === 'stdio') {
    payload.command = command.value.trim()
    payload.args = parseArgs(argsText.value)
    const e = collect(env.value)
    if (!isEdit.value || Object.keys(e).length) payload.env = e
  } else {
    payload.url = url.value.trim()
    const h = collect(headers.value)
    if (!isEdit.value || Object.keys(h).length) payload.headers = h
  }
  emit('save', payload)
}

function onCancel() {
  emit('update:open', false)
}
</script>

<template>
  <SkModal :open="props.open" :title="modalTitle" @update:open="(v) => emit('update:open', v)">
    <!-- 行内报错(接口偏离,裁定 3):Vue2 把保存失败塞进 toast,本仓改行内,
         先例 `.sk-field-err`(AddSkillModal.vue:183)/`.chan-field-err`
         (ChannelsSection.vue:449),同款「落在 body 顶部,先于所有字段」。 -->
    <p v-if="props.serverError" class="sk-field-err" role="alert">{{ props.serverError }}</p>

    <div v-if="!isEdit" class="sk-field mcp-quickadd">
      <label class="sk-field-label">
        {{ t('aiMcpSrvQuickAdd') }}
        <span class="sk-field-optional">({{ t('aiMcpSrvQuickAddHint') }})</span>
      </label>
      <div class="mcp-quickadd-row">
        <input
          type="text" data-f="paste" v-model="pasteCmd"
          style="font-family: var(--font-mono); font-size: 12.5px"
          placeholder="npx -y @upstash/context7-mcp"
          @keydown.enter.prevent="parsePaste"
        >
        <button
          type="button" class="sk-btn ghost" data-f="fill"
          :disabled="parsing || !pasteCmd.trim()" @click="parsePaste"
        >
          {{ parsing ? t('aiMcpSrvParsing') : t('aiMcpSrvFillForm') }}
        </button>
      </div>
      <div v-if="pasteErr" class="mcp-quickadd-err">{{ pasteErr }}</div>
    </div>

    <div class="sk-field">
      <label class="sk-field-label">{{ t('aiMcpSrvName') }}</label>
      <input
        ref="nameInputEl" type="text" data-f="name" v-model="name"
        :placeholder="t('aiMcpSrvNamePlaceholder')" @keydown.enter.prevent
      >
    </div>

    <div class="sk-field">
      <label class="sk-field-label">{{ t('aiMcpSrvTransportType') }}</label>
      <div class="sk-trig-options" style="grid-template-columns: repeat(3, 1fr)">
        <button
          v-for="o in transports" :key="o.id" type="button" class="sk-trig-option"
          :data-active="transport === o.id ? 'true' : 'false'" @click="transport = o.id"
        >
          <span class="name">{{ o.name }}</span><span class="desc">{{ t(o.descKey) }}</span>
        </button>
      </div>
    </div>

    <div v-if="transport !== 'stdio'" class="sk-field">
      <label class="sk-field-label">{{ t('aiMcpSrvUrl') }}</label>
      <input
        type="text" data-f="url" v-model="url"
        style="font-family: var(--font-mono); font-size: 12.5px"
        :placeholder="transport === 'sse' ? 'https://example.com/sse' : 'https://example.com/mcp'"
      >
    </div>

    <div v-if="transport !== 'stdio'" class="sk-field">
      <label class="sk-field-label">
        {{ t('aiMcpSrvReqHeaders') }}
        <span class="sk-field-optional">({{ t('aiMcpSrvOptional') }})</span>
      </label>
      <div class="mcp-kv" data-kv="headers">
        <div v-for="(row, i) in headers" :key="'h' + i" class="mcp-kv-row">
          <input data-kvk type="text" :placeholder="t('aiMcpSrvKvKey')" v-model="row.k">
          <input data-kvv type="text" :placeholder="t('aiMcpSrvKvValue')" v-model="row.v">
          <button class="mcp-kv-del" @click="headers.splice(i, 1)"><AgentIcon name="x" :size="12" /></button>
        </div>
      </div>
      <button class="mcp-kv-add" data-add="headers" @click="headers.push({ k: '', v: '' })">
        + {{ t('aiMcpSrvAddHeader') }}
      </button>
      <div v-if="isEdit && props.server?.has_headers" class="mcp-kv-hint">{{ t('aiMcpSrvKvHint') }}</div>
    </div>

    <div v-if="transport === 'stdio'" class="sk-field">
      <label class="sk-field-label">{{ t('aiMcpSrvCommand') }}</label>
      <input
        type="text" data-f="command" v-model="command"
        style="font-family: var(--font-mono); font-size: 12.5px"
        :placeholder="t('aiMcpSrvCommandPlaceholder')"
      >
    </div>

    <div v-if="transport === 'stdio'" class="sk-field">
      <label class="sk-field-label">
        {{ t('aiMcpSrvArgs') }}
        <span class="sk-field-optional">({{ t('aiMcpSrvOnePerLine') }})</span>
      </label>
      <textarea
        data-f="args" v-model="argsText" class="mcp-args" rows="4"
        placeholder="-y&#10;@modelcontextprotocol/server-everything"
      />
    </div>

    <div v-if="transport === 'stdio'" class="sk-field">
      <label class="sk-field-label">
        {{ t('aiMcpSrvEnvVars') }}
        <span class="sk-field-optional">({{ t('aiMcpSrvOptional') }})</span>
      </label>
      <div class="mcp-kv" data-kv="env">
        <div v-for="(row, i) in env" :key="'e' + i" class="mcp-kv-row">
          <input data-kvk type="text" :placeholder="t('aiMcpSrvKvKey')" v-model="row.k">
          <input data-kvv type="text" :placeholder="t('aiMcpSrvKvValue')" v-model="row.v">
          <button class="mcp-kv-del" @click="env.splice(i, 1)"><AgentIcon name="x" :size="12" /></button>
        </div>
      </div>
      <button class="mcp-kv-add" data-add="env" @click="env.push({ k: '', v: '' })">
        + {{ t('aiMcpSrvAddVariable') }}
      </button>
      <div v-if="isEdit && props.server?.has_env" class="mcp-kv-hint">{{ t('aiMcpSrvKvHint') }}</div>
    </div>

    <div class="sk-field">
      <label class="sk-field-label">{{ t('aiCfgEnabled') }}</label>
      <div
        class="sw" :data-on="enabled ? 'true' : 'false'" role="switch"
        :aria-checked="enabled ? 'true' : 'false'" @click="enabled = !enabled"
      />
    </div>

    <template #footerLeft>
      <span class="save-note">
        <AgentIcon name="check" :size="11" />
        {{ t('aiMcpSrvSavedLocally') }}
      </span>
    </template>
    <template #footer>
      <button type="button" class="sk-btn ghost" @click="onCancel">{{ t('aiCancel') }}</button>
      <button type="button" class="sk-btn primary" :disabled="!valid || props.saving" @click="submit">
        <AgentIcon :name="isEdit ? 'check' : 'plus'" :size="13" />
        {{ props.saving ? t('aiCfgSaving') : (isEdit ? t('aiCfgSave') : t('aiMcpSrvAddServer')) }}
      </button>
    </template>
  </SkModal>
</template>
