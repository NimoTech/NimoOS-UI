# SP8-P5a Task 3 评审 —— KIcon.vue

评审者:独立 sonnet 评审(遵 §11)。commit under review: `3d44a67`(sp8-ai 分支,New-UI 仓)。
未采信实现者报告的任何数字/结论;蓝本、path 比对、测试、RED 探针全部独立重做。

## 1. 42 条 path 逐字节比对

方法(独立于实现者的 awk 脚本,自己重新写):

```bash
cd NimoOS-UI && git show main:src/components/common/KIcon.vue \
  | awk '/^const PATHS = \{/{f=1; next} f && /^\}/{f=0} f' \
  | grep -E "^  [A-Za-z]" > baseline_keys.txt        # 42 行

cd NimoOS-New-UI && git show 3d44a67:src/ai/knowledge/components/KIcon.vue \
  | awk '/^const PATHS: Record<string, string> = \{/{f=1; next} f && /^\}/{f=0} f' \
  | grep -E "^  [A-Za-z]" > new_keys.txt              # 42 行

diff baseline_keys.txt new_keys.txt   # 0 行差异
sort baseline_keys.txt | md5sum       # 442ad5d8a296504857345cdef1f36568
sort new_keys.txt      | md5sum       # 442ad5d8a296504857345cdef1f36568（一致，序无关校验）
```

**结论:①键数=42(两侧一致)②键名集合完全一致(sed 提取键名后 diff 0 行)③42 条 path 字符串逐字符相同**(整行 diff 含引号/属性/`<g>`包裹/`fill="currentColor" stroke="none"` 全部 0 行差异,且用排序后 md5 做了序无关的二次交叉验证)。

副产品验证了治理文件提到的「43 误数」陷阱:第一次用 `grep -E "^  [A-Za-z][A-Za-z0-9]*: '"` 直接扫整个文件(未限定在 `PATHS` 块内)时,蓝本侧多抓到一行 `name: 'KIcon',`(来自 `export default` 块),得到 43。限定 `PATHS{...}` 边界后两侧都是 42,与治理文件口径一致。

**42 条 path 校验:通过,无任何一条不同。**

## 2. `<svg>` 骨架

蓝本:`:width :height viewBox="0 0 20 20" fill="none" :stroke :stroke-width stroke-linecap="round" stroke-linejoin="round" v-html="pathHtml"`。
本仓:同一组属性全部存在,取值方式(`:` 绑定 vs 静态)逐项一致,只有书写顺序不同(允许)。**通过。**

## 3. props 默认值

蓝本 Options API:`name:{required:true}`、`size:{default:16}`、`color:{default:'currentColor'}`、`strokeWidth:{default:1.6}`。
本仓 `withDefaults(defineProps<...>(), { size: 16, color: 'currentColor', strokeWidth: 1.6 })`,`name` 无默认值(必填)。**四项默认值逐字一致,通过。**

## 4. 未命中 name 行为

蓝本 `pathHtml() { return PATHS[this.name] || '' }`(用 `||`,不是 brief 猜测的 `??`)。
本仓 `const pathHtml = computed(() => PATHS[props.name] || '')`——**运算符也用 `||`,与蓝本逐字等价**,未命中返回空字符串,不抛错。**通过。**

## 5. 零 `<style>` 块 / 注释无色字面量

`grep -n "<style"` 无命中;`grep -nE "#[0-9a-fA-F]{3,6}|rgb\(|rgba\("` 全文件无命中(唯一带 `currentColor` 关键字的是 path 数据里的 `fill="currentColor"`,系逐字承自蓝本/与 `AgentIcon.vue` 同款既有写法,非本任务引入的新违规)。

自己打开 `src/styles/color-guard.test.ts` 核实其真实行为:对 `.vue` 文件,`styleLines()` **只抽取 `<style>...</style>` 标签内部的行**(正则 `/<style[^>]*>([\s\S]*?)<\/style>/gi`),模板/脚本/文件头注释均不在扫描范围内。也就是说「逐行扫 `.vue` 且不跳注释行」准确表述应是「`<style>` 块内逐行扫、块内注释也不豁免」,而不是整份 `.vue` 文件任意位置的注释都会被扫——这点治理文件的措辞有歧义,但**不影响本任务判定**:KIcon.vue 本身零 `<style>` 块,文件头 HTML 注释也不含任何颜色字面量,两种理解下都通过。

## 6. `v-html` 处理 vs `AgentIcon.vue`

`grep -n "eslint-disable\|no-v-html" src/ai/components/icons/AgentIcon.vue` 与同一 grep 对 `KIcon.vue` 均无命中。仓库当前无 `.eslintrc*`/`eslint.config*`(确认无 ESLint 门禁)。**KIcon.vue 对 `v-html` 未做任何特殊处理,与 `AgentIcon.vue` 既有做法一致,未自创。通过。**

## 7. 范围外文件

`git show 3d44a67 --stat` 只含 `KIcon.vue` + `KIcon.test.ts` 两个新文件,`+126/-0`。`git log -1 -- src/ai/components/icons/AgentIcon.vue` 落在 `f613947`(远早于本任务),确认 `AgentIcon.vue` 未被触碰。**通过。**

## 8. 文件头注释

比对 brief Step 4 给的原文与提交里的文件头注释:内容、措辞、六个异形 glyph 列表、「settings/user/grid 被 rail 与移动端 tabs 用到」、P3a/P4 D3 引用——**逐字一致,按 brief 原文写入,通过。**

## 9. 测试质量

- **弱断言坐实**:「22 个 name 全部存在」用 `el.innerHTML … .not.toBe('')`,对 42 条 glyph 里的绝大多数确实**没有判别力**——见下方 RED 探针,证实全绿。
- **正向断言补强**:实现者为 `code` 补的 `toContain('M7 6l-4 4 4 4')` 是真实存在的正向断言(与 diff 里第 56 行一致),配合原有的 `not.toContain('M11 4l-2 12')` 负向断言,`code` 这一个 glyph 现在有判别力。
- **六条 K4 异形断言判别力自查**:重点核 `d('grid')).toContain('rx="1"')` vs AgentIcon 的 `rx="1.2"`——`"rx=\"1.2\""` 这个串里确实**不包含** `"rx=\"1\""`(带右引号的子串匹配,`rx="1.2"` 的字符序列是 `r,x,=,",1,.,2,"`,任何位置往后数都取不出 `r,x,=,",1,"` 这个连续子串,因为 `1` 后面紧跟的是 `.` 而不是 `"`)。**该断言有效,不是假通过。**其余五条(pause/code-negative/settings/user/download)同理逐一读了 AgentIcon.vue 对应 glyph 的实际形状,确认负向锚点字符串在 AgentIcon 版本里真实存在、在 KIcon 版本里真实不存在。
- **未发现空转用例**:四条 it 各自锚定了具体渲染产物,删除对应生产代码行会导致断言失败(pathHtml 逻辑/props 透传/PATHS 表都被直接引用)。
- **未发现既有断言被削弱或删除**;303→304 个测试文件、2719→2724 例的算术与全量实测吻合(见下)。
- **提交卫生**:仅 2 个新文件,无其它文件改动。

## 10. 三门(独立实测)

```
pnpm test                   → Test Files  1 failed | 303 passed (304)
                                    Tests  1 failed | 2723 passed (2724)
  唯一红项:src/files/upload/persist.test.ts > persist > dropPersisted removes record + blob and frees budget
  —— 与治理文件 §8/§10 记录的已知 IndexedDB flaky 噪声完全对应。
  单独复跑该文件:pnpm test -- src/files/upload/persist.test.ts → 1 passed (1) / 14 passed (14),exit=0。
  判定:与本任务无关的既有噪声，不算红。

pnpm exec vue-tsc --noEmit  → 无输出，exit=0
```

**排除已知噪声后,实测数字与实现者报告的 304 文件 / 2724 例完全一致。** `pnpm build` 按指示未重跑(实现者已跑过 exit 0)。

## 11. 提交卫生

- `git log --oneline -1` → `3d44a67 feat(knowledge): SP8-P5a KIcon 移植(42 glyph,不复用 AgentIcon)`
- `git show --stat HEAD` → 只含 `KIcon.vue`(+80)与 `KIcon.test.ts`(+46),无其它文件。
- `git status --short`(New-UI,评审后)→ 空,干净。
- `NimoOS-UI` 只读仓:`git log -1` 是 SP7 会话遗留的 `ed452976`,working tree 有 SP7 的未提交改动(`docs/superpowers/specs/...design.md` 修改 + 一个 untracked `FRONTEND_API_GUIDE.md`)——**均与本任务无关,未新增任何提交或改动,已确认未被本任务触碰。**
- `.sp8/NimoOS-Service`:`git log -1` 是 T1/T2 遗留的 `03d3028`,working tree 干净,**本任务(Task 3 只碰前端 KIcon)未在此仓产生任何新提交**。

## 12. 独立 RED 探针(不同于实现者的互换对象)

实现者做的探针是互换 `settings`/`user`(两者恰好都被 K4 强断言覆盖)。我选了**只被弱断言「22 个 name」覆盖、未被 K4 六条强断言或 check/code 覆盖**的一对:`history` 与 `layers`。

**破坏(互换 path 值)**:
```diff
- history: '<g><circle cx="10" cy="10" r="7"/><path d="M10 6v4l3 2"/></g>',
+ history: '<g><path d="M10 3l7 4-7 4-7-4 7-4z"/><path d="M3 11l7 4 7-4M3 15l7 4 7-4"/></g>',
...
- layers: '<g><path d="M10 3l7 4-7 4-7-4 7-4z"/><path d="M3 11l7 4 7-4M3 15l7 4 7-4"/></g>',
+ layers: '<g><circle cx="10" cy="10" r="7"/><path d="M10 6v4l3 2"/></g>',
```
（即 `history` 装上了原 `layers` 的图形，`layers` 装上了原 `history` 的图形。）

**结果**:
```
pnpm test -- src/ai/knowledge/components/KIcon.test.ts
Test Files  1 passed (1)
     Tests  4 passed (4)
exit=0
```
**全绿,无一条报红。** 这证实了一个真实、可复现的测试质量缺口:42 条 glyph 里,除了 `check`(测试2直接锚定 path)、`code`(K4 补的正向+负向)、`grid`/`settings`/`user`/`pause`/`download`(K4 六条负向锚点,`code` 与它们共 6 个)之外,**其余约 35 个 glyph 的坐标错误(错位/写串/复制粘贴错行)不会被任何测试捕获**——本任务标题里说的「一个坐标错了,界面上就是一个歪图标,单测只查非空抓不到」这句话被坐实。

**还原**:`cp` 备份文件覆盖回 `KIcon.vue`,`diff` 备份与当前文件确认 0 行差异,`git status --short` 与 `git diff --stat` 在探针操作前后均为空(修改发生在工作区未 add/commit 阶段)。**已确认精确还原。**

### 建议的最小补救(Important,非本任务必须立即修但应登记)

不要逐个手写「against AgentIcon」式判别断言(维护成本高、覆盖不全),改为**对全部 42 条做一次与蓝本的整体等价校验**,例如:
```ts
// 从蓝本 PATHS 对象体生成一份固定的 expected 快照（可以是本次评审提取的 42 行文本，
// 或直接把蓝本 PATHS 对象体贴成测试内常量），逐 key 断言 KIcon 内部渲染结果与蓝本一致。
```
或更轻量:给 `KIcon.test.ts` 加一条「42 个 key 与蓝本逐字符相同」的用例，直接把蓝本 42 行文本内联进测试文件作为 fixture 常量，`expect(actual[k]).toBe(expected[k])` 全量跑一遍——这样任何坐标错位都会精确报红成对应的 key 名，而不是像现在这样只有 6+1 个 glyph 被保护。这不是本任务(纯移植)当场必须做的返工，但应作为测试质量债务登记进台账，供后续批次（P5b 起同样有 Icon 组件移植时）参照收紧标准。

## 13. §3.5「照抄不改」

本任务不涉及 N1-N8 任何一条(KIcon 是纯展示叶子组件,不读后端数据、无竞态处理)。核实报告的说法准确。

## 14. 结论

- **Spec 合规**:✅(42 条 path 逐字节一致、svg 骨架/props 默认值/未命中行为逐项对齐、零 style 块、v-html 处理未自创、未碰 AgentIcon、文件头注释照抄 brief、提交只含 2 个目标文件)
- **任务质量**:通过,但测试覆盖有一个真实缺口(见 §9/§12),按 Important 登记,不影响本任务合并判定(移植本身正确,缺口是测试深度不足而非移植错误)。
