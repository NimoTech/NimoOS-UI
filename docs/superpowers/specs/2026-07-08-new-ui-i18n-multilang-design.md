# 新 UI 多语言（英/中）+ 用户级语言偏好 — 设计文档

- 日期：2026-07-08
- 目标仓库：`NimoOS-New-UI`（Vue 3.4 + vue-i18n@9 + Pinia）
- 后端：**零改动**（不改 db，复用现有 `/users/current/custom/system`）

## 1. 背景与现状

需求：让用户可在**英语 / 简体中文**间切换，并在创建（首次设置）时选择语言。

调研确认的新 UI 现状：

| 维度 | 现状 |
|---|---|
| i18n 框架 | 已配好 `vue-i18n@9`，`legacy:false`（组合式，用 `useI18n`），实例在 `src/i18n/index.ts` |
| locale 文件 | **仅 `src/i18n/zh_cn.ts`，无英文** —— 这就是"当前只有中文" |
| 默认语言 | `zh_cn`；locale 存 `localStorage['lang']`，启动由 `initialLocale()` 读取 |
| i18n 覆盖 | 仅 27 个 .vue 用 `$t`，**36 个 .vue 仍含硬编码中文** |
| 已迁移界面 | 仅 Welcome / Login / Home / Files；**设置面板、账号/子用户管理未迁移** |
| custom-storage 客户端 | 已就绪：`service.users.getCustomStorage(key)` / `setCustomStorage(key, data)`（`@nimotech/nimoos-service`，源码 `NimoOS-Service`）。范式见 `src/home/stores/layout.ts:81`（Pinia store 去抖写服务端） |
| 后端语言存储 | 每个 NimoOS 账号一份 `/var/lib/nimoos/<用户id>/system.json`，`lang` 字段与 timezone/各开关同存一个 blob；`o_users` 表**无** language 列，也无任何设置类列 |

老 Vue2 UI（`NimoOS-UI`）已有完整 `en_US.json`（1590 行）/ `zh_CN.json`（1657 行），作为**翻译复用来源与术语表**。

## 2. 目标与非目标

**目标**
1. 新 UI 具备英文 locale（`en_us`），可与中文互切。
2. 首次设置（Welcome）时可选择语言。
3. 语言偏好同时写 `localStorage` 与服务端 `system.json`，登录后自动应用。

**非目标（本阶段明确不做）**
- 不改 db、不加用户表字段。
- 不做"管理员创建子用户时选语言"（account/member 界面尚未迁到新 UI）。
- 不改老 Vue2 UI。
- 不新增常驻语言切换入口（设置面板迁移后再收编；本阶段只在 Welcome 选）。

## 3. 约定

- 语言码：`en_us` / `zh_cn`（与老 UI、AppStore i18n、locale 文件命名一致）。
- 默认语言：`zh_cn`（新用户从未选择时）。

## 4. 架构（三阶段，独立可交付）

### 阶段 1 — 英文 locale 地基（最优先）

- 新建 `src/i18n/en_us.ts`，**逐 key 镜像** `zh_cn.ts` 的扁平结构（`en_us: { ... }`），值为英文。
- 翻译来源：优先复用老 UI —— 用新 UI zh_cn key 的中文串去 `NimoOS-UI/src/assets/lang/zh_CN.json` 匹配，取同项在 `en_US.json` 的英文；无匹配的手工翻译。保持术语一致。
- 修改 `src/i18n/index.ts`：import 两套并合并进 `messages`；`initialLocale()` 保留读 `localStorage['lang']`、`in messages` 校验、默认 `zh_cn` 的逻辑（此时 `en_us` 已是合法 key）。

交付判据：切换 `localStorage['lang']` 为 `en_us` 后，已 `$t` 化的界面显示英文。

### 阶段 2 — 补 i18n 覆盖（量活主体）

- 将 36 个含硬编码中文的 .vue 抽成 `$t()` key，每个 key **同步**加入 `zh_cn.ts` 与 `en_us.ts`。
- 英文同样优先复用老 UI 文案。
- 可拆为独立工作流，随迁移持续推进；不阻塞阶段 1/3。

### 阶段 3 — 语言选择 + 持久化

**3a 持久化层（复用现成客户端）**
- 新增 locale Pinia store（或 composable），仿 `home/stores/layout.ts` 模式：
  - 读：`service.users.getCustomStorage('system')` → 取 `lang`。
  - 写：**读-改-写**——先 `getCustomStorage('system')` 拿当前 blob，仅覆盖 `lang`，再 `setCustomStorage('system', merged)`。**严禁整体覆盖**（blob 内还有 timezone/search_switch 等字段）。
  - 每次切换同时写 `localStorage['lang']` 并 set `i18n.global.locale.value`。

**3b 启动应用（补齐"应用"这一环）**
- i18n 初始化为同步，先以 `localStorage`/默认值启动（现状即如此）。
- 登录成功后异步拉取并应用：在 `useAuth.login()` 与 `registerAndLogin()` 内、拿到 session 后，调 locale store 的"从服务端加载并应用"动作；若 `system.lang` 存在且与当前不同，则更新 `i18n.global.locale` + `localStorage`。
- 已登录会话冷启动：在 App 引导（App.vue onMounted 或路由守卫确认已认证后）触发同一动作。

**3c 创建时选语言（Welcome.vue）**
- 首次设置表单加语言下拉（English / 简体中文），默认 `zh_cn`。
- `useAuth.registerAndLogin()` 现已在登录后调 `setCustomStorage('app_order', ...)`；在其后追加：以自身身份写 `system.json` 的 `lang`（读-改-写）并同步 `localStorage` + `i18n.global.locale`。因是用户以自己身份写自己的 blob，**无需后端、无跨用户问题**。

## 5. 数据流

```
首次设置：
  Welcome 选语言 → registerAndLogin(注册+登录) → 写 system.json.lang(读-改-写)
                 → localStorage['lang'] = 选择 → i18n.global.locale = 选择

日常启动(已登录)：
  main.ts i18n 同步初始化(localStorage/默认 zh_cn)
    → 登录/引导后 getCustomStorage('system').lang
    → 若存在且不同：set i18n.global.locale + localStorage
```

## 6. 边界与风险

- **不覆盖 blob 其它字段**：所有写入走读-改-写。若并发写（如 layout store 同时写不同 key）不冲突，因 key 不同；但同 key `system` 的写入需串行/合并——本阶段仅 lang 写 `system`，风险低。
- **老会话/浏览器已有 localStorage['lang']**：启动仍先用它，登录后服务端值为准（若服务端无 lang 则保持 localStorage，不回退）。
- **`en_us.ts` 与 `zh_cn.ts` key 漂移**：两文件 key 必须集合相等；缺失 key 会走 `fallbackLocale: zh_cn`。加测试校验两者 key 一致。
- **UserDBModel 顶部 `// Soon to be removed` 注释**：仅记录；本方案不碰 db，无影响。

## 7. 测试

- `src/i18n`：单测校验 `en_us` 与 `zh_cn` 顶层 key 集合完全一致（防漂移）；`initialLocale()` 各分支。
- locale store：`getCustomStorage` 返回含/不含 lang、读-改-写不丢字段、去抖（参照 `layout.persist.test.ts`）。
- Welcome：选语言 → 断言写入 `system.json`(lang) 与 `localStorage` 被调用。
- 登录应用：mock `getCustomStorage('system')` 返回 `lang: 'en_us'` → 断言 `i18n.global.locale` 被更新。

## 8. 交付顺序

1. 阶段 1（en_us 地基）→ 可独立合入。
2. 阶段 3（选择+持久化+启动应用）→ 依赖阶段 1。
3. 阶段 2（36 文件抽 key）→ 与 1/3 解耦，可并行/滚动推进。
