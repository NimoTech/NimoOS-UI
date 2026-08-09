### Task 3: 共享包补 `uploadImage` / `setImageFromPath`

**Files:**
- Modify: `packages/service/src/users.ts`(加 2 个方法;改写文件末尾那条「不进包」注释)
- Test: `packages/service/src/users.test.ts`(追加 describe 块)

**Interfaces:**
- Consumes: 无
- Produces:
  ```ts
  interface UserImageResult { path: string; file_name: string; online_path: string }
  service.users.uploadImage(key: string, file: File): Promise<UserImageResult>
  service.users.setImageFromPath(key: string, path: string): Promise<UserImageResult>
  ```

- [ ] **Step 1: 写失败测试** —— 追加到 `packages/service/src/users.test.ts` 末尾(照该文件既有的 axios mock 写法):

```ts
describe('user image (SP11 wallpaper)', () => {
  it('uploadImage posts multipart with the file under `file`', async () => {
    const calls: { url: string; body: unknown }[] = []
    const http = {
      post: async (url: string, body: unknown) => {
        calls.push({ url, body })
        return { data: { success: 200, message: 'ok', data: { path: '/d/1/wallpaper.jpg', file_name: 'wallpaper.jpg', online_path: '/v1/users/image?path=/d/1/wallpaper.jpg' } } }
      },
    }
    const users = createUsers(http as never)
    const file = new File([new Uint8Array([1, 2, 3])], 'a.jpg', { type: 'image/jpeg' })
    const res = await users.uploadImage('wallpaper', file)

    expect(calls[0].url).toBe('/users/current/image/wallpaper')
    expect(calls[0].body).toBeInstanceOf(FormData)
    expect((calls[0].body as FormData).get('file')).toBe(file)
    expect(res.online_path).toContain('/v1/users/image?path=')
  })

  it('setImageFromPath puts the nas path as json', async () => {
    const calls: { url: string; body: unknown }[] = []
    const http = {
      put: async (url: string, body: unknown) => {
        calls.push({ url, body })
        return { data: { success: 200, message: 'ok', data: { path: '/d/1/wallpaper.png', file_name: 'wallpaper.png', online_path: '/v1/users/image?path=/d/1/wallpaper.png' } } }
      },
    }
    const users = createUsers(http as never)
    await users.setImageFromPath('wallpaper', '/DATA/Gallery/a.png')

    expect(calls[0].url).toBe('/users/current/image/wallpaper')
    expect(calls[0].body).toEqual({ path: '/DATA/Gallery/a.png' })
  })

  it.each([
    [60001, 'File does not exist'],
    [10017, 'Not an image'],
    [10018, 'Image too large'],
  ])('setImageFromPath rejects on success=%i even though the status is 200', async (code, msg) => {
    // PutUserImage returns http.StatusOK for every failure (user.go:880-916), so a
    // caller reading res.data directly would treat "image too large" as success.
    const http = { put: async () => ({ data: { success: code, message: msg, data: null } }) }
    const users = createUsers(http as never)
    await expect(users.setImageFromPath('wallpaper', '/DATA/huge.jpg')).rejects.toThrow(msg)
  })
})
```

> 说明:三个错误码的**数值**照 `NimoOS-Common` 的 `common_err` 常量填。开工时用
> `grep -rn "FILE_DOES_NOT_EXIST\|NOT_IMAGE\|IMAGE_TOO_LARGE" ../NimoOS-Common/model/common_err/` 取真实值替换上面的占位数字;测试断言的是 `message`,数值只是让 `it.each` 三行有区分度,取错不影响断言成立,但**仍要填真值**。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run packages/service/src/users.test.ts`
Expected: FAIL —— `users.uploadImage is not a function`。

- [ ] **Step 3: 写实现** —— `packages/service/src/users.ts`,在 `revokeMemberFolder` 之后插入:

```ts
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
      const res = await http.post(`/users/current/image/${key}`, form)
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
```

在 `packages/service/src/types.ts` 加类型:

```ts
/** Result of POST/PUT /v1/users/current/image/{key}. */
export interface UserImageResult { path: string; file_name: string; online_path: string }
```

并在 `users.ts` 顶部的 type import 列表里加上 `UserImageResult`。

- [ ] **Step 4: 改写文件末尾那条过期注释** —— `packages/service/src/users.ts` 最后那段:

```ts
    // Kept out of the package: deleteAllUser() (DELETE /users -- the nuclear
    // button, zero call sites in Vue2's AccountPanel) and deleteUserImage()
    // (no consumer in either UI).
    // uploadImage / setImageFromPath used to sit on this list as "not part of the
    // account tab"; SP11's wallpaper picker is their consumer, so they moved in.
```

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm vitest run packages/service/src/users.test.ts && pnpm vue-tsc --noEmit`
Expected: PASS + exit 0。

- [ ] **Step 6: Commit**

```bash
git add packages/service/src/users.ts packages/service/src/users.test.ts packages/service/src/types.ts
git commit -o packages/service/src/users.ts packages/service/src/users.test.ts packages/service/src/types.ts -m "feat(service): add user image upload and set-from-path

Both endpoints overwrite one fixed filename per user, so the URL is stable and
callers need their own cache-busting stamp. The PUT reports every failure as
HTTP 200 with a non-200 success field, including its hard 10 MB cap, so both go
through unwrap rather than reading the body directly.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

