# SP5-P8 收口 + 翻入口(应用区 cutover)台账

Plan: `NimoOS-UI/docs/superpowers/plans/2026-07-23-vue3-migration-sp5-p8-cutover.md`(docs 分支 f78358ac)
执行:2026-07-23,inline(executing-plans;本期仅 1 个代码任务,未走 SDD 子代理)

## Task 1: useOpenAction cutover ✅

- commit **ecfefa8**(master):`SYS_ROUTE` 删 `appstore` 行;`openApp` 的 system 分支加
  `if (key === 'appstore' && !appsCutoverDisabled()) { router.push('/apps/store'); return }`;
  回退 flag `strangler:disabled:/apps`==`'1'` 时经 `SYS_ROUTE[key] || '/#/legacy'` 兜底回老弹窗。
- `settings` 磁贴维持 `/#/legacy` 不动(spec §3.7);Vue2 `strangler.js` 零改动(无 /apps 老路由)。
- TDD:原「settings/appstore → legacy」用例拆 3(settings 不动 / appstore push / flag 回退),先红后绿;
  beforeEach 补 `localStorage.removeItem('strangler:disabled:/apps')` 隔离。9/9 绿。

## Task 2: 收口扫描 + 守门 + 部署 ✅

### i18n 双向扫描(留证)

```bash
# 模板文本节点(src/apps 全部 .vue,排除 test)
for f in $(find src/apps -name "*.vue" | grep -v test); do awk '/<template>/,/^<\/template>/' "$f" | sed 's/<!--.*-->//' | grep "[一-龥]" | grep -vE "^\s*(<!--|[^<]*-->)" ; done | grep -v "^\s*$" | wc -l
# → 0
# TS 字面量含中文行(排除 test 与行首注释)
grep -rn "[一-龥]" src/apps --include="*.ts" | grep -v test | grep -vE "^\s*[^:]+:[0-9]+:\s*//" | grep -E "['\"\`][^'\"\`]*[一-龥]" | wc -l
# → 17,逐条人工核验:全部是 /** */ 文档注释与行尾 // 注释(installProgress/installedApps/sources/
#   sourceMeta/composeSettings/importNormalize/systemApp/linkApps),零真实 UI 字面量。
#   与 SP4-P8 审计同型结论:命中皆注释,i18n 欠账不存在。
```

- `src/i18n/parity.test.ts` 3/3 绿(zh_cn/en_us 键 parity)。

### 窄屏抽屉复检(代码面)

```bash
grep -Ln "AreaShell" src/apps/views/*.vue | grep -v test   # → 空输出
```

7 个视图(Installed/Store/StoreDetail/Custom/Settings/Console/Sources)全部经 AreaShell 渲染,
≤768px ☰ 抽屉自动覆盖。真机跨断点点验列入验收清单。

### 全量守门 + 部署

- `pnpm test`:**214 文件 / 1199 全绿**;`vue-tsc --noEmit` 0 错。
- `./scripts/deploy.sh` → `/var/lib/nimoos/www/app/`,`curl /app/` = 200,入口 chunk `index-NmpLZmcm.js`(新哈希)。
- 本次部署一并带出 master 上此前未部署的提交:1a55c5e、d4a7917(用户搜索 demo 修订)、b056ed3(P6 遗留 YAML 间距)——master 即部署基准,预期行为。

## 待用户真机验收

1. **cutover 回退实演(本期核心)**:桌面点「App Store」磁贴 → `/app/#/apps/store`;
   DevTools `localStorage.setItem('strangler:disabled:/apps','1')` → 磁贴回 `/#/legacy` 老弹窗;清 flag → 回新页。
2. 窄屏 ≤768px:/apps 各页 ☰ 抽屉开合、遮罩/ESC/导航自动收起。
3. 全区回归抽查(各期已单验):装/卸商店应用、设置改端口、终端+日志、自定义 YAML、docker run 导入、商店源增删。
4. 挂机>3h 后开终端(连前预刷新自愈)。

坐标:New-UI `master`@**ecfefa8**(+本台账提交)。
