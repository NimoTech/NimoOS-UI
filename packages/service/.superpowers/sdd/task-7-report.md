# Task 7 报告:index 装配 + 全量验证 + New-UI 消费方回归 + 记账

## Step 1: index.ts 装配

`src/index.ts` 追加:
- import 区:`import { createAppstore } from './appstore.js'` + `import { createCompose } from './compose.js'`(`.js` 后缀保留)
- 类型导出行追加:`AppCategory, StoreAppInfo, StoreAppCatalog, UpgradableAppInfo, AppStoreSource, ComposeAppWithStoreInfo`
- `service` 对象追加两个 getter(照既有惰性模式):

```typescript
get appstore(): ReturnType<typeof createAppstore> {
  return createAppstore(getHttp() as AxiosInstance)
},
get compose(): ReturnType<typeof createCompose> {
  return createCompose(getHttp() as AxiosInstance)
},
```

## Step 2: 共享包全量验证(NimoOS-Service)

```bash
cd /home/nimo/NimoTech/NimoOS-Service
pnpm vitest run
pnpm exec tsc --noEmit
pnpm build
```

| 命令 | 结果 |
|---|---|
| `pnpm vitest run` | **21 files / 101 tests 全通过**,零回归(与 Task 6 记录的 101 一致) |
| `pnpm exec tsc --noEmit` | 零输出,零错误 |
| `pnpm build`(`tsc -p tsconfig.json`) | 成功,`dist/appstore.js`/`dist/compose.js`/`dist/index.js` 均生成;`dist/index.js` 内确认 `import { createAppstore }`/`import { createCompose }` + `get appstore()`/`get compose()` 均已装配。`dist/` 本身被 `.gitignore`(此前 `45e9165` 提交已停止跟踪),不进版本控制。 |

## Step 3: New-UI 消费方回归

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
sha256sum pnpm-lock.yaml   # 安装前: a268c6e194667b7cb26bdba25aed3080e1d630d25f6aeec81ed076457ad05a48
pnpm install
sha256sum pnpm-lock.yaml   # 安装后: a268c6e194667b7cb26bdba25aed3080e1d630d25f6aeec81ed076457ad05a48(一致,无变动)
pnpm vitest run
pnpm exec vue-tsc --noEmit
```

| 命令 | 结果 |
|---|---|
| `pnpm install` | 重同步 `file:../NimoOS-Service` 本地包快照,`Packages: +1`(新增的 `appstore.js`/`compose.js` 产物文件被 pnpm 识别),**`pnpm-lock.yaml` sha256 安装前后完全一致,无变动** |
| `pnpm vitest run` | **171 files / 807 tests 全通过**,零回归 |
| `pnpm exec vue-tsc --noEmit` | 零输出,零错误 |

P0 全程未动 New-UI 源码,本步骤纯粹确认共享包升级对现有消费方无破坏。

## Step 4: Commit(共享包)

```bash
cd /home/nimo/NimoTech/NimoOS-Service
git add src/index.ts
git commit -m "feat(index): 装配 appstore/compose 域并导出 SP5 类型 ..."
```

**Commit: `115e4ea`**(`sp3-shared-http` 分支,1 file changed, 9 insertions(+), 1 deletion(-),仅本地未 push)。

## Step 5: roadmap 记账 + 提交(NimoOS-UI docs 分支)

`docs/vue3-migration-roadmap.md` §3.3 域表:
- 新增「✅ 已进包(SP5-P0,2026-07-20)」行:`appstore`(目录/详情/compose 原文/可升级/源管理)· `compose`(已装应用生命周期)
- 「待迁」行 `container` 标注「v2 部分已覆盖→SP5-P0 `compose` 域;Vue2 v1 部分待 SP5 迁区收口」,移除 `appCategories`
- 新增一条注:`appCategories`→`appstore.categories` 并入,`container`(v2)→`compose` 并入,`image` 无独立 UI 直调不建域
- SP5 段(§4)加一行 P0 完成注记,含实际 commit hash(AppManagement main `1a6927d`,Service `5c96703`/`e010f54`/`0c70d3d`/`115e4ea`),标注 P1 起页壳+已装管理页开工前需先出 P1 计划
- `container`/`image`/`appCategories` 迁包待办行标注「已覆盖:v2 部分随 P0 进包」

```bash
cd /home/nimo/NimoTech/NimoOS-UI
git add docs/vue3-migration-roadmap.md   # 只这一个文件,工作区其余未提交改动(6 modified + 8 untracked)未动
git commit -m "docs(roadmap): SP5-P0 完成记账(AppManagement 分支合并 + 共享包 appstore/compose 域) ..."
```

**Commit: `c52c56a`**(`docs/vue3-migration-sp3` 分支,1 file changed, 5 insertions(+), 2 deletions(-),仅本地未 push)。提交前后 `git status --short` 核对确认只有 `docs/vue3-migration-roadmap.md` 被 stage,其余 6 个 modified + 8 个 untracked 文件维持原状未被带入。

## Step 6: 台账收尾

`/home/nimo/NimoTech/NimoOS-New-UI/.superpowers/sdd/progress-sp5-p0.md` 已补齐 Task 7 章节:命令与结果、全部 commit hash 汇总表(AppManagement/Service ×4/docs)、Task 3 实录差异汇总(dry_run 信封异常,已在 Task 6 承接适配,Task 7 未发现新增差异)、P1 待办提醒(页壳挂载点 + 已装管理页交互映射 + Minor 遗留三项)。**该文件路径在 NimoOS-New-UI 仓的 `.gitignore` 命中(`.superpowers/`),更新不产生任何 New-UI 提交**,与「NimoOS-New-UI 只跑 install+回归、不产生提交」的约束天然一致。

## 三仓最终状态

| 仓 | 分支 | HEAD | 说明 |
|---|---|---|---|
| NimoOS-Service | `sp3-shared-http` | `115e4ea` | 本轮新增,working tree clean |
| NimoOS-UI | `docs/vue3-migration-sp3` | `c52c56a` | 本轮新增,仅 roadmap 一个文件;工作区其余既有未提交改动原样保留(未动) |
| NimoOS-New-UI | `master` | `c4d154c`(未变,非本轮产生) | 未产生任何新提交;`pnpm-lock.yaml` 无变动;working tree 除 `.superpowers/`(gitignored)外干净 |

## 结论

全部 6 个 Step 均按简报完成,无 BLOCKED。共享包全量验证(vitest 101/101、tsc 0 错误、build 成功)与 New-UI 消费方回归(vitest 807/807、vue-tsc 0 错误)均零回归;lockfile 无变动。三仓约束(Service 提交本地分支、UI 仅动 roadmap 一个文件、New-UI 零提交)全部遵守。无 concerns。

## 终审修复

P0 整支终审(opus)提出 3 项 findings,一次性处理,两个仓库各一个 commit。

### 修复 1(Important)取值方法返回类型诚实化

- `NimoOS-Service/src/compose.ts`:`get(id)` 签名 `Promise<ComposeAppWithStoreInfo>` → `Promise<ComposeAppWithStoreInfo | undefined>`。
- `NimoOS-Service/src/appstore.ts`:`getApp(id)` 签名 `Promise<StoreAppInfo>` → `Promise<StoreAppInfo | undefined>`。
- 实现不变(v2Data 对 data 缺失本就返回 undefined),只是签名如实反映,强制调用方(P1)做判空处理。
- 各加一条回归测试:mock `{ message: '', data: undefined }` → 方法返回 `undefined`。

### 修复 2(Minor①)`compose.list()` 去掉 'message' in data 形状启发式

- 旧实现嗅探解包后对象的键名(`!('message' in data)`),若 store app id 恰好叫 `message` 会被误判成错误信封整表清空。
- 改为判**原始信封**是否含 `data` 键,而非解包后对象的内容:
  ```typescript
  async list(): Promise<Record<string, ComposeAppWithStoreInfo>> {
    const res = await http.get(BASE)
    const body = res.data as { data?: unknown } | null
    const d = body && typeof body === 'object' && 'data' in body ? body.data : undefined
    return d && typeof d === 'object' && !Array.isArray(d) ? (d as Record<string, ComposeAppWithStoreInfo>) : {}
  }
  ```
  （注:落地时把 fallback 分支从最初草案的 `: body` 改成 `: undefined`——若信封无 `data` 键时回退整个 body,会让既有测试 `{message:''}` 期望 `{}` 的用例回归失败;`: undefined` 才能让"无 data 键"与"data 非对象"两种情况都正确落到 `{}`。）
- 既有测试(`{message:''}` → `{}`;正常 map → 原样)保持绿;新增回归 `{ message:'', data: { message: { status:'running' } } }` → 返回含 key `message` 的 map,证明 id 叫 message 的应用不再被误杀。

### 修复 3(评审建议)`src/v2.ts` 注释补充

在 `v2Data` 函数注释末尾加一句:仅用于必带 data 的 2xx 信封;message-only 响应(如 dry_run 的 `{message}`)不应过 v2Data——那类方法应忽略响应体或自行读原始信封。只加注释,未改逻辑。

### 修复 4(Important,NimoOS-UI 仓)convert 决策补追溯

`docs/superpowers/specs/2026-07-20-vue3-migration-sp5-apps-design.md` §3.3:
- compose 域方法列表删去 `convert(dockerRunCmd)`。
- 节末追加:「注(P0 实证落定):后端 POST /convert 是 appfile→compose 转换而非 docker run 导入,compose 域不建 convert 方法;docker run 导入在 P5 走前端 composerize(§3.6 决策规则落定,详见 P0 plan Task 6)。」
- 只 `git add` 该一个文件;工作区其余既有未提交改动(6 个 modified + 若干 untracked)原样保留未动。

### 验证

```bash
cd /home/nimo/NimoTech/NimoOS-Service
pnpm vitest run       # 21 files / 104 tests 全绿(原 101 + 新增 3)
pnpm exec tsc --noEmit  # 0 错误
```

首次跑 `pnpm vitest run` 时 `list 解映射,缺 data 容空` 一条回归失败(fallback 写成 `: body` 导致 `{message:''}` 被当作合法 map 返回而非 `{}`),定位后改成 `: undefined` 后复跑全绿——过程已记入修复 2 的备注,便于以后不重踩。

### Commit

| 仓 | 分支 | Commit | 说明 |
|---|---|---|---|
| NimoOS-Service | `sp3-shared-http` | `e8df69d` | 修复 1/2/3,104 tests 绿 + tsc 0 错误 |
| NimoOS-UI | `docs/vue3-migration-sp3` | `573da2b2` | 修复 4,仅 1 file changed(spec 文档),工作区其余改动未碰 |
