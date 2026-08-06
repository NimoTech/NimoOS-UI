# SP8-P6 · Task 8 报告 —— 开源导出清单扩张 Service 侧 + 全流程跑通

- 日期：2026-08-06
- 工作区：`/home/nimo/NimoTech/NimoOS-New-UI`（分支 `master`，BASE `3ebeaf3`）
- 参照仓：`/home/nimo/NimoTech/NimoOS-Service`（`ac39cd7`，全程只读，未写入任何文件）
- 改动文件：`oss/manifest.mjs` 一个（`SERVICE_DELETE` + `SERVICE_PATCH` 两段）
- 结论：**四道 oss 门全绿；「产物树能构建」那道门第一次真跑起来并通过；产物树人工抽查零泄漏。**

---

## 1. Step 1 —— 先 `ls`，不是写清单

### 1.1 `ls src/` 完整输出（`NimoOS-Service@ac39cd7`，`ls src/ | wc -l` = **69 项**，`src/` 下**无子目录**）

`ls -R src/` 确认平铺无子目录，因此不存在「按子目录拆开的域」这条相册那次的翻车路径；
但**测试确实存在按子域拆开的情况**（`photos.*` 拆了 6 份 —— 那是 SP7-P8b 已补进清单的）。

| # | 文件 | 定性 | 理由 |
|---|---|---|---|
| 1 | `ai.test.ts` | **删（本刀新增）** | AI 域测试 |
| 2 | `ai.ts` | **删（本刀新增）** | AI 助手域，唯一消费方 `src/ai/**` 已在 `DELETE` |
| 3 | `apps.test.ts` | 保留 | 应用域，开源版保留面 |
| 4 | `appstore.test.ts` | 保留 | 商店域，保留面 |
| 5 | `appstore.ts` | 保留 | 同上 |
| 6 | `apps.ts` | 保留 | 同上 |
| 7 | `batch.test.ts` | 保留 | 文件批量操作，保留面 |
| 8 | `batch.ts` | 保留 | 同上 |
| 9 | `cloud.test.ts` | 保留 | 云盘挂载，保留面 |
| 10 | `cloud.ts` | 保留 | 同上 |
| 11 | `compose.test.ts` | 保留 | Docker Compose，保留面 |
| 12 | `compose.ts` | 保留 | 同上 |
| 13 | `config.ts` | 保留 | 包内核（`initService` 配置） |
| 14 | `container.test.ts` | 保留 | 容器域，保留面 |
| 15 | `container.ts` | 保留 | 同上 |
| 16 | `disks.test.ts` | 保留 | 存储域，保留面 |
| 17 | `disks.ts` | 保留 | 同上 |
| 18 | `driver.test.ts` | 保留 | 云盘驱动，保留面 |
| 19 | `driver.ts` | 保留 | 同上 |
| 20 | `file.test.ts` | 保留 | 文件区，保留面 |
| 21 | `file.ts` | 保留 | 同上 |
| 22 | `file.upload.test.ts` | 保留 | 同上（上传子域拆分测试，**保留面所以不删**） |
| 23 | `folder.test.ts` | 保留 | 目录树，保留面 |
| 24 | `folder.ts` | 保留 | 同上 |
| 25 | `http.test.ts` | 保留 | 包内核（axios 实例 + 401 单飞刷新） |
| 26 | `http.ts` | 保留 | 同上 |
| 27 | `image.test.ts` | 保留 | 缩略图 URL 构造，保留面 |
| 28 | `image.ts` | 保留 | 同上 |
| 29 | `index.integration.test.ts` | 保留 | 20 行，`grep` 实测**不含** ai/notes/wiki/sse/photos/search 任一引用，无需补丁 |
| 30 | `index.ts` | 保留 + **打补丁** | 接线总入口，13 处 AI 接线要摘（见 §3） |
| 31 | `kvm.test.ts` | 保留 | KVM 域，保留面 |
| 32 | `kvm.ts` | 保留 | 同上 |
| 33 | `network.test.ts` | 保留 | 网络域，保留面 |
| 34 | `network.ts` | 保留 | 同上 |
| 35 | `notes.test.ts` | **删（本刀新增）** | AI 笔记域测试 |
| 36 | `notes.ts` | **删（本刀新增）** | AI 笔记域 |
| 37 | `parseUtil.test.ts` | 保留 | 通用解析工具，保留面 |
| 38 | `parseUtil.ts` | 保留 | 同上 |
| 39 | `photos.albums.test.ts` | 已在清单（SP7-P8b） | 相册 |
| 40 | `photos.favorites.test.ts` | 已在清单 | 相册 |
| 41 | `photos.persons.test.ts` | 已在清单 | 相册 |
| 42 | `photos.places.test.ts` | 已在清单 | 相册 |
| 43 | `photos.test.ts` | 已在清单 | 相册 |
| 44 | `photos.ts` | 已在清单 | 相册 |
| 45 | `photos.uploads.test.ts` | 已在清单 | 相册 |
| 46 | `photos.views.test.ts` | 已在清单 | 相册 |
| 47 | `raid.test.ts` | 保留 | 存储域，保留面 |
| 48 | `raid.ts` | 保留 | 同上 |
| 49 | `samba.test.ts` | 保留 + 已有补丁 | 保留面；基线扫描命中 2 处措辞，由既有 `PATCH` 洗掉 |
| 50 | `samba.ts` | 保留 | 保留面 |
| 51 | `search.test.ts` | 已在清单（SP9-P7） | 搜索 |
| 52 | `search.ts` | 已在清单 | 搜索 |
| 53 | `snapshot.test.ts` | 保留 | 快照域，保留面 |
| 54 | `snapshot.ts` | 保留 | 同上 |
| 55 | `sse.test.ts` | **删（本刀新增）** | 见下面的孤儿取证 |
| 56 | `sse.ts` | **删（本刀新增）** | 通用 SSE 助手，删掉 AI 域后成孤儿（取证见 §2） |
| 57 | `storage.test.ts` | 保留 | 存储域，保留面 |
| 58 | `storage.ts` | 保留 | 同上 |
| 59 | `sys.test.ts` | 保留 | 系统信息，保留面 |
| 60 | `sys.ts` | 保留 | 同上 |
| 61 | `types.ts` | 保留 + 已有补丁 | 共享类型；`PhotoAsset` 一行由既有 `SERVICE_PATCH` 摘掉。**AI 域类型不在这里**（`Note`/`WikiRoot`/`SseOptions` 都定义在各自模块内），无需新增补丁 |
| 62 | `unwrap.test.ts` | 保留 | 信封剥离工具，保留面 |
| 63 | `unwrap.ts` | 保留 | 同上 |
| 64 | `users.test.ts` | 保留 | 用户域，保留面 |
| 65 | `users.ts` | 保留 | 同上 |
| 66 | `v2.test.ts` | 保留 | v2 API 适配，保留面 |
| 67 | `v2.ts` | 保留 | 同上 |
| 68 | `wiki.test.ts` | **删（本刀新增）** | 知识库导航域测试 |
| 69 | `wiki.ts` | **删（本刀新增）** | 知识库（Wiki 导航）域 |

**本刀新删 8 个**（`ai`/`notes`/`sse`/`wiki` 各 2）；加上既有的 photos 8 个 + search 2 个，
`SERVICE_DELETE` 从 `src/` 共删 **18** 个文件（另加 `.superpowers` 整目录）。

### 1.2 仓根目录（`ls -A`）

```
dist  .git  .gitignore  node_modules  package.json  pnpm-lock.yaml  src  .superpowers  tsconfig.json  vitest.config.ts
```

🔴 **`.superpowers/`** —— `git ls-files .superpowers | wc -l` = **32 份**被跟踪的 SP7 期台账。
`export.mjs` 第 57 行的注释写着「`.superpowers` 自动排除」，**这句话是错的**：两个仓都**没有
`.gitattributes`**（实测 `cat .gitattributes` 均 `(none)`），`git archive HEAD` 不会排除任何被跟踪
的文件。New-UI 那份靠 `DELETE` 表第 54 行的显式条目删掉，**Service 这份此前没有对应条目**。
→ 本刀补进 `SERVICE_DELETE`。（`dist/`、`node_modules/` 在 `.gitignore` 里，`git archive` 天然拿不到，
`tree.test.mjs` 也有一条 `exists('packages/service/dist') === false` 的断言钉住。）

---

## 2. 消费方取证（删完不留孤儿）

### 2.1 Service 仓内部

```
$ for f in ai notes sse wiki; do echo "--- $f ---"
    /usr/bin/grep -rn "from './$f.js'\|from './$f'" src/ | /usr/bin/grep -v "^src/$f"; done
--- ai ---
src/index.ts:26:import { createAi } from './ai.js'
--- notes ---
src/index.ts:28:import { createNotes } from './notes.js'
src/index.ts:32:export { isDistillableName, DISTILL_EXTS } from './notes.js'
src/index.ts:42:export type { Note, ... } from './notes.js'
--- sse ---
src/index.ts:27:import { sseRequest } from './sse.js'
src/index.ts:34:export type { SseOptions, SseOutcome } from './sse.js'
--- wiki ---
src/index.ts:29:import { createWiki } from './wiki.js'
src/index.ts:33:export { createRootBody } from './wiki.js'
src/index.ts:43:export type { WikiRoot, ... } from './wiki.js'
```

**Service 仓内唯一消费方就是 `src/index.ts`。** 另外反向确认这四个模块自身不互相依赖：

```
$ /usr/bin/grep -n "^import" src/ai.ts src/notes.ts src/wiki.ts
src/ai.ts:1:import type { AxiosInstance } from 'axios'
src/notes.ts:1:import type { AxiosInstance } from 'axios'
src/wiki.ts:1:import type { AxiosInstance } from 'axios'
```

### 2.2 `sse.ts` 的孤儿判定（brief 要求自己取证，不采信转述）

`sse.ts` 只导出 `SseOptions` / `SseOutcome` / `sseRequest`。**`ai.ts` 并没有 import 它**
（上面 §2.1 的 import 列表里只有 axios）—— 也就是说 brief 里「全仓只有 `ai.ts` 用它」这句
**措辞不准**：Service 仓内**没有任何模块** import 它，它是纯粹经 `index.ts` 再导出、给消费端用的。
真正的调用点在 New-UI 侧：

```
$ /usr/bin/grep -rn "sseRequest" /home/nimo/NimoTech/NimoOS-New-UI/src/
src/ai/services/agentTransport.ts:7:import { sseRequest } from '@nimotech/nimoos-service'
src/ai/services/agentTransport.ts:30/50: await sseRequest(...)
src/ai/services/skillTestTransport.ts:35:import { sseRequest } from '@nimotech/nimoos-service'
src/ai/services/skillTestTransport.ts:44: await sseRequest(...)
（其余全是 src/ai/** 下的测试与注释）
```

两个真实调用点**都在 `src/ai/**` 里**，而 `'src/ai'` 已在 `DELETE` 表（manifest 第 128 行）。
⇒ 删掉 AI 域后 `sse.ts` 确为孤儿，可删。**结论与 brief 一致，但根据不同 —— 已按取证改写清单注释。**

### 2.3 New-UI 侧「删完还有没有人用」的反向检查

```
$ /usr/bin/grep -rn "sseRequest|SseOptions|SseOutcome|isDistillableName|DISTILL_EXTS|
                     createRootBody|service\.ai\b|service\.notes\b|service\.wiki\b|
                     WikiRoot|DistillJob|NotesSettings" src/ | grep -v "^src/ai/"
src/settings/util/folderPermissions.ts:17: export interface WikiRoot { ... }   ← 本仓**自己定义**的同名 interface，不是 import
（其余无）
```

`src/settings/util/folderPermissions.ts` 只是重名，且该文件本身已在 `DELETE` 表（其孤儿测试
`folderPermissions.test.ts` 在第 150 行、注释写明「import folderPermissions.ts（已删）」）。
⇒ 开源面无任何残留消费方。

---

## 3. 清单改动（`oss/manifest.mjs` 唯一改动文件）

### 3.1 `SERVICE_DELETE` +9 条

```
'.superpowers',          ← 整目录（32 份台账）
'src/ai.ts', 'src/ai.test.ts',
'src/notes.ts', 'src/notes.test.ts',
'src/sse.ts', 'src/sse.test.ts',
'src/wiki.ts', 'src/wiki.test.ts',
```

### 3.2 `SERVICE_PATCH` +13 条（全部作用于 `src/index.ts`）

锚点**一律现场抓**（`python3` 打 `repr()` 逐字节核对行内容，不照抄 brief）：

| # | 类别 | 锚点（原文） |
|---|---|---|
| 1 | import | `import { createAi } from './ai.js'` |
| 2 | import | `import { sseRequest } from './sse.js'` |
| 3 | import | `import { createNotes } from './notes.js'` |
| 4 | import | `import { createWiki } from './wiki.js'` |
| 5 | 具名导出 | 第 31 行整行 → 整行换整行（摘掉行尾 `, sseRequest`）。**没有用 `', sseRequest'` 做锚点** —— 那依赖逗号位置，整行替换更稳且 diff 自解释 |
| 6 | re-export | `export { isDistillableName, DISTILL_EXTS } from './notes.js'` |
| 7 | re-export | `export { createRootBody } from './wiki.js'` |
| 8 | type re-export | `export type { SseOptions, SseOutcome } from './sse.js'` |
| 9 | type re-export | `export type { Note, CreateNoteFields, ... DistillJobsView } from './notes.js'`（9 个类型） |
| 10 | type re-export | `export type { WikiRoot, ... WikiNode } from './wiki.js'`（6 个类型） |
| 11 | getter | `get ai()` 三行 |
| 12 | getter | `get notes()` 三行 |
| 13 | getter | `get wiki()` 三行 |

> 🔴 判据（相册/搜索两轮的原话）：**删掉域文件却不打接线补丁 ⇒ 内嵌共享包直接构建失败，
> 而词表守卫和 tree 测试可能全绿。** 本刀第 §6 节的「产物树能构建」门就是专门钉这个。

**未删哈希钉、未放宽 `oss/forbidden.mjs` 词表、未把任何 `find` 改松、未调低任何守卫阈值。**

---

## 4. 导出全流程 —— 每一轮的失败原文与处理

导出到 scratch 目录，**没有碰 `NimoOS-Web` 公开仓工作副本**（它仍停在 `748aa8f`）：

```
node oss/export.mjs --out <scratch>/oss-out --no-commit --allow-dirty-oss
```

| 轮 | 失败原文 | 归类 | 处理 |
|---|---|---|---|
| 1 | *（无失败）* 见下方完整输出 | — | — |

```
[oss] 1/6 前置检查
[oss]   New-UI 3ebeaf36 · Service ac39cd78
[oss] 2/6 取源
[oss] 3/6 应用清单(DELETE 71 · REPLACE 4 · PATCH 252)
[oss] 4/6 内嵌共享包
[oss] 4.5/6 重算 lockfile(package.json 的依赖已被清单改动)
[oss] 5/6 泄漏守卫
[oss]   ⚠ 1 个文件未做内容扫描(二进制/符号链接,预期内,不计入泄漏判定):
[oss]     ⚠ 未扫描:src/home/apps/icons/settings.png —— 判定为二进制,未扫描
[oss]   零真实泄漏命中(1 个预期内跳过已记录,见上方与 .export-report.txt)
[oss] 6/6 落盘
[oss] 完成 → <scratch>/oss-out
```

**总轮数 = 1。** 一次过，没有出现锚点失配 / 泄漏命中 / 旧路径三类失败中的任何一类。

### 4.1 为什么会一次过（不是运气，是 Step 1 的直接结果）

「一轮就过」这种结果本身可疑，所以做了独立基线测量：把 `NimoOS-Service@ac39cd7` 的
`git archive HEAD` 解到临时目录，直接用 `oss/forbidden.mjs` 的 `scanTree()` 扫它（不经导出流程）：

```
TOTAL(baseline, Service 侧未剥离): 1321
  437 .superpowers/**
  373 src/ai.test.ts
  100 src/photos.ts
   52 src/ai.ts
   40 src/wiki.test.ts
   40 src/wiki.ts
   39 src/photos.test.ts
   36 src/search.ts
   31 src/photos.persons.test.ts
   28 src/search.test.ts
   27 src/photos.favorites.test.ts
   25 src/photos.views.test.ts
   19 src/notes.test.ts
   19 src/photos.uploads.test.ts
   17 src/index.ts
   14 src/photos.albums.test.ts
   14 src/photos.places.test.ts
    7 src/notes.ts
    2 src/samba.test.ts
    1 src/types.ts
```

其中 **AI 域的 7 个分组与 T7 交接的数字逐条一致**：
`.superpowers` 437 · `ai.test.ts` 373 · `ai.ts` 52 · `wiki.test.ts` 40 · `wiki.ts` 40 ·
`notes.test.ts` 19 · `notes.ts` 7 = **968**。
`index.ts` 我这里量到 17（含 search 的 3 行接线，那 3 行在真实流程里已被 SP9-P7 的既有
`SERVICE_PATCH` 先摘掉），T7 量到的 9 是**打完 search 补丁之后**的残量 —— **968 + 9 = 977**，
与 T7 交接数字精确吻合。剩下的 photos/search/samba/types 分组由既有清单条目负责，
最终导出实测归零。

---

## 5. 四道 oss 门

```
$ pnpm exec vitest run oss --reporter=verbose
 Test Files  17 passed (17)
      Tests  427 passed (427)
   Duration  16.65s
```

> 说明：vitest 的路径过滤是**大小写不敏感的子串匹配**，`oss` 额外命中了 11 个
> `Photos*`（`…hotoSSearch…`）文件。`oss/` 目录下的 6 个门文件逐个列出如下，全绿：

```
✓ oss/apply.test.mjs
✓ oss/dist-scan.test.mjs
✓ oss/export-rsync.test.mjs
✓ oss/forbidden.test.mjs
✓ oss/media-wave.test.mjs
✓ oss/tree.test.mjs
```

---

## 6. 🔴「产物树能构建」那道门 —— 证明它真执行了

### 6.1 门自身的输出原文

```
✓ oss/tree.test.mjs > 泄漏守卫 > 不带 --skip-guard 也能跑通 …
✓ oss/tree.test.mjs > 泄漏守卫 > 手工抽查:产出树里一律扫不到相册/Nimo AI/transcript/qdrant/内网 IP
                                (独立于 forbidden.mjs 词表的第二重验证) 30ms
✓ oss/tree.test.mjs > 产物树能构建 > pnpm install + vue-tsc --noEmit 在产物树上全绿
                                (只扫词的守卫抓不到构建断裂) 10942ms
```

**`10942ms` 是真跑出来的耗时**，不是 `skipped`（vitest 对跳过的用例打 `↓`，不打 `✓`，也不带耗时）。

### 6.2 手工在 scratch 产物树复现同样两条命令

```
$ cd <scratch>/oss-out
$ CI= pnpm install --prefer-offline --ignore-scripts --no-frozen-lockfile
  + typescript 5.9.3   + vite 7.3.6   + vitest 4.1.9   + vue-tsc 2.2.12
  Done in 927ms                                   real 0m1.095s
$ CI= pnpm exec vue-tsc --noEmit
  vue-tsc exit=0                                  real 0m8.513s
```

1.1s + 8.5s ≈ 9.6s，与门里的 10942ms 对得上（门额外多一次 execFileSync 启动开销）。

### 6.3 变异验证 —— 证明这道门**有判别力**（不是空跑）

只信「它绿了」是不够的：往产物树的 `packages/service/src/index.ts` 顶部**塞回一行**被摘掉的接线，
看它会不会响：

```
$ head -1 packages/service/src/index.ts     # 人为塞回
import { createAi } from './ai.js'
$ CI= pnpm exec vue-tsc --noEmit
node_modules/.pnpm/@nimotech+nimoos-service@file+packages+service/node_modules/
  @nimotech/nimoos-service/src/index.ts(1,26):
  error TS2307: Cannot find module './ai.js' or its corresponding type declarations.
exit=2
$ # 还原后
$ CI= pnpm exec vue-tsc --noEmit ; echo exit=$?
exit=0
```

⇒ 这道门**确实穿透到内嵌共享包的 TS 源码**做了类型检查，「删了域文件不打接线补丁」这一类
断裂它抓得住。这正是本刀最大的风险点，已用真失败取证。

---

## 7. 人工抽查产物树（不只信守卫结论）

```
$ cd <scratch>/oss-out
$ /usr/bin/grep -rIl "知识库\|AI 助手\|智能体\|tiptap\|nimoos_search\|向量" . 2>/dev/null \
    | /usr/bin/grep -v node_modules | head -30
(无输出)

$ ls -d packages/service/.superpowers ; ls -d .superpowers
ls: cannot access 'packages/service/.superpowers': No such file or directory
ls: cannot access '.superpowers': No such file or directory

$ ls packages/service/src/
apps.test.ts appstore.test.ts appstore.ts apps.ts batch.test.ts batch.ts cloud.test.ts
cloud.ts compose.test.ts compose.ts config.ts container.test.ts container.ts disks.test.ts
disks.ts driver.test.ts driver.ts file.test.ts file.ts file.upload.test.ts folder.test.ts
folder.ts http.test.ts http.ts image.test.ts image.ts index.integration.test.ts index.ts
kvm.test.ts kvm.ts network.test.ts network.ts parseUtil.test.ts parseUtil.ts raid.test.ts
raid.ts samba.test.ts samba.ts snapshot.test.ts snapshot.ts storage.test.ts storage.ts
sys.test.ts sys.ts types.ts unwrap.test.ts unwrap.ts users.test.ts users.ts v2.test.ts v2.ts
```

现测计数：`ls packages/service/src/ | wc -l` = **51**，私有侧 `ls src/ | wc -l` = **69**，
69 − 18 = 51 ✓。`ai*` / `notes*` / `sse*` / `wiki*` / `photos*` / `search*` 一个不剩。

### 7.1 反向检查（T9 那次「白名单只单向查」的教训，已固化为习惯）

不只查「该没的没了」，还查「该没的东西有没有在别处留下引用」：

```
$ /usr/bin/grep -rn "service\.ai\b\|service\.notes\b\|service\.wiki\b\|sseRequest\|SseOptions\|
   SseOutcome\|isDistillableName\|DISTILL_EXTS\|createRootBody\|createAi\|createNotes\|
   createWiki\|from './ai.js'\|from './notes.js'\|from './wiki.js'\|from './sse.js'" \
   --include=*.ts --include=*.vue --include=*.mjs --include=*.json . | grep -v node_modules
(无输出)
```

产物树的 `packages/service/src/index.ts` 实际长相（补丁生效后）：

```
1  import type { AxiosInstance } from 'axios'
…  （23 行 import，无 ai/sse/notes/wiki）
25 export { initService, getHttp, refreshAccessToken, parseUtil, UPLOAD_TUS_ENDPOINT, networkErrorText }
26 export type { ServiceConfig } from './config.js'
27 export type { Utilization, … }（无 PhotoAsset）
28-31 compose / raid / snapshot / kvm 四条 type re-export
…  service 对象最后一个 getter 是 kvm，之后直接 `}`
```

---

## 8. T7 交下来的三条挂账 —— 逐条判定

| # | 挂账 | 本刀判定 | 依据 |
|---|---|---|---|
| 1 | 步骤 4.5 用 `--prefer-offline` 而非 `--offline`，清单一旦新增/改指依赖就会从 registry 现解 | **仍是挂账，本刀不触发** | 本刀改动**只有 `SERVICE_DELETE` 加文件 + `SERVICE_PATCH` 改 `src/index.ts`**，一条 `dependencies` 都没动（根 `package.json` 的依赖补丁是 T7 的既有条目，本刀未改）。步骤 4.5 这次跑的依赖图与 T7 完全相同 |
| 2 | 导出依赖 PATH 上的 pnpm，两侧 `package.json` 无 `packageManager` 字段 | **仍是挂账，非阻塞** | 与本刀改动无关；本机 pnpm 可用、四道门全绿。留给 T10 之后统一处理 |
| 3 | `packages/service/pnpm-lock.yaml` 是第二份被跟踪的 lockfile，步骤 4.5 不重算它 —— 若 `SERVICE_PATCH` 动到 Service 的 `dependencies`，同样的漂移会在那边重开且无守卫 | **仍是挂账，本刀不触发（已实测证否）** | 见下方两条取证 |

### 8.1 挂账 3 的实测取证

**(a) 产物树与私有仓的 Service 依赖块逐字节相同**（本刀的 `SERVICE_PATCH` 只碰 `src/index.ts`；
既有的 `package.json` 补丁只改 `main/module/types/exports/files`，不碰依赖）：

```
$ diff <(产物树 packages/service/package.json 的 dependencies+devDependencies+peerDependencies)
        <(私有仓 NimoOS-Service/package.json 的同三块)
(无差异)
```

**(b) 在产物树的 `packages/service/` 里直接跑 frozen 安装 —— 就是公开仓 clone 下来的场景：**

```
$ cd <scratch>/oss-out/packages/service
$ CI=true pnpm install --frozen-lockfile --ignore-scripts
dependencies:    + axios 1.18.1
devDependencies: + typescript 5.9.3   + vitest 4.1.9
Done in 401ms
exit=0
```

⇒ **不是 `ERR_PNPM_OUTDATED_LOCKFILE`**，第二份 lockfile 没有漂。挂账 3 保持挂账状态，
但已附上一条可复用的验证命令；**未来任何一刀只要 `SERVICE_PATCH` 碰了 Service 的
`dependencies`，就必须把 (b) 这条命令重跑一遍。**

---

## 9. 新记的债务 / concern

| 编号 | 内容 |
|---|---|
| T8-D1 | **`oss/export.mjs` 第 57 行的注释是错的**：`// 2. 取源（git archive:.git / node_modules / dist / .superpowers / tmlab 自动排除）`。实测两个仓**都没有 `.gitattributes`**，`git archive` 不会自动排除 `.superpowers` / `scripts/tmlab`；它们全靠 `DELETE` / `SERVICE_DELETE` 的显式条目删。**Service 侧漏了 437 处正是被这句注释掩护的**。本刀按「只改 manifest.mjs」的任务边界没有改 `export.mjs`，但这句误导性注释应尽早改掉 |
| T8-D2 | `tree.test.mjs:243` 那条 `.superpowers/` 断言只查产物树**根目录**的 `.gitignore` 文本，**没有一条断言「产物树里不存在 `packages/service/.superpowers` 目录」**。今天靠泄漏守卫兜住（437 处词命中），但假如某天台账里恰好一个禁词都不含，就会静默漏出去。建议补一条 `expect(exists('packages/service/.superpowers')).toBe(false)` |
| T8-D3 | 「产物树能构建」门只跑 `pnpm install` + `vue-tsc --noEmit`，**不跑 `vite build`、也不跑产物树自己的 `pnpm test`**。类型能过 ≠ 打包能过（例如被删文件仍被某个 `import()` 动态引用、或 vite 插件配置指向已删目录）。本刀已用 §7.1 的反向 grep 手工兜了一层，但那仍是「扫词」 |

---

## 10. 收尾状态

```
$ cd /home/nimo/NimoTech/NimoOS-New-UI && git status --short
 D "design-export/Audio Speaker Segmentation.html"
 D design-export/audio-waveform-design-kit.html
 D design-export/design-final.html

$ git -C /home/nimo/NimoTech/NimoOS-Service status --short
（0 行）
```

- 改动文件：`oss/manifest.mjs`（+9 `SERVICE_DELETE` / +13 `SERVICE_PATCH`）
- `NimoOS-Service` 全程只读，**未写入任何临时文件**
- `NimoOS-Web` 公开仓工作副本**未触碰**，仍停在 `748aa8f`；本刀**不 push 公开仓**

  ⚠️ 顺带发现（**先于本刀存在，非本刀造成** —— 本刀全程只导出到 scratch，一次都没进过这个目录）：

  ```
  $ git -C /home/nimo/NimoTech/NimoOS-Web log --oneline -1
  748aa8f NimoOS Web UI
  $ git -C /home/nimo/NimoTech/NimoOS-Web status --short
   M README.md
  ```

  公开仓工作副本里有一处**未提交的 `README.md` 改动**。它不影响本刀（导出走的是私有仓的
  `git archive HEAD` + `oss/files/README.md` 整文件替换），但 T10 之后真要 push 公开仓时，
  这行脏改动会被 `git add -A` 一起带上去 —— **推之前必须先看一眼它是什么。**
