/* account tab 的两个纯函数。移植源 Vue2 NimoOS-UI/src/components/account/AccountPanel.vue。 */

/** 成员行/授权行的时间格式化。1:1 对位 Vue2 formatDate(:538-543):
 *  本地时区、`YYYY-MM-DD HH:mm:ss`、各段补零。
 *  ⚠️ **不用仓内 files/util/format.ts 的 dateFmt** —— 那个是 Intl 相对格式
 *  (「7月3日 04:05」),与 Vue2 这里的绝对格式不同,界面 1:1 要求用这一份。
 *  🔧 plan C1 改正:Vue2 对无法解析的串会渲染 `NaN-NaN-NaN NaN:NaN:NaN`,这里回退空串。 */
export function formatMemberDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export type NewMemberError = 'empty' | 'tooShort' | 'mismatch' | null

/** 新建成员表单校验。1:1 对位 Vue2 submitAddMember(:493-506) 的三道判断与**顺序**。
 *  🔧 plan C15:Vue2 顶部还 extend('minPassword') 注册了同样的 6 位规则,但**没有任何
 *  ValidationProvider 用它** → 死代码,不移植;只留这里实际生效的 `< 6`。
 *  后端同样卡 6 位(user.go:837-839,success:10013),前端这道只是省一次往返。 */
export function validateNewMember(username: string, password: string, confirmation: string): NewMemberError {
  if (!username || !password) return 'empty'
  if (password.length < 6) return 'tooShort'
  if (password !== confirmation) return 'mismatch'
  return null
}
