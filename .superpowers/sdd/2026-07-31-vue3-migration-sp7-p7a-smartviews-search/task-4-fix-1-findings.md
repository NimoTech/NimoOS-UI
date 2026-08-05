## Fix round 1 —— 2 条 Important(2 条 Minor 已由控制器记台账,不进本轮,别顺手改)

两条都是**同一类缺陷:Vue2 的视觉属性被静默丢弃或改写,既没复刻也没登记**。这是本工程反复出现的形态(P6b-T3 把内联样式改写成 class 时漏掉 `backdrop-filter`,功能测试与 color-guard 都测不出,判 Important)。

### I1 —— AI 横幅的 margin 不是 1:1,且未登记

Vue2 `PhotosSmartViewsView.vue:15` 的内联 style 是 `margin: 24px 32px 0`;你写成 `margin: 0 0 20px`(`PhotosSmartViews.vue:146-150` 附近)。

**控制器已回源核实评审的推理成立**:Vue2 的横幅在 `.sv-page` **内部**,而 `photos-smartview.scss:4` 是 `.sv-page { padding: 32px 32px 60px; max-width: 1400px; margin: 0 auto; }` —— 容器本身已有 32px 横向 padding,横幅**又加** 32px margin ⇒ 横幅距页面边缘 64px,而 `.sv-hero`(`scss:5`,无横向 margin)与 `.sv-grid`(`scss:21`,同)都在 32px。**所以 Vue2 是刻意让横幅比 hero/网格多缩进一层**(视觉上更窄、更居中,表达「这是一条附加提示、层级低于页面主体」)。你的版本让横幅与 hero/网格左右齐平,丢了这个信息层级。

纵向也有出入:Vue2 是 `24px` 上 / `0` 下(横幅底边与 hero 顶边贴合,因为 `.sv-hero` 无 top margin);你是 `0` 上 / `20px` 下。

**改法**:
- **横向必须保留「比 hero 多缩进一层」这个相对关系**。注意本仓容器是 `.area-body`(桌面态 `padding: 20px`)而不是 Vue2 的 32px,所以**照抄字面 32px 不等于照抄视觉** —— 取 Vue2 的**额外缩进量 32px** 加在横幅上即可(即 `margin-left/right: 32px`),这样横幅比 hero 多缩进 32px,与 Vue2 的相对关系一致。
- **上边距取 Vue2 的 24px**。
- **下边距**:Vue2 是 0(与 hero 贴合)。你可以照抄 0,也可以保留一个间距 —— 但**若不照抄就必须在代码注释里登记偏离 + 理由**(不能像现在这样静默改掉)。
- **补一条程序化断言**:**先锚定 `.svs-banner` 的规则体、再断言 `margin` 的值**(正则 `/\.svs-banner\s*\{([^}]*)\}/` 之类;全文件级 `toContain('margin')` 是恒真的、不算断言)。做一次删码验证。

### I2 —— `.sv-create-btn:hover` 丢了 Vue2 的上浮效果,且未登记

Vue2 `photos-smartview.scss:20` 是 `.sv-create-btn:hover { transform: translateY(-1px); }`(按钮**上浮**);你写成 `filter: brightness(1.08)`(**变亮**)。这是**两种不同的交互反馈**,不是同一效果的 token 替代。

你报告里的偏离登记只解释了「背景从渐变改实色(因本仓无 `--accent-hi`)」—— 那条成立且我认可,但 `transform: translateY` **与颜色 token 毫无关系**,是一个被静默丢弃的独立视觉属性。

**改法**:补回 `transform: translateY(-1px)`(它与 `filter: brightness(1.08)` 可以共存 —— 前者是 Vue2 的原效果、后者是本仓 primary 按钮 hover 的既定写法,两者不冲突)。**补一条程序化断言**(先锚定 `.sv-create-btn:hover` 的规则体、再断言含 `translateY`),做删码验证。

若你认为某个属性属于「可安全省略的装饰细节」,那也必须**明确登记 + 写理由**,不能不声不响改掉。

### 本轮要求

- 两条都要有**能变红**的程序化断言(先锚定规则体再断言属性)。
- 只跑覆盖改动的测试文件(`pnpm exec vitest run src/views/__tests__/PhotosSmartViews.test.ts src/styles/color-guard.test.ts`)+ 一次 `pnpm exec vue-tsc --noEmit`,**不用重跑全量**。
- 逐个删码验证新加的两条断言(一次一处,**Edit 手工还原,禁 `git checkout --`**)。
- **fix 报告追加到同一份 `task-4-report.md` 末尾**,别新建文件。
- 返回值仍只要:状态 / commit 起止 / 一行测试小结 / concerns。
