# Task 5 评审:改开源导出流水线(commit `c83206e`)

**规格符合性:✅**
**任务质量:Approved(5 条 Minor,全部为注释/文档陈旧与报告措辞,无一影响剥离行为)**

---

## 一、核心结论:剥离行为没有被改弱(逐条取证)

### 1.1 `svcDir` 基准目录正确,两张表仍在被调用

`oss/export.mjs:88` `const svcDir = path.join(tmp, 'packages/service')` —— 指向**同一棵
archive 树**的 `packages/service` 子目录;`:93 applyDelete(svcDir, SERVICE_DELETE)` 与
`:96 applyPatch(svcDir, SERVICE_PATCH)` 原样保留,调用形式与改动前逐字一致。

### 1.2 「基准目录改错会静默失去剥离能力」这个风险 **不成立**

评审提纲第 1 点担心的失效模式经查**被 `apply.mjs` 挡死**:

- `apply.mjs:43-45` —— `applyDelete` 对**不存在的路径直接 throw**
  (`DELETE 清单过期:${rel} 不存在`),不是静默跳过。
- `apply.mjs:85` —— `applyPatch` 目标不存在 throw;`:88-93` 锚点 0 命中 throw;
  `:94-96` 命中 ≠1 次 throw。

⇒ 若 `svcDir` 被改成任何错误路径,导出会在第一条 `src/photos.ts` 上**硬失败**,不可能
"测试绿而剥离哑火"。这是本次改动最关键的安全属性,且它是既有的、未被本 commit 触碰。

### 1.3 `SERVICE_DELETE` 19 条一条没少 —— 语义级取证

不是看 diff,而是把改动前后两份 manifest 都 `import` 进来做结构比对:

```
OLD SERVICE_PATCH 21 -> NEW 20
OLD SERVICE_DELETE 19 -> NEW 19
SERVICE_DELETE identical: true          ← 逐字节相同
DELETE identical: true / PATCH identical: true / REPLACE identical: true
```

19 条清点确认全在:`src/photos.ts` `photos.test.ts` + 6 个 photos 子域测试 ·
`src/search.ts` `search.test.ts` · **`.superpowers`** · `src/ai.ts` `ai.test.ts`
`notes.ts` `notes.test.ts` `sse.ts` `sse.test.ts` `wiki.ts` `wiki.test.ts`。

### 1.4 删掉的那条 `SERVICE_PATCH` 确实只有包入口那条

```
removed entries: [ 'package.json||  "main": "./dist/index.js",…' ]
added entries:   []
order preserved for kept: true
```

**恰好 1 条被移除,0 条被误删,保留项顺序不变。** 且该补丁确已上游化 ——
`packages/service/package.json:5-9` 私有仓本身就是 `"main": "./src/index.ts"` /
`"files": ["src"]`,原补丁的 `find` 锚点必然失配,不删就会撞 `applyPatch` 的
「锚点未命中」throw。删除是**必须的**,不是可选清理。

### 1.5 端到端实证:真跑一次带泄漏守卫的导出

```
$ node oss/export.mjs --out <scratch> --no-commit
[oss] 1/6 前置检查
[oss]   New-UI c83206e8(共享包已内联,不再取第二个仓)
[oss] 2/6 取源
[oss] 3/6 应用清单(DELETE 71 · REPLACE 4 · PATCH 252)
[oss] 4.5/6 重算 lockfile
[oss] 5/6 泄漏守卫
[oss]   零真实泄漏命中(1 个预期内跳过:settings.png 二进制)
[oss] 6/6 落盘 → 完成
```

产物树独立复核(不依赖它自己的测试):

- `packages/service/` 顶层只剩 `.gitignore` `package.json` `src` `tsconfig.json`
  `vitest.config.ts` —— **`.superpowers/` 不在**。
- `packages/service/src/` 26 个模块,`photos*` / `search*` / `ai*` / `notes*` / `sse*` /
  `wiki*` **一个都没有**。
- 全树 `find -name .superpowers` → **0 命中**。

### 1.6 台账双条目的不变式在内联后**依然成立**(这条我专门去验了)

内联后 `packages/service/.superpowers` 是否还存在,决定了 `SERVICE_DELETE` 的
`.superpowers` 条目是活的还是死的:

```
git ls-files packages/service/.superpowers | wc -l  →  32
git ls-files .superpowers | wc -l                   →  1723
```

两个台账目录都在、都被 git 跟踪,**仍然需要两条不同的清单条目**(根 `DELETE` 一条 +
`SERVICE_DELETE` 一条),`tree.test.mjs:93-97` 那条 SP8-P6-T8 守卫用例的立论完好无损。
保留分组的设计决策在这一点上得到实证支持。

---

## 二、删掉的两个 `throw` 有没有留下洞?—— 有天然兜底,已变异验证

原「4. 内嵌共享包」段里两个守卫随整段删除。逐个追它们保护的不变式:

**守卫 A(`package.json` 的 `file:` 锚点唯一命中)**
变异测试:把产物树的依赖改回 `file:../NimoOS-Service`,跑第 4.5 步:

```
ERR_PNPM_LINKED_PKG_DIR_NOT_FOUND  Could not install from ".../NimoOS-Service"
                                   as it does not exist.        EXIT=1
```

⇒ 锚点漂移会被 `export.mjs:119-128` 的 `pnpm install --lockfile-only` **硬拦**,并包装成
设计好的诊断文案抛出。**不是无人看守的假设。**

**守卫 B(lockfile 里有 `../NimoOS-Service`)**
该不变式已由 `tree.test.mjs:105` 的正向断言 + 上述 pnpm 失败双重接住。

**结论:两个守卫的不变式都有接手方,没有留下洞。**

---

## 三、「4.5 重算 lockfile」整段原样保留 —— 逐字节确认

```
diff <(旧文件 116-145 行) <(新文件 102-131 行)  →  IDENTICAL ✓
```

一个字符都没动。

---

## 四、`tree.test.mjs` 新断言有真实守卫价值(非换个恒真)

变异测试:从产物树 `package.json` 删掉 `@nimotech/nimoos-service` 依赖后重算 lockfile:

```
grep -c "packages/service" pnpm-lock.yaml  →  0
```

⇒ 链接一旦断掉,`expect(read('pnpm-lock.yaml')).toContain('packages/service')` **会报红**。

前置条件也核实过:本仓**没有 `pnpm-workspace.yaml`**,所以 `packages/service` 出现在根
lockfile 里的**唯一来源**就是这条 `file:` 依赖链 —— 断言不会被 workspace importer 条目
"喂饱"而失去判别力。保留的 `not.toContain('NimoOS-Service')`(大小写敏感,不会被
`@nimotech/nimoos-service` 误触)属无害的防御性冗余。

---

## 五、越界检查:干净

`git show --name-only c83206e` → 只有 `oss/export.mjs` `oss/manifest.mjs`
`oss/tree.test.mjs` 三个文件。`vite.config.ts` / `package.json` / `packages/service/**` /
`src/**` / `CLAUDE.md` **均未触碰**。3 个 `design-export/*` 删除态仍留在工作树、**未被
`git add` 吸收**(commit 用了 pathspec)。

---

## 六、报告诚实性:数字属实

独立重跑 `pnpm exec vitest run oss/`:

```
Test Files  6 passed (6)
     Tests  138 passed (138)
  Duration  13.45s
```

与报告的 6 / 138 / 0 完全一致。含 `tree.test.mjs:669`「不带 `--skip-guard` 也能跑通」
(跑真实泄漏守卫)与 `:710`「产物树 pnpm install + vue-tsc 全绿」两条重门。

关于「两处行号 off-by-one」—— 见下方 Minor 5,是**报告自己的计数口径问题**,不是掩盖
改错位置(改动内容我已逐条语义级比对,准确无误)。

---

## 七、Findings

### Minor 1 — `oss/export.mjs:118`:进度编号出现断档
删掉 `log('4/6 内嵌共享包')` 后,操作员看到的进度是 `3/6 → 4.5/6 → 5/6`,"4.5" 悬空、
没有对应的 "4"。控制器正是靠 `[oss] 4/6 内嵌共享包` 这行定位到断裂点的;这行消失后
建议把 4.5 顺延为 `4/5`(或保留一行 `4/6 内嵌共享包(已内联,无需重写)`)。纯显示层。

### Minor 2 — `oss/export.mjs:78`:注释描述已不存在的失败路径
"否则取源阶段(比如 sibling NimoOS-Service 不存在/archive 失败)…" —— 内联后不再有
sibling 取源这一步,该举例失效。try 块的存在理由仍成立,只是例子过期。

### Minor 3 — `oss/export.mjs:63,68-74`:437 处泄漏事故那段注释仍写"两个仓"
"实测 New-UI 与 NimoOS-Service 均无 .gitattributes"、"两个仓都把台账入库了" —— 现在是
**同一个仓的两个目录**。它所论证的不变式**依然完全正确**(§1.6 已实证:两个台账目录都在、
两条清单条目都必须有),但这是全文件风险最高的一段注释,措辞过期会让下一个人误判
`SERVICE_DELETE` 是不是还有存在必要。建议改成"两处台账目录"。

### Minor 4 — `oss/README.md:15,18,22`:面向操作员的流水线文档仍描述两仓流程
"1. **前置检查** —— 两个源仓(`NimoOS-New-UI` 本仓 + 同级 `NimoOS-Service`)工作树必须
干净"、"把 `../NimoOS-Service` 变成仓内的 `packages/service`" —— 与实现已不符。
**不算实现者的过失**:brief 的 Files 段只列了 3 个文件,README 不在授权范围内。建议开
后续小票补,不要现在扩大本 commit 的改动面。

### Minor 5 — `task-5-report.md:12-15`:"行号 off-by-one" 的定性有一半是反的
实测旧文件:`checkClean(SERVICE)` 在 **52** 行、log 在 **55** 行(brief 写 52-55,
**brief 是对的**);`svcDir` 在 **88**、`archiveInto(SERVICE)` 在 **89**(brief 写 88-89,
**brief 也是对的**)。报告说的 51-55 / 87-89 是**把未改动的上下文行也数进去了**,属报告
自己的口径。只有 Step 4 是 brief 真的差 1(块尾 `)` 在 **114** 行,brief 写到 113)。
无害 —— 改动边界我已独立核实准确,4.5 段逐字节未动。但"brief 少 1 行"这个说法会误导
后续读者去怀疑 brief。

---

## 八、观察项(既有状况,非本 commit 引入,不计为 finding)

产物树里仍有 **8 处大小写精确的 `NimoOS-Service`** 与 **2 处 `superpowers`**,全部在代码注释里:

- `vite.config.ts:39,44,61` · `src/viteOptimizeDepsGuard.test.ts:4,7`
- `src/storage/stores/storage.ts:221` · `storage.test.ts:426` ·
  `src/storage/components/RaidMemberList.vue:8`
- `src/home/components/MobileHome.vue:31` · `src/files/viewers/waveform.ts:2`
  (两处都是 `docs/superpowers/specs/…` 设计文档路径)

这两个词**都不在 `forbidden.mjs` 的 HARD/SOFT 词表里**,所以守卫报"零真实泄漏命中"与其
自身设计一致,不是哑火。泄漏等级低(私有同级仓名 + 内部文档路径,无内容),且这些文件
**Task 5 一个都没碰**。`vite.config.ts` 那三行是 SP13 Task 4 期写的新注释,若要收口应走
Task 4 或独立小票。此处仅登记,供控制器决定是否开票。
