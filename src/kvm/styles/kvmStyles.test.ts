/// <reference types="node" />
// 必须用 node:fs 读 .css —— `?raw` 对 .css 在 vitest 下恒为空串(见 color-guard.test.ts)。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const src = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'kvm.css'),
  'utf8',
)

// 本期(P5)允许出现的类名。P6 加新块时往这里补,别偷偷塞。
const ALLOWED = new Set([
  'kvm-page', 'kvm-content', 'kvm-sidebar-toggle', 'toggle-icon', 'collapsed',
  'kvm-sidebar', 'kvm-header', 'kvm-header-left', 'kvm-header-text', 'kvm-header-right',
  'kvm-logo', 'kvm-title', 'kvm-status', 'kvm-settings-btn',
  'vm-list', 'empty-state', 'empty-icon', 'empty-text',
  'vm-list-item', 'active', 'vm-item-icon', 'os-icon', 'vm-item-info', 'vm-item-name',
  'vm-item-specs', 'vm-item-status', 'status-indicator', 'status-dot', 'status-text',
  'running', 'stopped', 'paused', 'suspended', 'error',
  'add-vm-btn', 'kvm-main', 'main-empty', 'empty-icon-ring', 'main-empty-icon',
  'vm-console-container', 'console-header', 'console-title', 'console-os-icon', 'console-status',
  'console-actions', 'action-btn', 'dropdown-wrapper', 'overflow-dropdown', 'dropdown-item',
  'dropdown-icon', 'is-danger', 'confirm-text-danger', 'toggle-indicator', 'on', 'dropdown-divider',
  'console-display', 'console-placeholder', 'console-hint', 'is-error', 'start-vm-btn',
  'power-icon', 'power-svg',
  'sendkey-toolbar', 'sendkey-divider', 'sendkey-btn', 'sendkey-hint', 'sendkey-img',
  'fullscreen-svg',
  // 清理项7(全分支终审核实):sendkey-btn--fullscreen 不在 kvm.css 里出现过——它是
  // SendKeyToolbar.vue 上真实存在的一个 class(用来把全屏按钮和其它 .sendkey-btn 区分
  // 开,供 KvmPage.test.ts 的 `w.get('.sendkey-btn--fullscreen')` 精确选中),样式完全
  // 复用基类 .sendkey-btn,本身没有专属 CSS 规则,纯粹是测试/选择器钩子。留在这份白名单
  // 里不会让上面"没有不在册的类名"那条用例翻红(那条只检查 kvm.css 里出现的类名是不是
  // 都在这个 Set 里,不检查反过来),放着不删也不影响判别力,加注释免得再被当成死条目。
  'sendkey-btn--fullscreen',
  'sendkey-slide-enter-active', 'sendkey-slide-leave-active',
  'sendkey-slide-enter-from', 'sendkey-slide-leave-to',
  'spice-info-bar', 'spice-info-content', 'spice-agent-hint', 'spice-info-close',
  'spice-toast-enter-active', 'spice-toast-leave-active',
  'spice-toast-enter-from', 'spice-toast-leave-to',
  'installation-banner', 'banner-content', 'banner-btn', 'is-loading', 'banner-error',
  'kvm-progress-overlay', 'kvm-progress-card', 'kvm-progress-title', 'kvm-progress-msg',
  'kvm-spinner',

  // P6(创建弹窗 / ISO 选择器 / 快照 / VM 设置 / 全局设置)地基期(Task 0)先登记类名,
  // 样式规则由后续任务(Task 1 起)陆续填进 kvm.css。名字定死,后续任务只许用这些。
  'kvm-dialog-overlay', 'kvm-dialog-content', 'create-vm-modal', 'create-vm-head',
  'create-vm-title', 'create-vm-close', 'create-vm-body', 'create-vm-foot',
  'cv-field', 'cv-label', 'cv-hint', 'cv-input-row', 'cv-input', 'cv-input-unit', 'cv-unit',
  'cv-iso-btn', 'cv-placeholder', 'cv-iso-eject', 'cv-cpu-group', 'cv-cpu-btn',
  'cv-select', 'cv-select-native', 'cv-select-arrow', 'cv-firmware-group', 'cv-firmware-btn',
  'cv-primary-btn', 'cv-error', 'cv-switch', 'cv-switch-track', 'cv-switch-knob',
  'settings-tabs', 'settings-tab',
  'snapshots-body', 'cv-empty-state', 'cv-snapshot-item', 'cv-snapshot-info',
  'cv-snapshot-name', 'cv-snapshot-desc', 'cv-snapshot-date', 'cv-snapshot-actions',
  'cv-btn', 'cv-btn-restore', 'cv-btn-delete',
  'os-selector-body', 'category-filter', 'category-btn', 'os-section', 'os-grid', 'os-card',
  'is-downloaded', 'is-downloading', 'os-icon-wrapper', 'os-info', 'os-name', 'os-version',
  'os-size', 'os-action-btn', 'is-download', 'is-selected', 'is-downloading-btn',
  'custom-section', 'custom-divider', 'custom-browse', 'custom-breadcrumb', 'custom-back-btn',
  'custom-path', 'custom-file-list', 'custom-loading', 'custom-empty', 'custom-file-item',
  'custom-file-icon', 'custom-file-info', 'custom-file-name', 'custom-file-size',
  'custom-file-arrow',
])

describe('kvm.css 类名白名单', () => {
  it('没有不在册的类名', () => {
    const used = new Set([...src.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]))
    expect([...used].filter((c) => !ALLOWED.has(c)).sort()).toEqual([])
  })
})

describe('kvm.css 不含裸颜色字面量(与全局 color-guard 双保险)', () => {
  it('所有颜色走 var(--kvm-*)', () => {
    // 去掉注释后再扫,避免注释里抄的 Vue2 色值被误判(color-guard 不剥注释,是已知坑,
    // 所以本文件的注释里**不要写** #hex)。
    const noComment = src.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(noComment).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(noComment.replace(/var\([^)]*\)/g, '')).not.toMatch(/\b(rgba?|hsla?)\s*\(/)
  })
})

// 评审 Minor 修复(task-4 追加):add-vm-btn / kvm-settings-btn 是 P6 前的 disabled
// 占位按钮(Vue2 没有这个态,New-UI 新增),之前 hover 规则对 disabled 态照样生效——
// 鼠标移上去变紫底紫字、光标还是小手,看起来像能点。jsdom 测计算样式对"谁压过谁"
// 不可靠(本项目没有现成的 CSS 优先级自算工具,已 grep 确认),这里改成对源码文本的
// 静态断言:直接读 CSS 规则文本,比拿 jsdom 猜级联更准。写法抄了 settings 区那个
// hover-guard 加 disabled-cursor 的既有惯例(class 名不在本文件里字面写出,
// 避免撞上面的类名白名单扫描器)。
describe('禁用按钮 hover/cursor 不误导用户(add-vm-btn / kvm-settings-btn)', () => {
  it('hover 规则必须带 :not(:disabled),不能对 disabled 态生效', () => {
    // 反例:裸 `.add-vm-btn:hover {` / `.kvm-settings-btn:hover {`(没有 :not(:disabled))不允许出现。
    expect(src).not.toMatch(/\.add-vm-btn:hover\s*\{/)
    expect(src).not.toMatch(/\.kvm-settings-btn:hover\s*\{/)
    expect(src).toMatch(/\.add-vm-btn:hover:not\(:disabled\)/)
    expect(src).toMatch(/\.kvm-settings-btn:hover:not\(:disabled\)/)
  })

  it('disabled 态必须显式 cursor: not-allowed(禁用按钮不能看起来像能点)', () => {
    const addDisabledBlock = src.match(/\.add-vm-btn:disabled\s*\{([^}]*)\}/)
    const settingsDisabledBlock = src.match(/\.kvm-settings-btn:disabled\s*\{([^}]*)\}/)
    expect(addDisabledBlock?.[1]).toMatch(/cursor:\s*not-allowed/)
    expect(settingsDisabledBlock?.[1]).toMatch(/cursor:\s*not-allowed/)
  })
})

// 全分支评审修复(C2):`.cv-snapshot-date` 漏了 Vue2 :3021-3022 的两条声明,鼠标移到
// 「创建于: …」上会显示浏览器默认的 I 形文本光标(Vue2 是普通箭头)。jsdom 计算样式
// 不可靠(kvmStyles.test.ts 顶部注释已经点过这一点),所以像上面 disabled cursor 那条
// 一样,直接对 kvm.css 源文件文本做正则断言,不依赖 jsdom 渲染出来的 computed style。
describe('kvm.css .cv-snapshot-date 补齐 cursor/text-decoration(C2)', () => {
  it('cursor: default 且 text-decoration: none(照 Vue2 :3021-3022)', () => {
    const block = src.match(/\.snapshots-body \.cv-snapshot-date\s*\{([^}]*)\}/)
    expect(block?.[1]).toMatch(/cursor:\s*default/)
    expect(block?.[1]).toMatch(/text-decoration:\s*none/)
  })
})

// ════════════════════════════════════════════════════════════════════
// Task 11 收尾固化:白名单的反向检查。
//
// 上面「没有不在册的类名」那条用例是单向的——只查 kvm.css 里出现的类名是否都在 ALLOWED
// 里登记过,不查反向(模板用了某个类,但 kvm.css 里压根没有任何规则给它)。Task 9 就因此
// 把 `.settings-tabs`/`.settings-tab` 整块样式漏掉过:两个 tab 渲染成浏览器默认按钮,而
// 三道门全绿——17 条单测断言的是 classList.contains('active') 而不是计算样式(jsdom 下
// 计算样式本来就不可靠),白名单又不查反向,谁都没能拦住。
//
// 这里补一条自动化的反向核对,不再依赖人工记得跑 brief 里那条 comm 命令:
// 1) 只取 .vue 模板里**静态** `class="..."` 属性(排除 `:class="..."`)——动态 `:class`
//    绑定的对象/数组语法（如 `{ active: x, 'is-loading': busy }`）会把 JS 变量名/字符串
//    字面量也匹配进去（`busy`/`form.firmware`/`'uefi'` 之类),不是类名，没法用简单正则
//    可靠地把它们和真类名分开；而 Task 9 那次真实漏样式的两个类（settings-tabs/
//    settings-tab）恰好都是静态 class 属性，只查静态就足够逮住这一类回归。先剥掉
//    `<!-- -->` HTML 注释再扫，避免注释里示例代码（如 VmSettingsDialog.vue 里演示测试
//    写法的注释文本）被误当成真实模板用法。
// 2) 从 kvm.css 里剥注释后按“选择器 { ”切块，取每个非 @ 开头选择器里出现的所有
//    `.class` token（不只是行首第一个——复合/后代选择器如
//    `.snapshots-body .cv-snapshot-item:hover` 里，`cv-snapshot-item` 不是行首第一个
//    token，但确实有规则在管它),这样才不会把“确实有样式、只是不在选择器最前面”的类
//    误判成漏样式。
// 3) 差集 = 静态用了但 kvm.css 任何选择器里都没出现过的类。当前唯一一项是
//    `sendkey-btn--fullscreen`——纯测试/选择器钩子（SendKeyToolbar.vue 上追加的第二个
//    class，只为让 KvmPage.test.ts 精确选中全屏按钮而非其它 .sendkey-btn，视觉完全复用
//    基类 .sendkey-btn，从未有专属规则,详情见上面 ALLOWED 里紧邻它的注释)，登记为
//    唯一例外。若以后差集里出现新名字，说明真的漏了样式,不能直接加进例外名单了事。
describe('kvm.css 反向检查:模板静态 class 用了但 kvm.css 没有任何样式规则', () => {
  // 纯测试/选择器钩子,理由见上方大注释。以后每新增一项例外都必须在这里写清原因。
  const NO_STYLE_EXPECTED = new Set([
    'sendkey-btn--fullscreen',
  ])

  function collectStaticUsedClasses(): Set<string> {
    const kvmDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
    const vueFiles: string[] = []
    const walk = (dir: string): void => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name)
        if (e.isDirectory()) walk(full)
        else if (e.name.endsWith('.vue')) vueFiles.push(full)
      }
    }
    walk(kvmDir)

    const used = new Set<string>()
    for (const f of vueFiles) {
      const raw = fs.readFileSync(f, 'utf8').replace(/<!--[\s\S]*?-->/g, '')
      // `(^|[^:])` 排除 `:class="..."`(动态绑定),只要静态 `class="..."`。
      for (const m of raw.matchAll(/(^|[^:])\bclass="([^"]*)"/g)) {
        for (const cls of m[2].split(/\s+/).filter(Boolean)) used.add(cls)
      }
    }
    return used
  }

  function collectStyledClasses(): Set<string> {
    const noComment = src.replace(/\/\*[\s\S]*?\*\//g, '')
    const styled = new Set<string>()
    for (const m of noComment.matchAll(/([^{}]+)\{/g)) {
      const selector = m[1].trim()
      if (selector.startsWith('@')) continue // @media/@keyframes 的头部,不是选择器
      for (const c of selector.match(/\.[a-zA-Z][\w-]*/g) ?? []) styled.add(c.slice(1))
    }
    return styled
  }

  it('静态 class 属性里出现的类,kvm.css 里都至少有一条规则管(例外名单之外)', () => {
    const used = collectStaticUsedClasses()
    const styled = collectStyledClasses()
    const missing = [...used]
      .filter((c) => !styled.has(c) && !NO_STYLE_EXPECTED.has(c))
      .sort()
    expect(missing, `以下静态 class 在 kvm.css 里没有任何规则(真漏样式,不在例外名单里):\n${missing.join(', ')}`).toEqual([])
  })

  it('例外名单本身不该有多余项(如果某天补齐了样式,要把它从例外名单里摘掉)', () => {
    const styled = collectStyledClasses()
    const staleExceptions = [...NO_STYLE_EXPECTED].filter((c) => styled.has(c))
    expect(staleExceptions, `以下例外项其实已经有样式了,应从 NO_STYLE_EXPECTED 里删除:\n${staleExceptions.join(', ')}`).toEqual([])
  })
})

// 2026-08-03 真机验收修复的守卫:画布几何必须由 noVNC 自己定,CSS 不许抢。
// 抢了(Vue2 原样的 width/height:100% !important)会让 noVNC 的鼠标坐标换算失准——
// 详细因果链与探针实测数据写在 kvm.css 对应规则的注释里。这条断言只盯"有没有把尺寸
// 抢回来",不关心居中用的是 margin:auto 还是别的写法。
describe('noVNC 画布几何归 noVNC 管(scaleViewport 生效的前提)', () => {
  it('canvas 规则里不许出现 !important 的宽高', () => {
    const canvasBlock = src.match(/\.console-display canvas\s*\{([^}]*)\}/)
    expect(canvasBlock).not.toBeNull()
    expect(canvasBlock![1]).not.toMatch(/width:[^;]*!important/)
    expect(canvasBlock![1]).not.toMatch(/height:[^;]*!important/)
  })

  it('canvas 仍然绝对定位、压在占位层之上(T6 的既有诉求不能被这次修复弄丢)', () => {
    const canvasBlock = src.match(/\.console-display canvas\s*\{([^}]*)\}/)![1]
    expect(canvasBlock).toMatch(/position:\s*absolute/)
    expect(canvasBlock).toMatch(/z-index:\s*2/)
  })
})

describe('KVM 全屏页的 toast 不占用控制台画面', () => {
  const toast = fs.readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../components/AppToast.vue'),
    'utf8',
  )

  it('AppToast 的 bottom 走可覆写变量,默认值不变', () => {
    expect(toast).toContain('bottom: var(--toast-bottom, 118px)')
    expect(toast).toContain('z-index: 10100') // 别回退掉「弹窗压不住 toast」那次修复
  })

  it('覆写落在根元素上,不是 .kvm-page 上', () => {
    // 实测(真 chromium,不是 jsdom):`.toast-stack` 挂在 App.vue 层、是 `.kvm-page` 的
    // **兄弟**而不是后代,所以把 --toast-bottom 写在 .kvm-page 上时变量根本继承不到 ——
    // toast 停在默认的 118px。写成 :root:has(.kvm-page) 才生效。这条断言就是钉住这个
    // 落点:哪天有人"顺手简化"成 .kvm-page,它会红,而不是静默失效。
    const override = src.match(/([^\n{}]*)\{[^}]*--toast-bottom:\s*\d+px/)
    expect(override, '找不到 --toast-bottom 的覆写').not.toBeNull()
    expect(override![1]).toContain(':root')
    expect(override![1]).toContain(':has(')
  })
})

// SP16 Task 9:变体自带的 hover 背景必须赢过它继承的基类 hover 背景,否则指针一进去
// 背景被整块换掉、文字色还是变体的 → 白底白字。基类 `.x:hover` 是 (0,2,0)、单类变体
// 只有 (0,1,0),而 CSS 优先级高者胜**与书写顺序无关**。jsdom 既不级联也进不了 hover,
// 只能自己算优先级(复用 src/styles/__tests__ 下那份纯函数)。
//
// `.cv-btn-create` 不在列:全仓只有 kvm.css 里一句注释提到它(:2078),既没有 CSS 规则
// 也没有模板引用 ⇒ 死类名。台账那份 6 个的清单把它算进去了,实际是 5 个。
import { winningHoverBackground, hoverBackgroundRules } from '../../styles/__tests__/cssCascade'

// ⚠️ 必须先剥注释:cssCascade 的 parseCssRules 把 `{` 之前的所有文本当选择器,而
// kvm.css 里几乎每条规则上面都压着一大段中文注释 —— 不剥的话注释会被并进选择器、
// 匹配全部落空,守卫会"因为找不到规则"而空转(它自己的 extractStyleBlock 在读 SFC 时
// 也是先剥注释,这里读 .css 走的是 node:fs,得自己做同一步)。
const cssNoComments = src.replace(/\/\*[\s\S]*?\*\//g, '')

const BUTTONS: Array<{ classes: string[]; variant: string }> = [
  { classes: ['cv-btn', 'cv-btn-restore'], variant: 'cv-btn-restore' },
  { classes: ['cv-btn', 'cv-btn-delete'], variant: 'cv-btn-delete' },
  { classes: ['cv-primary-btn'], variant: 'cv-primary-btn' },
  // os-action-btn 的 hover 全部写在 `.os-action-btn.is-xxx:hover` 上,所以要带上变体类
  // 才命中(匹配器要求选择器里的每个类都在 classes 内)。
  { classes: ['os-action-btn', 'is-download'], variant: 'is-download' },
  { classes: ['os-action-btn', 'is-selected'], variant: 'is-selected' },
]

describe('KVM 按钮的 hover 背景没有被基类压过', () => {
  for (const b of BUTTONS) {
    it(`.${b.variant} 的 hover 背景来自最具体的那条规则`, () => {
      // 一条 hover 背景规则都找不到时 winningHoverBackground 会抛 —— 那也该红,
      // 不能是"没找到 = 通过"。
      const win = winningHoverBackground(cssNoComments, b.classes)
      // 赢家必须提到变体自己的类名 —— 基类赢 = 变体的底被整块替换掉了。
      expect(win.selector, `赢家是 ${win.selector}(优先级 ${win.specificity})`).toContain(b.variant)
    })
  }

  // .category-btn 体检的结论是"不适用",单独记下来而不是塞进上面那张表:它的 hover
  // (:1542 `.category-btn:hover:not(.active)`)**有意**只改 color 与 border-color,
  // 一个 background 声明都没有 —— 没有背景被替换,就没有"白底白字"这个失效模式。
  // 断言写成双向:hover 规则必须存在(否则是别的东西坏了,不能静默通过),而且**不能**
  // 有任何命中它的 hover 背景规则。哪天有人给它(或它的基类)加了 hover 背景,这条会红,
  // 逼着重新判断它是不是进了上面那张风险表。
  it('.category-btn 不适用本检查:hover 有意只改文字与描边,没有背景可被替换', () => {
    expect(src).toMatch(/\.category-btn:hover:not\(\.active\)\s*\{/) // 防空转
    expect(hoverBackgroundRules(cssNoComments, ['category-btn'])).toEqual([])
  })
})
