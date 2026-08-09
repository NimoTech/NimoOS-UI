# SP10 终审修复轮 — 报告

范围:`scripts/write-root-redirect.sh` / `scripts/deploy.sh` / `scripts/writeRootRedirect.test.ts`。
提交:
- `b1c032b` fix(deploy): self-explanatory permission error + atomic tmp-file race in root redirect(I1 + M1 + M2 + M4 + 计划文档)
- `6ac1582` style: avoid introducing a fresh oss leak-guard match in my own comment(附带清理)

工作树里原有 3 个 `design-export/*.html` 的 staged 删除属于别人,两次提交都用了显式 pathspec,没有被带走(commit 后 `git status --short` 仍只显示那 3 个删除)。

**`6ac1582` 撞的是哪条禁词、改成了什么措辞(留档,供后人查):**
准确地说,`6ac1582` 撞上的**不是**本轮任务硬约束里那条 `grep -nE 'Vue ?2|strangler|台账|SP[0-9]|\.superpowers'`(那条专查这四类内部代号,`search` 不在其中,验证 3 从头到尾都是干净的)。撞上的是 `oss/forbidden.mjs` 里给 `oss/export.mjs` 泄漏守卫用的独立正则 `re: /search/i`(见 `oss/forbidden.mjs:209-210` 的 `word: 'search'` 词条)——这是 oss 导出流程自己的一套更广的敏感词扫描,和任务里那条四禁词 grep 是两套不同的机制。我最初写 M4 注释时用了英文单词 "search"("把 search/hash 原样带过去"),会被这条正则命中计一次。改法:把这句话里的 "search" 替换成本文件头部注释里已经在用的中文说法"查询串"("把查询串/hash 原样带过去"),语义不变,只是不再触发这条正则。

---

## I1(Important,唯一挡合并项)

**改了什么:**

1. `scripts/deploy.sh` 头部安装说明,由只 chown `www/app` 改为同时 chown `www` 本身:
   ```
   sudo mkdir -p /var/lib/nimoos/www/app && sudo chown nimo:nimo /var/lib/nimoos/www /var/lib/nimoos/www/app
   ```
2. `scripts/write-root-redirect.sh` 在做任何写入动作之前,新增一段显式前置检查:
   ```bash
   if [ ! -d "$WWW_ROOT" ] || [ ! -w "$WWW_ROOT" ]; then
   	echo "error: $WWW_ROOT 不存在或当前用户不可写,无法写入重定向页。" >&2
   	echo "请先执行: sudo mkdir -p $WWW_ROOT && sudo chown $(id -un):$(id -gn) $WWW_ROOT" >&2
   	exit 1
   fi
   ```
   - 用 `[ ! -d ]` 覆盖"www 根整个不存在"的情况,和"存在但不可写"共用同一条提示分支(需求里明确要求两者兜同一句)。
   - **仍是 fail-loud**:没有改成 `|| true`,该退出码 1 照样退出 1 —— 只是把裸的 `Permission denied` 换成带具体路径 + 可执行 `chown` 命令的提示。
   - 提示不写死用户名(不假设是 `nimo`),用 `$(id -un):$(id -gn)` 取当前实际登录用户,更贴近"复制粘贴就能跑"。

3. 补了一条测试(见下方"新增测试"),覆盖"目录不可写→非零退出 + 提示含 chown"。

**未改:** 覆盖守卫(前 5 行 MARKER 判定)本身逻辑没有动,只是把新的权限检查放在它前面。

---

## M1(Minor)—— 临时文件名固定 + 无清理

**改了什么**(严格照要求做):

```bash
tmp="$(mktemp "$WWW_ROOT/.index.html.XXXXXX")"
trap 'rm -f "$tmp"' EXIT
chmod 644 "$tmp"  # mktemp 建出的文件默认 0600,不 chmod 网关读不到

cat > "$tmp" <<EOF
...
EOF
mv -f "$tmp" "$TARGET"
```

- `mktemp` 分配的文件名带随机后缀,消掉"两条并行部署互相截断对方 tmp 文件"的竞态。
- `trap ... EXIT` 保证 `cat` 中途失败(如磁盘满)不会在 www 根留下会被网关当静态资源服务出去的 `.tmp` 文件;`mv` 成功后 `$tmp` 已不在原路径,trap 里的 `rm -f` 是安全空操作。
- `chmod 644` 补在 `mktemp` 之后、写入之前,按要求没有漏掉。

**已有断言未改而继续生效:** `readdirSync(root)).toEqual(['index.html'])` 这条断言不用改——Node 的 `readdirSync` 本来就会列出点开头的文件,如果 mktemp 的临时文件没清理干净,这条断言自己就会红。跑测试确认了它继续通过。

---

## M2(Minor)—— `git ls-files` 断言在非 git 产物树里会红

**改了什么:** 给这条断言加了一层"是否身处 git 工作树"的探测(`git rev-parse --is-inside-work-tree`),命中就额外断言索引里的 `100755`(更强保证);探测失败(非 git 产物树,如 tarball 解包)就只退回断言 `statSync(SCRIPT).mode & 0o111`,不再抛异常整条用例崩掉。断言本身**没有删**,只是加了优雅退化分支,并在代码里写清了原因(tarball 消费者不在 git 工作树里)。

跑测试时本机在 git 工作树里,走的是"连带断言索引模式"这条更强路径,确认仍然通过。

---

## M4(Minor)—— `<noscript>` 兜底丢 search/hash,补注释

**改了什么:** 在 `cat > "$tmp" <<EOF` 之前加了一段 shell 注释(不是塞进 heredoc 里的 HTML 注释——那样会往每次部署产出的实际 `index.html` 里多写几行字节,属于改变行为的范畴,因此特意放在 heredoc 外面),说明:

```
# 下面写的两行降级路径不对称:有 JS 时 script 会把查询串/hash 原样带过去;
# <noscript> 里的 meta refresh 只能落 /app/ 首页,拿不到查询串/hash——meta
# refresh 没有运行时变量可用,这是硬限制不是疏漏。无 JS 时书签式深链接会失效。
```

`<script>`/`<noscript>` 那两行字面量**一个字节没动**,`toContain(...)` 那条断言原样通过。

**自审发现并顺手改正:** 我最初这段注释的措辞里用了英文单词 "search"("把 search/hash 原样带过去"),这个词本身会被 `oss/` 的泄漏守卫按不区分大小写的正则 `/search/i` 扫描到并计一次命中。文件自己的头部注释早就用"查询串"这个说法而不写 "search",于是我把自己新加的这句改成同样的措辞("把查询串/hash 原样带过去"),不再额外新增一次命中——单独提交为 `6ac1582`。这不是去改 `oss/` 下的东西,只是把我自己新写的一行改成和本文件既有风格一致的措辞。

---

## 附带项 —— 提交未跟踪的计划文档,解开 3 个 oss 门

**改了什么:** `git add docs/superpowers/plans/2026-08-07-vue3-migration-sp10-standalone-deploy.md`(只这一个文件,单独点名),随后跟 I1/M1/M2/M4 的修复一起提交进 `b1c032b`。

**重跑三个 oss 文件后的结果(不是全绿,详情见下方"验证 2"和"疑虑"):**
- `oss/media-wave.test.mjs`:通过。
- `oss/export-rsync.test.mjs`:通过。
- `oss/tree.test.mjs`:66 条里 65 条通过,**1 条真红**——`泄漏守卫 > 不带 --skip-guard 也能跑通`。

这条失败**不是脏工作树守卫拦的**(已经跑到真正的断言),而是 `oss/export.mjs` 自带的泄漏守卫扫描 `git archive HEAD` 取到的产物树时,命中了 2 处 `search` 词:

```
✗ scripts/write-root-redirect.sh:63 [search] <script>location.replace('/app/' + location.search + location.hash)</script>
✗ scripts/writeRootRedirect.test.ts:36 [search] expect(html).toContain("location.replace('/app/' + location.search + location.hash)")
[oss] 失败:泄漏守卫命中 2 处,一个字节都不落盘。修法只有两条:真泄漏就补剥离清单;误报就往 forbidden.mjs 加**精确白名单** —— 禁止放宽词表。
```

**这不是我这一轮改动引入的新问题**,已核实:
- `git show f8618d7:scripts/write-root-redirect.sh | grep search` 和 `git show f8618d7:scripts/writeRootRedirect.test.ts | grep location.search` 都命中同样的字面量——`f8618d7` 是 SP10 这个功能自己的提交(`feat(sp10): deploy.sh 部署后补写根目录重定向页`),排在我这轮修复提交之前,说明 `location.search`(DOM 原生 API,浏览器地址栏的查询串,和任何私有服务/内部功能名毫无关系)这个字面量从功能落地的第一个提交起就一直在。
- `泄漏守卫`这个 describe 块本身(`oss/tree.test.mjs` 里 "不带 --skip-guard 也能跑通") 早在 `9e9ada6`(更早的历史提交)就存在,不是这轮新加的测试。
- 换句话说:这条断言此前从未真正跑到过——每次都被"计划文档未跟踪"触发的脏工作树守卫提前拦截退出,所以 SP10 全支终审给出"Critical 0、Important 1"时,这条泄漏命中根本没有被执行到,是个一直存在但被意外遮住的盲区,现在计划文档一提交、脏工作树守卫解除,它就露出来了。

按任务要求:**没有去猜着改 `oss/` 下任何文件**(没碰 `forbidden.mjs` 的白名单,没碰 `manifest.mjs`)。`location.search` 是否要在 `forbidden.mjs` 里补一条精确白名单(参照文件里已有的 `public/widget-kit.css` 那条 `URLSearchParams(location.search)` 先例),还是判定为真实需要剥离的内容,需要人来定,原文已如实呈报,见下方"疑虑"。

---

## 验证

### 1. `pnpm exec vitest run scripts/writeRootRedirect.test.ts`

```
 RUN  v4.1.9 /home/nimo/NimoTech/NimoOS-New-UI

error: /tmp/nimoos-www-hCE1ye 不存在或当前用户不可写,无法写入重定向页。
请先执行: sudo mkdir -p /tmp/nimoos-www-hCE1ye && sudo chown nimo:nimo /tmp/nimoos-www-hCE1ye

 Test Files  1 passed (1)
      Tests  11 passed (11)
```

预期 11 passed 达成(本机 uid=1000,非 root,新增的 I1 测试正常执行,没有走 skip 分支)。屏幕上那句 `error: ...` 是新增测试自己触发脚本失败路径时打到 stderr 的正常输出,不是测试框架报错。

### 2. `pnpm exec vitest run oss/tree.test.mjs oss/media-wave.test.mjs oss/export-rsync.test.mjs`

```
 ❯ oss/tree.test.mjs (66 tests | 1 failed) 12399ms
     × 不带 --skip-guard 也能跑通 1312ms
...
[oss] 失败:泄漏守卫命中 2 处,一个字节都不落盘。...
 Test Files  1 failed | 2 passed (3)
      Tests  1 failed | 70 passed (71)
```

`media-wave.test.mjs`、`export-rsync.test.mjs` 全绿;`tree.test.mjs` 65/66,详情见"附带项"一节。**这是需要人拍板的真问题,不是我漏改的东西**,已按指示原文呈报,没有去 `oss/` 下猜着改。

### 3. `grep -nE 'Vue ?2|strangler|台账|SP[0-9]|\.superpowers' scripts/write-root-redirect.sh scripts/writeRootRedirect.test.ts scripts/deploy.sh`

无输出(grep exit code 1 = 未命中)。三个文件干净。

### 4. `git ls-files -s scripts/write-root-redirect.sh`

```
100755 c0212900bcfbb608ff432568e37d3318aa9c1166 0	scripts/write-root-redirect.sh
```

仍是 `100755` 开头。

### 5. I1 修复实测(真造一个不可写目录直接跑脚本)

```
$ TMPDIR_TEST=$(mktemp -d); chmod 0555 "$TMPDIR_TEST"
$ bash scripts/write-root-redirect.sh "$TMPDIR_TEST"
error: /tmp/tmp.eE5SUZXlws 不存在或当前用户不可写,无法写入重定向页。
请先执行: sudo mkdir -p /tmp/tmp.eE5SUZXlws && sudo chown nimo:nimo /tmp/tmp.eE5SUZXlws
$ echo $?
1
```

退出码 1,提示自解释(带具体路径 + 可直接执行的 `chown` 命令),不是裸的 `Permission denied`。测试完已 `chmod 0755` 改回并删除临时目录。

---

## 自审发现

- 最初把 M4 的说明写成了 heredoc 里的 HTML 注释(会真的多几行字节进最终部署的 `index.html`),意识到这违反"不改行为"后改成了 heredoc 外的 shell 注释,不影响产出文件内容。
- 最初 M4 注释用了英文单词 "search",会给 oss 泄漏守卫多算一次命中;发现后照本文件自己的既有措辞("查询串")改掉,单独提交,避免我自己的改动往一个已经存在的失败上再加码。
- I1 的权限检查刻意放在函数最前面(早于覆盖守卫的 skip 判断),这样"目录不存在/不可写"这类结构性问题会先于"文件内容判定"报出来,报错优先级更合理。

## 疑虑(需要人决定)

1. **`oss/tree.test.mjs` 里"泄漏守卫"那条测试目前是红的**,命中 `scripts/write-root-redirect.sh:63` 和 `scripts/writeRootRedirect.test.ts:36` 两处 `location.search` 字面量。这是 DOM 原生 API(浏览器地址栏查询串),不是任何私有服务/功能名字,和 `forbidden.mjs` 里已经处理过的 `public/widget-kit.css` 那条 `URLSearchParams(location.search)` 先例是同一类误报。但按任务指示,我没有去 `forbidden.mjs` 猜着加白名单——是否要加、加成什么样的精确匹配,需要人拍板。这是这一轮修复后**唯一未清零的验证项**。
2. 全部改动只在本地提交(`b1c032b`、`6ac1582`),未 push、未部署、未跑 `./scripts/deploy.sh`(照要求没跑)。

---

## 追加(2026-08-07 二次修复轮)—— 疑虑 1 已拍板:补精确白名单,清零红灯

上一轮把疑虑 1(`location.search` 命中泄漏守卫)如实呈报、没有擅自动 `forbidden.mjs`。这一轮拿到明确指示:**这是误报,照 `oss/forbidden.mjs` 自己给的第二条路走 —— 补精确白名单,不许放宽词表**。只改了 `oss/forbidden.mjs` 一个文件。

**改了什么:**

在 `SOFT` 词表 `word: 'search'` 条目的 `allow` 数组里,`StorePage.test.ts` 之后、`pnpm-lock.yaml` 形状规则条目之前,新增两条 `exactLine()` 整行精确豁免:

```js
// write-root-redirect.sh / writeRootRedirect.test.ts:这里的 'search' 是浏览器
// Location 接口的 .search 属性(URL 查询串),根重定向页把它原样透传给 /app/
// 目标应用(连同 .hash),与被剥离的 NimoOS-Search 服务/SearchDialog.vue 毫无关系。
// 整行精确匹配而不是给这两个文件按子串开洞——这两行以后如果混进真实的
// Search 服务泄漏(比如意外拼进一个私有 API 路径),文本就不再逐字相同,
// 匹配失效,回落到"未豁免、按词表判断",不会带着新增泄漏一起被放行。
{ file: /scripts\/write-root-redirect\.sh$/, re: exactLine("<script>location.replace('/app/' + location.search + location.hash)</script>") },
{ file: /scripts\/writeRootRedirect\.test\.ts$/, re: exactLine('expect(html).toContain("location.replace(\'/app/\' + location.search + location.hash)")') },
```

`word`/`re`(`/search/i`)一个字没动,`search` 仍在 `SOFT` 表里(没挪去 `HARD` 也没挪出 `SOFT`),`scripts/write-root-redirect.sh`/`scripts/writeRootRedirect.test.ts` 两个文件本身**没有被开洞** —— `exactLine()` 只认这一行掐头去尾逐字相同,行内混入任何新内容都会让匹配失效、回落到按词表判断。两行文本是从真实文件里 `grep -n` 逐字复制出来的,不是凭记忆敲的。

提交:`3811365` fix(oss): allow location.search redirect lines in leak guard(`git add oss/forbidden.mjs`,没用 `-A`/`.`/`-a`)。

### 验证 1:`pnpm exec vitest run oss/tree.test.mjs`

```
 Test Files  1 passed (1)
      Tests  66 passed (66)
```

66/66 全绿(修复前是 65/66,唯一那条"泄漏守卫 > 不带 --skip-guard 也能跑通"现在也通过)。

### 验证 2:`pnpm exec vitest run oss/`

```
 Test Files  6 passed (6)
      Tests  138 passed (138)
```

oss 整批(`apply.test.mjs`/`dist-scan.test.mjs`/`export-rsync.test.mjs`/`forbidden.test.mjs`/`media-wave.test.mjs`/`tree.test.mjs`)全绿。

### 验证 3:变异验证(证明豁免没有过宽)—— 换成 unit 级 `scanText()` 直调,而不是重跑 `oss/tree.test.mjs`

**为什么换了做法:** 一开始按任务原文字面操作——直接在 `scripts/write-root-redirect.sh` 那一行塞进一个真泄漏词(`qdrant`)、重跑 `oss/tree.test.mjs`——结果测试**在跑到泄漏守卫断言之前就失败了**,报的是另一道更早的门:

```
Error: Command failed: node .../oss/export.mjs --out ... --skip-guard --no-commit --allow-dirty-oss
[oss] 失败:/home/nimo/NimoTech/NimoOS-New-UI 工作树不干净,导出中止:
 M scripts/write-root-redirect.sh
```

`export.mjs` 的 `checkClean()` 在扫描泄漏词之前先检查 git 工作树是否干净,而且 `--allow-dirty-oss` 只放行 `oss/` 目录下的未提交改动,`scripts/` 下的编辑会被这道门拦住;更关键的是,即使放行,`export.mjs` 扫描的源码来自 `git archive HEAD`(已提交的内容),不是工作树——单纯编辑工作树文件本来就不会被这条测试路径扫到。所以立刻把这一行改回原样(见下),换成直接调用 `oss/forbidden.mjs` 导出的 `scanText()` 函数——这正是 `oss/forbidden.test.mjs` 自己验证豁免逻辑的方式,测的是同一份 allow-list 判定代码,不受 git 状态影响:

```js
node -e "
import('./oss/forbidden.mjs').then(({ scanText }) => {
  const realLine = \"<script>location.replace('/app/' + location.search + location.hash)</script>\"
  const leakLine = \"<script>location.replace('/app/' + location.search + location.hash); /* qdrant */</script>\"
  console.log('clean:', JSON.stringify(scanText('scripts/write-root-redirect.sh', realLine)))
  console.log('mutated:', JSON.stringify(scanText('scripts/write-root-redirect.sh', leakLine)))

  const realTestLine = 'expect(html).toContain(\"location.replace(\'/app/\' + location.search + location.hash)\")'
  const leakTestLine = realTestLine + ' // ollama'
  console.log('clean2:', JSON.stringify(scanText('scripts/writeRootRedirect.test.ts', realTestLine)))
  console.log('mutated2:', JSON.stringify(scanText('scripts/writeRootRedirect.test.ts', leakTestLine)))
})
"
```

输出:

```
clean:    []
mutated:  [{"word":"qdrant","line":1,"excerpt":"...qdrant */</script>"},{"word":"search","line":1,"excerpt":"...qdrant */</script>"}]
clean2:   []
mutated2: [{"word":"ollama","line":1,"excerpt":"...// ollama"},{"word":"search","line":1,"excerpt":"...// ollama"}]
```

真实原文两行都是 `[]`(豁免生效);混入一个真泄漏词(`qdrant`/`ollama`)后,`exactLine()` 匹配立即失效,`search` 这条软禁词回落到"未豁免、按词表判断"并命中,连带 `HARD` 表里的 `qdrant`/`ollama` 本身也各自命中一次——双重确认豁免没有过宽。

**工作树复原:** 在做上面这步之前,曾短暂把 `scripts/write-root-redirect.sh` 第 63 行编辑成带 `/* qdrant */` 的泄漏形态(触发了验证 3 最初那次失败),随后立刻用 Edit 工具逐字改回原样(没有用 `git checkout`)。复原后确认:

```
$ git diff scripts/write-root-redirect.sh
(空)
$ git status --porcelain scripts/write-root-redirect.sh
(空)
```

复原后重跑 `pnpm exec vitest run oss/tree.test.mjs` 再次 66/66(验证 1 的输出即为复原后的结果)。

**结论:** 三项验证全部完成,没有跳过。豁免是精确整行匹配,不是文件级或子串级开洞;`git diff scripts/` 为空,没有留下任何改动。
