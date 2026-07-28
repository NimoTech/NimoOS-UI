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

// Task 14(SP7-P5 人物):404 判定,与 isConflict 同一套形状容忍策略。
// 唯一用途是「设为关键照片」——后端用 404 专门表达"这张照片里没有这个人的脸",
// 需要与其它失败区分成两句不同文案(照 Vue2 PhotosPersonDetail.vue:656-660)。
// 终审 Minor 14:原注释说"与 isConflict 保持同一风格"是**不实的** —— 两者刻意不同:
//   isConflict 用裸 /409/(无词边界),isNotFound 用 /\b404\b/(有词边界)。
// 有边界的这条更严:它不会把 4040 / 1404 / "x-404y" 这类含 404 的字串误判成 404。
// 方向对的是 isNotFound;isConflict 的宽松是既有行为,收紧它会改变 T5/T7/T8 三处已上线的
// 「相册重名」判定,超出本期范围 —— 记账留后续,这里只把注释改成如实描述,不动 isConflict。
// 形状容忍策略(不假设 e 一定带 response/message)两者一致,那部分确实同款。
export function isNotFound(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const response = (e as { response?: unknown }).response
  if (response && typeof response === 'object' && (response as { status?: unknown }).status === 404) {
    return true
  }
  const message = (e as { message?: unknown }).message
  return /\b404\b/.test(String(message ?? ''))
}
