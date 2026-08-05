## Task 11: 整期收尾 —— 全量门 + 台账 + roadmap + spec 订正

**Files:**
- Create: `.sp7/NimoOS-New-UI/.superpowers/sdd/2026-08-03-vue3-migration-sp7-p8a-settings-deeplinks/progress.md`(+ 各任务的 brief / report)
- Modify: `NimoOS-UI/docs/vue3-migration-roadmap.md`(SP7 段回填 P8a 条目)
- Modify: `NimoOS-UI/docs/superpowers/specs/2026-07-23-vue3-migration-sp7-photos-design.md`(订正 §2 / §3 / §5 / §8,新增 §1e 记 D19–D23)

- [ ] **Step 1: 跑全量四道门**

```bash
cd /home/nimo/NimoTech/.sp7/NimoOS-New-UI
pnpm exec vitest run --reporter=verbose 2>&1 | tee /tmp/claude-1000/-home-nimo-NimoTech/*/scratchpad/p8a-full.log | tail -20
grep -c '\[Vue warn\]' /tmp/.../p8a-full.log   # 应为 0
pnpm exec vue-tsc --noEmit; echo "tsc exit: $?"
pnpm exec vitest run src/styles/color-guard.test.ts src/i18n/parity.test.ts --reporter=verbose
```

**基线(merge master 后实测)**:453 文件 / 5739 passed + `vue-tsc` exit 0。**已知 1 个 master 既有 unhandled error**:`src/settings/views/SettingsPage.test.ts` 的 `service.users.avatarPath is not a function`(SP9-P4 的测试 mock 缺方法,在 master 主工作树上同样复现 —— **非本期引入,不在本期修**,登记为 SP9 侧债务)。

- [ ] **Step 2: 写台账**

`progress.md` 至少含:11 个任务的逐个结果 · 每任务 fix 轮次 · 整支终审结论 · 门的实测数字 · **本期查实并纠正的 Vue2 缺陷清单**(retention 不回滚 / lastBuilt 与 librarySince 写死英文 locale / album·person id 未编码 / isConflict 无词边界 / mergedToast 空名 / 收藏空网格 / 相册永久骨架)· **本期查实的过期信息清单**(`isConflict` 3 处→1 处 · `photosPersonSubtitle` 已删 · photoset 2 分钟清理归生产者 · 上传视图 1142 行不可达)· D19–D23 五条决策 · D21 的三条连带后果。

**收尾不要删台账目录。**

- [ ] **Step 3: 回填 roadmap**

在 `### SP7 — 相册 Photos` 段加 P8a 条目,写清:坐标(New-UI / Service commit)· 门的数字 · **未合并 master、未部署** · 交付清单 · 债务清单。并把 SP7 行的状态从「余 P8」改成「余 P8b(cutover,快照发布后)」。

**债务清单必须含**:
- D13「清理本地待上传缓存」按钮维持禁用态(依赖 D21 砍掉的上传队列)
- P1 挂账「`idle` 守卫换真上传队列态」做不了
- **P8b cutover 后新相册无上传入口**
- P7b 三条(跳库页弹层溢出右边缘 / 「筛到零」空态 / `places` 维度未贯通)
- P7a 搜索半的 24 条 + BE-1
- P7b 的 15 条眼验清单未点
- SP9 侧 `SettingsPage.test.ts` 的 `avatarPath` mock 缺口

- [ ] **Step 4: 订正 spec**

| 处 | 现状 | 改成 |
|---|---|---|
| §2 深链段 | 「token 前缀 `nimo:photoset:` 存 localStorage…读后立即 removeItem 一次性交接,**2 分钟过期清理**」 | 2 分钟过期清理归**生产者** `openInApp.js:76-85`,消费侧只做读 + removeItem |
| §3 路由表 | 列了 `/photos/upload` | 删掉该条,注明 D21(上传整块不做) |
| §5 P8 行 | 「TUS 上传子系统移植 + 上传视图/抽屉;…strangler 加 `/photos` 行…合流后正式部署真机验收」 | 拆 P8a / P8b(D19);上传整块划出(D21);合流与部署归 P8b |
| §8 | 「P8 后合流部署」 | 「P8b 后合流部署(快照版发布之后)」 |
| 新增 §1e | — | D19–D23 五条决策表 + D21 的三条连带后果 |

- [ ] **Step 5: 提交三处文档**

```bash
# New-UI 侧(台账在 gitignore 里,不进 git —— 只提交产品代码,这一步通常无 New-UI 改动)
cd /home/nimo/NimoTech/NimoOS-UI
git add docs/vue3-migration-roadmap.md docs/superpowers/specs/2026-07-23-vue3-migration-sp7-photos-design.md \
        docs/superpowers/plans/2026-08-03-vue3-migration-sp7-p8a-settings-deeplinks.md
git commit -m "docs(sp7): P8a 收尾回填 roadmap + spec 订正(D19-D23)"
```

⚠️ 文档仓 `NimoOS-UI` 当前分支是 `docs/vue3-migration-sp3`,提交前 `git branch --show-current` 确认。**提交只含 SP7 文档文件,不带任何 `src/` 改动。**

- [ ] **Step 6: 交付报告**

向用户报:坐标 · 四道门实测数字 · **未合并 master、未部署** · 验收入口 `http://<真机IP>:5277/app/#/photos/settings` · 验收清单(见下)· 债务清单。

### 真机验收清单(交付时给用户,每条都写明点击路径)

⚠️ **铁律**:凡「点某个东西」的项必须先确认该元素在本机数据下真渲染成可点元素(`v-if="x>0"` 高发,P5b 的 B18/B19 各栽一次)。下面每条都标了前置条件。

1. 侧栏底部齿轮 → 进设置页,标题「设置」、副标题「存储 · AI 行为」
2. hero 下两个快速导航「存储」「AI 行为」→ 点击平滑滚到对应卡
3. 存储卡:容量条分段可见,图例每行「色点 + 名称 + GB 数」,右上大数字「可用 XX GB」
   - 前置:后端 `/v1/photos/storage` 有返值。若显示破折号 + 「不可用」,那是失败态、也是预期分支之一,报给我
4. 最近删除保留期:5 档(7/15/30/60/90 天),当前档高亮;点另一档 → 无报错;**离开设置页再进来,档位应保持**
5. 「立即重扫」→ 按钮转圈 → toast「已开始重扫图库」
6. 自动重扫间隔:5 档(关闭/6h/12h/24h/7d),点一档 → 重进页面档位保持
7. 缩略图缓存:按钮上带可清理的字节数
   - **前置:`prunableBytes > 0` 才可点**。若显示 `(0 B)` 且按钮灰,那是正确的禁用态,报给我即可,不用点
8. AI 卡:隐私声明块(盾牌图标 + 「数据不出你的 NAS」)
9. 4 个功能开关(人脸识别 / 场景与物体识别 / 图片文字识别 / 智能视图),顺序如此;拨一个 → 重进页面状态保持
10. **把「智能视图」开关关掉 → 左侧栏的「智能视图」条目应整条消失**;打开 → 回来(§7e-15)
11. 「重建索引」→ 显示「重建中…」+ 百分比 + 进度条;完成后 toast「AI 索引已重建」
    - 前置:后端能起重建任务。若返 409(已有重建在跑),应**不报错**、直接接上进度
12. 「重新聚类人脸」→ toast「已在后台开始重新聚类人脸」,按钮 3 秒内不可再点
13. 页脚:「Nimo 相册 · vX.X.X」「运行于 <设备名> · 图库始于 <日期>」;**日期应是中文格式**,不是英文月份
    - 前置:`about.librarySince` 有值才显示后半段
14. 智能视图页顶部那条 AI 横幅里的「设置 · AI 行为」链接 → 应可点,跳到设置页并自动滚到 AI 卡(§7e-9)
    - **前置:该横幅只在「智能视图」开关为关时才显示** —— 先在设置页把它关掉,再去智能视图页
15. 深链 `?asset`:地址栏输 `http://<IP>:5277/app/#/photos?asset=<某张照片的 id>` → 直接打开灯箱那张;左右箭头应无效(单张成集)
16. 深链 `?asset` 不存在的 id → toast「未找到照片」,页面照常显示时间线
17. 深链 `?q`:输 `#/photos?q=猫` → 应跳到 `#/photos/search?q=猫` 并执行搜索
    - **前置:语义搜索受 BE-1 阻断**。只需确认「地址栏变成 /photos/search?q=猫」这一步,搜索结果本身不在本期验收范围
18. 深链 `?album`:输 `#/photos?album=<某相册 id>` → 跳到该相册详情
19. 深链 `?person`:输 `#/photos?person=<某人物 id>` → 跳到该人物详情;输一个不存在的 id → 停在时间线且地址栏的 `person=` 被摘掉
20. 收藏页在后端异常时显示失败态 + 重试按钮(不是一片空白)
    - **前置:需要制造一次失败。若无法制造,跳过并报给我**
21. 深浅两套主题各看一遍设置页(右上角主题切换):容量条分段色、开关、分段器在两套下都清晰
22. 窄屏(≤768px,浏览器缩窄或手机)看设置页:两张卡不溢出、分段器不折成三行

---

