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
