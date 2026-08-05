# Task 1 报告 —— i18n 键 + smartViewSuggest.ts + relTime.ts

## 改了哪些文件

- 新增 `src/photos/util/smartViewSuggest.ts`
- 新增 `src/photos/util/__tests__/smartViewSuggest.test.ts`
- 新增 `src/photos/util/relTime.ts`
- 新增 `src/photos/util/__tests__/relTime.test.ts`
- 修改 `src/i18n/zh_cn.ts`(追加于 `photosPlacesInsightHomeBase` 之后,`}` 之前)
- 修改 `src/i18n/en_us.ts`(同位置追加,键序与 zh 完全一致)

## 回源核对结论(115 键逐条核过)

用脚本把 brief 表的 115 行与 `NimoOS-UI/src/assets/lang/zh_CN.json`、`en_US.json` 逐条比对(键名当查找键、zh 值精确比对、en 值精确比对):

- **115 行全部核对完毕,zh 值与 json 逐字一致**(唯一刻意例外是 `photosSvSettingsSection`,按裁定 2 取「设置」而非 json 的「系统设置」,已在该键旁写注释登记)。
- 发现 1 处 en 列表述不精确但不影响正确性:`photosSvPhotosCount` 对应的 Vue2 键是 `photos_count`(标识符风格,不是完整英文句子),`en_US.json['photos_count']` 的实际值是 `'photos'`,不是键名字面量 `'photos_count'`。写入 en_us.ts 时用的是 json 的真实值 `'photos'`(而不是误把键名当英文文案写入),这是唯一一处「Vue2 键 ≠ en 值」的行,按"以 json 为准"处理,已在此登记。
- **发现 8 处表格重复(与 brief 第 7 条的预期矛盾)**:brief 声称"上表已把这 8 条排除在外",但实测这 8 行**仍然原样出现在 115 行表格里**:
  | 表内新键 | 应复用的既有键 |
  |---|---|
  | photosSvCancel | photosCancel |
  | photosSvClickRename | photosAlbumClickToRename |
  | photosSvClose | photosClose |
  | photosSvDelete | photosDelete |
  | photosSvDownloadZip | photosFavExport |
  | photosSvExportFailed | photosFavExportFailed |
  | photosSvSettingsAiBehavior | photosPeopleFacesOffLink |
  | photosSvStorage | photosStorage |

  逐一验证:这 8 组的 zh/en 值与既有键**完全相同**(如 `photosCancel: '取消'` / `'Cancel'`)。按 brief 第 7 条"若发现表里仍有重复,以「复用既有键」为准并在报告里登记"的指示,**这 8 行未新增为 photosSv\* 键**,后续任务(T5/T6 等)应直接引用既有的 `photosCancel`/`photosClose`/`photosDelete`/`photosStorage`/`photosAlbumClickToRename`/`photosFavExport`/`photosFavExportFailed`/`photosPeopleFacesOffLink`。
  → **实际新增键数 = 115 − 8 = 107**(zh_cn.ts / en_us.ts 各追加 107 行 + 2 行分组注释)。

- 未发现其它键名/值冲突(与现有 photos 段 grep 比对,新增的 107 键名在两个文件里均无重复)。

## 必含用例对应的 `it`

`smartViewSuggest.test.ts`:
- `SV_SUGGEST_POOL.length === 20` 且每行非空 → `describe('SV_SUGGEST_POOL')` 的唯一 it
- `inferChips('')` / `inferChips(undefined)` → `[]` → `'空/假值输入 → []'`
- POOL 顺序命中 `['scene: sunset','place: Japan','Sara']` → `'按 POOL 定义顺序命中(不是查询里的出现顺序)'`
- 大小写不敏感 → `'大小写不敏感'`
- 去重(同一行内多关键词命中只贡献一次,见下方"已知发现") → `'去重:两行命中且共享同一个 chip 时只出现一次'`
- `.slice(0,8)` → `'.slice(0, 8):命中 ≥9 条 chip 时长度恰为 8'`
- `SV_QUICK_TEMPLATES.length===5`、labelKey/descKey 两个 locale 都能查到、thresh 序列 → `'共 5 行,labelKey/descKey 都能在 zh_cn 与 en_us 里查到,thresh 依次为 [75,88,80,65,85]'`
- `descEn` 喂 `inferChips` 有效 → `'descEn 喂 inferChips 有效(家庭周末那条应命中 scene: family gathering)'`
- 反向断言(见下方"已知发现",按实测结果改写) → `'已知发现:当前 5 个模板的 descKey 恰好与 descEn 命中结果相同…'`
- `COND_SUGGESTIONS.length===12` → `'COND_SUGGESTIONS 共 12 条'`
- `condSuggestionsFor(['scene: sunset'])` 不含且长度 8 → `'condSuggestionsFor(["scene: sunset"]) 不含该项且长度 8'`
- `condSuggestionsFor([])` 长度 8 → `'condSuggestionsFor([]) 长度 8'`
- `condSuggestionsFor(前10条)` 长度 2 → `'condSuggestionsFor(前 10 条) 长度 2'`

`relTime.test.ts`:
- 空/null/undefined → `''` → `'空/null iso → ""'`
- 坏串 → `''` → `'坏串(Invalid Date)→ ""(新增守卫)'`
- 30 秒前 n===1 → `'30 秒前 → photosSvRelMinutes 且 n===1'`(见下方"已知发现"，已去掉对 Math.max 下界的归因描述)
- 新增:10 秒前 n===1(真正触底) → `'10 秒前 → 仍是 n===1(真正触到 Math.max(1,…) 下界,round(10/60)=0)'`
- 90 分钟前 n===2 → `'90 分钟前 → photosSvRelHours 且 n===2(Math.round(5400/3600)=2)'`
- 59 分钟前仍 Minutes → `'59 分钟前(3599 秒)仍是 photosSvRelMinutes'`
- 3600 秒整 → Hours → `'3600 秒整 → photosSvRelHours(边界另一侧)'`
- 86400 秒整 → 绝对日期档 → `'86400 秒整 → 绝对日期档(结果不含 photosSvRel)'`
- locale 生效 → `'locale 生效:同一 iso 传 zh_cn 与 en_us 得到不同字符串(绝对日期档)'`

## 删码验证逐条结果

一次只删一处,验完用 Edit 手工还原(全程未使用 `git checkout --`):

| 编号 | 删的内容 | 结果 |
|---|---|---|
| ① | `inferChips` 的 `.slice(0, 8)` | **变红**:`.slice(0, 8):命中 ≥9 条 chip 时长度恰为 8` 从期望 8 实得 10 |
| ② | `Set` 去重(`seen.has`/`seen.add` 判断,改成直接 push) | **未变红**——13 个用例全绿,见下方"已知发现 1" |
| ③ | `relTime` 的 `Math.max(1, …)`(改成裸 `Math.round`) | 用 brief 指定的"30 秒前"用例验证**不变红**(30/60=0.5,`Math.round(0.5)===1`,踩不到下界);改用我新增的"10 秒前"用例验证**变红**(期望 1 实得 0),见下方"已知发现 2" |
| ④ | `relTime` 的 `Number.isNaN` 守卫 | **变红**:坏串用例抛 `RangeError: Invalid time value`(Intl.DateTimeFormat 遇 Invalid Date 直接抛错,而非返回错误字符串) |
| ⑤ | `Intl.DateTimeFormat` 的 `locale` 参数换成写死 `'en'` | **变红**:locale 用例 `expected 'Jul 29, 2026' not to be 'Jul 29, 2026'`(zh/en 结果相同) |
| ⑥ | `condSuggestionsFor` 的 `.filter(...)`(只留 `.slice(0,8)`) | **变红**:两条排除类用例均失败 |

全部还原后重跑 `smartViewSuggest.test.ts` + `relTime.test.ts` + `parity.test.ts` + `vue-tsc --noEmit`,以及全量 `pnpm exec vitest run`,均绿(见下方测试小结)。

## 已知发现(重要,需控制器过目)

**发现 1 —— `Set` 去重对当前 20 行 POOL 数据是死代码。**
`SV_SUGGEST_POOL` 的 20 行 chips 两两不同(每行都是单元素数组、且 20 个 chip 字符串互不重复),而 `inferChips` 是按行遍历(`row.kw.some(...)` 只判断一次真假,不是按关键词逐个遍历),所以**给定这份逐字照搬的 POOL,任何输入都不可能产生重复 chip**——`Set` 去重守卫在这份数据集上永远不会被触发。brief 删码清单②断言"删 Set 去重 → 去重用例红",经实测**不成立**(删除后 13 个用例仍全绿)。
处理方式:Set 逻辑按"逐字照搬 Vue2 源码"的要求原样保留(Vue2 源码本身也有这个 Set,同样是防御性死代码,1:1 port 不擅自砍),测试里的"去重"用例改为验证同一行多关键词命中只贡献一次(真实、可通过,但不依赖 Set 本身),并在测试注释与本报告里如实记录这个发现,不伪造一条"删了会变红"的假测试。

**发现 2 —— brief 把"30 秒前"错误归因为 `Math.max(1,…)` 下界用例。**
`30/60 = 0.5`,JS 的 `Math.round(0.5) === 1`(四舍五入向 +∞),所以 30 秒前即便删掉 `Math.max(1, …)` 结果仍是 `n=1`,这条用例根本没有踩到下界。真正会触底的区间是 `diff < 30s`(`round` 到 0)。处理方式:保留 brief 要求的"30 秒前"用例(仍是真命题),另加一条"10 秒前"用例真正验证下界,删码验证时改用这条来确认②号删码点确实变红。

**发现 3(即"结论 7"的具体化)—— 表格 115 行里有 8 行是与既有键重复的"未排除"项。**
见上方"回源核对结论"。已按 brief 第 7 条的兜底指示处理:不新增这 8 个 photosSv\* 键,后续任务复用既有键。

**发现 4 —— `SV_QUICK_TEMPLATES` 的反向断言按 brief 原文无法成立。**
Controller 裁定 1 要求测试"`inferChips(descKey)` 为空"(反向断言,钉住"不能拿键去匹配"陷阱)。但 5 个模板的 `descKey`(如 `photosSvFamilyWeekendsPark`)是英文原文 `descEn` 的驼峰化产物,驼峰化只是去掉空格/大小写变化,**并未消除原有的英文关键词子串**——用 Python 对 POOL 逐一实测,**5 个模板里,`descKey` 与 `descEn` 命中 `inferChips` 的结果全部相同(要么都命中,要么都不命中)**,没有一个模板能演示出"descEn 命中、descKey 不命中"的区分性场景(brief 点名的 `SV_QUICK_TEMPLATES[0]`——家庭周末——`descKey` 实测命中 `['scene: family gathering']`,并非空数组)。
处理方式:`descEn` 字段按 controller 裁定原样加入(labelKey/descKey/thresh/descEn 四字段的 `QuickTemplate` 接口),这是正确的架构决策(T5 该调用 `descEn` 而不是 `descKey`,一旦未来 key 命名换成真正不透明的 id、或 POOL 关键词扩充导致两者不再巧合重叠,这个字段就会体现出必要性)。但反向断言按实际验证结果改写为"已知发现"型用例(`inferChips(descKey) 等于 inferChips(descEn)`),如实记录而非伪造一条会通过的假断言。

## 偏离登记

1. **107 个新键而非 115 个**——见上方"回源核对结论"发现 3,按 brief 第 7 条指示处理,非我擅自决定。
2. **`smartViewSuggest.test.ts` 的"去重"与"反向断言"两条用例改写**——见上方发现 1、发现 4,均因原用例在给定的真实数据上无法成立,已改写为如实反映代码行为的用例并在代码注释 + 本报告中登记。
3. **`relTime.test.ts` 新增"10 秒前"一条用例**——brief 未要求,补上是为了让删码清单③在验证时真正有意义(见发现 2)。
4. 没有做的:brief 要求但未做的事项——无(115 键的插值槽/`<i18n-t>` 拆分留给 T8,本任务未预加,按 brief 第 10 条明确说明不做)。

## 测试小结

- 目标测试:`smartViewSuggest.test.ts`(13 例)+ `relTime.test.ts`(9 例)= 22 例,全绿。
- 连同 `parity.test.ts`:29 例全绿。
- `pnpm exec vue-tsc --noEmit`:exit 0。
- 全量 `pnpm exec vitest run`:**290 files / 2983 tests 全部通过**(含 color-guard 409 例)。
- `git diff --stat`:`zh_cn.ts` / `en_us.ts` 各 +109(107 键 + 2 行分组注释),纯追加、无重排。

## Commit

```
git add src/photos/util/smartViewSuggest.ts src/photos/util/relTime.ts src/photos/util/__tests__/ src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(photos): P7a-T1 智能视图 107 i18n 键 + 建议池/模板/相对时间纯函数"
```
（commit message 的键数由 brief 原文"115"改为实际"107"，与本报告一致；内容仍是 brief 要求的中文原句结构。）
