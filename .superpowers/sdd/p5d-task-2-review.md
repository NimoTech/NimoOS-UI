# P5d · T2 独立评审报告(review-56f8849..f128450.diff)

评审者:T2 独立评审(不采信实现者任何断言,全部亲手复现)。HEAD 核实为 `f128450`,working tree 干净。

## 0. 独立复现的基线数值

`node .superpowers/sdd/p5d-gen-r8r9-sim.mjs` 原样对当前仓（WHITELIST_293 已存在）会因常量名已改而崩溃——这是预期的（脚本硬编码 `WHITELIST_226`，只适配 T1 收官态）。我把 `56f8849` 的两个文件 `git show` 到 scratchpad，做了一份指向副本的脚本重跑，得到与 brief §2 / T0 逐字一致的输出：`R8=16`、`R9=293`、`old⊆new=true (old 225/new 225)`。独立确认协调者与实现者引用的是同一基准。

## 1. 三门 + 两门额外门（亲自重跑，非采信）

- `pnpm test`：**326 files / 3551 tests，全绿**（3544+7 算式核实无误，新增 it() 恰好 7 个）。
- `pnpm exec vue-tsc --noEmit`：exit 0。
- `pnpm build`：exit 0。
- `sass --no-source-map knowledge.scss /dev/null`：exit 0。
- `grep -o "kn-note-row" dist/assets/*.css`：命中 `index-BD7LhLwU.css`。

## 2. 亲手重跑的 RED 探针（4 组全做，非报告采信）

| 组 | 注入 | 结果 | 还原 md5 |
|---|---|---|---|
| ① 超集正则 | `.kn-foo{}` → 报红指名 kn-foo；还原后 `.fb-Foo{}` → 报红指名 fb-Foo（A-11 大写判别力证实） | 两次均报红 | 与原始 `5b198dc3bd478e971f3c91a2a51b980d` 一致 |
| ② K45 锚定(必做) | (a) `.k-btn{}` 块内加第 3 个 `&.text` → 报红 "出现3次"；(b) `.k-seg button{}` 内加合法 `&.text`(块外) → **断言仍绿**，不误红 | 两头都成立 | 一致 |
| ③ K44 集合相等(必做) | (a) 文件末尾加 `.foo{}` → 报红 `+".foo"`;(b) 把 K44 段嵌进 `.knowledge-app{}` → 集合变 `[]` → 报红,证明是"恰好一条"非"至多一条" | 两头都成立 | 一致 |
| ④ NON_K_HELPER_CLASSES 集合相等 | `.kn-toolbar .zzz{}` → 两条相关断言均报红指名 zzz | 报红 | 一致 |
| 额外(缺口猎) | K39 拿掉浅色档 `--code-block-fg` 声明 → K39 双档测试报红 | 报红 | 一致 |

全部 5 次注入均先 `diff` 证实真落盘，还原用 `cp` 覆盖 + `md5sum` 逐字节核对（禁 `git checkout`/`restore`），全程 `git status` 干净、HEAD 全程 `f128450`。

## 3. 搬运保真(亲自逐段比对蓝本,非抽查而是全 9 段+K43+K44+K45逐行diff)

段 A/B/C/D/E/F/G/H + K43(`.k-seg`)+ K44(`NotesMarkdownEditor.vue:41-46`)+ K45(`:1569-1570`)均与 `git -C NimoOS-UI show 7a6ee6b7:...` 逐行核对，结构/顺序/嵌套一字不差,颜色替换均落在附录 B 指定 token 上。边界核实：E 段精确止于 `:2194`(`.kn-editor-status .spacer`),未截断；`:2250-2264`(P5c 已搬)与 `:985-991`/`:1152-1157` 均确认不存在于产物中(grep 验证)。`.kn-badge` 未重复定义（仅 P5b-T2 原有一处）。

## 4. 颜色扫描结论

对 diff 新增行 + 全文件（排除两个声明块 162-303/306-410）做正则扫描：**零违规**。表面命中的几处均为假阳性（`white-space` 属性名被 `\bwhite\b` 误中；`--grad-sk-blue` 注释里的 "blue" 是 token 名）。`p5d-task-2-report.md` 文档表格中出现的 hex/rgba 值是描述蓝本原值的文档惯例（与 T0/P5c 报告同款），不在 scss 生产代码/注释范围内。`transparent` 未计违规。K39 9 个 token 两档均显式写值(7 个 theme-invariant 已用 RED 探针验证漏一档会报红,`--shadow-warning-glow` 两档不同值且有反向断言)。

## 5. 数值终值独立核验

`NON_K_HELPER_CLASSES` 实测 16 项（ghost/outline/primary/danger/right/suffix/second/spin/mono/warn/dot/lbl/sep/spacer/text/wide），`WHITELIST_293` 实测 293 项且无重复，`text` 确认不在白名单内（R8/R9 二选一守住）。`DARK_TOKEN_SELECTOR`/`LIGHT_TOKEN_SELECTOR` 与 scss 两处选择器逐字节比对（对 `56f8849` 副本），一字未改，仅行号漂移。

## 判定

1. **规格符合(§T2)**：✅ 通过。
2. **任务质量**：✅ 通过。

## 发现

- Minor：`p5d-gen-r8r9-sim.mjs` 硬编码 `WHITELIST_226`，T2 提交后脚本对当前仓会抛异常（需手动切到旧基线才能复现）——不是本刀代码缺陷，但下游若想复现需要知道这个前提；建议在报告里提一句（未提）。`.superpowers/sdd/p5d-gen-r8r9-sim.mjs:22-23`
- 未发现 Critical / Important 问题。65 类逐段核对无遗漏，K39/K44/K45/守卫改动均与裁定书/附录逐字对应，无空壳断言（对新增 7 条 it() 逐条做了变异验证，全部有判别力）。

## 无法核验项

- 无。四组 RED 探针 + 额外的 K39 探针均亲手完成；三门+两门额外门亲自重跑；未采信实现者报告的任何数值或探针输出。
