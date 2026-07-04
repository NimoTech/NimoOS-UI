// fake-indexeddb clones values via structuredClone, which does not recognize
// jsdom's Blob class (a jsdom Blob silently serializes to {}). Node's native
// Blob IS recognized, so tests that round-trip blobs through IndexedDB use it.
import { Blob as NodeBlob } from 'node:buffer'
globalThis.Blob = NodeBlob as unknown as typeof Blob
