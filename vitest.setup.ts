// fake-indexeddb clones values via structuredClone, which does not recognize
// jsdom's Blob class (a jsdom Blob silently serializes to {}). Node's native
// Blob IS recognized, so tests that round-trip blobs through IndexedDB use it.
import { Blob as NodeBlob } from 'node:buffer'
globalThis.Blob = NodeBlob as unknown as typeof Blob

import { vi } from 'vitest'
// router/index.ts 被 useOpenAction(应用内跳转,P8)静态引入后,任何挂载 home 组件的测试
// 都会拖进 Welcome.vue → lottie-web(它在 import 期做 canvas 探测,jsdom 无 canvas 必炸)。
// 在此全局 mock 一处封掉 —— router/index.test.ts 的同款 workaround 上移为全局。
vi.mock('lottie-web', () => ({ default: { loadAnimation: vi.fn(() => ({ addEventListener: vi.fn(), destroy: vi.fn() })) } }))

// Install i18n globally for all component mounts so any component using
// useI18n()/$t works without each test wiring the plugin. Tests that pass their
// own i18n instance via `global.plugins` still override this (applied later).
import { config } from '@vue/test-utils'
import { i18n } from './src/i18n'
config.global.plugins = [...(config.global.plugins ?? []), i18n]
