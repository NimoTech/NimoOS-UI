# SP9 台账 — 00 基线（spec §9.4 第 5 条）

> 本目录 gitignore,不进 git。重要结论必须同步回 `NimoOS-UI/docs/vue3-migration-roadmap.md` §4 SP9(SP7 台账整目录丢失的教训)。

## 工作树决定(2026-07-31,用户拍板)

spec §9.5 写明「P0 开工前是唯一无成本的切换点」。开工前询问用户,用户选择**单开 worktree**,推翻 spec 里「主工作区 master」的原安排。

| 项 | 值 |
|---|---|
| New-UI 工作树 | `/home/nimo/NimoTech/.sp9/NimoOS-New-UI` |
| Service 工作树 | `/home/nimo/NimoTech/.sp9/NimoOS-Service` |
| 分支(两仓同名) | `sp9-final-views` |
| New-UI 分支点 | `fff20e5` (master, `docs(sp9): 按新交付政策重写 spec`) |
| Service 分支点 | `425f4f0` (master, `feat(raid): RaidMemberDisk 增加可选 slot 字段`) |

**后果:spec §9 的并发对策大部分降级为「可选」。**

- §9.2 🔴 同文件同工作树静默覆盖 → **归零**(时间机器在 `NimoOS-New-UI` 主工作树,与本分支不共享 index/HEAD)。
- §9.5 残余风险(`router/index.ts` ×2、`main.ts` ×1、`package.json`+lock ×1)→ **归零**,改为将来合并 master 时的正常 git 冲突(看得见、会报冲突)。
- §9.3 的 i18n / theme 分片**仍然照做**:它的第二重收益(减小与 sp7/sp8 的合并足迹)不依赖工作树隔离,依然成立。
- §9.4 第 7 条「显式 pathspec 提交」**仍然照做**:本工作树 index 干净,但纪律保留、成本为零。
- §9.4 第 8 条「不碰 `src/files/**`」**仍然照做**:时间机器落在那里,将来要合并。
- §9.4 第 5 条「相对基线不新增红」→ 因基线全绿,实际判定回到**全绿**。

## 基线(`.sp9/NimoOS-New-UI` @ `fff20e5`,2026-07-31)

```
pnpm exec vue-tsc --noEmit   → exit 0,零错误
pnpm test                    → Test Files 261 passed (261)
                               Tests      1853 passed (1853)
```

主工作树 master 同一 commit 同时跑过一次,数字一致(261 / 1853),确认基线不是工作树差异造成的。

**判定标准:此后每期任务门要求 tsc 零错误 + 1853 起步只增不减、零失败。**

## 环境搭建记录

```bash
git worktree add /home/nimo/NimoTech/.sp9/NimoOS-New-UI  -b sp9-final-views   # 从 NimoOS-New-UI
git worktree add /home/nimo/NimoTech/.sp9/NimoOS-Service -b sp9-final-views   # 从 NimoOS-Service
cd .sp9/NimoOS-Service  && pnpm install && pnpm build
cd .sp9/NimoOS-New-UI   && pnpm install     # file:../NimoOS-Service 解析到 .sp9/NimoOS-Service ✅
```

验收 dev server 端口:**5299**(spec §10;避开 5273 默认 / 5277 sp7 / 5288 sp8)。

## spec 与 Vue2 源码的三处出入(P0 范围内,已核对源码)

核对对象:`NimoOS-UI/src/components/settings/SettingsPanel.vue`(3095 行)。

### 出入 1 —— tab rail 是 7 项,不是 9 项

spec §4.1 写「tab rail:9 项」。Vue2 `data().tabs`(L855-863)只有 **7** 项:
`general · storage · network · apps · terminal · system-status · folder-permissions`。
`visibleTabs`(L1034)对**非 admin** 过滤掉 `folder-permissions` → 非管理员看到 6 项。

另外两个 tab 不在 rail 上:

- `account` —— 入口是侧栏**顶部的用户块**(头像+昵称,L13-20 `@click="currentTab = 'account'"`)。
- `developer` —— 入口是 **general 页内的一行**(L315 `@click="currentTab = 'developer'"`),**没有任何"开发者模式开关"门控**,那一行常驻可见。spec §4.1「只在开发者模式开启后出现」与源码不符。

**处置(界面 1:1 优先)**:P0 做 **9 条 tab 路由 + 9 个空骨架**,但 rail 只渲染 7 项(非 admin 6 项);`account` 走用户块;`developer` 走 general 骨架内的入口行。9 个 tab 全部可达,与 Vue2 完全一致。

### 出入 2 —— `.scss` 改 `.css`

spec §4.1 指定 `src/settings/styles/settings.scss`。但本仓库 **`sass` 未安装、全仓零 `.scss` 文件**,样式一律手写 CSS + scoped `<style>`。用 `.scss` 会为了一个文件新增构建依赖,与 §4.4 / §9.3「依赖只装一次(只装 novnc)」直接冲突。

**处置**:落 `src/settings/styles/settings.css`(纯 CSS)。

### 出入 3 —— 「窄屏行为对齐 Vue2 面板」无对齐对象

spec §4.1 要求「窄屏行为对齐 Vue2 面板」。Vue2 `SettingsPanel.vue` **整文件零 `@media`** —— 它是固定尺寸模态,没有窄屏行为可对齐。

**处置**:按 New-UI 同类外壳 `src/storage/components/StorageShell.vue`(SP6,已实盘验收)的窄屏写法自定;这本就在授权偏离 #2(模态→路由页)的覆盖范围内。

## P0 额外发现(spec 未提)

`src/styles/color-guard.test.ts` L64 只跳过 `styles/theme.css`。新建的 `styles/theme.sp9.css` 是 **token 定义文件**,必然含裸颜色字面量 → **不把它加进跳过名单,color-guard 立红**。这是 §4.3 分片接线的必要组成部分,已并入 P0 任务 1。
