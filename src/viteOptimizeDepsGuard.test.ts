// 约定守卫:共享包 @nimotech/nimoos-service 必须留在 vite 的 optimizeDeps.exclude 里。
//
// SP13(2026-08-07)起该包已内联到本仓 `packages/service/`(`package.json` 里是
// `file:packages/service`,不再是 `file:../NimoOS-Service`)——但这条守卫依旧必需,
// 别因为"包已经在仓里了"就觉得它过期。原因:它依旧是 `file:` 依赖,依旧经
// `node_modules` 解析(pnpm 把 `packages/service/` 硬链进 `.pnpm` 目录),Vite 眼里
// 跟任何普通 node_modules 依赖没有区别,照样会被当依赖预打包进
// `node_modules/.vite/deps/`;而预打包缓存的失效判据是 lockfile / config / 依赖版本号,
// **不看依赖内容**——编辑 `packages/service/src/*.ts` 从不触发这条失效判据。
//
// 为什么值得一条测试看着:这条配置一旦被"清理"掉,失败是**静默的、只在 dev 复现**的 ——
// SP9-P1 验收就是这么丢了一轮(4 个写操作全报"保存配置失败"),SP13 内联时也曾误判
// "入口指源码 ⇒ 不再需要 exclude"把它删过一次,实测证伪后又恢复。单测走源码、生产
// build 走 node_modules,两边都是新的,所以这条坑只在 dev server 上暴露,测试测不出来
// ——这条守卫存在的意义就是防"删掉配置但三道门全绿"这种事故。
/// <reference types="node" />
import fs from 'node:fs'
import path from 'node:path'
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
