# SP11 壁纸 —— 设计定稿

> 日期:2026-08-07 · 仓:`NimoOS-New-UI`(master)+ 仓内 `packages/service/`
> 对应 roadmap:`NimoOS-UI/docs/vue3-migration-roadmap.md` §4 **SP11 大外壳收口**
> 关联债务:审计 **X3**(`docs/vue3-pending/06-跨区与大外壳.md:25-28`)= 设置区 **D5**(`05-设置与KVM与搜索-SP9.md:22-24`)

## 0. 本期范围

SP11 原有三条待办,两条已在 2026-08-07 关闭(i18n 全量收口按用户裁定不做、Login/Welcome 核实已完成),**只剩壁纸一条**。本期做完 SP11 收官。

主题深浅切换**本来就有**(`src/home/components/ThemeToggle.vue` + `src/stores/theme.ts`,2026-07 期上线),缺的只是壁纸。原条目把两者并称容易误读。

**后端一行不改。** 所需端点全部现存且可用(§3)。

## 1. 现状取证

### 1.1 New-UI 的背景是主题系统画出来的,不是一张图

| 坐标 | 内容 |
|---|---|
| `src/styles/theme.css:544-547` | `body { background: var(--app-bg); background-attachment: fixed; }` |
| `src/styles/theme.css:549-565` | `body::before` 散景光斑层(4 个 radial-gradient + `blur(46px)` + 鼠标视差 `--mx/--my` + `floatField` 30s 漂移) |
| `src/styles/theme.css:566-578` | `body::after` 顶部柔光 + 底部暗角 |
| `src/styles/theme.css:297-301` | 深色 `--app-bg` = 4 层 gradient |
| `src/styles/theme.css:391` | 浅色 `--app-bg` = `#f7f5ef`(**是颜色不是图**,见 §2.1 的坑) |
| `src/styles/theme.css:522-523` | 浅色主题把 `body::before` / `body::after` 的 background 置 `none`(纸感不要 bokeh) |

各区外壳 `src/components/shell/AreaShell.vue:29` 的 `.area-shell` **不设背景色** ⇒ 所有区域本来就是透明浮在 body 背景上。

### 1.2 壁纸这条只剩两个残留

- `src/stores/session.ts:9` `const WALLPAPER = 'wallpaper'`,`:67` 登出时 `removeItem`。**没有任何读出口。**
- `src/settings/panels/general/WallpaperRow.vue` —— 行保留、按钮 `disabled`、hint 写着原因(`settingsWallpaperNa`)。组件顶部注释明确标注「做样子(政策三 / 债务 D5)」。
- `src/settings/panels/AccountPanel.vue:169` 登记了 Vue2 的 `SET_DEFAULT_WALLPAPER` 因无壁纸系统而不移植。
- 桌面**没有右键菜单**(`src/home/` 全目录 `contextmenu` 零命中)。
- 文件区右键菜单(`src/files/components/FileContextMenu.vue`)**没有**「设为壁纸」。

### 1.3 Vue2 那套机制(移植源坐标)

| 坐标 | 内容 |
|---|---|
| `src/components/wallpaper/CasaWallpaper.vue` | `#background` 固定层,`background-image` 来自 `localStorage.wallpaper` 或 store 默认 |
| `src/components/wallpaper/WallpaperModal.vue` | 换壁纸弹窗:预览卡 + 2 张内置图 + 上传按钮 |
| `src/components/wallpaper/ContextMenu.vue:50` | 桌面空白处右键 →「更换壁纸」(判 `class.includes('contextmenu-canvas')`) |
| `src/mixins/mixin.js:52` | `wallpaperType = ['png','jpg','jpeg','bmp','gif','svg']` |
| `src/mixins/mixin.js:364-400` | `setAsWallpaper(item)` —— 文件区「设为壁纸」 |
| `src/store/mutations.js:52-62` | `SET_WALLPAPER`(写 localStorage)/ `SET_DEFAULT_WALLPAPER` |
| `src/views/Home.vue:208-217` | `getWallpaperConfig()` —— 唯一从服务端读回的地方 |
| `src/router/index.js:104` | `/logout` 清 `localStorage.wallpaper` |
| `src/router/route.js` | `meta.showBackground` —— 只有 Login/Welcome/`/`/`/legacy` 为 true |
| `src/assets/background/` | `wallpaper01.jpg` **2.2MB** · `wallpaper02.jpg` **848KB** · `preview-widget.svg` · `blank.png` |

## 2. 机制

### 2.1 壁纸是 `<html>` 上多出的一层图 —— 不加图层元素,只加 4 条 CSS

```css
/* 设了壁纸:图铺在 html 上,--app-bg 垫在图下面 */
:root[data-wallpaper] { background: var(--wallpaper-img) center / cover no-repeat, var(--app-bg); }
:root[data-wallpaper] body        { background: transparent; }   /* 让 html 那层露出来 */
:root[data-wallpaper] body::before{ display: none; }             /* 关散景光斑 */
:root[data-wallpaper] body::after { background: var(--wallpaper-scrim); }
```

选这个形态而不是加一个 `<div class="wallpaper-layer">` 的三个理由:

1. **图 404 自动兜底。** `background` 多层语法里,图那层加载失败浏览器就不画它,下面的 `--app-bg` 直接露出 ⇒ **不需要 JS `onerror`,绝不白屏。**
2. **`html` 背景永远是最底层**,没有 z-index 打架风险。`body::before/::after` 的 `z-index: 0` 与 `#app` 内容的层叠关系很脆(伪元素按规范是 body 的首/末子元素),插一个自绘图层进去要重新推演整套层叠,收益为零。
3. 没设壁纸时 `data-wallpaper` 属性不存在 ⇒ **现状 100% 不变**,回归面为零。

**⚠️ 坑 A —— `--app-bg` 在浅色主题下是颜色不是图。** `theme.css:391` 是 `--app-bg: #f7f5ef`。所以**不能**写成 `background-image: var(--wallpaper-img), var(--app-bg)` —— 那会让浅色主题整条声明非法、body 背景丢失。必须用 `background` 简写(颜色只能出现在最后一层,而 gradient 出现在最后一层也合法),两套主题都成立。

**⚠️ 坑 B —— 第 4 条规则必须排在 `theme.css:522-523` 之后。** `:root[data-theme="light"] body::after`(0,2,1)与 `:root[data-wallpaper] body::after`(0,2,1)**优先级相同** ⇒ 由源码顺序决胜。写在前面会被浅色主题那句 `background: none` 吃掉,浅色 + 壁纸时没有白纱 ⇒ 近黑文字压在深色照片上不可读。这是"三道门全绿但真机看不见字"的那一类,必须有守卫(§6)。

### 2.2 `--wallpaper-scrim` 新 token,两套主题都必须给值

| 主题 | 值的意图 |
|---|---|
| blue(白字 `--fg: #fff`) | 与现有 `body::after` 同形态的压暗:顶部微柔光 + 底部暗角 |
| light(近黑字 `--fg: #1c1b19`) | **白纱**(约 55% 白)。**这条不是打磨、是可读性底线** —— 纸感主题的字压在任何深色照片上都会看不见 |

token 落 `theme.css`(该文件是 token 定义处,被 `color-guard.test.ts` 显式排除,所以裸色值写在这里合规)。

### 2.3 数据模型

服务端 key **`custom/wallpaper_v3`**(用户 2026-08-07 拍板:与 Vue2 的 `custom/wallpaper` **完全隔离**,两套壁纸各自独立)。

```ts
type WallpaperRecord =
  | { kind: 'none' }                                 // = 主题渐变(蓝色/白色底板)
  | { kind: 'builtin'; id: 'w01' | 'w02' }
  | { kind: 'image'; path: string; stamp: number }
```

三处刻意的取舍:

- **`builtin` 存稳定 id,不存构建产物 URL。** Vite 的哈希每次构建都变,存 URL 等于"部署一次壁纸就可能坏"。运行时查静态表(`import wallpaper01 from '../assets/wallpaper/wallpaper01.jpg'`)拿真实 URL。
- **`image` 存服务端文件路径,URL 现算**成 `/v1/users/image?path=<enc>&t=<stamp>`。存路径而非 URL,将来取图端点变了不用迁数据。
- **`stamp` 是必须的,不是可选优化。** 后端 `PostUserUploadImage`/`PutUserImage` 都把文件写到固定名 `{UserDataPath}/{userId}/wallpaper{ext}`(`user.go:953` / `:908`)—— 换一张图 URL 一模一样,不带 `stamp` 浏览器会一直显示旧图。Vue2 用 `&time=` 干同一件事。

### 2.4 本地缓存与冷启动防闪

复用**已有的** `localStorage.wallpaper` 键(`session.ts:9/:67` 已经在登出时清它,不新增待清理状态),存整条 `WallpaperRecord` 的 JSON。

`main.ts` 照 `applyTheme(initialTheme())`(`main.ts:43`,mount 前)的先例,紧邻加一行 `applyWallpaper(initialWallpaper())` ⇒ 不闪。坏 JSON 一律退化成 `{kind:'none'}`,绝不抛。

登出清缓存 ⇒ 登录页/欢迎页是主题渐变。**Vue2 也是这样**(`router/index.js:104` 同样清),行为一致,不是缺陷。

## 3. 后端(现存,零改动)

| 端点 | 用途 | 实证/注意 |
|---|---|---|
| `GET /v1/users/current/custom/wallpaper_v3` | 读记录 | 标准信封 |
| `POST /v1/users/current/custom/wallpaper_v3` | 写记录 | 标准信封 |
| `POST /v1/users/current/image/wallpaper` | 上传图 | multipart `file`;**后端无大小上限**(`user.go:928-961` 无 size 检查) |
| `PUT /v1/users/current/image/wallpaper` | 把 NAS 上已有文件设为壁纸 | body `{path}`;**限 10MB**(`user.go:904` `fstat.Size() > 10<<20` → `IMAGE_TOO_LARGE`) |
| `GET /v1/users/image?path=…` | 取图 | **注册在鉴权组外**(`NimoOS-UserService/route/v1.go:40` 是 `e.GET` 而非 `v1UsersGroup`)⇒ CSS `url()` / `<img src>` 直接可用,**不用往 query 塞 token** |

`PUT` 那条的三种失败(`FILE_DOES_NOT_EXIST` / `NOT_IMAGE` / `IMAGE_TOO_LARGE`)都是 **HTTP 200 + `success≠200`**。共享包现有 `unwrap`(`packages/service/src/unwrap.ts`)对这种情况就是抛错,所以不需要特殊处理 —— 但**必须走 `unwrap`**,不能自己读 `res.data`。

## 4. 界面与交互

### 4.1 四个入口

| 位置 | 行为 |
|---|---|
| 顶栏 `[◑]`(`ThemeToggle.vue`) | 三档:**蓝色** / **白色** 一步到位(清壁纸 + 切主题)· **照片…** 开弹窗 |
| 设置 → 通用 → 壁纸 | 解禁「更改」,开同一弹窗 |
| 桌面空白处右键 | 新 `DesktopContextMenu.vue` →「更换壁纸」,开同一弹窗 |
| 文件区右键图片 | 「设为壁纸」,不开弹窗,直接设并 toast |

顶栏打勾逻辑:`kind==='none'` 时按当前主题打「蓝色」或「白色」;`kind!=='none'` 时打「照片」。

**为什么顶栏不直接铺 4 个缩略图**(用户 2026-08-07 提出):那个菜单只有 `min-width: 148px`,塞 4 个缩略图会小到看不出是什么。三档粗选 + 弹窗细选。

### 4.2 弹窗 `src/components/WallpaperDialog.vue`

- **挂 `App.vue`**,与 `AppToast` 并列(所以落 `src/components/`,不落 `settings/`)。理由:设置页是**独立路由** `/settings/:tab`(`settings/settingsRoutes.ts`),桌面右键在 `/` —— 两个入口在不同路由下,弹窗只能是应用级单例。`SearchDialog` 用的 `homeUi` store 是主页作用域的,够不到 `/settings`,不能照它。开关放 `stores/wallpaper.ts` 自己身上。
- **⚠️ 不能用共享的 `src/components/ui/Dialog.vue`。** 它的 `.ui-dialog-overlay` 带 `backdrop-filter: var(--overlay-blur)` + `--overlay-bg`,会把我们正要预览的壁纸糊掉、实时预览直接失效。照 `SearchDialog.vue:308` 的先例直接用 reka-ui 的 `DialogRoot :modal="false"` + 自绘定位:**底部贴边、无遮罩**,上半屏留给真实桌面。
- **async chunk**(`defineAsyncComponent`)⇒ 那 3MB 内置 jpg 只在用户真的点开换壁纸时下载,不进首屏。这是不动图片资源就能拿到的唯一缓解。
- 内容:`[蓝色底板][白色底板][图1][图2]` + `[↑ 上传]` `[从 NAS 选择]` + `[取消][应用]`。**不做预览卡**(见 4.3)。
- 4 个预设并列 ⇒ 从设置页 / 桌面右键进来也能切回蓝色白色,不必绕回顶栏。
- 预设 → 记录的映射:

  | 预设 | 结果 |
  |---|---|
  | 蓝色底板 | `{kind:'none'}` + `theme.setTheme('blue')` |
  | 白色底板 | `{kind:'none'}` + `theme.setTheme('light')` |
  | 图1 / 图2 | `{kind:'builtin', id:'w01'\|'w02'}`,**主题不变** |
  | 上传 / NAS | `{kind:'image', path, stamp}`,**主题不变** |

- **「恢复默认」按钮取消** —— 「蓝色底板」本身就是默认,再放一个按钮是重复入口。

### 4.3 实时预览 + 取消回滚

弹窗占下半屏,上半看**真实桌面**。点哪张背景立即真换(未落盘),`[取消]` 回滚,`[应用]` 才写服务端。

不做 Vue2 那种预览卡的理由:Vue2 预览卡里画的假小组件跟 New-UI 真实磁贴长得完全不一样,反而误导;而且真实预览省掉一个组件 + 两个占位美术资源(`preview-widget.svg` / `blank.png` 不移植)。

**⚠️ 回滚快照必须是 `{ record, theme }` 两件。** 这是「顶栏三档」+「实时预览」两个决定合起来才浮出的细节:点「白色底板」预览会**同时切主题**,只快照 record 会导致取消后「配色留在白色、背景回到蓝色」的错配。必须有回归测试(§6)。

### 4.4 文件区「设为壁纸」

门控**逐字对位** Vue2(`ContextMenu.vue:96` + `:163-165`):单选 + 非目录 + 扩展名 ∈ `png/jpg/jpeg/bmp/gif/svg` + **非快照态**。

后端 `PUT` 限 10MB ⇒ 大图会抛 `IMAGE_TOO_LARGE`,必须显示可读的失败 toast,不能静默。

### 4.5 「从 NAS 选择」复用既有组件

复用 SP9-P4 的 `src/settings/panels/account/NasImagePicker.vue`(194 行,整块只读:`storage.list` / `raid.list` / `folder.getList` / `<img>` 取 `/v1/image`)。

需要一处改动:`pick` 事件从 `[src: string]` 扩成 `[{ path: string; src: string }]` —— 壁纸要 NAS **文件路径**才能发 `PUT`,头像要**显示 URL**。改 1 个调用点(`AccountPanel.vue`)。

**不移动该组件。** 它已在 `settings/` 下且依赖 `settings/styles/settings.css`;搬到 `components/` 会让它把设置区样式表拖进全局包,换来的只是目录观感。代价是弹窗(在 `src/components/`)要跨区 import 它一次 —— 这一次跨区 import 比搬家 + 改样式归属便宜,登记在案。

### 4.6 内置图资源

用户拍板:**原样照搬** Vue2 那 2 张 jpg,不转码不压缩。落 `src/assets/wallpaper/wallpaper01.jpg`(2.2MB)/ `wallpaper02.jpg`(848KB)。

**已声明的代价**:3MB 进构建产物树与开源仓;弹窗缩略图会加载全图(靠 4.2 的 async chunk 把它挪出首屏,但打开弹窗时确实要下 3MB)。

## 5. 共享包(`packages/service/src/users.ts`)

`users.ts` 末尾原本明确写着「`get/set/deleteUserImage`(壁纸/自定义图,不属 account tab)**不进包**」—— 本期就是来收这笔账的,那条注释要相应改写。

```ts
uploadImage(key: string, file: File): Promise<{ path: string; file_name: string; online_path: string }>
setImageFromPath(key: string, path: string): Promise<{ path: string; file_name: string; online_path: string }>
```

- 上传用 `FormData` + axios,**不引 `simple-uploader.js`**。Vue2 用了它但把 `chunkSize` 设成 `1024**4`(1TB)⇒ 等于根本没分片,是一整个多余依赖。
- 两个方法都走 `unwrap`(理由见 §3)。
- 注释里必须写明:`uploadImage` 后端**无大小上限**、`setImageFromPath` 后端限 **10MB**,以及两者都覆盖同一个固定文件名(所以调用方必须自己造 `stamp`)。

## 6. 测试与守卫

| 层 | 内容 |
|---|---|
| store 单测 | `load`/`save`/`clear` · 三种 `kind` 的 URL 派生 · 坏 JSON 退化成 `none` 不抛 · `applyWallpaper` 写对 `data-wallpaper` + `--wallpaper-img` · **回滚快照含 theme**(§4.3 的错配路径) |
| 共享包单测 | `uploadImage` 的 FormData 形状 · `setImageFromPath` 在 `success≠200` 时抛且 message 可读(三种错误码各一例) |
| CSS 守卫(新) | ① `--wallpaper-scrim` 在**两套主题都有值** ② **第 4 条规则的源码位置在 `theme.css:522-523` 之后**(§2.1 坑 B —— 这是"三道门全绿但真机看不见字"那一类,必须用文本位置断言钉住) ③ 用 `node:fs` 读 `.css`(`?raw` 对 `.css` 在 vitest 下恒空,已栽过) |
| 组件测 | `ThemeToggle` 三档 + 打勾逻辑 · `WallpaperRow` 按钮已解禁并能开弹窗 · `DesktopContextMenu` 落在 `.grid-item` 上时放行 · `FileContextMenu` 扩展名白名单六进一出 + 快照态隐藏 |
| i18n | 新键双语齐全由既有 `i18n/parity.test.ts` 自动保证;删 `settingsWallpaperNa` 要两侧同删 |
| 收尾门 | 全量 vitest + `vue-tsc` + `color-guard` + `selectPopup` + build + `oss` 产物树能构建 |

## 7. 移植纪律登记(Vue2 的毛病不照抄,每处代码留注释)

| Vue2 坐标 | 问题 | 处置 |
|---|---|---|
| `CasaWallpaper.vue:70-75` | `parseUrl()` 里 `.replace('/ui','')` / `.replace('/user/','/users/')`(:73) | 后端返的 `online_path` 既不含 `/ui` 也不含 `/user/`,纯历史垃圾 → 不移植 |
| `CasaWallpaper.vue:72` | `SERVER_URL` 占位符替换成 `${protocol}//${baseURL}` | New-UI 同源,直接相对路径 → 不移植 |
| `WallpaperModal.vue:100` | 上传前先调 `sys.getVersion()` 只为拿 token | 无意义 → 不移植 |
| `WallpaperModal.vue:143` | `saveChange()` 里 `setTimeout(300)` 才提交 store(等弹窗动画的 hack) | → 不移植 |
| `WallpaperModal.vue:86-93` | `simple-uploader.js`,`chunkSize` 1TB(:92) | → 换 FormData |
| `Home.vue:208-217` | `getWallpaperConfig()` 无 `catch`,失败静默 | → 显式错误态 |
| `router/route.js` | `meta.showBackground` 只让 4 条路由显示壁纸 | **不移植门控**,见 §8① |
| `WallpaperModal.vue` 预览卡 | `preview-widget.svg` / `blank.png` | → 不移植,改真实预览 |

## 8. 判断与已知限制

① **壁纸全应用可见。** 不移植 Vue2 的 `showBackground` 路由门控 —— 那是因为 Vue2 的非主页路由是不透明整屏视图;New-UI 各区(`AreaShell` 无背景色)本就是透明浮层,加门控会造出「一进文件区壁纸就消失」的怪相。

② **上传加 10MB 前端上限。** Vue2 无上限、后端 `POST` 也无上限(传 200MB RAW 它就真存),但后端 `PUT` 自己限 10MB。前端统一到 10MB 并给**明确提示**(不是静默失败)。这是行为改动,已在设计阶段声明。

③ **弹窗 async chunk。** 见 §4.2。

④ **已知限制(本期不改,记账)**:壁纸存服务端 ⇒ 跨设备同步;但主题一直只存 `localStorage`(`stores/theme.ts:27`)⇒「蓝色/白色底板」这个选择**不跨设备同步**。这是既有行为,要修等于给主题也开一个服务端 key,不在本期范围。

## 9. 不做

- 不改后端。
- 不与 Vue2 的 `custom/wallpaper` 互通(用户拍板)。
- 不做壁纸轮播 / 每日一图 / 模糊度调节 / 位置调节(Vue2 也没有)。
- 不移动 `NasImagePicker.vue`(§4.5)。
- 不给主题加服务端持久化(§8④)。
- 手机端(`MobileHome`)不加右键/长按入口 —— 它是只读启动器,壁纸仍会显示。
