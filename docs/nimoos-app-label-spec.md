# NimoOS 桌面第三方应用接入规范(`nimoos.*` label)

> 面向对象:自己写 `docker run` / `docker-compose` 部署容器,想让应用图标和(可选)小组件
> 自动出现在 NimoOS 桌面(`/app/`)上的开发者。
> 机制:纯 **Docker label 约定**,与部署方式无关 —— 手写 `docker run`、compose、还是商店应用,
> 只要容器带了这些 label,New-UI 桌面就会在 ≤30 秒内自动识别并上桌,无需在商店注册、无需改网关路由。

## 1. label 规范表

| label | 必填 | 缺省值 | 含义 |
|---|---|---|---|
| `nimoos.enable` | **是** | 无 —— 不写此 label 就完全不识别,容器展示行为与今天完全一致 | 识别开关,必须是字符串 `"true"` |
| `nimoos.title` | **是**(缺省仍可识别,但视为规范不完整) | 容器名 | 桌面显示名。首期仅支持单值(zh_cn 优先政策);规范预留 `nimoos.title.<locale>` 后缀式多语言扩展,首期不实现 |
| `nimoos.icon` | 否 | 无 → 桌面用标题首字母生成圆块图标 | 图标地址。可以是**相对路径**(应用自己伺服,如 `/icon.png`),也可以是完整 `http(s)://` URL |
| `nimoos.scheme` | 否 | `http` | 点桌面图标打开应用主页时用的协议 |
| `nimoos.port` | 否 | 无 → 图标可上桌,但点击打开动作缺端口信息 | Web UI 在**宿主机**上监听的端口(即 `docker run -p` 里冒号左边那个),打开链接拼成 `scheme://<NAS地址>:port + index` |
| `nimoos.index` | 否 | `/` | 应用主页入口路径 |
| `nimoos.widget.path` | 否(写了即声明有小组件) | 不写 = 该应用没有小组件,只有图标 | 小组件 iframe 页面的路径,由应用自己伺服,**必须免鉴权可访问**(桌面不会向 iframe 传任何 token) |
| `nimoos.widget.w` | 否 | 前端夹紧默认 `2` | 小组件初始宽度(格子数),前端把非法值 / 越界值夹紧到 `2..4` |
| `nimoos.widget.h` | 否 | 前端夹紧默认 `2` | 小组件初始高度(格子数),前端夹紧到 `1..4` |
| `nimoos.widget.minw` / `nimoos.widget.minh` | 否 | 全局下限 `2` / `1` | 小组件可调整的最小宽/高(格子数),夹紧进全局 `2..4` / `1..4`。四个范围 label 都不写 = 现状(全局范围内可调) |
| `nimoos.widget.maxw` / `nimoos.widget.maxh` | 否 | 全局上限 `4` / `4` | 小组件可调整的最大宽/高(格子数),同样夹紧进全局范围;min > max 时以 min 为准。**min == max 时尺寸锁死,桌面编辑模式自动隐藏该组件的调整把手**;初始 `w`/`h` 也会被夹进这个范围 |
| `nimoos.widget.resize` | 否 | 可调整 | 写字符串 `"false"` ≡ `min=max=初始 w/h`(尺寸锁死语法糖,`w`/`h` 未声明按默认 `2×2` 锁死);显式 min/max label 优先于本糖 |

补充:
- `nimoos.enable=true` 是唯一的识别门槛;v1 老约定 `nimoos=nimoos` 原样保留,两套互不干扰。
- 容器停止(`docker stop`)后:后端明确报告停止状态,图标和小组件在下一次轮询(≤30 秒,
  强刷立即)自动从桌面移除。
- 容器删除(`docker rm`)后:从列表彻底消失,约 1 分钟内自动移除(45 秒缺席宽限期,
  吸收 Docker 枚举瞬时抖动,抖动不清桌)。
- 容器重新运行(`start`/`run`)后:≤30 秒内**再次自动上桌**,位置重新分配。
- 用户在桌面上手动删除过的图标/小组件:容器持续运行期间不会自动加回,可以在"添加面板"里手动加回。
  (容器一旦停止/删除超过宽限期,"手动删除"记忆随之清除,之后重新运行会再次自动上桌。)

## 2. widget 页面要求

如果你的应用要做桌面小组件(而不只是一个应用图标),`nimoos.widget.path` 指向的页面必须满足:

1. **免鉴权访问** —— 桌面用 `<iframe>` 直接打开这个 URL,不会附带任何 NimoOS JWT / Cookie。
   如果这个路径命中了你应用自己的登录检查,小组件会打不开(参见下方"常见问题")。
2. **透明背景** —— 页面外层卡片壳(玻璃卡片、圆角、投影)由桌面画,widget 页面本身
   `background` 必须保持透明,只画内容。`widget-kit.css` 已经把 `html, body` 的
   `background: var(--nk-bg)`(默认 `transparent`)设好了,正常引用即可。
3. **识别桌面通过 iframe URL 的三个查询参数**,页面加载时读取:

   | 参数 | 取值 | 用途 |
   |---|---|---|
   | `theme` | `dark` \| `light` | 当前桌面主题,决定 kit 的深浅色 token |
   | `lang` | 如 `zh_cn` | 当前桌面语言,widget 自行做多语言可参考 |
   | `home` | 桌面 origin,如 `http://192.168.1.10:8080` | 用来拼接 `widget-kit.css` 的完整 URL |

   桌面切换主题时会重新加载 iframe(首期不做 postMessage 热切换,故切主题即整体刷新)。

## 3. 引用 `widget-kit.css`(模板)

`widget-kit.css` 由桌面随构建发布在 `/app/widget-kit.css`,不占用网关任何路由。三行模板:

```html
<script>
  const q = new URLSearchParams(location.search)
  document.documentElement.dataset.theme = q.get('theme') || 'dark'
  const l = document.createElement('link'); l.rel = 'stylesheet'
  l.href = (q.get('home') || '') + '/app/widget-kit.css?v=2'; document.head.appendChild(l)
</script>
```

放在 `<head>` 里,越早越好(避免闪一下无样式内容)。也允许把 `widget-kit.css` 整份文件拷进你的
应用做 vendoring,断网也能正常显示(牺牲的是桌面以后升级 kit 时你不会自动拿到新版本)。

## 4. `.nk-*` 组件类清单

以下类名都定义在 `widget-kit.css` 里,直接在你的 widget 页面 HTML 上使用,颜色/字体会自动跟随
桌面当前主题(通过 `data-theme` 属性 + CSS 变量)。

| 类名 | 说明 | 最小示例 |
|---|---|---|
| `.nk-title` | 小标题(13px、半粗、muted 色),放在组件顶部 | `<p class="nk-title">演示任务</p>` |
| `.nk-stat` | 大数值(30px、粗体、等宽数字);内嵌 `<small>` 是单位/说明文字 | `<div class="nk-stat">3<small>个进行中</small></div>` |
| `.nk-label` | 小号说明文字(12px、faint 色) | `<span class="nk-label">上次同步 3 分钟前</span>` |
| `.nk-accent` | 强调色文字(跟随主题 accent) | `<span class="nk-value nk-accent">2.1 MB/s</span>` |
| `.nk-good` | 正常/健康状态色文字 | `<span class="nk-good">运行中</span>` |
| `.nk-bad` | 异常/告警状态色文字 | `<span class="nk-bad">连接失败</span>` |
| `.nk-list` + `.nk-row` | 无序列表容器 + 单行(两端对齐,行间细分割线);`.nk-value` 修饰右侧数值列 | 见下方完整示例 |
| `.nk-progress` + 内层 `<i>` | 进度条外壳 + 内层填充条(用内联 `style="width:62%"` 控制百分比) | `<div class="nk-progress"><i style="width:62%"></i></div>` |
| `.nk-badge` (`.good` / `.bad` 修饰) | 带圆点的状态徽标 | `<span class="nk-badge good">健康</span>` |

完整组合示例:

```html
<p class="nk-title">演示任务</p>
<div class="nk-stat">3<small>个进行中</small></div>
<div class="nk-progress" style="margin:8px 0"><i style="width:62%"></i></div>
<ul class="nk-list">
  <li class="nk-row"><span>速度</span><span class="nk-value nk-accent">2.1 MB/s</span></li>
  <li class="nk-row"><span>剩余</span><span class="nk-value">14 分钟</span></li>
  <li class="nk-row"><span>状态</span><span class="nk-badge good">健康</span></li>
</ul>
```

## 5. 完整示例

下面两种接入方式给出同一套 label 的完整写法(任何 nginx + 静态页面的容器都可以照搬,
widget 页面按 §2/§3 的要求写即可)。

### 5.1 `docker run`

```bash
docker run -d --name nimoos-demo-widget -p 18080:80 \
  --label nimoos.enable=true \
  --label nimoos.title=演示小组件 \
  --label nimoos.icon=/icon.svg \
  --label nimoos.port=18080 \
  --label nimoos.widget.path=/widget/ \
  --label nimoos.widget.w=2 \
  --label nimoos.widget.h=2 \
  nimoos-demo-widget
```

### 5.2 `docker-compose.yml`

```yaml
services:
  demo-widget:
    build: .
    ports:
      - "18080:80"
    labels:
      nimoos.enable: "true"
      nimoos.title: "演示小组件"
      nimoos.icon: "/icon.svg"
      nimoos.port: "18080"
      nimoos.widget.path: "/widget/"
      nimoos.widget.w: "2"
      nimoos.widget.h: "2"
```

## 6. 常见问题

**应用装完 30 秒后桌面还是没出现图标 / 小组件?**
1. 先用 `docker inspect <容器名或ID> --format '{{json .Config.Labels}}'` 确认 label 确实写进了容器,
   而不是只写在 compose 文件里没生效 —— 常见原因是 label 名拼错(比如 `nimoos.widget.Path` 大小写、
   `nimoos.enabled` 多打了个 `d`)。所有 label 名都是**小写、点分隔**,必须逐字符匹配本文档 §1。
2. 确认 `nimoos.enable` 的值确实是字符串 `"true"`(不是布尔 `true`,YAML 里裸 `true` 会被解析成
   布尔类型,和字符串比较可能不相等 —— 建议像 §5.2 那样显式加引号)。
3. New-UI 桌面对 appgrid 是**轮询**(仅桌面可见时,每 30 秒一次)+ 聚焦刷新,不是实时推送;
   确认已经等待了至少一个轮询周期,或切走再切回桌面触发一次聚焦刷新。

**小组件卡片显示"无法连接"?**
1. 先检查 `nimoos.widget.path` 指向的页面是不是要求登录 / 要求 NimoOS JWT —— 桌面的 iframe
   **不会**携带任何 token,widget 页面必须对匿名请求也能正常返回内容(见 §2 第 1 条)。
2. 检查端口是否真的映射到了宿主机(`docker run -p <宿主端口>:<容器端口>` 或 compose 的 `ports:`);
   如果容器只在内部网络监听,桌面所在浏览器是从宿主机地址访问不到的。
3. 8 秒超时未加载完成也会判定为"无法连接"并显示占位重试按钮 —— 确认页面本身没有阻塞式的
   慢请求(比如同步等待一个不可达的第三方 API)拖慢首屏。
