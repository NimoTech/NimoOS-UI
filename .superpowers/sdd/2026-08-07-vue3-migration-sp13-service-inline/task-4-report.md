# Task 4 报告：漂移根治的正向取证（真浏览器）

状态：**DONE**（原始执行 + 修复轮 1/5 均完成）。

两个 commit（均 `NimoOS-New-UI`）：
- `5c30d6c` —— 原始执行：填「取证留痕」小节并勾选 Task 4 六个 Step
- `5d69067` —— 修复轮 1/5：`CLAUDE.md` 补第三条警告 + spec §6 补第三次判据修订

---

## 一、驱动方式

本机未装 `playwright` 包，但 `~/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`
是真 Chrome for Testing 149.0.7827.55 二进制。用
`--headless=new --disable-gpu --no-sandbox --remote-debugging-port=9333` 起它，手写
CDP 客户端驱动（`ws@8.21.0` 从 `node_modules/.pnpm/ws@8.21.0/node_modules/ws/index.js`
直接 `require`，因为顶层 `ws` 在本仓不可解析）。用到的 CDP 方法：`Page.navigate` /
`Page.reload`（`ignoreCache: true|false`）、`Runtime.evaluate`（写 localStorage / 读
`location.hash`）、`Network.clearBrowserCache` / `Network.setCacheDisabled`、订阅
`Runtime.consoleAPICalled` + `Log.entryAdded` 抓控制台输出。脚本留在 scratchpad
（`cdp.mjs` / `cdp-hardreload.mjs` / `cdp-clear.mjs` / `cdp-disablecache-test.mjs`），
未写入仓库。

## 二、是否需要登录

需要。空 `localStorage` 落在 `#/login`。塞了四项：`access_token` / `refresh_token` /
`version` / `user`（**特别带上 `version`**——缺它 `src/router/guard.ts` 判"半初始化"，
会清 token 打回登录页，是本仓已知坑）。本机没起任何后端（`dev-up.sh --status` 确认无
进程），首页小组件的请求全 401/连接失败，触发 `onAuthFail` 清 token 打回登录页——这是
预期的网络层表现，不是 JS 报错。全程控制台**没有出现任何 `is not a function` 类脚本
错误**，Step 2 的"页面正常加载"判据成立。

## 三、主判据实测（改包源码 → 重启 dev server → 生效）

| 步骤 | 操作 | 控制台出现 `[SP13-取证]`？ |
|---|---|---|
| 1 | 清浏览器缓存 + 打开页面（无探针，基线） | 否（0） |
| 2 | 就地追加探针，**不重启**，硬刷新（`ignoreCache:true`，排除浏览器缓存干扰） | 否（0 —— 证明"不重启不生效"卡在 Vite 进程内 transform 缓存，不是浏览器缓存） |
| 3 | **重启一次** `pnpm dev`（`kill` + `pnpm dev`，未 `--force`，未删 `.vite`，未 `pnpm install`） | — |
| 4a | 同一个早就打开过该页的 tab，**普通刷新**（等效 F5，缓存默认开启） | **否**（0 —— 见下方"意外发现"） |
| 4b | 同一个 tab，**硬刷新**（绕开缓存） | **是**（1，原文 `[SP13-取证] packages/service 的改动无需构建即生效`） |
| — | 移除探针 → 重启 → 普通刷新（缓存开启） | 仍是 **1**（旧缓存内容） |
| — | 移除探针 → 重启 → DevTools disable-cache + 普通刷新 | **0**（正确反映移除） |
| — | 移除探针 → 重启 → 硬刷新 | **0**（正确反映移除） |

**结论**：链路本身成立（重启一次 dev server 就能让 Vite 服出新内容），**前提是发起的是
一次真实网络请求**（curl、硬刷新、DevTools disable-cache、或从未加载过该 URL 的全新
缓存状态）。已经加载过页面的 tab 做最朴素的 F5 会被浏览器磁盘缓存挡住。

## 四、意外发现（超出 brief 字面要求，但直接关系到"重启即生效"这句话管不管用）

对模块 URL（`.../nimoos-service/src/sys.ts?v=4539fc70`）实测响应头：

```
Cache-Control: max-age=31536000,immutable
Etag: W/"1a0c-7weYTjUbPQ2ioudOOxy4lWNdM0g"
```

`?v=` 取自 deps-optimizer 元数据哈希，不按单文件内容算——编辑 `packages/service/src/`
下任意文件、甚至反复重启，只要 `vite.config.ts`/`pnpm-lock.yaml` 不变，这个值就不变
（本次从头到尾全程 `4539fc70`）。**控制器独立复核并补了一层佐证**：控制器前后两次观察到
`?v=262bd7ea` → `?v=4539fc70`，变化恰好发生在 Task 3 修复轮改了 `vite.config.ts`
注释 + 跑了 `pnpm install` 之后——反证了"哈希跟 lockfile/config，不跟包源码内容"这个
判断。于是：已经加载过该页的 tab，普通 F5 会一直命中磁盘缓存，需要硬刷新
（`Ctrl-Shift-R`）/ DevTools "Disable cache" / 清缓存才行。这条与 Task 3 的"exclude 恢复
后重启即生效"结论**不矛盾**（那条用 curl 验证，curl 没有磁盘缓存这层），是补充。

## 五、硬链接陷阱——本次执行中"实测复现"了一次，不是纸上谈兵

清理探针时第一次用了 `sed -i '$d'`（GNU sed `-i` 默认写临时文件再 rename）。结果：
仓库侧 `packages/service/src/sys.ts` 换成新 inode（`2516054`），`.pnpm` 那份镜像还停在
旧 inode（`2516052`，内容里仍带着探针）——两侧就此断开，`git diff` 显示仓库侧已清空但
`.pnpm` 镜像仍是带探针的旧内容。跑一次 `pnpm install` 后两侧 inode 重新一致
（`2516054`），镜像内容也跟着变回干净。**之后的还原改用**
`git show HEAD:packages/service/src/sys.ts > packages/service/src/sys.ts`（shell `>`
重定向是 `O_TRUNC` 就地写、不 rename），验证 inode 前后不变——这条路径安全，`cat >>`
追加同理安全，`sed -i`/多数编辑器"保存"不安全。

## 六、还原与清理

- `git status --short packages/service` / `git diff --stat -- packages/service`：均空。
- dev server 与无头 chromium 进程均已停止（`pgrep` 确认无残留），端口 5273/9333 收尾
  时均空闲。

## 七、修复轮 1/5（本轮，响应控制器的复核结论）

控制器独立复核了上面第四节的"浏览器磁盘缓存"发现，判定属实，并补了 `?v=262bd7ea` →
`?v=4539fc70` 这层佐证（见上）。要求把这条写进永久文档（不只留在取证留痕里），并同步
spec 判据。**只改文档，未动代码**：

1. **`CLAUDE.md`「共享 service 包」节**：
   - 在"dev server 的实际生效方式"段落后新增一段**操作口诀**：改包源码 → 重启 dev
     server → 硬刷新浏览器；不需要 build/清 `.vite`/`pnpm install`；若硬刷新仍旧 →
     查硬链接。
   - 在既有"exclude 不要删""硬链接陷阱"两条 `⚠️` 警告之后，新增**第三条**
     `⚠️` 警告：症状（重启也没用、F5 按多少次都没用）→ 原因（`?v=<hash>` +
     `Cache-Control: immutable`，hash 取自 lockfile/config 不取自包内容）→ 处置
     （硬刷新 / DevTools disable-cache / 无痕窗口）→ 实测边界（重启前后硬刷新的
     A/B 对照，证明确实是"重启"在起作用不是缓存假象）。
2. **`docs/superpowers/specs/2026-08-07-vue3-migration-sp13-service-inline-design.md`
   §6 表格**：验收判据补上"硬刷新浏览器"这一步（原两版判据均保留删除线，不覆盖），
   下方追加**第三次判据修订**记载（前两次记载原样保留）。
3. **纪律核查**：未改 `vite.config.ts`（配置行一个字符没动，注释也没顺手改，因为
   Step 1/2 的落点是 `CLAUDE.md` 而不是 `vite.config.ts` 顶部注释——控制器指令里
   "注释可以顺手改准"针对的是 `vite.config.ts`，但本轮实际改动只落在 `CLAUDE.md`
   与 spec md 两个文件，未触碰 `vite.config.ts`，更严格地满足了"配置一个字符都别动"）。
   未碰 `oss/`、`src/**`、`packages/service/**`。未重跑三道门（没动代码）。
   `git status --short` 确认本轮提交前后，`.superpowers/sdd/.gitignore` /
   `README.md` / `oss/manifest.mjs` / 3 个 `design-export/*` 删除态 /
   `.superpowers/sdd/2026-08-07-vue3-migration-sp10-standalone-deploy/`（untracked）
   均原样未被本轮 add/commit。

新 commit：`5d69067`（`docs(sp13): 补第三条警告 —— 浏览器磁盘缓存(硬刷新才生效),控制器复核属实`）。
