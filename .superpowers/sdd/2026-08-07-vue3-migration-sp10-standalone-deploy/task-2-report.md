# Task 2 报告:把重定向脚本接进 deploy.sh

## 实现了什么

按 brief 逐字操作:

1. 在 `scripts/writeRootRedirect.test.ts` 末尾追加 `describe('deploy.sh 接线', …)` 块(2 条用例),复用文件顶部已有的 `HERE`/`join`/`readFileSync`。
2. 在 `scripts/deploy.sh` 的 `find … -mtime +14 -delete` 之后、`echo "Deployed …"` 之前插入 4 行注释 + 一行调用:
   ```bash
   ./scripts/write-root-redirect.sh /var/lib/nimoos/www
   ```
   参数是 www 根(`/var/lib/nimoos/www`),不是 `/app` 子目录 —— 与 Task 1 脚本契约(它自己在内部拼 `index.html` 到根目录)一致。

未改动 `scripts/write-root-redirect.sh` 本体(Task 1 已定稿)。

## 测了什么、结果如何

`pnpm exec vitest run scripts/writeRootRedirect.test.ts` → **10 passed**,无 stderr / 无 [Vue warn] 之类告警,输出干净。

两条新用例验证的是行为而非措辞巧合:
- 第一条断言调用串精确到 `.../write-root-redirect.sh /var/lib/nimoos/www`(结尾无 `/app`),并反向断言不含 `.../www/app` 变体 —— 防止将来有人手滑传错目录层级导致 Task 1 脚本把重定向页写进 `/app/` 里把真应用的 `index.html` 覆盖掉。
- 第二条用字符串下标比较两处调用在文件中的相对位置,确认接线点在 `rsync` **之后** —— 顺序错了会导致 rsync 的 `--delete` 把刚写好的重定向页当作陈旧文件删掉(rsync 目标是 `.../www/app/`,重定向页在 `.../www/` 根目录,严格来说 rsync 不会删到它,但顺序颠倒仍不符合"先铺应用再补根跳转"的设计意图,brief 明确要求这条顺序断言)。

## TDD Evidence

**RED**

命令:
```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
pnpm exec vitest run scripts/writeRootRedirect.test.ts
```

关键输出:
```
 ❯ scripts/writeRootRedirect.test.ts (10 tests | 2 failed) 80ms
     × 调用了重定向脚本,并且传的是 www 根而不是 app 子目录 11ms
     × 调用点在 rsync 之后(先把应用铺好,再补根目录那一跳) 1ms
...
AssertionError: expected '#!/usr/bin/env bash\n# 构建 NimoOS-New-…' to contain './scripts/write-root-redirect.sh /var…'
...
AssertionError: expected -1 to be greater than 431
 Test Files  1 failed (1)
      Tests  2 failed | 8 passed (10)
```

预期性核实:失败的正是新增的那 2 条(deploy.sh 里当时确实还没有调用行,所以 `toContain` 与 `indexOf` 找不到必然失败);原有 8 条(write-root-redirect.sh 自身行为的用例,与 deploy.sh 内容无关)全部仍是绿的,证明这次改动是纯新增、没有破坏既有测试基线。

**GREEN**

命令:
```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
pnpm exec vitest run scripts/writeRootRedirect.test.ts
```

输出:
```
 Test Files  1 passed (1)
      Tests  10 passed (10)
   Start at  01:46:57
   Duration  712ms
```

## 改了哪些文件

- `scripts/deploy.sh` —— 追加 4 行注释 + 1 行调用(5 insertions)
- `scripts/writeRootRedirect.test.ts` —— 追加第二个 describe 块(19 insertions)

`git diff` 已核对:仅这两处改动,无其它意外改动混入。

## 自审发现

- **完整性**:brief 的 5 个 Step 全部按序执行,命令与代码均逐字照抄,未做任何"顺手改进"。
- **纪律自查**:`grep -nE 'Vue ?2|strangler|台账|SP[0-9]|\.superpowers' scripts/deploy.sh scripts/writeRootRedirect.test.ts` 无输出(exit 1),两个文件里都没有混入禁止的私有措辞。
- **提交范围**:`git add scripts/deploy.sh scripts/writeRootRedirect.test.ts`(带 pathspec,未用 `-A`/`.`/`-a`)。提交前后用 `git status` 核实了工作树里那 3 个 `design-export/*.html` 的 staged 删除、以及一个未追踪的 plan 文档都原封未动,没有被我的提交带走。
- **语法**:`bash -n scripts/deploy.sh` 通过。
- **未越界**:未碰 `scripts/write-root-redirect.sh`,未碰 `src/**`,未真正执行 `./scripts/deploy.sh`。
- 测试输出干净,无 vitest/jsdom 告警需要用 `--reporter=verbose` 额外核实(已用默认 reporter 看到完整 10/10 通过且无红字告警行)。

## 疑虑/问题

无。brief 内容与仓库现状(deploy.sh 13 行现状、test 文件顶部已有 HERE/join/readFileSync)完全吻合,没有遇到需要偏离原文的情况。
