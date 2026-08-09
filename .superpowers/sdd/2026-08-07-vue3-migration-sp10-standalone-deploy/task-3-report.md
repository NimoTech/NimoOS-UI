# Task 3 报告:删掉 Vue2 桌面右上角的 `/next/` 死链

## 实现了什么

在 `NimoOS-UI`(Vue2 老仓,分支 `docs/vue3-migration-sp3`)删除了指向已不存在的
`/next/` 原型目录的死链按钮及其样式:

- `src/views/Home.vue` 模板:删掉 `<a class="enter-next" href="/next/" ...>` 整段(6 行)。
- `src/views/Home.vue` SCSS:删掉 `.enter-next { … }` 主块(41 行)+ 其后
  `@media screen and (max-width: 480px) { .enter-next { … } .enter-next__text { … } }`
  整块(11 行),外加相应空行。
- 未改任何 i18n 语言文件 —— `New homepage` / `Try the new homepage` 两个键本来就
  不在任何语言包里,随按钮一起从源码里消失即可,已用 grep 复核过零命中。
- 新建 `src/views/__tests__/Home.nextLink.spec.js`:读 `Home.vue` 源文本,断言
  `/next/`、`enter-next`、`New homepage`、`Try the new homepage` 均不再出现。

## 测了什么、结果如何

新 spec 3 条断言全过;`src/views/__tests__/` 目录下既有 4 个 spec(16 个测试)在
改动前后均保持全绿,新增 1 个 spec(3 测试)后目录合计 5 文件 19 测试全绿,没有
新增失败。未跑仓库级全量 `pnpm test`(该仓库已知有约 8 个与本任务无关的既有失败,
brief 只要求核对 `src/views/__tests__/` 这一目录,已按此执行)。

## 意外情况与我做的决定(需要你知晓)

Brief 里给的 spec 代码逐字复制后,**第一次跑不是"3 条断言失败",而是整个 suite
崩溃**:

```
TypeError: The URL must be of scheme file
 ❯ src/views/__tests__/Home.nextLink.spec.js:8:26
    readFileSync(fileURLToPath(new URL('../Home.vue', import.meta.url)), 'utf8')
```

排查(见下方 RED 部分的调试记录):这个仓库 `vitest.config.mjs` 的默认测试环境是
`jsdom`。在 jsdom 环境下,全局 `URL` 构造函数不认 `file:` scheme 的 base —
`new URL('../Home.vue', import.meta.url)`(`import.meta.url` 本身确实是正确的
`file:///.../Home.nextLink.spec.js`)会被 jsdom 的 URL 实现静默解析成
`http://localhost:3000/src/views/Home.vue`(jsdom 默认的虚拟文档地址),而不是磁盘
路径,传给 `fileURLToPath` 自然抛错。这是这个仓库(默认 jsdom)特有的坑,不是
brief 代码本身写错。

**我的修复**:在 spec 文件顶部加了一行 `// @vitest-environment node` pragma(vitest
支持按文件覆盖环境),并加了一段注释解释原因。这个测试本来就只读文件、不碰 DOM,
换成 node 环境完全无副作用。除了这一行 pragma + 一段解释注释,测试内容与 brief
给的代码逐字一致(3 条断言、描述文案都没有改)。

这不属于"行号对不上"的情况(brief 给的行号与实际文件完全吻合),所以我判断这是
可以自己处理的测试基础设施细节,没有停下来问 —— 但按要求如实记录在这里,供你复核
这个决定是否合适。

## TDD Evidence

**RED**(加 pragma 前,复现问题):
```
$ pnpm exec vitest run src/views/__tests__/Home.nextLink.spec.js
 ❯ src/views/__tests__/Home.nextLink.spec.js (0 test)
 FAIL  src/views/__tests__/Home.nextLink.spec.js [ src/views/__tests__/Home.nextLink.spec.js ]
TypeError: The URL must be of scheme file
 Test Files  1 failed (1)
      Tests  no tests
```

**RED**(加 `// @vitest-environment node` pragma后,删除前跑,真正的 3 条红):
```
$ pnpm exec vitest run src/views/__tests__/Home.nextLink.spec.js
 ❯ src/views/__tests__/Home.nextLink.spec.js (3 tests | 3 failed) 14ms
     × 模板里没有指向 /next/ 的链接 8ms
     × enter-next 的类名与样式一并清干净(含 __spark/__arrow/__text 与那条 480px media query) 3ms
     × 两个只服务于该按钮的 i18n 键也不再引用 2ms
 Test Files  1 failed (1)
      Tests  3 failed (3)
```

**GREEN**(删除三处后):
```
$ pnpm exec vitest run src/views/__tests__/Home.nextLink.spec.js
 Test Files  1 passed (1)
      Tests  3 passed (3)
```

## 反向检查证据

```
$ git diff --stat src/views/Home.vue
 src/views/Home.vue | 60 ------------------------------------------------------
 1 file changed, 60 deletions(-)
```
60 行删除、0 新增 —— 落在 brief 预期的 55–62 行区间内(模板 6 + SCSS 主块 41 +
media query 块 11 + 相应空行的净差)。

```
$ git diff src/views/Home.vue | grep '^+' | grep -v '^+++'
(无输出 —— exit code 1,即 grep 未匹配到任何一行,纯删除确认)
```

`src/views/__tests__/` 既有 spec 改动前后对比:
- 改动前(仅新 spec 存在,Home.vue 未删):4 个既有文件 16 个测试全绿(新 spec 3
  个全红,不计入"既有"对比)。
- 改动后(Home.vue 已删完三处):5 个文件(含新 spec)19 个测试全绿。
- 结论:既有测试 0 新增失败。

## 改了哪些文件

- 修改:`/home/nimo/NimoTech/NimoOS-UI/src/views/Home.vue`(纯删除,60 行 -0 行 +)
- 新建:`/home/nimo/NimoTech/NimoOS-UI/src/views/__tests__/Home.nextLink.spec.js`
- 未碰:`docs/vue3-migration-roadmap.md`、`docs/vue3-pending/*.md`(工作树里本就
  存在的其他会话未提交改动,提交前后用 `git status --short` 核对过,始终显示为
  未暂存的 `M`,没有被我的 `git add`/`git commit` 带走)。

## 自审

- **完整性**:brief 的 3a/3b/3c 三处删除、模板下一行、SCSS 下一个块的衔接,均与
  brief 描述的"删完后应当是……"逐字吻合(已用 Read 核对)。
- **质量**:测试是真的在验证行为(读真实源文件文本,不是挂载后断言渲染结构,这个
  取舍是 brief 里写明的,理由也合理——不用为 Home.vue 一堆依赖打桩)。测试输出
  干净,没有多余 console 噪音(唯一的 stdout 是 Vue devtools 提示,来自其他并跑的
  spec,与本文件无关)。
- **纪律**:提交只带了两个显式 pathspec 文件,没有用 `-A`/`.`/`-a`;没有碰
  docs/ 下任何文件;没有 checkout/stash 工作树。
- **偏离点**:上面"意外情况"一节记录的 `// @vitest-environment node` pragma 是
  对 brief 逐字代码的唯一改动,已解释原因,请复核是否需要进一步处理(例如是否要
  把这个 jsdom+file-URL 的坑记到台账里,避免以后同类 spec 再踩)。

## 疑虑/问题

- 是否需要把"jsdom 环境下 `new URL(relative, fileURLBase)` 静默错误解析"这个坑
  写进用户记忆/台账(类似已有的"CDP 探针"“vitest reporter 藏告警"那类记录)?
  这个坑以后任何"读源文件文本做守卫测试"的 spec 都可能撞上,如果这类 spec 会
  变多,提前记一笔可能省未来的排查时间。我没有主动写记忆文件,留给你判断。

---

## 追加:评审后的修复(Important 项)

评审拿本仓库实际安装的 `jsdom@19.0.0` 做了对照实测,证明我原来写的坑因解释是
**错的**:

```
jsdom URL result: file:///home/nimo/NimoTech/NimoOS-UI/src/views/Home.vue file:
node URL result:  file:///home/nimo/NimoTech/NimoOS-UI/src/views/Home.vue file:
```

两者一致 —— jsdom 的 `URL` 类本身**没有**不认 `file:` scheme base 的问题,我之前
"jsdom 的全局 URL 实现会把 file: base 静默解析成 http://localhost:3000/" 这个
归因不成立。真实崩溃是真的(RED 阶段的终端输出可信),但原因更可能出在 Vite/
vitest 对 `new URL('相对路径字面量', import.meta.url)` 这种两参数字面量形态做的
模块级静态变换上,不是 jsdom 的锅。旁证:`--environment jsdom` 显式传参下测试
仍然通过,证明钉死结果的是文件级 pragma 而不是 CLI 默认值;仓库里 `grep -rn
"@vitest-environment" src/` 在本次修复前也确实只有这一个文件,是全仓首例。

### 改了什么

`src/views/__tests__/Home.nextLink.spec.js`:

1. 删掉 `// @vitest-environment node` pragma,以及那段已被证伪的 jsdom 归因
   注释 —— 不留、也不改写成另一套未经验证的猜测。
2. 路径求值改成不依赖"相对解析"的形态(与本 SP 另一个仓 NimoOS-New-UI 的
   Task 1 `scripts/writeRootRedirect.test.ts` 同一手法):

   ```js
   import { dirname, join } from 'node:path'
   import { fileURLToPath } from 'node:url'

   const HERE = dirname(fileURLToPath(import.meta.url))
   const SRC = readFileSync(join(HERE, '..', 'Home.vue'), 'utf8')
   ```

   只让 `import.meta.url` 解析自身(它作为自身文件的 file: URL 这件事在任何
   环境下都成立),不把它当相对路径的 base 传给 `new URL(..., base)`,天然
   绕开了那层未查明的变换,不需要发明按文件覆盖测试环境这套模式。
3. 保留一行注释说明为什么不用 `new URL('../Home.vue', import.meta.url)`,但
   只写已确证的事实(“这个形态会被模块变换层特殊处理导致 suite 崩溃”),不再
   断言具体是谁的锅。
4. **三条断言字面量一个字未动**(用 `git diff` 核对过,唯一改动是 import 增加
   `node:path` 的 `dirname/join`、路径求值这几行、以及注释)。

### 跑了哪些覆盖测试

**核心证据 —— 去掉 pragma 后,在仓库默认环境(不加 `--environment` 参数)下跑
单个 spec:**

```
$ pnpm exec vitest run src/views/__tests__/Home.nextLink.spec.js
 RUN  v4.1.4 /home/nimo/NimoTech/NimoOS-UI
 Test Files  1 passed (1)
      Tests  3 passed (3)
   Duration  543ms (... environment 180ms ...)
```

`environment: 180ms`(vs. 之前带 node pragma 时的 `environment: 0ms`)说明这次
是真的跑在默认 jsdom 环境里初始化了 DOM,而不是 node 环境空转 —— 3/3 通过。

**目录级回归 —— 确认 `src/views/__tests__/` 下既有 spec 不新增失败:**

```
$ pnpm exec vitest run src/views/__tests__/
 Test Files  5 passed (5)
      Tests  19 passed (19)
```

与修复前(5 文件 19 测试全绿)一致,0 新增失败。

**确认全仓不再有按文件环境覆盖:**

```
$ grep -rn "@vitest-environment" src/
(无输出,exit 1)
```

### 提交

```
c3103110 fix(sp10): 修正 Home.nextLink.spec.js 的坑因论证并去掉全仓首例环境覆盖
 1 file changed, 9 insertions(+), 8 deletions(-)
```

只带了 `src/views/__tests__/Home.nextLink.spec.js` 一个 pathspec(`git add`
显式指定文件,非 `-A`);`Home.vue` 已在上一个提交 `9c7dc7c0` 里,本次未重复
add;提交前后 `git status --short` 核对过,docs/ 下的其他会话改动全程保持
未暂存,没有被带走。

### 自审(第二轮)

- 具名风险已解决:文件里不再有任何按文件覆盖测试环境的痕迹,以后往这个
  spec 里加需要 DOM 的用例,会自然跑在仓库默认的 jsdom 环境下,不会有"文件
  树里没有信号提示这个 spec 特殊"的坑了。
- 没有再引入任何新的未经验证的技术论断 —— 唯一保留的注释只陈述"会崩溃"这个
  已用终端输出证实的事实,没有再断言具体机制归咎于谁。
- 三条断言逐字未动,新增行只有 import 一行 + 路径求值两行 + 注释,符合"只
  改必要的部分"。
