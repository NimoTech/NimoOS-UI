### Task 10: `searchUnderstood.ts` + `searchQueryParts.ts` + `searchSort.ts` + `assetToPhoto` 补字段

**Files:**
- Create: `src/photos/util/searchUnderstood.ts` + `__tests__/searchUnderstood.test.ts`
- Create: `src/photos/util/searchQueryParts.ts` + `__tests__/searchQueryParts.test.ts`
- Create: `src/photos/util/searchSort.ts` + `__tests__/searchSort.test.ts`
- Modify(**先 grep 确认是否需要**): `src/photos/util/assetToPhoto.ts` + 其既有测试
- Read-only 参考: `PhotosSearchView.vue:416-433`(queryParts)、`:435-447`(realPeopleList)、`:474-497`(understood)、`:374-404`(sortedResults + 双档)、`:675-678`(matchPct)、`NimoOS-UI/src/store/modules/photos.js:29-34`(searchStateMatchesQuery)、`:168-178`(三个额外字段的注释)

**Interfaces:**
- Produces:
  ```ts
  // searchUnderstood.ts
  export interface PersonOption { id: string; name: string; count: number; coverFaceId: string }
  export type UnderstoodKind = 'person' | 'type' | 'time'
  export interface UnderstoodToken { k: UnderstoodKind; v: string; id?: string; quick?: QuickKey | number }
  export function understood(query: string, people: PersonOption[]): UnderstoodToken[]

  // searchQueryParts.ts
  export interface QueryPart { text: string; hl: boolean }
  export function queryParts(query: string, keywords: string[]): QueryPart[]

  // searchSort.ts
  export type SortKey = 'relevance' | 'newest' | 'oldest'
  export interface ScoredPhoto { p: Photo; score: number | null }
  export function sortResults(rows: ScoredPhoto[], sort: SortKey): ScoredPhoto[]
  export function splitTiers(sorted: ScoredPhoto[], sort: SortKey): { best: ScoredPhoto[]; more: ScoredPhoto[] }
  export function matchPct(score: number | null | undefined): number | null
  export function searchStateMatchesQuery(state: { isSearchMode: boolean; searchQuery: string }, query: string): boolean
  ```

**结构规格:**

1. **`understood(query, people)` —— 三类 token,照搬 `:474-497` 的顺序与判据,但修人名匹配(§7e-5 / 偏离登记 7)**:
   - 先 `q = query.toLowerCase()`;`!q.trim()` → `[]`。
   - **person**:遍历 `people`,`name.toLowerCase()` 命中则 push `{ k:'person', v: p.name, id: p.id }`。
     - **Vue2 用 `new RegExp('\\b' + escaped + '\\b')`,`\b` 在 CJK 之间不成立 ⇒ 中文名一个都匹配不上。** 改法:自己判边界 ——
       ```ts
       // \b 只在 ASCII 词字符/非词字符交界处成立,中文名两侧通常也是中文 ⇒ Vue2 版对
       // 中文名恒不命中(§7e-5)。改成:先找子串位置,再检查两侧字符是否"词内延续"。
       // 词字符定义为 [A-Za-z0-9_](与 \w 一致);CJK 不是词字符,所以中文名两侧
       // 无论是中文还是标点都算边界 —— 语义上正是我们要的。
       const WORDISH = /[A-Za-z0-9_]/
       function hasWordBoundedMatch(haystack: string, needle: string): boolean {
         if (!needle) return false
         let from = 0
         for (;;) {
           const i = haystack.indexOf(needle, from)
           if (i < 0) return false
           const before = i > 0 ? haystack[i - 1] : ''
           const after = i + needle.length < haystack.length ? haystack[i + needle.length] : ''
           const beforeOk = !before || !WORDISH.test(before) || !WORDISH.test(needle[0])
           const afterOk = !after || !WORDISH.test(after) || !WORDISH.test(needle[needle.length - 1])
           if (beforeOk && afterOk) return true
           from = i + 1
         }
       }
       ```
       **注意 `beforeOk` 的第三个条件**:needle 首字符本身不是词字符时(如中文名),边界恒成立 —— 这正是修复的要点。**这段代码原样落地,不要"简化"。**
   - **type**:`/\bvideos?\b/` → `{ k:'type', v:'Videos' }`;`else if /\bphotos?\b/` → `'Photos'`。**`v` 是内部枚举值不是显示文案**(显示时再 `t()`);**保持 `'Videos'`/`'Photos'` 这两个字面值**,因为 `filters.type` 的比较用它们(照搬 Vue2 的 `typeItems`)。**这两个正则保留 `\b`** —— 它们匹配的是英文单词,`\b` 是正确的;**但中文查询「视频」不会命中**,这是 Vue2 的既有行为,**照搬 + 登记为已知局限**(修它要引入中英双词表,超范围)。
   - **time**:`/last week/` → `quick: 'last7'`;`/last month/` → `'last30'`;`/last year/` → `'lastYear'`;`/this year/` → `'thisYear'`;`/\btoday\b/` → `'today'`;否则 `q.match(/\b20[12][0-9]\b/)` → `{ k:'time', v: 年份串, quick: Number(年份) }`。**`v` 给显示用**:五个快捷键的 `v` 取对应的 i18n 键名(消费方 `t(v)`),年份的 `v` 就是年份串。**判据顺序照搬(`else if` 链,先匹配到的胜出)。**
     - **`quick` 字段是 New-UI 新增**(Vue2 靠 `v` 的英文字符串反查 `quickRange`,i18n 化后行不通)。类型是 `QuickKey | number`(数字表示年份)。**偏离登记。**
2. **`queryParts(query, keywords)` 照搬 `:416-433`**:无 query → `[{ text: query, hl: false }]`;`keywords` 空 → 同;逐个 escape 正则元字符后 `join('|')` 造 `gi` 正则;`exec` 循环切段;末尾补尾巴;`parts` 为空则回落整串。**`keywords` 由调用方给(= `understood(...).map(t => t.v.toLowerCase())`)。**
   - **⚠ 空字符串 keyword 会造出匹配空串的正则导致死循环** —— Vue2 没防。加 `keywords.filter(Boolean)`(**新增守卫,注释登记**)。
3. **`sortResults` 照搬 `:374-391`**:`relevance` → `(b.score||0) - (a.score||0)`;`newest`/`oldest` → `byTakenAt(desc)`,其中 `takenAt` 双 null → 按 id 比;单 null → 恒排末尾(**不受方向影响**,照搬);相等 → 按 id 比。**必须 `[...rows]` 拷贝后排序**(不原地改)。
4. **`splitTiers` 照搬 `:397-404`**:`sort !== 'relevance'` → `{ best: sorted, more: [] }`;否则按 `p.belowCut` 分流。
5. **`matchPct` 照搬 `:675-678`**:null → null;否则 `Math.round(clamp01(score) * 100)`。
6. **`searchStateMatchesQuery` 照搬 `photos.js:32-33`**:`!!state.isSearchMode && state.searchQuery === (query || '').trim()`。
7. **`assetToPhoto` 补字段**:**先 `grep -n "matchScore\|matchedBy\|belowCut\|isNew" src/photos/util/assetToPhoto.ts`**。
   - 缺 `matchScore` / `matchedBy` / `belowCut` → 补进 `Photo` 接口与映射(`matchScore: typeof r.matchScore === 'number' ? r.matchScore : null` 等)。
   - 缺 `isNew` → 一并补(T6 的 `.new-tag` 依赖它;**T6 若已登记这条挂账,本任务兑现**)。
   - **`assetToPhoto` 是 5 视图共用的纯函数** ⇒ 改它必须跑其既有测试 + 全量;新增字段一律**可选 + 有默认**,不能让既有消费方的形状断言变红。**加回归断言:不带这些字段的旧 fixture 仍得到既有形状。**

- [ ] **Step 1: 写失败测试**

`searchUnderstood.test.ts`:
- 空 query / 全空格 → `[]`。
- **中文人名命中**(§7e-5 主守卫):`people = [{ name: '小明', … }]`,`query = '小明的照片'` → 出 person token。**这条在 Vue2 是不命中的。**
- 英文人名词边界:`people = [{ name: 'Sara' }]`,`'Sara at beach'` → 命中;`'Sarah at beach'` → **不命中**(`Sarah` 里的 `Sara` 后面跟词字符);`'photos of Sara.'` → 命中(句点是边界);`'xSara'` → 不命中。
- 多人同时命中 → 按 `people` 数组顺序出 token。
- type:`'my videos'` → `v === 'Videos'`;`'a photo'` → `'Photos'`;**两者同时出现时只出 Videos**(`else if` 顺序);`'视频'` → **无 type token**(照搬的已知局限,反向断言登记它)。
- time 六条:`'last week'` → `quick === 'last7'`;`'last month'` → `'last30'`;`'last year'` → `'lastYear'`;`'this year'` → `'thisYear'`;`'today'` → `'today'`;`'2025 trip'` → `v === '2025'` 且 `quick === 2025`。
- **优先级**:`'last year 2025'` → 只出 `lastYear`(先匹配的胜出,年份分支在 else 里)。
- 大小写:`'LAST WEEK'` → 命中。

`searchQueryParts.test.ts`:
- 空 query → 一段、`hl: false`。
- keywords 空 → 一段。
- **keywords 含空串** → 不死循环、结果等价于过滤后(**新增守卫的主用例,加 `{ timeout: 1000 }` 防挂**)。
- `queryParts('sunset in tokyo', ['tokyo'])` → 三段?**手算**:`'sunset in '`(hl 假)+ `'tokyo'`(真)。共 2 段。
- 多次出现:`queryParts('a b a', ['a'])` → `['a'(真), ' b '(假), 'a'(真)]` 共 3 段。
- 正则元字符:keywords 含 `'c++'` → 不抛错且能命中 `'c++ code'`。
- 大小写不敏感但**保留原文大小写**:`queryParts('Tokyo', ['tokyo'])` → 高亮段文本是 `'Tokyo'`。

`searchSort.test.ts`:
- `relevance`:score `[0.2, 0.9, null]` → 顺序 `0.9, 0.2, null`(null 当 0)。
- `newest` / `oldest`:三条含一条 `takenAt: null` → **null 恒在末尾**(两个方向各断言一次);相同 `takenAt` → 按 id 稳定;`newest` 与 `oldest` 互为逆序(排除 null 项)。
- **不原地改**:传入数组的引用与返回值不同,且传入数组顺序未变。
- `splitTiers`:`sort='newest'` → `more` 为空且 `best` 全量;`sort='relevance'` + 3 条中 1 条 `belowCut` → best 2 / more 1。
- `matchPct`:null → null;`-0.5` → 0;`1.7` → 100;`0.456` → 46。
- `searchStateMatchesQuery`:`isSearchMode: false` → false;query 带首尾空格 → trim 后比较命中;不同 query → false。

`assetToPhoto` 回归:旧 fixture(不带四个新字段)→ 既有断言全绿 + 四个新字段是 null/false/默认;带字段的 fixture → 原样透出。

- [ ] **Step 2: 跑测试确认失败** — `pnpm exec vitest run src/photos/util/__tests__/searchUnderstood.test.ts src/photos/util/__tests__/searchQueryParts.test.ts src/photos/util/__tests__/searchSort.test.ts src/photos/util/__tests__/assetToPhoto.test.ts`

- [ ] **Step 3: 实现三个 util(+ 按需改 `assetToPhoto`)**

- [ ] **Step 4: 跑全量 + tsc,逐个删码验证**

Run: `pnpm exec vitest run && pnpm exec vue-tsc --noEmit`

删码清单:①`hasWordBoundedMatch` 换回 `\b` 正则 → 中文名用例红;②`beforeOk` 的第三个条件(`!WORDISH.test(needle[0])`)删掉 → 中文名用例红(**这条最关键,单删它就够**);③`'Sarah'` 那半判据(`afterOk`)删掉 → Sarah 用例红;④`keywords.filter(Boolean)` → 空串用例超时/红;⑤`byTakenAt` 的单 null 恒末尾分支 → null 位置用例红;⑥`[...rows]` 拷贝 → 「不原地改」用例红;⑦`matchPct` 的 clamp → 越界用例红。

- [ ] **Step 5: Commit**

```bash
git add src/photos/util/searchUnderstood.ts src/photos/util/searchQueryParts.ts src/photos/util/searchSort.ts src/photos/util/assetToPhoto.ts src/photos/util/__tests__/
git commit -m "feat(photos): P7a-T10 搜索纯函数三件 —— 结构化抽取(修 CJK 人名)/ 分词高亮 / 排序双档"
```

---

