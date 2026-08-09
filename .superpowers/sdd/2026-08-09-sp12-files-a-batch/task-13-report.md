# Task 13 报告: 删掉 `--tm-star` 死 token

## Step 1: 删前 grep

```
$ grep -rn "tm-star" src/
src/styles/theme.css:200:  --tm-star: rgba(255, 255, 255, 0.85);
src/styles/theme.css:545:  /* 时间机器 —— 浅色纸感:没有星空(--tm-star 透明),背景是米白 + 极淡光晕 */
src/styles/theme.css:550:  --tm-star: transparent;
```

三处命中,全在 `src/styles/theme.css`(两处定义 + 一处注释引用),零处引用/消费。与 brief 预期一致,未出现第三方引用,继续执行。

## Step 2: 删除 + 注释改写

**改动前后对照(深色主题块,原 :200 附近):**

```diff
     linear-gradient(160deg, #131a3a 0%, #0a0e21 45%, #05060f 100%);
-  --tm-star: rgba(255, 255, 255, 0.85);
   --tm-fg: #f1f5f9;
```

**改动前后对照(浅色主题块,原 :545-550 附近):**

```diff
-  /* 时间机器 —— 浅色纸感:没有星空(--tm-star 透明),背景是米白 + 极淡光晕 */
+  /* 时间机器 —— 浅色纸感:没有星空,背景是米白 + 极淡光晕 */
   --tm-bg:
     radial-gradient(ellipse at 26% 20%, rgba(59, 91, 219, 0.10) 0%, rgba(247, 245, 239, 0) 58%),
     radial-gradient(ellipse at 80% 80%, rgba(110, 90, 224, 0.08) 0%, rgba(247, 245, 239, 0) 58%),
     linear-gradient(160deg, #fbfaf6 0%, #f3f0e8 55%, #ebe7dd 100%);
-  --tm-star: transparent;
   --tm-fg: #1c1b19;
```

说明性注释保留了「浅色纸感:没有星空,背景是米白 + 极淡光晕」这句仍然成立的描述,只去掉了括号里对 `--tm-star` token 的引用。核对过注释文本,没有 `*` 紧贴 `/` 的情况,注释块边界完整。

## 删后 grep

```
$ grep -rn "tm-star" src/
(no output, exit code 1)
```

零命中,确认清理完成。

## Step 3: 守卫测试

### `pnpm exec vitest run src/styles/`

```
 Test Files  4 passed (4)
      Tests  1301 passed (1301)
   Start at  00:33:15
   Duration  2.89s
```

全绿。

### `pnpm exec vitest run src/files/snapshot/`

```
 Test Files  8 passed (8)
      Tests  100 passed (100)
     Errors  31 errors
   Start at  00:33:23
   Duration  2.69s
```

命令退出码为 1,但 100/100 测试用例本身全部通过;31 个 "unhandled error" 均为同一条:
`TypeError: el?.scrollIntoView is not a function`,来自 `TimeMachineRail.vue:86` 在 jsdom
环境下调用 `scrollIntoView`(jsdom 未实现该 DOM API)。这与本任务的 `--tm-star` 改动无关。

**验证方法**:`git stash` 掉本次改动后重跑同一条命令,得到完全相同的结果
(`Test Files 8 passed (8)` / `Tests 100 passed (100)` / `Errors 31 errors`,同样的
`scrollIntoView is not a function` 报错),证明这是本工作树里已存在的、与本任务无关的
预置缺陷(jsdom 环境限制),`git stash pop` 后恢复改动继续提交。

## Step 4: 提交

```
be5b7e9 chore(styles): drop the unused --tm-star token
```

Commit message:
```
chore(styles): drop the unused --tm-star token

The starfield was deliberately never ported (timeMachineMath.ts says so);
both themes kept defining a colour nothing reads.
```

## 范围核对

- 只改了 `src/styles/theme.css`(1 file changed, 1 insertion(+), 3 deletions(-))。
- 未碰其他 token,未做无关重构。
- 未合并 master、未部署、未推 origin。
