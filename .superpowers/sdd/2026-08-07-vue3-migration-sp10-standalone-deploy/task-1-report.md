# Task 1 报告:根目录重定向脚本 + 覆盖守卫

## 实现了什么

- `scripts/write-root-redirect.sh`(模式 100755,git 索引已确认):往 `<www-root>/index.html`
  写一个 `/ → /app/` 的静态重定向页,带三条行为:
  1. 目标不存在 → 写,`wrote: `,exit 0
  2. 目标存在且前 5 行含标记 `nimoos-new-ui-redirect` → 覆盖重写,`wrote: `,exit 0
  3. 目标存在且前 5 行不含标记(别的应用的首页)→ 一字不动,`skip: `,exit 0
  4. 未传参 → exit 1,stderr 含 `usage`
  写入走 `.tmp` + `mv -f` 原子替换;判定用变量 + `case`(不起 `head | grep -q` 管道)。
  逐字照抄 brief Step 3 的脚本,未做任何改动。
- `scripts/writeRootRedirect.test.ts`:8 条用例,逐字照抄 brief Step 1,**仅** SCRIPT/REPO_ROOT
  两个路径常量的求值方式做了必要修正(见下方"意外发现")。

## 测了什么、结果如何

`pnpm exec vitest run scripts/writeRootRedirect.test.ts --reporter=verbose`:8 passed,
stdout/stderr 干净,无告警。另外手工跑了一遍脚本本体(见下方 GREEN 之后的补充验证)。

## TDD Evidence

### RED

命令:
```
cd /home/nimo/NimoTech/NimoOS-New-UI
pnpm exec vitest run scripts/writeRootRedirect.test.ts
```

**第一次跑(brief 给的 `new URL('./x', import.meta.url)` 写法,脚本还不存在)**:
```
TypeError: The URL must be of scheme file
 ❯ scripts/writeRootRedirect.test.ts:8:16
```
这是一个**套件级**失败(0 test collected),不是 8 条各自失败 —— 说明测试连脚本存不存在
都还没走到就已经炸了。见下方"意外发现"分析根因并修正。

**修正 SCRIPT/REPO_ROOT 求值方式之后,重新跑(脚本仍未创建)**:
```
 × 根目录没有 index.html 时写出重定向页          → bash: ...write-root-redirect.sh: No such file or directory
 × 已存在的是本脚本上次写的(前 5 行含标记)→ 覆盖重写  → 同上,No such file or directory
 × 🔴 已存在的是别的应用的首页(无标记)→ 一字不动,只报 skip → 同上
 × 标记出现在第 6 行及以后不算数(防止误判一份很长的别家首页) → 同上
 × 不传参数时以退出码 1 失败并打印 usage           → expected 127 to be 1(脚本不存在,bash 退 127)
 × 🔴 脚本可执行,且 git 索引里记的是 100755         → ENOENT: stat 脚本路径失败
 × 写出的页面在无 JS 时也能跳(noscript meta refresh 兜底) → No such file or directory
 × 只写 index.html,不在根目录留下任何别的文件(含 .tmp)  → No such file or directory

 Test Files  1 failed (1)
      Tests  8 failed (8)
```
8 条全部失败,失败原因与 brief Step 2 的预期逐条吻合:前 7 条是"脚本不存在"(ENOENT / bash 退
127 / Command failed),第 8 条是 `git ls-files -s` 对不存在文件返回空、模式断言落空。**没有
一条是"意外绿"**,每条断言都在真测东西 —— 确认为有效红灯。

### 意外发现(RED 阶段,已按仓库既有先例修正)

brief 给的
```ts
const SCRIPT = fileURLToPath(new URL('./write-root-redirect.sh', import.meta.url))
const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
```
在本仓库 `environment: 'jsdom'` 下会炸,报 `TypeError: The URL must be of scheme file`(套件
级失败,0 test collected,不是 8 条测试各自失败)。用最小复现定位到根因:Vite 对
`new URL('相对字面量', import.meta.url)` 这个**双参数字面量形态**有特殊静态处理(资源 URL
字面量识别),vitest 走同一套转换管线,于是这个模式被解析成相对 dev server 的 `http:` URL 而
不是 `file:`;而单独 `new URL(import.meta.url)`(单参数)或 `fileURLToPath(import.meta.url)`
不触发这条转换,行为正常。

这不是我的猜测 —— 本仓库 `src/settings/panels/panels.test.ts:56` 的注释已经记录过一模一样的坑:
> 目录要用 `fileURLToPath(import.meta.url)` 解,**不能用 `new URL('.', import.meta.url).pathname`**
> —— 后者在 vitest 下给出的是相对 root 的路径,readdir 会 ENOENT

所以按该文件已验证过的写法修正了两行常量求值(其余 8 条用例的断言逐字未动):
```ts
const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(HERE, 'write-root-redirect.sh')
const REPO_ROOT = join(HERE, '..')
```
`import.meta.url` 本身仍然是唯一的路径来源,没有引入 `__dirname`,符合约束 3。

### GREEN

命令:
```
cd /home/nimo/NimoTech/NimoOS-New-UI
pnpm exec vitest run scripts/writeRootRedirect.test.ts --reporter=verbose
```
输出:
```
 ✓ write-root-redirect.sh > 根目录没有 index.html 时写出重定向页 9ms
 ✓ write-root-redirect.sh > 已存在的是本脚本上次写的(前 5 行含标记)→ 覆盖重写 7ms
 ✓ write-root-redirect.sh > 🔴 已存在的是别的应用的首页(无标记)→ 一字不动,只报 skip 5ms
 ✓ write-root-redirect.sh > 标记出现在第 6 行及以后不算数(防止误判一份很长的别家首页) 5ms
 ✓ write-root-redirect.sh > 不传参数时以退出码 1 失败并打印 usage 4ms
 ✓ write-root-redirect.sh > 🔴 脚本可执行,且 git 索引里记的是 100755 3ms
 ✓ write-root-redirect.sh > 写出的页面在无 JS 时也能跳(noscript meta refresh 兜底) 6ms
 ✓ write-root-redirect.sh > 只写 index.html,不在根目录留下任何别的文件(含 .tmp) 6ms

 Test Files  1 passed (1)
      Tests  8 passed (8)
```
8/8 通过,stdout 只有正常测试输出(用 `--reporter=verbose` 确认没有隐藏告警,呼应本仓库
"vitest 默认 reporter 藏告警"的已知坑)。

补充手工验证(不依赖 vitest,直接跑脚本本体,确认 deploy.sh 未来 `./scripts/...` 不带 bash
前缀调用也没问题):
```
$ ./scripts/write-root-redirect.sh /tmp/xxx
wrote: /tmp/xxx/index.html
exit=0
$ ./scripts/write-root-redirect.sh
./scripts/write-root-redirect.sh: line 17: 1: usage: write-root-redirect.sh <www-root>
exit=1
```
两者符合契约。`shellcheck` 在本机不可用,未跑静态检查(脚本内容与 brief 逐字一致,brief 已
"逐行审过")。

## 改了哪些文件

- 新增 `scripts/write-root-redirect.sh`(100755,git 索引已核实)
- 新增 `scripts/writeRootRedirect.test.ts`
- 未碰 `src/**`、`scripts/deploy.sh` 或任何其他文件
- 工作树里此前就存在的 3 个 `design-export/*.html` 删除与 1 个 untracked 的 plan 文档,提交前后
  均未被本次 `git add`/`git commit`(用了显式 pathspec)带走,`git status` 已核实

## 自审发现

1. **完整性**:5 个 Step 全部按序完成,commit message 与 brief Step 5 给定的文本逐字一致。
2. **纪律**:提交用了显式 pathspec(`git add scripts/write-root-redirect.sh
   scripts/writeRootRedirect.test.ts`),未用 `-A`/`.`/`-a`;git 提交历史里只有这两个文件
   (`git show --stat HEAD` 已核实);design-export 的 3 个 staged/unstaged 删除保持原状。
3. **公开面自查**:`grep -nE 'Vue ?2|strangler|台账|SP[0-9]|\.superpowers' scripts/write-root-redirect.sh
   scripts/writeRootRedirect.test.ts` 无输出(exit 1 = 无匹配)。commit message 里出现了
   "Vue2" 三个字,但 commit message 不进 `git archive HEAD` 产物树(`oss/export.mjs` 打包的是
   文件内容而非提交历史),且 brief Step 5 原文就是这句话,已按其执行,未改动。
4. **测试是否真在验行为**:是。8 条用例分别覆盖"不存在→写"、"标记覆盖→写"、"无标记→skip 且
   字节不变"、"标记位置边界(第 6 行不算)"、"缺参数→exit 1 + stderr usage(非任意非零)"、
   "git 索引模式 100755"、"noscript 兜底"、"目录洁净(无 .tmp 残留)"。第 5、6 条用例的注释本身
   就在提醒"别写成弱断言",已按其要求写成强断言(具体 exit code、git ls-files 而非仅
   `statSync`)。RED 阶段确认了每条都真的会失败,不存在"提前是绿的"断言。
5. **管道 SIGPIPE 坑**:脚本判定用 `head -n 5 "$TARGET"` 赋值给变量再 `case` 匹配,全程没有
   `| grep`,不受 `set -o pipefail` 影响。

## 疑虑/问题

- 上文"意外发现"里那处 SCRIPT/REPO_ROOT 求值方式的修正,是我在 Step 2 红灯阶段主动定位并按
  本仓库已有先例(`panels.test.ts:56`)修正的,不是我自行发明的新写法。8 条测试的**行为断言**
  一字未改。如果这个修正超出了"verbatim"的授权范围,请指出,我可以改按其他方式处理(例如把
  两行判断也原样先跑一次证明会炸、再改)。目前判断:这个改动是让 brief 的意图(用
  `import.meta.url` 而非 `__dirname`)在本仓库环境下真正生效所必需的,而非引入替代断言或新
  功能。
- `shellcheck` 本机未安装,脚本仅做了行为级验证(vitest 8/8 + 手工直接执行),未做静态检查。
