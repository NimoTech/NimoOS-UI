// SP8-P3a Task 2 —— 纯函数,**不 import `vue-i18n`**(与 `channelsFormat.ts`/
// `mcpConnect.ts` 同一分工:抽成纯函数好脱离 vue-i18n 单测,文案由调用方 t() 出来)。
//
// 三个函数对齐的后端产出坐标,均在 `NimoOS-AI/service/skills.go`:
//   - `triggerLabel` 对齐 `manifestToSkill` 的 trigger→trigger_human 映射
//     (skills.go:191-199,`"auto"→"Automatic"` / `"slash"→"/"+name` / `"manual"→"Manual"`)。
//   - `authorLabel` 对齐 `manifestToSkill` 的 author 兜底(skills.go:184-190,
//     用户技能未显式指定作者时后端填字面量 `"You"`)。
//   - `fileSizeLabel` 对齐 `humanSize`/`listBundleFiles`(skills.go:138-148,
//     文件夹在文件列表里显示为 `"(N files)"`,内部子项个数而非字节数)。
//
// **界面永不回显后端原文** —— 与 `channelsFormat.addBotErrorKey` 同一先例:后端吐出的
// 英文字面量只作为「键」去匹配,匹配到的一律返回本地化 i18n 键交给调用方 t()、
// 认不出的返回 `null` 交给调用方原样显示原串(后端仍然可能吐出 UI 认不出的新
// trigger/author 值,这时 null 让调用方兜底展示原文,而不是抛错或吞掉)。

export interface LabelRef {
  key: string
  params?: Record<string, unknown>
}

/** 对齐 Vue2 `trigger_human` 的语义,但输入是原始 `trigger` 枚举 + skill `name`
 *  (公共约束 §3 偏离 4:本仓弃用后端算好的 `trigger_human` 字符串,自己按枚举映射)。
 *  `'manual'` 复用 `aiSkTagManual`(左栏「手动」短标签)—— Vue2 里 slash/manual 只有
 *  一种「手动」文案,不新建重复键。未知 trigger 回 `null`,调用方原样显示原串。 */
export function triggerLabel(trigger: string, name: string): LabelRef | null {
  switch (trigger) {
    case 'auto':
      return { key: 'aiSkTriggerAutomatic' }
    case 'slash':
      return { key: 'aiSkTriggerSlash', params: { name } }
    case 'manual':
      return { key: 'aiSkTagManual' }
    default:
      return null
  }
}

/** 后端把「用户新建技能且未显式指定作者」的默认值硬编码成字面量 `"You"`
 *  (skills.go:188)。只有这一个值需要本地化 —— 其它值是真实人名/系统作者数据,
 *  原样显示,回 `null`。 */
export function authorLabel(author: string): LabelRef | null {
  if (author === 'You') return { key: 'aiSkAuthorYou' }
  return null
}

/** 后端文件夹条目的 size 字段是 `"(N files)"` / `"(1 file)"` 这种整串(skills.go:175
 *  `"(" + itoaSkill(len(subs)) + " files)"`,单复数由后端拼接,该拼接从不产出单数
 *  形式的 "file" 但正则容错兼容)。**普通文件的 `"12 B"` / `"1.0 KB"` / `"1.0 MB"`
 *  这类字节单位原样透传**,回 `null`。 */
export function fileSizeLabel(size: string): LabelRef | null {
  const m = /^\((\d+) files?\)$/.exec(size)
  if (!m) return null
  return { key: 'aiSkNFiles', params: { n: Number(m[1]) } }
}
