# NimoOS-New-UI

NimoOS Web UI 的 Vue 3 重写(策略 C:并行新应用 + 路由绞杀)。与 Vue 2 主应用(`/`)同源并存,挂在 `/app/`。

## 开发
```bash
# 首次:先构建共享包
cd ../NimoOS-Service && pnpm install && pnpm build && cd ../NimoOS-New-UI

pnpm install            # 依赖 ../NimoOS-Service(file: 链接)
pnpm dev                # http://localhost:5273/app/
pnpm test               # vitest
pnpm build              # vue-tsc + vite build → dist/
```

## 部署
```bash
# 首次:sudo mkdir -p /var/lib/nimoos/www/app && sudo chown nimo:nimo /var/lib/nimoos/www/app
./scripts/deploy.sh     # build + rsync 到 /var/lib/nimoos/www/app/
```

## 共享 service 包
HTTP/认证内核来自 `@nimotech/nimoos-service`(`../NimoOS-Service`)。改动该包后需 `cd ../NimoOS-Service && pnpm build`,新应用即生效。

## 路由
hash 路由(`/app/#/`),免改 Gateway。未登录跳 `/#/login`(回 Vue 2 应用)。
