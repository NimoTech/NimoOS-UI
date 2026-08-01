# SP9-P4 设置 account + folder-permissions 界面骨架 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Vue2 系统设置的 account tab(`components/account/AccountPanel.vue`,1276 行)1:1 迁进 New-UI 路由页,并按 spec §3.1 政策三把 folder-permissions 的界面骨架做出来(数据源留空、写操作禁用),同时给共享包 `@nimotech/nimoos-service` 的 `users` 域补全 10 个方法。

**Architecture:** account 保持 Vue2 的**面板内状态机**形态(`state` 1/3/4/5/6 切换正文 + 底部 Back/Submit 页脚),不改成一堆弹窗 —— Vue2 在设置区是 `isInline=true`,头部标题被隐藏、页脚保留,New-UI 的 `SettingsSection` 正文区正好对位模态正文区。folder-permissions 是**四个分区的列表**(不是矩阵,见下方硬约束 C3),纯逻辑引擎与视图派生全部移植为纯函数并写单测,`fetchSnapshot` / `execute` 两个函数留明确标注的空实现,合并 sp7/sp8 后只换这两个函数即可接线(债务 D11)。

**Tech Stack:** Vue 3 `<script setup>` + TypeScript strict · vitest + @vue/test-utils · vue-i18n(分片 `*.sp9.ts`)· reka-ui(`ui/Dialog.vue` / `ui/AlertDialog.vue`)· 共享包 `@nimotech/nimoos-service`(`users` / `storage` / `raid` / `folder` / `image` 域)· **本期新增运行时依赖 `vue-advanced-cropper@^2.8.9`**(用户 2026-08-01 拍板,peer `vue: ^3.0.0`)。

---

## Global Constraints

以下每条都是本期硬约束,**每个任务的要求隐含包含本节全部内容**。

### A. 工作树与提交纪律(违反会丢别人的工作)

- **A1** New-UI 与 NimoOS-Service 都在**主工作树 master** 上做,不开 worktree。基线:New-UI `9fc7cb8` · Service `389b7db`。
- **A2** ⛔ 这两个工作树上**永远不要** `git checkout` / `git stash` / `git reset` / `git add -A` / `git add .`。索引外躺着 3 个 `design-export/*` 的**未暂存删除**(P3 期间被某实现者 `git reset` 从已暂存退成未暂存,未进任何 commit)。
- **A3** ⛔ `git commit` **那一行也必须带 pathspec**,例:`git commit -m "..." -- src/settings/panels/AccountPanel.vue src/i18n/zh_cn.sp9.ts`。只 `git add` 对的文件**不算安全**。提交后自查:`git log --name-only -1 | grep -c design-export` 必须是 `0`。
- **A4** 不碰 `.sp7/` `.sp8/`(相册和 AI 两条线在并行)。不碰 `src/photos/**`、`src/ai/**`。

### B. 测试与任务门

- **B1** 任务门 = 全量 `pnpm test` + `pnpm exec vue-tsc --noEmit` + `pnpm build`,三门全绿。基线数字:**New-UI 308 文件 / 2427 例**、**Service 25 文件 / 172 例**(2026-08-01 实测复核过)。
- **B2** 测试数对不上先想 `src/color-guard.test.ts` —— 它**按文件动态生成用例**(一个 `.vue`/`.css` 一条),新增 4 个 `.vue` 就凭空多 4 条。
- **B3** **每条用例都要问「把它覆盖的那行改坏会不会翻红」**。不确定就真做一次变异验证(改坏 → 跑 → 确认红 → 改回)。P3 有四次「用例空转」被评审逮到,共同点是排序/兜底/jsdom 特性掩盖了缺陷。
- **B4** 弹窗测试必须 `attachTo: document.body` 并查 `document`(`ui/Dialog.vue` / `ui/AlertDialog.vue` 经 reka `DialogPortal` teleport)。确认按钮的真实类名是 **`.ui-btn.danger`**(`.ui-dialog-confirm` 全仓不存在)。
- **B5** **面板级 toast 断言读 `useToast().msg`**,不要查组件子树 DOM(`AppToast` 是应用级渲染的)。
- **B6** `@vue/test-utils` **不给 `disabled` 元素派发事件** —— 要断 `disabled` 属性,别 `trigger('click')` 然后断「没发生」。
- **B7** 测试里读 `.css` 源码**一律用 `node:fs`**(`?raw` 对 `.css` 恒返回空串,vitest 默认 `css:false`)。
- **B8** fixture **一律从真机逐字抓取,不得手编**。本期已抓好的见 §Fixtures,直接引用。

### C. 移植纪律(roadmap 2026-07-27 拍板)

- **C1** 界面严格 1:1;**Vue2 的 bug / 竞态 / 吞错不照抄** —— 改成正确逻辑并**在代码里写注释登记**。禁无关重构。
- **C2** 中文文案**以 Vue2 为准,不要自己译**。本期已用脚本从 `NimoOS-UI/src/assets/lang/zh_CN.json` 逐字取好,见 §i18n 全表 —— **直接抄那张表,不要自己再译一遍,标点也不许改**(P3 把全角逗号/感叹号写成半角,评审做字节级比对才逮到)。
- **C3** ⚠️ **spec §5.7 把 folder-permissions 写成「权限矩阵(表头、行、各子系统列的开关)」,与 Vue2 源码不符** —— `FolderPermissions.vue` 实际是**四个纵向堆叠的分区**(文件名索引 / 知识库 / 禁止 AI 访问的文件夹 / 照片),各自一份列表,**没有矩阵表头、没有列**。按 P0 先例(「spec 与源码出入,以源码为准,界面严格 1:1」)**照源码做四分区**,并在台账登记该出入。
- **C4** 颜色**只能**用 theme token。新语义 token 加进 `src/styles/theme.sp9.css` 且 `:root` 与 `:root[data-theme="light"]` **两套块都给值**。**`--danger` / `--fg-dim` 在本仓不存在**,实际是 `--remove-fg` / `--fg-muted`。
- **C5** i18n 新 key 必须**同时**加 `src/i18n/zh_cn.sp9.ts` 与 `src/i18n/en_us.sp9.ts`,否则 `parity.test.ts` 立红。
- **C6** **弹窗内的报错不要用 toast**(`AppToast` 是 `z-index:60`,`ui/Dialog` 遮罩是 `z-index:1000` 且带 `backdrop-filter`,提示会被压住并糊掉)→ 用弹窗/表单内联 `.set-danger`,**并优先显示后端 `message`**。**面板级**提示才用 toast。
- **C7** **弹窗/表单里的输入框**要包在 `.set-net-field` 之类容器里或自己覆盖宽度,否则吃到 `.set-input` 的 `width:92px`(P2 实测被截断成 `192.168.1.`)。
- **C8** 「onMounted 取数 → 赋给本地 ref」的组件要**就地**写过期守卫(`alive` 布尔或代际 `seq`),**不抽公共 helper**(评审判定过早抽象)。⚠️ **但别无差别套**:先问「这个组件真有第二个触发点吗」;没有就只写守卫 + 注释,**不留空转用例**,更不要为了凑交错测试给页面加 Vue2 没有的按钮(P3 真发生过,已撤回)。
- **C9** 日志/控制台类展示壳直接用 `src/components/ui/LogConsole.vue`,别再各写一份(本期用不到,列出免复发)。

### D. ⛔ 破坏面(开工前已逐个读 Go 源码 + curl 判定,**不得重新判断、不得试探**)

| 端点 | 处置 | 依据(已核过的 Go 源码) |
|---|---|---|
| `GET /v1/users/current` | ✅ 可随意 curl | 只读 |
| `GET /v1/users/members` | ✅ 可随意 curl | 只读;`GetAllMembers` 只查 DB + `os.ReadDir` |
| `GET /v1/users/members/:id/folders` | ✅ 可随意 curl | 只读 |
| `GET /v1/users/avatar` | ✅ 可随意 curl | 只读文件 |
| `PUT /v1/users/current/password` | ⛔ **一次都不发,连 curl 都不许试** | `route/v1/user.go:403` → `osuser.SetOSUserPassword` → `/usr/sbin/chpasswd` **写 `/etc/shadow`**;而登录校验也读 `/etc/shadow`(`osuser.go:276-283`)= **机主的 SSH 凭据**。不知道原密码就改不回去,**不可撤销**。另 `:409-413` 还异步同步 Samba 密码。 |
| `PUT /v1/users/avatar` | 🟠 代码照写、单测覆盖,**验收不点**、curl 不发 | `user.go:274-287` 写 `/var/lib/nimoos/1/avatar.png`(先 `os.Remove` 再 `os.Create`)。**且 `:270` 是 `log.Fatal(err)`,`log` 是 std 库 → 图片解码失败会 `os.Exit(1)` 打死 UserService** → 内存密钥对重生 → **全集群 JWT 立即失效**。已实测 `Restart=always` / `RestartUSec=100ms`,服务 100ms 自动拉起,所以后果**收敛为「全员需重新登录」**,不是长期不可用。 |
| `POST /v1/users/members` | 🟠 代码照写、单测覆盖,**验收不点** | `user.go:845-870` 真 `useradd`(shell `/bin/false`,无 SSH)+ `chpasswd` 写 `/etc/shadow` + `setfacl` 封系统盘 + 建 `/var/lib/nimoos/<id>/`。只能靠删成员撤。 |
| `DELETE /v1/users/:id` | ⛔ **不发** | `user.go:656-672` 撤全部 setfacl → 删权限表 → 删 DB 用户 → `osuser.DeleteOSUser`(userdel)→ **`os.RemoveAll(用户数据目录)`**,**不可撤销**。后端有 `id=="1" || id==callerID` 守卫。 |
| `POST /v1/users/members/:id/folders` | 🟠 代码照写、单测覆盖,**验收不点** | `user.go:766-774` 写 `user_folder_permissions` 表(**upsert**:同 user+path 只改 permission)+ `osuser.GrantFolderAccess` 真 `setfacl` 改 `/DATA` 目录 ACL。⚠️ **NimoOS core 启动时只读打开这个库做文件区权限判定**,改错影响文件可见性。 |
| `DELETE /v1/users/members/:id/folders?perm_id=` | 🟠 同上 | `user.go:806-816` 删表行 + `setfacl -x`。可用 grant 重建,但 perm id 会变。 |
| `PUT /v1/users/current` | ⛔ **不发**,且**界面不做**(Vue2 侧是死代码,见 C10) | `user.go:338-371` `UpdateUser` |
| `DELETE /v1/users`(`deleteAllUser`) | **不进包** | 核按钮;Vue2 `AccountPanel` 里零引用,按「界面里没有就不进包」处置 |

- **D1** 上表 🟠 的四条:**代码写完整、按钮可用、单测覆盖**(与 P2 network 保存、P3 迁移/prune 完全同样的处置),只是**验收清单第一屏写「不要点」**。这不是「做样子」——「做样子」只适用 folder-permissions(政策三)。
- **D2** **用户 2026-08-01 拍板:成员管理写操作全部不点、整块挂账。** 本机 `/v1/users/members` 返回 `[]`(零成员)→ 不创建成员的话,成员行、成员文件夹授权整块界面在真机上**结构性看不到**(同 P3 迁移弹窗单分区的性质,「验不了 ≠ 没验」)。

### E. 已识别的「Vue2 死代码 / bug,不照抄」清单

判据同 P1 的 D14/D15:**1:1 护的是用户看得见的界面**。

- **C10 · state 2「更改用户名」整块是死代码,不移植。** 全仓 grep `goto(2)` / `state = 2` **零命中**(`AccountPanel.vue` 自身与 `TopBar.vue:526`、`SettingsPanel.vue:61` 两个宿主都没有入口),`title` 的 `case 2` 与页脚那个 `state === 2` 的 Submit 按钮永远不渲染 → 连带 `saveUser()` / `setUserInfo` **在界面上没有落点**。**`setUserInfo` 仍按 spec §5.7 进包**(域补全),但**标注「无消费方、未经 curl 实证」**。
- **C11 · `getMimeType()`(`AccountPanel.vue:17-37`)是死代码,不移植。** 它算出的 `image.type` 存进 `this.image` 后**模板里零引用**,`saveAvatar` 上传的是 `canvas.toDataURL()`(恒 PNG)。→ 从 NAS 选图不必走 `arraybuffer → Blob → createObjectURL` 那一圈,**直接用 `image.imageUrl(path, 'original')` 当 `<img src>`**(同源,cropper 可用),少一层内存拷贝。
- **C12 · `avatarVersion` 之外还有个未清理的 `URL.revokeObjectURL` 漏洞**:Vue2 `loadImage` 里换图会 revoke 旧 blob,但 `selectNasImage` 成功后 revoke 的是**上一张**、失败时不 revoke;`destroyed` 只 revoke 一次。New-UI 侧改成:**只有本地文件上传才产生 objectURL,统一在切走 / 卸载时 revoke,并在赋新值前先 revoke 旧值**,注释登记。
- **C13 · `avatarUrl` 用的 token 取值是 `this.$store.state.token`,而全仓存的是 `access_token`** —— Vue2 第一段恒 `undefined`,靠 `|| localStorage.getItem('access_token')` 兜住。New-UI 直接读 `localStorage.getItem('access_token')`,注释登记。
- **C14 · `loadMembers()` / `loadMemberFolders()` 的 catch 把错误吞成空数组**,界面显示「暂无成员」而不是报错 —— 与同屏兄弟(`nasError` 那几处会显示错误)不一致。New-UI 改成**失败时显示错误行**(`.set-danger`),注释登记。理由同 P1 终审第 ② 条(3 处静默吞错)。
- **C15 · `submitAddMember` 的密码长度校验写死 `< 6`,而 `extend('minPassword')` 注册了同样的规则却从未被任何 `ValidationProvider` 使用** → 只移植 `< 6` 这条实际生效的,`minPassword` 那段不移植。

### F. 事实核对纪律

- **F1 禁自动探测信封层数,每个方法写死。** P1 已证实**同一前缀下信封层数按端点不同**(`/v1/gateway/port`、`/ssl` 有信封,`/components`、`/device-info` 是裸 JSON),P3 又证实 `/v1/sys/paths` 是标准信封。本期 4 个只读端点**已 curl 实证全部是标准信封 `{success,message,data}`**(见 §Fixtures)。
- **F2 写端点一律不发**,类型只照 Go struct 对,并在包里**注释标明「未经 curl 实证」**(P1 就是这么标 `migrate*` 的)。

---

## Fixtures(2026-08-01 逐字抓取,**不得手编**)

```bash
# 1) GET /v1/users/current —— 标准信封
$ curl -s http://127.0.0.1/v1/users/current
{"success":200,"message":"ok","data":{"id":1,"username":"nimoos","role":"admin","email":"","nickname":"","avatar":"","description":"","created_at":"0001-01-01T00:00:00Z","updated_at":"0001-01-01T00:00:00Z"}}

# 2) GET /v1/users/members —— 标准信封,本机零成员
$ curl -s http://127.0.0.1/v1/users/members
{"success":200,"message":"ok","data":[]}

# 3) GET /v1/users/members/1/folders —— 标准信封
$ curl -s http://127.0.0.1/v1/users/members/1/folders
{"success":200,"message":"ok","data":[]}

# 4) 不存在的 member id —— 仍然 HTTP 200 + 空数组(后端无存在性守卫)
$ curl -s -w " [%{http_code}]" http://127.0.0.1/v1/users/members/2/folders
{"success":200,"message":"ok","data":[]} [200]

# 5) :id 非数字 —— HTTP 400 + 信封里 success:4000
$ curl -s -w " [%{http_code}]" http://127.0.0.1/v1/users/members/abc/folders
{"success":4000,"message":"Parameters Error","data":null} [400]

# 6) GET /v1/users/avatar —— 本机 404(DB avatar:"" 且两个兜底 svg 都不存在)
$ curl -s -D - -o /dev/null http://127.0.0.1/v1/users/avatar
HTTP/1.1 404 Not Found
Content-Disposition: attachment; filename*=utf-8''avatar.svg
Content-Type: application/json
Cache-Control: no-cache, no-store, max-age=0, must-revalidate, value

# 7) ?token= 查询参数被 JWT 中间件认(NimoOS-Common/utils/jwt/jwt_helper.go:51-57
#    TokenLookupFuncs:Authorization 头优先,否则取 c.QueryParam("token"))
$ curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1/v1/users/avatar?token=fake"
401
```

**从 Fixture 直接推出的界面要求:**

- **`/v1/users/avatar` 在本机 404** → `<img>` 必须有 `@error` 兜底(Vue2 用 `b-image` 的 `src-fallback`)。New-UI 侧兜底 = `SettingsShell` 已有的**首字母圆形块**(`.set-user-avatar` 同款),不引入新图片资源。
- **成员列表恒空** → 空态 `settingsAccNoMembers`「暂无成员」是本机唯一可见形态;成员行、`folder_count`、`created_at` 格式化只有单测。
- **`GetAllMembers` 只隐藏调用者本人、不隐藏其它 admin**(`user.go:694-697` 注释明确)→ 「成员」列表里可能出现别的管理员,**不要自作聪明按 role 过滤**。

---

## Go 类型依据(写端点的类型只照这个对,F2)

```go
// NimoOS-UserService/service/model/o_user.go:15-25
type UserDBModel struct {
	Id          int       `json:"id"`
	Username    string    `json:"username"`
	Password    string    `json:"password,omitempty"`
	Role        string    `json:"role"`
	Email       string    `json:"email"`
	Nickname    string    `json:"nickname"`
	Avatar      string    `json:"avatar"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at,omitempty"`
	UpdatedAt   time.Time `json:"updated_at,omitempty"`
}

// NimoOS-UserService/service/model/o_user.go:33-40
type UserFolderPermission struct {
	Id         int       `json:"id"`
	UserId     int       `json:"user_id"`
	Path       string    `json:"path"`
	Permission string    `json:"permission"` // "read" | "write"
	CreatedAt  time.Time `json:"created_at"`
}

// NimoOS-UserService/route/v1/user.go:685-691(handler 内联匿名 struct)
type MemberInfo struct {
	Id          int       `json:"id"`
	Username    string    `json:"username"`
	Role        string    `json:"role"`
	FolderCount int       `json:"folder_count"`
	CreatedAt   time.Time `json:"created_at"`
}
```

---

## File Structure

### NimoOS-Service(共享包,本期唯一被碰的第二个仓)

| 文件 | 职责 |
|---|---|
| `src/types.ts`(改) | 新增 `MemberInfo` / `UserFolderPermission` / `FolderPermissionInput`;`UserInfo` 补命名字段(它有 `[k:string]:unknown`,加字段不破坏消费方) |
| `src/users.ts`(改) | 6 → 16 个方法。逐个写死信封层数,写端点标注「未经 curl 实证」 |
| `src/users.test.ts`(改) | 新增方法的 URL / body / 信封解析 / 守卫用例 |

### New-UI —— 纯逻辑 util(零 DOM,零后端)

| 文件 | 职责 |
|---|---|
| `src/settings/util/folderPermissions.ts` | 移植 `folderPermissions.js` 全部 8 个导出:`aiPatternFor` / `denyGlobFor` / `pathFromAiPattern` / `pathFromDenyGlob` / `isUnder` / `coveringEnabledRoot` / `planToggle` + 4 个 cell 内部函数 + `FolderPermSnapshot` 等类型 |
| `src/settings/util/folderPermissionsView.ts` | 移植 `folderPermissionsView.js` 全部 6 个导出:`coveredBy` / `searchItems` / `knowledgeRootItems` / `knowledgeExcludeItems` / `knowledgeKindOf` / `aiItems` / `photosItems` |
| `src/settings/util/folderPermissionsSnapshot.ts` | **本期的空实现落点(债务 D11)**:`emptySnapshot()` + `fetchSnapshot()`(不打任何接口)+ `execute()`(抛「未接线」)。合并 sp7/sp8 后**只换这个文件里的两个函数**,界面不动 |
| `src/settings/util/folderBrowser.ts` | 移植 `folderBrowser.js` 的 `dirEntries` / `pickerRoots` / `crumbsFor` |
| `src/settings/util/nasStorages.ts` | 从 `storage.list()` + `raid.list()` 响应派生头像 NAS 选图的存储卡列表(移植 `loadNasStorages` 里的纯派生部分)+ `nasBreadcrumbs` / `nasNavigateUpTarget` / `isPickableImage` |
| `src/settings/util/memberFormat.ts` | `formatMemberDate`(Vue2 `formatDate`,`YYYY-MM-DD HH:mm:ss`)+ `validateNewMember` 表单校验(C15) |
| `src/settings/util/avatar.ts` | `avatarUrl(version)` 构造(C13)+ `dataUrlToPngPayload` |

### New-UI —— account 组件

| 文件 | 职责 |
|---|---|
| `src/settings/panels/AccountPanel.vue`(改,现为空骨架) | 状态机宿主:`state` 1/3/4/5/6 + 页脚 Back/Submit + owner 卡 + 成员区 |
| `src/settings/panels/account/OwnerCard.vue` | state 1 上半:所有者账户卡(用户名 + 头像 + 改密/改头像/退出三按钮 + 头像来源菜单) |
| `src/settings/panels/account/MembersSection.vue` | state 1 下半:成员区(标题 + Add + 内联添加表单 + 成员行 + 空态/错误态 + 删除确认) |
| `src/settings/panels/account/ChangePasswordForm.vue` | state 3:原密码/新密码/确认 三输入 + 内联报错 |
| `src/settings/panels/account/AvatarCropper.vue` | state 4:`vue-advanced-cropper` 裁剪框 + 右侧圆形预览 |
| `src/settings/panels/account/NasImagePicker.vue` | state 6:存储卡网格 / 文件浏览两视图 + 面包屑 |
| `src/settings/panels/account/MemberFoldersView.vue` | state 5:某成员的文件夹授权列表 + 授权表单 + 撤销确认 |

### New-UI —— folder-permissions 组件

| 文件 | 职责 |
|---|---|
| `src/settings/panels/FolderPermissionsPanel.vue`(改,现为空骨架) | 顶部说明条 + 刷新按钮 + 四个分区(C3) |
| `src/settings/panels/folderPerm/FolderPickerDialog.vue` | 「添加文件夹 / 添加排除」弹窗(内含文件夹选择器 + 手输框),本期确认按钮恒 disabled |

### New-UI —— 样式与文案

| 文件 | 职责 |
|---|---|
| `src/settings/styles/settings.css`(改) | 追加 `.set-acc-*` / `.set-mem-*` / `.set-crop-*` / `.set-nas-*` / `.set-fp-*` |
| `src/styles/theme.sp9.css`(改) | 若需新语义 token,两套主题块都给值(C4) |
| `src/i18n/zh_cn.sp9.ts` / `src/i18n/en_us.sp9.ts`(改) | §i18n 全表的 ~58 个键 |

---
## i18n 全表(**直接抄,不许自己再译一遍,标点不许改** —— C2)

`✅ 照抄` = 该英文原文在 `NimoOS-UI/src/assets/lang/zh_CN.json` 里有中文,本表的中文是**脚本逐字节取出**的。
`🟡 新译` = 该英文原文在**全部 31 个语言文件里都没有译文**(2026-08-01 脚本核过),按 P2 授权偏离 #8 / P3 #10 先例补中文译。
`🆕` = Vue2 没有的本期新增文案(说明条 / 错误行)。

| key | Vue2 英文原文 | 中文 | 来源 |
|---|---|---|---|
| `settingsAccOwnerLabel` | `Local owner account` | `本机所有者账户` | 🟡 新译 |
| `settingsAccChangePassword` | `Change Password` | `更改密码` | ✅ 照抄 |
| `settingsAccChangeAvatar` | `Change Avatar` | `更改头像` | ✅ 照抄 |
| `settingsAccUploadFromDevice` | `Upload from device` | `从本机上传` | ✅ 照抄 |
| `settingsAccChooseFromNas` | `Choose from NAS` | `从NAS选择` | ✅ 照抄 |
| `settingsAccLogout` | `Logout` | `退出账户` | ✅ 照抄 |
| `settingsAccMembers` | `Members` | `成员` | 🟡 新译 |
| `settingsAccAdd` | `Add` | `添加` | ✅ 照抄 |
| `settingsAccUsername` | `Username` | `用户名` | ✅ 照抄 |
| `settingsAccPassword` | `Password` | `密码` | ✅ 照抄 |
| `settingsAccConfirmPassword` | `Confirm password` | `确认密码` | 🟡 新译 |
| `settingsAccFoldersUnit` | `folders` | `个文件夹` | 🟡 新译 |
| `settingsAccCreatedAt` | `Created at` | `创建于` | 🟡 新译 |
| `settingsAccNoMembers` | `No members yet` | `暂无成员` | 🟡 新译 |
| `settingsAccMembersLoadFailed` | —(本期新增) | `加载成员列表失败` | 🆕 |
| `settingsAccPickImageOnly` | `Please select an image file` | `请选择图片文件（JPG、PNG、GIF、WEBP、BMP）` | ✅ 照抄 |
| `settingsAccFillAllFields` | `Please fill in all fields` | `请填写所有字段` | 🟡 新译 |
| `settingsAccPwdMin6` | `Password must be at least 6 characters` | `密码至少需要 6 个字符` | 🟡 新译 |
| `settingsAccPwdMismatch` | `The password confirmation does not match` | `两次输入的密码不一致` | 🟡 新译 |
| `settingsAccMemberAdded` | `Member added successfully` | `成员添加成功` | 🟡 新译 |
| `settingsAccMemberAddFailed` | `Failed to add member` | `添加成员失败` | 🟡 新译 |
| `settingsAccDelete` | `Delete` | `删除` | ✅ 照抄 |
| `settingsAccDeleted` | `Deleted` | `已删除` | ✅ 照抄 |
| `settingsAccDeleteFailed` | `Delete failed` | `删除失败` | ✅ 照抄 |
| `settingsAccLoadFolderFailed` | `Failed to load folder` | `加载文件夹失败` | 🟡 新译 |
| `settingsAccLoadImageFailed` | `Failed to load image` | `加载图片失败` | ✅ 照抄 |
| `settingsAccNoImagesHere` | `No image files here` | `此处没有图片文件` | ✅ 照抄 |
| `settingsAccOriPassword` | `Original password` | `原密码` | ✅ 照抄 |
| `settingsAccNewPassword` | `New password` | `新密码` | ✅ 照抄 |
| `settingsAccConfirmNewPassword` | `Confirm the new password again` | `确认新密码` | ✅ 照抄 |
| `settingsAccBack` | `Back` | `返回` | ✅ 照抄 |
| `settingsAccSubmit` | `Submit` | `提交` | ✅ 照抄 |
| `settingsAccUpdateOk` | `Update successful` | `更新成功` | 🟡 新译 |
| `settingsAccUpdateFailed` | `Update failure` | `更新失败` | 🟡 新译 |
| `settingsAccPreview` | `Preview` | `预览` | 🟡 新译 |
| `settingsAccFoldersAccessiblePrefix` | `Folders accessible by` | `以下文件夹可被 ` | 🟡 新译 |
| `settingsAccSystemDiskBlocked` | `. System disk is blocked by default.` | ` 访问。系统盘默认不可访问。` | 🟡 新译 |
| `settingsAccFolderPath` | `Folder path` | `文件夹路径` | 🟡 新译 |
| `settingsAccPermission` | `Permission` | `权限` | 🟡 新译 |
| `settingsAccReadOnly` | `Read only` | `只读` | 🟡 新译 |
| `settingsAccReadWrite` | `Read & Write` | `读写` | 🟡 新译 |
| `settingsAccGrant` | `Grant` | `授权` | 🟡 新译 |
| `settingsAccAddFolder` | `Add folder` | `添加文件夹` | ✅ 照抄 |
| `settingsAccEnterFolderPath` | `Please enter a folder path` | `请输入文件夹路径` | 🟡 新译 |
| `settingsAccFolderGranted` | `Folder granted` | `已授权文件夹` | 🟡 新译 |
| `settingsAccGrantFailed` | `Failed to grant folder` | `授权文件夹失败` | 🟡 新译 |
| `settingsAccRevokePrefix` | `Revoke access to` | `撤销访问权限:` | 🟡 新译 |
| `settingsAccRevoke` | `Revoke` | `撤销` | 🟡 新译 |
| `settingsAccAccessRevoked` | `Access revoked` | `已撤销访问权限` | 🟡 新译 |
| `settingsAccRevokeFailed` | `Failed to revoke` | `撤销失败` | 🟡 新译 |
| `settingsAccNoFoldersGranted` | `No folders granted — only data disks (/DATA, /mnt, /media) are accessible.` | `未授权任何文件夹——仅数据盘(/DATA、/mnt、/media)可访问。` | 🟡 新译 |
| `settingsAccFoldersLoadFailed` | —(本期新增) | `加载文件夹授权失败` | 🆕 |
| `settingsFpIntro` | `Manage each smart feature's folders in its own section below.` | `在下方各分区分别管理每个智能功能的文件夹。` | ✅ 照抄 |
| `settingsFpDataPending` | —(本期新增) | `数据源待相册区(SP7)与 AI 区(SP8)合并后接入。` | 🆕 |
| `settingsFpFilenameIndex` | `Filename index` | `文件名索引` | ✅ 照抄 |
| `settingsFpServiceOffline` | `Service offline` | `服务离线` | ✅ 照抄 |
| `settingsFpFilenameDesc` | `Folders scanned into the filename search index.` | `纳入文件名搜索索引的文件夹。` | ✅ 照抄 |
| `settingsFpNoFolders` | `No folders configured.` | `暂无文件夹。` | ✅ 照抄 |
| `settingsFpKnowledge` | `Knowledge base` | `知识库` | ✅ 照抄 |
| `settingsFpKnowledgeDesc` | `Folders indexed into the knowledge base (RAG).` | `纳入知识库(RAG)索引的文件夹。` | ✅ 照抄 |
| `settingsFpIndexedFolders` | `Indexed folders` | `索引目录` | ✅ 照抄 |
| `settingsFpExcludedSubfolders` | `Excluded subfolders` | `排除的子目录` | ✅ 照抄 |
| `settingsFpAddExclusion` | `Add exclusion` | `添加排除` | ✅ 照抄 |
| `settingsFpNoExclusions` | `No exclusions.` | `暂无排除。` | ✅ 照抄 |
| `settingsFpAiHidden` | `Folders hidden from AI` | `禁止 AI 访问的文件夹` | ✅ 照抄 |
| `settingsFpCurrentUserOnly` | `Current user only` | `仅当前用户` | ✅ 照抄 |
| `settingsFpAiDesc` | `The AI agent can never see these folders.` | `AI agent 永远无法看到这些文件夹。` | ✅ 照抄 |
| `settingsFpNoAiBlocked` | `No folders blocked — the AI may access everything except the built-in system blacklist.` | `未禁止任何文件夹——除内置系统黑名单外,AI 可访问全部。` | ✅ 照抄 |
| `settingsFpPhotos` | `Photos` | `照片` | ✅ 照抄 |
| `settingsFpUpdateRequired` | `Update required` | `需要更新` | ✅ 照抄 |
| `settingsFpPhotosDesc` | `Folders watched for the photo library.` | `照片库监视的文件夹。` | ✅ 照抄 |
| `settingsFpPhotosAuto` | `Automatic mode: Photos currently watches the folders below (follows mounted volumes).` | `自动模式:Photos 当前监视以下文件夹(动态跟随挂载卷)。` | ✅ 照抄 |
| `settingsFpSwitchManual` | `Switch to manual management` | `转为手动管理` | ✅ 照抄 |
| `settingsFpPhotosStale` | `Photos service needs an update before its column can be managed here.` | `Photos 服务需要更新后才能在此管理其目录。` | ✅ 照抄 |
| `settingsFpCoveredBy` | `Covered by {p}` | `已被 {p} 覆盖` | ✅ 照抄 |
| `settingsFpGlobRules` | `{n} pattern rules (e.g. *.key) are managed in AI settings.` | `另有 {n} 条模式规则(如 *.key)在 AI 设置中管理。` | ✅ 照抄 |
| `settingsFpAddFolder` | `Add folder` | `添加文件夹` | ✅ 照抄 |

共 **77** 个键。

**`src/i18n/zh_cn.sp9.ts` 追加(照抄,含标点):**

```ts
  settingsAccOwnerLabel: '本机所有者账户',
  settingsAccChangePassword: '更改密码',
  settingsAccChangeAvatar: '更改头像',
  settingsAccUploadFromDevice: '从本机上传',
  settingsAccChooseFromNas: '从NAS选择',
  settingsAccLogout: '退出账户',
  settingsAccMembers: '成员',
  settingsAccAdd: '添加',
  settingsAccUsername: '用户名',
  settingsAccPassword: '密码',
  settingsAccConfirmPassword: '确认密码',
  settingsAccFoldersUnit: '个文件夹',
  settingsAccCreatedAt: '创建于',
  settingsAccNoMembers: '暂无成员',
  settingsAccMembersLoadFailed: '加载成员列表失败',
  settingsAccPickImageOnly: '请选择图片文件（JPG、PNG、GIF、WEBP、BMP）',
  settingsAccFillAllFields: '请填写所有字段',
  settingsAccPwdMin6: '密码至少需要 6 个字符',
  settingsAccPwdMismatch: '两次输入的密码不一致',
  settingsAccMemberAdded: '成员添加成功',
  settingsAccMemberAddFailed: '添加成员失败',
  settingsAccDelete: '删除',
  settingsAccDeleted: '已删除',
  settingsAccDeleteFailed: '删除失败',
  settingsAccLoadFolderFailed: '加载文件夹失败',
  settingsAccLoadImageFailed: '加载图片失败',
  settingsAccNoImagesHere: '此处没有图片文件',
  settingsAccOriPassword: '原密码',
  settingsAccNewPassword: '新密码',
  settingsAccConfirmNewPassword: '确认新密码',
  settingsAccBack: '返回',
  settingsAccSubmit: '提交',
  settingsAccUpdateOk: '更新成功',
  settingsAccUpdateFailed: '更新失败',
  settingsAccPreview: '预览',
  settingsAccFoldersAccessiblePrefix: '以下文件夹可被 ',
  settingsAccSystemDiskBlocked: ' 访问。系统盘默认不可访问。',
  settingsAccFolderPath: '文件夹路径',
  settingsAccPermission: '权限',
  settingsAccReadOnly: '只读',
  settingsAccReadWrite: '读写',
  settingsAccGrant: '授权',
  settingsAccAddFolder: '添加文件夹',
  settingsAccEnterFolderPath: '请输入文件夹路径',
  settingsAccFolderGranted: '已授权文件夹',
  settingsAccGrantFailed: '授权文件夹失败',
  settingsAccRevokePrefix: '撤销访问权限:',
  settingsAccRevoke: '撤销',
  settingsAccAccessRevoked: '已撤销访问权限',
  settingsAccRevokeFailed: '撤销失败',
  settingsAccNoFoldersGranted: '未授权任何文件夹——仅数据盘(/DATA、/mnt、/media)可访问。',
  settingsAccFoldersLoadFailed: '加载文件夹授权失败',
  settingsFpIntro: '在下方各分区分别管理每个智能功能的文件夹。',
  settingsFpDataPending: '数据源待相册区(SP7)与 AI 区(SP8)合并后接入。',
  settingsFpFilenameIndex: '文件名索引',
  settingsFpServiceOffline: '服务离线',
  settingsFpFilenameDesc: '纳入文件名搜索索引的文件夹。',
  settingsFpNoFolders: '暂无文件夹。',
  settingsFpKnowledge: '知识库',
  settingsFpKnowledgeDesc: '纳入知识库(RAG)索引的文件夹。',
  settingsFpIndexedFolders: '索引目录',
  settingsFpExcludedSubfolders: '排除的子目录',
  settingsFpAddExclusion: '添加排除',
  settingsFpNoExclusions: '暂无排除。',
  settingsFpAiHidden: '禁止 AI 访问的文件夹',
  settingsFpCurrentUserOnly: '仅当前用户',
  settingsFpAiDesc: 'AI agent 永远无法看到这些文件夹。',
  settingsFpNoAiBlocked: '未禁止任何文件夹——除内置系统黑名单外,AI 可访问全部。',
  settingsFpPhotos: '照片',
  settingsFpUpdateRequired: '需要更新',
  settingsFpPhotosDesc: '照片库监视的文件夹。',
  settingsFpPhotosAuto: '自动模式:Photos 当前监视以下文件夹(动态跟随挂载卷)。',
  settingsFpSwitchManual: '转为手动管理',
  settingsFpPhotosStale: 'Photos 服务需要更新后才能在此管理其目录。',
  settingsFpCoveredBy: '已被 {p} 覆盖',
  settingsFpGlobRules: '另有 {n} 条模式规则(如 *.key)在 AI 设置中管理。',
  settingsFpAddFolder: '添加文件夹',
```

**`src/i18n/en_us.sp9.ts` 追加(英文= Vue2 `en_US.json` 原文;新增键自拟):**

```ts
  settingsAccOwnerLabel: 'Local owner account',
  settingsAccChangePassword: 'Change password',
  settingsAccChangeAvatar: 'Change avatar',
  settingsAccUploadFromDevice: 'Upload from device',
  settingsAccChooseFromNas: 'Choose from NAS',
  settingsAccLogout: 'Logout',
  settingsAccMembers: 'Members',
  settingsAccAdd: 'Add',
  settingsAccUsername: 'Username',
  settingsAccPassword: 'Password',
  settingsAccConfirmPassword: 'Confirm password',
  settingsAccFoldersUnit: 'folders',
  settingsAccCreatedAt: 'Created at',
  settingsAccNoMembers: 'No members yet',
  settingsAccMembersLoadFailed: 'Failed to load members',
  settingsAccPickImageOnly: 'Please select an image file (JPG, PNG, GIF, WEBP, BMP)',
  settingsAccFillAllFields: 'Please fill in all fields',
  settingsAccPwdMin6: 'Password must be at least 6 characters',
  settingsAccPwdMismatch: 'The password confirmation does not match',
  settingsAccMemberAdded: 'Member added successfully',
  settingsAccMemberAddFailed: 'Failed to add member',
  settingsAccDelete: 'Delete',
  settingsAccDeleted: 'Deleted',
  settingsAccDeleteFailed: 'Delete failed',
  settingsAccLoadFolderFailed: 'Failed to load folder',
  settingsAccLoadImageFailed: 'Failed to load image',
  settingsAccNoImagesHere: 'No image files here',
  settingsAccOriPassword: 'Original password',
  settingsAccNewPassword: 'New password',
  settingsAccConfirmNewPassword: 'Confirm new password',
  settingsAccBack: 'Back',
  settingsAccSubmit: 'Submit',
  settingsAccUpdateOk: 'Update successful',
  settingsAccUpdateFailed: 'Update failure',
  settingsAccPreview: 'Preview',
  settingsAccFoldersAccessiblePrefix: 'Folders accessible by',
  settingsAccSystemDiskBlocked: '. System disk is blocked by default.',
  settingsAccFolderPath: 'Folder path',
  settingsAccPermission: 'Permission',
  settingsAccReadOnly: 'Read only',
  settingsAccReadWrite: 'Read & Write',
  settingsAccGrant: 'Grant',
  settingsAccAddFolder: 'Add folder',
  settingsAccEnterFolderPath: 'Please enter a folder path',
  settingsAccFolderGranted: 'Folder granted',
  settingsAccGrantFailed: 'Failed to grant folder',
  settingsAccRevokePrefix: 'Revoke access to',
  settingsAccRevoke: 'Revoke',
  settingsAccAccessRevoked: 'Access revoked',
  settingsAccRevokeFailed: 'Failed to revoke',
  settingsAccNoFoldersGranted: 'No folders granted — only data disks (/DATA, /mnt, /media) are accessible.',
  settingsAccFoldersLoadFailed: 'Failed to load folder permissions',
  settingsFpIntro: 'Manage each smart feature\'s folders in its own section below.',
  settingsFpDataPending: 'Data source pending: to be wired after the Photos (SP7) and AI (SP8) areas are merged.',
  settingsFpFilenameIndex: 'Filename index',
  settingsFpServiceOffline: 'Service offline',
  settingsFpFilenameDesc: 'Folders scanned into the filename search index.',
  settingsFpNoFolders: 'No folders configured.',
  settingsFpKnowledge: 'Knowledge base',
  settingsFpKnowledgeDesc: 'Folders indexed into the knowledge base (RAG).',
  settingsFpIndexedFolders: 'Indexed folders',
  settingsFpExcludedSubfolders: 'Excluded subfolders',
  settingsFpAddExclusion: 'Add exclusion',
  settingsFpNoExclusions: 'No exclusions.',
  settingsFpAiHidden: 'Folders hidden from AI',
  settingsFpCurrentUserOnly: 'Current user only',
  settingsFpAiDesc: 'The AI agent can never see these folders.',
  settingsFpNoAiBlocked: 'No folders blocked — the AI may access everything except the built-in system blacklist.',
  settingsFpPhotos: 'Photos',
  settingsFpUpdateRequired: 'Update required',
  settingsFpPhotosDesc: 'Folders watched for the photo library.',
  settingsFpPhotosAuto: 'Automatic mode: Photos currently watches the folders below (follows mounted volumes).',
  settingsFpSwitchManual: 'Switch to manual management',
  settingsFpPhotosStale: 'Photos service needs an update before its column can be managed here.',
  settingsFpCoveredBy: 'Covered by {p}',
  settingsFpGlobRules: '{n} pattern rules (e.g. *.key) are managed in AI settings.',
  settingsFpAddFolder: 'Add folder',
```

---

## Task 0: 共享包 `users` 域补全(NimoOS-Service)

**⚠️ 本任务在 `/home/nimo/NimoTech/NimoOS-Service` 仓,不在 New-UI 仓。**

**Files:**
- Modify: `src/types.ts`(在 `UserStatus` 之后追加)
- Modify: `src/users.ts`(现 6 个方法 → 16 个)
- Modify: `src/users.test.ts`(现 172 例基线里的一部分,追加)

**Interfaces:**
- Produces —— New-UI 侧全部任务通过 `$api.users.*` 消费这些签名,**名字与类型必须逐字一致**:
  ```ts
  getUserInfo(): Promise<UserInfo>
  setUserInfo(data: Partial<UserInfo>): Promise<UserInfo>
  changePassword(oldPassword: string, password: string): Promise<void>
  saveAvatar(dataUrl: string): Promise<void>
  avatarPath(version: number, token: string | null): string
  getMembers(): Promise<MemberInfo[]>
  createMember(username: string, password: string): Promise<MemberInfo>
  deleteUser(id: number | string): Promise<void>
  getMemberFolders(memberId: number | string): Promise<UserFolderPermission[]>
  grantMemberFolder(memberId: number | string, path: string, permission?: 'read' | 'write'): Promise<UserFolderPermission>
  revokeMemberFolder(memberId: number | string, permId: number | string): Promise<void>
  ```
- 类型:`MemberInfo` / `UserFolderPermission` 从 `@nimotech/nimoos-service` 导出。

- [ ] **Step 1: 写失败的测试(types + 只读三方法)**

追加到 `src/users.test.ts` 末尾:

```ts
// ── SP9-P4 追加 ───────────────────────────────────────────────────────────
// fixture 全部来自 2026-08-01 真机 curl(见 plan §Fixtures),不得手编。

function httpAll(map: Record<string, unknown>, calls?: { url: string; body?: unknown }[]): AxiosInstance {
  const rec = (url: string, body?: unknown) => { calls?.push({ url, body }) }
  return {
    get: async (url: string) => { rec(url); return { data: map[url] } },
    post: async (url: string, body: unknown) => { rec(url, body); return { data: map[url] } },
    put: async (url: string, body: unknown) => { rec(url, body); return { data: map[url] } },
    delete: async (url: string) => { rec(url); return { data: map[url] } },
  } as unknown as AxiosInstance
}

describe('createUsers — SP9-P4 users 域补全', () => {
  // 真机响应逐字:{"success":200,"message":"ok","data":{...}}
  const CURRENT = {
    success: 200, message: 'ok',
    data: {
      id: 1, username: 'nimoos', role: 'admin', email: '', nickname: '',
      avatar: '', description: '',
      created_at: '0001-01-01T00:00:00Z', updated_at: '0001-01-01T00:00:00Z',
    },
  }

  it('getUserInfo 走 /users/current 并剥一层信封', async () => {
    const calls: { url: string }[] = []
    const u = createUsers(httpAll({ '/users/current': CURRENT }, calls))
    const info = await u.getUserInfo()
    expect(calls[0].url).toBe('/users/current')
    expect(info.username).toBe('nimoos')
    expect(info.role).toBe('admin')
    expect(info.avatar).toBe('')
  })

  it('getMembers 剥信封;真机返回空数组', async () => {
    const u = createUsers(httpAll({ '/users/members': { success: 200, message: 'ok', data: [] } }))
    expect(await u.getMembers()).toEqual([])
  })

  it('getMembers 非数组 data 一律回退成 []（后端 nil slice 防线）', async () => {
    const u = createUsers(httpAll({ '/users/members': { success: 200, message: 'ok', data: null } }))
    expect(await u.getMembers()).toEqual([])
  })

  it('getMembers 保留 folder_count / created_at / role 原字段名', async () => {
    const one = { id: 3, username: 'alice', role: 'user', folder_count: 2, created_at: '2026-07-01T10:20:30Z' }
    const u = createUsers(httpAll({ '/users/members': { success: 200, message: 'ok', data: [one] } }))
    expect(await u.getMembers()).toEqual([one])
  })

  it('getMemberFolders 拼 /users/members/<id>/folders 并剥信封', async () => {
    const calls: { url: string }[] = []
    const u = createUsers(httpAll({ '/users/members/7/folders': { success: 200, message: 'ok', data: [] } }, calls))
    expect(await u.getMemberFolders(7)).toEqual([])
    expect(calls[0].url).toBe('/users/members/7/folders')
  })

  it('getMemberFolders 非数组 data 回退成 []', async () => {
    const u = createUsers(httpAll({ '/users/members/7/folders': { success: 200, message: 'ok', data: null } }))
    expect(await u.getMemberFolders(7)).toEqual([])
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd /home/nimo/NimoTech/NimoOS-Service && pnpm test 2>&1 | tail -20
```
Expected: FAIL —— `u.getUserInfo is not a function` 等。

- [ ] **Step 3: 加类型**

`src/types.ts`,在 `UserStatus` 接口之后追加:

```ts
/** GET /v1/users/members 的一行。后端是 handler 内联匿名 struct
 *  (NimoOS-UserService/route/v1/user.go:685-691)。
 *  ⚠️ GetAllMembers 只隐藏调用者本人、**不隐藏其它管理员**(user.go:694-697 注释明确),
 *  所以这个列表里可能出现 role==='admin' 的行 —— 消费方不要按 role 过滤。 */
export interface MemberInfo {
  id: number
  username: string
  role: string
  /** 该成员数据目录下的子目录个数(os.ReadDir 数出来的),不是被授权的文件夹数。 */
  folder_count: number
  created_at: string
}

/** user_folder_permissions 表的一行。
 *  Go: NimoOS-UserService/service/model/o_user.go:33-40。
 *  ⚠️ NimoOS core 启动时**只读打开**这张表做文件区权限判定 —— 字段名不要改。 */
export interface UserFolderPermission {
  id: number
  user_id: number
  path: string
  /** 'read' = r-x,'write' = rwx。后端对非法值静默回落成 'read'(user.go:762-764)。 */
  permission: 'read' | 'write' | string
  created_at: string
}
```

同时把 `UserInfo` 的命名字段补齐(它本来就有 `[k: string]: unknown`,加字段不破坏任何现有消费方):

```ts
export interface UserInfo {
  id?: number | string
  username?: string
  role?: string
  email?: string
  nickname?: string
  /** DB 里存的是**服务端绝对路径**(如 /var/lib/nimoos/1/avatar.png),不是 URL。
   *  本机实测为空串 —— 界面要用 users.avatarPath() 拼 URL,不要直接用这个字段。 */
  avatar?: string
  description?: string
  created_at?: string
  updated_at?: string
  [k: string]: unknown
}
```

- [ ] **Step 4: 实现只读三方法**

`src/users.ts` —— 在 `getStatus` 之后追加(**保留现有 6 个方法不动**):

```ts
    // ── SP9-P4:account tab 的 users 域补全 ───────────────────────────────
    // 信封层数逐个写死,禁自动探测(P1 已证实同一前缀下层数按端点不同)。
    // 下面 4 个 GET 在 2026-08-01 真机 curl 实证:**全部是标准信封
    // {success,message,data}**(plan §Fixtures)。

    /** GET /v1/users/current —— 当前登录用户。标准信封,已实证。 */
    async getUserInfo(): Promise<UserInfo> {
      const res = await http.get('/users/current')
      return unwrap<UserInfo>(res.data)
    },

    /** GET /v1/users/members —— 全部非本人用户(admin only)。标准信封,已实证:
     *  本机返回 data:[]。非 admin 调用 → HTTP 400 + success:10011。 */
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
```

并把 import 补上:

```ts
import type { EventModel, LoginResult, MemberInfo, UserFolderPermission, UserInfo, UserStatus } from './types.js'
```

- [ ] **Step 5: 跑测试确认通过**

```bash
cd /home/nimo/NimoTech/NimoOS-Service && pnpm test 2>&1 | tail -6
```
Expected: PASS,例数 = 172 + 6 = **178**。

- [ ] **Step 6: 写写端点的失败测试**

追加到 `src/users.test.ts`:

```ts
describe('createUsers — SP9-P4 写端点(⛔ 未经 curl 实证,类型只照 Go struct 对)', () => {
  it('changePassword 用 old_password / password 两个 snake_case 键 PUT', async () => {
    const calls: { url: string; body?: unknown }[] = []
    const u = createUsers(httpAll({ '/users/current/password': { success: 200, message: 'ok', data: {} } }, calls))
    await u.changePassword('old-pw', 'new-pw')
    expect(calls[0].url).toBe('/users/current/password')
    expect(calls[0].body).toEqual({ old_password: 'old-pw', password: 'new-pw' })
  })

  it('saveAvatar 把 dataURL 放进 { file } PUT 到 /users/avatar', async () => {
    const calls: { url: string; body?: unknown }[] = []
    const u = createUsers(httpAll({ '/users/avatar': { success: 200, message: 'ok', data: {} } }, calls))
    await u.saveAvatar('data:image/png;base64,AAAA')
    expect(calls[0].url).toBe('/users/avatar')
    expect(calls[0].body).toEqual({ file: 'data:image/png;base64,AAAA' })
  })

  it('avatarPath 带 token 与 v 版本号（缓存击穿）', () => {
    const u = createUsers(httpAll({}))
    expect(u.avatarPath(3, 'tok en')).toBe('/v1/users/avatar?token=tok%20en&v=3')
  })

  it('avatarPath 无 token 时不带 token 参数', () => {
    const u = createUsers(httpAll({}))
    expect(u.avatarPath(1, null)).toBe('/v1/users/avatar?v=1')
  })

  it('createMember POST username/password 并剥信封', async () => {
    const calls: { url: string; body?: unknown }[] = []
    const created = { id: 5, username: 'bob', role: 'user', folder_count: 0, created_at: 'x' }
    const u = createUsers(httpAll({ '/users/members': { success: 200, message: 'ok', data: created } }, calls))
    expect(await u.createMember('bob', 'pw1234')).toEqual(created)
    expect(calls[0].body).toEqual({ username: 'bob', password: 'pw1234' })
  })

  it('deleteUser DELETE /users/<id>', async () => {
    const calls: { url: string }[] = []
    const u = createUsers(httpAll({ '/users/9': { success: 200, message: 'ok' } }, calls))
    await u.deleteUser(9)
    expect(calls[0].url).toBe('/users/9')
  })

  it('grantMemberFolder 默认 read,body 是 { path, permission }', async () => {
    const calls: { url: string; body?: unknown }[] = []
    const perm = { id: 1, user_id: 3, path: '/DATA/Downloads', permission: 'read', created_at: 'x' }
    const u = createUsers(httpAll({ '/users/members/3/folders': { success: 200, message: 'ok', data: perm } }, calls))
    expect(await u.grantMemberFolder(3, '/DATA/Downloads')).toEqual(perm)
    expect(calls[0].body).toEqual({ path: '/DATA/Downloads', permission: 'read' })
  })

  it('grantMemberFolder 显式 write 会透传', async () => {
    const calls: { url: string; body?: unknown }[] = []
    const u = createUsers(httpAll({ '/users/members/3/folders': { success: 200, message: 'ok', data: {} } }, calls))
    await u.grantMemberFolder(3, '/DATA/Docs', 'write')
    expect(calls[0].body).toEqual({ path: '/DATA/Docs', permission: 'write' })
  })

  it('revokeMemberFolder 把 perm_id 放进 query string（后端读 QueryParam，不是 body）', async () => {
    const calls: { url: string }[] = []
    const u = createUsers(httpAll({ '/users/members/3/folders?perm_id=11': { success: 200, message: 'ok' } }, calls))
    await u.revokeMemberFolder(3, 11)
    expect(calls[0].url).toBe('/users/members/3/folders?perm_id=11')
  })

  it('setUserInfo PUT /users/current 并剥信封（本期无消费方，见 plan C10）', async () => {
    const calls: { url: string; body?: unknown }[] = []
    const u = createUsers(httpAll({ '/users/current': { success: 200, message: 'ok', data: { username: 'x' } } }, calls))
    expect(await u.setUserInfo({ username: 'x' })).toEqual({ username: 'x' })
    expect(calls[0].url).toBe('/users/current')
  })
})
```

- [ ] **Step 7: 跑测试确认失败**

```bash
cd /home/nimo/NimoTech/NimoOS-Service && pnpm test 2>&1 | tail -20
```
Expected: FAIL —— `u.changePassword is not a function` 等 10 条。

- [ ] **Step 8: 实现写端点(7 个)**

`src/users.ts` 接着追加:

```ts
    /** PUT /v1/users/current —— 改用户资料。
     *  ⚠️ **未经 curl 实证**(写端点,本期一律不发)。类型依据 Go struct
     *  UserDBModel(service/model/o_user.go:15-25)+ handler user.go:338-371:
     *  空字段会被后端用当前值补齐,username 撞已有用户 → HTTP 400 + success:10002。
     *  ⚠️ **本期无消费方** —— Vue2 那个入口(state 2「更改用户名」)全仓零调用,
     *  是死代码(plan C10)。按 spec §5.7 只做域补全。 */
    async setUserInfo(data: Partial<UserInfo>): Promise<UserInfo> {
      const res = await http.put('/users/current', data)
      return unwrap<UserInfo>(res.data)
    },

    /** PUT /v1/users/current/password —— 改当前用户密码。
     *  ⚠️ **未经 curl 实证,且开发机上一次都没发过**:后端 user.go:403 会
     *  osuser.SetOSUserPassword → /usr/sbin/chpasswd **写 /etc/shadow**,而 SSH 与
     *  登录都读 /etc/shadow —— 这就是机主的 SSH 凭据,改错不可撤销
     *  (还会异步同步 Samba 密码,user.go:409-413)。调用方必须确认是用户主动操作。
     *  旧密码错 → HTTP 400 + success:10014;后端设置失败 → HTTP 500。 */
    async changePassword(oldPassword: string, password: string): Promise<void> {
      await http.put('/users/current/password', { old_password: oldPassword, password })
    },

    /** PUT /v1/users/avatar —— 上传头像。body 是 { file: "<dataURL>" }。
     *  ⚠️ **未经 curl 实证**。后端 user.go:261 只 strip `data:image/png;base64,` 这一种前缀
     *  → **必须传 PNG dataURL**(canvas.toDataURL() 默认就是)。
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
     *  `v` 是缓存击穿版本号(后端 Cache-Control 已 no-store,但浏览器对 <img> 仍会复用)。
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
```

> **不进包的两个**:`deleteAllUser()`(`DELETE /users`,核按钮,Vue2 `AccountPanel` 零引用)与 `getUserImage/setUserImage/deleteUserImage`(壁纸/自定义图,不属 account tab)。判据 = 「界面里没有就不进包」。

- [ ] **Step 9: 跑测试 + 构建**

```bash
cd /home/nimo/NimoTech/NimoOS-Service && pnpm test 2>&1 | tail -6 && pnpm build 2>&1 | tail -5
```
Expected: **25 文件 / 188 例全绿**(172 + 6 + 10),`pnpm build` 通过。

- [ ] **Step 10: 让 New-UI 拿到新包(P1 那个坑的固定动作)**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && grep -n "nimoos-service" vite.config.ts
```
Expected: 看到 `optimizeDeps.exclude: ['@nimotech/nimoos-service']`(P1 已修,`219b854`)。**若没看到就停下报告** —— 否则 dev server 会继续喂旧包,新方法在浏览器里全是 `undefined`。

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && node -e "const m=require('./node_modules/@nimotech/nimoos-service/dist/index.cjs'); console.log(Object.keys(m))" 2>/dev/null || ls node_modules/@nimotech/nimoos-service/dist | head
```

- [ ] **Step 11: Commit(Service 仓,带 pathspec)**

```bash
cd /home/nimo/NimoTech/NimoOS-Service
git add src/users.ts src/users.test.ts src/types.ts
git commit -m "feat(users): 补全 account tab 需要的 10 个方法（写端点标注未经 curl 实证）" -- src/users.ts src/users.test.ts src/types.ts
git log --name-only -1
```

---
## Task 1: `folderPermissions.ts` —— 纯逻辑引擎(政策二的边界:不依赖后端,照测)

**Files:**
- Create: `src/settings/util/folderPermissions.ts`
- Test: `src/settings/util/folderPermissions.test.ts`

**移植源:** `NimoOS-UI/src/components/settings/folderPermissions.js`(157 行,零 I/O)。**逐函数 1:1**,只加类型。

**Interfaces:**
- Produces(Task 2/3 都消费):
  ```ts
  export type FolderPermColumn = 'search' | 'knowledge' | 'ai' | 'photos'
  export interface WikiRoot { id: number | string; path: string; enabled: boolean }
  export interface DenyRule { id: number | string; root_id: number | string; path_glob: string; action: string }
  export interface BlacklistEntry { id: number | string; pattern: string }
  export interface FolderCandidate { path: string; label?: string }
  export interface FolderPermSnapshot {
    candidates: FolderCandidate[]
    searchRoots: string[]
    wikiRoots: WikiRoot[]
    denyRules: DenyRule[]
    blacklist: BlacklistEntry[]
    photos: { auto: boolean; dirs: string[]; stale: boolean }
    offline: { search: boolean; knowledge: boolean; ai: boolean; photos: boolean }
  }
  export type FolderPermAction =
    | { svc: 'search'; op: 'putRoots'; roots: string[] }
    | { svc: 'wiki'; op: 'createRoot'; path: string }
    | { svc: 'wiki'; op: 'enableRoot' | 'disableRoot'; id: number | string }
    | { svc: 'parser'; op: 'addDeny'; rootId: number | string; glob: string }
    | { svc: 'parser'; op: 'removeDeny'; id: number | string }
    | { svc: 'ai'; op: 'addPattern'; pattern: string }
    | { svc: 'ai'; op: 'removePattern'; id: number | string }
    | { svc: 'photos'; op: 'putWatchDirs'; dirs: string[]; needsMaterialize: boolean }
  export function aiPatternFor(path: string): string
  export function denyGlobFor(path: string): string
  export function pathFromAiPattern(pattern: unknown): string | null
  export function pathFromDenyGlob(glob: unknown): string | null
  export function isUnder(path: string, ancestor: string): boolean
  export function coveringEnabledRoot(path: string, wikiRoots: WikiRoot[]): WikiRoot | null
  export function planToggle(path: string, col: FolderPermColumn, desired: boolean, snapshot: FolderPermSnapshot): FolderPermAction[]
  ```

- [ ] **Step 1: 写失败的测试**

`src/settings/util/folderPermissions.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  aiPatternFor, coveringEnabledRoot, denyGlobFor, isUnder,
  pathFromAiPattern, pathFromDenyGlob, planToggle,
  type FolderPermSnapshot,
} from './folderPermissions'

// 空快照工厂:每个用例只覆盖它关心的那几个字段。
function snap(over: Partial<FolderPermSnapshot> = {}): FolderPermSnapshot {
  return {
    candidates: [],
    searchRoots: [],
    wikiRoots: [],
    denyRules: [],
    blacklist: [],
    photos: { auto: false, dirs: [], stale: false },
    offline: { search: false, knowledge: false, ai: false, photos: false },
    ...over,
  }
}

describe('规范形态构造与反解', () => {
  it('aiPatternFor 拼 /** (agent 的 gitignore/PathSpec 语义)', () => {
    expect(aiPatternFor('/DATA/Docs')).toBe('/DATA/Docs/**')
  })
  it('denyGlobFor 拼 /* (Parser fnmatch，* 会跨 /)', () => {
    expect(denyGlobFor('/DATA/Docs')).toBe('/DATA/Docs/*')
  })
  it('pathFromAiPattern 反解出目录', () => {
    expect(pathFromAiPattern('/DATA/Docs/**')).toBe('/DATA/Docs')
  })
  it('pathFromAiPattern 拒非绝对路径 / 非 /** 结尾 / 含通配的中段', () => {
    expect(pathFromAiPattern('DATA/Docs/**')).toBeNull()
    expect(pathFromAiPattern('/DATA/Docs')).toBeNull()
    expect(pathFromAiPattern('/DATA/*/x/**')).toBeNull()
    expect(pathFromAiPattern('/**')).toBeNull()   // slice 后是空串
    expect(pathFromAiPattern(42)).toBeNull()      // 非字符串
  })
  it('pathFromDenyGlob 反解 /* 形态，同样拒非规范值', () => {
    expect(pathFromDenyGlob('/DATA/Docs/*')).toBe('/DATA/Docs')
    expect(pathFromDenyGlob('/DATA/Docs/**')).toBe('/DATA/Docs/*'.slice(0, 0) || null) // 见下条说明
  })
})

describe('isUnder —— 必须按分段判，不能是裸 startsWith', () => {
  it('真子孙为 true', () => {
    expect(isUnder('/DATA/Docs/a', '/DATA/Docs')).toBe(true)
  })
  it('自己不是自己的子孙', () => {
    expect(isUnder('/DATA/Docs', '/DATA/Docs')).toBe(false)
  })
  it('同前缀的兄弟目录不算子孙（/DATA/DocsOld 不属于 /DATA/Docs）', () => {
    expect(isUnder('/DATA/DocsOld', '/DATA/Docs')).toBe(false)
  })
})

describe('coveringEnabledRoot —— 取最长匹配，且只看启用的根', () => {
  const roots = [
    { id: 1, path: '/DATA', enabled: true },
    { id: 2, path: '/DATA/Docs', enabled: true },
    { id: 3, path: '/DATA/Media', enabled: false },
  ]
  it('最长匹配胜出', () => {
    expect(coveringEnabledRoot('/DATA/Docs/a', roots)?.id).toBe(2)
  })
  it('路径等于根本身也算被覆盖', () => {
    expect(coveringEnabledRoot('/DATA/Docs', roots)?.id).toBe(2)
  })
  it('停用的根不覆盖 —— 回落到更短的启用根', () => {
    expect(coveringEnabledRoot('/DATA/Media/x', roots)?.id).toBe(1)
  })
  it('无任何启用根覆盖时返回 null', () => {
    expect(coveringEnabledRoot('/mnt/x', roots)).toBeNull()
  })
})

describe('planToggle — search 列', () => {
  it('打开：并入并排序', () => {
    const s = snap({ searchRoots: ['/DATA/Z', '/DATA/A'] })
    expect(planToggle('/DATA/M', 'search', true, s)).toEqual([
      { svc: 'search', op: 'putRoots', roots: ['/DATA/A', '/DATA/M', '/DATA/Z'] },
    ])
  })
  it('打开已存在的项：状态已是 on，返回空计划', () => {
    const s = snap({ searchRoots: ['/DATA/A'] })
    expect(planToggle('/DATA/A', 'search', true, s)).toEqual([])
  })
  it('关闭：从列表里剔除', () => {
    const s = snap({ searchRoots: ['/DATA/A', '/DATA/B'] })
    expect(planToggle('/DATA/A', 'search', false, s)).toEqual([
      { svc: 'search', op: 'putRoots', roots: ['/DATA/B'] },
    ])
  })
  it('被祖先继承的项不可操作 —— 返回空计划（inherited-on）', () => {
    const s = snap({ searchRoots: ['/DATA'] })
    expect(planToggle('/DATA/Docs', 'search', false, s)).toEqual([])
  })
  it('服务离线 → 不可操作', () => {
    const s = snap({ offline: { search: true, knowledge: false, ai: false, photos: false } })
    expect(planToggle('/DATA/A', 'search', true, s)).toEqual([])
  })
})

describe('planToggle — photos 列', () => {
  it('打开：并入排序，并带上 needsMaterialize=auto', () => {
    const s = snap({ photos: { auto: true, dirs: ['/DATA/Gallery'], stale: false } })
    expect(planToggle('/DATA/Pics', 'photos', true, s)).toEqual([
      { svc: 'photos', op: 'putWatchDirs', dirs: ['/DATA/Gallery', '/DATA/Pics'], needsMaterialize: true },
    ])
  })
  it('关闭最后一个 → dirs 变空数组（调用方要据此弹「回自动模式」确认）', () => {
    const s = snap({ photos: { auto: false, dirs: ['/DATA/Gallery'], stale: false } })
    expect(planToggle('/DATA/Gallery', 'photos', false, s)).toEqual([
      { svc: 'photos', op: 'putWatchDirs', dirs: [], needsMaterialize: false },
    ])
  })
  it('stale（旧 Photos 后端）→ 不可操作', () => {
    const s = snap({ photos: { auto: true, dirs: [], stale: true } })
    expect(planToggle('/DATA/Pics', 'photos', true, s)).toEqual([])
  })
})

describe('planToggle — ai 列（语义反向：on = 未被拉黑）', () => {
  it('默认未拉黑 → 关闭 = 加 pattern', () => {
    expect(planToggle('/DATA/Secret', 'ai', false, snap())).toEqual([
      { svc: 'ai', op: 'addPattern', pattern: '/DATA/Secret/**' },
    ])
  })
  it('已拉黑 → 打开 = 按 entryId 删 pattern', () => {
    const s = snap({ blacklist: [{ id: 7, pattern: '/DATA/Secret/**' }] })
    expect(planToggle('/DATA/Secret', 'ai', true, s)).toEqual([
      { svc: 'ai', op: 'removePattern', id: 7 },
    ])
  })
  it('祖先已拉黑 → inherited-off，不可操作', () => {
    const s = snap({ blacklist: [{ id: 7, pattern: '/DATA/**' }] })
    expect(planToggle('/DATA/Secret', 'ai', true, s)).toEqual([])
  })
})

describe('planToggle — knowledge 列（三种 kind）', () => {
  it('kind=root：开关直接翻根的 enabled', () => {
    const s = snap({ wikiRoots: [{ id: 2, path: '/DATA/Docs', enabled: false }] })
    expect(planToggle('/DATA/Docs', 'knowledge', true, s)).toEqual([
      { svc: 'wiki', op: 'enableRoot', id: 2 },
    ])
    const s2 = snap({ wikiRoots: [{ id: 2, path: '/DATA/Docs', enabled: true }] })
    expect(planToggle('/DATA/Docs', 'knowledge', false, s2)).toEqual([
      { svc: 'wiki', op: 'disableRoot', id: 2 },
    ])
  })
  it('kind=uncovered：打开 = 建根；关闭 = 无事可做', () => {
    expect(planToggle('/mnt/X', 'knowledge', true, snap())).toEqual([
      { svc: 'wiki', op: 'createRoot', path: '/mnt/X' },
    ])
    expect(planToggle('/mnt/X', 'knowledge', false, snap())).toEqual([])
  })
  it('kind=subdir 且当前 on：关闭 = 加 deny 规则', () => {
    const s = snap({ wikiRoots: [{ id: 1, path: '/DATA', enabled: true }] })
    expect(planToggle('/DATA/Docs', 'knowledge', false, s)).toEqual([
      { svc: 'parser', op: 'addDeny', rootId: 1, glob: '/DATA/Docs/*' },
    ])
  })
  it('kind=subdir 且已被 deny：打开 = 按 id 删该 deny 规则', () => {
    const s = snap({
      wikiRoots: [{ id: 1, path: '/DATA', enabled: true }],
      denyRules: [{ id: 33, root_id: 1, path_glob: '/DATA/Docs/*', action: 'deny' }],
    })
    expect(planToggle('/DATA/Docs', 'knowledge', true, s)).toEqual([
      { svc: 'parser', op: 'removeDeny', id: 33 },
    ])
  })
  it('deny 规则挂在别的根上 → 不认（root_id 必须匹配覆盖根）', () => {
    const s = snap({
      wikiRoots: [{ id: 1, path: '/DATA', enabled: true }],
      denyRules: [{ id: 33, root_id: 99, path_glob: '/DATA/Docs/*', action: 'deny' }],
    })
    // 当前仍是 on，desired=true → 空计划；desired=false 才加新 deny
    expect(planToggle('/DATA/Docs', 'knowledge', true, s)).toEqual([])
    expect(planToggle('/DATA/Docs', 'knowledge', false, s)).toEqual([
      { svc: 'parser', op: 'addDeny', rootId: 1, glob: '/DATA/Docs/*' },
    ])
  })
  it('action 不是 deny 的规则不算（allow 规则不能当 deny 用）', () => {
    const s = snap({
      wikiRoots: [{ id: 1, path: '/DATA', enabled: true }],
      denyRules: [{ id: 33, root_id: 1, path_glob: '/DATA/Docs/*', action: 'allow' }],
    })
    expect(planToggle('/DATA/Docs', 'knowledge', false, s)).toEqual([
      { svc: 'parser', op: 'addDeny', rootId: 1, glob: '/DATA/Docs/*' },
    ])
  })
  it('knowledge 离线 → 不可操作', () => {
    const s = snap({ offline: { search: false, knowledge: true, ai: false, photos: false } })
    expect(planToggle('/DATA/Docs', 'knowledge', true, s)).toEqual([])
  })
})
```

> ⚠️ 上面 `pathFromDenyGlob` 那条里写了个绕的表达式,**实现时请改成直白的两条断言**:
> ```ts
> expect(pathFromDenyGlob('/DATA/Docs/*')).toBe('/DATA/Docs')
> expect(pathFromDenyGlob('/DATA/Docs')).toBeNull()
> expect(pathFromDenyGlob('/DATA/*/x/*')).toBeNull()
> expect(pathFromDenyGlob(null)).toBeNull()
> ```
> (`'/DATA/Docs/**'` 会被 `endsWith('/*')` 命中、slice 掉尾部 `*` 后剩 `/DATA/Docs/*`,含 `*` → 返回 `null`,也可以断这条。)

- [ ] **Step 2: 跑测试确认失败**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm vitest run src/settings/util/folderPermissions.test.ts 2>&1 | tail -20
```
Expected: FAIL —— 找不到模块 `./folderPermissions`。

- [ ] **Step 3: 实现**

`src/settings/util/folderPermissions.ts` —— 1:1 移植 `folderPermissions.js`,函数体逐行照抄、只加类型。文件头注释:

```ts
/* folder-permissions 的纯聚合引擎。1:1 移植 Vue2
 * NimoOS-UI/src/components/settings/folderPermissions.js(157 行,零 I/O)。
 *
 * 这里没有任何 I/O:快照由 folderPermissionsSnapshot.ts 组装,写计划只是普通的
 * action 描述对象,由那边的 execute() 去执行。
 *
 * ⚠️ 本期(SP9-P4)按 spec §3.1 政策三只做界面骨架 —— 快照是空实现、写操作禁用。
 * 但**这个文件是纯函数,照测不误**(政策二的边界)。合并 sp7/sp8 后本文件零改动。
 *
 * 规范形态(矩阵只管这两种,更花的 glob 不在范围内):
 *   knowledge deny glob : `<abs_path>/*`   (Parser fnmatch,`*` 会跨 `/`)
 *   ai blacklist pattern: `<abs_path>/**`  (agent gitignore/PathSpec)
 */
```

各函数体照抄 Vue2,注意三处 TS 化细节:
- `listCell` / `searchCell` / `photosCell` / `knowledgeCell` / `aiCell` 保持 module-private(不 export),返回类型定义一个内部 `type Cell = { state: string; operable: boolean; meta: Record<string, unknown> }` —— 但 `planToggle` 里要读 `cell.meta.entryId` / `rootId` / `denyRuleId` / `kind`,所以把 `meta` 定成:
  ```ts
  interface CellMeta {
    hasOwnEntry?: boolean
    auto?: boolean
    kind?: 'root' | 'subdir' | 'uncovered'
    rootId?: number | string
    denyRuleId?: number | string
    entryId?: number | string
  }
  interface Cell { state: 'on' | 'off' | 'inherited-on' | 'inherited-off' | 'offline' | 'stale'; operable: boolean; meta: CellMeta }
  ```
- `planToggle` 里的 `{search:…,knowledge:…,ai:…,photos:…}[col](path, snapshot)` 派发表要显式标注 `Record<FolderPermColumn, (p: string, s: FolderPermSnapshot) => Cell>`。
- `coveringEnabledRoot` 返回 `WikiRoot | null`(Vue2 是 `null` 初值,照留)。

- [ ] **Step 4: 跑测试确认通过**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm vitest run src/settings/util/folderPermissions.test.ts 2>&1 | tail -6
```
Expected: PASS,**43 例**左右。

- [ ] **Step 5: 变异验证(B3)**

依次改坏这三行、确认对应用例翻红、再改回:
1. `isUnder` 里的 `` path.startsWith(`${ancestor}/`) `` → `path.startsWith(ancestor)` → 「同前缀的兄弟目录不算子孙」必须红。
2. `coveringEnabledRoot` 里的 `if (!r.enabled) continue` 删掉 → 「停用的根不覆盖」必须红。
3. `exactDenyRule` 里的 `d.root_id === root.id` 改成恒 `true` → 「deny 规则挂在别的根上」必须红。

把三次结果记进台账。

- [ ] **Step 6: Commit**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git add src/settings/util/folderPermissions.ts src/settings/util/folderPermissions.test.ts
git commit -m "feat(settings): 移植 folder-permissions 纯聚合引擎（planToggle 等 7 个纯函数）" -- src/settings/util/folderPermissions.ts src/settings/util/folderPermissions.test.ts
git log --name-only -1 | grep -c design-export   # 必须是 0
```

---

## Task 2: `folderPermissionsView.ts` + `folderBrowser.ts` —— 视图派生与选择器纯函数

**Files:**
- Create: `src/settings/util/folderPermissionsView.ts`
- Create: `src/settings/util/folderPermissionsView.test.ts`
- Create: `src/settings/util/folderBrowser.ts`
- Create: `src/settings/util/folderBrowser.test.ts`

**移植源:** `folderPermissionsView.js`(65 行)+ `components/common/folderBrowser.js`(34 行)。

**Interfaces:**
- Consumes: Task 1 的 `FolderPermSnapshot` / `isUnder` / `coveringEnabledRoot` / `pathFromAiPattern` / `pathFromDenyGlob`。
- Produces:
  ```ts
  // folderPermissionsView.ts
  export interface PathItem { path: string; coveredBy: string | null }
  export interface KnowledgeRootItem { path: string; enabled: boolean; rootId: number | string }
  export interface ExcludeItem { id: number | string; path: string }
  export interface AiItem { id: number | string; path: string; coveredBy: string | null }
  export function coveredBy(path: string, paths: string[]): string | null
  export function searchItems(s: FolderPermSnapshot): PathItem[]
  export function knowledgeRootItems(s: FolderPermSnapshot): KnowledgeRootItem[]
  export function knowledgeExcludeItems(s: FolderPermSnapshot): ExcludeItem[]
  export function knowledgeKindOf(path: string, s: FolderPermSnapshot): 'root' | 'subdir' | 'uncovered'
  export function aiItems(s: FolderPermSnapshot): { items: AiItem[]; globCount: number }
  export function photosItems(s: FolderPermSnapshot): PathItem[]

  // folderBrowser.ts
  export interface PickerRoot { path: string; label: string }
  export function dirEntries(content: FolderEntry[] | null | undefined): { name: string; path: string }[]
  export function pickerRoots(candidates: FolderCandidate[] | null | undefined): PickerRoot[]
  export function crumbsFor(path: string, rootLabel: string): { label: string; path: string }[]
  ```

- [ ] **Step 1: 写失败的测试(view)**

`src/settings/util/folderPermissionsView.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  aiItems, coveredBy, knowledgeExcludeItems, knowledgeKindOf,
  knowledgeRootItems, photosItems, searchItems,
} from './folderPermissionsView'
import type { FolderPermSnapshot } from './folderPermissions'

function snap(over: Partial<FolderPermSnapshot> = {}): FolderPermSnapshot {
  return {
    candidates: [], searchRoots: [], wikiRoots: [], denyRules: [], blacklist: [],
    photos: { auto: false, dirs: [], stale: false },
    offline: { search: false, knowledge: false, ai: false, photos: false },
    ...over,
  }
}

describe('coveredBy —— 取最短祖先（最外层的那个才是「覆盖者」）', () => {
  it('多个祖先时取最短的', () => {
    expect(coveredBy('/DATA/A/B/C', ['/DATA/A/B', '/DATA/A', '/other'])).toBe('/DATA/A')
  })
  it('没有祖先返回 null', () => {
    expect(coveredBy('/DATA/A', ['/DATA/AB', '/mnt'])).toBeNull()
  })
  it('自己不算自己的祖先', () => {
    expect(coveredBy('/DATA/A', ['/DATA/A'])).toBeNull()
  })
})

describe('searchItems', () => {
  it('按路径排序，并标出被谁覆盖', () => {
    const s = snap({ searchRoots: ['/DATA/A/B', '/DATA/A'] })
    expect(searchItems(s)).toEqual([
      { path: '/DATA/A', coveredBy: null },
      { path: '/DATA/A/B', coveredBy: '/DATA/A' },
    ])
  })
  it('不改动原数组（slice 后再 sort）', () => {
    const roots = ['/b', '/a']
    searchItems(snap({ searchRoots: roots }))
    expect(roots).toEqual(['/b', '/a'])
  })
})

describe('knowledgeRootItems', () => {
  it('按 path localeCompare 排序，enabled 归一成布尔', () => {
    const s = snap({ wikiRoots: [
      { id: 2, path: '/DATA/Z', enabled: 1 as unknown as boolean },
      { id: 1, path: '/DATA/A', enabled: false },
    ] })
    expect(knowledgeRootItems(s)).toEqual([
      { path: '/DATA/A', enabled: false, rootId: 1 },
      { path: '/DATA/Z', enabled: true, rootId: 2 },
    ])
  })
})

describe('knowledgeExcludeItems', () => {
  it('只收 action=deny、能反解成路径的规则，并按路径排序', () => {
    const s = snap({ denyRules: [
      { id: 1, root_id: 1, path_glob: '/DATA/Z/*', action: 'deny' },
      { id: 2, root_id: 1, path_glob: '/DATA/A/*', action: 'deny' },
      { id: 3, root_id: 1, path_glob: '/DATA/X/*', action: 'allow' },   // 非 deny，丢
      { id: 4, root_id: 1, path_glob: '*.key', action: 'deny' },        // 反解不出路径，丢
    ] })
    expect(knowledgeExcludeItems(s)).toEqual([
      { id: 2, path: '/DATA/A' },
      { id: 1, path: '/DATA/Z' },
    ])
  })
})

describe('knowledgeKindOf', () => {
  const s = snap({ wikiRoots: [
    { id: 1, path: '/DATA', enabled: true },
    { id: 2, path: '/DATA/Off', enabled: false },
  ] })
  it('路径本身就是根 → root（即便该根是停用的）', () => {
    expect(knowledgeKindOf('/DATA/Off', s)).toBe('root')
  })
  it('在启用根之下 → subdir', () => {
    expect(knowledgeKindOf('/DATA/Docs', s)).toBe('subdir')
  })
  it('不在任何启用根之下 → uncovered', () => {
    expect(knowledgeKindOf('/mnt/X', s)).toBe('uncovered')
  })
})

describe('aiItems —— 目录项与 glob 规则分流', () => {
  it('能反解成目录的进 items（排序 + coveredBy），其余只计数', () => {
    const s = snap({ blacklist: [
      { id: 1, pattern: '/DATA/Z/**' },
      { id: 2, pattern: '/DATA/A/**' },
      { id: 3, pattern: '/DATA/A/B/**' },
      { id: 4, pattern: '*.key' },
      { id: 5, pattern: '**/node_modules/**' },
    ] })
    expect(aiItems(s)).toEqual({
      items: [
        { id: 2, path: '/DATA/A', coveredBy: null },
        { id: 3, path: '/DATA/A/B', coveredBy: '/DATA/A' },
        { id: 1, path: '/DATA/Z', coveredBy: null },
      ],
      globCount: 2,
    })
  })
  it('空黑名单 → items 空、globCount 0', () => {
    expect(aiItems(snap())).toEqual({ items: [], globCount: 0 })
  })
})

describe('photosItems', () => {
  it('排序 + coveredBy', () => {
    const s = snap({ photos: { auto: false, dirs: ['/DATA/G/Sub', '/DATA/G'], stale: false } })
    expect(photosItems(s)).toEqual([
      { path: '/DATA/G', coveredBy: null },
      { path: '/DATA/G/Sub', coveredBy: '/DATA/G' },
    ])
  })
})
```

- [ ] **Step 2: 写失败的测试(browser)**

`src/settings/util/folderBrowser.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { crumbsFor, dirEntries, pickerRoots } from './folderBrowser'
import type { FolderEntry } from '@nimotech/nimoos-service'

describe('dirEntries', () => {
  const content = [
    { name: 'Zed', path: '/DATA/Zed', is_dir: true },
    { name: 'Apple', path: '/DATA/Apple', is_dir: true },
    { name: '.hidden', path: '/DATA/.hidden', is_dir: true },
    { name: 'a.txt', path: '/DATA/a.txt', is_dir: false },
  ] as FolderEntry[]
  it('只留非隐藏目录并按名字排序', () => {
    expect(dirEntries(content)).toEqual([
      { name: 'Apple', path: '/DATA/Apple' },
      { name: 'Zed', path: '/DATA/Zed' },
    ])
  })
  it('null / undefined → 空数组', () => {
    expect(dirEntries(null)).toEqual([])
    expect(dirEntries(undefined)).toEqual([])
  })
})

describe('pickerRoots', () => {
  it('有候选时用候选，label 缺失回退成 path', () => {
    expect(pickerRoots([{ path: '/DATA', label: 'NimoOS-HD' }, { path: '/mnt/x' }])).toEqual([
      { path: '/DATA', label: 'NimoOS-HD' },
      { path: '/mnt/x', label: '/mnt/x' },
    ])
  })
  it('候选为空 / null 时回退到内置三根（本期快照恒空，这条就是真机唯一形态）', () => {
    const fallback = [
      { path: '/DATA', label: 'System (/DATA)' },
      { path: '/media', label: '/media' },
      { path: '/mnt', label: '/mnt' },
    ]
    expect(pickerRoots([])).toEqual(fallback)
    expect(pickerRoots(null)).toEqual(fallback)
  })
})

describe('crumbsFor', () => {
  it('根 crumb 的 path 是空串，逐段累加', () => {
    expect(crumbsFor('/a/b', 'ROOT')).toEqual([
      { label: 'ROOT', path: '' },
      { label: 'a', path: '/a' },
      { label: 'b', path: '/a/b' },
    ])
  })
  it('空路径只有根 crumb', () => {
    expect(crumbsFor('', 'ROOT')).toEqual([{ label: 'ROOT', path: '' }])
  })
})
```

- [ ] **Step 3: 跑两个测试文件确认失败**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm vitest run src/settings/util/folderPermissionsView.test.ts src/settings/util/folderBrowser.test.ts 2>&1 | tail -12
```
Expected: FAIL —— 两个模块都不存在。

- [ ] **Step 4: 实现两个文件**

两者都是**逐函数 1:1 移植**,函数体照抄,只加类型。文件头各写一句注释指明移植源与行数。`folderBrowser.ts` 的 `pickerRoots` 内置三根的 label 字符串 **逐字节照抄 Vue2**(`'System (/DATA)'` / `'/media'` / `'/mnt'`,半角括号)。

- [ ] **Step 5: 跑测试确认通过**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm vitest run src/settings/util/folderPermissionsView.test.ts src/settings/util/folderBrowser.test.ts 2>&1 | tail -6
```
Expected: PASS,约 **21 例**。

- [ ] **Step 6: 变异验证(B3)**

1. `coveredBy` 的排序 `a.length - b.length` 改成 `b.length - a.length` → 「多个祖先时取最短的」必须红。
2. `dirEntries` 的 `!e.name.startsWith('.')` 删掉 → 「只留非隐藏目录」必须红。
3. `aiItems` 里 `else globCount++` 改成 `else {}` → 「globCount 2」必须红。

- [ ] **Step 7: Commit**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git add src/settings/util/folderPermissionsView.ts src/settings/util/folderPermissionsView.test.ts src/settings/util/folderBrowser.ts src/settings/util/folderBrowser.test.ts
git commit -m "feat(settings): 移植 folder-permissions 视图派生与文件夹选择器纯函数" -- src/settings/util/folderPermissionsView.ts src/settings/util/folderPermissionsView.test.ts src/settings/util/folderBrowser.ts src/settings/util/folderBrowser.test.ts
```

---
## Task 3: 空快照落点 + `FolderPermissionsPanel.vue` 四分区界面(政策三「做样子」)

**Files:**
- Create: `src/settings/util/folderPermissionsSnapshot.ts`
- Create: `src/settings/util/folderPermissionsSnapshot.test.ts`
- Modify: `src/settings/panels/FolderPermissionsPanel.vue`(现为 P0 空骨架,整体重写)
- Create: `src/settings/panels/FolderPermissionsPanel.test.ts`
- Modify: `src/settings/styles/settings.css`(追加 `.set-fp-*`)
- Modify: `src/i18n/zh_cn.sp9.ts` / `src/i18n/en_us.sp9.ts`(加 `settingsFp*` 共 23 个键,见 §i18n 全表)

**⚠️ 本任务是 spec §3.1 政策三的「做样子」:界面 1:1 做完整,数据源留空、写操作禁用。**

**Interfaces:**
- Consumes: Task 1 的 `FolderPermSnapshot` / `planToggle`;Task 2 的全部视图派生函数。
- Produces(债务 D11 的接线点):
  ```ts
  export function emptySnapshot(): FolderPermSnapshot
  export async function fetchSnapshot(): Promise<FolderPermSnapshot>   // 本期:直接 resolve(emptySnapshot())
  export const WIRED = false                                           // 本期 false;接线后改 true
  export async function execute(actions: FolderPermAction[]): Promise<void>  // 本期:抛 Error
  ```

- [ ] **Step 1: 写失败的测试(空快照)**

`src/settings/util/folderPermissionsSnapshot.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { emptySnapshot, execute, fetchSnapshot, WIRED } from './folderPermissionsSnapshot'

describe('folderPermissionsSnapshot —— 本期空实现（债务 D11）', () => {
  it('WIRED 是 false —— 界面据此显示「数据源待接入」说明条并禁用写操作', () => {
    expect(WIRED).toBe(false)
  })

  it('emptySnapshot 四个子系统全部标记为离线', () => {
    expect(emptySnapshot().offline).toEqual({ search: true, knowledge: true, ai: true, photos: true })
  })

  it('emptySnapshot 各列表为空、photos 非 auto 非 stale', () => {
    const s = emptySnapshot()
    expect(s.candidates).toEqual([])
    expect(s.searchRoots).toEqual([])
    expect(s.wikiRoots).toEqual([])
    expect(s.denyRules).toEqual([])
    expect(s.blacklist).toEqual([])
    expect(s.photos).toEqual({ auto: false, dirs: [], stale: false })
  })

  it('fetchSnapshot 不发任何网络请求', async () => {
    const spy = vi.spyOn(globalThis, 'fetch' as never)
    await fetchSnapshot()
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('fetchSnapshot 每次返回全新对象（消费方不会互相污染）', async () => {
    const a = await fetchSnapshot()
    const b = await fetchSnapshot()
    expect(a).not.toBe(b)
    expect(a).toEqual(b)
  })

  it('execute 一律拒绝执行（写操作在本期不许发生）', async () => {
    await expect(execute([{ svc: 'search', op: 'putRoots', roots: ['/DATA'] }])).rejects.toThrow(/not wired/i)
  })

  it('execute 连空计划也拒绝 —— 不给「其实调用了但恰好没动作」留缝', async () => {
    await expect(execute([])).rejects.toThrow(/not wired/i)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm vitest run src/settings/util/folderPermissionsSnapshot.test.ts 2>&1 | tail -10
```

- [ ] **Step 3: 实现空快照**

`src/settings/util/folderPermissionsSnapshot.ts`:

```ts
/* folder-permissions 的数据腿 —— **本期(SP9-P4)是明确标注的空实现**。
 *
 * 为什么空:Vue2 的 folderPermissionsStore.js(132 行)是个**六路聚合器**,依赖
 *   wiki.getCandidates/getRoots/createRoot/patchRootEnabled  → `wiki` 域**无 SP 归属**,
 *                                                              用户已拍板挂账(债务 D12)
 *   api.get/post/delete('/ai/parser/allowlist/folders')       → 经 AI 代理,SP8
 *   ai.getSearchSettings / putSearchSettings                  → SP8
 *   ai.listBlacklist / addBlacklistPattern / removeBlacklistPattern → SP8
 *   photos.getConfig / updateConfig                           → SP7
 * sp7-photos 与 sp8-ai 两条分支都还没合进 master,所以按 spec §3.1 **政策三**:
 * 界面照 Vue2 做完整,数据源与写操作留空并在界面上标注,合并后**只换本文件的
 * fetchSnapshot / execute 两个函数即可接线,界面不用重做**(债务 D11)。
 *
 * ⚠️ 接线时要做的事(留给 D11 的执行者):
 *   1. fetchSnapshot:照 Vue2 folderPermissionsStore.js:25-54 的 Promise.all + safe() 六路并发,
 *      每路失败单独记 offline,不要让一路失败拖垮整屏。注意 search 的响应把值套在
 *      `settings` 下(GET /v1/search/settings → {restart_fields,runtime_fields,settings:{fileindex_roots}}),
 *      而 PUT 的 body 是**扁平** patch 形状。
 *   2. execute:照 :56-86 逐 action 派发。
 *   3. WIRED 改成 true —— 界面的说明条与「只读」禁用会自动解除(见 FolderPermissionsPanel.vue)。
 *   4. 把面板的 toggle 从 no-op 换成走 planToggle + execute + 全量 refresh
 *      (Vue2 :101-111 的语义:**无论成败都全量 refresh**,因为超时不代表未写入)。
 */
import type { FolderPermAction, FolderPermSnapshot } from './folderPermissions'

/** 本期是否已接上真实数据源。false → 界面显示「数据源待接入」并禁用一切写操作。 */
export const WIRED = false

/** 全空 + 四路全离线的快照。四路标 offline=true 是**故意的**:
 *  Vue2 的每个分区在 offline 时渲染「服务离线」徽标并隐藏列表与添加按钮,
 *  这正好是本期「无数据」的正确视觉形态,不需要再造一种空态。 */
export function emptySnapshot(): FolderPermSnapshot {
  return {
    candidates: [],
    searchRoots: [],
    wikiRoots: [],
    denyRules: [],
    blacklist: [],
    photos: { auto: false, dirs: [], stale: false },
    offline: { search: true, knowledge: true, ai: true, photos: true },
  }
}

/** 本期**不打任何接口**。保持 async 是为了让接线时签名不变、消费方零改动。 */
export async function fetchSnapshot(): Promise<FolderPermSnapshot> {
  return emptySnapshot()
}

/** 本期写操作一律不许发生。抛错而不是静默 no-op —— 万一将来有人误接上调用点,
 *  要在测试/控制台里立刻看得见,而不是悄悄什么都没做。 */
export async function execute(_actions: FolderPermAction[]): Promise<void> {
  throw new Error('folder-permissions writes are not wired yet (SP9-P4, debt D11)')
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm vitest run src/settings/util/folderPermissionsSnapshot.test.ts 2>&1 | tail -6
```
Expected: PASS,7 例。

- [ ] **Step 5: 加 i18n(23 个 `settingsFp*` 键)**

照 §i18n 全表把 `settingsFpIntro` … `settingsFpAddFolder` 共 23 个键**同时**加进 `src/i18n/zh_cn.sp9.ts` 与 `src/i18n/en_us.sp9.ts`。**中文逐字节照抄表格,标点不许改。**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm vitest run src/i18n/parity.test.ts 2>&1 | tail -5
```
Expected: PASS。

- [ ] **Step 6: 写失败的测试(面板)**

`src/settings/panels/FolderPermissionsPanel.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn.sp9'
import FolderPermissionsPanel from './FolderPermissionsPanel.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function mountPanel() {
  return mount(FolderPermissionsPanel, { global: { plugins: [i18n] } })
}

describe('FolderPermissionsPanel —— 政策三「做样子」', () => {
  it('顶部有 Vue2 原文说明 + 本期新增的「数据源待接入」说明条', async () => {
    const w = mountPanel()
    await w.vm.$nextTick()
    expect(w.text()).toContain(zh.settingsFpIntro)
    expect(w.find('[data-test="fp-pending"]').exists()).toBe(true)
    expect(w.text()).toContain(zh.settingsFpDataPending)
  })

  it('四个分区都在，标题与 Vue2 一致（C3：四分区，不是矩阵）', async () => {
    const w = mountPanel()
    await w.vm.$nextTick()
    const titles = w.findAll('.set-fp-title').map((n) => n.text())
    expect(titles).toEqual([
      zh.settingsFpFilenameIndex,
      zh.settingsFpKnowledge,
      zh.settingsFpAiHidden,
      zh.settingsFpPhotos,
    ])
  })

  it('每个分区都有 Vue2 的说明文字', async () => {
    const w = mountPanel()
    await w.vm.$nextTick()
    for (const k of ['settingsFpFilenameDesc', 'settingsFpKnowledgeDesc', 'settingsFpAiDesc', 'settingsFpPhotosDesc'] as const) {
      expect(w.text()).toContain(zh[k])
    }
  })

  it('AI 分区带「仅当前用户」徽标（Vue2 L87-89 无条件渲染）', async () => {
    const w = mountPanel()
    await w.vm.$nextTick()
    expect(w.text()).toContain(zh.settingsFpCurrentUserOnly)
  })

  it('空快照四路离线 → 四个分区都显示「服务离线」徽标', async () => {
    const w = mountPanel()
    await w.vm.$nextTick()
    expect(w.findAll('[data-test="fp-offline"]')).toHaveLength(4)
    expect(w.text()).toContain(zh.settingsFpServiceOffline)
  })

  it('离线时不渲染任何「添加文件夹」按钮（Vue2 v-if="offline" 走徽标分支）', async () => {
    const w = mountPanel()
    await w.vm.$nextTick()
    expect(w.findAll('[data-test^="fp-add-"]')).toHaveLength(0)
  })

  it('刷新按钮存在且可点，但不会触发任何写操作', async () => {
    const w = mountPanel()
    await w.vm.$nextTick()
    const btn = w.find('[data-test="fp-refresh"]')
    expect(btn.exists()).toBe(true)
    expect(btn.attributes('disabled')).toBeUndefined()
    await btn.trigger('click')
    await w.vm.$nextTick()
    // 仍然是四路离线的空快照，没有异常冒泡
    expect(w.findAll('[data-test="fp-offline"]')).toHaveLength(4)
  })

  it('本期一个开关都不渲染 —— 写操作禁用（政策三）', async () => {
    const w = mountPanel()
    await w.vm.$nextTick()
    expect(w.findAll('input[type="checkbox"]')).toHaveLength(0)
  })
})
```

> **为什么不写「开关点了不生效」那种用例**:空快照四路 offline，Vue2 在 offline 分支里**根本不渲染列表和开关**，所以「开关只读」在本期的正确形态是**开关不存在**。写「点开关不发请求」会是空转用例(B3)——那个开关压根不在 DOM 里。等 D11 接线后由那期补 disabled 断言。

- [ ] **Step 7: 跑测试确认失败**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm vitest run src/settings/panels/FolderPermissionsPanel.test.ts 2>&1 | tail -12
```

- [ ] **Step 8: 实现面板**

`src/settings/panels/FolderPermissionsPanel.vue` 整体重写:

```vue
<script setup lang="ts">
// 设置 · 文件夹权限。1:1 对位 Vue2 NimoOS-UI/src/components/settings/FolderPermissions.vue(337 行)。
//
// ⚠️ **spec §5.7 把这块写成「权限矩阵(表头 / 行 / 各子系统列的开关)」,与源码不符** ——
// Vue2 实际是**四个纵向堆叠的分区**(文件名索引 / 知识库 / 禁止 AI 访问的文件夹 / 照片),
// 各自一份列表,没有矩阵表头也没有列。按 P0 先例「spec 与源码出入时以源码为准、界面严格 1:1」
// 照源码做四分区(plan C3)。
//
// ⚠️ 本期按 spec §3.1 **政策三**只做界面骨架:数据源是 folderPermissionsSnapshot.ts 的空实现
// (四路全 offline),写操作禁用。合并 sp7/sp8 后只换那个文件里的两个函数(债务 D11)。
// 空快照四路 offline 正好复用 Vue2 的「服务离线」形态,不另造空态。
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SettingsSection from '../components/SettingsSection.vue'
import FolderPickerDialog from './folderPerm/FolderPickerDialog.vue'
import { type FolderPermSnapshot } from '../util/folderPermissions'
import { emptySnapshot, fetchSnapshot, WIRED } from '../util/folderPermissionsSnapshot'
import {
  aiItems, knowledgeExcludeItems, knowledgeRootItems, photosItems, searchItems,
} from '../util/folderPermissionsView'
import { pickerRoots } from '../util/folderBrowser'
import '../styles/settings.css'

const { t } = useI18n()

const snap = ref<FolderPermSnapshot>(emptySnapshot())
const loading = ref(false)

// 就地过期守卫(不抽公共 helper —— 评审判定过早抽象,plan C8)。本面板**确实有第二个触发点**
// (刷新按钮),所以守卫不是空转:快速连点刷新 / 点完立刻切 tab 时,后落定的那次不许回写。
let alive = true
let seq = 0
onUnmounted(() => { alive = false })

async function reload() {
  const mySeq = ++seq
  loading.value = true
  try {
    const s = await fetchSnapshot()
    if (!alive || mySeq !== seq) return
    snap.value = s
  } finally {
    if (alive && mySeq === seq) loading.value = false
  }
}
onMounted(reload)

const offline = computed(() => snap.value.offline)
const photosAuto = computed(() => snap.value.photos.auto && !snap.value.photos.stale)
const photosStale = computed(() => snap.value.photos.stale)
const lists = computed(() => ({
  search: searchItems(snap.value),
  knowledgeRoots: knowledgeRootItems(snap.value),
  knowledgeExcludes: knowledgeExcludeItems(snap.value),
  ai: aiItems(snap.value),
  photos: photosItems(snap.value),
}))
const browserRoots = computed(() => pickerRoots(snap.value.candidates))

// 添加弹窗:本期只开得起来、确认按钮恒 disabled(政策三)。target 保留 Vue2 的 5 种取值,
// 接线时直接照 Vue2 confirmAdd() 的分流写。
type AddTarget = 'search' | 'knowledge-root' | 'knowledge-exclude' | 'ai' | 'photos'
const adding = ref(false)
const addTarget = ref<AddTarget>('search')
function openAdd(target: AddTarget) {
  addTarget.value = target
  adding.value = true
}
const addTitle = computed(() =>
  addTarget.value === 'knowledge-exclude' ? t('settingsFpAddExclusion') : t('settingsFpAddFolder'),
)
</script>

<template>
  <SettingsSection :title="t('settingsTabFolderPermissions')">
    <!-- 顶部:Vue2 L3-8 的说明 + 刷新按钮 -->
    <div class="set-fp-head">
      <p class="set-fp-intro">{{ t('settingsFpIntro') }}</p>
      <button class="set-btn" type="button" data-test="fp-refresh" :disabled="loading" @click="reload">
        ⟳
      </button>
    </div>

    <!-- 本期新增(Vue2 没有):政策三要求在界面上标注数据源留空 -->
    <p v-if="!WIRED" class="set-info" data-test="fp-pending">{{ t('settingsFpDataPending') }}</p>

    <!-- ① 文件名索引 (Vue2 L10-36) -->
    <div class="set-fp-box">
      <div class="set-fp-box-head">
        <span class="set-fp-title">{{ t('settingsFpFilenameIndex') }}</span>
        <span v-if="offline.search" class="set-fp-tag" data-test="fp-offline">{{ t('settingsFpServiceOffline') }}</span>
        <button v-else class="set-btn" type="button" data-test="fp-add-search" @click="openAdd('search')">
          + {{ t('settingsFpAddFolder') }}
        </button>
      </div>
      <p class="set-fp-desc">{{ t('settingsFpFilenameDesc') }}</p>
      <template v-if="!offline.search">
        <div v-for="it in lists.search" :key="`s-${it.path}`" class="set-fp-item">
          <span class="set-fp-path">{{ it.path }}</span>
          <span v-if="it.coveredBy" class="set-fp-tag">{{ t('settingsFpCoveredBy', { p: it.coveredBy }) }}</span>
        </div>
        <p v-if="!lists.search.length" class="set-fp-empty">{{ t('settingsFpNoFolders') }}</p>
      </template>
    </div>

    <!-- ② 知识库 (Vue2 L38-81) -->
    <div class="set-fp-box">
      <div class="set-fp-box-head">
        <span class="set-fp-title">{{ t('settingsFpKnowledge') }}</span>
        <span v-if="offline.knowledge" class="set-fp-tag" data-test="fp-offline">{{ t('settingsFpServiceOffline') }}</span>
      </div>
      <p class="set-fp-desc">{{ t('settingsFpKnowledgeDesc') }}</p>
      <template v-if="!offline.knowledge">
        <div class="set-fp-sub-head">
          <span class="set-fp-sub-title">{{ t('settingsFpIndexedFolders') }}</span>
          <button class="set-btn" type="button" data-test="fp-add-knowledge-root" @click="openAdd('knowledge-root')">
            + {{ t('settingsFpAddFolder') }}
          </button>
        </div>
        <div v-for="it in lists.knowledgeRoots" :key="`kr-${it.rootId}`" class="set-fp-item">
          <span class="set-fp-path">{{ it.path }}</span>
        </div>
        <p v-if="!lists.knowledgeRoots.length" class="set-fp-empty">{{ t('settingsFpNoFolders') }}</p>

        <div class="set-fp-sub-head">
          <span class="set-fp-sub-title">{{ t('settingsFpExcludedSubfolders') }}</span>
          <button class="set-btn" type="button" data-test="fp-add-knowledge-exclude" @click="openAdd('knowledge-exclude')">
            + {{ t('settingsFpAddExclusion') }}
          </button>
        </div>
        <div v-for="it in lists.knowledgeExcludes" :key="`ke-${it.id}`" class="set-fp-item">
          <span class="set-fp-path">{{ it.path }}</span>
        </div>
        <p v-if="!lists.knowledgeExcludes.length" class="set-fp-empty">{{ t('settingsFpNoExclusions') }}</p>
      </template>
    </div>

    <!-- ③ 禁止 AI 访问的文件夹 (Vue2 L83-115) -->
    <div class="set-fp-box">
      <div class="set-fp-box-head">
        <span class="set-fp-title">{{ t('settingsFpAiHidden') }}</span>
        <span class="set-fp-tag">{{ t('settingsFpCurrentUserOnly') }}</span>
        <span v-if="offline.ai" class="set-fp-tag" data-test="fp-offline">{{ t('settingsFpServiceOffline') }}</span>
        <button v-else class="set-btn" type="button" data-test="fp-add-ai" @click="openAdd('ai')">
          + {{ t('settingsFpAddFolder') }}
        </button>
      </div>
      <p class="set-fp-desc">{{ t('settingsFpAiDesc') }}</p>
      <template v-if="!offline.ai">
        <div v-for="it in lists.ai.items" :key="`a-${it.id}`" class="set-fp-item">
          <span class="set-fp-path">{{ it.path }}</span>
          <span v-if="it.coveredBy" class="set-fp-tag">{{ t('settingsFpCoveredBy', { p: it.coveredBy }) }}</span>
        </div>
        <p v-if="!lists.ai.items.length" class="set-fp-empty">{{ t('settingsFpNoAiBlocked') }}</p>
        <p v-if="lists.ai.globCount" class="set-fp-desc">
          {{ t('settingsFpGlobRules', { n: lists.ai.globCount }) }}
        </p>
      </template>
    </div>

    <!-- ④ 照片 (Vue2 L117-155) -->
    <div class="set-fp-box">
      <div class="set-fp-box-head">
        <span class="set-fp-title">{{ t('settingsFpPhotos') }}</span>
        <span v-if="offline.photos" class="set-fp-tag" data-test="fp-offline">{{ t('settingsFpServiceOffline') }}</span>
        <span v-else-if="photosStale" class="set-fp-tag">{{ t('settingsFpUpdateRequired') }}</span>
        <button v-else-if="!photosAuto" class="set-btn" type="button" data-test="fp-add-photos" @click="openAdd('photos')">
          + {{ t('settingsFpAddFolder') }}
        </button>
      </div>
      <p class="set-fp-desc">{{ t('settingsFpPhotosDesc') }}</p>
      <template v-if="!offline.photos && !photosStale">
        <p v-if="photosAuto" class="set-info">{{ t('settingsFpPhotosAuto') }}</p>
        <div v-for="it in lists.photos" :key="`p-${it.path}`" class="set-fp-item">
          <span class="set-fp-path">{{ it.path }}</span>
          <span v-if="it.coveredBy" class="set-fp-tag">{{ t('settingsFpCoveredBy', { p: it.coveredBy }) }}</span>
        </div>
        <p v-if="!lists.photos.length" class="set-fp-empty">{{ t('settingsFpNoFolders') }}</p>
      </template>
      <p v-else-if="photosStale" class="set-fp-desc">{{ t('settingsFpPhotosStale') }}</p>
    </div>

    <FolderPickerDialog v-model:open="adding" :title="addTitle" :roots="browserRoots" />
  </SettingsSection>
</template>
```

> **列表行里为什么没有删除按钮/开关**:Vue2 的删除按钮与开关都在 `!offline` 分支内,而本期四路恒 offline → 那些行本来就渲染不出来。**接线时(D11)要补回去**:`search`/`photos` 行的删除按钮(`run(path, col, false)`)、`knowledgeRoots` 行的开关(`run(path,'knowledge',v)`)、`knowledgeExcludes` 行的删除(`removeDenyRule(it.id)`)、`ai` 行的删除(`run(path,'ai',true)`)、以及 photosAuto 时的「转为手动管理」按钮(`materialize()`)。这一段照 Vue2 L25-31 / L56-79 / L101-113 / L138-150 抄即可,已在上面模板里留好位置。

- [ ] **Step 9: 加样式**

`src/settings/styles/settings.css` 追加(**颜色只用 token,C4**):

```css
/* ── SP9-P4 folder-permissions(四分区) ───────────────────────────────── */
.set-fp-head { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.set-fp-intro { flex: 1; margin: 0; font-size: 13px; color: var(--fg-muted); }
.set-fp-box { padding: 16px; margin-bottom: 12px; border-radius: 12px; background: var(--card-bg); border: 1px solid var(--card-border); }
.set-fp-box-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.set-fp-title { flex: 1; font-weight: 600; font-size: 14px; color: var(--fg); }
.set-fp-desc { margin: 0 0 8px; font-size: 13px; color: var(--fg-muted); }
.set-fp-sub-head { display: flex; align-items: center; gap: 8px; margin: 12px 0 4px; }
.set-fp-sub-title { flex: 1; font-size: 13px; font-weight: 600; color: var(--fg); }
.set-fp-item { display: flex; align-items: center; gap: 8px; padding: 4px 0; }
.set-fp-item + .set-fp-item { border-top: 1px dashed var(--card-border); }
.set-fp-path { flex: 1; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--fg); }
.set-fp-tag { flex-shrink: 0; padding: 2px 8px; border-radius: 999px; font-size: 12px; background: var(--chip-bg); border: 1px solid var(--chip-border); color: var(--fg-muted); }
.set-fp-empty { margin: 0; font-size: 13px; color: var(--fg-muted); }
```

⚠️ 先 `grep -n "\-\-card-bg\|--chip-bg\|--fg-muted\|--card-border\|--chip-border" src/styles/theme.css src/styles/theme.sp9.css` 确认这 5 个 token 都已存在;**缺哪个就在 `theme.sp9.css` 的两套主题块里都补上**(C4),不要就地写字面量。

- [ ] **Step 10: 跑三门**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm test 2>&1 | tail -6 && pnpm exec vue-tsc --noEmit && pnpm build 2>&1 | tail -3
```
Expected: 全绿。文件数 +5(3 个 test + color-guard 对 2 个新 `.vue`/`.css` 的动态用例见 B2)。

- [ ] **Step 11: Commit**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git add src/settings/util/folderPermissionsSnapshot.ts src/settings/util/folderPermissionsSnapshot.test.ts src/settings/panels/FolderPermissionsPanel.vue src/settings/panels/FolderPermissionsPanel.test.ts src/settings/styles/settings.css src/i18n/zh_cn.sp9.ts src/i18n/en_us.sp9.ts
git commit -m "feat(settings): folder-permissions 四分区界面骨架（数据源留空、写操作禁用，债务 D11）" -- src/settings/util/folderPermissionsSnapshot.ts src/settings/util/folderPermissionsSnapshot.test.ts src/settings/panels/FolderPermissionsPanel.vue src/settings/panels/FolderPermissionsPanel.test.ts src/settings/styles/settings.css src/i18n/zh_cn.sp9.ts src/i18n/en_us.sp9.ts
git log --name-only -1 | grep -c design-export   # 必须是 0
```

---

## Task 4: `FolderPickerDialog.vue` —— 添加文件夹弹窗(本期确认恒禁用)

**Files:**
- Create: `src/settings/panels/folderPerm/FolderPickerDialog.vue`
- Create: `src/settings/panels/folderPerm/FolderPickerDialog.test.ts`

**移植源:** Vue2 `FolderPermissions.vue` L157-174 的 `b-modal` + `components/common/FolderBrowser.vue`(143 行)。

**Interfaces:**
- Consumes: Task 2 的 `crumbsFor` / `dirEntries` / `PickerRoot`;`ui/Dialog.vue`。
- Produces: `<FolderPickerDialog v-model:open :title :roots />`(Task 3 已按这个签名接)。

- [ ] **Step 1: 写失败的测试**

`src/settings/panels/folderPerm/FolderPickerDialog.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn.sp9'
import FolderPickerDialog from './FolderPickerDialog.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

const ROOTS = [
  { path: '/DATA', label: 'System (/DATA)' },
  { path: '/media', label: '/media' },
  { path: '/mnt', label: '/mnt' },
]

// B4:Dialog 经 reka DialogPortal teleport → 必须 attachTo body 并查 document。
function mountDialog(open = true) {
  return mount(FolderPickerDialog, {
    props: { open, title: zh.settingsFpAddFolder, roots: ROOTS },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
}

describe('FolderPickerDialog', () => {
  it('关闭时不渲染任何内容', () => {
    mountDialog(false)
    expect(document.querySelector('[data-test="fp-picker-body"]')).toBeNull()
  })

  it('打开时列出三个内置根（本期候选恒空 → pickerRoots 的回退形态）', async () => {
    const w = mountDialog()
    await w.vm.$nextTick()
    const labels = [...document.querySelectorAll('[data-test="fp-picker-root"]')].map((n) => n.textContent?.trim())
    expect(labels).toEqual(['System (/DATA)', '/media', '/mnt'])
  })

  it('标题透传', async () => {
    const w = mountDialog()
    await w.vm.$nextTick()
    expect(document.querySelector('.ui-dialog-title')?.textContent).toBe(zh.settingsFpAddFolder)
  })

  it('手输框存在，且带 .set-net-field 容器（C7：否则吃到 .set-input 的 92px）', async () => {
    const w = mountDialog()
    await w.vm.$nextTick()
    const field = document.querySelector('[data-test="fp-picker-field"]')
    expect(field).not.toBeNull()
    expect(field?.classList.contains('set-net-field')).toBe(true)
    expect(field?.querySelector('input')).not.toBeNull()
  })

  it('本期「添加」按钮恒 disabled —— 政策三写操作禁用（B6：断属性，不 trigger）', async () => {
    const w = mountDialog()
    await w.vm.$nextTick()
    const add = document.querySelector('[data-test="fp-picker-add"]') as HTMLButtonElement
    expect(add).not.toBeNull()
    expect(add.disabled).toBe(true)
  })

  it('即便输入了合法绝对路径，「添加」仍然 disabled', async () => {
    const w = mountDialog()
    await w.vm.$nextTick()
    const input = document.querySelector('[data-test="fp-picker-field"] input') as HTMLInputElement
    input.value = '/DATA/Docs'
    input.dispatchEvent(new Event('input'))
    await w.vm.$nextTick()
    expect((document.querySelector('[data-test="fp-picker-add"]') as HTMLButtonElement).disabled).toBe(true)
  })

  it('取消按钮把 open 置回 false', async () => {
    const w = mountDialog()
    await w.vm.$nextTick()
    ;(document.querySelector('[data-test="fp-picker-cancel"]') as HTMLButtonElement).click()
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('重新打开会清掉上次输入的路径（Vue2 openAdd 每次重置 newPath）', async () => {
    const w = mountDialog(false)
    await w.setProps({ open: true })
    await w.vm.$nextTick()
    const input = document.querySelector('[data-test="fp-picker-field"] input') as HTMLInputElement
    input.value = '/DATA/X'
    input.dispatchEvent(new Event('input'))
    await w.vm.$nextTick()
    await w.setProps({ open: false })
    await w.setProps({ open: true })
    await w.vm.$nextTick()
    expect((document.querySelector('[data-test="fp-picker-field"] input') as HTMLInputElement).value).toBe('')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm vitest run src/settings/panels/folderPerm/FolderPickerDialog.test.ts 2>&1 | tail -12
```

- [ ] **Step 3: 实现**

`src/settings/panels/folderPerm/FolderPickerDialog.vue`:

```vue
<script setup lang="ts">
// folder-permissions 的「添加文件夹 / 添加排除」弹窗。
// 对位 Vue2 FolderPermissions.vue L157-174(b-modal + FolderBrowser + 手输框)。
//
// ⚠️ 本期(SP9-P4)按政策三:**弹窗打得开、选择器和手输框都在,但「添加」按钮恒 disabled**,
// 不触发任何写操作。接线时(债务 D11)去掉 `:disabled="true"`、把 confirm 事件接到
// FolderPermissionsPanel 的 run()/confirmAdd() 上即可,界面不用重做。
//
// ⚠️ 本期 roots 恒为 pickerRoots([]) 的回退三根(/DATA、/media、/mnt),因为快照的
// candidates 是空的(那份数据来自 wiki.getCandidates,wiki 域挂账 = 债务 D12)。
// 点根进不去下一层 —— 目录列举要 folder.getList,那是接线时的事,本期不发请求。
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Dialog from '../../../components/ui/Dialog.vue'
import type { PickerRoot } from '../../util/folderBrowser'
import '../../styles/settings.css'

const props = defineProps<{ open: boolean; title: string; roots: PickerRoot[] }>()
const emit = defineEmits<{ 'update:open': [boolean] }>()

const newPath = ref('')

// Vue2 openAdd() 每次打开都重置 newPath —— 照抄这个行为(不让上次输入残留)。
watch(() => props.open, (v) => { if (v) newPath.value = '' })
const { t } = useI18n()
</script>

<template>
  <Dialog :open="open" :title="title" @update:open="emit('update:open', $event)">
    <div data-test="fp-picker-body">
      <div class="set-fp-picker-roots">
        <button
          v-for="r in roots" :key="r.path"
          class="set-fp-picker-root" type="button" data-test="fp-picker-root"
          disabled
        >{{ r.label }}</button>
      </div>
      <div class="set-net-field" data-test="fp-picker-field">
        <input v-model="newPath" class="set-input" type="text" placeholder="/DATA">
      </div>
    </div>
    <template #footer>
      <button class="ui-btn" type="button" data-test="fp-picker-cancel" @click="emit('update:open', false)">
        {{ t('settingsCancel') }}
      </button>
      <!-- 政策三:本期恒禁用。接线时改成 :disabled="!newPath.startsWith('/')"(Vue2 L169)。 -->
      <button class="ui-btn" type="button" data-test="fp-picker-add" disabled>
        {{ t('settingsFpAddFolder') }}
      </button>
    </template>
  </Dialog>
</template>

<style scoped>
.set-fp-picker-roots { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
.set-fp-picker-root {
  padding: 8px 12px; border-radius: 10px; font-size: 13px; cursor: not-allowed;
  background: var(--chip-bg); border: 1px solid var(--chip-border); color: var(--fg-muted);
}
</style>
```

- [ ] **Step 4: 跑测试确认通过 + 三门**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm vitest run src/settings/panels/folderPerm/FolderPickerDialog.test.ts 2>&1 | tail -6
pnpm test 2>&1 | tail -6 && pnpm exec vue-tsc --noEmit && pnpm build 2>&1 | tail -3
```

- [ ] **Step 5: Commit**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git add src/settings/panels/folderPerm/FolderPickerDialog.vue src/settings/panels/folderPerm/FolderPickerDialog.test.ts
git commit -m "feat(settings): folder-permissions 添加文件夹弹窗（本期确认恒禁用）" -- src/settings/panels/folderPerm/FolderPickerDialog.vue src/settings/panels/folderPerm/FolderPickerDialog.test.ts
```

---
## Task 5: account 的三个纯逻辑 util

**Files:**
- Create: `src/settings/util/memberFormat.ts` + `.test.ts`
- Create: `src/settings/util/avatar.ts` + `.test.ts`
- Create: `src/settings/util/nasStorages.ts` + `.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // memberFormat.ts
  export function formatMemberDate(dateStr: string | null | undefined): string
  export type NewMemberError = 'empty' | 'tooShort' | 'mismatch' | null
  export function validateNewMember(username: string, password: string, confirmation: string): NewMemberError

  // avatar.ts
  export function readAccessToken(): string | null
  export function isAllowedImageFile(name: string, mime: string): boolean

  // nasStorages.ts
  export interface NasStorage { name: string; path: string; avail: number | null; size: number | null }
  export function buildNasStorages(rawStorage: unknown, rawRaid: unknown, displayNames: Record<string, string>): NasStorage[]
  export function nasBreadcrumbs(nasPath: string, nasRootPath: string, displayNames: Record<string, string>): { name: string; path: string }[]
  export function nasNavigateUpTarget(nasPath: string, nasRootPath: string): string | null
  export function isPickableImage(name: string): boolean
  export function filterNasItems(content: unknown): { name: string; path: string; is_dir: boolean }[]
  ```

- [ ] **Step 1: 写失败的测试 —— memberFormat**

`src/settings/util/memberFormat.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { formatMemberDate, validateNewMember } from './memberFormat'

describe('formatMemberDate —— 1:1 对位 Vue2 AccountPanel formatDate(:538-543)', () => {
  it('本地时间 YYYY-MM-DD HH:mm:ss，各段补零', () => {
    // 用本地时间构造，避免测试机时区把断言弄成薛定谔
    const d = new Date(2026, 6, 3, 4, 5, 6) // 2026-07-03 04:05:06 本地
    expect(formatMemberDate(d.toISOString())).toBe('2026-07-03 04:05:06')
  })
  it('空值返回空串（Vue2 !dateStr 早退）', () => {
    expect(formatMemberDate('')).toBe('')
    expect(formatMemberDate(null)).toBe('')
    expect(formatMemberDate(undefined)).toBe('')
  })
  it('Go 零值时间不炸（后端 created_at 可能是 0001-01-01T00:00:00Z）', () => {
    expect(formatMemberDate('0001-01-01T00:00:00Z')).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  })
  it('无法解析的串返回空串（Vue2 会渲染 NaN-NaN-NaN，这是照 plan C1 改正的行为）', () => {
    expect(formatMemberDate('not-a-date')).toBe('')
  })
})

describe('validateNewMember —— 1:1 对位 Vue2 submitAddMember(:493-506)', () => {
  it('用户名或密码为空 → empty', () => {
    expect(validateNewMember('', 'pw1234', 'pw1234')).toBe('empty')
    expect(validateNewMember('bob', '', '')).toBe('empty')
  })
  it('密码短于 6 位 → tooShort', () => {
    expect(validateNewMember('bob', 'pw123', 'pw123')).toBe('tooShort')
  })
  it('刚好 6 位放过', () => {
    expect(validateNewMember('bob', 'pw1234'.slice(0, 6), 'pw1234'.slice(0, 6))).toBeNull()
  })
  it('两次密码不一致 → mismatch', () => {
    expect(validateNewMember('bob', 'pw1234', 'pw4321')).toBe('mismatch')
  })
  it('校验顺序与 Vue2 一致：空 > 长度 > 一致性', () => {
    // 空且短且不一致 → 仍报 empty
    expect(validateNewMember('bob', '', 'x')).toBe('empty')
    // 短且不一致 → 报 tooShort
    expect(validateNewMember('bob', 'ab', 'cd')).toBe('tooShort')
  })
})
```

- [ ] **Step 2: 写失败的测试 —— avatar**

`src/settings/util/avatar.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { isAllowedImageFile, readAccessToken } from './avatar'

describe('readAccessToken', () => {
  beforeEach(() => localStorage.clear())
  it('读 localStorage 的 access_token', () => {
    localStorage.setItem('access_token', 'abc')
    expect(readAccessToken()).toBe('abc')
  })
  it('没有则返回 null（<img> 会拿到不带 token 的 URL；localhost 免鉴权时仍然通）', () => {
    expect(readAccessToken()).toBeNull()
  })
})

describe('isAllowedImageFile —— 1:1 对位 Vue2 onFileSelected(:252-259)', () => {
  it('mime 命中即通过', () => {
    expect(isAllowedImageFile('whatever.bin', 'image/png')).toBe(true)
  })
  it('mime 不命中但扩展名命中也通过（Vue2 是 || 关系）', () => {
    expect(isAllowedImageFile('photo.WEBP', 'application/octet-stream')).toBe(true)
  })
  it('两者都不命中则拒绝', () => {
    expect(isAllowedImageFile('doc.pdf', 'application/pdf')).toBe(false)
  })
  it('扩展名大小写不敏感', () => {
    expect(isAllowedImageFile('a.JPG', '')).toBe(true)
  })
  it('无扩展名且无 mime 时拒绝', () => {
    expect(isAllowedImageFile('noext', '')).toBe(false)
  })
  it('六种扩展名与五种 mime 与 Vue2 逐字一致', () => {
    for (const e of ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']) {
      expect(isAllowedImageFile(`x.${e}`, '')).toBe(true)
    }
    for (const m of ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp']) {
      expect(isAllowedImageFile('x.zzz', m)).toBe(true)
    }
    // Vue2 的 allowedExts 有 6 项、allowedMimes 只有 5 项(没有 image/bmp 之外的)——
    // 注意 svg 不在任何一份名单里
    expect(isAllowedImageFile('x.svg', 'image/svg+xml')).toBe(false)
  })
})
```

- [ ] **Step 3: 写失败的测试 —— nasStorages**

`src/settings/util/nasStorages.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  buildNasStorages, filterNasItems, isPickableImage,
  nasBreadcrumbs, nasNavigateUpTarget,
} from './nasStorages'

describe('buildNasStorages —— 1:1 对位 Vue2 loadNasStorages(:273-319) 的纯派生部分', () => {
  const STORAGE = [
    { path: '/dev/nvme0n1', type: 'internal', children: [
      { mount_point: '/DATA', label: 'sys', drive_name: 'nvme0n1p7', size: '100', avail: '40' },
      { mount_point: '/mnt/Extra', label: 'Extra', drive_name: 'nvme0n1p8', size: '200', avail: '150' },
    ] },
    { path: '/dev/sdb', type: 'usb', children: [
      { mount_point: '/media/USB', label: 'USB', drive_name: 'sdb1', size: '10', avail: '5' },
    ] },
  ]
  const RAID = [{ name: 'md0', mount_point: '/mnt/Raid' }]

  it('/DATA 恒排第一，且名字取 displayNames，size/avail 是 null', () => {
    const out = buildNasStorages(STORAGE, RAID, { '/DATA': 'NimoOS-HD' })
    expect(out[0]).toEqual({ name: 'NimoOS-HD', path: '/DATA', avail: null, size: null })
  })

  it('displayNames 缺 /DATA 时回退成写死的 NimoOS-HD（Vue2 :288）', () => {
    expect(buildNasStorages([], [], {})[0].name).toBe('NimoOS-HD')
  })

  it('usb 类型的整块磁盘被跳过', () => {
    const paths = buildNasStorages(STORAGE, RAID, {}).map((s) => s.path)
    expect(paths).not.toContain('/media/USB')
  })

  it('RAID 挂载点的分区不重复出现在普通分区里，只以 RAID 身份出现一次', () => {
    const withRaidPart = [{ path: '/dev/md0', type: 'internal', children: [
      { mount_point: '/mnt/Raid', label: 'r', drive_name: 'md0', size: '9', avail: '9' },
    ] }]
    const out = buildNasStorages(withRaidPart, RAID, {})
    expect(out.filter((s) => s.path === '/mnt/Raid')).toHaveLength(1)
    expect(out.find((s) => s.path === '/mnt/Raid')).toEqual({ name: 'md0', path: '/mnt/Raid', avail: null, size: null })
  })

  it('/DATA 不会因为在 children 里再被加一次（Vue2 :296 的显式跳过）', () => {
    const out = buildNasStorages(STORAGE, RAID, {})
    expect(out.filter((s) => s.path === '/DATA')).toHaveLength(1)
  })

  it('普通分区的 size/avail 从字符串转数字（/v1/storage 返回的是字符串）', () => {
    const extra = buildNasStorages(STORAGE, RAID, {}).find((s) => s.path === '/mnt/Extra')
    expect(extra).toEqual({ name: 'Extra', path: '/mnt/Extra', avail: 150, size: 200 })
  })

  it('分区名优先 displayNames > label > drive_name', () => {
    const named = buildNasStorages(STORAGE, [], { '/mnt/Extra': '我的盘' }).find((s) => s.path === '/mnt/Extra')
    expect(named?.name).toBe('我的盘')
    const noLabel = [{ path: '/d', type: 'x', children: [{ mount_point: '/mnt/A', drive_name: 'sda1', size: '1', avail: '1' }] }]
    expect(buildNasStorages(noLabel, [], {}).find((s) => s.path === '/mnt/A')?.name).toBe('sda1')
  })

  it('非数组入参一律当空处理（后端 nil slice）', () => {
    expect(buildNasStorages(null, null, {})).toHaveLength(1) // 只剩 /DATA
    expect(buildNasStorages(undefined, undefined, {})).toHaveLength(1)
  })

  it('没有 mount_point 的 RAID 不进列表（Vue2 :305 的 filter）', () => {
    const out = buildNasStorages([], [{ name: 'md1' }], {})
    expect(out.map((s) => s.name)).toEqual(['NimoOS-HD'])
  })
})

describe('nasBreadcrumbs —— 1:1 对位 Vue2 computed nasBreadcrumbs(:148-163)', () => {
  it('只在根时只有一个 crumb，名字取虚拟名去掉前导斜杠', () => {
    expect(nasBreadcrumbs('/DATA', '/DATA', { '/DATA': 'NimoOS-HD' })).toEqual([
      { name: 'NimoOS-HD', path: '/DATA' },
    ])
  })
  it('逐段累加子路径', () => {
    expect(nasBreadcrumbs('/DATA/a/b', '/DATA', { '/DATA': 'NimoOS-HD' })).toEqual([
      { name: 'NimoOS-HD', path: '/DATA' },
      { name: 'a', path: '/DATA/a' },
      { name: 'b', path: '/DATA/a/b' },
    ])
  })
  it('displayNames 没映射时根名回退成真实路径（Vue2 :152 的 || nasRootPath）', () => {
    expect(nasBreadcrumbs('/mnt/X', '/mnt/X', {})[0].name).toBe('mnt/X')
  })
  it('路径或根为空时返回空数组', () => {
    expect(nasBreadcrumbs('', '/DATA', {})).toEqual([])
    expect(nasBreadcrumbs('/DATA', '', {})).toEqual([])
  })
})

describe('nasNavigateUpTarget —— 1:1 对位 Vue2 nasNavigateUp(:347-352)', () => {
  it('已在根时返回 null（Vue2 直接 return，不发请求）', () => {
    expect(nasNavigateUpTarget('/DATA', '/DATA')).toBeNull()
    expect(nasNavigateUpTarget('', '/DATA')).toBeNull()
  })
  it('回到父目录', () => {
    expect(nasNavigateUpTarget('/DATA/a/b', '/DATA')).toBe('/DATA/a')
  })
  it('不会越过根往上（父目录比根短时夹回根）', () => {
    expect(nasNavigateUpTarget('/mnt/X/y', '/mnt/X')).toBe('/mnt/X')
  })
})

describe('isPickableImage / filterNasItems —— 1:1 对位 Vue2 loadNasFolder(:333-337)', () => {
  it('六种图片扩展名可选，大小写不敏感', () => {
    for (const n of ['a.jpg', 'a.JPEG', 'a.png', 'a.gif', 'a.webp', 'a.BMP']) {
      expect(isPickableImage(n)).toBe(true)
    }
  })
  it('非图片不可选', () => {
    expect(isPickableImage('a.txt')).toBe(false)
    expect(isPickableImage('a.svg')).toBe(false)
    expect(isPickableImage('jpg')).toBe(false)       // 没有点
  })
  it('filterNasItems 留下所有目录 + 图片文件，滤掉隐藏项', () => {
    const content = [
      { name: 'dir', path: '/p/dir', is_dir: true },
      { name: '.git', path: '/p/.git', is_dir: true },
      { name: 'a.png', path: '/p/a.png', is_dir: false },
      { name: 'b.txt', path: '/p/b.txt', is_dir: false },
      { name: '.hidden.png', path: '/p/.hidden.png', is_dir: false },
    ]
    expect(filterNasItems(content).map((i) => i.name)).toEqual(['dir', 'a.png'])
  })
  it('非数组入参 → 空数组', () => {
    expect(filterNasItems(null)).toEqual([])
  })
})
```

- [ ] **Step 4: 跑三个测试确认失败**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm vitest run src/settings/util/memberFormat.test.ts src/settings/util/avatar.test.ts src/settings/util/nasStorages.test.ts 2>&1 | tail -12
```

- [ ] **Step 5: 实现 memberFormat.ts**

```ts
/* account tab 的两个纯函数。移植源 Vue2 NimoOS-UI/src/components/account/AccountPanel.vue。 */

/** 成员行/授权行的时间格式化。1:1 对位 Vue2 formatDate(:538-543):
 *  本地时区、`YYYY-MM-DD HH:mm:ss`、各段补零。
 *  ⚠️ **不用仓内的 files/util/format.ts 的 dateFmt** —— 那个是 Intl 相对格式
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
```

- [ ] **Step 6: 实现 avatar.ts**

```ts
/* 头像相关的纯 helper。 */

/** 取 access_token。
 *  🔧 plan C13:Vue2 的 avatarUrl 写的是 `this.$store.state.token || localStorage.getItem('access_token')`,
 *  而 Vuex 里存的键叫 `access_token`(`state.token` 从来不存在)—— 第一段恒 undefined,
 *  一直是靠后面那个兜住的。这里直接读 localStorage,不复刻那段无效表达式。 */
export function readAccessToken(): string | null {
  return localStorage.getItem('access_token')
}

// Vue2 onFileSelected(:253-254) 的两份名单,逐字照抄(注意 svg 不在名单里)。
const ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp']

/** 本地选文件时的类型闸门。1:1 对位 Vue2 :255(mime 命中 **或** 扩展名命中即通过)。 */
export function isAllowedImageFile(name: string, mime: string): boolean {
  if (ALLOWED_MIMES.includes(mime)) return true
  const dot = name.lastIndexOf('.')
  if (dot < 0) return false
  return ALLOWED_EXTS.includes(name.slice(dot + 1).toLowerCase())
}
```

- [ ] **Step 7: 实现 nasStorages.ts**

```ts
/* 「从 NAS 选择头像」的纯派生。移植源 Vue2 AccountPanel.vue 的
 * loadNasStorages(:273-319,只取纯派生部分)/ nasBreadcrumbs(:148-163)/
 * nasNavigateUp(:347-352)/ loadNasFolder 的过滤(:333-337)。
 *
 * ⚠️ 不复用 storage/util/storageMap.ts 的 mapVolumes:那个不认整块磁盘的
 * `type === 'usb'`(RawGroup 里没有 type 字段),也没有「/DATA 恒排第一」的行为,
 * 而这两条都是本界面可见的 1:1 要求。
 */
import { toVirtualPath } from '../../files/util/pathUtils'

export interface NasStorage { name: string; path: string; avail: number | null; size: number | null }

interface RawPart { mount_point?: string; label?: string; drive_name?: string; size?: unknown; avail?: unknown }
interface RawDisk { type?: string; children?: RawPart[] }
interface RawRaid { name?: string; mount_point?: string }

export function buildNasStorages(
  rawStorage: unknown,
  rawRaid: unknown,
  displayNames: Record<string, string>,
): NasStorage[] {
  const disks = Array.isArray(rawStorage) ? (rawStorage as RawDisk[]) : []
  const raids = Array.isArray(rawRaid) ? (rawRaid as RawRaid[]) : []
  const raidMountPoints = new Set(raids.map((r) => r.mount_point).filter(Boolean) as string[])

  const out: NasStorage[] = []
  // Vue2 :286-292:NimoOS-HD 恒排第一,且不带容量(那一屏不显示系统盘的用量)。
  out.push({ name: displayNames['/DATA'] || 'NimoOS-HD', path: '/DATA', avail: null, size: null })

  for (const disk of disks) {
    for (const part of disk.children || []) {
      const mp = part.mount_point || ''
      if (disk.type === 'usb' || raidMountPoints.has(mp)) continue
      if (mp === '/DATA') continue // 上面已加
      out.push({
        name: displayNames[mp] || part.label || part.drive_name || '',
        path: mp,
        // /v1/storage 的 size/avail 是**字符串**;0 与空串都按「无容量信息」处理(Vue2 || null)
        avail: Number(part.avail) || null,
        size: Number(part.size) || null,
      })
    }
  }
  for (const raid of raids) {
    if (!raid.mount_point) continue
    out.push({ name: raid.name || '', path: raid.mount_point, avail: null, size: null })
  }
  return out
}

/** Vue2 computed nasBreadcrumbs(:148-163)。根 crumb 用虚拟名(去前导 `/`),
 *  无映射时回退真实路径(同样去前导 `/`)。 */
export function nasBreadcrumbs(
  nasPath: string,
  nasRootPath: string,
  displayNames: Record<string, string>,
): { name: string; path: string }[] {
  if (!nasPath || !nasRootPath) return []
  const rootVirtual = toVirtualPath(nasRootPath, displayNames)
  const rootName = rootVirtual.replace(/^\//, '') || nasRootPath
  const crumbs = [{ name: rootName, path: nasRootPath }]
  if (nasPath === nasRootPath) return crumbs
  const relative = nasPath.slice(nasRootPath.length)
  let acc = nasRootPath
  for (const seg of relative.split('/').filter(Boolean)) {
    acc += `/${seg}`
    crumbs.push({ name: seg, path: acc })
  }
  return crumbs
}

/** Vue2 nasNavigateUp(:347-352) 的目标计算。返回 null = 已在根,不该发请求。 */
export function nasNavigateUpTarget(nasPath: string, nasRootPath: string): string | null {
  if (!nasPath || nasPath === nasRootPath) return null
  const parent = nasPath.replace(/\/[^/]+$/, '') || nasRootPath
  return parent.length >= nasRootPath.length ? parent : nasRootPath
}

const IMAGE_RE = /\.(?:jpe?g|png|gif|webp|bmp)$/i

/** Vue2 :336 的图片判定(正则逐字一致)。 */
export function isPickableImage(name: string): boolean {
  return IMAGE_RE.test(name)
}

/** Vue2 :333-337:滤掉点开头的隐藏项,目录全留,文件只留图片。 */
export function filterNasItems(content: unknown): { name: string; path: string; is_dir: boolean }[] {
  const arr = Array.isArray(content) ? (content as { name?: string; path?: string; is_dir?: boolean }[]) : []
  return arr
    .filter((item) => {
      const name = item.name || ''
      if (name.startsWith('.')) return false
      if (item.is_dir) return true
      return isPickableImage(name)
    })
    .map((item) => ({ name: item.name || '', path: item.path || '', is_dir: !!item.is_dir }))
}
```

- [ ] **Step 8: 跑测试确认通过**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm vitest run src/settings/util/memberFormat.test.ts src/settings/util/avatar.test.ts src/settings/util/nasStorages.test.ts 2>&1 | tail -6
```
Expected: PASS,约 **36 例**。

- [ ] **Step 9: 变异验证(B3)**

1. `buildNasStorages` 里的 `if (mp === '/DATA') continue` 删掉 → 「/DATA 不会被加两次」必须红。
2. `nasNavigateUpTarget` 里 `parent.length >= nasRootPath.length ? parent : nasRootPath` 改成恒 `parent` → 「不会越过根往上」必须红。
3. `isAllowedImageFile` 的 `||` 改成 `&&` → 「mime 不命中但扩展名命中也通过」必须红。
4. `filterNasItems` 的 `name.startsWith('.')` 那行删掉 → 「滤掉隐藏项」必须红。

- [ ] **Step 10: Commit**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git add src/settings/util/memberFormat.ts src/settings/util/memberFormat.test.ts src/settings/util/avatar.ts src/settings/util/avatar.test.ts src/settings/util/nasStorages.ts src/settings/util/nasStorages.test.ts
git commit -m "feat(settings): account tab 的三个纯逻辑 util（成员格式化/校验、头像闸门、NAS 选图派生）" -- src/settings/util/memberFormat.ts src/settings/util/memberFormat.test.ts src/settings/util/avatar.ts src/settings/util/avatar.test.ts src/settings/util/nasStorages.ts src/settings/util/nasStorages.test.ts
```

---
## Task 6: `AccountPanel.vue` 状态机宿主 + `OwnerCard.vue`(state 1 上半)

**Files:**
- Modify: `src/settings/panels/AccountPanel.vue`(现为 P0 空骨架,整体重写)
- Create: `src/settings/panels/account/OwnerCard.vue`
- Create: `src/settings/panels/AccountPanel.test.ts`
- Create: `src/settings/panels/account/OwnerCard.test.ts`
- Modify: `src/settings/styles/settings.css`(追加 `.set-acc-*`)
- Modify: `src/i18n/{zh_cn,en_us}.sp9.ts`(先加本任务用到的键;§i18n 全表里 `settingsAcc*` 那批可一次全加)

**Interfaces:**
- Consumes: Task 0 的 `service.users.getUserInfo/avatarPath`;Task 5 的 `readAccessToken`、`isAllowedImageFile`。
- Produces —— 后续 Task 7-11 都挂在这个宿主上:
  ```ts
  // AccountPanel.vue 内部状态(不对外导出，但后续任务要按这些名字接):
  //   state: 1 | 3 | 4 | 5 | 6
  //   goto(next: AccountState): void        —— 切状态并做 Vue2 goto() 的那套清理
  //   pickedImageSrc: Ref<string>           —— 待裁剪图片的 src(本地 objectURL 或 /v1/image URL)
  //   activeMember: Ref<MemberInfo | null>  —— state 5 的目标成员
  // OwnerCard 事件契约:
  //   @change-password  → 宿主 goto(3)
  //   @pick-local-file="(src: string) => …"  → 宿主存 pickedImageSrc 并 goto(4)
  //   @choose-from-nas  → 宿主 goto(6)
  //   @logout           → 宿主 useAuth().logout() + router.push('/login')
  ```

- [ ] **Step 1: 写失败的测试 —— OwnerCard**

`src/settings/panels/account/OwnerCard.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn.sp9'
import OwnerCard from './OwnerCard.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function mountCard(username = 'nimoos', avatarSrc = '/v1/users/avatar?v=1') {
  return mount(OwnerCard, {
    props: { username, avatarSrc },
    global: { plugins: [i18n] },
  })
}

describe('OwnerCard —— 对位 Vue2 AccountPanel state 1 上半(:630-662)', () => {
  it('显示「本机所有者账户」小标 + 用户名', () => {
    const w = mountCard()
    expect(w.text()).toContain(zh.settingsAccOwnerLabel)
    expect(w.find('[data-test="acc-username"]').text()).toBe('nimoos')
  })

  it('三个按钮：更改密码 / 更改头像 / 退出账户', () => {
    const w = mountCard()
    expect(w.find('[data-test="acc-change-password"]').text()).toContain(zh.settingsAccChangePassword)
    expect(w.find('[data-test="acc-change-avatar"]').text()).toContain(zh.settingsAccChangeAvatar)
    expect(w.find('[data-test="acc-logout"]').text()).toContain(zh.settingsAccLogout)
  })

  it('点「更改密码」发 change-password 事件', async () => {
    const w = mountCard()
    await w.find('[data-test="acc-change-password"]').trigger('click')
    expect(w.emitted('change-password')).toHaveLength(1)
  })

  it('点「退出账户」发 logout 事件', async () => {
    const w = mountCard()
    await w.find('[data-test="acc-logout"]').trigger('click')
    expect(w.emitted('logout')).toHaveLength(1)
  })

  it('头像来源菜单默认收起，点「更改头像」才展开（Vue2 toggleAvatarMenu）', async () => {
    const w = mountCard()
    expect(w.find('[data-test="acc-avatar-menu"]').exists()).toBe(false)
    await w.find('[data-test="acc-change-avatar"]').trigger('click')
    expect(w.find('[data-test="acc-avatar-menu"]').exists()).toBe(true)
    expect(w.text()).toContain(zh.settingsAccUploadFromDevice)
    expect(w.text()).toContain(zh.settingsAccChooseFromNas)
  })

  it('再点一次「更改头像」收起菜单（toggle 语义）', async () => {
    const w = mountCard()
    await w.find('[data-test="acc-change-avatar"]').trigger('click')
    await w.find('[data-test="acc-change-avatar"]').trigger('click')
    expect(w.find('[data-test="acc-avatar-menu"]').exists()).toBe(false)
  })

  it('点「从NAS选择」发 choose-from-nas 并收起菜单', async () => {
    const w = mountCard()
    await w.find('[data-test="acc-change-avatar"]').trigger('click')
    await w.find('[data-test="acc-nas"]').trigger('click')
    expect(w.emitted('choose-from-nas')).toHaveLength(1)
    expect(w.find('[data-test="acc-avatar-menu"]').exists()).toBe(false)
  })

  it('点文档任意处收起菜单（Vue2 document click 监听）', async () => {
    const w = mountCard({ ...({} as never) } as never as string) // 见下方说明，实际用默认参数
    void w
    const w2 = mountCard()
    await w2.find('[data-test="acc-change-avatar"]').trigger('click')
    document.dispatchEvent(new MouseEvent('click'))
    await w2.vm.$nextTick()
    expect(w2.find('[data-test="acc-avatar-menu"]').exists()).toBe(false)
  })

  it('非图片文件被拒：发 invalid-file 而不是 pick-local-file', async () => {
    const w = mountCard()
    await w.find('[data-test="acc-change-avatar"]').trigger('click')
    const input = w.find('[data-test="acc-file-input"]')
    const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' })
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')
    expect(w.emitted('invalid-file')).toHaveLength(1)
    expect(w.emitted('pick-local-file')).toBeUndefined()
  })

  it('合法图片发 pick-local-file，带一个 objectURL', async () => {
    const created: string[] = []
    const spy = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      const u = `blob:fake-${created.length}`
      created.push(u)
      return u
    })
    const w = mountCard()
    await w.find('[data-test="acc-change-avatar"]').trigger('click')
    const input = w.find('[data-test="acc-file-input"]')
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')
    expect(w.emitted('pick-local-file')).toEqual([[created[0]]])
    spy.mockRestore()
  })

  it('头像 <img> 加载失败时回退成首字母块（真机 /v1/users/avatar 实测 404）', async () => {
    const w = mountCard('nimoos')
    expect(w.find('[data-test="acc-avatar-img"]').exists()).toBe(true)
    await w.find('[data-test="acc-avatar-img"]').trigger('error')
    expect(w.find('[data-test="acc-avatar-img"]').exists()).toBe(false)
    expect(w.find('[data-test="acc-avatar-fallback"]').text()).toBe('N')
  })

  it('avatarSrc 变化（版本号 +1）时重新尝试加载图片，清掉上次的失败状态', async () => {
    const w = mountCard('nimoos', '/v1/users/avatar?v=1')
    await w.find('[data-test="acc-avatar-img"]').trigger('error')
    expect(w.find('[data-test="acc-avatar-fallback"]').exists()).toBe(true)
    await w.setProps({ avatarSrc: '/v1/users/avatar?v=2' })
    expect(w.find('[data-test="acc-avatar-img"]').exists()).toBe(true)
  })
})
```

> ⚠️ 上面「点文档任意处收起菜单」那条里有一行占位式的 `mountCard({...})`,**实现时删掉那两行**,只保留 `w2` 那段。

- [ ] **Step 2: 跑测试确认失败**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm vitest run src/settings/panels/account/OwnerCard.test.ts 2>&1 | tail -12
```

- [ ] **Step 3: 实现 OwnerCard.vue**

```vue
<script setup lang="ts">
// 账号卡 —— 对位 Vue2 AccountPanel.vue state 1 上半(:630-662)。
// 左侧:「本机所有者账户」小标 + 大号用户名 + 三个按钮;右侧:108px 圆形头像。
//
// 🔧 plan C11:Vue2 选完本地文件后走 FileReader → 嗅探魔数算出 image.type,但那个 type
// **模板里零引用**(死代码)。这里只产出 objectURL 交给宿主,不做嗅探。
// 🔧 plan C12:objectURL 的生命周期由**宿主**统一管(赋新值前 revoke 旧值 + 卸载时 revoke),
// 本组件只负责 create 并往上报,不自己 revoke —— 否则宿主还没用就被释放了。
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { isAllowedImageFile } from '../../util/avatar'
import '../../styles/settings.css'

const props = defineProps<{ username: string; avatarSrc: string }>()
const emit = defineEmits<{
  'change-password': []
  'pick-local-file': [src: string]
  'choose-from-nas': []
  'logout': []
  'invalid-file': []
}>()

const { t } = useI18n()
const menuOpen = ref(false)
const avatarFailed = ref(false)
const initial = computed(() => (props.username || '').slice(0, 1).toUpperCase())

// 真机实测 GET /v1/users/avatar 返回 404(DB avatar 为空串且两个兜底 svg 都不存在),
// 所以失败兜底不是可选项。换头像后宿主会把版本号 +1 → src 变 → 清掉失败态重试。
watch(() => props.avatarSrc, () => { avatarFailed.value = false })

// Vue2 mounted 里 document.addEventListener('click', closeAvatarMenu),destroyed 摘掉。
function closeMenu() { menuOpen.value = false }
onMounted(() => document.addEventListener('click', closeMenu))
onUnmounted(() => document.removeEventListener('click', closeMenu))

function onFileSelected(e: Event) {
  menuOpen.value = false
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  if (!f) return
  if (!isAllowedImageFile(f.name, f.type)) {
    input.value = ''
    emit('invalid-file')
    return
  }
  emit('pick-local-file', URL.createObjectURL(f))
}
</script>

<template>
  <div class="set-acc-card">
    <div class="set-acc-main">
      <p class="set-acc-owner-label">{{ t('settingsAccOwnerLabel') }}</p>
      <h1 class="set-acc-username" data-test="acc-username">{{ username }}</h1>
      <div class="set-acc-actions">
        <button class="set-btn" type="button" data-test="acc-change-password"
                @click.stop="emit('change-password')">
          {{ t('settingsAccChangePassword') }}
        </button>

        <!-- @click.stop:别让这一层的点击冒到 document 上把刚打开的菜单又关掉 -->
        <div class="set-acc-avatar-picker" @click.stop>
          <button class="set-btn" type="button" data-test="acc-change-avatar"
                  @click="menuOpen = !menuOpen">
            {{ t('settingsAccChangeAvatar') }}
          </button>
          <div v-if="menuOpen" class="set-acc-avatar-menu" data-test="acc-avatar-menu">
            <label class="set-acc-avatar-opt">
              <span>{{ t('settingsAccUploadFromDevice') }}</span>
              <input class="set-acc-file-input" type="file" accept="image/*"
                     data-test="acc-file-input" @change="onFileSelected">
            </label>
            <button class="set-acc-avatar-opt" type="button" data-test="acc-nas"
                    @click="menuOpen = false; emit('choose-from-nas')">
              {{ t('settingsAccChooseFromNas') }}
            </button>
          </div>
        </div>

        <button class="set-btn set-acc-logout" type="button" data-test="acc-logout"
                @click.stop="emit('logout')">
          {{ t('settingsAccLogout') }}
        </button>
      </div>
    </div>
    <div class="set-acc-avatar-wrap">
      <img v-if="!avatarFailed" class="set-acc-avatar" :src="avatarSrc" alt=""
           data-test="acc-avatar-img" @error="avatarFailed = true">
      <span v-else class="set-acc-avatar set-acc-avatar-initial" data-test="acc-avatar-fallback">{{ initial }}</span>
    </div>
  </div>
</template>
```

- [ ] **Step 4: 写失败的测试 —— AccountPanel 宿主**

`src/settings/panels/AccountPanel.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../../i18n/zh_cn.sp9'
import AccountPanel from './AccountPanel.vue'

const getUserInfo = vi.fn()
const getMembers = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    users: {
      getUserInfo: (...a: unknown[]) => getUserInfo(...a),
      getMembers: (...a: unknown[]) => getMembers(...a),
      avatarPath: (v: number, t: string | null) => `/v1/users/avatar?${t ? `token=${t}&` : ''}v=${v}`,
      getMemberFolders: vi.fn(async () => []),
    },
  },
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

beforeEach(() => {
  setActivePinia(createPinia())
  getUserInfo.mockReset().mockResolvedValue({ id: 1, username: 'nimoos', role: 'admin' })
  getMembers.mockReset().mockResolvedValue([])
  localStorage.clear()
})

function mountPanel() {
  return mount(AccountPanel, { global: { plugins: [i18n] } })
}
const flush = () => new Promise((r) => setTimeout(r, 0))

describe('AccountPanel 宿主状态机', () => {
  it('挂载即取当前用户，用户名渲染进 OwnerCard', async () => {
    const w = mountPanel()
    await flush()
    expect(getUserInfo).toHaveBeenCalledTimes(1)
    expect(w.find('[data-test="acc-username"]').text()).toBe('nimoos')
  })

  it('state 1 没有页脚（Vue2 footer v-if="state !== 1"）', async () => {
    const w = mountPanel()
    await flush()
    expect(w.find('[data-test="acc-footer"]').exists()).toBe(false)
  })

  it('点更改密码 → 进 state 3，页脚出现「返回」+「提交」', async () => {
    const w = mountPanel()
    await flush()
    await w.find('[data-test="acc-change-password"]').trigger('click')
    expect(w.find('[data-test="acc-footer"]').exists()).toBe(true)
    expect(w.find('[data-test="acc-back"]').text()).toBe(zh.settingsAccBack)
    expect(w.find('[data-test="acc-submit"]').text()).toBe(zh.settingsAccSubmit)
    expect(w.find('[data-test="acc-pwd-form"]').exists()).toBe(true)
  })

  it('页脚「返回」从 state 3 回到 state 1', async () => {
    const w = mountPanel()
    await flush()
    await w.find('[data-test="acc-change-password"]').trigger('click')
    await w.find('[data-test="acc-back"]').trigger('click')
    expect(w.find('[data-test="acc-footer"]').exists()).toBe(false)
    expect(w.find('[data-test="acc-username"]').exists()).toBe(true)
  })

  it('admin 挂载时会取成员列表', async () => {
    const w = mountPanel()
    await flush()
    void w
    expect(getMembers).toHaveBeenCalledTimes(1)
  })

  it('非 admin 不取成员列表、也不渲染成员区（Vue2 mounted 的 role 判断 + isAdmin）', async () => {
    getUserInfo.mockResolvedValue({ id: 2, username: 'bob', role: 'user' })
    const w = mountPanel()
    await flush()
    expect(getMembers).not.toHaveBeenCalled()
    expect(w.find('[data-test="acc-members"]').exists()).toBe(false)
  })

  it('取用户信息失败时不炸，用户名回退空、成员区不渲染', async () => {
    getUserInfo.mockRejectedValue(new Error('boom'))
    const w = mountPanel()
    await flush()
    expect(w.find('[data-test="acc-members"]').exists()).toBe(false)
  })

  it('头像 URL 带 localStorage 里的 access_token 与版本号 1', async () => {
    localStorage.setItem('access_token', 'TK')
    const w = mountPanel()
    await flush()
    expect(w.find('[data-test="acc-avatar-img"]').attributes('src')).toBe('/v1/users/avatar?token=TK&v=1')
  })

  it('选了本地图片 → 进 state 4（裁剪），并把 objectURL 传给裁剪器', async () => {
    const spy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:one')
    const w = mountPanel()
    await flush()
    await w.find('[data-test="acc-change-avatar"]').trigger('click')
    const input = w.find('[data-test="acc-file-input"]')
    Object.defineProperty(input.element, 'files', { value: [new File(['x'], 'a.png', { type: 'image/png' })] })
    await input.trigger('change')
    expect(w.find('[data-test="acc-cropper"]').exists()).toBe(true)
    expect(w.find('[data-test="acc-cropper"]').attributes('data-src')).toBe('blob:one')
    spy.mockRestore()
  })

  it('换第二张图前会 revoke 第一张的 objectURL（plan C12：Vue2 这里会漏）', async () => {
    let n = 0
    const create = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:${++n}`)
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const w = mountPanel()
    await flush()
    const pick = async () => {
      await w.find('[data-test="acc-change-avatar"]').trigger('click')
      const input = w.find('[data-test="acc-file-input"]')
      Object.defineProperty(input.element, 'files', { value: [new File(['x'], 'a.png', { type: 'image/png' })], configurable: true })
      await input.trigger('change')
    }
    await pick()
    await w.find('[data-test="acc-back"]').trigger('click')   // 回 state 1 才能再打开菜单
    await pick()
    expect(revoke).toHaveBeenCalledWith('blob:1')
    create.mockRestore(); revoke.mockRestore()
  })

  it('卸载时 revoke 未释放的 objectURL', async () => {
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:z')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const w = mountPanel()
    await flush()
    await w.find('[data-test="acc-change-avatar"]').trigger('click')
    const input = w.find('[data-test="acc-file-input"]')
    Object.defineProperty(input.element, 'files', { value: [new File(['x'], 'a.png', { type: 'image/png' })] })
    await input.trigger('change')
    w.unmount()
    expect(revoke).toHaveBeenCalledWith('blob:z')
    create.mockRestore(); revoke.mockRestore()
  })

  it('选了非图片文件 → 面板级 toast 提示，不进裁剪（B5：读 useToast().msg）', async () => {
    const { useToast } = await import('../../stores/toast')
    const w = mountPanel()
    await flush()
    await w.find('[data-test="acc-change-avatar"]').trigger('click')
    const input = w.find('[data-test="acc-file-input"]')
    Object.defineProperty(input.element, 'files', { value: [new File(['x'], 'a.pdf', { type: 'application/pdf' })] })
    await input.trigger('change')
    expect(useToast().msg).toBe(zh.settingsAccPickImageOnly)
    expect(w.find('[data-test="acc-cropper"]').exists()).toBe(false)
  })

  it('点「从NAS选择」→ 进 state 6', async () => {
    const w = mountPanel()
    await flush()
    await w.find('[data-test="acc-change-avatar"]').trigger('click')
    await w.find('[data-test="acc-nas"]').trigger('click')
    expect(w.find('[data-test="acc-nas-picker"]').exists()).toBe(true)
  })

  it('取数在途时卸载不回写（就地过期守卫，plan C8）', async () => {
    let resolve!: (v: unknown) => void
    getUserInfo.mockReturnValue(new Promise((r) => { resolve = r }))
    const w = mountPanel()
    w.unmount()
    resolve({ id: 1, username: 'late', role: 'admin' })
    await flush()
    // 卸载后不应再取成员列表（admin 判断发生在用户信息落定之后）
    expect(getMembers).not.toHaveBeenCalled()
  })
})
```

> **为什么这个组件的过期守卫不是空转**(对照 P3 的 StoragePanel 教训):`AccountPanel` 的取数落定后会**接着触发第二个请求**(`getMembers`,依赖 `role`),而它自己又是路由页里 `<component :is>` 换 tab 时会被卸载的。「取数在途 + 卸载」是真实路径,不是为了凑测试造出来的。上面那条用例用 deferred 卡住加载,不是先 await 完再断(P1 记的两个空转陷阱之一)。

- [ ] **Step 5: 实现 AccountPanel.vue**

要点(逐条对位 Vue2):

1. `state` 用 `ref<1 | 3 | 4 | 5 | 6>(1)`。**没有 2** —— plan C10。
2. `goto(next)` 复刻 Vue2 `goto()`(:192-214) 的清理:回 1 时 revoke 图片 objectURL、清空 NAS 浏览态、收起菜单;进 3 时清三个密码框。
3. `onMounted`:`getUserInfo()` → 存 `user`;若 `user.role === 'admin'` 再 `getMembers()`。
   - Vue2 `mounted` 是 `if (this.$store.state.user.id === 0) updateUserInfo()` —— 依赖 Vuex 里已有的用户。New-UI 没有全局 user store(`session.setUser` 只写 localStorage),**所以无条件取一次**,注释登记这处必要的差异。
4. **就地过期守卫**:`let alive = true; onUnmounted(() => { alive = false })`,两个 await 之后都 `if (!alive) return`。
5. 页脚:`v-if="state !== 1"`,Back 的分支逻辑逐字对位 Vue2 :909 ——
   `state === 5` → 回 1 且清 `activeMember`;`state === 6 && nasView === 'browse'` → 回存储卡网格;否则 `goto(1)`。
   Submit 只在 state 3 / 4 出现(Vue2 :911-912;state 2 那个不做,C10)。
6. `avatarVersion` ref,`avatarSrc = computed(() => service.users.avatarPath(avatarVersion.value, readAccessToken()))`。
7. objectURL 生命周期(C12):`setPickedImage(src, isObjectUrl)` 里先 revoke 旧的再存新的;`onUnmounted` 再 revoke 一次。
8. `logout()`:`useAuth().logout()` + `router.push('/login')`。
   - **两处不移植并注释登记**:Vue2 还发了 `$messageBus('account_setting_logout')`(纯埋点事件,New-UI 无 publish 通道,且不可见)与 `SET_DEFAULT_WALLPAPER`(New-UI 无壁纸系统 = 既有债务 D5)。
9. 子组件按 state 渲染,`data-test` 依次为 `acc-pwd-form`(3)/`acc-cropper`(4)/`acc-member-folders`(5)/`acc-nas-picker`(6);state 1 渲 `OwnerCard` + `MembersSection`(`v-if="isAdmin"`,`data-test="acc-members"`)。
   **Task 6 只需要把 state 3/4/5/6 的落点写成占位 `<div :data-test=… :data-src=…/>`**,由 Task 7-11 依次换成真组件 —— 每个任务都能独立跑绿。

- [ ] **Step 6: 加样式 `.set-acc-*`**

追加到 `src/settings/styles/settings.css`。对位 Vue2 的视觉量:卡片圆角 `1.25rem`、用户名 `2rem`、头像 `108px` 圆形 4px 描边、按钮高 36px / 字号 0.875rem、菜单圆角 10px / 最小宽 176px。**颜色全部走 token**(C4):卡片底 `--card-bg`、描边 `--card-border`、小标 `--fg-muted`、用户名 `--fg`、菜单底 `--popup-bg`、退出按钮文字 `--remove-fg`。

- [ ] **Step 7: 跑三门 + 变异验证**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm test 2>&1 | tail -6 && pnpm exec vue-tsc --noEmit && pnpm build 2>&1 | tail -3
```

变异:① 把 `watch(() => props.avatarSrc, …)` 删掉 → 「版本号变化时重新尝试」必须红;② 把 `setPickedImage` 里的 `revokeObjectURL(old)` 删掉 → 「换第二张前 revoke 第一张」必须红;③ 把 `if (!alive) return` 删掉 → 「卸载不回写」必须红。

- [ ] **Step 8: Commit**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git add src/settings/panels/AccountPanel.vue src/settings/panels/AccountPanel.test.ts src/settings/panels/account/OwnerCard.vue src/settings/panels/account/OwnerCard.test.ts src/settings/styles/settings.css src/i18n/zh_cn.sp9.ts src/i18n/en_us.sp9.ts
git commit -m "feat(settings): account tab 状态机宿主 + 账号卡（头像 404 兜底、objectURL 生命周期修正）" -- src/settings/panels/AccountPanel.vue src/settings/panels/AccountPanel.test.ts src/settings/panels/account/OwnerCard.vue src/settings/panels/account/OwnerCard.test.ts src/settings/styles/settings.css src/i18n/zh_cn.sp9.ts src/i18n/en_us.sp9.ts
git log --name-only -1 | grep -c design-export   # 必须是 0
```

---
## Task 7: `ChangePasswordForm.vue`(state 3)—— ⛔ 验收不点的写路径

**Files:**
- Create: `src/settings/panels/account/ChangePasswordForm.vue` + `.test.ts`
- Modify: `src/settings/panels/AccountPanel.vue`(把 state 3 的占位换成真组件 + 接 submit)

**⚠️ 这条写路径会改机主的 SSH 凭据(plan D 表)。代码写完整、单测覆盖,但 curl 不发、验收不点。**

**Interfaces:**
- Consumes: Task 0 的 `service.users.changePassword(oldPassword, password)`。
- Produces:
  ```ts
  // ChangePasswordForm 暴露给宿主(defineExpose)：
  //   submit(): Promise<boolean>   —— true = 成功(宿主据此 goto(1) 并 toast)
  // props: 无。内部自持三个输入 + 内联错误。
  ```

- [ ] **Step 1: 写失败的测试**

`src/settings/panels/account/ChangePasswordForm.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn.sp9'
import ChangePasswordForm from './ChangePasswordForm.vue'

const changePassword = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: { users: { changePassword: (...a: unknown[]) => changePassword(...a) } },
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
beforeEach(() => changePassword.mockReset().mockResolvedValue(undefined))

function mountForm() {
  return mount(ChangePasswordForm, { global: { plugins: [i18n] } })
}
async function fill(w: ReturnType<typeof mountForm>, ori: string, pw: string, cfm: string) {
  await w.find('[data-test="acc-pwd-ori"]').setValue(ori)
  await w.find('[data-test="acc-pwd-new"]').setValue(pw)
  await w.find('[data-test="acc-pwd-cfm"]').setValue(cfm)
}

describe('ChangePasswordForm —— 对位 Vue2 state 3(:723-744)+ savePassword(:415-440)', () => {
  it('三个 password 类型输入框，占位文案与 Vue2 一致', () => {
    const w = mountForm()
    for (const [k, key] of [
      ['acc-pwd-ori', 'settingsAccOriPassword'],
      ['acc-pwd-new', 'settingsAccNewPassword'],
      ['acc-pwd-cfm', 'settingsAccConfirmNewPassword'],
    ] as const) {
      const el = w.find(`[data-test="${k}"]`)
      expect(el.attributes('type')).toBe('password')
      expect(el.attributes('placeholder')).toBe(zh[key])
    }
  })

  it('三个输入框都包在 .set-net-field 里（C7：否则吃到 .set-input 的 92px）', () => {
    const w = mountForm()
    for (const k of ['acc-pwd-ori', 'acc-pwd-new', 'acc-pwd-cfm']) {
      expect(w.find(`[data-test="${k}"]`).element.closest('.set-net-field')).not.toBeNull()
    }
  })

  it('有一个 autocomplete=username 的蜜罐（Vue2 :725，防浏览器把自动填充打到搜索栏）', () => {
    expect(mountForm().find('input[autocomplete="username"]').exists()).toBe(true)
  })

  it('两次新密码不一致 → 内联报错，且一次请求都不发', async () => {
    const w = mountForm()
    await fill(w, 'old', 'aaaaaa', 'bbbbbb')
    expect(await (w.vm as unknown as { submit(): Promise<boolean> }).submit()).toBe(false)
    await w.vm.$nextTick()
    expect(w.find('.set-danger').text()).toBe(zh.settingsAccPwdMismatch)
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('任一框为空 → 内联报错，不发请求（Vue2 靠 vee-validate required，这里自己校验）', async () => {
    const w = mountForm()
    await fill(w, '', 'aaaaaa', 'aaaaaa')
    expect(await (w.vm as unknown as { submit(): Promise<boolean> }).submit()).toBe(false)
    expect(changePassword).not.toHaveBeenCalled()
    expect(w.find('.set-danger').text()).toBe(zh.settingsAccFillAllFields)
  })

  it('成功时按 (old_password, password) 顺序调共享包，并返回 true', async () => {
    const w = mountForm()
    await fill(w, 'old-pw', 'new-pw', 'new-pw')
    expect(await (w.vm as unknown as { submit(): Promise<boolean> }).submit()).toBe(true)
    expect(changePassword).toHaveBeenCalledWith('old-pw', 'new-pw')
  })

  it('失败时优先显示后端 message，用内联 .set-danger 而不是 toast（C6）', async () => {
    changePassword.mockRejectedValue({ response: { data: { message: '原密码错误' } }, message: 'Request failed' })
    const w = mountForm()
    await fill(w, 'bad', 'new-pw', 'new-pw')
    expect(await (w.vm as unknown as { submit(): Promise<boolean> }).submit()).toBe(false)
    await w.vm.$nextTick()
    expect(w.find('.set-danger').text()).toBe('原密码错误')
  })

  it('后端没给 message 时回退成 axios 的 message', async () => {
    changePassword.mockRejectedValue({ message: 'Network Error' })
    const w = mountForm()
    await fill(w, 'a', 'new-pw', 'new-pw')
    await (w.vm as unknown as { submit(): Promise<boolean> }).submit()
    await w.vm.$nextTick()
    expect(w.find('.set-danger').text()).toBe('Network Error')
  })

  it('提交在途时把三个框与自身 busy 标记住，防重复提交', async () => {
    let resolve!: () => void
    changePassword.mockReturnValue(new Promise<void>((r) => { resolve = r }))
    const w = mountForm()
    await fill(w, 'a', 'new-pw', 'new-pw')
    const p = (w.vm as unknown as { submit(): Promise<boolean> }).submit()
    await w.vm.$nextTick()
    expect(w.find('[data-test="acc-pwd-ori"]').attributes('disabled')).toBeDefined()
    // 在途时再调一次 submit 不会产生第二次请求
    await (w.vm as unknown as { submit(): Promise<boolean> }).submit()
    expect(changePassword).toHaveBeenCalledTimes(1)
    resolve()
    await p
  })

  it('重新提交会清掉上一次的错误提示', async () => {
    changePassword.mockRejectedValueOnce({ message: 'X' })
    const w = mountForm()
    await fill(w, 'a', 'new-pw', 'new-pw')
    await (w.vm as unknown as { submit(): Promise<boolean> }).submit()
    await w.vm.$nextTick()
    expect(w.find('.set-danger').exists()).toBe(true)
    changePassword.mockResolvedValue(undefined)
    await (w.vm as unknown as { submit(): Promise<boolean> }).submit()
    await w.vm.$nextTick()
    expect(w.find('.set-danger').exists()).toBe(false)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm vitest run src/settings/panels/account/ChangePasswordForm.test.ts 2>&1 | tail -12
```

- [ ] **Step 3: 实现**

`src/settings/panels/account/ChangePasswordForm.vue`。要点:

- 三个 `<input type="password">`,各自包一层 `.set-net-field`(C7);占位文案用 §i18n 表的三个键。
- 顶部一个 `autocomplete="username"` 的隐藏蜜罐 `<input>`,`aria-hidden="true" tabindex="-1"`,样式照 Vue2 :725 那一串(`position:absolute;left:-9999px;width:1px;height:1px;opacity:0`)。三个密码框 `autocomplete="new-password"`。
- `defineExpose({ submit })`;`submit()` 顺序:① 空值 → `settingsAccFillAllFields` ② 不一致 → `settingsAccPwdMismatch` ③ `busy` 早退 ④ 调 `service.users.changePassword(ori, pw)`。
- 错误显示:**内联 `.set-danger`**,取值 `e?.response?.data?.message || e?.message || String(e)`(C6:Vue2 这里用的是 `b-notification`,New-UI 侧统一成 `.set-danger`;**不要用 toast**)。
- 文件头注释必须写清:
  ```
  // ⛔ 这个表单提交后端会 chpasswd 写 /etc/shadow(NimoOS-UserService route/v1/user.go:403),
  // 而 SSH 与 Web 登录都读 /etc/shadow —— 改的是机主本机的登录凭据,不可撤销。
  // 开发期一次都没真发过(plan D 表),覆盖靠单测。
  ```
- **Vue2 的两处不照抄并注释**:① `savePassword` 失败时把错误塞进 `b-notification` + `auto-close`(会自己消失,用户可能没看见)→ 改成常驻内联,下次提交才清;② Vue2 成功后**不提示任何东西**只 `goto(1)` → 宿主侧补一个面板级 `settingsAccUpdateOk` toast(与「更改头像」成功的提示一致,同屏行为统一)。**这两条是 C1 的「改正确」,不是自由发挥,注释里写明理由。**

- [ ] **Step 4: 接进宿主**

`AccountPanel.vue`:state 3 渲 `<ChangePasswordForm ref="pwdForm" data-test="acc-pwd-form" />`;页脚 Submit 在 state 3 时调 `await pwdForm.value?.submit()`,返回 true 则 `toast.show(t('settingsAccUpdateOk'))` + `goto(1)`。

宿主侧补两条用例进 `AccountPanel.test.ts`:

```ts
  it('state 3 提交成功 → 回 state 1 并弹面板级成功 toast', async () => {
    // service mock 里补 changePassword: vi.fn(async () => {})
  })
  it('state 3 提交失败 → 留在 state 3（错误由表单内联显示）', async () => {})
```

- [ ] **Step 5: 三门 + 变异**

变异:① `submit()` 里的一致性判断改成恒 `true` 通过 → 「不一致时不发请求」必须红;② `busy` 早退删掉 → 「防重复提交」必须红;③ 错误取值链的 `response.data.message` 段删掉 → 「优先显示后端 message」必须红。

- [ ] **Step 6: Commit**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git add src/settings/panels/account/ChangePasswordForm.vue src/settings/panels/account/ChangePasswordForm.test.ts src/settings/panels/AccountPanel.vue src/settings/panels/AccountPanel.test.ts
git commit -m "feat(settings): account 改密表单（内联报错优先后端 message，⛔ 未真发过）" -- src/settings/panels/account/ChangePasswordForm.vue src/settings/panels/account/ChangePasswordForm.test.ts src/settings/panels/AccountPanel.vue src/settings/panels/AccountPanel.test.ts
```

---

## Task 8: `AvatarCropper.vue`(state 4)+ 装 `vue-advanced-cropper`

**Files:**
- Modify: `package.json` / `pnpm-lock.yaml`(装依赖)
- Create: `src/settings/panels/account/AvatarCropper.vue` + `.test.ts`
- Modify: `src/settings/panels/AccountPanel.vue`(state 4 占位 → 真组件 + 接 submit)

**⚠️ 上传写路径:验收不点(plan D 表);后端 `log.Fatal` 会打死 UserService,不要拿非 PNG 试探。**

**Interfaces:**
- Consumes: Task 0 的 `service.users.saveAvatar(dataUrl)`。
- Produces:
  ```ts
  // props: { src: string }
  // defineExpose({ submit(): Promise<boolean> })  —— 取 canvas.toDataURL() 上传
  ```

- [ ] **Step 1: 装依赖**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm add vue-advanced-cropper@^2.8.9 && grep -n "vue-advanced-cropper" package.json
```
Expected: `"vue-advanced-cropper": "^2.8.9"` 进 `dependencies`。**用户 2026-08-01 已拍板装这个依赖**(选项 A),不必再问。装完 `pnpm build` 必须通过(它带 `debounce`/`easy-bem`/`classnames` 三个小依赖)。

- [ ] **Step 2: 写失败的测试**

`src/settings/panels/account/AvatarCropper.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn.sp9'
import AvatarCropper from './AvatarCropper.vue'

const saveAvatar = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: { users: { saveAvatar: (...a: unknown[]) => saveAvatar(...a) } },
}))
// cropper 是 canvas 库，jsdom 里跑不动真实渲染 —— 只桩掉组件、保留它的 change 事件契约。
vi.mock('vue-advanced-cropper', () => ({
  Cropper: {
    name: 'Cropper',
    props: ['src', 'stencilProps', 'canvas', 'defaultSize', 'minWidth', 'minHeight', 'debounce', 'checkOrientation'],
    emits: ['change'],
    template: '<div data-test="cropper-stub" :data-src="src"></div>',
  },
  Preview: {
    name: 'Preview',
    props: ['width', 'height', 'image', 'coordinates'],
    template: '<div data-test="preview-stub"></div>',
  },
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
beforeEach(() => saveAvatar.mockReset().mockResolvedValue(undefined))

function mountCropper(src = 'blob:x') {
  return mount(AvatarCropper, { props: { src }, global: { plugins: [i18n] } })
}
type Exposed = { submit(): Promise<boolean> }

describe('AvatarCropper —— 对位 Vue2 state 4(:746-760)+ saveAvatar(:442-462)', () => {
  it('把 src 透给 Cropper，并渲染右侧圆形预览与 Preview 字样', () => {
    const w = mountCropper('blob:abc')
    expect(w.find('[data-test="cropper-stub"]').attributes('data-src')).toBe('blob:abc')
    expect(w.find('[data-test="preview-stub"]').exists()).toBe(true)
    expect(w.text()).toContain(zh.settingsAccPreview)
  })

  it('stencil 是 1:1 方形、canvas 输出 160×160（Vue2 stencilProps/canvasProps 逐字）', () => {
    const w = mountCropper()
    const c = w.findComponent({ name: 'Cropper' })
    expect(c.props('stencilProps')).toEqual({ aspectRatio: 1 })
    expect(c.props('canvas')).toEqual({ height: 160, width: 160 })
    expect(c.props('minWidth')).toBe(80)
    expect(c.props('minHeight')).toBe(80)
  })

  it('还没 change 过（无 canvas）时 submit 直接失败，不发请求', async () => {
    const w = mountCropper()
    expect(await (w.vm as unknown as Exposed).submit()).toBe(false)
    expect(saveAvatar).not.toHaveBeenCalled()
  })

  it('change 后 submit 上传 canvas.toDataURL() 的 PNG dataURL', async () => {
    const w = mountCropper()
    const canvas = { toDataURL: vi.fn(() => 'data:image/png;base64,PNGDATA') }
    w.findComponent({ name: 'Cropper' }).vm.$emit('change', { coordinates: { left: 0 }, image: {}, canvas })
    await w.vm.$nextTick()
    expect(await (w.vm as unknown as Exposed).submit()).toBe(true)
    expect(canvas.toDataURL).toHaveBeenCalled()
    expect(saveAvatar).toHaveBeenCalledWith('data:image/png;base64,PNGDATA')
  })

  it('上传失败返回 false，并把错误内联显示（C6，不用 toast）', async () => {
    saveAvatar.mockRejectedValue({ response: { data: { message: '写盘失败' } } })
    const w = mountCropper()
    w.findComponent({ name: 'Cropper' }).vm.$emit('change', { coordinates: {}, image: {}, canvas: { toDataURL: () => 'data:image/png;base64,A' } })
    await w.vm.$nextTick()
    expect(await (w.vm as unknown as Exposed).submit()).toBe(false)
    await w.vm.$nextTick()
    expect(w.find('.set-danger').text()).toBe('写盘失败')
  })

  it('上传在途时不许再次提交', async () => {
    let resolve!: () => void
    saveAvatar.mockReturnValue(new Promise<void>((r) => { resolve = r }))
    const w = mountCropper()
    w.findComponent({ name: 'Cropper' }).vm.$emit('change', { coordinates: {}, image: {}, canvas: { toDataURL: () => 'data:image/png;base64,A' } })
    await w.vm.$nextTick()
    const p = (w.vm as unknown as Exposed).submit()
    await (w.vm as unknown as Exposed).submit()
    expect(saveAvatar).toHaveBeenCalledTimes(1)
    resolve(); await p
  })
})
```

- [ ] **Step 3: 跑测试确认失败 → 实现**

`src/settings/panels/account/AvatarCropper.vue`:

```vue
<script setup lang="ts">
// 头像裁剪 —— 对位 Vue2 AccountPanel state 4(:746-760)+ saveAvatar(:442-462)。
// 左 220×220 裁剪框(1:1 方形 stencil,输出 160×160 canvas),右 80×80 圆形预览 + 「预览」字样。
//
// ⚠️ 后端 PUT /v1/users/avatar 只 strip `data:image/png;base64,` 这一种前缀,且解码失败会
// log.Fatal 打死 UserService(全集群 JWT 失效、所有人重新登录;systemd 会 100ms 拉起)。
// canvas.toDataURL() 无参默认就是 PNG —— **不要加 'image/jpeg' 之类参数**。
// 本期这条写路径在开发机上一次都没真发过(plan D 表),覆盖靠上面的单测。
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Cropper, Preview } from 'vue-advanced-cropper'
import 'vue-advanced-cropper/dist/style.css'
import { service } from '@nimotech/nimoos-service'
import '../../styles/settings.css'

const props = defineProps<{ src: string }>()
const { t } = useI18n()

const result = ref<{ coordinates: unknown; image: unknown; canvas: HTMLCanvasElement | null }>({
  coordinates: null, image: null, canvas: null,
})
const busy = ref(false)
const error = ref('')

function onChange(payload: { coordinates: unknown; image: unknown; canvas: HTMLCanvasElement }) {
  result.value = payload
}

// Vue2 defaultSize(:383-388):优先可见区域,其次整图尺寸。
function defaultSize({ imageSize, visibleArea }: { imageSize: { width: number; height: number }; visibleArea?: { width: number; height: number } }) {
  const s = visibleArea || imageSize
  return { width: s.width, height: s.height }
}

async function submit(): Promise<boolean> {
  if (busy.value) return false
  const canvas = result.value.canvas
  // Vue2 直接 `this.result.canvas.toDataURL()` —— 用户没动过裁剪框时 canvas 是 null 会抛
  // TypeError,被 .catch 吞成「更新失败」。这里显式早退(plan C1「吞错不照抄」)。
  if (!canvas) return false
  busy.value = true
  error.value = ''
  try {
    await service.users.saveAvatar(canvas.toDataURL())
    return true
  } catch (e) {
    const r = e as { response?: { data?: { message?: string } }; message?: string }
    error.value = r?.response?.data?.message || r?.message || String(e)
    return false
  } finally {
    busy.value = false
  }
}
defineExpose({ submit })
</script>

<template>
  <div class="set-acc-crop">
    <div class="set-acc-crop-box">
      <Cropper
        :src="props.src" :debounce="false" :stencil-props="{ aspectRatio: 1 }" check-orientation
        :min-height="80" :min-width="80" :canvas="{ height: 160, width: 160 }"
        :default-size="defaultSize" @change="onChange"
      />
    </div>
    <div class="set-acc-crop-preview">
      <Preview :width="80" :height="80" :image="result.image" :coordinates="result.coordinates" />
      <p class="set-acc-crop-preview-label">{{ t('settingsAccPreview') }}</p>
    </div>
    <p v-if="error" class="set-danger">{{ error }}</p>
  </div>
</template>
```

> **`Preview` 圆形**:Vue2 靠 `.preview { border-radius: 50% }`,New-UI 在 `.set-acc-crop-preview :deep(.vue-preview) { border-radius: 50%; overflow: hidden }` 里给。裁剪框底 `--overlay-bg`(Vue2 是 `rgba(0,0,0,0.2)` 字面量,这里换 token,C4)。

- [ ] **Step 4: 接进宿主 + 版本号自增**

`AccountPanel.vue`:state 4 渲 `<AvatarCropper ref="cropper" :src="pickedImageSrc" data-test="acc-cropper" :data-src="pickedImageSrc" />`。页脚 Submit 在 state 4 时:`submit()` 返回 true → `toast.show(t('settingsAccUpdateOk'))` + `avatarVersion.value++` + `goto(1)`;返回 false → 留在 state 4(错误已内联)。

宿主侧补一条:

```ts
  it('头像上传成功 → 回 state 1、头像 URL 的 v 递增（缓存击穿）', async () => {
    // 断言 acc-avatar-img 的 src 从 v=1 变 v=2
  })
```

> Vue2 成功后还 `$EventBus.$emit('avatar-changed')` 让顶栏头像刷新。New-UI 的设置区顶部用户块(`SettingsShell`)显示的是**首字母**不是头像图,桌面 TopBar 也没有头像位 → **无接收方,不移植**,注释登记。

- [ ] **Step 5: 三门 + 变异**

变异:① `if (!canvas) return false` 删掉 → 「没 change 过时不发请求」必须红(会变成抛错);② `canvas.toDataURL()` 改成 `canvas.toDataURL('image/jpeg')` → 断言 PNG 那条必须红(顺带证明这条断言在守后端契约);③ `busy` 早退删掉 → 「在途不许再提交」必须红。

- [ ] **Step 6: Commit**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git add package.json pnpm-lock.yaml src/settings/panels/account/AvatarCropper.vue src/settings/panels/account/AvatarCropper.test.ts src/settings/panels/AccountPanel.vue src/settings/panels/AccountPanel.test.ts src/settings/styles/settings.css
git commit -m "feat(settings): account 头像裁剪与上传（装 vue-advanced-cropper，PNG dataURL 契约锁死）" -- package.json pnpm-lock.yaml src/settings/panels/account/AvatarCropper.vue src/settings/panels/account/AvatarCropper.test.ts src/settings/panels/AccountPanel.vue src/settings/panels/AccountPanel.test.ts src/settings/styles/settings.css
```

---
## Task 9: `NasImagePicker.vue`(state 6)—— 从 NAS 选头像(全只读)

**Files:**
- Create: `src/settings/panels/account/NasImagePicker.vue` + `.test.ts`
- Modify: `src/settings/panels/AccountPanel.vue`(state 6 占位 → 真组件)

**这一整块只读**(`storage.list` / `raid.list` / `folder.getList` / `<img>` 取 `/v1/image`),可放心在真机上点。

**Interfaces:**
- Consumes: Task 5 的 `buildNasStorages` / `nasBreadcrumbs` / `nasNavigateUpTarget` / `filterNasItems`;`service.storage.list()` / `service.raid.list()` / `service.folder.getList(path)` / `service.image.imageUrl(path, 'original')`;`renderSize`(`files/util/format`);`mapVolumes`(`storage/util/storageMap`)。
- Produces:
  ```ts
  // 事件：@pick="(src: string) => …"  —— 宿主收到后存进 pickedImageSrc(非 objectURL) 并 goto(4)
  // 暴露：defineExpose({ backToStorages(): void, view: Ref<'storages' | 'browse'> })
  //        —— 宿主的页脚「返回」在 browse 视图下要先回存储卡网格(Vue2 :909)
  ```

- [ ] **Step 1: 写失败的测试**

`src/settings/panels/account/NasImagePicker.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn.sp9'
import NasImagePicker from './NasImagePicker.vue'

const storageList = vi.fn()
const raidList = vi.fn()
const folderGetList = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    storage: { list: (...a: unknown[]) => storageList(...a) },
    raid: { list: (...a: unknown[]) => raidList(...a) },
    folder: { getList: (...a: unknown[]) => folderGetList(...a) },
    image: { imageUrl: (p: string, t?: string) => `/v1/image?path=${encodeURIComponent(p)}&type=${t}` },
  },
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const flush = () => new Promise((r) => setTimeout(r, 0))

// 真机口径:/v1/storage 的 children 里 size/avail 是字符串,系统盘 mount_point 是裸 "/"。
const STORAGE = [
  { path: '/dev/nvme0n1', disk_name: 'System', type: 'internal', children: [
    { uuid: 'u1', mount_point: '/', label: 'sys', drive_name: 'nvme0n1p7', size: '1000', avail: '400' },
    { uuid: 'u2', mount_point: '/mnt/Extra', label: 'Extra', drive_name: 'nvme0n1p8', size: '2000', avail: '1500' },
  ] },
]

beforeEach(() => {
  storageList.mockReset().mockResolvedValue(STORAGE)
  raidList.mockReset().mockResolvedValue([])
  folderGetList.mockReset().mockResolvedValue({ content: [] })
})

function mountPicker() {
  return mount(NasImagePicker, { global: { plugins: [i18n] } })
}

describe('NasImagePicker —— 对位 Vue2 state 6(:763-846)', () => {
  it('挂载即取存储列表，/DATA 卡恒排第一', async () => {
    const w = mountPicker()
    await flush()
    const names = w.findAll('[data-test="nas-storage"]').map((n) => n.find('.set-nas-name').text())
    expect(names[0]).toBe('NimoOS-HD')
    expect(names).toContain('Extra')
  })

  it('有容量的卡显示「已用 / 总量」，/DATA 卡不显示容量（Vue2 v-if="s.size"）', async () => {
    const w = mountPicker()
    await flush()
    const cards = w.findAll('[data-test="nas-storage"]')
    expect(cards[0].find('.set-nas-sub').exists()).toBe(false)
    const extra = cards.find((c) => c.find('.set-nas-name').text() === 'Extra')!
    expect(extra.find('.set-nas-sub').text()).toBe('500 Bytes / 1.95 KB')
  })

  it('取存储列表失败 → 显示错误，不显示空网格', async () => {
    storageList.mockRejectedValue(new Error('boom'))
    const w = mountPicker()
    await flush()
    expect(w.find('.set-danger').exists()).toBe(true)
    expect(w.findAll('[data-test="nas-storage"]')).toHaveLength(0)
  })

  it('raid.list 失败不拖垮整屏（Vue2 :280 单独 catch 成空）', async () => {
    raidList.mockRejectedValue(new Error('no raid'))
    const w = mountPicker()
    await flush()
    expect(w.findAll('[data-test="nas-storage"]').length).toBeGreaterThan(0)
    expect(w.find('.set-danger').exists()).toBe(false)
  })

  it('点存储卡进浏览视图，按该卡路径列目录', async () => {
    const w = mountPicker()
    await flush()
    await w.findAll('[data-test="nas-storage"]')[0].trigger('click')
    await flush()
    expect(folderGetList).toHaveBeenCalledWith('/DATA')
    expect(w.find('[data-test="nas-crumbs"]').exists()).toBe(true)
  })

  it('浏览视图只列目录与图片，隐藏项被滤掉', async () => {
    folderGetList.mockResolvedValue({ content: [
      { name: 'sub', path: '/DATA/sub', is_dir: true },
      { name: '.git', path: '/DATA/.git', is_dir: true },
      { name: 'a.png', path: '/DATA/a.png', is_dir: false },
      { name: 'b.txt', path: '/DATA/b.txt', is_dir: false },
    ] })
    const w = mountPicker()
    await flush()
    await w.findAll('[data-test="nas-storage"]')[0].trigger('click')
    await flush()
    expect(w.findAll('[data-test="nas-item"]').map((n) => n.text())).toEqual(['sub', 'a.png'])
  })

  it('点目录下钻，面包屑逐段增长', async () => {
    folderGetList.mockResolvedValue({ content: [{ name: 'sub', path: '/DATA/sub', is_dir: true }] })
    const w = mountPicker()
    await flush()
    await w.findAll('[data-test="nas-storage"]')[0].trigger('click')
    await flush()
    await w.findAll('[data-test="nas-item"]')[0].trigger('click')
    await flush()
    expect(folderGetList).toHaveBeenLastCalledWith('/DATA/sub')
    expect(w.findAll('[data-test="nas-crumb"]').map((n) => n.text())).toEqual(['NimoOS-HD/', 'sub'])
  })

  it('点图片发 pick，src 是 /v1/image 的 original URL（plan C11：不走 arraybuffer）', async () => {
    folderGetList.mockResolvedValue({ content: [{ name: 'a.png', path: '/DATA/a.png', is_dir: false }] })
    const w = mountPicker()
    await flush()
    await w.findAll('[data-test="nas-storage"]')[0].trigger('click')
    await flush()
    await w.findAll('[data-test="nas-item"]')[0].trigger('click')
    expect(w.emitted('pick')).toEqual([[`/v1/image?path=${encodeURIComponent('/DATA/a.png')}&type=original`]])
  })

  it('目录为空 → 显示「此处没有图片文件」', async () => {
    const w = mountPicker()
    await flush()
    await w.findAll('[data-test="nas-storage"]')[0].trigger('click')
    await flush()
    expect(w.text()).toContain(zh.settingsAccNoImagesHere)
  })

  it('列目录失败 → 显示「加载文件夹失败」', async () => {
    folderGetList.mockRejectedValue(new Error('nope'))
    const w = mountPicker()
    await flush()
    await w.findAll('[data-test="nas-storage"]')[0].trigger('click')
    await flush()
    expect(w.find('.set-danger').text()).toBe(zh.settingsAccLoadFolderFailed)
  })

  it('在根目录时「上一层」按钮 disabled（B6：断属性）', async () => {
    const w = mountPicker()
    await flush()
    await w.findAll('[data-test="nas-storage"]')[0].trigger('click')
    await flush()
    expect(w.find('[data-test="nas-up"]').attributes('disabled')).toBeDefined()
  })

  it('下钻后「上一层」回到父目录', async () => {
    folderGetList.mockResolvedValue({ content: [{ name: 'sub', path: '/DATA/sub', is_dir: true }] })
    const w = mountPicker()
    await flush()
    await w.findAll('[data-test="nas-storage"]')[0].trigger('click')
    await flush()
    await w.findAll('[data-test="nas-item"]')[0].trigger('click')
    await flush()
    await w.find('[data-test="nas-up"]').trigger('click')
    await flush()
    expect(folderGetList).toHaveBeenLastCalledWith('/DATA')
  })

  it('backToStorages 回到存储卡网格并清掉浏览态', async () => {
    const w = mountPicker()
    await flush()
    await w.findAll('[data-test="nas-storage"]')[0].trigger('click')
    await flush()
    ;(w.vm as unknown as { backToStorages(): void }).backToStorages()
    await w.vm.$nextTick()
    expect(w.findAll('[data-test="nas-storage"]').length).toBeGreaterThan(0)
    expect(w.find('[data-test="nas-crumbs"]').exists()).toBe(false)
  })

  it('快速切目录时旧请求落定不许覆盖新目录（就地代际守卫，plan C8）', async () => {
    // 第一次列目录卡住，第二次立刻返回；旧的后落定时不许把列表改回去
    let resolveFirst!: (v: unknown) => void
    folderGetList
      .mockImplementationOnce(() => new Promise((r) => { resolveFirst = r }))
      .mockImplementationOnce(async () => ({ content: [{ name: 'new.png', path: '/DATA/sub/new.png', is_dir: false }] }))
    const w = mountPicker()
    await flush()
    await w.findAll('[data-test="nas-storage"]')[0].trigger('click')  // 第一次：卡住
    // 直接用暴露的导航方法发第二次
    ;(w.vm as unknown as { openFolder(p: string): void }).openFolder('/DATA/sub')
    await flush()
    resolveFirst({ content: [{ name: 'old.png', path: '/DATA/old.png', is_dir: false }] })
    await flush()
    expect(w.findAll('[data-test="nas-item"]').map((n) => n.text())).toEqual(['new.png'])
  })
})
```

> 这条竞态**是真实路径**:列目录 ~百毫秒级,用户点面包屑/上一层/目录都能在途时再发一次。守卫用 `seq` 代际(不是 `alive` 布尔),因为要区分「同一组件的前后两次请求」。为此把 `openFolder` 也 `defineExpose` 出来 —— 测试要能不经 DOM 直接发第二次导航(Vue2 那套面包屑点击在根 crumb 上是 `i < len-1 &&` 守着的,从 DOM 走不出这条路径)。

- [ ] **Step 2: 实现要点**

- 两个视图 `view: 'storages' | 'browse'`,与 Vue2 `nasView` 一致。
- `loadStorages()`:`Promise.all([service.storage.list(), service.raid.list().catch(() => [])])` → `buildNasStorages(rawStorage, rawRaid, displayNames)`。
  - `displayNames` 由 `mapVolumes(rawStorage)` 派生,**根挂载点 `/` 映射成 `/DATA`** —— 口径与 `AppsPanel.vue:81-95` 一致(那里有完整理由注释,这里注释指过去,不重抄)。
  - Vue2 调的是 `$api.storage.list()`(无参),不是 AppsPanel 的 `{system:'show'}` —— **照 Vue2 用无参**,因为 `/DATA` 那张卡是手工加的、不依赖系统盘出现在列表里。注释登记。
  - Vue2 这里还 `dispatch('GET_DISPLAY_NAMES')`(另一个接口),New-UI 从同一份 storage 数据派生,少一次请求。注释登记。
- `openFolder(path)`:`seq` 代际守卫 → `service.folder.getList(path)` → `filterNasItems(res.content)`。
  - **Vue2 这里查的是 `res.data?.success === 200`**(v1 信封),而共享包 `folder.getList` 已经 `unwrap` 过、直接给 `FolderListing` → **不要再查 success**,失败由 axios reject。注释登记这处信封差异。
- `up()`:`nasNavigateUpTarget(...)`,返回 null 就不发请求;按钮 `:disabled="nasPath === nasRootPath"`。
- 面包屑:`nasBreadcrumbs(nasPath, nasRootPath, displayNames)`,最后一段 `.is-active` 不可点(Vue2 `i < len-1 &&` 守卫照抄)。crumb 之间的 `/` 分隔符跟在非末段后面(Vue2 模板 :804 就是这么拼的,所以第一段文本是 `NimoOS-HD/`)。
- 点图片:`emit('pick', service.image.imageUrl(item.path, 'original'))`。
- 容量文案:`` `${renderSize(size - (avail || 0))} / ${renderSize(size)}` ``(Vue2 :784 逐字)。
- 错误:存储列表失败/目录列举失败都用 `.set-danger`(面板内联,不是 toast —— 这是面板正文而非弹窗,但 Vue2 这里用的就是内联 `b-notification`,照 1:1)。

- [ ] **Step 3: 三门 + 变异**

变异:① 去掉 `seq` 守卫 → 竞态那条必须红;② `raid.list().catch(() => [])` 的 catch 去掉 → 「raid 失败不拖垮整屏」必须红;③ `filterNasItems` 换成不过滤 → 「只列目录与图片」必须红。

- [ ] **Step 4: 接进宿主 + Commit**

宿主 state 6 渲 `<NasImagePicker ref="nasPicker" data-test="acc-nas-picker" @pick="onNasPick" />`;`onNasPick(src)` → `setPickedImage(src, false)`(非 objectURL,不需要 revoke)+ `goto(4)`。页脚 Back 在 `state === 6 && nasPicker.view === 'browse'` 时调 `nasPicker.backToStorages()`,否则 `goto(1)`(Vue2 :909 逐字)。

宿主补两条用例:「state 6 浏览视图下点返回只回存储卡网格、不回 state 1」「存储卡网格下点返回回 state 1」。

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git add src/settings/panels/account/NasImagePicker.vue src/settings/panels/account/NasImagePicker.test.ts src/settings/panels/AccountPanel.vue src/settings/panels/AccountPanel.test.ts src/settings/styles/settings.css
git commit -m "feat(settings): account 从 NAS 选头像（存储卡网格 + 目录浏览 + 代际守卫）" -- src/settings/panels/account/NasImagePicker.vue src/settings/panels/account/NasImagePicker.test.ts src/settings/panels/AccountPanel.vue src/settings/panels/AccountPanel.test.ts src/settings/styles/settings.css
```

---

## Task 10: `MembersSection.vue` —— 成员列表 + 添加 + 删除(⛔ 验收不点)

**Files:**
- Create: `src/settings/panels/account/MembersSection.vue` + `.test.ts`
- Modify: `src/settings/panels/AccountPanel.vue`(state 1 下半挂上;把 members 取数下沉到本组件)

**⚠️ 添加/删除都是写路径,用户 2026-08-01 拍板全部不点(plan D2)。本机零成员 → 真机上只看得到空态。**

**Interfaces:**
- Consumes: `service.users.getMembers/createMember/deleteUser`;Task 5 的 `formatMemberDate` / `validateNewMember`;`ui/AlertDialog.vue`。
- Produces: `@open-member="(m: MemberInfo) => …"` → 宿主存 `activeMember` 并 `goto(5)`。

- [ ] **Step 1: 写失败的测试(要点清单 —— 逐条都要有用例)**

`src/settings/panels/account/MembersSection.test.ts`:

1. 标题「成员」+ 右侧「添加」按钮。
2. 挂载即 `getMembers()`;**本机真实形态**:返回 `[]` → 渲染 `settingsAccNoMembers`「暂无成员」。
3. 有成员时每行:用户名、`{folder_count} 个文件夹 · 创建于: {formatMemberDate(created_at)}`、两个操作按钮(设置 / 删除)。
   - 断言 meta 行文本用 `formatMemberDate` 的真实输出拼,**不要在断言里手写日期串**。
4. **取列表失败 → 显示 `.set-danger` + `settingsAccMembersLoadFailed`,而不是「暂无成员」**(plan C14 改正 Vue2 的静默吞错)。
5. 点「添加」展开内联表单(三个输入:用户名/密码/确认密码),表单出现时空态提示消失(Vue2 `v-if="members.length===0 && !showAddMember"`)。
6. 三个输入框都包 `.set-net-field`(C7)。
7. 校验:空 → `settingsAccFillAllFields`;短于 6 位 → `settingsAccPwdMin6`;不一致 → `settingsAccPwdMismatch`。**三条都断言 `createMember` 未被调用**。
8. 成功:`createMember(username, password)` 参数正确 → 表单关闭 → 重新 `getMembers()`(调用次数变 2)→ 面板级 toast `settingsAccMemberAdded`(B5 读 `useToast().msg`)。
9. 失败:优先显示后端 `message` 的**内联** `.set-danger`(C6),表单保持打开,输入不清空。
10. 提交在途时按钮 disabled(B6 断属性)。
11. 点「取消」关闭表单;再次打开时三个输入已清空(Vue2 `openAddMember` 每次重置)。
12. 点删除按钮 → 弹 `AlertDialog`(B4:`attachTo: document.body` + 查 `document`),标题/文案含成员名,确认按钮类名 `.ui-btn.danger`。
13. **不点确认时 `deleteUser` 不被调用**;点确认后 `deleteUser(member.id)` 调用一次 → 重新 `getMembers()` → toast `settingsAccDeleted`。
14. 删除失败 → toast `settingsAccDeleteFailed`(**这是面板级操作,用 toast 是对的**;Vue2 同款)。
15. 点某行的「设置」按钮 → `emit('open-member', member)`。
16. 就地过期守卫:`getMembers` 在途时卸载,落定后不回写(用 deferred 卡住,不是先 await 完)。

- [ ] **Step 2: 实现要点**

- 自持 `members` / `loading` / `loadError` / `showAdd` / 三个输入 / `addError` / `addBusy` / `pendingDelete`。
- `loadMembers()` 带 `alive` + `seq` 守卫(本组件有第二个触发点:添加/删除后都会重新取数)。
- `submitAdd()`:`validateNewMember` → 映射到三个文案键 → `createMember` → 关表单 + `loadMembers()` + toast。
- 删除走 `AlertDialog`:`:destructive="true"`,`confirmText = t('settingsAccDelete')`,`cancelText = t('settingsCancel')`,`message` 用 Vue2 的语义(`删除 <名字>?` → 由于 `AlertDialog` 的 message 是纯文本,拼成 `` `${t('settingsAccDelete')} ${name}?` ``,**不做 HTML 加粗** —— Vue2 用的是 `<b>`,`AlertDialog` 不支持富文本,登记为可见的微小差异)。
- 文件头注释写清:
  ```
  // ⛔ 添加会真 useradd + chpasswd(user.go:845-853),删除会 userdel + os.RemoveAll 用户数据目录
  // (user.go:656-672,不可撤销)。用户 2026-08-01 拍板:本期两条都不在真机上点,整块挂账。
  // 本机 GET /v1/users/members 实测返回 [] → 真机上只看得到「暂无成员」空态。
  ```

- [ ] **Step 3: 三门 + 变异**

变异:① `loadError` 那条分支删掉(回到 Vue2 的吞错成 `[]`)→ 「取列表失败显示错误」必须红;② `validateNewMember` 的返回值不再阻断提交 → 三条校验用例必须红;③ 删除确认的 `AlertDialog` 直接执行(跳过确认)→ 「不点确认时不调 deleteUser」必须红。**第 ③ 条是保护「会删用户数据」的那道闸,评审要独立复跑一次变异确认它有判别力**(同 P3 迁移弹窗二次确认的先例)。

- [ ] **Step 4: 接进宿主 + Commit**

宿主 state 1 下半:`<MembersSection v-if="isAdmin" data-test="acc-members" @open-member="onOpenMember" />`。`onOpenMember(m)` → `activeMember.value = m` + `goto(5)`。**members 取数从宿主移到本组件** —— 宿主只保留 `isAdmin` 判断(对位 Vue2 `mounted` 里的 role 判断 + 模板 `v-if="isAdmin"`);相应地把 Task 6 里那条「admin 挂载时会取成员列表」的宿主用例改成断言 `acc-members` 是否渲染。

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git add src/settings/panels/account/MembersSection.vue src/settings/panels/account/MembersSection.test.ts src/settings/panels/AccountPanel.vue src/settings/panels/AccountPanel.test.ts src/settings/styles/settings.css src/i18n/zh_cn.sp9.ts src/i18n/en_us.sp9.ts
git commit -m "feat(settings): account 成员管理（列表/添加/删除，失败不再静默吞成空列表）" -- src/settings/panels/account/MembersSection.vue src/settings/panels/account/MembersSection.test.ts src/settings/panels/AccountPanel.vue src/settings/panels/AccountPanel.test.ts src/settings/styles/settings.css src/i18n/zh_cn.sp9.ts src/i18n/en_us.sp9.ts
```

---
## Task 11: `MemberFoldersView.vue`(state 5)—— 成员文件夹授权(⛔ 验收不点)

**Files:**
- Create: `src/settings/panels/account/MemberFoldersView.vue` + `.test.ts`
- Modify: `src/settings/panels/AccountPanel.vue`(state 5 占位 → 真组件)

**⚠️ 授权/撤销会写 `user_folder_permissions` 表 + 真 `setfacl` 改 `/DATA` 目录 ACL,而 NimoOS core 启动时只读打开这张表做文件区权限判定。用户已拍板本期不点(plan D2)。**

**Interfaces:**
- Consumes: `service.users.getMemberFolders/grantMemberFolder/revokeMemberFolder`;Task 5 的 `formatMemberDate`;`ui/AlertDialog.vue`。
- Props: `{ member: MemberInfo }`。

- [ ] **Step 1: 写失败的测试(逐条都要有用例)**

`src/settings/panels/account/MemberFoldersView.test.ts`:

1. 顶部说明句由三段拼成(Vue2 :850-852):`settingsAccFoldersAccessiblePrefix` + 成员名 + `settingsAccSystemDiskBlocked`;断言整句文本包含成员名且首尾两段都在。
2. 挂载即 `getMemberFolders(member.id)`;返回 `[]` → 显示 `settingsAccNoFoldersGranted`。
3. 取列表失败 → `.set-danger` + `settingsAccFoldersLoadFailed`(C14 改正 Vue2 吞错)。
4. 有授权时每行:等宽字体路径、权限徽标(`write` → `settingsAccReadWrite`,其它 → `settingsAccReadOnly`)、`formatMemberDate(created_at)`、一个删除按钮。
   - 断言 `permission: 'read'` 与 `'write'` 两种都渲染对;**再断一条 `permission: 'x'`(后端理论上会回落成 read,但类型是宽 string)也走「只读」分支** —— 对位 Vue2 的三元。
5. 点「添加文件夹」展开内联表单:路径输入(placeholder `/DATA/Downloads`,Vue2 :860 逐字)+ 权限下拉(两项:只读 / 读写,默认只读)。
6. 输入框与下拉都包 `.set-net-field`(C7)。
7. 路径为空(或只有空白)→ 内联 `settingsAccEnterFolderPath`,`grantMemberFolder` **未被调用**。
8. 成功:`grantMemberFolder(member.id, '/DATA/Downloads', 'read')` 参数正确(**路径经过 `.trim()`**,Vue2 :582)→ 关表单 → 重新 `getMemberFolders`(调用次数 2)→ 面板级 toast `settingsAccFolderGranted`。
9. 选了「读写」时第三个参数是 `'write'`。
10. 失败:内联 `.set-danger` 优先后端 `message`(C6),表单不关。
11. 在途时提交按钮 disabled(B6)。
12. 点撤销 → `AlertDialog`(B4 attachTo body + 查 document),文案含该路径,确认按钮 `.ui-btn.danger`;**不点确认时 `revokeMemberFolder` 未被调用**。
13. 点确认 → `revokeMemberFolder(member.id, perm.id)` 调用一次 → 重新取列表 → toast `settingsAccAccessRevoked`;失败 → toast `settingsAccRevokeFailed`。
14. 就地过期守卫:`getMemberFolders` 在途时卸载 → 落定不回写(deferred 卡住)。

- [ ] **Step 2: 实现要点**

- 结构逐屏对位 Vue2 :849-901。
- 权限下拉用 `<select class="set-select">`(仓内已有 `.set-select` 样式),两个 `<option value="read"|"write">`。
- **`revokeMemberFolder` 的 `perm_id` 走 query string** —— 共享包已经封好(Task 0),这里只传两个参数。
- 撤销确认的 message:`` `${t('settingsAccRevokePrefix')}${perm.path}?` ``(Vue2 是 `Revoke access to <b>path</b>?`;`AlertDialog` 纯文本,不加粗 —— 与 Task 10 同款登记)。
- 文件头注释:
  ```
  // ⛔ 授权 = 写 user_folder_permissions 表(upsert)+ 真 setfacl 改该目录 ACL
  // (user.go:766-774);撤销 = 删表行 + setfacl -x(:806-816)。
  // ⚠️ NimoOS core 启动时**只读打开这张表**做文件区权限判定 —— 授错会影响文件可见性。
  // 用户 2026-08-01 拍板本期不在真机上点;本机零成员,这一屏在真机上进不去(需先建成员)。
  ```

- [ ] **Step 3: 三门 + 变异**

变异:① 去掉 `.trim()` → 「路径经过 trim」必须红;② 权限下拉的值不透传(恒 `'read'`)→ 「选读写时第三参是 write」必须红;③ 撤销确认跳过 → 「不点确认时不调 revoke」必须红(**同 Task 10 ③,评审独立复跑**)。

- [ ] **Step 4: 接进宿主 + Commit**

宿主 state 5 渲 `<MemberFoldersView v-if="activeMember" :member="activeMember" data-test="acc-member-folders" />`。页脚 Back 在 state 5 时:`activeMember = null` + `goto(1)`(Vue2 :909 逐字)。宿主补一条:「从成员行进 state 5 再返回,activeMember 被清空」。

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git add src/settings/panels/account/MemberFoldersView.vue src/settings/panels/account/MemberFoldersView.test.ts src/settings/panels/AccountPanel.vue src/settings/panels/AccountPanel.test.ts src/settings/styles/settings.css src/i18n/zh_cn.sp9.ts src/i18n/en_us.sp9.ts
git commit -m "feat(settings): account 成员文件夹授权（授权/撤销 + 二次确认，⛔ 未真发过）" -- src/settings/panels/account/MemberFoldersView.vue src/settings/panels/account/MemberFoldersView.test.ts src/settings/panels/AccountPanel.vue src/settings/panels/AccountPanel.test.ts src/settings/styles/settings.css src/i18n/zh_cn.sp9.ts src/i18n/en_us.sp9.ts
```

---

## Task 12: 收尾 —— 静态截图自查 / 全量门 / roadmap 同步 / 验收清单

**Files:**
- Modify: `NimoOS-UI/docs/vue3-migration-roadmap.md`(§4 SP9 追加 P4 关账段)
- Modify: `NimoOS-New-UI/.superpowers/sdd/sp9/05-p4.md`(台账,gitignore 不进 git)
- Create: `NimoOS-New-UI/.superpowers/sdd/sp9/05-p4-acceptance.md`(验收清单,gitignore)

- [ ] **Step 1: 全量三门(最终数字)**

```bash
cd /home/nimo/NimoTech/NimoOS-Service && pnpm test 2>&1 | tail -4
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm test 2>&1 | tail -4 && pnpm exec vue-tsc --noEmit && pnpm build 2>&1 | tail -3
```
把最终「文件数 / 例数」记进台账。相对基线(New-UI 308/2427 · Service 25/172)只许增不许减红。

- [ ] **Step 2: i18n 完整性自查**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm vitest run src/i18n/parity.test.ts src/color-guard.test.ts 2>&1 | tail -6
```

再做一次**字节级文案比对**(P3 教训②:标点):

```bash
cd /home/nimo/NimoTech && python3 - <<'PY'
import json, re
zh = json.load(open('NimoOS-UI/src/assets/lang/zh_CN.json', encoding='utf-8'))
src = open('NimoOS-New-UI/src/i18n/zh_cn.sp9.ts', encoding='utf-8').read()
mine = dict(re.findall(r"^\s*(settings(?:Acc|Fp)[A-Za-z0-9]*)\s*:\s*'((?:[^'\\]|\\.)*)'", src, re.M))
# 计划 §i18n 全表里标「✅ 照抄」的键 → 逐字节必须等于 zh_CN.json 的值
PAIRS = {  # key: Vue2 英文原文（只列「✅ 照抄」那批）
  'settingsAccChangePassword': 'Change Password',
  'settingsAccChangeAvatar': 'Change Avatar',
  'settingsAccUploadFromDevice': 'Upload from device',
  'settingsAccChooseFromNas': 'Choose from NAS',
  'settingsAccLogout': 'Logout',
  'settingsAccAdd': 'Add', 'settingsAccUsername': 'Username', 'settingsAccPassword': 'Password',
  'settingsAccPickImageOnly': 'Please select an image file',
  'settingsAccDelete': 'Delete', 'settingsAccDeleted': 'Deleted', 'settingsAccDeleteFailed': 'Delete failed',
  'settingsAccLoadImageFailed': 'Failed to load image', 'settingsAccNoImagesHere': 'No image files here',
  'settingsAccOriPassword': 'Original password', 'settingsAccNewPassword': 'New password',
  'settingsAccConfirmNewPassword': 'Confirm the new password again',
  'settingsAccBack': 'Back', 'settingsAccSubmit': 'Submit', 'settingsAccAddFolder': 'Add folder',
  'settingsFpIntro': "Manage each smart feature's folders in its own section below.",
  'settingsFpFilenameIndex': 'Filename index', 'settingsFpServiceOffline': 'Service offline',
  'settingsFpFilenameDesc': 'Folders scanned into the filename search index.',
  'settingsFpNoFolders': 'No folders configured.', 'settingsFpKnowledge': 'Knowledge base',
  'settingsFpKnowledgeDesc': 'Folders indexed into the knowledge base (RAG).',
  'settingsFpIndexedFolders': 'Indexed folders', 'settingsFpExcludedSubfolders': 'Excluded subfolders',
  'settingsFpAddExclusion': 'Add exclusion', 'settingsFpNoExclusions': 'No exclusions.',
  'settingsFpAiHidden': 'Folders hidden from AI', 'settingsFpCurrentUserOnly': 'Current user only',
  'settingsFpAiDesc': 'The AI agent can never see these folders.',
  'settingsFpNoAiBlocked': 'No folders blocked — the AI may access everything except the built-in system blacklist.',
  'settingsFpPhotos': 'Photos', 'settingsFpUpdateRequired': 'Update required',
  'settingsFpPhotosDesc': 'Folders watched for the photo library.',
  'settingsFpPhotosAuto': 'Automatic mode: Photos currently watches the folders below (follows mounted volumes).',
  'settingsFpSwitchManual': 'Switch to manual management',
  'settingsFpPhotosStale': 'Photos service needs an update before its column can be managed here.',
  'settingsFpCoveredBy': 'Covered by {p}',
  'settingsFpGlobRules': '{n} pattern rules (e.g. *.key) are managed in AI settings.',
}
bad = 0
for k, en in PAIRS.items():
    want, got = zh.get(en), mine.get(k)
    if want != got:
        bad += 1
        print(f"❌ {k}\n   期望(zh_CN.json): {want!r}\n   实际(sp9 分片):   {got!r}")
print(f"\n{'✅ 全部逐字节一致' if not bad else f'🔴 {bad} 处不一致'}（共比 {len(PAIRS)} 条）")
PY
```
**必须 0 处不一致才算过。**

- [ ] **Step 3: 静态截图自查(P2/P3 的有效替代手法)**

浏览器自查在本期同样阻塞在认证(P1 §八点五:localhost 免鉴权的前提是完全不带 `Authorization` 头,而共享包拦截器只要有 token 就挂)。照 P2/P3 的做法:用真机 fixture 拼**与组件模板同构的静态 HTML** + 直接引 `theme.css` / `theme.sp9.css` / `settings.css`,用缓存里的 chromium 截**暗色 + 亮色**两套。

必截清单(每项暗/亮各一张,1280px 与 420px 两个宽度):
1. account state 1(账号卡 + 头像首字母兜底 + 成员空态)
2. account state 1(头像来源菜单展开)
3. account state 3(改密三输入 + 内联报错态)
4. account state 4(裁剪框 + 圆形预览 —— cropper 是 canvas 库,静态 HTML 里放一个同尺寸占位方块即可,重点看布局与预览圈)
5. account state 5(授权列表两行:read/write 两种徽标 + 授权表单展开)
6. account state 6(存储卡网格 / 目录浏览两态)
7. folder-permissions(四分区 + 四个「服务离线」徽标 + 顶部两条说明)
8. FolderPickerDialog 打开态

**重点看四件事**(前三条都是历史上真栽过的):
- `.set-input` 的 `width:92px` 有没有把弹窗/表单里的输入框截断(P2 那个缺陷 = `.set-net-field` 漏包)。
- 浮动/绝对定位元素(头像来源菜单)有没有遮住正文(P3 栽两次)。
- 420px 窄屏下账号卡的用户名与头像、成员行的两个按钮会不会挤爆。
- 亮色主题下 `.set-fp-tag` / `.set-danger` / 退出按钮的对比度。

发现的问题当场修,并把「截了几张 / 逮到什么」写进台账。

- [ ] **Step 4: 更新 roadmap §4 SP9(重要结论必须同步,台账会丢)**

在 `NimoOS-UI/docs/vue3-migration-roadmap.md` 的 SP9 节 P3 关账段之后追加 P4 段,至少覆盖:
- 坐标(New-UI `9fc7cb8 → <新>`、Service `389b7db → <新>`)、任务门数字、计划书与台账路径、执行方式。
- **交付物**清单。
- **实测校正**(供后续期直接引用):① 4 个只读端点全是标准信封;② `GET /v1/users/avatar` 本机 404,`?token=` 查询参数被 JWT 中间件认(`jwt_helper.go:51-57`);③ `/users/members` 本机为 `[]`,`GetAllMembers` 只隐藏调用者本人、**不隐藏其它 admin**;④ `members/:id/folders` 对不存在的 id 也返回 200+`[]`,非数字 id → HTTP 400;⑤ `grantMemberFolder` 是 **upsert**。
- **spec 出入**:§5.7 的「权限矩阵」与源码的「四分区」不符(C3)。
- **移植纪律登记**(C10–C15 六条)。
- **⛔ 未验机的写路径**与新增债务(见 Step 5)。
- **`vue-advanced-cropper` 是本期新增运行时依赖**(用户拍板)。
- §3.3 追踪表:`users` → **已补全进包**。

- [ ] **Step 5: 预登记债务(写进 roadmap + 台账)**

| 编号 | 内容 | 归属 |
|---|---|---|
| **D26** | **改密码零实机验证** —— `chpasswd` 写 `/etc/shadow` = 机主 SSH 凭据,不可撤销。性质同 D17/D18:破坏性 + 只能在浏览器里点才算验 = 只有机主本人能关账 | 需机主本人 |
| **D27** | **头像上传零实机验证** —— 写盘 + 后端 `log.Fatal` 会打死 UserService(全集群 JWT 失效、需重新登录;systemd 100ms 自动拉起)。**成本其实很低**(最坏 = 重新登录一次),机主愿意时可单独关账 | 需用户排期 |
| **D28** | **成员管理整块零实机验证**(添加/删除/授权/撤销)+ 本机零成员导致成员行、授权列表**结构性不可见** —— 用户 2026-08-01 拍板。同 P3-D22「验不了 ≠ 没验」 | 需用户排期 |
| **D29** | **后端票:`PutUserAvatar` 用 `log.Fatal` 处理用户输入** —— `route/v1/user.go:270`,任何解码不了的图片都会让整个 UserService `os.Exit(1)`,连带全集群 JWT 失效。应改成返回 4xx | **后端票** |
| **D30** | **后端票:`GET /v1/users/avatar` 在没设过头像时返回 404**(两个兜底 svg 路径都不存在),前端必须自己兜底。应内置一个真实存在的默认头像或返回 204 | **后端票** |
| **D31** | `DELETE /v1/users`(删全部用户)与 `PUT /v1/users/current` 未进包 —— 前者是核按钮、后者在 Vue2 侧无入口(死代码 C10)。`setUserInfo` 虽已进包但**无消费方** | 记录即可 |

- [ ] **Step 6: 写验收清单 `05-p4-acceptance.md`**

结构照 `04-p3-acceptance.md`。**第一屏必须是「不要点哪里」**:

```markdown
# ⛔ 第一屏:这一期不要点的地方(按 P2/P3 同样的规矩)

1. **「更改密码」的提交按钮 —— 一次都不要点。**
   后端会 `chpasswd` 写 `/etc/shadow`,而这台机器的 SSH 登录用的就是这套凭据;
   不知道新旧密码就改不回去。界面可以打开、可以看三个输入框长什么样,**别按提交**。
2. **头像的「提交」按钮 —— 默认不要点。**
   会往磁盘写 `/var/lib/nimoos/1/avatar.png`;更要紧的是后端对解不开的图片用了
   `log.Fatal`,会把 UserService 打死一次 → **所有人的登录立刻失效、要重新登录**
   (服务本身 100ms 自动拉起)。若你愿意承担「重新登录一次」这个代价,可以单独告诉我,
   这一条就能关账(债务 D27)。
3. **成员区的「添加」「删除」,以及成员文件夹授权的「授权」「撤销」—— 都不要点。**
   添加会真建一个 Linux 用户,删除会 `userdel` 并删掉该用户的数据目录(不可撤销);
   授权/撤销会真改 `/DATA` 目录的 ACL,而文件区的可见性就是按那张表判的。
   (你 2026-08-01 已经拍板全部不点 = 债务 D28。)
4. folder-permissions 那一页**整页都点不动**,那是故意的(政策三:界面先做、数据源等
   相册区/AI 区合并后再接)。四个「服务离线」徽标是本期的正确形态,不是坏了。

**可以放心点的**:账号卡的「更改头像」菜单、「从NAS选择」整套浏览(纯只读)、
「更改密码」页面本身(只是别提交)、成员区的「添加」表单展开与取消、
folder-permissions 的刷新按钮与「添加文件夹」弹窗(确认键是灰的)、页脚「返回」。
```

清单主体按屏列**预期值,全部用 curl 出来的真实值**:
- 账号卡用户名 = `nimoos`(`/v1/users/current` 实测),头像 = **首字母 N 的圆形块**(因为 `/v1/users/avatar` 实测 404);
- 成员区 = 「暂无成员」空态(`/users/members` 实测 `[]`);
- folder-permissions = 四个分区 + 四个「服务离线」+ 顶部两句说明;
- NAS 选图第一屏 = `NimoOS-HD` 卡在最前 + 本机其它已挂载分区(**列清单前先 curl `/v1/storage` 与 `/v1/raid` 把真实卡片名与容量抄进来**)。

末尾附「起服务与 4 项探活」(P2 定的,P3 沿用):

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm dev --host    # 5273，⛔ 不要跑 ./scripts/deploy.sh
# ① /app/ 通
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:5273/app/
# ② 本期组件能被 dev 编译(逐个请求源文件，看是否 200 且是编译后的 JS)
for f in settings/panels/AccountPanel.vue settings/panels/FolderPermissionsPanel.vue \
         settings/panels/account/OwnerCard.vue settings/panels/account/NasImagePicker.vue; do
  curl -s -o /dev/null -w "$f %{http_code}\n" "http://127.0.0.1:5273/app/src/$f"
done
# ③ dev 交付的共享包 .js 里有本期新方法(P1 那个「喂旧包」坑的固定探活)
grep -o "users/members[^\"']*" node_modules/.vite/deps/*.js 2>/dev/null | head
grep -c "current/password" node_modules/.vite/deps/*.js 2>/dev/null | head
#    ⚠️ 若 .vite/deps 下查不到 @nimotech/nimoos-service（P1 已加 optimizeDeps.exclude，
#    正常情况就是查不到 = 直接按需加载真实文件），改为直接查真实包：
grep -c "users/members" node_modules/@nimotech/nimoos-service/dist/*.js
# ④ dev 代理真打到 :80 拿到真实数据
curl -s http://127.0.0.1:5273/v1/users/current
```

- [ ] **Step 7: 最终提交自查**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git log --oneline 9fc7cb8..HEAD
git log --name-only 9fc7cb8..HEAD | grep -c design-export   # 必须是 0
git status --short                                          # 那 3 个 D design-export/* 必须原样在
cd /home/nimo/NimoTech/NimoOS-Service && git log --oneline 389b7db..HEAD
```

---

## Self-Review(计划自查,写完后逐条核过)

**1. spec 覆盖**

| spec §5.7 要求 | 落点 |
|---|---|
| account:账号信息 | Task 6(OwnerCard) |
| account:头像上传 | Task 8(裁剪+上传)+ Task 9(NAS 选图)+ Task 6(本地选文件) |
| account:改密 | Task 7 |
| account:成员管理(增删) | Task 10 |
| account:成员文件夹授权(增删改) | Task 11(「改」= 后端 upsert,同路径重新授权即改权限) |
| `users` 域补全 10 个方法 | Task 0(实际 16 个方法:6 现有 + 10 新增;另加 `avatarPath` URL 构造器 = 11 个新增导出) |
| folder-permissions 界面完整 | Task 3(四分区,C3 已登记与 spec 的出入)+ Task 4(添加弹窗) |
| 数据源留空 + 界面顶部说明 | Task 3(`fetchSnapshot` 空实现 + `settingsFpDataPending` 说明条) |
| 写操作禁用 | Task 3(四路 offline → 开关/删除按钮压根不渲染)+ Task 4(确认键恒 disabled)+ `execute()` 抛错 |
| 纯逻辑照测:`planToggle`/`aiPatternFor`/`denyGlobFor`/`pathFromAiPattern` | Task 1(**brief 写的 `pathFromAiPath` 实际叫 `pathFromAiPattern`**;另有 `pathFromDenyGlob`/`isUnder`/`coveringEnabledRoot` 一并移植)+ Task 2(`folderPermissionsView.js` 的 6 个纯函数,brief 未点名但同属纯逻辑) |
| 合并后只换两个函数 | Task 3(`folderPermissionsSnapshot.ts` 就是那个唯一落点,文件头写了接线步骤) |
| admin-only 守卫核对 | P0 的 `util/tabs.ts` 已按 role 过滤且有测试(`tabs.test.ts:63-69`);Task 10 另有组件级 `v-if="isAdmin"` 对位 Vue2 模板 :665 |

**2. 占位符扫描** —— 已过一遍:每个 Step 都有可执行命令或真实代码;Task 10/11 用「逐条要点清单」代替完整测试代码,但每条都点明了断言对象、文案键与「不该发生什么」,且实现要点里给了具体做法与文件头注释原文,不是 "TBD"。Task 6 的两处占位式测试行已在正文标注「实现时删掉」。

**3. 类型一致性** —— 逐个核过:
- `MemberInfo` / `UserFolderPermission` 在 Task 0 定义,Task 10/11 消费,字段名与 Go struct 一致(`folder_count` / `created_at` / `user_id` / `permission`)。
- `FolderPermSnapshot` 在 Task 1 定义,Task 2/3 消费;`FolderPermAction` 在 Task 1 定义,Task 3 的 `execute` 签名消费。
- `PickerRoot` 在 Task 2 定义,Task 3 传给 Task 4 的 `roots` prop。
- `NasStorage` 在 Task 5 定义,Task 9 消费。
- `submit(): Promise<boolean>` 三处一致(Task 7 表单 / Task 8 裁剪器 / 宿主页脚调用)。
- `avatarPath(version, token)` 参数顺序在 Task 0 定义、Task 6 消费,一致。
