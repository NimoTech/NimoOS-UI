import type { AxiosInstance } from 'axios'
import type {
  EventModel, LoginResult, MemberInfo, UserFolderPermission, UserImageResult, UserInfo, UserStatus,
} from './types.js'
import { unwrap } from './unwrap.js'

export function createUsers(http: AxiosInstance) {
  return {
    async getCustomStorage(key: string): Promise<unknown> {
      const res = await http.get(`/users/current/custom/${key}`)
      return unwrap<unknown>(res.data)
    },
    async setCustomStorage(key: string, data: unknown): Promise<unknown> {
      const res = await http.post(`/users/current/custom/${key}`, data)
      return unwrap<unknown>(res.data)
    },
    async getEvents(): Promise<EventModel[]> {
      const res = await http.get('/v2/users/events')
      const d = res.data
      return Array.isArray(d) ? (d as EventModel[]) : unwrap<EventModel[]>(d)
    },
    async login(username: string, password: string): Promise<LoginResult> {
      const res = await http.post('/users/login', { username, password })
      return unwrap<LoginResult>(res.data)
    },
    async register(username: string, password: string, key: string): Promise<unknown> {
      const res = await http.post('/users/register', { username, password, key })
      return unwrap<unknown>(res.data)
    },
    async getStatus(): Promise<UserStatus> {
      const res = await http.get('/users/status')
      return unwrap<UserStatus>(res.data)
    },

    // ── SP9-P4:account tab 的 users 域补全 ───────────────────────────────
    // 信封层数逐个写死,禁自动探测(P1 已证实同一前缀下层数按端点不同)。
    // 下面 3 个 GET 在 2026-08-01 真机 curl 实证:**全部是标准信封
    // {success,message,data}**。

    /** GET /v1/users/current —— 当前登录用户。标准信封,已实证。 */
    async getUserInfo(): Promise<UserInfo> {
      const res = await http.get('/users/current')
      return unwrap<UserInfo>(res.data)
    },

    /** GET /v1/users/members —— 全部非本人用户(admin only)。标准信封,已实证:
     *  本机返回 data:[]。非 admin 调用 → HTTP 400 + success:10011。
     *  ⚠️ 后端只隐藏调用者本人、**不隐藏其它管理员**(user.go:694-697)。 */
    async getMembers(): Promise<MemberInfo[]> {
      const res = await http.get('/users/members')
      const d = unwrap<MemberInfo[] | null>(res.data)
      return Array.isArray(d) ? d : []
    },

    /** GET /v1/users/members/{id}/folders —— 某成员的显式文件夹授权(admin only)。
     *  标准信封,已实证。⚠️ 不存在的 id 也返回 200 + [](后端无存在性守卫);
     *  id 非数字 → HTTP 400 + success:4000。 */
    async getMemberFolders(memberId: number | string): Promise<UserFolderPermission[]> {
      const res = await http.get(`/users/members/${memberId}/folders`)
      const d = unwrap<UserFolderPermission[] | null>(res.data)
      return Array.isArray(d) ? d : []
    },

    /** PUT /v1/users/current —— 改用户资料。
     *  ⚠️ **未经 curl 实证**(写端点,SP9-P4 一律不发)。类型依据 Go struct
     *  UserDBModel(service/model/o_user.go:15-25)+ handler user.go:338-371:
     *  空字段会被后端用当前值补齐,username 撞已有用户 → HTTP 400 + success:10002。
     *  ⚠️ **无消费方** —— Vue2 那个入口(AccountPanel state 2「更改用户名」)全仓零调用,
     *  是死代码。按 spec §5.7 只做域补全。 */
    async setUserInfo(data: Partial<UserInfo>): Promise<UserInfo> {
      const res = await http.put('/users/current', data)
      return unwrap<UserInfo>(res.data)
    },

    /** PUT /v1/users/current/password —— 改当前用户密码。
     *  ⚠️ **未经 curl 实证,且开发机上一次都没发过**:后端 user.go:403 会
     *  osuser.SetOSUserPassword → /usr/sbin/chpasswd **写 /etc/shadow**,而 SSH 与
     *  Web 登录都读 /etc/shadow —— 这就是机主的登录凭据,改错不可撤销
     *  (还会异步同步 Samba 密码,user.go:409-413)。调用方必须确认是用户主动操作。
     *  旧密码错 → HTTP 400 + success:10014;后端设置失败 → HTTP 500。 */
    async changePassword(oldPassword: string, password: string): Promise<void> {
      await http.put('/users/current/password', { old_password: oldPassword, password })
    },

    /** PUT /v1/users/avatar —— 上传头像。body 是 { file: "<dataURL>" }。
     *  ⚠️ **未经 curl 实证**。后端 user.go:261 只 strip `data:image/png;base64,` 这一种前缀
     *  → **必须传 PNG dataURL**(canvas.toDataURL() 无参默认就是)。
     *  ⚠️ 后端 user.go:270 是 `log.Fatal(err)`(std log)—— 图片解码失败会 os.Exit(1)
     *  打死 UserService,内存密钥对重生 → **全集群 JWT 立即失效、所有人需重新登录**
     *  (systemd Restart=always/100ms,服务本身会自动拉起)。不要拿非 PNG 试探。 */
    async saveAvatar(dataUrl: string): Promise<void> {
      await http.put('/users/avatar', { file: dataUrl })
    },

    /** GET /v1/users/avatar 的 URL(给 <img src> 用,不是请求方法)。
     *  ⚠️ `<img>` 挂不了 Authorization 头,所以 token 走 query string ——
     *  NimoOS-Common/utils/jwt/jwt_helper.go:51-57 的 TokenLookupFuncs 明确
     *  「Authorization 头优先,否则取 c.QueryParam("token")」,2026-08-01 实测
     *  ?token=fake → 401,证明这条腿是活的。
     *  `v` 是缓存击穿版本号(后端已 no-store,但浏览器对 <img> 仍会复用)。
     *  ⚠️ 本机实测该端点 **404** —— DB avatar 为空串且两个兜底 svg 都不存在,
     *  消费方必须有 @error 兜底。 */
    avatarPath(version: number, token: string | null): string {
      const t = token ? `token=${encodeURIComponent(token)}&` : ''
      return `/v1/users/avatar?${t}v=${version}`
    },

    /** POST /v1/users/members —— 建子用户(admin only)。
     *  ⚠️ **未经 curl 实证**。后端 user.go:845-870 会真 useradd(shell /bin/false,
     *  无 SSH/终端)+ chpasswd 写 /etc/shadow + setfacl 封系统盘 + 建数据目录。
     *  只能靠 deleteUser 撤,而那个会 userdel + os.RemoveAll 数据目录。
     *  密码 < 6 位 → HTTP 400 + success:10013;用户名已存在 → success:10002。 */
    async createMember(username: string, password: string): Promise<MemberInfo> {
      const res = await http.post('/users/members', { username, password })
      return unwrap<MemberInfo>(res.data)
    },

    /** DELETE /v1/users/{id} —— 删用户(admin only)。
     *  ⚠️ **未经 curl 实证,不可撤销**:后端 user.go:656-672 撤全部 setfacl → 删权限表
     *  → 删 DB 行 → userdel → **os.RemoveAll(该用户数据目录)**。
     *  后端有守卫:id=="1" 或 id==调用者自己 → HTTP 400 + success:4000。 */
    async deleteUser(id: number | string): Promise<void> {
      await http.delete(`/users/${id}`)
    },

    /** POST /v1/users/members/{id}/folders —— 给成员授权一个文件夹(admin only)。
     *  ⚠️ **未经 curl 实证**。后端 user.go:766-774:写 user_folder_permissions 表
     *  (**upsert** —— 同 user+path 只更新 permission,不会重复插)+ 真 setfacl 改该目录 ACL。
     *  ⚠️ **NimoOS core 启动时只读打开这张表做文件区权限判定**,授错会影响文件可见性。
     *  permission 非 'read'/'write' 会被后端静默回落成 'read';path 会过 filepath.Clean。 */
    async grantMemberFolder(
      memberId: number | string,
      path: string,
      permission: 'read' | 'write' = 'read',
    ): Promise<UserFolderPermission> {
      const res = await http.post(`/users/members/${memberId}/folders`, { path, permission })
      return unwrap<UserFolderPermission>(res.data)
    },

    /** DELETE /v1/users/members/{id}/folders?perm_id={permId} —— 撤销授权(admin only)。
     *  ⚠️ **未经 curl 实证**。perm_id 走 **query string**(后端 user.go:791 读 QueryParam,
     *  不是 body)。缺 perm_id / 非数字 → HTTP 400。删表行 + setfacl -x;
     *  可以用 grantMemberFolder 重建,但新行的 id 会变。 */
    async revokeMemberFolder(memberId: number | string, permId: number | string): Promise<void> {
      await http.delete(`/users/members/${memberId}/folders?perm_id=${permId}`)
    },

    // ── SP11 wallpaper: user image endpoints ────────────────────────────────
    // These two were explicitly kept out of the package during SP9-P4 ("not part
    // of the account tab"); SP11 is the consumer that pays that debt off.

    /** POST /v1/users/current/image/{key} -- multipart upload.
     *  Standard envelope. Writes to {UserDataPath}/{userId}/{key}{ext}, so it
     *  ALWAYS overwrites one fixed filename per user: the URL never changes and
     *  callers must add their own cache-busting stamp.
     *  WARNING the backend enforces NO size limit here (user.go:928-961 has no
     *  size check, unlike the PUT below) -- callers must cap it themselves. */
    async uploadImage(key: string, file: File): Promise<UserImageResult> {
      const form = new FormData()
      form.append('file', file)
      // The shared axios instance defaults to application/json (http.ts). Without
      // this override, axios's transformRequest sees a JSON content-type already
      // set and flattens the FormData to `{}` instead of sending multipart --
      // matches every other multipart caller in this package (ai.ts, photos.ts, sys.ts).
      const res = await http.post(`/users/current/image/${key}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return unwrap<UserImageResult>(res.data)
    },

    /** PUT /v1/users/current/image/{key} -- copy an existing on-disk file into
     *  the user's image slot. body is { path }.
     *  Same fixed-filename overwrite as uploadImage.
     *  WARNING every failure returns HTTP 200 with success != 200
     *  (user.go:888/891/896/905): FILE_DOES_NOT_EXIST, NOT_IMAGE and
     *  IMAGE_TOO_LARGE (hard 10 MB cap at user.go:904). unwrap turns those into
     *  thrown errors -- never read res.data directly here. */
    async setImageFromPath(key: string, path: string): Promise<UserImageResult> {
      const res = await http.put(`/users/current/image/${key}`, { path })
      return unwrap<UserImageResult>(res.data)
    },

    // Kept out of the package: deleteAllUser() (DELETE /users -- the nuclear
    // button, zero call sites in Vue2's AccountPanel) and deleteUserImage()
    // (no consumer in either UI).
    // uploadImage / setImageFromPath used to sit on this list as "not part of the
    // account tab"; SP11's wallpaper picker is their consumer, so they moved in.
  }
}
