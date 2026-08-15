# 开源快照解封 · 交接（2026-08-15）

> ## ✅ 已执行完毕(2026-08-15,master `099183bc → c1880b40`,5 个提交,未 push)
>
> | 完成的定义 | 结果 |
> |---|---|
> | 1. `check-anchors` broken: 0 | ✅ `anchors ok: 300  broken: 0` |
> | 2. `vitest run oss` 全绿 | ✅ 500/500 |
> | 3. `export.mjs`(不带 `--publish`)跑通 | ✅ 零真实泄漏,产出 `/tmp/nimoos-web-preview` |
> | 4. 产物树复扫 | ✅ 无台账/文档泄漏,LICENSE+NOTICE+README 在位;导出器注入的中文散文已清零 |
> | 5. 语言探测三处改完 | ✅ 抽到 `src/i18n/locale.ts`,`index.ts`/`main.ts`/`Welcome.vue` 共用 |
> | 6. 全量 `pnpm test` 不高于基线 | ✅ 11 文件 / 84 例(基线 17 / 94),其中 2 例是并行抖动、单跑全绿 |
>
> 额外收获与偏差:
>
> - **产物树自己也跑了一遍测试**:436 文件 / 4641 例,只红 `kvmStyles.test.ts` 那 1 条 ——
>   私有侧一字不差地红,是既有缺陷,不是导出引入。
> - **本文档「明确不做」里那句"残留中文绝大多数是断言值/fixture/i18n 词条"不准确**:
>   `manifest.mjs` 的 `replace` 载荷本身还在往英文产物树里注水(15 行注释 + 9 条用例标题),
>   已全部译掉;`src/i18n/` 三份守卫测试(parity / i18nKeys / shardDisjoint)整份还是中文,
>   也一并译掉。**现在产物树里的中文只剩三类**:zh_cn 词表自己的注释与值、
>   双语的 Google Drive 指引页、以及"被测对象就是 CJK"的那几行。
> - **附带修好一个隐形一个月的缺陷**:`packages/service/src/{kvm,sys}.test.ts` 的用例标题里
>   有 `doesn't` 撇号截断字符串,整份文件从 `2ad712f8` 起解析失败、**56 例断言一次都没跑过**
>   (vitest 只报 `Failed Suites`,不计入失败数)。
>
> 下面是执行前的原始交接内容,保留备查。


**目标**:让 `node oss/export.mjs` 跑通,产出一份可以公开给英语用户的 NimoOS-Web 快照。

当前在 **master**,最新提交 `62dbb485`,工作树干净,**未 push**(master 领先 `origin/master` 82 个提交,push 被 deny 规则挡着,由机主自己推)。

仓库根:`/home/nimo/NimoTech/NimoOS-New-UI`。**shell 的工作目录会被重置到上层**,
所有命令加 `cd /home/nimo/NimoTech/NimoOS-New-UI && ...`,Read/Edit 用绝对路径。

---

## 背景:导出器坏了很久,刚修好

注释英文化(三轮,已全部合入 master)把 OSS 导出链路打坏了三处,**都是第一轮
`2ad712f8` 造成的**,已修:

| 提交 | 修的什么 |
|---|---|
| `8a77c3e2` | `oss/export.mjs:299` 语法错误 —— 翻译写了 `doesn't`,撇号截断单引号字符串。**该文件从 `2ad712f8` 起就无法解析**,导出器一次都没跑起来过,而 CI 里没有任何东西跑它,所以故障一直隐形 |
| `91672639` | manifest 的 `design-export` DELETE 条目过期(目录已被同一提交删除),触发 stale 硬失败 |
| `62dbb485` | 3 个 REPLACE 哈希锁打漂(`MediaViewer.vue`/`AddPanel.vue`/`README.md`)。已核实:改动纯注释/散文、无功能变更;替身文件 `oss/files/*` 本就是纯英文、不需要同步内容,所以只挪锁 |

现在导出器能跑到 **第 3 步 apply manifest**,卡在锚点。

---

## 任务 A(硬阻塞,工作量最大):91 条锚点重对

### 现状

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && node oss/check-anchors.mjs
# anchors ok: 209   broken: 91   missing files: 0
```

分布(28 个文件):

| 文件 | 条数 |
|---|---|
| `src/styles/theme.css` | **36** |
| `src/home/composables/useOpenAction.test.ts` | 11 |
| `src/settings/panels/panels.test.ts` | 4 |
| `src/settings/panels/AppsPanel.vue` | 4 |
| `src/home/components/HomeDock.test.ts` | 4 |
| `src/router/index.test.ts` | 3 |
| `src/home/composables/useOpenAction.ts` | 3 |
| `vite.config.ts` / `src/styles/color-guard.test.ts` / `src/settings/panels/AppsPanel.test.ts` / `src/components/AppToast.zIndex.test.ts` / `.gitignore` | 各 2 |
| 其余 17 个文件 | 各 1 |

`theme.css` 一个文件占 40%(那 225 行注释这轮全翻了)。

### 机制(先读懂再动手)

`oss/manifest.mjs` 里有 280 条 `PATCH`,每条带一个 `find:` 字符串,`oss/apply.mjs`
**逐字匹配**私有仓源码。翻译把源码里的中文注释改成英文 ⇒ `find:` 里那段中文再也匹配不上
⇒ `throw Anticipated no match` 硬失败。

**这个设计是好的**:硬失败而不是静默跳过,所以打漂不会悄悄产出残缺快照。

### 做法

1. `node oss/check-anchors.mjs` 会逐条打印失配的 `find:` 前 100 字符 + 所属文件
2. 去私有仓对应文件找那段内容**现在的英文原文**
3. 把 `manifest.mjs` 里的 `find:` 换成新文本
4. **每改完一批就重跑 `check-anchors`,确认 broken 数在降** —— 这是唯一可信的进度信号

可以派 agent 分批做(建议按文件分,`theme.css` 单独一批甚至拆两批)。给 agent 的指令必须写死:

- **只改 `oss/manifest.mjs` 的 `find:` 字段**,不许改私有仓源码(改源码会让锚点永远追不上)
- **`find:` 必须逐字复制源码**,不许手打、不许改空白和折行 —— 匹配是逐字的
- 每批结束跑 `node oss/check-anchors.mjs`,报告改前/改后的 broken 数
- 不许为了"让它过"而删除 `PATCH` 条目

### 注意:PATCH 的意图不能丢

有些 PATCH 是为了**洗掉中文措辞**才存在的(把某段中文注释替换成中性英文)。源码英文化之后,
这类 PATCH 可能变成冗余。**冗余不等于可以删** —— 先确认替换后的文本与源码现状等价,
再决定是重对锚点还是整条移除,并在提交信息里说明理由。

---

## 任务 B:导出链路自检

### B1. 6 个 `oss/*.test.mjs` 红灯(13 例)

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm exec vitest run oss --reporter=dot
```

失败文件:`apply` / `cli-args` / `export-rsync` / `forbidden` / `media-wave` / `tree`。
**先做完任务 A 再看这些** —— 其中一部分很可能是锚点打漂的连带表现,A 做完会自己变绿。
剩下的再逐个查。

### B2. 跑通导出(硬验证)

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && node oss/export.mjs
```

**不带 `--publish`** —— 只写 `/tmp/nimoos-web-preview`,碰不到公开仓。
要求工作树干净,所以先提交。

### B3. 产物树复扫(泄漏闸)

导出成功后,对 `/tmp/nimoos-web-preview` 跑:

```bash
P=/tmp/nimoos-web-preview
# 内部台账 / 文档 / AI 痕迹一个都不许有
find $P -not -path '*/node_modules/*' \( -name '.superpowers' -o -path '*docs/superpowers*' \
  -o -name 'CLAUDE.md' -o -name 'OVERVIEW.md' \) | head
# 合规件必须在
ls $P/LICENSE $P/NOTICE $P/README.md
# 残留中文(排除 i18n 词条,那是产品功能)
grep -rIl -P '[\x{4e00}-\x{9fff}]' $P --exclude-dir=node_modules --exclude-dir=i18n | wc -l
```

**基线**:2026-08-14 那份旧快照泄漏检查是干净的(台账/文档一个都没漏),LICENSE/NOTICE/README 齐全。
新快照要重新验一遍。

中文残留的**预期值**:私有仓现在还有 2,270 行中文,但**绝大多数是断言值/fixture/i18n 词条**,
而 OSS 导出会删掉整个相册区和 AI 区(manifest DELETE 79 项),所以产物树里的数字会显著更低。
关键不是数字,是**逐个确认残留都在引号内(数据),没有中文散文**。

---

## 任务 C:默认语言(机主已拍板要做)

### 问题

```ts
// src/i18n/index.ts
function initialLocale(): string {
  const stored = localStorage.getItem('lang')
  if (stored && stored in messages) return stored
  return 'zh_cn'                      // ← 没有浏览器语言探测
}
export const i18n = createI18n({ locale: initialLocale(), fallbackLocale: 'zh_cn', messages })
```

美国用户首次打开是中文界面,得自己进设置切。

### 本仓已有先例,照它做

`src/main.ts:36-38` 的 `getLang` **已经**用 `navigator.language` 兜底:

```ts
getLang: () => {
  const l = (navigator.language || 'en').toLowerCase().replace('-', '_')
  return localStorage.getItem('lang') || l
},
```

⇒ **现状是不一致的**:HTTP 层给后端发 `en_us`,UI 却显示中文。修 `initialLocale()`
正好把这条缝补上,不是新增行为。

### 要改的三处

1. `src/i18n/index.ts` 的 `initialLocale()` —— 无 stored 时按 `navigator.language` 判定,
   `zh` 开头 → `zh_cn`,否则 → `en_us`
2. `src/views/Welcome.vue:16` —— `((localStorage.getItem('lang') as Locale) ?? 'zh_cn')`
   同样改成探测(否则引导页的预选项与实际界面语言不一致)
3. 考虑把探测逻辑抽成一个函数放 `src/stores/locale.ts`(那里已有 `LOCALES` / `isLocale`),
   让 `index.ts` / `Welcome.vue` / `main.ts` 三处共用,避免三份实现漂移

### 为什么可以全仓改、不需要 manifest patch

中文用户浏览器报 `zh-CN` ⇒ 仍然拿到中文。**探测对两边都正确**,所以私有版和开源版可以同一份代码,
不必在 manifest 里做分支。

### 验证

```bash
pnpm exec vitest run src/i18n src/stores/locale.test.ts src/views/Welcome.test.ts --reporter=verbose
```

`src/i18n/parity.test.ts` 会断言 `zh_cn.ts` 与 `en_us.ts` 键完全一致 —— 别碰词条,只改选择逻辑。
`fallbackLocale` 保持 `zh_cn` 即可(parity 守卫保证不会缺键,所以 fallback 实际不会触发)。

---

## ⚠️ 别再踩的坑(翻译三轮的血账,全部实测)

导出工作会改 `manifest.mjs` 和少量源码,以下都可能再犯:

1. **英文所有格撇号截断单引号字符串** —— `doesn't` / `blueprint's`。就是它让导出器死了一个月。
   优先改写,其次 `\'` 转义。
2. **`*/` 写进 `/** */` 注释块** —— 提前关闭,后续文本变活代码。中文原作者特意转义成 `*\/`,
   翻译时别把反斜杠弄丢。
3. **全角引号进代码位置** —— `lang=”ts”` 让整个 SFC 解析失败。
4. **`;` 进 `theme-exception` 注释** —— 配色守卫见标记开豁免、见第一个 `;` 就关闭。
   标记与被保护声明之间不许有 `;`,也别把单行标记注释拆行。
5. **注释里的 CSS 具名色** —— 守卫连注释一起扫。用 `muted`/`danger-toned`/`amber-toned` 等色调词。
   **扫描范围各区不同**:`src/styles/color-guard.test.ts` 只扫 `<style>`+`.css` 且只匹配 hex/rgb/hsl;
   具名色词扫描在 `knowledgeStyles`/`parserStyles`/`kvmStyles`;**知识库区额外扫 `.vue` 的 `<template>`**。
6. **断言值里的标点是数据** —— 全角半角是不同字符,`toBe('迁移完成！')` ≠ `toBe('迁移完成!')`。
   永远不要手打中文串,只能复制。

### 验证纪律

- **`vue-tsc --noEmit` 抓不到第 2 类**(`*/` 嵌套),只有 esbuild(跑 vitest 时)能抓到 ⇒
  **每批必须真跑 vitest**,不能只跑类型检查
- **`Tests: no tests` / `Failed Suites` 不是通过**,是文件根本没加载。语法坏了的测试文件
  失败数是 0,汇总里一片绿 —— master 上 59 例断言值缺陷就是这么隐形了很久的
- 全量 `pnpm test` 约 316 秒,**只在最后做一次闸门**,平时跑局部

---

## 完成的定义

1. `node oss/check-anchors.mjs` → `broken: 0`
2. `pnpm exec vitest run oss` → 全绿
3. `node oss/export.mjs`(不带 `--publish`)→ 跑通,产出 `/tmp/nimoos-web-preview`
4. 产物树复扫:无台账/文档泄漏,LICENSE+NOTICE+README 在位,残留中文全部是引号内的数据
5. 语言探测三处改完,`src/i18n` + `locale.test.ts` + `Welcome.test.ts` 全绿
6. 全量 `pnpm test` 跑一次,失败数**不高于**当前基线(见下)

### 当前测试基线(改动前,用来对比)

```
Test Files  17 failed | 719 passed (736)
Tests       94 failed | 11835 passed | 70 skipped (11999)
```

**这 94 例全部是既有缺陷,不是本次工作引入的**,分三类:

- **59 例断言值误翻**(`SettingsView.test.ts` 44 + `ParserTest.test.ts` 15)—— 第一轮翻译把
  UI 文案翻成英文而组件仍渲染中文。**不在本次范围**,别顺手改断言"修绿",那会把可见缺陷变成隐藏缺陷
- **4 例结构性白名单**(`knowledgeStyles` 3 + `kvmStyles` 1)—— 与翻译无关,`k-progress-`/
  `k-set-card` 计数在 master 和现在一致
- **6 个 `oss/*.test.mjs`** —— 就是本次任务 B1

另有 `src/i18n/__tests__/photosSlice.test.ts` 偶发红:单跑 12 例全过,i18n 目录零改动,
两次全量之间唯一差异就是它 ⇒ **并行执行的隔离抖动**,不是缺陷。

---

## 明确不做

- **内部记号剥离**(`N42`/`K1`/`SP8-P5c`/`ledger-六-2`/`:215` 这类蓝本行号)—— 机主决定先不做。
  语言已是英文,外部读者能读;这些记号影响的是"能不能贡献"而不是"能不能读",留待以后。
- **push 到 GitHub** —— master 领先 `origin/master` 82 个提交(其中 74 个是这轮开工前就积压的),
  push 由机主自己做,建议先过一眼那 74 个旧提交。
- **继续翻译剩余 2,270 行中文** —— 已核实绝大多数是断言值/fixture/i18n 词条/CJK 被测对象,
  是有意保留,不是欠账。详见 `docs/superpowers/2026-08-14-english-comments-handoff.md`。
