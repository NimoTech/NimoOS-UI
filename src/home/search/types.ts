// Search 区视图层共享类型。**纯类型,零逻辑、零 Vue、零 i18n 依赖** ——
// reasons / buildSearchView / degrade 三个纯函数模块与组件共用这一份。
import type { ImageHit } from '@nimotech/nimoos-service'

/** 排序理由标签的语义色。沿用现有 .rz-* 样式;spec §7.5 删掉了 demote 档
 *  (后端没有任何降权信号,demo 里那个「Likely a person name · demoted」是编的)。 */
export type ReasonKind = 'primary' | 'normal' | 'semantic'

/** key = i18n 键名,**不是文案** —— 渲染时 t(key)。 */
export interface Reason { key: string; kind: ReasonKind }

export type ResultCategory = 'Documents' | 'Images' | 'Audio' | 'Videos'

/** 来源徽标三选一(spec §7.6:替换掉无法从后端诚实得出的准确率百分比)。 */
export type SourceBadge = 'semantic' | 'filename' | 'ocr'

/** 一行结果。同一真实路径命中多源时合成一行(spec §7.3)。 */
export interface ResultRow {
  /** 归并键 = 真实路径 */
  realPath: string
  name: string
  category: ResultCategory
  /** 图片 / 视频 → 走缩略图渲染(相册卡 / 媒体行) */
  isMedia: boolean
  /** filenames 源可能返回目录项(is_dir=true);目录不能预览,点击直接进文件夹 */
  isDir: boolean
  reasons: Reason[]
  badge: SourceBadge
  /** 摘要文本;只有 semantic 源有,其余为空串 */
  snippet: string
  /** 排名层(1–5,见 spec §7.4 + 本计划补充规则 A2);不展示,仅排序用 */
  layer: number
  /** 层内排序分。**跨层不可比**(filenames.match 无上界 / semantic.score 是向量相似度) */
  score: number
  /** images 源给的缩略图 URL。**本期不消费**(见 Task 5 注释),留着是为了不丢后端数据 */
  thumbnailUrl?: string
}

export interface SearchTab { key: string; count: number }

export interface SearchView {
  /** 已排序的全部行(层 → 层内分数 → 后端原序) */
  rows: ResultRow[]
  /** 非媒体行,保持 rows 的相对顺序 */
  docRows: ResultRow[]
  /** 媒体行(Images / Videos),保持 rows 的相对顺序 */
  mediaRows: ResultRow[]
  /** [全部结果, ...按命中数降序的分类];分类计数为 0 的不出现 */
  tabs: SearchTab[]
  total: number
}

/** 降级 / 空态的**状态码**,文案在组件里映射(spec §7.8)。 */
export interface DegradeState {
  /** 未参与本次搜索的源(已剥掉 _unavailable 后缀,notes 已过滤)。非空 → 结果区顶部挂提示条 */
  unavailableSources: string[]
  /** 认不出的 warning,原样透传给界面,不静默丢弃 */
  unknownWarnings: string[]
  /** 空态种类;'none' = 有结果,不显示空态 */
  empty: 'none' | 'no_roots' | 'backend_not_ready' | 'no_match'
}

export type { ImageHit }
