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

    // ── SP9-P4: users domain completion for the account tab ───────────────────────────────
    // Envelope depth is hardcoded per endpoint; auto-detection is forbidden (P1 proved depth varies per endpoint under the same prefix).
    // The 3 GETs below were verified via curl on a real device 2026-08-01: **all use the standard envelope
    // {success,message,data}**.

    /** GET /v1/users/current — the currently logged-in user. Standard envelope, verified. */
    async getUserInfo(): Promise<UserInfo> {
      const res = await http.get('/users/current')
      return unwrap<UserInfo>(res.data)
    },

    /** GET /v1/users/members — all users except the caller (admin only). Standard envelope, verified:
     *  this machine returns data:[]. Non-admin call → HTTP 400 + success:10011.
     *  ⚠️ The backend hides only the caller themselves and does **not hide other admins** (user.go:694-697). */
    async getMembers(): Promise<MemberInfo[]> {
      const res = await http.get('/users/members')
      const d = unwrap<MemberInfo[] | null>(res.data)
      return Array.isArray(d) ? d : []
    },

    /** GET /v1/users/members/{id}/folders — a member's explicit folder grants (admin only).
     *  Standard envelope, verified. ⚠️ A nonexistent id also returns 200 + [] (backend has no existence guard);
     *  non-numeric id → HTTP 400 + success:4000. */
    async getMemberFolders(memberId: number | string): Promise<UserFolderPermission[]> {
      const res = await http.get(`/users/members/${memberId}/folders`)
      const d = unwrap<UserFolderPermission[] | null>(res.data)
      return Array.isArray(d) ? d : []
    },

    /** PUT /v1/users/current — update user profile.
     *  ⚠️ **Not verified via curl** (write endpoint; SP9-P4 sends none of those). Types are based on the Go struct
     *  UserDBModel (service/model/o_user.go:15-25) + handler user.go:338-371:
     *  empty fields are backfilled by the backend with current values; username colliding with an existing user → HTTP 400 + success:10002.
     *  ⚠️ **No consumers** — the Vue2 entry point (AccountPanel state 2 "change username") has zero calls repo-wide,
     *  it is dead code. Included only for domain completeness per spec §5.7. */
    async setUserInfo(data: Partial<UserInfo>): Promise<UserInfo> {
      const res = await http.put('/users/current', data)
      return unwrap<UserInfo>(res.data)
    },

    /** PUT /v1/users/current/password — change the current user's password.
     *  ⚠️ **Not verified via curl, and never once sent on the dev machine**: backend user.go:403 runs
     *  osuser.SetOSUserPassword → /usr/sbin/chpasswd which **writes /etc/shadow**, and both SSH and
     *  web login read /etc/shadow — this is the owner's login credential; a wrong change is irreversible
     *  (it also syncs the Samba password asynchronously, user.go:409-413). Callers must confirm the user initiated this.
     *  Wrong old password → HTTP 400 + success:10014; backend set failure → HTTP 500. */
    async changePassword(oldPassword: string, password: string): Promise<void> {
      await http.put('/users/current/password', { old_password: oldPassword, password })
    },

    /** PUT /v1/users/avatar — upload avatar. Body is { file: "<dataURL>" }.
     *  ⚠️ **Not verified via curl**. Backend user.go:261 strips only the `data:image/png;base64,` prefix
     *  → **a PNG dataURL is mandatory** (canvas.toDataURL() with no args is one by default).
     *  ⚠️ Backend user.go:270 is `log.Fatal(err)` (std log) — an image decode failure does os.Exit(1),
     *  killing UserService; the in-memory keypair regenerates → **all cluster JWTs invalidate immediately, everyone must re-login**
     *  (systemd Restart=always/100ms, the service itself restarts automatically). Do not probe with non-PNG data. */
    async saveAvatar(dataUrl: string): Promise<void> {
      await http.put('/users/avatar', { file: dataUrl })
    },

    /** URL of GET /v1/users/avatar (for <img src>, not a request method).
     *  ⚠️ `<img>` cannot carry an Authorization header, so the token goes in the query string —
     *  TokenLookupFuncs in NimoOS-Common/utils/jwt/jwt_helper.go:51-57 explicitly does
     *  "Authorization header first, otherwise c.QueryParam(\"token\")"; measured 2026-08-01,
     *  ?token=fake → 401, proving this leg is live.
     *  `v` is a cache-busting version number (backend already sends no-store, but browsers still reuse <img>).
     *  ⚠️ Measured on this machine the endpoint returns **404** — DB avatar is an empty string and neither fallback svg exists,
     *  so consumers must have an @error fallback. */
    avatarPath(version: number, token: string | null): string {
      const t = token ? `token=${encodeURIComponent(token)}&` : ''
      return `/v1/users/avatar?${t}v=${version}`
    },

    /** POST /v1/users/members — create a sub-user (admin only).
     *  ⚠️ **Not verified via curl**. Backend user.go:845-870 really runs useradd (shell /bin/false,
     *  no SSH/terminal) + chpasswd writing /etc/shadow + setfacl sealing the system disk + creating the data directory.
     *  Only reversible via deleteUser, which does userdel + os.RemoveAll of the data directory.
     *  Password < 6 chars → HTTP 400 + success:10013; username already exists → success:10002. */
    async createMember(username: string, password: string): Promise<MemberInfo> {
      const res = await http.post('/users/members', { username, password })
      return unwrap<MemberInfo>(res.data)
    },

    /** DELETE /v1/users/{id} — delete a user (admin only).
     *  ⚠️ **Not verified via curl, irreversible**: backend user.go:656-672 revokes all setfacl → deletes permission table rows
     *  → deletes the DB row → userdel → **os.RemoveAll(the user's data directory)**.
     *  Backend guard: id=="1" or id==the caller themselves → HTTP 400 + success:4000. */
    async deleteUser(id: number | string): Promise<void> {
      await http.delete(`/users/${id}`)
    },

    /** POST /v1/users/members/{id}/folders — grant a member one folder (admin only).
     *  ⚠️ **Not verified via curl**. Backend user.go:766-774: writes the user_folder_permissions table
     *  (**upsert** — same user+path only updates permission, never inserts duplicates) + really runs setfacl on that directory's ACL.
     *  ⚠️ **NimoOS core opens this table read-only at startup for file-area permission checks**; a wrong grant affects file visibility.
     *  permission other than 'read'/'write' is silently downgraded to 'read' by the backend; path goes through filepath.Clean. */
    async grantMemberFolder(
      memberId: number | string,
      path: string,
      permission: 'read' | 'write' = 'read',
    ): Promise<UserFolderPermission> {
      const res = await http.post(`/users/members/${memberId}/folders`, { path, permission })
      return unwrap<UserFolderPermission>(res.data)
    },

    /** DELETE /v1/users/members/{id}/folders?perm_id={permId} — revoke a grant (admin only).
     *  ⚠️ **Not verified via curl**. perm_id goes in the **query string** (backend user.go:791 reads QueryParam,
     *  not the body). Missing / non-numeric perm_id → HTTP 400. Deletes the table row + setfacl -x;
     *  can be recreated with grantMemberFolder, but the new row's id will differ. */
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
