# SP9-P3 实现计划 — 设置 apps / system-status / terminal / storage

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Vue2 系统设置的 apps / system-status / terminal / storage 四个 tab 迁进 New-UI 的 `/settings/:tab`,并给共享包 `@nimotech/nimoos-service` 的 `container` 域补 `prune()`。

**Architecture:** 沿用 P1/P2 已立的结构——纯逻辑落 `src/settings/util/*.ts`(纯函数 + 单测),界面落 `src/settings/panels/<tab>/*.vue`,装配落 `src/settings/panels/<Tab>Panel.vue`;所有接口调用只经共享包 `service.*`。本期新增一个大弹窗 `AppPathDialog.vue`(对位 Vue2 `AppPathModal.vue` 951 行)。

**Tech Stack:** Vue 3 `<script setup>` + TypeScript strict · vue-i18n 9 · reka-ui(Dialog/AlertDialog/ContextMenu 原语)· vitest + @vue/test-utils · 共享包 `@nimotech/nimoos-service`(`file:../NimoOS-Service`)。

---

## Global Constraints

以下每条对**所有任务**生效,不再逐任务重复。

1. **工作树**:New-UI 与 NimoOS-Service 都在**主工作树 master**,不开 worktree。**永远不要 `git checkout` / `git stash`**(index 里长期躺着 3 个 `design-export/*` staged 删除,会被卷走)。**`git commit` 那一行必须带 pathspec**,只 `git add` 对的文件不算安全。不碰 `.sp7/` `.sp8/`。
2. **提交格式**:`git add <明确路径…>` 然后 `git commit <同样的明确路径…> -m "..."`。**永不** `-a`、**永不** `add -A`、**永不** `stash -u`。
3. **⛔ 三条禁止真跑的写操作**(详见下方「破坏面判定」):不发 `POST /v1/sys/migrate`、不发 `POST /v1/container/prune`、不发 `POST/PUT/DELETE /v1/folder`(浏览步骤里的新建/重命名/删除文件夹)。curl 不发、浏览器不点。
4. **i18n**:新文案**只**落 `src/i18n/zh_cn.sp9.ts` 与 `src/i18n/en_us.sp9.ts` 两个分片,**两边必须同时加**(`parity.test.ts` 断言合并后键集合一致)。扁平 key、值必须是字符串,不能嵌套对象。**不碰 `zh_cn.ts` / `en_us.ts`**。
5. **中文文案以 Vue2 为准,不自己译**。先查 `NimoOS-UI/src/assets/lang/zh_CN.json`;它不全,组件内联的 `zh:` 字段也要查。本期已逐条查过,译文在各任务里给出,**照抄即可,不要重译**。
6. **颜色只能用 theme token**。新语义 token 加进 `src/styles/theme.sp9.css`,且 `:root` 与 `:root[data-theme="light"]` **两块都要给值**。**不碰 `theme.css`**。
7. **移植纪律**:界面严格 1:1;Vue2 的 bug / 竞态 / 吞错**不照抄**,改正确并**在代码里写注释登记**;禁无关重构。
8. **异步过期守卫**:任何「onMounted 取数 → 赋给本地 ref」的组件都要**就地**写一个 `touched` 布尔(**不抽公共 helper**,评审判过是过早抽象)。交错测试必须用可手动 resolve 的 deferred 把加载挂住、期间改控件,**先 await 再改证明不了任何东西**。
9. **弹窗**:报错**不用 toast**(toast `z-index:60`,Dialog 遮罩 `z-index:1000` 且带毛玻璃 → 被压住+糊掉),用弹窗内联 `.set-danger` 并**优先显示后端 message**。弹窗测试必须 `attachTo: document.body` 并查 `document`(reka `DialogPortal` teleport)。
10. **弹窗表单里的输入框**必须包在 `.set-net-field` 同类容器里或自己覆盖宽度,否则吃到 `.set-input` 的 `width:92px`(那是设置**行**里短框专用)导致值被截断。
11. **fixture 一律真机逐字抓取,不得手编**。本期已抓好的在 `/tmp/claude-1000/-home-nimo-NimoTech/bc00dd6c-5011-462d-95b1-0f3181b3993c/scratchpad/fixtures-p3/`,各任务里已内联可直接用。
12. **任务门**(每个任务结束时):`pnpm test` 相关文件绿 + `pnpm exec vue-tsc --noEmit` 0 错误。全量门在 Task 9。**测试数对不上先想 `color-guard.test.ts`** —— 它按文件动态生成用例,新增 1 个 `.vue` 就多 1 条。
13. **改了 NimoOS-Service 必须 `cd ../NimoOS-Service && pnpm build`**;消费方报 `Module not found` 再 `pnpm install`。
14. **@vue/test-utils 不给 disabled 元素派发事件** —— 「在途时再点同一个按钮」这类竞态用例不成立,要换成真实路径。
15. 测试里读 `.css` 源码**一律用 `node:fs`**(`?raw` 恒返回空串)。

---

## 破坏面判定(开工前已读 Go 源码 + curl 实测,结论已定,**不要重新判断**)

### ⛔ 1. `POST /v1/sys/migrate` —— 破坏性极高,本期一次都不发

读 `NimoOS/service/migrate.go` 逐段确认,它会:

| 阶段 | 动作 | 源码 |
|---|---|---|
| 1 停服务 | `docker ps -q` 记下运行中容器 → `systemctl stop docker.socket docker containerd` → `pkill -9 -f containerd-shim`;photos 类型还先停 `nimoos-photos` | `migrate.go:454-484` |
| 2 预检 | statfs 目标盘,需 `size + 5% + 1GiB` | `:280-299` |
| 3 拷贝 | `rsync -a --one-file-system` 到 `<dst>.migrating` 暂存 | `:597-660` |
| 4 换锚点 | `rename anchor→anchor.bak` + `symlink dst→anchor`,**全部换成功后 `os.RemoveAll` 删掉旧数据** | `:777-820` |
| 5 收尾 | 写 `/var/lib/nimoos/path_config.json` + `systemctl start containerd docker.socket docker` | `:823-828` |

- **可中断性**:有 SIGTERM 清理(`CleanupActiveMigration`)与分阶段回滚,但 Phase 2 之后旧数据**已被删除**,回滚不再可能。
- **失败留半截**:暂存目录 + `.old` / `.bak` 机制使多数失败路径能回滚;`rollback rename failed` 分支源码自己写着 `CRITICAL: manual intervention required`。
- **本机额外事实**:`GET /v1/storage?system=show` 只有**一个分区**(`/dev/nvme0n1p7` 挂 `/`,label `NimoOS-HD`)→ Vue2 的 `availablePartitions`(= 全部分区剔除当前分区)**恒为空** → 迁移弹窗第一步就是「没有其他可用的存储」空态,**Next 按钮 disabled**。所以**在本机这条路径从界面上根本走不通**,只能靠 curl 触发——而我们不发。
- **处置**:界面全做、纯逻辑全测,`select` 之后的 4 个步骤(browse / confirm / migrating / done / error)**只有单测,不列验收项**,登记为债务 **D22**。

### ⛔ 2. `POST /v1/container/prune` —— 会删掉桌面小组件容器,用户 2026-08-01 拍板不点

后端 = `NimoOS-AppManagement/service/container.go:902` `cli.ContainersPrune(ctx, filters.Args{})` + `cli.ImagesPrune(ctx, filters.Args{})`(路由 `route/v1.go:106`)。空过滤器 = **删掉全部已停止容器** + 悬空镜像。

本机 `docker ps -a` 实测(2026-08-01):

```
arize-phoenix-phoenix-1                       running   ← 不动
nimoos-agent-agent-1                          running   ← 不动
nimoos-photos-ml-immich-machine-learning-1    running   ← 不动
nimoos-demo-widget                            exited    ← 会被删
todo-widget                                   exited    ← 会被删
```

`nimoos-demo-widget` / `todo-widget` 正是桌面上那两个小组件容器。另有 1 个 1.94GB 悬空镜像会被删;build cache 1.44GB 不在删除范围内。

**用户 2026-08-01 拍板:不点、挂账 D23。** 界面做完整,确认框与失败分支由单测覆盖,验收清单第一屏写明「不要点」。

### ⛔ 3. 迁移弹窗浏览步骤里的文件夹写操作 —— 同样不真跑

`POST /v1/folder`(新建)、`PUT /v1/folder`(重命名)、`POST /v1/batch/delete`(删除)会真的动 `/DATA` 下的目录。由于整个 browse 步骤在本机不可达(见上),这三条自然也到不了,**不列验收项**,只有单测(mock service)。

### ✅ 可以放心做的(已实测无副作用)

`GET /v1/gateway/components` · `GET /v1/sys/paths` · `GET /v1/sys/logs` · `GET /v1/storage` · `GET /v1/disks` · `GET /v1/folder?path=…` · `GET /v2/nimoos/health/logs`(下载日志 zip)。

---

## 真机 fixture(2026-08-01 逐字抓取,**不得手编**)

原始文件目录:`/tmp/claude-1000/-home-nimo-NimoTech/bc00dd6c-5011-462d-95b1-0f3181b3993c/scratchpad/fixtures-p3/`

### F1 `GET /v1/sys/paths` → 200,**标准信封**

```json
{"success":200,"message":"ok","data":{
  "app_data":{"path":"/DATA/AppData","size":6037987},
  "database":{"path":"/DATA","size":3554691143},
  "images":{"path":"/DATA/.system_data/.docker & .containerd","size":55559455762},
  "photos_data":{"path":"/DATA/.system_data/photos","size":6242024935}}}
```

**三条硬事实**:① 与共享包 `SystemPaths = Record<string, SystemPathEntry{path,size}>` **完全对得上**(P1 只按 Go struct 猜的类型,本期实证通过);② `images.path` 是**展示用字符串**,含 ` & ` 不是真实路径;③ 后端返回 **4 个 key**,Vue2 只渲染 3 行(无 `photos_data`)→ **1:1 照留 3 行**。

### F2 `GET /v1/gateway/components` → 200,**裸 JSON 无信封**(印证 P1 实测校正①)

```json
{"components":[
 {"name":"Gateway","category":"service","version":"1.9.3-alpha1+28.g0dc16d6","status":"online","error":"","probed_at":"2026-08-01T02:15:55Z"},
 {"name":"NimoOS Core","category":"service","version":"1.9.3-alpha1+25.gc8d7d14-dirty","status":"online","error":"","probed_at":"..."},
 {"name":"App Management","category":"service","version":"1.9.3-alpha1+14.g30dff84","status":"online","error":"","probed_at":"..."},
 {"name":"User Service","category":"service","version":"","status":"offline","error":"unexpected status Internal Server Error","probed_at":"..."},
 {"name":"Local Storage","category":"service","version":"1.9.3-alpha1+3.g8676090","status":"online","error":"","probed_at":"..."},
 {"name":"Message Bus","category":"service","version":"","status":"offline","error":"unexpected status Bad Request","probed_at":"..."},
 {"name":"AI","category":"service","version":"1.9.3-alpha1+10.g5485a31-dirty","status":"online","error":"","probed_at":"..."},
 {"name":"Search","category":"service","version":"1.9.3-alpha1+23.ga392725","status":"online","error":"","probed_at":"..."},
 {"name":"Wiki","category":"service","version":"","status":"offline","error":"unexpected status Not Found","probed_at":"..."},
 {"name":"Photos","category":"service","version":"1.9.3-alpha1+24.gbd0e031","status":"online","error":"","probed_at":"..."},
 {"name":"Terminal","category":"service","version":"","status":"offline","error":"unexpected status Not Found","probed_at":"..."},
 {"name":"Parser","category":"service","version":"","status":"offline","error":"unexpected status Not Found","probed_at":"..."},
 {"name":"NimoOS UI","category":"ui","version":"1.9.3-alpha1+20.g5c325a42-dirty","status":"online","error":"","probed_at":"..."},
 {"name":"Qdrant","category":"external","version":"1.18.1","status":"online","error":"","probed_at":"..."},
 {"name":"Ollama","category":"external","version":"","status":"offline","error":"Get \"http://127.0.0.1:11434/api/version\": dial tcp 127.0.0.1:11434: connect: connection refused","probed_at":"..."},
 {"name":"Docker","category":"external","version":"29.5.2","status":"online","error":"","probed_at":"..."},
 {"name":"Photos ML","category":"external","version":"","status":"online","error":"","probed_at":"..."}]}
```

共 **17 条**:service 12 · ui 1 · external 4。其中 **6 条 offline**(User Service / Message Bus / Wiki / Terminal / Parser / Ollama)。

### F3 `GET /v1/storage?system=show` → 200,标准信封

```json
{"success":200,"message":"ok","data":[{"disk_name":"System","size":512110190592,"path":"/dev/nvme0n1","type":"nvme",
 "children":[{"uuid":"da0e4da3-4a51-4655-8d89-d0f761d08c0a","mount_point":"/","size":"512110190592",
   "avail":"333092294144","used":"179017896448","type":"ext4","path":"/dev/nvme0n1p7",
   "drive_name":"nvme0n1p7","label":"NimoOS-HD","persisted_in":"none"}]}]}
```

⚠️ `size`/`avail`/`used` 是**字符串**。经 SP6 的 `mapVolumes` 之后:`{uuid:'da0e…', name:'NimoOS-HD', isSystem:true, fsType:'ext4', size:512110190592, availSize:333092294144, usedSize:179017896448, usePercent:35, mountPoint:'/'}`。

### F4 `GET /v1/sys/logs` → 200,标准信封,`data` 是**一整块 2.67 MB 的字符串**

```
2026-04-13T15:38:19.417-0400\tinfo\tInitPathConfig: images path mismatch, self-healing\t{"configured": "/DATA/.system_data/.docker", "actual": "/var/lib/docker", ...}
```

**2,669,425 字符**。这是本期发现的性能坑:Vue2 在 terminal tab 打开时**每 5 秒**拉一次这 2.67MB。1:1 照留,登记后端票 **D24**(端点无 tail/limit 参数)。

### F5 `GET /v1/folder?path=/DATA` → 200,标准信封

```json
{"success":200,"message":"ok","data":{"content":[
 {"name":".snapshots","size":4096,"is_dir":true,"is_symlink":false,"modified":"2026-07-30T22:08:06.07507098+08:00","sign":"","thumb":"","type":0,"path":"/DATA/.snapshots","date":"...","extensions":null},
 {"name":".system_data","size":4096,"is_dir":true,"is_symlink":false,...,"path":"/DATA/.system_data",...},
 {"name":".wiki.md","size":2721,"is_dir":false,"is_symlink":false,...,"path":"/DATA/.wiki.md",...}]}
```

⚠️ 共享包的 `FolderEntry` 只有 `{name,path,is_dir}`,**缺 `is_symlink`**(真实响应里有,AppPathModal 靠它过滤)→ Task 1 补上。

### F6 `GET /v1/sys/migrate/<不存在的 id>` → **HTTP 400**

```json
{"success":4000,"message":"job not found","data":null}
```

→ axios 自己 reject,`unwrap()` 到不了。轮询里的 catch 要能吃住。

### F7 `/v1/terminal/settings` → **HTTP 404** `{"message":"Not Found"}`,`/v1/sys/wsssh` → **HTTP 404**

整个 Terminal 服务在这台机器上不存在(F2 里 `Terminal` 组件也是 `unexpected status Not Found`)。**这条更正 spec §5.5** —— 它把 `TerminalSecuritySection`(172 行)当能用的写进了交付物。

### F8 `GET /v2/nimoos/health/logs`(下载日志)→ 200

响应头 `Content-Disposition: attachment; filename*=utf-8''NimoOS.zip`,`Content-Type: application/octet-stream`,是个 zip(内含 `app-management.log` 等)。鉴权:`NimoOS/route/v2.go:77` 的 Skipper 认 **`?token=` 查询参数**(有 auth 信息就走真校验,没有才 localhost 免检)。

---

## 用户 2026-08-01 拍板的 3 个决策

| # | 问题 | 拍板 |
|---|---|---|
| 1 | `/v1/terminal/settings` 也 404(spec §5.5 记载有误) | **终端位 + 安全设置合成一块空态**,复用 Vue2 原文案 `terminal.unavailable`「终端服务暂不可用」,**不渲染那 172 行密码表单**。理由:一个只会 404 失败的密码输入框比空态更糟——用户会把真账户密码敲进去。terminal tab 只留 Logs 卡(真数据)。→ **授权偏离 #9** |
| 2 | 12 条**全部 31 个语言文件都缺译**的文案 | **补中文译**(同 P2 授权偏离 #8 先例)→ **授权偏离 #10** |
| 3 | Docker 缓存清理是否验收时真点 | **不点、挂账 D23**(会删掉桌面那两个小组件容器) |

---

## 文件结构

```
NimoOS-Service(共享包,本期唯一改动 = 1 个方法 + 1 个可选字段 + 1 个类型)
  src/container.ts              + prune(): Promise<PruneReport>
  src/types.ts                  + PruneReport;FolderEntry 补 is_symlink?: boolean
  src/container.test.ts         + 3 例

New-UI
  src/settings/util/appPaths.ts            App 数据位置三行的派生(纯函数)
  src/settings/util/appPaths.test.ts
  src/settings/util/migrateBrowse.ts       迁移弹窗浏览步骤的纯逻辑(目标路径/面包屑/过滤/根路径)
  src/settings/util/migrateBrowse.test.ts
  src/settings/util/sysLog.ts              日志文本变换(Vue2 那套去时间戳)
  src/settings/util/sysLog.test.ts
  src/settings/util/components.ts          system-status 分组派生
  src/settings/util/components.test.ts
  src/settings/panels/apps/AppPathRow.vue          三行之一(标签 + 两个 chip + 右侧按钮)
  src/settings/panels/apps/AppPathDialog.vue       迁移弹窗(6 步)= Vue2 AppPathModal 对位物
  src/settings/panels/terminal/LogsCard.vue        日志卡(暗底等宽 + 全屏 + 下载)
  改:src/settings/panels/AppsPanel.vue             骨架 → 实体
  改:src/settings/panels/SystemStatusPanel.vue     骨架 → 实体
  改:src/settings/panels/TerminalPanel.vue         骨架 → 实体
  改:src/settings/panels/StoragePanel.vue          骨架 → 入口卡(授权偏离 #3)
  改:src/settings/styles/settings.css              .set-app-* / .set-logs-* / .set-comp-* / .set-store-entry
  改:src/styles/theme.sp9.css                      + 3 个 token(两套主题块都给值)
  改:src/i18n/{zh_cn,en_us}.sp9.ts                 + 约 60 条
  改:src/settings/panels/panels.test.ts            四个 tab 的装配断言
```

---

## Task 1: 共享包 `container.prune()` + `FolderEntry.is_symlink`

**Files:**
- Modify: `/home/nimo/NimoTech/NimoOS-Service/src/container.ts`
- Modify: `/home/nimo/NimoTech/NimoOS-Service/src/types.ts`
- Test: `/home/nimo/NimoTech/NimoOS-Service/src/container.test.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `service.container.prune(): Promise<PruneReport>`
  - `interface PruneReport { containers: { ContainersDeleted: string[] | null; SpaceReclaimed: number } | null; images: { ImagesDeleted: unknown[] | null; SpaceReclaimed: number } | null }`
  - `FolderEntry` 增加 `is_symlink?: boolean`

**背景(别拿错端点)**:设置 apps tab 要的是 `POST /v1/container/prune`(`NimoOS-AppManagement/route/v1.go:106` → `PruneDocker`),**不是** `NimoOS-UI/src/service/sys.js:154` 那个同名 `prune()`(它打 `POST /v1/sys/prune`)。这条**更正 roadmap §3.3 里 SP5-P8「container v1 不进包」的判定**(spec §1.12 / 债务 D10)。

响应是**标准信封**(`docker.go:693-704`):`{"success":200,"message":"ok","data":{"containers":{...},"images":{...}}}`,`data` 里两个 key 是 Docker SDK 的 `types.ContainersPruneReport` / `types.ImagesPruneReport`(**大写驼峰字段名**,Go SDK 结构体没有 json tag 改写)。

- [ ] **Step 1: 写失败测试**

在 `src/container.test.ts` 末尾追加(文件已有 `getNetworks` 的测试,照它的 mock 写法):

```ts
  it('prune 打 POST /v1/container/prune 并剥标准信封', async () => {
    const post = vi.fn().mockResolvedValue({
      data: {
        success: 200,
        message: 'ok',
        data: {
          containers: { ContainersDeleted: ['abc123'], SpaceReclaimed: 159700 },
          images: { ImagesDeleted: [{ Deleted: 'sha256:a2501141440f' }], SpaceReclaimed: 1940000000 },
        },
      },
    })
    const c = createContainer({ post } as never)
    const r = await c.prune()
    expect(post).toHaveBeenCalledWith('/container/prune')
    expect(r.containers?.SpaceReclaimed).toBe(159700)
    expect(r.images?.ImagesDeleted).toHaveLength(1)
  })

  it('prune 的 data 缺字段时退化成 null,不抛', async () => {
    const post = vi.fn().mockResolvedValue({ data: { success: 200, message: 'ok', data: {} } })
    const c = createContainer({ post } as never)
    await expect(c.prune()).resolves.toEqual({ containers: null, images: null })
  })

  it('prune 遇到非 200 信封抛出后端 message', async () => {
    const post = vi.fn().mockResolvedValue({ data: { success: 50001, message: 'docker daemon unreachable', data: null } })
    const c = createContainer({ post } as never)
    await expect(c.prune()).rejects.toThrow('docker daemon unreachable')
  })
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd /home/nimo/NimoTech/NimoOS-Service && pnpm exec vitest run src/container.test.ts
```
预期:FAIL —— `c.prune is not a function`

- [ ] **Step 3: 实现**

`src/types.ts` 里,`FolderEntry` 改成:

```ts
export interface FolderEntry {
  name: string
  path: string
  is_dir: boolean
  // 真实响应里有(2026-08-01 实测 GET /v1/folder?path=/DATA),迁移弹窗的浏览步骤
  // 靠它把符号链接排除在目标目录之外。可选是为了不打破既有构造点。
  is_symlink?: boolean
}
```

并新增:

```ts
/** POST /v1/container/prune 的 data。字段名是 Docker SDK 结构体的大写驼峰
 *  (NimoOS-AppManagement/service/container.go:902 直接把 types.ContainersPruneReport /
 *   types.ImagesPruneReport 塞进信封,没有 json tag 改写)。 */
export interface PruneReport {
  containers: { ContainersDeleted: string[] | null; SpaceReclaimed: number } | null
  images: { ImagesDeleted: unknown[] | null; SpaceReclaimed: number } | null
}
```

`src/container.ts`:

```ts
import type { DockerNetwork, PruneReport } from './types.js'
...
    /** POST /v1/container/prune(v1 标准信封)。
     *  ⚠️ 与 NimoOS-UI/src/service/sys.js:154 的同名 prune() 不是一回事 —— 那个打 /v1/sys/prune。
     *  ⚠️ 后端是 ContainersPrune(空过滤器) + ImagesPrune(空过滤器):
     *     **删掉全部已停止的容器** + 悬空镜像。调用方必须有二次确认。 */
    async prune(): Promise<PruneReport> {
      const res = await http.post('/container/prune')
      const d = unwrap<Partial<PruneReport> | null>(res.data)
      return { containers: d?.containers ?? null, images: d?.images ?? null }
    },
```

`src/index.ts` 若有导出类型清单,把 `PruneReport` 加进去(照 `DockerNetwork` 的写法)。

- [ ] **Step 4: 跑测试确认通过 + 构建**

```bash
cd /home/nimo/NimoTech/NimoOS-Service && pnpm exec vitest run src/container.test.ts && pnpm test && pnpm build
```
预期:container.test.ts 全绿;全量从 25 文件/169 例 → 25 文件/**172 例**;`pnpm build` 通过。

- [ ] **Step 5: 提交(带 pathspec)**

```bash
cd /home/nimo/NimoTech/NimoOS-Service
git add src/container.ts src/types.ts src/container.test.ts src/index.ts
git commit src/container.ts src/types.ts src/container.test.ts src/index.ts -m "feat(container): 补 prune() —— 设置 apps tab 的 Docker 缓存清理(更正 SP5-P8 判定)"
```

---

## Task 2: `util/appPaths.ts` —— App 数据位置三行的派生

**Files:**
- Create: `src/settings/util/appPaths.ts`
- Test: `src/settings/util/appPaths.test.ts`

**Interfaces:**
- Consumes: 共享包 `SystemPaths`;SP6 的 `StorageVolume`(`src/storage/util/storageMap.ts`)
- Produces:
  - `type AppPathKey = 'app_data' | 'images' | 'database'`
  - `interface AppPathRow { key: AppPathKey; path: string; size: number; total: number }`
  - `function buildAppPathRows(paths: SystemPaths | null, volumes: StorageVolume[]): AppPathRow[]` —— 恒返回 3 行,顺序固定 `app_data, images, database`
  - `function volumeForPath(path: string, volumes: StorageVolume[]): StorageVolume | null` —— 最长前缀匹配

**Vue2 对位**:`SettingsPanel.vue:1910-1971 loadAppsData()` 的 `enrichPathData` + `getPath`。

**两条移植纪律(要在代码注释里登记)**:

1. **不照抄 `getPath()` 往 localStorage 写 `app_data_path` / `app_images_path` / `user_database_path`** —— 全仓 grep 过,除了 `SettingsPanel.vue` 自己和 `AppPathModal.vue` 之外**没有任何读者**,New-UI 更不读。写了就是死代码(同 D14/D15「Vue2 恒不显示/恒不生效的东西不移植」的判据)。
2. **不照抄 `zimaHDD` 那段兜底** —— Vue2 找 `mount_point.includes('ZimaOS-HD')` 的分区当 `defaultTotal`,失败则写死 `970 * 1024³`。`mount_point` 是挂载点(本机 `/`),**永远不可能包含 'ZimaOS-HD'**(那是 CasaOS/ZimaOS 血统的 label 名),所以这段恒走 970GB 死值。改成:匹配不到分区时用**系统卷**的 `size`,再没有才 0(界面上 `total` 为 0 时该 chip 显示 `—`,见 Task 3)。

- [ ] **Step 1: 写失败测试**

`src/settings/util/appPaths.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildAppPathRows, volumeForPath } from './appPaths'
import type { StorageVolume } from '../../storage/util/storageMap'

// 真机 fixture(2026-08-01 curl GET /v1/storage?system=show 后过 mapVolumes)
const SYS_VOL: StorageVolume = {
  uuid: 'da0e4da3-4a51-4655-8d89-d0f761d08c0a',
  name: 'NimoOS-HD', isSystem: true, fsType: 'ext4',
  size: 512110190592, availSize: 333092294144, usedSize: 179017896448, usePercent: 35,
  driveName: 'nvme0n1p7', path: '/dev/nvme0n1p7', mountPoint: '/', disk: '/dev/nvme0n1',
}
const EXT_VOL: StorageVolume = {
  ...SYS_VOL, uuid: 'ext-1', name: 'Backup', isSystem: false,
  size: 2000000000000, availSize: 1000000000000, usedSize: 1000000000000, usePercent: 50,
  driveName: 'sda1', path: '/dev/sda1', mountPoint: '/media/Backup', disk: '/dev/sda',
}

// 真机 fixture(2026-08-01 curl GET /v1/sys/paths 的 data,逐字)
const PATHS = {
  app_data: { path: '/DATA/AppData', size: 6037987 },
  database: { path: '/DATA', size: 3554691143 },
  images: { path: '/DATA/.system_data/.docker & .containerd', size: 55559455762 },
  photos_data: { path: '/DATA/.system_data/photos', size: 6242024935 },
}

describe('volumeForPath', () => {
  it('取最长前缀匹配的分区,不是第一个命中的', () => {
    expect(volumeForPath('/media/Backup/AppData', [SYS_VOL, EXT_VOL])?.uuid).toBe('ext-1')
    expect(volumeForPath('/DATA/AppData', [SYS_VOL, EXT_VOL])?.uuid).toBe(SYS_VOL.uuid)
  })
  it('无分区可匹配时返回 null', () => {
    expect(volumeForPath('/DATA/AppData', [])).toBeNull()
  })
})

describe('buildAppPathRows', () => {
  it('恒返回 3 行且顺序固定 —— 后端给了 4 个 key(含 photos_data),Vue2 只渲染 3 行', () => {
    const rows = buildAppPathRows(PATHS, [SYS_VOL])
    expect(rows.map((r) => r.key)).toEqual(['app_data', 'images', 'database'])
  })
  it('size 与 path 逐字取后端值(images 的 path 是含 & 的展示串)', () => {
    const rows = buildAppPathRows(PATHS, [SYS_VOL])
    expect(rows[0]).toMatchObject({ path: '/DATA/AppData', size: 6037987 })
    expect(rows[1].path).toBe('/DATA/.system_data/.docker & .containerd')
    expect(rows[2]).toMatchObject({ path: '/DATA', size: 3554691143 })
  })
  it('total 取所在分区容量', () => {
    expect(buildAppPathRows(PATHS, [SYS_VOL])[0].total).toBe(512110190592)
  })
  it('挂载点是字符串前缀但不是祖先目录时不许命中(/media/BackupOld/x 不属于 /media/Backup)', () => {
    // ⚠️ 这条必须**不放** /media/BackupOld 这个卷,否则排序按挂载点长度取最长会把缺陷掩盖
    //   (裸 startsWith 下两个卷都命中,15 > 13 仍然返回对的那个 → 用例恒绿、变异不翻红)。
    //   只放 / 和 /media/Backup:裸 startsWith 会错命中 /media/Backup(13 > 1),
    //   只有边界判断能让它落回根卷。
    expect(volumeForPath('/media/BackupOld/x', [SYS_VOL, EXT_VOL])?.uuid).toBe(SYS_VOL.uuid)
  })
  it('匹配不到分区时回退系统卷容量(不照抄 Vue2 写死的 970GB)', () => {
    // 卷列表里没有根挂载点,查一个不在它下面的路径 → volumeForPath 返回 null,
    // fallbackTotal 才是唯一来源(否则 '/' 会把任何绝对路径都吃掉,这条用例就是空转的)
    const onlyExt: StorageVolume = { ...SYS_VOL, mountPoint: '/media/Backup' }
    const rows = buildAppPathRows({ app_data: { path: '/nowhere/x', size: 1 } }, [onlyExt])
    expect(rows[0].total).toBe(512110190592)
  })
  it('连系统卷都没有时 total 为 0', () => {
    expect(buildAppPathRows(PATHS, [])[0].total).toBe(0)
  })
  it('后端 data 为 null / 缺 key 时给出空路径 0 大小的三行,不抛', () => {
    const rows = buildAppPathRows(null, [SYS_VOL])
    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatchObject({ path: '', size: 0 })
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm exec vitest run src/settings/util/appPaths.test.ts
```
预期:FAIL —— 模块不存在

- [ ] **Step 3: 实现**

`src/settings/util/appPaths.ts`:

```ts
// 设置 · 应用 —— 「App 数据存储位置」三行的派生。
// Vue2 对位:SettingsPanel.vue:1910-1971 loadAppsData() 里的 enrichPathData / getPath。
//
// 移植纪律(登记,Vue2 的东西不照抄):
//  ① **不写 localStorage**。Vue2 的 getPath() 会把路径写进 app_data_path /
//     app_images_path / user_database_path 三个键(注释说是"清理陈旧的 localStorage")。
//     全仓 grep 过,除 SettingsPanel.vue 与 AppPathModal.vue 自己之外**没有任何读者**,
//     New-UI 也不读 → 照抄等于新造死代码(判据同 D14/D15)。
//  ② **不照抄 zimaHDD 兜底**。Vue2 找 mount_point.includes('ZimaOS-HD') 的分区当默认容量,
//     失败写死 970GB。mount_point 是挂载点(本机 '/'),永远不含 'ZimaOS-HD'(那是
//     CasaOS/ZimaOS 血统的卷 label),所以那段恒走 970GB 死值。这里改成回退到**系统卷**容量。
//
// 后端(2026-08-01 实测 GET /v1/sys/paths)返回 4 个 key —— app_data / images / database /
// photos_data,而 Vue2 只渲染前 3 个。界面 1:1 → 这里也只产出 3 行。
import type { SystemPaths } from '@nimotech/nimoos-service'
import type { StorageVolume } from '../../storage/util/storageMap'

export type AppPathKey = 'app_data' | 'images' | 'database'

export interface AppPathRow {
  key: AppPathKey
  path: string
  size: number
  total: number
}

const ORDER: AppPathKey[] = ['app_data', 'images', 'database']

/** 最长前缀匹配:/media/Backup/AppData 要命中 /media/Backup 而不是 /。
 *  ⚠️ 必须按**路径分段**判定(相等 或 以 `${挂载点}/` 开头),不能用裸 startsWith ——
 *  否则 /media/BackupOld/x 会被判成属于 /media/Backup。Vue2 的 enrichPathData 就是裸的,
 *  属于「Vue2 的 bug 不照抄」;本仓 src/files/util/snapshotPath.ts 的 findVolumeForPath
 *  已有同源的正确写法(注释:'/DATAX' 不该被判成属于 '/DATA')。
 *  根挂载点 '/' 是特例:`//` 前缀永不命中,必须让它匹配所有绝对路径。 */
export function volumeForPath(path: string, volumes: StorageVolume[]): StorageVolume | null {
  return (
    volumes
      .filter((v) => v.mountPoint && (v.mountPoint === '/' ? path.startsWith('/')
        : path === v.mountPoint || path.startsWith(`${v.mountPoint}/`)))
      .sort((a, b) => b.mountPoint.length - a.mountPoint.length)[0] ?? null
  )
}

export function buildAppPathRows(paths: SystemPaths | null, volumes: StorageVolume[]): AppPathRow[] {
  const fallbackTotal = volumes.find((v) => v.isSystem)?.size ?? 0
  return ORDER.map((key) => {
    const entry = paths?.[key]
    const path = entry?.path ?? ''
    const vol = path ? volumeForPath(path, volumes) : null
    return { key, path, size: entry?.size ?? 0, total: vol?.size ?? fallbackTotal }
  })
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm exec vitest run src/settings/util/appPaths.test.ts && pnpm exec vue-tsc --noEmit
```
预期:8 例全绿,tsc 0 错误

- [ ] **Step 5: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git add src/settings/util/appPaths.ts src/settings/util/appPaths.test.ts
git commit src/settings/util/appPaths.ts src/settings/util/appPaths.test.ts -m "feat(settings): App 数据位置三行的派生(最长前缀匹配分区容量)"
```

---

## Task 3: `util/migrateBrowse.ts` —— 迁移弹窗浏览步骤的纯逻辑

**Files:**
- Create: `src/settings/util/migrateBrowse.ts`
- Test: `src/settings/util/migrateBrowse.test.ts`

**Interfaces:**
- Consumes: Task 2 的 `AppPathKey`;共享包 `FolderEntry`;`src/files/util/pathUtils.ts` 的 `toVirtualPath` 与 `DisplayNames`
- Produces:
  - `function browseRootPath(mountPoint: string): string`
  - `function browseDestPaths(type: AppPathKey, base: string): string[]`
  - `function browseCrumbs(root: string, current: string, displayNames: DisplayNames): Array<{ name: string; path: string }>`
  - `function filterBrowseFolders(items: FolderEntry[], type: AppPathKey, currentPath: string): FolderEntry[]`
  - `const PROTECTED_FOLDER_NAMES: readonly string[]`
  - `function isProtectedFolder(name: string): boolean`
  - `function parentPath(path: string, root: string): string`

**Vue2 对位**:`AppPathModal.vue` 的 `browseRootPath`(:398)· `browseDestPaths`(:419)· `browseCrumbs`(:404)· `browseFolders`(:435)· `navigateUp`(:503)· `PROTECTED_FOLDER_NAMES`(:336)。**这些是纯函数,逐字对位移植。**

- [ ] **Step 1: 写失败测试**

`src/settings/util/migrateBrowse.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  browseRootPath, browseDestPaths, browseCrumbs, filterBrowseFolders,
  isProtectedFolder, parentPath,
} from './migrateBrowse'
import type { FolderEntry } from '@nimotech/nimoos-service'

const DN = { '/DATA': 'NimoOS-HD', '/media/Backup': 'Backup' }

describe('browseRootPath', () => {
  it('系统盘(挂载点 /)限制在 /DATA,不让用户看到 / 下的兄弟目录', () => {
    expect(browseRootPath('/')).toBe('/DATA')
  })
  it('其它分区就是挂载点本身', () => {
    expect(browseRootPath('/media/Backup')).toBe('/media/Backup')
  })
})

describe('browseDestPaths —— 与 migrate.go 追加的子目录逐字一致', () => {
  it('app_data → 单个 AppData', () => {
    expect(browseDestPaths('app_data', '/media/Backup')).toEqual(['/media/Backup/AppData'])
  })
  it('images → .docker 与 .containerd 两个', () => {
    expect(browseDestPaths('images', '/media/Backup')).toEqual([
      '/media/Backup/.docker', '/media/Backup/.containerd',
    ])
  })
  it('database → 四个用户目录', () => {
    expect(browseDestPaths('database', '/media/Backup')).toEqual([
      '/media/Backup/Documents', '/media/Backup/Downloads',
      '/media/Backup/Gallery', '/media/Backup/Media',
    ])
  })
  it('base 尾部斜杠被吃掉,不产生 //', () => {
    expect(browseDestPaths('app_data', '/media/Backup/')).toEqual(['/media/Backup/AppData'])
  })
})

describe('browseCrumbs', () => {
  it('根用 displayNames 的显示名,后续段用目录名', () => {
    expect(browseCrumbs('/DATA', '/DATA/a/b', DN)).toEqual([
      { name: 'NimoOS-HD', path: '/DATA' },
      { name: 'a', path: '/DATA/a' },
      { name: 'b', path: '/DATA/a/b' },
    ])
  })
  it('current 就是 root 时只有一段', () => {
    expect(browseCrumbs('/DATA', '/DATA', DN)).toEqual([{ name: 'NimoOS-HD', path: '/DATA' }])
  })
  it('current 不在 root 之下时返回空数组(防越权渲染)', () => {
    expect(browseCrumbs('/DATA', '/etc', DN)).toEqual([])
  })
  it('displayNames 里没有该根时回退最后一段目录名', () => {
    expect(browseCrumbs('/media/X', '/media/X', {})).toEqual([{ name: 'X', path: '/media/X' }])
  })
})

describe('filterBrowseFolders', () => {
  const mk = (name: string, path: string, extra: Partial<FolderEntry> = {}): FolderEntry =>
    ({ name, path, is_dir: true, is_symlink: false, ...extra })
  const items: FolderEntry[] = [
    mk('AppData', '/DATA/AppData'),
    mk('Documents', '/DATA/Documents'),
    mk('.docker', '/DATA/.docker'),
    mk('.hidden', '/DATA/.hidden'),
    mk('link', '/DATA/link', { is_symlink: true }),
    mk('readme.txt', '/DATA/readme.txt', { is_dir: false }),
    mk('Backup', '/DATA/Backup'),
  ]
  it('只留真目录:排除文件、符号链接、点开头', () => {
    const names = filterBrowseFolders(items, 'app_data', '/media/Other').map((f) => f.name)
    expect(names).toContain('Backup')
    expect(names).not.toContain('readme.txt')
    expect(names).not.toContain('link')
    expect(names).not.toContain('.hidden')
  })
  it('迁 app_data 时不屏蔽 AppData,但屏蔽 Documents 等其它类型的目标名', () => {
    const names = filterBrowseFolders(items, 'app_data', '/media/Other').map((f) => f.name)
    expect(names).toContain('AppData')
    expect(names).not.toContain('Documents')
  })
  it('迁 database 时屏蔽 AppData,保留 Documents', () => {
    const names = filterBrowseFolders(items, 'database', '/media/Other').map((f) => f.name)
    expect(names).not.toContain('AppData')
    expect(names).toContain('Documents')
  })
  it('把源路径自身及其子树排除掉(不能迁到自己里面)', () => {
    const names = filterBrowseFolders(items, 'app_data', '/DATA/AppData').map((f) => f.name)
    expect(names).not.toContain('AppData')
  })
})

describe('isProtectedFolder —— 与后端 isProtectedName 名单一致', () => {
  it.each(['AppData', 'Documents', 'Downloads', 'Gallery', 'Media', '.docker', '.containerd'])(
    '%s 受保护(不许重命名/删除)', (n) => expect(isProtectedFolder(n)).toBe(true),
  )
  it('普通目录不受保护', () => expect(isProtectedFolder('Backup')).toBe(false))
})

describe('parentPath', () => {
  it('回到父目录', () => expect(parentPath('/DATA/a/b', '/DATA')).toBe('/DATA/a'))
  it('已经在根就停在根', () => expect(parentPath('/DATA', '/DATA')).toBe('/DATA'))
  it('不会越过根', () => expect(parentPath('/DATA/a', '/DATA')).toBe('/DATA'))
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm exec vitest run src/settings/util/migrateBrowse.test.ts
```
预期:FAIL —— 模块不存在

- [ ] **Step 3: 实现**

`src/settings/util/migrateBrowse.ts`:

```ts
// 设置 · 应用 —— 迁移弹窗「浏览目标目录」步骤的纯逻辑。
// Vue2 对位:AppPathModal.vue 的 browseRootPath(:398) / browseDestPaths(:419) /
//   browseCrumbs(:404) / browseFolders(:435) / navigateUp(:503) / PROTECTED_FOLDER_NAMES(:336)。
// 目标子目录名逐字对位后端 NimoOS/service/migrate.go:311-378 的 units 构造 —— 改这里必须同步看那段。
import type { FolderEntry } from '@nimotech/nimoos-service'
import { toVirtualPath, type DisplayNames } from '../../files/util/pathUtils'
import type { AppPathKey } from './appPaths'

/** 与后端 isProtectedName 名单一致(NimoOS/route/v1/file.go:1258)。 */
export const PROTECTED_FOLDER_NAMES = [
  'AppData', 'Documents', 'Downloads', 'Gallery', 'Media', '.docker', '.containerd',
] as const

export function isProtectedFolder(name: string): boolean {
  return (PROTECTED_FOLDER_NAMES as readonly string[]).includes(name)
}

/** 系统盘限制在 /DATA:用户不该看到 / 下的兄弟目录。 */
export function browseRootPath(mountPoint: string): string {
  return mountPoint === '/' ? '/DATA' : mountPoint
}

/** 界面上要告诉用户"数据最终会落到哪几个目录" —— 与 migrate.go 追加的子目录一致。 */
export function browseDestPaths(type: AppPathKey, base: string): string[] {
  const b = base.replace(/\/$/, '')
  if (type === 'images') return [`${b}/.docker`, `${b}/.containerd`]
  if (type === 'app_data') return [`${b}/AppData`]
  return ['Documents', 'Downloads', 'Gallery', 'Media'].map((d) => `${b}/${d}`)
}

export function browseCrumbs(
  root: string, current: string, displayNames: DisplayNames,
): Array<{ name: string; path: string }> {
  const cur = current || root
  if (!cur.startsWith(root)) return []
  const virt = toVirtualPath(root, displayNames)
  const rootName = virt !== root
    ? virt.replace(/^\//, '')
    : root.split('/').filter(Boolean).pop() || root
  const crumbs = [{ name: rootName, path: root }]
  let acc = root
  for (const seg of cur.slice(root.length).split('/').filter(Boolean)) {
    acc = acc.replace(/\/$/, '') + '/' + seg
    crumbs.push({ name: seg, path: acc })
  }
  return crumbs
}

/** 只留可作为迁移目标的真目录。 */
export function filterBrowseFolders(
  items: FolderEntry[], type: AppPathKey, currentPath: string,
): FolderEntry[] {
  const blocked: string[] = []
  if (type !== 'app_data') blocked.push('AppData')
  if (type !== 'images') blocked.push('.docker', '.containerd')
  if (type !== 'database') blocked.push('Documents', 'Downloads', 'Gallery', 'Media')
  const src = currentPath ? currentPath.replace(/\/$/, '') : ''
  return items.filter((it) => {
    if (!it.is_dir || it.is_symlink || it.name.startsWith('.')) return false
    if (blocked.includes(it.name)) return false
    if (src && (it.path === src || it.path.startsWith(src + '/'))) return false
    return true
  })
}

export function parentPath(path: string, root: string): string {
  if (path === root) return root
  const parent = path.replace(/\/[^/]+$/, '') || root
  return parent.length >= root.length ? parent : root
}
```

⚠️ 实现时先确认 `src/files/util/pathUtils.ts` 是否导出 `DisplayNames` 类型;若不导出,改成 `Record<string, string>` 并在注释里说明。

- [ ] **Step 4: 跑测试确认通过**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm exec vitest run src/settings/util/migrateBrowse.test.ts && pnpm exec vue-tsc --noEmit
```
预期:约 20 例全绿,tsc 0 错误

- [ ] **Step 5: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git add src/settings/util/migrateBrowse.ts src/settings/util/migrateBrowse.test.ts
git commit src/settings/util/migrateBrowse.ts src/settings/util/migrateBrowse.test.ts -m "feat(settings): 迁移弹窗浏览步骤的纯逻辑(目标路径/面包屑/目录过滤)"
```

---

## Task 4: 文案分片 + 样式 + token

**Files:**
- Modify: `src/i18n/zh_cn.sp9.ts`
- Modify: `src/i18n/en_us.sp9.ts`
- Modify: `src/styles/theme.sp9.css`
- Modify: `src/settings/styles/settings.css`

**Interfaces:**
- Produces: 下列 i18n key + `.set-app-*` / `.set-comp-*` / `.set-logs-*` / `.set-store-entry` 样式类 + 3 个 token

**文案来源**:除标 🆕 的 12 条外,**全部逐字取自 `NimoOS-UI/src/assets/lang/zh_CN.json`**(已核对);🆕 的 12 条是**全部 31 个语言文件都缺译**的,用户 2026-08-01 拍板补中文译(授权偏离 #10)。

- [ ] **Step 1: 加中文分片**

在 `src/i18n/zh_cn.sp9.ts` 的对象末尾追加(保持已有的扁平 key 命名风格 `settingsXxx`):

```ts
  // ── P3 apps tab ────────────────────────────────────────────────────────
  settingsAppsPathTitle: 'App 数据存储位置',
  settingsAppsAppData: 'App 数据',
  settingsAppsImages: 'App 镜像集',
  settingsAppsDatabase: '用户数据库',
  settingsAppsChangeLocation: '更改存储位置',
  settingsAppsDockerCleanTitle: 'Docker 缓存清理',
  settingsAppsDockerCleanSub: '您的 Docker 环境已优化。',
  settingsAppsDockerCleaning: '正在优化...',
  settingsAppsDockerCleanConfirmTitle: '清理 Docker 缓存',                          // 🆕补译
  settingsAppsDockerCleanConfirmMsg: '这将删除所有未使用的容器、网络和镜像。确定要继续吗?', // 🆕补译
  settingsAppsDockerCleanConfirmOk: '清理',                                        // 🆕补译
  settingsAppsDockerCleanDone: 'Docker 环境已优化。',                               // 🆕补译
  settingsAppsDockerCleanFailed: '清理 Docker 缓存失败。',                          // 🆕补译
  settingsAppsPendingTitle: '清除本地未完成的上传',
  settingsAppsPendingNone: '本地无未完成任务',
  settingsAppsPendingClear: '清除',
  settingsAppsPendingDisabledHint: '待相册区迁移完成后启用',                          // 🆕(本期新增标注,做样子)
  // ── P3 迁移弹窗 ────────────────────────────────────────────────────────
  settingsMigTitle: '存储位置',
  settingsMigCurrentLocation: '当前位置',
  settingsMigRequiredSpace: '所需空间',
  settingsMigSelectNew: '选择新位置',
  settingsMigNoOther: '没有其他可用的存储',
  settingsMigNext: '下一步',
  settingsMigBack: '返回',
  settingsMigStart: '开始迁移',
  settingsMigClose: '关闭',
  settingsMigNewFolder: '新建文件夹',
  settingsMigNoSubfolders: '没有子文件夹',                                          // 🆕补译
  settingsMigLoadFolderFailed: '加载文件夹失败',                                     // 🆕补译
  settingsMigCreateFolderFailed: '新建文件夹失败',                                   // 🆕补译
  settingsMigRename: '重命名',
  settingsMigRenameFailed: '重命名失败',
  settingsMigDelete: '删除',
  settingsMigDeleted: '已删除',
  settingsMigDeleteFailed: '删除失败',
  settingsMigCancel: '取消',
  settingsMigWillBeMoved: '将被移动',
  settingsMigNote: '提示',
  settingsMigNoteBody: '这将把所有数据移动到新位置。操作可能需要几分钟，具体取决于数据大小。',
  settingsMigNoteDocker: '在此过程中，Docker 将暂时停止。',
  settingsMigStopping: '正在停止服务...',
  settingsMigStoppingApps: '正在等待 {n} 个应用保存数据并退出...',
  settingsMigCopying: '正在迁移数据...',
  settingsMigStarting: '正在启动服务...',
  settingsMigKeepOpen: '在迁移完成前，请保持此窗口打开。',
  settingsMigDone: '迁移完成！',
  settingsMigFailed: '迁移失败',
  settingsMigCleanupTitle: '已自动清理',                                            // 🆕补译
  settingsMigCleanupBody: '目标磁盘上已传输的部分数据已被移除,你的原始数据完好无损。',   // 🆕补译
  // ── P3 system-status tab ───────────────────────────────────────────────
  settingsStatusTitle: '系统状态',
  settingsStatusRefresh: '刷新',
  settingsStatusGroupService: '核心服务',
  settingsStatusGroupUi: '前端界面',
  settingsStatusGroupExternal: '外部依赖',
  settingsStatusOnline: '在线',
  settingsStatusOffline: '离线',
  settingsStatusNoData: '暂无数据',
  // ── P3 terminal tab ────────────────────────────────────────────────────
  settingsTermTerminal: '终端',
  settingsTermLogs: '日志',
  settingsTermDownloadLogs: '下载日志',
  settingsTermLoadingLogs: '正在拉取系统日志...',
  settingsTermUnavailable: '终端服务暂不可用',
  settingsTermUnavailableHint: '系统终端的后端接口(/v1/sys/wsssh)已被停用,终端与终端安全策略暂不可用。', // 🆕(本期空态说明)
  settingsTermFullscreen: '全屏',
  settingsTermExitFullscreen: '退出全屏',
  // ── P3 storage tab(入口卡,授权偏离 #3)────────────────────────────────
  settingsStoreEntryTitle: '打开存储区',
  settingsStoreEntrySub: '磁盘、存储空间、RAID 与快照都在存储区管理。',                 // 🆕(本期新增)
  settingsStoreTotal: '总存储',
  settingsStoreAvailable: '可用',
  settingsStoreSystem: '系统',
  settingsStoreFiles: '文件',
  settingsStoreNoStorage: '未找到存储',                                             // 🆕补译
```

- [ ] **Step 2: 加英文分片(同名 key,值取 Vue2 的英文原文)**

在 `src/i18n/en_us.sp9.ts` 追加**同样 key 集合**,值:

```ts
  settingsAppsPathTitle: 'App data location',
  settingsAppsAppData: 'App Data',
  settingsAppsImages: 'App Images',
  settingsAppsDatabase: 'User Database',
  settingsAppsChangeLocation: 'Change storage location',
  settingsAppsDockerCleanTitle: 'Docker Cache Cleanup',
  settingsAppsDockerCleanSub: 'Your Docker environment is optimized.',
  settingsAppsDockerCleaning: 'Optimizing...',
  settingsAppsDockerCleanConfirmTitle: 'Clean Docker Cache',
  settingsAppsDockerCleanConfirmMsg: 'This will delete all unused containers, networks, and images. Are you sure you want to proceed?',
  settingsAppsDockerCleanConfirmOk: 'Clean',
  settingsAppsDockerCleanDone: 'Docker environment optimized.',
  settingsAppsDockerCleanFailed: 'Failed to clean Docker cache.',
  settingsAppsPendingTitle: 'Clear local pending uploads',
  settingsAppsPendingNone: 'No pending tasks',
  settingsAppsPendingClear: 'Clear',
  settingsAppsPendingDisabledHint: 'Available after the Photos section is migrated',
  settingsMigTitle: 'Storage Location',
  settingsMigCurrentLocation: 'Current Location',
  settingsMigRequiredSpace: 'Required Space',
  settingsMigSelectNew: 'Select a new location',
  settingsMigNoOther: 'No other storage available',
  settingsMigNext: 'Next',
  settingsMigBack: 'Back',
  settingsMigStart: 'Start Migration',
  settingsMigClose: 'Close',
  settingsMigNewFolder: 'New Folder',
  settingsMigNoSubfolders: 'No subfolders',
  settingsMigLoadFolderFailed: 'Failed to load folder',
  settingsMigCreateFolderFailed: 'Failed to create folder',
  settingsMigRename: 'Rename',
  settingsMigRenameFailed: 'Rename failed',
  settingsMigDelete: 'Delete',
  settingsMigDeleted: 'Deleted',
  settingsMigDeleteFailed: 'Delete failed',
  settingsMigCancel: 'Cancel',
  settingsMigWillBeMoved: 'will be moved',
  settingsMigNote: 'Note',
  settingsMigNoteBody: 'This will move all data to the new location. The operation may take several minutes depending on data size.',
  settingsMigNoteDocker: 'Docker will be temporarily stopped during this process.',
  settingsMigStopping: 'Stopping services...',
  settingsMigStoppingApps: 'Waiting for {n} app(s) to finish and save data...',
  settingsMigCopying: 'Migrating data...',
  settingsMigStarting: 'Starting services...',
  settingsMigKeepOpen: 'Please keep this window open until migration completes.',
  settingsMigDone: 'Migration complete!',
  settingsMigFailed: 'Migration failed',
  settingsMigCleanupTitle: 'Automatic cleanup complete',
  settingsMigCleanupBody: 'Any partially transferred data on the target disk has been removed. Your original data remains intact.',
  settingsStatusTitle: 'System Status',
  settingsStatusRefresh: 'Refresh',
  settingsStatusGroupService: 'Services',
  settingsStatusGroupUi: 'Web UI',
  settingsStatusGroupExternal: 'External Dependencies',
  settingsStatusOnline: 'Online',
  settingsStatusOffline: 'Offline',
  settingsStatusNoData: 'No data',
  settingsTermTerminal: 'Terminal',
  settingsTermLogs: 'Logs',
  settingsTermDownloadLogs: 'Download logs',
  settingsTermLoadingLogs: 'Loading system logs...',
  settingsTermUnavailable: 'Terminal service unavailable',
  settingsTermUnavailableHint: 'The system terminal backend (/v1/sys/wsssh) has been disabled; the terminal and its security policy are unavailable.',
  settingsTermFullscreen: 'Fullscreen',
  settingsTermExitFullscreen: 'Exit fullscreen',
  settingsStoreEntryTitle: 'Open Storage',
  settingsStoreEntrySub: 'Disks, storage volumes, RAID and snapshots are managed in the Storage section.',
  settingsStoreTotal: 'Total Storage',
  settingsStoreAvailable: 'Available',
  settingsStoreSystem: 'System',
  settingsStoreFiles: 'Files',
  settingsStoreNoStorage: 'No storage found',
```

- [ ] **Step 3: 加 token(两套主题块都给值)**

`src/styles/theme.sp9.css`,`:root` 块内追加:

```css
  --set-ok-fg: #23d160;          /* 组件在线 / 状态点绿 —— 对位 Vue2 SystemStatus.vue 的 #23d160 */
  --set-logs-bg: #1e1e1e;        /* 日志卡暗底 —— Vue2 LogsCard.vue 固定深色,亮暗两套都保持深色 */
  --set-logs-fg: #d4d4d4;
```

`:root[data-theme='light']` 块内追加(日志卡两套主题都是深色,这是 Vue2 的既有形态,1:1 照留):

```css
  --set-ok-fg: #22863a;
  --set-logs-bg: #1e1e1e;
  --set-logs-fg: #d4d4d4;
```

- [ ] **Step 4: 加样式**

`src/settings/styles/settings.css` 末尾追加(**只用 token,不写颜色字面量**;类名前缀沿用 `.set-`):

```css
/* ── P3 apps tab ───────────────────────────────────────────────────────── */
.set-app-row { display: flex; align-items: center; gap: 12px; padding: 16px; }
.set-app-row + .set-app-row { border-top: 1px solid var(--set-rail-border); }
.set-app-row-main { flex: 1; min-width: 0; }
.set-app-row-label { font-weight: 600; margin-bottom: 8px; }
.set-app-chips { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.set-app-chip {
  font-size: 12px; padding: 2px 10px; border-radius: 999px;
  background: var(--set-rail-bg); border: 1px solid var(--set-rail-border);
  color: var(--fg); white-space: nowrap;
}
.set-app-chip-path { max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
.set-app-act {
  flex-shrink: 0; width: 32px; height: 32px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  background: var(--set-rail-bg); border: 1px solid var(--set-rail-border);
  color: var(--fg); cursor: pointer;
}
.set-app-act:hover { background: var(--set-rail-border); }

/* ── P3 迁移弹窗 ───────────────────────────────────────────────────────── */
.set-mig-status { display: flex; gap: 12px; margin-bottom: 20px; }
.set-mig-status-card {
  flex: 1; padding: 12px; border-radius: 12px;
  background: var(--set-rail-bg); border: 1px solid var(--set-rail-border);
}
.set-mig-item {
  padding: 16px; margin-bottom: 12px; border-radius: 12px; cursor: pointer;
  background: var(--set-rail-bg); border: 1px solid var(--set-rail-border);
}
.set-mig-item.is-selected { border-color: var(--accent); }
.set-mig-crumbs { display: flex; align-items: center; gap: 4px; overflow: hidden; }
.set-mig-crumb { font-size: 12px; cursor: pointer; color: var(--fg-dim); }
.set-mig-crumb.is-active { color: var(--fg); cursor: default; }
.set-mig-list { max-height: 280px; overflow-y: auto; }
.set-mig-folder {
  display: flex; align-items: center; gap: 8px; padding: 8px 12px;
  border-radius: 8px; cursor: pointer;
}
.set-mig-folder:hover { background: var(--set-rail-bg); }
/* 弹窗表单里的输入框必须占满,否则吃到 .set-input 的 92px(P2 自查逮到过) */
.set-mig-input { width: 100%; max-width: none; }
.set-mig-progress { height: 8px; border-radius: 999px; background: var(--set-rail-bg); overflow: hidden; }
.set-mig-progress-fill { height: 100%; background: var(--accent); transition: width 0.2s linear; }

/* ── P3 system-status tab ──────────────────────────────────────────────── */
.set-comp-group-title { font-size: 12px; color: var(--fg-dim); margin: 0 0 8px; }
.set-comp-row { display: flex; align-items: center; gap: 12px; padding: 12px 0; }
.set-comp-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.set-comp-dot.is-online { background: var(--set-ok-fg); }
.set-comp-dot.is-offline { background: var(--danger); }
.set-comp-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.set-comp-ver { font-size: 12px; color: var(--fg-dim); }
.set-comp-state { font-size: 12px; }
.set-comp-state.is-online { color: var(--set-ok-fg); }
.set-comp-state.is-offline { color: var(--danger); }

/* ── P3 terminal tab ───────────────────────────────────────────────────── */
.set-logs-wrap { position: relative; }
.set-logs {
  width: 100%; min-height: 480px; max-height: 60vh; overflow: auto;
  background: var(--set-logs-bg); color: var(--set-logs-fg);
  font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; line-height: 1.5;
  padding: 16px; border-radius: 12px;
  white-space: pre-wrap; word-break: break-all;
}
.set-logs-tools { position: absolute; top: 12px; right: 16px; display: flex; gap: 8px; }
.set-term-empty { padding: 48px 16px; text-align: center; color: var(--fg-dim); }

/* ── P3 storage tab 入口卡 ─────────────────────────────────────────────── */
.set-store-bar { height: 8px; border-radius: 999px; display: flex; overflow: hidden; background: var(--set-rail-bg); }
.set-store-seg-os { background: var(--fg-dim); }
.set-store-seg-data { background: var(--accent); }
.set-store-legend { display: flex; gap: 16px; font-size: 12px; color: var(--fg-dim); margin-top: 8px; }
.set-store-legend-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 4px; }
```

⚠️ 实现前先 `grep -n "^  --" src/styles/theme.css | grep -E "danger|fg-dim|accent"` 确认 `--danger` / `--fg-dim` / `--accent` 的真实 token 名,**用实际存在的名字**,不要照抄这里的猜测名。

- [ ] **Step 5: 跑 parity + color-guard**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm exec vitest run src/i18n/parity.test.ts src/styles src/settings
```
预期:parity 绿(两个分片 key 集合一致)、color-guard 绿(新样式零颜色字面量)

- [ ] **Step 6: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git add src/i18n/zh_cn.sp9.ts src/i18n/en_us.sp9.ts src/styles/theme.sp9.css src/settings/styles/settings.css
git commit src/i18n/zh_cn.sp9.ts src/i18n/en_us.sp9.ts src/styles/theme.sp9.css src/settings/styles/settings.css -m "feat(settings): P3 四个 tab 的文案分片、token 与样式"
```

---

## Task 5: `SystemStatusPanel` —— 系统状态

**Files:**
- Create: `src/settings/util/components.ts`
- Test: `src/settings/util/components.test.ts`
- Modify: `src/settings/panels/SystemStatusPanel.vue`
- Test: `src/settings/panels/SystemStatusPanel.test.ts`

**Interfaces:**
- Consumes: 共享包 `service.sys.getGatewayComponents(): Promise<GatewayComponent[]>`(P1 已进包,**裸 JSON 无信封,包里已剥 `.components`**)
- Produces: `function groupComponents(list: GatewayComponent[]): Array<{ key: 'service'|'ui'|'external'; labelKey: string; items: GatewayComponent[] }>`(空组不返回)· `function statusHint(c: GatewayComponent): string`

**Vue2 对位**:`components/settings/SystemStatus.vue`(89 行)。参考它的现成单测 `components/settings/__tests__/SystemStatus.spec.js`。

- [ ] **Step 1: 写纯函数的失败测试**

`src/settings/util/components.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { groupComponents, statusHint } from './components'
import type { GatewayComponent } from '@nimotech/nimoos-service'

// 真机 fixture(2026-08-01 curl GET /v1/gateway/components,节选逐字)
const REAL: GatewayComponent[] = [
  { name: 'Gateway', category: 'service', version: '1.9.3-alpha1+28.g0dc16d6', status: 'online', error: '', probed_at: '2026-08-01T02:15:55Z' },
  { name: 'User Service', category: 'service', version: '', status: 'offline', error: 'unexpected status Internal Server Error', probed_at: '2026-08-01T02:15:55Z' },
  { name: 'NimoOS UI', category: 'ui', version: '1.9.3-alpha1+20.g5c325a42-dirty', status: 'online', error: '', probed_at: '2026-08-01T02:15:55Z' },
  { name: 'Qdrant', category: 'external', version: '1.18.1', status: 'online', error: '', probed_at: '2026-08-01T02:15:55Z' },
]

describe('groupComponents', () => {
  it('按 service / ui / external 顺序分组', () => {
    expect(groupComponents(REAL).map((g) => g.key)).toEqual(['service', 'ui', 'external'])
  })
  it('组内保持后端返回顺序', () => {
    expect(groupComponents(REAL)[0].items.map((c) => c.name)).toEqual(['Gateway', 'User Service'])
  })
  it('空组不渲染', () => {
    expect(groupComponents([REAL[0]]).map((g) => g.key)).toEqual(['service'])
  })
  it('未知 category 被丢弃(不炸)', () => {
    const odd = [{ ...REAL[0], category: 'whatever' }]
    expect(groupComponents(odd)).toEqual([])
  })
})

describe('statusHint', () => {
  it('有 error 时给 error + 探测时间', () => {
    expect(statusHint(REAL[1])).toBe('unexpected status Internal Server Error (2026-08-01T02:15:55Z)')
  })
  it('无 error 时只给探测时间', () => {
    expect(statusHint({ ...REAL[1], error: '' })).toBe('(2026-08-01T02:15:55Z)')
  })
  it('连 probed_at 都没有时返回空串', () => {
    expect(statusHint({ ...REAL[1], error: '', probed_at: '' })).toBe('')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm exec vitest run src/settings/util/components.test.ts
```
预期:FAIL —— 模块不存在

- [ ] **Step 3: 实现纯函数**

`src/settings/util/components.ts`:

```ts
// 设置 · 系统状态 —— GET /v1/gateway/components 的分组派生。
// Vue2 对位:components/settings/SystemStatus.vue 的 grouped(:46)与 statusHint(:69)。
// ⚠️ 该端点是**裸 JSON 无信封**(P1 实测校正①),共享包 sys.getGatewayComponents 已剥 .components。
import type { GatewayComponent } from '@nimotech/nimoos-service'

const GROUPS = [
  { key: 'service', labelKey: 'settingsStatusGroupService' },
  { key: 'ui', labelKey: 'settingsStatusGroupUi' },
  { key: 'external', labelKey: 'settingsStatusGroupExternal' },
] as const

export type ComponentGroupKey = (typeof GROUPS)[number]['key']

export function groupComponents(
  list: GatewayComponent[],
): Array<{ key: ComponentGroupKey; labelKey: string; items: GatewayComponent[] }> {
  return GROUPS.map((g) => ({
    key: g.key, labelKey: g.labelKey,
    items: list.filter((c) => c.category === g.key),
  })).filter((g) => g.items.length > 0)
}

/** 离线项的悬浮说明:后端错误原文 + 探测时刻。 */
export function statusHint(c: GatewayComponent): string {
  const at = c.probed_at ? `(${c.probed_at})` : ''
  return [c.error, at].filter(Boolean).join(' ')
}
```

- [ ] **Step 4: 写面板测试**

`src/settings/panels/SystemStatusPanel.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import SystemStatusPanel from './SystemStatusPanel.vue'

const getGatewayComponents = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: { sys: { getGatewayComponents: (...a: unknown[]) => getGatewayComponents(...a) } },
}))

// i18n 用项目既有的测试桩写法(照抄 src/settings/panels/panels.test.ts 里的 global.plugins)
import { i18n } from '../../i18n'

const REAL = [
  { name: 'Gateway', category: 'service', version: '1.9.3-alpha1+28.g0dc16d6', status: 'online', error: '', probed_at: '2026-08-01T02:15:55Z' },
  { name: 'User Service', category: 'service', version: '', status: 'offline', error: 'unexpected status Internal Server Error', probed_at: '2026-08-01T02:15:55Z' },
  { name: 'Qdrant', category: 'external', version: '1.18.1', status: 'online', error: '', probed_at: '2026-08-01T02:15:55Z' },
]

const mountPanel = () => mount(SystemStatusPanel, { global: { plugins: [i18n] } })

describe('SystemStatusPanel', () => {
  beforeEach(() => { getGatewayComponents.mockReset() })

  it('挂载即取数并按组渲染', async () => {
    getGatewayComponents.mockResolvedValue(REAL)
    const w = mountPanel()
    await flushPromises()
    expect(w.findAll('.set-comp-row')).toHaveLength(3)
    expect(w.text()).toContain('Gateway')
    expect(w.text()).toContain('Qdrant')
  })

  it('离线项显示离线态与版本占位', async () => {
    getGatewayComponents.mockResolvedValue(REAL)
    const w = mountPanel()
    await flushPromises()
    const rows = w.findAll('.set-comp-row')
    expect(rows[1].find('.set-comp-dot').classes()).toContain('is-offline')
    expect(rows[1].find('.set-comp-ver').text()).toBe('—')
    expect(rows[1].find('.set-comp-state').attributes('title'))
      .toContain('unexpected status Internal Server Error')
  })

  it('刷新按钮重新取数', async () => {
    getGatewayComponents.mockResolvedValue(REAL)
    const w = mountPanel()
    await flushPromises()
    await w.find('.set-comp-refresh').trigger('click')
    await flushPromises()
    expect(getGatewayComponents).toHaveBeenCalledTimes(2)
  })

  it('接口失败时清空并显示空态,不白屏', async () => {
    getGatewayComponents.mockRejectedValue(new Error('boom'))
    const w = mountPanel()
    await flushPromises()
    expect(w.findAll('.set-comp-row')).toHaveLength(0)
    expect(w.text()).toContain('暂无数据')
  })
})
```

- [ ] **Step 5: 实现面板**

`src/settings/panels/SystemStatusPanel.vue`(替换骨架):

```vue
<script setup lang="ts">
// 设置 · 系统状态。对位 Vue2 components/settings/SystemStatus.vue(89 行)。
// 数据源:GET /v1/gateway/components(**裸 JSON 无信封**,P1 实测校正①)。
// Vue2 的失败分支是"清空 + 空态",这里照留(它不是吞错:整块内容就是这一个接口)。
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { service, type GatewayComponent } from '@nimotech/nimoos-service'
import SettingsSection from '../components/SettingsSection.vue'
import { groupComponents, statusHint } from '../util/components'
import '../styles/settings.css'

const { t } = useI18n()
const components = ref<GatewayComponent[]>([])
const loading = ref(false)
const groups = computed(() => groupComponents(components.value))

async function load() {
  loading.value = true
  try {
    components.value = await service.sys.getGatewayComponents()
  } catch {
    components.value = []
  } finally {
    loading.value = false
  }
}
onMounted(load)
</script>

<template>
  <SettingsSection :title="t('settingsStatusTitle')">
    <div class="set-comp-head">
      <button
        class="set-btn set-comp-refresh" type="button" :disabled="loading"
        :title="t('settingsStatusRefresh')" @click="load"
      >
        {{ t('settingsStatusRefresh') }}
      </button>
    </div>

    <div v-for="g in groups" :key="g.key" class="set-comp-group">
      <p class="set-comp-group-title">{{ t(g.labelKey) }}</p>
      <div v-for="c in g.items" :key="c.name" class="set-comp-row">
        <span class="set-comp-dot" :class="c.status === 'online' ? 'is-online' : 'is-offline'" />
        <span class="set-comp-name">{{ c.name }}</span>
        <span class="set-comp-ver">{{ c.version || '—' }}</span>
        <span
          class="set-comp-state"
          :class="c.status === 'online' ? 'is-online' : 'is-offline'"
          :title="c.status === 'online' ? undefined : statusHint(c)"
        >
          {{ c.status === 'online' ? t('settingsStatusOnline') : t('settingsStatusOffline') }}
        </span>
      </div>
    </div>

    <p v-if="!loading && !components.length" class="set-empty">{{ t('settingsStatusNoData') }}</p>
  </SettingsSection>
</template>
```

⚠️ `.set-btn` / `.set-empty` 若在 `settings.css` 里不存在,用实际存在的类名(先 `grep -n "^\.set-" src/settings/styles/settings.css`)。

- [ ] **Step 6: 跑测试确认通过**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm exec vitest run src/settings/util/components.test.ts src/settings/panels/SystemStatusPanel.test.ts && pnpm exec vue-tsc --noEmit
```
预期:11 例全绿,tsc 0

- [ ] **Step 7: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git add src/settings/util/components.ts src/settings/util/components.test.ts src/settings/panels/SystemStatusPanel.vue src/settings/panels/SystemStatusPanel.test.ts
git commit src/settings/util/components.ts src/settings/util/components.test.ts src/settings/panels/SystemStatusPanel.vue src/settings/panels/SystemStatusPanel.test.ts -m "feat(settings): 系统状态 tab(17 个组件分三组 + 离线原因)"
```

---

## Task 6: `TerminalPanel` —— 日志卡 + 终端空态

**Files:**
- Create: `src/settings/util/sysLog.ts`
- Test: `src/settings/util/sysLog.test.ts`
- Create: `src/settings/panels/terminal/LogsCard.vue`
- Test: `src/settings/panels/terminal/LogsCard.test.ts`
- Modify: `src/settings/panels/TerminalPanel.vue`
- Test: `src/settings/panels/TerminalPanel.test.ts`

**Interfaces:**
- Consumes: 共享包 `service.sys.getLogs(): Promise<string>`(P1 已进包,标准信封,`data` 是字符串)
- Produces: `function formatSysLog(raw: string): string` · `function downloadLogsUrl(token: string | null): string`

**Vue2 对位**:`SettingsPanel.vue:1732 getTerminalLogs()` · `:1769 downloadSystemLog()` · `:1180-1194`(进 tab 取一次 + 每 5 秒轮询)· `components/logsAndTerminal/LogsCard.vue`(111 行)。

**授权偏离 #9(用户 2026-08-01 拍板)**:`/v1/sys/wsssh` 与 `/v1/terminal/settings` **都是 404**,整个 Terminal 服务不存在 → **终端位与终端安全设置合成一块空态**,不渲染 Vue2 那 172 行密码表单。terminal tab 只留 Logs 卡。**不写针对这两个接口的测试,不列验收项**(政策二)。

**三条移植纪律(代码里登记)**:

1. **`v-html` → 纯文本**。Vue2 `LogsCard.vue:8` 把服务端日志原文当 HTML 渲染;日志里含用户可控内容(文件名、路径)时是注入面。New-UI 用文本插值 + `white-space: pre-wrap`,**视觉结果一致**。
2. **`substring(8, length - 1)` 的尾部 off-by-one**。Vue2 顺手把整块日志的**最后一个字符**删掉了。New-UI 只去掉开头 8 个字符(那是去时间戳前缀的意图),尾部保留。
3. **定时器必须随卸载停表**。Vue2 靠 `watch(currentTab)` 清,组件直接销毁时会漏;New-UI 在 `onUnmounted` 里清。

- [ ] **Step 1: 写纯函数失败测试**

`src/settings/util/sysLog.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { formatSysLog, downloadLogsUrl } from './sysLog'

// 真机 fixture(2026-08-01 GET /v1/sys/logs 的 data 开头,逐字)
const RAW =
  '2026-04-13T15:38:19.417-0400\tinfo\tInitPathConfig: images path mismatch, self-healing\n' +
  '2026-04-13T15:38:19.417-0400\tinfo\tInitPathConfig: path config saved\n'

describe('formatSysLog', () => {
  it('去掉每行开头 8 个字符的日期前缀(Vue2 的既有显示形态,1:1 照留)', () => {
    const out = formatSysLog(RAW)
    expect(out.startsWith('13T15:38:19.417-0400\tinfo\t')).toBe(true)
    expect(out).toContain('\n13T15:38:19.417-0400\tinfo\tInitPathConfig: path config saved')
  })
  it('不吃掉最后一个字符(Vue2 的 substring(8, len-1) 是 off-by-one)', () => {
    expect(formatSysLog(RAW).endsWith('\n')).toBe(true)
  })
  it('短文本(< 10 字符)原样返回', () => {
    expect(formatSysLog('abc')).toBe('abc')
  })
  it('空输入返回空串', () => {
    expect(formatSysLog('')).toBe('')
  })
})

describe('downloadLogsUrl', () => {
  it('带 token 查询参数(后端 route/v2.go:77 的 Skipper 认它)', () => {
    expect(downloadLogsUrl('abc.def')).toBe('/v2/nimoos/health/logs?token=abc.def')
  })
  it('token 里的特殊字符被编码', () => {
    expect(downloadLogsUrl('a+b/c')).toBe('/v2/nimoos/health/logs?token=a%2Bb%2Fc')
  })
  it('无 token 时不拼查询串', () => {
    expect(downloadLogsUrl(null)).toBe('/v2/nimoos/health/logs')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm exec vitest run src/settings/util/sysLog.test.ts
```
预期:FAIL —— 模块不存在

- [ ] **Step 3: 实现纯函数**

`src/settings/util/sysLog.ts`:

```ts
// 设置 · 终端与日志 —— 系统日志文本变换与下载 URL。
// Vue2 对位:SettingsPanel.vue:1732 getTerminalLogs() 与 :1769 downloadSystemLog()。
//
// 移植纪律(登记):Vue2 是 `replaceData.substring(8, replaceData.length - 1)` ——
//   **末尾那个 -1 把整块日志的最后一个字符也吃掉了**,是 off-by-one。这里只去开头 8 个字符
//   (去日期前缀,是它的本意与既有显示形态),尾部原样保留。

/** 去掉每行开头 8 个字符的日期前缀:'2026-04-13T15:38' → '13T15:38'。 */
export function formatSysLog(raw: string): string {
  if (!raw || raw.length < 10) return raw || ''
  const stripped = raw.replace(/\n(.{8})/gu, '\n')
  return stripped.length > 8 ? stripped.substring(8) : stripped
}

/** 下载日志走 /v2/nimoos/health/logs(返回 NimoOS.zip)。
 *  鉴权:NimoOS/route/v2.go:77 的 Skipper 认 ?token= 查询参数
 *  —— 浏览器直接开链接拿不到 Authorization 头,只能靠它。 */
export function downloadLogsUrl(token: string | null): string {
  const base = '/v2/nimoos/health/logs'
  return token ? `${base}?token=${encodeURIComponent(token)}` : base
}
```

- [ ] **Step 4: 写 LogsCard 与 TerminalPanel 的测试**

`src/settings/panels/terminal/LogsCard.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import LogsCard from './LogsCard.vue'
import { i18n } from '../../../i18n'

const mountCard = (text: string) =>
  mount(LogsCard, { props: { text }, global: { plugins: [i18n] } })

describe('LogsCard', () => {
  it('日志以纯文本渲染,不当 HTML(移植纪律:Vue2 是 v-html)', () => {
    const w = mountCard('<img src=x onerror=alert(1)> hello')
    expect(w.find('.set-logs').element.querySelector('img')).toBeNull()
    expect(w.find('.set-logs').text()).toContain('<img src=x onerror=alert(1)>')
  })
  it('空文本时显示加载提示', () => {
    expect(mountCard('').text()).toContain('正在拉取系统日志...')
  })
  it('全屏按钮切换 class', async () => {
    const w = mountCard('log')
    await w.find('.set-logs-fs').trigger('click')
    expect(w.find('.set-logs-wrap').classes()).toContain('is-fullscreen')
  })
})
```

`src/settings/panels/TerminalPanel.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import TerminalPanel from './TerminalPanel.vue'
import { i18n } from '../../i18n'

const getLogs = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: { sys: { getLogs: () => getLogs() } },
}))

const mountPanel = () => mount(TerminalPanel, { global: { plugins: [i18n] } })

describe('TerminalPanel', () => {
  beforeEach(() => { vi.useFakeTimers(); getLogs.mockReset(); getLogs.mockResolvedValue('2026-04-13T15:38:19.417-0400\tinfo\thello\n') })
  afterEach(() => { vi.useRealTimers() })

  it('挂载即拉一次日志并渲染(时间戳前缀已裁掉)', async () => {
    const w = mountPanel()
    await flushPromises()
    expect(getLogs).toHaveBeenCalledTimes(1)
    expect(w.find('.set-logs').text()).toContain('13T15:38:19.417-0400')
  })

  it('每 5 秒自动刷新一次', async () => {
    mountPanel()
    await flushPromises()
    vi.advanceTimersByTime(5000)
    await flushPromises()
    expect(getLogs).toHaveBeenCalledTimes(2)
  })

  it('卸载后停表(移植纪律:Vue2 只在切 tab 时清,组件销毁会漏)', async () => {
    const w = mountPanel()
    await flushPromises()
    w.unmount()
    vi.advanceTimersByTime(20000)
    await flushPromises()
    expect(getLogs).toHaveBeenCalledTimes(1)
  })

  it('拉日志失败时保留上一次内容,不清空', async () => {
    const w = mountPanel()
    await flushPromises()
    getLogs.mockRejectedValueOnce(new Error('boom'))
    vi.advanceTimersByTime(5000)
    await flushPromises()
    expect(w.find('.set-logs').text()).toContain('hello')
  })

  it('渲染终端服务不可用的空态(后端 /v1/sys/wsssh 与 /v1/terminal/settings 都是 404)', () => {
    const w = mountPanel()
    expect(w.find('.set-term-empty').text()).toContain('终端服务暂不可用')
  })

  it('下载日志的链接带 token 查询参数', async () => {
    localStorage.setItem('access_token', 'tok123')
    const w = mountPanel()
    await flushPromises()
    expect(w.find('.set-logs-download').attributes('href')).toBe('/v2/nimoos/health/logs?token=tok123')
    localStorage.removeItem('access_token')
  })
})
```

- [ ] **Step 5: 实现 LogsCard 与 TerminalPanel**

`src/settings/panels/terminal/LogsCard.vue`:

```vue
<script setup lang="ts">
// 设置 · 终端与日志 —— 日志卡。对位 Vue2 components/logsAndTerminal/LogsCard.vue(111 行)。
// 移植纪律(登记):Vue2 用 v-html 把服务端日志原文当 HTML 渲染 —— 日志里有用户可控内容
//   (文件名/路径)时是注入面。这里用文本插值 + white-space: pre-wrap,视觉结果一致。
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import '../../styles/settings.css'

defineProps<{ text: string }>()
const { t } = useI18n()
const fullscreen = ref(false)
const fsLabel = computed(() =>
  fullscreen.value ? t('settingsTermExitFullscreen') : t('settingsTermFullscreen'),
)
</script>

<template>
  <div class="set-logs-wrap" :class="{ 'is-fullscreen': fullscreen }">
    <div class="set-logs-tools">
      <slot name="tools" />
      <button class="set-btn set-logs-fs" type="button" :title="fsLabel" @click="fullscreen = !fullscreen">
        {{ fsLabel }}
      </button>
    </div>
    <pre v-if="text" class="set-logs">{{ text }}</pre>
    <pre v-else class="set-logs">{{ t('settingsTermLoadingLogs') }}</pre>
  </div>
</template>
```

`src/settings/panels/TerminalPanel.vue`(替换骨架):

```vue
<script setup lang="ts">
// 设置 · 终端与日志。对位 Vue2 SettingsPanel.vue 的 terminal 分支(L350-373)。
//
// 授权偏离 #9(用户 2026-08-01 拍板):**终端位与终端安全设置合成一块空态**。
//   实测 GET /v1/sys/wsssh → 404(NimoOS/route/v1.go:106 已被注释)、
//        GET /v1/terminal/settings → 404(整个 Terminal 服务不存在,
//        /v1/gateway/components 里 "Terminal" 也是 unexpected status Not Found)。
//   政策二:不放连不上的 xterm 假装能用;也不放一个只会 404 失败的密码表单
//   (Vue2 的 TerminalSecuritySection 要求输入账户密码才能改锁定策略)。债务 D7 / D25。
//
// 移植纪律(登记):Vue2 的 5 秒轮询定时器靠 watch(currentTab) 清,组件直接销毁时会漏 →
//   这里在 onUnmounted 里清。
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import SettingsSection from '../components/SettingsSection.vue'
import LogsCard from './terminal/LogsCard.vue'
import { formatSysLog, downloadLogsUrl } from '../util/sysLog'
import '../styles/settings.css'

const { t } = useI18n()
const logText = ref('')
const downloadUrl = computed(() => downloadLogsUrl(localStorage.getItem('access_token')))
let timer: ReturnType<typeof setInterval> | undefined

async function loadLogs() {
  try {
    // ⚠️ 这个端点单次返回约 2.67MB(2026-08-01 实测),没有 tail/limit 参数 —— 后端票 D24。
    logText.value = formatSysLog(await service.sys.getLogs())
  } catch {
    // 拉取失败保留上一次内容,不把已显示的日志清掉。
  }
}

onMounted(() => {
  void loadLogs()
  timer = setInterval(() => void loadLogs(), 5000)
})
onUnmounted(() => { if (timer) clearInterval(timer) })
</script>

<template>
  <SettingsSection>
    <div class="set-term-empty">
      <p class="set-row-label">{{ t('settingsTermUnavailable') }}</p>
      <p class="set-row-sub">{{ t('settingsTermUnavailableHint') }}</p>
    </div>

    <p class="set-comp-group-title">{{ t('settingsTermLogs') }}</p>
    <LogsCard :text="logText">
      <template #tools>
        <a class="set-btn set-logs-download" :href="downloadUrl" :title="t('settingsTermDownloadLogs')">
          {{ t('settingsTermDownloadLogs') }}
        </a>
      </template>
    </LogsCard>
  </SettingsSection>
</template>
```

- [ ] **Step 6: 跑测试确认通过**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm exec vitest run src/settings/util/sysLog.test.ts src/settings/panels/terminal src/settings/panels/TerminalPanel.test.ts && pnpm exec vue-tsc --noEmit
```
预期:16 例全绿,tsc 0

- [ ] **Step 7: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git add src/settings/util/sysLog.ts src/settings/util/sysLog.test.ts src/settings/panels/terminal/LogsCard.vue src/settings/panels/terminal/LogsCard.test.ts src/settings/panels/TerminalPanel.vue src/settings/panels/TerminalPanel.test.ts
git commit src/settings/util/sysLog.ts src/settings/util/sysLog.test.ts src/settings/panels/terminal/LogsCard.vue src/settings/panels/terminal/LogsCard.test.ts src/settings/panels/TerminalPanel.vue src/settings/panels/TerminalPanel.test.ts -m "feat(settings): 终端与日志 tab(日志卡 + 下载 + 终端服务空态)"
```

---

## Task 7: `StoragePanel` —— 跳转入口卡(授权偏离 #3)

**Files:**
- Modify: `src/settings/panels/StoragePanel.vue`
- Test: `src/settings/panels/StoragePanel.test.ts`

**Interfaces:**
- Consumes: 共享包 `service.storage.list({ system: 'show' })`;SP6 的 `mapVolumes`(`src/storage/util/storageMap.ts`);`vue-router` 的 `useRouter`
- Produces: 无(叶子面板)

**授权偏离 #3(spec §5.5 已登记)**:SP6 已把概览 / 系统盘 / 存储列表 / 回收站整套迁到 `/storage`,在设置区再实现一遍等于同一功能两处维护 → 本 tab 改成**一张入口卡 + 容量概览**,点击 `router.push('/storage')`。

容量口径**照 Vue2 `SettingsPanel.vue:1139-1171`**:`storageTotal` = 全部分区 size 之和;`storageOsUsed` = 系统分区 `min(usedSize, size * 0.08)` 的启发式;`storageDataUsed` = 其余已用;`storageAvail = total - used`。

- [ ] **Step 1: 写失败测试**

`src/settings/panels/StoragePanel.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import StoragePanel from './StoragePanel.vue'
import { i18n } from '../../i18n'

const list = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: { storage: { list: (...a: unknown[]) => list(...a) }, raid: { list: () => Promise.resolve([]) } },
}))
const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

// 真机 fixture(2026-08-01 curl GET /v1/storage?system=show,逐字)
const RAW = [{
  disk_name: 'System', size: 512110190592, path: '/dev/nvme0n1', type: 'nvme',
  children: [{
    uuid: 'da0e4da3-4a51-4655-8d89-d0f761d08c0a', mount_point: '/', size: '512110190592',
    avail: '333092294144', used: '179017896448', type: 'ext4', path: '/dev/nvme0n1p7',
    drive_name: 'nvme0n1p7', label: 'NimoOS-HD', persisted_in: 'none',
  }],
}]

const mountPanel = () => mount(StoragePanel, { global: { plugins: [i18n] } })

describe('StoragePanel(入口卡)', () => {
  beforeEach(() => { list.mockReset(); push.mockReset(); list.mockResolvedValue(RAW) })

  it('渲染容量概览:总量与可用量取真实值', async () => {
    const w = mountPanel()
    await flushPromises()
    // 512110190592 B ≈ 476.95 GB;333092294144 B ≈ 310.22 GB
    expect(w.text()).toContain('476.95 GB')
    expect(w.text()).toContain('310.22 GB')
  })

  it('系统盘用量按 8% 启发式拆成"系统"与"文件"两段,两段宽度加起来不超过 100%', async () => {
    const w = mountPanel()
    await flushPromises()
    const os = parseFloat((w.find('.set-store-seg-os').attributes('style') || '').replace(/\D+([\d.]+).*/, '$1'))
    const data = parseFloat((w.find('.set-store-seg-data').attributes('style') || '').replace(/\D+([\d.]+).*/, '$1'))
    expect(os).toBeCloseTo(8, 1)
    expect(os + data).toBeLessThanOrEqual(100)
  })

  it('点入口卡跳 /storage', async () => {
    const w = mountPanel()
    await flushPromises()
    await w.find('.set-store-entry').trigger('click')
    expect(push).toHaveBeenCalledWith('/storage')
  })

  it('接口失败时仍渲染入口卡(概览显示空态)', async () => {
    list.mockRejectedValue(new Error('boom'))
    const w = mountPanel()
    await flushPromises()
    expect(w.find('.set-store-entry').exists()).toBe(true)
    expect(w.text()).toContain('未找到存储')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm exec vitest run src/settings/panels/StoragePanel.test.ts
```
预期:FAIL —— 骨架里没有这些元素

- [ ] **Step 3: 实现**

`src/settings/panels/StoragePanel.vue`(替换骨架):

```vue
<script setup lang="ts">
// 设置 · 存储。**授权偏离 #3**(spec §5.5,用户 2026-07-31 拍板):
//   Vue2 在这个 tab 里重做了一整套概览/系统盘/存储列表/回收站,而 SP6 已经把这套完整迁到
//   了 /storage 路由页。在设置区再实现一遍 = 同一功能两处维护 → 这里只放
//   **一张入口卡 + 容量概览**,点击跳 /storage。
//
// 容量口径逐字照 Vue2 SettingsPanel.vue:1139-1171(8% 系统盘启发式),保证读数与旧 UI 一致。
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { service } from '@nimotech/nimoos-service'
import SettingsSection from '../components/SettingsSection.vue'
import { mapVolumes, type StorageVolume } from '../../storage/util/storageMap'
import { renderSize } from '../../files/util/format'
import '../styles/settings.css'

const { t } = useI18n()
const router = useRouter()
const volumes = ref<StorageVolume[]>([])
const loaded = ref(false)

const total = computed(() => volumes.value.reduce((s, v) => s + v.size, 0))
const osUsed = computed(() =>
  volumes.value.reduce((s, v) => (v.isSystem ? s + Math.min(v.usedSize, v.size * 0.08) : s), 0),
)
const dataUsed = computed(() =>
  volumes.value.reduce(
    (s, v) => s + (v.isSystem ? v.usedSize - Math.min(v.usedSize, v.size * 0.08) : v.usedSize),
    0,
  ),
)
const avail = computed(() => total.value - osUsed.value - dataUsed.value)
const osPct = computed(() => (total.value ? (osUsed.value / total.value) * 100 : 0))
const dataPct = computed(() => (total.value ? (dataUsed.value / total.value) * 100 : 0))

onMounted(async () => {
  try {
    volumes.value = mapVolumes(await service.storage.list({ system: 'show' }))
  } catch {
    volumes.value = []
  } finally {
    loaded.value = true
  }
})
</script>

<template>
  <SettingsSection :title="t('settingsTabStorage')">
    <div v-if="loaded && !volumes.length" class="set-empty">{{ t('settingsStoreNoStorage') }}</div>
    <div v-else class="set-card set-store-overview">
      <div class="set-store-head">
        <span class="set-row-label">{{ t('settingsStoreTotal') }}</span>
        <span class="set-row-sub">{{ renderSize(avail) }} {{ t('settingsStoreAvailable') }}</span>
      </div>
      <div class="set-store-bar">
        <div class="set-store-seg-os" :style="{ width: osPct + '%' }" />
        <div class="set-store-seg-data" :style="{ width: dataPct + '%' }" />
      </div>
      <div class="set-store-legend">
        <span><i class="set-store-legend-dot set-store-seg-os" />{{ t('settingsStoreSystem') }}</span>
        <span><i class="set-store-legend-dot set-store-seg-data" />{{ t('settingsStoreFiles') }}</span>
        <span>{{ renderSize(osUsed + dataUsed) }} / {{ renderSize(total) }}</span>
      </div>
    </div>

    <button class="set-list-item clickable set-store-entry" type="button" @click="router.push('/storage')">
      <span class="set-row-text">
        <span class="set-row-label">{{ t('settingsStoreEntryTitle') }}</span>
        <span class="set-row-sub">{{ t('settingsStoreEntrySub') }}</span>
      </span>
      <span class="set-chevron" aria-hidden="true">›</span>
    </button>
  </SettingsSection>
</template>
```

⚠️ 实现前确认 `renderSize` 在 `src/files/util/format.ts` 的导出名与签名;确认 `.set-card` 类是否存在,不存在就用既有的卡片类名。

- [ ] **Step 4: 跑测试确认通过**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm exec vitest run src/settings/panels/StoragePanel.test.ts && pnpm exec vue-tsc --noEmit
```
预期:4 例全绿,tsc 0。⚠️ 若 `renderSize(512110190592)` 的实际输出不是 `476.95 GB`,**以实际输出为准改测试断言**(不要改 `renderSize`)。

- [ ] **Step 5: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git add src/settings/panels/StoragePanel.vue src/settings/panels/StoragePanel.test.ts
git commit src/settings/panels/StoragePanel.vue src/settings/panels/StoragePanel.test.ts -m "feat(settings): 存储 tab 改为容量概览 + 跳 /storage 入口卡(授权偏离 #3)"
```

---

## Task 8: `AppPathDialog` —— 迁移弹窗(6 步)

**Files:**
- Create: `src/settings/panels/apps/AppPathDialog.vue`
- Test: `src/settings/panels/apps/AppPathDialog.test.ts`

**Interfaces:**
- Consumes: Task 2 `AppPathKey`;Task 3 全部导出;共享包 `service.sys.migrateAppPath / getMigrateStatus`、`service.folder.getList / create / rename`、`service.batch.delete`;SP6 `StorageVolume`
- Produces: 组件 props `{ open: boolean; type: AppPathKey; currentPath: string; requiredSpace: number; volumes: StorageVolume[]; displayNames: Record<string,string> }`;emits `{ 'update:open': [boolean]; finish: [] }`

**Vue2 对位**:`components/settings/AppPathModal.vue`(951 行),6 个 step:`select → browse → confirm → migrating → done | error`。

**⛔ 本任务不发任何写请求**:`migrateAppPath` / `folder.create` / `folder.rename` / `batch.delete` 全部只在**单测里 mock**。见「破坏面判定」。

**两条移植纪律(代码里登记)**:

1. **不写 localStorage**(同 Task 2 纪律 ①)—— Vue2 `pollStatus` 在 done 时写 `app_data_path` 等三个键,New-UI 不读,不写。
2. **轮询的 catch 不能静默**:Vue2 `pollStatus` 的 catch 只 `console.error`,后端若持续 400(job 丢失,见 F6)会无限轮询下去。New-UI 连续失败 5 次即停表并进 `error` 步骤,给出后端原文。

**照抄的 Vue2 形态(不要"优化")**:轮询间隔 **200ms**(进度条要跟手);`migrating` 步骤**不给关闭按钮**(header 的 × 在该步隐藏)。

- [ ] **Step 1: 写失败测试**

`src/settings/panels/apps/AppPathDialog.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AppPathDialog from './AppPathDialog.vue'
import { i18n } from '../../../i18n'
import type { StorageVolume } from '../../../storage/util/storageMap'

const migrateAppPath = vi.fn()
const getMigrateStatus = vi.fn()
const folderGetList = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    sys: {
      migrateAppPath: (...a: unknown[]) => migrateAppPath(...a),
      getMigrateStatus: (...a: unknown[]) => getMigrateStatus(...a),
    },
    folder: { getList: (...a: unknown[]) => folderGetList(...a), create: vi.fn(), rename: vi.fn() },
    batch: { delete: vi.fn() },
  },
}))

const SYS: StorageVolume = {
  uuid: 'da0e4da3', name: 'NimoOS-HD', isSystem: true, fsType: 'ext4',
  size: 512110190592, availSize: 333092294144, usedSize: 179017896448, usePercent: 35,
  driveName: 'nvme0n1p7', path: '/dev/nvme0n1p7', mountPoint: '/', disk: '/dev/nvme0n1',
}
const EXT: StorageVolume = { ...SYS, uuid: 'ext-1', name: 'Backup', isSystem: false, mountPoint: '/media/Backup' }

const mountDlg = (volumes: StorageVolume[] = [SYS, EXT]) =>
  mount(AppPathDialog, {
    props: { open: true, type: 'app_data' as const, currentPath: '/DATA/AppData', requiredSpace: 6037987, volumes, displayNames: { '/DATA': 'NimoOS-HD', '/media/Backup': 'Backup' } },
    global: { plugins: [i18n] },
    attachTo: document.body,   // reka DialogPortal teleport 到 body
  })

describe('AppPathDialog', () => {
  beforeEach(() => {
    migrateAppPath.mockReset(); getMigrateStatus.mockReset(); folderGetList.mockReset()
    folderGetList.mockResolvedValue({ content: [
      { name: 'Backup', path: '/media/Backup/Backup', is_dir: true, is_symlink: false },
    ] })
  })
  afterEach(() => { document.body.innerHTML = '' })

  it('第一步列出可选分区,当前所在分区被剔除', () => {
    mountDlg()
    const items = document.querySelectorAll('.set-mig-item')
    expect(items).toHaveLength(1)
    expect(items[0].textContent).toContain('Backup')
  })

  it('本机只有一个分区时显示"没有其他可用的存储",下一步按钮禁用', () => {
    mountDlg([SYS])
    expect(document.body.textContent).toContain('没有其他可用的存储')
    expect(document.querySelector('.set-mig-next')?.hasAttribute('disabled')).toBe(true)
  })

  it('选中分区后进浏览步骤,根路径按挂载点派生并拉一次目录', async () => {
    mountDlg()
    await (document.querySelector('.set-mig-item') as HTMLElement).click()
    await (document.querySelector('.set-mig-next') as HTMLElement).click()
    await flushPromises()
    expect(folderGetList).toHaveBeenCalledWith('/media/Backup')
    expect(document.body.textContent).toContain('/media/Backup/AppData')
  })

  it('确认步骤展示目标路径与 Docker 会停的警告', async () => {
    mountDlg()
    await (document.querySelector('.set-mig-item') as HTMLElement).click()
    await (document.querySelector('.set-mig-next') as HTMLElement).click()
    await flushPromises()
    await (document.querySelector('.set-mig-next') as HTMLElement).click()
    await flushPromises()
    expect(document.body.textContent).toContain('在此过程中,Docker 将暂时停止。')
  })

  it('开始迁移后按 200ms 轮询,done 时进完成步骤', async () => {
    vi.useFakeTimers()
    migrateAppPath.mockResolvedValue({ job_id: 'job-1' })
    getMigrateStatus
      .mockResolvedValueOnce({ id: 'job-1', type: 'app_data', status: 'running', phase: 'copying', stopping_apps: 0, progress: 42, processed_size: 10, total_size: 100 })
      .mockResolvedValue({ id: 'job-1', type: 'app_data', status: 'done', phase: 'starting_services', stopping_apps: 0, progress: 100, processed_size: 100, total_size: 100, new_path: '/DATA/AppData' })
    mountDlg()
    await (document.querySelector('.set-mig-item') as HTMLElement).click()
    await (document.querySelector('.set-mig-next') as HTMLElement).click()
    await flushPromises()
    await (document.querySelector('.set-mig-next') as HTMLElement).click()
    await flushPromises()
    await (document.querySelector('.set-mig-start') as HTMLElement).click()
    await flushPromises()
    expect(migrateAppPath).toHaveBeenCalledWith('app_data', '/media/Backup')
    vi.advanceTimersByTime(200); await flushPromises()
    expect(document.body.textContent).toContain('42')
    vi.advanceTimersByTime(200); await flushPromises()
    expect(document.body.textContent).toContain('迁移完成!')
    vi.useRealTimers()
  })

  it('迁移中不给关闭按钮(防用户中途关窗)', async () => {
    vi.useFakeTimers()
    migrateAppPath.mockResolvedValue({ job_id: 'job-1' })
    getMigrateStatus.mockResolvedValue({ id: 'job-1', type: 'app_data', status: 'running', phase: 'copying', stopping_apps: 0, progress: 5, processed_size: 1, total_size: 100 })
    mountDlg()
    await (document.querySelector('.set-mig-item') as HTMLElement).click()
    await (document.querySelector('.set-mig-next') as HTMLElement).click(); await flushPromises()
    await (document.querySelector('.set-mig-next') as HTMLElement).click(); await flushPromises()
    await (document.querySelector('.set-mig-start') as HTMLElement).click(); await flushPromises()
    vi.advanceTimersByTime(200); await flushPromises()
    expect(document.querySelector('.set-mig-close')).toBeNull()
    vi.useRealTimers()
  })

  it('status=error 时进错误步骤并显示后端 error 原文 + 已自动清理说明', async () => {
    vi.useFakeTimers()
    migrateAppPath.mockResolvedValue({ job_id: 'job-1' })
    getMigrateStatus.mockResolvedValue({ id: 'job-1', type: 'app_data', status: 'error', phase: 'copying', stopping_apps: 0, progress: 0, processed_size: 0, total_size: 0, error: 'insufficient space on target /media/Backup' })
    mountDlg()
    await (document.querySelector('.set-mig-item') as HTMLElement).click()
    await (document.querySelector('.set-mig-next') as HTMLElement).click(); await flushPromises()
    await (document.querySelector('.set-mig-next') as HTMLElement).click(); await flushPromises()
    await (document.querySelector('.set-mig-start') as HTMLElement).click(); await flushPromises()
    vi.advanceTimersByTime(200); await flushPromises()
    expect(document.body.textContent).toContain('insufficient space on target /media/Backup')
    expect(document.body.textContent).toContain('已自动清理')
    vi.useRealTimers()
  })

  it('轮询连续失败 5 次后停表并报错(移植纪律:Vue2 只 console.error,会无限轮询)', async () => {
    vi.useFakeTimers()
    migrateAppPath.mockResolvedValue({ job_id: 'job-1' })
    getMigrateStatus.mockRejectedValue(Object.assign(new Error('job not found'), { code: 4000 }))
    mountDlg()
    await (document.querySelector('.set-mig-item') as HTMLElement).click()
    await (document.querySelector('.set-mig-next') as HTMLElement).click(); await flushPromises()
    await (document.querySelector('.set-mig-next') as HTMLElement).click(); await flushPromises()
    await (document.querySelector('.set-mig-start') as HTMLElement).click(); await flushPromises()
    for (let i = 0; i < 6; i++) { vi.advanceTimersByTime(200); await flushPromises() }
    expect(document.body.textContent).toContain('job not found')
    const calls = getMigrateStatus.mock.calls.length
    vi.advanceTimersByTime(2000); await flushPromises()
    expect(getMigrateStatus.mock.calls.length).toBe(calls)   // 已停表
    vi.useRealTimers()
  })

  it('启动迁移的请求本身失败时直接进错误步骤', async () => {
    migrateAppPath.mockRejectedValue(new Error('boom'))
    mountDlg()
    await (document.querySelector('.set-mig-item') as HTMLElement).click()
    await (document.querySelector('.set-mig-next') as HTMLElement).click(); await flushPromises()
    await (document.querySelector('.set-mig-next') as HTMLElement).click(); await flushPromises()
    await (document.querySelector('.set-mig-start') as HTMLElement).click(); await flushPromises()
    expect(document.body.textContent).toContain('boom')
  })

  it('卸载时停表,不留下定时器', async () => {
    vi.useFakeTimers()
    migrateAppPath.mockResolvedValue({ job_id: 'job-1' })
    getMigrateStatus.mockResolvedValue({ id: 'job-1', type: 'app_data', status: 'running', phase: 'copying', stopping_apps: 0, progress: 5, processed_size: 1, total_size: 100 })
    const w = mountDlg()
    await (document.querySelector('.set-mig-item') as HTMLElement).click()
    await (document.querySelector('.set-mig-next') as HTMLElement).click(); await flushPromises()
    await (document.querySelector('.set-mig-next') as HTMLElement).click(); await flushPromises()
    await (document.querySelector('.set-mig-start') as HTMLElement).click(); await flushPromises()
    vi.advanceTimersByTime(200); await flushPromises()
    const calls = getMigrateStatus.mock.calls.length
    w.unmount()
    vi.advanceTimersByTime(2000); await flushPromises()
    expect(getMigrateStatus.mock.calls.length).toBe(calls)
    vi.useRealTimers()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm exec vitest run src/settings/panels/apps/AppPathDialog.test.ts
```
预期:FAIL —— 组件不存在

- [ ] **Step 3: 实现**

`src/settings/panels/apps/AppPathDialog.vue` —— 用 `components/ui/Dialog.vue` 作壳,内部按 `step` 分支渲染 6 个步骤。骨架要点(逐条对位 Vue2 `AppPathModal.vue`):

```vue
<script setup lang="ts">
// 设置 · 应用 —— 更改数据存储位置的迁移弹窗。对位 Vue2 components/settings/AppPathModal.vue(951 行)。
// 6 步:select(选分区) → browse(选目录) → confirm(确认) → migrating(进度) → done | error。
//
// ⛔ 破坏性:POST /v1/sys/migrate 会停 docker + 全部容器、rsync 数据、换锚点软链、
//    **删掉旧数据**(NimoOS/service/migrate.go:454/597/777-820)。开发机上一次都没真跑过 ——
//    而且本机只有一个分区,availableVolumes 恒为空,界面上根本走不到 select 之后。债务 D22。
//
// 移植纪律(登记):
//  ① 不写 localStorage(Vue2 在 done 时写 app_data_path 等三个键,New-UI 不读 → 死代码)。
//  ② **轮询失败不静默**:Vue2 pollStatus 的 catch 只 console.error,job 丢失(实测返回
//     HTTP 400 {"success":4000,"message":"job not found"})时会无限轮询下去。这里连续
//     失败 5 次就停表 + 进 error 步骤 + 显示后端原文。
// 照抄的 Vue2 形态:轮询 200ms;migrating 步骤不给关闭按钮。
import { ref, computed, onUnmounted, watch } from 'vue'
...
const POLL_MS = 200
const MAX_POLL_FAILS = 5
</script>
```

关键实现点(逐条,不要漏):

1. `availableVolumes = volumes.filter(v => v.mountPoint && partKey(v) !== partKey(currentVolume))`,`partKey = v.uuid || v.mountPoint`(Vue2 :470,md RAID 没有 uuid 才回退挂载点)。
2. `currentVolume = volumeForPath(currentPath, volumes)`(复用 Task 2 的导出)。
3. `browseRoot = browseRootPath(selectedVolume.mountPoint)`;进浏览步骤时 `browsePath = browseRoot` 并 `service.folder.getList(browseRoot)`。
4. 目录列表 = `filterBrowseFolders(listing.content, type, currentPath)`;面包屑 = `browseCrumbs(browseRoot, browsePath, displayNames)`;返回上级 = `parentPath(browsePath, browseRoot)`。
5. 新建文件夹:行内输入框,回车/失焦提交 → `service.folder.create(path)`,失败把后端 message 显示成**行内红字**(`.set-danger`),**不用 toast**。
6. 右键菜单(用 `components/ui/ContextMenu.vue`):重命名 / 删除,`isProtectedFolder(name)` 为真时两项都禁用。删除走 `service.batch.delete([path])` 且**必须二次确认**(`AlertDialog`,`destructive: true`)。
7. `confirm` 步骤:`currentVolume.name → selectedVolume.name`、`renderSize(requiredSpace)` + `settingsMigWillBeMoved`、`browseDestPaths(type, browsePath)` 列表、警告块两句(`settingsMigNoteBody` + `settingsMigNoteDocker`)。
8. `startMigration`:`service.sys.migrateAppPath(type, browsePath)` → 拿 `job_id` → `setInterval(poll, POLL_MS)`。请求本身失败 → 直接 `step='error'` 并把 `e.message` 放进 `jobError`。
9. `poll`:`service.sys.getMigrateStatus(jobId)` → 成功则 `fails=0` 并更新 `jobStatus`;`status==='done'` → 停表 + `step='done'` + `emit('finish')`;`status==='error'` → 停表 + `step='error'`;抛错则 `fails++`,`fails >= MAX_POLL_FAILS` 时停表 + `step='error'` + `jobError = e.message`。
10. `migrating` 步骤按 `jobStatus.phase` 三分支渲染(`stopping_services` / `copying` 或空串 / `starting_services`),进度条宽度 = `jobStatus.progress + '%'`,`stopping_apps > 0` 时多一行 `settingsMigStoppingApps`。
11. `onUnmounted` 清定时器;`watch(() => props.open)` 在关闭时复位 `step='select'` 并清定时器。

- [ ] **Step 4: 跑测试确认通过**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm exec vitest run src/settings/panels/apps/AppPathDialog.test.ts && pnpm exec vue-tsc --noEmit
```
预期:11 例全绿,tsc 0

- [ ] **Step 5: 变异验证(证明守卫不是空转)**

逐个做,做完改回来:

| 变异 | 预期翻红的用例 |
|---|---|
| 把 `MAX_POLL_FAILS` 判断整段删掉 | 「轮询连续失败 5 次后停表并报错」 |
| `onUnmounted` 里不清定时器 | 「卸载时停表」 |
| `availableVolumes` 不剔除当前分区 | 「当前所在分区被剔除」+「只有一个分区时禁用下一步」 |

记录结果到台账。

- [ ] **Step 6: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git add src/settings/panels/apps/AppPathDialog.vue src/settings/panels/apps/AppPathDialog.test.ts
git commit src/settings/panels/apps/AppPathDialog.vue src/settings/panels/apps/AppPathDialog.test.ts -m "feat(settings): 数据位置迁移弹窗(选盘/浏览/确认/进度/完成/失败六步)"
```

---

## Task 9: `AppsPanel` 装配

**Files:**
- Create: `src/settings/panels/apps/AppPathRow.vue`
- Modify: `src/settings/panels/AppsPanel.vue`
- Test: `src/settings/panels/AppsPanel.test.ts`

**Interfaces:**
- Consumes: Task 2 `buildAppPathRows`;Task 8 `AppPathDialog`;共享包 `service.sys.getSystemPaths()`、`service.storage.list()`、`service.container.prune()`(Task 1);`src/files/util/pathUtils.ts` 的 `toVirtualPath`;`src/files/util/format.ts` 的 `renderSize`
- Produces: 无(叶子面板)

**Vue2 对位**:`SettingsPanel.vue:587-665`(模板)+ `:1910-1971 loadAppsData()` + `:1973 pruneDocker()` + `:2010 clearLocalUploads()`。

**「清理本地待上传缓存」行 —— 做样子(政策三 / spec §5.6)**:保留这一行 UI(标题 + 副标题 + 按钮),**按钮禁用 + 标注「待相册区迁移完成后启用」**,逻辑留空。⚠️ **别拿 `src/files/upload/idb.ts` 顶** —— 那是 SP4 文件区的独立 TUS 队列,与相册两套。接线归 **SP7-P8**(债务 D13)。

- [ ] **Step 1: 写失败测试**

`src/settings/panels/AppsPanel.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AppsPanel from './AppsPanel.vue'
import { i18n } from '../../i18n'

const getSystemPaths = vi.fn()
const storageList = vi.fn()
const prune = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    sys: { getSystemPaths: () => getSystemPaths(), migrateAppPath: vi.fn(), getMigrateStatus: vi.fn() },
    storage: { list: (...a: unknown[]) => storageList(...a) },
    container: { prune: () => prune() },
    folder: { getList: vi.fn().mockResolvedValue({ content: [] }), create: vi.fn(), rename: vi.fn() },
    batch: { delete: vi.fn() },
  },
}))

// 真机 fixture(2026-08-01)
const PATHS = {
  app_data: { path: '/DATA/AppData', size: 6037987 },
  database: { path: '/DATA', size: 3554691143 },
  images: { path: '/DATA/.system_data/.docker & .containerd', size: 55559455762 },
  photos_data: { path: '/DATA/.system_data/photos', size: 6242024935 },
}
const RAW_STORAGE = [{
  disk_name: 'System', size: 512110190592, path: '/dev/nvme0n1', type: 'nvme',
  children: [{ uuid: 'da0e4da3', mount_point: '/', size: '512110190592', avail: '333092294144', used: '179017896448', type: 'ext4', path: '/dev/nvme0n1p7', drive_name: 'nvme0n1p7', label: 'NimoOS-HD' }],
}]

const mountPanel = () => mount(AppsPanel, { global: { plugins: [i18n] }, attachTo: document.body })

describe('AppsPanel', () => {
  beforeEach(() => {
    getSystemPaths.mockReset(); storageList.mockReset(); prune.mockReset()
    getSystemPaths.mockResolvedValue(PATHS); storageList.mockResolvedValue(RAW_STORAGE)
    prune.mockResolvedValue({ containers: null, images: null })
  })
  afterEach(() => { document.body.innerHTML = '' })

  it('渲染三行数据位置 —— 后端给了 4 个 key(含 photos_data),界面 1:1 只显示 3 行', async () => {
    const w = mountPanel()
    await flushPromises()
    const rows = w.findAll('.set-app-row')
    expect(rows).toHaveLength(3)
    expect(rows[0].text()).toContain('App 数据')
    expect(rows[1].text()).toContain('App 镜像集')
    expect(rows[2].text()).toContain('用户数据库')
  })

  it('路径 chip 经 displayNames 变成虚拟路径', async () => {
    const w = mountPanel()
    await flushPromises()
    expect(w.findAll('.set-app-row')[0].text()).toContain('/NimoOS-HD/AppData')
  })

  it('用户数据库那行的路径带 Vue2 的四目录后缀(1:1)', async () => {
    const w = mountPanel()
    await flushPromises()
    expect(w.findAll('.set-app-row')[2].text()).toContain('/Documents & Downloads & Gallery & Media')
  })

  it('点某行的按钮打开迁移弹窗,并把该行的 type / 路径 / 大小传进去', async () => {
    const w = mountPanel()
    await flushPromises()
    await w.findAll('.set-app-act')[0].trigger('click')
    await flushPromises()
    expect(document.body.textContent).toContain('存储位置')
    expect(document.body.textContent).toContain('没有其他可用的存储')   // 本机单分区
  })

  it('Docker 缓存清理必须先过二次确认才发请求', async () => {
    const w = mountPanel()
    await flushPromises()
    await w.find('.set-app-prune').trigger('click')
    await flushPromises()
    expect(prune).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('这将删除所有未使用的容器、网络和镜像。确定要继续吗?')
  })

  it('确认后调 prune 并显示成功提示', async () => {
    const w = mountPanel()
    await flushPromises()
    await w.find('.set-app-prune').trigger('click')
    await flushPromises()
    await (document.querySelector('.ui-dialog-confirm') as HTMLElement).click()
    await flushPromises()
    expect(prune).toHaveBeenCalledTimes(1)
  })

  it('prune 失败时提示失败文案,不静默', async () => {
    prune.mockRejectedValue(new Error('docker daemon unreachable'))
    const w = mountPanel()
    await flushPromises()
    await w.find('.set-app-prune').trigger('click')
    await flushPromises()
    await (document.querySelector('.ui-dialog-confirm') as HTMLElement).click()
    await flushPromises()
    expect(w.text()).toContain('清理 Docker 缓存失败。')
  })

  it('清理本地待上传缓存行:UI 在、按钮禁用、带待相册区迁移的标注(政策三"做样子")', async () => {
    const w = mountPanel()
    await flushPromises()
    expect(w.text()).toContain('清除本地未完成的上传')
    expect(w.find('.set-app-pending-btn').attributes('disabled')).toBeDefined()
    expect(w.text()).toContain('待相册区迁移完成后启用')
  })

  it('取数失败时三行仍在(空路径),不白屏', async () => {
    getSystemPaths.mockRejectedValue(new Error('boom'))
    const w = mountPanel()
    await flushPromises()
    expect(w.findAll('.set-app-row')).toHaveLength(3)
  })
})
```

⚠️ `.ui-dialog-confirm` 是 `AlertDialog.vue` 里确认按钮的实际类名 —— 实现前先打开该文件确认,用真实类名。

- [ ] **Step 2: 跑测试确认失败**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm exec vitest run src/settings/panels/AppsPanel.test.ts
```
预期:FAIL —— 骨架里没有这些元素

- [ ] **Step 3: 实现 `AppPathRow.vue`**

```vue
<script setup lang="ts">
// 设置 · 应用 —— 「App 数据存储位置」里的一行。对位 Vue2 SettingsPanel.vue:596-633。
// 形态:左侧标题 + 两个 chip(用量/容量 · 路径),右侧一个"更改存储位置"按钮。
import { useI18n } from 'vue-i18n'
import { renderSize } from '../../../files/util/format'
import '../../styles/settings.css'

defineProps<{ label: string; sizeText: string; pathText: string }>()
const emit = defineEmits<{ change: [] }>()
const { t } = useI18n()
</script>

<template>
  <div class="set-app-row">
    <div class="set-app-row-main">
      <div class="set-app-row-label">{{ label }}</div>
      <div class="set-app-chips">
        <span class="set-app-chip">{{ sizeText }}</span>
        <span class="set-app-chip set-app-chip-path">{{ pathText }}</span>
      </div>
    </div>
    <button class="set-app-act" type="button" :title="t('settingsAppsChangeLocation')" @click="emit('change')">
      ⤴
    </button>
  </div>
</template>
```

⚠️ `renderSize` 若在本组件用不上就别 import(tsc 的 `noUnusedLocals` 会报)。

- [ ] **Step 4: 实现 `AppsPanel.vue`**

替换骨架,要点:

1. `onMounted` 并发取 `service.sys.getSystemPaths()` 与 `service.storage.list({ system: 'show' })`(后者过 `mapVolumes`),失败各自回退空值;**加 `touched` 过期守卫**(全局约束 8)—— 本面板没有用户可编辑的控件,但仍要防「取数落定时组件已卸载」的赋值,用一个 `alive` 布尔在 `onUnmounted` 置 false。
2. `rows = computed(() => buildAppPathRows(paths.value, volumes.value))`。
3. 每行的 `sizeText` = `` `${renderSize(row.size)} / ${renderSize(row.total)}` ``(`total` 为 0 时显示 `—`);`pathText` = `toVirtualPath(row.path, displayNames)`,**`database` 那行末尾追加 `/Documents & Downloads & Gallery & Media`**(Vue2 模板 :627 就是这么写死的,1:1 照留)。
4. `displayNames` 从 `volumes` 派生:`Object.fromEntries(volumes.map(v => [v.mountPoint, v.name]))`(与 `files/stores/files.ts:loadRoots` 同口径,避免为一个 chip 去拉整个文件区 store)。
5. Docker 缓存清理:一行 `.set-app-prune`(用 `SettingsRow` 的 `clickable`),点击 → `AlertDialog`(`destructive`)→ 确认后 `service.container.prune()`,期间副标题换成 `settingsAppsDockerCleaning`;成功/失败都用 toast(**这不是弹窗内报错**,是面板级提示,toast 合适)。
6. 清理本地待上传缓存:一行 + 一个 `disabled` 按钮 `.set-app-pending-btn`,副标题 `settingsAppsPendingNone`,下方 hint `settingsAppsPendingDisabledHint`。**不 import 任何 idb 模块。**
7. `AppPathDialog` 挂在面板底部,`v-model:open`,`@finish` 时重新取一次 `getSystemPaths`。

代码里必须写的注释:

```ts
// ⛔ POST /v1/container/prune 会删掉**全部已停止的容器**(后端是 ContainersPrune 空过滤器,
//    NimoOS-AppManagement/service/container.go:902)+ 悬空镜像。开发机上从没真跑过 —— 用户
//    2026-08-01 拍板不点(本机会误删桌面小组件容器 nimoos-demo-widget / todo-widget)。债务 D23。

// 「清理本地待上传缓存」= 政策三「做样子」:界面 1:1、按钮禁用、标注待相册区迁移完成后启用。
//    数据源是**相册**的 IndexedDB 上传队列(Vue2 @/views/Photos/upload/idb.js),SP7 尚未迁。
//    ⚠️ 别拿 src/files/upload/idb.ts 顶 —— 那是 SP4 文件区的独立 TUS 队列,两套东西。债务 D13。
```

- [ ] **Step 5: 跑测试确认通过**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm exec vitest run src/settings/panels/AppsPanel.test.ts && pnpm exec vue-tsc --noEmit
```
预期:9 例全绿,tsc 0

- [ ] **Step 6: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git add src/settings/panels/apps/AppPathRow.vue src/settings/panels/AppsPanel.vue src/settings/panels/AppsPanel.test.ts
git commit src/settings/panels/apps/AppPathRow.vue src/settings/panels/AppsPanel.vue src/settings/panels/AppsPanel.test.ts -m "feat(settings): 应用 tab 装配(数据位置三行 + Docker 缓存清理 + 待上传缓存做样子)"
```

---

## Task 10: 收尾 —— 全量门 + 静态自查 + 台账 + roadmap + 验收清单

**Files:**
- Modify: `src/settings/panels/panels.test.ts`(四个 tab 的装配断言从"骨架"改成"实体")
- Create: `.superpowers/sdd/sp9/04-p3.md`(gitignore,不进 git)
- Create: `.superpowers/sdd/sp9/04-p3-acceptance.md`(gitignore,不进 git)
- Modify: `/home/nimo/NimoTech/NimoOS-UI/docs/vue3-migration-roadmap.md` §4 SP9

- [ ] **Step 1: 更新 `panels.test.ts`**

打开该文件,把 apps / terminal / system-status / storage 四个 tab 的「渲染骨架提示」断言改成断言实体元素(`.set-app-row` / `.set-logs` / `.set-comp-row` / `.set-store-entry`)。四个面板现在都发请求,需要在该文件里 mock `@nimotech/nimoos-service`。

- [ ] **Step 2: 跑全量三门**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm test 2>&1 | tail -6
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm exec vue-tsc --noEmit && echo "tsc OK"
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm build 2>&1 | tail -4
cd /home/nimo/NimoTech/NimoOS-Service && pnpm test 2>&1 | tail -4
```

判定标准是**相对基线不新增红**(spec §9.4 第 5 条),不是"全绿"。基线:

| 项 | 基线(P2 末) | P3 末预期 |
|---|---|---|
| New-UI `pnpm test` | 297 文件 / 2316 例 | 约 306 文件 / 2400+ 例(**color-guard 会因新增 4 个 `.vue` 自动 +4**) |
| New-UI `vue-tsc --noEmit` | 0 错误 | 0 错误 |
| New-UI `pnpm build` | 通过 | 通过 |
| Service `pnpm test` | 25 文件 / 169 例 | 25 文件 / 172 例 |

- [ ] **Step 3: 静态配色自查(P2 验证过有效的替代手段)**

真页面浏览器自查恒为 0 项(认证阻塞,见 P1 台账 §八点五)。照 P2 的做法:用本期真机 fixture 拼**与组件模板同构的静态 HTML**,直接引 `theme.css` + `theme.sp9.css` + `settings.css`,用缓存里的 chromium 截**暗色 + 亮色**两张图。

重点看:三行数据位置的 chip 对比度 · 系统状态的绿/红点在两套主题下分得清 · **日志卡在亮色主题下仍是深底浅字(有意为之)** · 迁移弹窗输入框**没有被 `.set-input` 的 92px 截断** · 入口卡的容量条两段颜色可区分。

- [ ] **Step 4: 写台账 `.superpowers/sdd/sp9/04-p3.md`**

必须包含:基线数字 · 破坏面判定三条(migrate / prune / folder 写操作)与依据 · 本期 8 条真机 fixture · 用户 3 个拍板 · 移植纪律登记 · 变异验证结果 · 新增债务 · 任务门最终数字 · 坐标(两仓 commit 范围)· 留给 P4 的事。

- [ ] **Step 5: 同步 roadmap §4 SP9(重要结论必须进 git,台账是 gitignore 的)**

改之前先 `cd /home/nimo/NimoTech/NimoOS-UI && git log -1`(sp7 会话也在写这个仓的文档),改动尽量小,改完立刻带 pathspec 提交。要写进去的:

- P3 关账坐标 + 任务门数字。
- **实测校正**:① `/v1/sys/paths` 返回 4 个 key(含 `photos_data`)而 Vue2 只渲染 3 行;② `images.path` 是含 ` & ` 的展示串不是真路径;③ **`/v1/terminal/settings` 也是 404**(更正 spec §5.5)→ 授权偏离 #9;④ `/v1/sys/logs` 单次 2.67MB 且 5 秒轮询 → D24;⑤ 本机单分区 → 迁移界面不可达。
- **债务**:D22(迁移零实机验证)· D23(prune 不点)· D24(日志端点无分页,后端票)· D25(Terminal 服务整体缺失,后端票,与 D7 并列)。
- **授权偏离**:#9(终端安全区合成空态)· #10(12 条补中文译)。
- 更新 §3.3 追踪表:`container` → **`prune` 已进包**(销 D10 的该子项)。

- [ ] **Step 6: 写验收清单 `.superpowers/sdd/sp9/04-p3-acceptance.md`**

结构照 `03-p2-acceptance.md`:

1. **第一屏就是「⛔ 这一期有哪些地方请不要点」** —— Docker 缓存清理的「清理」按钮(会删掉桌面那两个小组件容器);迁移弹窗里的任何「开始迁移」(本机走不到,但仍写明);浏览步骤的新建/重命名/删除文件夹。
2. 怎么起:`pnpm dev --host` → `http://192.168.1.143:5273/app/#/settings/apps`,**不要跑 `./scripts/deploy.sh`**。
3. 逐项验收表,**预期值全部用本期 curl 出来的真实值**:
   - apps:三行 = `App 数据` 5.76 MB / `App 镜像集` 51.74 GB / `用户数据库` 3.31 GB(用 `renderSize` 的实际输出换算后填,**不要凭空写**),容量分母都是 476.95 GB;路径 chip 显示 `/NimoOS-HD/AppData` 等。
   - 点「更改存储位置」→ 弹窗第一步显示「没有其他可用的存储」,下一步按钮是灰的(本机只有一个分区)。
   - system-status:17 行分三组(核心服务 12 · 前端界面 1 · 外部依赖 4),其中 6 个离线(User Service / Message Bus / Wiki / Terminal / Parser / Ollama),鼠标悬停离线项能看到后端原因。
   - terminal:顶部是「终端服务暂不可用」空态,下方日志卡有真实日志、能滚动、全屏能切、点「下载日志」下载到 `NimoOS.zip`。
   - storage:容量条 + 「打开存储区」卡,点了跳到 `/storage`。
   - 亮/暗两套主题各看一遍;窄屏 ~420px。
4. 「已知的、不用报给我的」:photos_data 不显示(Vue2 就没这一行)· 日志时间戳前 8 个字符被裁掉(Vue2 的既有显示形态)· 日志卡在亮色主题下也是深色底。

- [ ] **Step 7: 提交(注意 roadmap 在另一个仓)**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git add src/settings/panels/panels.test.ts
git commit src/settings/panels/panels.test.ts -m "test(settings): panels 装配断言跟进 P3 四个 tab"

cd /home/nimo/NimoTech/NimoOS-UI
git add docs/vue3-migration-roadmap.md
git commit docs/vue3-migration-roadmap.md -m "docs(roadmap): SP9-P3 关账 —— 实测校正 5 条 + 债务 D22-D25 + 授权偏离 #9/#10"
```

- [ ] **Step 8: 确认那 3 个 `design-export` staged 删除全程没被卷进任何 commit**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && git log --name-only 92ef3b6..HEAD | grep -c design-export
```
预期:`0`

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && git status --short
```
预期:仍然只有那 3 行 `D  design-export/...`,位置不变。

---

## 自查(写完计划后对着 spec 复核的结果)

**1. spec 覆盖**

| spec 条目 | 落点 |
|---|---|
| §5.4 apps 三行 + AppPathModal + 迁移轮询 + Docker 缓存清理 | Task 2 / 3 / 8 / 9 |
| §5.4 `container.prune` 进包(⚠️ 别拿 `sys.js:154` 的同名) | Task 1 |
| §5.5 system-status | Task 5 |
| §5.5 terminal(Logs + 终端安全 + 终端位空态) | Task 6 —— **终端安全区按用户 2026-08-01 拍板合成空态(授权偏离 #9),更正 spec** |
| §5.5 storage 入口卡(授权偏离 #3) | Task 7 |
| §5.6 清理本地待上传缓存做样子 | Task 9 |
| §3.1 政策二(后端打不通的不测不验) | Task 6(wsssh / terminal settings)· Task 8(migrate 之后各步) |
| §3.1 政策三(依赖在建前端的先做样子) | Task 9 待上传缓存行 |
| §10 硬约束速查 | Global Constraints 全部收编 |
| §11 债务 | D13 / D22-D25 在 Task 9 / 10 |

**2. 占位符扫描**:无 TBD / TODO / "类似 Task N" / "补充适当的错误处理"。三处标了 ⚠️ 的是**要求实现者先去源码确认真实名字**(token 名 / `renderSize` 输出 / `AlertDialog` 类名),不是占位符 —— 计划里给了确认命令。

**3. 类型一致性**:`AppPathKey` 在 Task 2 定义,Task 3 / 8 / 9 引用同名;`AppPathRow` 字段 `{key,path,size,total}` 在 Task 2 定义、Task 9 消费;`PruneReport` 在 Task 1 定义、Task 9 只用返回值不解构;`browseDestPaths(type, base)` 参数顺序在 Task 3 定义与 Task 8 调用一致;`StorageVolume` 用的是 SP6 既有类型(`mountPoint` 驼峰,不是 `mount_point`)。
