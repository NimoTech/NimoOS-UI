// 约定守卫:共享包 @nimotech/nimoos-service 必须留在 vite 的 optimizeDeps.exclude 里。
//
// 为什么值得一条测试看着:这条配置一旦被"清理"掉,失败是**静默的、只在 dev 复现**的 ——
// 该包是 `file:../NimoOS-Service` 依赖,pnpm 把它的 dist 硬链进 .pnpm 目录,于是 Vite
// 当普通 node_modules 依赖预打包进 node_modules/.vite/deps/;而预打包缓存的失效判据是
// lockfile / config / 依赖版本号,**不看依赖内容**,这个包版本号恒为 0.0.1 ——
// `cd ../NimoOS-Service && pnpm build` 之后缓存不失效,dev server 一直喂浏览器旧包,
// 新加的方法在浏览器里全是 undefined(`xxx is not a function`,调用处 catch 成"保存失败")。
// 单测走 dist、生产 build 走 node_modules,两边都是新的,所以这条只在实机验收时暴露
// —— SP9-P1 验收就是这么丢了一轮(4 个写操作全报"保存配置失败")。
//
// 本仓("type": "module")__dirname 在 ESM 下不可用,改用 fileURLToPath(import.meta.url)
// 的等价写法;本仓未装 @types/node —— node:fs / node:path / node:url 没有类型声明,
// `pnpm exec vue-tsc --noEmit` 会报 TS2307,逐行 @ts-expect-error 抑制
// (照 knowledgeStyles.test.ts / QueueView.test.ts / IndexedFilesView.test.ts 头注释的既定手法逐字复用)。
// @ts-expect-error -- 本仓未装 @types/node,node:fs 无类型声明,见上方注释
import fs from 'node:fs'
// @ts-expect-error -- 本仓未装 @types/node,node:path 无类型声明,见上方注释
import path from 'node:path'
// @ts-expect-error -- 本仓未装 @types/node,node:url 无类型声明,见上方注释
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const CONFIG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../vite.config.ts')

describe('vite optimizeDeps 守卫', () => {
  it('共享包 @nimotech/nimoos-service 在 optimizeDeps.exclude 里', () => {
    const src = fs.readFileSync(CONFIG, 'utf8')
    const block = src.match(/optimizeDeps\s*:\s*\{[\s\S]*?\}/)
    expect(block, 'vite.config.ts 里找不到 optimizeDeps 块').not.toBeNull()
    expect(block![0]).toMatch(/exclude\s*:\s*\[[^\]]*'@nimotech\/nimoos-service'/)
  })
})
