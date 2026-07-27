// 抽自 T5 AlbumPickerDialog.vue(:110-120)与 T7 PhotosAlbums.vue 的逐字重复 409 判定——
// 相册"创建重名"这个语义在多处新建流程里都会遇到(T5 加入相册面板内联新建、T7 相册列表
// 新建、T8 详情页改名、T10 收藏存为相册),抽成共享 util 避免三处四处各自维护一份。
//
// 判断 409(重名):`e?.response?.status === 409` 或 message 含 409——对未知形状的异常安全,
// 不假设 e 一定带 response/message,避免二次抛错。message 兜底是 T5 修过的既有行为,原样保留
// (不是新加的宽松化)。
export function isConflict(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const response = (e as { response?: unknown }).response
  if (response && typeof response === 'object' && (response as { status?: unknown }).status === 409) {
    return true
  }
  const message = (e as { message?: unknown }).message
  return /409/.test(String(message ?? ''))
}
