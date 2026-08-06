// SP7-P8b:合并出口 —— 拆分理由与结构说明见 zh_cn.ts 的文件头注释(两语言逐条成对)。
// SP8-P6 合流:新增 ai 一片(en_us.ai.ts),与 zh 侧逐条对应。
import base from './en_us.base'
import photos from './en_us.photos'
import ai from './en_us.ai'

export default { ...base, ...photos, ...ai }
