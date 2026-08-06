// SP8-P5e Task 4 —— `KFileViewer.vue` 单测。蓝本 `NimoOS-UI@7a6ee6b7`
// `src/views/AI/Knowledge/components/KFileViewer.vue`(120 行,模板+脚本 `:1-68` 本刀移植)。
//
// ═══ mock 边界(治理 §9.12 / 附录 D §D.9,T0 实测结论)═══
// `@vue-office/excel` 内部的 x-spreadsheet 在挂载时无条件调
// `HTMLCanvasElement.getContext('2d')`,jsdom 返回 `null` → 紧接读 `null.scale` →
// unhandled rejection → **整个 `pnpm test` 进程 exit 1(0 个用例失败)**(附录 D §D.9.2
// 实测证据)。故把 `DocViewer`/`ExcelViewer` 都 mock 成契约形状不变的 stub —— 两个必须
// 一致处理(只 stub 一个会让同一批用例出现两套挂载语义,附录 D §D.9.3 明令)。
// stub 保留 `item`/`list` 两个 props + `close`/`download` 两个 emit(依据
// `DocViewer.vue:9-10` / `ExcelViewer.vue:9-10` 的 `defineProps`/`defineEmits`)。
//
// 走 stub 路线后,§2.4/§2.6/§2.7 的用例判别力只落在「路由映射 + 契约形状」上
// (附录 D §D.9.4),故每条断言都配变异证据(报告里贴 RED 探针的两段输出)。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import KFileViewer from './KFileViewer.vue'
import type { FileVM } from '../util/searchAggregate'

const __dirname = dirname(fileURLToPath(import.meta.url))
const read = (p: string) => readFileSync(resolve(__dirname, p), 'utf8')

// ─── D.9.3 的 stub(两个必须一致处理)───
vi.mock('../../../files/viewers/DocViewer.vue', () => ({
  default: {
    name: 'DocViewer',
    props: { item: { type: Object, required: true }, list: { type: Array, required: true } },
    emits: ['close', 'download'],
    template: '<div data-stub="doc-viewer" />',
  },
}))
vi.mock('../../../files/viewers/ExcelViewer.vue', () => ({
  default: {
    name: 'ExcelViewer',
    props: { item: { type: Object, required: true }, list: { type: Array, required: true } },
    emits: ['close', 'download'],
    template: '<div data-stub="excel-viewer" />',
  },
}))

function makeFile(name: string): FileVM {
  return {
    id: 'fx',
    name,
    path: '/x/',
    fullPath: `/x/${name}`,
    kind: 'body',
    mime: 'application/octet-stream',
    mtimeMs: 1700000000000,
    score: 0.8,
    chunks: [],
  }
}

describe('KFileViewer — 根节点 class(§2.2 K46 自证 ③)', () => {
  it('根 <div> 应用 .k-fileviewer-host 类名', () => {
    const w = mount(KFileViewer, { props: { file: makeFile('a.docx') } })
    expect(w.classes()).toContain('k-fileviewer-host')
  })
})

describe('KFileViewer — VIEWER_MAP 五个扩展名(§2.4,蓝本 :37-43 / :55-58)', () => {
  const cases: Array<[string, string]> = [
    ['a.docx', 'doc-viewer'],
    ['a.wps', 'doc-viewer'],
    ['a.xls', 'excel-viewer'],
    ['a.xlsx', 'excel-viewer'],
    ['a.csv', 'excel-viewer'],
  ]
  it.each(cases)('%s → data-stub=%s', (name, stub) => {
    const w = mount(KFileViewer, { props: { file: makeFile(name) } })
    expect(w.find('[data-stub]').attributes('data-stub')).toBe(stub)
  })

  it('🔴 大小写不敏感(蓝本 .toLowerCase()):A.DOCX → doc-viewer', () => {
    const w = mount(KFileViewer, { props: { file: makeFile('A.DOCX') } })
    expect(w.find('[data-stub]').attributes('data-stub')).toBe('doc-viewer')
  })

  it('传给子组件的 item 形状 = { path, name, is_dir:false }(不是整个 file)', () => {
    const w = mount(KFileViewer, { props: { file: makeFile('a.docx') } })
    const stub = w.findComponent({ name: 'DocViewer' })
    expect(stub.props('item')).toStrictEqual({ path: '/x/a.docx', name: 'a.docx', is_dir: false })
    expect(stub.props('list')).toStrictEqual([{ path: '/x/a.docx', name: 'a.docx', is_dir: false }])
  })
})

describe('KFileViewer — fallback 分支(§2.4,未知扩展名 → .k-fileviewer-fallback)', () => {
  it.each(['a.pdf', 'a.png', 'a.zip', 'noextension', ''])('扩展名 %s(或无扩展名/空名)不在 VIEWER_MAP 里 → 渲染 fallback', (name) => {
    const w = mount(KFileViewer, { props: { file: makeFile(name) } })
    expect(w.find('[data-stub]').exists()).toBe(false)
    expect(w.find('.k-fileviewer-fallback').exists()).toBe(true)
    expect(w.find('.k-fileviewer-empty').exists()).toBe(true)
  })

  it('fallback 文案:Preview not supported 提示 + Download 按钮均渲染(i18n 键 aiKbFvUnsupported / aiKbFdDownload)', () => {
    const w = mount(KFileViewer, { props: { file: makeFile('a.pdf') } })
    expect(w.find('.k-fileviewer-empty p').text()).toBe('此格式暂不支持在线预览')
    expect(w.find('.k-fileviewer-empty button.k-btn.primary').text()).toContain('下载')
  })

  it('fallback 头部 filename 标题 = item.name(即 file.name)', () => {
    const w = mount(KFileViewer, { props: { file: makeFile('a.pdf') } })
    expect(w.find('.k-drawer-filename').attributes('title')).toBe('a.pdf')
    expect(w.find('.k-drawer-filename').text()).toBe('a.pdf')
  })

  it('fallback 头部关闭按钮(.k-modal-x)点击 → emit close', () => {
    const w = mount(KFileViewer, { props: { file: makeFile('a.pdf') } })
    w.find('.k-modal-x').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })
})

describe('KFileViewer — §2.7 download emit 转发(蓝本 :18 的既知不一致,照抄)', () => {
  it('🔴 fallback 下载按钮发的是 file(整个 prop),不是 item —— 照抄蓝本这个不一致', () => {
    const file = makeFile('a.pdf')
    const w = mount(KFileViewer, { props: { file } })
    w.find('.k-fileviewer-empty button.k-btn.primary').trigger('click')
    const emitted = w.emitted('download')
    expect(emitted).toHaveLength(1)
    // 是完整 FileVM(含 id/kind/mime/score/chunks 等 item 没有的字段),不是 item 那个瘦身对象
    expect(emitted![0][0]).toStrictEqual(file)
    expect(emitted![0][0]).toHaveProperty('id', 'fx')
    expect(emitted![0][0]).not.toEqual({ path: '/x/a.pdf', name: 'a.pdf', is_dir: false })
  })

  it('蓝本的 <component :is> 分支只绑 @close,不绑 @download —— stub 内部 emit(\'download\') 不会被 KFileViewer 转发', () => {
    const w = mount(KFileViewer, { props: { file: makeFile('a.docx') } })
    const stub = w.findComponent({ name: 'DocViewer' })
    stub.vm.$emit('download', { name: 'inner.docx' })
    expect(w.emitted('download')).toBeUndefined()
  })
})

describe('KFileViewer — N41 Esc 监听(§2.6,mounted/beforeDestroy → onMounted/onBeforeUnmount)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ⚠️ 实测记录(调试排除,非本刀正式改动):`wrapper.unmount()` 之后 Vue 的 emit 本身
  // 就不再把事件投给父级监听器(`@vue/test-utils` v4 下 `wrapper.emitted()` 在 unmount
  // 后直接变 `undefined`;即便改用 `onClose` prop 计数、甚至绕过 dispatchEvent 直接手
  // 调捕获到的 handler 引用,`onClose` 调用计数在卸载后也不再增长 —— 这一层是 Vue 自身
  // 卸载生命周期的既有保护,与本组件是否调用了 `removeEventListener` 无关)。也就是说
  // 「卸载后再按 Esc,断言 close 计数不再增长」这条判据在本环境下**恒为绿**、零判别力
  // (亲测:临时删掉 onBeforeUnmount 那行,这类断言仍然通过)。
  // 🔴 真正有判别力、且 RED 可证的判据落在「注销调用本身」上(见 T4 报告 RED 探针):
  // `window.removeEventListener('keydown', 同一个 handler 引用)` 是否被调用过。
  // 判据:删掉 onBeforeUnmount 那一行 → `removeCall` 变 `undefined` → 下面这条断言必须报红。
  it('挂载时注册 keydown;按 Esc 发 close;卸载时用同一个函数引用注销(判据:删掉 onBeforeUnmount → 必须报红)', () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const w = mount(KFileViewer, { props: { file: makeFile('a.pdf') } })

    const addCall = addSpy.mock.calls.find((c) => c[0] === 'keydown')
    expect(addCall, '未找到 keydown 的 addEventListener 调用').toBeDefined()
    const handler = addCall![1]

    // 按 Esc → emit close
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(w.emitted('close')).toHaveLength(1)

    // 按其它键 → 不发
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(w.emitted('close')).toHaveLength(1)

    w.unmount()

    const removeCall = removeSpy.mock.calls.find((c) => c[0] === 'keydown')
    expect(removeCall, '未找到 keydown 的 removeEventListener 调用(卸载后监听器仍挂在 window 上)').toBeDefined()
    // 🔴 判据核心:注销用的是同一个函数引用(不是新建的等价函数——否则浏览器
    // 不会真的解绑原监听器)
    expect(removeCall![1]).toBe(handler)
  })
})

describe('KFileViewer — K46 三条自证(§2.2,评审逐条复核用)', () => {
  it('① DocViewer.vue / ExcelViewer.vue 自身模板零 .overlay / .v-container / .doc-container', () => {
    const doc: string = read('../../../files/viewers/DocViewer.vue')
    const excel: string = read('../../../files/viewers/ExcelViewer.vue')
    for (const cls of ['overlay', 'v-container', 'doc-container']) {
      const re = new RegExp(`class="[^"]*\\b${cls}\\b[^"]*"|class=\\"[^\\"]*${cls}`)
      expect(re.test(doc), `DocViewer.vue 模板出现 .${cls}`).toBe(false)
      expect(re.test(excel), `ExcelViewer.vue 模板出现 .${cls}`).toBe(false)
    }
    // 它们渲染 ViewerShell,自带 .office-body / .office-scroll(不是蓝本的 .overlay 家族)
    expect(doc).toMatch(/class="office-body"/)
    expect(doc).toMatch(/class="office-scroll"/)
    expect(excel).toMatch(/class="office-body"/)
  })

  it('② ViewerShell.vue:24 提供铺满视口的定位祖先(position:absolute;inset:0;z-index:200)', () => {
    const shell: string = read('../../../files/viewers/ViewerShell.vue')
    expect(shell).toMatch(/position:\s*absolute;\s*inset:\s*0;\s*z-index:\s*200;/)
  })
})
