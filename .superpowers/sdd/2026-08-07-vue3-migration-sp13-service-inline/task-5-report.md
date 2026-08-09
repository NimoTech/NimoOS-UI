## Task 5 报告:改开源导出流水线

**状态:完工。commit `c83206e`(HEAD 前置为 `089ee6c8`)。**

### 前置说明(与 brief 不符之处)

- brief Step 1 "先跑一遍 oss 测试记录改动前的绿"已由控制器确认为**作废步骤**——改动前
  `export.mjs` 就是红的(撞上 `file:../NimoOS-Service` 锚点未命中),这正是本任务要修的
  断裂点,不是别人的锅。开工前 `git status --short -- oss/` 确认 oss/ 目录本身干净,
  没有第三方未提交改动(`git diff -- oss/manifest.mjs` 也为空),不存在"叠加别人改动"
  的风险,可以直接开工。
- 行号与 brief 描述的整体一致但有 1 行漂移(比 brief 少 1 行,因为文件顶部 `1/6 前置检查`
  这条 log 早于 brief 假设的起始点):Step 2 的 diff 落在实际文件的 51-55 行(brief 写
  52-55);Step 3 落在 87-89 行(brief 写 88-89)。内容与 brief 给的 diff 逐字一致,只是
  行号计数基准差 1,不影响改动本身。
- Step 4 要删除的"内嵌共享包"整段,实际跨度是文件的 99-114 行(16 行),brief 写
  99-113(15 行)——多出的 1 行是块末尾的 `)`(`fs.writeFileSync(...)` 的收尾括号本身独占
  一行)。已确认删除边界准确:保留了紧随其后的"4.5 重算 lockfile"整段一字不动。
- manifest.mjs 里 `SERVICE_PATCH` 的实际起始注释块与 brief 引用的文本逐字比对时,首次
  用 `Edit` 工具尝试整段替换报错"字符串未找到"——排查发现是**破折号字符的视觉歧义**
  (源文件用的是 Unicode 全角破折号 `——`/框线字符 `──` 混排,与我手动转写时的字符不完全
  一致),改用 Python 脚本读原文件字节、`assert old_block in content` 校验命中后再替换,
  避免了手工转写不可见字符出错的风险。删除范围与 brief 定义的边界(从注释块开头到
  `package.json` 那个补丁对象的收尾 `},`)完全一致,下一个元素
  `{ path: 'src/index.ts', find: "import { createPhotos } …` 原样保留为新的第 1 条。

### export.mjs 六处改动(前 → 后)

1. **import 去掉 `SERVICE`**(第 8 行)
   - 前:`NEW_UI, SERVICE, DEFAULT_OUT, OSS_DIR, DIRTY_ALLOW,`
   - 后:`NEW_UI, DEFAULT_OUT, OSS_DIR, DIRTY_ALLOW,`

2. **删 Service 仓的洁净检查与 HEAD 记录**(原 52-55 行 / 实际文件 51-55 行)
   - 前:
     ```js
     checkClean(NEW_UI, dirtyAllowNewUi)
     checkClean(SERVICE, [])
     const headNewUi = git(NEW_UI, 'rev-parse', 'HEAD')
     const headService = git(SERVICE, 'rev-parse', 'HEAD')
     log(`  New-UI ${headNewUi.slice(0, 8)} · Service ${headService.slice(0, 8)}`)
     ```
   - 后:
     ```js
     checkClean(NEW_UI, dirtyAllowNewUi)
     const headNewUi = git(NEW_UI, 'rev-parse', 'HEAD')
     log(`  New-UI ${headNewUi.slice(0, 8)}(共享包已内联,不再取第二个仓)`)
     ```

3. **取源只 archive 一个仓**(原 88-89 行 / 实际文件 87-89 行)
   - 前:
     ```js
     archiveInto(NEW_UI, tmp)
     const svcDir = path.join(tmp, 'packages/service')
     archiveInto(SERVICE, svcDir)
     ```
   - 后:
     ```js
     archiveInto(NEW_UI, tmp)
     // SP13 内联后 packages/service/ 已经在 New-UI 自己的 archive 里,不再取第二个仓。
     // 这个变量保留:下面 SERVICE_DELETE / SERVICE_PATCH 两张表仍以它为基准目录。
     const svcDir = path.join(tmp, 'packages/service')
     ```
   - `applyDelete(svcDir, SERVICE_DELETE)` 与 `applyPatch(svcDir, SERVICE_PATCH)` 原样未动。

4. **删「4. 内嵌共享包」整段**(实际文件 99-114 行,16 行)
   - 前:`const pkgPath` 到 lockfile 的 `fs.writeFileSync(...)` 结束整段(重写 `file:` 一行
     + lockfile 两处 `replaceAll` + 两个"锚点未命中"守卫)。
   - 后:三行注释
     ```js
     // ── 4. 内嵌共享包 ── SP13 起私有仓本身就是内联形态(package.json 写死
     //    file:packages/service、包入口直指 TS 源码),产物树天然正确,无需任何重写。
     //    原先这里有:file: 一行重写 + lockfile 两处 replaceAll + 两个"锚点未命中"守卫。
     ```
   - 紧随其后的"4.5 重算 lockfile"整段一字未动。

5. **报告文件去掉 Service HEAD**
   - 前:`` `NimoOS-New-UI HEAD: ${headNewUi}\nNimoOS-Service HEAD: ${headService}\n` + ``
   - 后:`` `NimoOS-New-UI HEAD: ${headNewUi}(共享包已内联)\n` + ``

6.(与第 1 处合并计,brief 把 import 去 SERVICE 单列为一处,此处不重复列出)

### manifest.mjs 两处改动

1. **删 `SERVICE` 常量**(第 11 行)
   - 前:`export const SERVICE = path.resolve(HERE, '../../NimoOS-Service')`
   - 后:整行删除。

2. **删 `SERVICE_PATCH` 第 1 条**(package.json 入口改指 src 那条,连同其注释块)
   - 前:16 行注释块(标题"T13 复审 Critical:内嵌包不带构建产物…") + 1 个补丁对象
     (`{ path: 'package.json', find: …"files": ["dist"], replace: …"files": ["src"], }`)。
   - 后:
     ```js
     export const SERVICE_PATCH = [
       // 注:这里原本的第 1 条补丁把内嵌包的入口从 ./dist/index.js 改指 ./src/index.ts
       // (理由:export.mjs 用 git archive 取源,而 dist/ 在 .gitignore 里拿不到,消费方
       // 会 "Failed to resolve entry for package" —— T13 是第一个真在产出树里跑
       // pnpm install && pnpm test 的任务,才暴露出这个洞)。
       // **SP13(2026-08-07)起该补丁已上游化**:私有仓 packages/service/package.json
       // 本身就指 ./src/index.ts,原补丁的 find 锚点必然失配,故删除。
       { path: 'src/index.ts', find: "import { createPhotos } from './photos.js'\n", replace: '' },
       ...(其余 20 条一字未动)
     ]
     ```
   - `SERVICE_DELETE`(19 条)与 `SERVICE_PATCH` 剩余 20 条完全未动,未合并进主
     `DELETE`/`PATCH` 表。

### tree.test.mjs 一处改动(第 108-110 行,行号与 brief 精确一致)

- 前:
  ```js
  it('lockfile 里不再有 ../NimoOS-Service 路径', () => {
    expect(read('pnpm-lock.yaml')).not.toContain('NimoOS-Service')
  })
  ```
- 后:
  ```js
  // SP13 之后私有仓本身就写 file:packages/service,「不含 NimoOS-Service」变成没有任何
  // 路径能违反的恒真断言(守卫价值归零)。改成正向断言:锁文件必须真的指到内嵌包。
  it('lockfile 指向内嵌的 packages/service', () => {
    expect(read('pnpm-lock.yaml')).toContain('packages/service')
    expect(read('pnpm-lock.yaml')).not.toContain('NimoOS-Service')
  })
  ```

### Step 7 验证命令实际输出

```
$ node --input-type=module -e "import('./oss/manifest.mjs').then(m=>{
  console.log('SERVICE_PATCH', m.SERVICE_PATCH.length, '(期望 20)');
  console.log('SERVICE_DELETE', m.SERVICE_DELETE.length, '(期望 19)');
  console.log('第一条应是 src/index.ts:', m.SERVICE_PATCH[0].path);
  console.log('SERVICE 常量应已删:', 'SERVICE' in m);
})"
SERVICE_PATCH 20 (期望 20)
SERVICE_DELETE 19 (期望 19)
第一条应是 src/index.ts: src/index.ts
SERVICE 常量应已删: false
```
四行全部与预期一致。

### `pnpm exec vitest run oss/` 实际数字

```
 Test Files  6 passed (6)
      Tests  138 passed (138)
   Start at  16:14:28
   Duration  13.42s (transform 1.45s, setup 1.63s, import 636ms, tests 15.76s, environment 2.12s)
```
6 个测试文件(`apply.test.mjs` / `dist-scan.test.mjs` / `export-rsync.test.mjs` /
`forbidden.test.mjs` / `media-wave.test.mjs` / `tree.test.mjs`)全绿,138 例 0 失败。

补充用 `--reporter=verbose` 单跑 `oss/tree.test.mjs` 逐条核对了 brief 点名的几条断言:
- `内嵌共享包 > Service 落到 packages/service/,package.json 的 file: 指过去` ✓ 通过(对应
  brief 的 101-106 行落位断言)
- `内嵌共享包 > lockfile 指向内嵌的 packages/service` ✓ 通过(改后的正向断言本身)
- `E13:Service 不再导出 photos / PhotoAsset` ✓ 通过(对应 brief 的 237-244 行接线补丁断言)
- `台账目录两个仓都不能进产物树(存在性判据,不依赖词表)` ✓ 通过(对应 brief 的 89-96 行)
- `产物树能构建 > pnpm install + vue-tsc --noEmit 在产物树上全绿` ✓ 通过,耗时 9355ms
  (对应 brief 点名的 `tree.test.mjs:707` 最重的一条)

66 例(`tree.test.mjs` 单文件计数)全部通过,与全批 138 例一致(无跳过、无 skip)。

### commit

```
commit c83206e
refactor(sp13/oss): 导出流水线改为只 archive 一个仓
3 files changed, 18 insertions(+), 48 deletions(-)
```
`git status --short` 提交后仅剩 3 个 `design-export/*` 的删除态(与本任务无关的既有工作树
状态),未被本次提交带入、也未被 `git add` 误吸收。

### 顾虑

无实质性顾虑。唯一值得记录的是上面"前置说明"里提到的两处行号差 1/差 1 的漂移
——都已核实是 brief 计数基准与实际文件之间的偏差,不影响改动内容本身,diff 逐字比对
与 brief 给出的 diff 完全一致。
