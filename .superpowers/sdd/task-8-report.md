# Task 8 报告:i18n 双源统一 + InstallingAppCard 死绑定

## Step 1: 全仓消费点 grep

Brief 给的 grep 命令跑出的结果**远多于** brief 预估的"index.ts + parity.test.ts + 3 个测试文件"——实际是:

- `src/i18n/index.ts`(具名导入,需改)
- `src/i18n/parity.test.ts`(具名导入,需改)
- `src/i18n/i18n.test.ts`(具名导入,漏在 brief 描述之外,需改)
- **28 个**测试文件用 `import { messages } from '.../i18n/zh_cn'`,并把 `messages`(即 `{ zh_cn: {...} }` 整体)直接塞进 `createI18n({ ..., messages })` 的配置项,其中 2 个文件(`UploadPanel.test.ts`、`SharesPage.test.ts`)额外用 `messages.zh_cn.xxx` 做值断言
- **8 个** Task4-6 新测试文件已经用 `import zh from '.../i18n/zh_cn'` + `messages: { zh_cn: zh }` 写法(即目标形状,未改动)

未发现第三种用法(没有 `require`/动态 import,没有 `.default` 访问,没有直接 import `en_us` 的测试)。

## Step 2: 改造

- `src/i18n/zh_cn.ts`、`src/i18n/en_us.ts`:去掉外层 `export const messages = { zh_cn: {...} }` / `{ en_us: {...} }` 包裹和末尾 `export default messages.zh_cn/en_us`,改为单一 `export default { ...原键值... }`。**内容验证**:用 `git show HEAD:<file>` 取重构前内容与新文件做 key 抽取对比(`grep -oP "^\s*\K[a-zA-Z0-9_]+(?=:)"`),两侧唯一差异是被删掉的外层 wrapper 键本身(`zh_cn`/`en_us`),449 个实际文案键完全一致;`git diff` 也确认每一行只是被反缩进 2 空格,值零变化。
- `src/i18n/index.ts`:改为 `import zh from './zh_cn'` + `import en from './en_us'`,`messages = { zh_cn: zh, en_us: en }`。
- `src/i18n/parity.test.ts`:改为 default import,`Object.keys(zh)`/`Object.keys(en)` 直接取代 `.zh_cn`/`.en_us` 二级访问,断言逻辑不变。
- `src/i18n/i18n.test.ts`(brief 未提及但 grep 发现的消费点):同样改为 default import + 拍平键访问。
- **28 个测试文件**批量转换(用脚本对确认过的固定行模式做替换,逐个文件核对过结果):
  - `import { messages } from '<path>'` → `import zh from '<path>'`
  - `createI18n({ ..., locale: 'zh_cn', messages })` → `createI18n({ ..., locale: 'zh_cn', messages: { zh_cn: zh } })`
  - `messages.zh_cn.xxx` → `zh.xxx`(仅 `UploadPanel.test.ts`、`SharesPage.test.ts` 各 3/1 处用到)
  - 转换后这 28 个文件与已存在的 8 个 Task4-6 新测试写法完全统一。
- `InstallingAppCard.vue`:删除第 11 行 `:class="{ err: task.state === 'error' }"`。确认 scoped `<style>` 里从未定义 `.err` 规则,也确认 `InstallingAppCard.test.ts` 无任何针对 `.err`/`err` 的断言。

## Step 3: 全量回归

```
pnpm test
  Test Files  200 passed (200)
  Tests       977 passed (977)

pnpm exec vue-tsc --noEmit
  (无输出,exit 0)
```

两者均全绿,一次性通过,无需二次修复。

## Step 4: 提交

```
git add -A -- src/i18n/ src/apps/components/InstallingAppCard.vue <28个测试文件路径>
git commit -m "refactor(i18n): locale 文件统一为 default 拍平单源;删 InstallingAppCard 死绑定(P3 挂账)"
```

commit `24a784f`,34 files changed, 1011 insertions(+), 1019 deletions(-)。

**范围说明**:brief 的 Step 4 命令只写了 `git add src/i18n/ src/apps/components/InstallingAppCard.vue`,但 Step 1 grep 出的 28 个测试文件是本次重构**必须同步修改**的消费点(否则它们会因为具名 `messages` 导出被删除而全部报错),因此一并纳入本次提交,未单独拆开。

## 主题自查

`git diff` 中无新增 `#hex`/`rgb(`/`rgba(` 字面量(本任务不涉及样式改动,仅删除一个 class 绑定)。

## 遗留/关注点

无。所有已知消费点均已处理并验证;测试与类型检查全绿。

## 备注

本文件此前遗留了一份**不相关的旧 Task 8 报告**(已装页安装中卡片 + install-end 职责迁移,commit c59dd07),推测是编号复用/更早阶段留下的。已按当前任务要求覆盖为本报告。
