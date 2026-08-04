import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { NEW_UI, OSS_DIR } from './manifest.mjs'

// T15(d):波形颜色那屏(T10 挂过来的证据)——眼验环境没有后端/真实音频文件,补一条
// 组件级测试当替代证据。按项目既有教训(见 New-UI CLAUDE.md 与"New-UI 按钮 hover 变白坑"
// 记忆:jsdom 不会完整跑 CSS 级联,getComputedStyle 对 var() 链不可靠),这里**不**依赖
// getComputedStyle 去读最终颜色值——而是分两层断言"解析链本身是有效的":
//   1. 挂载真实导出产物里的 MediaViewer.vue(不是私有仓那份带说话人功能的版本——
//      两者模板不同,只有导出产物这份才是最终发布的东西),桩一个音频文件,断言
//      .np-wave-bar 确实按 waveBars 渲染出多个竖条节点(不是 0 个/渲染失败)。
//   2. 静态读取该组件编译后的 <style> 源码,确认 .np-wave-bar 的 background 声明
//      引用的是 var(--wave-none) 这个 token(不是硬编码颜色、不是拼写错的 token 名);
//      再静态读取 theme.css,确认 --wave-none 在 :root 与 :root[data-theme="light"]
//      两套主题块里都有定义——两段拼起来就是"竖条会不会显示出颜色"这条解析链上
//      三个必要环节(渲染出节点 → 组件引用了正确的 token → token 在两套主题里都有值),
//      比静态 grep 更进一步(实际挂载渲染验证了运行时行为),但仍如实标注:
//      不是像素级截图,浏览器最终渲染仍建议真机复核。
//
// 用真实导出产物而不是私有仓源码——通过临时导出一份产物树(与 tree.test.mjs 同一套
// 机制),动态 import 里面的 MediaViewer.vue,这样 ./ViewerShell.vue、./mediaKind、
// ./waveform 等同目录相对导入才能正确解析到导出产物里对应的兄弟文件。临时目录特意
// 放在仓库内部(而不是系统 /tmp)——Vite dev/test 的模块服务器默认只允许 fs.allow
// 范围内的文件,系统 /tmp 目录在这个范围之外,动态 import 会被拒绝。

vi.mock('@nimotech/nimoos-service', () => ({
  service: { file: { fileUrl: (p) => `http://x${p}` } },
}))

const TMP = path.join(OSS_DIR, '.tmp-media-wave-test')
let MediaViewer

beforeAll(async () => {
  // jsdom 没实现 HTMLMediaElement.play()——组件 onMounted 里的自动播放
  // (`audioMedia.value?.play?.().catch(() => {})`)在 jsdom 下会同步抛
  // "Not implemented",变成未捕获异常,把整个 vitest 进程的退出码拖成非 0
  // (哪怕四条断言全过)。这与本测试要验证的"波形竖条颜色解析链"无关,只是
  // jsdom 环境本身缺这个 API——桩掉即可,不代表组件有问题。
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
  window.HTMLMediaElement.prototype.pause = vi.fn()

  fs.rmSync(TMP, { recursive: true, force: true })
  execFileSync('node', [path.join(OSS_DIR, 'export.mjs'), '--out', TMP, '--skip-guard', '--no-commit', '--allow-dirty-oss'], {
    stdio: 'pipe', encoding: 'utf8', cwd: NEW_UI,
  })
  const mod = await import(path.join(TMP, 'src/files/viewers/MediaViewer.vue'))
  MediaViewer = mod.default
}, 180_000)

afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }))

describe('T15(d):导出产物 MediaViewer 的波形竖条颜色解析链', () => {
  it('音频文件挂载后 .np-wave-bar 渲染出多个竖条(不是空/渲染失败)', () => {
    const w = mount(MediaViewer, {
      props: {
        item: { name: 'song.mp3', path: '/DATA/Music/song.mp3', is_dir: false },
        list: [],
      },
    })
    const bars = w.findAll('.np-wave-bar')
    expect(bars.length).toBeGreaterThan(10) // WAVE_N 量级的竖条,不是 0/1 个
    w.unmount()
  })

  it('.np-wave-bar 的 background 声明引用 var(--wave-none)(不是硬编码色/错别 token)', () => {
    const src = fs.readFileSync(path.join(TMP, 'src/files/viewers/MediaViewer.vue'), 'utf8')
    const styleBlock = src.slice(src.indexOf('<style'))
    const rule = styleBlock.match(/\.np-wave-bar\s*\{[^}]*\}/)
    expect(rule, '找不到 .np-wave-bar 的 CSS 规则块').toBeTruthy()
    expect(rule[0]).toMatch(/background:\s*var\(--wave-none\)/)
  })

  it('已播竖条 .played 引用 var(--accent)(有别于未播的 --wave-none,证明确实是"有颜色"而不是两态同色)', () => {
    const src = fs.readFileSync(path.join(TMP, 'src/files/viewers/MediaViewer.vue'), 'utf8')
    const styleBlock = src.slice(src.indexOf('<style'))
    const rule = styleBlock.match(/\.np-wave-bar\.played\s*\{[^}]*\}/)
    expect(rule, '找不到 .np-wave-bar.played 的 CSS 规则块').toBeTruthy()
    expect(rule[0]).toMatch(/background:\s*var\(--accent\)/)
  })

  it('--wave-none 这个 token 在导出产物的 theme.css 里,:root 与 :root[data-theme="light"] 两套主题块都有定义', () => {
    const themeCss = fs.readFileSync(path.join(TMP, 'src/styles/theme.css'), 'utf8')
    // 用与 tree.test.mjs/parity 测试同样的思路:分别切出两个 :root 块,各自要求含 --wave-none。
    const rootBlock = themeCss.match(/:root\s*\{[^}]*\}/s)
    const lightBlock = themeCss.match(/:root\[data-theme=["']light["']\]\s*\{[^}]*\}/s)
    expect(rootBlock, '找不到 :root 主题块').toBeTruthy()
    expect(lightBlock, '找不到 :root[data-theme="light"] 主题块').toBeTruthy()
    expect(rootBlock[0]).toMatch(/--wave-none\s*:/)
    expect(lightBlock[0]).toMatch(/--wave-none\s*:/)
  })
})
