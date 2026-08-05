// "Nimo 理解为" 结构化 token 抽取 —— 从自然语言搜索词里挑出可映射为真实过滤条件
// 的三类信息(人物/媒体类型/时间),供搜索栏展示 chip 并一键套用为过滤条件。
// Ported from Vue2 NimoOS-UI src/views/Photos/PhotosSearchView.vue:474-497
// (`understood` computed),但人名匹配的判据做了修正,见下方 hasWordBoundedMatch。

import type { QuickKey } from './dateRange'
import { QUICK_LABEL_KEYS } from './dateRange'

// 调用方传入的人物候选——只含"已命名"的真实人物(相当于 Vue2 realPeopleList
// 过滤掉 unnamed 之后的形状),不带 named 字段是因为过滤已经由调用方做过。
export interface PersonOption {
  id: string
  name: string
  count: number
  coverFaceId: string
}

export type UnderstoodKind = 'person' | 'type' | 'time'

export interface UnderstoodToken {
  k: UnderstoodKind
  v: string
  id?: string
  // 偏离登记(brief §7e-5 + 结构规格第 1 条):Vue2 靠 v 的英文字符串反查
  // quickRange(如 case 'Today'),i18n 化后 v 会变成待 t() 的键名/年份串,不能
  // 再拿去反查。New-UI 新增 quick 字段承载"机器可读"的那份信息,QuickKey 取
  // 自 dateRange.ts(五个快捷键字面量),年份用 number。调用方按 quick 分支:
  // 是 QuickKey 就走 quickRange(quick, now, t(v)),是 number 就走
  // yearRange(quick, v)。
  //
  // fix round 1 · M5(交接给 T16 的连带影响,只登记不改代码):queryParts 的
  // keywords 来自 understood(...).map(t => t.v.toLowerCase())(brief 结构规格
  // 第 2 条)。Vue2 里 time token 的 v 是英文标签,其中 'Last year'/'This
  // year'/'Today' 三个恰好能在查询原文里逐字命中,所以 Vue2 会把查询框里这几个
  // 词高亮出来。这里 v 改成了 i18n 键名(如 photosSearchLastYear),toLowerCase()
  // 后是 'photossearchlastyear',永远匹配不上查询原文里的 'last year';即便下游
  // 改传 t(v),中文 locale 下的"去年"也匹配不上英文查询词 'last year'。person/
  // type/年份三类 token 的高亮不受影响(它们的 v 就是原文词或年份串本身)——仅
  // 这三个快捷 time token 在 New-UI 里必然失去高亮,这是偏离 2(v 改 i18n 键)
  // 的必然连带后果,不是本任务要修的 bug(修它要引入中英双词表,超范围)。
  quick?: QuickKey | number
}

// \b 只在 ASCII 词字符/非词字符交界处成立,中文名两侧通常也是中文 ⇒ Vue2 版对
// 中文名恒不命中(§7e-5)。改成:先找子串位置,再检查两侧字符是否"词内延续"。
// 词字符定义为 [A-Za-z0-9_](与 \w 一致);CJK 不是词字符,所以中文名两侧
// 无论是中文还是标点都算边界 —— 语义上正是我们要的。
const WORDISH = /[A-Za-z0-9_]/

function hasWordBoundedMatch(haystack: string, needle: string): boolean {
  if (!needle) return false
  let from = 0
  for (;;) {
    const i = haystack.indexOf(needle, from)
    if (i < 0) return false
    const before = i > 0 ? haystack[i - 1] : ''
    const after = i + needle.length < haystack.length ? haystack[i + needle.length] : ''
    // beforeOk/afterOk 的第三个条件——needle 首/尾字符本身不是词字符时(如中文名),
    // 边界恒成立——这正是修复的要点:中文名两侧只要不是"英文/数字/下划线接着英文/
    // 数字/下划线"这种真正的词内延续,就该算命中。
    const beforeOk = !before || !WORDISH.test(before) || !WORDISH.test(needle[0])
    const afterOk = !after || !WORDISH.test(after) || !WORDISH.test(needle[needle.length - 1])
    if (beforeOk && afterOk) return true
    from = i + 1
  }
}

export function understood(query: string, people: PersonOption[]): UnderstoodToken[] {
  // fix round 1 · M4:Vue2 :475 是 `(this.query || '').toLowerCase()`——同一批的
  // queryParts/searchStateMatchesQuery 都照搬了这道守卫,这里之前漏了,补上
  // (下游真实调用点很可能是 route.query.q,类型上就含 undefined)。
  const q = (query || '').toLowerCase()
  if (!q.trim()) return []
  const tokens: UnderstoodToken[] = []

  // person: 依次按调用方给定的顺序匹配真实命名人物。
  for (const p of people) {
    const name = p.name.toLowerCase()
    if (hasWordBoundedMatch(q, name)) {
      tokens.push({ k: 'person', v: p.name, id: p.id })
    }
  }

  // media type —— v 是内部枚举值(供 filters.type 比较),不是显示文案;
  // 显示时由消费方再 t()。这两个正则匹配的是英文单词,保留 \b 是对的。
  // 中文查询「视频」不会命中——这是 Vue2 的既有行为,照搬 + 登记为已知局限
  // (修它要引入中英双词表,超出本任务范围)。
  if (/\bvideos?\b/.test(q)) tokens.push({ k: 'type', v: 'Videos' })
  else if (/\bphotos?\b/.test(q)) tokens.push({ k: 'type', v: 'Photos' })

  // time —— 判据顺序照搬(else if 链,先匹配到的胜出)。v 给显示用:五个快捷键
  // 取对应的 i18n 键名(消费方 t(v)),年份的 v 就是年份串本身。
  if (/last week/.test(q)) {
    tokens.push({ k: 'time', v: QUICK_LABEL_KEYS.last7, quick: 'last7' })
  } else if (/last month/.test(q)) {
    tokens.push({ k: 'time', v: QUICK_LABEL_KEYS.last30, quick: 'last30' })
  } else if (/last year/.test(q)) {
    tokens.push({ k: 'time', v: QUICK_LABEL_KEYS.lastYear, quick: 'lastYear' })
  } else if (/this year/.test(q)) {
    tokens.push({ k: 'time', v: QUICK_LABEL_KEYS.thisYear, quick: 'thisYear' })
  } else if (/\btoday\b/.test(q)) {
    tokens.push({ k: 'time', v: QUICK_LABEL_KEYS.today, quick: 'today' })
  } else {
    const yr = q.match(/\b20[12][0-9]\b/)
    if (yr) tokens.push({ k: 'time', v: yr[0], quick: Number(yr[0]) })
  }

  return tokens
}
