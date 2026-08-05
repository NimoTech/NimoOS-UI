# SP5-P0 执行台账
Plan: NimoOS-UI/docs/superpowers/plans/2026-07-20-vue3-migration-sp5-p0-foundation.md

## Task 1 上游漂移审计

### Step 2: NimoOS-UI 应用区上游审计

```bash
cd /home/nimo/NimoTech/NimoOS-UI && git fetch git@github.com:NimoTech/NimoOS-UI.git main
git log --oneline HEAD..FETCH_HEAD | wc -l
# 输出: 14
```

总共有 14 个提交在上游但本地没有。

**应用区路径检查**:
```bash
git log --oneline HEAD..FETCH_HEAD -- src/components/Apps src/service/container.js src/service/apps.js src/service/appCategories.js src/service/index.js
# 输出: (空)
```

**结论**: 应用区无漂移 ✓

### Step 3: NimoOS-AppManagement 上游审计

```bash
cd /home/nimo/NimoTech/NimoOS-AppManagement && git fetch git@github.com:NimoTech/NimoOS-AppManagement.git main
git log --oneline main..FETCH_HEAD
# 输出: (空)
```

**结论**: 上游无缺少的提交,本地 main 包含所有上游代码 ✓

### Step 4: 最终判定

- Vue2 应用区: **无漂移**
- AppManagement 上游: **无漂移**
- **综合结论**: 两处都干净,无上游漂移,**可以继续 Task 2** ✓

## Task 2 合并与部署

**合并方式**: `git merge --ff-only feat/desktop-label-recognition`(Fast-forward,无冲突,无需额外 commit)。

- 合并前 main: `788ff9645b6a3791e6b0b1a07853c55b947ab9f5`
- 合并后 main HEAD: `1a6927d8491b59c4595b1a7ec9a679d2973ee318`(短 `1a6927d`,提交信息 `fix(desktop): resize=false 糖守卫容忍负值垃圾输入`)
- feat 分支保留未删,未 push 远端。

**构建**: `go build -o .../nimoos-app-management .` 成功(exit 0)。

**测试**: `go test ./... -timeout 60s`

merged main(1a6927d)结果:
- `ok`: `cmd/validator/pkg`、`common`(含新增 `message_test.go`)、`model`、`route/v2`(含新增 `internal_web_test.go`)
- `FAIL`(3 个包,均为环境/网络限制导致,非本次合并引入):
  - `pkg/docker`:`TestCurrentArchitecture` — 无 docker socket 权限(`permission denied .../docker.sock`)
  - `pkg/utils/downloadHelper`:`TestDownload` — 沙箱内下载 404(需真实外网)
  - `service`:`TestAppStoreList` — 尝试拉取真实 AppStore(`github.com/nimotech/_appstore`)在沙箱无外网,60s 超时 panic
  - `service` 包内新增的桌面相关用例全部通过(`-v` 单独确认):`TestApplyDesktopMeta`、`TestParseDesktopLabels`(10 子用例全绿)、`TestContainerEventProperties`、`docker_events_test.go` 相关用例

**基线对照**(合并前 `788ff96`,用临时 git worktree `/home/nimo/NimoTech/.baseline-788ff96-worktree` 跑 `go generate ./...` + `go build` + `go test ./... -timeout 60s`,跑完已删除该 worktree):
同样 3 个包 FAIL,同样的根因(docker socket 无权限 / downloadHelper 404 / AppStore 无外网超时)。**零新增失败**,合并前后失败集合完全一致 ✓

**部署**: `nimo_os_docs/scripts/deploy.sh app-management`

- 部署前发现 `nimoos-app-management.service` 的 `ActiveEnterTimestamp` 是 07-17(旧构建,非本次合并产物),遂重新执行部署脚本。
- 部署输出确认版本 `1.9.3-alpha1+11.g1a6927d`(commit hash 与合并后 HEAD 一致),日志含新特性行 `docker events monitor started`,服务 `active (running)`。

**冒烟**: `curl -s --max-time 10 http://localhost/v2/app_management/web/appgrid`

返回 JSON 数组,且列表中 `nimoos-demo-widget`、`todo-widget` 两项均带 `"desktop":true` 及 `widget` 字段(桌面识别功能在 main 构建下确认生效),响应片段:

```json
{"app_type":"container","desktop":true,"icon":"/icon.svg","image":"todo-widget:latest","index":"/","is_uncontrolled":false,"name":"todo-widget","port":"18001","scheme":"http","status":"running","title":{"en_us":"Todo List"},"widget":{"h":4,"maxh":4,"maxw":4,"minh":4,"minw":4,"path":"/widget/","w":4}}
```

**结论**: Task 2 完成,无 concerns。main 已含全部桌面识别功能并已在真机部署运行。

## Task 3 curl 实录

### Step 1: 只读端点测试

#### `/categories`
**请求**: `curl -s http://localhost/v2/app_management/categories`

**响应前 600 字节**:
```json
{"data":[{"count":403,"description":"All apps","font":"apps","id":0,"name":"All"},{"count":39,"description":"AI Apps","font":"chat-processing-outline","id":1,"name":"AI"},{"count":0,"description":"","font":"bigbear","id":2,"name":"BigBearCasaOS"},{"count":56,"description":"Developer Apps","font":"code-greater-than-or-equal","id":3,"name":"Developer"},{"count":9,"description":"Finance Apps","font":"currency-usd","id":4,"name":"Finance"},{"count":15,"description":"Home Apps","font":"home-automation","id":5,"name":"Home"},{"count":82,"description":"Media Apps","font":"play-circle-outline","id":6,
```

**结构结论**: `{"data": [...]}` - 无 `success` 字段,数据为分类数组(含 id/name/count/description/font)

**HTTP 状态**: 200 ✓

#### `/apps`
**请求**: `curl -s http://localhost/v2/app_management/apps`

**响应前 1000 字节**:
```json
{"data":{"installed":["actualbudget","arize-phoenix"],"list":{"2fauth":{"apps":{"2fauth":{"devices":null,"envs":null,"image":"2fauth/2fauth:6.1.3","ports":[{"container":"8000","description":{"en_US":""}}],"volumes":[{"container":"/2fauth","description":{"en_US":""}}]}},"architectures":["amd64","386","arm64","arm"],"author":"CasaOS Team","category":"Productivity","description":{"ar_SA":"2FAuth هو بديل مستضاف لنفسه لمولدات رمز واحد (OTP) مثل Google Authenticator ، مصممة للجوال وسطح المكتب.","de_DE":"2FAuth ist eine webbasierte selbst gehostete Alternative zu One Time Passcode (OTP) Generatoren wie Google Authenticator, die für mobile und Desktop-Geräte entwickelt wurde.","en_US":"2FAuth is a web based self-hosted alternative to One Time Passcode (OTP) generators like Google Authenticator, designed for both mobile and desktop.","es_ES":"2FAuth es una alternativa autohospedada basada en web a los generadores de códigos de un solo uso (OTP) como Google Authenticator, diseñada para móviles y escritorio.","fr_FR":"2FAuth est une alternative auto-hébergée basée sur le web aux générateurs de codes à usage unique (OTP) tels q
```

**结构结论**: `{"data": {"installed": ["actualbudget", "arize-phoenix"], "list": {id → app_info}}}` - 包含已安装列表 + 完整应用目录映射,符合预期 ✓

**HTTP 状态**: 200 ✓

#### `/apps?category=Media`
**请求**: `curl -s http://localhost/v2/app_management/apps?category=Media`

**响应前 400 字节**:
```json
{"data":{"installed":["actualbudget","arize-phoenix"],"list":{"audiobookshelf":{"apps":{"audiobookshelf":{"devices":null,"envs":null,"image":"ghcr.io/advplyr/audiobookshelf:2.35.0","ports":[{"container":"80","description":{"de_DE":"WebUI HTTP Port","el_GR":"Θύρα HTTP WebUI","en_GB":"WebUI HTTP Port","en_US":"WebUI HTTP Port","fr_FR":"Port HTTP WebUI","hr_HR":"WebUI HTTP port","it_IT":"Porta HT
```

**结构结论**: 同 `/apps`,但 `list` 仅含指定分类应用(AudioBookShelf 等)

**HTTP 状态**: 200 ✓

#### `/apps/upgradable`
**请求**: `curl -s http://localhost/v2/app_management/apps/upgradable`

**响应**: `{"data":[]}`

**结构结论**: `{"data": []}` - 空数组,当前无可升级应用

**HTTP 状态**: 200 ✓

#### `/compose`
**请求**: `curl -s http://localhost/v2/app_management/compose`

**响应前 1000 字节**:
```json
{"data":{"actualbudget":{"compose":{"name":"actualbudget","networks":{"default":{"name":"actualbudget_default","ipam":{},"external":false}},"services":{"actualbudget":{"command":null,"container_name":"actualbudget","deploy":{"resources":{"reservations":{"memory":"134217728"}},"placement":{}},"entrypoint":null,"image":"actualbudget/actual-server:26.5.2","labels":{"icon":"https://cdn.jsdelivr.net/gh/IceWhaleTech/CasaOS-AppStore@main/Apps/ActualBudget/icon.svg"},"networks":{"default":null},"ports":[{"target":5006,"published":"15006","protocol":"tcp"}],"restart":"unless-stopped","volumes":[{"type":"bind","source":"/DATA/AppData/actualbudget","target":"/data"}]}},"x-casaos":{"app_id":"org.icewhale.actualbudget","architectures":["amd64","arm64"],"author":"CasaOS Team","category":"Finance","description":{"de_DE":"Actual Budget ist eine schnelle, datenschutzorientierte Finanzmanagement-App, die Local-First-Umschlag-Budgetierung verwendet und vollständige Kontrolle über Daten gewährleistet. Die intuitive Benutzeroberfläche unterstützt Offline-Nutzung mit Mehrgeräte-Synchronisation und optionaler Ende-zu-Ende-Verschlüsselung und bietet eine sichere, effiziente Finanzmanagement-Erfahru
```

**结构结论**: `{"data": {app_name → {compose: {...}, x-casaos: {...}}}}` - **`name → app` 映射**,其中每个 app 包含完整 compose 与 x-casaos 元数据

**HTTP 状态**: 200 ✓

#### `/appstore`
**请求**: `curl -s http://localhost/v2/app_management/appstore`

**响应前 600 字节**:
```json
{"data":[{"id":0,"store_root":"/var/lib/nimoos/appstore/cdn.jsdelivr.net/8b38a056ac152e214b04276d9051b44e/build/sysroot/var/lib/casaos/appstore/default.new","url":"https://cdn.jsdelivr.net/gh/IceWhaleTech/CasaOS-AppStore@gh-pages/store/main.zip"},{"id":1,"store_root":"/var/lib/nimoos/appstore/github.com/2a1238d53212bfce4e8f861dcb8ef3fe/big-bear-casaos-master","url":"https://github.com/bigbeartechworld/big-bear-casaos/archive/refs/heads/master.zip"}]}
```

**结构结论**: `{"data": [{id, store_root, url}, ...]}` - 应用商店配置数组(CDN + 本地路径)

**HTTP 状态**: 200 ✓

---

### Step 2: 详情与 compose 原文(使用真实 app_id: `2fauth`)

#### `/apps/2fauth`(JSON 详情)
**请求**: `curl -s http://localhost/v2/app_management/apps/2fauth`

**响应前 700 字节**:
```json
{"data":{"apps":{"2fauth":{"devices":null,"envs":null,"image":"2fauth/2fauth:6.1.3","ports":[{"container":"8000","description":{"en_US":""}}],"volumes":[{"container":"/2fauth","description":{"en_US":""}}]}},"architectures":["amd64","386","arm64","arm"],"author":"CasaOS Team","category":"Productivity","description":{"ar_SA":"2FAuth هو بديل مستضاف لنفسه لمولدات رمز واحد (OTP) مثل Google Authenticator ، مصممة للجوال وسطح المكتب.","de_DE":"2FAuth ist eine webbasierte selbst gehostete Alternative zu One Time Passcode (OTP) Generatoren wie Google Authenticator, die für mobile und Desktop-Geräte entwickelt wurde.","en_US":"2FAuth is a web ba
```

**结构结论**: `{"data": {...app_details...}}` - 包含 apps/architectures/author/category/description(多语言)等元数据

**HTTP 状态**: 200 ✓

#### `/apps/2fauth/compose`(带 Accept: application/yaml)
**请求**: `curl -s -H 'Accept: application/yaml' http://localhost/v2/app_management/apps/2fauth/compose`

**响应前 400 字节(裸 YAML)**:
```yaml
name: 2fauth
services:
    2fauth:
        container_name: 2fauth
        deploy:
            resources:
                reservations:
                    memory: "67108864"
        environment:
            APP_KEY: SomeRandomStringOf32CharsExactly
        image: 2fauth/2fauth:6.1.3
        labels:
            icon: https://cdn.jsdelivr.net/gh/IceWhaleTech/CasaOS-AppStore@main/Apps/2FAuth/icon.svg
```

**结构结论**: **返回裸 YAML 文本** (非 JSON 包装),Accept header 生效 ✓

**HTTP 状态**: 200 ✓

#### `/apps/2fauth/compose`(无 Accept header,JSON 模式)
**请求**: `curl -s http://localhost/v2/app_management/apps/2fauth/compose`

**响应前 400 字节**:
```json
{"data":{"compose":{"name":"2fauth","networks":{"default":{"name":"2fauth_default","ipam":{},"external":false}},"services":{"2fauth":{"command":null,"container_name":"2fauth","deploy":{"resources":{"reservations":{"memory":"67108864"}},"placement":{}},"entrypoint":null,"environment":{"APP_KEY":"SomeRandomStringOf32CharsExactly"},"image":"2fauth/2fauth:6.1.3","labels":{"icon":"https://cdn.jsdelivr.
```

**结构结论**: 默认返回 JSON `{"data": {"compose": {...}}}`

**HTTP 状态**: 200 ✓

---

### Step 3: dry_run 安装实证

#### dry_run with VALID YAML
**请求**: 
```bash
curl -s -X POST http://localhost/v2/app_management/compose?dry_run=true&check_port_conflict=false \
  -H 'Content-Type: application/yaml' \
  --data-binary "$(curl -s -H 'Accept: application/yaml' http://localhost/v2/app_management/apps/2fauth/compose)"
```

**响应**:
```json
{"message":"only validation has been done because `dry_run` is specified - skipping compose app installation"}
```

**结构结论**: **仅 `message` 字段,无 `data` 字段** - 与其他端点信封**不一致**

**HTTP 状态**: 200 ✓

#### dry_run with INVALID YAML (foo: [)
**请求**: 
```bash
curl -s -X POST http://localhost/v2/app_management/compose?dry_run=true&check_port_conflict=false \
  -H 'Content-Type: application/yaml' \
  --data-binary "foo: ["
```

**响应**:
```json
{"message":"request body has an error: failed to decode request body: yaml: line 1: did not find expected node content"}
```

**结构结论**: **仅 `message` 字段,无 `data` 字段** - 同样**不一致**

**HTTP 状态**: 400 ✓

---

### 汇总: 信封结构分析

| 端点 | 信封字段 | 有无 `success` | data 结构 |
|-----|--------|--------------|---------|
| `/categories` | `data` | 否 ✓ | `[]` 分类数组 |
| `/apps` | `data` | 否 ✓ | `{installed: [], list: {id → info}}` ✓ |
| `/apps?category=X` | `data` | 否 ✓ | 同上(过滤) |
| `/apps/upgradable` | `data` | 否 ✓ | `[]` 空数组 |
| `/compose` | `data` | 否 ✓ | `{name → app}` ✓ |
| `/appstore` | `data` | 否 ✓ | `[]` 配置数组 |
| `/apps/{id}` | `data` | 否 ✓ | app 详情对象 |
| `/apps/{id}/compose`(Accept: yaml) | N/A | N/A | 裸 YAML ✓ |
| `/apps/{id}/compose`(默认 JSON) | `data` | 否 ✓ | `{compose: {...}}` |
| **`/compose` dry_run 成功** | **仅 `message`** | **无** | **❌ 无 `data` 字段** |
| **`/compose` dry_run 失败** | **仅 `message`** | **无** | **❌ 无 `data` 字段** |

### 与 OpenAPI 预期的不符处

**❌ Issue 1**: `/compose` POST (dry_run) 响应格式异常
- **预期**: `{"data": ..., "message": "..."}` 或至少包含标准信封
- **实际**: 仅 `{"message": "..."}`,无 `data` 字段,无 HTTP 状态嵌入
- **影响**: Task 4-6 解包逻辑需适配此异常格式

---
Task 1: complete(无漂移,应用区上游干净)
Task 2: complete(main 788ff96→1a6927d FF,测试零新增失败,部署 g1a6927d 冒烟通过)

**Task 3 补充实证(控制器复核)**:/compose 条目顶层键 = compose/is_uncontrolled/status/store_info/update_available(store_info 存在,x-casaos 在 compose 内部)——ComposeAppWithStoreInfo 类型与实机一致。
Task 3: complete(六问全实证;dry_run 响应仅 {message} 无 data,install 忽略响应体无碍)
Task 4: complete(commit 5c96703,3/3+全量 88 零回归,review Spec✅/Approved)
Task 5: complete(commit e010f54,6/6+全量 94 零回归,review Spec✅/Approved;⚠️title 已实机核实存在,注意 v2 商店 title 语言键是大写 en_US)
Task 6: complete(commit 0c70d3d,7/7+全量 101 零回归,review Spec✅/Approved)
  Minor 记账(供终审 triage):①list() 的 'message' in data 形状启发式,app id 恰叫 message 会误判(概率极低);②task-6-report 方法表漏列 containers/healthcheck(纯文档);③dry_run 失败路径无单测(P3 消费端补);④get() data 缺失返回 undefined,P1 消费端判空

## Task 7 index 装配 + 全量验证 + New-UI 消费方回归 + 记账

### Step 1: index.ts 装配
`src/index.ts` 追加 `createAppstore`/`createCompose` import(`.js` 后缀保留)+ 类型导出(`AppCategory, StoreAppInfo, StoreAppCatalog, UpgradableAppInfo, AppStoreSource, ComposeAppWithStoreInfo`)+ `service.appstore`/`service.compose` getter(照既有惰性模式)。

### Step 2: 共享包全量验证(NimoOS-Service)
- `pnpm vitest run` → **101/101 通过**(21 测试文件,零回归,与 Task 6 记录一致)
- `pnpm exec tsc --noEmit` → **零错误**
- `pnpm build` → 成功,`dist/appstore.js`/`dist/compose.js`/`dist/index.js` 均已生成且 `index.js` 正确 import/装配两域(`dist/` 已 gitignore,不进版本控制)

### Step 3: New-UI 消费方回归
- `pnpm install`(重同步 `file:../NimoOS-Service` 本地包快照)→ `pnpm-lock.yaml` **sha256 安装前后一致**,**无变动**
- `pnpm vitest run` → **807/807 通过**(171 测试文件,零回归)
- `pnpm exec vue-tsc --noEmit` → **零错误**
- P0 全程未动 New-UI 源码,纯确认包升级无破坏 ✓

### Step 4/5: Commit
- NimoOS-Service `sp3-shared-http`@**115e4ea**(`feat(index): 装配 appstore/compose 域并导出 SP5 类型`,仅 `src/index.ts`)
- NimoOS-UI `docs/vue3-migration-sp3`@**c52c56a**(`docs(roadmap): SP5-P0 完成记账`,仅 `docs/vue3-migration-roadmap.md` 一个文件——该仓工作区其余未提交改动未动)

### 全部 commit hash 汇总(SP5-P0 全程)
| 仓 | 分支 | commit | 内容 |
|---|---|---|---|
| NimoOS-AppManagement | main | **1a6927d** | 前置合并 `feat/desktop-label-recognition`(FF,桌面识别功能) |
| NimoOS-Service | sp3-shared-http | **5c96703** | `v2Data` 解包器(Task 4) |
| NimoOS-Service | sp3-shared-http | **e010f54** | `appstore` 域,8 方法(Task 5) |
| NimoOS-Service | sp3-shared-http | **0c70d3d** | `compose` 域,10 方法(Task 6) |
| NimoOS-Service | sp3-shared-http | **115e4ea** | index 装配(Task 7) |
| NimoOS-UI | docs/vue3-migration-sp3 | **c52c56a** | roadmap 记账(Task 7) |

均只提交本地分支,未 push 远端。

### Task 3 实录差异汇总
Task 3 curl 实证阶段发现的唯一实录差异已在上文完整记录:**`/compose` dry_run(成功与失败两态)响应信封仅含 `{"message": ...}`,无 `data` 字段**,与其余端点统一的 `{"data": ...}` 信封不一致(详见上方"与 OpenAPI 预期的不符处 → Issue 1")。此差异已在 Task 6 `compose` 域实现中承接适配(install 方法不依赖 dry_run 的 data 字段)。**Task 7(index 装配 + 全量验证 + New-UI 回归)未发现任何新增实录差异**——全程行为与 Task 4-6 交付的接口签名/行为完全一致,零意外。

### P1 待办提醒
P0 本轮**只完成了共享包域装配**(`appstore`/`compose` 可从 `@nimotech/nimoos-service` 直接 import),**未接入任何 New-UI 页面/UI 代码**。P1 起开工前需先出一份 P1 计划,明确:
1. **页壳**——应用列表/应用商店浏览页在 New-UI 的路由挂载点、`FilesShell` 同款的回主页壳如何复用。
2. **已装应用管理页**——`compose` 域的装/卸/更/设/启停/日志/健康检查方法如何映射到具体交互(参照 Vue2 `container`/`apps` 现有页面对等)。
3. 遗留 Minor(Task 6 记账)在消费端落地时需处理:`list()` 的 `'message' in data` 启发式误判风险、`get()` data 缺失返回 `undefined` 的判空、dry_run 失败路径消费端单测补齐。

Task 7: complete(commit 115e4ea/c52c56a,共享包全量 101/101+tsc 0+build 绿,New-UI 回归 807/807+vue-tsc 0,lockfile 无变动,零 concerns)

**SP5-P0 全程收尾:Task 1-7 全部 complete,无 BLOCKED 项。**
Task 7: complete(Service 115e4ea + docs c52c56a,review Spec✅/Approved;控制器独立重跑 101/101+tsc0 消⚠️)

## 终审与关账
- 终审(opus)= Ready to merge,3 findings(convert 追溯/单体返回类型诚实化/list 启发式)已修:Service e8df69d(104/104+tsc0)、spec 追溯 NimoOS-UI 573da2b2;复核全 ✅。
- P0 最终坐标:AppManagement main@1a6927d(feat 分支已并,保留未删)· Service sp3-shared-http@e8df69d(5 commits:5c96703/e010f54/0c70d3d/115e4ea/e8df69d)· NimoOS-UI docs@573da2b2 · New-UI 零代码改动(807/807 回归绿)。
- P1 待办提醒:出 P1 计划(AreaShell 抽取 + /apps 路由 + 已装管理);消费端注意 get()/getApp() 返回 | undefined 必须判空;v2 商店 title 语言键大写 en_US。
P0: CLOSED(2026-07-20)
收尾(finishing-a-development-branch):最终 HEAD 复跑 104/104+tsc+build 全绿;AppManagement feat/desktop-label-recognition 分支已安全删除(-d,与 main 同点);无 worktree,三仓工作区干净;全部仅本地分支未推远端(用户自推)。
