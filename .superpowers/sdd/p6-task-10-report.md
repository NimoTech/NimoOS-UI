# SP8-P6 · Task 10 报告 —— 终审修复波 + 两份验收清单 + 双侧部署

**日期** 2026-08-06
**交付坐标**
| 仓 | 分支 | 本刀起 → 止 |
|---|---|---|
| NEW-UI `/home/nimo/NimoTech/NimoOS-New-UI` | `master` | `a102311` → **`c968fab`**(+ 本报告与清单的提交,见文末) |
| VUE2 `/home/nimo/NimoTech/NimoOS-UI` | `docs/vue3-migration-sp3` | `5278dec6` → **`9b86d3ee`**(+ 记账提交) |
| SERVICE `/home/nimo/NimoTech/NimoOS-Service` | `master` | `ac39cd7` → **`ac39cd7`**(本刀零改动) |

⛔ **未推 origin · `.sp8` worktree 未撤 · `NimoOS-Web` 未碰。**

> 📌 起点坐标与 brief 略有出入,已核实无碍:brief 记 VUE2 在 `6ff26538`,实际 HEAD 是 `5278dec6`
> (SP9 线在 08-06 追加的一条 roadmap 回填提交,`docs/vue3-migration-roadmap.md`)。同仓另有 6 个
> `docs/vue3-pending/*.md` 未提交改动,属**别的线**,本刀全程用 pathspec 提交、一个字节都没碰。

---

## 1. 终审修复波 —— 逐条

### M4 · `strangler.js:28` 注释路由数错(VUE2)

**改前**
```
// SP8-P6:AI 区。Vue2 侧有 8 条 /ai/* 路由(agent / settings / parser / parser/test /
// knowledge 及其 7 个子路由,外加 /ai/skills、/ai/mcp 两条 redirect),New-UI 侧是它的
```
**改后**
```
// SP8-P6:AI 区。Vue2 侧有 11 条真实 /ai/* 路由(agent / settings / parser / parser/test /
// knowledge 及其 7 个子路由 —— 子路由含 path:'' 那条,它就是 /ai/knowledge 本身,
// 故 4 + 7 = 11),外加 /ai/skills、/ai/mcp 两条 redirect,route.js 里共 13 条记录。
// (T6 minor / T10-M4 订正:原文写「8 条」是计划稿的笔误,枚举本身是对的。)New-UI 侧是它的
```

**自己复算过,不是照抄 brief**(`NimoOS-UI/src/router/route.js`):
`/ai/agent`(:147)· `/ai/settings`(:157)· `/ai/parser`(:167)· `/ai/parser/test`(:177)= 4 条独立页面;
`/ai/knowledge`(:187)带 **7 个 children**(`''`/`search`/`indexed-files`/`queue`/`roots`/`allowlist`/`settings`),
其中 `path: ''` 就是 `/ai/knowledge` 本身 ⇒ **4 + 7 = 11 条真实可达路由**;
`/ai/skills`(:215)、`/ai/mcp`(:219)两条 redirect ⇒ **route.js 里共 13 条记录**。

### M5 · 自相矛盾/已过时的 `@types/node` 注释(NEW-UI,**8 个文件**)

brief 点名 5 个「自相矛盾」的文件。落地时**沿同一条 grep 又找到 3 个同类**(措辞不同、错法一致),一并修掉:

| # | 文件 | 原文病症 |
|---|---|---|
| 1 | `src/ai/styles/knowledgeStyles.test.ts:6` | 自相矛盾:「**已装** @types/node —— 没有类型声明,会报 TS2307,逐行 @ts-expect-error 抑制」 |
| 2 | `src/ai/styles/parserStyles.test.ts:14` | 同上 |
| 3 | `src/ai/knowledge/views/QueueView.test.ts:34` | 同上 |
| 4 | `src/ai/knowledge/views/IndexedFilesView.test.ts:51` | 同上 |
| 5 | `src/ai/knowledge/views/NotesView.test.ts:34` | 同上 |
| **6** | `src/ai/knowledge/util/wikiViewHelpers.test.ts:22` | **本刀追加**:「本仓**未装** `@types/node`」—— 合流后不成立 |
| **7** | `src/ai/knowledge/views/WikiView.test.ts:34` | **本刀追加**:同上 |
| **8** | `src/ai/styles/settingsStyles.test.ts:5-19` | **本刀追加**:P2a 时期的历史叙事,「未装 @types/node」「color-guard 的 `?raw` 对 .css 空转」两条都已不成立 |

另修 `QueueView.test.ts:894` 一处二次引用(「`__ts-expect-error` 抑制」)。

**根因**:合流时把 `sp8-ai` 分支上那些 `node:` 导入的逐行 `@ts-expect-error` **删掉了**,注释没跟着改。
**现测佐证**:`/usr/bin/grep -rn "@ts-expect-error" src/ai/` 全仓只剩 **1 条真指令**,
在 `src/ai/services/openInApp.test.ts:50`(故意用非字符串触发运行时 typeof 守卫),与 `node:` 导入无关。

**顺带查清的一处技术细节(写进了 `settingsStyles.test.ts` 的订正段)**:
`tsconfig.json` 的 `"types": ["vite/client","vitest/globals"]` 只管**全局类型的自动引入**;
`node:fs` 这类**显式模块导入**照样解析得到 `@types/node` 的模块声明 ⇒ `vue-tsc` 直接通过。
反过来,全局 `process` 仍然没有类型 —— 所以 `knowledge/views/DashboardView.test.ts:583-585`
那处「没有 `@types/node`,故经 `globalThis` 窄化访问 `process`」的注释**依然成立,没有改它**。
(这是本刀唯一一处「看着像同类、实测不是」的地方,特此留痕。)

### M6 · spec 行为矩阵漏 `sendToAI` 第 4 个调用点(VUE2 spec)

`docs/superpowers/specs/2026-08-06-vue3-migration-sp8-p6-cutover-design.md` §4 补一行 +
一段说明。**现测**(`/usr/bin/grep -rn "sendToAI" src --include=*.vue --include=*.ts | /usr/bin/grep -v '\.test\.'`):

```
src/home/components/widgets/AiWidget.vue:22    const { sendToAI } = useOpenAction()
src/home/components/widgets/AiWidget.vue:31      sendToAI(msg)
src/home/components/SearchDialog.vue:69        const { sendToAI } = useOpenAction()
src/home/components/SearchDialog.vue:242         sendToAI(q)
src/home/composables/useOpenAction.ts:78       function sendToAI(text?: string) {
src/home/composables/useOpenAction.ts:90       return { openApp, openItem, sendToAI }
```

**代码本身没问题**(自读源文件复证):`askNimoAi()` 先 `homeUi.closeSearch()` 再 `sendToAI(q)`;
`SearchDialog` 只挂在 `Home.vue` 里,flag 清时 `router.push` 会把 Home 整个卸载(浮层不可能残留),
flag 置 1 时是整页 `location.href` 跳走。⇒ 补的是**矩阵与验收覆盖**,不是代码。
验收清单已给它两条:**A-9**(flag 清)/ **B-6**(flag 置 1)。

### 台账三处订正(已落 `VUE2/docs/vue3-migration-roadmap.md` §SP8 债务台账)

1. **「`?raw` 全仓性空转」这条债 → 关闭。** 原措辞「其它守卫可能同样在空转,尚未排查」是错的,照它 triage 会漏掉真正的缺口。
   现测:全仓 `?raw` 只剩 3 处 `.vue`,读 `.css`/`.scss` 的守卫已全部改 `node:fs`
   (`color-guard.test.ts` 在 SP9-P0 改的、`AppToast.zIndex.test.ts` 在本期 T3 改的)。
2. **T8-D3 第 ③ 条 → 订正措辞。** 原记「`packages/service/src/*.test.ts` 发布出去却在检查范围外」过宽。
   实测那些文件**运行时确实被 root vitest 跑到**(产物树 371 文件 / 3581 例里含内嵌 service 的 206 例),
   **盲区只在 `vue-tsc` 的类型检查侧**。
3. **`NimoOS-Web` 的 ` M README.md` → 风险降级。** 本刀独立复证(只读,没碰那个仓):
   ```
   $ cd /home/nimo/NimoTech/NimoOS-Web && git log --oneline -1
   748aa8f NimoOS Web UI
   $ git status --short
    M README.md
   $ diff NimoOS-Web/README.md NimoOS-New-UI/oss/files/README.md
   (无输出 —— 逐字节相同)
   ```
   ⇒ 它就是导出本该产出的那份新 README(部署文档扩写),内容干净。
   从「push 前必须由人看一眼(未知风险)」降为「push 前确认就是这份即可」。

### 新立债务 I3(只立票不修)—— 已落 roadmap 债务台账

`src/styles/color-guard.test.ts:24` 的 `listCss()` **只收 `.css`**(`.vue` 走 glob),**没有 `.scss` 分支**。
合流前 master 的 `.scss` 数量是 **0**,遗漏一直无害;**合流后是 9 个、7127 行**,永久落在
CLAUDE.md「颜色一律走 token」硬约束的守卫之外。

**本刀把 color-guard 的原样逻辑(`stripVar` + `HEX`/`FUNC`,逐行、不剥注释)真跑了一遍**,合计 **422 行命中**:

```
src/ai/styles/agent-styles.scss      lines= 1332  hex/func=  77   ← 文件第1行有显式豁免声明
src/ai/styles/knowledge.scss         lines= 3504  hex/func= 129   ← 有专属守卫 knowledgeStyles.test.ts
src/ai/styles/mcp-styles.scss        lines=  140  hex/func=   0
src/ai/styles/parser-styles.scss     lines=  296  hex/func=   0
src/ai/styles/popover.scss           lines=  147  hex/func=   0
src/ai/styles/settings-styles.scss   lines=  384  hex/func=  24   ← 有专属守卫 settingsStyles.test.ts
src/ai/styles/sk-shared.scss         lines=  189  hex/func=   4   ← 🔴 无豁免头、无专属守卫
src/ai/styles/skills-styles.scss     lines=  759  hex/func=   1   ← 🔴 无豁免头、无专属守卫
src/ai/styles/tokens.scss            lines=  385  hex/func= 187   ← token 定义档,本就该有字面色
TOTAL lines-with-hex/func = 422   named-value = 12
```

🔴 **逐行核过之后,真实敞口比 brief 给的小,已在台账里写成核实后的口径**:
- `skills-styles.scss` 那 1 行(`:518`)**在注释里**,不是真违规 ⇒ 该文件实际 **0 处**。
- `sk-shared.scss` 4 行里 `:62` 也是注释,真违规是 **3 行**:`:41` `rgba(0,122,255,0.22)` ·
  `:53` `background:#e6342a` · `:98` `rgba(15,20,30,0.32)`;另有 **2 处具名色 `color: white`**
  (`:40`/`:52`,而 color-guard 本来就不认具名色,属票 B 范畴)。

⇒ **今天的实际违规面很小(1 个文件 3+2 处),但守卫缺口是永久的。**
修它需要配套豁免机制(不是加一行 glob):至少要能表达「token 定义档整档豁免」「已有专属守卫的档不重复报」
「文件头显式豁免声明」三种情形,否则加上去当天就是 422 行红。**故立票不修**,与 P5f 的**票 B** 合并处理。

---

## 2. 三仓门 —— 实际输出尾部(原文)

### NEW-UI · `pnpm exec vitest run --reporter=verbose`

```
 Test Files  3 failed | 599 passed (602)
      Tests  1 failed | 9856 passed | 70 skipped (9927)
   Start at  18:03:25
   Duration  164.39s (transform 38.04s, setup 109.91s, import 153.02s, tests 226.90s, environment 227.08s)
```

3 个失败文件**全在 `oss/`**,全部是**工作树不干净**导致(T3 已登记的陷阱:`export.mjs` 的
「工作树不干净」守卫跑在锚点检查之前并 abort):

```
 FAIL  oss/media-wave.test.mjs [ oss/media-wave.test.mjs ]
 FAIL  oss/tree.test.mjs [ oss/tree.test.mjs ]
 FAIL  oss/export-rsync.test.mjs > 导出落盘:node_modules 保留、dist 照常清空 > ...

Serialized Error: { status: 1, ... stderr: '[oss] 失败:/home/nimo/NimoTech/NimoOS-New-UI 工作树不干净,导出中止:\n
 M src/ai/knowledge/util/wikiViewHelpers.test.ts\n M src/ai/knowledge/views/IndexedFilesView.test.ts\n ...' }
```

**提交后复跑 oss 套件的结果见 §2.5。**

### NEW-UI · `pnpm exec vue-tsc --noEmit`

```
VUE_TSC_EXIT=0
```
(零输出、exit 0 —— 同时也是 M5 那句「已装 `@types/node`、vue-tsc 直接通过、不需要 `@ts-expect-error`」的直接证据。)

### NEW-UI · `pnpm build`(随 `./scripts/deploy.sh` 跑)

```
dist/assets/index-Cb8zDTF-.js                7,316.40 kB │ gzip: 2,051.15 kB
(!) Some chunks are larger than 500 kB after minification. Consider: ...
✓ built in 16.86s
Deployed to /var/lib/nimoos/www/app/  →  http://<host>/app/#/
DEPLOY_EXIT=0
```

### SERVICE · `pnpm exec vitest run --reporter=verbose`

```
 ✓ src/unwrap.test.ts > unwrap > throws with server message and code on non-200 0ms
 ✓ src/index.integration.test.ts > service wiring (SP4-P0) > file/batch/folder/storage domains resolve after initService 2ms

 Test Files  37 passed (37)
      Tests  377 passed (377)
   Start at  18:33:50
   Duration  1.37s (transform 765ms, setup 0ms, import 1.48s, tests 343ms, environment 3ms)
```

### VUE2 · `pnpm exec vitest run --reporter=verbose`

```
- Expected
+ Received

  {
    "agent": false,
    "ollama": false,
+   "openvino": false,
  }

 ❯ tests/settingsStore.test.js:304:34

 Test Files  2 failed | 157 passed (159)
      Tests  8 failed | 1477 passed (1485)
   Start at  18:03:29
   Duration  46.85s (transform 16.43s, setup 42.89s, import 27.17s, tests 15.11s, environment 94.45s)
```

✅ **失败集合 = `{tests/nimoTaskBar.test.js, tests/settingsStore.test.js}`,与 T0/T6 基线逐文件相同,零新增。**
文件数 159 / 用例数 1485 也与 T6 收官时的实测一致。

### 2.5 · oss 套件复跑(提交后、工作树干净)

见文末「提交后复验」一节。

---

## 3. 部署 —— 命令与输出

### 3.1 New-UI(先)

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && ./scripts/deploy.sh
```
输出尾部见 §2「pnpm build」那段,`DEPLOY_EXIT=0`。
脚本内容核过:`pnpm build` → `rsync -a --delete --filter='protect assets/*' dist/ /var/lib/nimoos/www/app/`
→ 清理 14 天前的旧 chunk。(`protect assets/*` 是 SP4 那条「旧标签页懒加载 chunk 404」的防线,保留旧哈希。)

### 3.2 Vue2(后)

```bash
cd /home/nimo/NimoTech && nimo_os_docs/scripts/deploy-ui.sh
```
```
  Build at: 2026-08-06T10:16:31.559Z - Hash: ef7d8580473ab373 - Time: 26939ms

 DONE  Build complete. The build/sysroot/var/lib/nimoos/www directory is ready to be deployed.
 INFO  Check out deployment instructions at https://cli.vuejs.org/guide/deployment.html

==> [2/2] 部署到 /var/lib/nimoos/www ...

完成! 前端已部署到 /var/lib/nimoos/www
DEPLOY_EXIT=0
```
脚本 `:31` 核过:`sudo rsync -a --delete --exclude 'app/' "$BUILD_OUT/" "$DEPLOY_TARGET/"`,
无 rsync 时的兜底分支也 `! -name 'app'` ⇒ **不会抹掉 `/app/`**,与终审结论一致。

---

## 4. 部署后自证 —— 三条命令的真实输出

🔴 **brief 给的三条命令有两条会给出误导性结果,已在下面同时给出原命令输出与修正命令输出。**

### [1] `/usr/bin/grep -rl "app/#/ai" /var/lib/nimoos/www/*.js | head`

```
/var/lib/nimoos/www/app.aeede38b.js
```
✅ 命中。**Vue2 的 bundle 确实在 `www` 根目录、不在 `www/js/`**(SP9-P8 就是在这里找错目录)。

### [2] `/usr/bin/grep -rl "strangler:disabled:/ai" /var/lib/nimoos/www/*.js | head`

```
(无输出)
```
⚠️ **这条命令查不到是正常的,不是部署失败。** `strangler.js` 里的 flag 键是**模板串**:
```js
function flagKey(from) { return `strangler:disabled:${from}` }
```
字面串 `strangler:disabled:/ai` 在产物里根本不存在。**正确的查法是分两半查**:

```
$ /usr/bin/grep -rl "strangler:disabled:" /var/lib/nimoos/www/*.js
/var/lib/nimoos/www/app.aeede38b.js
/var/lib/nimoos/www/src_components_common_KIcon_vue-src_views_Home_vue.ed2e77e1.js
/var/lib/nimoos/www/src_components_filebrowser_FilePanel_vue.b20dfe94.js

$ /usr/bin/grep -o '/app/#/[a-z]*' /var/lib/nimoos/www/app.aeede38b.js | sort | uniq -c
      3 /app/#/
      1 /app/#/ai        ← 本期新增
      1 /app/#/files
      1 /app/#/kvm
      1 /app/#/photos
      1 /app/#/settings
      1 /app/#/storage

$ /usr/bin/grep -o '.\{60\}strangler:disabled:.\{40\}' /var/lib/nimoos/www/app.aeede38b.js | head -2
...\n  enabled: true\n}];\nfunction flagKey(from) {\n  return `strangler:disabled:${from}`;\n}\nfunction resolveStorage(st
```
✅ 六条 `migratedRoutes` 目标 + `flagKey` 模板都在产物里。

**顺带证明「部署的确实是我这一版」**(M4 的新注释出现在产物里):
```
$ /usr/bin/grep -c "11 条真实 /ai/\* 路由" /var/lib/nimoos/www/app.aeede38b.js
1
$ /usr/bin/grep -o "SP8-P6:AI 区。.\{0,120\}" /var/lib/nimoos/www/app.aeede38b.js
SP8-P6:AI 区。Vue2 侧有 11 条真实 /ai/* 路由(agent / settings / parser / parser/test /\n// knowledge 及其 7 个子路由 ——
```

### [3] `curl -sI http://127.0.0.1/app/ | head -3`

```
HTTP/1.1 405 Method Not Allowed
Access-Control-Allow-Headers: Content-Type, Authorization, ...
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD
```
⚠️ **405 不是部署失败,是 `curl -sI` 发的 HEAD 请求被网关拒了。** 换 GET:

```
$ curl -s -o /dev/null -w "HTTP %{http_code}  bytes=%{size_download}  type=%{content_type}\n" http://127.0.0.1/app/
HTTP 200  bytes=763  type=text/html; charset=utf-8

$ curl -s -o /dev/null -w "HTTP %{http_code}  bytes=%{size_download}\n" http://127.0.0.1/
HTTP 200  bytes=1174

$ curl -s -o /dev/null -w "HTTP %{http_code}  bytes=%{size_download}\n" http://127.0.0.1/app.aeede38b.js
HTTP 200  bytes=2695262
```
✅ `/app/`(New-UI)、`/`(Vue2)、Vue2 主 bundle 三者全部 200。

### [4] New-UI 侧产物也带着 cutover 代码(brief 没要求,补一条)

```
$ /usr/bin/grep -o 'assets/index-[A-Za-z0-9_-]*\.js' /var/lib/nimoos/www/app/index.html | head -1
assets/index-Cb8zDTF-.js
$ /usr/bin/grep -c "strangler:disabled:" /var/lib/nimoos/www/app/assets/index-Cb8zDTF-.js
1
```
✅ 当前 `index.html` 指向的入口 chunk 里有 `cutoverDisabled` 的 flag 键。
(`assets/` 下还有一堆旧哈希 chunk,是 `protect assets/*` 刻意保留的历史版本,不是垃圾。)

---

## 5. 两份验收清单

| 清单 | 路径 | 说明 |
|---|---|---|
| **① P6 自己的(本刀新写)** | `/home/nimo/NimoTech/NimoOS-New-UI/.superpowers/sdd/p6-acceptance-checklist.md` | A cutover 正向(13 条)/ B 回退可逆(9 条)/ C 没碰坏别人(11 条) |
| **② P5f 遗留** | `/home/nimo/NimoTech/NimoOS-New-UI/.superpowers/sdd/p5f-acceptance-checklist.md` | 原样交付,只改了端口 |
| **③ SP8-FULL 遗留** | `/home/nimo/NimoTech/NimoOS-New-UI/.superpowers/sdd/sp8-FULL-acceptance-checklist.md` | 同上(brief 归在 I2 里一起修) |

### I2 · 9 处钉死的 `:5288` 直链已全部改成 80 端口

| 文件 | 行 | 原文 → 改后 |
|---|---|---|
| `sp8-FULL` | 4 | `http://192.168.1.143:5288/app/#/ai/agent` → 去掉 `:5288`,并加一段订正说明 |
| `sp8-FULL` | 11 | 「dev server PID 698934 `:5288`」表格行 → 改成「部署产物,走 80 端口」 |
| `sp8-FULL` | 140 | `…:5288/app/#/ai/settings?section=mcptokens` → 去掉 `:5288` |
| `sp8-FULL` | 141 | `…:5288/v1/ai/mcp-rpc/` → 去掉 `:5288`,并说明该 URL 跟随浏览器当前端口 |
| `p5f` | 9 | `http://<设备IP>:5288/app/#/ai/knowledge` → 去掉 `:5288` |
| `p5f` | 10 | 「dev server 已在 5288 监听(pid 1159107)· 不要跑 deploy.sh」→ 整段改写(已合 master、已部署 80) |
| `p5f` | 31/32/33 | 三条 `…:5288/app/#/ai/knowledge/{wiki,roots,allowlist}` 深链 → 去掉 `:5288` |

复验:
```
$ /usr/bin/grep -n "5288" sp8-FULL-acceptance-checklist.md p5f-acceptance-checklist.md
(仅剩订正说明段落里作为「历史值」提及的那几处,无任何可点直链)
```

### 顺带修掉的一处会造成假缺陷的陈旧事实

`sp8-FULL` 的「我已实测的环境事实」表是 **2026-07-30** 的快照,其中
「**Parser 服务 inactive → 顶栏 Parser 状态灯应为红 = 正常**」**已经反转** —— Parser 现在是 active(`:8283` 有监听),
灯**应为绿**。已在表格上方加了一段带取数命令的时效警告。

### 终审点名必须补进清单的四条,落点

| 要求 | 落在 P6 清单哪一条 |
|---|---|
| New-UI 搜索面板「Ask Nimo」(M6,第 4 个 `sendToAI` 调用点),两个 flag 态各一条 | **A-9** / **B-6** |
| `/#/ai/skills`、`/#/ai/mcp` 两条 redirect 深链(本期最脆) | **A-6** / **A-7**,B 侧 **B-3**;单独成节并标红 |
| 未登录深链 `/#/ai/agent` 落 New-UI 登录页(行为变化) | **A-13**(写了「用无痕窗口验,避免弄丢当前登录态」) |
| 回退语义说明(flag 只挡入口、路由仍注册;置 flag 后需回起点重新点) | **§0.3** + **§0.4** 两小节,放在清单最前面 |

### 清单纪律的落实(逐条对照)

- **「点某个东西」的项先确认真渲染成可点元素**:
  - 「Ask Nimo」按钮 —— 读源码确认 `SearchDialog.vue:333` **无 `v-if`**,面板一开就在输入框右边。
  - MCP「复制」按钮 —— 读源码确认 `McpTokensSection.vue:201-203` **无 `v-if`**,一定渲染。
  - 桌面 AI 磁贴/小组件 —— `defaultLayout.ts:15/17` 确有这两项,但**桌面布局用户可自定义**,
    清单里明写「如果你以前拖走过就没有,标注跳过即可,**不算缺陷**」。
  - KVM 列表 —— 明写「本机可能一台虚拟机都没有,**空列表是正常的**」。
- **面板内状态机/弹窗才能到达的屏写清点击路径**:A-8(必须先走 `#/legacy` 才有 Vue2 桌面)、A-9(顶栏放大镜 / `Ctrl+K`)、
  C-9(`/settings/general` 里那三个原生下拉)、C-10(`?section=mcptokens` 直链 + 「别点错另一个 MCP」提醒)。
- **带数字的项附现测命令**:§0.5 的环境事实表每一行都给了 `systemctl is-active` / `curl` 取数命令,
  并在表头写明「有保质期」。
- **两份清单分开成文、分开跑**:P6 清单末尾明写「三份是三件事,跑完一份回报一份,不要合并成一张长表
  ——混跑正是 SP9-P5 丢条目的成因」。

### C 节(没碰坏别人)为什么这么设计

这是 `sp8-ai` 合进 master 之后的**第一次部署**,合并动了 **i18n 出口 / toast 组件 / `useOpenAction.ts` /
样式 token** 这些**跨区共用**的东西。所以 C 节给了三条**统一判据**(能打开 / 文字是中文没有裸键名 / 配色正常)
+ 8 屏普查(桌面·文件·相册·应用商店·存储·KVM·设置·搜索)+ 3 条定向抽查:

- **C-9 下拉框** —— 并发进来的 `3dcbf89` 正是「原生 select 弹出列表白底白字」的修复,
  且记忆里明写「存储区还有 3 处同款未修」。清单指到 `/settings/general` 那**三个**原生 select(语言/时区/磁盘休眠),
  并说明「白底白字只在**弹出列表**里显形,收起来看不出」。
- **C-10 toast** —— 合并时改过它的 z-index(1100→10100)和第三参语义(判别联合)。
- **C-11 语言切换** —— i18n 出口被合并改过 4 处,切 English 后全站巡一遍,专盯 `ai.xxx`/`photos.xxx` 裸键名。

---

## 6. 记账

`VUE2/docs/vue3-migration-roadmap.md` 改动:

1. **文首「最后更新」** → 2026-08-06,写明 SP8 全区收官 + 三仓未推 origin + `.sp8` 未撤 + SP10 是唯一剩下的大项。
2. **§2 总表 SP8 行** → 从 `🔄` 改成收官态;**明确清掉**「`sp8-ai` 尚未合 master,非快进、4 个冲突文件,
   与 `sp7-photos` 压同一 base,**合并顺序待用户拍板**」那条挂账(已于 T2/T3 完成合并)。
3. **§SP8 章节** → `- [ ] P6 cutover` 改成 `- [x] ✅✅`,并展开一整块收官记录:坐标 / 合流 / cutover 两侧 /
   T1 的 `REDIRECT_BEFORE_GUARD` 实证结论 / 开源面数字 / 四道门现测 / 部署命令与自证(含上面那两个坑)/
   三份验收清单路径 / T10 修复波 / 仍待拍板的三件事。
4. **§SP8 债务台账** → `?raw` 那条关闭并订正措辞 · 新增 **I3** 一整行 · T8-D3 第 ③ 条订正 ·
   `NimoOS-Web README` 降级 · `strangler.js:28` 那条标记已修。

---

## 7. 提交

| 仓 | commit | 内容 |
|---|---|---|
| NEW-UI | `c968fab` | M5:8 处 `@types/node` 注释(pathspec `-- src/ai`) |
| NEW-UI | 见下 | 三份验收清单 + 本报告(`git add -f .superpowers/sdd/...`) |
| VUE2 | `9b86d3ee` | M4 `strangler.js` + M6 spec §4(pathspec `-- src/router/strangler.js docs/superpowers/specs`) |
| VUE2 | 见下 | roadmap 记账(pathspec `-- docs/vue3-migration-roadmap.md`) |
| SERVICE | — | 本刀零改动 |

🔴 全程 pathspec 提交。VUE2 仓那 6 个 `docs/vue3-pending/*.md` 未提交改动属别的线,一字未动。

---

## 8. Concern / 交给机主的判断

1. **真机验收尚未跑** —— 本刀只做到「部署完成 + 机器侧自证通过」。三份清单等机主逐条点。
2. **仍待拍板的三件事**(brief Step 7 列的):
   ① `NimoOS-Web` 要不要 push 公开仓(README 那处已降级为「确认就是这份即可」);
   ② `.sp8` worktree 要不要撤(撤之前**必须先搬台账** —— SP7 就是这么丢的);
   ③ `knowledgeRoutes.ts` 里反转后未被引用的 `KnowledgeDeferred` import 要不要删(T8 刻意保留当锚点,终审判维持)。
3. **I3 是永久性守卫缺口** —— 今天实际违规面只有 `sk-shared.scss` 一个文件(3 处裸色 + 2 处具名 `white`),
   但「往任何 `.scss` 里写死颜色,全仓守卫都不会响」这件事会一直在。建议与票 B 合成一期做。
4. **M5 的范围比 brief 大 3 个文件** —— 已在 §1 逐个列出并说明是同一类缺陷(纯注释,零可执行代码变更)。
   `DashboardView.test.ts` 那处看着同类但**实测仍成立**,刻意没改。
5. **brief 的两条自证命令会误导**(§4 已详述):`strangler:disabled:/ai` 是模板串查不到;
   `curl -sI` 因网关不允许 HEAD 返 405。**这两条已经写进 roadmap 的 P6 收官记录**,下次别再被绊。
