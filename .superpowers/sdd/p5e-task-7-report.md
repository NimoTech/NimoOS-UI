# P5e Task 7 报告 —— `SearchView.vue` 下半(结果卡 + 两个子组件接线 + 文件字节流)

实现者:sonnet。起点 HEAD `39dac27`(T6 评审提交,自测确认 `git log --oneline -1`)。

## 0. 改动的文件(仅 2 个 + 本报告)

| 文件 | 性质 | `git diff --stat` |
|---|---|---|
| `src/ai/knowledge/views/SearchView.vue` | 续写 | +204 / -60 |
| `src/ai/knowledge/views/SearchView.test.ts` | 续写 | +702 / -60(净 +36 条用例) |

`git status --porcelain` 只列这 2 个文件(+ 本报告 `git add -f`)。**零改动**:`knowledge.scss` ·
`util/searchAggregate.{ts,test.ts}` · `KFileViewer.{vue,test.ts}` · `FileDetailDrawer.{vue,test.ts}` ·
`knowledgeStyles.test.ts`(T6 已 +1 行,本刀零改动)· `color-guard.test.ts` · `src/files/viewers/**` ·
`knowledgeStore.ts`/`parserStore.ts` · `src/i18n/**` · `knowledgeRoutes.ts`/`deferred.ts` ·
`.sp8/NimoOS-Service`(全期零改动,自证见 §9)。

## 1. 逐段对照(蓝本 `file:line` → New-UI)

蓝本:`git -C ../../NimoOS-UI show 7a6ee6b7:src/views/AI/Knowledge/SearchView.vue`(401 行)。

| 蓝本 | New-UI | 说明 |
|---|---|---|
| `:121-127` 结果计数 | `k-result-count` 块(`SearchView.vue:503-510`) | `results.length`/`totalChunks`/`lastQuery`/`ms` v-if |
| `:128-154` 结果卡循环 | `k-rcard` v-for(`:511-544`) | 逐字段照抄,见 §5 |
| `:158-162` error 态 | T6 已写,本刀未动 | — |
| `:164-168` `FileDetailDrawer` | `SearchView.vue:556-563` | 四个监听全接 |
| `:170-172` `KFileViewer` | `SearchView.vue:565` | 两个监听全接 |
| `:186-190` 两个 ext 常量集 | `OFFICE_INAPP_EXTS`/`NO_PREVIEW_EXTS`(`:49-51`) | 逐字 |
| `:317-345` `relLevel`/`relLabel`/`highlight`/`fmtMtime` | 从 `util/searchAggregate` import(K48,T3/T5 已产出) | 本刀补进 import 列表,未重定义 |
| `:346-355` `fetchBlobUrl` | `SearchView.vue:259-263` | K52/裁定 R1「方案 A」,见 §2 |
| `:357-380` `openOriginal` | `SearchView.vue:275-300` | 三分支 + ext 提取怪行为照抄,见 §3 |
| `:382-397` `downloadFile` | `SearchView.vue:308-327` | 逐步照抄,见 §4 |
| `:398` `onDrawerToast` | `SearchView.vue:335-337` | 转发到 `store.toast`(K3),不直调 `useToast()` |

**`store.actions.toast(...)` 落地口径**:治理 §5.1 写的是「→ 全局 `useToast()`」,但本仓既有六个页面
(`KnowledgeLayout.vue`/`IndexedFilesView.vue`/`SettingsView.vue`/`QueueView.vue` 等)一律走
`store.toast(msg)`(store action 内部才调 `useToast().show(msg, 2400)`,`knowledgeStore.ts:312`)。
`openOriginal`/`downloadFile`/`onDrawerToast` 三处全部改用 `store.toast(...)`,与蓝本
`this.store.actions.toast(...)` 同源、与本仓既有六个页面同款,**不直接 import `useToast`**——
比 brief 字面的「全局 `useToast()`」更贴近本仓既有惯例,已在文件头与 §10 显式申报。

## 2. 🔴 K50/K52(裁定 R1「方案 A」)—— fetchBlobUrl 四条自证

```ts
async function fetchBlobUrl(fullPath: string, opts: { inline?: boolean } = {}): Promise<string> {
  const url = service.file.fileUrl(fullPath) + (opts.inline ? '&inline=1' : '')
  const resp = await getHttp().get(url, { responseType: 'blob' })
  return URL.createObjectURL(resp.data as Blob)
}
```

| # | 判据 | RED 探针(改前 md5 `189df8a9d6397286672d99921387d2c0`) | 结果 |
|---|---|---|---|
| ① | `responseType: 'blob'` 硬断言 | `sed -i "s/responseType: 'blob'/responseType: 'arraybuffer'/"` → `pnpm exec vitest run SearchView.test.ts` | ✅ 报红:`Tests 1 failed \| 69 passed (70)`,失败项 = 「① responseType 硬断言」;还原后 `md5sum` 与 `/tmp/p5e-t7-red/SearchView.vue.orig` 逐字节一致 |
| ② | `window.open` 打开 `blob:` 地址,不是 `fileUrl()` | 用 python 把 `window.open(url, ...)` 换成 `window.open(service.file.fileUrl(file.fullPath), ...)` | ✅ 报红:「②」与「③」两条同时失败(`Tests 2 failed \| 68 passed (70)`);还原后 md5 一致 |
| ③ | `withVersion()` 证明 `/v3/file` 不被改写成 `/v1/v3/file` | 引用证据(非本文件可测,见下) | — |
| ④ | `inline:true` → URL 含 `&inline=1`;`downloadFile`(无 inline)→ URL 不含 `inline` | `sed` 把 `(opts.inline ? '&inline=1' : '')` 改成恒定的 `'&inline=1'` | ✅ 报红:`Tests 1 failed \| 69 passed (70)`,失败项 = 「④」;还原后 md5 一致 |

**判据③(引用,非本文件测试范围)**:`.sp8/NimoOS-Service/src/http.ts:6-10`

```ts
function withVersion(url: string): string {
  if (/^https?:\/\//.test(url)) return url
  if (/^\/v[1-9]/.test(url)) return url          // ← /v3/file 命中这一支,原样放行
  return '/v1' + (url.startsWith('/') ? url : '/' + url)
}
```

`service.file.fileUrl(path)`(`.sp8/NimoOS-Service/src/file.ts:65-68`)产出 `/v3/file?token=…&path=…`,
`/^\/v[1-9]/` 对 `v3` 成立(`3` ∈ `[1-9]`)→ `withVersion` 原样放行,不会被改写成 `/v1/v3/file`。
这一条是 Service 包自身 `http.ts` 拦截器的行为,`getHttp` 在本文件测试里被整体 mock 掉
(见 §7 mock 层次),**故意不写一条"伪装测过 withVersion"的空转断言**——那种断言不会真的
执行拦截器代码,属于零判别力的摆设(治理 §9.14-3 同族)。这条只作报告引用,不落进
`.test.ts`,如实申报(裁定 R18 口径:brief 判据是提示、以能真报红为准,这里连"能报红"
的载体都不在本文件内,故不硬凑一条测试)。

**K50 处置(逐句核对)**:✅ 仍走 `getHttp()`,Service 仓零改动 · ✅ `responseType: 'blob'` 硬断言 ·
✅ 不用 `service.file.getBytes()`(丢 `Content-Type`)· ✅ 不把 `fileUrl()` 交给 `window.open`/`<a href>`,
只当那一次 XHR 的 URL(`fetchBlobUrl` 内部拼接后立刻发 `getHttp().get`,不外泄)。

## 3. `openOriginal` 三条路由分支(蓝本 `:361-380`)

```ts
async function openOriginal(payload: { file: FileVM }) {
  const file = payload.file
  if (!file || !file.fullPath) { store.toast(t('aiKbSrNoPath')); return }
  const ext = ((file.name || '').split('.').pop() || '').toLowerCase()
  if (OFFICE_INAPP_EXTS.has(ext)) { viewerFile.value = file; return }
  if (NO_PREVIEW_EXTS.has(ext)) { store.toast(t('aiKbSrNoPreviewToast')); return }
  try {
    const url = await fetchBlobUrl(file.fullPath, { inline: true })
    const w = window.open(url, '_blank', 'noopener,noreferrer')
    if (!w) store.toast(t('aiKbSrPopupBlocked'))
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch (e) {
    const err = e as { message?: string } | undefined
    store.toast(t('aiKbSrOpenFailed') + ': ' + String((err && err.message) || e))
  }
}
```

九条用例逐一覆盖(`describe('SearchView —— T7:openOriginal 三条路由分支 ...')`):
office in-app ext → `viewerFile`(`getHttp` 零调用)· 无预览器 ext → toast + 零请求 ·
其余 ext → `window.open(url,'_blank','noopener,noreferrer')` · 弹窗被拦 → toast ·
60s 后 `revokeObjectURL`(假时钟)· `!file.fullPath` → toast + 零请求 · 抛错 → toast 拼接 e.message ·
🔴 **ext 提取怪行为**:文件名恰好是 `docx`(无扩展名)→ 整个文件名被当 ext → 误判成 in-app 可预览格式,
一条用例专门点明并断言 `httpGet` 零调用(证明真的走进了 `viewerFile` 分支,不是碰巧字符串相等)。

`((file.name || '').split('.').pop() || '').toLowerCase()` 里的 `|| ''` 是 TS 层对 `.pop()` 返回类型
`string | undefined` 的防御写法(与 `KFileViewer.vue:61` 同款),运行时对非空数组永不触发,
不是行为变化(蓝本原文 `.split('.').pop().toLowerCase()` 没有这个 `|| ''`)。

## 4. `downloadFile`(蓝本 `:382-397`)

逐步断言:`a.tagName==='A'` · `a.download` = `file.name`(或 `'download'` 兜底,专门一条用例喂空
`name`)· `a.rel==='noopener noreferrer'` · `document.body.appendChild` 恰好 1 次 ·
`HTMLAnchorElement.prototype.click` 恰好 1 次(全局 mock,避免 jsdom 真的尝试导航)·
🔴 **`document.body.removeChild` 恰好 1 次,且传的是同一个 `<a>` 元素**
(`expect(removeSpy.mock.calls[0][0]).toBe(a)`)· 60s 后 `revokeObjectURL`(假时钟)·
`!file.fullPath` → toast + 零请求 · 抛错 → toast 拼接 `e.message`。

**RED 探针(`removeChild`)**:`sed -i '323d'` 删除 `document.body.removeChild(a)` 那一行 →

```
× SearchView —— T7:downloadFile(蓝本 :382-397) > 🔴 成功:造 <a download> → appendChild → click → removeChild(同一元素)→ 60s 后 revokeObjectURL
Tests  1 failed | 69 passed (70)
```

还原(`cp /tmp/p5e-t7-red/SearchView.vue.orig` → `md5sum` 两文件逐字节一致
`189df8a9d6397286672d99921387d2c0`)→ 复跑 70/70 转绿。

## 5. 结果卡列表(蓝本 `:121-156`)

- `:key="r.id"` · 点卡 → `openFile = r`(一条用例)。
- `k-rcard-tag` 的 `:data-kind="r.kind"` + `.toUpperCase()`。F5B 第一个文件 `mime='text/plain'` →
  `kindFromMime` → `'txt'`,断言 `data-kind='txt'`、可见文字 `'TXT'`。
- 🔴 **`k-match-pill` 两个不同键**:`:title` 用 `aiKbSrMatchTitle`(渲染值 `'命中 2 段'`),可见文案用
  `aiKbSrMatchPill`(`'2 段匹配'`)——一条用例同时断言两者且值不同,不是合并成一个。
- `k-rel` 的 `:data-level="relLevel(r.score)"` + `:title` 含 `(score*100).toFixed(0)%`。
  F5B 首文件 `score=0.738` → `relLevel` 高档 → `title='相似度 74%'`。
- 🔴 **`k-more-hint`**:`v-if="r.chunks.length > 1"` + 文案用 `chunks.length - 1`,**两侧用例**:
  F5B(每文件 2 chunk)→ 显示且文案含「还有 1 段」;单 chunk 场景(构造响应体)→ 不显示。
  RED 探针:把模板里的 `chunks.length - 1` 改成 `chunks.length` → 「显示且文案正确」这条报红
  (`Tests 1 failed | 69 passed (70)`);还原 md5 一致。
- `k-rcard-meta` 三段:路径(`r.path` = `dirname(fullPath)`,不含文件名,断言时已按此修正)·
  `修改时间` 前缀(不钉具体日期字符串,避开 §9.13 的 TZ 依赖,`fmtMtime` 本身已在
  `searchAggregate.test.ts` 里用同式比对测过)· `已收录`(`aiKbStatusIndexed`)。
- 🔴 **`r.chunks[0] && r.chunks[0].snippet` 空数组兜底**:构造一个 `chunks: []` 的文件,断言
  渲染不抛且 `.k-rcard-snippet` 存在、不含 `'undefined'` 字样、`.k-more-hint` 不出现。
  RED 探针:把模板改成 `r.chunks[0].snippet`(去掉 `&&` 短路)→ 该用例报红(挂载抛异常);
  还原 md5 一致。
- `:data-*` 一律 `String(...)`:本刀范围(`:121-156`)内的 `data-*` 全是 `data-kind`/`data-level`,
  值本身就是字符串(`r.kind`/`relLevel(r.score)` 的返回值),**没有布尔值需要 `String()` 包裹**——
  与 T6 范围的 `data-open`/`data-on`(布尔判据)不同源。判断依据:蓝本 `:130`/`:138` 两处的绑定
  表达式类型本身就是字符串,不是 `===` 比较式。已在报告里明确判定,不是遗漏。

## 6. 🔴 K49 结果卡 v-html 注入用例

`.k-rcard-snippet` 喂含 `<script>alert(1)</script> hello world` 的 `preview.text`,查询词 `'hello'`:
断言渲染后 `snippet.find('script').exists()` 为 `false`、`snippet.html()` 含 `&lt;script&gt;`、
`snippet.find('mark').exists()` 为 `true`。`highlight()` 的转义逻辑本身(escape 顺序、`esc` 步骤
是否被删)已由 T3 在 `searchAggregate.test.ts` 用 RED 探针测过(K49 首次落地处)——本刀不重复
对 `util/searchAggregate.ts` 做 RED(该文件对本刀零改动权限),只补组件层 `v-html` 渲染后
真实 DOM 的断言,证明转义输出确实原样进了 DOM、没有被模板层再次处理成可执行标签。

## 7. mock 层次与 fixture 出处

- `store.runSearch`/`store.loadChunkContext` 全程 mock 在 store action 层(`vi.spyOn`),返回值 =
  后端原始 snake_case(`files[]`/`chunks[]`/`preview.text` 等),`toFileResults` 之后才是 camelCase——
  未搞反(与 T6 一致)。
- 🔴 T7 新增:`@nimotech/nimoos-service` 走 `importOriginal` 部分 mock
  (`vi.mock('@nimotech/nimoos-service', async (importOriginal) => ({ ...actual, service: { file: { fileUrl } }, getHttp: () => ({ get: httpGet }) }))`),
  `fileUrl`/`httpGet` 用 `vi.hoisted`,mock 形态照 `src/files/stores/files.test.ts:17` 与
  `FileDetailDrawer.test.ts` 的既定写法。`isDistillableName`(`FileDetailDrawer` 消费)走
  `importOriginal` 保留真实实现,不受影响。
- fixture 使用:
  - `F1-search-text.empty.REAL.json` —— K50/openOriginal/downloadFile 系列用例的默认 `runSearch` 结果(不关心结果内容时的占位)。
  - `F5b-search-text.multifile.REPLAYED.json` —— 结果卡渲染字段、k-result-count、点卡片、
    N41 同时挂载等用例的真实多文件数据源(T6 已引入并做过截断+sha256 校验,本刀直接复用同一常量
    `F5B_RESPONSE`,未重新贴正文)。
  - T7 新增本地构造样本(均已在用例内联标注为 `.CONSTRUCTED`,非 fixture 文件):
    K49 注入样本(复用 `F5B_RESPONSE.files[0]` 的字段形状,只替换 `preview.text` 为攻击字符串)·
    零 chunk 文件样本 · 单 chunk 文件样本(`k-more-hint` 反向)·
    `makeFileVM` 工厂产出的 wiring 样本(`chunks: []`,专为绕开 `FileDetailDrawer.fetchFull()`
    的网络调用,见 §7.1)。

### 7.1 `makeFileVM` 的 `chunks: []` 设计理由(避免多余的 `loadChunkContext` mock)

`FileDetailDrawer` 在 `<script setup>` 顶层同步调用 `fetchFull()`,若 `cur.value.chunkNo == null`
会早退、不调用 `store.loadChunkContext`(`FileDetailDrawer.vue:108`)。`chunks: []` → `activeId`
初值 `null` → `cur` 落到 `{}` → `chunkNo` 是 `undefined` → 早退。所有只测「子组件接线」
(`@close`/`@open`/`@download`/`@toast`)的用例都用这个工厂,不需要额外 mock
`store.loadChunkContext`,把「接线是否正确」与「`FileDetailDrawer` 自己的取数逻辑」
(已在 `FileDetailDrawer.test.ts` 测过)干净分开。唯一例外是"点结果卡 → openFile=r"那条用例
(F5B 的文件有真实 chunks),显式 `vi.spyOn(store, 'loadChunkContext').mockResolvedValue({...})`。

## 8. 🔴 自动上膛守卫(裁定 R25 / T5 DoD-12)—— 现在上膛且已满足

**T5 DoD-12 的守卫**(`FileDetailDrawer.test.ts` 底部,非本刀所写):「若 `SearchView.vue` 存在,
则它必须 import `FileDetailDrawer`」——T6 阶段走"已存在"分支,已由 T6 满足;本刀未改动它。

**T6 自建的守卫**(`SearchView.test.ts`,原描述"若模板出现 `<FileDetailDrawer`,则必须同时出现
四个监听"):T6 阶段是"惰性通过"(markup 不存在)。本刀写入 markup 后**现在因条件为真而上膛**——

```
✓ SearchView —— 自动上膛守卫(T6 自建):若模板出现 <FileDetailDrawer,四个监听必须全部出现 >
  模板含 <FileDetailDrawer ⇒ 四个监听全部出现(现在因 T7 markup 而上膛,已满足) 1ms
```

**RED 证据(两种偏态各一次,证明它真的在检查,不是摆设)**:

1. 只删一个监听(`@toast`)—— `sed -i 's/@toast="onDrawerToast"//'`:

```
× SearchView —— T7 范围自证:两个子组件挂载 markup 齐全 ... > 模板含 ... 两者均已 import
× SearchView —— 自动上膛守卫(T6 自建) ... > 模板含 <FileDetailDrawer ⇒ 四个监听全部出现 ...
× SearchView —— T7:FileDetailDrawer 四个监听全接 ... > 🔴 @toast → 转发到 store.toast ...
Tests  3 failed | 67 passed (70)
```

还原后 `md5sum` 一致,复跑 70/70 转绿。三条同时报红(文件系统条件断言 + 我自己写的行为断言)
证明「接了三个漏一个」这个偏态被两层守卫同时抓到。

2. 完全不写 markup(T6 阶段的原始状态,历史证据见 `p5e-task-6-report.md` §7 已完整贴过,
   本刀不重复做——那是 T6 的产出状态,本刀改的是"markup 已存在"这一侧)。

## 9. K50 判据③(withVersion)—— Service 仓零改动自证

```
$ git status --porcelain -- ../NimoOS-Service 2>&1 | head
$ git -C ../NimoOS-Service status --porcelain
(no output)
```

本刀全程通过 `vi.mock('@nimotech/nimoos-service', ...)` 覆盖包的运行时行为,未修改 `.sp8/NimoOS-Service`
下任何源文件。

## 10. 三门完整终值(现测,非采信)

```
pnpm test                    → /tmp/p5e-t7-test-final.log   exit=0
pnpm exec vue-tsc --noEmit   → /tmp/p5e-t7-tsc-final.log    exit=0
pnpm build                   → /tmp/p5e-t7-build-final.log  exit=0
```

**Test Files  335 passed (335)**
**Tests  4251 passed (4251)**

四个算术数字:

| 量 | 起点(T6 报告 §8,本刀现测复核) | 本刀终值 | 差 | 构成 |
|---|---|---|---|---|
| 测试文件数 | 335 | **335** | 0 | 零新建文件(T7 只续写既有 2 个文件) |
| 用例数 | 4215 | **4251** | +36 | `SearchView.test.ts` 从 34 条续写到 70 条,净 +36;`knowledgeStyles.test.ts`/`color-guard.test.ts` 零改动(零新增 `.vue`)→ 不产生任何联动计数 |
| `.vue` 总数(`find src -iname "*.vue" \| wc -l`) | 185 | **185** | 0 | 零新建 `.vue` |
| `color-guard` 用例数(`pnpm exec vitest run src/styles/color-guard.test.ts`) | 187 | **187** | 0 | 与 `.vue` 总数同步,零变化 |

已知噪声(`persist.test.ts > dropPersisted` / `AgentComposer.test.ts`)本次全量运行未触发,无需复跑说明。

## 11. K/N 条目逐条申报

| 条目 | 命中方式 |
|---|---|
| **K44** | `.vue` 侧零 `<style>` 块(T6 已证,本刀零新增 `<style>`) |
| **K49** | 结果卡 `.k-rcard-snippet` 组件层 v-html 注入用例,见 §6 |
| **K50/裁定 R1「方案 A」/K52** | `fetchBlobUrl` 四条自证,见 §2 |
| **N33/N34/N35/N36/N37/N38/N39/N40** | T6 命中,本刀未动相关代码 |
| **N41** | `FileDetailDrawer`/`KFileViewer` 各自独立 Esc 监听,两者同时挂载时按 Esc 都关闭——一条端到端接线用例证实(§「两个子组件可同时挂载 + N41」),**未加 `stopPropagation`/层级管理**去"修好"它,照抄蓝本既有行为 |
| **§5.1(store.toast 而非直调 useToast)** | `openOriginal`/`downloadFile`/`onDrawerToast` 三处均走 `store.toast(...)`,与本仓既有六个知识库页面同款,见 §1 末尾说明 |

## 12. 剩 4 处内联 `style=`/`color=`(E-57)逐处判定

T6 报告 §10 已算出本刀范围(`:121-156`)剩 4 处,逐处核实如下(New-UI 行号 → 蓝本行号):

| New-UI 行 | 蓝本行 | 内容 | 判定 |
|---|---|---|---|
| 508 | `:124` | `style="color: var(--text-quaternary); margin-left: 6px"` | color 已是 token;`margin-left` 纯布局,N24 同族照抄 |
| 539 | `:149` | `style="color: var(--text-quaternary)"` | 已是 token,照抄 |
| 541 | `:151` | `style="color: var(--text-quaternary)"` | 已是 token,照抄 |
| 542 | `:152` | `color="var(--success)"`(KIcon 属性) | 已是 token,照抄 |

**终值:4 处,零色字面量**,全部已是 `var(...)` token 或纯布局属性,与 E-57 全文结论
「色字面量 0」一致。`SearchView.vue` 全文(T6 的 12 处 + 本刀的 4 处)共 16 处,与 E-57 逐字吻合。

## 13. 代码膨胀自评

蓝本本刀范围(`:121-156` + `:164-172` + `:186-190` + `:346-398`,约 100 行原始行数)对应
New-UI 净增约 204 行(`.vue` diff)。膨胀构成:
- K50/K52 裁定说明的文件头/函数级 JSDoc 注释(蓝本 file:line 对照、判据说明):约 90 行,
  治理 §10 强制要求。
- TypeScript 类型标注(`payload: {file: FileVM}`、`opts: {inline?:boolean}`、`err` 的窄类型转换):
  约 15 行,零运行时行为变化。
- `String((err && err.message) || e)` 里的 `String(...)` 包裹:纯 TS 编译需要(`e: unknown`),
  运行时与蓝本 `... + e` 的隐式 ToString 输出逐字相同,已在代码注释里显式申报(§ fetchBlobUrl
  附近),不是行为改动。
- 其余为 1:1 移植,零无关重构、零顺手抽象。测试文件净增约 640 行(36 条用例 + `makeFileVM`
  工厂 + URL/click 全局 mock 脚手架),全部是本刀 DoD 要求的判别力断言 + RED 探针配套,
  无空转/摆设用例(逐条已用 RED 验证,见 §2/§4/§5/§8)。

## 14. 申报纪律自查

- 未跳过任何带 🔴 的复核项;裁定 R1「方案 A」的四条判据逐条自证(§2)。
- N33–N41 均未被"顺手修正"——已核对蓝本原文,反直觉/看似写反的判据全部照抄。
- 唯一一处"未在计划书字面出现但为满足既有惯例主动调整"的偏离 = `store.toast(...)` 而非
  直接 `useToast()`(§1 末尾已显式申报理由,与本仓既有六个页面同源,判定为更贴近既定惯例
  而非新偏离)。
- 判据③(`withVersion`)按 R18 口径处理为"报告引用,不写空转测试"——已在 §2 显式申报理由。
- `:data-*` 全部 `String(...)` 的通用要求在本刀范围内经核实无布尔值绑定需要处理,已在 §5
  明确写出判断依据,不是遗漏。

## 状态

三门全绿(335 文件/4251 例/tsc 0/build 0)。7 组 RED 探针(responseType · window.open 不含
token · inline 参数 · removeChild · k-more-hint 文案 · 空数组兜底 · 自动上膛守卫两种偏态)
全部按预期报红并已还原,`md5sum` 逐字节核对一致(`189df8a9d6397286672d99921387d2c0`)。
