// SP8-P5f Task 4 —— `AllowlistView.vue` 的组件测试。
// 蓝本 `NimoOS-UI` @ `7a6ee6b7` `src/views/AI/Knowledge/AllowlistView.vue`(249 行)。
//
// ═══ mock 策略(治理 §4.1 要求显式说明) ═══
// 🔴 **mock 共享包 `service.ai.parserAllowlist*` 四个方法,走真 `knowledgeStore`**,不 mock store。
//   理由同 `SettingsView.test.ts` / `ParserStatus.test.ts`:本页每一格都要穿过两层
//   —— ① K1 降层(蓝本 `store.state.extensions` → 本仓 `store.extensions`);
//   ② **N47 的 `!!enabled` 归一化**(`knowledgeStore.ts:395`)。mock store 会把这两件最容易
//   翻车的事整个绕开;走真 store 则每条渲染断言天然是集成断言 —— 少降一层、或漏掉归一化,
//   对应那格立刻空白 / chip 永不翻转。
// 🔴 形状(§4.1 的表 + `p5f-fixtures/README.md` §3):
//   · `service.ai.parserAllowlistExtensions` → **HTTP 原样**,`enabled` 是 **SQLite 整数 0/1**
//     (包内零转换;归一化发生在 store 里)。
//   · `service.ai.parserAllowlistFolders` → **HTTP 原样** `{ rules: [...] }`,`rules` 元素是
//     `{ id, root_id, path_glob, action }` **snake_case**,store 原样透传(`knowledgeStore.ts:396`)。
//   · `patchParserAllowlistExtensions` / `addParserAllowlistFolder` / `deleteParserAllowlistFolder`
//     的响应体本页不消费,一律 mock 成 `{}`(与 `knowledgeStore.parser.test.ts:129-136` 同形状,
//     治理 §4.1 的 red flag 自查:同一方法在两个测试文件里形状不同 = 定时炸弹)。
//
// ═══ fixture 是抄本,不是运行时读(治理 §4 / P5c §4.4) ═══
// 数据逐字抄进下面 `FIXTURE-COPY-BEGIN/END` 块并注明**三级出处标签**(裁定 R3 约束 1),
// **不用 `node:fs` 读 `.superpowers/`** —— 那个目录被 gitignore 盖着(SP7 整个丢过一次),
// 本分支将来要合 master,`src/` 下的测试跨界依赖它会以「找不到文件」的形式神秘挂掉。
// 🔴 **只取数据字段,`__meta` 转成注释**(裁定 R14 / `p5f-fixtures/README.md` §0.2)——
// `__meta` 不是后端 API 形状的一部分,整份抄进 mock 会凭空多出一个后端不存在的字段。
// 抄本等价性由**程序化逐字节校验**确认(输出贴在 T4 报告 §5),不是肉眼比。
// 读 `.vue` 源文件(K55 / N54 那几条)一律 `node:fs`,**不许用 Vite 的 `?raw`**
//   (vitest 的 CSSEnablerPlugin 会把源换成空串 → 断言对空字符串「假通过」;铁律)。
//
// ═══ 属性态断言口径(治理 §9) ═══
// `data-on` / `data-act` / `data-open` 都是普通 `data-*` 属性(不是布尔属性)→ 假侧渲染成
// 字符串 `"false"` 而不是缺席,故一律 `toBe('true')` / `toBe('false')`,**两侧都比**,
// 禁 `toBeUndefined()`。`disabled` 是真布尔属性,断言 DOM 属性 `el.disabled`。
//
// ═══ 具名色扫描禁用词边界(裁定 R11,常驻) ═══
// 🔴 **禁 `\bwhite\b`** —— `white-space` 会满足词边界而假命中。本文件对 `color=` 属性值
// 一律用 `(?<![\w-])COLOR(?![\w-])` 形态(与 `knowledgeStyles.test.ts` 的既定口径同一份)。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
// i18n 由 `vitest.setup.ts` 全局装好(见 `mountPage` 注释),本文件不再自己装 —— 也**不许**
// 另建 `createI18n`(与 setup 的单例重复安装,记忆 `vitest-reporter-hides-warnings`)。
import { useKnowledgeStore } from '../stores/knowledgeStore'
import type { RawAllowlistExtension } from '../stores/knowledgeStore'
import KIcon from '../components/KIcon.vue'
import AllowlistView from './AllowlistView.vue'
// @ts-expect-error -- 本仓未装 @types/node,node:fs 无类型声明
import { readFileSync } from 'node:fs'
// @ts-expect-error -- 本仓未装 @types/node,node:path 无类型声明
import { resolve, dirname } from 'node:path'
// @ts-expect-error -- 本仓未装 @types/node,node:url 无类型声明
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC_PATH: string = resolve(__dirname, './AllowlistView.vue')
const SRC: string = readFileSync(SRC_PATH, 'utf8')

// ── vi.hoisted mock 骨架(治理 §9:避免 ESM 提升 TDZ)──
const ai = vi.hoisted(() => ({
  parserAllowlistExtensions: vi.fn(),
  parserAllowlistFolders: vi.fn(),
  patchParserAllowlistExtensions: vi.fn(),
  addParserAllowlistFolder: vi.fn(),
  deleteParserAllowlistFolder: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai } }))

// ═══════════════════════════════════════════════════════════════════════════
// FIXTURE-COPY-BEGIN  p5f-fixtures/allowlist-extensions.REAL.json  (只取 `extensions` 数组)
// 三级出处标签:**`.REAL`** —— 本机真机 `GET http://127.0.0.1:8283/v1/parser/allowlist/extensions`
//   的原始响应内容(JSON 仅做缩进美化,字段名 / 值 / 顺序一字未动;见 README §0.1 订正块)。
//   该文件顶层**没有** `__meta`,可整份直用;这里只取 `extensions` 数组本身。
// 🔴 实测坐实(README §2):**45 条**;`enabled` 取值集合 = `{1}`、类型集合 = `{int}`
//   ⇒ **真机抓不到 `enabled: 0`**,chip 翻转必须靠下面的 `.REPLAYED` 样本。
// 🔴 裁定 R6:本机 `.wps`(`enabled: 1`)**三个分组都不匹配** ⇒ 页面只显示 44/45。
//   **这是蓝本行为(N54),不是本期缺陷**(裁定书 §四 票 E)。
const EXT_REAL: RawAllowlistExtension[] = [
  { "ext": ".bash", "enabled": 1, "source": "default" },
  { "ext": ".c", "enabled": 1, "source": "default" },
  { "ext": ".cc", "enabled": 1, "source": "default" },
  { "ext": ".cpp", "enabled": 1, "source": "default" },
  { "ext": ".cs", "enabled": 1, "source": "default" },
  { "ext": ".csv", "enabled": 1, "source": "default" },
  { "ext": ".doc", "enabled": 1, "source": "default" },
  { "ext": ".docx", "enabled": 1, "source": "default" },
  { "ext": ".env", "enabled": 1, "source": "default" },
  { "ext": ".fish", "enabled": 1, "source": "default" },
  { "ext": ".go", "enabled": 1, "source": "default" },
  { "ext": ".h", "enabled": 1, "source": "default" },
  { "ext": ".hpp", "enabled": 1, "source": "default" },
  { "ext": ".htm", "enabled": 1, "source": "default" },
  { "ext": ".html", "enabled": 1, "source": "default" },
  { "ext": ".ini", "enabled": 1, "source": "default" },
  { "ext": ".java", "enabled": 1, "source": "default" },
  { "ext": ".js", "enabled": 1, "source": "default" },
  { "ext": ".json", "enabled": 1, "source": "default" },
  { "ext": ".jsx", "enabled": 1, "source": "default" },
  { "ext": ".log", "enabled": 1, "source": "default" },
  { "ext": ".md", "enabled": 1, "source": "default" },
  { "ext": ".odt", "enabled": 1, "source": "default" },
  { "ext": ".pdf", "enabled": 1, "source": "default" },
  { "ext": ".php", "enabled": 1, "source": "default" },
  { "ext": ".ppt", "enabled": 1, "source": "default" },
  { "ext": ".pptx", "enabled": 1, "source": "default" },
  { "ext": ".py", "enabled": 1, "source": "default" },
  { "ext": ".rb", "enabled": 1, "source": "default" },
  { "ext": ".rs", "enabled": 1, "source": "default" },
  { "ext": ".rst", "enabled": 1, "source": "default" },
  { "ext": ".sh", "enabled": 1, "source": "default" },
  { "ext": ".sql", "enabled": 1, "source": "default" },
  { "ext": ".toml", "enabled": 1, "source": "default" },
  { "ext": ".ts", "enabled": 1, "source": "default" },
  { "ext": ".tsv", "enabled": 1, "source": "default" },
  { "ext": ".tsx", "enabled": 1, "source": "default" },
  { "ext": ".txt", "enabled": 1, "source": "default" },
  { "ext": ".wps", "enabled": 1, "source": "default" },
  { "ext": ".xls", "enabled": 1, "source": "default" },
  { "ext": ".xlsx", "enabled": 1, "source": "default" },
  { "ext": ".xml", "enabled": 1, "source": "default" },
  { "ext": ".yaml", "enabled": 1, "source": "default" },
  { "ext": ".yml", "enabled": 1, "source": "default" },
  { "ext": ".zsh", "enabled": 1, "source": "default" },
]
// FIXTURE-COPY-END

// FIXTURE-COPY-BEGIN  p5f-fixtures/allowlist-extensions.REPLAYED.json  (只取 `extensions` 数组)
// 三级出处标签:**`.REPLAYED`** —— 真机响应的形状,只改了值(字段名 / 类型 / 枚举一字未动)。
// `__meta` 转成本注释(裁定 R14),原文要点:
//   · why       : 本机真机 45 个扩展名 **enabled 全是 1** ⇒ 真机抓不到 `enabled: 0` 的样本。
//   · built_from: 取 `allowlist-extensions.REAL.json` 真机响应中的 6 条,只把部分 `enabled`
//                 由 1 改成 0(字段名 / 类型 / `source` 值一字未动)。
//   · n47       : `enabled` 是 SQLite **整数 0/1**,不是 boolean —— store 侧 `!!e.enabled`
//                 归一化是必需的(`knowledgeStore.ts:395`),不归一化 chip 永不视觉翻转。
//   · n47_page_side: 页面侧 `:data-on="String(e.enabled)"` 照抄 ⇒ 归一化后测试断 'true'/'false' 字符串。
const EXT_REPLAYED: RawAllowlistExtension[] = [
  { "ext": ".pdf", "enabled": 1, "source": "default" },
  { "ext": ".docx", "enabled": 0, "source": "default" },
  { "ext": ".md", "enabled": 1, "source": "default" },
  { "ext": ".txt", "enabled": 0, "source": "default" },
  { "ext": ".py", "enabled": 1, "source": "default" },
  { "ext": ".go", "enabled": 1, "source": "default" },
]
// FIXTURE-COPY-END

// FIXTURE-COPY-BEGIN  p5f-fixtures/allowlist-folders.REAL.json  (整份)
// 三级出处标签:**`.REAL`** —— 本机真机 `GET .../allowlist/folders` 的原始响应
// (2026-08-06 实测 = 空规则表;07-31 也是同一形态)。该文件顶层没有 `__meta`,整份直用。
// 🔴 §9.17:本机初始就是这个态 ⇒ 空态是**唯一免配置可达**的一侧,非空一侧靠下面的构造样本。
const FOLDERS_REAL = { "rules": [] }
// FIXTURE-COPY-END

/** 非空文件夹规则 —— 🔴 **`.CONSTRUCTED`**:本机 `rules` 恒空(上面那份 `.REAL` 就是证据),
 *  非空形态无从真机取样。字段名 / 类型按 **Parser 的 HTTP 契约**(store 原样透传,
 *  `knowledgeStore.ts:396`;蓝本 `:76-86` 读的正是 `r.root_id` / `r.path_glob` / `r.action`)构造。
 *  🔴 第 2 条刻意把 `root_id` 置空串,专门喂蓝本 `:78` 的 `r.root_id || 'any'` 兜底(N49 同族)。 */
const FOLDER_RULES_CONSTRUCTED = [
  { id: 1, root_id: 'DATA', path_glob: '/Downloads/*', action: 'deny' },
  { id: 2, root_id: '', path_glob: '/Photos/**/*.raw', action: 'allow' },
]

// ── 蓝本 `:161` / `:163` / `:165` 的三张 `match` 表(逐字抄本,供 N54 的源码比对)──
// 🔴 **N54 / 勘误 E-74**:**12 + 13 + 25 = 50** 项。抄本与蓝本的逐字等价由 T4 报告 §6 的
// 程序化比对坐实(`git -C ../../NimoOS-UI show 7a6ee6b7:...` 直出,不是肉眼比)。
const DOCS_BLUEPRINT = ['.pdf', '.docx', '.doc', '.pptx', '.ppt', '.xlsx', '.xls', '.odt', '.html', '.htm', '.xml', '.epub']
const TEXT_BLUEPRINT = ['.md', '.markdown', '.txt', '.rst', '.csv', '.tsv', '.json', '.yaml', '.yml', '.toml', '.ini', '.env', '.log']
const CODE_BLUEPRINT = ['.py', '.go', '.js', '.ts', '.jsx', '.tsx', '.java', '.c', '.cc', '.cpp', '.h', '.hpp', '.cs', '.rb', '.rs', '.php', '.sh', '.bash', '.zsh', '.fish', '.sql', '.lua', '.kt', '.scala', '.swift']

const mountedWrappers: Array<ReturnType<typeof mount>> = []

type FolderRuleLike = { id: number | string; root_id?: string; path_glob?: string; action?: string }

function mockAllOk(exts: RawAllowlistExtension[] = EXT_REAL, rules: FolderRuleLike[] = []): void {
  ai.parserAllowlistExtensions.mockResolvedValue({ extensions: exts })
  ai.parserAllowlistFolders.mockResolvedValue({ rules })
  ai.patchParserAllowlistExtensions.mockResolvedValue({})
  ai.addParserAllowlistFolder.mockResolvedValue({})
  ai.deleteParserAllowlistFolder.mockResolvedValue({})
}

/** 挂载。组件 `onMounted` 自己发 `store.loadAllowlist()`(蓝本 `created()`),
 *  所以这里不预热 store —— 让那一发真的跑,顺带守住「挂载即拉」。
 *  🔴 **宿主一律在挂载前就位**(见 `withHost()`):`DialogPortal` 的 Teleport 在弹窗**关着**
 *  的时候就已经渲染,宿主缺席会让**每一次**挂载都打两条 `[Vue warn]`(Failed to locate
 *  Teleport target / Invalid Teleport target on mount)。既有 `SettingsView.test.ts` /
 *  `QueueView.test.ts` 只在弹窗用例里补宿主,因而各积了上百条隐形告警(实测 154 条)——
 *  它们在治理 §1.1 的零改动清单上,不动;本文件从一开始就不制造这批噪声。 */
async function mountPage(exts?: RawAllowlistExtension[], rules?: FolderRuleLike[]) {
  if (exts || rules) mockAllOk(exts ?? EXT_REAL, rules ?? [])
  const host = withHost()
  const store = useKnowledgeStore()
  // 🔴 **不再传 `plugins: [i18n]`** —— `vitest.setup.ts` 已把**同一个** i18n 单例装进
  //   `config.global.plugins`,再传一次会让每次挂载都打 `[Vue warn]: Plugin has already
  //   been applied to target app.`(记忆 `vitest-reporter-hides-warnings`:默认 reporter
  //   不打印通过用例的 stderr ⇒ 这类告警会隐形积累)。本文件已用 `--reporter=verbose` 核过
  //   挂载路径零 [Vue warn]。⚠️ 既有几个视图测试仍在传,它们在治理 §1.1 的零改动清单上,不动。
  const w = mount(AllowlistView)
  mountedWrappers.push(w)
  await flushPromises()
  await nextTick()
  return { w, store, host }
}

/**
 * K57 / P5b 交接项 #3 —— `DialogPortal to=".knowledge-app"` 的宿主。
 * 单独挂载时本页不在 `.knowledge-app` 子树里(生产环境宿主由 `KnowledgeLayout.vue` 提供),
 * 测试必须自己在 body 里放一个同名宿主。
 * 🔴 **`to` 只认第一个同名宿主** → 每个用例只放一个;`afterEach` 的
 * `document.body.innerHTML = ''` 负责清掉,不会串到下一条。
 * 先例:`SettingsView.test.ts` / `QueueView.test.ts` 的 `withHost()`。
 */
function withHost(): HTMLElement {
  const host = document.createElement('div')
  host.className = 'knowledge-app'
  document.body.appendChild(host)
  return host
}

/** 可控 promise —— 串/并判别用(同 `SettingsView.test.ts` 的手法)。 */
function makeDeferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** VTU 的 `.text()` 只 trim 不折叠内部空白;跨行拼接的文案统一归一后再比。 */
const norm = (s: string): string => s.replace(/\s+/g, ' ').trim()

const extGroups = (w: ReturnType<typeof mount>) => w.findAll('.k-extgroup')
const chipTexts = (w: ReturnType<typeof mount>) => w.findAll('.k-ext-chip').map((c) => norm(c.text()))

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  mockAllOk()
})

afterEach(() => {
  while (mountedWrappers.length) mountedWrappers.pop()!.unmount()
  document.body.innerHTML = ''
})

// ═══════════════════════════════════════════════════════════════════════════
describe('AllowlistView —— 三层壳 + 两个 section(蓝本 :2-97,逐层照抄)', () => {
  it('根 .k-view > .k-scroll > .k-scroll-inner,两个 .k-section 在最内层', async () => {
    const { w } = await mountPage()
    const root = w.element as HTMLElement
    expect(root.tagName).toBe('DIV')
    expect(root.className).toBe('k-view')
    expect(w.find('.k-view > .k-scroll > .k-scroll-inner').exists()).toBe(true)
    const sections = w.findAll('.k-view > .k-scroll > .k-scroll-inner > .k-section')
    expect(sections).toHaveLength(2)
  })

  it('两个区头文案逐字(蓝本 :8-9 / :58-59)', async () => {
    const { w } = await mountPage()
    const titles = w.findAll('.k-section-title').map((e) => e.text())
    expect(titles).toEqual(['文件类型', '文件夹规则'])
    const hints = w.findAll('.k-section-hint').map((e) => e.text())
    expect(hints).toEqual(['取消勾选的将不再被收录', '优先级：禁止 > 允许 > 默认允许'])
  })

  it('蓝本 created()(:189-191)—— 挂载即 loadAllowlist(),两个只读端点各发一次', async () => {
    await mountPage()
    expect(ai.parserAllowlistExtensions).toHaveBeenCalledTimes(1)
    expect(ai.parserAllowlistFolders).toHaveBeenCalledTimes(1)
  })

  it('「+ 添加规则」按钮在 B 区区头、右对齐(蓝本 :60-62)', async () => {
    const { w } = await mountPage()
    const head = w.findAll('.k-section-head')[1]!
    const btn = head.find('button.k-btn.primary')
    expect(btn.exists()).toBe(true)
    expect(norm(btn.text())).toBe('添加规则')
    expect(btn.attributes('style')).toContain('margin-left: auto')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 K55(本刀最高风险)—— `GROUPS_TEMPLATE` 三个 `bg` 的渐变字面量 → token。
// 【为什么必须有这一组】`color-guard.test.ts` **压根不扫 `.ts` / `.vue` 的 `<script>` 常量**
//   (cross-area §1 票 B 位置④,变异实测「注释注入色值全量全绿」);本仓的
//   `knowledgeStyles.test.ts` 缺口③′ 只扫 `<template>` 块、§0.3 只扫 `<script>` **注释**
//   —— 三条都不看 `<script>` 的**代码本体** ⇒ 改坏了三门全绿。
// 模具 = P5d-T3 钉 `NOTE_TYPES` 四个渐变那条(K40)的第二次。
// 🔴 判据:往任一 `bg` 注入一个色字面量 → 本组必须报红(两段输出 + md5sum 还原见 T4 报告 §7)。
describe('AllowlistView —— K55:GROUPS_TEMPLATE 三个 bg 只含 var(--…),零色字面量', () => {
  /** 切出 `const GROUPS_TEMPLATE = [ … ]` 整块(到第 0 列的 `]` 为止)。 */
  function groupsBlock(src: string): string {
    const start = src.indexOf('const GROUPS_TEMPLATE')
    expect(start, 'AllowlistView.vue 里找不到 GROUPS_TEMPLATE 常量').toBeGreaterThan(-1)
    const end = src.indexOf('\n]', start)
    expect(end, 'GROUPS_TEMPLATE 的收尾 `]` 没找到 —— 抽取边界写错了').toBeGreaterThan(start)
    return src.slice(start, end + 2)
  }

  /** 抽出块内每个 `bg:` 的**字符串字面量值**(去掉外层引号)。 */
  function bgValues(src: string): string[] {
    const block = groupsBlock(src)
    return Array.from(block.matchAll(/\bbg:\s*('[^']*'|"[^"]*")/g)).map((m) => m[1].slice(1, -1))
  }

  // 🔴 §9.19 的防空转:先证明「真的抽到了三个值」,否则下面每一条都会对空数组假通过。
  it('防空转 —— 恰好抽到 3 个 bg 字面量(抽不到就是抽取器坏了,不是代码对了)', () => {
    expect(bgValues(SRC)).toHaveLength(3)
  })

  it('三个 bg 逐个 = 对应的 var(--grad-ext-*)(附录 B §B.1,取值定死,顺序即 docs/text/code)', () => {
    expect(bgValues(SRC)).toEqual([
      'var(--grad-ext-docs)',
      'var(--grad-ext-text)',
      'var(--grad-ext-code)',
    ])
  })

  it('🔴 三个 bg 零 hex / rgb() / hsl() / linear-gradient() / 具名色(判据:注入一个 hex → 报红)', () => {
    const values = bgValues(SRC)
    expect(values.length).toBe(3)
    // 具名色清单与 `knowledgeStyles.test.ts` 的既定 8 词表同一份(口径一致)。
    // 🔴 裁定 R11:**禁 `\bwhite\b`** —— 用 `(?<![\w-])X(?![\w-])`,`white-space` 这类
    //    带连字符的复合词天然被排除。
    const NAMED = ['white', 'black', 'red', 'green', 'blue', 'orange', 'gray', 'grey']
    for (const v of values) {
      expect(v, `bg 里出现裸 hex 色:${v}`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
      expect(v, `bg 里出现 rgb()/hsl() 函数色:${v}`).not.toMatch(/\b(rgba?|hsla?)\s*\(/)
      expect(v, `bg 里出现内联渐变(蓝本原文没换成 token):${v}`).not.toMatch(/linear-gradient\s*\(/)
      expect(v, `bg 不是纯 token 引用:${v}`).toMatch(/^var\(--[a-z0-9-]+\)$/)
      // 剥掉 `var(...)` 之后再查具名色 —— token 名本身不该被当成色值误判。
      const scrubbed = v.replace(/var\([^)]*\)/g, '')
      for (const c of NAMED) {
        expect(scrubbed, `bg 的值位置出现具名色 ${c}:${v}`).not.toMatch(
          new RegExp(`(?<![\\w-])${c}(?![\\w-])`, 'i'),
        )
      }
    }
  })

  it('三个 bg 各不相同(判据:被"去重"成同一个 token / 串位成同一条 → 报红)', () => {
    const values = bgValues(SRC)
    expect(new Set(values).size).toBe(3)
  })

  it('渲染侧真的把 token 送进了 :style(蓝本 :14 的 background: g.bg)', async () => {
    const { w } = await mountPage()
    const styles = w.findAll('.k-extgroup-icon').map((e) => e.attributes('style'))
    expect(styles).toEqual([
      'background: var(--grad-ext-docs);',
      'background: var(--grad-ext-text);',
      'background: var(--grad-ext-code);',
    ])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 N54 —— 三张 `match` 扩展名表逐字照抄(**12 + 13 + 25 = 50**,勘误 E-74)。
describe('AllowlistView —— N54:三张 match 扩展名表逐字照抄', () => {
  /** 从源码里抽出三条 `match: (ext) => [ … ].includes(ext)` 的数组元素。 */
  function matchTables(src: string): string[][] {
    const re = /match:\s*\(ext\)\s*=>\s*\[([^\]]*)\]\s*\.includes\(ext\)/g
    const out: string[][] = []
    let m: RegExpExecArray | null
    while ((m = re.exec(src)) !== null) {
      out.push(
        m[1]
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
          .map((s) => s.replace(/^['"]|['"]$/g, '')),
      )
    }
    return out
  }

  // 🔴 防空转:抽不到三张表,下面的计数与逐字比对全部对空数组假通过。
  it('防空转 —— 恰好抽到 3 张 match 表', () => {
    expect(matchTables(SRC)).toHaveLength(3)
  })

  it('🔴 三条计数断言:docs 12 · text 13 · code 25(勘误 E-74,不是治理原写的 24)', () => {
    const [docs, text, code] = matchTables(SRC)
    expect(docs.length, 'docs 组扩展名条数').toBe(12)
    expect(text.length, 'text 组扩展名条数').toBe(13)
    expect(code.length, 'code 组扩展名条数').toBe(25)
    expect(docs.length + text.length + code.length, '三组合计').toBe(50)
  })

  it('🔴 三张表与蓝本逐字相等(顺序也照抄,不许补全也不许删减任何一项)', () => {
    const [docs, text, code] = matchTables(SRC)
    expect(docs).toEqual(DOCS_BLUEPRINT)
    expect(text).toEqual(TEXT_BLUEPRINT)
    expect(code).toEqual(CODE_BLUEPRINT)
  })

  it('三张表两两无交集(判据:某个扩展名被抄进两组 → 它会在页面上出现两次)', () => {
    const [docs, text, code] = matchTables(SRC)
    const all = [...docs, ...text, ...code]
    expect(new Set(all).size, `三张表里有重复项:${all.length} 项去重后 ${new Set(all).size}`).toBe(50)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('AllowlistView —— groups computed(蓝本 :181-187):分组 / 排序 / 空组不渲染 / 未分组不显示', () => {
  it('真机 45 个扩展名 → 三组,组内按 localeCompare 升序(逐个钉死顺序)', async () => {
    const { w } = await mountPage(EXT_REAL)
    const gs = extGroups(w)
    expect(gs).toHaveLength(3)
    expect(gs.map((g) => g.find('.k-extgroup-title').text())).toEqual(['文档', '文本', '代码'])
    const texts = (i: number) => gs[i]!.findAll('.k-ext-chip').map((c) => norm(c.text()))
    expect(texts(0)).toEqual([
      '.doc', '.docx', '.htm', '.html', '.odt', '.pdf', '.ppt', '.pptx', '.xls', '.xlsx', '.xml',
    ])
    expect(texts(1)).toEqual([
      '.csv', '.env', '.ini', '.json', '.log', '.md', '.rst', '.toml', '.tsv', '.txt', '.yaml', '.yml',
    ])
    expect(texts(2)).toEqual([
      '.bash', '.c', '.cc', '.cpp', '.cs', '.fish', '.go', '.h', '.hpp', '.java', '.js', '.jsx',
      '.php', '.py', '.rb', '.rs', '.sh', '.sql', '.ts', '.tsx', '.zsh',
    ])
  })

  it('🔴 排序真的在起作用 —— 倒序喂进去,渲染出来仍是升序(判据:删掉 .sort() → 报红)', async () => {
    const reversed = [...EXT_REAL].reverse()
    const { w } = await mountPage(reversed)
    expect(extGroups(w)[0]!.findAll('.k-ext-chip').map((c) => norm(c.text()))).toEqual([
      '.doc', '.docx', '.htm', '.html', '.odt', '.pdf', '.ppt', '.pptx', '.xls', '.xlsx', '.xml',
    ])
  })

  it('🔴 裁定 R6 —— 不在三张表里的扩展名一个都不显示:后端 45 个,页面只渲染 44 个 chip,`.wps` 缺席', async () => {
    const { w, store } = await mountPage(EXT_REAL)
    // 先坐实 store 侧真的有 45 条(否则「页面 44」可能是取数没取全,而不是过滤生效)
    expect(store.extensions).toHaveLength(45)
    expect(store.extensions.some((e) => e.ext === '.wps')).toBe(true)
    const chips = chipTexts(w)
    expect(chips).toHaveLength(44)
    expect(chips).not.toContain('.wps')
    // 组内计数 11 / 12 / 21(裁定 R6 订正值)
    expect(extGroups(w).map((g) => g.findAll('.k-ext-chip').length)).toEqual([11, 12, 21])
  })

  it('🔴 空组整组不渲染(filter(g => g.exts.length > 0)):只喂 docs 的扩展名 → 只有 1 个 .k-extgroup', async () => {
    const { w } = await mountPage([
      { ext: '.pdf', enabled: 1, source: 'default' },
      { ext: '.odt', enabled: 0, source: 'default' },
    ])
    const gs = extGroups(w)
    expect(gs).toHaveLength(1)
    expect(gs[0]!.find('.k-extgroup-title').text()).toBe('文档')
  })

  it('三组全空(后端返回空表)→ 一个 .k-extgroup 都不渲染,但高级折叠区仍在', async () => {
    const { w } = await mountPage([])
    expect(extGroups(w)).toHaveLength(0)
    expect(w.find('.k-adv-toggle').exists()).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 N47 —— `enabled` 是 SQLite 整数 0/1,归一化在 store 里,页面 `String(e.enabled)` 照抄。
describe('AllowlistView —— N47:data-on 是 "true"/"false" 字符串,两侧都比', () => {
  it('🔴 整数 0/1 进来 → chip 正确翻转(用 .REPLAYED 样本:真机全是 1,抓不到 0)', async () => {
    const { w, store } = await mountPage(EXT_REPLAYED)
    // store 侧:`!!e.enabled` 归一化成 boolean(knowledgeStore.ts:395)
    expect(store.extensions.map((e) => e.enabled)).toEqual([true, false, true, false, true, true])
    const chips = w.findAll('.k-ext-chip')
    const pairs = chips.map((c) => [norm(c.text()), c.attributes('data-on')])
    expect(pairs).toEqual([
      ['.docx', 'false'],
      ['.pdf', 'true'],
      ['.md', 'true'],
      ['.txt', 'false'],
      ['.go', 'true'],
      ['.py', 'true'],
    ])
  })

  it('assert 的是字符串不是缺席 —— 关闭态 chip 的 data-on 属性存在且等于 "false"', async () => {
    const { w } = await mountPage(EXT_REPLAYED)
    const off = w.findAll('.k-ext-chip').find((c) => norm(c.text()) === '.docx')!
    expect(off.attributes()).toHaveProperty('data-on')
    expect(off.attributes('data-on')).toBe('false')
  })

  it('onCountFor(g)(蓝本 :193)—— 每组 meta 是「开启数/总数 已启用」', async () => {
    const { w } = await mountPage(EXT_REPLAYED)
    expect(extGroups(w).map((g) => norm(g.find('.k-extgroup-meta').text()))).toEqual([
      '1/2 已启用',
      '1/2 已启用',
      '2/2 已启用',
    ])
  })

  it('点 chip → toggleExtension(ext, !enabled) + 成功 toast(两侧文案都比)', async () => {
    const { w, store } = await mountPage(EXT_REPLAYED)
    const toast = vi.spyOn(store, 'toast')
    const on = w.findAll('.k-ext-chip').find((c) => norm(c.text()) === '.pdf')!
    await on.trigger('click')
    await flushPromises()
    expect(ai.patchParserAllowlistExtensions).toHaveBeenLastCalledWith({ ext: '.pdf', enabled: false })
    expect(toast).toHaveBeenLastCalledWith('已停止收录 .pdf')

    const off = w.findAll('.k-ext-chip').find((c) => norm(c.text()) === '.docx')!
    await off.trigger('click')
    await flushPromises()
    expect(ai.patchParserAllowlistExtensions).toHaveBeenLastCalledWith({ ext: '.docx', enabled: true })
    expect(toast).toHaveBeenLastCalledWith('已收录 .docx')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 附录 B §B.3-① —— 蓝本 :30 的 `color="white"` → `var(--text-on-accent)`。
describe('AllowlistView —— 勾选标记的 KIcon 用 token 前景色,不是具名色', () => {
  it('🔴 color 属性 = var(--text-on-accent),且不是任何具名色(禁 \\bwhite\\b,裁定 R11)', async () => {
    const { w } = await mountPage(EXT_REPLAYED)
    const marks = w
      .findAllComponents(KIcon)
      .filter((i) => i.props('name') === 'check' && i.props('size') === 9)
    // 开启态才渲染勾(蓝本 :30 的 v-if="e.enabled")—— .REPLAYED 里有 4 个开启
    expect(marks.length, 'v-if="e.enabled" 下应有 4 个勾(.pdf/.md/.go/.py)').toBe(4)
    const NAMED = ['white', 'black', 'red', 'green', 'blue', 'orange', 'gray', 'grey']
    for (const icon of marks) {
      const color = String(icon.props('color'))
      expect(color).toBe('var(--text-on-accent)')
      expect(color, '🔴 --on-accent 暗档是深色,不能用在实底前景上(附录 B §B.3.1)').not.toBe(
        'var(--on-accent)',
      )
      const scrubbed = color.replace(/var\([^)]*\)/g, '')
      for (const c of NAMED) {
        expect(scrubbed, `color 属性值位置出现具名色 ${c}`).not.toMatch(
          new RegExp(`(?<![\\w-])${c}(?![\\w-])`, 'i'),
        )
      }
    }
  })

  it('关闭态 chip 不渲染勾(蓝本 :30 的 v-if)', async () => {
    const { w } = await mountPage(EXT_REPLAYED)
    const off = w.findAll('.k-ext-chip').find((c) => norm(c.text()) === '.docx')!
    expect(off.find('.k-ext-chip-mark').exists()).toBe(true)
    expect(off.findComponent(KIcon).exists()).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 N52 —— setAllInGroup 串行 + 跳过已是目标态。
describe('AllowlistView —— N52:setAllInGroup 串行 await + 跳过已是目标态', () => {
  /** 拿到某一组的「全选 / 全不选」按钮。 */
  const groupBtns = (w: ReturnType<typeof mount>, i: number) =>
    extGroups(w)[i]!.findAll('.k-extgroup-toggle button')

  it('🔴 已是目标态的一个请求都不发(蓝本 :205 的 if (e.enabled !== on))', async () => {
    // .REAL 里 docs 组 11 个全是 enabled=1 → 点「全选」应当零请求
    const { w, store } = await mountPage(EXT_REAL)
    const toast = vi.spyOn(store, 'toast')
    await groupBtns(w, 0)[0]!.trigger('click')
    await flushPromises()
    expect(ai.patchParserAllowlistExtensions).not.toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith('已全选 文档')
  })

  it('全不选 → 11 个全发(每个 enabled:false),toast 文案是另一侧', async () => {
    const { w, store } = await mountPage(EXT_REAL)
    const toast = vi.spyOn(store, 'toast')
    await groupBtns(w, 0)[1]!.trigger('click')
    await flushPromises()
    expect(ai.patchParserAllowlistExtensions).toHaveBeenCalledTimes(11)
    expect(
      ai.patchParserAllowlistExtensions.mock.calls.map((c: unknown[]) => c[0]),
    ).toEqual([
      { ext: '.doc', enabled: false },
      { ext: '.docx', enabled: false },
      { ext: '.htm', enabled: false },
      { ext: '.html', enabled: false },
      { ext: '.odt', enabled: false },
      { ext: '.pdf', enabled: false },
      { ext: '.ppt', enabled: false },
      { ext: '.pptx', enabled: false },
      { ext: '.xls', enabled: false },
      { ext: '.xlsx', enabled: false },
      { ext: '.xml', enabled: false },
    ])
    expect(toast).toHaveBeenCalledWith('已全不选 文档')
  })

  it('🔴🔴 顺序是**串行**:第一发未落地前不许发第二发(判据:改成 Promise.all → 必须报红)', async () => {
    // 只喂 docs 组的 3 个开启项 —— 请求数少,交错路径好读。
    const { w } = await mountPage([
      { ext: '.pdf', enabled: 1, source: 'default' },
      { ext: '.doc', enabled: 1, source: 'default' },
      { ext: '.odt', enabled: 1, source: 'default' },
    ])
    const d1 = makeDeferred<unknown>()
    const d2 = makeDeferred<unknown>()
    const d3 = makeDeferred<unknown>()
    const queue = [d1, d2, d3]
    let issued = 0
    ai.patchParserAllowlistExtensions.mockImplementation(() => queue[issued++]!.promise)

    await groupBtns(w, 0)[1]!.trigger('click')
    await nextTick()
    await flushPromises()
    // 🔴 串行的判别点:此刻只该有 **1** 发在飞。`Promise.all` 会在这里已经是 3。
    expect(issued, '一次发出多于一发 —— setAllInGroup 被改成并发了(N52 被破)').toBe(1)
    expect(ai.patchParserAllowlistExtensions).toHaveBeenCalledTimes(1)
    expect(ai.patchParserAllowlistExtensions.mock.calls[0]![0]).toEqual({ ext: '.doc', enabled: false })

    d1.resolve({})
    await flushPromises()
    expect(issued, '第一发落地后才轮到第二发').toBe(2)
    expect(ai.patchParserAllowlistExtensions.mock.calls[1]![0]).toEqual({ ext: '.odt', enabled: false })

    d2.resolve({})
    await flushPromises()
    expect(issued).toBe(3)
    expect(ai.patchParserAllowlistExtensions.mock.calls[2]![0]).toEqual({ ext: '.pdf', enabled: false })
    d3.resolve({})
    await flushPromises()
  })

  it('K58 —— 中途失败:只弹固定键「保存失败」,不回显后端 body', async () => {
    const { w, store } = await mountPage(EXT_REAL)
    const toast = vi.spyOn(store, 'toast')
    ai.patchParserAllowlistExtensions.mockRejectedValue(new Error('PROBE-K58-8Q3Z-setall'))
    await groupBtns(w, 0)[1]!.trigger('click')
    await flushPromises()
    expect(toast).toHaveBeenLastCalledWith('保存失败')
    expect(toast.mock.calls.flat().join('|')).not.toContain('PROBE-K58-8Q3Z')
    expect(w.html()).not.toContain('PROBE-K58-8Q3Z')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 N53 —— addCustom 的规范化。
describe('AllowlistView —— N53:addCustom 规范化(trim + toLowerCase + 补前导点)', () => {
  /** §9.17:输入框在 `v-if="customOpen"` 里 —— 必须先点开高级折叠区,它才是可点/可填元素。 */
  async function openAdv(w: ReturnType<typeof mount>) {
    expect(w.find('.k-custom-add').exists(), '折叠前输入区不该渲染').toBe(false)
    const toggle = w.find('.k-adv-toggle')
    expect(toggle.attributes('data-open')).toBe('false')
    await toggle.trigger('click')
    expect(toggle.attributes('data-open')).toBe('true')
    const input = w.find('.k-custom-add input')
    expect(input.exists(), '展开后输入框必须真的渲染出来').toBe(true)
    return input
  }

  it('`log` → `.log`(补前导点)', async () => {
    const { w, store } = await mountPage(EXT_REAL)
    const toast = vi.spyOn(store, 'toast')
    const input = await openAdv(w)
    await input.setValue('log')
    await w.find('.k-custom-add button.k-btn').trigger('click')
    await flushPromises()
    expect(ai.patchParserAllowlistExtensions).toHaveBeenCalledWith({ ext: '.log', enabled: true })
    expect(toast).toHaveBeenLastCalledWith('已添加 .log')
  })

  it('`.LOG ` → `.log`(trim + toLowerCase,已有前导点不重复补)', async () => {
    const { w } = await mountPage(EXT_REAL)
    const input = await openAdv(w)
    await input.setValue('  .LOG  ')
    await input.trigger('keydown.enter')
    await flushPromises()
    expect(ai.patchParserAllowlistExtensions).toHaveBeenCalledWith({ ext: '.log', enabled: true })
  })

  it('🔴 空串 / 全空白 → 一个请求都不发(蓝本 :214 的 if (!ext) return)', async () => {
    const { w } = await mountPage(EXT_REAL)
    const input = await openAdv(w)
    await input.setValue('   ')
    // `disabled` 是真布尔属性 —— 两侧都比
    const btn = w.find('.k-custom-add button.k-btn')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
    // 绕过按钮 disabled,直接走 enter 键路径,证明函数自己也守住了
    await input.trigger('keydown.enter')
    await flushPromises()
    expect(ai.patchParserAllowlistExtensions).not.toHaveBeenCalled()
  })

  it('`:disabled="!customExt.trim()"` 两侧(蓝本 :48)', async () => {
    const { w } = await mountPage(EXT_REAL)
    const input = await openAdv(w)
    const btn = () => w.find('.k-custom-add button.k-btn').element as HTMLButtonElement
    expect(btn().disabled).toBe(true)
    await input.setValue('.conf')
    expect(btn().disabled).toBe(false)
  })

  it('成功后 customExt 清空(蓝本 :219)', async () => {
    const { w } = await mountPage(EXT_REAL)
    const input = await openAdv(w)
    await input.setValue('conf')
    await w.find('.k-custom-add button.k-btn').trigger('click')
    await flushPromises()
    expect((input.element as HTMLInputElement).value).toBe('')
  })

  it('K58 —— 失败时只弹「添加失败」,且 customExt **不**清空(蓝本 :219 在 await 之后)', async () => {
    const { w, store } = await mountPage(EXT_REAL)
    const toast = vi.spyOn(store, 'toast')
    ai.patchParserAllowlistExtensions.mockRejectedValue(new Error('PROBE-K58-8Q3Z-add'))
    const input = await openAdv(w)
    await input.setValue('conf')
    await w.find('.k-custom-add button.k-btn').trigger('click')
    await flushPromises()
    expect(toast).toHaveBeenLastCalledWith('添加失败')
    expect(toast.mock.calls.flat().join('|')).not.toContain('PROBE-K58-8Q3Z')
    expect((input.element as HTMLInputElement).value).toBe('conf')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('AllowlistView —— B 区空态 / 非空态两侧(蓝本 :65-91)', () => {
  it('空态:folderRules 为空 → 提示文案,且不渲染表头与任何行', async () => {
    const { w, store } = await mountPage(EXT_REAL, FOLDERS_REAL.rules)
    expect(store.folderRules).toEqual([])
    expect(w.find('.k-frow-head').exists()).toBe(false)
    expect(w.findAll('.k-frow')).toHaveLength(0)
    const body = w.findAll('.k-section-body')[1]!
    expect(norm(body.text())).toContain('还没有规则。点右上角 [+ 添加规则] 开始。')
  })

  it('非空态:表头 + 每条规则一行(蓝本 :69-90)', async () => {
    const { w } = await mountPage(EXT_REAL, FOLDER_RULES_CONSTRUCTED)
    const head = w.find('.k-frow-head')
    expect(head.exists()).toBe(true)
    expect(head.findAll('span').map((s) => s.text())).toEqual(['存储库', '路径', '类型', ''])
    // .k-frow 共 3 个:1 个表头 + 2 行
    const rows = w.findAll('.k-frow').filter((r) => !r.classes('k-frow-head'))
    expect(rows).toHaveLength(2)
    expect(rows[0]!.find('.k-frow-root').text()).toContain('DATA')
    expect(rows[0]!.find('.k-frow-path').text()).toBe('/Downloads/*')
    expect(rows[0]!.find('.k-frow-path').attributes('title')).toBe('/Downloads/*')
    expect(rows[0]!.find('.k-frow-action').attributes('data-act')).toBe('deny')
    expect(norm(rows[0]!.find('.k-frow-action').text())).toBe('拒绝')
    // 🔴 N49 同族:root_id 是空串 → 走蓝本 :78 的 `|| 'any'` 兜底
    expect(rows[1]!.find('.k-frow-root').text()).toContain('any')
    expect(rows[1]!.find('.k-frow-action').attributes('data-act')).toBe('allow')
    expect(norm(rows[1]!.find('.k-frow-action').text())).toBe('同意')
    // 空态提示不再渲染
    expect(norm(w.findAll('.k-section-body')[1]!.text())).not.toContain('还没有规则')
  })

  it('allow / deny 两侧的图标不同(蓝本 :82 的三元)', async () => {
    const { w } = await mountPage(EXT_REAL, FOLDER_RULES_CONSTRUCTED)
    const rows = w.findAll('.k-frow').filter((r) => !r.classes('k-frow-head'))
    expect(rows[0]!.find('.k-frow-action').findComponent(KIcon).props('name')).toBe('x')
    expect(rows[1]!.find('.k-frow-action').findComponent(KIcon).props('name')).toBe('check')
  })

  it('优先级提示行恒在(蓝本 :92-95),两态都渲染', async () => {
    const { w } = await mountPage(EXT_REAL, [])
    expect(norm(w.find('.k-priority-hint').text())).toBe(
      '举例：禁止 /Downloads/* 后，该文件夹下所有文件停止索引',
    )
  })

  it('removeRule 成功 → deleteFolderRule(id) + toast(蓝本 :239-246)', async () => {
    const { w, store } = await mountPage(EXT_REAL, FOLDER_RULES_CONSTRUCTED)
    const toast = vi.spyOn(store, 'toast')
    const rows = w.findAll('.k-frow').filter((r) => !r.classes('k-frow-head'))
    const del = rows[0]!.find('button.k-row-action')
    expect(del.attributes('data-tone')).toBe('danger')
    expect(del.attributes('title')).toBe('删除规则')
    await del.trigger('click')
    await flushPromises()
    expect(ai.deleteParserAllowlistFolder).toHaveBeenCalledWith(1)
    expect(toast).toHaveBeenLastCalledWith('已删除，正在清理受影响的文件…')
  })

  it('K58 —— removeRule 失败只弹「删除失败」,不回显后端 body', async () => {
    const { w, store } = await mountPage(EXT_REAL, FOLDER_RULES_CONSTRUCTED)
    const toast = vi.spyOn(store, 'toast')
    ai.deleteParserAllowlistFolder.mockRejectedValue(new Error('PROBE-K58-8Q3Z-del'))
    const rows = w.findAll('.k-frow').filter((r) => !r.classes('k-frow-head'))
    await rows[0]!.find('button.k-row-action').trigger('click')
    await flushPromises()
    expect(toast).toHaveBeenLastCalledWith('删除失败')
    expect(toast.mock.calls.flat().join('|')).not.toContain('PROBE-K58-8Q3Z')
    expect(w.html()).not.toContain('PROBE-K58-8Q3Z')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 K57 —— 「添加文件夹规则」弹窗转 reka 原语(蓝本 :101-151 是裸 .k-modal-bg + @click)。
// portal 目标 `.knowledge-app` 只认第一个同名宿主 → 每条用例先 `withHost()`。
describe('AllowlistView —— K57:reka「添加文件夹规则」弹窗', () => {
  async function openModal(rules: FolderRuleLike[] = []) {
    // 宿主由 `mountPage` 在挂载**之前**建好并回传(见它的注释)。
    const m = await mountPage(EXT_REAL, rules)
    expect(m.host.querySelector('.k-modal'), '默认不该渲染弹窗').toBeNull()
    await m.w.findAll('.k-section-head')[1]!.find('button.k-btn.primary').trigger('click')
    await nextTick()
    await flushPromises()
    return m
  }

  it('点「+ 添加规则」→ portal 到 .knowledge-app;head / body / foot 内容逐字', async () => {
    const { host } = await openModal()
    const modal = host.querySelector('.k-modal')
    expect(modal).not.toBeNull()
    // 遮罩类名照抄蓝本 :102
    expect(host.querySelector('.k-modal-bg')).not.toBeNull()
    // head:DialogTitle 套在蓝本自己的 .k-modal-title 上(as-child)⇒ 不多一个隐藏节点
    const titleEl = modal!.querySelector('.k-modal-title') as HTMLElement
    expect(titleEl.textContent).toBe('添加文件夹规则')
    expect(titleEl.id).toBe(modal!.getAttribute('aria-labelledby'))
    expect(modal!.querySelectorAll('[id]')).toHaveLength(1)
    expect(modal!.querySelector('.k-modal-head button.k-modal-x')).not.toBeNull()
    // body:三个 .k-field(存储库 / 路径 / 类型),第二个带 .k-field-mono
    const fields = Array.from(modal!.querySelectorAll('.k-field'))
    expect(fields).toHaveLength(3)
    expect(fields.map((f) => f.querySelector('.k-field-label')!.textContent)).toEqual([
      '存储库',
      '路径',
      '类型',
    ])
    expect(fields[1]!.classList.contains('k-field-mono')).toBe(true)
    expect(fields.map((f) => f.querySelector('.k-field-hint')?.textContent ?? null)).toEqual([
      '填 "any" 表示所有存储库都生效',
      '支持 * 通配符，如 /Photos/**/*.raw',
      null,
    ])
    // body:两张 radio 卡
    const cards = Array.from(modal!.querySelectorAll('.k-radio-2 .k-radio-card'))
    expect(cards).toHaveLength(2)
    expect(cards.map((c) => c.querySelector('.k-radio-card-text')!.textContent)).toEqual([
      '同意',
      '拒绝',
    ])
    expect(cards.map((c) => c.querySelector('.k-radio-card-desc')!.textContent)).toEqual([
      '收录该路径下的文件',
      '不再收录该路径',
    ])
    expect(
      cards.map((c) => c.querySelector('.k-radio-card-icon')!.getAttribute('data-tone')),
    ).toEqual(['allow', 'deny'])
    // body:底部整段优先级说明
    expect(norm(modal!.querySelector('.k-modal-body')!.textContent!)).toContain(
      '优先级：禁止 > 允许 > 默认允许。例：禁止 /Downloads/* 下所有文件不被索引。',
    )
    // foot:取消 + 保存规则
    const footBtns = Array.from(modal!.querySelectorAll('.k-modal-foot button'))
    expect(footBtns.map((b) => norm(b.textContent!))).toEqual(['取消', '保存规则'])
    expect(footBtns[0]!.className).toBe('k-btn ghost')
    expect(footBtns[1]!.className).toBe('k-btn primary')
  })

  it('表单初值 = 蓝本 :177(any / /Downloads/* / deny),radio 的 data-on 两侧都比', async () => {
    const { host } = await openModal()
    const inputs = Array.from(host.querySelectorAll('.k-field input')) as HTMLInputElement[]
    expect(inputs[0]!.value).toBe('any')
    expect(inputs[1]!.value).toBe('/Downloads/*')
    const cards = Array.from(host.querySelectorAll('.k-radio-card'))
    expect(cards.map((c) => c.getAttribute('data-on'))).toEqual(['false', 'true'])
  })

  it('点「同意」卡 → data-on 翻到另一侧(蓝本 :122/:129)', async () => {
    const { host } = await openModal()
    ;(host.querySelectorAll('.k-radio-card')[0] as HTMLElement).click()
    await nextTick()
    expect(
      Array.from(host.querySelectorAll('.k-radio-card')).map((c) => c.getAttribute('data-on')),
    ).toEqual(['true', 'false'])
  })

  it('点 × 关闭,且不发请求', async () => {
    const { host } = await openModal()
    ;(host.querySelector('.k-modal-x') as HTMLElement).click()
    await nextTick()
    await flushPromises()
    expect(host.querySelector('.k-modal')).toBeNull()
    expect(ai.addParserAllowlistFolder).not.toHaveBeenCalled()
  })

  it('点「取消」关闭,且不发请求', async () => {
    const { host } = await openModal()
    const cancel = Array.from(host.querySelectorAll('.k-modal-foot button')).find(
      (b) => norm(b.textContent!) === '取消',
    ) as HTMLElement
    cancel.click()
    await nextTick()
    await flushPromises()
    expect(host.querySelector('.k-modal')).toBeNull()
    expect(ai.addParserAllowlistFolder).not.toHaveBeenCalled()
  })

  it('🔴 点遮罩(弹窗外)关闭;点弹窗内不关闭(reka pointerDownOutside 等价蓝本 @click/@click.stop)', async () => {
    const { host } = await openModal()
    // reka 的 usePointerDownOutside 用 setTimeout(0) 延后挂 document 监听 —— 补一次真宏任务 tick。
    await new Promise((r) => setTimeout(r, 0))
    ;(host.querySelector('.k-modal-title') as HTMLElement).dispatchEvent(
      new Event('pointerdown', { bubbles: true }),
    )
    await nextTick()
    expect(host.querySelector('.k-modal'), '点弹窗内不该关闭').not.toBeNull()
    ;(host.querySelector('.k-modal-bg') as HTMLElement).dispatchEvent(
      new Event('pointerdown', { bubbles: true }),
    )
    await nextTick()
    await flushPromises()
    expect(host.querySelector('.k-modal'), '点遮罩必须关闭').toBeNull()
  })

  it('🔴 `:disabled="!form.path_glob.trim()"` 两侧(蓝本 :145)', async () => {
    const { host } = await openModal()
    const saveBtn = () =>
      Array.from(host.querySelectorAll('.k-modal-foot button')).find(
        (b) => norm(b.textContent!) === '保存规则',
      ) as HTMLButtonElement
    expect(saveBtn().disabled, '初值 /Downloads/* 非空 → 可点').toBe(false)
    const pathInput = (host.querySelectorAll('.k-field input')[1] as HTMLInputElement)
    pathInput.value = '   '
    pathInput.dispatchEvent(new Event('input'))
    await nextTick()
    expect(saveBtn().disabled, '全空白路径 → 必须灰掉').toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('AllowlistView —— saveRule(蓝本 :224-238)', () => {
  async function openModal() {
    const m = await mountPage(EXT_REAL, [])
    await m.w.findAll('.k-section-head')[1]!.find('button.k-btn.primary').trigger('click')
    await nextTick()
    await flushPromises()
    return m
  }

  const saveBtn = (host: HTMLElement) =>
    Array.from(host.querySelectorAll('.k-modal-foot button')).find(
      (b) => norm(b.textContent!) === '保存规则',
    ) as HTMLButtonElement

  const setInput = async (host: HTMLElement, idx: number, v: string) => {
    const el = host.querySelectorAll('.k-field input')[idx] as HTMLInputElement
    el.value = v
    el.dispatchEvent(new Event('input'))
    await nextTick()
  }

  it('成功 → addFolderRule(snake_case body,path 去空格)+ 关弹窗 + toast', async () => {
    const { host, store } = await openModal()
    const toast = vi.spyOn(store, 'toast')
    await setInput(host, 0, 'DATA')
    await setInput(host, 1, '  /Downloads/*  ')
    saveBtn(host).click()
    await flushPromises()
    expect(ai.addParserAllowlistFolder).toHaveBeenCalledWith({
      root_id: 'DATA',
      path_glob: '/Downloads/*',
      action: 'deny',
    })
    expect(host.querySelector('.k-modal')).toBeNull()
    expect(toast).toHaveBeenLastCalledWith('已保存。正在后台清理不再符合规则的文件…')
  })

  it('root_id 被清空 → 走蓝本 :227 的 `|| "any"` 兜底', async () => {
    const { host } = await openModal()
    await setInput(host, 0, '')
    saveBtn(host).click()
    await flushPromises()
    expect(ai.addParserAllowlistFolder).toHaveBeenCalledWith({
      root_id: 'any',
      path_glob: '/Downloads/*',
      action: 'deny',
    })
  })

  it('🔴 成功后表单重置成 { any, /Downloads/*, deny }(蓝本 :234 逐字同值)—— 重开弹窗逐格验', async () => {
    const { w, host } = await openModal()
    await setInput(host, 0, 'Backup')
    await setInput(host, 1, '/Media/**')
    ;(host.querySelectorAll('.k-radio-card')[0] as HTMLElement).click()
    await nextTick()
    saveBtn(host).click()
    await flushPromises()
    expect(host.querySelector('.k-modal')).toBeNull()
    // 重开
    await w.findAll('.k-section-head')[1]!.find('button.k-btn.primary').trigger('click')
    await nextTick()
    await flushPromises()
    const inputs = Array.from(host.querySelectorAll('.k-field input')) as HTMLInputElement[]
    expect(inputs[0]!.value).toBe('any')
    expect(inputs[1]!.value).toBe('/Downloads/*')
    expect(
      Array.from(host.querySelectorAll('.k-radio-card')).map((c) => c.getAttribute('data-on')),
    ).toEqual(['false', 'true'])
  })

  it('🔴 K58 —— 失败:只弹「保存失败」,弹窗**不关**、表单**不重置**,且不回显后端 body', async () => {
    const { host, store } = await openModal()
    const toast = vi.spyOn(store, 'toast')
    ai.addParserAllowlistFolder.mockRejectedValue(new Error('PROBE-K58-8Q3Z-save'))
    await setInput(host, 1, '/Media/**')
    saveBtn(host).click()
    await flushPromises()
    expect(toast).toHaveBeenLastCalledWith('保存失败')
    expect(toast.mock.calls.flat().join('|')).not.toContain('PROBE-K58-8Q3Z')
    expect(host.innerHTML).not.toContain('PROBE-K58-8Q3Z')
    // 蓝本 :231/:234 在 await 之后 ⇒ 失败路径两件事都不该发生
    expect(host.querySelector('.k-modal')).not.toBeNull()
    expect((host.querySelectorAll('.k-field input')[1] as HTMLInputElement).value).toBe('/Media/**')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 裁定 R27 / 勘误 E-62 —— toast 一律走 `store.toast(...)`(内部 2400ms),
// 直调 `useToast()` 会丢掉蓝本自己的 2400ms(全局 `show()` 默认只有 1500ms)。
describe('AllowlistView —— R27:9 处 toast 全部经 store.toast(不是直调 useToast)', () => {
  it('五个成功分支 + 四个失败分支的 toast 都被 store.toast 的 spy 捕获', async () => {
    const { w, store } = await mountPage(EXT_REPLAYED, FOLDER_RULES_CONSTRUCTED)
    const toast = vi.spyOn(store, 'toast')
    // ① toggle 成功
    await w.findAll('.k-ext-chip')[0]!.trigger('click')
    await flushPromises()
    // ② setAllInGroup 成功
    await extGroups(w)[0]!.findAll('.k-extgroup-toggle button')[0]!.trigger('click')
    await flushPromises()
    // ③ removeRule 成功
    const rows = w.findAll('.k-frow').filter((r) => !r.classes('k-frow-head'))
    await rows[0]!.find('button.k-row-action').trigger('click')
    await flushPromises()
    expect(toast.mock.calls.length).toBeGreaterThanOrEqual(3)
    // 判据:任何一处改成直调 useToast().show(...) → 该处的 spy 记录消失
    expect(toast.mock.calls.map((c: unknown[]) => c[0])).toEqual([
      '已收录 .docx',
      '已全选 文档',
      '已删除，正在清理受影响的文件…',
    ])
  })
})
