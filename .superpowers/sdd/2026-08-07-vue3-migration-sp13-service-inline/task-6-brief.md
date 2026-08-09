## Task 6: 收尾 —— 全部验收门 + Vue2 零影响 + 更新路线图

**Files:**
- Modify: `../NimoOS-UI/docs/vue3-migration-roadmap.md`（阶段总表 SP13 行 + §4 SP13 段的四个勾）
- Test: 全部六道门

**Interfaces:**
- Consumes: Task 2–5 的全部产出
- Produces: 一份可粘给机主的验收结论

- [ ] **Step 1: New-UI 三道门**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
pnpm test 2>&1 | tail -6
pnpm exec vue-tsc --noEmit && echo "tsc ✅"
pnpm build 2>&1 | tail -5
```

判据：0 failed · `Tests` = Task 2 记的基线 + 377 · tsc 0 错 · build ✓。

- [ ] **Step 2: 开源面门**

```bash
pnpm exec vitest run oss/ 2>&1 | tail -8
```

- [ ] **Step 3: Vue2 零影响验证**

```bash
cd /home/nimo/NimoTech/NimoOS-UI
git status --short | head          # 期望:除既有脏文件外,本期没碰过它
pnpm build 2>&1 | tail -5
```

判据：Vue2 仍能构建（它继续吃独立仓 `NimoOS-Service`，`file:../NimoOS-Service` 那条依赖本期一个字没改）。

- [ ] **Step 4: 确认外部仓真的可以不在场（内联是否彻底）**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
grep -rn "NimoOS-Service" package.json pnpm-lock.yaml vite.config.ts tsconfig.json || echo "✅ 构建配置里零引用"
```

期望 `✅` —— New-UI 的构建配置里不该再出现 `NimoOS-Service` 这个名字。
（`CLAUDE.md` 与 `packages/service/**` 里的**文字提及**是有意保留的说明，不算引用。）

- [ ] **Step 5: 更新路线图 —— 阶段总表 SP13 行**

`../NimoOS-UI/docs/vue3-migration-roadmap.md` 第 63 行：

```diff
-| **SP13** 共享包内联 New-UI | 由 SP10-T3 机主拍板(2026-08-07)派生:New-UI 把 `@nimotech/nimoos-service` 内联进自己仓库、只依赖仓内那一份;**Vue2 继续依赖原来的独立包**,两侧从此各自演进 | M | ⬜ **与 SP11/SP12 无依赖,可任意穿插** |
+| **SP13** 共享包内联 New-UI | 由 SP10-T3 机主拍板(2026-08-07)派生:New-UI 把 `@nimotech/nimoos-service` 内联进自己仓库、只依赖仓内那一份;**Vue2 继续依赖原来的独立包**,两侧从此各自演进 | M | ✅ **T1-T6 全部关账(填执行当天日期,格式 2026-MM-DD)**;包落 `packages/service/`(源自 Service@`ac39cd7`)、入口指 TS 源码、`optimizeDeps.exclude` 与 `server.deps.inline` 两处补丁已删;导出流水线改为只 archive 一个仓;**未部署未推 origin** |
```

- [ ] **Step 6: 更新路线图 —— §4 SP13 段落**

第 1119-1128 行那四个 `- [ ]` 逐条改 `- [x]` 并补实测结果。**至少写清这四件事**（都是计划执行中查实、与原文不符的）：

- spec 说要补 `.gitignore` 的 `packages/service/dist` —— **不用**，根 `.gitignore` 的裸 `dist` 已匹配任意层级
- `NimoOS-Service` 仓**既无 README 也无 CLAUDE.md**，T4 的"加一句"实为新建文件
- 实际的 `JSDOM_RED_FILES` 是哪几个（或"一个都没红"）
- `include: ['axios']` 最终留没留（Task 3 Step 8 的实测结论）

- [ ] **Step 7: 提交路线图（带 pathspec）**

```bash
cd /home/nimo/NimoTech/NimoOS-UI
git add docs/vue3-migration-roadmap.md
git commit -m "docs(roadmap): SP13 共享包内联关账

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- docs/vue3-migration-roadmap.md
```

- [ ] **Step 8: 向机主汇报**

一张表报六道门的实际数字（不是"应该通过"，是实际输出），外加 Task 4 的漂移取证结论。
明确说清**未部署、未推 origin**（本期不含这两件事）。

---

## 取证留痕

> 2026-08-07 执行记录（无头 chromium + CDP 实测，非 curl）。

**改的文件与那一行**：`packages/service/src/sys.ts` 文件末尾追加
`console.log('[SP13-取证] packages/service 的改动无需构建即生效')`（用 `cat >>`
就地写，不走 rename，全程未跑 `pnpm build`/`pnpm install`/`--force`，直到中途一次事故性
`pnpm install`，见下方"硬链接陷阱"一节）。

**驱动方式**：本机未装 playwright 包，但 `~/.cache/ms-playwright/chromium-1228/` 有真
chrome 二进制。用 `--headless=new --remote-debugging-port=9333` 起它，手写 CDP 客户端
（`ws@8.21.0` 从 `node_modules/.pnpm/` 直接 require，未装顶层 `ws`）驱动
`Page.navigate/reload`、`Runtime.evaluate`、`Runtime.consoleAPICalled`/`Log.entryAdded`
订阅。脚本留在 scratchpad（`cdp.mjs`/`cdp-hardreload.mjs`/`cdp-disablecache-test.mjs`/
`cdp-clear.mjs`），未写入仓库。

**是否需要登录**：需要。空 token 落在 `#/login`。往 `localStorage` 塞了
`access_token`/`refresh_token`/`version`/`user` 四项（**特别带上 `version`**——
`src/router/guard.ts` 有 token 但缺 `version` 会被判"半初始化"，清 token 打回登录页），
才能放行到首页小组件区。本机没起任何后端服务（`dev-up.sh --status` 确认无进程），
小组件发的请求全部 401/连接失败，触发 `onAuthFail` 清 token 打回登录页——这是网络层
的预期表现，不是 JS 报错；全程控制台**没有出现任何 `is not a function` 类脚本错误**，
Step 2 的"页面正常加载"判据成立。

**主判据实测（改包源码 → 重启 dev server → 生效）**：

| 步骤 | 操作 | 控制台出现 `[SP13-取证]`？ |
|---|---|---|
| 1 | 清浏览器缓存 + 打开页面（无探针，基线） | 否（0 次，符合预期） |
| 2 | 就地追加探针，**不重启** dev server，硬刷新（`ignoreCache:true`，排除浏览器缓存干扰） | 否（0 次——证明"不重启不生效"这条卡在 Vite 进程内 transform 缓存，不是浏览器缓存） |
| 3 | **重启一次** `pnpm dev`（`Ctrl-C` 等效 `kill` + 重新 `pnpm dev`，未加 `--force`，未删 `.vite`，未跑 `pnpm install`） | — |
| 4a | 同一个早就打开过该页面的 tab，**普通刷新**（等效 F5，缓存默认开启） | **否**（0 次——见下方"意外发现"） |
| 4b | 同一个 tab，**硬刷新**（`Page.reload({ignoreCache:true})`，绕开浏览器缓存） | **是**（1 次，原文 `[SP13-取证] packages/service 的改动无需构建即生效`） |

**主判据结论**：`packages/service` 内联后"改源码 → 重启 dev server（不 build/不清 `.vite`/
不 `pnpm install`）→ 拿到新代码"这条链路本身成立——**前提是发起的是一次真实网络请求**
（curl,或浏览器硬刷新/绕开缓存）。4a/4b 的对照证明这条链路本身没问题，卡的是另一层。

**⚠️ 意外发现（超出 brief 字面要求，但直接关系到"重启即生效"这句话对真实开发者管不管用）**：

对同一个 URL（`.../nimoos-service/src/sys.ts?v=4539fc70`）实测响应头：

```
Cache-Control: max-age=31536000,immutable
```

这个 `?v=` 查询串是 Vite 给"从 `node_modules` 解析到的依赖"统一打的版本号，取自
deps-optimizer 的元数据哈希，**不是按单文件内容算的**——编辑 `packages/service/src/` 下
任意文件、甚至反复重启 dev server，只要 `vite.config.ts`/`pnpm-lock.yaml` 没变，这个
`?v=` 值就不变（本次从头到尾全程是 `4539fc70`）。于是：**任何已经加载过这个 URL 的浏览器
tab，普通刷新（F5）会被浏览器自己的磁盘缓存挡住，永远拿不到新内容**，需要硬刷新
（Ctrl+Shift+R / DevTools "Disable cache" 勾选后刷新 / 清缓存）才能看到。补测："disable
cache"（DevTools 常开的那个勾选框，`Network.setCacheDisabled(true)`）+ 普通刷新 = 0 次
（正确反映最新代码）——所以这不是无解,常年开着 DevTools 且勾了 disable cache 的开发者
不受影响，但"什么都不勾、只是刷新页面"的最朴素工作流会被卡住。这条与 Task 3 报告的
"exclude 恢复后重启即生效"结论**不矛盾**（那条结论用 curl 验证,curl 没有浏览器磁盘缓存
这层),只是补上了 curl 测不出来、必须真浏览器才能测出的这一层。是否要把这条写进
`CLAUDE.md`/`vite.config.ts` 注释,留给控制器裁定,本任务未越权去改。

**⚠️ 硬链接陷阱：本次执行中"实测复现"了一次（不是纸上谈兵）**。清理探针时先用了
`sed -i '$d'`（GNU sed 的 `-i` 默认是"写临时文件再 rename"），仓库侧 `sys.ts` 换成了
新 inode（`2516054`），而 `.pnpm` 那份镜像还停在旧 inode（`2516052`，内容里还带着探针）——
两侧就此断开，`git diff` 显示仓库侧已清空但 `.pnpm` 镜像仍是带探针的旧内容。跑一次
`pnpm install` 后两侧 inode 重新一致（`2516054`），镜像内容也跟着变回干净。**之后的还原
改用 `git show HEAD:packages/service/src/sys.ts > packages/service/src/sys.ts`**（shell
`>` 重定向是 `O_TRUNC` 就地写、不 rename），验证 inode 前后不变——这条路径是安全的，
`cat >>` 追加同理安全，`sed -i`/多数编辑器"保存"不安全。

**还原后 `git status packages/service`**：干净（`git status --short packages/service`
无输出，`git diff --stat -- packages/service` 无输出）。dev server 与无头 chromium 均已
停止，端口 5273/9333 收尾时均为空闲。

---

## 本期明确不做

- **不部署**（`./scripts/deploy.sh` 不跑）· **不推 origin** —— 与 SP9/SP10 的惯例一致，推送由机主手动做。
- **不建 `pnpm-workspace.yaml`** —— `file:` 依赖已经够用，引入 workspace 会改变 pnpm 的提升行为，是本期范围外的风险。
- **不动 Vue2 一行代码** —— 它继续吃独立仓。
- **不合并两侧的 service 源码** —— 分叉是本期的目的，不是副作用。
- **不删 `NimoOS-Service` 仓。**
