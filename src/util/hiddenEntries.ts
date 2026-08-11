// Files 区与主页添加面板的文件夹选择器共用的"隐藏条目"规则:点开头的条目
// (.system_data 等系统目录)与 lost+found 一律不展示。抽成单一谓词是为了
// 两处永远同一套逻辑 —— 曾经选择器漏掉这条规则,系统目录能被拖上桌面。
const HIDDEN = new Set(['lost+found'])

export function isHiddenEntry(name: string): boolean {
  return name.startsWith('.') || HIDDEN.has(name)
}
