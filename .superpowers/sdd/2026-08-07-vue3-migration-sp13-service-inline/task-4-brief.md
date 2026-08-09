## Task 4: 漂移根治的正向取证（本期核心收益，必须单独证）

**Files:**
- Modify（**临时，当场还原**）: `packages/service/src/sys.ts`
- Test: 人工在浏览器 / dev server 日志上观察

**Interfaces:**
- Consumes: Task 3 的成品
- Produces: 一段可复述的取证记录，写进本计划下方的「取证留痕」小节

**为什么单独立一个任务：** 测试一直走源码、**本来就绿**，`pnpm test` 全绿证明不了这条坑被修好。这条坑从来只在 dev server 上现形。同理见 SP10-T4 的判据修正 —— **主判据必须落在生效载体上**，不能用一个"无论如何都成立"的间接指标充数。

- [ ] **Step 1: 起 dev server**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm dev
```

- [ ] **Step 2: 浏览器打开并确认页面正常**

`http://localhost:5273/app/` —— 登录进去，随便进一个会发请求的页面（首页小组件即可）。控制台不该有 `is not a function` 这类错误。

- [ ] **Step 3: 在包源码里插一个可观察的改动，只存盘、不构建**

> **⚠️ 2026-08-07 判据修订(机主拍板，见 spec §6)**：本 Step 原文只说"存盘"，隐含"不重启也该生效"。
> Task 3 修复轮 + 控制器独立复现，两轮实测都证明**这个隐含前提是错的**——Vite 的文件 watcher
> 默认忽略 `node_modules/**`，而这个包正是经 `node_modules/.pnpm/@nimotech+nimoos-service@.../src/*.ts`
> 路径服出去的，dev server 进程存活期间不会自动感知源码变化。**存盘之后还要重启一次 dev server**
> 才能看到，Step 4 的期望已同步改写，别再照原文验收成"存盘立刻生效"。

`packages/service/src/sys.ts` 顶部加一行：

```ts
console.log('[SP13-取证] packages/service 的改动无需构建即生效')
```

存盘。**不跑 `pnpm build`，不跑 `pnpm install`，什么都不做。**

- [ ] **Step 4: 看浏览器 → 若没出现，重启 dev server 再看**

先看浏览器控制台：**多数情况下不会立刻出现**（这是正常的，见上方 Step 3 的修订说明，不是失败）。

`Ctrl-C` 停掉 dev server，`pnpm dev` 重新起一次（不用 `--force`、不用清 `.vite` 缓存、不用
`pnpm install`），刷新浏览器页面。

期望：**重启后**浏览器控制台出现 `[SP13-取证] …`。

**这就是主判据（2026-08-07 修订版）：改包源码 → 重启一次 dev server → 生效，不需要
`pnpm build` / 清 `.vite` 缓存 / `pnpm install`。** 内联之前，这一步必须先
`cd ../NimoOS-Service && pnpm build`、且因为预打包缓存**即便 build 了、即便重启 dev server，
也可能仍看不到**（预打包缓存的失效判据是 lockfile / 版本号，不看内容）——这才是本期真正要
根治、且已经根治的那部分；"存盘不重启也生效"从来不是能拿到的收益，原计划这里写错了。

若重启之后**仍然**看不到（`stat -c '%i %n' packages/service/src/sys.ts` 与 `.pnpm` 里对应
文件的 inode 不一致），大概率是硬链接被原子写断开了——跑一次 `pnpm install` 重新链上，
再重启 dev server。详见 `CLAUDE.md`「共享 service 包」节的"硬链接陷阱"。

- [ ] **Step 5: 还原**

删掉那行 `console.log`，存盘，确认浏览器控制台不再出现它。

```bash
git status --short packages/service    # 期望空 —— 改动已还原干净
```

- [ ] **Step 6: 停 dev server，把取证结果记进本计划的「取证留痕」小节**

本任务**不产生提交**（Step 5 之后工作树应当是干净的）。

---

