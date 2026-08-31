// Merge exit point —— see the header comment in zh_cn.ts for the rationale and structure of the
// split (both languages correspond entry-for-entry).
// Merge: added the ai slice (en_us.ai.ts), corresponding entry-for-entry with the zh side.
import base from './en_us.base'
import photos from './en_us.photos'
import ai from './en_us.ai'

export default { ...base, ...photos, ...ai }
