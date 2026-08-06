// SP8-P5c Task 3(半二)—— `FolderBrowser.vue` 组件测试。
// 蓝本 `NimoOS-UI` (main@7a6ee6b7) `src/components/common/FolderBrowser.vue`(143 行)。
//
// 🔴【mock 的层次 —— 治理 §4.1 五行表,本刀最容易翻车的一处】
//   `service.folder.getList` 在共享包里是 `unwrap<FolderListing>(res.data)`
//   (`NimoOS-Service/src/folder.ts:7-10`)→ 它 resolve 出来的是 **单层**
//   `{ content: FolderEntry[] }`。
//   fixture `folder-list-DATA.json` 是 **HTTP 原文的三层信封**
//   `{success,message,data:{content:[…18 项…],total,index,size}}`。
//   → 本文件抄的是它 **`data.content` 那一层**,再包成 `{ content: <那 18 项> }`
//   当 mock 的返回值。**绝不把三层信封整个塞进 mock**(那样 `listing.content` 会是
//   undefined,K28 就白做了)。这个降层动作就是 K28 的落地证据,下方那条
//   「把三层信封整个塞进 mock → 列表必须为空」的反向用例把它钉死。
// 🔴 抄本(不是运行时读 `.superpowers/`)—— 协调者裁定,理由见本文件 FIXTURE-COPY
//   块的注释与 T3 报告 §8;等价性由一次性脚本程序化校验(报告 §9)。
// 读 `.vue` 源文件(守卫缺口③ 那两条)仍一律 `node:fs`,不用 Vite 的 `?raw`
//   (vitest 的 CSSEnablerPlugin 会把样式源换成空串 → 断言对空字符串「假通过」;
//   先例 `knowledgeStyles.test.ts` 头注释③)。
// 测试脚手架照 `QueueView.test.ts` / `IndexedFilesView.test.ts`(P5b 收官产物):
//   真 i18n(不手写子集)+ `vi.hoisted()` 的 service mock + `flushPromises()`。
//   本组件不用 router / 不用 store,故不装那两个插件。
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { i18n } from '../../../i18n'
import FolderBrowser from './FolderBrowser.vue'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── vi.hoisted mock 骨架(治理 §9:避免 ESM 提升 TDZ)──
const folder = vi.hoisted(() => ({ getList: vi.fn() }))
vi.mock('@nimotech/nimoos-service', () => ({ service: { folder } }))

interface RawEntry { name: string; path: string; is_dir: boolean }

/**
 * `GET /v1/folder?path=/DATA` 每一项的原文形状(11 个字段,顺序与后端一致)。
 * 逐字取自 `.superpowers/sdd/p5c-fixtures/folder-list-DATA.json`(2026-08-03 真机抓取)。
 */
interface RawFolderItem {
  name: string
  size: number
  is_dir: boolean
  is_symlink: boolean
  modified: string
  sign: string
  thumb: string
  type: number
  path: string
  date: string
  extensions: null
}

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURE-COPY-BEGIN  ——  folder-list-DATA.json 的 data.content(18 项)
// 取自 `.superpowers/sdd/p5c-fixtures/folder-list-DATA.json`(2026-08-03 真机抓取),
// 逐字抄入以免测试跨界依赖 gitignore 目录 —— 协调者裁定,见 T3 报告 §8。
// 🔴 抄的是三层信封里的 **`data.content` 那一层**(= K28 的降层动作)。
// 🔴 字段一个没精简、顺序一个没改;等价性由一次性脚本程序化校验(报告 §9)。
// ─────────────────────────────────────────────────────────────────────────────
const DATA_CONTENT: RawFolderItem[] = [
  {"name": ".snapshots", "size": 4096, "is_dir": true, "is_symlink": false, "modified": "2026-07-30T22:08:06.07507098+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/.snapshots", "date": "2026-07-30T22:08:06.07507098+08:00", "extensions": null},
  {"name": ".system_data", "size": 4096, "is_dir": true, "is_symlink": false, "modified": "2026-07-30T22:16:28.530622772+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/.system_data", "date": "2026-07-30T22:16:28.530622772+08:00", "extensions": null},
  {"name": ".wiki.md", "size": 2558, "is_dir": false, "is_symlink": false, "modified": "2026-07-31T17:06:29.558792532+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/.wiki.md", "date": "2026-07-31T17:06:29.558792532+08:00", "extensions": null},
  {"name": "Amalfi Coast", "size": 4096, "is_dir": true, "is_symlink": false, "modified": "2026-07-07T12:19:56.792668321+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/Amalfi Coast", "date": "2026-07-07T12:19:56.792668321+08:00", "extensions": null},
  {"name": "AppData", "size": 4096, "is_dir": true, "is_symlink": false, "modified": "2026-07-23T11:23:08.733979447+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/AppData", "date": "2026-07-23T11:23:08.733979447+08:00", "extensions": null},
  {"name": "Documents", "size": 4096, "is_dir": true, "is_symlink": false, "modified": "2026-07-22T17:03:25.553912817+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/Documents", "date": "2026-07-22T17:03:25.553912817+08:00", "extensions": null},
  {"name": "Downloads", "size": 4096, "is_dir": true, "is_symlink": false, "modified": "2022-07-06T09:00:46.243995396+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/Downloads", "date": "2022-07-06T09:00:46.243995396+08:00", "extensions": null},
  {"name": "Gallery", "size": 4096, "is_dir": true, "is_symlink": false, "modified": "2026-07-23T14:37:56.926239751+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/Gallery", "date": "2026-07-23T14:37:56.926239751+08:00", "extensions": null},
  {"name": "Image", "size": 4096, "is_dir": true, "is_symlink": false, "modified": "2026-07-30T18:18:59.58279995+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/Image", "date": "2026-07-30T18:18:59.58279995+08:00", "extensions": null},
  {"name": "KVM", "size": 4096, "is_dir": true, "is_symlink": false, "modified": "2026-07-30T20:33:51.818325425+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/KVM", "date": "2026-07-30T20:33:51.818325425+08:00", "extensions": null},
  {"name": "Media", "size": 4096, "is_dir": true, "is_symlink": false, "modified": "2026-07-21T14:29:41.551348808+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/Media", "date": "2026-07-21T14:29:41.551348808+08:00", "extensions": null},
  {"name": "NIMO", "size": 4096, "is_dir": true, "is_symlink": false, "modified": "2026-07-04T10:56:17.701403032+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/NIMO", "date": "2026-07-04T10:56:17.701403032+08:00", "extensions": null},
  {"name": "Notes", "size": 4096, "is_dir": true, "is_symlink": false, "modified": "2026-07-18T16:05:53.980766082+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/Notes", "date": "2026-07-18T16:05:53.980766082+08:00", "extensions": null},
  {"name": "lost+found", "size": 16384, "is_dir": true, "is_symlink": false, "modified": "2022-07-06T08:56:00+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/lost+found", "date": "2022-07-06T08:56:00+08:00", "extensions": null},
  {"name": "nimo.tar.gz", "size": 12886696675, "is_dir": false, "is_symlink": false, "modified": "2026-06-12T11:49:39.693706674+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/nimo.tar.gz", "date": "2026-06-12T11:49:39.693706674+08:00", "extensions": null},
  {"name": "todo-widget", "size": 4096, "is_dir": true, "is_symlink": false, "modified": "2026-07-18T15:29:16.289637517+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/todo-widget", "date": "2026-07-18T15:29:16.289637517+08:00", "extensions": null},
  {"name": "todo-widget.html", "size": 4251, "is_dir": false, "is_symlink": false, "modified": "2026-07-18T15:21:03.066935239+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/todo-widget.html", "date": "2026-07-18T15:21:03.066935239+08:00", "extensions": null},
  {"name": "我如何高效的使用claudecode.md", "size": 6808, "is_dir": false, "is_symlink": false, "modified": "2026-07-04T14:22:27.546329309+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/我如何高效的使用claudecode.md", "date": "2026-07-04T14:22:27.546329309+08:00", "extensions": null},
]
// FIXTURE-COPY-END

/** 🔴 单层形状(= 包方法 `service.folder.getList()` 的返回值),不是那个三层信封。 */
const DATA_LISTING = { content: DATA_CONTENT }

/** 蓝本父组件传的是 `pickerRoots()` 的输出;本机 wiki/candidates 实测 `[]` →
 *  真机跑的就是兜底三根(治理 §4.3),这里逐字用那三根。 */
const FALLBACK_ROOTS = [
  { path: '/DATA', label: 'System (/DATA)' },
  { path: '/media', label: '/media' },
  { path: '/mnt', label: '/mnt' },
]

function makeDeferred<T>(): { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void } {
  let res!: (v: T) => void
  let rej!: (e: unknown) => void
  const promise = new Promise<T>((a, b) => { res = a; rej = b })
  return { promise, resolve: res, reject: rej }
}

function mountFb(roots: { path: string; label?: string }[] = FALLBACK_ROOTS) {
  return mount(FolderBrowser, {
    props: { roots },
    global: { plugins: [i18n] },
  })
}

beforeEach(() => {
  folder.getList.mockReset()
})

describe('FolderBrowser —— 根层(current === "")', () => {
  it('渲染 roots 的每一项:drive 图标 + label + chev,并且不发任何请求', () => {
    const w = mountFb()
    const rows = w.findAll('.fb-row')
    expect(rows).toHaveLength(3)
    expect(rows.map((r) => r.find('.fb-name').text())).toEqual([
      'System (/DATA)', '/media', '/mnt',
    ])
    // 每行两个 KIcon:drive + chev(蓝本 :13 / :15)
    expect(rows[0]!.findAll('svg')).toHaveLength(2)
    expect(folder.getList).not.toHaveBeenCalled()
  })

  it('候选缺 label 时行文案回落成 path(模板 `r.label || r.path`)', () => {
    const w = mountFb([{ path: '/media/usb9' }])
    expect(w.find('.fb-name').text()).toBe('/media/usb9')
  })

  it('roots 为空时显示「未检测到磁盘卷」空态,且没有任何 .fb-row', () => {
    const w = mountFb([])
    expect(w.findAll('.fb-row')).toHaveLength(0)
    expect(w.find('.fb-stub').text()).toBe('未检测到磁盘卷——请在上方手输路径')
  })

  it('面包屑初始只有根一项,label 取 aiKbFbVolumes,data-last 是字符串 "true"', () => {
    const w = mountFb()
    const crumbs = w.findAll('.fb-crumb')
    expect(crumbs).toHaveLength(1)
    expect(crumbs[0]!.text()).toBe('卷')
    expect(crumbs[0]!.attributes('data-last')).toBe('true')
  })
})

describe('FolderBrowser —— 进入子目录(K28 单层取数)', () => {
  it('点根层某项:调 getList(path)、emit pick、按 dirEntries 渲染 12 个可见目录', async () => {
    folder.getList.mockResolvedValue(DATA_LISTING)
    const w = mountFb()
    await w.findAll('.fb-row')[0]!.trigger('click')
    await flushPromises()

    expect(folder.getList).toHaveBeenCalledTimes(1)
    expect(folder.getList).toHaveBeenCalledWith('/DATA')
    expect(w.emitted('pick')).toEqual([['/DATA']])

    const names = w.findAll('.fb-row').map((r) => r.find('.fb-name').text())
    expect(names).toHaveLength(12)
    expect(names).toEqual([
      'Amalfi Coast', 'AppData', 'Documents', 'Downloads', 'Gallery', 'Image',
      'KVM', 'lost+found', 'Media', 'NIMO', 'Notes', 'todo-widget',
    ])
    // 隐藏项与文件都不在列表里(fixture 18 项 → 12 项)
    expect(names).not.toContain('.system_data')
    expect(names).not.toContain('nimo.tar.gz')
    expect(w.find('.fb-stub').exists()).toBe(false)
  })

  it('🔴 mock 是单层 {content}:若把三层信封整个塞进来则列表为空 —— 证明取的是 .content 而非 .data.data.content', async () => {
    // 判别力用例:三层信封没有顶层 content → `listing.content || []`(N7 兜底)得空数组
    folder.getList.mockResolvedValue({ success: 200, message: 'ok', data: { content: DATA_CONTENT } })
    const w = mountFb()
    await w.findAll('.fb-row')[0]!.trigger('click')
    await flushPromises()
    expect(w.findAll('.fb-row')).toHaveLength(0)
    expect(w.find('.fb-stub').text()).toBe('(空)')
  })

  it('目录为空(content: [])时显示「(空)」空态', async () => {
    folder.getList.mockResolvedValue({ content: [] })
    const w = mountFb()
    await w.findAll('.fb-row')[0]!.trigger('click')
    await flushPromises()
    expect(w.findAll('.fb-row')).toHaveLength(0)
    expect(w.find('.fb-stub').text()).toBe('(空)')
  })

  it('【N7】content 为 null(Go nil slice)时也走「(空)」而不是抛错', async () => {
    folder.getList.mockResolvedValue({ content: null })
    const w = mountFb()
    await w.findAll('.fb-row')[0]!.trigger('click')
    await flushPromises()
    expect(w.find('.fb-stub').text()).toBe('(空)')
    expect(w.find('.fb-err').exists()).toBe(false)
  })

  it('面包屑随层级增长,data-last 只在最后一项是 "true"、其余是 "false"', async () => {
    folder.getList.mockResolvedValue(DATA_LISTING)
    const w = mountFb()
    await w.findAll('.fb-row')[0]!.trigger('click')
    await flushPromises()
    // 再点一层子目录(fixture 里第一项 Amalfi Coast)
    await w.findAll('.fb-row')[0]!.trigger('click')
    await flushPromises()

    const crumbs = w.findAll('.fb-crumb')
    expect(crumbs.map((c) => c.text())).toEqual(['卷', 'DATA', 'Amalfi Coast'])
    expect(crumbs[0]!.attributes('data-last')).toBe('false')
    expect(crumbs[1]!.attributes('data-last')).toBe('false')
    expect(crumbs[2]!.attributes('data-last')).toBe('true')
    expect(folder.getList).toHaveBeenLastCalledWith('/DATA/Amalfi Coast')
  })

  it('加载中显示「加载中…」;请求 resolve 后消失', async () => {
    const d = makeDeferred<{ content: RawEntry[] }>()
    folder.getList.mockReturnValue(d.promise)
    const w = mountFb()
    await w.findAll('.fb-row')[0]!.trigger('click')
    await nextTick()
    expect(w.find('.fb-stub').text()).toBe('加载中…')
    expect(w.findAll('.fb-row')).toHaveLength(0)

    d.resolve({ content: [] })
    await flushPromises()
    expect(w.find('.fb-stub').text()).toBe('(空)')
  })

  it('请求失败:显示 .fb-stub.fb-err「目录列表加载失败」、清空 entries、收敛 loading', async () => {
    folder.getList.mockRejectedValue(new Error('boom'))
    const w = mountFb()
    await w.findAll('.fb-row')[0]!.trigger('click')
    await flushPromises()
    const err = w.find('.fb-err')
    expect(err.exists()).toBe(true)
    expect(err.classes()).toContain('fb-stub')
    expect(err.text()).toBe('目录列表加载失败')
    expect(w.findAll('.fb-row')).toHaveLength(0)
    // loading 已收敛(否则渲染的会是「加载中…」)
    expect(w.text()).not.toContain('加载中…')
  })

  it('点根层面包屑(path === "")回到根层:不 emit pick、不发请求、清空 entries', async () => {
    folder.getList.mockResolvedValue(DATA_LISTING)
    const w = mountFb()
    await w.findAll('.fb-row')[0]!.trigger('click')
    await flushPromises()
    expect(w.findAll('.fb-row')).toHaveLength(12)

    await w.findAll('.fb-crumb')[0]!.trigger('click') // 根面包屑,path === ''
    await flushPromises()

    expect(folder.getList).toHaveBeenCalledTimes(1) // 没有第二次请求
    expect(w.emitted('pick')).toEqual([['/DATA']]) // 仍只有那一次(蓝本 :59 在 :60 之前 return)
    const names = w.findAll('.fb-row').map((r) => r.find('.fb-name').text())
    expect(names).toEqual(['System (/DATA)', '/media', '/mnt']) // 回到 roots 层
    expect(w.findAll('.fb-crumb')).toHaveLength(1)
  })
})

describe('FolderBrowser —— §5.2 `_seq` 竞态守卫(交错路径)', () => {
  // 🔴 记忆 `newui-async-stale-guard`:异步写共享 state 必带过期守卫,回归测试
  // 必须真走交错路径(先发后至),不能只测顺序路径。以下三条分别钉死蓝本
  // :65(成功分支)/ :68(catch)/ :72(finally 正向判断)三处守卫。
  type Listing = { content: RawEntry[] }
  const A_LISTING: Listing = { content: [{ name: 'AAA', path: '/DATA/AppData/AAA', is_dir: true }] }
  const B_LISTING: Listing = { content: [{ name: 'BBB', path: '/DATA/BBB', is_dir: true }] }

  /**
   * 真交错场景(用户「等不及」的真实路径):
   *   ① 进 /DATA(立即 resolve,拿到 12 行)
   *   ② 点子目录 AppData → `go('/DATA/AppData')` 在飞(seq=2),记为 **A**
   *   ③ 不等它回来就点面包屑「DATA」→ `go('/DATA')` 在飞(seq=3),记为 **B**
   * 于是 A 是过期的那次、B 是最新的那次,两次的 path 与返回值都不同。
   */
  async function raceSetup() {
    folder.getList.mockResolvedValueOnce(DATA_LISTING)
    const w = mountFb()
    await w.findAll('.fb-row')[0]!.trigger('click') // ① /DATA
    await flushPromises()
    expect(w.findAll('.fb-row')).toHaveLength(12)

    const dA = makeDeferred<Listing>()
    const dB = makeDeferred<Listing>()
    folder.getList.mockReturnValueOnce(dA.promise).mockReturnValueOnce(dB.promise)
    await w.findAll('.fb-row')[1]!.trigger('click') // ② AppData(第 2 行)
    await w.findAll('.fb-crumb')[1]!.trigger('click') // ③ 面包屑「DATA」
    expect(folder.getList.mock.calls.map((c: unknown[]) => c[0])).toEqual([
      '/DATA', '/DATA/AppData', '/DATA',
    ])
    return { w, dA, dB }
  }

  it('两次 go() 交错(第二次先返回、第一次后返回)→ entries 是第二次的结果,loading 收敛 false', async () => {
    const { w, dA, dB } = await raceSetup()

    // 交错:最新的 B 先返回
    dB.resolve(B_LISTING)
    await flushPromises()
    expect(w.findAll('.fb-name').map((n) => n.text())).toEqual(['BBB'])

    // 过期的 A 后返回 —— 必须被守卫吃掉,不许覆盖 B 的结果(蓝本 :65)
    dA.resolve(A_LISTING)
    await flushPromises()
    expect(w.findAll('.fb-name').map((n) => n.text())).toEqual(['BBB'])
    expect(w.text()).not.toContain('AAA')
    expect(w.text()).not.toContain('加载中…') // loading 收敛
  })

  it('过期的那次先返回时,不许写 entries、也不许把 loading 关掉(蓝本 :72 的正向 `if (seq === _seq)`)', async () => {
    const { w, dA, dB } = await raceSetup()

    // 过期的 A 先落地 → 它的 finally 不许清 loading(B 还在飞)
    dA.resolve(A_LISTING)
    await flushPromises()
    expect(w.find('.fb-stub').text()).toBe('加载中…')
    expect(w.text()).not.toContain('AAA')

    // 最新的 B 落地才收敛
    dB.resolve(B_LISTING)
    await flushPromises()
    expect(w.findAll('.fb-name').map((n) => n.text())).toEqual(['BBB'])
    expect(w.text()).not.toContain('加载中…')
  })

  it('过期的那次失败时,不许把错误态写进来(蓝本 :68 的 catch 守卫)', async () => {
    const { w, dA, dB } = await raceSetup()

    dB.resolve(B_LISTING)
    await flushPromises()
    dA.reject(new Error('stale failure'))
    await flushPromises()

    expect(w.find('.fb-err').exists()).toBe(false)
    expect(w.text()).not.toContain('目录列表加载失败')
    expect(w.findAll('.fb-name').map((n) => n.text())).toEqual(['BBB'])
  })

  // 🔴 M-1(评审探针 7 猎出的守卫缺口,2026-08-03):`seq` 必须是**组件本地**的
  // (`<script setup>` 体内的 `let`),不许挪到模块级。评审实测:把它挪成真模块级
  // (跨实例共享)后,上面那三条**单实例**交错用例照样 19 passed 零报红 —— 也就是
  // 「组件本地」这件事当时没有任何用例守着。而模块级 `seq` 的真实后果是:两个同时
  // 在用的选择器会互相把对方的请求判成过期(entries 永远空、loading 永远转)。
  // 本用例专守这一条,判据只有一个:把 `seq` 挪到模块级 → 本用例必须报红。
  // ⚠️ 仍**不抽公共 guard**(过早抽象),也**不改产品代码** —— 它已经是对的。
  // 这是本仓「异步写共享 state 必带过期守卫」纪律(记忆 `newui-async-stale-guard`,
  // 已被评审逮到四次)的守卫侧补课。
  it('两个实例各自在飞时互不干扰 —— seq 是组件本地,不是模块级(跨实例共享)', async () => {
    const A_CHILD: Listing = { content: [{ name: 'A-CHILD', path: '/A/A-CHILD', is_dir: true }] }
    const B_CHILD: Listing = { content: [{ name: 'B-CHILD', path: '/B/B-CHILD', is_dir: true }] }
    const dA = makeDeferred<Listing>()
    const dB = makeDeferred<Listing>()
    folder.getList.mockImplementation((p: string) => (p === '/A' ? dA.promise : dB.promise))

    const wA = mountFb([{ path: '/A', label: 'A' }])
    const wB = mountFb([{ path: '/B', label: 'B' }])
    await wA.find('.fb-row').trigger('click') // 实例 A:go('/A') 在飞
    await wB.find('.fb-row').trigger('click') // 实例 B:go('/B') 在飞
    expect(folder.getList.mock.calls.map((c: unknown[]) => c[0])).toEqual(['/A', '/B'])

    // 交错:后发的 B 先回,再轮到 A —— 两个实例都不该被对方影响
    dB.resolve(B_CHILD)
    await flushPromises()
    dA.resolve(A_CHILD)
    await flushPromises()

    expect(wB.findAll('.fb-name').map((n) => n.text())).toEqual(['B-CHILD'])
    // ↓ 模块级 seq 时 A 的 mySeq(1) !== seq(2) → 被判过期,这里会是 []
    expect(wA.findAll('.fb-name').map((n) => n.text())).toEqual(['A-CHILD'])
    expect(wA.text()).not.toContain('B-CHILD')
    expect(wB.text()).not.toContain('A-CHILD')
    // ↓ 模块级 seq 时 A 的 finally 正向判断不成立 → loading 永远转
    expect(wA.text()).not.toContain('加载中…')
    expect(wB.text()).not.toContain('加载中…')
  })

  it('reset() 先递增 seq 再清状态 → 在飞的请求落地后不写任何状态', async () => {
    const dA = makeDeferred<typeof A_LISTING>()
    folder.getList.mockReturnValue(dA.promise)
    const w = mountFb()
    await w.findAll('.fb-row')[0]!.trigger('click')
    await nextTick()
    expect(w.find('.fb-stub').text()).toBe('加载中…')

    // 蓝本父组件靠 $refs.fb.reset();Vue3 走 defineExpose
    ;(w.vm as unknown as { reset: () => void }).reset()
    await nextTick()
    // 回到根层(current === ''),loading 已清
    expect(w.findAll('.fb-name').map((n) => n.text())).toEqual(['System (/DATA)', '/media', '/mnt'])
    expect(w.findAll('.fb-crumb')).toHaveLength(1)

    dA.resolve(A_LISTING) // 过期请求落地
    await flushPromises()
    expect(w.text()).not.toContain('AAA')
    expect(w.findAll('.fb-name').map((n) => n.text())).toEqual(['System (/DATA)', '/media', '/mnt'])
  })

  it('defineExpose 暴露了 reset(蓝本靠 $refs.fb.reset() 调用)', () => {
    const w = mountFb()
    expect(typeof (w.vm as unknown as { reset?: unknown }).reset).toBe('function')
  })
})

describe('FolderBrowser —— 守卫缺口③:<template> 块零裸色字面量', () => {
  // 治理 §9 缺口③:color-guard.test.ts:44-56 的 styleLines() 对 .vue 只取 <style>
  // 块 → 模板 style="…" 属性零扫描;本文件补一条定向断言堵这个盲区。
  // ⚠️ 本文件沿用 QueueView.test.ts / IndexedFilesView.test.ts 的现状写法
  // (非贪婪 + 隐式靠「</template> 在第 0 列」锚定);治理 §9 缺口③′ 的「统一改成
  // 贪婪匹配 + 覆盖度自检」归 T8,本刀不动它。
  it('<template> 块内(剥离 var()/color-mix() 之后)不含任何裸 hex / rgb / hsl 字面量', () => {
    const src: string = readFileSync(resolve(__dirname, './FolderBrowser.vue'), 'utf8')
    const m = /<template>([\s\S]*?)\n<\/template>/.exec(src)
    expect(m).not.toBeNull()
    const tmpl = m![1]
    // 覆盖度自检:抽出的片段必须含模板最后一行的特征串(本组件的嵌套
    // <template v-else> 都是缩进的,不会把第 0 列的 </template> 提前截断)
    expect(tmpl).toContain('fb-crumbs') // 模板首部
    expect(tmpl).toContain('aiKbFbEmpty') // 模板尾部(倒数第 5 行)

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

  it('本文件零 <style> 块(.fb* 样式在 knowledge.scss,T2a 已搬)', () => {
    const src: string = readFileSync(resolve(__dirname, './FolderBrowser.vue'), 'utf8')
    expect(src).not.toMatch(/^<style/m)
  })
})
