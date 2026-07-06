// 刷新令牌彻底失败(会话已死)时:先清废 token 再跳登录。
// 必须先清:否则守卫见 /login 仍有 token → 跳 / → 首页 API 又 401 → 再跳登录,应用内无限互弹。
export function makeAuthFailHandler(clear: () => void, navigate: () => void) {
  return (): void => {
    clear()
    navigate()
  }
}
