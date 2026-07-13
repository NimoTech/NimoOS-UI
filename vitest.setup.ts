// fake-indexeddb clones values via structuredClone, which does not recognize
// jsdom's Blob class (a jsdom Blob silently serializes to {}). Node's native
// Blob IS recognized, so tests that round-trip blobs through IndexedDB use it.
import { Blob as NodeBlob } from 'node:buffer'
globalThis.Blob = NodeBlob as unknown as typeof Blob

// Install i18n globally for all component mounts so any component using
// useI18n()/$t works without each test wiring the plugin. Tests that pass their
// own i18n instance via `global.plugins` still override this (applied later).
import { config } from '@vue/test-utils'
import { i18n } from './src/i18n'
config.global.plugins = [...(config.global.plugins ?? []), i18n]
