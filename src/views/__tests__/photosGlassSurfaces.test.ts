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
// `--panel-bg-solid`(深色是不透明渐变实底)当年**为地图专门引入**:PlaceDetailPanel 压在
// PlacesMap 的画布上,半透会把地图网格点透上来(P6b 真机验收反馈)。除此之外没有第二个
// 合法场景 —— 所以下面第三组用**白名单**钉住它的消费方集合,多一个就红。
//
// Fix-1 item 6 订正(owner acceptance, 2026-08-16):当年那条"半透会把网格点透上来"的理由
// 本身站不住脚——`--surface-1`(本仓 Photos 私有 token)在两套 Photos 主题下都是**完全不
// 透明**的纯色(`#131318` 深色 / `oklch(0.975 0.004 80)` 浅色,均无 alpha 通道),从来不是
// 半透明的。`--panel-bg-solid` 反而是个*全局* token,只跟随全站 `[data-theme]` 属性、不跟随
// Photos 私有的 `.photos-root.is-light` 切换——真正的后果是:切 Photos 私有浅色主题后,这块
// 面板底色仍卡在深色(真机验收里"右侧详情面板不跟随浅色主题"的报告)。PlaceDetailPanel.vue
// 的 `.map-detail` 已改回 `--surface-1`(parity `photos-places.scss` 自己的 `.map-detail`
// 规则本就是这个值,组件那条本地覆盖此前一直在遮盖它)——`--panel-bg-solid` 现在没有任何
// 合法消费方了,下面白名单已改成空集,不是又找了个新消费方。
//
// jsdom 不算级联、也不做布局,这类缺陷单测抓不到(5952 例全绿也没抓到),故与
// color-guard.test.ts / photosLayoutHeightCap.test.ts 同一路数:对样式块原文做文本断言。
// 读盘一律 node:fs —— 本仓 `?raw` 在测试环境恒空(color-guard 曾因此空转)。
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { extractStyleBlock } from '../../photos/components/__tests__/cssCascade'

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
  // Fix-3 item 7 (owner acceptance, 2026-08-13, Plan F pull-forward) correction: this case's own
  // premise -- "this page still lives inside AreaShell's glass shell, so any background paints a
  // visible band" -- is no longer true, same class of correction as Fix-2 item 6 below did for
  // PhotosSmartViewDetail.vue's `.sv-detail-side`. This task un-wrapped PhotosSearch.vue from its
  // old flex-row `.photos-layout` shell into the SAME opaque `.photos-root > .app` grid every
  // other migrated page uses (`--bg: #0A0A0C`, a solid near-black page, not a translucent
  // wallpaper backdrop) -- the exact problem this case originally guarded against cannot recur
  // here. PhotosSearch.vue no longer carries its own local `.filterbar` rule at all: the
  // 2026-08-13 rollback (see PhotosSearch.vue's own style-block header comment) deleted it along
  // with every other selector name already covered by vue2-parity/photos.scss, letting THAT rule
  // (which does paint `background: var(--bg)`, matching Vue2 1:1, photos.scss:2610-2616) govern
  // directly.
  it('搜索页不再自带本地 .filterbar 规则(已随 2026-08-13 回退整体移交 parity)', () => {
    const src = read('views/PhotosSearch.vue')
    expect(src, '搜索页仍留着一份本地 .filterbar 规则,应已随回退删除').not.toMatch(/\n\.filterbar\s*\{/)
  })

  it('parity 自己的 .filterbar 画底色(Plan C 已脱离 AreaShell 玻璃壳,画底色不再产生色带)+ 仍保留分隔线与层叠', () => {
    const body = ruleBody(read('photos/styles/vue2-parity/photos.scss'), '.filterbar {')
    expect(body).toMatch(/background\s*:\s*var\(--bg\)/)
    // border-bottom 是它与排序行之间唯一的视觉分界。
    expect(body).toMatch(/border-bottom\s*:\s*1px solid var\(--line\)/)
    // position/z-index 不是装饰:筛选弹层(.fpop)是它的后代,靠这两条才画得到下方网格之上。
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
  // Fix-1 item 6 (2026-08-16): the previously-sole "legitimate scenario" (PlaceDetailPanel.vue,
  // stacked over the map canvas) has been fixed to use `--surface-1` instead (see this file's
  // header comment for the full account) — `--surface-1` is already fully opaque in both
  // Photos themes, so there was never a real translucency problem to solve with a second,
  // is-light-blind token. The whitelist was empty for a while: any future consumer must justify
  // itself from scratch, not point back at a precedent that turned out to be a bug.
  //
  // Files Time Machine fix wave B (B1, owner acceptance 2026-08-26): a genuine new legitimate
  // scenario. TimeMachineStage.vue's `.tm-fwin--active` (the real, scaled-down Files window) and
  // its preview clones (SnapshotPreviewWindow.vue's `.tm-preview-window`,
  // TimeMachineDepthStack.vue's `.tm-depth-strip`) all need a background that is (a) fully OPAQUE
  // regardless of theme (so ~10 stacked preview layers each occlude the one behind, and the real
  // window never shows the blurred clone/glass backdrop through it) and (b) follows the APP'S OWN
  // theme (dark in dark theme, white in light theme) -- these are real New-UI windows whose
  // cloned/slotted content paints text in New-UI's own `--fg`/`--fg-muted` tokens, unlike TM's own
  // chrome (glass/rail/stepper/bars/white-glass modals), which stays pinned to the SAME literal in
  // both themes via its own `--tm-panel-bg-solid` token (unchanged, still used by the white-glass
  // modals). `--panel-bg-solid` is exactly this: a global, already-themed, always-opaque token --
  // see this file's own header comment for its dark-gradient/white values. Root cause + full
  // account: .superpowers/sdd/2026-08-25-files-time-machine-vue2-parity/final-fix-report.md,
  // "Fix wave B" section.
  const ALLOW = new Set<string>([
    'files/snapshot/TimeMachineStage.vue',
    'files/snapshot/SnapshotPreviewWindow.vue',
    'files/snapshot/TimeMachineDepthStack.vue',
  ])

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

// Plan F Task 1 (search page D13 alignment + glass light-context fix): the topbar's `.search`
// box is an owner-approved GLASS exception (PhotosTopbar.vue's own scoped style) that
// deliberately consumes the app's GLOBAL --chip-bg/--chip-border tokens (src/styles/theme.css)
// instead of this file's own `.photos-root`-scoped parity tokens. Root cause of the "亮色顶部
// 暗带" (light-top dark-band) the owner reported: `.photos-root.is-light` never redefined
// those two token NAMES, so in the very common "photos-light + app-global-dark" combination
// (Photos has its own light/dark toggle, independent of theme.css's app-wide toggle — dark is
// theme.css's default, no `data-theme="light"` attribute needed to hit it) the glass box fell
// straight through to theme.css's DARK values — a translucent white gradient designed to glow
// on a dark AreaShell page — painted on top of THIS page's own near-white `--bg`. This guard
// closes the blind spot: it was possible to regress the dark-band fix by deleting the
// `.photos-root.is-light` override below without any existing test in this file catching it.
describe('搜索框玻璃例外(topbar .search)的暗带根治:--chip-bg/--chip-border 在 is-light 下有亮色语境值', () => {
  it('.photos-root.is-light 覆盖 --chip-bg/--chip-border(photos 私有,不碰全局 theme.css)', () => {
    const body = ruleBody(read('photos/styles/vue2-parity/photos.scss'), '.photos-root.is-light {')
    expect(body).toMatch(/--chip-bg\s*:/)
    expect(body).toMatch(/--chip-border\s*:/)
    // 不是把 theme.css 的深色玻璃值原样抄一份——真的换了一套亮色语境的值,不是摆设。
    expect(body).not.toMatch(/rgba\(255,\s*255,\s*255,\s*0\.26\)/)
  })

  it('.photos-root(深色块)不重定义 --chip-bg/--chip-border ——深色玻璃质感字节不变,继续吃全局 theme.css 的深色值', () => {
    const body = ruleBody(read('photos/styles/vue2-parity/photos.scss'), '.photos-root {')
    expect(body).not.toMatch(/--chip-bg\s*:/)
    expect(body).not.toMatch(/--chip-border\s*:/)
  })

  it('全局 src/styles/theme.css 未被本次修复触碰(暗带根治严格限定在 photos 私有作用域内)', () => {
    const themeCss = read('styles/theme.css')
    // 只做存在性/计数式的粗粒度守卫:深浅两套主题各自的 --chip-bg 声明应保持恰好各一处
    // (:root 一处 + :root[data-theme="light"] 一处),不应该因为这次修复被误改成别的值或
    // 多出/少了一处——那将意味着有人把 photos 私有的覆盖误写回了全局文件。按行首匹配
    // (允许前导空白),排除文件里提到 `--chip-bg` 这个词但只是散文注释的行(如"不复用
    // --chip-bg:它在纸感主题是纯白……"那一句,不是真的声明)。
    const chipBgCount = themeCss.split('\n').filter((line) => /^\s*--chip-bg\s*:/.test(line)).length
    expect(chipBgCount).toBe(2)
  })
})

// Plan F Task 6: audit of the lightbox's own is-light chain, closing the same class of blind
// spot the search-topbar guard above closes for --chip-bg/--chip-border. --lb-bg (canvas) /
// --lb-chrome (top bar + filmstrip bottom bar) are photos-private tokens (not global theme.css
// ones) declared in BOTH of `.photos-root`'s own theme blocks — unlike --chip-bg/--chip-border,
// which the dark block deliberately leaves undefined to fall through to theme.css, --lb-bg/
// --lb-chrome are redefined in the dark block too (Vue2 parity's own literal values), so the
// guard here is the mirror shape: assert BOTH blocks declare them, and that light's values are
// a real different value (not dark's literals copy-pasted under the light selector).
describe('灯箱(Task 6):--lb-bg/--lb-chrome 在深浅两套主题下都有值,且亮色确实换了语境值', () => {
  it('.photos-root(深色块)声明 --lb-bg/--lb-chrome 为 Vue2 原始字面值(photos.scss:62-89 真值核对)', () => {
    const body = ruleBody(read('photos/styles/vue2-parity/photos.scss'), '.photos-root {')
    expect(body).toMatch(/--lb-bg\s*:\s*#000\s*;/)
    expect(body).toMatch(/--lb-chrome\s*:\s*rgba\(0,\s*0,\s*0,\s*0\.6\)\s*;/)
  })

  it('.photos-root.is-light 覆盖 --lb-bg/--lb-chrome —— 近白 oklch 画布 + 白玻璃顶/底栏,不是深色照抄', () => {
    const body = ruleBody(read('photos/styles/vue2-parity/photos.scss'), '.photos-root.is-light {')
    expect(body).toMatch(/--lb-bg\s*:\s*oklch\(0\.975 0\.004 80\)/)
    expect(body).toMatch(/--lb-chrome\s*:\s*rgba\(255,\s*255,\s*255,\s*0\.8\)/)
    // 换了真值,不是把深色块的 #000/rgba(0,0,0,0.6) 原样搬进 is-light 块。
    expect(body).not.toMatch(/--lb-bg\s*:\s*#000/)
    expect(body).not.toMatch(/--lb-chrome\s*:\s*rgba\(0,\s*0,\s*0/)
  })

  it('灯箱画布/顶栏/胶片底栏都吃 --lb-bg/--lb-chrome(不是别的 token 或字面量)——`.lightbox` 现已重新挂进 `.photos-root` 内(Task 5),这两条规则才真正生效', () => {
    const scss = read('photos/styles/vue2-parity/photos.scss')
    expect(ruleBody(scss, '.photos-root .lightbox {')).toMatch(/background\s*:\s*var\(--lb-bg\)/)
    expect(ruleBody(scss, '.photos-root .lb-top {')).toMatch(/background\s*:\s*var\(--lb-chrome\)/)
    expect(ruleBody(scss, '.photos-root .lb-strip {')).toMatch(/background\s*:\s*var\(--lb-chrome\)/)
  })
})

// Plan F Task 6 (brief item 3): sweep the lightbox's own 4 component files for a *bare* color
// literal (no `var(--token…)` wrapper at all, fallback or otherwise) on any surface that should
// be following `.photos-root.is-light` — the exact "dark-literal fallback that would defeat
// is-light" defect class the brief calls out. A `var(--lb-chrome, rgba(0,0,0,0.6))`-style
// fallback is explicitly FINE (the token resolves for real once nested inside `.photos-root`,
// per the case above) — this guard only fires on literals with no token wrapper at all.
//
// The two survivors below are pre-existing, individually-commented `theme-exception`s in their
// own files: a video-duration badge overlaid on an arbitrary photo thumbnail (PhotoFilmstrip.vue,
// same established precedent as PhotosGrid.vue's own `.tile-vid`, photos.scss:467-472 — fixed
// white text needs to read over ANY photo, in either theme) and a map-attribution caption
// overlaid on an arbitrary OSM tile (PhotoInfoPanel.vue, same precedent as PlacesRail.vue's own
// map-credit handling) — neither was ever theme-tokenized in Vue2 either, so this isn't a
// regression of is-light, it's an unrelated, pre-existing, correctly-commented exception. A
// whitelist (not a blanket "no rgba" ban) is the right shape here — same idiom as this file's
// own `--panel-bg-solid` consumer whitelist above: any new bare literal must be explicitly added
// here, forcing a reviewer to ask "is this really a fixed-contrast-over-arbitrary-content case,
// or did someone just forget the token?"
describe('灯箱 4 个组件文件(Task 6):裸色字面量白名单 —— 不新增绕过 is-light 的写死颜色', () => {
  const LIGHTBOX_FILES = [
    'photos/lightbox/PhotoLightbox.vue',
    'photos/lightbox/PhotoFilmstrip.vue',
    'photos/lightbox/PhotoImageViewer.vue',
    'photos/lightbox/PhotoInfoPanel.vue',
  ]

  const ALLOWED_BARE_LITERALS = new Set([
    'photos/lightbox/PhotoFilmstrip.vue::background: rgba(0, 0, 0, 0.55); color: #fff;',
    'photos/lightbox/PhotoInfoPanel.vue::color: rgba(255, 255, 255, 0.72);',
    'photos/lightbox/PhotoInfoPanel.vue::text-shadow: 0 1px 2px rgba(0, 0, 0, 0.65);',
    // M2 (final review, 2026-08-15): the delete-confirm dialog's trash-icon color matches Vue2
    // PhotosLightbox.vue:154's own hardcoded literal exactly (see this line's own theme-exception
    // comment in PhotoLightbox.vue) -- a deliberate one-off parity match, not a drift back toward
    // hardcoded colors generally.
    'photos/lightbox/PhotoLightbox.vue::<div class="lb-confirm-icon" style="color: #FF6B5C"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg></div>',
    // Fix-2 item 4 (owner acceptance, 2026-08-16): the solid-gold favorite star is a fixed
    // semantic color across themes, matching Vue2's own inline hex literal
    // (PhotosLightbox.vue:11, `:color="photo.fav ? '#FFD60A' : 'currentColor'"`) -- same
    // one-off-parity-match precedent as the confirm-icon entry above.
    'photos/lightbox/PhotoLightbox.vue::.lb-fav.is-fav { color: #ffd60a; }',
  ])

  // A line counts as "bare" only if it has a color literal (rgba()/hex) with NO `var(--…)`
  // anywhere on the same line — `var(--lb-chrome, rgba(0,0,0,0.6))`-style fallbacks (token
  // present, literal only as the fallback arm) are correctly excluded by this same check.
  function bareColorLiteralLines(rel: string): string[] {
    return read(rel)
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /rgba?\(|#[0-9a-fA-F]{3,8}\b/.test(l) && !/var\(--/.test(l))
      .map((l) => `${rel}::${l}`)
  }

  it('4 个文件里裸色字面量的完整清单恰好等于已登记的白名单(多一条就红)', () => {
    const found = new Set(LIGHTBOX_FILES.flatMap(bareColorLiteralLines))
    expect(found).toEqual(ALLOWED_BARE_LITERALS)
  })
})

// Fix-1 items 1/6 (owner acceptance, 2026-08-16): dark-theme light frame around `.map-shell`
// (item 1) and light-theme popovers/detail-panel staying dark (item 6) traced to the same root
// cause across the whole Places area — rules using *global* New-UI tokens (`--fg`/`--fg-muted`/
// `--fg-subtle`/`--card-border`/`--panel-bg`/`--panel-bg-solid`/`--popup-bg`/`--card-shadow-hi`/
// `--chip-bg`/`--chip-bg-hi`/`--on-accent`/`--skeleton-bg`/`--accent-text`) instead of this
// area's own Photos-local, is-light-aware equivalents (`--text-1/2/3`/`--line`/`--line-strong`/
// `--surface-1/2/3`/`--accent-hi`/literal Vue2 box-shadows). Global tokens only follow the
// app-wide `[data-theme]` attribute; Photos has its own PRIVATE theme toggle
// (`usePhotosTheme()`/`.photos-root.is-light`, independent of the global one) — so in the very
// common "Photos-light + app-global-dark" combination, every rule below stayed stuck in its
// dark/glass appearance regardless of Photos' own switch. This is a whitelist-style sweep (same
// idiom as this file's other two describe blocks above): every one of these token names should
// have ZERO occurrences left in the places area's own component/parity files; any future
// reintroduction is exactly the class of regression this fix corrects.
describe('Fix-1 items 1/6: Places 区不再消费全局玻璃/文本 token(只跟全站主题、不跟 Photos 私有 is-light)', () => {
  // .vue files: scan only the `<style>` block (via `extractStyleBlock`, which also strips CSS
  // `/* … */` comments) — this file's own `<style>` header comments cite these exact banned
  // token names in prose (documenting the fix), which would otherwise false-positive this
  // guard; `extractStyleBlock` is the same "raw source, comments stripped" idiom PlacesThemeMenu.
  // test.ts/PlacesFilterMenu.test.ts already use for their own `winningHoverBackground` reads.
  // PlaceCoverPicker.vue/PlaceInsights.vue/PlacesZoomBar.vue are deliberately excluded — none
  // has a `<style>` block of its own at all (fully governed by the shared parity scss below;
  // `extractStyleBlock` would throw on any of them, grep-verified).
  const VUE_FILES = [
    'views/PhotosPlaces.vue',
    'photos/components/PlaceDetailPanel.vue',
    'photos/components/PlaceSpotDialog.vue',
    'photos/components/PlaceVisitHistory.vue',
    'photos/components/PlacesRail.vue',
    'photos/components/PlacesFilterMenu.vue',
    'photos/components/PlacesThemeMenu.vue',
  ]
  // The one non-.vue file: a bare .scss, no `<style>` wrapper to extract — strip CSS block
  // comments directly instead.
  const SCSS_FILES = ['photos/styles/vue2-parity/photos-places.scss']

  const BANNED_TOKENS = [
    '--fg\\b', '--fg-muted', '--fg-subtle', '--card-border', '--panel-bg\\b', '--panel-bg-solid',
    '--popup-bg', '--card-shadow-hi', '--chip-bg\\b', '--chip-bg-hi', '--on-accent',
    '--skeleton-bg', '--accent-text',
  ]
  const BANNED_RE = new RegExp(`var\\((${BANNED_TOKENS.join('|')})\\)`)

  function bannedTokenUsages(rel: string, styleText: string): string[] {
    return styleText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => BANNED_RE.test(l))
      .map((l) => `${rel}::${l}`)
  }

  it('Places 区组件 + parity scss 里,以上全局 token 的 var(...) 消费方数量恰好为 0', () => {
    const fromVue = VUE_FILES.flatMap((rel) => bannedTokenUsages(rel, extractStyleBlock(read(rel))))
    const fromScss = SCSS_FILES.flatMap((rel) => bannedTokenUsages(rel, read(rel).replace(/\/\*[\s\S]*?\*\//g, '')))
    expect([...fromVue, ...fromScss]).toEqual([])
  })

  // PlaceSpotDialog.vue's banned-icon-color fix (`--accent-text` → `--accent-hi`) is an inline
  // `style="…"` attribute in its TEMPLATE, not its `<style>` block — the sweep above can't see
  // it (extractStyleBlock only reads `<style>…</style>`). Separate raw-source check for that
  // one template-level occurrence.
  it('PlaceSpotDialog.vue 的地图图钉图标 inline style 不再用 --accent-text', () => {
    const raw = read('photos/components/PlaceSpotDialog.vue')
    expect(raw).not.toMatch(/var\(--accent-text\)/)
    expect(raw).toContain('color: var(--accent-hi); flex: none')
  })
})

// Fix-2 item 4 (owner acceptance, 2026-08-16): same defect class as the Places sweep above
// (Fix-1 items 1/6), found independently in the lightbox family via the owner's acceptance
// screenshot ("light-mode lightbox illegible -- buttons, text, arrows all washed out"). Root
// cause identical: rules consuming *global* New-UI theme.css tokens instead of this area's own
// `.photos-root`/`.photos-root.is-light`-scoped equivalents. Global tokens only follow the
// app-wide `[data-theme]` attribute; Photos has its own PRIVATE toggle
// (`usePhotosTheme()`/`.photos-root.is-light`), so in the common "Photos-light + app-global-dark"
// combination every rule below stayed stuck in its dark appearance. This guard is the lightbox
// counterpart of the Places whitelist sweep: every one of these token names should have ZERO
// `var(...)` occurrences left in the 4 lightbox-family component files' `<style>` blocks.
describe('Fix-2 item 4: 灯箱家族不再消费全局玻璃/文本 token(只跟全站主题、不跟 Photos 私有 is-light)', () => {
  const LIGHTBOX_FILES = [
    'photos/lightbox/PhotoLightbox.vue',
    'photos/lightbox/PhotoInfoPanel.vue',
    'photos/lightbox/PhotoImageViewer.vue',
    'photos/lightbox/PhotoFilmstrip.vue',
  ]

  // `--blur` is deliberately NOT banned here -- it's a shared structural token (blur radius, not a
  // color), consistent with this codebase's "structural values stay shared across themes"
  // convention (CLAUDE.md's theming section); `.lb-live-btn`'s own Fix-2 comment explains this
  // choice for its one remaining consumer.
  const BANNED_TOKENS = [
    '--fg\\b', '--fg-muted', '--fg-subtle', '--card-border', '--tool-bg-hi', '--star-fg',
    '--remove-fg', '--popup-bg', '--chip-bg-hi', '--chip-bg\\b',
  ]
  const BANNED_RE = new RegExp(`var\\((${BANNED_TOKENS.join('|')})\\)`)

  function bannedTokenUsages(rel: string): string[] {
    return extractStyleBlock(read(rel))
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => BANNED_RE.test(l))
      .map((l) => `${rel}::${l}`)
  }

  it('4 个灯箱组件文件里,以上全局 token 的 var(...) 消费方数量恰好为 0', () => {
    expect(LIGHTBOX_FILES.flatMap(bannedTokenUsages)).toEqual([])
  })
})
