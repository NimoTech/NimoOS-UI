// 历史(SP1–SP12):共享包曾是 `file:../NimoOS-Service` 外部依赖,必须留在 vite 的
// optimizeDeps.exclude 里,否则会被静默喂旧包(详见 vite.config.ts 顶部同名历史注释,
// SP9-P1 验收就是这么丢了一轮:4 个写操作全报"保存配置失败")。
//
// SP13(2026-08-07)内联后根治:包搬进本仓 packages/service/、入口直指 TS 源码,
// Vite 永远按源码文件加载,不再存在"预打包缓存喂旧包"这条链路,optimizeDeps.exclude
// 与配套的 include: ['axios'] 已一并删除。
//
// 本测试反向守卫:内联后不应该再把该包塞回 optimizeDeps.exclude —— 若又出现,
// 说明有人把仓内包又当成了外部 file: 依赖在用,回归到了 SP13 之前的旧模式,需要查清。
/// <reference types="node" />
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const CONFIG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../vite.config.ts')

describe('vite optimizeDeps 守卫', () => {
  it('内联后共享包不应再出现在 optimizeDeps.exclude 里', () => {
    const src = fs.readFileSync(CONFIG, 'utf8')
    const block = src.match(/optimizeDeps\s*:\s*\{[\s\S]*?\}/)
    if (block) {
      expect(block[0]).not.toMatch(/'@nimotech\/nimoos-service'/)
    }
  })
})
