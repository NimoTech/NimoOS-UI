# P5d · T10 评审(独立复核,不采信实现者断言)

评审者坐标:只读核查,`/home/nimo/NimoTech/.sp8/NimoOS-New-UI`,分支 `sp8-ai`,
BASE `19fa973` → HEAD `be72e95`(核查全程 `git status` clean,HEAD 未变)。

## 两个独立判定

1. **规格符合(计划书 §T10 1–7 条)**:✅ **符合**。
2. **任务质量**:✅ **通过**。

## 🔴 构建管线门 —— 自己复现三步

1. **当前(改后)**:`rm -rf dist && pnpm build` → `grep -o "kn-inbox-chev\|NotesMarkdownEditor" dist/assets/*.js`
   → **命中**(`index-2bWjG7-r.js`,主 chunk 3,723.76 kB,与报告数字逐字节一致)。
2. **临时撤掉反转**(`cp` 备份 `knowledgeRoutes.ts` → sed 行首锚定删 `import NotesView` 行 + 把
   `component: NotesView` 改回 `component: KnowledgeDeferred` → 注入落盘先核实 `diff`)→
   `rm -rf dist && pnpm build` → 同判据 **搜不到**(`grep exit=1`,主 chunk 缩回 **3,328.31 kB**,
   与报告「改前」数字逐字节一致——这是独立证据链而非巧合)。
3. **`cp` 备份覆盖还原** → `md5sum` 逐字节比对一致 → 再 `rm -rf dist && pnpm build` → **恢复命中**;
   全程未用 `git checkout`/`restore`;`git status` 全程干净,HEAD 全程 `be72e95`。

**判据是否真上下文感知**:自己核了两处命中的上下文——
`_hoisted_17$2={class:"kn-inbox-chev"}`(Vue 编译器 hoist 出的静态 class 字面量)与
`{__name:"NotesMarkdownEditor",props:...}`(`<script setup>` 编译产出的组件 `__name`)——
两者的形态只能来自真实编译代码,压缩产物里抽样搜 `//`/`/*` 命中的全是字符串里的
URL/正则(`https://`、`\/\//`),无一例真注释,故本仓压缩产物里不存在「注释撞子串」这条风险路径,
判据成立。**CSS 侧未混同**:报告明确注明另跑的 `.css` grep 命中「不作为本刀 JS 可达性证据」,
逐字属实(承 E-8)。

## 有没有用例被悄悄删/改弱

**逐条对比结论:没有。** `deferred.test.ts` / `knowledgeRoutes.test.ts` 改前改后各自的
`it(` 真实块数(排除注释)均为 **3 / 3**,无新增无删除,只有各自最后一条 `it` 的标题与断言内容
被替换(严格追加:`notes` 新增正向断言 + `toEqual`/`toHaveLength` 从 5 项收窄到 4 项,
且收窄方向与「`notes` 从 stillDeferred 移入 migrated」完全对应,不是弱化)。
**机制钉子用例(`isDeferred 的判定来源是 DEFERRED_TABS 本身`)一字未动**——`git diff` 未触及该行,
仅因前方插入注释整体下移(`:60-69`→`:80-89`),内容逐字比对一致。

**机制钉子变异结果**:把 `isDeferred` 硬编码 `return false` → 重跑 `deferred.test.ts` →
**机制钉子用例与「对每个已列 tab 返回 true」用例双双报红**(`2 failed | 1 passed`)。
还原(`cp` 覆盖 + md5 比对一致)后重跑 → **3 passed**。证明该用例仍是活的断言,不是空壳。

## 路由改回占位 → 断言是否报红(反转有守卫的证明)

把 `knowledgeRoutes.ts` 的 `notes` 改回 `KnowledgeDeferred`(同上临时撤法)→
`vitest run knowledgeRoutes.test.ts` → **精确报红在 `notesChild` 那一行**
(`expect(notesChild?.component).toBe(NotesView)` 收到 `KnowledgeDeferred`)。
还原后重跑 `knowledgeRoutes.test.ts` + `deferred.test.ts` → **2 files / 6 tests 全绿**。
**结论:反转有真实守卫,不是只改文案。**

## 收官六个数字(自己实测,附命令)

| 项 | 实测值 | 命令 | 与报告一致 |
|---|---|---|---|
| 文件数 | **331** | `pnpm test` → `Test Files 331 passed (331)` | 一致 |
| 用例数 | **3958** | `pnpm test` → `Tests 3958 passed (3958)` | 一致 |
| `.vue` | **182** | `find src -iname "*.vue" \| wc -l` | 一致 |
| color-guard +3 | 3 个新 `.vue` 均在清单 | `grep -n "NoteEditPane.vue\|NotesMarkdownEditor.vue\|NotesView.vue" src/ai/styles/knowledgeStyles.test.ts` → 三处命中(`:1034/:1035/:1042`) | 一致 |
| `aiKb*` | **387 / 387**(zh/en) | 临时 vitest 文件(真实 `import zh from '../../i18n/zh_cn'`)`Object.keys(zh).filter(k=>k.startsWith('aiKb')).length` → 387,en 同;跑后 `rm` 删除,`git status` 干净 | 一致 |
| 全表键数 | **1595 / 1595**(zh/en) | 同上真实模块导入 `Object.keys(zh).length` / `Object.keys(en).length` | 一致 |

`vue-tsc --noEmit` exit=0,`pnpm build` exit=0(现状 + 撤反转 + 还原三次构建全部独立复现,退出码均 0)。

## 授权外文件零改动核实

`git diff --name-only 19fa973..be72e95 -- src/` → 只有 4 个文件:
`deferred.ts` / `deferred.test.ts` / `knowledgeRoutes.ts` / `knowledgeRoutes.test.ts`。**核实通过。**

`deferred.ts` 文件头四项占位归属:**都点名**——`'search' → **P5e**`;
`'wiki' / 'roots' / 'allowlist' → **P5f**`,原文在文件头新增段落里,逐字与报告引用一致。

`git diff 19fa973..be72e95 -- src/` 里搜色字面量(`#hex`/`rgba`/`hsla`)与新增 `any`:
**均零命中**。

## 发现

无 Critical / Important / Minor 项。

## ⚠️ 无法核验项

- 无法核验「协调者实测的 3958 基线」本身是否正确(只能核 T10 前后差值为 0,与本刀 diff 逐 it 块比对吻合);
  基线数字本身来自上一刀(T9)收官,不在本刀评审范围内。
- 未做真机导航验收(点击路径 / 深链 URL 未实际打开浏览器验证)——本次任务仅授权只读核查 dev server,
  未 kill/重启任何服务,也未验证真实笔记 `.md` 文件读写行为,该项按 brief 属于「协调者后续验收清单」。
