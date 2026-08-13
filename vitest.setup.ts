// fake-indexeddb clones values via structuredClone, which does not recognize
// jsdom's Blob class (a jsdom Blob silently serializes to {}). Node's native
// Blob IS recognized, so tests that round-trip blobs through IndexedDB use it.
import { Blob as NodeBlob } from 'node:buffer'
globalThis.Blob = NodeBlob as unknown as typeof Blob

import { vi } from 'vitest'
// Once router/index.ts is statically imported by useOpenAction (in-app navigation, P8),
// any test mounting home components drags in Welcome.vue → lottie-web (which does canvas
// detection at import time; jsdom has no canvas, guaranteed crash).
// Sealed off with a single global mock here — router/index.test.ts's identical workaround promoted to global.
vi.mock('lottie-web', () => ({ default: { loadAnimation: vi.fn(() => ({ addEventListener: vi.fn(), destroy: vi.fn() })) } }))

// Same problem, new source (T7): router/index.ts now also statically imports AppConsolePage.vue
// → TerminalPane.vue → '@xterm/xterm', which does canvas feature-detection at module *import*
// time (not just on `new Terminal()`) — jsdom has no canvas, so any test that transitively
// imports router (nearly all of them) would print a jsdom "getContext not implemented" error.
// Global mock, same remedy as lottie-web above; components that need real xterm behavior
// (TerminalPane.test.ts, AppConsolePage.test.ts) mock it themselves with more detail anyway.
vi.mock('@xterm/xterm', () => ({ Terminal: vi.fn(function () { return { open: vi.fn(), loadAddon: vi.fn(), dispose: vi.fn(), cols: 80, rows: 24 } }) }))

// Install i18n globally for all component mounts so any component using
// useI18n()/$t works without each test wiring the plugin. Tests that pass their
// own i18n instance via `global.plugins` still override this (applied later).
import { config } from '@vue/test-utils'
import { i18n } from './src/i18n'
config.global.plugins = [...(config.global.plugins ?? []), i18n]

// jsdom does not implement Element.prototype.scrollIntoView (it's a layout API,
// and jsdom does no layout). Any component that calls it -- e.g.
// TimeMachineRail.vue's "keep the selected tick in view" watch -- throws
// "scrollIntoView is not a function" the moment it mounts, even in tests that
// never assert anything about scrolling. Because that call sits inside an
// `async` watch callback, the throw becomes an *unhandled promise rejection*
// rather than a normal test failure: the test itself still goes green, but the
// suite run prints a wall of "Unhandled Rejection" noise that can bury a real
// failure. Stub it globally as a no-op so every mount gets a working method;
// tests that need to observe calls (e.g. TimeMachineRail.test.ts) reassign
// `Element.prototype.scrollIntoView` to their own spy per-test, which simply
// overwrites this default for the duration of that test.
Element.prototype.scrollIntoView = () => {}
