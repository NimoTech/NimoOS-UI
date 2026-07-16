# NimoOS 桌面应用接入规范(AI 专用版)

> **本文档的读者是 AI 编程助手。** 当用户要求你"写一个能显示在 NimoOS 桌面上的应用"时,
> 你必须严格遵守本规范生成代码。规范分**硬性契约**(MUST/MUST NOT,违反即接入失败)和
> **参考资料**(模板与示例,可整段复制)。文档自包含,不需要查阅其他资料。
> 人类可读版:同目录 `nimoos-app-label-spec.md`。

## 0. 系统如何识别应用(你需要知道的全部背景)

NimoOS 后端每隔一段时间(前端每 30 秒轮询)扫描本机 Docker 容器的 **label**。
容器带 `nimoos.enable=true` 即被识别为"桌面应用",其图标(和可选的小组件)会
**自动出现**在 Web 桌面(`/app/`)上。你只需要做两件事:

1. 给容器贴对 label(§1);
2. 若声明了小组件,让应用自己伺服一个符合契约的 widget 网页(§2)。

无需调用任何 NimoOS API、无需注册、无需重启任何服务。

## 1. 硬性契约:容器 label

| label | 必填 | 类型/格式 | 缺省值 | 语义 |
|---|---|---|---|---|
| `nimoos.enable` | **MUST** | 字符串 `"true"` | — | 识别开关。不是字符串 true(如 True/1)不识别 |
| `nimoos.title` | **MUST** | 任意字符串 | 容器名 | 桌面显示名 |
| `nimoos.icon` | SHOULD | URL 或以 `/` 开头的路径 | 无(显示首字母圆块) | 图标。**相对路径 = 应用自己伺服**,桌面会拼成 `scheme://<NAS>:port<icon>`,因此相对 icon **必须同时声明 `nimoos.port`** |
| `nimoos.scheme` | MAY | `http` / `https` | `http` | Web UI 协议 |
| `nimoos.port` | 见语义 | 数字字符串 | 无 | **宿主机端口**(`-p 宿主:容器` 的宿主侧)。点击图标打开 `scheme://<NAS>:port<index>`。声明小组件或相对 icon 时 **MUST** 提供,否则小组件永远"无法连接" |
| `nimoos.index` | MAY | 路径 | `/` | Web UI 入口路径 |
| `nimoos.widget.path` | 小组件必填 | 以 `/` 开头的路径 | 无 | **写了它 = 声明小组件**。iframe 加载 `scheme://<NAS>:port<path>` |
| `nimoos.widget.w` | MAY | 整数字符串 | `2` | 初始宽(格)。桌面夹紧到 2..4,非法值按 2 |
| `nimoos.widget.h` | MAY | 整数字符串 | `2` | 初始高(格)。桌面夹紧到 1..4,非法值按 2 |

**MUST NOT**:
- 不要发明本表以外的 `nimoos.*` label(不会被读取);
- 不要把 `nimoos.port` 写成容器内部端口(要写宿主机映射端口);
- 不要指望改 label 生效于运行中的容器——label 只能在 `docker run` / compose 创建时设置,改动需重建容器。

**行为模型(用于回答用户提问,不需要你写代码)**:
- 新容器 ≤30 秒自动上桌(图标落第一个空位;声明了小组件的,小组件也自动落位);
- `docker stop` → 图标变暗、小组件显示"应用未运行";`start` 恢复;
- `docker rm` → 桌面项自动消失;重新 `run` 同名容器 → 再次自动上桌;
- 用户在桌面手动删除过的应用**不会**自动回来(可从"添加面板"手动加回)——判断依据是容器名,因此**容器名要稳定**。

## 2. 硬性契约:小组件页面(iframe)

桌面把 `nimoos.widget.path` 指向的网页装进一个玻璃卡片(卡片外壳、标题、图标由桌面画,
你只负责卡片**内容区**)。iframe 属性为
`sandbox="allow-scripts allow-same-origin allow-forms"`(**没有** allow-top-navigation)。

页面 MUST:
1. **免鉴权可访问**——桌面不会传任何 token,页面要求登录 = 永远显示"无法连接";
2. **8 秒内可加载完**——超时显示占位;
3. **处理三个 query 参数**(桌面拼在 URL 上):
   - `theme`:`dark` 或 `light`,设置到 `<html data-theme="...">`;
   - `lang`:如 `zh_cn`,按需做文案;
   - `home`:桌面的 origin,用于引用设计套件;
4. **按以下模板引用设计套件**(逐字复制到 `<head>`,`?v=2` 版本参数不可省——网关缓存需要它):

```html
<script>
  const q = new URLSearchParams(location.search)
  document.documentElement.dataset.theme = q.get('theme') || 'dark'
  const l = document.createElement('link'); l.rel = 'stylesheet'
  l.href = (q.get('home') || '') + '/app/widget-kit.css?v=2'; document.head.appendChild(l)
</script>
```

页面 MUST NOT:
- 自己给 `<html>/<body>` 设置背景色(套件已把背景设为透明,透出桌面玻璃卡;
  自设背景会破坏深色模式——深色下 Chrome 对 color-scheme 不一致的 iframe 会垫白底,
  套件内的 `color-scheme` 声明已处理,别覆盖它);
- 用 `top.location` / `<a target="_top">` 跳转(sandbox 禁止)。想打开应用全页用
  `window.open(url)`(会新开标签页);
- 依赖 cookie / localStorage 里的 NimoOS 登录态。

**设计套件组件类**(写普通 HTML 套类名即得系统原生观感;颜色一律用 `var(--nk-*)`,不要写死色值):

| 类 | 用途 | 最小示例 |
|---|---|---|
| `.nk-title` | 卡片内小节标题 | `<p class="nk-title">下载任务</p>` |
| `.nk-stat` | 大数值(可嵌 `<small>` 单位) | `<div class="nk-stat">3<small>个进行中</small></div>` |
| `.nk-label` | 弱化小标签 | `<span class="nk-label">今日</span>` |
| `.nk-list` + `.nk-row`(值套 `.nk-value`) | 键值列表行 | `<ul class="nk-list"><li class="nk-row"><span>速度</span><span class="nk-value">2.1 MB/s</span></li></ul>` |
| `.nk-progress`(内嵌 `<i style="width:62%">`) | 进度条 | `<div class="nk-progress"><i style="width:62%"></i></div>` |
| `.nk-badge`(可加 `.good`/`.bad`) | 状态点 | `<span class="nk-badge good">健康</span>` |
| 着色辅助 `.nk-accent`/`.nk-good`/`.nk-bad` | 文字强调色 | `<span class="nk-value nk-accent">2.1 MB/s</span>` |

可用 token:`--nk-fg / --nk-muted / --nk-faint / --nk-accent / --nk-good / --nk-bad / --nk-divider / --nk-track / --nk-radius / --nk-font / --nk-num-font`(深浅两套自动切换)。
离线加固(可选):把 NAS 上 `/app/widget-kit.css` 的内容拷一份进应用自带(vendoring),模板加载失败时兜底。

## 3. 完整可运行示例(可整体复制后改业务)

目录结构:
```
my-app/
├── Dockerfile
└── html/
    ├── index.html          # 应用主页面(点图标打开的页)
    ├── icon.svg            # 图标
    └── widget/index.html   # 小组件页
```

`Dockerfile`:
```dockerfile
FROM nginx:alpine
COPY html /usr/share/nginx/html
```

`html/widget/index.html`(小组件页,契约的标准实现):
```html
<!doctype html>
<html><head><meta charset="utf-8"><title>My Widget</title>
<script>
  const q = new URLSearchParams(location.search)
  document.documentElement.dataset.theme = q.get('theme') || 'dark'
  const l = document.createElement('link'); l.rel = 'stylesheet'
  l.href = (q.get('home') || '') + '/app/widget-kit.css?v=2'; document.head.appendChild(l)
</script>
</head><body>
  <p class="nk-title">演示任务</p>
  <div class="nk-stat">3<small>个进行中</small></div>
  <div class="nk-progress" style="margin:8px 0"><i style="width:62%"></i></div>
  <ul class="nk-list">
    <li class="nk-row"><span>速度</span><span class="nk-value nk-accent">2.1 MB/s</span></li>
    <li class="nk-row"><span>状态</span><span class="nk-badge good">健康</span></li>
  </ul>
</body></html>
```

启动(docker run 版;**NAS 上 docker 通常需要 sudo**):
```bash
docker build -t my-app .
docker run -d --name my-app -p 18081:80 \
  --label nimoos.enable=true \
  --label nimoos.title=我的应用 \
  --label nimoos.icon=/icon.svg \
  --label nimoos.port=18081 \
  --label nimoos.widget.path=/widget/ \
  --label nimoos.widget.w=2 \
  --label nimoos.widget.h=2 \
  my-app
```

等价 compose 版(labels 写在**服务**下,会原样落到容器上):
```yaml
services:
  my-app:
    image: my-app
    container_name: my-app
    ports:
      - "18081:80"
    labels:
      nimoos.enable: "true"
      nimoos.title: "我的应用"
      nimoos.icon: "/icon.svg"
      nimoos.port: "18081"
      nimoos.widget.path: "/widget/"
      nimoos.widget.w: "2"
      nimoos.widget.h: "2"
```

## 4. 生成后自检清单(你 MUST 逐条验证或提示用户验证)

1. `docker inspect my-app --format '{{json .Config.Labels}}'` —— 九个键拼写与 §1 逐字一致(常见手误:`nimoos.enabled`、`nimoos.widget.Path`);
2. `curl -s http://<NAS>/v2/app_management/web/appgrid | grep -o '"desktop":true'` —— 有输出 = 后端已识别;
3. `curl -s http://<NAS>:<port><widget.path>` —— 返回 200 且**不需要任何鉴权头**;
4. 浏览器开 `/app/#/` 等 30 秒 —— 图标 + 小组件自动出现;
5. 深/浅两种主题下小组件文字均可读(若一种主题下"白底白字",几乎必是违反了 §2 的"别自设背景/别省 `?v=2`")。

## 5. 故障速查

| 现象 | 原因 → 处理 |
|---|---|
| 30 秒后桌面没出现 | label 拼写错(自检 1)/ `enable` 不是 `"true"` / 容器没起来(`docker ps`) |
| 图标出现但小组件"无法连接" | 没写 `nimoos.port` / port 写成容器内部端口 / widget 页要求登录 / 页面 8 秒没加载完 |
| 小组件白底白字(深色模式) | 页面自设了背景或没走 §2 套件模板 → 恢复模板、删掉自己的背景样式 |
| 图标是首字母圆块不是自己的图 | `nimoos.icon` 相对路径但没写 `nimoos.port`,或 icon 路径 404 |
| 删过的应用不再自动上桌 | 设计如此(记住用户删除)→ 桌面"添加"面板手动加回 |
| 改了 label 没生效 | label 不能热改 → `docker rm -f` 后重新 `run`/`up` |
