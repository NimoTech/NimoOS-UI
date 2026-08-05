### Task 15: 正式出包 —— 四道门 + 零历史 + 幂等 + 眼验

**Files:**
- Create: `/home/nimo/NimoTech/NimoOS-Web/`(产出物,本地仓)
- Modify: 无(只跑脚本)

**Interfaces:**
- Consumes: 前 14 个任务的全部产物
- Produces: 可交付的开源仓

- [ ] **Step 1: 出包**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
node oss/export.mjs
```

Expected:六步全过,末行 `[oss] 完成 → /home/nimo/NimoTech/NimoOS-Web`,**无警告**。

- [ ] **Step 2: 四道门(spec §7.5)**

```bash
cd /home/nimo/NimoTech/NimoOS-Web
pnpm install
pnpm test 2>&1 | tail -8; echo "TEST_EXIT=${PIPESTATUS[0]}"
pnpm exec vue-tsc --noEmit;  echo "TSC_EXIT=$?"
pnpm build;                  echo "BUILD_EXIT=$?"
```

Expected:三个 EXIT 全 0;测试文件数比私有侧(352)少约 25。

- [ ] **Step 3: 产物也过一遍禁词扫描(§6.4)**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
node -e "
import('./oss/forbidden.mjs').then(({scanTree}) => {
  const f = scanTree('/home/nimo/NimoTech/NimoOS-Web/dist');
  console.log(f.length ? f.slice(0,40) : '构建产物零命中');
  process.exit(f.length ? 1 : 0);
})"
```

Expected:`构建产物零命中`,退出码 0。**若这里红了**,说明 i18n 键或注释被打进了 bundle —— 回 T8/T13 补。

- [ ] **Step 4: 零历史与身份检查**

```bash
cd /home/nimo/NimoTech/NimoOS-Web
git rev-list --count HEAD          # 必须是 1
git log --stat | head -5
git remote -v                      # 必须为空 —— 不加 remote、不 push
grep -c . .export-report.txt       # 有内容
git check-ignore -v .export-report.txt   # 必须被 ignore
```

- [ ] **Step 5: 手工抽查(§11 第 4 条)**

```bash
grep -ri "相册\|nimo ai\|transcript\|qdrant\|ollama\|immich\|192.168.1.115" \
  /home/nimo/NimoTech/NimoOS-Web --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=dist
```

Expected:零命中(命令无输出)。

- [ ] **Step 6: 幂等性**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
node oss/export.mjs
cd /home/nimo/NimoTech/NimoOS-Web
git status --porcelain            # 必须为空
git rev-list --count HEAD         # 仍是 1
```

Expected:第二次导出结果与第一次逐字节一致(`git status` 空),历史仍是 1 条。

- [ ] **Step 7: 起 dev server 眼验(不是 deploy.sh)**

```bash
cd /home/nimo/NimoTech/NimoOS-Web
pnpm dev --host --port 5299
```

> **端口 5299** —— 避开在跑的三条线(master 5273 / .sp7 5277 / .sp8 5288)。
> **绝对不要跑 `./scripts/deploy.sh`**:设备上只有一个 `/app/` 目录,`deploy.sh` 是
> `rsync --delete`,会覆盖别人的部署。

逐条自查,暗色 + 亮色各走一遍:

- [ ] 桌面首屏:**无搜索胶囊**、**无 AI 组件**、**无照片磁贴**,上面 6 行填满不漏、末两行留空
- [ ] Dock:4 项(文件 / 存储 / 虚机 / 商店),无相册、无 AI
- [ ] 点**设置**磁贴 → 落在 `/settings`(**不是白屏、不是 `/#/legacy`**)
- [ ] 点**虚机**磁贴 → 落在 `/kvm`(不是白屏)
- [ ] 设置 rail **6 项**,没有「文件夹权限」;账号 tab 里的**成员文件夹授权仍在**
- [ ] 添加面板:三个 tab(小组件 / 应用 / 文件夹),无「照片」
- [ ] 音频预览:播放器 + 波形正常、**竖条有颜色**,右侧**无三 tab 面板**
- [ ] 手机断点(≤720px):启动器正常,无照片磁贴
- [ ] ⌘K / Ctrl+K 按下去**没有任何反应**(搜索面板已整块移除)

- [ ] **Step 8: 把验收结果与截图交用户,并记账**

在会话里报告:四道门的实际输出、`rev-list --count` 的值、幂等比对结果、Step 7 的九条逐条结论、暗色+亮色截图。**不要替用户判定通过。**

- [ ] **Step 9: 提交私有侧的收尾(如有)**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git status --porcelain      # 应只剩那 3 个 design-export 的删除态
```

若 T14 的白名单调试留下了改动,带 pathspec 提交:

```bash
git add oss/
git commit -m "chore(oss): 出包收尾"
```

---

## Self-Review

**1. Spec 覆盖**

| spec 章节 | 落在哪个任务 |
|---|---|
| §0.3 开工前 7 条核实 | 已在写计划前跑完,结论在「现场核实结论」;T1 写回 spec |
| §2 决策 1(单源+脚本) | T3–T5 的架构 |
| §2 决策 2(共享包内嵌) | T5 Step 4 |
| §2 决策 3(音频转录整块剥) | T10 |
| §2 决策 4(文件夹权限整 tab 删) | T7 |
| §2 决策 5(桌面布局重排) | T9 |
| §2 决策 6(docs 不导出) | T5 的 DELETE(E8 已把 THEMING.md 一并归入) |
| §2 决策 7(只建本地仓不 push) | T15 Step 4 断言 `git remote -v` 为空 |
| §2 决策 8(仓名 NimoOS-Web) | `manifest.mjs` 的 `DEFAULT_OUT` |
| §2 决策 9(不合并重复 key 清单) | Global Constraints「禁无关重构」 |
| §2 决策 10(测试删不改写) | T13 |
| §3.2 六步 | T5 Step 4 的 `export.mjs` |
| §3.3 哈希钉 | T4 + T9 Step 6 的负向验证 |
| §4 类 1/2/3/4 | T5(类1)· T9–T12(类2)· T6–T8(类3)· T13(类4) |
| §5.1 布局重排 | T9 |
| §5.2 MediaViewer + `--wave-none` 陷阱 | T10 Step 3/Step 6 |
| §6 泄漏守卫三节 | T3(词表)· T14(接入+调白名单) |
| §7.4 退出码 1 | T2 |
| §7.5 四道门 | T15 Step 2 |
| §8.2 SYS_ROUTE 有意偏离 | T6(补丁)+ T13(删对应用例) |
| §9 四条已知缺口写进 README | T12 |
| §10.3 工作树纪律 | Global Constraints + 每个 commit 步骤都带 pathspec |
| §11 验收 6 条 | T15 Step 1–7 |

**未覆盖且有意不做**:spec §2 决策 6 里「导出 `nimoos-app-label-spec.md`」——被 E8 推翻(用户拍板一份文档都不带)。

**2. 占位符扫描**:无 TBD / TODO / 「类似 Task N」/「加适当的错误处理」。三处刻意留成「现场 `sed -n` 取原文」的地方(T6 Step 4 的多行锚点、T8 Step 3/4 的 i18n 与 theme 连续键区、T13 Step 4 的 `it(...)` 整块),**是纪律要求而不是偷懒** —— 手编 fixture 在本仓库已经栽过三次,跨多行带缩进的锚点必须逐字抓取。每处都给了取原文的确切命令和填法示例。

**3. 类型一致性**:`applyDelete/applyReplace/applyPatch/sha256/checkClean` 在 T4 定义、T5 消费,签名一致;`scanText/scanTree/HARD/SOFT` 在 T3 定义、T14 消费,一致;`manifest.mjs` 的 `DELETE/SERVICE_DELETE/REPLACE/PATCH/SERVICE_PATCH/NEW_UI/SERVICE/DEFAULT_OUT/OSS_DIR/DIRTY_ALLOW` 十个导出在 T5 一次定义、T6–T13 只追加数据;`oss/tree.test.mjs` 的 `tree`/`read`/`exists`/`OSS` 在 T5 定义,后续任务复用同名。

**4. 一处已知的 TDD 妥协**:T6–T13 的「失败测试」断言的是**产出树的属性**而不是函数返回值 —— 因为这些任务的产物是数据(清单条目)而非代码。每个任务仍严格先红后绿,`beforeAll` 里的整树构建让红/绿都真实。

---

## 风险与失败模式

| 风险 | 表现 | 处置 |
|---|---|---|
| **锚点随私有主干漂移**(主要风险) | `export.mjs` exit 1,报锚点未命中 | **这是设计意图,不是故障。** 看一眼私有侧那几行改成什么,更新 `manifest.mjs`。预计 SP9-P8 与 SP10 各会撞一次(都动 `useOpenAction.ts`) |
| REPLACE 分身过期 | exit 1,报哈希不符 | 复核 `oss/files/` 那份是否要同步,再更新 `privateSha256`。**禁止为了跑过而删哈希钉** |
| 守卫误报 | exit 1,报某行命中 | 加**精确白名单**(文件 + 内容正则)。**禁止放宽词表** |
| 守卫漏报 | 真泄漏进了产物 | 成本最高。所以词表宁可宽、白名单宁可细;T15 Step 3/5 有两道独立抽查 |
| lockfile 路径改写不被 pnpm 接受 | T15 Step 2 的 `pnpm install` 失败 | 回退方案:把 `pnpm-lock.yaml` 加进 DELETE,并在 README 注明依赖版本由 `package.json` 约束。**这是降级,先试改写** |
| sp7/sp8 合流后清单大面积过期 | 合流后首次导出会报一堆锚点/DELETE 失败 | 预期行为(E10 已在 `manifest.mjs` 顶部写明)。届时是一次独立的扩张工作,不是本项目的 bug |
| 误伤主工作树那 3 个 design-export 删除态 | 它们被卷走或一起提交 | Global Constraints 已禁 `checkout`/`stash`/`reset` 与裸 `commit`;T9 Step 6、T14 Step 4 的 `git checkout` 都强制带单文件 pathspec |
