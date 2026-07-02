// 单一文件扩展名提取,逐字对齐 Vue2 mixins/mixin.js getFileExt:
//   name.substring(name.lastIndexOf('.') + 1) —— 无点名返回整名(Dockerfile→dockerfile),
//   dotfile 返回点后段(.gitignore→gitignore)。全库唯一实现,勿再复制。
export function fileExt(name: string): string {
  return name.slice(name.lastIndexOf('.') + 1).toLowerCase()
}
