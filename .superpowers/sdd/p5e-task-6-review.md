# P5e Task 6 独立评审(T6:SearchView.vue 上半)

评审者:sonnet(双重降级刀:实现 sonnet + 评审 sonnet)。开工时间戳见下方各命令输出。

## 0. 环境自查


`git status --porcelain` 空;stash 两条(2026-07-18 / 2026-07-06,均非本次操作产生)一个未碰。

## §1 协调者抽验四处 —— 独立复核

| 抽验 | 独立复现 |
|---|---|
| `.vue` 总数 185 | ✅ `git ls-files src \| grep -c '\.vue$'` = 185 |
| test 文件 335 | ✅ `find src -name '*.test.ts' \| wc -l` = 335 |
| 范围边界零实际代码命中 | ✅ 剥注释后 `fetchBlobUrl`/`openOriginal`/`downloadFile`/`onDrawerToast`/`<FileDetailDrawer`/`<KFileViewer` 全部 0 处命中(裸 grep 命中 3 处,均在注释:`:12` 范围声明/`:23`/`:412`) |
| R25 申报注释 | ✅ `:18-26` 有完整申报注释,`:34` import,零 KFileViewer import |

## A. 过期守卫两条 RED 探针 —— 独立复现

### T5 guard 复现(删 FileDetailDrawer import)

- 探针:`cp` 备份(md5 `edbfab91c77f0a4ebcce4c521e03da69`)→ 删除 `import FileDetailDrawer ...` 整行 → md5 变为 `5b69b5a7953c54d260576ffec8944e12`(证明注入落盘)。
- 结果:`FileDetailDrawer.test.ts` 的 T5 DoD-12 守卫 **报红**;`SearchView.test.ts` 自己的"范围自证"用例(检查 import 存在)也报红(预期,两条独立断言)。
- 还原:`cp` 覆盖 → md5 恢复 `edbfab91c77f0a4ebcce4c521e03da69` → 复跑 `FileDetailDrawer.test.ts` + `SearchView.test.ts` = **71/71 passed**。
- 结论:**T5 那条上膛守卫确实有牙,不是摆设**。


### run() 过期守卫两条,独立复现(不采信报告,自己动手)

**探针①(逻辑层)**:自己写 python 脚本(不是照抄报告的 sed,是独立构造)把两处
`if (myEpoch !== runEpoch) return` 全部替换成 `if (false) return`(`grep -c` 确认命中 2 处、md5 变化确认落盘)。
结果:`① 逻辑交错` **报红**,`② 两实例交错` **不受影响仍绿**。还原后 md5 核对一致,复跑 34/34。

**探针②(作用域层)**:自己写 python 脚本,在 SFC 顶部插入独立的非 setup `<script lang="ts">` 块声明
`export const __indepProbeEpoch = { v: 0 }`(变量名与 T6 报告不同,验证不是巧合),删掉
`let runEpoch = 0` 声明,把所有 `runEpoch` 替换成 `__indepProbeEpoch.v`。md5 变化确认落盘。
结果:`② 两实例交错` **报红**,`① 逻辑交错` **不受影响仍绿**。还原后 md5 核对一致,复跑 34/34。

**结论:两条过期守卫独立报红,各自钉住不同维度(逻辑正确性 vs 变量作用域),非摆设。**


## B. N40 第③条判别力 —— 独立坐实

**探针(独立构造)**:把 `if (v && v !== q.value) {` 改成 `if (v) {`(删掉 handler 内部条件),md5 变化确认落盘。
结果:③ **报红**(`spy` 被多调用 1 次),①② **不受影响仍绿**。还原 md5 一致,复跑 34/34。

**判别力结论(不是靠 watch 源去重蒙过的)**:自己读用例代码(`SearchView.test.ts:761-780`)——
挂载时 route.query 无 `q`(`undefined`),immediate watch 触发但 `v` 为空不搜;然后**手动**
`input.setValue('manual')` 把 `q.value` 直接设为 `'manual'`(不经过路由,此步不触发 watch,因为 watch 源
`route.query.q` 仍是 `undefined`);再 `router.push({query:{q:'manual'}})` 把 watch **源**从
`undefined` 变成 `'manual'` —— 这是一次真实变化,Vue watch **一定会调用 handler**(不会被源级 `Object.is`
去重挡住,因为源真的变了)。handler 内部 `v !== q.value` 才是本条真正测的东西:此时 `v==='manual'`
且 `q.value==='manual'`(已被手动设过),条件为 false,不应再发。**RED 探针证实**:去掉这层内部判断后
`spy` 确实多调用了一次——证明测试路径真的走到了 handler 内部并执行了这行判断,不是在 watch 源头就被拦下、
从未到达被测代码。**T6 自证的构造思路(先手动改 `q.value` 再 push 相同值)是让 watch 源产生真实变化、
同时让 handler 内部条件恰好为 false 的正确手法,不是空转用例。**


## H. 两条自动上膛守卫 —— 独立复现

### ① T5 DoD-12 那条(已在上面 A 节做过,再引一次)
删 import → 报红(见上)。走"已存在"分支,`FileDetailDrawer.test.ts:645-653` 的实际断言分支确认为
`existsSync===true` → `expect(src).toMatch(/FileDetailDrawer\.vue/)`,已满足。

### ② T6 自建那条 —— 惰性证明 + 上膛证明(两种偏态各一次,独立构造)
- **惰性证明**:`--reporter=verbose` 确认该用例在 **passed** 列表且非 skip/todo(见上方输出)。
- **偏态①(只写 markup,零监听)**:注入 `<FileDetailDrawer v-if="openFile" :file="openFile" :query="lastQuery" />`(零监听)
  → md5 变化确认落盘 → **该守卫 + "范围自证" 两条同时报红**(预期,两条独立断言)。
- **偏态②(接了 3/4,漏 `@toast`)**:补 `@close`/`@open`/`@download` 三个,故意漏 `@toast`
  → **仍然报红**(证明是"四个都要"而非"接了任意几个就算")。
- **补全 4/4** → 自动上膛守卫转绿,"范围自证" 仍报红(预期:后者钉的是"不许有 markup",与监听数无关)。
- 还原(`cp` + md5 核对一致)→ 复跑 34/34。

**结论:两条自动上膛守卫均货真价实,且 T6 对自建守卫的两种偏态都做了验证,判据齐全。**


## F. mock 层次与 fixture —— 逐字节核对

- `knowledgeStore.ts:550-561` 自己读过:`runSearch` 直接 `return service.ai.searchText(body)`,零归一化 —— 确认 mock 必须是 snake_case,T6 的四个 fixture(`hits`/`files`/`stats`/`warnings`,`cite.chunk_no`/`preview.text`/`paths[].mtime_ms`)确认是原始蛇形字段,未搞反。
- `F1`/`F4` 与仓库 `.superpowers/sdd/p5e-fixtures/` 原文件**逐字节比对一致**(cat 输出与测试文件字面量相同)。
- `F11-rerank-warning.CONSTRUCTED.json`:确认 D-6 模具、含 `_provenance` 等 3 个下划线台账键,测试文件已删除这 3 个键,其余字段(`hits/files/stats/warnings`)逐字节一致。测试注释正确标注 CONSTRUCTED 且引用裁定 R2(rerank 真机不可达)。**未被当成真机可达依据使用**(只用于 N38 正向断言,非验收清单项)。
- `F5b`:自己写 python 脚本重算 8 条 `preview.text` 的**前 70 字符 + len + sha256**,与测试文件里的 8 条字面量、8 条注释里的 `len=`/`sha256=` **逐条精确匹配**;`file_id`/`mime`/`kind`/`score`/`paths[].root_id/path/mtime_ms` 也逐字段核对一致。**零条完整正文**贴入测试文件,符合 R9-3。
- 测试文件里只许贴 1-2 条完整正文的要求:F5b 用截断+校验和方式处理,完整正文的等价校验按报告所述已在 `FileDetailDrawer.test.ts` 里做过(未在本次评审范围内重复核实该claim,但本刀自身未违反"零条完整正文"的约束)。

**结论:F 项零缺陷。**


## C. N33–N40 是否被"顺手修正" —— 逐条比对蓝本原文(非信报告)

自己写 python 脚本抽取蓝本对应片段与 New-UI 对应片段并肉眼逐字对比:

- **N34**(`advEnabled`):蓝本 `types.size < FILE_TYPES.length || mtime !== 'any' || quality !== 'fast' || topK !== 10`
  与 New-UI `computed` **逐字符相同**(全选=未启用的反直觉判据未被"修正")。5 条用例(全选侧 + 四个 or 分支)独立验证。
- **N35**(`MIME_PREFIXES`):抽取两侧常量块对比 **逐字节相同**(`md` 仍只有 `text/markdown`,未补 docling 变体;
  `txt` 仍只有 `text/plain`;`doc` 仍是三个 docling 变体)。3 条用例(全选不发 / 取消一类按声明序发 / 只留 code 验 txt)。
- **N36**:`MONTH_MS = 30*24*3600*1000`、`YEAR_MS = 365*24*3600*1000` 与蓝本 `:217-219` 逐字相同。
  自己算过三个假时钟值(`NOW=1_700_000_000_000` 时:`1w→1699395200000`,`1m→1697408000000`,`1y→1668464000000`)
  与用例的符号表达式结果一致(测试文件在 `:588-590` 独立声明同名常量,不是从被测模块 import,若源码算错会被抓到)。
- **N37**:`run()` 的 `catch` 分支(`:231-236`)确认**不设 `ms`**,与蓝本 `:312-315` 一致。用例证明上次 `ms` 保留。
- **N38**:`grep onBeforeUnmount/onMounted` 全文件只在注释里出现,**零实际 lifecycle hook 调用** —— 确认没加清理,照抄蓝本无清理的行为。用例用假时钟验证正反两向。
- **K51**:`toggleSet` 用 `new Set(set)` 复制再整体赋值给 `types.value`,**不是** `reactive(new Set())` 就地 add/delete —— 确认按裁定要求的形态。

**结论:C 项零缺陷,N33–N40 全部忠实照抄,无一条被"顺手修正"。**

## D. K51 toggleSet —— 已在 C 项核实,零缺陷。

## E. run() 四态分支 —— 逐条验证

- idle(空 query,不发请求)· results(F5b,4 文件/8 chunk)· empty(F1)· error 三档(message-only / response.data.error 优先 / 两者皆无→String(e))**全部有独立用例**,已读代码确认 `errorMsg` 取值逻辑
  `(err.response && err.response.data && err.response.data.error) || err.message || String(e)` 与蓝本逐字相同。

**结论:E 项零缺陷。**


## G. 范围边界 —— 已在 §1 完成(先剥注释再 grep,零实际代码/markup 命中)。

## I. 模板内零裸色

自己 `grep -n 'style="\|color="'` 蓝本全文,命中 **16 处**,与 T6 报告/E-57 结论一致。
按行号切分:T6 范围(`:1-119`+`:158-162`)= 12 处,T7 范围(`:121-156`)= 4 处 —— 与 T6 报告的切分表逐行核对一致。
12 处中逐条检查:4 处已是 `var(...)` token(`:8`/`:26`/`:159` 里的 accent/text-tertiary/danger),
其余 8 处是纯尺寸/排版(`display`/`width`/`height`/`flex`/`gap`/`justify-content`/`font-size`/`text-transform`/
`letter-spacing`/`font-weight`/`margin-top`),**零色字面量**。
`K44` 确认 `.vue` 侧零 `<style>` 块(见 A 节 RED 探针),该文件已加入 `KNOWLEDGE_VUE_FILES`(color-guard 187 已实测)。

## J. 三门与数字 —— 独立复跑

- `pnpm test`(全量,`--reporter=verbose`):**Test Files 335 passed (335) / Tests 4215 passed (4215)**,日志完整落盘 `/tmp/.../t6-full-test.log`(70s,未截断)。
- `pnpm exec vue-tsc --noEmit`:**exit 0**。
- `pnpm build`:**exit 0**(13.80s,产物正常生成,仅有 chunk 体积警告,非错误)。
- `.vue` 总数 **185**(`git ls-files src | grep -c '\.vue$'`)。
- `color-guard.test.ts` **187 passed**。
- `git diff da9f818 216c850 -- package.json pnpm-lock.yaml src/styles/color-guard.test.ts src/ai/styles/knowledge.scss src/ai/knowledge/util/searchAggregate.ts src/ai/knowledge/util/searchAggregate.test.ts src/ai/knowledge/components/KFileViewer.vue src/ai/knowledge/components/KFileViewer.test.ts src/ai/knowledge/components/FileDetailDrawer.vue src/ai/knowledge/components/FileDetailDrawer.test.ts src/ai/knowledge/stores/knowledgeStore.ts src/ai/knowledge/knowledgeRoutes.ts src/ai/knowledge/deferred.ts src/files/viewers/** src/i18n/`:**零输出,全部零改动**。
- `git show 216c850 --stat`:确认提交只含 4 个文件(`p5e-task-6-report.md` / `SearchView.test.ts` / `SearchView.vue` / `knowledgeStyles.test.ts`)。
- `knowledgeStyles.test.ts` 的 diff **只 +1 行**(`'views/SearchView.vue',` 插入 `KNOWLEDGE_VUE_FILES` 数组)。
- 归因表自洽性:`grep -c "it.each(KNOWLEDGE_VUE_FILES)"` = **4**,与 T6 声称的"4 个 it.each 循环各 +1"一致;
  `34(SearchView.test.ts 自身)+4(knowledgeStyles 四循环)+1(color-guard 动态)=39`,`4176+39=4215` 与全量实测一致。

## K. 缺口猎 —— 独立 RED 探针(不采信报告,自己动手构造)

| 探针 | 做法 | 结果 |
|---|---|---|
| N39 clear() | 删除 `openFile.value = null; viewerFile.value = null` 两行 | **N39 用例报红**,有判别力 |
| K44 零 style | 文件末尾追加 `<style scoped>.foo{color:red}</style>` | **K44 用例报红**,有判别力 |
| N36 "any" 分支 | `if (mtime.value !== 'any')` 改成 `if (true)` | **N36 的 "any" 用例报红**,其余三档不受影响,有判别力 |
| run() 过期守卫①② | 见前述 A 节 | 各自独立报红 |
| N40③ | 见前述 B 节 | 报红,证明非源级去重蒙混 |
| T5/T6 自动上膛守卫 | 见前述 H 节(含两种偏态) | 均报红 |

以上 7 类探针**全部独立构造、不照抄报告脚本**(变量名/触发点均自选),结果与报告声称一致。
每次探针前后均 `cp` 备份 + `md5sum` 核对落盘/还原,最终 `git status --porcelain` 为空。
**未发现空转用例、未发现被削弱/放宽的既有断言、假时钟用例全局 `afterEach` 统一 `vi.useRealTimers()` 收尾(第 260 行),无遗漏**。
`phase==='results'` 分支确认是空容器 `<div class="k-results" />`,**没有被写成"看起来有内容"的假实现**。

## 总体结论

**Critical 0 / Important 0 / Minor 0。** T6 的 12 项必查全部独立复现通过,fixture 逐字节核对无造假,
过期守卫、N40③、两条自动上膛守卫均有真实判别力,范围边界、mock 层次、N33-N40 忠实照抄、三门数字、
零改动文件清单全部独立验证成立。**T6 可以关账,放行进 T7。**
