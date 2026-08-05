# P5a Task 0 —— 公共约束文件产出报告

## 产出

`.superpowers/sdd/p5a-common-constraints.md`(241 行),提交 `30fc053`。

## 逐节写了什么

- **头部**:两条优先级声明(brief 冲突时以本文件为准;本文件与设计冲突时以设计为准)+ 设计/计划/三份附录的绝对路径引用(未把附录内容复制进正文,只引路径,按 brief 要求)。
- **§1 工作区**:两个可写仓(New-UI + Service,均 `sp8-ai` 分支)、只读两仓、禁碰两仓;补了 brief 要求的两条额外规则:① 蓝本一律 `git show main:` 读,工作树是 07-15 旧版且缺 NotesView/WikiView;② `NimoOS-UI` 是共享检出,SP7 会话在改它,本期任何任务都不该在其中提交。
- **§2 移植纪律**:照 p4 原样(界面 1:1、逻辑不照抄、三件套、判据、brief 测试代码错误不让步)。
- **§3 已授权偏离**:brief 的 K1–K8 + P1–P4 共 12 条,连「依据」列逐字照搬。末尾加了一条「说明」,解释设计文档 §7 初始清单里的「弹窗 DialogPortal」条为何没有出现在本批 K1–K8 —— 因为 P5a 范围(壳+仪表盘)不含任何弹窗组件,弹窗类偏离会出现在 P5b/c/d 各自的 common-constraints 里,不是本文件遗漏。
- **§3.5**:brief 的 N1–N8 共 8 条,照搬。
- **§4 数据契约**:brief 的「数据契约」全文,含后端来源三分表、Parser/Notes/Wiki 实测形状、K1 单层取数命中清单。
- **§5 代码范式**:从 `src/ai/knowledge/{views,components,stores,util}/` 各自出发的相对路径表;落地前自己 grep 确认的三件事都已核实(见下)。
- **§6 配色**:加了两条 P5a 特有的(`.knowledge-app` 是第四个嵌套作用域 + token 声明层豁免登记),并保留 color-guard 不扫 `.scss` 的警告。
- **§7 i18n**:前缀 `aiKb*`,值指向附录 A,复用键 `aiCfgYou` 的值已亲自 grep 核实。
- **§8 测试门**:基线 303/2719、tsc 0、build 0;`.vue` +4(T3/T5/T10/T12)算术,收官 307 文件;新增一条 Service 仓跨仓构建步骤(`pnpm build` → 消费仓 `pnpm install`)。
- **§9 测试质量**:照 p4 原样(禁空转、RED 探针、`vi.hoisted()`、`flushPromises()`)。
- **§10/§11**:文件名前缀改 `p5a-task-N-report.md`/`p5a-task-N-review.md`;§11 保留最低 sonnet/禁 haiku/不采信实现者报告/自做 RED 探针并还原/不许改仓库不许提交,并加了一条「本期评审要回权威源核 Vue2 蓝本与后端实测形状,不许只信计划里抄的行号」。

## 回权威源核实过的三处(与计划原文不同,协调者已预先核出,本次逐一验证)

1. **KIcon 图标数 = 43**(不是设计 §2.5 正文写的「42」)。验证:
   ```
   git ls-tree -r main --name-only | grep -i "KIcon"
   → src/components/common/KIcon.vue   (不是设计文中口径的 views/AI/Knowledge/components/common/ 路径)
   git show main:src/components/common/KIcon.vue | grep -oE "^\s*[a-zA-Z]+: '" | sort -u | wc -l
   → 43
   ```
   已在 §1 里额外注明蓝本 KIcon.vue 的真实路径。

2. **`aiCfgYou`**:`grep -n "aiCfgYou" src/i18n/zh_cn.ts src/i18n/en_us.ts`
   → `src/i18n/zh_cn.ts:605: aiCfgYou: '你',` / `src/i18n/en_us.ts:603: aiCfgYou: 'You',`
   与 brief 给出的值一致,已在 §7 与 §3 K8 里写明。

3. **T3 测试注释「18 vs 22」**:此项不属于本任务(T3 是后续实现者的任务),按协调者已核实的结论直接采信,未额外复核(不在本文件的写作范围内,brief 里也未要求 Task 0 复核这条,只在 T3 自己的 brief 里适用)。

## 额外亲自核实的事项(§5/K8 落地前 grep)

- `src/stores/toast.ts:18` 的 `show()` 真实签名:`show(text: string, duration = 1500, tier: ToastTier = 'info')` —— 已读全文件确认。
- `src/stores/userProfile.ts` 全文只有 `avatarVersion`/`bumpAvatarVersion` 两个导出,没有用户名字段 —— 已读全文件确认,写进 §5。
- `src/ai/components/settings/SettingsRail.vue:75-86`(实际读取行号在 96-119 附近,文件内 `StoredUser`/`user`/`userLabel` 定义处)—— 已读该文件相关片段,确认 K8 描述的模式(`StoredUser` 接口 + `computed` 内 `JSON.parse` 套 try/catch + `nickname || username || t('aiCfgYou')`)逐字存在,已在 §5 里给出代码片段。
- `src/ai/components/icons/AgentIcon.vue` 现有位置已 grep 确认(`src/ai/components/icons/AgentIcon.vue`),用于 §5 说明 `KIcon.vue` 与它并存互不导入。
- `src/router/index.ts` 现状:目前无 `/ai/knowledge` 相关路由、也无 `settingsRoutes.ts` 式独立路由文件先例(设计 §5.2 提到的 SP9-P0 `settingsRoutes.ts` 先例可能在别的分支/仓库,本仓当前 sp8-ai 分支未见)——未强行编造该文件是否存在,只在 §5 目录结构里给出设计 §5.1 的目标结构,路由文件的具体拆分留给 T2 任务自己决定,未越权替后续任务下结论。
- `.gitignore:6` 确认 `.superpowers/` 已忽略,故 `git add -f`。
- HEAD 提交确认为 `99ee99a`(与基线一致),Service 仓 HEAD 为 `c8f1919`(与基线一致)。

## git 自查输出

```
$ git show --stat HEAD
commit 30fc053cff3344fbf523283503565a87c022ce61
Author: Tiansanchuan <1312528051@qq.com>
Date:   Fri Jul 31 18:44:30 2026 +0800

    docs(sp8): P5a 公共约束

 .superpowers/sdd/p5a-common-constraints.md | 241 +++++++++++++++++++++++++++++
 1 file changed, 241 insertions(+)

$ git status
On branch sp8-ai
nothing to commit, working tree clean
```

## 评审后修复轮(commit `6dd2079`)

评审回来两条行号错误(治理文件里的行号会被 12 个任务当真,故必须精确),协调者已回权威源复核并给出实测值,我逐一独立复核后照改:

1. **开放发现 1(Important)——§5 全局 toast 签名行号**
   - 改前:`全局 toast 真实签名(`src/stores/toast.ts:18`)`
   - 改后:`全局 toast 真实签名(`src/stores/toast.ts:21`)`
   - 独立复核:`sed -n '15,25p' src/stores/toast.ts` —— 第 18 行是 `export const useToast = defineStore('toast', () => {`,第 21 行才是 `function show(text: string, duration = 1500, tier: ToastTier = 'info') {`。签名内容本身无误,只是行号错。

2. **开放发现 2(Minor)——§3 K3 蓝本行号**
   - 改前:`蓝本 `KnowledgeLayout.vue:96-99` 的 toast **无条件**渲染绿勾…`
   - 改后:`蓝本 `KnowledgeLayout.vue:93-96` 的 toast **无条件**渲染绿勾…(计划原文写 96-99,协调者回蓝本复核后订正为 93-96)`
   - 独立复核:`git show main:src/views/AI/Knowledge/KnowledgeLayout.vue | sed -n '88,99p'`(在 `NimoOS-UI` 仓执行)—— 93 行 `<div v-if="store.state.toast" class="k-toast">`、94 行 `<span class="k-toast-ico"><KIcon name="check" :size="10" color="white"/></span>`、95 行 `{{ store.state.toast }}`、96 行 `</div>`。确认是 93–96,不是 96–99。

3. **未改动的两项(仅知悉,不涉及本文件)**:
   - 评审指出 KIcon「43 条 glyph」应为 42 条(之前把组件自身 `name: 'KIcon'` 的 prop 定义误数进去)。本文件正文没有写出任何 KIcon 总数,故**不受影响**,未做任何修改。协调者会在 T3 的 brief/台账里订正。
   - `.superpowers/sdd/p5a-common-constraints.md` §3 关于「设计 §7 DialogPortal 项不在本批 K1–K8」的说明,评审确认处理得当,原样保留。

`git show --stat HEAD`(第二次提交,`6dd2079`):
```
commit 6dd207971fdae154b999cb9453a72d494b369764
Author: Tiansanchuan <1312528051@qq.com>
Date:   Fri Jul 31 19:02:00 2026 +0800

    fix(sp8): P5a 公共约束行号订正(评审 Important/Minor)

 .superpowers/sdd/p5a-common-constraints.md | 4 ++--
 1 file changed, 2 insertions(+), 2 deletions(-)
```
`git status`:
```
On branch sp8-ai
nothing to commit, working tree clean
```

## 顾虑

- 无重大顾虑。设计文档 §7 的「弹窗 DialogPortal」偏离条未出现在本批 K1–K8 里,已在文件内以「说明」形式显式记录判断依据(P5a 范围不含弹窗),供后续批次/协调者复核该判断是否成立。
- `src/router/index.ts` 目前没有独立路由文件(`settingsRoutes.ts` 式)先例可循,设计 §5.2 提到的先例可能不在本分支 —— 未强行下定论,留给 T2 实现者自行确认并按需申报。
