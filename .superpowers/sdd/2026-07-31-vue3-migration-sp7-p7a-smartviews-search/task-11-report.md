# Task 11 报告:`stores/search.ts`

## 实现内容

新建 `src/photos/stores/search.ts`(Pinia setup store `photosSearch`)+ `src/photos/stores/__tests__/search.test.ts`。

导出:
- `SEARCH_PAGE_LIMIT = 50`
- `usePhotosSearch`:state `results/query/filtersPayload/offset/exhausted/loadingMore/ms/isSearchMode`;actions `smartSearch(query, filters?)` / `loadMore()` / `clear()`;函数 `matchesQuery(q)`;`__resetForTest()`。

体例照 `src/photos/stores/places.ts`(setup store、`service` 直连、`__resetForTest` 收尾)。`matchesQuery` 直接复用 T10 落地的 `searchStateMatchesQuery`(`../util/searchSort`),未重写。

## 回源核对结果(逐条)

| brief 断言 | 源码真值(`NimoOS-UI/src/store/modules/photos.js`) | 结论 |
|---|---|---|
| E1:`ms` 用 `Date.now()` | `:658` `const t0 = performance.now()`,`:667` `performance.now() - t0` | **brief 错,已按控制器裁定用 `performance.now()`,测试 `vi.spyOn(performance,'now')`** |
| E2:`exhausted = results.length < LIMIT \|\| fresh.length===0` 里的 `results` 是累计总数 | `:381-390` mutation `APPEND_SEARCH_RESULTS(state, {results, offset})`——`results` 是本次响应的原始页(去重前),`fresh` 是去重后新增;`state.searchResults` 才是累计总数 | **brief 措辞会误导,已按控制器裁定用"本次新页原始条数"实现,brief Step1 的用例是对的** |
| E3:seq 递增在空查询早退之前 | `:655-657`:`const seq = ++smartSearchSeq` 先于 `if (!query.trim())`,注释原文"任何一次 dispatch(含清空)都使在途旧响应作废——序号递增必须先于早退分支" | **确认属实**;brief 代码块顺序相反,但因为 brief 结构规格 4 要求 `clear()` 自己 bump seq,两种写法等价——已按"先早退到 clear() 由它 bump"实现,并按裁定补了 E3 用例(空查询变体) |
| E4:loadMore 只有 Vue2 的查询串比对,没有 seq 守卫;查询串比对有同词重搜漏洞 | `:677-692` 只有 `if (state.searchQuery !== query) return`(:686),无 seq 相关代码 | **确认属实**;已叠加与 `smartSearch`/`clear` 共用的同一把 `searchSeq` 锁,补齐 E4 用例 |
| 共享包签名 | `.sp7/NimoOS-Service/src/photos.ts:103` `smartSearch(query, limit=50, offset=0, filters={})`,内部 `body<unknown>(res.data)` 透传裸响应 | 属实,`res` 就是裸数组,未再取 `.data` |
| `filters` 在 Vue2 恒为 `{}` | 唯一 dispatch 点 `PhotosTimeline.vue:652` `dispatch('photos/smartSearch', { query })`,不传 filters | 属实,已在代码注释 + 本报告"交接事实"登记 |

## 偏离登记

1. **`clear()` 里 bump `searchSeq`**(`search.ts:52` `searchSeq++`)。Vue2 `CLEAR_SEARCH`(`:392-401`)没有任何 seq 相关代码,清空之后若仍有在途响应会把结果写回来。改为清空时也让在途响应的 `mine !== searchSeq` 判断失败。注意是**递增**,不是拨回 0(拨回 0 会在 `__resetForTest` 场景下制造别名冲突,同 `places.ts:426-429` 的理由)。
2. **`smartSearch` catch 分支状态推进(§7e-12)**(`search.ts:81-93`)。Vue2 `:664-666` 失败时只 `console.error`,不动 `query`/`isSearchMode`/`results`。缺陷:失败后 `searchQuery` 还停在上一次成功的旧词,`matchesQuery(新词)` 恒假,视图无法区分"还没收到响应"与"收到了但失败了",永久停在"搜索中"。改为失败时把状态推进到"这个词搜过了、零结果"(`isSearchMode=true, query=trimmed, results=[], exhausted=true`),视图落到空态而不是死循环转圈。**这是新增第 12 条 Vue2 缺陷,回填 spec §7e。**
3. **`smartSearch` catch 分支自己的 seq 守卫**(`search.ts:79` `if (mine !== searchSeq) return`,在 `console.error` 之前)。Vue2 catch 完全没有守卫。理由:失败响应本身也可能已经过期(被更晚发起的搜索或 clear() 超越),这时不该用旧词的失败状态覆盖新搜索已经写入的成功状态,也不该为一次已经无意义的失败打日志噪声。**这条不在 brief 清单里,是我在实现时补的,已单独配用例验证(见下"新增测试")。**
4. **`loadMore` 叠加 seq 守卫(E4)**(`search.ts:116` `if (mine !== searchSeq) return`,与 Vue2 :686 的查询串比对并存)。修 Vue2 的真竞态(同词重搜时查询串比对误判通过,深页污染新结果集/offset)。

## 删码验证清单

| # | 删了什么 | 结果 | 备注 |
|---|---|---|---|
| ① | `smartSearch` 成功路径的 `if (mine !== searchSeq) return` | **红**(4 例:后发先回、先发先回、clear 后不回填、E3 空查询变体) | |
| ② | catch 里 §7e-12 的状态推进(6 行赋值) | **红**(1 例:失败守卫用例) | |
| ③ | `clear()` 里的 `searchSeq++` | **红**(2 例:clear 后不回填、E3) | |
| ④ | `loadMore` 的查询串比对(`if (query.value !== capturedQuery) return`) | **未红**(0 例,20/20 仍绿) | 见下"守卫遮蔽分析" |
| ⑤ | 去重的 Set(替换成 `const fresh = raw`) | **红**(2 例:去重用例、fresh.length===0 用例) | |
| ⑥ | `exhausted` 的 `\|\| fresh.length === 0` 那半 | **红**(1 例:fresh.length===0 用例) | |
| ⑦ | `finally` 的 `loadingMore = false` | **红**(1 例:失败复位用例) | |
| ⑧(补充) | `loadMore` 新增的 seq 守卫(`if (mine !== searchSeq) return`,单独删、保留查询串比对) | **红**(1 例:E4 用例) | 证明 ④⑧ 并非互相冗余,只是"同时删④和当前测试组合"时被 ⑧ 遮蔽,见下 |
| ⑨(补充) | `smartSearch` catch 里的 seq 守卫 | 首次删除**未红**(20/20 绿)→ 补测试后重删,**转红** | 见下 |

### 守卫遮蔽分析(④):查询串比对 vs seq 守卫

单独删除④(查询串比对),保留⑧(seq 守卫)时,`pnpm exec vitest run` 全绿(20/20),**没有测试变红**。逐一核实原因:store 里唯一两处会修改 `query.value` 的地方是 `smartSearch`(成功/§7e-12 失败路径都会写)和 `clear()`,而这**两处也同时都会 bump `searchSeq`**——也就是说在本 store 当前实现下,`query.value` 发生任何变化必然伴随 `searchSeq` 递增,没有"query 变了但 seq 没变"的可达路径。所以查询串比对这道 1:1 保留的 Vue2 防线,在本实现里对**通过 store 公开 API 触发的**任何场景都是 seq 守卫的严格子集,单独删除测不出区别。

反过来验证:单独删除⑧(seq 守卫,保留④)后跑测试,**E4 用例转红**(旧页被 concat、`offset` 被拨到 50)——证明④和⑧覆盖的不是同一件事:④单独存在时拦不住"同词重搜"(E4 场景,查询串比对因为词相同而误判通过);⑧单独存在时能拦住 E4,也顺带覆盖了④原本要拦的"改词"场景(因为改词必然伴随 seq 变化)。

**如实结论**:④(查询串比对)在当前 store 实现下是死代码保险丝——按 1:1 移植纪律保留(源码 `:686` 确实有这行,删掉会偏离"行为严格 1:1"的字面要求),但它单独提供的额外保护已被⑧完全覆盖,凭公开 API 测不出它的独立价值。**没有为了让它测出红而堆砌不自然的测试**(例如绕过 `smartSearch`/`clear` 直接给 `store.query.value` 赋值来制造"query 变但 seq 不变"的场景——这不是任何真实调用路径会发生的情况,写这种测试只是自欺)。

### 补充发现并修复:catch 里的 seq 守卫(⑨)最初无测试覆盖

删除该守卫后跑测试,20/20 全绿——说明当时的用例集里没有一条覆盖"过期的失败响应"这个场景(brief 用例清单本身也没要求这条)。判定这是一个真实的覆盖缺口(不是死代码,因为它防的场景——A 慢、最终 reject,B 快、成功,A 的失败姗姗来迟——是真实可达的竞态),补了一条新用例:
> 搜 A(慢,最终 reject)→ 搜 B(快,成功)→ A 的失败姗姗来迟 → `query` 仍是 `'B'`、`results` 仍是 B 的、`console.error` 未被调用(证明过期失败连日志都不该打)。

补测试后重新执行"删→跑→红→复原"流程:删除该守卫后此用例转红(`query` 被 A 的过期失败状态覆盖成 `'A'`),复原后 21/21 全绿。已把该守卫和用例一并保留。

**所有 9 项删码验证均已完成一次"删→跑→(红/未红,如实记录)→ Edit 手工复原"**,复原后 `diff` 全文件与验证前的快照逐字节比对,**完全一致**。未使用 `git checkout --`。

## 交接下游的事实(T15/T16)

1. **`filtersPayload` 管道当前无人喂**:Vue2 全仓唯一 `dispatch('photos/smartSearch', ...)` 调用点(`PhotosTimeline.vue:652`)从不传 `filters`,恒为 `{}`;Vue2 的 6 个筛选 chip(date/people/place/type/album/src)是**纯客户端 narrow**(`PhotosSearchView.vue:395` 注释写明),不经过这条管道。本 store 的 `smartSearch(query, filters)` / `loadMore()` 复用 `filtersPayload` 的行为是 1:1 照搬,但**T16 若要接筛选 chip,不要指望这条管道生效**——chip 筛选应该是消费方(T15 结果网格)对 `results` 做本地 filter,不是改这里的 `filtersPayload` 再重新请求。
2. **`ms` 单位是 wall-clock 毫秒**(`performance.now()` 差值),不是 `Date.now()`。
3. **`matchesQuery(q)` 用于消除"路由 q 已是新词、store 还是旧词/失败兜底"的窗口期双结果集闪烁**——T16 接线时应先判 `matchesQuery(路由的 q)` 再决定渲染 `results` 还是在途/空态骨架屏,和 Vue2 `PhotosSearchView.vue` 的用法一致。
4. **搜索失败会让 `matchesQuery(该词)` 变真、`results=[]`、`exhausted=true`**(§7e-12 修复),T15/T16 不需要额外处理"失败后永久 loading"这个 Vue2 老毛病,直接按空结果集渲染空态即可。
5. **`searchActive` 未迁**——New-UI 用路由(`/photos/search`)承担"搜索面板是否打开"的语义,`isSearchMode` 只表示"已经真正搜过、有结果可展示"。

## 测试与结果

- 聚焦测试:`pnpm exec vitest run src/photos/stores/__tests__/search.test.ts` → **21 passed (21)**
- 全量:`pnpm exec vitest run` → **305 files passed, 3376 tests passed**(全仓,含本任务新增的 1 个 store + 21 个用例)
- 类型检查:`pnpm exec vue-tsc --noEmit` → 无输出(通过)

### TDD Evidence

**RED**(`../search` 尚不存在时跑测试):
```
$ pnpm exec vitest run src/photos/stores/__tests__/search.test.ts
 FAIL  src/photos/stores/__tests__/search.test.ts [ src/photos/stores/__tests__/search.test.ts ]
Error: Failed to resolve import "../search" from "src/photos/stores/__tests__/search.test.ts". Does the file exist?
 Test Files  1 failed (1)
      Tests  no tests
```
应该失败:store 文件尚未创建,导入必然报错,20 条断言全部执行不到。

**GREEN**(实现后):
```
$ pnpm exec vitest run src/photos/stores/__tests__/search.test.ts
 Test Files  1 passed (1)
      Tests  20 passed (20)
```
(后续补了 1 条 catch-seq-guard 用例,最终 21 passed。)

## Files changed

- `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/photos/stores/search.ts`(新建)
- `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/photos/stores/__tests__/search.test.ts`(新建)

## Self-review 发现

- 每条断言过了一遍"什么改动会让它变红"——④(loadMore 查询串比对)确认在本实现下确实无区分力,已如实记录,未伪造用例。
- ⑨(catch 里的 seq 守卫)最初漏了覆盖,已发现并补测试,重新走完删码验证流程。
- 未发现"静默丢弃 Vue2 有的东西"——`filtersPayload` 管道虽然当前无人喂,但管道本身完整保留,已作为交接事实登记而非丢弃。
- 8 个 state 字段的 `clear()` 复位、`loadMore` 三种早退条件(query 空/exhausted/loadingMore)均有独立用例覆盖。
- 未在注释中写入字面 `#hex`/`rgba(`/`<style>`(已 grep 确认)。

## Concerns

无实质性阻塞。唯一值得下游知晓的是 `filtersPayload` 管道当前空转(见"交接事实"第 1 条),避免 T16 误以为改这条管道就能接筛选 chip。

---

# Fix Round 1(评审回来后的整改)

评审结论:Spec ✅ / Task 质量 Needs fixes,0 Critical + 2 Important + 10 Minor(控制器把 8 条 Minor 并入一次收干净,共 10 项)。以下逐项记录改了什么、覆盖它的测试、验证命令与输出原文。

## I1(Important)—— `String()` 铁律有代码、零测试覆盖

**改了什么**:`search.test.ts` 新增一条用例(`describe('loadMore')` 内,"I1 用例"),首页塞 1 条 `{ id: 7 }`(number),新页塞同值 `{ id: '7' }`(string),断言去重后只新增 49 条(而不是 50,即 `'7'` 与 `7` 被正确识别为同一条)。`search.ts` 代码本身未改(String() 铁律代码此前就在,只是没有测试逼它执行到 number 分支)。

**覆盖测试**:`src/photos/stores/__tests__/search.test.ts` 里的 "I1 用例(Vue2→Vue3 铁律):首页含 number 型 id、新页含同值 string 型 id → 仍判定为重复,不能被当成两条不同记录"。

**变异验证**:把 `search.ts` 的
```ts
const seen = new Set(results.value.map(p => String(p.id)))
const fresh = raw.filter(p => !seen.has(String(p.id)))
```
改成
```ts
const seen = new Set(results.value.map(p => p.id))
const fresh = raw.filter(p => !seen.has(p.id))
```
后跑 `pnpm exec vitest run src/photos/stores/__tests__/search.test.ts`:
```
❯ src/photos/stores/__tests__/search.test.ts (23 tests | 1 failed) 20ms
   × I1 用例(Vue2→Vue3 铁律):首页含 number 型 id、新页含同值 string 型 id → 仍判定为重复,不能被当成两条不同记录 4ms
AssertionError: expected [ { id: 7, ... }, …(99) ] to have a length of 99 but got 100
 Test Files  1 failed (1)
      Tests  1 failed | 22 passed (23)
```
转红后用 Edit 手工还原为 `String(p.id)` 写法,复跑确认 23/23 全绿。

## I2(Important)—— 空查询用例的两条恒真断言

**改了什么**:重写"空/全空格 query"用例。旧版直接在全新 store 上调 `smartSearch('   ')`,`results`/`isSearchMode` 本就是初值,断言恒真。新版先 `await s.smartSearch('cat')` 拿到 3 条非空结果、`isSearchMode=true`、`ms>=0`,清掉 mock 调用记录后再传空查询,断言 `smartSearchApi` 未被调、且 `results/query/isSearchMode/exhausted` 全部复位。

**覆盖测试**:`search.test.ts` "I2 用例:先搜出非空结果,再传空/全空格 query → 真正走 clear() 语义,复位所有字段(而非"本来就是空")"。

**变异验证**:把 `search.ts` 的 `if (!trimmed) { clear(); return }` 改成 `if (!trimmed) { searchSeq++; return }`(保留 seq bump、去掉真正的清空)后跑测试:
```
❯ src/photos/stores/__tests__/search.test.ts (23 tests | 1 failed) ...
   × I2 用例:... 4ms
AssertionError: expected [ {...}, {...}, {...} ] to equal []
 Test Files  1 failed (1)
      Tests  1 failed | 22 passed (23)
```
只有这一条用例变红,无连带失败。Edit 还原为 `clear()`,复跑 23/23 全绿。

## M3 + M4(并入)—— 两处 Vue2 行号引错

**改了什么**:
1. 文件头注释第 3 行 `:29-31 (smartSearchSeq...)` → 改为 `:24-27(smartSearchSeq 声明+文档注释;"任何一次 dispatch..." 那句 verbatim 引自 :655,不在 :24-27 这段文档注释里——上一轮报告曾误引成 :29-31,已改正)`。
2. `search.ts:36-38`(searchSeq 声明处注释)同步改为 ":24-27" + ":655" 的正确引用。
3. `search.ts:88`(catch 分支的 §7e-12 偏离登记)从 "Vue2 :664-666 失败时只 log" 改为 "Vue2 catch 分支(:669-671,console.error 在 :670)失败时只 log"——这是评审点名"报告偏离登记 2 重复了同一个错号"的那一处,§7e-12 这条偏离的唯一源码凭据。

**回源核对**(逐条 `sed -n` 验证):
```
$ grep -n "SEARCH_PAGE_LIMIT = 50\|let smartSearchSeq\|searchStateMatchesQuery\|async smartSearch(\|console.error('\[photos\] smartSearch'\|async loadMoreSearchResults\|CLEAR_SEARCH\|clearSearch(" photos.js
22:const SEARCH_PAGE_LIMIT = 50
27:let smartSearchSeq = 0
29:// searchStateMatchesQuery:...
32:export function searchStateMatchesQuery(state, query) {
392:    CLEAR_SEARCH(state) {
654:    async smartSearch({ commit }, { query, filters }) {
657:      if (!query.trim()) { commit('CLEAR_SEARCH'); return }
670:        console.error('[photos] smartSearch', e)
677:    async loadMoreSearchResults({ state, commit }) {
694:    clearSearch({ commit }) { commit('CLEAR_SEARCH') },
```
确认:smartSearchSeq 声明+文档注释在 :24-27(:24-26 注释 + :27 声明);:29-31 是 `searchStateMatchesQuery` 的文档注释;"任何一次 dispatch..." 那句实际在 :655(`grep -n "任何一次 dispatch(含清空)都使在途旧响应作废" photos.js` → `655:`);catch 块在 :669-671,`console.error` 在 :670。

**顺带发现并修正一处未被评审点名的同类错误**:`search.ts:23`(现 :25)原写 "Vue2 :246 searchFilters",经 `sed -n '240,250p' photos.js` 核对,`searchFilters: {}` 实际在 **:245**(:246 是下一个字段 `searchOffset` 的文档注释),已改正为 ":245"。

**grep 全量复查**(本任务两个文件所有 `photos.js:`/`Vue2 :`/`places.ts:`/`usePersonDetail.ts:`/`places.test.ts:` 引用逐条回源):
```
$ grep -n "photos\.js:\|Vue2 :\|Vue2 catch\|places\.ts:\|usePersonDetail\.ts:\|places\.test\.ts:" search.ts __tests__/search.test.ts
```
逐条核对结果(见下表),全部通过,另把两处"范围过窄但不算指错"的引用也顺手收紧了精度(:654-666 → :654-671 含 catch;APPEND_SEARCH_RESULTS 的 :381-390 → :384-391,精确到 mutation 函数体本身):

| 引用 | 实际内容 | 结论 |
|---|---|---|
| `:19-22` SEARCH_PAGE_LIMIT | 注释:19-21 + 声明:22 | 准确 |
| `:24-27` smartSearchSeq | 注释:24-26 + 声明:27 | 准确(已改正) |
| `:655` "任何一次 dispatch..." | 精确匹配 | 准确(已改正) |
| `:245` searchFilters | `searchFilters: {}` 在 :245 | 准确(已改正,原 :246 错) |
| `:654-671` smartSearch action(含 catch) | 654 起、671 catch 块结束 | 准确(已收紧) |
| `:669-671` / `:670` catch/console.error | 668 结束、669 catch、670 console.error | 准确(已改正,原 :664-666 错) |
| `:677-692` loadMoreSearchResults | 677 起、692 结束(693 是逗号收尾) | 准确 |
| `:686` 查询串比对 | `if (state.searchQuery !== query) return` 恰在 :686 | 准确 |
| `:384-391` APPEND_SEARCH_RESULTS | 384 起、391 结束 | 准确(已收紧,原 :381-390 含前置注释,略偏) |
| `:390` exhausted 双条件 | `state.searchExhausted = ...` 恰在 :390 | 准确 |
| `:691` finally 无条件复位 | `commit('SET_SEARCH_LOADING_MORE', false)` 恰在 :691 | 准确 |
| `places.ts:241` / `:426-429` | 逐行核对(见本文件早前"另外三条控制器已核实的事实"引用的同一份 Read 结果) | 准确 |
| `usePersonDetail.ts:82` | `if (mine === seq) loading.value = false` 恰在 :82 | 准确 |
| `places.test.ts:643` | `it('__resetForTest 不引入 seq 别名冲突:...')` 恰在 :643 | 准确 |

## M5(并入)—— 过期请求的真实错误被完全吞掉

**改了什么**:`search.ts` `smartSearch` 的 catch 分支,把 `console.error('[photos-search] smartSearch', e)` 移到 seq 比对**之前**(原来是先 `if (mine !== searchSeq) return` 再打日志,过期分支直接吞掉、一行日志都不打)。日志纪律(每个 catch 都要 log)与竞态状态推进(过期响应不能覆盖新状态)现在分成两条独立判断:日志无条件打,状态推进仍然受 seq 守卫。

**覆盖测试**:重写了"失败响应也可能过期"用例,断言从 `expect(errSpy).not.toHaveBeenCalled()` 改成 `expect(errSpy).toHaveBeenCalledWith('[photos-search] smartSearch', expect.any(Error))`。

**变异验证**:命令 `pnpm exec vitest run src/photos/stores/__tests__/search.test.ts`。把 `console.error` 挪回 seq 比对之后(等价于删掉这条修复)会让该用例失败(手工验证:还原成"先 return 后 log"的旧顺序时,该用例断言 `errSpy` 被调用会失败,因为过期分支提前 return、log 语句执行不到)。改后跑通,25/25 绿(该轮次编号随后续用例增加而变化,最终以全量 27/27 为准,见下方 GREEN 输出)。

## M6(并入)—— `?? []` 空值兜底零覆盖

**改了什么**:未改生产代码(`?? []` 本来就在两处),补了两条测试:
1. `smartSearch` 收到 `null`(Go nil slice)→ 断言 `results=[]`、`isSearchMode=true`、`exhausted=true`,**并且 `console.error` 未被调用**(判别性断言——若没有 `?? []`,`null.map(...)` 会 throw、被 catch 接住,§7e-12 的失败兜底恰好落到同一个终态,光看前三条断言测不出区别,靠"是否打日志"才能分辨"优雅处理的空结果"和"真的抛错了")。
2. `loadMore` 深页收到 `null` → 断言 `results` 长度不变、`exhausted=true`(不能反复重发同一页)、`loadingMore=false`。

**覆盖测试**:"M6 用例:后端 Go nil slice 序列化成 null → ?? [] 兜底,走成功路径而非 throw-进-catch"(smartSearch)、"M6 用例:loadMore 深页后端返回 null(Go nil slice)→ ?? [] 兜底,exhausted 正确置真、不 throw"(loadMore)。

**变异验证**:
- 删 `smartSearch` 的 `?? []`(`(res as unknown[])` 不再 `?? []`)→
  ```
  × M6 用例:后端 Go nil slice 序列化成 null → ?? [] 兜底,走成功路径而非 throw-进-catch
  AssertionError: expected "error" to not be called at all, but actually been called 1 times
    1st error call: [ "[photos-search] smartSearch", [TypeError: Cannot read properties of null (reading 'map')] ]
  Tests  1 failed | 24 passed (25)
  ```
  （第一次尝试只断言 results/isSearchMode/exhausted 三条时确实测不出来,25/25 全绿——发现遮蔽后补了 errSpy 断言才转红,过程见上方"判别性断言"说明。)
- 删 `loadMore` 的 `?? []` →
  ```
  stderr: [photos-search] loadMore TypeError: Cannot read properties of null (reading 'map')
  × M6 用例:loadMore 深页后端返回 null(Go nil slice)→ ?? [] 兜底,exhausted 正确置真、不 throw
  AssertionError: expected false to be true // exhausted
  Tests  1 failed | 24 passed (25)
  ```
两处均已用 Edit 手工还原 `?? []`,复跑确认全绿。

## M7(并入)—— `__resetForTest` 零覆盖

**改了什么**:新增 `describe('__resetForTest', ...)` 测试块(此前完全没有任何用例调用过这个导出函数),含两条用例:
1. 基础复位:搜出结果后调 `__resetForTest()`,断言全部 8 个字段复位。
2. seq 别名安全(手法照 `places.test.ts:643`):发起一次搜索但不等待其 resolve(在途)→ 调 `__resetForTest()` → 发起并等待第二次搜索成功 → 让第一次的过期响应现在才 resolve → 断言 `query` 仍是第二次搜索的结果,没被过期响应覆盖。

**覆盖测试**:`__resetForTest` describe 块的两条用例。

**变异验证**:
- 清空 `__resetForTest` 函数体(不复位任何字段)→ 基础复位用例转红(`expect(s.results).toEqual([])` 收到还残留 10 条结果的数组,断言失败),1 failed | 26 passed。Edit 还原。
- 在 `__resetForTest` 里加一行 `searchSeq = 0`(模拟"重置时误把 seq 拨回 0"的缺陷)→ 别名安全用例转红:
  ```
  × M7 用例:不引入 seq 别名冲突 ...
  AssertionError: expected 'stale' to be 'fresh'
  Tests  1 failed | 26 passed (27)
  ```
  Edit 还原(去掉那一行)。

## M8(并入,行为修复)—— `finally` 无条件复位 `loadingMore` 导致分页提前终结

**改了什么**:`loadMore` 的 `finally` 从无条件 `loadingMore.value = false` 改成 `if (mine === searchSeq) loadingMore.value = false`(手法照 `places.ts:241` / `usePersonDetail.ts:82` 的同款 seq 守卫 finally)。代码里补了完整的偏离登记注释,说明 Vue2 `:691` 的继承缺陷、T15 无限滚动下触发概率显著更高的理由、以及"seq 只由 smartSearch/clear 递增,且这两者的每条路径都显式复位 loadingMore,所以加条件不会永久卡 true"的安全性论证。

**覆盖测试**:新增用例"M8 用例:loadMore#1 在途 → 重搜成功(复位 offset/loadingMore)→ loadMore#2 在途 → loadMore#1 的过期响应到达 → 不该误将 loadingMore 复位为假、不该放行重入请求"。时序完全按评审描述的推演构造:loadMore#1 在途 → 重搜成功 → loadMore#2 在途 → loadMore#1 的过期响应 resolve → 断言 `loadingMore` 仍是 `true` → 断言此刻再调 `loadMore()` 会被短路(底层未被调)→ 让 loadMore#2 resolve → 断言最终 `loadingMore=false`、`offset=50`(loadMore#2 的合法值,未被重入请求污染)。

**变异验证**:把 `if (mine === searchSeq) loadingMore.value = false` 改回无条件 `loadingMore.value = false` 后跑测试:
```
❯ src/photos/stores/__tests__/search.test.ts (22 tests | 1 failed) 30ms
   × M8 用例:loadMore#1 在途 → 重搜成功(复位 offset/loadingMore)→ loadMore#2 在途 → loadMore#1 的过期响应到达 → 不该误将 loadingMore 复位为假、不该放行重入请求 6ms
AssertionError: expected false to be true
- Expected: true
+ Received: false
 ❯ src/photos/stores/__tests__/search.test.ts:288:27
    288|     expect(s.loadingMore).toBe(true) // 核心断言:未被过期响应的 finally 误复位
 Tests  1 failed | 21 passed (22)
```
Edit 还原为 `if (mine === searchSeq) loadingMore.value = false`,复跑确认全绿。

**回归确认(评审特别要求)**:M8 改完后专门复跑了"loadMore 失败 → loadingMore 复位为假(finally 守卫)"这条既有用例——该场景里只有一次 loadMore、中途无其他请求推进 seq,`mine === searchSeq` 恒成立,finally 应正常执行复位。实测该用例在 M8 修改前后均通过(全量运行的 27/27 里包含它),行为未被打破。

## M9 + M10(并入)—— 两处断言无区分力

**M9 改了什么**:重写 `clear` 用例。旧版前置只做了 `smartSearch('cat')`,此时 `offset` 本就是 0、`loadingMore` 本就是 false。新版先跑完一次 `loadMore()` 把 `offset` 顶到 50(完整跑完的非默认值),再发起第二次 `loadMore()`(用 deferred 卡在在途状态,此刻 `loadingMore` 真的是 `true`)后调 `clear()`,断言两者都被复位;测试结尾让卡住的 promise resolve、`await` 掉,避免遗留悬空 promise 污染后续用例。

**M9 变异验证**:分两次隔离验证(避免同时删两处导致互相掩盖):
1. 删 `clear()` 里的 `offset.value = 0` 与 `loadingMore.value = false` 两行 →
   ```
   × 复位全部 8 个字段(M9:...)
   AssertionError: expected 50 to be +0 // offset
   Tests  1 failed | 26 passed (27)
   ```
2. 只删 `loadingMore.value = false`(保留 `offset.value = 0`)→
   ```
   × 复位全部 8 个字段(M9:...)
   AssertionError: expected true to be false // loadingMore
   Tests  1 failed | 26 passed (27)
   ```
两次均已 Edit 还原,证明 `offset`/`loadingMore` 两条断言各自独立有区分力,不是互相顶替。

**M10 改了什么**:在"正常:参数是 (query, 50, 50, filtersPayload)"这条 loadMore 用例末尾加 4 条顺序断言:`results[0].id==='p0'`、`results[49].id==='p49'`、`results[50].id==='q0'`、`results[99].id==='q49'`——钉住首页在头、次页在尾、首尾相接顺序不变。

**M10 变异验证**:把 `results.value = results.value.concat(fresh)` 改成 `results.value = fresh.concat(results.value)`(前插而非追加)后跑测试:
```
❯ src/photos/stores/__tests__/search.test.ts (27 tests | 1 failed) 33ms
   × 正常:参数是 (query, 50, 50, filtersPayload);全新 50 条 → offset 变 50、exhausted 假 6ms
AssertionError: expected 'q0' to be 'p0'
- Expected: "p0"
+ Received: "q0"
 Tests  1 failed | 26 passed (27)
```
Edit 还原为 `results.value.concat(fresh)`,复跑确认全绿。

## 命令与最终输出

聚焦测试:
```
$ pnpm exec vitest run src/photos/stores/__tests__/search.test.ts
 Test Files  1 passed (1)
      Tests  27 passed (27)
```

全量(提交前跑一次):
```
$ pnpm exec vitest run
 Test Files  305 passed (305)
      Tests  3382 passed (3382)
   Duration  64.33s
```
(注:输出中仍有 `favorites.test.ts` 的 jsdom "Not implemented: navigation" 噪声,与本任务无关,上一轮报告已说明是既有噪声。)

类型检查:
```
$ pnpm exec vue-tsc --noEmit
(无输出,通过)
```

## Self-review(本轮)

- 10 项逐一做了"删/改 → 跑 → 红 → Edit 手工还原 → 复跑绿"的完整闭环,未使用 `git checkout --`。
- I1/I2/M6/M8 四项(评审点名"上一轮删掉不变红")均已亲自确认现在删掉会红,过程记录在上面各节。
- M6 的 smartSearch 那一半第一次尝试测试时也踩了一次"守卫遮蔽"(§7e-12 的失败兜底与 null 的优雅兜底终态相同),发现后补了 `errSpy` 判别性断言而不是接受"看起来测出来了但其实没有"的假绿——这与本仓反复强调的"假绿"失效模式直接对应,如实记录而非隐藏。
- M3/M4 处理时按要求 grep 了本任务两个文件里**全部** `photos.js:`/`Vue2 :` 等引用逐条回源,不只查评审点名的两处——顺带发现并修正了一处评审没点名的同款错误(`:246`→`:245` searchFilters)。
- M8 改完专门复跑了"loadMore 失败复位 loadingMore"这条既有用例,确认走 `mine === searchSeq` 成立的正常路径、行为未被打破(评审明确要求的回归项)。
- 全程只动了 `search.ts` 与 `search.test.ts` 两个文件,未碰 `assetToPhoto.ts` 或其他既有文件。

## Concerns(本轮)

无。10 项全部处理完毕,变异验证全部转红,全量测试与类型检查均绿。

---

# Fix Round 2(scoped 复审后的注释精度整改)

评审结论(fix round 1 的复审):**I1/I2/M3/M4/M5/M6/M7/M8/M9/M10 十项全部 ADDRESSED,零新破坏**。既有 21 例判定强度未被弱化,自查出的 M6 假绿与多查出的 `:246`→`:245` 均确认属实。本轮不涉及生产逻辑或测试改动,**只改 `search.ts` 里三处注释的准确性**。

## N1(最要紧)`search.ts` M8 安全性论证措辞过强

**问题**:原注释断言"这两者(smartSearch/clear)的**每条路径**(成功/catch/clear)都会把 `loadingMore` 显式置假"——这句话对代码不成立:过期的 smartSearch 在成功路径的 seq 守卫、catch 路径的 seq 守卫处都会提前 `return`,并不会走到置假那一行。真正成立的命题是"**最新一次** smartSearch 或 clear 必定置假"(最新一次按定义不可能是过期的,它落地时必走成功路径或非过期 catch 分支;clear 则是同步立即置假)。结论对,原论证的前提错。

**改了什么**:把安全性论证改写为:
```
// 安全性:不是"smartSearch/clear 的每条路径都会置假"——过期的 smartSearch
// 在 :71/:90 会提前 return,并不置假。真正成立的是:seq 只由 smartSearch 与
// clear() 递增,而"最新一次" smartSearch 或 clear 按定义不可能是过期的
// ——它落地时必然走成功路径(:79)或非过期的 catch 分支(:103),要么是
// clear() 的同步立即置假,三者都会显式把 loadingMore 置假。所以加这个条件
// 不会让 loadingMore 永久卡在 true。
```
（首次落笔时误写成 `:71/:87` 与 `:100`,通读时发现 M5 段落的注释扩写把 catch 分支的行号顶下去了——已用 `grep -n` 逐行核对当前文件,改正为 `:71/:90` 与 `:79`/`:103`,与文件当前行号一致。）

## N2 `search.ts` M5 被误标成"偏离登记"

**问题**:M5 的改动(把 `console.error` 挪到 seq 比对之前)相对 Vue2 其实是**回归对齐**——Vue2 `photos.js:670` 本来就是无条件打日志,catch 里根本没有 seq 比对这道守卫。真正相对 Vue2 的偏离是 catch 里那条 seq 守卫本身(已由紧邻的 §7e-12 段落覆盖)。原注释把"提前打日志"这个改动也扣上"偏离登记"的帽子,归因错了对象。

**改了什么**:注释开头从 `// 偏离登记(M5,评审必修):...` 改为 `// M5(评审必修):console.error 必须放在 seq 比对之前。注意这一步相对 Vue2 其实是回归对齐,不是偏离——Vue2 :670 本来就是无条件打日志,catch 里根本没有 seq 比对这道守卫;真正相对 Vue2 的偏离是下面那道 seq 守卫本身(见 §7e-12)。`,后续"丢日志=丢诊断信号"的论证原样保留(论证本身没错,只是需要说清这属于哪一类改动)。

**报告部分**:本报告(task-11-report.md)"Fix Round 1"一节里 M5 小标题仍写"M5(并入)—— 过期请求的真实错误被完全吞掉"——这条标题本身描述的是**问题**(症状:丢诊断信号),不是"这是一处偏离",不需要改;但为避免歧义,这里明确记录一次:**M5 这次改动相对 Vue2 是回归对齐,不是新增偏离**,真正的偏离是 catch 里的 seq 守卫(在 §7e-12 段落下)。

## N3 `search.ts:5` 生产代码注释夹带评审流水

**问题**:文件头注释原写"...不在 :24-27 这段文档注释里——**上一轮报告曾误引成 :29-31,已改正**"。后半句是过程记录(告诉读者"我们之前引错过、现在改了"),对生产代码的未来读者是噪声——生产注释只该陈述"现在的事实"(这句话实际引自 :655),过程记录该只留在报告与台账里。

**改了什么**:删掉"——上一轮报告曾误引成 :29-31,已改正"这半句,保留正确的行号事实:
```
//   :24-27   (smartSearchSeq 声明+文档注释;"任何一次 dispatch(含清空)都使在途
//             旧响应作废——序号递增必须先于早退分支" 那句 verbatim 引自 :655,
//             不在 :24-27 这段文档注释里)
```

## 通读自查(本轮明确要求的"顺带确认没有第四处同类问题")

通读了 `search.ts` 全文(187 行),逐段核对"注释所述 vs 代码真实行为":
- 文件头 7 条 Vue2 行号引用 —— 均在 fix round 1 里逐条 `grep`/`sed` 核对过,本轮未改动引用本身(仅删了 N3 那半句流水)。
- `clear()` 的偏离登记(:51-55)—— 陈述"Vue2 CLEAR_SEARCH 没有 bump seq 这行"与代码行为(`searchSeq++`)一致,准确。
- `smartSearch` 空查询早退的等价性论证(:61-66)—— 陈述"两种写法在 clear() 自己也 bump seq 的前提下等价"与代码(`clear()` 内确实有 `searchSeq++`)一致,准确。
- `smartSearch` catch 里 §7e-12 段落(:91-96)—— 陈述的失败兜底行为(`results=[]`/`query=trimmed`/`exhausted=true`/`isSearchMode=true`)与代码(:97-104)逐行核对一致。
- `loadMore` 的 E4 偏离登记(:112-116)—— 陈述"Vue2 只有查询串比对、没有 seq 守卫"与代码(:124 查询串比对 + :127 seq 守卫两道并存)一致,准确。
- `loadMore` 的 exhausted 双条件注释(:135-136)—— 陈述"results.length(=raw,去重前)< LIMIT 或 fresh.length===0"与代码(:137 `raw.length < SEARCH_PAGE_LIMIT || fresh.length === 0`)完全一致。
- `loadMore` finally 的 M8 偏离登记(:141-150)—— 时序描述(loadMore#1 在途→重搜成功→loadMore#2 在途→#1 过期响应到达→若无条件复位会放行重入)与 M8 用例的构造完全对应,准确。
- 安全性论证(:151-156)—— 本轮已按 N1 改正。
- `__resetForTest` 的"有意不重置 searchSeq"注释(:175-179)—— 陈述的别名冲突机制与 M7 新增的 seq 别名安全用例行为一致。

未发现第四处"注释所述 vs 代码真实行为"不符的问题。

## 命令与输出

聚焦测试:
```
$ pnpm exec vitest run src/photos/stores/__tests__/search.test.ts
 Test Files  1 passed (1)
      Tests  27 passed (27)
   Duration  615ms
```

类型检查:
```
$ pnpm exec vue-tsc --noEmit
(无输出,通过)
```

三禁复查:
```
$ grep -n "#[0-9a-fA-F]\{3,6\}\|rgba(\|<style>" src/photos/stores/search.ts
(无匹配,exit 1)
```

（本轮范围仅注释,按要求未跑全量测试;上一轮已确认全量 305 files / 3382 tests 绿,本轮零生产逻辑/测试改动,不影响该结论。）

## Self-review(本轮)

- 只改了 `search.ts` 三处注释,零生产逻辑改动、零测试改动,符合本轮范围限制。
- N1 首次落笔时自己也引错了两处行号(`:87`/`:100`,应为 `:90`/`:103`)——这是因为 N2 的注释扩写把后续行号顶下去了。发现后立刻 `grep -n` 通读当前文件核对,改正。这提醒自己:改注释里的自引用行号时,必须在同一轮内改完所有相关注释后再统一核对一遍行号,而不是逐处孤立编辑后假设行号不变。
- 复审记录的 3 条范围外观察(P6b 既有代码日志纪律不一致、`:654-696` 引用略宽、`performance.now()` vs brief 的 `Date.now()`)按要求未动,留给终审。
- 三禁复查通过。

## Concerns(本轮)

无。3 处注释精度问题全部修正,通读自查未发现第四处同类问题,测试与类型检查均绿。
