// SP7-P8b:本文件从"一整份文案表"改成 3 行的**合并出口**,真正的内容拆成两块:
//   zh_cn.base.ts   —— 全区共用 + 各区自己的文案
//   zh_cn.photos.ts —— 相册区那 702 个 photos* 键
//
// 为什么拆:开源版没有相册区,`oss/manifest.mjs` 要把相册文案剥掉。原先那 702 个键散在
// 主文件 90 多个区段里,剥它们意味着 ~90 条锚点补丁 × 2 语言 —— 而 PATCH 要求锚点命中恰好
// 1 次,以后**改任何一条相册文案都会把开源导出打红**。拆开之后开源侧只需:删掉
// zh_cn.photos.ts 一个文件 + 把下面那行 photos 展开补丁掉。
//
// 为什么保留本文件作为出口(而不是让消费方各自 import 两块):全仓有 40+ 个测试
// `import zh from '…/i18n/zh_cn'` 自建 createI18n,把它们逐个改成"再多 import 一块"既吵
// 又会在下次分片时重演。出口不动,消费方就一行都不用改。
import base from './zh_cn.base'
import photos from './zh_cn.photos'

export default { ...base, ...photos }
