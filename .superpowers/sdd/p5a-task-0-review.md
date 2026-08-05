# P5a Task 0 —— 独立评审(公共约束文件)

评审者:sonnet(独立会话,不采信实现者报告,逐条回权威源核对)。

## 判定

- **Spec 合规**:✅ —— brief 要求的 11 节骨架(§1–§11 + §3.5)全部落地,§1 两个可写仓、§3 K1–K8/P1–P4 与 §3.5 N1–N8 与 brief 逐字一致(已 diff 确认),§4/§6/§7/§8/§11 内容与 brief 及设计文档吻合,提交卫生干净。
- **文件质量**:**通过,但有 1 条 Critical 需协调者在派工 T3 前处理**(见下)。其余为 Important/Minor,不影响 T0 本身收口,但会被后续任务当真,建议一并修。

## 逐条发现

1. **[Critical]** `KIcon.vue` 的 glyph 总数「43」是错的,真实是 **42**。
   - 验证:`git show main:src/components/common/KIcon.vue` 里 `const PATHS = {...}` 对象直接数键(写小脚本按对象边界切片、正则取键名),精确得到 **42** 个 icon key(plus/folder/search/…/funnel)。
   - 根因:brief/协调者/实现者报告共用的验证方法 `grep -oE "^\s*[a-zA-Z]+: '" | sort -u | wc -l` → 43,但这条 grep **误把 `export default { name: 'KIcon', ... }` 里的组件自身 `name: '` 属性也当成了一个 icon key**——`PATHS` 对象之外的 `name: 'KIcon',` 一行同样匹配 `^\s*[a-zA-Z]+: '` 模式,把计数污染了 +1。
   - 设计文档 `2026-07-31-vue3-migration-sp8-p5-knowledge-design.md` §2.5 自身也自相矛盾:叙述句写「`KIcon.vue` **42** 个图标」,但结论句写「移植成…(**43** 图标…)」——同一段落两个数字,后者显然是同一个 grep 误差传染的结果。
   - 好消息:本次审的产出物 `p5a-common-constraints.md` **没有**在正文任何地方写出具体总数(42 或 43 均未出现),K4 只列了 6 个真异形图标名,没受这个错误数字污染,所以**本文件本身不算失职**。但因为 T3(KIcon.vue 移植任务)的 brief 目前还没生成(`ls .superpowers/sdd/ | grep p5a-task-3` 无结果),而协调者给我的任务描述里明确把「43」当作「已核定口径」——这个口径本身是错的,若原样写进 T3 brief 会让实现者去凑 43 个图标(多拆/多造一个),必须在写 T3 brief 前更正为 42,并顺手修一下设计文档 §2.5 那句自相矛盾的结论句。

2. **[Important]** §5「全局 toast 真实签名」写 `src/stores/toast.ts:18`,但 `show()` 函数实际定义在 **第 21 行**(`cat -n` 核实:18 行是 `export const useToast = defineStore('toast', () => {` 这个开括号行,21 行才是 `function show(text: string, duration = 1500, tier: ToastTier = 'info') {`)。签名本身(默认 1500ms、三个参数)是对的,只是行号指错了实际函数所在行(比 p4 模板的写法更不准——p4 原文写的是范围 `18-27`,涵盖整个 `defineStore` 块,本文件把它收窄成单一行号 `18`,反而从"大致范围对"变成"精确指向错误行")。

3. **[Minor]** §3 K3 引用「蓝本 `KnowledgeLayout.vue:96-99` 的 toast 无条件渲染绿勾」,但 `git show main:src/views/AI/Knowledge/KnowledgeLayout.vue` 里那段 `<div v-if="store.state.toast" class="k-toast">…</div>` 实际是 **93–96 行**,96 行已经是收尾 `</div>`,97–99 是外层 `</div>`/`</template>`/空行,与 toast 无关。此错误是从 brief 原文逐字继承(brief 里这条也是 96-99),不是 Task 0 实现者引入的——按 Step 1「K1-K8 换成计划原文」的指令,他做对了"照抄";只是这个"照抄对象"本身有瑕疵。建议顺带告知协调者,T10(KnowledgeLayout)实现者用到这条时自己 grep 一下真实行号(反正 §2 移植纪律本来就要求"逐字节对照",行号错一点不影响最终产物正确性,只是评审/实现效率上的小坑)。K8 那条同类型引用(`KnowledgeLayout.vue:176-181`)**经核实是准确的**(176 行 `userName() {` 到 181 行闭合 `},`,与蓝本逐行吻合),说明这不是系统性问题,只是 K3 那一条单独有误。

## ⚠️ 无法从产出物核实的项

无。brief 要求核的所有点(KIcon 路径、`aiCfgYou` 双档行号与值、`toast.ts` 签名、`SettingsRail.vue` 引用、`userProfile.ts` 反面警告、`aiKb` 前缀 0 命中、color-guard 行为、基线数字、git 状态)均已逐条打开源文件亲自验证,没有需要协调者补充材料才能核的盲点。

## 逐条核实明细(按 brief 顺序,未在上面列出的即"核实通过,与文件一致")

- **§3(K1–K8/P1–P4)与 §3.5(N1–N8)**:与 brief 逐字 diff,K/P 表仅有 1 处必要改动(K1 的「§数据契约」→「§4 数据契约」,是合理的章节号补全,非内容改动);N 表完全一致。
- **K1 单层取数命中清单**:§3 指向 §4,§4(116 行)给出的清单与 brief 逐字相同,且与 §4 上方的 Parser/Notes/Wiki 形状描述自洽(`stats`/`control`/`jobs`/`files`/`extensions`/`rules`/`notes`/`createRoot` 全部覆盖,无遗漏)。
- **§4 数据契约**:回读设计文档 §6.1/§6.2/§6.3/§6.4 逐字核对——`parserStats` 无 `rate_per_min`/`done_last_10m`/`eta_s`(设计 §6.1 原文确认)、`parserState` 只有 5 个字段(设计 §6.1 原文确认,字段名与顺序一致)、`extensions[].enabled` 是 0/1 整数(设计 §6.1 原文确认)、Wiki `/roots` PascalCase 且 POST 用 Go 字段名(设计 §5.3 原文确认)、distill 四端点 404(设计 §6.4 原文确认)。全部无抄错、无漏项。新增的「后端来源三分」表是从设计 §2.3 提炼补充,内容准确(路径改写举例 `/ai/parser/state → /v1/parser/control/state` 与设计 §2.3 原文一致)。
- **§5 代码范式**:
  - `toast.ts` 签名文字正确,行号错(见发现 2)。
  - `SettingsRail.vue:75-86`:亲自打开核实,75 行 `interface StoredUser {...}` 到 86 行 `userLabel` computed,行号**准确**;代码片段内容与源文件逐字一致(仅 catch 块从多行折成单行,属排版简化,语义不变)。
  - `userProfile.ts`:亲自打开核实,全文件只有 `avatarVersion`/`bumpAvatarVersion` 两个导出,**没有**用户名字段,K8 的反面警告成立。
  - `KIcon.vue` 蓝本真实路径 `src/components/common/KIcon.vue`(不在 `views/AI/Knowledge/components/common/` 下)——`git ls-tree`/`git show main:` 核实**准确**。
  - `AgentIcon.vue` 现址 `src/ai/components/icons/AgentIcon.vue`——`find` 核实**准确**。
  - 相对路径表(`../components/KIcon.vue`、`../stores/knowledgeStore.ts`、`../util/dashboardHelpers.ts`、`../../../stores/toast.ts`)按设计 §5.1 目录结构逐层推算,数学正确。
  - `zh_cn.ts:605`/`en_us.ts:603` 的 `aiCfgYou` 行号与值(zh=你/en=You)——`grep -n` 核实**准确**。
- **§6 配色**:亲自打开 `src/styles/color-guard.test.ts` 全文核实——① 确认它用 `import.meta.glob` 同时扫 `**/*.vue`(只取 `<style>` 块内容)与 `**/*.css`(全文,`theme.css` 排除),**不扫 `.scss`**——描述属实。② 逐行扫描且**不跳过注释行**(唯一的豁免机制是显式 `theme-exception` 标记,不认注释语法本身)——描述属实。③ `.knowledge-app` 第四嵌套作用域、token 声明层豁免边界、禁 `theme-exception` 逃逸,均与设计 §5.4/§9 风险 3 一致。
- **§7 i18n**:`grep -rn "aiKb" src/i18n/*.ts` 实测 **0 命中**,与文件「写前需确认未被占用」的前提一致。附录 A 实测 96 条 `aiKb*` + 1 条复用键,与 §7 声称的数字吻合;末尾 `aiKbDeferredTitle`/`aiKbDeferredHint` 两条新造文案存在于附录 A 末尾,与 §7 描述一致。
- **§8 测试门**:基线 `99ee99a` 确认是当前 HEAD 的父提交(`git log --oneline -2`),与「303/2719/tsc 0/build 0」的声称基线吻合;Service 基线 `c8f1919` 是 `.sp8/NimoOS-Service` 当前 HEAD,吻合;`.vue` +4 算术(T3/T5/T10/T12)与设计 §4 分批描述一致;跨仓 `pnpm build`+`pnpm install` 步骤按 brief 要求补充,措辞未软化(仍是"必须"级别)。
- **§11 评审者要求**:最低 sonnet/禁 haiku、不采信实现者报告、自做 RED 探针并还原、不许改仓库不许提交、回权威源核对蓝本与后端形状——全部保留,无一条被弱化或漏抄。
- **骨架完整性**:对照 `p4-common-constraints.md` 的 §1–§11(含 §3.5),本文件章节编号、顺序、标题风格完全对应,无缺节、无多写与本期无关的节。
- **约束强弱**:通读全文未发现"禁"被软化成"尽量避免"、硬基线被写成约数等情况。

## 提交卫生(实测)

```
$ git show --stat HEAD
commit 30fc053cff3344fbf523283503565a87c022ce61
    docs(sp8): P5a 公共约束
 .superpowers/sdd/p5a-common-constraints.md | 241 +++++++++++++++++++++++++++++
 1 file changed, 241 insertions(+)

$ git status
On branch sp8-ai
nothing to commit, working tree clean
```
- **`.sp8/NimoOS-Service`**:`git status --short` 空,`git log --oneline -1` = `c8f1919`(与基线一致,未被误触)。
- **`NimoOS-UI`(共享检出)**:`git status --short` 有若干 SP7 会话遗留的未提交改动/未跟踪文件(如 `FRONTEND_API_GUIDE.md`、多个 `docs/superpowers/plans/*.md`),`git log --oneline -1` = `f8eea019`——**这些都不是本任务产生的**(本任务全程只读该仓,commit 历史与工作区脏改动与 P5a 无关联,属于已知的"共享检出,SP7 在改它"背景噪声,产出物 §1 里已如实警示"一个都别碰")。

## RED 探针(git 跟踪实证,已完成,未改动仓库)

```
$ cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
$ git ls-files --error-unmatch .superpowers/sdd/p5a-common-constraints.md
.superpowers/sdd/p5a-common-constraints.md          ← 有输出 = 文件确实被 git 跟踪(不是仅存在于磁盘而漏 add -f)
$ git show HEAD --stat
commit 30fc053... docs(sp8): P5a 公共约束
 .superpowers/sdd/p5a-common-constraints.md | 241 +++++++++++++++++++++++++++++
 1 file changed, 241 insertions(+)
```
探针确认:`.gitignore:6` 的 `.superpowers/` 忽略规则确实存在,但实现者正确用了 `git add -f`,文件被完整跟踪进提交,不存在"报告说已提交、实际停在磁盘"的假阳性。**本次评审全程未修改任何仓库文件,无需还原**(RED 探针只是只读的 `git ls-files`/`git show`,未做任何"故意弄坏再复原"的破坏性操作,因为本任务无生产代码可破坏——按 brief 指示,探针改为对 git 跟踪状态的实证,已如实执行)。
