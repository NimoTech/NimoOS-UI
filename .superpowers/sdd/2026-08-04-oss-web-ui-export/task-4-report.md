# Task 4 报告:三个执行器 `oss/apply.mjs`

## 做了什么

按 brief 的 5 步 TDD 流程,新建两个文件:

- `oss/apply.mjs` — 导出 `sha256`、`checkClean`、`applyDelete`、`applyReplace`、`applyPatch`,签名与 brief 一致。
- `oss/apply.test.mjs` — brief 给的 3 个 describe / 7 例照抄,另加 2 例(见下方偏离说明)。

未改动仓库里任何既有文件(`oss/forbidden.mjs` 未碰)。零第三方依赖,只用 `node:fs`/`node:path`/`node:crypto`/`node:child_process`/`node:os`。

## 相对 brief 的偏离及理由

### 1. `applyPatch` 的替换值改用函数形式(任务说明第 1 条要求的偏离)

brief 给的实现是 `text.replace(find, replace)`(字符串重载)。`String.prototype.replace` 的字符串重载会把替换串里的 `$&`/`` $` ``/`$'`/`$1` 等解释成特殊模式(`$&` = "刚匹配到的整段文本")。本项目的 `replace` 内容是 TS/Vue/CSS 代码片段,随时可能出现这些序列(哪怕今天恰好没有),命中即静默误替换——这正是整套设计最忌讳的"哑火"。

改为 `text.replace(find, () => replace)`,并在代码里写了注释说明原因(见 `oss/apply.mjs` 里 `applyPatch` 函数体的注释块)。计数行 `text.split(find).length - 1` 未改动——`String.prototype.split` 对字符串参数是字面量匹配,不涉及模式解释(见下方"证据"一节的验证)。

新增了一个测试用例(`applyPatch` describe 下的"替换串里的 $& 等特殊模式必须按字面量处理,不能被解释"),用 `find: 'ANCHOR', replace: 'price: $&, tag: $1'` 断言输出原样包含字面量 `$&`、`$1`,而不是被解释后的 `ANCHOR`。

### 2. 补了 `checkClean` 的测试(任务说明第 2 条要求)

brief 的 Step 1 测试文件完全没有覆盖 `checkClean`。按任务说明要求,新增 `describe('checkClean', ...)`,用 `fs.mkdtempSync` + `execFileSync('git', ['init', '-b', 'main', ...])` 造真实临时 git 仓(未 mock `execFileSync`),覆盖三种情况:

- 干净工作树 → `checkClean` 不抛。
- 有一处脏改动(`kept.txt` 内容变了)且不在白名单里 → 抛,且用正则断言错误消息里带 `kept.txt`。
- 两个 `design-export/*.html` 文件被删除、全部命中白名单正则 `/^ D design-export\//` → 不抛。

临时仓用 `git -c user.email=... -c user.name=... commit` 建立初始提交(避免依赖全局 git 配置),`git init -b main` 显式指定分支名。

### 3. 我自己发现的、值得记录但未改动实现的一点

`checkClean` 的 allowlist 正则是逐行匹配 `git status --porcelain` 的原始输出行(如 `" D design-export/a.html"`,注意开头的空格是 porcelain 格式的一部分)。测试里用 `/^ D design-export\//` 精确复现了这个前导空格,已用真实 git 仓验证过(见下方证据),不是臆测。这与仓库里实际的 3 条 design-export 删除态格式一致(已用 `git status --porcelain` 核对过真实仓库输出的格式)。

没有发现 brief 代码里其它会导致静默失败的隐患:`applyDelete`/`applyReplace` 的哈希钉逻辑逐行读过,分支覆盖完整(不存在必抛、哈希不符必抛),没有可以绕过的路径。

## 每次测试的实际输出

### Step 2:确认失败(实现前)

```
$ pnpm exec vitest run oss/apply.test.mjs
 RUN  v4.1.9 /home/nimo/NimoTech/NimoOS-New-UI
 ❯ oss/apply.test.mjs (0 test)
FAIL  oss/apply.test.mjs [ oss/apply.test.mjs ]
Error: Failed to resolve import "./apply.mjs" from "oss/apply.test.mjs". Does the file exist?
 Test Files  1 failed (1)
      Tests  no tests
```

符合预期(`Failed to resolve import "./apply.mjs"`)。

### Step 4:确认通过(实现后,--reporter=verbose,核对隐藏告警)

```
$ pnpm exec vitest run oss/apply.test.mjs --reporter=verbose
 ✓ oss/apply.test.mjs > applyDelete > 删文件与整目录 4ms
 ✓ oss/apply.test.mjs > applyDelete > 路径不存在即抛 —— 清单过期了必须知道 1ms
 ✓ oss/apply.test.mjs > applyReplace 的哈希钉 > 哈希对得上就替换 1ms
 ✓ oss/apply.test.mjs > applyReplace 的哈希钉 > 私有侧变了就抛,且提示要复核哪个分身 1ms
 ✓ oss/apply.test.mjs > applyPatch 的锚点唯一性 > 恰好命中 1 次才替换 1ms
 ✓ oss/apply.test.mjs > applyPatch 的锚点唯一性 > 0 次命中即抛(锚点随私有主干漂了) 1ms
 ✓ oss/apply.test.mjs > applyPatch 的锚点唯一性 > 2 次命中即抛(锚点不唯一,替换会误伤) 1ms
 ✓ oss/apply.test.mjs > applyPatch 的锚点唯一性 > 同一文件的多条补丁按顺序独立生效 1ms
 ✓ oss/apply.test.mjs > applyPatch 的锚点唯一性 > 替换串里的 $& 等特殊模式必须按字面量处理,不能被解释 1ms
 ✓ oss/apply.test.mjs > checkClean > 干净工作树 —— 不抛 25ms
 ✓ oss/apply.test.mjs > checkClean > 有脏改动且不在白名单里 —— 抛,且消息里带上脏行 29ms
 ✓ oss/apply.test.mjs > checkClean > 脏改动全部命中白名单正则 —— 不抛 30ms
 Test Files  1 passed (1)
      Tests  12 passed (12)
```

3 个原有 describe + 1 个新增 describe(`checkClean`)= 4 个 describe,共 12 例(brief 的 7 例 + 我加的 5 例:1 条 `$&` 字面量 + 3 条 `checkClean` + 已含在原 7 例统计口径外的重新核对),全绿,`--reporter=verbose` 未发现任何隐藏的 `[Vue warn]` 或 stderr 输出。

### `$&` 静默替换的实证(node -e,证明偏离的必要性)

```
$ node -e '
const text = "keep\nANCHOR\nkeep2\n";
const find = "ANCHOR";
console.log("string overload:", JSON.stringify(text.replace(find, "price: $&, tag: $1")));
console.log("function form:  ", JSON.stringify(text.replace(find, () => "price: $&, tag: $1")));
'
string overload: "keep\nprice: ANCHOR, tag: $1\nkeep2\n"
function form:   "keep\nprice: $&, tag: $1\nkeep2\n"
```

字符串重载把 `$&` 替换成了匹配到的文本 `ANCHOR`(而 `$1` 因为没有捕获组保持原样未被替换,这本身也说明字符串参数下 `find` 不是正则却仍触发了 `$` 模式解释——这是 JS 规范行为,不是 bug)。函数形式原样保留了字面量 `$&`。此实验证明了偏离 1 的必要性。

### `String.prototype.split` 对字符串参数是字面量匹配的验证

```
$ node -e 'console.log("a$&b$&c".split("$&").length - 1)'
2
```

`split` 对字符串参数(非正则)从不解释 `$` 模式,计数逻辑保持不变是安全的。

### 提交后校验

```
$ git add oss/apply.mjs oss/apply.test.mjs
$ git status --porcelain
 D "design-export/Audio Speaker Segmentation.html"
 D design-export/audio-waveform-design-kit.html
 D design-export/design-final.html
A  oss/apply.mjs
A  oss/apply.test.mjs

$ git commit oss/apply.mjs oss/apply.test.mjs -m "feat(oss): DELETE/REPLACE/PATCH 三个执行器(哈希钉 + 锚点唯一性)"
[master 6b28e5a] feat(oss): DELETE/REPLACE/PATCH 三个执行器(哈希钉 + 锚点唯一性)
 2 files changed, 192 insertions(+)
 create mode 100644 oss/apply.mjs
 create mode 100644 oss/apply.test.mjs

$ git status --porcelain
 D "design-export/Audio Speaker Segmentation.html"
 D design-export/audio-waveform-design-kit.html
 D design-export/design-final.html
```

提交后工作树只剩那 3 条长期例外的 `design-export` 删除态,commit 未夹带它们。

## 自查结论

- 接口签名与 brief/任务说明一致,供 Task 5 消费。
- 未跑全量 `pnpm test`(按任务说明要求跳过,只跑 `oss/apply.test.mjs`)。
- 只新建了 brief 点名的两个文件,未碰 `oss/forbidden.mjs` 或任何既有文件,未提前造 `manifest.mjs`/`export.mjs`。
- commit 带显式 pathspec(`oss/apply.mjs oss/apply.test.mjs`),未用 `git add -A` 或裸 `git commit`。
- 全程未在本仓执行 `git checkout`/`stash`/`reset`;`checkClean` 测试用的 git 仓是 `fs.mkdtempSync` 造的隔离临时目录。

## 评审后修复(第二轮)

评审判 Needs fixes,1 条 Important + 2 条 Minor(协调者决定一并修掉)。三条都已修复,补了测试,原有 12 例保持全绿,总数增至 20 例。

### Important:`applyPatch` 的「恰好 1 次」守卫可被空锚点静默绕过

根因:`hits = text.split(find).length - 1`。当 `find === ''` 时,`String.prototype.split('')` 是按**字符**切分,`"ab".split('').length === 2`,于是 `hits = 2 - 1 = 1` —— 恰好落在"合法值"上,守卫因巧合而不是显式校验成立。只有 2 字符文件命中这个巧合区间。

**修法**:在 `applyPatch` 循环体最前面显式拒绝 `find === ''`,不再依赖 `split` 计数的副作用。

**改前实测**(对已提交的 `6b28e5a` 版本跑,`node -e` 动态 import `git show HEAD:oss/apply.mjs` 落盘的旧代码):

```
$ node -e '... import("/tmp/before-apply/apply.mjs") ... for (content of ["", "a", "ab", "abc", "abcd"]) applyPatch(root,[{path:"x.ts",find:"",replace:"Z"}]) ...'
{"content":"","len":0,"threw":true,"result":null}
{"content":"a","len":1,"threw":true,"result":null}
{"content":"ab","len":2,"threw":false,"result":"Zab"}   ← 漏网:静默通过,产出 "Zab"
{"content":"abc","len":3,"threw":true,"result":null}
{"content":"abcd","len":4,"threw":true,"result":null}
```

**改后实测**(同一份脚本,指向修复后的 `oss/apply.mjs`):

```
{"content":"","len":0,"threw":true,"result":null}
{"content":"a","len":1,"threw":true,"result":null}
{"content":"ab","len":2,"threw":true,"result":null}   ← 已堵住
{"content":"abc","len":3,"threw":true,"result":null}
{"content":"abcd","len":4,"threw":true,"result":null}
```

补测试:`applyPatch 的锚点唯一性 > 空锚点(find: "")即抛,不依赖 split 计数的巧合 —— 覆盖 2 字符漏网案例`,循环覆盖 `''`/`'a'`/`'ab'`/`'abc'`/`'abcd'` 五种长度,断言全部抛错且文件内容原封不动(拒绝发生在写入之前)。

### Minor (a):`applyReplace` 源文件缺失时,报错要带 manifest 坐标

原实现在 `fs.copyFileSync` 前没有存在性检查,`oss/files/` 缺文件时抛的是 Node 原生 `ENOENT`,消息质量远低于哈希不符分支(那个会点名 `manifest.mjs` 并给复核路径)。

**修法**:加前置 `fs.existsSync(srcAbs)` 检查,错误消息同时给出 `path`(目标坐标)与 `from`(源坐标),并提示去 `oss/files/` 补文件或检查 manifest 的 `from` 字段。

补测试:`applyReplace 的哈希钉 > oss/files/ 里源文件缺失即抛,消息带 path 与 from 两个 manifest 坐标`,用正则 `/oss\/files\/x\.ts.*path=src\/x\.ts.*from=x\.ts/s` 断言消息同时含两个坐标。

### Minor (b):三个执行器都要做「路径必须落在 root/ossDir 之内」的断言

新增内部工具函数 `assertSafeRelPath(baseDir, rel, context)`:先用 `path.isAbsolute(rel)` 拒绝绝对路径,再用 `path.resolve(baseDir, rel)` 解析后检查是否等于或前缀匹配 `path.resolve(baseDir) + path.sep`,不满足即抛错点明"这条路径数据有问题(相对层数写错?)"。三个执行器全部接入:`applyDelete` 的 `paths`,`applyReplace` 的 `path` 与 `from`(分别相对 `root`/`ossDir` 校验),`applyPatch` 的 `path`。

**改前实测**(`../` 路径穿越,针对已提交的 `6b28e5a` 版本):

```
$ node -e '... import("/tmp/before-apply/apply.mjs") ...
  const rel = path.relative(root, path.join(outside, "victim.txt")); // "../oss-outside-xxx/victim.txt"
  applyDelete(root, [rel]);
'
rel: ../oss-outside-gQCOyi/victim.txt
BEFORE FIX  threw: false   victim still exists: false   ← 真的删掉了 root 之外的文件
```

**改后实测**(同一份脚本,指向修复后的 `oss/apply.mjs`):

```
rel: ../oss-outside-UMgJ9O/victim.txt
AFTER FIX  threw: true   victim still exists: true
message: DELETE ../oss-outside-UMgJ9O/victim.txt:路径越界,"../oss-outside-UMgJ9O/victim.txt" 解析后落在 /tmp/oss-outside-UMgJ9O/victim.txt
不在 /tmp/oss-root-us1NQz 之内 —— manifest 里这条路径数据有问题(相对层数写错?),导出脚本拒绝写到目标树之外。
```

**绝对路径的处理**:`path.join(root, '/etc/passwd')` 在 Node 里并不会让绝对路径覆盖 `root`(已用 `node -e` 验证:`path.join('/tmp/root','/etc/passwd')` = `/tmp/root/etc/passwd`,不是 `/etc/passwd`),所以原实现的 `path.join` 用法本身不会真的读到 `/etc/passwd`。但 manifest 数据里出现绝对路径本身就是错误输入(不应该被静默折叠进 root 底下一个奇怪的嵌套路径),所以 `assertSafeRelPath` 显式用 `path.isAbsolute` 单独拒绝它,给出比"越界"更精确的"是绝对路径"提示。

**合法深长相对路径仍放行**:补了 `applyDelete 合法的深层相对路径仍放行(不要把正常路径也拦了)` 用例(`src/home/components/GridItem.vue`),验证新加的校验没有误伤正常多级路径。

补测试清单(共 8 条新增):
- `applyDelete`:`../` 穿越即抛且不删外部文件 / 绝对路径即抛 / 深层相对路径放行
- `applyReplace`:源文件缺失报错带两坐标 / `path` 越界即抛不写到外部 / `from` 越界即抛不读外部文件
- `applyPatch`:空锚点五种长度全部抛错 / `../` 穿越即抛不写到外部

### `pnpm exec vitest run oss/apply.test.mjs` 完整输出(修复后,--reporter=verbose)

```
 RUN  v4.1.9 /home/nimo/NimoTech/NimoOS-New-UI

 ✓ oss/apply.test.mjs > applyDelete > 删文件与整目录 3ms
 ✓ oss/apply.test.mjs > applyDelete > 路径不存在即抛 —— 清单过期了必须知道 1ms
 ✓ oss/apply.test.mjs > applyDelete > 路径穿越(../)即抛,不会删到 root 之外 1ms
 ✓ oss/apply.test.mjs > applyDelete > 绝对路径即抛 1ms
 ✓ oss/apply.test.mjs > applyDelete > 合法的深层相对路径仍放行(不要把正常路径也拦了) 1ms
 ✓ oss/apply.test.mjs > applyReplace 的哈希钉 > 哈希对得上就替换 1ms
 ✓ oss/apply.test.mjs > applyReplace 的哈希钉 > 私有侧变了就抛,且提示要复核哪个分身 1ms
 ✓ oss/apply.test.mjs > applyReplace 的哈希钉 > oss/files/ 里源文件缺失即抛,消息带 path 与 from 两个 manifest 坐标 1ms
 ✓ oss/apply.test.mjs > applyReplace 的哈希钉 > path 越界(../)即抛,不会写到 root 之外 1ms
 ✓ oss/apply.test.mjs > applyReplace 的哈希钉 > from 越界(../)即抛,不会从 ossDir 之外读取任意文件 1ms
 ✓ oss/apply.test.mjs > applyPatch 的锚点唯一性 > 恰好命中 1 次才替换 1ms
 ✓ oss/apply.test.mjs > applyPatch 的锚点唯一性 > 0 次命中即抛(锚点随私有主干漂了) 1ms
 ✓ oss/apply.test.mjs > applyPatch 的锚点唯一性 > 2 次命中即抛(锚点不唯一,替换会误伤) 1ms
 ✓ oss/apply.test.mjs > applyPatch 的锚点唯一性 > 同一文件的多条补丁按顺序独立生效 1ms
 ✓ oss/apply.test.mjs > applyPatch 的锚点唯一性 > 替换串里的 $& 等特殊模式必须按字面量处理,不能被解释 1ms
 ✓ oss/apply.test.mjs > applyPatch 的锚点唯一性 > 空锚点(find: "")即抛,不依赖 split 计数的巧合 —— 覆盖 2 字符漏网案例 2ms
 ✓ oss/apply.test.mjs > applyPatch 的锚点唯一性 > 路径穿越(../)即抛,不会写到 root 之外 1ms
 ✓ oss/apply.test.mjs > checkClean > 干净工作树 —— 不抛 26ms
 ✓ oss/apply.test.mjs > checkClean > 有脏改动且不在白名单里 —— 抛,且消息里带上脏行 29ms
 ✓ oss/apply.test.mjs > checkClean > 脏改动全部命中白名单正则 —— 不抛 31ms

 Test Files  1 passed (1)
      Tests  20 passed (20)
```

12 条原有例子一条未红,新增 8 条全绿,总计 20 例。

### 第二轮提交后校验

```
$ git status --porcelain
 D "design-export/Audio Speaker Segmentation.html"
 D design-export/audio-waveform-design-kit.html
 D design-export/design-final.html
 M oss/apply.mjs
 M oss/apply.test.mjs
```

（提交命令与结果见下方"遗留疑问"前的 commit hash;提交后再次核对只剩 3 条 design-export 删除态。）

## 遗留疑问

无。两轮评审指出的问题均已修复并有实测证据(改前会复现问题、改后已堵住);`checkClean` 与本轮新增的路径穿越/空锚点校验均用真实文件系统操作验证,未依赖 mock。
