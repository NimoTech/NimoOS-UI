// SP8-P5c Task 7 —— `ParserTest.vue`(Parser 测试沙盒)的组件测试。
// 蓝本 `NimoOS-UI` (main@7a6ee6b7) `src/views/AI/Parser/ParserTest.vue`(369 行;
// 本刀只覆盖 template `:1-152` + script `:154-243`,`<style>` `:245-369` 归 T2b)。
//
// ═══ mock 策略(治理 §4.1 要求显式说明)═══
// 本页**不用任何 store**(蓝本 data() 的 10 项全是页面级瞬态)→ 唯一要 mock 的是共享包的
// `service.ai.parserTestAnalyze`。🔴 它在包里只 `return res.data`
// (`NimoOS-Service/src/ai.ts:673-680`,零转换)→ 这里一律 mock 成 **HTTP 原样
// snake_case**,就是 fixture 原文。**与 `ParserStatus.test.ts` / `parserStore.test.ts` /
// `knowledgeStore.parser.test.ts` 里 `service.ai.parser*` 的形状口径逐字一致**
// (治理 §4.1 的 red flag 自查:同一层的方法在不同测试文件里被 mock 成不同形状 = 定时炸弹)。
// 失败侧用 `mockRejectedValue` 造带 `response.data.detail` 的错误对象,形状照四份
// `.http` fixture 里的**真实响应体**。
//
// ═══ fixture 是抄本,不是运行时读(治理 §4.4)═══
// 6 份数据逐字抄进下面的 `FIXTURE-COPY-BEGIN/END` 块并注明出处,**不用 `node:fs` 读
// `.superpowers/`** —— 那个目录被 gitignore 盖着(SP7 整个丢过一次),本分支将来要合
// master,`src/` 下的测试跨界依赖它会以「找不到文件」的形式神秘挂掉。
// 🔴 抄本由一次性脚本从 fixture 直接生成(零人工转写),等价性由**程序化逐字节校验**
// 确认(脚本与输出贴在 T7 报告 §5)—— 不是肉眼比。
// 读 `.vue` 源文件(守卫缺口③ 与 N22 那几条)仍一律 `node:fs`,**不许用 Vite 的 `?raw`**
//   (vitest 的 CSSEnablerPlugin 会把样式源换成空串 → 断言对空字符串「假通过」;
//    先例 `knowledgeStyles.test.ts` 头注释③)。
//
// 🔴 **第 6 份(422)只抄在注释里,不建常量、不写用例** —— 见文件末尾 `describe`
//    前的「422 为什么不测」说明。抄本(逐字,取自
//    `p5c-fixtures/parser-test-analyze-422-no-file.http` 的响应体):
//        {"detail":[{"type":"missing","loc":["body","file"],"msg":"Field required","input":null}]}
//    🔴 `detail` 是**数组**(FastAPI 校验错误),与两条 400 的字符串 `detail` 契约不一致
//    (治理 §8.2 已记后端票)。**但 UI 到不了这个分支**:提交按钮
//    `:disabled="!file || loading"`(蓝本 :76)挡住「没选文件就提交」,`submit()` 开头
//    `if (!this.file) return`(:202)再挡一道 → 治理 §4.2 / §5.1 明令:
//    **照抄取值链、不加数组分支、也不为它写单测**(测一条 UI 到不了的路径 = 空转)。
//
// ═══ 断言口径(治理 §9)═══
// `:disabled` 是**布尔属性**:为真时 Vue 渲染 `disabled=""`、为假时属性整个缺席 →
// `attributes('disabled')` 的假侧只能是 `undefined`,而治理 §9 **禁 `toBeUndefined()`**。
// 故一律断言 **DOM 属性**(`el.disabled`),它天然是 `true`/`false` 两个可比值,两侧都比。
// 其余文本/href/class 直接比字符串。多行模板的 `text()` 用 `sq()` 归一空白后逐字比。
// 🔴 否定式断言(`not.toContain` / `not.toMatch`)一律先 `blankComments()` 剥注释
// (治理 §9 第九条:否定式撞注释 = **假报红**,会诱使去"修"一个没坏的东西 —— 本文件
//  头注释里就有 `service.ai.parserTestAnalyze(fd)` / `rerank top-20` 等字样),
// 且钉「**调用形状**」而不是裸标识符。剥注释用**保行版**(把注释换成等量空格、保留换行),
// 治理 §9 第八条。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import { i18n } from '../../../i18n'
import zhCn from '../../../i18n/zh_cn'
import enUs from '../../../i18n/en_us'
import ParserTest from './ParserTest.vue'
// @ts-expect-error -- 本仓未装 @types/node,node:fs 无类型声明
import { readFileSync } from 'node:fs'
// @ts-expect-error -- 本仓未装 @types/node,node:path 无类型声明
import { resolve, dirname } from 'node:path'
// @ts-expect-error -- 本仓未装 @types/node,node:url 无类型声明
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── vi.hoisted mock 骨架(治理 §9:避免 ESM 提升 TDZ)──
const ai = vi.hoisted(() => ({
  parserTestAnalyze: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai } }))

// ═══════════════════════════════════════════════════════════════════════════
// FIXTURE-COPY-BEGIN  p5c-fixtures/parser-test-analyze-md-ok.json  (整份)
// 取自 `.superpowers/sdd/p5c-fixtures/parser-test-analyze-md-ok.json`(2026-08-03 真机抓取,
// `POST /v1/parser/test/analyze`,`.md` + query=probe + rerank=false)。
// 🔴 治理 §4.2 的四条实测事实全在这一份里:
//   ① **无 `docling_markdown`**(.md 不走 docling)→ docling 卡整块不渲染
//   ② `scored[0]` 只有 `{chunk_no, cos_sim}`,**无 `rerank_score`** → `rr {…}` 不渲染
//   ④ 传的是 `overlap_tokens=80`,后端按 `chunker:"markdown"` **回 0** → ok-hint 回显 0
const MD_OK = {
  "mime": "text/markdown",
  "filename": "p5c-probe.md",
  "size": 50,
  "text_length": 50,
  "chunk_count": 1,
  "chunks": [
    {"chunk_no":0,"text":"Sandbox probe A.\n\nSecond paragraph for chunk two.","token_count":12,"offset_start":0,"offset_end":50,"dense_preview":[-0.0309,0.0237,0.003,-0.0038,-0.0316,-0.0135,0.0212,0.0347],"sparse_top_terms":[{"token_id":151268,"weight":0.2153},{"token_id":11728,"weight":0.2056},{"token_id":6626,"weight":0.1726},{"token_id":7839,"weight":0.1494},{"token_id":77648,"weight":0.1463}]}
  ],
  "params_used": {"target_tokens":600,"overlap_tokens":0,"min_tokens":2,"chunker":"markdown"},
  "query": "probe",
  "scored": [
    {"chunk_no":0,"cos_sim":0.5082847161344183}
  ]
}
// FIXTURE-COPY-END

// FIXTURE-COPY-BEGIN  p5c-fixtures/parser-test-analyze-txt-rerank.json  (整份)
// 取自 `.superpowers/sdd/p5c-fixtures/parser-test-analyze-txt-rerank.json`(2026-08-03,
// `.txt` + query=vector search + **rerank=true**)。
// 🔴 事实③:本机 reranker 是坏的 → `rerank_error` 恒有、`scored[0]` **仍无 `rerank_score`**
//   (后端缺陷,治理 §8.2 已记票,本期照抄前端、不修、不绕)。
// 🔴 事实④ 的另一半:`chunker:"plain"` → `overlap_tokens` **原样回 10**。
const TXT_RERANK = {
  "mime": "text/plain",
  "filename": "p5c-probe.txt",
  "size": 196,
  "text_length": 196,
  "chunk_count": 1,
  "chunks": [
    {"chunk_no":0,"text":"Alpha beta gamma delta epsilon. Zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau upsilon phi chi psi omega.\nSecond line about vector search and embeddings for the sandbox probe.","token_count":48,"offset_start":0,"offset_end":196,"dense_preview":[-0.0584,-0.0225,-0.0411,0.0148,0.0028,-0.0604,0.0148,0.0051],"sparse_top_terms":[{"token_id":87506,"weight":0.2414},{"token_id":11728,"weight":0.2239},{"token_id":4759,"weight":0.2124},{"token_id":40703,"weight":0.2122},{"token_id":99245,"weight":0.2056}]}
  ],
  "params_used": {"target_tokens":50,"overlap_tokens":10,"min_tokens":2,"chunker":"plain"},
  "rerank_error": "XLMRobertaTokenizer has no attribute prepare_for_model",
  "query": "vector search",
  "scored": [
    {"chunk_no":0,"cos_sim":0.5408997321381046}
  ]
}
// FIXTURE-COPY-END

// FIXTURE-COPY-BEGIN  p5c-fixtures/parser-test-analyze-200-empty-file.http  (响应体)
// 取自 `.superpowers/sdd/p5c-fixtures/parser-test-analyze-200-empty-file.http`(2026-08-03,
// 传一个 0 字节的 `.md`)。🔴 **HTTP 200**(不是错误)+ `chunk_count:0` / `chunks:[]` /
// **无 `query`、无 `scored`** → 走蓝本 :129 的 `.empty` 空态。治理 §13:**真机可验** ✅
const EMPTY_200 = {
  "mime": "text/markdown",
  "filename": "p5c-empty.md",
  "size": 0,
  "text_length": 0,
  "chunk_count": 0,
  "chunks": [],
  "params_used": {"target_tokens":600,"overlap_tokens":0,"min_tokens":2,"chunker":"markdown"}
}
// FIXTURE-COPY-END

// FIXTURE-COPY-BEGIN  p5c-fixtures/parser-test-analyze-400-target-tokens.http  (响应体)
// 取自 `…-400-target-tokens.http`(2026-08-03,`target_tokens=1` 越界)。HTTP **400**,
// `detail` 是**字符串** → 蓝本 :222 的取值链取到它,进 `.error-box`。
const ERR_400_TARGET = {
  "detail": "target_tokens must be in [50, 4000]"
}
// FIXTURE-COPY-END

// FIXTURE-COPY-BEGIN  p5c-fixtures/parser-test-analyze-400-bad-ext.http  (响应体)
// 取自 `…-400-bad-ext.http`(2026-08-03,传 `.bin`)。HTTP **400**,`detail` 是字符串。
const ERR_400_EXT = {
  "detail": "extension '.bin' not supported in test sandbox; use .md / source code / .txt / .html / .json / .csv / .log / .pdf / .docx / .pptx / .xlsx"
}
// FIXTURE-COPY-END
// ═══════════════════════════════════════════════════════════════════════════

/** 归一多行模板的空白(Vue 的 condense 已把换行压成单空格,`text()` 仍可能留下缩进)。 */
function sq(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

/**
 * 「保行版」剥注释(治理 §9 第八条):把注释内容换成等量空格,**保留所有换行**
 * —— 删除式剥离会把换行也吃掉,让报出来的行号偏移几十行。
 * 覆盖 `<!-- -->`(模板)与 `/* *​/`(script);本文件对应的 `.vue` 里没有 `//` 行注释,
 * 故不处理 `//`(处理它需要区分字符串内的 `//`,得不偿失)。
 */
function blankComments(src: string): string {
  return src.replace(/<!--[\s\S]*?-->|\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
}

function readSrc(): string {
  return readFileSync(resolve(__dirname, './ParserTest.vue'), 'utf8')
}

/** 造一个指定 size 的 File(jsdom 的 `File.size` 只读 → 用 defineProperty 覆写)。 */
function makeFile(name: string, size: number, type = 'text/markdown'): File {
  const f = new File(['x'], name, { type })
  Object.defineProperty(f, 'size', { value: size, configurable: true })
  return f
}

function makeRouter() {
  const router = createRouter({
    history: createWebHashHistory('/app/'),
    routes: [
      { path: '/ai/parser/test', name: 'AIParserTest', component: ParserTest },
      // 蓝本 `:5` 的 `router-link to="/ai/parser"` 需要目标路由存在才能解析出 href。
      // 【订正,SP8-P5d Task 9,治理 §15.2 / 计划书 §T9 第 6 条】上一条注释已过期:
      // 生产里这两条 parser 顶层路由早已反转成真正的 ParserStatus/ParserTest
      // (P5c-T10 的产出,knowledgeRoutes.ts 头注释有完整记录),不再指占位页。
      // 这里的 stub 组件只是本测试文件自己路由表里的占位,与生产路由是否占位
      // 无关——保留 stub 是因为本文件只关心 href 能否解析出来。
      { path: '/ai/parser', name: 'AIParser', component: { template: '<div />' } },
    ],
  })
  router.push('/ai/parser/test')
  return router
}

const mountedWrappers: Array<ReturnType<typeof mount>> = []

async function mountPage() {
  const router = makeRouter()
  await router.isReady()
  const w = mount(ParserTest, { global: { plugins: [router, i18n] } } as never)
  mountedWrappers.push(w)
  return w
}

type W = Awaited<ReturnType<typeof mountPage>>

/** 走真实的 `<input type="file">` change 路径(而不是直接调组件方法)。 */
async function pickFile(w: W, f: File): Promise<void> {
  const input = w.find('input[type="file"]')
  Object.defineProperty(input.element, 'files', { value: [f], configurable: true })
  await input.trigger('change')
  await nextTick()
}

/** 选好文件 → 点提交 → 等落地。 */
async function runWith(w: W, f = makeFile('p5c-probe.md', 50)): Promise<void> {
  await pickFile(w, f)
  await w.find('.submit-btn').trigger('click')
  await flushPromises()
  await nextTick()
}

/** 取本次调用的 FormData,并把 File 值换成可比字符串。 */
function lastFormEntries(): Array<[string, string]> {
  const calls = ai.parserTestAnalyze.mock.calls
  const fd = calls[calls.length - 1]![0] as FormData
  return Array.from(fd.entries()).map(([k, v]) => [
    k,
    typeof v === 'string' ? v : `File(${(v as File).name},${(v as File).size})`,
  ]) as Array<[string, string]>
}

/** 造一个「axios 风格」的 HTTP 错误(带 `response.data`),形状照 `.http` fixture。 */
function httpError(status: number, data: unknown, message = `Request failed with status code ${status}`) {
  return Object.assign(new Error(message), { response: { status, data } })
}

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

beforeEach(() => {
  vi.clearAllMocks()
  ai.parserTestAnalyze.mockResolvedValue(MD_OK)
})

afterEach(() => {
  while (mountedWrappers.length) mountedWrappers.pop()!.unmount()
  document.body.innerHTML = ''
})

// ═══════════════════════════════════════════════════════════════════════════
describe('ParserTest —— K31 两层根元素(滚动容器 + 900px 居中列)', () => {
  // 🔴 治理 §3 K31:`.parser-app` 是**外层包裹**、页面根类 `.parser-test-page` 在**内层**。
  // 压成同一个元素会让 `overflow-y:auto` 的滚动条落在那条 900px 居中列的右缘
  // (宽屏上约在屏幕中间),而 Vue2 是整页滚动、滚动条在视口最右缘 = 用户可见的界面不 1:1。
  // ⚠️ 计划书 T7 节仍写着 K31 之前的单元素写法(治理 §12.3 E-14 同族),已被 K31 覆盖。
  // 判据:把两个类写回同一个元素 → 本组两条必须报红。
  it('根元素只有 .parser-app(不带 .parser-test-page)', async () => {
    const w = await mountPage()
    const root = w.element as HTMLElement
    expect(root.tagName).toBe('DIV')
    expect(root.className).toBe('parser-app')
    expect(root.classList.contains('parser-test-page')).toBe(false)
  })

  it('.parser-test-page 是 .parser-app 的直接子元素,且两者各恰好一个', async () => {
    const w = await mountPage()
    expect(w.findAll('.parser-app')).toHaveLength(1)
    expect(w.findAll('.parser-test-page')).toHaveLength(1)
    expect(w.find('.parser-app > .parser-test-page').exists()).toBe(true)
    // 页面内容真的在内层里(不是空壳)
    expect(w.find('.parser-test-page > .page-header').exists()).toBe(true)
    expect(w.find('.parser-test-page > .upload-card').exists()).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('ParserTest —— 页头 + help 卡(蓝本 :3-18)', () => {
  it('标题逐字、返回链接 `← 返回详情` 含 href(N16:`←` 在 t() 外面;本页标题无 emoji)', async () => {
    const w = await mountPage()
    expect(w.find('.page-header h2').text()).toBe('Parser 测试沙盒')
    const link = w.find('a.back-link')
    expect(link.text()).toBe('← 返回详情')
    // hash 路由:jsdom 里解析出的 href 是纯 hash(生产是 `…/app/#/ai/parser`)
    expect(link.attributes('href')).toBe('#/ai/parser')
    // 🔴 brief §4.3 说本页标题带 `🧪` —— 回源核实是错的(E-15):`🧪` 在
    //    `ParserStatus.vue:6` 与 `SettingsView.vue:162`,本页 h2 是纯译文。
    expect(w.find('.page-header').text()).not.toContain('🧪')
  })

  it('help 卡第一段:三个键 + `<strong>` 后的裸逗号 + 段末裸句点', async () => {
    const w = await mountPage()
    const ps = w.findAll('.help-card p')
    expect(ps).toHaveLength(2)
    expect(sq(ps[0]!.text())).toBe(
      '上传一个文件，看 Parser 怎么处理它（切块 + 嵌入 + 评分）。 不会写入索引, 纯预览.',
    )
    expect(ps[0]!.find('strong').text()).toBe('不会写入索引')
  })

  it('help 卡第二段:两个 <code> 扩展名清单是技术标识符(N22),不进 i18n', async () => {
    const w = await mountPage()
    const p = w.findAll('.help-card p')[1]!
    expect(p.classes()).toContain('small')
    const codes = p.findAll('code')
    expect(codes).toHaveLength(2)
    expect(codes[0]!.text()).toBe('.md .txt .html .json .csv .py .go .ts .java')
    expect(codes[1]!.text()).toBe('.pdf .docx .pptx .xlsx')
    expect(sq(p.text())).toBe(
      '支持 .md .txt .html .json .csv .py .go .ts .java, 以及 .pdf .docx .pptx .xlsx （经 docling 转 markdown）. ' +
        '最大 30 MB。PDF 首次会触发模型权重下载（~200 MB，一次性）。',
    )
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('ParserTest —— 拖放区三态 + dragActive 类切换(蓝本 :22-26)', () => {
  it('dragover 加 .active、dragleave 去掉(`:class="{ active: dragActive }"`)', async () => {
    const w = await mountPage()
    const dz = w.find('.dropzone')
    expect(dz.classes()).not.toContain('active')
    await dz.trigger('dragover')
    expect(w.find('.dropzone').classes()).toContain('active')
    await dz.trigger('dragleave')
    expect(w.find('.dropzone').classes()).not.toContain('active')
  })

  it('drop:先关高亮,再取 dataTransfer.files[0] 交给 onFile(蓝本 onDrop :178-182)', async () => {
    const w = await mountPage()
    const dz = w.find('.dropzone')
    await dz.trigger('dragover')
    expect(w.find('.dropzone').classes()).toContain('active')

    await dz.trigger('drop', { dataTransfer: { files: [makeFile('dropped.md', 1234)] } })
    await nextTick()
    expect(w.find('.dropzone').classes()).not.toContain('active')
    // 文件真的进去了 → 走 v-else 的 .file-meta 分支
    expect(w.find('.file-meta strong').text()).toBe('dropped.md')
  })

  it('drop 但 files 为空 → `if (f) onFile(f)` 不触发,仍是未选文件态', async () => {
    const w = await mountPage()
    await w.find('.dropzone').trigger('drop', { dataTransfer: { files: [] } })
    await nextTick()
    expect(w.find('.file-meta').exists()).toBe(false)
    expect(w.find('.pick-btn').exists()).toBe(true)
  })

  it('`has` 类跟着 `!!file` 走(未选无、选了有)', async () => {
    const w = await mountPage()
    expect(w.find('.dropzone').classes()).not.toContain('has')
    await pickFile(w, makeFile('a.md', 10))
    expect(w.find('.dropzone').classes()).toContain('has')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('ParserTest —— 选文件 / 清除(蓝本 :27-37 / :183-197)', () => {
  it('未选文件:pick-btn + hint;点 pick-btn 转发到隐藏 input 的 click()', async () => {
    const w = await mountPage()
    expect(w.find('.pick-btn').text()).toBe('选择文件')
    expect(w.find('.dropzone .hint').text()).toBe('或拖拽到此处')
    const input = w.find('input[type="file"]').element as HTMLInputElement
    const click = vi.spyOn(input, 'click').mockImplementation(() => {})
    await w.find('.pick-btn').trigger('click')
    expect(click).toHaveBeenCalledTimes(1)
    click.mockRestore()
  })

  it('选了文件:file-meta 显示名字 + fmtBytes(size) + × 清除按钮(N16:`×` 在 t() 外面)', async () => {
    const w = await mountPage()
    await pickFile(w, makeFile('p5c-probe.md', 50))
    expect(w.find('.pick-btn').exists()).toBe(false)
    expect(w.find('.file-meta strong').text()).toBe('p5c-probe.md')
    expect(w.find('.file-meta .hint').text()).toBe('50 B')
    expect(w.find('.clear-btn').text()).toBe('×')
  })

  it('clearFile 三清:file / result / error 全清(蓝本 :193-197)', async () => {
    const w = await mountPage()
    await runWith(w) // 先跑出一份 result
    expect(w.find('.chunks-card').exists()).toBe(true)
    // 再造一条 error 出来(第二次提交失败)
    ai.parserTestAnalyze.mockRejectedValueOnce(httpError(400, ERR_400_TARGET))
    await w.find('.submit-btn').trigger('click')
    await flushPromises()
    await nextTick()
    expect(w.find('.error-box').exists()).toBe(true)

    await w.find('.clear-btn').trigger('click')
    await nextTick()
    expect(w.find('.file-meta').exists()).toBe(false) // file 清了
    expect(w.find('.chunks-card').exists()).toBe(false) // result 清了
    expect(w.find('.error-box').exists()).toBe(false) // error 清了
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('ParserTest —— 🔴 30 MB 前端拦:只设 error,不清 file、不发请求(蓝本 :185-188)', () => {
  // 判据:把 `return` 之前改成"顺手清掉 file"→ 本组第一条必须报红。
  it('恰好 30 MB(=30*1024*1024)不拦 —— 边界是严格 `>`', async () => {
    const w = await mountPage()
    await pickFile(w, makeFile('exactly30.md', 30 * 1024 * 1024))
    expect(w.find('.file-meta strong').text()).toBe('exactly30.md')
    expect(w.find('.error-box').exists()).toBe(false)
  })

  it('🔴 超一字节就拦:出错误框、**已选文件与已有结果都不动**、零请求', async () => {
    const w = await mountPage()
    // 先选一个正常文件并跑出结果
    await runWith(w, makeFile('good.md', 50))
    expect(w.find('.chunks-card').exists()).toBe(true)
    expect(ai.parserTestAnalyze).toHaveBeenCalledTimes(1)

    await pickFile(w, makeFile('huge.bin', 30 * 1024 * 1024 + 1))
    expect(w.find('.error-box').text()).toBe('文件超过 30 MB，沙盒不支持')
    // 🔴 蓝本只 `return`:file 没被清、result 也没被清
    expect(w.find('.file-meta strong').text()).toBe('good.md')
    expect(w.find('.chunks-card').exists()).toBe(true)
    // 🔴 没发第二次请求
    expect(ai.parserTestAnalyze).toHaveBeenCalledTimes(1)
  })

  it('拖入超大文件同样被拦(onDrop → onFile 同一条路)', async () => {
    const w = await mountPage()
    await w
      .find('.dropzone')
      .trigger('drop', { dataTransfer: { files: [makeFile('huge.md', 40 * 1024 * 1024)] } })
    await nextTick()
    expect(w.find('.error-box').text()).toBe('文件超过 30 MB，沙盒不支持')
    expect(w.find('.file-meta').exists()).toBe(false)
    expect(ai.parserTestAnalyze).not.toHaveBeenCalled()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('ParserTest —— 三个参数输入 + resetParams(蓝本 :39-53 / :198-200)', () => {
  it('三个 <label> 的参数名是技术标识符(N22),input 的 min/max/step 逐字照抄', async () => {
    const w = await mountPage()
    const labels = w.findAll('.params-row .param')
    expect(labels).toHaveLength(3)
    expect(labels.map((l) => sq(l.text()))).toEqual(['target_tokens', 'overlap_tokens', 'min_tokens'])
    const attrs = labels.map((l) => {
      const el = l.find('input').element as HTMLInputElement
      return [el.type, el.getAttribute('min'), el.getAttribute('max'), el.getAttribute('step')]
    })
    expect(attrs).toEqual([
      ['number', '50', '4000', '50'],
      ['number', '0', '400', '10'],
      ['number', '1', '200', null], // min_tokens 蓝本没有 step
    ])
  })

  it('默认值 600 / 80 / 2', async () => {
    const w = await mountPage()
    expect(w.findAll('.params-row .param input').map((i) => (i.element as HTMLInputElement).value)).toEqual([
      '600',
      '80',
      '2',
    ])
  })

  it('🔴 `v-model.number` 三个都真的转成 number(载荷里是 `String(700)` 而不是 `"700"` 的原字符串路径)', async () => {
    const w = await mountPage()
    const ins = w.findAll('.params-row .param input')
    await ins[0]!.setValue('700')
    await ins[1]!.setValue('120')
    await ins[2]!.setValue('5')
    await runWith(w)
    const e = Object.fromEntries(lastFormEntries())
    expect(e.target_tokens).toBe('700')
    expect(e.overlap_tokens).toBe('120')
    expect(e.min_tokens).toBe('5')
    // 🔴 判别力从哪来:整数输入下 `.number` 与裸 `v-model` 的载荷**完全一样**
    // (`String(700)` 与 `String('700')` 都是 `'700'`)→ 那种断言零判别力。
    // 用**带尾随零的小数**才分得开:`.number` 走 `looseToNumber('600.50')` → 数值 600.5
    // → `String(600.5)` = `'600.5'`;裸 `v-model` 会原样带走字符串 `'600.50'`。
    // 判据:把三处 `.number` 去掉 → 本条报红。
    await ins[0]!.setValue('600.50')
    await w.find('.submit-btn').trigger('click')
    await flushPromises()
    expect(Object.fromEntries(lastFormEntries()).target_tokens).toBe('600.5')
    // 源码形状也钉一遍(治理 §9 第九条:钉调用形状)
    const src = blankComments(readSrc())
    expect(src).toContain('v-model.number="params.target_tokens"')
    expect(src).toContain('v-model.number="params.overlap_tokens"')
    expect(src).toContain('v-model.number="params.min_tokens"')
  })

  it('resetParams 回 600 / 80 / 2(蓝本是整体重新赋值一个新对象)', async () => {
    const w = await mountPage()
    const ins = w.findAll('.params-row .param input')
    await ins[0]!.setValue('123')
    await ins[1]!.setValue('45')
    await ins[2]!.setValue('6')
    expect(w.findAll('.params-row .param input').map((i) => (i.element as HTMLInputElement).value)).toEqual([
      '123',
      '45',
      '6',
    ])
    expect(w.find('.reset-btn').text()).toBe('重置')
    expect((w.find('.reset-btn').element as HTMLButtonElement).type).toBe('button')
    await w.find('.reset-btn').trigger('click')
    await nextTick()
    expect(w.findAll('.params-row .param input').map((i) => (i.element as HTMLInputElement).value)).toEqual([
      '600',
      '80',
      '2',
    ])
  })

  it('hint-line 两句:默认值说明 + `<em>` 里的 overlap 提示(N21 那条 `5–20` 用 U+2013)', async () => {
    const w = await mountPage()
    const line = w.find('.hint-line')
    expect(sq(line.text())).toBe(
      '默认 target=600, overlap=80, min=2（沙盒宽松值；生产用 600/80/5–20）。 ' +
        'overlap 只对 plain 文本生效；markdown/source 按段落或函数边界切。',
    )
    expect(line.find('em').text()).toBe(
      'overlap 只对 plain 文本生效；markdown/source 按段落或函数边界切。',
    )
    // U+2013(EN DASH)不是 ASCII `-` —— 附录 A §A.2 明令逐码点照抄
    expect((zhCn as Record<string, string>).aiKbPtDefaults).toContain('5–20')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('ParserTest —— query / rerank / OCR 三个输入(蓝本 :59-71)', () => {
  it('query 输入框的 placeholder 走 i18n;rerank 标签是硬编码 `rerank top-20`(N22)', async () => {
    const w = await mountPage()
    expect(w.find('.query-input').attributes('placeholder')).toBe(
      '（可选）输入 query，会计算每个 chunk 的余弦相似度',
    )
    const boxes = w.findAll('.row .checkbox')
    expect(boxes).toHaveLength(2)
    expect(sq(boxes[0]!.text())).toBe('rerank top-20')
    expect(sq(boxes[1]!.text())).toBe('OCR（扫描 PDF）')
  })

  it('两个勾选框默认都是 false', async () => {
    const w = await mountPage()
    const els = w.findAll('.row .checkbox input').map((n) => n.element as HTMLInputElement)
    expect(els.map((e) => e.checked)).toEqual([false, false])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('ParserTest —— 🔴 K27 / K1 / FormData 九字段(蓝本 :201-227)', () => {
  it('🔴 K27:`parserTestAnalyze(fd)` **单参**调用 —— 调用方不再传 headers/timeout', async () => {
    const w = await mountPage()
    await runWith(w)
    expect(ai.parserTestAnalyze).toHaveBeenCalledTimes(1)
    // 实参个数恰好 1:包里已带 multipart 头 + 单独 120s 超时(`ai.ts:673-680`)
    expect(ai.parserTestAnalyze.mock.calls[0]).toHaveLength(1)
    expect(ai.parserTestAnalyze.mock.calls[0]![0]).toBeInstanceOf(FormData)
    // 源码层面钉住「调用形状」(治理 §9 第九条:钉形状不钉裸标识符),先剥注释
    const src = blankComments(readSrc())
    expect(src).toContain('result.value = (await service.ai.parserTestAnalyze(fd)) as AnalyzeResult')
    // 🔴 K1:没有 `.data` 那一层(包内已 `return res.data`)
    expect(src).not.toMatch(/parserTestAnalyze\([^)]*\)\s*\)?\s*\.data/)
    // 🔴 没有第二个实参(headers / timeout 都在包里)
    expect(src).not.toMatch(/parserTestAnalyze\(\s*fd\s*,/)
    expect(src).not.toContain("'Content-Type': 'multipart/form-data'")
    expect(src).not.toContain('timeout: 120000')
  })

  it('🔴 K1 的渲染侧证据:mock 直接返回 fixture(无信封)时整页正常渲染', async () => {
    // 判据:若代码多剥一层 `.data`,`result` 会是 undefined → 下面每一格都拿不到值。
    const w = await mountPage()
    await runWith(w)
    expect(w.find('.ok-hint').exists()).toBe(true)
    expect(w.find('.chunks-card h3').text()).toBe('切块结果（1 块）')
  })

  it('🔴 FormData 九个字段的**顺序与值**逐字照抄(query 非空时)', async () => {
    const w = await mountPage()
    await w.find('.query-input').setValue('probe')
    await runWith(w, makeFile('p5c-probe.md', 50))
    expect(lastFormEntries()).toEqual([
      ['file', 'File(p5c-probe.md,50)'],
      ['query', 'probe'],
      ['embed', 'true'], // 🔴 恒 'true'(蓝本 :210 是字面量,不跟任何开关)
      ['rerank', 'false'],
      ['ocr', 'false'],
      ['target_tokens', '600'],
      ['overlap_tokens', '80'],
      ['min_tokens', '2'],
    ])
  })

  it('🔴 query 为空时**确实没有 `query` 这个字段**(蓝本 :209 是有条件 append)', async () => {
    // 判据:把 `if (query) fd.append(...)` 改成无条件 append → 本条必须报红。
    const w = await mountPage()
    await runWith(w)
    const entries = lastFormEntries()
    expect(entries.map(([k]) => k)).toEqual([
      'file',
      'embed',
      'rerank',
      'ocr',
      'target_tokens',
      'overlap_tokens',
      'min_tokens',
    ])
    expect(entries.map(([k]) => k)).not.toContain('query')
    const fd = ai.parserTestAnalyze.mock.calls[0]![0] as FormData
    expect(fd.getAll('query')).toEqual([])
    expect(fd.has('query')).toBe(false)
    // 其余八项里的八分之七仍在(顺序没被打乱)
    expect(entries[0]![0]).toBe('file')
    expect(entries[1]![0]).toBe('embed')
  })

  it('rerank 勾上 → `rerank=\'true\'`,ocr 仍 `\'false\'`(三元两侧之一)', async () => {
    const w = await mountPage()
    await w.findAll('.row .checkbox input')[0]!.setValue(true)
    await runWith(w)
    const e = Object.fromEntries(lastFormEntries())
    expect(e.rerank).toBe('true')
    expect(e.ocr).toBe('false')
  })

  it('ocr 勾上 → `ocr=\'true\'`,rerank 仍 `\'false\'`(三元两侧之二)', async () => {
    const w = await mountPage()
    await w.findAll('.row .checkbox input')[1]!.setValue(true)
    await runWith(w)
    const e = Object.fromEntries(lastFormEntries())
    expect(e.rerank).toBe('false')
    expect(e.ocr).toBe('true')
  })

  it('两个都勾 → 都是 `\'true\'`;`embed` 永远是 `\'true\'`,不受任何开关影响', async () => {
    const w = await mountPage()
    await w.findAll('.row .checkbox input')[0]!.setValue(true)
    await w.findAll('.row .checkbox input')[1]!.setValue(true)
    await runWith(w)
    const e = Object.fromEntries(lastFormEntries())
    expect(e.rerank).toBe('true')
    expect(e.ocr).toBe('true')
    expect(e.embed).toBe('true')
  })

  it('提交前先清 error 与 result(蓝本 :204-205)', async () => {
    const w = await mountPage()
    ai.parserTestAnalyze.mockRejectedValueOnce(httpError(400, ERR_400_TARGET))
    await runWith(w)
    expect(w.find('.error-box').exists()).toBe(true)
    // 第二次成功 → 错误框消失、结果出现
    ai.parserTestAnalyze.mockResolvedValue(MD_OK)
    await w.find('.submit-btn').trigger('click')
    await flushPromises()
    await nextTick()
    expect(w.find('.error-box').exists()).toBe(false)
    expect(w.find('.chunks-card').exists()).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('ParserTest —— 提交按钮 :disabled 两侧 + loading 文案(蓝本 :74-78)', () => {
  it('未选文件 → 按钮禁用、文案「运行」(`:disabled="!file || loading"` 的前半)', async () => {
    const w = await mountPage()
    const btn = w.find('.submit-btn')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
    expect(btn.text()).toBe('运行')
  })

  it('选了文件 → 解禁', async () => {
    const w = await mountPage()
    await pickFile(w, makeFile('a.md', 10))
    expect((w.find('.submit-btn').element as HTMLButtonElement).disabled).toBe(false)
  })

  it('🔴 在飞时 → 禁用 + 文案「处理中…」(`|| loading` 后半);落地后解禁并回「运行」', async () => {
    const w = await mountPage()
    const d = deferred<unknown>()
    ai.parserTestAnalyze.mockReturnValue(d.promise)
    await pickFile(w, makeFile('a.md', 10))
    await w.find('.submit-btn').trigger('click')
    await nextTick()
    expect((w.find('.submit-btn').element as HTMLButtonElement).disabled).toBe(true)
    expect(w.find('.submit-btn').text()).toBe('处理中…')

    d.resolve(MD_OK)
    await flushPromises()
    await nextTick()
    expect((w.find('.submit-btn').element as HTMLButtonElement).disabled).toBe(false)
    expect(w.find('.submit-btn').text()).toBe('运行')
  })

  it('`submit()` 开头的 `if (!file) return` 守卫:直接调用不发请求', async () => {
    const w = await mountPage()
    // 按钮虽然被 disabled 挡着,守卫仍在(蓝本 :202)—— 用 DOM 强解禁后再点
    const btn = w.find('.submit-btn').element as HTMLButtonElement
    btn.disabled = false
    await w.find('.submit-btn').trigger('click')
    await flushPromises()
    expect(ai.parserTestAnalyze).not.toHaveBeenCalled()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('ParserTest —— ok-hint(蓝本 :79-89)+ 🔴 治理 §4.2 事实④', () => {
  it('未跑过 → 不渲染;跑完 → `✓ N chunks · size · mime ·` + params_used 回显', async () => {
    const w = await mountPage()
    expect(w.find('.ok-hint').exists()).toBe(false)
    await runWith(w)
    // N16:`✓`(U+2713)与三个 `·`(U+00B7)在 t() 外面;N22:`chunks` / `chunker=` 等不进 i18n
    expect(sq(w.find('.ok-hint').text())).toBe(
      '✓ 1 chunks · 50 B · text/markdown · chunker=markdown, target=600, overlap=0, min=2',
    )
  })

  it('🔴 事实④:回显的是**后端回的 params_used**,不是前端传的 params —— `.md` 传 80 回 0', async () => {
    // 判据:若模板读了 `params` 而不是 `result.params_used`,这里会显示 overlap=80。
    const w = await mountPage()
    expect(
      (w.findAll('.params-row .param input')[1]!.element as HTMLInputElement).value,
    ).toBe('80') // 前端传的是 80
    await runWith(w)
    expect(Object.fromEntries(lastFormEntries()).overlap_tokens).toBe('80') // 确实传了 80
    expect(sq(w.find('.ok-hint em').text())).toBe(
      'chunker=markdown, target=600, overlap=0, min=2', // 🔴 后端回 0
    )
  })

  it('🔴 事实④ 的另一半:`.txt` 走 plain chunker → overlap 原样回 10', async () => {
    ai.parserTestAnalyze.mockResolvedValue(TXT_RERANK)
    const w = await mountPage()
    await runWith(w, makeFile('p5c-probe.txt', 196, 'text/plain'))
    expect(sq(w.find('.ok-hint em').text())).toBe('chunker=plain, target=50, overlap=10, min=2')
    expect(sq(w.find('.ok-hint').text())).toBe(
      '✓ 1 chunks · 196 B · text/plain · chunker=plain, target=50, overlap=10, min=2',
    )
  })

  it('`params_used` 缺席时 `<em>` 整段不渲染(蓝本 :83 的 v-if)', async () => {
    // 六份 fixture 都带 `params_used`;这一档只能靠 mock 造(删字段)覆盖 v-if 的假侧。
    const { params_used, ...noParams } = MD_OK
    void params_used
    ai.parserTestAnalyze.mockResolvedValue(noParams)
    const w = await mountPage()
    await runWith(w)
    expect(w.find('.ok-hint').exists()).toBe(true)
    expect(w.find('.ok-hint em').exists()).toBe(false)
    expect(sq(w.find('.ok-hint').text())).toBe('✓ 1 chunks · 50 B · text/markdown ·')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('ParserTest —— chunks 卡完整渲染(蓝本 :126-149)', () => {
  it('md-ok:标题 `切块结果（1 块）`、一个 chunk-item、chunk-head + chunk-text 逐字', async () => {
    const w = await mountPage()
    await runWith(w)
    expect(w.find('.chunks-card h3').text()).toBe('切块结果（1 块）')
    const items = w.findAll('.chunk-item')
    expect(items).toHaveLength(1)
    expect(items[0]!.find('.chunk-head strong').text()).toBe('chunk #0') // N22
    // N22:`tokens · offset a-b` 整串硬编码
    expect(sq(items[0]!.find('.chunk-head .hint').text())).toBe('12 tokens · offset 0-50')
    // `<pre>` 里保留原文的换行(fixture 里 text 含 `\n\n`)
    expect(items[0]!.find('pre.chunk-text').text()).toBe(
      'Sandbox probe A.\n\nSecond paragraph for chunk two.',
    )
  })

  it('dense_preview:`dense [0:8]:` + 8 个 toFixed(4) 逗号连接 + `, …]` 收尾(N16 的 U+2026)', async () => {
    const w = await mountPage()
    await runWith(w)
    const embs = w.findAll('.chunk-item .emb-preview')
    expect(embs).toHaveLength(2)
    expect(embs[0]!.find('.emb-label').text()).toBe('dense [0:8]:')
    expect(embs[0]!.find('code').text()).toBe(
      '[-0.0309, 0.0237, 0.0030, -0.0038, -0.0316, -0.0135, 0.0212, 0.0347, …]',
    )
  })

  it('sparse_top_terms:`sparse top:` + `token_id:weight` 用 ` · ` 连接(证明模板里那个遮蔽 `t` 的箭头参数解析正确)', async () => {
    // ⚠️ 蓝本 :145 的箭头参数就叫 `t`,在 `<script setup>` 里会遮蔽 i18n 的 `t`。
    // 本条同时是「Vue 编译器作用域跟踪把它解析成参数、而不是 `$setup.t`」的证据 ——
    // 若解析错了这里会渲染成 `undefined:undefined` 或直接抛错。
    const w = await mountPage()
    await runWith(w)
    const embs = w.findAll('.chunk-item .emb-preview')
    expect(embs[1]!.find('.emb-label').text()).toBe('sparse top:')
    expect(embs[1]!.find('code').text()).toBe(
      '151268:0.2153 · 11728:0.2056 · 6626:0.1726 · 7839:0.1494 · 77648:0.1463',
    )
  })

  it('dense_preview 缺席 → 那一行不渲染;sparse_top_terms 为空数组 → 也不渲染(两条 v-if 的假侧)', async () => {
    const bare = {
      ...MD_OK,
      chunks: [{ chunk_no: 0, text: 'x', token_count: 1, offset_start: 0, offset_end: 1, sparse_top_terms: [] }],
    }
    ai.parserTestAnalyze.mockResolvedValue(bare)
    const w = await mountPage()
    await runWith(w)
    expect(w.findAll('.chunk-item')).toHaveLength(1)
    expect(w.findAll('.chunk-item .emb-preview')).toHaveLength(0)
  })

  it('🔴 `.empty` 空态(200 + chunk_count 0 + chunks []):治理 §13 真机可验的那一档', async () => {
    ai.parserTestAnalyze.mockResolvedValue(EMPTY_200)
    const w = await mountPage()
    await runWith(w, makeFile('p5c-empty.md', 0))
    expect(w.find('.chunks-card h3').text()).toBe('切块结果（0 块）')
    expect(w.find('.chunks-card .empty').text()).toBe(
      '解析得到 0 个 chunk。可能是文件太短或全是过滤掉的小段。',
    )
    expect(w.findAll('.chunk-list')).toHaveLength(0)
    expect(w.findAll('.chunk-item')).toHaveLength(0)
    // 空文件仍是 200 → ok-hint 照样出,size 是 0 B
    expect(sq(w.find('.ok-hint').text())).toBe(
      '✓ 0 chunks · 0 B · text/markdown · chunker=markdown, target=600, overlap=0, min=2',
    )
    // 无 query/scored → scored 卡不渲染
    expect(w.find('.scored-card').exists()).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('ParserTest —— scored 卡两态 + N18 + 🔴 治理 §4.2 事实②③(蓝本 :106-124)', () => {
  it('md-ok:标题 `Query 相似度排名（top 1）`、cos 三位小数、chunk-ref、rank-text 取 chunk 原文', async () => {
    const w = await mountPage()
    await runWith(w)
    expect(w.find('.scored-card h3').text()).toBe('Query 相似度排名（top 1）')
    expect(w.find('.rank-no').text()).toBe('#1') // N18:indexOf(s) + 1
    expect(w.find('.score').text()).toBe('cos 0.508') // N22:`cos ` 硬编码;toFixed(3)
    expect(w.find('.chunk-ref').text()).toBe('chunk #0') // N22
    expect(w.find('.rank-text').text()).toBe('Sandbox probe A.\n\nSecond paragraph for chunk two.')
  })

  it('🔴 事实②:`scored[]` 无 `rerank_score` → `rr {…}` 整格不渲染(双守卫的假侧)', async () => {
    const w = await mountPage()
    await runWith(w)
    expect(w.find('.rerank-score').exists()).toBe(false)
    expect(w.find('.scored-card').text()).not.toContain('rr ')
  })

  it('rerank_score 有值时才渲染 `rr`(mock 造,本机永远看不到)', async () => {
    ai.parserTestAnalyze.mockResolvedValue({
      ...MD_OK,
      scored: [{ chunk_no: 0, cos_sim: 0.5082847161344183, rerank_score: 0.87654 }],
    })
    const w = await mountPage()
    await runWith(w)
    expect(w.find('.rerank-score').text()).toBe('rr 0.877') // N22 + toFixed(3)
  })

  it('`rerank_score: null` 仍不渲染(蓝本 `!== null` 那半个守卫)', async () => {
    ai.parserTestAnalyze.mockResolvedValue({
      ...MD_OK,
      scored: [{ chunk_no: 0, cos_sim: 0.5, rerank_score: null }],
    })
    const w = await mountPage()
    await runWith(w)
    expect(w.find('.rerank-score').exists()).toBe(false)
  })

  it('🔴 事实③:txt-rerank(勾了 rerank)→ `⚠ Reranker error:` 警告条渲染,且仍无 rr', async () => {
    // 本机 reranker 坏了(后端缺陷,治理 §8.2 记票)→ 这是勾 rerank 后**唯一**能看到的东西。
    ai.parserTestAnalyze.mockResolvedValue(TXT_RERANK)
    const w = await mountPage()
    await w.findAll('.row .checkbox input')[0]!.setValue(true)
    await runWith(w, makeFile('p5c-probe.txt', 196, 'text/plain'))
    expect(Object.fromEntries(lastFormEntries()).rerank).toBe('true')
    // N22:`⚠ Reranker error:` 整串硬编码(N16:`⚠` 在 t() 外面)
    expect(sq(w.find('.scored-card .warn').text())).toBe(
      '⚠ Reranker error: XLMRobertaTokenizer has no attribute prepare_for_model',
    )
    expect(w.find('.rerank-score').exists()).toBe(false)
  })

  it('`rerank_error` 缺席 → 警告条不渲染(md-ok 那份)', async () => {
    const w = await mountPage()
    await runWith(w)
    expect(w.find('.scored-card').exists()).toBe(true)
    expect(w.find('.scored-card .warn').exists()).toBe(false)
  })

  it('`scored` 缺席 / 空数组 → 整张卡不渲染(蓝本 :107 的 `&& length` 双守卫)', async () => {
    ai.parserTestAnalyze.mockResolvedValue({ ...MD_OK, scored: [] })
    const w = await mountPage()
    await runWith(w)
    expect(w.find('.scored-card').exists()).toBe(false)
    // 缺席那一侧
    const { scored, ...noScored } = MD_OK
    void scored
    ai.parserTestAnalyze.mockResolvedValue(noScored)
    await w.find('.submit-btn').trigger('click')
    await flushPromises()
    await nextTick()
    expect(w.find('.scored-card').exists()).toBe(false)
  })

  it('🔴 N18:序号是 `scored.indexOf(s) + 1`(**数组位置**),与 chunk_no 无关', async () => {
    // 判据:改成 `v-for="(s, i)"` 取 `i + 1` 在这份数据上渲染相同 —— 所以本条只钉
    // 「序号跟数组位置走、不跟 chunk_no 走」这个用户可见事实,并在源码上钉住写法。
    ai.parserTestAnalyze.mockResolvedValue({
      ...MD_OK,
      chunk_count: 3,
      chunks: [
        { chunk_no: 0, text: 'zero', token_count: 1, offset_start: 0, offset_end: 4 },
        { chunk_no: 1, text: 'one', token_count: 1, offset_start: 4, offset_end: 7 },
        { chunk_no: 2, text: 'two', token_count: 1, offset_start: 7, offset_end: 10 },
      ],
      // 故意让 chunk_no 与数组位置不一致(后端按相似度降序返回)
      scored: [
        { chunk_no: 2, cos_sim: 0.9 },
        { chunk_no: 0, cos_sim: 0.5 },
        { chunk_no: 1, cos_sim: 0.1 },
      ],
    })
    const w = await mountPage()
    await runWith(w)
    expect(w.findAll('.rank-no').map((n) => n.text())).toEqual(['#1', '#2', '#3'])
    expect(w.findAll('.chunk-ref').map((n) => n.text())).toEqual(['chunk #2', 'chunk #0', 'chunk #1'])
    // rank-text 走 chunkText(s.chunk_no) → 按 chunk_no 找回原文
    expect(w.findAll('.rank-text').map((n) => n.text())).toEqual(['two', 'zero', 'one'])
    // 源码形状(N18 照抄,不许换成 v-for 下标)
    const src = blankComments(readSrc())
    expect(src).toContain('#{{ result.scored.indexOf(s) + 1 }}')
    expect(src).toContain('v-for="s in result.scored"')
  })

  it('rank-text 走 `truncate(chunkText(...), 200)`:200 字原样、201 字截成 200 + U+2026', async () => {
    const s200 = 'a'.repeat(200)
    const s201 = 'b'.repeat(201)
    ai.parserTestAnalyze.mockResolvedValue({
      ...MD_OK,
      chunk_count: 2,
      chunks: [
        { chunk_no: 0, text: s200, token_count: 1, offset_start: 0, offset_end: 200 },
        { chunk_no: 1, text: s201, token_count: 1, offset_start: 200, offset_end: 401 },
      ],
      scored: [
        { chunk_no: 0, cos_sim: 0.9 },
        { chunk_no: 1, cos_sim: 0.8 },
      ],
    })
    const w = await mountPage()
    await runWith(w)
    const texts = w.findAll('.rank-text').map((n) => n.text())
    expect(texts[0]).toBe(s200) // 恰好 200 → 不截(蓝本是严格 `>`)
    expect(texts[0]).toHaveLength(200)
    expect(texts[1]).toBe('b'.repeat(200) + '…') // 201 → 截 + 省略号
    expect(texts[1]).toHaveLength(201)
  })

  it('🔴 chunkText 找不到对应 chunk_no → 回空串(蓝本 `c ? c.text : \'\'`)', async () => {
    ai.parserTestAnalyze.mockResolvedValue({
      ...MD_OK,
      scored: [{ chunk_no: 99, cos_sim: 0.5 }], // chunks 里只有 chunk_no 0
    })
    const w = await mountPage()
    await runWith(w)
    expect(w.find('.chunk-ref').text()).toBe('chunk #99')
    expect(w.find('.rank-text').text()).toBe('')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('ParserTest —— docling 卡两态 + 折叠(蓝本 :97-104)+ 🔴 治理 §4.2 事实①', () => {
  it('🔴 事实①:两份成功 fixture(`.md` / `.txt`)都**不产生 `docling_markdown`** → 整卡不渲染', async () => {
    const w = await mountPage()
    await runWith(w)
    expect(w.find('.docling-card').exists()).toBe(false)

    ai.parserTestAnalyze.mockResolvedValue(TXT_RERANK)
    await w.find('.submit-btn').trigger('click')
    await flushPromises()
    await nextTick()
    expect(w.find('.docling-card').exists()).toBe(false)
  })

  it('mock 造一份带 `docling_markdown` 的:折叠按钮文案 `▶ docling 转出的 markdown（N 字符）`,默认折起', async () => {
    // 治理 §13:要看到这张卡得传 `.docx`/`.pptx`/`.xlsx`(🔴 **别传 `.pdf`**,会触发
    // ~200 MB 模型下载)→ 本机验渲染只能靠 mock 造。
    const md = '# Title\n\nbody text'
    ai.parserTestAnalyze.mockResolvedValue({ ...MD_OK, docling_markdown: md })
    const w = await mountPage()
    await runWith(w, makeFile('doc.docx', 4096))
    const card = w.find('.docling-card')
    expect(card.exists()).toBe(true)
    // N16:`▼`/`▶` 在 t() 外面;`{n}` 取的是 `docling_markdown.length`(实测 18)
    expect(md).toHaveLength(18)
    expect(sq(card.find('.toggle').text())).toBe('▶ docling 转出的 markdown（18 字符）')
    // v-show 折起 → 元素在但 display: none
    const pre = card.find('pre.docling-md')
    expect(pre.exists()).toBe(true)
    expect((pre.element as HTMLElement).style.display).toBe('none')
    expect(pre.text()).toBe(md)
  })

  it('点折叠按钮 → 箭头翻成 `▼`、`<pre>` 可见;再点收回', async () => {
    ai.parserTestAnalyze.mockResolvedValue({ ...MD_OK, docling_markdown: 'x' })
    const w = await mountPage()
    await runWith(w, makeFile('doc.docx', 4096))
    await w.find('.docling-card .toggle').trigger('click')
    await nextTick()
    expect(sq(w.find('.docling-card .toggle').text())).toBe('▼ docling 转出的 markdown（1 字符）')
    expect((w.find('pre.docling-md').element as HTMLElement).style.display).toBe('')

    await w.find('.docling-card .toggle').trigger('click')
    await nextTick()
    expect(sq(w.find('.docling-card .toggle').text())).toBe('▶ docling 转出的 markdown（1 字符）')
    expect((w.find('pre.docling-md').element as HTMLElement).style.display).toBe('none')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 422 为什么不测:文件头注释已抄下那份响应体并说明 —— 提交按钮
// `:disabled="!file || loading"` + `submit()` 开头 `if (!file) return` 双重挡住,
// **UI 到不了「不传 file」这条路**;治理 §4.2 / §5.1 明令不为它加数组分支、也不写单测。
// 下面只测两条 400(`detail` 是字符串,真机可复现)与「无 response 的网络错误」。
describe('ParserTest —— 失败侧:两条 400 的 .error-box + 取值链兜底(蓝本 :221-224 / :92)', () => {
  it('400 `target_tokens must be in [50, 4000]` 原文进 .error-box', async () => {
    ai.parserTestAnalyze.mockRejectedValue(httpError(400, ERR_400_TARGET))
    const w = await mountPage()
    await runWith(w)
    expect(w.find('.error-box').text()).toBe('target_tokens must be in [50, 4000]')
    // 失败时 result 保持为 null → 三张结果卡都不渲染
    expect(w.find('.ok-hint').exists()).toBe(false)
    expect(w.find('.chunks-card').exists()).toBe(false)
  })

  it('400 不支持的扩展名 —— 整串原文(含分号后那一长串扩展名清单)进 .error-box', async () => {
    ai.parserTestAnalyze.mockRejectedValue(httpError(400, ERR_400_EXT))
    const w = await mountPage()
    await runWith(w, makeFile('p5c-probe.bin', 12, 'application/octet-stream'))
    expect(w.find('.error-box').text()).toBe(
      "extension '.bin' not supported in test sandbox; use .md / source code / .txt / .html / .json / .csv / .log / .pdf / .docx / .pptx / .xlsx",
    )
  })

  it('取值链第二档:`response.data.error`(没有 `detail` 时)', async () => {
    // 蓝本 :222 是 `data.detail || data.error` —— 两个都读,照抄。
    ai.parserTestAnalyze.mockRejectedValue(httpError(500, { error: 'internal boom' }))
    const w = await mountPage()
    await runWith(w)
    expect(w.find('.error-box').text()).toBe('internal boom')
  })

  it('取值链第三档:无 response(网络层错误)→ 回落 `e.message`', async () => {
    ai.parserTestAnalyze.mockRejectedValue(new Error('Network Error'))
    const w = await mountPage()
    await runWith(w)
    expect(w.find('.error-box').text()).toBe('Network Error')
  })

  it('取值链第四档:message 为空 → 回落 `String(e)`', async () => {
    ai.parserTestAnalyze.mockRejectedValue(new Error(''))
    const w = await mountPage()
    await runWith(w)
    expect(w.find('.error-box').text()).toBe('Error')
  })

  it('失败后 loading 归位(`finally`)→ 按钮解禁、文案回「运行」', async () => {
    ai.parserTestAnalyze.mockRejectedValue(httpError(400, ERR_400_TARGET))
    const w = await mountPage()
    await runWith(w)
    expect((w.find('.submit-btn').element as HTMLButtonElement).disabled).toBe(false)
    expect(w.find('.submit-btn').text()).toBe('运行')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('ParserTest —— fmtBytes 三档边界两侧(蓝本 :236-240)', () => {
  // 通过 `.file-meta .hint` 观察(蓝本 :34 是它唯一的调用点之一),走真实渲染路径。
  async function bytesLabel(size: number): Promise<string> {
    const w = await mountPage()
    await pickFile(w, makeFile('x.md', size))
    return w.find('.file-meta .hint').text()
  }

  it('B 档:0 / 1 / 1023 —— 整数直接拼 `" B"`,不带小数', async () => {
    expect(await bytesLabel(0)).toBe('0 B')
    expect(await bytesLabel(1)).toBe('1 B')
    expect(await bytesLabel(1023)).toBe('1023 B')
  })

  it('🔴 第一个边界 1024:上侧进 KB 档、toFixed(1)', async () => {
    expect(await bytesLabel(1024)).toBe('1.0 KB')
    expect(await bytesLabel(1536)).toBe('1.5 KB')
  })

  it('🔴 第二个边界 1048575 / 1048576:下侧仍 KB(toFixed(1))、上侧进 MB(toFixed(2))', async () => {
    expect(await bytesLabel(1024 * 1024 - 1)).toBe('1024.0 KB')
    expect(await bytesLabel(1024 * 1024)).toBe('1.00 MB')
  })

  it('MB 档:两位小数', async () => {
    expect(await bytesLabel(30 * 1024 * 1024)).toBe('30.00 MB')
    expect(await bytesLabel(1024 * 1024 * 3 + 512 * 1024)).toBe('3.50 MB')
  })

  it('ok-hint 里的 size 也走同一个 fmtBytes(md-ok 的 50 → `50 B`)', async () => {
    const w = await mountPage()
    await runWith(w, makeFile('p5c-probe.md', 50))
    expect(sq(w.find('.ok-hint').text())).toContain('· 50 B ·')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('ParserTest —— 🔴 §9.2 en 档强断言(zh 撞车、只有 en 能判别)', () => {
  // 治理 §9.2:凡「必须用键 A、不许用键 B,理由是 **en 不同**」的条目,只比 zh 的断言
  // **零判别力**(T6 评审实测:换成被禁键 47/47 全绿)。
  //
  // 🔴 本刀已把本页 23 个键的 zh 值与**全表 1503 键**做过程序化撞车扫描,结果:
  //   `aiKbPtProcessing`   zh 处理中…  <撞>  `appsWorking`        en `Processing…` vs `Working…`  ← **EN-DIFF**
  //   `aiKbPtReset`        zh 重置      <撞>  `filesViewerReset`   en `Reset` vs `Reset`           ← EN-SAME(无判别力)
  //   `aiKbPtRun`          zh 运行      <撞>  `aiSkTestRun`        en `Run` vs `Run`               ← EN-SAME(无判别力)
  // → **唯一有 en 判别力的同族键是 `aiKbPtProcessing` / `appsWorking`**:两者 zh 逐字相同
  //   (都是「处理中…」),只有英文界面能分辨。若有人图省事复用 `appsWorking`,中文界面
  //   看不出任何差别、三门全绿,只有切英文才看得出按钮写着 `Working…`(Vue2 是 `Processing…`)
  //   = 界面不 1:1。故这一对必须有 en 档正向 + 反向断言。
  // 另两对 EN-SAME 的靠源码键名守(渲染断言对它们零判别力,同 T6 对 A-1 的处置)。
  //
  // 🔴 locale 是全局单例 → 必须 try/finally 还原,否则污染同文件后续用例。
  const localeRef = i18n.global.locale as unknown as { value: string }

  async function inEn<T>(fn: (w: W) => Promise<T> | T): Promise<T> {
    const prev = localeRef.value
    localeRef.value = 'en_us'
    try {
      const w = await mountPage()
      return await fn(w)
    } finally {
      localeRef.value = prev
    }
  }

  it('🔴 en 档:在飞时按钮逐字 `Processing…`,落地后逐字 `Run`', async () => {
    await inEn(async (w) => {
      const d = deferred<unknown>()
      ai.parserTestAnalyze.mockReturnValue(d.promise)
      await pickFile(w, makeFile('a.md', 10))
      expect(w.find('.submit-btn').text()).toBe('Run')
      await w.find('.submit-btn').trigger('click')
      await nextTick()
      expect(w.find('.submit-btn').text()).toBe('Processing…')
      d.resolve(MD_OK)
      await flushPromises()
    })
  })

  it('🔴 反向:en 档渲染结果里不许出现被禁复用键 `appsWorking` 的 en 值(`Working…`)', async () => {
    await inEn(async (w) => {
      const d = deferred<unknown>()
      ai.parserTestAnalyze.mockReturnValue(d.promise)
      await pickFile(w, makeFile('a.md', 10))
      await w.find('.submit-btn').trigger('click')
      await nextTick()
      expect(w.find('.submit-btn').text()).not.toBe('Working…')
      expect(w.text()).not.toContain('Working…')
      d.resolve(MD_OK)
      await flushPromises()
    })
    // 反过来实证这一对**只有 en 能判别**:zh 逐字相同
    const zh = zhCn as Record<string, string>
    const en = enUs as Record<string, string>
    expect(zh.aiKbPtProcessing).toBe(zh.appsWorking)
    expect(en.aiKbPtProcessing).not.toBe(en.appsWorking)
    expect(en.aiKbPtProcessing).toBe('Processing…')
    expect(en.appsWorking).toBe('Working…')
  })

  it('两对 EN-SAME 同族键(`aiKbPtReset`/`filesViewerReset` · `aiKbPtRun`/`aiSkTestRun`)只能靠源码键名守', async () => {
    // 它们 en 与 zh 双双同值 → 任何渲染断言都分不出来(同 T6 对裁定 A-1 的处置)。
    const zh = zhCn as Record<string, string>
    const en = enUs as Record<string, string>
    expect(zh.aiKbPtReset).toBe(zh.filesViewerReset)
    expect(en.aiKbPtReset).toBe(en.filesViewerReset)
    expect(zh.aiKbPtRun).toBe(zh.aiSkTestRun)
    expect(en.aiKbPtRun).toBe(en.aiSkTestRun)
    // → 判据落在「模板用的是哪个键」的调用形状上(治理 §9 第九条:钉形状不钉裸标识符)
    const src = blankComments(readSrc())
    expect(src).toContain("t('aiKbPtReset')")
    expect(src).toContain("t('aiKbPtRun')")
    expect(src).not.toMatch(/\bt\(\s*['"]filesViewerReset['"]/)
    expect(src).not.toMatch(/\bt\(\s*['"]aiSkTestRun['"]/)
  })

  it('en 档整页关键文案逐字(证明 23 个键全部走对了 en 值)', async () => {
    await inEn(async (w) => {
      expect(w.find('.page-header h2').text()).toBe('Parser test sandbox')
      expect(w.find('a.back-link').text()).toBe('← Back to details')
      expect(w.find('.pick-btn').text()).toBe('Choose file')
      expect(w.find('.dropzone .hint').text()).toBe('or drag and drop here')
      expect(w.find('.reset-btn').text()).toBe('Reset')
      expect(w.find('.query-input').attributes('placeholder')).toBe(
        '(Optional) Enter a query to compute cosine similarity per chunk',
      )
      expect(sq(w.findAll('.row .checkbox')[1]!.text())).toBe('OCR (scanned PDF)')
      expect(sq(w.find('.hint-line').text())).toBe(
        'Defaults: target=600, overlap=80, min=2 (sandbox loose values; production uses 600/80/5–20). ' +
          'overlap only applies to plain text; markdown/source splits by paragraph or function boundary.',
      )
    })
  })

  it('切回 zh 后仍是中文(证明 locale 已还原、无污染)', async () => {
    const w = await mountPage()
    expect(w.find('.page-header h2').text()).toBe('Parser 测试沙盒')
    expect(w.find('.submit-btn').text()).toBe('运行')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('ParserTest —— N16 emoji / 符号位置核对(一个都不许挪进/挪出 t())', () => {
  it('本页 23 个键的键值零 emoji / 零箭头 / 零 `✓⚠×▼▶`(证明符号在模板里,不在语言包里)', () => {
    const zh = zhCn as Record<string, string>
    const en = enUs as Record<string, string>
    const KEYS = [
      'aiKbPtTitle', 'aiKbPtBackLink', 'aiKbPtHelp1', 'aiKbPtHelpNoWrite', 'aiKbPtHelpPreviewOnly',
      'aiKbPtSupports', 'aiKbPtAsWellAs', 'aiKbPtViaDocling', 'aiKbPtMaxSize', 'aiKbPtChooseFile',
      'aiKbPtDragDrop', 'aiKbPtReset', 'aiKbPtDefaults', 'aiKbPtOverlapNote', 'aiKbPtQueryPlaceholder',
      'aiKbPtOcr', 'aiKbPtProcessing', 'aiKbPtRun', 'aiKbPtDoclingToggle', 'aiKbPtScoredTitle',
      'aiKbPtChunksTitle', 'aiKbPtZeroChunks', 'aiKbPtTooBig',
    ]
    expect(KEYS).toHaveLength(23)
    for (const k of KEYS) {
      expect(typeof zh[k]).toBe('string')
      expect(typeof en[k]).toBe('string')
      expect(zh[k]).not.toMatch(/[←✓⚠×▼▶🧪→]/u)
      expect(en[k]).not.toMatch(/[←✓⚠×▼▶🧪→]/u)
    }
    // 🔴 反过来:`…`(U+2026)**在** `aiKbPtProcessing` 的键值里(不是模板拼的)
    expect(zh.aiKbPtProcessing).toBe('处理中…')
    expect(en.aiKbPtProcessing).toBe('Processing…')
  })

  it('模板里符号与译文之间恰好一个空格,顺序是「符号 → 文案」', async () => {
    const w = await mountPage()
    expect(w.find('a.back-link').text()).toBe('← 返回详情')
    expect(w.find('.clear-btn').exists()).toBe(false) // 未选文件时没有 ×
    await runWith(w)
    expect(w.find('.clear-btn').text()).toBe('×')
    expect(sq(w.find('.ok-hint').text()).startsWith('✓ ')).toBe(true)

    ai.parserTestAnalyze.mockResolvedValue({ ...MD_OK, docling_markdown: 'x', rerank_error: 'boom' })
    await w.find('.submit-btn').trigger('click')
    await flushPromises()
    await nextTick()
    expect(sq(w.find('.docling-card .toggle').text()).startsWith('▶ ')).toBe(true)
    expect(sq(w.find('.scored-card .warn').text()).startsWith('⚠ Reranker error: ')).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('ParserTest —— 🔴 N22:硬编码技术标识符「判定不入语言包」', () => {
  // 🔴 **M-2(评审 2026-08-04)—— 这两条守卫已从「宽子串扫描」收紧成「精确值 + 键集闭合」。**
  // 第一版对 `'cos '` / `'rr '` / `'chunk #'` 这类**通用子串**做 `v.includes(s)` 全包扫描:
  // 当前 0 命中,但将来任何**无关**新键的值里含这些子串(比如某处文案写了「rr 」)就会
  // **假报红** —— 与治理 §9 第九条(否定式断言撞上无关内容 → 冤枉正确代码 → 诱使去"修"
  // 一个没坏的东西)同族。收紧后判别力**没降**:真正要守的事实是
  //   ① 没有任何键的**整值**就是这些技术串(= 没人给它们建键);
  //   ② 本页模板里 `t()` 的键集**恰好**是那 23 个 `aiKbPt*`(= 没人偷偷多接一个键)。
  // ② 才是「有人把技术串补成 i18n 键」这件事的真正判据 —— 补键必然要在模板里多一次
  // `t()` 调用,键集闭合当场炸。RED 探针 H(往 zh_cn.ts 塞 `aiKbPtRerankTop20`)与
  // 探针 I(把模板里的裸 `rerank top-20` 换成 `{{ t('aiKbPtRerankTop20') }}`)分别验这两条。
  it('①15 串技术标识符不是两档语言包里任何键的**整值**(精确相等,不用宽子串)', () => {
    // 🔴 治理 §3.5 N22:这些是技术标识符/参数名,Vue2 刻意没进 i18n。
    // 补键 = 凭空多出 Vue2 没有的键,且 en/zh 两档一填英文 = 纯噪音。
    const TECH = [
      'rerank top-20',
      'dense [0:8]:',
      'sparse top:',
      'chunk #',
      'cos ',
      'rr ',
      'target_tokens',
      'overlap_tokens',
      'min_tokens',
      'chunker=',
      'Reranker error',
      'tokens · offset',
      ' chunks ·',
      '.md .txt .html .json .csv .py .go .ts .java',
      '.pdf .docx .pptx .xlsx',
    ]
    expect(TECH).toHaveLength(15)
    for (const [name, pack] of [['zh_cn', zhCn], ['en_us', enUs]] as Array<[string, Record<string, unknown>]>) {
      const entries = Object.entries(pack).filter((e): e is [string, string] => typeof e[1] === 'string')
      expect(entries.length).toBeGreaterThan(1400) // 扫的是全表,不是空集合
      for (const s of TECH) {
        // 🔴 **精确整值相等**(不是 `includes`):判据是「有没有人给这个技术串建了键」。
        // 报错消息带上 pack 名与命中的键名,便于定位。
        expect(entries.filter(([, v]) => v === s).map(([k]) => `${name}.${k}`)).toEqual([])
      }
    }
  })

  it('②本页模板里 `t()` 的键集**恰好**是那 23 个 `aiKbPt*`(键集闭合 —— 补一个键就炸)', () => {
    // 🔴 这一条才是「有人把技术串补成 i18n 键」的真正判据:补键必然在模板里多一次
    // `t()` 调用 → 键集不再等于这 23 个 → 报红。比宽子串扫描更准、且零假报红面。
    // 剥注释(保行版)后再扫,否则会撞上本文件/组件头注释里提到的键名(治理 §9 第九条)。
    const src = blankComments(readSrc())
    const keys = [...src.matchAll(/(?<![\w$])t\(\s*'([^']+)'/g)].map((m) => m[1]!)
    const EXPECTED_23 = [
      'aiKbPtAsWellAs', 'aiKbPtBackLink', 'aiKbPtChooseFile', 'aiKbPtChunksTitle',
      'aiKbPtDefaults', 'aiKbPtDoclingToggle', 'aiKbPtDragDrop', 'aiKbPtHelp1',
      'aiKbPtHelpNoWrite', 'aiKbPtHelpPreviewOnly', 'aiKbPtMaxSize', 'aiKbPtOcr',
      'aiKbPtOverlapNote', 'aiKbPtProcessing', 'aiKbPtQueryPlaceholder', 'aiKbPtReset',
      'aiKbPtRun', 'aiKbPtScoredTitle', 'aiKbPtSupports', 'aiKbPtTitle',
      'aiKbPtTooBig', 'aiKbPtViaDocling', 'aiKbPtZeroChunks',
    ]
    expect(EXPECTED_23).toHaveLength(23)
    // 调用次数 = 23(每个键恰好用一次,与蓝本 23 个 `$t()` 一一对应)
    expect(keys).toHaveLength(23)
    expect([...keys].sort()).toEqual([...EXPECTED_23].sort())
    // 键集闭合:一个都不多、一个都不少
    expect(new Set(keys).size).toBe(23)
    // 且这 23 个键在两档语言包里都存在(否则渲染出键名本身)
    for (const k of EXPECTED_23) {
      expect(typeof (zhCn as Record<string, unknown>)[k]).toBe('string')
      expect(typeof (enUs as Record<string, unknown>)[k]).toBe('string')
    }
  })

  it('这 15 串在模板里是**裸文本**(不经 t()),逐串在剥注释后的模板里命中', () => {
    const src = blankComments(readSrc())
    const m = /<template>([\s\S]*?)\n<\/template>/.exec(src)
    expect(m).not.toBeNull()
    const tmpl = m![1]!
    for (const s of [
      'rerank top-20',
      'dense [0:8]:',
      'sparse top:',
      'chunk #{{ s.chunk_no }}',
      'chunk #{{ c.chunk_no }}',
      'cos {{ s.cos_sim.toFixed(3) }}',
      'rr {{ s.rerank_score.toFixed(3) }}',
      'target_tokens',
      'overlap_tokens',
      'min_tokens',
      'chunker={{ result.params_used.chunker }}',
      '⚠ Reranker error: {{ result.rerank_error }}',
      'tokens · offset {{ c.offset_start }}-{{ c.offset_end }}',
      'chunks ·',
      '<code>.md .txt .html .json .csv .py .go .ts .java</code>',
      '<code>.pdf .docx .pptx .xlsx</code>',
    ]) {
      expect(tmpl).toContain(s)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('ParserTest —— 守卫缺口③:<template> 块零裸色字面量', () => {
  // 治理 §9 缺口③:`color-guard.test.ts:44-56` 的 `styleLines()` 对 `.vue` 只取
  // `<style>` 块 → 模板 `style=` / `:style=` 属性零扫描;本文件补一条定向断言堵这个盲区。
  // ⚠️ **沿用现状写法**(非贪婪 + 隐式靠「`</template>` 在第 0 列」锚定,先例
  // `ParserStatus.test.ts` / `QueueView.test.ts` / `IndexedFilesView.test.ts`);
  // 治理 §9 缺口③′ 的「统一改成贪婪匹配 + 覆盖度自检」归 **T8**,本刀不动它。
  // 🔴 读源文件用 `node:fs`,不用 Vite 的 `?raw`。
  it('<template> 块内(剥离 var()/color-mix() 之后)不含任何裸 hex / rgb / hsl 字面量', () => {
    const src: string = readSrc()
    const m = /<template>([\s\S]*?)\n<\/template>/.exec(src)
    expect(m).not.toBeNull()
    const tmpl = m![1]!
    // 覆盖度自检:抽出的片段必须同时含模板**首部**与**尾部**的特征串。
    // 本组件唯一的嵌套 `<template v-if="result">` 带属性(不是裸 `<template>`)、其闭合
    // 标签也是缩进的 → 不会把第 0 列的 `</template>` 提前截断。
    expect(tmpl).toContain("t('aiKbPtTitle')") // 首部(页头 h2)
    expect(tmpl).toContain("join(' · ') }}</code>") // 尾部(chunks 卡最后一行内容)

    // 剥掉 var(...) 与 color-mix(...) 的内部(照 color-guard.test.ts 的 stripVar
    // 同款手法:逐字符扫描配对括号深度,支持嵌套 fallback)
    function stripCalls(s: string, prefixes: string[]): string {
      let out = ''
      let i = 0
      while (i < s.length) {
        const hit = prefixes.find((p) => s.startsWith(p, i))
        if (hit) {
          let depth = 0
          let j = i + hit.length - 1 // 落在开括号上
          for (; j < s.length; j++) {
            if (s[j] === '(') depth++
            else if (s[j] === ')') {
              depth--
              if (depth === 0) {
                j++
                break
              }
            }
          }
          i = j
        } else {
          out += s[i]
          i++
        }
      }
      return out
    }
    const scrubbed = stripCalls(tmpl, ['var(', 'color-mix('])
    expect(scrubbed).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(scrubbed).not.toMatch(/\b(rgba?|hsla?)\s*\(/)
  })

  it('本文件零 <style> 块(K24:样式在 parser-styles.scss,走 JS 侧 import)', () => {
    const src: string = readSrc()
    expect(src).not.toMatch(/^<style/m)
    expect(src).toContain("import '../../styles/parser-styles.scss'")
  })

  it('零 KIcon(治理 §1.2 / E-2 / N16:两个 Parser 页蓝本一个 KIcon 都不用)', async () => {
    const src: string = readSrc()
    expect(src).not.toMatch(/^import KIcon/m)
    const w = await mountPage()
    await runWith(w)
    expect(w.findAll('svg')).toHaveLength(0)
  })
})
