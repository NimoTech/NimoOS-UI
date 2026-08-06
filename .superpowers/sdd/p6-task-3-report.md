# SP8-P6 T3 报告 —— 合流 sp8-ai 进 NimoOS-New-UI master

**状态:DONE_WITH_CONCERNS**
**合并提交:`261bebd`**(master,BASE = `3942b47`,被并入 `sp8-ai` = `b5db2cf`,merge-base = `ecfefa8`)

---

## 0. 结论速览

| 门 | 基线(master) | 合流后 | 判定 |
|---|---|---|---|
| vitest 文件 | 476(473 过 / **3 失败**) | 600(597 过 / **3 失败**) | +124,零新增失败 |
| vitest 用例 | 6251(6181 过 / **1 失败** / 69 skip) | 9903(9833 过 / **1 失败** / 69 skip) | +3652,零新增失败 |
| vue-tsc | 0 错 | **0 错** | 绿 |
| build | 成功 | **成功(16.80s)** | 绿 |
| i18n parity | 绿 | **绿(7 文件 / 184 例全过)** | 绿 |

**那 3 个失败是基线就红的同一批 `oss/*`,与本刀无关**(详见 §1)。

---

## 1. 🔴 基线与交办口径不符(第一项 concern)

交办说基线是「476 文件 / 6251 用例,2 个失败,失败在 `oss/tree.test.mjs`,原因是 SP7 台账被提交进 Service 仓、导出脚本把它带进产物树、泄漏守卫扫到中文词」。**实测三项都不同**:

**① 第一次跑基线拿到 61 个文件失败(不是 2 个)。** 根因不是 oss,是**共享包 `file:` 链接漂移**——
`node_modules` 里那份 `@nimotech/nimoos-service/dist/index.js` 已经 `import './ai.js'`,而 `ai.js` 根本没被安装进去:

```
Error: Failed to resolve import "./ai.js" from ".../@nimotech/nimoos-service/dist/index.js"
```

源仓 `/home/nimo/NimoTech/NimoOS-Service/dist/` 有 `ai.js`,已安装副本没有 —— 即 T2 在 Service 侧 `pnpm build` 之后,
**New-UI 这边没有重新 `pnpm install`**。这正是记忆里「nimoos-service pnpm 漂移」那个坑。
跑一次 `pnpm install` 后 `ai.js` 到位,基线才收敛到 476/6251 —— 与交办的数字对上了。

> ⚠️ 交办给的 476/6251 是**刷新链接之后**才成立的数字;谁在 T3 之前直接跑测试都会看到 60 来个文件红。

**② 真正的失败是 3 个文件 / 1 个用例,不是 2 个。** 且**三条同一个根因**,与「泄漏守卫扫到中文词」无关:

```
 FAIL  oss/media-wave.test.mjs [ oss/media-wave.test.mjs ]
 FAIL  oss/tree.test.mjs [ oss/tree.test.mjs ]
 FAIL  oss/export-rsync.test.mjs > 导出落盘:node_modules 保留、dist 照常清空 > ...
Error: Command failed: node .../oss/export.mjs --out ... --skip-guard --no-commit --allow-dirty-oss
[oss] 失败:/home/nimo/NimoTech/NimoOS-Service 工作树不干净,导出中止:
?? .superpowers/sdd/2026-08-06-vue3-migration-sp8-p6-cutover/
```

**导出守卫是被本次 cutover 自己的任务目录卡住的** —— 那个未跟踪目录就是 T3 brief 所在的目录。
不是代码问题,是环境问题。合流后这 3 条仍红、仍是同一条 `工作树不干净` 报错(合流后先卡在 New-UI 自己的
未提交状态上,提交后回到卡 Service)。**未修,按交办「不要试图去修它」执行。**

**③ 基线本身有抖动。** 同一份 master 连跑两次:第一次 61 文件 / 2 用例失败,第二次 60 文件 / 1 用例失败
(`src/files/upload/persist.test.ts` 与 `src/photos/stores/__tests__/favorites.test.ts` 时红时不红,
后者是 jsdom `navigation is not implemented`)。链接修好后的两次全量跑则稳定在 3/1。

---

## 2. Step 4 / Step 5 三方比较 —— 完整输出与逐条判定

### 2.1 🔴 交办给的取数脚本是坏的,结论会偏(第二项 concern)

brief Step 4/5 的 node 脚本用 `src.replace(/\/\*[\s\S]*?\*\//g, ...)` 剥块注释。
sp8 的 `zh_cn.ts` 里有这么一条文案:

```
  aiCfgPatternPlaceholder: '例如 /DATA/private/** 或 *.bak',
```

`/DATA/private/**` 里的 `/*` 被当成**块注释起始**,一路吃到文件后面某个 `*/` 才停。实测后果:

```
sp8_zh raw: 1726 stripped: 938  被注释剥离器吃掉的键: 788
```

**Step 4/5 只看到了 54% 的键。** 照原脚本会得出「sp8 独有键 418 个、改过 0 个」——
数字全错,而且「改过 0 个」这个**最关键的结论是在半张表上得出的**,属于典型静默错。

我换成了**字符串感知的扫描器**(逐字符跟踪 code / 行注释 / 块注释 / 三种引号,
只把注释字符抹成空格,字符串内容原样保留),重跑。

### 2.2 又一处漏网:引号键

字符串感知扫描器仍报 1206,而运行时 `Object.keys()` 报 **1207**。差额定位到:

```
  'ai.searchMyNas': '在我的 NAS 中搜索"{query}"。',
```

**一个带点号的引号键**,`^ {2}([A-Za-z0-9_]+):` 匹配不到。扫描器补上引号键分支后静态与运行时一致。

> 这一条是靠 Step 7 的集合等式自证抓出来的 —— 断言写的是 1206,跑出来 1207,**没有改断言迁就结果**,
> 而是回头查出扫描器的第二个盲区,确认 1207 才是真值后才把断言改成 1207。

### 2.3 修正后的完整输出(scanner v2,两语言)

```
========== zh (scanner v2) ==========
merge-base: 520  sp8: 1727
STEP4 sp8 独有键: 1207 | 不以 ai 开头: 0 []
STEP4 sp8 删掉的 base 键: 0 []
STEP5 sp8 改过的既有键: 0
========== en (scanner v2) ==========
merge-base: 520  sp8: 1727
STEP4 sp8 独有键: 1207 | 不以 ai 开头: 0 []
STEP4 sp8 删掉的 base 键: 0 []
STEP5 sp8 改过的既有键: 0
```

### 2.4 逐条判定

- **Step 4「不以 ai 开头的 sp8 独有键」= 0**(两语言)→ 1207 个键**全部**进 ai 分片,无需逐条归属判定。
  唯一形态特殊的是 `'ai.searchMyNas'`(引号 + 点号),它仍以 `ai` 开头,归属 ai 分片无争议。
- **Step 4「sp8 删掉的 base 键」= 0** → 合流不会因为整取 master 的 base 而丢 sp8 的删除意图。
- **Step 5「sp8 改过的既有键」= 0**(两语言)→ **没有任何一条需要判定要不要带进 master 的 base**。
  这也正是「base 一侧整取 master」安全的依据:sp8 对分叉点那 520 个键一个字都没动,
  所以 master 上 SP7/SP9 期间对 base 的修改**不存在被回退的风险**。

> 因为 Step 5 为 0,brief 里「不为 0 而你跳过了就是静默丢改动」那条不适用 —— 但请注意:
> **这个 0 是用修正后的扫描器得出的**,用 brief 原脚本得到的 0 是不可信的(见 §2.1)。

---

## 3. Step 7 集合等式自证 —— 输出原文

临时用例 `src/i18n/__tests__/__tmp_split_check.test.ts`(跑完已删):

```
 ✓ T3 临时自证:i18n 切分无损 > zh 三块两两不相交,且之和等于出口键数 4ms
 ✓ T3 临时自证:i18n 切分无损 > en 三块两两不相交,且之和等于出口键数 1ms
 ✓ T3 临时自证:i18n 切分无损 > ai 分片:两语言键集完全一致,且全部以 ai 开头 2ms
 ✓ T3 临时自证:i18n 切分无损 > ai 分片键数 = 1207(三方比较实测…含引号键 ai.searchMyNas) 0ms
 ✓ T3 临时自证:i18n 切分无损 > sp8 对分叉点已有 base 键零修改:… 28ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
```

---

## 4. 🔴 master 的 i18n 结构与 brief 描述不同(第三项 concern)

brief 说 master 侧「已拆成 `base + photos` + 3 行出口」。**实际是 4 片**:

```
zh_cn.base.ts (757 键)  zh_cn.photos.ts (702 键)  zh_cn.sp9.ts (459 键)  zh_cn.ts (出口)
```

而且 **`zh_cn.sp9.ts` 不在 `zh_cn.ts` 出口里** —— 它在 `i18n/index.ts` 和 `parity.test.ts` 里
各自单独 `{...zh, ...zhSp9}` 并进来,是**另一条装配路径**。

我按 brief 的要求把 ai 加进 `zh_cn.ts` 出口(`{...base, ...photos, ...ai}`),
并在出口文件头注释里把「sp9 不在本出口里」这件事写清楚,免得下一个人以为出口就是全部。
ai 键与 base/photos/sp9 三片实测**零碰撞**。

---

## 5. 四个 toast 文件:两侧 diff 与逐行裁决

### 5.1 两侧各改了什么(相对 merge-base)

| | master(sp7 侧) | sp8 侧 |
|---|---|---|
| `stores/toast.ts` | 加 `ToastAction{label,onClick}`、`ToastItem.action?`、`show()` 第三参 `action?`、新增 `dismiss(id)` | 加 `ToastTier='info'\|'warning'\|'danger'`、`ToastItem.tier`、`show()` 第三参 `tier='info'` |
| `AppToast.vue` | 渲染 action 按钮 + `.has-action{pointer-events:auto}` + `onAction()` 点后立即 dismiss;z-index 60→**1100** | 套 AI 主题作用域(`ai-toast-scope` + `data-theme`)、`data-tier` 属性 + warning/danger 两条 token 规则;z-index 60→**10100** |
| 两个 `.test.ts` | 纯追加(action 渲染/点击、dismiss) | 纯追加(三档 tier、AI 作用域四条、z-index 源码守卫) |

### 5.2 逐行裁决

1. **`show()` 第三个位置参数被两边同时占用** —— 这是唯一的真冲突,不是加行型。
   实测调用点:**sp8 侧 48 处**传字符串 tier(`toast.show(msg, 3000, 'danger')`),
   **master 侧 4 处**传对象 action(`toast.show(t(...), 5000, { label, onClick })`)。
   任何一边整取都会让另一边几十处调用点静默失效。
   **裁决:改成判别联合** ——
   ```ts
   function show(text: string, duration = 1500, tierOrAction: ToastTier | ToastAction = 'info') {
     const tier   = typeof tierOrAction === 'string' ? tierOrAction : 'info'
     const action = typeof tierOrAction === 'string' ? undefined    : tierOrAction
     toasts.value.push({ id, text, tier, action })
   ```
   两侧全部 52 处调用点**一行未改**,类型仍精确。
   已补两条双向回归用例(对象→action 且 tier 回落 info / 字符串→tier 且 action 为 undefined)。
2. **`ToastItem`** 取并集 `{ id, text, tier, action? }`。`tier` 非可选(总有默认值),`action` 可选。
3. **`dismiss(id)`** 只有 master 有,sp8 无冲突诉求 → 原样保留。
4. **z-index:取 sp8 的 10100,不取 master 的 1100。** 理由不是「sp8 更大」,是
   **AI 区随本次合流进主干**,它的 `SearchImageLightbox`/`SearchFileDrawer` 坐在 10000、
   `SearchFullResults` 9999 —— master 的 1100 会被这些压住,而 sp8 的 z-index 源码守卫
   (`toBeGreaterThan(10000)`)也会直接打红。两边的原注释合并保留。
5. **模板**:AI 主题作用域绑定(sp8)套在 `transition-group` 上,
   `has-action` / `data-tier` / action 按钮(两侧)套在 `.toast` 上,互不干涉,全部保留。
6. **两个测试文件**:两侧都是纯追加 → 全留,无一条丢弃。
   `AppToast.test.ts` 的 import 行自动合并出了 `vi`(master)+ `node:fs/path/url`(sp8),正确。
7. `--toast-warn-*` / `--toast-danger-*` 两组 token 在 `src/styles/theme.css` 里自动合并进来,无冲突。

---

## 6. 其余 10 个冲突的处置

| 文件 | 处置 |
|---|---|
| `src/router/index.ts` | 加行型。master 全部路由 + sp8 的 4 行(`/ai` redirect、`/ai/agent`、`/ai/settings`、`...knowledgeRoutes`)与 3 个 import。ai 段排在 photos 段之后、`/login` 之前 —— `index.test.ts` 用源码**行序**断言 photos 段「只追加不重排」,不能插在中间。 |
| `src/router/index.test.ts` | 加行型,两侧断言全留(`=======` 处补回一个 `})` 闭合 master 最后一条 `it`)。 |
| `vite.config.ts` | 见 §7 concern。 |
| `package.json` | 见 §7 concern。 |
| `pnpm-lock.yaml` | 按交办 `--ours` 后 `pnpm install` 重生成,未手工解。 |
| `docs/THEMING.md` | 加行型,例外清单表两侧行全留。 |
| `src/viteOptimizeDepsGuard.test.ts` | add/add,两版语义相同。**取 master 版** —— 它用 `/// <reference types="node" />`,sp8 版用逐行 `@ts-expect-error`;合流后 `@types/node` 已装,后者会变成 TS2578。 |
| `.superpowers/sdd/progress.md` | add/add。两份台账记的是**不同期次的不同工作**,不是同一文档的两个版本 → 整份保留、上下拼接(master 段 30 行 + 分隔说明 + sp8 段 1539 行),并写了注释说明为什么不是二选一。 |
| `src/i18n/zh_cn.ts` / `en_us.ts` | 三方切分,见 §2–§4。 |

---

## 7. 合流的连带修复(不是产品改动,是让四门能过)

1. **TS2578 × 57 行 / 19 个文件。** sp8 的测试里逐行写着
   `// @ts-expect-error -- 本仓未装 @types/node`,而 master 已把 `@types/node` 装进 devDeps,
   这些指令全部变成「未使用」→ `vue-tsc` 报 57 个 TS2578。
   处理:**只删紧贴 `import ... from 'node:*'` 的那一条指令**(脚本判定,不做全局删除),
   并把已经不成立的说明文字改掉。
2. **TS2339 × 7 处 / 3 个文件**(`PhotosPersonDetail` / `PhotosPlaces` / `PhotosSearch` 的测试)。
   它们解构 `showSpy.mock.calls[0]` 的第三参当 action 用,判别联合后 TS 无法收窄。
   处理:改成 `const action = typeof arg === 'string' ? undefined : arg` —— **真收窄,没用 `as` 断言**,
   每一条原断言一字未动。
3. **`src/i18n/__tests__/photosSlice.test.ts`**(SP7-P8b 的分片守卫)断言
   「出口 = base ∪ photos,不多不少」,加了 ai 之后必红。
   处理:把 ai 计入该断言(仍是「不多不少」,只是从两片变三片),并**补了一条「三片两两不相交」**。
   ai 分片自身的前缀/反向引用守卫留给 T4,本文件只做必要修正。
4. **`src/i18n/messageSyntax.test.ts`** 的全表撞车扫描原本钉死 21 对,合流后扫出 **27 对**。
   多出的 6 对不是新写的文案,而是**合流让 locale 表变大**才第一次可见(aiKb* 撞上 master 侧
   相册/存储的键)。该测试自己的纪律就是「新出现的单轴撞车必须登记,不许静默出现」,
   所以**逐条登记进 `divergent` 表**并更新计数(21→27、zh 1→2、en 20→25)。
   6 对已核实际取值,全部与已登记的同型且分歧方向正确:
   ```
   aiKbAlDeleteFailed vs raidRemoveFailed   zh 同「删除失败」 en: Delete failed / Failed to delete array
   aiKbAlFileTypes    vs photosSearchFileType zh 同「文件类型」 en: File types / File type
   aiKbWkOpRenamed    vs photosPersonMenuRename / photosPlacesSpotRename / photosSvRename
                                            zh 同「重命名」   en: Renamed / Rename
   aiKbWkOpRemoved    vs raidMemberRemoved   en 同「Removed」  zh: 已删除 / 已移除
   ```

---

## 8. 🔴 Concerns(需要协调者拍板/知悉)

1. **`package.json`:交办只列了 4 个 tiptap 依赖,sp8 实际有 7 个。**
   漏掉的是 `dompurify ^3.4.12`、`@types/dompurify ^3.2.0`、**`sass ^1.101.6`**。
   `sass` 尤其关键 —— AI 区大量 `.scss`(`tokens.scss` / `sk-shared.scss` 等),缺它构建直接失败。
   **我把 7 个全部并入了。** 版本按 sp8 分支实测值(`^2.27.2` / `^0.8.10`),
   确认**不是**治理文档那个错的 `^0.6.1`。
2. **`vite.config.ts` 的 dev 端口:我按交办保留了 sp8 的 `5288`,但它与仓库现有约定冲突。**
   `CLAUDE.md` 写的是 `pnpm dev → http://localhost:5273/app/`,master 侧原值也是 5273;
   5288 原本是 `.sp8` 那条并行线的专用端口,而 T3 之后 SP8 这条线就并回主干了。
   转发规则我取了 master 的 `DEV_PROXY`(`^/(?!app/)` 带 ws)—— 它是 sp8 那四条
   (`/v1`、`/v2`、`^/$`、静态目录)的**严格超集**,所以 sp8「在该端口走 Vue2 登录拿 token
   再进 `/app/#/ai/*` 验收」的能力一条不少。`host: true` 取自 sp8,`preview` 块保留 master 的。
   **请确认端口以哪个为准** —— 改回 5273 只需动一行,已在配置里留了 ⚠️ 注释。
3. **基线口径三处不符**(链接漂移 / 3 条而非 2 条 / 失败根因是任务目录本身),详见 §1。
   其中「跑测试前必须先 `pnpm install`」这条建议写进后续任务的前置步骤。
4. **brief 的 i18n 取数脚本有两个盲区**(字符串里的 `/*`、引号键),会给出错误且看起来很干净的结论。
   §2 的修正版扫描器留在 `/tmp/p6i18n/scan.cjs` + `scan2.cjs`,建议 T4 沿用而不是重写。
5. **`.superpowers/sdd/progress.md` 我做的是「上下拼接」**,没有做内容层面的归并/去重。
   如果协调者希望它是一份统一叙事的台账,需要另外整理。

---

## 9. 结束时 `git status --short`(3 个 design-export 删除已恢复)

```
 D "design-export/Audio Speaker Segmentation.html"
 D design-export/audio-waveform-design-kit.html
 D design-export/design-final.html
```

**不多不少,3 行,与开工时逐字一致。**

> 说明:开工时这 3 个是 **` D`(第二列 D)= 工作树删除、未暂存**,不是 brief 写的「staged 删除」。
> 因此恢复用的是 `rm`(把文件从工作树删掉)而**不是** brief 给的 `git rm --cached` ——
> 后者会产生 `D ` + `??` 两种状态,与开工时不同。合并提交 `261bebd` 未包含 design-export 的任何改动。

---

## 10. 四门实际输出尾部(原文)

**vitest 基线(master,`pnpm install` 之后):**
```
 Test Files  3 failed | 473 passed (476)
      Tests  1 failed | 6181 passed | 69 skipped (6251)
   Duration  103.68s
```

**vitest 合流后(最终,临时自证用例已删):**
```
 Test Files  3 failed | 597 passed (600)
      Tests  1 failed | 9833 passed | 69 skipped (9903)
   Duration  141.69s
 FAIL  oss/media-wave.test.mjs [ oss/media-wave.test.mjs ]
 FAIL  oss/tree.test.mjs [ oss/tree.test.mjs ]
 FAIL  oss/export-rsync.test.mjs > 导出落盘:node_modules 保留、dist 照常清空 > ...
```
→ 与基线**同样 3 个文件、同样 1 个用例、同样根因**;新增 124 文件 / 3652 用例**零失败**。

**vue-tsc:**
```
exit=0    (grep -c 'error TS' = 0)
```

**build:**
```
dist/assets/index-D5do4H4U.js   7,316.17 kB │ gzip: 2,051.08 kB
(!) Some chunks are larger than 500 kB after minification. Consider: ...
✓ built in 16.80s
exit=0
```

**i18n parity 与分片守卫:**
```
 Test Files  7 passed (7)
      Tests  184 passed (184)
```
