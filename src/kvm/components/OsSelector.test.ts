import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import OsSelector from './OsSelector.vue'
import IsoBrowser from './IsoBrowser.vue'
import { i18n } from '../../i18n'
import type { IsoRow } from '../composables/useIsoList'

// IsoBrowser(Task 6)是 OsSelector 的子组件,真实渲染时会自己调 useIsoBrowser() 拉目录——
// 本文件只测官方模板半 + 自定义区选中后的转发/关弹窗,不测 IsoBrowser 内部浏览逻辑
// (那部分已在 IsoBrowser.test.ts 单独覆盖),所以这里把它的数据层钉死成空目录/不加载,
// 避免真实 service.folder.getList 调用泄进这个文件的测试。
vi.mock('../composables/useIsoBrowser', () => ({
  useIsoBrowser: () => ({
    path: { value: '/' }, items: { value: [] }, isLoading: { value: false },
    fetch: vi.fn(), up: vi.fn(), dispose: vi.fn(),
  }),
}))

const ROW = (over: Partial<IsoRow> = {}): IsoRow => ({
  id: 'debian-13', name: 'Debian', version: '13 (Trixie)', category: 'linux', size: '676 MB',
  status: 'available', progress: 0, recommendedVcpu: 2, recommendedMemory: 2048,
  minMemory: 512, minDisk: 8,
  _downloading: false, _downloaded: false, _progress: 0, _downloadedBytes: 0, ...over,
})
// 偏离登记(修 brief 手误,非仅第 3 条用例那一行):brief 的字面 ALPINE 只覆盖了
// id/name/category/status/path/_downloaded/minDisk,version/size 沿用 ROW() 默认值
// (Debian 的 '13 (Trixie)' / '676 MB')——但同一条用例断言 cards[1] 要包含 '3.19' 与
// '60 MB',两者对不上(真机 alpine-319 的真实版本号是 3.19,体积远小于 Debian 的
// 676MB)。这不是"语法能跑但语义废话"的三元占位,是 fixture 缺字段导致断言恒假,
// 一并修正:补上 version/size 两个覆盖值,让断言真正验证渲染内容而不是必然失败。
const ALPINE = ROW({
  id: 'alpine-319', name: 'Alpine', version: '3.19', category: 'linux', size: '60 MB',
  status: 'downloaded', path: '/DATA/KVM/isos/alpine-319.iso', _downloaded: true, minDisk: 2,
})
const WIN = ROW({ id: 'win10', name: 'Windows 10', category: 'windows', minDisk: 60 })

let w: VueWrapper | null = null
// 硬约束 5:brief 逐字稿的 `mk` 是同步函数。实测 reka-ui 2.10(本仓库既有版本)的
// DialogPortal/DialogContent 首次挂载要等下一个 microtask(nextTick)才把内容真正落地到
// document.body——与 KvmDialog.test.ts / KvmGlobalSettingsDialog.test.ts 已确立的写法
// 一致。这里把 `mk` 改成 async 并在 mount 之后 `await nextTick()`,断言内容一个不减。
const mk = async (isos: IsoRow[] = [ROW(), ALPINE, WIN]) => {
  w = mount(OsSelector, { props: { open: true, isos }, global: { plugins: [i18n] }, attachTo: document.body })
  await nextTick()
  return w
}
afterEach(() => { w?.unmount(); w = null; document.body.innerHTML = '' })
const qa = (sel: string) => [...document.body.querySelectorAll(sel)] as HTMLElement[]

describe('OsSelector 官方模板半', () => {
  it('四个分类按钮,默认 all 高亮', async () => {
    await mk()
    const btns = qa('.category-btn')
    expect(btns.map((b) => b.textContent?.trim())).toEqual(['全部', 'Windows', 'Linux', 'BSD'])
    expect(btns[0].classList.contains('active')).toBe(true)
  })

  it('点 Windows 只留 windows 分类的卡片', async () => {
    const wr = await mk()
    qa('.category-btn')[1].click(); await wr.vm.$nextTick()
    expect(qa('.os-card')).toHaveLength(1)
    expect(qa('.os-name')[0].textContent).toContain('Windows 10')
  })

  it('卡片显示名/版本/大小,已下载的带 is-downloaded 类', async () => {
    await mk()
    const cards = qa('.os-card')
    expect(cards[1].classList.contains('is-downloaded')).toBe(true)
    expect(cards[1].textContent).toContain('Alpine')
    expect(cards[1].textContent).toContain('3.19')
    expect(cards[1].textContent).toContain('60 MB')
  })

  it('按钮三态:未下载=下载 / 已下载=选择 / 下载中=两位小数百分比(照 Vue2 :257-265)', async () => {
    await mk([ROW(), ALPINE, ROW({ id: 'ubuntu-2404', name: 'Ubuntu', _downloading: true, _progress: 37.456 })])
    const texts = qa('.os-action-btn').map((b) => b.textContent?.trim())
    expect(texts[0]).toBe('下载')
    expect(texts[1]).toBe('选择')
    expect(texts[2]).toBe('37.46%')
  })

  it('点未下载的卡片按钮 emit download(id)', async () => {
    const wr = await mk()
    qa('.os-action-btn')[0].click(); await wr.vm.$nextTick()
    expect(wr.emitted('download')).toEqual([['debian-13']])
  })

  it('点已下载的卡片按钮 emit select,path 是宿主机绝对路径、isLocal=false', async () => {
    const wr = await mk()
    qa('.os-action-btn')[1].click(); await wr.vm.$nextTick()
    expect(wr.emitted('select')![0][0]).toMatchObject({
      isLocal: false, id: 'alpine-319', name: 'Alpine',
      path: '/DATA/KVM/isos/alpine-319.iso', minDisk: 2,
    })
  })

  it('选中后弹窗关闭(照 Vue2 selectOS → close)', async () => {
    const wr = await mk()
    qa('.os-action-btn')[1].click(); await wr.vm.$nextTick()
    expect(wr.emitted('update:open')).toEqual([[false]])
  })

  it('点正在下载的卡片按钮 emit need-wait,不 emit select/download', async () => {
    const wr = await mk([ROW({ _downloading: true, _progress: 10 })])
    qa('.os-action-btn')[0].click(); await wr.vm.$nextTick()
    expect(wr.emitted('need-wait')).toHaveLength(1)
    expect(wr.emitted('select')).toBeUndefined()
    expect(wr.emitted('download')).toBeUndefined()
  })

  it('已下载但后端没给 path 时不 emit select(后端契约:path 只在 downloaded 时出现)', async () => {
    const wr = await mk([ROW({ _downloaded: true, path: undefined })])
    qa('.os-action-btn')[0].click(); await wr.vm.$nextTick()
    expect(wr.emitted('select')).toBeUndefined()
  })

  it('自定义区选中本地 ISO 也会关弹窗并透传 select(Task 6 接线:onLocalSelect)', async () => {
    const wr = await mk()
    const localOs = {
      isLocal: true, id: 'local', name: 'haiku-r1.iso', path: '/DATA/haiku-r1.iso',
    }
    // IsoBrowser 自己的浏览/反查逻辑已在 IsoBrowser.test.ts 单独覆盖;这里只验证
    // OsSelector 把它的 select 事件原样转发 + 关弹窗这条接线,不重新走一遍文件点击流程。
    const isoBrowser = wr.findComponent(IsoBrowser)
    expect(isoBrowser.exists()).toBe(true)
    isoBrowser.vm.$emit('select', localOs)
    await wr.vm.$nextTick()
    expect(wr.emitted('select')![0][0]).toEqual(localOs)
    expect(wr.emitted('update:open')).toEqual([[false]])
  })
})
