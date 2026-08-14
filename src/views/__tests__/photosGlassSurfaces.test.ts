// SP7 修复:相册区两处"不透明深色板压在玻璃壳上"。
//
// 病根是一类移植缺陷 —— **照抄 token 名,但两个同名 token 的语境不同**:
//   · Vue2 相册区是一整块**不透明深色页面**(`photos.scss:3` `--bg: #0A0A0C`),页内任何
//     元素刷 `var(--bg)` 都与页底无缝;
//   · New-UI 的相册区活在 AreaShell 的**玻璃壳**里(半透明 + 壁纸/渐变透上来),同样刷
//     `var(--bg)`(`#1a2138`)就变成一块黑板 —— 真机截图里那条横贯整宽的黑带就是它。
//
// 本仓 `--bg` 的**正当用法是"占满视口、自己就是页底"的壳**(StorageShell / SettingsShell /
// MediaViewer / SearchDialog)与 SmartViewCard 拼贴图的缝隙色;内嵌在区域壳里的行/条/面板
// 一律走玻璃 token(`--panel-bg`),同区先例:PhotosSidebar / PlacesRail / PhotoInfoPanel /
// PersonPlacesTab 全是 `var(--panel-bg)`。
//
// `--panel-bg-solid`(深色是不透明渐变实底)是**为地图专门引入的**:PlaceDetailPanel 压在
// PlacesMap 的画布上,半透会把地图网格点透上来(P6b 真机验收反馈)。除此之外没有第二个
// 合法场景 —— 所以下面第三组用**白名单**钉住它的消费方集合,多一个就红。
//
// jsdom 不算级联、也不做布局,这类缺陷单测抓不到(5952 例全绿也没抓到),故与
// color-guard.test.ts / photosLayoutHeightCap.test.ts 同一路数:对样式块原文做文本断言。
// 读盘一律 node:fs —— 本仓 `?raw` 在测试环境恒空(color-guard 曾因此空转)。
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const SRC = path.resolve(__dirname, '../..')

function read(rel: string): string {
  const text = fs.readFileSync(path.join(SRC, rel), 'utf8')
  expect(text.length, `${rel} 读到空内容,取数方式失效了`).toBeGreaterThan(0)
  return text
}

/** 取某个选择器的规则体(只取第一处,够用:这几个类在各自 SFC 里都只有一条规则)。 */
function ruleBody(text: string, selector: string): string {
  const i = text.indexOf(selector)
  expect(i, `找不到选择器 ${selector}`).toBeGreaterThan(-1)
  const open = text.indexOf('{', i)
  const close = text.indexOf('}', open)
  expect(open, `${selector} 后面没有 {`).toBeGreaterThan(-1)
  expect(close, `${selector} 的规则体没有 }`).toBeGreaterThan(open)
  return text.slice(open + 1, close)
}

describe('相册区表面用玻璃 token,不刷应用底色', () => {
  it('搜索页的筛选条不画背景(玻璃壳透上来,与上下两行一致)', () => {
    const body = ruleBody(read('views/PhotosSearch.vue'), '.filterbar {')
    // 不是"别用 --bg"而是"这条横条根本不该画底" —— 它上面的 .search-hero、下面的排序行
    // 都是透明的,画任何底色都会在玻璃壳上留下一条色带。
    expect(body, `.filterbar 又画上背景了:${body.trim()}`).not.toMatch(/background\s*:/)
  })

  it('搜索页筛选条仍保留分隔线与层叠(只去底色,不动别的)', () => {
    const body = ruleBody(read('views/PhotosSearch.vue'), '.filterbar {')
    // border-bottom 是它与排序行之间唯一的视觉分界,去了底色更要留着。
    expect(body).toMatch(/border-bottom\s*:\s*1px solid var\(--divider\)/)
    // position/z-index 不是装饰:筛选弹层(.fpop)是它的后代,靠这两条才画得到下方网格之上。
    // 删掉会让弹层被瓦片压住 —— 与本次"去底色"无关,必须保留。
    expect(body).toMatch(/position\s*:\s*sticky/)
    expect(body).toMatch(/z-index\s*:\s*6/)
  })

  // Fix-2 item 6 (owner acceptance, 2026-08-13) correction: this case's own premise -- "this
  // page still lives inside AreaShell's glass shell, same as PhotosSidebar/PlacesRail" -- is no
  // longer true. Plan C Task 2 (see PhotosSmartViewDetail.vue's own header comment) un-wrapped
  // this exact page from AreaShell into Vue2's own single opaque `.photos-root > .app` shell
  // (`--bg: #0A0A0C`, a solid near-black page, not a glass wallpaper backdrop) -- the same
  // migration Photos.vue's own shell went through earlier. PhotosSidebar, cited here as the
  // same-precedent glass surface, in fact no longer uses `--panel-bg` either: its real parity
  // rule (`vue2-parity/photos.scss:134-139` `.sidebar { background: var(--surface-1); ... }`)
  // is the same flat, opaque, `.photos-root`-scoped token this fix gives `.sv-detail-side`.
  // `--surface-1` is also correctly shadowed under `.photos-root.is-light` (unlike the global
  // `--panel-bg`, which was not, and stayed a barely-visible glass tint in photos light mode --
  // the actual bug this correction fixes, on top of restoring the pre-Plan-C premise this test
  // case itself no longer describes).
  it('智能视图详情的右侧栏用 parity 自己的不透明面板底(Plan C 已脱离 AreaShell 玻璃壳,与 PhotosSidebar 现状一致)', () => {
    const body = ruleBody(read('views/PhotosSmartViewDetail.vue'), '.sv-detail-side {')
    expect(body).toMatch(/background\s*:\s*var\(--surface-1\)/)
    expect(body, '右侧栏底下没有地图,用不着不透明实底(且早已不是 --panel-bg-solid 消费方)').not.toMatch(/var\(--panel-bg-solid\)/)
    expect(body, '不应再回退到未随 photos-is-light 切换的全局玻璃 token').not.toMatch(/var\(--panel-bg\)/)
  })
})

describe('--panel-bg-solid 的消费方白名单(反向闸)', () => {
  // 唯一合法场景:压在 PlacesMap 画布上的地点详情面板(半透会把地图网格点透上来)。
  // 每新增一条都必须先问"它底下真的有地图吗" —— 没有就该用 --panel-bg。
  const ALLOW = new Set(['photos/components/PlaceDetailPanel.vue'])

  function walk(dir: string, out: string[] = []): string[] {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === '__tests__') continue
        walk(p, out)
      } else if (e.name.endsWith('.vue')) {
        out.push(p)
      }
    }
    return out
  }

  const files = walk(SRC)

  it('取数有效(扫到了 .vue 文件)', () => {
    expect(files.length).toBeGreaterThan(50)
  })

  it('只有白名单里的组件用 --panel-bg-solid', () => {
    const users = files
      .filter((p) => fs.readFileSync(p, 'utf8').includes('var(--panel-bg-solid)'))
      .map((p) => path.relative(SRC, p).replace(/\\/g, '/'))
    expect(users.slice().sort(), `--panel-bg-solid 的消费方变了`).toEqual([...ALLOW].sort())
  })
})

// Fix-2 item 6b (owner acceptance, 2026-08-13): global body::before/after (theme.css) paint a
// fixed, viewport-covering "aurora" wash at z-index:0, meant to glow through AreaShell's own
// glass shells. Photos opted out of that glass aesthetic entirely (`.photos-root .app` paints
// its own fully opaque `--bg`, matching Vue2 1:1) -- but a plain, non-positioned block element
// is painted *before* a `position: fixed; z-index: 0` sibling in the standard CSS paint order
// regardless of how opaque its own background is, so the aurora painted on top of `.app` all
// along. It read as a plausible ambient glow in Photos' own dark theme and was never reported;
// `.photos-root.is-light`'s near-white `--bg` makes the exact same bleed-through glaringly
// visible (a colourful gradient wash over a light page), which is what the owner's screenshot
// shows. Fix: `position: relative; z-index: 1` on `.app` promotes it into the positioned/
// z-index layer above the aurora's `z-index: 0` -- theme-invariant (fixes both of
// `.photos-root`'s own themes at once, not a per-theme override), same recipe already used by
// ViewerShell.vue's own opaque shell over its own z-index:0 bokeh layer. jsdom does not compute
// paint order/cascade, so (same as this file's other cases) this is a raw-source assertion, not
// a rendered-DOM one; real-device verification is still the authority for the visual result.
describe('Fix-2 item 6b: .app 建立自己的层叠上下文,压在全局 aurora(z-index:0)之上', () => {
  it('.photos-root .app 有 position:relative + z-index:1(两套主题通用,不分深浅色)', () => {
    const body = ruleBody(read('photos/styles/vue2-parity/photos.scss'), '.photos-root .app {')
    expect(body).toMatch(/position\s*:\s*relative/)
    expect(body).toMatch(/z-index\s*:\s*1\b/)
    // 不透明底色仍然保留,两件事互相独立、都要成立。
    expect(body).toMatch(/background\s*:\s*var\(--bg\)/)
  })
})
