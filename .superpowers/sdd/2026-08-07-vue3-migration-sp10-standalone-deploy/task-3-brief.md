### Task 3: 删掉 Vue2 的 `/next/` 死链

**Files:**
- Modify: `NimoOS-UI/src/views/Home.vue`(模板 299-304、SCSS 360-401、SCSS 402-412)
- Test: `NimoOS-UI/src/views/__tests__/Home.nextLink.spec.js`

**Interfaces:**
- Consumes: 无
- Produces: 无(纯删除 + 守卫)

**背景(实现者必读):** `/next/` 是七月的新主页原型,**原型目录本身早就没了** —— `NimoOS-UI/public/next/` 现在 0 个文件,设备 `/var/lib/nimoos/www/` 下也没有 `next` 目录。**所以桌面右上角那颗「New homepage」按钮现在点下去就是 404。** 本任务只是把这颗死按钮和它的样式清掉。

两个 i18n 键 `New homepage` / `Try the new homepage` **不在任何语言包里**(`src/assets/lang/*.json` 全部零命中),vue-i18n 回落到键名本身直接显示英文 —— 所以**不需要改任何语言文件**。

- [ ] **Step 1: 写失败测试**

创建 `NimoOS-UI/src/views/__tests__/Home.nextLink.spec.js`:

```js
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// 读源文本而不是挂载组件:这颗按钮是死链(/next/ 原型目录已不存在),
// 我们要防的是"有人把它加回来",源文本断言比渲染断言更直接、也不用给 Home.vue
// 那一大堆依赖打桩。
const SRC = readFileSync(fileURLToPath(new URL('../Home.vue', import.meta.url)), 'utf8')

describe('/next/ 原型入口已移除(SP10-T3)', () => {
  it('模板里没有指向 /next/ 的链接', () => {
    expect(SRC).not.toContain('/next/')
  })

  it('enter-next 的类名与样式一并清干净(含 __spark/__arrow/__text 与那条 480px media query)', () => {
    expect(SRC).not.toContain('enter-next')
  })

  it('两个只服务于该按钮的 i18n 键也不再引用', () => {
    expect(SRC).not.toContain('New homepage')
    expect(SRC).not.toContain('Try the new homepage')
  })
})
```

- [ ] **Step 2: 跑测试确认它失败**

```bash
cd /home/nimo/NimoTech/NimoOS-UI
pnpm exec vitest run src/views/__tests__/Home.nextLink.spec.js
```

预期:3 条全失败。

- [ ] **Step 3: 删掉三处**

**3a — 模板(`src/views/Home.vue` 第 299-304 行)**,删掉这 6 行:

```html
    <!-- 进入新主页（/next/，hash 路由之外，整页跳转） -->
    <a class="enter-next" href="/next/" :title="$t('Try the new homepage')">
      <span class="enter-next__spark">✦</span>
      <span class="enter-next__text">{{ $t('New homepage') }}</span>
      <span class="enter-next__arrow">→</span>
    </a>
```

删完后 `<div v-if="!isLoading" class="out-container">` 的下一行应当直接是 `<!-- Content Start -->`。

**3b — SCSS 主块(第 360-400 行 + 其后的空行)**,删掉整个 `.enter-next { … }`:

```scss
.enter-next {
    position: absolute;
    top: 1.4rem;
    right: 1.6rem;
    z-index: 30;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    height: 38px;
    padding: 0 1rem;
    border-radius: 999px;
    font-size: 0.9rem;
    font-weight: 600;
    color: #fff;
    text-decoration: none;
    background: rgba(255, 255, 255, 0.14);
    border: 1px solid rgba(255, 255, 255, 0.28);
    backdrop-filter: blur(14px) saturate(140%);
    box-shadow: 0 8px 24px -8px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.4);
    transition: transform 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;

    &:hover {
        transform: translateY(-2px);
        background: rgba(255, 255, 255, 0.24);
        box-shadow: 0 14px 30px -8px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.5);
    }

    &__spark {
        font-size: 0.95rem;
        line-height: 1;
        opacity: 0.9;
    }

    &__arrow {
        transition: transform 0.18s ease;
    }

    &:hover &__arrow {
        transform: translateX(3px);
    }
}
```

**3c — SCSS media query(第 402-412 行)**,删掉整个块。⚠️ **先确认这个 `@media` 里只有 enter-next 两条规则再删,别把别的响应式规则一起带走**:

```scss
@media screen and (max-width: 480px) {
    .enter-next {
        top: auto;
        bottom: 1rem;
        right: 1rem;
    }

    .enter-next__text {
        display: none;
    }
}
```

删完后 `.out-container { … }` 那个块的下一个块应当直接是 `.contents { flex: 1; overflow-y: hidden;`。

- [ ] **Step 4: 跑测试确认通过 + 确认没删多**

```bash
cd /home/nimo/NimoTech/NimoOS-UI
pnpm exec vitest run src/views/__tests__/Home.nextLink.spec.js
# 反向检查:确认只删了预期的 3 段、没有波及别的规则
git diff --stat src/views/Home.vue          # 预期 55–62 行删除、0 新增(模板 6 + SCSS 主块 41 + 空行 + media 11)
git diff src/views/Home.vue | grep '^+' | grep -v '^+++'   # 预期无输出(纯删除)
# Home.vue 的既有测试不能被带红
pnpm exec vitest run src/views/__tests__/
```

预期:新 spec 3 passed;`git diff` 只有删除行、没有新增行;`__tests__/` 目录下既有 spec 与改动前一致(Vue2 全量有 8 个既有失败,以**不新增**为准,别要求全绿)。

- [ ] **Step 5: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-UI
git add src/views/Home.vue src/views/__tests__/Home.nextLink.spec.js
git commit -m "chore(sp10): 删掉桌面右上角 /next/ 死链(原型目录早已不存在,点了是 404)"
```

---

