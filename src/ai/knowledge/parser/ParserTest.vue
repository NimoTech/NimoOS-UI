<!--
  SP8-P5c Task 7 —— 「Parser 测试沙盒」页(路由 `/ai/parser/test`),1:1 移植自 Vue2 蓝本
  `NimoOS-UI` (main@7a6ee6b7) `src/views/AI/Parser/ParserTest.vue`(369 行,
  `git show main:` 读取 —— 治理 §1:那个仓的工作树是旧分支,不可信)。

  🔴 **本刀只做 template(蓝本 :1-152)+ script(蓝本 :154-243)= 242 行。**
     蓝本 `<style lang="scss" scoped>`(:245-369,125 行)T2b 已搬进
     `src/ai/styles/parser-styles.scss` 的 `.parser-app .parser-test-page` 段并过评审
     → **本文件零 `<style>` 块**,样式走 K24 的 JS 侧 side-effect import。

  结构对照(蓝本行区间 → 本文件模板):
    :3-6     页头:标题 + `← 返回详情` router-link(`/ai/parser`)
    :8-18    help 卡:两段说明(第二段带两个 `<code>` 扩展名清单)
    :21-93   upload 卡:拖放区 · 三个参数输入 + 重置 · query + rerank + OCR · 提交 + ok-hint · error-box
    :96-150  结果区(`<template v-if="result">`):docling 卡(折叠)· scored 卡 · chunks 卡
    :159-176 data() 的 10 项瞬态(全部组件本地 ref,治理 §5.1:不塞 store)
    :178-240 onDrop / onFile / clearFile / resetParams / submit / chunkText / truncate / fmtBytes

  ─────────────────────────────────────────────────────────────────────────────
  【K31 —— 根元素必须两层】(协调者 2026-08-03 裁定,治理 §3 K31)
    `<div class="parser-app"><div class="parser-test-page">…</div></div>`
    ——**比蓝本多一层 DOM**。外层 `.parser-app` 只带 K22 那三行结构属性
    (`height:100vh; height:100dvh; overflow-y:auto`,见 `parser-styles.scss:68-72`),
    内层 `.parser-test-page` 是蓝本 :246-250 的 `padding:16px; max-width:900px; margin:0 auto`。
    🔴 为什么不能压成同一个元素:`src/styles/theme.css:318` 是 `body{overflow:hidden}`,
    `/ai/parser/test` 是**顶层路由**(不在 KnowledgeLayout 之下),不自建滚动容器内容
    永远看不到(K22);而滚动容器若同时是那条 900px 居中列,`overflow-y:auto` 的滚动条
    就落在**列的右缘(宽屏上约在屏幕中间)**,而 Vue2 是整页滚动、滚动条在**视口最右缘**
    —— 那是**用户可见的界面不 1:1**。多一层 DOM 用户不可见,取后者。
    ⚠️ 计划书 `p5c-plan.md` 的 T7 节仍写着 K31 之前的 `class="parser-app parser-test-page"`
    (单元素,治理 §12.3 E-14 已就此订正 T6 那行),**已被 K31 覆盖**;
    权威优先级:治理文件 + 附录 > brief > 计划书。先例:`ParserStatus.vue`(T6)同款两层。

  【K24 —— 样式走 JS 侧 import,零 `<style>` 块】`import '../../styles/parser-styles.scss'`
    (T2b 建的独立文件)。蓝本的 scoped 隔离在 New-UI 换成 K9 的「规则全嵌在页面作用域下」。
    先例:`KnowledgeLayout.vue:43` / `AgentPage.vue:72` / `SettingsPage.vue:70` / `ParserStatus.vue:108`。
    ⏳ 治理 §12.3 **E-13** 的历史记录:**T7 落地时**本页**零生产 import**(`/ai/parser/test`
    在 `knowledgeRoutes.ts` 仍指占位页)→ 模块不进 Vite 图 → 这条 side-effect import 从未求值
    → **当时** `dist/assets/*.css` 里搜不到 `parser-test-page` 是预期,那条门因此挪到 T10。
    ✅ **P5c T10(2026-08-04)已反转路由,该门已达标**:产物里 `.parser-app .parser-test-page`
    实测 **53 处**命中(复合形式 0 处 = K31 生效)。**这条 import 现在真的在产 CSS,别删。**

  【K27 —— REST 走共享包,且**单参调用**】
    蓝本 :216-219 是
      `api.post('/ai/parser/test/analyze', fd, { headers:{'Content-Type':'multipart/form-data'}, timeout:120000 })`
    本仓写 `service.ai.parserTestAnalyze(fd)` —— 🔴 **不传第二个参数**:
    `NimoOS-Service/src/ai.ts:673-680` 的包方法签名只收 `FormData`,内部**已经**补了
    multipart 头 + 单独 120s 超时(注释原文写明「与 Vue2 `ParserTest.vue:207-219` 逐字对齐」)。
    再传一遍是重复,且类型上根本传不进去。

  【K1 —— 单层取数】蓝本 :220 是 `this.result = resp.data`;包内已 `return res.data`
    → 本仓 `result.value = await service.ai.parserTestAnalyze(fd)`,**没有 `.data` 那一层**。
    包的返回类型是 `Promise<unknown>` → 这里 `as AnalyzeResult` 收口(HTTP 原样 snake_case,
    零转换,字段名与 fixture 逐字一致)。

  【零 KIcon】(治理 §1.2 / E-2 / N16)两个 Parser 页蓝本一个 KIcon 都不用 —— 用 emoji
    与纯文字按钮。**不许"顺手换成 KIcon"**(界面不 1:1)。

  【N16 —— emoji / 符号位置逐字照抄,一个都不许挪进/挪出 `t()`】
    全部在 `t()` **外面**:`←`(:5 返回链接前)· `×`(:35 清除按钮)· `✓`(:80 ok-hint 前)·
      `▼` / `▶`(:100 docling 折叠箭头)· `⚠`(:110 `⚠ Reranker error:`)·
      `·`(U+00B7,:80-82 ok-hint 的分隔点 / :136 chunk-head / :145 sparse 连接符)·
      `…`(U+2026,:141 dense 预览末尾的 `, …]`)
    在 `t()` **里面**(即键值自带):`…` 在 `aiKbPtProcessing`(处理中…)· `（）；，` 全角标点在
      多个键值里(附录 A §A.5 的 18 条例外之一)· `–`(U+2013)在 `aiKbPtDefaults` 的 `5–20`
    由 **script 产生**:`…` 是 `truncate()` 的截断号(:234,U+2026)
    🔴 本页标题**没有** emoji(蓝本 :4 是纯 `<h2>{{ $t('Parser test sandbox') }}</h2>`)——
      `🧪` 在 `ParserStatus.vue:6` 与 `SettingsView.vue:162`,**不在本页**(brief §4.3 那条
      「`🧪`(标题)」是错的,已登记 **E-15**)。

  【N18 —— `result.scored.indexOf(s) + 1` 当排名序号,照抄】(蓝本 :115)
    O(n²) 且依赖对象同一性(靠 `v-for` 里那个 `s` 与数组元素是同一引用)。
    本机 `scored` 最多 20 条 → **不是可复现的错误行为** → 照抄。
    🔴 **不许改成 `v-for="(s, i) in …"` 取 `i + 1`**(与需求无关的顺手改动)。

  【N22 —— 硬编码技术标识符/参数名一个都不补 i18n 键】(治理 §3.5 N22)
    `rerank top-20`(:65)· `⚠ Reranker error:`(:110)· `dense [0:8]:`(:140)· `sparse top:`(:144)·
    `chunk #`(:119 / :135)· `cos`(:116)· `rr`(:118)· 三个 `<label>` 的
    `target_tokens`(:41)/ `overlap_tokens`(:45)/ `min_tokens`(:49)·
    `chunker=…, target=…, overlap=…, min=…`(:84-87)· `{{ c.token_count }} tokens · offset …`(:136)·
    `chunks`(:80 ok-hint 里的英文单位词)。
    🔴 **补了就是凭空多出 Vue2 没有的键,且 en/zh 两档一填英文 = 纯噪音。**

  【治理 §4.2 的四条实测事实 —— 是预期行为,不是缺陷】
    ① `.md`/`.txt` **不产生 `docling_markdown`** → :98 的 docling 卡整块不渲染。
    ② `scored[]` 里**没有 `rerank_score`** → :117-118 的 `rr {…}` 一直不渲染。
    ③ 🔴 **本机 reranker 是坏的**(`XLMRobertaTokenizer has no attribute prepare_for_model`)
       → 勾 `rerank top-20` 只能看到 `⚠ Reranker error:` 警告条,**永远看不到 `rr` 分数**。
       **后端缺陷,已记后端票(治理 §8.2),本期照抄前端、不修、不绕。**
    ④ `params_used.overlap_tokens` 会被后端按 chunker 改写(markdown → 恒 0,plain → 原样)
       → :83-88 的 ok-hint 回显的是**后端回的 `params_used`**,不是前端传的 `params`。
       **正好对上 :56 那句 `<em>` 提示,不是前端 bug。**

  【🔴 422 分支不可达 —— 照抄取值链,不加数组分支,不写单测】(治理 §4.2 / §5.1)
    不传 file 时后端返 **422** 且 `{"detail":[{…}]}` —— `detail` 是**数组**(FastAPI 校验错误),
    与其它端点的字符串 `detail` 契约不一致。
    🔴 但**这个分支 UI 到不了**:提交按钮 `:disabled="!file || loading"`(:76)挡住了
    「没选文件就提交」;`submit()` 开头 `if (!file) return` 再挡一道。
    → 照抄 :222-223 的 `detail || e.message || String(e)` 取值链,**不许为数组加分支处理**
      (那会是凭空多出的逻辑);**也不许为它写单测**(测一条 UI 到不了的路径 = 空转)。

  【K34 —— 类型安全机械改写(4 处,**全部保抛,零行为变化**)】
    🔴 **统一口径(评审 M-1,2026-08-04):一律用「保抛」写法(`as` / `!`),不用 `?.` / `&&` 兜底。**
    理由:`?.` 与新加的 `&&` 会把蓝本会抛的 `TypeError` **静默变成 no-op** —— 那是行为改动,
    与 K34 落地要求②「真的零行为变化」冲突,也与本条第 4 点自己的论证自相矛盾
    (第一版 1/2/3 用了 `?.`/`&&`、4 用了 `!`,同一份文件里两套相反判断)。
    **判据是忠于蓝本,不是「不抛更安全」。** 四处改完 `vue-tsc` 仍 exit 0 → 证明 `!`/`as`
    足够满足 strict,那三处 `?.`/`&&` 从一开始就是多余的。

    1. `$refs.fileInput.click()`(蓝本 :29)→ `<script setup>` 的模板 ref:
       `const fileInput = ref<HTMLInputElement | null>(null)` + 模板 **`fileInput!.click()`**。
       Vue 3 没有 `$refs` 选项式那套(`<script setup>` 里 ref 变量即元素)。
       `!` 只是类型层面的说法 → ref 为 null 时仍抛同一个 TypeError,与蓝本逐字一致。
    2. `onFile($event.target.files[0])`(蓝本 :27)→ **`($event.target as HTMLInputElement).files![0]`**
       —— `EventTarget` 上没有 `files`(需要 `as`),`FileList | null` 不能直接下标(需要 `!`)。
       `files` 为 null 时两边都抛。先例 `ParserStatus.vue:262` 的
       `($event.target as HTMLInputElement).checked` 是同款 `as`。
    3. `e.dataTransfer.files && e.dataTransfer.files[0]`(蓝本 :180)→
       **`e.dataTransfer!.files && e.dataTransfer!.files[0]`** —— `DragEvent.dataTransfer`
       的类型是 `DataTransfer | null`,只加 `!`。🔴 中间那个 `&&` 是**蓝本自己的短路**,照抄;
       第一版另加的 `e.dataTransfer &&` 已删除(那一个才是改行为的)。
    4. `chunkText()` 里 **`result.value!.chunks`**(蓝本 :229 是裸 `this.result.chunks`)——
       `result` 为 null 时仍抛同一个 TypeError;`?.` 会把它悄悄变成「回空串」= 行为改动。
       (`chunkText` 只在 `<template v-if="result">` 之内被调用 → 实际不可达。)
-->
<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import '../../styles/parser-styles.scss'

const { t } = useI18n()

/* ═══ `POST /v1/parser/test/analyze` 的响应形状 ═══
 * 🔴 HTTP 原样 snake_case:包方法 `service.ai.parserTestAnalyze` 只 `return res.data`
 * (`NimoOS-Service/src/ai.ts:673-680`,零转换)→ 字段名与
 * `.superpowers/sdd/p5c-fixtures/parser-test-analyze-*.json` 逐字一致。
 * 可选字段就是治理 §4.2 实测「本机不下发」的那几个(`docling_markdown` / `rerank_error` /
 * `scored` / `rerank_score`)—— **模板里的 `v-if` 守卫正是为它们而存在的,不许简化**。 */
interface SparseTerm {
  token_id: number
  weight: number
}
interface AnalyzeChunk {
  chunk_no: number
  text: string
  token_count: number
  offset_start: number
  offset_end: number
  dense_preview?: number[]
  sparse_top_terms?: SparseTerm[]
}
interface AnalyzeScored {
  chunk_no: number
  cos_sim: number
  /** 🔴 本机永不下发(治理 §4.2 事实②)—— 蓝本 :117 的双守卫为它而写。 */
  rerank_score?: number | null
}
interface AnalyzeParamsUsed {
  target_tokens: number
  overlap_tokens: number
  min_tokens: number
  chunker: string
}
interface AnalyzeResult {
  mime: string
  /** 后端回显,蓝本模板未用 —— 保留字段以对齐真实响应。 */
  filename: string
  size: number
  /** 后端回显,蓝本模板未用。 */
  text_length: number
  chunk_count: number
  chunks: AnalyzeChunk[]
  params_used?: AnalyzeParamsUsed
  /** 后端回显,蓝本模板未用。 */
  query?: string
  scored?: AnalyzeScored[]
  rerank_error?: string
  docling_markdown?: string
}

/* ═══ 蓝本 data()(:159-176)—— 10 项全是页面级瞬态,一律组件本地 ref(治理 §5.1:不塞 store)═══ */
const file = ref<File | null>(null)
const query = ref('')
const rerank = ref(false)
const ocr = ref(false)
const loading = ref(false)
const result = ref<AnalyzeResult | null>(null)
const error = ref<string | null>(null)
const dragActive = ref(false)
const doclingOpen = ref(false)
/** 🔴 用 `ref` 而不是 `reactive`:蓝本 `resetParams()`(:199)**整体重新赋值**
 *  `this.params = { … }`,`ref` 的 `params.value = { … }` 与之逐字对应。 */
const params = ref<{ target_tokens: number; overlap_tokens: number; min_tokens: number }>({
  target_tokens: 600,
  overlap_tokens: 80,
  min_tokens: 2,
})

/** 蓝本 :27 的 `ref="fileInput"` + :29 的 `$refs.fileInput.click()`(机械改写 1)。 */
const fileInput = ref<HTMLInputElement | null>(null)

/**
 * 蓝本 onDrop(e)(:178-182)—— 先关高亮,再取第一个文件,取到才交给 onFile。
 * K34-3:只给 `e.dataTransfer` 加 `!`(它的类型是 `DataTransfer | null`);
 * 中间那个 `&&` 是**蓝本自己的短路**,照抄。为 null 时与蓝本同样抛 TypeError。
 */
function onDrop(e: DragEvent): void {
  dragActive.value = false
  const f = e.dataTransfer!.files && e.dataTransfer!.files[0]
  if (f) onFile(f)
}

/**
 * 蓝本 onFile(f)(:183-192)。
 * 🔴 **顺序与「不清 file」逐字照抄**:超 30 MB 时**只设 `error` 并 `return`** ——
 * 既不清掉已选的 `file`、也不清 `result`、更不发请求。所以拖入一个超大文件时,
 * 上一次选的文件与上一次的结果**都还留在界面上**,只是多了一条红框错误。
 * (判据 `30 * 1024 * 1024` 也照抄,不写成 `31457280`。)
 */
function onFile(f: File | null | undefined): void {
  if (!f) return
  if (f.size > 30 * 1024 * 1024) {
    error.value = t('aiKbPtTooBig')
    return
  }
  file.value = f
  error.value = null
  result.value = null
}

/** 蓝本 clearFile()(:193-197)—— 三清。 */
function clearFile(): void {
  file.value = null
  result.value = null
  error.value = null
}

/** 蓝本 resetParams()(:198-200)—— 回默认三值(与 data() 的初值逐字相同)。 */
function resetParams(): void {
  params.value = { target_tokens: 600, overlap_tokens: 80, min_tokens: 2 }
}

/**
 * 蓝本 submit()(:201-227)。
 * 🔴 FormData **九个字段的顺序与值逐字照抄**(蓝本 :208-215):
 *    file · query(**仅 `query` 非空时才 append**,空串不发)· embed(**恒 `'true'`**)·
 *    rerank(三元 `'true'`/`'false'`)· ocr(同)· target_tokens / overlap_tokens / min_tokens
 *    (三个都套 `String()`)。
 * 🔴 K27:`parserTestAnalyze(fd)` **单参** —— multipart 头与 120s 超时都在包里。
 * 🔴 K1:包内已剥一层,**没有 `.data`**。
 */
async function submit(): Promise<void> {
  if (!file.value) return
  loading.value = true
  error.value = null
  result.value = null
  try {
    const fd = new FormData()
    fd.append('file', file.value)
    if (query.value) fd.append('query', query.value)
    fd.append('embed', 'true')
    fd.append('rerank', rerank.value ? 'true' : 'false')
    fd.append('ocr', ocr.value ? 'true' : 'false')
    fd.append('target_tokens', String(params.value.target_tokens))
    fd.append('overlap_tokens', String(params.value.overlap_tokens))
    fd.append('min_tokens', String(params.value.min_tokens))
    result.value = (await service.ai.parserTestAnalyze(fd)) as AnalyzeResult
  } catch (e) {
    /* 🔴 蓝本 :222-223 的取值链**一字不改**。
     * 400 两种(越界 target_tokens / 不支持的扩展名)`detail` 是字符串 → 直接进 `.error-box`;
     * 422(不传 file)`detail` 是**数组** —— 但那条 UI 到不了(见文件头注释),
     * **不为它加数组分支**。`as string` 只是类型收口,不改运行时取值。 */
    const err = e as { response?: { data?: { detail?: unknown; error?: unknown } }; message?: string }
    const detail = err.response && err.response.data && (err.response.data.detail || err.response.data.error)
    error.value = (detail || err.message || String(e)) as string
  } finally {
    loading.value = false
  }
}

/** 蓝本 chunkText(chunkNo)(:228-231)—— 找不到就回空串。非空断言见文件头机械改写 4。 */
function chunkText(chunkNo: number): string {
  const c = result.value!.chunks.find((x) => x.chunk_no === chunkNo)
  return c ? c.text : ''
}

/** 蓝本 truncate(s, n)(:232-235)—— 严格 `> n` 才截(`= n` 原样返回),截断号 U+2026。 */
function truncate(s: string, n: number): string {
  if (!s) return ''
  return s.length > n ? s.slice(0, n) + '…' : s
}

/**
 * 蓝本 fmtBytes(n)(:236-240)—— 三档,边界都是 `<`(严格小于):
 * `< 1024` → `n + ' B'`(整数,不带小数)· `< 1024*1024` → `(n/1024).toFixed(1) + ' KB'` ·
 * 否则 `(n/1024/1024).toFixed(2) + ' MB'`。🔴 不加 `Intl`、不改档位、不统一小数位。
 */
function fmtBytes(n: number): string {
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
  return (n / 1024 / 1024).toFixed(2) + ' MB'
}
</script>

<template>
  <div class="parser-app">
    <!-- K31:外层 `.parser-app` = K22 滚动容器(height:100dvh + overflow-y:auto),
         内层 `.parser-test-page` = 蓝本的 900px 居中列。理由见文件头注释。
         ⚠️ 这条注释必须写在外层 div **内部**:写在 `<template>` 的第一个位置会让组件
         多一个注释根节点,VTU 的 `wrapper.element` 就不再是那个 div 了(T6 已踩过)。 -->
    <div class="parser-test-page">
      <!-- 页头(蓝本 :3-6)—— N16:`←` 在 t() 外面;本页标题**无 emoji** -->
      <header class="page-header">
        <h2>{{ t('aiKbPtTitle') }}</h2>
        <router-link to="/ai/parser" class="back-link">← {{ t('aiKbPtBackLink') }}</router-link>
      </header>

      <!-- help 卡(蓝本 :8-18)—— 两个 <code> 扩展名清单是技术标识符,不进 i18n(N22);
           `<strong>` 后那个逗号与段末那个句点都是模板里的裸标点,逐字照抄 -->
      <div class="card help-card">
        <p>
          {{ t('aiKbPtHelp1') }}
          <strong>{{ t('aiKbPtHelpNoWrite') }}</strong>, {{ t('aiKbPtHelpPreviewOnly') }}.
        </p>
        <p class="small">
          {{ t('aiKbPtSupports') }} <code>.md .txt .html .json .csv .py .go .ts .java</code>,
          {{ t('aiKbPtAsWellAs') }} <code>.pdf .docx .pptx .xlsx</code> {{ t('aiKbPtViaDocling') }}.
          {{ t('aiKbPtMaxSize') }}
        </p>
      </div>

      <!-- Upload + query input(蓝本 :20-93) -->
      <div class="card upload-card">
        <div class="dropzone"
             :class="{ active: dragActive, has: !!file }"
             @dragover.prevent="dragActive = true"
             @dragleave.prevent="dragActive = false"
             @drop.prevent="onDrop">
          <!-- K34-1/2:`files![0]` 与 `fileInput!.click()` 都是**保抛**写法 —— 只加类型层面的
               `as` / `!`,`files` 或 ref 为 null 时与蓝本抛同一个 TypeError(不用 `?.` 兜底) -->
          <input ref="fileInput" type="file" hidden
                 @change="onFile(($event.target as HTMLInputElement).files![0])" />
          <div v-if="!file">
            <button class="pick-btn" @click="fileInput!.click()">{{ t('aiKbPtChooseFile') }}</button>
            <span class="hint">{{ t('aiKbPtDragDrop') }}</span>
          </div>
          <div v-else class="file-meta">
            <strong>{{ file.name }}</strong>
            <span class="hint">{{ fmtBytes(file.size) }}</span>
            <!-- N16:`×`(U+00D7)在 t() 外面 -->
            <button class="clear-btn" @click="clearFile">×</button>
          </div>
        </div>

        <!-- 三个参数输入(蓝本 :39-53)—— N22:三个 <label> 的参数名是技术标识符,不进 i18n;
             `v-model.number` 照抄(不改成 `v-model` + 手工 Number()) -->
        <div class="row params-row">
          <label class="param">
            target_tokens
            <input type="number" min="50" max="4000" step="50" v-model.number="params.target_tokens" />
          </label>
          <label class="param">
            overlap_tokens
            <input type="number" min="0" max="400" step="10" v-model.number="params.overlap_tokens" />
          </label>
          <label class="param">
            min_tokens
            <input type="number" min="1" max="200" v-model.number="params.min_tokens" />
          </label>
          <button class="reset-btn" @click="resetParams" type="button">{{ t('aiKbPtReset') }}</button>
        </div>
        <div class="hint-line">
          {{ t('aiKbPtDefaults') }}
          <em>{{ t('aiKbPtOverlapNote') }}</em>
        </div>

        <div class="row">
          <input class="query-input"
                 v-model="query"
                 :placeholder="t('aiKbPtQueryPlaceholder')" />
          <!-- N22:`rerank top-20` 是技术标识符,不进 i18n -->
          <label class="checkbox">
            <input type="checkbox" v-model="rerank" />
            rerank top-20
          </label>
          <label class="checkbox">
            <input type="checkbox" v-model="ocr" />
            {{ t('aiKbPtOcr') }}
          </label>
        </div>

        <div class="row">
          <button class="submit-btn"
                  @click="submit"
                  :disabled="!file || loading">
            {{ loading ? t('aiKbPtProcessing') : t('aiKbPtRun') }}
          </button>
          <!-- ok-hint(蓝本 :79-89)—— N16:`✓` 与三个 `·`(U+00B7)在 t() 外面;
               N22:`chunks` / `chunker=` / `target=` / `overlap=` / `min=` 全不进 i18n。
               🔴 治理 §4.2 事实④:这里回显的是**后端回的 `params_used`**,不是前端传的 `params`
               (`.md` 走 markdown chunker 时 `overlap_tokens` 恒被改写成 0)。 -->
          <span v-if="result" class="ok-hint">
            ✓ {{ result.chunk_count }} chunks ·
            {{ fmtBytes(result.size) }} ·
            {{ result.mime }} ·
            <em v-if="result.params_used">
              chunker={{ result.params_used.chunker }},
              target={{ result.params_used.target_tokens }},
              overlap={{ result.params_used.overlap_tokens }},
              min={{ result.params_used.min_tokens }}
            </em>
          </span>
        </div>

        <div v-if="error" class="error-box">{{ error }}</div>
      </div>

      <!-- Results(蓝本 :95-150) -->
      <template v-if="result">
        <!-- Docling markdown preview (only when docling actually ran) —— 蓝本 :97-104。
             🔴 治理 §4.2 事实①:`.md`/`.txt` 不产生 `docling_markdown` → 本机这张卡不渲染。
             N16:`▼`/`▶` 在 t() 外面。 -->
        <div v-if="result.docling_markdown" class="card docling-card">
          <button class="toggle" @click="doclingOpen = !doclingOpen">
            {{ doclingOpen ? '▼' : '▶' }}
            {{ t('aiKbPtDoclingToggle', { n: result.docling_markdown.length }) }}
          </button>
          <pre v-show="doclingOpen" class="docling-md">{{ result.docling_markdown }}</pre>
        </div>

        <!-- Query scoring(蓝本 :106-124) -->
        <div v-if="result.scored && result.scored.length" class="card scored-card">
          <h3>{{ t('aiKbPtScoredTitle', { n: result.scored.length }) }}</h3>
          <!-- N22:`⚠ Reranker error:` 整串不进 i18n。治理 §4.2 事实③:本机 reranker 坏,
               勾 rerank 就一定看到这条 -->
          <div v-if="result.rerank_error" class="warn">
            ⚠ Reranker error: {{ result.rerank_error }}
          </div>
          <ul class="scored-list">
            <li v-for="s in result.scored" :key="s.chunk_no">
              <div class="rank-line">
                <!-- 🔴 N18:`indexOf(s) + 1` 当序号,照抄(不许换成 v-for 的下标 i + 1) -->
                <span class="rank-no">#{{ result.scored.indexOf(s) + 1 }}</span>
                <span class="score">cos {{ s.cos_sim.toFixed(3) }}</span>
                <!-- 🔴 治理 §4.2 事实②:`scored[]` 里没有 `rerank_score` → 这一格本机永不渲染 -->
                <span v-if="s.rerank_score !== undefined && s.rerank_score !== null"
                      class="rerank-score">rr {{ s.rerank_score.toFixed(3) }}</span>
                <span class="chunk-ref">chunk #{{ s.chunk_no }}</span>
              </div>
              <div class="rank-text">{{ truncate(chunkText(s.chunk_no), 200) }}</div>
            </li>
          </ul>
        </div>

        <!-- Chunks(蓝本 :126-149) -->
        <div class="card chunks-card">
          <h3>{{ t('aiKbPtChunksTitle', { n: result.chunk_count }) }}</h3>
          <div v-if="!result.chunks.length" class="empty">
            {{ t('aiKbPtZeroChunks') }}
          </div>
          <ul v-else class="chunk-list">
            <li v-for="c in result.chunks" :key="c.chunk_no" class="chunk-item">
              <div class="chunk-head">
                <strong>chunk #{{ c.chunk_no }}</strong>
                <span class="hint">{{ c.token_count }} tokens · offset {{ c.offset_start }}-{{ c.offset_end }}</span>
              </div>
              <pre class="chunk-text">{{ c.text }}</pre>
              <div v-if="c.dense_preview" class="emb-preview">
                <span class="emb-label">dense [0:8]:</span>
                <code>[{{ c.dense_preview.map(v => v.toFixed(4)).join(', ') }}, …]</code>
              </div>
              <!-- ⚠️ 蓝本 :145 的箭头函数参数就叫 `t`,在 `<script setup>` 里会**遮蔽**
                   i18n 的 `t` —— 这里不用 i18n,遮蔽无害,Vue 编译器的作用域跟踪
                   (`walkIdentifiers`)会把它解析成参数而不是 `$setup.t`。
                   逐字照抄(改名 = 与需求无关的顺手改动);下面有专门用例证明渲染正确。 -->
              <div v-if="c.sparse_top_terms && c.sparse_top_terms.length" class="emb-preview">
                <span class="emb-label">sparse top:</span>
                <code>{{ c.sparse_top_terms.map(t => `${t.token_id}:${t.weight}`).join(' · ') }}</code>
              </div>
            </li>
          </ul>
        </div>
      </template>
    </div>
  </div>
</template>
