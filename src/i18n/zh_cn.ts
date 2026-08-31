// This file changed from "one whole copy table" into a few-line **merge outlet**; the real content is split into pieces:
//   zh_cn.base.ts   — copy shared across areas + each area's own copy
//   zh_cn.photos.ts — the 702 photos* keys of the Photos area
//   zh_cn.ai.ts     — the 1207 ai* keys of the AI area (added during a later merge)
//
// Why split: those keys used to be scattered across 90+ sections of one very large file,
// which made the main table hard to maintain and made parallel lines collide in it
// constantly. Each area now owns its own slice, and this file is only the merge outlet.
//
// Why keep this file as the outlet (instead of having consumers import the pieces
// themselves): 40+ tests across the repo do `import zh from '…/i18n/zh_cn'` and build their
// own createI18n; changing each to "import one more piece" is noisy and would repeat at the
// next sharding. With the outlet unchanged, consumers change zero lines.
//
// Note: the SP9 shard (zh_cn.sp9.ts) is **not part of this outlet** — it is merged in
// separately in i18n/index.ts and parity.test.ts; that is a second assembly path distinct from base/photos/ai here.
import base from './zh_cn.base'
import photos from './zh_cn.photos'
import ai from './zh_cn.ai'

export default { ...base, ...photos, ...ai }
