# SP18 终端区 · 整支终审修复波报告(2 条 Important)

日期:2026-08-10 · 分支:`sp18-terminal`(worktree)· 一波修完两条。

## Finding 1 — submitPassword 无在途守卫 / 锁卡不禁用

### 改了什么
- `src/terminal/useTerminalSession.ts`
  - 新增 `const submitting = ref(false)`,并从 composable 返回对象导出。
  - `submitPassword` 入口守卫扩为 `if (frozenSeconds.value > 0 || submitting.value) return`;
    在第一个 `await` 之前**同步**置 `submitting.value = true`,`finally` 里复位。
- `src/terminal/TerminalLockCard.vue`
  - props 增加 `submitting: boolean`;密码输入框与解锁按钮的 `:disabled`
    改为 `submitting || frozenSeconds > 0`。
- `src/terminal/TerminalView.vue`
  - 解构出 `submitting` 并 `:submitting="submitting"` 透传给锁卡。

### 为什么这样设计
- 真正的去重放在 composable(逻辑层单一事实),组件禁用只是视觉半边——
  与冻结倒计时(429)的既有分工一致。
- 同步置位保证 Enter+点击这种同一 tick 的双 emit 第二发必然被挡:
  否则重复 POST 每次烧掉后端 5 次/15 分钟锁定配额中的一次(`_noAuthRetry`
  工作正是为防它),且两个并发提交共享一个 epoch,慢的旧响应(如迟到 403)
  可能覆盖新成功后的状态(把 ready 翻成 forbidden 而 keepalive 还在跑)。
- `finally` 复位使 429/403/5xx/网络错误各分支都不会把表单卡死。

### 既有「双 emit」组件测试的处置
`TerminalLockCard.test.ts` 的 “emits submit … on enter and on the unlock button”
**保持原断言不变**(仍然断言两次 emit),只补了 `submitting: false` 这个新必填
prop 并加注释说明:双 emit 是真实 UI 行为,去重在 composable。组件行为没有变化。

## Finding 2 — 锁屏上 JWT 过期是死路

### 改了什么
- `src/terminal/useTerminalSession.ts` 的 `submitPassword`:在调用
  `service.terminal.createSession(pw)` **之前**,读 `localStorage['expires_at']`
  (unix 秒,缺失/空串 → null),用 `shouldRefreshToken(expiresAt, Date.now())`
  (`src/util/tokenExpiry.ts`,60s 提前量、缺失保守刷新)判定;命中则
  `await refreshAccessToken().catch(() => {})` —— 失败吞掉,照常发 POST,
  错误面与今天一致。现场有英文注释解释这条 seam(锁屏无其他流量养 token、
  带密码的 401 有意跳过共享 refresh-replay)。

### expires_at 先例(取证结果,非猜测)
仓里已有三个消费者,格式一致(unix 秒,`Number(raw)`,缺失→null→保守刷新):
- `src/files/composables/useFileOps.ts:208-213`(下载前预刷新,首创)
- `src/files/drop/stores/drop.ts:81-84` + `serverConnection.ts:35-37`(Drop WS)
- `src/apps/console/TerminalPane.vue:25` + `src/apps/console/terminalSocket.ts:35`(容器终端 WS)

判定函数是共享的 `shouldRefreshToken`(tokenExpiry.ts 注释原话:「缺失(null)保守刷新;
已过期或 ≤60s 内过期则刷新」)。本修复直接复用同一函数、同一解析写法——
**没有走「无先例就永远刷」的 fallback**。

### 为什么是主动刷新而不是 401 重试
带错误密码的 401 重试会烧 2 次锁定配额;主动刷新发生在 POST 之前,
密码只发一次,正确/错误密码两种情况都不多烧配额。

## 测试证据

新增用例(全英文描述):
- composable(`useTerminalSession.test.ts`):
  - `ignores a second submit while the first is still in flight (double-submit guard)`
    —— deferred promise 挂住第一发,第二发不再打后端(`toHaveBeenCalledTimes(1)`),
    状态只由第一发落定;fresh expires_at 隔离刷新路径。
  - 新 describe `proactive token refresh before unlock` 四条:
    过期→刷新且严格先于 POST(invocationCallOrder)/ 缺失→保守刷新 /
    新鲜→不刷 / 刷新失败→提交照常成功。
  - service mock 增加 `refreshAccessToken`;beforeEach/afterEach 清理 `expires_at`。
- 锁卡(`TerminalLockCard.test.ts`):
  - `submitting disables input and button while a submit is in flight`。
- `TerminalView.test.ts` 的 service mock 补 `refreshAccessToken`(view→composable 现在引它)。

命令与计数(全部前台跑):
```
pnpm vitest run src/terminal/   # 5 files, 37 tests passed(修复前 31)
pnpm exec vue-tsc --noEmit      # 0 错误,无输出
pnpm test                       # 全量,见下(先 commit 再跑,oss 门要求已提交树)
```
全量结果(在提交 b50d995 的已提交树上跑):**695 test files / 11214 tests 全部通过**。
(stderr 里 jsdom "navigation not implemented" 噪音来自既有的
`src/photos/stores/__tests__/favorites.test.ts` exportZip 用例,与本波无关,用例本身通过。)
