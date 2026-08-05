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
  return /\b409\b/.test(String(message ?? ''))
}

// Task 14(SP7-P5 人物):404 判定,与 isConflict 同一套形状容忍策略。
// 唯一用途是「设为关键照片」——后端用 404 专门表达"这张照片里没有这个人的脸",
// 需要与其它失败区分成两句不同文案(照 Vue2 PhotosPersonDetail.vue:656-660)。
// P8a-T10:isConflict 已加词边界(`/\b409\b/`),与本函数的 `/\b404\b/` 对齐——两者都不会把
// 4090/1409/4040/1404 这类含 409/404 的字串误判成冲突/未找到。回源实测 isConflict 的 live
// 调用点有 5 处(AlbumPickerDialog.vue:143、PhotosFavorites.vue:114、PhotosAlbumDetail.vue:204、
// PhotosPersonDetail.vue:484、PhotosAlbums.vue:145),均为「message 兜底」分支的收紧,不影响
// `response.status === 409` 主判定路径。形状容忍策略(不假设 e 一定带 response/message)两者
// 一致,那部分确实同款。
export function isNotFound(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const response = (e as { response?: unknown }).response
  if (response && typeof response === 'object' && (response as { status?: unknown }).status === 404) {
    return true
  }
  const message = (e as { message?: unknown }).message
  return /\b404\b/.test(String(message ?? ''))
}
